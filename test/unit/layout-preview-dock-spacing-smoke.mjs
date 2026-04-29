import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const rootDir = path.resolve(new URL('../..', import.meta.url).pathname);
const requireFromHere = createRequire(import.meta.url);
const electronBinary = requireFromHere('electron');
const viewportCases = Object.freeze([
  [1279, 793],
  [1280, 793],
  [1440, 793],
]);

function buildChildSource({ tempRoot }) {
  return `
const path = require('node:path');
const { app, BrowserWindow, dialog, session } = require('electron');

const rootDir = ${JSON.stringify(rootDir)};
const viewportCases = ${JSON.stringify(viewportCases)};
let networkRequests = 0;
let dialogCalls = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

for (const methodName of ['showOpenDialog', 'showSaveDialog', 'showMessageBox']) {
  dialog[methodName] = async () => {
    dialogCalls += 1;
    throw new Error('DIALOG_BLOCKED');
  };
}

app.setPath('appData', ${JSON.stringify(path.join(tempRoot, 'appData'))});
app.setPath('userData', ${JSON.stringify(path.join(tempRoot, 'userData'))});
app.setPath('documents', ${JSON.stringify(path.join(tempRoot, 'documents'))});
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('force-device-scale-factor', '1');
app.commandLine.appendSwitch('disable-features', 'UseSkiaRenderer');

process.chdir(rootDir);
process.argv.push('--dev');

app.whenReady().then(() => {
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const url = details && typeof details.url === 'string' ? details.url : '';
    const shouldBlock = /^(https?|wss?):/u.test(url);
    if (shouldBlock) networkRequests += 1;
    callback({ cancel: shouldBlock });
  });
});

require(path.join(rootDir, 'src', 'main.js'));

async function waitForWindow() {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) return win;
    await sleep(50);
  }
  throw new Error('WINDOW_NOT_CREATED');
}

async function waitForLoad(win) {
  if (!win.webContents.isLoadingMainFrame()) return;
  await new Promise((resolve) => win.webContents.once('did-finish-load', resolve));
}

const collectPreviewSpacing = (() => {
  const rectOf = (element) => {
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    return {
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
    };
  };
  const intersects = (a, b) => Boolean(
    a && b
      && a.left < b.right
      && a.right > b.left
      && a.top < b.bottom
      && a.bottom > b.top
  );
  const main = document.querySelector('.main-content--editor');
  const wrapper = document.querySelector('.editor-panel-wrapper');
  const host = document.querySelector('#editor.tiptap-host');
  const firstSheet = document.querySelector('#editor.tiptap-host .tiptap-sheet-strip > .tiptap-page-wrap');
  const dock = document.querySelector('.layout-preview-dock');
  const mainRect = rectOf(main);
  const wrapperRect = rectOf(wrapper);
  const hostRect = rectOf(host);
  const firstSheetRect = rectOf(firstSheet);
  const dockRect = rectOf(dock);
  return {
    previewVisible: Boolean(main && main.classList.contains('is-layout-preview-visible')),
    mainRect,
    wrapperRect,
    hostRect,
    firstSheetRect,
    dockRect,
    hostOverlapsDock: intersects(hostRect, dockRect),
    firstSheetOverlapsDock: intersects(firstSheetRect, dockRect),
    wrapperCanContainSheet: Boolean(wrapperRect && hostRect && wrapperRect.width >= hostRect.width),
    mainScrollWidth: main ? main.scrollWidth : 0,
    mainClientWidth: main ? main.clientWidth : 0,
  };
}).toString();

app.whenReady().then(async () => {
  try {
    const win = await waitForWindow();
    await waitForLoad(win);
    const results = [];
    for (const [width, height] of viewportCases) {
      win.setContentSize(width, height);
      await sleep(500);
      await win.webContents.executeJavaScript(\`
        (() => {
          const toggle = document.querySelector('[data-layout-preview-toggle]');
          if (toggle && toggle.getAttribute('aria-pressed') !== 'true') toggle.click();
        })();
      \`, true);
      await sleep(700);
      const state = await win.webContents.executeJavaScript(\`(\${collectPreviewSpacing})()\`, true);
      results.push({ width, height, state });
    }
    process.stdout.write('LAYOUT_PREVIEW_DOCK_SPACING_RESULT:' + JSON.stringify({
      ok: 1,
      results,
      networkRequests,
      dialogCalls,
    }) + '\\n');
    app.exit(0);
  } catch (error) {
    process.stdout.write('LAYOUT_PREVIEW_DOCK_SPACING_RESULT:' + JSON.stringify({
      ok: 0,
      message: error && error.message ? error.message : String(error),
      networkRequests,
      dialogCalls,
    }) + '\\n');
    app.exit(1);
  }
});
`;
}

function parseHarnessResult(stdout) {
  const line = String(stdout || '')
    .split(/\r?\n/u)
    .find((item) => item.startsWith('LAYOUT_PREVIEW_DOCK_SPACING_RESULT:'));
  assert.ok(line, 'layout preview spacing smoke must emit a result line');
  return JSON.parse(line.slice('LAYOUT_PREVIEW_DOCK_SPACING_RESULT:'.length));
}

const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'layout-preview-dock-spacing-'));
try {
  const childPath = path.join(tempRoot, 'layout-preview-dock-spacing-child.cjs');
  await writeFile(childPath, buildChildSource({ tempRoot }), 'utf8');
  const stdoutChunks = [];
  const stderrChunks = [];
  const child = spawn(electronBinary, [childPath], {
    cwd: rootDir,
    env: {
      ...process.env,
      ELECTRON_ENABLE_SECURITY_WARNINGS: 'false',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (chunk) => stdoutChunks.push(chunk));
  child.stderr.on('data', (chunk) => stderrChunks.push(chunk));
  const exitState = await new Promise((resolve) => {
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      resolve({ code: -1, signal: 'TIMEOUT' });
    }, 12000);
    child.once('exit', (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal });
    });
  });
  const stdout = Buffer.concat(stdoutChunks).toString('utf8');
  const stderr = Buffer.concat(stderrChunks).toString('utf8');
  const payload = parseHarnessResult(stdout);

  assert.equal(exitState.code, 0, stderr);
  assert.equal(payload.ok, 1, JSON.stringify(payload, null, 2));
  assert.equal(payload.networkRequests, 0);
  assert.equal(payload.dialogCalls, 0);
  assert.equal(payload.results.length, viewportCases.length);
  for (const item of payload.results) {
    assert.equal(item.state.previewVisible, true, `${item.width} preview must be visible`);
    assert.equal(item.state.hostOverlapsDock, false, `${item.width} editor host must not overlap preview dock`);
    assert.equal(item.state.firstSheetOverlapsDock, false, `${item.width} visible sheet must not overlap preview dock`);
    assert.equal(item.state.wrapperCanContainSheet, true, `${item.width} editor wrapper must contain the sheet width`);
  }
  process.stdout.write(`LAYOUT_PREVIEW_DOCK_SPACING_SMOKE_OK=${payload.results.length}\n`);
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const TIMEOUT_MS = 10000;
const RESULT_PREFIX = 'LANDSCAPE_PREVIEW_LAYER_TIE_RESULT:';
const SEED_TEXT = 'Landscape preview layer tie proof text.';

const FOCUS_EDITOR_SOURCE = `(() => {
  const editor = document.querySelector('.ProseMirror');
  if (!editor) return { ok: 0, reason: 'PROSEMIRROR_MISSING' };
  editor.focus();
  return { ok: 1, proseMirrorCount: document.querySelectorAll('.ProseMirror').length };
})()`;

const RENDERER_PROBE_SOURCE = `(() => (async () => {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const waitFor = async (predicate, label, timeoutMs = 5000) => {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const value = predicate();
      if (value) return value;
      await sleep(50);
    }
    throw new Error('WAIT_TIMEOUT:' + label);
  };
  const readPressed = (selector) => document.querySelector(selector)?.getAttribute('aria-pressed') || '';
  const getLayoutPreviewPage = () => document.querySelector('.layout-preview__page');
  const rectOf = (element) => {
    if (!element) return { exists: false, width: 0, height: 0 };
    const rect = element.getBoundingClientRect();
    return {
      exists: true,
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    };
  };

  await waitFor(() => document.querySelector('.ProseMirror')?.textContent?.includes(${JSON.stringify(SEED_TEXT)}), 'seed-text');

  const landscapeButton = document.querySelector('[data-preview-orientation-option="landscape"]');
  if (!landscapeButton) throw new Error('LANDSCAPE_BUTTON_MISSING');
  landscapeButton.click();

  await waitFor(
    () => readPressed('[data-preview-orientation-option="landscape"]') === 'true',
    'landscape-pressed',
  );

  const previewToggle = document.querySelector('[data-layout-preview-toggle]');
  if (!previewToggle) throw new Error('PREVIEW_TOGGLE_MISSING');
  if (previewToggle.getAttribute('aria-pressed') !== 'true') {
    previewToggle.click();
  }

  const previewPage = await waitFor(() => getLayoutPreviewPage(), 'layout-preview-page');
  const datasetPageWidthPx = Number(previewPage.dataset.pageWidthPx || 0);
  const datasetPageHeightPx = Number(previewPage.dataset.pageHeightPx || 0);
  const pageRect = rectOf(previewPage);
  const previewDock = document.querySelector('.layout-preview-dock');
  const pagesHost = document.querySelector('.layout-preview__pages');

  return {
    ok: 1,
    previewEnabled: previewToggle.getAttribute('aria-pressed') === 'true',
    previewDockVisible: Boolean(previewDock && previewDock.hidden === false),
    pagesHostPageCount: pagesHost?.dataset?.pageCount || '',
    landscapeControlActivated: readPressed('[data-preview-orientation-option="landscape"]') === 'true',
    measuredElementClass: previewPage.className,
    measuredElementIsLayoutPreviewPage: previewPage.classList.contains('layout-preview__page'),
    measuredElementIsTiptapPage: previewPage.classList.contains('tiptap-page'),
    datasetPageOrientation: previewPage.dataset.pageOrientation || '',
    datasetPageWidthPx,
    datasetPageHeightPx,
    datasetWidthGtHeight: datasetPageWidthPx > datasetPageHeightPx,
    rectWidthGtHeight: pageRect.width > pageRect.height,
    pageRect,
    oneTiptap: document.querySelectorAll('.ProseMirror').length === 1,
    proseMirrorCount: document.querySelectorAll('.ProseMirror').length,
    previewReadOnly: !previewPage.closest('[contenteditable="true"]'),
  };
})())()`;

function createChildSource({ rootDir, tempRoot }) {
  return `\
const fs = require('fs');
const path = require('path');
const { app, BrowserWindow, dialog, session } = require('electron');

const rootDir = ${JSON.stringify(rootDir)};
const tempRoot = ${JSON.stringify(tempRoot)};
const focusEditorSource = ${JSON.stringify(FOCUS_EDITOR_SOURCE)};
const rendererProbeSource = ${JSON.stringify(RENDERER_PROBE_SOURCE)};
const seedText = ${JSON.stringify(SEED_TEXT)};
let networkRequests = 0;
let dialogCalls = 0;

function emit(payload) {
  process.stdout.write(${JSON.stringify(RESULT_PREFIX)} + JSON.stringify(payload) + '\\n');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

for (const dirName of ['appData', 'userData', 'documents']) {
  fs.mkdirSync(path.join(tempRoot, dirName), { recursive: true });
}

for (const methodName of ['showOpenDialog', 'showSaveDialog', 'showMessageBox']) {
  dialog[methodName] = async () => {
    dialogCalls += 1;
    throw new Error('DIALOG_NOT_ALLOWED_IN_PREVIEW_LAYER_TIE');
  };
}

app.setPath('appData', path.join(tempRoot, 'appData'));
app.setPath('userData', path.join(tempRoot, 'userData'));
app.setPath('documents', path.join(tempRoot, 'documents'));
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('force-device-scale-factor', '1');
app.commandLine.appendSwitch('disable-features', 'UseSkiaRenderer');

app.whenReady().then(() => {
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const url = details && typeof details.url === 'string' ? details.url : '';
    const shouldBlock = /^(https?|wss?):/u.test(url);
    if (shouldBlock) networkRequests += 1;
    callback({ cancel: shouldBlock });
  });
});

process.chdir(rootDir);
if (!process.argv.includes('--dev')) process.argv.push('--dev');
require(path.join(rootDir, 'src', 'main.js'));

async function waitForWindow() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) return windows[0];
    await sleep(50);
  }
  throw new Error('WINDOW_NOT_CREATED');
}

async function waitForLoad(win) {
  if (!win.webContents.isLoadingMainFrame()) return true;
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('LOAD_TIMEOUT')), 5000);
    win.webContents.once('did-finish-load', () => {
      clearTimeout(timer);
      resolve();
    });
    win.webContents.once('did-fail-load', (_event, _code, description) => {
      clearTimeout(timer);
      reject(new Error('DID_FAIL_LOAD:' + description));
    });
  });
  return true;
}

app.whenReady().then(async () => {
  try {
    const win = await waitForWindow();
    await waitForLoad(win);
    const focusResult = await win.webContents.executeJavaScript(focusEditorSource, true);
    if (!focusResult || focusResult.ok !== 1) {
      throw new Error('EDITOR_FOCUS_FAILED:' + JSON.stringify(focusResult));
    }
    await win.webContents.insertText(seedText);
    const rendererProbe = await win.webContents.executeJavaScript(rendererProbeSource, true);
    const payload = {
      ok: rendererProbe && rendererProbe.ok === 1 ? 1 : 0,
      appReady: app.isReady(),
      windowCount: BrowserWindow.getAllWindows().length,
      loadComplete: true,
      focusResult,
      rendererProbe,
      networkRequests,
      dialogCalls,
    };
    emit(payload);
    app.exit(payload.ok === 1 ? 0 : 1);
  } catch (error) {
    emit({
      ok: 0,
      message: error && error.message ? error.message : String(error),
      windowCount: BrowserWindow.getAllWindows().length,
      networkRequests,
      dialogCalls,
    });
    app.exit(1);
  }
});
`;
}

function parseRuntimeResult(stdout) {
  const line = String(stdout || '')
    .split(/\r?\n/u)
    .find((item) => item.startsWith(RESULT_PREFIX));
  if (!line) return null;
  return JSON.parse(line.slice(RESULT_PREFIX.length));
}

async function resolveElectronBinary(rootDir) {
  const explicitBinary = process.env.PRODUCTION_APP_RUNTIME_HARNESS_ELECTRON_BIN
    || process.env.ELECTRON_BIN
    || '';
  if (explicitBinary) return explicitBinary;

  const requireFromRoot = createRequire(path.join(rootDir, 'package.json'));
  return requireFromRoot('electron');
}

async function runPreviewLayerTieSmoke() {
  const rootDir = process.cwd();
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'yalken-preview-layer-tie-'));
  const childPath = path.join(tempRoot, 'preview-layer-tie-child.cjs');
  let child = null;
  let timedOut = false;

  try {
    await fs.writeFile(childPath, createChildSource({ rootDir, tempRoot }), 'utf8');
    const electronBinary = await resolveElectronBinary(rootDir);
    const stdoutChunks = [];
    const stderrChunks = [];

    child = spawn(electronBinary, [childPath], {
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
        timedOut = true;
        child.kill('SIGKILL');
      }, TIMEOUT_MS);
      child.once('exit', (code, signal) => {
        clearTimeout(timer);
        resolve({ code, signal });
      });
    });

    return {
      tempRoot,
      timedOut,
      exitCode: exitState.code,
      signal: exitState.signal || '',
      stdout: Buffer.concat(stdoutChunks).toString('utf8'),
      stderr: Buffer.concat(stderrChunks).toString('utf8'),
      result: parseRuntimeResult(Buffer.concat(stdoutChunks).toString('utf8')),
    };
  } finally {
    if (child && !child.killed) child.kill('SIGKILL');
  }
}

let tempRootForCleanup = '';

try {
  const runtime = await runPreviewLayerTieSmoke();
  tempRootForCleanup = runtime.tempRoot;
  const payload = runtime.result || {};
  const rendererProbe = payload.rendererProbe || {};

  assert.equal(runtime.timedOut, false);
  assert.equal(runtime.exitCode, 0, runtime.stderr || runtime.stdout);
  assert.equal(payload.ok, 1);
  assert.equal(payload.appReady, true);
  assert.equal(payload.windowCount, 1);
  assert.equal(payload.loadComplete, true);
  assert.equal(payload.networkRequests, 0);
  assert.equal(payload.dialogCalls, 0);
  assert.equal(rendererProbe.previewEnabled, true);
  assert.equal(rendererProbe.landscapeControlActivated, true);
  assert.equal(rendererProbe.measuredElementIsLayoutPreviewPage, true);
  assert.equal(rendererProbe.measuredElementIsTiptapPage, false);
  assert.equal(rendererProbe.datasetPageOrientation, 'landscape');
  assert.equal(rendererProbe.datasetWidthGtHeight, true);
  assert.equal(rendererProbe.oneTiptap, true);
  assert.equal(rendererProbe.previewReadOnly, true);

  process.stdout.write(`${RESULT_PREFIX}${JSON.stringify({
    ok: 1,
    windowCount: payload.windowCount,
    noNetwork: payload.networkRequests === 0,
    noDialogs: payload.dialogCalls === 0,
    previewEnabled: rendererProbe.previewEnabled,
    landscapeControlActivated: rendererProbe.landscapeControlActivated,
    measuredElementClass: rendererProbe.measuredElementClass,
    datasetPageOrientation: rendererProbe.datasetPageOrientation,
    datasetPageWidthPx: rendererProbe.datasetPageWidthPx,
    datasetPageHeightPx: rendererProbe.datasetPageHeightPx,
    datasetWidthGtHeight: rendererProbe.datasetWidthGtHeight,
    oneTiptap: rendererProbe.oneTiptap,
    previewReadOnly: rendererProbe.previewReadOnly,
  })}\\n`);
  process.stdout.write('LANDSCAPE_PREVIEW_LAYER_TIE_SMOKE_OK=1\\n');
} finally {
  if (tempRootForCleanup) {
    await fs.rm(tempRootForCleanup, { recursive: true, force: true });
    await assert.rejects(
      fs.access(tempRootForCleanup),
      (error) => error && error.code === 'ENOENT',
    );
  }
}

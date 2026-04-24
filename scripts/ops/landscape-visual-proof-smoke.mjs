import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const TIMEOUT_MS = 10000;
const RESULT_PREFIX = 'LANDSCAPE_VISUAL_PROOF_RESULT:';

const RENDERER_PROBE_SOURCE = `(() => (async () => {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const waitFor = async (predicate, label, timeoutMs = 5000) => {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      if (predicate()) return true;
      await sleep(50);
    }
    throw new Error('WAIT_TIMEOUT:' + label);
  };
  const rectOf = (selector) => {
    const element = document.querySelector(selector);
    if (!element) return { exists: false, width: 0, height: 0, left: 0, top: 0 };
    const rect = element.getBoundingClientRect();
    return {
      exists: true,
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      left: Math.round(rect.left),
      top: Math.round(rect.top),
    };
  };
  const getOrientation = () => {
    const landscape = document.querySelector('[data-preview-orientation-option="landscape"]');
    const portrait = document.querySelector('[data-preview-orientation-option="portrait"]');
    if (landscape && landscape.getAttribute('aria-pressed') === 'true') return 'landscape';
    if (portrait && portrait.getAttribute('aria-pressed') === 'true') return 'portrait';
    return '';
  };
  const landscapeButton = document.querySelector('[data-preview-orientation-option="landscape"]');
  if (!landscapeButton) throw new Error('LANDSCAPE_BUTTON_MISSING');
  landscapeButton.click();
  await waitFor(() => {
    const pageRect = rectOf('.tiptap-page');
    return getOrientation() === 'landscape' && pageRect.exists && pageRect.width > pageRect.height;
  }, 'landscape-page-geometry');
  const pageRect = rectOf('.tiptap-page');
  const rightSidebarRect = rectOf('[data-right-sidebar]');
  return {
    ok: 1,
    orientation: getOrientation(),
    pageRect,
    pageWidthGtHeight: pageRect.width > pageRect.height,
    rightSidebarRect,
    rightSidebarVisible: rightSidebarRect.exists && rightSidebarRect.width > 160 && rightSidebarRect.height > 300,
    landscapePressed: document.querySelector('[data-preview-orientation-option="landscape"]')?.getAttribute('aria-pressed') || '',
  };
})())()`;

function createChildSource({ rootDir, tempRoot, artifactRoot, screenshotPath, jsonPath }) {
  return `\
const fs = require('fs');
const path = require('path');
const { app, BrowserWindow, dialog, session } = require('electron');

const rootDir = ${JSON.stringify(rootDir)};
const tempRoot = ${JSON.stringify(tempRoot)};
const artifactRoot = ${JSON.stringify(artifactRoot)};
const screenshotPath = ${JSON.stringify(screenshotPath)};
const jsonPath = ${JSON.stringify(jsonPath)};
const rendererProbeSource = ${JSON.stringify(RENDERER_PROBE_SOURCE)};
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
fs.mkdirSync(artifactRoot, { recursive: true });

for (const methodName of ['showOpenDialog', 'showSaveDialog', 'showMessageBox']) {
  dialog[methodName] = async () => {
    dialogCalls += 1;
    throw new Error('DIALOG_NOT_ALLOWED_IN_VISUAL_PROOF');
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
    const rendererProbe = await win.webContents.executeJavaScript(rendererProbeSource, true);
    await win.webContents.executeJavaScript(
      'new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))',
      true,
    );
    await sleep(200);
    const image = await win.capturePage();
    fs.writeFileSync(screenshotPath, image.toPNG());
    const payload = {
      ok: rendererProbe && rendererProbe.ok === 1 ? 1 : 0,
      appReady: app.isReady(),
      windowCount: BrowserWindow.getAllWindows().length,
      loadComplete: true,
      rendererProbe,
      networkRequests,
      dialogCalls,
      screenshotBasename: path.basename(screenshotPath),
      jsonBasename: path.basename(jsonPath),
    };
    fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2));
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

function parseResult(stdout) {
  const line = String(stdout || '')
    .split(/\r?\n/u)
    .find((item) => item.startsWith(RESULT_PREFIX));
  if (!line) return null;
  return JSON.parse(line.slice(RESULT_PREFIX.length));
}

async function resolveElectronBinary(rootDir) {
  const requireFromRoot = createRequire(path.join(rootDir, 'package.json'));
  return requireFromRoot('electron');
}

async function runVisualProof() {
  const rootDir = process.cwd();
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'yalken-landscape-visual-profile-'));
  const artifactRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'yalken-landscape-visual-artifacts-'));
  const screenshotPath = path.join(artifactRoot, 'landscape-visual-proof.png');
  const jsonPath = path.join(artifactRoot, 'landscape-visual-proof.json');
  const childPath = path.join(tempRoot, 'landscape-visual-proof-child.cjs');
  let child = null;
  let timedOut = false;

  try {
    await fs.writeFile(childPath, createChildSource({
      rootDir,
      tempRoot,
      artifactRoot,
      screenshotPath,
      jsonPath,
    }), 'utf8');

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

    const stdout = Buffer.concat(stdoutChunks).toString('utf8');
    const stderr = Buffer.concat(stderrChunks).toString('utf8');

    return {
      tempRoot,
      artifactRoot,
      screenshotPath,
      jsonPath,
      timedOut,
      exitCode: exitState.code,
      signal: exitState.signal || '',
      stdout,
      stderr,
      result: parseResult(stdout),
    };
  } finally {
    if (child && !child.killed) child.kill('SIGKILL');
  }
}

let tempRootForCleanup = '';

try {
  const runtime = await runVisualProof();
  tempRootForCleanup = runtime.tempRoot;
  const payload = runtime.result || {};
  const probe = payload.rendererProbe || {};
  const screenshotStats = await fs.stat(runtime.screenshotPath);
  const jsonStats = await fs.stat(runtime.jsonPath);

  assert.equal(runtime.timedOut, false);
  assert.equal(runtime.exitCode, 0, runtime.stderr || runtime.stdout);
  assert.equal(payload.ok, 1);
  assert.equal(payload.appReady, true);
  assert.equal(payload.windowCount, 1);
  assert.equal(payload.loadComplete, true);
  assert.equal(payload.networkRequests, 0);
  assert.equal(payload.dialogCalls, 0);
  assert.equal(probe.orientation, 'landscape');
  assert.equal(probe.landscapePressed, 'true');
  assert.equal(probe.pageWidthGtHeight, true);
  assert.equal(probe.rightSidebarVisible, true);
  assert.equal(screenshotStats.size > 0, true);
  assert.equal(jsonStats.size > 0, true);

  process.stdout.write([
    'LANDSCAPE_VISUAL_PROOF_OK=1',
    `LANDSCAPE_VISUAL_PROOF_JSON=${path.basename(runtime.jsonPath)}`,
    `LANDSCAPE_VISUAL_PROOF_SCREENSHOT=${path.basename(runtime.screenshotPath)}`,
  ].join('\\n') + '\\n');
} finally {
  if (tempRootForCleanup) {
    await fs.rm(tempRootForCleanup, { recursive: true, force: true });
    await assert.rejects(
      fs.access(tempRootForCleanup),
      (error) => error && error.code === 'ENOENT',
    );
  }
}

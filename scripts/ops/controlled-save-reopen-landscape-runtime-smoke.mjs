import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const TIMEOUT_MS = 15000;
const RUNTIME_RESULT_PREFIX = 'CONTROLLED_SAVE_REOPEN_LANDSCAPE_RUNTIME_RESULT:';

const RENDERER_PROBE_SOURCE = `(() => (async () => {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const getOrientation = () => {
    const landscape = document.querySelector('[data-preview-orientation-option="landscape"]');
    const portrait = document.querySelector('[data-preview-orientation-option="portrait"]');
    if (landscape && landscape.getAttribute('aria-pressed') === 'true') return 'landscape';
    if (portrait && portrait.getAttribute('aria-pressed') === 'true') return 'portrait';
    return '';
  };
  const getPageRect = () => {
    const page = document.querySelector('.tiptap-page');
    if (!page) return { width: 0, height: 0, widthGtHeight: false };
    const rect = page.getBoundingClientRect();
    const width = Math.round(rect.width);
    const height = Math.round(rect.height);
    return { width, height, widthGtHeight: width > height };
  };
  const collect = (label) => ({
    label,
    orientation: getOrientation(),
    pageRect: getPageRect(),
    landscapePressed: document.querySelector('[data-preview-orientation-option="landscape"]')?.getAttribute('aria-pressed') || '',
    portraitPressed: document.querySelector('[data-preview-orientation-option="portrait"]')?.getAttribute('aria-pressed') || '',
  });
  const waitFor = async (predicate, label, timeoutMs = 5000) => {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      if (predicate()) return true;
      await sleep(50);
    }
    throw new Error('WAIT_TIMEOUT:' + label);
  };

  if (!window.electronAPI) {
    throw new Error('ELECTRON_API_MISSING');
  }

  const landscapeButton = document.querySelector('[data-preview-orientation-option="landscape"]');
  const portraitButton = document.querySelector('[data-preview-orientation-option="portrait"]');
  if (!landscapeButton || !portraitButton) {
    throw new Error('ORIENTATION_BUTTONS_MISSING');
  }

  landscapeButton.click();
  await waitFor(() => getOrientation() === 'landscape' && getPageRect().widthGtHeight, 'landscape-before-save');
  const beforeSave = collect('beforeSave');

  const saveResult = await window.electronAPI.fileSave({ intent: 'save' });
  if (!saveResult || saveResult.ok !== true) {
    return { ok: 0, failReason: 'SAVE_FAILED', saveResult, beforeSave };
  }

  portraitButton.click();
  await waitFor(() => getOrientation() === 'portrait' && !getPageRect().widthGtHeight, 'portrait-reset');
  const afterPortraitReset = collect('afterPortraitReset');

  const openResult = await window.electronAPI.fileOpen({ intent: 'open' });
  if (!openResult || openResult.ok !== true) {
    return { ok: 0, failReason: 'OPEN_FAILED', saveResult, openResult, beforeSave, afterPortraitReset };
  }

  await waitFor(() => getOrientation() === 'landscape' && getPageRect().widthGtHeight, 'landscape-after-reopen');
  const afterReopen = collect('afterReopen');

  return {
    ok: 1,
    saveResult,
    openResult,
    beforeSave,
    afterPortraitReset,
    afterReopen,
  };
})())()`;

function createChildSource({ rootDir, tempRoot, savePath }) {
  return `\
const fs = require('fs');
const path = require('path');
const { app, BrowserWindow, dialog, session } = require('electron');

const rootDir = ${JSON.stringify(rootDir)};
const tempRoot = ${JSON.stringify(tempRoot)};
const savePath = ${JSON.stringify(savePath)};
const rendererProbeSource = ${JSON.stringify(RENDERER_PROBE_SOURCE)};
let networkRequests = 0;
const dialogCalls = [];

function emitResult(payload) {
  process.stdout.write(${JSON.stringify(RUNTIME_RESULT_PREFIX)} + JSON.stringify(payload) + '\\n');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

for (const dirName of ['appData', 'userData', 'documents']) {
  fs.mkdirSync(path.join(tempRoot, dirName), { recursive: true });
}
fs.mkdirSync(path.dirname(savePath), { recursive: true });

dialog.showSaveDialog = async () => {
  dialogCalls.push('showSaveDialog');
  return { canceled: false, filePath: savePath };
};
dialog.showOpenDialog = async () => {
  dialogCalls.push('showOpenDialog');
  return { canceled: false, filePaths: [savePath] };
};
dialog.showMessageBox = async () => {
  dialogCalls.push('showMessageBox');
  return { response: 0 };
};

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
    const manifestPath = path.join(path.dirname(path.dirname(savePath)), 'project.craftsman.json');
    const manifest = fs.existsSync(manifestPath)
      ? JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
      : null;
    emitResult({
      ok: rendererProbe && rendererProbe.ok === 1 ? 1 : 0,
      appReady: app.isReady(),
      windowCount: BrowserWindow.getAllWindows().length,
      loadComplete: true,
      savePath,
      savePathExists: fs.existsSync(savePath),
      manifestPath,
      manifestExists: fs.existsSync(manifestPath),
      manifestBookProfile: manifest && manifest.bookProfile ? manifest.bookProfile : null,
      rendererProbe,
      networkRequests,
      dialogCalls,
    });
    app.exit(rendererProbe && rendererProbe.ok === 1 ? 0 : 1);
  } catch (error) {
    emitResult({
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
    .find((item) => item.startsWith(RUNTIME_RESULT_PREFIX));
  if (!line) return null;
  return JSON.parse(line.slice(RUNTIME_RESULT_PREFIX.length));
}

async function resolveElectronBinary(rootDir) {
  const requireFromRoot = createRequire(path.join(rootDir, 'package.json'));
  return requireFromRoot('electron');
}

async function runControlledSmoke() {
  const rootDir = process.cwd();
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'yalken-controlled-save-reopen-'));
  const savePath = path.join(tempRoot, 'documents', 'craftsman', 'Роман', 'roman', 'chapter-1.txt');
  const childPath = path.join(tempRoot, 'controlled-save-reopen-child.cjs');
  let child = null;
  let timedOut = false;

  try {
    await fs.writeFile(childPath, createChildSource({ rootDir, tempRoot, savePath }), 'utf8');
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
    const result = parseRuntimeResult(stdout);

    return {
      tempRoot,
      savePath,
      timedOut,
      exitCode: exitState.code,
      signal: exitState.signal || '',
      stdout,
      stderr,
      result,
    };
  } finally {
    if (child && !child.killed) child.kill('SIGKILL');
  }
}

let tempRootForCleanup = '';

try {
  const runtime = await runControlledSmoke();
  tempRootForCleanup = runtime.tempRoot;
  const payload = runtime.result || {};
  const rendererProbe = payload.rendererProbe || {};
  const afterReopen = rendererProbe.afterReopen || {};
  const afterReopenRect = afterReopen.pageRect || {};
  const manifestBookProfile = payload.manifestBookProfile || {};

  assert.equal(runtime.timedOut, false);
  assert.equal(runtime.exitCode, 0, runtime.stderr || runtime.stdout);
  assert.equal(payload.ok, 1);
  assert.equal(payload.appReady, true);
  assert.equal(payload.windowCount, 1);
  assert.equal(payload.loadComplete, true);
  assert.equal(payload.networkRequests, 0);
  assert.deepEqual(payload.dialogCalls, ['showSaveDialog', 'showOpenDialog']);
  assert.equal(payload.savePathExists, true);
  assert.equal(payload.manifestExists, true);
  assert.equal(manifestBookProfile.orientation, 'landscape');
  assert.equal(rendererProbe.ok, 1);
  assert.equal(rendererProbe.beforeSave.orientation, 'landscape');
  assert.equal(rendererProbe.beforeSave.pageRect.widthGtHeight, true);
  assert.equal(rendererProbe.afterPortraitReset.orientation, 'portrait');
  assert.equal(rendererProbe.afterPortraitReset.pageRect.widthGtHeight, false);
  assert.equal(afterReopen.orientation, 'landscape');
  assert.equal(afterReopenRect.widthGtHeight, true);

  process.stdout.write('CONTROLLED_SAVE_REOPEN_LANDSCAPE_RUNTIME_SMOKE_OK=1\\n');
} finally {
  if (tempRootForCleanup) {
    await fs.rm(tempRootForCleanup, { recursive: true, force: true });
    await assert.rejects(
      fs.access(tempRootForCleanup),
      (error) => error && error.code === 'ENOENT',
    );
  }
}

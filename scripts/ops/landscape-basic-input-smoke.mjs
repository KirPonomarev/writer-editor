import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const TIMEOUT_MS = 10000;
const CHILD_PREFIX = 'LANDSCAPE_BASIC_INPUT_CHILD:';
const ENVELOPE_PREFIX = 'LANDSCAPE_BASIC_INPUT_ENVELOPE:';
const TYPED_ASCII = 'Z';

const PREPARE_INPUT_SOURCE = `(() => (async () => {
  const metrics = {};
  let stage = 'start';
  const fail = (errorCode, errorMessage) => ({
    ok: 0,
    stage,
    metrics,
    failure: { errorCode, errorMessage, stage },
  });
  try {
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
    const rectOf = (element) => {
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
    const readPressed = (selector) => document.querySelector(selector)?.getAttribute('aria-pressed') || '';

    stage = 'landscape_click';
    const landscapeButton = document.querySelector('[data-preview-orientation-option="landscape"]');
    if (!landscapeButton) return fail('LANDSCAPE_BUTTON_MISSING', 'Landscape orientation control was not found.');
    landscapeButton.click();

    stage = 'landscape_rect';
    const page = await waitFor(() => {
      const candidate = document.querySelector('.tiptap-page');
      const rect = rectOf(candidate);
      return candidate && readPressed('[data-preview-orientation-option="landscape"]') === 'true' && rect.width > rect.height
        ? candidate
        : null;
    }, 'landscape-tiptap-page');
    const pageRect = rectOf(page);
    metrics.landscapeControlActivated = readPressed('[data-preview-orientation-option="landscape"]') === 'true';
    metrics.tiptapPageRect = pageRect;
    metrics.tiptapPageWidthGtHeight = pageRect.width > pageRect.height;

    stage = 'target_selection';
    const proseMirrors = Array.from(document.querySelectorAll('.ProseMirror'));
    metrics.proseMirrorCount = proseMirrors.length;
    if (proseMirrors.length !== 1) return fail('PROSEMIRROR_COUNT_NOT_ONE', 'Expected exactly one ProseMirror instance.');

    const target = proseMirrors[0];
    const targetRect = rectOf(target);
    metrics.targetRect = targetRect;
    metrics.targetVisible = targetRect.width > 0 && targetRect.height > 0;
    metrics.targetInsideTiptapPage = page.contains(target);
    if (!metrics.targetVisible) return fail('TARGET_NOT_VISIBLE', 'ProseMirror target has no visible rect.');
    if (!metrics.targetInsideTiptapPage) return fail('TARGET_OUTSIDE_TIPTAP_PAGE', 'ProseMirror target is not inside .tiptap-page.');

    stage = 'focus';
    const clickX = Math.max(targetRect.left + 8, targetRect.left + Math.min(24, Math.max(1, targetRect.width - 1)));
    const clickY = Math.max(targetRect.top + 8, targetRect.top + Math.min(24, Math.max(1, targetRect.height - 1)));
    for (const type of ['mousedown', 'mouseup', 'click']) {
      target.dispatchEvent(new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: clickX,
        clientY: clickY,
      }));
    }
    target.focus();
    metrics.activeElementInsideProseMirror = target.contains(document.activeElement);
    metrics.textBefore = target.textContent || '';
    metrics.textBeforeLength = metrics.textBefore.length;

    return {
      ok: 1,
      stage,
      metrics,
      failure: null,
    };
  } catch (error) {
    return fail('RENDERER_PREPARE_EXCEPTION', error && error.message ? error.message : String(error));
  }
})())()`;

const TEXT_DELTA_SOURCE = `((typedAscii) => {
  const metrics = {};
  try {
    const proseMirrors = Array.from(document.querySelectorAll('.ProseMirror'));
    const target = proseMirrors[0] || null;
    const textAfter = target ? target.textContent || '' : '';
    metrics.proseMirrorCountAfter = proseMirrors.length;
    metrics.textAfter = textAfter;
    metrics.textAfterLength = textAfter.length;
    metrics.textAfterContainsTypedAscii = textAfter.includes(typedAscii);
    return {
      ok: target ? 1 : 0,
      stage: 'input_delta',
      metrics,
      failure: target ? null : {
        errorCode: 'PROSEMIRROR_MISSING_AFTER_INPUT',
        errorMessage: 'ProseMirror target missing after insertText.',
        stage: 'input_delta',
      },
    };
  } catch (error) {
    return {
      ok: 0,
      stage: 'input_delta',
      metrics,
      failure: {
        errorCode: 'TEXT_DELTA_EXCEPTION',
        errorMessage: error && error.message ? error.message : String(error),
        stage: 'input_delta',
      },
    };
  }
})(${JSON.stringify(TYPED_ASCII)})`;

function createChildSource({ rootDir, tempRoot }) {
  return `\
const fs = require('fs');
const path = require('path');
const { app, BrowserWindow, dialog, session } = require('electron');

const rootDir = ${JSON.stringify(rootDir)};
const tempRoot = ${JSON.stringify(tempRoot)};
const prepareInputSource = ${JSON.stringify(PREPARE_INPUT_SOURCE)};
const textDeltaSource = ${JSON.stringify(TEXT_DELTA_SOURCE)};
const typedAscii = ${JSON.stringify(TYPED_ASCII)};
let networkRequests = 0;
let dialogCalls = 0;

function emit(payload) {
  process.stdout.write(${JSON.stringify(CHILD_PREFIX)} + JSON.stringify(payload) + '\\n');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function basePayload(stage, metrics = {}, failure = null) {
  return {
    ok: failure ? 0 : 1,
    stage,
    metrics: {
      ...metrics,
      networkRequests,
      dialogCalls,
      windowCount: BrowserWindow.getAllWindows().length,
    },
    failure,
  };
}

for (const dirName of ['appData', 'userData', 'documents']) {
  fs.mkdirSync(path.join(tempRoot, dirName), { recursive: true });
}

for (const methodName of ['showOpenDialog', 'showSaveDialog', 'showMessageBox']) {
  dialog[methodName] = async () => {
    dialogCalls += 1;
    throw new Error('DIALOG_NOT_ALLOWED_IN_BASIC_INPUT_SMOKE');
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
    const prepare = await win.webContents.executeJavaScript(prepareInputSource, true);
    if (!prepare || prepare.ok !== 1) {
      const failure = prepare && prepare.failure ? prepare.failure : {
        errorCode: 'PREPARE_INPUT_FAILED',
        errorMessage: 'Renderer did not prepare input target.',
        stage: prepare && prepare.stage ? prepare.stage : 'prepare_input',
      };
      emit(basePayload(failure.stage, prepare && prepare.metrics ? prepare.metrics : {}, failure));
      app.exit(1);
      return;
    }

    await win.webContents.insertText(typedAscii);
    const textDelta = await win.webContents.executeJavaScript(textDeltaSource, true);
    const metrics = {
      ...prepare.metrics,
      ...(textDelta && textDelta.metrics ? textDelta.metrics : {}),
      typedAscii,
    };
    metrics.textChanged = metrics.textAfter !== metrics.textBefore;
    const inputFailure = !textDelta || textDelta.ok !== 1
      ? (textDelta && textDelta.failure ? textDelta.failure : {
          errorCode: 'TEXT_DELTA_FAILED',
          errorMessage: 'Text delta probe did not return ok.',
          stage: 'input_delta',
        })
      : (!metrics.textChanged ? {
          errorCode: 'TEXT_NOT_CHANGED',
          errorMessage: 'ProseMirror text did not change after insertText.',
          stage: 'input_delta',
        } : (!metrics.textAfterContainsTypedAscii ? {
          errorCode: 'TYPED_ASCII_NOT_PRESENT',
          errorMessage: 'Typed ASCII character missing from ProseMirror text.',
          stage: 'input_delta',
        } : null));
    if (inputFailure) {
      emit(basePayload(inputFailure.stage, metrics, inputFailure));
      app.exit(1);
      return;
    }

    emit(basePayload('complete', metrics, null));
    app.exit(0);
  } catch (error) {
    emit(basePayload('child_exception', {}, {
      errorCode: 'CHILD_EXCEPTION',
      errorMessage: error && error.message ? error.message : String(error),
      stage: 'child_exception',
    }));
    app.exit(1);
  }
});
`;
}

function parseChildPayload(stdout) {
  const lines = String(stdout || '').split(/\r?\n/u);
  const childLine = lines.reverse().find((item) => item.startsWith(CHILD_PREFIX));
  if (!childLine) return null;
  return JSON.parse(childLine.slice(CHILD_PREFIX.length));
}

function stderrTail(stderr) {
  const value = String(stderr || '').trim();
  if (!value) return '';
  return value.slice(-1600);
}

function makeEnvelope({
  status,
  claimStatus,
  stage,
  metrics = {},
  failure = null,
  stderr = '',
  childPayloadPresent = false,
}) {
  return {
    status,
    claimStatus,
    stage,
    metrics,
    failure,
    stderrTail: stderrTail(stderr),
    childPayloadPresent,
  };
}

function emitEnvelope(envelope) {
  process.stdout.write(`${ENVELOPE_PREFIX}${JSON.stringify(envelope)}\n`);
}

async function resolveElectronBinary(rootDir) {
  const explicitBinary = process.env.PRODUCTION_APP_RUNTIME_HARNESS_ELECTRON_BIN
    || process.env.ELECTRON_BIN
    || '';
  if (explicitBinary) return explicitBinary;

  const requireFromRoot = createRequire(path.join(rootDir, 'package.json'));
  return requireFromRoot('electron');
}

async function runBasicInputSmoke() {
  const rootDir = process.cwd();
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'yalken-basic-input-smoke-'));
  const childPath = path.join(tempRoot, 'basic-input-smoke-child.cjs');
  let child = null;
  let timedOut = false;
  let tempCleanup = false;
  let result = null;

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

    const stdout = Buffer.concat(stdoutChunks).toString('utf8');
    const stderr = Buffer.concat(stderrChunks).toString('utf8');
    result = {
      tempRoot,
      timedOut,
      exitCode: exitState.code,
      signal: exitState.signal || '',
      stdout,
      stderr,
      childPayload: parseChildPayload(stdout),
      tempCleanup,
    };
  } finally {
    if (child && !child.killed) child.kill('SIGKILL');
    await fs.rm(tempRoot, { recursive: true, force: true });
    try {
      await fs.access(tempRoot);
    } catch (error) {
      if (error && error.code === 'ENOENT') tempCleanup = true;
    }
  }

  return {
    ...result,
    tempCleanup,
  };
}

const runtime = await runBasicInputSmoke();
const childPayload = runtime.childPayload;
const childPayloadPresent = Boolean(childPayload);

if (!childPayloadPresent) {
  emitEnvelope(makeEnvelope({
    status: 'harness_failure',
    claimStatus: 'STOP_NOT_DONE',
    stage: runtime.timedOut ? 'timeout' : 'no_child_payload',
    metrics: {
      timedOut: runtime.timedOut,
      exitCode: runtime.exitCode,
      signal: runtime.signal,
      tempCleanup: runtime.tempCleanup,
    },
    failure: {
      errorCode: runtime.timedOut ? 'RUNTIME_TIMEOUT_NO_CHILD_PAYLOAD' : 'NO_CHILD_PAYLOAD',
      errorMessage: 'Runtime child did not emit a structured payload.',
      stage: runtime.timedOut ? 'timeout' : 'no_child_payload',
    },
    stderr: runtime.stderr,
    childPayloadPresent,
  }));
  process.exit(1);
}

const childMetrics = childPayload.metrics || {};
const commonMetrics = {
  ...childMetrics,
  timedOut: runtime.timedOut,
  exitCode: runtime.exitCode,
  signal: runtime.signal,
  tempCleanup: runtime.tempCleanup,
};

if (runtime.timedOut) {
  emitEnvelope(makeEnvelope({
    status: 'harness_failure',
    claimStatus: 'STOP_NOT_DONE',
    stage: 'timeout',
    metrics: commonMetrics,
    failure: {
      errorCode: 'RUNTIME_TIMEOUT',
      errorMessage: 'Runtime child exceeded timeout.',
      stage: 'timeout',
    },
    stderr: runtime.stderr,
    childPayloadPresent,
  }));
  process.exit(1);
}

if (runtime.exitCode === 0 && childPayload.ok === 1) {
  emitEnvelope(makeEnvelope({
    status: 'proof_pass',
    claimStatus: 'CLAIM_PROVEN',
    stage: childPayload.stage || 'complete',
    metrics: commonMetrics,
    failure: null,
    stderr: runtime.stderr,
    childPayloadPresent,
  }));
  process.stdout.write('LANDSCAPE_BASIC_INPUT_SMOKE_OK=1\n');
  process.exit(0);
}

emitEnvelope(makeEnvelope({
  status: 'diagnostic_failure',
  claimStatus: 'DIAGNOSTIC_ONLY_NO_CLAIM',
  stage: childPayload.stage || childPayload.failure?.stage || 'runtime_failure',
  metrics: commonMetrics,
  failure: childPayload.failure || {
    errorCode: 'RUNTIME_EXIT_NONZERO',
    errorMessage: `Runtime child exited with code ${runtime.exitCode}.`,
    stage: childPayload.stage || 'runtime_failure',
  },
  stderr: runtime.stderr,
  childPayloadPresent,
}));
process.exit(0);

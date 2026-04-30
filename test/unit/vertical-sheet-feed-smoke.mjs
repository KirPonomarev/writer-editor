import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const rootDir = path.resolve(new URL('../..', import.meta.url).pathname);
const requireFromHere = createRequire(import.meta.url);
const electronBinary = requireFromHere('electron');
const outputDir = process.env.VERTICAL_SHEET_FEED_OUT_DIR
  ? path.resolve(process.env.VERTICAL_SHEET_FEED_OUT_DIR)
  : await mkdtemp(path.join(os.tmpdir(), 'vertical-sheet-feed-'));

async function read(relativePath) {
  return readFile(path.join(rootDir, relativePath), 'utf8');
}

async function loadModule(relativePath) {
  return import(pathToFileURL(path.join(rootDir, relativePath)).href);
}

const editorText = await read('src/renderer/editor.js');
const cssText = await read('src/renderer/styles.css');

assert.equal(editorText.includes("editor.dataset.centralSheetFlow = 'vertical';"), true);
assert.equal(editorText.includes("editor.dataset.centralSheetFlow = 'horizontal';"), false);
assert.equal(cssText.includes('column-width: var(--central-sheet-content-width-px);'), false);
assert.equal(cssText.includes('column-fill: auto;'), false);
assert.equal(cssText.includes('shape-outside: repeating-linear-gradient('), true);
assert.equal(cssText.includes('flex-direction: column;'), true);

const { normalizeBookProfile } = await loadModule('src/core/bookProfile.mjs');
const { resolvePageLayoutMetrics } = await loadModule('src/core/pageLayoutMetrics.mjs');

for (const formatId of ['A4', 'A5', 'LETTER']) {
  for (const orientation of ['portrait', 'landscape']) {
    const profileResult = normalizeBookProfile({ formatId, orientation });
    assert.equal(profileResult.ok, true, `${formatId} ${orientation} profile normalizes`);
    const metricsResult = resolvePageLayoutMetrics(profileResult.value);
    assert.equal(metricsResult.ok, true, `${formatId} ${orientation} metrics resolve`);
    const metrics = metricsResult.value;
    assert.equal(metrics.formatId, formatId);
    assert.equal(metrics.orientation, orientation);
    assert.equal(metrics.pageWidthPx > 0, true);
    assert.equal(metrics.pageHeightPx > 0, true);
    assert.equal(metrics.contentWidthPx > 0, true);
    assert.equal(metrics.contentHeightPx > 0, true);
    assert.equal(metrics.contentWidthPx < metrics.pageWidthPx, true);
    assert.equal(metrics.contentHeightPx < metrics.pageHeightPx, true);
    assert.equal(
      orientation === 'landscape'
        ? metrics.pageWidthPx > metrics.pageHeightPx
        : metrics.pageHeightPx > metrics.pageWidthPx,
      true,
    );
  }
}

function buildHelperSource() {
  return `
const path = require('node:path');
const fs = require('node:fs/promises');
const { app, BrowserWindow, dialog, session } = require('electron');

const rootDir = ${JSON.stringify(rootDir)};
const outputDir = ${JSON.stringify(outputDir)};
const mainEntrypoint = path.join(rootDir, 'src', 'main' + '.js');
let networkRequests = 0;
let dialogCalls = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildPlainText(paragraphCount) {
  const paragraph = 'Vertical sheet bridge proof paragraph. This text must feed the derived page map adapter from one TipTap editor.';
  return Array.from({ length: paragraphCount }, (_, index) => (
    paragraph + ' ' + String(index + 1) + '. ' + paragraph + ' ' + paragraph
  )).join('\\\\n\\\\n');
}

async function waitForWindow() {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) return win;
    await sleep(100);
  }
  throw new Error('WINDOW_NOT_CREATED');
}

async function waitForLoad(win) {
  if (!win.webContents.isLoadingMainFrame()) return;
  await new Promise((resolve) => win.webContents.once('did-finish-load', resolve));
}

async function setEditorPayload(win, paragraphCount) {
  win.webContents.send('editor:set-text', {
    content: buildPlainText(paragraphCount),
    title: 'vertical-sheet-feed-smoke',
    path: '',
    kind: 'chapter-file',
    metaEnabled: true,
    projectId: 'vertical-sheet-feed-smoke',
    bookProfile: null,
  });
}

async function collectState(win, label) {
  return win.webContents.executeJavaScript(\`(() => {
    const host = document.querySelector('#editor.tiptap-host');
    const strip = host ? host.querySelector('.tiptap-sheet-strip') : null;
    const prose = host ? host.querySelector('.ProseMirror') : null;
    const pageWraps = strip ? [...strip.querySelectorAll(':scope > .tiptap-page-wrap')] : [];
    const bridgePageNumbers = host && host.dataset.derivedPageMapRuntimeBridgeRenderedWindowPageNumbers
      ? host.dataset.derivedPageMapRuntimeBridgeRenderedWindowPageNumbers.split(',').filter(Boolean).map((value) => Number(value))
      : [];
    return {
      label: \${JSON.stringify(label)},
      bridgeActive: host ? host.dataset.derivedPageMapRuntimeBridgeActive || null : null,
      bridgeSource: host ? host.dataset.derivedPageMapRuntimeBridgeSource || null : null,
      sourceContractHash: host ? host.dataset.derivedPageMapRuntimeBridgeSourceContractHash || null : null,
      editorTextHash: host ? host.dataset.derivedPageMapRuntimeBridgeEditorTextHash || null : null,
      renderedWindowPageNumbers: bridgePageNumbers,
      textTruth: host ? host.dataset.derivedPageMapRuntimeBridgeTextTruth || null : null,
      storageTruth: host ? host.dataset.derivedPageMapRuntimeBridgeStorageTruth || null : null,
      exportTruth: host ? host.dataset.derivedPageMapRuntimeBridgeExportTruth || null : null,
      pageMapProductRuntimeBinding: host ? host.dataset.derivedPageMapRuntimeBridgePageMapProductRuntimeBinding || null : null,
      refreshSerial: host ? Number(host.dataset.derivedPageMapRuntimeBridgeRefreshSerial || 0) : 0,
      centralSheetFlow: host ? host.dataset.centralSheetFlow || null : null,
      centralSheetWindowingEnabled: host ? host.dataset.centralSheetWindowingEnabled || null : null,
      centralSheetRenderedPageCount: host ? host.dataset.centralSheetRenderedPageCount || null : null,
      centralSheetTotalPageCount: host ? host.dataset.centralSheetTotalPageCount || null : null,
      visibleSheetCount: pageWraps.length,
      proseMirrorCount: host ? host.querySelectorAll('.ProseMirror').length : 0,
      tiptapEditorCount: host ? host.querySelectorAll('.tiptap-editor').length : 0,
      prosePageTruthCount: prose ? prose.querySelectorAll('[data-page-index], [data-page-number], [data-page-id]').length : 0,
      domDriftTextPresent: Boolean(host && host.textContent && host.textContent.includes('VIEWPORT_DOM_DRIFT_NEGATIVE')),
    };
  })()\`, true);
}

async function waitForBridge(win, label, options = {}) {
  let lastState = null;
  const minimumRefreshSerial = Number(options.minimumRefreshSerial) || 0;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const state = await collectState(win, label + '-' + String(attempt));
    lastState = state;
    if (
      state.bridgeActive === 'true'
      && state.bridgeSource === 'tiptapPlainTextProvider'
      && state.sourceContractHash
      && state.editorTextHash
      && state.renderedWindowPageNumbers.length > 0
      && state.refreshSerial > minimumRefreshSerial
      && state.centralSheetFlow === 'vertical'
      && state.centralSheetWindowingEnabled === 'true'
    ) {
      return state;
    }
    await sleep(100);
  }
  throw new Error('BRIDGE_NOT_ACTIVE ' + JSON.stringify(lastState));
}

async function mutateViewportDomOutsideTextTruth(win) {
  return win.webContents.executeJavaScript(\`(() => {
    const host = document.querySelector('#editor.tiptap-host');
    const strip = host ? host.querySelector('.tiptap-sheet-strip') : null;
    const canvas = document.querySelector('.main-content--editor');
    if (!host || !strip) {
      return { ok: false, reason: 'SHELL_MISSING' };
    }
    const marker = document.createElement('span');
    marker.className = 'bridge-dom-drift-negative';
    marker.textContent = 'VIEWPORT_DOM_DRIFT_NEGATIVE';
    strip.appendChild(marker);
    if (canvas) {
      canvas.scrollTop = Math.max(0, canvas.scrollTop + 1);
      canvas.dispatchEvent(new Event('scroll', { bubbles: true }));
    }
    return {
      ok: true,
      domDriftTextPresent: host.textContent.includes('VIEWPORT_DOM_DRIFT_NEGATIVE'),
    };
  })()\`, true);
}

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('force-device-scale-factor', '1');
app.commandLine.appendSwitch('high-dpi-support', '1');
app.setPath('appData', path.join(outputDir, 'app-data'));
app.setPath('userData', path.join(outputDir, 'app-data', 'craftsman'));
for (const method of ['showOpenDialog', 'showSaveDialog', 'showMessageBox']) {
  dialog[method] = async () => {
    dialogCalls += 1;
    return { canceled: true };
  };
}

app.once('ready', () => {
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    if (/^(https?|wss?):/u.test(String(details.url || ''))) {
      networkRequests += 1;
    }
    callback({ cancel: false });
  });
});

process.chdir(rootDir);
if (!process.argv.includes('--dev')) process.argv.push('--dev');
require(mainEntrypoint);

app.whenReady().then(async () => {
  try {
    await fs.mkdir(outputDir, { recursive: true });
    const win = await waitForWindow();
    await waitForLoad(win);
    win.setContentSize(1600, 1000);
    await sleep(1200);
    await setEditorPayload(win, 22);
    const beforeDomDrift = await waitForBridge(win, 'before-dom-drift');
    const domDrift = await mutateViewportDomOutsideTextTruth(win);
    await sleep(400);
    const afterDomDrift = await waitForBridge(win, 'after-dom-drift', {
      minimumRefreshSerial: beforeDomDrift.refreshSerial,
    });
    const payload = {
      ok: true,
      beforeDomDrift,
      domDrift,
      afterDomDrift,
      networkRequests,
      dialogCalls,
    };
    await fs.writeFile(path.join(outputDir, 'result.json'), JSON.stringify(payload, null, 2));
    process.stdout.write('VERTICAL_SHEET_FEED_SMOKE_RESULT:' + JSON.stringify(payload) + '\\\\n');
    app.exit(0);
  } catch (error) {
    const payload = { ok: false, error: error && error.stack ? error.stack : String(error), networkRequests, dialogCalls };
    await fs.writeFile(path.join(outputDir, 'result.json'), JSON.stringify(payload, null, 2));
    process.stdout.write('VERTICAL_SHEET_FEED_SMOKE_RESULT:' + JSON.stringify(payload) + '\\\\n');
    app.exit(1);
  }
});
`;
}

const helperPath = path.join(outputDir, 'vertical-sheet-feed-helper.cjs');
await mkdir(outputDir, { recursive: true });
await writeFile(helperPath, buildHelperSource(), 'utf8');

const child = spawn(electronBinary, [helperPath], {
  cwd: rootDir,
  stdio: ['ignore', 'pipe', 'pipe'],
  env: {
    ...process.env,
    ELECTRON_ENABLE_SECURITY_WARNINGS: 'false',
  },
});

let stdout = '';
let stderr = '';
child.stdout.on('data', (chunk) => { stdout += String(chunk); });
child.stderr.on('data', (chunk) => { stderr += String(chunk); });

const exitCode = await new Promise((resolve) => {
  const timer = setTimeout(() => {
    child.kill('SIGKILL');
    resolve(124);
  }, 90000);
  child.on('exit', (code) => {
    clearTimeout(timer);
    resolve(typeof code === 'number' ? code : 1);
  });
});

const rawResult = await readFile(path.join(outputDir, 'result.json'), 'utf8');
const result = JSON.parse(rawResult);

assert.equal(exitCode, 0, `electron helper failed with ${exitCode}\n${stdout}\n${stderr}`);
assert.equal(result.ok, true);
assert.equal(result.networkRequests, 0);
assert.equal(result.dialogCalls, 0);
assert.equal(result.beforeDomDrift.bridgeActive, 'true');
assert.equal(result.beforeDomDrift.bridgeSource, 'tiptapPlainTextProvider');
assert.equal(typeof result.beforeDomDrift.sourceContractHash, 'string');
assert.equal(result.beforeDomDrift.sourceContractHash.length > 0, true);
assert.equal(typeof result.beforeDomDrift.editorTextHash, 'string');
assert.equal(result.beforeDomDrift.editorTextHash.length > 0, true);
assert.equal(result.beforeDomDrift.renderedWindowPageNumbers.length > 0, true);
assert.equal(result.beforeDomDrift.refreshSerial > 0, true);
assert.equal(result.beforeDomDrift.textTruth, 'false');
assert.equal(result.beforeDomDrift.storageTruth, 'false');
assert.equal(result.beforeDomDrift.exportTruth, 'false');
assert.equal(result.beforeDomDrift.pageMapProductRuntimeBinding, 'false');
assert.equal(result.beforeDomDrift.centralSheetFlow, 'vertical');
assert.equal(result.beforeDomDrift.centralSheetWindowingEnabled, 'true');
assert.equal(result.beforeDomDrift.visibleSheetCount, Number(result.beforeDomDrift.centralSheetRenderedPageCount));
assert.equal(result.beforeDomDrift.proseMirrorCount, 1);
assert.equal(result.beforeDomDrift.tiptapEditorCount, 1);
assert.equal(result.beforeDomDrift.prosePageTruthCount, 0);
assert.equal(result.domDrift.ok, true);
assert.equal(result.domDrift.domDriftTextPresent, true);
assert.equal(result.afterDomDrift.bridgeActive, 'true');
assert.equal(result.afterDomDrift.domDriftTextPresent, true);
assert.equal(result.afterDomDrift.refreshSerial > result.beforeDomDrift.refreshSerial, true);
assert.equal(result.afterDomDrift.editorTextHash, result.beforeDomDrift.editorTextHash);
assert.equal(result.afterDomDrift.sourceContractHash, result.beforeDomDrift.sourceContractHash);
assert.deepEqual(result.afterDomDrift.renderedWindowPageNumbers, result.beforeDomDrift.renderedWindowPageNumbers);

console.log('VERTICAL_SHEET_FEED_SMOKE_SUMMARY:' + JSON.stringify({
  ok: true,
  bridgeActive: true,
  bridgeSource: result.beforeDomDrift.bridgeSource,
  renderedWindowPageNumbers: result.beforeDomDrift.renderedWindowPageNumbers,
  viewportDomDriftIgnored: true,
}));

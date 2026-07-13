import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const TIMEOUT_MS = 30000;
const RESULT_PREFIX = 'YALKEN_DESIGN_OS_SIDEBAR_UI_E2E_RESULT:';
const rootDir = path.resolve(new URL('../..', import.meta.url).pathname);
const requireFromHere = createRequire(import.meta.url);
const electronBinary = requireFromHere('electron');
const evidenceDir = process.env.YALKEN_SIDEBAR_E2E_OUT_DIR
  ? path.resolve(process.env.YALKEN_SIDEBAR_E2E_OUT_DIR)
  : '';

function parseResult(stdout) {
  const line = String(stdout || '')
    .split(/\r?\n/u)
    .find((item) => item.startsWith(RESULT_PREFIX));
  return line ? JSON.parse(line.slice(RESULT_PREFIX.length)) : null;
}

function createChildSource(tempRoot, outputDir) {
  return `\
const fs = require('node:fs');
const path = require('node:path');
const { app, BrowserWindow, dialog, session } = require('electron');

const rootDir = ${JSON.stringify(rootDir)};
const tempRoot = ${JSON.stringify(tempRoot)};
const outputDir = ${JSON.stringify(outputDir)};
const RESULT_PREFIX = ${JSON.stringify(RESULT_PREFIX)};
const networkRequests = [];

function emit(payload) {
  process.stdout.write(RESULT_PREFIX + JSON.stringify(payload) + '\\n');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitUntil(predicate, label, timeoutMs = 10000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const value = await predicate();
    if (value) return value;
    await sleep(50);
  }
  throw new Error('WAIT_TIMEOUT:' + label);
}

for (const dirName of ['appData', 'userData', 'documents']) {
  fs.mkdirSync(path.join(tempRoot, dirName), { recursive: true });
}

dialog.showOpenDialog = async () => ({ canceled: true, filePaths: [] });
dialog.showSaveDialog = async () => ({ canceled: true });
dialog.showMessageBox = async () => ({ response: 0 });

app.setPath('appData', path.join(tempRoot, 'appData'));
app.setPath('userData', path.join(tempRoot, 'userData'));
app.setPath('documents', path.join(tempRoot, 'documents'));
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('force-device-scale-factor', '1');
app.commandLine.appendSwitch('disable-features', 'UseSkiaRenderer');

app.whenReady().then(() => {
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const url = details && typeof details.url === 'string' ? details.url : '';
    const blocked = /^(https?|wss?):/u.test(url);
    if (blocked) networkRequests.push(url);
    callback({ cancel: blocked });
  });
});

process.chdir(rootDir);
if (!process.argv.includes('--dev')) process.argv.push('--dev');
require(path.join(rootDir, 'src', 'main.js'));

async function collectProbe(win, label) {
  return win.webContents.executeJavaScript(\`(() => {
    const toRect = (element) => {
      const rect = element?.getBoundingClientRect();
      return rect ? {
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      } : null;
    };
    const layout = document.querySelector('.app-layout');
    const left = document.querySelector('.sidebar--left');
    const right = document.querySelector('[data-right-sidebar]');
    const main = document.querySelector('.main-content');
    const tree = document.querySelector('.sidebar--left [data-tree]');
    const leftToolbar = document.querySelector('[data-left-toolbar-shell]');
    const mainToolbar = document.querySelector('[data-toolbar-shell]');
    return {
      label: \${JSON.stringify(label)},
      innerWidth: window.innerWidth,
      layoutVariant: layout?.dataset.sidebarLayout || '',
      leftWidthVar: parseInt(layout?.style.getPropertyValue('--app-left-sidebar-width') || '0', 10),
      rightWidthVar: parseInt(layout?.style.getPropertyValue('--app-right-sidebar-width') || '0', 10),
      rightHidden: right?.hidden === true,
      rightDisplay: right ? getComputedStyle(right).display : '',
      documentFits: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
      bodyFits: document.body.scrollWidth <= document.body.clientWidth + 1,
      layout: toRect(layout),
      left: toRect(left),
      right: toRect(right),
      main: toRect(main),
      tree: toRect(tree),
      leftToolbar: toRect(leftToolbar),
      mainToolbar: toRect(mainToolbar),
    };
  })()\`, true);
}

async function resizeAndProbe(win, width, height, label) {
  win.setContentSize(width, height);
  await sleep(220);
  return collectProbe(win, label);
}

async function captureEvidence(win, basename) {
  if (!outputDir) return;
  fs.mkdirSync(outputDir, { recursive: true });
  const image = await win.webContents.capturePage();
  fs.writeFileSync(path.join(outputDir, basename), image.toPNG());
}

async function captureSelectorEvidence(win, selector, basename) {
  if (!outputDir) return;
  const rect = await win.webContents.executeJavaScript(\`(() => {
    const element = document.querySelector(\${JSON.stringify(selector)});
    const bounds = element?.getBoundingClientRect();
    return bounds ? {
      x: Math.max(0, Math.floor(bounds.x)),
      y: Math.max(0, Math.floor(bounds.y)),
      width: Math.max(1, Math.ceil(bounds.width)),
      height: Math.max(1, Math.ceil(bounds.height)),
    } : null;
  })()\`, true);
  if (!rect) return;
  fs.mkdirSync(outputDir, { recursive: true });
  const image = await win.webContents.capturePage(rect);
  fs.writeFileSync(path.join(outputDir, basename), image.toPNG());
}

async function dragRail(win, side, delta) {
  const selector = side === 'left' ? '[data-sidebar-resizer]' : '[data-right-sidebar-resizer]';
  const point = await win.webContents.executeJavaScript(\`(() => {
    const handle = document.querySelector(\${JSON.stringify(selector)});
    if (!handle) return null;
    const rect = handle.getBoundingClientRect();
    return {
      x: Math.round(rect.left + rect.width / 2),
      y: Math.round(rect.top + Math.min(40, rect.height / 2)),
    };
  })()\`, true);
  if (!point) return { ok: false, reason: 'HANDLE_MISSING' };

  win.webContents.sendInputEvent({ type: 'mouseMove', x: point.x, y: point.y });
  win.webContents.sendInputEvent({ type: 'mouseDown', x: point.x, y: point.y, button: 'left', clickCount: 1 });
  win.webContents.sendInputEvent({ type: 'mouseMove', x: point.x + delta, y: point.y, button: 'left' });
  win.webContents.sendInputEvent({ type: 'mouseUp', x: point.x + delta, y: point.y, button: 'left', clickCount: 1 });
  await sleep(160);

  return win.webContents.executeJavaScript(\`(() => {
    const layout = document.querySelector('.app-layout');
    const handle = document.querySelector(\${JSON.stringify(selector)});
    return {
      ok: true,
      leftWidth: parseInt(layout?.style.getPropertyValue('--app-left-sidebar-width') || '0', 10),
      rightWidth: parseInt(layout?.style.getPropertyValue('--app-right-sidebar-width') || '0', 10),
      resizingClassCleared: !layout?.classList.contains('is-sidebar-resizing'),
      activeHandleCleared: !handle?.classList.contains('is-resizing'),
    };
  })()\`, true);
}

async function exerciseInspectorControls(win) {
  const before = await win.webContents.executeJavaScript(
    "(() => { const text = (selector) => document.querySelector(selector)?.textContent?.trim() || ''; const commentsAction = document.querySelector('[data-inspector-comments-action]'); const autosaveStatus = document.querySelector('[data-inspector-autosave-status]'); const focusStatus = document.querySelector('[data-inspector-focus-status]'); return { commentsTag: commentsAction?.tagName || '', commentsAction: commentsAction?.dataset.action || '', autosaveTag: autosaveStatus?.tagName || '', autosaveText: autosaveStatus?.textContent?.trim() || '', focusTag: focusStatus?.tagName || '', focusText: focusStatus?.textContent?.trim() || '', focusState: focusStatus?.dataset.state || '', fontMatches: text('[data-font-display]') === text('[data-inspector-font]'), weightMatches: text('[data-weight-display]') === text('[data-inspector-weight]'), sizeMatches: text('[data-size-display]') === text('[data-inspector-font-size]'), lineHeightMatches: text('[data-line-height-display]') === text('[data-inspector-line-height]'), marginsText: text('[data-inspector-margins]'), marginsTitle: document.querySelector('[data-inspector-margins]')?.title || '', historyTabPresent: Boolean(document.querySelector('[data-right-tab=history]')), quickNotePresent: Boolean(document.querySelector('[data-left-quick-note]')) }; })()",
    true
  );

  await win.webContents.executeJavaScript("(() => { const change = (selector, value) => { const select = document.querySelector(selector); if (!select) return; select.value = value; select.dispatchEvent(new Event('change', { bubbles: true })); }; change('[data-font-select]', 'Georgia, serif'); change('[data-weight-select]', 'regular'); change('[data-size-select]', '16'); change('[data-line-height-select]', '1.4'); })()", true);
  await sleep(500);
  const typographyChanged = await win.webContents.executeJavaScript(
    "(() => { const text = (selector) => document.querySelector(selector)?.textContent?.trim() || ''; return { font: text('[data-inspector-font]'), weight: text('[data-inspector-weight]'), size: text('[data-inspector-font-size]'), lineHeight: text('[data-inspector-line-height]') }; })()",
    true
  );

  await win.webContents.executeJavaScript("document.querySelector('[data-inspector-comments-action]')?.click()", true);
  const commentsOpened = await waitUntil(
    () => win.webContents.executeJavaScript(
      "(() => ({ mode: document.body.dataset.mode || '', commentsVisible: document.querySelector('[data-right-panel-comments]')?.hidden === false, commentsTabPressed: document.querySelector('[data-right-tab=comments]')?.getAttribute('aria-pressed') || '' }))()",
      true
    ).then((state) => state.commentsVisible ? state : null),
    'INSPECTOR_COMMENTS_ACTION_DID_NOT_OPEN'
  );

  await win.webContents.executeJavaScript("document.querySelector('[data-right-tab=inspector]')?.click()", true);
  const inspectorRestored = await waitUntil(
    () => win.webContents.executeJavaScript(
      "(() => ({ inspectorVisible: document.querySelector('[data-right-panel-inspector]')?.hidden === false, inspectorTabPressed: document.querySelector('[data-right-tab=inspector]')?.getAttribute('aria-pressed') || '', commentsActionPressed: document.querySelector('[data-inspector-comments-action]')?.getAttribute('aria-pressed') || '' }))()",
      true
    ).then((state) => state.inspectorVisible ? state : null),
    'INSPECTOR_TAB_DID_NOT_RESTORE'
  );

  if (outputDir) {
    await win.webContents.executeJavaScript("(() => { const panel = document.querySelector('[data-right-panel-inspector]'); if (panel) panel.scrollTop = panel.scrollHeight; })()", true);
    await sleep(120);
    await captureSelectorEvidence(win, '[data-right-sidebar]', 'sidebar-inspector-state.png');
    await win.webContents.executeJavaScript("(() => { const panel = document.querySelector('[data-right-panel-inspector]'); if (panel) panel.scrollTop = 0; })()", true);
  }

  return { before, typographyChanged, commentsOpened, inspectorRestored };
}

app.whenReady().then(async () => {
  try {
    const win = await waitUntil(() => BrowserWindow.getAllWindows()[0] || null, 'WINDOW_NOT_CREATED');
    if (win.webContents.isLoadingMainFrame()) {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('LOAD_TIMEOUT')), 10000);
        win.webContents.once('did-finish-load', () => {
          clearTimeout(timer);
          resolve();
        });
      });
    }
    await waitUntil(
      () => win.webContents.executeJavaScript(
        "(() => ({ layoutReady: Boolean(document.querySelector('.app-layout')?.dataset.sidebarLayout), treeReady: document.querySelectorAll('[data-tree] .tree__row').length > 0 }))()",
        true
      ).then((state) => state.layoutReady && state.treeReady),
      'WORKSPACE_SHELL_NOT_READY'
    );
    await sleep(400);

    const initialWide = await resizeAndProbe(win, 1440, 850, 'initial-wide');
    const inspectorControls = await exerciseInspectorControls(win);
    const leftDrag = await dragRail(win, 'left', 40);
    const rightDrag = await dragRail(win, 'right', -30);
    const resizedWide = await collectProbe(win, 'resized-wide');
    await captureEvidence(win, 'sidebar-wide.png');
    const compact = await resizeAndProbe(win, 1000, 850, 'compact-single');
    await captureEvidence(win, 'sidebar-compact.png');
    const mobile = await resizeAndProbe(win, 820, 850, 'mobile-single');
    await captureEvidence(win, 'sidebar-mobile.png');
    const restoredWide = await resizeAndProbe(win, 1440, 850, 'restored-wide');
    const image = await win.webContents.capturePage();
    const bitmap = image.toBitmap();
    const sampled = new Set();
    for (let index = 0; index < bitmap.length; index += Math.max(4, Math.floor(bitmap.length / 4096))) {
      sampled.add(bitmap[index]);
    }

    emit({
      ok: 1,
      initialWide,
      inspectorControls,
      leftDrag,
      rightDrag,
      resizedWide,
      compact,
      mobile,
      restoredWide,
      screenshotBytes: image.toPNG().byteLength,
      sampledPixelValues: sampled.size,
      networkRequests,
    });
    app.exit(0);
  } catch (error) {
    emit({
      ok: 0,
      message: error && error.message ? error.message : String(error),
      stack: error && error.stack ? error.stack : '',
      networkRequests,
    });
    app.exit(1);
  }
});
`;
}

const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'yalken-sidebar-ui-e2e-'));
const childPath = path.join(tempRoot, 'sidebar-ui-e2e-child.cjs');
await fs.writeFile(childPath, createChildSource(tempRoot, evidenceDir), 'utf8');

const stdoutChunks = [];
const stderrChunks = [];
const child = spawn(electronBinary, [childPath], {
  cwd: rootDir,
  env: { ...process.env, ELECTRON_ENABLE_SECURITY_WARNINGS: 'false' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
child.stdout.on('data', (chunk) => stdoutChunks.push(chunk));
child.stderr.on('data', (chunk) => stderrChunks.push(chunk));

let timedOut = false;
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
const result = parseResult(stdout);

function assertSingleRailProbe(probe) {
  assert.equal(probe.layoutVariant, 'single');
  assert.equal(probe.rightHidden, true);
  assert.equal(probe.rightDisplay, 'none');
  assert.equal(probe.documentFits, true);
  assert.equal(probe.bodyFits, true);
  assert.equal(probe.left.right <= probe.main.left + 1, true);
  assert.equal(probe.main.right <= probe.innerWidth + 1, true);
  assert.equal(probe.leftToolbar.right + 8 <= probe.mainToolbar.left, true, 'top toolbars must not overlap');
  assert.equal(probe.mainToolbar.right <= probe.innerWidth, true, 'main toolbar must fit the viewport');
}

try {
  assert.equal(timedOut, false, `Electron sidebar UI E2E timed out\n${stderr}`);
  assert.equal(exitState.code, 0, `Electron sidebar UI E2E failed\n${stdout}\n${stderr}`);
  assert.equal(result?.ok, 1, result?.message || 'missing Electron sidebar UI E2E result');

  assert.equal(result.initialWide.layoutVariant, 'dual');
  assert.equal(result.initialWide.rightHidden, false);
  assert.equal(result.initialWide.documentFits, true);
  assert.equal(result.initialWide.bodyFits, true);
  assert.equal(result.initialWide.tree.height > 236, true, 'project tree should use available rail height');
  assert.equal(result.initialWide.leftToolbar.right + 8 <= result.initialWide.mainToolbar.left, true);
  assert.equal(result.initialWide.mainToolbar.right <= result.initialWide.innerWidth, true);

  assert.deepEqual(result.inspectorControls.before, {
    commentsTag: 'BUTTON',
    commentsAction: 'review-open-comments',
    autosaveTag: 'SPAN',
    autosaveText: 'Локально',
    focusTag: 'SPAN',
    focusText: 'Выкл',
    focusState: 'off',
    fontMatches: true,
    weightMatches: true,
    sizeMatches: true,
    lineHeightMatches: true,
    marginsText: '25,4 мм',
    marginsTitle: 'Верх 25,4 мм, справа 25,4 мм, низ 25,4 мм, слева 25,4 мм',
    historyTabPresent: false,
    quickNotePresent: false,
  });
  assert.deepEqual(result.inspectorControls.typographyChanged, {
    font: 'Georgia',
    weight: 'Regular',
    size: '16',
    lineHeight: '1.4',
  });
  assert.deepEqual(result.inspectorControls.commentsOpened, {
    mode: 'review',
    commentsVisible: true,
    commentsTabPressed: 'true',
  });
  assert.deepEqual(result.inspectorControls.inspectorRestored, {
    inspectorVisible: true,
    inspectorTabPressed: 'true',
    commentsActionPressed: 'false',
  });

  assert.deepEqual(
    [result.leftDrag.leftWidth, result.rightDrag.rightWidth],
    [330, 320],
    'both resize handles must update their own rail'
  );
  assert.equal(result.leftDrag.resizingClassCleared, true);
  assert.equal(result.leftDrag.activeHandleCleared, true);
  assert.equal(result.rightDrag.resizingClassCleared, true);
  assert.equal(result.rightDrag.activeHandleCleared, true);

  assertSingleRailProbe(result.compact);
  assert.equal(result.compact.leftWidthVar >= 250 && result.compact.leftWidthVar <= 320, true);
  assert.equal(result.compact.main.width >= 480, true);
  assert.equal(result.compact.rightWidthVar, 320, 'hidden right width must remain projected');
  assertSingleRailProbe(result.mobile);
  assert.equal(result.mobile.leftWidthVar, 240);
  assert.equal(result.mobile.main.width >= 500, true);

  assert.equal(result.restoredWide.layoutVariant, 'dual');
  assert.equal(result.restoredWide.rightHidden, false);
  assert.deepEqual(
    [result.restoredWide.leftWidthVar, result.restoredWide.rightWidthVar],
    [330, 320],
    'desktop rail widths must restore after compact and mobile projections'
  );
  assert.equal(result.restoredWide.documentFits, true);
  assert.equal(result.restoredWide.bodyFits, true);
  assert.equal(result.screenshotBytes > 1000, true);
  assert.equal(result.sampledPixelValues > 1, true);
  assert.deepEqual(result.networkRequests, []);
} finally {
  if (!child.killed) child.kill('SIGKILL');
  await fs.rm(tempRoot, { recursive: true, force: true });
}

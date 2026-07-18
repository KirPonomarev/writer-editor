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
const { app, BrowserWindow, dialog, Menu, session } = require('electron');

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
      leftRailMode: layout?.dataset.leftRailMode || '',
      leftRailOverlayOpen: layout?.dataset.leftRailOverlayOpen || '',
      leftWidthVar: parseInt(layout?.style.getPropertyValue('--app-left-sidebar-width') || '0', 10),
      rightWidthVar: parseInt(layout?.style.getPropertyValue('--app-right-sidebar-width') || '0', 10),
      rightHidden: right?.hidden === true,
      rightDisplay: right ? getComputedStyle(right).display : '',
      documentFits: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
      bodyFits: document.body.scrollWidth <= document.body.clientWidth + 1,
      backdropHidden: document.querySelector('[data-left-rail-overlay-backdrop]')?.hidden !== false,
      mainInert: main?.inert === true,
      leftPosition: left ? getComputedStyle(left).position : '',
      leftBackground: left ? getComputedStyle(left).backgroundColor : '',
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

async function exerciseLeftRailCollapse(win) {
  const productStateBefore = snapshotProjectProductFiles();
  const expanded = await collectProbe(win, 'left-rail-expanded');
  await win.webContents.executeJavaScript("document.querySelector('[data-left-rail-collapse]')?.click()", true);
  const collapsed = await waitUntil(
    () => win.webContents.executeJavaScript(
      "(() => { const layout = document.querySelector('.app-layout'); const sidebar = document.querySelector('.sidebar--left'); const button = document.querySelector('[data-left-rail-collapse]'); const resizer = document.querySelector('[data-sidebar-resizer]'); const key = [...Array(localStorage.length).keys()].map((index) => localStorage.key(index)).find((item) => item?.startsWith('yalkenSpatialLayout:')) || ''; const stored = key ? JSON.parse(localStorage.getItem(key) || '{}') : {}; const main = document.querySelector('.main-content')?.getBoundingClientRect(); return { collapsed: layout?.dataset.leftRailCollapsed === 'true', leftWidth: parseInt(layout?.style.getPropertyValue('--app-left-sidebar-width') || '0', 10), sidebarClass: sidebar?.classList.contains('is-collapsed') === true, resizerHidden: resizer?.hidden === true, buttonExpanded: button?.getAttribute('aria-expanded') || '', buttonFocused: document.activeElement === button, mainWidth: Math.round(main?.width || 0), stored }; })()",
      true
    ).then((state) => state.collapsed && state.buttonFocused ? state : null),
    'LEFT_RAIL_COLLAPSE_FAILED'
  );
  await captureEvidence(win, 'sidebar-left-collapsed.png');

  await win.webContents.executeJavaScript("document.querySelector('[data-left-rail-collapse]')?.click()", true);
  const restored = await waitUntil(
    () => collectProbe(win, 'left-rail-restored').then((probe) => (
      probe.leftWidthVar === expanded.leftWidthVar ? probe : null
    )),
    'LEFT_RAIL_RESTORE_FAILED'
  );
  const control = await win.webContents.executeJavaScript(
    "(() => { const layout = document.querySelector('.app-layout'); const button = document.querySelector('[data-left-rail-collapse]'); const resizer = document.querySelector('[data-sidebar-resizer]'); return { collapsed: layout?.dataset.leftRailCollapsed === 'true', buttonExpanded: button?.getAttribute('aria-expanded') || '', buttonFocused: document.activeElement === button, resizerHidden: resizer?.hidden === true }; })()",
    true
  );

  return {
    expanded,
    collapsed,
    restored,
    control,
    productStateUnchanged: JSON.stringify(snapshotProjectProductFiles()) === JSON.stringify(productStateBefore),
  };
}

async function exerciseLeftRailOverlay(win) {
  const productStateBefore = snapshotProjectProductFiles();
  const storageBefore = await win.webContents.executeJavaScript(
    "(() => { const key = [...Array(localStorage.length).keys()].map((index) => localStorage.key(index)).find((item) => item?.startsWith('yalkenSpatialLayout:')) || ''; return key ? localStorage.getItem(key) : ''; })()",
    true
  );
  const closed = await collectProbe(win, 'mobile-overlay-closed');
  await win.webContents.executeJavaScript("document.querySelector('[data-left-rail-collapse]')?.click()", true);
  const opened = await waitUntil(
    () => collectProbe(win, 'mobile-overlay-open').then((probe) => (
      probe.leftRailOverlayOpen === 'true' && probe.mainInert && !probe.backdropHidden ? probe : null
    )),
    'LEFT_RAIL_OVERLAY_OPEN_FAILED'
  );
  await captureEvidence(win, 'sidebar-mobile-overlay-open.png');
  const openControl = await win.webContents.executeJavaScript(
    "(() => { const sidebar = document.querySelector('.sidebar--left'); const button = document.querySelector('[data-left-rail-collapse]'); return { buttonExpanded: button?.getAttribute('aria-expanded') || '', buttonLabel: button?.getAttribute('aria-label') || '', buttonFocused: document.activeElement === button, activeInSidebar: sidebar?.contains(document.activeElement) === true }; })()",
    true
  );
  await win.webContents.executeJavaScript(
    "document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }))",
    true
  );
  const focusTrap = await win.webContents.executeJavaScript(
    "(() => { const sidebar = document.querySelector('.sidebar--left'); return { activeInSidebar: sidebar?.contains(document.activeElement) === true, activeIsMain: document.querySelector('.main-content')?.contains(document.activeElement) === true }; })()",
    true
  );
  await win.webContents.executeJavaScript(
    "document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))",
    true
  );
  const escaped = await waitUntil(
    () => win.webContents.executeJavaScript(
      "(() => { const layout = document.querySelector('.app-layout'); const button = document.querySelector('[data-left-rail-collapse]'); const backdrop = document.querySelector('[data-left-rail-overlay-backdrop]'); return { open: layout?.dataset.leftRailOverlayOpen === 'true', buttonFocused: document.activeElement === button, backdropHidden: backdrop?.hidden !== false, mainInert: document.querySelector('.main-content')?.inert === true }; })()",
      true
    ).then((state) => !state.open && state.buttonFocused ? state : null),
    'LEFT_RAIL_OVERLAY_ESCAPE_FAILED'
  );
  await win.webContents.executeJavaScript("document.querySelector('[data-left-rail-collapse]')?.click()", true);
  await waitUntil(
    () => win.webContents.executeJavaScript("document.querySelector('.app-layout')?.dataset.leftRailOverlayOpen === 'true'", true),
    'LEFT_RAIL_OVERLAY_REOPEN_FAILED'
  );
  await win.webContents.executeJavaScript("document.querySelector('[data-left-rail-overlay-backdrop]')?.click()", true);
  const backdropClosed = await waitUntil(
    () => win.webContents.executeJavaScript(
      "(() => ({ open: document.querySelector('.app-layout')?.dataset.leftRailOverlayOpen === 'true', buttonFocused: document.activeElement === document.querySelector('[data-left-rail-collapse]') }))()",
      true
    ).then((state) => !state.open && state.buttonFocused ? state : null),
    'LEFT_RAIL_OVERLAY_BACKDROP_CLOSE_FAILED'
  );
  const storageAfter = await win.webContents.executeJavaScript(
    "(() => { const key = [...Array(localStorage.length).keys()].map((index) => localStorage.key(index)).find((item) => item?.startsWith('yalkenSpatialLayout:')) || ''; return key ? localStorage.getItem(key) : ''; })()",
    true
  );
  return {
    closed,
    opened,
    openControl,
    focusTrap,
    escaped,
    backdropClosed,
    storageUnchanged: storageAfter === storageBefore,
    productStateUnchanged: JSON.stringify(snapshotProjectProductFiles()) === JSON.stringify(productStateBefore),
  };
}

async function exerciseLeftRailSafeReset(win) {
  const productStateBefore = snapshotProjectProductFiles();
  await win.webContents.executeJavaScript("document.querySelector('[data-left-rail-collapse]')?.click()", true);
  await waitUntil(
    () => win.webContents.executeJavaScript(
      "document.querySelector('.app-layout')?.dataset.leftRailCollapsed === 'true'",
      true
    ),
    'LEFT_RAIL_PRE_RESET_COLLAPSE_FAILED'
  );
  const safeResetItem = Menu.getApplicationMenu()?.getMenuItemById('view-safe-reset');
  if (!safeResetItem) throw new Error('SAFE_RESET_MENU_ITEM_MISSING');
  safeResetItem.click(safeResetItem, win, {});
  const reset = await waitUntil(
    () => win.webContents.executeJavaScript(
      "(() => { const layout = document.querySelector('.app-layout'); const button = document.querySelector('[data-left-rail-collapse]'); const key = [...Array(localStorage.length).keys()].map((index) => localStorage.key(index)).find((item) => item?.startsWith('yalkenSpatialLayout:')) || ''; const stored = key ? JSON.parse(localStorage.getItem(key) || '{}') : {}; return { collapsed: layout?.dataset.leftRailCollapsed === 'true', leftWidth: parseInt(layout?.style.getPropertyValue('--app-left-sidebar-width') || '0', 10), buttonExpanded: button?.getAttribute('aria-expanded') || '', stored }; })()",
      true
    ).then((state) => !state.collapsed && state.leftWidth === 290 ? state : null),
    'LEFT_RAIL_SAFE_RESET_FAILED'
  );
  return {
    reset,
    productStateUnchanged: JSON.stringify(snapshotProjectProductFiles()) === JSON.stringify(productStateBefore),
  };
}

async function exerciseLeftRailLastStableRestore(win) {
  const productStateBefore = snapshotProjectProductFiles();
  const point = await win.webContents.executeJavaScript(
    "(() => { const handle = document.querySelector('[data-sidebar-resizer]'); const rect = handle?.getBoundingClientRect(); return rect ? { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + 40) } : null; })()",
    true
  );
  if (!point) throw new Error('LEFT_RAIL_LAST_STABLE_HANDLE_MISSING');
  win.webContents.sendInputEvent({ type: 'mouseMove', x: point.x, y: point.y });
  win.webContents.sendInputEvent({ type: 'mouseDown', x: point.x, y: point.y, button: 'left', clickCount: 1 });
  win.webContents.sendInputEvent({ type: 'mouseMove', x: point.x + 30, y: point.y, button: 'left' });
  const transientWidth = await waitUntil(
    () => win.webContents.executeJavaScript(
      "parseInt(document.querySelector('.app-layout')?.style.getPropertyValue('--app-left-sidebar-width') || '0', 10)",
      true
    ).then((width) => width === 320 ? width : 0),
    'LEFT_RAIL_TRANSIENT_RESIZE_FAILED'
  );
  const restoreItem = Menu.getApplicationMenu()?.getMenuItemById('view-restore-last-stable');
  if (!restoreItem) throw new Error('RESTORE_LAST_STABLE_MENU_ITEM_MISSING');
  restoreItem.click(restoreItem, win, {});
  const restored = await waitUntil(
    () => win.webContents.executeJavaScript(
      "(() => { const layout = document.querySelector('.app-layout'); const key = [...Array(localStorage.length).keys()].map((index) => localStorage.key(index)).find((item) => item?.startsWith('yalkenSpatialLayout:')) || ''; const stored = key ? JSON.parse(localStorage.getItem(key) || '{}') : {}; return { width: parseInt(layout?.style.getPropertyValue('--app-left-sidebar-width') || '0', 10), storedWidth: stored.leftSidebarWidth || 0 }; })()",
      true
    ).then((state) => state.width === 290 ? state : null),
    'LEFT_RAIL_LAST_STABLE_RESTORE_FAILED'
  );
  win.webContents.sendInputEvent({ type: 'mouseUp', x: point.x + 30, y: point.y, button: 'left', clickCount: 1 });
  await sleep(120);
  return {
    transientWidth,
    restored,
    productStateUnchanged: JSON.stringify(snapshotProjectProductFiles()) === JSON.stringify(productStateBefore),
  };
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

async function exerciseActiveDocumentReveal(win) {
  const prepared = await win.webContents.executeJavaScript(
    "(async () => { const result = await window.electronAPI.getProjectTree('roman'); const activeId = document.querySelector('.tree__row[data-active-document=true]')?.dataset.documentId || ''; const candidates = []; const stack = result?.root ? [result.root] : []; while (stack.length) { const node = stack.pop(); if (!node) continue; if (['scene', 'chapter-file', 'roman-section'].includes(node.kind) && node.nodeId !== activeId) candidates.push(node); for (const child of node.children || []) stack.push(child); } const target = candidates.at(-1) || null; const manuscriptRow = [...document.querySelectorAll('.tree__row')].find((row) => row.querySelector('.tree__label')?.textContent?.trim() === 'Рукопись'); if (manuscriptRow) manuscriptRow.click(); return { projectId: result?.projectId || '', targetId: target?.nodeId || '', targetLabel: target?.label || '', manuscriptFound: Boolean(manuscriptRow), targetHiddenAfterCollapse: target ? !document.querySelector('.tree__row[data-document-id=' + target.nodeId + ']') : false }; })()",
    true
  );
  if (!prepared.projectId || !prepared.targetId) {
    throw new Error('ACTIVE_REVEAL_TARGET_MISSING');
  }

  const opened = await win.webContents.executeJavaScript(
    'window.electronAPI.openDocument(' + JSON.stringify({
      projectId: prepared.projectId,
      nodeId: prepared.targetId,
    }) + ')',
    true
  );
  if (!opened || opened.ok === false) {
    throw new Error('ACTIVE_REVEAL_OPEN_FAILED');
  }

  const revealed = await waitUntil(
    () => win.webContents.executeJavaScript(
      "(() => { const tree = document.querySelector('.sidebar--left [data-tree]'); const rows = [...document.querySelectorAll('.tree__row[data-active-document=true]')]; const row = rows[0] || null; const treeRect = tree?.getBoundingClientRect(); const rowRect = row?.getBoundingClientRect(); const activeElement = document.activeElement; const labels = [...document.querySelectorAll('.tree__label')].map((label) => label.textContent?.trim() || ''); return { activeCount: rows.length, activeId: row?.dataset.documentId || '', ariaCurrent: row?.getAttribute('aria-current') || '', visible: Boolean(treeRect && rowRect && rowRect.top >= treeRect.top - 1 && rowRect.bottom <= treeRect.bottom + 1), editorFocused: Boolean(activeElement?.classList?.contains('ProseMirror') || activeElement?.closest?.('.ProseMirror')), russianRoots: ['Проект', 'Рукопись', 'Заметки'].every((label) => labels.includes(label)) }; })()",
      true
    ).then((state) => (
      state.activeCount === 1 &&
      state.activeId === prepared.targetId &&
      state.visible &&
      state.editorFocused
        ? state
        : null
    )),
    'ACTIVE_DOCUMENT_NOT_REVEALED'
  );

  return { prepared, revealed };
}

function snapshotProjectProductFiles() {
  const projectRoot = path.join(tempRoot, 'documents', 'craftsman');
  const records = [];
  const visit = (directory) => {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(entryPath);
      else if (entry.isFile()) {
        records.push({
          path: path.relative(projectRoot, entryPath).split(path.sep).join('/'),
          content: fs.readFileSync(entryPath).toString('base64'),
        });
      }
    }
  };
  visit(projectRoot);
  return records.sort((left, right) => left.path.localeCompare(right.path));
}

async function exerciseNavigatorSelection(win) {
  const productStateBefore = snapshotProjectProductFiles();
  const targets = await win.webContents.executeJavaScript(
    "(() => { const activeId = document.querySelector('.tree__row[data-active-document=true]')?.dataset.navigatorRowId || ''; const ids = [...document.querySelectorAll('.tree__row[data-navigator-selectable=true]')].map((row) => row.dataset.navigatorRowId || '').filter((id) => id && id !== activeId); return { activeId, ids: ids.slice(0, 2) }; })()",
    true
  );
  if (!targets.activeId || targets.ids.length < 2) throw new Error('NAVIGATOR_SELECTION_TARGETS_MISSING');

  const dispatchRowClick = (nodeId, options = {}) => win.webContents.executeJavaScript(
    "(() => { const row = document.querySelector('.tree__row[data-navigator-row-id=" + nodeId + "]'); if (!row) return false; row.dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: " + (options.ctrlKey === true ? 'true' : 'false') + " })); return true; })()",
    true
  );
  const readState = () => win.webContents.executeJavaScript(
    "(() => { const activeElement = document.activeElement; return { selectedIds: [...document.querySelectorAll('.tree__row.is-selected')].map((row) => row.dataset.navigatorRowId || '').filter(Boolean), activeId: document.querySelector('.tree__row[data-active-document=true]')?.dataset.navigatorRowId || '', focusedId: activeElement?.dataset?.navigatorRowId || '', editorFocused: Boolean(activeElement?.classList?.contains('ProseMirror') || activeElement?.closest?.('.ProseMirror')) }; })()",
    true
  );

  await dispatchRowClick(targets.ids[0], { ctrlKey: true });
  const afterFirstPointer = await waitUntil(
    () => readState().then((state) => (
      state.selectedIds.length === 1 &&
      state.selectedIds[0] === targets.ids[0] &&
      state.activeId === targets.activeId &&
      state.focusedId === targets.ids[0]
        ? state
        : null
    )),
    'NAVIGATOR_FIRST_POINTER_SELECTION_FAILED'
  );

  await dispatchRowClick(targets.ids[1], { ctrlKey: true });
  const afterSecondPointer = await waitUntil(
    () => readState().then((state) => (
      state.selectedIds.length === 2 &&
      targets.ids.every((id) => state.selectedIds.includes(id)) &&
      state.activeId === targets.activeId &&
      state.focusedId === targets.ids[1]
        ? state
        : null
    )),
    'NAVIGATOR_MULTI_POINTER_SELECTION_FAILED'
  );

  await win.webContents.executeJavaScript(
    "(() => { const row = document.querySelector('.tree__row[data-navigator-row-id=" + targets.ids[1] + "]'); if (!row) return false; row.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, ctrlKey: true })); return true; })()",
    true
  );
  const afterKeyboardToggle = await waitUntil(
    () => readState().then((state) => (
      state.selectedIds.length === 1 &&
      state.selectedIds[0] === targets.ids[0] &&
      state.activeId === targets.activeId &&
      state.focusedId === targets.ids[1]
        ? state
        : null
    )),
    'NAVIGATOR_KEYBOARD_SELECTION_FAILED'
  );
  const productStateUnchanged = JSON.stringify(snapshotProjectProductFiles()) === JSON.stringify(productStateBefore);

  await win.webContents.executeJavaScript(
    "(() => { const row = document.querySelector('.tree__row[data-navigator-row-id=" + targets.ids[1] + "]'); if (!row) return false; row.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true })); return true; })()",
    true
  );
  await waitUntil(
    () => readState().then((state) => (
      state.selectedIds.length === 1 &&
      state.selectedIds[0] === targets.ids[1] &&
      state.focusedId === targets.ids[1]
        ? state
        : null
    )),
    'NAVIGATOR_KEYBOARD_SINGLE_SELECTION_FAILED'
  );
  const openResult = await win.webContents.executeJavaScript(
    "window.electronAPI.getProjectTree('roman').then((tree) => window.electronAPI.openDocument({ projectId: tree.projectId, nodeId: " + JSON.stringify(targets.ids[1]) + " }))",
    true
  );
  if (!openResult || openResult.ok === false) throw new Error('NAVIGATOR_DOCUMENT_OPEN_FAILED');
  let afterOpen = null;
  try {
    afterOpen = await waitUntil(
      () => readState().then((state) => (
        state.selectedIds.length === 1 &&
        state.selectedIds[0] === targets.ids[1] &&
        state.activeId === targets.ids[1] &&
        state.editorFocused
          ? state
          : null
      )),
      'NAVIGATOR_OPEN_FOCUS_SYNC_FAILED'
    );
  } catch (error) {
    const finalState = await readState();
    throw new Error('NAVIGATOR_OPEN_FOCUS_SYNC_FAILED:' + JSON.stringify(finalState));
  }

  return {
    targets,
    afterFirstPointer,
    afterSecondPointer,
    afterKeyboardToggle,
    afterOpen,
    productStateUnchanged,
  };
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
    const activeDocumentReveal = await exerciseActiveDocumentReveal(win);
    const navigatorSelection = await exerciseNavigatorSelection(win);
    const inspectorControls = await exerciseInspectorControls(win);
    const leftDrag = await dragRail(win, 'left', 40);
    const rightDrag = await dragRail(win, 'right', -30);
    const leftRailCollapse = await exerciseLeftRailCollapse(win);
    const resizedWide = await collectProbe(win, 'resized-wide');
    await captureEvidence(win, 'sidebar-wide.png');
    const compact = await resizeAndProbe(win, 1000, 850, 'compact-single');
    await captureEvidence(win, 'sidebar-compact.png');
    const mobile = await resizeAndProbe(win, 820, 850, 'mobile-single');
    await captureEvidence(win, 'sidebar-mobile.png');
    const leftRailOverlay = await exerciseLeftRailOverlay(win);
    const restoredWide = await resizeAndProbe(win, 1440, 850, 'restored-wide');
    const leftRailSafeReset = await exerciseLeftRailSafeReset(win);
    const leftRailLastStable = await exerciseLeftRailLastStableRestore(win);
    const image = await win.webContents.capturePage();
    const bitmap = image.toBitmap();
    const sampled = new Set();
    for (let index = 0; index < bitmap.length; index += Math.max(4, Math.floor(bitmap.length / 4096))) {
      sampled.add(bitmap[index]);
    }

    emit({
      ok: 1,
      initialWide,
      activeDocumentReveal,
      navigatorSelection,
      inspectorControls,
      leftDrag,
      rightDrag,
      leftRailCollapse,
      resizedWide,
      compact,
      mobile,
      leftRailOverlay,
      restoredWide,
      leftRailSafeReset,
      leftRailLastStable,
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
  assert.equal(
    exitState.code,
    0,
    `Electron sidebar UI E2E failed (${JSON.stringify(exitState)})\n${stdout}\n${stderr}`
  );
  assert.equal(result?.ok, 1, result?.message || 'missing Electron sidebar UI E2E result');

  assert.equal(result.initialWide.layoutVariant, 'dual');
  assert.equal(result.initialWide.rightHidden, false);
  assert.equal(result.initialWide.documentFits, true);
  assert.equal(result.initialWide.bodyFits, true);
  assert.equal(result.initialWide.tree.height > 236, true, 'project tree should use available rail height');
  assert.equal(result.initialWide.leftToolbar.right + 8 <= result.initialWide.mainToolbar.left, true);
  assert.equal(result.initialWide.mainToolbar.right <= result.initialWide.innerWidth, true);

  assert.equal(result.activeDocumentReveal.prepared.manuscriptFound, true);
  assert.equal(result.activeDocumentReveal.prepared.targetHiddenAfterCollapse, true);
  assert.deepEqual(result.activeDocumentReveal.revealed, {
    activeCount: 1,
    activeId: result.activeDocumentReveal.prepared.targetId,
    ariaCurrent: 'true',
    visible: true,
    editorFocused: true,
    russianRoots: true,
  });
  assert.deepEqual(result.navigatorSelection.afterFirstPointer, {
    selectedIds: [result.navigatorSelection.targets.ids[0]],
    activeId: result.navigatorSelection.targets.activeId,
    focusedId: result.navigatorSelection.targets.ids[0],
    editorFocused: false,
  });
  assert.equal(result.navigatorSelection.afterSecondPointer.selectedIds.length, 2);
  assert.equal(result.navigatorSelection.afterSecondPointer.activeId, result.navigatorSelection.targets.activeId);
  assert.equal(result.navigatorSelection.afterSecondPointer.focusedId, result.navigatorSelection.targets.ids[1]);
  assert.deepEqual(result.navigatorSelection.afterKeyboardToggle, {
    selectedIds: [result.navigatorSelection.targets.ids[0]],
    activeId: result.navigatorSelection.targets.activeId,
    focusedId: result.navigatorSelection.targets.ids[1],
    editorFocused: false,
  });
  assert.deepEqual(result.navigatorSelection.afterOpen, {
    selectedIds: [result.navigatorSelection.targets.ids[1]],
    activeId: result.navigatorSelection.targets.ids[1],
    focusedId: '',
    editorFocused: true,
  });
  assert.equal(result.navigatorSelection.productStateUnchanged, true);

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

  assert.equal(result.leftRailCollapse.collapsed.leftWidth, 48);
  assert.equal(result.leftRailCollapse.collapsed.sidebarClass, true);
  assert.equal(result.leftRailCollapse.collapsed.resizerHidden, true);
  assert.equal(result.leftRailCollapse.collapsed.buttonExpanded, 'false');
  assert.equal(result.leftRailCollapse.collapsed.buttonFocused, true);
  assert.equal(result.leftRailCollapse.collapsed.mainWidth > result.leftRailCollapse.expanded.main.width, true);
  assert.equal(result.leftRailCollapse.collapsed.stored.leftSidebarWidth, 330);
  assert.equal(result.leftRailCollapse.collapsed.stored.leftCollapsed, true);
  assert.equal(Boolean(result.leftRailCollapse.collapsed.stored.projectId), true);
  assert.equal(result.leftRailCollapse.restored.leftWidthVar, 330);
  assert.deepEqual(result.leftRailCollapse.control, {
    collapsed: false,
    buttonExpanded: 'true',
    buttonFocused: true,
    resizerHidden: false,
  });
  assert.equal(result.leftRailCollapse.productStateUnchanged, true);

  assertSingleRailProbe(result.compact);
  assert.equal(result.compact.leftWidthVar >= 250 && result.compact.leftWidthVar <= 320, true);
  assert.equal(result.compact.main.width >= 480, true);
  assert.equal(result.compact.rightWidthVar, 320, 'hidden right width must remain projected');
  assertSingleRailProbe(result.mobile);
  assert.equal(result.mobile.leftRailMode, 'overlay');
  assert.equal(result.mobile.leftRailOverlayOpen, 'false');
  assert.equal(result.mobile.leftWidthVar, 48);
  assert.equal(result.mobile.main.width >= 700, true);
  assert.equal(result.mobile.backdropHidden, true);
  assert.equal(result.mobile.mainInert, false);
  assert.equal(result.leftRailOverlay.opened.leftRailMode, 'overlay');
  assert.equal(result.leftRailOverlay.opened.leftRailOverlayOpen, 'true');
  assert.equal(result.leftRailOverlay.opened.left.width, 240);
  assert.equal(result.leftRailOverlay.opened.left.right <= result.leftRailOverlay.opened.innerWidth, true);
  assert.equal(result.leftRailOverlay.opened.leftPosition, 'absolute');
  assert.notEqual(result.leftRailOverlay.opened.leftBackground, 'rgba(0, 0, 0, 0)');
  assert.deepEqual(result.leftRailOverlay.openControl, {
    buttonExpanded: 'true',
    buttonLabel: 'Закрыть навигатор',
    buttonFocused: true,
    activeInSidebar: true,
  });
  assert.deepEqual(result.leftRailOverlay.focusTrap, { activeInSidebar: true, activeIsMain: false });
  assert.deepEqual(result.leftRailOverlay.escaped, {
    open: false,
    buttonFocused: true,
    backdropHidden: true,
    mainInert: false,
  });
  assert.deepEqual(result.leftRailOverlay.backdropClosed, { open: false, buttonFocused: true });
  assert.equal(result.leftRailOverlay.storageUnchanged, true);
  assert.equal(result.leftRailOverlay.productStateUnchanged, true);

  assert.equal(result.restoredWide.layoutVariant, 'dual');
  assert.equal(result.restoredWide.rightHidden, false);
  assert.deepEqual(
    [result.restoredWide.leftWidthVar, result.restoredWide.rightWidthVar],
    [330, 320],
    'desktop rail widths must restore after compact and mobile projections'
  );
  assert.equal(result.restoredWide.documentFits, true);
  assert.equal(result.restoredWide.bodyFits, true);
  assert.equal(result.leftRailSafeReset.reset.collapsed, false);
  assert.equal(result.leftRailSafeReset.reset.leftWidth, 290);
  assert.equal(result.leftRailSafeReset.reset.buttonExpanded, 'true');
  assert.equal(result.leftRailSafeReset.reset.stored.leftCollapsed, false);
  assert.equal(result.leftRailSafeReset.reset.stored.leftSidebarWidth, 290);
  assert.equal(result.leftRailSafeReset.productStateUnchanged, true);
  assert.equal(result.leftRailLastStable.transientWidth, 320);
  assert.deepEqual(result.leftRailLastStable.restored, { width: 290, storedWidth: 290 });
  assert.equal(result.leftRailLastStable.productStateUnchanged, true);
  assert.equal(result.screenshotBytes > 1000, true);
  assert.equal(result.sampledPixelValues > 1, true);
  assert.deepEqual(result.networkRequests, []);
} finally {
  if (!child.killed) child.kill('SIGKILL');
  await fs.rm(tempRoot, { recursive: true, force: true });
}

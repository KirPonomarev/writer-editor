import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const rootDir = path.resolve(new URL('../..', import.meta.url).pathname);
const requireFromHere = createRequire(import.meta.url);
const electronBinary = requireFromHere('electron');
const outputDir = process.env.VERTICAL_SHEET_TYPOGRAPHY_SCROLL_REFRESH_OUT_DIR
  ? path.resolve(process.env.VERTICAL_SHEET_TYPOGRAPHY_SCROLL_REFRESH_OUT_DIR)
  : await mkdtemp(path.join(os.tmpdir(), 'vertical-sheet-typography-scroll-refresh-'));

function buildHelperSource() {
  return `
const path = require('node:path');
const fs = require('node:fs/promises');
const { app, BrowserWindow, session } = require('electron');

const rootDir = ${JSON.stringify(rootDir)};
const outputDir = ${JSON.stringify(outputDir)};
const mainEntrypoint = path.join(rootDir, 'src', 'main' + '.js');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildLongText(unitCount) {
  const sentence = 'Typography scroll refresh proof paragraph that must remain page-backed after manual font changes.';
  return Array.from({ length: unitCount }, (_, index) => (
    sentence + ' ' + String(index + 1) + '.'
  )).join(' ');
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

async function setEditorContent(win) {
  win.webContents.send('editor:set-text', {
    content: buildLongText(260),
    title: 'vertical-sheet-typography-scroll-refresh',
    path: '',
    kind: 'chapter-file',
    metaEnabled: true,
    projectId: 'vertical-sheet-typography-scroll-refresh',
    bookProfile: null,
  });
}

async function collectState(win, label) {
  return win.webContents.executeJavaScript(\`(() => {
    const host = document.querySelector('#editor.tiptap-host');
    const strip = host ? host.querySelector('.tiptap-sheet-strip') : null;
    const prose = host ? host.querySelector('.ProseMirror') : null;
    const canvas = document.querySelector('.main-content--editor');
    const toPlainRect = (rect) => rect ? ({
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      left: rect.left,
    }) : null;
    const intersects = (a, b) => (
      a && b
      && a.left < b.right
      && a.right > b.left
      && a.top < b.bottom
      && a.bottom > b.top
    );
    const containsTextRect = (pageRect, textRect) => (
      pageRect && textRect
      && textRect.left >= pageRect.left - 1
      && textRect.right <= pageRect.right + 1
      && textRect.top >= pageRect.top - 1
      && textRect.bottom <= pageRect.bottom + 1
    );
    const pageWraps = strip ? [...strip.querySelectorAll(':scope > .tiptap-page-wrap')] : [];
    const pageRects = pageWraps.map((el) => toPlainRect(el.getBoundingClientRect())).filter(Boolean);
    const canvasRect = canvas ? toPlainRect(canvas.getBoundingClientRect()) : null;
    const visiblePageRects = canvasRect
      ? pageRects.filter((pageRect) => intersects(pageRect, canvasRect))
      : [];
    const textRects = [];
    if (prose) {
      const walker = document.createTreeWalker(prose, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          return node.textContent && node.textContent.trim()
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_SKIP;
        },
      });
      let current = walker.nextNode();
      while (current) {
        const range = document.createRange();
        range.selectNodeContents(current);
        [...range.getClientRects()].forEach((rect) => {
          textRects.push(toPlainRect(rect));
        });
        current = walker.nextNode();
      }
    }
    const visibleTextRects = canvasRect
      ? textRects.filter((textRect) => intersects(textRect, canvasRect))
      : [];
    const visibleTextOutsideSheetCount = visibleTextRects.filter((textRect) => (
      !visiblePageRects.some((pageRect) => containsTextRect(pageRect, textRect))
    )).length;
    return {
      label: \${JSON.stringify(label)},
      centralSheetFlow: host ? host.dataset.centralSheetFlow || null : null,
      renderedSheetCount: Number(host ? host.dataset.centralSheetCount || 0 : 0),
      totalPageCount: Number(host ? host.dataset.centralSheetTotalPageCount || 0 : 0),
      firstRenderedPage: Number(host ? host.dataset.centralSheetWindowFirstRenderedPage || 0 : 0),
      lastRenderedPage: Number(host ? host.dataset.centralSheetWindowLastRenderedPage || 0 : 0),
      visiblePageRectCount: visiblePageRects.length,
      visibleTextRectCount: visibleTextRects.length,
      visibleTextOutsideSheetCount,
      scrollTop: canvas instanceof HTMLElement ? canvas.scrollTop : 0,
      scrollHeight: canvas instanceof HTMLElement ? canvas.scrollHeight : 0,
      clientHeight: canvas instanceof HTMLElement ? canvas.clientHeight : 0,
      fontSize: host ? window.getComputedStyle(host).fontSize : '',
      proseMirrorCount: host ? host.querySelectorAll('.ProseMirror').length : 0,
      derivedSheetEditorCount: pageWraps.reduce((sum, el) => sum + el.querySelectorAll('.tiptap-editor').length, 0),
      derivedSheetProseMirrorCount: pageWraps.reduce((sum, el) => sum + el.querySelectorAll('.ProseMirror').length, 0),
    };
  })()\`, true);
}

async function waitForStableSheet(win, label, predicate) {
  let lastState = null;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    await sleep(100);
    const state = await collectState(win, label + '-' + String(attempt + 1));
    lastState = state;
    if (
      state.centralSheetFlow === 'vertical'
      && state.renderedSheetCount > 0
      && state.proseMirrorCount === 1
      && (!predicate || predicate(state))
    ) {
      return state;
    }
  }
  throw new Error('SHEET_STATE_NOT_STABLE_' + label + '_' + JSON.stringify(lastState));
}

async function setToolbarFontSize(win, px) {
  return win.webContents.executeJavaScript(\`(() => {
    const select = document.querySelector('[data-size-select]');
    if (!(select instanceof HTMLSelectElement)) {
      return { ok: false, reason: 'SIZE_SELECT_MISSING' };
    }
    const value = String(\${JSON.stringify(px)});
    if (![...select.options].some((option) => option.value === value)) {
      select.add(new Option(value, value));
    }
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return { ok: true, value: select.value };
  })()\`, true);
}

async function scrollEditorViewport(win, ratio) {
  return win.webContents.executeJavaScript(\`(() => {
    const canvas = document.querySelector('.main-content--editor');
    if (!(canvas instanceof HTMLElement)) {
      return { ok: false, reason: 'EDITOR_CANVAS_MISSING' };
    }
    const maxScrollTop = Math.max(0, canvas.scrollHeight - canvas.clientHeight);
    canvas.scrollTop = Math.round(maxScrollTop * \${JSON.stringify(ratio)});
    canvas.dispatchEvent(new Event('scroll', { bubbles: true }));
    return {
      ok: true,
      scrollTop: canvas.scrollTop,
      maxScrollTop,
      clientHeight: canvas.clientHeight,
      scrollHeight: canvas.scrollHeight,
    };
  })()\`, true);
}

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('force-device-scale-factor', '1');
app.commandLine.appendSwitch('high-dpi-support', '1');
app.setPath('appData', path.join(outputDir, 'app-data'));
app.setPath('userData', path.join(outputDir, 'app-data', 'craftsman'));

process.chdir(rootDir);
if (!process.argv.includes('--dev')) process.argv.push('--dev');
require(mainEntrypoint);

app.whenReady().then(async () => {
  try {
    session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
      callback({ cancel: false });
    });
    await fs.mkdir(outputDir, { recursive: true });
    const win = await waitForWindow();
    await waitForLoad(win);
    win.setContentSize(2048, 1180);
    await sleep(1000);
    const baselineFontResult = await setToolbarFontSize(win, 12);
    await setEditorContent(win);
    const beforeTypography = await waitForStableSheet(win, 'before-typography');
    const fontResult = await setToolbarFontSize(win, 28);
    const afterTypography = await waitForStableSheet(
      win,
      'after-typography',
      (state) => state.totalPageCount > beforeTypography.totalPageCount && state.fontSize === '28px',
    );
    const scrollResult = await scrollEditorViewport(win, 0.64);
    await sleep(300);
    const afterScroll = await collectState(win, 'after-scroll');
    await fs.writeFile(path.join(outputDir, 'result.json'), JSON.stringify({
      ok: true,
      baselineFontResult,
      beforeTypography,
      fontResult,
      afterTypography,
      scrollResult,
      afterScroll,
      outputDir,
    }, null, 2));
    app.exit(0);
  } catch (error) {
    await fs.writeFile(path.join(outputDir, 'result.json'), JSON.stringify({
      ok: false,
      error: error && error.stack ? error.stack : String(error),
      outputDir,
    }, null, 2));
    app.exit(1);
  }
});
`;
}

const helperPath = path.join(outputDir, 'vertical-sheet-typography-scroll-refresh-helper.cjs');
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
  }, 120000);
  child.on('exit', (code) => {
    clearTimeout(timer);
    resolve(typeof code === 'number' ? code : 1);
  });
});

const rawResult = await readFile(path.join(outputDir, 'result.json'), 'utf8');
const result = JSON.parse(rawResult);

assert.equal(exitCode, 0, `electron helper failed with ${exitCode}\n${stdout}\n${stderr}`);
assert.equal(result.ok, true, result.error || 'helper result must be ok');
assert.equal(result.baselineFontResult.ok, true);
assert.equal(result.fontResult.ok, true);
assert.equal(result.beforeTypography.centralSheetFlow, 'vertical');
assert.equal(result.afterTypography.centralSheetFlow, 'vertical');
assert.equal(result.beforeTypography.fontSize, '12px');
assert.equal(result.afterTypography.fontSize, '28px');
assert.equal(
  result.afterTypography.totalPageCount > result.beforeTypography.totalPageCount,
  true,
  `font size change must recompute page count: ${result.beforeTypography.totalPageCount} -> ${result.afterTypography.totalPageCount}`,
);
assert.equal(result.scrollResult.ok, true);
assert.equal(
  result.afterScroll.firstRenderedPage > result.afterTypography.firstRenderedPage,
  true,
  `scroll must advance rendered sheet window: ${result.afterTypography.firstRenderedPage} -> ${result.afterScroll.firstRenderedPage}`,
);
assert.equal(
  result.afterScroll.visiblePageRectCount > 0,
  true,
  `after scroll must show visible page shells, got ${result.afterScroll.visiblePageRectCount}`,
);
assert.equal(
  result.afterScroll.visibleTextRectCount > 0,
  true,
  `after scroll must show visible text, got ${result.afterScroll.visibleTextRectCount}`,
);
assert.equal(
  result.afterScroll.visibleTextOutsideSheetCount,
  0,
  `visible text must remain inside rendered sheets after typography scroll, got ${result.afterScroll.visibleTextOutsideSheetCount}`,
);
assert.equal(result.afterScroll.derivedSheetEditorCount, 0);
assert.equal(result.afterScroll.derivedSheetProseMirrorCount, 0);

console.log('VERTICAL_SHEET_TYPOGRAPHY_SCROLL_REFRESH_SUMMARY:' + JSON.stringify({
  ok: true,
  outputDir,
  beforeTotalPageCount: result.beforeTypography.totalPageCount,
  afterTotalPageCount: result.afterTypography.totalPageCount,
  afterScrollFirstRenderedPage: result.afterScroll.firstRenderedPage,
  afterScrollLastRenderedPage: result.afterScroll.lastRenderedPage,
  afterScrollVisiblePageRectCount: result.afterScroll.visiblePageRectCount,
  afterScrollVisibleTextRectCount: result.afterScroll.visibleTextRectCount,
  afterScrollVisibleTextOutsideSheetCount: result.afterScroll.visibleTextOutsideSheetCount,
}));

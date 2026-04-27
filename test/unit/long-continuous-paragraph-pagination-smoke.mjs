import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import fsSync from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const rootDir = path.resolve(new URL('../..', import.meta.url).pathname);
const requireFromHere = createRequire(import.meta.url);

function listSharedSearchRoots() {
  const parentDir = path.dirname(rootDir);
  const roots = [rootDir];
  const preferredSiblingRoots = [
    path.join(parentDir, 'writer-editor-codex'),
    path.join(parentDir, 'writer-editor-contour-07-verify-base-001'),
  ];
  for (const candidate of preferredSiblingRoots) {
    if (candidate !== rootDir && fsSync.existsSync(candidate)) {
      roots.push(candidate);
    }
  }
  try {
    const siblingRoots = fsSync.readdirSync(parentDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name.startsWith('writer-editor'))
      .map((entry) => path.join(parentDir, entry.name));
    for (const candidate of siblingRoots) {
      if (!roots.includes(candidate)) {
        roots.push(candidate);
      }
    }
  } catch {
    // Ignore sibling discovery failures and fall back to explicit roots only.
  }
  return roots;
}

function resolveElectronBinary() {
  for (const searchRoot of listSharedSearchRoots()) {
    try {
      const resolvedPath = requireFromHere.resolve('electron', { paths: [searchRoot] });
      return requireFromHere(resolvedPath);
    } catch {
      // Continue scanning sibling worktrees for shared toolchain installs.
    }
  }
  throw new Error('ELECTRON_MODULE_NOT_FOUND');
}

const electronBinary = resolveElectronBinary();
const outputDir = process.env.LONG_CONTINUOUS_PARAGRAPH_ORACLE_OUT_DIR
  ? path.resolve(process.env.LONG_CONTINUOUS_PARAGRAPH_ORACLE_OUT_DIR)
  : await mkdtemp(path.join(os.tmpdir(), 'long-continuous-paragraph-oracle-'));

function buildHelperSource() {
  return `
const path = require('node:path');
const fs = require('node:fs/promises');
const { app, BrowserWindow, dialog, session } = require('electron');

const rootDir = ${JSON.stringify(rootDir)};
const outputDir = ${JSON.stringify(outputDir)};
const mainEntrypoint = path.join(rootDir, 'src', 'main' + '.js');
const markerToken = 'LONG_PARAGRAPH_LATER_THAN_THIRD_SHEET_MARKER';
let networkRequests = 0;
let dialogCalls = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildLongContinuousParagraph(unitCount) {
  const sentenceA = 'Long continuous paragraph oracle sentence keeps deterministic prose flowing without paragraph breaks across derived vertical sheets.';
  const sentenceB = 'The oracle must prove later sheet visibility, page three occupancy, and zero editable derived surfaces with machine evidence.';
  const markerIndex = Math.max(12, Math.floor(unitCount * 0.82));
  const parts = [];
  for (let index = 0; index < unitCount; index += 1) {
    parts.push(sentenceA + ' Unit ' + String(index + 1) + '. ' + sentenceB + ' Sequence ' + String(index + 1) + '.');
    if (index === markerIndex) {
      parts.push(markerToken + ' unit-anchor-' + String(index + 1) + '.');
    }
  }
  return parts.join(' ');
}

function rectsIntersect(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function rectOverlapArea(a, b) {
  const left = Math.max(a.left, b.left);
  const right = Math.min(a.right, b.right);
  const top = Math.max(a.top, b.top);
  const bottom = Math.min(a.bottom, b.bottom);
  return Math.max(0, right - left) * Math.max(0, bottom - top);
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

async function setEditorPayload(win, unitCount) {
  win.webContents.send('editor:set-text', {
    content: buildLongContinuousParagraph(unitCount),
    title: 'long-continuous-paragraph-oracle',
    path: '',
    kind: 'chapter-file',
    metaEnabled: true,
    projectId: 'long-continuous-paragraph-oracle',
    bookProfile: null,
  });
}

async function saveFullCapture(win, basename) {
  const image = await win.webContents.capturePage();
  await fs.writeFile(path.join(outputDir, basename), image.toPNG());
}

async function saveCropCapture(win, cropRect, basename) {
  const image = await win.webContents.capturePage(cropRect);
  await fs.writeFile(path.join(outputDir, basename), image.toPNG());
}

async function collectState(win, label) {
  return win.webContents.executeJavaScript(\`(() => {
    const markerToken = \${JSON.stringify(markerToken)};
    const rectsIntersect = (a, b) => (
      a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
    );
    const rectOverlapArea = (a, b) => {
      const left = Math.max(a.left, b.left);
      const right = Math.min(a.right, b.right);
      const top = Math.max(a.top, b.top);
      const bottom = Math.min(a.bottom, b.bottom);
      return Math.max(0, right - left) * Math.max(0, bottom - top);
    };
    const host = document.querySelector('#editor.tiptap-host');
    const strip = host ? host.querySelector('.tiptap-sheet-strip') : null;
    const prose = host ? host.querySelector('.ProseMirror') : null;
    const canvas = document.querySelector('.main-content--editor');
    const pageWraps = strip ? [...strip.querySelectorAll(':scope > .tiptap-page-wrap')] : [];
    const toPlainRect = (rect) => rect ? ({
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
    }) : null;
    const canvasRect = canvas ? toPlainRect(canvas.getBoundingClientRect()) : null;
    const viewportRect = canvasRect || {
      left: 0,
      right: window.innerWidth || document.documentElement.clientWidth || 0,
      top: 0,
      bottom: window.innerHeight || document.documentElement.clientHeight || 0,
    };
    const isRectVisibleInViewport = (rect) => (
      rect
      && rect.left < viewportRect.right
      && rect.right > viewportRect.left
      && rect.top < viewportRect.bottom
      && rect.bottom > viewportRect.top
    );
    const sheetRects = pageWraps.map((el, index) => {
      const rect = toPlainRect(el.getBoundingClientRect());
      return rect ? {
        ...rect,
        index,
        offsetTop: el.offsetTop,
        offsetHeight: el.offsetHeight,
      } : null;
    }).filter(Boolean);
    const gapRects = sheetRects.slice(1).map((rect, index) => {
      const previous = sheetRects[index];
      return {
        left: previous.left,
        right: previous.right,
        top: previous.bottom,
        bottom: rect.top,
        width: previous.width,
        height: rect.top - previous.bottom,
      };
    });
    const walker = prose
      ? document.createTreeWalker(prose, NodeFilter.SHOW_TEXT, {
          acceptNode(node) {
            return node.textContent && node.textContent.trim()
              ? NodeFilter.FILTER_ACCEPT
              : NodeFilter.FILTER_SKIP;
          },
        })
      : null;
    const textRects = [];
    const markerRects = [];
    if (walker) {
      let current = walker.nextNode();
      while (current) {
        const range = document.createRange();
        range.selectNodeContents(current);
        [...range.getClientRects()].forEach((rect) => {
          textRects.push(toPlainRect(rect));
        });
        const text = current.textContent || '';
        let startIndex = text.indexOf(markerToken);
        while (startIndex !== -1) {
          const markerRange = document.createRange();
          markerRange.setStart(current, startIndex);
          markerRange.setEnd(current, startIndex + markerToken.length);
          [...markerRange.getClientRects()].forEach((rect) => {
            markerRects.push(toPlainRect(rect));
          });
          startIndex = text.indexOf(markerToken, startIndex + markerToken.length);
        }
        current = walker.nextNode();
      }
    }
    const visibleSheetRects = sheetRects.filter(isRectVisibleInViewport);
    const visibleTextRects = textRects.filter(isRectVisibleInViewport);
    const visibleMarkerRects = markerRects.filter(isRectVisibleInViewport);
    const visibleTextOutsideVisibleSheetRects = visibleTextRects.filter((textRect) => (
      !visibleSheetRects.some((sheetRect) => rectsIntersect(textRect, sheetRect))
    ));
    const visibleTextGapIntersectionCount = visibleTextRects.filter((textRect) => (
      gapRects.some((gapRect) => gapRect.height > 0 && rectsIntersect(textRect, gapRect))
    )).length;
    const pageTextRectCounts = sheetRects.map((sheetRect) => textRects.filter((textRect) => rectsIntersect(textRect, sheetRect)).length);
    const laterThanThirdSheetTextRectCount = sheetRects
      .filter((sheetRect) => sheetRect.index >= 3)
      .reduce((sum, sheetRect) => sum + textRects.filter((textRect) => rectsIntersect(textRect, sheetRect)).length, 0);
    const markerOverlapBySheet = sheetRects.map((sheetRect) => markerRects.reduce(
      (sum, markerRect) => sum + rectOverlapArea(markerRect, sheetRect),
      0
    ));
    const markerWinningSheets = markerOverlapBySheet
      .map((area, index) => ({ area, index }))
      .filter((item) => item.area === Math.max(0, ...markerOverlapBySheet))
      .filter((item) => item.area > 0);
    const markerSheetIndex = markerWinningSheets.length === 1 ? markerWinningSheets[0].index : -1;
    const markerMixedSheetOverlap = markerOverlapBySheet.filter((area) => area > 0).length > 1;
    const derivedSheetProseMirrorCount = pageWraps.reduce((sum, el) => sum + el.querySelectorAll('.ProseMirror').length, 0);
    const derivedSheetEditorCount = pageWraps.reduce((sum, el) => sum + el.querySelectorAll('.tiptap-editor').length, 0);
    const derivedSheetEditableSurfaceCount = pageWraps.reduce((sum, el) => sum + el.querySelectorAll('.ProseMirror, .tiptap-editor, [contenteditable="true"]').length, 0);
    const text = prose ? prose.textContent || '' : '';
    return {
      label: \${JSON.stringify(label)},
      centralSheetFlow: host ? host.dataset.centralSheetFlow || null : null,
      centralSheetCount: host ? host.dataset.centralSheetCount || null : null,
      centralSheetRenderedPageCount: host ? host.dataset.centralSheetRenderedPageCount || host.dataset.centralSheetCount || null : null,
      centralSheetTotalPageCount: host ? host.dataset.centralSheetTotalPageCount || host.dataset.centralSheetCount || null : null,
      centralSheetWindowingEnabled: host ? host.dataset.centralSheetWindowingEnabled || null : null,
      centralSheetWindowFirstRenderedPage: host ? host.dataset.centralSheetWindowFirstRenderedPage || null : null,
      centralSheetWindowLastRenderedPage: host ? host.dataset.centralSheetWindowLastRenderedPage || null : null,
      proofClass: Boolean(host && host.classList.contains('tiptap-host--central-sheet-strip-proof')),
      proseMirrorCount: host ? host.querySelectorAll('.ProseMirror').length : 0,
      tiptapEditorCount: host ? host.querySelectorAll('.tiptap-editor').length : 0,
      derivedSheetProseMirrorCount,
      derivedSheetEditorCount,
      derivedSheetEditableSurfaceCount,
      prosePageTruthCount: prose ? prose.querySelectorAll('[data-page-index], [data-page-number], [data-page-id]').length : 0,
      totalPageCount: Number(host ? (host.dataset.centralSheetTotalPageCount || host.dataset.centralSheetCount || sheetRects.length) : sheetRects.length),
      renderedPageCount: Number(host ? (host.dataset.centralSheetRenderedPageCount || host.dataset.centralSheetCount || sheetRects.length) : sheetRects.length),
      visibleSheetCount: visibleSheetRects.length,
      pageTextRectCounts,
      page3TextRectCount: pageTextRectCounts[2] || 0,
      laterThanThirdSheetTextRectCount,
      markerOccurrenceCount: (text.match(new RegExp(markerToken, 'gu')) || []).length,
      markerRectCount: markerRects.length,
      visibleMarkerRectCount: visibleMarkerRects.length,
      markerSheetIndex,
      markerMixedSheetOverlap,
      markerOverlapBySheet,
      visibleTextRectCount: visibleTextRects.length,
      visibleTextGapIntersectionCount,
      visibleTextOutsideVisibleSheetRectCount: visibleTextOutsideVisibleSheetRects.length,
      visibleTextOutsideVisibleSheetRects: visibleTextOutsideVisibleSheetRects.slice(0, 12),
      gapRects,
      sheetRects,
      markerRects,
      visibleMarkerRects,
      canvasRect,
      textLength: text.length,
      text,
    };
  })()\`, true);
}

async function waitForFixture(win) {
  let lastState = null;
  for (let unitCount = 120; unitCount <= 1800; unitCount += 60) {
    await setEditorPayload(win, unitCount);
    await sleep(700);
    const state = await collectState(win, 'fixture-' + String(unitCount));
    lastState = { unitCount, state };
    if (
      state.centralSheetFlow === 'vertical'
      && state.proofClass === true
      && state.totalPageCount > 3
      && state.page3TextRectCount > 0
      && state.laterThanThirdSheetTextRectCount > 0
      && state.markerOccurrenceCount === 1
      && state.markerSheetIndex >= 3
      && state.proseMirrorCount === 1
      && state.derivedSheetEditableSurfaceCount === 0
      && state.derivedSheetProseMirrorCount === 0
      && state.derivedSheetEditorCount === 0
      && state.prosePageTruthCount === 0
      && state.visibleTextGapIntersectionCount === 0
      && state.visibleTextOutsideVisibleSheetRectCount === 0
    ) {
      return { unitCount, state };
    }
  }
  throw new Error('LONG_PARAGRAPH_FIXTURE_NOT_FOUND ' + JSON.stringify(lastState));
}

async function scrollToSheetIndex(win, targetSheetIndex) {
  return win.webContents.executeJavaScript(\`(() => {
    const targetSheetIndex = \${JSON.stringify(3)};
    const host = document.querySelector('#editor.tiptap-host');
    const strip = host ? host.querySelector('.tiptap-sheet-strip') : null;
    const canvas = document.querySelector('.main-content--editor');
    const pageWraps = strip ? [...strip.querySelectorAll(':scope > .tiptap-page-wrap')] : [];
    const target = pageWraps[targetSheetIndex];
    if (!(target instanceof HTMLElement) || !(canvas instanceof HTMLElement)) {
      return { ok: false, reason: 'TARGET_SHEET_OR_CANVAS_MISSING', targetSheetIndex };
    }
    const nextScrollTop = Math.max(0, target.offsetTop - 48);
    canvas.scrollTop = nextScrollTop;
    return {
      ok: true,
      targetSheetIndex,
      scrollTop: canvas.scrollTop,
      scrollHeight: canvas.scrollHeight,
      clientHeight: canvas.clientHeight,
      targetOffsetTop: target.offsetTop,
    };
  })()\`, true);
}

function buildCropRectFromMarkerRects(markerRects, canvasRect) {
  const bounds = markerRects.reduce((acc, rect) => ({
    left: Math.min(acc.left, rect.left),
    top: Math.min(acc.top, rect.top),
    right: Math.max(acc.right, rect.right),
    bottom: Math.max(acc.bottom, rect.bottom),
  }), { left: Number.POSITIVE_INFINITY, top: Number.POSITIVE_INFINITY, right: 0, bottom: 0 });
  const margin = 24;
  const left = Math.max(0, Math.floor(bounds.left - margin));
  const top = Math.max(0, Math.floor(bounds.top - margin));
  const rightLimit = canvasRect ? Math.ceil(canvasRect.right) : Math.ceil(bounds.right + margin);
  const bottomLimit = canvasRect ? Math.ceil(canvasRect.bottom) : Math.ceil(bounds.bottom + margin);
  const right = Math.max(left + 32, Math.min(rightLimit, Math.ceil(bounds.right + margin)));
  const bottom = Math.max(top + 32, Math.min(bottomLimit, Math.ceil(bounds.bottom + margin)));
  return {
    x: left,
    y: top,
    width: Math.max(32, right - left),
    height: Math.max(32, bottom - top),
  };
}

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('force-device-scale-factor', '1');
app.commandLine.appendSwitch('high-dpi-support', '1');
app.setPath('userData', path.join(outputDir, 'user-data'));
for (const method of ['showOpenDialog', 'showSaveDialog', 'showMessageBox']) {
  dialog[method] = async () => {
    dialogCalls += 1;
    return { canceled: true };
  };
}

process.chdir(rootDir);
if (!process.argv.includes('--dev')) process.argv.push('--dev');
require(mainEntrypoint);

app.whenReady().then(async () => {
  try {
    session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
      if (/^(https?|wss?):/u.test(String(details.url || ''))) {
        networkRequests += 1;
      }
      callback({ cancel: false });
    });
    await fs.mkdir(outputDir, { recursive: true });
    const win = await waitForWindow();
    await waitForLoad(win);
    win.setContentSize(1720, 1110);
    await sleep(1200);

    const fixture = await waitForFixture(win);
    await setEditorPayload(win, fixture.unitCount);
    await sleep(900);
    const beforeScroll = await collectState(win, 'before-scroll');
    await saveFullCapture(win, 'long-paragraph-oracle-before.png');

    const scrollResult = await scrollToSheetIndex(win, 3);
    await sleep(900);
    const afterScroll = await collectState(win, 'after-scroll');
    await saveFullCapture(win, 'long-paragraph-oracle-after-scroll-beyond-third.png');

    if (afterScroll.visibleMarkerRectCount === 0) {
      throw new Error('MARKER_NOT_VISIBLE_AFTER_SCROLL ' + JSON.stringify(afterScroll));
    }

    const cropRect = buildCropRectFromMarkerRects(afterScroll.visibleMarkerRects, afterScroll.canvasRect);
    await saveCropCapture(win, cropRect, 'long-paragraph-oracle-later-than-third-sheet-crop.png');

    const payload = {
      ok: true,
      unitCount: fixture.unitCount,
      markerToken,
      fixture: fixture.state,
      beforeScroll,
      scrollResult,
      afterScroll,
      cropRect,
      networkRequests,
      dialogCalls,
      screenshots: [
        path.join(outputDir, 'long-paragraph-oracle-before.png'),
        path.join(outputDir, 'long-paragraph-oracle-after-scroll-beyond-third.png'),
        path.join(outputDir, 'long-paragraph-oracle-later-than-third-sheet-crop.png'),
      ],
    };
    await fs.writeFile(path.join(outputDir, 'result.json'), JSON.stringify(payload, null, 2));
    process.stdout.write('LONG_CONTINUOUS_PARAGRAPH_ORACLE_RESULT:' + JSON.stringify(payload) + '\\n');
    app.exit(0);
  } catch (error) {
    const payload = {
      ok: false,
      error: error && error.stack ? error.stack : String(error),
      networkRequests,
      dialogCalls,
    };
    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(path.join(outputDir, 'result.json'), JSON.stringify(payload, null, 2));
    process.stdout.write('LONG_CONTINUOUS_PARAGRAPH_ORACLE_RESULT:' + JSON.stringify(payload) + '\\n');
    app.exit(1);
  }
});
`;
}

const helperPath = path.join(outputDir, 'long-continuous-paragraph-oracle-helper.cjs');
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

const resultPath = path.join(outputDir, 'result.json');
const rawResult = await readFile(resultPath, 'utf8');
const result = JSON.parse(rawResult);

assert.equal(exitCode, 0, `electron helper failed with ${exitCode}\n${stdout}\n${stderr}`);
assert.equal(result.ok, true, result.error || 'LONG_CONTINUOUS_PARAGRAPH_ORACLE_FAILED');
assert.equal(result.fixture.totalPageCount > 3, true);
assert.equal(result.fixture.page3TextRectCount > 0, true);
assert.equal(result.fixture.laterThanThirdSheetTextRectCount > 0, true);
assert.equal(result.fixture.markerOccurrenceCount, 1);
assert.equal(result.fixture.markerSheetIndex >= 3, true);
assert.equal(result.fixture.visibleTextGapIntersectionCount, 0);
assert.equal(result.fixture.visibleTextOutsideVisibleSheetRectCount, 0);
assert.equal(result.fixture.proseMirrorCount, 1);
assert.equal(result.fixture.derivedSheetEditableSurfaceCount, 0);
assert.equal(result.fixture.derivedSheetProseMirrorCount, 0);
assert.equal(result.fixture.derivedSheetEditorCount, 0);
assert.equal(result.fixture.prosePageTruthCount, 0);
assert.equal(result.beforeScroll.visibleTextGapIntersectionCount, 0);
assert.equal(result.beforeScroll.visibleTextOutsideVisibleSheetRectCount, 0);
assert.equal(result.beforeScroll.proseMirrorCount, 1);
assert.equal(result.beforeScroll.derivedSheetEditableSurfaceCount, 0);
assert.equal(result.beforeScroll.page3TextRectCount > 0, true);
assert.equal(result.scrollResult.ok, true);
assert.equal(result.scrollResult.targetSheetIndex, 3);
assert.equal(Number(result.scrollResult.scrollTop) > 0, true);
assert.equal(result.afterScroll.visibleTextGapIntersectionCount, 0);
assert.equal(result.afterScroll.visibleTextOutsideVisibleSheetRectCount, 0);
assert.equal(result.afterScroll.proseMirrorCount, 1);
assert.equal(result.afterScroll.derivedSheetEditableSurfaceCount, 0);
assert.equal(result.afterScroll.derivedSheetProseMirrorCount, 0);
assert.equal(result.afterScroll.derivedSheetEditorCount, 0);
assert.equal(result.afterScroll.visibleMarkerRectCount > 0, true);
assert.equal(result.afterScroll.markerSheetIndex >= 3, true);
assert.equal(result.networkRequests, 0);
assert.equal(result.dialogCalls, 0);
assert.deepEqual(
  result.screenshots.map((filePath) => path.basename(filePath)),
  [
    'long-paragraph-oracle-before.png',
    'long-paragraph-oracle-after-scroll-beyond-third.png',
    'long-paragraph-oracle-later-than-third-sheet-crop.png',
  ]
);

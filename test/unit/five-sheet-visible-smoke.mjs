import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const rootDir = path.resolve(new URL('../..', import.meta.url).pathname);
const requireFromHere = createRequire(import.meta.url);
const electronBinary = requireFromHere('electron');
const outputDir = process.env.FIVE_SHEET_VISIBLE_OUT_DIR
  ? path.resolve(process.env.FIVE_SHEET_VISIBLE_OUT_DIR)
  : await mkdtemp(path.join(os.tmpdir(), '05bz-b1-five-visible-sheets-'));

function hashText(value) {
  return createHash('sha256').update(String(value)).digest('hex');
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
  const paragraph = 'Five visible sheet proof paragraph. This text must fill a derived central sheet strip without creating page truth or another editor.';
  return Array.from({ length: paragraphCount }, (_, index) => (
    paragraph + ' ' + String(index + 1) + '. ' + paragraph
  )).join('\\n\\n');
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
    title: 'five-sheet-visible-smoke',
    path: '',
    kind: 'chapter-file',
    metaEnabled: true,
    projectId: 'five-sheet-visible-smoke',
    bookProfile: null,
  });
}

async function saveCapture(win, basename) {
  const image = await win.webContents.capturePage();
  await fs.writeFile(path.join(outputDir, basename), image.toPNG());
}

async function collectState(win, label) {
  return win.webContents.executeJavaScript(\`(() => {
    const host = document.querySelector('#editor.tiptap-host');
    const canvas = document.querySelector('.main-content--editor');
    const strip = host ? host.querySelector('.tiptap-sheet-strip') : null;
    const prose = host ? host.querySelector('.ProseMirror') : null;
    const leftSidebar = document.querySelector('.sidebar--left');
    const rightSidebar = document.querySelector('[data-right-sidebar]');
    const pageWraps = strip ? [...strip.querySelectorAll(':scope > .tiptap-page-wrap')] : [];
    const pageRects = pageWraps.map((el) => {
      const rect = el.getBoundingClientRect();
      return {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
      };
    });
    const firstPageRect = pageRects[0] || null;
    const hostDomRect = host ? host.getBoundingClientRect() : null;
    const stripDomRect = strip ? strip.getBoundingClientRect() : null;
    const canvasDomRect = canvas ? canvas.getBoundingClientRect() : null;
    const leftSidebarDomRect = leftSidebar ? leftSidebar.getBoundingClientRect() : null;
    const hostRect = hostDomRect
      ? { x: hostDomRect.x, y: hostDomRect.y, width: hostDomRect.width, height: hostDomRect.height, left: hostDomRect.left, right: hostDomRect.right, top: hostDomRect.top, bottom: hostDomRect.bottom }
      : null;
    const stripRect = stripDomRect
      ? { x: stripDomRect.x, y: stripDomRect.y, width: stripDomRect.width, height: stripDomRect.height, left: stripDomRect.left, right: stripDomRect.right, top: stripDomRect.top, bottom: stripDomRect.bottom }
      : null;
    const canvasRect = canvasDomRect
      ? { x: canvasDomRect.x, y: canvasDomRect.y, width: canvasDomRect.width, height: canvasDomRect.height, left: canvasDomRect.left, right: canvasDomRect.right, top: canvasDomRect.top, bottom: canvasDomRect.bottom }
      : null;
    const leftSidebarRect = leftSidebarDomRect
      ? { x: leftSidebarDomRect.x, y: leftSidebarDomRect.y, width: leftSidebarDomRect.width, height: leftSidebarDomRect.height, left: leftSidebarDomRect.left, right: leftSidebarDomRect.right, top: leftSidebarDomRect.top, bottom: leftSidebarDomRect.bottom }
      : null;
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    const viewportVisibleSheetCount = pageRects.filter((rect) => (
      rect.x < viewportWidth
      && rect.x + rect.width > 0
      && rect.y < viewportHeight
      && rect.y + rect.height > 0
    )).length;
    const isRectVisibleInViewport = (rect) => (
      rect.x < viewportWidth
      && rect.x + rect.width > 0
      && rect.y < viewportHeight
      && rect.y + rect.height > 0
    );
    const viewportVisibleSheetRects = pageRects.filter(isRectVisibleInViewport);
    const rectsIntersect = (a, b) => (
      a.x < b.x + b.width
      && a.x + a.width > b.x
      && a.y < b.y + b.height
      && a.y + a.height > b.y
    );
    const rightSidebarRect = rightSidebar ? rightSidebar.getBoundingClientRect() : null;
    const walker = prose
      ? document.createTreeWalker(prose, NodeFilter.SHOW_TEXT, {
          acceptNode(node) {
            return node.textContent && node.textContent.trim()
              ? NodeFilter.FILTER_ACCEPT
              : NodeFilter.FILTER_SKIP;
          },
        })
      : null;
    const textNodes = [];
    if (walker) {
      let current = walker.nextNode();
      while (current) {
        textNodes.push(current);
        current = walker.nextNode();
      }
    }
    const textRects = [];
    textNodes.forEach((node) => {
      const range = document.createRange();
      range.selectNodeContents(node);
      [...range.getClientRects()].forEach((rect) => {
        textRects.push({ x: rect.x, y: rect.y, width: rect.width, height: rect.height });
      });
    });
    const occupiedSheetIndexes = new Set();
    pageRects.forEach((pageRect, pageIndex) => {
      if (textRects.some((rect) => (
        rect.x < pageRect.x + pageRect.width
        && rect.x + rect.width > pageRect.x
        && rect.y < pageRect.y + pageRect.height
        && rect.y + rect.height > pageRect.y
      ))) {
        occupiedSheetIndexes.add(pageIndex);
      }
    });
    const prosePageTruthCount = prose
      ? prose.querySelectorAll('[data-page-index], [data-page-number], [data-page-id]').length
      : 0;
    const visibleTextRects = textRects.filter(isRectVisibleInViewport);
    const visibleTextOutsideVisibleSheetRects = visibleTextRects.filter((rect) => (
      !viewportVisibleSheetRects.some((pageRect) => rectsIntersect(rect, pageRect))
    ));
    const centerX = (rect) => (rect ? rect.left + (rect.width / 2) : null);
    const sheetStackCenterX = centerX(firstPageRect);
    const canvasCenterX = centerX(canvasRect);
    const hostCenterX = centerX(hostRect);
    const stripCenterX = centerX(stripRect);
    const railGapCenterX = leftSidebarRect && rightSidebarRect
      ? (leftSidebarRect.right + rightSidebarRect.left) / 2
      : null;
    const sheetStackCanvasCenterDeltaPx = sheetStackCenterX !== null && canvasCenterX !== null
      ? Math.abs(sheetStackCenterX - canvasCenterX)
      : null;
    const sheetStackHostCenterDeltaPx = sheetStackCenterX !== null && hostCenterX !== null
      ? Math.abs(sheetStackCenterX - hostCenterX)
      : null;
    const stripCanvasCenterDeltaPx = stripCenterX !== null && canvasCenterX !== null
      ? Math.abs(stripCenterX - canvasCenterX)
      : null;
    const sheetStackRailGapCenterDeltaPx = sheetStackCenterX !== null && railGapCenterX !== null
      ? Math.abs(sheetStackCenterX - railGapCenterX)
      : null;
    const verticallyStackedSheetPairCount = pageRects.slice(1).filter((rect, index) => {
      const previous = pageRects[index];
      return previous
        && rect.y > previous.y + 24
        && Math.abs(rect.x - previous.x) <= 2;
    }).length;
    const rightFlowSheetPairCount = pageRects.slice(1).filter((rect, index) => {
      const previous = pageRects[index];
      return previous && rect.x > previous.x + 24;
    }).length;
    const centerTolerancePx = 10;
    return {
      label: \${JSON.stringify(label)},
      proofClass: Boolean(host && host.classList.contains('tiptap-host--central-sheet-strip-proof')),
      centralSheetCount: host ? host.dataset.centralSheetCount || null : null,
      centralSheetRenderedPageCount: host ? host.dataset.centralSheetRenderedPageCount || null : null,
      centralSheetTotalPageCount: host ? host.dataset.centralSheetTotalPageCount || null : null,
      centralSheetWindowFirstRenderedPage: host ? host.dataset.centralSheetWindowFirstRenderedPage || null : null,
      centralSheetWindowLastRenderedPage: host ? host.dataset.centralSheetWindowLastRenderedPage || null : null,
      centralSheetWindowVisiblePageCount: host ? host.dataset.centralSheetWindowVisiblePageCount || null : null,
      centralSheetWindowingEnabled: host ? host.dataset.centralSheetWindowingEnabled || null : null,
      centralSheetFlow: host ? host.dataset.centralSheetFlow || null : null,
      centralSheetOverflowReason: host ? host.dataset.centralSheetOverflowReason || null : null,
      centralSheetBoundedOverflowReason: host ? host.dataset.centralSheetBoundedOverflowReason || null : null,
      centralSheetBoundedOverflowSourcePageCount: host ? host.dataset.centralSheetBoundedOverflowSourcePageCount || null : null,
      centralSheetBoundedOverflowVisiblePageCount: host ? host.dataset.centralSheetBoundedOverflowVisiblePageCount || null : null,
      centralSheetBoundedOverflowHiddenPageCount: host ? host.dataset.centralSheetBoundedOverflowHiddenPageCount || null : null,
      text: prose ? prose.textContent || '' : '',
      visibleSheetCount: pageWraps.length,
      viewportVisibleSheetCount,
      visibleTextRectCount: visibleTextRects.length,
      visibleTextOutsideVisibleSheetRectCount: visibleTextOutsideVisibleSheetRects.length,
      verticallyStackedSheetPairCount,
      rightFlowSheetPairCount,
      occupiedSheetCount: occupiedSheetIndexes.size,
      proseMirrorCount: host ? host.querySelectorAll('.ProseMirror').length : 0,
      tiptapEditorCount: host ? host.querySelectorAll('.tiptap-editor').length : 0,
      prosePageTruthCount,
      activeElementInsideProse: Boolean(prose && (document.activeElement === prose || prose.contains(document.activeElement))),
      sheetStackCanvasCenterDeltaPx,
      sheetStackHostCenterDeltaPx,
      stripCanvasCenterDeltaPx,
      sheetStackRailGapCenterDeltaPx,
      centerTolerancePx,
      sheetStackCenteredInCanvas: sheetStackCanvasCenterDeltaPx !== null && sheetStackCanvasCenterDeltaPx <= centerTolerancePx,
      sheetStackCenteredInHost: sheetStackHostCenterDeltaPx !== null && sheetStackHostCenterDeltaPx <= centerTolerancePx,
      stripCenteredInCanvas: stripCanvasCenterDeltaPx !== null && stripCanvasCenterDeltaPx <= centerTolerancePx,
      sheetStackCenteredBetweenSidebars: sheetStackRailGapCenterDeltaPx !== null && sheetStackRailGapCenterDeltaPx <= centerTolerancePx,
      rightInspectorVisible: Boolean(rightSidebarRect && rightSidebarRect.width >= 280 && rightSidebarRect.height > 0),
      rightInspectorWidth: rightSidebarRect ? rightSidebarRect.width : 0,
      hostRect,
      stripRect,
      canvasRect,
      leftSidebarRect,
      pageRects,
    };
  })()\`, true);
}

async function focusEditorEnd(win) {
  return win.webContents.executeJavaScript(\`(() => {
    const host = document.querySelector('#editor.tiptap-host');
    const prose = host ? host.querySelector('.ProseMirror') : null;
    if (!prose) return { ok: false, reason: 'PROSEMIRROR_MISSING' };
    const range = document.createRange();
    range.selectNodeContents(prose);
    range.collapse(false);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    prose.focus();
    return {
      ok: true,
      activeElementInsideProse: document.activeElement === prose || prose.contains(document.activeElement),
      proseMirrorCount: host.querySelectorAll('.ProseMirror').length,
      tiptapEditorCount: host.querySelectorAll('.tiptap-editor').length,
    };
  })()\`, true);
}

async function scrollEditorViewportToBottom(win) {
  return win.webContents.executeJavaScript(\`(() => {
    const canvas = document.querySelector('.main-content--editor');
    if (!canvas) {
      return { ok: false, reason: 'EDITOR_CANVAS_MISSING' };
    }
    const nextScrollTop = Math.max(0, canvas.scrollHeight - canvas.clientHeight - 24);
    canvas.scrollTop = nextScrollTop;
    return {
      ok: true,
      scrollTop: canvas.scrollTop,
      scrollHeight: canvas.scrollHeight,
      clientHeight: canvas.clientHeight,
    };
  })()\`, true);
}

async function findFiveSheetFixture(win) {
  let lastState = null;
  for (let paragraphCount = 1; paragraphCount <= 40; paragraphCount += 1) {
    await setEditorPayload(win, paragraphCount);
    await sleep(500);
    const state = await collectState(win, 'candidate-' + String(paragraphCount));
    lastState = state;
    const renderedPageCount = Number(state.centralSheetRenderedPageCount || state.centralSheetCount);
    const totalPageCount = Number(state.centralSheetTotalPageCount || state.centralSheetCount);
    const hasBoundedOverflow = totalPageCount > renderedPageCount;
    if (
      state.centralSheetFlow === 'vertical'
      && totalPageCount >= 5
      && renderedPageCount >= 3
      && renderedPageCount <= 15
      && state.centralSheetWindowingEnabled === 'true'
      && state.visibleSheetCount === renderedPageCount
      && state.verticallyStackedSheetPairCount === Math.max(0, renderedPageCount - 1)
      && state.rightFlowSheetPairCount === 0
      && state.occupiedSheetCount >= Math.min(2, renderedPageCount)
      && state.centralSheetOverflowReason === null
      && (hasBoundedOverflow
        ? (
          state.centralSheetBoundedOverflowReason === 'max-page-count'
          && Number(state.centralSheetBoundedOverflowSourcePageCount) >= totalPageCount
          && Number(state.centralSheetBoundedOverflowVisiblePageCount) === renderedPageCount
          && Number(state.centralSheetBoundedOverflowHiddenPageCount) >= 1
        )
        : state.centralSheetBoundedOverflowReason === null)
      && state.proseMirrorCount === 1
      && state.tiptapEditorCount === 1
      && state.prosePageTruthCount === 0
    ) {
      return { paragraphCount, state };
    }
  }
  throw new Error('NO_FIVE_VISIBLE_SHEET_FIXTURE ' + JSON.stringify(lastState));
}

async function findLongDocumentWindowFixture(win) {
  let lastState = null;
  for (let paragraphCount = 20; paragraphCount <= 64; paragraphCount += 2) {
    await setEditorPayload(win, paragraphCount);
    await sleep(500);
    const state = await collectState(win, 'window-candidate-' + String(paragraphCount));
    lastState = state;
    const totalPageCount = Number(state.centralSheetTotalPageCount);
    const renderedPageCount = Number(state.centralSheetRenderedPageCount);
    if (
      state.centralSheetFlow === 'vertical'
      && totalPageCount >= 16
      && renderedPageCount >= 1
      && renderedPageCount <= 15
      && state.centralSheetWindowingEnabled === 'true'
      && state.centralSheetBoundedOverflowReason === 'max-page-count'
      && Number(state.centralSheetBoundedOverflowSourcePageCount) >= totalPageCount
      && Number(state.centralSheetBoundedOverflowVisiblePageCount) === renderedPageCount
      && Number(state.centralSheetBoundedOverflowHiddenPageCount) >= 1
      && Number(state.centralSheetWindowFirstRenderedPage) >= 1
      && Number(state.centralSheetWindowLastRenderedPage) >= Number(state.centralSheetWindowFirstRenderedPage)
      && state.proseMirrorCount === 1
      && state.tiptapEditorCount === 1
      && state.prosePageTruthCount === 0
    ) {
      return { paragraphCount, state };
    }
  }
  throw new Error('NO_LONG_DOCUMENT_WINDOW_FIXTURE ' + JSON.stringify(lastState));
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
    win.setContentSize(3840, 1110);
    await sleep(1200);
    const fixture = await findFiveSheetFixture(win);
    const longDocumentWindowFixture = await findLongDocumentWindowFixture(win);
    await setEditorPayload(win, fixture.paragraphCount);
    await sleep(800);
    const beforeInput = await collectState(win, 'before-input');
    await saveCapture(win, '05bz-b1-five-visible-before-input.png');
    const focus = await focusEditorEnd(win);
    await win.webContents.insertText(' 05bzB1');
    await sleep(800);
    const afterInput = await collectState(win, 'after-input');
    await saveCapture(win, '05bz-b1-five-visible-after-input.png');
    await setEditorPayload(win, longDocumentWindowFixture.paragraphCount);
    await sleep(800);
    const longDocumentWindowBeforeScroll = await collectState(win, 'long-window-before-scroll');
    const longDocumentWindowScroll = await scrollEditorViewportToBottom(win);
    await sleep(900);
    const longDocumentWindowAfterScroll = await collectState(win, 'long-window-after-scroll');
    const payload = {
      ok: true,
      paragraphCount: fixture.paragraphCount,
      fixture: fixture.state,
      longDocumentWindowFixture,
      longDocumentWindowBeforeScroll,
      longDocumentWindowScroll,
      longDocumentWindowAfterScroll,
      beforeInput,
      focus,
      afterInput,
      marker: '05bzB1',
      networkRequests,
      dialogCalls,
      screenshots: [
        path.join(outputDir, '05bz-b1-five-visible-before-input.png'),
        path.join(outputDir, '05bz-b1-five-visible-after-input.png'),
      ],
    };
    await fs.writeFile(path.join(outputDir, 'result.json'), JSON.stringify(payload, null, 2));
    process.stdout.write('FIVE_SHEET_VISIBLE_SMOKE_RESULT:' + JSON.stringify(payload) + '\\n');
    app.exit(0);
  } catch (error) {
    const payload = { ok: false, error: error && error.stack ? error.stack : String(error), networkRequests, dialogCalls };
    await fs.writeFile(path.join(outputDir, 'result.json'), JSON.stringify(payload, null, 2));
    process.stdout.write('FIVE_SHEET_VISIBLE_SMOKE_RESULT:' + JSON.stringify(payload) + '\\n');
    app.exit(1);
  }
});
`;
}

const helperPath = path.join(outputDir, 'five-sheet-visible-helper.cjs');
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
assert.equal(result.ok, true);
const fixtureRenderedPageCount = Number(result.fixture.centralSheetRenderedPageCount || result.fixture.centralSheetCount);
const fixtureTotalPageCount = Number(result.fixture.centralSheetTotalPageCount || result.fixture.centralSheetCount);
const fixtureHasBoundedOverflow = fixtureTotalPageCount > fixtureRenderedPageCount;
assert.equal(result.fixture.centralSheetFlow, 'vertical');
assert.equal(fixtureRenderedPageCount >= 3, true);
assert.equal(fixtureRenderedPageCount <= 15, true);
assert.equal(fixtureTotalPageCount >= 5, true);
assert.equal(result.fixture.visibleSheetCount, fixtureRenderedPageCount);
assert.equal(result.fixture.verticallyStackedSheetPairCount, Math.max(0, fixtureRenderedPageCount - 1));
assert.equal(result.fixture.rightFlowSheetPairCount, 0);
assert.equal(result.fixture.occupiedSheetCount >= Math.min(2, fixtureRenderedPageCount), true);
assert.equal(result.fixture.centralSheetOverflowReason, null);
assert.equal(
  fixtureHasBoundedOverflow
    ? result.fixture.centralSheetBoundedOverflowReason === 'max-page-count'
    : result.fixture.centralSheetBoundedOverflowReason === null,
  true,
);
assert.equal(result.fixture.proseMirrorCount, 1);
assert.equal(result.fixture.tiptapEditorCount, 1);
assert.equal(result.fixture.prosePageTruthCount, 0);
assert.equal(result.fixture.centralSheetWindowingEnabled, 'true');
const beforeRenderedPageCount = Number(result.beforeInput.centralSheetRenderedPageCount || result.beforeInput.centralSheetCount);
const beforeTotalPageCount = Number(result.beforeInput.centralSheetTotalPageCount || result.beforeInput.centralSheetCount);
const beforeHasBoundedOverflow = beforeTotalPageCount > beforeRenderedPageCount;
assert.equal(result.beforeInput.centralSheetFlow, 'vertical');
assert.equal(result.beforeInput.visibleSheetCount, beforeRenderedPageCount);
assert.equal(result.beforeInput.viewportVisibleSheetCount >= 1, true);
assert.equal(result.beforeInput.visibleTextOutsideVisibleSheetRectCount, 0);
assert.equal(result.beforeInput.sheetStackCenteredInCanvas, true);
assert.equal(result.beforeInput.sheetStackCenteredInHost, true);
assert.equal(result.beforeInput.stripCenteredInCanvas, true);
assert.equal(result.beforeInput.sheetStackCenteredBetweenSidebars, true);
assert.equal(result.beforeInput.verticallyStackedSheetPairCount, Math.max(0, beforeRenderedPageCount - 1));
assert.equal(result.beforeInput.rightFlowSheetPairCount, 0);
assert.equal(result.beforeInput.occupiedSheetCount >= Math.min(2, beforeRenderedPageCount), true);
assert.equal(result.beforeInput.centralSheetOverflowReason, null);
assert.equal(
  beforeHasBoundedOverflow
    ? result.beforeInput.centralSheetBoundedOverflowReason === 'max-page-count'
    : result.beforeInput.centralSheetBoundedOverflowReason === null,
  true,
);
assert.equal(result.beforeInput.proseMirrorCount, 1);
assert.equal(result.beforeInput.tiptapEditorCount, 1);
assert.equal(result.beforeInput.prosePageTruthCount, 0);
assert.equal(result.beforeInput.rightInspectorVisible, true);
assert.equal(hashText(result.beforeInput.text), hashText(result.fixture.text));
assert.equal(result.focus.ok, true);
assert.equal(result.focus.activeElementInsideProse, true);
const afterRenderedPageCount = Number(result.afterInput.centralSheetRenderedPageCount || result.afterInput.centralSheetCount);
const afterTotalPageCount = Number(result.afterInput.centralSheetTotalPageCount || result.afterInput.centralSheetCount);
const afterHasBoundedOverflow = afterTotalPageCount > afterRenderedPageCount;
assert.equal(result.afterInput.centralSheetFlow, 'vertical');
assert.equal(result.afterInput.visibleSheetCount, afterRenderedPageCount);
assert.equal(result.afterInput.viewportVisibleSheetCount >= 1, true);
assert.equal(result.afterInput.visibleTextOutsideVisibleSheetRectCount <= 6, true);
assert.equal(result.afterInput.sheetStackCenteredInCanvas, true);
assert.equal(result.afterInput.sheetStackCenteredInHost, true);
assert.equal(result.afterInput.stripCenteredInCanvas, true);
assert.equal(result.afterInput.sheetStackCenteredBetweenSidebars, true);
assert.equal(result.afterInput.verticallyStackedSheetPairCount, Math.max(0, afterRenderedPageCount - 1));
assert.equal(result.afterInput.rightFlowSheetPairCount, 0);
assert.equal(result.afterInput.occupiedSheetCount >= Math.min(2, afterRenderedPageCount), true);
assert.equal(result.afterInput.centralSheetOverflowReason, null);
assert.equal(
  afterHasBoundedOverflow
    ? result.afterInput.centralSheetBoundedOverflowReason === 'max-page-count'
    : result.afterInput.centralSheetBoundedOverflowReason === null,
  true,
);
assert.equal(result.afterInput.proseMirrorCount, 1);
assert.equal(result.afterInput.tiptapEditorCount, 1);
assert.equal(result.afterInput.prosePageTruthCount, 0);
assert.equal(result.afterInput.activeElementInsideProse, true);
assert.equal(result.afterInput.rightInspectorVisible, true);
assert.equal((result.afterInput.text.match(/05bzB1/gu) || []).length, 1);
assert.equal(result.networkRequests, 0);
assert.equal(result.dialogCalls, 0);
assert.equal(result.longDocumentWindowFixture.state.centralSheetFlow, 'vertical');
assert.equal(Number(result.longDocumentWindowFixture.state.centralSheetTotalPageCount) >= 16, true);
assert.equal(Number(result.longDocumentWindowFixture.state.centralSheetRenderedPageCount) <= 15, true);
assert.equal(result.longDocumentWindowFixture.state.centralSheetWindowingEnabled, 'true');
assert.equal(result.longDocumentWindowFixture.state.centralSheetBoundedOverflowReason, 'max-page-count');
assert.equal(
  Number(result.longDocumentWindowFixture.state.centralSheetBoundedOverflowSourcePageCount)
    > Number(result.longDocumentWindowFixture.state.centralSheetBoundedOverflowVisiblePageCount),
  true,
);
assert.equal(Number(result.longDocumentWindowFixture.state.centralSheetBoundedOverflowHiddenPageCount) >= 1, true);
assert.equal(result.longDocumentWindowFixture.state.proseMirrorCount, 1);
assert.equal(result.longDocumentWindowFixture.state.tiptapEditorCount, 1);
assert.equal(result.longDocumentWindowFixture.state.prosePageTruthCount, 0);
assert.equal(result.longDocumentWindowBeforeScroll.centralSheetWindowingEnabled, 'true');
assert.equal(Number(result.longDocumentWindowBeforeScroll.centralSheetRenderedPageCount) <= 15, true);
assert.equal(Number(result.longDocumentWindowBeforeScroll.centralSheetWindowFirstRenderedPage) >= 1, true);
assert.equal(result.longDocumentWindowScroll.ok, true);
assert.equal(Number(result.longDocumentWindowScroll.scrollTop) > 0, true);
assert.equal(result.longDocumentWindowAfterScroll.centralSheetWindowingEnabled, 'true');
assert.equal(Number(result.longDocumentWindowAfterScroll.centralSheetTotalPageCount) >= 16, true);
assert.equal(Number(result.longDocumentWindowAfterScroll.centralSheetRenderedPageCount) <= 15, true);
assert.equal(
  Number(result.longDocumentWindowAfterScroll.centralSheetWindowFirstRenderedPage)
    > Number(result.longDocumentWindowBeforeScroll.centralSheetWindowFirstRenderedPage),
  true,
);
assert.equal(
  Number(result.longDocumentWindowAfterScroll.centralSheetWindowLastRenderedPage)
    >= Number(result.longDocumentWindowAfterScroll.centralSheetWindowFirstRenderedPage),
  true,
);
assert.equal(result.longDocumentWindowAfterScroll.proseMirrorCount, 1);
assert.equal(result.longDocumentWindowAfterScroll.tiptapEditorCount, 1);
assert.equal(result.longDocumentWindowAfterScroll.prosePageTruthCount, 0);

const summary = {
  ok: true,
  outputDir,
  paragraphCount: result.paragraphCount,
  centralSheetFlow: result.afterInput.centralSheetFlow,
  visibleSheetCount: result.afterInput.visibleSheetCount,
  viewportVisibleSheetCount: result.afterInput.viewportVisibleSheetCount,
  visibleTextRectCount: result.afterInput.visibleTextRectCount,
  visibleTextOutsideVisibleSheetRectCount: result.afterInput.visibleTextOutsideVisibleSheetRectCount,
  sheetStackCanvasCenterDeltaPx: result.afterInput.sheetStackCanvasCenterDeltaPx,
  sheetStackHostCenterDeltaPx: result.afterInput.sheetStackHostCenterDeltaPx,
  stripCanvasCenterDeltaPx: result.afterInput.stripCanvasCenterDeltaPx,
  sheetStackRailGapCenterDeltaPx: result.afterInput.sheetStackRailGapCenterDeltaPx,
  boundedOverflowReason: result.afterInput.centralSheetBoundedOverflowReason,
  boundedOverflowSourcePageCount: result.afterInput.centralSheetBoundedOverflowSourcePageCount,
  boundedOverflowVisiblePageCount: result.afterInput.centralSheetBoundedOverflowVisiblePageCount,
  boundedOverflowHiddenPageCount: result.afterInput.centralSheetBoundedOverflowHiddenPageCount,
  verticallyStackedSheetPairCount: result.afterInput.verticallyStackedSheetPairCount,
  rightFlowSheetPairCount: result.afterInput.rightFlowSheetPairCount,
  occupiedSheetCount: result.afterInput.occupiedSheetCount,
  proseMirrorCount: result.afterInput.proseMirrorCount,
  tiptapEditorCount: result.afterInput.tiptapEditorCount,
  prosePageTruthCount: result.afterInput.prosePageTruthCount,
  activeElementInsideProse: result.afterInput.activeElementInsideProse,
  rightInspectorVisible: result.afterInput.rightInspectorVisible,
  typedMarkerOccurrences: (result.afterInput.text.match(/05bzB1/gu) || []).length,
  networkRequests: result.networkRequests,
  dialogCalls: result.dialogCalls,
  longDocumentWindowFixtureParagraphCount: result.longDocumentWindowFixture.paragraphCount,
  longDocumentWindowFixtureTotalPageCount: result.longDocumentWindowFixture.state.centralSheetTotalPageCount,
  longDocumentWindowFixtureRenderedPageCount: result.longDocumentWindowFixture.state.centralSheetRenderedPageCount,
  longDocumentWindowFirstRenderedPage: result.longDocumentWindowFixture.state.centralSheetWindowFirstRenderedPage,
  longDocumentWindowLastRenderedPage: result.longDocumentWindowFixture.state.centralSheetWindowLastRenderedPage,
  longDocumentWindowVisiblePageCount: result.longDocumentWindowFixture.state.centralSheetWindowVisiblePageCount,
  longDocumentWindowingEnabled: result.longDocumentWindowFixture.state.centralSheetWindowingEnabled,
  longDocumentBoundedOverflowReason: result.longDocumentWindowFixture.state.centralSheetBoundedOverflowReason,
  longDocumentBoundedOverflowSourcePageCount: result.longDocumentWindowFixture.state.centralSheetBoundedOverflowSourcePageCount,
  longDocumentBoundedOverflowVisiblePageCount: result.longDocumentWindowFixture.state.centralSheetBoundedOverflowVisiblePageCount,
  longDocumentBoundedOverflowHiddenPageCount: result.longDocumentWindowFixture.state.centralSheetBoundedOverflowHiddenPageCount,
  longDocumentScrollTop: result.longDocumentWindowScroll.scrollTop,
  longDocumentScrollHeight: result.longDocumentWindowScroll.scrollHeight,
  longDocumentScrollClientHeight: result.longDocumentWindowScroll.clientHeight,
  longDocumentBeforeFirstRenderedPage: result.longDocumentWindowBeforeScroll.centralSheetWindowFirstRenderedPage,
  longDocumentAfterFirstRenderedPage: result.longDocumentWindowAfterScroll.centralSheetWindowFirstRenderedPage,
  longDocumentAfterLastRenderedPage: result.longDocumentWindowAfterScroll.centralSheetWindowLastRenderedPage,
  screenshots: result.screenshots,
};

console.log('FIVE_SHEET_VISIBLE_SMOKE_SUMMARY:' + JSON.stringify(summary));

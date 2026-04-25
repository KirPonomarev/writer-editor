import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const rootDir = path.resolve(new URL('../..', import.meta.url).pathname);
const requireFromHere = createRequire(import.meta.url);
const electronBinary = requireFromHere('electron');
const outputDir = process.env.TWO_SHEET_FEED_OUT_DIR
  ? path.resolve(process.env.TWO_SHEET_FEED_OUT_DIR)
  : await mkdtemp(path.join(os.tmpdir(), '05bz-a-two-sheet-feed-'));

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
let networkRequests = 0;
let dialogCalls = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildPlainText(paragraphCount) {
  const paragraph = 'Two sheet feed proof paragraph. This text must cross the first sheet boundary and continue on the second visible sheet while remaining inside one TipTap editor and one document truth.';
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
    title: 'two-sheet-feed-smoke',
    path: '',
    kind: 'chapter-file',
    metaEnabled: true,
    projectId: 'two-sheet-feed-smoke',
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
    const secondPageRect = pageRects[1] || null;
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
    const horizontalGapTextRects = firstPageRect && secondPageRect
      ? textRects.filter((rect) => (
          rect.x > firstPageRect.x + firstPageRect.width
          && rect.x + rect.width < secondPageRect.x
        ))
      : [];
    const verticalGapTextRects = firstPageRect && secondPageRect
      ? textRects.filter((rect) => (
          rect.y > firstPageRect.y + firstPageRect.height
          && rect.y + rect.height < secondPageRect.y
        ))
      : [];
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
    return {
      label: \${JSON.stringify(label)},
      proofClass: Boolean(host && host.classList.contains('tiptap-host--central-sheet-strip-proof')),
      centralSheetFlow: host ? host.dataset.centralSheetFlow || null : null,
      centralSheetOverflowReason: host ? host.dataset.centralSheetOverflowReason || null : null,
      text: prose ? prose.textContent || '' : '',
      visibleSheetCount: pageWraps.length,
      viewportVisibleSheetCount: viewportVisibleSheetRects.length,
      occupiedSheetCount: occupiedSheetIndexes.size,
      secondSheetBelow: Boolean(firstPageRect && secondPageRect && secondPageRect.y > firstPageRect.y + 24),
      secondSheetRightOfFirst: Boolean(firstPageRect && secondPageRect && secondPageRect.x > firstPageRect.x + 24),
      horizontalGapTextRectsCount: horizontalGapTextRects.length,
      verticalGapTextRectsCount: verticalGapTextRects.length,
      visibleTextRectCount: visibleTextRects.length,
      visibleTextOutsideVisibleSheetRectCount: visibleTextOutsideVisibleSheetRects.length,
      proseMirrorCount: host ? host.querySelectorAll('.ProseMirror').length : 0,
      tiptapEditorCount: host ? host.querySelectorAll('.tiptap-editor').length : 0,
      activeElementInsideProse: Boolean(prose && (document.activeElement === prose || prose.contains(document.activeElement))),
      sheetStackCanvasCenterDeltaPx,
      sheetStackHostCenterDeltaPx,
      stripCanvasCenterDeltaPx,
      sheetStackRailGapCenterDeltaPx,
      sheetStackCenteredInCanvas: sheetStackCanvasCenterDeltaPx !== null && sheetStackCanvasCenterDeltaPx <= 1,
      sheetStackCenteredInHost: sheetStackHostCenterDeltaPx !== null && sheetStackHostCenterDeltaPx <= 1,
      stripCenteredInCanvas: stripCanvasCenterDeltaPx !== null && stripCanvasCenterDeltaPx <= 1,
      sheetStackCenteredBetweenSidebars: sheetStackRailGapCenterDeltaPx !== null && sheetStackRailGapCenterDeltaPx <= 1,
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
    };
  })()\`, true);
}

async function findTwoSheetFixture(win) {
  let lastState = null;
  for (let paragraphCount = 1; paragraphCount <= 12; paragraphCount += 1) {
    await setEditorPayload(win, paragraphCount);
    await sleep(650);
    const state = await collectState(win, 'candidate-' + String(paragraphCount));
    lastState = state;
    if (
      state.centralSheetFlow === 'vertical'
      && state.visibleSheetCount >= 2
      && state.occupiedSheetCount >= 2
      && state.secondSheetBelow
      && !state.secondSheetRightOfFirst
      && state.proseMirrorCount === 1
      && state.tiptapEditorCount === 1
      && state.verticalGapTextRectsCount === 0
    ) {
      return { paragraphCount, state };
    }
  }
  throw new Error('NO_TWO_SHEET_FIXTURE ' + JSON.stringify(lastState));
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
require(path.join(rootDir, 'src', 'main.js'));

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
    win.setContentSize(2048, 1110);
    await sleep(1200);
    const fixture = await findTwoSheetFixture(win);
    await setEditorPayload(win, fixture.paragraphCount);
    await sleep(800);
    const beforeInput = await collectState(win, 'before-input');
    await saveCapture(win, '05bz-a-two-sheet-before-input.png');
    const focus = await focusEditorEnd(win);
    await win.webContents.insertText(' 05bzA');
    await sleep(800);
    const afterInput = await collectState(win, 'after-input');
    await saveCapture(win, '05bz-a-two-sheet-after-input.png');
    const payload = {
      ok: true,
      paragraphCount: fixture.paragraphCount,
      fixture: fixture.state,
      beforeInput,
      focus,
      afterInput,
      marker: '05bzA',
      networkRequests,
      dialogCalls,
      screenshots: [
        path.join(outputDir, '05bz-a-two-sheet-before-input.png'),
        path.join(outputDir, '05bz-a-two-sheet-after-input.png'),
      ],
    };
    await fs.writeFile(path.join(outputDir, 'result.json'), JSON.stringify(payload, null, 2));
    process.stdout.write('TWO_SHEET_FEED_SMOKE_RESULT:' + JSON.stringify(payload) + '\\n');
    app.exit(0);
  } catch (error) {
    const payload = { ok: false, error: error && error.stack ? error.stack : String(error), networkRequests, dialogCalls };
    await fs.writeFile(path.join(outputDir, 'result.json'), JSON.stringify(payload, null, 2));
    process.stdout.write('TWO_SHEET_FEED_SMOKE_RESULT:' + JSON.stringify(payload) + '\\n');
    app.exit(1);
  }
});
`;
}

const helperPath = path.join(outputDir, 'two-sheet-feed-helper.cjs');
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
  }, 45000);
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
assert.equal(result.fixture.visibleSheetCount >= 2, true);
assert.equal(result.fixture.occupiedSheetCount >= 2, true);
assert.equal(result.fixture.proseMirrorCount, 1);
assert.equal(result.fixture.tiptapEditorCount, 1);
assert.equal(result.fixture.centralSheetFlow, 'vertical');
assert.equal(result.fixture.secondSheetBelow, true);
assert.equal(result.fixture.secondSheetRightOfFirst, false);
assert.equal(result.fixture.verticalGapTextRectsCount, 0);
assert.equal(result.beforeInput.visibleSheetCount >= 2, true);
assert.equal(result.beforeInput.viewportVisibleSheetCount >= 1, true);
assert.equal(result.beforeInput.centralSheetFlow, 'vertical');
assert.equal(result.beforeInput.secondSheetBelow, true);
assert.equal(result.beforeInput.secondSheetRightOfFirst, false);
assert.equal(result.beforeInput.verticalGapTextRectsCount, 0);
assert.equal(result.beforeInput.visibleTextOutsideVisibleSheetRectCount, 0);
assert.equal(result.beforeInput.sheetStackCenteredInCanvas, true);
assert.equal(result.beforeInput.sheetStackCenteredInHost, true);
assert.equal(result.beforeInput.stripCenteredInCanvas, true);
assert.equal(result.beforeInput.sheetStackCenteredBetweenSidebars, true);
assert.equal(result.beforeInput.proseMirrorCount, 1);
assert.equal(result.beforeInput.rightInspectorVisible, true);
assert.equal(hashText(result.beforeInput.text), hashText(result.fixture.text));
assert.equal(result.focus.ok, true);
assert.equal(result.focus.activeElementInsideProse, true);
assert.equal(result.afterInput.visibleSheetCount >= 2, true);
assert.equal(result.afterInput.viewportVisibleSheetCount >= 1, true);
assert.equal(result.afterInput.centralSheetFlow, 'vertical');
assert.equal(result.afterInput.secondSheetBelow, true);
assert.equal(result.afterInput.secondSheetRightOfFirst, false);
assert.equal(result.afterInput.verticalGapTextRectsCount, 0);
assert.equal(result.afterInput.visibleTextOutsideVisibleSheetRectCount, 0);
assert.equal(result.afterInput.sheetStackCenteredInCanvas, true);
assert.equal(result.afterInput.sheetStackCenteredInHost, true);
assert.equal(result.afterInput.stripCenteredInCanvas, true);
assert.equal(result.afterInput.sheetStackCenteredBetweenSidebars, true);
assert.equal(result.afterInput.proseMirrorCount, 1);
assert.equal(result.afterInput.tiptapEditorCount, 1);
assert.equal(result.afterInput.activeElementInsideProse, true);
assert.equal(result.afterInput.rightInspectorVisible, true);
assert.equal((result.afterInput.text.match(/05bzA/gu) || []).length, 1);
assert.equal(result.networkRequests, 0);
assert.equal(result.dialogCalls, 0);

const summary = {
  ok: true,
  outputDir,
  paragraphCount: result.paragraphCount,
  centralSheetFlow: result.afterInput.centralSheetFlow,
  visibleSheetCount: result.afterInput.visibleSheetCount,
  viewportVisibleSheetCount: result.afterInput.viewportVisibleSheetCount,
  occupiedSheetCount: result.afterInput.occupiedSheetCount,
  secondSheetBelow: result.afterInput.secondSheetBelow,
  secondSheetRightOfFirst: result.afterInput.secondSheetRightOfFirst,
  verticalGapTextRectsCount: result.afterInput.verticalGapTextRectsCount,
  visibleTextRectCount: result.afterInput.visibleTextRectCount,
  visibleTextOutsideVisibleSheetRectCount: result.afterInput.visibleTextOutsideVisibleSheetRectCount,
  sheetStackCanvasCenterDeltaPx: result.afterInput.sheetStackCanvasCenterDeltaPx,
  sheetStackHostCenterDeltaPx: result.afterInput.sheetStackHostCenterDeltaPx,
  stripCanvasCenterDeltaPx: result.afterInput.stripCanvasCenterDeltaPx,
  sheetStackRailGapCenterDeltaPx: result.afterInput.sheetStackRailGapCenterDeltaPx,
  proseMirrorCount: result.afterInput.proseMirrorCount,
  tiptapEditorCount: result.afterInput.tiptapEditorCount,
  activeElementInsideProse: result.afterInput.activeElementInsideProse,
  rightInspectorVisible: result.afterInput.rightInspectorVisible,
  typedMarkerOccurrences: (result.afterInput.text.match(/05bzA/gu) || []).length,
  networkRequests: result.networkRequests,
  dialogCalls: result.dialogCalls,
  screenshots: result.screenshots,
};

console.log('TWO_SHEET_FEED_SMOKE_SUMMARY:' + JSON.stringify(summary));

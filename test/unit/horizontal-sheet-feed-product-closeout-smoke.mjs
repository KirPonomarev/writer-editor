import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const rootDir = path.resolve(new URL('../..', import.meta.url).pathname);
const requireFromHere = createRequire(import.meta.url);
const electronBinary = requireFromHere('electron');
const outputDir = process.env.HORIZONTAL_SHEET_FEED_CLOSEOUT_OUT_DIR
  ? path.resolve(process.env.HORIZONTAL_SHEET_FEED_CLOSEOUT_OUT_DIR)
  : await mkdtemp(path.join(os.tmpdir(), '07a-horizontal-sheet-feed-closeout-'));

function markerCount(text, marker) {
  return String(text).split(marker).length - 1;
}

function stableTextHash(text) {
  let hash = 2166136261;
  for (const char of String(text)) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function buildHelperSource() {
  return `
const path = require('node:path');
const fs = require('node:fs/promises');
const { app, BrowserWindow, dialog, session } = require('electron');

const rootDir = ${JSON.stringify(rootDir)};
const outputDir = ${JSON.stringify(outputDir)};
const mainEntrypoint = path.join(rootDir, 'src', 'main' + '.js');
const marker = '07A_HORIZONTAL_SHEET_CLOSEOUT_MARKER';
let networkRequests = 0;
let dialogCalls = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function markerCount(text, token) {
  return String(text).split(token).length - 1;
}

function stableTextHash(text) {
  let hash = 2166136261;
  for (const char of String(text)) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function buildPlainText(paragraphCount) {
  const sentence = 'Horizontal sheet feed product closeout paragraph for a visual sheet boundary over one Tiptap editor.';
  return Array.from({ length: paragraphCount }, (_, index) => (
    sentence + ' ' + String(index + 1) + '. ' + sentence + ' ' + sentence
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
    title: 'horizontal-sheet-feed-product-closeout-smoke',
    path: '',
    kind: 'chapter-file',
    metaEnabled: true,
    projectId: 'horizontal-sheet-feed-product-closeout-smoke',
    bookProfile: null,
  });
}

async function collectState(win, label) {
  return win.webContents.executeJavaScript(\`((payload) => {
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
    const stableTextHash = (text) => {
      let hash = 2166136261;
      for (const char of String(text)) {
        hash ^= char.codePointAt(0);
        hash = Math.imul(hash, 16777619);
      }
      return (hash >>> 0).toString(16).padStart(8, '0');
    };
    const host = document.querySelector('#editor.tiptap-host');
    const canvas = document.querySelector('.main-content--editor');
    const strip = host ? host.querySelector('.tiptap-sheet-strip') : null;
    const prose = host ? host.querySelector('.ProseMirror') : null;
    const rightSidebar = document.querySelector('[data-right-sidebar]');
    const sourceWraps = host ? [...host.querySelectorAll(':scope > .tiptap-page-wrap')] : [];
    const derivedWraps = strip ? [...strip.querySelectorAll(':scope > .tiptap-page-wrap')] : [];
    const pageRects = derivedWraps.map((el, index) => {
      const rect = el.getBoundingClientRect();
      return { index, x: rect.x, y: rect.y, width: rect.width, height: rect.height, top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right };
    });
    const firstPageRect = pageRects[0] || null;
    const secondPageRect = pageRects[1] || null;
    const lastPageRect = pageRects[pageRects.length - 1] || null;
    const rightSidebarRect = rightSidebar ? rightSidebar.getBoundingClientRect() : null;
    const selection = window.getSelection();
    const selectionNode = selection && selection.rangeCount
      ? selection.getRangeAt(0).commonAncestorContainer
      : null;
    const selectionElement = selectionNode && selectionNode.nodeType === Node.TEXT_NODE
      ? selectionNode.parentElement
      : selectionNode;
    const text = prose ? prose.textContent || '' : '';
    const prosePageTruthCount = prose
      ? prose.querySelectorAll('[data-page-index], [data-page-number], [data-page-id]').length
      : 0;
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
    if (walker) {
      let current = walker.nextNode();
      while (current) {
        const range = document.createRange();
        range.selectNodeContents(current);
        [...range.getClientRects()].forEach((rect) => {
          if (rect.width > 0 && rect.height > 0) {
            textRects.push(toPlainRect(rect));
          }
        });
        current = walker.nextNode();
      }
    }
    const gapTextRects = firstPageRect && secondPageRect
      ? textRects.filter((rect) => (
          rect.x > firstPageRect.x + firstPageRect.width
          && rect.x + rect.width < secondPageRect.x
        ))
      : [];
    const overflowTextRects = firstPageRect && lastPageRect
      ? textRects.filter((rect) => (
          rect.x < firstPageRect.x - 1
          || rect.x + rect.width > lastPageRect.x + lastPageRect.width + 1
          || rect.y < lastPageRect.y - 1
          || rect.y + rect.height > lastPageRect.y + lastPageRect.height + 1
        ))
      : [];
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
    const secondSheetRightOfFirst = Boolean(firstPageRect && secondPageRect && secondPageRect.x > firstPageRect.x + 24);
    const secondSheetSameRow = Boolean(
      firstPageRect
      && secondPageRect
      && Math.abs(secondPageRect.y - firstPageRect.y) <= Math.max(64, firstPageRect.height * 0.25)
    );
    return {
      label: payload.label,
      centralSheetFlow: host ? host.dataset.centralSheetFlow || null : null,
      centralSheetOverflowReason: host ? host.dataset.centralSheetOverflowReason || null : null,
      text,
      textLength: text.length,
      textHash: stableTextHash(text),
      markerOccurrences: String(text).split(payload.marker).length - 1,
      paragraphCount: prose ? prose.querySelectorAll('p').length : 0,
      visibleSheetCount: derivedWraps.length,
      sourceWrapperCount: sourceWraps.length,
      sourceEditorWrapperCount: sourceWraps.filter((el) => el.querySelector('.ProseMirror') || el.querySelector('.tiptap-editor')).length,
      sourceWrapperProseMirrorCount: sourceWraps.reduce((sum, el) => sum + el.querySelectorAll('.ProseMirror').length, 0),
      sourceWrapperTiptapEditorCount: sourceWraps.reduce((sum, el) => sum + el.querySelectorAll('.tiptap-editor').length, 0),
      derivedSheetCount: derivedWraps.length,
      derivedSheetProseMirrorCount: derivedWraps.reduce((sum, el) => sum + el.querySelectorAll('.ProseMirror').length, 0),
      derivedSheetEditorCount: derivedWraps.reduce((sum, el) => sum + el.querySelectorAll('.tiptap-editor').length, 0),
      proseMirrorCount: host ? host.querySelectorAll('.ProseMirror').length : 0,
      tiptapEditorCount: host ? host.querySelectorAll('.tiptap-editor').length : 0,
      prosePageTruthCount,
      activeElementInsideProseMirror: Boolean(prose && (document.activeElement === prose || prose.contains(document.activeElement))),
      selectionInsideProseMirror: Boolean(prose && selectionElement && (selectionElement === prose || prose.contains(selectionElement))),
      rightInspectorVisible: Boolean(rightSidebarRect && rightSidebarRect.width >= 280 && rightSidebarRect.height > 0),
      rightInspectorWidth: rightSidebarRect ? rightSidebarRect.width : 0,
      editorCanvasVisible: Boolean(canvas && canvas.getBoundingClientRect().width > 0 && canvas.getBoundingClientRect().height > 0),
      pageRects,
      firstTwoSheetRectsHorizontal: Boolean(secondSheetRightOfFirst && secondSheetSameRow),
      secondSheetVisible: secondSheetRightOfFirst,
      secondSheetRightOfFirst,
      secondSheetSameRow,
      gapTextRectsCount: gapTextRects.length,
      overflowTextRectsCount: overflowTextRects.length,
      occupiedSheetCount: occupiedSheetIndexes.size,
    };
  })(\${JSON.stringify({ label, marker })})\`, true);
}

async function focusEditorEnd(win) {
  return win.webContents.executeJavaScript(\`(() => {
    const host = document.querySelector('#editor.tiptap-host');
    const prose = host ? host.querySelector('.ProseMirror') : null;
    if (!host || !prose) {
      return { ok: false, reason: 'EDITOR_MISSING' };
    }
    const walker = document.createTreeWalker(prose, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        return node.textContent && node.textContent.trim()
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_SKIP;
      },
    });
    let lastTextNode = null;
    let current = walker.nextNode();
    while (current) {
      lastTextNode = current;
      current = walker.nextNode();
    }
    const range = document.createRange();
    if (lastTextNode) {
      range.setStart(lastTextNode, lastTextNode.textContent.length);
      range.setEnd(lastTextNode, lastTextNode.textContent.length);
    } else {
      range.selectNodeContents(prose);
      range.collapse(false);
    }
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    prose.focus();
    return {
      ok: true,
      centralSheetFlow: host.dataset.centralSheetFlow || null,
      proseMirrorCount: host.querySelectorAll('.ProseMirror').length,
      tiptapEditorCount: host.querySelectorAll('.tiptap-editor').length,
      activeElementInsideProseMirror: document.activeElement === prose || prose.contains(document.activeElement),
      selectionInsideProseMirror: prose.contains(selection.anchorNode) && prose.contains(selection.focusNode),
    };
  })()\`, true);
}

async function saveCapture(win, basename) {
  const image = await win.webContents.capturePage();
  const bytes = image.toPNG();
  await fs.writeFile(path.join(outputDir, basename), bytes);
  return { basename, byteLength: bytes.length };
}

async function findHorizontalTwoSheetFixture(win) {
  let lastState = null;
  for (let paragraphCount = 1; paragraphCount <= 20; paragraphCount += 1) {
    await setEditorPayload(win, paragraphCount);
    await sleep(700);
    const state = await collectState(win, 'candidate-' + String(paragraphCount));
    lastState = state;
    if (
      state.centralSheetFlow === 'horizontal'
      && state.centralSheetOverflowReason === null
      && state.visibleSheetCount >= 2
      && state.derivedSheetCount >= 2
      && state.occupiedSheetCount >= 2
      && state.firstTwoSheetRectsHorizontal
      && state.secondSheetVisible
      && state.gapTextRectsCount === 0
      && state.overflowTextRectsCount === 0
      && state.proseMirrorCount === 1
      && state.tiptapEditorCount === 1
      && state.derivedSheetProseMirrorCount === 0
      && state.derivedSheetEditorCount === 0
      && state.prosePageTruthCount === 0
    ) {
      return { paragraphCount, state };
    }
    if (state.centralSheetOverflowReason === 'max-page-count') {
      break;
    }
  }
  throw new Error('NO_HORIZONTAL_TWO_SHEET_PRODUCT_FIXTURE ' + JSON.stringify(lastState));
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
    win.setContentSize(2048, 1110);
    await sleep(1200);

    const fixture = await findHorizontalTwoSheetFixture(win);
    await setEditorPayload(win, fixture.paragraphCount);
    await sleep(800);
    const beforeInput = await collectState(win, 'before-input');
    const beforeScreenshot = await saveCapture(win, '07a-horizontal-feed-before.png');
    const focusResult = await focusEditorEnd(win);
    if (!focusResult.ok || !focusResult.activeElementInsideProseMirror || !focusResult.selectionInsideProseMirror) {
      throw new Error('FOCUS_END_NOT_PROVABLE ' + JSON.stringify(focusResult));
    }
    await win.webContents.insertText(' ' + marker);
    await sleep(800);
    const afterInput = await collectState(win, 'after-input');
    const afterScreenshot = await saveCapture(win, '07a-horizontal-feed-after.png');
    const payload = {
      ok: true,
      paragraphCount: fixture.paragraphCount,
      marker,
      fixture: fixture.state,
      beforeInput,
      afterInput,
      focusResult,
      beforeScreenshot,
      afterScreenshot,
      networkRequests,
      dialogCalls,
    };
    await fs.writeFile(path.join(outputDir, 'result.json'), JSON.stringify(payload, null, 2));
    process.stdout.write('HORIZONTAL_SHEET_FEED_CLOSEOUT_RESULT:' + JSON.stringify(payload) + '\\n');
    app.exit(0);
  } catch (error) {
    const payload = { ok: false, error: error && error.stack ? error.stack : String(error), networkRequests, dialogCalls };
    await fs.writeFile(path.join(outputDir, 'result.json'), JSON.stringify(payload, null, 2));
    process.stdout.write('HORIZONTAL_SHEET_FEED_CLOSEOUT_RESULT:' + JSON.stringify(payload) + '\\n');
    app.exit(1);
  }
});
`;
}

await mkdir(outputDir, { recursive: true });
const helperPath = path.join(outputDir, 'electron-helper.cjs');
await writeFile(helperPath, buildHelperSource());

const child = spawn(electronBinary, [helperPath], {
  cwd: rootDir,
  env: {
    ...process.env,
    ELECTRON_ENABLE_LOGGING: '0',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let stdout = '';
let stderr = '';
child.stdout.on('data', (chunk) => { stdout += String(chunk); });
child.stderr.on('data', (chunk) => { stderr += String(chunk); });

const timeout = setTimeout(() => {
  child.kill('SIGKILL');
}, 45000);

const exitCode = await new Promise((resolve) => {
  child.on('close', resolve);
});
clearTimeout(timeout);

if (exitCode !== 0) {
  process.stdout.write(stdout);
  process.stderr.write(stderr);
  throw new Error(`Electron horizontal sheet feed closeout smoke failed with exit ${exitCode}`);
}

const result = JSON.parse(await readFile(path.join(outputDir, 'result.json'), 'utf8'));
if (!result.ok) {
  throw new Error(result.error || 'Electron horizontal sheet feed closeout smoke returned not ok');
}

const states = [result.beforeInput, result.afterInput];
for (const state of states) {
  assert.equal(state.centralSheetFlow, 'horizontal', `${state.label} must use horizontal central sheet flow`);
  assert.equal(state.centralSheetOverflowReason, null, `${state.label} must not use overflow fallback`);
  assert.equal(state.visibleSheetCount >= 2, true, `${state.label} must show at least two derived sheets`);
  assert.equal(state.derivedSheetCount >= 2, true, `${state.label} must expose at least two derived sheet wrappers`);
  assert.equal(state.occupiedSheetCount >= 2, true, `${state.label} must have text occupying at least two visual sheets`);
  assert.equal(state.firstTwoSheetRectsHorizontal, true, `${state.label} first two sheets must be horizontal`);
  assert.equal(state.secondSheetVisible, true, `${state.label} second sheet must be visible to the right`);
  assert.equal(state.gapTextRectsCount, 0, `${state.label} must not render text in the inter-sheet gap`);
  assert.equal(state.overflowTextRectsCount, 0, `${state.label} must not render text outside sheet bounds`);
  assert.equal(state.proseMirrorCount, 1, `${state.label} must keep one ProseMirror`);
  assert.equal(state.tiptapEditorCount, 1, `${state.label} must keep one Tiptap editor shell`);
  assert.equal(state.sourceWrapperCount, 1, `${state.label} must keep one direct source editor wrapper`);
  assert.equal(state.sourceEditorWrapperCount, 1, `${state.label} source wrapper must hold the real editor`);
  assert.equal(state.sourceWrapperProseMirrorCount, 1, `${state.label} source wrapper must hold one ProseMirror`);
  assert.equal(state.sourceWrapperTiptapEditorCount, 1, `${state.label} source wrapper must hold one Tiptap shell`);
  assert.equal(state.derivedSheetProseMirrorCount, 0, `${state.label} derived sheets must not contain ProseMirror`);
  assert.equal(state.derivedSheetEditorCount, 0, `${state.label} derived sheets must not contain editor shells`);
  assert.equal(state.prosePageTruthCount, 0, `${state.label} must not write page truth into ProseMirror`);
  assert.equal(state.rightInspectorVisible, true, `${state.label} must keep right inspector visible`);
  assert.equal(state.editorCanvasVisible, true, `${state.label} must keep editor canvas visible`);
}

assert.equal(result.focusResult.ok, true, 'focus helper must place caret at editor end');
assert.equal(result.focusResult.activeElementInsideProseMirror, true, 'active element must be inside ProseMirror before typing');
assert.equal(result.focusResult.selectionInsideProseMirror, true, 'selection must be inside ProseMirror before typing');
assert.equal(result.afterInput.activeElementInsideProseMirror, true, 'active element must remain inside ProseMirror after marker type');
assert.equal(result.afterInput.selectionInsideProseMirror, true, 'selection must remain inside ProseMirror after marker type');
assert.equal(markerCount(result.beforeInput.text, result.marker), 0, 'marker must not exist before typing');
assert.equal(markerCount(result.afterInput.text, result.marker), 1, 'typed marker must appear exactly once');
assert.notEqual(result.beforeInput.textHash, result.afterInput.textHash, 'typing marker must change text hash');
assert.equal(result.beforeInput.textHash, stableTextHash(result.beforeInput.text), 'outer hash guard must confirm before text');
assert.equal(result.afterInput.textHash, stableTextHash(result.afterInput.text), 'outer hash guard must confirm after text');
assert.equal(result.beforeScreenshot.byteLength > 0, true, 'before screenshot must be non-empty evidence');
assert.equal(result.afterScreenshot.byteLength > 0, true, 'after screenshot must be non-empty evidence');
assert.equal(result.networkRequests, 0, 'smoke must not trigger network requests');
assert.equal(result.dialogCalls, 0, 'smoke must not trigger dialogs');

const summary = {
  outputDir,
  paragraphCount: result.paragraphCount,
  centralSheetFlowBefore: result.beforeInput.centralSheetFlow,
  centralSheetFlowAfter: result.afterInput.centralSheetFlow,
  centralSheetOverflowReasonBefore: result.beforeInput.centralSheetOverflowReason,
  centralSheetOverflowReasonAfter: result.afterInput.centralSheetOverflowReason,
  visibleSheetCountBefore: result.beforeInput.visibleSheetCount,
  visibleSheetCountAfter: result.afterInput.visibleSheetCount,
  occupiedSheetCountBefore: result.beforeInput.occupiedSheetCount,
  occupiedSheetCountAfter: result.afterInput.occupiedSheetCount,
  firstTwoSheetRectsHorizontalBefore: result.beforeInput.firstTwoSheetRectsHorizontal,
  firstTwoSheetRectsHorizontalAfter: result.afterInput.firstTwoSheetRectsHorizontal,
  secondSheetVisibleBefore: result.beforeInput.secondSheetVisible,
  secondSheetVisibleAfter: result.afterInput.secondSheetVisible,
  gapTextRectsCountAfter: result.afterInput.gapTextRectsCount,
  overflowTextRectsCountAfter: result.afterInput.overflowTextRectsCount,
  proseMirrorCount: result.afterInput.proseMirrorCount,
  tiptapEditorCount: result.afterInput.tiptapEditorCount,
  sourceWrapperCount: result.afterInput.sourceWrapperCount,
  sourceEditorWrapperCount: result.afterInput.sourceEditorWrapperCount,
  derivedSheetCount: result.afterInput.derivedSheetCount,
  derivedSheetProseMirrorCount: result.afterInput.derivedSheetProseMirrorCount,
  derivedSheetEditorCount: result.afterInput.derivedSheetEditorCount,
  prosePageTruthCount: result.afterInput.prosePageTruthCount,
  textHashBefore: result.beforeInput.textHash,
  textHashAfter: result.afterInput.textHash,
  textHashChanged: result.beforeInput.textHash !== result.afterInput.textHash,
  markerOccurrencesBefore: result.beforeInput.markerOccurrences,
  markerOccurrencesAfter: result.afterInput.markerOccurrences,
  activeElementInsideProseMirror: result.afterInput.activeElementInsideProseMirror,
  selectionInsideProseMirror: result.afterInput.selectionInsideProseMirror,
  rightInspectorVisible: result.afterInput.rightInspectorVisible,
  networkRequests: result.networkRequests,
  dialogCalls: result.dialogCalls,
  beforeScreenshot: result.beforeScreenshot.basename,
  beforeScreenshotBytes: result.beforeScreenshot.byteLength,
  afterScreenshot: result.afterScreenshot.basename,
  afterScreenshotBytes: result.afterScreenshot.byteLength,
};

process.stdout.write(`HORIZONTAL_SHEET_FEED_CLOSEOUT_SUMMARY:${JSON.stringify(summary)}\n`);

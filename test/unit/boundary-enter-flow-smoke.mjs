import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const rootDir = path.resolve(new URL('../..', import.meta.url).pathname);
const requireFromHere = createRequire(import.meta.url);
const electronBinary = requireFromHere('electron');
const outputDir = process.env.BOUNDARY_ENTER_FLOW_OUT_DIR
  ? path.resolve(process.env.BOUNDARY_ENTER_FLOW_OUT_DIR)
  : await mkdtemp(path.join(os.tmpdir(), '06b1-boundary-enter-flow-'));

function markerCount(text, marker) {
  return String(text).split(marker).length - 1;
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
  const sentence = 'Boundary enter flow proof paragraph for a derived visual sheet boundary over one Tiptap editor.';
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
    title: 'boundary-enter-flow-smoke',
    path: '',
    kind: 'chapter-file',
    metaEnabled: true,
    projectId: 'boundary-enter-flow-smoke',
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
    const strip = host ? host.querySelector('.tiptap-sheet-strip') : null;
    const prose = host ? host.querySelector('.ProseMirror') : null;
    const rightSidebar = document.querySelector('[data-right-sidebar]');
    const pageWraps = strip ? [...strip.querySelectorAll(':scope > .tiptap-page-wrap')] : [];
    const pageRects = pageWraps.map((el) => {
      const rect = el.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right };
    });
    const rightSidebarRect = rightSidebar ? rightSidebar.getBoundingClientRect() : null;
    const selection = window.getSelection();
    const selectionNode = selection && selection.rangeCount
      ? selection.getRangeAt(0).commonAncestorContainer
      : null;
    const selectionElement = selectionNode && selectionNode.nodeType === Node.TEXT_NODE
      ? selectionNode.parentElement
      : selectionNode;
    const selectionRect = (() => {
      if (!selection || !selection.rangeCount) return null;
      const rect = selection.getRangeAt(0).getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right };
    })();
    const prosePageTruthCount = prose
      ? prose.querySelectorAll('[data-page-index], [data-page-number], [data-page-id]').length
      : 0;
    return {
      label: \${JSON.stringify(label)},
      centralSheetFlow: host ? host.dataset.centralSheetFlow || null : null,
      centralSheetOverflowReason: host ? host.dataset.centralSheetOverflowReason || null : null,
      text: prose ? prose.textContent || '' : '',
      paragraphCount: prose ? prose.querySelectorAll('p').length : 0,
      visibleSheetCount: pageWraps.length,
      proseMirrorCount: host ? host.querySelectorAll('.ProseMirror').length : 0,
      tiptapEditorCount: host ? host.querySelectorAll('.tiptap-editor').length : 0,
      prosePageTruthCount,
      activeElementInsideProse: Boolean(prose && (document.activeElement === prose || prose.contains(document.activeElement))),
      selectionInsideProse: Boolean(prose && selectionElement && (selectionElement === prose || prose.contains(selectionElement))),
      rightInspectorVisible: Boolean(rightSidebarRect && rightSidebarRect.width >= 280 && rightSidebarRect.height > 0),
      rightInspectorWidth: rightSidebarRect ? rightSidebarRect.width : 0,
      pageRects,
      selectionRect,
    };
  })()\`, true);
}

async function lockBoundaryCoordinate(win) {
  return win.webContents.executeJavaScript(\`(() => {
    const host = document.querySelector('#editor.tiptap-host');
    const strip = host ? host.querySelector('.tiptap-sheet-strip') : null;
    const prose = host ? host.querySelector('.ProseMirror') : null;
    const firstSheet = strip ? strip.querySelector(':scope > .tiptap-page-wrap') : null;
    if (!host || !strip || !prose || !firstSheet) {
      return { ok: false, reason: 'SURFACE_MISSING' };
    }
    const firstSheetRect = firstSheet.getBoundingClientRect();
    const walker = document.createTreeWalker(prose, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        return node.textContent && node.textContent.trim()
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_SKIP;
      },
    });
    const textRects = [];
    let current = walker.nextNode();
    while (current) {
      const range = document.createRange();
      range.selectNodeContents(current);
      [...range.getClientRects()].forEach((rect) => {
        const insideFirstSheet = (
          rect.left < firstSheetRect.right
          && rect.right > firstSheetRect.left
          && rect.top < firstSheetRect.bottom
          && rect.bottom > firstSheetRect.top
        );
        if (insideFirstSheet && rect.width > 2 && rect.height > 2) {
          textRects.push({
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            top: rect.top,
            bottom: rect.bottom,
            left: rect.left,
            right: rect.right,
            distanceFromSheetBottom: firstSheetRect.bottom - rect.bottom,
          });
        }
      });
      current = walker.nextNode();
    }
    const safeBandMin = 24;
    const safeBandMax = 220;
    const candidates = textRects
      .filter((rect) => rect.distanceFromSheetBottom >= safeBandMin && rect.distanceFromSheetBottom <= safeBandMax)
      .sort((a, b) => a.distanceFromSheetBottom - b.distanceFromSheetBottom);
    const fallbackCandidates = textRects
      .filter((rect) => rect.distanceFromSheetBottom >= 0)
      .sort((a, b) => a.distanceFromSheetBottom - b.distanceFromSheetBottom);
    const selected = candidates[0] || null;
    if (!selected) {
      return {
        ok: false,
        reason: 'NO_TEXT_RECT_IN_SAFE_BOUNDARY_BAND',
        firstSheetRect: {
          x: firstSheetRect.x,
          y: firstSheetRect.y,
          width: firstSheetRect.width,
          height: firstSheetRect.height,
          top: firstSheetRect.top,
          bottom: firstSheetRect.bottom,
          left: firstSheetRect.left,
          right: firstSheetRect.right,
        },
        nearestTextRect: fallbackCandidates[0] || null,
        textRectCount: textRects.length,
        safeBandMin,
        safeBandMax,
      };
    }
    const x = Math.max(selected.left + 1, Math.min(selected.right - 1, selected.left + selected.width * 0.72));
    const y = selected.top + selected.height / 2;
    const insideTextRect = x >= selected.left && x <= selected.right && y >= selected.top && y <= selected.bottom;
    const insideFirstSheet = x >= firstSheetRect.left && x <= firstSheetRect.right && y >= firstSheetRect.top && y <= firstSheetRect.bottom;
    let caretRange = null;
    let proofStrength = 'NONE';
    if (typeof document.caretRangeFromPoint === 'function') {
      caretRange = document.caretRangeFromPoint(x, y);
      proofStrength = caretRange ? 'REAL_COORDINATE_CARET_RANGE_FROM_POINT_PASS' : 'NONE';
    }
    if (!caretRange && typeof document.caretPositionFromPoint === 'function') {
      const caretPosition = document.caretPositionFromPoint(x, y);
      if (caretPosition) {
        caretRange = document.createRange();
        caretRange.setStart(caretPosition.offsetNode, caretPosition.offset);
        caretRange.collapse(true);
        proofStrength = 'REAL_COORDINATE_CARET_POSITION_FROM_POINT_PASS';
      }
    }
    const caretNode = caretRange ? caretRange.startContainer : null;
    const caretElement = caretNode && caretNode.nodeType === Node.TEXT_NODE
      ? caretNode.parentElement
      : caretNode;
    const caretInsideProse = Boolean(caretElement && (caretElement === prose || prose.contains(caretElement)));
    return {
      ok: Boolean(caretRange && caretInsideProse && insideTextRect && insideFirstSheet),
      reason: caretRange ? null : 'COORDINATE_CARET_API_NO_RESULT',
      proofStrength,
      boundaryCoordinate: { x, y },
      selectedTextRect: selected,
      firstSheetRect: {
        x: firstSheetRect.x,
        y: firstSheetRect.y,
        width: firstSheetRect.width,
        height: firstSheetRect.height,
        top: firstSheetRect.top,
        bottom: firstSheetRect.bottom,
        left: firstSheetRect.left,
        right: firstSheetRect.right,
      },
      insideTextRect,
      insideFirstSheet,
      caretInsideProse,
      textRectCount: textRects.length,
      safeBandMin,
      safeBandMax,
    };
  })()\`, true);
}

async function placeCaretAtBoundary(win, coordinate) {
  return win.webContents.executeJavaScript(\`((point) => {
    const host = document.querySelector('#editor.tiptap-host');
    const strip = host ? host.querySelector('.tiptap-sheet-strip') : null;
    const prose = host ? host.querySelector('.ProseMirror') : null;
    const firstSheet = strip ? strip.querySelector(':scope > .tiptap-page-wrap') : null;
    if (!prose || !firstSheet) {
      return { ok: false, reason: 'PROSEMIRROR_OR_SHEET_MISSING' };
    }
    let range = null;
    let proofStrength = 'NONE';
    if (typeof document.caretRangeFromPoint === 'function') {
      range = document.caretRangeFromPoint(point.x, point.y);
      proofStrength = range ? 'REAL_COORDINATE_CARET_RANGE_FROM_POINT_PASS' : 'NONE';
    }
    if (!range && typeof document.caretPositionFromPoint === 'function') {
      const position = document.caretPositionFromPoint(point.x, point.y);
      if (position) {
        range = document.createRange();
        range.setStart(position.offsetNode, position.offset);
        range.collapse(true);
        proofStrength = 'REAL_COORDINATE_CARET_POSITION_FROM_POINT_PASS';
      }
    }
    if (!range) {
      return { ok: false, reason: 'COORDINATE_CARET_API_NO_RESULT', proofStrength };
    }
    range.collapse(true);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    prose.focus();
    const selectionNode = range.commonAncestorContainer;
    const selectionElement = selectionNode && selectionNode.nodeType === Node.TEXT_NODE
      ? selectionNode.parentElement
      : selectionNode;
    const selectionInsideProse = Boolean(selectionElement && (selectionElement === prose || prose.contains(selectionElement)));
    const activeElementInsideProse = document.activeElement === prose || prose.contains(document.activeElement);
    const firstSheetRectRaw = firstSheet.getBoundingClientRect();
    const firstSheetRect = {
      x: firstSheetRectRaw.x,
      y: firstSheetRectRaw.y,
      width: firstSheetRectRaw.width,
      height: firstSheetRectRaw.height,
      top: firstSheetRectRaw.top,
      bottom: firstSheetRectRaw.bottom,
      left: firstSheetRectRaw.left,
      right: firstSheetRectRaw.right,
    };
    const selectionRectInsideBoundarySafeBand = (
      point.x >= firstSheetRect.left
      && point.x <= firstSheetRect.right
      && point.y >= firstSheetRect.top
      && point.y <= firstSheetRect.bottom
      && firstSheetRect.bottom - point.y >= 24
      && firstSheetRect.bottom - point.y <= 220
    );
    return {
      ok: selectionInsideProse && activeElementInsideProse && selectionRectInsideBoundarySafeBand,
      proofStrength,
      selectionInsideProse,
      activeElementInsideProse,
      selectionRectInsideBoundarySafeBand,
      proseMirrorCount: host.querySelectorAll('.ProseMirror').length,
      tiptapEditorCount: host.querySelectorAll('.tiptap-editor').length,
    };
  })(\${JSON.stringify(coordinate)})\`, true);
}

async function findTwoSheetFixture(win) {
  let lastState = null;
  let lastBoundaryCandidate = null;
  for (let paragraphCount = 1; paragraphCount <= 20; paragraphCount += 1) {
    await setEditorPayload(win, paragraphCount);
    await sleep(700);
    const state = await collectState(win, 'candidate-' + String(paragraphCount));
    const boundaryCandidate = await lockBoundaryCoordinate(win);
    lastState = state;
    lastBoundaryCandidate = boundaryCandidate;
    if (
      state.centralSheetFlow === 'horizontal'
      && state.visibleSheetCount >= 2
      && state.proseMirrorCount === 1
      && state.tiptapEditorCount === 1
      && state.prosePageTruthCount === 0
      && boundaryCandidate.ok
    ) {
      return { paragraphCount, state, boundaryCandidate };
    }
    if (state.centralSheetOverflowReason === 'max-page-count') {
      break;
    }
  }
  throw new Error('NO_TWO_SHEET_BOUNDARY_FIXTURE ' + JSON.stringify({ lastState, lastBoundaryCandidate }));
}

async function pressKey(win, keyCode, modifiers = []) {
  win.webContents.sendInputEvent({ type: 'keyDown', keyCode, modifiers });
  win.webContents.sendInputEvent({ type: 'keyUp', keyCode, modifiers });
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

    const fixture = await findTwoSheetFixture(win);
    await setEditorPayload(win, fixture.paragraphCount);
    await sleep(800);
    const beforeEnter = await collectState(win, 'before-enter');
    const boundaryCandidate = await lockBoundaryCoordinate(win);
    if (!boundaryCandidate.ok) {
      throw new Error('BOUNDARY_COORDINATE_NOT_PROVABLE ' + JSON.stringify(boundaryCandidate));
    }
    const caretPlacement = await placeCaretAtBoundary(win, boundaryCandidate.boundaryCoordinate);
    if (!caretPlacement.ok) {
      throw new Error('BOUNDARY_CARET_PLACEMENT_NOT_PROVABLE ' + JSON.stringify(caretPlacement));
    }
    await sleep(150);
    await saveCapture(win, '06b1-before-enter-flow.png');

    await pressKey(win, 'Enter');
    await sleep(800);
    const afterEnter = await collectState(win, 'after-enter');

    const marker = '06B1_ENTER_FLOW';
    await win.webContents.insertText(marker);
    await sleep(800);
    const afterType = await collectState(win, 'after-type');
    await saveCapture(win, '06b1-after-enter-flow.png');

    const payload = {
      ok: true,
      paragraphCount: fixture.paragraphCount,
      marker,
      fixture: fixture.state,
      beforeEnter,
      boundaryCandidate,
      caretPlacement,
      afterEnter,
      afterType,
      crossSheetClaim: false,
      networkRequests,
      dialogCalls,
      screenshots: [
        path.join(outputDir, '06b1-before-enter-flow.png'),
        path.join(outputDir, '06b1-after-enter-flow.png'),
      ],
    };
    await fs.writeFile(path.join(outputDir, 'result.json'), JSON.stringify(payload, null, 2));
    process.stdout.write('BOUNDARY_ENTER_FLOW_SMOKE_RESULT:' + JSON.stringify(payload) + '\\n');
    app.exit(0);
  } catch (error) {
    const payload = { ok: false, error: error && error.stack ? error.stack : String(error), networkRequests, dialogCalls };
    await fs.writeFile(path.join(outputDir, 'result.json'), JSON.stringify(payload, null, 2));
    process.stdout.write('BOUNDARY_ENTER_FLOW_SMOKE_RESULT:' + JSON.stringify(payload) + '\\n');
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

const exitCode = await new Promise((resolve) => {
  child.on('close', resolve);
});

if (exitCode !== 0) {
  process.stdout.write(stdout);
  process.stderr.write(stderr);
  throw new Error(`Electron boundary enter flow smoke failed with exit ${exitCode}`);
}

const result = JSON.parse(await readFile(path.join(outputDir, 'result.json'), 'utf8'));
if (!result.ok) {
  throw new Error(result.error || 'Electron boundary enter flow smoke returned not ok');
}

const states = [
  result.beforeEnter,
  result.afterEnter,
  result.afterType,
];

for (const state of states) {
  assert.equal(state.proseMirrorCount, 1, `${state.label} must keep one ProseMirror`);
  assert.equal(state.tiptapEditorCount, 1, `${state.label} must keep one Tiptap editor shell`);
  assert.equal(state.prosePageTruthCount, 0, `${state.label} must not create page truth inside ProseMirror`);
}

assert.equal(result.fixture.centralSheetFlow, 'horizontal', 'fixture must use central sheet horizontal flow');
assert.ok(result.beforeEnter.visibleSheetCount >= 2, 'baseline text must show at least two visible sheets');
assert.equal(result.boundaryCandidate.ok, true, 'boundary coordinate candidate must be found');
assert.equal(result.boundaryCandidate.insideTextRect, true, 'boundary coordinate must be inside a real text rect');
assert.equal(result.boundaryCandidate.insideFirstSheet, true, 'boundary coordinate must be inside first visual sheet');
assert.match(
  result.caretPlacement.proofStrength,
  /^REAL_COORDINATE_CARET_(RANGE|POSITION)_FROM_POINT_PASS$/u,
  'caret placement must use a real browser coordinate caret API'
);
assert.equal(result.caretPlacement.selectionInsideProse, true, 'selection must be inside ProseMirror before Enter');
assert.equal(result.caretPlacement.activeElementInsideProse, true, 'active element must be inside ProseMirror before Enter');
assert.equal(
  result.afterEnter.paragraphCount > result.beforeEnter.paragraphCount,
  true,
  'Enter from boundary coordinate must increase paragraph count'
);
assert.equal(result.afterEnter.activeElementInsideProse, true, 'active element must remain inside ProseMirror after Enter');
assert.equal(result.afterEnter.selectionInsideProse, true, 'selection must remain inside ProseMirror after Enter');
assert.equal(markerCount(result.afterType.text, result.marker), 1, 'boundary Enter marker must appear once');
assert.equal(result.afterType.activeElementInsideProse, true, 'active element must remain inside ProseMirror after marker type');
assert.equal(result.afterType.selectionInsideProse, true, 'selection must remain inside ProseMirror after marker type');
assert.equal(result.afterType.rightInspectorVisible, true, 'right inspector must remain visible as adjacent guard');
assert.equal(result.crossSheetClaim, false, 'this proof must not claim cross-sheet pass');
assert.equal(result.networkRequests, 0, 'smoke must not trigger network requests');
assert.equal(result.dialogCalls, 0, 'smoke must not trigger dialogs');

const summary = {
  outputDir,
  paragraphCount: result.paragraphCount,
  proofStrength: result.caretPlacement.proofStrength,
  visibleSheetCount: result.afterType.visibleSheetCount,
  proseMirrorCount: result.afterType.proseMirrorCount,
  tiptapEditorCount: result.afterType.tiptapEditorCount,
  prosePageTruthCount: result.afterType.prosePageTruthCount,
  boundaryCoordinateFound: result.boundaryCandidate.ok,
  distanceFromFirstSheetBottom: result.boundaryCandidate.selectedTextRect.distanceFromSheetBottom,
  paragraphCountBeforeEnter: result.beforeEnter.paragraphCount,
  paragraphCountAfterEnter: result.afterEnter.paragraphCount,
  markerAfterType: markerCount(result.afterType.text, result.marker),
  activeElementInsideProse: result.afterType.activeElementInsideProse,
  selectionInsideProse: result.afterType.selectionInsideProse,
  rightInspectorVisible: result.afterType.rightInspectorVisible,
  crossSheetClaim: result.crossSheetClaim,
  networkRequests: result.networkRequests,
  dialogCalls: result.dialogCalls,
  screenshots: result.screenshots.map((item) => path.basename(item)),
};

process.stdout.write(`BOUNDARY_ENTER_FLOW_SMOKE_SUMMARY:${JSON.stringify(summary)}\n`);

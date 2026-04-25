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
const outputDir = process.env.PAGE_BOUNDARY_INPUT_OUT_DIR
  ? path.resolve(process.env.PAGE_BOUNDARY_INPUT_OUT_DIR)
  : await mkdtemp(path.join(os.tmpdir(), '06a-page-boundary-input-'));

function hashText(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

function markerCount(text, marker) {
  return String(text).split(marker).length - 1;
}

function buildHelperSource() {
  return `
const path = require('node:path');
const fs = require('node:fs/promises');
const crypto = require('node:crypto');
const { app, BrowserWindow, dialog, session } = require('electron');

const rootDir = ${JSON.stringify(rootDir)};
const outputDir = ${JSON.stringify(outputDir)};
const mainEntrypoint = path.join(rootDir, 'src', 'main' + '.js');
let networkRequests = 0;
let dialogCalls = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hashText(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function buildPlainText(paragraphCount) {
  const sentence = 'Page boundary input stability proof paragraph for one local Tiptap editor and a derived two sheet feed.';
  return Array.from({ length: paragraphCount }, (_, index) => (
    sentence + ' ' + String(index + 1) + '. ' + sentence + ' ' + sentence
  )).join('\\n\\n');
}

function primaryModifier() {
  return process.platform === 'darwin' ? 'meta' : 'control';
}

function serializeProse(prose) {
  if (!prose) return '';
  const blocks = [...prose.querySelectorAll('p, li')]
    .map((node) => node.textContent || '');
  return blocks.length ? blocks.join('\\n') : prose.textContent || '';
}

function countLineBreaks(text) {
  return (String(text).match(/\\n/gu) || []).length;
}

function rectToPlain(rect) {
  return {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    top: rect.top,
    bottom: rect.bottom,
    left: rect.left,
    right: rect.right,
  };
}

function rectsIntersect(a, b) {
  return Boolean(
    a
    && b
    && a.left < b.right
    && a.right > b.left
    && a.top < b.bottom
    && a.bottom > b.top
  );
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
    title: 'page-boundary-input-smoke',
    path: '',
    kind: 'chapter-file',
    metaEnabled: true,
    projectId: 'page-boundary-input-smoke',
    bookProfile: null,
  });
}

async function saveCapture(win, basename) {
  const image = await win.webContents.capturePage();
  await fs.writeFile(path.join(outputDir, basename), image.toPNG());
}

async function collectState(win, label) {
  const state = await win.webContents.executeJavaScript(\`(() => {
    const serializeProse = \${serializeProse.toString()};
    const countLineBreaks = \${countLineBreaks.toString()};
    const rectToPlain = \${rectToPlain.toString()};
    const host = document.querySelector('#editor.tiptap-host');
    const strip = host ? host.querySelector('.tiptap-sheet-strip') : null;
    const prose = host ? host.querySelector('.ProseMirror') : null;
    const rightSidebar = document.querySelector('[data-right-sidebar]');
    const pageWraps = strip ? [...strip.querySelectorAll(':scope > .tiptap-page-wrap')] : [];
    const pageRects = pageWraps.map((el) => rectToPlain(el.getBoundingClientRect()));
    const rightSidebarRect = rightSidebar ? rightSidebar.getBoundingClientRect() : null;
    const selection = window.getSelection();
    const selectionNode = selection && selection.rangeCount
      ? selection.getRangeAt(0).commonAncestorContainer
      : null;
    const selectionElement = selectionNode && selectionNode.nodeType === Node.TEXT_NODE
      ? selectionNode.parentElement
      : selectionNode;
    const prosePageTruthCount = prose
      ? prose.querySelectorAll('[data-page-index], [data-page-number], [data-page-id]').length
      : 0;
    const serializedText = serializeProse(prose);
    return {
      label: \${JSON.stringify(label)},
      centralSheetFlow: host ? host.dataset.centralSheetFlow || null : null,
      centralSheetOverflowReason: host ? host.dataset.centralSheetOverflowReason || null : null,
      text: prose ? prose.textContent || '' : '',
      serializedText,
      serializedLineBreakCount: countLineBreaks(serializedText),
      paragraphCount: prose ? prose.querySelectorAll('p').length : 0,
      sourcePageCount: Number(host
        ? host.dataset.centralSheetBoundedOverflowSourcePageCount || host.dataset.centralSheetCount || '0'
        : '0'),
      visibleSheetCount: pageWraps.length,
      proseMirrorCount: host ? host.querySelectorAll('.ProseMirror').length : 0,
      tiptapEditorCount: host ? host.querySelectorAll('.tiptap-editor').length : 0,
      prosePageTruthCount,
      activeElementInsideProse: Boolean(prose && (document.activeElement === prose || prose.contains(document.activeElement))),
      selectionInsideProse: Boolean(prose && selectionElement && (selectionElement === prose || prose.contains(selectionElement))),
      rightInspectorVisible: Boolean(rightSidebarRect && rightSidebarRect.width >= 280 && rightSidebarRect.height > 0),
      rightInspectorWidth: rightSidebarRect ? rightSidebarRect.width : 0,
      pageRects,
    };
  })()\`, true);
  return { ...state, serializedHash: hashText(state.serializedText) };
}

async function inspectLastFirstSheetTextZone(win) {
  return win.webContents.executeJavaScript(\`(() => {
    const rectToPlain = \${rectToPlain.toString()};
    const rectsIntersect = \${rectsIntersect.toString()};
    function locate() {
      const host = document.querySelector('#editor.tiptap-host');
      const strip = host ? host.querySelector('.tiptap-sheet-strip') : null;
      const prose = host ? host.querySelector('.ProseMirror') : null;
      const pageWraps = strip ? [...strip.querySelectorAll(':scope > .tiptap-page-wrap')] : [];
      const firstSheet = pageWraps[0] || null;
      if (!host || !strip || !prose || !firstSheet) {
        return { ok: false, reason: 'SURFACE_MISSING' };
      }
      const firstSheetRect = firstSheet.getBoundingClientRect();
      const firstSheetRectPlain = rectToPlain(firstSheetRect);
      const targetSheetIndex = pageWraps.indexOf(firstSheet);
      const targetSheetDatasetPageIndex = Number(firstSheet.dataset.pageIndex || '-1');
      const walker = document.createTreeWalker(prose, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          return node.textContent && node.textContent.trim()
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_SKIP;
        },
      });
      const charRects = [];
      let textNodeOrder = 0;
      let current = walker.nextNode();
      while (current) {
        const text = current.textContent || '';
        for (let offset = 0; offset < text.length; offset += 1) {
          const char = text[offset];
          if (!char || !char.trim()) continue;
          const range = document.createRange();
          range.setStart(current, offset);
          range.setEnd(current, offset + 1);
          [...range.getClientRects()].forEach((rect) => {
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const centerInsideFirstSheet = (
              centerX >= firstSheetRect.left
              && centerX <= firstSheetRect.right
              && centerY >= firstSheetRect.top
              && centerY <= firstSheetRect.bottom
            );
            if (centerInsideFirstSheet && rect.width > 0 && rect.height > 0) {
              charRects.push({
                node: current,
                offsetAfter: offset + 1,
                char,
                textNodeOrder,
                charOffset: offset,
                rect: rectToPlain(rect),
                rangeRectIntersectsFirstSheet: rectsIntersect(rectToPlain(rect), firstSheetRectPlain),
                distanceFromSheetBottom: firstSheetRect.bottom - rect.bottom,
              });
            }
          });
        }
        textNodeOrder += 1;
        current = walker.nextNode();
      }
      charRects.sort((a, b) => (
        b.rect.bottom - a.rect.bottom
        || b.rect.right - a.rect.right
        || b.textNodeOrder - a.textNodeOrder
        || b.charOffset - a.charOffset
      ));
      const selected = charRects[0] || null;
      if (!selected) {
        return {
          ok: false,
          reason: 'NO_FIRST_SHEET_TEXT_ZONE',
          firstSheetRect: firstSheetRectPlain,
          targetSheetIndex,
          targetSheetDatasetPageIndex,
          candidateCount: 0,
        };
      }
      const bottomTolerance = 1;
      const sameVisualLineCount = charRects.filter((item) => (
        Math.abs(item.rect.bottom - selected.rect.bottom) <= bottomTolerance
      )).length;
      return {
        ok: true,
        proofStrength: 'RENDERED_LAST_FIRST_SHEET_CHARACTER_RECT',
        targetSheetIndex,
        targetSheetDatasetPageIndex,
        firstSheetRect: firstSheetRectPlain,
        targetRangeRect: selected.rect,
        targetRangeRectIntersectsFirstSheet: selected.rangeRectIntersectsFirstSheet,
        selectedRect: selected.rect,
        selectedChar: selected.char,
        selectedTextNodeOrder: selected.textNodeOrder,
        selectedCharOffset: selected.charOffset,
        distanceFromSheetBottom: selected.distanceFromSheetBottom,
        candidateCount: charRects.length,
        sameVisualLineCount,
      };
    }
    return locate();
  })()\`, true);
}

async function placeCaretAtLastFirstSheetTextZone(win) {
  return win.webContents.executeJavaScript(\`(() => {
    const rectToPlain = \${rectToPlain.toString()};
    const rectsIntersect = \${rectsIntersect.toString()};
    function locate() {
      const host = document.querySelector('#editor.tiptap-host');
      const strip = host ? host.querySelector('.tiptap-sheet-strip') : null;
      const prose = host ? host.querySelector('.ProseMirror') : null;
      const pageWraps = strip ? [...strip.querySelectorAll(':scope > .tiptap-page-wrap')] : [];
      const firstSheet = pageWraps[0] || null;
      if (!host || !strip || !prose || !firstSheet) {
        return { ok: false, reason: 'SURFACE_MISSING' };
      }
      const firstSheetRect = firstSheet.getBoundingClientRect();
      const firstSheetRectPlain = rectToPlain(firstSheetRect);
      const targetSheetIndex = pageWraps.indexOf(firstSheet);
      const targetSheetDatasetPageIndex = Number(firstSheet.dataset.pageIndex || '-1');
      const walker = document.createTreeWalker(prose, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          return node.textContent && node.textContent.trim()
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_SKIP;
        },
      });
      const charRects = [];
      let textNodeOrder = 0;
      let current = walker.nextNode();
      while (current) {
        const text = current.textContent || '';
        for (let offset = 0; offset < text.length; offset += 1) {
          const char = text[offset];
          if (!char || !char.trim()) continue;
          const range = document.createRange();
          range.setStart(current, offset);
          range.setEnd(current, offset + 1);
          [...range.getClientRects()].forEach((rect) => {
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const centerInsideFirstSheet = (
              centerX >= firstSheetRect.left
              && centerX <= firstSheetRect.right
              && centerY >= firstSheetRect.top
              && centerY <= firstSheetRect.bottom
            );
            if (centerInsideFirstSheet && rect.width > 0 && rect.height > 0) {
              charRects.push({
                node: current,
                offsetAfter: offset + 1,
                char,
                textNodeOrder,
                charOffset: offset,
                rect: rectToPlain(rect),
                rangeRectIntersectsFirstSheet: rectsIntersect(rectToPlain(rect), firstSheetRectPlain),
                distanceFromSheetBottom: firstSheetRect.bottom - rect.bottom,
              });
            }
          });
        }
        textNodeOrder += 1;
        current = walker.nextNode();
      }
      charRects.sort((a, b) => (
        b.rect.bottom - a.rect.bottom
        || b.rect.right - a.rect.right
        || b.textNodeOrder - a.textNodeOrder
        || b.charOffset - a.charOffset
      ));
      const selected = charRects[0] || null;
      if (!selected) {
        return {
          ok: false,
          reason: 'NO_FIRST_SHEET_TEXT_ZONE',
          firstSheetRect: firstSheetRectPlain,
          targetSheetIndex,
          targetSheetDatasetPageIndex,
          candidateCount: 0,
        };
      }
      return {
        ok: true,
        host,
        prose,
        firstSheet,
        firstSheetRect: firstSheetRectPlain,
        targetSheetIndex,
        targetSheetDatasetPageIndex,
        selected,
        candidateCount: charRects.length,
      };
    }
    const located = locate();
    if (!located.ok) return located;
    const range = document.createRange();
    range.setStart(located.selected.node, located.selected.offsetAfter);
    range.collapse(true);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    located.prose.focus();
    const selectionNode = selection.rangeCount ? selection.getRangeAt(0).commonAncestorContainer : null;
    const selectionElement = selectionNode && selectionNode.nodeType === Node.TEXT_NODE
      ? selectionNode.parentElement
      : selectionNode;
    const activeElementInsideProse = document.activeElement === located.prose || located.prose.contains(document.activeElement);
    const selectionInsideProse = Boolean(selectionElement && (selectionElement === located.prose || located.prose.contains(selectionElement)));
    const caretOffsetMatchesLastZone = selection.rangeCount
      && selection.getRangeAt(0).startContainer === located.selected.node
      && selection.getRangeAt(0).startOffset === located.selected.offsetAfter;
    return {
      ok: activeElementInsideProse && selectionInsideProse && caretOffsetMatchesLastZone,
      proofStrength: 'DOM_RANGE_AFTER_RENDERED_LAST_FIRST_SHEET_CHARACTER',
      activeElementInsideProse,
      selectionInsideProse,
      caretOffsetMatchesLastZone,
      targetSheetIndex: located.targetSheetIndex,
      targetSheetDatasetPageIndex: located.targetSheetDatasetPageIndex,
      firstSheetRect: located.firstSheetRect,
      targetRangeRect: located.selected.rect,
      targetRangeRectIntersectsFirstSheet: located.selected.rangeRectIntersectsFirstSheet,
      selectedRect: located.selected.rect,
      selectedChar: located.selected.char,
      selectedTextNodeOrder: located.selected.textNodeOrder,
      selectedCharOffset: located.selected.charOffset,
      distanceFromSheetBottom: located.selected.distanceFromSheetBottom,
      candidateCount: located.candidateCount,
      proseMirrorCount: located.host.querySelectorAll('.ProseMirror').length,
      tiptapEditorCount: located.host.querySelectorAll('.tiptap-editor').length,
    };
  })()\`, true);
}

async function findTwoSheetFixture(win) {
  let lastState = null;
  let lastZone = null;
  for (let paragraphCount = 1; paragraphCount <= 20; paragraphCount += 1) {
    await setEditorPayload(win, paragraphCount);
    await sleep(700);
    const state = await collectState(win, 'candidate-' + String(paragraphCount));
    const zone = await inspectLastFirstSheetTextZone(win);
    lastState = state;
    lastZone = zone;
    if (
      state.centralSheetFlow === 'horizontal'
      && state.visibleSheetCount >= 2
      && state.proseMirrorCount === 1
      && state.tiptapEditorCount === 1
      && state.prosePageTruthCount === 0
      && zone.ok
    ) {
      return { paragraphCount, state, zone };
    }
    if (state.centralSheetOverflowReason === 'max-page-count') {
      break;
    }
  }
  throw new Error('NO_TWO_SHEET_PAGE_BOUNDARY_FIXTURE ' + JSON.stringify({ lastState, lastZone }));
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
    const beforeInput = await collectState(win, 'before-input');
    const lastTextZone = await inspectLastFirstSheetTextZone(win);
    if (!lastTextZone.ok) {
      throw new Error('LAST_FIRST_SHEET_TEXT_ZONE_NOT_PROVABLE ' + JSON.stringify(lastTextZone));
    }
    await saveCapture(win, '06a-page-boundary-before-input.png');

    const caretPlacement = await placeCaretAtLastFirstSheetTextZone(win);
    if (!caretPlacement.ok) {
      throw new Error('LAST_FIRST_SHEET_CARET_PLACEMENT_NOT_PROVABLE ' + JSON.stringify(caretPlacement));
    }
    await sleep(150);

    const marker = '06A_BOUNDARY_INPUT';
    await win.webContents.insertText(marker);
    await sleep(900);
    const afterMarker = await collectState(win, 'after-marker');
    const preEnterHash = afterMarker.serializedHash;

    await pressKey(win, 'Enter');
    await sleep(900);
    const afterEnter = await collectState(win, 'after-enter');
    const postEnterHash = afterEnter.serializedHash;

    await pressKey(win, 'Z', [primaryModifier()]);
    await sleep(900);
    const afterUndoEnter = await collectState(win, 'after-undo-enter');
    await pressKey(win, 'Z', [primaryModifier()]);
    await sleep(900);
    const afterUndo = await collectState(win, 'after-undo-all');

    await pressKey(win, 'Z', [primaryModifier(), 'shift']);
    await sleep(900);
    const afterRedoMarker = await collectState(win, 'after-redo-marker');
    await pressKey(win, 'Z', [primaryModifier(), 'shift']);
    await sleep(900);
    const afterRedo = await collectState(win, 'after-redo-all');
    await saveCapture(win, '06a-page-boundary-after-redo.png');

    const payload = {
      ok: true,
      paragraphCount: fixture.paragraphCount,
      marker,
      fixture: fixture.state,
      beforeInput,
      lastTextZone,
      caretPlacement,
      afterMarker,
      afterEnter,
      afterUndoEnter,
      afterUndo,
      afterRedoMarker,
      afterRedo,
      preEnterHash,
      postEnterHash,
      undoHash: afterUndo.serializedHash,
      redoHash: afterRedo.serializedHash,
      lineBreakDelta: afterEnter.serializedLineBreakCount - afterMarker.serializedLineBreakCount,
      textWithoutLineBreaksStable: afterEnter.serializedText.replace(/\\n/gu, '') === afterMarker.serializedText.replace(/\\n/gu, ''),
      networkRequests,
      dialogCalls,
      screenshots: [
        path.join(outputDir, '06a-page-boundary-before-input.png'),
        path.join(outputDir, '06a-page-boundary-after-redo.png'),
      ],
    };
    await fs.writeFile(path.join(outputDir, 'result.json'), JSON.stringify(payload, null, 2));
    process.stdout.write('PAGE_BOUNDARY_INPUT_SMOKE_RESULT:' + JSON.stringify(payload) + '\\n');
    app.exit(0);
  } catch (error) {
    const payload = { ok: false, error: error && error.stack ? error.stack : String(error), networkRequests, dialogCalls };
    await fs.writeFile(path.join(outputDir, 'result.json'), JSON.stringify(payload, null, 2));
    process.stdout.write('PAGE_BOUNDARY_INPUT_SMOKE_RESULT:' + JSON.stringify(payload) + '\\n');
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
  throw new Error(`Electron page boundary input smoke failed with exit ${exitCode}`);
}

const result = JSON.parse(await readFile(path.join(outputDir, 'result.json'), 'utf8'));
if (!result.ok) {
  throw new Error(result.error || 'Electron page boundary input smoke returned not ok');
}

const states = [
  result.beforeInput,
  result.afterMarker,
  result.afterEnter,
  result.afterUndoEnter,
  result.afterUndo,
  result.afterRedoMarker,
  result.afterRedo,
];

for (const state of states) {
  assert.equal(state.proseMirrorCount, 1, `${state.label} must keep one ProseMirror`);
  assert.equal(state.tiptapEditorCount, 1, `${state.label} must keep one Tiptap editor shell`);
  assert.equal(state.prosePageTruthCount, 0, `${state.label} must not create page truth inside ProseMirror`);
  assert.equal(state.activeElementInsideProse || state.label === 'before-input', true, `${state.label} must keep focus inside ProseMirror after input starts`);
  assert.equal(state.rightInspectorVisible, true, `${state.label} must keep right inspector visible`);
}

assert.equal(result.fixture.centralSheetFlow, 'horizontal', 'fixture must use central sheet horizontal flow');
assert.equal(result.beforeInput.sourcePageCount, 2, 'baseline source page count must be exactly two');
assert.ok(result.beforeInput.visibleSheetCount >= 2, 'baseline text must show at least two visible sheets');
assert.equal(result.lastTextZone.ok, true, 'last editable text zone on first visible sheet must be proven');
assert.equal(result.lastTextZone.targetSheetIndex, 0, 'last text zone target sheet index must be zero');
assert.equal(result.lastTextZone.targetSheetDatasetPageIndex, 0, 'last text zone dataset page index must be zero');
assert.equal(
  result.lastTextZone.targetRangeRectIntersectsFirstSheet,
  true,
  'last text zone range rect must intersect the first sheet rect'
);
assert.equal(
  result.lastTextZone.proofStrength,
  'RENDERED_LAST_FIRST_SHEET_CHARACTER_RECT',
  'last editable text zone proof must come from rendered character geometry'
);
assert.ok(result.lastTextZone.candidateCount > 0, 'last text zone proof must inspect rendered characters');
assert.equal(result.caretPlacement.ok, true, 'caret must be placed at the last first-sheet text zone');
assert.equal(result.caretPlacement.targetSheetIndex, 0, 'caret target sheet index must be zero');
assert.equal(result.caretPlacement.targetSheetDatasetPageIndex, 0, 'caret target dataset page index must be zero');
assert.equal(
  result.caretPlacement.targetRangeRectIntersectsFirstSheet,
  true,
  'caret target range rect must intersect the first sheet rect'
);
assert.equal(
  result.caretPlacement.proofStrength,
  'DOM_RANGE_AFTER_RENDERED_LAST_FIRST_SHEET_CHARACTER',
  'caret proof must use DOM range immediately after the rendered last first-sheet character'
);
assert.equal(result.caretPlacement.caretOffsetMatchesLastZone, true, 'caret offset must match the last first-sheet text zone');
assert.equal(result.caretPlacement.activeElementInsideProse, true, 'active element must start inside ProseMirror');
assert.equal(result.caretPlacement.selectionInsideProse, true, 'selection must start inside ProseMirror');
assert.equal(markerCount(result.afterMarker.serializedText, result.marker), 1, 'typed marker must appear once before Enter');
assert.equal(markerCount(result.afterEnter.serializedText, result.marker), 1, 'typed marker must appear once after Enter');
assert.equal(result.lineBreakDelta, 1, 'Enter must create exactly one serialized line break delta');
assert.equal(result.textWithoutLineBreaksStable, true, 'Enter must not mutate text except for the expected line break');
assert.equal(result.afterUndoEnter.serializedHash, result.preEnterHash, 'first undo must return to pre-Enter hash');
assert.equal(result.afterUndo.serializedHash, result.beforeInput.serializedHash, 'second undo must return to pre-edit hash');
assert.equal(result.afterRedo.serializedHash, result.postEnterHash, 'redo must return to post-Enter hash');
assert.equal(markerCount(result.afterUndoEnter.serializedText, result.marker), 1, 'first undo must preserve typed marker once');
assert.equal(markerCount(result.afterUndo.serializedText, result.marker), 0, 'second undo must remove typed marker');
assert.equal(markerCount(result.afterRedoMarker.serializedText, result.marker), 1, 'first redo must restore typed marker once');
assert.equal(markerCount(result.afterRedo.serializedText, result.marker), 1, 'redo must preserve typed marker once');
assert.equal(result.afterRedo.activeElementInsideProse, true, 'active element must remain inside ProseMirror after redo');
assert.equal(result.afterRedo.selectionInsideProse, true, 'selection must remain inside ProseMirror after redo');
assert.equal(result.networkRequests, 0, 'smoke must not trigger network requests');
assert.equal(result.dialogCalls, 0, 'smoke must not trigger dialogs');
assert.notEqual(
  hashText(result.beforeInput.serializedText),
  hashText(result.afterRedo.serializedText),
  'post-redo hash should differ from baseline only because controlled input was applied'
);

const summary = {
  outputDir,
  paragraphCount: result.paragraphCount,
  sourcePageCount: result.beforeInput.sourcePageCount,
  visibleSheetCount: result.afterRedo.visibleSheetCount,
  proseMirrorCount: result.afterRedo.proseMirrorCount,
  tiptapEditorCount: result.afterRedo.tiptapEditorCount,
  prosePageTruthCount: result.afterRedo.prosePageTruthCount,
  lastTextZoneProofStrength: result.lastTextZone.proofStrength,
  caretProofStrength: result.caretPlacement.proofStrength,
  targetSheetIndex: result.caretPlacement.targetSheetIndex,
  targetSheetDatasetPageIndex: result.caretPlacement.targetSheetDatasetPageIndex,
  targetRangeRectIntersectsFirstSheet: result.caretPlacement.targetRangeRectIntersectsFirstSheet,
  lastTextZoneCandidateCount: result.lastTextZone.candidateCount,
  distanceFromFirstSheetBottom: result.lastTextZone.distanceFromSheetBottom,
  markerAfterMarker: markerCount(result.afterMarker.serializedText, result.marker),
  markerAfterEnter: markerCount(result.afterEnter.serializedText, result.marker),
  markerAfterUndoEnter: markerCount(result.afterUndoEnter.serializedText, result.marker),
  markerAfterUndo: markerCount(result.afterUndo.serializedText, result.marker),
  markerAfterRedoMarker: markerCount(result.afterRedoMarker.serializedText, result.marker),
  markerAfterRedo: markerCount(result.afterRedo.serializedText, result.marker),
  lineBreakDelta: result.lineBreakDelta,
  firstUndoReturnedToPreEnterHash: result.afterUndoEnter.serializedHash === result.preEnterHash,
  secondUndoReturnedToPreEditHash: result.afterUndo.serializedHash === result.beforeInput.serializedHash,
  redoReturnedToPostEnterHash: result.afterRedo.serializedHash === result.postEnterHash,
  activeElementInsideProse: result.afterRedo.activeElementInsideProse,
  selectionInsideProse: result.afterRedo.selectionInsideProse,
  rightInspectorVisible: result.afterRedo.rightInspectorVisible,
  networkRequests: result.networkRequests,
  dialogCalls: result.dialogCalls,
  screenshots: result.screenshots.map((item) => path.basename(item)),
};

process.stdout.write(`PAGE_BOUNDARY_INPUT_SMOKE_SUMMARY:${JSON.stringify(summary)}\n`);

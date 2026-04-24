import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const rootDir = path.resolve(new URL('../..', import.meta.url).pathname);
const requireFromHere = createRequire(import.meta.url);
const electronBinary = requireFromHere('electron');
const outputDir = process.env.BOUNDARY_SELECTION_REPLACE_OUT_DIR
  ? path.resolve(process.env.BOUNDARY_SELECTION_REPLACE_OUT_DIR)
  : await mkdtemp(path.join(os.tmpdir(), '06c-boundary-selection-replace-'));

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
let networkRequests = 0;
let dialogCalls = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

function buildPlainText(paragraphCount) {
  const sentence = 'Derived sheet selection replace proof paragraph for a visual sheet boundary over one Tiptap editor.';
  return Array.from({ length: paragraphCount }, (_, index) => {
    const token = '06C_SELECT_TARGET_' + String(index + 1).padStart(2, '0');
    return sentence + ' ' + String(index + 1) + '. ' + sentence + ' ' + token + ' ' + sentence;
  }).join('\\n\\n');
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
    title: 'boundary-selection-replace-smoke',
    path: '',
    kind: 'chapter-file',
    metaEnabled: true,
    projectId: 'boundary-selection-replace-smoke',
    bookProfile: null,
  });
}

async function saveCapture(win, basename) {
  const image = await win.webContents.capturePage();
  await fs.writeFile(path.join(outputDir, basename), image.toPNG());
}

async function collectState(win, label, selectedText, marker) {
  return win.webContents.executeJavaScript(\`((payload) => {
    const countOccurrences = (text, needle) => needle ? String(text).split(needle).length - 1 : 0;
    const stableTextHash = (value) => {
      let hash = 2166136261;
      for (const char of String(value)) {
        hash ^= char.codePointAt(0);
        hash = Math.imul(hash, 16777619);
      }
      return (hash >>> 0).toString(16).padStart(8, '0');
    };
    const host = document.querySelector('#editor.tiptap-host');
    const strip = host ? host.querySelector('.tiptap-sheet-strip') : null;
    const prose = host ? host.querySelector('.ProseMirror') : null;
    const rightSidebar = document.querySelector('[data-right-sidebar]');
    const sourceWraps = host ? [...host.querySelectorAll(':scope > .tiptap-page-wrap')] : [];
    const derivedWraps = strip ? [...strip.querySelectorAll(':scope > .tiptap-page-wrap')] : [];
    const pageRects = derivedWraps.map((el, index) => {
      const rect = el.getBoundingClientRect();
      return { index, x: rect.x, y: rect.y, width: rect.width, height: rect.height, top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right };
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
    const text = prose ? prose.textContent || '' : '';
    const prosePageTruthCount = prose
      ? prose.querySelectorAll('[data-page-index], [data-page-number], [data-page-id]').length
      : 0;
    return {
      label: payload.label,
      centralSheetFlow: host ? host.dataset.centralSheetFlow || null : null,
      centralSheetOverflowReason: host ? host.dataset.centralSheetOverflowReason || null : null,
      text,
      textLength: text.length,
      textHash: stableTextHash(text),
      selectedTextOccurrence: countOccurrences(text, payload.selectedText),
      markerOccurrence: countOccurrences(text, payload.marker),
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
      browserSelectionText: selection ? selection.toString() : '',
      rightInspectorVisible: Boolean(rightSidebarRect && rightSidebarRect.width >= 280 && rightSidebarRect.height > 0),
      rightInspectorWidth: rightSidebarRect ? rightSidebarRect.width : 0,
      pageRects,
      selectionRect,
    };
  })(\${JSON.stringify({ label, selectedText, marker })})\`, true);
}

async function lockBoundarySelection(win) {
  return win.webContents.executeJavaScript(\`(() => {
    const host = document.querySelector('#editor.tiptap-host');
    const strip = host ? host.querySelector('.tiptap-sheet-strip') : null;
    const prose = host ? host.querySelector('.ProseMirror') : null;
    const derivedWraps = strip ? [...strip.querySelectorAll(':scope > .tiptap-page-wrap')] : [];
    const firstSheet = derivedWraps[0] || null;
    if (!host || !strip || !prose || !firstSheet) {
      return { ok: false, reason: 'SURFACE_MISSING' };
    }

    const firstSheetRect = firstSheet.getBoundingClientRect();
    const pageRects = derivedWraps.map((el, index) => {
      const rect = el.getBoundingClientRect();
      return { index, x: rect.x, y: rect.y, width: rect.width, height: rect.height, top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right };
    });
    const candidates = [];
    const fallbackCandidates = [];
    const walker = document.createTreeWalker(prose, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        return (node.textContent || '').trim()
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_SKIP;
      },
    });

    let current = walker.nextNode();
    while (current) {
      const text = current.textContent || '';
      const wordPattern = /[A-Za-z0-9_]{4,}/gu;
      let match = wordPattern.exec(text);
      while (match) {
        const selectedText = match[0];
        if (selectedText.startsWith('06C_REPLACED_')) {
          match = wordPattern.exec(text);
          continue;
        }
        const range = document.createRange();
        range.setStart(current, match.index);
        range.setEnd(current, match.index + selectedText.length);
        const rects = [...range.getClientRects()].filter((rect) => rect.width > 2 && rect.height > 2);
        const firstRect = rects[0] || null;
        if (firstRect) {
          const centerX = firstRect.left + firstRect.width / 2;
          const centerY = firstRect.top + firstRect.height / 2;
          const sheetIndex = pageRects.findIndex((rect) => (
            centerX >= rect.left && centerX <= rect.right && centerY >= rect.top && centerY <= rect.bottom
          ));
          const distanceFromSheetBottom = firstSheetRect.bottom - firstRect.bottom;
          const record = {
            textNode: current,
            startOffset: match.index,
            endOffset: match.index + selectedText.length,
            selectedText,
            rect: {
              x: firstRect.x,
              y: firstRect.y,
              width: firstRect.width,
              height: firstRect.height,
              top: firstRect.top,
              bottom: firstRect.bottom,
              left: firstRect.left,
              right: firstRect.right,
            },
            distanceFromSheetBottom,
            sheetIndex,
          };
          if (sheetIndex === 0 && distanceFromSheetBottom >= 24 && distanceFromSheetBottom <= 220) {
            candidates.push(record);
          }
          if (sheetIndex === 0 && distanceFromSheetBottom >= 0) {
            fallbackCandidates.push(record);
          }
        }
        match = wordPattern.exec(text);
      }
      current = walker.nextNode();
    }

    candidates.sort((a, b) => a.distanceFromSheetBottom - b.distanceFromSheetBottom);
    fallbackCandidates.sort((a, b) => a.distanceFromSheetBottom - b.distanceFromSheetBottom);
    const selected = candidates
      .filter((item) => item.selectedText.startsWith('06C_SELECT_TARGET_'))
      .find((item) => (prose.textContent || '').split(item.selectedText).length - 1 === 1)
      || null;
    if (!selected) {
      return {
        ok: false,
        reason: 'NO_UNIQUE_SELECT_TARGET_IN_SAFE_BOUNDARY_BAND',
        safeBandMin: 24,
        safeBandMax: 220,
        candidateCount: candidates.length,
        uniqueTargetCandidateCount: candidates.filter((item) => item.selectedText.startsWith('06C_SELECT_TARGET_')).length,
        fallbackCandidate: fallbackCandidates[0]
          ? {
            selectedText: fallbackCandidates[0].selectedText,
            rect: fallbackCandidates[0].rect,
            distanceFromSheetBottom: fallbackCandidates[0].distanceFromSheetBottom,
            sheetIndex: fallbackCandidates[0].sheetIndex,
          }
          : null,
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
        pageRects,
      };
    }

    const range = document.createRange();
    range.setStart(selected.textNode, selected.startOffset);
    range.setEnd(selected.textNode, selected.endOffset);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    prose.focus();

    const selectedText = selection.toString();
    const selectionRectRaw = range.getBoundingClientRect();
    const selectionRect = {
      x: selectionRectRaw.x,
      y: selectionRectRaw.y,
      width: selectionRectRaw.width,
      height: selectionRectRaw.height,
      top: selectionRectRaw.top,
      bottom: selectionRectRaw.bottom,
      left: selectionRectRaw.left,
      right: selectionRectRaw.right,
    };
    const selectionNode = range.commonAncestorContainer;
    const selectionElement = selectionNode && selectionNode.nodeType === Node.TEXT_NODE
      ? selectionNode.parentElement
      : selectionNode;
    const activeElementInsideProseMirror = document.activeElement === prose || prose.contains(document.activeElement);
    const selectionInsideProseMirror = Boolean(selectionElement && (selectionElement === prose || prose.contains(selectionElement)));
    const selectionRectInsideBoundarySafeBand = (
      selectionRect.left >= firstSheetRect.left
      && selectionRect.right <= firstSheetRect.right
      && selectionRect.top >= firstSheetRect.top
      && selectionRect.bottom <= firstSheetRect.bottom
      && firstSheetRect.bottom - selectionRect.bottom >= 24
      && firstSheetRect.bottom - selectionRect.bottom <= 220
    );

    return {
      ok: Boolean(
        selectedText
        && selectedText === selected.selectedText
        && selectionInsideProseMirror
        && activeElementInsideProseMirror
        && selectionRectInsideBoundarySafeBand
      ),
      reason: null,
      selectedText,
      selectedTextLength: selectedText.length,
      candidateCount: candidates.length,
      selectionRect,
      selectedTokenRect: selected.rect,
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
      pageRects,
      sheetIndex: selected.sheetIndex,
      distanceFromSheetBottom: selected.distanceFromSheetBottom,
      selectionInsideProseMirror,
      activeElementInsideProseMirror,
      selectionRectInsideBoundarySafeBand,
      proseMirrorCount: host.querySelectorAll('.ProseMirror').length,
      tiptapEditorCount: host.querySelectorAll('.tiptap-editor').length,
      derivedSheetProseMirrorCount: derivedWraps.reduce((sum, el) => sum + el.querySelectorAll('.ProseMirror').length, 0),
      derivedSheetEditorCount: derivedWraps.reduce((sum, el) => sum + el.querySelectorAll('.tiptap-editor').length, 0),
    };
  })()\`, true);
}

async function findTwoSheetFixture(win) {
  let lastState = null;
  let lastBoundarySelection = null;
  for (let paragraphCount = 1; paragraphCount <= 20; paragraphCount += 1) {
    await setEditorPayload(win, paragraphCount);
    await sleep(700);
    const state = await collectState(win, 'candidate-' + String(paragraphCount), '', '');
    const boundarySelection = await lockBoundarySelection(win);
    lastState = state;
    lastBoundarySelection = boundarySelection;
    if (
      state.centralSheetFlow === 'horizontal'
      && state.sourceWrapperCount === 1
      && state.sourceEditorWrapperCount === 1
      && state.derivedSheetCount >= 2
      && state.derivedSheetProseMirrorCount === 0
      && state.derivedSheetEditorCount === 0
      && state.proseMirrorCount === 1
      && state.tiptapEditorCount === 1
      && state.prosePageTruthCount === 0
      && boundarySelection.ok
      && boundarySelection.sheetIndex === 0
    ) {
      return { paragraphCount, state, boundarySelection };
    }
    if (state.centralSheetOverflowReason === 'max-page-count') {
      break;
    }
  }
  throw new Error('NO_TWO_SHEET_BOUNDARY_SELECTION_FIXTURE ' + JSON.stringify({ lastState, lastBoundarySelection }));
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
    const marker = '06C_REPLACED_SELECTION_MARKER';
    const selectionPlacement = await lockBoundarySelection(win);
    if (!selectionPlacement.ok) {
      throw new Error('BOUNDARY_SELECTION_NOT_PROVABLE ' + JSON.stringify(selectionPlacement));
    }
    const beforeReplace = await collectState(win, 'before-replace', selectionPlacement.selectedText, marker);
    if (beforeReplace.browserSelectionText !== selectionPlacement.selectedText) {
      throw new Error('BROWSER_SELECTION_TEXT_MISMATCH ' + JSON.stringify({ beforeReplace, selectionPlacement }));
    }
    if (beforeReplace.selectedTextOccurrence < 1) {
      throw new Error('SELECTED_TEXT_NOT_FOUND_BEFORE_REPLACE ' + JSON.stringify(beforeReplace));
    }
    if (beforeReplace.markerOccurrence !== 0) {
      throw new Error('MARKER_ALREADY_PRESENT_BEFORE_REPLACE ' + JSON.stringify(beforeReplace));
    }
    await saveCapture(win, '06c-before-selection-replace.png');

    await win.webContents.insertText(marker);
    await sleep(800);
    const afterReplace = await collectState(win, 'after-replace', selectionPlacement.selectedText, marker);
    await saveCapture(win, '06c-after-selection-replace.png');

    const metrics = {
      paragraphCount: fixture.paragraphCount,
      marker,
      selectedText: selectionPlacement.selectedText,
      selectedTextLength: selectionPlacement.selectedTextLength,
      selectedTextOccurrenceBefore: beforeReplace.selectedTextOccurrence,
      selectedTextOccurrenceAfter: afterReplace.selectedTextOccurrence,
      markerOccurrenceBefore: beforeReplace.markerOccurrence,
      markerOccurrenceAfter: afterReplace.markerOccurrence,
      textHashBefore: beforeReplace.textHash,
      textHashAfter: afterReplace.textHash,
      textLengthBefore: beforeReplace.textLength,
      textLengthAfter: afterReplace.textLength,
      expectedTextLengthAfter: beforeReplace.textLength - selectionPlacement.selectedText.length + marker.length,
      textLengthChangedAsExpected: afterReplace.textLength === beforeReplace.textLength - selectionPlacement.selectedText.length + marker.length,
      textHashChanged: beforeReplace.textHash !== afterReplace.textHash,
      activeElementInsideProseMirror: afterReplace.activeElementInsideProseMirror,
      selectionInsideProseMirror: afterReplace.selectionInsideProseMirror,
      proseMirrorCount: afterReplace.proseMirrorCount,
      tiptapEditorCount: afterReplace.tiptapEditorCount,
      sourceWrapperCount: afterReplace.sourceWrapperCount,
      sourceEditorWrapperCount: afterReplace.sourceEditorWrapperCount,
      derivedSheetCount: afterReplace.derivedSheetCount,
      derivedSheetEditorCount: afterReplace.derivedSheetEditorCount,
      derivedSheetProseMirrorCount: afterReplace.derivedSheetProseMirrorCount,
      prosePageTruthCount: afterReplace.prosePageTruthCount,
      centralSheetFlow: afterReplace.centralSheetFlow,
      centralSheetOverflowReason: afterReplace.centralSheetOverflowReason,
      visibleSheetCount: afterReplace.visibleSheetCount,
      rightInspectorVisible: afterReplace.rightInspectorVisible,
      networkRequests,
      dialogCalls,
      selectionRectInsideBoundarySafeBand: selectionPlacement.selectionRectInsideBoundarySafeBand,
      selectedTokenSheetIndex: selectionPlacement.sheetIndex,
      distanceFromFirstSheetBottom: selectionPlacement.distanceFromSheetBottom,
    };

    const payload = {
      ok: true,
      marker,
      fixture: fixture.state,
      selectionPlacement,
      beforeReplace,
      afterReplace,
      metrics,
      networkRequests,
      dialogCalls,
      screenshots: [
        path.join(outputDir, '06c-before-selection-replace.png'),
        path.join(outputDir, '06c-after-selection-replace.png'),
      ],
    };
    await fs.writeFile(path.join(outputDir, 'result.json'), JSON.stringify(payload, null, 2));
    process.stdout.write('BOUNDARY_SELECTION_REPLACE_SMOKE_RESULT:' + JSON.stringify(payload) + '\\n');
    app.exit(0);
  } catch (error) {
    const payload = { ok: false, error: error && error.stack ? error.stack : String(error), networkRequests, dialogCalls };
    await fs.writeFile(path.join(outputDir, 'result.json'), JSON.stringify(payload, null, 2));
    process.stdout.write('BOUNDARY_SELECTION_REPLACE_SMOKE_RESULT:' + JSON.stringify(payload) + '\\n');
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
  throw new Error(`Electron boundary selection replace smoke failed with exit ${exitCode}`);
}

const result = JSON.parse(await readFile(path.join(outputDir, 'result.json'), 'utf8'));
if (!result.ok) {
  throw new Error(result.error || 'Electron boundary selection replace smoke returned not ok');
}

const states = [
  result.beforeReplace,
  result.afterReplace,
];

for (const state of states) {
  assert.equal(state.proseMirrorCount, 1, `${state.label} must keep one ProseMirror`);
  assert.equal(state.tiptapEditorCount, 1, `${state.label} must keep one Tiptap editor shell`);
  assert.equal(state.sourceWrapperCount, 1, `${state.label} must keep one direct source editor wrapper`);
  assert.equal(state.sourceEditorWrapperCount, 1, `${state.label} must keep one source editor wrapper with editor content`);
  assert.equal(state.sourceWrapperProseMirrorCount, 1, `${state.label} source wrapper must contain one ProseMirror`);
  assert.equal(state.sourceWrapperTiptapEditorCount, 1, `${state.label} source wrapper must contain one Tiptap editor shell`);
  assert.equal(state.derivedSheetCount >= 2, true, `${state.label} must keep at least two derived strip wrappers`);
  assert.equal(state.derivedSheetProseMirrorCount, 0, `${state.label} derived wrappers must not contain ProseMirror`);
  assert.equal(state.derivedSheetEditorCount, 0, `${state.label} derived wrappers must not contain Tiptap editor shell`);
  assert.equal(state.prosePageTruthCount, 0, `${state.label} must not create page truth inside ProseMirror`);
}

assert.equal(result.fixture.centralSheetFlow, 'horizontal', 'fixture must use central sheet horizontal flow');
assert.equal(result.beforeReplace.centralSheetOverflowReason, null, 'runtime positive guard must not use overflow fallback');
assert.equal(result.afterReplace.centralSheetOverflowReason, null, 'runtime positive guard must not overflow after replace');
assert.equal(result.selectionPlacement.ok, true, 'boundary selection must be placed');
assert.equal(result.selectionPlacement.selectedTextLength > 0, true, 'boundary selection must be non-empty');
assert.equal(result.selectionPlacement.sheetIndex, 0, 'selection token must be on the first derived sheet');
assert.equal(
  result.selectionPlacement.selectionRectInsideBoundarySafeBand,
  true,
  'browser Range selection must stay in the first sheet boundary safe band'
);
assert.equal(result.selectionPlacement.selectionInsideProseMirror, true, 'selection must start inside ProseMirror');
assert.equal(result.selectionPlacement.activeElementInsideProseMirror, true, 'active element must start inside ProseMirror');
assert.equal(
  result.beforeReplace.browserSelectionText,
  result.selectionPlacement.selectedText,
  'browser selection text must equal locked selected text before replacement'
);
assert.equal(result.beforeReplace.markerOccurrence, 0, 'marker must not exist before replacement');
assert.equal(result.beforeReplace.selectedTextOccurrence, 1, 'locked target text must be unique before replacement');
assert.equal(
  result.afterReplace.selectedTextOccurrence,
  result.beforeReplace.selectedTextOccurrence - 1,
  'replacing selection must remove exactly one selected text occurrence'
);
assert.equal(result.afterReplace.markerOccurrence, 1, 'replacement marker must appear exactly once');
assert.equal(
  result.afterReplace.textLength,
  result.beforeReplace.textLength - result.selectionPlacement.selectedText.length + result.marker.length,
  'replacement must produce the expected text length delta'
);
assert.notEqual(result.afterReplace.textHash, result.beforeReplace.textHash, 'replacement must change text hash');
assert.equal(result.afterReplace.activeElementInsideProseMirror, true, 'active element must remain inside ProseMirror after replace');
assert.equal(result.afterReplace.selectionInsideProseMirror, true, 'selection must remain inside ProseMirror after replace');
assert.equal(result.afterReplace.rightInspectorVisible, true, 'right inspector must remain visible');
assert.equal(result.networkRequests, 0, 'smoke must not trigger network requests');
assert.equal(result.dialogCalls, 0, 'smoke must not trigger dialogs');

const metrics = {
  outputDir,
  selectedText: result.metrics.selectedText,
  selectedTextOccurrenceBefore: result.metrics.selectedTextOccurrenceBefore,
  selectedTextOccurrenceAfter: result.metrics.selectedTextOccurrenceAfter,
  markerOccurrenceAfter: result.metrics.markerOccurrenceAfter,
  textHashBefore: result.metrics.textHashBefore,
  textHashAfter: result.metrics.textHashAfter,
  textLengthChangedAsExpected: result.metrics.textLengthChangedAsExpected,
  expectedTextLengthAfter: result.metrics.expectedTextLengthAfter,
  textLengthAfter: result.metrics.textLengthAfter,
  textHashChanged: result.metrics.textHashChanged,
  activeElementInsideProseMirror: result.metrics.activeElementInsideProseMirror,
  proseMirrorCount: result.metrics.proseMirrorCount,
  tiptapEditorCount: result.metrics.tiptapEditorCount,
  derivedSheetEditorCount: result.metrics.derivedSheetEditorCount,
  derivedSheetProseMirrorCount: result.metrics.derivedSheetProseMirrorCount,
  prosePageTruthCount: result.metrics.prosePageTruthCount,
  rightInspectorVisible: result.metrics.rightInspectorVisible,
  networkRequests: result.metrics.networkRequests,
  dialogCalls: result.metrics.dialogCalls,
  selectionRectInsideBoundarySafeBand: result.metrics.selectionRectInsideBoundarySafeBand,
  selectedTokenSheetIndex: result.metrics.selectedTokenSheetIndex,
  distanceFromFirstSheetBottom: result.metrics.distanceFromFirstSheetBottom,
  screenshots: result.screenshots.map((item) => path.basename(item)),
};

assert.equal(
  metrics.selectedTextOccurrenceAfter,
  metrics.selectedTextOccurrenceBefore - 1,
  'summary metrics must prove selected text occurrence decreased by one'
);
assert.equal(metrics.markerOccurrenceAfter, 1, 'summary metrics must prove marker appears once');
assert.equal(metrics.textLengthChangedAsExpected, true, 'summary metrics must prove exact text length delta');
assert.equal(metrics.textHashChanged, true, 'summary metrics must prove text hash changed');
assert.equal(metrics.activeElementInsideProseMirror, true, 'summary metrics must prove ProseMirror focus');
assert.equal(metrics.proseMirrorCount, 1, 'summary metrics must prove one ProseMirror');
assert.equal(metrics.tiptapEditorCount, 1, 'summary metrics must prove one Tiptap editor');
assert.equal(metrics.derivedSheetEditorCount, 0, 'summary metrics must prove no derived sheet editors');
assert.equal(metrics.derivedSheetProseMirrorCount, 0, 'summary metrics must prove no derived sheet ProseMirror');
assert.equal(metrics.prosePageTruthCount, 0, 'summary metrics must prove no page truth inside ProseMirror');
assert.equal(metrics.rightInspectorVisible, true, 'summary metrics must prove right inspector visible');
assert.equal(metrics.networkRequests, 0, 'summary metrics must prove zero network requests');
assert.equal(metrics.dialogCalls, 0, 'summary metrics must prove zero dialog calls');

process.stdout.write(`BOUNDARY_SELECTION_REPLACE_SMOKE_METRICS:${JSON.stringify(metrics)}\n`);

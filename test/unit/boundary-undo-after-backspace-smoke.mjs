import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const rootDir = path.resolve(new URL('../..', import.meta.url).pathname);
const requireFromHere = createRequire(import.meta.url);
const electronBinary = requireFromHere('electron');
const outputDir = process.env.BOUNDARY_UNDO_AFTER_BACKSPACE_OUT_DIR
  ? path.resolve(process.env.BOUNDARY_UNDO_AFTER_BACKSPACE_OUT_DIR)
  : await mkdtemp(path.join(os.tmpdir(), '06e-a-boundary-undo-backspace-'));

function exactTokenCount(text, token) {
  const source = String(text);
  const escaped = String(token).replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  const pattern = new RegExp(`(^|[^A-Za-z0-9_])${escaped}(?=$|[^A-Za-z0-9_])`, 'gu');
  return [...source.matchAll(pattern)].length;
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
const fullTarget = '06E_UNDO_BS_TARGET_01X';
const truncatedTarget = '06E_UNDO_BS_TARGET_01';
let networkRequests = 0;
let dialogCalls = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function exactTokenCount(text, token) {
  const source = String(text);
  const safeToken = String(token);
  if (!/^[A-Za-z0-9_]+$/u.test(safeToken)) {
    throw new Error('UNSAFE_TOKEN_FOR_EXACT_COUNT');
  }
  const pattern = new RegExp('(^|[^A-Za-z0-9_])' + safeToken + '(?=$|[^A-Za-z0-9_])', 'gu');
  return [...source.matchAll(pattern)].length;
}

function stableTextHash(text) {
  let hash = 2166136261;
  for (const char of String(text)) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function primaryModifier() {
  return process.platform === 'darwin' ? 'meta' : 'control';
}

function buildParagraph(index, extra = '') {
  const sentence = 'Boundary backspace stability paragraph for a visual sheet boundary over one Tiptap editor.';
  return sentence + ' ' + String(index + 1) + '. ' + sentence + (extra ? ' ' + extra + ' ' : ' ') + sentence;
}

function buildPlainText(beforeParagraphCount, afterParagraphCount) {
  const before = Array.from({ length: beforeParagraphCount }, (_, index) => buildParagraph(index));
  const target = buildParagraph(beforeParagraphCount, fullTarget);
  const after = Array.from({ length: afterParagraphCount }, (_, index) => (
    buildParagraph(beforeParagraphCount + index + 1)
  ));
  return [...before, target, ...after].join('\\n\\n');
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

async function setEditorPayload(win, beforeParagraphCount, afterParagraphCount) {
  win.webContents.send('editor:set-text', {
    content: buildPlainText(beforeParagraphCount, afterParagraphCount),
    title: 'boundary-undo-after-backspace-smoke',
    path: '',
    kind: 'chapter-file',
    metaEnabled: true,
    projectId: 'boundary-undo-after-backspace-smoke',
    bookProfile: null,
  });
}

async function collectState(win, label) {
  return win.webContents.executeJavaScript(\`((payload) => {
    const fullTarget = payload.fullTarget;
    const truncatedTarget = payload.truncatedTarget;
    const exactTokenCount = (text, token) => {
      const source = String(text);
      const safeToken = String(token);
      if (!/^[A-Za-z0-9_]+$/u.test(safeToken)) {
        throw new Error('UNSAFE_TOKEN_FOR_EXACT_COUNT');
      }
      const pattern = new RegExp('(^|[^A-Za-z0-9_])' + safeToken + '(?=$|[^A-Za-z0-9_])', 'gu');
      return [...source.matchAll(pattern)].length;
    };
    const stableTextHash = (value) => {
      let hash = 2166136261;
      for (const char of String(value)) {
        hash ^= char.codePointAt(0);
        hash = Math.imul(hash, 16777619);
      }
      return (hash >>> 0).toString(16).padStart(8, '0');
    };
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
    const host = document.querySelector('#editor.tiptap-host');
    const strip = host ? host.querySelector('.tiptap-sheet-strip') : null;
    const prose = host ? host.querySelector('.ProseMirror') : null;
    const rightSidebar = document.querySelector('[data-right-sidebar]');
    const sourceWraps = host ? [...host.querySelectorAll(':scope > .tiptap-page-wrap')] : [];
    const derivedWraps = strip ? [...strip.querySelectorAll(':scope > .tiptap-page-wrap')] : [];
    const rightSidebarRect = rightSidebar ? rightSidebar.getBoundingClientRect() : null;
    const selection = window.getSelection();
    const selectionNode = selection && selection.rangeCount
      ? selection.getRangeAt(0).commonAncestorContainer
      : null;
    const selectionElement = selectionNode && selectionNode.nodeType === Node.TEXT_NODE
      ? selectionNode.parentElement
      : selectionNode;
    const selectionRect = selection && selection.rangeCount
      ? toPlainRect(selection.getRangeAt(0).getBoundingClientRect())
      : null;
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
      fullTargetCount: exactTokenCount(text, fullTarget),
      truncatedTargetCount: exactTokenCount(text, truncatedTarget),
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
      caretCollapsed: Boolean(selection && selection.rangeCount === 1 && selection.isCollapsed),
      activeElementInsideProseMirror: Boolean(prose && (document.activeElement === prose || prose.contains(document.activeElement))),
      selectionInsideProseMirror: Boolean(prose && selectionElement && (selectionElement === prose || prose.contains(selectionElement))),
      browserSelectionText: selection ? selection.toString() : '',
      rightInspectorVisible: Boolean(rightSidebarRect && rightSidebarRect.width >= 280 && rightSidebarRect.height > 0),
      rightInspectorWidth: rightSidebarRect ? rightSidebarRect.width : 0,
      selectionRect,
    };
  })(\${JSON.stringify({ label, fullTarget, truncatedTarget })})\`, true);
}

async function placeCaretAfterTargetSentinel(win) {
  return win.webContents.executeJavaScript(\`((payload) => {
    const fullTarget = payload.fullTarget;
    const truncatedTarget = payload.truncatedTarget;
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
    const exactTokenCount = (text, token) => {
      const source = String(text);
      const safeToken = String(token);
      if (!/^[A-Za-z0-9_]+$/u.test(safeToken)) {
        throw new Error('UNSAFE_TOKEN_FOR_EXACT_COUNT');
      }
      const pattern = new RegExp('(^|[^A-Za-z0-9_])' + safeToken + '(?=$|[^A-Za-z0-9_])', 'gu');
      return [...source.matchAll(pattern)].length;
    };
    const host = document.querySelector('#editor.tiptap-host');
    const strip = host ? host.querySelector('.tiptap-sheet-strip') : null;
    const prose = host ? host.querySelector('.ProseMirror') : null;
    const derivedWraps = strip ? [...strip.querySelectorAll(':scope > .tiptap-page-wrap')] : [];
    const firstSheet = derivedWraps[0] || null;
    if (!host || !strip || !prose || !firstSheet) {
      return { ok: false, reason: 'SURFACE_MISSING' };
    }
    const text = prose.textContent || '';
    const fullTargetCount = exactTokenCount(text, fullTarget);
    const truncatedTargetCount = exactTokenCount(text, truncatedTarget);
    const firstSheetRectRaw = firstSheet.getBoundingClientRect();
    const firstSheetRect = toPlainRect(firstSheetRectRaw);
    const pageRects = derivedWraps.map((el, index) => ({ index, ...toPlainRect(el.getBoundingClientRect()) }));
    const walker = document.createTreeWalker(prose, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        return node.textContent && node.textContent.includes(fullTarget)
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_SKIP;
      },
    });
    const matches = [];
    let current = walker.nextNode();
    while (current) {
      let from = 0;
      let index = current.textContent.indexOf(fullTarget, from);
      while (index !== -1) {
        const targetRange = document.createRange();
        targetRange.setStart(current, index);
        targetRange.setEnd(current, index + fullTarget.length);
        const sentinelRange = document.createRange();
        sentinelRange.setStart(current, index + fullTarget.length - 1);
        sentinelRange.setEnd(current, index + fullTarget.length);
        const targetRects = [...targetRange.getClientRects()].map(toPlainRect).filter(Boolean);
        const sentinelRects = [...sentinelRange.getClientRects()].map(toPlainRect).filter(Boolean);
        const sentinelRect = sentinelRects[0] || targetRects[targetRects.length - 1] || null;
        const centerX = sentinelRect ? sentinelRect.left + sentinelRect.width / 2 : null;
        const centerY = sentinelRect ? sentinelRect.top + sentinelRect.height / 2 : null;
        const sheetIndex = sentinelRect ? pageRects.findIndex((rect) => (
          centerX >= rect.left && centerX <= rect.right && centerY >= rect.top && centerY <= rect.bottom
        )) : -1;
        const distanceFromSheetBottom = sentinelRect ? firstSheetRect.bottom - sentinelRect.bottom : null;
        matches.push({
          textNode: current,
          startOffset: index,
          caretOffset: index + fullTarget.length,
          targetRects,
          sentinelRect,
          sheetIndex,
          distanceFromSheetBottom,
        });
        from = index + fullTarget.length;
        index = current.textContent.indexOf(fullTarget, from);
      }
      current = walker.nextNode();
    }
    const selected = matches.find((item) => (
      item.sentinelRect
      && item.sheetIndex === 0
      && item.distanceFromSheetBottom >= 24
      && item.distanceFromSheetBottom <= 220
      && item.sentinelRect.left >= firstSheetRect.left
      && item.sentinelRect.right <= firstSheetRect.right
      && item.sentinelRect.top >= firstSheetRect.top
      && item.sentinelRect.bottom <= firstSheetRect.bottom
    )) || null;
    if (!selected) {
      return {
        ok: false,
        reason: 'NO_UNIQUE_TARGET_SENTINEL_IN_SAFE_BOUNDARY_BAND',
        fullTargetCount,
        truncatedTargetCount,
        matchCount: matches.length,
        matches: matches.map((item) => ({
          targetRects: item.targetRects,
          sentinelRect: item.sentinelRect,
          sheetIndex: item.sheetIndex,
          distanceFromSheetBottom: item.distanceFromSheetBottom,
        })),
        firstSheetRect,
        pageRects,
      };
    }
    const range = document.createRange();
    range.setStart(selected.textNode, selected.caretOffset);
    range.collapse(true);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    prose.focus();
    const selectionNode = range.commonAncestorContainer;
    const selectionElement = selectionNode && selectionNode.nodeType === Node.TEXT_NODE
      ? selectionNode.parentElement
      : selectionNode;
    const activeElementInsideProseMirror = document.activeElement === prose || prose.contains(document.activeElement);
    const selectionInsideProseMirror = Boolean(selectionElement && (selectionElement === prose || prose.contains(selectionElement)));
    const caretCollapsed = Boolean(selection && selection.rangeCount === 1 && selection.isCollapsed);
    const precedingChar = selected.textNode.textContent.slice(selected.caretOffset - 1, selected.caretOffset);
    return {
      ok: Boolean(
        fullTargetCount === 1
        && truncatedTargetCount === 0
        && matches.length === 1
        && caretCollapsed
        && precedingChar === 'X'
        && selectionInsideProseMirror
        && activeElementInsideProseMirror
      ),
      reason: null,
      fullTargetCount,
      truncatedTargetCount,
      matchCount: matches.length,
      caretOffset: selected.caretOffset,
      precedingChar,
      caretCollapsed,
      browserSelectionText: selection ? selection.toString() : '',
      targetRects: selected.targetRects,
      sentinelRect: selected.sentinelRect,
      firstSheetRect,
      pageRects,
      sheetIndex: selected.sheetIndex,
      distanceFromSheetBottom: selected.distanceFromSheetBottom,
      selectionInsideProseMirror,
      activeElementInsideProseMirror,
      proseMirrorCount: host.querySelectorAll('.ProseMirror').length,
      tiptapEditorCount: host.querySelectorAll('.tiptap-editor').length,
      derivedSheetProseMirrorCount: derivedWraps.reduce((sum, el) => sum + el.querySelectorAll('.ProseMirror').length, 0),
      derivedSheetEditorCount: derivedWraps.reduce((sum, el) => sum + el.querySelectorAll('.tiptap-editor').length, 0),
    };
  })(\${JSON.stringify({ fullTarget, truncatedTarget })})\`, true);
}

async function findBoundaryFixture(win) {
  let lastState = null;
  let lastCaretPlacement = null;
  for (const afterParagraphCount of [2, 4, 6]) {
    for (let beforeParagraphCount = 0; beforeParagraphCount <= 8; beforeParagraphCount += 1) {
      await setEditorPayload(win, beforeParagraphCount, afterParagraphCount);
      await sleep(350);
      const state = await collectState(win, 'candidate-' + String(beforeParagraphCount) + '-' + String(afterParagraphCount));
      const caretPlacement = await placeCaretAfterTargetSentinel(win);
      lastState = state;
      lastCaretPlacement = caretPlacement;
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
        && state.fullTargetCount === 1
        && state.truncatedTargetCount === 0
        && caretPlacement.ok
        && caretPlacement.sheetIndex === 0
      ) {
        return { beforeParagraphCount, afterParagraphCount, state, caretPlacement };
      }
    }
  }
  throw new Error('NO_BOUNDARY_UNDO_AFTER_BACKSPACE_FIXTURE ' + JSON.stringify({ lastState, lastCaretPlacement }));
}

async function pressKey(win, keyCode, modifiers = []) {
  win.webContents.sendInputEvent({ type: 'keyDown', keyCode, modifiers });
  win.webContents.sendInputEvent({ type: 'keyUp', keyCode, modifiers });
}

async function installUndoKeytrace(win) {
  return win.webContents.executeJavaScript(\`(() => {
    const traceId = 'undo-keytrace-' + String(Date.now()) + '-' + String(Math.random()).slice(2);
    const trace = { traceId, events: [] };
    const listener = (event) => {
      const host = document.querySelector('#editor.tiptap-host');
      const prose = host ? host.querySelector('.ProseMirror') : null;
      const target = event.target;
      trace.events.push({
        type: event.type,
        key: event.key,
        code: event.code,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        targetInsideProseMirror: Boolean(prose && target && (target === prose || prose.contains(target))),
        defaultPrevented: event.defaultPrevented,
      });
    };
    document.addEventListener('keydown', listener, true);
    window.__boundaryUndoKeytraceStop = () => {
      document.removeEventListener('keydown', listener, true);
      return { traceId, events: trace.events.slice() };
    };
    return { traceId };
  })()\`, true);
}

async function stopUndoKeytrace(win) {
  return win.webContents.executeJavaScript(\`(() => {
    if (typeof window.__boundaryUndoKeytraceStop !== 'function') {
      return { traceId: null, events: [] };
    }
    const result = window.__boundaryUndoKeytraceStop();
    window.__boundaryUndoKeytraceStop = null;
    return result;
  })()\`, true);
}

async function runUndoKeypath(win, afterDeleteTextHash) {
  const primary = primaryModifier();
  const keytraceStart = await installUndoKeytrace(win);
  await pressKey(win, 'Z', [primary]);
  await sleep(900);
  const keytrace = await stopUndoKeytrace(win);
  const state = await collectState(win, 'after-undo-primary');
  if (state.textHash !== afterDeleteTextHash) {
    return {
      state,
      undoKeypathUsed: 'primary-electron-accelerator-mod-z',
      undoAttemptCount: 1,
      undoFallbackReason: 'none',
      undoKeytrace: { keytraceStart, ...keytrace },
      undoAttempts: [{ keypath: 'primary-electron-accelerator-mod-z', modifiers: [primary], textHash: state.textHash, keytrace }],
    };
  }
  throw new Error('PRIMARY_UNDO_KEYPATH_BLOCKED ' + JSON.stringify({
    keypath: 'primary-electron-accelerator-mod-z',
    modifiers: [primary],
    textHash: state.textHash,
    keytrace,
  }));
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

    const fixture = await findBoundaryFixture(win);
    await setEditorPayload(win, fixture.beforeParagraphCount, fixture.afterParagraphCount);
    await sleep(800);
    const caretPlacement = await placeCaretAfterTargetSentinel(win);
    if (!caretPlacement.ok) {
      throw new Error('BOUNDARY_UNDO_AFTER_BACKSPACE_CARET_NOT_PROVABLE ' + JSON.stringify(caretPlacement));
    }
    const beforeDelete = await collectState(win, 'before-delete');
    if (beforeDelete.fullTargetCount !== 1 || beforeDelete.truncatedTargetCount !== 0) {
      throw new Error('BOUNDARY_UNDO_AFTER_BACKSPACE_PRECOUNTS_INVALID ' + JSON.stringify(beforeDelete));
    }
    if (!beforeDelete.caretCollapsed || beforeDelete.browserSelectionText !== '') {
      throw new Error('BOUNDARY_UNDO_AFTER_BACKSPACE_SELECTION_NOT_COLLAPSED ' + JSON.stringify(beforeDelete));
    }

    await pressKey(win, 'Backspace');
    await sleep(800);
    const afterDelete = await collectState(win, 'after-delete');
    const undoResult = await runUndoKeypath(win, afterDelete.textHash);
    const afterUndo = undoResult.state;

    const metrics = {
      fullTarget,
      truncatedTarget,
      beforeParagraphCount: fixture.beforeParagraphCount,
      afterParagraphCount: fixture.afterParagraphCount,
      beforeFullTargetCount: beforeDelete.fullTargetCount,
      beforeTruncatedTargetCount: beforeDelete.truncatedTargetCount,
      deleteFullTargetCount: afterDelete.fullTargetCount,
      deleteTruncatedTargetCount: afterDelete.truncatedTargetCount,
      undoFullTargetCount: afterUndo.fullTargetCount,
      undoTruncatedTargetCount: afterUndo.truncatedTargetCount,
      textLengthBefore: beforeDelete.textLength,
      textLengthDelete: afterDelete.textLength,
      textLengthUndo: afterUndo.textLength,
      textLengthDelta: afterDelete.textLength - beforeDelete.textLength,
      undoTextLengthDeltaFromBefore: afterUndo.textLength - beforeDelete.textLength,
      textHashBefore: beforeDelete.textHash,
      textHashDelete: afterDelete.textHash,
      textHashUndo: afterUndo.textHash,
      deleteTextHashChanged: beforeDelete.textHash !== afterDelete.textHash,
      undoTextHashRestored: afterUndo.textHash === beforeDelete.textHash,
      undoTextRestored: afterUndo.text === beforeDelete.text,
      undoKeypathUsed: undoResult.undoKeypathUsed,
      undoAttemptCount: undoResult.undoAttemptCount,
      undoFallbackReason: undoResult.undoFallbackReason,
      undoKeytrace: undoResult.undoKeytrace,
      undoAttempts: undoResult.undoAttempts,
      caretCollapsedBefore: beforeDelete.caretCollapsed,
      caretCollapsedDelete: afterDelete.caretCollapsed,
      caretCollapsedUndo: afterUndo.caretCollapsed,
      activeElementInsideProseMirrorBefore: beforeDelete.activeElementInsideProseMirror,
      activeElementInsideProseMirrorDelete: afterDelete.activeElementInsideProseMirror,
      activeElementInsideProseMirrorUndo: afterUndo.activeElementInsideProseMirror,
      selectionInsideProseMirrorBefore: beforeDelete.selectionInsideProseMirror,
      selectionInsideProseMirrorDelete: afterDelete.selectionInsideProseMirror,
      selectionInsideProseMirrorUndo: afterUndo.selectionInsideProseMirror,
      proseMirrorCount: afterUndo.proseMirrorCount,
      tiptapEditorCount: afterUndo.tiptapEditorCount,
      sourceWrapperCount: afterUndo.sourceWrapperCount,
      sourceEditorWrapperCount: afterUndo.sourceEditorWrapperCount,
      derivedSheetCount: afterUndo.derivedSheetCount,
      derivedSheetEditorCount: afterUndo.derivedSheetEditorCount,
      derivedSheetProseMirrorCount: afterUndo.derivedSheetProseMirrorCount,
      prosePageTruthCount: afterUndo.prosePageTruthCount,
      centralSheetFlow: afterUndo.centralSheetFlow,
      centralSheetOverflowReason: afterUndo.centralSheetOverflowReason,
      visibleSheetCount: afterUndo.visibleSheetCount,
      rightInspectorVisible: afterUndo.rightInspectorVisible,
      networkRequests,
      dialogCalls,
      sentinelSheetIndex: caretPlacement.sheetIndex,
      distanceFromFirstSheetBottom: caretPlacement.distanceFromSheetBottom,
    };

    const payload = {
      ok: true,
      fixture: fixture.state,
      caretPlacement,
      beforeDelete,
      afterDelete,
      afterUndo,
      metrics,
      networkRequests,
      dialogCalls,
    };
    await fs.writeFile(path.join(outputDir, 'result.json'), JSON.stringify(payload, null, 2));
    process.stdout.write('BOUNDARY_UNDO_AFTER_BACKSPACE_SMOKE_RESULT:' + JSON.stringify(payload) + '\\n');
    app.exit(0);
  } catch (error) {
    const payload = { ok: false, error: error && error.stack ? error.stack : String(error), networkRequests, dialogCalls };
    await fs.writeFile(path.join(outputDir, 'result.json'), JSON.stringify(payload, null, 2));
    process.stdout.write('BOUNDARY_UNDO_AFTER_BACKSPACE_SMOKE_RESULT:' + JSON.stringify(payload) + '\\n');
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
  throw new Error(`Electron boundary undo after backspace smoke failed with exit ${exitCode}`);
}

const result = JSON.parse(await readFile(path.join(outputDir, 'result.json'), 'utf8'));
if (!result.ok) {
  throw new Error(result.error || 'Electron boundary undo after backspace smoke returned not ok');
}

const states = [
  result.beforeDelete,
  result.afterDelete,
  result.afterUndo,
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
  assert.equal(state.rightInspectorVisible, true, `${state.label} must keep right inspector visible`);
}

assert.equal(exactTokenCount(result.beforeDelete.text, result.metrics.fullTarget), 1, 'full target must be exact before Backspace');
assert.equal(exactTokenCount(result.beforeDelete.text, result.metrics.truncatedTarget), 0, 'truncated target must not be exact before Backspace');
assert.equal(exactTokenCount(result.afterDelete.text, result.metrics.fullTarget), 0, 'full target must be removed after Backspace');
assert.equal(exactTokenCount(result.afterDelete.text, result.metrics.truncatedTarget), 1, 'truncated target must appear once after Backspace');
assert.equal(exactTokenCount(result.afterUndo.text, result.metrics.fullTarget), 1, 'full target must be restored after undo');
assert.equal(exactTokenCount(result.afterUndo.text, result.metrics.truncatedTarget), 0, 'exact truncated target must be removed after undo');
assert.equal(result.fixture.centralSheetFlow, 'horizontal', 'fixture must use central sheet horizontal flow');
assert.equal(result.beforeDelete.centralSheetOverflowReason, null, 'runtime positive guard must not use overflow fallback');
assert.equal(result.afterDelete.centralSheetOverflowReason, null, 'runtime positive guard must not overflow after Backspace');
assert.equal(result.afterUndo.centralSheetOverflowReason, null, 'runtime positive guard must not overflow after undo');
assert.equal(result.caretPlacement.ok, true, 'caret must be placed after sentinel X');
assert.equal(result.caretPlacement.precedingChar, 'X', 'caret must be immediately after sentinel X');
assert.equal(result.caretPlacement.fullTargetCount, 1, 'caret placement must see one full target');
assert.equal(result.caretPlacement.truncatedTargetCount, 0, 'caret placement must see no exact truncated target');
assert.equal(result.caretPlacement.matchCount, 1, 'target must be unique in the editor');
assert.equal(result.caretPlacement.sheetIndex, 0, 'target sentinel must be on the first derived sheet');
assert.equal(
  result.caretPlacement.distanceFromSheetBottom >= 24 && result.caretPlacement.distanceFromSheetBottom <= 220,
  true,
  'target sentinel must stay in the first sheet boundary safe band'
);
assert.equal(result.beforeDelete.caretCollapsed, true, 'caret must be collapsed before Backspace');
assert.equal(result.beforeDelete.browserSelectionText, '', 'browser selection must be empty before Backspace');
assert.equal(result.beforeDelete.activeElementInsideProseMirror, true, 'active element must be inside ProseMirror before Backspace');
assert.equal(result.beforeDelete.selectionInsideProseMirror, true, 'selection must be inside ProseMirror before Backspace');
assert.equal(result.afterDelete.activeElementInsideProseMirror, true, 'active element must remain inside ProseMirror after Backspace');
assert.equal(result.afterDelete.selectionInsideProseMirror, true, 'selection must remain inside ProseMirror after Backspace');
assert.equal(result.afterUndo.activeElementInsideProseMirror, true, 'active element must remain inside ProseMirror after undo');
assert.equal(result.afterUndo.selectionInsideProseMirror, true, 'selection must remain inside ProseMirror after undo');
assert.equal(result.networkRequests, 0, 'smoke must not trigger network requests');
assert.equal(result.dialogCalls, 0, 'smoke must not trigger dialogs');

const metrics = {
  outputDir,
  beforeFullTargetCount: result.metrics.beforeFullTargetCount,
  beforeTruncatedTargetCount: result.metrics.beforeTruncatedTargetCount,
  deleteFullTargetCount: result.metrics.deleteFullTargetCount,
  deleteTruncatedTargetCount: result.metrics.deleteTruncatedTargetCount,
  undoFullTargetCount: result.metrics.undoFullTargetCount,
  undoTruncatedTargetCount: result.metrics.undoTruncatedTargetCount,
  textLengthBefore: result.metrics.textLengthBefore,
  textLengthDelete: result.metrics.textLengthDelete,
  textLengthUndo: result.metrics.textLengthUndo,
  textLengthDelta: result.metrics.textLengthDelta,
  undoTextLengthDeltaFromBefore: result.metrics.undoTextLengthDeltaFromBefore,
  textHashBefore: result.metrics.textHashBefore,
  textHashDelete: result.metrics.textHashDelete,
  textHashUndo: result.metrics.textHashUndo,
  deleteTextHashChanged: result.metrics.deleteTextHashChanged,
  undoTextHashRestored: result.metrics.undoTextHashRestored,
  undoTextRestored: result.metrics.undoTextRestored,
  undoKeypathUsed: result.metrics.undoKeypathUsed,
  undoAttemptCount: result.metrics.undoAttemptCount,
  undoFallbackReason: result.metrics.undoFallbackReason,
  undoKeytrace: result.metrics.undoKeytrace,
  caretCollapsedBefore: result.metrics.caretCollapsedBefore,
  caretCollapsedDelete: result.metrics.caretCollapsedDelete,
  caretCollapsedUndo: result.metrics.caretCollapsedUndo,
  activeElementInsideProseMirrorBefore: result.metrics.activeElementInsideProseMirrorBefore,
  activeElementInsideProseMirrorDelete: result.metrics.activeElementInsideProseMirrorDelete,
  activeElementInsideProseMirrorUndo: result.metrics.activeElementInsideProseMirrorUndo,
  selectionInsideProseMirrorBefore: result.metrics.selectionInsideProseMirrorBefore,
  selectionInsideProseMirrorDelete: result.metrics.selectionInsideProseMirrorDelete,
  selectionInsideProseMirrorUndo: result.metrics.selectionInsideProseMirrorUndo,
  proseMirrorCount: result.metrics.proseMirrorCount,
  tiptapEditorCount: result.metrics.tiptapEditorCount,
  derivedSheetEditorCount: result.metrics.derivedSheetEditorCount,
  derivedSheetProseMirrorCount: result.metrics.derivedSheetProseMirrorCount,
  prosePageTruthCount: result.metrics.prosePageTruthCount,
  rightInspectorVisible: result.metrics.rightInspectorVisible,
  networkRequests: result.metrics.networkRequests,
  dialogCalls: result.metrics.dialogCalls,
  sentinelSheetIndex: result.metrics.sentinelSheetIndex,
  distanceFromFirstSheetBottom: result.metrics.distanceFromFirstSheetBottom,
};

assert.equal(metrics.beforeFullTargetCount, 1, 'summary metrics must prove one full target before Backspace');
assert.equal(metrics.beforeTruncatedTargetCount, 0, 'summary metrics must prove zero exact truncated target before Backspace');
assert.equal(metrics.deleteFullTargetCount, 0, 'summary metrics must prove zero full target after Backspace');
assert.equal(metrics.deleteTruncatedTargetCount, 1, 'summary metrics must prove one exact truncated target after Backspace');
assert.equal(metrics.undoFullTargetCount, 1, 'summary metrics must prove one full target after undo');
assert.equal(metrics.undoTruncatedTargetCount, 0, 'summary metrics must prove zero exact truncated target after undo');
assert.equal(metrics.textLengthDelta, -1, 'summary metrics must prove exact one-character deletion');
assert.equal(metrics.undoTextLengthDeltaFromBefore, 0, 'summary metrics must prove restored text length after undo');
assert.equal(metrics.deleteTextHashChanged, true, 'summary metrics must prove delete text hash changed');
assert.equal(metrics.undoTextHashRestored, true, 'summary metrics must prove undo restored text hash');
assert.equal(metrics.undoTextRestored, true, 'summary metrics must prove undo restored exact text');
assert.notEqual(result.metrics.textHashBefore, stableTextHash(result.afterDelete.text), 'outer hash guard must reject stale delete text');
assert.equal(result.metrics.textHashBefore, stableTextHash(result.beforeDelete.text), 'outer hash guard must confirm before-delete text');
assert.equal(result.metrics.textHashDelete, stableTextHash(result.afterDelete.text), 'outer hash guard must confirm after-delete text');
assert.equal(result.metrics.textHashBefore, stableTextHash(result.afterUndo.text), 'outer hash guard must confirm undo text');
assert.equal(result.beforeDelete.text, result.afterUndo.text, 'undo must restore exact original full text');
assert.equal(result.beforeDelete.textLength, result.afterUndo.textLength, 'undo must restore exact original text length');
assert.equal(result.beforeDelete.textHash, result.afterUndo.textHash, 'undo must restore exact original text hash');
assert.equal(result.beforeDelete.fullTargetCount, result.afterUndo.fullTargetCount, 'undo must restore exact full target count');
assert.equal(metrics.undoAttemptCount, 1, 'summary metrics must prove one primary undo attempt');
assert.equal(metrics.undoFallbackReason, 'none', 'fallback must not be used for this positive smoke');
assert.equal(metrics.undoKeypathUsed, 'primary-electron-accelerator-mod-z', 'summary metrics must record primary undo keypath');
const undoKeydowns = Array.isArray(metrics.undoKeytrace?.events)
  ? metrics.undoKeytrace.events.filter((event) => event.type === 'keydown')
  : [];
assert.equal(undoKeydowns.length, 1, 'keytrace must record exactly one primary undo keydown');
assert.equal(String(undoKeydowns[0].key).toLowerCase(), 'z', 'keytrace must record Z undo key');
assert.equal(undoKeydowns[0].altKey, false, 'keytrace must not use alt for undo');
assert.equal(undoKeydowns[0].shiftKey, false, 'keytrace must not use shift for undo');
assert.equal(undoKeydowns[0].targetInsideProseMirror, true, 'undo keydown must target ProseMirror');
assert.equal(undoKeydowns[0].defaultPrevented, true, 'undo keydown must be handled by renderer command path');
assert.equal(metrics.caretCollapsedBefore, true, 'summary metrics must prove collapsed caret before Backspace');
assert.equal(metrics.activeElementInsideProseMirrorBefore, true, 'summary metrics must prove ProseMirror focus before Backspace');
assert.equal(metrics.selectionInsideProseMirrorBefore, true, 'summary metrics must prove selection inside ProseMirror before Backspace');
assert.equal(metrics.activeElementInsideProseMirrorDelete, true, 'summary metrics must prove ProseMirror focus after delete');
assert.equal(metrics.selectionInsideProseMirrorDelete, true, 'summary metrics must prove selection inside ProseMirror after delete');
assert.equal(metrics.activeElementInsideProseMirrorUndo, true, 'summary metrics must prove ProseMirror focus after undo');
assert.equal(metrics.selectionInsideProseMirrorUndo, true, 'summary metrics must prove selection inside ProseMirror after undo');
assert.equal(metrics.proseMirrorCount, 1, 'summary metrics must prove one ProseMirror');
assert.equal(metrics.tiptapEditorCount, 1, 'summary metrics must prove one Tiptap editor');
assert.equal(metrics.derivedSheetEditorCount, 0, 'summary metrics must prove no derived sheet editors');
assert.equal(metrics.derivedSheetProseMirrorCount, 0, 'summary metrics must prove no derived sheet ProseMirror');
assert.equal(metrics.prosePageTruthCount, 0, 'summary metrics must prove no page truth inside ProseMirror');
assert.equal(metrics.rightInspectorVisible, true, 'summary metrics must prove right inspector visible');
assert.equal(metrics.networkRequests, 0, 'summary metrics must prove zero network requests');
assert.equal(metrics.dialogCalls, 0, 'summary metrics must prove zero dialog calls');

process.stdout.write(`BOUNDARY_UNDO_AFTER_BACKSPACE_SMOKE_METRICS:${JSON.stringify(metrics)}\n`);

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const rootDir = path.resolve(new URL('../..', import.meta.url).pathname);
const requireFromHere = createRequire(import.meta.url);
const electronBinary = requireFromHere('electron');
const outputDir = process.env.VERTICAL_SHEET_INPUT_STABILITY_OUT_DIR
  ? path.resolve(process.env.VERTICAL_SHEET_INPUT_STABILITY_OUT_DIR)
  : await mkdtemp(path.join(os.tmpdir(), 'vertical-sheet-input-stability-'));

function exactTokenCount(text, token) {
  const source = String(text);
  const safeToken = String(token);
  if (!/^[A-Za-z0-9_]+$/u.test(safeToken)) {
    throw new Error('UNSAFE_TOKEN_FOR_EXACT_COUNT');
  }
  const pattern = new RegExp('(^|[^A-Za-z0-9_])' + safeToken + '(?=$|[^A-Za-z0-9_])', 'gu');
  return [...source.matchAll(pattern)].length;
}

function buildHelperSource() {
  return `
const path = require('node:path');
const fs = require('node:fs/promises');
const { app, BrowserWindow, clipboard, dialog, session } = require('electron');

const rootDir = ${JSON.stringify(rootDir)};
const outputDir = ${JSON.stringify(outputDir)};
const mainEntrypoint = path.join(rootDir, 'src', 'main' + '.js');
const markerA = 'VISM_A';
const markerB = 'VISM_B';
const pasteStart = 'VISM_PASTE_START';
const pasteEnd = 'VISM_PASTE_END';
const fullTarget = 'VISM_BACKSPACE_TARGET_01X';
const truncatedTarget = 'VISM_BACKSPACE_TARGET_01';
let networkRequests = 0;
let dialogCalls = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function primaryModifier() {
  return process.platform === 'darwin' ? 'meta' : 'control';
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
  const paragraph = 'Vertical input stability proof paragraph for a derived sheet stack over one Tiptap editor.';
  return Array.from({ length: paragraphCount }, (_, index) => (
    paragraph + ' ' + String(index + 1) + '. ' + paragraph + ' ' + paragraph
  )).join('\\n\\n');
}

function buildBoundaryParagraph(index, extra) {
  const sentence = 'Vertical boundary input paragraph for caret and deletion stability over a derived sheet stack.';
  return sentence + ' ' + String(index + 1) + '. ' + sentence + (extra ? ' ' + extra + ' ' : ' ') + sentence;
}

function buildBoundaryText(beforeParagraphCount, afterParagraphCount) {
  const before = Array.from({ length: beforeParagraphCount }, (_, index) => buildBoundaryParagraph(index, ''));
  const target = buildBoundaryParagraph(beforeParagraphCount, fullTarget);
  const after = Array.from({ length: afterParagraphCount }, (_, index) => (
    buildBoundaryParagraph(beforeParagraphCount + index + 1, '')
  ));
  return [...before, target, ...after].join('\\n\\n');
}

function buildLargePasteText() {
  const paragraph = 'Vertical paste stability paragraph that should stay inside visible sheets and outside sheet gaps.';
  return [
    '',
    '',
    pasteStart + ' ' + paragraph,
    paragraph + ' ' + paragraph,
    paragraph + ' ' + paragraph + ' ' + pasteEnd,
  ].join('\\n\\n');
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

async function setEditorContent(win, content, title) {
  win.webContents.send('editor:set-text', {
    content,
    title,
    path: '',
    kind: 'chapter-file',
    metaEnabled: true,
    projectId: title,
    bookProfile: null,
  });
}

async function setFiveSheetPayload(win, paragraphCount) {
  await setEditorContent(win, buildPlainText(paragraphCount), 'vertical-sheet-input-stability-smoke');
}

async function setBoundaryPayload(win, beforeParagraphCount, afterParagraphCount) {
  await setEditorContent(win, buildBoundaryText(beforeParagraphCount, afterParagraphCount), 'vertical-sheet-input-stability-boundary-smoke');
}

async function saveCapture(win, basename) {
  const image = await win.webContents.capturePage();
  await fs.writeFile(path.join(outputDir, basename), image.toPNG());
}

async function collectState(win, label) {
  const script = '(' + function collect(payload) {
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
    const intersects = (a, b) => (
      a.left < b.right
      && a.right > b.left
      && a.top < b.bottom
      && a.bottom > b.top
    );
    const host = document.querySelector('#editor.tiptap-host');
    const strip = host ? host.querySelector('.tiptap-sheet-strip') : null;
    const prose = host ? host.querySelector('.ProseMirror') : null;
    const canvas = document.querySelector('.main-content--editor');
    const rightSidebar = document.querySelector('[data-right-sidebar]');
    const sourceWraps = host ? [...host.querySelectorAll(':scope > .tiptap-page-wrap')] : [];
    const derivedWraps = strip ? [...strip.querySelectorAll(':scope > .tiptap-page-wrap')] : [];
    const pageRects = derivedWraps.map((el) => toPlainRect(el.getBoundingClientRect())).filter(Boolean);
    const gapRects = pageRects.slice(1).map((rect, index) => {
      const previous = pageRects[index];
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
    if (walker) {
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
    const canvasRect = canvas ? toPlainRect(canvas.getBoundingClientRect()) : null;
    const viewportRect = canvasRect || {
      left: 0,
      top: 0,
      right: window.innerWidth || document.documentElement.clientWidth || 0,
      bottom: window.innerHeight || document.documentElement.clientHeight || 0,
    };
    const isRectVisibleInViewport = (rect) => (
      rect
      && rect.left < viewportRect.right
      && rect.right > viewportRect.left
      && rect.top < viewportRect.bottom
      && rect.bottom > viewportRect.top
    );
    const visiblePageRects = pageRects.filter(isRectVisibleInViewport);
    const visibleTextRects = textRects.filter(isRectVisibleInViewport);
    const visibleTextOutsideVisibleSheetRectCount = visibleTextRects.filter((textRect) => (
      !visiblePageRects.some((pageRect) => intersects(textRect, pageRect))
    )).length;
    const textGapIntersectionCount = textRects.filter((textRect) => (
      textRect && gapRects.some((gapRect) => gapRect.height > 0 && intersects(textRect, gapRect))
    )).length;
    const rightFlowSheetPairCount = pageRects.slice(1).filter((rect, index) => {
      const previous = pageRects[index];
      return previous && rect.left > previous.left + 24;
    }).length;
    const verticallyStackedSheetPairCount = pageRects.slice(1).filter((rect, index) => {
      const previous = pageRects[index];
      return previous
        && rect.top > previous.top + 24
        && Math.abs(rect.left - previous.left) <= 2;
    }).length;
    const gapHeights = gapRects.map((rect) => Math.round(rect.height));
    const selection = window.getSelection();
    const selectionNode = selection && selection.rangeCount
      ? selection.getRangeAt(0).commonAncestorContainer
      : null;
    const selectionElement = selectionNode && selectionNode.nodeType === Node.TEXT_NODE
      ? selectionNode.parentElement
      : selectionNode;
    const rightSidebarRect = rightSidebar ? rightSidebar.getBoundingClientRect() : null;
    const text = prose ? prose.textContent || '' : '';
    return {
      label: payload.label,
      proofClass: Boolean(host && host.classList.contains('tiptap-host--central-sheet-strip-proof')),
      centralSheetCount: host ? host.dataset.centralSheetCount || null : null,
      centralSheetRenderedPageCount: host ? host.dataset.centralSheetRenderedPageCount || host.dataset.centralSheetCount || null : null,
      centralSheetTotalPageCount: host ? host.dataset.centralSheetTotalPageCount || host.dataset.centralSheetCount || null : null,
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
      text,
      textLength: text.length,
      textHash: stableTextHash(text),
      paragraphCount: prose ? prose.querySelectorAll('p').length : 0,
      visibleSheetCount: derivedWraps.length,
      viewportVisibleSheetCount: visiblePageRects.length,
      visibleTextRectCount: visibleTextRects.length,
      visibleTextOutsideVisibleSheetRectCount,
      sourceWrapperCount: sourceWraps.length,
      sourceEditorWrapperCount: sourceWraps.filter((el) => el.querySelector('.ProseMirror') || el.querySelector('.tiptap-editor')).length,
      sourceWrapperProseMirrorCount: sourceWraps.reduce((sum, el) => sum + el.querySelectorAll('.ProseMirror').length, 0),
      sourceWrapperTiptapEditorCount: sourceWraps.reduce((sum, el) => sum + el.querySelectorAll('.tiptap-editor').length, 0),
      derivedSheetCount: derivedWraps.length,
      derivedSheetProseMirrorCount: derivedWraps.reduce((sum, el) => sum + el.querySelectorAll('.ProseMirror').length, 0),
      derivedSheetEditorCount: derivedWraps.reduce((sum, el) => sum + el.querySelectorAll('.tiptap-editor').length, 0),
      proseMirrorCount: host ? host.querySelectorAll('.ProseMirror').length : 0,
      tiptapEditorCount: host ? host.querySelectorAll('.tiptap-editor').length : 0,
      prosePageTruthCount: prose ? prose.querySelectorAll('[data-page-index], [data-page-number], [data-page-id]').length : 0,
      activeElementInsideProseMirror: Boolean(prose && (document.activeElement === prose || prose.contains(document.activeElement))),
      selectionInsideProseMirror: Boolean(prose && selectionElement && (selectionElement === prose || prose.contains(selectionElement))),
      caretCollapsed: Boolean(selection && selection.rangeCount === 1 && selection.isCollapsed),
      browserSelectionText: selection ? selection.toString() : '',
      rightInspectorVisible: Boolean(rightSidebarRect && rightSidebarRect.width >= 280 && rightSidebarRect.height > 0),
      rightInspectorWidth: rightSidebarRect ? rightSidebarRect.width : 0,
      rightFlowSheetPairCount,
      verticallyStackedSheetPairCount,
      gapHeights,
      minGapPx: gapHeights.length ? Math.min(...gapHeights) : 0,
      maxGapPx: gapHeights.length ? Math.max(...gapHeights) : 0,
      textGapIntersectionCount,
      markerACount: exactTokenCount(text, payload.markerA),
      markerBCount: exactTokenCount(text, payload.markerB),
      pasteStartCount: exactTokenCount(text, payload.pasteStart),
      pasteEndCount: exactTokenCount(text, payload.pasteEnd),
      fullTargetCount: exactTokenCount(text, payload.fullTarget),
      truncatedTargetCount: exactTokenCount(text, payload.truncatedTarget),
    };
  }.toString() + ')(' + JSON.stringify({
    label,
    markerA,
    markerB,
    pasteStart,
    pasteEnd,
    fullTarget,
    truncatedTarget,
  }) + ')';
  return win.webContents.executeJavaScript(script, true);
}

async function focusEditorEnd(win) {
  const script = '(' + function focusEnd() {
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
    const selectionNode = selection && selection.rangeCount
      ? selection.getRangeAt(0).commonAncestorContainer
      : null;
    const selectionElement = selectionNode && selectionNode.nodeType === Node.TEXT_NODE
      ? selectionNode.parentElement
      : selectionNode;
    return {
      ok: true,
      activeElementInsideProseMirror: document.activeElement === prose || prose.contains(document.activeElement),
      selectionInsideProseMirror: Boolean(selectionElement && (selectionElement === prose || prose.contains(selectionElement))),
      caretCollapsed: Boolean(selection && selection.rangeCount === 1 && selection.isCollapsed),
      proseMirrorCount: host.querySelectorAll('.ProseMirror').length,
      tiptapEditorCount: host.querySelectorAll('.tiptap-editor').length,
    };
  }.toString() + ')()';
  return win.webContents.executeJavaScript(script, true);
}

async function placeCaretAfterTargetSentinel(win) {
  const script = '(' + function placeCaret(payload) {
    const exactTokenCount = (text, token) => {
      const source = String(text);
      const safeToken = String(token);
      if (!/^[A-Za-z0-9_]+$/u.test(safeToken)) {
        throw new Error('UNSAFE_TOKEN_FOR_EXACT_COUNT');
      }
      const pattern = new RegExp('(^|[^A-Za-z0-9_])' + safeToken + '(?=$|[^A-Za-z0-9_])', 'gu');
      return [...source.matchAll(pattern)].length;
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
    const derivedWraps = strip ? [...strip.querySelectorAll(':scope > .tiptap-page-wrap')] : [];
    if (!host || !strip || !prose || !derivedWraps.length) {
      return { ok: false, reason: 'SURFACE_MISSING' };
    }
    const text = prose.textContent || '';
    const fullTargetCount = exactTokenCount(text, payload.fullTarget);
    const truncatedTargetCount = exactTokenCount(text, payload.truncatedTarget);
    const pageRects = derivedWraps.map((el, index) => ({ index, ...toPlainRect(el.getBoundingClientRect()) }));
    const walker = document.createTreeWalker(prose, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        return node.textContent && node.textContent.includes(payload.fullTarget)
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_SKIP;
      },
    });
    const matches = [];
    let current = walker.nextNode();
    while (current) {
      let from = 0;
      let index = current.textContent.indexOf(payload.fullTarget, from);
      while (index !== -1) {
        const targetRange = document.createRange();
        targetRange.setStart(current, index);
        targetRange.setEnd(current, index + payload.fullTarget.length);
        const sentinelRange = document.createRange();
        sentinelRange.setStart(current, index + payload.fullTarget.length - 1);
        sentinelRange.setEnd(current, index + payload.fullTarget.length);
        const targetRects = [...targetRange.getClientRects()].map(toPlainRect).filter(Boolean);
        const sentinelRects = [...sentinelRange.getClientRects()].map(toPlainRect).filter(Boolean);
        const sentinelRect = sentinelRects[0] || targetRects[targetRects.length - 1] || null;
        const centerX = sentinelRect ? sentinelRect.left + sentinelRect.width / 2 : null;
        const centerY = sentinelRect ? sentinelRect.top + sentinelRect.height / 2 : null;
        const sheetIndex = sentinelRect ? pageRects.findIndex((rect) => (
          centerX >= rect.left && centerX <= rect.right && centerY >= rect.top && centerY <= rect.bottom
        )) : -1;
        const sheetRect = sheetIndex >= 0 ? pageRects[sheetIndex] : null;
        const distanceFromSheetBottom = sentinelRect && sheetRect ? sheetRect.bottom - sentinelRect.bottom : null;
        matches.push({
          textNode: current,
          startOffset: index,
          caretOffset: index + payload.fullTarget.length,
          targetRects,
          sentinelRect,
          sheetIndex,
          sheetRect,
          distanceFromSheetBottom,
        });
        from = index + payload.fullTarget.length;
        index = current.textContent.indexOf(payload.fullTarget, from);
      }
      current = walker.nextNode();
    }
    const selected = matches.find((item) => (
      item.sentinelRect
      && item.sheetIndex >= 0
      && item.distanceFromSheetBottom >= 24
      && item.distanceFromSheetBottom <= 220
      && item.sentinelRect.left >= item.sheetRect.left
      && item.sentinelRect.right <= item.sheetRect.right
      && item.sentinelRect.top >= item.sheetRect.top
      && item.sentinelRect.bottom <= item.sheetRect.bottom
    )) || null;
    if (!selected) {
      return {
        ok: false,
        reason: 'NO_TARGET_SENTINEL_IN_SAFE_BOUNDARY_BAND',
        fullTargetCount,
        truncatedTargetCount,
        matchCount: matches.length,
        matches: matches.map((item) => ({
          targetRects: item.targetRects,
          sentinelRect: item.sentinelRect,
          sheetIndex: item.sheetIndex,
          distanceFromSheetBottom: item.distanceFromSheetBottom,
        })),
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
    const precedingChar = selected.textNode.textContent.slice(selected.caretOffset - 1, selected.caretOffset);
    return {
      ok: Boolean(
        fullTargetCount === 1
        && truncatedTargetCount === 0
        && matches.length === 1
        && precedingChar === 'X'
        && selection
        && selection.rangeCount === 1
        && selection.isCollapsed
      ),
      reason: null,
      fullTargetCount,
      truncatedTargetCount,
      matchCount: matches.length,
      caretOffset: selected.caretOffset,
      precedingChar,
      caretCollapsed: Boolean(selection && selection.rangeCount === 1 && selection.isCollapsed),
      browserSelectionText: selection ? selection.toString() : '',
      targetRects: selected.targetRects,
      sentinelRect: selected.sentinelRect,
      pageRects,
      sheetIndex: selected.sheetIndex,
      distanceFromSheetBottom: selected.distanceFromSheetBottom,
      selectionInsideProseMirror: Boolean(selectionElement && (selectionElement === prose || prose.contains(selectionElement))),
      activeElementInsideProseMirror: document.activeElement === prose || prose.contains(document.activeElement),
      proseMirrorCount: host.querySelectorAll('.ProseMirror').length,
      tiptapEditorCount: host.querySelectorAll('.tiptap-editor').length,
      derivedSheetProseMirrorCount: derivedWraps.reduce((sum, el) => sum + el.querySelectorAll('.ProseMirror').length, 0),
      derivedSheetEditorCount: derivedWraps.reduce((sum, el) => sum + el.querySelectorAll('.tiptap-editor').length, 0),
    };
  }.toString() + ')(' + JSON.stringify({ fullTarget, truncatedTarget }) + ')';
  return win.webContents.executeJavaScript(script, true);
}

async function pressKey(win, keyCode, modifiers = []) {
  win.webContents.sendInputEvent({ type: 'keyDown', keyCode, modifiers });
  win.webContents.sendInputEvent({ type: 'keyUp', keyCode, modifiers });
}

async function findFiveSheetFixture(win) {
  let lastState = null;
  for (let paragraphCount = 1; paragraphCount <= 40; paragraphCount += 1) {
    await setFiveSheetPayload(win, paragraphCount);
    await sleep(700);
    const state = await collectState(win, 'candidate-' + String(paragraphCount));
    lastState = state;
    const renderedPageCount = Number(state.centralSheetRenderedPageCount || state.visibleSheetCount || 0);
    const totalPageCount = Number(state.centralSheetTotalPageCount || renderedPageCount || 0);
    const hasBoundedOverflow = totalPageCount > renderedPageCount;
    if (
      state.proofClass === true
      && state.centralSheetFlow === 'vertical'
      && renderedPageCount >= 2
      && renderedPageCount <= 15
      && totalPageCount >= 5
      && state.visibleSheetCount === renderedPageCount
      && state.verticallyStackedSheetPairCount === Math.max(0, renderedPageCount - 1)
      && state.rightFlowSheetPairCount === 0
      && state.centralSheetWindowingEnabled === 'true'
      && state.minGapPx >= 24
      && state.maxGapPx <= 72
      && state.textGapIntersectionCount === 0
      && state.visibleTextOutsideVisibleSheetRectCount === 0
      && (
        hasBoundedOverflow
          ? state.centralSheetBoundedOverflowReason === 'max-page-count'
          : state.centralSheetBoundedOverflowReason === null
      )
      && state.proseMirrorCount === 1
      && state.tiptapEditorCount === 1
      && state.sourceWrapperCount === 1
      && state.sourceEditorWrapperCount === 1
      && state.derivedSheetProseMirrorCount === 0
      && state.derivedSheetEditorCount === 0
      && state.prosePageTruthCount === 0
    ) {
      return { paragraphCount, state };
    }
  }
  throw new Error('NO_VERTICAL_FIVE_SHEET_INPUT_FIXTURE ' + JSON.stringify(lastState));
}

async function findBoundaryFixture(win) {
  let lastState = null;
  let lastCaretPlacement = null;
  for (const afterParagraphCount of [6, 10, 14, 18, 24]) {
    for (let beforeParagraphCount = 0; beforeParagraphCount <= 16; beforeParagraphCount += 1) {
      await setBoundaryPayload(win, beforeParagraphCount, afterParagraphCount);
      await sleep(500);
      const state = await collectState(win, 'boundary-candidate-' + String(beforeParagraphCount) + '-' + String(afterParagraphCount));
      const caretPlacement = await placeCaretAfterTargetSentinel(win);
      lastState = state;
      lastCaretPlacement = caretPlacement;
      const renderedPageCount = Number(state.centralSheetRenderedPageCount || state.visibleSheetCount || 0);
      const totalPageCount = Number(state.centralSheetTotalPageCount || renderedPageCount || 0);
      const hasBoundedOverflow = totalPageCount > renderedPageCount;
      if (
        state.proofClass === true
        && state.centralSheetFlow === 'vertical'
        && renderedPageCount >= 2
        && renderedPageCount <= 15
        && state.visibleSheetCount === renderedPageCount
        && state.verticallyStackedSheetPairCount === Math.max(0, renderedPageCount - 1)
        && state.rightFlowSheetPairCount === 0
        && state.centralSheetWindowingEnabled === 'true'
        && state.minGapPx >= 24
        && state.maxGapPx <= 72
        && state.textGapIntersectionCount === 0
        && state.visibleTextOutsideVisibleSheetRectCount === 0
        && (
          hasBoundedOverflow
            ? state.centralSheetBoundedOverflowReason === 'max-page-count'
            : state.centralSheetBoundedOverflowReason === null
        )
        && state.sourceWrapperCount === 1
        && state.sourceEditorWrapperCount === 1
        && state.derivedSheetProseMirrorCount === 0
        && state.derivedSheetEditorCount === 0
        && state.proseMirrorCount === 1
        && state.tiptapEditorCount === 1
        && state.prosePageTruthCount === 0
        && state.fullTargetCount === 1
        && state.truncatedTargetCount === 0
        && caretPlacement.ok
      ) {
        return { beforeParagraphCount, afterParagraphCount, state, caretPlacement };
      }
    }
  }
  throw new Error('NO_VERTICAL_BOUNDARY_INPUT_FIXTURE ' + JSON.stringify({ lastState, lastCaretPlacement }));
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

    const fiveSheetFixture = await findFiveSheetFixture(win);
    await setFiveSheetPayload(win, fiveSheetFixture.paragraphCount);
    await sleep(800);
    const beforeInput = await collectState(win, 'before-input');
    await saveCapture(win, 'vertical-input-stability-before.png');

    const focusEnd = await focusEditorEnd(win);
    await sleep(150);
    await win.webContents.insertText(' ' + markerA + ' ');
    await sleep(500);
    const afterMarkerA = await collectState(win, 'after-marker-a');
    await pressKey(win, 'Enter');
    await sleep(600);
    const afterEnter = await collectState(win, 'after-enter');
    await pressKey(win, 'Z', [primaryModifier()]);
    await sleep(800);
    const afterEnterUndo = await collectState(win, 'after-enter-undo');
    await pressKey(win, 'Z', [primaryModifier(), 'shift']);
    await sleep(800);
    const afterEnterRedo = await collectState(win, 'after-enter-redo');
    await win.webContents.insertText(markerB);
    await sleep(500);
    const afterMarkerB = await collectState(win, 'after-marker-b');
    await pressKey(win, 'Z', [primaryModifier()]);
    await sleep(800);
    const afterUndo = await collectState(win, 'after-undo');
    await pressKey(win, 'Z', [primaryModifier(), 'shift']);
    await sleep(800);
    const afterRedo = await collectState(win, 'after-redo');
    await win.webContents.insertText(' ');
    await sleep(200);
    clipboard.writeText(buildLargePasteText());
    win.webContents.paste();
    await sleep(1000);
    const afterPaste = await collectState(win, 'after-paste');
    await saveCapture(win, 'vertical-input-stability-after-paste.png');

    const boundaryFixture = await findBoundaryFixture(win);
    await setBoundaryPayload(win, boundaryFixture.beforeParagraphCount, boundaryFixture.afterParagraphCount);
    await sleep(800);
    const boundaryCaretPlacement = await placeCaretAfterTargetSentinel(win);
    if (!boundaryCaretPlacement.ok) {
      throw new Error('VERTICAL_BOUNDARY_CARET_NOT_PROVABLE ' + JSON.stringify(boundaryCaretPlacement));
    }
    const beforeBackspace = await collectState(win, 'before-backspace');
    await pressKey(win, 'Backspace');
    await sleep(700);
    const afterBackspace = await collectState(win, 'after-backspace');
    await pressKey(win, 'Z', [primaryModifier()]);
    await sleep(800);
    const afterBackspaceUndo = await collectState(win, 'after-backspace-undo');
    await pressKey(win, 'Z', [primaryModifier(), 'shift']);
    await sleep(800);
    const afterBackspaceRedo = await collectState(win, 'after-backspace-redo');
    await saveCapture(win, 'vertical-input-stability-after-backspace-redo.png');

    const payload = {
      ok: true,
      fiveSheetParagraphCount: fiveSheetFixture.paragraphCount,
      boundaryBeforeParagraphCount: boundaryFixture.beforeParagraphCount,
      boundaryAfterParagraphCount: boundaryFixture.afterParagraphCount,
      markerA,
      markerB,
      pasteStart,
      pasteEnd,
      fullTarget,
      truncatedTarget,
      fiveSheetFixture: fiveSheetFixture.state,
      beforeInput,
      focusEnd,
      afterMarkerA,
      afterEnter,
      afterEnterUndo,
      afterEnterRedo,
      afterMarkerB,
      afterUndo,
      afterRedo,
      afterPaste,
      boundaryFixture: boundaryFixture.state,
      boundaryCaretPlacement,
      beforeBackspace,
      afterBackspace,
      afterBackspaceUndo,
      afterBackspaceRedo,
      networkRequests,
      dialogCalls,
      screenshots: [
        path.join(outputDir, 'vertical-input-stability-before.png'),
        path.join(outputDir, 'vertical-input-stability-after-paste.png'),
        path.join(outputDir, 'vertical-input-stability-after-backspace-redo.png'),
      ],
    };
    await fs.writeFile(path.join(outputDir, 'result.json'), JSON.stringify(payload, null, 2));
    process.stdout.write('VERTICAL_SHEET_INPUT_STABILITY_SMOKE_RESULT:' + JSON.stringify(payload) + '\\n');
    app.exit(0);
  } catch (error) {
    const payload = { ok: false, error: error && error.stack ? error.stack : String(error), networkRequests, dialogCalls };
    await fs.writeFile(path.join(outputDir, 'result.json'), JSON.stringify(payload, null, 2));
    process.stdout.write('VERTICAL_SHEET_INPUT_STABILITY_SMOKE_RESULT:' + JSON.stringify(payload) + '\\n');
    app.exit(1);
  }
});
`;
}

function assertVerticalState(state) {
  const renderedPageCount = Number(state.centralSheetRenderedPageCount || state.visibleSheetCount || 0);
  const totalPageCount = Number(state.centralSheetTotalPageCount || renderedPageCount || 0);
  const hasBoundedOverflow = totalPageCount > renderedPageCount;
  assert.equal(state.proofClass, true, `${state.label} must stay in central sheet strip proof mode`);
  assert.equal(state.centralSheetFlow, 'vertical', `${state.label} must keep vertical central sheet flow`);
  assert.equal(renderedPageCount >= 2, true, `${state.label} rendered page count must stay bounded and non-trivial`);
  assert.equal(renderedPageCount <= 15, true, `${state.label} rendered page count must stay within runtime window budget`);
  assert.equal(totalPageCount >= renderedPageCount, true, `${state.label} total page count must not be below rendered page count`);
  assert.equal(state.visibleSheetCount, renderedPageCount, `${state.label} visible sheet count must match rendered page count`);
  assert.equal(state.viewportVisibleSheetCount > 0, true, `${state.label} viewport must always contain at least one rendered sheet`);
  assert.equal(state.visibleTextRectCount > 0, true, `${state.label} viewport must always contain visible text rects`);
  assert.equal(state.verticallyStackedSheetPairCount, Math.max(0, renderedPageCount - 1), `${state.label} must stack sheets down`);
  assert.equal(state.rightFlowSheetPairCount, 0, `${state.label} must not place the next sheet to the right`);
  assert.equal(state.centralSheetWindowingEnabled, 'true', `${state.label} must keep viewport windowing enabled`);
  assert.equal(state.minGapPx >= 24, true, `${state.label} minimum gap must stay at least 24px`);
  assert.equal(state.maxGapPx <= 72, true, `${state.label} maximum gap must stay at most 72px`);
  assert.equal(state.textGapIntersectionCount, 0, `${state.label} text must not intersect sheet gaps`);
  assert.equal(state.visibleTextOutsideVisibleSheetRectCount, 0, `${state.label} visible text must stay inside visible sheets`);
  assert.equal(
    hasBoundedOverflow
      ? state.centralSheetBoundedOverflowReason === 'max-page-count'
      : state.centralSheetBoundedOverflowReason === null,
    true,
    `${state.label} bounded overflow metadata must match rendered window`,
  );
  assert.equal(state.proseMirrorCount, 1, `${state.label} must keep one ProseMirror`);
  assert.equal(state.tiptapEditorCount, 1, `${state.label} must keep one Tiptap editor shell`);
  assert.equal(state.sourceWrapperCount, 1, `${state.label} must keep one direct source editor wrapper`);
  assert.equal(state.sourceEditorWrapperCount, 1, `${state.label} must keep one source editor wrapper with editor content`);
  assert.equal(state.sourceWrapperProseMirrorCount, 1, `${state.label} source wrapper must contain one ProseMirror`);
  assert.equal(state.sourceWrapperTiptapEditorCount, 1, `${state.label} source wrapper must contain one Tiptap editor shell`);
  assert.equal(state.derivedSheetProseMirrorCount, 0, `${state.label} derived sheets must not contain ProseMirror`);
  assert.equal(state.derivedSheetEditorCount, 0, `${state.label} derived sheets must not contain editor shells`);
  assert.equal(state.prosePageTruthCount, 0, `${state.label} must not create page truth inside ProseMirror`);
  assert.equal(state.rightInspectorVisible, true, `${state.label} must keep the right inspector visible`);
}

await mkdir(outputDir, { recursive: true });
const helperPath = path.join(outputDir, 'vertical-sheet-input-stability-helper.cjs');
await writeFile(helperPath, buildHelperSource(), 'utf8');

const child = spawn(electronBinary, [helperPath], {
  cwd: rootDir,
  env: {
    ...process.env,
    ELECTRON_ENABLE_LOGGING: '0',
    ELECTRON_ENABLE_SECURITY_WARNINGS: 'false',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
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

const result = JSON.parse(await readFile(path.join(outputDir, 'result.json'), 'utf8'));
assert.equal(exitCode, 0, `electron helper failed with ${exitCode}\n${stdout}\n${stderr}`);
assert.equal(result.ok, true);

const states = [
  result.fiveSheetFixture,
  result.beforeInput,
  result.afterMarkerA,
  result.afterEnter,
  result.afterEnterUndo,
  result.afterEnterRedo,
  result.afterMarkerB,
  result.afterUndo,
  result.afterRedo,
  result.afterPaste,
  result.boundaryFixture,
  result.beforeBackspace,
  result.afterBackspace,
  result.afterBackspaceUndo,
  result.afterBackspaceRedo,
];
for (const state of states) {
  assertVerticalState(state);
}

assert.equal(result.focusEnd.ok, true, 'focus at editor end must succeed');
assert.equal(result.focusEnd.activeElementInsideProseMirror, true, 'focus must start inside ProseMirror');
assert.equal(result.focusEnd.selectionInsideProseMirror, true, 'selection must start inside ProseMirror');
assert.equal(result.afterMarkerA.markerACount, 1, 'typed marker A must appear once');
assert.equal(result.afterEnter.paragraphCount > result.afterMarkerA.paragraphCount, true, 'Enter must increase paragraph/block count');
assert.equal(result.afterEnterUndo.paragraphCount, result.afterMarkerA.paragraphCount, 'undo immediately after Enter must restore previous paragraph count');
assert.equal(result.afterEnterUndo.markerACount, 1, 'undo immediately after Enter must preserve marker A');
assert.equal(result.afterEnterUndo.textHash, result.afterMarkerA.textHash, 'undo immediately after Enter must restore text hash');
assert.equal(result.afterEnterRedo.paragraphCount, result.afterEnter.paragraphCount, 'redo immediately after Enter undo must restore Enter paragraph count');
assert.equal(result.afterEnterRedo.markerACount, 1, 'redo immediately after Enter undo must preserve marker A');
assert.equal(result.afterEnterRedo.textHash, result.afterEnter.textHash, 'redo immediately after Enter undo must restore Enter text hash');
assert.equal(result.afterMarkerB.markerBCount, 1, 'typed marker B must appear once before undo');
assert.equal(result.afterUndo.markerBCount, 0, 'undo must remove marker B');
assert.equal(result.afterUndo.textHash, result.afterEnterRedo.textHash, 'undo after marker B must restore pre-marker text hash');
assert.equal(result.afterRedo.markerBCount, 1, 'redo must restore marker B');
assert.equal(result.afterRedo.markerACount, 1, 'redo state must preserve marker A once');
assert.equal(result.afterRedo.textHash, result.afterMarkerB.textHash, 'redo after marker B undo must restore marker B text hash');
assert.equal(result.afterPaste.pasteStartCount, 1, 'clipboard paste must insert start marker once');
assert.equal(result.afterPaste.pasteEndCount, 1, 'clipboard paste must insert end marker once');
assert.equal(result.afterPaste.textLength > result.afterRedo.textLength, true, 'clipboard paste must grow text length');
assert.equal(result.afterPaste.paragraphCount > result.afterRedo.paragraphCount, true, 'clipboard paste must add paragraph structure');
assert.equal(result.boundaryCaretPlacement.ok, true, 'boundary caret placement must be provable');
assert.equal(result.boundaryCaretPlacement.precedingChar, 'X', 'caret must be immediately after sentinel X');
assert.equal(result.boundaryCaretPlacement.matchCount, 1, 'target sentinel must be unique');
assert.equal(result.boundaryCaretPlacement.distanceFromSheetBottom >= 24, true, 'sentinel must be in sheet boundary safe band');
assert.equal(result.boundaryCaretPlacement.distanceFromSheetBottom <= 220, true, 'sentinel must be in sheet boundary safe band');
assert.equal(result.beforeBackspace.fullTargetCount, 1, 'full target must be exact before Backspace');
assert.equal(result.beforeBackspace.truncatedTargetCount, 0, 'truncated target must not be exact before Backspace');
assert.equal(result.beforeBackspace.caretCollapsed, true, 'caret must be collapsed before Backspace');
assert.equal(result.beforeBackspace.browserSelectionText, '', 'browser selection must be empty before Backspace');
assert.equal(result.afterBackspace.fullTargetCount, 0, 'Backspace must remove full target');
assert.equal(result.afterBackspace.truncatedTargetCount, 1, 'Backspace must create exact truncated target');
assert.equal(result.afterBackspace.textLength - result.beforeBackspace.textLength, -1, 'Backspace must delete exactly one character');
assert.notEqual(result.afterBackspace.textHash, result.beforeBackspace.textHash, 'Backspace must change text hash');
assert.equal(result.afterBackspaceUndo.fullTargetCount, 1, 'undo after Backspace must restore full target');
assert.equal(result.afterBackspaceUndo.truncatedTargetCount, 0, 'undo after Backspace must remove truncated target');
assert.equal(result.afterBackspaceUndo.textHash, result.beforeBackspace.textHash, 'undo after Backspace must restore text hash');
assert.equal(result.afterBackspaceRedo.fullTargetCount, 0, 'redo after Backspace undo must remove full target again');
assert.equal(result.afterBackspaceRedo.truncatedTargetCount, 1, 'redo after Backspace undo must restore truncated target');
assert.equal(exactTokenCount(result.afterBackspaceRedo.text, result.truncatedTarget), 1, 'outer exact count must confirm truncated target');
assert.equal(result.networkRequests, 0, 'smoke must not trigger network requests');
assert.equal(result.dialogCalls, 0, 'smoke must not trigger dialogs');

const summary = {
  ok: true,
  outputDir,
  fiveSheetParagraphCount: result.fiveSheetParagraphCount,
  boundaryBeforeParagraphCount: result.boundaryBeforeParagraphCount,
  boundaryAfterParagraphCount: result.boundaryAfterParagraphCount,
  checkedStateCount: states.length,
  centralSheetFlow: result.afterBackspaceRedo.centralSheetFlow,
  visibleSheetCount: result.afterBackspaceRedo.visibleSheetCount,
  verticallyStackedSheetPairCount: result.afterBackspaceRedo.verticallyStackedSheetPairCount,
  rightFlowSheetPairCount: result.afterBackspaceRedo.rightFlowSheetPairCount,
  minGapPx: result.afterBackspaceRedo.minGapPx,
  maxGapPx: result.afterBackspaceRedo.maxGapPx,
  textGapIntersectionCount: result.afterBackspaceRedo.textGapIntersectionCount,
  proseMirrorCount: result.afterBackspaceRedo.proseMirrorCount,
  tiptapEditorCount: result.afterBackspaceRedo.tiptapEditorCount,
  derivedSheetProseMirrorCount: result.afterBackspaceRedo.derivedSheetProseMirrorCount,
  derivedSheetEditorCount: result.afterBackspaceRedo.derivedSheetEditorCount,
  prosePageTruthCount: result.afterBackspaceRedo.prosePageTruthCount,
  markerAAfterRedo: result.afterRedo.markerACount,
  markerBAfterType: result.afterMarkerB.markerBCount,
  markerBAfterUndo: result.afterUndo.markerBCount,
  markerBAfterRedo: result.afterRedo.markerBCount,
  enterUndoHashRestored: result.afterEnterUndo.textHash === result.afterMarkerA.textHash,
  enterRedoHashRestored: result.afterEnterRedo.textHash === result.afterEnter.textHash,
  markerUndoHashRestored: result.afterUndo.textHash === result.afterEnterRedo.textHash,
  markerRedoHashRestored: result.afterRedo.textHash === result.afterMarkerB.textHash,
  pasteStartAfterPaste: result.afterPaste.pasteStartCount,
  pasteEndAfterPaste: result.afterPaste.pasteEndCount,
  backspaceFullTargetAfter: result.afterBackspace.fullTargetCount,
  backspaceTruncatedTargetAfter: result.afterBackspace.truncatedTargetCount,
  backspaceUndoFullTargetAfter: result.afterBackspaceUndo.fullTargetCount,
  backspaceRedoTruncatedTargetAfter: result.afterBackspaceRedo.truncatedTargetCount,
  boundaryDistanceFromSheetBottom: result.boundaryCaretPlacement.distanceFromSheetBottom,
  viewportVisibleSheetCount: result.afterBackspaceRedo.viewportVisibleSheetCount,
  visibleTextRectCount: result.afterBackspaceRedo.visibleTextRectCount,
  networkRequests: result.networkRequests,
  dialogCalls: result.dialogCalls,
  screenshots: result.screenshots.map((item) => path.basename(item)),
};

process.stdout.write('VERTICAL_SHEET_INPUT_STABILITY_SMOKE_SUMMARY:' + JSON.stringify(summary) + '\\n');

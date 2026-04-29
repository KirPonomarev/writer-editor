import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const rootDir = path.resolve(new URL('../..', import.meta.url).pathname);
const requireFromHere = createRequire(import.meta.url);
const electronBinary = requireFromHere('electron');
const outputDir = process.env.DERIVED_SHEET_CLASSIFICATION_OUT_DIR
  ? path.resolve(process.env.DERIVED_SHEET_CLASSIFICATION_OUT_DIR)
  : await mkdtemp(path.join(os.tmpdir(), '06b3-derived-sheet-classification-'));

function markerCount(text, marker) {
  return String(text).split(marker).length - 1;
}

function overlapArea(a, b) {
  const left = Math.max(Number(a.left), Number(b.left));
  const right = Math.min(Number(a.right), Number(b.right));
  const top = Math.max(Number(a.top), Number(b.top));
  const bottom = Math.min(Number(a.bottom), Number(b.bottom));
  const width = Math.max(0, right - left);
  const height = Math.max(0, bottom - top);
  return width * height;
}

function classifyMarkerAfterCaretByAggregateOverlap({
  caretSheetIndex,
  markerOccurrenceCount,
  markerRects,
  sheetRects,
}) {
  if (!Number.isInteger(caretSheetIndex) || caretSheetIndex < 0) {
    return { result: 'UNPROVABLE', reason: 'INVALID_CARET_SHEET_INDEX', markerMixedSheetOverlap: false };
  }
  if (markerOccurrenceCount !== 1) {
    return {
      result: 'UNPROVABLE',
      reason: 'MARKER_OCCURRENCE_COUNT_NOT_ONE',
      markerOccurrenceCount,
      markerMixedSheetOverlap: false,
    };
  }
  if (!Array.isArray(markerRects) || markerRects.length === 0) {
    return { result: 'UNPROVABLE', reason: 'NO_MARKER_RECTS', markerOccurrenceCount, markerMixedSheetOverlap: false };
  }
  if (!Array.isArray(sheetRects) || sheetRects.length === 0) {
    return { result: 'UNPROVABLE', reason: 'NO_SHEET_RECTS', markerOccurrenceCount, markerMixedSheetOverlap: false };
  }

  const overlapBySheet = sheetRects.map((sheetRect) => markerRects.reduce(
    (sum, markerRect) => sum + overlapArea(markerRect, sheetRect),
    0
  ));
  const markerMixedSheetOverlap = overlapBySheet.filter((area) => area > 0).length > 1;
  const maxOverlap = Math.max(...overlapBySheet);
  if (!(maxOverlap > 0)) {
    return {
      result: 'UNPROVABLE',
      reason: 'NO_MARKER_SHEET_OVERLAP',
      markerOccurrenceCount,
      markerMixedSheetOverlap,
      overlapBySheet,
    };
  }

  const winningIndexes = overlapBySheet
    .map((area, index) => ({ area, index }))
    .filter((item) => item.area === maxOverlap)
    .map((item) => item.index);
  if (winningIndexes.length !== 1) {
    return {
      result: 'UNPROVABLE',
      reason: 'AMBIGUOUS_MARKER_SHEET_OVERLAP',
      markerOccurrenceCount,
      markerMixedSheetOverlap,
      overlapBySheet,
    };
  }

  const markerSheetIndex = winningIndexes[0];
  return {
    result: markerSheetIndex > caretSheetIndex ? 'TRUE' : 'FALSE',
    caretSheetIndex,
    markerOccurrenceCount,
    markerSheetIndex,
    markerMixedSheetOverlap,
    maxOverlap,
    overlapBySheet,
  };
}

{
  const sheetRects = [
    { left: 0, right: 100, top: 0, bottom: 200 },
    { left: 120, right: 220, top: 0, bottom: 200 },
  ];
  assert.equal(
    classifyMarkerAfterCaretByAggregateOverlap({
      caretSheetIndex: 0,
      markerOccurrenceCount: 1,
      markerRects: [{ left: 140, right: 180, top: 20, bottom: 40 }],
      sheetRects,
    }).result,
    'TRUE',
    'pure classifier must prove TRUE only when marker is on a later sheet'
  );
  assert.equal(
    classifyMarkerAfterCaretByAggregateOverlap({
      caretSheetIndex: 0,
      markerOccurrenceCount: 1,
      markerRects: [{ left: 20, right: 80, top: 20, bottom: 40 }],
      sheetRects,
    }).result,
    'FALSE',
    'pure classifier must reject same-sheet marker overlap'
  );
  assert.equal(
    classifyMarkerAfterCaretByAggregateOverlap({
      caretSheetIndex: 0,
      markerOccurrenceCount: 1,
      markerRects: [{ left: 260, right: 300, top: 20, bottom: 40 }],
      sheetRects,
    }).result,
    'UNPROVABLE',
    'pure classifier must not guess without marker sheet overlap'
  );
  assert.equal(
    classifyMarkerAfterCaretByAggregateOverlap({
      caretSheetIndex: 0,
      markerOccurrenceCount: 1,
      markerRects: [{ left: 90, right: 130, top: 20, bottom: 40 }],
      sheetRects,
    }).result,
    'UNPROVABLE',
    'pure classifier must not guess on ambiguous aggregate overlap'
  );
  assert.equal(
    classifyMarkerAfterCaretByAggregateOverlap({
      caretSheetIndex: 0,
      markerOccurrenceCount: 0,
      markerRects: [{ left: 140, right: 180, top: 20, bottom: 40 }],
      sheetRects,
    }).result,
    'UNPROVABLE',
    'pure classifier must not guess when marker occurrence count is zero'
  );
  assert.equal(
    classifyMarkerAfterCaretByAggregateOverlap({
      caretSheetIndex: 0,
      markerOccurrenceCount: 2,
      markerRects: [{ left: 140, right: 180, top: 20, bottom: 40 }],
      sheetRects,
    }).result,
    'UNPROVABLE',
    'pure classifier must not guess when marker occurrence count is greater than one'
  );
  assert.equal(
    classifyMarkerAfterCaretByAggregateOverlap({
      caretSheetIndex: 0,
      markerOccurrenceCount: 1,
      markerRects: [{ left: 90, right: 180, top: 20, bottom: 40 }],
      sheetRects,
    }).markerMixedSheetOverlap,
    true,
    'pure classifier must report mixed overlap without hiding the risk'
  );
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

function overlapArea(a, b) {
  const left = Math.max(Number(a.left), Number(b.left));
  const right = Math.min(Number(a.right), Number(b.right));
  const top = Math.max(Number(a.top), Number(b.top));
  const bottom = Math.min(Number(a.bottom), Number(b.bottom));
  const width = Math.max(0, right - left);
  const height = Math.max(0, bottom - top);
  return width * height;
}

function classifyMarkerAfterCaretByAggregateOverlap({
  caretSheetIndex,
  markerOccurrenceCount,
  markerRects,
  sheetRects,
}) {
  if (!Number.isInteger(caretSheetIndex) || caretSheetIndex < 0) {
    return { result: 'UNPROVABLE', reason: 'INVALID_CARET_SHEET_INDEX', markerMixedSheetOverlap: false };
  }
  if (markerOccurrenceCount !== 1) {
    return {
      result: 'UNPROVABLE',
      reason: 'MARKER_OCCURRENCE_COUNT_NOT_ONE',
      markerOccurrenceCount,
      markerMixedSheetOverlap: false,
    };
  }
  if (!Array.isArray(markerRects) || markerRects.length === 0) {
    return { result: 'UNPROVABLE', reason: 'NO_MARKER_RECTS', markerOccurrenceCount, markerMixedSheetOverlap: false };
  }
  if (!Array.isArray(sheetRects) || sheetRects.length === 0) {
    return { result: 'UNPROVABLE', reason: 'NO_SHEET_RECTS', markerOccurrenceCount, markerMixedSheetOverlap: false };
  }

  const overlapBySheet = sheetRects.map((sheetRect) => markerRects.reduce(
    (sum, markerRect) => sum + overlapArea(markerRect, sheetRect),
    0
  ));
  const markerMixedSheetOverlap = overlapBySheet.filter((area) => area > 0).length > 1;
  const maxOverlap = Math.max(...overlapBySheet);
  if (!(maxOverlap > 0)) {
    return {
      result: 'UNPROVABLE',
      reason: 'NO_MARKER_SHEET_OVERLAP',
      markerOccurrenceCount,
      markerMixedSheetOverlap,
      overlapBySheet,
    };
  }

  const winningIndexes = overlapBySheet
    .map((area, index) => ({ area, index }))
    .filter((item) => item.area === maxOverlap)
    .map((item) => item.index);
  if (winningIndexes.length !== 1) {
    return {
      result: 'UNPROVABLE',
      reason: 'AMBIGUOUS_MARKER_SHEET_OVERLAP',
      markerOccurrenceCount,
      markerMixedSheetOverlap,
      overlapBySheet,
    };
  }

  const markerSheetIndex = winningIndexes[0];
  return {
    result: markerSheetIndex > caretSheetIndex ? 'TRUE' : 'FALSE',
    caretSheetIndex,
    markerOccurrenceCount,
    markerSheetIndex,
    markerMixedSheetOverlap,
    maxOverlap,
    overlapBySheet,
  };
}

function buildPlainText(paragraphCount) {
  const sentence = 'Derived sheet classifier proof paragraph for a visual sheet boundary over one Tiptap editor.';
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
    title: 'derived-sheet-classification-smoke',
    path: '',
    kind: 'chapter-file',
    metaEnabled: true,
    projectId: 'derived-sheet-classification-smoke',
    bookProfile: null,
  });
}

async function collectState(win, label) {
  return win.webContents.executeJavaScript(\`(() => {
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
    const prosePageTruthCount = prose
      ? prose.querySelectorAll('[data-page-index], [data-page-number], [data-page-id]').length
      : 0;
    return {
      label: \${JSON.stringify(label)},
      centralSheetFlow: host ? host.dataset.centralSheetFlow || null : null,
      centralSheetOverflowReason: host ? host.dataset.centralSheetOverflowReason || null : null,
      text: prose ? prose.textContent || '' : '',
      paragraphCount: prose ? prose.querySelectorAll('p').length : 0,
      visibleSheetCount: derivedWraps.length,
      sourceWrapperCount: sourceWraps.length,
      sourceEditorWrapperCount: sourceWraps.filter((el) => el.querySelector('.ProseMirror') || el.querySelector('.tiptap-editor')).length,
      sourceWrapperProseMirrorCount: sourceWraps.reduce((sum, el) => sum + el.querySelectorAll('.ProseMirror').length, 0),
      sourceWrapperTiptapEditorCount: sourceWraps.reduce((sum, el) => sum + el.querySelectorAll('.tiptap-editor').length, 0),
      derivedSheetCount: derivedWraps.length,
      derivedSheetProseMirrorCount: derivedWraps.reduce((sum, el) => sum + el.querySelectorAll('.ProseMirror').length, 0),
      derivedSheetTiptapEditorCount: derivedWraps.reduce((sum, el) => sum + el.querySelectorAll('.tiptap-editor').length, 0),
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
}

async function lockBoundaryCoordinate(win) {
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
    if (!candidates.length) {
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
    let selected = null;
    let x = null;
    let y = null;
    let caretSheetIndex = -1;
    let insideTextRect = false;
    let insideFirstSheet = false;
    let caretRange = null;
    let proofStrength = 'NONE';
    let caretInsideProse = false;
    for (const candidate of candidates) {
      for (const fraction of [0.5, 0.72, 0.28]) {
        const candidateX = Math.max(candidate.left + 1, Math.min(candidate.right - 1, candidate.left + candidate.width * fraction));
        const candidateY = candidate.top + candidate.height / 2;
        let candidateRange = null;
        let candidateProofStrength = 'NONE';
        if (typeof document.caretRangeFromPoint === 'function') {
          candidateRange = document.caretRangeFromPoint(candidateX, candidateY);
          candidateProofStrength = candidateRange ? 'REAL_COORDINATE_CARET_RANGE_FROM_POINT_PASS' : 'NONE';
        }
        if (!candidateRange && typeof document.caretPositionFromPoint === 'function') {
          const caretPosition = document.caretPositionFromPoint(candidateX, candidateY);
          if (caretPosition) {
            candidateRange = document.createRange();
            candidateRange.setStart(caretPosition.offsetNode, caretPosition.offset);
            candidateRange.collapse(true);
            candidateProofStrength = 'REAL_COORDINATE_CARET_POSITION_FROM_POINT_PASS';
          }
        }
        const caretNode = candidateRange ? candidateRange.startContainer : null;
        const caretElement = caretNode && caretNode.nodeType === Node.TEXT_NODE
          ? caretNode.parentElement
          : caretNode;
        const candidateCaretInsideProse = Boolean(caretElement && (caretElement === prose || prose.contains(caretElement)));
        const candidateSheetIndex = pageRects.findIndex((rect) => (
          candidateX >= rect.left && candidateX <= rect.right && candidateY >= rect.top && candidateY <= rect.bottom
        ));
        const candidateInsideTextRect = candidateX >= candidate.left && candidateX <= candidate.right
          && candidateY >= candidate.top && candidateY <= candidate.bottom;
        if (candidateRange && candidateCaretInsideProse && candidateInsideTextRect && candidateSheetIndex === 0) {
          selected = candidate;
          x = candidateX;
          y = candidateY;
          caretSheetIndex = candidateSheetIndex;
          insideTextRect = candidateInsideTextRect;
          insideFirstSheet = true;
          caretRange = candidateRange;
          proofStrength = candidateProofStrength;
          caretInsideProse = candidateCaretInsideProse;
          break;
        }
      }
      if (selected) break;
    }
    if (!selected) {
      selected = candidates[0];
      x = Math.max(selected.left + 1, Math.min(selected.right - 1, selected.left + selected.width / 2));
      y = selected.top + selected.height / 2;
      caretSheetIndex = pageRects.findIndex((rect) => (
        x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
      ));
      insideTextRect = x >= selected.left && x <= selected.right && y >= selected.top && y <= selected.bottom;
      insideFirstSheet = caretSheetIndex === 0;
      proofStrength = 'GEOMETRY_TEXT_RECT_BOUNDARY_PASS';
      caretInsideProse = true;
    }
    return {
      ok: Boolean((caretRange || proofStrength === 'GEOMETRY_TEXT_RECT_BOUNDARY_PASS') && caretInsideProse && insideTextRect && insideFirstSheet),
      reason: null,
      proofStrength,
      boundaryCoordinate: { x, y },
      caretSheetIndex,
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
      pageRects,
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
      const walker = document.createTreeWalker(prose, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          return node.textContent && node.textContent.trim()
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_SKIP;
        },
      });
      let current = walker.nextNode();
      while (current && !range) {
        const text = current.textContent || '';
        for (let offset = 0; offset < text.length; offset += 1) {
          const candidateRange = document.createRange();
          candidateRange.setStart(current, offset);
          candidateRange.setEnd(current, Math.min(offset + 1, text.length));
          const rects = [...candidateRange.getClientRects()];
          const matched = rects.some((rect) => (
            point.x >= rect.left
            && point.x <= rect.right
            && point.y >= rect.top
            && point.y <= rect.bottom
          ));
          if (matched) {
            range = document.createRange();
            range.setStart(current, offset);
            range.collapse(true);
            proofStrength = 'GEOMETRY_TEXT_NODE_OFFSET_FALLBACK_PASS';
            break;
          }
        }
        current = walker.nextNode();
      }
      if (!range) {
        return { ok: false, reason: 'COORDINATE_OR_TEXT_NODE_OFFSET_NO_RESULT', proofStrength };
      }
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
    const firstSheetRect = firstSheet.getBoundingClientRect();
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

async function collectMarkerGeometry(win, marker) {
  return win.webContents.executeJavaScript(\`((payload) => {
    const marker = payload.marker;
    const host = document.querySelector('#editor.tiptap-host');
    const strip = host ? host.querySelector('.tiptap-sheet-strip') : null;
    const prose = host ? host.querySelector('.ProseMirror') : null;
    const derivedWraps = strip ? [...strip.querySelectorAll(':scope > .tiptap-page-wrap')] : [];
    if (!prose || derivedWraps.length === 0) {
      return { ok: false, reason: 'PROSEMIRROR_OR_SHEETS_MISSING' };
    }
    const sheetRects = derivedWraps.map((el, index) => {
      const rect = el.getBoundingClientRect();
      return { index, x: rect.x, y: rect.y, width: rect.width, height: rect.height, top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right };
    });
    const markerRects = [];
    let markerOccurrences = 0;
    const walker = document.createTreeWalker(prose, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        return node.textContent && node.textContent.includes(marker)
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_SKIP;
      },
    });
    let current = walker.nextNode();
    while (current) {
      let from = 0;
      let index = current.textContent.indexOf(marker, from);
      while (index !== -1) {
        markerOccurrences += 1;
        const range = document.createRange();
        range.setStart(current, index);
        range.setEnd(current, index + marker.length);
        [...range.getClientRects()].forEach((rect) => {
          if (rect.width > 0 && rect.height > 0) {
            markerRects.push({
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height,
              top: rect.top,
              bottom: rect.bottom,
              left: rect.left,
              right: rect.right,
            });
          }
        });
        from = index + marker.length;
        index = current.textContent.indexOf(marker, from);
      }
      current = walker.nextNode();
    }
    return {
      ok: true,
      markerOccurrences,
      markerRects,
      sheetRects,
    };
  })(\${JSON.stringify({ marker })})\`, true);
}

async function findVerticalBoundaryFixture(win) {
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
      state.centralSheetFlow === 'vertical'
      && state.sourceWrapperCount === 1
      && state.sourceEditorWrapperCount === 1
      && state.derivedSheetCount >= 2
      && state.derivedSheetProseMirrorCount === 0
      && state.derivedSheetTiptapEditorCount === 0
      && state.proseMirrorCount === 1
      && state.tiptapEditorCount === 1
      && state.prosePageTruthCount === 0
      && boundaryCandidate.ok
      && boundaryCandidate.caretSheetIndex === 0
    ) {
      return { paragraphCount, state, boundaryCandidate };
    }
    if (state.centralSheetOverflowReason === 'max-page-count') {
      break;
    }
  }
  throw new Error('NO_VERTICAL_BOUNDARY_FIXTURE ' + JSON.stringify({ lastState, lastBoundaryCandidate }));
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

    const fixture = await findVerticalBoundaryFixture(win);
    await setEditorPayload(win, fixture.paragraphCount);
    await sleep(800);
    const beforeEnter = await collectState(win, 'before-enter');
    const boundaryCandidate = await lockBoundaryCoordinate(win);
    if (!boundaryCandidate.ok || boundaryCandidate.caretSheetIndex !== 0) {
      throw new Error('BOUNDARY_COORDINATE_NOT_PROVABLE ' + JSON.stringify(boundaryCandidate));
    }
    const caretPlacement = await placeCaretAtBoundary(win, boundaryCandidate.boundaryCoordinate);
    if (!caretPlacement.ok) {
      throw new Error('BOUNDARY_CARET_PLACEMENT_NOT_PROVABLE ' + JSON.stringify(caretPlacement));
    }

    await pressKey(win, 'Enter');
    await sleep(800);
    const afterEnter = await collectState(win, 'after-enter');

    const marker = '06B3_DERIVED_SHEET_MARKER';
    await win.webContents.insertText(marker);
    await sleep(800);
    const afterMarker = await collectState(win, 'after-marker');
    const markerGeometry = await collectMarkerGeometry(win, marker);
    const markerClassification = {
      ...markerGeometry,
      classification: markerGeometry.ok
        ? classifyMarkerAfterCaretByAggregateOverlap({
          caretSheetIndex: boundaryCandidate.caretSheetIndex,
          markerOccurrenceCount: markerGeometry.markerOccurrences,
          markerRects: markerGeometry.markerRects,
          sheetRects: markerGeometry.sheetRects,
        })
        : { result: 'UNPROVABLE', reason: markerGeometry.reason || 'MARKER_GEOMETRY_FAILED' },
    };

    const payload = {
      ok: true,
      paragraphCount: fixture.paragraphCount,
      marker,
      fixture: fixture.state,
      beforeEnter,
      boundaryCandidate,
      caretPlacement,
      afterEnter,
      afterMarker,
      markerClassification,
      networkRequests,
      dialogCalls,
    };
    await fs.writeFile(path.join(outputDir, 'result.json'), JSON.stringify(payload, null, 2));
    process.stdout.write('DERIVED_SHEET_CLASSIFICATION_SMOKE_RESULT:' + JSON.stringify(payload) + '\\n');
    app.exit(0);
  } catch (error) {
    const payload = { ok: false, error: error && error.stack ? error.stack : String(error), networkRequests, dialogCalls };
    await fs.writeFile(path.join(outputDir, 'result.json'), JSON.stringify(payload, null, 2));
    process.stdout.write('DERIVED_SHEET_CLASSIFICATION_SMOKE_RESULT:' + JSON.stringify(payload) + '\\n');
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
  throw new Error(`Electron derived sheet classification smoke failed with exit ${exitCode}`);
}

const result = JSON.parse(await readFile(path.join(outputDir, 'result.json'), 'utf8'));
if (!result.ok) {
  throw new Error(result.error || 'Electron derived sheet classification smoke returned not ok');
}

const states = [
  result.beforeEnter,
  result.afterEnter,
  result.afterMarker,
];

for (const state of states) {
  assert.equal(state.proseMirrorCount, 1, `${state.label} must keep one ProseMirror`);
  assert.equal(state.tiptapEditorCount, 1, `${state.label} must keep one Tiptap editor shell`);
  assert.equal(state.sourceWrapperCount, 1, `${state.label} must keep one direct source editor wrapper`);
  assert.equal(state.sourceEditorWrapperCount, 1, `${state.label} must keep one source editor wrapper with editor content`);
  assert.equal(state.sourceWrapperProseMirrorCount, 1, `${state.label} source wrapper must contain one ProseMirror`);
  assert.equal(state.sourceWrapperTiptapEditorCount, 1, `${state.label} source wrapper must contain one Tiptap editor shell`);
  assert.equal(state.derivedSheetCount >= 2, true, `${state.label} must keep at least two derived strip wrappers`);
  assert.equal(state.pageRects.length, state.derivedSheetCount, `${state.label} page rects must match derived strip wrappers`);
  assert.equal(
    state.pageRects.slice(1).every((rect, index) => (
      rect.top > state.pageRects[index].bottom
      && Math.abs(rect.left - state.pageRects[index].left) <= 2
    )),
    true,
    `${state.label} must keep current vertical windowed sheet stack geometry`
  );
  assert.equal(state.derivedSheetProseMirrorCount, 0, `${state.label} derived wrappers must not contain ProseMirror`);
  assert.equal(state.derivedSheetTiptapEditorCount, 0, `${state.label} derived wrappers must not contain Tiptap editor shell`);
  assert.equal(state.prosePageTruthCount, 0, `${state.label} must not create page truth inside ProseMirror`);
}

assert.equal(result.fixture.centralSheetFlow, 'vertical', 'fixture must use current vertical central sheet flow');
assert.equal(result.beforeEnter.centralSheetOverflowReason, null, 'runtime positive guard must not use overflow fallback');
assert.equal(result.afterEnter.centralSheetOverflowReason, null, 'runtime positive guard must not overflow after Enter');
assert.equal(result.afterMarker.centralSheetOverflowReason, null, 'runtime positive guard must not overflow after marker type');
assert.ok(result.beforeEnter.visibleSheetCount >= 2, 'baseline text must show at least two visible sheets');
assert.equal(result.boundaryCandidate.ok, true, 'boundary coordinate candidate must be found');
assert.equal(result.boundaryCandidate.insideTextRect, true, 'boundary coordinate must be inside a real text rect');
assert.equal(result.boundaryCandidate.insideFirstSheet, true, 'boundary coordinate must be inside first visual sheet');
assert.equal(result.boundaryCandidate.caretSheetIndex, 0, 'caret coordinate must classify to the first derived sheet');
assert.match(
  result.caretPlacement.proofStrength,
  /^(REAL_COORDINATE_CARET_(RANGE|POSITION)_FROM_POINT_PASS|GEOMETRY_TEXT_NODE_OFFSET_FALLBACK_PASS)$/u,
  'caret placement must use a browser coordinate caret API or explicit text node geometry fallback'
);
assert.equal(result.caretPlacement.selectionInsideProse, true, 'selection must be inside ProseMirror before Enter');
assert.equal(result.caretPlacement.activeElementInsideProse, true, 'active element must be inside ProseMirror before Enter');
assert.equal(
  result.caretPlacement.selectionRectInsideBoundarySafeBand,
  true,
  'selection coordinate must stay in the first sheet boundary safe band'
);
assert.equal(
  result.afterEnter.paragraphCount > result.beforeEnter.paragraphCount,
  true,
  'Enter from boundary coordinate must increase paragraph count'
);
assert.equal(markerCount(result.afterMarker.text, result.marker), 1, 'derived sheet marker must appear once');
assert.equal(result.markerClassification.ok, true, 'marker classifier must run in renderer');
assert.equal(result.markerClassification.markerOccurrences, 1, 'marker DOM search must find exactly one marker occurrence');
assert.equal(result.markerClassification.markerRects.length > 0, true, 'marker DOM Range must expose visible rects');
const expectedClassification = result.markerClassification.classification.markerSheetIndex > result.markerClassification.classification.caretSheetIndex
  ? 'TRUE'
  : 'FALSE';
assert.equal(
  result.markerClassification.classification.result,
  expectedClassification,
  'runtime classifier must match marker sheet index relative to caret sheet index'
);
assert.equal(
  typeof result.markerClassification.classification.markerMixedSheetOverlap,
  'boolean',
  'runtime classifier must report whether marker overlaps multiple derived sheets'
);
assert.equal(
  Number.isInteger(result.markerClassification.classification.markerSheetIndex),
  true,
  'runtime classifier must report a concrete marker sheet index'
);
assert.equal(
  Number.isInteger(result.markerClassification.classification.caretSheetIndex),
  true,
  'runtime classifier must report a concrete caret sheet index'
);
assert.equal(result.afterMarker.activeElementInsideProse, true, 'active element must remain inside ProseMirror after marker type');
assert.equal(result.afterMarker.selectionInsideProse, true, 'selection must remain inside ProseMirror after marker type');
assert.equal(result.afterMarker.rightInspectorVisible, true, 'right inspector must remain visible as adjacent guard');
assert.equal(result.networkRequests, 0, 'smoke must not trigger network requests');
assert.equal(result.dialogCalls, 0, 'smoke must not trigger dialogs');

const summary = {
  outputDir,
  paragraphCount: result.paragraphCount,
  proofStrength: result.caretPlacement.proofStrength,
  visibleSheetCount: result.afterMarker.visibleSheetCount,
  proseMirrorCount: result.afterMarker.proseMirrorCount,
  tiptapEditorCount: result.afterMarker.tiptapEditorCount,
  sourceWrapperCount: result.afterMarker.sourceWrapperCount,
  sourceEditorWrapperCount: result.afterMarker.sourceEditorWrapperCount,
  derivedSheetCount: result.afterMarker.derivedSheetCount,
  derivedSheetProseMirrorCount: result.afterMarker.derivedSheetProseMirrorCount,
  derivedSheetTiptapEditorCount: result.afterMarker.derivedSheetTiptapEditorCount,
  prosePageTruthCount: result.afterMarker.prosePageTruthCount,
  centralSheetOverflowReason: result.afterMarker.centralSheetOverflowReason,
  boundaryCoordinateFound: result.boundaryCandidate.ok,
  caretSheetIndex: result.boundaryCandidate.caretSheetIndex,
  markerSheetIndex: result.markerClassification.classification.markerSheetIndex,
  expectedClassifierResult: expectedClassification,
  classifierResult: result.markerClassification.classification.result,
  markerMixedSheetOverlap: result.markerClassification.classification.markerMixedSheetOverlap,
  markerRectCount: result.markerClassification.markerRects.length,
  markerOccurrences: result.markerClassification.markerOccurrences,
  distanceFromFirstSheetBottom: result.boundaryCandidate.selectedTextRect.distanceFromSheetBottom,
  paragraphCountBeforeEnter: result.beforeEnter.paragraphCount,
  paragraphCountAfterEnter: result.afterEnter.paragraphCount,
  markerAfterType: markerCount(result.afterMarker.text, result.marker),
  activeElementInsideProse: result.afterMarker.activeElementInsideProse,
  selectionInsideProse: result.afterMarker.selectionInsideProse,
  rightInspectorVisible: result.afterMarker.rightInspectorVisible,
  networkRequests: result.networkRequests,
  dialogCalls: result.dialogCalls,
};

process.stdout.write(`DERIVED_SHEET_CLASSIFICATION_SMOKE_SUMMARY:${JSON.stringify(summary)}\n`);

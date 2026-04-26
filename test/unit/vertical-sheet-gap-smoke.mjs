import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const rootDir = path.resolve(new URL('../..', import.meta.url).pathname);
const requireFromHere = createRequire(import.meta.url);
const electronBinary = requireFromHere('electron');
const FORCED_DEVICE_SCALE_FACTOR = 2;
const DEVICE_PIXEL_TOLERANCE_PX = 1;
const outputDir = process.env.VERTICAL_SHEET_GAP_OUT_DIR
  ? path.resolve(process.env.VERTICAL_SHEET_GAP_OUT_DIR)
  : await mkdtemp(path.join(os.tmpdir(), 'vertical-sheet-gap-'));

async function read(relativePath) {
  return readFile(path.join(rootDir, relativePath), 'utf8');
}

async function loadModule(relativePath) {
  return import(pathToFileURL(path.join(rootDir, relativePath)).href);
}

function buildHelperSource() {
  return `
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs/promises');
const { app, BrowserWindow, dialog, session } = require('electron');

const rootDir = ${JSON.stringify(rootDir)};
const outputDir = ${JSON.stringify(outputDir)};
const forcedDeviceScaleFactor = ${JSON.stringify(FORCED_DEVICE_SCALE_FACTOR)};
const devicePixelTolerancePx = ${JSON.stringify(DEVICE_PIXEL_TOLERANCE_PX)};
const mainEntrypoint = path.join(rootDir, 'src', 'main' + '.js');
let networkRequests = 0;
let dialogCalls = 0;
const rendererDiagnostics = [];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildPlainText(paragraphCount) {
  const paragraph = 'Vertical gap live proof paragraph. This text must stay inside derived sheets and outside visual gaps.';
  return Array.from({ length: paragraphCount }, (_, index) => (
    paragraph + ' ' + String(index + 1) + '. ' + paragraph
  )).join('\\\\n\\\\n');
}

function parseTransformScale(transform) {
  const normalizedTransform = String(transform || '').trim();
  const readTransformParts = (name) => {
    const prefix = name + '(';
    if (!normalizedTransform.startsWith(prefix) || !normalizedTransform.endsWith(')')) {
      return null;
    }
    return normalizedTransform
      .slice(prefix.length, -1)
      .split(',')
      .map((part) => Number.parseFloat(part.trim()));
  };
  const matrixParts = readTransformParts('matrix');
  const matrix3dParts = matrixParts ? null : readTransformParts('matrix3d');
  let scaleX = 1;
  let scaleY = 1;
  if (matrixParts) {
    if (matrixParts.length >= 4 && matrixParts.every(Number.isFinite)) {
      scaleX = Math.hypot(matrixParts[0], matrixParts[1]);
      scaleY = Math.hypot(matrixParts[2], matrixParts[3]);
    }
  } else if (matrix3dParts) {
    if (matrix3dParts.length >= 16 && matrix3dParts.every(Number.isFinite)) {
      scaleX = Math.hypot(matrix3dParts[0], matrix3dParts[1], matrix3dParts[2]);
      scaleY = Math.hypot(matrix3dParts[4], matrix3dParts[5], matrix3dParts[6]);
    }
  }
  return {
    scaleX,
    scaleY,
    hasScaleTransform: Math.abs(scaleX - 1) > 0.0001 || Math.abs(scaleY - 1) > 0.0001,
  };
}

function assertTransformParserFixtures() {
  assert.equal(parseTransformScale('matrix(2, 0, 0, 2, 0, 0)').hasScaleTransform, true);
  assert.equal(parseTransformScale('matrix3d(2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)').hasScaleTransform, true);
  assert.equal(parseTransformScale('matrix(1, 0, 0, 1, 0, 0)').hasScaleTransform, false);
  assert.equal(parseTransformScale('matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)').hasScaleTransform, false);
}

async function waitForWindow() {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      win.webContents.on('console-message', (_event, level, message, line, sourceId) => {
        rendererDiagnostics.push({ level, message, line, sourceId });
      });
      win.webContents.on('render-process-gone', (_event, details) => {
        rendererDiagnostics.push({ level: 'render-process-gone', message: JSON.stringify(details), line: 0, sourceId: '' });
      });
      return win;
    }
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
    title: 'vertical-sheet-gap-smoke',
    path: '',
    kind: 'chapter-file',
    metaEnabled: true,
    projectId: 'vertical-sheet-gap-smoke',
    bookProfile: null,
  });
}

async function captureBottomMarginInk(win, image) {
  const geometry = await win.webContents.executeJavaScript([
    '(() => {',
    '  const rootStyles = getComputedStyle(document.documentElement);',
    '  const readRootPx = (name) => {',
    '    const value = Number.parseFloat(rootStyles.getPropertyValue(name));',
    '    return Number.isFinite(value) ? value : 0;',
    '  };',
    '  const host = document.querySelector("#editor.tiptap-host");',
    '  const strip = host ? host.querySelector(".tiptap-sheet-strip") : null;',
    '  const pageWraps = strip ? [...strip.querySelectorAll(":scope > .tiptap-page-wrap")] : [];',
    '  return {',
    '    viewportWidth: window.innerWidth,',
    '    viewportHeight: window.innerHeight,',
    '    marginLeftPx: readRootPx("--page-margin-left-px"),',
    '    marginRightPx: readRootPx("--page-margin-right-px"),',
    '    marginBottomPx: readRootPx("--page-margin-bottom-px"),',
    '    pageRects: pageWraps.map((el) => {',
    '      const rect = el.getBoundingClientRect();',
    '      return {',
    '        left: rect.left,',
    '        right: rect.right,',
    '        top: rect.top,',
    '        bottom: rect.bottom,',
    '        width: rect.width,',
    '        height: rect.height,',
    '      };',
    '    }),',
    '  };',
    '})()',
  ].join('\\n'), true);
  const size = image.getSize();
  const bitmap = image.getBitmap();
  const scaleX = geometry.viewportWidth > 0 ? size.width / geometry.viewportWidth : 1;
  const scaleY = geometry.viewportHeight > 0 ? size.height / geometry.viewportHeight : 1;
  let inkPixelCount = 0;
  let sampledPixelCount = 0;
  for (const rect of geometry.pageRects || []) {
    const left = Math.max(0, Math.floor((rect.left + geometry.marginLeftPx + 8) * scaleX));
    const right = Math.min(size.width, Math.ceil((rect.right - geometry.marginRightPx - 8) * scaleX));
    const top = Math.max(0, Math.floor((rect.bottom - geometry.marginBottomPx + 8) * scaleY));
    const bottom = Math.min(size.height, Math.ceil((rect.bottom - 8) * scaleY));
    if (right <= left || bottom <= top) continue;
    for (let y = top; y < bottom; y += 4) {
      for (let x = left; x < right; x += 4) {
        const index = ((y * size.width) + x) * 4;
        const blue = bitmap[index];
        const green = bitmap[index + 1];
        const red = bitmap[index + 2];
        const alpha = bitmap[index + 3];
        sampledPixelCount += 1;
        const luma = (0.2126 * red) + (0.7152 * green) + (0.0722 * blue);
        if (alpha > 180 && luma < 135) {
          inkPixelCount += 1;
        }
      }
    }
  }
  return { inkPixelCount, sampledPixelCount };
}

async function saveCapture(win, basename) {
  const image = await win.webContents.capturePage();
  await fs.writeFile(path.join(outputDir, basename), image.toPNG());
  const ink = await captureBottomMarginInk(win, image);
  const imageSize = image.getSize();
  const viewport = await win.webContents.executeJavaScript(\`(() => ({
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio,
  }))()\`, true);
  const expectedBitmapWidth = Math.round(viewport.viewportWidth * viewport.devicePixelRatio);
  const expectedBitmapHeight = Math.round(viewport.viewportHeight * viewport.devicePixelRatio);
  return {
    ...ink,
    bitmapWidth: imageSize.width,
    bitmapHeight: imageSize.height,
    viewportWidth: viewport.viewportWidth,
    viewportHeight: viewport.viewportHeight,
    devicePixelRatio: viewport.devicePixelRatio,
    expectedBitmapWidth,
    expectedBitmapHeight,
    bitmapWidthDeltaDevicePx: Math.abs(imageSize.width - expectedBitmapWidth),
    bitmapHeightDeltaDevicePx: Math.abs(imageSize.height - expectedBitmapHeight),
  };
}

async function scrollEditorViewport(win, ratio) {
  return win.webContents.executeJavaScript(\`(() => {
    const main = document.querySelector('.main-content');
    if (!(main instanceof HTMLElement)) return { scrollTop: 0, scrollHeight: 0, clientHeight: 0 };
    const maxScrollTop = Math.max(0, main.scrollHeight - main.clientHeight);
    main.scrollTop = Math.round(maxScrollTop * \${JSON.stringify(ratio)});
    return {
      scrollTop: main.scrollTop,
      scrollHeight: main.scrollHeight,
      clientHeight: main.clientHeight,
      maxScrollTop,
    };
  })()\`, true);
}

async function runInputSmoke(win) {
  return win.webContents.executeJavaScript(\`(() => {
    const host = document.querySelector('#editor.tiptap-host');
    const prose = host ? host.querySelector('.ProseMirror') : null;
    if (!(prose instanceof HTMLElement)) {
      return { ok: false, reason: 'NO_PROSEMIRROR' };
    }
    prose.focus();
    const before = prose.textContent || '';
    const selection = window.getSelection();
    const canSelect = Boolean(selection);
    document.execCommand('insertText', false, ' no-bleed-input-smoke ');
    const afterInsert = prose.textContent || '';
    document.execCommand('undo');
    const afterUndo = prose.textContent || '';
    document.execCommand('redo');
    const afterRedo = prose.textContent || '';
    return {
      ok: afterInsert.includes('no-bleed-input-smoke')
        && afterUndo === before
        && afterRedo.includes('no-bleed-input-smoke'),
      activeElementInsideProse: prose.contains(document.activeElement),
      canSelect,
      inserted: afterInsert.includes('no-bleed-input-smoke'),
      undone: afterUndo === before,
      redone: afterRedo.includes('no-bleed-input-smoke'),
    };
  })()\`, true);
}

async function collectState(win, label) {
  return win.webContents.executeJavaScript(\`(() => {
    const parseTransformScale = \${parseTransformScale.toString()};
    const host = document.querySelector('#editor.tiptap-host');
    const strip = host ? host.querySelector('.tiptap-sheet-strip') : null;
    const prose = host ? host.querySelector('.ProseMirror') : null;
    const tiptapEditor = host ? host.querySelector('.tiptap-editor') : null;
    const primaryTextSurfaceNodes = [host, strip, tiptapEditor, prose].filter(Boolean);
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
    const rootStyles = getComputedStyle(document.documentElement);
    const readRootPx = (name) => {
      const value = Number.parseFloat(rootStyles.getPropertyValue(name));
      return Number.isFinite(value) ? value : 0;
    };
    const marginTopPx = readRootPx('--page-margin-top-px');
    const marginBottomPx = readRootPx('--page-margin-bottom-px');
    const centralSheetContentHeightPx = readRootPx('--central-sheet-content-height-px');
    const centralSheetPageStridePx = readRootPx('--central-sheet-page-stride-px');
    const contentRects = pageRects.map((rect) => ({
      left: rect.left,
      right: rect.right,
      top: rect.top + marginTopPx,
      bottom: rect.bottom - marginBottomPx,
      width: rect.width,
      height: Math.max(0, rect.height - marginTopPx - marginBottomPx),
    }));
    const bottomMarginRects = pageRects.map((rect) => ({
      left: rect.left,
      right: rect.right,
      top: rect.bottom - marginBottomPx,
      bottom: rect.bottom,
      width: rect.width,
      height: marginBottomPx,
    }));
    const devicePixelRatio = window.devicePixelRatio || 1;
    const forcedDeviceScaleFactor = \${JSON.stringify(forcedDeviceScaleFactor)};
    const devicePixelTolerancePx = \${JSON.stringify(devicePixelTolerancePx)};
    const cssPixelTolerancePx = devicePixelTolerancePx / devicePixelRatio;
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
    let nonEmptyTextNodeCount = 0;
    if (walker) {
      let current = walker.nextNode();
      while (current) {
        nonEmptyTextNodeCount += 1;
        const range = document.createRange();
        range.selectNodeContents(current);
        [...range.getClientRects()].forEach((rect) => {
          textRects.push({
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            left: rect.left,
            right: rect.right,
            top: rect.top,
            bottom: rect.bottom,
          });
        });
        current = walker.nextNode();
      }
    }
    const intersects = (a, b) => (
      a.left < b.right
      && a.right > b.left
      && a.top < b.bottom
      && a.bottom > b.top
    );
    const intersectsWithTolerance = (a, b, tolerancePx) => (
      a.left < b.right - tolerancePx
      && a.right > b.left + tolerancePx
      && a.top < b.bottom - tolerancePx
      && a.bottom > b.top + tolerancePx
    );
    const containedWithinTolerance = (inner, outer, tolerancePx) => (
      inner.left >= outer.left - tolerancePx
      && inner.right <= outer.right + tolerancePx
      && inner.top >= outer.top - tolerancePx
      && inner.bottom <= outer.bottom + tolerancePx
    );
    const transformScaleEvidence = primaryTextSurfaceNodes.map((node) => {
      const styles = getComputedStyle(node);
      const transform = styles.transform || '';
      const scaleEvidence = parseTransformScale(transform);
      return {
        className: node.className || node.id || node.nodeName,
        transform,
        ...scaleEvidence,
      };
    });
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    const visibleInViewport = (rect) => (
      rect.left < viewportWidth
      && rect.right > 0
      && rect.top < viewportHeight
      && rect.bottom > 0
    );
    const visiblePageRects = pageRects.filter(visibleInViewport);
    const visibleTextRects = textRects.filter(visibleInViewport);
    const editorRect = tiptapEditor ? tiptapEditor.getBoundingClientRect() : null;
    const editorContentRects = editorRect && centralSheetContentHeightPx > 0 && centralSheetPageStridePx > 0
      ? Array.from({ length: Math.max(1, pageRects.length) }, (_, index) => ({
          left: editorRect.left,
          right: editorRect.right,
          top: editorRect.top + (index * centralSheetPageStridePx),
          bottom: editorRect.top + (index * centralSheetPageStridePx) + centralSheetContentHeightPx,
          width: editorRect.width,
          height: centralSheetContentHeightPx,
        })).filter(visibleInViewport)
      : contentRects;
    const visibleTextRectsClippedToViewport = visibleTextRects.map((textRect) => ({
      left: Math.max(textRect.left, 0),
      right: Math.min(textRect.right, viewportWidth),
      top: Math.max(textRect.top, 0),
      bottom: Math.min(textRect.bottom, viewportHeight),
    }));
    const visiblePaintedTextRects = visibleTextRectsClippedToViewport.flatMap((textRect) => (
      editorContentRects
        .filter((contentRect) => intersects(textRect, contentRect))
        .map((contentRect) => ({
          left: Math.max(textRect.left, contentRect.left),
          right: Math.min(textRect.right, contentRect.right),
          top: Math.max(textRect.top, contentRect.top),
          bottom: Math.min(textRect.bottom, contentRect.bottom),
        }))
        .filter((rect) => rect.left < rect.right && rect.top < rect.bottom)
    ));
    const visibleTextOutsideContentRectByDeviceToleranceCount = visiblePaintedTextRects.filter((textRect) => (
      !editorContentRects.some((contentRect) => containedWithinTolerance(textRect, contentRect, cssPixelTolerancePx))
    )).length;
    const visibleTextOutsideVisibleSheetRectCount = visibleTextRects.filter((textRect) => (
      !visiblePageRects.some((pageRect) => intersects(textRect, pageRect))
    )).length;
    const textGapIntersectionCount = textRects.filter((textRect) => (
      gapRects.some((gapRect) => gapRect.height > 0 && intersects(textRect, gapRect))
    )).length;
    const textGapIntersectionByDeviceToleranceCount = textRects.filter((textRect) => (
      gapRects.some((gapRect) => gapRect.height > 0 && intersectsWithTolerance(textRect, gapRect, cssPixelTolerancePx))
    )).length;
    const visibleTextGapIntersectionCount = visibleTextRects.filter((textRect) => (
      gapRects.some((gapRect) => gapRect.height > 0 && intersects(textRect, gapRect))
    )).length;
    const visibleTextGapIntersectionByDeviceToleranceCount = visibleTextRects.filter((textRect) => (
      gapRects.some((gapRect) => gapRect.height > 0 && intersectsWithTolerance(textRect, gapRect, cssPixelTolerancePx))
    )).length;
    const textInsideSheetRectCount = textRects.filter((textRect) => (
      pageRects.some((pageRect) => intersects(textRect, pageRect))
    )).length;
    const visibleTextInsideSheetRectCount = visibleTextRects.filter((textRect) => (
      pageRects.some((pageRect) => intersects(textRect, pageRect))
    )).length;
    const textInsideContentRectCount = textRects.filter((textRect) => (
      contentRects.some((contentRect) => intersects(textRect, contentRect))
    )).length;
    const textBottomMarginIntersectionCount = textRects.filter((textRect) => (
      bottomMarginRects.some((bottomMarginRect) => bottomMarginRect.height > 0 && intersects(textRect, bottomMarginRect))
    )).length;
    const visibleTextBottomMarginIntersectionCount = visibleTextRects.filter((textRect) => (
      bottomMarginRects.some((bottomMarginRect) => bottomMarginRect.height > 0 && intersects(textRect, bottomMarginRect))
    )).length;
    const visibleTextBottomMarginIntersectionByDeviceToleranceCount = visibleTextRects.filter((textRect) => (
      bottomMarginRects.some((bottomMarginRect) => (
        bottomMarginRect.height > 0 && intersectsWithTolerance(textRect, bottomMarginRect, cssPixelTolerancePx)
      ))
    )).length;
    const visibleTextClipMaskLossCandidateCount = visibleTextGapIntersectionByDeviceToleranceCount
      + visibleTextBottomMarginIntersectionByDeviceToleranceCount
      + visibleTextOutsideVisibleSheetRectCount;
    const rightFlowSheetPairCount = pageRects.slice(1).filter((rect, index) => {
      const previous = pageRects[index];
      return previous && rect.left > previous.left + 24;
    }).length;
    const verticallyStackedSheetPairCount = pageRects.slice(1).filter((rect, index) => {
      const previous = pageRects[index];
      return previous && rect.top > previous.top + 24 && Math.abs(rect.left - previous.left) <= 2;
    }).length;
    const gapHeights = gapRects.map((rect) => Math.round(rect.height));
    const editorStyles = tiptapEditor ? getComputedStyle(tiptapEditor) : null;
    const hostStyles = host ? getComputedStyle(host) : null;
    return {
      label: \${JSON.stringify(label)},
      forcedDeviceScaleFactor,
      devicePixelRatio,
      devicePixelTolerancePx,
      cssPixelTolerancePx,
      proofClass: Boolean(host && host.classList.contains('tiptap-host--central-sheet-strip-proof')),
      centralSheetFlow: host ? host.dataset.centralSheetFlow || null : null,
      centralSheetRenderedPageCount: host ? host.dataset.centralSheetRenderedPageCount || host.dataset.centralSheetCount || null : null,
      centralSheetTotalPageCount: host ? host.dataset.centralSheetTotalPageCount || host.dataset.centralSheetCount || null : null,
      centralSheetWindowingEnabled: host ? host.dataset.centralSheetWindowingEnabled || null : null,
      centralSheetBoundedOverflowReason: host ? host.dataset.centralSheetBoundedOverflowReason || null : null,
      centralSheetBoundedOverflowSourcePageCount: host ? host.dataset.centralSheetBoundedOverflowSourcePageCount || null : null,
      centralSheetBoundedOverflowVisiblePageCount: host ? host.dataset.centralSheetBoundedOverflowVisiblePageCount || null : null,
      centralSheetBoundedOverflowHiddenPageCount: host ? host.dataset.centralSheetBoundedOverflowHiddenPageCount || null : null,
      visibleSheetCount: pageWraps.length,
      pageGapCssPx: rootStyles.getPropertyValue('--page-gap-px').trim(),
      gapHeights,
      minGapPx: gapHeights.length ? Math.min(...gapHeights) : 0,
      maxGapPx: gapHeights.length ? Math.max(...gapHeights) : 0,
      textGapIntersectionCount,
      textGapIntersectionByDeviceToleranceCount,
      visibleTextGapIntersectionCount,
      visibleTextGapIntersectionByDeviceToleranceCount,
      textInsideSheetRectCount,
      visibleTextInsideSheetRectCount,
      textInsideContentRectCount,
      textBottomMarginIntersectionCount,
      visibleTextBottomMarginIntersectionCount,
      visibleTextBottomMarginIntersectionByDeviceToleranceCount,
      visibleTextClipMaskLossCandidateCount,
      visibleTextRectCount: visibleTextRects.length,
      textRectCount: textRects.length,
      nonEmptyTextNodeCount,
      visibleTextOutsideContentRectByDeviceToleranceCount,
      visibleTextOutsideVisibleSheetRectCount,
      proseMirrorCount: host ? host.querySelectorAll('.ProseMirror').length : 0,
      tiptapEditorCount: host ? host.querySelectorAll('.tiptap-editor').length : 0,
      prosePageTruthCount: prose ? prose.querySelectorAll('[data-page-index], [data-page-number], [data-page-id]').length : 0,
      editorMaskImage: editorStyles ? editorStyles.maskImage || '' : '',
      editorWebkitMaskImage: editorStyles ? editorStyles.webkitMaskImage || '' : '',
      transformScaleEvidence,
      primaryTextSurfaceScaleTransformCount: transformScaleEvidence.filter((item) => item.hasScaleTransform).length,
      lineGuardPx: hostStyles ? hostStyles.getPropertyValue('--central-sheet-line-guard-px').trim() : '',
      activeElementInsideProse: prose ? prose.contains(document.activeElement) : false,
      rightFlowSheetPairCount,
      verticallyStackedSheetPairCount,
    };
  })()\`, true);
}

async function findFiveSheetFixture(win) {
  let lastState = null;
  for (let paragraphCount = 1; paragraphCount <= 40; paragraphCount += 1) {
    await setEditorPayload(win, paragraphCount);
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
      && state.visibleSheetCount === renderedPageCount
      && state.verticallyStackedSheetPairCount === Math.max(0, renderedPageCount - 1)
      && state.rightFlowSheetPairCount === 0
      && state.visibleTextOutsideVisibleSheetRectCount === 0
      && totalPageCount >= 5
      && state.centralSheetWindowingEnabled === 'true'
      && (
        hasBoundedOverflow
          ? state.centralSheetBoundedOverflowReason === 'max-page-count'
          : state.centralSheetBoundedOverflowReason === null
      )
      && state.proseMirrorCount === 1
      && state.tiptapEditorCount === 1
      && state.prosePageTruthCount === 0
    ) {
      return { paragraphCount, state };
    }
  }
  throw new Error('NO_FIVE_SHEET_GAP_FIXTURE ' + JSON.stringify(lastState));
}

assertTransformParserFixtures();
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('force-device-scale-factor', String(forcedDeviceScaleFactor));
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
    win.setContentSize(1280, 1410);
    await sleep(1200);
    const fixture = await findFiveSheetFixture(win);
    await setEditorPayload(win, fixture.paragraphCount);
    await sleep(800);
    const topScroll = await scrollEditorViewport(win, 0);
    await sleep(250);
    const topState = await collectState(win, 'top');
    const topInk = await saveCapture(win, 'vertical-sheet-gap-top.png');
    const middleScroll = await scrollEditorViewport(win, 0.5);
    await sleep(250);
    const middleState = await collectState(win, 'middle-scroll');
    const middleInk = await saveCapture(win, 'vertical-sheet-gap-middle-scroll.png');
    const afterScroll = await scrollEditorViewport(win, 1);
    await sleep(250);
    const afterScrollState = await collectState(win, 'after-scroll');
    const afterScrollInk = await saveCapture(win, 'vertical-sheet-gap-after-scroll.png');
    await scrollEditorViewport(win, 0);
    await sleep(250);
    const inputSmoke = await runInputSmoke(win);
    const payload = {
      ok: true,
      deviceScaleEvidence: {
        forcedDeviceScaleFactor,
        devicePixelTolerancePx,
        commandLineForceDeviceScaleFactor: app.commandLine.getSwitchValue('force-device-scale-factor'),
        commandLineHighDpiSupport: app.commandLine.getSwitchValue('high-dpi-support'),
        devicePixelRatio: topState.devicePixelRatio,
      },
      paragraphCount: fixture.paragraphCount,
      state: topState,
      states: {
        top: topState,
        middle: middleState,
        afterScroll: afterScrollState,
      },
      scroll: {
        top: topScroll,
        middle: middleScroll,
        afterScroll,
      },
      bottomMarginInk: {
        top: topInk,
        middle: middleInk,
        afterScroll: afterScrollInk,
      },
      inputSmoke,
      networkRequests,
      dialogCalls,
      rendererDiagnostics,
      screenshots: [
        path.join(outputDir, 'vertical-sheet-gap-top.png'),
        path.join(outputDir, 'vertical-sheet-gap-middle-scroll.png'),
        path.join(outputDir, 'vertical-sheet-gap-after-scroll.png'),
      ],
    };
    await fs.writeFile(path.join(outputDir, 'result.json'), JSON.stringify(payload, null, 2));
    process.stdout.write('VERTICAL_SHEET_GAP_ELECTRON_RESULT:' + JSON.stringify(payload) + '\\\\n');
    app.exit(0);
  } catch (error) {
    const payload = {
      ok: false,
      error: error && error.stack ? error.stack : String(error),
      networkRequests,
      dialogCalls,
      rendererDiagnostics,
    };
    await fs.writeFile(path.join(outputDir, 'result.json'), JSON.stringify(payload, null, 2));
    process.stdout.write('VERTICAL_SHEET_GAP_ELECTRON_RESULT:' + JSON.stringify(payload) + '\\\\n');
    app.exit(1);
  }
});
`;
}

const editorText = await read('src/renderer/editor.js');
const cssText = await read('src/renderer/styles.css');
const { PX_PER_MM_AT_ZOOM_1 } = await loadModule('src/core/pageLayoutMetrics.mjs');
const { PREVIEW_CHROME_DEFAULT_PAGE_GAP_MM } = await loadModule('src/renderer/previewChrome.mjs');

const defaultGapAtHalfZoom = Math.round(PREVIEW_CHROME_DEFAULT_PAGE_GAP_MM * 0.5 * PX_PER_MM_AT_ZOOM_1);
const defaultGapAtFullZoom = Math.round(PREVIEW_CHROME_DEFAULT_PAGE_GAP_MM * PX_PER_MM_AT_ZOOM_1);

assert.equal(defaultGapAtHalfZoom >= 24, true);
assert.equal(defaultGapAtHalfZoom <= 72, true);
assert.equal(defaultGapAtFullZoom >= 24, true);
assert.equal(defaultGapAtFullZoom <= 72, true);
assert.equal(editorText.includes("editor.dataset.centralSheetFlow = 'vertical';"), true);
assert.equal(editorText.includes("getRootCssPxValue('--page-gap-px', 24)"), true);
assert.equal(editorText.includes('metrics.pageHeightPx + pageGapPx'), true);
assert.equal(editorText.includes('pageWindow.totalVirtualHeight'), true);
assert.equal(editorText.includes('stripHeightPx - metrics.marginTopPx - metrics.marginBottomPx'), true);
assert.equal(editorText.includes('resolveCentralSheetLineGuardPx(proseMirror)'), true);
assert.equal(editorText.includes("editor.style.setProperty('--central-sheet-line-guard-px'"), true);
assert.equal(cssText.includes('flex-direction: column;'), true);
assert.equal(cssText.includes('gap: var(--page-gap-px);'), true);
assert.equal(cssText.includes('column-width: var(--central-sheet-content-width-px);'), false);
assert.equal(cssText.includes('mask-image: repeating-linear-gradient('), true);
assert.equal(cssText.includes('-webkit-mask-image: repeating-linear-gradient('), true);
assert.equal(cssText.includes('mask-size: 100% var(--central-sheet-page-stride-px);'), true);

const helperPath = path.join(outputDir, 'vertical-sheet-gap-helper.cjs');
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
  }, 60000);
  child.on('exit', (code) => {
    clearTimeout(timer);
    resolve(typeof code === 'number' ? code : 1);
  });
});

const rawResult = await readFile(path.join(outputDir, 'result.json'), 'utf8');
const result = JSON.parse(rawResult);
const state = result.state || {};
const states = Object.values(result.states || {});

assert.equal(exitCode, 0, `electron helper failed with ${exitCode}\n${stdout}\n${stderr}`);
assert.equal(result.ok, true);
assert.equal(Number.isFinite(DEVICE_PIXEL_TOLERANCE_PX), true);
assert.equal(DEVICE_PIXEL_TOLERANCE_PX, 1);
assert.equal(result.deviceScaleEvidence && result.deviceScaleEvidence.forcedDeviceScaleFactor, FORCED_DEVICE_SCALE_FACTOR);
assert.equal(result.deviceScaleEvidence && result.deviceScaleEvidence.commandLineForceDeviceScaleFactor, String(FORCED_DEVICE_SCALE_FACTOR));
assert.equal(result.deviceScaleEvidence && result.deviceScaleEvidence.commandLineHighDpiSupport, '1');
assert.equal(result.deviceScaleEvidence && result.deviceScaleEvidence.devicePixelRatio, FORCED_DEVICE_SCALE_FACTOR);
assert.equal(states.length, 3);
for (const measuredState of states) {
  const renderedPageCount = Number(measuredState.centralSheetRenderedPageCount || measuredState.visibleSheetCount || 0);
  const totalPageCount = Number(measuredState.centralSheetTotalPageCount || renderedPageCount || 0);
  const hasBoundedOverflow = totalPageCount > renderedPageCount;
  assert.equal(measuredState.proofClass, true);
  assert.equal(measuredState.centralSheetFlow, 'vertical');
  assert.equal(renderedPageCount >= 2, true);
  assert.equal(renderedPageCount <= 15, true);
  assert.equal(measuredState.visibleSheetCount, renderedPageCount);
  assert.equal(measuredState.forcedDeviceScaleFactor, FORCED_DEVICE_SCALE_FACTOR);
  assert.equal(measuredState.devicePixelRatio, FORCED_DEVICE_SCALE_FACTOR);
  assert.equal(measuredState.devicePixelTolerancePx, DEVICE_PIXEL_TOLERANCE_PX);
  assert.equal(measuredState.cssPixelTolerancePx, DEVICE_PIXEL_TOLERANCE_PX / FORCED_DEVICE_SCALE_FACTOR);
  assert.equal(measuredState.verticallyStackedSheetPairCount, Math.max(0, renderedPageCount - 1));
  assert.equal(measuredState.rightFlowSheetPairCount, 0);
  assert.equal(measuredState.centralSheetWindowingEnabled, 'true');
  assert.equal(measuredState.minGapPx >= 24, true);
  assert.equal(measuredState.maxGapPx <= 72, true);
  assert.equal(measuredState.textRectCount > 0, true);
  assert.equal(measuredState.nonEmptyTextNodeCount > 0, true);
  assert.equal(measuredState.visibleTextRectCount > 0, true);
  assert.equal(measuredState.textGapIntersectionCount, 0);
  assert.equal(measuredState.textGapIntersectionByDeviceToleranceCount, 0);
  assert.equal(measuredState.visibleTextGapIntersectionCount, 0);
  assert.equal(measuredState.visibleTextGapIntersectionByDeviceToleranceCount, 0);
  assert.equal(measuredState.visibleTextOutsideVisibleSheetRectCount, 0);
  assert.equal(measuredState.visibleTextOutsideContentRectByDeviceToleranceCount, 0);
  assert.equal(measuredState.visibleTextClipMaskLossCandidateCount, 0);
  assert.equal(measuredState.textInsideSheetRectCount > 0, true);
  assert.equal(measuredState.visibleTextInsideSheetRectCount > 0, true);
  assert.equal(measuredState.textInsideContentRectCount > 0, true);
  assert.equal(measuredState.textBottomMarginIntersectionCount, 0);
  assert.equal(measuredState.visibleTextBottomMarginIntersectionCount, 0);
  assert.equal(measuredState.visibleTextBottomMarginIntersectionByDeviceToleranceCount, 0);
  assert.equal(measuredState.proseMirrorCount, 1);
  assert.equal(measuredState.tiptapEditorCount, 1);
  assert.equal(measuredState.prosePageTruthCount, 0);
  assert.equal(totalPageCount >= renderedPageCount, true);
  assert.equal(
    hasBoundedOverflow
      ? measuredState.centralSheetBoundedOverflowReason === 'max-page-count'
      : measuredState.centralSheetBoundedOverflowReason === null,
    true,
  );
  assert.equal(Number.parseFloat(measuredState.lineGuardPx) >= 24, true);
  assert.equal(
    String(measuredState.editorMaskImage || measuredState.editorWebkitMaskImage || '').includes('repeating-linear-gradient'),
    true,
  );
  assert.equal(Array.isArray(measuredState.transformScaleEvidence), true);
  assert.equal(measuredState.transformScaleEvidence.length >= 4, true);
  assert.equal(measuredState.primaryTextSurfaceScaleTransformCount, 0);
}
for (const inkState of Object.values(result.bottomMarginInk || {})) {
  assert.equal(inkState.sampledPixelCount > 0, true);
  assert.equal(inkState.inkPixelCount, 0);
  assert.equal(inkState.devicePixelRatio, FORCED_DEVICE_SCALE_FACTOR);
  assert.equal(inkState.bitmapWidthDeltaDevicePx <= DEVICE_PIXEL_TOLERANCE_PX, true);
  assert.equal(inkState.bitmapHeightDeltaDevicePx <= DEVICE_PIXEL_TOLERANCE_PX, true);
}
assert.equal(result.inputSmoke && result.inputSmoke.ok, true);
assert.equal(result.inputSmoke && result.inputSmoke.inserted, true);
assert.equal(result.inputSmoke && result.inputSmoke.undone, true);
assert.equal(result.inputSmoke && result.inputSmoke.redone, true);
assert.equal(result.networkRequests, 0);
assert.equal(result.dialogCalls, 0);
assert.equal(Array.isArray(result.screenshots), true);
assert.equal(result.screenshots.length, 3);

console.log('VERTICAL_SHEET_GAP_SMOKE_SUMMARY:' + JSON.stringify({
  ok: true,
  defaultGapAtHalfZoom,
  defaultGapAtFullZoom,
  liveGapMinPx: state.minGapPx,
  liveGapMaxPx: state.maxGapPx,
  liveGapHeights: state.gapHeights,
  pageGapCssPx: state.pageGapCssPx,
  flow: state.centralSheetFlow,
  visibleSheetCount: state.visibleSheetCount,
  textGapIntersectionCount: state.textGapIntersectionCount,
  visibleTextGapIntersectionCount: state.visibleTextGapIntersectionCount,
  textGapIntersectionByDeviceToleranceCount: state.textGapIntersectionByDeviceToleranceCount,
  visibleTextGapIntersectionByDeviceToleranceCount: state.visibleTextGapIntersectionByDeviceToleranceCount,
  textBottomMarginIntersectionCount: state.textBottomMarginIntersectionCount,
  visibleTextBottomMarginIntersectionCount: state.visibleTextBottomMarginIntersectionCount,
  visibleTextBottomMarginIntersectionByDeviceToleranceCount: state.visibleTextBottomMarginIntersectionByDeviceToleranceCount,
  visibleTextClipMaskLossCandidateCount: state.visibleTextClipMaskLossCandidateCount,
  visibleTextOutsideContentRectByDeviceToleranceCount: state.visibleTextOutsideContentRectByDeviceToleranceCount,
  deviceScaleEvidence: result.deviceScaleEvidence,
  transformScaleEvidence: state.transformScaleEvidence,
  bottomMarginInk: result.bottomMarginInk,
  lineGuardPx: state.lineGuardPx,
  proseMirrorCount: state.proseMirrorCount,
  inputSmoke: result.inputSmoke,
  scroll: result.scroll,
  screenshots: result.screenshots,
}));

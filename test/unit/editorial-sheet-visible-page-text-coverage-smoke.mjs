import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const rootDir = path.resolve(new URL('../..', import.meta.url).pathname);
const requireFromHere = createRequire(import.meta.url);
const electronBinary = requireFromHere('electron');
const targetPageCount = Number.parseInt(process.env.EDITORIAL_SHEET_TEXT_COVERAGE_TARGET_PAGE_COUNT || '2000', 10);
const viewportWidth = Number.parseInt(process.env.EDITORIAL_SHEET_TEXT_COVERAGE_VIEWPORT_WIDTH || '1920', 10);
const viewportHeight = Number.parseInt(process.env.EDITORIAL_SHEET_TEXT_COVERAGE_VIEWPORT_HEIGHT || '1110', 10);
const forcedEditorZoom = process.env.EDITORIAL_SHEET_TEXT_COVERAGE_ZOOM
  ? Number.parseFloat(process.env.EDITORIAL_SHEET_TEXT_COVERAGE_ZOOM)
  : 1;
assert.ok(
  [2000, 10000].includes(targetPageCount),
  'target page count must be 2000 or 10000',
);
assert.ok(Number.isInteger(viewportWidth) && viewportWidth >= 1000, 'viewport width must be at least 1000');
assert.ok(Number.isInteger(viewportHeight) && viewportHeight >= 800, 'viewport height must be at least 800');
assert.ok(Number.isFinite(forcedEditorZoom) && forcedEditorZoom >= 0.5 && forcedEditorZoom <= 2, 'zoom must be between 0.5 and 2');
const outputDir = process.env.EDITORIAL_SHEET_TEXT_COVERAGE_OUT_DIR
  ? path.resolve(process.env.EDITORIAL_SHEET_TEXT_COVERAGE_OUT_DIR)
  : await mkdtemp(path.join(os.tmpdir(), `editorial-sheet-${targetPageCount}-text-coverage-`));

function buildHelperSource() {
  return `
const path = require('node:path');
const fs = require('node:fs/promises');
const { app, BrowserWindow, dialog, session } = require('electron');

const rootDir = ${JSON.stringify(rootDir)};
const outputDir = ${JSON.stringify(outputDir)};
const targetPageCount = ${JSON.stringify(targetPageCount)};
const viewportWidth = ${JSON.stringify(viewportWidth)};
const viewportHeight = ${JSON.stringify(viewportHeight)};
const forcedEditorZoom = ${JSON.stringify(forcedEditorZoom)};
const mainEntrypoint = path.join(rootDir, 'src', 'main' + '.js');
let networkRequests = 0;
let dialogCalls = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildFixture() {
  const baseSentence = 'Longform stress smoke synthetic prose keeps the editor sheet busy while avoiding user manuscript data and avoiding product capability claims.';
  const secondarySentence = 'The generated text exists only to observe derived sheet windowing, marker navigation, bounded DOM, and hash stability.';
  const unitCount = Math.ceil(targetPageCount * 6);
  return Array.from({ length: unitCount }, (_, index) => (
    baseSentence + ' Unit ' + String(index + 1) + '. ' + secondarySentence
  )).join(' ');
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

async function setEditorPayload(win) {
  win.webContents.send('editor:set-text', {
    content: buildFixture(),
    title: 'editorial-sheet-visible-page-text-coverage-smoke',
    path: '',
    kind: 'chapter-file',
    metaEnabled: true,
    projectId: 'editorial-sheet-visible-page-text-coverage-smoke',
    bookProfile: null,
  });
}

async function forceEditorZoom(win) {
  return win.webContents.executeJavaScript(\`(() => {
    const target = \${JSON.stringify(forcedEditorZoom)};
    localStorage.setItem('editorZoom', String(target));
    const zoomOut = document.querySelector('[data-action="zoom-out"]');
    const zoomIn = document.querySelector('[data-action="zoom-in"]');
    const zoomValue = document.querySelector('[data-zoom-value]');
    const wantedText = String(Math.round(target * 100)) + '%';
    let guard = 0;
    while (zoomValue && zoomValue.textContent !== wantedText && guard < 50) {
      const current = Number.parseInt(String(zoomValue.textContent || '100').replace(/[^0-9]/g, ''), 10) || 100;
      const button = current > Math.round(target * 100) ? zoomOut : zoomIn;
      if (!(button instanceof HTMLElement)) break;
      button.click();
      guard += 1;
    }
    return {
      target,
      zoomText: zoomValue ? zoomValue.textContent : '',
      localStorageZoom: localStorage.getItem('editorZoom'),
      guard,
    };
  })()\`, true);
}

function countDarkPixels(image, canvasRect, frame) {
  const size = image.getSize();
  const bitmap = image.toBitmap();
  const sourceWidth = Math.max(1, Number(canvasRect?.width) || size.width);
  const sourceHeight = Math.max(1, Number(canvasRect?.height) || size.height);
  const scaleX = size.width / sourceWidth;
  const scaleY = size.height / sourceHeight;
  const viewportRect = {
    left: canvasRect.left,
    top: canvasRect.top,
    right: canvasRect.left + sourceWidth,
    bottom: canvasRect.top + sourceHeight,
  };
  const intersectRect = (a, b) => {
    if (!a || !b) return null;
    const left = Math.max(a.left, b.left);
    const right = Math.min(a.right, b.right);
    const top = Math.max(a.top, b.top);
    const bottom = Math.min(a.bottom, b.bottom);
    if (right <= left || bottom <= top) return null;
    return { left, top, right, bottom, width: right - left, height: bottom - top };
  };
  const scanDarkPixels = (rect) => {
    const clippedRect = intersectRect(rect, viewportRect);
    if (!clippedRect) {
      return { inkPixelCount: 0, sampledPixelCount: 0, rect: null };
    }
    const left = Math.max(0, Math.floor((clippedRect.left - canvasRect.left) * scaleX));
    const right = Math.min(size.width, Math.ceil((clippedRect.right - canvasRect.left) * scaleX));
    const top = Math.max(0, Math.floor((clippedRect.top - canvasRect.top) * scaleY));
    const bottom = Math.min(size.height, Math.ceil((clippedRect.bottom - canvasRect.top) * scaleY));
    let inkPixelCount = 0;
    let sampledPixelCount = 0;
    for (let y = top; y < bottom; y += 2) {
      for (let x = left; x < right; x += 2) {
        const offset = ((y * size.width) + x) * 4;
        const blue = bitmap[offset] || 0;
        const green = bitmap[offset + 1] || 0;
        const red = bitmap[offset + 2] || 0;
        const alpha = bitmap[offset + 3] || 0;
        const luminance = (0.2126 * red) + (0.7152 * green) + (0.0722 * blue);
        sampledPixelCount += 1;
        if (alpha > 0 && luminance < 170) {
          inkPixelCount += 1;
        }
      }
    }
    return {
      inkPixelCount,
      sampledPixelCount,
      rect: clippedRect,
    };
  };
  const pages = Array.isArray(frame?.visiblePageCoverage) ? frame.visiblePageCoverage : [];
  const pageInk = pages.map((page) => {
    const rect = page.visibleContentRect;
    if (!rect) {
      return { pageNumber: page.pageNumber, inkPixelCount: 0, sampledPixelCount: 0 };
    }
    const left = Math.max(0, Math.floor((rect.left - canvasRect.left) * scaleX));
    const right = Math.min(size.width, Math.ceil((rect.right - canvasRect.left) * scaleX));
    const top = Math.max(0, Math.floor((rect.top - canvasRect.top) * scaleY));
    const bottom = Math.min(size.height, Math.ceil((rect.bottom - canvasRect.top) * scaleY));
    let inkPixelCount = 0;
    let sampledPixelCount = 0;
    for (let y = top; y < bottom; y += 2) {
      for (let x = left; x < right; x += 2) {
        const offset = ((y * size.width) + x) * 4;
        const blue = bitmap[offset] || 0;
        const green = bitmap[offset + 1] || 0;
        const red = bitmap[offset + 2] || 0;
        const alpha = bitmap[offset + 3] || 0;
        const luminance = (0.2126 * red) + (0.7152 * green) + (0.0722 * blue);
        sampledPixelCount += 1;
        if (alpha > 0 && luminance < 170) {
          inkPixelCount += 1;
        }
      }
    }
    return {
      pageNumber: page.pageNumber,
      inkPixelCount,
      sampledPixelCount,
    };
  });
  const forbiddenMarginInkPages = pages
    .flatMap((page) => {
      if (!page?.pageRect || !page?.contentRect) {
        return [];
      }
      const horizontalInsetPx = 6;
      const verticalInsetPx = 4;
      const boundaryBandPx = Math.max(24, Math.min(96, Math.ceil(Number(frame.lineGuardPx) || 56) + 4));
      const left = page.contentRect.left + horizontalInsetPx;
      const right = page.contentRect.right - horizontalInsetPx;
      if (right <= left) {
        return [];
      }
      const topMargin = {
        left,
        right,
        top: Math.max(page.pageRect.top + verticalInsetPx, page.contentRect.top - boundaryBandPx),
        bottom: page.contentRect.top - verticalInsetPx,
      };
      const bottomMargin = {
        left,
        right,
        top: page.contentRect.bottom + verticalInsetPx,
        bottom: Math.min(page.pageRect.bottom - verticalInsetPx, page.contentRect.bottom + boundaryBandPx),
      };
      return [
        { pageNumber: page.pageNumber, zone: 'top', ...scanDarkPixels(topMargin) },
        { pageNumber: page.pageNumber, zone: 'bottom', ...scanDarkPixels(bottomMargin) },
      ];
    })
    .filter((item) => item.rect && item.inkPixelCount >= 12);
  const boundaryTextInkLeaks = pages
    .flatMap((page) => {
      if (!page?.pageRect || !page?.contentRect || !Array.isArray(page.contentBoundaryTextRects)) {
        return [];
      }
      return page.contentBoundaryTextRects.flatMap((textRect) => {
        const leaks = [];
        const horizontalRect = {
          left: Math.max(textRect.left, page.contentRect.left),
          right: Math.min(textRect.right, page.contentRect.right),
        };
        if (horizontalRect.right <= horizontalRect.left) {
          return leaks;
        }
        if (textRect.top < page.contentRect.top && textRect.bottom > page.contentRect.top) {
          leaks.push({
            pageNumber: page.pageNumber,
            zone: 'top',
            sourceRect: textRect,
            ...scanDarkPixels({
              left: horizontalRect.left,
              right: horizontalRect.right,
              top: Math.max(textRect.top, page.pageRect.top),
              bottom: Math.min(textRect.bottom, page.contentRect.top),
            }),
          });
        }
        if (textRect.top < page.contentRect.bottom && textRect.bottom > page.contentRect.bottom) {
          leaks.push({
            pageNumber: page.pageNumber,
            zone: 'bottom',
            sourceRect: textRect,
            ...scanDarkPixels({
              left: horizontalRect.left,
              right: horizontalRect.right,
              top: Math.max(textRect.top, page.contentRect.bottom),
              bottom: Math.min(textRect.bottom, page.pageRect.bottom),
            }),
          });
        }
        return leaks;
      });
    })
    .filter((item) => item.rect && item.inkPixelCount >= 3);
  const hasLaterInk = (index) => pageInk
    .slice(index + 1)
    .some((item) => item.inkPixelCount >= 12);
  const emptyPaintPages = pages
    .map((page, index) => ({ page, ink: pageInk[index], index }))
    .filter(({ page, ink, index }) => (
      page.visibleContentHeight >= frame.minimumSignificantContentHeight
      && page.pageNumber > 0
      && page.pageNumber < frame.centralSheetTotalPageCount
      && (ink?.inkPixelCount || 0) < 12
      && hasLaterInk(index)
    ))
    .map(({ page, ink }) => ({
      ...page,
      inkPixelCount: ink?.inkPixelCount || 0,
      sampledPixelCount: ink?.sampledPixelCount || 0,
    }));
  return {
    pageInk,
    emptyPaintPageCount: emptyPaintPages.length,
    emptyPaintPages,
    forbiddenMarginInkPageCount: forbiddenMarginInkPages.length,
    forbiddenMarginInkPages,
    boundaryTextInkLeakCount: boundaryTextInkLeaks.length,
    boundaryTextInkLeaks,
  };
}

async function captureFrameInk(win, frame, basename) {
  const canvasRect = frame.canvasRect || {
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    width: viewportWidth,
    height: viewportHeight,
  };
  const captureRect = {
    x: Math.max(0, Math.floor(canvasRect.left ?? canvasRect.x ?? 0)),
    y: Math.max(0, Math.floor(canvasRect.top ?? canvasRect.y ?? 0)),
    width: Math.max(1, Math.floor(canvasRect.width || viewportWidth)),
    height: Math.max(1, Math.floor(canvasRect.height || viewportHeight)),
  };
  const image = await win.capturePage(captureRect);
  await fs.writeFile(path.join(outputDir, basename), image.toPNG());
  return {
    ...frame,
    screenshotBasename: basename,
    ...countDarkPixels(image, {
      left: captureRect.x,
      top: captureRect.y,
      width: captureRect.width,
      height: captureRect.height,
    }, frame),
  };
}

function collectFrameSource(label, setupSource = '') {
  return \`(() => {
    try {
      \${setupSource}
      const toPlainRect = (rect) => rect ? ({
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      }) : null;
      const intersectRect = (a, b) => {
        if (!a || !b) return null;
        const left = Math.max(a.left, b.left);
        const right = Math.min(a.right, b.right);
        const top = Math.max(a.top, b.top);
        const bottom = Math.min(a.bottom, b.bottom);
        if (right <= left || bottom <= top) return null;
        return { left, top, right, bottom, width: right - left, height: bottom - top };
      };
      const intersects = (a, b) => Boolean(intersectRect(a, b));
      const readRootPx = (name, fallback = 0) => {
        const value = Number.parseFloat(window.getComputedStyle(document.documentElement).getPropertyValue(name));
        return Number.isFinite(value) ? value : fallback;
      };
      const host = document.querySelector('#editor.tiptap-host');
      const canvas = document.querySelector('.main-content--editor');
      const strip = host ? host.querySelector('.tiptap-sheet-strip') : null;
      const prose = host ? host.querySelector('.ProseMirror') : null;
      const overlayEditor = host ? host.querySelector(':scope > .tiptap-page-wrap .tiptap-editor') : null;
      const isLargePayloadFastPath = host
        ? host.dataset.centralSheetLargePayloadFastPathActive === 'true'
        : false;
      const pageWraps = strip ? [...strip.querySelectorAll(':scope > .tiptap-page-wrap')] : [];
      const canvasRect = canvas ? toPlainRect(canvas.getBoundingClientRect()) : null;
      const viewportRect = canvasRect || {
        left: 0,
        top: 0,
        right: window.innerWidth || document.documentElement.clientWidth || 0,
        bottom: window.innerHeight || document.documentElement.clientHeight || 0,
      };
      const marginTopPx = readRootPx('--page-margin-top-px');
      const marginRightPx = readRootPx('--page-margin-right-px');
      const marginBottomPx = readRootPx('--page-margin-bottom-px');
      const marginLeftPx = readRootPx('--page-margin-left-px');
      const readHostPx = (name, fallback = 0) => {
        if (!(host instanceof HTMLElement)) return fallback;
        const value = Number.parseFloat(window.getComputedStyle(host).getPropertyValue(name));
        return Number.isFinite(value) ? value : fallback;
      };
      const lineHeightPx = (() => {
        if (!(prose instanceof HTMLElement)) return 24;
        const styles = window.getComputedStyle(prose);
        const parsed = Number.parseFloat(styles.lineHeight);
        const fallback = Number.parseFloat(styles.fontSize) * 1.625;
        return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
      })();
      const overlayStyles = overlayEditor instanceof HTMLElement
        ? window.getComputedStyle(overlayEditor)
        : null;
      const proseBeforeStyles = prose instanceof HTMLElement
        ? window.getComputedStyle(prose, '::before')
        : null;
      const textRects = [];
      const visibleTextRoots = isLargePayloadFastPath && host
        ? [...host.querySelectorAll('.tiptap-sheet-derived-text')]
        : (prose ? [prose] : []);
      for (const textRoot of visibleTextRoots) {
        if (!(textRoot instanceof HTMLElement)) {
          continue;
        }
        const walker = document.createTreeWalker(textRoot, NodeFilter.SHOW_TEXT, {
            acceptNode(node) {
              return node.textContent && node.textContent.trim()
                ? NodeFilter.FILTER_ACCEPT
                : NodeFilter.FILTER_SKIP;
            },
          });
          let current = walker.nextNode();
          while (current) {
            const range = document.createRange();
            range.selectNodeContents(current);
            for (const rect of Array.from(range.getClientRects())) {
              const textRect = toPlainRect(rect);
              if (textRect && intersects(textRect, viewportRect)) {
                textRects.push(textRect);
              }
            }
            current = walker.nextNode();
          }
      }
      const totalPageCount = Number(host ? host.dataset.centralSheetTotalPageCount || 0 : 0);
      const zoomValue = document.querySelector('[data-zoom-value]');
      const visiblePageCoverage = pageWraps
        .map((element) => {
          const pageRect = toPlainRect(element.getBoundingClientRect());
          const pageNumber = Number(element.dataset.pageNumber || 0);
          const contentRect = pageRect ? {
            left: pageRect.left + marginLeftPx,
            right: pageRect.right - marginRightPx,
            top: pageRect.top + marginTopPx,
            bottom: pageRect.bottom - marginBottomPx,
          } : null;
          if (contentRect) {
            contentRect.width = Math.max(0, contentRect.right - contentRect.left);
            contentRect.height = Math.max(0, contentRect.bottom - contentRect.top);
          }
          const visibleContentRect = intersectRect(contentRect, viewportRect);
          const visiblePageRect = intersectRect(pageRect, viewportRect);
          const intersectingTextRects = visibleContentRect
            ? textRects.filter((textRect) => intersects(textRect, visibleContentRect))
            : [];
          const boundaryClipTolerancePx = 1;
          const contentBoundaryTextRects = contentRect
            ? intersectingTextRects.filter((textRect) => {
              const crossesTop = textRect.top < contentRect.top - boundaryClipTolerancePx
                && textRect.bottom > contentRect.top + boundaryClipTolerancePx;
              const crossesBottom = textRect.top < contentRect.bottom - boundaryClipTolerancePx
                && textRect.bottom > contentRect.bottom + boundaryClipTolerancePx;
              return crossesTop || crossesBottom;
            })
            : [];
          const textTop = intersectingTextRects.length
            ? Math.min(...intersectingTextRects.map((rect) => rect.top))
            : null;
          const textBottom = intersectingTextRects.length
            ? Math.max(...intersectingTextRects.map((rect) => rect.bottom))
            : null;
          return {
            pageNumber,
            pageRect,
            contentRect,
            visiblePageRect,
            visibleContentRect,
            topBoundaryElementStack: contentRect
              ? document.elementsFromPoint(contentRect.left + 12, contentRect.top - 12).slice(0, 6).map((element) => ({
                tag: element.tagName,
                className: element.className,
                id: element.id,
              }))
              : [],
            visibleContentHeight: visibleContentRect ? visibleContentRect.height : 0,
            visibleTextRectCount: intersectingTextRects.length,
            contentBoundaryTextRectCount: contentBoundaryTextRects.length,
            contentBoundaryTextRects,
            contentBoundaryTextRectSamples: contentBoundaryTextRects.slice(0, 4),
            textTop,
            textBottom,
          };
        })
        .filter((item) => item.visibleContentHeight > 0);
      const minimumSignificantContentHeight = Math.max(96, Math.ceil(lineHeightPx * 3));
      const hasLaterVisibleText = (index) => visiblePageCoverage
        .slice(index + 1)
        .some((item) => item.visibleTextRectCount > 0);
      const emptySignificantPages = visiblePageCoverage.filter((item, index) => (
        item.visibleContentHeight >= minimumSignificantContentHeight
        && item.pageNumber > 0
        && item.pageNumber < totalPageCount
        && item.visibleTextRectCount === 0
        && hasLaterVisibleText(index)
      ));
      const contentBoundaryPages = visiblePageCoverage.filter((item) => item.contentBoundaryTextRectCount > 0);
      return {
        label: \${JSON.stringify(label)},
        proofClass: Boolean(host && host.classList.contains('tiptap-host--central-sheet-strip-proof')),
        centralSheetFlow: host ? host.dataset.centralSheetFlow || null : null,
        centralSheetRenderedPageCount: Number(host ? host.dataset.centralSheetRenderedPageCount || 0 : 0),
        centralSheetTotalPageCount: totalPageCount,
        centralSheetWindowingEnabled: host ? host.dataset.centralSheetWindowingEnabled || null : null,
        centralSheetLargePayloadFastPathActive: isLargePayloadFastPath ? 'true' : 'false',
        zoomText: zoomValue ? zoomValue.textContent || '' : '',
        localStorageZoom: localStorage.getItem('editorZoom'),
        devicePixelRatio: window.devicePixelRatio || 1,
        canvasRect: canvasRect ? { ...canvasRect, x: canvasRect.left, y: canvasRect.top } : null,
        overlayEditorRect: overlayEditor instanceof HTMLElement ? toPlainRect(overlayEditor.getBoundingClientRect()) : null,
        proseMirrorCount: host ? host.querySelectorAll('.ProseMirror').length : 0,
        tiptapEditorCount: host ? host.querySelectorAll('.tiptap-editor').length : 0,
        prosePageTruthCount: prose ? prose.querySelectorAll('[data-page-index], [data-page-number], [data-page-id]').length : 0,
        scrollTop: canvas instanceof HTMLElement ? canvas.scrollTop : 0,
        scrollHeight: canvas instanceof HTMLElement ? canvas.scrollHeight : 0,
        clientHeight: canvas instanceof HTMLElement ? canvas.clientHeight : 0,
        pageStridePx: readHostPx('--central-sheet-page-stride-px'),
        lineGuardPx: readHostPx('--central-sheet-line-guard-px'),
        lineTopGuardPx: readHostPx('--central-sheet-line-top-guard-px'),
        lineHeightPx,
        overlayMaskImage: overlayStyles ? overlayStyles.getPropertyValue('-webkit-mask-image') || overlayStyles.maskImage : '',
        overlayMaskSize: overlayStyles ? overlayStyles.getPropertyValue('-webkit-mask-size') || overlayStyles.maskSize : '',
        proseBeforeShapeOutside: proseBeforeStyles ? proseBeforeStyles.shapeOutside : '',
        minimumSignificantContentHeight,
        viewportTextRectCount: textRects.length,
        visiblePageCoverage,
        emptySignificantPageCount: emptySignificantPages.length,
        emptySignificantPages,
        contentBoundaryPageCount: contentBoundaryPages.length,
        contentBoundaryPages,
      };
    } catch (error) {
      return {
        label: \${JSON.stringify(label)},
        collectError: error && error.stack ? error.stack : String(error),
      };
    }
  })()\`;
}

async function collectFrame(win, label, setupSource = '') {
  const state = await win.webContents.executeJavaScript(collectFrameSource(label, setupSource), true);
  if (state && state.collectError) {
    throw new Error('COLLECT_FRAME_FAILED_' + label + '_' + state.collectError);
  }
  return state;
}

async function waitForStableFixture(win) {
  let lastState = null;
  for (let attempt = 0; attempt < 90; attempt += 1) {
    await sleep(400);
    const state = await collectFrame(win, 'stable-' + String(attempt + 1));
    lastState = state;
    if (
      state.proofClass === true
      && state.centralSheetFlow === 'vertical'
      && state.centralSheetWindowingEnabled === 'true'
      && state.centralSheetTotalPageCount >= targetPageCount
      && state.centralSheetLargePayloadFastPathActive === 'true'
      && state.centralSheetRenderedPageCount >= 2
      && state.centralSheetRenderedPageCount <= 15
      && state.viewportTextRectCount > 0
      && state.proseMirrorCount === 1
      && state.tiptapEditorCount === 1
      && state.prosePageTruthCount === 0
    ) {
      return state;
    }
  }
  throw new Error('VISIBLE_PAGE_TEXT_COVERAGE_FIXTURE_NOT_STABLE ' + JSON.stringify(lastState));
}

function scrollToBoundarySource(boundaryPageOffset) {
  return \`
    {
      const setupHost = document.querySelector('#editor.tiptap-host');
      const setupCanvas = document.querySelector('.main-content--editor');
      if (!(setupHost instanceof HTMLElement) || !(setupCanvas instanceof HTMLElement)) {
        throw new Error('TEXT_COVERAGE_SCROLL_TARGET_MISSING');
      }
      const setupStyles = window.getComputedStyle(setupHost);
      const setupStride = Number.parseFloat(setupStyles.getPropertyValue('--central-sheet-page-stride-px')) || 1;
      const target = Math.max(0, Math.round((setupStride * \${JSON.stringify(boundaryPageOffset)}) - (setupCanvas.clientHeight * 0.45)));
      setupCanvas.scrollTop = target;
      setupCanvas.dispatchEvent(new Event('scroll', { bubbles: true }));
    }
  \`;
}

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('force-device-scale-factor', '1');
app.commandLine.appendSwitch('high-dpi-support', '1');
app.setPath('appData', path.join(outputDir, 'app-data'));
app.setPath('userData', path.join(outputDir, 'app-data', 'craftsman'));
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
    win.setContentSize(viewportWidth, viewportHeight);
    await sleep(1200);
    const zoomState = await forceEditorZoom(win);
    await sleep(350);
    await setEditorPayload(win);
    const stable = await waitForStableFixture(win);
    const boundaryFrames = [];
    const scrollOffsets = [
      1,
      2,
      3,
      4,
      5,
      Math.max(6, Math.floor(stable.centralSheetTotalPageCount * 0.25)),
      Math.max(7, Math.floor(stable.centralSheetTotalPageCount * 0.5)),
      Math.max(8, Math.floor(stable.centralSheetTotalPageCount * 0.75)),
    ].filter((value, index, array) => value > 0 && array.indexOf(value) === index);
    for (const offset of scrollOffsets) {
      const immediateBase = await collectFrame(win, 'boundary-' + String(offset) + '-immediate', scrollToBoundarySource(offset));
      const immediate = await captureFrameInk(win, immediateBase, 'visible-page-text-coverage-boundary-' + String(offset) + '-immediate.png');
      await sleep(120);
      const settledBase = await collectFrame(win, 'boundary-' + String(offset) + '-settled');
      const settled = await captureFrameInk(win, settledBase, 'visible-page-text-coverage-boundary-' + String(offset) + '-settled.png');
      boundaryFrames.push({ offset, immediate, settled });
    }
    const payload = {
      ok: true,
      zoomState,
      stable,
      boundaryFrames,
      networkRequests,
      dialogCalls,
      screenshots: boundaryFrames.flatMap((item) => [
        path.join(outputDir, item.immediate.screenshotBasename),
        path.join(outputDir, item.settled.screenshotBasename),
      ]),
    };
    await fs.writeFile(path.join(outputDir, 'result.json'), JSON.stringify(payload, null, 2));
    process.stdout.write('EDITORIAL_SHEET_VISIBLE_PAGE_TEXT_COVERAGE_RESULT:' + JSON.stringify(payload) + '\\n');
    app.exit(0);
  } catch (error) {
    const payload = { ok: false, error: error && error.stack ? error.stack : String(error), networkRequests, dialogCalls };
    await fs.writeFile(path.join(outputDir, 'result.json'), JSON.stringify(payload, null, 2));
    process.stdout.write('EDITORIAL_SHEET_VISIBLE_PAGE_TEXT_COVERAGE_RESULT:' + JSON.stringify(payload) + '\\n');
    app.exit(1);
  }
});
`;
}

await mkdir(outputDir, { recursive: true });
const helperPath = path.join(outputDir, 'editorial-sheet-visible-page-text-coverage-helper.cjs');
await writeFile(helperPath, buildHelperSource(), 'utf8');

const child = spawn(electronBinary, [helperPath], {
  cwd: rootDir,
  stdio: ['ignore', 'pipe', 'pipe'],
  env: {
    ...process.env,
    ELECTRON_ENABLE_LOGGING: '0',
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
  }, 120000);
  child.on('exit', (code) => {
    clearTimeout(timer);
    resolve(typeof code === 'number' ? code : 1);
  });
});

const result = JSON.parse(await readFile(path.join(outputDir, 'result.json'), 'utf8'));
assert.equal(exitCode, 0, `electron helper failed with ${exitCode}\n${stdout}\n${stderr}`);
assert.equal(result.ok, true);
assert.equal(result.networkRequests, 0);
assert.equal(result.dialogCalls, 0);
assert.equal(result.stable.proofClass, true);
assert.equal(result.stable.centralSheetFlow, 'vertical');
assert.equal(result.stable.centralSheetWindowingEnabled, 'true');
assert.equal(result.stable.centralSheetLargePayloadFastPathActive, 'true');
assert.equal(result.stable.centralSheetTotalPageCount >= targetPageCount, true);
assert.equal(result.zoomState.zoomText, `${Math.round(forcedEditorZoom * 100)}%`);
assert.equal(result.stable.zoomText, `${Math.round(forcedEditorZoom * 100)}%`);
assert.equal(result.stable.proseMirrorCount, 1);
assert.equal(result.stable.tiptapEditorCount, 1);
assert.equal(result.stable.prosePageTruthCount, 0);

for (const framePair of result.boundaryFrames) {
  for (const frame of [framePair.immediate, framePair.settled]) {
    assert.equal(frame.proofClass, true, `${frame.label} must keep central sheet proof mode`);
    assert.equal(frame.centralSheetFlow, 'vertical', `${frame.label} must keep vertical flow`);
    assert.equal(frame.centralSheetWindowingEnabled, 'true', `${frame.label} must keep runtime windowing`);
    assert.equal(frame.proseMirrorCount, 1, `${frame.label} must keep one ProseMirror`);
    assert.equal(frame.tiptapEditorCount, 1, `${frame.label} must keep one Tiptap editor`);
    assert.equal(frame.prosePageTruthCount, 0, `${frame.label} must not create page truth`);
    assert.equal(frame.viewportTextRectCount > 0, true, `${frame.label} must observe visible text`);
    assert.equal(
      frame.emptyPaintPageCount,
      0,
      `${frame.label} must not paint a significant visible non-final page as blank while later visible pages contain text: ${JSON.stringify(frame.emptyPaintPages)}`,
    );
    assert.equal(
      frame.emptySignificantPageCount,
      0,
      `${frame.label} must not expose a significant visible non-final page with zero text coverage: ${JSON.stringify(frame.emptySignificantPages)}`,
    );
  }
}

console.log('EDITORIAL_SHEET_VISIBLE_PAGE_TEXT_COVERAGE_SUMMARY:' + JSON.stringify({
  ok: true,
  outputDir,
  totalPageCount: result.stable.centralSheetTotalPageCount,
  targetPageCount,
  boundaryFrameCount: result.boundaryFrames.length,
  maxEmptySignificantPageCount: Math.max(
    ...result.boundaryFrames.flatMap((item) => [
      item.immediate.emptySignificantPageCount,
      item.settled.emptySignificantPageCount,
    ]),
  ),
  maxEmptyPaintPageCount: Math.max(
    ...result.boundaryFrames.flatMap((item) => [
      item.immediate.emptyPaintPageCount,
      item.settled.emptyPaintPageCount,
    ]),
  ),
  maxContentBoundaryPageCount: Math.max(
    ...result.boundaryFrames.flatMap((item) => [
      item.immediate.contentBoundaryPageCount,
      item.settled.contentBoundaryPageCount,
    ]),
  ),
  maxForbiddenMarginInkPageCount: Math.max(
    ...result.boundaryFrames.flatMap((item) => [
      item.immediate.forbiddenMarginInkPageCount,
      item.settled.forbiddenMarginInkPageCount,
    ]),
  ),
  maxBoundaryTextInkLeakCount: Math.max(
    ...result.boundaryFrames.flatMap((item) => [
      item.immediate.boundaryTextInkLeakCount,
      item.settled.boundaryTextInkLeakCount,
    ]),
  ),
  screenshots: result.screenshots.map((item) => path.basename(item)),
}));

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const rootDir = path.resolve(new URL('../..', import.meta.url).pathname);
const requireFromHere = createRequire(import.meta.url);
const electronBinary = requireFromHere('electron');
const outputDir = process.env.EDITORIAL_SHEET_ZOOM50_BOUNDARY_OUT_DIR
  ? path.resolve(process.env.EDITORIAL_SHEET_ZOOM50_BOUNDARY_OUT_DIR)
  : await mkdtemp(path.join(os.tmpdir(), 'editorial-sheet-zoom50-boundary-'));

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

function buildFixture() {
  const sentence = 'Zoom fifty boundary fixture keeps text visually clipped inside derived sheet shells.';
  const second = 'Viewport is not truth and storage export are out of scope.';
  return Array.from({ length: 15 }, (_, index) => (
    sentence + ' Unit ' + String(index + 1) + '. ' + second
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

async function forceZoom50(win) {
  return win.webContents.executeJavaScript(\`(() => {
    localStorage.setItem('editorZoom', '0.5');
    const zoomOut = document.querySelector('[data-action="zoom-out"]');
    const zoomValue = document.querySelector('[data-zoom-value]');
    let guard = 0;
    while (zoomOut instanceof HTMLElement && zoomValue && zoomValue.textContent !== '50%' && guard < 20) {
      zoomOut.click();
      guard += 1;
    }
    return {
      zoomText: zoomValue ? zoomValue.textContent : '',
      localStorageZoom: localStorage.getItem('editorZoom'),
    };
  })()\`, true);
}

async function setEditorPayload(win) {
  win.webContents.send('editor:set-text', {
    content: buildFixture(),
    title: 'editorial-sheet-zoom50-boundary-leak-smoke',
    path: '',
    kind: 'chapter-file',
    metaEnabled: true,
    projectId: 'editorial-sheet-zoom50-boundary-leak-smoke',
    bookProfile: null,
  });
}

async function collectFrame(win, label, setupSource = '') {
  const source = \`(() => {
    try {
    {
      \${setupSource}
    }
    const rectOf = (element) => {
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return {
        x: rect.x,
        y: rect.y,
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      };
    };
    const intersects = (a, b) => Boolean(
      a && b
        && a.left < b.right
        && a.right > b.left
        && a.top < b.bottom
        && a.bottom > b.top
    );
    const contained = (inner, outer) => Boolean(
      inner && outer
        && inner.left >= outer.left - 2
        && inner.right <= outer.right + 2
        && inner.top >= outer.top - 2
        && inner.bottom <= outer.bottom + 2
    );
    const host = document.querySelector('#editor.tiptap-host');
    const canvas = document.querySelector('.main-content--editor');
    const strip = host ? host.querySelector('.tiptap-sheet-strip') : null;
    const prose = host ? host.querySelector('.ProseMirror') : null;
    const overlayEditor = host ? host.querySelector(':scope > .tiptap-page-wrap .tiptap-editor') : null;
    const zoomValue = document.querySelector('[data-zoom-value]');
    const pageWraps = strip ? [...strip.querySelectorAll(':scope > .tiptap-page-wrap')] : [];
    const pageRects = pageWraps.map((element) => rectOf(element)).filter(Boolean);
    const canvasRect = rectOf(canvas) || {
      left: 0,
      top: 0,
      right: window.innerWidth || 0,
      bottom: window.innerHeight || 0,
      width: window.innerWidth || 0,
      height: window.innerHeight || 0,
      x: 0,
      y: 0,
    };
    const visibleSheetRects = pageRects.filter((rect) => intersects(rect, canvasRect));
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
        for (const rect of Array.from(range.getClientRects())) {
          const textRect = {
            x: rect.x,
            y: rect.y,
            left: rect.left,
            right: rect.right,
            top: rect.top,
            bottom: rect.bottom,
            width: rect.width,
            height: rect.height,
          };
          if (intersects(textRect, canvasRect)) textRects.push(textRect);
        }
        current = walker.nextNode();
      }
    }
    const rawOutside = textRects.filter((textRect) => (
      !visibleSheetRects.some((sheetRect) => intersects(textRect, sheetRect))
    ));
    const materialOutside = textRects.filter((textRect) => (
      !visibleSheetRects.some((sheetRect) => contained(textRect, sheetRect))
    ));
    const requestedLabel = \${JSON.stringify(label)};
    const firstRenderedPage = Number(host ? host.dataset.centralSheetWindowFirstRenderedPage || 0 : 0);
    const lastRenderedPage = Number(host ? host.dataset.centralSheetWindowLastRenderedPage || 0 : 0);
    const totalPageCount = Number(host ? host.dataset.centralSheetTotalPageCount || host.dataset.centralSheetCount || 0 : 0);
    const pageStridePx = Number.parseFloat(getComputedStyle(host || document.documentElement).getPropertyValue('--central-sheet-page-stride-px')) || 1;
    const scrollTop = canvas instanceof HTMLElement ? canvas.scrollTop : 0;
    const expectedPage = Math.max(1, Math.min(Math.max(1, totalPageCount), Math.floor(scrollTop / Math.max(1, pageStridePx)) + 1));
    return {
      label: ${JSON.stringify('zoom50-boundary-frame')},
      requestedLabel,
      zoomText: zoomValue ? zoomValue.textContent : '',
      localStorageZoom: localStorage.getItem('editorZoom'),
      proofClass: Boolean(host && host.classList.contains('tiptap-host--central-sheet-strip-proof')),
      flow: host ? host.dataset.centralSheetFlow || '' : '',
      windowing: host ? host.dataset.centralSheetWindowingEnabled || '' : '',
      firstRenderedPage,
      lastRenderedPage,
      totalPageCount,
      renderedShellCount: pageWraps.length,
      visibleSheetCount: visibleSheetRects.length,
      visibleTextRectCount: textRects.length,
      materialOutsideCount: materialOutside.length,
      rawOutsideCount: rawOutside.length,
      scrollTop,
      scrollHeight: canvas instanceof HTMLElement ? canvas.scrollHeight : 0,
      clientHeight: canvas instanceof HTMLElement ? canvas.clientHeight : 0,
      expectedPage,
      staleWindowPages: firstRenderedPage <= expectedPage && lastRenderedPage >= expectedPage ? 0 : 1,
      pageNumbers: pageWraps.map((element) => Number(element.dataset.pageNumber || 0)),
      canvasRect,
      editorRect: rectOf(overlayEditor),
      pageRectSamples: pageRects.slice(0, 4),
      rawOutsideSamples: rawOutside.slice(0, 4),
      materialOutsideSamples: materialOutside.slice(0, 4),
      overlayEditorOverflow: overlayEditor ? getComputedStyle(overlayEditor).overflow : '',
      proseMirrorCount: host ? host.querySelectorAll('.ProseMirror').length : 0,
      tiptapEditorCount: host ? host.querySelectorAll('.tiptap-editor').length : 0,
      derivedSheetEditorCount: pageWraps.reduce((sum, element) => sum + element.querySelectorAll('.tiptap-editor').length, 0),
      prosePageTruthCount: prose ? prose.querySelectorAll('[data-page-index], [data-page-number], [data-page-id]').length : 0,
    };
    } catch (error) {
      return {
        collectError: error && error.stack ? error.stack : String(error),
      };
    }
  })()\`;
  let frame;
  try {
    frame = await win.webContents.executeJavaScript(source, true);
  } catch (error) {
    await fs.writeFile(path.join(outputDir, 'zoom50-boundary-last-source.js'), source, 'utf8');
    throw error;
  }
  if (frame && frame.collectError) {
    throw new Error('ZOOM50_BOUNDARY_COLLECT_FAILED_' + frame.collectError);
  }
  return frame;
}

async function waitForStable(win) {
  let last = null;
  for (let attempt = 0; attempt < 120; attempt += 1) {
    await sleep(125);
    last = await collectFrame(win, 'stable');
    if (
      last.zoomText === '50%'
      && last.proofClass === true
      && last.flow === 'vertical'
      && last.windowing === 'true'
      && last.totalPageCount >= 3
      && last.renderedShellCount >= 2
      && last.visibleSheetCount > 0
      && last.visibleTextRectCount > 0
      && last.proseMirrorCount === 1
      && last.tiptapEditorCount === 1
    ) {
      return last;
    }
  }
  throw new Error('ZOOM50_BOUNDARY_NOT_STABLE_' + JSON.stringify(last));
}

function countDarkPixels(image, canvasRect, samples) {
  const size = image.getSize();
  const bitmap = image.toBitmap();
  const rects = Array.isArray(samples) ? samples : [];
  let darkPixels = 0;
  for (const sample of rects) {
    const left = Math.max(0, Math.floor(sample.left - canvasRect.left));
    const right = Math.min(size.width, Math.ceil(sample.right - canvasRect.left));
    const top = Math.max(0, Math.floor(sample.top - canvasRect.top));
    const bottom = Math.min(size.height, Math.ceil(sample.bottom - canvasRect.top));
    for (let y = top; y < bottom; y += 1) {
      for (let x = left; x < right; x += 1) {
        const offset = ((y * size.width) + x) * 4;
        const blue = bitmap[offset] || 0;
        const green = bitmap[offset + 1] || 0;
        const red = bitmap[offset + 2] || 0;
        const alpha = bitmap[offset + 3] || 0;
        const luminance = (0.2126 * red) + (0.7152 * green) + (0.0722 * blue);
        if (alpha > 0 && luminance < 150) darkPixels += 1;
      }
    }
  }
  return darkPixels;
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
      if (/^(https?|wss?):/u.test(String(details.url || ''))) networkRequests += 1;
      callback({ cancel: false });
    });
    await fs.mkdir(outputDir, { recursive: true });
    const win = await waitForWindow();
    await waitForLoad(win);
    win.setContentSize(1920, 1040);
    await sleep(800);
    await forceZoom50(win);
    await sleep(250);
    await setEditorPayload(win);
    await waitForStable(win);
    const frame = await collectFrame(win, 'jump-page-10-immediate', \`
      const canvas = document.querySelector('.main-content--editor');
      const host = document.querySelector('#editor.tiptap-host');
      if (!(canvas instanceof HTMLElement) || !(host instanceof HTMLElement)) {
        throw new Error('ZOOM50_BOUNDARY_TARGET_MISSING');
      }
      const stride = Number.parseFloat(getComputedStyle(host).getPropertyValue('--central-sheet-page-stride-px')) || 1;
      canvas.scrollTop = Math.max(0, Math.round((stride * 9) + 12));
      canvas.dispatchEvent(new Event('scroll', { bubbles: true }));
    \`);
    const captureRect = {
      x: Math.max(0, Math.floor(frame.canvasRect.x)),
      y: Math.max(0, Math.floor(frame.canvasRect.y)),
      width: Math.max(1, Math.floor(frame.canvasRect.width)),
      height: Math.max(1, Math.floor(frame.canvasRect.height)),
    };
    const image = await win.capturePage(captureRect);
    const screenshotBasename = 'zoom50-boundary-frame.png';
    await fs.writeFile(path.join(outputDir, screenshotBasename), image.toPNG());
    const rawOutsideDarkPixels = countDarkPixels(image, frame.canvasRect, frame.rawOutsideSamples);
    const materialOutsideDarkPixels = countDarkPixels(image, frame.canvasRect, frame.materialOutsideSamples);
    const payload = {
      ok: true,
      outputDir,
      frame,
      rawOutsideDarkPixels,
      materialOutsideDarkPixels,
      networkRequests,
      dialogCalls,
      screenshotBasename,
    };
    await fs.writeFile(path.join(outputDir, 'zoom50-boundary-result.json'), JSON.stringify(payload, null, 2));
    process.stdout.write('EDITORIAL_SHEET_ZOOM50_BOUNDARY_SUMMARY:' + JSON.stringify({
      ok: true,
      outputDir,
      totalPageCount: frame.totalPageCount,
      expectedPage: frame.expectedPage,
      firstRenderedPage: frame.firstRenderedPage,
      lastRenderedPage: frame.lastRenderedPage,
      materialOutsideCount: frame.materialOutsideCount,
      rawOutsideCount: frame.rawOutsideCount,
      rawOutsideDarkPixels,
      materialOutsideDarkPixels,
      overlayEditorOverflow: frame.overlayEditorOverflow,
      networkRequests,
      dialogCalls,
    }) + '\\n');
    app.exit(0);
  } catch (error) {
    const payload = {
      ok: false,
      outputDir,
      error: error && error.stack ? error.stack : String(error),
      networkRequests,
      dialogCalls,
    };
    await fs.writeFile(path.join(outputDir, 'zoom50-boundary-result.json'), JSON.stringify(payload, null, 2));
    process.stdout.write('EDITORIAL_SHEET_ZOOM50_BOUNDARY_SUMMARY:' + JSON.stringify(payload) + '\\n');
    app.exit(1);
  }
});
`;
}

await mkdir(outputDir, { recursive: true });
const helperPath = path.join(outputDir, 'zoom50-boundary-helper.cjs');
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
const exitCode = await new Promise((resolve) => child.on('close', resolve));
await writeFile(path.join(outputDir, 'stdout.txt'), stdout, 'utf8');
await writeFile(path.join(outputDir, 'stderr.txt'), stderr, 'utf8');
const result = JSON.parse(await readFile(path.join(outputDir, 'zoom50-boundary-result.json'), 'utf8'));
if (exitCode !== 0 || result.ok !== true) {
  console.error(JSON.stringify({ exitCode, result, stderr }, null, 2));
  process.exit(1);
}

const { frame } = result;
assert.equal(frame.zoomText, '50%', 'zoom label must be 50 percent');
assert.equal(frame.localStorageZoom, '0.5', 'stored zoom must be 0.5');
assert.equal(frame.proofClass, true, 'central sheet proof class must be active');
assert.equal(frame.flow, 'vertical', 'central sheet flow must be vertical');
assert.equal(frame.windowing, 'true', 'central sheet windowing must remain active');
assert.equal(frame.staleWindowPages, 0, 'expected page must remain inside rendered window');
assert.ok(frame.pageNumbers.includes(frame.expectedPage), 'rendered window must contain expected page');
assert.equal(frame.proseMirrorCount, 1, 'must keep one ProseMirror');
assert.equal(frame.tiptapEditorCount, 1, 'must keep one TipTap editor');
assert.equal(frame.derivedSheetEditorCount, 0, 'derived sheet shells must not contain editor instances');
assert.equal(frame.prosePageTruthCount, 0, 'ProseMirror must not contain page truth markers');
assert.equal(frame.overlayEditorOverflow, 'hidden', 'central sheet overlay editor must clip visual overflow');
assert.equal(result.rawOutsideDarkPixels, 0, 'raw outside text rects must not paint visible dark text');
assert.equal(result.materialOutsideDarkPixels, 0, 'material outside text rects must not paint visible dark text');
assert.equal(result.networkRequests, 0, 'zoom50 boundary smoke must not perform network requests');
assert.equal(result.dialogCalls, 0, 'zoom50 boundary smoke must not open dialogs');

process.stdout.write(`EDITORIAL_SHEET_ZOOM50_BOUNDARY_SUMMARY:${JSON.stringify({
  ok: true,
  outputDir,
  totalPageCount: frame.totalPageCount,
  expectedPage: frame.expectedPage,
  firstRenderedPage: frame.firstRenderedPage,
  lastRenderedPage: frame.lastRenderedPage,
  materialOutsideCount: frame.materialOutsideCount,
  rawOutsideCount: frame.rawOutsideCount,
  rawOutsideDarkPixels: result.rawOutsideDarkPixels,
  materialOutsideDarkPixels: result.materialOutsideDarkPixels,
  overlayEditorOverflow: frame.overlayEditorOverflow,
  networkRequests: result.networkRequests,
  dialogCalls: result.dialogCalls,
})}\n`);

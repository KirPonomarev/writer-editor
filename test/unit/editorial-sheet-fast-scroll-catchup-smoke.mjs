import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const rootDir = path.resolve(new URL('../..', import.meta.url).pathname);
const requireFromHere = createRequire(import.meta.url);
const electronBinary = requireFromHere('electron');
const outputDir = process.env.EDITORIAL_SHEET_FAST_SCROLL_OUT_DIR
  ? path.resolve(process.env.EDITORIAL_SHEET_FAST_SCROLL_OUT_DIR)
  : await mkdtemp(path.join(os.tmpdir(), 'editorial-sheet-fast-scroll-catchup-'));

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
  const sentence = 'Editorial sheet fast scroll catchup fixture keeps visible text aligned with derived sheet shells during early document jumps.';
  const second = 'The text is synthetic and exists only to exercise runtime scroll windowing without storage or export claims.';
  return Array.from({ length: 1900 }, (_, index) => (
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

async function setEditorPayload(win) {
  win.webContents.send('editor:set-text', {
    content: buildFixture(),
    title: 'editorial-sheet-fast-scroll-catchup-smoke',
    path: '',
    kind: 'chapter-file',
    metaEnabled: true,
    projectId: 'editorial-sheet-fast-scroll-catchup-smoke',
    bookProfile: null,
  });
}

function collectFrameSource(label, setupSource = '') {
  return \`(() => {
    try {
      \${setupSource}
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
      const rectsIntersect = (a, b) => Boolean(
      a && b
        && a.left < b.right
        && a.right > b.left
        && a.top < b.bottom
        && a.bottom > b.top
      );
      const cssPx = (element, name, fallback) => {
      if (!(element instanceof HTMLElement)) return fallback;
      const value = Number.parseFloat(window.getComputedStyle(element).getPropertyValue(name));
      return Number.isFinite(value) ? value : fallback;
      };
      const edgeTolerancePx = 2;
      const lineEdgeTolerancePx = Math.max(8, Math.min(
      48,
      cssPx(document.documentElement, '--page-gap-px', 24) + edgeTolerancePx,
      ));
      const rectContainedBySheet = (textRect, sheetRect) => Boolean(
      textRect && sheetRect
        && textRect.left >= sheetRect.left - edgeTolerancePx
        && textRect.right <= sheetRect.right + edgeTolerancePx
        && textRect.top >= sheetRect.top - edgeTolerancePx
        && textRect.bottom <= sheetRect.bottom + edgeTolerancePx
      );
      const rectHorizontallyContainedBySheet = (textRect, sheetRect) => Boolean(
      textRect && sheetRect
        && textRect.left >= sheetRect.left - edgeTolerancePx
        && textRect.right <= sheetRect.right + edgeTolerancePx
      );
      const rectIsLineEdgeArtifact = (textRect, sheetRect) => {
      if (!rectHorizontallyContainedBySheet(textRect, sheetRect)) return false;
      const belowSheetBottom = textRect.top >= sheetRect.bottom - edgeTolerancePx
        && textRect.top <= sheetRect.bottom + lineEdgeTolerancePx;
      const aboveSheetTop = textRect.bottom <= sheetRect.top + edgeTolerancePx
        && textRect.bottom >= sheetRect.top - lineEdgeTolerancePx;
      return belowSheetBottom || aboveSheetTop;
      };
      const host = document.querySelector('#editor.tiptap-host');
      const canvas = document.querySelector('.main-content--editor');
      const strip = host ? host.querySelector('.tiptap-sheet-strip') : null;
      const prose = host ? host.querySelector('.ProseMirror') : null;
      const pageWraps = strip ? [...strip.querySelectorAll(':scope > .tiptap-page-wrap')] : [];
      const pageRects = pageWraps.map((element) => rectOf(element)).filter(Boolean);
      const pageContentRects = pageWraps
        .map((element) => rectOf(element.querySelector('.tiptap-page__content')))
        .filter(Boolean);
      const canvasRect = rectOf(canvas);
      const viewportRect = canvasRect || {
      left: 0,
      right: window.innerWidth || document.documentElement.clientWidth || 0,
      top: 0,
      bottom: window.innerHeight || document.documentElement.clientHeight || 0,
      };
      const visibleSheetRects = pageRects.filter((rect) => rectsIntersect(rect, viewportRect));
      const visibleSheetContentRects = pageContentRects.filter((rect) => rectsIntersect(rect, viewportRect));
      const walker = prose
      ? document.createTreeWalker(prose, NodeFilter.SHOW_TEXT, {
          acceptNode(node) {
            return node.textContent && node.textContent.trim()
              ? NodeFilter.FILTER_ACCEPT
              : NodeFilter.FILTER_SKIP;
          },
        })
      : null;
      const visibleTextRects = [];
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
          if (rectsIntersect(textRect, viewportRect)) {
            visibleTextRects.push(textRect);
          }
        }
        current = walker.nextNode();
      }
      }
      const rawVisibleTextOutsideSheetRects = visibleTextRects.filter((textRect) => (
      !visibleSheetRects.some((sheetRect) => rectsIntersect(textRect, sheetRect))
      ));
      const visibleTextLineEdgeArtifactRects = visibleTextRects.filter((textRect) => (
      !visibleSheetRects.some((sheetRect) => rectContainedBySheet(textRect, sheetRect))
        && visibleSheetRects.some((sheetRect) => rectIsLineEdgeArtifact(textRect, sheetRect))
      ));
      const visibleTextOutsideSheetRects = visibleTextRects.filter((textRect) => (
      !visibleSheetRects.some((sheetRect) => rectContainedBySheet(textRect, sheetRect))
        && !visibleSheetRects.some((sheetRect) => rectIsLineEdgeArtifact(textRect, sheetRect))
      ));
      return {
      label: \${JSON.stringify(label)},
      proofClass: Boolean(host && host.classList.contains('tiptap-host--central-sheet-strip-proof')),
      centralSheetFlow: host ? host.dataset.centralSheetFlow || null : null,
      centralSheetRenderedPageCount: Number(host ? host.dataset.centralSheetRenderedPageCount || host.dataset.centralSheetCount || 0 : 0),
      centralSheetTotalPageCount: Number(host ? host.dataset.centralSheetTotalPageCount || host.dataset.centralSheetCount || 0 : 0),
      centralSheetWindowingEnabled: host ? host.dataset.centralSheetWindowingEnabled || null : null,
      centralSheetWindowFirstRenderedPage: Number(host ? host.dataset.centralSheetWindowFirstRenderedPage || 0 : 0),
      centralSheetWindowLastRenderedPage: Number(host ? host.dataset.centralSheetWindowLastRenderedPage || 0 : 0),
      centralSheetBoundedOverflowReason: host ? host.dataset.centralSheetBoundedOverflowReason || null : null,
      renderedSheetShellCount: pageWraps.length,
      visibleSheetCount: visibleSheetRects.length,
      visibleTextRectCount: visibleTextRects.length,
      rawVisibleTextOutsideSheetCount: rawVisibleTextOutsideSheetRects.length,
      visibleTextLineEdgeArtifactCount: visibleTextLineEdgeArtifactRects.length,
      visibleTextOutsideSheetCount: visibleTextOutsideSheetRects.length,
      sheetlessTextFrame: visibleTextRects.length > 0 && visibleTextOutsideSheetRects.length > 0,
      proseMirrorCount: host ? host.querySelectorAll('.ProseMirror').length : 0,
      tiptapEditorCount: host ? host.querySelectorAll('.tiptap-editor').length : 0,
      prosePageTruthCount: prose ? prose.querySelectorAll('[data-page-index], [data-page-number], [data-page-id]').length : 0,
      scrollTop: canvas instanceof HTMLElement ? canvas.scrollTop : 0,
      scrollHeight: canvas instanceof HTMLElement ? canvas.scrollHeight : 0,
      clientHeight: canvas instanceof HTMLElement ? canvas.clientHeight : 0,
      pageNumbers: pageWraps.map((element) => Number(element.dataset.pageNumber || 0)),
      visibleSheetSamples: visibleSheetRects.slice(0, 4),
      visibleSheetContentSamples: visibleSheetContentRects.slice(0, 4),
      rawOutsideSamples: rawVisibleTextOutsideSheetRects.slice(0, 4),
      lineEdgeArtifactSamples: visibleTextLineEdgeArtifactRects.slice(0, 4),
      outsideSamples: visibleTextOutsideSheetRects.slice(0, 4),
      };
    } catch (error) {
      return {
        label: \${JSON.stringify(label)},
        collectError: error && error.stack ? error.stack : String(error),
      };
    }
  })()\`;
}

async function collectFrame(win, label) {
  const state = await win.webContents.executeJavaScript(collectFrameSource(label), true);
  if (state && state.collectError) {
    throw new Error('COLLECT_FRAME_FAILED_' + label + '_' + state.collectError);
  }
  return state;
}

async function jumpAndCollectSameFrame(win, pageNumber) {
  const setupSource = \`
    {
      const setupHost = document.querySelector('#editor.tiptap-host');
      const setupCanvas = document.querySelector('.main-content--editor');
      if (!(setupHost instanceof HTMLElement) || !(setupCanvas instanceof HTMLElement)) {
        throw new Error('FAST_SCROLL_TARGET_MISSING');
      }
      const setupStyles = window.getComputedStyle(setupHost);
      const setupStride = Number.parseFloat(setupStyles.getPropertyValue('--central-sheet-page-stride-px')) || 1;
      setupCanvas.scrollTop = Math.max(0, Math.round((setupStride * (\${pageNumber} - 1)) + 12));
      setupCanvas.dispatchEvent(new Event('scroll', { bubbles: true }));
    }
  \`;
  const state = await win.webContents.executeJavaScript(
    collectFrameSource('jump-page-' + String(pageNumber) + '-same-frame', setupSource),
    true,
  );
  if (state && state.collectError) {
    throw new Error('JUMP_FRAME_FAILED_' + String(pageNumber) + '_' + state.collectError);
  }
  return state;
}

async function waitForStableTwoHundredPageFixture(win) {
  let lastState = null;
  for (let attempt = 0; attempt < 90; attempt += 1) {
    await sleep(500);
    const state = await collectFrame(win, 'stable-' + String(attempt + 1));
    lastState = state;
    if (
      state.proofClass === true
      && state.centralSheetFlow === 'vertical'
      && state.centralSheetWindowingEnabled === 'true'
      && state.centralSheetTotalPageCount >= 200
      && state.renderedSheetShellCount >= 2
      && state.renderedSheetShellCount <= 15
      && state.visibleSheetCount > 0
      && state.visibleTextRectCount > 0
      && state.proseMirrorCount === 1
      && state.tiptapEditorCount === 1
      && state.prosePageTruthCount === 0
    ) {
      return state;
    }
  }
  throw new Error('TWO_HUNDRED_PAGE_FIXTURE_NOT_STABLE ' + JSON.stringify(lastState));
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
    win.setContentSize(3840, 1110);
    await sleep(1200);
    await setEditorPayload(win);
    const stable = await waitForStableTwoHundredPageFixture(win);
    const page8JumpFrame = await jumpAndCollectSameFrame(win, 8);
    const page10JumpFrame = await jumpAndCollectSameFrame(win, 10);
    await sleep(350);
    const page10Settled = await collectFrame(win, 'page-10-settled');
    const payload = {
      ok: true,
      stable,
      page8JumpFrame,
      page10JumpFrame,
      page10Settled,
      networkRequests,
      dialogCalls,
    };
    await fs.writeFile(path.join(outputDir, 'result.json'), JSON.stringify(payload, null, 2));
    process.stdout.write('EDITORIAL_SHEET_FAST_SCROLL_CATCHUP_RESULT:' + JSON.stringify(payload) + '\\n');
    app.exit(0);
  } catch (error) {
    const payload = { ok: false, error: error && error.stack ? error.stack : String(error), networkRequests, dialogCalls };
    await fs.writeFile(path.join(outputDir, 'result.json'), JSON.stringify(payload, null, 2));
    process.stdout.write('EDITORIAL_SHEET_FAST_SCROLL_CATCHUP_RESULT:' + JSON.stringify(payload) + '\\n');
    app.exit(1);
  }
});
`;
}

const helperPath = path.join(outputDir, 'editorial-sheet-fast-scroll-catchup-helper.cjs');
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
  }, 120000);
  child.on('exit', (code) => {
    clearTimeout(timer);
    resolve(typeof code === 'number' ? code : 1);
  });
});

const resultPath = path.join(outputDir, 'result.json');
const rawResult = await readFile(resultPath, 'utf8');
const result = JSON.parse(rawResult);

assert.equal(exitCode, 0, `electron helper failed with ${exitCode}\n${stdout}\n${stderr}`);
assert.equal(result.ok, true);
assert.equal(result.networkRequests, 0);
assert.equal(result.dialogCalls, 0);
assert.equal(result.stable.centralSheetTotalPageCount >= 200, true);

for (const frame of [result.page8JumpFrame, result.page10JumpFrame, result.page10Settled]) {
  assert.equal(frame.proofClass, true, `${frame.label} must keep central sheet proof`);
  assert.equal(frame.centralSheetFlow, 'vertical', `${frame.label} must keep vertical sheet flow`);
  assert.equal(frame.centralSheetWindowingEnabled, 'true', `${frame.label} must keep runtime windowing`);
  assert.equal(frame.renderedSheetShellCount >= 2, true, `${frame.label} must keep shell window present`);
  assert.equal(frame.renderedSheetShellCount <= 15, true, `${frame.label} must keep shell window bounded`);
  assert.equal(frame.visibleTextRectCount > 0, true, `${frame.label} must observe visible text`);
  assert.equal(frame.visibleSheetCount > 0, true, `${frame.label} must observe visible sheets`);
  assert.equal(frame.visibleTextOutsideSheetCount, 0, `${frame.label} must not expose visible sheetless text`);
  assert.equal(frame.sheetlessTextFrame, false, `${frame.label} must not be a sheetless frame`);
  assert.equal(frame.proseMirrorCount, 1, `${frame.label} must keep one ProseMirror`);
  assert.equal(frame.tiptapEditorCount, 1, `${frame.label} must keep one tiptap editor`);
  assert.equal(frame.prosePageTruthCount, 0, `${frame.label} must not create page truth inside ProseMirror`);
}

assert.equal(
  result.page8JumpFrame.centralSheetWindowFirstRenderedPage <= 8
    && result.page8JumpFrame.centralSheetWindowLastRenderedPage >= 8,
  true,
  'page 8 same-frame jump must refresh shell window around page 8',
);
assert.equal(
  result.page10JumpFrame.centralSheetWindowFirstRenderedPage <= 10
    && result.page10JumpFrame.centralSheetWindowLastRenderedPage >= 10,
  true,
  'page 10 same-frame jump must refresh shell window around page 10',
);

console.log('EDITORIAL_SHEET_FAST_SCROLL_CATCHUP_SUMMARY:' + JSON.stringify({
  ok: true,
  outputDir,
  totalPageCount: result.stable.centralSheetTotalPageCount,
  page8FirstRenderedPage: result.page8JumpFrame.centralSheetWindowFirstRenderedPage,
  page8LastRenderedPage: result.page8JumpFrame.centralSheetWindowLastRenderedPage,
  page10FirstRenderedPage: result.page10JumpFrame.centralSheetWindowFirstRenderedPage,
  page10LastRenderedPage: result.page10JumpFrame.centralSheetWindowLastRenderedPage,
  stableVisibleTextOutsideSheetCount: result.stable.visibleTextOutsideSheetCount,
  page8VisibleTextOutsideSheetCount: result.page8JumpFrame.visibleTextOutsideSheetCount,
  page10VisibleTextOutsideSheetCount: result.page10JumpFrame.visibleTextOutsideSheetCount,
  page10SettledVisibleTextOutsideSheetCount: result.page10Settled.visibleTextOutsideSheetCount,
}));

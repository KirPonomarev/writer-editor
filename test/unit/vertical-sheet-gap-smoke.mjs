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
  const paragraph = 'Vertical gap live proof paragraph. This text must stay inside derived sheets and outside visual gaps.';
  return Array.from({ length: paragraphCount }, (_, index) => (
    paragraph + ' ' + String(index + 1) + '. ' + paragraph
  )).join('\\\\n\\\\n');
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
    title: 'vertical-sheet-gap-smoke',
    path: '',
    kind: 'chapter-file',
    metaEnabled: true,
    projectId: 'vertical-sheet-gap-smoke',
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
    const textGapIntersectionCount = textRects.filter((textRect) => (
      gapRects.some((gapRect) => gapRect.height > 0 && intersects(textRect, gapRect))
    )).length;
    const rightFlowSheetPairCount = pageRects.slice(1).filter((rect, index) => {
      const previous = pageRects[index];
      return previous && rect.left > previous.left + 24;
    }).length;
    const verticallyStackedSheetPairCount = pageRects.slice(1).filter((rect, index) => {
      const previous = pageRects[index];
      return previous && rect.top > previous.top + 24 && Math.abs(rect.left - previous.left) <= 2;
    }).length;
    const gapHeights = gapRects.map((rect) => Math.round(rect.height));
    const rootStyles = getComputedStyle(document.documentElement);
    return {
      label: \${JSON.stringify(label)},
      centralSheetFlow: host ? host.dataset.centralSheetFlow || null : null,
      visibleSheetCount: pageWraps.length,
      pageGapCssPx: rootStyles.getPropertyValue('--page-gap-px').trim(),
      gapHeights,
      minGapPx: gapHeights.length ? Math.min(...gapHeights) : 0,
      maxGapPx: gapHeights.length ? Math.max(...gapHeights) : 0,
      textGapIntersectionCount,
      proseMirrorCount: host ? host.querySelectorAll('.ProseMirror').length : 0,
      tiptapEditorCount: host ? host.querySelectorAll('.tiptap-editor').length : 0,
      prosePageTruthCount: prose ? prose.querySelectorAll('[data-page-index], [data-page-number], [data-page-id]').length : 0,
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
    if (
      state.centralSheetFlow === 'vertical'
      && state.visibleSheetCount === 5
      && state.verticallyStackedSheetPairCount === 4
      && state.rightFlowSheetPairCount === 0
      && state.proseMirrorCount === 1
    ) {
      return { paragraphCount, state };
    }
  }
  throw new Error('NO_FIVE_SHEET_GAP_FIXTURE ' + JSON.stringify(lastState));
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
    const fixture = await findFiveSheetFixture(win);
    await setEditorPayload(win, fixture.paragraphCount);
    await sleep(800);
    const state = await collectState(win, 'after-layout');
    await saveCapture(win, 'vertical-sheet-gap-after-layout.png');
    const payload = {
      ok: true,
      paragraphCount: fixture.paragraphCount,
      state,
      networkRequests,
      dialogCalls,
      screenshot: path.join(outputDir, 'vertical-sheet-gap-after-layout.png'),
    };
    await fs.writeFile(path.join(outputDir, 'result.json'), JSON.stringify(payload, null, 2));
    process.stdout.write('VERTICAL_SHEET_GAP_ELECTRON_RESULT:' + JSON.stringify(payload) + '\\\\n');
    app.exit(0);
  } catch (error) {
    const payload = { ok: false, error: error && error.stack ? error.stack : String(error), networkRequests, dialogCalls };
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
assert.equal(editorText.includes('metrics.pageHeightPx * visiblePageCount'), true);
assert.equal(cssText.includes('flex-direction: column;'), true);
assert.equal(cssText.includes('gap: var(--page-gap-px);'), true);
assert.equal(cssText.includes('column-width: var(--central-sheet-content-width-px);'), false);

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

assert.equal(exitCode, 0, `electron helper failed with ${exitCode}\n${stdout}\n${stderr}`);
assert.equal(result.ok, true);
assert.equal(state.centralSheetFlow, 'vertical');
assert.equal(state.visibleSheetCount, 5);
assert.equal(state.verticallyStackedSheetPairCount, 4);
assert.equal(state.rightFlowSheetPairCount, 0);
assert.equal(state.minGapPx >= 24, true);
assert.equal(state.maxGapPx <= 72, true);
assert.equal(state.textGapIntersectionCount, 0);
assert.equal(state.proseMirrorCount, 1);
assert.equal(state.tiptapEditorCount, 1);
assert.equal(state.prosePageTruthCount, 0);
assert.equal(result.networkRequests, 0);
assert.equal(result.dialogCalls, 0);

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
  proseMirrorCount: state.proseMirrorCount,
  screenshot: result.screenshot,
}));

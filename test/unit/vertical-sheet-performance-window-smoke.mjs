import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const rootDir = path.resolve(new URL('../..', import.meta.url).pathname);
const requireFromHere = createRequire(import.meta.url);
const electronBinary = requireFromHere('electron');
const outputDir = process.env.VERTICAL_SHEET_PERFORMANCE_WINDOW_OUT_DIR
  ? path.resolve(process.env.VERTICAL_SHEET_PERFORMANCE_WINDOW_OUT_DIR)
  : await mkdtemp(path.join(os.tmpdir(), 'vertical-sheet-performance-window-'));

function buildHelperSource() {
  return `
const path = require('node:path');
const fs = require('node:fs/promises');
const { app, BrowserWindow, dialog, session } = require('electron');

const rootDir = ${JSON.stringify(rootDir)};
const outputDir = ${JSON.stringify(outputDir)};
const mainEntrypoint = path.join(rootDir, 'src', 'main' + '.js');
const marker = 'VSPWG_INPUT_MARKER';
let networkRequests = 0;
let dialogCalls = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildLongText(unitCount) {
  const sentence = 'Vertical performance window proof sentence that should remain inside derived visual sheets without creating page truth.';
  return Array.from({ length: unitCount }, (_, index) => (
    sentence + ' ' + String(index + 1) + '.'
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

async function setEditorContent(win, unitCount, targetPageCount) {
  win.webContents.send('editor:set-text', {
    content: buildLongText(unitCount),
    title: 'vertical-sheet-performance-window-' + String(targetPageCount),
    path: '',
    kind: 'chapter-file',
    metaEnabled: true,
    projectId: 'vertical-sheet-performance-window-' + String(targetPageCount),
    bookProfile: null,
  });
}

async function collectState(win, label) {
  return win.webContents.executeJavaScript(\`(() => {
    window.__verticalSheetPerformanceProbeCounter = Number(window.__verticalSheetPerformanceProbeCounter || 0);
    const host = document.querySelector('#editor.tiptap-host');
    const strip = host ? host.querySelector('.tiptap-sheet-strip') : null;
    const prose = host ? host.querySelector('.ProseMirror') : null;
    const sourceWraps = host ? [...host.querySelectorAll(':scope > .tiptap-page-wrap')] : [];
    const pageWraps = strip ? [...strip.querySelectorAll(':scope > .tiptap-page-wrap')] : [];
    pageWraps.forEach((el) => {
      if (!el.dataset.performanceProbeId) {
        window.__verticalSheetPerformanceProbeCounter += 1;
        el.dataset.performanceProbeId = 'vspwg-' + String(window.__verticalSheetPerformanceProbeCounter);
      }
    });
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
    const pageRects = pageWraps.map((el) => toPlainRect(el.getBoundingClientRect())).filter(Boolean);
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
    const sourcePageCount = Number(
      (host && host.dataset.centralSheetBoundedOverflowSourcePageCount)
      || (host && host.dataset.centralSheetCount)
      || pageWraps.length
      || 0
    );
    const visiblePageCount = Number(
      (host && host.dataset.centralSheetBoundedOverflowVisiblePageCount)
      || (host && host.dataset.centralSheetCount)
      || pageWraps.length
      || 0
    );
    const hiddenPageCount = Number(
      (host && host.dataset.centralSheetBoundedOverflowHiddenPageCount)
      || Math.max(0, sourcePageCount - visiblePageCount)
    );
    const text = prose ? prose.textContent || '' : '';
    return {
      label: \${JSON.stringify(label)},
      centralSheetFlow: host ? host.dataset.centralSheetFlow || null : null,
      centralSheetCount: host ? host.dataset.centralSheetCount || null : null,
      centralSheetOverflowReason: host ? host.dataset.centralSheetOverflowReason || null : null,
      centralSheetBoundedOverflowReason: host ? host.dataset.centralSheetBoundedOverflowReason || null : null,
      sourcePageCount,
      visiblePageCount,
      hiddenPageCount,
      visibleSheetCount: pageWraps.length,
      probeIds: pageWraps.map((el) => el.dataset.performanceProbeId || ''),
      domNodeCount: document.querySelectorAll('*').length,
      textLength: text.length,
      markerCount: (text.match(/VSPWG_INPUT_MARKER/gu) || []).length,
      textRectCount: textRects.length,
      textGapIntersectionCount,
      proseMirrorCount: host ? host.querySelectorAll('.ProseMirror').length : 0,
      tiptapEditorCount: host ? host.querySelectorAll('.tiptap-editor').length : 0,
      sourceWrapperCount: sourceWraps.length,
      sourceEditorWrapperCount: sourceWraps.filter((el) => el.querySelector('.ProseMirror') || el.querySelector('.tiptap-editor')).length,
      derivedSheetProseMirrorCount: pageWraps.reduce((sum, el) => sum + el.querySelectorAll('.ProseMirror').length, 0),
      derivedSheetEditorCount: pageWraps.reduce((sum, el) => sum + el.querySelectorAll('.tiptap-editor').length, 0),
      prosePageTruthCount: prose ? prose.querySelectorAll('[data-page-index], [data-page-number], [data-page-id]').length : 0,
      rightFlowSheetPairCount,
      verticallyStackedSheetPairCount,
      gapHeights: gapRects.map((rect) => Math.round(rect.height)),
    };
  })()\`, true);
}

async function waitForScenario(win, label, targetPageCount) {
  let lastState = null;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await sleep(250);
    const state = await collectState(win, label);
    lastState = state;
    if (
      state.centralSheetFlow === 'vertical'
      && state.sourcePageCount >= targetPageCount
      && state.visibleSheetCount > 0
      && state.proseMirrorCount === 1
    ) {
      return state;
    }
  }
  throw new Error('SCENARIO_NOT_STABLE_' + label + '_' + JSON.stringify(lastState));
}

async function runScenario(win, targetPageCount, unitCount) {
  const loadStart = Date.now();
  await setEditorContent(win, unitCount, targetPageCount);
  const state = await waitForScenario(win, 'pages-' + String(targetPageCount), targetPageCount);
  return {
    targetPageCount,
    unitCount,
    loadMs: Date.now() - loadStart,
    state,
  };
}

async function focusEditorEnd(win) {
  return win.webContents.executeJavaScript(\`(() => {
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
    return {
      ok: true,
      activeElementInsideProse: document.activeElement === prose || prose.contains(document.activeElement),
      proseMirrorCount: host.querySelectorAll('.ProseMirror').length,
      tiptapEditorCount: host.querySelectorAll('.tiptap-editor').length,
    };
  })()\`, true);
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

    const scenarios = [
      await runScenario(win, 10, 220),
      await runScenario(win, 50, 1100),
      await runScenario(win, 100, 2200),
    ];
    const beforeInput = await collectState(win, 'before-input-100');
    const focus = await focusEditorEnd(win);
    const insertStart = Date.now();
    await win.webContents.insertText(' ' + marker + ' ');
    await sleep(800);
    const afterInput = await collectState(win, 'after-input-100');
    const beforeProbeIds = beforeInput.probeIds || [];
    const afterProbeIds = new Set(afterInput.probeIds || []);
    const fullVisibleSheetRebuildAfterInput = beforeProbeIds.length > 0
      ? beforeProbeIds.some((id) => !afterProbeIds.has(id))
      : true;
    const payload = {
      ok: true,
      scenarios,
      beforeInput,
      focus,
      afterInput,
      insertMs100: Date.now() - insertStart,
      fullVisibleSheetRebuildAfterInput,
      networkRequests,
      dialogCalls,
      outputDir,
    };
    await fs.writeFile(path.join(outputDir, 'result.json'), JSON.stringify(payload, null, 2));
    process.stdout.write('VERTICAL_SHEET_PERFORMANCE_WINDOW_RESULT:' + JSON.stringify(payload) + '\\n');
    app.exit(0);
  } catch (error) {
    const payload = {
      ok: false,
      error: error && error.stack ? error.stack : String(error),
      networkRequests,
      dialogCalls,
      outputDir,
    };
    await fs.writeFile(path.join(outputDir, 'result.json'), JSON.stringify(payload, null, 2));
    process.stdout.write('VERTICAL_SHEET_PERFORMANCE_WINDOW_RESULT:' + JSON.stringify(payload) + '\\n');
    app.exit(1);
  }
});
`;
}

const helperPath = path.join(outputDir, 'vertical-sheet-performance-window-helper.cjs');
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

const rawResult = await readFile(path.join(outputDir, 'result.json'), 'utf8');
const result = JSON.parse(rawResult);

assert.equal(exitCode, 0, `electron helper failed with ${exitCode}\n${stdout}\n${stderr}`);
assert.equal(result.ok, true);
assert.equal(result.scenarios.length, 3);
assert.equal(result.networkRequests, 0);
assert.equal(result.dialogCalls, 0);

for (const scenario of result.scenarios) {
  const state = scenario.state;
  assert.equal(state.sourcePageCount >= scenario.targetPageCount, true, `source pages for ${scenario.targetPageCount}`);
  assert.equal(state.centralSheetFlow, 'vertical');
  assert.equal(state.visibleSheetCount > 0, true);
  assert.equal(state.visibleSheetCount <= 5, true);
  assert.equal(state.visiblePageCount <= 5, true);
  assert.equal(state.hiddenPageCount > 0, true);
  assert.equal(state.centralSheetBoundedOverflowReason, 'max-page-count');
  assert.equal(state.proseMirrorCount, 1);
  assert.equal(state.tiptapEditorCount, 1);
  assert.equal(state.sourceWrapperCount, 1);
  assert.equal(state.sourceEditorWrapperCount, 1);
  assert.equal(state.derivedSheetProseMirrorCount, 0);
  assert.equal(state.derivedSheetEditorCount, 0);
  assert.equal(state.prosePageTruthCount, 0);
  assert.equal(state.textGapIntersectionCount, 0);
  assert.equal(state.rightFlowSheetPairCount, 0);
  assert.equal(state.verticallyStackedSheetPairCount, state.visibleSheetCount - 1);
}

const scenario50 = result.scenarios.find((scenario) => scenario.targetPageCount === 50);
const scenario100 = result.scenarios.find((scenario) => scenario.targetPageCount === 100);
assert.ok(scenario50);
assert.ok(scenario100);
assert.equal(
  scenario100.state.domNodeCount <= scenario50.state.domNodeCount + 250,
  true,
  `100-page DOM budget ${scenario100.state.domNodeCount} <= ${scenario50.state.domNodeCount} + 250`,
);

assert.equal(result.focus.ok, true);
assert.equal(result.focus.proseMirrorCount, 1);
assert.equal(result.focus.tiptapEditorCount, 1);
assert.equal(result.beforeInput.sourcePageCount >= 100, true);
assert.equal(result.afterInput.sourcePageCount >= 100, true);
assert.equal(result.afterInput.visibleSheetCount <= 5, true);
assert.equal(result.afterInput.proseMirrorCount, 1);
assert.equal(result.afterInput.tiptapEditorCount, 1);
assert.equal(result.afterInput.derivedSheetProseMirrorCount, 0);
assert.equal(result.afterInput.derivedSheetEditorCount, 0);
assert.equal(result.afterInput.prosePageTruthCount, 0);
assert.equal(result.afterInput.textGapIntersectionCount, 0);
assert.equal(result.afterInput.markerCount, 1);
assert.equal(result.fullVisibleSheetRebuildAfterInput, false);

const summary = {
  ok: true,
  outputDir,
  scenarios: result.scenarios.map((scenario) => ({
    targetPageCount: scenario.targetPageCount,
    sourcePageCount: scenario.state.sourcePageCount,
    visibleSheetCount: scenario.state.visibleSheetCount,
    hiddenPageCount: scenario.state.hiddenPageCount,
    domNodeCount: scenario.state.domNodeCount,
    textRectCount: scenario.state.textRectCount,
    textGapIntersectionCount: scenario.state.textGapIntersectionCount,
    proseMirrorCount: scenario.state.proseMirrorCount,
    loadMs: scenario.loadMs,
  })),
  insertMs100: result.insertMs100,
  fullVisibleSheetRebuildAfterInput: result.fullVisibleSheetRebuildAfterInput,
  afterInputDomNodeCount: result.afterInput.domNodeCount,
  afterInputSourcePageCount: result.afterInput.sourcePageCount,
  afterInputVisibleSheetCount: result.afterInput.visibleSheetCount,
  afterInputHiddenPageCount: result.afterInput.hiddenPageCount,
};

console.log('VERTICAL_SHEET_PERFORMANCE_WINDOW_SUMMARY:' + JSON.stringify(summary));

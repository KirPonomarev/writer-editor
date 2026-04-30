import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const rootDir = path.resolve(new URL('../..', import.meta.url).pathname);
const requireFromHere = createRequire(import.meta.url);
const electronBinary = requireFromHere('electron');
const targetPageCount = Number.parseInt(process.env.EDITOR_SHEET_STRESS_TARGET_PAGE_COUNT || '2000', 10);
const rowTimeoutMs = Number.parseInt(process.env.EDITOR_SHEET_STRESS_TIMEOUT_MS || '420000', 10);
const allowResourceStop = process.env.EDITOR_SHEET_STRESS_ALLOW_RESOURCE_STOP === 'true';
assert.ok([2000, 3000, 4000, 5000].includes(targetPageCount), 'target page count must be 2000, 3000, 4000, or 5000');
assert.ok(Number.isInteger(rowTimeoutMs) && rowTimeoutMs >= 30000, 'row timeout must be at least 30000 ms');
const outputDir = process.env.EDITOR_SHEET_STRESS_OUT_DIR
  ? path.resolve(process.env.EDITOR_SHEET_STRESS_OUT_DIR)
  : await mkdtemp(path.join(os.tmpdir(), `editor-sheet-${targetPageCount}-instrumented-stress-`));
const parentResultPath = path.join(outputDir, 'parent-result.json');
const checkpointPath = path.join(outputDir, 'checkpoints.jsonl');

const MIN_RENDERED_SHEET_WINDOW = 2;
const MAX_RENDERED_SHEET_WINDOW = 15;
const markerNames = Object.freeze(['START', 'P25', 'MIDDLE', 'P75', 'END']);

function buildHelperSource() {
  return `
const crypto = require('node:crypto');
const path = require('node:path');
const fs = require('node:fs/promises');
const { app, BrowserWindow, dialog, session } = require('electron');

const rootDir = ${JSON.stringify(rootDir)};
const outputDir = ${JSON.stringify(outputDir)};
const checkpointPath = path.join(outputDir, 'checkpoints.jsonl');
const markerNames = ${JSON.stringify(markerNames)};
const targetPageCount = ${JSON.stringify(targetPageCount)};
const mainEntrypoint = path.join(rootDir, 'src', 'main' + '.js');
const processStartedAt = Date.now();
let networkRequests = 0;
let dialogCalls = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hashText(text) {
  return crypto.createHash('sha256').update(String(text)).digest('hex');
}

async function checkpoint(event, details = {}) {
  const payload = {
    event,
    elapsedMs: Date.now() - processStartedAt,
    rssBytes: process.memoryUsage().rss,
    heapUsedBytes: process.memoryUsage().heapUsed,
    ...details,
  };
  const line = JSON.stringify(payload);
  await fs.appendFile(checkpointPath, line + '\\n', 'utf8');
  process.stdout.write('EDITOR_SHEET_STRESS_CHECKPOINT:' + line + '\\n');
  return payload;
}

function buildFixture({ targetPageCount, seed, unitCountOverride = null }) {
  const baseSentence = 'Longform stress smoke synthetic prose keeps the editor sheet busy while avoiding user manuscript data and avoiding product capability claims.';
  const secondarySentence = 'The generated text exists only to observe derived sheet windowing, marker navigation, bounded DOM, and hash stability.';
  const unitCount = Math.ceil(unitCountOverride || (targetPageCount * 5));
  const markerIndexes = {
    START: 0,
    P25: Math.floor(unitCount * 0.25),
    MIDDLE: Math.floor(unitCount * 0.5),
    P75: Math.floor(unitCount * 0.75),
    END: unitCount - 1,
  };
  const units = [];
  for (let index = 0; index < unitCount; index += 1) {
    for (const markerName of markerNames) {
      if (markerIndexes[markerName] === index) {
        units.push('LONGFORM_STRESS_' + markerName + '_MARKER_' + seed + '.');
      }
    }
    units.push(baseSentence + ' Unit ' + String(index + 1) + ' seed ' + seed + '. ' + secondarySentence);
  }
  const text = units.join(' ');
  const words = text.trim().split(/\\s+/u).filter(Boolean);
  return {
    text,
    metadata: {
      targetPageCount,
      seed,
      unitCount,
      characterCount: text.length,
      wordCount: words.length,
      paragraphCount: 1,
      canonicalHash: hashText(text),
      markerTokens: Object.fromEntries(markerNames.map((name) => [name, 'LONGFORM_STRESS_' + name + '_MARKER_' + seed])),
    },
  };
}

function rectsIntersect(a, b) {
  return Boolean(a && b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top);
}

async function waitForWindow() {
  for (let attempt = 0; attempt < 240; attempt += 1) {
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

async function setEditorPayload(win, fixture, label) {
  await checkpoint('payload_send_start', {
    label,
    characterCount: fixture.metadata.characterCount,
    wordCount: fixture.metadata.wordCount,
  });
  win.webContents.send('editor:set-text', {
    content: fixture.text,
    title: 'longform-stress-' + label,
    path: '',
    kind: 'chapter-file',
    metaEnabled: true,
    projectId: 'longform-stress-' + label,
    bookProfile: null,
  });
  await checkpoint('payload_send_done', { label });
}

async function collectState(win, label, markerTokens, options = {}) {
  return win.webContents.executeJavaScript(\`(() => {
    const markerTokens = \${JSON.stringify(markerTokens)};
    const activeMarkerNames = \${JSON.stringify(options.activeMarkerNames || markerNames)};
    const includeTextHash = \${JSON.stringify(options.includeTextHash !== false)};
    const stopAfterFirstMarkerRect = \${JSON.stringify(options.stopAfterFirstMarkerRect === true)};
    const rectsIntersect = (a, b) => Boolean(
      a && b
        && a.left < b.right
        && a.right > b.left
        && a.top < b.bottom
        && a.bottom > b.top
    );
    const rectOf = (element) => {
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      };
    };
    const hashString = (text) => {
      let hash = 2166136261;
      for (let index = 0; index < text.length; index += 1) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
      }
      return String(hash >>> 0);
    };
    const host = document.querySelector('#editor.tiptap-host');
    const strip = host ? host.querySelector('.tiptap-sheet-strip') : null;
    const prose = host ? host.querySelector('.ProseMirror') : null;
    const canvas = document.querySelector('.main-content--editor');
    const pageWraps = strip ? [...strip.querySelectorAll(':scope > .tiptap-page-wrap')] : [];
    const pageRects = pageWraps.map((element) => rectOf(element)).filter(Boolean);
    const canvasRect = rectOf(canvas);
    const viewportRect = canvasRect || {
      left: 0,
      right: window.innerWidth || document.documentElement.clientWidth || 0,
      top: 0,
      bottom: window.innerHeight || document.documentElement.clientHeight || 0,
    };
    const visibleSheetCount = pageRects.filter((rect) => rectsIntersect(rect, viewportRect)).length;
    const text = prose ? prose.textContent || '' : '';
    const marker = {};
    const walker = prose
      ? document.createTreeWalker(prose, NodeFilter.SHOW_TEXT, {
          acceptNode(node) {
            return node.textContent && node.textContent.trim()
              ? NodeFilter.FILTER_ACCEPT
              : NodeFilter.FILTER_SKIP;
          },
        })
      : null;
    for (const [name, token] of Object.entries(markerTokens)) {
      if (!activeMarkerNames.includes(name)) continue;
      marker[name] = {
        token,
        occurrenceCount: null,
        rectCount: 0,
        visibleRectCount: 0,
        firstRect: null,
      };
    }
    if (walker) {
      let current = walker.nextNode();
      while (current) {
        const currentText = current.textContent || '';
        for (const [name, token] of Object.entries(markerTokens)) {
          if (!activeMarkerNames.includes(name)) continue;
          let tokenIndex = currentText.indexOf(token);
          while (tokenIndex !== -1) {
            marker[name].occurrenceCount = Number(marker[name].occurrenceCount || 0) + 1;
            const range = document.createRange();
            range.setStart(current, tokenIndex);
            range.setEnd(current, tokenIndex + token.length);
            const rects = [...range.getClientRects()].map((rect) => ({
              left: rect.left,
              right: rect.right,
              top: rect.top,
              bottom: rect.bottom,
              width: rect.width,
              height: rect.height,
            }));
            marker[name].rectCount += rects.length;
            marker[name].visibleRectCount += rects.filter((rect) => rectsIntersect(rect, viewportRect)).length;
            if (!marker[name].firstRect && rects.length > 0) {
              marker[name].firstRect = rects[0];
            }
            tokenIndex = stopAfterFirstMarkerRect && rects.length > 0
              ? -1
              : currentText.indexOf(token, tokenIndex + token.length);
          }
        }
        current = walker.nextNode();
      }
    }
    const scrollTop = canvas instanceof HTMLElement ? canvas.scrollTop : 0;
    const scrollHeight = canvas instanceof HTMLElement ? canvas.scrollHeight : 0;
    const clientHeight = canvas instanceof HTMLElement ? canvas.clientHeight : 0;
    return {
      label: \${JSON.stringify(label)},
      centralSheetFlow: host ? host.dataset.centralSheetFlow || null : null,
      centralSheetRenderedPageCount: Number(host ? host.dataset.centralSheetRenderedPageCount || host.dataset.centralSheetCount || 0 : 0),
      centralSheetTotalPageCount: Number(host ? host.dataset.centralSheetTotalPageCount || host.dataset.centralSheetCount || 0 : 0),
      centralSheetWindowingEnabled: host ? host.dataset.centralSheetWindowingEnabled || null : null,
      centralSheetWindowFirstRenderedPage: Number(host ? host.dataset.centralSheetWindowFirstRenderedPage || 0 : 0),
      centralSheetWindowLastRenderedPage: Number(host ? host.dataset.centralSheetWindowLastRenderedPage || 0 : 0),
      centralSheetBoundedOverflowReason: host ? host.dataset.centralSheetBoundedOverflowReason || null : null,
      centralSheetBoundedOverflowHiddenPageCount: Number(host ? host.dataset.centralSheetBoundedOverflowHiddenPageCount || 0 : 0),
      proofClass: Boolean(host && host.classList.contains('tiptap-host--central-sheet-strip-proof')),
      proseMirrorCount: host ? host.querySelectorAll('.ProseMirror').length : 0,
      tiptapEditorCount: host ? host.querySelectorAll('.tiptap-editor').length : 0,
      derivedSheetProseMirrorCount: pageWraps.reduce((sum, element) => sum + element.querySelectorAll('.ProseMirror').length, 0),
      derivedSheetEditorCount: pageWraps.reduce((sum, element) => sum + element.querySelectorAll('.tiptap-editor').length, 0),
      prosePageTruthCount: prose ? prose.querySelectorAll('[data-page-index], [data-page-number], [data-page-id]').length : 0,
      renderedSheetShellCount: pageWraps.length,
      visibleSheetCount,
      domNodeCount: document.querySelectorAll('*').length,
      textLength: text.length,
      textHash: includeTextHash ? hashString(text) : null,
      marker,
      scrollTop,
      scrollHeight,
      clientHeight,
      maxScrollTop: Math.max(0, scrollHeight - clientHeight),
    };
  })()\`, true);
}

async function waitForScenario(win, scenario, markerTokens) {
  await checkpoint('stable_wait_start', {
    label: scenario.label,
    targetPageCount: scenario.targetPageCount,
  });
  let lastState = null;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    await sleep(500);
    const state = await collectState(win, scenario.label + '-stable-' + String(attempt + 1), markerTokens);
    lastState = state;
    await checkpoint('stable_wait_probe', {
      label: scenario.label,
      attempt: attempt + 1,
      actualPageCount: state.centralSheetTotalPageCount,
      renderedSheetShellCount: state.renderedSheetShellCount,
      visibleSheetCount: state.visibleSheetCount,
      domNodeCount: state.domNodeCount,
      firstRenderedPage: state.centralSheetWindowFirstRenderedPage,
      lastRenderedPage: state.centralSheetWindowLastRenderedPage,
    });
    if (
      state.centralSheetFlow === 'vertical'
      && state.centralSheetTotalPageCount >= scenario.targetPageCount
      && state.renderedSheetShellCount >= ${String(MIN_RENDERED_SHEET_WINDOW)}
      && state.renderedSheetShellCount <= ${String(MAX_RENDERED_SHEET_WINDOW)}
      && state.proseMirrorCount === 1
      && markerNames.every((name) => state.marker[name] && state.marker[name].occurrenceCount === 1)
    ) {
      await checkpoint('stable_wait_done', {
        label: scenario.label,
        attempt: attempt + 1,
        actualPageCount: state.centralSheetTotalPageCount,
        renderedSheetShellCount: state.renderedSheetShellCount,
        domNodeCount: state.domNodeCount,
      });
      return state;
    }
  }
  throw new Error('LONGFORM_STRESS_SCENARIO_NOT_STABLE_' + scenario.label + '_' + JSON.stringify(lastState));
}

async function scrollToMarker(win, markerName, markerTokens) {
  const markerOptions = { activeMarkerNames: [markerName], includeTextHash: false, stopAfterFirstMarkerRect: true };
  await checkpoint('marker_scan_start', { markerName });
  const before = await collectState(win, markerName + '-before-scroll', markerTokens, markerOptions);
  await checkpoint('marker_scan_done', {
    markerName,
    rectCount: before.marker[markerName] ? before.marker[markerName].rectCount : null,
    visibleRectCount: before.marker[markerName] ? before.marker[markerName].visibleRectCount : null,
  });
  const markerState = before.marker[markerName];
  if (!markerState || !markerState.firstRect) {
    throw new Error('MARKER_RECT_MISSING_' + markerName + '_' + JSON.stringify(before));
  }
  await checkpoint('marker_scroll_start', { markerName });
  const scrollResult = await win.webContents.executeJavaScript(\`(() => {
    const markerRect = \${JSON.stringify(markerState.firstRect)};
    const canvas = document.querySelector('.main-content--editor');
    if (!(canvas instanceof HTMLElement)) {
      return { ok: false, reason: 'CANVAS_MISSING' };
    }
    const viewportCenter = canvas.clientHeight / 2;
    const nextScrollTop = Math.max(0, Math.min(
      canvas.scrollHeight - canvas.clientHeight,
      canvas.scrollTop + markerRect.top - viewportCenter
    ));
    canvas.scrollTop = Math.round(nextScrollTop);
    return {
      ok: true,
      markerName: \${JSON.stringify(markerName)},
      scrollTop: canvas.scrollTop,
      scrollHeight: canvas.scrollHeight,
      clientHeight: canvas.clientHeight,
      maxScrollTop: Math.max(0, canvas.scrollHeight - canvas.clientHeight),
    };
  })()\`, true);
  await sleep(900);
  let after = await collectState(win, markerName + '-after-scroll', markerTokens, markerOptions);
  for (let attempt = 0; attempt < 18 && after.marker[markerName].visibleRectCount === 0; attempt += 1) {
    await sleep(180);
    after = await collectState(win, markerName + '-after-scroll-wait-' + String(attempt + 1), markerTokens, markerOptions);
  }
  await checkpoint('marker_scroll_done', {
    markerName,
    scrollTop: scrollResult.scrollTop,
    firstRenderedPage: after.centralSheetWindowFirstRenderedPage,
    lastRenderedPage: after.centralSheetWindowLastRenderedPage,
    visibleRectCount: after.marker[markerName].visibleRectCount,
  });
  return { markerName, before, scrollResult, after };
}

async function runScenario(win, scenario) {
  process.stdout.write('LONGFORM_STRESS_PROGRESS:' + JSON.stringify({
    event: 'scenario-start',
    label: scenario.label,
    targetPageCount: scenario.targetPageCount,
  }) + '\\n');
  await checkpoint('fixture_build_start', {
    label: scenario.label,
    targetPageCount: scenario.targetPageCount,
    seed: scenario.seed,
    unitCountOverride: scenario.unitCountOverride,
  });
  const fixture = buildFixture({
    targetPageCount: scenario.targetPageCount,
    seed: scenario.seed,
    unitCountOverride: scenario.unitCountOverride,
  });
  const loadStart = Date.now();
  await checkpoint('fixture_build_done', {
    label: scenario.label,
    characterCount: fixture.metadata.characterCount,
    wordCount: fixture.metadata.wordCount,
    unitCount: fixture.metadata.unitCount,
    canonicalHash: fixture.metadata.canonicalHash,
  });
  process.stdout.write('LONGFORM_STRESS_PROGRESS:' + JSON.stringify({
    event: 'fixture-built',
    label: scenario.label,
    characterCount: fixture.metadata.characterCount,
    wordCount: fixture.metadata.wordCount,
    unitCount: fixture.metadata.unitCount,
  }) + '\\n');
  await setEditorPayload(win, fixture, scenario.label);
  const initialState = await waitForScenario(win, scenario, fixture.metadata.markerTokens);
  process.stdout.write('LONGFORM_STRESS_PROGRESS:' + JSON.stringify({
    event: 'scenario-stable',
    label: scenario.label,
    actualPageCount: initialState.centralSheetTotalPageCount,
    renderedSheetShellCount: initialState.renderedSheetShellCount,
    domNodeCount: initialState.domNodeCount,
  }) + '\\n');
  const markerScrolls = [];
  for (const markerName of markerNames) {
    process.stdout.write('LONGFORM_STRESS_PROGRESS:' + JSON.stringify({
      event: 'marker-scroll-start',
      label: scenario.label,
      markerName,
    }) + '\\n');
    markerScrolls.push(await scrollToMarker(win, markerName, fixture.metadata.markerTokens));
  }
  const afterScrollState = await collectState(win, scenario.label + '-after-marker-scrolls', fixture.metadata.markerTokens);
  let typing = null;
  if (scenario.runTyping) {
    await checkpoint('typing_start', { label: scenario.label });
    typing = await win.webContents.executeJavaScript(\`(() => {
      const host = document.querySelector('#editor.tiptap-host');
      const prose = host ? host.querySelector('.ProseMirror') : null;
      if (!prose) return { ok: false, reason: 'PROSEMIRROR_MISSING' };
      const hashString = (text) => {
        let hash = 2166136261;
        for (let index = 0; index < text.length; index += 1) {
          hash ^= text.charCodeAt(index);
          hash = Math.imul(hash, 16777619);
        }
        return String(hash >>> 0);
      };
      const range = document.createRange();
      range.selectNodeContents(prose);
      range.collapse(false);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      prose.focus();
      const focusOk = document.activeElement === prose || prose.contains(document.activeElement);
      const before = prose.textContent || '';
      const beforeTypeHash = hashString(before);
      const typeStart = Date.now();
      document.execCommand('insertText', false, ' LONGFORM_STRESS_TYPED_MARKER ');
      const afterType = prose.textContent || '';
      document.execCommand('undo');
      const afterUndo = prose.textContent || '';
      document.execCommand('redo');
      const afterRedo = prose.textContent || '';
      document.execCommand('undo');
      const afterCleanup = prose.textContent || '';
      return {
        focusResult: { ok: focusOk },
        typeMs: Date.now() - typeStart,
        beforeTypeHash,
        afterTypeHash: hashString(afterType),
        afterUndoHash: hashString(afterUndo),
        afterRedoHash: hashString(afterRedo),
        afterCleanupHash: hashString(afterCleanup),
        afterTypeLength: afterType.length,
        afterUndoLength: afterUndo.length,
        afterRedoLength: afterRedo.length,
        afterCleanupLength: afterCleanup.length,
        inserted: afterType.includes('LONGFORM_STRESS_TYPED_MARKER'),
        undone: afterUndo === before,
        redone: afterRedo.includes('LONGFORM_STRESS_TYPED_MARKER'),
        cleanupRestored: afterCleanup === before,
      };
    })()\`, true);
    await checkpoint('typing_done', {
      label: scenario.label,
      typeMs: typing.typeMs,
      undoRestored: typing.undone,
      redoRestored: typing.redone,
      cleanupRestored: typing.cleanupRestored,
    });
  }
  await checkpoint('text_hash_start', { label: scenario.label });
  const finalState = await collectState(win, scenario.label + '-final', fixture.metadata.markerTokens);
  await checkpoint('text_hash_done', {
    label: scenario.label,
    stable: finalState.textHash === initialState.textHash,
  });
  return {
    label: scenario.label,
    phase: scenario.phase,
    targetPageCount: scenario.targetPageCount,
    loadMs: Date.now() - loadStart,
    metadata: fixture.metadata,
    initialState,
    markerScrolls,
    afterScrollState,
    finalState,
    typing,
  };
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
    await fs.mkdir(outputDir, { recursive: true });
    await checkpoint('test_start', { targetPageCount });
    session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
      if (/^(https?|wss?):/u.test(String(details.url || ''))) {
        networkRequests += 1;
      }
      callback({ cancel: false });
    });
    const win = await waitForWindow();
    await waitForLoad(win);
    win.setContentSize(1920, 1110);
    await sleep(1200);
    await checkpoint('app_window_ready', { width: 1920, height: 1110 });
    const phaseA = await runScenario(win, { label: 'phase-a-500', phase: 'A', targetPageCount: 500, seed: 'S500', runTyping: false });
    const calibratedUnitCount = Math.ceil(
      phaseA.metadata.unitCount
      * (targetPageCount / Math.max(1, phaseA.initialState.centralSheetTotalPageCount))
      * 1.15
    );
    await checkpoint('phase_b_calibrated_unit_count', {
      phaseAPageCount: phaseA.initialState.centralSheetTotalPageCount,
      phaseAUnitCount: phaseA.metadata.unitCount,
      targetPageCount,
      calibratedUnitCount,
    });
    process.stdout.write('LONGFORM_STRESS_PROGRESS:' + JSON.stringify({
      event: 'phase-b-calibrated-unit-count',
      phaseAPageCount: phaseA.initialState.centralSheetTotalPageCount,
      phaseAUnitCount: phaseA.metadata.unitCount,
      calibratedUnitCount,
    }) + '\\n');
    const phaseB = await runScenario(win, {
      label: 'phase-b-' + String(targetPageCount),
      phase: 'B',
      targetPageCount,
      seed: 'S' + String(targetPageCount),
      unitCountOverride: calibratedUnitCount,
      runTyping: true,
    });
    const scenarios = [phaseA, phaseB];
    const payload = {
      ok: true,
      scenarios,
      networkRequests,
      dialogCalls,
      outputDir,
    };
    await checkpoint('result_write_start', { ok: true });
    await fs.writeFile(path.join(outputDir, 'result.json'), JSON.stringify(payload, null, 2));
    await checkpoint('result_write_done', { ok: true });
    await checkpoint('test_exit', { ok: true });
    process.stdout.write('EDITOR_SHEET_INSTRUMENTED_STRESS_RESULT:' + JSON.stringify(payload) + '\\n');
    app.exit(0);
  } catch (error) {
    const payload = {
      ok: false,
      error: error && error.stack ? error.stack : String(error),
      networkRequests,
      dialogCalls,
      outputDir,
    };
    await fs.mkdir(outputDir, { recursive: true });
    await checkpoint('result_write_start', { ok: false });
    await fs.writeFile(path.join(outputDir, 'result.json'), JSON.stringify(payload, null, 2));
    await checkpoint('result_write_done', { ok: false });
    await checkpoint('test_exit', { ok: false });
    process.stdout.write('EDITOR_SHEET_INSTRUMENTED_STRESS_RESULT:' + JSON.stringify(payload) + '\\n');
    app.exit(1);
  }
});
`;
}

function parseResult(stdout) {
  const line = String(stdout)
    .split(/\r?\n/u)
    .find((item) => item.startsWith('EDITOR_SHEET_INSTRUMENTED_STRESS_RESULT:'));
  assert.ok(line, 'instrumented stress smoke must emit result payload');
  return JSON.parse(line.slice('EDITOR_SHEET_INSTRUMENTED_STRESS_RESULT:'.length));
}

function assertScenario(scenario) {
  assert.equal(scenario.initialState.centralSheetFlow, 'vertical');
  assert.equal(scenario.initialState.proofClass, true);
  assert.equal(scenario.initialState.centralSheetWindowingEnabled, 'true');
  assert.equal(scenario.initialState.centralSheetTotalPageCount >= scenario.targetPageCount, true);
  assert.equal(scenario.initialState.centralSheetBoundedOverflowReason, 'max-page-count');
  assert.equal(scenario.initialState.centralSheetBoundedOverflowHiddenPageCount > 0, true);
  assert.equal(scenario.initialState.renderedSheetShellCount >= MIN_RENDERED_SHEET_WINDOW, true);
  assert.equal(scenario.initialState.renderedSheetShellCount <= MAX_RENDERED_SHEET_WINDOW, true);
  assert.equal(scenario.initialState.visibleSheetCount > 0, true);
  assert.equal(scenario.initialState.scrollTop <= 1, true, `${scenario.label} must start at the top after payload replacement`);
  assert.equal(scenario.initialState.centralSheetWindowFirstRenderedPage <= 2, true, `${scenario.label} must render the top sheet window after payload replacement`);
  assert.equal(scenario.initialState.proseMirrorCount, 1);
  assert.equal(scenario.initialState.tiptapEditorCount, 1);
  assert.equal(scenario.initialState.derivedSheetProseMirrorCount, 0);
  assert.equal(scenario.initialState.derivedSheetEditorCount, 0);
  assert.equal(scenario.initialState.prosePageTruthCount, 0);
  assert.equal(scenario.metadata.paragraphCount, 1);
  assert.equal(scenario.metadata.characterCount > 0, true);
  assert.equal(scenario.metadata.wordCount > 0, true);
  assert.equal(typeof scenario.metadata.canonicalHash, 'string');
  assert.equal(scenario.metadata.canonicalHash.length, 64);
  for (const markerName of markerNames) {
    assert.equal(scenario.initialState.marker[markerName].occurrenceCount, 1, `${scenario.label} ${markerName} occurrence`);
    const markerScroll = scenario.markerScrolls.find((item) => item.markerName === markerName);
    assert.ok(markerScroll, `${scenario.label} missing marker scroll ${markerName}`);
    assert.equal(markerScroll.scrollResult.ok, true, `${scenario.label} ${markerName} scroll`);
    assert.equal(markerScroll.after.visibleSheetCount > 0, true, `${scenario.label} ${markerName} visible sheets`);
    assert.equal(markerScroll.after.marker[markerName].visibleRectCount > 0, true, `${scenario.label} ${markerName} visible marker`);
  }
  assert.equal(scenario.finalState.textHash, scenario.initialState.textHash, `${scenario.label} final hash stable`);
  assert.equal(scenario.finalState.renderedSheetShellCount <= MAX_RENDERED_SHEET_WINDOW, true);
}

const helperPath = path.join(outputDir, `editor-sheet-${targetPageCount}-instrumented-stress-helper.cjs`);
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
  }, rowTimeoutMs);
  child.on('exit', (code) => {
    clearTimeout(timer);
    resolve(typeof code === 'number' ? code : 1);
  });
});

let payload = null;
try {
  payload = parseResult(stdout);
} catch {
  const resultPath = path.join(outputDir, 'result.json');
  try {
    payload = JSON.parse(await readFile(resultPath, 'utf8'));
  } catch {
    payload = {
      ok: false,
      error: 'RESULT_JSON_NOT_WRITTEN',
      stdout,
      stderr,
    };
  }
}

const parentResult = {
  ok: exitCode === 0 && payload && payload.ok === true,
  status: exitCode === 124 ? 'STOP_RESOURCE_LIMIT' : (exitCode === 0 ? 'CHILD_EXIT_OK' : 'CHILD_EXIT_FAILED'),
  targetPageCount,
  rowTimeoutMs,
  exitCode,
  outputDir,
  checkpointBasename: 'checkpoints.jsonl',
  resultBasename: 'result.json',
  stderrTail: stderr.slice(-4000),
  stdoutTail: stdout.slice(-4000),
};
await writeFile(parentResultPath, JSON.stringify(parentResult, null, 2), 'utf8');

if (exitCode === 124 && allowResourceStop) {
  const checkpoints = await readFile(checkpointPath, 'utf8').catch(() => '');
  assert.ok(checkpoints.trim().length > 0, 'resource stop must preserve at least one checkpoint');
  console.log('EDITOR_SHEET_INSTRUMENTED_STRESS_SUMMARY:' + JSON.stringify({
    ok: false,
    status: 'STOP_RESOURCE_LIMIT',
    targetPageCount,
    outputDir,
    checkpointCount: checkpoints.trim().split(/\r?\n/u).filter(Boolean).length,
  }));
  process.exit(0);
}

assert.equal(exitCode, 0, `electron helper failed with ${exitCode}\n${stdout}\n${stderr}`);
assert.equal(payload.ok, true, payload.error || 'LONGFORM_2000_PAGE_STRESS_FAILED');
assert.equal(payload.networkRequests, 0);
assert.equal(payload.dialogCalls, 0);
assert.equal(payload.scenarios.length, 2);

const phaseA = payload.scenarios.find((scenario) => scenario.phase === 'A');
const phaseB = payload.scenarios.find((scenario) => scenario.phase === 'B');
assert.ok(phaseA, 'phase A calibration scenario must exist');
assert.ok(phaseB, 'phase B stress scenario must exist');
assertScenario(phaseA);
assertScenario(phaseB);
assert.ok(phaseB.typing, 'phase B must include typing telemetry');
assert.equal(phaseB.typing.focusResult.ok, true);
assert.notEqual(phaseB.typing.afterTypeHash, phaseB.typing.beforeTypeHash);
assert.equal(phaseB.typing.afterUndoHash, phaseB.typing.beforeTypeHash);
assert.equal(phaseB.typing.afterRedoHash, phaseB.typing.afterTypeHash);
assert.equal(phaseB.typing.afterCleanupHash, phaseB.typing.beforeTypeHash);

const summary = {
  ok: true,
  outputDir,
  targetPageCount,
  parentResultBasename: 'parent-result.json',
  checkpointBasename: 'checkpoints.jsonl',
  scenarios: payload.scenarios.map((scenario) => ({
    label: scenario.label,
    targetPageCount: scenario.targetPageCount,
    actualPageCount: scenario.initialState.centralSheetTotalPageCount,
    renderedSheetShellCount: scenario.initialState.renderedSheetShellCount,
    hiddenPageCount: scenario.initialState.centralSheetBoundedOverflowHiddenPageCount,
    domNodeCount: scenario.initialState.domNodeCount,
    characterCount: scenario.metadata.characterCount,
    wordCount: scenario.metadata.wordCount,
    paragraphCount: scenario.metadata.paragraphCount,
    seed: scenario.metadata.seed,
    canonicalHash: scenario.metadata.canonicalHash,
    loadMs: scenario.loadMs,
    markerScrolls: scenario.markerScrolls.map((item) => ({
      markerName: item.markerName,
      scrollTop: item.scrollResult.scrollTop,
      visibleRectCount: item.after.marker[item.markerName].visibleRectCount,
      firstRenderedPage: item.after.centralSheetWindowFirstRenderedPage,
      lastRenderedPage: item.after.centralSheetWindowLastRenderedPage,
    })),
    textHashStable: scenario.finalState.textHash === scenario.initialState.textHash,
    typing: scenario.typing ? {
      typeMs: scenario.typing.typeMs,
      undoRestoredHash: scenario.typing.afterUndoHash === scenario.typing.beforeTypeHash,
      redoRestoredTypedHash: scenario.typing.afterRedoHash === scenario.typing.afterTypeHash,
      cleanupRestoredHash: scenario.typing.afterCleanupHash === scenario.typing.beforeTypeHash,
    } : null,
  })),
  networkRequests: payload.networkRequests,
  dialogCalls: payload.dialogCalls,
};

console.log('EDITOR_SHEET_INSTRUMENTED_STRESS_SUMMARY:' + JSON.stringify(summary));

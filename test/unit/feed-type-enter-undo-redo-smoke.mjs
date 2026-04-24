import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const rootDir = path.resolve(new URL('../..', import.meta.url).pathname);
const requireFromHere = createRequire(import.meta.url);
const electronBinary = requireFromHere('electron');
const outputDir = process.env.FEED_TYPE_ENTER_UNDO_REDO_OUT_DIR
  ? path.resolve(process.env.FEED_TYPE_ENTER_UNDO_REDO_OUT_DIR)
  : await mkdtemp(path.join(os.tmpdir(), '06a1-type-enter-undo-redo-'));

function hashText(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

function markerCount(text, marker) {
  return String(text).split(marker).length - 1;
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
  const sentence = 'Type enter undo redo proof paragraph for a derived central sheet feed over one Tiptap editor.';
  return Array.from({ length: paragraphCount }, (_, index) => (
    sentence + ' ' + String(index + 1) + '. ' + sentence + ' ' + sentence
  )).join('\\n\\n');
}

function primaryModifier() {
  return process.platform === 'darwin' ? 'meta' : 'control';
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
    title: 'feed-type-enter-undo-redo-smoke',
    path: '',
    kind: 'chapter-file',
    metaEnabled: true,
    projectId: 'feed-type-enter-undo-redo-smoke',
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
    const rightSidebar = document.querySelector('[data-right-sidebar]');
    const pageWraps = strip ? [...strip.querySelectorAll(':scope > .tiptap-page-wrap')] : [];
    const pageRects = pageWraps.map((el) => {
      const rect = el.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
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
      proofClass: Boolean(host && host.classList.contains('tiptap-host--central-sheet-strip-proof')),
      centralSheetFlow: host ? host.dataset.centralSheetFlow || null : null,
      centralSheetOverflowReason: host ? host.dataset.centralSheetOverflowReason || null : null,
      text: prose ? prose.textContent || '' : '',
      paragraphCount: prose ? prose.querySelectorAll('p').length : 0,
      visibleSheetCount: pageWraps.length,
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
      selectionInsideProse: prose.contains(selection.getRangeAt(0).commonAncestorContainer),
      proseMirrorCount: host.querySelectorAll('.ProseMirror').length,
      tiptapEditorCount: host.querySelectorAll('.tiptap-editor').length,
    };
  })()\`, true);
}

async function pressKey(win, keyCode, modifiers = []) {
  win.webContents.sendInputEvent({ type: 'keyDown', keyCode, modifiers });
  win.webContents.sendInputEvent({ type: 'keyUp', keyCode, modifiers });
}

async function findTwoSheetFixture(win) {
  let lastState = null;
  for (let paragraphCount = 1; paragraphCount <= 20; paragraphCount += 1) {
    await setEditorPayload(win, paragraphCount);
    await sleep(700);
    const state = await collectState(win, 'candidate-' + String(paragraphCount));
    lastState = state;
    if (
      state.centralSheetFlow === 'horizontal'
      && state.visibleSheetCount >= 2
      && state.proseMirrorCount === 1
      && state.tiptapEditorCount === 1
      && state.prosePageTruthCount === 0
    ) {
      return { paragraphCount, state };
    }
    if (state.centralSheetOverflowReason === 'max-page-count') {
      break;
    }
  }
  throw new Error('NO_TWO_SHEET_FIXTURE ' + JSON.stringify(lastState));
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

    const fixture = await findTwoSheetFixture(win);
    await setEditorPayload(win, fixture.paragraphCount);
    await sleep(800);
    const beforeInput = await collectState(win, 'before-input');
    const textHashBefore = require('node:crypto').createHash('sha256').update(beforeInput.text).digest('hex');
    await saveCapture(win, '06a1-before-input.png');

    const focus = await focusEditorEnd(win);
    await sleep(150);

    await win.webContents.insertText(' 06A1_A');
    await sleep(700);
    const afterMarkerA = await collectState(win, 'after-marker-a');

    await pressKey(win, 'Enter');
    await sleep(700);
    const afterEnter = await collectState(win, 'after-enter');

    await win.webContents.insertText('06A1_B');
    await sleep(700);
    const afterMarkerB = await collectState(win, 'after-marker-b');

    await pressKey(win, 'Z', [primaryModifier()]);
    await sleep(900);
    const afterUndo = await collectState(win, 'after-undo');

    await pressKey(win, 'Z', [primaryModifier(), 'shift']);
    await sleep(900);
    const afterRedo = await collectState(win, 'after-redo');
    await saveCapture(win, '06a1-after-redo.png');

    const payload = {
      ok: true,
      paragraphCount: fixture.paragraphCount,
      markerA: '06A1_A',
      markerB: '06A1_B',
      fixture: fixture.state,
      beforeInput,
      focus,
      afterMarkerA,
      afterEnter,
      afterMarkerB,
      afterUndo,
      afterRedo,
      textHashBefore,
      textHashAfterRedo: require('node:crypto').createHash('sha256').update(afterRedo.text).digest('hex'),
      networkRequests,
      dialogCalls,
      screenshots: [
        path.join(outputDir, '06a1-before-input.png'),
        path.join(outputDir, '06a1-after-redo.png'),
      ],
    };
    await fs.writeFile(path.join(outputDir, 'result.json'), JSON.stringify(payload, null, 2));
    process.stdout.write('FEED_TYPE_ENTER_UNDO_REDO_SMOKE_RESULT:' + JSON.stringify(payload) + '\\n');
    app.exit(0);
  } catch (error) {
    const payload = { ok: false, error: error && error.stack ? error.stack : String(error), networkRequests, dialogCalls };
    await fs.writeFile(path.join(outputDir, 'result.json'), JSON.stringify(payload, null, 2));
    process.stdout.write('FEED_TYPE_ENTER_UNDO_REDO_SMOKE_RESULT:' + JSON.stringify(payload) + '\\n');
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
  throw new Error(`Electron feed type enter undo redo smoke failed with exit ${exitCode}`);
}

const result = JSON.parse(await readFile(path.join(outputDir, 'result.json'), 'utf8'));
if (!result.ok) {
  throw new Error(result.error || 'Electron feed type enter undo redo smoke returned not ok');
}

const states = [
  result.beforeInput,
  result.afterMarkerA,
  result.afterEnter,
  result.afterMarkerB,
  result.afterUndo,
  result.afterRedo,
];

for (const state of states) {
  assert.equal(state.proseMirrorCount, 1, `${state.label} must keep one ProseMirror`);
  assert.equal(state.tiptapEditorCount, 1, `${state.label} must keep one Tiptap editor shell`);
  assert.equal(state.prosePageTruthCount, 0, `${state.label} must not create page truth inside ProseMirror`);
}

assert.equal(result.fixture.centralSheetFlow, 'horizontal', 'fixture must use central sheet horizontal flow');
assert.ok(result.beforeInput.visibleSheetCount >= 2, 'baseline text must show at least two visible sheets');
assert.ok(result.afterRedo.visibleSheetCount >= 2, 'state after redo must show at least two visible sheets');
assert.equal(result.focus.ok, true, 'focus setup must succeed');
assert.equal(result.focus.activeElementInsideProse, true, 'focus must start inside ProseMirror');
assert.equal(result.focus.selectionInsideProse, true, 'selection must start inside ProseMirror');
assert.equal(markerCount(result.afterMarkerA.text, result.markerA), 1, 'typed marker A must appear once');
assert.ok(
  result.afterEnter.paragraphCount > result.afterMarkerA.paragraphCount,
  'Enter must increase paragraph/block count'
);
assert.equal(markerCount(result.afterMarkerB.text, result.markerB), 1, 'typed marker B must appear once before undo');
assert.equal(markerCount(result.afterUndo.text, result.markerB), 0, 'undo must remove marker B');
assert.equal(markerCount(result.afterRedo.text, result.markerB), 1, 'redo must restore marker B');
assert.equal(markerCount(result.afterRedo.text, result.markerA), 1, 'redo state must preserve marker A once');
assert.equal(result.afterRedo.activeElementInsideProse, true, 'active element must remain inside ProseMirror after redo');
assert.equal(result.afterRedo.selectionInsideProse, true, 'selection must remain inside ProseMirror after redo');
assert.equal(result.afterRedo.rightInspectorVisible, true, 'right inspector must remain visible after redo');
assert.equal(result.networkRequests, 0, 'smoke must not trigger network requests');
assert.equal(result.dialogCalls, 0, 'smoke must not trigger dialogs');
assert.notEqual(
  hashText(result.beforeInput.text),
  hashText(result.afterRedo.text),
  'text hash should change only because the smoke typed controlled markers'
);

const summary = {
  outputDir,
  paragraphCount: result.paragraphCount,
  visibleSheetCountBefore: result.beforeInput.visibleSheetCount,
  visibleSheetCountAfterRedo: result.afterRedo.visibleSheetCount,
  proseMirrorCount: result.afterRedo.proseMirrorCount,
  tiptapEditorCount: result.afterRedo.tiptapEditorCount,
  prosePageTruthCount: result.afterRedo.prosePageTruthCount,
  paragraphCountAfterMarkerA: result.afterMarkerA.paragraphCount,
  paragraphCountAfterEnter: result.afterEnter.paragraphCount,
  markerAAfterRedo: markerCount(result.afterRedo.text, result.markerA),
  markerBAfterType: markerCount(result.afterMarkerB.text, result.markerB),
  markerBAfterUndo: markerCount(result.afterUndo.text, result.markerB),
  markerBAfterRedo: markerCount(result.afterRedo.text, result.markerB),
  activeElementInsideProse: result.afterRedo.activeElementInsideProse,
  selectionInsideProse: result.afterRedo.selectionInsideProse,
  rightInspectorVisible: result.afterRedo.rightInspectorVisible,
  networkRequests: result.networkRequests,
  dialogCalls: result.dialogCalls,
  screenshots: result.screenshots.map((item) => path.basename(item)),
};

process.stdout.write(`FEED_TYPE_ENTER_UNDO_REDO_SMOKE_SUMMARY:${JSON.stringify(summary)}\n`);

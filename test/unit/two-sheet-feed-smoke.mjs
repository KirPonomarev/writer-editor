import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const rootDir = path.resolve(new URL('../..', import.meta.url).pathname);
const requireFromHere = createRequire(import.meta.url);
const electronBinary = requireFromHere('electron');
const outputDir = process.env.TWO_SHEET_FEED_OUT_DIR
  ? path.resolve(process.env.TWO_SHEET_FEED_OUT_DIR)
  : await mkdtemp(path.join(os.tmpdir(), '05bz-a-two-sheet-feed-'));

function hashText(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

function buildHelperSource() {
  return `
const path = require('node:path');
const fs = require('node:fs/promises');
const { app, BrowserWindow, dialog, session } = require('electron');

const rootDir = ${JSON.stringify(rootDir)};
const outputDir = ${JSON.stringify(outputDir)};
let networkRequests = 0;
let dialogCalls = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildPlainText(paragraphCount) {
  const paragraph = 'Two sheet feed proof paragraph. This text must cross the first sheet boundary and continue on the second visible sheet while remaining inside one TipTap editor and one document truth.';
  return Array.from({ length: paragraphCount }, (_, index) => (
    paragraph + ' ' + String(index + 1) + '. ' + paragraph
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
    title: 'two-sheet-feed-smoke',
    path: '',
    kind: 'chapter-file',
    metaEnabled: true,
    projectId: 'two-sheet-feed-smoke',
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
    const firstPageRect = pageRects[0] || null;
    const secondPageRect = pageRects[1] || null;
    const rightSidebarRect = rightSidebar ? rightSidebar.getBoundingClientRect() : null;
    const walker = prose
      ? document.createTreeWalker(prose, NodeFilter.SHOW_TEXT, {
          acceptNode(node) {
            return node.textContent && node.textContent.trim()
              ? NodeFilter.FILTER_ACCEPT
              : NodeFilter.FILTER_SKIP;
          },
        })
      : null;
    const textNodes = [];
    if (walker) {
      let current = walker.nextNode();
      while (current) {
        textNodes.push(current);
        current = walker.nextNode();
      }
    }
    const textRects = [];
    textNodes.forEach((node) => {
      const range = document.createRange();
      range.selectNodeContents(node);
      [...range.getClientRects()].forEach((rect) => {
        textRects.push({ x: rect.x, y: rect.y, width: rect.width, height: rect.height });
      });
    });
    const occupiedSheetIndexes = new Set();
    pageRects.forEach((pageRect, pageIndex) => {
      if (textRects.some((rect) => (
        rect.x < pageRect.x + pageRect.width
        && rect.x + rect.width > pageRect.x
        && rect.y < pageRect.y + pageRect.height
        && rect.y + rect.height > pageRect.y
      ))) {
        occupiedSheetIndexes.add(pageIndex);
      }
    });
    const gapTextRects = firstPageRect && secondPageRect
      ? textRects.filter((rect) => (
          rect.x > firstPageRect.x + firstPageRect.width
          && rect.x + rect.width < secondPageRect.x
        ))
      : [];
    return {
      label: \${JSON.stringify(label)},
      proofClass: Boolean(host && host.classList.contains('tiptap-host--central-sheet-strip-proof')),
      centralSheetFlow: host ? host.dataset.centralSheetFlow || null : null,
      centralSheetOverflowReason: host ? host.dataset.centralSheetOverflowReason || null : null,
      text: prose ? prose.textContent || '' : '',
      visibleSheetCount: pageWraps.length,
      occupiedSheetCount: occupiedSheetIndexes.size,
      secondSheetVisible: Boolean(firstPageRect && secondPageRect && secondPageRect.x > firstPageRect.x + 24),
      gapTextRectsCount: gapTextRects.length,
      proseMirrorCount: host ? host.querySelectorAll('.ProseMirror').length : 0,
      tiptapEditorCount: host ? host.querySelectorAll('.tiptap-editor').length : 0,
      activeElementInsideProse: Boolean(prose && (document.activeElement === prose || prose.contains(document.activeElement))),
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
      proseMirrorCount: host.querySelectorAll('.ProseMirror').length,
    };
  })()\`, true);
}

async function findTwoSheetFixture(win) {
  let lastState = null;
  for (let paragraphCount = 1; paragraphCount <= 12; paragraphCount += 1) {
    await setEditorPayload(win, paragraphCount);
    await sleep(650);
    const state = await collectState(win, 'candidate-' + String(paragraphCount));
    lastState = state;
    if (
      state.centralSheetFlow === 'horizontal'
      && state.visibleSheetCount >= 2
      && state.occupiedSheetCount >= 2
      && state.secondSheetVisible
      && state.proseMirrorCount === 1
      && state.tiptapEditorCount === 1
      && state.gapTextRectsCount === 0
    ) {
      return { paragraphCount, state };
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
require(path.join(rootDir, 'src', 'main.js'));

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
    await saveCapture(win, '05bz-a-two-sheet-before-input.png');
    const focus = await focusEditorEnd(win);
    await win.webContents.insertText(' 05bzA');
    await sleep(800);
    const afterInput = await collectState(win, 'after-input');
    await saveCapture(win, '05bz-a-two-sheet-after-input.png');
    const payload = {
      ok: true,
      paragraphCount: fixture.paragraphCount,
      fixture: fixture.state,
      beforeInput,
      focus,
      afterInput,
      marker: '05bzA',
      networkRequests,
      dialogCalls,
      screenshots: [
        path.join(outputDir, '05bz-a-two-sheet-before-input.png'),
        path.join(outputDir, '05bz-a-two-sheet-after-input.png'),
      ],
    };
    await fs.writeFile(path.join(outputDir, 'result.json'), JSON.stringify(payload, null, 2));
    process.stdout.write('TWO_SHEET_FEED_SMOKE_RESULT:' + JSON.stringify(payload) + '\\n');
    app.exit(0);
  } catch (error) {
    const payload = { ok: false, error: error && error.stack ? error.stack : String(error), networkRequests, dialogCalls };
    await fs.writeFile(path.join(outputDir, 'result.json'), JSON.stringify(payload, null, 2));
    process.stdout.write('TWO_SHEET_FEED_SMOKE_RESULT:' + JSON.stringify(payload) + '\\n');
    app.exit(1);
  }
});
`;
}

const helperPath = path.join(outputDir, 'two-sheet-feed-helper.cjs');
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
  }, 45000);
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
assert.equal(result.fixture.visibleSheetCount >= 2, true);
assert.equal(result.fixture.occupiedSheetCount >= 2, true);
assert.equal(result.fixture.proseMirrorCount, 1);
assert.equal(result.fixture.tiptapEditorCount, 1);
assert.equal(result.fixture.secondSheetVisible, true);
assert.equal(result.fixture.gapTextRectsCount, 0);
assert.equal(result.beforeInput.visibleSheetCount >= 2, true);
assert.equal(result.beforeInput.proseMirrorCount, 1);
assert.equal(result.beforeInput.rightInspectorVisible, true);
assert.equal(hashText(result.beforeInput.text), hashText(result.fixture.text));
assert.equal(result.focus.ok, true);
assert.equal(result.focus.activeElementInsideProse, true);
assert.equal(result.afterInput.visibleSheetCount >= 2, true);
assert.equal(result.afterInput.proseMirrorCount, 1);
assert.equal(result.afterInput.tiptapEditorCount, 1);
assert.equal(result.afterInput.activeElementInsideProse, true);
assert.equal(result.afterInput.rightInspectorVisible, true);
assert.equal((result.afterInput.text.match(/05bzA/gu) || []).length, 1);
assert.equal(result.networkRequests, 0);
assert.equal(result.dialogCalls, 0);

const summary = {
  ok: true,
  outputDir,
  paragraphCount: result.paragraphCount,
  visibleSheetCount: result.afterInput.visibleSheetCount,
  occupiedSheetCount: result.afterInput.occupiedSheetCount,
  proseMirrorCount: result.afterInput.proseMirrorCount,
  tiptapEditorCount: result.afterInput.tiptapEditorCount,
  activeElementInsideProse: result.afterInput.activeElementInsideProse,
  rightInspectorVisible: result.afterInput.rightInspectorVisible,
  typedMarkerOccurrences: (result.afterInput.text.match(/05bzA/gu) || []).length,
  networkRequests: result.networkRequests,
  dialogCalls: result.dialogCalls,
  screenshots: result.screenshots,
};

console.log('TWO_SHEET_FEED_SMOKE_SUMMARY:' + JSON.stringify(summary));

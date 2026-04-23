const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { createRequire } = require('node:module');

const ROOT = path.resolve(__dirname, '..', '..');

function readFile(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function resolveElectronBinary() {
  const requireFromRoot = createRequire(path.join(ROOT, 'package.json'));
  return requireFromRoot('electron');
}

function writeHelperScript(tempDir) {
  const helperPath = path.join(tempDir, 'central-sheet-strip-proof-helper.js');
  const helperSource = `
const path = require('path');
const fs = require('fs/promises');
const { app, BrowserWindow } = require('electron');

const cleanRoot = process.env.CENTRAL_PROOF_ROOT;
const outDir = process.env.CENTRAL_PROOF_OUT_DIR;

if (!cleanRoot || !outDir) {
  console.error('CENTRAL_PROOF_ENV_MISSING');
  process.exit(2);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function buildPlainText(paragraphCount) {
  const paragraph = 'Это проверочный абзац для центральной ленты листов. Текст должен дойти до нижней границы первого листа и продолжиться на втором листе без второго редактора и без записи страниц в документную истину.';
  return Array.from({ length: paragraphCount }, (_, index) => (
    paragraph + ' ' + String(index + 1) + '. ' + paragraph
  )).join('\\n\\n');
}

async function setEditorPayload(win, paragraphCount) {
  win.webContents.send('editor:set-text', {
    content: buildPlainText(paragraphCount),
    title: 'central-sheet-strip-proof',
    path: '',
    kind: 'chapter-file',
    metaEnabled: true,
    projectId: 'central-sheet-strip-proof',
    bookProfile: null,
  });
}

async function clickAction(win, action) {
  return win.webContents.executeJavaScript(\`(() => {
    const button = document.querySelector('[data-action="\${action}"]');
    if (!button) return { ok: false, reason: 'BUTTON_MISSING', action: '\${action}' };
    button.click();
    return { ok: true, action: '\${action}' };
  })()\`, true);
}

async function collectState(win, label) {
  return win.webContents.executeJavaScript(\`(() => {
    const host = document.querySelector('#editor.tiptap-host');
    const strip = host ? host.querySelector('.tiptap-sheet-strip') : null;
    const pageWraps = strip ? [...strip.querySelectorAll(':scope > .tiptap-page-wrap')] : [];
    const directWrap = host ? host.querySelector(':scope > .tiptap-page-wrap') : null;
    const prose = host ? host.querySelector('.ProseMirror') : null;
    const tiptapEditor = host ? host.querySelector('.tiptap-editor') : null;
    const pageRects = pageWraps.map((el) => {
      const rect = el.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    });
    const firstPageRect = pageRects[0] || null;
    const secondPageRect = pageRects[1] || null;

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

    const lastNode = textNodes[textNodes.length - 1] || null;
    let lastTextRect = null;
    if (lastNode && lastNode.textContent.length > 0) {
      const range = document.createRange();
      range.setStart(lastNode, Math.max(0, lastNode.textContent.length - 1));
      range.setEnd(lastNode, lastNode.textContent.length);
      const rect = range.getBoundingClientRect();
      lastTextRect = { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    }

    return {
      label: ${JSON.stringify('runtime-state')},
      proofClass: Boolean(host && host.classList.contains('tiptap-host--central-sheet-strip-proof')),
      measuringClass: Boolean(host && host.classList.contains('tiptap-host--central-sheet-strip-measuring')),
      tiptapEditorCount: host ? host.querySelectorAll('.tiptap-editor').length : 0,
      proseMirrorCount: host ? host.querySelectorAll('.ProseMirror').length : 0,
      pageWrapCount: pageWraps.length,
      directWrapPresent: Boolean(directWrap),
      secondSheetVisible: Boolean(
        firstPageRect
        && secondPageRect
        && secondPageRect.x > firstPageRect.x + 24
      ),
      lastTextBeyondFirstSheet: Boolean(
        firstPageRect
        && lastTextRect
        && lastTextRect.x > firstPageRect.x + firstPageRect.width
      ),
      lastTextOnSecondSheet: Boolean(
        secondPageRect
        && lastTextRect
        && lastTextRect.x >= secondPageRect.x
        && lastTextRect.x <= secondPageRect.x + secondPageRect.width
      ),
      pageRects,
      lastTextRect,
      proseComputed: prose ? {
        columnWidth: getComputedStyle(prose).columnWidth,
        columnGap: getComputedStyle(prose).columnGap,
        overflowX: getComputedStyle(prose).overflowX,
        overflowY: getComputedStyle(prose).overflowY,
      } : null,
      scrollers: {
        hostScrollHeight: host ? host.scrollHeight : null,
        hostClientHeight: host ? host.clientHeight : null,
        proseScrollHeight: prose ? prose.scrollHeight : null,
        proseClientHeight: prose ? prose.clientHeight : null,
      },
      formatPressed: {
        A4: document.querySelector('[data-preview-format-option="A4"]')?.getAttribute('aria-pressed') || null,
        A5: document.querySelector('[data-preview-format-option="A5"]')?.getAttribute('aria-pressed') || null,
        Letter: document.querySelector('[data-preview-format-option="Letter"]')?.getAttribute('aria-pressed') || null,
      },
    };
  })()\`, true);
}

async function findTwoSheetFixture(win) {
  for (let paragraphCount = 1; paragraphCount <= 12; paragraphCount += 1) {
    await setEditorPayload(win, paragraphCount);
    await sleep(900);
    const state = await collectState(win, 'A4_' + String(paragraphCount));
    if (
      state.proofClass
      && state.pageWrapCount === 2
      && state.secondSheetVisible
      && state.lastTextBeyondFirstSheet
      && state.lastTextOnSecondSheet
    ) {
      return { paragraphCount, state };
    }
  }
  throw new Error('TWO_SHEET_FIXTURE_NOT_FOUND');
}

async function saveCapture(win, outDirPath, basename) {
  const image = await win.webContents.capturePage();
  await fs.writeFile(path.join(outDirPath, basename), image.toPNG());
}

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('force-device-scale-factor', '1');
app.commandLine.appendSwitch('high-dpi-support', '1');
app.setPath('userData', path.join(outDir, 'user-data'));
process.chdir(cleanRoot);
process.argv.push('--dev');
require(path.join(cleanRoot, 'src', 'main.js'));

app.whenReady().then(async () => {
  try {
    await fs.mkdir(outDir, { recursive: true });
    const win = await waitForWindow();
    await waitForLoad(win);
    win.setContentSize(2048, 1110);
    await sleep(1200);

    const fitted = await findTwoSheetFixture(win);
    const a4State = await collectState(win, 'A4');
    await saveCapture(win, outDir, 'central-a4.png');

    const a5Click = await clickAction(win, 'switch-preview-format-a5');
    await sleep(900);
    const a5State = await collectState(win, 'A5');
    await saveCapture(win, outDir, 'central-a5.png');

    const result = {
      paragraphCount: fitted.paragraphCount,
      a4State,
      a5Click,
      a5State,
    };
    await fs.writeFile(path.join(outDir, 'result.json'), JSON.stringify(result, null, 2));
    app.exit(0);
  } catch (error) {
    console.error(error && error.stack ? error.stack : String(error));
    app.exit(1);
  }
});
`;

  fs.writeFileSync(helperPath, helperSource, 'utf8');
  return helperPath;
}

function runProofHelper(t) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'craftsman-central-sheet-proof-'));
  t.after(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  const helperPath = writeHelperScript(tempDir);
  const electronBinary = resolveElectronBinary();
  const result = spawnSync(electronBinary, [helperPath], {
    cwd: ROOT,
    env: {
      ...process.env,
      CENTRAL_PROOF_ROOT: ROOT,
      CENTRAL_PROOF_OUT_DIR: tempDir,
    },
    encoding: 'utf8',
  });

  assert.equal(
    result.status,
    0,
    `helper failed\\nSTDOUT:\\n${result.stdout || ''}\\nSTDERR:\\n${result.stderr || ''}`,
  );

  const resultPath = path.join(tempDir, 'result.json');
  assert.equal(fs.existsSync(resultPath), true, 'result.json must be produced by helper');
  return JSON.parse(fs.readFileSync(resultPath, 'utf8'));
}

test('central sheet strip proof: renderer creates a real second central sheet without a second Tiptap', { timeout: 60000 }, (t) => {
  const result = runProofHelper(t);

  assert.ok(result.paragraphCount >= 1);

  assert.equal(result.a4State.proofClass, true);
  assert.equal(result.a4State.measuringClass, false);
  assert.equal(result.a4State.tiptapEditorCount, 1);
  assert.equal(result.a4State.proseMirrorCount, 1);
  assert.equal(result.a4State.directWrapPresent, true);
  assert.equal(result.a4State.pageWrapCount, 2);
  assert.equal(result.a4State.secondSheetVisible, true);
  assert.equal(result.a4State.lastTextBeyondFirstSheet, true);
  assert.equal(result.a4State.lastTextOnSecondSheet, true);
  assert.equal(result.a4State.scrollers.hostScrollHeight, result.a4State.scrollers.hostClientHeight);
  assert.equal(result.a4State.proseComputed.overflowX, 'hidden');
  assert.equal(result.a4State.proseComputed.overflowY, 'hidden');
  assert.equal(result.a4State.formatPressed.A4, 'true');

  assert.equal(result.a5Click.ok, true);
  assert.equal(result.a5State.proofClass, true);
  assert.equal(result.a5State.tiptapEditorCount, 1);
  assert.equal(result.a5State.proseMirrorCount, 1);
  assert.equal(result.a5State.secondSheetVisible, true);
  assert.equal(result.a5State.lastTextBeyondFirstSheet, true);
  assert.equal(result.a5State.formatPressed.A5, 'true');
  assert.ok(result.a5State.pageRects[0].width < result.a4State.pageRects[0].width);
  assert.ok(result.a5State.pageWrapCount >= result.a4State.pageWrapCount);
});

test('central sheet strip proof: source remains renderer-only and bounded', () => {
  const editorText = readFile('src/renderer/editor.js');
  const cssText = readFile('src/renderer/styles.css');

  assert.equal((editorText.match(/initTiptap\(/g) || []).length, 1);
  assert.ok(editorText.includes('const MAX_CENTRAL_SHEET_PROOF_PAGES = 5;'));
  assert.ok(editorText.includes('function clearCentralSheetStripProof() {'));
  assert.equal(editorText.includes("from '../derived/pageMapService.mjs'"), false);
  assert.equal(editorText.includes("from '../derived/layoutInvalidation.mjs'"), false);
  assert.equal(editorText.includes("from './layoutPreview.mjs'"), true);

  assert.ok(cssText.includes('#editor.tiptap-host.tiptap-host--central-sheet-strip-proof > .tiptap-page-wrap'));
  assert.ok(cssText.includes('.tiptap-sheet-strip > .tiptap-page-wrap'));
  assert.ok(cssText.includes('column-width: var(--central-sheet-content-width-px);'));
  assert.ok(cssText.includes('pointer-events: auto;'));
});

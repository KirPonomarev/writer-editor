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

function buildLongParagraphText() {
  const sentence = 'Это один длинный абзац для проверки границы горизонтальной ленты листов. ';
  return Array.from({ length: 420 }, () => sentence).join('');
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

async function setLongParagraphPayload(win) {
  win.webContents.send('editor:set-text', {
    content: buildLongParagraphText(),
    title: 'central-sheet-strip-proof-long-paragraph',
    path: '',
    kind: 'chapter-file',
    metaEnabled: true,
    projectId: 'central-sheet-strip-proof-long-paragraph',
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
    const canvas = document.querySelector('.main-content--editor');
    const host = document.querySelector('#editor.tiptap-host');
    const strip = host ? host.querySelector('.tiptap-sheet-strip') : null;
    const rightSidebar = document.querySelector('[data-right-sidebar]');
    const pageWraps = strip ? [...strip.querySelectorAll(':scope > .tiptap-page-wrap')] : [];
    const directWrap = host ? host.querySelector(':scope > .tiptap-page-wrap') : null;
    const prose = host ? host.querySelector('.ProseMirror') : null;
    const tiptapEditor = host ? host.querySelector('.tiptap-editor') : null;
    const firstPage = pageWraps[0] ? pageWraps[0].querySelector('.tiptap-page') : null;
    const pageRects = pageWraps.map((el) => {
      const rect = el.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    });
    const firstPageRect = pageRects[0] || null;
    const secondPageRect = pageRects[1] || null;
    const lastPageRect = pageRects[pageRects.length - 1] || null;
    const rightSidebarRect = rightSidebar ? rightSidebar.getBoundingClientRect() : null;
    const rootStyles = getComputedStyle(document.documentElement);
    const pageCssVars = {
      widthPx: parseFloat(rootStyles.getPropertyValue('--page-width-px')) || null,
      heightPx: parseFloat(rootStyles.getPropertyValue('--page-height-px')) || null,
      gapPx: parseFloat(rootStyles.getPropertyValue('--page-gap-px')) || null,
    };

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
    const textRects = [];
    textNodes.forEach((node) => {
      const fullRange = document.createRange();
      fullRange.selectNodeContents(node);
      [...fullRange.getClientRects()].forEach((rect) => {
        textRects.push({ x: rect.x, y: rect.y, width: rect.width, height: rect.height });
      });
    });
    if (lastNode && lastNode.textContent.length > 0) {
      const range = document.createRange();
      range.setStart(lastNode, Math.max(0, lastNode.textContent.length - 1));
      range.setEnd(lastNode, lastNode.textContent.length);
      const rect = range.getBoundingClientRect();
      lastTextRect = { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    }
    const gapTextRects = firstPageRect && secondPageRect
      ? textRects.filter((rect) => (
          rect.x > firstPageRect.x + firstPageRect.width
          && rect.x + rect.width < secondPageRect.x
        ))
      : [];
    const overflowTextRects = lastPageRect
      ? textRects.filter((rect) => (
          rect.x < pageRects[0].x
          || rect.x + rect.width > lastPageRect.x + lastPageRect.width + 1
          || rect.y < lastPageRect.y - 1
          || rect.y + rect.height > lastPageRect.y + lastPageRect.height + 1
        ))
      : [];
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

    return {
      label: ${JSON.stringify('runtime-state')},
      proofClass: Boolean(host && host.classList.contains('tiptap-host--central-sheet-strip-proof')),
      measuringClass: Boolean(host && host.classList.contains('tiptap-host--central-sheet-strip-measuring')),
      centralSheetFlow: host ? host.dataset.centralSheetFlow || null : null,
      centralSheetOverflowReason: host ? host.dataset.centralSheetOverflowReason || null : null,
      activeElementInsideProse: Boolean(
        prose
        && (document.activeElement === prose || prose.contains(document.activeElement))
      ),
      selectionInsideProse: Boolean(
        prose
        && window.getSelection()
        && prose.contains(window.getSelection().anchorNode)
        && prose.contains(window.getSelection().focusNode)
      ),
      proseText: prose ? prose.textContent || '' : '',
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
      lastTextOnLastSheet: Boolean(
        lastPageRect
        && lastTextRect
        && lastTextRect.x >= lastPageRect.x
        && lastTextRect.x <= lastPageRect.x + lastPageRect.width
      ),
      gapTextRectsCount: gapTextRects.length,
      overflowTextRectsCount: overflowTextRects.length,
      occupiedSheetCount: occupiedSheetIndexes.size,
      pageRects,
      pageGapPx: firstPageRect && secondPageRect
        ? Math.round((secondPageRect.x - (firstPageRect.x + firstPageRect.width)) * 100) / 100
        : null,
      pageCssVars,
      lastTextRect,
      proseComputed: prose ? {
        columnWidth: getComputedStyle(prose).columnWidth,
        columnGap: getComputedStyle(prose).columnGap,
        overflowX: getComputedStyle(prose).overflowX,
        overflowY: getComputedStyle(prose).overflowY,
      } : null,
      canvasComputed: canvas ? {
        backgroundColor: getComputedStyle(canvas).backgroundColor,
        backgroundImage: getComputedStyle(canvas).backgroundImage,
      } : null,
      hostComputed: host ? {
        backgroundColor: getComputedStyle(host).backgroundColor,
        backgroundImage: getComputedStyle(host).backgroundImage,
      } : null,
      firstPageComputed: firstPage ? {
        backgroundColor: getComputedStyle(firstPage).backgroundColor,
        borderTopColor: getComputedStyle(firstPage).borderTopColor,
        borderTopWidth: getComputedStyle(firstPage).borderTopWidth,
        boxShadow: getComputedStyle(firstPage).boxShadow,
      } : null,
      scrollers: {
        hostScrollHeight: host ? host.scrollHeight : null,
        hostClientHeight: host ? host.clientHeight : null,
        hostScrollWidth: host ? host.scrollWidth : null,
        hostClientWidth: host ? host.clientWidth : null,
        proseScrollHeight: prose ? prose.scrollHeight : null,
        proseClientHeight: prose ? prose.clientHeight : null,
      },
      rightSidebar: rightSidebarRect ? {
        width: rightSidebarRect.width,
        height: rightSidebarRect.height,
        x: rightSidebarRect.x,
        right: rightSidebarRect.right,
        visible: rightSidebarRect.width >= 280 && rightSidebarRect.right <= window.innerWidth + 1,
      } : null,
      formatPressed: {
        A4: document.querySelector('[data-preview-format-option="A4"]')?.getAttribute('aria-pressed') || null,
        A5: document.querySelector('[data-preview-format-option="A5"]')?.getAttribute('aria-pressed') || null,
        Letter: document.querySelector('[data-preview-format-option="LETTER"]')?.getAttribute('aria-pressed') || null,
      },
    };
  })()\`, true);
}

async function findHorizontalFixture(win) {
  let lastState = null;
  for (let paragraphCount = 1; paragraphCount <= 12; paragraphCount += 1) {
    await setEditorPayload(win, paragraphCount);
    await sleep(550);
    const state = await collectState(win, 'A4');
    lastState = state;
    if (
      state.centralSheetFlow === 'horizontal'
      && state.pageWrapCount === 2
      && state.gapTextRectsCount === 0
      && state.overflowTextRectsCount === 0
      && state.lastTextOnSecondSheet === true
    ) {
      return { paragraphCount, state };
    }
  }
  throw new Error('NO_HORIZONTAL_TWO_SHEET_FIXTURE ' + JSON.stringify(lastState));
}

async function placeCursorAtEditorEnd(win) {
  return win.webContents.executeJavaScript(\`(() => {
    const host = document.querySelector('#editor.tiptap-host');
    const prose = host ? host.querySelector('.ProseMirror') : null;
    if (!host || !prose) {
      return { ok: false, reason: 'EDITOR_MISSING' };
    }
    const walker = document.createTreeWalker(prose, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        return node.textContent && node.textContent.trim()
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_SKIP;
      },
    });
    let lastTextNode = null;
    let current = walker.nextNode();
    while (current) {
      lastTextNode = current;
      current = walker.nextNode();
    }
    const range = document.createRange();
    if (lastTextNode) {
      range.setStart(lastTextNode, lastTextNode.textContent.length);
      range.setEnd(lastTextNode, lastTextNode.textContent.length);
    } else {
      range.selectNodeContents(prose);
      range.collapse(false);
    }
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    prose.focus();
    return {
      ok: true,
      beforeText: prose.textContent || '',
      centralSheetFlow: host.dataset.centralSheetFlow || null,
      tiptapEditorCount: host.querySelectorAll('.tiptap-editor').length,
      proseMirrorCount: host.querySelectorAll('.ProseMirror').length,
      activeElementInsideProse: document.activeElement === prose || prose.contains(document.activeElement),
      selectionInsideProse: prose.contains(selection.anchorNode) && prose.contains(selection.focusNode),
    };
  })()\`, true);
}

async function runActiveInputSmoke(win) {
  const marker = ' input-smoke-04f';
  win.focus();
  await sleep(100);
  const before = await placeCursorAtEditorEnd(win);
  if (!before.ok) {
    return { marker, before, after: null };
  }
  await win.webContents.insertText(marker);
  await sleep(700);
  const after = await collectState(win, 'input-smoke');
  return { marker, before, after };
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

    const { paragraphCount, state: a4State } = await findHorizontalFixture(win);
    await saveCapture(win, outDir, 'central-a4.png');

    const inputSmoke = await runActiveInputSmoke(win);
    await setEditorPayload(win, paragraphCount);
    await sleep(900);

    const a5Click = await clickAction(win, 'switch-preview-format-a5');
    await sleep(900);
    const a5State = await collectState(win, 'A5');
    await saveCapture(win, outDir, 'central-a5.png');

    const letterClick = await clickAction(win, 'switch-preview-format-letter');
    await sleep(900);
    const letterState = await collectState(win, 'Letter');
    await saveCapture(win, outDir, 'central-letter.png');

    await setLongParagraphPayload(win);
    await sleep(900);
    const longParagraphState = await collectState(win, 'long-paragraph');

    const result = {
      paragraphCount,
      a4State,
      inputSmoke,
      a5Click,
      a5State,
      letterClick,
      letterState,
      longParagraphState,
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
  const a4WidthDrift = Math.abs(result.a4State.pageRects[0].width - result.a4State.pageCssVars.widthPx);
  const a4HeightDrift = Math.abs(result.a4State.pageRects[0].height - result.a4State.pageCssVars.heightPx);
  const a4GapDrift = Math.abs(result.a4State.pageGapPx - result.a4State.pageCssVars.gapPx);
  const a5WidthDrift = Math.abs(result.a5State.pageRects[0].width - result.a5State.pageCssVars.widthPx);
  const a5HeightDrift = Math.abs(result.a5State.pageRects[0].height - result.a5State.pageCssVars.heightPx);
  const a5GapDrift = Math.abs(result.a5State.pageGapPx - result.a5State.pageCssVars.gapPx);
  const letterWidthDrift = Math.abs(result.letterState.pageRects[0].width - result.letterState.pageCssVars.widthPx);
  const letterHeightDrift = Math.abs(result.letterState.pageRects[0].height - result.letterState.pageCssVars.heightPx);
  const letterGapDrift = Math.abs(result.letterState.pageGapPx - result.letterState.pageCssVars.gapPx);

  assert.ok(result.paragraphCount >= 1);
  assert.ok(result.paragraphCount <= 12);

  assert.equal(result.a4State.proofClass, true);
  assert.equal(result.a4State.measuringClass, false);
  assert.equal(result.a4State.centralSheetFlow, 'horizontal');
  assert.equal(result.a4State.centralSheetOverflowReason, null);
  assert.equal(result.a4State.tiptapEditorCount, 1);
  assert.equal(result.a4State.proseMirrorCount, 1);
  assert.equal(result.a4State.directWrapPresent, true);
  assert.equal(result.a4State.pageWrapCount, 2);
  assert.equal(result.a4State.secondSheetVisible, true);
  assert.equal(result.a4State.gapTextRectsCount, 0);
  assert.equal(result.a4State.overflowTextRectsCount, 0);
  assert.equal(result.a4State.occupiedSheetCount, 2);
  assert.equal(result.a4State.lastTextBeyondFirstSheet, true);
  assert.equal(result.a4State.lastTextOnSecondSheet, true);
  assert.equal(result.a4State.scrollers.hostScrollHeight, result.a4State.scrollers.hostClientHeight);
  assert.equal(result.a4State.scrollers.hostScrollWidth, result.a4State.scrollers.hostClientWidth);
  assert.equal(result.a4State.proseComputed.overflowX, 'hidden');
  assert.equal(result.a4State.proseComputed.overflowY, 'hidden');
  assert.equal(result.a4State.formatPressed.A4, 'true');
  assert.equal(result.a4State.rightSidebar.visible, true);
  assert.ok(result.a4State.rightSidebar.width >= 280);
  assert.ok(a4WidthDrift <= 1, `A4 page width drifted by ${a4WidthDrift}px`);
  assert.ok(a4HeightDrift <= 1, `A4 page height drifted by ${a4HeightDrift}px`);
  assert.ok(a4GapDrift <= 1, `A4 page gap drifted by ${a4GapDrift}px`);
  assert.equal(result.a4State.hostComputed.backgroundImage === 'none', false);
  assert.equal(result.a4State.firstPageComputed.borderTopWidth, '1px');
  assert.notEqual(result.a4State.firstPageComputed.borderTopColor, result.a4State.canvasComputed.backgroundColor);
  assert.notEqual(result.a4State.firstPageComputed.boxShadow, 'none');

  assert.equal(result.inputSmoke.before.ok, true);
  assert.equal(result.inputSmoke.before.centralSheetFlow, 'horizontal');
  assert.equal(result.inputSmoke.before.tiptapEditorCount, 1);
  assert.equal(result.inputSmoke.before.proseMirrorCount, 1);
  assert.equal(result.inputSmoke.before.activeElementInsideProse, true);
  assert.equal(result.inputSmoke.before.selectionInsideProse, true);
  assert.equal(result.inputSmoke.after.proofClass, true);
  assert.equal(result.inputSmoke.after.centralSheetFlow, 'horizontal');
  assert.equal(result.inputSmoke.after.tiptapEditorCount, 1);
  assert.equal(result.inputSmoke.after.proseMirrorCount, 1);
  assert.equal(result.inputSmoke.after.activeElementInsideProse, true);
  assert.equal(result.inputSmoke.after.selectionInsideProse, true);
  assert.equal(result.inputSmoke.after.proseText.includes(result.inputSmoke.marker), true);
  assert.ok(result.inputSmoke.after.proseText.length > result.inputSmoke.before.beforeText.length);
  assert.equal(result.inputSmoke.after.gapTextRectsCount, 0);
  assert.equal(result.inputSmoke.after.overflowTextRectsCount, 0);

  assert.equal(result.a5Click.ok, true);
  assert.equal(result.a5State.proofClass, true);
  assert.equal(result.a5State.centralSheetFlow, 'horizontal');
  assert.equal(result.a5State.tiptapEditorCount, 1);
  assert.equal(result.a5State.proseMirrorCount, 1);
  assert.equal(result.a5State.secondSheetVisible, true);
  assert.equal(result.a5State.gapTextRectsCount, 0);
  assert.equal(result.a5State.overflowTextRectsCount, 0);
  assert.equal(result.a5State.occupiedSheetCount, result.a5State.pageWrapCount);
  assert.equal(result.a5State.lastTextBeyondFirstSheet, true);
  assert.equal(result.a5State.lastTextOnLastSheet, true);
  assert.equal(result.a5State.formatPressed.A5, 'true');
  assert.equal(result.a5State.rightSidebar.visible, true);
  assert.ok(result.a5State.rightSidebar.width >= 280);
  assert.ok(result.a5State.pageRects[0].width < result.a4State.pageRects[0].width);
  assert.ok(result.a5State.pageWrapCount >= result.a4State.pageWrapCount);
  assert.ok(a5WidthDrift <= 1, `A5 page width drifted by ${a5WidthDrift}px`);
  assert.ok(a5HeightDrift <= 1, `A5 page height drifted by ${a5HeightDrift}px`);
  assert.ok(a5GapDrift <= 1, `A5 page gap drifted by ${a5GapDrift}px`);

  assert.equal(result.letterClick.ok, true);
  assert.equal(result.letterState.proofClass, true);
  assert.equal(result.letterState.centralSheetFlow, 'horizontal');
  assert.equal(result.letterState.tiptapEditorCount, 1);
  assert.equal(result.letterState.proseMirrorCount, 1);
  assert.equal(result.letterState.secondSheetVisible, true);
  assert.equal(result.letterState.gapTextRectsCount, 0);
  assert.equal(result.letterState.overflowTextRectsCount, 0);
  assert.equal(result.letterState.occupiedSheetCount, result.letterState.pageWrapCount);
  assert.equal(result.letterState.lastTextBeyondFirstSheet, true);
  assert.equal(result.letterState.lastTextOnLastSheet, true);
  assert.equal(result.letterState.rightSidebar.visible, true);
  assert.ok(result.letterState.rightSidebar.width >= 280);
  assert.equal(result.letterState.formatPressed.Letter, 'true');
  assert.ok(letterWidthDrift <= 1, `Letter page width drifted by ${letterWidthDrift}px`);
  assert.ok(letterHeightDrift <= 1, `Letter page height drifted by ${letterHeightDrift}px`);
  assert.ok(letterGapDrift <= 1, `Letter page gap drifted by ${letterGapDrift}px`);

  assert.equal(result.longParagraphState.proofClass, false);
  assert.equal(result.longParagraphState.centralSheetFlow, null);
  assert.equal(result.longParagraphState.centralSheetOverflowReason, 'max-page-count');
  assert.equal(result.longParagraphState.tiptapEditorCount, 1);
  assert.equal(result.longParagraphState.proseMirrorCount, 1);
  assert.equal(result.longParagraphState.pageWrapCount, 0);
});

test('central sheet strip proof: source remains renderer-only and bounded', () => {
  const editorText = readFile('src/renderer/editor.js');
  const cssText = readFile('src/renderer/styles.css');

  assert.equal((editorText.match(/initTiptap\(/g) || []).length, 1);
  assert.ok(editorText.includes('const MAX_CENTRAL_SHEET_PROOF_PAGES = 5;'));
  assert.ok(editorText.includes("editor.dataset.centralSheetFlow = 'horizontal';"));
  assert.ok(editorText.includes("clearCentralSheetStripProof({ overflowReason: 'max-page-count' });"));
  assert.equal(editorText.includes("from '../derived/pageMapService.mjs'"), false);
  assert.equal(editorText.includes("from '../derived/layoutInvalidation.mjs'"), false);
  assert.equal(editorText.includes("from './layoutPreview.mjs'"), true);

  assert.ok(cssText.includes('#editor.tiptap-host.tiptap-host--central-sheet-strip-proof > .tiptap-page-wrap'));
  assert.ok(cssText.includes('.tiptap-sheet-strip > .tiptap-page-wrap'));
  assert.ok(cssText.includes('column-width: var(--central-sheet-content-width-px);'));
  assert.ok(cssText.includes('pointer-events: auto;'));
});

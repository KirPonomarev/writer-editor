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
const { app, BrowserWindow, clipboard } = require('electron');

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
      proseParagraphCount: prose ? prose.querySelectorAll('p').length : 0,
      selectionCollapsed: Boolean(
        window.getSelection()
        && window.getSelection().rangeCount > 0
        && window.getSelection().isCollapsed
      ),
      selectionText: window.getSelection() ? window.getSelection().toString() : '',
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

async function sendFocusedEditorKey(win, keyCode, modifiers = []) {
  win.webContents.sendInputEvent({ type: 'keyDown', keyCode, modifiers });
  win.webContents.sendInputEvent({ type: 'keyUp', keyCode, modifiers });
  await sleep(200);
}

async function sendFocusedEditorUndo(win) {
  const modifier = process.platform === 'darwin' ? 'meta' : 'control';
  await sendFocusedEditorKey(win, 'Z', [modifier]);
}

async function sendFocusedEditorRedo(win) {
  const modifier = process.platform === 'darwin' ? 'meta' : 'control';
  const modifiers = process.platform === 'darwin' ? [modifier, 'shift'] : [modifier];
  await sendFocusedEditorKey(win, process.platform === 'darwin' ? 'Z' : 'Y', modifiers);
}

function isStateA(stateA, state, marker) {
  return Boolean(
    state
    && state.centralSheetFlow === 'horizontal'
    && state.activeElementInsideProse
    && state.selectionInsideProse
    && state.selectionCollapsed
    && state.proseMirrorCount === 1
    && state.tiptapEditorCount === 1
    && state.proseText === stateA.proseText
    && state.proseParagraphCount === stateA.proseParagraphCount
    && !state.proseText.includes(marker)
  );
}

function isStateB(stateB, state, marker) {
  return Boolean(
    state
    && state.centralSheetFlow === 'horizontal'
    && state.activeElementInsideProse
    && state.selectionInsideProse
    && state.selectionCollapsed
    && state.proseMirrorCount === 1
    && state.tiptapEditorCount === 1
    && state.proseText === stateB.proseText
    && state.proseParagraphCount === stateB.proseParagraphCount
    && state.proseText.includes(marker)
  );
}

async function runEnterUndoRedoSmoke(win) {
  const marker = ' enter-undo-redo-04g';
  win.focus();
  await sleep(100);
  const before = await placeCursorAtEditorEnd(win);
  const stateA = await collectState(win, 'enter-undo-redo-state-a');
  if (!before.ok) {
    return { marker, before, stateA, stateB: null, undoStates: [], redoStates: [] };
  }

  await sendFocusedEditorKey(win, 'Enter');
  await win.webContents.insertText(marker);
  await sleep(700);
  const stateB = await collectState(win, 'enter-undo-redo-state-b');

  const undoStates = [];
  let undoReachedStateA = false;
  for (let step = 0; step < 2 && !undoReachedStateA; step += 1) {
    await sendFocusedEditorUndo(win);
    await sleep(300);
    const state = await collectState(win, 'enter-undo-redo-undo-' + String(step + 1));
    undoStates.push(state);
    undoReachedStateA = isStateA(stateA, state, marker);
  }

  const redoStates = [];
  let redoReachedStateB = false;
  for (let step = 0; step < undoStates.length && !redoReachedStateB; step += 1) {
    await sendFocusedEditorRedo(win);
    await sleep(300);
    const state = await collectState(win, 'enter-undo-redo-redo-' + String(step + 1));
    redoStates.push(state);
    redoReachedStateB = isStateB(stateB, state, marker);
  }

  return {
    marker,
    before,
    stateA,
    stateB,
    undoStates,
    redoStates,
    undoReachedStateA,
    redoReachedStateB,
    undoStepCount: undoStates.length,
    redoStepCount: redoStates.length,
  };
}

async function selectFirstTextOccurrence(win, token) {
  return win.webContents.executeJavaScript(\`((token) => {
    const host = document.querySelector('#editor.tiptap-host');
    const prose = host ? host.querySelector('.ProseMirror') : null;
    if (!host || !prose) {
      return { ok: false, reason: 'EDITOR_MISSING' };
    }
    const walker = document.createTreeWalker(prose, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        return node.textContent && node.textContent.includes(token)
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_SKIP;
      },
    });
    const node = walker.nextNode();
    if (!node) {
      return { ok: false, reason: 'TOKEN_MISSING', token };
    }
    const start = node.textContent.indexOf(token);
    const range = document.createRange();
    range.setStart(node, start);
    range.setEnd(node, start + token.length);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    prose.focus();
    return {
      ok: true,
      token,
      beforeText: prose.textContent || '',
      selectionText: selection.toString(),
      centralSheetFlow: host.dataset.centralSheetFlow || null,
      tiptapEditorCount: host.querySelectorAll('.tiptap-editor').length,
      proseMirrorCount: host.querySelectorAll('.ProseMirror').length,
      activeElementInsideProse: document.activeElement === prose || prose.contains(document.activeElement),
      selectionInsideProse: prose.contains(selection.anchorNode) && prose.contains(selection.focusNode),
      selectionCollapsed: selection.isCollapsed,
    };
  })(\${JSON.stringify(token)})\`, true);
}

async function placeCaretInFirstTextOccurrence(win, token, offset) {
  return win.webContents.executeJavaScript(\`((token, offset) => {
    const host = document.querySelector('#editor.tiptap-host');
    const prose = host ? host.querySelector('.ProseMirror') : null;
    if (!host || !prose) {
      return { ok: false, reason: 'EDITOR_MISSING' };
    }
    const walker = document.createTreeWalker(prose, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        return node.textContent && node.textContent.includes(token)
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_SKIP;
      },
    });
    const node = walker.nextNode();
    if (!node) {
      return { ok: false, reason: 'TOKEN_MISSING', token };
    }
    const start = node.textContent.indexOf(token);
    const caretOffset = start + offset;
    const range = document.createRange();
    range.setStart(node, caretOffset);
    range.setEnd(node, caretOffset);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    prose.focus();
    return {
      ok: true,
      token,
      offset,
      beforeText: prose.textContent || '',
      centralSheetFlow: host.dataset.centralSheetFlow || null,
      tiptapEditorCount: host.querySelectorAll('.tiptap-editor').length,
      proseMirrorCount: host.querySelectorAll('.ProseMirror').length,
      activeElementInsideProse: document.activeElement === prose || prose.contains(document.activeElement),
      selectionInsideProse: prose.contains(selection.anchorNode) && prose.contains(selection.focusNode),
      selectionCollapsed: selection.isCollapsed,
    };
  })(\${JSON.stringify(token)}, \${JSON.stringify(offset)})\`, true);
}

async function runSelectionReplaceSmoke(win) {
  const selectedToken = 'проверочный';
  const replacementToken = 'замененный-04h';
  win.focus();
  await sleep(100);
  const before = await selectFirstTextOccurrence(win, selectedToken);
  if (!before.ok) {
    return { selectedToken, replacementToken, before, after: null };
  }
  await win.webContents.insertText(replacementToken);
  await sleep(700);
  const after = await collectState(win, 'selection-replace-smoke');
  return { selectedToken, replacementToken, before, after };
}

async function runSmallPasteSmoke(win) {
  const selectedToken = 'проверочный';
  const stateAToken = 'alpha--omega';
  const pastePayload = 'paste-04i';
  const expectedFragment = 'alpha-paste-04i-omega';
  win.focus();
  await sleep(100);
  const seedSelection = await selectFirstTextOccurrence(win, selectedToken);
  if (!seedSelection.ok) {
    return {
      selectedToken,
      stateAToken,
      pastePayload,
      expectedFragment,
      seedSelection,
      caret: null,
      pasteResult: null,
      stateA: null,
      stateB: null,
    };
  }

  await win.webContents.insertText(stateAToken);
  await sleep(350);
  const caret = await placeCaretInFirstTextOccurrence(win, stateAToken, 'alpha-'.length);
  const stateA = await collectState(win, 'small-paste-state-a');
  if (!caret.ok) {
    return {
      selectedToken,
      stateAToken,
      pastePayload,
      expectedFragment,
      seedSelection,
      caret,
      pasteResult: null,
      stateA,
      stateB: null,
    };
  }

  clipboard.writeText(pastePayload);
  let pasteResult = null;
  if (typeof win.webContents.paste === 'function') {
    win.webContents.paste();
    pasteResult = { ok: true, method: 'webContents.paste' };
  } else {
    pasteResult = { ok: false, reason: 'WEB_CONTENTS_PASTE_MISSING' };
  }
  await sleep(700);
  const stateB = await collectState(win, 'small-paste-state-b');
  return {
    selectedToken,
    stateAToken,
    pastePayload,
    expectedFragment,
    seedSelection,
    caret,
    pasteResult,
    stateA,
    stateB,
  };
}

async function runBackspaceSmoke(win) {
  const selectedToken = 'проверочный';
  const stateAToken = 'abcXYZ';
  const expectedFragment = 'abcYZ';
  win.focus();
  await sleep(100);
  const seedSelection = await selectFirstTextOccurrence(win, selectedToken);
  if (!seedSelection.ok) {
    return {
      selectedToken,
      stateAToken,
      expectedFragment,
      seedSelection,
      caret: null,
      stateA: null,
      stateB: null,
    };
  }

  await win.webContents.insertText(stateAToken);
  await sleep(350);
  const caret = await placeCaretInFirstTextOccurrence(win, stateAToken, 'abcX'.length);
  const stateA = await collectState(win, 'backspace-state-a');
  if (!caret.ok) {
    return {
      selectedToken,
      stateAToken,
      expectedFragment,
      seedSelection,
      caret,
      stateA,
      stateB: null,
    };
  }

  await sendFocusedEditorKey(win, 'Backspace');
  await sleep(700);
  const stateB = await collectState(win, 'backspace-state-b');
  return {
    selectedToken,
    stateAToken,
    expectedFragment,
    seedSelection,
    caret,
    stateA,
    stateB,
  };
}

async function runDeleteKeySmoke(win) {
  const stateAToken = 'k04DeleteProbe_abcXYZ';
  const expectedFragment = 'k04DeleteProbe_abcXZ';
  win.focus();
  await sleep(100);
  const insertionPoint = await placeCursorAtEditorEnd(win);
  if (!insertionPoint.ok) {
    return {
      stateAToken,
      expectedFragment,
      insertionPoint,
      caret: null,
      stateA: null,
      stateB: null,
    };
  }

  await win.webContents.insertText(' ' + stateAToken);
  await sleep(350);
  const caret = await placeCaretInFirstTextOccurrence(win, stateAToken, 'k04DeleteProbe_abcX'.length);
  const stateA = await collectState(win, 'delete-key-state-a');
  if (!caret.ok) {
    return {
      stateAToken,
      expectedFragment,
      insertionPoint,
      caret,
      stateA,
      stateB: null,
    };
  }

  await sendFocusedEditorKey(win, 'Delete');
  await sleep(700);
  const stateB = await collectState(win, 'delete-key-state-b');
  return {
    stateAToken,
    expectedFragment,
    insertionPoint,
    caret,
    stateA,
    stateB,
  };
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

    const enterUndoRedoSmoke = await runEnterUndoRedoSmoke(win);
    await setEditorPayload(win, paragraphCount);
    await sleep(900);

    const selectionReplaceSmoke = await runSelectionReplaceSmoke(win);
    await setEditorPayload(win, paragraphCount);
    await sleep(900);

    const smallPasteSmoke = await runSmallPasteSmoke(win);
    await setEditorPayload(win, paragraphCount);
    await sleep(900);

    const backspaceSmoke = await runBackspaceSmoke(win);
    await setEditorPayload(win, paragraphCount);
    await sleep(900);

    const deleteKeySmoke = await runDeleteKeySmoke(win);
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
      enterUndoRedoSmoke,
      selectionReplaceSmoke,
      smallPasteSmoke,
      backspaceSmoke,
      deleteKeySmoke,
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

  assert.equal(result.enterUndoRedoSmoke.before.ok, true);
  assert.equal(result.enterUndoRedoSmoke.stateA.centralSheetFlow, 'horizontal');
  assert.equal(result.enterUndoRedoSmoke.stateA.tiptapEditorCount, 1);
  assert.equal(result.enterUndoRedoSmoke.stateA.proseMirrorCount, 1);
  assert.equal(result.enterUndoRedoSmoke.stateA.activeElementInsideProse, true);
  assert.equal(result.enterUndoRedoSmoke.stateA.selectionInsideProse, true);
  assert.equal(result.enterUndoRedoSmoke.stateA.selectionCollapsed, true);
  assert.equal(result.enterUndoRedoSmoke.stateA.proseText.includes(result.enterUndoRedoSmoke.marker), false);
  assert.equal(result.enterUndoRedoSmoke.stateB.centralSheetFlow, 'horizontal');
  assert.equal(result.enterUndoRedoSmoke.stateB.tiptapEditorCount, 1);
  assert.equal(result.enterUndoRedoSmoke.stateB.proseMirrorCount, 1);
  assert.equal(result.enterUndoRedoSmoke.stateB.activeElementInsideProse, true);
  assert.equal(result.enterUndoRedoSmoke.stateB.selectionInsideProse, true);
  assert.equal(result.enterUndoRedoSmoke.stateB.selectionCollapsed, true);
  assert.equal(result.enterUndoRedoSmoke.stateB.proseText.includes(result.enterUndoRedoSmoke.marker), true);
  assert.ok(result.enterUndoRedoSmoke.stateB.proseText.length > result.enterUndoRedoSmoke.stateA.proseText.length);
  assert.ok(result.enterUndoRedoSmoke.stateB.proseParagraphCount > result.enterUndoRedoSmoke.stateA.proseParagraphCount);
  assert.equal(result.enterUndoRedoSmoke.stateB.gapTextRectsCount, 0);
  assert.equal(result.enterUndoRedoSmoke.stateB.overflowTextRectsCount, 0);
  assert.ok(result.enterUndoRedoSmoke.undoStepCount >= 1);
  assert.ok(result.enterUndoRedoSmoke.undoStepCount <= 2);
  assert.equal(result.enterUndoRedoSmoke.undoReachedStateA, true);
  const undoStateA = result.enterUndoRedoSmoke.undoStates[result.enterUndoRedoSmoke.undoStates.length - 1];
  assert.equal(undoStateA.centralSheetFlow, 'horizontal');
  assert.equal(undoStateA.tiptapEditorCount, 1);
  assert.equal(undoStateA.proseMirrorCount, 1);
  assert.equal(undoStateA.activeElementInsideProse, true);
  assert.equal(undoStateA.selectionInsideProse, true);
  assert.equal(undoStateA.selectionCollapsed, true);
  assert.equal(undoStateA.proseText, result.enterUndoRedoSmoke.stateA.proseText);
  assert.equal(undoStateA.proseParagraphCount, result.enterUndoRedoSmoke.stateA.proseParagraphCount);
  assert.equal(undoStateA.proseText.includes(result.enterUndoRedoSmoke.marker), false);
  assert.equal(undoStateA.gapTextRectsCount, 0);
  assert.equal(undoStateA.overflowTextRectsCount, 0);
  assert.equal(result.enterUndoRedoSmoke.redoStepCount, result.enterUndoRedoSmoke.undoStepCount);
  assert.equal(result.enterUndoRedoSmoke.redoReachedStateB, true);
  const redoStateB = result.enterUndoRedoSmoke.redoStates[result.enterUndoRedoSmoke.redoStates.length - 1];
  assert.equal(redoStateB.centralSheetFlow, 'horizontal');
  assert.equal(redoStateB.tiptapEditorCount, 1);
  assert.equal(redoStateB.proseMirrorCount, 1);
  assert.equal(redoStateB.activeElementInsideProse, true);
  assert.equal(redoStateB.selectionInsideProse, true);
  assert.equal(redoStateB.selectionCollapsed, true);
  assert.equal(redoStateB.proseText, result.enterUndoRedoSmoke.stateB.proseText);
  assert.equal(redoStateB.proseParagraphCount, result.enterUndoRedoSmoke.stateB.proseParagraphCount);
  assert.equal(redoStateB.proseText.includes(result.enterUndoRedoSmoke.marker), true);
  assert.equal(redoStateB.gapTextRectsCount, 0);
  assert.equal(redoStateB.overflowTextRectsCount, 0);

  assert.equal(result.selectionReplaceSmoke.before.ok, true);
  assert.equal(result.selectionReplaceSmoke.before.centralSheetFlow, 'horizontal');
  assert.equal(result.selectionReplaceSmoke.before.tiptapEditorCount, 1);
  assert.equal(result.selectionReplaceSmoke.before.proseMirrorCount, 1);
  assert.equal(result.selectionReplaceSmoke.before.activeElementInsideProse, true);
  assert.equal(result.selectionReplaceSmoke.before.selectionInsideProse, true);
  assert.equal(result.selectionReplaceSmoke.before.selectionCollapsed, false);
  assert.equal(result.selectionReplaceSmoke.before.selectionText, result.selectionReplaceSmoke.selectedToken);
  assert.equal(result.selectionReplaceSmoke.before.beforeText.includes(result.selectionReplaceSmoke.selectedToken), true);
  assert.equal(result.selectionReplaceSmoke.before.beforeText.includes(result.selectionReplaceSmoke.replacementToken), false);
  assert.equal(result.selectionReplaceSmoke.after.centralSheetFlow, 'horizontal');
  assert.equal(result.selectionReplaceSmoke.after.tiptapEditorCount, 1);
  assert.equal(result.selectionReplaceSmoke.after.proseMirrorCount, 1);
  assert.equal(result.selectionReplaceSmoke.after.activeElementInsideProse, true);
  assert.equal(result.selectionReplaceSmoke.after.selectionInsideProse, true);
  assert.equal(result.selectionReplaceSmoke.after.selectionCollapsed, true);
  assert.equal(result.selectionReplaceSmoke.after.proseText.includes(result.selectionReplaceSmoke.replacementToken), true);
  assert.equal(result.selectionReplaceSmoke.after.proseText.length, (
    result.selectionReplaceSmoke.before.beforeText.length
    - result.selectionReplaceSmoke.selectedToken.length
    + result.selectionReplaceSmoke.replacementToken.length
  ));
  assert.equal(result.selectionReplaceSmoke.after.proseText.includes('центральной ленты листов'), true);
  assert.equal(result.selectionReplaceSmoke.after.proseText.includes('без второго редактора'), true);
  assert.equal(result.selectionReplaceSmoke.after.gapTextRectsCount, 0);
  assert.equal(result.selectionReplaceSmoke.after.overflowTextRectsCount, 0);

  assert.equal(result.smallPasteSmoke.seedSelection.ok, true);
  assert.equal(result.smallPasteSmoke.seedSelection.centralSheetFlow, 'horizontal');
  assert.equal(result.smallPasteSmoke.seedSelection.tiptapEditorCount, 1);
  assert.equal(result.smallPasteSmoke.seedSelection.proseMirrorCount, 1);
  assert.equal(result.smallPasteSmoke.seedSelection.activeElementInsideProse, true);
  assert.equal(result.smallPasteSmoke.seedSelection.selectionInsideProse, true);
  assert.equal(result.smallPasteSmoke.seedSelection.selectionCollapsed, false);
  assert.equal(result.smallPasteSmoke.caret.ok, true);
  assert.equal(result.smallPasteSmoke.caret.centralSheetFlow, 'horizontal');
  assert.equal(result.smallPasteSmoke.caret.tiptapEditorCount, 1);
  assert.equal(result.smallPasteSmoke.caret.proseMirrorCount, 1);
  assert.equal(result.smallPasteSmoke.caret.activeElementInsideProse, true);
  assert.equal(result.smallPasteSmoke.caret.selectionInsideProse, true);
  assert.equal(result.smallPasteSmoke.caret.selectionCollapsed, true);
  assert.equal(result.smallPasteSmoke.pasteResult.ok, true);
  assert.equal(result.smallPasteSmoke.stateA.centralSheetFlow, 'horizontal');
  assert.equal(result.smallPasteSmoke.stateA.tiptapEditorCount, 1);
  assert.equal(result.smallPasteSmoke.stateA.proseMirrorCount, 1);
  assert.equal(result.smallPasteSmoke.stateA.activeElementInsideProse, true);
  assert.equal(result.smallPasteSmoke.stateA.selectionInsideProse, true);
  assert.equal(result.smallPasteSmoke.stateA.selectionCollapsed, true);
  assert.equal(result.smallPasteSmoke.stateA.proseText.includes(result.smallPasteSmoke.stateAToken), true);
  assert.equal(result.smallPasteSmoke.stateA.proseText.includes(result.smallPasteSmoke.pastePayload), false);
  assert.equal(result.smallPasteSmoke.stateA.proseText.includes('центральной ленты листов'), true);
  assert.equal(result.smallPasteSmoke.stateA.gapTextRectsCount, 0);
  assert.equal(result.smallPasteSmoke.stateA.overflowTextRectsCount, 0);
  assert.equal(result.smallPasteSmoke.stateB.centralSheetFlow, 'horizontal');
  assert.equal(result.smallPasteSmoke.stateB.tiptapEditorCount, 1);
  assert.equal(result.smallPasteSmoke.stateB.proseMirrorCount, 1);
  assert.equal(result.smallPasteSmoke.stateB.activeElementInsideProse, true);
  assert.equal(result.smallPasteSmoke.stateB.selectionInsideProse, true);
  assert.equal(result.smallPasteSmoke.stateB.selectionCollapsed, true);
  assert.equal(result.smallPasteSmoke.stateB.proseText.includes(result.smallPasteSmoke.expectedFragment), true);
  assert.equal(result.smallPasteSmoke.stateB.proseText.includes(result.smallPasteSmoke.stateAToken), false);
  assert.equal(
    result.smallPasteSmoke.stateB.proseText.length,
    result.smallPasteSmoke.stateA.proseText.length + result.smallPasteSmoke.pastePayload.length,
  );
  assert.equal(result.smallPasteSmoke.stateB.proseText.includes('центральной ленты листов'), true);
  assert.equal(result.smallPasteSmoke.stateB.proseText.includes('без второго редактора'), true);
  assert.equal(result.smallPasteSmoke.stateB.gapTextRectsCount, 0);
  assert.equal(result.smallPasteSmoke.stateB.overflowTextRectsCount, 0);

  assert.equal(result.backspaceSmoke.seedSelection.ok, true);
  assert.equal(result.backspaceSmoke.seedSelection.centralSheetFlow, 'horizontal');
  assert.equal(result.backspaceSmoke.seedSelection.tiptapEditorCount, 1);
  assert.equal(result.backspaceSmoke.seedSelection.proseMirrorCount, 1);
  assert.equal(result.backspaceSmoke.seedSelection.activeElementInsideProse, true);
  assert.equal(result.backspaceSmoke.seedSelection.selectionInsideProse, true);
  assert.equal(result.backspaceSmoke.seedSelection.selectionCollapsed, false);
  assert.equal(result.backspaceSmoke.caret.ok, true);
  assert.equal(result.backspaceSmoke.caret.centralSheetFlow, 'horizontal');
  assert.equal(result.backspaceSmoke.caret.tiptapEditorCount, 1);
  assert.equal(result.backspaceSmoke.caret.proseMirrorCount, 1);
  assert.equal(result.backspaceSmoke.caret.activeElementInsideProse, true);
  assert.equal(result.backspaceSmoke.caret.selectionInsideProse, true);
  assert.equal(result.backspaceSmoke.caret.selectionCollapsed, true);
  assert.equal(result.backspaceSmoke.stateA.centralSheetFlow, 'horizontal');
  assert.equal(result.backspaceSmoke.stateA.tiptapEditorCount, 1);
  assert.equal(result.backspaceSmoke.stateA.proseMirrorCount, 1);
  assert.equal(result.backspaceSmoke.stateA.activeElementInsideProse, true);
  assert.equal(result.backspaceSmoke.stateA.selectionInsideProse, true);
  assert.equal(result.backspaceSmoke.stateA.selectionCollapsed, true);
  assert.equal(result.backspaceSmoke.stateA.proseText.includes(result.backspaceSmoke.stateAToken), true);
  assert.equal(result.backspaceSmoke.stateA.proseText.includes(result.backspaceSmoke.expectedFragment), false);
  assert.equal(result.backspaceSmoke.stateA.gapTextRectsCount, 0);
  assert.equal(result.backspaceSmoke.stateA.overflowTextRectsCount, 0);
  assert.equal(result.backspaceSmoke.stateB.centralSheetFlow, 'horizontal');
  assert.equal(result.backspaceSmoke.stateB.tiptapEditorCount, 1);
  assert.equal(result.backspaceSmoke.stateB.proseMirrorCount, 1);
  assert.equal(result.backspaceSmoke.stateB.activeElementInsideProse, true);
  assert.equal(result.backspaceSmoke.stateB.selectionInsideProse, true);
  assert.equal(result.backspaceSmoke.stateB.selectionCollapsed, true);
  assert.equal(result.backspaceSmoke.stateB.proseText.includes(result.backspaceSmoke.expectedFragment), true);
  assert.equal(result.backspaceSmoke.stateB.proseText.includes(result.backspaceSmoke.stateAToken), false);
  assert.equal(
    result.backspaceSmoke.stateB.proseText.length,
    result.backspaceSmoke.stateA.proseText.length - 1,
  );
  assert.equal(result.backspaceSmoke.stateB.proseText.includes('центральной ленты листов'), true);
  assert.equal(result.backspaceSmoke.stateB.proseText.includes('без второго редактора'), true);
  assert.equal(result.backspaceSmoke.stateB.gapTextRectsCount, 0);
  assert.equal(result.backspaceSmoke.stateB.overflowTextRectsCount, 0);

  assert.equal(result.deleteKeySmoke.insertionPoint.ok, true);
  assert.equal(result.deleteKeySmoke.insertionPoint.centralSheetFlow, 'horizontal');
  assert.equal(result.deleteKeySmoke.insertionPoint.tiptapEditorCount, 1);
  assert.equal(result.deleteKeySmoke.insertionPoint.proseMirrorCount, 1);
  assert.equal(result.deleteKeySmoke.insertionPoint.activeElementInsideProse, true);
  assert.equal(result.deleteKeySmoke.insertionPoint.selectionInsideProse, true);
  assert.equal(result.deleteKeySmoke.caret.ok, true);
  assert.equal(result.deleteKeySmoke.caret.centralSheetFlow, 'horizontal');
  assert.equal(result.deleteKeySmoke.caret.tiptapEditorCount, 1);
  assert.equal(result.deleteKeySmoke.caret.proseMirrorCount, 1);
  assert.equal(result.deleteKeySmoke.caret.activeElementInsideProse, true);
  assert.equal(result.deleteKeySmoke.caret.selectionInsideProse, true);
  assert.equal(result.deleteKeySmoke.caret.selectionCollapsed, true);
  assert.equal(result.deleteKeySmoke.stateA.centralSheetFlow, 'horizontal');
  assert.equal(result.deleteKeySmoke.stateA.tiptapEditorCount, 1);
  assert.equal(result.deleteKeySmoke.stateA.proseMirrorCount, 1);
  assert.equal(result.deleteKeySmoke.stateA.activeElementInsideProse, true);
  assert.equal(result.deleteKeySmoke.stateA.selectionInsideProse, true);
  assert.equal(result.deleteKeySmoke.stateA.selectionCollapsed, true);
  assert.equal(
    result.deleteKeySmoke.stateA.proseText.split(result.deleteKeySmoke.stateAToken).length - 1,
    1,
  );
  assert.equal(
    result.deleteKeySmoke.stateA.proseText.split(result.deleteKeySmoke.expectedFragment).length - 1,
    0,
  );
  assert.equal(result.deleteKeySmoke.stateB.centralSheetFlow, 'horizontal');
  assert.equal(result.deleteKeySmoke.stateB.tiptapEditorCount, 1);
  assert.equal(result.deleteKeySmoke.stateB.proseMirrorCount, 1);
  assert.equal(result.deleteKeySmoke.stateB.activeElementInsideProse, true);
  assert.equal(result.deleteKeySmoke.stateB.selectionInsideProse, true);
  assert.equal(result.deleteKeySmoke.stateB.selectionCollapsed, true);
  assert.equal(
    result.deleteKeySmoke.stateB.proseText.split(result.deleteKeySmoke.expectedFragment).length - 1,
    1,
  );
  assert.equal(
    result.deleteKeySmoke.stateB.proseText.split(result.deleteKeySmoke.stateAToken).length - 1,
    0,
  );
  assert.equal(
    result.deleteKeySmoke.stateB.proseText.length,
    result.deleteKeySmoke.stateA.proseText.length - 1,
  );

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

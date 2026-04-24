const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..');

function readFile(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function runHorizontalSheetFeedCloseout(t) {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), '07b-central-sheet-proof-'));
  t.after(() => {
    fs.rmSync(outputDir, { recursive: true, force: true });
  });

  const result = spawnSync(
    process.execPath,
    ['test/unit/horizontal-sheet-feed-product-closeout-smoke.mjs'],
    {
      cwd: ROOT,
      env: {
        ...process.env,
        HORIZONTAL_SHEET_FEED_CLOSEOUT_OUT_DIR: outputDir,
      },
      encoding: 'utf8',
      timeout: 70000,
    },
  );

  assert.equal(
    result.status,
    0,
    `horizontal sheet feed closeout failed\nSTDOUT:\n${result.stdout || ''}\nSTDERR:\n${result.stderr || ''}`,
  );

  const resultPath = path.join(outputDir, 'result.json');
  assert.equal(fs.existsSync(resultPath), true, 'result.json must be produced by closeout smoke');
  return JSON.parse(fs.readFileSync(resultPath, 'utf8'));
}

function assertHorizontalFeedState(state, label) {
  assert.equal(state.centralSheetFlow, 'horizontal', `${label} must use horizontal central sheet flow`);
  assert.equal(state.centralSheetOverflowReason, null, `${label} must not use overflow fallback`);
  assert.equal(state.visibleSheetCount >= 2, true, `${label} must show at least two derived sheets`);
  assert.equal(state.derivedSheetCount >= 2, true, `${label} must expose at least two derived sheet wrappers`);
  assert.equal(state.occupiedSheetCount >= 2, true, `${label} must occupy at least two visual sheets`);
  assert.equal(state.firstTwoSheetRectsHorizontal, true, `${label} first two sheets must be horizontal`);
  assert.equal(state.secondSheetVisible, true, `${label} second sheet must be visible`);
  assert.equal(state.gapTextRectsCount, 0, `${label} must not render text in the inter-sheet gap`);
  assert.equal(state.overflowTextRectsCount, 0, `${label} must not render text outside sheet bounds`);
  assert.equal(state.proseMirrorCount, 1, `${label} must keep one ProseMirror`);
  assert.equal(state.tiptapEditorCount, 1, `${label} must keep one Tiptap editor shell`);
  assert.equal(state.sourceWrapperCount, 1, `${label} must keep one direct source editor wrapper`);
  assert.equal(state.sourceEditorWrapperCount, 1, `${label} source wrapper must hold the real editor`);
  assert.equal(state.sourceWrapperProseMirrorCount, 1, `${label} source wrapper must hold one ProseMirror`);
  assert.equal(state.sourceWrapperTiptapEditorCount, 1, `${label} source wrapper must hold one Tiptap shell`);
  assert.equal(state.derivedSheetProseMirrorCount, 0, `${label} derived sheets must not contain ProseMirror`);
  assert.equal(state.derivedSheetEditorCount, 0, `${label} derived sheets must not contain editor shells`);
  assert.equal(state.prosePageTruthCount, 0, `${label} must not write page truth into ProseMirror`);
  assert.equal(state.rightInspectorVisible, true, `${label} must keep right inspector visible`);
  assert.equal(state.editorCanvasVisible, true, `${label} must keep editor canvas visible`);
}

test('central sheet strip proof: product closeout smoke proves horizontal feed metrics', { timeout: 80000 }, (t) => {
  const result = runHorizontalSheetFeedCloseout(t);

  assert.equal(result.ok, true);
  assert.ok(result.paragraphCount >= 1);
  assert.ok(result.paragraphCount <= 20);
  assertHorizontalFeedState(result.fixture, 'fixture');
  assertHorizontalFeedState(result.beforeInput, 'before input');
  assertHorizontalFeedState(result.afterInput, 'after input');

  assert.equal(result.focusResult.ok, true);
  assert.equal(result.focusResult.activeElementInsideProseMirror, true);
  assert.equal(result.focusResult.selectionInsideProseMirror, true);
  assert.equal(result.afterInput.activeElementInsideProseMirror, true);
  assert.equal(result.afterInput.selectionInsideProseMirror, true);
  assert.equal(result.beforeInput.markerOccurrences, 0);
  assert.equal(result.afterInput.markerOccurrences, 1);
  assert.notEqual(result.beforeInput.textHash, result.afterInput.textHash);
  assert.equal(result.beforeScreenshot.byteLength > 0, true);
  assert.equal(result.afterScreenshot.byteLength > 0, true);
  assert.equal(result.networkRequests, 0);
  assert.equal(result.dialogCalls, 0);
});

test('central sheet strip proof: source remains renderer-only and bounded', () => {
  const editorText = readFile('src/renderer/editor.js');
  const cssText = readFile('src/renderer/styles.css');

  assert.equal((editorText.match(/initTiptap\(/g) || []).length, 1);
  assert.ok(editorText.includes('const MAX_CENTRAL_SHEET_PROOF_PAGES = 5;'));
  assert.ok(editorText.includes("editor.dataset.centralSheetFlow = 'horizontal';"));
  assert.match(
    editorText,
    /clearCentralSheetStripProof\(\{ overflowReason: centralSheetDecision\.overflowReason \}\);/,
  );
  assert.equal(editorText.includes("from '../derived/pageMapService.mjs'"), false);
  assert.equal(editorText.includes("from '../derived/layoutInvalidation.mjs'"), false);
  assert.equal(editorText.includes("from './layoutPreview.mjs'"), true);

  assert.ok(cssText.includes('#editor.tiptap-host.tiptap-host--central-sheet-strip-proof > .tiptap-page-wrap'));
  assert.ok(cssText.includes('.tiptap-sheet-strip > .tiptap-page-wrap'));
  assert.ok(cssText.includes('column-width: var(--central-sheet-content-width-px);'));
  assert.ok(cssText.includes('pointer-events: auto;'));
});

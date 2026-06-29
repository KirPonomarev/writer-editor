const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  CENTRAL_SHEET_MAX_PAGE_COUNT_OVERFLOW_REASON,
  resolveCentralSheetStripProofDecision,
} = require('../../src/renderer/centralSheetStripProofDecision.js');

const ROOT = path.resolve(__dirname, '..', '..');

function readFile(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

test('central sheet strip proof: bounded snapshot window keeps renderable central feed', () => {
  const activeLayoutPreviewSnapshot = {
    schemaVersion: 'renderer.layoutPreview.v1',
    pageMap: {
      schemaVersion: 'renderer.pageMap.v1',
      pages: Array.from({ length: 7 }, (_, index) => ({ pageNumber: index + 1 })),
      meta: { pageCount: 7 },
    },
  };

  assert.deepEqual(
    resolveCentralSheetStripProofDecision({
      activeLayoutPreviewSnapshot,
      naturalHeight: 0,
      contentHeightPx: 300,
      maxPageCount: 5,
    }),
    {
      pageCount: 7,
      visiblePageCount: 5,
      overflowReason: CENTRAL_SHEET_MAX_PAGE_COUNT_OVERFLOW_REASON,
      shouldRender: true,
    },
  );
});

test('central sheet strip proof: measured height prevents page-map undercount false-green', () => {
  const activeLayoutPreviewSnapshot = {
    schemaVersion: 'renderer.layoutPreview.v1',
    pageMap: {
      schemaVersion: 'renderer.pageMap.v1',
      pages: Array.from({ length: 2 }, (_, index) => ({ pageNumber: index + 1 })),
      meta: { pageCount: 2 },
    },
  };

  assert.deepEqual(
    resolveCentralSheetStripProofDecision({
      activeLayoutPreviewSnapshot,
      naturalHeight: 1200,
      contentHeightPx: 300,
      maxPageCount: 5,
    }),
    {
      pageCount: 4,
      visiblePageCount: 4,
      overflowReason: '',
      shouldRender: true,
    },
  );
});


test('central sheet strip proof: source remains renderer-only and bounded', () => {
  const editorText = readFile('src/renderer/editor.js');
  const cssText = readFile('src/renderer/styles.css');

  assert.equal((editorText.match(/initTiptap\(/g) || []).length, 1);
  assert.ok(editorText.includes('const CENTRAL_SHEET_RUNTIME_WINDOW_DOM_BUDGET = 15;'));
  assert.ok(editorText.includes("editor.dataset.centralSheetFlow = 'vertical';"));
  assert.equal(editorText.includes("editor.dataset.centralSheetFlow = 'horizontal';"), false);
  assert.ok(editorText.includes('renderedPageCount'));
  assert.ok(editorText.includes('centralSheetTotalPageCount'));
  assert.ok(editorText.includes('centralSheetSourcePageCount'));
  assert.ok(editorText.includes('centralSheetDecisionPageCount'));
  assert.ok(editorText.includes('centralSheetStructuralRuntimePageCount'));
  assert.ok(editorText.includes('centralSheetBoundedOverflowReason'));
  assert.ok(editorText.includes('centralSheetBoundedOverflowSourcePageCount'));
  assert.ok(editorText.includes('centralSheetBoundedOverflowRuntimePageCount'));
  assert.ok(editorText.includes('centralSheetBoundedOverflowVisiblePageCount'));
  assert.ok(editorText.includes('centralSheetBoundedOverflowHiddenPageCount'));
  assert.ok(editorText.includes('--central-sheet-strip-height-px'));
  assert.ok(editorText.includes('--central-sheet-page-stride-px'));
  assert.ok(editorText.includes('--central-sheet-editor-height-px'));
  assert.ok(editorText.includes('const CENTRAL_SHEET_TEXT_MASK_BLEED_PX = 2;'));
  assert.ok(editorText.includes('const CENTRAL_SHEET_LARGE_PAYLOAD_ESTIMATED_CHARS_PER_PAGE = 520;'));
  assert.equal(editorText.includes('CENTRAL_SHEET_LARGE_PAYLOAD_ESTIMATED_CHARS_PER_PAGE = 246;'), false);
  assert.ok(editorText.includes("editor.style.setProperty('--central-sheet-mask-bleed-px'"));
  assert.ok(editorText.includes("editor.style.removeProperty('--central-sheet-mask-bleed-px');"));
  assert.ok(editorText.includes('const sourcePageCount = Math.max(1, decisionPageCount);'));
  assert.ok(editorText.includes('const runtimePageCount = Math.max(1, structuralMinimumPageCount);'));
  assert.ok(editorText.includes('const scrollPageCount = runtimePageCount;'));
  assert.ok(editorText.includes('sourcePageCount,'));
  assert.ok(editorText.includes('pageCount: runtimePageCount,'));
  assert.ok(editorText.includes("editor.dataset.centralSheetSourcePageCount = String(sourcePageCount || pageCount);"));
  assert.ok(editorText.includes("editor.dataset.centralSheetStructuralRuntimePageCount = String(structuralMinimumPageCount || pageCount);"));
  assert.ok(editorText.includes('scheduleCentralSheetStripProofRefresh({ scrollOnly: true });'));
  assert.ok(editorText.includes('return applyEstimatedCentralSheetStripRuntimeStateFromText(readCentralSheetLargePayloadFastPathText());'));
  assert.ok(editorText.includes('forceFull !== true'));
  assert.equal(editorText.includes('const sourcePageCount = Math.max(decisionPageCount, structuralMinimumPageCount);'), false);
  assert.equal(editorText.includes('pageCount: sourcePageCount,'), false);
  assert.equal(editorText.includes('editor.dataset.centralSheetBoundedOverflowSourcePageCount = String(pageCount);'), false);
  assert.ok(editorText.includes('buildVirtualViewportWindowMathContract'));
  assert.match(
    editorText,
    /clearCentralSheetStripProof\(\{ overflowReason: runtimeState\.overflowReason \}\);/,
  );
  assert.equal(editorText.includes("from '../derived/pageMapService.mjs'"), false);
  assert.equal(editorText.includes("from '../derived/layoutInvalidation.mjs'"), false);
  assert.equal(editorText.includes("from './layoutPreview.mjs'"), true);

  assert.ok(cssText.includes('#editor.tiptap-host.tiptap-host--central-sheet-strip-proof > .tiptap-page-wrap'));
  assert.ok(cssText.includes('.tiptap-sheet-strip > .tiptap-page-wrap'));
  assert.ok(cssText.includes('.tiptap-sheet-strip > .tiptap-sheet-strip__spacer'));
  assert.ok(cssText.includes('flex-direction: column;'));
  assert.ok(cssText.includes('overflow-anchor: none;'));
  assert.ok(cssText.includes('shape-outside: repeating-linear-gradient('));
  assert.ok(cssText.includes('.tiptap-sheet-strip > .tiptap-page-wrap + .tiptap-page-wrap'));
  assert.ok(cssText.includes('margin-top: var(--page-gap-px);'));
  assert.ok(cssText.includes('.tiptap-sheet-derived-text'));
  assert.ok(cssText.includes('--central-sheet-derived-text-top-guard-px'));
  assert.ok(cssText.includes('data-central-sheet-large-payload-fast-path-active="true"'));
  assert.ok(cssText.includes('contain: strict;'));
  assert.ok(cssText.includes('mask-image: none;'));
  assert.ok(cssText.includes('shape-outside: none;'));
  assert.equal(cssText.includes('column-width: var(--central-sheet-content-width-px);'), false);
  assert.equal(cssText.includes('column-gap: calc(var(--page-gap-px) + var(--page-margin-left-px) + var(--page-margin-right-px));'), false);
  assert.equal(cssText.includes('column-fill: auto;'), false);
  assert.ok(cssText.includes('pointer-events: auto;'));
});

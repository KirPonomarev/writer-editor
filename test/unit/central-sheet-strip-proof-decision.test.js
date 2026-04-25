const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  CENTRAL_SHEET_MAX_PAGE_COUNT_OVERFLOW_REASON,
  resolveCentralSheetStripProofDecision,
  selectActiveLayoutPreviewSnapshotPageCount,
} = require('../../src/renderer/centralSheetStripProofDecision.js');

const REPO_ROOT = path.resolve(__dirname, '../..');

function readSource(relativePath) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');
}

test('central sheet decision keeps normal content renderable as a derived budget decision', () => {
  assert.deepEqual(
    resolveCentralSheetStripProofDecision({
      naturalHeight: 599,
      contentHeightPx: 300,
      maxPageCount: 5,
    }),
    {
      pageCount: 2,
      visiblePageCount: 2,
      overflowReason: '',
      shouldRender: true,
    },
  );

  assert.deepEqual(
    resolveCentralSheetStripProofDecision({
      naturalHeight: 0,
      contentHeightPx: 300,
      maxPageCount: 5,
    }),
    {
      pageCount: 1,
      visiblePageCount: 1,
      overflowReason: '',
      shouldRender: true,
    },
  );
});

test('central sheet decision reports max-page-count overflow without persisting page truth', () => {
  assert.deepEqual(
    resolveCentralSheetStripProofDecision({
      naturalHeight: 1801,
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

test('central sheet decision uses measured height when it proves snapshot undercount', () => {
  const activeLayoutPreviewSnapshot = {
    schemaVersion: 'renderer.layoutPreview.v1',
    pageMap: {
      schemaVersion: 'renderer.pageMap.v1',
      pages: [{ pageNumber: 1 }, { pageNumber: 2 }, { pageNumber: 3 }],
      meta: { pageCount: 3 },
    },
  };

  assert.equal(selectActiveLayoutPreviewSnapshotPageCount(activeLayoutPreviewSnapshot), 3);
  assert.deepEqual(
    resolveCentralSheetStripProofDecision({
      activeLayoutPreviewSnapshot,
      naturalHeight: 1801,
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

test('central sheet decision bounds valid snapshot overflow while preserving source page count', () => {
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

test('central sheet decision falls back to DOM metrics when active layout preview snapshot count is invalid', () => {
  assert.deepEqual(
    resolveCentralSheetStripProofDecision({
      activeLayoutPreviewSnapshot: {
        schemaVersion: 'renderer.layoutPreview.v1',
        pageMap: {
          pages: [{ pageNumber: 1 }, { pageNumber: 2 }],
          meta: { pageCount: 0 },
        },
      },
      naturalHeight: 599,
      contentHeightPx: 300,
      maxPageCount: 5,
    }),
    {
      pageCount: 2,
      visiblePageCount: 2,
      overflowReason: '',
      shouldRender: true,
    },
  );
});

test('central sheet decision is a DOM-free helper consumed by editor runtime', () => {
  const helperSource = readSource('src/renderer/centralSheetStripProofDecision.js');
  const editorSource = readSource('src/renderer/editor.js');

  assert.doesNotMatch(helperSource, /\bdocument\b/);
  assert.doesNotMatch(helperSource, /\bwindow\b/);
  assert.doesNotMatch(helperSource, /\bHTMLElement\b/);
  assert.match(editorSource, /import centralSheetStripProofDecision from '\.\/centralSheetStripProofDecision\.js';/);
  assert.match(editorSource, /const activeLayoutPreviewSnapshot = buildActiveLayoutPreviewSnapshot\(\);/);
  assert.doesNotMatch(editorSource, /activeLayoutPreviewSnapshotPageCount\s*\?\s*0\s*:\s*measureCentralSheetNaturalHeight\(proseMirror\);/s);
  assert.match(editorSource, /const naturalHeight = measureCentralSheetNaturalHeight\(proseMirror\);/);
  assert.match(editorSource, /resolveCentralSheetStripProofDecision\(\{\s*naturalHeight,\s*contentHeightPx: heightPx,\s*activeLayoutPreviewSnapshot,\s*maxPageCount: CENTRAL_SHEET_RUNTIME_WINDOW_DOM_BUDGET,\s*\}\)/s);
  assert.match(editorSource, /const \{ pageCount \} = centralSheetDecision;/);
  assert.match(editorSource, /const pageWindow = resolveCentralSheetViewportRuntimeWindow\(\{/);
  assert.match(editorSource, /renderCentralSheetStripShellPages\(pageWindow\);/);
  assert.match(editorSource, /delete editor\.dataset\.centralSheetOverflowReason;/);
  assert.match(editorSource, /editor\.dataset\.centralSheetBoundedOverflowReason = overflowReason;/);
  assert.match(editorSource, /editor\.dataset\.centralSheetBoundedOverflowSourcePageCount = String\(pageCount\);/);
  assert.match(editorSource, /editor\.dataset\.centralSheetBoundedOverflowVisiblePageCount = String\(visiblePageCount\);/);
  assert.match(editorSource, /clearCentralSheetStripProof\(\{ overflowReason: centralSheetDecision\.overflowReason \}\);/);
});

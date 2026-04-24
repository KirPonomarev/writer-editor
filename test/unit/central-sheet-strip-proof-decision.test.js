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
      overflowReason: CENTRAL_SHEET_MAX_PAGE_COUNT_OVERFLOW_REASON,
      shouldRender: false,
    },
  );
});

test('central sheet decision selects valid active layout preview snapshot page count before DOM metrics', () => {
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
      pageCount: 3,
      overflowReason: '',
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
  assert.match(editorSource, /const activeLayoutPreviewSnapshotPageCount = selectActiveLayoutPreviewSnapshotPageCount\(activeLayoutPreviewSnapshot\);/);
  assert.match(editorSource, /const naturalHeight = activeLayoutPreviewSnapshotPageCount\s*\?\s*0\s*:\s*measureCentralSheetNaturalHeight\(proseMirror\);/s);
  assert.match(editorSource, /resolveCentralSheetStripProofDecision\(\{\s*naturalHeight,\s*contentHeightPx: heightPx,\s*activeLayoutPreviewSnapshot,\s*maxPageCount: MAX_CENTRAL_SHEET_PROOF_PAGES,\s*\}\)/s);
  assert.match(editorSource, /clearCentralSheetStripProof\(\{ overflowReason: centralSheetDecision\.overflowReason \}\);/);
});

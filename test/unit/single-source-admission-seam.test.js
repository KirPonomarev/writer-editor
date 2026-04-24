const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

function read(relativePath) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

async function loadModule(relativePath) {
  const fileUrl = pathToFileURL(path.join(process.cwd(), relativePath)).href;
  return import(fileUrl);
}

function createPreviewInput(overrides = {}) {
  return {
    text: [
      'Chapter One',
      '',
      'Alpha beta gamma delta epsilon',
      '[[PAGE_BREAK]]',
      'Chapter Two',
      '',
      'Omega omega omega omega omega',
    ].join('\n'),
    profile: {
      formatId: 'A4',
      chapterStartRule: 'next-page',
      allowExplicitPageBreaks: true,
    },
    metrics: {
      pageWidthMm: 210,
      pageHeightMm: 297,
      pageWidthPx: 1197,
      pageHeightPx: 1693,
      contentWidthPx: 907,
      contentHeightPx: 1403,
    },
    selectionRange: { start: 0, end: 12 },
    sourceId: 'single-source-admission-seam',
    ...overrides,
  };
}

test('single source admission seam: layout preview delegates page map to derived service', async () => {
  const source = read('src/renderer/layoutPreview.mjs');

  assert.match(source, /from '\.\.\/derived\/pageMapService\.mjs';/);
  assert.doesNotMatch(source, /function paginateFlow\(/);
  assert.doesNotMatch(source, /schemaVersion:\s*'renderer\.pageMap\.v1'/);

  const mod = await loadModule('src/renderer/layoutPreview.mjs');
  const snapshot = mod.buildLayoutPreviewSnapshot(createPreviewInput());

  assert.equal(snapshot.pageMap?.schemaVersion, 'derived.pageMap.v1');
  assert.equal(Number(snapshot.pageMap?.meta?.pageCount) >= 2, true);
  assert.equal(Number(snapshot.pageMap?.meta?.pageBreakCount) >= 1, true);
});

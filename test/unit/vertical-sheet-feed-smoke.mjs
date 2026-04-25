import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const rootDir = path.resolve(new URL('../..', import.meta.url).pathname);

async function read(relativePath) {
  return readFile(path.join(rootDir, relativePath), 'utf8');
}

async function loadModule(relativePath) {
  return import(pathToFileURL(path.join(rootDir, relativePath)).href);
}

const editorText = await read('src/renderer/editor.js');
const cssText = await read('src/renderer/styles.css');

assert.equal(editorText.includes("editor.dataset.centralSheetFlow = 'vertical';"), true);
assert.equal(editorText.includes("editor.dataset.centralSheetFlow = 'horizontal';"), false);
assert.equal(cssText.includes('column-width: var(--central-sheet-content-width-px);'), false);
assert.equal(cssText.includes('column-fill: auto;'), false);
assert.equal(cssText.includes('shape-outside: repeating-linear-gradient('), true);
assert.equal(cssText.includes('flex-direction: column;'), true);

const { normalizeBookProfile } = await loadModule('src/core/bookProfile.mjs');
const { resolvePageLayoutMetrics } = await loadModule('src/core/pageLayoutMetrics.mjs');

for (const formatId of ['A4', 'A5', 'LETTER']) {
  for (const orientation of ['portrait', 'landscape']) {
    const profileResult = normalizeBookProfile({ formatId, orientation });
    assert.equal(profileResult.ok, true, `${formatId} ${orientation} profile normalizes`);
    const metricsResult = resolvePageLayoutMetrics(profileResult.value);
    assert.equal(metricsResult.ok, true, `${formatId} ${orientation} metrics resolve`);
    const metrics = metricsResult.value;
    assert.equal(metrics.formatId, formatId);
    assert.equal(metrics.orientation, orientation);
    assert.equal(metrics.pageWidthPx > 0, true);
    assert.equal(metrics.pageHeightPx > 0, true);
    assert.equal(metrics.contentWidthPx > 0, true);
    assert.equal(metrics.contentHeightPx > 0, true);
    assert.equal(metrics.contentWidthPx < metrics.pageWidthPx, true);
    assert.equal(metrics.contentHeightPx < metrics.pageHeightPx, true);
    assert.equal(
      orientation === 'landscape'
        ? metrics.pageWidthPx > metrics.pageHeightPx
        : metrics.pageHeightPx > metrics.pageWidthPx,
      true,
    );
  }
}

console.log('VERTICAL_SHEET_FEED_SMOKE_SUMMARY:' + JSON.stringify({
  ok: true,
  flow: 'vertical',
  formatCases: 6,
  primaryCssColumns: false,
}));

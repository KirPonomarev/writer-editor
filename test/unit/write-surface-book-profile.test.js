const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..', '..');

function readFile(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

async function loadModule(relativePath) {
  const fileUrl = pathToFileURL(path.join(ROOT, relativePath)).href;
  return import(fileUrl);
}

test('write surface book profile: geometry stays in bookProfile and preview chrome stays out', async () => {
  const bookProfile = await loadModule('src/core/bookProfile.mjs');
  const pageLayoutMetrics = await loadModule('src/core/pageLayoutMetrics.mjs');

  assert.deepEqual(bookProfile.BOOK_PROFILE_MODEL_KEYS, [
    'schemaVersion',
    'profileId',
    'formatId',
    'widthMm',
    'heightMm',
    'orientation',
    'marginTopMm',
    'marginRightMm',
    'marginBottomMm',
    'marginLeftMm',
    'chapterStartRule',
    'allowExplicitPageBreaks',
  ]);
  assert.deepEqual(bookProfile.BOOK_PROFILE_SCREEN_CHROME_KEYS, [
    'zoom',
    'pageWidthPx',
    'pageHeightPx',
    'contentWidthPx',
    'contentHeightPx',
    'marginTopPx',
    'marginRightPx',
    'marginBottomPx',
    'marginLeftPx',
    'viewportWidthPx',
    'viewportHeightPx',
  ]);

  const profile = bookProfile.createDefaultBookProfile({
    profileId: 'stage02-book-profile',
    formatId: 'A5',
    marginTopMm: 20,
    marginRightMm: 18,
    marginBottomMm: 22,
    marginLeftMm: 18,
  });

  assert.deepEqual(Object.keys(profile), bookProfile.BOOK_PROFILE_MODEL_KEYS);
  for (const key of bookProfile.BOOK_PROFILE_SCREEN_CHROME_KEYS) {
    assert.equal(Object.prototype.hasOwnProperty.call(profile, key), false);
  }

  const normalized = bookProfile.normalizeBookProfile({
    ...profile,
    zoom: 1.25,
    pageWidthPx: 950,
    pageHeightPx: 1200,
    contentWidthPx: 700,
    contentHeightPx: 1000,
  });

  assert.equal(normalized.ok, true);
  assert.deepEqual(Object.keys(normalized.value), bookProfile.BOOK_PROFILE_MODEL_KEYS);
  for (const key of bookProfile.BOOK_PROFILE_SCREEN_CHROME_KEYS) {
    assert.equal(Object.prototype.hasOwnProperty.call(normalized.value, key), false);
  }

  const metrics = pageLayoutMetrics.resolvePageLayoutMetrics(normalized.value, { zoom: 1.25 });
  assert.equal(metrics.ok, true);
  assert.equal(metrics.value.formatId, 'A5');
  assert.equal(metrics.value.pageWidthMm, 148);
  assert.equal(metrics.value.pageHeightMm, 210);
  assert.equal(Object.prototype.hasOwnProperty.call(metrics.value, 'pageGapMm'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(metrics.value, 'canvasPaddingPx'), false);
  assert.ok(metrics.value.pageWidthPx > 0);
  assert.ok(metrics.value.contentWidthPx < metrics.value.pageWidthPx);
});

test('write surface book profile: index.html scope guard stays outside this contour', () => {
  const html = readFile('src/renderer/index.html');

  assert.equal(html.includes('data-preview-chrome'), false);
  assert.equal(html.includes('data-book-profile'), false);
  assert.equal(html.includes('previewChrome'), false);
  assert.equal(html.includes('bookProfile'), false);
});

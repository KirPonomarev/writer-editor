const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

async function loadModule(relativePath) {
  const fileUrl = pathToFileURL(path.join(process.cwd(), relativePath)).href;
  return import(fileUrl);
}

test('page layout metrics resolve page and content boxes from a normalized profile', async () => {
  const bookProfile = await loadModule('src/core/bookProfile.mjs');
  const metricsModule = await loadModule('src/core/pageLayoutMetrics.mjs');

  const profile = bookProfile.createDefaultBookProfile({
    profileId: 'a5-profile',
    formatId: 'A5',
    marginTopMm: 20,
    marginRightMm: 18,
    marginBottomMm: 22,
    marginLeftMm: 18,
  });
  const metrics = metricsModule.resolvePageLayoutMetrics(profile, { zoom: 1.5 });

  assert.equal(metrics.ok, true);
  assert.equal(metrics.value.pageWidthMm, 148);
  assert.equal(metrics.value.pageHeightMm, 210);
  assert.ok(metrics.value.contentWidthMm < metrics.value.pageWidthMm);
  assert.ok(metrics.value.contentHeightMm < metrics.value.pageHeightMm);
  assert.ok(metrics.value.contentWidthPx < metrics.value.pageWidthPx);
  assert.ok(metrics.value.contentHeightPx < metrics.value.pageHeightPx);
});

test('page layout metrics fail close on impossible margin overflow', async () => {
  const metricsModule = await loadModule('src/core/pageLayoutMetrics.mjs');

  const result = metricsModule.resolvePageLayoutMetrics({
    profileId: 'overflow-profile',
    formatId: 'A4',
    marginTopMm: 10,
    marginRightMm: 100,
    marginBottomMm: 10,
    marginLeftMm: 100,
  });

  assert.equal(result.ok, false);
  assert.ok(
    result.issues.some((issue) => issue.code === 'E_BOOK_PROFILE_MARGIN_WIDTH_OVERFLOW'),
  );
});

test('page layout metrics validate layout options explicitly', async () => {
  const bookProfile = await loadModule('src/core/bookProfile.mjs');
  const metricsModule = await loadModule('src/core/pageLayoutMetrics.mjs');

  const profile = bookProfile.createDefaultBookProfile({ profileId: 'zoom-check' });
  const result = metricsModule.resolvePageLayoutMetrics(profile, { zoom: 0, pxPerMm: -1 });

  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.code === 'E_PAGE_LAYOUT_ZOOM'));
});

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

async function loadModule(relativePath) {
  const fileUrl = pathToFileURL(path.join(process.cwd(), relativePath)).href;
  return import(fileUrl);
}

function round(value, precision = 3) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
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

test('page layout metrics derive supported format boxes from selected profile', async () => {
  const bookProfile = await loadModule('src/core/bookProfile.mjs');
  const metricsModule = await loadModule('src/core/pageLayoutMetrics.mjs');

  const cases = [
    { formatId: 'A4', widthMm: 210, heightMm: 297 },
    { formatId: 'A5', widthMm: 148, heightMm: 210 },
    { formatId: 'LETTER', widthMm: 215.9, heightMm: 279.4 },
  ];

  for (const entry of cases) {
    const profile = bookProfile.createDefaultBookProfile({
      profileId: `${entry.formatId.toLowerCase()}-metrics-proof`,
      formatId: entry.formatId,
      marginTopMm: 10,
      marginRightMm: 11,
      marginBottomMm: 12,
      marginLeftMm: 13,
    });
    const metrics = metricsModule.resolvePageLayoutMetrics(profile, { zoom: 2, pxPerMm: 3 });

    assert.equal(metrics.ok, true);
    assert.equal(metrics.value.formatId, entry.formatId);
    assert.equal(metrics.value.orientation, 'portrait');
    assert.equal(metrics.value.pageWidthMm, entry.widthMm);
    assert.equal(metrics.value.pageHeightMm, entry.heightMm);
    assert.equal(metrics.value.marginTopMm, 10);
    assert.equal(metrics.value.marginRightMm, 11);
    assert.equal(metrics.value.marginBottomMm, 12);
    assert.equal(metrics.value.marginLeftMm, 13);
    assert.equal(metrics.value.contentWidthMm, round(entry.widthMm - 24));
    assert.equal(metrics.value.contentHeightMm, round(entry.heightMm - 22));
    assert.equal(metrics.value.pageWidthPx, round(entry.widthMm * 6));
    assert.equal(metrics.value.pageHeightPx, round(entry.heightMm * 6));
  }
});

test('page layout metrics derive landscape boxes from selected profile without hardcoded A4', async () => {
  const bookProfile = await loadModule('src/core/bookProfile.mjs');
  const metricsModule = await loadModule('src/core/pageLayoutMetrics.mjs');

  const profile = bookProfile.createDefaultBookProfile({
    profileId: 'letter-landscape-metrics-proof',
    formatId: 'LETTER',
    orientation: 'landscape',
    marginTopMm: 8,
    marginRightMm: 9,
    marginBottomMm: 10,
    marginLeftMm: 11,
  });
  const metrics = metricsModule.resolvePageLayoutMetrics(profile, { zoom: 1, pxPerMm: 10 });

  assert.equal(metrics.ok, true);
  assert.equal(metrics.value.formatId, 'LETTER');
  assert.equal(metrics.value.orientation, 'landscape');
  assert.equal(metrics.value.pageWidthMm, 279.4);
  assert.equal(metrics.value.pageHeightMm, 215.9);
  assert.equal(metrics.value.contentWidthMm, 259.4);
  assert.equal(metrics.value.contentHeightMm, 197.9);
  assert.equal(metrics.value.pageWidthPx, 2794);
  assert.equal(metrics.value.pageHeightPx, 2159);
});

test('page layout metrics export a runtime px-per-mm baseline and use it by default', async () => {
  const bookProfile = await loadModule('src/core/bookProfile.mjs');
  const metricsModule = await loadModule('src/core/pageLayoutMetrics.mjs');

  assert.equal(
    metricsModule.PAGE_LAYOUT_RUNTIME_PX_PER_MM_BASELINE,
    metricsModule.PX_PER_MM_AT_ZOOM_1,
  );

  const profile = bookProfile.createDefaultBookProfile({ profileId: 'baseline-check' });
  const explicitResult = metricsModule.resolvePageLayoutMetrics(profile, {
    pxPerMm: metricsModule.PAGE_LAYOUT_RUNTIME_PX_PER_MM_BASELINE,
  });
  const implicitResult = metricsModule.resolvePageLayoutMetrics(profile);

  assert.equal(implicitResult.ok, true);
  assert.equal(explicitResult.ok, true);
  assert.equal(implicitResult.value.pageWidthPx, explicitResult.value.pageWidthPx);
  assert.equal(implicitResult.value.pageHeightPx, explicitResult.value.pageHeightPx);
  assert.equal(implicitResult.value.contentWidthPx, explicitResult.value.contentWidthPx);
  assert.equal(implicitResult.value.contentHeightPx, explicitResult.value.contentHeightPx);
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

test('page layout metrics fail close on invalid profile format without fallback', async () => {
  const metricsModule = await loadModule('src/core/pageLayoutMetrics.mjs');

  const result = metricsModule.resolvePageLayoutMetrics({
    profileId: 'invalid-format-metrics-proof',
    formatId: 'TABLOID',
    orientation: 'portrait',
    marginTopMm: 10,
    marginRightMm: 10,
    marginBottomMm: 10,
    marginLeftMm: 10,
  });

  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.code === 'E_PAGE_FORMAT_ID'));
});

test('page layout metrics fail close on invalid profile orientation without fallback', async () => {
  const metricsModule = await loadModule('src/core/pageLayoutMetrics.mjs');

  const result = metricsModule.resolvePageLayoutMetrics({
    schemaVersion: 'book-profile.v1',
    profileId: 'invalid-orientation-metrics-proof',
    formatId: 'A5',
    widthMm: 148,
    heightMm: 210,
    orientation: 'diagonal',
    marginTopMm: 10,
    marginRightMm: 10,
    marginBottomMm: 10,
    marginLeftMm: 10,
    chapterStartRule: 'next-page',
    allowExplicitPageBreaks: true,
  });

  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.code === 'E_BOOK_PROFILE_ORIENTATION'));
});

test('page layout metrics validate layout options explicitly', async () => {
  const bookProfile = await loadModule('src/core/bookProfile.mjs');
  const metricsModule = await loadModule('src/core/pageLayoutMetrics.mjs');

  const profile = bookProfile.createDefaultBookProfile({ profileId: 'zoom-check' });
  const result = metricsModule.resolvePageLayoutMetrics(profile, { zoom: 0, pxPerMm: -1 });

  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.code === 'E_PAGE_LAYOUT_ZOOM'));
});

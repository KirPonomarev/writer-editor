const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

async function loadModule(relativePath) {
  const fileUrl = pathToFileURL(path.join(process.cwd(), relativePath)).href;
  return import(fileUrl);
}

test('book profile defaults to A4 and exposes only Stage 01 presets', async () => {
  const bookProfile = await loadModule('src/core/bookProfile.mjs');
  const registry = await loadModule('src/core/pageFormatRegistry.mjs');

  assert.equal(registry.DEFAULT_PAGE_FORMAT_ID, 'A4');
  assert.deepEqual(
    registry.listPageFormats().map((entry) => entry.formatId),
    ['A4', 'A5', 'LETTER', 'LEGAL', 'SIX_BY_NINE', 'CUSTOM'],
  );

  const profile = bookProfile.createDefaultBookProfile();
  assert.equal(profile.formatId, 'A4');
  assert.equal(profile.widthMm, 210);
  assert.equal(profile.heightMm, 297);
  assert.equal(profile.orientation, 'portrait');
});

test('book profile strips screen chrome fields from normalized output', async () => {
  const bookProfile = await loadModule('src/core/bookProfile.mjs');

  const result = bookProfile.normalizeBookProfile({
    profileId: 'profile-stage01',
    formatId: 'A5',
    zoom: 1.25,
    pageWidthPx: 400,
    marginTopMm: 20,
    marginRightMm: 20,
    marginBottomMm: 20,
    marginLeftMm: 20,
  });

  assert.equal(result.ok, true);
  assert.equal(Object.prototype.hasOwnProperty.call(result.value, 'zoom'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result.value, 'pageWidthPx'), false);
  assert.deepEqual(Object.keys(result.value), bookProfile.BOOK_PROFILE_MODEL_KEYS);
});

test('book profile validation rejects persisted screen chrome fields and unknown formats', async () => {
  const bookProfile = await loadModule('src/core/bookProfile.mjs');

  const valid = bookProfile.createDefaultBookProfile({ profileId: 'screen-chrome-check' });
  const chromeFieldFailure = bookProfile.validateBookProfile({
    ...valid,
    pageWidthPx: 900,
  });

  assert.equal(chromeFieldFailure.ok, false);
  assert.ok(
    chromeFieldFailure.issues.some((issue) => issue.code === 'E_BOOK_PROFILE_SCREEN_CHROME_FIELD'),
  );

  const formatFailure = bookProfile.normalizeBookProfile({
    profileId: 'bad-format',
    formatId: 'TABLOID',
  });

  assert.equal(formatFailure.ok, false);
  assert.ok(formatFailure.issues.some((issue) => issue.code === 'E_PAGE_FORMAT_ID'));
});

test('book profile validation rejects geometry that does not match the declared format and orientation', async () => {
  const bookProfile = await loadModule('src/core/bookProfile.mjs');

  const mismatch = bookProfile.validateBookProfile({
    schemaVersion: bookProfile.BOOK_PROFILE_SCHEMA_VERSION,
    profileId: 'geometry-mismatch',
    formatId: 'A4',
    widthMm: 148,
    heightMm: 210,
    orientation: 'portrait',
    marginTopMm: 20,
    marginRightMm: 20,
    marginBottomMm: 20,
    marginLeftMm: 20,
    chapterStartRule: 'next-page',
    allowExplicitPageBreaks: true,
  });

  assert.equal(mismatch.ok, false);
  assert.ok(
    mismatch.issues.some((issue) => issue.code === 'E_BOOK_PROFILE_FORMAT_DIMENSIONS'),
  );
});

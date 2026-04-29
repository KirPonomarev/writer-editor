const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

async function loadModule(relativePath) {
  const fileUrl = pathToFileURL(path.join(process.cwd(), relativePath)).href;
  return import(fileUrl);
}

const EXPECTED_BOOK_PROFILE_MODEL_KEYS = [
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
];

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

test('book profile model proves supported format dimensions, margins, schema, and orientation', async () => {
  const bookProfile = await loadModule('src/core/bookProfile.mjs');

  const cases = [
    { formatId: 'A4', widthMm: 210, heightMm: 297 },
    { formatId: 'A5', widthMm: 148, heightMm: 210 },
    { formatId: 'LETTER', widthMm: 215.9, heightMm: 279.4 },
  ];

  for (const entry of cases) {
    const portrait = bookProfile.createDefaultBookProfile({
      profileId: `${entry.formatId.toLowerCase()}-portrait-proof`,
      formatId: entry.formatId,
      orientation: 'portrait',
      marginTopMm: 12,
      marginRightMm: 14,
      marginBottomMm: 16,
      marginLeftMm: 18,
    });
    assert.equal(portrait.schemaVersion, bookProfile.BOOK_PROFILE_SCHEMA_VERSION);
    assert.equal(portrait.formatId, entry.formatId);
    assert.equal(portrait.widthMm, entry.widthMm);
    assert.equal(portrait.heightMm, entry.heightMm);
    assert.equal(portrait.orientation, 'portrait');
    assert.equal(portrait.marginTopMm, 12);
    assert.equal(portrait.marginRightMm, 14);
    assert.equal(portrait.marginBottomMm, 16);
    assert.equal(portrait.marginLeftMm, 18);
    assert.deepEqual(Object.keys(portrait), EXPECTED_BOOK_PROFILE_MODEL_KEYS);
    assert.deepEqual(bookProfile.BOOK_PROFILE_MODEL_KEYS, EXPECTED_BOOK_PROFILE_MODEL_KEYS);

    const landscape = bookProfile.createDefaultBookProfile({
      profileId: `${entry.formatId.toLowerCase()}-landscape-proof`,
      formatId: entry.formatId,
      orientation: 'landscape',
    });
    assert.equal(landscape.formatId, entry.formatId);
    assert.equal(landscape.widthMm, entry.heightMm);
    assert.equal(landscape.heightMm, entry.widthMm);
    assert.equal(landscape.orientation, 'landscape');
    assert.deepEqual(Object.keys(landscape), EXPECTED_BOOK_PROFILE_MODEL_KEYS);
  }
});

test('book profile model defaults missing format to A4 and rejects unknown formats', async () => {
  const bookProfile = await loadModule('src/core/bookProfile.mjs');

  const defaulted = bookProfile.normalizeBookProfile({
    profileId: 'missing-format-proof',
  });
  assert.equal(defaulted.ok, true);
  assert.equal(defaulted.value.formatId, 'A4');
  assert.equal(defaulted.value.widthMm, 210);
  assert.equal(defaulted.value.heightMm, 297);

  const rejected = bookProfile.normalizeBookProfile({
    profileId: 'unknown-format-proof',
    formatId: 'TABLOID',
  });
  assert.equal(rejected.ok, false);
  assert.ok(rejected.issues.some((issue) => issue.code === 'E_PAGE_FORMAT_ID'));
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

test('book profile validation rejects geometry that conflicts with canonical non-custom format', async () => {
  const bookProfile = await loadModule('src/core/bookProfile.mjs');

  const valid = bookProfile.createDefaultBookProfile({
    profileId: 'invalid-geometry',
    formatId: 'A4',
  });
  const invalid = bookProfile.validateBookProfile({
    ...valid,
    widthMm: 200,
    heightMm: 297,
  });

  assert.equal(invalid.ok, false);
  assert.ok(invalid.issues.some((issue) => issue.code === 'E_BOOK_PROFILE_FORMAT_DIMENSIONS'));
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

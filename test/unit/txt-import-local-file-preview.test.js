const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');

const {
  TXT_IMPORT_LOCAL_FILE_PREVIEW_SCHEMA,
  TXT_IMPORT_LOCAL_FILE_PREVIEW_TYPE,
  TXT_IMPORT_LOCAL_FILE_PREVIEW_MAX_BYTES,
  createTxtImportLocalFilePreview,
} = require('../../src/utils/txtImportLocalFilePreview');

function collectKeys(value, pathParts = []) {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectKeys(item, pathParts.concat(String(index))));
  }
  if (!value || typeof value !== 'object') return [];
  return Object.keys(value).flatMap((key) => (
    [pathParts.concat(key).join('.')].concat(collectKeys(value[key], pathParts.concat(key)))
  ));
}

function assertNoForbiddenPublicFields(value) {
  const keys = collectKeys(value);
  for (const forbidden of [
    'reviewPacket',
    'reviewSurface',
    'parsedReviewSurface',
    'activeReviewSession',
    'previewInput',
    'applyOps',
    'applyPlan',
    'canApply',
    'canCreateReviewPacket',
    'canPreviewApply',
    'canImportMutate',
    'canWriteStorage',
    'writeReceipt',
    'importReceipt',
    'exportReceipt',
    'safeCreatePlan',
    'rawBytes',
    'bufferSource',
    'filePath',
    'projectRoot',
    'packageInspection',
    'partPolicy',
    'intakePreflightReport',
    'docxIntakePreflightReport',
    'outPath',
    'outDir',
    'storage',
    'renderer',
    'preload',
    'path',
    'bytes',
    'zip',
    'receipt',
  ]) {
    assert.equal(keys.some((key) => key === forbidden || key.endsWith(`.${forbidden}`)), false, forbidden);
  }
}

test('TXT local file preview: utf8 txt becomes pathless preview envelope', async () => {
  const bytes = Buffer.from('\uFEFFAlpha\r\nBravo', 'utf8');
  const result = await createTxtImportLocalFilePreview(
    { requestId: 'txt-preview-1' },
    {
      pickLocalFile: async () => ({
        path: path.join(os.tmpdir(), 'Draft.txt'),
        size: bytes.length,
      }),
      readLocalFileBytes: async () => bytes,
    },
  );

  assert.equal(result.ok, true);
  assert.equal(result.requestId, 'txt-preview-1');
  assert.equal(result.schemaVersion, TXT_IMPORT_LOCAL_FILE_PREVIEW_SCHEMA);
  assert.equal(result.type, TXT_IMPORT_LOCAL_FILE_PREVIEW_TYPE);
  assert.equal(result.status, 'preview');
  assert.equal(result.code, 'TXT_IMPORT_LOCAL_FILE_PREVIEW_READY');
  assert.equal(result.reason, 'TXT_IMPORT_LOCAL_FILE_PREVIEW_READY');
  assert.equal(result.writeEffects, false);
  assert.equal(result.importPreviewOk, true);
  assert.equal(result.sourceSummary.sourceName, 'Draft.txt');
  assert.equal(result.sourceSummary.encoding, 'utf-8');
  assert.equal(result.sourceSummary.hasUtf8Bom, true);
  assert.equal(result.sourceSummary.byteLength, bytes.length);
  assert.equal(result.sourceSummary.textLength, 'Alpha\nBravo'.length);
  assert.equal(result.sourceSummary.lineCount, 2);
  assert.equal(result.txtImportPreviewPlan.code, 'TXT_IMPORT_PREVIEW_READY');
  assert.equal(result.txtImportPreviewPlan.candidateCreatePlan.mode, 'create-only');
  assert.equal(result.txtImportPreviewPlan.candidateCreatePlan.entryCount, 1);
  assert.equal(result.txtImportPreviewPlan.candidateCreatePlan.entries[0].content, 'Alpha\nBravo');
  assertNoForbiddenPublicFields(result);
});

test('TXT local file preview: picker cancel stays write-free and pathless', async () => {
  const result = await createTxtImportLocalFilePreview(
    { requestId: 'txt-preview-cancel' },
    {
      pickLocalFile: async () => ({ canceled: true }),
      readLocalFileBytes: async () => Buffer.from('unused', 'utf8'),
    },
  );

  assert.equal(result.ok, true);
  assert.equal(result.status, 'cancelled');
  assert.equal(result.code, 'TXT_IMPORT_LOCAL_FILE_PREVIEW_PICKER_CANCELLED');
  assert.equal(result.writeEffects, false);
  assert.equal(result.importPreviewOk, false);
  assert.equal(result.sourceSummary, null);
  assert.equal(result.txtImportPreviewPlan, null);
  assertNoForbiddenPublicFields(result);
});

test('TXT local file preview: utf16 content fails closed before preview plan exists', async () => {
  const utf16leBytes = Buffer.from([0xff, 0xfe, 0x41, 0x00, 0x42, 0x00]);
  const result = await createTxtImportLocalFilePreview(
    { requestId: 'txt-preview-utf16' },
    {
      pickLocalFile: async () => ({
        path: path.join(os.tmpdir(), 'Utf16.txt'),
        size: utf16leBytes.length,
      }),
      readLocalFileBytes: async () => utf16leBytes,
    },
  );

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'TXT_IMPORT_LOCAL_FILE_PREVIEW_ENCODING_UNSUPPORTED');
  assert.equal(result.error.reason, 'TXT_IMPORT_LOCAL_FILE_PREVIEW_ENCODING_UNSUPPORTED');
});

test('TXT local file preview: oversize selection is blocked before read', async () => {
  let readCalls = 0;
  const result = await createTxtImportLocalFilePreview(
    { requestId: 'txt-preview-too-large' },
    {
      pickLocalFile: async () => ({
        path: path.join(os.tmpdir(), 'Large.txt'),
        size: TXT_IMPORT_LOCAL_FILE_PREVIEW_MAX_BYTES + 1,
      }),
      readLocalFileBytes: async () => {
        readCalls += 1;
        return Buffer.from('too-late', 'utf8');
      },
    },
  );

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'TXT_IMPORT_LOCAL_FILE_PREVIEW_FILE_TOO_LARGE');
  assert.equal(readCalls, 0);
});

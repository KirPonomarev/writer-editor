const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { deflateRawSync } = require('node:zlib');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MODULE_PATH = path.join(REPO_ROOT, 'src', 'utils', 'docxImportLocalFilePreview.js');
const BRIDGE_MODULE_PATH = path.join(REPO_ROOT, 'src', 'io', 'revisionBridge', 'index.mjs');

const {
  DOCX_IMPORT_LOCAL_FILE_PREVIEW_SCHEMA,
  DOCX_IMPORT_LOCAL_FILE_PREVIEW_TYPE,
  DOCX_IMPORT_LOCAL_FILE_PREVIEW_MAX_BYTES,
  DOCX_IMPORT_LOCAL_FILE_PREVIEW_CODES,
  createDocxImportLocalFilePreview,
} = require('../../src/utils/docxImportLocalFilePreview');

function readModuleSource() {
  return fs.readFileSync(MODULE_PATH, 'utf8');
}

async function loadBridge() {
  return import(pathToFileURL(BRIDGE_MODULE_PATH).href);
}

function asciiBytes(value) {
  return Buffer.from(value, 'ascii');
}

function utf8Bytes(value) {
  return Buffer.from(value, 'utf8');
}

function normalizeEntry(entry) {
  const body = Buffer.isBuffer(entry.body)
    ? entry.body
    : utf8Bytes(typeof entry.body === 'string' ? entry.body : '');
  const method = entry.method ?? 0;
  const compressedBody = method === 8 ? deflateRawSync(body) : body;
  return {
    name: entry.name,
    method,
    body,
    compressedBody,
    byteSize: entry.byteSize ?? body.length,
    compressedSize: entry.compressedSize ?? compressedBody.length,
  };
}

function localRecord(entry, offset) {
  const normalized = normalizeEntry(entry);
  const name = asciiBytes(normalized.name);
  const header = Buffer.alloc(30 + name.length);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(entry.flags ?? 0, 6);
  header.writeUInt16LE(normalized.method, 8);
  header.writeUInt32LE(0, 14);
  header.writeUInt32LE(normalized.compressedSize, 18);
  header.writeUInt32LE(normalized.byteSize, 22);
  header.writeUInt16LE(name.length, 26);
  name.copy(header, 30);
  return {
    ...normalized,
    offset,
    bytes: Buffer.concat([header, normalized.compressedBody]),
  };
}

function centralRecord(entry) {
  const name = asciiBytes(entry.name);
  const header = Buffer.alloc(46 + name.length);
  header.writeUInt32LE(0x02014b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(20, 6);
  header.writeUInt16LE(entry.flags ?? 0, 8);
  header.writeUInt16LE(entry.method, 10);
  header.writeUInt32LE(0, 16);
  header.writeUInt32LE(entry.compressedSize, 20);
  header.writeUInt32LE(entry.byteSize, 24);
  header.writeUInt16LE(name.length, 28);
  header.writeUInt16LE(0, 30);
  header.writeUInt16LE(0, 32);
  header.writeUInt16LE(0, 34);
  header.writeUInt32LE(entry.offset, 42);
  name.copy(header, 46);
  return header;
}

function zipFixture(entries) {
  const locals = [];
  let offset = 0;
  for (const entry of entries) {
    const local = localRecord(entry, offset);
    locals.push(local);
    offset += local.bytes.length;
  }
  const central = Buffer.concat(locals.map((entry) => centralRecord(entry)));
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(locals.length, 8);
  end.writeUInt16LE(locals.length, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([Buffer.concat(locals.map((entry) => entry.bytes)), central, end]);
}

function documentXml(body) {
  return `<w:document><w:body>${body}</w:body></w:document>`;
}

function paragraphXml(text) {
  return `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;
}

function cleanDocxZip(body = '<w:p/>') {
  return zipFixture([
    {
      name: 'word/document.xml',
      method: 8,
      body: documentXml(body),
    },
  ]);
}

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
  const forbidden = [
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
  ];

  for (const key of forbidden) {
    assert.equal(
      keys.some((candidate) => candidate === key || candidate.endsWith(`.${key}`)),
      false,
      key,
    );
  }
}

test('DOCX local file preview adapter: exports bounded local preview contract only', () => {
  const source = readModuleSource();

  assert.equal(DOCX_IMPORT_LOCAL_FILE_PREVIEW_SCHEMA, 'revision-bridge.docx-import-local-file-preview.v1');
  assert.equal(DOCX_IMPORT_LOCAL_FILE_PREVIEW_TYPE, 'docx.import.localFilePreview');
  assert.equal(DOCX_IMPORT_LOCAL_FILE_PREVIEW_MAX_BYTES, 10 * 1024 * 1024);
  assert.equal(typeof createDocxImportLocalFilePreview, 'function');
  assert.equal(source.includes('applyDocxImportSafeCreate'), false);
  assert.equal(source.includes('writeFlowSceneBatchAtomic'), false);
  assert.equal(source.includes('.flow-batch'), false);
  assert.equal(source.includes('fetch('), false);
  assert.equal(source.includes('ipcMain'), false);
  assert.equal(source.includes('BrowserWindow'), false);
  assert.equal(source.includes('showOpenDialog'), false);
  assert.equal(source.includes('MENU_COMMAND_HANDLERS'), false);
  assert.equal(source.includes('EXPORT_DOCX'), false);
  assert.equal(source.includes('MARKDOWN'), false);
});

test('DOCX local file preview adapter: clean local DOCX becomes pathless preview envelope with text and loss report', async () => {
  const result = await createDocxImportLocalFilePreview(
    { requestId: 'local-preview-1' },
    {
      pickLocalFile: async () => ({ path: path.join(os.tmpdir(), 'Preview.docx') }),
      readLocalFileBytes: async () => cleanDocxZip([
        paragraphXml('Alpha'),
        paragraphXml('Bravo'),
      ].join('')),
      loadRevisionBridgeModule: loadBridge,
    },
  );

  assert.equal(result.ok, true);
  assert.equal(result.requestId, 'local-preview-1');
  assert.equal(result.schemaVersion, 'revision-bridge.docx-import-local-file-preview.v1');
  assert.equal(result.type, 'docx.import.localFilePreview');
  assert.equal(result.status, 'preview');
  assert.equal(result.code, 'DOCX_IMPORT_LOCAL_FILE_PREVIEW_READY');
  assert.equal(result.reason, 'DOCX_IMPORT_LOCAL_FILE_PREVIEW_READY');
  assert.equal(result.writeEffects, false);
  assert.equal(result.contentPreviewOk, true);
  assert.equal(result.importPreviewOk, true);
  assert.equal(result.docxContentPreviewReport.code, 'DOCX_CONTENT_PREVIEW_READY');
  assert.deepEqual(result.docxContentPreviewReport.contentPreview.paragraphs.map((entry) => entry.text), [
    'Alpha',
    'Bravo',
  ]);
  assert.equal(result.docxImportPreviewPlan.code, 'DOCX_IMPORT_PREVIEW_READY');
  assert.equal(result.docxImportPreviewPlan.candidateCreatePlan.mode, 'create-only');
  assert.equal(result.docxImportPreviewPlan.candidateCreatePlan.entries[0].content, 'Alpha\n\nBravo');
  assert.equal(result.docxImportPreviewPlan.lossReport.mode, 'plain-text-only');
  assertNoForbiddenPublicFields(result);
});

test('DOCX local file preview adapter: hostile duplicate DOCX is blocked before import preview planning', async () => {
  const bridge = await loadBridge();
  const calls = { importPreview: 0 };
  const result = await createDocxImportLocalFilePreview(
    { requestId: 'local-preview-duplicate' },
    {
      pickLocalFile: async () => ({ path: path.join(os.tmpdir(), 'Duplicate.docx') }),
      readLocalFileBytes: async () => zipFixture([
        { name: 'word/document.xml', body: '<root/>' },
        { name: 'WORD/DOCUMENT.XML', body: '<root/>' },
      ]),
      loadRevisionBridgeModule: async () => ({
        buildDocxContentPreviewFromZipBytes: bridge.buildDocxContentPreviewFromZipBytes,
        buildDocxImportPreviewPlanFromContentPreview(input) {
          calls.importPreview += 1;
          return bridge.buildDocxImportPreviewPlanFromContentPreview(input);
        },
      }),
    },
  );

  assert.equal(result.ok, true);
  assert.equal(result.status, 'blocked');
  assert.equal(result.code, 'DOCX_IMPORT_LOCAL_FILE_PREVIEW_CONTENT_BLOCKED');
  assert.equal(result.importPreviewOk, false);
  assert.equal(result.docxContentPreviewReport.ok, false);
  assert.equal(result.docxContentPreviewReport.code, 'DOCX_CONTENT_PREVIEW_PREFLIGHT_BLOCKED');
  assert.equal(result.docxImportPreviewPlan, null);
  assert.equal(calls.importPreview, 0);
  assertNoForbiddenPublicFields(result);
});

test('DOCX local file preview adapter: malformed XML fails closed and does not build scene candidate', async () => {
  const result = await createDocxImportLocalFilePreview(
    { requestId: 'local-preview-malformed' },
    {
      pickLocalFile: async () => ({ path: path.join(os.tmpdir(), 'Malformed.docx') }),
      readLocalFileBytes: async () => cleanDocxZip('<w:p><w:r><w:t>Alpha</w:r></w:p>'),
      loadRevisionBridgeModule: loadBridge,
    },
  );

  assert.equal(result.ok, true);
  assert.equal(result.status, 'blocked');
  assert.equal(result.importPreviewOk, false);
  assert.equal(result.docxContentPreviewReport.ok, false);
  assert.equal(result.docxContentPreviewReport.code, 'DOCX_CONTENT_PREVIEW_XML_MALFORMED');
  assert.equal(result.docxImportPreviewPlan, null);
  assertNoForbiddenPublicFields(result);
});

test('DOCX local file preview adapter: unsupported extension and oversized bytes fail closed before preview helpers', async () => {
  let readCalls = 0;
  let loadCalls = 0;

  const unsupported = await createDocxImportLocalFilePreview(
    {},
    {
      pickLocalFile: async () => ({ path: path.join(os.tmpdir(), 'NotDocx.txt') }),
      readLocalFileBytes: async () => {
        readCalls += 1;
        return cleanDocxZip('<w:p/>');
      },
      loadRevisionBridgeModule: async () => {
        loadCalls += 1;
        return loadBridge();
      },
    },
  );

  assert.equal(unsupported.ok, false);
  assert.equal(unsupported.error.reason, DOCX_IMPORT_LOCAL_FILE_PREVIEW_CODES.EXTENSION_UNSUPPORTED);
  assert.equal(readCalls, 0);
  assert.equal(loadCalls, 0);

  const oversized = await createDocxImportLocalFilePreview(
    {},
    {
      pickLocalFile: async () => ({
        path: path.join(os.tmpdir(), 'Huge.docx'),
        size: DOCX_IMPORT_LOCAL_FILE_PREVIEW_MAX_BYTES + 1,
      }),
      readLocalFileBytes: async () => {
        readCalls += 1;
        return cleanDocxZip('<w:p/>');
      },
      loadRevisionBridgeModule: async () => {
        loadCalls += 1;
        return loadBridge();
      },
    },
  );

  assert.equal(oversized.ok, false);
  assert.equal(oversized.error.reason, DOCX_IMPORT_LOCAL_FILE_PREVIEW_CODES.FILE_TOO_LARGE);
  assert.equal(readCalls, 0);
  assert.equal(loadCalls, 0);

  const oversizedActualBytes = await createDocxImportLocalFilePreview(
    {},
    {
      pickLocalFile: async () => ({ path: path.join(os.tmpdir(), 'HugeActual.docx') }),
      readLocalFileBytes: async () => {
        readCalls += 1;
        return Buffer.alloc(DOCX_IMPORT_LOCAL_FILE_PREVIEW_MAX_BYTES + 1);
      },
      loadRevisionBridgeModule: async () => {
        loadCalls += 1;
        return loadBridge();
      },
    },
  );

  assert.equal(oversizedActualBytes.ok, false);
  assert.equal(oversizedActualBytes.error.reason, DOCX_IMPORT_LOCAL_FILE_PREVIEW_CODES.FILE_TOO_LARGE);
  assert.equal(readCalls, 1);
  assert.equal(loadCalls, 0);
});

test('DOCX local file preview adapter: renderer path injection is rejected and temp workspace stays unmodified', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'docx-local-preview-'));
  const before = fs.readdirSync(tempRoot);
  let pickerCalls = 0;

  const result = await createDocxImportLocalFilePreview(
    {
      requestId: 'renderer-untrusted',
      filePath: path.join(tempRoot, 'Injected.docx'),
    },
    {
      pickLocalFile: async () => {
        pickerCalls += 1;
        return { path: path.join(tempRoot, 'Ignored.docx') };
      },
      readLocalFileBytes: async () => cleanDocxZip('<w:p/>'),
      loadRevisionBridgeModule: loadBridge,
    },
  );

  const after = fs.readdirSync(tempRoot);
  assert.equal(result.ok, false);
  assert.equal(result.error.reason, DOCX_IMPORT_LOCAL_FILE_PREVIEW_CODES.INPUT_INVALID);
  assert.equal(pickerCalls, 0);
  assert.deepEqual(after, before);
});

test('DOCX local file preview adapter: local port failures and invalid request fail closed before preview', async () => {
  const cases = [
    {
      name: 'missing picker',
      input: {},
      options: { readLocalFileBytes: async () => cleanDocxZip('<w:p/>') },
      expectedReason: DOCX_IMPORT_LOCAL_FILE_PREVIEW_CODES.PICKER_UNAVAILABLE,
    },
    {
      name: 'missing reader',
      input: {},
      options: { pickLocalFile: async () => ({ path: path.join(os.tmpdir(), 'Preview.docx') }) },
      expectedReason: DOCX_IMPORT_LOCAL_FILE_PREVIEW_CODES.READER_UNAVAILABLE,
    },
    {
      name: 'picker cancel',
      input: {},
      options: {
        pickLocalFile: async () => ({ canceled: true }),
        readLocalFileBytes: async () => cleanDocxZip('<w:p/>'),
      },
      expectedReason: DOCX_IMPORT_LOCAL_FILE_PREVIEW_CODES.PICKER_CANCELLED,
    },
    {
      name: 'bad selection',
      input: {},
      options: {
        pickLocalFile: async () => ({ name: '' }),
        readLocalFileBytes: async () => cleanDocxZip('<w:p/>'),
      },
      expectedReason: DOCX_IMPORT_LOCAL_FILE_PREVIEW_CODES.SELECTION_INVALID,
    },
    {
      name: 'reader throw',
      input: {},
      options: {
        pickLocalFile: async () => ({ path: path.join(os.tmpdir(), 'Preview.docx') }),
        readLocalFileBytes: async () => {
          throw new Error('read failed');
        },
      },
      expectedReason: DOCX_IMPORT_LOCAL_FILE_PREVIEW_CODES.READ_FAILED,
    },
    {
      name: 'empty bytes',
      input: {},
      options: {
        pickLocalFile: async () => ({ path: path.join(os.tmpdir(), 'Preview.docx') }),
        readLocalFileBytes: async () => Buffer.alloc(0),
      },
      expectedReason: DOCX_IMPORT_LOCAL_FILE_PREVIEW_CODES.BYTES_INVALID,
    },
    {
      name: 'long request id',
      input: { requestId: 'x'.repeat(121) },
      options: {
        pickLocalFile: async () => ({ path: path.join(os.tmpdir(), 'Preview.docx') }),
        readLocalFileBytes: async () => cleanDocxZip('<w:p/>'),
      },
      expectedReason: DOCX_IMPORT_LOCAL_FILE_PREVIEW_CODES.INPUT_INVALID,
    },
  ];

  for (const item of cases) {
    let bridgeLoadCalls = 0;
    const result = await createDocxImportLocalFilePreview(item.input, {
      ...item.options,
      loadRevisionBridgeModule: async () => {
        bridgeLoadCalls += 1;
        return loadBridge();
      },
    });

    assert.equal(result.ok, false, item.name);
    assert.equal(result.error.reason, item.expectedReason, item.name);
    assertNoForbiddenPublicFields(result);
    assert.equal(bridgeLoadCalls, 0, item.name);
  }
});

test('DOCX local file preview adapter: bridge and helper failures stay pathless and fail closed', async () => {
  const baseOptions = {
    pickLocalFile: async () => ({ path: path.join(os.tmpdir(), 'Preview.docx') }),
    readLocalFileBytes: async () => cleanDocxZip(paragraphXml('Alpha')),
  };

  const bridgeMissing = await createDocxImportLocalFilePreview({}, {
    ...baseOptions,
    loadRevisionBridgeModule: async () => ({}),
  });
  assert.equal(bridgeMissing.ok, false);
  assert.equal(bridgeMissing.error.reason, DOCX_IMPORT_LOCAL_FILE_PREVIEW_CODES.BRIDGE_UNAVAILABLE);
  assertNoForbiddenPublicFields(bridgeMissing);

  const contentThrows = await createDocxImportLocalFilePreview({}, {
    ...baseOptions,
    loadRevisionBridgeModule: async () => ({
      buildDocxContentPreviewFromZipBytes() {
        throw new Error('content failed');
      },
      buildDocxImportPreviewPlanFromContentPreview() {
        return null;
      },
    }),
  });
  assert.equal(contentThrows.ok, false);
  assert.equal(contentThrows.error.reason, DOCX_IMPORT_LOCAL_FILE_PREVIEW_CODES.CONTENT_REPORT_INVALID);
  assertNoForbiddenPublicFields(contentThrows);

  const importThrows = await createDocxImportLocalFilePreview({}, {
    ...baseOptions,
    loadRevisionBridgeModule: async () => ({
      buildDocxContentPreviewFromZipBytes: () => ({
        ok: true,
        schemaVersion: 'revision-bridge.docx-content-preview.v1',
        type: 'docxContentPreviewReport',
        status: 'preview',
        code: 'DOCX_CONTENT_PREVIEW_READY',
        reason: 'DOCX_CONTENT_PREVIEW_READY',
        decision: 'preview',
        diagnostics: [],
        evidence: [],
        budgets: {},
        preflightSummary: {},
        contentPreview: { paragraphs: [] },
        parse: { attempted: true, completed: true },
      }),
      buildDocxImportPreviewPlanFromContentPreview() {
        throw new Error('import failed');
      },
    }),
  });
  assert.equal(importThrows.ok, false);
  assert.equal(importThrows.error.reason, DOCX_IMPORT_LOCAL_FILE_PREVIEW_CODES.IMPORT_PLAN_INVALID);
  assertNoForbiddenPublicFields(importThrows);

  const importNull = await createDocxImportLocalFilePreview({}, {
    ...baseOptions,
    loadRevisionBridgeModule: async () => ({
      buildDocxContentPreviewFromZipBytes: () => ({
        ok: true,
        schemaVersion: 'revision-bridge.docx-content-preview.v1',
        type: 'docxContentPreviewReport',
        status: 'preview',
        code: 'DOCX_CONTENT_PREVIEW_READY',
        reason: 'DOCX_CONTENT_PREVIEW_READY',
        decision: 'preview',
        diagnostics: [],
        evidence: [],
        budgets: {},
        preflightSummary: {},
        contentPreview: { paragraphs: [] },
        parse: { attempted: true, completed: true },
      }),
      buildDocxImportPreviewPlanFromContentPreview: () => null,
    }),
  });
  assert.equal(importNull.ok, false);
  assert.equal(importNull.error.reason, DOCX_IMPORT_LOCAL_FILE_PREVIEW_CODES.IMPORT_PLAN_INVALID);
  assertNoForbiddenPublicFields(importNull);
});

test('DOCX local file preview adapter: hostile bridge output triggers forbidden output guard', async () => {
  const hostile = await createDocxImportLocalFilePreview({}, {
    pickLocalFile: async () => ({ path: path.join(os.tmpdir(), 'Preview.docx') }),
    readLocalFileBytes: async () => cleanDocxZip(paragraphXml('Alpha')),
    loadRevisionBridgeModule: async () => ({
      buildDocxContentPreviewFromZipBytes: () => ({
        ok: true,
        schemaVersion: 'revision-bridge.docx-content-preview.v1',
        type: 'docxContentPreviewReport',
        status: 'preview',
        code: 'DOCX_CONTENT_PREVIEW_READY',
        reason: 'DOCX_CONTENT_PREVIEW_READY',
        decision: 'preview',
        diagnostics: [],
        evidence: [],
        budgets: {},
        preflightSummary: {},
        contentPreview: { paragraphs: [] },
        parse: { attempted: true, completed: true },
      }),
      buildDocxImportPreviewPlanFromContentPreview: () => ({
        ok: true,
        schemaVersion: 'revision-bridge.docx-import-preview.v1',
        type: 'docx.import.preview',
        status: 'preview',
        code: 'DOCX_IMPORT_PREVIEW_READY',
        reason: 'DOCX_IMPORT_PREVIEW_READY',
        decision: 'preview',
        writeEffects: false,
        diagnostics: [],
        evidence: [],
        budgets: {},
        source: {},
        candidateCreatePlan: {
          mode: 'create-only',
          sceneStrategy: 'single-scene',
          entryCount: 1,
          entries: [{
            sceneId: 'docx-import-scene-hostile',
            kind: 'scene',
            title: 'Imported DOCX',
            content: 'Alpha',
            contentTextHash: '00000000',
            source: {},
          }],
        },
        lossReport: { schemaVersion: 'revision-bridge.docx-import-preview.loss-report.v1', mode: 'plain-text-only' },
        previewHash: '00000000',
        writeReceipt: { path: '/tmp/leak' },
      }),
    }),
  });

  assert.equal(hostile.ok, false);
  assert.equal(hostile.error.reason, DOCX_IMPORT_LOCAL_FILE_PREVIEW_CODES.OUTPUT_FORBIDDEN);
  assert.equal(hostile.error.details.key, 'docxImportPreviewPlan.writeReceipt');
  assertNoForbiddenPublicFields(hostile);
});

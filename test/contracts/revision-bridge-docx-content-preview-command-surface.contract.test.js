const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { deflateRawSync } = require('node:zlib');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MAIN_PATH = path.join(REPO_ROOT, 'src', 'main.js');
const BRIDGE_MODULE_PATH = path.join(REPO_ROOT, 'src', 'io', 'revisionBridge', 'index.mjs');
const SECTION_START = '// DOCX_CONTENT_PREVIEW_COMMAND_SURFACE_START';
const SECTION_END = '// DOCX_CONTENT_PREVIEW_COMMAND_SURFACE_END';

function readMainSource() {
  return fs.readFileSync(MAIN_PATH, 'utf8');
}

function extractMarkedSection(text, startMarker, endMarker) {
  const start = text.indexOf(startMarker);
  const end = text.indexOf(endMarker);
  assert.notEqual(start, -1, `missing marker: ${startMarker}`);
  assert.notEqual(end, -1, `missing marker: ${endMarker}`);
  assert.ok(end > start, `marker order invalid: ${startMarker}`);
  return text.slice(start, end + endMarker.length);
}

function cloneJsonSafe(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function isPlainObjectValue(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

async function loadBridge() {
  return import(pathToFileURL(BRIDGE_MODULE_PATH).href);
}

function instantiateDocxContentPreviewPort(options = {}) {
  const mainSource = readMainSource();
  const section = extractMarkedSection(mainSource, SECTION_START, SECTION_END);
  const sandbox = {
    Buffer,
    cloneJsonSafe,
    isPlainObjectValue,
    loadRevisionBridgeModule: typeof options.loadRevisionBridgeModule === 'function'
      ? options.loadRevisionBridgeModule
      : loadBridge,
    module: { exports: {} },
    exports: {},
  };
  vm.runInNewContext(
    `${section}
module.exports = {
  DOCX_CONTENT_PREVIEW_COMMAND_ID,
  DOCX_CONTENT_PREVIEW_MAX_BASE64_CHARS,
  DOCX_CONTENT_PREVIEW_MAX_BYTES,
  decodeDocxContentPreviewBufferSource,
  buildDocxContentPreviewCommandResult,
  handleDocxContentPreviewCommandSurface,
};`,
    sandbox,
    { filename: MAIN_PATH },
  );
  return sandbox.module.exports;
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

function toPayload(bytes, overrides = {}) {
  return {
    requestId: 'request-1',
    bufferSource: Buffer.from(bytes).toString('base64'),
    ...overrides,
  };
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

function assertNoForbiddenResultFields(result) {
  const resultKeys = collectKeys(result);
  const forbiddenResultKeys = [
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
    'rawBytes',
    'bufferSource',
    'filePath',
    'inventory',
    'entries',
  ];

  for (const forbidden of forbiddenResultKeys) {
    assert.equal(
      resultKeys.some((key) => key === forbidden || key.endsWith(`.${forbidden}`)),
      false,
      forbidden,
    );
  }
}

test('DOCX content preview command surface: command id is bridge-allowlisted and handler-owned', () => {
  const source = readMainSource();

  assert.match(
    source,
    /UI_COMMAND_BRIDGE_ALLOWED_COMMAND_IDS\s*=\s*new Set\(\[[\s\S]*'cmd\.project\.docx\.previewContent'/,
  );
  assert.match(
    source,
    /'cmd\.project\.docx\.previewContent':\s*async\s*\(payload\s*=\s*\{\}\)\s*=>\s*\{\s*return handleDocxContentPreviewCommandSurface\(payload\);/,
  );
});

test('DOCX content preview command surface: clean container returns wrapped preview report', async () => {
  const port = instantiateDocxContentPreviewPort();
  const result = await port.handleDocxContentPreviewCommandSurface(toPayload(cleanDocxZip([
    paragraphXml('Alpha'),
    paragraphXml('Bravo'),
  ].join(''))));

  assert.equal(result.ok, true);
  assert.equal(result.requestId, 'request-1');
  assert.equal(result.commandId, 'cmd.project.docx.previewContent');
  assert.equal(result.previewOk, true);
  assert.equal(result.previewStatus, 'preview');
  assert.equal(result.previewCode, 'DOCX_CONTENT_PREVIEW_READY');
  assert.equal(result.docxContentPreviewReport.ok, true);
  assert.equal(result.docxContentPreviewReport.schemaVersion, 'revision-bridge.docx-content-preview.v1');
  assert.equal(result.docxContentPreviewReport.type, 'docxContentPreviewReport');
  assert.deepEqual(result.docxContentPreviewReport.contentPreview.paragraphs.map((paragraph) => paragraph.text), [
    'Alpha',
    'Bravo',
  ]);
  assertNoForbiddenResultFields(result);
});

test('DOCX content preview command surface: blocked and malformed reports do not become command failures', async () => {
  const port = instantiateDocxContentPreviewPort();
  const duplicate = await port.handleDocxContentPreviewCommandSurface(toPayload(zipFixture([
    { name: 'word/document.xml', body: documentXml(paragraphXml('A')) },
    { name: 'WORD/DOCUMENT.XML', body: documentXml(paragraphXml('B')) },
  ])));
  const malformedXml = await port.handleDocxContentPreviewCommandSurface(toPayload(cleanDocxZip(
    '<w:p><w:r><w:t>Leaked</w:p></w:r>',
  )));

  for (const result of [duplicate, malformedXml]) {
    assert.equal(result.ok, true);
    assert.equal(result.previewOk, false);
    assert.equal(result.docxContentPreviewReport.ok, false);
    assert.equal(Object.prototype.hasOwnProperty.call(result, 'reviewPacket'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(result, 'importReceipt'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(result, 'writeReceipt'), false);
  }
  assert.equal(duplicate.previewCode, 'DOCX_CONTENT_PREVIEW_PREFLIGHT_BLOCKED');
  assert.equal(duplicate.previewReason, 'STAGE02_DUPLICATE_ENTRY_NAME');
  assert.equal(malformedXml.previewCode, 'DOCX_CONTENT_PREVIEW_XML_MALFORMED');
  assert.equal(malformedXml.docxContentPreviewReport.parse.attempted, true);
});

test('DOCX content preview command surface: malformed payloads fail as typed command errors', async () => {
  const port = instantiateDocxContentPreviewPort();

  const missing = await port.handleDocxContentPreviewCommandSurface({});
  const nonObject = await port.handleDocxContentPreviewCommandSurface(null);
  const invalid = await port.handleDocxContentPreviewCommandSurface({ bufferSource: '@@@@' });
  const oversized = await port.handleDocxContentPreviewCommandSurface({
    bufferSource: 'A'.repeat(port.DOCX_CONTENT_PREVIEW_MAX_BASE64_CHARS + 4),
  });
  const pathInput = await port.handleDocxContentPreviewCommandSurface({
    filePath: '/tmp/input.docx',
  });
  const mixedTransport = await port.handleDocxContentPreviewCommandSurface(toPayload(cleanDocxZip(), {
    bytes: [1, 2, 3],
    raw: '<w:document/>',
    zip: {},
  }));

  assert.deepEqual(cloneJsonSafe(missing), {
    ok: false,
    error: {
      code: 'E_DOCX_CONTENT_PREVIEW_PAYLOAD_INVALID',
      op: 'cmd.project.docx.previewContent',
      reason: 'DOCX_CONTENT_PREVIEW_BUFFER_SOURCE_REQUIRED',
    },
  });
  assert.deepEqual(cloneJsonSafe(nonObject), {
    ok: false,
    error: {
      code: 'E_DOCX_CONTENT_PREVIEW_PAYLOAD_INVALID',
      op: 'cmd.project.docx.previewContent',
      reason: 'DOCX_CONTENT_PREVIEW_PAYLOAD_REQUIRED',
    },
  });
  assert.deepEqual(cloneJsonSafe(invalid), {
    ok: false,
    error: {
      code: 'E_DOCX_CONTENT_PREVIEW_PAYLOAD_INVALID',
      op: 'cmd.project.docx.previewContent',
      reason: 'DOCX_CONTENT_PREVIEW_BUFFER_SOURCE_BASE64_INVALID',
    },
  });
  assert.equal(oversized.ok, false);
  assert.equal(oversized.error.op, 'cmd.project.docx.previewContent');
  assert.equal(oversized.error.code, 'E_DOCX_CONTENT_PREVIEW_PAYLOAD_TOO_LARGE');
  assert.equal(oversized.error.reason, 'DOCX_CONTENT_PREVIEW_BUFFER_SOURCE_TOO_LARGE');
  assert.equal(pathInput.ok, false);
  assert.equal(pathInput.error.reason, 'DOCX_CONTENT_PREVIEW_PAYLOAD_UNSUPPORTED_FIELDS');
  assert.deepEqual(pathInput.error.details.fields, ['filePath']);
  assert.equal(mixedTransport.ok, false);
  assert.equal(mixedTransport.error.reason, 'DOCX_CONTENT_PREVIEW_PAYLOAD_UNSUPPORTED_FIELDS');
  assert.deepEqual(mixedTransport.error.details.fields, ['bytes', 'raw', 'zip']);
});

test('DOCX content preview command surface: helper failures and forbidden results fail closed', async () => {
  const unavailable = instantiateDocxContentPreviewPort({
    loadRevisionBridgeModule: async () => {
      throw new Error('bridge unavailable');
    },
  });
  const helperUnavailable = instantiateDocxContentPreviewPort({
    loadRevisionBridgeModule: async () => ({}),
  });
  const helperThrows = instantiateDocxContentPreviewPort({
    loadRevisionBridgeModule: async () => ({
      buildDocxContentPreviewFromZipBytes: () => {
        throw new Error('preview crash');
      },
    }),
  });
  const invalidResult = instantiateDocxContentPreviewPort({
    loadRevisionBridgeModule: async () => ({
      buildDocxContentPreviewFromZipBytes: () => null,
    }),
  });
  const forbiddenResult = instantiateDocxContentPreviewPort({
    loadRevisionBridgeModule: async () => ({
      buildDocxContentPreviewFromZipBytes: () => ({
        ok: true,
        status: 'preview',
        code: 'DOCX_CONTENT_PREVIEW_READY',
        reason: 'DOCX_CONTENT_PREVIEW_READY',
        reviewPacket: {},
      }),
    }),
  });

  const unavailableResult = await unavailable.handleDocxContentPreviewCommandSurface(toPayload(cleanDocxZip()));
  const helperUnavailableResult = await helperUnavailable.handleDocxContentPreviewCommandSurface(toPayload(cleanDocxZip()));
  const helperThrowsResult = await helperThrows.handleDocxContentPreviewCommandSurface(toPayload(cleanDocxZip()));
  const invalidResultValue = await invalidResult.handleDocxContentPreviewCommandSurface(toPayload(cleanDocxZip()));
  const forbiddenResultValue = await forbiddenResult.handleDocxContentPreviewCommandSurface(toPayload(cleanDocxZip()));

  assert.equal(unavailableResult.ok, false);
  assert.equal(unavailableResult.error.code, 'E_DOCX_CONTENT_PREVIEW_UNAVAILABLE');
  assert.equal(unavailableResult.error.reason, 'DOCX_CONTENT_PREVIEW_BRIDGE_UNAVAILABLE');
  assert.equal(helperUnavailableResult.ok, false);
  assert.equal(helperUnavailableResult.error.code, 'E_DOCX_CONTENT_PREVIEW_UNAVAILABLE');
  assert.equal(helperUnavailableResult.error.reason, 'DOCX_CONTENT_PREVIEW_HELPER_UNAVAILABLE');
  assert.equal(helperThrowsResult.ok, false);
  assert.equal(helperThrowsResult.error.code, 'E_DOCX_CONTENT_PREVIEW_FAILED');
  assert.equal(helperThrowsResult.error.reason, 'DOCX_CONTENT_PREVIEW_EXECUTION_FAILED');
  assert.equal(invalidResultValue.ok, false);
  assert.equal(invalidResultValue.error.code, 'E_DOCX_CONTENT_PREVIEW_INVALID_RESULT');
  assert.equal(forbiddenResultValue.ok, false);
  assert.equal(forbiddenResultValue.error.code, 'E_DOCX_CONTENT_PREVIEW_FORBIDDEN_RESULT');
  assert.equal(forbiddenResultValue.error.details.key, 'reviewPacket');
});

test('DOCX content preview command surface: contour section stays out of UI import review storage export layers', () => {
  const section = extractMarkedSection(readMainSource(), SECTION_START, SECTION_END);
  const forbiddenRuntimeMarkers = [
    'fs.',
    'readFile',
    'writeFile',
    'writeFileAtomic',
    'writeBufferAtomic',
    'exactTextMinSafeWrite',
    'buildDocxMinBuffer',
    'runDocxMinExport',
    'applyMarkdownImportSafeCreate',
    'handleReviewSurfaceImportPacketCommandSurface',
    'activeReviewSessionStore =',
    'currentReviewSurfacePayload =',
    'ipcMain',
    'BrowserWindow',
    'dialog.',
    'fetch',
    'http',
    'https',
    'reviewPacket',
    'reviewSurface',
    'parsedReviewSurface',
    'activeReviewSession',
    'applyOps',
    'canApply: true',
    'writeReceipt',
    'importReceipt',
    'exportReceipt',
  ];

  for (const marker of forbiddenRuntimeMarkers) {
    assert.equal(section.includes(marker), false, `${marker} must stay out of DOCX content preview command surface`);
  }
});

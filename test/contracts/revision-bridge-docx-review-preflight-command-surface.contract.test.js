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
const INTAKE_SECTION_START = '// DOCX_INTAKE_GATE_COMMAND_SURFACE_START';
const INTAKE_SECTION_END = '// DOCX_INTAKE_GATE_COMMAND_SURFACE_END';
const REVIEW_SECTION_START = '// DOCX_REVIEW_PREFLIGHT_COMMAND_SURFACE_START';
const REVIEW_SECTION_END = '// DOCX_REVIEW_PREFLIGHT_COMMAND_SURFACE_END';

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

function instantiateDocxReviewPreflightPort(options = {}) {
  const mainSource = readMainSource();
  const intakeSection = extractMarkedSection(mainSource, INTAKE_SECTION_START, INTAKE_SECTION_END);
  const reviewSection = extractMarkedSection(mainSource, REVIEW_SECTION_START, REVIEW_SECTION_END);
  const sandbox = {
    activeReviewSessionStore: null,
    activeReviewSessionLifecycle: 'passive',
    currentReviewSurfacePayload: {},
    currentReviewSurfacePayloadSource: 'none',
    currentReviewSurfacePayloadContentHash: '',
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
    `${intakeSection}
${reviewSection}
module.exports = {
  DOCX_REVIEW_PREFLIGHT_COMMAND_ID,
  handleDocxReviewPreflightCommandSurface,
  getState() {
    return {
      activeReviewSessionStore,
      activeReviewSessionLifecycle,
      currentReviewSurfacePayload,
      currentReviewSurfacePayloadSource,
      currentReviewSurfacePayloadContentHash,
    };
  },
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

function toPayload(bytes, overrides = {}) {
  return {
    requestId: 'review-preflight-request',
    bufferSource: Buffer.from(bytes).toString('base64'),
    ...overrides,
  };
}

function cleanDocxZip(body = '<w:p/>', extraEntries = []) {
  return zipFixture([
    {
      name: 'word/document.xml',
      method: 8,
      body: documentXml(body),
    },
    ...extraEntries,
  ]);
}

test('DOCX review preflight command surface: command is bridge-allowlisted and handler-owned', () => {
  const source = readMainSource();

  assert.match(
    source,
    /UI_COMMAND_BRIDGE_ALLOWED_COMMAND_IDS\s*=\s*new Set\(\[[\s\S]*'cmd\.project\.review\.inspectDocxReviewPreflight'/,
  );
  assert.match(
    source,
    /'cmd\.project\.review\.inspectDocxReviewPreflight':\s*async\s*\(payload\s*=\s*\{\}\)\s*=>\s*\{\s*return handleDocxReviewPreflightCommandSurface\(payload\);/,
  );
});

test('DOCX review preflight command surface: evidence report does not create session or apply authority', async () => {
  const port = instantiateDocxReviewPreflightPort();
  const result = await port.handleDocxReviewPreflightCommandSurface(toPayload(cleanDocxZip([
    '<w:p><w:r><w:t>Base</w:t></w:r></w:p>',
    '<w:ins><w:p><w:r><w:t>Inserted</w:t></w:r></w:p></w:ins>',
  ].join(''))));

  assert.equal(result.ok, true);
  assert.equal(result.commandId, 'cmd.project.review.inspectDocxReviewPreflight');
  assert.equal(result.requestId, 'review-preflight-request');
  assert.equal(result.hasReviewEvidence, true);
  assert.equal(result.trackedChangesEvidence.present, true);
  assert.equal(result.canOpenReviewSession, false);
  assert.equal(result.canAutoApply, false);
  assert.equal(result.canCreateReviewPacket, false);
  assert.equal(result.canImportMutate, false);
  assert.equal(result.canWriteStorage, false);
  assert.equal(Object.prototype.hasOwnProperty.call(result, 'reviewSurface'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result, 'reviewPacket'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result, 'receipt'), false);
  assert.deepEqual(cloneJsonSafe(port.getState()), {
    activeReviewSessionStore: null,
    activeReviewSessionLifecycle: 'passive',
    currentReviewSurfacePayload: {},
    currentReviewSurfacePayloadSource: 'none',
    currentReviewSurfacePayloadContentHash: '',
  });
});

test('DOCX review preflight command surface: forbidden payload fields are rejected before inspection', async () => {
  const port = instantiateDocxReviewPreflightPort();
  const result = await port.handleDocxReviewPreflightCommandSurface(toPayload(cleanDocxZip(), {
    reviewPacket: { leak: true },
  }));

  assert.equal(result.ok, false);
  assert.equal(result.error.op, 'cmd.project.review.inspectDocxReviewPreflight');
  assert.equal(result.error.code, 'E_DOCX_INTAKE_GATE_PAYLOAD_INVALID');
  assert.equal(result.error.reason, 'DOCX_INTAKE_GATE_PAYLOAD_UNSUPPORTED_FIELDS');
  assert.deepEqual(result.error.details.fields, ['reviewPacket']);
  assert.deepEqual(cloneJsonSafe(port.getState()), {
    activeReviewSessionStore: null,
    activeReviewSessionLifecycle: 'passive',
    currentReviewSurfacePayload: {},
    currentReviewSurfacePayloadSource: 'none',
    currentReviewSurfacePayloadContentHash: '',
  });
});

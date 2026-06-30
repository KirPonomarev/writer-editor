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
const SECTION_START = '// DOCX_INTAKE_GATE_COMMAND_SURFACE_START';
const SECTION_END = '// DOCX_INTAKE_GATE_COMMAND_SURFACE_END';

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

function instantiateDocxIntakeGatePort(options = {}) {
  const mainSource = readMainSource();
  const section = extractMarkedSection(mainSource, SECTION_START, SECTION_END);
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
    `${section}
module.exports = {
  DOCX_INTAKE_GATE_COMMAND_ID,
  DOCX_INTAKE_GATE_MAX_BASE64_CHARS,
  DOCX_INTAKE_GATE_MAX_BYTES,
  decodeDocxIntakeGateBufferSource,
  buildDocxIntakeGateCommandResult,
  handleDocxIntakeGateCommandSurface,
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
  header.writeUInt16LE(0, 6);
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
  header.writeUInt16LE(0, 8);
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

function toPayload(bytes, overrides = {}) {
  return {
    requestId: 'request-1',
    bufferSource: Buffer.from(bytes).toString('base64'),
    ...overrides,
  };
}

function cleanDocxZip() {
  return zipFixture([
    {
      name: 'word/document.xml',
      method: 8,
      body: '<w:document><w:body><w:p/></w:body></w:document>',
    },
  ]);
}

function assertInspectionOnlyResult(result) {
  assert.equal(result.ok, true);
  assert.equal(result.semanticParseNotRun, true);
  assert.equal(result.parse.attempted, false);
  assert.equal(result.gate.parse.attempted, false);
  assert.equal(Object.prototype.hasOwnProperty.call(result, 'preflightSummary'), true);
  assert.equal(Object.prototype.hasOwnProperty.call(result, 'packageInspection'), true);
  assert.equal(Object.prototype.hasOwnProperty.call(result, 'partPolicy'), true);
  assert.equal(Object.prototype.hasOwnProperty.call(result, 'reviewSurface'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result, 'reviewPacket'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result, 'applyOps'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result, 'canApply'), false);
}

test('DOCX intake gate command surface: command id is bridge-allowlisted and handler-owned', () => {
  const source = readMainSource();

  assert.match(
    source,
    /UI_COMMAND_BRIDGE_ALLOWED_COMMAND_IDS\s*=\s*new Set\(\[[\s\S]*'cmd\.project\.review\.inspectDocxIntakeGate'/,
  );
  assert.match(
    source,
    /'cmd\.project\.review\.inspectDocxIntakeGate':\s*async\s*\(payload\s*=\s*\{\}\)\s*=>\s*\{\s*return handleDocxIntakeGateCommandSurface\(payload\);/,
  );
});

test('DOCX intake gate command surface: clean container returns gate pass without semantic parse', async () => {
  const port = instantiateDocxIntakeGatePort();
  const result = await port.handleDocxIntakeGateCommandSurface(toPayload(cleanDocxZip()));

  assertInspectionOnlyResult(result);
  assert.equal(result.requestId, 'request-1');
  assert.equal(result.gatePass, true);
  assert.equal(result.decision, 'accepted');
  assert.equal(result.code, 'DOCX_PART_POLICY_ACCEPTED');
  assert.equal(result.preflightSummary.status, 'accepted');
  assert.equal(result.preflightSummary.eligibility.parserCandidateOnly, true);
  assert.equal(result.packageInspection.classification, 'clean');
  assert.equal(result.partPolicy.decision, 'accepted');
  assert.equal(result.gate.code, 'STAGE02_GATE_PASS');
  assert.equal(result.gate.ok, true);
  assert.equal(result.gate.parse.semanticAllowed, true);
  assert.deepEqual(cloneJsonSafe(port.getState()), {
    activeReviewSessionStore: null,
    activeReviewSessionLifecycle: 'passive',
    currentReviewSurfacePayload: {},
    currentReviewSurfacePayloadSource: 'none',
    currentReviewSurfacePayloadContentHash: '',
  });
});

test('DOCX intake gate command surface: hostile containers return gatePass false but not command failure', async () => {
  const port = instantiateDocxIntakeGatePort();
  const duplicate = await port.handleDocxIntakeGateCommandSurface(toPayload(zipFixture([
    { name: 'word/document.xml', body: '<root/>' },
    { name: 'WORD/DOCUMENT.XML', body: '<root/>' },
  ])));
  const traversal = await port.handleDocxIntakeGateCommandSurface(toPayload(zipFixture([
    { name: 'word\\document.xml', body: '<root/>' },
  ])));
  const dtd = await port.handleDocxIntakeGateCommandSurface(toPayload(zipFixture([
    { name: 'word/document.xml', body: '<?xml version="1.0"?><!DOCTYPE root><root/>' },
  ])));
  const entity = await port.handleDocxIntakeGateCommandSurface(toPayload(zipFixture([
    { name: 'word/document.xml', body: '<?xml version="1.0"?><!ENTITY stage02 "x"><root/>' },
  ])));
  const bomb = await port.handleDocxIntakeGateCommandSurface(toPayload(zipFixture([
    {
      name: 'word/document.xml',
      method: 8,
      body: `<root>${'a'.repeat(20000)}</root>`,
    },
  ])));
  const quarantine = await port.handleDocxIntakeGateCommandSurface(toPayload(zipFixture([
    { name: 'word/document.xml', body: '<root/>' },
    { name: 'custom/item.bin', body: 'x' },
  ])));

  const cases = [
    [duplicate, 'STAGE02_DUPLICATE_ENTRY_NAME'],
    [traversal, 'STAGE02_PATH_TRAVERSAL_DETECTED'],
    [dtd, 'STAGE02_XML_DTD_DECLARATION_PRESENT'],
    [entity, 'STAGE02_XML_ENTITY_DECLARATION_PRESENT'],
    [bomb, 'STAGE02_COMPRESSION_RATIO_EXCEEDED'],
    [quarantine, 'STAGE02_PACKAGE_QUARANTINED'],
  ];

  for (const [result, expectedCode] of cases) {
    assertInspectionOnlyResult(result);
    assert.equal(result.gatePass, false);
    assert.equal(result.code, expectedCode);
    assert.equal(result.gate.ok, false);
    assert.equal(result.gate.parse.semanticAllowed, false);
  }
});

test('DOCX intake gate command surface: encrypted local header is blocked before parse', async () => {
  const port = instantiateDocxIntakeGatePort();
  const encryptedLocal = zipFixture([
    { name: 'word/document.xml', body: '<root/>' },
  ]);
  encryptedLocal.writeUInt16LE(1, 6);

  const result = await port.handleDocxIntakeGateCommandSurface(toPayload(encryptedLocal));

  assertInspectionOnlyResult(result);
  assert.equal(result.gatePass, false);
  assert.equal(result.code, 'STAGE02_ENCRYPTED_ENTRY_PRESENT');
});

test('DOCX intake gate command surface: malformed payloads fail as typed command errors', async () => {
  const port = instantiateDocxIntakeGatePort();

  const missing = await port.handleDocxIntakeGateCommandSurface({});
  const nonObject = await port.handleDocxIntakeGateCommandSurface(null);
  const invalid = await port.handleDocxIntakeGateCommandSurface({ bufferSource: '@@@@' });
  const oversized = await port.handleDocxIntakeGateCommandSurface({
    bufferSource: 'A'.repeat(port.DOCX_INTAKE_GATE_MAX_BASE64_CHARS + 4),
  });
  const pathInput = await port.handleDocxIntakeGateCommandSurface({
    filePath: '/tmp/input.docx',
  });
  const mixedTransport = await port.handleDocxIntakeGateCommandSurface(toPayload(cleanDocxZip(), {
    bytes: [1, 2, 3],
    raw: '<w:document/>',
    zip: {},
  }));

  assert.deepEqual(cloneJsonSafe(missing), {
    ok: false,
    error: {
      code: 'E_DOCX_INTAKE_GATE_PAYLOAD_INVALID',
      op: 'cmd.project.review.inspectDocxIntakeGate',
      reason: 'DOCX_INTAKE_GATE_BUFFER_SOURCE_REQUIRED',
    },
  });
  assert.deepEqual(cloneJsonSafe(nonObject), {
    ok: false,
    error: {
      code: 'E_DOCX_INTAKE_GATE_PAYLOAD_INVALID',
      op: 'cmd.project.review.inspectDocxIntakeGate',
      reason: 'DOCX_INTAKE_GATE_PAYLOAD_REQUIRED',
    },
  });
  assert.deepEqual(cloneJsonSafe(invalid), {
    ok: false,
    error: {
      code: 'E_DOCX_INTAKE_GATE_PAYLOAD_INVALID',
      op: 'cmd.project.review.inspectDocxIntakeGate',
      reason: 'DOCX_INTAKE_GATE_BUFFER_SOURCE_BASE64_INVALID',
    },
  });
  assert.equal(oversized.ok, false);
  assert.equal(oversized.error.code, 'E_DOCX_INTAKE_GATE_PAYLOAD_TOO_LARGE');
  assert.equal(oversized.error.reason, 'DOCX_INTAKE_GATE_BUFFER_SOURCE_TOO_LARGE');
  assert.equal(pathInput.ok, false);
  assert.equal(pathInput.error.reason, 'DOCX_INTAKE_GATE_PAYLOAD_UNSUPPORTED_FIELDS');
  assert.deepEqual(pathInput.error.details.fields, ['filePath']);
  assert.equal(mixedTransport.ok, false);
  assert.equal(mixedTransport.error.reason, 'DOCX_INTAKE_GATE_PAYLOAD_UNSUPPORTED_FIELDS');
  assert.deepEqual(mixedTransport.error.details.fields, ['bytes', 'raw', 'zip']);
  assert.equal(port.getState().activeReviewSessionLifecycle, 'passive');
});

test('DOCX intake gate command surface: bridge failure and parse-attempt regression fail closed', async () => {
  const unavailable = instantiateDocxIntakeGatePort({
    loadRevisionBridgeModule: async () => {
      throw new Error('bridge unavailable');
    },
  });
  const parseAttempted = instantiateDocxIntakeGatePort({
    loadRevisionBridgeModule: async () => ({
      buildDocxIntakePreflightReportFromZipBytes: () => ({
        ok: true,
        decision: 'accepted',
        code: 'DOCX_PART_POLICY_ACCEPTED',
        reason: 'DOCX_PART_POLICY_ACCEPTED',
        diagnostics: [],
        evidence: [],
        budgets: {},
        preflightSummary: {},
        packageInspection: {},
        partPolicy: {},
        parse: {
          attempted: true,
          semanticAllowed: true,
        },
        gate: {
          ok: true,
          decision: 'pass',
          code: 'STAGE02_GATE_PASS',
          reason: 'STAGE02_GATE_PASS',
          diagnostics: [],
          evidence: [],
          budgets: {},
          parse: {
            attempted: false,
            semanticAllowed: true,
          },
        },
      }),
    }),
  });
  const gateParseAttempted = instantiateDocxIntakeGatePort({
    loadRevisionBridgeModule: async () => ({
      buildDocxIntakePreflightReportFromZipBytes: () => ({
        ok: true,
        decision: 'accepted',
        code: 'DOCX_PART_POLICY_ACCEPTED',
        reason: 'DOCX_PART_POLICY_ACCEPTED',
        diagnostics: [],
        evidence: [],
        budgets: {},
        preflightSummary: {},
        packageInspection: {},
        partPolicy: {},
        gate: {
          ok: true,
          decision: 'pass',
          code: 'STAGE02_GATE_PASS',
          reason: 'STAGE02_GATE_PASS',
          diagnostics: [],
          evidence: [],
          budgets: {},
          parse: {
            attempted: true,
            semanticAllowed: true,
          },
        },
      }),
    }),
  });
  const helperUnavailable = instantiateDocxIntakeGatePort({
    loadRevisionBridgeModule: async () => ({
      inspectDocxHostileFileGateFromZipBytes: () => ({
        ok: true,
        decision: 'pass',
        code: 'STAGE02_GATE_PASS',
        reason: 'STAGE02_GATE_PASS',
        diagnostics: [],
        evidence: [],
        budgets: {},
        parse: {
          attempted: true,
          semanticAllowed: true,
        },
      }),
    }),
  });

  const unavailableResult = await unavailable.handleDocxIntakeGateCommandSurface(toPayload(cleanDocxZip()));
  const parseAttemptedResult = await parseAttempted.handleDocxIntakeGateCommandSurface(toPayload(cleanDocxZip()));
  const gateParseAttemptedResult = await gateParseAttempted.handleDocxIntakeGateCommandSurface(toPayload(cleanDocxZip()));
  const helperUnavailableResult = await helperUnavailable.handleDocxIntakeGateCommandSurface(toPayload(cleanDocxZip()));

  assert.equal(unavailableResult.ok, false);
  assert.equal(unavailableResult.error.code, 'E_DOCX_INTAKE_GATE_UNAVAILABLE');
  assert.equal(unavailableResult.error.reason, 'DOCX_INTAKE_GATE_BRIDGE_UNAVAILABLE');
  assert.equal(parseAttemptedResult.ok, false);
  assert.equal(parseAttemptedResult.error.code, 'E_DOCX_INTAKE_GATE_PARSE_ATTEMPTED');
  assert.equal(parseAttemptedResult.error.reason, 'DOCX_INTAKE_GATE_PARSE_ATTEMPTED');
  assert.equal(gateParseAttemptedResult.ok, false);
  assert.equal(gateParseAttemptedResult.error.code, 'E_DOCX_INTAKE_GATE_PARSE_ATTEMPTED');
  assert.equal(helperUnavailableResult.ok, false);
  assert.equal(helperUnavailableResult.error.code, 'E_DOCX_INTAKE_GATE_UNAVAILABLE');
  assert.equal(helperUnavailableResult.error.reason, 'DOCX_INTAKE_GATE_INSPECTOR_UNAVAILABLE');
});

test('DOCX intake gate command surface: contour section stays free of storage export parser and apply layers', () => {
  const section = extractMarkedSection(readMainSource(), SECTION_START, SECTION_END);
  const forbiddenRuntimeMarkers = [
    'writeFileAtomic',
    'writeFlowSceneBatchAtomic',
    'writeBufferAtomic',
    'exactTextMinSafeWrite',
    'buildDocxMinBuffer',
    'runDocxMinExport',
    'applyMarkdownImportSafeCreate',
    'handleReviewSurfaceImportPacketCommandSurface',
    'activeReviewSessionStore =',
    'currentReviewSurfacePayload =',
    'reviewPacket',
    'reviewSurface',
    'applyOps',
    'canApply: true',
    'fs.',
    'readFile',
    'writeFile',
    'readFileSync',
  ];

  for (const marker of forbiddenRuntimeMarkers) {
    assert.equal(section.includes(marker), false, `${marker} must stay out of DOCX intake gate command surface`);
  }
});

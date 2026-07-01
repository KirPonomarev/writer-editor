const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { deflateRawSync } = require('node:zlib');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..', '..');
const MODULE_PATH = path.join(ROOT, 'src', 'io', 'revisionBridge', 'index.mjs');
const SECTION_START = '// RB_10A_DOCX_REVIEW_PREFLIGHT_REPORT_START';
const SECTION_END = '// RB_10A_DOCX_REVIEW_PREFLIGHT_REPORT_END';

async function loadBridge() {
  return import(pathToFileURL(MODULE_PATH).href);
}

function readBridgeSource() {
  return fs.readFileSync(MODULE_PATH, 'utf8');
}

function extractMarkedSection(text, startMarker, endMarker) {
  const start = text.indexOf(startMarker);
  const end = text.indexOf(endMarker);
  assert.notEqual(start, -1, `missing marker: ${startMarker}`);
  assert.notEqual(end, -1, `missing marker: ${endMarker}`);
  assert.ok(end > start, `marker order invalid: ${startMarker}`);
  return text.slice(start, end + endMarker.length);
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

function commentsXml(body = '<w:comment w:id="0"><w:p><w:r><w:t>Note</w:t></w:r></w:p></w:comment>') {
  return `<w:comments>${body}</w:comments>`;
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

function assertReviewPreflightShell(result) {
  assert.equal(result.schemaVersion, 'revision-bridge.docx-review-preflight-report.v1');
  assert.equal(result.type, 'docxReviewPreflightReport');
  assert.equal(result.canOpenReviewSession, false);
  assert.equal(result.canAutoApply, false);
  assert.equal(result.canCreateReviewPacket, false);
  assert.equal(result.canImportMutate, false);
  assert.equal(result.canWriteStorage, false);
  assert.equal(result.diagnosticCandidate, null);
  assert.equal(result.lossReport.schemaVersion, 'revision-bridge.docx-review-preflight-loss-report.v1');
  const keys = collectKeys(result);
  for (const forbidden of [
    'reviewPacket',
    'reviewSurface',
    'activeReviewSession',
    'applyOps',
    'applyPlan',
    'receipt',
    'recovery',
    'writeReceipt',
    'importReceipt',
    'exportReceipt',
  ]) {
    assert.equal(keys.some((key) => key === forbidden || key.endsWith(`.${forbidden}`)), false, forbidden);
  }
}

test('DOCX review preflight: clean DOCX produces no review evidence and no authority', async () => {
  const bridge = await loadBridge();
  const input = cleanDocxZip(paragraphXml('Clean'));
  const before = Buffer.from(input);
  const first = bridge.buildDocxReviewPreflightReportFromZipBytes(input);
  const second = bridge.buildDocxReviewPreflightReportFromZipBytes(input);

  assertReviewPreflightShell(first);
  assert.deepEqual(first, second);
  assert.equal(input.equals(before), true);
  assert.equal(first.ok, true);
  assert.equal(first.status, 'diagnostic-only');
  assert.equal(first.code, 'DOCX_REVIEW_PREFLIGHT_NO_REVIEW_EVIDENCE');
  assert.equal(first.hasReviewEvidence, false);
  assert.equal(first.commentsEvidence.present, false);
  assert.equal(first.trackedChangesEvidence.present, false);
  assert.deepEqual(first.unsupportedItems, []);
});

test('DOCX review preflight: comments evidence is detected but stays diagnostic-only', async () => {
  const bridge = await loadBridge();
  const input = cleanDocxZip([
    '<w:p>',
    '<w:commentRangeStart w:id="0"/>',
    '<w:r><w:t>Anchored</w:t></w:r>',
    '<w:commentRangeEnd w:id="0"/>',
    '<w:r><w:commentReference w:id="0"/></w:r>',
    '</w:p>',
  ].join(''), [
    {
      name: 'word/comments.xml',
      method: 8,
      body: commentsXml(),
    },
  ]);
  const result = bridge.buildDocxReviewPreflightReportFromZipBytes(input);

  assertReviewPreflightShell(result);
  assert.equal(result.ok, true);
  assert.equal(result.code, 'DOCX_REVIEW_PREFLIGHT_REVIEW_EVIDENCE_FOUND');
  assert.equal(result.hasReviewEvidence, true);
  assert.equal(result.commentsEvidence.present, true);
  assert.equal(result.commentsEvidence.commentPartPresent, true);
  assert.equal(result.commentsEvidence.commentCount, 1);
  assert.equal(result.commentsEvidence.rangeStartCount, 1);
  assert.equal(result.commentsEvidence.rangeEndCount, 1);
  assert.equal(result.commentsEvidence.referenceCount, 1);
  assert.equal(result.canOpenReviewSession, false);
  assert.equal(result.canAutoApply, false);
  assert.equal(result.preflightSummary.diagnosticOnly, true);
});

test('DOCX review preflight: tracked changes evidence is detected without apply readiness', async () => {
  const bridge = await loadBridge();
  const result = bridge.buildDocxReviewPreflightReportFromZipBytes(cleanDocxZip([
    paragraphXml('Before'),
    '<w:ins><w:p><w:r><w:t>Inserted</w:t></w:r></w:p></w:ins>',
    '<w:del><w:p><w:r><w:t>Deleted</w:t></w:r></w:p></w:del>',
  ].join('')));

  assertReviewPreflightShell(result);
  assert.equal(result.ok, true);
  assert.equal(result.hasReviewEvidence, true);
  assert.equal(result.trackedChangesEvidence.present, true);
  assert.equal(result.trackedChangesEvidence.insertCount, 1);
  assert.equal(result.trackedChangesEvidence.deleteCount, 1);
  assert.equal(result.canAutoApply, false);
  assert.equal(result.diagnosticCandidate, null);
});

test('DOCX review preflight: malformed and unsafe target XML fail closed', async () => {
  const bridge = await loadBridge();
  const malformed = bridge.buildDocxReviewPreflightReportFromZipBytes('review.docx');
  const unsafeComment = bridge.buildDocxReviewPreflightReportFromZipBytes(cleanDocxZip(paragraphXml('A'), [
    {
      name: 'word/comments.xml',
      method: 8,
      body: '<!DOCTYPE comments><w:comments/>',
    },
  ]));

  assertReviewPreflightShell(malformed);
  assert.equal(malformed.ok, false);
  assert.equal(malformed.status, 'blocked');
  assert.equal(malformed.parse.attempted, false);
  assert.equal(malformed.hasReviewEvidence, false);

  assertReviewPreflightShell(unsafeComment);
  assert.equal(unsafeComment.ok, false);
  assert.equal(unsafeComment.status, 'blocked');
  assert.equal(unsafeComment.code, 'DOCX_REVIEW_PREFLIGHT_UNSAFE_DECLARATION_PRESENT');
  assert.equal(unsafeComment.reason, 'DOCX_REVIEW_PREFLIGHT_UNSAFE_XML_DECLARATION');
  assert.equal(unsafeComment.canOpenReviewSession, false);
});

test('DOCX review preflight: implementation stays out of session apply storage layers', () => {
  const section = extractMarkedSection(readBridgeSource(), SECTION_START, SECTION_END);
  for (const marker of [
    'fs.',
    'readFile',
    'writeFile',
    'ipc',
    'electron',
    'fetch',
    'http',
    'DOMParser',
    'XMLParser',
    'xmldom',
    'fast-xml-parser',
    'handleReviewSurfaceImportPacketCommandSurface',
    'exactTextMinSafeWrite',
    'buildDocxMinBuffer',
    'canAutoApply: true',
  ]) {
    assert.equal(section.includes(marker), false, `${marker} must stay out of review preflight`);
  }
});

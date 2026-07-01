const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { deflateRawSync } = require('node:zlib');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..', '..');
const MODULE_PATH = path.join(ROOT, 'src', 'io', 'revisionBridge', 'index.mjs');
const SECTION_START = '// RB_10B_DOCX_REVIEW_PREVIEW_SESSION_CANDIDATE_START';
const SECTION_END = '// RB_10B_DOCX_REVIEW_PREVIEW_SESSION_CANDIDATE_END';

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

function commentsXml(body) {
  return `<w:comments>${body}</w:comments>`;
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

function docxWithCommentAndBody(body, commentBody = 'Resolve this comment.') {
  return cleanDocxZip(body, [
    {
      name: 'word/comments.xml',
      method: 8,
      body: commentsXml([
        '<w:comment w:id="0" w:author="reviewer" w:date="2026-04-24T08:00:00.000Z">',
        '<w:p><w:r><w:t>',
        commentBody,
        '</w:t></w:r></w:p>',
        '</w:comment>',
      ].join('')),
    },
  ]);
}

function docxWithAnchoredComment(extraBody = '') {
  return docxWithCommentAndBody([
    '<w:p>',
    '<w:commentRangeStart w:id="0"/>',
    '<w:r><w:t>Anchored text</w:t></w:r>',
    '<w:commentRangeEnd w:id="0"/>',
    '<w:r><w:commentReference w:id="0"/></w:r>',
    '</w:p>',
    extraBody,
  ].join(''));
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

function assertNoStorageOrApplyAuthority(value) {
  const keys = collectKeys(value);
  for (const forbidden of [
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

const TARGET_SCOPE = Object.freeze({
  type: 'scene',
  id: 'roman/imported/scene-1.txt',
});

test('DOCX review preview session candidate: exports schema and builder', async () => {
  const bridge = await loadBridge();

  assert.equal(
    bridge.DOCX_REVIEW_PREVIEW_SESSION_CANDIDATE_SCHEMA,
    'revision-bridge.docx-review-preview-session-candidate.v1',
  );
  assert.equal(typeof bridge.buildDocxReviewPreviewSessionCandidateFromZipBytes, 'function');
});

test('DOCX review preview session candidate: comments become review packet without apply authority', async () => {
  const bridge = await loadBridge();
  const input = docxWithAnchoredComment();
  const before = Buffer.from(input);

  const result = bridge.buildDocxReviewPreviewSessionCandidateFromZipBytes(input, {
    targetScope: TARGET_SCOPE,
    createdAt: '2026-04-24T08:00:00.000Z',
  });
  const second = bridge.buildDocxReviewPreviewSessionCandidateFromZipBytes(input, {
    targetScope: TARGET_SCOPE,
    createdAt: '2026-04-24T08:00:00.000Z',
  });

  assert.deepEqual(result, second);
  assert.equal(input.equals(before), true);
  assert.equal(result.ok, true);
  assert.equal(result.status, 'ready');
  assert.equal(result.code, 'DOCX_REVIEW_PREVIEW_SESSION_CANDIDATE_READY');
  assert.equal(result.canOpenReviewSession, true);
  assert.equal(result.canCreateReviewPacket, true);
  assert.equal(result.canAutoApply, false);
  assert.equal(result.canImportMutate, false);
  assert.equal(result.canWriteStorage, false);
  assert.equal(result.reviewPacket.commentThreads.length, 1);
  assert.equal(result.reviewPacket.commentThreads[0].messages[0].body, 'Resolve this comment.');
  assert.equal(result.reviewPacket.commentPlacements.length, 1);
  assert.equal(result.reviewPacket.commentPlacements[0].quote, 'Anchored text');
  assert.deepEqual(result.reviewPacket.textChanges, []);
  assert.deepEqual(result.reviewPacket.structuralChanges, []);
  assert.equal(result.reviewPacket.commentPlacements[0].targetScope.id, TARGET_SCOPE.id);
  assert.equal(result.sourceViewState.viewMode, 'docx-review-preview');
  assertNoStorageOrApplyAuthority(result);
});

test('DOCX review preview session candidate: tracked changes stay diagnostic-only', async () => {
  const bridge = await loadBridge();
  const result = bridge.buildDocxReviewPreviewSessionCandidateFromZipBytes(cleanDocxZip([
    paragraphXml('Before'),
    '<w:ins><w:p><w:r><w:t>Inserted</w:t></w:r></w:p></w:ins>',
    '<w:del><w:p><w:r><w:t>Deleted</w:t></w:r></w:p></w:del>',
  ].join('')), {
    targetScope: TARGET_SCOPE,
    createdAt: '2026-04-24T08:00:00.000Z',
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, 'diagnostics');
  assert.equal(result.code, 'DOCX_REVIEW_PREVIEW_SESSION_CANDIDATE_NO_REVIEW_COMMENTS');
  assert.equal(result.canOpenReviewSession, false);
  assert.equal(result.reviewPacket, null);
  assert.equal(result.summary.trackedChangesDiagnosticOnly, true);
  assert.ok(result.diagnostics.some((item) => (
    item.diagnosticId === 'docx-review-tracked-insertCount'
    && item.message.includes('diagnostic-only')
  )));
  assertNoStorageOrApplyAuthority(result);
});

test('DOCX review preview session candidate: comments plus tracked changes keep tracked changes out of textChanges', async () => {
  const bridge = await loadBridge();
  const result = bridge.buildDocxReviewPreviewSessionCandidateFromZipBytes(docxWithAnchoredComment(
    '<w:ins><w:p><w:r><w:t>Inserted</w:t></w:r></w:p></w:ins>',
  ), {
    targetScope: TARGET_SCOPE,
    createdAt: '2026-04-24T08:00:00.000Z',
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, 'ready');
  assert.equal(result.reviewPacket.commentThreads.length, 1);
  assert.deepEqual(result.reviewPacket.textChanges, []);
  assert.ok(result.reviewPacket.diagnosticItems.some((item) => (
    item.diagnosticId === 'docx-review-tracked-insertCount'
  )));
});

test('DOCX review preview session candidate: clean and malformed inputs do not create review packets', async () => {
  const bridge = await loadBridge();
  const clean = bridge.buildDocxReviewPreviewSessionCandidateFromZipBytes(cleanDocxZip(paragraphXml('Clean')), {
    targetScope: TARGET_SCOPE,
  });
  const malformed = bridge.buildDocxReviewPreviewSessionCandidateFromZipBytes('review.docx', {
    targetScope: TARGET_SCOPE,
  });

  assert.equal(clean.ok, true);
  assert.equal(clean.status, 'diagnostics');
  assert.equal(clean.reviewPacket, null);
  assert.equal(clean.canOpenReviewSession, false);
  assert.equal(malformed.ok, false);
  assert.equal(malformed.status, 'blocked');
  assert.equal(malformed.reviewPacket, null);
  assert.equal(malformed.canOpenReviewSession, false);
});

test('DOCX review preview session candidate: ready packet feeds Stage01 with blocked apply plan', async () => {
  const bridge = await loadBridge();
  const candidate = bridge.buildDocxReviewPreviewSessionCandidateFromZipBytes(docxWithAnchoredComment(), {
    targetScope: TARGET_SCOPE,
    createdAt: '2026-04-24T08:00:00.000Z',
  });

  const preview = bridge.buildStage01FixedCorePreview({
    projectId: 'project-1',
    sessionId: 'docx-preview-session-1',
    baselineHash: 'baseline-1',
    currentBaselineHash: 'baseline-1',
    reviewPacket: candidate.reviewPacket,
    sourceViewState: candidate.sourceViewState,
  });

  assert.equal(preview.ok, true);
  assert.equal(preview.status, 'preview');
  assert.equal(preview.preview.blockedApplyPlan.canApply, false);
  assert.deepEqual(preview.preview.blockedApplyPlan.applyOps, []);
  assert.equal(preview.preview.shadowPreview.session.reviewGraph.commentThreads.length, 1);
  assert.deepEqual(preview.preview.shadowPreview.session.reviewGraph.textChanges, []);
});

test('DOCX review preview session candidate: section has no disk, command, or export authority', () => {
  const source = extractMarkedSection(readBridgeSource(), SECTION_START, SECTION_END);
  for (const forbidden of [
    'writeFileAtomic',
    'queueDiskOperation',
    'handleReviewSurfaceImportPacketCommandSurface',
    'applyDocxImportSafeCreate',
    'buildDocxMinBuffer',
    'fs.',
    'ipcMain',
  ]) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
});

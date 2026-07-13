const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..', '..');
const FIXTURE_ROOT = path.join(ROOT, 'test', 'fixtures', 'revision-bridge', 'v1');
const STATUS_ROOT = path.join(ROOT, 'docs', 'OPS', 'STATUS');
const BASE_SHA = 'c4b7c6f5729ac9219c9d8f948f2d9bf3e6c8b886';
const PHASE_06_BASE_SHA = '5456f7f3dd689559d63bb10181e8998464540f72';
const EXPECTED_HASHES = Object.freeze({
  'docx-minimal-export-v1.docx': '2897ba060f74e1878344aec35f121f8f77e41dc6104a7abb8c4898b0e487d03a',
  'docx-review-evidence-v1.docx': 'bbf25574580222241794fe3decea4c6cf6c034c9c07da2bd76463603cd8acc6e',
  'review-packet-v1.json': 'f45c084b8ec8493b1f5621f2a416c1eba9c25ee2c4d56dbcd314f28dc94bfb97',
  'txt-content-v1.txt': '1e8d973edeb9871226e4b495a1fc1bef02f8c5e7102e341cfb9d8d0003e25919',
  'markdown-content-v1.md': '7e69a45fc5b374733b745a2e6f3f1ed48af0e8d5124bb37de277186bca2fe66d',
});

function readFixture(fileName) {
  return fs.readFileSync(path.join(FIXTURE_ROOT, fileName));
}

function readStatus(fileName) {
  return JSON.parse(fs.readFileSync(path.join(STATUS_ROOT, fileName), 'utf8'));
}

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function findForbiddenKeys(value, forbidden, pathParts = []) {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => findForbiddenKeys(item, forbidden, pathParts.concat(String(index))));
  }
  if (!value || typeof value !== 'object') return [];
  return Object.keys(value).flatMap((key) => {
    const nextPath = pathParts.concat(key);
    return (forbidden.has(key) ? [nextPath.join('.')] : [])
      .concat(findForbiddenKeys(value[key], forbidden, nextPath));
  });
}

async function loadBridge() {
  return import(pathToFileURL(path.join(ROOT, 'src', 'io', 'revisionBridge', 'index.mjs')).href);
}

test('Gate C evidence artifacts publish one bounded claim authority with all mandatory fields', () => {
  const matrix = readStatus('CAPABILITY_MATRIX.json');
  const manifest = readStatus('GOLDEN_SET_MANIFEST.json');
  const review = readStatus('REVIEW_BRIDGE_ACCEPTANCE.json');
  const importExport = readStatus('IMPORT_EXPORT_ACCEPTANCE.json');
  const status = readStatus('REVIEW_BRIDGE_BOUNDED_FIDELITY_GOLDEN_ACCEPTANCE_001_STATUS.json');
  const gateC = readStatus('REVIEW_BRIDGE_DOCX_REVIEW_V1_GATE_C_001_STATUS.json');
  const historical = readStatus('IMPORT_EXPORT_PRODUCT_ACCEPTANCE_GATE_001_STATUS.json');

  assert.equal(matrix.baseSha, BASE_SHA);
  assert.ok(['implemented_verified_pending_delivery', 'delivered_merged_verified'].includes(matrix.status));
  assert.equal(matrix.releaseClaim.label, 'FEATURE_COMPLETE_V1_PLUS_GATE_C');
  assert.equal(matrix.releaseClaim.gates.A_CONTENT_IMPORT_EXPORT_V1, 'pass');
  assert.equal(matrix.releaseClaim.gates.B_LOCAL_REVIEW_BRIDGE_V1, 'pass');
  assert.equal(matrix.releaseClaim.gates.C_DOCX_REVIEW_V1, 'pass');
  assert.equal(matrix.releaseClaim.gates.D_EDITOR_SPECIFIC_CLAIMS, 'post_v1_not_claimed');
  assert.deepEqual(matrix.rows.map((row) => row.rowId), [
    'docx-minimal-export-v1',
    'docx-content-import-v1',
    'txt-local-file-v1',
    'markdown-local-file-v1',
    'review-packet-v1-exact-apply',
    'docx-review-evidence-v1',
  ]);
  const docxReviewRow = matrix.rows.find((row) => row.rowId === 'docx-review-evidence-v1');
  assert.equal(docxReviewRow.status, 'bounded_supported');
  assert.equal(docxReviewRow.apply, 'not_supported');
  assert.equal(docxReviewRow.reviewImport.some((item) => item.includes('manual TextChange candidate')), true);
  assert.equal(manifest.baseSha, BASE_SHA);
  assert.equal(manifest.artifacts.length, 5);
  assert.deepEqual(Object.fromEntries(manifest.artifacts.map((item) => [item.fileName, item.sha256])), EXPECTED_HASHES);
  assert.equal(review.baseSha, BASE_SHA);
  assert.equal(review.gate, 'B_LOCAL_REVIEW_BRIDGE_V1_AND_C_DOCX_REVIEW_V1');
  assert.ok(['implemented_verified_pending_delivery', 'delivered_merged_verified'].includes(review.status));
  assert.equal(importExport.baseSha, PHASE_06_BASE_SHA);
  assert.equal(importExport.gate, 'A_CONTENT_IMPORT_EXPORT_V1');
  assert.equal(importExport.status, 'delivered_merged_verified');
  assert.equal(status.baseSha, PHASE_06_BASE_SHA);
  assert.equal(status.status, 'delivered_merged_verified');
  assert.equal(status.delivery.commitSha, '01b2a5f28fff9c2f3f9451edc1827c0aebf002e7');
  assert.equal(status.delivery.pullRequest, 1083);
  assert.equal(status.delivery.mergeSha, '3f71a6fa3b10cecf0973c80a1865552b57e0c180');
  assert.equal(status.implementation.realArtifacts, 5);
  assert.equal(status.implementation.capabilityRows, 6);
  assert.equal(gateC.baseSha, BASE_SHA);
  assert.ok(['implemented_verified_pending_delivery', 'delivered_merged_verified'].includes(gateC.status));
  assert.equal(gateC.ownerApproval.approved, true);
  assert.equal(gateC.ownerApproval.selectedGate, 'C_DOCX_REVIEW_V1');
  assert.equal(gateC.scope.zeroWritePreview, true);
  assert.equal(gateC.scope.docxTrackedTextCandidates, true);
  assert.equal(gateC.scope.docxApplyAuthority, false);
  assert.equal(gateC.scope.structuralAutoApply, false);
  assert.equal(gateC.acceptance.sceneBytesUnchanged, 'pass');
  assert.equal(gateC.acceptance.projectFilesUnchanged, 'pass');
  assert.equal(gateC.acceptance.receiptAbsent, 'pass');
  assert.equal(gateC.acceptance.recoveryAbsent, 'pass');
  assert.equal(gateC.audit.officialSuite, '614_total_550_pass_64_skip_0_fail');
  assert.equal(gateC.audit.productionDependencyAudit, '0_vulnerabilities');
  assert.match(gateC.audit.semgrep, /^0_new_findings/u);
  assert.equal(gateC.gateD.status, 'post_v1_not_claimed');
  assert.equal(gateC.gateD.wordEvidence, 'blocked_without_real_word_artifact');
  assert.equal(gateC.gateD.googleDocsEvidence, 'blocked_without_real_google_docs_artifact');
  assert.equal(historical.lifecycleStatus, 'superseded_historical');
  assert.equal(historical.supersededBy, 'IMPORT_EXPORT_ACCEPTANCE.json');

  for (const artifact of [matrix, manifest, review, importExport, status, gateC]) {
    assert.equal(Array.isArray(artifact.actualCommands) && artifact.actualCommands.length > 0, true);
    assert.equal(Object.keys(artifact.hashes).length > 0, true);
    assert.equal(Array.isArray(artifact.outcomes) || (artifact.outcomes && typeof artifact.outcomes === 'object'), true);
    assert.equal(Array.isArray(artifact.nonClaims) && artifact.nonClaims.length > 0, true);
    assert.equal(Array.isArray(artifact.knownLimitations) && artifact.knownLimitations.length > 0, true);
  }
});

test('Phase 06 golden files are real deterministic bytes with exact manifest hashes', () => {
  const output = execFileSync(process.execPath, ['scripts/ops/review-bridge-golden-set.mjs'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  const result = JSON.parse(output);

  assert.equal(result.ok, true);
  assert.equal(result.mode, 'check');
  assert.equal(result.files.length, 5);
  for (const [fileName, expectedHash] of Object.entries(EXPECTED_HASHES)) {
    const bytes = readFixture(fileName);
    assert.equal(bytes.length > 0, true);
    assert.equal(sha256(bytes), expectedHash);
    assert.equal(result.files.find((item) => item.fileName === fileName).matchesGeneratedBytes, true);
  }
  assert.equal(readFixture('docx-minimal-export-v1.docx').subarray(0, 2).toString('ascii'), 'PK');
  assert.equal(readFixture('docx-review-evidence-v1.docx').subarray(0, 2).toString('ascii'), 'PK');
});

test('Phase 06 real minimal DOCX preserves semantic export and reaches content import plan', async () => {
  const bridge = await loadBridge();
  const bytes = readFixture('docx-minimal-export-v1.docx');
  const packageText = bytes.toString('utf8');

  assert.match(packageText, /<w:pStyle w:val="Heading1"\/>/u);
  assert.match(packageText, /<w:pStyle w:val="Heading2"\/>/u);
  assert.match(packageText, /<w:br w:type="page"\/>/u);
  assert.match(packageText, /<w:pgSz w:w="11906" w:h="16838"\/>/u);
  assert.match(packageText, /<w:pgMar w:top="1440"/u);
  assert.doesNotMatch(packageText, /craftsman\.document\.v2|doc-v2/u);

  const gate = bridge.inspectDocxHostileFileGateFromZipBytes(bytes);
  const contentPreview = bridge.buildDocxContentPreviewFromZipBytes(bytes);
  const importPreview = bridge.buildDocxImportPreviewPlanFromContentPreview(contentPreview);

  assert.equal(gate.ok, true);
  assert.equal(gate.code, 'STAGE02_GATE_PASS');
  assert.equal(contentPreview.ok, true);
  assert.equal(contentPreview.preflightSummary.status, 'degraded');
  assert.equal(contentPreview.preflightSummary.parserCandidateOnly, true);
  assert.deepEqual(contentPreview.contentPreview.paragraphs.map((item) => item.text), [
    'Golden Book',
    'Golden Scene',
    'Paragraph before the page break.',
    '\n',
    'Paragraph after the page break.',
  ]);
  assert.equal(importPreview.ok, true);
  assert.equal(importPreview.status, 'preview');
  assert.equal(importPreview.candidateCreatePlan.mode, 'create-only');
  assert.equal(importPreview.candidateCreatePlan.entryCount, 1);
  assert.equal(importPreview.lossReport.items.some((item) => (
    item.code === 'DOCX_IMPORT_PREVIEW_RELATIONSHIPS_NOT_IMPORTED'
  )), true);
});

test('Gate C real DOCX Review file keeps comments and emits manual tracked text candidates', async () => {
  const bridge = await loadBridge();
  const bytes = readFixture('docx-review-evidence-v1.docx');
  const report = bridge.buildDocxReviewPreflightReportFromZipBytes(bytes);
  const candidate = bridge.buildDocxReviewPreviewSessionCandidateFromZipBytes(bytes, {
    createdAt: '2026-07-12T00:00:00.000Z',
  });

  assert.equal(report.ok, true);
  assert.equal(report.status, 'diagnostic-only');
  assert.equal(report.commentsEvidence.commentCount, 1);
  assert.equal(report.trackedChangesEvidence.insertCount, 1);
  assert.equal(report.trackedChangesEvidence.deleteCount, 1);
  assert.equal(report.canAutoApply, false);
  assert.equal(candidate.ok, true);
  assert.equal(candidate.status, 'ready');
  assert.equal(candidate.reviewPacket.commentThreads[0].messages[0].body, 'Keep this comment text.');
  assert.equal(candidate.reviewPacket.commentPlacements.length, 1);
  assert.equal(candidate.reviewPacket.textChanges.length, 1);
  assert.equal(candidate.reviewPacket.textChanges[0].match.kind, 'manual');
  assert.equal(candidate.reviewPacket.textChanges[0].match.quote, 'beta');
  assert.equal(candidate.reviewPacket.textChanges[0].replacementText, 'delta');
  assert.equal(candidate.reviewPacket.structuralChanges.length, 0);
  assert.equal(candidate.summary.trackedChangesDiagnosticOnly, false);
  assert.equal(candidate.summary.trackedTextCandidateCount, 1);
  assert.equal(candidate.canAutoApply, false);
  assert.equal(candidate.canImportMutate, false);
  assert.equal(candidate.canWriteStorage, false);
});

test('Phase 06 canonical Review Packet produces one exact plan without imported authority', async () => {
  const bridge = await loadBridge();
  const packet = JSON.parse(readFixture('review-packet-v1.json').toString('utf8'));
  const forbidden = new Set([
    'applyOps', 'applyPlan', 'path', 'projectRoot', 'receipt', 'recovery', 'scenePath', 'writeEffects',
  ]);
  const preview = bridge.buildRevisionPacketPreview(packet);
  const plan = bridge.buildExactTextApplyPlanNoDiskPreview({
    projectSnapshot: {
      projectId: packet.projectId,
      baselineHash: packet.baselineHash,
      scenes: [{ sceneId: 'scene-1', text: 'Before old words after.' }],
    },
    revisionSession: preview.session,
  });

  assert.deepEqual(findForbiddenKeys(packet, forbidden), []);
  assert.equal(preview.ok, true);
  assert.equal(preview.status, 'preview');
  assert.equal(preview.session.reviewGraph.textChanges.length, 1);
  assert.equal(plan.ok, true);
  assert.equal(plan.status, 'ready');
  assert.equal(plan.plan.noDisk, true);
  assert.equal(plan.plan.applyOps.length, 1);
  assert.equal(plan.plan.applyOps[0].expectedText, 'old words');
  assert.equal(plan.plan.applyOps[0].replacementText, 'new words');
  assert.deepEqual(plan.plan.blockedReasons, []);
});

test('Phase 06 TXT and Markdown files exercise bounded production parsers', async () => {
  const { createTxtImportLocalFilePreview } = require('../../src/utils/txtImportLocalFilePreview');
  const txtBytes = readFixture('txt-content-v1.txt');
  const txt = await createTxtImportLocalFilePreview(
    { requestId: 'golden-txt-v1' },
    {
      pickLocalFile: async () => ({ path: path.join(FIXTURE_ROOT, 'txt-content-v1.txt'), size: txtBytes.length }),
      readLocalFileBytes: async () => txtBytes,
    },
  );
  const [{ parseMarkdownV1 }, { serializeMarkdownV1WithLossReport }] = await Promise.all([
    import(pathToFileURL(path.join(ROOT, 'src', 'export', 'markdown', 'v1', 'parseMarkdownV1.mjs')).href),
    import(pathToFileURL(path.join(ROOT, 'src', 'export', 'markdown', 'v1', 'serializeMarkdownV1.mjs')).href),
  ]);
  const markdownSource = readFixture('markdown-content-v1.md').toString('utf8');
  const parsedMarkdown = parseMarkdownV1(markdownSource);
  const serializedMarkdown = serializeMarkdownV1WithLossReport(parsedMarkdown);

  assert.equal(txt.ok, true);
  assert.equal(txt.writeEffects, false);
  assert.equal(txt.txtImportPreviewPlan.candidateCreatePlan.mode, 'create-only');
  assert.match(txt.txtImportPreviewPlan.candidateCreatePlan.entries[0].content, /Привет, мир\./u);
  assert.equal(parsedMarkdown.lossReport.count, 0);
  assert.equal(serializedMarkdown.lossReport.count, 0);
  assert.equal(serializedMarkdown.markdown, markdownSource);
});

test('Phase 06 canonical source read parses document envelope before DOCX export', () => {
  const mainSource = fs.readFileSync(path.join(ROOT, 'src', 'main.js'), 'utf8');
  const start = mainSource.indexOf('async function readCanonicalExportSnapshot(payload = {})');
  const end = mainSource.indexOf('async function persistProjectManifestAtPath', start);
  const section = mainSource.slice(start, end);

  assert.ok(start > -1 && end > start);
  assert.match(section, /loadDocumentContentEnvelopeModule\(\)/u);
  assert.match(section, /parseObservablePayload\(content\)/u);
  assert.match(section, /plainText: parsed\.text/u);
  assert.match(section, /doc: parsed\.doc/u);
  assert.doesNotMatch(section, /plainText: content/u);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const STATUS_PATH = path.join(
  REPO_ROOT,
  'docs',
  'OPS',
  'STATUS',
  'REVIEW_BRIDGE_WORD_EVIDENCE_CLAIM_BINDING_001_STATUS.json',
);

function readText(parts) {
  return fs.readFileSync(path.join(REPO_ROOT, ...parts), 'utf8');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function assertNoBroadWordClaims(text, label) {
  const forbidden = [
    /\bWord support is (?:available|supported|ready|complete)\b/iu,
    /\bWord supported\b/iu,
    /\bWord import is (?:available|supported|ready|complete)\b/iu,
    /\bWord roundtrip is (?:available|supported|ready|complete)\b/iu,
    /\bWord layout parity is (?:available|supported|ready|complete)\b/iu,
    /\bfull DOCX fidelity is (?:available|supported|ready|complete)\b/iu,
    /\bfull DOCX review import is (?:available|supported|ready|complete)\b/iu,
  ];

  for (const pattern of forbidden) {
    assert.equal(pattern.test(text), false, `${label} contains broad Word claim: ${pattern.source}`);
  }
}

test('Review Bridge Word evidence claim binding status keeps scope narrow', () => {
  const status = readJson(STATUS_PATH);

  assert.equal(status.taskId, 'REVIEW_BRIDGE_WORD_EVIDENCE_CLAIM_BINDING_001');
  assert.equal(status.type, 'review_bridge_word_evidence_claim_binding');
  assert.ok(
    ['implemented_verified_pending_delivery', 'delivered_merged_verified'].includes(status.status),
    `unexpected status ${status.status}`,
  );
  assert.equal(status.scope.desktopFirst, true);
  assert.equal(status.scope.offlineFirst, true);
  assert.equal(status.scope.reviewBridgeContour, true);
  assert.equal(status.scope.importExportMvpScopeExpanded, false);
  assert.equal(status.scope.uiRedesign, false);
  assert.equal(status.scope.newDependenciesAdded, false);
  assert.equal(status.scope.runtimeProductionCodeChanged, false);
  assert.equal(status.scope.rendererSurfaceChanged, false);
  assert.equal(status.scope.projectTruthWrites, false);
  assert.equal(status.scope.manuscriptWrites, false);
  assert.equal(status.scope.storageWrite, false);
  assert.equal(status.scope.receiptOrRecoveryCreated, false);
  assert.equal(status.scope.wordParserChanged, false);
  assert.equal(status.scope.docxImportSafeCreateChanged, false);
  assert.equal(status.scope.docxExportChanged, false);
  assert.equal(status.scope.autoApply, false);
  assert.equal(status.scope.releaseReadinessClaimed, false);
  assert.equal(status.scope.y9Opened, false);
});

test('Review Bridge Word evidence claim binding proves only claim-bound evidence', () => {
  const status = readJson(STATUS_PATH);
  const positiveText = status.positiveClaims.join('\n');
  const nonClaimText = status.nonClaims.join('\n');
  const layerText = status.layerDecisions.join('\n');

  assert.match(positiveText, /Word evidence claim gate/u);
  assert.match(positiveText, /valid Word evidence packet/u);
  assert.match(positiveText, /evidence hash matches/u);
  assert.match(positiveText, /textExact, commentAnchor, and structuralManual/u);

  for (const phrase of [
    'No Word support is claimed.',
    'No Word import is claimed.',
    'No Word review import is claimed.',
    'No Word sync is claimed.',
    'No Word roundtrip is claimed.',
    'No Word layout parity is claimed.',
    'No full DOCX fidelity is claimed.',
    'No exact apply from Word or DOCX is claimed.',
    'No project truth write is performed by Word evidence claim binding.',
    'No receipt or recovery evidence is created by Word evidence claim binding.',
    'No import/export MVP closeout is widened.',
  ]) {
    assert.match(nonClaimText, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'));
  }

  assert.match(layerText, /Evidence layer validates packet and claim only/u);
  assert.match(layerText, /not a parser/u);
  assert.match(layerText, /not content import/u);
  assert.match(layerText, /not Review import/u);
  assert.match(layerText, /not an apply plan/u);
  assert.match(layerText, /not safe write/u);
  assert.match(layerText, /not export/u);
});

test('Review Bridge Word evidence claim binding is bound to existing kernel and tests', () => {
  const status = readJson(STATUS_PATH);
  const bridgeSource = readText(['src', 'io', 'revisionBridge', 'index.mjs']);
  const wordEvidenceTest = readText([
    'test',
    'contracts',
    'revision-bridge-word-evidence-check.contract.test.js',
  ]);

  assert.equal(status.binding.existingKernelMarker, 'CONTOUR_10_WORD_EVIDENCE_CHECK_R2');
  assert.match(bridgeSource, /CONTOUR_10_WORD_EVIDENCE_CHECK_R2_START/u);
  assert.match(bridgeSource, /REVISION_BRIDGE_WORD_EVIDENCE_PACKET_SCHEMA/u);
  assert.match(bridgeSource, /REVISION_BRIDGE_WORD_SUPPORT_CLAIM_SCHEMA/u);
  assert.match(bridgeSource, /REVISION_BRIDGE_WORD_EVIDENCE_COVERAGE_EXCEEDED/u);
  assert.match(bridgeSource, /REVISION_BRIDGE_WORD_EVIDENCE_HASH_MISMATCH/u);

  assert.match(wordEvidenceTest, /accepts every supported Word evidence packet class/u);
  assert.match(wordEvidenceTest, /blocks claims when evidence is missing or invalid/u);
  assert.match(wordEvidenceTest, /blocks claims when evidence hash does not match/u);
  assert.match(wordEvidenceTest, /blocks claims that exceed evidence packet coverage/u);
});

test('Review Bridge Word evidence claim binding keeps docs honest', () => {
  const status = readJson(STATUS_PATH);
  const context = readText(['docs', 'CONTEXT.md']);
  const handoff = readText(['docs', 'HANDOFF.md']);
  const worklog = readText(['docs', 'WORKLOG.md']);
  const docsText = [context, handoff, worklog].join('\n');
  const statusText = JSON.stringify(status, null, 2);

  for (const text of [context, handoff, worklog]) {
    assert.match(text, /REVIEW_BRIDGE_WORD_EVIDENCE_CLAIM_BINDING_001/u);
    assert.match(text, /Word evidence claim/u);
  }

  assertNoBroadWordClaims(statusText, 'status');
  assertNoBroadWordClaims(docsText, 'docs');
  assert.match(docsText, /no Word support, Word import, Word roundtrip, Word layout parity, full DOCX fidelity/iu);
});

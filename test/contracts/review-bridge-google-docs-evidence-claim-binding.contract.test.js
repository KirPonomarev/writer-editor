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
  'REVIEW_BRIDGE_GOOGLE_DOCS_EVIDENCE_CLAIM_BINDING_001_STATUS.json',
);

function readText(parts) {
  return fs.readFileSync(path.join(REPO_ROOT, ...parts), 'utf8');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function assertNoBroadGoogleDocsClaims(text, label) {
  const forbidden = [
    /\bGoogle Docs support is (?:available|supported|ready|complete)\b/iu,
    /\bGoogle Docs supported\b/iu,
    /\bGoogle Docs import is (?:available|supported|ready|complete)\b/iu,
    /\bGoogle Docs sync is (?:available|supported|ready|complete)\b/iu,
    /\bGoogle Docs roundtrip is (?:available|supported|ready|complete)\b/iu,
    /\bGoogle Docs layout parity is (?:available|supported|ready|complete)\b/iu,
    /\bGoogle Drive integration is (?:available|supported|ready|complete)\b/iu,
    /\bGoogle API integration is (?:available|supported|ready|complete)\b/iu,
    /\bfull Google Docs fidelity is (?:available|supported|ready|complete)\b/iu,
    /\bfull Google Docs review import is (?:available|supported|ready|complete)\b/iu,
  ];

  for (const pattern of forbidden) {
    assert.equal(pattern.test(text), false, `${label} contains broad Google Docs claim: ${pattern.source}`);
  }
}

test('Review Bridge Google Docs evidence claim binding status keeps scope narrow', () => {
  const status = readJson(STATUS_PATH);

  assert.equal(status.taskId, 'REVIEW_BRIDGE_GOOGLE_DOCS_EVIDENCE_CLAIM_BINDING_001');
  assert.equal(status.type, 'review_bridge_google_docs_evidence_claim_binding');
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
  assert.equal(status.scope.googleDocsParserChanged, false);
  assert.equal(status.scope.googleApiUsed, false);
  assert.equal(status.scope.networkAccessAdded, false);
  assert.equal(status.scope.docxImportSafeCreateChanged, false);
  assert.equal(status.scope.docxExportChanged, false);
  assert.equal(status.scope.autoApply, false);
  assert.equal(status.scope.releaseReadinessClaimed, false);
  assert.equal(status.scope.y9Opened, false);
});

test('Review Bridge Google Docs evidence claim binding proves only claim-bound evidence', () => {
  const status = readJson(STATUS_PATH);
  const positiveText = status.positiveClaims.join('\n');
  const nonClaimText = status.nonClaims.join('\n');
  const layerText = status.layerDecisions.join('\n');

  assert.match(positiveText, /Google Docs evidence claim gate/u);
  assert.match(positiveText, /valid Google Docs evidence packet/u);
  assert.match(positiveText, /evidence hash matches/u);
  assert.match(positiveText, /docsSuggestions and driveComments/u);

  for (const phrase of [
    'No Google Docs support is claimed.',
    'No Google Docs import is claimed.',
    'No Google Docs review import is claimed.',
    'No Google Docs sync is claimed.',
    'No Google Docs roundtrip is claimed.',
    'No Google Docs layout parity is claimed.',
    'No full Google Docs fidelity is claimed.',
    'No Google API or Google Drive integration is claimed.',
    'No exact apply from Google Docs is claimed.',
    'No project truth write is performed by Google Docs evidence claim binding.',
    'No receipt or recovery evidence is created by Google Docs evidence claim binding.',
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
  assert.match(layerText, /not a Google API integration/u);
});

test('Review Bridge Google Docs evidence claim binding is bound to existing kernel and tests', () => {
  const status = readJson(STATUS_PATH);
  const bridgeSource = readText(['src', 'io', 'revisionBridge', 'index.mjs']);
  const googleDocsEvidenceTest = readText([
    'test',
    'contracts',
    'revision-bridge-google-docs-evidence-check.contract.test.js',
  ]);

  assert.equal(status.binding.existingKernelMarker, 'CONTOUR_11_GOOGLE_DOCS_EVIDENCE_CHECK');
  assert.match(bridgeSource, /CONTOUR_11_GOOGLE_DOCS_EVIDENCE_CHECK_START/u);
  assert.match(bridgeSource, /REVISION_BRIDGE_GOOGLE_DOCS_EVIDENCE_PACKET_SCHEMA/u);
  assert.match(bridgeSource, /REVISION_BRIDGE_GOOGLE_DOCS_SUPPORT_CLAIM_SCHEMA/u);
  assert.match(bridgeSource, /REVISION_BRIDGE_GOOGLE_DOCS_EVIDENCE_COVERAGE_EXCEEDED/u);
  assert.match(bridgeSource, /REVISION_BRIDGE_GOOGLE_DOCS_EVIDENCE_HASH_MISMATCH/u);
  assert.match(bridgeSource, /REVISION_BRIDGE_GOOGLE_DOCS_EVIDENCE_REQUIRED_CLASSES_MISSING/u);

  assert.match(googleDocsEvidenceTest, /accepts Google Docs claim when hash and required coverage align/u);
  assert.match(googleDocsEvidenceTest, /blocks when evidencePacket is missing required fields/u);
  assert.match(googleDocsEvidenceTest, /blocks when evidence hash does not match/u);
  assert.match(googleDocsEvidenceTest, /blocks claims that exceed Google Docs evidence coverage/u);
  assert.match(googleDocsEvidenceTest, /requires docsSuggestions and driveComments classes/u);
});

test('Review Bridge Google Docs evidence claim binding keeps docs honest', () => {
  const status = readJson(STATUS_PATH);
  const context = readText(['docs', 'CONTEXT.md']);
  const handoff = readText(['docs', 'HANDOFF.md']);
  const worklog = readText(['docs', 'WORKLOG.md']);
  const docsText = [context, handoff, worklog].join('\n');
  const statusText = JSON.stringify(status, null, 2);

  for (const text of [context, handoff, worklog]) {
    assert.match(text, /REVIEW_BRIDGE_GOOGLE_DOCS_EVIDENCE_CLAIM_BINDING_001/u);
    assert.match(text, /Google Docs evidence claim/u);
  }

  assertNoBroadGoogleDocsClaims(statusText, 'status');
  assertNoBroadGoogleDocsClaims(docsText, 'docs');
  assert.match(
    docsText,
    /no Google Docs support, Google Docs import, Google Docs sync, Google Docs roundtrip, Google Docs layout parity, full Google Docs fidelity/iu,
  );
});

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
  'REVIEW_BRIDGE_FORMAT_MATRIX_CLAIM_BINDING_001_STATUS.json',
);

function readText(parts) {
  return fs.readFileSync(path.join(REPO_ROOT, ...parts), 'utf8');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function assertNoBroadFormatClaims(text, label) {
  const forbidden = [
    /\bformat support is (?:available|supported|ready|complete)\b/iu,
    /\bnew user-facing format support is (?:available|supported|ready|complete)\b/iu,
    /\bimport is (?:available|supported|ready|complete)\b/iu,
    /\bexport is (?:available|supported|ready|complete)\b/iu,
    /\broundtrip is (?:available|supported|ready|complete)\b/iu,
    /\blayout parity is (?:available|supported|ready|complete)\b/iu,
    /\bfull fidelity is (?:available|supported|ready|complete)\b/iu,
    /\brelease claim dossier is (?:accepted|available|supported|ready|complete)\b/iu,
    /\brelease readiness is (?:available|supported|ready|complete)\b/iu,
  ];

  for (const pattern of forbidden) {
    assert.equal(pattern.test(text), false, `${label} contains broad format claim: ${pattern.source}`);
  }
}

test('Review Bridge format matrix claim binding status keeps scope narrow', () => {
  const status = readJson(STATUS_PATH);

  assert.equal(status.taskId, 'REVIEW_BRIDGE_FORMAT_MATRIX_CLAIM_BINDING_001');
  assert.equal(status.type, 'review_bridge_format_matrix_claim_binding');
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
  assert.equal(status.scope.formatMatrixRuntimeChanged, false);
  assert.equal(status.scope.goldenSetRuntimeChanged, false);
  assert.equal(status.scope.releaseClaimDossierAccepted, false);
  assert.equal(status.scope.docxImportSafeCreateChanged, false);
  assert.equal(status.scope.docxExportChanged, false);
  assert.equal(status.scope.autoApply, false);
  assert.equal(status.scope.releaseReadinessClaimed, false);
  assert.equal(status.scope.y9Opened, false);
});

test('Review Bridge format matrix claim binding proves only matrix-bound claims', () => {
  const status = readJson(STATUS_PATH);
  const positiveText = status.positiveClaims.join('\n');
  const nonClaimText = status.nonClaims.join('\n');
  const layerText = status.layerDecisions.join('\n');

  assert.match(positiveText, /format matrix claim gate/u);
  assert.match(positiveText, /valid format matrix/u);
  assert.match(positiveText, /valid golden set/u);
  assert.match(positiveText, /matching golden set hash/u);
  assert.match(positiveText, /claimScope does not exceed/u);

  for (const phrase of [
    'No new user-facing format support is claimed.',
    'No import support is claimed.',
    'No export support is claimed.',
    'No roundtrip is claimed.',
    'No layout parity is claimed.',
    'No full fidelity is claimed.',
    'No release claim dossier acceptance is claimed.',
    'No release readiness is claimed.',
    'No project truth write is performed by format matrix claim binding.',
    'No receipt or recovery evidence is created by format matrix claim binding.',
    'No import/export MVP closeout is widened.',
  ]) {
    assert.match(nonClaimText, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'));
  }

  assert.match(layerText, /Claim boundary validates matrix, golden set, and claim only/u);
  assert.match(layerText, /does not become project truth/u);
  assert.match(layerText, /does not prove full fidelity/u);
  assert.match(layerText, /not a release claim dossier/u);
  assert.match(layerText, /not content import/u);
  assert.match(layerText, /not export/u);
  assert.match(layerText, /not an apply plan/u);
});

test('Review Bridge format matrix claim binding is bound to existing kernel and tests', () => {
  const status = readJson(STATUS_PATH);
  const bridgeSource = readText(['src', 'io', 'revisionBridge', 'index.mjs']);
  const formatMatrixTest = readText([
    'test',
    'contracts',
    'revision-bridge-format-matrix-claim-gate.contract.test.js',
  ]);

  assert.equal(status.binding.existingKernelMarker, 'CONTOUR_12_FORMAT_MATRIX_CLAIM_GATE');
  assert.match(bridgeSource, /CONTOUR_12_FORMAT_MATRIX_CLAIM_GATE_START/u);
  assert.match(bridgeSource, /REVISION_BRIDGE_FORMAT_MATRIX_SCHEMA/u);
  assert.match(bridgeSource, /REVISION_BRIDGE_GOLDEN_SET_SCHEMA/u);
  assert.match(bridgeSource, /REVISION_BRIDGE_FORMAT_MATRIX_SUPPORT_CLAIM_SCHEMA/u);
  assert.match(bridgeSource, /REVISION_BRIDGE_FORMAT_MATRIX_ROW_MISSING/u);
  assert.match(bridgeSource, /REVISION_BRIDGE_GOLDEN_SET_HASH_MISMATCH/u);
  assert.match(bridgeSource, /REVISION_BRIDGE_FORMAT_MATRIX_CLAIM_SCOPE_EXCEEDS_SURFACE/u);

  assert.match(formatMatrixTest, /accepts matched matrix row, golden set hash, scope, and tests/u);
  assert.match(formatMatrixTest, /blocks when matrix row is missing/u);
  assert.match(formatMatrixTest, /blocks when golden set hash does not match/u);
  assert.match(formatMatrixTest, /blocks when golden set formatId does not match/u);
  assert.match(formatMatrixTest, /blocks when golden set surface does not match/u);
  assert.match(formatMatrixTest, /blocks when required tests are missing/u);
  assert.match(formatMatrixTest, /blocks when claim scope exceeds matrix surface/u);
});

test('Review Bridge format matrix claim binding keeps docs honest', () => {
  const status = readJson(STATUS_PATH);
  const context = readText(['docs', 'CONTEXT.md']);
  const handoff = readText(['docs', 'HANDOFF.md']);
  const worklog = readText(['docs', 'WORKLOG.md']);
  const docsText = [context, handoff, worklog].join('\n');
  const statusText = JSON.stringify(status, null, 2);

  for (const text of [context, handoff, worklog]) {
    assert.match(text, /REVIEW_BRIDGE_FORMAT_MATRIX_CLAIM_BINDING_001/u);
    assert.match(text, /format matrix claim/u);
  }

  assertNoBroadFormatClaims(statusText, 'status');
  assertNoBroadFormatClaims(docsText, 'docs');
  assert.match(
    docsText,
    /no new user-facing format support, import support, export support, roundtrip, layout parity, full fidelity, release claim dossier acceptance, release readiness/iu,
  );
});

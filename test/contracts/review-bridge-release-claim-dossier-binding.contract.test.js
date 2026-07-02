const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MODULE_PATH = 'src/io/revisionBridge/index.mjs';
const STATUS_PATH = path.join(
  REPO_ROOT,
  'docs',
  'OPS',
  'STATUS',
  'REVIEW_BRIDGE_RELEASE_CLAIM_DOSSIER_BINDING_001_STATUS.json',
);
const CONTRACT_PATH = 'test/contracts/review-bridge-release-claim-dossier-binding.contract.test.js';
const KERNEL_TEST_PATH = 'test/contracts/revision-bridge-release-claim-dossier-binding.contract.test.js';
const WORD_EVIDENCE_TEST_PATH = 'test/contracts/revision-bridge-word-evidence-check.contract.test.js';
const GOOGLE_DOCS_EVIDENCE_TEST_PATH = 'test/contracts/revision-bridge-google-docs-evidence-check.contract.test.js';
const FORMAT_MATRIX_TEST_PATH = 'test/contracts/revision-bridge-format-matrix-claim-gate.contract.test.js';
const FORMAT_MATRIX_BINDING_TEST_PATH = 'test/contracts/review-bridge-format-matrix-claim-binding.contract.test.js';
const STATUS_PATH_REL = 'docs/OPS/STATUS/REVIEW_BRIDGE_RELEASE_CLAIM_DOSSIER_BINDING_001_STATUS.json';
const GOVERNANCE_APPROVALS_PATH = 'docs/OPS/GOVERNANCE_APPROVALS/GOVERNANCE_CHANGE_APPROVALS.json';
const ADMISSION_BINDING_TEST_PATH = 'test/contracts/review-bridge-release-claim-admission-binding.contract.test.js';
const ADMISSION_BINDING_STATUS_PATH = 'docs/OPS/STATUS/REVIEW_BRIDGE_RELEASE_CLAIM_ADMISSION_BINDING_001_STATUS.json';
const ADMISSION_KERNEL_TEST_PATH = 'test/contracts/revision-bridge-release-claim-admission-gate.contract.test.js';
const MODE_DECISION_BINDING_TEST_PATH = 'test/contracts/review-bridge-release-claim-mode-decision-binding.contract.test.js';
const MODE_DECISION_BINDING_STATUS_PATH = 'docs/OPS/STATUS/REVIEW_BRIDGE_RELEASE_CLAIM_MODE_DECISION_BINDING_001_STATUS.json';
const MODE_DECISION_KERNEL_TEST_PATH = 'test/contracts/revision-bridge-release-claim-decision-gate.contract.test.js';
const ATTESTATION_KERNEL_TEST_PATH = 'test/contracts/revision-bridge-release-claim-attestation-gate.contract.test.js';
const ATTESTATION_BINDING_TEST_PATH = 'test/contracts/review-bridge-release-claim-attestation-binding.contract.test.js';
const ATTESTATION_BINDING_STATUS_PATH = 'docs/OPS/STATUS/REVIEW_BRIDGE_RELEASE_CLAIM_ATTESTATION_BINDING_001_STATUS.json';
const PACKET_KERNEL_TEST_PATH = 'test/contracts/revision-bridge-release-claim-packet-emit.contract.test.js';
const PACKET_BINDING_TEST_PATH = 'test/contracts/review-bridge-release-claim-packet-emit-binding.contract.test.js';
const PACKET_BINDING_STATUS_PATH = 'docs/OPS/STATUS/REVIEW_BRIDGE_RELEASE_CLAIM_PACKET_EMIT_BINDING_001_STATUS.json';
const USER_FACING_BOUNDARY_KERNEL_TEST_PATH =
  'test/contracts/revision-bridge-release-claim-user-facing-boundary-gate.contract.test.js';
const USER_FACING_BOUNDARY_BINDING_TEST_PATH =
  'test/contracts/review-bridge-release-claim-user-facing-boundary-binding.contract.test.js';
const USER_FACING_BOUNDARY_BINDING_STATUS_PATH =
  'docs/OPS/STATUS/REVIEW_BRIDGE_RELEASE_CLAIM_USER_FACING_BOUNDARY_BINDING_001_STATUS.json';
const PUBLICATION_KERNEL_TEST_PATH = 'test/contracts/revision-bridge-release-claim-publication-gate.contract.test.js';
const PUBLICATION_BINDING_TEST_PATH =
  'test/contracts/review-bridge-release-claim-publication-gate-binding.contract.test.js';
const PUBLICATION_BINDING_STATUS_PATH =
  'docs/OPS/STATUS/REVIEW_BRIDGE_RELEASE_CLAIM_PUBLICATION_GATE_BINDING_001_STATUS.json';
const KERNEL_FENCE_TEST_PATH = 'test/contracts/revision-bridge-release-claim-kernel-fence.contract.test.js';
const KERNEL_FENCE_BINDING_TEST_PATH =
  'test/contracts/review-bridge-release-claim-kernel-fence-binding.contract.test.js';
const KERNEL_FENCE_BINDING_STATUS_PATH =
  'docs/OPS/STATUS/REVIEW_BRIDGE_RELEASE_CLAIM_KERNEL_FENCE_BINDING_001_STATUS.json';
const COMMAND_ADMISSION_TEST_PATH =
  'test/contracts/revision-bridge-release-claim-command-admission.contract.test.js';
const COMMAND_ADMISSION_BINDING_TEST_PATH =
  'test/contracts/review-bridge-release-claim-command-admission-binding.contract.test.js';
const COMMAND_ADMISSION_BINDING_STATUS_PATH =
  'docs/OPS/STATUS/REVIEW_BRIDGE_RELEASE_CLAIM_COMMAND_ADMISSION_BINDING_001_STATUS.json';
const EXECUTION_TEST_PATH = 'test/contracts/revision-bridge-release-claim-execution-gate.contract.test.js';
const CONTEXT_PATH = 'docs/CONTEXT.md';
const HANDOFF_PATH = 'docs/HANDOFF.md';
const WORKLOG_PATH = 'docs/WORKLOG.md';
const ALLOWLIST = [
  MODULE_PATH,
  CONTRACT_PATH,
  WORD_EVIDENCE_TEST_PATH,
  GOOGLE_DOCS_EVIDENCE_TEST_PATH,
  FORMAT_MATRIX_TEST_PATH,
  ADMISSION_BINDING_TEST_PATH,
  ADMISSION_BINDING_STATUS_PATH,
  ADMISSION_KERNEL_TEST_PATH,
  MODE_DECISION_BINDING_TEST_PATH,
  MODE_DECISION_BINDING_STATUS_PATH,
  MODE_DECISION_KERNEL_TEST_PATH,
  ATTESTATION_KERNEL_TEST_PATH,
  ATTESTATION_BINDING_TEST_PATH,
  ATTESTATION_BINDING_STATUS_PATH,
  PACKET_KERNEL_TEST_PATH,
  PACKET_BINDING_TEST_PATH,
  PACKET_BINDING_STATUS_PATH,
  USER_FACING_BOUNDARY_KERNEL_TEST_PATH,
  USER_FACING_BOUNDARY_BINDING_TEST_PATH,
  USER_FACING_BOUNDARY_BINDING_STATUS_PATH,
  PUBLICATION_KERNEL_TEST_PATH,
  PUBLICATION_BINDING_TEST_PATH,
  PUBLICATION_BINDING_STATUS_PATH,
  KERNEL_FENCE_TEST_PATH,
  KERNEL_FENCE_BINDING_TEST_PATH,
  KERNEL_FENCE_BINDING_STATUS_PATH,
  COMMAND_ADMISSION_TEST_PATH,
  COMMAND_ADMISSION_BINDING_TEST_PATH,
  COMMAND_ADMISSION_BINDING_STATUS_PATH,
  EXECUTION_TEST_PATH,
  STATUS_PATH_REL,
  GOVERNANCE_APPROVALS_PATH,
  CONTEXT_PATH,
  HANDOFF_PATH,
  WORKLOG_PATH,
];

function readText(parts) {
  return fs.readFileSync(path.join(REPO_ROOT, ...parts), 'utf8');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

async function loadBridge() {
  return import(pathToFileURL(path.join(REPO_ROOT, MODULE_PATH)).href);
}

function changedFilesFromGitStatus(statusText) {
  return statusText
    .split('\n')
    .filter(Boolean)
    .map((line) => line.slice(3).replace(/^"|"$/gu, ''));
}

function assertNoReleaseDossierOverclaims(text, label) {
  const forbidden = [
    /\brelease claim dossier is (?:release-ready|ready|complete|published|available|supported)\b/iu,
    /\brelease readiness is (?:available|supported|ready|complete|proven)\b/iu,
    /\buser-facing release is (?:available|supported|ready|complete|proven)\b/iu,
    /\brelease admission is (?:available|supported|ready|complete|proven)\b/iu,
    /\brelease execution is (?:available|supported|ready|complete|proven)\b/iu,
    /\brelease publication is (?:available|supported|ready|complete|proven)\b/iu,
    /\bWord support is (?:available|supported|ready|complete|proven)\b/iu,
    /\bGoogle Docs support is (?:available|supported|ready|complete|proven)\b/iu,
    /\bDOCX support is (?:available|supported|ready|complete|proven)\b/iu,
    /\bDOCX import is (?:available|supported|ready|complete|proven)\b/iu,
    /\bimport support is (?:available|supported|ready|complete|proven)\b/iu,
    /\bexport support is (?:available|supported|ready|complete|proven)\b/iu,
    /\broundtrip is (?:available|supported|ready|complete|proven)\b/iu,
    /\blayout parity is (?:available|supported|ready|complete|proven)\b/iu,
    /\bfull fidelity is (?:available|supported|ready|complete|proven)\b/iu,
  ];

  for (const pattern of forbidden) {
    assert.equal(pattern.test(text), false, `${label} contains overclaim: ${pattern.source}`);
  }
}

function validFormatMatrix() {
  return {
    schemaVersion: 'revision-bridge.format-matrix.v1',
    matrixId: 'format-matrix-1',
    rows: [
      {
        rowId: 'word-text-exact',
        formatId: 'word',
        surface: ['textExact', 'commentAnchor'],
        requiredTests: ['rb12-word-text', 'rb12-word-comment'],
        goldenSetId: 'golden-word-v1',
      },
    ],
  };
}

function validGoldenSet() {
  return {
    schemaVersion: 'revision-bridge.golden-set.v1',
    goldenSetId: 'golden-word-v1',
    formatId: 'word',
    surface: ['textExact', 'commentAnchor'],
    requiredTests: ['rb12-golden-hash'],
    fixtures: [
      {
        fixtureId: 'fixture-word-main',
        digest: 'sha256:fixture-word-main',
      },
    ],
  };
}

function validClaim(bridge, goldenSet) {
  return {
    schemaVersion: 'revision-bridge.format-matrix-support-claim.v1',
    claimId: 'claim-1',
    matrixRowId: 'word-text-exact',
    claimScope: ['textExact', 'commentAnchor'],
    verifiedTests: ['rb12-word-text', 'rb12-word-comment', 'rb12-golden-hash'],
    goldenSetHash: bridge.createRevisionBridgeGoldenSetHash(goldenSet),
  };
}

function validDossier(bridge) {
  const goldenSet = validGoldenSet();
  return {
    schemaVersion: 'revision-bridge.release-claim-dossier.v1',
    dossierId: 'release-claim-dossier-1',
    items: [
      {
        schemaVersion: 'revision-bridge.release-claim-dossier-item.v1',
        itemId: 'dossier-item-1',
        goldenSet,
        claim: validClaim(bridge, goldenSet),
      },
    ],
  };
}

test('Review Bridge release claim dossier binding status keeps scope narrow', () => {
  const status = readJson(STATUS_PATH);

  assert.equal(status.taskId, 'REVIEW_BRIDGE_RELEASE_CLAIM_DOSSIER_BINDING_001');
  assert.equal(status.type, 'review_bridge_release_claim_dossier_binding');
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
  assert.equal(status.scope.releaseClaimDossierRuntimeChanged, false);
  assert.equal(status.scope.releaseAdmissionAccepted, false);
  assert.equal(status.scope.releaseExecutionAccepted, false);
  assert.equal(status.scope.releasePublicationAccepted, false);
  assert.equal(status.scope.userFacingReleaseClaimed, false);
  assert.equal(status.scope.docxImportSafeCreateChanged, false);
  assert.equal(status.scope.docxExportChanged, false);
  assert.equal(status.scope.autoApply, false);
  assert.equal(status.scope.releaseReadinessClaimed, false);
  assert.equal(status.scope.y9Opened, false);
});

test('Review Bridge release claim dossier binding proves only bounded dossier aggregation', async () => {
  const bridge = await loadBridge();
  const status = readJson(STATUS_PATH);
  const formatMatrix = validFormatMatrix();
  const dossier = validDossier(bridge);
  const result = bridge.evaluateRevisionBridgeReleaseClaimDossierGate({ formatMatrix, dossier });
  const positiveText = status.positiveClaims.join('\n');
  const nonClaimText = status.nonClaims.join('\n');
  const layerText = status.layerDecisions.join('\n');

  assert.equal(result.ok, true);
  assert.equal(result.type, 'revisionBridge.releaseClaimDossierGate');
  assert.equal(result.status, 'accepted');
  assert.equal(result.code, 'REVISION_BRIDGE_RELEASE_CLAIM_DOSSIER_ACCEPTED');
  assert.equal(result.binding.matrixId, 'format-matrix-1');
  assert.equal(result.binding.dossierId, 'release-claim-dossier-1');
  assert.equal(result.binding.itemCount, 1);
  assert.deepEqual(result.binding.itemIds, ['dossier-item-1']);
  assert.equal(result.summary.acceptedItems, 1);

  assert.match(positiveText, /release claim dossier gate/u);
  assert.match(positiveText, /evidence aggregation boundary/u);
  assert.match(positiveText, /valid dossier schema/u);
  assert.match(positiveText, /unique itemId/u);
  assert.match(positiveText, /matching golden set hashes/u);
  assert.match(positiveText, /claimScope within/u);

  for (const phrase of [
    'No release readiness is claimed.',
    'No user-facing release is claimed.',
    'No release admission completion is claimed.',
    'No release execution completion is claimed.',
    'No release publication completion is claimed.',
    'No Word support is claimed.',
    'No Google Docs support is claimed.',
    'No import support is claimed.',
    'No export support is claimed.',
    'No review import completion is claimed.',
    'No roundtrip is claimed.',
    'No layout parity is claimed.',
    'No full fidelity is claimed.',
    'No project truth write is performed by release claim dossier binding.',
    'No receipt or recovery evidence is created by release claim dossier binding.',
    'No import/export MVP closeout is widened.',
  ]) {
    assert.match(nonClaimText, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'));
  }

  assert.match(layerText, /aggregates already bounded claim items only/u);
  assert.match(layerText, /does not become project truth/u);
  assert.match(layerText, /does not admit release claims/u);
  assert.match(layerText, /not a release admission contour/u);
  assert.match(layerText, /not a release execution contour/u);
  assert.match(layerText, /not a release publication contour/u);
  assert.match(layerText, /not content import/u);
  assert.match(layerText, /not export/u);
  assert.match(layerText, /not an apply plan/u);
});

test('Review Bridge release claim dossier binding is bound to existing kernel and tests', () => {
  const status = readJson(STATUS_PATH);
  const bridgeSource = readText(['src', 'io', 'revisionBridge', 'index.mjs']);
  const kernelTest = readText(['test', 'contracts', 'revision-bridge-release-claim-dossier-binding.contract.test.js']);
  const formatMatrixTest = readText(['test', 'contracts', 'revision-bridge-format-matrix-claim-gate.contract.test.js']);

  assert.equal(status.binding.existingKernelMarker, 'CONTOUR_12B_RELEASE_CLAIM_DOSSIER_GATE');
  assert.equal(status.binding.formatMatrixClaimGateMarker, 'CONTOUR_12_FORMAT_MATRIX_CLAIM_GATE');
  assert.match(bridgeSource, /CONTOUR_12B_RELEASE_CLAIM_DOSSIER_GATE_START/u);
  assert.match(bridgeSource, /REVISION_BRIDGE_RELEASE_CLAIM_DOSSIER_SCHEMA/u);
  assert.match(bridgeSource, /REVISION_BRIDGE_RELEASE_CLAIM_DOSSIER_ITEM_SCHEMA/u);
  assert.match(bridgeSource, /evaluateRevisionBridgeReleaseClaimDossierGate/u);
  assert.match(bridgeSource, /evaluateRevisionBridgeFormatMatrixClaimGate/u);
  assert.match(bridgeSource, /REVISION_BRIDGE_RELEASE_CLAIM_DOSSIER_ITEMS_REQUIRED/u);
  assert.match(bridgeSource, /REVISION_BRIDGE_RELEASE_CLAIM_DOSSIER_ITEM_ID_DUPLICATE/u);

  assert.match(kernelTest, /accepts a dossier only when all items pass the reused 12A gate/u);
  assert.match(kernelTest, /blocks with diagnostics when dossier items are missing/u);
  assert.match(kernelTest, /blocks when a dossier item references a missing matrix row/u);
  assert.match(kernelTest, /blocks when dossier itemId is duplicated/u);
  assert.match(kernelTest, /blocks when a dossier item golden set hash does not match/u);
  assert.match(kernelTest, /blocks when a dossier item is missing required tests/u);
  assert.match(kernelTest, /blocks when a dossier item scope exceeds the declared surface/u);
  assert.match(formatMatrixTest, /accepts matched matrix row, golden set hash, scope, and tests/u);
});

test('Review Bridge release claim dossier binding keeps docs honest', () => {
  const status = readJson(STATUS_PATH);
  const context = readText(['docs', 'CONTEXT.md']);
  const handoff = readText(['docs', 'HANDOFF.md']);
  const worklog = readText(['docs', 'WORKLOG.md']);
  const docsText = [context, handoff, worklog].join('\n');
  const statusText = JSON.stringify(status, null, 2);

  for (const text of [context, handoff, worklog]) {
    assert.match(text, /REVIEW_BRIDGE_RELEASE_CLAIM_DOSSIER_BINDING_001/u);
    assert.match(text, /release claim dossier binding/iu);
    assert.match(text, /not release readiness/iu);
  }

  assertNoReleaseDossierOverclaims(statusText, 'status');
  assertNoReleaseDossierOverclaims(docsText, 'docs');
  assert.match(
    docsText,
    /no release readiness, user-facing release, release admission completion, release execution completion, release publication completion/iu,
  );
});

test('Review Bridge release claim dossier binding changed files stay inside allowlist', () => {
  const status = execFileSync('git', ['status', '--porcelain', '-uall'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  const changedFiles = changedFilesFromGitStatus(status);

  for (const filePath of changedFiles) {
    assert.equal(ALLOWLIST.includes(filePath), true, `changed file outside allowlist: ${filePath}`);
  }
});

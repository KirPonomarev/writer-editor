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
  'REVIEW_BRIDGE_RELEASE_CLAIM_USER_FACING_BOUNDARY_BINDING_001_STATUS.json',
);
const CONTRACT_PATH = 'test/contracts/review-bridge-release-claim-user-facing-boundary-binding.contract.test.js';
const USER_FACING_BOUNDARY_KERNEL_TEST_PATH =
  'test/contracts/revision-bridge-release-claim-user-facing-boundary-gate.contract.test.js';
const PACKET_BINDING_TEST_PATH = 'test/contracts/review-bridge-release-claim-packet-emit-binding.contract.test.js';
const PACKET_BINDING_STATUS_PATH =
  'docs/OPS/STATUS/REVIEW_BRIDGE_RELEASE_CLAIM_PACKET_EMIT_BINDING_001_STATUS.json';
const PACKET_KERNEL_TEST_PATH = 'test/contracts/revision-bridge-release-claim-packet-emit.contract.test.js';
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
const DOSSIER_BINDING_TEST_PATH = 'test/contracts/review-bridge-release-claim-dossier-binding.contract.test.js';
const ADMISSION_BINDING_TEST_PATH = 'test/contracts/review-bridge-release-claim-admission-binding.contract.test.js';
const MODE_DECISION_BINDING_TEST_PATH = 'test/contracts/review-bridge-release-claim-mode-decision-binding.contract.test.js';
const ATTESTATION_BINDING_TEST_PATH = 'test/contracts/review-bridge-release-claim-attestation-binding.contract.test.js';
const STATUS_PATH_REL =
  'docs/OPS/STATUS/REVIEW_BRIDGE_RELEASE_CLAIM_USER_FACING_BOUNDARY_BINDING_001_STATUS.json';
const GOVERNANCE_APPROVALS_PATH = 'docs/OPS/GOVERNANCE_APPROVALS/GOVERNANCE_CHANGE_APPROVALS.json';
const CONTEXT_PATH = 'docs/CONTEXT.md';
const HANDOFF_PATH = 'docs/HANDOFF.md';
const WORKLOG_PATH = 'docs/WORKLOG.md';
const EXECUTION_GATE_BINDING_STATUS_PATH =
  'docs/OPS/STATUS/REVIEW_BRIDGE_RELEASE_CLAIM_EXECUTION_GATE_BINDING_001_STATUS.json';
const EXECUTION_GATE_BINDING_TEST_PATH =
  'test/contracts/review-bridge-release-claim-execution-gate-binding.contract.test.js';
const COMMAND_SURFACE_WIRING_TEST_PATH =
  'test/contracts/revision-bridge-release-claim-command-surface-admission-wiring.contract.test.js';
const ALLOWLIST = [
  MODULE_PATH,
  CONTRACT_PATH,
  USER_FACING_BOUNDARY_KERNEL_TEST_PATH,
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
  PACKET_KERNEL_TEST_PATH,
  PACKET_BINDING_TEST_PATH,
  PACKET_BINDING_STATUS_PATH,
  DOSSIER_BINDING_TEST_PATH,
  ADMISSION_BINDING_TEST_PATH,
  MODE_DECISION_BINDING_TEST_PATH,
  ATTESTATION_BINDING_TEST_PATH,
  STATUS_PATH_REL,
  'src/main.js',
  'docs/OPS/STATUS/REVIEW_BRIDGE_RELEASE_CLAIM_COMMAND_SURFACE_ADMISSION_BINDING_001_STATUS.json',
  'test/contracts/review-bridge-release-claim-command-surface-admission-binding.contract.test.js',
  GOVERNANCE_APPROVALS_PATH,
  CONTEXT_PATH,
  HANDOFF_PATH,
  WORKLOG_PATH,
  EXECUTION_GATE_BINDING_STATUS_PATH,
  EXECUTION_GATE_BINDING_TEST_PATH,
  COMMAND_SURFACE_WIRING_TEST_PATH,
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

function acceptedPacketEmitResultFixture(bridge, mode = 'PR_MODE') {
  const releaseClass = mode === 'RELEASE_MODE' ? 'USER_FACING_CLAIM_READY' : 'INTERNAL_PROOF_ONLY';
  const packet = {
    schemaVersion: 'revision-bridge.release-claim-packet.v1',
    packetMeta: {
      packetId: 'release-claim-packet-1',
      createdAtUtc: '2026-07-02T00:00:00.000Z',
      emitterId: 'codex-contour-12f',
    },
    releaseClaim: {
      mode,
      modeClass: releaseClass,
      claimId: 'release-claim-1',
      dossierId: 'release-claim-dossier-1',
      matrixId: 'format-matrix-1',
    },
    attestation: {
      attestationId: 'attestation-1',
      commandRunDigest: 'sha256:run-1',
      decisionHash: 'sha256:decision-1',
      evidenceHash: 'sha256:evidence-1',
      inputHash: 'sha256:input-1',
      outputHash: 'sha256:output-1',
      releaseEvidenceId: mode === 'RELEASE_MODE' ? 'release-evidence-1' : '',
      releaseEvidenceHash: mode === 'RELEASE_MODE' ? 'sha256:release-evidence-1' : '',
      executedCommands: [],
      artifactHashes: [],
    },
    prerequisiteCodes: [
      'REVISION_BRIDGE_RELEASE_CLAIM_ATTESTATION_ACCEPTED',
      'REVISION_BRIDGE_RELEASE_CLAIM_MODE_DECISION_ACCEPTED',
    ],
  };
  packet.packetHash = bridge.createRevisionBridgeReleaseClaimPacketHash(packet);

  return {
    ok: true,
    type: 'revisionBridge.releaseClaimPacketEmit',
    status: 'accepted',
    code: 'REVISION_BRIDGE_RELEASE_CLAIM_PACKET_EMIT_ACCEPTED',
    reason: 'REVISION_BRIDGE_RELEASE_CLAIM_PACKET_EMIT_ACCEPTED',
    binding: {
      mode,
      modeClass: releaseClass,
      claimId: 'release-claim-1',
      dossierId: 'release-claim-dossier-1',
      matrixId: 'format-matrix-1',
      packetId: 'release-claim-packet-1',
      attestationId: 'attestation-1',
    },
    summary: {
      packetSchemaVersion: 'revision-bridge.release-claim-packet.v1',
      strictReportSchemaVersion: 'revision-bridge.release-claim-report.v1',
      packetHash: packet.packetHash,
      prerequisiteCodes: [
        'REVISION_BRIDGE_RELEASE_CLAIM_ATTESTATION_ACCEPTED',
        'REVISION_BRIDGE_RELEASE_CLAIM_MODE_DECISION_ACCEPTED',
      ],
    },
    packet,
    report: {
      schemaVersion: 'revision-bridge.release-claim-report.v1',
      reportClass: 'STRICT_RELEASE_CLAIM_REPORT',
      packetSchemaVersion: 'revision-bridge.release-claim-packet.v1',
      packetId: 'release-claim-packet-1',
      packetHash: packet.packetHash,
      createdAtUtc: '2026-07-02T00:00:00.000Z',
      mode,
      modeClass: releaseClass,
      claimId: 'release-claim-1',
      dossierId: 'release-claim-dossier-1',
      matrixId: 'format-matrix-1',
      attestationId: 'attestation-1',
      decisionHash: 'sha256:decision-1',
      evidenceHash: 'sha256:evidence-1',
      commandRunDigest: 'sha256:run-1',
      prerequisiteCodes: [
        'REVISION_BRIDGE_RELEASE_CLAIM_ATTESTATION_ACCEPTED',
        'REVISION_BRIDGE_RELEASE_CLAIM_MODE_DECISION_ACCEPTED',
      ],
    },
  };
}

function assertNoBoundaryOverclaims(text, label) {
  const forbidden = [
    /\bboundary accepted means release readiness\b/iu,
    /\buser-facing boundary means user-facing release\b/iu,
    /\bUSER_FACING_CLAIM_READY means release readiness\b/iu,
    /\bUSER_FACING_CLAIM_READY means user-facing release\b/iu,
    /\brelease readiness is (?:available|supported|ready|complete|proven)\b/iu,
    /\buser-facing release is (?:available|supported|ready|complete|proven)\b/iu,
    /\brelease publication is (?:available|supported|ready|complete|proven)\b/iu,
    /\brelease execution is (?:available|supported|ready|complete|proven)\b/iu,
    /\bpublication authority is (?:available|supported|ready|complete|proven)\b/iu,
    /\bimport support is (?:available|supported|ready|complete|proven)\b/iu,
    /\bexport support is (?:available|supported|ready|complete|proven)\b/iu,
    /\bproject truth write is (?:available|supported|ready|complete|proven)\b/iu,
  ];

  for (const pattern of forbidden) {
    assert.equal(pattern.test(text), false, `${label} contains overclaim: ${pattern.source}`);
  }
}

test('Review Bridge release claim user-facing boundary binding status keeps scope narrow', () => {
  const status = readJson(STATUS_PATH);

  assert.equal(status.taskId, 'REVIEW_BRIDGE_RELEASE_CLAIM_USER_FACING_BOUNDARY_BINDING_001');
  assert.equal(status.type, 'review_bridge_release_claim_user_facing_boundary_binding');
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
  assert.equal(status.scope.runtimeProductionCodeChanged, true);
  assert.equal(status.scope.rendererSurfaceChanged, false);
  assert.equal(status.scope.projectTruthWrites, false);
  assert.equal(status.scope.manuscriptWrites, false);
  assert.equal(status.scope.storageWrite, false);
  assert.equal(status.scope.receiptOrRecoveryCreated, false);
  assert.equal(status.scope.releaseClaimUserFacingBoundaryRuntimeChanged, true);
  assert.equal(status.scope.releaseClaimUserFacingBoundaryBound, true);
  assert.equal(status.scope.releaseClaimPacketEmitBoundPreviously, true);
  assert.equal(status.scope.releaseExecutionAccepted, false);
  assert.equal(status.scope.releasePublicationAccepted, false);
  assert.equal(status.scope.publicationAuthorityClaimed, false);
  assert.equal(status.scope.userFacingReleaseClaimed, false);
  assert.equal(status.scope.docxImportSafeCreateChanged, false);
  assert.equal(status.scope.docxExportChanged, false);
  assert.equal(status.scope.autoApply, false);
  assert.equal(status.scope.releaseReadinessClaimed, false);
  assert.equal(status.scope.y9Opened, false);
  assert.equal(status.implementation.changedProductionRuntime, true);
  assert.equal(status.implementation.changedUi, false);
});

test('Review Bridge release claim user-facing boundary binding proves bounded boundary truth', async () => {
  const bridge = await loadBridge();
  const status = readJson(STATUS_PATH);
  const internal = bridge.evaluateRevisionBridgeReleaseClaimUserFacingBoundaryGate({
    packetEmitResult: acceptedPacketEmitResultFixture(bridge, 'PR_MODE'),
    requestedMode: 'PR_MODE',
    requestedClaimSurface: 'INTERNAL',
  });
  const userFacing = bridge.evaluateRevisionBridgeReleaseClaimUserFacingBoundaryGate({
    packetEmitResult: acceptedPacketEmitResultFixture(bridge, 'RELEASE_MODE'),
    requestedMode: 'RELEASE_MODE',
    requestedClaimSurface: 'USER_FACING',
  });
  const blockedPrUserFacing = bridge.evaluateRevisionBridgeReleaseClaimUserFacingBoundaryGate({
    packetEmitResult: acceptedPacketEmitResultFixture(bridge, 'PR_MODE'),
    requestedMode: 'PR_MODE',
    requestedClaimSurface: 'USER_FACING',
  });
  const inheritedPacket = bridge.evaluateRevisionBridgeReleaseClaimUserFacingBoundaryGate({
    packetEmitResult: Object.create(acceptedPacketEmitResultFixture(bridge, 'RELEASE_MODE')),
    requestedMode: 'RELEASE_MODE',
    requestedClaimSurface: 'USER_FACING',
  });
  const emptyBindingPacket = acceptedPacketEmitResultFixture(bridge, 'RELEASE_MODE');
  emptyBindingPacket.binding = {};
  const emptyBinding = bridge.evaluateRevisionBridgeReleaseClaimUserFacingBoundaryGate({
    packetEmitResult: emptyBindingPacket,
    requestedMode: 'RELEASE_MODE',
    requestedClaimSurface: 'USER_FACING',
  });
  const missingBindingIdsPacket = acceptedPacketEmitResultFixture(bridge, 'RELEASE_MODE');
  delete missingBindingIdsPacket.binding.packetId;
  delete missingBindingIdsPacket.binding.attestationId;
  const missingBindingIds = bridge.evaluateRevisionBridgeReleaseClaimUserFacingBoundaryGate({
    packetEmitResult: missingBindingIdsPacket,
    requestedMode: 'RELEASE_MODE',
    requestedClaimSurface: 'USER_FACING',
  });

  assert.equal(internal.ok, true);
  assert.equal(internal.type, 'revisionBridge.releaseClaimUserFacingBoundaryGate');
  assert.equal(internal.code, 'REVISION_BRIDGE_RELEASE_CLAIM_USER_FACING_BOUNDARY_ACCEPTED');
  assert.equal(internal.summary.claimSurface, 'INTERNAL');
  assert.equal(internal.binding.releaseClass, 'INTERNAL_PROOF_ONLY');

  assert.equal(userFacing.ok, true);
  assert.equal(userFacing.summary.claimSurface, 'USER_FACING');
  assert.equal(userFacing.binding.mode, 'RELEASE_MODE');
  assert.equal(userFacing.binding.releaseClass, 'USER_FACING_CLAIM_READY');

  assert.equal(blockedPrUserFacing.ok, false);
  assert.equal(
    blockedPrUserFacing.reason,
    'REVISION_BRIDGE_RELEASE_CLAIM_USER_FACING_BOUNDARY_PR_MODE_USER_FACING_BLOCKED',
  );

  assert.equal(inheritedPacket.ok, false);
  assert.equal(
    inheritedPacket.reason,
    'REVISION_BRIDGE_RELEASE_CLAIM_USER_FACING_BOUNDARY_PACKET_RESULT_TYPE_INVALID',
  );
  assert.equal(emptyBinding.ok, false);
  assert.equal(
    emptyBinding.reason,
    'REVISION_BRIDGE_RELEASE_CLAIM_USER_FACING_BOUNDARY_PACKET_RESULT_PROVENANCE_INVALID',
  );
  assert.equal(
    emptyBinding.reasons.some((reason) => reason.field === 'packetEmitResult.binding.mode'),
    true,
  );
  assert.equal(missingBindingIds.ok, false);
  assert.equal(
    missingBindingIds.reasons.some((reason) => reason.field === 'packetEmitResult.binding.packetId'),
    true,
  );
  assert.equal(
    missingBindingIds.reasons.some((reason) => reason.field === 'packetEmitResult.binding.attestationId'),
    true,
  );

  const positiveText = status.positiveClaims.join('\n');
  const nonClaimText = status.nonClaims.join('\n');
  const layerText = status.layerDecisions.join('\n');

  assert.match(positiveText, /user-facing boundary gate/u);
  assert.match(positiveText, /bounded internal Review Bridge 12G boundary admission/u);
  assert.match(positiveText, /requires accepted 12F packet emit provenance/u);
  assert.match(positiveText, /PR_MODE USER_FACING requests are blocked/u);
  assert.match(positiveText, /strips inherited prototype fields/u);

  for (const phrase of [
    'No release readiness is claimed.',
    'No user-facing release is claimed.',
    'No release execution completion is claimed.',
    'No release publication completion is claimed.',
    'No publication authority is claimed.',
    'No import support is claimed.',
    'No export support is claimed.',
    'No project truth write is performed by release claim user-facing boundary binding.',
    'No receipt or recovery evidence is created by release claim user-facing boundary binding.',
    'No import/export MVP closeout is widened.',
  ]) {
    assert.match(nonClaimText, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'));
  }

  assert.match(layerText, /boundary admission only/u);
  assert.match(layerText, /does not execute release commands/u);
  assert.match(layerText, /does not publish anything/u);
  assert.match(layerText, /does not become project truth/u);
  assert.match(layerText, /not a user-facing UI state/u);
});

test('Review Bridge release claim user-facing boundary binding is bound to existing kernel', () => {
  const status = readJson(STATUS_PATH);
  const bridgeSource = readText(['src', 'io', 'revisionBridge', 'index.mjs']);
  const kernelTest = readText([
    'test',
    'contracts',
    'revision-bridge-release-claim-user-facing-boundary-gate.contract.test.js',
  ]);

  assert.equal(status.binding.existingKernelMarker, 'CONTOUR_12G_RELEASE_CLAIM_USER_FACING_BOUNDARY_GATE');
  assert.equal(status.binding.previousContourTaskId, 'REVIEW_BRIDGE_RELEASE_CLAIM_PACKET_EMIT_BINDING_001');
  assert.equal(status.binding.previousContourStatus, 'delivered_merged_verified');
  assert.equal(status.binding.upstreamPacketEmitGateMarker, 'CONTOUR_12F_RELEASE_CLAIM_PACKET_EMIT');
  assert.equal(status.binding.userFacingBoundarySchema, 'revision-bridge.release-claim-user-facing-boundary.v1');
  assert.match(bridgeSource, /CONTOUR_12G_RELEASE_CLAIM_USER_FACING_BOUNDARY_GATE_START/u);
  assert.match(bridgeSource, /evaluateRevisionBridgeReleaseClaimUserFacingBoundaryGate/u);
  assert.match(bridgeSource, /cloneJsonSafe\(input\)/u);
  assert.match(kernelTest, /rejects boundary input fields inherited from prototype/u);
  assert.match(kernelTest, /rejects packetEmitResult fields inherited from prototype/u);
  assert.match(kernelTest, /rejects nested packetEmitResult provenance inherited from prototype/u);
  assert.match(kernelTest, /blocks coherent accepted packet when raw binding is empty/u);
  assert.match(kernelTest, /blocks coherent accepted packet when binding ids are missing/u);
  assert.match(kernelTest, /blocks PR_MODE requests for USER_FACING boundary/u);
  assert.match(kernelTest, /accepts USER_FACING boundary for RELEASE_MODE only/u);
});

test('Review Bridge release claim user-facing boundary binding keeps docs honest', () => {
  const status = readJson(STATUS_PATH);
  const context = readText(['docs', 'CONTEXT.md']);
  const handoff = readText(['docs', 'HANDOFF.md']);
  const worklog = readText(['docs', 'WORKLOG.md']);
  const docsText = [context, handoff, worklog].join('\n');
  const statusText = JSON.stringify(status, null, 2);

  for (const text of [context, handoff, worklog]) {
    assert.match(text, /REVIEW_BRIDGE_RELEASE_CLAIM_USER_FACING_BOUNDARY_BINDING_001/u);
    assert.match(text, /user-facing boundary binding/iu);
    assert.match(text, /boundary admission/iu);
    assert.match(text, /raw packet emit binding fields/iu);
    assert.match(text, /not release readiness/iu);
    assert.match(text, /not a user-facing release/iu);
    assert.match(text, /not a user-facing UI state/iu);
  }

  assertNoBoundaryOverclaims(statusText, 'status');
  assertNoBoundaryOverclaims(docsText, 'docs');
  assert.match(
    docsText,
    /no release readiness, user-facing release, release execution completion, release publication completion/iu,
  );
});

test('Review Bridge release claim user-facing boundary binding changed files stay inside allowlist', () => {
  const status = execFileSync('git', ['status', '--porcelain', '-uall'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  const changedFiles = changedFilesFromGitStatus(status);

  for (const filePath of changedFiles) {
    assert.equal(ALLOWLIST.includes(filePath), true, `changed file outside allowlist: ${filePath}`);
  }

  const packageManifestDiff = changedFiles.filter((filePath) => (
    filePath === 'package.json'
    || filePath === 'package-lock.json'
    || filePath === 'npm-shrinkwrap.json'
  ));
  assert.deepEqual(packageManifestDiff, []);
});

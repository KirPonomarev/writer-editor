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
  'REVIEW_BRIDGE_RELEASE_CLAIM_PUBLICATION_GATE_BINDING_001_STATUS.json',
);
const CONTRACT_PATH = 'test/contracts/review-bridge-release-claim-publication-gate-binding.contract.test.js';
const PUBLICATION_KERNEL_TEST_PATH = 'test/contracts/revision-bridge-release-claim-publication-gate.contract.test.js';
const USER_FACING_BOUNDARY_KERNEL_TEST_PATH =
  'test/contracts/revision-bridge-release-claim-user-facing-boundary-gate.contract.test.js';
const USER_FACING_BOUNDARY_BINDING_TEST_PATH =
  'test/contracts/review-bridge-release-claim-user-facing-boundary-binding.contract.test.js';
const USER_FACING_BOUNDARY_BINDING_STATUS_PATH =
  'docs/OPS/STATUS/REVIEW_BRIDGE_RELEASE_CLAIM_USER_FACING_BOUNDARY_BINDING_001_STATUS.json';
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
const STATUS_PATH_REL =
  'docs/OPS/STATUS/REVIEW_BRIDGE_RELEASE_CLAIM_PUBLICATION_GATE_BINDING_001_STATUS.json';
const GOVERNANCE_APPROVALS_PATH = 'docs/OPS/GOVERNANCE_APPROVALS/GOVERNANCE_CHANGE_APPROVALS.json';
const DOSSIER_BINDING_TEST_PATH = 'test/contracts/review-bridge-release-claim-dossier-binding.contract.test.js';
const ADMISSION_BINDING_TEST_PATH = 'test/contracts/review-bridge-release-claim-admission-binding.contract.test.js';
const MODE_DECISION_BINDING_TEST_PATH = 'test/contracts/review-bridge-release-claim-mode-decision-binding.contract.test.js';
const ATTESTATION_BINDING_TEST_PATH = 'test/contracts/review-bridge-release-claim-attestation-binding.contract.test.js';
const PACKET_BINDING_TEST_PATH = 'test/contracts/review-bridge-release-claim-packet-emit-binding.contract.test.js';
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
  PUBLICATION_KERNEL_TEST_PATH,
  USER_FACING_BOUNDARY_KERNEL_TEST_PATH,
  USER_FACING_BOUNDARY_BINDING_TEST_PATH,
  USER_FACING_BOUNDARY_BINDING_STATUS_PATH,
  KERNEL_FENCE_TEST_PATH,
  KERNEL_FENCE_BINDING_TEST_PATH,
  KERNEL_FENCE_BINDING_STATUS_PATH,
  COMMAND_ADMISSION_TEST_PATH,
  COMMAND_ADMISSION_BINDING_TEST_PATH,
  COMMAND_ADMISSION_BINDING_STATUS_PATH,
  EXECUTION_TEST_PATH,
  DOSSIER_BINDING_TEST_PATH,
  ADMISSION_BINDING_TEST_PATH,
  MODE_DECISION_BINDING_TEST_PATH,
  ATTESTATION_BINDING_TEST_PATH,
  PACKET_BINDING_TEST_PATH,
  STATUS_PATH_REL,
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

function boundaryInputFixture(bridge, mode = 'PR_MODE', surface = 'INTERNAL') {
  return {
    packetEmitResult: acceptedPacketEmitResultFixture(bridge, mode),
    requestedMode: mode,
    requestedClaimSurface: surface,
  };
}

function publicationInputFixture(bridge, mode = 'PR_MODE', surface = 'INTERNAL', overrides = {}) {
  return {
    boundaryInput: boundaryInputFixture(bridge, mode, surface),
    requestedMode: mode,
    requestedClaimSurface: surface,
    ...overrides,
  };
}

function syntheticAcceptedBoundaryResult(overrides = {}) {
  return {
    ok: true,
    type: 'revisionBridge.releaseClaimUserFacingBoundaryGate',
    status: 'accepted',
    code: 'REVISION_BRIDGE_RELEASE_CLAIM_USER_FACING_BOUNDARY_ACCEPTED',
    reason: 'REVISION_BRIDGE_RELEASE_CLAIM_USER_FACING_BOUNDARY_ACCEPTED',
    binding: {
      mode: 'RELEASE_MODE',
      claimId: 'release-claim-1',
      dossierId: 'release-claim-dossier-1',
      matrixId: 'format-matrix-1',
      releaseClass: 'USER_FACING_CLAIM_READY',
      ...(overrides.binding || {}),
    },
    summary: {
      claimSurface: 'USER_FACING',
      packetId: 'release-claim-packet-1',
      attestationId: 'attestation-1',
      ...(overrides.summary || {}),
    },
  };
}

function assertNoPublicationOverclaims(text, label) {
  const forbidden = [
    /\bpublication gate accepted means product publication\b/iu,
    /\bpublication gate accepted means release readiness\b/iu,
    /\bpublication gate accepted means user-facing release\b/iu,
    /\bUSER_FACING_CLAIM_READY means release readiness\b/iu,
    /\bUSER_FACING_CLAIM_READY means user-facing release\b/iu,
    /\bproduct publication is (?:available|supported|ready|complete|proven)\b/iu,
    /\brelease readiness is (?:available|supported|ready|complete|proven)\b/iu,
    /\buser-facing release is (?:available|supported|ready|complete|proven)\b/iu,
    /\brelease execution is (?:available|supported|ready|complete|proven)\b/iu,
    /\bpublication authority is (?:available|supported|ready|complete|proven)\b/iu,
    /\bcommand admission is (?:available|supported|ready|complete|proven)\b/iu,
    /\bkernel fence is (?:available|supported|ready|complete|proven)\b/iu,
    /\bimport support is (?:available|supported|ready|complete|proven)\b/iu,
    /\bexport support is (?:available|supported|ready|complete|proven)\b/iu,
    /\bproject truth write is (?:available|supported|ready|complete|proven)\b/iu,
  ];

  for (const pattern of forbidden) {
    assert.equal(pattern.test(text), false, `${label} contains overclaim: ${pattern.source}`);
  }
}

test('Review Bridge release claim publication gate binding status keeps scope narrow', () => {
  const status = readJson(STATUS_PATH);

  assert.equal(status.taskId, 'REVIEW_BRIDGE_RELEASE_CLAIM_PUBLICATION_GATE_BINDING_001');
  assert.equal(status.type, 'review_bridge_release_claim_publication_gate_binding');
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
  assert.equal(status.scope.releaseClaimPublicationGateRuntimeChanged, true);
  assert.equal(status.scope.releaseClaimPublicationGateBound, true);
  assert.equal(status.scope.releaseClaimUserFacingBoundaryBoundPreviously, true);
  assert.equal(status.scope.releaseExecutionAccepted, false);
  assert.equal(status.scope.releasePublicationCompletionClaimed, false);
  assert.equal(status.scope.productPublicationClaimed, false);
  assert.equal(status.scope.publicationAuthorityClaimed, false);
  assert.equal(status.scope.userFacingReleaseClaimed, false);
  assert.equal(status.scope.commandAdmissionAccepted, false);
  assert.equal(status.scope.kernelFenceAccepted, false);
  assert.equal(status.scope.docxImportSafeCreateChanged, false);
  assert.equal(status.scope.docxExportChanged, false);
  assert.equal(status.scope.autoApply, false);
  assert.equal(status.scope.releaseReadinessClaimed, false);
  assert.equal(status.scope.y9Opened, false);
  assert.equal(status.implementation.changedProductionRuntime, true);
  assert.equal(status.implementation.changedUi, false);
});

test('Review Bridge release claim publication gate binding proves bounded publication truth', async () => {
  const bridge = await loadBridge();
  const status = readJson(STATUS_PATH);
  const internal = bridge.evaluateRevisionBridgeReleaseClaimPublicationGate(
    publicationInputFixture(bridge, 'PR_MODE', 'INTERNAL'),
  );
  const userFacing = bridge.evaluateRevisionBridgeReleaseClaimPublicationGate(
    publicationInputFixture(bridge, 'RELEASE_MODE', 'USER_FACING'),
  );
  const syntheticOnly = bridge.evaluateRevisionBridgeReleaseClaimPublicationGate({
    boundaryResult: syntheticAcceptedBoundaryResult(),
    requestedMode: 'RELEASE_MODE',
    requestedClaimSurface: 'USER_FACING',
  });
  const staleBoundary = bridge.evaluateRevisionBridgeReleaseClaimPublicationGate(
    publicationInputFixture(bridge, 'RELEASE_MODE', 'INTERNAL', {
      boundaryResult: syntheticAcceptedBoundaryResult(),
      requestedClaimSurface: 'USER_FACING',
    }),
  );
  const inheritedBoundaryInput = bridge.evaluateRevisionBridgeReleaseClaimPublicationGate({
    boundaryInput: Object.create(boundaryInputFixture(bridge, 'RELEASE_MODE', 'USER_FACING')),
    requestedMode: 'RELEASE_MODE',
    requestedClaimSurface: 'USER_FACING',
  });

  assert.equal(internal.ok, true);
  assert.equal(internal.type, 'revisionBridge.releaseClaimPublicationGate');
  assert.equal(internal.code, 'REVISION_BRIDGE_RELEASE_CLAIM_PUBLICATION_ACCEPTED');
  assert.equal(internal.summary.claimSurface, 'INTERNAL');
  assert.equal(internal.binding.releaseClass, 'INTERNAL_PROOF_ONLY');

  assert.equal(userFacing.ok, true);
  assert.equal(userFacing.summary.claimSurface, 'USER_FACING');
  assert.equal(userFacing.binding.mode, 'RELEASE_MODE');
  assert.equal(userFacing.binding.releaseClass, 'USER_FACING_CLAIM_READY');

  assert.equal(syntheticOnly.ok, false);
  assert.equal(
    syntheticOnly.reason,
    'REVISION_BRIDGE_RELEASE_CLAIM_PUBLICATION_BOUNDARY_INPUT_MISSING',
  );
  assert.equal(staleBoundary.ok, false);
  assert.equal(
    staleBoundary.reason,
    'REVISION_BRIDGE_RELEASE_CLAIM_PUBLICATION_BOUNDARY_RESULT_MISMATCH',
  );
  assert.equal(inheritedBoundaryInput.ok, false);
  assert.equal(
    inheritedBoundaryInput.reason,
    'REVISION_BRIDGE_RELEASE_CLAIM_PUBLICATION_BOUNDARY_RESULT_NOT_ACCEPTED',
  );

  const positiveText = status.positiveClaims.join('\n');
  const nonClaimText = status.nonClaims.join('\n');
  const layerText = status.layerDecisions.join('\n');

  assert.match(positiveText, /publication gate/u);
  assert.match(positiveText, /bounded internal Review Bridge 12H publication gate admission/u);
  assert.match(positiveText, /requires raw 12G boundary input/u);
  assert.match(positiveText, /re-evaluates the 12G user-facing boundary gate/u);
  assert.match(positiveText, /strips inherited prototype fields/u);
  assert.match(positiveText, /stale or fabricated boundaryResult/iu);

  for (const phrase of [
    'No product publication is claimed.',
    'No release readiness is claimed.',
    'No user-facing release is claimed.',
    'No release execution completion is claimed.',
    'No release publication completion is claimed.',
    'No publication authority is claimed.',
    'No command admission is claimed.',
    'No kernel fence is claimed.',
    'No import support is claimed.',
    'No export support is claimed.',
    'No project truth write is performed by release claim publication gate binding.',
    'No receipt or recovery evidence is created by release claim publication gate binding.',
    'No import/export MVP closeout is widened.',
  ]) {
    assert.match(nonClaimText, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'));
  }

  assert.match(layerText, /gate admission only/u);
  assert.match(layerText, /does not execute release commands/u);
  assert.match(layerText, /does not publish anything/u);
  assert.match(layerText, /does not become project truth/u);
  assert.match(layerText, /not a user-facing UI state/u);
});

test('Review Bridge release claim publication gate binding is bound to existing kernel', () => {
  const status = readJson(STATUS_PATH);
  const previousStatus = readJson(path.join(REPO_ROOT, USER_FACING_BOUNDARY_BINDING_STATUS_PATH));
  const bridgeSource = readText(['src', 'io', 'revisionBridge', 'index.mjs']);
  const kernelTest = readText([
    'test',
    'contracts',
    'revision-bridge-release-claim-publication-gate.contract.test.js',
  ]);

  assert.equal(status.binding.existingKernelMarker, 'CONTOUR_12H_RELEASE_CLAIM_PUBLICATION_GATE');
  assert.equal(status.binding.previousContourTaskId, 'REVIEW_BRIDGE_RELEASE_CLAIM_USER_FACING_BOUNDARY_BINDING_001');
  assert.equal(status.binding.previousContourStatus, 'delivered_merged_verified');
  assert.equal(previousStatus.status, 'delivered_merged_verified');
  assert.equal(status.binding.upstreamUserFacingBoundaryGateMarker, 'CONTOUR_12G_RELEASE_CLAIM_USER_FACING_BOUNDARY_GATE');
  assert.equal(status.binding.publicationSchema, 'revision-bridge.release-claim-publication.v1');
  assert.equal(
    status.binding.upstreamUserFacingBoundarySchema,
    'revision-bridge.release-claim-user-facing-boundary.v1',
  );
  assert.match(bridgeSource, /CONTOUR_12H_RELEASE_CLAIM_PUBLICATION_GATE_START/u);
  assert.match(bridgeSource, /evaluateRevisionBridgeReleaseClaimPublicationGate/u);
  assert.match(bridgeSource, /evaluateRevisionBridgeReleaseClaimUserFacingBoundaryGate/u);
  assert.match(bridgeSource, /cloneJsonSafe\(input\)/u);
  assert.match(bridgeSource, /REVISION_BRIDGE_RELEASE_CLAIM_PUBLICATION_BOUNDARY_INPUT_MISSING/u);
  assert.match(bridgeSource, /REVISION_BRIDGE_RELEASE_CLAIM_PUBLICATION_BOUNDARY_RESULT_MISMATCH/u);
  assert.match(kernelTest, /blocks synthetic accepted boundaryResult without boundaryInput provenance/u);
  assert.match(kernelTest, /blocks when requestedClaimSurface does not match accepted boundary summary/u);
  assert.match(kernelTest, /blocks stale USER_FACING boundaryResult/u);
  assert.match(kernelTest, /blocks when boundaryInput is missing/u);
});

test('Review Bridge release claim publication gate binding keeps docs honest', () => {
  const status = readJson(STATUS_PATH);
  const context = readText(['docs', 'CONTEXT.md']);
  const handoff = readText(['docs', 'HANDOFF.md']);
  const worklog = readText(['docs', 'WORKLOG.md']);
  const docsText = [context, handoff, worklog].join('\n');
  const statusText = JSON.stringify(status, null, 2);

  for (const text of [context, handoff, worklog]) {
    assert.match(text, /REVIEW_BRIDGE_RELEASE_CLAIM_PUBLICATION_GATE_BINDING_001/u);
    assert.match(text, /publication gate binding/iu);
    assert.match(text, /raw 12G boundary input/iu);
    assert.match(text, /re-evaluates 12G/iu);
    assert.match(text, /not product publication/iu);
    assert.match(text, /not release readiness/iu);
    assert.match(text, /not a user-facing release/iu);
    assert.match(text, /not a user-facing UI state/iu);
  }

  assertNoPublicationOverclaims(statusText, 'status');
  assertNoPublicationOverclaims(docsText, 'docs');
  assert.match(
    docsText,
    /no product publication, release readiness, user-facing release, release execution completion, release publication completion/iu,
  );
});

test('Review Bridge release claim publication gate binding changed files stay inside allowlist', () => {
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

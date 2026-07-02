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
  'REVIEW_BRIDGE_RELEASE_CLAIM_PACKET_EMIT_BINDING_001_STATUS.json',
);
const CONTRACT_PATH = 'test/contracts/review-bridge-release-claim-packet-emit-binding.contract.test.js';
const PACKET_KERNEL_TEST_PATH = 'test/contracts/revision-bridge-release-claim-packet-emit.contract.test.js';
const ATTESTATION_KERNEL_TEST_PATH = 'test/contracts/revision-bridge-release-claim-attestation-gate.contract.test.js';
const STATUS_PATH_REL = 'docs/OPS/STATUS/REVIEW_BRIDGE_RELEASE_CLAIM_PACKET_EMIT_BINDING_001_STATUS.json';
const GOVERNANCE_APPROVALS_PATH = 'docs/OPS/GOVERNANCE_APPROVALS/GOVERNANCE_CHANGE_APPROVALS.json';
const DOSSIER_BINDING_TEST_PATH = 'test/contracts/review-bridge-release-claim-dossier-binding.contract.test.js';
const ADMISSION_BINDING_TEST_PATH = 'test/contracts/review-bridge-release-claim-admission-binding.contract.test.js';
const MODE_DECISION_BINDING_TEST_PATH = 'test/contracts/review-bridge-release-claim-mode-decision-binding.contract.test.js';
const ATTESTATION_BINDING_TEST_PATH = 'test/contracts/review-bridge-release-claim-attestation-binding.contract.test.js';
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
const EXECUTION_GATE_BINDING_STATUS_PATH =
  'docs/OPS/STATUS/REVIEW_BRIDGE_RELEASE_CLAIM_EXECUTION_GATE_BINDING_001_STATUS.json';
const EXECUTION_GATE_BINDING_TEST_PATH =
  'test/contracts/review-bridge-release-claim-execution-gate-binding.contract.test.js';
const COMMAND_SURFACE_WIRING_TEST_PATH =
  'test/contracts/revision-bridge-release-claim-command-surface-admission-wiring.contract.test.js';
const ALLOWLIST = [
  MODULE_PATH,
  CONTRACT_PATH,
  DOSSIER_BINDING_TEST_PATH,
  ADMISSION_BINDING_TEST_PATH,
  MODE_DECISION_BINDING_TEST_PATH,
  ATTESTATION_BINDING_TEST_PATH,
  ATTESTATION_KERNEL_TEST_PATH,
  PACKET_KERNEL_TEST_PATH,
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

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function hasOwn(value, key) {
  return Boolean(value) && Object.prototype.hasOwnProperty.call(value, key);
}

function changedFilesFromGitStatus(statusText) {
  return statusText
    .split('\n')
    .filter(Boolean)
    .map((line) => line.slice(3).replace(/^"|"$/gu, ''));
}

function assertNoPacketEmitOverclaims(text, label) {
  const forbidden = [
    /\bpacket emitted means release readiness\b/iu,
    /\bpacket emit proves release readiness\b/iu,
    /\bpacket emit completes user-facing release\b/iu,
    /\bUSER_FACING_CLAIM_READY means release readiness\b/iu,
    /\bUSER_FACING_CLAIM_READY means user-facing release\b/iu,
    /\brelease readiness is (?:available|supported|ready|complete|proven)\b/iu,
    /\buser-facing release is (?:available|supported|ready|complete|proven)\b/iu,
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

function validClaim(bridge, goldenSet, overrides = {}) {
  return {
    schemaVersion: 'revision-bridge.format-matrix-support-claim.v1',
    claimId: 'claim-1',
    matrixRowId: 'word-text-exact',
    claimScope: ['textExact', 'commentAnchor'],
    verifiedTests: ['rb12-word-text', 'rb12-word-comment', 'rb12-golden-hash'],
    goldenSetHash: bridge.createRevisionBridgeGoldenSetHash(goldenSet),
    ...overrides,
  };
}

function validDossierItem(bridge, overrides = {}) {
  const goldenSet = overrides.goldenSet || validGoldenSet();
  const claim = overrides.claim || validClaim(bridge, goldenSet);
  return {
    schemaVersion: 'revision-bridge.release-claim-dossier-item.v1',
    itemId: 'dossier-item-1',
    goldenSet,
    claim,
    ...overrides,
  };
}

function validDossier(bridge, overrides = {}) {
  return {
    schemaVersion: 'revision-bridge.release-claim-dossier.v1',
    dossierId: 'release-claim-dossier-1',
    items: [validDossierItem(bridge)],
    ...overrides,
  };
}

function validAdmission(overrides = {}) {
  return {
    schemaVersion: 'revision-bridge.release-claim-admission.v1',
    claimId: 'release-claim-1',
    claimScope: ['textExact'],
    requiredClaimClasses: ['textual'],
    ...overrides,
  };
}

function validDecisionInput(bridge, overrides = {}) {
  return {
    schemaVersion: bridge.REVISION_BRIDGE_RELEASE_CLAIM_MODE_DECISION_SCHEMA,
    mode: 'PR_MODE',
    formatMatrix: validFormatMatrix(),
    dossier: validDossier(bridge),
    admission: validAdmission(),
    claimClasses: ['textual', 'commentary'],
    baselineDebtFlag: false,
    releaseEvidenceId: 'release-evidence-1',
    releaseEvidenceHash: 'sha256:release-evidence-1',
    inputHash: 'sha256:input-1',
    outputHash: 'sha256:output-1',
    commandRunDigest: 'sha256:run-1',
    matrixId: 'format-matrix-1',
    dossierId: 'release-claim-dossier-1',
    claimId: 'release-claim-1',
    ...overrides,
  };
}

function acceptedModeDecisionResult(bridge, overrides = {}) {
  const result = bridge.evaluateRevisionBridgeReleaseClaimModeDecisionGate(validDecisionInput(bridge, overrides));
  assert.equal(result.ok, true);
  assert.equal(result.status, 'accepted');
  return result;
}

function defaultReleaseCommands() {
  return [
    {
      commandId: 'node',
      argv: ['--test', 'test/contracts/revision-bridge-release-claim-attestation-gate.contract.test.js'],
    },
    {
      commandId: 'node',
      argv: ['--test', 'test/contracts/revision-bridge-release-claim-packet-emit.contract.test.js'],
    },
  ];
}

function defaultArtifactHashes() {
  return [
    {
      artifactId: 'release-report',
      digest: 'sha256:release-report-1',
    },
    {
      artifactId: 'release-packet',
      digest: 'sha256:release-packet-1',
    },
  ];
}

function validAttestationInput(bridge, overrides = {}) {
  const mode = overrides.mode || 'PR_MODE';
  const modeDecisionResult = overrides.modeDecisionResult || acceptedModeDecisionResult(bridge, { mode });
  const executedCommands = hasOwn(overrides, 'executedCommands')
    ? overrides.executedCommands
    : (mode === 'RELEASE_MODE' ? defaultReleaseCommands() : undefined);
  const artifactHashes = hasOwn(overrides, 'artifactHashes')
    ? overrides.artifactHashes
    : (mode === 'RELEASE_MODE' ? defaultArtifactHashes() : undefined);
  const commandRunDigest = hasOwn(overrides, 'commandRunDigest')
    ? overrides.commandRunDigest
    : bridge.createRevisionBridgeReleaseClaimCommandRunDigest(executedCommands || []);
  const decisionHash = hasOwn(overrides, 'decisionHash')
    ? overrides.decisionHash
    : bridge.createRevisionBridgeReleaseClaimModeDecisionHash(modeDecisionResult);
  const evidenceHash = hasOwn(overrides, 'evidenceHash')
    ? overrides.evidenceHash
    : bridge.createRevisionBridgeReleaseClaimEvidenceHash(artifactHashes || []);

  return {
    schemaVersion: bridge.REVISION_BRIDGE_RELEASE_CLAIM_ATTESTATION_SCHEMA,
    mode,
    modeDecisionResult,
    attestationId: 'attestation-1',
    attestationSchema: bridge.REVISION_BRIDGE_RELEASE_CLAIM_ATTESTATION_SCHEMA,
    inputHash: 'sha256:input-1',
    outputHash: 'sha256:output-1',
    commandRunDigest,
    decisionHash,
    evidenceHash,
    ...(executedCommands === undefined ? {} : { executedCommands }),
    ...(artifactHashes === undefined ? {} : { artifactHashes }),
    releaseEvidenceId: mode === 'RELEASE_MODE' ? 'release-evidence-1' : '',
    releaseEvidenceHash: mode === 'RELEASE_MODE' ? 'sha256:release-evidence-1' : '',
    ...overrides,
  };
}

function acceptedAttestationResult(bridge, overrides = {}) {
  const result = bridge.evaluateRevisionBridgeReleaseClaimAttestationGate(validAttestationInput(bridge, overrides));
  assert.equal(result.ok, true);
  assert.equal(result.status, 'accepted');
  return result;
}

function validPacketMeta(overrides = {}) {
  return {
    packetId: 'release-claim-packet-1',
    createdAtUtc: '2026-07-02T00:00:00.000Z',
    emitterId: 'codex-contour-12f',
    ...overrides,
  };
}

function validPacketEmitInput(bridge, overrides = {}) {
  const mode = overrides.mode || 'PR_MODE';
  const modeDecisionResult = hasOwn(overrides, 'modeDecisionResult')
    ? overrides.modeDecisionResult
    : acceptedModeDecisionResult(bridge, { mode });
  const attestationResult = hasOwn(overrides, 'attestationResult')
    ? overrides.attestationResult
    : acceptedAttestationResult(bridge, { mode, modeDecisionResult });

  return {
    packetMeta: validPacketMeta(),
    modeDecisionResult,
    attestationResult,
    ...overrides,
  };
}

test('Review Bridge release claim packet emit binding status keeps scope narrow', () => {
  const status = readJson(STATUS_PATH);

  assert.equal(status.taskId, 'REVIEW_BRIDGE_RELEASE_CLAIM_PACKET_EMIT_BINDING_001');
  assert.equal(status.type, 'review_bridge_release_claim_packet_emit_binding');
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
  assert.equal(status.scope.releaseClaimPacketEmitRuntimeChanged, true);
  assert.equal(status.scope.releaseClaimPacketEmitBound, true);
  assert.equal(status.scope.releaseClaimPacketStrictReportBound, true);
  assert.equal(status.scope.releaseClaimPacketHashBound, true);
  assert.equal(status.scope.releaseClaimPacketInternalUserFacingClassOnly, true);
  assert.equal(status.scope.releaseExecutionAccepted, false);
  assert.equal(status.scope.releasePublicationAccepted, false);
  assert.equal(status.scope.userFacingReleaseClaimed, false);
  assert.equal(status.scope.docxImportSafeCreateChanged, false);
  assert.equal(status.scope.docxExportChanged, false);
  assert.equal(status.scope.autoApply, false);
  assert.equal(status.scope.releaseReadinessClaimed, false);
  assert.equal(status.scope.y9Opened, false);
  assert.equal(status.implementation.changedProductionRuntime, true);
  assert.equal(status.implementation.changedUi, false);
});

test('Review Bridge release claim packet emit binding proves bounded packet truth', async () => {
  const bridge = await loadBridge();
  const status = readJson(STATUS_PATH);
  const prResult = bridge.evaluateRevisionBridgeReleaseClaimPacketEmit(validPacketEmitInput(bridge, {
    mode: 'PR_MODE',
  }));
  const releaseModeDecisionResult = acceptedModeDecisionResult(bridge, { mode: 'RELEASE_MODE' });
  const releaseAttestationResult = acceptedAttestationResult(bridge, {
    mode: 'RELEASE_MODE',
    modeDecisionResult: releaseModeDecisionResult,
  });
  const releaseResult = bridge.evaluateRevisionBridgeReleaseClaimPacketEmit(validPacketEmitInput(bridge, {
    modeDecisionResult: releaseModeDecisionResult,
    attestationResult: releaseAttestationResult,
    packetMeta: validPacketMeta(),
  }));
  const positiveText = status.positiveClaims.join('\n');
  const nonClaimText = status.nonClaims.join('\n');
  const layerText = status.layerDecisions.join('\n');

  assert.equal(prResult.ok, true);
  assert.equal(prResult.type, 'revisionBridge.releaseClaimPacketEmit');
  assert.equal(prResult.code, 'REVISION_BRIDGE_RELEASE_CLAIM_PACKET_EMIT_ACCEPTED');
  assert.equal(prResult.packet.schemaVersion, bridge.REVISION_BRIDGE_RELEASE_CLAIM_PACKET_SCHEMA);
  assert.equal(prResult.report.schemaVersion, bridge.REVISION_BRIDGE_RELEASE_CLAIM_STRICT_REPORT_SCHEMA);
  assert.equal(prResult.packet.releaseClaim.mode, 'PR_MODE');
  assert.equal(prResult.packet.releaseClaim.modeClass, 'INTERNAL_PROOF_ONLY');
  assert.equal(prResult.report.modeClass, 'INTERNAL_PROOF_ONLY');

  assert.equal(releaseResult.ok, true);
  assert.equal(releaseResult.packet.releaseClaim.mode, 'RELEASE_MODE');
  assert.equal(releaseResult.packet.releaseClaim.modeClass, 'USER_FACING_CLAIM_READY');
  assert.equal(releaseResult.report.modeClass, 'USER_FACING_CLAIM_READY');
  assert.equal(releaseResult.packet.attestation.releaseEvidenceId, 'release-evidence-1');
  assert.equal(releaseResult.packet.attestation.releaseEvidenceHash, 'sha256:release-evidence-1');
  assert.deepEqual(
    Object.keys(releaseResult.report).sort(),
    [...bridge.REVISION_BRIDGE_RELEASE_CLAIM_STRICT_REPORT_KEYS].sort(),
  );
  assert.equal(bridge.validateRevisionBridgeReleaseClaimStrictReportShape(releaseResult.report).ok, true);

  const invalidPacketMeta = bridge.evaluateRevisionBridgeReleaseClaimPacketEmit(validPacketEmitInput(bridge, {
    packetMeta: validPacketMeta({ emitterId: '', notes: 'not canonical' }),
  }));
  assert.equal(invalidPacketMeta.ok, false);
  assert.equal(invalidPacketMeta.status, 'diagnostics');
  assert.equal(invalidPacketMeta.reason, 'REVISION_BRIDGE_RELEASE_CLAIM_PACKET_META_INVALID');

  const secondRelease = bridge.evaluateRevisionBridgeReleaseClaimPacketEmit(validPacketEmitInput(bridge, {
    modeDecisionResult: releaseModeDecisionResult,
    attestationResult: releaseAttestationResult,
    packetMeta: validPacketMeta({
      createdAtUtc: '2030-01-01T00:00:00.000Z',
    }),
  }));
  assert.equal(secondRelease.ok, true);
  assert.equal(releaseResult.packet.packetHash, secondRelease.packet.packetHash);
  assert.notEqual(releaseResult.packet.packetMeta.createdAtUtc, secondRelease.packet.packetMeta.createdAtUtc);

  const topModeDecisionResult = acceptedModeDecisionResult(bridge, {
    mode: 'PR_MODE',
    inputHash: 'sha256:top-pr-input',
  });
  const otherModeDecisionResult = acceptedModeDecisionResult(bridge, {
    mode: 'PR_MODE',
    inputHash: 'sha256:embedded-pr-input',
  });
  const mixedAttestation = acceptedAttestationResult(bridge, {
    mode: 'PR_MODE',
    modeDecisionResult: otherModeDecisionResult,
  });
  const mixedPacket = bridge.evaluateRevisionBridgeReleaseClaimPacketEmit(validPacketEmitInput(bridge, {
    modeDecisionResult: topModeDecisionResult,
    attestationResult: mixedAttestation,
  }));

  assert.equal(mixedPacket.ok, false);
  assert.equal(mixedPacket.reason, 'REVISION_BRIDGE_RELEASE_CLAIM_PACKET_BINDING_DECISION_HASH_MISMATCH');

  const inheritedPacketMeta = bridge.evaluateRevisionBridgeReleaseClaimPacketEmit(validPacketEmitInput(bridge, {
    packetMeta: Object.create(validPacketMeta()),
  }));
  const inheritedRelease = bridge.evaluateRevisionBridgeReleaseClaimPacketEmit(validPacketEmitInput(bridge, {
    modeDecisionResult: Object.create(releaseModeDecisionResult),
    attestationResult: Object.create(releaseAttestationResult),
  }));

  assert.equal(inheritedPacketMeta.ok, false);
  assert.equal(inheritedPacketMeta.reason, 'REVISION_BRIDGE_RELEASE_CLAIM_PACKET_META_INVALID');
  assert.equal(inheritedRelease.ok, false);
  assert.equal(inheritedRelease.packet, null);
  assert.equal(inheritedRelease.report, null);

  assert.match(positiveText, /release claim packet emit gate/u);
  assert.match(positiveText, /bounded internal Review Bridge 12F packet boundary/u);
  assert.match(positiveText, /requires canonical packetMeta/u);
  assert.match(positiveText, /re-evaluates raw 12D decision input/u);
  assert.match(positiveText, /re-evaluates raw 12E attestation input/u);
  assert.match(positiveText, /decisionHash bindings to match/u);
  assert.match(positiveText, /deterministic release claim packet and strict report/u);
  assert.match(positiveText, /strips inherited prototype fields/u);
  assert.match(positiveText, /USER_FACING_CLAIM_READY only as an internal packet\/report class/u);

  for (const phrase of [
    'No release readiness is claimed.',
    'No user-facing release is claimed.',
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
    'No project truth write is performed by release claim packet emit binding.',
    'No receipt or recovery evidence is created by release claim packet emit binding.',
    'No import/export MVP closeout is widened.',
  ]) {
    assert.match(nonClaimText, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'));
  }

  assert.match(layerText, /internal release-claim packet truth only/u);
  assert.match(layerText, /does not become project truth/u);
  assert.match(layerText, /does not write manuscript truth or project truth/u);
  assert.match(layerText, /does not admit release execution or release publication/u);
  assert.match(layerText, /not a user-facing UI or publication state/u);
  assert.match(layerText, /not content import/u);
  assert.match(layerText, /not export/u);
  assert.match(layerText, /not an apply plan/u);
});

test('Review Bridge release claim packet emit binding is bound to existing kernel', () => {
  const status = readJson(STATUS_PATH);
  const bridgeSource = readText(['src', 'io', 'revisionBridge', 'index.mjs']);
  const packetKernelTest = readText(['test', 'contracts', 'revision-bridge-release-claim-packet-emit.contract.test.js']);

  assert.equal(status.binding.existingKernelMarker, 'CONTOUR_12F_RELEASE_CLAIM_PACKET_EMIT');
  assert.equal(status.binding.releaseClaimPacketSchema, 'revision-bridge.release-claim-packet.v1');
  assert.equal(status.binding.releaseClaimStrictReportSchema, 'revision-bridge.release-claim-report.v1');
  assert.equal(status.binding.upstreamModeDecisionGateMarker, 'CONTOUR_12D_RELEASE_CLAIM_MODE_DECISION_GATE');
  assert.equal(status.binding.upstreamAttestationGateMarker, 'CONTOUR_12E_RELEASE_CLAIM_ATTESTATION_GATE');
  assert.match(bridgeSource, /CONTOUR_12F_RELEASE_CLAIM_PACKET_EMIT_START/u);
  assert.match(bridgeSource, /REVISION_BRIDGE_RELEASE_CLAIM_PACKET_SCHEMA/u);
  assert.match(bridgeSource, /REVISION_BRIDGE_RELEASE_CLAIM_STRICT_REPORT_SCHEMA/u);
  assert.match(bridgeSource, /evaluateRevisionBridgeReleaseClaimPacketEmit/u);
  assert.match(bridgeSource, /validateRevisionBridgeReleaseClaimStrictReportShape/u);
  assert.match(bridgeSource, /createRevisionBridgeReleaseClaimPacketHash/u);
  assert.match(bridgeSource, /must re-evaluate to accepted 12D from raw decision input/u);
  assert.match(bridgeSource, /must re-evaluate to accepted 12E from raw attestation input/u);
  assert.match(bridgeSource, /REVISION_BRIDGE_RELEASE_CLAIM_PACKET_BINDING_DECISION_HASH_MISMATCH/u);

  assert.match(packetKernelTest, /returns diagnostics when packetMeta fields are invalid/u);
  assert.match(packetKernelTest, /strict report validator rejects extra fields/u);
  assert.match(packetKernelTest, /rejects packetMeta fields inherited from prototype/u);
  assert.match(packetKernelTest, /rejects accepted 12D and 12E envelopes inherited from prototype/u);
  assert.match(packetKernelTest, /rejects RELEASE_MODE USER_FACING_CLAIM_READY through inherited envelopes/u);
  assert.match(packetKernelTest, /packet emit is deterministic/u);
  assert.match(packetKernelTest, /packet hash is stable and excludes createdAtUtc/u);
  assert.match(packetKernelTest, /blocks RELEASE_MODE when 12E attests a different accepted 12D/u);
});

test('Review Bridge release claim packet emit binding keeps docs honest', () => {
  const status = readJson(STATUS_PATH);
  const context = readText(['docs', 'CONTEXT.md']);
  const handoff = readText(['docs', 'HANDOFF.md']);
  const worklog = readText(['docs', 'WORKLOG.md']);
  const docsText = [context, handoff, worklog].join('\n');
  const statusText = JSON.stringify(status, null, 2);

  for (const text of [context, handoff, worklog]) {
    assert.match(text, /REVIEW_BRIDGE_RELEASE_CLAIM_PACKET_EMIT_BINDING_001/u);
    assert.match(text, /release claim packet emit binding/iu);
    assert.match(text, /USER_FACING_CLAIM_READY/iu);
    assert.match(text, /not release readiness/iu);
  }

  assertNoPacketEmitOverclaims(statusText, 'status');
  assertNoPacketEmitOverclaims(docsText, 'docs');
  assert.match(
    docsText,
    /no release readiness, user-facing release, release execution completion, release publication completion/iu,
  );
});

test('Review Bridge release claim packet emit binding changed files stay inside allowlist', () => {
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

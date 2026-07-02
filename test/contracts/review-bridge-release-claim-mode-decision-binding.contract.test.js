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
  'REVIEW_BRIDGE_RELEASE_CLAIM_MODE_DECISION_BINDING_001_STATUS.json',
);
const CONTRACT_PATH = 'test/contracts/review-bridge-release-claim-mode-decision-binding.contract.test.js';
const DOSSIER_BINDING_TEST_PATH = 'test/contracts/review-bridge-release-claim-dossier-binding.contract.test.js';
const ADMISSION_BINDING_TEST_PATH = 'test/contracts/review-bridge-release-claim-admission-binding.contract.test.js';
const DECISION_KERNEL_TEST_PATH = 'test/contracts/revision-bridge-release-claim-decision-gate.contract.test.js';
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
const STATUS_PATH_REL = 'docs/OPS/STATUS/REVIEW_BRIDGE_RELEASE_CLAIM_MODE_DECISION_BINDING_001_STATUS.json';
const GOVERNANCE_APPROVALS_PATH = 'docs/OPS/GOVERNANCE_APPROVALS/GOVERNANCE_CHANGE_APPROVALS.json';
const CONTEXT_PATH = 'docs/CONTEXT.md';
const HANDOFF_PATH = 'docs/HANDOFF.md';
const WORKLOG_PATH = 'docs/WORKLOG.md';
const ALLOWLIST = [
  MODULE_PATH,
  CONTRACT_PATH,
  DOSSIER_BINDING_TEST_PATH,
  ADMISSION_BINDING_TEST_PATH,
  DECISION_KERNEL_TEST_PATH,
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

function assertNoModeDecisionOverclaims(text, label) {
  const forbidden = [
    /\brelease claim mode decision is (?:release-ready|published|user-facing|executed)\b/iu,
    /\bmode decision accepted means release readiness\b/iu,
    /\bmode decision accepted proves release readiness\b/iu,
    /\brelease readiness is (?:available|supported|ready|complete|proven)\b/iu,
    /\buser-facing release is (?:available|supported|ready|complete|proven)\b/iu,
    /\brelease attestation is (?:available|supported|ready|complete|proven)\b/iu,
    /\bpacket emit is (?:available|supported|ready|complete|proven)\b/iu,
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
    schemaVersion: 'revision-bridge.release-claim-mode-decision.v1',
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
      argv: ['--test', 'test/contracts/review-bridge-release-claim-mode-decision-binding.contract.test.js'],
    },
  ];
}

function defaultArtifactHashes() {
  return [
    {
      artifactId: 'release-packet',
      digest: 'sha256:release-packet-1',
    },
  ];
}

function validAttestationInput(bridge, overrides = {}) {
  const mode = overrides.mode || 'PR_MODE';
  const decisionMode = mode === 'RELEASE_MODE' ? 'RELEASE_MODE' : 'PR_MODE';
  const modeDecisionResult = overrides.modeDecisionResult || acceptedModeDecisionResult(bridge, {
    mode: decisionMode,
  });
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

function validPacketEmitInput(bridge, overrides = {}) {
  return {
    modeDecisionResult: overrides.modeDecisionResult || acceptedModeDecisionResult(bridge),
    attestationResult: overrides.attestationResult || acceptedAttestationResult(bridge),
    packetMeta: {
      packetId: 'packet-1',
      createdAtUtc: '2026-07-02T00:00:00.000Z',
      emitterId: 'release-claim-packet-emitter',
    },
    ...overrides,
  };
}

test('Review Bridge release claim mode decision binding status keeps scope narrow', () => {
  const status = readJson(STATUS_PATH);

  assert.equal(status.taskId, 'REVIEW_BRIDGE_RELEASE_CLAIM_MODE_DECISION_BINDING_001');
  assert.equal(status.type, 'review_bridge_release_claim_mode_decision_binding');
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
  assert.equal(status.scope.releaseClaimModeDecisionRuntimeChanged, true);
  assert.equal(status.scope.releaseClaimAttestationRuntimeHardened, true);
  assert.equal(status.scope.releaseClaimPacketEmitRuntimeHardened, true);
  assert.equal(status.scope.releaseClaimModeDecisionBound, true);
  assert.equal(status.scope.releaseAttestationAccepted, false);
  assert.equal(status.scope.packetEmitAccepted, false);
  assert.equal(status.scope.releaseExecutionAccepted, false);
  assert.equal(status.scope.releasePublicationAccepted, false);
  assert.equal(status.scope.userFacingReleaseClaimed, false);
  assert.equal(status.scope.docxImportSafeCreateChanged, false);
  assert.equal(status.scope.docxExportChanged, false);
  assert.equal(status.scope.autoApply, false);
  assert.equal(status.scope.releaseReadinessClaimed, false);
  assert.equal(status.scope.y9Opened, false);
});

test('Review Bridge release claim mode decision binding proves bounded mode decision truth', async () => {
  const bridge = await loadBridge();
  const status = readJson(STATUS_PATH);
  const prResult = acceptedModeDecisionResult(bridge, { mode: 'PR_MODE' });
  const releaseResult = acceptedModeDecisionResult(bridge, { mode: 'RELEASE_MODE' });
  const positiveText = status.positiveClaims.join('\n');
  const nonClaimText = status.nonClaims.join('\n');
  const layerText = status.layerDecisions.join('\n');

  assert.equal(prResult.type, 'revisionBridge.releaseClaimModeDecisionGate');
  assert.equal(prResult.code, 'REVISION_BRIDGE_RELEASE_CLAIM_MODE_DECISION_ACCEPTED');
  assert.equal(prResult.binding.mode, 'PR_MODE');
  assert.equal(prResult.binding.claimId, 'release-claim-1');
  assert.equal(prResult.binding.dossierId, 'release-claim-dossier-1');
  assert.equal(prResult.binding.matrixId, 'format-matrix-1');
  assert.equal(prResult.binding.dossierStatus, 'accepted');
  assert.equal(prResult.binding.admissionStatus, 'accepted');

  assert.equal(releaseResult.ok, true);
  assert.equal(releaseResult.binding.mode, 'RELEASE_MODE');
  assert.equal(releaseResult.decision.releaseEvidenceId, 'release-evidence-1');
  assert.equal(releaseResult.decision.outputHash, 'sha256:output-1');

  assert.match(positiveText, /release claim mode decision gate/u);
  assert.match(positiveText, /bounded Review Bridge mode decision boundary/u);
  assert.match(positiveText, /accepted 12B release claim dossier provenance/u);
  assert.match(positiveText, /accepted 12C release claim admission provenance/u);
  assert.match(positiveText, /derives claimId, dossierId, and matrixId from accepted upstream provenance/u);
  assert.match(positiveText, /PR_MODE remains internal proof only/u);
  assert.match(positiveText, /RELEASE_MODE is accepted only/u);
  assert.match(positiveText, /12E attestation and 12F packet emit gates re-evaluate/u);

  for (const phrase of [
    'No release readiness is claimed.',
    'No user-facing release is claimed.',
    'No release attestation completion is claimed.',
    'No packet emit completion is claimed.',
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
    'No project truth write is performed by release claim mode decision binding.',
    'No receipt or recovery evidence is created by release claim mode decision binding.',
    'No import/export MVP closeout is widened.',
  ]) {
    assert.match(nonClaimText, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'));
  }

  assert.match(layerText, /mode decision truth only/u);
  assert.match(layerText, /does not become project truth/u);
  assert.match(layerText, /does not create a release packet/u);
  assert.match(layerText, /does not admit execution or publication/u);
  assert.match(layerText, /not an attestation completion contour/u);
  assert.match(layerText, /not a packet emit completion contour/u);
  assert.match(layerText, /not content import/u);
  assert.match(layerText, /not export/u);
  assert.match(layerText, /not an apply plan/u);
});

test('Review Bridge release claim mode decision binding blocks poisoned provenance ids', async () => {
  const bridge = await loadBridge();
  const result = bridge.evaluateRevisionBridgeReleaseClaimModeDecisionGate(validDecisionInput(bridge, {
    mode: 'RELEASE_MODE',
    matrixId: 'evil-format-matrix',
    dossierId: 'evil-dossier',
    claimId: 'evil-claim',
  }));

  assert.equal(result.ok, false);
  assert.equal(result.status, 'blocked');
  assert.equal(result.reason, 'REVISION_BRIDGE_RELEASE_CLAIM_MODE_DECISION_BINDING_MISMATCH');
  assert.equal(
    result.reasons.some((reason) => (
      reason.field === 'decision.claimId'
      && reason.expectedValue === 'release-claim-1'
      && reason.receivedValue === 'evil-claim'
    )),
    true,
  );
  assert.equal(
    result.reasons.some((reason) => (
      reason.field === 'decision.dossierId'
      && reason.expectedValue === 'release-claim-dossier-1'
      && reason.receivedValue === 'evil-dossier'
    )),
    true,
  );
  assert.equal(
    result.reasons.some((reason) => (
      reason.field === 'decision.matrixId'
      && reason.expectedValue === 'format-matrix-1'
      && reason.receivedValue === 'evil-format-matrix'
    )),
    true,
  );
});

test('Review Bridge release claim mode decision binding blocks forged downstream envelopes', async () => {
  const bridge = await loadBridge();
  const acceptedModeDecision = acceptedModeDecisionResult(bridge);
  const forgedModeDecision = deepClone(acceptedModeDecision);
  forgedModeDecision.decision.claimId = 'evil-claim';
  forgedModeDecision.binding.claimId = 'evil-claim';

  const attestationBlocked = bridge.evaluateRevisionBridgeReleaseClaimAttestationGate(validAttestationInput(bridge, {
    modeDecisionResult: forgedModeDecision,
  }));
  assert.equal(attestationBlocked.ok, false);
  assert.equal(attestationBlocked.status, 'blocked');
  assert.equal(
    attestationBlocked.reasons.some(
      (reason) => reason.code === 'REVISION_BRIDGE_RELEASE_CLAIM_ATTESTATION_MODE_DECISION_PROVENANCE_INVALID',
    ),
    true,
  );

  const acceptedAttestation = acceptedAttestationResult(bridge);
  const forgedAttestation = deepClone(acceptedAttestation);
  forgedAttestation.modeDecisionResult = forgedModeDecision;
  forgedAttestation.attestation.modeDecisionResult = forgedModeDecision;
  forgedAttestation.attestation.decisionHash = bridge.createRevisionBridgeReleaseClaimModeDecisionHash(
    forgedModeDecision,
  );
  forgedAttestation.binding.claimId = 'evil-claim';

  const packetBlocked = bridge.evaluateRevisionBridgeReleaseClaimPacketEmit(validPacketEmitInput(bridge, {
    modeDecisionResult: forgedModeDecision,
    attestationResult: forgedAttestation,
  }));
  assert.equal(packetBlocked.ok, false);
  assert.equal(packetBlocked.status, 'blocked');
  assert.equal(
    packetBlocked.reasons.some((reason) => [
      'REVISION_BRIDGE_RELEASE_CLAIM_PACKET_MODE_DECISION_RESULT_NOT_ACCEPTED',
      'REVISION_BRIDGE_RELEASE_CLAIM_PACKET_ATTESTATION_RESULT_NOT_ACCEPTED',
    ].includes(reason.code)),
    true,
  );
});

test('Review Bridge release claim mode decision binding is bound to existing kernel and adjacent guards', () => {
  const status = readJson(STATUS_PATH);
  const bridgeSource = readText(['src', 'io', 'revisionBridge', 'index.mjs']);
  const admissionBindingTest = readText(['test', 'contracts', 'review-bridge-release-claim-admission-binding.contract.test.js']);
  const decisionKernelTest = readText(['test', 'contracts', 'revision-bridge-release-claim-decision-gate.contract.test.js']);
  const attestationKernelTest = readText(['test', 'contracts', 'revision-bridge-release-claim-attestation-gate.contract.test.js']);
  const packetKernelTest = readText(['test', 'contracts', 'revision-bridge-release-claim-packet-emit.contract.test.js']);

  assert.equal(status.binding.existingKernelMarker, 'CONTOUR_12D_RELEASE_CLAIM_MODE_DECISION_GATE');
  assert.equal(status.binding.releaseClaimDossierGateMarker, 'CONTOUR_12B_RELEASE_CLAIM_DOSSIER_GATE');
  assert.equal(status.binding.releaseClaimAdmissionGateMarker, 'CONTOUR_12C_RELEASE_CLAIM_ADMISSION_GATE');
  assert.equal(status.binding.downstreamAttestationGateMarker, 'CONTOUR_12E_RELEASE_CLAIM_ATTESTATION_GATE');
  assert.equal(status.binding.downstreamPacketEmitMarker, 'CONTOUR_12F_RELEASE_CLAIM_PACKET_EMIT');
  assert.match(bridgeSource, /CONTOUR_12D_RELEASE_CLAIM_MODE_DECISION_GATE_START/u);
  assert.match(bridgeSource, /REVISION_BRIDGE_RELEASE_CLAIM_MODE_DECISION_SCHEMA/u);
  assert.match(bridgeSource, /evaluateRevisionBridgeReleaseClaimModeDecisionGate/u);
  assert.match(bridgeSource, /REVISION_BRIDGE_RELEASE_CLAIM_MODE_DECISION_BINDING_MISMATCH/u);
  assert.match(bridgeSource, /collectReleaseClaimModeDecisionBindingMismatchReasons/u);
  assert.match(bridgeSource, /must re-evaluate to accepted 12D from raw decision input/u);
  assert.match(bridgeSource, /must re-evaluate to accepted 12E from raw attestation input/u);

  assert.match(admissionBindingTest, /REVIEW_BRIDGE_RELEASE_CLAIM_ADMISSION_BINDING_001/u);
  assert.match(decisionKernelTest, /blocks caller-supplied ids that do not match accepted provenance/u);
  assert.match(attestationKernelTest, /blocks forged accepted 12D results with poisoned ids/u);
  assert.match(packetKernelTest, /blocks forged accepted 12D plus forged accepted 12E pair/u);
});

test('Review Bridge release claim mode decision binding keeps docs honest', () => {
  const status = readJson(STATUS_PATH);
  const context = readText(['docs', 'CONTEXT.md']);
  const handoff = readText(['docs', 'HANDOFF.md']);
  const worklog = readText(['docs', 'WORKLOG.md']);
  const docsText = [context, handoff, worklog].join('\n');
  const statusText = JSON.stringify(status, null, 2);

  for (const text of [context, handoff, worklog]) {
    assert.match(text, /REVIEW_BRIDGE_RELEASE_CLAIM_MODE_DECISION_BINDING_001/u);
    assert.match(text, /release claim mode decision binding/iu);
    assert.match(text, /not release readiness/iu);
  }

  assertNoModeDecisionOverclaims(statusText, 'status');
  assertNoModeDecisionOverclaims(docsText, 'docs');
  assert.match(
    docsText,
    /no release readiness, user-facing release, attestation completion, packet emit completion, release execution completion, release publication completion/iu,
  );
});

test('Review Bridge release claim mode decision binding changed files stay inside allowlist', () => {
  const status = execFileSync('git', ['status', '--porcelain', '-uall'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  const changedFiles = changedFilesFromGitStatus(status);

  for (const filePath of changedFiles) {
    assert.equal(ALLOWLIST.includes(filePath), true, `changed file outside allowlist: ${filePath}`);
  }
});

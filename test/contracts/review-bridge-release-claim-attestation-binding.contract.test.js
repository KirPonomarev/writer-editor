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
  'REVIEW_BRIDGE_RELEASE_CLAIM_ATTESTATION_BINDING_001_STATUS.json',
);
const CONTRACT_PATH = 'test/contracts/review-bridge-release-claim-attestation-binding.contract.test.js';
const ATTESTATION_KERNEL_TEST_PATH = 'test/contracts/revision-bridge-release-claim-attestation-gate.contract.test.js';
const PACKET_KERNEL_TEST_PATH = 'test/contracts/revision-bridge-release-claim-packet-emit.contract.test.js';
const STATUS_PATH_REL = 'docs/OPS/STATUS/REVIEW_BRIDGE_RELEASE_CLAIM_ATTESTATION_BINDING_001_STATUS.json';
const GOVERNANCE_APPROVALS_PATH = 'docs/OPS/GOVERNANCE_APPROVALS/GOVERNANCE_CHANGE_APPROVALS.json';
const DOSSIER_BINDING_TEST_PATH = 'test/contracts/review-bridge-release-claim-dossier-binding.contract.test.js';
const ADMISSION_BINDING_TEST_PATH = 'test/contracts/review-bridge-release-claim-admission-binding.contract.test.js';
const MODE_DECISION_BINDING_TEST_PATH = 'test/contracts/review-bridge-release-claim-mode-decision-binding.contract.test.js';
const CONTEXT_PATH = 'docs/CONTEXT.md';
const HANDOFF_PATH = 'docs/HANDOFF.md';
const WORKLOG_PATH = 'docs/WORKLOG.md';
const ALLOWLIST = [
  MODULE_PATH,
  CONTRACT_PATH,
  DOSSIER_BINDING_TEST_PATH,
  ADMISSION_BINDING_TEST_PATH,
  MODE_DECISION_BINDING_TEST_PATH,
  ATTESTATION_KERNEL_TEST_PATH,
  PACKET_KERNEL_TEST_PATH,
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

function assertNoAttestationOverclaims(text, label) {
  const forbidden = [
    /\baccepted attestation means release readiness\b/iu,
    /\baccepted attestation proves release readiness\b/iu,
    /\battestation accepted emits a release packet\b/iu,
    /\brelease readiness is (?:available|supported|ready|complete|proven)\b/iu,
    /\buser-facing release is (?:available|supported|ready|complete|proven)\b/iu,
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

test('Review Bridge release claim attestation binding status keeps scope narrow', () => {
  const status = readJson(STATUS_PATH);

  assert.equal(status.taskId, 'REVIEW_BRIDGE_RELEASE_CLAIM_ATTESTATION_BINDING_001');
  assert.equal(status.type, 'review_bridge_release_claim_attestation_binding');
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
  assert.equal(status.scope.releaseClaimModeDecisionRuntimeChanged, false);
  assert.equal(status.scope.releaseClaimAttestationRuntimeHardened, true);
  assert.equal(status.scope.releaseClaimPacketEmitRuntimeHardened, true);
  assert.equal(status.scope.releaseClaimAttestationBound, true);
  assert.equal(status.scope.releaseClaimPacketExactDecisionHashBound, true);
  assert.equal(status.scope.releaseModeReleaseEvidenceBound, true);
  assert.equal(status.scope.packetEmitCompletionClaimed, false);
  assert.equal(status.scope.releaseExecutionAccepted, false);
  assert.equal(status.scope.releasePublicationAccepted, false);
  assert.equal(status.scope.userFacingReleaseClaimed, false);
  assert.equal(status.scope.docxImportSafeCreateChanged, false);
  assert.equal(status.scope.docxExportChanged, false);
  assert.equal(status.scope.autoApply, false);
  assert.equal(status.scope.releaseReadinessClaimed, false);
  assert.equal(status.scope.y9Opened, false);
});

test('Review Bridge release claim attestation binding proves bounded attestation truth', async () => {
  const bridge = await loadBridge();
  const status = readJson(STATUS_PATH);
  const prResult = acceptedAttestationResult(bridge, { mode: 'PR_MODE' });
  const releaseResult = acceptedAttestationResult(bridge, { mode: 'RELEASE_MODE' });
  const positiveText = status.positiveClaims.join('\n');
  const nonClaimText = status.nonClaims.join('\n');
  const layerText = status.layerDecisions.join('\n');

  assert.equal(prResult.type, 'revisionBridge.releaseClaimAttestationGate');
  assert.equal(prResult.code, 'REVISION_BRIDGE_RELEASE_CLAIM_ATTESTATION_ACCEPTED');
  assert.equal(prResult.binding.mode, 'PR_MODE');
  assert.equal(prResult.binding.claimId, 'release-claim-1');
  assert.equal(prResult.binding.dossierId, 'release-claim-dossier-1');
  assert.equal(prResult.binding.matrixId, 'format-matrix-1');

  assert.equal(releaseResult.ok, true);
  assert.equal(releaseResult.binding.mode, 'RELEASE_MODE');
  assert.equal(releaseResult.attestation.releaseEvidenceId, 'release-evidence-1');
  assert.equal(releaseResult.attestation.releaseEvidenceHash, 'sha256:release-evidence-1');

  const releaseEvidenceMismatch = bridge.evaluateRevisionBridgeReleaseClaimAttestationGate(validAttestationInput(
    bridge,
    {
      mode: 'RELEASE_MODE',
      releaseEvidenceId: 'release-evidence-2',
      releaseEvidenceHash: 'sha256:release-evidence-2',
    },
  ));
  assert.equal(releaseEvidenceMismatch.ok, false);
  assert.equal(
    releaseEvidenceMismatch.reason,
    'REVISION_BRIDGE_RELEASE_CLAIM_ATTESTATION_RELEASE_EVIDENCE_MISMATCH',
  );

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

  assert.match(positiveText, /release claim attestation gate/u);
  assert.match(positiveText, /bounded Review Bridge 12E attestation boundary/u);
  assert.match(positiveText, /accepted 12D release claim mode decision provenance/u);
  assert.match(positiveText, /decisionHash to match the normalized accepted 12D result/u);
  assert.match(positiveText, /RELEASE_MODE 12E now requires releaseEvidenceId/u);
  assert.match(positiveText, /12F packet emit guard now requires 12E decisionHash/u);

  for (const phrase of [
    'No release readiness is claimed.',
    'No user-facing release is claimed.',
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
    'No project truth write is performed by release claim attestation binding.',
    'No receipt or recovery evidence is created by release claim attestation binding.',
    'No import/export MVP closeout is widened.',
  ]) {
    assert.match(nonClaimText, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'));
  }

  assert.match(layerText, /attestation truth only/u);
  assert.match(layerText, /does not become project truth/u);
  assert.match(layerText, /does not create a release packet/u);
  assert.match(layerText, /does not admit execution or publication/u);
  assert.match(layerText, /not a packet emit completion contour/u);
  assert.match(layerText, /not a user-facing boundary contour/u);
  assert.match(layerText, /not content import/u);
  assert.match(layerText, /not export/u);
  assert.match(layerText, /not an apply plan/u);
});

test('Review Bridge release claim attestation binding is bound to existing kernel and adjacent guard', () => {
  const status = readJson(STATUS_PATH);
  const bridgeSource = readText(['src', 'io', 'revisionBridge', 'index.mjs']);
  const attestationKernelTest = readText(['test', 'contracts', 'revision-bridge-release-claim-attestation-gate.contract.test.js']);
  const packetKernelTest = readText(['test', 'contracts', 'revision-bridge-release-claim-packet-emit.contract.test.js']);

  assert.equal(status.binding.existingKernelMarker, 'CONTOUR_12E_RELEASE_CLAIM_ATTESTATION_GATE');
  assert.equal(status.binding.upstreamModeDecisionGateMarker, 'CONTOUR_12D_RELEASE_CLAIM_MODE_DECISION_GATE');
  assert.equal(status.binding.downstreamPacketEmitMarker, 'CONTOUR_12F_RELEASE_CLAIM_PACKET_EMIT');
  assert.match(bridgeSource, /CONTOUR_12E_RELEASE_CLAIM_ATTESTATION_GATE_START/u);
  assert.match(bridgeSource, /REVISION_BRIDGE_RELEASE_CLAIM_ATTESTATION_SCHEMA/u);
  assert.match(bridgeSource, /evaluateRevisionBridgeReleaseClaimAttestationGate/u);
  assert.match(bridgeSource, /REVISION_BRIDGE_RELEASE_CLAIM_ATTESTATION_RELEASE_EVIDENCE_MISMATCH/u);
  assert.match(bridgeSource, /REVISION_BRIDGE_RELEASE_CLAIM_PACKET_BINDING_DECISION_HASH_MISMATCH/u);
  assert.match(bridgeSource, /must re-evaluate to accepted 12D from raw decision input/u);
  assert.match(bridgeSource, /must re-evaluate to accepted 12E from raw attestation input/u);

  assert.match(attestationKernelTest, /blocks RELEASE_MODE when release evidence does not match accepted 12D/u);
  assert.match(packetKernelTest, /blocks PR_MODE when 12E attests a different accepted 12D/u);
  assert.match(packetKernelTest, /blocks RELEASE_MODE when 12E attests a different accepted 12D/u);
});

test('Review Bridge release claim attestation binding keeps docs honest', () => {
  const status = readJson(STATUS_PATH);
  const context = readText(['docs', 'CONTEXT.md']);
  const handoff = readText(['docs', 'HANDOFF.md']);
  const worklog = readText(['docs', 'WORKLOG.md']);
  const docsText = [context, handoff, worklog].join('\n');
  const statusText = JSON.stringify(status, null, 2);

  for (const text of [context, handoff, worklog]) {
    assert.match(text, /REVIEW_BRIDGE_RELEASE_CLAIM_ATTESTATION_BINDING_001/u);
    assert.match(text, /release claim attestation binding/iu);
    assert.match(text, /not release readiness/iu);
  }

  assertNoAttestationOverclaims(statusText, 'status');
  assertNoAttestationOverclaims(docsText, 'docs');
  assert.match(
    docsText,
    /no release readiness, user-facing release, packet emit completion, release execution completion, release publication completion/iu,
  );
});

test('Review Bridge release claim attestation binding changed files stay inside allowlist', () => {
  const status = execFileSync('git', ['status', '--porcelain', '-uall'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  const changedFiles = changedFilesFromGitStatus(status);

  for (const filePath of changedFiles) {
    assert.equal(ALLOWLIST.includes(filePath), true, `changed file outside allowlist: ${filePath}`);
  }
});

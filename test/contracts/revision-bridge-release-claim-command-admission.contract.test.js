const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MODULE_PATH = 'src/io/revisionBridge/index.mjs';
const TEST_PATH = 'test/contracts/revision-bridge-release-claim-command-admission.contract.test.js';
const ALLOWLIST = [MODULE_PATH, TEST_PATH];
const GUARDED_PATHS = [
  ...ALLOWLIST,
  'package.json',
  'package-lock.json',
  'npm-shrinkwrap.json',
];

async function loadBridge() {
  return import(pathToFileURL(path.join(REPO_ROOT, MODULE_PATH)).href);
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function hasOwn(value, key) {
  return Boolean(value) && Object.prototype.hasOwnProperty.call(value, key);
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
      argv: ['--test', 'test/contracts/revision-bridge-release-claim-decision-gate.contract.test.js'],
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
  return result;
}

function validPacketMeta(overrides = {}) {
  return {
    packetId: 'release-claim-packet-1',
    createdAtUtc: '2026-05-15T12:00:00Z',
    emitterId: 'codex-contour-12j',
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
  const packetMeta = hasOwn(overrides, 'packetMeta')
    ? overrides.packetMeta
    : validPacketMeta();

  return {
    packetMeta,
    ...(modeDecisionResult === undefined ? {} : { modeDecisionResult }),
    ...(attestationResult === undefined ? {} : { attestationResult }),
  };
}

function acceptedPacketEmitResult(bridge, overrides = {}) {
  const result = bridge.evaluateRevisionBridgeReleaseClaimPacketEmit(validPacketEmitInput(bridge, overrides));
  assert.equal(result.ok, true);
  return result;
}

function validBoundaryInput(bridge, overrides = {}) {
  const packetMode = overrides.packetMode || overrides.requestedMode || 'PR_MODE';
  const packetEmitResult = hasOwn(overrides, 'packetEmitResult')
    ? overrides.packetEmitResult
    : acceptedPacketEmitResult(bridge, { mode: packetMode });

  return {
    packetEmitResult,
    requestedMode: overrides.requestedMode || packetMode,
    requestedClaimSurface: overrides.requestedClaimSurface || 'INTERNAL',
  };
}

function acceptedBoundaryResult(bridge, overrides = {}) {
  const result = bridge.evaluateRevisionBridgeReleaseClaimUserFacingBoundaryGate(
    validBoundaryInput(bridge, overrides),
  );
  assert.equal(result.ok, true);
  return result;
}

function validPublicationInput(bridge, overrides = {}) {
  const requestedMode = hasOwn(overrides, 'requestedMode') ? overrides.requestedMode : undefined;
  const requestedClaimSurface = hasOwn(overrides, 'requestedClaimSurface')
    ? overrides.requestedClaimSurface
    : undefined;
  const boundaryMode = overrides.boundaryMode
    || (requestedMode === 'PR_MODE' || requestedMode === 'RELEASE_MODE' ? requestedMode : 'PR_MODE');
  const boundarySurface = overrides.boundarySurface
    || (requestedClaimSurface === 'INTERNAL' || requestedClaimSurface === 'USER_FACING'
      ? requestedClaimSurface
      : 'INTERNAL');
  const boundaryResult = hasOwn(overrides, 'boundaryResult')
    ? overrides.boundaryResult
    : acceptedBoundaryResult(bridge, {
      packetMode: boundaryMode,
      requestedMode: boundaryMode,
      requestedClaimSurface: boundarySurface,
    });

  return {
    ...(boundaryResult === undefined ? {} : { boundaryResult }),
    requestedMode: requestedMode === undefined ? boundaryMode : requestedMode,
    requestedClaimSurface: requestedClaimSurface === undefined
      ? boundarySurface
      : requestedClaimSurface,
  };
}

function acceptedPublicationResult(bridge, overrides = {}) {
  const result = bridge.evaluateRevisionBridgeReleaseClaimPublicationGate(
    validPublicationInput(bridge, overrides),
  );
  assert.equal(result.ok, true);
  return result;
}

function validKernelFenceInput(bridge, overrides = {}) {
  const requestedMode = hasOwn(overrides, 'requestedMode') ? overrides.requestedMode : undefined;
  const requestedClaimSurface = hasOwn(overrides, 'requestedClaimSurface')
    ? overrides.requestedClaimSurface
    : undefined;
  const publicationMode = overrides.publicationMode
    || (requestedMode === 'PR_MODE' || requestedMode === 'RELEASE_MODE' ? requestedMode : 'PR_MODE');
  const publicationSurface = overrides.publicationSurface
    || (requestedClaimSurface === 'INTERNAL' || requestedClaimSurface === 'USER_FACING'
      ? requestedClaimSurface
      : 'INTERNAL');
  const publicationResult = hasOwn(overrides, 'publicationResult')
    ? overrides.publicationResult
    : acceptedPublicationResult(bridge, {
      boundaryMode: publicationMode,
      requestedMode: publicationMode,
      requestedClaimSurface: publicationSurface,
    });

  return {
    ...(publicationResult === undefined ? {} : { publicationResult }),
    requestedMode: requestedMode === undefined ? publicationMode : requestedMode,
    requestedClaimSurface: requestedClaimSurface === undefined
      ? publicationSurface
      : requestedClaimSurface,
  };
}

function acceptedKernelFenceResult(bridge, overrides = {}) {
  const result = bridge.evaluateRevisionBridgeReleaseClaimKernelFence(
    validKernelFenceInput(bridge, overrides),
  );
  assert.equal(result.ok, true);
  return result;
}

function syntheticAcceptedKernelFenceResult(overrides = {}) {
  return {
    ok: true,
    type: 'revisionBridge.releaseClaimKernelFence',
    status: 'accepted',
    code: 'REVISION_BRIDGE_RELEASE_CLAIM_KERNEL_FENCE_ACCEPTED',
    reason: 'REVISION_BRIDGE_RELEASE_CLAIM_KERNEL_FENCE_ACCEPTED',
    binding: {
      mode: 'RELEASE_MODE',
      claimId: 'release-claim-1',
      dossierId: 'release-claim-dossier-1',
      matrixId: 'format-matrix-1',
      releaseClass: 'USER_FACING_CLAIM_READY',
    },
    summary: {
      claimSurface: 'USER_FACING',
      packetId: 'release-claim-packet-1',
      attestationId: 'attestation-1',
      admissionClass: 'USER_FACING',
    },
    ...overrides,
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
      admissionClass: 'USER_FACING',
      ...(overrides.summary || {}),
    },
  };
}

function validCommandAdmissionInput(bridge, overrides = {}) {
  const requestedMode = hasOwn(overrides, 'requestedMode') ? overrides.requestedMode : undefined;
  const requestedClaimSurface = hasOwn(overrides, 'requestedClaimSurface')
    ? overrides.requestedClaimSurface
    : undefined;
  const kernelFenceMode = overrides.kernelFenceMode
    || (requestedMode === 'PR_MODE' || requestedMode === 'RELEASE_MODE' ? requestedMode : 'PR_MODE');
  const kernelFenceSurface = overrides.kernelFenceSurface
    || (requestedClaimSurface === 'INTERNAL' || requestedClaimSurface === 'USER_FACING'
      ? requestedClaimSurface
      : 'INTERNAL');
  const kernelFenceResult = hasOwn(overrides, 'kernelFenceResult')
    ? overrides.kernelFenceResult
    : acceptedKernelFenceResult(bridge, {
      publicationMode: kernelFenceMode,
      requestedMode: kernelFenceMode,
      requestedClaimSurface: kernelFenceSurface,
    });

  return {
    commandId: hasOwn(overrides, 'commandId') ? overrides.commandId : 'cmd.release.claim.publish',
    ...(kernelFenceResult === undefined ? {} : { kernelFenceResult }),
    requestedMode: requestedMode === undefined ? kernelFenceMode : requestedMode,
    requestedClaimSurface: requestedClaimSurface === undefined
      ? kernelFenceSurface
      : requestedClaimSurface,
  };
}

function changedFilesFromGitStatus(statusText) {
  return statusText
    .split('\n')
    .filter(Boolean)
    .map((line) => line.slice(3).replace(/^"|"$/gu, ''));
}

function changedFilesOutsideAllowlist(changedFiles) {
  const allowed = new Set(ALLOWLIST);
  return changedFiles.filter((filePath) => !allowed.has(filePath));
}

test('Contour 12J exports command admission contracts and evaluator', async () => {
  const bridge = await loadBridge();

  assert.equal(
    bridge.REVISION_BRIDGE_RELEASE_CLAIM_COMMAND_ADMISSION_SCHEMA,
    'revision-bridge.release-claim-command-admission.v1',
  );
  assert.equal(
    Object.isFrozen(bridge.REVISION_BRIDGE_RELEASE_CLAIM_COMMAND_ADMISSION_REASON_CODES),
    true,
  );
  assert.equal(typeof bridge.evaluateRevisionBridgeReleaseClaimCommandAdmission, 'function');
  assert.equal(
    bridge.REVISION_BRIDGE_RELEASE_CLAIM_COMMAND_ADMISSION_REASON_CODES.includes(
      'REVISION_BRIDGE_RELEASE_CLAIM_COMMAND_ADMISSION_COMMAND_ID_REQUIRED',
    ),
    true,
  );
  assert.equal(
    bridge.REVISION_BRIDGE_RELEASE_CLAIM_COMMAND_ADMISSION_REASON_CODES.includes(
      'REVISION_BRIDGE_RELEASE_CLAIM_COMMAND_ADMISSION_KERNEL_FENCE_RESULT_PROVENANCE_INVALID',
    ),
    true,
  );
});

test('Contour 12J returns diagnostics when requestedMode is invalid', async () => {
  const bridge = await loadBridge();
  const result = bridge.evaluateRevisionBridgeReleaseClaimCommandAdmission(validCommandAdmissionInput(bridge, {
    requestedMode: 'CANARY_MODE',
  }));

  assert.equal(result.ok, false);
  assert.equal(result.status, 'diagnostics');
  assert.equal(
    result.reason,
    'REVISION_BRIDGE_RELEASE_CLAIM_COMMAND_ADMISSION_REQUESTED_MODE_INVALID',
  );
});

test('Contour 12J returns diagnostics when requestedClaimSurface is invalid', async () => {
  const bridge = await loadBridge();
  const result = bridge.evaluateRevisionBridgeReleaseClaimCommandAdmission(validCommandAdmissionInput(bridge, {
    requestedClaimSurface: 'EXTERNAL',
  }));

  assert.equal(result.ok, false);
  assert.equal(result.status, 'diagnostics');
  assert.equal(
    result.reason,
    'REVISION_BRIDGE_RELEASE_CLAIM_COMMAND_ADMISSION_REQUESTED_CLAIM_SURFACE_INVALID',
  );
});

test('Contour 12J blocks when commandId is missing', async () => {
  const bridge = await loadBridge();
  const input = validCommandAdmissionInput(bridge);
  delete input.commandId;

  const result = bridge.evaluateRevisionBridgeReleaseClaimCommandAdmission(input);

  assert.equal(result.ok, false);
  assert.equal(result.status, 'blocked');
  assert.equal(
    result.reason,
    'REVISION_BRIDGE_RELEASE_CLAIM_COMMAND_ADMISSION_COMMAND_ID_REQUIRED',
  );
});

test('Contour 12J blocks when kernelFenceResult is missing', async () => {
  const bridge = await loadBridge();
  const input = validCommandAdmissionInput(bridge);
  delete input.kernelFenceResult;

  const result = bridge.evaluateRevisionBridgeReleaseClaimCommandAdmission(input);

  assert.equal(result.ok, false);
  assert.equal(result.status, 'blocked');
  assert.equal(
    result.reason,
    'REVISION_BRIDGE_RELEASE_CLAIM_COMMAND_ADMISSION_KERNEL_FENCE_RESULT_MISSING',
  );
});

test('Contour 12J blocks when kernelFenceResult type is invalid', async () => {
  const bridge = await loadBridge();
  const kernelFenceResult = deepClone(acceptedKernelFenceResult(bridge));
  kernelFenceResult.type = 'revisionBridge.syntheticKernelFence';

  const result = bridge.evaluateRevisionBridgeReleaseClaimCommandAdmission(
    validCommandAdmissionInput(bridge, { kernelFenceResult }),
  );

  assert.equal(result.ok, false);
  assert.equal(result.status, 'blocked');
  assert.equal(
    result.reason,
    'REVISION_BRIDGE_RELEASE_CLAIM_COMMAND_ADMISSION_KERNEL_FENCE_RESULT_TYPE_INVALID',
  );
});

test('Contour 12J blocks when kernelFenceResult is not accepted', async () => {
  const bridge = await loadBridge();
  const kernelFenceResult = deepClone(acceptedKernelFenceResult(bridge));
  kernelFenceResult.ok = false;
  kernelFenceResult.status = 'blocked';
  kernelFenceResult.code = 'E_SYNTHETIC_BLOCKED';
  kernelFenceResult.reason = 'E_SYNTHETIC_BLOCKED';

  const result = bridge.evaluateRevisionBridgeReleaseClaimCommandAdmission(
    validCommandAdmissionInput(bridge, { kernelFenceResult }),
  );

  assert.equal(result.ok, false);
  assert.equal(result.status, 'blocked');
  assert.equal(
    result.reason,
    'REVISION_BRIDGE_RELEASE_CLAIM_COMMAND_ADMISSION_KERNEL_FENCE_RESULT_NOT_ACCEPTED',
  );
});

test('Contour 12J blocks when requestedMode does not match kernel fence binding mode', async () => {
  const bridge = await loadBridge();
  const result = bridge.evaluateRevisionBridgeReleaseClaimCommandAdmission(validCommandAdmissionInput(bridge, {
    kernelFenceMode: 'PR_MODE',
    requestedMode: 'RELEASE_MODE',
    requestedClaimSurface: 'INTERNAL',
  }));

  assert.equal(result.ok, false);
  assert.equal(result.status, 'blocked');
  assert.equal(
    result.reason,
    'REVISION_BRIDGE_RELEASE_CLAIM_COMMAND_ADMISSION_REQUESTED_MODE_MISMATCH',
  );
});

test('Contour 12J blocks when requestedClaimSurface does not match kernel fence summary claimSurface', async () => {
  const bridge = await loadBridge();
  const result = bridge.evaluateRevisionBridgeReleaseClaimCommandAdmission(validCommandAdmissionInput(bridge, {
    kernelFenceResult: syntheticAcceptedKernelFenceResult({
      binding: {
        mode: 'RELEASE_MODE',
        releaseClass: 'USER_FACING_CLAIM_READY',
      },
      summary: {
        claimSurface: 'USER_FACING',
        admissionClass: 'USER_FACING',
      },
    }),
    requestedMode: 'RELEASE_MODE',
    requestedClaimSurface: 'INTERNAL',
  }));

  assert.equal(result.ok, false);
  assert.equal(result.status, 'blocked');
  assert.equal(
    result.reason,
    'REVISION_BRIDGE_RELEASE_CLAIM_COMMAND_ADMISSION_REQUESTED_CLAIM_SURFACE_MISMATCH',
  );
});

test('Contour 12J blocks PR_MODE requests for USER_FACING command admission', async () => {
  const bridge = await loadBridge();
  const result = bridge.evaluateRevisionBridgeReleaseClaimCommandAdmission(validCommandAdmissionInput(bridge, {
    kernelFenceResult: syntheticAcceptedKernelFenceResult({
      binding: {
        mode: 'PR_MODE',
        releaseClass: 'USER_FACING_CLAIM_READY',
      },
      summary: {
        claimSurface: 'USER_FACING',
        admissionClass: 'USER_FACING',
      },
    }),
    requestedMode: 'PR_MODE',
    requestedClaimSurface: 'USER_FACING',
  }));

  assert.equal(result.ok, false);
  assert.equal(result.status, 'blocked');
  assert.equal(
    result.reason,
    'REVISION_BRIDGE_RELEASE_CLAIM_COMMAND_ADMISSION_PR_MODE_USER_FACING_BLOCKED',
  );
});

test('Contour 12J blocks RELEASE_MODE USER_FACING command admission when release class is not ready', async () => {
  const bridge = await loadBridge();
  const result = bridge.evaluateRevisionBridgeReleaseClaimCommandAdmission(validCommandAdmissionInput(bridge, {
    kernelFenceResult: syntheticAcceptedKernelFenceResult({
      binding: {
        mode: 'RELEASE_MODE',
        releaseClass: 'INTERNAL_PROOF_ONLY',
      },
      summary: {
        claimSurface: 'USER_FACING',
        admissionClass: 'INTERNAL',
      },
    }),
    requestedMode: 'RELEASE_MODE',
    requestedClaimSurface: 'USER_FACING',
  }));

  assert.equal(result.ok, false);
  assert.equal(result.status, 'blocked');
  assert.equal(
    result.reason,
    'REVISION_BRIDGE_RELEASE_CLAIM_COMMAND_ADMISSION_RELEASE_CLASS_USER_FACING_BLOCKED',
  );
});

test('Contour 12J blocks synthetic accepted kernel fence without required provenance', async () => {
  const bridge = await loadBridge();
  const result = bridge.evaluateRevisionBridgeReleaseClaimCommandAdmission(validCommandAdmissionInput(bridge, {
    kernelFenceResult: {
      ok: true,
      type: 'revisionBridge.releaseClaimKernelFence',
      status: 'accepted',
      code: 'REVISION_BRIDGE_RELEASE_CLAIM_KERNEL_FENCE_ACCEPTED',
      reason: 'REVISION_BRIDGE_RELEASE_CLAIM_KERNEL_FENCE_ACCEPTED',
      binding: {
        mode: 'RELEASE_MODE',
      },
      summary: {
        claimSurface: 'USER_FACING',
      },
    },
    requestedMode: 'RELEASE_MODE',
    requestedClaimSurface: 'USER_FACING',
  }));

  assert.equal(result.ok, false);
  assert.equal(result.status, 'blocked');
  assert.equal(
    result.reason,
    'REVISION_BRIDGE_RELEASE_CLAIM_COMMAND_ADMISSION_KERNEL_FENCE_RESULT_PROVENANCE_INVALID',
  );
});

test('Contour 12J accepts PR_MODE INTERNAL command admission', async () => {
  const bridge = await loadBridge();
  const result = bridge.evaluateRevisionBridgeReleaseClaimCommandAdmission(validCommandAdmissionInput(bridge, {
    kernelFenceMode: 'PR_MODE',
    requestedMode: 'PR_MODE',
    requestedClaimSurface: 'INTERNAL',
    commandId: 'cmd.release.claim.internalProof',
  }));

  assert.equal(result.ok, true);
  assert.equal(result.status, 'accepted');
  assert.equal(result.code, 'REVISION_BRIDGE_RELEASE_CLAIM_COMMAND_ADMISSION_ACCEPTED');
  assert.equal(result.summary.claimSurface, 'INTERNAL');
  assert.equal(result.summary.commandId, 'cmd.release.claim.internalProof');
  assert.equal(result.summary.admissionClass, 'INTERNAL');
  assert.equal(result.binding.releaseClass, 'INTERNAL_PROOF_ONLY');
});

test('Contour 12J accepts RELEASE_MODE USER_FACING command admission only with ready class', async () => {
  const bridge = await loadBridge();
  const result = bridge.evaluateRevisionBridgeReleaseClaimCommandAdmission(validCommandAdmissionInput(bridge, {
    kernelFenceMode: 'RELEASE_MODE',
    requestedMode: 'RELEASE_MODE',
    requestedClaimSurface: 'USER_FACING',
    commandId: 'cmd.release.claim.publish',
  }));

  assert.equal(result.ok, true);
  assert.equal(result.status, 'accepted');
  assert.equal(result.summary.claimSurface, 'USER_FACING');
  assert.equal(result.summary.commandId, 'cmd.release.claim.publish');
  assert.equal(result.summary.admissionClass, 'USER_FACING');
  assert.equal(result.binding.releaseClass, 'USER_FACING_CLAIM_READY');
});

test('Contour 12J command admission is deterministic', async () => {
  const bridge = await loadBridge();
  const input = validCommandAdmissionInput(bridge, {
    kernelFenceMode: 'RELEASE_MODE',
    requestedMode: 'RELEASE_MODE',
    requestedClaimSurface: 'USER_FACING',
    commandId: 'cmd.release.claim.publish',
  });

  const first = bridge.evaluateRevisionBridgeReleaseClaimCommandAdmission(input);
  const second = bridge.evaluateRevisionBridgeReleaseClaimCommandAdmission(input);

  assert.deepEqual(first, second);
});

test('Contour 12J command admission is non-mutating', async () => {
  const bridge = await loadBridge();
  const input = validCommandAdmissionInput(bridge, {
    kernelFenceMode: 'RELEASE_MODE',
    requestedMode: 'RELEASE_MODE',
    requestedClaimSurface: 'USER_FACING',
    commandId: 'cmd.release.claim.publish',
  });
  const before = deepClone(input);

  bridge.evaluateRevisionBridgeReleaseClaimCommandAdmission(input);

  assert.deepEqual(input, before);
});

test('Contour 12J accepted output keeps strict top-level and nested keys only', async () => {
  const bridge = await loadBridge();
  const result = bridge.evaluateRevisionBridgeReleaseClaimCommandAdmission(validCommandAdmissionInput(bridge, {
    kernelFenceMode: 'RELEASE_MODE',
    requestedMode: 'RELEASE_MODE',
    requestedClaimSurface: 'USER_FACING',
    commandId: 'cmd.release.claim.publish',
  }));

  assert.equal(result.ok, true);
  assert.deepEqual(
    Object.keys(result).sort(),
    ['binding', 'code', 'ok', 'reason', 'reasons', 'status', 'summary', 'type'],
  );
  assert.deepEqual(
    Object.keys(result.binding).sort(),
    ['claimId', 'dossierId', 'matrixId', 'mode', 'releaseClass'],
  );
  assert.deepEqual(
    Object.keys(result.summary).sort(),
    ['admissionClass', 'attestationId', 'claimSurface', 'commandId', 'packetId'],
  );
});

test('Contour 12J changed-files allowlist guard catches extra file', () => {
  const outsideAllowlist = changedFilesOutsideAllowlist([
    MODULE_PATH,
    TEST_PATH,
    'README.md',
  ]);

  assert.deepEqual(outsideAllowlist, ['README.md']);
});

test('Contour 12J changed-files allowlist guard passes in clean or dirty trees', () => {
  const status = execFileSync('git', ['status', '--porcelain', '-uall', '--', ...GUARDED_PATHS], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  const changedFiles = changedFilesFromGitStatus(status);
  const packageManifestDiff = changedFiles.filter((filePath) => (
    filePath === 'package.json'
    || filePath === 'package-lock.json'
    || filePath === 'npm-shrinkwrap.json'
  ));

  assert.deepEqual(changedFilesOutsideAllowlist(changedFiles), []);
  assert.deepEqual(packageManifestDiff, []);
});

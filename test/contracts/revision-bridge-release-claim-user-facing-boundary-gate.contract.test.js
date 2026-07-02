const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MODULE_PATH = 'src/io/revisionBridge/index.mjs';
const TEST_PATH = 'test/contracts/revision-bridge-release-claim-user-facing-boundary-gate.contract.test.js';
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

test('Contour 12G exports user-facing boundary gate contracts and evaluator', async () => {
  const bridge = await loadBridge();

  assert.equal(
    bridge.REVISION_BRIDGE_RELEASE_CLAIM_USER_FACING_BOUNDARY_SCHEMA,
    'revision-bridge.release-claim-user-facing-boundary.v1',
  );
  assert.deepEqual(
    bridge.REVISION_BRIDGE_RELEASE_CLAIM_USER_FACING_BOUNDARY_SURFACES,
    ['INTERNAL', 'USER_FACING'],
  );
  assert.equal(typeof bridge.evaluateRevisionBridgeReleaseClaimUserFacingBoundaryGate, 'function');
  assert.equal(
    bridge.REVISION_BRIDGE_RELEASE_CLAIM_USER_FACING_BOUNDARY_REASON_CODES.includes(
      'REVISION_BRIDGE_RELEASE_CLAIM_USER_FACING_BOUNDARY_PACKET_RESULT_PROVENANCE_INVALID',
    ),
    true,
  );
});

test('Contour 12G blocks when packetEmitResult is missing', async () => {
  const bridge = await loadBridge();
  const input = validBoundaryInput(bridge);
  delete input.packetEmitResult;

  const result = bridge.evaluateRevisionBridgeReleaseClaimUserFacingBoundaryGate(input);

  assert.equal(result.ok, false);
  assert.equal(result.status, 'blocked');
  assert.equal(result.reason, 'REVISION_BRIDGE_RELEASE_CLAIM_USER_FACING_BOUNDARY_PACKET_RESULT_MISSING');
});

test('Contour 12G blocks when packetEmitResult is not accepted', async () => {
  const bridge = await loadBridge();
  const packetEmitResult = deepClone(acceptedPacketEmitResult(bridge));
  packetEmitResult.ok = false;
  packetEmitResult.status = 'blocked';
  packetEmitResult.code = 'E_SYNTHETIC_BLOCKED';
  packetEmitResult.reason = 'E_SYNTHETIC_BLOCKED';

  const result = bridge.evaluateRevisionBridgeReleaseClaimUserFacingBoundaryGate(validBoundaryInput(bridge, {
    packetEmitResult,
  }));

  assert.equal(result.ok, false);
  assert.equal(result.status, 'blocked');
  assert.equal(result.reason, 'REVISION_BRIDGE_RELEASE_CLAIM_USER_FACING_BOUNDARY_PACKET_RESULT_NOT_ACCEPTED');
});

test('Contour 12G blocks when packetEmitResult type is invalid', async () => {
  const bridge = await loadBridge();
  const packetEmitResult = deepClone(acceptedPacketEmitResult(bridge));
  packetEmitResult.type = 'revisionBridge.syntheticPacketEmit';

  const result = bridge.evaluateRevisionBridgeReleaseClaimUserFacingBoundaryGate(validBoundaryInput(bridge, {
    packetEmitResult,
  }));

  assert.equal(result.ok, false);
  assert.equal(result.status, 'blocked');
  assert.equal(result.reason, 'REVISION_BRIDGE_RELEASE_CLAIM_USER_FACING_BOUNDARY_PACKET_RESULT_TYPE_INVALID');
});

test('Contour 12G blocks when requested mode does not match accepted packet mode', async () => {
  const bridge = await loadBridge();
  const result = bridge.evaluateRevisionBridgeReleaseClaimUserFacingBoundaryGate(validBoundaryInput(bridge, {
    packetMode: 'PR_MODE',
    requestedMode: 'RELEASE_MODE',
  }));

  assert.equal(result.ok, false);
  assert.equal(result.status, 'blocked');
  assert.equal(result.reason, 'REVISION_BRIDGE_RELEASE_CLAIM_USER_FACING_BOUNDARY_REQUESTED_MODE_MISMATCH');
});

test('Contour 12G returns diagnostics when requestedClaimSurface is invalid', async () => {
  const bridge = await loadBridge();
  const result = bridge.evaluateRevisionBridgeReleaseClaimUserFacingBoundaryGate(validBoundaryInput(bridge, {
    requestedClaimSurface: 'EXTERNAL',
  }));

  assert.equal(result.ok, false);
  assert.equal(result.status, 'diagnostics');
  assert.equal(result.reason, 'REVISION_BRIDGE_RELEASE_CLAIM_USER_FACING_BOUNDARY_REQUESTED_CLAIM_SURFACE_INVALID');
});

test('Contour 12G blocks PR_MODE requests for USER_FACING boundary', async () => {
  const bridge = await loadBridge();
  const result = bridge.evaluateRevisionBridgeReleaseClaimUserFacingBoundaryGate(validBoundaryInput(bridge, {
    requestedMode: 'PR_MODE',
    requestedClaimSurface: 'USER_FACING',
  }));

  assert.equal(result.ok, false);
  assert.equal(result.status, 'blocked');
  assert.equal(result.reason, 'REVISION_BRIDGE_RELEASE_CLAIM_USER_FACING_BOUNDARY_PR_MODE_USER_FACING_BLOCKED');
});

test('Contour 12G blocks RELEASE_MODE USER_FACING boundary when release class is INTERNAL_PROOF_ONLY', async () => {
  const bridge = await loadBridge();
  const packetEmitResult = deepClone(acceptedPacketEmitResult(bridge, {
    mode: 'RELEASE_MODE',
  }));
  packetEmitResult.binding.modeClass = 'INTERNAL_PROOF_ONLY';
  packetEmitResult.packet.releaseClaim.modeClass = 'INTERNAL_PROOF_ONLY';
  packetEmitResult.report.modeClass = 'INTERNAL_PROOF_ONLY';
  packetEmitResult.packet.packetHash = bridge.createRevisionBridgeReleaseClaimPacketHash(packetEmitResult.packet);
  packetEmitResult.report.packetHash = packetEmitResult.packet.packetHash;
  packetEmitResult.summary.packetHash = packetEmitResult.packet.packetHash;

  const result = bridge.evaluateRevisionBridgeReleaseClaimUserFacingBoundaryGate(validBoundaryInput(bridge, {
    packetEmitResult,
    requestedMode: 'RELEASE_MODE',
    requestedClaimSurface: 'USER_FACING',
  }));

  assert.equal(result.ok, false);
  assert.equal(result.status, 'blocked');
  assert.equal(
    result.reason,
    'REVISION_BRIDGE_RELEASE_CLAIM_USER_FACING_BOUNDARY_RELEASE_CLASS_USER_FACING_BLOCKED',
  );
});

test('Contour 12G blocks synthetic accepted packet without provenance', async () => {
  const bridge = await loadBridge();
  const result = bridge.evaluateRevisionBridgeReleaseClaimUserFacingBoundaryGate(validBoundaryInput(bridge, {
    packetEmitResult: {
      ok: true,
      type: 'revisionBridge.releaseClaimPacketEmit',
      status: 'accepted',
      code: 'REVISION_BRIDGE_RELEASE_CLAIM_PACKET_EMIT_ACCEPTED',
      reason: 'REVISION_BRIDGE_RELEASE_CLAIM_PACKET_EMIT_ACCEPTED',
      binding: {
        mode: 'RELEASE_MODE',
      },
      packet: {
        schemaVersion: bridge.REVISION_BRIDGE_RELEASE_CLAIM_PACKET_SCHEMA,
        releaseClaim: {
          mode: 'RELEASE_MODE',
        },
      },
      report: {
        schemaVersion: bridge.REVISION_BRIDGE_RELEASE_CLAIM_STRICT_REPORT_SCHEMA,
        reportClass: 'STRICT_RELEASE_CLAIM_REPORT',
        mode: 'RELEASE_MODE',
      },
    },
    requestedMode: 'RELEASE_MODE',
    requestedClaimSurface: 'INTERNAL',
  }));

  assert.equal(result.ok, false);
  assert.equal(result.status, 'blocked');
  assert.equal(result.reason, 'REVISION_BRIDGE_RELEASE_CLAIM_USER_FACING_BOUNDARY_PACKET_RESULT_PROVENANCE_INVALID');
});

test('Contour 12G rejects boundary input fields inherited from prototype', async () => {
  const bridge = await loadBridge();
  const inheritedInput = Object.create(validBoundaryInput(bridge, {
    packetMode: 'RELEASE_MODE',
    requestedMode: 'RELEASE_MODE',
    requestedClaimSurface: 'USER_FACING',
  }));

  const result = bridge.evaluateRevisionBridgeReleaseClaimUserFacingBoundaryGate(inheritedInput);

  assert.equal(Object.keys(inheritedInput).length, 0);
  assert.equal(result.ok, false);
  assert.equal(result.status, 'diagnostics');
  assert.equal(result.reason, 'REVISION_BRIDGE_RELEASE_CLAIM_USER_FACING_BOUNDARY_REQUESTED_MODE_REQUIRED');
});

test('Contour 12G rejects packetEmitResult fields inherited from prototype', async () => {
  const bridge = await loadBridge();
  const inheritedPacketEmitResult = Object.create(acceptedPacketEmitResult(bridge, {
    mode: 'RELEASE_MODE',
  }));

  const result = bridge.evaluateRevisionBridgeReleaseClaimUserFacingBoundaryGate(validBoundaryInput(bridge, {
    packetEmitResult: inheritedPacketEmitResult,
    requestedMode: 'RELEASE_MODE',
    requestedClaimSurface: 'USER_FACING',
  }));

  assert.equal(Object.keys(inheritedPacketEmitResult).length, 0);
  assert.equal(result.ok, false);
  assert.equal(result.status, 'blocked');
  assert.equal(result.reason, 'REVISION_BRIDGE_RELEASE_CLAIM_USER_FACING_BOUNDARY_PACKET_RESULT_TYPE_INVALID');
});

test('Contour 12G rejects nested packetEmitResult provenance inherited from prototype', async () => {
  const bridge = await loadBridge();
  const accepted = acceptedPacketEmitResult(bridge, {
    mode: 'RELEASE_MODE',
  });
  const packetEmitResult = {
    ...deepClone(accepted),
    binding: Object.create(accepted.binding),
    packet: Object.create(accepted.packet),
    report: Object.create(accepted.report),
  };

  const result = bridge.evaluateRevisionBridgeReleaseClaimUserFacingBoundaryGate(validBoundaryInput(bridge, {
    packetEmitResult,
    requestedMode: 'RELEASE_MODE',
    requestedClaimSurface: 'USER_FACING',
  }));

  assert.equal(Object.keys(packetEmitResult.binding).length, 0);
  assert.equal(Object.keys(packetEmitResult.packet).length, 0);
  assert.equal(Object.keys(packetEmitResult.report).length, 0);
  assert.equal(result.ok, false);
  assert.equal(result.status, 'blocked');
  assert.equal(result.reason, 'REVISION_BRIDGE_RELEASE_CLAIM_USER_FACING_BOUNDARY_PACKET_RESULT_PROVENANCE_INVALID');
});

test('Contour 12G blocks coherent synthetic accepted packet with forged packet report linkage', async () => {
  const bridge = await loadBridge();
  const packetEmitResult = deepClone(acceptedPacketEmitResult(bridge, {
    mode: 'RELEASE_MODE',
  }));
  packetEmitResult.packet.packetHash = 'sha256:forged-packet';
  packetEmitResult.report.packetHash = 'sha256:forged-report';
  packetEmitResult.summary.packetHash = 'sha256:forged-summary';
  packetEmitResult.report.packetId = 'forged-packet-id';
  packetEmitResult.report.attestationId = 'forged-attestation-id';

  const result = bridge.evaluateRevisionBridgeReleaseClaimUserFacingBoundaryGate(validBoundaryInput(bridge, {
    packetEmitResult,
    requestedMode: 'RELEASE_MODE',
    requestedClaimSurface: 'USER_FACING',
  }));

  assert.equal(result.ok, false);
  assert.equal(result.status, 'blocked');
  assert.equal(result.reason, 'REVISION_BRIDGE_RELEASE_CLAIM_USER_FACING_BOUNDARY_PACKET_RESULT_PROVENANCE_INVALID');
  assert.equal(
    result.reasons.some((reason) => reason.field === 'packetEmitResult.packet.packetHash'),
    true,
  );
  assert.equal(
    result.reasons.some((reason) => reason.field === 'packetEmitResult.report.packetId'),
    true,
  );
  assert.equal(
    result.reasons.some((reason) => reason.field === 'packetEmitResult.report.attestationId'),
    true,
  );
});

test('Contour 12G blocks coherent accepted packet when raw binding is empty', async () => {
  const bridge = await loadBridge();
  const packetEmitResult = deepClone(acceptedPacketEmitResult(bridge, {
    mode: 'RELEASE_MODE',
  }));
  packetEmitResult.binding = {};

  const result = bridge.evaluateRevisionBridgeReleaseClaimUserFacingBoundaryGate(validBoundaryInput(bridge, {
    packetEmitResult,
    requestedMode: 'RELEASE_MODE',
    requestedClaimSurface: 'USER_FACING',
  }));

  assert.equal(result.ok, false);
  assert.equal(result.status, 'blocked');
  assert.equal(result.reason, 'REVISION_BRIDGE_RELEASE_CLAIM_USER_FACING_BOUNDARY_PACKET_RESULT_PROVENANCE_INVALID');
  for (const field of [
    'packetEmitResult.binding.mode',
    'packetEmitResult.binding.claimId',
    'packetEmitResult.binding.dossierId',
    'packetEmitResult.binding.matrixId',
    'packetEmitResult.binding.releaseClass',
    'packetEmitResult.binding.packetId',
    'packetEmitResult.binding.attestationId',
  ]) {
    assert.equal(
      result.reasons.some((reason) => reason.field === field),
      true,
      `${field} should be required from raw binding`,
    );
  }
});

test('Contour 12G blocks coherent accepted packet when binding ids are missing', async () => {
  const bridge = await loadBridge();
  const packetEmitResult = deepClone(acceptedPacketEmitResult(bridge, {
    mode: 'RELEASE_MODE',
  }));
  delete packetEmitResult.binding.packetId;
  delete packetEmitResult.binding.attestationId;

  const result = bridge.evaluateRevisionBridgeReleaseClaimUserFacingBoundaryGate(validBoundaryInput(bridge, {
    packetEmitResult,
    requestedMode: 'RELEASE_MODE',
    requestedClaimSurface: 'USER_FACING',
  }));

  assert.equal(result.ok, false);
  assert.equal(result.status, 'blocked');
  assert.equal(result.reason, 'REVISION_BRIDGE_RELEASE_CLAIM_USER_FACING_BOUNDARY_PACKET_RESULT_PROVENANCE_INVALID');
  assert.equal(
    result.reasons.some((reason) => reason.field === 'packetEmitResult.binding.packetId'),
    true,
  );
  assert.equal(
    result.reasons.some((reason) => reason.field === 'packetEmitResult.binding.attestationId'),
    true,
  );
});

test('Contour 12G boundary gate is deterministic', async () => {
  const bridge = await loadBridge();
  const input = validBoundaryInput(bridge, {
    packetMode: 'RELEASE_MODE',
    requestedMode: 'RELEASE_MODE',
    requestedClaimSurface: 'USER_FACING',
  });

  const first = bridge.evaluateRevisionBridgeReleaseClaimUserFacingBoundaryGate(input);
  const second = bridge.evaluateRevisionBridgeReleaseClaimUserFacingBoundaryGate(input);

  assert.deepEqual(first, second);
});

test('Contour 12G boundary gate is non-mutating', async () => {
  const bridge = await loadBridge();
  const input = validBoundaryInput(bridge, {
    packetMode: 'RELEASE_MODE',
    requestedMode: 'RELEASE_MODE',
    requestedClaimSurface: 'USER_FACING',
  });
  const before = deepClone(input);

  bridge.evaluateRevisionBridgeReleaseClaimUserFacingBoundaryGate(input);

  assert.deepEqual(input, before);
});

test('Contour 12G accepts INTERNAL boundary for PR_MODE', async () => {
  const bridge = await loadBridge();
  const result = bridge.evaluateRevisionBridgeReleaseClaimUserFacingBoundaryGate(validBoundaryInput(bridge, {
    requestedMode: 'PR_MODE',
    requestedClaimSurface: 'INTERNAL',
  }));

  assert.equal(result.ok, true);
  assert.equal(result.status, 'accepted');
  assert.equal(result.code, 'REVISION_BRIDGE_RELEASE_CLAIM_USER_FACING_BOUNDARY_ACCEPTED');
  assert.equal(result.summary.claimSurface, 'INTERNAL');
  assert.equal(result.binding.releaseClass, 'INTERNAL_PROOF_ONLY');
});

test('Contour 12G accepts USER_FACING boundary for RELEASE_MODE only when packet release class is USER_FACING_CLAIM_READY', async () => {
  const bridge = await loadBridge();
  const result = bridge.evaluateRevisionBridgeReleaseClaimUserFacingBoundaryGate(validBoundaryInput(bridge, {
    packetMode: 'RELEASE_MODE',
    requestedMode: 'RELEASE_MODE',
    requestedClaimSurface: 'USER_FACING',
  }));

  assert.equal(result.ok, true);
  assert.equal(result.status, 'accepted');
  assert.equal(result.summary.claimSurface, 'USER_FACING');
  assert.equal(result.binding.releaseClass, 'USER_FACING_CLAIM_READY');
});

test('Contour 12G binding includes mode claimId dossierId matrixId and releaseClass', async () => {
  const bridge = await loadBridge();
  const result = bridge.evaluateRevisionBridgeReleaseClaimUserFacingBoundaryGate(validBoundaryInput(bridge, {
    packetMode: 'RELEASE_MODE',
    requestedMode: 'RELEASE_MODE',
    requestedClaimSurface: 'USER_FACING',
  }));

  assert.equal(result.ok, true);
  assert.deepEqual(result.binding, {
    mode: 'RELEASE_MODE',
    claimId: 'release-claim-1',
    dossierId: 'release-claim-dossier-1',
    matrixId: 'format-matrix-1',
    releaseClass: 'USER_FACING_CLAIM_READY',
  });
});

test('Contour 12G accepted output keeps strict top-level and nested keys only', async () => {
  const bridge = await loadBridge();
  const result = bridge.evaluateRevisionBridgeReleaseClaimUserFacingBoundaryGate(validBoundaryInput(bridge, {
    packetMode: 'RELEASE_MODE',
    requestedMode: 'RELEASE_MODE',
    requestedClaimSurface: 'USER_FACING',
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
    ['attestationId', 'claimSurface', 'packetId'],
  );
});

test('Contour 12G changed-files allowlist guard catches extra file', () => {
  const outsideAllowlist = changedFilesOutsideAllowlist([
    MODULE_PATH,
    TEST_PATH,
    'README.md',
  ]);

  assert.deepEqual(outsideAllowlist, ['README.md']);
});

test('Contour 12G changed-files allowlist guard passes in clean or dirty trees', () => {
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

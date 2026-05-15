const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MODULE_PATH = 'src/io/revisionBridge/index.mjs';
const TEST_PATH = 'test/contracts/revision-bridge-release-claim-publication-gate.contract.test.js';
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
    emitterId: 'codex-contour-12h',
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
    },
    summary: {
      claimSurface: 'USER_FACING',
      packetId: 'release-claim-packet-1',
      attestationId: 'attestation-1',
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
      ...(overrides.summary || {}),
    },
  };
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

test('Contour 12H exports publication gate contracts and evaluator', async () => {
  const bridge = await loadBridge();

  assert.equal(
    bridge.REVISION_BRIDGE_RELEASE_CLAIM_PUBLICATION_SCHEMA,
    'revision-bridge.release-claim-publication.v1',
  );
  assert.equal(Object.isFrozen(bridge.REVISION_BRIDGE_RELEASE_CLAIM_PUBLICATION_REASON_CODES), true);
  assert.equal(typeof bridge.evaluateRevisionBridgeReleaseClaimPublicationGate, 'function');
  assert.equal(
    bridge.REVISION_BRIDGE_RELEASE_CLAIM_PUBLICATION_REASON_CODES.includes(
      'REVISION_BRIDGE_RELEASE_CLAIM_PUBLICATION_BOUNDARY_RESULT_MISSING',
    ),
    true,
  );
  assert.equal(
    bridge.REVISION_BRIDGE_RELEASE_CLAIM_PUBLICATION_REASON_CODES.includes(
      'REVISION_BRIDGE_RELEASE_CLAIM_PUBLICATION_REQUESTED_CLAIM_SURFACE_MISMATCH',
    ),
    true,
  );
});

test('Contour 12H returns diagnostics when requestedMode is invalid', async () => {
  const bridge = await loadBridge();
  const result = bridge.evaluateRevisionBridgeReleaseClaimPublicationGate(validPublicationInput(bridge, {
    requestedMode: 'CANARY_MODE',
  }));

  assert.equal(result.ok, false);
  assert.equal(result.status, 'diagnostics');
  assert.equal(result.reason, 'REVISION_BRIDGE_RELEASE_CLAIM_PUBLICATION_REQUESTED_MODE_INVALID');
});

test('Contour 12H blocks when boundaryResult is missing', async () => {
  const bridge = await loadBridge();
  const input = validPublicationInput(bridge);
  delete input.boundaryResult;

  const result = bridge.evaluateRevisionBridgeReleaseClaimPublicationGate(input);

  assert.equal(result.ok, false);
  assert.equal(result.status, 'blocked');
  assert.equal(result.reason, 'REVISION_BRIDGE_RELEASE_CLAIM_PUBLICATION_BOUNDARY_RESULT_MISSING');
});

test('Contour 12H blocks when boundaryResult type is invalid', async () => {
  const bridge = await loadBridge();
  const boundaryResult = deepClone(acceptedBoundaryResult(bridge));
  boundaryResult.type = 'revisionBridge.syntheticBoundaryGate';

  const result = bridge.evaluateRevisionBridgeReleaseClaimPublicationGate(validPublicationInput(bridge, {
    boundaryResult,
  }));

  assert.equal(result.ok, false);
  assert.equal(result.status, 'blocked');
  assert.equal(result.reason, 'REVISION_BRIDGE_RELEASE_CLAIM_PUBLICATION_BOUNDARY_RESULT_TYPE_INVALID');
});

test('Contour 12H blocks when boundaryResult is not accepted', async () => {
  const bridge = await loadBridge();
  const boundaryResult = deepClone(acceptedBoundaryResult(bridge));
  boundaryResult.ok = false;
  boundaryResult.status = 'blocked';
  boundaryResult.code = 'E_SYNTHETIC_BLOCKED';
  boundaryResult.reason = 'E_SYNTHETIC_BLOCKED';

  const result = bridge.evaluateRevisionBridgeReleaseClaimPublicationGate(validPublicationInput(bridge, {
    boundaryResult,
  }));

  assert.equal(result.ok, false);
  assert.equal(result.status, 'blocked');
  assert.equal(result.reason, 'REVISION_BRIDGE_RELEASE_CLAIM_PUBLICATION_BOUNDARY_RESULT_NOT_ACCEPTED');
});

test('Contour 12H blocks when requestedMode does not match accepted boundary mode', async () => {
  const bridge = await loadBridge();
  const result = bridge.evaluateRevisionBridgeReleaseClaimPublicationGate(validPublicationInput(bridge, {
    boundaryMode: 'PR_MODE',
    requestedMode: 'RELEASE_MODE',
    requestedClaimSurface: 'INTERNAL',
  }));

  assert.equal(result.ok, false);
  assert.equal(result.status, 'blocked');
  assert.equal(result.reason, 'REVISION_BRIDGE_RELEASE_CLAIM_PUBLICATION_REQUESTED_MODE_MISMATCH');
});

test('Contour 12H returns diagnostics when requestedClaimSurface is invalid', async () => {
  const bridge = await loadBridge();
  const result = bridge.evaluateRevisionBridgeReleaseClaimPublicationGate(validPublicationInput(bridge, {
    requestedClaimSurface: 'EXTERNAL',
  }));

  assert.equal(result.ok, false);
  assert.equal(result.status, 'diagnostics');
  assert.equal(
    result.reason,
    'REVISION_BRIDGE_RELEASE_CLAIM_PUBLICATION_REQUESTED_CLAIM_SURFACE_INVALID',
  );
});

test('Contour 12H blocks PR_MODE requests for USER_FACING publication', async () => {
  const bridge = await loadBridge();
  const result = bridge.evaluateRevisionBridgeReleaseClaimPublicationGate(validPublicationInput(bridge, {
    boundaryResult: syntheticAcceptedBoundaryResult({
      binding: {
        mode: 'PR_MODE',
        releaseClass: 'USER_FACING_CLAIM_READY',
      },
      summary: {
        claimSurface: 'USER_FACING',
      },
    }),
    requestedMode: 'PR_MODE',
    requestedClaimSurface: 'USER_FACING',
  }));

  assert.equal(result.ok, false);
  assert.equal(result.status, 'blocked');
  assert.equal(result.reason, 'REVISION_BRIDGE_RELEASE_CLAIM_PUBLICATION_PR_MODE_USER_FACING_BLOCKED');
});

test('Contour 12H blocks RELEASE_MODE USER_FACING publication when releaseClass is not ready', async () => {
  const bridge = await loadBridge();
  const result = bridge.evaluateRevisionBridgeReleaseClaimPublicationGate(validPublicationInput(bridge, {
    boundaryResult: syntheticAcceptedBoundaryResult({
      binding: {
        mode: 'RELEASE_MODE',
        releaseClass: 'INTERNAL_PROOF_ONLY',
      },
      summary: {
        claimSurface: 'USER_FACING',
      },
    }),
    requestedMode: 'RELEASE_MODE',
    requestedClaimSurface: 'USER_FACING',
  }));

  assert.equal(result.ok, false);
  assert.equal(result.status, 'blocked');
  assert.equal(
    result.reason,
    'REVISION_BRIDGE_RELEASE_CLAIM_PUBLICATION_RELEASE_CLASS_USER_FACING_BLOCKED',
  );
});

test('Contour 12H accepts INTERNAL publication in PR_MODE', async () => {
  const bridge = await loadBridge();
  const result = bridge.evaluateRevisionBridgeReleaseClaimPublicationGate(validPublicationInput(bridge, {
    boundaryMode: 'PR_MODE',
    requestedMode: 'PR_MODE',
    requestedClaimSurface: 'INTERNAL',
  }));

  assert.equal(result.ok, true);
  assert.equal(result.status, 'accepted');
  assert.equal(result.code, 'REVISION_BRIDGE_RELEASE_CLAIM_PUBLICATION_ACCEPTED');
  assert.equal(result.summary.claimSurface, 'INTERNAL');
  assert.equal(result.binding.releaseClass, 'INTERNAL_PROOF_ONLY');
});

test('Contour 12H accepts USER_FACING publication only for RELEASE_MODE with ready releaseClass', async () => {
  const bridge = await loadBridge();
  const result = bridge.evaluateRevisionBridgeReleaseClaimPublicationGate(validPublicationInput(bridge, {
    boundaryMode: 'RELEASE_MODE',
    requestedMode: 'RELEASE_MODE',
    requestedClaimSurface: 'USER_FACING',
  }));

  assert.equal(result.ok, true);
  assert.equal(result.status, 'accepted');
  assert.equal(result.summary.claimSurface, 'USER_FACING');
  assert.equal(result.binding.releaseClass, 'USER_FACING_CLAIM_READY');
});

test('Contour 12H publication gate is deterministic', async () => {
  const bridge = await loadBridge();
  const input = validPublicationInput(bridge, {
    boundaryMode: 'RELEASE_MODE',
    requestedMode: 'RELEASE_MODE',
    requestedClaimSurface: 'USER_FACING',
  });

  const first = bridge.evaluateRevisionBridgeReleaseClaimPublicationGate(input);
  const second = bridge.evaluateRevisionBridgeReleaseClaimPublicationGate(input);

  assert.deepEqual(first, second);
});

test('Contour 12H publication gate is non-mutating', async () => {
  const bridge = await loadBridge();
  const input = validPublicationInput(bridge, {
    boundaryMode: 'RELEASE_MODE',
    requestedMode: 'RELEASE_MODE',
    requestedClaimSurface: 'USER_FACING',
  });
  const before = deepClone(input);

  bridge.evaluateRevisionBridgeReleaseClaimPublicationGate(input);

  assert.deepEqual(input, before);
});

test('Contour 12H accepted output keeps strict top-level and nested keys only', async () => {
  const bridge = await loadBridge();
  const result = bridge.evaluateRevisionBridgeReleaseClaimPublicationGate(validPublicationInput(bridge, {
    boundaryMode: 'RELEASE_MODE',
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

test('Contour 12H changed-files allowlist guard catches extra file', () => {
  const outsideAllowlist = changedFilesOutsideAllowlist([
    MODULE_PATH,
    TEST_PATH,
    'README.md',
  ]);

  assert.deepEqual(outsideAllowlist, ['README.md']);
});

test('Contour 12H changed-files allowlist guard passes in clean or dirty trees', () => {
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

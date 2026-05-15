const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MODULE_PATH = 'src/io/revisionBridge/index.mjs';
const TEST_PATH = 'test/contracts/revision-bridge-release-claim-attestation-gate.contract.test.js';
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
  return result;
}

function defaultReleaseCommands() {
  return [
    {
      commandId: 'node',
      argv: ['--test', 'test/contracts/revision-bridge-release-claim-attestation-gate.contract.test.js'],
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

test('Contour 12E exports release claim attestation contracts, digests, and evaluator', async () => {
  const bridge = await loadBridge();

  assert.equal(
    bridge.REVISION_BRIDGE_RELEASE_CLAIM_ATTESTATION_SCHEMA,
    'revision-bridge.release-claim-attestation.v1',
  );
  assert.equal(typeof bridge.evaluateRevisionBridgeReleaseClaimAttestationGate, 'function');
  assert.equal(typeof bridge.createRevisionBridgeReleaseClaimModeDecisionHash, 'function');
  assert.equal(typeof bridge.createRevisionBridgeReleaseClaimCommandRunDigest, 'function');
  assert.equal(typeof bridge.createRevisionBridgeReleaseClaimEvidenceHash, 'function');
  assert.equal(
    bridge.REVISION_BRIDGE_RELEASE_CLAIM_ATTESTATION_REASON_CODES.includes(
      'REVISION_BRIDGE_RELEASE_CLAIM_ATTESTATION_MODE_DECISION_PROVENANCE_INVALID',
    ),
    true,
  );
});

test('Contour 12E returns diagnostics when mode is missing', async () => {
  const bridge = await loadBridge();
  const result = bridge.evaluateRevisionBridgeReleaseClaimAttestationGate(validAttestationInput(bridge, {
    mode: '',
  }));

  assert.equal(result.ok, false);
  assert.equal(result.status, 'diagnostics');
  assert.equal(result.code, 'E_REVISION_BRIDGE_RELEASE_CLAIM_ATTESTATION_DIAGNOSTICS');
  assert.equal(result.reason, 'REVISION_BRIDGE_RELEASE_CLAIM_ATTESTATION_MODE_REQUIRED');
});

test('Contour 12E returns diagnostics when mode is invalid', async () => {
  const bridge = await loadBridge();
  const result = bridge.evaluateRevisionBridgeReleaseClaimAttestationGate(validAttestationInput(bridge, {
    mode: 'SHADOW_MODE',
  }));

  assert.equal(result.ok, false);
  assert.equal(result.status, 'diagnostics');
  assert.equal(result.reason, 'REVISION_BRIDGE_RELEASE_CLAIM_ATTESTATION_MODE_INVALID');
});

test('Contour 12E blocks synthetic accepted 12D results without provenance', async () => {
  const bridge = await loadBridge();
  const result = bridge.evaluateRevisionBridgeReleaseClaimAttestationGate(validAttestationInput(bridge, {
    modeDecisionResult: {
      ok: true,
      type: 'revisionBridge.releaseClaimModeDecisionGate',
      status: 'accepted',
      code: 'REVISION_BRIDGE_RELEASE_CLAIM_MODE_DECISION_ACCEPTED',
      reason: 'REVISION_BRIDGE_RELEASE_CLAIM_MODE_DECISION_ACCEPTED',
      binding: {
        mode: 'PR_MODE',
      },
    },
  }));

  assert.equal(result.ok, false);
  assert.equal(result.status, 'blocked');
  assert.equal(result.reason, 'REVISION_BRIDGE_RELEASE_CLAIM_ATTESTATION_MODE_DECISION_PROVENANCE_INVALID');
  assert.equal(
    result.reasons.some((reason) => reason.field === 'modeDecisionResult.binding.claimId'),
    true,
  );
  assert.equal(
    result.reasons.some((reason) => reason.field === 'modeDecisionResult.binding.dossierId'),
    true,
  );
  assert.equal(
    result.reasons.some((reason) => reason.field === 'modeDecisionResult.binding.matrixId'),
    true,
  );
});

test('Contour 12E blocks when minimum attestation fields are missing', async () => {
  const bridge = await loadBridge();
  const result = bridge.evaluateRevisionBridgeReleaseClaimAttestationGate(validAttestationInput(bridge, {
    attestationId: '',
    attestationSchema: '',
    inputHash: '',
  }));

  assert.equal(result.ok, false);
  assert.equal(result.status, 'blocked');
  assert.equal(result.reason, 'REVISION_BRIDGE_RELEASE_CLAIM_ATTESTATION_MINIMUM_FIELDS_MISSING');
  assert.deepEqual(
    result.reasons[0].missingMinimumFields,
    ['attestationId', 'attestationSchema', 'inputHash'],
  );
});

test('Contour 12E blocks when decisionHash does not match accepted 12D provenance hash', async () => {
  const bridge = await loadBridge();
  const result = bridge.evaluateRevisionBridgeReleaseClaimAttestationGate(validAttestationInput(bridge, {
    decisionHash: 'wrong-decision-hash',
  }));

  assert.equal(result.ok, false);
  assert.equal(result.status, 'blocked');
  assert.equal(result.reason, 'REVISION_BRIDGE_RELEASE_CLAIM_ATTESTATION_DECISION_HASH_MISMATCH');
  assert.equal(result.reasons[0].receivedDecisionHash, 'wrong-decision-hash');
});

test('Contour 12E blocks when commandRunDigest does not match normalized executedCommands digest', async () => {
  const bridge = await loadBridge();
  const result = bridge.evaluateRevisionBridgeReleaseClaimAttestationGate(validAttestationInput(bridge, {
    commandRunDigest: 'wrong-command-run-digest',
  }));

  assert.equal(result.ok, false);
  assert.equal(result.status, 'blocked');
  assert.equal(result.reason, 'REVISION_BRIDGE_RELEASE_CLAIM_ATTESTATION_COMMAND_RUN_DIGEST_MISMATCH');
  assert.equal(result.reasons[0].receivedCommandRunDigest, 'wrong-command-run-digest');
});

test('Contour 12E blocks when evidenceHash does not match normalized artifactHashes digest', async () => {
  const bridge = await loadBridge();
  const result = bridge.evaluateRevisionBridgeReleaseClaimAttestationGate(validAttestationInput(bridge, {
    evidenceHash: 'wrong-evidence-hash',
  }));

  assert.equal(result.ok, false);
  assert.equal(result.status, 'blocked');
  assert.equal(result.reason, 'REVISION_BRIDGE_RELEASE_CLAIM_ATTESTATION_EVIDENCE_HASH_MISMATCH');
  assert.equal(result.reasons[0].receivedEvidenceHash, 'wrong-evidence-hash');
});

test('Contour 12E blocks RELEASE_MODE when extra attestation fields are missing', async () => {
  const bridge = await loadBridge();
  const result = bridge.evaluateRevisionBridgeReleaseClaimAttestationGate(validAttestationInput(bridge, {
    mode: 'RELEASE_MODE',
    executedCommands: [],
    artifactHashes: [],
    releaseEvidenceId: '',
    releaseEvidenceHash: '',
  }));

  assert.equal(result.ok, false);
  assert.equal(result.status, 'blocked');
  assert.equal(result.reason, 'REVISION_BRIDGE_RELEASE_CLAIM_ATTESTATION_RELEASE_FIELDS_MISSING');
  assert.deepEqual(
    result.reasons[0].missingReleaseFields,
    ['executedCommands', 'artifactHashes', 'releaseEvidenceId', 'releaseEvidenceHash'],
  );
});

test('Contour 12E accepts PR_MODE with valid minimum attestation and accepted 12D provenance', async () => {
  const bridge = await loadBridge();
  const result = bridge.evaluateRevisionBridgeReleaseClaimAttestationGate(validAttestationInput(bridge, {
    mode: 'PR_MODE',
  }));

  assert.equal(result.ok, true);
  assert.equal(result.status, 'accepted');
  assert.equal(result.code, 'REVISION_BRIDGE_RELEASE_CLAIM_ATTESTATION_ACCEPTED');
  assert.deepEqual(result.reasons, []);
  assert.equal(result.binding.mode, 'PR_MODE');
  assert.deepEqual(result.summary.missingMinimumFields, []);
  assert.deepEqual(result.summary.missingReleaseFields, []);
});

test('Contour 12E accepts RELEASE_MODE only with full valid attestation and accepted 12D provenance', async () => {
  const bridge = await loadBridge();
  const result = bridge.evaluateRevisionBridgeReleaseClaimAttestationGate(validAttestationInput(bridge, {
    mode: 'RELEASE_MODE',
  }));

  assert.equal(result.ok, true);
  assert.equal(result.status, 'accepted');
  assert.equal(result.code, 'REVISION_BRIDGE_RELEASE_CLAIM_ATTESTATION_ACCEPTED');
  assert.equal(result.binding.mode, 'RELEASE_MODE');
  assert.deepEqual(result.summary.missingReleaseFields, []);
});

test('Contour 12E result binding contains mode claimId dossierId and matrixId', async () => {
  const bridge = await loadBridge();
  const modeDecisionResult = acceptedModeDecisionResult(bridge, {
    mode: 'RELEASE_MODE',
  });
  const result = bridge.evaluateRevisionBridgeReleaseClaimAttestationGate(validAttestationInput(bridge, {
    mode: 'RELEASE_MODE',
    modeDecisionResult,
  }));

  assert.equal(result.ok, true);
  assert.equal(result.binding.mode, 'RELEASE_MODE');
  assert.equal(result.binding.claimId, modeDecisionResult.binding.claimId);
  assert.equal(result.binding.dossierId, modeDecisionResult.binding.dossierId);
  assert.equal(result.binding.matrixId, modeDecisionResult.binding.matrixId);
});

test('Contour 12E attestation gate is deterministic', async () => {
  const bridge = await loadBridge();
  const input = validAttestationInput(bridge, {
    mode: 'RELEASE_MODE',
  });

  const first = bridge.evaluateRevisionBridgeReleaseClaimAttestationGate(input);
  const second = bridge.evaluateRevisionBridgeReleaseClaimAttestationGate(input);

  assert.deepEqual(first, second);
});

test('Contour 12E attestation gate is non-mutating', async () => {
  const bridge = await loadBridge();
  const input = validAttestationInput(bridge, {
    mode: 'RELEASE_MODE',
  });
  const before = deepClone(input);

  bridge.evaluateRevisionBridgeReleaseClaimAttestationGate(input);

  assert.deepEqual(input, before);
});

test('Contour 12E source section stays kernel-only and free of wiring drift tokens', () => {
  const source = fs.readFileSync(path.join(REPO_ROOT, MODULE_PATH), 'utf8');
  const start = source.indexOf('// CONTOUR_12E_RELEASE_CLAIM_ATTESTATION_GATE_START');
  const end = source.indexOf('// CONTOUR_12E_RELEASE_CLAIM_ATTESTATION_GATE_END');

  assert.notEqual(start, -1);
  assert.notEqual(end, -1);

  const section = source.slice(start, end);
  const forbiddenPatterns = [
    /\bdocx\b/u,
    /\bparser\b/u,
    /\bnetwork\b/u,
    /\bruntime\b/u,
    /\brenderer\b/u,
    /\bpreload\b/u,
    /\bmenu\b/u,
    /\bipc\b/u,
    /\bfetch\s*\(/u,
    /\bXMLHttpRequest\b/u,
    /\bWebSocket\b/u,
    /\bchild_process\b/u,
    /\bfs\b/u,
    /\bhttp\b/u,
    /\bhttps\b/u,
  ];

  for (const pattern of forbiddenPatterns) {
    assert.equal(pattern.test(section), false, `forbidden contour token: ${pattern.source}`);
  }
});

test('Contour 12E changed-files allowlist guard passes in clean or dirty trees', () => {
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

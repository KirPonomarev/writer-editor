const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MODULE_PATH = 'src/io/revisionBridge/index.mjs';
const TEST_PATH = 'test/contracts/revision-bridge-release-claim-packet-emit.contract.test.js';
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

test('Contour 12F exports release claim packet contracts, strict report validator, and evaluator', async () => {
  const bridge = await loadBridge();

  assert.equal(
    bridge.REVISION_BRIDGE_RELEASE_CLAIM_PACKET_SCHEMA,
    'revision-bridge.release-claim-packet.v1',
  );
  assert.equal(
    bridge.REVISION_BRIDGE_RELEASE_CLAIM_STRICT_REPORT_SCHEMA,
    'revision-bridge.release-claim-report.v1',
  );
  assert.equal(typeof bridge.evaluateRevisionBridgeReleaseClaimPacketEmit, 'function');
  assert.equal(typeof bridge.createRevisionBridgeReleaseClaimPacketHash, 'function');
  assert.equal(typeof bridge.validateRevisionBridgeReleaseClaimStrictReportShape, 'function');
  assert.equal(
    bridge.REVISION_BRIDGE_RELEASE_CLAIM_PACKET_EMIT_REASON_CODES.includes(
      'REVISION_BRIDGE_RELEASE_CLAIM_PACKET_BINDING_MODE_MISMATCH',
    ),
    true,
  );
});

test('Contour 12F blocks when modeDecisionResult is missing', async () => {
  const bridge = await loadBridge();
  const input = validPacketEmitInput(bridge);
  delete input.modeDecisionResult;

  const result = bridge.evaluateRevisionBridgeReleaseClaimPacketEmit(input);

  assert.equal(result.ok, false);
  assert.equal(result.status, 'blocked');
  assert.equal(result.reason, 'REVISION_BRIDGE_RELEASE_CLAIM_PACKET_MODE_DECISION_RESULT_MISSING');
});

test('Contour 12F blocks when attestationResult is missing', async () => {
  const bridge = await loadBridge();
  const input = validPacketEmitInput(bridge);
  delete input.attestationResult;

  const result = bridge.evaluateRevisionBridgeReleaseClaimPacketEmit(input);

  assert.equal(result.ok, false);
  assert.equal(result.status, 'blocked');
  assert.equal(result.reason, 'REVISION_BRIDGE_RELEASE_CLAIM_PACKET_ATTESTATION_RESULT_MISSING');
});

test('Contour 12F blocks when modeDecisionResult is not accepted', async () => {
  const bridge = await loadBridge();
  const blockedModeDecisionResult = deepClone(acceptedModeDecisionResult(bridge));
  blockedModeDecisionResult.ok = false;
  blockedModeDecisionResult.status = 'blocked';
  blockedModeDecisionResult.code = 'E_SYNTHETIC_BLOCKED';
  blockedModeDecisionResult.reason = 'E_SYNTHETIC_BLOCKED';

  const result = bridge.evaluateRevisionBridgeReleaseClaimPacketEmit(validPacketEmitInput(bridge, {
    modeDecisionResult: blockedModeDecisionResult,
    attestationResult: acceptedAttestationResult(bridge),
  }));

  assert.equal(result.ok, false);
  assert.equal(result.status, 'blocked');
  assert.equal(result.reason, 'REVISION_BRIDGE_RELEASE_CLAIM_PACKET_MODE_DECISION_RESULT_NOT_ACCEPTED');
});

test('Contour 12F blocks when attestationResult is not accepted', async () => {
  const bridge = await loadBridge();
  const blockedAttestationResult = deepClone(acceptedAttestationResult(bridge));
  blockedAttestationResult.ok = false;
  blockedAttestationResult.status = 'blocked';
  blockedAttestationResult.code = 'E_SYNTHETIC_BLOCKED';
  blockedAttestationResult.reason = 'E_SYNTHETIC_BLOCKED';

  const result = bridge.evaluateRevisionBridgeReleaseClaimPacketEmit(validPacketEmitInput(bridge, {
    attestationResult: blockedAttestationResult,
  }));

  assert.equal(result.ok, false);
  assert.equal(result.status, 'blocked');
  assert.equal(result.reason, 'REVISION_BRIDGE_RELEASE_CLAIM_PACKET_ATTESTATION_RESULT_NOT_ACCEPTED');
});

test('Contour 12F blocks when mode binding does not match across 12D and 12E', async () => {
  const bridge = await loadBridge();
  const attestationResult = deepClone(acceptedAttestationResult(bridge));
  attestationResult.binding.mode = 'RELEASE_MODE';
  attestationResult.attestation.mode = 'RELEASE_MODE';

  const result = bridge.evaluateRevisionBridgeReleaseClaimPacketEmit(validPacketEmitInput(bridge, {
    attestationResult,
  }));

  assert.equal(result.ok, false);
  assert.equal(result.status, 'blocked');
  assert.equal(result.reason, 'REVISION_BRIDGE_RELEASE_CLAIM_PACKET_BINDING_MODE_MISMATCH');
});

test('Contour 12F blocks when claimId dossierId and matrixId bindings do not match', async () => {
  const bridge = await loadBridge();
  const attestationResult = deepClone(acceptedAttestationResult(bridge));
  attestationResult.binding.claimId = 'release-claim-2';
  attestationResult.binding.dossierId = 'release-claim-dossier-2';
  attestationResult.binding.matrixId = 'format-matrix-2';

  const result = bridge.evaluateRevisionBridgeReleaseClaimPacketEmit(validPacketEmitInput(bridge, {
    attestationResult,
  }));

  assert.equal(result.ok, false);
  assert.equal(result.status, 'blocked');
  assert.equal(
    result.reasons.some((reason) => reason.code === 'REVISION_BRIDGE_RELEASE_CLAIM_PACKET_BINDING_CLAIM_ID_MISMATCH'),
    true,
  );
  assert.equal(
    result.reasons.some((reason) => reason.code === 'REVISION_BRIDGE_RELEASE_CLAIM_PACKET_BINDING_DOSSIER_ID_MISMATCH'),
    true,
  );
  assert.equal(
    result.reasons.some((reason) => reason.code === 'REVISION_BRIDGE_RELEASE_CLAIM_PACKET_BINDING_MATRIX_ID_MISMATCH'),
    true,
  );
});

test('Contour 12F returns diagnostics when packetMeta fields are invalid', async () => {
  const bridge = await loadBridge();
  const result = bridge.evaluateRevisionBridgeReleaseClaimPacketEmit(validPacketEmitInput(bridge, {
    packetMeta: validPacketMeta({
      emitterId: '',
      notes: 'free-text',
    }),
  }));

  assert.equal(result.ok, false);
  assert.equal(result.status, 'diagnostics');
  assert.equal(result.reason, 'REVISION_BRIDGE_RELEASE_CLAIM_PACKET_META_INVALID');
  assert.deepEqual(result.reasons[0].extraFields, ['notes']);
  assert.deepEqual(result.reasons[0].missingFields, ['emitterId']);
});

test('Contour 12F strict report validator rejects extra fields', async () => {
  const bridge = await loadBridge();
  const result = bridge.evaluateRevisionBridgeReleaseClaimPacketEmit(validPacketEmitInput(bridge, {
    mode: 'RELEASE_MODE',
  }));
  const validation = bridge.validateRevisionBridgeReleaseClaimStrictReportShape({
    ...deepClone(result.report),
    notes: 'free-text',
  });

  assert.equal(result.ok, true);
  assert.equal(validation.ok, false);
  assert.equal(validation.reason, 'REVISION_BRIDGE_RELEASE_CLAIM_PACKET_STRICT_REPORT_EXTRA_FIELDS');
});

test('Contour 12F packet emit is deterministic', async () => {
  const bridge = await loadBridge();
  const input = validPacketEmitInput(bridge, {
    mode: 'RELEASE_MODE',
  });

  const first = bridge.evaluateRevisionBridgeReleaseClaimPacketEmit(input);
  const second = bridge.evaluateRevisionBridgeReleaseClaimPacketEmit(input);

  assert.deepEqual(first, second);
});

test('Contour 12F packet emit is non-mutating', async () => {
  const bridge = await loadBridge();
  const input = validPacketEmitInput(bridge, {
    mode: 'RELEASE_MODE',
  });
  const before = deepClone(input);

  bridge.evaluateRevisionBridgeReleaseClaimPacketEmit(input);

  assert.deepEqual(input, before);
});

test('Contour 12F emits INTERNAL_PROOF_ONLY packet and report for PR_MODE', async () => {
  const bridge = await loadBridge();
  const result = bridge.evaluateRevisionBridgeReleaseClaimPacketEmit(validPacketEmitInput(bridge, {
    mode: 'PR_MODE',
  }));

  assert.equal(result.ok, true);
  assert.equal(result.status, 'accepted');
  assert.equal(result.code, 'REVISION_BRIDGE_RELEASE_CLAIM_PACKET_EMIT_ACCEPTED');
  assert.equal(result.packet.releaseClaim.mode, 'PR_MODE');
  assert.equal(result.packet.releaseClaim.modeClass, 'INTERNAL_PROOF_ONLY');
  assert.equal(result.report.modeClass, 'INTERNAL_PROOF_ONLY');
});

test('Contour 12F emits USER_FACING_CLAIM_READY packet and report for RELEASE_MODE only after accepted 12D and 12E', async () => {
  const bridge = await loadBridge();
  const modeDecisionResult = acceptedModeDecisionResult(bridge, {
    mode: 'RELEASE_MODE',
  });
  const attestationResult = acceptedAttestationResult(bridge, {
    mode: 'RELEASE_MODE',
    modeDecisionResult,
  });
  const result = bridge.evaluateRevisionBridgeReleaseClaimPacketEmit(validPacketEmitInput(bridge, {
    modeDecisionResult,
    attestationResult,
    packetMeta: validPacketMeta(),
  }));

  assert.equal(result.ok, true);
  assert.equal(result.status, 'accepted');
  assert.equal(result.packet.releaseClaim.mode, 'RELEASE_MODE');
  assert.equal(result.packet.releaseClaim.modeClass, 'USER_FACING_CLAIM_READY');
  assert.equal(result.report.modeClass, 'USER_FACING_CLAIM_READY');
  assert.equal(result.packet.attestation.releaseEvidenceId, 'release-evidence-1');
  assert.equal(result.packet.attestation.releaseEvidenceHash, 'sha256:release-evidence-1');
});

test('Contour 12F strict report shape has only fixed keys', async () => {
  const bridge = await loadBridge();
  const result = bridge.evaluateRevisionBridgeReleaseClaimPacketEmit(validPacketEmitInput(bridge, {
    mode: 'RELEASE_MODE',
  }));
  const validation = bridge.validateRevisionBridgeReleaseClaimStrictReportShape(result.report);

  assert.equal(result.ok, true);
  assert.equal(validation.ok, true);
  assert.deepEqual(
    Object.keys(result.report).sort(),
    [...bridge.REVISION_BRIDGE_RELEASE_CLAIM_STRICT_REPORT_KEYS].sort(),
  );
});

test('Contour 12F packet hash is stable and excludes createdAtUtc from the hash body', async () => {
  const bridge = await loadBridge();
  const first = bridge.evaluateRevisionBridgeReleaseClaimPacketEmit(validPacketEmitInput(bridge, {
    mode: 'RELEASE_MODE',
    packetMeta: validPacketMeta({
      createdAtUtc: '2026-05-15T12:00:00Z',
    }),
  }));
  const second = bridge.evaluateRevisionBridgeReleaseClaimPacketEmit(validPacketEmitInput(bridge, {
    mode: 'RELEASE_MODE',
    packetMeta: validPacketMeta({
      createdAtUtc: '2030-01-01T00:00:00Z',
    }),
  }));

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(first.packet.packetHash, second.packet.packetHash);
  assert.equal(first.packet.packetMeta.createdAtUtc, '2026-05-15T12:00:00Z');
  assert.equal(second.packet.packetMeta.createdAtUtc, '2030-01-01T00:00:00Z');
});

test('Contour 12F source section stays kernel-only and free of wiring drift tokens', () => {
  const source = fs.readFileSync(path.join(REPO_ROOT, MODULE_PATH), 'utf8');
  const start = source.indexOf('// CONTOUR_12F_RELEASE_CLAIM_PACKET_EMIT_START');
  const end = source.indexOf('// CONTOUR_12F_RELEASE_CLAIM_PACKET_EMIT_END');

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

test('Contour 12F changed-files allowlist guard catches extra files', () => {
  const outsideAllowlist = changedFilesOutsideAllowlist([
    MODULE_PATH,
    TEST_PATH,
    'README.md',
  ]);

  assert.deepEqual(outsideAllowlist, ['README.md']);
});

test('Contour 12F changed-files allowlist guard passes in clean or dirty trees', () => {
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

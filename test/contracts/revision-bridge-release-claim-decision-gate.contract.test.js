const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MODULE_PATH = 'src/io/revisionBridge/index.mjs';
const TEST_PATH = 'test/contracts/revision-bridge-release-claim-decision-gate.contract.test.js';
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

test('Contour 12D exports mode decision contracts and evaluator', async () => {
  const bridge = await loadBridge();

  assert.equal(
    bridge.REVISION_BRIDGE_RELEASE_CLAIM_MODE_DECISION_SCHEMA,
    'revision-bridge.release-claim-mode-decision.v1',
  );
  assert.deepEqual(
    bridge.REVISION_BRIDGE_RELEASE_CLAIM_MODE_VALUES,
    ['PR_MODE', 'RELEASE_MODE'],
  );
  assert.equal(typeof bridge.evaluateRevisionBridgeReleaseClaimModeDecisionGate, 'function');
  assert.equal(
    bridge.REVISION_BRIDGE_RELEASE_CLAIM_MODE_DECISION_REASON_CODES.includes(
      'REVISION_BRIDGE_RELEASE_CLAIM_MODE_DECISION_RELEASE_FIELDS_MISSING',
    ),
    true,
  );
});

test('Contour 12D returns diagnostics when mode is missing', async () => {
  const bridge = await loadBridge();
  const result = bridge.evaluateRevisionBridgeReleaseClaimModeDecisionGate(validDecisionInput(bridge, {
    mode: '',
  }));

  assert.equal(result.ok, false);
  assert.equal(result.status, 'diagnostics');
  assert.equal(result.code, 'E_REVISION_BRIDGE_RELEASE_CLAIM_MODE_DECISION_DIAGNOSTICS');
  assert.equal(result.reason, 'REVISION_BRIDGE_RELEASE_CLAIM_MODE_DECISION_MODE_REQUIRED');
});

test('Contour 12D returns diagnostics when mode is invalid', async () => {
  const bridge = await loadBridge();
  const result = bridge.evaluateRevisionBridgeReleaseClaimModeDecisionGate(validDecisionInput(bridge, {
    mode: 'SHADOW_MODE',
  }));

  assert.equal(result.ok, false);
  assert.equal(result.status, 'diagnostics');
  assert.equal(result.reason, 'REVISION_BRIDGE_RELEASE_CLAIM_MODE_DECISION_MODE_INVALID');
});

test('Contour 12D blocks synthetic accepted dossier bypass attempts and trusts only raw dossier input', async () => {
  const bridge = await loadBridge();
  const result = bridge.evaluateRevisionBridgeReleaseClaimModeDecisionGate(validDecisionInput(bridge, {
    dossier: {
      schemaVersion: 'revision-bridge.release-claim-dossier.v1',
      dossierId: 'release-claim-dossier-1',
      items: [],
    },
    dossierResult: {
      status: 'accepted',
      code: 'REVISION_BRIDGE_RELEASE_CLAIM_DOSSIER_ACCEPTED',
      reason: 'REVISION_BRIDGE_RELEASE_CLAIM_DOSSIER_ACCEPTED',
    },
  }));

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'REVISION_BRIDGE_RELEASE_CLAIM_MODE_DECISION_DOSSIER_BLOCKED');
  assert.equal(result.reasons[0].dossierStatus, 'diagnostics');
  assert.equal(result.reasons[0].dossierReason, 'REVISION_BRIDGE_RELEASE_CLAIM_DOSSIER_ITEMS_REQUIRED');
});

test('Contour 12D propagates blocked dossier gate state', async () => {
  const bridge = await loadBridge();
  const goldenSet = validGoldenSet();
  const blockedClaim = validClaim(bridge, goldenSet, {
    goldenSetHash: 'rbgs_wrong_hash',
  });
  const result = bridge.evaluateRevisionBridgeReleaseClaimModeDecisionGate(validDecisionInput(bridge, {
    dossier: validDossier(bridge, {
      items: [
        validDossierItem(bridge, {
          goldenSet,
          claim: blockedClaim,
        }),
      ],
    }),
  }));

  assert.equal(result.ok, false);
  assert.equal(result.status, 'blocked');
  assert.equal(result.reason, 'REVISION_BRIDGE_RELEASE_CLAIM_MODE_DECISION_DOSSIER_BLOCKED');
  assert.equal(result.reasons[0].dossierStatus, 'blocked');
  assert.equal(result.reasons[0].dossierReason, 'REVISION_BRIDGE_GOLDEN_SET_HASH_MISMATCH');
});

test('Contour 12D propagates blocked admission gate state', async () => {
  const bridge = await loadBridge();
  const result = bridge.evaluateRevisionBridgeReleaseClaimModeDecisionGate(validDecisionInput(bridge, {
    admission: validAdmission({
      claimScope: ['textExact', 'structuralManual'],
    }),
  }));

  assert.equal(result.ok, false);
  assert.equal(result.status, 'blocked');
  assert.equal(result.reason, 'REVISION_BRIDGE_RELEASE_CLAIM_MODE_DECISION_ADMISSION_BLOCKED');
  assert.equal(result.reasons[0].admissionStatus, 'blocked');
  assert.equal(result.reasons[0].admissionReason, 'REVISION_BRIDGE_RELEASE_CLAIM_ADMISSION_SCOPE_NOT_COVERED');
});

test('Contour 12D blocks RELEASE_MODE when required release fields are missing', async () => {
  const bridge = await loadBridge();
  const result = bridge.evaluateRevisionBridgeReleaseClaimModeDecisionGate(validDecisionInput(bridge, {
    mode: 'RELEASE_MODE',
    releaseEvidenceId: '',
    outputHash: '',
    claimId: '',
  }));

  assert.equal(result.ok, false);
  assert.equal(result.status, 'blocked');
  assert.equal(result.reason, 'REVISION_BRIDGE_RELEASE_CLAIM_MODE_DECISION_RELEASE_FIELDS_MISSING');
  assert.deepEqual(
    result.reasons[0].missingReleaseFields,
    ['releaseEvidenceId', 'outputHash', 'claimId'],
  );
});

test('Contour 12D blocks when baseline debt is true', async () => {
  const bridge = await loadBridge();
  const result = bridge.evaluateRevisionBridgeReleaseClaimModeDecisionGate(validDecisionInput(bridge, {
    baselineDebtFlag: true,
  }));

  assert.equal(result.ok, false);
  assert.equal(result.status, 'blocked');
  assert.equal(result.reason, 'REVISION_BRIDGE_RELEASE_CLAIM_MODE_DECISION_ADMISSION_BLOCKED');
  assert.equal(result.reasons[0].admissionReason, 'REVISION_BRIDGE_RELEASE_CLAIM_ADMISSION_BASELINE_DEBT_BLOCKED');
});

test('Contour 12D accepts PR_MODE when 12B and 12C pass', async () => {
  const bridge = await loadBridge();
  const result = bridge.evaluateRevisionBridgeReleaseClaimModeDecisionGate(validDecisionInput(bridge, {
    mode: 'PR_MODE',
  }));

  assert.equal(result.ok, true);
  assert.equal(result.status, 'accepted');
  assert.equal(result.code, 'REVISION_BRIDGE_RELEASE_CLAIM_MODE_DECISION_ACCEPTED');
  assert.deepEqual(result.reasons, []);
  assert.equal(result.binding.mode, 'PR_MODE');
  assert.equal(result.summary.dossierGate.status, 'accepted');
  assert.equal(result.summary.admissionGate.status, 'accepted');
});

test('Contour 12D accepts RELEASE_MODE only with required release fields and accepted 12B plus 12C', async () => {
  const bridge = await loadBridge();
  const result = bridge.evaluateRevisionBridgeReleaseClaimModeDecisionGate(validDecisionInput(bridge, {
    mode: 'RELEASE_MODE',
  }));

  assert.equal(result.ok, true);
  assert.equal(result.status, 'accepted');
  assert.equal(result.code, 'REVISION_BRIDGE_RELEASE_CLAIM_MODE_DECISION_ACCEPTED');
  assert.deepEqual(result.summary.missingReleaseFields, []);
  assert.equal(result.binding.mode, 'RELEASE_MODE');
});

test('Contour 12D mode decision gate is deterministic', async () => {
  const bridge = await loadBridge();
  const input = validDecisionInput(bridge, {
    mode: 'RELEASE_MODE',
  });

  const first = bridge.evaluateRevisionBridgeReleaseClaimModeDecisionGate(input);
  const second = bridge.evaluateRevisionBridgeReleaseClaimModeDecisionGate(input);

  assert.deepEqual(first, second);
});

test('Contour 12D mode decision gate is non-mutating', async () => {
  const bridge = await loadBridge();
  const input = validDecisionInput(bridge, {
    mode: 'RELEASE_MODE',
  });
  const before = deepClone(input);

  bridge.evaluateRevisionBridgeReleaseClaimModeDecisionGate(input);

  assert.deepEqual(input, before);
});

test('Contour 12D source section stays kernel-only and free of wiring drift tokens', () => {
  const source = fs.readFileSync(path.join(REPO_ROOT, MODULE_PATH), 'utf8');
  const start = source.indexOf('// CONTOUR_12D_RELEASE_CLAIM_MODE_DECISION_GATE_START');
  const end = source.indexOf('// CONTOUR_12D_RELEASE_CLAIM_MODE_DECISION_GATE_END');

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

test('Contour 12D changed-files allowlist guard passes in clean or dirty trees', () => {
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

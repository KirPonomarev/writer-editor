const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MODULE_PATH = 'src/io/revisionBridge/index.mjs';
const TEST_PATH = 'test/contracts/revision-bridge-release-claim-admission-gate.contract.test.js';
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
      {
        rowId: 'word-comment-only',
        formatId: 'word',
        surface: ['commentAnchor'],
        requiredTests: ['rb12-word-comment'],
        goldenSetId: 'golden-word-comments-v1',
      },
    ],
  };
}

function validGoldenSet(overrides = {}) {
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
    ...overrides,
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

function validDossierGateInput(bridge, overrides = {}) {
  return {
    formatMatrix: overrides.formatMatrix || validFormatMatrix(),
    dossier: overrides.dossier || validDossier(bridge),
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

function acceptedDossierResult(bridge, overrides = {}) {
  const result = bridge.evaluateRevisionBridgeReleaseClaimDossierGate(validDossierGateInput(bridge, overrides));
  assert.equal(result.ok, true);
  return result;
}

function validDossierPayload(bridge, overrides = {}) {
  return {
    dossierResult: overrides.dossierResult || acceptedDossierResult(bridge),
    claimClasses: overrides.claimClasses || ['textual', 'commentary'],
    baselineDebtFlag: overrides.baselineDebtFlag === true,
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

test('Contour 12C exports release claim admission schema and evaluator', async () => {
  const bridge = await loadBridge();

  assert.equal(
    bridge.REVISION_BRIDGE_RELEASE_CLAIM_ADMISSION_SCHEMA,
    'revision-bridge.release-claim-admission.v1',
  );
  assert.equal(typeof bridge.evaluateRevisionBridgeReleaseClaimAdmissionGate, 'function');
  assert.equal(
    bridge.REVISION_BRIDGE_RELEASE_CLAIM_ADMISSION_REASON_CODES.includes(
      'REVISION_BRIDGE_RELEASE_CLAIM_ADMISSION_DOSSIER_MISSING',
    ),
    true,
  );
  assert.equal(
    bridge.REVISION_BRIDGE_RELEASE_CLAIM_ADMISSION_REASON_CODES.includes(
      'REVISION_BRIDGE_RELEASE_CLAIM_ADMISSION_REQUIRED_CLASSES_MISSING',
    ),
    true,
  );
  assert.equal(
    bridge.REVISION_BRIDGE_RELEASE_CLAIM_ADMISSION_REASON_CODES.includes(
      'REVISION_BRIDGE_RELEASE_CLAIM_ADMISSION_DOSSIER_PROVENANCE_INVALID',
    ),
    true,
  );
});

test('Contour 12C blocks when dossier payload is missing', async () => {
  const bridge = await loadBridge();
  const result = bridge.evaluateRevisionBridgeReleaseClaimAdmissionGate(validAdmission());

  assert.equal(result.ok, false);
  assert.equal(result.status, 'blocked');
  assert.equal(result.code, 'E_REVISION_BRIDGE_RELEASE_CLAIM_ADMISSION_BLOCKED');
  assert.equal(result.reason, 'REVISION_BRIDGE_RELEASE_CLAIM_ADMISSION_DOSSIER_MISSING');
});

test('Contour 12C blocks when dossier status is blocked', async () => {
  const bridge = await loadBridge();
  const blockedDossierResult = bridge.evaluateRevisionBridgeReleaseClaimDossierGate(validDossierGateInput(bridge, {
    dossier: validDossier(bridge, {
      items: [
        validDossierItem(bridge, {
          claim: validClaim(bridge, validGoldenSet(), {
            goldenSetHash: 'rbgs_wrong_hash',
          }),
        }),
      ],
    }),
  }));
  const result = bridge.evaluateRevisionBridgeReleaseClaimAdmissionGate(
    validAdmission(),
    validDossierPayload(bridge, {
      dossierResult: blockedDossierResult,
    }),
  );

  assert.equal(result.ok, false);
  assert.equal(result.status, 'blocked');
  assert.equal(result.reason, 'REVISION_BRIDGE_RELEASE_CLAIM_ADMISSION_DOSSIER_BLOCKED');
  assert.equal(result.reasons[0].dossierStatus, 'blocked');
});

test('Contour 12C blocks synthetic accepted dossier payloads without 12B provenance', async () => {
  const bridge = await loadBridge();
  const result = bridge.evaluateRevisionBridgeReleaseClaimAdmissionGate(
    validAdmission(),
    validDossierPayload(bridge, {
      dossierResult: {
        status: 'accepted',
        binding: {
          dossierId: '',
          itemIds: [],
        },
        itemEvaluations: [],
      },
    }),
  );

  assert.equal(result.ok, false);
  assert.equal(result.status, 'blocked');
  assert.equal(result.reason, 'REVISION_BRIDGE_RELEASE_CLAIM_ADMISSION_DOSSIER_PROVENANCE_INVALID');
  assert.equal(
    result.reasons.some((reason) => reason.field === 'dossierResult.type'),
    true,
  );
  assert.equal(
    result.reasons.some((reason) => reason.field === 'dossierResult.binding.itemIds'),
    true,
  );
});

test('Contour 12C blocks malformed dossier item evaluations even when dossier status says accepted', async () => {
  const bridge = await loadBridge();
  const dossierResult = acceptedDossierResult(bridge);
  const malformedItemEvaluations = deepClone(dossierResult.itemEvaluations);
  malformedItemEvaluations[0].ok = false;
  malformedItemEvaluations[0].status = 'blocked';
  malformedItemEvaluations[0].type = 'syntheticGate';
  malformedItemEvaluations[0].code = 'SYNTHETIC_ACCEPTED';

  const result = bridge.evaluateRevisionBridgeReleaseClaimAdmissionGate(
    validAdmission(),
    validDossierPayload(bridge, {
      dossierResult: {
        ...deepClone(dossierResult),
        itemEvaluations: malformedItemEvaluations,
      },
    }),
  );

  assert.equal(result.ok, false);
  assert.equal(result.status, 'blocked');
  assert.equal(result.reason, 'REVISION_BRIDGE_RELEASE_CLAIM_ADMISSION_DOSSIER_PROVENANCE_INVALID');
  assert.equal(
    result.reasons.some((reason) => reason.field === 'dossierResult.itemEvaluations.0.ok'),
    true,
  );
  assert.equal(
    result.reasons.some((reason) => reason.field === 'dossierResult.itemEvaluations.0.type'),
    true,
  );
  assert.equal(
    result.reasons.some((reason) => reason.field === 'dossierResult.itemEvaluations.0.code'),
    true,
  );
});

test('Contour 12C blocks when claim scope is not covered by dossier scope', async () => {
  const bridge = await loadBridge();
  const result = bridge.evaluateRevisionBridgeReleaseClaimAdmissionGate(
    validAdmission({
      claimScope: ['textExact', 'structuralManual'],
    }),
    validDossierPayload(bridge),
  );

  assert.equal(result.ok, false);
  assert.equal(result.status, 'blocked');
  assert.equal(result.reason, 'REVISION_BRIDGE_RELEASE_CLAIM_ADMISSION_SCOPE_NOT_COVERED');
  assert.deepEqual(result.reasons[0].coveredScope, ['commentAnchor', 'textExact']);
  assert.deepEqual(result.reasons[0].uncoveredScope, ['structuralManual']);
});

test('Contour 12C blocks when required claim classes are missing', async () => {
  const bridge = await loadBridge();
  const result = bridge.evaluateRevisionBridgeReleaseClaimAdmissionGate(
    validAdmission({
      requiredClaimClasses: ['textual', 'structural'],
    }),
    validDossierPayload(bridge, {
      claimClasses: ['textual'],
    }),
  );

  assert.equal(result.ok, false);
  assert.equal(result.status, 'blocked');
  assert.equal(result.reason, 'REVISION_BRIDGE_RELEASE_CLAIM_ADMISSION_REQUIRED_CLASSES_MISSING');
  assert.deepEqual(result.reasons[0].missingClaimClasses, ['structural']);
});

test('Contour 12C returns diagnostics for malformed admission input', async () => {
  const bridge = await loadBridge();
  const result = bridge.evaluateRevisionBridgeReleaseClaimAdmissionGate(
    {
      schemaVersion: 'revision-bridge.release-claim-admission.v0',
      claimId: '',
      claimScope: [''],
      requiredClaimClasses: 'textual',
    },
    validDossierPayload(bridge),
  );

  assert.equal(result.ok, false);
  assert.equal(result.status, 'diagnostics');
  assert.equal(result.code, 'E_REVISION_BRIDGE_RELEASE_CLAIM_ADMISSION_DIAGNOSTICS');
  assert.equal(
    result.reasons.some((reason) => reason.field === 'admission.schemaVersion'),
    true,
  );
  assert.equal(
    result.reasons.some((reason) => reason.field === 'admission.claimId'),
    true,
  );
  assert.equal(
    result.reasons.some((reason) => reason.field.startsWith('admission.claimScope')),
    true,
  );
});

test('Contour 12C blocks when baselineDebtFlag is true', async () => {
  const bridge = await loadBridge();
  const result = bridge.evaluateRevisionBridgeReleaseClaimAdmissionGate(
    validAdmission(),
    validDossierPayload(bridge, {
      baselineDebtFlag: true,
    }),
  );

  assert.equal(result.ok, false);
  assert.equal(result.status, 'blocked');
  assert.equal(result.reason, 'REVISION_BRIDGE_RELEASE_CLAIM_ADMISSION_BASELINE_DEBT_BLOCKED');
  assert.equal(result.reasons[0].baselineDebtFlag, true);
});

test('Contour 12C accepts only when dossier status, scope, classes, and debt checks all pass', async () => {
  const bridge = await loadBridge();
  const result = bridge.evaluateRevisionBridgeReleaseClaimAdmissionGate(
    validAdmission({
      claimScope: ['commentAnchor', 'textExact'],
      requiredClaimClasses: ['commentary', 'textual'],
    }),
    validDossierPayload(bridge, {
      claimClasses: ['commentary', 'textual'],
    }),
  );

  assert.equal(result.ok, true);
  assert.equal(result.status, 'accepted');
  assert.equal(result.code, 'REVISION_BRIDGE_RELEASE_CLAIM_ADMISSION_ACCEPTED');
  assert.deepEqual(result.reasons, []);
  assert.deepEqual(result.binding.coveredScope, ['commentAnchor', 'textExact']);
});

test('Contour 12C admission gate is deterministic and non-mutating', async () => {
  const bridge = await loadBridge();
  const admission = validAdmission({
    claimScope: ['commentAnchor', 'textExact'],
    requiredClaimClasses: ['commentary', 'textual'],
  });
  const dossierPayload = validDossierPayload(bridge, {
    claimClasses: ['commentary', 'textual'],
  });
  const admissionBefore = deepClone(admission);
  const dossierBefore = deepClone(dossierPayload);

  const first = bridge.evaluateRevisionBridgeReleaseClaimAdmissionGate(admission, dossierPayload);
  const second = bridge.evaluateRevisionBridgeReleaseClaimAdmissionGate(admission, dossierPayload);

  assert.deepEqual(first, second);
  assert.deepEqual(admission, admissionBefore);
  assert.deepEqual(dossierPayload, dossierBefore);
});

test('Contour 12C source section stays kernel-only and free of wiring drift tokens', () => {
  const source = fs.readFileSync(path.join(REPO_ROOT, MODULE_PATH), 'utf8');
  const start = source.indexOf('// CONTOUR_12C_RELEASE_CLAIM_ADMISSION_GATE_START');
  const end = source.indexOf('// CONTOUR_12C_RELEASE_CLAIM_ADMISSION_GATE_END');

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

test('Contour 12C changed-files allowlist guard passes in clean or dirty trees', () => {
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

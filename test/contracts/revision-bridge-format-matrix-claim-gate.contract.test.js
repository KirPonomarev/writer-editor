const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MODULE_PATH = 'src/io/revisionBridge/index.mjs';
const TEST_PATH = 'test/contracts/revision-bridge-format-matrix-claim-gate.contract.test.js';
const ALLOWLIST = [MODULE_PATH, TEST_PATH];

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
      {
        fixtureId: 'fixture-word-comment',
        digest: 'sha256:fixture-word-comment',
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

function validGateInput(bridge, overrides = {}) {
  const formatMatrix = overrides.formatMatrix || validFormatMatrix();
  const goldenSet = overrides.goldenSet || validGoldenSet();
  const claim = overrides.claim || validClaim(bridge, goldenSet);
  return {
    formatMatrix,
    goldenSet,
    claim,
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

test('Contour 12A exports format matrix claim gate contracts', async () => {
  const bridge = await loadBridge();

  assert.equal(
    bridge.REVISION_BRIDGE_FORMAT_MATRIX_SCHEMA,
    'revision-bridge.format-matrix.v1',
  );
  assert.equal(
    bridge.REVISION_BRIDGE_GOLDEN_SET_SCHEMA,
    'revision-bridge.golden-set.v1',
  );
  assert.equal(
    bridge.REVISION_BRIDGE_FORMAT_MATRIX_SUPPORT_CLAIM_SCHEMA,
    'revision-bridge.format-matrix-support-claim.v1',
  );
  assert.equal(typeof bridge.createRevisionBridgeGoldenSetHash, 'function');
  assert.equal(typeof bridge.evaluateRevisionBridgeFormatMatrixClaimGate, 'function');
  assert.equal(
    bridge.REVISION_BRIDGE_FORMAT_MATRIX_CLAIM_GATE_REASON_CODES.includes('REVISION_BRIDGE_FORMAT_MATRIX_ROW_MISSING'),
    true,
  );
  assert.equal(
    bridge.REVISION_BRIDGE_FORMAT_MATRIX_CLAIM_GATE_REASON_CODES.includes('REVISION_BRIDGE_GOLDEN_SET_HASH_MISMATCH'),
    true,
  );
});

test('Contour 12A blocks when matrix row is missing', async () => {
  const bridge = await loadBridge();
  const result = bridge.evaluateRevisionBridgeFormatMatrixClaimGate(validGateInput(bridge, {
    claim: validClaim(bridge, validGoldenSet(), {
      matrixRowId: 'missing-row',
    }),
  }));

  assert.equal(result.ok, false);
  assert.equal(result.status, 'blocked');
  assert.equal(result.code, 'E_REVISION_BRIDGE_FORMAT_MATRIX_CLAIM_BLOCKED');
  assert.equal(result.reason, 'REVISION_BRIDGE_FORMAT_MATRIX_ROW_MISSING');
  assert.equal(result.reasons[0].field, 'claim.matrixRowId');
});

test('Contour 12A blocks when golden set hash does not match', async () => {
  const bridge = await loadBridge();
  const goldenSet = validGoldenSet();
  const result = bridge.evaluateRevisionBridgeFormatMatrixClaimGate(validGateInput(bridge, {
    goldenSet,
    claim: validClaim(bridge, goldenSet, {
      goldenSetHash: 'rbgs_wrong_hash',
    }),
  }));

  assert.equal(result.ok, false);
  assert.equal(result.status, 'blocked');
  assert.equal(result.reason, 'REVISION_BRIDGE_GOLDEN_SET_HASH_MISMATCH');
  assert.equal(result.reasons.some((reason) => reason.code === 'REVISION_BRIDGE_GOLDEN_SET_HASH_MISMATCH'), true);
  assert.equal(result.binding.goldenSetHash, bridge.createRevisionBridgeGoldenSetHash(goldenSet));
});

test('Contour 12A blocks when required tests are missing', async () => {
  const bridge = await loadBridge();
  const goldenSet = validGoldenSet();
  const result = bridge.evaluateRevisionBridgeFormatMatrixClaimGate(validGateInput(bridge, {
    goldenSet,
    claim: validClaim(bridge, goldenSet, {
      verifiedTests: ['rb12-word-text'],
    }),
  }));

  assert.equal(result.ok, false);
  assert.equal(result.status, 'blocked');
  assert.equal(result.reason, 'REVISION_BRIDGE_FORMAT_MATRIX_REQUIRED_TESTS_MISSING');
  assert.deepEqual(result.reasons[0].missingTests, ['rb12-golden-hash', 'rb12-word-comment']);
});

test('Contour 12A blocks when claim scope exceeds matrix surface', async () => {
  const bridge = await loadBridge();
  const goldenSet = validGoldenSet();
  const result = bridge.evaluateRevisionBridgeFormatMatrixClaimGate(validGateInput(bridge, {
    goldenSet,
    claim: validClaim(bridge, goldenSet, {
      claimScope: ['textExact', 'commentAnchor', 'structuralManual'],
    }),
  }));

  assert.equal(result.ok, false);
  assert.equal(result.status, 'blocked');
  assert.equal(result.reason, 'REVISION_BRIDGE_FORMAT_MATRIX_CLAIM_SCOPE_EXCEEDS_SURFACE');
  assert.deepEqual(result.reasons[0].unsupportedScope, ['structuralManual']);
  assert.deepEqual(result.reasons[0].allowedSurface, ['textExact', 'commentAnchor']);
});

test('Contour 12A returns diagnostics for malformed input', async () => {
  const bridge = await loadBridge();
  const result = bridge.evaluateRevisionBridgeFormatMatrixClaimGate({
    formatMatrix: {
      schemaVersion: 'revision-bridge.format-matrix.v1',
      matrixId: '',
      rows: [
        {
          rowId: '',
          formatId: '',
          surface: [''],
          requiredTests: [],
          goldenSetId: '',
        },
      ],
    },
    goldenSet: {
      schemaVersion: 'revision-bridge.golden-set.v1',
      goldenSetId: '',
      formatId: '',
      surface: [],
      requiredTests: [],
      fixtures: [{ fixtureId: '', digest: '' }],
    },
    claim: {
      schemaVersion: 'revision-bridge.format-matrix-support-claim.v1',
      claimId: '',
      matrixRowId: '',
      claimScope: [''],
      verifiedTests: [],
      goldenSetHash: '',
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 'blocked');
  assert.equal(result.code, 'E_REVISION_BRIDGE_FORMAT_MATRIX_CLAIM_BLOCKED');
  assert.equal(result.reasons.length > 0, true);
  assert.equal(result.reasons.some((reason) => reason.code === 'REVISION_BRIDGE_FORMAT_MATRIX_INVALID'), true);
  assert.equal(result.reasons.some((reason) => reason.code === 'REVISION_BRIDGE_GOLDEN_SET_INVALID'), true);
  assert.equal(result.reasons.some((reason) => reason.code === 'REVISION_BRIDGE_FORMAT_MATRIX_CLAIM_INVALID'), true);
});

test('Contour 12A accepts matched matrix row, golden set hash, scope, and tests', async () => {
  const bridge = await loadBridge();
  const goldenSet = validGoldenSet();
  const result = bridge.evaluateRevisionBridgeFormatMatrixClaimGate(validGateInput(bridge, {
    goldenSet,
    claim: validClaim(bridge, goldenSet),
  }));

  assert.equal(result.ok, true);
  assert.equal(result.type, 'revisionBridge.formatMatrixClaimGate');
  assert.equal(result.status, 'accepted');
  assert.equal(result.code, 'REVISION_BRIDGE_FORMAT_MATRIX_CLAIM_ACCEPTED');
  assert.equal(result.reason, 'REVISION_BRIDGE_FORMAT_MATRIX_CLAIM_ACCEPTED');
  assert.deepEqual(result.reasons, []);
  assert.deepEqual(result.binding.surface, ['textExact', 'commentAnchor']);
  assert.deepEqual(result.binding.claimScope, ['textExact', 'commentAnchor']);
  assert.deepEqual(result.binding.requiredTests, [
    'rb12-golden-hash',
    'rb12-word-comment',
    'rb12-word-text',
  ]);
});

test('Contour 12A claim gate is deterministic and non-mutating', async () => {
  const bridge = await loadBridge();
  const goldenSet = validGoldenSet();
  const input = validGateInput(bridge, {
    goldenSet,
    claim: validClaim(bridge, goldenSet),
  });
  const before = deepClone(input);

  const first = bridge.evaluateRevisionBridgeFormatMatrixClaimGate(input);
  const second = bridge.evaluateRevisionBridgeFormatMatrixClaimGate(input);

  assert.deepEqual(first, second);
  assert.deepEqual(input, before);
});

test('Contour 12A source section stays kernel-only and free of wiring drift tokens', () => {
  const source = fs.readFileSync(path.join(REPO_ROOT, MODULE_PATH), 'utf8');
  const start = source.indexOf('// CONTOUR_12_FORMAT_MATRIX_CLAIM_GATE_START');
  const end = source.indexOf('// CONTOUR_12_FORMAT_MATRIX_CLAIM_GATE_END');

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

test('Contour 12A changed files stay inside the contour allowlist', () => {
  const status = execFileSync('git', ['status', '--porcelain', '-uall'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  const changedFiles = changedFilesFromGitStatus(status);

  assert.deepEqual(changedFilesOutsideAllowlist(changedFiles), []);
});

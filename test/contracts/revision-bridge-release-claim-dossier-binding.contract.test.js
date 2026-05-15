const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MODULE_PATH = 'src/io/revisionBridge/index.mjs';
const TEST_PATH = 'test/contracts/revision-bridge-release-claim-dossier-binding.contract.test.js';
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
        rowId: 'word-comments-only',
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
      {
        fixtureId: 'fixture-word-comment',
        digest: 'sha256:fixture-word-comment',
      },
    ],
    ...overrides,
  };
}

function validCommentOnlyGoldenSet(overrides = {}) {
  return validGoldenSet({
    goldenSetId: 'golden-word-comments-v1',
    surface: ['commentAnchor'],
    fixtures: [
      {
        fixtureId: 'fixture-word-comment-only',
        digest: 'sha256:fixture-word-comment-only',
      },
    ],
    ...overrides,
  });
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

function validCommentOnlyClaim(bridge, goldenSet, overrides = {}) {
  return validClaim(bridge, goldenSet, {
    claimId: 'claim-2',
    matrixRowId: 'word-comments-only',
    claimScope: ['commentAnchor'],
    verifiedTests: ['rb12-word-comment', 'rb12-golden-hash'],
    ...overrides,
  });
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

function validCommentOnlyDossierItem(bridge, overrides = {}) {
  const goldenSet = overrides.goldenSet || validCommentOnlyGoldenSet();
  const claim = overrides.claim || validCommentOnlyClaim(bridge, goldenSet);
  return {
    schemaVersion: 'revision-bridge.release-claim-dossier-item.v1',
    itemId: 'dossier-item-2',
    goldenSet,
    claim,
    ...overrides,
  };
}

function validDossier(bridge, overrides = {}) {
  return {
    schemaVersion: 'revision-bridge.release-claim-dossier.v1',
    dossierId: 'release-claim-dossier-1',
    items: [
      validDossierItem(bridge),
    ],
    ...overrides,
  };
}

function validGateInput(bridge, overrides = {}) {
  return {
    formatMatrix: overrides.formatMatrix || validFormatMatrix(),
    dossier: overrides.dossier || validDossier(bridge),
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

test('Contour 12B exports release claim dossier contracts and evaluator', async () => {
  const bridge = await loadBridge();

  assert.equal(
    bridge.REVISION_BRIDGE_RELEASE_CLAIM_DOSSIER_SCHEMA,
    'revision-bridge.release-claim-dossier.v1',
  );
  assert.equal(
    bridge.REVISION_BRIDGE_RELEASE_CLAIM_DOSSIER_ITEM_SCHEMA,
    'revision-bridge.release-claim-dossier-item.v1',
  );
  assert.equal(typeof bridge.evaluateRevisionBridgeReleaseClaimDossierGate, 'function');
  assert.equal(
    bridge.REVISION_BRIDGE_RELEASE_CLAIM_DOSSIER_GATE_REASON_CODES.includes(
      'REVISION_BRIDGE_RELEASE_CLAIM_DOSSIER_ITEMS_REQUIRED',
    ),
    true,
  );
  assert.equal(
    bridge.REVISION_BRIDGE_RELEASE_CLAIM_DOSSIER_GATE_REASON_CODES.includes(
      'REVISION_BRIDGE_RELEASE_CLAIM_DOSSIER_ITEM_ID_DUPLICATE',
    ),
    true,
  );
  assert.equal(
    bridge.REVISION_BRIDGE_RELEASE_CLAIM_DOSSIER_GATE_REASON_CODES.includes(
      'REVISION_BRIDGE_FORMAT_MATRIX_ROW_MISSING',
    ),
    true,
  );
});

test('Contour 12B blocks with diagnostics when dossier items are missing', async () => {
  const bridge = await loadBridge();
  const result = bridge.evaluateRevisionBridgeReleaseClaimDossierGate(validGateInput(bridge, {
    dossier: {
      schemaVersion: 'revision-bridge.release-claim-dossier.v1',
      dossierId: 'release-claim-dossier-1',
    },
  }));

  assert.equal(result.ok, false);
  assert.equal(result.status, 'diagnostics');
  assert.equal(result.code, 'E_REVISION_BRIDGE_RELEASE_CLAIM_DOSSIER_DIAGNOSTICS');
  assert.equal(result.reason, 'REVISION_BRIDGE_RELEASE_CLAIM_DOSSIER_ITEMS_REQUIRED');
  assert.deepEqual(result.itemEvaluations, []);
});

test('Contour 12B blocks when a dossier item references a missing matrix row', async () => {
  const bridge = await loadBridge();
  const goldenSet = validGoldenSet();
  const result = bridge.evaluateRevisionBridgeReleaseClaimDossierGate(validGateInput(bridge, {
    dossier: validDossier(bridge, {
      items: [
        validDossierItem(bridge, {
          claim: validClaim(bridge, goldenSet, {
            matrixRowId: 'missing-row',
          }),
        }),
      ],
    }),
  }));

  assert.equal(result.ok, false);
  assert.equal(result.status, 'blocked');
  assert.equal(result.code, 'E_REVISION_BRIDGE_RELEASE_CLAIM_DOSSIER_BLOCKED');
  assert.equal(result.reason, 'REVISION_BRIDGE_FORMAT_MATRIX_ROW_MISSING');
  assert.equal(result.reasons[0].field, 'dossier.items.0.claim.matrixRowId');
});

test('Contour 12B blocks when dossier itemId is duplicated', async () => {
  const bridge = await loadBridge();
  const result = bridge.evaluateRevisionBridgeReleaseClaimDossierGate(validGateInput(bridge, {
    dossier: validDossier(bridge, {
      items: [
        validDossierItem(bridge),
        validCommentOnlyDossierItem(bridge, {
          itemId: 'dossier-item-1',
        }),
      ],
    }),
  }));

  assert.equal(result.ok, false);
  assert.equal(result.status, 'blocked');
  assert.equal(result.code, 'E_REVISION_BRIDGE_RELEASE_CLAIM_DOSSIER_BLOCKED');
  assert.equal(result.reason, 'REVISION_BRIDGE_RELEASE_CLAIM_DOSSIER_ITEM_ID_DUPLICATE');
  assert.equal(result.reasons[0].field, 'dossier.items.1.itemId');
  assert.equal(result.reasons[0].itemId, 'dossier-item-1');
  assert.deepEqual(result.itemEvaluations, []);
});

test('Contour 12B blocks when a dossier item golden set hash does not match', async () => {
  const bridge = await loadBridge();
  const goldenSet = validGoldenSet();
  const result = bridge.evaluateRevisionBridgeReleaseClaimDossierGate(validGateInput(bridge, {
    dossier: validDossier(bridge, {
      items: [
        validDossierItem(bridge, {
          goldenSet,
          claim: validClaim(bridge, goldenSet, {
            goldenSetHash: 'rbgs_wrong_hash',
          }),
        }),
      ],
    }),
  }));

  assert.equal(result.ok, false);
  assert.equal(result.status, 'blocked');
  assert.equal(result.reason, 'REVISION_BRIDGE_GOLDEN_SET_HASH_MISMATCH');
  assert.equal(result.reasons[0].field, 'dossier.items.0.claim.goldenSetHash');
});

test('Contour 12B blocks when a dossier item is missing required tests', async () => {
  const bridge = await loadBridge();
  const goldenSet = validGoldenSet();
  const result = bridge.evaluateRevisionBridgeReleaseClaimDossierGate(validGateInput(bridge, {
    dossier: validDossier(bridge, {
      items: [
        validDossierItem(bridge, {
          goldenSet,
          claim: validClaim(bridge, goldenSet, {
            verifiedTests: ['rb12-word-text'],
          }),
        }),
      ],
    }),
  }));

  assert.equal(result.ok, false);
  assert.equal(result.status, 'blocked');
  assert.equal(result.reason, 'REVISION_BRIDGE_FORMAT_MATRIX_REQUIRED_TESTS_MISSING');
  assert.deepEqual(result.reasons[0].missingTests, ['rb12-golden-hash', 'rb12-word-comment']);
});

test('Contour 12B blocks when a dossier item scope exceeds the declared surface', async () => {
  const bridge = await loadBridge();
  const goldenSet = validGoldenSet();
  const result = bridge.evaluateRevisionBridgeReleaseClaimDossierGate(validGateInput(bridge, {
    dossier: validDossier(bridge, {
      items: [
        validDossierItem(bridge, {
          goldenSet,
          claim: validClaim(bridge, goldenSet, {
            claimScope: ['textExact', 'commentAnchor', 'structuralManual'],
          }),
        }),
      ],
    }),
  }));

  assert.equal(result.ok, false);
  assert.equal(result.status, 'blocked');
  assert.equal(result.reason, 'REVISION_BRIDGE_FORMAT_MATRIX_CLAIM_SCOPE_EXCEEDS_SURFACE');
  assert.deepEqual(result.reasons[0].unsupportedScope, ['structuralManual']);
  assert.deepEqual(result.reasons[0].allowedSurface, ['textExact', 'commentAnchor']);
});

test('Contour 12B blocks the whole dossier when accepted and blocked items are mixed', async () => {
  const bridge = await loadBridge();
  const acceptedItem = validDossierItem(bridge);
  const blockedGoldenSet = validGoldenSet();
  const blockedItem = validDossierItem(bridge, {
    itemId: 'dossier-item-2',
    goldenSet: blockedGoldenSet,
    claim: validClaim(bridge, blockedGoldenSet, {
      goldenSetHash: 'rbgs_wrong_hash',
    }),
  });
  const result = bridge.evaluateRevisionBridgeReleaseClaimDossierGate(validGateInput(bridge, {
    dossier: validDossier(bridge, {
      items: [acceptedItem, blockedItem],
    }),
  }));

  assert.equal(result.ok, false);
  assert.equal(result.status, 'blocked');
  assert.equal(result.summary.totalItems, 2);
  assert.equal(result.summary.acceptedItems, 1);
  assert.equal(result.summary.blockedItems, 1);
  assert.equal(result.itemEvaluations[0].status, 'accepted');
  assert.equal(result.itemEvaluations[1].status, 'blocked');
});

test('Contour 12B returns diagnostics for malformed dossier input', async () => {
  const bridge = await loadBridge();
  const result = bridge.evaluateRevisionBridgeReleaseClaimDossierGate({
    formatMatrix: validFormatMatrix(),
    dossier: {
      schemaVersion: 'revision-bridge.release-claim-dossier.v0',
      dossierId: '',
      items: [
        {
          schemaVersion: 'revision-bridge.release-claim-dossier-item.v0',
          itemId: '',
          claim: null,
          goldenSet: null,
        },
      ],
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 'diagnostics');
  assert.equal(result.code, 'E_REVISION_BRIDGE_RELEASE_CLAIM_DOSSIER_DIAGNOSTICS');
  assert.equal(
    result.reasons.some((reason) => reason.code === 'REVISION_BRIDGE_RELEASE_CLAIM_DOSSIER_INVALID'),
    true,
  );
  assert.equal(
    result.reasons.some((reason) => reason.code === 'REVISION_BRIDGE_RELEASE_CLAIM_DOSSIER_ITEM_INVALID'),
    true,
  );
});

test('Contour 12B accepts a dossier only when all items pass the reused 12A gate', async () => {
  const bridge = await loadBridge();
  const result = bridge.evaluateRevisionBridgeReleaseClaimDossierGate(validGateInput(bridge, {
    dossier: validDossier(bridge, {
      items: [
        validDossierItem(bridge),
        validCommentOnlyDossierItem(bridge),
      ],
    }),
  }));

  assert.equal(result.ok, true);
  assert.equal(result.status, 'accepted');
  assert.equal(result.code, 'REVISION_BRIDGE_RELEASE_CLAIM_DOSSIER_ACCEPTED');
  assert.deepEqual(result.reasons, []);
  assert.equal(result.summary.totalItems, 2);
  assert.equal(result.summary.acceptedItems, 2);
  assert.equal(result.summary.blockedItems, 0);
  assert.deepEqual(result.binding.itemIds, ['dossier-item-1', 'dossier-item-2']);
});

test('Contour 12B dossier gate is deterministic and non-mutating', async () => {
  const bridge = await loadBridge();
  const input = validGateInput(bridge, {
    dossier: validDossier(bridge, {
      items: [
        validDossierItem(bridge),
        validCommentOnlyDossierItem(bridge),
      ],
    }),
  });
  const before = deepClone(input);

  const first = bridge.evaluateRevisionBridgeReleaseClaimDossierGate(input);
  const second = bridge.evaluateRevisionBridgeReleaseClaimDossierGate(input);

  assert.deepEqual(first, second);
  assert.deepEqual(input, before);
});

test('Contour 12B source section stays kernel-only and free of wiring drift tokens', () => {
  const source = fs.readFileSync(path.join(REPO_ROOT, MODULE_PATH), 'utf8');
  const start = source.indexOf('// CONTOUR_12B_RELEASE_CLAIM_DOSSIER_GATE_START');
  const end = source.indexOf('// CONTOUR_12B_RELEASE_CLAIM_DOSSIER_GATE_END');

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

test('Contour 12B changed-files allowlist guard passes in clean or dirty trees', () => {
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

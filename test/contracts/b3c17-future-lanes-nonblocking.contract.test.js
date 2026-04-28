const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MODULE_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'b3c17-future-lanes-nonblocking-state.mjs');
const STATUS_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'STATUS', 'B3C17_FUTURE_LANES_NONBLOCKING_STATUS_V1.json');

let modulePromise = null;

function loadModule() {
  if (!modulePromise) modulePromise = import(pathToFileURL(MODULE_PATH).href);
  return modulePromise;
}

function readJson(targetPath) {
  return JSON.parse(fs.readFileSync(targetPath, 'utf8'));
}

function normalizeDynamicState(state) {
  return {
    ...state,
    repo: {
      ...state.repo,
      headSha: 'DYNAMIC_REPO_HEAD',
    },
  };
}

test('b3c17 future lanes: state artifact matches stable executable fields', async () => {
  const {
    evaluateB3C17FutureLanesNonblockingState,
    TOKEN_NAME,
    RELEASE_GREEN_TOKEN_NAME,
  } = await loadModule();
  const state = await evaluateB3C17FutureLanesNonblockingState({ repoRoot: REPO_ROOT });
  const committedState = readJson(STATUS_PATH);
  const normalizedCommitted = normalizeDynamicState(committedState);
  const normalizedState = normalizeDynamicState(state);

  assert.equal(committedState.artifactId, state.artifactId);
  assert.equal(committedState.contourId, state.contourId);
  assert.equal(committedState.status, state.status);
  assert.equal(committedState[TOKEN_NAME], state[TOKEN_NAME]);
  assert.equal(committedState[RELEASE_GREEN_TOKEN_NAME], state[RELEASE_GREEN_TOKEN_NAME]);
  assert.deepEqual(committedState.failRows, state.failRows);
  assert.deepEqual(committedState.b3c16InputRow, state.b3c16InputRow);
  assert.deepEqual(committedState.transitiveEvidenceRows, state.transitiveEvidenceRows);
  assert.deepEqual(committedState.laneRows, state.laneRows);
  assert.deepEqual(committedState.promotionCriteriaRows, state.promotionCriteriaRows);
  assert.deepEqual(committedState.nonblockingRows, state.nonblockingRows);
  assert.deepEqual(committedState.negativeRows, state.negativeRows);
  assert.deepEqual(committedState.scope, state.scope);
  assert.deepEqual(normalizedCommitted.repo, normalizedState.repo);
  assert.equal(committedState.runtime.changedBasenamesHash, state.runtime.changedBasenamesHash);
  assert.equal(Boolean(state.runtime.statusArtifactHash), true);
  assert.equal(state.ok, true, JSON.stringify(state, null, 2));
  assert.equal(state.status, 'PASS');
  assert.equal(state[TOKEN_NAME], 1);
  assert.equal(state[RELEASE_GREEN_TOKEN_NAME], 0);
  assert.deepEqual(state.failRows, []);
  assert.equal(state.repo.repoRootBinding, 'WORKTREE_INDEPENDENT');
});

test('b3c17 future lanes: CLI status remains worktree independent outside repo cwd', () => {
  const result = spawnSync(process.execPath, [MODULE_PATH], {
    cwd: os.tmpdir(),
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);

  const stdout = String(result.stdout || '');
  assert.match(stdout, /B3C17_STATUS=PASS/u);
  assert.match(stdout, /B3C17_FUTURE_LANES_NONBLOCKING_OK=1/u);
  assert.match(stdout, /B3C17_RELEASE_GREEN_OK=0/u);
});

test('b3c17 future lanes: binds B3C16 direct input and preserves limited rows', async () => {
  const { evaluateB3C17FutureLanesNonblockingState } = await loadModule();
  const state = await evaluateB3C17FutureLanesNonblockingState({ repoRoot: REPO_ROOT });

  assert.equal(state.b3c16InputRow.basename, 'B3C16_SUPPLY_CHAIN_RELEASE_SCOPE_STATUS_V1.json');
  assert.equal(state.b3c16InputRow.passed, true);
  assert.equal(state.b3c16InputRow.token, 1);
  assert.equal(state.b3c16InputRow.releaseGreen, 0);
  assert.equal(state.b3c16InputRow.noPackageBuild, true);
  assert.equal(state.b3c16InputRow.noPackageHash, true);
  assert.equal(state.b3c16InputRow.docxLibraryStatus, 'LIMITED_NONE_EXTERNAL_DOCX_LIB_CURRENTLY_DECLARED');
  assert.equal(state.proof.b3c16InputBound, true);
  assert.equal(state.proof.b3c16LimitsPreserved, true);
});

test('b3c17 future lanes: transitive B3C14 and B3C15 evidence remains release false', async () => {
  const { evaluateB3C17FutureLanesNonblockingState } = await loadModule();
  const state = await evaluateB3C17FutureLanesNonblockingState({ repoRoot: REPO_ROOT });
  const byBasename = new Map(state.transitiveEvidenceRows.map((row) => [row.basename, row]));

  assert.equal(byBasename.get('B3C14_RELEASE_DOSSIER_MINIMAL_STATUS_V1.json').passed, true);
  assert.equal(byBasename.get('B3C14_RELEASE_DOSSIER_MINIMAL_STATUS_V1.json').releaseGreen, 0);
  assert.equal(byBasename.get('B3C15_ATTESTATION_CHAIN_STATUS_V1.json').passed, true);
  assert.equal(byBasename.get('B3C15_ATTESTATION_CHAIN_STATUS_V1.json').releaseGreen, 0);
  assert.equal(state.proof.transitiveEvidencePass, true);
});

test('b3c17 future lanes: required lanes are parked nonblocking and author graph is optional derived', async () => {
  const { evaluateB3C17FutureLanesNonblockingState } = await loadModule();
  const state = await evaluateB3C17FutureLanesNonblockingState({ repoRoot: REPO_ROOT });
  const byId = new Map(state.laneRows.map((row) => [row.id, row]));

  assert.deepEqual([...byId.keys()].sort(), [
    'ADVANCED_TABLES_PARKED_NONBLOCKING',
    'AI_PARKED_NONBLOCKING_NO_REMOTE_MODEL',
    'AUTHOR_GRAPH_OPTIONAL_DERIVED_PARKED_NONBLOCKING',
    'COLLAB_PARKED_NONBLOCKING',
    'COMMENTS_PARKED_NONBLOCKING',
    'HISTORY_PARKED_NONBLOCKING',
    'MINDMAP_PARKED_NONBLOCKING',
    'MOBILE_PARKED_NONBLOCKING',
    'WEB_PARKED_NONBLOCKING',
  ]);
  for (const row of state.laneRows) {
    assert.equal(row.status, 'PARKED_NONBLOCKING', row.id);
    assert.equal(row.runtimeImplemented, false, row.id);
    assert.equal(row.blocksP0ReleaseKernel, false, row.id);
    assert.equal(row.authority, 'ADVISORY_UNTIL_PROMOTED', row.id);
  }
  assert.equal(byId.get('AUTHOR_GRAPH_OPTIONAL_DERIVED_PARKED_NONBLOCKING').optional, true);
  assert.equal(byId.get('AUTHOR_GRAPH_OPTIONAL_DERIVED_PARKED_NONBLOCKING').derivedOnly, true);
  assert.equal(byId.get('MINDMAP_PARKED_NONBLOCKING').derivedOnly, true);
  assert.equal(state.proof.allRequiredLanesParked, true);
  assert.equal(state.proof.optionalAuthorGraphDerivedParked, true);
});

test('b3c17 future lanes: minimal promotion criteria exist for every lane', async () => {
  const { evaluateB3C17FutureLanesNonblockingState } = await loadModule();
  const state = await evaluateB3C17FutureLanesNonblockingState({ repoRoot: REPO_ROOT });
  const byLane = new Map(state.promotionCriteriaRows.map((row) => [row.lane, row]));

  for (const lane of ['comments', 'history', 'collab', 'mindmap', 'ai', 'mobile', 'web', 'advancedTables', 'authorGraph']) {
    assert.equal(byLane.get(lane).status, 'PASS', lane);
    assert.ok(byLane.get(lane).criteria.length >= 3, lane);
  }
  assert.ok(byLane.get('comments').criteria.includes('stable block anchor model'));
  assert.ok(byLane.get('collab').criteria.includes('no network in MVP path'));
  assert.ok(byLane.get('ai').criteria.includes('no remote model call'));
  assert.ok(byLane.get('authorGraph').criteria.includes('derived graph only'));
  assert.equal(state.proof.promotionCriteriaComplete, true);
});

test('b3c17 future lanes: nonblocking governance rows pass', async () => {
  const { evaluateB3C17FutureLanesNonblockingState } = await loadModule();
  const state = await evaluateB3C17FutureLanesNonblockingState({ repoRoot: REPO_ROOT });
  const byId = new Map(state.nonblockingRows.map((row) => [row.id, row]));

  for (const id of [
    'NO_FUTURE_LANE_BLOCKS_P0_RELEASE_KERNEL',
    'PARKING_LOT_ADVISORY_ONLY',
    'ACTIVE_CANON_NOT_PROMOTED',
    'REQUIRED_TOKEN_SET_NOT_EXPANDED',
    'B3C16_LIMITED_SUPPLY_CHAIN_STATUS_PRESERVED',
    'NO_NEW_NETWORK_PATH_IN_B3C17_DIFF',
    'NO_REMOTE_AI_CALL',
    'NO_COLLAB_TRANSPORT',
    'NO_CANONICAL_STORAGE_REWRITE',
    'NO_NEW_DEPENDENCY',
    'PACKAGE_MANIFESTS_READ_ONLY',
    'RELEASE_GREEN_FALSE',
  ]) {
    assert.equal(byId.get(id).status, 'PASS', id);
  }
  assert.equal(byId.get('NO_NEW_NETWORK_PATH_IN_B3C17_DIFF').proofClass, 'DIFF_GUARD_NOT_REPO_WIDE_ABSENCE_CLAIM');
  assert.equal(state.proof.noFutureLaneBlocksP0, true);
  assert.equal(state.proof.parkingLotAdvisoryOnly, true);
  assert.equal(state.proof.activeCanonNotPromoted, true);
  assert.equal(state.proof.requiredTokenSetNotExpanded, true);
  assert.equal(state.proof.noNewNetworkPathInB3C17Diff, true);
  assert.equal(state.proof.noRemoteAiCall, true);
  assert.equal(state.proof.noCollabTransport, true);
  assert.equal(state.proof.noCanonicalStorageRewrite, true);
  assert.equal(state.proof.noNewDependency, true);
});

test('b3c17 future lanes: required negative rows pass', async () => {
  const { evaluateB3C17FutureLanesNonblockingState } = await loadModule();
  const state = await evaluateB3C17FutureLanesNonblockingState({ repoRoot: REPO_ROOT });
  const ids = state.negativeRows.map((row) => row.id).sort();

  assert.deepEqual(ids, [
    'ACTIVE_CANON_PROMOTION_NEGATIVE',
    'CANONICAL_STORAGE_REWRITE_NEGATIVE',
    'COLLAB_TRANSPORT_NEGATIVE',
    'DONOR_FUTURE_LANE_COMPLETION_CLAIM_NEGATIVE',
    'FUTURE_LANE_RUNTIME_IMPLEMENTATION_NEGATIVE',
    'MISSING_PROMOTION_CRITERIA_NEGATIVE',
    'NETWORK_PATH_NEGATIVE',
    'NEW_DEPENDENCY_NEGATIVE',
    'P1_P2_BLOCKS_P0_NEGATIVE',
    'RELEASE_GREEN_FALSE_NEGATIVE',
    'REMOTE_AI_NEGATIVE',
    'REQUIRED_TOKEN_EXPANSION_NEGATIVE',
  ]);
  assert.equal(state.negativeRows.every((row) => row.status === 'PASS'), true);
  assert.equal(state.proof.negativeRowsComplete, true);
  assert.equal(state.proof.negativeRowsPass, true);
});

test('b3c17 future lanes: donor archives remain context only', async () => {
  const { evaluateB3C17FutureLanesNonblockingState } = await loadModule();
  const state = await evaluateB3C17FutureLanesNonblockingState({ repoRoot: REPO_ROOT });

  assert.equal(state.proof.donorIntakeContextOnly, true);
  assert.equal(state.donorIntake.class, 'READ_ONLY_CONTEXT_ONLY');
  assert.equal(state.donorIntake.codeImported, false);
  assert.equal(state.donorIntake.dependencyClaimImported, false);
  assert.equal(state.donorIntake.completionClaimImported, false);
  assert.equal(state.donorIntake.futureLaneCompletionClaimImported, false);
  assert.ok(state.donorIntake.archiveRows.length >= 4);
});

test('b3c17 future lanes: forbidden claims fail evaluation', async () => {
  const { evaluateB3C17FutureLanesNonblockingState } = await loadModule();
  const cases = [
    'futureLaneRuntimeImplementation',
    'p1P2BlocksP0',
    'remoteAiCall',
    'networkPathIntroduced',
    'collabTransport',
    'canonicalStorageRewrite',
    'newDependency',
    'packageManifestChange',
    'releaseGreenClaim',
    'activeCanonPromotion',
    'requiredTokenExpansion',
    'donorFutureLaneCompletionClaimImported',
  ];

  for (const key of cases) {
    const state = await evaluateB3C17FutureLanesNonblockingState({
      repoRoot: REPO_ROOT,
      forceClaims: { [key]: true },
    });
    assert.equal(state.ok, false, key);
    assert.equal(state.B3C17_FUTURE_LANES_NONBLOCKING_OK, 0, key);
    assert.equal(state.B3C17_RELEASE_GREEN_OK, 0, key);
  }
});

test('b3c17 future lanes: scope flags reject adjacent layer drift', async () => {
  const { evaluateB3C17FutureLanesNonblockingState } = await loadModule();
  const state = await evaluateB3C17FutureLanesNonblockingState({ repoRoot: REPO_ROOT });

  assert.equal(state.scope.packageManifestChange, false);
  assert.equal(state.scope.activeCanonPromotion, false);
  assert.equal(state.scope.requiredTokenExpansion, false);
  assert.equal(state.scope.newDependency, false);
  assert.equal(state.scope.uiChange, false);
  assert.equal(state.scope.storageChange, false);
  assert.equal(state.scope.exportRewrite, false);
  assert.equal(state.scope.securityRewrite, false);
  assert.equal(state.scope.perfFix, false);
  assert.equal(state.scope.xplatCertification, false);
  assert.equal(state.scope.a11yCertification, false);
  assert.equal(state.scope.packageBuild, false);
  assert.equal(state.scope.packageHashGeneration, false);
  assert.equal(state.scope.releaseGreenClaim, false);
  assert.equal(state.scope.networkPathIntroducedByB3C17, false);
  assert.equal(state.scope.remoteAiCall, false);
  assert.equal(state.scope.collabTransport, false);
  assert.equal(state.scope.futureLaneRuntimeImplementation, false);
});

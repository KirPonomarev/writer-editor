const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MODULE_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'b3c18-production-hardening-queue-state.mjs');
const STATUS_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'STATUS', 'B3C18_PRODUCTION_HARDENING_QUEUE_STATUS_V1.json');

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

test('b3c18 production hardening queue: state artifact matches stable executable fields', async () => {
  const {
    evaluateB3C18ProductionHardeningQueueState,
    TOKEN_NAME,
    RELEASE_GREEN_TOKEN_NAME,
  } = await loadModule();
  const state = await evaluateB3C18ProductionHardeningQueueState({ repoRoot: REPO_ROOT });
  const committedState = readJson(STATUS_PATH);
  const normalizedCommitted = normalizeDynamicState(committedState);
  const normalizedState = normalizeDynamicState(state);

  assert.equal(committedState.artifactId, state.artifactId);
  assert.equal(committedState.contourId, state.contourId);
  assert.equal(committedState.status, state.status);
  assert.equal(committedState[TOKEN_NAME], state[TOKEN_NAME]);
  assert.equal(committedState[RELEASE_GREEN_TOKEN_NAME], state[RELEASE_GREEN_TOKEN_NAME]);
  assert.deepEqual(committedState.failRows, state.failRows);
  assert.deepEqual(committedState.b3c17InputRow, state.b3c17InputRow);
  assert.deepEqual(committedState.transitiveEvidenceRows, state.transitiveEvidenceRows);
  assert.deepEqual(committedState.queueRows, state.queueRows);
  assert.deepEqual(committedState.promotionGateRows, state.promotionGateRows);
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

test('b3c18 production hardening queue: CLI status remains worktree independent outside repo cwd', () => {
  const result = spawnSync(process.execPath, [MODULE_PATH], {
    cwd: os.tmpdir(),
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);

  const stdout = String(result.stdout || '');
  assert.match(stdout, /B3C18_STATUS=PASS/u);
  assert.match(stdout, /B3C18_PRODUCTION_HARDENING_QUEUE_OK=1/u);
  assert.match(stdout, /B3C18_RELEASE_GREEN_OK=0/u);
});

test('b3c18 production hardening queue: binds B3C17 direct input and preserves limits', async () => {
  const { evaluateB3C18ProductionHardeningQueueState } = await loadModule();
  const state = await evaluateB3C18ProductionHardeningQueueState({ repoRoot: REPO_ROOT });

  assert.equal(state.b3c17InputRow.basename, 'B3C17_FUTURE_LANES_NONBLOCKING_STATUS_V1.json');
  assert.equal(state.b3c17InputRow.passed, true);
  assert.equal(state.b3c17InputRow.token, 1);
  assert.equal(state.b3c17InputRow.releaseGreen, 0);
  assert.equal(state.b3c17InputRow.futureLanesParked, true);
  assert.equal(state.b3c17InputRow.activeCanonNotPromoted, true);
  assert.equal(state.b3c17InputRow.requiredTokenSetNotExpanded, true);
  assert.equal(state.proof.b3c17InputBound, true);
  assert.equal(state.proof.b3c17LimitsPreserved, true);
});

test('b3c18 production hardening queue: transitive B3C14 through B3C16 evidence remains release false', async () => {
  const { evaluateB3C18ProductionHardeningQueueState } = await loadModule();
  const state = await evaluateB3C18ProductionHardeningQueueState({ repoRoot: REPO_ROOT });
  const byBasename = new Map(state.transitiveEvidenceRows.map((row) => [row.basename, row]));

  for (const basename of [
    'B3C14_RELEASE_DOSSIER_MINIMAL_STATUS_V1.json',
    'B3C15_ATTESTATION_CHAIN_STATUS_V1.json',
    'B3C16_SUPPLY_CHAIN_RELEASE_SCOPE_STATUS_V1.json',
  ]) {
    assert.equal(byBasename.get(basename).passed, true, basename);
    assert.equal(byBasename.get(basename).releaseGreen, 0, basename);
  }
  assert.equal(state.proof.transitiveEvidencePass, true);
});

test('b3c18 production hardening queue: twelve hardening queues are staged advisory nonblocking', async () => {
  const { evaluateB3C18ProductionHardeningQueueState } = await loadModule();
  const state = await evaluateB3C18ProductionHardeningQueueState({ repoRoot: REPO_ROOT });
  const ids = state.queueRows.map((row) => row.id).sort();

  assert.deepEqual(ids, [
    'A11Y_POLISH_QUEUE_STAGED_NONBLOCKING',
    'ARCHITECTURE_FITNESS_QUEUE_STAGED_NONBLOCKING',
    'CORPUS_GENERATOR_QUEUE_STAGED_NONBLOCKING',
    'CRASH_MATRIX_DEEPENING_QUEUE_STAGED_NONBLOCKING',
    'I18N_DEEPENING_QUEUE_STAGED_NONBLOCKING',
    'LOCAL_OBSERVABILITY_QUEUE_STAGED_NONBLOCKING',
    'METAMORPHIC_SUITE_QUEUE_STAGED_NONBLOCKING',
    'MODEL_BASED_TEST_QUEUE_STAGED_NONBLOCKING',
    'OPERATION_FUZZER_QUEUE_STAGED_NONBLOCKING',
    'PRODUCT_ERROR_TAXONOMY_QUEUE_STAGED_NONBLOCKING',
    'SUPPLY_CHAIN_DEEPENING_QUEUE_STAGED_NONBLOCKING',
    'THREAT_MODEL_QUEUE_STAGED_NONBLOCKING',
  ]);
  for (const row of state.queueRows) {
    assert.equal(row.status, 'STAGED_ADVISORY_NONBLOCKING', row.id);
    assert.equal(row.authority, 'P0C_ADVISORY_UNTIL_PROMOTED', row.id);
    assert.equal(row.runtimeImplemented, false, row.id);
    assert.equal(row.blocksP0BReleaseKernel, false, row.id);
    assert.equal(row.releaseClaimDependsOnThisQueue, false, row.id);
  }
  assert.equal(state.proof.allQueuesStagedNonblocking, true);
});

test('b3c18 production hardening queue: promotion gates exist for every queue', async () => {
  const { evaluateB3C18ProductionHardeningQueueState } = await loadModule();
  const state = await evaluateB3C18ProductionHardeningQueueState({ repoRoot: REPO_ROOT });
  const byQueue = new Map(state.promotionGateRows.map((row) => [row.queue, row]));

  for (const queue of [
    'modelBasedTests',
    'metamorphicSuites',
    'architectureFitness',
    'supplyChainDeepening',
    'threatModel',
    'i18nDeepening',
    'a11yPolish',
    'localObservability',
    'productErrorTaxonomy',
    'crashMatrixDeepening',
    'operationFuzzer',
    'corpusGenerator',
  ]) {
    assert.equal(byQueue.get(queue).status, 'PASS', queue);
    assert.ok(byQueue.get(queue).gate.length >= 3, queue);
  }
  assert.ok(byQueue.get('modelBasedTests').gate.includes('active model contract'));
  assert.ok(byQueue.get('localObservability').gate.includes('no network upload'));
  assert.ok(byQueue.get('operationFuzzer').gate.includes('no typing hot path work'));
  assert.equal(state.proof.promotionGatesComplete, true);
});

test('b3c18 production hardening queue: nonblocking governance rows pass', async () => {
  const { evaluateB3C18ProductionHardeningQueueState } = await loadModule();
  const state = await evaluateB3C18ProductionHardeningQueueState({ repoRoot: REPO_ROOT });
  const byId = new Map(state.nonblockingRows.map((row) => [row.id, row]));

  for (const id of [
    'P0C_NOT_BLOCKING_P0B',
    'NO_RELEASE_CLAIM_DEPENDS_ON_P0C',
    'NO_RUNTIME_HARDENING_IMPLEMENTATION',
    'ACTIVE_CANON_NOT_PROMOTED',
    'REQUIRED_TOKEN_SET_NOT_EXPANDED',
    'NO_NEW_NETWORK_PATH_IN_B3C18_DIFF',
    'NO_CANONICAL_STORAGE_REWRITE',
    'NO_NEW_DEPENDENCY',
    'PACKAGE_MANIFESTS_READ_ONLY',
    'B3C19_AUDIT_NOT_STARTED',
    'RELEASE_GREEN_FALSE',
    'DONOR_CONTEXT_ONLY',
    'NO_SCOPE_BLOAT_WITH_FIXED_12_QUEUE_SET',
    'B3C17_LIMITS_PRESERVED',
  ]) {
    assert.equal(byId.get(id).status, 'PASS', id);
  }
  assert.equal(byId.get('NO_NEW_NETWORK_PATH_IN_B3C18_DIFF').proofClass, 'DIFF_GUARD_NOT_REPO_WIDE_ABSENCE_CLAIM');
  assert.equal(state.proof.p0cNotBlockingP0b, true);
  assert.equal(state.proof.noReleaseClaimDependsOnP0c, true);
  assert.equal(state.proof.noRuntimeHardeningImplementation, true);
  assert.equal(state.proof.b3c19AuditNotStarted, true);
  assert.equal(state.proof.releaseGreenFalseBecauseB3C18Only, true);
});

test('b3c18 production hardening queue: required negative rows pass', async () => {
  const { evaluateB3C18ProductionHardeningQueueState } = await loadModule();
  const state = await evaluateB3C18ProductionHardeningQueueState({ repoRoot: REPO_ROOT });
  const ids = state.negativeRows.map((row) => row.id).sort();

  assert.deepEqual(ids, [
    'ACTIVE_CANON_PROMOTION_NEGATIVE',
    'B3C19_AUDIT_STARTED_NEGATIVE',
    'CANONICAL_STORAGE_REWRITE_NEGATIVE',
    'CORPUS_GENERATOR_RUNTIME_NEGATIVE',
    'DONOR_HARDENING_COMPLETION_CLAIM_NEGATIVE',
    'FUZZER_RUNTIME_NEGATIVE',
    'HARDENING_RUNTIME_IMPLEMENTATION_NEGATIVE',
    'METAMORPHIC_IMPLEMENTATION_NEGATIVE',
    'MISSING_PROMOTION_GATE_NEGATIVE',
    'MODEL_TEST_IMPLEMENTATION_NEGATIVE',
    'NETWORK_PATH_NEGATIVE',
    'NEW_DEPENDENCY_NEGATIVE',
    'OBSERVABILITY_RUNTIME_NEGATIVE',
    'P0C_BLOCKS_P0B_NEGATIVE',
    'RELEASE_CLAIM_DEPENDS_ON_P0C_NEGATIVE',
    'RELEASE_GREEN_FALSE_NEGATIVE',
    'REQUIRED_TOKEN_EXPANSION_NEGATIVE',
    'THREAT_MODEL_IMPLEMENTATION_NEGATIVE',
  ]);
  assert.equal(state.negativeRows.every((row) => row.status === 'PASS'), true);
  assert.equal(state.proof.negativeRowsComplete, true);
  assert.equal(state.proof.negativeRowsPass, true);
});

test('b3c18 production hardening queue: donor archives remain context only', async () => {
  const { evaluateB3C18ProductionHardeningQueueState } = await loadModule();
  const state = await evaluateB3C18ProductionHardeningQueueState({ repoRoot: REPO_ROOT });

  assert.equal(state.proof.donorIntakeContextOnly, true);
  assert.equal(state.donorIntake.class, 'READ_ONLY_CONTEXT_ONLY');
  assert.equal(state.donorIntake.codeImported, false);
  assert.equal(state.donorIntake.dependencyClaimImported, false);
  assert.equal(state.donorIntake.completionClaimImported, false);
  assert.equal(state.donorIntake.hardeningCompletionClaimImported, false);
  assert.ok(state.donorIntake.archiveRows.length >= 4);
});

test('b3c18 production hardening queue: forbidden claims fail evaluation', async () => {
  const { evaluateB3C18ProductionHardeningQueueState } = await loadModule();
  const cases = [
    'hardeningRuntimeImplementation',
    'p0cBlocksP0b',
    'releaseClaimDependsOnP0c',
    'networkPathIntroduced',
    'observabilityRuntime',
    'fuzzerRuntime',
    'corpusGeneratorRuntime',
    'threatModelImplementation',
    'modelTestImplementation',
    'metamorphicImplementation',
    'canonicalStorageRewrite',
    'newDependency',
    'releaseGreenClaim',
    'activeCanonPromotion',
    'requiredTokenExpansion',
    'b3c19AuditStarted',
    'donorHardeningCompletionClaimImported',
  ];

  for (const key of cases) {
    const state = await evaluateB3C18ProductionHardeningQueueState({
      repoRoot: REPO_ROOT,
      forceClaims: { [key]: true },
    });
    assert.equal(state.ok, false, key);
    assert.equal(state.B3C18_PRODUCTION_HARDENING_QUEUE_OK, 0, key);
    assert.equal(state.B3C18_RELEASE_GREEN_OK, 0, key);
  }
});

test('b3c18 production hardening queue: scope flags reject adjacent layer drift', async () => {
  const { evaluateB3C18ProductionHardeningQueueState } = await loadModule();
  const state = await evaluateB3C18ProductionHardeningQueueState({ repoRoot: REPO_ROOT });

  assert.equal(state.scope.packageManifestChange, false);
  assert.equal(state.scope.activeCanonPromotion, false);
  assert.equal(state.scope.requiredTokenExpansion, false);
  assert.equal(state.scope.newDependency, false);
  assert.equal(state.scope.uiChange, false);
  assert.equal(state.scope.storageChange, false);
  assert.equal(state.scope.exportRewrite, false);
  assert.equal(state.scope.securityRewrite, false);
  assert.equal(state.scope.releaseGreenClaim, false);
  assert.equal(state.scope.networkPathIntroducedByB3C18, false);
  assert.equal(state.scope.hardeningRuntimeImplementation, false);
  assert.equal(state.scope.observabilityRuntime, false);
  assert.equal(state.scope.fuzzerRuntime, false);
  assert.equal(state.scope.corpusGeneratorRuntime, false);
  assert.equal(state.scope.threatModelImplementation, false);
  assert.equal(state.scope.modelTestImplementation, false);
  assert.equal(state.scope.metamorphicImplementation, false);
  assert.equal(state.scope.b3c19AuditStarted, false);
  assert.equal(state.scope.donorHardeningCompletionClaimImported, false);
});

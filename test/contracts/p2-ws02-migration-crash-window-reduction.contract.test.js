const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(
  REPO_ROOT,
  'scripts',
  'ops',
  'p2-ws02-migration-crash-window-reduction-state.mjs',
);

let modulePromise = null;

function loadModule() {
  if (!modulePromise) {
    modulePromise = import(pathToFileURL(MODULE_PATH).href);
  }
  return modulePromise;
}

function evaluateBaseline(evaluateP2Ws02MigrationCrashWindowReductionState) {
  return evaluateP2Ws02MigrationCrashWindowReductionState({ repoRoot: REPO_ROOT });
}

test('p2 ws02 baseline: crash-window reduction scope passes', async () => {
  const { evaluateP2Ws02MigrationCrashWindowReductionState } = await loadModule();
  const state = evaluateBaseline(evaluateP2Ws02MigrationCrashWindowReductionState);

  assert.equal(state.ok, true, JSON.stringify(state, null, 2));
  assert.equal(state.P2_WS02_MIGRATION_CRASH_WINDOW_REDUCTION_OK, 1);
  assert.equal(state.counts.crashWindowUnsafePathCount, 0);
  assert.equal(state.sourceHardening.ok, true);

  for (const [key, value] of Object.entries(state.negativeResults)) {
    assert.equal(value, true, `negative scenario must pass: ${key}`);
  }
  for (const [key, value] of Object.entries(state.positiveResults)) {
    assert.equal(value, true, `positive scenario must pass: ${key}`);
  }

  assert.equal(state.dod.NEXT_TZ_DOD_01, true);
  assert.equal(state.dod.NEXT_TZ_DOD_02, true);
  assert.equal(state.dod.NEXT_TZ_DOD_03, true);
  assert.equal(state.acceptance.NEXT_TZ_ACCEPTANCE_01, true);
  assert.equal(state.acceptance.NEXT_TZ_ACCEPTANCE_02, true);
});

test('p2 ws02 negative 01: failsafe trigger is required for crash between snapshot and log', async () => {
  const { evaluateP2Ws02MigrationCrashWindowReductionState } = await loadModule();
  const state = evaluateP2Ws02MigrationCrashWindowReductionState({
    repoRoot: REPO_ROOT,
    negativeFixtures: {
      neg01CrashPoint: 'none',
    },
  });

  assert.equal(state.ok, false);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_01, false);
  assert.equal(state.failReason, 'CRASH_BETWEEN_SNAPSHOT_AND_LOG_FAILSAFE_NOT_TRIGGERED');
});

test('p2 ws02 negative 02: missing rollback marker policy check is required', async () => {
  const { evaluateP2Ws02MigrationCrashWindowReductionState } = await loadModule();
  const state = evaluateP2Ws02MigrationCrashWindowReductionState({
    repoRoot: REPO_ROOT,
    negativeFixtures: {
      neg02IncludeRollbackMarker: true,
    },
  });

  assert.equal(state.ok, false);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_02, false);
  assert.equal(state.failReason, 'MISSING_ROLLBACK_MARKER_POLICY_NOT_ENFORCED');
});

test('p2 ws02 negative 03: partial artifact write integrity reject is required', async () => {
  const { evaluateP2Ws02MigrationCrashWindowReductionState } = await loadModule();
  const state = evaluateP2Ws02MigrationCrashWindowReductionState({
    repoRoot: REPO_ROOT,
    negativeFixtures: {
      neg03PartialWrite: false,
    },
  });

  assert.equal(state.ok, false);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_03, false);
  assert.equal(state.failReason, 'PARTIAL_ARTIFACT_WRITE_INTEGRITY_REJECT_NOT_ENFORCED');
});

test('p2 ws02 negative 04: mixed version artifact migration policy check is required', async () => {
  const { evaluateP2Ws02MigrationCrashWindowReductionState } = await loadModule();
  const state = evaluateP2Ws02MigrationCrashWindowReductionState({
    repoRoot: REPO_ROOT,
    negativeFixtures: {
      neg04MixedVersion: false,
    },
  });

  assert.equal(state.ok, false);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_04, false);
  assert.equal(state.failReason, 'MIXED_VERSION_ARTIFACT_POLICY_NOT_ENFORCED');
});

test('p2 ws02 negative 05: non-idempotent retry contract check is required', async () => {
  const { evaluateP2Ws02MigrationCrashWindowReductionState } = await loadModule();
  const state = evaluateP2Ws02MigrationCrashWindowReductionState({
    repoRoot: REPO_ROOT,
    negativeFixtures: {
      neg05NonIdempotentRetry: false,
    },
  });

  assert.equal(state.ok, false);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_05, false);
  assert.equal(state.failReason, 'NON_IDEMPOTENT_RETRY_CONTRACT_NOT_ENFORCED');
});

test('p2 ws02 repeatability: three runs are stable', async () => {
  const { evaluateP2Ws02MigrationCrashWindowReductionState } = await loadModule();

  const runs = [
    evaluateBaseline(evaluateP2Ws02MigrationCrashWindowReductionState),
    evaluateBaseline(evaluateP2Ws02MigrationCrashWindowReductionState),
    evaluateBaseline(evaluateP2Ws02MigrationCrashWindowReductionState),
  ].map((state) => ({
    ok: state.ok,
    token: state.P2_WS02_MIGRATION_CRASH_WINDOW_REDUCTION_OK,
    counts: state.counts,
    negativeResults: state.negativeResults,
    positiveResults: state.positiveResults,
    dod: state.dod,
    acceptance: state.acceptance,
    advisoryToBlockingDriftCount: state.advisoryToBlockingDriftCount,
    sourceHardening: state.sourceHardening,
  }));

  assert.deepEqual(runs[0], runs[1]);
  assert.deepEqual(runs[1], runs[2]);
  assert.equal(runs[0].ok, true);
});

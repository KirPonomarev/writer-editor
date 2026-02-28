const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(
  REPO_ROOT,
  'scripts',
  'ops',
  'x20-ws02-usability-regression-guard-pack-state.mjs',
);

let modulePromise = null;

function loadModule() {
  if (!modulePromise) {
    modulePromise = import(pathToFileURL(MODULE_PATH).href);
  }
  return modulePromise;
}

function evaluateBaseline(evaluateX20Ws02UsabilityRegressionGuardPackState) {
  return evaluateX20Ws02UsabilityRegressionGuardPackState({ repoRoot: REPO_ROOT });
}

test('x20 ws02 baseline: usability regression guard pack pass', async () => {
  const { evaluateX20Ws02UsabilityRegressionGuardPackState } = await loadModule();
  const state = evaluateBaseline(evaluateX20Ws02UsabilityRegressionGuardPackState);

  assert.equal(state.ok, true, JSON.stringify(state, null, 2));
  assert.equal(state.X20_WS02_USABILITY_REGRESSION_GUARD_PACK_OK, 1);
  assert.equal(state.counts.guardCount, 5);
  assert.equal(state.counts.requiredCriticalFlowCount, 5);
  assert.equal(state.counts.missingCriticalFlowGuardCount, 0);
  assert.equal(state.counts.staleGuardReferenceCount, 0);
  assert.equal(state.counts.tokenMismatchCount, 0);
  assert.equal(state.counts.statusMismatchCount, 0);
  assert.equal(state.counts.modeProfileGuardGapCount, 0);
  assert.equal(state.counts.channelGuardMismatchCount, 0);
  assert.equal(state.counts.requiredZeroViolationCount, 0);
  assert.equal(state.counts.requiredPositiveViolationCount, 0);
  assert.equal(state.counts.duplicateGuardIdCount, 0);
  assert.equal(state.counts.duplicateFlowGuardCount, 0);
  assert.equal(state.counts.advisoryToBlockingDriftCount, 0);
  assert.equal(state.counts.expectedChannelCount, 3);
  assert.equal(state.counts.expectedModeCount, 3);
  assert.equal(state.counts.expectedProfileCount, 3);

  for (const [key, value] of Object.entries(state.negativeResults)) {
    assert.equal(value, true, `negative scenario must pass: ${key}`);
  }
  for (const [key, value] of Object.entries(state.positiveResults)) {
    assert.equal(value, true, `positive scenario must pass: ${key}`);
  }

  assert.equal(state.dod.NEXT_TZ_DOD_01, true);
  assert.equal(state.dod.NEXT_TZ_DOD_02, true);
  assert.equal(state.dod.NEXT_TZ_DOD_03, true);
  assert.equal(state.dod.NEXT_TZ_DOD_05, true);
  assert.equal(state.dod.NEXT_TZ_DOD_06, true);
  assert.equal(state.acceptance.NEXT_TZ_ACCEPTANCE_01, true);
  assert.equal(state.acceptance.NEXT_TZ_ACCEPTANCE_02, true);
});

test('x20 ws02 negative 01: missing critical flow guard is rejected', async () => {
  const { evaluateX20Ws02UsabilityRegressionGuardPackState } = await loadModule();
  const state = evaluateBaseline(evaluateX20Ws02UsabilityRegressionGuardPackState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_01, true);
});

test('x20 ws02 negative 02: stale guard reference is rejected', async () => {
  const { evaluateX20Ws02UsabilityRegressionGuardPackState } = await loadModule();
  const state = evaluateBaseline(evaluateX20Ws02UsabilityRegressionGuardPackState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_02, true);
});

test('x20 ws02 negative 03: mode profile guard gap is rejected', async () => {
  const { evaluateX20Ws02UsabilityRegressionGuardPackState } = await loadModule();
  const state = evaluateBaseline(evaluateX20Ws02UsabilityRegressionGuardPackState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_03, true);
});

test('x20 ws02 negative 04: channel guard mismatch is rejected', async () => {
  const { evaluateX20Ws02UsabilityRegressionGuardPackState } = await loadModule();
  const state = evaluateBaseline(evaluateX20Ws02UsabilityRegressionGuardPackState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_04, true);
});

test('x20 ws02 negative 05: non deterministic guard summary is rejected', async () => {
  const { evaluateX20Ws02UsabilityRegressionGuardPackState } = await loadModule();
  const state = evaluateBaseline(evaluateX20Ws02UsabilityRegressionGuardPackState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_05, true);
});

test('x20 ws02 repeatability: three runs are stable', async () => {
  const { evaluateX20Ws02UsabilityRegressionGuardPackState } = await loadModule();

  const runs = [
    evaluateBaseline(evaluateX20Ws02UsabilityRegressionGuardPackState),
    evaluateBaseline(evaluateX20Ws02UsabilityRegressionGuardPackState),
    evaluateBaseline(evaluateX20Ws02UsabilityRegressionGuardPackState),
  ].map((state) => ({
    ok: state.ok,
    token: state.X20_WS02_USABILITY_REGRESSION_GUARD_PACK_OK,
    counts: state.counts,
    negativeResults: state.negativeResults,
    positiveResults: state.positiveResults,
    dod: state.dod,
    acceptance: state.acceptance,
    detector: state.detector,
  }));

  assert.deepEqual(runs[0], runs[1]);
  assert.deepEqual(runs[1], runs[2]);
  assert.equal(runs[0].ok, true);
});

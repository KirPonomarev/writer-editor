const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(
  REPO_ROOT,
  'scripts',
  'ops',
  'p2-ws04-bridge-drift-simplification-state.mjs',
);

let modulePromise = null;

function loadModule() {
  if (!modulePromise) {
    modulePromise = import(pathToFileURL(MODULE_PATH).href);
  }
  return modulePromise;
}

function evaluateBaseline(evaluateP2Ws04BridgeDriftSimplificationState) {
  return evaluateP2Ws04BridgeDriftSimplificationState({ repoRoot: REPO_ROOT });
}

test('p2 ws04 baseline: bridge drift simplification passes', async () => {
  const { evaluateP2Ws04BridgeDriftSimplificationState } = await loadModule();
  const state = evaluateBaseline(evaluateP2Ws04BridgeDriftSimplificationState);

  assert.equal(state.ok, true, JSON.stringify(state, null, 2));
  assert.equal(state.P2_WS04_BRIDGE_DRIFT_SIMPLIFICATION_OK, 1);
  assert.equal(state.counts.signalLossCount, 0);
  assert.equal(state.counts.gapRowsBlockingCount, 0);
  assert.equal(state.counts.advisoryToBlockingDriftCount, 0);

  for (const [key, value] of Object.entries(state.negativeResults)) {
    assert.equal(value, true, `negative scenario must pass: ${key}`);
  }
  for (const [key, value] of Object.entries(state.positiveResults)) {
    assert.equal(value, true, `positive scenario must pass: ${key}`);
  }

  assert.equal(state.dod.DOD_01, true);
  assert.equal(state.dod.DOD_02, true);
  assert.equal(state.dod.DOD_03, true);
  assert.equal(state.dod.DOD_06, true);
  assert.equal(state.acceptance.ACCEPTANCE_01, true);
  assert.equal(state.acceptance.ACCEPTANCE_02, true);
});

test('p2 ws04 negative 01: missing gate/failsignal on bound row is detected', async () => {
  const { evaluateP2Ws04BridgeDriftSimplificationState } = await loadModule();
  const state = evaluateBaseline(evaluateP2Ws04BridgeDriftSimplificationState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_01, true);
});

test('p2 ws04 negative 02: gap row marked blocking is detected', async () => {
  const { evaluateP2Ws04BridgeDriftSimplificationState } = await loadModule();
  const state = evaluateBaseline(evaluateP2Ws04BridgeDriftSimplificationState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_02, true);
});

test('p2 ws04 negative 03: mode mismatch with canonical matrix is detected', async () => {
  const { evaluateP2Ws04BridgeDriftSimplificationState } = await loadModule();
  const state = evaluateBaseline(evaluateP2Ws04BridgeDriftSimplificationState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_03, true);
});

test('p2 ws04 negative 04: new map section without bridge row is detected', async () => {
  const { evaluateP2Ws04BridgeDriftSimplificationState } = await loadModule();
  const state = evaluateBaseline(evaluateP2Ws04BridgeDriftSimplificationState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_04, true);
});

test('p2 ws04 negative 05: law/map conflict without reconciliation note is detected', async () => {
  const { evaluateP2Ws04BridgeDriftSimplificationState } = await loadModule();
  const state = evaluateBaseline(evaluateP2Ws04BridgeDriftSimplificationState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_05, true);
});

test('p2 ws04 repeatability: three runs are stable', async () => {
  const { evaluateP2Ws04BridgeDriftSimplificationState } = await loadModule();

  const runs = [
    evaluateBaseline(evaluateP2Ws04BridgeDriftSimplificationState),
    evaluateBaseline(evaluateP2Ws04BridgeDriftSimplificationState),
    evaluateBaseline(evaluateP2Ws04BridgeDriftSimplificationState),
  ].map((state) => ({
    ok: state.ok,
    token: state.P2_WS04_BRIDGE_DRIFT_SIMPLIFICATION_OK,
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

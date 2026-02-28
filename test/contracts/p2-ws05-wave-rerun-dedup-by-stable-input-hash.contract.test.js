const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(
  REPO_ROOT,
  'scripts',
  'ops',
  'p2-ws05-wave-rerun-dedup-by-stable-input-hash-state.mjs',
);

let modulePromise = null;

function loadModule() {
  if (!modulePromise) {
    modulePromise = import(pathToFileURL(MODULE_PATH).href);
  }
  return modulePromise;
}

function evaluateBaseline(evaluateP2Ws05WaveRerunDedupByStableInputHashState) {
  return evaluateP2Ws05WaveRerunDedupByStableInputHashState({ repoRoot: REPO_ROOT });
}

test('p2 ws05 baseline: wave rerun dedup by stable input hash passes', async () => {
  const { evaluateP2Ws05WaveRerunDedupByStableInputHashState } = await loadModule();
  const state = evaluateBaseline(evaluateP2Ws05WaveRerunDedupByStableInputHashState);

  assert.equal(state.ok, true, JSON.stringify(state, null, 2));
  assert.equal(state.P2_WS05_WAVE_RERUN_DEDUP_BY_STABLE_INPUT_HASH_OK, 1);
  assert.equal(state.counts.unnecessaryHeavyRerunReduced, 1);
  assert.equal(state.counts.advisoryToBlockingDriftCount, 0);

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
  assert.equal(state.acceptance.NEXT_TZ_ACCEPTANCE_01, true);
  assert.equal(state.acceptance.NEXT_TZ_ACCEPTANCE_02, true);
});

test('p2 ws05 negative 01: cache reuse with hash mismatch is rejected', async () => {
  const { evaluateP2Ws05WaveRerunDedupByStableInputHashState } = await loadModule();
  const state = evaluateBaseline(evaluateP2Ws05WaveRerunDedupByStableInputHashState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_01, true);
});

test('p2 ws05 negative 02: cache reuse with expired ttl is rejected', async () => {
  const { evaluateP2Ws05WaveRerunDedupByStableInputHashState } = await loadModule();
  const state = evaluateBaseline(evaluateP2Ws05WaveRerunDedupByStableInputHashState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_02, true);
});

test('p2 ws05 negative 03: heavy rerun skip on invalid input is rejected', async () => {
  const { evaluateP2Ws05WaveRerunDedupByStableInputHashState } = await loadModule();
  const state = evaluateBaseline(evaluateP2Ws05WaveRerunDedupByStableInputHashState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_03, true);
});

test('p2 ws05 negative 04: manual relevant input override is rejected', async () => {
  const { evaluateP2Ws05WaveRerunDedupByStableInputHashState } = await loadModule();
  const state = evaluateBaseline(evaluateP2Ws05WaveRerunDedupByStableInputHashState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_04, true);
});

test('p2 ws05 negative 05: stale result acceptance is rejected', async () => {
  const { evaluateP2Ws05WaveRerunDedupByStableInputHashState } = await loadModule();
  const state = evaluateBaseline(evaluateP2Ws05WaveRerunDedupByStableInputHashState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_05, true);
});

test('p2 ws05 repeatability: three runs are stable', async () => {
  const { evaluateP2Ws05WaveRerunDedupByStableInputHashState } = await loadModule();

  const runs = [
    evaluateBaseline(evaluateP2Ws05WaveRerunDedupByStableInputHashState),
    evaluateBaseline(evaluateP2Ws05WaveRerunDedupByStableInputHashState),
    evaluateBaseline(evaluateP2Ws05WaveRerunDedupByStableInputHashState),
  ].map((state) => ({
    ok: state.ok,
    token: state.P2_WS05_WAVE_RERUN_DEDUP_BY_STABLE_INPUT_HASH_OK,
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

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(
  REPO_ROOT,
  'scripts',
  'ops',
  'final-formalization-and-rebind-state.mjs',
);

let modulePromise = null;

function loadModule() {
  if (!modulePromise) {
    modulePromise = import(pathToFileURL(MODULE_PATH).href);
  }
  return modulePromise;
}

function evaluateBaseline(evaluateFinalFormalizationAndRebindState) {
  return evaluateFinalFormalizationAndRebindState({ repoRoot: REPO_ROOT });
}

test('final formalization baseline: token pass with all checks', async () => {
  const { evaluateFinalFormalizationAndRebindState } = await loadModule();
  const state = evaluateBaseline(evaluateFinalFormalizationAndRebindState);

  assert.equal(state.ok, true, JSON.stringify(state, null, 2));
  assert.equal(state.FINAL_FORMALIZATION_AND_REBIND_OK, 1);

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
  assert.equal(state.dod.NEXT_TZ_DOD_07, true);
  assert.equal(state.acceptance.NEXT_TZ_ACCEPTANCE_01, true);
  assert.equal(state.acceptance.NEXT_TZ_ACCEPTANCE_02, true);
  assert.equal(state.acceptance.NEXT_TZ_ACCEPTANCE_03, true);
  assert.equal(state.acceptance.NEXT_TZ_ACCEPTANCE_04, true);
  assert.equal(state.acceptance.NEXT_TZ_ACCEPTANCE_05, true);
});

test('final formalization negative 01: closeout missing scenario is detectable', async () => {
  const { evaluateFinalFormalizationAndRebindState } = await loadModule();
  const state = evaluateBaseline(evaluateFinalFormalizationAndRebindState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_01, true);
});

test('final formalization negative 02: registry mismatch scenario is detectable', async () => {
  const { evaluateFinalFormalizationAndRebindState } = await loadModule();
  const state = evaluateBaseline(evaluateFinalFormalizationAndRebindState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_02, true);
});

test('final formalization negative 03: advisory auto-block drift scenario is detectable', async () => {
  const { evaluateFinalFormalizationAndRebindState } = await loadModule();
  const state = evaluateBaseline(evaluateFinalFormalizationAndRebindState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_03, true);
});

test('final formalization negative 04: promoted items with missing binding are rejected', async () => {
  const { evaluateFinalFormalizationAndRebindState } = await loadModule();
  const state = evaluateBaseline(evaluateFinalFormalizationAndRebindState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_04, true);
});

test('final formalization negative 05: non-deterministic summary scenario is detectable', async () => {
  const { evaluateFinalFormalizationAndRebindState } = await loadModule();
  const state = evaluateBaseline(evaluateFinalFormalizationAndRebindState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_05, true);
});

test('final formalization repeatability: three runs are stable', async () => {
  const { evaluateFinalFormalizationAndRebindState } = await loadModule();

  const runs = [
    evaluateBaseline(evaluateFinalFormalizationAndRebindState),
    evaluateBaseline(evaluateFinalFormalizationAndRebindState),
    evaluateBaseline(evaluateFinalFormalizationAndRebindState),
  ].map((state) => ({
    ok: state.ok,
    token: state.FINAL_FORMALIZATION_AND_REBIND_OK,
    counts: state.counts,
    negativeResults: state.negativeResults,
    positiveResults: state.positiveResults,
    dod: state.dod,
    acceptance: state.acceptance,
    detectorHash: state.detector.hash,
  }));

  assert.deepEqual(runs[0], runs[1]);
  assert.deepEqual(runs[1], runs[2]);
  assert.equal(runs[0].ok, true);
});

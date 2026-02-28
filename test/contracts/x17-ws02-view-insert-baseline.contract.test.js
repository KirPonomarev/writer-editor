const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(
  REPO_ROOT,
  'scripts',
  'ops',
  'x17-ws02-view-insert-baseline-state.mjs',
);

let modulePromise = null;

function loadModule() {
  if (!modulePromise) {
    modulePromise = import(pathToFileURL(MODULE_PATH).href);
  }
  return modulePromise;
}

function evaluateBaseline(evaluateX17Ws02ViewInsertBaselineState) {
  return evaluateX17Ws02ViewInsertBaselineState({ repoRoot: REPO_ROOT });
}

test('x17 ws02 baseline: view insert baseline pass', async () => {
  const { evaluateX17Ws02ViewInsertBaselineState } = await loadModule();
  const state = evaluateBaseline(evaluateX17Ws02ViewInsertBaselineState);

  assert.equal(state.ok, true, JSON.stringify(state, null, 2));
  assert.equal(state.X17_WS02_VIEW_INSERT_BASELINE_OK, 1);
  assert.equal(state.counts.actionCount, 6);
  assert.equal(state.counts.requiredActionCount, 6);
  assert.equal(state.counts.requiredCommandCount, 6);
  assert.equal(state.counts.channelCount, 3);
  assert.equal(state.counts.modeCount, 3);
  assert.equal(state.counts.profileCount, 3);
  assert.equal(state.counts.rowCount, 54);
  assert.equal(state.counts.missingRequiredActionRowsCount, 0);
  assert.equal(state.counts.menuProjectionGapCount, 0);
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
  assert.equal(state.dod.NEXT_TZ_DOD_06, true);
  assert.equal(state.acceptance.NEXT_TZ_ACCEPTANCE_01, true);
  assert.equal(state.acceptance.NEXT_TZ_ACCEPTANCE_02, true);
});

test('x17 ws02 negative 01: action without command bus route is rejected', async () => {
  const { evaluateX17Ws02ViewInsertBaselineState } = await loadModule();
  const state = evaluateBaseline(evaluateX17Ws02ViewInsertBaselineState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_01, true);
});

test('x17 ws02 negative 02: action without capability binding is rejected', async () => {
  const { evaluateX17Ws02ViewInsertBaselineState } = await loadModule();
  const state = evaluateBaseline(evaluateX17Ws02ViewInsertBaselineState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_02, true);
});

test('x17 ws02 negative 03: channel inconsistency is rejected', async () => {
  const { evaluateX17Ws02ViewInsertBaselineState } = await loadModule();
  const state = evaluateBaseline(evaluateX17Ws02ViewInsertBaselineState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_03, true);
});

test('x17 ws02 negative 04: required baseline action hidden is rejected', async () => {
  const { evaluateX17Ws02ViewInsertBaselineState } = await loadModule();
  const state = evaluateBaseline(evaluateX17Ws02ViewInsertBaselineState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_04, true);
});

test('x17 ws02 negative 05: non-deterministic binding order is rejected', async () => {
  const { evaluateX17Ws02ViewInsertBaselineState } = await loadModule();
  const state = evaluateBaseline(evaluateX17Ws02ViewInsertBaselineState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_05, true);
});

test('x17 ws02 repeatability: three runs are stable', async () => {
  const { evaluateX17Ws02ViewInsertBaselineState } = await loadModule();

  const runs = [
    evaluateBaseline(evaluateX17Ws02ViewInsertBaselineState),
    evaluateBaseline(evaluateX17Ws02ViewInsertBaselineState),
    evaluateBaseline(evaluateX17Ws02ViewInsertBaselineState),
  ].map((state) => ({
    ok: state.ok,
    token: state.X17_WS02_VIEW_INSERT_BASELINE_OK,
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

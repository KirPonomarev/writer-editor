const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(
  REPO_ROOT,
  'scripts',
  'ops',
  'x15-ws04-write-plan-review-shells-state.mjs',
);

let modulePromise = null;

function loadModule() {
  if (!modulePromise) {
    modulePromise = import(pathToFileURL(MODULE_PATH).href);
  }
  return modulePromise;
}

function evaluateBaseline(evaluateX15Ws04WritePlanReviewShellsState) {
  return evaluateX15Ws04WritePlanReviewShellsState({ repoRoot: REPO_ROOT });
}

test('x15 ws04 baseline: write-plan-review shells pass', async () => {
  const { evaluateX15Ws04WritePlanReviewShellsState } = await loadModule();
  const state = evaluateBaseline(evaluateX15Ws04WritePlanReviewShellsState);

  assert.equal(state.ok, true, JSON.stringify(state, null, 2));
  assert.equal(state.X15_WS04_WRITE_PLAN_REVIEW_SHELLS_OK, 1);
  assert.equal(state.counts.modeCount, 3);
  assert.equal(state.counts.commandBindingCount > 0, true);
  assert.equal(state.counts.panelCatalogCount > 0, true);
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

test('x15 ws04 negative 01: unknown mode switch is rejected', async () => {
  const { evaluateX15Ws04WritePlanReviewShellsState } = await loadModule();
  const state = evaluateBaseline(evaluateX15Ws04WritePlanReviewShellsState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_01, true);
});

test('x15 ws04 negative 02: write mode hiding required writing command is rejected', async () => {
  const { evaluateX15Ws04WritePlanReviewShellsState } = await loadModule();
  const state = evaluateBaseline(evaluateX15Ws04WritePlanReviewShellsState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_02, true);
});

test('x15 ws04 negative 03: plan mode opening review-only panel is rejected', async () => {
  const { evaluateX15Ws04WritePlanReviewShellsState } = await loadModule();
  const state = evaluateBaseline(evaluateX15Ws04WritePlanReviewShellsState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_03, true);
});

test('x15 ws04 negative 04: review mode without history capability is rejected', async () => {
  const { evaluateX15Ws04WritePlanReviewShellsState } = await loadModule();
  const state = evaluateBaseline(evaluateX15Ws04WritePlanReviewShellsState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_04, true);
});

test('x15 ws04 negative 05: stale visibility state after mode transition is rejected', async () => {
  const { evaluateX15Ws04WritePlanReviewShellsState } = await loadModule();
  const state = evaluateBaseline(evaluateX15Ws04WritePlanReviewShellsState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_05, true);
});

test('x15 ws04 repeatability: three runs are stable', async () => {
  const { evaluateX15Ws04WritePlanReviewShellsState } = await loadModule();

  const runs = [
    evaluateBaseline(evaluateX15Ws04WritePlanReviewShellsState),
    evaluateBaseline(evaluateX15Ws04WritePlanReviewShellsState),
    evaluateBaseline(evaluateX15Ws04WritePlanReviewShellsState),
  ].map((state) => ({
    ok: state.ok,
    token: state.X15_WS04_WRITE_PLAN_REVIEW_SHELLS_OK,
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

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(
  REPO_ROOT,
  'scripts',
  'ops',
  'x19-ws01-first-run-and-empty-state-flow-state.mjs',
);

let modulePromise = null;

function loadModule() {
  if (!modulePromise) {
    modulePromise = import(pathToFileURL(MODULE_PATH).href);
  }
  return modulePromise;
}

function evaluateBaseline(evaluateX19Ws01FirstRunAndEmptyStateFlowState) {
  return evaluateX19Ws01FirstRunAndEmptyStateFlowState({ repoRoot: REPO_ROOT });
}

test('x19 ws01 baseline: first run and empty state flow pass', async () => {
  const { evaluateX19Ws01FirstRunAndEmptyStateFlowState } = await loadModule();
  const state = evaluateBaseline(evaluateX19Ws01FirstRunAndEmptyStateFlowState);

  assert.equal(state.ok, true, JSON.stringify(state, null, 2));
  assert.equal(state.X19_WS01_FIRST_RUN_AND_EMPTY_STATE_FLOW_OK, 1);
  assert.equal(state.counts.entryCount, 5);
  assert.equal(state.counts.requiredEntryActionCount, 5);
  assert.equal(state.counts.emptyStateHintCount, 5);
  assert.equal(state.counts.commandBindingGapCount, 0);
  assert.equal(state.counts.capabilityBindingGapCount, 0);
  assert.equal(state.counts.staleEntryTargetCount, 0);
  assert.equal(state.counts.modeProfileVisibilityGapCount, 0);
  assert.equal(state.counts.requiredEntryActionGapCount, 0);
  assert.equal(state.counts.staleHintTargetCount, 0);
  assert.equal(state.counts.hintCommandMismatchCount, 0);
  assert.equal(state.counts.channelEntryInconsistencyCount, 0);
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

test('x19 ws01 negative 01: first run action without command binding is rejected', async () => {
  const { evaluateX19Ws01FirstRunAndEmptyStateFlowState } = await loadModule();
  const state = evaluateBaseline(evaluateX19Ws01FirstRunAndEmptyStateFlowState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_01, true);
});

test('x19 ws01 negative 02: empty state hint stale target is rejected', async () => {
  const { evaluateX19Ws01FirstRunAndEmptyStateFlowState } = await loadModule();
  const state = evaluateBaseline(evaluateX19Ws01FirstRunAndEmptyStateFlowState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_02, true);
});

test('x19 ws01 negative 03: mode profile invalid visibility is rejected', async () => {
  const { evaluateX19Ws01FirstRunAndEmptyStateFlowState } = await loadModule();
  const state = evaluateBaseline(evaluateX19Ws01FirstRunAndEmptyStateFlowState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_03, true);
});

test('x19 ws01 negative 04: required entry action missing is rejected', async () => {
  const { evaluateX19Ws01FirstRunAndEmptyStateFlowState } = await loadModule();
  const state = evaluateBaseline(evaluateX19Ws01FirstRunAndEmptyStateFlowState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_04, true);
});

test('x19 ws01 negative 05: channel entry inconsistency is rejected', async () => {
  const { evaluateX19Ws01FirstRunAndEmptyStateFlowState } = await loadModule();
  const state = evaluateBaseline(evaluateX19Ws01FirstRunAndEmptyStateFlowState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_05, true);
});

test('x19 ws01 repeatability: three runs are stable', async () => {
  const { evaluateX19Ws01FirstRunAndEmptyStateFlowState } = await loadModule();

  const runs = [
    evaluateBaseline(evaluateX19Ws01FirstRunAndEmptyStateFlowState),
    evaluateBaseline(evaluateX19Ws01FirstRunAndEmptyStateFlowState),
    evaluateBaseline(evaluateX19Ws01FirstRunAndEmptyStateFlowState),
  ].map((state) => ({
    ok: state.ok,
    token: state.X19_WS01_FIRST_RUN_AND_EMPTY_STATE_FLOW_OK,
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

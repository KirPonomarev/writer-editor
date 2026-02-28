const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(
  REPO_ROOT,
  'scripts',
  'ops',
  'x18-ws03-menu-status-feedback-and-save-signals-state.mjs',
);

let modulePromise = null;

function loadModule() {
  if (!modulePromise) {
    modulePromise = import(pathToFileURL(MODULE_PATH).href);
  }
  return modulePromise;
}

function evaluateBaseline(evaluateX18Ws03MenuStatusFeedbackAndSaveSignalsState) {
  return evaluateX18Ws03MenuStatusFeedbackAndSaveSignalsState({ repoRoot: REPO_ROOT });
}

test('x18 ws03 baseline: status feedback and save signals pass', async () => {
  const { evaluateX18Ws03MenuStatusFeedbackAndSaveSignalsState } = await loadModule();
  const state = evaluateBaseline(evaluateX18Ws03MenuStatusFeedbackAndSaveSignalsState);

  assert.equal(state.ok, true, JSON.stringify(state, null, 2));
  assert.equal(state.X18_WS03_MENU_STATUS_FEEDBACK_AND_SAVE_SIGNALS_OK, 1);
  assert.equal(state.counts.entryCount, 6);
  assert.equal(state.counts.requiredSaveSignalCount, 3);
  assert.equal(state.counts.requiredCommandResultSignalCount, 3);
  assert.equal(state.counts.sourceEventGapCount, 0);
  assert.equal(state.counts.commandBindingGapCount, 0);
  assert.equal(state.counts.capabilityBindingGapCount, 0);
  assert.equal(state.counts.staleEntryTargetCount, 0);
  assert.equal(state.counts.modeProfileVisibilityGapCount, 0);
  assert.equal(state.counts.statusResetGapCount, 0);
  assert.equal(state.counts.channelStatusInconsistencyCount, 0);
  assert.equal(state.counts.requiredSaveSignalGapCount, 0);
  assert.equal(state.counts.requiredCommandResultSignalGapCount, 0);
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

test('x18 ws03 negative 01: save signal without source event is rejected', async () => {
  const { evaluateX18Ws03MenuStatusFeedbackAndSaveSignalsState } = await loadModule();
  const state = evaluateBaseline(evaluateX18Ws03MenuStatusFeedbackAndSaveSignalsState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_01, true);
});

test('x18 ws03 negative 02: missing command error feedback is rejected', async () => {
  const { evaluateX18Ws03MenuStatusFeedbackAndSaveSignalsState } = await loadModule();
  const state = evaluateBaseline(evaluateX18Ws03MenuStatusFeedbackAndSaveSignalsState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_02, true);
});

test('x18 ws03 negative 03: status stuck without reset is rejected', async () => {
  const { evaluateX18Ws03MenuStatusFeedbackAndSaveSignalsState } = await loadModule();
  const state = evaluateBaseline(evaluateX18Ws03MenuStatusFeedbackAndSaveSignalsState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_03, true);
});

test('x18 ws03 negative 04: invalid mode profile visibility is rejected', async () => {
  const { evaluateX18Ws03MenuStatusFeedbackAndSaveSignalsState } = await loadModule();
  const state = evaluateBaseline(evaluateX18Ws03MenuStatusFeedbackAndSaveSignalsState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_04, true);
});

test('x18 ws03 negative 05: channel status inconsistency is rejected', async () => {
  const { evaluateX18Ws03MenuStatusFeedbackAndSaveSignalsState } = await loadModule();
  const state = evaluateBaseline(evaluateX18Ws03MenuStatusFeedbackAndSaveSignalsState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_05, true);
});

test('x18 ws03 repeatability: three runs are stable', async () => {
  const { evaluateX18Ws03MenuStatusFeedbackAndSaveSignalsState } = await loadModule();

  const runs = [
    evaluateBaseline(evaluateX18Ws03MenuStatusFeedbackAndSaveSignalsState),
    evaluateBaseline(evaluateX18Ws03MenuStatusFeedbackAndSaveSignalsState),
    evaluateBaseline(evaluateX18Ws03MenuStatusFeedbackAndSaveSignalsState),
  ].map((state) => ({
    ok: state.ok,
    token: state.X18_WS03_MENU_STATUS_FEEDBACK_AND_SAVE_SIGNALS_OK,
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

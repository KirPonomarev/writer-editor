const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(
  REPO_ROOT,
  'scripts',
  'ops',
  'x19-ws03-error-handling-and-recovery-hints-state.mjs',
);

let modulePromise = null;

function loadModule() {
  if (!modulePromise) {
    modulePromise = import(pathToFileURL(MODULE_PATH).href);
  }
  return modulePromise;
}

function evaluateBaseline(evaluateX19Ws03ErrorHandlingAndRecoveryHintsState) {
  return evaluateX19Ws03ErrorHandlingAndRecoveryHintsState({ repoRoot: REPO_ROOT });
}

test('x19 ws03 baseline: error handling and recovery hints pass', async () => {
  const { evaluateX19Ws03ErrorHandlingAndRecoveryHintsState } = await loadModule();
  const state = evaluateBaseline(evaluateX19Ws03ErrorHandlingAndRecoveryHintsState);

  assert.equal(state.ok, true, JSON.stringify(state, null, 2));
  assert.equal(state.X19_WS03_ERROR_HANDLING_AND_RECOVERY_HINTS_OK, 1);
  assert.equal(state.counts.entryCount, 5);
  assert.equal(state.counts.requiredErrorSignalCount, 5);
  assert.equal(state.counts.requiredRecoveryPathErrorCodeCount, 2);
  assert.equal(state.counts.hintMappingGapCount, 0);
  assert.equal(state.counts.recoveryHintGapCount, 0);
  assert.equal(state.counts.sourceEventGapCount, 0);
  assert.equal(state.counts.commandBindingGapCount, 0);
  assert.equal(state.counts.capabilityBindingGapCount, 0);
  assert.equal(state.counts.modeProfileVisibilityGapCount, 0);
  assert.equal(state.counts.statusResetGapCount, 0);
  assert.equal(state.counts.channelErrorFeedbackInconsistencyCount, 0);
  assert.equal(state.counts.requiredErrorSignalGapCount, 0);
  assert.equal(state.counts.requiredRecoveryPathErrorCodeGapCount, 0);
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

test('x19 ws03 negative 01: error without hint mapping is rejected', async () => {
  const { evaluateX19Ws03ErrorHandlingAndRecoveryHintsState } = await loadModule();
  const state = evaluateBaseline(evaluateX19Ws03ErrorHandlingAndRecoveryHintsState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_01, true);
});

test('x19 ws03 negative 02: stale path error without recovery hint is rejected', async () => {
  const { evaluateX19Ws03ErrorHandlingAndRecoveryHintsState } = await loadModule();
  const state = evaluateBaseline(evaluateX19Ws03ErrorHandlingAndRecoveryHintsState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_02, true);
});

test('x19 ws03 negative 03: invalid mode profile error visibility is rejected', async () => {
  const { evaluateX19Ws03ErrorHandlingAndRecoveryHintsState } = await loadModule();
  const state = evaluateBaseline(evaluateX19Ws03ErrorHandlingAndRecoveryHintsState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_03, true);
});

test('x19 ws03 negative 04: non-resetting error state is rejected', async () => {
  const { evaluateX19Ws03ErrorHandlingAndRecoveryHintsState } = await loadModule();
  const state = evaluateBaseline(evaluateX19Ws03ErrorHandlingAndRecoveryHintsState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_04, true);
});

test('x19 ws03 negative 05: channel error feedback inconsistency is rejected', async () => {
  const { evaluateX19Ws03ErrorHandlingAndRecoveryHintsState } = await loadModule();
  const state = evaluateBaseline(evaluateX19Ws03ErrorHandlingAndRecoveryHintsState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_05, true);
});

test('x19 ws03 repeatability: three runs are stable', async () => {
  const { evaluateX19Ws03ErrorHandlingAndRecoveryHintsState } = await loadModule();

  const runs = [
    evaluateBaseline(evaluateX19Ws03ErrorHandlingAndRecoveryHintsState),
    evaluateBaseline(evaluateX19Ws03ErrorHandlingAndRecoveryHintsState),
    evaluateBaseline(evaluateX19Ws03ErrorHandlingAndRecoveryHintsState),
  ].map((state) => ({
    ok: state.ok,
    token: state.X19_WS03_ERROR_HANDLING_AND_RECOVERY_HINTS_OK,
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

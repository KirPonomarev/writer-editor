const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(
  REPO_ROOT,
  'scripts',
  'ops',
  'x20-ws01-release-checklist-and-onboarding-polish-state.mjs',
);

let modulePromise = null;

function loadModule() {
  if (!modulePromise) {
    modulePromise = import(pathToFileURL(MODULE_PATH).href);
  }
  return modulePromise;
}

function evaluateBaseline(evaluateX20Ws01ReleaseChecklistAndOnboardingPolishState) {
  return evaluateX20Ws01ReleaseChecklistAndOnboardingPolishState({ repoRoot: REPO_ROOT });
}

test('x20 ws01 baseline: release checklist and onboarding polish pass', async () => {
  const { evaluateX20Ws01ReleaseChecklistAndOnboardingPolishState } = await loadModule();
  const state = evaluateBaseline(evaluateX20Ws01ReleaseChecklistAndOnboardingPolishState);

  assert.equal(state.ok, true, JSON.stringify(state, null, 2));
  assert.equal(state.X20_WS01_RELEASE_CHECKLIST_AND_ONBOARDING_POLISH_OK, 1);
  assert.equal(state.counts.entryCount, 6);
  assert.equal(state.counts.requiredChecklistItemCount, 6);
  assert.equal(state.counts.onboardingHintCount, 6);
  assert.equal(state.counts.commandBindingGapCount, 0);
  assert.equal(state.counts.capabilityBindingGapCount, 0);
  assert.equal(state.counts.modeProfileVisibilityGapCount, 0);
  assert.equal(state.counts.channelInconsistencyCount, 0);
  assert.equal(state.counts.requiredChecklistItemGapCount, 0);
  assert.equal(state.counts.staleHintTargetCount, 0);
  assert.equal(state.counts.hintCommandMismatchCount, 0);
  assert.equal(state.counts.checklistHintMissingCount, 0);
  assert.equal(state.counts.duplicateChecklistItemCount, 0);
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

test('x20 ws01 negative 01: checklist item without command binding is rejected', async () => {
  const { evaluateX20Ws01ReleaseChecklistAndOnboardingPolishState } = await loadModule();
  const state = evaluateBaseline(evaluateX20Ws01ReleaseChecklistAndOnboardingPolishState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_01, true);
});

test('x20 ws01 negative 02: onboarding hint with stale target is rejected', async () => {
  const { evaluateX20Ws01ReleaseChecklistAndOnboardingPolishState } = await loadModule();
  const state = evaluateBaseline(evaluateX20Ws01ReleaseChecklistAndOnboardingPolishState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_02, true);
});

test('x20 ws01 negative 03: invalid mode profile visibility is rejected', async () => {
  const { evaluateX20Ws01ReleaseChecklistAndOnboardingPolishState } = await loadModule();
  const state = evaluateBaseline(evaluateX20Ws01ReleaseChecklistAndOnboardingPolishState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_03, true);
});

test('x20 ws01 negative 04: duplicate checklist item is rejected', async () => {
  const { evaluateX20Ws01ReleaseChecklistAndOnboardingPolishState } = await loadModule();
  const state = evaluateBaseline(evaluateX20Ws01ReleaseChecklistAndOnboardingPolishState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_04, true);
});

test('x20 ws01 negative 05: channel inconsistency is rejected', async () => {
  const { evaluateX20Ws01ReleaseChecklistAndOnboardingPolishState } = await loadModule();
  const state = evaluateBaseline(evaluateX20Ws01ReleaseChecklistAndOnboardingPolishState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_05, true);
});

test('x20 ws01 repeatability: three runs are stable', async () => {
  const { evaluateX20Ws01ReleaseChecklistAndOnboardingPolishState } = await loadModule();

  const runs = [
    evaluateBaseline(evaluateX20Ws01ReleaseChecklistAndOnboardingPolishState),
    evaluateBaseline(evaluateX20Ws01ReleaseChecklistAndOnboardingPolishState),
    evaluateBaseline(evaluateX20Ws01ReleaseChecklistAndOnboardingPolishState),
  ].map((state) => ({
    ok: state.ok,
    token: state.X20_WS01_RELEASE_CHECKLIST_AND_ONBOARDING_POLISH_OK,
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

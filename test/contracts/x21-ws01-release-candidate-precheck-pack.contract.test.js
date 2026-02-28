const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(
  REPO_ROOT,
  'scripts',
  'ops',
  'x21-ws01-release-candidate-precheck-pack-state.mjs',
);

let modulePromise = null;

function loadModule() {
  if (!modulePromise) {
    modulePromise = import(pathToFileURL(MODULE_PATH).href);
  }
  return modulePromise;
}

function evaluateBaseline(evaluateX21Ws01ReleaseCandidatePrecheckPackState) {
  return evaluateX21Ws01ReleaseCandidatePrecheckPackState({ repoRoot: REPO_ROOT });
}

test('x21 ws01 baseline: release candidate precheck pack pass', async () => {
  const { evaluateX21Ws01ReleaseCandidatePrecheckPackState } = await loadModule();
  const state = evaluateBaseline(evaluateX21Ws01ReleaseCandidatePrecheckPackState);

  assert.equal(state.ok, true, JSON.stringify(state, null, 2));
  assert.equal(state.X21_WS01_RELEASE_CANDIDATE_PRECHECK_PACK_OK, 1);
  assert.equal(state.counts.requiredReleaseBlockingTokenCount, 14);
  assert.equal(state.counts.releaseBindingMissingTokenCount, 0);
  assert.equal(state.counts.releaseBindingMissingRecordCount, 0);
  assert.equal(state.counts.releaseBindingMissingFieldCount, 0);
  assert.equal(state.counts.releaseBindingFailSignalMissingCount, 0);
  assert.equal(state.counts.releaseBindingFailSignalMismatchCount, 0);
  assert.equal(state.counts.modeMatrixMissingDispositionCount, 0);
  assert.equal(state.counts.modeMatrixInvalidDispositionCount, 0);
  assert.equal(state.counts.advisoryToBlockingDriftCount, 0);
  assert.equal(state.counts.offlineIntegrityIssueCount, 0);
  assert.equal(state.counts.usabilityGuardIssueCount, 0);
  assert.equal(state.counts.requiredModeKeyCount, 3);

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

test('x21 ws01 negative 01: missing blocking entity binding is rejected', async () => {
  const { evaluateX21Ws01ReleaseCandidatePrecheckPackState } = await loadModule();
  const state = evaluateBaseline(evaluateX21Ws01ReleaseCandidatePrecheckPackState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_01, true);
});

test('x21 ws01 negative 02: mode disposition mismatch is rejected', async () => {
  const { evaluateX21Ws01ReleaseCandidatePrecheckPackState } = await loadModule();
  const state = evaluateBaseline(evaluateX21Ws01ReleaseCandidatePrecheckPackState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_02, true);
});

test('x21 ws01 negative 03: offline integrity precheck failure is rejected', async () => {
  const { evaluateX21Ws01ReleaseCandidatePrecheckPackState } = await loadModule();
  const state = evaluateBaseline(evaluateX21Ws01ReleaseCandidatePrecheckPackState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_03, true);
});

test('x21 ws01 negative 04: usability guard pack gap is rejected', async () => {
  const { evaluateX21Ws01ReleaseCandidatePrecheckPackState } = await loadModule();
  const state = evaluateBaseline(evaluateX21Ws01ReleaseCandidatePrecheckPackState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_04, true);
});

test('x21 ws01 negative 05: non deterministic precheck output is rejected', async () => {
  const { evaluateX21Ws01ReleaseCandidatePrecheckPackState } = await loadModule();
  const state = evaluateBaseline(evaluateX21Ws01ReleaseCandidatePrecheckPackState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_05, true);
});

test('x21 ws01 repeatability: three runs are stable', async () => {
  const { evaluateX21Ws01ReleaseCandidatePrecheckPackState } = await loadModule();

  const runs = [
    evaluateBaseline(evaluateX21Ws01ReleaseCandidatePrecheckPackState),
    evaluateBaseline(evaluateX21Ws01ReleaseCandidatePrecheckPackState),
    evaluateBaseline(evaluateX21Ws01ReleaseCandidatePrecheckPackState),
  ].map((state) => ({
    ok: state.ok,
    token: state.X21_WS01_RELEASE_CANDIDATE_PRECHECK_PACK_OK,
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

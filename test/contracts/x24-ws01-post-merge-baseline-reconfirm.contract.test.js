const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(
  REPO_ROOT,
  'scripts',
  'ops',
  'x24-ws01-post-merge-baseline-reconfirm-state.mjs',
);

let modulePromise = null;

function loadModule() {
  if (!modulePromise) {
    modulePromise = import(pathToFileURL(MODULE_PATH).href);
  }
  return modulePromise;
}

function evaluateBaseline(evaluateX24Ws01PostMergeBaselineReconfirmState) {
  return evaluateX24Ws01PostMergeBaselineReconfirmState({ repoRoot: REPO_ROOT });
}

test('x24 ws01 baseline: post merge baseline reconfirm pass', async () => {
  const { evaluateX24Ws01PostMergeBaselineReconfirmState } = await loadModule();
  const state = evaluateBaseline(evaluateX24Ws01PostMergeBaselineReconfirmState);

  assert.equal(state.ok, true, JSON.stringify(state, null, 2));
  assert.equal(state.X24_WS01_POST_MERGE_BASELINE_RECONFIRM_OK, 1);
  assert.equal(state.counts.requiredInputRefCount, 8);
  assert.equal(state.counts.missingRequiredInputCount, 0);
  assert.equal(state.counts.requiredReleaseBlockingTokenCount, 14);
  assert.equal(state.counts.releaseBindingMissingTokenCount, 0);
  assert.equal(state.counts.releaseBindingMissingRecordCount, 0);
  assert.equal(state.counts.releaseBindingMissingFieldCount, 0);
  assert.equal(state.counts.releaseBindingFailSignalMissingCount, 0);
  assert.equal(state.counts.releaseBindingFailSignalMismatchCount, 0);
  assert.equal(state.counts.modeCheckMissingCount, 0);
  assert.equal(state.counts.modeDispositionDriftCount, 0);
  assert.equal(state.counts.modeEvaluatorIssueCount, 0);
  assert.equal(state.counts.attestationIssueCount, 0);
  assert.equal(state.counts.attestationChainBreakCount, 0);
  assert.equal(state.counts.headBindingMismatchCount, 0);
  assert.equal(state.counts.branchBindingMismatchCount, 0);
  assert.equal(state.counts.worktreeDirtyViolationCount, 0);
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

test('x24 ws01 negative 01: head mismatch is rejected', async () => {
  const { evaluateX24Ws01PostMergeBaselineReconfirmState } = await loadModule();
  const state = evaluateBaseline(evaluateX24Ws01PostMergeBaselineReconfirmState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_01, true);
});

test('x24 ws01 negative 02: required blocking token gap is rejected', async () => {
  const { evaluateX24Ws01PostMergeBaselineReconfirmState } = await loadModule();
  const state = evaluateBaseline(evaluateX24Ws01PostMergeBaselineReconfirmState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_02, true);
});

test('x24 ws01 negative 03: mode disposition drift is rejected', async () => {
  const { evaluateX24Ws01PostMergeBaselineReconfirmState } = await loadModule();
  const state = evaluateBaseline(evaluateX24Ws01PostMergeBaselineReconfirmState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_03, true);
});

test('x24 ws01 negative 04: offline attestation chain break is rejected', async () => {
  const { evaluateX24Ws01PostMergeBaselineReconfirmState } = await loadModule();
  const state = evaluateBaseline(evaluateX24Ws01PostMergeBaselineReconfirmState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_04, true);
});

test('x24 ws01 negative 05: non deterministic stability packet output is rejected', async () => {
  const { evaluateX24Ws01PostMergeBaselineReconfirmState } = await loadModule();
  const state = evaluateBaseline(evaluateX24Ws01PostMergeBaselineReconfirmState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_05, true);
});

test('x24 ws01 repeatability: three runs are stable', async () => {
  const { evaluateX24Ws01PostMergeBaselineReconfirmState } = await loadModule();

  const runs = [
    evaluateBaseline(evaluateX24Ws01PostMergeBaselineReconfirmState),
    evaluateBaseline(evaluateX24Ws01PostMergeBaselineReconfirmState),
    evaluateBaseline(evaluateX24Ws01PostMergeBaselineReconfirmState),
  ].map((state) => ({
    ok: state.ok,
    token: state.X24_WS01_POST_MERGE_BASELINE_RECONFIRM_OK,
    counts: state.counts,
    negativeResults: state.negativeResults,
    positiveResults: state.positiveResults,
    dod: state.dod,
    acceptance: state.acceptance,
    detector: state.detector,
    hashes: {
      postMergeStabilityHash: state.baseline.postMergeStabilityHash,
    },
  }));

  assert.deepEqual(runs[0], runs[1]);
  assert.deepEqual(runs[1], runs[2]);
  assert.equal(runs[0].ok, true);
});

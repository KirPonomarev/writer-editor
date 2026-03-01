const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(
  REPO_ROOT,
  'scripts',
  'ops',
  'x64-seq10-11-closeout-merge-execution-state.mjs',
);

let modulePromise = null;

function loadModule() {
  if (!modulePromise) {
    modulePromise = import(pathToFileURL(MODULE_PATH).href);
  }
  return modulePromise;
}

test('x64 seq10-11 baseline local precheck packet passes and holds merge', async () => {
  const { evaluateX64Seq1011CloseoutMergeExecutionState } = await loadModule();
  const state = evaluateX64Seq1011CloseoutMergeExecutionState({ repoRoot: REPO_ROOT });

  assert.equal(state.ok, true, JSON.stringify(state, null, 2));
  assert.equal(state.X64_SEQ10_11_CLOSEOUT_MERGE_EXECUTION_OK, 1);

  for (const [key, value] of Object.entries(state.negativeResults)) {
    assert.equal(value, true, `negative scenario must pass: ${key}`);
  }

  assert.equal(state.positiveResults.POSITIVE_01_ENTRY_PRECONDITIONS_CONFIRMED, true);
  assert.equal(state.positiveResults.POSITIVE_02_LOCAL_PRECHECK_COMPLETED_NO_FACTUAL_MERGE, true);
  assert.equal(state.positiveResults.POSITIVE_03_POST_MERGE_RECONFIRM_PASS, true);

  assert.equal(state.dod.DOD_01, true);
  assert.equal(state.dod.DOD_02, true);
  assert.equal(state.dod.DOD_03, true);
  assert.equal(state.dod.DOD_04, true);
  assert.equal(state.dod.DOD_05, true);
  assert.equal(state.dod.DOD_06, true);
  assert.equal(state.dod.DOD_07, true);

  assert.equal(state.acceptance.ACCEPTANCE_01, true);
  assert.equal(state.acceptance.ACCEPTANCE_02, true);
  assert.equal(state.acceptance.ACCEPTANCE_03, true);
  assert.equal(state.acceptance.ACCEPTANCE_04, true);

  assert.equal(state.mergeExecuted, false);
  assert.equal(state.nextGateStatus, 'HOLD_OWNER_MERGE_GO');
});

test('x64 seq10-11 repeatability is stable across three runs', async () => {
  const { evaluateX64Seq1011CloseoutMergeExecutionState } = await loadModule();

  const runs = [
    evaluateX64Seq1011CloseoutMergeExecutionState({ repoRoot: REPO_ROOT }),
    evaluateX64Seq1011CloseoutMergeExecutionState({ repoRoot: REPO_ROOT }),
    evaluateX64Seq1011CloseoutMergeExecutionState({ repoRoot: REPO_ROOT }),
  ].map((state) => ({
    ok: state.ok,
    token: state.token,
    counts: state.counts,
    negativeResults: state.negativeResults,
    positiveResults: state.positiveResults,
    dod: state.dod,
    acceptance: state.acceptance,
    determinism: state.determinism,
    nextGateStatus: state.nextGateStatus,
  }));

  assert.deepEqual(runs[0], runs[1]);
  assert.deepEqual(runs[1], runs[2]);
});

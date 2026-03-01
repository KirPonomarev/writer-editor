const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(
  REPO_ROOT,
  'scripts',
  'ops',
  'x63-ws01-next-contour-alignment-state.mjs',
);

let modulePromise = null;

function loadModule() {
  if (!modulePromise) {
    modulePromise = import(pathToFileURL(MODULE_PATH).href);
  }
  return modulePromise;
}

test('x63 ws01 baseline alignment passes', async () => {
  const { evaluateX63Ws01NextContourAlignmentState } = await loadModule();
  const state = evaluateX63Ws01NextContourAlignmentState({ repoRoot: REPO_ROOT });

  assert.equal(state.ok, true, JSON.stringify(state, null, 2));
  assert.equal(state.X63_WS01_NEXT_CONTOUR_ALIGNMENT_OK, 1);

  assert.equal(state.positiveResults.NEXT_TZ_POSITIVE_01, true);
  assert.equal(state.positiveResults.NEXT_TZ_POSITIVE_02, true);
  assert.equal(state.positiveResults.NEXT_TZ_POSITIVE_03, true);

  for (const [key, value] of Object.entries(state.negativeResults)) {
    assert.equal(value, true, `negative scenario must pass: ${key}`);
  }

  assert.equal(state.dod.DOD_01, true);
  assert.equal(state.dod.DOD_02, true);
  assert.equal(state.dod.DOD_03, true);
  assert.equal(state.dod.DOD_04, true);
  assert.equal(state.dod.DOD_05, true);
  assert.equal(state.dod.DOD_06, true);

  assert.equal(state.acceptance.ACCEPTANCE_01, true);
  assert.equal(state.acceptance.ACCEPTANCE_02, true);
  assert.equal(state.acceptance.ACCEPTANCE_03, true);
  assert.equal(state.acceptance.ACCEPTANCE_04, true);
  assert.equal(state.finalGateSatisfied, true);
});

test('x63 ws01 repeatability is stable across three runs', async () => {
  const { evaluateX63Ws01NextContourAlignmentState } = await loadModule();

  const runs = [
    evaluateX63Ws01NextContourAlignmentState({ repoRoot: REPO_ROOT }),
    evaluateX63Ws01NextContourAlignmentState({ repoRoot: REPO_ROOT }),
    evaluateX63Ws01NextContourAlignmentState({ repoRoot: REPO_ROOT }),
  ].map((state) => ({
    ok: state.ok,
    token: state.token,
    counts: state.counts,
    negativeResults: state.negativeResults,
    positiveResults: state.positiveResults,
    dod: state.dod,
    acceptance: state.acceptance,
    determinism: state.determinism,
    finalGateSatisfied: state.finalGateSatisfied,
  }));

  assert.deepEqual(runs[0], runs[1]);
  assert.deepEqual(runs[1], runs[2]);
});

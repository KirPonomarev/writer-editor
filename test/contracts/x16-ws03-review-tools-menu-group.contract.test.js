const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(
  REPO_ROOT,
  'scripts',
  'ops',
  'x16-ws03-review-tools-menu-group-state.mjs',
);

let modulePromise = null;

function loadModule() {
  if (!modulePromise) {
    modulePromise = import(pathToFileURL(MODULE_PATH).href);
  }
  return modulePromise;
}

function evaluateBaseline(evaluateX16Ws03ReviewToolsMenuGroupState) {
  return evaluateX16Ws03ReviewToolsMenuGroupState({ repoRoot: REPO_ROOT });
}

test('x16 ws03 baseline: review tools menu group passes', async () => {
  const { evaluateX16Ws03ReviewToolsMenuGroupState } = await loadModule();
  const state = evaluateBaseline(evaluateX16Ws03ReviewToolsMenuGroupState);

  assert.equal(state.ok, true, JSON.stringify(state, null, 2));
  assert.equal(state.X16_WS03_REVIEW_TOOLS_MENU_GROUP_OK, 1);
  assert.equal(state.counts.reviewEntryCount, 2);
  assert.equal(state.counts.missingReviewGroupBindingsCount, 0);
  assert.equal(state.counts.localFirstPolicyErrorCount, 0);
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

test('x16 ws03 negative 01: review command without local-first flag is rejected', async () => {
  const { evaluateX16Ws03ReviewToolsMenuGroupState } = await loadModule();
  const state = evaluateBaseline(evaluateX16Ws03ReviewToolsMenuGroupState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_01, true);
});

test('x16 ws03 negative 02: review group visible in invalid mode is rejected', async () => {
  const { evaluateX16Ws03ReviewToolsMenuGroupState } = await loadModule();
  const state = evaluateBaseline(evaluateX16Ws03ReviewToolsMenuGroupState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_02, true);
});

test('x16 ws03 negative 03: review group capability mismatch is rejected', async () => {
  const { evaluateX16Ws03ReviewToolsMenuGroupState } = await loadModule();
  const state = evaluateBaseline(evaluateX16Ws03ReviewToolsMenuGroupState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_03, true);
});

test('x16 ws03 negative 04: non-machine-bound blocking classification is rejected', async () => {
  const { evaluateX16Ws03ReviewToolsMenuGroupState } = await loadModule();
  const state = evaluateBaseline(evaluateX16Ws03ReviewToolsMenuGroupState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_04, true);
});

test('x16 ws03 negative 05: history compare without required guard is rejected', async () => {
  const { evaluateX16Ws03ReviewToolsMenuGroupState } = await loadModule();
  const state = evaluateBaseline(evaluateX16Ws03ReviewToolsMenuGroupState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_05, true);
});

test('x16 ws03 repeatability: three runs are stable', async () => {
  const { evaluateX16Ws03ReviewToolsMenuGroupState } = await loadModule();

  const runs = [
    evaluateBaseline(evaluateX16Ws03ReviewToolsMenuGroupState),
    evaluateBaseline(evaluateX16Ws03ReviewToolsMenuGroupState),
    evaluateBaseline(evaluateX16Ws03ReviewToolsMenuGroupState),
  ].map((state) => ({
    ok: state.ok,
    token: state.X16_WS03_REVIEW_TOOLS_MENU_GROUP_OK,
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

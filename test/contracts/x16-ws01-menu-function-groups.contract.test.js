const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(
  REPO_ROOT,
  'scripts',
  'ops',
  'x16-ws01-menu-function-groups-state.mjs',
);

let modulePromise = null;

function loadModule() {
  if (!modulePromise) {
    modulePromise = import(pathToFileURL(MODULE_PATH).href);
  }
  return modulePromise;
}

function evaluateBaseline(evaluateX16Ws01MenuFunctionGroupsState) {
  return evaluateX16Ws01MenuFunctionGroupsState({ repoRoot: REPO_ROOT });
}

test('x16 ws01 baseline: menu function groups pass', async () => {
  const { evaluateX16Ws01MenuFunctionGroupsState } = await loadModule();
  const state = evaluateBaseline(evaluateX16Ws01MenuFunctionGroupsState);

  assert.equal(state.ok, true, JSON.stringify(state, null, 2));
  assert.equal(state.X16_WS01_MENU_FUNCTION_GROUPS_OK, 1);
  assert.equal(state.counts.groupAllowlistCount, 8);
  assert.equal(state.counts.groupCoverageCount, 8);
  assert.equal(state.counts.channelCount, 3);
  assert.equal(state.counts.modeCount, 3);
  assert.equal(state.counts.profileCount, 3);
  assert.equal(state.counts.entryCount > 0, true);
  assert.equal(state.counts.rowCount > 0, true);
  assert.equal(state.counts.missingRequiredCoreCommandRowsCount, 0);
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

test('x16 ws01 negative 01: menu group without capability binding is rejected', async () => {
  const { evaluateX16Ws01MenuFunctionGroupsState } = await loadModule();
  const state = evaluateBaseline(evaluateX16Ws01MenuFunctionGroupsState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_01, true);
});

test('x16 ws01 negative 02: missing required core command is rejected', async () => {
  const { evaluateX16Ws01MenuFunctionGroupsState } = await loadModule();
  const state = evaluateBaseline(evaluateX16Ws01MenuFunctionGroupsState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_02, true);
});

test('x16 ws01 negative 03: mode profile conflict is rejected', async () => {
  const { evaluateX16Ws01MenuFunctionGroupsState } = await loadModule();
  const state = evaluateBaseline(evaluateX16Ws01MenuFunctionGroupsState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_03, true);
});

test('x16 ws01 negative 04: command group outside allowlist is rejected', async () => {
  const { evaluateX16Ws01MenuFunctionGroupsState } = await loadModule();
  const state = evaluateBaseline(evaluateX16Ws01MenuFunctionGroupsState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_04, true);
});

test('x16 ws01 negative 05: channel inconsistency is rejected', async () => {
  const { evaluateX16Ws01MenuFunctionGroupsState } = await loadModule();
  const state = evaluateBaseline(evaluateX16Ws01MenuFunctionGroupsState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_05, true);
});

test('x16 ws01 repeatability: three runs are stable', async () => {
  const { evaluateX16Ws01MenuFunctionGroupsState } = await loadModule();

  const runs = [
    evaluateBaseline(evaluateX16Ws01MenuFunctionGroupsState),
    evaluateBaseline(evaluateX16Ws01MenuFunctionGroupsState),
    evaluateBaseline(evaluateX16Ws01MenuFunctionGroupsState),
  ].map((state) => ({
    ok: state.ok,
    token: state.X16_WS01_MENU_FUNCTION_GROUPS_OK,
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

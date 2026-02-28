const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(
  REPO_ROOT,
  'scripts',
  'ops',
  'x15-ws01-ui-menu-expansion-foundation-state.mjs',
);

let modulePromise = null;

function loadModule() {
  if (!modulePromise) {
    modulePromise = import(pathToFileURL(MODULE_PATH).href);
  }
  return modulePromise;
}

function evaluateBaseline(evaluateX15Ws01UiMenuExpansionFoundationState) {
  return evaluateX15Ws01UiMenuExpansionFoundationState({ repoRoot: REPO_ROOT });
}

test('x15 ws01 baseline: ui menu expansion foundation passes', async () => {
  const { evaluateX15Ws01UiMenuExpansionFoundationState } = await loadModule();
  const state = evaluateBaseline(evaluateX15Ws01UiMenuExpansionFoundationState);

  assert.equal(state.ok, true, JSON.stringify(state, null, 2));
  assert.equal(state.X15_WS01_UI_MENU_EXPANSION_FOUNDATION_OK, 1);
  assert.equal(state.counts.menuLayerCount, 6);
  assert.equal(state.counts.capabilityOverlapMismatchCount, 0);
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
  assert.equal(state.acceptance.NEXT_TZ_ACCEPTANCE_01, true);
  assert.equal(state.acceptance.NEXT_TZ_ACCEPTANCE_02, true);
});

test('x15 ws01 negative 01: menu item outside allowlist is rejected', async () => {
  const { evaluateX15Ws01UiMenuExpansionFoundationState } = await loadModule();
  const state = evaluateBaseline(evaluateX15Ws01UiMenuExpansionFoundationState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_01, true);
});

test('x15 ws01 negative 02: ui change altering core contract is rejected', async () => {
  const { evaluateX15Ws01UiMenuExpansionFoundationState } = await loadModule();
  const state = evaluateBaseline(evaluateX15Ws01UiMenuExpansionFoundationState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_02, true);
});

test('x15 ws01 negative 03: mode visibility conflict is rejected', async () => {
  const { evaluateX15Ws01UiMenuExpansionFoundationState } = await loadModule();
  const state = evaluateBaseline(evaluateX15Ws01UiMenuExpansionFoundationState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_03, true);
});

test('x15 ws01 negative 04: profile override breaking capability policy is rejected', async () => {
  const { evaluateX15Ws01UiMenuExpansionFoundationState } = await loadModule();
  const state = evaluateBaseline(evaluateX15Ws01UiMenuExpansionFoundationState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_04, true);
});

test('x15 ws01 negative 05: plugin overlay without manifest rule is rejected', async () => {
  const { evaluateX15Ws01UiMenuExpansionFoundationState } = await loadModule();
  const state = evaluateBaseline(evaluateX15Ws01UiMenuExpansionFoundationState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_05, true);
});

test('x15 ws01 repeatability: three runs are stable', async () => {
  const { evaluateX15Ws01UiMenuExpansionFoundationState } = await loadModule();

  const runs = [
    evaluateBaseline(evaluateX15Ws01UiMenuExpansionFoundationState),
    evaluateBaseline(evaluateX15Ws01UiMenuExpansionFoundationState),
    evaluateBaseline(evaluateX15Ws01UiMenuExpansionFoundationState),
  ].map((state) => ({
    ok: state.ok,
    token: state.X15_WS01_UI_MENU_EXPANSION_FOUNDATION_OK,
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

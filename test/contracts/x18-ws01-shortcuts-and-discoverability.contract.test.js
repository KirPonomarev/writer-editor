const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(
  REPO_ROOT,
  'scripts',
  'ops',
  'x18-ws01-shortcuts-and-discoverability-state.mjs',
);

let modulePromise = null;

function loadModule() {
  if (!modulePromise) {
    modulePromise = import(pathToFileURL(MODULE_PATH).href);
  }
  return modulePromise;
}

function evaluateBaseline(evaluateX18Ws01ShortcutsAndDiscoverabilityState) {
  return evaluateX18Ws01ShortcutsAndDiscoverabilityState({ repoRoot: REPO_ROOT });
}

test('x18 ws01 baseline: shortcuts and discoverability pass', async () => {
  const { evaluateX18Ws01ShortcutsAndDiscoverabilityState } = await loadModule();
  const state = evaluateBaseline(evaluateX18Ws01ShortcutsAndDiscoverabilityState);

  assert.equal(state.ok, true, JSON.stringify(state, null, 2));
  assert.equal(state.X18_WS01_SHORTCUTS_AND_DISCOVERABILITY_OK, 1);
  assert.equal(state.counts.entryCount, 20);
  assert.equal(state.counts.requiredGroupCount, 9);
  assert.equal(state.counts.requiredShortcutCommandCount, 20);
  assert.equal(state.counts.shortcutConflictCount, 0);
  assert.equal(state.counts.commandBindingGapCount, 0);
  assert.equal(state.counts.capabilityBindingGapCount, 0);
  assert.equal(state.counts.actionBindingMismatchCount, 0);
  assert.equal(state.counts.menuHintMismatchCount, 0);
  assert.equal(state.counts.paletteDiscoverabilityGapCount, 0);
  assert.equal(state.counts.modeProfileVisibilityGapCount, 0);
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

test('x18 ws01 negative 01: duplicate shortcut conflict is rejected', async () => {
  const { evaluateX18Ws01ShortcutsAndDiscoverabilityState } = await loadModule();
  const state = evaluateBaseline(evaluateX18Ws01ShortcutsAndDiscoverabilityState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_01, true);
});

test('x18 ws01 negative 02: shortcut without command binding is rejected', async () => {
  const { evaluateX18Ws01ShortcutsAndDiscoverabilityState } = await loadModule();
  const state = evaluateBaseline(evaluateX18Ws01ShortcutsAndDiscoverabilityState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_02, true);
});

test('x18 ws01 negative 03: invalid mode profile visibility is rejected', async () => {
  const { evaluateX18Ws01ShortcutsAndDiscoverabilityState } = await loadModule();
  const state = evaluateBaseline(evaluateX18Ws01ShortcutsAndDiscoverabilityState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_03, true);
});

test('x18 ws01 negative 04: menu hint mismatch is rejected', async () => {
  const { evaluateX18Ws01ShortcutsAndDiscoverabilityState } = await loadModule();
  const state = evaluateBaseline(evaluateX18Ws01ShortcutsAndDiscoverabilityState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_04, true);
});

test('x18 ws01 negative 05: palette discoverability gap is rejected', async () => {
  const { evaluateX18Ws01ShortcutsAndDiscoverabilityState } = await loadModule();
  const state = evaluateBaseline(evaluateX18Ws01ShortcutsAndDiscoverabilityState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_05, true);
});

test('x18 ws01 repeatability: three runs are stable', async () => {
  const { evaluateX18Ws01ShortcutsAndDiscoverabilityState } = await loadModule();

  const runs = [
    evaluateBaseline(evaluateX18Ws01ShortcutsAndDiscoverabilityState),
    evaluateBaseline(evaluateX18Ws01ShortcutsAndDiscoverabilityState),
    evaluateBaseline(evaluateX18Ws01ShortcutsAndDiscoverabilityState),
  ].map((state) => ({
    ok: state.ok,
    token: state.X18_WS01_SHORTCUTS_AND_DISCOVERABILITY_OK,
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

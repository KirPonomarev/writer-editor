const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(
  REPO_ROOT,
  'scripts',
  'ops',
  'p2-ws06-extended-parity-fixture-packs-state.mjs',
);

let modulePromise = null;

function loadModule() {
  if (!modulePromise) {
    modulePromise = import(pathToFileURL(MODULE_PATH).href);
  }
  return modulePromise;
}

function evaluateBaseline(evaluateP2Ws06ExtendedParityFixturePacksState) {
  return evaluateP2Ws06ExtendedParityFixturePacksState({ repoRoot: REPO_ROOT });
}

test('p2 ws06 baseline: extended parity fixture packs passes', async () => {
  const { evaluateP2Ws06ExtendedParityFixturePacksState } = await loadModule();
  const state = evaluateBaseline(evaluateP2Ws06ExtendedParityFixturePacksState);

  assert.equal(state.ok, true, JSON.stringify(state, null, 2));
  assert.equal(state.P2_WS06_EXTENDED_PARITY_FIXTURE_PACKS_OK, 1);
  assert.equal(state.counts.coverageIncreased, 1);
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
  assert.equal(state.acceptance.NEXT_TZ_ACCEPTANCE_02, state.stageActivation.ok);
});

test('p2 ws06 negative 01: case conflict fixture expected fail is enforced', async () => {
  const { evaluateP2Ws06ExtendedParityFixturePacksState } = await loadModule();
  const state = evaluateBaseline(evaluateP2Ws06ExtendedParityFixturePacksState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_01, true);
});

test('p2 ws06 negative 02: reserved name fixture expected fail is enforced', async () => {
  const { evaluateP2Ws06ExtendedParityFixturePacksState } = await loadModule();
  const state = evaluateBaseline(evaluateP2Ws06ExtendedParityFixturePacksState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_02, true);
});

test('p2 ws06 negative 03: newline divergence fixture expected fail is enforced', async () => {
  const { evaluateP2Ws06ExtendedParityFixturePacksState } = await loadModule();
  const state = evaluateBaseline(evaluateP2Ws06ExtendedParityFixturePacksState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_03, true);
});

test('p2 ws06 negative 04: unicode normalization mismatch fixture expected fail is enforced', async () => {
  const { evaluateP2Ws06ExtendedParityFixturePacksState } = await loadModule();
  const state = evaluateBaseline(evaluateP2Ws06ExtendedParityFixturePacksState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_04, true);
});

test('p2 ws06 negative 05: locale ordering drift fixture expected fail is enforced', async () => {
  const { evaluateP2Ws06ExtendedParityFixturePacksState } = await loadModule();
  const state = evaluateBaseline(evaluateP2Ws06ExtendedParityFixturePacksState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_05, true);
});

test('p2 ws06 repeatability: three runs are stable', async () => {
  const { evaluateP2Ws06ExtendedParityFixturePacksState } = await loadModule();

  const runs = [
    evaluateBaseline(evaluateP2Ws06ExtendedParityFixturePacksState),
    evaluateBaseline(evaluateP2Ws06ExtendedParityFixturePacksState),
    evaluateBaseline(evaluateP2Ws06ExtendedParityFixturePacksState),
  ].map((state) => ({
    ok: state.ok,
    token: state.P2_WS06_EXTENDED_PARITY_FIXTURE_PACKS_OK,
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

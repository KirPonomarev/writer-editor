const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(
  REPO_ROOT,
  'scripts',
  'ops',
  'p2-ws01-cross-platform-normalization-hardening-state.mjs',
);

let modulePromise = null;

function loadModule() {
  if (!modulePromise) {
    modulePromise = import(pathToFileURL(MODULE_PATH).href);
  }
  return modulePromise;
}

function evaluateBaseline(evaluateP2Ws01CrossPlatformNormalizationHardeningState) {
  return evaluateP2Ws01CrossPlatformNormalizationHardeningState({ repoRoot: REPO_ROOT });
}

test('p2 ws01 baseline: scope checks and required negatives/positives pass', async () => {
  const { evaluateP2Ws01CrossPlatformNormalizationHardeningState } = await loadModule();
  const state = evaluateBaseline(evaluateP2Ws01CrossPlatformNormalizationHardeningState);

  assert.equal(state.ok, true, JSON.stringify(state, null, 2));
  assert.equal(state.P2_WS01_CROSS_PLATFORM_NORMALIZATION_HARDENING_OK, 1);
  assert.equal(state.counts.platformGapCount, 0);

  for (const [key, value] of Object.entries(state.negativeResults)) {
    assert.equal(value, true, `negative scenario must pass: ${key}`);
  }
  for (const [key, value] of Object.entries(state.positiveResults)) {
    assert.equal(value, true, `positive scenario must pass: ${key}`);
  }

  assert.equal(state.dod.NEXT_TZ_DOD_01, true);
  assert.equal(state.dod.NEXT_TZ_DOD_02, true);
  assert.equal(state.dod.NEXT_TZ_DOD_03, true);
  assert.equal(state.acceptance.NEXT_TZ_ACCEPTANCE_01, true);
  assert.equal(state.acceptance.NEXT_TZ_ACCEPTANCE_02, true);
});

test('p2 ws01 negative 01: case collision enforcement is mandatory', async () => {
  const { evaluateP2Ws01CrossPlatformNormalizationHardeningState } = await loadModule();
  const state = evaluateP2Ws01CrossPlatformNormalizationHardeningState({
    repoRoot: REPO_ROOT,
    negativeFixtures: {
      caseCollision: ['SceneA.txt', 'SceneB.txt'],
    },
  });

  assert.equal(state.ok, false);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_01, false);
  assert.equal(state.failReason, 'CASE_COLLISION_EXPECT_FAIL_NOT_ENFORCED');
});

test('p2 ws01 negative 02: reserved name enforcement is mandatory', async () => {
  const { evaluateP2Ws01CrossPlatformNormalizationHardeningState } = await loadModule();
  const state = evaluateP2Ws01CrossPlatformNormalizationHardeningState({
    repoRoot: REPO_ROOT,
    negativeFixtures: {
      reservedName: 'chapter01.txt',
    },
  });

  assert.equal(state.ok, false);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_02, false);
  assert.equal(state.failReason, 'RESERVED_NAME_EXPECT_FAIL_NOT_ENFORCED');
});

test('p2 ws01 negative 03: invalid separator mix enforcement is mandatory', async () => {
  const { evaluateP2Ws01CrossPlatformNormalizationHardeningState } = await loadModule();
  const state = evaluateP2Ws01CrossPlatformNormalizationHardeningState({
    repoRoot: REPO_ROOT,
    negativeFixtures: {
      invalidSeparatorMix: 'scenes/chapter01/scene01.txt',
    },
  });

  assert.equal(state.ok, false);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_03, false);
  assert.equal(state.failReason, 'INVALID_SEPARATOR_MIX_EXPECT_FAIL_NOT_ENFORCED');
});

test('p2 ws01 negative 04: newline mismatch enforcement is mandatory', async () => {
  const { evaluateP2Ws01CrossPlatformNormalizationHardeningState } = await loadModule();
  const state = evaluateP2Ws01CrossPlatformNormalizationHardeningState({
    repoRoot: REPO_ROOT,
    negativeFixtures: {
      newlineMismatch: 'line1\nline2\n',
    },
  });

  assert.equal(state.ok, false);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_04, false);
  assert.equal(state.failReason, 'NEWLINE_MISMATCH_EXPECT_FAIL_NOT_ENFORCED');
});

test('p2 ws01 negative 05: unicode normalization mismatch enforcement is mandatory', async () => {
  const { evaluateP2Ws01CrossPlatformNormalizationHardeningState } = await loadModule();
  const state = evaluateP2Ws01CrossPlatformNormalizationHardeningState({
    repoRoot: REPO_ROOT,
    negativeFixtures: {
      unicodeLeft: 'Cafe',
      unicodeRight: 'Cafe',
    },
  });

  assert.equal(state.ok, false);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_05, false);
  assert.equal(state.failReason, 'UNICODE_NORMALIZATION_MISMATCH_EXPECT_FAIL_NOT_ENFORCED');
});

test('p2 ws01 repeatability: three runs are stable for deterministic output', async () => {
  const { evaluateP2Ws01CrossPlatformNormalizationHardeningState } = await loadModule();

  const runs = [
    evaluateBaseline(evaluateP2Ws01CrossPlatformNormalizationHardeningState),
    evaluateBaseline(evaluateP2Ws01CrossPlatformNormalizationHardeningState),
    evaluateBaseline(evaluateP2Ws01CrossPlatformNormalizationHardeningState),
  ].map((state) => ({
    ok: state.ok,
    token: state.P2_WS01_CROSS_PLATFORM_NORMALIZATION_HARDENING_OK,
    counts: state.counts,
    scopeChecks: state.scopeChecks,
    negativeResults: state.negativeResults,
    positiveResults: state.positiveResults,
    dod: state.dod,
    acceptance: state.acceptance,
    advisoryToBlockingDriftCount: state.advisoryToBlockingDriftCount,
  }));

  assert.deepEqual(runs[0], runs[1]);
  assert.deepEqual(runs[1], runs[2]);
  assert.equal(runs[0].ok, true);
});

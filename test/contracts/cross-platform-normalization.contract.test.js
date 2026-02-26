const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'cross-platform-normalization-state.mjs');
const REQUIRED_SET_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'STATUS', 'REQUIRED_SET_PHASE_3_V1.json');
const PHASE_SWITCH_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'STATUS', 'PHASE_SWITCH_V1.json');
const TOKEN_CATALOG_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'TOKENS', 'TOKEN_CATALOG.json');
const FAILSIGNAL_REGISTRY_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'FAILSIGNALS', 'FAILSIGNAL_REGISTRY.json');

let modulePromise = null;

function loadModule() {
  if (!modulePromise) {
    modulePromise = import(pathToFileURL(MODULE_PATH).href);
  }
  return modulePromise;
}

function evaluateBaseline(evaluateCrossPlatformNormalizationState) {
  return evaluateCrossPlatformNormalizationState({
    repoRoot: REPO_ROOT,
    requiredSetPath: REQUIRED_SET_PATH,
    phaseSwitchPath: PHASE_SWITCH_PATH,
    tokenCatalogPath: TOKEN_CATALOG_PATH,
    failsignalRegistryPath: FAILSIGNAL_REGISTRY_PATH,
  });
}

test('cross platform normalization: newline and unicode parity confirmed', async () => {
  const { evaluateCrossPlatformNormalizationState } = await loadModule();
  const state = evaluateBaseline(evaluateCrossPlatformNormalizationState);

  assert.equal(state.ok, true, JSON.stringify(state, null, 2));
  assert.equal(state.CROSS_PLATFORM_NORMALIZATION_HARDENING_OK, 1);
  assert.equal(state.newlineNormalizationCheck, true);
  assert.equal(state.unicodeNormalizationCheck, true);
});

test('cross platform normalization: locale-independent sorting produces stable results', async () => {
  const { evaluateCrossPlatformNormalizationState } = await loadModule();
  const state = evaluateBaseline(evaluateCrossPlatformNormalizationState);

  assert.equal(state.localeIndependentSortingCheck, true);
  assert.ok(Array.isArray(state.localeIndependentSortingCases));
  assert.ok(state.localeIndependentSortingCases.every((row) => row.pass === true));
});

test('cross platform normalization: case sensitivity and reserved name handling keep release-critical paths safe', async () => {
  const { evaluateCrossPlatformNormalizationState } = await loadModule();
  const state = evaluateBaseline(evaluateCrossPlatformNormalizationState);

  assert.equal(state.caseSensitivityBehaviorCheck, true);
  assert.equal(state.reservedNameBehaviorCheck, true);
  assert.equal(state.releaseCriticalPathsNoAdvisorySubsetParityCheck, true);
  assert.ok(Array.isArray(state.releaseCriticalPathParity.requiredTokenIds));
  assert.ok(state.releaseCriticalPathParity.requiredTokenIds.length > 0);
});

test('cross platform normalization: path separator safety is enforced across target platforms', async () => {
  const { evaluateCrossPlatformNormalizationState } = await loadModule();
  const state = evaluateBaseline(evaluateCrossPlatformNormalizationState);

  assert.equal(state.pathSeparatorSafetyCheck, true);
  assert.ok(state.pathSeparatorSafetyCases.every((row) => row.pass === true));
});

test('cross platform normalization: advisory signals cannot escalate to blocking outside canonical mode matrix', async () => {
  const { evaluateCrossPlatformNormalizationState } = await loadModule();
  const state = evaluateBaseline(evaluateCrossPlatformNormalizationState);

  assert.equal(state.advisoryToBlockingDriftCount, 0);
  assert.equal(state.advisoryToBlockingDriftCountZero, true);
  assert.equal(state.singleBlockingAuthority.ok, true);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'shared-drift-engine-runtime-state.mjs');
const FAILSIGNAL_REGISTRY_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'FAILSIGNALS', 'FAILSIGNAL_REGISTRY.json');
const REQUIRED_SET_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'EXECUTION', 'REQUIRED_TOKEN_SET.json');

let modulePromise = null;

function loadModule() {
  if (!modulePromise) {
    modulePromise = import(pathToFileURL(MODULE_PATH).href);
  }
  return modulePromise;
}

test('shared drift engine runtime: single source and duplicate reduction are enforced', async () => {
  const {
    evaluateSharedDriftEngineRuntimeState,
    DRIFT_INPUT_PATHS_AFTER,
  } = await loadModule();

  const state = evaluateSharedDriftEngineRuntimeState({
    repoRoot: REPO_ROOT,
    failsignalRegistryPath: FAILSIGNAL_REGISTRY_PATH,
    requiredSetPath: REQUIRED_SET_PATH,
    runtimeBudgetMinutes: 30,
  });

  assert.equal(state.ok, true);
  assert.equal(state.SHARED_DRIFT_ENGINE_RUNTIME_OK, 1);
  assert.equal(state.singleSource.ok, true);
  assert.equal(state.reduction.reducedOrZeroRemaining, true);
  assert.equal(state.reduction.duplicateSignalCountAfter, 0);
  assert.equal(state.groupedAfterInputs.length, DRIFT_INPUT_PATHS_AFTER.length);
});

test('shared drift engine runtime: non-single-source after map fails', async () => {
  const {
    evaluateSharedDriftEngineRuntimeState,
    DRIFT_INPUT_PATHS_AFTER,
  } = await loadModule();

  const invalidAfter = [...DRIFT_INPUT_PATHS_AFTER, {
    signal: 'advisory_to_blocking_drift_count',
    sourcePath: 'scripts/ops/other-engine.mjs#evaluateOtherEngine',
  }];

  const state = evaluateSharedDriftEngineRuntimeState({
    repoRoot: REPO_ROOT,
    failsignalRegistryPath: FAILSIGNAL_REGISTRY_PATH,
    requiredSetPath: REQUIRED_SET_PATH,
    driftInputPathsAfter: invalidAfter,
    runtimeBudgetMinutes: 30,
  });

  assert.equal(state.singleSource.ok, false);
  assert.equal(state.ok, false);
  assert.equal(state.failReason, 'E_SHARED_DRIFT_ENGINE_NOT_SINGLE_SOURCE');
});

test('shared drift engine runtime: runtime budget, output stability, and advisory drift guard stay green', async () => {
  const { evaluateSharedDriftEngineRuntimeState } = await loadModule();

  const state = evaluateSharedDriftEngineRuntimeState({
    repoRoot: REPO_ROOT,
    failsignalRegistryPath: FAILSIGNAL_REGISTRY_PATH,
    requiredSetPath: REQUIRED_SET_PATH,
    runtimeBudgetMinutes: 30,
  });

  assert.equal(state.runtimeBudget.ok, true);
  assert.equal(state.outputStability.ok, true);
  assert.equal(state.advisoryToBlockingDriftCount, 0);
  assert.equal(state.advisoryToBlockingDriftCountZero, true);
  assert.equal(state.singleBlockingAuthority.ok, true);
});

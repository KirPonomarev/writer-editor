const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'shared-remote-probe-engine-state.mjs');
const FAILSIGNAL_REGISTRY_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'FAILSIGNALS', 'FAILSIGNAL_REGISTRY.json');

let modulePromise = null;

function loadModule() {
  if (!modulePromise) {
    modulePromise = import(pathToFileURL(MODULE_PATH).href);
  }
  return modulePromise;
}

test('shared remote probe engine: single source and duplicate reduction are enforced', async () => {
  const {
    evaluateSharedRemoteProbeEngineState,
    REMOTE_PROBE_INPUT_PATHS_AFTER,
  } = await loadModule();

  const state = evaluateSharedRemoteProbeEngineState({
    repoRoot: REPO_ROOT,
    failsignalRegistryPath: FAILSIGNAL_REGISTRY_PATH,
    ttlSeconds: 600,
  });

  assert.equal(state.ok, true);
  assert.equal(state.SHARED_REMOTE_PROBE_ENGINE_WITH_TTL_OK, 1);
  assert.equal(state.singleSource.ok, true);
  assert.equal(state.reduction.reducedOrZeroRemaining, true);
  assert.equal(state.reduction.duplicateSignalCountAfter, 0);
  assert.equal(state.afterGroupedInputs.length, REMOTE_PROBE_INPUT_PATHS_AFTER.length);
});

test('shared remote probe engine: ttl and stale invalidation policy are enforced', async () => {
  const { evaluateSharedRemoteProbeEngineState } = await loadModule();

  const state = evaluateSharedRemoteProbeEngineState({
    repoRoot: REPO_ROOT,
    failsignalRegistryPath: FAILSIGNAL_REGISTRY_PATH,
    ttlSeconds: 600,
  });

  assert.equal(state.ttlPolicy.ok, true);
  assert.equal(state.ttlPolicy.ttlEquals600, true);
  assert.equal(state.staleInvalidation.ok, true);
  assert.equal(state.staleInvalidation.onPhaseChange, true);
  assert.equal(state.staleInvalidation.onMainShaChange, true);
  assert.equal(state.staleInvalidation.onScopeDelta, true);
});

test('shared remote probe engine: interactive path guard and advisory drift guard stay valid', async () => {
  const { evaluateSharedRemoteProbeEngineState } = await loadModule();

  const state = evaluateSharedRemoteProbeEngineState({
    repoRoot: REPO_ROOT,
    failsignalRegistryPath: FAILSIGNAL_REGISTRY_PATH,
    ttlSeconds: 600,
  });

  assert.equal(state.interactivePathGuard.ok, true);
  assert.equal(state.interactivePathGuard.violatingCaseCount, 0);
  assert.equal(state.advisoryToBlockingDriftCount, 0);
  assert.equal(state.advisoryToBlockingDriftCountZero, true);
  assert.equal(state.singleBlockingAuthority.ok, true);
  assert.equal(state.outputStable, true);
});

test('shared remote probe engine negative: ttl mismatch fails policy', async () => {
  const { evaluateSharedRemoteProbeEngineState } = await loadModule();

  const state = evaluateSharedRemoteProbeEngineState({
    repoRoot: REPO_ROOT,
    failsignalRegistryPath: FAILSIGNAL_REGISTRY_PATH,
    ttlSeconds: 599,
  });

  assert.equal(state.ttlPolicy.ok, false);
  assert.equal(state.ok, false);
  assert.equal(state.failReason, 'E_REMOTE_PROBE_TTL_POLICY_VIOLATION');
});

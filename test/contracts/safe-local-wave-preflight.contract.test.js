const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'safe-local-wave-preflight-state.mjs');
const FAILSIGNAL_REGISTRY_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'FAILSIGNALS', 'FAILSIGNAL_REGISTRY.json');
const REQUIRED_SET_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'EXECUTION', 'REQUIRED_TOKEN_SET.json');

let modulePromise = null;

function loadModule() {
  if (!modulePromise) {
    modulePromise = import(pathToFileURL(MODULE_PATH).href);
  }
  return modulePromise;
}

test('safe local wave preflight: duplicate remote-binding preflight paths are reduced', async () => {
  const { evaluateSafeLocalWavePreflightState } = await loadModule();
  const state = evaluateSafeLocalWavePreflightState({
    repoRoot: REPO_ROOT,
    failsignalRegistryPath: FAILSIGNAL_REGISTRY_PATH,
    requiredSetPath: REQUIRED_SET_PATH,
    minReduction: 1,
  });

  assert.equal(state.ok, true);
  assert.equal(state.SAFE_LOCAL_WAVE_PREFLIGHT_OK, 1);
  assert.ok(state.duplicatePreflightBeforeAfter.before.duplicateSignalCount >= 1);
  assert.ok(state.duplicatePreflightBeforeAfter.removedDuplicateSignalPaths >= 1);
  assert.equal(state.duplicatePreflightBeforeAfter.zeroRemainingDuplicates, true);
  assert.equal(state.duplicatePreflightBeforeAfter.duplicateReductionOk, true);
});

test('safe local wave preflight: remote binding checks are skipped in local safe mode', async () => {
  const { evaluateSafeLocalWavePreflightState } = await loadModule();
  const state = evaluateSafeLocalWavePreflightState({
    repoRoot: REPO_ROOT,
    failsignalRegistryPath: FAILSIGNAL_REGISTRY_PATH,
    requiredSetPath: REQUIRED_SET_PATH,
    minReduction: 1,
  });

  const skipState = state.duplicatePreflightBeforeAfter.remoteBindingSkipOnLocalSafeMode;
  assert.equal(skipState.ok, true);
  assert.ok(skipState.beforeRemoteBindingSignalPaths.length >= 1);
  assert.equal(skipState.afterRemoteBindingSignalPaths.length, 0);
});

test('safe local wave preflight: safety parity and advisory drift remain valid', async () => {
  const { evaluateSafeLocalWavePreflightState } = await loadModule();
  const state = evaluateSafeLocalWavePreflightState({
    repoRoot: REPO_ROOT,
    failsignalRegistryPath: FAILSIGNAL_REGISTRY_PATH,
    requiredSetPath: REQUIRED_SET_PATH,
    minReduction: 1,
  });

  assert.equal(state.localPreflightSafety.ok, true);
  assert.equal(state.safetyParity.ok, true);
  assert.equal(state.safetyParity.assertBlockingSetSizeUnchanged, true);
  assert.equal(state.safetyParity.assertBlockingSetExactEqual, true);
  assert.equal(state.safetyParity.assertBlockingSetSha256Equal, true);
  assert.equal(state.advisoryToBlockingDriftCount, 0);
  assert.equal(state.advisoryToBlockingDriftCountZero, true);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'mode-aware-exit-policy-state.mjs');
const FAILSIGNAL_REGISTRY_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'FAILSIGNALS', 'FAILSIGNAL_REGISTRY.json');

let modulePromise = null;

function loadModule() {
  if (!modulePromise) {
    modulePromise = import(pathToFileURL(MODULE_PATH).href);
  }
  return modulePromise;
}

test('mode-aware exit policy: mode routing follows canonical matrix evaluator', async () => {
  const { evaluateModeAwareExitPolicyState } = await loadModule();
  const state = evaluateModeAwareExitPolicyState({
    repoRoot: REPO_ROOT,
    failsignalRegistryPath: FAILSIGNAL_REGISTRY_PATH,
  });

  assert.equal(state.modeRouting.ok, true);
  assert.ok(state.modeRouting.caseResults.length >= 3);
  assert.equal(state.modeRouting.caseResults.every((entry) => entry.ok === true), true);
});

test('mode-aware exit policy: advisory checks never block outside matrix', async () => {
  const { evaluateModeAwareExitPolicyState } = await loadModule();
  const state = evaluateModeAwareExitPolicyState({
    repoRoot: REPO_ROOT,
    failsignalRegistryPath: FAILSIGNAL_REGISTRY_PATH,
  });

  assert.equal(state.advisoryToBlockingDriftCount, 0);
  assert.equal(state.advisoryToBlockingDriftCountZero, true);
  assert.deepEqual(state.driftCases, []);
});

test('mode-aware exit policy: resume condition remains canon-locked with no relaxation', async () => {
  const { evaluateModeAwareExitPolicyState } = await loadModule();
  const state = evaluateModeAwareExitPolicyState({
    repoRoot: REPO_ROOT,
    failsignalRegistryPath: FAILSIGNAL_REGISTRY_PATH,
  });

  assert.equal(state.resumeConditionCanonLock.ok, true);
  assert.equal(
    state.resumeConditionCanonLock.canonicalResumeCondition,
    'REMOTE_AVAILABLE_PASS_AND_GH_API_OK_PASS_AND_DNS_TLS_OK_PASS',
  );
  assert.equal(
    state.resumeConditionCanonLock.observedResumeConditions.every(
      (value) => value === 'remote_available=PASS_AND_gh_api_ok=PASS_AND_dns_tls_ok=PASS'
        || value === 'NONE',
    ),
    true,
  );
  assert.equal(state.exitPolicyBeforeAfter.ok, true);
  assert.equal(state.exitPolicyBeforeAfter.mismatchCount, 0);
  assert.equal(state.releasePromotionParity.ok, true);
  assert.equal(state.releasePromotionParity.mismatchCount, 0);
  assert.equal(state.MODE_AWARE_EXIT_POLICY_OK, 1);
  assert.equal(state.ok, true);
});

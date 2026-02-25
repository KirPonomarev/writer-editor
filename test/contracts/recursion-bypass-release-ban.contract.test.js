const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'recursion-bypass-release-ban-state.mjs');
const GUARD_PATH = path.join(REPO_ROOT, 'scripts', 'guards', 'ops-current-wave-stop.mjs');
const FAILSIGNAL_REGISTRY_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'FAILSIGNALS', 'FAILSIGNAL_REGISTRY.json');

let modulePromise = null;

function loadModule() {
  if (!modulePromise) {
    modulePromise = import(pathToFileURL(MODULE_PATH).href);
  }
  return modulePromise;
}

test('recursion bypass release ban: release context bypass is forbidden', async () => {
  const { evaluateRecursionBypassReleaseBan } = await loadModule();
  const state = evaluateRecursionBypassReleaseBan({
    repoRoot: REPO_ROOT,
    guardPath: GUARD_PATH,
    failsignalRegistryPath: FAILSIGNAL_REGISTRY_PATH,
  });

  assert.equal(state.releaseContextBypassDisabled, true);
  assert.equal(state.attempts.release.exitCode !== 0, true);
  assert.equal(state.attempts.release.failSignal, 'E_GOVERNANCE_STRICT_FAIL');
});

test('recursion bypass release ban: promotion context bypass is forbidden', async () => {
  const { evaluateRecursionBypassReleaseBan } = await loadModule();
  const state = evaluateRecursionBypassReleaseBan({
    repoRoot: REPO_ROOT,
    guardPath: GUARD_PATH,
    failsignalRegistryPath: FAILSIGNAL_REGISTRY_PATH,
  });

  assert.equal(state.promotionContextBypassDisabled, true);
  assert.equal(state.attempts.promotion.exitCode !== 0, true);
  assert.equal(state.attempts.promotion.failSignal, 'E_GOVERNANCE_STRICT_FAIL');
});

test('recursion bypass release ban: negative bypass attempt fails with declared failSignal', async () => {
  const { evaluateRecursionBypassReleaseBan } = await loadModule();
  const state = evaluateRecursionBypassReleaseBan({
    repoRoot: REPO_ROOT,
    guardPath: GUARD_PATH,
    failsignalRegistryPath: FAILSIGNAL_REGISTRY_PATH,
  });

  assert.equal(state.negativeBypassAttemptFails, true);
  assert.equal(state.attempts.negative.exitCode !== 0, true);
  assert.equal(state.attempts.negative.failSignal, 'E_GOVERNANCE_STRICT_FAIL');
  assert.equal(state.failSignalCode, '');
});

test('recursion bypass release ban: advisory to blocking drift stays zero', async () => {
  const { evaluateRecursionBypassReleaseBan } = await loadModule();
  const state = evaluateRecursionBypassReleaseBan({
    repoRoot: REPO_ROOT,
    guardPath: GUARD_PATH,
    failsignalRegistryPath: FAILSIGNAL_REGISTRY_PATH,
  });

  assert.equal(state.advisoryToBlockingDriftCount, 0);
  assert.equal(state.advisoryToBlockingDriftCountZero, true);
  assert.equal(state.ok, true);
  assert.equal(state.RECURSION_BYPASS_RELEASE_BAN_OK, 1);
});

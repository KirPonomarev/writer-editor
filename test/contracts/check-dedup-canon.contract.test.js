const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'check-dedup-canon-state.mjs');
const FAILSIGNAL_REGISTRY_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'FAILSIGNALS', 'FAILSIGNAL_REGISTRY.json');
const REQUIRED_SET_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'EXECUTION', 'REQUIRED_TOKEN_SET.json');

let modulePromise = null;

function loadModule() {
  if (!modulePromise) {
    modulePromise = import(pathToFileURL(MODULE_PATH).href);
  }
  return modulePromise;
}

test('check dedup canon: duplicate signal paths are reduced by at least minimum', async () => {
  const { evaluateCheckDedupCanonState } = await loadModule();
  const state = evaluateCheckDedupCanonState({
    repoRoot: REPO_ROOT,
    failsignalRegistryPath: FAILSIGNAL_REGISTRY_PATH,
    requiredSetPath: REQUIRED_SET_PATH,
    minReduction: 2,
  });

  assert.equal(state.ok, true);
  assert.equal(state.CHECK_DEDUP_CANON_OK, 1);
  assert.ok(state.duplicateChecksBeforeAfter.before.duplicateSignalCount >= 1);
  assert.ok(state.duplicateChecksBeforeAfter.removedDuplicateSignalPaths >= 2);
  assert.equal(state.duplicateChecksBeforeAfter.duplicateReductionOk, true);
});

test('check dedup canon: unique-signal map uses one canonical source per signal', async () => {
  const { evaluateCheckDedupCanonState } = await loadModule();
  const state = evaluateCheckDedupCanonState({
    repoRoot: REPO_ROOT,
    failsignalRegistryPath: FAILSIGNAL_REGISTRY_PATH,
    requiredSetPath: REQUIRED_SET_PATH,
    minReduction: 2,
  });

  const canonicalSources = new Set();
  for (const row of state.uniqueSignalMap) {
    assert.ok(row.signal);
    assert.ok(row.canonicalSource);
    assert.equal(row.removedDuplicateSources.includes(row.canonicalSource), false);
    canonicalSources.add(`${row.signal}::${row.canonicalSource}`);
  }

  assert.equal(canonicalSources.size, state.uniqueSignalMap.length);
  assert.equal(state.duplicateChecksBeforeAfter.after.duplicateSignalCount, 0);
});

test('check dedup canon: safety parity is preserved and advisory drift stays zero', async () => {
  const { evaluateCheckDedupCanonState } = await loadModule();
  const state = evaluateCheckDedupCanonState({
    repoRoot: REPO_ROOT,
    failsignalRegistryPath: FAILSIGNAL_REGISTRY_PATH,
    requiredSetPath: REQUIRED_SET_PATH,
    minReduction: 2,
  });

  assert.equal(state.safetyParity.ok, true);
  assert.equal(state.safetyParity.assertBlockingSetSizeUnchanged, true);
  assert.equal(state.safetyParity.assertBlockingSetExactEqual, true);
  assert.equal(state.safetyParity.assertBlockingSetSha256Equal, true);
  assert.equal(state.advisoryToBlockingDriftCount, 0);
  assert.equal(state.advisoryToBlockingDriftCountZero, true);
});

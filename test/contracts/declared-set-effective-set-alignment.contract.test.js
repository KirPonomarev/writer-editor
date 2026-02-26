const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'declared-set-effective-set-alignment-state.mjs');
const DECLARED_SET_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'STATUS', 'REQUIRED_SET_PHASE_3_V1.json');
const TOKEN_CATALOG_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'TOKENS', 'TOKEN_CATALOG.json');
const FAILSIGNAL_REGISTRY_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'FAILSIGNALS', 'FAILSIGNAL_REGISTRY.json');

let modulePromise = null;

function loadModule() {
  if (!modulePromise) {
    modulePromise = import(pathToFileURL(MODULE_PATH).href);
  }
  return modulePromise;
}

test('declared/effective alignment: each declared release token exists in effective set', async () => {
  const { evaluateDeclaredSetEffectiveSetAlignment } = await loadModule();

  const state = evaluateDeclaredSetEffectiveSetAlignment({
    repoRoot: REPO_ROOT,
    declaredSetPath: DECLARED_SET_PATH,
    tokenCatalogPath: TOKEN_CATALOG_PATH,
    failsignalRegistryPath: FAILSIGNAL_REGISTRY_PATH,
  });

  assert.equal(state.ok, true);
  assert.equal(state.DECLARED_SET_EFFECTIVE_SET_ALIGNMENT_HARDENING_OK, 1);
  assert.equal(state.declaredSetDefinedCheck, true);
  assert.equal(state.effectiveSetComputedCheck, true);
  assert.equal(state.declaredEffectiveAlignmentZeroMissingCheck, true);
  assert.equal(state.missingDeclaredCount, 0);
  assert.equal(state.extraEffectiveCount, 0);
});

test('declared/effective alignment negative: remove one declared token from effective set returns fail', async () => {
  const { evaluateDeclaredSetEffectiveSetAlignment } = await loadModule();

  const baseline = evaluateDeclaredSetEffectiveSetAlignment({
    repoRoot: REPO_ROOT,
    declaredSetPath: DECLARED_SET_PATH,
    tokenCatalogPath: TOKEN_CATALOG_PATH,
    failsignalRegistryPath: FAILSIGNAL_REGISTRY_PATH,
  });

  assert.ok(baseline.declaredSet.length > 0, 'declared set must have at least one token');

  const removedToken = baseline.declaredSet[0];
  const mutatedEffectiveSet = baseline.declaredSet.filter((tokenId) => tokenId !== removedToken);

  const mutated = evaluateDeclaredSetEffectiveSetAlignment({
    repoRoot: REPO_ROOT,
    declaredSetPath: DECLARED_SET_PATH,
    tokenCatalogPath: TOKEN_CATALOG_PATH,
    failsignalRegistryPath: FAILSIGNAL_REGISTRY_PATH,
    effectiveSetTokenIds: mutatedEffectiveSet,
  });

  assert.equal(mutated.ok, false);
  assert.equal(mutated.DECLARED_SET_EFFECTIVE_SET_ALIGNMENT_HARDENING_OK, 0);
  assert.equal(mutated.declaredEffectiveAlignmentZeroMissingCheck, false);
  assert.equal(mutated.failReason, 'E_DECLARED_EFFECTIVE_ALIGNMENT_DRIFT');
  assert.ok(mutated.missingDeclaredTokens.includes(removedToken));
});

test('declared/effective alignment: report includes missing and extra counts', async () => {
  const { evaluateDeclaredSetEffectiveSetAlignment } = await loadModule();

  const state = evaluateDeclaredSetEffectiveSetAlignment({
    repoRoot: REPO_ROOT,
    declaredSetPath: DECLARED_SET_PATH,
    tokenCatalogPath: TOKEN_CATALOG_PATH,
    failsignalRegistryPath: FAILSIGNAL_REGISTRY_PATH,
  });

  assert.equal(typeof state.missingDeclaredCount, 'number');
  assert.equal(typeof state.extraEffectiveCount, 'number');
  assert.equal(state.missingDeclaredTokens.length, state.missingDeclaredCount);
  assert.equal(state.extraEffectiveTokens.length, state.extraEffectiveCount);
});

test('declared/effective alignment: advisory signals do not escalate to blocking outside canonical mode matrix', async () => {
  const { evaluateDeclaredSetEffectiveSetAlignment } = await loadModule();

  const state = evaluateDeclaredSetEffectiveSetAlignment({
    repoRoot: REPO_ROOT,
    declaredSetPath: DECLARED_SET_PATH,
    tokenCatalogPath: TOKEN_CATALOG_PATH,
    failsignalRegistryPath: FAILSIGNAL_REGISTRY_PATH,
  });

  assert.equal(state.advisoryToBlockingDriftCount, 0);
  assert.equal(state.advisoryToBlockingDriftCountZero, true);
  assert.equal(state.singleBlockingAuthority.ok, true);
});

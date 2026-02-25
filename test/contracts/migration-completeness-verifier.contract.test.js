const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'migration-completeness-verifier-state.mjs');
const FAILSIGNAL_REGISTRY_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'FAILSIGNALS', 'FAILSIGNAL_REGISTRY.json');
const REQUIRED_SET_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'EXECUTION', 'REQUIRED_TOKEN_SET.json');

let modulePromise = null;

function loadModule() {
  if (!modulePromise) {
    modulePromise = import(pathToFileURL(MODULE_PATH).href);
  }
  return modulePromise;
}

test('migration completeness verifier: declared migration steps are fully covered', async () => {
  const { evaluateMigrationCompletenessVerifierState } = await loadModule();
  const state = evaluateMigrationCompletenessVerifierState({
    repoRoot: REPO_ROOT,
    failsignalRegistryPath: FAILSIGNAL_REGISTRY_PATH,
    requiredSetPath: REQUIRED_SET_PATH,
  });

  assert.equal(state.ok, true);
  assert.equal(state.MIGRATION_COMPLETENESS_VERIFIER_OK, 1);
  assert.equal(state.coverage.coverageOk, true);
  assert.equal(state.coverage.coveragePct, 100);
  assert.equal(state.coverage.requiredDeclaredCount, state.coverage.requiredVerifiedCount);
  assert.deepEqual(state.coverage.missingSteps, []);
});

test('migration completeness verifier: missing declared required step fails verification', async () => {
  const {
    evaluateMigrationCompletenessVerifierState,
    DEFAULT_DECLARED_STEPS,
  } = await loadModule();
  const removedStep = DEFAULT_DECLARED_STEPS[0];
  const overridden = DEFAULT_DECLARED_STEPS.filter((row) => row.id !== removedStep.id);
  const state = evaluateMigrationCompletenessVerifierState({
    repoRoot: REPO_ROOT,
    declaredSteps: overridden,
    failsignalRegistryPath: FAILSIGNAL_REGISTRY_PATH,
    requiredSetPath: REQUIRED_SET_PATH,
  });

  const coverageFailure = state.coverage.coverageOk === false
    || state.coverage.requiredDeclaredCount !== DEFAULT_DECLARED_STEPS.length;

  assert.equal(coverageFailure, true);
});

test('migration completeness verifier: backward compatibility and advisory drift stay valid', async () => {
  const { evaluateMigrationCompletenessVerifierState } = await loadModule();
  const state = evaluateMigrationCompletenessVerifierState({
    repoRoot: REPO_ROOT,
    failsignalRegistryPath: FAILSIGNAL_REGISTRY_PATH,
    requiredSetPath: REQUIRED_SET_PATH,
  });

  assert.equal(state.backwardCompatibility.ok, true);
  assert.equal(state.safetyParity.ok, true);
  assert.equal(state.safetyParity.assertBlockingSetSizeUnchanged, true);
  assert.equal(state.safetyParity.assertBlockingSetExactEqual, true);
  assert.equal(state.safetyParity.assertBlockingSetSha256Equal, true);
  assert.equal(state.advisoryToBlockingDriftCount, 0);
  assert.equal(state.advisoryToBlockingDriftCountZero, true);
});

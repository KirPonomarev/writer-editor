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

test('migration completeness verifier: declared chain coverage is 100 percent', async () => {
  const { evaluateMigrationCompletenessVerifierState } = await loadModule();
  const state = evaluateMigrationCompletenessVerifierState({
    repoRoot: REPO_ROOT,
    failsignalRegistryPath: FAILSIGNAL_REGISTRY_PATH,
    requiredSetPath: REQUIRED_SET_PATH,
  });

  assert.equal(state.ok, true);
  assert.equal(state.MIGRATION_COMPLETENESS_VERIFIER_OK, 1);
  assert.equal(state.migrationCoverage.coverage100, true);
  assert.equal(state.migrationCoverage.declaredStepCount > 0, true);
  assert.equal(state.migrationCoverage.declaredStepCount, state.migrationCoverage.verifiedStepCount);
  assert.equal(state.migrationGapReport.missingStepCount, 0);
});

test('migration completeness verifier: removing one required step fails completeness', async () => {
  const { evaluateMigrationCompletenessVerifierState } = await loadModule();
  const state = evaluateMigrationCompletenessVerifierState({
    repoRoot: REPO_ROOT,
    failsignalRegistryPath: FAILSIGNAL_REGISTRY_PATH,
    requiredSetPath: REQUIRED_SET_PATH,
  });

  const negative = state.migrationNegativeMissingStep;
  assert.equal(negative.ok, true);
  assert.equal(Boolean(negative.simulatedRemovedStepId), true);
  assert.equal(negative.completenessOkBeforeDrop, true);
  assert.equal(negative.completenessOkAfterDrop, false);
  assert.equal(negative.missingStepDetected, true);
});

test('migration completeness verifier: backward compatibility and drift checks stay green', async () => {
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

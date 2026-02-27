const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'race-safe-governance-state.mjs');
const PHASE_SWITCH_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'STATUS', 'PHASE_SWITCH_V1.json');
const FAILSIGNAL_REGISTRY_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'FAILSIGNALS', 'FAILSIGNAL_REGISTRY.json');

let modulePromise = null;

function loadModule() {
  if (!modulePromise) {
    modulePromise = import(pathToFileURL(MODULE_PATH).href);
  }
  return modulePromise;
}

function evaluateBaseline(evaluateRaceSafeGovernanceState) {
  return evaluateRaceSafeGovernanceState({
    repoRoot: REPO_ROOT,
    phaseSwitchPath: PHASE_SWITCH_PATH,
    failsignalRegistryPath: FAILSIGNAL_REGISTRY_PATH,
  });
}

test('race-safe governance: serialized merge discipline is enforced', async () => {
  const { evaluateRaceSafeGovernanceState } = await loadModule();
  const state = evaluateBaseline(evaluateRaceSafeGovernanceState);

  assert.equal(state.ok, true, JSON.stringify(state, null, 2));
  assert.equal(state.RACE_SAFE_GOVERNANCE_FOR_CORE_ARTIFACTS_OK, 1);
  assert.equal(state.serializedMergeDisciplineCheck, true);
  assert.ok(state.serializedQueueCases.every((entry) => entry.pass === true));
});

test('race-safe governance: compare-and-swap lock semantics are enforced', async () => {
  const { evaluateRaceSafeGovernanceState } = await loadModule();
  const state = evaluateBaseline(evaluateRaceSafeGovernanceState);

  assert.equal(state.compareAndSwapLockCheck, true);
  assert.ok(state.compareAndSwapCases.every((entry) => entry.pass === true));
});

test('race-safe governance: parallel PR revalidation and interleaving negative fixtures pass', async () => {
  const { evaluateRaceSafeGovernanceState } = await loadModule();
  const state = evaluateBaseline(evaluateRaceSafeGovernanceState);

  assert.equal(state.parallelPrRevalidationCheck, true);
  assert.equal(state.interleavingNegativeFixtureCheck, true);
  assert.ok(state.parallelPrRevalidationCases.every((entry) => entry.pass === true));
  assert.ok(state.mergeInterleavingNegativeCases.every((entry) => entry.pass === true));
});

test('race-safe governance: automated queue enforcement is active', async () => {
  const { evaluateRaceSafeGovernanceState } = await loadModule();
  const state = evaluateBaseline(evaluateRaceSafeGovernanceState);

  assert.equal(state.automatedQueueEnforcementCheck, true);
  assert.ok(state.automatedQueueCases.every((entry) => entry.pass === true));
  assert.equal(state.coreArtifactsLockProof.ok, true);
});

test('race-safe governance: advisory signals cannot escalate to blocking outside canonical evaluator', async () => {
  const { evaluateRaceSafeGovernanceState } = await loadModule();
  const state = evaluateBaseline(evaluateRaceSafeGovernanceState);

  assert.equal(state.advisoryToBlockingDriftCount, 0);
  assert.equal(state.advisoryToBlockingDriftCountZero, true);
  assert.equal(state.singleBlockingAuthority.ok, true);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'concurrency-locking-state.mjs');
const PHASE_SWITCH_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'STATUS', 'PHASE_SWITCH_V1.json');
const FAILSIGNAL_REGISTRY_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'FAILSIGNALS', 'FAILSIGNAL_REGISTRY.json');

let modulePromise = null;

function loadModule() {
  if (!modulePromise) {
    modulePromise = import(pathToFileURL(MODULE_PATH).href);
  }
  return modulePromise;
}

function evaluateBaseline(evaluateConcurrencyLockingState) {
  return evaluateConcurrencyLockingState({
    repoRoot: REPO_ROOT,
    phaseSwitchPath: PHASE_SWITCH_PATH,
    failsignalRegistryPath: FAILSIGNAL_REGISTRY_PATH,
  });
}

test('concurrency locking: baseline checks pass and token is emitted', async () => {
  const { evaluateConcurrencyLockingState } = await loadModule();
  const state = evaluateBaseline(evaluateConcurrencyLockingState);

  assert.equal(state.ok, true, JSON.stringify(state, null, 2));
  assert.equal(state.CONCURRENCY_LOCKING_FOR_SHARED_GOVERNANCE_ARTIFACTS_OK, 1);
  assert.equal(state.lockAcquireReleaseCheck, true);
  assert.equal(state.compareAndSwapConflictCheck, true);
  assert.equal(state.interleavingProtectionCheck, true);
  assert.equal(state.serializedQueueEnforcementCheck, true);
});

test('concurrency locking: invalid lock expectations fail lock acquire-release check', async () => {
  const { evaluateConcurrencyLockingState } = await loadModule();
  const state = evaluateConcurrencyLockingState({
    repoRoot: REPO_ROOT,
    phaseSwitchPath: PHASE_SWITCH_PATH,
    failsignalRegistryPath: FAILSIGNAL_REGISTRY_PATH,
    lockAcquireReleaseInput: {
      operations: [
        { caseId: 'acquire-a', type: 'acquire', actor: 'writer-a', expect: true },
        { caseId: 'acquire-b-incorrect-expectation', type: 'acquire', actor: 'writer-b', expect: true },
      ],
    },
  });

  assert.equal(state.lockAcquireReleaseCheck, false);
  assert.equal(state.ok, false);
});

test('concurrency locking: stale CAS conflict bypass is detected', async () => {
  const { evaluateConcurrencyLockingState } = await loadModule();
  const state = evaluateConcurrencyLockingState({
    repoRoot: REPO_ROOT,
    phaseSwitchPath: PHASE_SWITCH_PATH,
    failsignalRegistryPath: FAILSIGNAL_REGISTRY_PATH,
    compareAndSwapInput: {
      enableStaleConflictBypass: true,
    },
  });

  assert.equal(state.compareAndSwapConflictCheck, false);
  assert.equal(state.ok, false);
});

test('concurrency locking: interleaving bypass and duplicate-queue bypass are detected', async () => {
  const { evaluateConcurrencyLockingState } = await loadModule();
  const state = evaluateConcurrencyLockingState({
    repoRoot: REPO_ROOT,
    phaseSwitchPath: PHASE_SWITCH_PATH,
    failsignalRegistryPath: FAILSIGNAL_REGISTRY_PATH,
    interleavingInput: {
      allowStaleWrite: true,
      allowLockBypass: true,
    },
    serializedQueueInput: {
      duplicateQueue: [
        { opId: 'dq-a', seq: 1 },
        { opId: 'dq-b', seq: 2 },
      ],
    },
  });

  assert.equal(state.interleavingProtectionCheck, false);
  assert.equal(state.serializedQueueEnforcementCheck, false);
  assert.equal(state.ok, false);
});

test('concurrency locking: advisory signals do not drift to blocking outside canonical evaluator', async () => {
  const { evaluateConcurrencyLockingState } = await loadModule();
  const state = evaluateBaseline(evaluateConcurrencyLockingState);

  assert.equal(state.advisoryToBlockingDriftCount, 0);
  assert.equal(state.advisoryToBlockingDriftCountZero, true);
  assert.equal(state.singleBlockingAuthority.ok, true);
});

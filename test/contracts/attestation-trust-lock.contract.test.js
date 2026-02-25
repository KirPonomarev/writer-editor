const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'attestation-trust-lock-state.mjs');
const FAILSIGNAL_REGISTRY_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'FAILSIGNALS', 'FAILSIGNAL_REGISTRY.json');

let modulePromise = null;

function loadModule() {
  if (!modulePromise) {
    modulePromise = import(pathToFileURL(MODULE_PATH).href);
  }
  return modulePromise;
}

test('attestation trust lock: trusted context passes enforcement', async () => {
  const {
    evaluateAttestationTrustLockState,
    TRUST_LOCK_ID,
    TRUST_PROVIDER,
  } = await loadModule();

  const state = evaluateAttestationTrustLockState({
    repoRoot: REPO_ROOT,
    failsignalRegistryPath: FAILSIGNAL_REGISTRY_PATH,
    payload: {
      attestationKind: 'POST_MERGE_VERIFY',
      taskId: 'strict-verify-release',
      verifyPath: 'scripts/ops/post-merge-verify.mjs',
      verifyOk: 1,
      trustedContext: {
        trustProvider: TRUST_PROVIDER,
        trustLockId: TRUST_LOCK_ID,
        contextId: 'ctx-contract-positive',
        source: 'trusted_context_record',
      },
    },
  });

  assert.equal(state.ok, true);
  assert.equal(state.ATTESTATION_TRUST_LOCK_ENFORCEMENT_OK, 1);
  assert.equal(state.failSignalCode, '');
  assert.equal(state.advisoryToBlockingDriftCount, 0);
});

test('attestation trust lock: self-generated payload fails with canonical failSignal', async () => {
  const {
    evaluateAttestationTrustLockState,
    TRUST_LOCK_ID,
    TRUST_PROVIDER,
    FORBIDDEN_CONTEXT_SOURCE,
  } = await loadModule();

  const state = evaluateAttestationTrustLockState({
    repoRoot: REPO_ROOT,
    failsignalRegistryPath: FAILSIGNAL_REGISTRY_PATH,
    payload: {
      attestationKind: 'POST_MERGE_VERIFY',
      taskId: 'strict-verify-release',
      verifyPath: 'scripts/ops/post-merge-verify.mjs',
      verifyOk: 1,
      trustedContext: {
        trustProvider: TRUST_PROVIDER,
        trustLockId: TRUST_LOCK_ID,
        contextId: 'ctx-contract-negative',
        source: FORBIDDEN_CONTEXT_SOURCE,
      },
    },
  });

  assert.equal(state.ok, false);
  assert.equal(state.ATTESTATION_TRUST_LOCK_ENFORCEMENT_OK, 0);
  assert.equal(state.failSignalCode, 'E_VERIFY_ATTESTATION_INVALID');
  assert.equal(state.failReason, 'SELF_GENERATED_PAYLOAD_FORBIDDEN');
});

test('attestation trust lock: repeatable pass remains stable across three runs', async () => {
  const {
    evaluateAttestationTrustLockState,
    TRUST_LOCK_ID,
    TRUST_PROVIDER,
  } = await loadModule();

  const runs = [];
  for (let i = 0; i < 3; i += 1) {
    const state = evaluateAttestationTrustLockState({
      repoRoot: REPO_ROOT,
      failsignalRegistryPath: FAILSIGNAL_REGISTRY_PATH,
      payload: {
        attestationKind: 'POST_MERGE_VERIFY',
        taskId: 'strict-verify-release',
        verifyPath: 'scripts/ops/post-merge-verify.mjs',
        verifyOk: 1,
        trustedContext: {
          trustProvider: TRUST_PROVIDER,
          trustLockId: TRUST_LOCK_ID,
          contextId: 'ctx-contract-repeatable',
          source: 'trusted_context_record',
        },
      },
    });

    runs.push({
      ok: state.ok,
      token: state.ATTESTATION_TRUST_LOCK_ENFORCEMENT_OK,
      failReason: state.failReason,
      failSignalCode: state.failSignalCode,
      advisoryToBlockingDriftCount: state.advisoryToBlockingDriftCount,
    });
  }

  assert.deepEqual(runs[0], runs[1]);
  assert.deepEqual(runs[1], runs[2]);
  assert.equal(runs[0].ok, true);
  assert.equal(runs[0].token, 1);
  assert.equal(runs[0].advisoryToBlockingDriftCount, 0);
});

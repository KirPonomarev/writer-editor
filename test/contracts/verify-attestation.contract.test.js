const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

let modulePromise = null;

function loadModule() {
  if (!modulePromise) {
    const href = pathToFileURL(
      path.join(process.cwd(), 'scripts/ops/verify-attestation-state.mjs'),
    ).href;
    modulePromise = import(href);
  }
  return modulePromise;
}

test('verify attestation state: baseline-attestation-is-valid-with-signature-gate-in-dev', async () => {
  const { evaluateVerifyAttestationState } = await loadModule();
  const state = evaluateVerifyAttestationState({ profile: 'dev' });
  assert.equal(state.ok, true);
  assert.equal(state.VERIFY_ATTESTATION_OK, 1);
  assert.equal(state.code, '');
  assert.equal(state.details.attestationKind, 'POST_MERGE_VERIFY');
  assert.equal(state.details.signatureTokenOk, 1);
});

test('verify attestation state: wrong-signer-fails-signature-gate', async () => {
  const { evaluateVerifyAttestationState } = await loadModule();
  const state = evaluateVerifyAttestationState({
    attestationState: {
      POST_MERGE_VERIFY_ATTESTATION_EMITTED: 1,
      attestationKind: 'POST_MERGE_VERIFY',
      taskId: 'strict-verify-release',
      verifyPath: 'scripts/ops/post-merge-verify.mjs',
      verifyOk: 1,
      signerId: 'untrusted-signer',
      trustRootId: 'trust-root-release-v1',
      trustContextId: 'ctx-post-merge-verify-main',
      trustContextSource: 'trusted_context_record',
      payloadOrigin: 'external',
      isSynthetic: false,
      externalArtifactId: 'ATTESTATION_TRUST_ARTIFACT_LOCK_v1',
    },
  });
  assert.equal(state.ok, false);
  assert.equal(state.VERIFY_ATTESTATION_OK, 0);
  assert.equal(state.code, 'E_VERIFY_ATTESTATION_INVALID');
  assert.equal(state.details.signatureTokenOk, 0);
  assert.equal(state.details.signatureFailReason, 'WRONG_SIGNER_REJECT');
});

test('verify attestation state: missing-attestation-fails-in-release', async () => {
  const { evaluateVerifyAttestationState } = await loadModule();
  const state = evaluateVerifyAttestationState({ profile: 'release' });
  assert.equal(state.ok, false);
  assert.equal(state.VERIFY_ATTESTATION_OK, 0);
  assert.equal(state.code, 'E_VERIFY_ATTESTATION_INVALID');
  assert.equal(state.details.failReason, 'MISSING_ATTESTATION_STATE');
});

test('verify attestation state: missing-attestation-fails-in-promotion', async () => {
  const { evaluateVerifyAttestationState } = await loadModule();
  const state = evaluateVerifyAttestationState({ profile: 'dev', promotionMode: true });
  assert.equal(state.ok, false);
  assert.equal(state.VERIFY_ATTESTATION_OK, 0);
  assert.equal(state.code, 'E_VERIFY_ATTESTATION_INVALID');
  assert.equal(state.details.failReason, 'MISSING_ATTESTATION_STATE');
});

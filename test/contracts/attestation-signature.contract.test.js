const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

let modulePromise = null;

function loadModule() {
  if (!modulePromise) {
    const href = pathToFileURL(
      path.join(process.cwd(), 'scripts/ops/attestation-signature-state.mjs'),
    ).href;
    modulePromise = import(href);
  }
  return modulePromise;
}

async function buildPositivePayload() {
  const { evaluateAttestationSignatureState } = await loadModule();
  const baseline = evaluateAttestationSignatureState();
  return baseline.details.payload;
}

test('attestation signature state: local-trusted-artifact-signature-pass', async () => {
  const { evaluateAttestationSignatureState } = await loadModule();
  const state = evaluateAttestationSignatureState();
  assert.equal(state.ok, true);
  assert.equal(state.ATTESTATION_SIGNATURE_OK, 1);
  assert.equal(state.code, '');
  assert.match(String(state.details.signature || ''), /^[0-9a-f]{64}$/u);
});

test('attestation signature state: synthetic-payload-reject', async () => {
  const { evaluateAttestationSignatureState } = await loadModule();
  const payload = await buildPositivePayload();
  payload.isSynthetic = true;
  payload.payloadOrigin = 'synthetic';
  const state = evaluateAttestationSignatureState({ payload });
  assert.equal(state.ok, false);
  assert.equal(state.ATTESTATION_SIGNATURE_OK, 0);
  assert.equal(state.code, 'E_ATTESTATION_SIGNATURE_INVALID');
  assert.equal(state.failReason, 'SYNTHETIC_PAYLOAD_REJECT');
});

test('attestation signature state: self-context-reject', async () => {
  const { evaluateAttestationSignatureState } = await loadModule();
  const payload = await buildPositivePayload();
  payload.trustContextSource = 'self_generated';
  const state = evaluateAttestationSignatureState({ payload });
  assert.equal(state.ok, false);
  assert.equal(state.ATTESTATION_SIGNATURE_OK, 0);
  assert.equal(state.code, 'E_ATTESTATION_SIGNATURE_INVALID');
  assert.equal(state.failReason, 'SELF_CONTEXT_REJECT');
});

test('attestation signature state: missing-trust-root-reject', async () => {
  const { evaluateAttestationSignatureState } = await loadModule();
  const payload = await buildPositivePayload();
  payload.trustRootId = '';
  const state = evaluateAttestationSignatureState({ payload });
  assert.equal(state.ok, false);
  assert.equal(state.ATTESTATION_SIGNATURE_OK, 0);
  assert.equal(state.code, 'E_ATTESTATION_SIGNATURE_INVALID');
  assert.equal(state.failReason, 'MISSING_TRUST_ROOT_REJECT');
});

test('attestation signature state: wrong-signer-reject', async () => {
  const { evaluateAttestationSignatureState } = await loadModule();
  const payload = await buildPositivePayload();
  payload.signerId = 'untrusted-signer';
  const state = evaluateAttestationSignatureState({ payload });
  assert.equal(state.ok, false);
  assert.equal(state.ATTESTATION_SIGNATURE_OK, 0);
  assert.equal(state.code, 'E_ATTESTATION_SIGNATURE_INVALID');
  assert.equal(state.failReason, 'WRONG_SIGNER_REJECT');
});

test('attestation signature state: tampered-signature-fails-with-canonical-code', async () => {
  const { evaluateAttestationSignatureState } = await loadModule();
  const state = evaluateAttestationSignatureState({
    signature: '0'.repeat(64),
  });
  assert.equal(state.ok, false);
  assert.equal(state.ATTESTATION_SIGNATURE_OK, 0);
  assert.equal(state.code, 'E_ATTESTATION_SIGNATURE_INVALID');
});

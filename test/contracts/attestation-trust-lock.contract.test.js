const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'attestation-trust-lock-state.mjs');

let modulePromise = null;

function loadModule() {
  if (!modulePromise) {
    modulePromise = import(pathToFileURL(MODULE_PATH).href);
  }
  return modulePromise;
}

function runNode(args) {
  return spawnSync(process.execPath, [MODULE_PATH, ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
}

function buildPositivePayload() {
  return {
    BASE_SHA: '54e4d5d416729b53a47371e6b660e7c88f7087ce',
    NONCE: 'nonce-p0-04-contract',
    TIMESTAMP: '2026-02-26T00:00:00.000Z',
    KEY_ID: 'trusted-key-main-1',
    TRUST_CONTEXT_ID: 'ctx-contract-positive',
    TRUST_CONTEXT_SOURCE: 'trusted_context_record',
    SIGNATURE_TRUST_ROOT_ANCHORED: true,
    OFFLINE_VERIFIABLE_CHAIN: true,
    EXTERNAL_ARTIFACT: {
      artifactId: 'artifact-contract-positive',
      origin: 'release-pipeline-attestation-store',
      checksum: 'sha256:artifact-contract-positive',
    },
    PAYLOAD_ORIGIN: 'external',
    IS_SYNTHETIC: false,
  };
}

test('attestation trust lock: valid external artifact with trust root returns pass', async () => {
  const { evaluateAttestationTrustLockState } = await loadModule();
  const state = evaluateAttestationTrustLockState({
    mode: 'release',
    payload: buildPositivePayload(),
  });

  assert.equal(state.ok, true);
  assert.equal(state.ATTESTATION_TRUST_LOCK_ENFORCEMENT_OK, 1);
  assert.equal(state.failSignalCode, '');
  assert.equal(state.externalArtifactRequiredOk, true);
  assert.equal(state.signatureTrustRootAnchoredOk, true);
});

test('attestation trust lock: synthetic payload in release fails', async () => {
  const { evaluateAttestationTrustLockState } = await loadModule();
  const payload = buildPositivePayload();
  payload.PAYLOAD_ORIGIN = 'synthetic';
  payload.IS_SYNTHETIC = true;

  const state = evaluateAttestationTrustLockState({ mode: 'release', payload });
  assert.equal(state.ok, false);
  assert.equal(state.failReason, 'E_ATTESTATION_SYNTHETIC_DEFAULT_PASS');
  assert.equal(state.failSignalCode, 'E_VERIFY_ATTESTATION_INVALID');
});

test('attestation trust lock: self-generated trust context fails', async () => {
  const { evaluateAttestationTrustLockState } = await loadModule();
  const payload = buildPositivePayload();
  payload.TRUST_CONTEXT_SOURCE = 'self_generated';

  const state = evaluateAttestationTrustLockState({ mode: 'release', payload });
  assert.equal(state.ok, false);
  assert.equal(state.failReason, 'ATTESTATION_TRUST_INVALID');
  assert.equal(state.failSignalCode, 'E_VERIFY_ATTESTATION_INVALID');
});

test('attestation trust lock: missing required payload fields fails', async () => {
  const { evaluateAttestationTrustLockState } = await loadModule();
  const payload = buildPositivePayload();
  delete payload.NONCE;
  delete payload.TRUST_CONTEXT_ID;

  const state = evaluateAttestationTrustLockState({ mode: 'release', payload });
  assert.equal(state.ok, false);
  assert.equal(state.failReason, 'E_REQUIRED_PAYLOAD_FIELDS_MISSING');
  assert.equal(state.missingRequiredPayloadFieldsCount >= 1, true);
});

test('attestation trust lock: release and promotion invalid payload return nonzero exit', async () => {
  const payload = buildPositivePayload();
  payload.SIGNATURE_TRUST_ROOT_ANCHORED = false;

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'attestation-trust-lock-cli-'));
  const payloadPath = path.join(tmpDir, 'payload.json');
  fs.writeFileSync(payloadPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  try {
    const releaseRun = runNode(['--mode', 'release', '--payload-path', payloadPath]);
    const promotionRun = runNode(['--mode', 'promotion', '--payload-path', payloadPath]);
    assert.notEqual(releaseRun.status, 0);
    assert.notEqual(promotionRun.status, 0);

    const prRun = runNode(['--mode', 'pr', '--payload-path', payloadPath]);
    assert.equal(prRun.status, 0);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

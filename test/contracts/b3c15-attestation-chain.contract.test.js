const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MODULE_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'b3c15-attestation-chain-state.mjs');
const STATUS_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'STATUS', 'B3C15_ATTESTATION_CHAIN_STATUS_V1.json');

let modulePromise = null;

function loadModule() {
  if (!modulePromise) modulePromise = import(pathToFileURL(MODULE_PATH).href);
  return modulePromise;
}

function readJson(targetPath) {
  return JSON.parse(fs.readFileSync(targetPath, 'utf8'));
}

function normalizeDynamicState(state) {
  return {
    ...state,
    payload: {
      ...state.payload,
      headSha: 'DYNAMIC_REPO_HEAD',
    },
    repo: {
      ...state.repo,
      headSha: 'DYNAMIC_REPO_HEAD',
    },
    signature: {
      ...state.signature,
      hash: 'DYNAMIC_SIGNATURE_HASH',
    },
    signatureRows: state.signatureRows.map((row) => {
      if (row.id === 'ATTESTATION_SIGNATURE_CREATED') {
        return { ...row, signatureHash: 'DYNAMIC_SIGNATURE_HASH' };
      }
      if (row.id === 'ATTESTATION_HEAD_SHA_BOUND_DYNAMICALLY') {
        return { ...row, headSha: 'DYNAMIC_REPO_HEAD' };
      }
      return row;
    }),
  };
}

test('b3c15 attestation chain: state artifact matches stable executable fields', async () => {
  const {
    evaluateB3C15AttestationChainState,
    TOKEN_NAME,
    RELEASE_GREEN_TOKEN_NAME,
    SIGNATURE_TOKEN_NAME,
    VERIFY_TOKEN_NAME,
  } = await loadModule();
  const state = await evaluateB3C15AttestationChainState({ repoRoot: REPO_ROOT });
  const committedState = readJson(STATUS_PATH);
  const normalizedCommitted = normalizeDynamicState(committedState);
  const normalizedState = normalizeDynamicState(state);

  assert.equal(committedState.artifactId, state.artifactId);
  assert.equal(committedState.contourId, state.contourId);
  assert.equal(committedState.status, state.status);
  assert.equal(committedState[TOKEN_NAME], state[TOKEN_NAME]);
  assert.equal(committedState[RELEASE_GREEN_TOKEN_NAME], state[RELEASE_GREEN_TOKEN_NAME]);
  assert.equal(committedState[SIGNATURE_TOKEN_NAME], state[SIGNATURE_TOKEN_NAME]);
  assert.equal(committedState[VERIFY_TOKEN_NAME], state[VERIFY_TOKEN_NAME]);
  assert.deepEqual(committedState.failRows, state.failRows);
  assert.deepEqual(committedState.b3c14InputRow, state.b3c14InputRow);
  assert.deepEqual(committedState.b3c14CarriedForwardLimitRows, state.b3c14CarriedForwardLimitRows);
  assert.deepEqual(normalizedCommitted.payload, normalizedState.payload);
  assert.deepEqual(normalizedCommitted.signature, normalizedState.signature);
  assert.deepEqual(normalizedCommitted.signatureRows, normalizedState.signatureRows);
  assert.deepEqual(committedState.verifyRows, state.verifyRows);
  assert.deepEqual(committedState.negativeRows, state.negativeRows);
  assert.deepEqual(committedState.scope, state.scope);
  assert.deepEqual(committedState.donorIntake, state.donorIntake);
  assert.equal(committedState.runtime.changedBasenamesHash, state.runtime.changedBasenamesHash);
  assert.equal(Boolean(state.runtime.statusArtifactHash), true);
  assert.equal(state.ok, true, JSON.stringify(state, null, 2));
  assert.equal(state.status, 'PASS');
  assert.equal(state[TOKEN_NAME], 1);
  assert.equal(state[RELEASE_GREEN_TOKEN_NAME], 0);
  assert.equal(state[SIGNATURE_TOKEN_NAME], 1);
  assert.equal(state[VERIFY_TOKEN_NAME], 1);
  assert.deepEqual(state.failRows, []);
  assert.equal(state.repo.repoRootBinding, 'WORKTREE_INDEPENDENT');
  assert.equal(state.signature.binding, 'DYNAMIC_REPO_HEAD_AND_EXTERNAL_INPUT');
});

test('b3c15 attestation chain: CLI status remains worktree independent outside repo cwd', () => {
  const result = spawnSync(process.execPath, [MODULE_PATH], {
    cwd: os.tmpdir(),
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);

  const stdout = String(result.stdout || '');
  assert.match(stdout, /B3C15_STATUS=PASS/u);
  assert.match(stdout, /B3C15_ATTESTATION_CHAIN_OK=1/u);
  assert.match(stdout, /B3C15_RELEASE_GREEN_OK=0/u);
});

test('b3c15 attestation chain: binds B3C14 dossier and carried forward limits', async () => {
  const { evaluateB3C15AttestationChainState } = await loadModule();
  const state = await evaluateB3C15AttestationChainState({ repoRoot: REPO_ROOT });

  assert.equal(state.b3c14InputRow.basename, 'B3C14_RELEASE_DOSSIER_MINIMAL_STATUS_V1.json');
  assert.equal(state.b3c14InputRow.passed, true);
  assert.equal(state.b3c14InputRow.releaseGreen, false);
  assert.equal(state.proof.b3c14InputBound, true);
  assert.equal(state.proof.b3c14ReleaseGreenFalse, true);
  assert.equal(state.proof.b3c14CarriedForwardLimitsVisible, true);
  assert.equal(state.proof.b3c14AllSevenCarriedForwardLimitRowsPreserved, true);
  assert.equal(state.proof.b3c14CarriedForwardLimitRowCount, 7);
});

test('b3c15 attestation chain: preserves all seven B3C14 carried forward limit rows', async () => {
  const { evaluateB3C15AttestationChainState } = await loadModule();
  const state = await evaluateB3C15AttestationChainState({ repoRoot: REPO_ROOT });
  const ids = state.b3c14CarriedForwardLimitRows.map((row) => row.id).sort();

  assert.deepEqual(ids, [
    'B3C09_UNSUPPORTED_MEASUREMENTS',
    'B3C10_PROVISIONAL_PERF_AND_PLATFORM_SCOPE',
    'B3C11_REAL_PLATFORM_LIMITS',
    'B3C12_I18N_LIMITS',
    'B3C13_A11Y_LIMIT_ROWS',
    'B3C13_A11Y_UNSUPPORTED_SCOPE',
    'B3C13_B3C14_HANDOFF',
  ]);
  assert.equal(state.b3c14CarriedForwardLimitRows.every((row) => row.status === 'BOUND_LIMIT'), true);
});

test('b3c15 attestation chain: payload fields are complete and limited where release-run data is absent', async () => {
  const { evaluateB3C15AttestationChainState } = await loadModule();
  const state = await evaluateB3C15AttestationChainState({ repoRoot: REPO_ROOT });

  assert.deepEqual(Object.keys(state.payload).sort(), [
    'commandLog',
    'evidenceHash',
    'externalImmutableInputHash',
    'headBinding',
    'headSha',
    'proofhookInputHash',
    'releaseProfile',
    'requiredSetHash',
    'reviewerResult',
    'schemaVersion',
    'tokenResultsHash',
  ]);
  assert.equal(state.payload.headBinding, 'REPO_HEAD_AT_EVALUATION');
  assert.equal(Boolean(state.payload.headSha), true);
  assert.equal(state.payload.releaseProfile.status, 'LIMITED_FIXTURE_NOT_FULL_RELEASE_RUN');
  assert.equal(state.payload.commandLog.status, 'LIMITED_FIXTURE_NOT_FULL_RELEASE_RUN');
  assert.equal(state.payload.reviewerResult.status, 'EXTERNAL_INPUT_BOUND');
});

test('b3c15 attestation chain: required signature rows are present and pass', async () => {
  const { evaluateB3C15AttestationChainState } = await loadModule();
  const state = await evaluateB3C15AttestationChainState({ repoRoot: REPO_ROOT });
  const byId = new Map(state.signatureRows.map((row) => [row.id, row]));

  assert.deepEqual([...byId.keys()].sort(), [
    'ATTESTATION_EXTERNAL_INPUT_BOUND',
    'ATTESTATION_HEAD_SHA_BOUND_DYNAMICALLY',
    'ATTESTATION_PAYLOAD_SCHEMA_BOUND',
    'ATTESTATION_SIGNATURE_CREATED',
    'ATTESTATION_SIGNATURE_VERIFIES',
  ]);
  assert.equal(state.signatureRows.every((row) => row.status === 'PASS'), true);
  assert.equal(byId.get('ATTESTATION_SIGNATURE_CREATED').signatureType, 'HMAC_SHA256_EXTERNAL_INPUT_BOUND');
  assert.equal(state.signature.binding, 'DYNAMIC_REPO_HEAD_AND_EXTERNAL_INPUT');
  assert.equal(byId.get('ATTESTATION_HEAD_SHA_BOUND_DYNAMICALLY').headBinding, 'REPO_HEAD_AT_EVALUATION');
  assert.equal(state.proof.signatureRowsComplete, true);
  assert.equal(state.proof.signatureRowsPass, true);
});

test('b3c15 attestation chain: required verify rows reject bad attestations', async () => {
  const { evaluateB3C15AttestationChainState } = await loadModule();
  const state = await evaluateB3C15AttestationChainState({ repoRoot: REPO_ROOT });
  const byId = new Map(state.verifyRows.map((row) => [row.id, row]));

  assert.deepEqual([...byId.keys()].sort(), [
    'VERIFY_CHANGED_EXTERNAL_INPUT_FAIL',
    'VERIFY_HASH_MISMATCH_FAIL',
    'VERIFY_INVALID_SIGNATURE_FAIL',
    'VERIFY_MISSING_EXTERNAL_INPUT_FAIL',
    'VERIFY_SELF_SIGNED_FAIL',
    'VERIFY_STALE_HEAD_FAIL',
    'VERIFY_VALID_SIGNATURE_PASS',
  ]);
  assert.equal(state.verifyRows.every((row) => row.status === 'PASS'), true);
  assert.equal(byId.get('VERIFY_VALID_SIGNATURE_PASS').reason, 'VERIFY_OK');
  assert.notEqual(byId.get('VERIFY_SELF_SIGNED_FAIL').reason, 'VERIFY_OK');
  assert.notEqual(byId.get('VERIFY_STALE_HEAD_FAIL').reason, 'VERIFY_OK');
  assert.notEqual(byId.get('VERIFY_HASH_MISMATCH_FAIL').reason, 'VERIFY_OK');
  assert.notEqual(byId.get('VERIFY_MISSING_EXTERNAL_INPUT_FAIL').reason, 'VERIFY_OK');
  assert.notEqual(byId.get('VERIFY_CHANGED_EXTERNAL_INPUT_FAIL').reason, 'VERIFY_OK');
  assert.equal(state.proof.verifyRowsComplete, true);
  assert.equal(state.proof.verifyRowsPass, true);
});

test('b3c15 attestation chain: required negative rows pass and release green stays false', async () => {
  const { evaluateB3C15AttestationChainState, RELEASE_GREEN_TOKEN_NAME } = await loadModule();
  const state = await evaluateB3C15AttestationChainState({ repoRoot: REPO_ROOT });
  const ids = state.negativeRows.map((row) => row.id).sort();

  assert.deepEqual(ids, [
    'CHANGED_EXTERNAL_INPUT_NEGATIVE',
    'DOC_ONLY_ATTESTATION_NEGATIVE',
    'HASH_MISMATCH_NEGATIVE',
    'INVALID_SIGNATURE_NEGATIVE',
    'MISSING_EXTERNAL_INPUT_NEGATIVE',
    'OFFLINE_ATTESTATION_CHAIN_BREAK_NEGATIVE',
    'RELEASE_GREEN_FALSE_NEGATIVE',
    'SELF_SIGNED_NEGATIVE',
    'STALE_HEAD_NEGATIVE',
  ]);
  assert.equal(state.negativeRows.every((row) => row.status === 'PASS'), true);
  assert.equal(state[RELEASE_GREEN_TOKEN_NAME], 0);
  assert.equal(state.releaseGreen, false);
  assert.equal(state.proof.releaseGreenFalseBecauseB3C15Only, true);
  assert.equal(state.proof.offlineAttestationChainBreakNegativeBound, true);
  assert.equal(state.proof.attestationSignatureReleaseTokenBound, true);
  assert.equal(state.proof.verifyAttestationReleaseTokenBound, true);
});

test('b3c15 attestation chain: external immutable input is mandatory and not payload-derived', async () => {
  const { evaluateB3C15AttestationChainState } = await loadModule();
  const valid = await evaluateB3C15AttestationChainState({ repoRoot: REPO_ROOT });
  const missing = await evaluateB3C15AttestationChainState({ repoRoot: REPO_ROOT, externalImmutableInput: '' });

  assert.equal(valid.proof.externalImmutableInputPresent, true);
  assert.equal(valid.proof.externalImmutableInputCallerSupplied, true);
  assert.equal(valid.proof.externalImmutableInputNotPayloadDerived, true);
  assert.equal(valid.proof.missingExternalInputCannotPass, true);
  assert.equal(missing.ok, false);
  assert.equal(missing.failRows.includes('SIGNATURE_ROWS_FAILED'), true);
  assert.equal(missing.failRows.includes('VERIFY_ROWS_FAILED'), true);
});

test('b3c15 attestation chain: donor intake remains context only', async () => {
  const { evaluateB3C15AttestationChainState } = await loadModule();
  const state = await evaluateB3C15AttestationChainState({ repoRoot: REPO_ROOT });

  assert.equal(state.proof.donorIntakeContextOnly, true);
  assert.equal(state.donorIntake.class, 'READ_ONLY_CONTEXT_ONLY');
  assert.equal(state.donorIntake.codeImported, false);
  assert.equal(state.donorIntake.completionClaimImported, false);
  assert.equal(state.donorIntake.activeCanonOverDonor, true);
  assert.ok(state.donorIntake.archiveRows.length >= 4);
});

test('b3c15 attestation chain: forbidden acceptance claims fail evaluation', async () => {
  const { evaluateB3C15AttestationChainState } = await loadModule();
  const state = await evaluateB3C15AttestationChainState({
    repoRoot: REPO_ROOT,
    forceClaims: {
      releaseClaim: true,
      releaseGreenClaim: true,
      selfSignedAccepted: true,
      invalidSignatureAccepted: true,
      staleHeadAccepted: true,
      hashMismatchAccepted: true,
      missingExternalInputAccepted: true,
      changedExternalInputAccepted: true,
      offlineChainBreakAccepted: true,
      docOnlyAttestationAccepted: true,
    },
  });

  assert.equal(state.ok, false);
  assert.equal(state.status, 'FAIL');
  assert.equal(state.failRows.includes('NEGATIVE_ROWS_FAILED'), true);
  assert.equal(state.failRows.includes('FORBIDDEN_SCOPE_OR_RELEASE_CLAIM'), true);
  assert.equal(state.failSignal, 'E_B3C15_ATTESTATION_CHAIN_NOT_OK');
});

test('b3c15 attestation chain: scope flags reject adjacent release and runtime drift', async () => {
  const { evaluateB3C15AttestationChainState } = await loadModule();
  const state = await evaluateB3C15AttestationChainState({ repoRoot: REPO_ROOT });

  assert.equal(state.scope.attestationChainOnly, true);
  assert.equal(state.scope.releaseClaim, false);
  assert.equal(state.scope.releaseGreenClaim, false);
  assert.equal(state.scope.packageBuild, false);
  assert.equal(state.scope.packageHashGeneration, false);
  assert.equal(state.scope.supplyChainImplementation, false);
  assert.equal(state.scope.exportRewrite, false);
  assert.equal(state.scope.securityRewrite, false);
  assert.equal(state.scope.perfFix, false);
  assert.equal(state.scope.xplatCertification, false);
  assert.equal(state.scope.a11yCertification, false);
  assert.equal(state.scope.uiWork, false);
  assert.equal(state.scope.storageChange, false);
  assert.equal(state.scope.commandSurfaceChange, false);
  assert.equal(state.scope.newDependency, false);
  assert.equal(state.scope.block2Reopen, false);
  assert.equal(state.scope.b3c14Rewrite, false);
  assert.equal(state.scope.b3c09ToB3c13Reopen, false);
});

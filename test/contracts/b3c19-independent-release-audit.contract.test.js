const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MODULE_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'b3c19-independent-release-audit-state.mjs');
const STATUS_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'STATUS', 'B3C19_INDEPENDENT_RELEASE_AUDIT_STATUS_V1.json');

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
    repo: {
      ...state.repo,
      headSha: 'DYNAMIC_REPO_HEAD',
    },
  };
}

test('b3c19 independent release audit: state artifact matches stable executable fields', async () => {
  const {
    evaluateB3C19IndependentReleaseAuditState,
    TOKEN_NAME,
    RELEASE_GREEN_TOKEN_NAME,
  } = await loadModule();
  const state = await evaluateB3C19IndependentReleaseAuditState({ repoRoot: REPO_ROOT });
  const committedState = readJson(STATUS_PATH);
  const normalizedCommitted = normalizeDynamicState(committedState);
  const normalizedState = normalizeDynamicState(state);

  assert.equal(committedState.artifactId, state.artifactId);
  assert.equal(committedState.contourId, state.contourId);
  assert.equal(committedState.status, state.status);
  assert.equal(committedState[TOKEN_NAME], state[TOKEN_NAME]);
  assert.equal(committedState[RELEASE_GREEN_TOKEN_NAME], state[RELEASE_GREEN_TOKEN_NAME]);
  assert.deepEqual(committedState.failRows, state.failRows);
  assert.deepEqual(committedState.inputRows, state.inputRows);
  assert.deepEqual(committedState.auditRows, state.auditRows);
  assert.deepEqual(committedState.layerMixRows, state.layerMixRows);
  assert.deepEqual(committedState.findingRows, state.findingRows);
  assert.deepEqual(committedState.nonblockingRows, state.nonblockingRows);
  assert.deepEqual(committedState.negativeRows, state.negativeRows);
  assert.deepEqual(committedState.scope, state.scope);
  assert.deepEqual(normalizedCommitted.repo, normalizedState.repo);
  assert.equal(committedState.runtime.changedBasenamesHash, state.runtime.changedBasenamesHash);
  assert.equal(Boolean(state.runtime.statusArtifactHash), true);
  assert.equal(state.ok, true, JSON.stringify(state, null, 2));
  assert.equal(state.status, 'PASS_AUDIT_WITH_RELEASE_GREEN_FALSE');
  assert.equal(state[TOKEN_NAME], 1);
  assert.equal(state[RELEASE_GREEN_TOKEN_NAME], 0);
  assert.deepEqual(state.failRows, []);
  assert.equal(state.repo.repoRootBinding, 'WORKTREE_INDEPENDENT');
});

test('b3c19 independent release audit: CLI status remains worktree independent outside repo cwd', () => {
  const result = spawnSync(process.execPath, [MODULE_PATH], {
    cwd: os.tmpdir(),
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);

  const stdout = String(result.stdout || '');
  assert.match(stdout, /B3C19_STATUS=PASS_AUDIT_WITH_RELEASE_GREEN_FALSE/u);
  assert.match(stdout, /B3C19_INDEPENDENT_RELEASE_AUDIT_OK=1/u);
  assert.match(stdout, /B3C19_RELEASE_GREEN_OK=0/u);
});

test('b3c19 independent release audit: binds B3C01 through B3C18 input artifacts', async () => {
  const { evaluateB3C19IndependentReleaseAuditState } = await loadModule();
  const state = await evaluateB3C19IndependentReleaseAuditState({ repoRoot: REPO_ROOT });

  assert.equal(state.inputRows.length, 18);
  assert.equal(state.inputRows.every((row) => row.passed), true);
  assert.deepEqual(state.inputRows.map((row) => row.id), [
    'B3C01',
    'B3C02',
    'B3C03',
    'B3C04',
    'B3C05',
    'B3C06',
    'B3C07',
    'B3C08',
    'B3C09',
    'B3C10',
    'B3C11',
    'B3C12',
    'B3C13',
    'B3C14',
    'B3C15',
    'B3C16',
    'B3C17',
    'B3C18',
  ]);
  assert.equal(state.proof.allInputsBound, true);
  assert.equal(state.proof.b3c01ToB3c08CarriedInputsClassified, true);
});

test('b3c19 independent release audit: audit rows cover all current release evidence without fixes', async () => {
  const { evaluateB3C19IndependentReleaseAuditState } = await loadModule();
  const state = await evaluateB3C19IndependentReleaseAuditState({ repoRoot: REPO_ROOT });
  const ids = state.auditRows.map((row) => row.id).sort();

  assert.deepEqual(ids, [
    'AUDIT_A11Y_TRUST_SURFACE',
    'AUDIT_ATTESTATION_CHAIN',
    'AUDIT_CAPABILITY_REPORT',
    'AUDIT_COMMAND_KERNEL_SCOPE_LOCK',
    'AUDIT_COMPILE_IR',
    'AUDIT_DETERMINISTIC_EXPORT',
    'AUDIT_DOCX_VALIDATION',
    'AUDIT_FUTURE_LANES',
    'AUDIT_I18N_ANCHORS',
    'AUDIT_NO_NETWORK',
    'AUDIT_PERF_BASELINE',
    'AUDIT_PERMISSION_SCOPE',
    'AUDIT_PRODUCTION_HARDENING_QUEUE',
    'AUDIT_RELEASE_DOSSIER',
    'AUDIT_SECURITY_BOUNDARY',
    'AUDIT_SUPPLY_CHAIN',
    'AUDIT_SUPPORT_PRIVACY',
    'AUDIT_XPLAT_NORMALIZATION',
  ]);
  assert.equal(state.auditRows.every((row) => row.status === 'PASS'), true);
  assert.equal(state.proof.auditRowsComplete, true);
  assert.equal(state.proof.auditRowsPass, true);
});

test('b3c19 independent release audit: unsupported scope remains visible and release green stays false', async () => {
  const { evaluateB3C19IndependentReleaseAuditState } = await loadModule();
  const state = await evaluateB3C19IndependentReleaseAuditState({ repoRoot: REPO_ROOT });
  const byId = new Map(state.nonblockingRows.map((row) => [row.id, row]));
  const limitedInputs = state.inputRows.filter((row) => row.visibleLimitRows.length > 0);

  assert.ok(limitedInputs.length >= 4);
  assert.equal(limitedInputs.flatMap((row) => row.visibleLimitRows).every((row) => row.pass), true);
  assert.equal(byId.get('UNSUPPORTED_SCOPE_REMAINS_VISIBLE').status, 'PASS');
  assert.equal(byId.get('RELEASE_GREEN_REMAINS_FALSE').status, 'PASS');
  assert.equal(state.proof.unsupportedScopeRemainsVisible, true);
  assert.equal(state.proof.releaseGreenFalseBecauseB3C19Only, true);
  for (const row of state.inputRows.filter((entry) => entry.releaseGreenTokenName)) {
    assert.equal(row.releaseGreen, 0, row.id);
  }
});

test('b3c19 independent release audit: layer mix checks pass as audit table and diff guard', async () => {
  const { evaluateB3C19IndependentReleaseAuditState } = await loadModule();
  const state = await evaluateB3C19IndependentReleaseAuditState({ repoRoot: REPO_ROOT });
  const ids = state.layerMixRows.map((row) => row.id).sort();

  assert.deepEqual(ids, [
    'DOC_ONLY_EVIDENCE',
    'EXPORT_STORAGE_LAYER_MIX',
    'FUTURE_LANES_P0B_LAYER_MIX',
    'MISSING_NEGATIVE_TESTS',
    'MISSING_ROLLBACK_REFS',
    'NETWORK_IN_WRITING_PATH',
    'PERMISSION_ESCAPE',
    'RELEASE_P0C_LAYER_MIX',
    'RELEASE_WITHOUT_DOSSIER',
    'SECURITY_DELIVERY_LAYER_MIX',
    'SELF_SIGNED_ATTESTATION',
    'UNSUPPORTED_SCOPE_OVERCLAIM',
  ]);
  assert.equal(state.layerMixRows.every((row) => row.status === 'PASS'), true);
  assert.equal(state.layerMixRows.every((row) => row.proofClass === 'B3C19_AUDIT_TABLE_AND_DIFF_GUARD'), true);
  assert.equal(state.proof.layerMixRowsComplete, true);
  assert.equal(state.proof.layerMixRowsPass, true);
});

test('b3c19 independent release audit: findings use schema and no blocking finding is unanswered', async () => {
  const { evaluateB3C19IndependentReleaseAuditState } = await loadModule();
  const state = await evaluateB3C19IndependentReleaseAuditState({ repoRoot: REPO_ROOT });
  const byId = new Map(state.nonblockingRows.map((row) => [row.id, row]));

  assert.ok(state.findingRows.length >= 4);
  assert.equal(state.findingRows.every((row) => row.findingId && row.layer && row.severity && typeof row.blocking === 'boolean' && row.reason && row.evidenceBasename && row.requiredCorrection && row.nextContour), true);
  assert.equal(state.findingRows.every((row) => row.blocking === false), true);
  assert.equal(byId.get('FINDINGS_CLASSIFIED_WITH_SCHEMA').status, 'PASS');
  assert.equal(byId.get('NO_UNANSWERED_BLOCKING_FINDING').status, 'PASS');
  assert.equal(state.proof.findingsClassifiedWithSchema, true);
  assert.equal(state.proof.noUnansweredBlockingFinding, true);
});

test('b3c19 independent release audit: nonblocking governance rows pass', async () => {
  const { evaluateB3C19IndependentReleaseAuditState } = await loadModule();
  const state = await evaluateB3C19IndependentReleaseAuditState({ repoRoot: REPO_ROOT });
  const byId = new Map(state.nonblockingRows.map((row) => [row.id, row]));

  for (const id of [
    'ALL_INPUT_ARTIFACTS_BOUND',
    'B3C01_TO_B3C08_CARRIED_INPUTS_CLASSIFIED',
    'B3C09_TO_B3C18_TESTS_RECONFIRMED',
    'RELEASE_GREEN_REMAINS_FALSE',
    'UNSUPPORTED_SCOPE_REMAINS_VISIBLE',
    'NO_FALSE_RELEASE_CLAIM',
    'NO_DOC_ONLY_CLOSE_CLAIM',
    'NO_ACTIVE_CANON_PROMOTION',
    'NO_REQUIRED_TOKEN_SET_EXPANSION',
    'NO_NEW_DEPENDENCY',
    'NO_RUNTIME_LAYER_CHANGE',
    'B3C20_NOT_STARTED',
    'DONOR_CONTEXT_ONLY',
    'NO_RUNTIME_FIX_ATTEMPTED',
    'FINDINGS_CLASSIFIED_WITH_SCHEMA',
    'NO_UNANSWERED_BLOCKING_FINDING',
  ]) {
    assert.equal(byId.get(id).status, 'PASS', id);
  }
  assert.equal(state.proof.noRuntimeLayerChange, true);
  assert.equal(state.proof.b3c20NotStarted, true);
  assert.equal(state.proof.noRuntimeFixAttempted, true);
});

test('b3c19 independent release audit: required negative rows pass', async () => {
  const { evaluateB3C19IndependentReleaseAuditState } = await loadModule();
  const state = await evaluateB3C19IndependentReleaseAuditState({ repoRoot: REPO_ROOT });
  const ids = state.negativeRows.map((row) => row.id).sort();

  assert.deepEqual(ids, [
    'B3C20_STARTED_NEGATIVE',
    'BLOCK2_CLOSURE_REOPENED_WITHOUT_FRESH_CONTRADICTION_NEGATIVE',
    'BLOCKING_FINDING_DOWNGRADED_NEGATIVE',
    'DOC_ONLY_EVIDENCE_ACCEPTED_NEGATIVE',
    'DONOR_COMPLETION_CLAIM_IMPORTED_NEGATIVE',
    'INPUT_ARTIFACT_MISSING_NEGATIVE',
    'INPUT_TOKEN_FALSE_GREEN_NEGATIVE',
    'LAYER_MIX_ACCEPTED_NEGATIVE',
    'MISSING_NEGATIVE_TEST_ACCEPTED_NEGATIVE',
    'MISSING_ROLLBACK_REF_ACCEPTED_NEGATIVE',
    'NETWORK_ESCAPE_ACCEPTED_NEGATIVE',
    'NEW_DEPENDENCY_ADDED_NEGATIVE',
    'PERMISSION_ESCAPE_ACCEPTED_NEGATIVE',
    'PRIOR_CONTOUR_STATUS_REWRITTEN_NEGATIVE',
    'RELEASE_GREEN_CLAIMED_NEGATIVE',
    'RELEASE_WITHOUT_DOSSIER_ACCEPTED_NEGATIVE',
    'RUNTIME_CHANGE_ADDED_NEGATIVE',
    'RUNTIME_FIX_ATTEMPTED_NEGATIVE',
    'SELF_SIGNED_ATTESTATION_ACCEPTED_NEGATIVE',
    'UNSUPPORTED_SCOPE_HIDDEN_NEGATIVE',
  ]);
  assert.equal(state.negativeRows.every((row) => row.status === 'PASS'), true);
  assert.equal(state.proof.negativeRowsComplete, true);
  assert.equal(state.proof.negativeRowsPass, true);
});

test('b3c19 independent release audit: donor archives remain context only', async () => {
  const { evaluateB3C19IndependentReleaseAuditState } = await loadModule();
  const state = await evaluateB3C19IndependentReleaseAuditState({ repoRoot: REPO_ROOT });

  assert.equal(state.proof.donorIntakeContextOnly, true);
  assert.equal(state.donorIntake.class, 'READ_ONLY_CONTEXT_ONLY');
  assert.equal(state.donorIntake.codeImported, false);
  assert.equal(state.donorIntake.dependencyClaimImported, false);
  assert.equal(state.donorIntake.completionClaimImported, false);
  assert.equal(state.donorIntake.auditCompletionClaimImported, false);
  assert.ok(state.donorIntake.archiveRows.length >= 4);
});

test('b3c19 independent release audit: forbidden claims fail evaluation', async () => {
  const { evaluateB3C19IndependentReleaseAuditState } = await loadModule();
  const cases = [
    'inputArtifactMissing',
    'inputTokenFalseGreen',
    'releaseGreenClaim',
    'unsupportedScopeHidden',
    'docOnlyEvidenceAccepted',
    'missingNegativeTestAccepted',
    'missingRollbackRefAccepted',
    'releaseWithoutDossierAccepted',
    'selfSignedAttestationAccepted',
    'networkEscapeAccepted',
    'permissionEscapeAccepted',
    'layerMixAccepted',
    'b3c20Started',
    'newDependency',
    'runtimeChangeAdded',
    'donorCompletionClaimImported',
    'runtimeFixAttempted',
    'priorContourStatusRewritten',
    'blockingFindingDowngraded',
    'block2ClosureReopenedWithoutFreshContradiction',
  ];

  for (const key of cases) {
    const state = await evaluateB3C19IndependentReleaseAuditState({
      repoRoot: REPO_ROOT,
      forceClaims: { [key]: true },
    });
    assert.equal(state.ok, false, key);
    assert.equal(state.B3C19_INDEPENDENT_RELEASE_AUDIT_OK, 0, key);
    assert.equal(state.B3C19_RELEASE_GREEN_OK, 0, key);
  }
});

test('b3c19 independent release audit: scope flags reject adjacent layer drift', async () => {
  const { evaluateB3C19IndependentReleaseAuditState } = await loadModule();
  const state = await evaluateB3C19IndependentReleaseAuditState({ repoRoot: REPO_ROOT });

  assert.equal(state.scope.packageManifestChange, false);
  assert.equal(state.scope.activeCanonPromotion, false);
  assert.equal(state.scope.requiredTokenExpansion, false);
  assert.equal(state.scope.newDependency, false);
  assert.equal(state.scope.uiChange, false);
  assert.equal(state.scope.storageChange, false);
  assert.equal(state.scope.exportRewrite, false);
  assert.equal(state.scope.securityRewrite, false);
  assert.equal(state.scope.runtimeChangeAdded, false);
  assert.equal(state.scope.releaseGreenClaim, false);
  assert.equal(state.scope.b3c20Started, false);
  assert.equal(state.scope.runtimeFixAttempted, false);
  assert.equal(state.scope.priorContourStatusRewritten, false);
  assert.equal(state.scope.donorCompletionClaimImported, false);
  assert.equal(state.scope.block2ClosureReopenedWithoutFreshContradiction, false);
});

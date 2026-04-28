const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MODULE_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'b3c20-block-3-exit-dossier-state.mjs');
const STATUS_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'STATUS', 'B3C20_BLOCK_3_EXIT_DOSSIER_STATUS_V1.json');

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

test('b3c20 exit dossier: status artifact matches stable executable fields', async () => {
  const { evaluateB3C20Block3ExitDossierState, TOKEN_NAME, RELEASE_GREEN_TOKEN_NAME } = await loadModule();
  const state = await evaluateB3C20Block3ExitDossierState({ repoRoot: REPO_ROOT });
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
  assert.deepEqual(committedState.dossierSections, state.dossierSections);
  assert.deepEqual(committedState.visibleLimitRows, state.visibleLimitRows);
  assert.deepEqual(committedState.decisionRows, state.decisionRows);
  assert.deepEqual(committedState.negativeRows, state.negativeRows);
  assert.deepEqual(committedState.blockDecision, state.blockDecision);
  assert.deepEqual(committedState.ownerReviewPacket, state.ownerReviewPacket);
  assert.deepEqual(committedState.scope, state.scope);
  assert.deepEqual(normalizedCommitted.repo, normalizedState.repo);
  assert.equal(committedState.runtime.changedBasenamesHash, state.runtime.changedBasenamesHash);
  assert.equal(Boolean(state.runtime.statusArtifactHash), true);
  assert.equal(state.ok, true, JSON.stringify(state, null, 2));
  assert.equal(state.status, 'PASS_EXIT_DOSSIER_WITH_STOP_NOT_RELEASE_GREEN');
  assert.equal(state[TOKEN_NAME], 1);
  assert.equal(state[RELEASE_GREEN_TOKEN_NAME], 0);
  assert.deepEqual(state.failRows, []);
  assert.equal(state.repo.repoRootBinding, 'WORKTREE_INDEPENDENT');
});

test('b3c20 exit dossier: CLI status remains worktree independent outside repo cwd', () => {
  const result = spawnSync(process.execPath, [MODULE_PATH], {
    cwd: os.tmpdir(),
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);

  const stdout = String(result.stdout || '');
  assert.match(stdout, /B3C20_STATUS=PASS_EXIT_DOSSIER_WITH_STOP_NOT_RELEASE_GREEN/u);
  assert.match(stdout, /B3C20_BLOCK_3_EXIT_DOSSIER_OK=1/u);
  assert.match(stdout, /B3C20_RELEASE_GREEN_OK=0/u);
  assert.match(stdout, /B3C20_NEXT_STEP=STOP_FOR_OWNER_DECISION/u);
});

test('b3c20 exit dossier: binds B3C01 through B3C19 input artifacts', async () => {
  const { evaluateB3C20Block3ExitDossierState } = await loadModule();
  const state = await evaluateB3C20Block3ExitDossierState({ repoRoot: REPO_ROOT });

  assert.equal(state.inputRows.length, 19);
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
    'B3C19',
  ]);
  assert.equal(state.proof.allInputsBound, true);
  assert.equal(state.proof.b3c19AuditBound, true);
});

test('b3c20 exit dossier: visible limits remain explicit and block release green', async () => {
  const { evaluateB3C20Block3ExitDossierState } = await loadModule();
  const state = await evaluateB3C20Block3ExitDossierState({ repoRoot: REPO_ROOT });
  const ids = state.visibleLimitRows.map((row) => row.id).sort();

  assert.deepEqual(ids, [
    'B3C09_PROVISIONAL_GAP',
    'B3C10_FULL_TIER_GREEN_OK_0',
    'B3C11_FULL_REAL_PLATFORM_XPLAT_OK_0',
    'B3C12_FULL_GLOBAL_I18N_OK_0',
    'B3C13_FULL_APP_A11Y_OK_0',
    'B3C14_RELEASE_GREEN_OK_0',
    'B3C15_RELEASE_GREEN_OK_0',
    'B3C16_RELEASE_GREEN_OK_0',
    'B3C17_RELEASE_GREEN_OK_0',
    'B3C18_RELEASE_GREEN_OK_0',
    'B3C19_RELEASE_GREEN_OK_0',
  ]);
  assert.equal(state.visibleLimitRows.every((row) => row.status === 'PASS'), true);
  assert.equal(state.proof.visibleLimitsPass, true);
  assert.equal(state.proof.unsupportedScopeRemainsVisible, true);
  assert.equal(state.blockDecision.visibleLimitsRemain, true);
  assert.equal(state.B3C20_RELEASE_GREEN_OK, 0);
});

test('b3c20 exit dossier: dossier sections are complete', async () => {
  const { evaluateB3C20Block3ExitDossierState } = await loadModule();
  const state = await evaluateB3C20Block3ExitDossierState({ repoRoot: REPO_ROOT });
  const ids = state.dossierSections.map((row) => row.id).sort();

  assert.deepEqual(ids, [
    'A11Y_STATUS',
    'ATTESTATION_STATUS',
    'CAPABILITY_TIER_STATUS',
    'EXPORT_SOURCE_STATUS',
    'EXPORT_VALIDATION_STATUS',
    'FUTURE_LANES_STATUS',
    'I18N_STATUS',
    'INDEPENDENT_RELEASE_AUDIT_STATUS',
    'NO_NETWORK_STATUS',
    'PERF_STATUS',
    'PERMISSION_STATUS',
    'PRODUCTION_HARDENING_QUEUE_STATUS',
    'RELEASE_DOSSIER_STATUS',
    'SECURITY_STATUS',
    'STOP_OR_RELEASE_DECISION',
    'SUPPLY_CHAIN_STATUS',
    'UNSUPPORTED_SCOPE_STATUS',
    'XPLAT_STATUS',
  ]);
  assert.equal(state.dossierSections.every((row) => row.status === 'PASS'), true);
});

test('b3c20 exit dossier: decision is stop not release green with exact owner stop', async () => {
  const { evaluateB3C20Block3ExitDossierState } = await loadModule();
  const state = await evaluateB3C20Block3ExitDossierState({ repoRoot: REPO_ROOT });

  assert.equal(state.blockDecision.decision, 'BLOCK_3_STOP_NOT_RELEASE_GREEN');
  assert.equal(state.blockDecision.nextStep, 'STOP_FOR_OWNER_DECISION');
  assert.equal(state.blockDecision.ownerReviewPacketReady, true);
  assert.equal(state.ownerReviewPacket.status, 'READY');
  assert.equal(state.ownerReviewPacket.nextStep, 'STOP_FOR_OWNER_DECISION');
  assert.equal(state.proof.block3StopNotReleaseGreen, true);
  assert.equal(state.proof.finalNextStepIsStopForOwnerDecision, true);
});

test('b3c20 exit dossier: mandatory decision rows pass', async () => {
  const { evaluateB3C20Block3ExitDossierState } = await loadModule();
  const state = await evaluateB3C20Block3ExitDossierState({ repoRoot: REPO_ROOT });
  const byId = new Map(state.decisionRows.map((row) => [row.id, row]));

  for (const id of [
    'ALL_B3C01_TO_B3C19_INPUT_ARTIFACTS_BOUND',
    'B3C19_AUDIT_BOUND',
    'RELEASE_GREEN_REMAINS_FALSE_UNLESS_ALL_RELEASE_GATES_GREEN',
    'UNSUPPORTED_SCOPE_REMAINS_VISIBLE',
    'STOP_STATUS_HAS_EXACT_NEXT_STEP',
    'NO_FALSE_RELEASE_GREEN',
    'NO_DOC_ONLY_CLOSE',
    'NO_ACTIVE_CANON_PROMOTION',
    'NO_REQUIRED_TOKEN_SET_EXPANSION',
    'NO_NEW_DEPENDENCY',
    'NO_RUNTIME_LAYER_CHANGE',
    'NO_BLOCK_4_STARTED',
    'DONOR_CONTEXT_ONLY',
    'PRIOR_CONTOURS_NOT_REWRITTEN',
    'OWNER_REVIEW_PACKET_READY',
    'NO_RELEASE_FIX_ATTEMPTED',
    'B3C19_NOT_REPLACED_BY_NEW_AUDIT',
    'MACHINE_BOUND_EXIT_STATUS',
  ]) {
    assert.equal(byId.get(id).status, 'PASS', id);
  }
  assert.equal(state.proof.noFalseReleaseGreen, true);
  assert.equal(state.proof.noBlock4Started, true);
  assert.equal(state.proof.noReleaseFixAttempted, true);
  assert.equal(state.proof.machineBoundExitStatus, true);
});

test('b3c20 exit dossier: required negative rows pass', async () => {
  const { evaluateB3C20Block3ExitDossierState } = await loadModule();
  const state = await evaluateB3C20Block3ExitDossierState({ repoRoot: REPO_ROOT });
  const ids = state.negativeRows.map((row) => row.id).sort();

  assert.deepEqual(ids, [
    'ACTIVE_CANON_PROMOTED_NEGATIVE',
    'B3C19_AUDIT_REPLACED_NEGATIVE',
    'BLOCK_3_CLOSE_GREEN_WHILE_LIMITS_VISIBLE_NEGATIVE',
    'BLOCK_4_STARTED_NEGATIVE',
    'DOC_ONLY_CLOSE_ACCEPTED_NEGATIVE',
    'DONOR_COMPLETION_CLAIM_IMPORTED_NEGATIVE',
    'INPUT_ARTIFACT_MISSING_NEGATIVE',
    'MACHINE_BOUND_STATUS_MISSING_NEGATIVE',
    'NETWORK_ESCAPE_ACCEPTED_NEGATIVE',
    'NEW_DEPENDENCY_ADDED_NEGATIVE',
    'PERMISSION_ESCAPE_ACCEPTED_NEGATIVE',
    'PRIOR_CONTOUR_STATUS_REWRITTEN_NEGATIVE',
    'RELEASE_FIX_ATTEMPTED_NEGATIVE',
    'RELEASE_GREEN_CLAIMED_WHILE_LIMITS_VISIBLE_NEGATIVE',
    'RELEASE_WITHOUT_DOSSIER_ACCEPTED_NEGATIVE',
    'REQUIRED_TOKEN_SET_EXPANDED_NEGATIVE',
    'RUNTIME_CHANGE_ADDED_NEGATIVE',
    'STOP_HAS_NO_NEXT_STEP_NEGATIVE',
    'UNSUPPORTED_SCOPE_HIDDEN_NEGATIVE',
  ]);
  assert.equal(state.negativeRows.every((row) => row.status === 'PASS'), true);
  assert.equal(state.proof.negativeRowsComplete, true);
  assert.equal(state.proof.negativeRowsPass, true);
});

test('b3c20 exit dossier: donor archives remain context only', async () => {
  const { evaluateB3C20Block3ExitDossierState } = await loadModule();
  const state = await evaluateB3C20Block3ExitDossierState({ repoRoot: REPO_ROOT });

  assert.equal(state.proof.donorIntakeContextOnly, true);
  assert.equal(state.donorIntake.class, 'READ_ONLY_CONTEXT_ONLY');
  assert.equal(state.donorIntake.codeImported, false);
  assert.equal(state.donorIntake.dependencyClaimImported, false);
  assert.equal(state.donorIntake.completionClaimImported, false);
  assert.equal(state.donorIntake.exitCompletionClaimImported, false);
  assert.ok(state.donorIntake.archiveRows.length >= 4);
});

test('b3c20 exit dossier: forbidden claims fail evaluation', async () => {
  const { evaluateB3C20Block3ExitDossierState } = await loadModule();
  const cases = [
    'inputArtifactMissing',
    'releaseGreenClaimWhileLimitsVisible',
    'unsupportedScopeHidden',
    'stopHasNoNextStep',
    'docOnlyCloseAccepted',
    'block4Started',
    'releaseFixAttempted',
    'runtimeChangeAdded',
    'newDependency',
    'activeCanonPromoted',
    'requiredTokenSetExpanded',
    'priorContourStatusRewritten',
    'donorCompletionClaimImported',
    'releaseWithoutDossierAccepted',
    'networkEscapeAccepted',
    'permissionEscapeAccepted',
    'b3c19AuditReplaced',
    'machineBoundStatusMissing',
    'block3CloseGreenWhileLimitsVisible',
  ];

  for (const key of cases) {
    const state = await evaluateB3C20Block3ExitDossierState({
      repoRoot: REPO_ROOT,
      forceClaims: { [key]: true },
    });
    assert.equal(state.ok, false, key);
    assert.equal(state.B3C20_BLOCK_3_EXIT_DOSSIER_OK, 0, key);
    assert.equal(state.B3C20_RELEASE_GREEN_OK, 0, key);
  }
});

test('b3c20 exit dossier: scope flags reject adjacent layer drift', async () => {
  const { evaluateB3C20Block3ExitDossierState } = await loadModule();
  const state = await evaluateB3C20Block3ExitDossierState({ repoRoot: REPO_ROOT });

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
  assert.equal(state.scope.block4Started, false);
  assert.equal(state.scope.releaseFixAttempted, false);
  assert.equal(state.scope.priorContourStatusRewritten, false);
  assert.equal(state.scope.donorCompletionClaimImported, false);
  assert.equal(state.scope.b3c19AuditReplaced, false);
  assert.equal(state.scope.machineBoundStatusMissing, false);
});

test('b3c20 exit dossier: untracked adjacent layer drift fails scope guard', async () => {
  const { evaluateB3C20Block3ExitDossierState } = await loadModule();
  const driftPath = path.join(REPO_ROOT, 'src', 'security', 'b3c20-untracked-drift.tmp');
  fs.writeFileSync(driftPath, 'b3c20 untracked drift must fail\n');

  try {
    const state = await evaluateB3C20Block3ExitDossierState({ repoRoot: REPO_ROOT });
    assert.equal(state.ok, false);
    assert.equal(state.B3C20_BLOCK_3_EXIT_DOSSIER_OK, 0);
    assert.equal(state.scope.runtimeChangeAdded, true);
    assert.equal(state.scope.securityRewrite, true);
    assert.equal(state.decisionRows.some((row) => row.id === 'NO_RUNTIME_LAYER_CHANGE' && row.status === 'FAIL'), true);
  } finally {
    fs.rmSync(driftPath, { force: true });
  }
});

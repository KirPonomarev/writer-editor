const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MODULE_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'b3c14-release-dossier-minimal-state.mjs');
const STATUS_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'STATUS', 'B3C14_RELEASE_DOSSIER_MINIMAL_STATUS_V1.json');

let modulePromise = null;

function loadModule() {
  if (!modulePromise) modulePromise = import(pathToFileURL(MODULE_PATH).href);
  return modulePromise;
}

function readJson(targetPath) {
  return JSON.parse(fs.readFileSync(targetPath, 'utf8'));
}

test('b3c14 release dossier minimal: state artifact matches stable executable fields', async () => {
  const { evaluateB3C14ReleaseDossierMinimalState, TOKEN_NAME, RELEASE_GREEN_TOKEN_NAME } = await loadModule();
  const state = await evaluateB3C14ReleaseDossierMinimalState({ repoRoot: REPO_ROOT });
  const committedState = readJson(STATUS_PATH);

  assert.equal(committedState.artifactId, state.artifactId);
  assert.equal(committedState.contourId, state.contourId);
  assert.equal(committedState.status, state.status);
  assert.equal(committedState.dossierStatus, state.dossierStatus);
  assert.equal(committedState[TOKEN_NAME], state[TOKEN_NAME]);
  assert.equal(committedState[RELEASE_GREEN_TOKEN_NAME], state[RELEASE_GREEN_TOKEN_NAME]);
  assert.deepEqual(committedState.failRows, state.failRows);
  assert.deepEqual(committedState.inputRows, state.inputRows);
  assert.deepEqual(committedState.sectionRows, state.sectionRows);
  assert.deepEqual(committedState.limitRows, state.limitRows);
  assert.deepEqual(committedState.carriedForwardLimitRows, state.carriedForwardLimitRows);
  assert.deepEqual(committedState.negativeRows, state.negativeRows);
  assert.deepEqual(committedState.handoffRows, state.handoffRows);
  assert.deepEqual(committedState.unsupportedScope, state.unsupportedScope);
  assert.deepEqual(committedState.donorIntake, state.donorIntake);
  assert.equal(committedState.runtime.changedBasenamesHash, state.runtime.changedBasenamesHash);
  assert.equal(Boolean(state.runtime.statusArtifactHash), true);
  assert.equal(state.ok, true, JSON.stringify(state, null, 2));
  assert.equal(state.status, 'PASS');
  assert.equal(state.dossierStatus, 'COMPLETE_WITH_LIMITS');
  assert.equal(state[TOKEN_NAME], 1);
  assert.equal(state[RELEASE_GREEN_TOKEN_NAME], 0);
  assert.deepEqual(state.failRows, []);
  assert.equal(state.repo.repoRootBinding, 'WORKTREE_INDEPENDENT');
});

test('b3c14 release dossier minimal: CLI status remains worktree independent outside repo cwd', () => {
  const result = spawnSync(process.execPath, [MODULE_PATH], {
    cwd: os.tmpdir(),
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);

  const stdout = String(result.stdout || '');
  assert.match(stdout, /B3C14_STATUS=PASS/u);
  assert.match(stdout, /B3C14_RELEASE_DOSSIER_MINIMAL_OK=1/u);
  assert.match(stdout, /B3C14_RELEASE_GREEN_OK=0/u);
});

test('b3c14 release dossier minimal: binds B3C09 through B3C13 input artifacts', async () => {
  const { evaluateB3C14ReleaseDossierMinimalState } = await loadModule();
  const state = await evaluateB3C14ReleaseDossierMinimalState({ repoRoot: REPO_ROOT });
  const byBasename = new Map(state.inputRows.map((row) => [row.basename, row]));

  assert.equal(state.proof.b3c09InputBound, true);
  assert.equal(state.proof.b3c10InputBound, true);
  assert.equal(state.proof.b3c11InputBound, true);
  assert.equal(state.proof.b3c12InputBound, true);
  assert.equal(state.proof.b3c13InputBound, true);
  assert.equal(byBasename.get('B3C09_PERFORMANCE_BASELINE_BINDING_STATUS_V1.json').passed, true);
  assert.equal(byBasename.get('B3C10_CAPABILITY_TIER_REPORT_STATUS_V1.json').passed, true);
  assert.equal(byBasename.get('B3C11_XPLAT_NORMALIZATION_BASELINE_STATUS_V1.json').passed, true);
  assert.equal(byBasename.get('B3C12_I18N_TEXT_ANCHOR_SAFETY_STATUS_V1.json').passed, true);
  assert.equal(byBasename.get('B3C13_TRUST_SURFACE_ACCESSIBILITY_STATUS_V1.json').passed, true);
});

test('b3c14 release dossier minimal: required dossier sections are complete and limited truthfully', async () => {
  const { evaluateB3C14ReleaseDossierMinimalState } = await loadModule();
  const state = await evaluateB3C14ReleaseDossierMinimalState({ repoRoot: REPO_ROOT });
  const byId = new Map(state.sectionRows.map((row) => [row.id, row]));

  assert.deepEqual([...byId.keys()].sort(), [
    'ACTIVE_CANON',
    'CAPABILITY_TIER',
    'EXPORT_VALIDATION',
    'PACKAGE_HASHES',
    'PERFORMANCE',
    'PROJECT_DOCTOR',
    'RECOVERY_DRILL',
    'RELEASE_SUMMARY',
    'SECURITY',
    'SOURCE_HEAD',
    'TEST_RESULTS',
    'UNSUPPORTED_SCOPE',
  ]);
  assert.equal(byId.get('RELEASE_SUMMARY').status, 'BOUND');
  assert.equal(byId.get('ACTIVE_CANON').status, 'BOUND');
  assert.equal(byId.get('SOURCE_HEAD').status, 'BOUND');
  assert.equal(byId.get('PACKAGE_HASHES').status, 'LIMITED');
  assert.equal(byId.get('PERFORMANCE').status, 'LIMITED');
  assert.equal(byId.get('UNSUPPORTED_SCOPE').status, 'BOUND');
  assert.equal(state.proof.sectionRowsComplete, true);
});

test('b3c14 release dossier minimal: required limit rows block false release green', async () => {
  const { evaluateB3C14ReleaseDossierMinimalState, RELEASE_GREEN_TOKEN_NAME } = await loadModule();
  const state = await evaluateB3C14ReleaseDossierMinimalState({ repoRoot: REPO_ROOT });
  const ids = state.limitRows.map((row) => row.id).sort();

  assert.deepEqual(ids, [
    'ATTESTATION_HANDOFF_ONLY',
    'B3C09_PERF_GAP_BLOCKS_FULL_TIER_GREEN',
    'B3C11_REAL_PLATFORM_MATRIX_LIMITED',
    'B3C12_FULL_GLOBAL_I18N_NOT_CLAIMED',
    'B3C13_FULL_APP_A11Y_NOT_CLAIMED',
    'NO_BLOCK2_REOPEN',
    'PACKAGE_HASHES_LIMITED_NO_PACKAGE_BUILD',
    'SUPPLY_CHAIN_HANDOFF_ONLY',
  ]);
  assert.equal(state.limitRows.every((row) => row.status === 'LIMITED'), true);
  assert.equal(state[RELEASE_GREEN_TOKEN_NAME], 0);
  assert.equal(state.releaseGreen, false);
  assert.equal(state.proof.releaseGreenFalseBecauseLimited, true);
});

test('b3c14 release dossier minimal: carries forward B3C09 through B3C13 limits without softening', async () => {
  const { evaluateB3C14ReleaseDossierMinimalState } = await loadModule();
  const state = await evaluateB3C14ReleaseDossierMinimalState({ repoRoot: REPO_ROOT });
  const byId = new Map(state.carriedForwardLimitRows.map((row) => [row.id, row]));

  assert.deepEqual([...byId.keys()].sort(), [
    'B3C09_UNSUPPORTED_MEASUREMENTS',
    'B3C10_PROVISIONAL_PERF_AND_PLATFORM_SCOPE',
    'B3C11_REAL_PLATFORM_LIMITS',
    'B3C12_I18N_LIMITS',
    'B3C13_A11Y_LIMIT_ROWS',
    'B3C13_A11Y_UNSUPPORTED_SCOPE',
    'B3C13_B3C14_HANDOFF',
  ]);
  assert.deepEqual(byId.get('B3C09_UNSUPPORTED_MEASUREMENTS').rows, [
    'EXPORT_DOCX_P95_MS',
    'SCENE_SWITCH_P95_MS',
  ]);
  assert.ok(byId.get('B3C10_PROVISIONAL_PERF_AND_PLATFORM_SCOPE').unsupportedScope.includes('MULTI_PLATFORM_REAL_FIXTURE_SET'));
  assert.deepEqual(byId.get('B3C11_REAL_PLATFORM_LIMITS').platformRows, [
    'LINUX:UNTESTED_LIMITED',
    'MACOS:CURRENT_PLATFORM_ONLY_LIMITED',
    'WINDOWS:UNTESTED_LIMITED',
  ]);
  assert.ok(byId.get('B3C12_I18N_LIMITS').unsupportedScope.includes('FULL_GLOBAL_I18N_SUPPORT'));
  assert.ok(byId.get('B3C13_A11Y_LIMIT_ROWS').rows.includes('NO_RELEASE_A11Y_CERTIFICATION'));
  assert.ok(byId.get('B3C13_A11Y_UNSUPPORTED_SCOPE').unsupportedScope.includes('FULL_APP_ACCESSIBILITY'));
  assert.deepEqual(byId.get('B3C13_B3C14_HANDOFF').provisionalScope, ['B3C14_RELEASE_DOSSIER_MINIMAL:HANDOFF_ONLY']);
  assert.equal(state.proof.carriedForwardLimitsBound, true);
  assert.equal(state.proof.carriedForwardLimitRowsRecorded, true);
});

test('b3c14 release dossier minimal: negatives reject missing or paper release claims', async () => {
  const { evaluateB3C14ReleaseDossierMinimalState } = await loadModule();
  const state = await evaluateB3C14ReleaseDossierMinimalState({ repoRoot: REPO_ROOT });
  const ids = state.negativeRows.map((row) => row.id).sort();

  assert.deepEqual(ids, [
    'DOC_ONLY_RELEASE_NEGATIVE',
    'FALSE_GREEN_NEGATIVE',
    'MISSING_ARTIFACT_NEGATIVE',
    'RELEASE_WITHOUT_DOSSIER_NEGATIVE',
    'UNSUPPORTED_SCOPE_OVERCLAIM_NEGATIVE',
  ]);
  assert.equal(state.negativeRows.every((row) => row.status === 'PASS'), true);
  assert.equal(state.proof.negativeRowsPass, true);
});

test('b3c14 release dossier minimal: B3C15 and B3C16 remain handoff only', async () => {
  const { evaluateB3C14ReleaseDossierMinimalState } = await loadModule();
  const state = await evaluateB3C14ReleaseDossierMinimalState({ repoRoot: REPO_ROOT });
  const byId = new Map(state.handoffRows.map((row) => [row.id, row]));

  assert.equal(byId.get('B3C15_ATTESTATION_CHAIN').status, 'HANDOFF_ONLY');
  assert.equal(byId.get('B3C16_SUPPLY_CHAIN_RELEASE_SCOPE').status, 'HANDOFF_ONLY');
  assert.equal(state.proof.attestationHandoffOnly, true);
  assert.equal(state.proof.supplyChainHandoffOnly, true);
});

test('b3c14 release dossier minimal: donor intake remains context only', async () => {
  const { evaluateB3C14ReleaseDossierMinimalState } = await loadModule();
  const state = await evaluateB3C14ReleaseDossierMinimalState({ repoRoot: REPO_ROOT });

  assert.equal(state.proof.donorIntakeContextOnly, true);
  assert.equal(state.donorIntake.class, 'READ_ONLY_CONTEXT_ONLY');
  assert.equal(state.donorIntake.codeImported, false);
  assert.equal(state.donorIntake.completionClaimImported, false);
  assert.equal(state.donorIntake.activeCanonOverDonor, true);
  assert.ok(state.donorIntake.archiveRows.length >= 4);
});

test('b3c14 release dossier minimal: forbidden release claims fail evaluation', async () => {
  const { evaluateB3C14ReleaseDossierMinimalState } = await loadModule();
  const state = await evaluateB3C14ReleaseDossierMinimalState({
    repoRoot: REPO_ROOT,
    forceClaims: {
      releaseClaim: true,
      releaseGreenClaim: true,
      releaseWithoutDossier: true,
      docOnlyReleaseClaim: true,
      missingArtifactAccepted: true,
      unsupportedScopeOverclaim: true,
    },
  });

  assert.equal(state.ok, false);
  assert.equal(state.status, 'FAIL');
  assert.equal(state.failRows.includes('NEGATIVE_ROWS_FAILED'), true);
  assert.equal(state.failRows.includes('FORBIDDEN_SCOPE_OR_RELEASE_CLAIM'), true);
  assert.equal(state.failSignal, 'E_B3C14_RELEASE_DOSSIER_MINIMAL_NOT_OK');
});

test('b3c14 release dossier minimal: scope flags reject runtime and governance drift', async () => {
  const { evaluateB3C14ReleaseDossierMinimalState } = await loadModule();
  const state = await evaluateB3C14ReleaseDossierMinimalState({ repoRoot: REPO_ROOT });

  assert.equal(state.scope.releaseReportOnly, true);
  assert.equal(state.scope.releaseClaim, false);
  assert.equal(state.scope.releaseGreenClaim, false);
  assert.equal(state.scope.packageBuild, false);
  assert.equal(state.scope.packageHashGeneration, false);
  assert.equal(state.scope.attestationImplementation, false);
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
});

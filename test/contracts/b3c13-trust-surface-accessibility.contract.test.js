const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MODULE_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'b3c13-trust-surface-accessibility-state.mjs');
const STATUS_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'STATUS', 'B3C13_TRUST_SURFACE_ACCESSIBILITY_STATUS_V1.json');

let modulePromise = null;

function loadModule() {
  if (!modulePromise) modulePromise = import(pathToFileURL(MODULE_PATH).href);
  return modulePromise;
}

function readJson(targetPath) {
  return JSON.parse(fs.readFileSync(targetPath, 'utf8'));
}

test('b3c13 trust surface accessibility: state artifact matches stable executable fields', async () => {
  const { evaluateB3C13TrustSurfaceAccessibilityState, TOKEN_NAME, FULL_APP_A11Y_TOKEN_NAME } = await loadModule();
  const state = await evaluateB3C13TrustSurfaceAccessibilityState({ repoRoot: REPO_ROOT });
  const committedState = readJson(STATUS_PATH);

  assert.equal(committedState.artifactId, state.artifactId);
  assert.equal(committedState.contourId, state.contourId);
  assert.equal(committedState.status, state.status);
  assert.equal(committedState[TOKEN_NAME], state[TOKEN_NAME]);
  assert.equal(committedState[FULL_APP_A11Y_TOKEN_NAME], state[FULL_APP_A11Y_TOKEN_NAME]);
  assert.deepEqual(committedState.failRows, state.failRows);
  assert.deepEqual(committedState.inputRows, state.inputRows);
  assert.deepEqual(committedState.surfaceRows, state.surfaceRows);
  assert.deepEqual(committedState.checkRows, state.checkRows);
  assert.deepEqual(committedState.negativeRows, state.negativeRows);
  assert.deepEqual(committedState.limitRows, state.limitRows);
  assert.deepEqual(committedState.unsupportedScope, state.unsupportedScope);
  assert.deepEqual(committedState.provisionalScope, state.provisionalScope);
  assert.deepEqual(committedState.scope, state.scope);
  assert.deepEqual(committedState.donorIntake, state.donorIntake);
  assert.equal(committedState.runtime.changedBasenamesHash, state.runtime.changedBasenamesHash);
  assert.equal(Boolean(state.runtime.statusArtifactHash), true);
  assert.equal(state.ok, true, JSON.stringify(state, null, 2));
  assert.equal(state.status, 'PASS');
  assert.equal(state[TOKEN_NAME], 1);
  assert.equal(state[FULL_APP_A11Y_TOKEN_NAME], 0);
  assert.deepEqual(state.failRows, []);
  assert.equal(state.repo.repoRootBinding, 'WORKTREE_INDEPENDENT');
});

test('b3c13 trust surface accessibility: CLI status remains worktree independent outside repo cwd', () => {
  const result = spawnSync(process.execPath, [MODULE_PATH], {
    cwd: os.tmpdir(),
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);

  const stdout = String(result.stdout || '');
  assert.match(stdout, /B3C13_STATUS=PASS/u);
  assert.match(stdout, /B3C13_TRUST_SURFACE_ACCESSIBILITY_OK=1/u);
  assert.match(stdout, /B3C13_FULL_APP_A11Y_OK=0/u);
});

test('b3c13 trust surface accessibility: binds B3C12 and keeps limited i18n status visible', async () => {
  const { evaluateB3C13TrustSurfaceAccessibilityState } = await loadModule();
  const state = await evaluateB3C13TrustSurfaceAccessibilityState({ repoRoot: REPO_ROOT });

  assert.equal(state.proof.b3c12InputBound, true);
  assert.equal(state.proof.b3c12LimitedStatusVisible, true);
  assert.equal(state.inputRows[0].basename, 'B3C12_I18N_TEXT_ANCHOR_SAFETY_STATUS_V1.json');
  assert.equal(state.b3c12Limitations.realLanguageCoverageStatus, 'LIMITED');
  assert.equal(state.b3c12Limitations.fullGlobalI18n, false);
});

test('b3c13 trust surface accessibility: all four trust surfaces are classified without creating UI', async () => {
  const { evaluateB3C13TrustSurfaceAccessibilityState } = await loadModule();
  const state = await evaluateB3C13TrustSurfaceAccessibilityState({ repoRoot: REPO_ROOT });
  const byId = new Map(state.surfaceRows.map((row) => [row.id, row]));

  assert.deepEqual([...byId.keys()].sort(), [
    'CONFLICT_REVIEW_SURFACE',
    'PREFLIGHT_SURFACE',
    'PROJECT_DOCTOR_SURFACE',
    'RECOVERY_SURFACE',
  ]);
  assert.equal(byId.get('RECOVERY_SURFACE').classification, 'RUNTIME_BOUND');
  assert.equal(byId.get('RECOVERY_SURFACE').status, 'PASS');
  assert.equal(byId.get('PREFLIGHT_SURFACE').status, 'LIMITED');
  assert.equal(byId.get('CONFLICT_REVIEW_SURFACE').status, 'LIMITED');
  assert.equal(byId.get('PROJECT_DOCTOR_SURFACE').status, 'LIMITED');
  assert.equal(state.proof.missingSurfacesRecordedNotCreated, true);
  assert.equal(state.scope.newTrustSurfaceCreated, false);
});

test('b3c13 trust surface accessibility: required recovery check rows exist and pass or limit truthfully', async () => {
  const { evaluateB3C13TrustSurfaceAccessibilityState } = await loadModule();
  const state = await evaluateB3C13TrustSurfaceAccessibilityState({ repoRoot: REPO_ROOT });
  const byId = new Map(state.checkRows.map((row) => [row.id, row]));

  assert.deepEqual([...byId.keys()].sort(), [
    'ERROR_TEXT_PRESENT',
    'FOCUS_VISIBLE',
    'KEYBOARD_OPERABLE',
    'NOT_COLOR_ONLY',
    'SCREEN_READER_LABEL_PRESENT',
  ]);
  assert.equal(byId.get('KEYBOARD_OPERABLE').status, 'PASS');
  assert.equal(byId.get('NOT_COLOR_ONLY').status, 'PASS');
  assert.equal(byId.get('ERROR_TEXT_PRESENT').status, 'PASS');
  assert.equal(byId.get('SCREEN_READER_LABEL_PRESENT').status, 'PASS');
  assert.match(byId.get('FOCUS_VISIBLE').status, /PASS|LIMITED/u);
  assert.equal(state.trustSurfaceA11yStatus, 'LIMITED_PASS');
});

test('b3c13 trust surface accessibility: required negatives reject false accessibility claims', async () => {
  const { evaluateB3C13TrustSurfaceAccessibilityState } = await loadModule();
  const state = await evaluateB3C13TrustSurfaceAccessibilityState({ repoRoot: REPO_ROOT });
  const ids = state.negativeRows.map((row) => row.id).sort();

  assert.deepEqual(ids, [
    'COLOR_ONLY_NEGATIVE',
    'MISSING_ERROR_TEXT_NEGATIVE',
    'MISSING_FOCUS_NEGATIVE',
    'MISSING_LABEL_NEGATIVE',
  ]);
  assert.equal(state.negativeRows.every((row) => row.status === 'PASS'), true);
});

test('b3c13 trust surface accessibility: limit rows forbid full app and release certification claims', async () => {
  const { evaluateB3C13TrustSurfaceAccessibilityState, FULL_APP_A11Y_TOKEN_NAME } = await loadModule();
  const state = await evaluateB3C13TrustSurfaceAccessibilityState({ repoRoot: REPO_ROOT });
  const ids = state.limitRows.map((row) => row.id).sort();

  assert.deepEqual(ids, [
    'NO_BROAD_UI_POLISH_CLAIM',
    'NO_FULL_APP_A11Y_CLAIM',
    'NO_NEW_TRUST_SURFACE_CREATION',
    'NO_RELEASE_A11Y_CERTIFICATION',
    'TRUST_SURFACE_ONLY_SCOPE',
  ]);
  assert.equal(state[FULL_APP_A11Y_TOKEN_NAME], 0);
  assert.equal(state.limitRows.every((row) => row.releaseCertificationClaim === false), true);
  assert.equal(state.unsupportedScope.some((row) => row.id === 'FULL_APP_ACCESSIBILITY'), true);
  assert.equal(state.unsupportedScope.some((row) => row.id === 'RELEASE_A11Y_CERTIFICATION'), true);
});

test('b3c13 trust surface accessibility: donor intake remains context only', async () => {
  const { evaluateB3C13TrustSurfaceAccessibilityState } = await loadModule();
  const state = await evaluateB3C13TrustSurfaceAccessibilityState({ repoRoot: REPO_ROOT });

  assert.equal(state.proof.donorIntakeContextOnly, true);
  assert.equal(state.donorIntake.class, 'READ_ONLY_CONTEXT_ONLY');
  assert.equal(state.donorIntake.codeImported, false);
  assert.equal(state.donorIntake.completionClaimImported, false);
  assert.equal(state.donorIntake.activeCanonOverDonor, true);
  assert.ok(state.donorIntake.archiveRows.length >= 4);
});

test('b3c13 trust surface accessibility: forbidden adjacent claims fail evaluation', async () => {
  const { evaluateB3C13TrustSurfaceAccessibilityState } = await loadModule();
  const state = await evaluateB3C13TrustSurfaceAccessibilityState({
    repoRoot: REPO_ROOT,
    forceClaims: {
      fullAppA11yClaim: true,
      releaseA11yCertificationClaim: true,
      broadUiRedesign: true,
      newTrustSurfaceCreated: true,
      releaseDossierWork: true,
    },
  });

  assert.equal(state.ok, false);
  assert.equal(state.status, 'FAIL');
  assert.equal(state.failRows.includes('FORBIDDEN_SCOPE_OR_RELEASE_CLAIM'), true);
  assert.equal(state.failSignal, 'E_B3C13_TRUST_SURFACE_ACCESSIBILITY_NOT_OK');
});

test('b3c13 trust surface accessibility: scope flags reject renderer storage export security command dependency drift', async () => {
  const { evaluateB3C13TrustSurfaceAccessibilityState } = await loadModule();
  const state = await evaluateB3C13TrustSurfaceAccessibilityState({ repoRoot: REPO_ROOT });

  assert.equal(state.scope.trustSurfaceAccessibilityOnly, true);
  assert.equal(state.scope.contractBaselineOnly, true);
  assert.equal(state.scope.fullAppA11yClaim, false);
  assert.equal(state.scope.releaseA11yCertificationClaim, false);
  assert.equal(state.scope.broadUiRedesign, false);
  assert.equal(state.scope.newTrustSurfaceCreated, false);
  assert.equal(state.scope.rendererStructureChanged, false);
  assert.equal(state.scope.baseClassChanged, false);
  assert.equal(state.scope.newUiFramework, false);
  assert.equal(state.scope.storageChange, false);
  assert.equal(state.scope.exportChange, false);
  assert.equal(state.scope.securityPolicyRewrite, false);
  assert.equal(state.scope.commandSurfaceChange, false);
  assert.equal(state.scope.performanceClaimFix, false);
  assert.equal(state.scope.xplatCertification, false);
  assert.equal(state.scope.i18nGlobalGreen, false);
  assert.equal(state.scope.releaseDossierWork, false);
  assert.equal(state.scope.newDependency, false);
});

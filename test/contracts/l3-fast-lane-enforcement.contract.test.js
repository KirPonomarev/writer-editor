const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'l3-fast-lane-enforcement-state.mjs');
const FAILSIGNAL_REGISTRY_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'FAILSIGNALS', 'FAILSIGNAL_REGISTRY.json');
const PACKAGE_JSON_PATH = path.join(REPO_ROOT, 'package.json');

let modulePromise = null;

function loadModule() {
  if (!modulePromise) {
    modulePromise = import(pathToFileURL(MODULE_PATH).href);
  }
  return modulePromise;
}

test('l3 fast lane enforcement: low risk scope is classified to dev_fast and high-risk to heavy', async () => {
  const { evaluateL3FastLaneEnforcementState } = await loadModule();
  const state = evaluateL3FastLaneEnforcementState({
    repoRoot: REPO_ROOT,
    failsignalRegistryPath: FAILSIGNAL_REGISTRY_PATH,
    packageJsonPath: PACKAGE_JSON_PATH,
  });

  assert.equal(state.ok, true);
  assert.equal(state.L3_FAST_LANE_ENFORCEMENT_OK, 1);
  assert.equal(state.lowRiskScopeClassificationCheck.ok, true);

  const rows = state.lowRiskScopeClassificationCheck.caseResults;
  const lowRiskRows = rows.filter((row) => row.expectedClass === 'LOW_RISK_UI_MENU_DESIGN_ONLY');
  const highRiskRows = rows.filter((row) => row.expectedClass === 'NON_L3_OR_HIGH_RISK');

  assert.ok(lowRiskRows.length >= 1);
  assert.ok(highRiskRows.length >= 1);
  assert.equal(lowRiskRows.every((row) => row.actualLane === 'dev_fast'), true);
  assert.equal(highRiskRows.every((row) => row.actualLane === 'heavy'), true);
  assert.equal(state.heavyLaneForbiddenByDefaultCheck.ok, true);
});

test('l3 fast lane enforcement: forcing heavy by default for low-risk fails', async () => {
  const { evaluateL3FastLaneEnforcementState, L3_FAST_LANE_SCOPE_MATRIX } = await loadModule();

  const mutatedMatrix = JSON.parse(JSON.stringify(L3_FAST_LANE_SCOPE_MATRIX));
  const lowRiskClass = mutatedMatrix.classes.find((row) => row.classId === 'LOW_RISK_UI_MENU_DESIGN_ONLY');
  lowRiskClass.heavyLaneByDefault = true;

  const state = evaluateL3FastLaneEnforcementState({
    repoRoot: REPO_ROOT,
    failsignalRegistryPath: FAILSIGNAL_REGISTRY_PATH,
    packageJsonPath: PACKAGE_JSON_PATH,
    scopeMatrixOverride: mutatedMatrix,
  });

  assert.equal(state.heavyLaneForbiddenByDefaultCheck.ok, false);
  assert.equal(state.ok, false);
  assert.equal(state.failReason, 'HEAVY_LANE_DEFAULT_VIOLATION');
});

test('l3 fast lane enforcement: canonical smoke and advisory drift guard remain valid', async () => {
  const { evaluateL3FastLaneEnforcementState } = await loadModule();
  const state = evaluateL3FastLaneEnforcementState({
    repoRoot: REPO_ROOT,
    failsignalRegistryPath: FAILSIGNAL_REGISTRY_PATH,
    packageJsonPath: PACKAGE_JSON_PATH,
  });

  assert.equal(state.canonicalSmokeRequiredCheck.ok, true);
  assert.equal(state.singleBlockingAuthority.ok, true);
  assert.equal(state.advisoryToBlockingDriftCount, 0);
  assert.equal(state.advisoryToBlockingDriftCountZero, true);
});

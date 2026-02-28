const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const WS04_MODULE_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'ws04-mode-split-enforcement-state.mjs');
const EVALUATOR_MODULE_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'canonical-mode-matrix-evaluator.mjs');

let ws04ModulePromise = null;
let evaluatorModulePromise = null;

function loadWs04Module() {
  if (!ws04ModulePromise) {
    ws04ModulePromise = import(pathToFileURL(WS04_MODULE_PATH).href);
  }
  return ws04ModulePromise;
}

function loadEvaluatorModule() {
  if (!evaluatorModulePromise) {
    evaluatorModulePromise = import(pathToFileURL(EVALUATOR_MODULE_PATH).href);
  }
  return evaluatorModulePromise;
}

function normalizeComparable(state) {
  return {
    ok: state.ok,
    token: state.WS04_MODE_SPLIT_ENFORCEMENT_OK,
    negativeResults: state.negativeResults,
    positiveResults: state.positiveResults,
    dod: state.dod,
    acceptance: state.acceptance,
    authorityStatus: state.modeMatrixSingleAuthorityStatus,
    driftCount: state.advisoryToBlockingDriftCount,
  };
}

test('ws04 mode split enforcement: all DoD and acceptance checks pass in baseline repo', async () => {
  const { evaluateWs04ModeSplitEnforcementState } = await loadWs04Module();
  const state = evaluateWs04ModeSplitEnforcementState({ repoRoot: REPO_ROOT });

  assert.equal(state.ok, true);
  assert.equal(state.WS04_MODE_SPLIT_ENFORCEMENT_OK, 1);
  assert.equal(state.advisoryToBlockingDriftCountZero, true);
  assert.equal(state.modeMatrixSingleAuthorityStatus, 'PASS');

  for (const [key, value] of Object.entries(state.negativeResults)) {
    assert.equal(value, true, `negative scenario must be detected: ${key}`);
  }
  for (const [key, value] of Object.entries(state.positiveResults)) {
    assert.equal(value, true, `positive scenario must pass: ${key}`);
  }
  for (const [key, value] of Object.entries(state.dod)) {
    assert.equal(value, true, `DoD must pass: ${key}`);
  }
  for (const [key, value] of Object.entries(state.acceptance)) {
    assert.equal(value, true, `acceptance must pass: ${key}`);
  }
});

test('ws04 mode split enforcement: repeatability across three runs has no drift', async () => {
  const { evaluateWs04ModeSplitEnforcementState } = await loadWs04Module();
  const runs = [
    evaluateWs04ModeSplitEnforcementState({ repoRoot: REPO_ROOT }),
    evaluateWs04ModeSplitEnforcementState({ repoRoot: REPO_ROOT }),
    evaluateWs04ModeSplitEnforcementState({ repoRoot: REPO_ROOT }),
  ].map((entry) => normalizeComparable(entry));

  assert.deepEqual(runs[0], runs[1]);
  assert.deepEqual(runs[1], runs[2]);
  assert.equal(runs[0].ok, true);
});

test('canonical mode matrix evaluator: unresolved policy path is non-blocking and marked as policy failure', async () => {
  const { evaluateModeMatrixVerdict } = await loadEvaluatorModule();
  const verdict = evaluateModeMatrixVerdict({
    repoRoot: REPO_ROOT,
    mode: 'release',
    failSignalCode: 'E_NON_EXISTENT_SIGNAL_FOR_WS04',
  });

  assert.equal(verdict.ok, false);
  assert.equal(verdict.policyFailure, true);
  assert.equal(verdict.shouldBlock, false);
  assert.equal(verdict.modeDisposition, 'advisory');
  assert.ok(Array.isArray(verdict.issues));
  assert.ok(verdict.issues.some((issue) => issue.code === 'FAILSIGNAL_NOT_FOUND'));
});

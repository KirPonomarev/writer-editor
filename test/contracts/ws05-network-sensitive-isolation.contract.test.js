const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'ws05-network-sensitive-isolation-state.mjs');

let modulePromise = null;

function loadModule() {
  if (!modulePromise) {
    modulePromise = import(pathToFileURL(MODULE_PATH).href);
  }
  return modulePromise;
}

function normalizeComparable(state) {
  return {
    ok: state.ok,
    token: state.WS05_NETWORK_SENSITIVE_ISOLATION_OK,
    negativeResults: state.negativeResults,
    positiveResults: state.positiveResults,
    dod: state.dod,
    acceptance: state.acceptance,
    releaseClass: state.details.releaseClass,
    networkClassification: state.details.networkClassification,
  };
}

test('ws05 network-sensitive isolation: all DoD and acceptance checks pass in baseline repo', async () => {
  const { evaluateWs05NetworkSensitiveIsolationState } = await loadModule();
  const state = evaluateWs05NetworkSensitiveIsolationState({ repoRoot: REPO_ROOT });

  assert.equal(state.ok, true);
  assert.equal(state.WS05_NETWORK_SENSITIVE_ISOLATION_OK, 1);

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

test('ws05 network-sensitive isolation: release decision remains stable under remote unavailable', async () => {
  const { evaluateWs05NetworkSensitiveIsolationState } = await loadModule();
  const state = evaluateWs05NetworkSensitiveIsolationState({ repoRoot: REPO_ROOT });

  assert.equal(state.details.releaseClass.stableClassUnderRemoteUnavailable, true);
  assert.equal(state.details.releaseClass.baseline.nonzeroExitRequired, false);
  assert.equal(state.details.releaseClass.remoteUnavailableProbe.nonzeroExitRequired, false);
  assert.equal(state.details.releaseClass.remoteUnavailableProbe.advisoryProbeNonBlockingCount >= 1, true);
});

test('ws05 network-sensitive isolation: repeatability across three runs has no drift', async () => {
  const { evaluateWs05NetworkSensitiveIsolationState } = await loadModule();
  const runs = [
    evaluateWs05NetworkSensitiveIsolationState({ repoRoot: REPO_ROOT }),
    evaluateWs05NetworkSensitiveIsolationState({ repoRoot: REPO_ROOT }),
    evaluateWs05NetworkSensitiveIsolationState({ repoRoot: REPO_ROOT }),
  ].map((entry) => normalizeComparable(entry));

  assert.deepEqual(runs[0], runs[1]);
  assert.deepEqual(runs[1], runs[2]);
  assert.equal(runs[0].ok, true);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'hotpath-acceptance-guard-state.mjs');
const PERF_THRESHOLDS_PATH = path.join(REPO_ROOT, 'scripts', 'perf', 'perf-thresholds.json');
const HOTPATH_POLICY_PATH = path.join(REPO_ROOT, 'scripts', 'perf', 'hotpath-policy.json');
const FAILSIGNAL_REGISTRY_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'FAILSIGNALS', 'FAILSIGNAL_REGISTRY.json');

let modulePromise = null;

function loadModule() {
  if (!modulePromise) {
    modulePromise = import(pathToFileURL(MODULE_PATH).href);
  }
  return modulePromise;
}

function readJson(filePath) {
  return JSON.parse(require('node:fs').readFileSync(filePath, 'utf8'));
}

test('hotpath acceptance guard: no full document rerender, p95 threshold, autosave nonblocking, and ssot lock pass', async () => {
  const { evaluateHotpathAcceptanceGuardState } = await loadModule();
  const state = evaluateHotpathAcceptanceGuardState({
    repoRoot: REPO_ROOT,
    perfThresholdsPath: PERF_THRESHOLDS_PATH,
    hotpathPolicyPath: HOTPATH_POLICY_PATH,
    failsignalRegistryPath: FAILSIGNAL_REGISTRY_PATH,
  });

  assert.equal(state.ok, true);
  assert.equal(state.HOTPATH_ACCEPTANCE_GUARD_OK, 1);
  assert.equal(state.noFullDocumentRerenderPerKeystrokeCheck, true);
  assert.equal(state.inputP95WithinThresholdCheck, true);
  assert.equal(state.autosaveBackupNonblockingCheck, true);
  assert.equal(state.thresholdSsotLockCheck, true);
});

test('hotpath acceptance guard: threshold ssot lock fails when profiles diverge', async () => {
  const { evaluateHotpathAcceptanceGuardState } = await loadModule();
  const perfThresholdsDoc = readJson(PERF_THRESHOLDS_PATH);
  const hotpathPolicyDoc = readJson(HOTPATH_POLICY_PATH);
  const failsignalRegistryDoc = readJson(FAILSIGNAL_REGISTRY_PATH);

  hotpathPolicyDoc.profile = 'mismatch-profile';

  const state = evaluateHotpathAcceptanceGuardState({
    repoRoot: REPO_ROOT,
    perfThresholdsDoc,
    hotpathPolicyDoc,
    failsignalRegistryDoc,
  });

  assert.equal(state.thresholdSsotLockCheck, false);
  assert.equal(state.ok, false);
  assert.equal(state.failReason, 'E_THRESHOLD_SSOT_LOCK_FAIL');
});

test('hotpath acceptance guard: autosave backup typing-block threshold fails on sync hits', async () => {
  const { evaluateHotpathAcceptanceGuardState } = await loadModule();
  const perfThresholdsDoc = readJson(PERF_THRESHOLDS_PATH);
  const hotpathPolicyDoc = readJson(HOTPATH_POLICY_PATH);
  const failsignalRegistryDoc = readJson(FAILSIGNAL_REGISTRY_PATH);
  const editorSource = require('node:fs').readFileSync(path.join(REPO_ROOT, 'src', 'renderer', 'editor.js'), 'utf8');
  const mainSource = require('node:fs').readFileSync(path.join(REPO_ROOT, 'src', 'main.js'), 'utf8')
    .replace('backup autosave', 'backup autosave readFileSync');

  const state = evaluateHotpathAcceptanceGuardState({
    repoRoot: REPO_ROOT,
    perfThresholdsDoc,
    hotpathPolicyDoc,
    failsignalRegistryDoc,
    editorSourceOverride: editorSource,
    mainSourceOverride: mainSource,
  });

  assert.equal(state.autosaveBackupNonblockingCheck, false);
  assert.equal(state.ok, false);
  assert.equal(state.failReason, 'E_AUTOSAVE_BACKUP_TYPING_BLOCK');
});

test('hotpath acceptance guard: advisory does not drift to blocking outside canonical mode matrix', async () => {
  const { evaluateHotpathAcceptanceGuardState } = await loadModule();
  const state = evaluateHotpathAcceptanceGuardState({
    repoRoot: REPO_ROOT,
    perfThresholdsPath: PERF_THRESHOLDS_PATH,
    hotpathPolicyPath: HOTPATH_POLICY_PATH,
    failsignalRegistryPath: FAILSIGNAL_REGISTRY_PATH,
  });

  assert.equal(state.advisoryToBlockingDriftCount, 0);
  assert.equal(state.advisoryToBlockingDriftCountZero, true);
});

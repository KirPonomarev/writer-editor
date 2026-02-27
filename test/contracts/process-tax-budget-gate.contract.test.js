const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'process-tax-budget-gate-state.mjs');
const UNIQUE_SIGNAL_MAP_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'EVIDENCE', 'P1_CONTOUR', 'TICKET_10', 'unique-signal-map.json');
const DUPLICATE_BEFORE_AFTER_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'EVIDENCE', 'P1_CONTOUR', 'TICKET_10', 'duplicate-checks-before-after.json');
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

test('process tax budget gate: unique signal map is required and duplicates are merged or disabled', async () => {
  const { evaluateProcessTaxBudgetGateState } = await loadModule();
  const state = evaluateProcessTaxBudgetGateState({
    repoRoot: REPO_ROOT,
    uniqueSignalMapPath: UNIQUE_SIGNAL_MAP_PATH,
    duplicateBeforeAfterPath: DUPLICATE_BEFORE_AFTER_PATH,
    failsignalRegistryPath: FAILSIGNAL_REGISTRY_PATH,
  });

  assert.equal(state.ok, true);
  assert.equal(state.PROCESS_TAX_BUDGET_GATE_AUTOMATION_OK, 1);
  assert.equal(state.uniqueSignalRequiredCheck, true);
  assert.equal(state.duplicateGateMergeOrDisableCheck, true);
  assert.equal(state.uniqueSignalRequired.uniqueSignalCount > 0, true);
  assert.equal(state.duplicateGateMergeOrDisable.after.duplicateSignalCount, 0);
});

test('process tax budget gate: duplicate signal and missing unique signal fail', async () => {
  const { evaluateProcessTaxBudgetGateState } = await loadModule();
  const uniqueSignalMapDoc = readJson(UNIQUE_SIGNAL_MAP_PATH);
  const duplicateDoc = readJson(DUPLICATE_BEFORE_AFTER_PATH);
  const failsignalRegistryDoc = readJson(FAILSIGNAL_REGISTRY_PATH);

  uniqueSignalMapDoc.uniqueSignalMap.push({
    signal: uniqueSignalMapDoc.uniqueSignalMap[0].signal,
    canonicalSource: 'scripts/ops/duplicate-source.mjs',
    removedDuplicateSources: [],
    sourceCountBefore: 1,
  });
  duplicateDoc.after.duplicateSignalCount = 1;

  const state = evaluateProcessTaxBudgetGateState({
    repoRoot: REPO_ROOT,
    uniqueSignalMapDoc,
    duplicateBeforeAfterDoc: duplicateDoc,
    failsignalRegistryDoc,
  });

  assert.equal(state.ok, false);
  assert.equal(state.uniqueSignalRequiredCheck, false);
  assert.equal(state.duplicateGateMergeOrDisableCheck, false);
  assert.equal(state.uniqueSignalRequired.duplicates.length > 0, true);
  assert.equal(state.duplicateGateMergeOrDisable.after.duplicateSignalCount, 1);
});

test('process tax budget gate: heavy pass budget, strict-without-delta guard, and kill-switch policy are enforced', async () => {
  const { evaluateProcessTaxBudgetGateState } = await loadModule();
  const state = evaluateProcessTaxBudgetGateState({
    repoRoot: REPO_ROOT,
    uniqueSignalMapPath: UNIQUE_SIGNAL_MAP_PATH,
    duplicateBeforeAfterPath: DUPLICATE_BEFORE_AFTER_PATH,
    failsignalRegistryPath: FAILSIGNAL_REGISTRY_PATH,
  });

  assert.equal(state.maxHeavyPassPerWindowCheck, true);
  assert.equal(state.noDailyStrictWithoutScopeDeltaCheck, true);
  assert.equal(state.killSwitchOnNoSignalDeltaCheck, true);
  assert.equal(state.budgetThresholdProof.ok, true);
  assert.equal(state.maxHeavyPassPerWindow.maxHeavyPassPerWindow, 1);
  assert.equal(state.killSwitchTriggerCases.killSwitchWaveThreshold, 2);
  assert.equal(state.noDailyStrictWithoutScopeDelta.cases.some((entry) => entry.caseId === 'daily_strict_without_scope_delta_rejected' && entry.pass), true);
});

test('process tax budget gate: advisory does not drift to blocking outside canonical mode matrix', async () => {
  const { evaluateProcessTaxBudgetGateState } = await loadModule();
  const state = evaluateProcessTaxBudgetGateState({
    repoRoot: REPO_ROOT,
    uniqueSignalMapPath: UNIQUE_SIGNAL_MAP_PATH,
    duplicateBeforeAfterPath: DUPLICATE_BEFORE_AFTER_PATH,
    failsignalRegistryPath: FAILSIGNAL_REGISTRY_PATH,
  });

  assert.equal(state.advisoryToBlockingDriftCount, 0);
  assert.equal(state.advisoryToBlockingDriftCountZero, true);
  assert.equal(state.singleBlockingAuthority.ok, true);
});

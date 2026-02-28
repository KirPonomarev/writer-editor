const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(
  REPO_ROOT,
  'scripts',
  'ops',
  'p2-ws03-process-tax-budget-automation-state.mjs',
);

let modulePromise = null;

function loadModule() {
  if (!modulePromise) {
    modulePromise = import(pathToFileURL(MODULE_PATH).href);
  }
  return modulePromise;
}

function evaluateBaseline(evaluateP2Ws03ProcessTaxBudgetAutomationState) {
  return evaluateP2Ws03ProcessTaxBudgetAutomationState({ repoRoot: REPO_ROOT });
}

test('p2 ws03 baseline: process-tax dedup and budget automation passes', async () => {
  const { evaluateP2Ws03ProcessTaxBudgetAutomationState } = await loadModule();
  const state = evaluateBaseline(evaluateP2Ws03ProcessTaxBudgetAutomationState);

  assert.equal(state.ok, true, JSON.stringify(state, null, 2));
  assert.equal(state.P2_WS03_PROCESS_TAX_BUDGET_AUTOMATION_OK, 1);
  assert.equal(state.counts.duplicateCheckCountAfter, 0);
  assert.equal(state.counts.advisoryToBlockingDriftCount, 0);

  for (const [key, value] of Object.entries(state.negativeResults)) {
    assert.equal(value, true, `negative scenario must pass: ${key}`);
  }
  for (const [key, value] of Object.entries(state.positiveResults)) {
    assert.equal(value, true, `positive scenario must pass: ${key}`);
  }

  assert.equal(state.dod.NEXT_TZ_DOD_01, true);
  assert.equal(state.dod.NEXT_TZ_DOD_02, true);
  assert.equal(state.dod.NEXT_TZ_DOD_03, true);
  assert.equal(state.acceptance.NEXT_TZ_ACCEPTANCE_01, true);
  assert.equal(state.acceptance.NEXT_TZ_ACCEPTANCE_02, true);
});

test('p2 ws03 negative 01: duplicate chain without shared executor detection is mandatory', async () => {
  const { evaluateP2Ws03ProcessTaxBudgetAutomationState } = await loadModule();
  const baseline = evaluateBaseline(evaluateP2Ws03ProcessTaxBudgetAutomationState);
  assert.equal(baseline.negativeResults.NEXT_TZ_NEGATIVE_01, true);
});

test('p2 ws03 negative 02: heavy rerun without input hash change detection is mandatory', async () => {
  const { evaluateP2Ws03ProcessTaxBudgetAutomationState } = await loadModule();
  const baseline = evaluateBaseline(evaluateP2Ws03ProcessTaxBudgetAutomationState);
  assert.equal(baseline.negativeResults.NEXT_TZ_NEGATIVE_02, true);
});

test('p2 ws03 negative 03: budget threshold violation detection is mandatory', async () => {
  const { evaluateP2Ws03ProcessTaxBudgetAutomationState } = await loadModule();
  const baseline = evaluateBaseline(evaluateP2Ws03ProcessTaxBudgetAutomationState);
  assert.equal(baseline.negativeResults.NEXT_TZ_NEGATIVE_03, true);
});

test('p2 ws03 negative 04: fast lane forced into heavy policy detection is mandatory', async () => {
  const { evaluateP2Ws03ProcessTaxBudgetAutomationState } = await loadModule();
  const baseline = evaluateBaseline(evaluateP2Ws03ProcessTaxBudgetAutomationState);
  assert.equal(baseline.negativeResults.NEXT_TZ_NEGATIVE_04, true);
});

test('p2 ws03 negative 05: missing dedup mapping detection is mandatory', async () => {
  const { evaluateP2Ws03ProcessTaxBudgetAutomationState } = await loadModule();
  const baseline = evaluateBaseline(evaluateP2Ws03ProcessTaxBudgetAutomationState);
  assert.equal(baseline.negativeResults.NEXT_TZ_NEGATIVE_05, true);
});

test('p2 ws03 repeatability: three runs are stable', async () => {
  const { evaluateP2Ws03ProcessTaxBudgetAutomationState } = await loadModule();

  const runs = [
    evaluateBaseline(evaluateP2Ws03ProcessTaxBudgetAutomationState),
    evaluateBaseline(evaluateP2Ws03ProcessTaxBudgetAutomationState),
    evaluateBaseline(evaluateP2Ws03ProcessTaxBudgetAutomationState),
  ].map((state) => ({
    ok: state.ok,
    token: state.P2_WS03_PROCESS_TAX_BUDGET_AUTOMATION_OK,
    counts: state.counts,
    negativeResults: state.negativeResults,
    positiveResults: state.positiveResults,
    dod: state.dod,
    acceptance: state.acceptance,
  }));

  assert.deepEqual(runs[0], runs[1]);
  assert.deepEqual(runs[1], runs[2]);
  assert.equal(runs[0].ok, true);
});

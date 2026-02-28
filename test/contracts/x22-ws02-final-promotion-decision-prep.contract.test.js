const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(
  REPO_ROOT,
  'scripts',
  'ops',
  'x22-ws02-final-promotion-decision-prep-state.mjs',
);

let modulePromise = null;

function loadModule() {
  if (!modulePromise) {
    modulePromise = import(pathToFileURL(MODULE_PATH).href);
  }
  return modulePromise;
}

function evaluateBaseline(evaluateX22Ws02FinalPromotionDecisionPrepState) {
  return evaluateX22Ws02FinalPromotionDecisionPrepState({ repoRoot: REPO_ROOT });
}

test('x22 ws02 baseline: final promotion decision packet pass', async () => {
  const { evaluateX22Ws02FinalPromotionDecisionPrepState } = await loadModule();
  const state = evaluateBaseline(evaluateX22Ws02FinalPromotionDecisionPrepState);

  assert.equal(state.ok, true, JSON.stringify(state, null, 2));
  assert.equal(state.X22_WS02_FINAL_PROMOTION_DECISION_PREP_OK, 1);
  assert.equal(state.counts.requiredDecisionInputCount, 5);
  assert.equal(state.counts.missingDecisionInputCount, 0);
  assert.equal(state.counts.invalidDecisionInputCount, 0);
  assert.equal(state.counts.requiredGateVerdictCount, 5);
  assert.equal(state.counts.gateVerdictConflictCount, 0);
  assert.equal(state.counts.failedRequiredGateCount, 0);
  assert.equal(state.counts.requiredEvidenceRefCount, 5);
  assert.equal(state.counts.evidenceChainBreakCount, 0);
  assert.equal(state.counts.goDecisionPolicyViolationCount, 0);
  assert.equal(state.counts.advisoryToBlockingDriftCount, 0);
  assert.equal(state.counts.requiredModeCheckCount, 2);

  for (const [key, value] of Object.entries(state.negativeResults)) {
    assert.equal(value, true, `negative scenario must pass: ${key}`);
  }
  for (const [key, value] of Object.entries(state.positiveResults)) {
    assert.equal(value, true, `positive scenario must pass: ${key}`);
  }

  assert.equal(state.dod.NEXT_TZ_DOD_01, true);
  assert.equal(state.dod.NEXT_TZ_DOD_02, true);
  assert.equal(state.dod.NEXT_TZ_DOD_03, true);
  assert.equal(state.dod.NEXT_TZ_DOD_05, true);
  assert.equal(state.dod.NEXT_TZ_DOD_06, true);
  assert.equal(state.acceptance.NEXT_TZ_ACCEPTANCE_01, true);
  assert.equal(state.acceptance.NEXT_TZ_ACCEPTANCE_02, true);
});

test('x22 ws02 negative 01: missing final decision input is rejected', async () => {
  const { evaluateX22Ws02FinalPromotionDecisionPrepState } = await loadModule();
  const state = evaluateBaseline(evaluateX22Ws02FinalPromotionDecisionPrepState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_01, true);
});

test('x22 ws02 negative 02: conflicting gate verdict is rejected', async () => {
  const { evaluateX22Ws02FinalPromotionDecisionPrepState } = await loadModule();
  const state = evaluateBaseline(evaluateX22Ws02FinalPromotionDecisionPrepState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_02, true);
});

test('x22 ws02 negative 03: evidence lock chain break is rejected', async () => {
  const { evaluateX22Ws02FinalPromotionDecisionPrepState } = await loadModule();
  const state = evaluateBaseline(evaluateX22Ws02FinalPromotionDecisionPrepState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_03, true);
});

test('x22 ws02 negative 04: go decision with failed required gate is rejected', async () => {
  const { evaluateX22Ws02FinalPromotionDecisionPrepState } = await loadModule();
  const state = evaluateBaseline(evaluateX22Ws02FinalPromotionDecisionPrepState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_04, true);
});

test('x22 ws02 negative 05: non deterministic decision packet is rejected', async () => {
  const { evaluateX22Ws02FinalPromotionDecisionPrepState } = await loadModule();
  const state = evaluateBaseline(evaluateX22Ws02FinalPromotionDecisionPrepState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_05, true);
});

test('x22 ws02 repeatability: three runs are stable', async () => {
  const { evaluateX22Ws02FinalPromotionDecisionPrepState } = await loadModule();

  const runs = [
    evaluateBaseline(evaluateX22Ws02FinalPromotionDecisionPrepState),
    evaluateBaseline(evaluateX22Ws02FinalPromotionDecisionPrepState),
    evaluateBaseline(evaluateX22Ws02FinalPromotionDecisionPrepState),
  ].map((state) => ({
    ok: state.ok,
    token: state.X22_WS02_FINAL_PROMOTION_DECISION_PREP_OK,
    counts: state.counts,
    negativeResults: state.negativeResults,
    positiveResults: state.positiveResults,
    dod: state.dod,
    acceptance: state.acceptance,
    detector: state.detector,
  }));

  assert.deepEqual(runs[0], runs[1]);
  assert.deepEqual(runs[1], runs[2]);
  assert.equal(runs[0].ok, true);
});

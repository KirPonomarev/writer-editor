const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(
  REPO_ROOT,
  'scripts',
  'ops',
  'x21-ws02-promotion-dry-run-and-evidence-lock-state.mjs',
);

let modulePromise = null;

function loadModule() {
  if (!modulePromise) {
    modulePromise = import(pathToFileURL(MODULE_PATH).href);
  }
  return modulePromise;
}

function evaluateBaseline(evaluateX21Ws02PromotionDryRunAndEvidenceLockState) {
  return evaluateX21Ws02PromotionDryRunAndEvidenceLockState({ repoRoot: REPO_ROOT });
}

test('x21 ws02 baseline: promotion dry run and evidence lock pass', async () => {
  const { evaluateX21Ws02PromotionDryRunAndEvidenceLockState } = await loadModule();
  const state = evaluateBaseline(evaluateX21Ws02PromotionDryRunAndEvidenceLockState);

  assert.equal(state.ok, true, JSON.stringify(state, null, 2));
  assert.equal(state.X21_WS02_PROMOTION_DRY_RUN_AND_EVIDENCE_LOCK_OK, 1);
  assert.equal(state.counts.requiredEvidenceRefCount, 5);
  assert.equal(state.counts.missingEvidenceLinkCount, 0);
  assert.equal(state.counts.evidenceHashMismatchCount, 0);
  assert.equal(state.counts.modeCheckMissingCount, 0);
  assert.equal(state.counts.modeDispositionDriftCount, 0);
  assert.equal(state.counts.modeEvaluatorIssueCount, 0);
  assert.equal(state.counts.releaseClassDriftCount, 0);
  assert.equal(state.counts.promotionDryRunIssueCount, 0);
  assert.equal(state.counts.attestationIssueCount, 0);
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

test('x21 ws02 negative 01: missing evidence link is rejected', async () => {
  const { evaluateX21Ws02PromotionDryRunAndEvidenceLockState } = await loadModule();
  const state = evaluateBaseline(evaluateX21Ws02PromotionDryRunAndEvidenceLockState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_01, true);
});

test('x21 ws02 negative 02: evidence hash mismatch is rejected', async () => {
  const { evaluateX21Ws02PromotionDryRunAndEvidenceLockState } = await loadModule();
  const state = evaluateBaseline(evaluateX21Ws02PromotionDryRunAndEvidenceLockState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_02, true);
});

test('x21 ws02 negative 03: release class drift is rejected', async () => {
  const { evaluateX21Ws02PromotionDryRunAndEvidenceLockState } = await loadModule();
  const state = evaluateBaseline(evaluateX21Ws02PromotionDryRunAndEvidenceLockState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_03, true);
});

test('x21 ws02 negative 04: mode disposition drift is rejected', async () => {
  const { evaluateX21Ws02PromotionDryRunAndEvidenceLockState } = await loadModule();
  const state = evaluateBaseline(evaluateX21Ws02PromotionDryRunAndEvidenceLockState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_04, true);
});

test('x21 ws02 negative 05: non deterministic dry run output is rejected', async () => {
  const { evaluateX21Ws02PromotionDryRunAndEvidenceLockState } = await loadModule();
  const state = evaluateBaseline(evaluateX21Ws02PromotionDryRunAndEvidenceLockState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_05, true);
});

test('x21 ws02 repeatability: three runs are stable', async () => {
  const { evaluateX21Ws02PromotionDryRunAndEvidenceLockState } = await loadModule();

  const runs = [
    evaluateBaseline(evaluateX21Ws02PromotionDryRunAndEvidenceLockState),
    evaluateBaseline(evaluateX21Ws02PromotionDryRunAndEvidenceLockState),
    evaluateBaseline(evaluateX21Ws02PromotionDryRunAndEvidenceLockState),
  ].map((state) => ({
    ok: state.ok,
    token: state.X21_WS02_PROMOTION_DRY_RUN_AND_EVIDENCE_LOCK_OK,
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

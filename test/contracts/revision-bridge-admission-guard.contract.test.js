const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(
  REPO_ROOT,
  'scripts',
  'ops',
  'revision-bridge-pre-stage-00-admission-guard-state.mjs',
);

let modulePromise = null;

function loadModule() {
  if (!modulePromise) {
    modulePromise = import(pathToFileURL(MODULE_PATH).href);
  }
  return modulePromise;
}

test('revision bridge admission guard state passes with scoped artifacts only', async () => {
  const { evaluateRevisionBridgeAdmissionGuardState } = await loadModule();
  const state = evaluateRevisionBridgeAdmissionGuardState({ repoRoot: REPO_ROOT });

  assert.equal(state.ok, true, JSON.stringify(state, null, 2));
  assert.equal(state.REVISION_BRIDGE_PRE_STAGE_00_ADMISSION_GUARD_OK, 1);
  assert.equal(state.rulesSatisfied, true);
  assert.equal(state.deliverySatisfied, false);
  assert.equal(state.finalGateSatisfied, false);
  assert.equal(state.nextContourOpeningAllowed, false);
  assert.equal(state.advisoryUntilFeatureBranchOwnerAccepts, true);
  assert.equal(state.checks.branchIsolation.ok, true);
  assert.match(state.checks.branchIsolation.currentBranch, /^codex\/revision-bridge-/u);
  assert.equal(state.checks.branchIsolation.isMainlineBranch, false);
  assert.equal(state.checks.branchIsolation.looksMainTarget, false);

  for (const [name, check] of Object.entries(state.checks)) {
    assert.equal(check.ok, true, `check must pass: ${name}`);
  }

  assert.equal(
    state.negativeResults.NEGATIVE_04_DOCS_ONLY_RUNTIME_CLAIM_REJECTED,
    true,
  );
  assert.equal(
    state.negativeResults.NEGATIVE_10_PR_KERNEL_AS_ACTIVE_PROFILE_REJECTED,
    true,
  );
  assert.equal(
    state.negativeResults.NEGATIVE_11_MAINLINE_TARGET_IN_KERNEL_PROFILE_REJECTED,
    true,
  );
  assert.equal(
    state.negativeResults.NEGATIVE_12_MISSING_FEATURE_TARGET_RULE_REJECTED,
    true,
  );
  assert.equal(
    state.negativeResults.NEGATIVE_13_MAIN_PR_ALLOWED_REJECTED,
    true,
  );
  assert.equal(
    state.negativeResults.NEGATIVE_14_MAIN_MERGE_ALLOWED_REJECTED,
    true,
  );
  assert.equal(
    state.negativeResults.NEGATIVE_15_GLOBAL_GOVERNANCE_REWRITE_REQUIREMENT_REJECTED,
    true,
  );
  assert.equal(
    state.negativeResults.NEGATIVE_16_ADMISSION_TABLE_AS_CANON_SOURCE_REJECTED,
    true,
  );
  assert.equal(
    state.negativeResults.NEGATIVE_17_TRUST_ROOT_KERNEL_BLOCKER_REJECTED,
    true,
  );
  assert.equal(
    state.negativeResults.NEGATIVE_18_MAIN_BRANCH_REJECTED,
    true,
  );
  assert.equal(
    state.negativeResults.NEGATIVE_19_MAIN_NAMED_REVISION_BRANCH_REJECTED,
    true,
  );

  for (const [name, value] of Object.entries(state.negativeResults)) {
    assert.equal(value, true, `negative scenario must be rejected: ${name}`);
  }
});

test('revision bridge admission guard state is repeatable', async () => {
  const { evaluateRevisionBridgeAdmissionGuardState } = await loadModule();
  const runs = [
    evaluateRevisionBridgeAdmissionGuardState({ repoRoot: REPO_ROOT }),
    evaluateRevisionBridgeAdmissionGuardState({ repoRoot: REPO_ROOT }),
    evaluateRevisionBridgeAdmissionGuardState({ repoRoot: REPO_ROOT }),
  ].map((state) => ({
    ok: state.ok,
    token: state.token,
    checks: state.checks,
    negativeResults: state.negativeResults,
    rulesSatisfied: state.rulesSatisfied,
    deliverySatisfied: state.deliverySatisfied,
    finalGateSatisfied: state.finalGateSatisfied,
    nextContourOpeningAllowed: state.nextContourOpeningAllowed,
    advisoryUntilFeatureBranchOwnerAccepts: state.advisoryUntilFeatureBranchOwnerAccepts,
  }));

  assert.deepEqual(runs[0], runs[1]);
  assert.deepEqual(runs[1], runs[2]);
});

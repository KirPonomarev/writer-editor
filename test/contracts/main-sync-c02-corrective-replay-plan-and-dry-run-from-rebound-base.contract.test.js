const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'main-sync-c02-corrective-replay-plan-and-dry-run-from-rebound-base-state.mjs');
const STATUS_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'STATUS', 'MAIN_SYNC_C02_CORRECTIVE_REPLAY_PLAN_AND_DRY_RUN_FROM_REBOUND_BASE_STATUS_V1.json');
const PLAN_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'EVIDENCE', 'MAIN_SYNC_C02_CORRECTIVE_REPLAY_PLAN_AND_DRY_RUN_FROM_REBOUND_BASE', 'TICKET_01', 'corrected-replay-plan.json');
const DRY_RUN_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'EVIDENCE', 'MAIN_SYNC_C02_CORRECTIVE_REPLAY_PLAN_AND_DRY_RUN_FROM_REBOUND_BASE', 'TICKET_01', 'corrected-dry-run.json');
const CONFLICT_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'EVIDENCE', 'MAIN_SYNC_C02_CORRECTIVE_REPLAY_PLAN_AND_DRY_RUN_FROM_REBOUND_BASE', 'TICKET_01', 'conflict-classification.json');
const NEXT_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'EVIDENCE', 'MAIN_SYNC_C02_CORRECTIVE_REPLAY_PLAN_AND_DRY_RUN_FROM_REBOUND_BASE', 'TICKET_01', 'exact-c03-input.json');

let modulePromise = null;

function loadModule() {
  if (!modulePromise) {
    modulePromise = import(pathToFileURL(MODULE_PATH).href);
  }
  return modulePromise;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

test('corrective c02: stop packet keeps payload bound to canonical B2C chain only', async () => {
  const { evaluateMainSyncC02CorrectiveReplayPlanAndDryRunFromReboundBase, TOKEN_NAME } = await loadModule();
  const status = readJson(STATUS_PATH);
  const plan = readJson(PLAN_PATH);
  const dryRun = readJson(DRY_RUN_PATH);
  const conflict = readJson(CONFLICT_PATH);
  const next = readJson(NEXT_PATH);
  const state = evaluateMainSyncC02CorrectiveReplayPlanAndDryRunFromReboundBase({ repoRoot: REPO_ROOT });

  assert.equal(status.status, 'FAILED');
  assert.equal(status.allowedReplayPayloadClass, 'CANONICAL_B2C_CHAIN_ONLY');
  assert.equal(status.forbiddenReplayPayloadClass, 'PACKET_ONLY_SYNC_TAIL_REPLAY');
  assert.equal(status.boundRootSha, '88bac2e3945726a678d05ed5bdc54379c36314b9');
  assert.equal(status.boundMainSha, '0d6955c1bd8ccbae425510b0c07e2b0edf445130');

  assert.equal(state.ok, false);
  assert.equal(state[TOKEN_NAME], 0);
  assert.equal(state.scopeBinding.allowedReplayPayloadClass, 'CANONICAL_B2C_CHAIN_ONLY');
  assert.equal(state.scopeBinding.forbiddenReplayPayloadClass, 'PACKET_ONLY_SYNC_TAIL_REPLAY');
  assert.equal(state.correctedReplayPlan.replayUnitCount, 13);
  assert.equal(state.dryRun.replayClass, 'STOP_UNRESOLVED_CONFLICT');
  assert.equal(state.dryRun.stoppedAtOrder, 1);
  assert.equal(state.dryRun.stoppedAtSha, '24996555943e80fc3aa616becea731645771b4a8');
  assert.ok(state.dryRun.conflictFiles.includes('index.ts'));
  assert.ok(state.issues.some((entry) => entry.code === 'DRY_RUN_UNRESOLVED_CONFLICT'));

  assert.equal(plan.ok, true);
  assert.equal(dryRun.replayClass, 'STOP_UNRESOLVED_CONFLICT');
  assert.equal(conflict.classification, 'BLOCKING_UNRESOLVED_CONFLICT');
  assert.equal(next.ok, false);
  assert.equal(next.exactC03Input.dryRunReady, false);
});

test('corrective c02: invalid root sha fails rebound binding checks', async () => {
  const { evaluateMainSyncC02CorrectiveReplayPlanAndDryRunFromReboundBase, TOKEN_NAME } = await loadModule();
  const state = evaluateMainSyncC02CorrectiveReplayPlanAndDryRunFromReboundBase({
    repoRoot: REPO_ROOT,
    rootSha: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
  });
  assert.equal(state.ok, false);
  assert.equal(state[TOKEN_NAME], 0);
  assert.ok(state.issues.some((entry) => entry.code === 'BOUND_ROOT_DRIFT'));
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'main-sync-c02-selected-replay-plan-and-dry-run-state.mjs');
const STATUS_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'STATUS', 'MAIN_SYNC_C02_SELECTED_REPLAY_PLAN_AND_DRY_RUN_STATUS_V1.json');
const BINDING_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'EVIDENCE', 'MAIN_SYNC_C02_SELECTED_REPLAY_PLAN_AND_DRY_RUN', 'TICKET_01', 'binding-summary.json');
const DRY_RUN_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'EVIDENCE', 'MAIN_SYNC_C02_SELECTED_REPLAY_PLAN_AND_DRY_RUN', 'TICKET_01', 'dry-run-summary.json');
const CONFLICT_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'EVIDENCE', 'MAIN_SYNC_C02_SELECTED_REPLAY_PLAN_AND_DRY_RUN', 'TICKET_01', 'conflict-classification.json');
const NEXT_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'EVIDENCE', 'MAIN_SYNC_C02_SELECTED_REPLAY_PLAN_AND_DRY_RUN', 'TICKET_01', 'next-c03-input.json');

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

test('main sync c02: stop packet binds replay payload and blocking dry-run conflict', async () => {
  const { evaluateMainSyncC02SelectedReplayPlanAndDryRun, TOKEN_NAME } = await loadModule();
  const status = readJson(STATUS_PATH);
  const binding = readJson(BINDING_PATH);
  const dryRun = readJson(DRY_RUN_PATH);
  const conflict = readJson(CONFLICT_PATH);
  const next = readJson(NEXT_PATH);
  const state = evaluateMainSyncC02SelectedReplayPlanAndDryRun({ repoRoot: REPO_ROOT });

  assert.equal(status.status, 'FAILED');
  assert.equal(status.replayPayloadScope, 'CANONICAL_B2C_CHAIN_ONLY');
  assert.equal(status.controlPlaneScope, 'SYNC_PACKET_SCOPE_821_TO_824_BINDING_ONLY');
  assert.equal(status.payloadCount, 13);

  assert.equal(state.ok, false);
  assert.equal(state[TOKEN_NAME], 0);
  assert.equal(state.boundRefs.mainSha, '0d6955c1bd8ccbae425510b0c07e2b0edf445130');
  assert.equal(state.boundRefs.rootSha, '3fcbd048e2c3cc93484839201a6a8ee99f452a27');
  assert.equal(state.scopeBinding.replayPayloadScope, 'CANONICAL_B2C_CHAIN_ONLY');
  assert.equal(state.scopeBinding.controlPlaneScope, 'SYNC_PACKET_SCOPE_821_TO_824_BINDING_ONLY');
  assert.equal(state.replayPlan.replayUnitCount, 13);
  assert.equal(state.dryRun.replayClass, 'STOP_UNRESOLVED_CONFLICT');
  assert.equal(state.dryRun.stoppedAtOrder, 1);
  assert.equal(state.dryRun.stoppedAtSha, '24996555943e80fc3aa616becea731645771b4a8');
  assert.ok(state.dryRun.conflictFiles.includes('index.ts'));
  assert.ok(state.dryRun.changedBasenamesAtStop.includes('scene-document.contract.ts'));
  assert.ok(state.issues.some((entry) => entry.code === 'DRY_RUN_UNRESOLVED_CONFLICT'));

  assert.equal(binding.ok, true);
  assert.equal(dryRun.replayClass, 'STOP_UNRESOLVED_CONFLICT');
  assert.equal(conflict.classification, 'BLOCKING_UNRESOLVED_CONFLICT');
  assert.equal(next.ok, false);
  assert.equal(next.exactInput.dryRunReady, false);
  assert.equal(next.c03BlockedUntilGreenDryRun, true);
});

test('main sync c02: invalid root sha fails binding before dry run', async () => {
  const { evaluateMainSyncC02SelectedReplayPlanAndDryRun, TOKEN_NAME } = await loadModule();
  const state = evaluateMainSyncC02SelectedReplayPlanAndDryRun({
    repoRoot: REPO_ROOT,
    rootSha: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
  });
  assert.equal(state.ok, false);
  assert.equal(state[TOKEN_NAME], 0);
  assert.ok(state.issues.some((entry) => entry.code === 'BOUND_ROOT_DRIFT'));
});

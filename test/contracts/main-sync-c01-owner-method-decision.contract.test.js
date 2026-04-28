const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'main-sync-c01-owner-method-decision-state.mjs');
const RECORD_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'STATUS', 'MAIN_SYNC_C01_OWNER_METHOD_DECISION_STATUS_V1.json');
const SUMMARY_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'EVIDENCE', 'MAIN_SYNC_C01_OWNER_METHOD_DECISION', 'TICKET_01', 'decision-summary.json');
const REJECTED_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'EVIDENCE', 'MAIN_SYNC_C01_OWNER_METHOD_DECISION', 'TICKET_01', 'rejected-methods-matrix.json');
const NEXT_INPUT_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'EVIDENCE', 'MAIN_SYNC_C01_OWNER_METHOD_DECISION', 'TICKET_01', 'next-write-contour.json');

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

test('owner method decision: packet binds replay selection without execution grant', async () => {
  const { evaluateMainSyncC01OwnerMethodDecision, TOKEN_NAME } = await loadModule();
  const record = readJson(RECORD_PATH);
  const summary = readJson(SUMMARY_PATH);
  const rejected = readJson(REJECTED_PATH);
  const next = readJson(NEXT_INPUT_PATH);
  const state = evaluateMainSyncC01OwnerMethodDecision({ repoRoot: REPO_ROOT });

  assert.equal(record.status, 'ACTIVE');
  assert.equal(record.formalRepoTruth, 'MAIN_AFTER_MERGE_GATE_AND_POST_MERGE_RECONFIRM');
  assert.equal(record.selectedMethodId, 'CHERRY_PICK_REPLAY_TO_MAIN');
  assert.equal(record.executionGranted, false);
  assert.equal(state.ok, true, JSON.stringify(state, null, 2));
  assert.equal(state[TOKEN_NAME], 1);
  assert.equal(state.boundRefs.mainSha, '0d6955c1bd8ccbae425510b0c07e2b0edf445130');
  assert.equal(state.boundRefs.rootSha, '24c4e0da33fb6bafa74f5c1c8f7d501fb9fcdcc5');
  assert.equal(state.truthSurface.formalRepoTruth, 'MAIN_AFTER_MERGE_GATE_AND_POST_MERGE_RECONFIRM');
  assert.equal(state.truthSurface.rootRole, 'SOURCE_OF_REQUIRED_CONTENT_ONLY');
  assert.equal(state.ownerDecision.selectedMethod.methodId, 'CHERRY_PICK_REPLAY_TO_MAIN');
  assert.equal(state.ownerDecision.selectedMethod.executionGranted, false);
  assert.equal(state.checks.localHeadDescendsFromRoot, true);
  assert.equal(state.checks.c01FactsOk, true);
  assert.equal(state.checks.c02FactsOk, true);
  assert.equal(state.checks.admissionFactsOk, true);
  assert.equal(summary.ok, true);
  assert.equal(summary.ownerAcceptanceSource, 'THREAD_OWNER_DECISION_BOUND_BY_C01_PACKET');
  assert.equal(summary.selectedMethod.methodId, 'CHERRY_PICK_REPLAY_TO_MAIN');
  assert.ok(Array.isArray(rejected));
  assert.ok(rejected.some((entry) => entry.methodId === 'REBASE_REWRITE' && entry.classification === 'FORBIDDEN'));
  assert.equal(next.selectedMethod, 'CHERRY_PICK_REPLAY_TO_MAIN');
  assert.equal(next.exactC02Input.nextContour, 'MAIN_SYNC_C02_SELECTED_REPLAY_PLAN_AND_DRY_RUN');
  assert.equal(next.c03StillBlocked, true);
});

test('owner method decision: invalid root sha fails decision checks', async () => {
  const { evaluateMainSyncC01OwnerMethodDecision, TOKEN_NAME } = await loadModule();
  const state = evaluateMainSyncC01OwnerMethodDecision({
    repoRoot: REPO_ROOT,
    rootSha: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
  });
  assert.equal(state.ok, false);
  assert.equal(state[TOKEN_NAME], 0);
  assert.ok(state.issues.some((entry) => entry.code === 'BOUND_ROOT_DRIFT' || entry.code === 'LOCAL_HEAD_DRIFT'));
});

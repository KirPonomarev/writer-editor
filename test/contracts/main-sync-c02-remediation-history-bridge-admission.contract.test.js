const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'main-sync-c02-remediation-history-bridge-admission-state.mjs');
const RECORD_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'STATUS', 'MAIN_SYNC_C02_REMEDIATION_HISTORY_BRIDGE_ADMISSION_RECORD_V1.json');
const SUMMARY_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'EVIDENCE', 'MAIN_SYNC_C02_REMEDIATION_HISTORY_BRIDGE_ADMISSION', 'TICKET_01', 'admission-summary.json');
const NEXT_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'EVIDENCE', 'MAIN_SYNC_C02_REMEDIATION_HISTORY_BRIDGE_ADMISSION', 'TICKET_01', 'next-write-contour.json');

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

test('history bridge admission: record and summary agree on STOP recommendation and exact blocker facts', async () => {
  const { evaluateMainSyncC02RemediationHistoryBridgeAdmission, TOKEN_NAME } = await loadModule();
  const record = readJson(RECORD_PATH);
  const summary = readJson(SUMMARY_PATH);
  const next = readJson(NEXT_PATH);
  const state = evaluateMainSyncC02RemediationHistoryBridgeAdmission({ repoRoot: REPO_ROOT });

  assert.equal(record.status, 'MAIN_SYNC_C02_REMEDIATION_HISTORY_BRIDGE_RUNTIME_WRITES_NOT_ADMITTED');
  assert.equal(record.promotionDecision, 'STOP');
  assert.equal(record.runtimeWritesAdmitted, false);
  assert.equal(record.runtimeAdmissionGranted, false);
  assert.equal(state.ok, true, JSON.stringify(state, null, 2));
  assert.equal(state[TOKEN_NAME], 1);
  assert.equal(state.boundRefs.mainSha, '0d6955c1bd8ccbae425510b0c07e2b0edf445130');
  assert.equal(state.boundRefs.rootSha, '15611164c07d6b6a98e7d2c0617e9e8fa99ac887');
  assert.equal(state.localGitFacts.mergeBaseExists, false);
  assert.equal(state.c02BlockerFacts.c02FailReason, 'BLOCKING_UNRELATED_HISTORIES');
  assert.equal(state.c02BlockerFacts.c02MergeabilityClass, 'BLOCKING_UNRELATED_HISTORIES');
  assert.equal(state.checks.localHeadDescendsFromRoot, true);
  assert.equal(state.recommendation.methodId, 'STOP');
  assert.equal(summary.recommendation.methodId, 'STOP');
  assert.equal(next.c03Blocked, true);
  assert.equal(next.ownerAcceptanceRequired, true);
});

test('history bridge admission: invalid root sha fails admission checks', async () => {
  const { evaluateMainSyncC02RemediationHistoryBridgeAdmission, TOKEN_NAME } = await loadModule();
  const state = evaluateMainSyncC02RemediationHistoryBridgeAdmission({
    repoRoot: REPO_ROOT,
    rootSha: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
  });
  assert.equal(state.ok, false);
  assert.equal(state[TOKEN_NAME], 0);
  assert.ok(state.issues.some((entry) => entry.code === 'BOUND_ROOT_DRIFT' || entry.code === 'LOCAL_HEAD_DRIFT'));
});

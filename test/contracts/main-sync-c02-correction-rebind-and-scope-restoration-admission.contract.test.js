const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'main-sync-c02-correction-rebind-and-scope-restoration-admission-state.mjs');
const STATUS_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'STATUS', 'MAIN_SYNC_C02_CORRECTION_REBIND_AND_SCOPE_RESTORATION_ADMISSION_STATUS_V1.json');
const SUMMARY_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'EVIDENCE', 'MAIN_SYNC_C02_CORRECTION_REBIND_AND_SCOPE_RESTORATION_ADMISSION', 'TICKET_01', 'correction-admission-summary.json');
const SCOPE_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'EVIDENCE', 'MAIN_SYNC_C02_CORRECTION_REBIND_AND_SCOPE_RESTORATION_ADMISSION', 'TICKET_01', 'scope-restoration-matrix.json');
const NEXT_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'EVIDENCE', 'MAIN_SYNC_C02_CORRECTION_REBIND_AND_SCOPE_RESTORATION_ADMISSION', 'TICKET_01', 'next-write-scope-input.json');

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

test('main sync c02 correction admission: rebinding and scope restoration are machine bound', async () => {
  const { evaluateMainSyncC02CorrectionRebindAndScopeRestorationAdmission, TOKEN_NAME } = await loadModule();
  const status = readJson(STATUS_PATH);
  const summary = readJson(SUMMARY_PATH);
  const scope = readJson(SCOPE_PATH);
  const next = readJson(NEXT_PATH);
  const state = evaluateMainSyncC02CorrectionRebindAndScopeRestorationAdmission({ repoRoot: REPO_ROOT });

  assert.equal(status.status, 'ACTIVE');
  assert.equal(status.currentRootHeadSha, '6f08f94d6866ce3108d6e68d980e35b9e02d71b0');
  assert.equal(status.currentMainHeadSha, '0d6955c1bd8ccbae425510b0c07e2b0edf445130');
  assert.equal(status.pr825CanonicalAcceptanceState, 'NOT_CANONICALLY_ACCEPTED');
  assert.equal(status.allowedReplayPayloadClass, 'CANONICAL_B2C_CHAIN_ONLY');
  assert.equal(status.forbiddenReplayPayloadClass, 'PACKET_ONLY_SYNC_TAIL_REPLAY');

  assert.equal(state.ok, true, JSON.stringify(state, null, 2));
  assert.equal(state[TOKEN_NAME], 1);
  assert.equal(state.pr825Classification.prNumber, 825);
  assert.equal(state.pr825Classification.deliveryState, 'DELIVERED');
  assert.equal(state.pr825Classification.canonicalAcceptanceState, 'NOT_CANONICALLY_ACCEPTED');
  assert.equal(state.pr825Classification.scopeClassRecordedByPr825, 'PACKET_ONLY_SYNC_TAIL_AFTER_REBIND_BASE');
  assert.equal(state.allowedCorrectionDomain.classification, 'CANONICAL_B2C_CHAIN_ONLY');
  assert.equal(state.allowedCorrectionDomain.payloadCount, 13);
  assert.equal(state.controlPlaneBindingOnly.classification, 'SYNC_PACKET_COMMITS_821_TO_825_BINDING_ONLY');
  assert.equal(state.controlPlaneBindingOnly.packetReplayCommitCount, 7);
  assert.equal(state.forbiddenCorrectionDomain.classification, 'PACKET_ONLY_SYNC_TAIL_REPLAY');
  assert.equal(state.exactNextWriteScopeInput.bindingBaseRootSha, '6f08f94d6866ce3108d6e68d980e35b9e02d71b0');
  assert.equal(state.exactNextWriteScopeInput.executionApproved, false);
  assert.equal(state.exactNextWriteScopeInput.c03StillBlocked, true);
  assert.equal(summary.ok, true);
  assert.equal(scope.ok, true);
  assert.equal(next.ok, true);
});

test('main sync c02 correction admission: invalid root sha fails rebinding checks', async () => {
  const { evaluateMainSyncC02CorrectionRebindAndScopeRestorationAdmission, TOKEN_NAME } = await loadModule();
  const state = evaluateMainSyncC02CorrectionRebindAndScopeRestorationAdmission({
    repoRoot: REPO_ROOT,
    rootSha: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
  });
  assert.equal(state.ok, false);
  assert.equal(state[TOKEN_NAME], 0);
  assert.ok(state.issues.some((entry) => entry.code === 'BOUND_ROOT_DRIFT'));
});

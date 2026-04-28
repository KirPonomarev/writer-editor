const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'main-sync-c02-conflict-remediation-full-replay-state.mjs');
const STATUS_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'STATUS', 'MAIN_SYNC_C02_CONFLICT_REMEDIATION_AND_FULL_REPLAY_DRY_RUN_STATUS_V1.json');
const EVIDENCE_DIR = path.join(REPO_ROOT, 'docs', 'OPS', 'EVIDENCE', 'MAIN_SYNC_C02_CONFLICT_REMEDIATION_AND_FULL_REPLAY_DRY_RUN', 'TICKET_01');

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

test('main sync c02 conflict remediation: replay packet is green and scope-bound', async () => {
  const { evaluateMainSyncC02ConflictRemediationFullReplay, TOKEN_NAME } = await loadModule();
  const state = evaluateMainSyncC02ConflictRemediationFullReplay({ repoRoot: REPO_ROOT });
  const status = readJson(STATUS_PATH);
  const plan = readJson(path.join(EVIDENCE_DIR, 'replay-plan.json'));
  const conflict = readJson(path.join(EVIDENCE_DIR, 'conflict-remediation.json'));
  const tests = readJson(path.join(EVIDENCE_DIR, 'test-results.json'));
  const next = readJson(path.join(EVIDENCE_DIR, 'exact-c03-input.json'));

  assert.equal(state.ok, true, JSON.stringify(state, null, 2));
  assert.equal(state[TOKEN_NAME], 1);
  assert.equal(status.status, 'ACTIVE');
  assert.equal(status.replayReady, true);
  assert.equal(status.allowedPayloadClass, 'CANONICAL_B2C_CHAIN_ONLY');
  assert.equal(status.forbiddenPayloadClass, 'PACKET_ONLY_SYNC_TAIL_REPLAY');
  assert.equal(plan.payload.sourceCount, 13);
  assert.equal(plan.replay.replayCommitCount, 14);
  assert.equal(conflict.conflictRemediation.conflictCount, 1);
  assert.deepEqual(conflict.conflictRemediation.conflictBasenames, ['index.ts']);
  assert.equal(tests.ok, true);
  assert.equal(next.ok, true);
  assert.equal(next.exactC03Input.nextContour, 'MAIN_SYNC_C03_REPLAY_TO_MAIN_PR');
});

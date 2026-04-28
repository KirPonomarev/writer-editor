const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'main-sync-c04-post-merge-reconfirm-tail-closeout-state.mjs');
const STATUS_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'STATUS', 'MAIN_SYNC_C04_POST_MERGE_RECONFIRM_AND_TAIL_CLOSEOUT_STATUS_V1.json');
const EVIDENCE_DIR = path.join(REPO_ROOT, 'docs', 'OPS', 'EVIDENCE', 'MAIN_SYNC_C04_POST_MERGE_RECONFIRM_AND_TAIL_CLOSEOUT', 'TICKET_01');

let modulePromise = null;

function loadModule() {
  if (!modulePromise) modulePromise = import(pathToFileURL(MODULE_PATH).href);
  return modulePromise;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

test('main sync c04: main is reconfirmed and sync tail is closed', async () => {
  const { evaluateMainSyncC04PostMergeReconfirmTailCloseout, TOKEN_NAME } = await loadModule();
  const state = evaluateMainSyncC04PostMergeReconfirmTailCloseout({ repoRoot: REPO_ROOT });
  const status = readJson(STATUS_PATH);
  const tail = readJson(path.join(EVIDENCE_DIR, 'tail-closeout.json'));
  const tests = readJson(path.join(EVIDENCE_DIR, 'test-results.json'));

  assert.equal(state.ok, true, JSON.stringify(state, null, 2));
  assert.equal(state[TOKEN_NAME], 1);
  assert.equal(status.status, 'ACTIVE');
  assert.equal(status.syncTailClosed, true);
  assert.equal(tail.remoteTail.promotionBranchDeleted, true);
  assert.equal(tail.localRootClassification.dirtyRootTouched, false);
  assert.equal(tail.localRootClassification.localHygieneRequiredForMainTruth, false);
  assert.equal(tests.ok, true);
  assert.equal(status.nextStep, 'STOP_AND_RETURN_TO_BLOCK2');
});

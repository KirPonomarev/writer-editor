const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'b2c13-save-reopen-text-no-loss-state.mjs');
const STATUS_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'STATUS', 'B2C13_SAVE_REOPEN_TEXT_NO_LOSS_STATUS_V1.json');

let modulePromise = null;

function loadModule() {
  if (!modulePromise) {
    modulePromise = import(pathToFileURL(MODULE_PATH).href);
  }
  return modulePromise;
}

function readStatusPacket() {
  return JSON.parse(fs.readFileSync(STATUS_PATH, 'utf8'));
}

test('b2c13 save reopen text no loss: edited canonical text survives save and reopen', async () => {
  const { evaluateB2C13SaveReopenTextNoLossState, TOKEN_NAME } = await loadModule();
  const state = await evaluateB2C13SaveReopenTextNoLossState({ repoRoot: REPO_ROOT });

  assert.equal(state.ok, true, JSON.stringify(state, null, 2));
  assert.equal(state[TOKEN_NAME], 1);
  assert.equal(state.proof.repoBound, true);
  assert.equal(state.proof.positiveSaveOk, true);
  assert.equal(state.proof.textHashMatchesAfterReopen, true);
  assert.equal(state.proof.visibleTextMatchesAfterReopen, true);
  assert.equal(state.proof.sceneCount, 2);
  assert.deepEqual(state.failRows, []);
});

test('b2c13 save reopen text no loss: missing save and drift negatives are detected', async () => {
  const { evaluateB2C13SaveReopenTextNoLossState } = await loadModule();
  const state = await evaluateB2C13SaveReopenTextNoLossState({ repoRoot: REPO_ROOT });

  assert.equal(state.proof.missingSaveNegativeOk, true);
  assert.equal(state.proof.driftNegativeOk, true);
  assert.equal(state.proof.staleMarkerCountAfterCommit, 0);
  assert.equal(state.scope.releaseClaim, false);
  assert.equal(state.scope.docxDependencyImported, false);
  assert.equal(state.scope.uiTouched, false);
  assert.equal(state.scope.electronRuntimeClaim, false);
  assert.equal(state.scope.b2c14Closed, false);
  assert.equal(state.scope.b2c15Closed, false);
});

test('b2c13 save reopen text no loss: committed status packet matches executable state', async () => {
  const { evaluateB2C13SaveReopenTextNoLossState } = await loadModule();
  const state = await evaluateB2C13SaveReopenTextNoLossState({ repoRoot: REPO_ROOT });
  const packet = readStatusPacket();

  assert.deepEqual(packet, state);
});

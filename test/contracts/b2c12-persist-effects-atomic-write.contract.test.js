const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'b2c12-persist-effects-atomic-write-state.mjs');
const STATUS_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'STATUS', 'B2C12_PERSIST_EFFECTS_ATOMIC_WRITE_STATUS_V1.json');

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

test('b2c12 persist effects atomic write: batch helper is wired into flow save and open guard blocks stale batch state', async () => {
  const { evaluateB2C12PersistEffectsAtomicWriteState, TOKEN_NAME } = await loadModule();
  const state = await evaluateB2C12PersistEffectsAtomicWriteState({ repoRoot: REPO_ROOT });

  assert.equal(state.ok, true, JSON.stringify(state, null, 2));
  assert.equal(state[TOKEN_NAME], 1);
  assert.equal(state.flowSaveUsesBatchAtomicHelperOk, true);
  assert.equal(state.flowOpenGuardBlocksStaleBatchOk, true);
  assert.equal(state.flowSaveGuardBlocksStaleBatchOk, true);
  assert.equal(state.directSequentialSceneWriteRemovedOk, true);
  assert.deepEqual(state.failRows, []);
});

test('b2c12 persist effects atomic write: partial batch state is rejected and minimal recovery evidence remains', async () => {
  const { evaluateB2C12PersistEffectsAtomicWriteState } = await loadModule();
  const state = await evaluateB2C12PersistEffectsAtomicWriteState({ repoRoot: REPO_ROOT });

  assert.equal(state.positiveBatchCommitOk, true);
  assert.equal(state.partialBatchRollbackOk, true);
  assert.equal(state.commitMarkerNegativeOk, true);
  assert.equal(state.staleBatchRejectOk, true);
  assert.equal(state.recoveryEvidenceMinimalOk, true);
  assert.equal(state.broadStorageRewriteTouched, false);
  assert.equal(state.saveReopenScopeTouched, false);
  assert.equal(state.recoveryReadableScopeTouched, false);
  assert.equal(state.migrationScopeTouched, false);
});

test('b2c12 persist effects atomic write: committed status packet matches executable state', async () => {
  const { evaluateB2C12PersistEffectsAtomicWriteState } = await loadModule();
  const state = await evaluateB2C12PersistEffectsAtomicWriteState({ repoRoot: REPO_ROOT });
  const packet = readStatusPacket();
  assert.deepEqual(packet, state);
});

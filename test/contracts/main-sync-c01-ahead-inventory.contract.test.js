const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'main-sync-c01-ahead-inventory-state.mjs');
const STATUS_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'STATUS', 'MAIN_SYNC_C01_AHEAD_INVENTORY_STATUS_V1.json');

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

test('main sync c01 ahead inventory: status metadata and positive state agree on bound snapshot and classification counts', async () => {
  const { evaluateMainSyncC01AheadInventory, TOKEN_NAME } = await loadModule();
  const packet = readJson(STATUS_PATH);
  const state = evaluateMainSyncC01AheadInventory({ repoRoot: REPO_ROOT });

  assert.equal(packet.version, 1);
  assert.equal(packet.status, 'ACTIVE');
  assert.equal(packet.token, TOKEN_NAME);
  assert.equal(packet.stateScript, 'scripts/ops/main-sync-c01-ahead-inventory-state.mjs');
  assert.equal(packet.reportScript, 'scripts/ops/main-sync-c01-ahead-inventory-report.mjs');
  assert.equal(packet.contractTest, 'test/contracts/main-sync-c01-ahead-inventory.contract.test.js');

  assert.equal(state.ok, true, JSON.stringify(state, null, 2));
  assert.equal(state[TOKEN_NAME], 1);
  assert.equal(state.boundRefs.mainSha, '0d6955c1bd8ccbae425510b0c07e2b0edf445130');
  assert.equal(state.boundRefs.rootSha, '0b3cc7f91400df650dcb875453dda4b389bbeb3e');
  assert.equal(state.counts.totalAheadReachableCount, 1736);
  assert.equal(state.counts.mergeAheadReachableCount, 531);
  assert.equal(state.counts.nonMergeAheadReachableCount, 1205);
  assert.equal(state.counts.firstParentAheadCount, 612);
  assert.equal(state.counts.canonicalB2CFirstParentCount, 13);
  assert.equal(state.counts.preB2CRebindFirstParentCount, 3);
  assert.equal(state.counts.carryforwardFirstParentCount, 596);
  assert.equal(state.includedSets.length, 3);
  assert.equal(state.excludedSets.length, 1);
  assert.equal(state.excludedSets[0].count, 0);
  assert.equal(state.checks.rootDescendsFromMain, false);
  assert.equal(state.checks.divergentHistoryObserved, true);
});

test('main sync c01 ahead inventory: invalid bound root sha fails machine checks', async () => {
  const { evaluateMainSyncC01AheadInventory, TOKEN_NAME } = await loadModule();
  const state = evaluateMainSyncC01AheadInventory({
    repoRoot: REPO_ROOT,
    rootSha: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
  });

  assert.equal(state.ok, false);
  assert.equal(state[TOKEN_NAME], 0);
  assert.equal(state.failSignalCode, 'E_MAIN_SYNC_C01_AHEAD_INVENTORY_RED');
  assert.ok(state.issues.some((entry) => entry.code === 'ROOT_SHA_UNREADABLE'));
});

test('main sync c01 ahead inventory: repeatability is stable across three runs', async () => {
  const { evaluateMainSyncC01AheadInventory } = await loadModule();

  const runs = [];
  for (let i = 0; i < 3; i += 1) {
    const state = evaluateMainSyncC01AheadInventory({ repoRoot: REPO_ROOT });
    runs.push({
      ok: state.ok,
      counts: state.counts,
      checks: state.checks,
      includedSets: state.includedSets,
      excludedSets: state.excludedSets,
      riskRows: state.riskRows,
      failReason: state.failReason,
    });
  }

  assert.deepEqual(runs[0], runs[1]);
  assert.deepEqual(runs[1], runs[2]);
  assert.equal(runs[0].ok, true);
  assert.equal(runs[0].checks.firstParentCoverageOk, true);
  assert.equal(runs[0].checks.b2cChainIdentifiedOk, true);
});

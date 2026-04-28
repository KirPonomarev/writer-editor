const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'b2c07-transaction-boundary-minimal.mjs');
const STATUS_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'STATUS', 'B2C07_TRANSACTION_BOUNDARY_MINIMAL_V1.json');

let modulePromise = null;

function loadModule() {
  if (!modulePromise) {
    modulePromise = import(pathToFileURL(MODULE_PATH).href);
  }
  return modulePromise;
}

function withMutatedStatus(mutator) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'b2c07-'));
  const statusCopy = path.join(tmpDir, 'B2C07_TRANSACTION_BOUNDARY_MINIMAL_V1.json');
  const parsed = JSON.parse(fs.readFileSync(STATUS_PATH, 'utf8'));
  mutator(parsed);
  fs.writeFileSync(statusCopy, JSON.stringify(parsed, null, 2));
  return statusCopy;
}

test('b2c07 transaction boundary minimal: canonical packet is green', async () => {
  const { evaluateB2C07TransactionBoundaryMinimal } = await loadModule();
  const state = await evaluateB2C07TransactionBoundaryMinimal({ repoRoot: REPO_ROOT });

  assert.equal(state.ok, true, JSON.stringify(state, null, 2));
  assert.equal(state.B2C07_TRANSACTION_BOUNDARY_MINIMAL_OK, 1);
  assert.equal(state.code, '');
  assert.equal(state.transactionUnitId, 'SCENE');
  assert.equal(state.admittedBoundaryRowCount, 3);
  assert.equal(state.advisoryBoundaryRowCount, 2);
});

test('b2c07 transaction boundary minimal: document transaction unit fails', async () => {
  const { evaluateB2C07TransactionBoundaryMinimal } = await loadModule();
  const statusCopy = withMutatedStatus((parsed) => {
    parsed.boundary.transactionUnitId = 'DOCUMENT';
  });

  const state = await evaluateB2C07TransactionBoundaryMinimal({
    repoRoot: REPO_ROOT,
    statusRef: statusCopy,
  });

  assert.equal(state.ok, false);
  assert.equal(state.code, 'E_B2C07_BOUNDARY_SET');
});

test('b2c07 transaction boundary minimal: cross-scene batch atomicity promoted to admitted fails', async () => {
  const { evaluateB2C07TransactionBoundaryMinimal } = await loadModule();
  const statusCopy = withMutatedStatus((parsed) => {
    parsed.boundary.admittedBoundaryRows.push({
      rowId: 'CROSS_SCENE_BATCH_ATOMICITY',
      proofLevel: 'FALSE_PROMOTION',
    });
  });

  const state = await evaluateB2C07TransactionBoundaryMinimal({
    repoRoot: REPO_ROOT,
    statusRef: statusCopy,
  });

  assert.equal(state.ok, false);
  assert.equal(state.code, 'E_B2C07_BOUNDARY_SET');
});

test('b2c07 transaction boundary minimal: forbidden recovery protocol key fails', async () => {
  const { evaluateB2C07TransactionBoundaryMinimal } = await loadModule();
  const statusCopy = withMutatedStatus((parsed) => {
    parsed.recoveryProtocol = { cadence: 'forbidden' };
  });

  const state = await evaluateB2C07TransactionBoundaryMinimal({
    repoRoot: REPO_ROOT,
    statusRef: statusCopy,
  });

  assert.equal(state.ok, false);
  assert.equal(state.code, 'E_B2C07_FORBIDDEN_SCOPE');
});

test('b2c07 transaction boundary minimal: duplicate detector binding fails', async () => {
  const { evaluateB2C07TransactionBoundaryMinimal } = await loadModule();
  const statusCopy = withMutatedStatus((parsed) => {
    parsed.proofBinding.boundaryRows[2].detectorId = parsed.proofBinding.boundaryRows[0].detectorId;
  });

  const state = await evaluateB2C07TransactionBoundaryMinimal({
    repoRoot: REPO_ROOT,
    statusRef: statusCopy,
  });

  assert.equal(state.ok, false);
  assert.equal(state.code, 'E_B2C07_DETECTOR_BINDING');
});

test('b2c07 transaction boundary minimal: extra transaction cluster fails', async () => {
  const { evaluateB2C07TransactionBoundaryMinimal } = await loadModule();
  const statusCopy = withMutatedStatus((parsed) => {
    parsed.boundary.advisoryBoundaryRows.push({
      rowId: 'EXTRA_TRANSACTION_CLUSTER',
      proofLevel: 'OUT_OF_SCOPE_BREACH',
    });
  });

  const state = await evaluateB2C07TransactionBoundaryMinimal({
    repoRoot: REPO_ROOT,
    statusRef: statusCopy,
  });

  assert.equal(state.ok, false);
  assert.equal(state.code, 'E_B2C07_BOUNDARY_SET');
});

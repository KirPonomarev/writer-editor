const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'b3c01-command-kernel-scope-lock-state.mjs');
const STATUS_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'STATUS', 'B3C01_COMMAND_KERNEL_SCOPE_LOCK_STATUS_V1.json');
const EVIDENCE_DIR = path.join(REPO_ROOT, 'docs', 'OPS', 'EVIDENCE', 'B3C01_COMMAND_KERNEL_SCOPE_LOCK', 'TICKET_01');

let modulePromise = null;

function loadModule() {
  if (!modulePromise) {
    modulePromise = import(pathToFileURL(MODULE_PATH).href);
  }
  return modulePromise;
}

function readJson(targetPath) {
  return JSON.parse(fs.readFileSync(targetPath, 'utf8'));
}

test('b3c01 command kernel scope lock: committed status equals executable state', async () => {
  const { evaluateB3C01CommandKernelScopeLockState, TOKEN_NAME } = await loadModule();
  const state = await evaluateB3C01CommandKernelScopeLockState({ repoRoot: REPO_ROOT });
  const committedState = readJson(STATUS_PATH);

  assert.deepEqual(committedState, state);
  assert.equal(state.ok, true, JSON.stringify(state, null, 2));
  assert.equal(state.status, 'PASS');
  assert.equal(state[TOKEN_NAME], 1);
  assert.deepEqual(state.failRows, []);
  assert.equal(state.proof.block2ClosedInputBound, true);
  assert.equal(state.proof.b2c09B2c10B2c11B2c12InputsBound, true);
  assert.equal(state.proof.commandIdStandardBound, true);
  assert.equal(state.proof.commandCapabilityBindingBound, true);
  assert.equal(state.proof.commandVisibilityMatrixBound, true);
});

test('b3c01 command kernel scope lock: evidence packets align with executable state', async () => {
  const { evaluateB3C01CommandKernelScopeLockState } = await loadModule();
  const state = await evaluateB3C01CommandKernelScopeLockState({ repoRoot: REPO_ROOT });
  const commandResults = readJson(path.join(EVIDENCE_DIR, 'command-results.json'));
  const scopeLock = readJson(path.join(EVIDENCE_DIR, 'scope-lock-table.json'));
  const testMatrix = readJson(path.join(EVIDENCE_DIR, 'test-matrix.json'));
  const denylist = readJson(path.join(EVIDENCE_DIR, 'denylist.json'));
  const commandSurfaceMap = readJson(path.join(EVIDENCE_DIR, 'command-surface-map.json'));
  const inputStatusBindings = readJson(path.join(EVIDENCE_DIR, 'input-status-bindings.json'));

  assert.deepEqual(commandResults, state.runtime.commandResults);
  assert.deepEqual(scopeLock, state.runtime.scopeLockTable);
  assert.deepEqual(testMatrix, state.runtime.testMatrix);
  assert.deepEqual(denylist, state.runtime.denylist);
  assert.deepEqual(commandSurfaceMap.rows, state.runtime.commandSurfaceMap);
  assert.deepEqual(inputStatusBindings.rows, state.runtime.inputStatusBindings);
  assert.equal(scopeLock.rowCount, 8);
  assert.equal(testMatrix.rowCount, 15);
  assert.equal(denylist.rowCount, 10);
  assert.equal(commandSurfaceMap.rows.every((row) => row.exists === true), true);
  assert.equal(inputStatusBindings.rows.every((row) => row.ok === true), true);
});

test('b3c01 command kernel scope lock: admission stays non-runtime and bounded', async () => {
  const { evaluateB3C01CommandKernelScopeLockState } = await loadModule();
  const state = await evaluateB3C01CommandKernelScopeLockState({ repoRoot: REPO_ROOT });

  assert.equal(state.scope.block3AdmissionExplicit, true);
  assert.equal(state.scope.runtimeContourStarted, false);
  assert.equal(state.scope.productRuntimeChanged, false);
  assert.equal(state.scope.uiTouched, false);
  assert.equal(state.scope.dependencyChanged, false);
  assert.equal(state.scope.schemaChanged, false);
  assert.equal(state.scope.storageFormatChanged, false);
  assert.equal(state.scope.exportChanged, false);
  assert.equal(state.scope.pluginRuntimeStarted, false);
  assert.equal(state.scope.releaseReadyClaim, false);
  assert.equal(state.scope.factualDocCutoverClaim, false);
  assert.equal(state.scope.block2Reopened, false);
  assert.equal(state.runtime.commandResults.commands.length, 11);
  assert.equal(state.runtime.commandResults.allPassed, true);
  assert.equal(state.runtime.commandResults.noPending, true);
});

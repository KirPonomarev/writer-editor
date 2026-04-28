const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'b2c10-command-bypass-negative-matrix-state.mjs');
const STATUS_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'STATUS', 'B2C10_COMMAND_BYPASS_NEGATIVE_MATRIX_STATUS_V1.json');

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

test('b2c10 bypass negative matrix: current canonical core remains green and advisory tails are explicit', async () => {
  const { evaluateB2C10CommandBypassNegativeMatrixState, TOKEN_NAME } = await loadModule();
  const state = evaluateB2C10CommandBypassNegativeMatrixState({ repoRoot: REPO_ROOT });

  assert.equal(state.ok, true, JSON.stringify(state, null, 2));
  assert.equal(state[TOKEN_NAME], 1);
  assert.equal(state.commandSurfaceCoreOk, true);
  assert.equal(state.callerTrustCoreOk, true);
  assert.equal(state.commandSurfaceState.tokenEnforced, 1);
  assert.equal(state.commandSurfaceState.tokenBypassTests, 1);
  assert.equal(state.callerTrustState.tokenOk, 1);
  assert.deepEqual(state.failRows, []);
});

test('b2c10 bypass negative matrix: mandatory bypass routes are machine-proved rejected', async () => {
  const { evaluateB2C10CommandBypassNegativeMatrixState } = await loadModule();
  const state = evaluateB2C10CommandBypassNegativeMatrixState({ repoRoot: REPO_ROOT });
  const provedRejected = new Map(
    state.coverageMatrix
      .filter((row) => row.status === 'PROVED_REJECTED')
      .map((row) => [row.routeId, row]),
  );

  for (const routeId of [
    'hotkey.direct',
    'palette.direct',
    'ipc.renderer-main.direct',
    'context.button.direct',
    'plugin.overlay.exec',
  ]) {
    assert.equal(provedRejected.has(routeId), true, routeId);
  }
});

test('b2c10 bypass negative matrix: extra existing mutation surfaces stay advisory and signals stay out of scope', async () => {
  const { evaluateB2C10CommandBypassNegativeMatrixState } = await loadModule();
  const state = evaluateB2C10CommandBypassNegativeMatrixState({ repoRoot: REPO_ROOT });

  assert.deepEqual(
    state.advisoryGapRows,
    [
      'autosave.request',
      'editor.paste-handler',
      'tree.document.direct-electron-api',
    ],
  );
  assert.deepEqual(
    state.outOfScopeSignalRows,
    [
      'dirty-state.signal-bridge',
      'save-lifecycle.signal-bridge',
    ],
  );
});

test('b2c10 bypass negative matrix: committed status packet matches executable state', async () => {
  const { evaluateB2C10CommandBypassNegativeMatrixState } = await loadModule();
  const state = evaluateB2C10CommandBypassNegativeMatrixState({ repoRoot: REPO_ROOT });
  const packet = readStatusPacket();
  assert.deepEqual(packet, state);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'b2c11-command-effect-model-state.mjs');
const STATUS_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'STATUS', 'B2C11_COMMAND_EFFECT_MODEL_STATUS_V1.json');

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

test('b2c11 command effect model: command boundary is green and direct bridge payload calls are eliminated', async () => {
  const { evaluateB2C11CommandEffectModelState, TOKEN_NAME } = await loadModule();
  const state = await evaluateB2C11CommandEffectModelState({ repoRoot: REPO_ROOT });

  assert.equal(state.ok, true, JSON.stringify(state, null, 2));
  assert.equal(state[TOKEN_NAME], 1);
  assert.equal(state.validatePurityOk, true);
  assert.equal(state.persistEffectsOnlyWriteOk, true);
  assert.deepEqual(state.directProjectBridgePayloadCallsRemaining, []);
  assert.deepEqual(state.failRows, []);
});

test('b2c11 command effect model: operation plan is deterministic and storage scope stays untouched', async () => {
  const { evaluateB2C11CommandEffectModelState } = await loadModule();
  const state = await evaluateB2C11CommandEffectModelState({ repoRoot: REPO_ROOT });

  assert.equal(state.operationPlanDeterministicOk, true);
  assert.equal(state.buildPhaseSideEffectFreeOk, true);
  assert.deepEqual(state.directWriteMarkersRemaining, []);
  assert.deepEqual(state.ledgerMarkersRemaining, []);
  assert.deepEqual(state.recoveryMarkersRemaining, []);
  assert.equal(state.storageRewriteTouched, false);
  assert.equal(state.atomicWriteTouched, false);
});

test('b2c11 command effect model: committed status packet matches executable state', async () => {
  const { evaluateB2C11CommandEffectModelState } = await loadModule();
  const state = await evaluateB2C11CommandEffectModelState({ repoRoot: REPO_ROOT });
  const packet = readStatusPacket();
  assert.deepEqual(packet, state);
});

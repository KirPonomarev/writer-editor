const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

let modulePromise = null;

function loadModule() {
  if (!modulePromise) {
    modulePromise = import(pathToFileURL(
      path.join(process.cwd(), 'scripts/ops/Y6_COMMAND_SEAM_FENCING_STATE.mjs'),
    ).href);
  }
  return modulePromise;
}

test('Y6 command seam fencing state: positive run validates single trusted command flow', async () => {
  const { evaluateY6CommandSeamFencingState } = await loadModule();
  const state = evaluateY6CommandSeamFencingState();

  assert.equal(state.ok, true, JSON.stringify(state, null, 2));
  assert.equal(state.Y6_COMMAND_SEAM_FENCING_OK, 1);
  assert.equal(state.failSignal, '');
  assert.equal(state.requiredPrChecksPolicySatisfied, true);
  assert.equal(state.singleNextMove, 'CONTOUR_Y7_FOUNDATION_STATE_AND_PROOF_REGEN');
  assert.equal(state.checks.editorDirectBypassAbsent, true);
  assert.equal(state.checks.preloadLifecycleBridgeOnly, true);
  assert.equal(state.checks.projectCommandsBridgeOnly, true);
  assert.equal(state.checks.runtimeEntrypointBundleSync, true);
});

test('Y6 command seam fencing state: forced negative path is deterministic', async () => {
  const { evaluateY6CommandSeamFencingState } = await loadModule();
  const state = evaluateY6CommandSeamFencingState({ forceNegative: true });

  assert.equal(state.ok, false, JSON.stringify(state, null, 2));
  assert.equal(state.Y6_COMMAND_SEAM_FENCING_OK, 0);
  assert.equal(state.failSignal, 'E_COMMAND_SURFACE_BYPASS');
  assert.equal(state.failReason, 'FORCED_NEGATIVE');
  assert.equal(state.checks.runtimeEntrypointBundleSync, false);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'b2c06-project-lifecycle-state.mjs');
const STATUS_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'STATUS', 'B2C06_PROJECT_LIFECYCLE_STATE_MACHINE_V1.json');

let modulePromise = null;

function loadModule() {
  if (!modulePromise) {
    modulePromise = import(pathToFileURL(MODULE_PATH).href);
  }
  return modulePromise;
}

function withMutatedStatus(mutator) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'b2c06-'));
  const statusCopy = path.join(tmpDir, 'B2C06_PROJECT_LIFECYCLE_STATE_MACHINE_V1.json');
  const parsed = JSON.parse(fs.readFileSync(STATUS_PATH, 'utf8'));
  mutator(parsed);
  fs.writeFileSync(statusCopy, JSON.stringify(parsed, null, 2));
  return statusCopy;
}

test('b2c06 project lifecycle state machine: canonical packet is green', async () => {
  const { evaluateB2C06ProjectLifecycleState } = await loadModule();
  const state = await evaluateB2C06ProjectLifecycleState({ repoRoot: REPO_ROOT });

  assert.equal(state.ok, true, JSON.stringify(state, null, 2));
  assert.equal(state.B2C06_PROJECT_LIFECYCLE_STATE_MACHINE_OK, 1);
  assert.equal(state.code, '');
  assert.equal(state.mainStateCount, 3);
  assert.equal(state.advisoryStateCount, 1);
  assert.equal(state.admittedTransitionCount, 2);
});

test('b2c06 project lifecycle state machine: recovered in main state set fails', async () => {
  const { evaluateB2C06ProjectLifecycleState } = await loadModule();
  const statusCopy = withMutatedStatus((parsed) => {
    parsed.graph.mainStateIds.push('RECOVERED');
  });

  const state = await evaluateB2C06ProjectLifecycleState({
    repoRoot: REPO_ROOT,
    statusRef: statusCopy,
  });

  assert.equal(state.ok, false);
  assert.equal(state.code, 'E_B2C06_STATE_SET');
});

test('b2c06 project lifecycle state machine: fourth state cluster fails', async () => {
  const { evaluateB2C06ProjectLifecycleState } = await loadModule();
  const statusCopy = withMutatedStatus((parsed) => {
    parsed.graph.mainStateIds.push('EXTRA_STATE');
  });

  const state = await evaluateB2C06ProjectLifecycleState({
    repoRoot: REPO_ROOT,
    statusRef: statusCopy,
  });

  assert.equal(state.ok, false);
  assert.equal(state.code, 'E_B2C06_STATE_SET');
});

test('b2c06 project lifecycle state machine: open dirty to clean in admitted transitions fails', async () => {
  const { evaluateB2C06ProjectLifecycleState } = await loadModule();
  const statusCopy = withMutatedStatus((parsed) => {
    parsed.graph.admittedTransitions.push({
      transitionId: 'OPEN_DIRTY_TO_OPEN_CLEAN',
      from: 'OPEN_DIRTY',
      to: 'OPEN_CLEAN',
      proofLevel: 'SIGNAL_PRESENT_ONLY',
    });
  });

  const state = await evaluateB2C06ProjectLifecycleState({
    repoRoot: REPO_ROOT,
    statusRef: statusCopy,
  });

  assert.equal(state.ok, false);
  assert.equal(state.code, 'E_B2C06_TRANSITION_SET');
});

test('b2c06 project lifecycle state machine: forbidden recovery protocol key fails', async () => {
  const { evaluateB2C06ProjectLifecycleState } = await loadModule();
  const statusCopy = withMutatedStatus((parsed) => {
    parsed.recoveryProtocol = { cadence: 'forbidden' };
  });

  const state = await evaluateB2C06ProjectLifecycleState({
    repoRoot: REPO_ROOT,
    statusRef: statusCopy,
  });

  assert.equal(state.ok, false);
  assert.equal(state.code, 'E_B2C06_FORBIDDEN_SCOPE');
});

test('b2c06 project lifecycle state machine: detector row drift fails', async () => {
  const { evaluateB2C06ProjectLifecycleState } = await loadModule();
  const statusCopy = withMutatedStatus((parsed) => {
    parsed.proofBinding.transitionRows[1].detectorId = parsed.proofBinding.transitionRows[0].detectorId;
  });

  const state = await evaluateB2C06ProjectLifecycleState({
    repoRoot: REPO_ROOT,
    statusRef: statusCopy,
  });

  assert.equal(state.ok, false);
  assert.equal(state.code, 'E_B2C06_DETECTOR_BINDING');
});

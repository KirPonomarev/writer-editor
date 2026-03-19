const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

const SCRIPT_PATH = 'scripts/ops/phase07-startup-runtime-measurement-baseline-state.mjs';
const EXPECTED_BLOCKING_BUDGET_IDS = [
  'STARTUP',
  'PROJECT_OPEN',
  'SCENE_SWITCH',
  'RESET',
];
const EXPECTED_BOUND_SIGNAL_IDS = [
  'STARTUP_MEASUREMENT_BOUND',
  'PROJECT_OPEN_MEASUREMENT_BOUND',
  'PERF_RUN_STARTUP_MEASUREMENT_PRESENT',
  'BLOCKING_BUDGET_ORDER_STARTUP_PROJECT_OPEN_SCENE_SWITCH_RESET',
];
const EXPECTED_LOCKED_TARGET_IDS = [
  'STARTUP_MEASUREMENT_BOUND',
  'PROJECT_OPEN_MEASUREMENT_BOUND',
  'SCENE_SWITCH_MEASUREMENT_NOT_BOUND',
  'RESET_MEASUREMENT_NOT_BOUND',
  'BLOCKING_BUDGET_ORDER_STARTUP_PROJECT_OPEN_SCENE_SWITCH_RESET',
  'PHASE07_STARTUP_RUNTIME_MEASUREMENT_BASELINE',
];
const EXPECTED_PENDING_GAP_IDS = [
  'PHASE07_SCENE_SWITCH_MEASUREMENT_NOT_BOUND',
  'PHASE07_RESET_MEASUREMENT_NOT_BOUND',
];

function runStateScript(args = []) {
  return spawnSync(process.execPath, [SCRIPT_PATH, '--json', ...args], {
    encoding: 'utf8',
  });
}

function parseJsonOutput(result) {
  let payload = null;
  assert.doesNotThrow(() => {
    payload = JSON.parse(String(result.stdout || '{}'));
  }, `invalid JSON output:\n${result.stdout}\n${result.stderr}`);
  return payload;
}

test('phase07 startup runtime measurement baseline: positive run passes with startup bound and honest open gaps', () => {
  const result = runStateScript();
  assert.equal(result.status, 0, `expected state script pass:\n${result.stdout}\n${result.stderr}`);

  const payload = parseJsonOutput(result);
  assert.equal(payload.ok, true);
  assert.equal(payload.failReason, '');
  assert.equal(payload.overallStatus, 'PASS');
  assert.equal(payload.phase07StartupRuntimeMeasurementBaselineStatus, 'PASS');
  assert.equal(payload.phase07ReadinessStatus, 'HOLD');
  assert.deepEqual(payload.phase07BlockingBudgetIds, EXPECTED_BLOCKING_BUDGET_IDS);
  assert.deepEqual(payload.boundSignalIds, EXPECTED_BOUND_SIGNAL_IDS);
  assert.deepEqual(payload.lockedTargetIds, EXPECTED_LOCKED_TARGET_IDS);
  assert.deepEqual(payload.phase07PendingGapIds, EXPECTED_PENDING_GAP_IDS);
  assert.deepEqual(payload.openGapIds, [
    'SCENE_SWITCH_MEASUREMENT_NOT_BOUND',
    'RESET_MEASUREMENT_NOT_BOUND',
  ]);
  assert.equal(payload.greenCheckIds.includes('PREVIOUS_PHASE07_BLOCKING_BUDGETS_BASELINE_PASS'), true);
  assert.equal(payload.greenCheckIds.includes('PHASE07_RUNTIME_MEASUREMENTS_FOUNDATION_PASS'), true);
  assert.equal(payload.greenCheckIds.includes('PERF_RUN_STARTUP_MEASUREMENT_PRESENT'), true);
  assert.equal(payload.greenCheckIds.includes('STARTUP_MEASUREMENT_BOUND'), true);
  assert.equal(payload.greenCheckIds.includes('PROJECT_OPEN_MEASUREMENT_BOUND'), true);
  assert.equal(payload.greenCheckIds.includes('BLOCKING_BUDGET_ORDER_EXACT'), true);
  assert.equal(payload.greenCheckIds.includes('PACKET_INTERNAL_CONSISTENCY'), true);
  assert.equal(payload.checkStatusById.PACKET_INTERNAL_CONSISTENCY.status, 'GREEN');
  assert.equal(payload.checkStatusById.PACKET_INTERNAL_CONSISTENCY.measured, true);
});

test('phase07 startup runtime measurement baseline: forced negative path is deterministic', () => {
  const result = runStateScript(['--force-negative']);
  assert.notEqual(result.status, 0, 'expected forced-negative mode to return non-zero');

  const payload = parseJsonOutput(result);
  assert.equal(payload.ok, false);
  assert.equal(payload.failReason, 'E_PHASE07_STARTUP_RUNTIME_MEASUREMENT_BASELINE_FORCED_NEGATIVE');
  assert.equal(payload.overallStatus, 'HOLD');
  assert.equal(payload.phase07StartupRuntimeMeasurementBaselineStatus, 'HOLD');
  assert.equal(payload.phase07ReadinessStatus, 'HOLD');
  assert.equal(payload.openGapIds.includes('FORCED_NEGATIVE_PATH'), true);
});

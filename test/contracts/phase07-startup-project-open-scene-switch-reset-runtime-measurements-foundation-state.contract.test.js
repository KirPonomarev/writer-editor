const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

const SCRIPT_PATH = 'scripts/ops/phase07-startup-project-open-scene-switch-reset-runtime-measurements-foundation-state.mjs';
const EXPECTED_BLOCKING_BUDGET_IDS = [
  'STARTUP',
  'PROJECT_OPEN',
  'SCENE_SWITCH',
  'RESET',
];
const EXPECTED_PENDING_GAP_IDS = [
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

test('phase07 runtime measurements foundation: positive run passes with scene switch bound and reset still open', () => {
  const result = runStateScript();
  assert.equal(result.status, 0, `expected state script pass:\n${result.stdout}\n${result.stderr}`);

  const payload = parseJsonOutput(result);
  assert.equal(payload.ok, true);
  assert.equal(payload.failReason, '');
  assert.equal(payload.overallStatus, 'PASS');
  assert.equal(payload.phase07RuntimeMeasurementsFoundationStatus, 'PASS');
  assert.equal(payload.phase07RuntimeMeasurementsReadinessStatus, 'HOLD');
  assert.deepEqual(payload.phase07BlockingBudgetIds, EXPECTED_BLOCKING_BUDGET_IDS);
  assert.deepEqual(payload.phase07PendingGapIds, EXPECTED_PENDING_GAP_IDS);
  assert.deepEqual(payload.openGapIds, [
    'RESET_MEASUREMENT_NOT_BOUND',
  ]);
  assert.equal(payload.greenCheckIds.includes('PREVIOUS_PHASE07_BLOCKING_BUDGETS_BASELINE_PASS'), true);
  assert.equal(payload.greenCheckIds.includes('PERF_INFRASTRUCTURE_PRESENT'), true);
  assert.equal(payload.greenCheckIds.includes('PROJECT_OPEN_MEASUREMENT_BOUND'), true);
  assert.equal(payload.greenCheckIds.includes('STARTUP_MEASUREMENT_BOUND'), true);
  assert.equal(payload.greenCheckIds.includes('SCENE_SWITCH_MEASUREMENT_BOUND'), true);
  assert.equal(payload.greenCheckIds.includes('PHASE07_PENDING_GAP_IDS_HONEST'), true);
  assert.equal(payload.greenCheckIds.includes('PACKET_INTERNAL_CONSISTENCY'), true);
  assert.equal(payload.checkStatusById.PROJECT_OPEN_MEASUREMENT_BOUND.status, 'GREEN');
  assert.equal(payload.checkStatusById.PROJECT_OPEN_MEASUREMENT_BOUND.measured, true);
  assert.equal(payload.checkStatusById.STARTUP_MEASUREMENT_BOUND.status, 'GREEN');
  assert.equal(payload.checkStatusById.STARTUP_MEASUREMENT_BOUND.measured, true);
  assert.equal(payload.checkStatusById.SCENE_SWITCH_MEASUREMENT_BOUND.status, 'GREEN');
  assert.equal(payload.checkStatusById.SCENE_SWITCH_MEASUREMENT_BOUND.measured, true);
  assert.equal(payload.checkStatusById.RESET_MEASUREMENT_NOT_BOUND.status, 'OPEN_GAP');
  assert.equal(payload.checkStatusById.RESET_MEASUREMENT_NOT_BOUND.measured, false);
});

test('phase07 runtime measurements foundation: forced negative path is deterministic', () => {
  const result = runStateScript(['--force-negative']);
  assert.notEqual(result.status, 0, 'expected forced-negative mode to return non-zero');

  const payload = parseJsonOutput(result);
  assert.equal(payload.ok, false);
  assert.equal(payload.failReason, 'E_PHASE07_STARTUP_PROJECT_OPEN_SCENE_SWITCH_RESET_RUNTIME_MEASUREMENTS_FOUNDATION_FORCED_NEGATIVE');
  assert.equal(payload.overallStatus, 'HOLD');
  assert.equal(payload.phase07RuntimeMeasurementsFoundationStatus, 'HOLD');
  assert.equal(payload.phase07RuntimeMeasurementsReadinessStatus, 'HOLD');
  assert.equal(payload.openGapIds.includes('FORCED_NEGATIVE_PATH'), true);
});

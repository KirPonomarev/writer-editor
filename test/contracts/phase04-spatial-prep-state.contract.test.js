const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

const SCRIPT_PATH = 'scripts/ops/phase04-spatial-prep-state.mjs';
const EXPECTED_TARGET_IDS = [
  'BOUNDED_SPATIAL_SCOPE',
  'SPATIAL_COMMIT_POINTS',
  'SPATIAL_PERSISTENCE_BOUNDARIES',
  'SPATIAL_BLOCKING_ACTIVATION',
];
const EXPECTED_RUNTIME_GAP_IDS = [
  'SPATIAL_RUNTIME_NOT_EXECUTED',
  'LAYOUT_SNAPSHOT_RUNTIME_NOT_EXECUTED',
  'INVALID_LAYOUT_AND_MISSING_MONITOR_RECOVERY_NOT_EXECUTED',
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

test('phase04 spatial prep state: positive run passes while runtime readiness remains hold', () => {
  const result = runStateScript();
  assert.equal(result.status, 0, `expected state script pass:\n${result.stdout}\n${result.stderr}`);

  const payload = parseJsonOutput(result);
  assert.equal(payload.ok, true);
  assert.equal(payload.failReason, '');
  assert.equal(payload.overallStatus, 'PASS');
  assert.equal(payload.phase04ReadinessStatus, 'HOLD');
  assert.deepEqual(payload.openGapIds, []);
  assert.deepEqual(payload.lockedTargetIds, EXPECTED_TARGET_IDS);
  assert.deepEqual(payload.lockedRuntimeGapIds, EXPECTED_RUNTIME_GAP_IDS);
  assert.equal(payload.greenCheckIds.includes('PHASE03_BASELINE_DOCKED_SHELL_PASS'), true);
  assert.equal(payload.greenCheckIds.includes('COMMIT_POINTS_LOCKED'), true);
  assert.equal(payload.greenCheckIds.includes('INVALID_LAYOUT_BLOCKING_RULE_PRESENT'), true);
});

test('phase04 spatial prep state: forced negative path is deterministic', () => {
  const result = runStateScript(['--force-negative']);
  assert.notEqual(result.status, 0, 'expected forced-negative mode to return non-zero');

  const payload = parseJsonOutput(result);
  assert.equal(payload.ok, false);
  assert.equal(payload.failReason, 'E_PHASE04_SPATIAL_PREP_FORCED_NEGATIVE');
  assert.equal(payload.overallStatus, 'HOLD');
  assert.equal(payload.openGapIds.includes('FORCED_NEGATIVE_PATH'), true);
});

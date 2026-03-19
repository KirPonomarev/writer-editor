const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

const SCRIPT_PATH = 'scripts/ops/phase05-invalid-layout-and-missing-monitor-recovery-baseline-state.mjs';
const EXPECTED_TARGET_IDS = [
  'SPATIAL_VIEWPORT_ENVELOPE_METADATA',
  'INVALID_LAYOUT_AND_MISSING_MONITOR_RECOVERY',
  'CURRENT_TO_LAST_STABLE_RECOVERY_ORDER',
  'LAST_STABLE_VALID_FOR_CURRENT_ENVELOPE',
  'LAST_STABLE_INVALID_OR_MISSING_MONITOR_FALLS_BACK_TO_BASELINE',
  'PROJECT_SCOPED_SPATIAL_LAYOUT_SNAPSHOT',
  'EDITOR_ROOT_FIXED_DOCKED',
];
const EXPECTED_COMMIT_POINT_IDS = [
  'RESIZE_END',
  'SAFE_RESET',
  'RESTORE_LAST_STABLE',
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

test('phase05 invalid layout and missing monitor recovery baseline: positive run passes while readiness remains hold', () => {
  const result = runStateScript();
  assert.equal(result.status, 0, `expected state script pass:\n${result.stdout}\n${result.stderr}`);

  const payload = parseJsonOutput(result);
  assert.equal(payload.ok, true);
  assert.equal(payload.failReason, '');
  assert.equal(payload.overallStatus, 'PASS');
  assert.equal(payload.phase05ReadinessStatus, 'HOLD');
  assert.deepEqual(payload.openGapIds, []);
  assert.deepEqual(payload.lockedTargetIds, EXPECTED_TARGET_IDS);
  assert.deepEqual(payload.lockedCommitPointIds, EXPECTED_COMMIT_POINT_IDS);
  assert.equal(payload.greenCheckIds.includes('PHASE05_LAYOUT_RECOVERY_LAST_STABLE_PASS'), true);
  assert.equal(payload.greenCheckIds.includes('VIEWPORT_ENVELOPE_METADATA_PRESENT'), true);
  assert.equal(payload.greenCheckIds.includes('MISSING_MONITOR_DETECTION_PRESENT'), true);
  assert.equal(payload.greenCheckIds.includes('INVALID_LAYOUT_AND_MISSING_MONITOR_RECOVERY_EXPLICIT'), true);
  assert.equal(payload.greenCheckIds.includes('LAST_STABLE_FALLBACK_TO_BASELINE_EXPLICIT'), true);
  assert.equal(payload.greenCheckIds.includes('RECOVERY_ORDER_DETERMINISTIC'), true);
  assert.equal(payload.greenCheckIds.includes('EDITOR_ROOT_FIXED_DOCKED_STILL'), true);
  assert.equal(payload.greenCheckIds.includes('PROJECT_SCOPED_SPATIAL_LAYOUT_SNAPSHOT_STILL'), true);
});

test('phase05 invalid layout and missing monitor recovery baseline: forced negative path is deterministic', () => {
  const result = runStateScript(['--force-negative']);
  assert.notEqual(result.status, 0, 'expected forced-negative mode to return non-zero');

  const payload = parseJsonOutput(result);
  assert.equal(payload.ok, false);
  assert.equal(payload.failReason, 'E_PHASE05_INVALID_LAYOUT_AND_MISSING_MONITOR_RECOVERY_BASELINE_FORCED_NEGATIVE');
  assert.equal(payload.overallStatus, 'HOLD');
  assert.equal(payload.openGapIds.includes('FORCED_NEGATIVE_PATH'), true);
});

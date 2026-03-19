const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

const SCRIPT_PATH = 'scripts/ops/phase05-bounded-spatial-shell-state.mjs';
const EXPECTED_BOUND_SIGNAL_IDS = [
  'PHASE05_MOVABLE_SIDE_CONTAINERS_BASELINE_PASS',
  'PHASE05_LAYOUT_RECOVERY_LAST_STABLE_BASELINE_PASS',
  'PHASE05_INVALID_LAYOUT_AND_MISSING_MONITOR_RECOVERY_BASELINE_PASS',
];
const EXPECTED_LOCKED_TARGET_IDS = [
  'BOUNDED_SPATIAL_SHELL',
  'MOVABLE_SIDE_CONTAINERS',
  'SAFE_RESTORE_AND_LAYOUT_RECOVERY',
  'INVALID_LAYOUT_AND_MISSING_MONITOR_RECOVERY',
  'PROJECT_SCOPED_SPATIAL_LAYOUT_SNAPSHOTS',
  'EDITOR_ROOT_FIXED_DOCKED',
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

test('phase05 bounded spatial shell state: positive run passes when all three runtime contours and packet evidence align', () => {
  const result = runStateScript();
  assert.equal(result.status, 0, `expected state script pass:\n${result.stdout}\n${result.stderr}`);

  const payload = parseJsonOutput(result);
  assert.equal(payload.ok, true);
  assert.equal(payload.failReason, '');
  assert.equal(payload.overallStatus, 'PASS');
  assert.equal(payload.phase05ReadinessStatus, 'PASS');
  assert.deepEqual(payload.openGapIds, []);
  assert.deepEqual(payload.phase05PendingGapIds, []);
  assert.deepEqual(payload.boundSignalIds, EXPECTED_BOUND_SIGNAL_IDS);
  assert.deepEqual(payload.lockedTargetIds, EXPECTED_LOCKED_TARGET_IDS);
  assert.equal(payload.greenCheckIds.includes('PHASE05_MOVABLE_SIDE_CONTAINERS_BASELINE_PASS'), true);
  assert.equal(payload.greenCheckIds.includes('PHASE05_LAYOUT_RECOVERY_LAST_STABLE_BASELINE_PASS'), true);
  assert.equal(payload.greenCheckIds.includes('PHASE05_INVALID_LAYOUT_AND_MISSING_MONITOR_RECOVERY_BASELINE_PASS'), true);
  assert.equal(payload.greenCheckIds.includes('PACKET_PRESENT'), true);
  assert.equal(payload.greenCheckIds.includes('PACKET_PASS'), true);
  assert.equal(payload.greenCheckIds.includes('PACKET_READY'), true);
  assert.equal(payload.greenCheckIds.includes('SOURCE_CHAIN_MATCHES'), true);
  assert.equal(payload.greenCheckIds.includes('BOUND_SIGNAL_IDS_MATCH'), true);
  assert.equal(payload.greenCheckIds.includes('LOCKED_TARGET_IDS_MATCH'), true);
  assert.equal(payload.greenCheckIds.includes('PENDING_GAP_IDS_CLEARED'), true);
  assert.equal(payload.greenCheckIds.includes('PACKET_INTERNAL_CONSISTENCY'), true);
});

test('phase05 bounded spatial shell state: forced negative path is deterministic', () => {
  const result = runStateScript(['--force-negative']);
  assert.notEqual(result.status, 0, 'expected forced-negative mode to return non-zero');

  const payload = parseJsonOutput(result);
  assert.equal(payload.ok, false);
  assert.equal(payload.failReason, 'E_PHASE05_BOUNDED_SPATIAL_SHELL_FORCED_NEGATIVE');
  assert.equal(payload.overallStatus, 'HOLD');
  assert.equal(payload.phase05ReadinessStatus, 'HOLD');
  assert.equal(payload.openGapIds.includes('FORCED_NEGATIVE_PATH'), true);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

const SCRIPT_PATH = 'scripts/ops/phase05-layout-recovery-last-stable-baseline-state.mjs';
const EXPECTED_TARGET_IDS = [
  'CURRENT_SPATIAL_LAYOUT_SNAPSHOT',
  'LAST_STABLE_SPATIAL_LAYOUT_SNAPSHOT',
  'PROJECT_SCOPED_SPATIAL_LAYOUT_STORAGE',
  'RECOVERY_ORDER_CURRENT_LAST_STABLE_BASELINE',
  'SAFE_RESET_REBUILDS_BOTH_SNAPSHOTS',
  'RESTORE_LAST_STABLE_IGNORES_CURRENT_STORAGE',
  'INVALID_LAYOUT_FALLBACK_TO_BASELINE',
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

test('phase05 layout recovery last stable baseline: positive run passes while readiness remains hold', () => {
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
  assert.equal(payload.greenCheckIds.includes('PHASE05_BASELINE_PASS'), true);
  assert.equal(payload.greenCheckIds.includes('LAST_STABLE_STORAGE_KEY_PRESENT'), true);
  assert.equal(payload.greenCheckIds.includes('PROJECT_SCOPED_PERSISTENCE'), true);
  assert.equal(payload.greenCheckIds.includes('RECOVERY_ORDER_EXPLICIT'), true);
  assert.equal(payload.greenCheckIds.includes('SAFE_RESET_REBUILDS_BOTH_SNAPSHOTS'), true);
  assert.equal(payload.greenCheckIds.includes('RESTORE_LAST_STABLE_USES_LAST_STABLE_SNAPSHOT'), true);
  assert.equal(payload.greenCheckIds.includes('INVALID_LAYOUT_FALLS_BACK_TO_BASELINE'), true);
});

test('phase05 layout recovery last stable baseline: forced negative path is deterministic', () => {
  const result = runStateScript(['--force-negative']);
  assert.notEqual(result.status, 0, 'expected forced-negative mode to return non-zero');

  const payload = parseJsonOutput(result);
  assert.equal(payload.ok, false);
  assert.equal(payload.failReason, 'E_PHASE05_LAYOUT_RECOVERY_LAST_STABLE_BASELINE_FORCED_NEGATIVE');
  assert.equal(payload.overallStatus, 'HOLD');
  assert.equal(payload.openGapIds.includes('FORCED_NEGATIVE_PATH'), true);
});

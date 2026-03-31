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
const EXPECTED_PENDING_GAP_IDS = [
  'PHASE03_BASELINE_DOCKED_SHELL_PASS',
  'CANON_BOUNDED_SPATIAL_LAYER_PRESENT',
  'CONTEXT_BOUNDED_SPATIAL_LAYER_PRESENT',
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

test('phase04 spatial prep state: measured run preserves known hold without false green', () => {
  const result = runStateScript();
  assert.notEqual(result.status, 0, `expected spatial prep state hold:\n${result.stdout}\n${result.stderr}`);

  const payload = parseJsonOutput(result);
  assert.equal(payload.ok, false);
  assert.equal(payload.failReason, 'PHASE04_SPATIAL_PREP_PENDING_GAPS');
  assert.equal(payload.overallStatus, 'HOLD');
  assert.equal(payload.phase04ReadinessStatus, 'HOLD');
  assert.deepEqual(payload.phase04PendingGapIds, EXPECTED_PENDING_GAP_IDS);
  assert.deepEqual(payload.openGapIds, EXPECTED_PENDING_GAP_IDS);
  assert.deepEqual(payload.lockedTargetIds, EXPECTED_TARGET_IDS);
  assert.deepEqual(payload.lockedRuntimeGapIds, EXPECTED_RUNTIME_GAP_IDS);
  assert.equal(payload.greenCheckIds.includes('PENDING_GAP_IDS_MATCH'), true);
  assert.equal(payload.greenCheckIds.includes('BIBLE_BOUNDED_SPATIAL_SHELL_PRESENT'), true);
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

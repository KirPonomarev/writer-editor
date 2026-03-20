const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

const SCRIPT_PATH = 'scripts/ops/phase04-spatial-prep-state.mjs';
const EXPECTED_BOUND_SIGNAL_IDS = [
  'PHASE04_BOUNDED_SPATIAL_LAYER_PRESENT',
  'PHASE04_SAFE_SPATIAL_PREP_PASS',
];
const EXPECTED_LOCKED_TARGET_IDS = [
  'BOUNDED_SPATIAL_LAYER',
  'SAFE_SPATIAL_PREP',
  'CANON_BOUNDED_SPATIAL_LAYER_PRESENT',
  'CONTEXT_BOUNDED_SPATIAL_LAYER_PRESENT',
];
const EXPECTED_PENDING_GAP_IDS = [
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

test('phase04 spatial prep state: baseline run holds with known canonical and context gaps', () => {
  const result = runStateScript();
  assert.notEqual(result.status, 0, `expected spatial prep state to hold:\n${result.stdout}\n${result.stderr}`);

  const payload = parseJsonOutput(result);
  assert.equal(payload.ok, false);
  assert.equal(payload.failReason, 'PHASE04_SPATIAL_PREP_PENDING_GAPS');
  assert.equal(payload.overallStatus, 'HOLD');
  assert.equal(payload.phase04ReadinessStatus, 'HOLD');
  assert.equal(payload.PHASE04_SPATIAL_PREP_OK, 0);
  assert.deepEqual(payload.boundSignalIds, EXPECTED_BOUND_SIGNAL_IDS);
  assert.deepEqual(payload.lockedTargetIds, EXPECTED_LOCKED_TARGET_IDS);
  assert.deepEqual(payload.phase04PendingGapIds, EXPECTED_PENDING_GAP_IDS);
  assert.equal(payload.greenCheckIds.includes('PACKET_PRESENT'), true);
  assert.equal(payload.greenCheckIds.includes('PACKET_PASS'), true);
  assert.equal(payload.greenCheckIds.includes('PACKET_MATCHES'), true);
  assert.equal(payload.greenCheckIds.includes('BOUND_SIGNAL_IDS_MATCH'), true);
  assert.equal(payload.greenCheckIds.includes('LOCKED_TARGET_IDS_MATCH'), true);
  assert.equal(payload.greenCheckIds.includes('PENDING_GAP_IDS_MATCH'), true);
  assert.equal(payload.openGapIds.includes('CANON_BOUNDED_SPATIAL_LAYER_PRESENT'), true);
  assert.equal(payload.openGapIds.includes('CONTEXT_BOUNDED_SPATIAL_LAYER_PRESENT'), true);
});

test('phase04 spatial prep state: forced negative path is deterministic', () => {
  const result = runStateScript(['--force-negative']);
  assert.notEqual(result.status, 0, 'expected forced-negative mode to return non-zero');

  const payload = parseJsonOutput(result);
  assert.equal(payload.ok, false);
  assert.equal(payload.failReason, 'E_PHASE04_SPATIAL_PREP_FORCED_NEGATIVE');
  assert.equal(payload.overallStatus, 'HOLD');
  assert.equal(payload.phase04ReadinessStatus, 'HOLD');
  assert.equal(payload.openGapIds.includes('FORCED_NEGATIVE_PATH'), true);
});

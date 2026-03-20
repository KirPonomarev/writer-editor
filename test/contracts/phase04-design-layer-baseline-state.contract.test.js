const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

const SCRIPT_PATH = 'scripts/ops/phase04-design-layer-baseline-state.mjs';
const EXPECTED_BOUND_SIGNAL_IDS = [
  'PHASE04_BASELINE_SAFE_FOCUS_COMPACT_PASS',
  'PHASE04_VISIBLE_DESIGN_SWITCH_PASS',
  'PHASE04_BINDING_INDEX_SYNC_PASS',
];
const EXPECTED_LOCKED_TARGET_IDS = [
  'DESIGN_LAYER_BASELINE',
  'BASELINE_SAFE_FOCUS_COMPACT',
  'VISIBLE_DESIGN_SWITCH',
  'DOCUMENT_TRUTH_UNCHANGED',
  'RECOVERY_TRUTH_UNCHANGED',
  'COMMAND_SEMANTICS_UNCHANGED',
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

test('phase04 design layer baseline state: positive run passes with supersession, baseline focus, visible switch, and binding index sync', () => {
  const result = runStateScript();
  assert.equal(result.status, 0, `expected state script pass:\n${result.stdout}\n${result.stderr}`);

  const payload = parseJsonOutput(result);
  assert.equal(payload.ok, true);
  assert.equal(payload.failReason, '');
  assert.equal(payload.overallStatus, 'PASS');
  assert.equal(payload.phase04ReadinessStatus, 'PASS');
  assert.equal(payload.PHASE04_DESIGN_LAYER_BASELINE_OK, 1);
  assert.deepEqual(payload.openGapIds, []);
  assert.deepEqual(payload.phase04PendingGapIds, []);
  assert.deepEqual(payload.boundSignalIds, EXPECTED_BOUND_SIGNAL_IDS);
  assert.deepEqual(payload.lockedTargetIds, EXPECTED_LOCKED_TARGET_IDS);
  assert.equal(payload.greenCheckIds.includes('SUPERSESSION_PACKET_PRESENT'), true);
  assert.equal(payload.greenCheckIds.includes('SUPERSESSION_PACKET_PASS'), true);
  assert.equal(payload.greenCheckIds.includes('SUPERSESSION_PACKET_MATCHES'), true);
  assert.equal(payload.greenCheckIds.includes('DESIGN_PACKET_PRESENT'), true);
  assert.equal(payload.greenCheckIds.includes('DESIGN_PACKET_PASS'), true);
  assert.equal(payload.greenCheckIds.includes('DESIGN_PACKET_MATCHES'), true);
  assert.equal(payload.greenCheckIds.includes('BINDING_INDEX_PRESENT'), true);
  assert.equal(payload.greenCheckIds.includes('BINDING_INDEX_MATCHES'), true);
  assert.equal(payload.greenCheckIds.includes('BASELINE_SAFE_FOCUS_COMPACT_TRUE'), true);
  assert.equal(payload.greenCheckIds.includes('VISIBLE_DESIGN_SWITCH_TRUE'), true);
  assert.equal(payload.greenCheckIds.includes('DOCUMENT_TRUTH_UNCHANGED_TRUE'), true);
  assert.equal(payload.greenCheckIds.includes('RECOVERY_TRUTH_UNCHANGED_TRUE'), true);
  assert.equal(payload.greenCheckIds.includes('COMMAND_SEMANTICS_UNCHANGED_TRUE'), true);
});

test('phase04 design layer baseline state: forced negative path is deterministic', () => {
  const result = runStateScript(['--force-negative']);
  assert.notEqual(result.status, 0, 'expected forced-negative mode to return non-zero');

  const payload = parseJsonOutput(result);
  assert.equal(payload.ok, false);
  assert.equal(payload.failReason, 'E_PHASE04_DESIGN_LAYER_BASELINE_FORCED_NEGATIVE');
  assert.equal(payload.overallStatus, 'HOLD');
  assert.equal(payload.phase04ReadinessStatus, 'HOLD');
  assert.equal(payload.openGapIds.includes('FORCED_NEGATIVE_PATH'), true);
});

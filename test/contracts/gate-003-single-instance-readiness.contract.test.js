const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

const SCRIPT_PATH = 'scripts/ops/gate-003-single-instance-proofhook.mjs';

function runProofhook(args = []) {
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

test('gate 003 single instance readiness: positive path proves lock, quit path, and second-instance focus wiring', () => {
  const result = runProofhook();
  assert.equal(result.status, 0, `expected proofhook pass:\n${result.stdout}\n${result.stderr}`);

  const payload = parseJsonOutput(result);
  assert.equal(payload.ok, true);
  assert.equal(payload.failReason, '');
  assert.equal(payload.overallStatus, 'PASS');
  assert.equal(payload.gate003SingleInstanceStatus, 'PASS');
  assert.equal(payload.openGapIds.length, 0);
  assert.equal(payload.greenCheckIds.includes('LOCK_VARIABLE_DECLARED'), true);
  assert.equal(payload.greenCheckIds.includes('LOCK_FAILURE_TERMINAL_PATH'), true);
  assert.equal(payload.greenCheckIds.includes('SECOND_INSTANCE_HANDLER_REGISTERED'), true);
  assert.equal(payload.greenCheckIds.includes('FOCUS_HELPER_RESTORES_MINIMIZED_WINDOW'), true);
  assert.equal(payload.greenCheckIds.includes('FOCUS_HELPER_SHOWS_HIDDEN_WINDOW'), true);
  assert.equal(payload.greenCheckIds.includes('FOCUS_HELPER_FOCUSES_WINDOW'), true);
  assert.equal(payload.greenCheckIds.includes('WHEN_READY_GUARDED_BY_LOCK'), true);
});

test('gate 003 single instance readiness: forced negative path is deterministic', () => {
  const result = runProofhook(['--force-negative']);
  assert.notEqual(result.status, 0, 'expected forced-negative mode to return non-zero');

  const payload = parseJsonOutput(result);
  assert.equal(payload.ok, false);
  assert.equal(payload.failReason, 'E_GATE_003_SINGLE_INSTANCE_FORCED_NEGATIVE');
  assert.equal(payload.overallStatus, 'HOLD');
  assert.equal(payload.gate003SingleInstanceStatus, 'HOLD');
  assert.equal(payload.openGapIds.includes('FORCED_NEGATIVE_PATH'), true);
});

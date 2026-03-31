const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

const SCRIPT_PATH = 'scripts/ops/Y8_FORMAL_CUTOVER_PACKET_STATE.mjs';

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

test('y8 formal cutover packet: positive run binds cutover packet, rollback packet and factual doc sync', () => {
  const result = runStateScript();
  assert.equal(result.status, 0, `expected state script pass:\n${result.stdout}\n${result.stderr}`);

  const payload = parseJsonOutput(result);
  assert.equal(payload.ok, true);
  assert.equal(payload.failReason, '');
  assert.equal(payload.overallStatus, 'PASS');
  assert.equal(payload.y8FormalCutoverStatus, 'PASS');
  assert.equal(payload.y8ReadinessStatus, 'HOLD');
  assert.deepEqual(payload.openGapIds, []);
  assert.equal(payload.greenCheckIds.includes('Y7_RECORD_PASS_HOLD'), true);
  assert.equal(payload.greenCheckIds.includes('PHASE05_PASS'), true);
  assert.equal(payload.greenCheckIds.includes('PHASE06_PASS_EXPLICIT_SKIP'), true);
  assert.equal(payload.greenCheckIds.includes('PHASE07_RELEASE_READY_FOUNDATION_PASS_HOLD'), true);
  assert.equal(payload.greenCheckIds.includes('Y8_RECORD_PRESENT_AND_BOUND'), true);
  assert.equal(payload.greenCheckIds.includes('Y8_ROLLBACK_PACKET_PRESENT_AND_BOUND'), true);
  assert.equal(payload.greenCheckIds.includes('FACTUAL_DOCS_SYNCED'), true);
  assert.equal(payload.greenCheckIds.includes('NO_Y9_IMPLICATION'), true);
});

test('y8 formal cutover packet: forced negative path is deterministic', () => {
  const result = runStateScript(['--force-negative']);
  assert.notEqual(result.status, 0, 'expected forced-negative mode to return non-zero');

  const payload = parseJsonOutput(result);
  assert.equal(payload.ok, false);
  assert.equal(payload.failReason, 'E_Y8_FORMAL_CUTOVER_PACKET_FORCED_NEGATIVE');
  assert.equal(payload.overallStatus, 'HOLD');
  assert.equal(payload.y8FormalCutoverStatus, 'HOLD');
  assert.equal(payload.y8ReadinessStatus, 'HOLD');
  assert.equal(payload.openGapIds.includes('FORCED_NEGATIVE_PATH'), true);
});

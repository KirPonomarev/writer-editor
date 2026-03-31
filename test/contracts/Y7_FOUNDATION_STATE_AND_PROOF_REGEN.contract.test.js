const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

const SCRIPT_PATH = 'scripts/ops/Y7_FOUNDATION_STATE_AND_PROOF_REGEN_STATE.mjs';

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

test('y7 foundation and proof regen: positive run preserves honest pass and hold surfaces', () => {
  const result = runStateScript();
  assert.equal(result.status, 0, `expected state script pass:\n${result.stdout}\n${result.stderr}`);

  const payload = parseJsonOutput(result);
  assert.equal(payload.ok, true);
  assert.equal(payload.failReason, '');
  assert.equal(payload.overallStatus, 'PASS');
  assert.equal(payload.y7FoundationRegenStatus, 'PASS');
  assert.equal(payload.y7ReadinessStatus, 'HOLD');

  assert.equal(payload.greenCheckIds.includes('FOUNDATION_STATE_SCRIPTS_PASS'), true);
  assert.equal(payload.greenCheckIds.includes('PHASE03_PASS_HOLD_PROFILE_HONEST'), true);
  assert.equal(payload.greenCheckIds.includes('PHASE07_HOLD_PROFILE_HONEST'), true);
  assert.equal(payload.greenCheckIds.includes('STATE_PENDING_GAP_IDS_MATCH'), true);
  assert.equal(payload.greenCheckIds.includes('PACKET_STATUS_ALIGNED_WITH_STATE'), true);
  assert.equal(payload.greenCheckIds.includes('PACKET_PENDING_GAP_IDS_MATCH'), true);
  assert.equal(payload.greenCheckIds.includes('NO_FALSE_GREEN_PROMOTION'), true);
  assert.deepEqual(payload.openGapIds, []);
});

test('y7 foundation and proof regen: forced negative path is deterministic', () => {
  const result = runStateScript(['--force-negative']);
  assert.notEqual(result.status, 0, 'expected forced-negative mode to return non-zero');

  const payload = parseJsonOutput(result);
  assert.equal(payload.ok, false);
  assert.equal(payload.failReason, 'E_Y7_FOUNDATION_STATE_AND_PROOF_REGEN_FORCED_NEGATIVE');
  assert.equal(payload.overallStatus, 'HOLD');
  assert.equal(payload.y7FoundationRegenStatus, 'HOLD');
  assert.equal(payload.y7ReadinessStatus, 'HOLD');
  assert.equal(payload.openGapIds.includes('FORCED_NEGATIVE_PATH'), true);
});

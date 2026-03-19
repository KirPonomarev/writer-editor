const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

const SCRIPT_PATH = 'scripts/ops/phase01-execute-readiness-state.mjs';

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

test('phase01 execute readiness state: positive run passes after one-pass refresh application', () => {
  const result = runStateScript();
  assert.equal(result.status, 0, `expected state script pass:\n${result.stdout}\n${result.stderr}`);

  const payload = parseJsonOutput(result);
  assert.equal(payload.ok, true);
  assert.equal(payload.failReason, '');
  assert.equal(payload.overallStatus, 'PASS');
  assert.equal(payload.executeReadinessStatus, 'PASS');
  assert.deepEqual(payload.openGapIds, []);
  assert.deepEqual(payload.staleDocBasenames, []);
  assert.equal(payload.greenCheckIds.includes('STALE_MARKERS_CLEARED'), true);
  assert.equal(payload.greenCheckIds.includes('ONE_PASS_ACTIONS_COMPLETE'), true);
  assert.equal(payload.greenCheckIds.includes('ACTIVE_CANON_WRITER_TRACK_PRESENT'), true);
});

test('phase01 execute readiness state: forced negative path is deterministic', () => {
  const result = runStateScript(['--force-negative']);
  assert.notEqual(result.status, 0, 'expected forced-negative mode to return non-zero');

  const payload = parseJsonOutput(result);
  assert.equal(payload.ok, false);
  assert.equal(payload.failReason, 'E_PHASE01_EXECUTE_READINESS_FORCED_NEGATIVE');
  assert.equal(payload.overallStatus, 'HOLD');
  assert.equal(payload.openGapIds.includes('FORCED_NEGATIVE_PATH'), true);
});

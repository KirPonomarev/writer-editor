const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

const SCRIPT_PATH = 'scripts/ops/phase03-user-shell-state-foundation-state.mjs';

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

test('phase03 user shell state foundation: positive run passes with remaining phase03 gaps still honest', () => {
  const result = runStateScript();
  assert.equal(result.status, 0, `expected state script pass:\n${result.stdout}\n${result.stderr}`);

  const payload = parseJsonOutput(result);
  assert.equal(payload.ok, true);
  assert.equal(payload.failReason, '');
  assert.equal(payload.overallStatus, 'PASS');
  assert.equal(payload.foundationStatus, 'PASS');
  assert.equal(payload.phase03ReadinessStatus, 'HOLD');
  assert.deepEqual(payload.openGapIds, []);
  assert.deepEqual(payload.remainingPhase03GapIds, []);
  assert.equal(payload.greenCheckIds.includes('PHASE03_PREP_PASS'), true);
  assert.equal(payload.greenCheckIds.includes('THEME_PERSISTED'), true);
  assert.equal(payload.greenCheckIds.includes('FONT_SIZE_PERSISTED_MAIN_SETTINGS'), true);
});

test('phase03 user shell state foundation: forced negative path is deterministic', () => {
  const result = runStateScript(['--force-negative']);
  assert.notEqual(result.status, 0, 'expected forced-negative mode to return non-zero');

  const payload = parseJsonOutput(result);
  assert.equal(payload.ok, false);
  assert.equal(payload.failReason, 'E_PHASE03_USER_SHELL_STATE_FOUNDATION_FORCED_NEGATIVE');
  assert.equal(payload.overallStatus, 'HOLD');
  assert.equal(payload.openGapIds.includes('FORCED_NEGATIVE_PATH'), true);
});

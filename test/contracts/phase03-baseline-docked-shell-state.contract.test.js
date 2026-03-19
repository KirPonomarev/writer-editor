const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

const SCRIPT_PATH = 'scripts/ops/phase03-baseline-docked-shell-state.mjs';

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

test('phase03 baseline docked shell state: positive run stays hold while blocked artifact passes remain open', () => {
  const result = runStateScript();
  assert.notEqual(result.status, 0, `expected state script hold:\n${result.stdout}\n${result.stderr}`);

  const payload = parseJsonOutput(result);
  assert.equal(payload.ok, false);
  assert.equal(payload.failReason, '');
  assert.equal(payload.overallStatus, 'HOLD');
  assert.equal(payload.phase03ReadinessStatus, 'PASS');
  assert.deepEqual(payload.openGapIds, [
    'USER_SHELL_STATE_FOUNDATION_PASS',
    'PROJECT_WORKSPACE_STATE_ARTIFACT_PASS',
    'SAFE_RESET_LAST_STABLE_ARTIFACT_PASS',
    'STABLE_PROJECT_ID_STORAGE_CONTRACT_PASS',
    'TERMINOLOGY_MIGRATION_ARTIFACT_PASS',
  ]);
  assert.deepEqual(payload.phase03PendingGapIds, []);
  assert.equal(payload.greenCheckIds.includes('PHASE03_PREP_PASS'), true);
  assert.equal(payload.greenCheckIds.includes('PACKET_PRESENT'), true);
  assert.equal(payload.greenCheckIds.includes('PACKET_PASS'), true);
  assert.equal(payload.greenCheckIds.includes('PACKET_READY'), true);
});

test('phase03 baseline docked shell state: forced negative path is deterministic', () => {
  const result = runStateScript(['--force-negative']);
  assert.notEqual(result.status, 0, 'expected forced-negative mode to return non-zero');

  const payload = parseJsonOutput(result);
  assert.equal(payload.ok, false);
  assert.equal(payload.failReason, 'E_PHASE03_BASELINE_DOCKED_SHELL_FORCED_NEGATIVE');
  assert.equal(payload.overallStatus, 'HOLD');
  assert.equal(payload.openGapIds.includes('FORCED_NEGATIVE_PATH'), true);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

const SCRIPT_PATH = 'scripts/ops/phase03-stable-project-id-storage-contract-state.mjs';

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

test('phase03 stable project id storage contract: positive run passes and closes the contract gap', () => {
  const result = runStateScript();
  assert.equal(result.status, 0, `expected state script pass:\n${result.stdout}\n${result.stderr}`);

  const payload = parseJsonOutput(result);
  assert.equal(payload.ok, true);
  assert.equal(payload.failReason, '');
  assert.equal(payload.overallStatus, 'PASS');
  assert.equal(payload.contractStatus, 'PASS');
  assert.equal(payload.phase03ReadinessStatus, 'HOLD');
  assert.deepEqual(payload.openGapIds, []);
  assert.deepEqual(payload.pendingContractGapIds, []);
  assert.equal(payload.greenCheckIds.includes('CORE_PROJECT_ID_RUNTIME_PRESENT'), true);
  assert.equal(payload.greenCheckIds.includes('PROJECT_MANIFEST_BINDING_PRESENT'), true);
  assert.equal(payload.greenCheckIds.includes('SETTINGS_PROJECT_ID_PRESENT'), true);
  assert.equal(payload.greenCheckIds.includes('PROJECT_ID_RESUME_BINDING_PRESENT'), true);
  assert.equal(payload.greenCheckIds.includes('PATH_BOUND_RECENT_RESUME_REMOVED'), true);
  assert.equal(payload.greenCheckIds.includes('CLONE_IMPORT_POLICY_PRESENT'), true);
});

test('phase03 stable project id storage contract: forced negative path is deterministic', () => {
  const result = runStateScript(['--force-negative']);
  assert.notEqual(result.status, 0, 'expected forced-negative mode to return non-zero');

  const payload = parseJsonOutput(result);
  assert.equal(payload.ok, false);
  assert.equal(payload.failReason, 'E_PHASE03_STABLE_PROJECT_ID_STORAGE_CONTRACT_FORCED_NEGATIVE');
  assert.equal(payload.overallStatus, 'HOLD');
  assert.equal(payload.openGapIds.includes('FORCED_NEGATIVE_PATH'), true);
});

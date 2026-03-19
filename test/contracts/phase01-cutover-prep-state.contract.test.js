const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

const SCRIPT_PATH = 'scripts/ops/phase01-cutover-prep-state.mjs';
const REQUIRED_REFRESH_SCOPE = [
  'CANON.md',
  'BIBLE.md',
  'CONTEXT.md',
  'PROCESS.md',
  'HANDOFF.md',
  'README.md',
  'CANON_STATUS.json',
  'XPLAT_UNIFIED_MASTER_EXECUTION_CONTRACT_v3.13a-final.md',
  'BINDING_INDEX_v0.md',
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

test('phase01 cutover prep state: positive run passes while execute remains hold', () => {
  const result = runStateScript();
  assert.equal(result.status, 0, `expected state script pass:\n${result.stdout}\n${result.stderr}`);

  const payload = parseJsonOutput(result);
  assert.equal(payload.ok, true);
  assert.equal(payload.failReason, '');
  assert.equal(payload.overallStatus, 'PASS');
  assert.equal(payload.executeReadinessStatus, 'HOLD');
  assert.deepEqual(payload.openGapIds, []);
  assert.deepEqual(payload.lockedRefreshScopeBasenames, REQUIRED_REFRESH_SCOPE);
  assert.equal(payload.lockedExecuteGapIds.includes('ONE_PASS_REFRESH_NOT_EXECUTED'), true);
});

test('phase01 cutover prep state: forced negative path is deterministic', () => {
  const result = runStateScript(['--force-negative']);
  assert.notEqual(result.status, 0, 'expected forced-negative mode to return non-zero');

  const payload = parseJsonOutput(result);
  assert.equal(payload.ok, false);
  assert.equal(payload.failReason, 'E_PHASE01_CUTOVER_PREP_FORCED_NEGATIVE');
  assert.equal(payload.overallStatus, 'HOLD');
  assert.equal(payload.openGapIds.includes('FORCED_NEGATIVE_PATH'), true);
});

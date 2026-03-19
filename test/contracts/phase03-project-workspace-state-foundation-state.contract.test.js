const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

const SCRIPT_PATH = 'scripts/ops/phase03-project-workspace-state-foundation-state.mjs';

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

test('phase03 project workspace state foundation: positive run passes while foundation status remains hold', () => {
  const result = runStateScript();
  assert.equal(result.status, 0, `expected state script pass:\n${result.stdout}\n${result.stderr}`);

  const payload = parseJsonOutput(result);
  assert.equal(payload.ok, true);
  assert.equal(payload.failReason, '');
  assert.equal(payload.overallStatus, 'PASS');
  assert.equal(payload.foundationStatus, 'HOLD');
  assert.equal(payload.phase03ReadinessStatus, 'HOLD');
  assert.deepEqual(payload.openGapIds, []);
  assert.deepEqual(payload.pendingFoundationGapIds, [
    'PROJECT_WORKSPACE_STATE_ARTIFACT_NOT_BOUND',
  ]);
  assert.equal(payload.greenCheckIds.includes('ACTIVE_DOCUMENT_TITLE_PERSISTED'), true);
  assert.equal(payload.greenCheckIds.includes('TREE_EXPANSION_PERSISTED'), true);
  assert.equal(payload.greenCheckIds.includes('FOUNDATION_HOLD_OR_ARTIFACT_SUPERSEDED'), true);
});

test('phase03 project workspace state foundation: forced negative path is deterministic', () => {
  const result = runStateScript(['--force-negative']);
  assert.notEqual(result.status, 0, 'expected forced-negative mode to return non-zero');

  const payload = parseJsonOutput(result);
  assert.equal(payload.ok, false);
  assert.equal(payload.failReason, 'E_PHASE03_PROJECT_WORKSPACE_STATE_FOUNDATION_FORCED_NEGATIVE');
  assert.equal(payload.overallStatus, 'HOLD');
  assert.equal(payload.openGapIds.includes('FORCED_NEGATIVE_PATH'), true);
});

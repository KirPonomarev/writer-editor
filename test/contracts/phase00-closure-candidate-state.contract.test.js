const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

const SCRIPT_PATH = 'scripts/ops/phase00-closure-candidate-state.mjs';

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

test('phase00 closure candidate state: positive run reports pass when all closure artifacts and evidence are bound', () => {
  const result = runStateScript();
  assert.equal(result.status, 0, `expected state script pass:\n${result.stdout}\n${result.stderr}`);

  const payload = parseJsonOutput(result);
  assert.equal(payload.ok, true);
  assert.equal(payload.failReason, '');
  assert.equal(payload.overallStatus, 'PASS');
  assert.equal(payload.closurePacketPresentOrNot, 'PRESENT');
  assert.equal(payload.noInputLossStatus, 'PASS');
  assert.equal(payload.primaryPathStatus, 'PASS');
  assert.equal(payload.imeStatus, 'PASS');
  assert.equal(payload.dualTruthStatus, 'SINGLE_TRUTH');
  assert.equal(payload.docxClosureEvidenceStatus, 'PRESENT');
  assert.deepEqual(payload.openGapIds, []);
  assert.deepEqual(payload.missingArtifactIds, []);
});

test('phase00 closure candidate state: forced negative path is deterministic', () => {
  const result = runStateScript(['--force-negative']);
  assert.notEqual(result.status, 0, 'expected forced-negative mode to return non-zero');

  const payload = parseJsonOutput(result);
  assert.equal(payload.ok, false);
  assert.equal(payload.failReason, 'E_PHASE00_CLOSURE_CANDIDATE_FORCED_NEGATIVE');
  assert.equal(payload.overallStatus, 'HOLD');
  assert.equal(payload.openGapIds.includes('FORCED_NEGATIVE_PATH'), true);
  assert.equal(payload.missingArtifactIds.includes('FORCED_NEGATIVE_PATH'), true);
});

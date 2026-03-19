const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

const SCRIPT_PATH = 'scripts/ops/phase00-tiptap-persistence-smoke.mjs';
const EXPECTED_SEAMS = [
  'save-reopen-text-roundtrip',
  'save-reopen-observable-payload-roundtrip',
  'recovery-restore-payload-roundtrip',
];

function runProofhook(args = []) {
  return spawnSync(process.execPath, [SCRIPT_PATH, '--json', ...args], {
    encoding: 'utf8',
  });
}

function parseJsonOutput(result) {
  let parsed = null;
  assert.doesNotThrow(() => {
    parsed = JSON.parse(String(result.stdout || '{}'));
  }, `invalid JSON output:\n${result.stdout}\n${result.stderr}`);
  return parsed;
}

test('phase00 tiptap persistence proofhook: positive path is green', () => {
  const result = runProofhook();
  assert.equal(result.status, 0, `expected positive proofhook pass:\n${result.stdout}\n${result.stderr}`);

  const payload = parseJsonOutput(result);
  assert.equal(payload.ok, true);
  assert.equal(payload.failReason, '');
  assert.deepEqual(payload.coveredSeams, EXPECTED_SEAMS);
  for (const seamId of EXPECTED_SEAMS) {
    assert.equal(payload.seamResults[seamId], true);
  }
});

test('phase00 tiptap persistence proofhook: forced negative path is deterministic', () => {
  const result = runProofhook(['--force-negative']);
  assert.notEqual(result.status, 0, 'expected forced-negative mode to return non-zero');

  const payload = parseJsonOutput(result);
  assert.equal(payload.ok, false);
  assert.equal(payload.failReason, 'E_TIPTAP_PERSISTENCE_PROOFHOOK_FORCED_NEGATIVE');
  assert.deepEqual(payload.coveredSeams, EXPECTED_SEAMS);
});

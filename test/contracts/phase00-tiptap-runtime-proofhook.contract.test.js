const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

const SCRIPT_PATH = 'scripts/ops/tiptap3-prep-smoke.mjs';

function runProofhook(args = [], env = {}) {
  return spawnSync(process.execPath, [SCRIPT_PATH, '--json', ...args], {
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
}

function parseJsonOutput(result) {
  let parsed = null;
  assert.doesNotThrow(() => {
    parsed = JSON.parse(String(result.stdout || '{}'));
  }, `invalid JSON output:\n${result.stdout}\n${result.stderr}`);
  return parsed;
}

test('phase00 tiptap runtime proofhook: positive path is green and reports covered seams', () => {
  const result = runProofhook();
  assert.equal(result.status, 0, `expected positive proofhook pass:\n${result.stdout}\n${result.stderr}`);

  const payload = parseJsonOutput(result);
  assert.equal(payload.ok, true);
  assert.equal(payload.failReason, '');
  assert.equal(Array.isArray(payload.coveredSeams), true);

  const expectedSeams = [
    'text-request-determinism',
    'set-text-determinism',
    'undo-bridge-determinism',
    'redo-bridge-determinism',
    'recovery-restored-normalization-determinism',
  ];
  assert.deepEqual(payload.coveredSeams, expectedSeams);
  for (const seamId of expectedSeams) {
    assert.equal(payload.seamResults[seamId], true);
  }
});

test('phase00 tiptap runtime proofhook: forced negative returns deterministic failReason', () => {
  const result = runProofhook(['--force-negative']);
  assert.notEqual(result.status, 0, 'expected forced-negative mode to return non-zero');

  const payload = parseJsonOutput(result);
  assert.equal(payload.ok, false);
  assert.equal(payload.failReason, 'E_TIPTAP_RUNTIME_PROOFHOOK_FORCED_NEGATIVE');
  assert.equal(Array.isArray(payload.coveredSeams), true);

  const expectedSeams = [
    'text-request-determinism',
    'set-text-determinism',
    'undo-bridge-determinism',
    'redo-bridge-determinism',
    'recovery-restored-normalization-determinism',
  ];
  assert.deepEqual(payload.coveredSeams, expectedSeams);
});

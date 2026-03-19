const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

const SCRIPT_PATH = 'scripts/ops/phase00-tiptap-no-input-loss-core-smoke.mjs';
const EXPECTED_CASE_IDS = [
  'basic-typing-exact-text',
  'paste-plain-text-exact-text',
  'selection-targeted-edit-no-bleed',
  'replace-over-selection-exact-result',
  'undo-restores-pre-edit-oracle',
  'redo-restores-post-edit-oracle',
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

test('phase00 tiptap no-input-loss core proofhook: positive path is green', () => {
  const result = runProofhook();
  assert.equal(result.status, 0, `expected positive proofhook pass:\n${result.stdout}\n${result.stderr}`);

  const payload = parseJsonOutput(result);
  assert.equal(payload.ok, true);
  assert.equal(payload.failReason, '');
  assert.equal(payload.pathUnderTest, 'TIPTAP_PRIMARY_PATH_MODEL_LAYER');
  assert.deepEqual(payload.coveredCaseIds, EXPECTED_CASE_IDS);

  for (const caseId of EXPECTED_CASE_IDS) {
    assert.equal(payload.caseResults[caseId], true);
  }
});

test('phase00 tiptap no-input-loss core proofhook: forced negative path is deterministic', () => {
  const result = runProofhook(['--force-negative']);
  assert.notEqual(result.status, 0, 'expected forced-negative mode to return non-zero');

  const payload = parseJsonOutput(result);
  assert.equal(payload.ok, false);
  assert.equal(payload.failReason, 'E_TIPTAP_NO_INPUT_LOSS_CORE_FORCED_NEGATIVE');
  assert.equal(payload.pathUnderTest, 'TIPTAP_PRIMARY_PATH_MODEL_LAYER');
  assert.deepEqual(payload.coveredCaseIds, EXPECTED_CASE_IDS);
});

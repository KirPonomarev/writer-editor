const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

const SCRIPT_PATH = 'scripts/ops/phase00-no-input-loss-rollup.mjs';
const REQUIRED_CASE_IDS = [
  'NIL_BASIC_TYPING',
  'NIL_PASTE_PLAIN_TEXT',
  'NIL_IME_COMPOSITION',
  'NIL_SELECTION',
  'NIL_REPLACE',
  'NIL_UNDO',
  'NIL_REDO',
  'NIL_SAVE',
  'NIL_REOPEN',
  'NIL_RECOVERY_RESTORE',
];
const EVIDENCE_SOURCES = [
  'phase00-tiptap-no-input-loss-core-smoke.mjs',
  'phase00-tiptap-persistence-smoke.mjs',
  'PHASE00_IME_REAL_EVIDENCE_V1.json',
];

function runRollup(args = []) {
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

test('phase00 no-input-loss rollup: positive path maps all 10 case ids and reports pass when ime evidence is bound', () => {
  const result = runRollup();
  assert.equal(result.status, 0, `expected positive rollup run to be successful:\n${result.stdout}\n${result.stderr}`);

  const payload = parseJsonOutput(result);
  assert.equal(payload.ok, true);
  assert.equal(payload.failReason, '');
  assert.equal(payload.overallStatus, 'PASS');
  assert.deepEqual(payload.requiredCaseIds, REQUIRED_CASE_IDS);
  assert.deepEqual(payload.evidenceSources, EVIDENCE_SOURCES);

  const mappedCaseIds = Object.keys(payload.caseStatusById || {});
  assert.deepEqual(mappedCaseIds, REQUIRED_CASE_IDS);
  assert.deepEqual(payload.openGapIds, []);
  assert.equal(payload.caseStatusById.NIL_IME_COMPOSITION.status, 'GREEN');
  assert.equal(payload.caseStatusById.NIL_IME_COMPOSITION.measured, true);

  const expectedGreen = [
    'NIL_BASIC_TYPING',
    'NIL_PASTE_PLAIN_TEXT',
    'NIL_IME_COMPOSITION',
    'NIL_SELECTION',
    'NIL_REPLACE',
    'NIL_UNDO',
    'NIL_REDO',
    'NIL_SAVE',
    'NIL_REOPEN',
    'NIL_RECOVERY_RESTORE',
  ];
  assert.deepEqual(payload.greenCaseIds, expectedGreen);
});

test('phase00 no-input-loss rollup: forced negative path is deterministic', () => {
  const result = runRollup(['--force-negative']);
  assert.notEqual(result.status, 0, 'expected forced-negative mode to return non-zero');

  const payload = parseJsonOutput(result);
  assert.equal(payload.ok, false);
  assert.equal(payload.failReason, 'E_NO_INPUT_LOSS_ROLLUP_FORCED_NEGATIVE');
  assert.equal(payload.overallStatus, 'HOLD');
  assert.deepEqual(payload.requiredCaseIds, REQUIRED_CASE_IDS);
  assert.deepEqual(payload.evidenceSources, EVIDENCE_SOURCES);
});

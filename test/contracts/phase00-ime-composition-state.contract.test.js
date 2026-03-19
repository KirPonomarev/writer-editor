const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

const SCRIPT_PATH = 'scripts/ops/phase00-ime-composition-state.mjs';
const REQUIRED_SIGNAL_IDS = [
  'NIL_IME_COMPOSITION_CURRENT_ROLLUP_STATUS',
  'TIPTAP_PRIMARY_PATH_COMPOSITION_HANDLER_PRESENT_OR_NOT',
  'REAL_MACHINE_IME_EVIDENCE_PRESENT_OR_NOT',
  'LEGACY_ONLY_INPUT_HOOKS_PRESENT_OR_NOT',
  'AUTOMATION_FRONTIER_STATUS',
  'OVERALL_STATUS',
  'OPEN_GAP_IDS',
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

test('phase00 ime composition state: positive run is pass when primary-path ime evidence is bound', () => {
  const result = runStateScript();
  assert.equal(result.status, 0, `expected state script pass:\n${result.stdout}\n${result.stderr}`);

  const payload = parseJsonOutput(result);
  assert.equal(payload.ok, true);
  assert.equal(payload.failReason, '');
  assert.equal(payload.overallStatus, 'PASS');
  assert.equal(payload.automationFrontierStatus, 'AUTOMATION_PATH_HAS_REAL_PRIMARY_PATH_IME_EVIDENCE');
  assert.deepEqual(payload.requiredSignalIds, REQUIRED_SIGNAL_IDS);

  assert.equal(payload.signalStatusById.NIL_IME_COMPOSITION_CURRENT_ROLLUP_STATUS.status, 'GREEN');
  assert.equal(payload.signalStatusById.TIPTAP_PRIMARY_PATH_COMPOSITION_HANDLER_PRESENT_OR_NOT.status, 'GREEN');
  assert.equal(payload.signalStatusById.REAL_MACHINE_IME_EVIDENCE_PRESENT_OR_NOT.status, 'GREEN');
  assert.equal(payload.signalStatusById.LEGACY_ONLY_INPUT_HOOKS_PRESENT_OR_NOT.status, 'GREEN');
  assert.equal(payload.signalStatusById.AUTOMATION_FRONTIER_STATUS.status, 'GREEN');

  assert.deepEqual(payload.openGapIds, []);
});

test('phase00 ime composition state: forced negative path is deterministic', () => {
  const result = runStateScript(['--force-negative']);
  assert.notEqual(result.status, 0, 'expected forced-negative mode to return non-zero');

  const payload = parseJsonOutput(result);
  assert.equal(payload.ok, false);
  assert.equal(payload.failReason, 'E_PHASE00_IME_COMPOSITION_STATE_FORCED_NEGATIVE');
  assert.equal(payload.overallStatus, 'HOLD');
  assert.equal(payload.automationFrontierStatus, 'AUTOMATION_PATH_HAS_REAL_PRIMARY_PATH_IME_EVIDENCE');
  assert.deepEqual(payload.requiredSignalIds, REQUIRED_SIGNAL_IDS);
  assert.equal(payload.openGapIds.includes('FORCED_NEGATIVE_PATH'), true);
});

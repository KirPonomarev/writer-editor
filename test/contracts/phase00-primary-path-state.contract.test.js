const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

const SCRIPT_PATH = 'scripts/ops/phase00-primary-path-state.mjs';
const REQUIRED_SIGNAL_IDS = [
  'OPEN_SCENE_TEXT_HYDRATION_ON_TIPTAP_PATH',
  'REQUEST_TEXT_SET_TEXT_PATH_PRESENT_FOR_TIPTAP',
  'RUNTIME_COMMAND_BRIDGE_PRESENT_FOR_TIPTAP',
  'RECOVERY_RESTORED_HOOK_PRESENT_FOR_TIPTAP',
  'USE_TIPTAP_GATING_STILL_PRESENT_OR_NOT',
  'LEGACY_EDITOR_PATH_STILL_PRIMARY_OR_NOT',
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

test('phase00 primary path state: positive run reports pass when tiptap is primary and dual truth is removed', () => {
  const result = runStateScript();
  assert.equal(result.status, 0, `expected state script pass:\n${result.stdout}\n${result.stderr}`);

  const payload = parseJsonOutput(result);
  assert.equal(payload.ok, true);
  assert.equal(payload.failReason, '');
  assert.equal(payload.overallStatus, 'PASS');
  assert.equal(payload.dualTruthStatus, 'SINGLE_TRUTH');
  assert.deepEqual(payload.requiredSignalIds, REQUIRED_SIGNAL_IDS);

  const signalIds = Object.keys(payload.signalStatusById || {});
  assert.equal(signalIds.includes('OPEN_SCENE_TEXT_HYDRATION_ON_TIPTAP_PATH'), true);
  assert.equal(signalIds.includes('REQUEST_TEXT_SET_TEXT_PATH_PRESENT_FOR_TIPTAP'), true);
  assert.equal(signalIds.includes('RUNTIME_COMMAND_BRIDGE_PRESENT_FOR_TIPTAP'), true);
  assert.equal(signalIds.includes('RECOVERY_RESTORED_HOOK_PRESENT_FOR_TIPTAP'), true);
  assert.equal(signalIds.includes('USE_TIPTAP_GATING_STILL_PRESENT_OR_NOT'), true);
  assert.equal(signalIds.includes('LEGACY_EDITOR_PATH_STILL_PRIMARY_OR_NOT'), true);

  assert.equal(payload.signalStatusById.OPEN_SCENE_TEXT_HYDRATION_ON_TIPTAP_PATH.status, 'GREEN');
  assert.equal(payload.signalStatusById.REQUEST_TEXT_SET_TEXT_PATH_PRESENT_FOR_TIPTAP.status, 'GREEN');
  assert.equal(payload.signalStatusById.RUNTIME_COMMAND_BRIDGE_PRESENT_FOR_TIPTAP.status, 'GREEN');
  assert.equal(payload.signalStatusById.RECOVERY_RESTORED_HOOK_PRESENT_FOR_TIPTAP.status, 'GREEN');
  assert.equal(payload.signalStatusById.USE_TIPTAP_GATING_STILL_PRESENT_OR_NOT.status, 'GREEN');
  assert.equal(payload.signalStatusById.LEGACY_EDITOR_PATH_STILL_PRIMARY_OR_NOT.status, 'GREEN');

  assert.deepEqual(payload.openGapIds, []);
});

test('phase00 primary path state: forced negative path is deterministic', () => {
  const result = runStateScript(['--force-negative']);
  assert.notEqual(result.status, 0, 'expected forced-negative mode to return non-zero');

  const payload = parseJsonOutput(result);
  assert.equal(payload.ok, false);
  assert.equal(payload.failReason, 'E_PHASE00_PRIMARY_PATH_STATE_FORCED_NEGATIVE');
  assert.equal(payload.overallStatus, 'HOLD');
  assert.equal(payload.dualTruthStatus, 'SINGLE_TRUTH');
  assert.deepEqual(payload.requiredSignalIds, REQUIRED_SIGNAL_IDS);
  assert.equal(payload.openGapIds.includes('FORCED_NEGATIVE_PATH'), true);
});

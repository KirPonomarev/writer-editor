const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

const SCRIPT_PATH = 'scripts/ops/phase00-runtime-command-delta-state.mjs';

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

test('phase00 runtime command delta state: positive run reports pass when tiptap command coverage is complete', () => {
  const result = runStateScript();
  assert.equal(result.status, 0, `expected state script pass:\n${result.stdout}\n${result.stderr}`);

  const payload = parseJsonOutput(result);
  assert.equal(payload.ok, true);
  assert.equal(payload.failReason, '');
  assert.equal(payload.overallStatus, 'PASS');

  const expectedLegacyIds = [
    'format-align-left',
    'insert-add-card',
    'open-diagnostics',
    'open-export-preview',
    'open-recovery',
    'open-settings',
    'restore-last-stable-shell',
    'safe-reset-shell',
    'switch-mode-plan',
    'switch-mode-review',
    'switch-mode-write',
  ];
  const expectedTiptapIds = [
    'edit-redo',
    'edit-undo',
    'format-align-left',
    'insert-add-card',
    'open-diagnostics',
    'open-export-preview',
    'open-recovery',
    'open-settings',
    'redo',
    'restore-last-stable-shell',
    'safe-reset-shell',
    'switch-mode-plan',
    'switch-mode-review',
    'switch-mode-write',
    'undo',
  ];

  assert.deepEqual(payload.legacyRuntimeCommandIds, expectedLegacyIds);
  assert.deepEqual(payload.tiptapRuntimeCommandIds, expectedTiptapIds);
  assert.deepEqual(payload.missingOnTiptapIds, []);
  assert.deepEqual(payload.openGapIds, []);
});

test('phase00 runtime command delta state: forced negative path is deterministic', () => {
  const result = runStateScript(['--force-negative']);
  assert.notEqual(result.status, 0, 'expected forced-negative mode to return non-zero');

  const payload = parseJsonOutput(result);
  assert.equal(payload.ok, false);
  assert.equal(payload.failReason, 'E_PHASE00_RUNTIME_COMMAND_DELTA_FORCED_NEGATIVE');
  assert.equal(payload.overallStatus, 'HOLD');
  assert.equal(Array.isArray(payload.missingOnTiptapIds), true);
  assert.equal(payload.missingOnTiptapIds.includes('forced-negative-path'), true);
});

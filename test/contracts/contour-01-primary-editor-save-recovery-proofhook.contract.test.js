const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SCRIPT_PATH = path.resolve(
  __dirname,
  '..',
  '..',
  'scripts',
  'ops',
  'contour-01-primary-editor-save-recovery-proofhook.mjs',
);
const TOKEN_NAME = 'CONTOUR_01_PRIMARY_EDITOR_SAVE_RECOVERY_PATH_OK';
const FORCED_NEGATIVE_FAIL_REASON = 'E_CONTOUR_01_PRIMARY_EDITOR_SAVE_RECOVERY_FORCED_NEGATIVE';
const SEAM_IDS = [
  'menu-save-command-path',
  'boundary-read-seam',
  'autosave-reopen-recovery-path',
  'ui-recovery-restored-channel',
];
const OUT_OF_SCOPE_IDS = [
  'toolbar-save-path',
  'tiptap-ipc-boundary-seam',
  'restore-last-stable-shell-path',
  'safe-reset-shell-path',
];

function runProofhook(args = [], envPatch = {}) {
  return spawnSync(process.execPath, [SCRIPT_PATH, '--json', ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: {
      ...process.env,
      FORCE_COLOR: '0',
      NO_COLOR: '1',
      ...envPatch,
    },
  });
}

function parseJsonOutput(run) {
  let payload = null;
  assert.doesNotThrow(() => {
    payload = JSON.parse(String(run.stdout || '{}'));
  }, `invalid JSON output:\n${run.stdout}\n${run.stderr}`);
  return payload;
}

test('contour-01 primary editor save/recovery proofhook: historical admitted claim is explicitly retired against current architecture', () => {
  const run = runProofhook();
  assert.equal(run.status, 0, `expected truthful retirement result:\n${run.stdout}\n${run.stderr}`);

  const payload = parseJsonOutput(run);
  assert.equal(payload.ok, true);
  assert.equal(payload[TOKEN_NAME], 0);
  assert.equal(payload.failReason, '');
  assert.equal(payload.forcedNegative, false);
  assert.equal(payload.retiredClaim, true);
  assert.equal(payload.admissionActive, false);
  assert.equal(payload.status, 'RETIRED_HISTORICAL_PROOF_ONLY');
  assert.equal(
    payload.retirementReason,
    'HISTORICAL_ADMITTED_SAVE_PATH_RETIRED_CURRENT_MAINLINE_USES_COMMAND_SURFACE_SAVE',
  );
  assert.deepEqual(payload.coveredSeams, SEAM_IDS);
  assert.deepEqual(payload.provenOutOfScopeClaims, []);
  assert.deepEqual(payload.outOfScopeNotClaimed, OUT_OF_SCOPE_IDS);
  assert.equal(payload.seamResults['boundary-read-seam'], true);
  assert.equal(payload.seamResults['autosave-reopen-recovery-path'], true);
  assert.equal(payload.seamResults['ui-recovery-restored-channel'], true);
  assert.equal(payload.seamResults['menu-save-command-path'], false);
  assert.ok(Array.isArray(payload.missingChecks));
  assert.ok(payload.missingChecks.includes('menu-save-command-path:mainMenuFileSavePresentation'));
  assert.ok(payload.missingChecks.includes('menu-save-command-path:preloadFileSaveInvoke'));
  assert.ok(payload.missingChecks.includes('menu-save-command-path:mainHandleSaveCallsBoundaryRead'));
});

test('contour-01 primary editor save/recovery proofhook: forced negative fails deterministically', () => {
  const run = runProofhook(['--force-negative']);
  assert.equal(run.status, 1, `expected forced negative fail:\n${run.stdout}\n${run.stderr}`);

  const payload = parseJsonOutput(run);
  assert.equal(payload.ok, false);
  assert.equal(payload[TOKEN_NAME], 0);
  assert.equal(payload.failReason, FORCED_NEGATIVE_FAIL_REASON);
  assert.equal(payload.forcedNegative, true);
  assert.ok(Array.isArray(payload.missingChecks));
  assert.ok(payload.missingChecks.includes('FORCED_NEGATIVE_PATH'));
});

test('contour-01 primary editor save/recovery proofhook: forced negative via env is deterministic across runs', () => {
  const envPatch = {
    CONTOUR_01_PRIMARY_EDITOR_SAVE_RECOVERY_FORCE_NEGATIVE: '1',
  };
  const first = runProofhook([], envPatch);
  const second = runProofhook([], envPatch);

  assert.equal(first.status, 1, `first forced env run should fail:\n${first.stdout}\n${first.stderr}`);
  assert.equal(second.status, 1, `second forced env run should fail:\n${second.stdout}\n${second.stderr}`);

  const firstPayload = parseJsonOutput(first);
  const secondPayload = parseJsonOutput(second);
  assert.deepEqual(firstPayload, secondPayload);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

const SCRIPT_PATH = 'scripts/ops/Y4_RENDERER_LIVE_WIRING_STATE.mjs';

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

test('Y4 renderer live wiring state: positive run validates runtime bootstrap, phase04 and x15 live wiring', () => {
  const result = runStateScript();
  assert.equal(result.status, 0, `expected state script pass:\n${result.stdout}\n${result.stderr}`);

  const payload = parseJsonOutput(result);
  assert.equal(payload.ok, true);
  assert.equal(payload.failReason, '');
  assert.equal(payload.overallStatus, 'PASS');
  assert.equal(payload.y4RendererLiveWiringStatus, 'PASS');
  assert.equal(payload.phase04LiveThroughRuntime, true);
  assert.equal(payload.x15PolicyLiveThroughRuntime, true);
  assert.equal(payload.runtimeEntrypointBundleValidated, null);
  assert.equal(payload.runtimeEntrypointBundleProofMode, 'DELEGATED_TO_BUNDLE_CHECKER');
  assert.equal(payload.openGapIds.length, 0);
  assert.equal(payload.greenCheckIds.includes('RUNTIME_BOOTSTRAP_READY'), true);
  assert.equal(payload.greenCheckIds.includes('PHASE04_LIVE_THROUGH_RUNTIME'), true);
  assert.equal(payload.greenCheckIds.includes('X15_POLICY_LIVE_THROUGH_RUNTIME'), true);
  assert.equal(payload.greenCheckIds.includes('EDITOR_SOURCE_RUNTIME_WIRING_PRESENT'), true);
  assert.equal(payload.modeChecks.write.requiredCommandsCovered, true);
  assert.equal(payload.modeChecks.plan.requiredCommandsCovered, true);
  assert.equal(payload.modeChecks.review.requiredCommandsCovered, true);
  assert.equal(payload.singleNextMove, 'CONTOUR_Y6_COMMAND_SEAM_FENCING');
});

test('Y4 renderer live wiring state: forced negative path is deterministic', () => {
  const result = runStateScript(['--force-negative']);
  assert.notEqual(result.status, 0, 'expected forced-negative mode to return non-zero');

  const payload = parseJsonOutput(result);
  assert.equal(payload.ok, false);
  assert.equal(payload.failReason, 'E_Y4_RENDERER_LIVE_WIRING_FORCED_NEGATIVE');
  assert.equal(payload.overallStatus, 'HOLD');
  assert.equal(payload.y4RendererLiveWiringStatus, 'HOLD');
  assert.equal(payload.openGapIds.includes('FORCED_NEGATIVE_PATH'), true);
});

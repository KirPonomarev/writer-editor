const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

const SCRIPT_PATH = 'scripts/ops/phase07-release-verification-chain-baseline-state.mjs';
const EXPECTED_BLOCKING_BUDGET_IDS = [
  'STARTUP',
  'PROJECT_OPEN',
  'SCENE_SWITCH',
  'RESET',
];
const EXPECTED_PENDING_GAP_IDS = [
  'PHASE07_RUNTIME_CARRY_FORWARD_STABILITY_NOT_BOUND',
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

test('phase07 release verification chain baseline: positive run passes while readiness stays held', () => {
  const result = runStateScript();
  assert.equal(result.status, 0, `expected state script pass:\n${result.stdout}\n${result.stderr}`);

  const payload = parseJsonOutput(result);
  assert.equal(payload.ok, true);
  assert.equal(payload.failReason, '');
  assert.equal(payload.overallStatus, 'PASS');
  assert.equal(payload.phase07ReleaseVerificationChainBaselineStatus, 'PASS');
  assert.equal(payload.phase07ReadinessStatus, 'HOLD');
  assert.deepEqual(payload.phase07BlockingBudgetIds, EXPECTED_BLOCKING_BUDGET_IDS);
  assert.deepEqual(payload.phase07PendingGapIds, EXPECTED_PENDING_GAP_IDS);
  assert.deepEqual(payload.openGapIds, []);
  assert.equal(payload.greenCheckIds.includes('PREVIOUS_PHASE07_RELEASE_READY_CORE_WRITER_PATH_BASELINE_PASS'), true);
  assert.equal(payload.greenCheckIds.includes('X79_RELEASE_VERIFICATION_CHAIN_OK'), true);
  assert.equal(payload.greenCheckIds.includes('X79_RELEASE_VERIFICATION_CHAIN_CHECKS_TRUE'), true);
  assert.equal(payload.greenCheckIds.includes('X78_RELEASE_VERIFICATION_EVIDENCE_PASS'), true);
  assert.equal(payload.greenCheckIds.includes('X78_RELEASE_VERIFICATION_EVIDENCE_ATTESTATION_TRUE'), true);
  assert.equal(payload.greenCheckIds.includes('PHASE07_RELEASE_VERIFICATION_CHAIN_NOT_BOUND_RESOLVED'), true);
  assert.equal(payload.greenCheckIds.includes('PHASE07_BLOCKING_BUDGET_IDS_EXACT'), true);
  assert.equal(payload.greenCheckIds.includes('PHASE07_PENDING_GAP_IDS_EXACT'), true);
  assert.equal(payload.greenCheckIds.includes('PHASE07_READINESS_STATUS_HOLD'), true);
  assert.equal(payload.greenCheckIds.includes('PACKET_INTERNAL_CONSISTENCY'), true);
  assert.equal(payload.checkStatusById.PHASE07_RELEASE_VERIFICATION_CHAIN_NOT_BOUND_RESOLVED.status, 'GREEN');
  assert.equal(payload.checkStatusById.PHASE07_RELEASE_VERIFICATION_CHAIN_NOT_BOUND_RESOLVED.measured, true);
  assert.equal(payload.checkStatusById.X79_RELEASE_VERIFICATION_CHAIN_OK.status, 'GREEN');
  assert.equal(payload.checkStatusById.X79_RELEASE_VERIFICATION_CHAIN_OK.measured, true);
  assert.equal(payload.checkStatusById.X78_RELEASE_VERIFICATION_EVIDENCE_PASS.status, 'GREEN');
  assert.equal(payload.checkStatusById.X78_RELEASE_VERIFICATION_EVIDENCE_PASS.measured, true);
});

test('phase07 release verification chain baseline: forced negative path is deterministic', () => {
  const result = runStateScript(['--force-negative']);
  assert.notEqual(result.status, 0, 'expected forced-negative mode to return non-zero');

  const payload = parseJsonOutput(result);
  assert.equal(payload.ok, false);
  assert.equal(payload.failReason, 'E_PHASE07_RELEASE_VERIFICATION_CHAIN_BASELINE_FORCED_NEGATIVE');
  assert.equal(payload.overallStatus, 'HOLD');
  assert.equal(payload.phase07ReleaseVerificationChainBaselineStatus, 'HOLD');
  assert.equal(payload.phase07ReadinessStatus, 'HOLD');
  assert.equal(payload.openGapIds.includes('FORCED_NEGATIVE_PATH'), true);
});

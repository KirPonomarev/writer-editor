const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

const SCRIPT_PATH = 'scripts/ops/phase07-startup-project-open-scene-switch-reset-blocking-budgets-baseline-state.mjs';
const EXPECTED_BLOCKING_BUDGET_IDS = [
  'STARTUP',
  'PROJECT_OPEN',
  'SCENE_SWITCH',
  'RESET',
];
const EXPECTED_ADVISORY_BUDGET_IDS = [
  'WORKSPACE_SWITCH',
  'DETAILED_LAYOUT_SETTLE',
  'PACK_APPLY_COST',
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

test('phase07 startup project open scene switch reset blocking budgets baseline: positive run passes while release readiness stays held', () => {
  const result = runStateScript();
  assert.equal(result.status, 0, `expected state script pass:\n${result.stdout}\n${result.stderr}`);

  const payload = parseJsonOutput(result);
  assert.equal(payload.ok, true);
  assert.equal(payload.failReason, '');
  assert.equal(payload.overallStatus, 'PASS');
  assert.equal(payload.phase07BlockingBudgetsBaselineStatus, 'PASS');
  assert.equal(payload.phase07ReleaseReadinessStatus, 'HOLD');
  assert.deepEqual(payload.openGapIds, []);
  assert.deepEqual(payload.phase07PendingGapIds, ['PHASE07_RUNTIME_MEASUREMENTS_PENDING', 'PHASE07_FULL_RELEASE_HARDENING_NOT_OPENED']);
  assert.deepEqual(payload.phase07BlockingBudgetIds, EXPECTED_BLOCKING_BUDGET_IDS);
  assert.deepEqual(payload.phase07AdvisoryBudgetIds, EXPECTED_ADVISORY_BUDGET_IDS);
  assert.equal(payload.greenCheckIds.includes('PHASE06_DECISION_PASS'), true);
  assert.equal(payload.greenCheckIds.includes('CANON_PERFORMANCE_HARDENING_DIRECTION_PRESENT'), true);
  assert.equal(payload.greenCheckIds.includes('BIBLE_RELEASE_HARDENING_DIRECTION_PRESENT'), true);
  assert.equal(payload.greenCheckIds.includes('CONTEXT_RELEASE_HARDENING_DIRECTION_PRESENT'), true);
  assert.equal(payload.greenCheckIds.includes('EXECUTION_SEQUENCE_PERFORMANCE_HARDENING_PRESENT'), true);
  assert.equal(payload.greenCheckIds.includes('BLOCKING_BUDGET_IDS_EXACT'), true);
  assert.equal(payload.greenCheckIds.includes('ADVISORY_BUDGET_IDS_EXACT'), true);
  assert.equal(payload.greenCheckIds.includes('SOURCE_PHASE06_DECISION_STATE_MATCHES'), true);
  assert.equal(payload.greenCheckIds.includes('PACKET_PRESENT'), true);
  assert.equal(payload.greenCheckIds.includes('PACKET_PASS'), true);
  assert.equal(payload.greenCheckIds.includes('PACKET_BASELINE_STATUS_PASS'), true);
  assert.equal(payload.greenCheckIds.includes('PACKET_RELEASE_READINESS_HOLD'), true);
  assert.equal(payload.greenCheckIds.includes('PACKET_INTERNAL_CONSISTENCY'), true);
});

test('phase07 startup project open scene switch reset blocking budgets baseline: forced negative path is deterministic', () => {
  const result = runStateScript(['--force-negative']);
  assert.notEqual(result.status, 0, 'expected forced-negative mode to return non-zero');

  const payload = parseJsonOutput(result);
  assert.equal(payload.ok, false);
  assert.equal(payload.failReason, 'E_PHASE07_STARTUP_PROJECT_OPEN_SCENE_SWITCH_RESET_BLOCKING_BUDGETS_BASELINE_FORCED_NEGATIVE');
  assert.equal(payload.overallStatus, 'HOLD');
  assert.equal(payload.phase07BlockingBudgetsBaselineStatus, 'HOLD');
  assert.equal(payload.phase07ReleaseReadinessStatus, 'HOLD');
  assert.equal(payload.openGapIds.includes('FORCED_NEGATIVE_PATH'), true);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

const SCRIPT_PATH = 'scripts/ops/phase06-real-pack-value-or-explicit-skip-decision-state.mjs';

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

test('phase06 real pack value or explicit skip decision state: positive run passes with explicit skip decision', () => {
  const result = runStateScript();
  assert.equal(result.status, 0, `expected state script pass:\n${result.stdout}\n${result.stderr}`);

  const payload = parseJsonOutput(result);
  assert.equal(payload.ok, true);
  assert.equal(payload.failReason, '');
  assert.equal(payload.overallStatus, 'PASS');
  assert.equal(payload.phase06DecisionStatus, 'PASS');
  assert.equal(payload.phase06PackDecision, 'EXPLICIT_SKIP');
  assert.deepEqual(payload.openGapIds, []);
  assert.deepEqual(payload.phase06PendingGapIds, []);
  assert.equal(payload.greenCheckIds.includes('PHASE05_BOUNDED_SPATIAL_SHELL_PASS'), true);
  assert.equal(payload.greenCheckIds.includes('OPTIONAL_PACK_RULES_PRESENT'), true);
  assert.equal(payload.greenCheckIds.includes('NO_EXECUTABLE_PLUGIN_RUNTIME_V1'), true);
  assert.equal(payload.greenCheckIds.includes('NO_REQUIRED_PACK_FEATURE_MARKERS_FOUND'), true);
  assert.equal(payload.greenCheckIds.includes('PACKET_INTERNAL_CONSISTENCY'), true);
});

test('phase06 real pack value or explicit skip decision state: forced negative path is deterministic', () => {
  const result = runStateScript(['--force-negative']);
  assert.notEqual(result.status, 0, 'expected forced-negative mode to return non-zero');

  const payload = parseJsonOutput(result);
  assert.equal(payload.ok, false);
  assert.equal(payload.failReason, 'E_PHASE06_REAL_PACK_VALUE_OR_EXPLICIT_SKIP_DECISION_FORCED_NEGATIVE');
  assert.equal(payload.overallStatus, 'HOLD');
  assert.equal(payload.phase06DecisionStatus, 'HOLD');
  assert.equal(payload.openGapIds.includes('FORCED_NEGATIVE_PATH'), true);
});

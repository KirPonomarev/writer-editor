const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

const SCRIPT_PATH = 'scripts/ops/phase05-movable-side-containers-baseline-state.mjs';
const EXPECTED_TARGET_IDS = [
  'BOUNDED_MOVABLE_SIDE_CONTAINERS_BASELINE',
  'LEFT_SIDE_CONTAINER',
  'RIGHT_SIDE_CONTAINER',
  'EDITOR_ROOT_FIXED_DOCKED',
  'PROJECT_SCOPED_SPATIAL_LAYOUT_SNAPSHOT',
  'RESIZE_END_SAFE_RESET_LAST_STABLE_RESTORE',
  'SAFE_DEGRADATION_ON_INVALID_LAYOUT_OR_VIEWPORT_SHRINK',
];
const EXPECTED_COMMIT_POINT_IDS = [
  'RESIZE_END',
  'SAFE_RESET',
  'RESTORE_LAST_STABLE',
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

test('phase05 movable side containers baseline: positive run passes while readiness remains hold', () => {
  const result = runStateScript();
  assert.equal(result.status, 0, `expected state script pass:\n${result.stdout}\n${result.stderr}`);

  const payload = parseJsonOutput(result);
  assert.equal(payload.ok, true);
  assert.equal(payload.failReason, '');
  assert.equal(payload.overallStatus, 'PASS');
  assert.equal(payload.phase05ReadinessStatus, 'HOLD');
  assert.deepEqual(payload.openGapIds, []);
  assert.deepEqual(payload.lockedTargetIds, EXPECTED_TARGET_IDS);
  assert.deepEqual(payload.lockedCommitPointIds, EXPECTED_COMMIT_POINT_IDS);
  assert.equal(payload.greenCheckIds.includes('PHASE04_DESIGN_LAYER_BASELINE_PASS'), true);
  assert.equal(payload.greenCheckIds.includes('LEFT_AND_RIGHT_RESIZE_HANDLES_PRESENT'), true);
  assert.equal(payload.greenCheckIds.includes('PROJECT_SCOPED_SPATIAL_LAYOUT_STORAGE'), true);
  assert.equal(payload.greenCheckIds.includes('COMMIT_POINT_PERSISTENCE_ONLY'), true);
  assert.equal(payload.greenCheckIds.includes('SAFE_RESET_PERSISTS_BASELINE'), true);
  assert.equal(payload.greenCheckIds.includes('RESTORE_LAST_STABLE_RESTORES_SNAPSHOT'), true);
  assert.equal(payload.greenCheckIds.includes('INVALID_VIEWPORT_DEGRADES_TO_BASELINE'), true);
});

test('phase05 movable side containers baseline: forced negative path is deterministic', () => {
  const result = runStateScript(['--force-negative']);
  assert.notEqual(result.status, 0, 'expected forced-negative mode to return non-zero');

  const payload = parseJsonOutput(result);
  assert.equal(payload.ok, false);
  assert.equal(payload.failReason, 'E_PHASE05_MOVABLE_SIDE_CONTAINERS_BASELINE_FORCED_NEGATIVE');
  assert.equal(payload.overallStatus, 'HOLD');
  assert.equal(payload.openGapIds.includes('FORCED_NEGATIVE_PATH'), true);
});

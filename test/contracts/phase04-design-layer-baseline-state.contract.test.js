const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

const SCRIPT_PATH = 'scripts/ops/phase04-design-layer-baseline-state.mjs';

const EXPECTED_DESIGN_LAYER_SURFACE_IDS = [
  'TOKENS',
  'TYPOGRAPHY',
  'SKINS',
  'SUPPORTED_MODES',
];

const EXPECTED_PROFILE_IDS = [
  'BASELINE',
  'SAFE',
  'FOCUS',
  'COMPACT',
];

const EXPECTED_SHELL_MODE_IDS = [
  'CALM_DOCKED',
  'COMPACT_DOCKED',
  'SPATIAL_ADVANCED',
  'SAFE_RECOVERY',
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

test('phase04 design layer baseline state: positive run passes with design-layer-only scope locked', () => {
  const result = runStateScript();
  assert.equal(result.status, 0, `expected state script pass:\n${result.stdout}\n${result.stderr}`);

  const payload = parseJsonOutput(result);
  assert.equal(payload.ok, true);
  assert.equal(payload.failReason, '');
  assert.equal(payload.overallStatus, 'PASS');
  assert.equal(payload.phase04BaselineStatus, 'PASS');
  assert.equal(payload.activeLogicalArtifactId, 'PHASE04_DESIGN_LAYER_BASELINE');
  assert.deepEqual(payload.openGapIds, []);
  assert.deepEqual(payload.phase04PendingGapIds, []);
  assert.deepEqual(payload.designLayerSurfaceIds, EXPECTED_DESIGN_LAYER_SURFACE_IDS);
  assert.deepEqual(payload.profileIds, EXPECTED_PROFILE_IDS);
  assert.deepEqual(payload.supportedShellModeIds, EXPECTED_SHELL_MODE_IDS);
  assert.equal(payload.greenCheckIds.includes('PHASE03_BASELINE_DOCKED_SHELL_PASS'), true);
  assert.equal(payload.greenCheckIds.includes('SUPERSESSION_PACKET_INTERNAL_CONSISTENCY'), true);
  assert.equal(payload.greenCheckIds.includes('DESIGN_LAYER_SCOPE_LOCKED'), true);
  assert.equal(payload.greenCheckIds.includes('DESIGN_PACKET_INTERNAL_CONSISTENCY'), true);
});

test('phase04 design layer baseline state: forced negative path is deterministic', () => {
  const result = runStateScript(['--force-negative']);
  assert.notEqual(result.status, 0, 'expected forced-negative mode to return non-zero');

  const payload = parseJsonOutput(result);
  assert.equal(payload.ok, false);
  assert.equal(payload.failReason, 'E_PHASE04_DESIGN_LAYER_BASELINE_FORCED_NEGATIVE');
  assert.equal(payload.overallStatus, 'HOLD');
  assert.equal(payload.phase04BaselineStatus, 'HOLD');
  assert.equal(payload.openGapIds.includes('FORCED_NEGATIVE_PATH'), true);
});

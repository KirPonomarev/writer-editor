const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const TRACKED_STRESS_PATH = path.join(REPO_ROOT, 'test', 'unit', 'editor-sheet-instrumented-stress-smoke.mjs');
const DIAGNOSTIC_PROBE_PATH = path.join(REPO_ROOT, 'test', 'unit', 'editor-sheet-6000-light-health-probe.mjs');
const STATUS_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'STATUS', 'EDITORIAL_SHEET_STRESS_LANE_STATUS_V3.json');

function readText(targetPath) {
  return fs.readFileSync(targetPath, 'utf8');
}

test('editor sheet 6000 diagnostic probe: tracked stress row set stays capped at 5000', () => {
  const trackedSource = readText(TRACKED_STRESS_PATH);

  assert.ok(
    trackedSource.includes('[2000, 3000, 4000, 5000].includes(targetPageCount)'),
    'tracked stress smoke must keep the exact 2000/3000/4000/5000 allowlist',
  );
  assert.equal(
    trackedSource.includes('[2000, 3000, 4000, 5000, 6000].includes(targetPageCount)'),
    false,
    'tracked stress smoke must not admit 6000 as a tracked scale row',
  );
});

test('editor sheet 6000 diagnostic probe: standalone probe cannot claim readiness', () => {
  const diagnosticSource = readText(DIAGNOSTIC_PROBE_PATH);

  assert.ok(diagnosticSource.includes('EDITOR_SHEET_6000_LIGHT_HEALTH_PROBE_SUMMARY'));
  assert.ok(diagnosticSource.includes("assert.equal(targetPageCount, 6000"));
  assert.ok(diagnosticSource.includes('diagnosticOnly: true'));
  assert.ok(diagnosticSource.includes('readinessClaim: false'));
  assert.ok(diagnosticSource.includes('supportedTierRaised: false'));
});

test('editor sheet 6000 diagnostic probe: resource stop emits non-pass diagnostic summary', () => {
  const diagnosticSource = readText(DIAGNOSTIC_PROBE_PATH);

  assert.ok(diagnosticSource.includes("status: 'STOP_RESOURCE_LIMIT'"));
  assert.ok(diagnosticSource.includes('process.exit(0)'));
  assert.ok(diagnosticSource.includes('checkpointCount'));
  assert.equal(diagnosticSource.includes('6000_READY'), false);
});

test('editor sheet 6000 diagnostic probe: committed stress status keeps 5000 as supported tier', () => {
  const artifact = JSON.parse(readText(STATUS_PATH));

  assert.deepEqual(artifact.trackedScalePageCounts, [2000, 3000, 4000, 5000]);
  assert.equal(artifact.readiness.editorialSheet5000Ready, true);
  assert.equal(artifact.readiness.tracked5000Pass, true);
  assert.equal(JSON.stringify(artifact).includes('6000'), false);
});

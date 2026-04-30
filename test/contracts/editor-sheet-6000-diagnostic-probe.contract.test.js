const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const TRACKED_STRESS_PATH = path.join(REPO_ROOT, 'test', 'unit', 'editor-sheet-instrumented-stress-smoke.mjs');
const DIAGNOSTIC_PROBE_PATH = path.join(REPO_ROOT, 'test', 'unit', 'editor-sheet-6000-light-health-probe.mjs');
const STATUS_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'STATUS', 'EDITORIAL_SHEET_STRESS_LANE_STATUS_V3.json');
const CLOSEOUT_SUMMARY_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'STATUS', 'EDITORIAL_SHEET_5000_CLOSEOUT_SUMMARY.json');
const TRACKED_SCALE_CEILING = 5000;
const TRACKED_SCALE_COUNTS = [2000, 3000, 4000, 5000];

function readText(targetPath) {
  return fs.readFileSync(targetPath, 'utf8');
}

function collectBoundaryPolicyIssues({ stressArtifact, closeoutSummary }) {
  const issues = [];
  const trackedScalePageCounts = Array.isArray(stressArtifact?.trackedScalePageCounts)
    ? stressArtifact.trackedScalePageCounts.map((pageCount) => Number(pageCount || 0))
    : [];

  if (JSON.stringify(trackedScalePageCounts) !== JSON.stringify(TRACKED_SCALE_COUNTS)) {
    issues.push('TRACKED_SCALE_COUNTS_PROMOTED_OR_CHANGED');
  }
  if (trackedScalePageCounts.some((pageCount) => pageCount > TRACKED_SCALE_CEILING)) {
    issues.push('TRACKED_SCALE_ABOVE_5000');
  }
  if (Number(stressArtifact?.provisionalObservedCeiling || 0) > TRACKED_SCALE_CEILING) {
    issues.push('SUPPORTED_CEILING_ABOVE_5000');
  }
  if (stressArtifact?.readiness?.editorialSheet6000Ready === true) {
    issues.push('READINESS_6000_CLAIMED');
  }
  if (stressArtifact?.readiness?.tracked6000Pass === true) {
    issues.push('TRACKED_6000_PASS_CLAIMED');
  }

  const claim = closeoutSummary?.claim || {};
  if (claim.unsupportedAboveProvenTier !== '6000_PLUS_NOT_PROMOTED_BY_THIS_GATE') {
    issues.push('CLOSEOUT_6000_UNSUPPORTED_BOUNDARY_MISSING');
  }
  if (!Array.isArray(closeoutSummary?.notClaimed) || !closeoutSummary.notClaimed.includes('6000_PLUS_READY')) {
    issues.push('CLOSEOUT_6000_NOT_CLAIMED_MISSING');
  }
  for (const [key, value] of Object.entries(claim)) {
    if (/6000|sixThousand|SixThousand/u.test(key) && value === true) {
      issues.push(`CLOSEOUT_POSITIVE_6000_CLAIM_${key}`);
    }
  }
  for (const fieldName of ['supportedTier', 'currentSupportedTier', 'provenSupportedTier']) {
    if (Number(closeoutSummary?.[fieldName] || 0) > TRACKED_SCALE_CEILING) {
      issues.push(`CLOSEOUT_${fieldName}_ABOVE_5000`);
    }
  }

  return issues;
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
  assert.ok(diagnosticSource.includes("status: 'DIAGNOSTIC_ONLY_PASS'"));
  assert.ok(diagnosticSource.includes('diagnosticOnly: true'));
  assert.ok(diagnosticSource.includes('readinessClaim: false'));
  assert.ok(diagnosticSource.includes('supportedTierRaised: false'));
  assert.equal(diagnosticSource.includes('supportedTierRaised: true'), false);
  assert.equal(diagnosticSource.includes('readinessClaim: true'), false);
});

test('editor sheet 6000 diagnostic probe: resource stop emits non-pass diagnostic summary', () => {
  const diagnosticSource = readText(DIAGNOSTIC_PROBE_PATH);

  assert.ok(diagnosticSource.includes("status: 'STOP_RESOURCE_LIMIT'"));
  assert.ok(diagnosticSource.includes('process.exit(0)'));
  assert.ok(diagnosticSource.includes('checkpointCount'));
  assert.ok(diagnosticSource.includes('diagnosticOnly: true'));
  assert.ok(diagnosticSource.includes('readinessClaim: false'));
  assert.ok(diagnosticSource.includes('supportedTierRaised: false'));
  assert.equal(diagnosticSource.includes('6000_READY'), false);
});

test('editor sheet 6000 diagnostic probe: committed stress status keeps 5000 as supported tier', () => {
  const artifact = JSON.parse(readText(STATUS_PATH));

  assert.deepEqual(artifact.trackedScalePageCounts, TRACKED_SCALE_COUNTS);
  assert.equal(artifact.readiness.editorialSheet5000Ready, true);
  assert.equal(artifact.readiness.tracked5000Pass, true);
  assert.equal(JSON.stringify(artifact).includes('6000'), false);
});

test('editor sheet 6000 diagnostic probe: closeout summary preserves unsupported boundary wording', () => {
  const artifact = JSON.parse(readText(STATUS_PATH));
  const closeoutSummary = JSON.parse(readText(CLOSEOUT_SUMMARY_PATH));
  const issues = collectBoundaryPolicyIssues({ stressArtifact: artifact, closeoutSummary });

  assert.deepEqual(issues, []);
});

test('editor sheet 6000 diagnostic probe: boundary policy rejects simulated 6000 promotion', () => {
  const artifact = JSON.parse(readText(STATUS_PATH));
  const closeoutSummary = JSON.parse(readText(CLOSEOUT_SUMMARY_PATH));
  const promotedArtifact = {
    ...artifact,
    trackedScalePageCounts: [...artifact.trackedScalePageCounts, 6000],
    provisionalObservedCeiling: 6000,
    readiness: {
      ...artifact.readiness,
      editorialSheet6000Ready: true,
      tracked6000Pass: true,
    },
  };
  const promotedSummary = {
    ...closeoutSummary,
    claim: {
      ...closeoutSummary.claim,
      unsupportedAboveProvenTier: 'NONE',
      editorialSheet6000Ready: true,
    },
    supportedTier: 6000,
  };
  const issues = collectBoundaryPolicyIssues({
    stressArtifact: promotedArtifact,
    closeoutSummary: promotedSummary,
  });

  assert.ok(issues.includes('TRACKED_SCALE_COUNTS_PROMOTED_OR_CHANGED'));
  assert.ok(issues.includes('TRACKED_SCALE_ABOVE_5000'));
  assert.ok(issues.includes('SUPPORTED_CEILING_ABOVE_5000'));
  assert.ok(issues.includes('READINESS_6000_CLAIMED'));
  assert.ok(issues.includes('TRACKED_6000_PASS_CLAIMED'));
  assert.ok(issues.includes('CLOSEOUT_6000_UNSUPPORTED_BOUNDARY_MISSING'));
  assert.ok(issues.includes('CLOSEOUT_POSITIVE_6000_CLAIM_editorialSheet6000Ready'));
  assert.ok(issues.includes('CLOSEOUT_supportedTier_ABOVE_5000'));
});

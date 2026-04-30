const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const TRACKED_STRESS_PATH = path.join(REPO_ROOT, 'test', 'unit', 'editor-sheet-instrumented-stress-smoke.mjs');
const DIAGNOSTIC_PROBE_PATH = path.join(REPO_ROOT, 'test', 'unit', 'editor-sheet-6000-light-health-probe.mjs');
const STATUS_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'STATUS', 'EDITORIAL_SHEET_STRESS_LANE_STATUS_V3.json');
const CLOSEOUT_SUMMARY_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'STATUS', 'EDITORIAL_SHEET_5000_CLOSEOUT_SUMMARY.json');
const TRACKED_SCALE_CEILING = 10000;
const TRACKED_SCALE_COUNTS = [2000, 3000, 4000, 5000, 10000];
const TRACKED_CANDIDATE_COUNTS = [];
const DIAGNOSTIC_BOUNDARY_COUNTS = [25000];

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
    issues.push('TRACKED_SCALE_ABOVE_10000');
  }
  if (Number(stressArtifact?.provisionalObservedCeiling || 0) > TRACKED_SCALE_CEILING) {
    issues.push('SUPPORTED_CEILING_ABOVE_10000');
  }
  if (Number(stressArtifact?.supportedTier || TRACKED_SCALE_CEILING) > TRACKED_SCALE_CEILING) {
    issues.push('SUPPORTED_TIER_ABOVE_10000');
  }
  if (JSON.stringify(stressArtifact?.trackedCandidatePageCounts || []) !== JSON.stringify(TRACKED_CANDIDATE_COUNTS)) {
    issues.push('TRACKED_CANDIDATE_COUNTS_CHANGED');
  }
  if (JSON.stringify(stressArtifact?.diagnosticBoundaryPageCounts || []) !== JSON.stringify(DIAGNOSTIC_BOUNDARY_COUNTS)) {
    issues.push('DIAGNOSTIC_BOUNDARY_COUNTS_CHANGED');
  }
  if (JSON.stringify(stressArtifact?.diagnosticBoundaryPolicy?.destructiveDiagnosticPageCounts || []) !== JSON.stringify(DIAGNOSTIC_BOUNDARY_COUNTS)) {
    issues.push('DIAGNOSTIC_BOUNDARY_POLICY_COUNTS_CHANGED');
  }
  if (stressArtifact?.diagnosticBoundaryPolicy?.readinessClaim !== false) {
    issues.push('DIAGNOSTIC_BOUNDARY_READINESS_CLAIMED');
  }
  if (stressArtifact?.diagnosticBoundaryPolicy?.supportedTierRaised !== false) {
    issues.push('DIAGNOSTIC_BOUNDARY_SUPPORTED_TIER_RAISED');
  }
  if (stressArtifact?.diagnosticBoundaryPolicy?.acceptancePromotion !== false) {
    issues.push('DIAGNOSTIC_BOUNDARY_ACCEPTANCE_PROMOTED');
  }
  if (stressArtifact?.readiness?.editorialSheet25000Ready === true) {
    issues.push('READINESS_25000_CLAIMED');
  }
  if (stressArtifact?.readiness?.tracked25000Pass === true) {
    issues.push('TRACKED_25000_PASS_CLAIMED');
  }

  const claim = closeoutSummary?.claim || {};
  if (claim.unsupportedAboveProvenTier !== 'ABOVE_10000_NOT_PROMOTED_BY_THIS_GATE') {
    issues.push('CLOSEOUT_ABOVE_10000_UNSUPPORTED_BOUNDARY_MISSING');
  }
  if (!Array.isArray(closeoutSummary?.notClaimed) || !closeoutSummary.notClaimed.includes('25000_PLUS_READY')) {
    issues.push('CLOSEOUT_25000_NOT_CLAIMED_MISSING');
  }
  for (const [key, value] of Object.entries(claim)) {
    if (/(25000|40000|41750|twentyFiveThousand|fortyThousand)/u.test(key) && value === true) {
      issues.push(`CLOSEOUT_POSITIVE_UNSUPPORTED_SCALE_CLAIM_${key}`);
    }
  }
  for (const fieldName of ['supportedTier', 'currentSupportedTier', 'provenSupportedTier']) {
    if (Number(closeoutSummary?.[fieldName] || 0) > TRACKED_SCALE_CEILING) {
      issues.push(`CLOSEOUT_${fieldName}_ABOVE_10000`);
    }
  }

  return issues;
}

test('editor sheet 6000 diagnostic probe: tracked stress row set stays capped at 10000', () => {
  const trackedSource = readText(TRACKED_STRESS_PATH);

  assert.ok(
    trackedSource.includes('[2000, 3000, 4000, 5000, 10000].includes(targetPageCount)'),
    'tracked stress smoke must keep the exact 2000/3000/4000/5000/10000 allowlist',
  );
  assert.equal(
    trackedSource.includes('[2000, 3000, 4000, 5000, 6000].includes(targetPageCount)'),
    false,
    'tracked stress smoke must not use 6000 as a separate tracked scale row',
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

test('editor sheet 6000 diagnostic probe: committed stress status keeps 10000 as supported tier', () => {
  const artifact = JSON.parse(readText(STATUS_PATH));

  assert.deepEqual(artifact.trackedScalePageCounts, TRACKED_SCALE_COUNTS);
  assert.deepEqual(artifact.trackedCandidatePageCounts, TRACKED_CANDIDATE_COUNTS);
  assert.deepEqual(artifact.diagnosticBoundaryPageCounts, DIAGNOSTIC_BOUNDARY_COUNTS);
  assert.equal(artifact.supportedTier, TRACKED_SCALE_CEILING);
  assert.equal(artifact.readiness.editorialSheet5000Ready, true);
  assert.equal(artifact.readiness.tracked5000Pass, true);
  assert.equal(artifact.readiness.editorialSheet10000Ready, true);
  assert.equal(artifact.readiness.tracked10000Pass, true);
  assert.equal(artifact.candidates.trackedCandidate10000Pass, false);
  assert.equal(artifact.candidates.supportedTierRaised, false);
  assert.deepEqual(artifact.diagnosticBoundaryPolicy.destructiveDiagnosticPageCounts, DIAGNOSTIC_BOUNDARY_COUNTS);
  assert.equal(artifact.diagnosticBoundaryPolicy.readinessClaim, false);
  assert.equal(artifact.diagnosticBoundaryPolicy.supportedTierRaised, false);
  assert.equal(artifact.diagnosticBoundaryPolicy.acceptancePromotion, false);
  assert.equal(artifact.diagnosticBoundaryPolicy.heavyRunByDefault, false);
  assert.equal(artifact.trackedScalePageCounts.includes(25000), false);
  assert.equal(artifact.trackedCandidatePageCounts.includes(25000), false);
  assert.equal(artifact.rows.some((row) => Number(row.pageCount || 0) === 25000), false);
  assert.equal(artifact.readiness.editorialSheet25000Ready, undefined);
  assert.equal(artifact.readiness.tracked25000Pass, undefined);
});

test('editor sheet 6000 diagnostic probe: closeout summary preserves unsupported boundary wording', () => {
  const artifact = JSON.parse(readText(STATUS_PATH));
  const closeoutSummary = JSON.parse(readText(CLOSEOUT_SUMMARY_PATH));
  const issues = collectBoundaryPolicyIssues({ stressArtifact: artifact, closeoutSummary });

  assert.deepEqual(issues, []);
});

test('editor sheet 6000 diagnostic probe: boundary policy rejects simulated 25000 promotion', () => {
  const artifact = JSON.parse(readText(STATUS_PATH));
  const closeoutSummary = JSON.parse(readText(CLOSEOUT_SUMMARY_PATH));
  const promotedArtifact = {
    ...artifact,
    trackedScalePageCounts: [...artifact.trackedScalePageCounts, 25000],
    provisionalObservedCeiling: 25000,
    supportedTier: 25000,
    readiness: {
      ...artifact.readiness,
      editorialSheet25000Ready: true,
      tracked25000Pass: true,
    },
    candidates: {
      ...artifact.candidates,
      supportedTierRaised: true,
    },
    diagnosticBoundaryPolicy: {
      ...artifact.diagnosticBoundaryPolicy,
      readinessClaim: true,
      supportedTierRaised: true,
      acceptancePromotion: true,
    },
  };
  const promotedSummary = {
    ...closeoutSummary,
    claim: {
      ...closeoutSummary.claim,
      unsupportedAboveProvenTier: 'NONE',
      editorialSheet25000Ready: true,
    },
    supportedTier: 25000,
  };
  const issues = collectBoundaryPolicyIssues({
    stressArtifact: promotedArtifact,
    closeoutSummary: promotedSummary,
  });

  assert.ok(issues.includes('TRACKED_SCALE_COUNTS_PROMOTED_OR_CHANGED'));
  assert.ok(issues.includes('TRACKED_SCALE_ABOVE_10000'));
  assert.ok(issues.includes('SUPPORTED_CEILING_ABOVE_10000'));
  assert.ok(issues.includes('SUPPORTED_TIER_ABOVE_10000'));
  assert.ok(issues.includes('READINESS_25000_CLAIMED'));
  assert.ok(issues.includes('TRACKED_25000_PASS_CLAIMED'));
  assert.ok(issues.includes('DIAGNOSTIC_BOUNDARY_READINESS_CLAIMED'));
  assert.ok(issues.includes('DIAGNOSTIC_BOUNDARY_SUPPORTED_TIER_RAISED'));
  assert.ok(issues.includes('DIAGNOSTIC_BOUNDARY_ACCEPTANCE_PROMOTED'));
  assert.ok(issues.includes('CLOSEOUT_ABOVE_10000_UNSUPPORTED_BOUNDARY_MISSING'));
  assert.ok(issues.includes('CLOSEOUT_POSITIVE_UNSUPPORTED_SCALE_CLAIM_editorialSheet25000Ready'));
  assert.ok(issues.includes('CLOSEOUT_supportedTier_ABOVE_10000'));
});

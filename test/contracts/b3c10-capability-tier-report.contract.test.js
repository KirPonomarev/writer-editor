const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MODULE_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'b3c10-capability-tier-report-state.mjs');
const STATUS_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'STATUS', 'B3C10_CAPABILITY_TIER_REPORT_STATUS_V1.json');

let modulePromise = null;

function loadModule() {
  if (!modulePromise) modulePromise = import(pathToFileURL(MODULE_PATH).href);
  return modulePromise;
}

function readJson(targetPath) {
  return JSON.parse(fs.readFileSync(targetPath, 'utf8'));
}

test('b3c10 capability tier report: state artifact equals executable state', async () => {
  const { evaluateB3C10CapabilityTierReportState, TOKEN_NAME, FULL_TIER_TOKEN_NAME } = await loadModule();
  const state = await evaluateB3C10CapabilityTierReportState({ repoRoot: REPO_ROOT });
  const committedState = readJson(STATUS_PATH);

  assert.equal(committedState.artifactId, state.artifactId);
  assert.equal(committedState.contourId, state.contourId);
  assert.equal(committedState.status, state.status);
  assert.equal(committedState[TOKEN_NAME], state[TOKEN_NAME]);
  assert.equal(committedState[FULL_TIER_TOKEN_NAME], state[FULL_TIER_TOKEN_NAME]);
  assert.deepEqual(committedState.failRows, state.failRows);
  assert.deepEqual(committedState.inputRows, state.inputRows);
  assert.deepEqual(committedState.tierRows, state.tierRows);
  assert.deepEqual(committedState.unsupportedScope, state.unsupportedScope);
  assert.deepEqual(committedState.provisionalScope, state.provisionalScope);
  assert.deepEqual(committedState.scope, state.scope);
  assert.deepEqual(committedState.donorIntake, state.donorIntake);
  assert.equal(committedState.runtime.changedBasenamesHash, state.runtime.changedBasenamesHash);
  assert.equal(Boolean(state.runtime.statusArtifactHash), true);
  assert.equal(state.ok, true, JSON.stringify(state, null, 2));
  assert.equal(state.status, 'PASS');
  assert.equal(state[TOKEN_NAME], 1);
  assert.equal(state[FULL_TIER_TOKEN_NAME], 0);
  assert.deepEqual(state.failRows, []);
  assert.equal(state.repo.repoRootBinding, 'WORKTREE_INDEPENDENT');
  assert.equal(state.reportClass, 'TRUTHFUL_CAPABILITY_REPORT_NOT_PERF_GREEN_NOT_RELEASE_GREEN');
  assert.equal(state.runtime.commandResults.status, 'DECLARED_FOR_EXTERNAL_RUNNER');
});

test('b3c10 capability tier report: CLI status remains worktree independent outside repo cwd', () => {
  const result = spawnSync(process.execPath, [MODULE_PATH, '--json'], {
    cwd: os.tmpdir(),
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);

  const state = JSON.parse(result.stdout);
  assert.equal(state.ok, true, JSON.stringify(state, null, 2));
  assert.equal(state.B3C10_CAPABILITY_TIER_REPORT_OK, 1);
  assert.equal(state.B3C10_FULL_TIER_GREEN_OK, 0);
  assert.equal(state.repo.repoRootBinding, 'WORKTREE_INDEPENDENT');
});

test('b3c10 capability tier report: binds B3C02 through B3C09 input statuses', async () => {
  const { evaluateB3C10CapabilityTierReportState } = await loadModule();
  const state = await evaluateB3C10CapabilityTierReportState({ repoRoot: REPO_ROOT });
  const inputBasenames = state.inputRows?.map((row) => row.basename) || [];

  assert.equal(state.proof.inputStatusesBound, true);
  for (const basename of [
    'B3C02_COMPILE_IR_BASELINE_STATUS_V1.json',
    'B3C03_DOCX_ARTIFACT_VALIDATION_STATUS_V1.json',
    'B3C04_DETERMINISTIC_EXPORT_MODE_STATUS_V1.json',
    'B3C05_PERMISSION_SCOPE_ENFORCED_STATUS_V1.json',
    'B3C06_NO_NETWORK_WRITING_PATH_STATUS_V1.json',
    'B3C07_SECURITY_RUNTIME_BOUNDARY_STATUS_V1.json',
    'B3C08_SUPPORT_BUNDLE_PRIVACY_STATUS_V1.json',
    'B3C09_PERFORMANCE_BASELINE_BINDING_STATUS_V1.json',
  ]) {
    assert.equal(inputBasenames.includes(basename), true, `${basename} must be bound`);
  }
});

test('b3c10 capability tier report: rejects full tier green while B3C09 gap is bound', async () => {
  const { evaluateB3C10CapabilityTierReportState } = await loadModule();
  const state = await evaluateB3C10CapabilityTierReportState({ repoRoot: REPO_ROOT });

  assert.equal(state.proof.b3c09ProvisionalGapBound, true);
  assert.equal(state.proof.noFullTierGreen, true);
  assert.equal(state.B3C10_FULL_TIER_GREEN_OK, 0);
  assert.equal(state.tierRows[0].status, 'PROVISIONAL');
  assert.equal(state.tierRows[0].fullTierGreen, false);
  assert.equal(state.tierRows[0].releasePromiseAllowed, false);
});

test('b3c10 capability tier report: unsupported scope includes scene switch and export docx measurements', async () => {
  const { evaluateB3C10CapabilityTierReportState } = await loadModule();
  const state = await evaluateB3C10CapabilityTierReportState({ repoRoot: REPO_ROOT });
  const unsupportedIds = state.unsupportedScope.map((row) => row.id).sort();
  const provisionalRows = state.provisionalScope.find((row) => row.id === 'NEXT_REQUIRED_MEASUREMENTS')?.rows || [];

  assert.equal(unsupportedIds.includes('SCENE_SWITCH_P95_MS'), true);
  assert.equal(unsupportedIds.includes('EXPORT_DOCX_P95_MS'), true);
  assert.deepEqual([...provisionalRows].sort(), ['EXPORT_DOCX_P95_MS', 'SCENE_SWITCH_P95_MS']);
});

test('b3c10 capability tier report: donor intake is context only and imports no donor completion claim', async () => {
  const { evaluateB3C10CapabilityTierReportState } = await loadModule();
  const state = await evaluateB3C10CapabilityTierReportState({ repoRoot: REPO_ROOT });

  assert.equal(state.proof.donorIntakeContextOnly, true);
  assert.equal(state.donorIntake.class, 'READ_ONLY_CONTEXT_ONLY');
  assert.equal(state.donorIntake.codeImported, false);
  assert.equal(state.donorIntake.completionClaimImported, false);
  assert.equal(state.donorIntake.activeCanonOverDonor, true);
  assert.ok(state.donorIntake.archiveRows.length >= 4);
});

test('b3c10 capability tier report: forbidden release and governance claims fail evaluation', async () => {
  const { evaluateB3C10CapabilityTierReportState } = await loadModule();
  const state = await evaluateB3C10CapabilityTierReportState({
    repoRoot: REPO_ROOT,
    forceClaims: {
      releaseClaim: true,
    },
  });

  assert.equal(state.ok, false);
  assert.equal(state.status, 'FAIL');
  assert.equal(state.failRows.includes('FORBIDDEN_RELEASE_OR_TIER_CLAIM'), true);
  assert.equal(state.failSignal, 'E_B3C10_CAPABILITY_TIER_REPORT_NOT_OK');
});

test('b3c10 capability tier report: scope flags reject UI export security storage and dependency drift', async () => {
  const { evaluateB3C10CapabilityTierReportState } = await loadModule();
  const state = await evaluateB3C10CapabilityTierReportState({ repoRoot: REPO_ROOT });

  assert.equal(state.scope.capabilityReportOnly, true);
  assert.equal(state.scope.reportClassificationOnly, true);
  assert.equal(state.scope.perfMeasurementImplemented, false);
  assert.equal(state.scope.exportPipelineRewritten, false);
  assert.equal(state.scope.securityRuntimeBoundaryRewritten, false);
  assert.equal(state.scope.privacyRuntimeRewritten, false);
  assert.equal(state.scope.storageFormatChanged, false);
  assert.equal(state.scope.storageMutated, false);
  assert.equal(state.scope.uiTouched, false);
  assert.equal(state.scope.releaseClaim, false);
  assert.equal(state.scope.mvpReleaseClaim, false);
  assert.equal(state.scope.fullTierGreenClaim, false);
  assert.equal(state.scope.attestationClaim, false);
  assert.equal(state.scope.supplyChainClaim, false);
  assert.equal(state.scope.newDependency, false);
});

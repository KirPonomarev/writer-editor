const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'b2c18-basic-kernel-perf-guard-state.mjs');
const STATUS_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'STATUS', 'B2C18_BASIC_KERNEL_PERF_GUARD_STATUS_V1.json');
const EVIDENCE_DIR = path.join(REPO_ROOT, 'docs', 'OPS', 'EVIDENCE', 'B2C18_BASIC_KERNEL_PERF_GUARD', 'TICKET_01');

let modulePromise = null;

function loadModule() {
  if (!modulePromise) {
    modulePromise = import(pathToFileURL(MODULE_PATH).href);
  }
  return modulePromise;
}

function readJson(targetPath) {
  return JSON.parse(fs.readFileSync(targetPath, 'utf8'));
}

test('b2c18 basic kernel perf guard: committed status equals executable state and required proofs stay green', async () => {
  const { evaluateB2C18BasicKernelPerfGuardState, TOKEN_NAME } = await loadModule();
  const state = await evaluateB2C18BasicKernelPerfGuardState({ repoRoot: REPO_ROOT });
  const committedState = readJson(STATUS_PATH);

  assert.deepEqual(committedState, state);
  assert.equal(state.ok, true, JSON.stringify(state, null, 2));
  assert.equal(state[TOKEN_NAME], 1);
  assert.deepEqual(state.failRows, []);
  assert.equal(state.proof.repoBound, true);
  assert.equal(state.proof.deterministicRuntimeBudgetGuardOnly, true);
  assert.equal(state.proof.b2c17StateBound, true);
  assert.equal(state.proof.statusPacketDeepEqualReady, true);
  assert.equal(state.proof.typingHotPathProhibitionsExplicitOk, true);
  assert.equal(state.proof.fullBookRebuildRejectedOnTypingOk, true);
  assert.equal(state.proof.projectSearchRejectedOnTypingOk, true);
  assert.equal(state.proof.fullLayoutRejectedOnTypingOk, true);
  assert.equal(state.proof.fullPreflightRejectedOnTypingOk, true);
  assert.equal(state.proof.recoveryPackSyncRejectedOnTypingOk, true);
  assert.equal(state.proof.deterministicOpenProjectSmokeRecordedOk, true);
  assert.equal(state.proof.deterministicSceneSwitchSmokeRecordedOk, true);
  assert.equal(state.proof.deterministicSaveSmokeRecordedOk, true);
  assert.equal(state.proof.deterministicInputSmokeRecordedOk, true);
  assert.equal(state.proof.commandResultsNoPendingOk, true);
  assert.equal(state.proof.noUiChangeOk, true);
  assert.equal(state.proof.noEditorBehaviorChangeOk, true);
  assert.equal(state.proof.noDependencyChangeOk, true);
  assert.equal(state.proof.noStorageOrSchemaChangeOk, true);
  assert.equal(state.proof.noRuntimeTelemetryOk, true);
  assert.equal(state.proof.noRealBenchmarkInfrastructureOk, true);
  assert.equal(state.proof.noReleaseScaleClaimOk, true);
  assert.equal(state.proof.noB2C19ClaimOk, true);
  assert.equal(state.proof.noB2C20ClaimOk, true);
  assert.equal(state.proof.noBlock2ExitClaimOk, true);
});

test('b2c18 basic kernel perf guard: evidence packets align, donor mapping is exact, and smoke rows stay deterministic', async () => {
  const { evaluateB2C18BasicKernelPerfGuardState } = await loadModule();
  const state = await evaluateB2C18BasicKernelPerfGuardState({ repoRoot: REPO_ROOT });
  const perfBudgetTable = readJson(path.join(EVIDENCE_DIR, 'perf-budget-table.json'));
  const hotPathProof = readJson(path.join(EVIDENCE_DIR, 'hot-path-proof.json'));
  const donorMapping = readJson(path.join(EVIDENCE_DIR, 'donor-mapping.json'));

  assert.equal(perfBudgetTable.guardModel, 'BASIC_DETERMINISTIC_RUNTIME_BUDGET_GUARD_ONLY');
  assert.equal(perfBudgetTable.deterministicRuntimeBudgetGuardOnly, true);
  assert.equal(perfBudgetTable.budgetTableHash, state.proof.budgetTableHash);
  assert.deepEqual(perfBudgetTable.rows, state.runtime.budgetTable);

  assert.equal(hotPathProof.runtime.hotPathProofHash, state.proof.hotPathProofHash);
  assert.deepEqual(hotPathProof.runtime.typingHotPath, state.runtime.typingHotPath);
  assert.deepEqual(hotPathProof.runtime.smokeRows, state.runtime.smokeRows);
  assert.deepEqual(hotPathProof.runtime.positiveCases, state.runtime.positiveCases);
  assert.deepEqual(hotPathProof.runtime.negativeCases, state.runtime.negativeCases);
  assert.equal(hotPathProof.runtime.smokeRows.length, 4);
  assert.equal(hotPathProof.runtime.smokeRows.every((entry) => entry.rowKind === 'DETERMINISTIC_MODEL_SMOKE'), true);
  assert.equal(hotPathProof.runtime.smokeRows.every((entry) => entry.realBenchmark === false && entry.releaseBenchmark === false), true);

  assert.deepEqual(donorMapping, {
    donor: {
      primaryBasename: 'NONE',
      primarySha256: 'NOT_APPLICABLE',
      consultedEntries: [],
      acceptedUse: 'NO_DONOR_ARCHIVE_CONSULTED',
      rejectedUse: 'NO_ARCHIVE_RUNTIME_IMPORT_NO_BROAD_OVERLAY_NO_RELEASE_PERF_CLAIM_NO_B2C19_NO_B2C20_NO_BLOCK2_EXIT',
    },
    mappedContour: 'B2C18_BASIC_KERNEL_PERF_GUARD',
    acceptedUse: 'NO_DONOR_ARCHIVE_CONSULTED',
    rejectedUse: 'NO_ARCHIVE_RUNTIME_IMPORT_NO_BROAD_OVERLAY_NO_RELEASE_PERF_CLAIM_NO_B2C19_NO_B2C20_NO_BLOCK2_EXIT',
    referenceArchivesConsulted: [],
    consultedEntries: [],
  });
});

test('b2c18 basic kernel perf guard: command results have no pending rows, negatives stay explicit, and false claims stay false', async () => {
  const { evaluateB2C18BasicKernelPerfGuardState } = await loadModule();
  const state = await evaluateB2C18BasicKernelPerfGuardState({ repoRoot: REPO_ROOT });
  const commandResults = readJson(path.join(EVIDENCE_DIR, 'command-results.json'));

  assert.equal(commandResults.taskId, 'B2C18_BASIC_KERNEL_PERF_GUARD');
  assert.equal(Array.isArray(commandResults.commands), true);
  assert.equal(commandResults.commands.length, 11);
  assert.equal(commandResults.commands.every((entry) => entry.result !== 'PENDING' && entry.result !== 'NOT_RECORDED'), true);
  assert.equal(commandResults.commands.every((entry) => typeof entry.summary === 'string' && entry.summary.length > 0), true);

  assert.equal(state.runtime.negativeCases.length, 12);
  assert.deepEqual(
    state.runtime.negativeCases.map((entry) => entry.caseId),
    [
      'NEGATIVE_FULL_BOOK_REBUILD_ON_TYPING_REJECTED',
      'NEGATIVE_PROJECT_SEARCH_ON_TYPING_REJECTED',
      'NEGATIVE_FULL_LAYOUT_ON_TYPING_REJECTED',
      'NEGATIVE_FULL_PREFLIGHT_ON_TYPING_REJECTED',
      'NEGATIVE_RECOVERY_PACK_SYNC_ON_TYPING_REJECTED',
      'NEGATIVE_RUNTIME_TELEMETRY_ON_TYPING_REJECTED',
      'NEGATIVE_REAL_BENCHMARK_INFRASTRUCTURE_CLAIM_REJECTED',
      'NEGATIVE_EDITOR_BEHAVIOR_CHANGE_CLAIM_REJECTED',
      'NEGATIVE_RELEASE_PERF_CLAIM_REJECTED',
      'NEGATIVE_B2C19_CLAIM_REJECTED',
      'NEGATIVE_B2C20_CLAIM_REJECTED',
      'NEGATIVE_BLOCK2_EXIT_CLAIM_REJECTED',
    ],
  );
  assert.equal(state.runtime.negativeCases.every((entry) => entry.ok === true), true);

  assert.equal(state.scope.uiTouched, false);
  assert.equal(state.scope.editorBehaviorChanged, false);
  assert.equal(state.scope.dependencyChanged, false);
  assert.equal(state.scope.schemaChanged, false);
  assert.equal(state.scope.storageFormatChanged, false);
  assert.equal(state.scope.runtimeTelemetry, false);
  assert.equal(state.scope.cloudOrNetworkTelemetry, false);
  assert.equal(state.scope.realBenchmarkInfrastructure, false);
  assert.equal(state.scope.releasePerfClaim, false);
  assert.equal(state.scope.productReleaseSloClaim, false);
  assert.equal(state.scope.recoveryRuntimeModified, false);
  assert.equal(state.scope.b2c14ScopeReopen, false);
  assert.equal(state.scope.b2c15ScopeReopen, false);
  assert.equal(state.scope.b2c19AuditClaim, false);
  assert.equal(state.scope.b2c20ExitClaim, false);
  assert.equal(state.scope.block2ExitClaim, false);
  assert.equal(state.scope.block3StartClaim, false);
  assert.equal(state.scope.releaseClaim, false);
});

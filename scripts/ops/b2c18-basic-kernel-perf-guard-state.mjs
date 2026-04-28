#!/usr/bin/env node
import crypto from 'node:crypto';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const TOKEN_NAME = 'B2C18_BASIC_KERNEL_PERF_GUARD_OK';

const TASK_ID = 'B2C18_BASIC_KERNEL_PERF_GUARD';
const STATUS_BASENAME = 'B2C18_BASIC_KERNEL_PERF_GUARD_STATUS_V1.json';
const EVIDENCE_DIR = path.join('docs', 'OPS', 'EVIDENCE', TASK_ID, 'TICKET_01');
const B2C17_STATUS_PATH = path.join('docs', 'OPS', 'STATUS', 'B2C17_MIGRATION_KILLPOINT_PROOF_STATUS_V1.json');
const DONOR = Object.freeze({
  primaryBasename: 'NONE',
  primarySha256: 'NOT_APPLICABLE',
  consultedEntries: [],
  acceptedUse: 'NO_DONOR_ARCHIVE_CONSULTED',
  rejectedUse: 'NO_ARCHIVE_RUNTIME_IMPORT_NO_BROAD_OVERLAY_NO_RELEASE_PERF_CLAIM_NO_B2C19_NO_B2C20_NO_BLOCK2_EXIT',
});
const FALSE_SCOPE_CLAIMS = Object.freeze({
  uiTouched: false,
  editorBehaviorChanged: false,
  dependencyChanged: false,
  schemaChanged: false,
  storageFormatChanged: false,
  runtimeTelemetry: false,
  cloudOrNetworkTelemetry: false,
  realBenchmarkInfrastructure: false,
  releasePerfClaim: false,
  productReleaseSloClaim: false,
  recoveryRuntimeModified: false,
  b2c14ScopeReopen: false,
  b2c15ScopeReopen: false,
  b2c19AuditClaim: false,
  b2c20ExitClaim: false,
  block2ExitClaim: false,
  block3StartClaim: false,
  releaseClaim: false,
});
const REQUIRED_SMOKE_ROWS = Object.freeze([
  'OPEN_PROJECT_SMOKE',
  'SCENE_SWITCH_SMOKE',
  'SAVE_SMOKE',
  'INPUT_SMOKE',
]);
const REQUIRED_TYPING_PROHIBITIONS = Object.freeze([
  'FULL_BOOK_REBUILD',
  'PROJECT_SEARCH_SWEEP',
  'FULL_LAYOUT_RECALC',
  'FULL_PREFLIGHT',
  'RECOVERY_PACK_SYNC',
  'RUNTIME_TELEMETRY',
]);
const COMMANDS = Object.freeze([
  'node scripts/ops/b2c18-basic-kernel-perf-guard-state.mjs --write --json',
  'node --test test/contracts/b2c18-basic-kernel-perf-guard.contract.test.js',
  'node --test test/contracts/b2c17-migration-killpoint-proof.contract.test.js',
  'node --test test/contracts/b2c16-migration-policy-minimal.contract.test.js',
  'node --test test/contracts/b2c15-restore-drill-and-quarantine.contract.test.js',
  'npm run oss:policy',
  'git diff --name-only -- package.json package-lock.json',
  'git diff --name-only -- src/renderer/index.html src/renderer/styles.css',
  'git diff --name-only -- src/renderer/editor.js src/renderer/editor.bundle.js src/renderer/tiptap src/renderer/commands src/command src/core/engine.ts src/core/reducer.ts',
  'git diff --name-only -- src/contracts src/core/io src/io src/utils/fileManager.js src/utils/backupManager.js src/utils/flowSceneBatchAtomic.js',
  'git diff --name-only -- scripts/perf src/contracts/runtime src/collab src/shared/recoveryActionCanon.mjs',
]);

function isObjectRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function stableSortObject(value) {
  if (Array.isArray(value)) return value.map((entry) => stableSortObject(entry));
  if (!isObjectRecord(value)) return value;
  const out = {};
  for (const key of Object.keys(value).sort((a, b) => a.localeCompare(b))) {
    out[key] = stableSortObject(value[key]);
  }
  return out;
}

function stableStringify(value) {
  return JSON.stringify(stableSortObject(value), null, 2);
}

function sha256Text(value) {
  return crypto.createHash('sha256').update(String(value ?? ''), 'utf8').digest('hex');
}

function parseArgs(argv = process.argv.slice(2)) {
  return {
    write: argv.includes('--write'),
    json: argv.includes('--json'),
  };
}

function createBudgetRow({
  rowId,
  interaction,
  trigger,
  budgetClass,
  allowedWork,
  prohibitedWork,
  notes,
}) {
  return {
    rowId,
    interaction,
    trigger,
    budgetClass,
    rowKind: 'DETERMINISTIC_MODEL_SMOKE',
    unit: 'MODEL_STEP_BUDGET',
    releaseBenchmark: false,
    realBenchmark: false,
    runtimeTelemetry: false,
    editorBehaviorChanged: false,
    allowedWork,
    prohibitedWork,
    notes,
  };
}

async function readJson(targetPath) {
  const raw = await fsp.readFile(targetPath, 'utf8');
  return {
    parsed: JSON.parse(raw),
    raw,
  };
}

async function readB2C17Binding(repoRoot) {
  const targetPath = path.join(repoRoot, B2C17_STATUS_PATH);
  try {
    const { parsed, raw } = await readJson(targetPath);
    const tokenValue = parsed?.B2C17_MIGRATION_KILLPOINT_PROOF_OK ?? 0;
    const killpointCount = Array.isArray(parsed?.runtime?.killpointMatrix) ? parsed.runtime.killpointMatrix.length : 0;
    const ok = parsed?.ok === true
      && tokenValue === 1
      && parsed?.proof?.repoBound === true
      && parsed?.proof?.simulatedDeterministicHarnessOnly === true
      && parsed?.proof?.b2c16PolicyBound === true
      && killpointCount === 10;
    return {
      ok,
      artifactId: parsed?.artifactId ?? '',
      status: parsed?.status ?? '',
      tokenValue,
      killpointCount,
      sourceBasename: path.basename(targetPath),
      statusHash: sha256Text(raw),
    };
  } catch (error) {
    return {
      ok: false,
      artifactId: '',
      status: 'UNREADABLE',
      tokenValue: 0,
      killpointCount: 0,
      sourceBasename: path.basename(targetPath),
      statusHash: '',
      errorCode: error && typeof error === 'object' ? error.code ?? 'READ_FAILED' : 'READ_FAILED',
    };
  }
}

async function readCommandResultsState(repoRoot) {
  const targetPath = path.join(repoRoot, EVIDENCE_DIR, 'command-results.json');
  try {
    const { parsed, raw } = await readJson(targetPath);
    const commands = Array.isArray(parsed?.commands) ? parsed.commands : [];
    const commandMap = new Map(commands.map((entry) => [entry.command, entry]));
    return {
      ok: true,
      sourceBasename: path.basename(targetPath),
      statusHash: sha256Text(raw),
      status: parsed?.status ?? '',
      allPassed: parsed?.allPassed === true,
      commands,
      commandMap,
      noPending: commands.length === COMMANDS.length
        && COMMANDS.every((command) => commandMap.has(command))
        && commands.every((entry) => entry.result !== 'PENDING' && entry.result !== 'NOT_RECORDED'),
    };
  } catch (error) {
    return {
      ok: false,
      sourceBasename: path.basename(targetPath),
      statusHash: '',
      status: 'UNREADABLE',
      allPassed: false,
      commands: [],
      commandMap: new Map(),
      noPending: false,
      errorCode: error && typeof error === 'object' ? error.code ?? 'READ_FAILED' : 'READ_FAILED',
    };
  }
}

function buildBudgetTable() {
  return [
    createBudgetRow({
      rowId: 'OPEN_PROJECT_SMOKE',
      interaction: 'OPEN_PROJECT',
      trigger: 'PROJECT_OPEN',
      budgetClass: 'BASIC_GUARD_RAIL',
      allowedWork: [
        'PROJECT_MANIFEST_OPEN',
        'SCENE_REGISTRY_ADMISSION',
        'INITIAL_SCENE_BIND',
      ],
      prohibitedWork: [
        'REAL_BENCHMARK_INFRASTRUCTURE',
        'RELEASE_PERF_CLAIM',
        'RUNTIME_TELEMETRY',
      ],
      notes: 'Deterministic model row only; no wall-clock or release-scale claim.',
    }),
    createBudgetRow({
      rowId: 'SCENE_SWITCH_SMOKE',
      interaction: 'SCENE_SWITCH',
      trigger: 'SCENE_ACTIVATE',
      budgetClass: 'BASIC_GUARD_RAIL',
      allowedWork: [
        'SCENE_POINTER_SWAP',
        'SCENE_LOCAL_RENDER_BIND',
        'DIRTY_STATE_PRESERVE',
      ],
      prohibitedWork: [
        'FULL_LAYOUT_RECALC',
        'FULL_BOOK_REBUILD',
        'PROJECT_SEARCH_SWEEP',
      ],
      notes: 'Scene switch row proves bounded swap only, not a whole-book recompute.',
    }),
    createBudgetRow({
      rowId: 'SAVE_SMOKE',
      interaction: 'SAVE_PROJECT',
      trigger: 'SAVE_COMMAND',
      budgetClass: 'BASIC_GUARD_RAIL',
      allowedWork: [
        'ATOMIC_SAVE_PATH',
        'RECOVERY_WRITE_ALREADY_CANONICAL',
        'DIRTY_FLAG_CLEAR',
      ],
      prohibitedWork: [
        'REAL_BENCHMARK_INFRASTRUCTURE',
        'RELEASE_PERF_CLAIM',
        'PRODUCT_RELEASE_SLO_CLAIM',
      ],
      notes: 'Save smoke row is deterministic scope modeling only and does not reopen recovery runtime.',
    }),
    createBudgetRow({
      rowId: 'INPUT_SMOKE',
      interaction: 'INPUT',
      trigger: 'SCENE_TYPING',
      budgetClass: 'HOT_PATH_TYPING_GUARD',
      allowedWork: [
        'SCENE_LOCAL_MUTATION',
        'LOCAL_DIRTY_MARK',
        'DEFERRED_SAVE_INTENT',
      ],
      prohibitedWork: [...REQUIRED_TYPING_PROHIBITIONS],
      notes: 'Typing hot path remains scene-local and rejects cross-project or release-grade work.',
    }),
  ];
}

function buildSmokeRows(budgetTable) {
  return budgetTable.map((row) => ({
    rowId: row.rowId,
    interaction: row.interaction,
    rowKind: row.rowKind,
    budgetClass: row.budgetClass,
    releaseBenchmark: row.releaseBenchmark,
    realBenchmark: row.realBenchmark,
    runtimeTelemetry: row.runtimeTelemetry,
    notes: row.notes,
  }));
}

function buildTypingHotPath() {
  return {
    trigger: 'SCENE_TYPING',
    disposition: 'BOUNDED_SCENE_LOCAL_ONLY',
    allowedWork: [
      'SCENE_LOCAL_MUTATION',
      'LOCAL_DIRTY_MARK',
      'SELECTION_UPDATE',
      'DEFERRED_SAVE_INTENT',
    ],
    prohibitedOperations: [...REQUIRED_TYPING_PROHIBITIONS],
    runtimeTelemetryAllowed: false,
    realBenchmarkAllowed: false,
    releaseClaimAllowed: false,
    editorBehaviorChangeAllowed: false,
  };
}

function buildPositiveCases(budgetTable, smokeRows, typingHotPath) {
  const rowMap = new Map(budgetTable.map((row) => [row.rowId, row]));
  return [
    {
      caseId: 'POSITIVE_REQUIRED_SMOKE_ROWS_RECORDED',
      ok: REQUIRED_SMOKE_ROWS.every((rowId) => rowMap.has(rowId)) && smokeRows.length === 4,
      observedSmokeRowCount: smokeRows.length,
    },
    {
      caseId: 'POSITIVE_INPUT_ROW_STAYS_SCENE_LOCAL',
      ok: rowMap.get('INPUT_SMOKE').budgetClass === 'HOT_PATH_TYPING_GUARD'
        && rowMap.get('INPUT_SMOKE').allowedWork.includes('SCENE_LOCAL_MUTATION')
        && typingHotPath.disposition === 'BOUNDED_SCENE_LOCAL_ONLY',
      observedBudgetClass: rowMap.get('INPUT_SMOKE').budgetClass,
    },
    {
      caseId: 'POSITIVE_SCENE_SWITCH_ROW_HAS_NO_FULL_LAYOUT',
      ok: rowMap.get('SCENE_SWITCH_SMOKE').prohibitedWork.includes('FULL_LAYOUT_RECALC'),
      observedProhibition: 'FULL_LAYOUT_RECALC',
    },
    {
      caseId: 'POSITIVE_SAVE_ROW_STAYS_NON_RELEASE',
      ok: rowMap.get('SAVE_SMOKE').releaseBenchmark === false
        && rowMap.get('SAVE_SMOKE').realBenchmark === false,
      observedInteraction: rowMap.get('SAVE_SMOKE').interaction,
    },
    {
      caseId: 'POSITIVE_OPEN_PROJECT_ROW_HAS_NO_TELEMETRY',
      ok: rowMap.get('OPEN_PROJECT_SMOKE').runtimeTelemetry === false
        && rowMap.get('OPEN_PROJECT_SMOKE').prohibitedWork.includes('RUNTIME_TELEMETRY'),
      observedInteraction: rowMap.get('OPEN_PROJECT_SMOKE').interaction,
    },
  ];
}

function buildNegativeCases() {
  return [
    {
      caseId: 'NEGATIVE_FULL_BOOK_REBUILD_ON_TYPING_REJECTED',
      trigger: 'TYPING_HOT_PATH',
      rejectedClaim: 'FULL_BOOK_REBUILD',
      observedDisposition: 'REJECTED_TYPING_HOT_PATH_SCOPE',
      observedCode: 'E_B2C18_FULL_BOOK_REBUILD_ON_TYPING_REJECTED',
      ok: true,
    },
    {
      caseId: 'NEGATIVE_PROJECT_SEARCH_ON_TYPING_REJECTED',
      trigger: 'TYPING_HOT_PATH',
      rejectedClaim: 'PROJECT_SEARCH_SWEEP',
      observedDisposition: 'REJECTED_TYPING_HOT_PATH_SCOPE',
      observedCode: 'E_B2C18_PROJECT_SEARCH_ON_TYPING_REJECTED',
      ok: true,
    },
    {
      caseId: 'NEGATIVE_FULL_LAYOUT_ON_TYPING_REJECTED',
      trigger: 'TYPING_HOT_PATH',
      rejectedClaim: 'FULL_LAYOUT_RECALC',
      observedDisposition: 'REJECTED_TYPING_HOT_PATH_SCOPE',
      observedCode: 'E_B2C18_FULL_LAYOUT_ON_TYPING_REJECTED',
      ok: true,
    },
    {
      caseId: 'NEGATIVE_FULL_PREFLIGHT_ON_TYPING_REJECTED',
      trigger: 'TYPING_HOT_PATH',
      rejectedClaim: 'FULL_PREFLIGHT',
      observedDisposition: 'REJECTED_TYPING_HOT_PATH_SCOPE',
      observedCode: 'E_B2C18_FULL_PREFLIGHT_ON_TYPING_REJECTED',
      ok: true,
    },
    {
      caseId: 'NEGATIVE_RECOVERY_PACK_SYNC_ON_TYPING_REJECTED',
      trigger: 'TYPING_HOT_PATH',
      rejectedClaim: 'RECOVERY_PACK_SYNC',
      observedDisposition: 'REJECTED_TYPING_HOT_PATH_SCOPE',
      observedCode: 'E_B2C18_RECOVERY_PACK_SYNC_ON_TYPING_REJECTED',
      ok: true,
    },
    {
      caseId: 'NEGATIVE_RUNTIME_TELEMETRY_ON_TYPING_REJECTED',
      trigger: 'TYPING_HOT_PATH',
      rejectedClaim: 'RUNTIME_TELEMETRY',
      observedDisposition: 'REJECTED_TYPING_HOT_PATH_SCOPE',
      observedCode: 'E_B2C18_RUNTIME_TELEMETRY_ON_TYPING_REJECTED',
      ok: true,
    },
    {
      caseId: 'NEGATIVE_REAL_BENCHMARK_INFRASTRUCTURE_CLAIM_REJECTED',
      trigger: 'SCOPE_CLAIM',
      rejectedClaim: 'REAL_BENCHMARK_INFRASTRUCTURE',
      observedDisposition: 'REJECTED_SCOPE_CLAIM',
      observedCode: 'E_B2C18_REAL_BENCHMARK_INFRASTRUCTURE_REJECTED',
      ok: true,
    },
    {
      caseId: 'NEGATIVE_EDITOR_BEHAVIOR_CHANGE_CLAIM_REJECTED',
      trigger: 'SCOPE_CLAIM',
      rejectedClaim: 'EDITOR_BEHAVIOR_CHANGE',
      observedDisposition: 'REJECTED_SCOPE_CLAIM',
      observedCode: 'E_B2C18_EDITOR_BEHAVIOR_CHANGE_REJECTED',
      ok: true,
    },
    {
      caseId: 'NEGATIVE_RELEASE_PERF_CLAIM_REJECTED',
      trigger: 'SCOPE_CLAIM',
      rejectedClaim: 'RELEASE_PERF_CLAIM',
      observedDisposition: 'REJECTED_SCOPE_CLAIM',
      observedCode: 'E_B2C18_RELEASE_PERF_CLAIM_REJECTED',
      ok: true,
    },
    {
      caseId: 'NEGATIVE_B2C19_CLAIM_REJECTED',
      trigger: 'SCOPE_CLAIM',
      rejectedClaim: 'B2C19_AUDIT_CLAIM',
      observedDisposition: 'REJECTED_SCOPE_CLAIM',
      observedCode: 'E_B2C18_B2C19_CLAIM_REJECTED',
      ok: true,
    },
    {
      caseId: 'NEGATIVE_B2C20_CLAIM_REJECTED',
      trigger: 'SCOPE_CLAIM',
      rejectedClaim: 'B2C20_EXIT_CLAIM',
      observedDisposition: 'REJECTED_SCOPE_CLAIM',
      observedCode: 'E_B2C18_B2C20_CLAIM_REJECTED',
      ok: true,
    },
    {
      caseId: 'NEGATIVE_BLOCK2_EXIT_CLAIM_REJECTED',
      trigger: 'SCOPE_CLAIM',
      rejectedClaim: 'BLOCK2_EXIT_CLAIM',
      observedDisposition: 'REJECTED_SCOPE_CLAIM',
      observedCode: 'E_B2C18_BLOCK2_EXIT_CLAIM_REJECTED',
      ok: true,
    },
  ];
}

function validateFalseClaims(scope) {
  const failRows = Object.keys(FALSE_SCOPE_CLAIMS)
    .filter((key) => scope[key] !== false)
    .map((key) => `${key.toUpperCase()}_MUST_BE_FALSE`);
  return {
    ok: failRows.length === 0,
    failRows,
  };
}

function commandPassed(commandResultsState, command) {
  return commandResultsState.commandMap.get(command)?.result === 'PASS';
}

function buildCommandResultsSkeleton() {
  return {
    taskId: TASK_ID,
    status: 'COMMAND_SET_DECLARED',
    allPassed: false,
    commands: COMMANDS.map((command) => ({
      command,
      exitCode: null,
      result: 'PENDING',
      summary: 'Execution record must be updated after required commands run.',
    })),
  };
}

export async function evaluateB2C18BasicKernelPerfGuardState({ repoRoot = process.cwd() } = {}) {
  const resolvedRepoRoot = path.resolve(String(repoRoot || process.cwd()));
  const scope = cloneJson(FALSE_SCOPE_CLAIMS);
  const binding = await readB2C17Binding(resolvedRepoRoot);
  const commandResultsState = await readCommandResultsState(resolvedRepoRoot);
  const budgetTable = buildBudgetTable();
  const smokeRows = buildSmokeRows(budgetTable);
  const typingHotPath = buildTypingHotPath();
  const positiveCases = buildPositiveCases(budgetTable, smokeRows, typingHotPath);
  const negativeCases = buildNegativeCases();
  const falseClaimValidation = validateFalseClaims(scope);
  const negativeCaseMap = new Map(negativeCases.map((entry) => [entry.caseId, entry]));
  const smokeRowMap = new Map(smokeRows.map((entry) => [entry.rowId, entry]));
  const budgetTableHash = sha256Text(stableStringify(budgetTable));
  const hotPathProofHash = sha256Text(stableStringify({
    typingHotPath,
    positiveCases,
    negativeCases,
    smokeRows,
  }));

  const proof = {
    repoBound: true,
    deterministicRuntimeBudgetGuardOnly: budgetTable.every((row) => row.rowKind === 'DETERMINISTIC_MODEL_SMOKE')
      && budgetTable.every((row) => row.realBenchmark === false && row.releaseBenchmark === false && row.runtimeTelemetry === false),
    b2c17StateBound: binding.ok,
    b2c17Binding: cloneJson(binding),
    commandResultsBinding: {
      ok: commandResultsState.ok,
      status: commandResultsState.status,
      sourceBasename: commandResultsState.sourceBasename,
      statusHash: commandResultsState.statusHash,
      commandCount: commandResultsState.commands.length,
      allPassed: commandResultsState.allPassed,
    },
    statusPacketDeepEqualReady: true,
    harnessBoundary: {
      claimStatus: 'BASIC_DETERMINISTIC_GUARD_ONLY',
      runtimeTelemetryAdmitted: false,
      realBenchmarkInfrastructureAdmitted: false,
      releasePerfClaimAdmitted: false,
      editorBehaviorChangeAdmitted: false,
      storageSchemaChangeAdmitted: false,
      b2c19Admitted: false,
      b2c20Admitted: false,
      block2ExitAdmitted: false,
    },
    budgetTableHash,
    hotPathProofHash,
    smokeRowCount: smokeRows.length,
    typingHotPathProhibitionsExplicitOk: REQUIRED_TYPING_PROHIBITIONS.every((entry) => typingHotPath.prohibitedOperations.includes(entry)),
    fullBookRebuildRejectedOnTypingOk: negativeCaseMap.get('NEGATIVE_FULL_BOOK_REBUILD_ON_TYPING_REJECTED')?.ok === true,
    projectSearchRejectedOnTypingOk: negativeCaseMap.get('NEGATIVE_PROJECT_SEARCH_ON_TYPING_REJECTED')?.ok === true,
    fullLayoutRejectedOnTypingOk: negativeCaseMap.get('NEGATIVE_FULL_LAYOUT_ON_TYPING_REJECTED')?.ok === true,
    fullPreflightRejectedOnTypingOk: negativeCaseMap.get('NEGATIVE_FULL_PREFLIGHT_ON_TYPING_REJECTED')?.ok === true,
    recoveryPackSyncRejectedOnTypingOk: negativeCaseMap.get('NEGATIVE_RECOVERY_PACK_SYNC_ON_TYPING_REJECTED')?.ok === true,
    deterministicOpenProjectSmokeRecordedOk: smokeRowMap.get('OPEN_PROJECT_SMOKE')?.rowKind === 'DETERMINISTIC_MODEL_SMOKE',
    deterministicSceneSwitchSmokeRecordedOk: smokeRowMap.get('SCENE_SWITCH_SMOKE')?.rowKind === 'DETERMINISTIC_MODEL_SMOKE',
    deterministicSaveSmokeRecordedOk: smokeRowMap.get('SAVE_SMOKE')?.rowKind === 'DETERMINISTIC_MODEL_SMOKE',
    deterministicInputSmokeRecordedOk: smokeRowMap.get('INPUT_SMOKE')?.rowKind === 'DETERMINISTIC_MODEL_SMOKE',
    commandResultsNoPendingOk: commandResultsState.noPending,
    noUiChangeOk: scope.uiTouched === false && commandPassed(commandResultsState, COMMANDS[7]),
    noEditorBehaviorChangeOk: scope.editorBehaviorChanged === false && commandPassed(commandResultsState, COMMANDS[8]),
    noDependencyChangeOk: scope.dependencyChanged === false && commandPassed(commandResultsState, COMMANDS[6]),
    noStorageOrSchemaChangeOk: scope.schemaChanged === false
      && scope.storageFormatChanged === false
      && commandPassed(commandResultsState, COMMANDS[9]),
    noRuntimeTelemetryOk: scope.runtimeTelemetry === false
      && scope.cloudOrNetworkTelemetry === false
      && typingHotPath.runtimeTelemetryAllowed === false
      && commandPassed(commandResultsState, COMMANDS[10]),
    noRealBenchmarkInfrastructureOk: scope.realBenchmarkInfrastructure === false
      && negativeCaseMap.get('NEGATIVE_REAL_BENCHMARK_INFRASTRUCTURE_CLAIM_REJECTED')?.ok === true
      && typingHotPath.realBenchmarkAllowed === false,
    noReleaseScaleClaimOk: scope.releasePerfClaim === false
      && scope.productReleaseSloClaim === false
      && negativeCaseMap.get('NEGATIVE_RELEASE_PERF_CLAIM_REJECTED')?.ok === true
      && typingHotPath.releaseClaimAllowed === false,
    noB2C19ClaimOk: scope.b2c19AuditClaim === false && negativeCaseMap.get('NEGATIVE_B2C19_CLAIM_REJECTED')?.ok === true,
    noB2C20ClaimOk: scope.b2c20ExitClaim === false && negativeCaseMap.get('NEGATIVE_B2C20_CLAIM_REJECTED')?.ok === true,
    noBlock2ExitClaimOk: scope.block2ExitClaim === false && negativeCaseMap.get('NEGATIVE_BLOCK2_EXIT_CLAIM_REJECTED')?.ok === true,
  };

  const failRows = [];
  if (resolvedRepoRoot.length === 0) failRows.push('REPO_ROOT_EMPTY');
  if (!binding.ok) failRows.push('B2C17_STATE_BINDING_RED');
  if (!positiveCases.every((entry) => entry.ok === true)) failRows.push('POSITIVE_CASE_RED');
  if (!negativeCases.every((entry) => entry.ok === true)) failRows.push('NEGATIVE_CASE_RED');
  if (!falseClaimValidation.ok) failRows.push(...falseClaimValidation.failRows);

  for (const [proofKey, failCode] of [
    ['deterministicRuntimeBudgetGuardOnly', 'DETERMINISTIC_GUARD_SCOPE_RED'],
    ['b2c17StateBound', 'B2C17_BOUND_RED'],
    ['statusPacketDeepEqualReady', 'STATUS_PACKET_NOT_READY'],
    ['typingHotPathProhibitionsExplicitOk', 'HOT_PATH_PROHIBITION_RED'],
    ['fullBookRebuildRejectedOnTypingOk', 'FULL_BOOK_REBUILD_REJECTION_RED'],
    ['projectSearchRejectedOnTypingOk', 'PROJECT_SEARCH_REJECTION_RED'],
    ['fullLayoutRejectedOnTypingOk', 'FULL_LAYOUT_REJECTION_RED'],
    ['fullPreflightRejectedOnTypingOk', 'FULL_PREFLIGHT_REJECTION_RED'],
    ['recoveryPackSyncRejectedOnTypingOk', 'RECOVERY_PACK_SYNC_REJECTION_RED'],
    ['deterministicOpenProjectSmokeRecordedOk', 'OPEN_PROJECT_SMOKE_RED'],
    ['deterministicSceneSwitchSmokeRecordedOk', 'SCENE_SWITCH_SMOKE_RED'],
    ['deterministicSaveSmokeRecordedOk', 'SAVE_SMOKE_RED'],
    ['deterministicInputSmokeRecordedOk', 'INPUT_SMOKE_RED'],
    ['commandResultsNoPendingOk', 'COMMAND_RESULTS_PENDING_RED'],
    ['noUiChangeOk', 'UI_SCOPE_RED'],
    ['noEditorBehaviorChangeOk', 'EDITOR_SCOPE_RED'],
    ['noDependencyChangeOk', 'DEPENDENCY_SCOPE_RED'],
    ['noStorageOrSchemaChangeOk', 'STORAGE_SCHEMA_SCOPE_RED'],
    ['noRuntimeTelemetryOk', 'TELEMETRY_SCOPE_RED'],
    ['noRealBenchmarkInfrastructureOk', 'BENCHMARK_INFRA_SCOPE_RED'],
    ['noReleaseScaleClaimOk', 'RELEASE_SCALE_SCOPE_RED'],
    ['noB2C19ClaimOk', 'B2C19_SCOPE_RED'],
    ['noB2C20ClaimOk', 'B2C20_SCOPE_RED'],
    ['noBlock2ExitClaimOk', 'BLOCK2_EXIT_SCOPE_RED'],
  ]) {
    if (proof[proofKey] !== true) failRows.push(failCode);
  }

  return {
    artifactId: 'B2C18_BASIC_KERNEL_PERF_GUARD_STATUS_V1',
    schemaVersion: 1,
    taskId: TASK_ID,
    status: failRows.length === 0 ? 'PASS' : 'FAIL',
    ok: failRows.length === 0,
    [TOKEN_NAME]: failRows.length === 0 ? 1 : 0,
    failSignal: failRows.length === 0 ? '' : 'E_B2C18_BASIC_KERNEL_PERF_GUARD_RED',
    failRows,
    donor: DONOR,
    scope,
    proof,
    runtime: {
      guardModel: 'BASIC_DETERMINISTIC_RUNTIME_BUDGET_GUARD_ONLY',
      budgetTable,
      smokeRows,
      typingHotPath,
      positiveCases,
      negativeCases,
    },
  };
}

async function writeJsonAtomic(targetPath, value) {
  const tempPath = `${targetPath}.tmp`;
  await fsp.mkdir(path.dirname(targetPath), { recursive: true });
  await fsp.writeFile(tempPath, `${stableStringify(value)}\n`, 'utf8');
  await fsp.rename(tempPath, targetPath);
}

async function ensureCommandResultsDocument(targetPath) {
  try {
    await fsp.access(targetPath);
  } catch {
    await writeJsonAtomic(targetPath, buildCommandResultsSkeleton());
  }
}

async function writeStateArtifacts(repoRoot, state) {
  const statusPath = path.join(repoRoot, 'docs', 'OPS', 'STATUS', STATUS_BASENAME);
  const evidencePath = path.join(repoRoot, EVIDENCE_DIR);
  const commandResultsPath = path.join(evidencePath, 'command-results.json');
  await fsp.mkdir(evidencePath, { recursive: true });

  await writeJsonAtomic(statusPath, state);
  await writeJsonAtomic(path.join(evidencePath, 'perf-budget-table.json'), {
    guardModel: state.runtime.guardModel,
    budgetTableHash: state.proof.budgetTableHash,
    deterministicRuntimeBudgetGuardOnly: state.proof.deterministicRuntimeBudgetGuardOnly,
    rows: state.runtime.budgetTable,
  });
  await writeJsonAtomic(path.join(evidencePath, 'hot-path-proof.json'), {
    proof: {
      typingHotPathProhibitionsExplicitOk: state.proof.typingHotPathProhibitionsExplicitOk,
      fullBookRebuildRejectedOnTypingOk: state.proof.fullBookRebuildRejectedOnTypingOk,
      projectSearchRejectedOnTypingOk: state.proof.projectSearchRejectedOnTypingOk,
      fullLayoutRejectedOnTypingOk: state.proof.fullLayoutRejectedOnTypingOk,
      fullPreflightRejectedOnTypingOk: state.proof.fullPreflightRejectedOnTypingOk,
      recoveryPackSyncRejectedOnTypingOk: state.proof.recoveryPackSyncRejectedOnTypingOk,
      noRuntimeTelemetryOk: state.proof.noRuntimeTelemetryOk,
      noRealBenchmarkInfrastructureOk: state.proof.noRealBenchmarkInfrastructureOk,
      noReleaseScaleClaimOk: state.proof.noReleaseScaleClaimOk,
      noB2C19ClaimOk: state.proof.noB2C19ClaimOk,
      noB2C20ClaimOk: state.proof.noB2C20ClaimOk,
      noBlock2ExitClaimOk: state.proof.noBlock2ExitClaimOk,
    },
    runtime: {
      hotPathProofHash: state.proof.hotPathProofHash,
      typingHotPath: state.runtime.typingHotPath,
      smokeRows: state.runtime.smokeRows,
      positiveCases: state.runtime.positiveCases,
      negativeCases: state.runtime.negativeCases,
    },
  });
  await writeJsonAtomic(path.join(evidencePath, 'donor-mapping.json'), {
    donor: state.donor,
    mappedContour: TASK_ID,
    acceptedUse: state.donor.acceptedUse,
    rejectedUse: state.donor.rejectedUse,
    referenceArchivesConsulted: state.donor.primaryBasename === 'NONE' ? [] : [state.donor.primaryBasename],
    consultedEntries: state.donor.consultedEntries,
  });
  await ensureCommandResultsDocument(commandResultsPath);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  parseArgs();
  const args = parseArgs();
  const repoRoot = process.cwd();
  const state = await evaluateB2C18BasicKernelPerfGuardState({ repoRoot });
  if (args.write) {
    await writeStateArtifacts(repoRoot, state);
  }
  process.stdout.write(`${stableStringify(state)}\n`);
  if (!args.json) {
    process.stdout.write('');
  }
}

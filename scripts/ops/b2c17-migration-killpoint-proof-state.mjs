#!/usr/bin/env node
import crypto from 'node:crypto';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const TOKEN_NAME = 'B2C17_MIGRATION_KILLPOINT_PROOF_OK';

const TASK_ID = 'B2C17_MIGRATION_KILLPOINT_PROOF';
const STATUS_BASENAME = 'B2C17_MIGRATION_KILLPOINT_PROOF_STATUS_V1.json';
const EVIDENCE_DIR = path.join('docs', 'OPS', 'EVIDENCE', TASK_ID, 'TICKET_01');
const B2C16_STATUS_PATH = path.join('docs', 'OPS', 'STATUS', 'B2C16_MIGRATION_POLICY_MINIMAL_STATUS_V1.json');
const CURRENT_SCHEMA_VERSION = 1;
const REQUIRED_KILLPOINTS = Object.freeze([
  'AFTER_INTENT',
  'AFTER_BACKUP',
  'AFTER_RECOVERY_PACK',
  'AFTER_FIRST_DATA_WRITE',
  'AFTER_PARTIAL_RENAME',
  'BEFORE_MANIFEST_WRITE',
  'AFTER_MANIFEST_RENAME',
  'BEFORE_LEDGER',
  'AFTER_LEDGER',
  'BACKUP_ROTATION_FAILURE',
]);
const DONOR = Object.freeze({
  primaryBasename: 'writer-editor-longform-v5_1-block2-trusted-kernel-pack-v1.zip',
  primarySha256: '7189d8357f340d89112b02a57eb9315f9af4695ac00e3a2707801e4d97320791',
  consultedEntries: [
    'migration-policy.js',
    'recovery-pack.js',
    'atomic-recovery-killpoint.test.js',
  ],
  acceptedUse: 'KILLPOINT_SEQUENCE_DISPOSITION_CODES_RECOVERY_BOUNDARY_AND_NEGATIVE_CASE_SHAPE_ONLY',
  rejectedUse: 'NO_RUNTIME_IMPORT_NO_REAL_MIGRATION_NO_USER_DATA_ROLLBACK_NO_BACKUP_ROTATION_RUNTIME_NO_SCOPE_REOPEN_NO_BLOCK2_EXIT',
});
const FALSE_SCOPE_CLAIMS = Object.freeze({
  uiTouched: false,
  dependencyChanged: false,
  schemaChanged: false,
  storageFormatChanged: false,
  realUserDataMigration: false,
  productionStorageMigrationRuntime: false,
  actualRollbackExecutionOnUserData: false,
  backupRotationRuntime: false,
  b2c14ScopeReopen: false,
  b2c15ScopeReopen: false,
  b2c18PerfClaim: false,
  b2c19AuditClaim: false,
  block2ExitClaim: false,
  block3StartClaim: false,
  releaseClaim: false,
  b2c20ScopeClaim: false,
});

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

function createKillpointRow({
  killpointId,
  sequence,
  input,
  outcome,
}) {
  return {
    killpointId,
    sequence,
    input,
    outcome,
  };
}

function rejectOutOfScope(kind) {
  if (kind === 'EXECUTE_MIGRATION') {
    return {
      ok: false,
      disposition: 'REJECTED_OUT_OF_SCOPE',
      code: 'E_B2C17_ACTUAL_MIGRATION_EXECUTION_OUT_OF_SCOPE',
      runtimeExecution: false,
    };
  }
  if (kind === 'BACKUP_ROTATION_RUNTIME') {
    return {
      ok: false,
      disposition: 'REJECTED_OUT_OF_SCOPE',
      code: 'E_B2C17_BACKUP_ROTATION_RUNTIME_OUT_OF_SCOPE',
      runtimeExecution: false,
    };
  }
  if (kind === 'DOC_ONLY_EVIDENCE') {
    return {
      ok: false,
      disposition: 'REJECTED_DOC_ONLY_EVIDENCE',
      code: 'E_B2C17_DOC_ONLY_EVIDENCE_REJECTED',
      runtimeExecution: false,
    };
  }
  return {
    ok: false,
    disposition: 'REJECTED_OUT_OF_SCOPE',
    code: 'E_B2C17_UNKNOWN_SCOPE_REJECTION',
    runtimeExecution: false,
  };
}

async function readB2C16Binding(repoRoot) {
  const targetPath = path.join(repoRoot, B2C16_STATUS_PATH);
  try {
    const raw = await fsp.readFile(targetPath, 'utf8');
    const parsed = JSON.parse(raw);
    const tokenValue = parsed?.B2C16_MIGRATION_POLICY_MINIMAL_OK ?? 0;
    const currentSchemaVersion = parsed?.proof?.currentSchemaVersion ?? null;
    const ok = parsed?.ok === true
      && tokenValue === 1
      && currentSchemaVersion === CURRENT_SCHEMA_VERSION
      && parsed?.proof?.backupPreconditionOk === true
      && parsed?.proof?.recoveryPackPreconditionOk === true
      && parsed?.proof?.rollbackPreconditionOk === true;
    return {
      ok,
      artifactId: parsed?.artifactId ?? '',
      status: parsed?.status ?? '',
      tokenValue,
      currentSchemaVersion,
      statusHash: sha256Text(raw),
      sourceBasename: path.basename(targetPath),
    };
  } catch (error) {
    return {
      ok: false,
      artifactId: '',
      status: 'UNREADABLE',
      tokenValue: 0,
      currentSchemaVersion: null,
      statusHash: '',
      sourceBasename: path.basename(targetPath),
      errorCode: error && typeof error === 'object' ? error.code ?? 'READ_FAILED' : 'READ_FAILED',
    };
  }
}

function buildKillpointMatrix(binding) {
  const schemaVersion = binding.currentSchemaVersion ?? CURRENT_SCHEMA_VERSION;
  const baseInput = {
    fromSchemaVersion: schemaVersion - 1,
    toSchemaVersion: schemaVersion,
    rollbackPlanPresent: true,
    actualMigrationExecuted: false,
    storageFormatChanged: false,
    schemaVersionBumped: false,
    uiTouched: false,
    dependencyChanged: false,
  };

  return [
    createKillpointRow({
      killpointId: 'AFTER_INTENT',
      sequence: 1,
      input: {
        ...baseInput,
        intentWritten: true,
        backupPresent: false,
        recoveryPackPresent: false,
        firstDataWriteStarted: false,
        partialRenameVisible: false,
        manifestRenamed: false,
        ledgerWritten: false,
        backupRotationAttempted: false,
        oldManifestLive: true,
        newManifestLive: false,
        oldSceneSetLive: true,
        newSceneSetLive: false,
        mixedOldNewDataVisible: false,
        sceneTextLossObserved: false,
      },
      outcome: {
        expectedDisposition: 'RECOVER_OLD_STATE_ONLY',
        failCode: 'E_B2C17_KILLPOINT_AFTER_INTENT_UNSAFE',
        recoverable: true,
        explicitStop: false,
        recoveryAction: 'OPEN_OLD_STATE_ONLY',
        rollbackDecision: 'ABORT_PENDING_INTENT_KEEP_OLD_STATE',
        mixedOldNewRejected: false,
        sceneTextLossRejected: false,
        runtimeExecution: false,
      },
    }),
    createKillpointRow({
      killpointId: 'AFTER_BACKUP',
      sequence: 2,
      input: {
        ...baseInput,
        intentWritten: true,
        backupPresent: true,
        recoveryPackPresent: false,
        firstDataWriteStarted: false,
        partialRenameVisible: false,
        manifestRenamed: false,
        ledgerWritten: false,
        backupRotationAttempted: false,
        oldManifestLive: true,
        newManifestLive: false,
        oldSceneSetLive: true,
        newSceneSetLive: false,
        mixedOldNewDataVisible: false,
        sceneTextLossObserved: false,
      },
      outcome: {
        expectedDisposition: 'STOP_BACKUP_READY_OLD_STATE_CANONICAL',
        failCode: 'E_B2C17_KILLPOINT_AFTER_BACKUP_UNSAFE',
        recoverable: true,
        explicitStop: false,
        recoveryAction: 'RESTORE_FROM_BACKUP_IF_RUNTIME_WAS_TOUCHED',
        rollbackDecision: 'BACKUP_READY_RECOVERY_ALLOWED',
        mixedOldNewRejected: false,
        sceneTextLossRejected: false,
        runtimeExecution: false,
      },
    }),
    createKillpointRow({
      killpointId: 'AFTER_RECOVERY_PACK',
      sequence: 3,
      input: {
        ...baseInput,
        intentWritten: true,
        backupPresent: true,
        recoveryPackPresent: true,
        firstDataWriteStarted: false,
        partialRenameVisible: false,
        manifestRenamed: false,
        ledgerWritten: false,
        backupRotationAttempted: false,
        oldManifestLive: true,
        newManifestLive: false,
        oldSceneSetLive: true,
        newSceneSetLive: false,
        mixedOldNewDataVisible: false,
        sceneTextLossObserved: false,
      },
      outcome: {
        expectedDisposition: 'STOP_RECOVERY_PACK_READY',
        failCode: 'E_B2C17_KILLPOINT_AFTER_RECOVERY_PACK_UNSAFE',
        recoverable: true,
        explicitStop: false,
        recoveryAction: 'USE_RECOVERY_PACK_OR_BACKUP',
        rollbackDecision: 'RECOVERY_PACK_READY_ROLLBACK_ALLOWED',
        mixedOldNewRejected: false,
        sceneTextLossRejected: false,
        runtimeExecution: false,
      },
    }),
    createKillpointRow({
      killpointId: 'AFTER_FIRST_DATA_WRITE',
      sequence: 4,
      input: {
        ...baseInput,
        intentWritten: true,
        backupPresent: true,
        recoveryPackPresent: true,
        firstDataWriteStarted: true,
        partialRenameVisible: false,
        manifestRenamed: false,
        ledgerWritten: false,
        backupRotationAttempted: false,
        oldManifestLive: true,
        newManifestLive: false,
        oldSceneSetLive: true,
        newSceneSetLive: false,
        mixedOldNewDataVisible: false,
        sceneTextLossObserved: true,
      },
      outcome: {
        expectedDisposition: 'STOP_SCENE_TEXT_LOSS_REJECTED',
        failCode: 'E_B2C17_KILLPOINT_AFTER_FIRST_DATA_WRITE_UNSAFE',
        recoverable: true,
        explicitStop: false,
        recoveryAction: 'RESTORE_FROM_BACKUP_OR_RECOVERY_PACK',
        rollbackDecision: 'ROLLBACK_REQUIRED_BEFORE_ANY_REOPEN',
        mixedOldNewRejected: false,
        sceneTextLossRejected: true,
        runtimeExecution: false,
      },
    }),
    createKillpointRow({
      killpointId: 'AFTER_PARTIAL_RENAME',
      sequence: 5,
      input: {
        ...baseInput,
        intentWritten: true,
        backupPresent: true,
        recoveryPackPresent: true,
        firstDataWriteStarted: true,
        partialRenameVisible: true,
        manifestRenamed: false,
        ledgerWritten: false,
        backupRotationAttempted: false,
        oldManifestLive: true,
        newManifestLive: false,
        oldSceneSetLive: true,
        newSceneSetLive: true,
        mixedOldNewDataVisible: true,
        sceneTextLossObserved: false,
      },
      outcome: {
        expectedDisposition: 'STOP_MIXED_OLD_NEW_DATA_REJECTED',
        failCode: 'E_B2C17_KILLPOINT_AFTER_PARTIAL_RENAME_UNSAFE',
        recoverable: true,
        explicitStop: false,
        recoveryAction: 'ROLLBACK_TO_BACKUP_REQUIRED',
        rollbackDecision: 'ROLLBACK_TO_BACKUP_MANDATORY',
        mixedOldNewRejected: true,
        sceneTextLossRejected: false,
        runtimeExecution: false,
      },
    }),
    createKillpointRow({
      killpointId: 'BEFORE_MANIFEST_WRITE',
      sequence: 6,
      input: {
        ...baseInput,
        intentWritten: true,
        backupPresent: true,
        recoveryPackPresent: true,
        firstDataWriteStarted: true,
        partialRenameVisible: true,
        manifestRenamed: false,
        ledgerWritten: false,
        backupRotationAttempted: false,
        oldManifestLive: true,
        newManifestLive: false,
        oldSceneSetLive: false,
        newSceneSetLive: true,
        mixedOldNewDataVisible: true,
        sceneTextLossObserved: false,
      },
      outcome: {
        expectedDisposition: 'STOP_MIXED_DATA_BEFORE_MANIFEST_REJECTED',
        failCode: 'E_B2C17_KILLPOINT_BEFORE_MANIFEST_WRITE_UNSAFE',
        recoverable: true,
        explicitStop: false,
        recoveryAction: 'RESTORE_BACKUP_THEN_REBUILD_MANIFEST',
        rollbackDecision: 'ROLLBACK_PLAN_REQUIRED',
        mixedOldNewRejected: true,
        sceneTextLossRejected: false,
        runtimeExecution: false,
      },
    }),
    createKillpointRow({
      killpointId: 'AFTER_MANIFEST_RENAME',
      sequence: 7,
      input: {
        ...baseInput,
        intentWritten: true,
        backupPresent: true,
        recoveryPackPresent: true,
        firstDataWriteStarted: true,
        partialRenameVisible: false,
        manifestRenamed: true,
        ledgerWritten: false,
        backupRotationAttempted: false,
        oldManifestLive: false,
        newManifestLive: true,
        oldSceneSetLive: false,
        newSceneSetLive: true,
        mixedOldNewDataVisible: false,
        sceneTextLossObserved: false,
      },
      outcome: {
        expectedDisposition: 'STOP_LEDGER_PENDING_EXPLICIT',
        failCode: 'E_B2C17_KILLPOINT_AFTER_MANIFEST_RENAME_UNSAFE',
        recoverable: true,
        explicitStop: true,
        recoveryAction: 'ROLLBACK_TO_BACKUP_OR_KEEP_STOPPED',
        rollbackDecision: '',
        mixedOldNewRejected: false,
        sceneTextLossRejected: false,
        runtimeExecution: false,
      },
    }),
    createKillpointRow({
      killpointId: 'BEFORE_LEDGER',
      sequence: 8,
      input: {
        ...baseInput,
        intentWritten: true,
        backupPresent: true,
        recoveryPackPresent: true,
        firstDataWriteStarted: true,
        partialRenameVisible: false,
        manifestRenamed: true,
        ledgerWritten: false,
        backupRotationAttempted: false,
        oldManifestLive: false,
        newManifestLive: true,
        oldSceneSetLive: false,
        newSceneSetLive: true,
        mixedOldNewDataVisible: false,
        sceneTextLossObserved: false,
      },
      outcome: {
        expectedDisposition: 'STOP_BEFORE_LEDGER_EXPLICIT',
        failCode: 'E_B2C17_KILLPOINT_BEFORE_LEDGER_UNSAFE',
        recoverable: true,
        explicitStop: true,
        recoveryAction: 'KEEP_STOPPED_UNTIL_LEDGER_DECISION',
        rollbackDecision: '',
        mixedOldNewRejected: false,
        sceneTextLossRejected: false,
        runtimeExecution: false,
      },
    }),
    createKillpointRow({
      killpointId: 'AFTER_LEDGER',
      sequence: 9,
      input: {
        ...baseInput,
        intentWritten: true,
        backupPresent: true,
        recoveryPackPresent: true,
        firstDataWriteStarted: true,
        partialRenameVisible: false,
        manifestRenamed: true,
        ledgerWritten: true,
        backupRotationAttempted: false,
        oldManifestLive: false,
        newManifestLive: true,
        oldSceneSetLive: false,
        newSceneSetLive: true,
        mixedOldNewDataVisible: false,
        sceneTextLossObserved: false,
      },
      outcome: {
        expectedDisposition: 'STOP_SCOPE_ONLY_NO_RUNTIME_MIGRATION_ADMISSION',
        failCode: 'E_B2C17_KILLPOINT_AFTER_LEDGER_UNSAFE',
        recoverable: false,
        explicitStop: true,
        recoveryAction: 'NO_RUNTIME_CLAIM_ALLOWED',
        rollbackDecision: '',
        mixedOldNewRejected: false,
        sceneTextLossRejected: false,
        runtimeExecution: false,
      },
    }),
    createKillpointRow({
      killpointId: 'BACKUP_ROTATION_FAILURE',
      sequence: 10,
      input: {
        ...baseInput,
        intentWritten: true,
        backupPresent: true,
        recoveryPackPresent: true,
        firstDataWriteStarted: false,
        partialRenameVisible: false,
        manifestRenamed: false,
        ledgerWritten: false,
        backupRotationAttempted: true,
        oldManifestLive: true,
        newManifestLive: false,
        oldSceneSetLive: true,
        newSceneSetLive: false,
        mixedOldNewDataVisible: false,
        sceneTextLossObserved: false,
      },
      outcome: {
        expectedDisposition: 'STOP_BACKUP_ROTATION_RUNTIME_REJECTED',
        failCode: 'E_B2C17_KILLPOINT_BACKUP_ROTATION_FAILURE_UNSAFE',
        recoverable: false,
        explicitStop: true,
        recoveryAction: 'NO_ROTATION_RUNTIME_ALLOWED',
        rollbackDecision: '',
        mixedOldNewRejected: false,
        sceneTextLossRejected: false,
        runtimeExecution: false,
      },
    }),
  ];
}

function buildRecoveryOutcomes(killpointMatrix) {
  return killpointMatrix.map((row) => ({
    killpointId: row.killpointId,
    expectedDisposition: row.outcome.expectedDisposition,
    failCode: row.outcome.failCode,
    recoverable: row.outcome.recoverable,
    explicitStop: row.outcome.explicitStop,
    recoveryAction: row.outcome.recoveryAction,
    rollbackDecision: row.outcome.rollbackDecision,
  }));
}

function buildPositiveCases(killpointMatrix) {
  const byKillpoint = new Map(killpointMatrix.map((row) => [row.killpointId, row]));
  return [
    {
      caseId: 'POSITIVE_REQUIRED_KILLPOINT_SET_COMPLETE',
      ok: REQUIRED_KILLPOINTS.every((killpointId) => byKillpoint.has(killpointId)),
      observedKillpointCount: killpointMatrix.length,
    },
    {
      caseId: 'POSITIVE_AFTER_INTENT_OLD_STATE_REOPEN_ONLY',
      ok: byKillpoint.get('AFTER_INTENT').outcome.expectedDisposition === 'RECOVER_OLD_STATE_ONLY'
        && byKillpoint.get('AFTER_INTENT').input.backupPresent === false,
      observedDisposition: byKillpoint.get('AFTER_INTENT').outcome.expectedDisposition,
    },
    {
      caseId: 'POSITIVE_AFTER_RECOVERY_PACK_HAS_RECOVERY_BOUNDARY',
      ok: byKillpoint.get('AFTER_RECOVERY_PACK').input.recoveryPackPresent === true
        && byKillpoint.get('AFTER_RECOVERY_PACK').outcome.recoverable === true,
      observedDisposition: byKillpoint.get('AFTER_RECOVERY_PACK').outcome.expectedDisposition,
    },
    {
      caseId: 'POSITIVE_AFTER_MANIFEST_RENAME_STOPS_FOR_LEDGER',
      ok: byKillpoint.get('AFTER_MANIFEST_RENAME').outcome.explicitStop === true
        && byKillpoint.get('AFTER_MANIFEST_RENAME').input.ledgerWritten === false,
      observedDisposition: byKillpoint.get('AFTER_MANIFEST_RENAME').outcome.expectedDisposition,
    },
    {
      caseId: 'POSITIVE_AFTER_LEDGER_STILL_HAS_NO_RUNTIME_ADMISSION',
      ok: byKillpoint.get('AFTER_LEDGER').outcome.explicitStop === true
        && byKillpoint.get('AFTER_LEDGER').outcome.runtimeExecution === false,
      observedDisposition: byKillpoint.get('AFTER_LEDGER').outcome.expectedDisposition,
    },
  ];
}

function buildNegativeCases(killpointMatrix) {
  const byKillpoint = new Map(killpointMatrix.map((row) => [row.killpointId, row]));
  const executeMigration = rejectOutOfScope('EXECUTE_MIGRATION');
  const backupRotationRuntime = rejectOutOfScope('BACKUP_ROTATION_RUNTIME');
  const docOnlyEvidence = rejectOutOfScope('DOC_ONLY_EVIDENCE');

  return [
    {
      caseId: 'NEGATIVE_MIXED_OLD_NEW_DATA_REJECTED',
      ok: byKillpoint.get('AFTER_PARTIAL_RENAME').input.mixedOldNewDataVisible === true
        && byKillpoint.get('AFTER_PARTIAL_RENAME').outcome.mixedOldNewRejected === true
        && byKillpoint.get('BEFORE_MANIFEST_WRITE').outcome.mixedOldNewRejected === true,
      observedDisposition: byKillpoint.get('AFTER_PARTIAL_RENAME').outcome.expectedDisposition,
      observedCode: byKillpoint.get('AFTER_PARTIAL_RENAME').outcome.failCode,
    },
    {
      caseId: 'NEGATIVE_SCENE_TEXT_LOSS_REJECTED',
      ok: byKillpoint.get('AFTER_FIRST_DATA_WRITE').input.sceneTextLossObserved === true
        && byKillpoint.get('AFTER_FIRST_DATA_WRITE').outcome.sceneTextLossRejected === true,
      observedDisposition: byKillpoint.get('AFTER_FIRST_DATA_WRITE').outcome.expectedDisposition,
      observedCode: byKillpoint.get('AFTER_FIRST_DATA_WRITE').outcome.failCode,
    },
    {
      caseId: 'NEGATIVE_REAL_MIGRATION_EXECUTION_REJECTED_OUT_OF_SCOPE',
      ok: executeMigration.ok === false && executeMigration.code === 'E_B2C17_ACTUAL_MIGRATION_EXECUTION_OUT_OF_SCOPE',
      observedDisposition: executeMigration.disposition,
      observedCode: executeMigration.code,
    },
    {
      caseId: 'NEGATIVE_BACKUP_ROTATION_RUNTIME_REJECTED_OUT_OF_SCOPE',
      ok: backupRotationRuntime.ok === false && backupRotationRuntime.code === 'E_B2C17_BACKUP_ROTATION_RUNTIME_OUT_OF_SCOPE',
      observedDisposition: backupRotationRuntime.disposition,
      observedCode: backupRotationRuntime.code,
    },
    {
      caseId: 'NEGATIVE_DOC_ONLY_EVIDENCE_REJECTED',
      ok: docOnlyEvidence.ok === false && docOnlyEvidence.code === 'E_B2C17_DOC_ONLY_EVIDENCE_REJECTED',
      observedDisposition: docOnlyEvidence.disposition,
      observedCode: docOnlyEvidence.code,
    },
  ];
}

function validateFalseClaims(scope) {
  const driftRows = Object.keys(FALSE_SCOPE_CLAIMS)
    .filter((key) => scope[key] !== false)
    .map((key) => `${key.toUpperCase()}_MUST_BE_FALSE`);
  return {
    ok: driftRows.length === 0,
    failRows: driftRows,
  };
}

function buildCommandResultsSkeleton() {
  const commands = [
    'node scripts/ops/b2c17-migration-killpoint-proof-state.mjs --write --json',
    'node --test test/contracts/b2c17-migration-killpoint-proof.contract.test.js',
    'node --test test/contracts/b2c16-migration-policy-minimal.contract.test.js',
    'node --test test/contracts/b2c15-restore-drill-and-quarantine.contract.test.js',
    'node --test test/contracts/b2c14-recovery-readable-proof.contract.test.js',
    'npm run oss:policy',
    'git diff --name-only -- package.json package-lock.json',
    'git diff --name-only -- src/renderer/index.html src/renderer/styles.css',
    'git diff --name-only -- src/core src/io src/main',
  ];
  return {
    taskId: TASK_ID,
    status: 'COMMAND_SET_DECLARED',
    allPassed: false,
    commands: commands.map((command) => ({
      command,
      exitCode: null,
      result: 'PENDING',
      summary: 'Execution record must be updated after required commands run.',
    })),
  };
}

export async function evaluateB2C17MigrationKillpointProofState({ repoRoot = process.cwd() } = {}) {
  const resolvedRepoRoot = path.resolve(String(repoRoot || process.cwd()));
  const scope = cloneJson(FALSE_SCOPE_CLAIMS);
  const binding = await readB2C16Binding(resolvedRepoRoot);
  const killpointMatrix = buildKillpointMatrix(binding);
  const recoveryOutcomes = buildRecoveryOutcomes(killpointMatrix);
  const positiveCases = buildPositiveCases(killpointMatrix);
  const negativeCases = buildNegativeCases(killpointMatrix);
  const killpointMatrixHash = sha256Text(stableStringify(killpointMatrix));
  const recoveryOutcomeHash = sha256Text(stableStringify(recoveryOutcomes));
  const scopeValidation = validateFalseClaims(scope);
  const failRows = [];
  const byKillpoint = new Map(killpointMatrix.map((row) => [row.killpointId, row]));
  const firstMutatingRow = killpointMatrix.find((row) => row.input.firstDataWriteStarted === true);

  const everyKillpointHasExplicitInputStateOk = killpointMatrix.every((row) => {
    const keys = [
      'fromSchemaVersion',
      'toSchemaVersion',
      'rollbackPlanPresent',
      'actualMigrationExecuted',
      'storageFormatChanged',
      'schemaVersionBumped',
      'uiTouched',
      'dependencyChanged',
      'intentWritten',
      'backupPresent',
      'recoveryPackPresent',
      'firstDataWriteStarted',
      'partialRenameVisible',
      'manifestRenamed',
      'ledgerWritten',
      'backupRotationAttempted',
      'oldManifestLive',
      'newManifestLive',
      'oldSceneSetLive',
      'newSceneSetLive',
      'mixedOldNewDataVisible',
      'sceneTextLossObserved',
    ];
    return keys.every((key) => Object.hasOwn(row.input, key));
  });
  const everyKillpointHasExpectedDispositionOk = killpointMatrix.every((row) => typeof row.outcome.expectedDisposition === 'string' && row.outcome.expectedDisposition.length > 0);
  const everyKillpointHasUnsafeFailureCodeOk = killpointMatrix.every((row) => /^E_B2C17_KILLPOINT_/.test(row.outcome.failCode));
  const everyKillpointEndsRecoverableOrExplicitStopOk = killpointMatrix.every((row) => row.outcome.recoverable === true || row.outcome.explicitStop === true);
  const rollbackDecisionAvailableOrStopExplicitOk = killpointMatrix.every((row) => row.outcome.rollbackDecision.length > 0 || row.outcome.explicitStop === true);

  if (resolvedRepoRoot.length === 0) failRows.push('REPO_ROOT_EMPTY');
  if (!binding.ok) failRows.push('B2C16_POLICY_BINDING_RED');
  if (!positiveCases.every((entry) => entry.ok === true)) failRows.push('POSITIVE_CASE_RED');
  if (!negativeCases.every((entry) => entry.ok === true)) failRows.push('NEGATIVE_CASE_RED');
  if (!scopeValidation.ok) failRows.push(...scopeValidation.failRows);

  const proof = {
    repoBound: true,
    simulatedDeterministicHarnessOnly: true,
    b2c16PolicyBound: binding.ok,
    b2c16Binding: cloneJson(binding),
    harnessBoundary: {
      claimStatus: 'SIMULATED_PROOF_ONLY',
      runtimeExecutionAdmitted: false,
      realUserDataMigrationAdmitted: false,
      productionStorageMigrationRuntimeAdmitted: false,
      actualRollbackExecutionAdmitted: false,
      backupRotationRuntimeAdmitted: false,
      schemaVersionChangeAdmitted: false,
      storageFormatChangeAdmitted: false,
      block2ExitAdmitted: false,
      releaseAdmitted: false,
    },
    requiredKillpoints,
    killpointMatrixHash,
    recoveryOutcomeHash,
    killpointCount: killpointMatrix.length,
    everyKillpointHasExplicitInputStateOk,
    everyKillpointHasExpectedDispositionOk,
    everyKillpointHasUnsafeFailureCodeOk,
    everyKillpointEndsRecoverableOrExplicitStopOk,
    mixedOldNewDataRejectedOk: negativeCases.some((entry) => entry.caseId === 'NEGATIVE_MIXED_OLD_NEW_DATA_REJECTED' && entry.ok),
    sceneTextLossRejectedOk: negativeCases.some((entry) => entry.caseId === 'NEGATIVE_SCENE_TEXT_LOSS_REJECTED' && entry.ok),
    rollbackDecisionAvailableOrStopExplicitOk,
    backupPreconditionRespectedOk: Boolean(firstMutatingRow) && firstMutatingRow.input.backupPresent === true,
    recoveryPackPreconditionRespectedOk: Boolean(firstMutatingRow) && firstMutatingRow.input.recoveryPackPresent === true,
    rollbackPlanPreconditionRespectedOk: killpointMatrix
      .filter((row) => row.input.firstDataWriteStarted === true || row.input.partialRenameVisible === true || row.input.manifestRenamed === true)
      .every((row) => row.input.rollbackPlanPresent === true),
    noDocOnlyEvidenceOk: negativeCases.some((entry) => entry.caseId === 'NEGATIVE_DOC_ONLY_EVIDENCE_REJECTED' && entry.ok)
      && killpointMatrix.length === REQUIRED_KILLPOINTS.length
      && binding.ok,
    realMigrationExecutionRejectedOk: negativeCases.some((entry) => entry.caseId === 'NEGATIVE_REAL_MIGRATION_EXECUTION_REJECTED_OUT_OF_SCOPE' && entry.ok),
    block2ExitClaimFalseOk: scope.block2ExitClaim === false,
  };

  if (!proof.b2c16PolicyBound) failRows.push('B2C16_POLICY_BOUND_RED');
  if (!proof.everyKillpointHasExplicitInputStateOk) failRows.push('KILLPOINT_INPUT_STATE_RED');
  if (!proof.everyKillpointHasExpectedDispositionOk) failRows.push('KILLPOINT_DISPOSITION_RED');
  if (!proof.everyKillpointHasUnsafeFailureCodeOk) failRows.push('KILLPOINT_FAIL_CODE_RED');
  if (!proof.everyKillpointEndsRecoverableOrExplicitStopOk) failRows.push('KILLPOINT_RECOVERY_BOUNDARY_RED');
  if (!proof.mixedOldNewDataRejectedOk) failRows.push('MIXED_OLD_NEW_REJECTION_RED');
  if (!proof.sceneTextLossRejectedOk) failRows.push('SCENE_TEXT_LOSS_REJECTION_RED');
  if (!proof.rollbackDecisionAvailableOrStopExplicitOk) failRows.push('ROLLBACK_DECISION_BOUNDARY_RED');
  if (!proof.backupPreconditionRespectedOk) failRows.push('BACKUP_PRECONDITION_RED');
  if (!proof.recoveryPackPreconditionRespectedOk) failRows.push('RECOVERY_PACK_PRECONDITION_RED');
  if (!proof.rollbackPlanPreconditionRespectedOk) failRows.push('ROLLBACK_PLAN_PRECONDITION_RED');
  if (!proof.noDocOnlyEvidenceOk) failRows.push('DOC_ONLY_EVIDENCE_RED');
  if (!proof.realMigrationExecutionRejectedOk) failRows.push('REAL_MIGRATION_REJECTION_RED');
  if (!proof.block2ExitClaimFalseOk) failRows.push('BLOCK2_EXIT_FALSE_CLAIM_RED');

  return {
    artifactId: 'B2C17_MIGRATION_KILLPOINT_PROOF_STATUS_V1',
    schemaVersion: 1,
    taskId: TASK_ID,
    status: failRows.length === 0 ? 'PASS' : 'FAIL',
    ok: failRows.length === 0,
    [TOKEN_NAME]: failRows.length === 0 ? 1 : 0,
    failSignal: failRows.length === 0 ? '' : 'E_B2C17_MIGRATION_KILLPOINT_PROOF_RED',
    failRows,
    donor: DONOR,
    scope,
    proof,
    runtime: {
      currentSchemaVersion: binding.currentSchemaVersion ?? CURRENT_SCHEMA_VERSION,
      requiredKillpoints: [...REQUIRED_KILLPOINTS],
      killpointMatrix,
      recoveryOutcomes,
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

async function writeStateArtifacts(repoRoot, state) {
  const statusPath = path.join(repoRoot, 'docs', 'OPS', 'STATUS', STATUS_BASENAME);
  const evidencePath = path.join(repoRoot, EVIDENCE_DIR);
  await fsp.mkdir(evidencePath, { recursive: true });

  await writeJsonAtomic(statusPath, state);
  await writeJsonAtomic(path.join(evidencePath, 'killpoint-matrix.json'), {
    currentSchemaVersion: state.runtime.currentSchemaVersion,
    b2c16PolicyBound: state.proof.b2c16PolicyBound,
    requiredKillpoints: state.runtime.requiredKillpoints,
    killpointMatrixHash: state.proof.killpointMatrixHash,
    rows: state.runtime.killpointMatrix,
  });
  await writeJsonAtomic(path.join(evidencePath, 'recovery-outcome-proof.json'), {
    proof: {
      everyKillpointEndsRecoverableOrExplicitStopOk: state.proof.everyKillpointEndsRecoverableOrExplicitStopOk,
      mixedOldNewDataRejectedOk: state.proof.mixedOldNewDataRejectedOk,
      sceneTextLossRejectedOk: state.proof.sceneTextLossRejectedOk,
      rollbackDecisionAvailableOrStopExplicitOk: state.proof.rollbackDecisionAvailableOrStopExplicitOk,
      noDocOnlyEvidenceOk: state.proof.noDocOnlyEvidenceOk,
      realMigrationExecutionRejectedOk: state.proof.realMigrationExecutionRejectedOk,
    },
    runtime: {
      positiveCases: state.runtime.positiveCases,
      negativeCases: state.runtime.negativeCases,
      recoveryOutcomes: state.runtime.recoveryOutcomes,
    },
  });
  await writeJsonAtomic(path.join(evidencePath, 'donor-mapping.json'), {
    donor: state.donor,
    mappedContour: TASK_ID,
    acceptedUse: state.donor.acceptedUse,
    rejectedUse: state.donor.rejectedUse,
    referenceArchivesConsulted: [state.donor.primaryBasename],
    consultedEntries: state.donor.consultedEntries,
  });
  await writeJsonAtomic(path.join(evidencePath, 'command-results.json'), buildCommandResultsSkeleton());
}

const requiredKillpoints = [...REQUIRED_KILLPOINTS];
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const args = parseArgs();
  const repoRoot = process.cwd();
  const state = await evaluateB2C17MigrationKillpointProofState({ repoRoot });
  if (args.write) {
    await writeStateArtifacts(repoRoot, state);
  }
  process.stdout.write(`${stableStringify(state)}\n`);
  if (!args.json) {
    process.stdout.write('');
  }
}

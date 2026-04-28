#!/usr/bin/env node
import crypto from 'node:crypto';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const TOKEN_NAME = 'B2C16_MIGRATION_POLICY_MINIMAL_OK';

const TASK_ID = 'B2C16_MIGRATION_POLICY_MINIMAL';
const STATUS_BASENAME = 'B2C16_MIGRATION_POLICY_MINIMAL_STATUS_V1.json';
const EVIDENCE_DIR = path.join('docs', 'OPS', 'EVIDENCE', TASK_ID, 'TICKET_01');
const CURRENT_SCHEMA_VERSION = 1;
const DONOR = Object.freeze({
  primaryBasename: 'writer-editor-longform-v5_1-block2-trusted-kernel-pack-v1.zip',
  primarySha256: '7189d8357f340d89112b02a57eb9315f9af4695ac00e3a2707801e4d97320791',
  consultedEntries: [
    'migration-policy.js',
    'migration-policy.test.js',
  ],
  acceptedUse: 'POLICY_ROW_IDEAS_VERSION_MATRIX_SHAPE_NEGATIVE_CASE_IDEAS_BACKUP_RECOVERY_ROLLBACK_ONLY',
  rejectedUse: 'NO_RUNTIME_IMPORT_NO_BROAD_KERNEL_OVERLAY_NO_DATA_MIGRATION_NO_BACKUP_EXECUTION_NO_BLOCK2_EXIT',
});
const FALSE_SCOPE_CLAIMS = Object.freeze({
  b2c17KillpointClaim: false,
  b2c18PerfClaim: false,
  block2ExitClaim: false,
  uiTouched: false,
  dependencyChanged: false,
  exportChanged: false,
  networkOrCloud: false,
  actualDataMigrationClaim: false,
  generalImportExportClaim: false,
  actualBackupExecutionClaim: false,
  rollbackDrillClaim: false,
  quarantineRuntimeClaim: false,
  schemaChanged: false,
  storageFormatChanged: false,
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

function classifySchemaVersion(version) {
  if (!Number.isInteger(version) || version < 0) return 'INVALID';
  if (version === CURRENT_SCHEMA_VERSION) return 'CURRENT';
  if (version > CURRENT_SCHEMA_VERSION) return 'UNKNOWN_FUTURE';
  return 'UNKNOWN_OLD';
}

function evaluateVersionOpenPolicy(schemaVersion) {
  const classification = classifySchemaVersion(schemaVersion);
  if (classification === 'CURRENT') {
    return {
      schemaVersion,
      classification,
      disposition: 'OPEN_CLEAN_MUTABLE',
      cleanMutable: true,
      readOnlyRestricted: false,
      stop: false,
      migrationRequired: false,
      advisoryWhenUntouched: false,
      quarantine: false,
      silentUpgrade: false,
      runtimeExecution: false,
      status: 'ALLOW_CLEAN',
      code: '',
    };
  }
  if (classification === 'UNKNOWN_FUTURE') {
    return {
      schemaVersion,
      classification,
      disposition: 'OPEN_READ_ONLY_RESTRICTED',
      cleanMutable: false,
      readOnlyRestricted: true,
      stop: false,
      migrationRequired: false,
      advisoryWhenUntouched: false,
      quarantine: false,
      silentUpgrade: false,
      runtimeExecution: false,
      status: 'ALLOW_RESTRICTED',
      code: 'E_B2C16_UNKNOWN_FUTURE_RESTRICTED',
    };
  }
  if (classification === 'UNKNOWN_OLD') {
    return {
      schemaVersion,
      classification,
      disposition: 'STOP_RESTRICTED_EXPLICIT_MIGRATION_REQUIRED',
      cleanMutable: false,
      readOnlyRestricted: false,
      stop: true,
      migrationRequired: true,
      advisoryWhenUntouched: true,
      quarantine: false,
      silentUpgrade: false,
      runtimeExecution: false,
      status: 'STOP_POLICY_ONLY',
      code: 'E_B2C16_EXPLICIT_MIGRATION_REQUIRED',
    };
  }
  return {
    schemaVersion,
    classification,
    disposition: 'STOP_INVALID_VERSION',
    cleanMutable: false,
    readOnlyRestricted: false,
    stop: true,
    migrationRequired: false,
    advisoryWhenUntouched: false,
    quarantine: false,
    silentUpgrade: false,
    runtimeExecution: false,
    status: 'STOP_POLICY_ONLY',
    code: 'E_B2C16_INVALID_SCHEMA_VERSION',
  };
}

function evaluateMigrationPreconditions(input = {}) {
  const {
    fromVersion,
    toVersion,
    backupPresent = false,
    recoveryPackPresent = false,
    rollbackPlanPresent = false,
  } = input;
  const missing = [];
  if (backupPresent !== true) missing.push('BACKUP');
  if (recoveryPackPresent !== true) missing.push('RECOVERY_PACK');
  if (rollbackPlanPresent !== true) missing.push('ROLLBACK');
  const failCode = missing.length === 0
    ? ''
    : missing[0] === 'BACKUP'
      ? 'E_B2C16_BACKUP_REQUIRED'
      : missing[0] === 'RECOVERY_PACK'
        ? 'E_B2C16_RECOVERY_PACK_REQUIRED'
        : 'E_B2C16_ROLLBACK_REQUIRED';

  return {
    fromVersion,
    toVersion,
    backupPresent,
    recoveryPackPresent,
    rollbackPlanPresent,
    missing,
    ok: missing.length === 0,
    stop: missing.length > 0,
    migrationRequired: true,
    advisoryWhenUntouched: true,
    runtimeExecution: false,
    disposition: missing.length === 0 ? 'PRECONDITIONS_READY_POLICY_ONLY' : `STOP_${missing[0]}_REQUIRED`,
    code: failCode,
  };
}

function evaluateMixedVersionPolicy(schemaVersions) {
  const normalized = Array.from(new Set(schemaVersions)).sort((a, b) => a - b);
  if (normalized.length <= 1) {
    return {
      ok: true,
      disposition: 'OPEN_SINGLE_VERSION_ONLY',
      stop: false,
      quarantine: false,
      runtimeExecution: false,
      schemaVersions: normalized,
      code: '',
    };
  }
  return {
    ok: false,
    disposition: 'STOP_QUARANTINE_POLICY_ONLY',
    stop: true,
    quarantine: true,
    runtimeExecution: false,
    schemaVersions: normalized,
    code: 'E_B2C16_MIXED_VERSION_STOP',
  };
}

function rejectOutOfScopeMutation(kind) {
  if (kind === 'SILENT_DATA_REWRITE') {
    return {
      ok: false,
      disposition: 'REJECTED_OUT_OF_SCOPE',
      code: 'E_B2C16_SILENT_DATA_REWRITE_REJECTED',
      runtimeExecution: false,
    };
  }
  if (kind === 'EXECUTE_MIGRATION') {
    return {
      ok: false,
      disposition: 'REJECTED_OUT_OF_SCOPE',
      code: 'E_B2C16_ACTUAL_MIGRATION_EXECUTION_OUT_OF_SCOPE',
      runtimeExecution: false,
    };
  }
  return {
    ok: false,
    disposition: 'REJECTED_OUT_OF_SCOPE',
    code: 'E_B2C16_UNKNOWN_MUTATION_KIND',
    runtimeExecution: false,
  };
}

function buildVersionPolicyMatrix() {
  const current = evaluateVersionOpenPolicy(CURRENT_SCHEMA_VERSION);
  const future = evaluateVersionOpenPolicy(CURRENT_SCHEMA_VERSION + 98);
  const old = evaluateVersionOpenPolicy(CURRENT_SCHEMA_VERSION - 1);
  const ready = evaluateMigrationPreconditions({
    fromVersion: CURRENT_SCHEMA_VERSION - 1,
    toVersion: CURRENT_SCHEMA_VERSION,
    backupPresent: true,
    recoveryPackPresent: true,
    rollbackPlanPresent: true,
  });
  const missingBackup = evaluateMigrationPreconditions({
    fromVersion: CURRENT_SCHEMA_VERSION - 1,
    toVersion: CURRENT_SCHEMA_VERSION,
    backupPresent: false,
    recoveryPackPresent: true,
    rollbackPlanPresent: true,
  });
  const missingRecoveryPack = evaluateMigrationPreconditions({
    fromVersion: CURRENT_SCHEMA_VERSION - 1,
    toVersion: CURRENT_SCHEMA_VERSION,
    backupPresent: true,
    recoveryPackPresent: false,
    rollbackPlanPresent: true,
  });
  const missingRollback = evaluateMigrationPreconditions({
    fromVersion: CURRENT_SCHEMA_VERSION - 1,
    toVersion: CURRENT_SCHEMA_VERSION,
    backupPresent: true,
    recoveryPackPresent: true,
    rollbackPlanPresent: false,
  });
  const mixed = evaluateMixedVersionPolicy([CURRENT_SCHEMA_VERSION - 1, CURRENT_SCHEMA_VERSION]);

  return [
    {
      rowId: 'CURRENT_VERSION_OPEN_CLEAN',
      rowType: 'VERSION_OPEN_POLICY',
      input: {
        schemaVersion: CURRENT_SCHEMA_VERSION,
      },
      outcome: current,
    },
    {
      rowId: 'UNKNOWN_FUTURE_READ_ONLY_RESTRICTED',
      rowType: 'VERSION_OPEN_POLICY',
      input: {
        schemaVersion: CURRENT_SCHEMA_VERSION + 98,
      },
      outcome: future,
    },
    {
      rowId: 'UNKNOWN_OLD_STOP_MIGRATION_REQUIRED',
      rowType: 'VERSION_OPEN_POLICY',
      input: {
        schemaVersion: CURRENT_SCHEMA_VERSION - 1,
      },
      outcome: old,
    },
    {
      rowId: 'BACKUP_PRECONDITION_REQUIRED',
      rowType: 'MIGRATION_PRECONDITION',
      input: {
        fromVersion: CURRENT_SCHEMA_VERSION - 1,
        toVersion: CURRENT_SCHEMA_VERSION,
        backupPresent: true,
        recoveryPackPresent: true,
        rollbackPlanPresent: true,
      },
      outcome: {
        required: true,
        missingPolicy: 'STOP_BACKUP_REQUIRED',
        ...ready,
      },
    },
    {
      rowId: 'RECOVERY_PACK_PRECONDITION_REQUIRED',
      rowType: 'MIGRATION_PRECONDITION',
      input: {
        fromVersion: CURRENT_SCHEMA_VERSION - 1,
        toVersion: CURRENT_SCHEMA_VERSION,
        backupPresent: true,
        recoveryPackPresent: true,
        rollbackPlanPresent: true,
      },
      outcome: {
        required: true,
        missingPolicy: 'STOP_RECOVERY_PACK_REQUIRED',
        ...ready,
      },
    },
    {
      rowId: 'ROLLBACK_PRECONDITION_REQUIRED',
      rowType: 'MIGRATION_PRECONDITION',
      input: {
        fromVersion: CURRENT_SCHEMA_VERSION - 1,
        toVersion: CURRENT_SCHEMA_VERSION,
        backupPresent: true,
        recoveryPackPresent: true,
        rollbackPlanPresent: true,
      },
      outcome: {
        required: true,
        missingPolicy: 'STOP_ROLLBACK_REQUIRED',
        ...ready,
      },
    },
    {
      rowId: 'MISSING_BACKUP_STOPS_POLICY',
      rowType: 'MIGRATION_PRECONDITION',
      input: {
        fromVersion: CURRENT_SCHEMA_VERSION - 1,
        toVersion: CURRENT_SCHEMA_VERSION,
        backupPresent: false,
        recoveryPackPresent: true,
        rollbackPlanPresent: true,
      },
      outcome: missingBackup,
    },
    {
      rowId: 'MISSING_RECOVERY_PACK_STOPS_POLICY',
      rowType: 'MIGRATION_PRECONDITION',
      input: {
        fromVersion: CURRENT_SCHEMA_VERSION - 1,
        toVersion: CURRENT_SCHEMA_VERSION,
        backupPresent: true,
        recoveryPackPresent: false,
        rollbackPlanPresent: true,
      },
      outcome: missingRecoveryPack,
    },
    {
      rowId: 'MISSING_ROLLBACK_STOPS_POLICY',
      rowType: 'MIGRATION_PRECONDITION',
      input: {
        fromVersion: CURRENT_SCHEMA_VERSION - 1,
        toVersion: CURRENT_SCHEMA_VERSION,
        backupPresent: true,
        recoveryPackPresent: true,
        rollbackPlanPresent: false,
      },
      outcome: missingRollback,
    },
    {
      rowId: 'MIXED_VERSION_STOP_QUARANTINE_POLICY_ONLY',
      rowType: 'MIXED_VERSION_POLICY',
      input: {
        schemaVersions: [CURRENT_SCHEMA_VERSION - 1, CURRENT_SCHEMA_VERSION],
      },
      outcome: mixed,
    },
  ];
}

function buildPositiveCases(versionPolicyMatrix) {
  const byRowId = new Map(versionPolicyMatrix.map((row) => [row.rowId, row]));
  return [
    {
      caseId: 'POSITIVE_CURRENT_VERSION_OPENS_CLEAN',
      ok: byRowId.get('CURRENT_VERSION_OPEN_CLEAN').outcome.disposition === 'OPEN_CLEAN_MUTABLE',
      observedDisposition: byRowId.get('CURRENT_VERSION_OPEN_CLEAN').outcome.disposition,
      migrationRequired: byRowId.get('CURRENT_VERSION_OPEN_CLEAN').outcome.migrationRequired,
    },
    {
      caseId: 'POSITIVE_UNKNOWN_FUTURE_READ_ONLY_RESTRICTED',
      ok: byRowId.get('UNKNOWN_FUTURE_READ_ONLY_RESTRICTED').outcome.readOnlyRestricted === true
        && byRowId.get('UNKNOWN_FUTURE_READ_ONLY_RESTRICTED').outcome.cleanMutable === false,
      observedDisposition: byRowId.get('UNKNOWN_FUTURE_READ_ONLY_RESTRICTED').outcome.disposition,
      migrationRequired: byRowId.get('UNKNOWN_FUTURE_READ_ONLY_RESTRICTED').outcome.migrationRequired,
    },
    {
      caseId: 'POSITIVE_UNKNOWN_OLD_EXPLICIT_MIGRATION_REQUIRED',
      ok: byRowId.get('UNKNOWN_OLD_STOP_MIGRATION_REQUIRED').outcome.stop === true
        && byRowId.get('UNKNOWN_OLD_STOP_MIGRATION_REQUIRED').outcome.migrationRequired === true
        && byRowId.get('UNKNOWN_OLD_STOP_MIGRATION_REQUIRED').outcome.advisoryWhenUntouched === true,
      observedDisposition: byRowId.get('UNKNOWN_OLD_STOP_MIGRATION_REQUIRED').outcome.disposition,
      migrationRequired: byRowId.get('UNKNOWN_OLD_STOP_MIGRATION_REQUIRED').outcome.migrationRequired,
    },
    {
      caseId: 'POSITIVE_PRECONDITIONS_READY_POLICY_ONLY',
      ok: byRowId.get('BACKUP_PRECONDITION_REQUIRED').outcome.ok === true
        && byRowId.get('RECOVERY_PACK_PRECONDITION_REQUIRED').outcome.ok === true
        && byRowId.get('ROLLBACK_PRECONDITION_REQUIRED').outcome.ok === true,
      observedDisposition: byRowId.get('BACKUP_PRECONDITION_REQUIRED').outcome.disposition,
      migrationRequired: byRowId.get('BACKUP_PRECONDITION_REQUIRED').outcome.migrationRequired,
    },
    {
      caseId: 'POSITIVE_MIXED_VERSION_STOPS_QUARANTINE_POLICY_ONLY',
      ok: byRowId.get('MIXED_VERSION_STOP_QUARANTINE_POLICY_ONLY').outcome.stop === true
        && byRowId.get('MIXED_VERSION_STOP_QUARANTINE_POLICY_ONLY').outcome.quarantine === true
        && byRowId.get('MIXED_VERSION_STOP_QUARANTINE_POLICY_ONLY').outcome.runtimeExecution === false,
      observedDisposition: byRowId.get('MIXED_VERSION_STOP_QUARANTINE_POLICY_ONLY').outcome.disposition,
      migrationRequired: false,
    },
  ];
}

function buildNegativeCases(versionPolicyMatrix) {
  const byRowId = new Map(versionPolicyMatrix.map((row) => [row.rowId, row]));
  const silentRewrite = rejectOutOfScopeMutation('SILENT_DATA_REWRITE');
  const executeMigration = rejectOutOfScopeMutation('EXECUTE_MIGRATION');

  return [
    {
      caseId: 'NEGATIVE_UNKNOWN_FUTURE_NOT_CLEAN_MUTABLE',
      ok: byRowId.get('UNKNOWN_FUTURE_READ_ONLY_RESTRICTED').outcome.cleanMutable === false
        && byRowId.get('UNKNOWN_FUTURE_READ_ONLY_RESTRICTED').outcome.readOnlyRestricted === true,
      observedDisposition: byRowId.get('UNKNOWN_FUTURE_READ_ONLY_RESTRICTED').outcome.disposition,
      observedCode: byRowId.get('UNKNOWN_FUTURE_READ_ONLY_RESTRICTED').outcome.code,
    },
    {
      caseId: 'NEGATIVE_UNKNOWN_OLD_NOT_SILENTLY_UPGRADED',
      ok: byRowId.get('UNKNOWN_OLD_STOP_MIGRATION_REQUIRED').outcome.stop === true
        && byRowId.get('UNKNOWN_OLD_STOP_MIGRATION_REQUIRED').outcome.silentUpgrade === false
        && byRowId.get('UNKNOWN_OLD_STOP_MIGRATION_REQUIRED').outcome.migrationRequired === true,
      observedDisposition: byRowId.get('UNKNOWN_OLD_STOP_MIGRATION_REQUIRED').outcome.disposition,
      observedCode: byRowId.get('UNKNOWN_OLD_STOP_MIGRATION_REQUIRED').outcome.code,
    },
    {
      caseId: 'NEGATIVE_MIXED_VERSION_NOT_ACCEPTED_CLEAN',
      ok: byRowId.get('MIXED_VERSION_STOP_QUARANTINE_POLICY_ONLY').outcome.stop === true
        && byRowId.get('MIXED_VERSION_STOP_QUARANTINE_POLICY_ONLY').outcome.quarantine === true,
      observedDisposition: byRowId.get('MIXED_VERSION_STOP_QUARANTINE_POLICY_ONLY').outcome.disposition,
      observedCode: byRowId.get('MIXED_VERSION_STOP_QUARANTINE_POLICY_ONLY').outcome.code,
    },
    {
      caseId: 'NEGATIVE_MISSING_BACKUP_STOPS',
      ok: byRowId.get('MISSING_BACKUP_STOPS_POLICY').outcome.stop === true,
      observedDisposition: byRowId.get('MISSING_BACKUP_STOPS_POLICY').outcome.disposition,
      observedCode: byRowId.get('MISSING_BACKUP_STOPS_POLICY').outcome.code,
    },
    {
      caseId: 'NEGATIVE_MISSING_RECOVERY_PACK_STOPS',
      ok: byRowId.get('MISSING_RECOVERY_PACK_STOPS_POLICY').outcome.stop === true,
      observedDisposition: byRowId.get('MISSING_RECOVERY_PACK_STOPS_POLICY').outcome.disposition,
      observedCode: byRowId.get('MISSING_RECOVERY_PACK_STOPS_POLICY').outcome.code,
    },
    {
      caseId: 'NEGATIVE_MISSING_ROLLBACK_STOPS',
      ok: byRowId.get('MISSING_ROLLBACK_STOPS_POLICY').outcome.stop === true,
      observedDisposition: byRowId.get('MISSING_ROLLBACK_STOPS_POLICY').outcome.disposition,
      observedCode: byRowId.get('MISSING_ROLLBACK_STOPS_POLICY').outcome.code,
    },
    {
      caseId: 'NEGATIVE_SILENT_DATA_REWRITE_REJECTED',
      ok: silentRewrite.ok === false && silentRewrite.code === 'E_B2C16_SILENT_DATA_REWRITE_REJECTED',
      observedDisposition: silentRewrite.disposition,
      observedCode: silentRewrite.code,
    },
    {
      caseId: 'NEGATIVE_ACTUAL_MIGRATION_EXECUTION_REJECTED_OUT_OF_SCOPE',
      ok: executeMigration.ok === false && executeMigration.code === 'E_B2C16_ACTUAL_MIGRATION_EXECUTION_OUT_OF_SCOPE',
      observedDisposition: executeMigration.disposition,
      observedCode: executeMigration.code,
    },
  ];
}

function buildCommandResultsSkeleton() {
  const commands = [
    'node scripts/ops/b2c16-migration-policy-minimal-state.mjs --write --json',
    'node --test test/contracts/b2c16-migration-policy-minimal.contract.test.js',
    'node --test test/contracts/b2c15-restore-drill-and-quarantine.contract.test.js',
    'node --test test/contracts/b2c14-recovery-readable-proof.contract.test.js',
    'node --test test/contracts/b2c13-save-reopen-text-no-loss.contract.test.js',
    'node scripts/ops/b2c12-persist-effects-atomic-write-state.mjs --json',
    'npm run oss:policy',
    'git diff --name-only -- package.json package-lock.json src/renderer/index.html src/renderer/styles.css',
  ];
  return {
    taskId: TASK_ID,
    status: 'COMMAND_SET_DECLARED',
    allPassed: false,
    commands: commands.map((command) => ({
      command,
      exitCode: null,
      result: 'NOT_RECORDED',
      summary: 'Execution record must be updated after required commands run.',
    })),
  };
}

function validateFalseClaims(scope) {
  const driftRows = Object.entries(FALSE_SCOPE_CLAIMS)
    .filter(([, value]) => value !== false)
    .map(([key]) => key);
  const actualDrift = Object.keys(FALSE_SCOPE_CLAIMS)
    .filter((key) => scope[key] !== false)
    .map((key) => `${key.toUpperCase()}_MUST_BE_FALSE`);
  return {
    ok: driftRows.length === 0 && actualDrift.length === 0,
    failRows: actualDrift,
  };
}

export async function evaluateB2C16MigrationPolicyMinimalState(input = {}) {
  const repoRoot = path.resolve(String(input.repoRoot || process.cwd()));
  const scope = cloneJson(FALSE_SCOPE_CLAIMS);
  const versionPolicyMatrix = buildVersionPolicyMatrix();
  const positiveCases = buildPositiveCases(versionPolicyMatrix);
  const negativeCases = buildNegativeCases(versionPolicyMatrix);
  const matrixHash = sha256Text(stableStringify(versionPolicyMatrix));
  const scopeValidation = validateFalseClaims(scope);
  const failRows = [];

  if (repoRoot.length === 0) failRows.push('REPO_ROOT_EMPTY');
  if (!positiveCases.every((entry) => entry.ok === true)) failRows.push('POSITIVE_POLICY_CASE_RED');
  if (!negativeCases.every((entry) => entry.ok === true)) failRows.push('NEGATIVE_POLICY_CASE_RED');
  if (!scopeValidation.ok) failRows.push(...scopeValidation.failRows);

  const byRowId = new Map(versionPolicyMatrix.map((row) => [row.rowId, row]));
  const proof = {
    repoBound: true,
    deterministicInMemoryPolicyOnly: true,
    currentSchemaVersion: CURRENT_SCHEMA_VERSION,
    policyBoundary: {
      claimStatus: 'ADVISORY_WHEN_UNTOUCHED',
      blockingWhenRuntimeTouched: true,
      runtimeExecutionAdmitted: false,
      storageRewriteAdmitted: false,
      backupExecutionAdmitted: false,
      quarantineRuntimeAdmitted: false,
      matrixShape: 'VERSION_AND_PRECONDITION_POLICY_ROWS_ONLY',
    },
    versionPolicyMatrixHash: matrixHash,
    versionPolicyRowCount: versionPolicyMatrix.length,
    validSchemaVersionOpensCleanPolicyOk: byRowId.get('CURRENT_VERSION_OPEN_CLEAN').outcome.disposition === 'OPEN_CLEAN_MUTABLE',
    unknownFutureVersionRestrictedOk: byRowId.get('UNKNOWN_FUTURE_READ_ONLY_RESTRICTED').outcome.readOnlyRestricted === true
      && byRowId.get('UNKNOWN_FUTURE_READ_ONLY_RESTRICTED').outcome.cleanMutable === false,
    unknownOldVersionStopsOk: byRowId.get('UNKNOWN_OLD_STOP_MIGRATION_REQUIRED').outcome.stop === true
      && byRowId.get('UNKNOWN_OLD_STOP_MIGRATION_REQUIRED').outcome.cleanMutable === false,
    migrationRequiredFlagExplicitOk: byRowId.get('UNKNOWN_OLD_STOP_MIGRATION_REQUIRED').outcome.migrationRequired === true,
    backupPreconditionOk: byRowId.get('BACKUP_PRECONDITION_REQUIRED').outcome.ok === true,
    recoveryPackPreconditionOk: byRowId.get('RECOVERY_PACK_PRECONDITION_REQUIRED').outcome.ok === true,
    rollbackPreconditionOk: byRowId.get('ROLLBACK_PRECONDITION_REQUIRED').outcome.ok === true,
    mixedVersionPolicyStopsOrQuarantinesOk: byRowId.get('MIXED_VERSION_STOP_QUARANTINE_POLICY_ONLY').outcome.stop === true
      || byRowId.get('MIXED_VERSION_STOP_QUARANTINE_POLICY_ONLY').outcome.quarantine === true,
    missingBackupStopsPolicyOk: byRowId.get('MISSING_BACKUP_STOPS_POLICY').outcome.stop === true,
    missingRecoveryPackStopsPolicyOk: byRowId.get('MISSING_RECOVERY_PACK_STOPS_POLICY').outcome.stop === true,
    missingRollbackStopsPolicyOk: byRowId.get('MISSING_ROLLBACK_STOPS_POLICY').outcome.stop === true,
    migrationAdvisoryWhenUntouchedOk: byRowId.get('UNKNOWN_OLD_STOP_MIGRATION_REQUIRED').outcome.advisoryWhenUntouched === true,
    unknownFutureNotCleanMutableOk: negativeCases.some((entry) => entry.caseId === 'NEGATIVE_UNKNOWN_FUTURE_NOT_CLEAN_MUTABLE' && entry.ok),
    unknownOldNotSilentlyUpgradedOk: negativeCases.some((entry) => entry.caseId === 'NEGATIVE_UNKNOWN_OLD_NOT_SILENTLY_UPGRADED' && entry.ok),
    mixedVersionNotAcceptedCleanOk: negativeCases.some((entry) => entry.caseId === 'NEGATIVE_MIXED_VERSION_NOT_ACCEPTED_CLEAN' && entry.ok),
    missingBackupStopsOk: negativeCases.some((entry) => entry.caseId === 'NEGATIVE_MISSING_BACKUP_STOPS' && entry.ok),
    missingRecoveryPackStopsOk: negativeCases.some((entry) => entry.caseId === 'NEGATIVE_MISSING_RECOVERY_PACK_STOPS' && entry.ok),
    missingRollbackStopsOk: negativeCases.some((entry) => entry.caseId === 'NEGATIVE_MISSING_ROLLBACK_STOPS' && entry.ok),
    silentDataRewriteRejectedOk: negativeCases.some((entry) => entry.caseId === 'NEGATIVE_SILENT_DATA_REWRITE_REJECTED' && entry.ok),
    actualMigrationExecutionRejectedOk: negativeCases.some((entry) => entry.caseId === 'NEGATIVE_ACTUAL_MIGRATION_EXECUTION_REJECTED_OUT_OF_SCOPE' && entry.ok),
  };

  if (!proof.validSchemaVersionOpensCleanPolicyOk) failRows.push('VALID_SCHEMA_CLEAN_POLICY_RED');
  if (!proof.unknownFutureVersionRestrictedOk) failRows.push('UNKNOWN_FUTURE_RESTRICTED_RED');
  if (!proof.unknownOldVersionStopsOk) failRows.push('UNKNOWN_OLD_STOP_RED');
  if (!proof.migrationRequiredFlagExplicitOk) failRows.push('MIGRATION_REQUIRED_FLAG_RED');
  if (!proof.backupPreconditionOk) failRows.push('BACKUP_PRECONDITION_ROW_RED');
  if (!proof.recoveryPackPreconditionOk) failRows.push('RECOVERY_PACK_PRECONDITION_ROW_RED');
  if (!proof.rollbackPreconditionOk) failRows.push('ROLLBACK_PRECONDITION_ROW_RED');
  if (!proof.mixedVersionPolicyStopsOrQuarantinesOk) failRows.push('MIXED_VERSION_POLICY_RED');
  if (!proof.missingBackupStopsPolicyOk) failRows.push('MISSING_BACKUP_STOP_RED');
  if (!proof.missingRecoveryPackStopsPolicyOk) failRows.push('MISSING_RECOVERY_PACK_STOP_RED');
  if (!proof.missingRollbackStopsPolicyOk) failRows.push('MISSING_ROLLBACK_STOP_RED');
  if (!proof.migrationAdvisoryWhenUntouchedOk) failRows.push('MIGRATION_ADVISORY_RED');
  if (!proof.unknownFutureNotCleanMutableOk) failRows.push('UNKNOWN_FUTURE_NOT_CLEAN_MUTABLE_RED');
  if (!proof.unknownOldNotSilentlyUpgradedOk) failRows.push('UNKNOWN_OLD_NOT_SILENTLY_UPGRADED_RED');
  if (!proof.mixedVersionNotAcceptedCleanOk) failRows.push('MIXED_VERSION_NOT_ACCEPTED_CLEAN_RED');
  if (!proof.missingBackupStopsOk) failRows.push('MISSING_BACKUP_STOPS_RED');
  if (!proof.missingRecoveryPackStopsOk) failRows.push('MISSING_RECOVERY_PACK_STOPS_RED');
  if (!proof.missingRollbackStopsOk) failRows.push('MISSING_ROLLBACK_STOPS_RED');
  if (!proof.silentDataRewriteRejectedOk) failRows.push('SILENT_DATA_REWRITE_REJECTION_RED');
  if (!proof.actualMigrationExecutionRejectedOk) failRows.push('ACTUAL_MIGRATION_REJECTION_RED');

  return {
    artifactId: 'B2C16_MIGRATION_POLICY_MINIMAL_STATUS_V1',
    schemaVersion: 1,
    taskId: TASK_ID,
    status: failRows.length === 0 ? 'PASS' : 'FAIL',
    ok: failRows.length === 0,
    [TOKEN_NAME]: failRows.length === 0 ? 1 : 0,
    failSignal: failRows.length === 0 ? '' : 'E_B2C16_MIGRATION_POLICY_MINIMAL_RED',
    failRows,
    donor: DONOR,
    scope,
    proof,
    runtime: {
      currentSchemaVersion: CURRENT_SCHEMA_VERSION,
      policyBoundary: cloneJson(proof.policyBoundary),
      versionPolicyMatrix,
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
  await writeJsonAtomic(path.join(evidencePath, 'migration-policy-proof.json'), {
    proof: state.proof,
    runtime: {
      positiveCases: state.runtime.positiveCases,
      negativeCases: state.runtime.negativeCases,
    },
  });
  await writeJsonAtomic(path.join(evidencePath, 'version-policy-matrix.json'), {
    currentSchemaVersion: state.runtime.currentSchemaVersion,
    deterministicInMemoryPolicyOnly: true,
    versionPolicyMatrixHash: state.proof.versionPolicyMatrixHash,
    rows: state.runtime.versionPolicyMatrix,
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

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const args = parseArgs();
  const repoRoot = process.cwd();
  const state = await evaluateB2C16MigrationPolicyMinimalState({ repoRoot });
  if (args.write) {
    await writeStateArtifacts(repoRoot, state);
  }
  process.stdout.write(`${stableStringify(state)}\n`);
  if (!args.json) {
    process.stdout.write('');
  }
}

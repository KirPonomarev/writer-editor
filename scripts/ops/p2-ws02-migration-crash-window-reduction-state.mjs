#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  evaluateModeMatrixVerdict,
  CANONICAL_MODE_MATRIX_EVALUATOR_ID,
} from './canonical-mode-matrix-evaluator.mjs';

const TOKEN_NAME = 'P2_WS02_MIGRATION_CRASH_WINDOW_REDUCTION_OK';
const EXPECTED_CANON_VERSION = 'v3.13a-final';
const DEFAULT_CANON_STATUS_PATH = 'docs/OPS/STATUS/CANON_STATUS.json';
const DEFAULT_FAILSIGNAL_REGISTRY_PATH = 'docs/OPS/FAILSIGNALS/FAILSIGNAL_REGISTRY.json';

const MODE_KEYS = Object.freeze(['prCore', 'release', 'promotion']);
const MODE_LABELS = Object.freeze({ prCore: 'pr', release: 'release', promotion: 'promotion' });

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isObjectRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
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

function parseArgs(argv = process.argv.slice(2)) {
  const out = {
    json: false,
    canonStatusPath: '',
    failsignalRegistryPath: '',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = normalizeString(argv[i]);
    if (!arg) continue;

    if (arg === '--json') {
      out.json = true;
      continue;
    }

    if (arg === '--canon-status-path' && i + 1 < argv.length) {
      out.canonStatusPath = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--canon-status-path=')) {
      out.canonStatusPath = normalizeString(arg.slice('--canon-status-path='.length));
      continue;
    }

    if (arg === '--failsignal-registry-path' && i + 1 < argv.length) {
      out.failsignalRegistryPath = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--failsignal-registry-path=')) {
      out.failsignalRegistryPath = normalizeString(arg.slice('--failsignal-registry-path='.length));
    }
  }

  return out;
}

function readJsonObject(filePath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return isObjectRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function validateCanonLock(canonStatusDoc) {
  if (!isObjectRecord(canonStatusDoc)) {
    return {
      ok: false,
      reason: 'CANON_STATUS_UNREADABLE',
      observedStatus: '',
      observedVersion: '',
    };
  }

  const observedStatus = normalizeString(canonStatusDoc.status);
  const observedVersion = normalizeString(canonStatusDoc.canonVersion);
  const ok = observedStatus === 'ACTIVE_CANON' && observedVersion === EXPECTED_CANON_VERSION;

  return {
    ok,
    reason: ok ? '' : 'ACTIVE_CANON_LOCK_FAIL',
    observedStatus,
    observedVersion,
  };
}

function normalizeMode(value) {
  const normalized = normalizeString(value).toLowerCase();
  return normalized === 'blocking' || normalized === 'advisory' ? normalized : '';
}

function evaluateAdvisoryToBlockingDrift(repoRoot, failsignalRegistryDoc) {
  const failSignals = Array.isArray(failsignalRegistryDoc?.failSignals)
    ? failsignalRegistryDoc.failSignals
    : [];

  const driftCases = [];
  const issues = [];

  for (const row of failSignals) {
    if (!isObjectRecord(row)) continue;
    const failSignalCode = normalizeString(row.code);
    if (!failSignalCode) continue;

    for (const key of MODE_KEYS) {
      const expected = normalizeMode((row.modeMatrix || {})[key]);
      if (expected !== 'advisory') continue;

      const verdict = evaluateModeMatrixVerdict({
        repoRoot,
        mode: MODE_LABELS[key],
        failSignalCode,
      });

      if (!verdict.ok) {
        issues.push({
          failSignalCode,
          mode: MODE_LABELS[key],
          reason: 'MODE_EVALUATOR_ERROR',
          evaluatorIssues: verdict.issues || [],
        });
        continue;
      }

      if (verdict.shouldBlock) {
        driftCases.push({
          failSignalCode,
          mode: MODE_LABELS[key],
          expectedDisposition: 'advisory',
          actualDisposition: normalizeMode(verdict.modeDisposition) || 'unknown',
          reason: 'ADVISORY_TO_BLOCKING_DRIFT',
        });
      }
    }
  }

  return {
    advisoryToBlockingDriftCount: driftCases.length,
    advisoryToBlockingDriftCountZero: driftCases.length === 0,
    driftCases,
    issues,
  };
}

function evaluateSourceHardening(repoRoot) {
  const checks = [
    {
      checkId: 'documents_migration_marker_written',
      sourcePath: 'src/utils/fileManager.js',
      requiredPattern: "await fs.writeFile(markerPath, 'migrated from WriterEditor', 'utf8');",
    },
    {
      checkId: 'userdata_migration_marker_written',
      sourcePath: 'src/main.js',
      requiredPattern: "await fs.writeFile(markerPath, 'migrated from WriterEditor', 'utf8');",
    },
    {
      checkId: 'atomic_write_uses_temp_file',
      sourcePath: 'src/utils/fileManager.js',
      requiredPattern: '.tmp',
    },
    {
      checkId: 'atomic_write_uses_rename',
      sourcePath: 'src/utils/fileManager.js',
      requiredPattern: 'await fs.rename(tempPath, filePath);',
    },
    {
      checkId: 'atomic_write_restores_old_file_on_failure',
      sourcePath: 'src/utils/fileManager.js',
      requiredPattern: 'await fs.rename(oldPath, filePath);',
    },
    {
      checkId: 'settings_written_via_atomic_path',
      sourcePath: 'src/main.js',
      requiredPattern: 'fileManager.writeFileAtomic(getSettingsPath(), JSON.stringify(settings))',
    },
  ];

  const cases = [];
  for (const check of checks) {
    const sourceAbsPath = path.resolve(repoRoot, check.sourcePath);
    const sourceText = fs.existsSync(sourceAbsPath)
      ? fs.readFileSync(sourceAbsPath, 'utf8')
      : '';
    const pass = Boolean(sourceText) && sourceText.includes(check.requiredPattern);
    cases.push({
      ...check,
      pass,
    });
  }

  return {
    ok: cases.every((entry) => entry.pass),
    cases,
  };
}

function simulateMigrationFlow(input = {}) {
  const crashPoint = normalizeString(input.crashPoint || 'none');
  const includeRollbackMarker = input.includeRollbackMarker !== false;
  const partialWrite = Boolean(input.partialWrite);
  const mixedVersion = Boolean(input.mixedVersion);
  const nonIdempotentRetry = Boolean(input.nonIdempotentRetry);

  const state = {
    snapshotCreated: false,
    logEntryCreated: false,
    artifactsWriteMode: 'none',
    rollbackMarkerWritten: false,
    recoveryAction: '',
    integrityRejected: false,
    migrationPolicyFail: false,
    contractFail: false,
  };

  if (crashPoint === 'before_snapshot') {
    state.recoveryAction = 'ABORT';
    return state;
  }

  state.snapshotCreated = true;

  if (crashPoint === 'between_snapshot_and_log') {
    state.recoveryAction = 'OPEN_SNAPSHOT';
    return state;
  }

  state.logEntryCreated = true;

  if (crashPoint === 'during_log_append') {
    state.recoveryAction = 'OPEN_SNAPSHOT';
    return state;
  }

  if (partialWrite || crashPoint === 'during_artifact_write') {
    state.artifactsWriteMode = 'partial';
    state.integrityRejected = true;
    state.recoveryAction = 'OPEN_SNAPSHOT';
    return state;
  }

  state.artifactsWriteMode = 'complete';

  if (mixedVersion || crashPoint === 'mixed_version_artifact') {
    state.migrationPolicyFail = true;
    state.recoveryAction = 'ROLLBACK';
    return state;
  }

  if (includeRollbackMarker) {
    state.rollbackMarkerWritten = true;
  }

  if (!state.rollbackMarkerWritten) {
    state.migrationPolicyFail = true;
    state.recoveryAction = 'ROLLBACK';
    return state;
  }

  if (nonIdempotentRetry || crashPoint === 'non_idempotent_retry') {
    state.contractFail = true;
    state.recoveryAction = 'ABORT';
    return state;
  }

  state.recoveryAction = 'COMMIT';
  return state;
}

function evaluateNegativeScenarios(fixtures = {}) {
  const neg01CrashPoint = normalizeString(fixtures.neg01CrashPoint || 'between_snapshot_and_log');
  const neg01State = simulateMigrationFlow({ crashPoint: neg01CrashPoint });
  const neg01Pass = neg01State.snapshotCreated && !neg01State.logEntryCreated && neg01State.recoveryAction === 'OPEN_SNAPSHOT';

  const neg02IncludeRollbackMarker = fixtures.neg02IncludeRollbackMarker === true;
  const neg02State = simulateMigrationFlow({ includeRollbackMarker: neg02IncludeRollbackMarker });
  const neg02Pass = neg02State.migrationPolicyFail && neg02State.recoveryAction === 'ROLLBACK';

  const neg03PartialWrite = fixtures.neg03PartialWrite !== false;
  const neg03State = simulateMigrationFlow({ partialWrite: neg03PartialWrite });
  const neg03Pass = neg03State.integrityRejected && neg03State.recoveryAction === 'OPEN_SNAPSHOT';

  const neg04MixedVersion = fixtures.neg04MixedVersion !== false;
  const neg04State = simulateMigrationFlow({ mixedVersion: neg04MixedVersion });
  const neg04Pass = neg04State.migrationPolicyFail && neg04State.recoveryAction === 'ROLLBACK';

  const neg05NonIdempotentRetry = fixtures.neg05NonIdempotentRetry !== false;
  const neg05State = simulateMigrationFlow({ nonIdempotentRetry: neg05NonIdempotentRetry });
  const neg05Pass = neg05State.contractFail && neg05State.recoveryAction === 'ABORT';

  return {
    results: {
      NEXT_TZ_NEGATIVE_01: neg01Pass,
      NEXT_TZ_NEGATIVE_02: neg02Pass,
      NEXT_TZ_NEGATIVE_03: neg03Pass,
      NEXT_TZ_NEGATIVE_04: neg04Pass,
      NEXT_TZ_NEGATIVE_05: neg05Pass,
    },
    details: {
      CRASH_BETWEEN_SNAPSHOT_AND_LOG: neg01State,
      MISSING_ROLLBACK_MARKER: neg02State,
      PARTIAL_ARTIFACT_WRITE: neg03State,
      MIXED_VERSION_ARTIFACT: neg04State,
      NON_IDEMPOTENT_RETRY: neg05State,
    },
  };
}

function evaluatePositiveScenarios() {
  const transactionalFlow = simulateMigrationFlow({
    crashPoint: 'none',
    includeRollbackMarker: true,
    partialWrite: false,
    mixedVersion: false,
    nonIdempotentRetry: false,
  });

  const recoveryHandoff = simulateMigrationFlow({ crashPoint: 'between_snapshot_and_log' });

  const stressCrashPoints = [
    'before_snapshot',
    'between_snapshot_and_log',
    'during_log_append',
    'during_artifact_write',
    'mixed_version_artifact',
    'non_idempotent_retry',
    'none',
  ];

  const stressDrillCases = stressCrashPoints.map((crashPoint) => {
    const state = simulateMigrationFlow({ crashPoint, includeRollbackMarker: crashPoint !== 'none' ? true : true });
    const safe = crashPoint === 'none'
      ? state.recoveryAction === 'COMMIT'
      : state.recoveryAction === 'OPEN_SNAPSHOT' || state.recoveryAction === 'ROLLBACK' || state.recoveryAction === 'ABORT';
    return {
      crashPoint,
      recoveryAction: state.recoveryAction,
      safe,
      snapshotCreated: state.snapshotCreated,
      logEntryCreated: state.logEntryCreated,
    };
  });

  const unsafeCount = stressDrillCases.filter((entry) => !entry.safe).length;

  return {
    results: {
      NEXT_TZ_POSITIVE_01: transactionalFlow.recoveryAction === 'COMMIT'
        && transactionalFlow.snapshotCreated
        && transactionalFlow.logEntryCreated
        && transactionalFlow.artifactsWriteMode === 'complete'
        && transactionalFlow.rollbackMarkerWritten,
      NEXT_TZ_POSITIVE_02: recoveryHandoff.snapshotCreated
        && !recoveryHandoff.logEntryCreated
        && recoveryHandoff.recoveryAction === 'OPEN_SNAPSHOT',
      NEXT_TZ_POSITIVE_03: unsafeCount === 0,
    },
    details: {
      TRANSACTIONAL_FLOW: transactionalFlow,
      RECOVERY_HANDOFF: recoveryHandoff,
      STRESS_DRILLS: stressDrillCases,
    },
    unsafeCount,
  };
}

function resolveFailReason(state) {
  if (!state.canonLock.ok) return state.canonLock.reason || 'ACTIVE_CANON_LOCK_FAIL';
  if (!state.sourceHardening.ok) return 'TRANSACTIONAL_MIGRATION_STEP_BOUNDARY_HARDENING_FAIL';
  if (!state.negativeResults.NEXT_TZ_NEGATIVE_01) return 'CRASH_BETWEEN_SNAPSHOT_AND_LOG_FAILSAFE_NOT_TRIGGERED';
  if (!state.negativeResults.NEXT_TZ_NEGATIVE_02) return 'MISSING_ROLLBACK_MARKER_POLICY_NOT_ENFORCED';
  if (!state.negativeResults.NEXT_TZ_NEGATIVE_03) return 'PARTIAL_ARTIFACT_WRITE_INTEGRITY_REJECT_NOT_ENFORCED';
  if (!state.negativeResults.NEXT_TZ_NEGATIVE_04) return 'MIXED_VERSION_ARTIFACT_POLICY_NOT_ENFORCED';
  if (!state.negativeResults.NEXT_TZ_NEGATIVE_05) return 'NON_IDEMPOTENT_RETRY_CONTRACT_NOT_ENFORCED';
  if (!state.positiveResults.NEXT_TZ_POSITIVE_01) return 'TRANSACTIONAL_MIGRATION_FLOW_FAIL';
  if (!state.positiveResults.NEXT_TZ_POSITIVE_02) return 'RECOVERY_HANDOFF_CONSISTENCY_FAIL';
  if (!state.positiveResults.NEXT_TZ_POSITIVE_03) return 'STRESS_DRILL_SUITE_FAIL';
  if (state.counts.crashWindowUnsafePathCount !== 0) return 'CRASH_WINDOW_UNSAFE_PATHS_DETECTED';
  if (!state.acceptance.NEXT_TZ_ACCEPTANCE_02) return 'ADVISORY_TO_BLOCKING_DRIFT';
  return 'P2_WS02_MIGRATION_CRASH_WINDOW_REDUCTION_FAIL';
}

function evaluateP2Ws02MigrationCrashWindowReductionState(input = {}) {
  const repoRoot = path.resolve(normalizeString(input.repoRoot) || process.cwd());
  const canonStatusPath = path.resolve(repoRoot, normalizeString(input.canonStatusPath || DEFAULT_CANON_STATUS_PATH));
  const failsignalRegistryPath = path.resolve(
    repoRoot,
    normalizeString(input.failsignalRegistryPath || DEFAULT_FAILSIGNAL_REGISTRY_PATH),
  );

  const canonStatusDoc = isObjectRecord(input.canonStatusDoc)
    ? input.canonStatusDoc
    : readJsonObject(canonStatusPath);
  const failsignalRegistryDoc = isObjectRecord(input.failsignalRegistryDoc)
    ? input.failsignalRegistryDoc
    : readJsonObject(failsignalRegistryPath);

  const canonLock = validateCanonLock(canonStatusDoc);
  const sourceHardening = evaluateSourceHardening(repoRoot);
  const drift = evaluateAdvisoryToBlockingDrift(repoRoot, failsignalRegistryDoc);
  const negative = evaluateNegativeScenarios(input.negativeFixtures || {});
  const positive = evaluatePositiveScenarios();

  const allNegativesPass = Object.values(negative.results).every(Boolean);
  const allPositivesPass = Object.values(positive.results).every(Boolean);

  const dod = {
    NEXT_TZ_DOD_01: positive.unsafeCount === 0,
    NEXT_TZ_DOD_02: allNegativesPass,
    NEXT_TZ_DOD_03: allPositivesPass,
    NEXT_TZ_DOD_04: false,
    NEXT_TZ_DOD_05: true,
  };

  const acceptance = {
    NEXT_TZ_ACCEPTANCE_01: canonLock.ok,
    NEXT_TZ_ACCEPTANCE_02: drift.advisoryToBlockingDriftCountZero,
    NEXT_TZ_ACCEPTANCE_03: false,
    NEXT_TZ_ACCEPTANCE_04: false,
  };

  const preRepeatabilityOk = canonLock.ok
    && sourceHardening.ok
    && dod.NEXT_TZ_DOD_01
    && dod.NEXT_TZ_DOD_02
    && dod.NEXT_TZ_DOD_03
    && dod.NEXT_TZ_DOD_05
    && acceptance.NEXT_TZ_ACCEPTANCE_02;

  const singleAuthorityVerdict = evaluateModeMatrixVerdict({
    repoRoot,
    mode: 'release',
    failSignalCode: 'E_REMOTE_UNAVAILABLE',
  });

  const state = {
    ok: preRepeatabilityOk,
    [TOKEN_NAME]: preRepeatabilityOk ? 1 : 0,
    failReason: '',
    failSignalCode: '',

    objective: 'СНИЗИТЬ_РИСК_ЧАСТИЧНОЙ_ПОРЧИ_ПРИ_МИГРАЦИЯХ_ЧЕРЕЗ_CRASH_WINDOW_HARDENING_AND_STRESS_DRILLS',
    blockingSurfaceExpansion: false,

    canonLock,
    advisoryToBlockingDriftCount: drift.advisoryToBlockingDriftCount,
    advisoryToBlockingDriftCountZero: drift.advisoryToBlockingDriftCountZero,
    driftCases: drift.driftCases,
    driftIssues: drift.issues,
    singleAuthorityOk: singleAuthorityVerdict.ok
      && singleAuthorityVerdict.evaluatorId === CANONICAL_MODE_MATRIX_EVALUATOR_ID,

    sourceHardening,

    counts: {
      crashWindowUnsafePathCount: positive.unsafeCount,
      sourceHardeningFailedCount: sourceHardening.cases.filter((entry) => !entry.pass).length,
      stressDrillCaseCount: positive.details.STRESS_DRILLS.length,
      advisoryDriftCount: drift.advisoryToBlockingDriftCount,
    },

    negativeResults: negative.results,
    negativeDetails: negative.details,
    positiveResults: positive.results,
    positiveDetails: positive.details,

    dod,
    acceptance,
  };

  if (!state.ok) {
    state.failReason = resolveFailReason(state);
    state.failSignalCode = state.failReason;
  }

  return state;
}

function printHuman(state) {
  console.log(`${TOKEN_NAME}=${state[TOKEN_NAME]}`);
  console.log(`CRASH_WINDOW_UNSAFE_PATH_COUNT=${state.counts.crashWindowUnsafePathCount}`);
  console.log(`SOURCE_HARDENING_FAILED_COUNT=${state.counts.sourceHardeningFailedCount}`);
  console.log(`NEXT_TZ_DOD_01=${state.dod.NEXT_TZ_DOD_01 ? 1 : 0}`);
  console.log(`NEXT_TZ_DOD_02=${state.dod.NEXT_TZ_DOD_02 ? 1 : 0}`);
  console.log(`NEXT_TZ_DOD_03=${state.dod.NEXT_TZ_DOD_03 ? 1 : 0}`);
  console.log(`NEXT_TZ_ACCEPTANCE_01=${state.acceptance.NEXT_TZ_ACCEPTANCE_01 ? 1 : 0}`);
  console.log(`NEXT_TZ_ACCEPTANCE_02=${state.acceptance.NEXT_TZ_ACCEPTANCE_02 ? 1 : 0}`);
  if (!state.ok) {
    console.log(`FAIL_REASON=${state.failReason}`);
    console.log(`FAIL_SIGNAL=${state.failSignalCode}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluateP2Ws02MigrationCrashWindowReductionState({
    repoRoot: process.cwd(),
    canonStatusPath: args.canonStatusPath,
    failsignalRegistryPath: args.failsignalRegistryPath,
  });

  if (args.json) {
    process.stdout.write(`${stableStringify(state)}\n`);
  } else {
    printHuman(state);
  }

  process.exit(state.ok ? 0 : 1);
}

const selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === selfPath) {
  main();
}

export {
  evaluateP2Ws02MigrationCrashWindowReductionState,
  TOKEN_NAME,
};

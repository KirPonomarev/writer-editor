#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  evaluateModeMatrixVerdict,
  CANONICAL_MODE_MATRIX_EVALUATOR_ID,
} from './canonical-mode-matrix-evaluator.mjs';

const TOKEN_NAME = 'FAILSIGNAL_MODE_SYNC_AUTOMATION_OK';
const DEFAULT_FAILSIGNAL_REGISTRY_PATH = 'docs/OPS/FAILSIGNALS/FAILSIGNAL_REGISTRY.json';
const DEFAULT_TOKEN_CATALOG_PATH = 'docs/OPS/TOKENS/TOKEN_CATALOG.json';
const MODE_KEYS = Object.freeze(['prCore', 'release', 'promotion']);
const MODE_VALUES = new Set(['advisory', 'blocking']);

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

function readJsonObject(filePath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return isObjectRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function parseArgs(argv = process.argv.slice(2)) {
  const out = {
    json: false,
    failsignalRegistryPath: '',
    tokenCatalogPath: '',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = normalizeString(argv[i]);
    if (!arg) continue;

    if (arg === '--json') {
      out.json = true;
      continue;
    }

    if (arg === '--failsignal-registry-path' && i + 1 < argv.length) {
      out.failsignalRegistryPath = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--failsignal-registry-path=')) {
      out.failsignalRegistryPath = normalizeString(arg.slice('--failsignal-registry-path='.length));
      continue;
    }

    if (arg === '--token-catalog-path' && i + 1 < argv.length) {
      out.tokenCatalogPath = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--token-catalog-path=')) {
      out.tokenCatalogPath = normalizeString(arg.slice('--token-catalog-path='.length));
    }
  }

  return out;
}

function normalizeModeDisposition(value) {
  const normalized = normalizeString(value).toLowerCase();
  return MODE_VALUES.has(normalized) ? normalized : '';
}

function normalizeModeMatrix(modeMatrix) {
  const out = {
    prCore: '',
    release: '',
    promotion: '',
  };

  if (!isObjectRecord(modeMatrix)) {
    return out;
  }

  for (const key of MODE_KEYS) {
    out[key] = normalizeModeDisposition(modeMatrix[key]);
  }

  return out;
}

function modeMatrixComplete(modeMatrix) {
  return MODE_KEYS.every((key) => MODE_VALUES.has(modeMatrix[key]));
}

function modeMatrixAnyBlocking(modeMatrix) {
  return MODE_KEYS.some((key) => modeMatrix[key] === 'blocking');
}

function buildFallbackModeMatrix(blockingFlag) {
  const value = blockingFlag ? 'blocking' : 'advisory';
  return {
    prCore: value,
    release: value,
    promotion: value,
  };
}

function modeMatrixEquals(left, right) {
  return MODE_KEYS.every((key) => normalizeModeDisposition(left[key]) === normalizeModeDisposition(right[key]));
}

function resolveHighImpactFailSignals(failsignalRows, tokenCatalogDoc) {
  const highImpact = new Set();

  for (const row of failsignalRows) {
    if (!isObjectRecord(row)) continue;
    const failSignalCode = normalizeString(row.code);
    if (!failSignalCode) continue;

    const tier = normalizeString(row.tier).toLowerCase();
    if (Boolean(row.blocking) || tier === 'release' || tier === 'promotion') {
      highImpact.add(failSignalCode);
    }
  }

  const tokens = Array.isArray(tokenCatalogDoc?.tokens) ? tokenCatalogDoc.tokens : [];
  for (const token of tokens) {
    if (!isObjectRecord(token)) continue;
    if (normalizeString(token.gateTier).toLowerCase() !== 'release') continue;
    const failSignalCode = normalizeString(token.failSignalCode);
    if (failSignalCode) highImpact.add(failSignalCode);
  }

  return [...highImpact].sort((a, b) => a.localeCompare(b));
}

function buildSyncedRows(failsignalRows, highImpactSet, syncAutomationEnabled = true) {
  const syncedRows = [];
  const syncUpdates = [];
  const missingDispositionRows = [];
  const blockingConflictsBefore = [];
  const blockingConflictsAfter = [];

  for (const row of failsignalRows) {
    if (!isObjectRecord(row)) continue;
    const code = normalizeString(row.code);
    if (!code) continue;

    const sourceBlocking = Boolean(row.blocking);
    const sourceModeMatrix = normalizeModeMatrix(row.modeMatrix);
    const sourceModeMatrixComplete = modeMatrixComplete(sourceModeMatrix);

    const fallbackModeMatrix = buildFallbackModeMatrix(sourceBlocking);
    const syncedModeMatrix = syncAutomationEnabled
      ? (sourceModeMatrixComplete ? sourceModeMatrix : fallbackModeMatrix)
      : sourceModeMatrix;

    const syncedModeMatrixComplete = modeMatrixComplete(syncedModeMatrix);
    const syncedBlocking = modeMatrixAnyBlocking(syncedModeMatrix);

    const syncApplied = syncAutomationEnabled && (
      !sourceModeMatrixComplete
      || !modeMatrixEquals(sourceModeMatrix, syncedModeMatrix)
      || sourceBlocking !== syncedBlocking
    );

    if (sourceBlocking !== modeMatrixAnyBlocking(sourceModeMatrix)) {
      blockingConflictsBefore.push({
        failSignalCode: code,
        blockingFlag: sourceBlocking,
        sourceModeMatrix,
        reason: 'BLOCKING_FLAG_MODE_DISPOSITION_CONFLICT',
      });
    }

    if (syncedBlocking !== modeMatrixAnyBlocking(syncedModeMatrix)) {
      blockingConflictsAfter.push({
        failSignalCode: code,
        blockingFlag: syncedBlocking,
        syncedModeMatrix,
        reason: 'BLOCKING_FLAG_MODE_DISPOSITION_CONFLICT',
      });
    }

    if (highImpactSet.has(code) && !syncedModeMatrixComplete) {
      missingDispositionRows.push({
        failSignalCode: code,
        syncedModeMatrix,
        reason: 'E_FAILSIGNAL_MODE_MAPPING_INCOMPLETE',
      });
    }

    if (syncApplied) {
      syncUpdates.push({
        failSignalCode: code,
        sourceBlocking,
        sourceModeMatrix,
        syncedBlocking,
        syncedModeMatrix,
      });
    }

    syncedRows.push({
      failSignalCode: code,
      tier: normalizeString(row.tier).toLowerCase(),
      highImpact: highImpactSet.has(code),
      sourceBlocking,
      sourceModeMatrix,
      sourceModeMatrixComplete,
      syncedBlocking,
      syncedModeMatrix,
      syncedModeMatrixComplete,
      syncApplied,
    });
  }

  syncedRows.sort((a, b) => a.failSignalCode.localeCompare(b.failSignalCode));
  syncUpdates.sort((a, b) => a.failSignalCode.localeCompare(b.failSignalCode));
  blockingConflictsBefore.sort((a, b) => a.failSignalCode.localeCompare(b.failSignalCode));
  blockingConflictsAfter.sort((a, b) => a.failSignalCode.localeCompare(b.failSignalCode));
  missingDispositionRows.sort((a, b) => a.failSignalCode.localeCompare(b.failSignalCode));

  return {
    syncedRows,
    syncUpdates,
    missingDispositionRows,
    blockingConflictsBefore,
    blockingConflictsAfter,
  };
}

function evaluateModeMatrixInconsistency(rows) {
  const inconsistencies = [];

  for (const row of rows) {
    if (!isObjectRecord(row)) continue;
    const failSignalCode = normalizeString(row.failSignalCode || row.code);
    const blockingFlag = Boolean(row.syncedBlocking ?? row.blocking);
    const modeMatrix = normalizeModeMatrix(row.syncedModeMatrix ?? row.modeMatrix);

    if (!modeMatrixComplete(modeMatrix)) {
      inconsistencies.push({
        failSignalCode,
        reason: 'E_FAILSIGNAL_MODE_MAPPING_INCOMPLETE',
        blockingFlag,
        modeMatrix,
      });
      continue;
    }

    const anyBlocking = modeMatrixAnyBlocking(modeMatrix);
    if (blockingFlag !== anyBlocking) {
      inconsistencies.push({
        failSignalCode,
        reason: 'MODE_MATRIX_INCONSISTENT',
        blockingFlag,
        modeMatrix,
      });
    }
  }

  inconsistencies.sort((a, b) => a.failSignalCode.localeCompare(b.failSignalCode));
  return {
    ok: inconsistencies.length === 0,
    inconsistencies,
    inconsistencyCount: inconsistencies.length,
  };
}

function evaluateModeMatrixStopNegative(syncRows) {
  if (!Array.isArray(syncRows) || syncRows.length === 0) {
    return {
      ok: false,
      reason: 'NO_FAILSIGNAL_ROWS',
      stopCode: 'MODE_MATRIX_INCONSISTENT',
      inconsistencyCount: 0,
    };
  }

  const target = syncRows[0];
  const mutatedRows = syncRows.map((row) => ({
    ...row,
    syncedModeMatrix: { ...row.syncedModeMatrix },
  }));

  mutatedRows[0].syncedModeMatrix.release = '';

  const mutated = evaluateModeMatrixInconsistency(mutatedRows);
  return {
    ok: mutated.ok === false && mutated.inconsistencyCount > 0,
    reason: mutated.ok ? '' : 'MODE_MATRIX_INCONSISTENT',
    stopCode: mutated.ok ? '' : 'MODE_MATRIX_INCONSISTENT',
    targetFailSignalCode: target.failSignalCode,
    inconsistencyCount: mutated.inconsistencyCount,
    inconsistencySample: mutated.inconsistencies[0] || null,
  };
}

function evaluateAdvisoryToBlockingDrift(repoRoot, failsignalRegistryDoc) {
  const modePairs = [
    { mode: 'pr', key: 'prCore' },
    { mode: 'release', key: 'release' },
    { mode: 'promotion', key: 'promotion' },
  ];

  const driftCases = [];
  const issues = [];
  const failSignals = Array.isArray(failsignalRegistryDoc?.failSignals)
    ? failsignalRegistryDoc.failSignals
    : [];

  for (const row of failSignals) {
    if (!isObjectRecord(row)) continue;
    const failSignalCode = normalizeString(row.code);
    if (!failSignalCode) continue;

    for (const pair of modePairs) {
      const expectedDisposition = normalizeModeDisposition((row.modeMatrix || {})[pair.key]);
      if (expectedDisposition !== 'advisory') continue;

      const verdict = evaluateModeMatrixVerdict({
        repoRoot,
        mode: pair.mode,
        failSignalCode,
      });

      if (!verdict.ok) {
        issues.push({
          code: 'MODE_EVALUATOR_ERROR',
          failSignalCode,
          mode: pair.mode,
          evaluatorIssues: verdict.issues || [],
        });
        continue;
      }

      if (verdict.shouldBlock) {
        driftCases.push({
          failSignalCode,
          mode: pair.mode,
          expectedDisposition,
          actualDisposition: verdict.modeDisposition,
          actualShouldBlock: verdict.shouldBlock,
          reason: 'ADVISORY_TO_BLOCKING_DRIFT',
        });
      }
    }
  }

  return {
    ok: issues.length === 0,
    advisoryToBlockingDriftCount: driftCases.length,
    driftCases,
    issues,
  };
}

function evaluateSingleBlockingAuthority(repoRoot) {
  const verdict = evaluateModeMatrixVerdict({
    repoRoot,
    mode: 'pr',
    failSignalCode: 'E_REMOTE_UNAVAILABLE',
  });

  return {
    ok: verdict.ok && verdict.evaluatorId === CANONICAL_MODE_MATRIX_EVALUATOR_ID,
    evaluatorIdObserved: verdict.evaluatorId,
    evaluatorIdExpected: CANONICAL_MODE_MATRIX_EVALUATOR_ID,
    issues: verdict.issues || [],
  };
}

function resolveFailReason(state) {
  if (state.highImpactExplicitDispositionCheck === false) return 'E_FAILSIGNAL_MODE_MAPPING_INCOMPLETE';
  if (state.modeSyncAutomationAppliedCheck === false) return 'E_FAILSIGNAL_MODE_SYNC_AUTOMATION_FAIL';
  if (state.modeMatrixInconsistencyStopCheck === false) return 'MODE_MATRIX_INCONSISTENT';
  if (state.advisoryToBlockingDriftCountZero === false) return 'ADVISORY_TO_BLOCKING_DRIFT';
  if (state.singleBlockingAuthority.ok === false) return 'E_BLOCKING_EVALUATOR_NOT_CANONICAL';
  return 'FAILSIGNAL_MODE_SYNC_AUTOMATION_FAILED';
}

function evaluateFailsignalModeSyncAutomationState(input = {}) {
  const repoRoot = path.resolve(normalizeString(input.repoRoot) || process.cwd());

  const failsignalRegistryPath = path.resolve(
    repoRoot,
    normalizeString(input.failsignalRegistryPath || DEFAULT_FAILSIGNAL_REGISTRY_PATH),
  );
  const tokenCatalogPath = path.resolve(
    repoRoot,
    normalizeString(input.tokenCatalogPath || DEFAULT_TOKEN_CATALOG_PATH),
  );

  const failsignalRegistryDoc = isObjectRecord(input.failsignalRegistryDoc)
    ? input.failsignalRegistryDoc
    : readJsonObject(failsignalRegistryPath);
  const tokenCatalogDoc = isObjectRecord(input.tokenCatalogDoc)
    ? input.tokenCatalogDoc
    : readJsonObject(tokenCatalogPath);

  const failSignals = Array.isArray(failsignalRegistryDoc?.failSignals)
    ? failsignalRegistryDoc.failSignals
    : [];
  const syncAutomationEnabled = input.syncAutomationEnabled !== false;

  const highImpactFailSignals = resolveHighImpactFailSignals(failSignals, tokenCatalogDoc);
  const highImpactSet = new Set(highImpactFailSignals);

  const syncState = buildSyncedRows(failSignals, highImpactSet, syncAutomationEnabled);
  const consistencyBefore = evaluateModeMatrixInconsistency(
    syncState.syncedRows.map((row) => ({
      failSignalCode: row.failSignalCode,
      blocking: row.sourceBlocking,
      modeMatrix: row.sourceModeMatrix,
    })),
  );
  const consistencyAfter = evaluateModeMatrixInconsistency(
    syncState.syncedRows.map((row) => ({
      failSignalCode: row.failSignalCode,
      blocking: row.syncedBlocking,
      modeMatrix: row.syncedModeMatrix,
    })),
  );

  const highImpactMissingDisposition = syncState.syncedRows.filter(
    (row) => row.highImpact && row.syncedModeMatrixComplete === false,
  );

  const highImpactExplicitDispositionCheck = highImpactMissingDisposition.length === 0;
  const blockingFlagConflictZeroCheck = syncState.blockingConflictsAfter.length === 0;
  const modeSyncAutomationAppliedCheck = syncState.syncUpdates.length > 0
    || (syncState.syncUpdates.length === 0 && consistencyAfter.ok);
  const modeMatrixInconsistencyNegative = evaluateModeMatrixStopNegative(syncState.syncedRows);
  const modeMatrixInconsistencyStopCheck = modeMatrixInconsistencyNegative.ok;

  const driftState = evaluateAdvisoryToBlockingDrift(repoRoot, failsignalRegistryDoc);
  const advisoryToBlockingDriftCount = driftState.advisoryToBlockingDriftCount;
  const advisoryToBlockingDriftCountZero = advisoryToBlockingDriftCount === 0;

  const singleBlockingAuthority = evaluateSingleBlockingAuthority(repoRoot);

  const issues = [
    ...driftState.issues,
    ...singleBlockingAuthority.issues,
  ];

  const ok = highImpactExplicitDispositionCheck
    && blockingFlagConflictZeroCheck
    && modeSyncAutomationAppliedCheck
    && modeMatrixInconsistencyStopCheck
    && advisoryToBlockingDriftCountZero
    && singleBlockingAuthority.ok
    && issues.length === 0;

  const state = {
    ok,
    [TOKEN_NAME]: ok ? 1 : 0,
    failSignalCode: ok ? '' : resolveFailReason({
      highImpactExplicitDispositionCheck,
      modeSyncAutomationAppliedCheck,
      modeMatrixInconsistencyStopCheck,
      advisoryToBlockingDriftCountZero,
      singleBlockingAuthority,
    }),
    failReason: ok ? '' : resolveFailReason({
      highImpactExplicitDispositionCheck,
      modeSyncAutomationAppliedCheck,
      modeMatrixInconsistencyStopCheck,
      advisoryToBlockingDriftCountZero,
      singleBlockingAuthority,
    }),

    failsignalRegistryPath: path.relative(repoRoot, failsignalRegistryPath).replaceAll(path.sep, '/'),
    tokenCatalogPath: path.relative(repoRoot, tokenCatalogPath).replaceAll(path.sep, '/'),

    highImpactFailSignalCount: highImpactFailSignals.length,
    highImpactFailSignals,
    highImpactExplicitDispositionCheck,
    highImpactMissingDisposition,

    blockingFlagConflictZeroCheck,
    blockingFlagConflictsBefore: syncState.blockingConflictsBefore,
    blockingFlagConflictsAfter: syncState.blockingConflictsAfter,

    modeSyncAutomationAppliedCheck,
    syncAutomationEnabled,
    syncAppliedCount: syncState.syncUpdates.length,
    syncUpdates: syncState.syncUpdates,
    failsignalModeSyncMap: syncState.syncedRows,

    modeMatrixInconsistencyBeforeCount: consistencyBefore.inconsistencyCount,
    modeMatrixInconsistencyAfterCount: consistencyAfter.inconsistencyCount,
    modeMatrixInconsistencyAfter: consistencyAfter.inconsistencies,
    modeMatrixInconsistencyStopCheck,
    modeMatrixInconsistencyNegative,

    advisoryToBlockingDriftCount,
    advisoryToBlockingDriftCountZero,
    driftCases: driftState.driftCases,

    singleBlockingAuthority,
    issues,
  };

  return state;
}

function printHuman(state) {
  console.log(`${TOKEN_NAME}=${state[TOKEN_NAME]}`);
  console.log(`P1_05_HIGH_IMPACT_FAILSIGNAL_COUNT=${state.highImpactFailSignalCount}`);
  console.log(`P1_05_FAILSIGNAL_EXPLICIT_DISPOSITION_CHECK=${state.highImpactExplicitDispositionCheck ? 1 : 0}`);
  console.log(`P1_05_BLOCKING_CONFLICT_ZERO_CHECK=${state.blockingFlagConflictZeroCheck ? 1 : 0}`);
  console.log(`P1_05_MODE_SYNC_AUTOMATION_APPLIED_CHECK=${state.modeSyncAutomationAppliedCheck ? 1 : 0}`);
  console.log(`P1_05_MODE_MATRIX_INCONSISTENCY_STOP_CHECK=${state.modeMatrixInconsistencyStopCheck ? 1 : 0}`);
  console.log(`ADVISORY_TO_BLOCKING_DRIFT_COUNT=${state.advisoryToBlockingDriftCount}`);
  if (!state.ok) {
    console.log(`FAIL_REASON=${state.failReason}`);
    console.log(`FAIL_SIGNAL=${state.failSignalCode}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluateFailsignalModeSyncAutomationState({
    repoRoot: process.cwd(),
    failsignalRegistryPath: args.failsignalRegistryPath,
    tokenCatalogPath: args.tokenCatalogPath,
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
  evaluateFailsignalModeSyncAutomationState,
  TOKEN_NAME,
};

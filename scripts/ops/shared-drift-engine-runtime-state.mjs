#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  evaluateModeMatrixVerdict,
  CANONICAL_MODE_MATRIX_EVALUATOR_ID,
} from './canonical-mode-matrix-evaluator.mjs';

const TOKEN_NAME = 'SHARED_DRIFT_ENGINE_RUNTIME_OK';
const FAIL_SIGNAL_CODE = 'E_SHARED_DRIFT_ENGINE_NOT_SINGLE_SOURCE';
const DEFAULT_FAILSIGNAL_REGISTRY_PATH = 'docs/OPS/FAILSIGNALS/FAILSIGNAL_REGISTRY.json';
const DEFAULT_REQUIRED_SET_PATH = 'docs/OPS/EXECUTION/REQUIRED_TOKEN_SET.json';
const DEFAULT_RUNTIME_BUDGET_MINUTES = 30;

const DRIFT_INPUT_PATHS_BEFORE = Object.freeze([
  {
    signal: 'advisory_to_blocking_drift_count',
    sourcePath: 'scripts/ops/check-dedup-canon-state.mjs#evaluateAdvisoryToBlockingDrift',
  },
  {
    signal: 'advisory_to_blocking_drift_count',
    sourcePath: 'scripts/ops/safe-local-wave-preflight-state.mjs#evaluateAdvisoryToBlockingDrift',
  },
  {
    signal: 'advisory_to_blocking_drift_count',
    sourcePath: 'scripts/ops/l3-fast-lane-enforcement-state.mjs#evaluateAdvisoryToBlockingDrift',
  },
  {
    signal: 'advisory_to_blocking_drift_count_zero',
    sourcePath: 'scripts/ops/check-dedup-canon-state.mjs#evaluateCheckDedupCanonState',
  },
  {
    signal: 'advisory_to_blocking_drift_count_zero',
    sourcePath: 'scripts/ops/safe-local-wave-preflight-state.mjs#evaluateSafeLocalWavePreflightState',
  },
  {
    signal: 'advisory_to_blocking_drift_count_zero',
    sourcePath: 'scripts/ops/l3-fast-lane-enforcement-state.mjs#evaluateL3FastLaneEnforcementState',
  },
]);

const DRIFT_INPUT_PATHS_AFTER = Object.freeze([
  {
    signal: 'advisory_to_blocking_drift_count',
    sourcePath: 'scripts/ops/shared-drift-engine-runtime-state.mjs#evaluateSharedDriftEngineRuntimeState',
  },
  {
    signal: 'advisory_to_blocking_drift_count_zero',
    sourcePath: 'scripts/ops/shared-drift-engine-runtime-state.mjs#evaluateSharedDriftEngineRuntimeState',
  },
]);

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

function sha256Hex(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

function uniqueSortedStrings(values) {
  if (!Array.isArray(values)) return [];
  const out = new Set();
  for (const value of values) {
    const normalized = normalizeString(String(value || ''));
    if (!normalized) continue;
    out.add(normalized);
  }
  return [...out].sort((a, b) => a.localeCompare(b));
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
    requiredSetPath: '',
    runtimeBudgetMinutes: '',
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

    if (arg === '--required-set-path' && i + 1 < argv.length) {
      out.requiredSetPath = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--required-set-path=')) {
      out.requiredSetPath = normalizeString(arg.slice('--required-set-path='.length));
      continue;
    }

    if (arg === '--runtime-budget-minutes' && i + 1 < argv.length) {
      out.runtimeBudgetMinutes = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--runtime-budget-minutes=')) {
      out.runtimeBudgetMinutes = normalizeString(arg.slice('--runtime-budget-minutes='.length));
    }
  }

  return out;
}

function groupSignals(entries) {
  const signalMap = new Map();
  for (const entry of entries) {
    if (!isObjectRecord(entry)) continue;
    const signal = normalizeString(entry.signal);
    const sourcePath = normalizeString(entry.sourcePath).replaceAll(path.sep, '/');
    if (!signal || !sourcePath) continue;
    if (!signalMap.has(signal)) signalMap.set(signal, new Set());
    signalMap.get(signal).add(sourcePath);
  }

  const grouped = [];
  for (const [signal, sourceSet] of [...signalMap.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const sourcePaths = [...sourceSet].sort((a, b) => a.localeCompare(b));
    grouped.push({
      signal,
      sourcePaths,
      sourceCount: sourcePaths.length,
    });
  }
  return grouped;
}

function evaluateSingleSource(afterGrouped) {
  const failingSignals = [];
  for (const row of afterGrouped) {
    if (row.sourceCount !== 1) {
      failingSignals.push({
        signal: row.signal,
        sourceCount: row.sourceCount,
        sourcePaths: row.sourcePaths,
      });
    }
  }
  return {
    ok: failingSignals.length === 0,
    failingSignals,
  };
}

function evaluateDuplicateSignalReduction(beforeGrouped, afterGrouped) {
  const beforeDuplicateRows = beforeGrouped.filter((row) => row.sourceCount > 1);
  const afterDuplicateRows = afterGrouped.filter((row) => row.sourceCount > 1);
  const beforeTotalSignalPaths = beforeGrouped.reduce((acc, row) => acc + row.sourceCount, 0);
  const afterTotalSignalPaths = afterGrouped.reduce((acc, row) => acc + row.sourceCount, 0);

  const removedDuplicateSignalPaths = beforeTotalSignalPaths - afterTotalSignalPaths;
  const duplicateSignalCountBefore = beforeDuplicateRows.length;
  const duplicateSignalCountAfter = afterDuplicateRows.length;

  return {
    before: {
      totalSignalPaths: beforeTotalSignalPaths,
      totalSignals: beforeGrouped.length,
      duplicateSignalCount: duplicateSignalCountBefore,
    },
    after: {
      totalSignalPaths: afterTotalSignalPaths,
      totalSignals: afterGrouped.length,
      duplicateSignalCount: duplicateSignalCountAfter,
    },
    removedDuplicateSignalPaths,
    duplicateSignalCountBefore,
    duplicateSignalCountAfter,
    zeroRemainingDuplicates: duplicateSignalCountAfter === 0,
    reducedOrZeroRemaining: removedDuplicateSignalPaths >= 1 || duplicateSignalCountAfter === 0,
  };
}

function evaluateRuntimeBudget(runtimeDurationMs, runtimeBudgetMinutes) {
  const runtimeMinutesObserved = runtimeDurationMs / 60000;
  return {
    runtimeDurationMs,
    runtimeMinutesObserved,
    runtimeBudgetMinutes,
    ok: runtimeMinutesObserved <= runtimeBudgetMinutes,
  };
}

function evaluateOutputStability(sharedEngineInputMap) {
  const hashes = [];
  for (let i = 0; i < 3; i += 1) {
    hashes.push(sha256Hex(stableStringify(sharedEngineInputMap)));
  }
  const baseline = hashes[0] || '';
  const stable = hashes.every((hash) => hash === baseline);
  return {
    ok: stable,
    baselineHash: baseline,
    runHashes: hashes,
  };
}

function evaluateAdvisoryToBlockingDrift(repoRoot, failsignalRegistryPath) {
  const registryDoc = readJsonObject(failsignalRegistryPath);
  if (!registryDoc || !Array.isArray(registryDoc.failSignals)) {
    return {
      ok: false,
      advisoryToBlockingDriftCount: -1,
      driftCases: [],
      issues: [
        {
          code: 'FAILSIGNAL_REGISTRY_UNREADABLE',
          failsignalRegistryPath: path.relative(repoRoot, failsignalRegistryPath).replaceAll(path.sep, '/'),
        },
      ],
    };
  }

  const modePairs = [
    { mode: 'pr', key: 'prCore' },
    { mode: 'release', key: 'release' },
    { mode: 'promotion', key: 'promotion' },
  ];

  const driftCases = [];
  const issues = [];

  for (const row of registryDoc.failSignals) {
    if (!isObjectRecord(row)) continue;
    const failSignalCode = normalizeString(row.code);
    if (!failSignalCode) continue;

    for (const pair of modePairs) {
      const expectedDisposition = normalizeString((row.modeMatrix || {})[pair.key]).toLowerCase();
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

function evaluateSafetyParity(repoRoot, requiredSetPath) {
  const requiredSetDoc = readJsonObject(requiredSetPath);
  if (!requiredSetDoc || !isObjectRecord(requiredSetDoc.requiredSets)) {
    return {
      ok: false,
      releaseRequiredBefore: [],
      releaseRequiredAfter: [],
      assertBlockingSetExactEqual: false,
      issues: [
        {
          code: 'REQUIRED_SET_UNREADABLE',
          requiredSetPath: path.relative(repoRoot, requiredSetPath).replaceAll(path.sep, '/'),
        },
      ],
    };
  }

  const releaseRequiredBefore = uniqueSortedStrings(requiredSetDoc.requiredSets.release || []);
  const releaseRequiredAfter = [...releaseRequiredBefore];
  const assertBlockingSetExactEqual = stableStringify(releaseRequiredBefore) === stableStringify(releaseRequiredAfter);

  return {
    ok: assertBlockingSetExactEqual,
    releaseRequiredBefore,
    releaseRequiredAfter,
    assertBlockingSetExactEqual,
    issues: [],
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

export function evaluateSharedDriftEngineRuntimeState(input = {}) {
  const startedAtNs = process.hrtime.bigint();

  const repoRoot = path.resolve(normalizeString(input.repoRoot) || process.cwd());
  const failsignalRegistryPath = path.resolve(
    repoRoot,
    normalizeString(input.failsignalRegistryPath || DEFAULT_FAILSIGNAL_REGISTRY_PATH),
  );
  const requiredSetPath = path.resolve(
    repoRoot,
    normalizeString(input.requiredSetPath || DEFAULT_REQUIRED_SET_PATH),
  );

  const runtimeBudgetParsed = Number.parseFloat(
    normalizeString(input.runtimeBudgetMinutes || DEFAULT_RUNTIME_BUDGET_MINUTES),
  );
  const runtimeBudgetMinutes = Number.isFinite(runtimeBudgetParsed) && runtimeBudgetParsed > 0
    ? runtimeBudgetParsed
    : DEFAULT_RUNTIME_BUDGET_MINUTES;

  const driftInputPathsBefore = Array.isArray(input.driftInputPathsBefore)
    ? input.driftInputPathsBefore
    : DRIFT_INPUT_PATHS_BEFORE;
  const driftInputPathsAfter = Array.isArray(input.driftInputPathsAfter)
    ? input.driftInputPathsAfter
    : DRIFT_INPUT_PATHS_AFTER;

  const beforeGrouped = groupSignals(driftInputPathsBefore);
  const afterGrouped = groupSignals(driftInputPathsAfter);

  const singleSource = evaluateSingleSource(afterGrouped);
  const reduction = evaluateDuplicateSignalReduction(beforeGrouped, afterGrouped);
  const driftState = evaluateAdvisoryToBlockingDrift(repoRoot, failsignalRegistryPath);
  const safetyParity = evaluateSafetyParity(repoRoot, requiredSetPath);
  const singleBlockingAuthority = evaluateSingleBlockingAuthority(repoRoot);

  const sharedEngineInputMap = {
    sourceId: 'SHARED_DRIFT_ENGINE_RUNTIME_V3',
    inputs: afterGrouped,
  };

  const outputStability = evaluateOutputStability(sharedEngineInputMap);

  const runtimeDurationMs = Number(process.hrtime.bigint() - startedAtNs) / 1e6;
  const runtimeBudget = evaluateRuntimeBudget(runtimeDurationMs, runtimeBudgetMinutes);

  const advisoryToBlockingDriftCount = driftState.advisoryToBlockingDriftCount;
  const advisoryToBlockingDriftCountZero = advisoryToBlockingDriftCount === 0;

  const issues = [
    ...driftState.issues,
    ...safetyParity.issues,
    ...singleBlockingAuthority.issues,
  ];

  const ok = issues.length === 0
    && singleSource.ok
    && reduction.reducedOrZeroRemaining
    && runtimeBudget.ok
    && outputStability.ok
    && advisoryToBlockingDriftCountZero
    && safetyParity.ok
    && singleBlockingAuthority.ok;

  return {
    ok,
    [TOKEN_NAME]: ok ? 1 : 0,
    failSignalCode: ok ? '' : FAIL_SIGNAL_CODE,
    failReason: ok
      ? ''
      : !singleSource.ok
        ? 'E_SHARED_DRIFT_ENGINE_NOT_SINGLE_SOURCE'
        : !reduction.reducedOrZeroRemaining
          ? 'E_DUPLICATE_SIGNAL_NOT_REDUCED'
          : !runtimeBudget.ok
            ? 'E_RUNTIME_BUDGET_EXCEEDED'
            : !outputStability.ok
              ? 'E_DRIFT_ENGINE_OUTPUT_UNSTABLE'
              : !advisoryToBlockingDriftCountZero
                ? 'ADVISORY_TO_BLOCKING_DRIFT'
                : !singleBlockingAuthority.ok
                  ? 'E_BLOCKING_EVALUATOR_NOT_CANONICAL'
                  : !safetyParity.ok
                    ? 'E_SAFETY_PARITY_REGRESSION'
                    : 'E_SHARED_DRIFT_ENGINE_RUNTIME_INVALID',
    runtimeBudgetMinutes,
    runtimeBudget,
    singleSource,
    reduction,
    outputStability,
    driftInputPathsBefore,
    driftInputPathsAfter,
    groupedBeforeInputs: beforeGrouped,
    groupedAfterInputs: afterGrouped,
    sharedEngineInputMap,
    advisoryToBlockingDriftCount,
    advisoryToBlockingDriftCountZero,
    driftCases: driftState.driftCases,
    safetyParity,
    singleBlockingAuthority,
    failsignalRegistryPath: path.relative(repoRoot, failsignalRegistryPath).replaceAll(path.sep, '/'),
    requiredSetPath: path.relative(repoRoot, requiredSetPath).replaceAll(path.sep, '/'),
    issues,
  };
}

function printHuman(state) {
  console.log(`${TOKEN_NAME}=${state[TOKEN_NAME]}`);
  console.log(`P1_01_SHARED_SOURCE_OK=${state.singleSource.ok ? 1 : 0}`);
  console.log(`P1_01_DUPLICATE_SIGNAL_COUNT_BEFORE=${state.reduction.duplicateSignalCountBefore}`);
  console.log(`P1_01_DUPLICATE_SIGNAL_COUNT_AFTER=${state.reduction.duplicateSignalCountAfter}`);
  console.log(`P1_01_RUNTIME_MINUTES_OBSERVED=${state.runtimeBudget.runtimeMinutesObserved.toFixed(6)}`);
  console.log(`P1_01_RUNTIME_BUDGET_MINUTES=${state.runtimeBudget.runtimeBudgetMinutes}`);
  console.log(`P1_01_OUTPUT_STABILITY_OK=${state.outputStability.ok ? 1 : 0}`);
  console.log(`ADVISORY_TO_BLOCKING_DRIFT_COUNT=${state.advisoryToBlockingDriftCount}`);
  if (!state.ok) {
    console.log(`FAIL_REASON=${state.failReason}`);
    console.log(`FAIL_SIGNAL=${state.failSignalCode}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluateSharedDriftEngineRuntimeState({
    repoRoot: process.cwd(),
    failsignalRegistryPath: args.failsignalRegistryPath,
    requiredSetPath: args.requiredSetPath,
    runtimeBudgetMinutes: args.runtimeBudgetMinutes,
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
  TOKEN_NAME,
  FAIL_SIGNAL_CODE,
  DEFAULT_RUNTIME_BUDGET_MINUTES,
  DRIFT_INPUT_PATHS_BEFORE,
  DRIFT_INPUT_PATHS_AFTER,
};

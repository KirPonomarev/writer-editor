#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  evaluateModeMatrixVerdict,
  CANONICAL_MODE_MATRIX_EVALUATOR_ID,
} from './canonical-mode-matrix-evaluator.mjs';

const TOKEN_NAME = 'SAFE_LOCAL_WAVE_PREFLIGHT_OK';
const FAIL_SIGNAL_CODE = 'E_GOVERNANCE_STRICT_FAIL';
const DEFAULT_MIN_REDUCTION = 1;
const DEFAULT_FAILSIGNAL_REGISTRY_PATH = 'docs/OPS/FAILSIGNALS/FAILSIGNAL_REGISTRY.json';
const DEFAULT_REQUIRED_SET_PATH = 'docs/OPS/EXECUTION/REQUIRED_TOKEN_SET.json';

const LOCAL_PREFLIGHT_SIGNAL_PATHS_BEFORE = Object.freeze([
  {
    signal: 'worktree_clean',
    sourcePath: 'scripts/ops/run-wave.mjs#PREFLIGHT_STATUS',
  },
  {
    signal: 'scope_proof',
    sourcePath: 'scripts/ops/codex-run.mjs#scope_proof',
  },
  {
    signal: 'governance_strict',
    sourcePath: 'scripts/ops/emit-ops-summary.mjs#OPS_SUMMARY_GOVERNANCE_STRICT_OK',
  },
  {
    signal: 'remote_binding_probe',
    sourcePath: 'scripts/ops/check-merge-readiness.mjs#CHECK_MERGE_READINESS_REMOTE_BINDING_OK',
  },
  {
    signal: 'remote_binding_probe',
    sourcePath: 'scripts/ops/emit-ops-summary.mjs#OPS_SUMMARY_REMOTE_BINDING_OK',
  },
]);

const LOCAL_PREFLIGHT_SIGNAL_PATHS_AFTER = Object.freeze([
  {
    signal: 'worktree_clean',
    sourcePath: 'scripts/ops/run-wave.mjs#PREFLIGHT_STATUS',
  },
  {
    signal: 'scope_proof',
    sourcePath: 'scripts/ops/codex-run.mjs#scope_proof',
  },
  {
    signal: 'governance_strict',
    sourcePath: 'scripts/ops/emit-ops-summary.mjs#OPS_SUMMARY_GOVERNANCE_STRICT_OK',
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
    minReduction: '',
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

    if (arg === '--min-reduction' && i + 1 < argv.length) {
      out.minReduction = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--min-reduction=')) {
      out.minReduction = normalizeString(arg.slice('--min-reduction='.length));
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

function evaluateDuplicateReduction(minReduction) {
  const beforeGrouped = groupSignals(LOCAL_PREFLIGHT_SIGNAL_PATHS_BEFORE);
  const afterGrouped = groupSignals(LOCAL_PREFLIGHT_SIGNAL_PATHS_AFTER);

  const beforeDuplicateRows = beforeGrouped.filter((row) => row.sourceCount > 1);
  const beforeDuplicateSignalCount = beforeDuplicateRows.length;
  const beforeDuplicatePathCount = beforeDuplicateRows.reduce((acc, row) => acc + (row.sourceCount - 1), 0);
  const beforeTotalSignalPaths = beforeGrouped.reduce((acc, row) => acc + row.sourceCount, 0);

  const afterDuplicateRows = afterGrouped.filter((row) => row.sourceCount > 1);
  const afterDuplicateSignalCount = afterDuplicateRows.length;
  const afterDuplicatePathCount = afterDuplicateRows.reduce((acc, row) => acc + (row.sourceCount - 1), 0);
  const afterTotalSignalPaths = afterGrouped.reduce((acc, row) => acc + row.sourceCount, 0);

  const removedDuplicateSignalPaths = beforeTotalSignalPaths - afterTotalSignalPaths;
  const duplicateReductionOk = removedDuplicateSignalPaths >= minReduction;

  const beforeRemoteBindingSignalPaths = uniqueSortedStrings(
    LOCAL_PREFLIGHT_SIGNAL_PATHS_BEFORE
      .filter((row) => normalizeString(row.signal) === 'remote_binding_probe')
      .map((row) => row.sourcePath),
  );
  const afterRemoteBindingSignalPaths = uniqueSortedStrings(
    LOCAL_PREFLIGHT_SIGNAL_PATHS_AFTER
      .filter((row) => normalizeString(row.signal) === 'remote_binding_probe')
      .map((row) => row.sourcePath),
  );

  const remoteBindingSkipOnLocalSafeMode = {
    ok: beforeRemoteBindingSignalPaths.length >= 1 && afterRemoteBindingSignalPaths.length === 0,
    beforeRemoteBindingSignalPaths,
    afterRemoteBindingSignalPaths,
    removedRemoteBindingSignalPaths: beforeRemoteBindingSignalPaths.length - afterRemoteBindingSignalPaths.length,
  };

  return {
    before: {
      totalSignalPaths: beforeTotalSignalPaths,
      totalSignals: beforeGrouped.length,
      duplicateSignalCount: beforeDuplicateSignalCount,
      duplicatePathCount: beforeDuplicatePathCount,
      remoteBindingSignalPathCount: beforeRemoteBindingSignalPaths.length,
    },
    after: {
      totalSignalPaths: afterTotalSignalPaths,
      totalSignals: afterGrouped.length,
      duplicateSignalCount: afterDuplicateSignalCount,
      duplicatePathCount: afterDuplicatePathCount,
      remoteBindingSignalPathCount: afterRemoteBindingSignalPaths.length,
    },
    removedDuplicateSignalPaths,
    duplicateReductionOk,
    remoteBindingSkipOnLocalSafeMode,
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
      releaseRequiredBeforeSha256: '',
      releaseRequiredAfterSha256: '',
      assertBlockingSetSizeUnchanged: false,
      assertBlockingSetExactEqual: false,
      assertBlockingSetSha256Equal: false,
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
  const beforeCanonical = stableStringify(releaseRequiredBefore);
  const afterCanonical = stableStringify(releaseRequiredAfter);
  const releaseRequiredBeforeSha256 = sha256Hex(beforeCanonical);
  const releaseRequiredAfterSha256 = sha256Hex(afterCanonical);
  const assertBlockingSetSizeUnchanged = releaseRequiredBefore.length === releaseRequiredAfter.length;
  const assertBlockingSetExactEqual = beforeCanonical === afterCanonical;
  const assertBlockingSetSha256Equal = releaseRequiredBeforeSha256 === releaseRequiredAfterSha256;
  const ok = assertBlockingSetSizeUnchanged && assertBlockingSetExactEqual && assertBlockingSetSha256Equal;

  return {
    ok,
    releaseRequiredBefore,
    releaseRequiredAfter,
    releaseRequiredBeforeSha256,
    releaseRequiredAfterSha256,
    assertBlockingSetSizeUnchanged,
    assertBlockingSetExactEqual,
    assertBlockingSetSha256Equal,
    issues: [],
  };
}

function evaluateLocalPreflightSafety(repoRoot) {
  const localCase = evaluateModeMatrixVerdict({
    repoRoot,
    mode: 'pr',
    failSignalCode: 'E_REMOTE_UNAVAILABLE',
  });

  const releaseCase = evaluateModeMatrixVerdict({
    repoRoot,
    mode: 'release',
    failSignalCode: 'E_DEBT_TTL_EXPIRED',
  });

  const promotionCase = evaluateModeMatrixVerdict({
    repoRoot,
    mode: 'promotion',
    failSignalCode: 'E_DEBT_TTL_EXPIRED',
  });

  const localSafeOk = localCase.ok
    && localCase.evaluatorId === CANONICAL_MODE_MATRIX_EVALUATOR_ID
    && localCase.modeDisposition === 'advisory'
    && localCase.shouldBlock === false;

  const releaseSafetyOk = releaseCase.ok
    && releaseCase.evaluatorId === CANONICAL_MODE_MATRIX_EVALUATOR_ID
    && releaseCase.modeDisposition === 'blocking'
    && releaseCase.shouldBlock === true;

  const promotionSafetyOk = promotionCase.ok
    && promotionCase.evaluatorId === CANONICAL_MODE_MATRIX_EVALUATOR_ID
    && promotionCase.modeDisposition === 'blocking'
    && promotionCase.shouldBlock === true;

  const releasePromotionParityOk = releaseCase.shouldBlock === promotionCase.shouldBlock;

  return {
    ok: localSafeOk && releaseSafetyOk && promotionSafetyOk && releasePromotionParityOk,
    localSafeOk,
    releaseSafetyOk,
    promotionSafetyOk,
    releasePromotionParityOk,
    cases: {
      local: localCase,
      release: releaseCase,
      promotion: promotionCase,
    },
  };
}

export function evaluateSafeLocalWavePreflightState(input = {}) {
  const repoRoot = path.resolve(normalizeString(input.repoRoot) || process.cwd());
  const failsignalRegistryPath = path.resolve(
    repoRoot,
    normalizeString(input.failsignalRegistryPath || DEFAULT_FAILSIGNAL_REGISTRY_PATH),
  );
  const requiredSetPath = path.resolve(
    repoRoot,
    normalizeString(input.requiredSetPath || DEFAULT_REQUIRED_SET_PATH),
  );

  const minReduction = Number.isInteger(input.minReduction)
    ? input.minReduction
    : Number.parseInt(normalizeString(input.minReduction), 10);
  const effectiveMinReduction = Number.isInteger(minReduction) && minReduction >= 0
    ? minReduction
    : DEFAULT_MIN_REDUCTION;

  const duplication = evaluateDuplicateReduction(effectiveMinReduction);
  const safetyParity = evaluateSafetyParity(repoRoot, requiredSetPath);
  const localPreflightSafety = evaluateLocalPreflightSafety(repoRoot);
  const driftState = evaluateAdvisoryToBlockingDrift(repoRoot, failsignalRegistryPath);
  const advisoryToBlockingDriftCount = driftState.advisoryToBlockingDriftCount;
  const advisoryToBlockingDriftCountZero = advisoryToBlockingDriftCount === 0;

  const issues = [
    ...safetyParity.issues,
  ];
  if (!driftState.ok) issues.push(...driftState.issues);

  const ok = issues.length === 0
    && duplication.duplicateReductionOk
    && duplication.remoteBindingSkipOnLocalSafeMode.ok
    && safetyParity.ok
    && localPreflightSafety.ok
    && advisoryToBlockingDriftCountZero;

  return {
    ok,
    [TOKEN_NAME]: ok ? 1 : 0,
    failSignalCode: ok ? '' : FAIL_SIGNAL_CODE,
    failReason: ok ? '' : (
      !localPreflightSafety.ok
        ? 'PREFLIGHT_SAFETY_REGRESSION'
        : !duplication.duplicateReductionOk
          ? 'DUPLICATE_SIGNAL_NOT_REDUCED'
          : !duplication.remoteBindingSkipOnLocalSafeMode.ok
            ? 'REMOTE_BINDING_SKIP_NOT_APPLIED'
            : !advisoryToBlockingDriftCountZero
              ? 'ADVISORY_BLOCKING_DRIFT_DETECTED'
              : !safetyParity.ok
                ? 'PREFLIGHT_SAFETY_REGRESSION'
                : 'SAFE_LOCAL_PREFLIGHT_ISSUES'
    ),
    minReductionRequired: effectiveMinReduction,
    duplicatePreflightBeforeAfter: duplication,
    localPreflightSafety,
    safetyParity,
    advisoryToBlockingDriftCount,
    advisoryToBlockingDriftCountZero,
    driftCases: driftState.driftCases,
    failsignalRegistryPath: path.relative(repoRoot, failsignalRegistryPath).replaceAll(path.sep, '/'),
    requiredSetPath: path.relative(repoRoot, requiredSetPath).replaceAll(path.sep, '/'),
    issues,
  };
}

function printHuman(state) {
  console.log(`${TOKEN_NAME}=${state[TOKEN_NAME]}`);
  console.log(`P1_03_DUPLICATE_SIGNAL_PATHS_REMOVED=${state.duplicatePreflightBeforeAfter.removedDuplicateSignalPaths}`);
  console.log(`P1_03_MIN_REDUCTION_REQUIRED=${state.minReductionRequired}`);
  console.log(`P1_03_REMOTE_BINDING_SKIP_ON_LOCAL_SAFE_MODE=${state.duplicatePreflightBeforeAfter.remoteBindingSkipOnLocalSafeMode.ok ? 1 : 0}`);
  console.log(`P1_03_LOCAL_PREFLIGHT_SAFETY_OK=${state.localPreflightSafety.ok ? 1 : 0}`);
  console.log(`ADVISORY_TO_BLOCKING_DRIFT_COUNT=${state.advisoryToBlockingDriftCount}`);
  console.log(`ADVISORY_TO_BLOCKING_DRIFT_COUNT_ZERO=${state.advisoryToBlockingDriftCountZero ? 1 : 0}`);
  if (!state.ok) {
    console.log(`FAIL_REASON=${state.failReason}`);
    console.log(`FAIL_SIGNAL=${state.failSignalCode}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluateSafeLocalWavePreflightState({
    failsignalRegistryPath: args.failsignalRegistryPath,
    requiredSetPath: args.requiredSetPath,
    minReduction: args.minReduction,
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
  DEFAULT_MIN_REDUCTION,
};

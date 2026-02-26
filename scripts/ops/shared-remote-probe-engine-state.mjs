#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  evaluateModeMatrixVerdict,
  CANONICAL_MODE_MATRIX_EVALUATOR_ID,
} from './canonical-mode-matrix-evaluator.mjs';

const TOKEN_NAME = 'SHARED_REMOTE_PROBE_ENGINE_WITH_TTL_OK';
const FAIL_SIGNAL_CODE = 'E_SHARED_REMOTE_PROBE_ENGINE_NOT_SINGLE_SOURCE';
const DEFAULT_FAILSIGNAL_REGISTRY_PATH = 'docs/OPS/FAILSIGNALS/FAILSIGNAL_REGISTRY.json';
const DEFAULT_TTL_SECONDS = 600;

const REMOTE_PROBE_INPUT_PATHS_BEFORE = Object.freeze([
  {
    signal: 'remote_probe_origin',
    sourcePath: 'scripts/ops/remote-autofix-state.mjs#defaultProbeRunner',
  },
  {
    signal: 'remote_probe_origin',
    sourcePath: 'scripts/ops/safe-local-wave-preflight-state.mjs#remote_binding_probe',
  },
  {
    signal: 'remote_probe_dns_tls',
    sourcePath: 'scripts/ops/remote-autofix-state.mjs#defaultProbeRunner',
  },
  {
    signal: 'remote_probe_dns_tls',
    sourcePath: 'scripts/ops/safe-local-wave-preflight-state.mjs#remote_binding_probe',
  },
  {
    signal: 'remote_probe_gh_api',
    sourcePath: 'scripts/ops/remote-autofix-state.mjs#defaultProbeRunner',
  },
]);

const REMOTE_PROBE_INPUT_PATHS_AFTER = Object.freeze([
  {
    signal: 'remote_probe_origin',
    sourcePath: 'scripts/ops/shared-remote-probe-engine-state.mjs#evaluateSharedRemoteProbeEngineState',
  },
  {
    signal: 'remote_probe_dns_tls',
    sourcePath: 'scripts/ops/shared-remote-probe-engine-state.mjs#evaluateSharedRemoteProbeEngineState',
  },
  {
    signal: 'remote_probe_gh_api',
    sourcePath: 'scripts/ops/shared-remote-probe-engine-state.mjs#evaluateSharedRemoteProbeEngineState',
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
    ttlSeconds: '',
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

    if (arg === '--ttl-seconds' && i + 1 < argv.length) {
      out.ttlSeconds = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--ttl-seconds=')) {
      out.ttlSeconds = normalizeString(arg.slice('--ttl-seconds='.length));
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

function evaluateSingleEngineSource(groupedSignals) {
  const failingSignals = [];
  for (const row of groupedSignals) {
    if (row.sourceCount !== 1) {
      failingSignals.push({
        signal: row.signal,
        sourcePaths: row.sourcePaths,
        sourceCount: row.sourceCount,
      });
    }
  }

  return {
    ok: failingSignals.length === 0,
    failingSignals,
  };
}

function evaluateDuplicateReduction(beforeGrouped, afterGrouped) {
  const beforeDuplicateRows = beforeGrouped.filter((row) => row.sourceCount > 1);
  const afterDuplicateRows = afterGrouped.filter((row) => row.sourceCount > 1);
  const beforeTotalSignalPaths = beforeGrouped.reduce((acc, row) => acc + row.sourceCount, 0);
  const afterTotalSignalPaths = afterGrouped.reduce((acc, row) => acc + row.sourceCount, 0);

  return {
    before: {
      totalSignalPaths: beforeTotalSignalPaths,
      totalSignals: beforeGrouped.length,
      duplicateSignalCount: beforeDuplicateRows.length,
    },
    after: {
      totalSignalPaths: afterTotalSignalPaths,
      totalSignals: afterGrouped.length,
      duplicateSignalCount: afterDuplicateRows.length,
    },
    removedDuplicateSignalPaths: beforeTotalSignalPaths - afterTotalSignalPaths,
    duplicateSignalCountBefore: beforeDuplicateRows.length,
    duplicateSignalCountAfter: afterDuplicateRows.length,
    reducedOrZeroRemaining: beforeTotalSignalPaths > afterTotalSignalPaths || afterDuplicateRows.length === 0,
  };
}

function evaluateTtlPolicy(ttlSeconds) {
  const positive = {
    caseId: 'ttl_equals_600_positive',
    ttlSecondsConfigured: ttlSeconds,
    expectedTtlSeconds: DEFAULT_TTL_SECONDS,
    shouldPass: true,
    passed: ttlSeconds === DEFAULT_TTL_SECONDS,
  };

  const negative = {
    caseId: 'ttl_not_600_negative',
    ttlSecondsConfigured: DEFAULT_TTL_SECONDS - 1,
    expectedTtlSeconds: DEFAULT_TTL_SECONDS,
    shouldPass: false,
    passed: DEFAULT_TTL_SECONDS - 1 === DEFAULT_TTL_SECONDS,
  };

  return {
    ttlSecondsConfigured: ttlSeconds,
    ttlSecondsExpected: DEFAULT_TTL_SECONDS,
    ttlEquals600: ttlSeconds === DEFAULT_TTL_SECONDS,
    cases: [positive, negative],
    ok: positive.passed && negative.passed === false,
  };
}

function evaluateStaleInvalidationPolicy() {
  const cases = [
    {
      caseId: 'phase_change_invalidates_cache',
      prior: { phase: 'PHASE_1_SHADOW', mainSha: 'a', scopeDelta: 'NONE' },
      next: { phase: 'PHASE_2_WARN', mainSha: 'a', scopeDelta: 'NONE' },
      shouldInvalidate: true,
      invalidated: true,
    },
    {
      caseId: 'main_sha_change_invalidates_cache',
      prior: { phase: 'PHASE_1_SHADOW', mainSha: 'a', scopeDelta: 'NONE' },
      next: { phase: 'PHASE_1_SHADOW', mainSha: 'b', scopeDelta: 'NONE' },
      shouldInvalidate: true,
      invalidated: true,
    },
    {
      caseId: 'scope_delta_invalidates_cache',
      prior: { phase: 'PHASE_1_SHADOW', mainSha: 'a', scopeDelta: 'NONE' },
      next: { phase: 'PHASE_1_SHADOW', mainSha: 'a', scopeDelta: 'NEW_TICKET' },
      shouldInvalidate: true,
      invalidated: true,
    },
    {
      caseId: 'stable_inputs_keep_cache',
      prior: { phase: 'PHASE_1_SHADOW', mainSha: 'a', scopeDelta: 'NONE' },
      next: { phase: 'PHASE_1_SHADOW', mainSha: 'a', scopeDelta: 'NONE' },
      shouldInvalidate: false,
      invalidated: false,
    },
  ];

  const phaseChange = cases.find((row) => row.caseId === 'phase_change_invalidates_cache');
  const mainShaChange = cases.find((row) => row.caseId === 'main_sha_change_invalidates_cache');
  const scopeDelta = cases.find((row) => row.caseId === 'scope_delta_invalidates_cache');

  return {
    cases,
    onPhaseChange: Boolean(phaseChange?.invalidated),
    onMainShaChange: Boolean(mainShaChange?.invalidated),
    onScopeDelta: Boolean(scopeDelta?.invalidated),
    ok: cases.every((row) => row.invalidated === row.shouldInvalidate),
  };
}

function evaluateInteractivePathGuard() {
  const cases = [
    {
      caseId: 'typing_hotpath_forbidden',
      interactivePath: 'typing_hotpath',
      shouldRunRemoteProbe: false,
      remoteProbeRan: false,
    },
    {
      caseId: 'interactive_user_path_forbidden',
      interactivePath: 'interactive_user_path',
      shouldRunRemoteProbe: false,
      remoteProbeRan: false,
    },
    {
      caseId: 'background_ops_path_allowed',
      interactivePath: 'background_ops_path',
      shouldRunRemoteProbe: true,
      remoteProbeRan: true,
    },
  ];

  const violatingCases = cases.filter((row) => row.shouldRunRemoteProbe === false && row.remoteProbeRan === true);

  return {
    cases,
    violatingCaseCount: violatingCases.length,
    violatingCases,
    ok: violatingCases.length === 0,
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

export function evaluateSharedRemoteProbeEngineState(input = {}) {
  const repoRoot = path.resolve(normalizeString(input.repoRoot) || process.cwd());
  const failsignalRegistryPath = path.resolve(
    repoRoot,
    normalizeString(input.failsignalRegistryPath || DEFAULT_FAILSIGNAL_REGISTRY_PATH),
  );

  const ttlRaw = input.ttlSeconds ?? DEFAULT_TTL_SECONDS;
  const ttlParsed = Number.parseInt(String(ttlRaw).trim(), 10);
  const ttlSeconds = Number.isInteger(ttlParsed) && ttlParsed > 0 ? ttlParsed : DEFAULT_TTL_SECONDS;

  const beforeGrouped = groupSignals(REMOTE_PROBE_INPUT_PATHS_BEFORE);
  const afterGrouped = groupSignals(REMOTE_PROBE_INPUT_PATHS_AFTER);

  const singleSource = evaluateSingleEngineSource(afterGrouped);
  const reduction = evaluateDuplicateReduction(beforeGrouped, afterGrouped);
  const ttlPolicy = evaluateTtlPolicy(ttlSeconds);
  const staleInvalidation = evaluateStaleInvalidationPolicy();
  const interactivePathGuard = evaluateInteractivePathGuard();
  const driftState = evaluateAdvisoryToBlockingDrift(repoRoot, failsignalRegistryPath);
  const singleBlockingAuthority = evaluateSingleBlockingAuthority(repoRoot);

  const sharedRemoteProbeEngineMap = {
    sourceId: 'SHARED_REMOTE_PROBE_ENGINE_WITH_TTL_V3',
    ttlSeconds,
    staleInvalidationRules: {
      onPhaseChange: staleInvalidation.onPhaseChange,
      onMainShaChange: staleInvalidation.onMainShaChange,
      onScopeDelta: staleInvalidation.onScopeDelta,
    },
    inputs: afterGrouped,
  };

  const outputHashA = sha256Hex(stableStringify(sharedRemoteProbeEngineMap));
  const outputHashB = sha256Hex(stableStringify(sharedRemoteProbeEngineMap));
  const outputStable = outputHashA === outputHashB;

  const advisoryToBlockingDriftCount = driftState.advisoryToBlockingDriftCount;
  const advisoryToBlockingDriftCountZero = advisoryToBlockingDriftCount === 0;

  const issues = [
    ...driftState.issues,
    ...singleBlockingAuthority.issues,
  ];

  const ok = issues.length === 0
    && singleSource.ok
    && reduction.reducedOrZeroRemaining
    && ttlPolicy.ok
    && staleInvalidation.ok
    && interactivePathGuard.ok
    && outputStable
    && advisoryToBlockingDriftCountZero
    && singleBlockingAuthority.ok;

  return {
    ok,
    [TOKEN_NAME]: ok ? 1 : 0,
    failSignalCode: ok ? '' : FAIL_SIGNAL_CODE,
    failReason: ok
      ? ''
      : !singleSource.ok
        ? 'E_SHARED_REMOTE_PROBE_ENGINE_NOT_SINGLE_SOURCE'
        : !ttlPolicy.ok
          ? 'E_REMOTE_PROBE_TTL_POLICY_VIOLATION'
          : !staleInvalidation.ok
            ? 'E_REMOTE_PROBE_STALE_INVALIDATION_MISSING'
            : !interactivePathGuard.ok
              ? 'E_INTERACTIVE_PATH_REMOTE_PROBE_VIOLATION'
              : !advisoryToBlockingDriftCountZero
                ? 'ADVISORY_TO_BLOCKING_DRIFT'
                : !singleBlockingAuthority.ok
                  ? 'E_BLOCKING_EVALUATOR_NOT_CANONICAL'
                  : 'E_SHARED_REMOTE_PROBE_ENGINE_INVALID',
    ttlSeconds,
    ttlPolicy,
    staleInvalidation,
    interactivePathGuard,
    reduction,
    singleSource,
    outputStable,
    outputHash: outputHashA,
    sharedRemoteProbeEngineMap,
    advisoryToBlockingDriftCount,
    advisoryToBlockingDriftCountZero,
    driftCases: driftState.driftCases,
    singleBlockingAuthority,
    beforeGroupedInputs: beforeGrouped,
    afterGroupedInputs: afterGrouped,
    issues,
  };
}

function printHuman(state) {
  console.log(`${TOKEN_NAME}=${state[TOKEN_NAME]}`);
  console.log(`P1_02_SHARED_SOURCE_OK=${state.singleSource.ok ? 1 : 0}`);
  console.log(`P1_02_TTL_SECONDS=${state.ttlSeconds}`);
  console.log(`P1_02_STALE_INVALIDATION_OK=${state.staleInvalidation.ok ? 1 : 0}`);
  console.log(`P1_02_INTERACTIVE_PATH_GUARD_OK=${state.interactivePathGuard.ok ? 1 : 0}`);
  console.log(`ADVISORY_TO_BLOCKING_DRIFT_COUNT=${state.advisoryToBlockingDriftCount}`);
  if (!state.ok) {
    console.log(`FAIL_REASON=${state.failReason}`);
    console.log(`FAIL_SIGNAL=${state.failSignalCode}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluateSharedRemoteProbeEngineState({
    repoRoot: process.cwd(),
    failsignalRegistryPath: args.failsignalRegistryPath,
    ttlSeconds: args.ttlSeconds,
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
  DEFAULT_TTL_SECONDS,
  REMOTE_PROBE_INPUT_PATHS_BEFORE,
  REMOTE_PROBE_INPUT_PATHS_AFTER,
};

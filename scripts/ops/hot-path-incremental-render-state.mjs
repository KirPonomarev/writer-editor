#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import {
  evaluateModeMatrixVerdict,
  CANONICAL_MODE_MATRIX_EVALUATOR_ID,
} from './canonical-mode-matrix-evaluator.mjs';
import { evaluateHotpathPolicyState } from './hotpath-policy-state.mjs';

const require = createRequire(import.meta.url);
const { analyzeEditorHotpath } = require('./editor-hotpath-incremental-render.js');

const TOKEN_NAME = 'HOT_PATH_INCREMENTAL_RENDER_OK';
const FAIL_SIGNAL_CODE = 'E_GOVERNANCE_STRICT_FAIL';
const DEFAULT_FAILSIGNAL_REGISTRY_PATH = 'docs/OPS/FAILSIGNALS/FAILSIGNAL_REGISTRY.json';
const DEFAULT_HOTPATH_POLICY_PATH = 'scripts/perf/hotpath-policy.json';
const DEFAULT_PERF_THRESHOLDS_PATH = 'scripts/perf/perf-thresholds.json';

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
    hotpathPolicyPath: '',
    perfThresholdsPath: '',
    inputP95ThresholdMs: Number.NaN,
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

    if (arg === '--hotpath-policy-path' && i + 1 < argv.length) {
      out.hotpathPolicyPath = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--hotpath-policy-path=')) {
      out.hotpathPolicyPath = normalizeString(arg.slice('--hotpath-policy-path='.length));
      continue;
    }

    if (arg === '--perf-thresholds-path' && i + 1 < argv.length) {
      out.perfThresholdsPath = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--perf-thresholds-path=')) {
      out.perfThresholdsPath = normalizeString(arg.slice('--perf-thresholds-path='.length));
      continue;
    }

    if (arg === '--input-p95-threshold-ms' && i + 1 < argv.length) {
      out.inputP95ThresholdMs = Number.parseFloat(normalizeString(argv[i + 1]));
      i += 1;
      continue;
    }
    if (arg.startsWith('--input-p95-threshold-ms=')) {
      out.inputP95ThresholdMs = Number.parseFloat(normalizeString(arg.slice('--input-p95-threshold-ms='.length)));
    }
  }

  return out;
}

function evaluateSingleBlockingAuthority(repoRoot) {
  const verdict = evaluateModeMatrixVerdict({
    repoRoot,
    mode: 'pr',
    failSignalCode: 'E_REMOTE_UNAVAILABLE',
  });

  const ok = verdict.ok && verdict.evaluatorId === CANONICAL_MODE_MATRIX_EVALUATOR_ID;
  return {
    ok,
    evaluatorIdObserved: verdict.evaluatorId,
    evaluatorIdExpected: CANONICAL_MODE_MATRIX_EVALUATOR_ID,
    mode: verdict.mode,
    failSignalCode: verdict.failSignalCode,
    verdictShouldBlock: verdict.shouldBlock,
    issues: verdict.issues || [],
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

function resolveInputP95ThresholdMs(perfThresholdsDoc, overrideValue) {
  if (Number.isFinite(overrideValue) && overrideValue > 0) {
    return overrideValue;
  }

  if (!perfThresholdsDoc || !isObjectRecord(perfThresholdsDoc.metrics)) {
    return 8;
  }

  const explicit = Number(perfThresholdsDoc.metrics.input_handler_p95_ms);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;

  const fallback = Number(perfThresholdsDoc.metrics.command_dispatch_p95_ms);
  if (Number.isFinite(fallback) && fallback > 0) return fallback;

  return 8;
}

export function evaluateHotPathIncrementalRenderState(input = {}) {
  const repoRoot = path.resolve(normalizeString(input.repoRoot) || process.cwd());
  const failsignalRegistryPath = path.resolve(
    repoRoot,
    normalizeString(input.failsignalRegistryPath || DEFAULT_FAILSIGNAL_REGISTRY_PATH),
  );
  const hotpathPolicyPath = path.resolve(
    repoRoot,
    normalizeString(input.hotpathPolicyPath || DEFAULT_HOTPATH_POLICY_PATH),
  );
  const perfThresholdsPath = path.resolve(
    repoRoot,
    normalizeString(input.perfThresholdsPath || DEFAULT_PERF_THRESHOLDS_PATH),
  );

  const perfThresholdsDoc = readJsonObject(perfThresholdsPath);
  const inputP95ThresholdMs = resolveInputP95ThresholdMs(perfThresholdsDoc, Number(input.inputP95ThresholdMs));

  const hotpathAnalysis = analyzeEditorHotpath({
    repoRoot,
    editorSourceOverride: input.editorSourceOverride,
    mainSourceOverride: input.mainSourceOverride,
  });

  const noFullRerenderCheck = {
    ok: hotpathAnalysis.inputHandlerAnalysis.noFullDocumentRerenderPerKeystroke,
    requiredMissing: hotpathAnalysis.inputHandlerAnalysis.requiredMissing,
    forbiddenHits: hotpathAnalysis.inputHandlerAnalysis.forbiddenHits,
  };

  const inputP95Check = {
    thresholdMs: inputP95ThresholdMs,
    measuredP95Ms: hotpathAnalysis.sampling.p95Ms,
    measuredMedianMs: hotpathAnalysis.sampling.medianMs,
    sampleCount: hotpathAnalysis.sampling.samplesMs.length,
    ok: hotpathAnalysis.sampling.ok && hotpathAnalysis.sampling.p95Ms <= inputP95ThresholdMs,
    samplingFailReason: hotpathAnalysis.sampling.failReason,
  };

  const typingLoopNonBlockingCheck = {
    ok: hotpathAnalysis.inputHandlerAnalysis.typingLoopInlineNonBlocking
      && hotpathAnalysis.autosaveBackupNonBlocking.ok,
    inputHandlerBlockingPatternHits: hotpathAnalysis.inputHandlerAnalysis.typingLoopBlockingPatternHits,
    autosaveBackupNonBlocking: hotpathAnalysis.autosaveBackupNonBlocking,
  };

  const hotpathPolicyState = evaluateHotpathPolicyState({ policyPath: hotpathPolicyPath });
  const noRuntimeHotpathGovernance = {
    ok: Number(hotpathPolicyState.HOTPATH_POLICY_OK) === 1,
    failReason: normalizeString(hotpathPolicyState.failReason),
    policyIssues: Array.isArray(hotpathPolicyState.policyIssues) ? hotpathPolicyState.policyIssues : [],
    policyViolations: Array.isArray(hotpathPolicyState.violations) ? hotpathPolicyState.violations : [],
    policyPath: path.relative(repoRoot, hotpathPolicyPath).replaceAll(path.sep, '/'),
  };

  const singleBlockingAuthority = evaluateSingleBlockingAuthority(repoRoot);
  const driftState = evaluateAdvisoryToBlockingDrift(repoRoot, failsignalRegistryPath);
  const advisoryToBlockingDriftCount = driftState.advisoryToBlockingDriftCount;
  const advisoryToBlockingDriftCountZero = advisoryToBlockingDriftCount === 0;

  const issues = [
    ...hotpathAnalysis.issues,
    ...singleBlockingAuthority.issues,
    ...driftState.issues,
  ];

  const ok = issues.length === 0
    && noFullRerenderCheck.ok
    && inputP95Check.ok
    && typingLoopNonBlockingCheck.ok
    && noRuntimeHotpathGovernance.ok
    && singleBlockingAuthority.ok
    && advisoryToBlockingDriftCountZero;

  return {
    ok,
    [TOKEN_NAME]: ok ? 1 : 0,
    failSignalCode: ok ? '' : FAIL_SIGNAL_CODE,
    failReason: ok ? '' : (
      !noFullRerenderCheck.ok
        ? 'E_FULL_RERENDER_DETECTED'
        : !inputP95Check.ok
          ? 'E_INPUT_P95_THRESHOLD_FAIL'
          : !typingLoopNonBlockingCheck.ok
            ? 'E_TYPING_LOOP_BLOCKED'
            : !noRuntimeHotpathGovernance.ok
              ? 'E_RUNTIME_GOVERNANCE_HOTPATH_VIOLATION'
              : !singleBlockingAuthority.ok
                ? 'E_DUAL_AUTHORITY'
                : !advisoryToBlockingDriftCountZero
                  ? 'E_ADVISORY_BLOCKING_DRIFT_NONZERO'
                  : 'E_POLICY_OR_SECURITY_CONFLICT'
    ),
    noFullRerenderCheck,
    inputP95Check,
    typingLoopNonBlockingCheck,
    noRuntimeHotpathGovernance,
    hotpathAnalysis,
    perfThresholdsPath: path.relative(repoRoot, perfThresholdsPath).replaceAll(path.sep, '/'),
    singleBlockingAuthority,
    advisoryToBlockingDriftCount,
    advisoryToBlockingDriftCountZero,
    driftCases: driftState.driftCases,
    failsignalRegistryPath: path.relative(repoRoot, failsignalRegistryPath).replaceAll(path.sep, '/'),
    issues,
  };
}

function printHuman(state) {
  console.log(`${TOKEN_NAME}=${state[TOKEN_NAME]}`);
  console.log(`P2_01_NO_FULL_DOCUMENT_RERENDER_PER_KEYSTROKE_OK=${state.noFullRerenderCheck.ok ? 1 : 0}`);
  console.log(`P2_01_INPUT_P95_WITHIN_THRESHOLD_OK=${state.inputP95Check.ok ? 1 : 0}`);
  console.log(`P2_01_INPUT_P95_THRESHOLD_MS=${state.inputP95Check.thresholdMs}`);
  console.log(`P2_01_INPUT_P95_MEASURED_MS=${state.inputP95Check.measuredP95Ms}`);
  console.log(`P2_01_AUTOSAVE_BACKUP_NONBLOCKING_OK=${state.typingLoopNonBlockingCheck.ok ? 1 : 0}`);
  console.log(`NO_RUNTIME_HOTPATH_GOVERNANCE_OK=${state.noRuntimeHotpathGovernance.ok ? 1 : 0}`);
  console.log(`ADVISORY_TO_BLOCKING_DRIFT_COUNT=${state.advisoryToBlockingDriftCount}`);
  if (!state.ok) {
    console.log(`FAIL_REASON=${state.failReason}`);
    console.log(`FAIL_SIGNAL=${state.failSignalCode}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluateHotPathIncrementalRenderState({
    failsignalRegistryPath: args.failsignalRegistryPath,
    hotpathPolicyPath: args.hotpathPolicyPath,
    perfThresholdsPath: args.perfThresholdsPath,
    inputP95ThresholdMs: args.inputP95ThresholdMs,
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
};

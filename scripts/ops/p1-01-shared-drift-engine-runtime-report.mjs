#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {
  evaluateSharedDriftEngineRuntimeState,
  DEFAULT_RUNTIME_BUDGET_MINUTES,
} from './shared-drift-engine-runtime-state.mjs';

const DEFAULT_OUTPUT_DIR = 'docs/OPS/EVIDENCE/P1_CONTOUR/TICKET_01';
const DEFAULT_STATUS_PATH = 'docs/OPS/STATUS/SHARED_DRIFT_ENGINE_RUNTIME_v3.json';
const DEFAULT_FAILSIGNAL_REGISTRY_PATH = 'docs/OPS/FAILSIGNALS/FAILSIGNAL_REGISTRY.json';
const DEFAULT_REQUIRED_SET_PATH = 'docs/OPS/EXECUTION/REQUIRED_TOKEN_SET.json';

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
    outputDir: DEFAULT_OUTPUT_DIR,
    statusPath: DEFAULT_STATUS_PATH,
    runId: '',
    ticketId: '',
    failsignalRegistryPath: DEFAULT_FAILSIGNAL_REGISTRY_PATH,
    requiredSetPath: DEFAULT_REQUIRED_SET_PATH,
    runtimeBudgetMinutes: DEFAULT_RUNTIME_BUDGET_MINUTES,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = normalizeString(argv[i]);
    if (!arg) continue;

    if (arg === '--output-dir' && i + 1 < argv.length) {
      out.outputDir = normalizeString(argv[i + 1]) || DEFAULT_OUTPUT_DIR;
      i += 1;
      continue;
    }
    if (arg.startsWith('--output-dir=')) {
      out.outputDir = normalizeString(arg.slice('--output-dir='.length)) || DEFAULT_OUTPUT_DIR;
      continue;
    }

    if (arg === '--status-path' && i + 1 < argv.length) {
      out.statusPath = normalizeString(argv[i + 1]) || DEFAULT_STATUS_PATH;
      i += 1;
      continue;
    }
    if (arg.startsWith('--status-path=')) {
      out.statusPath = normalizeString(arg.slice('--status-path='.length)) || DEFAULT_STATUS_PATH;
      continue;
    }

    if (arg === '--run-id' && i + 1 < argv.length) {
      out.runId = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--run-id=')) {
      out.runId = normalizeString(arg.slice('--run-id='.length));
      continue;
    }

    if (arg === '--ticket-id' && i + 1 < argv.length) {
      out.ticketId = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--ticket-id=')) {
      out.ticketId = normalizeString(arg.slice('--ticket-id='.length));
      continue;
    }

    if (arg === '--failsignal-registry-path' && i + 1 < argv.length) {
      out.failsignalRegistryPath = normalizeString(argv[i + 1]) || DEFAULT_FAILSIGNAL_REGISTRY_PATH;
      i += 1;
      continue;
    }
    if (arg.startsWith('--failsignal-registry-path=')) {
      out.failsignalRegistryPath = normalizeString(arg.slice('--failsignal-registry-path='.length)) || DEFAULT_FAILSIGNAL_REGISTRY_PATH;
      continue;
    }

    if (arg === '--required-set-path' && i + 1 < argv.length) {
      out.requiredSetPath = normalizeString(argv[i + 1]) || DEFAULT_REQUIRED_SET_PATH;
      i += 1;
      continue;
    }
    if (arg.startsWith('--required-set-path=')) {
      out.requiredSetPath = normalizeString(arg.slice('--required-set-path='.length)) || DEFAULT_REQUIRED_SET_PATH;
      continue;
    }

    if (arg === '--runtime-budget-minutes' && i + 1 < argv.length) {
      const parsed = Number.parseFloat(normalizeString(argv[i + 1]));
      if (Number.isFinite(parsed) && parsed > 0) out.runtimeBudgetMinutes = parsed;
      i += 1;
      continue;
    }
    if (arg.startsWith('--runtime-budget-minutes=')) {
      const parsed = Number.parseFloat(normalizeString(arg.slice('--runtime-budget-minutes='.length)));
      if (Number.isFinite(parsed) && parsed > 0) out.runtimeBudgetMinutes = parsed;
    }
  }

  return out;
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${stableStringify(value)}\n`, 'utf8');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = process.cwd();
  const outputDir = path.resolve(repoRoot, args.outputDir);
  const statusPath = path.resolve(repoRoot, args.statusPath);

  const state = evaluateSharedDriftEngineRuntimeState({
    repoRoot,
    failsignalRegistryPath: path.resolve(repoRoot, args.failsignalRegistryPath),
    requiredSetPath: path.resolve(repoRoot, args.requiredSetPath),
    runtimeBudgetMinutes: args.runtimeBudgetMinutes,
  });

  const gates = {
    p1_01_shared_drift_engine_single_source_check: state.singleSource.ok ? 'PASS' : 'FAIL',
    p1_01_duplicate_drift_signal_reduction_check: state.reduction.reducedOrZeroRemaining ? 'PASS' : 'FAIL',
    p1_01_runtime_budget_under_30_minutes_check: state.runtimeBudget.ok ? 'PASS' : 'FAIL',
    p1_01_drift_engine_output_stability_check: state.outputStability.ok ? 'PASS' : 'FAIL',
    mc_advisory_blocking_drift_zero: state.advisoryToBlockingDriftCountZero ? 'PASS' : 'FAIL',
  };

  const summary = {
    status: Object.values(gates).every((value) => value === 'PASS') ? 'PASS' : 'FAIL',
    runId: args.runId || process.env.RUN_ID || '',
    ticketId: args.ticketId || process.env.TICKET_ID || '',
    runtimeBudgetMinutes: state.runtimeBudget.runtimeBudgetMinutes,
    runtimeMinutesObserved: Number(state.runtimeBudget.runtimeMinutesObserved.toFixed(6)),
    sharedSourceOk: state.singleSource.ok,
    duplicateSignalCountBefore: state.reduction.duplicateSignalCountBefore,
    duplicateSignalCountAfter: state.reduction.duplicateSignalCountAfter,
    removedDuplicateSignalPaths: state.reduction.removedDuplicateSignalPaths,
    zeroRemainingDuplicates: state.reduction.zeroRemainingDuplicates,
    outputStabilityOk: state.outputStability.ok,
    outputStabilityHash: state.outputStability.baselineHash,
    advisoryToBlockingDriftCount: state.advisoryToBlockingDriftCount,
    singleBlockingAuthorityOk: state.singleBlockingAuthority.ok,
    safetyParityOk: state.safetyParity.ok,
    gates,
    generatedAtUtc: new Date().toISOString(),
  };

  const ticketMeta = {
    runId: summary.runId,
    ticketId: summary.ticketId,
    outputDir: path.relative(repoRoot, outputDir).replaceAll(path.sep, '/'),
    generatedAtUtc: summary.generatedAtUtc,
  };

  writeJson(statusPath, {
    version: 3,
    token: 'SHARED_DRIFT_ENGINE_RUNTIME_OK',
    evaluatorId: 'CANONICAL_MODE_MATRIX_EVALUATOR_V1',
    runtimeBudgetMinutes: state.runtimeBudget.runtimeBudgetMinutes,
    singleSource: {
      expected: 'SHARED_DRIFT_ENGINE_RUNTIME_V3',
      ok: state.singleSource.ok,
    },
    duplicateSignalReduction: {
      before: state.reduction.duplicateSignalCountBefore,
      after: state.reduction.duplicateSignalCountAfter,
      removedDuplicateSignalPaths: state.reduction.removedDuplicateSignalPaths,
      reducedOrZeroRemaining: state.reduction.reducedOrZeroRemaining,
    },
    advisoryToBlockingDriftCount: state.advisoryToBlockingDriftCount,
    gates,
    status: summary.status,
    updatedAtUtc: summary.generatedAtUtc,
  });

  writeJson(path.join(outputDir, 'drift-engine-input-map.json'), {
    before: state.reduction.before,
    after: state.reduction.after,
    groupedBeforeInputs: state.groupedBeforeInputs,
    groupedAfterInputs: state.groupedAfterInputs,
    driftInputPathsBefore: state.driftInputPathsBefore,
    driftInputPathsAfter: state.driftInputPathsAfter,
    sharedEngineInputMap: state.sharedEngineInputMap,
    sourceRule: 'SHARED_DRIFT_ENGINE_IS_ONLY_RUNTIME_SOURCE_FOR_DRIFT_DECISION_INPUT',
  });

  writeJson(path.join(outputDir, 'drift-engine-dedup-proof.json'), {
    duplicateSignalCountBefore: state.reduction.duplicateSignalCountBefore,
    duplicateSignalCountAfter: state.reduction.duplicateSignalCountAfter,
    removedDuplicateSignalPaths: state.reduction.removedDuplicateSignalPaths,
    reducedOrZeroRemaining: state.reduction.reducedOrZeroRemaining,
    runtimeBudget: state.runtimeBudget,
    outputStability: state.outputStability,
  });

  writeJson(path.join(outputDir, 'advisory-blocking-drift-cases.json'), {
    advisoryToBlockingDriftCount: state.advisoryToBlockingDriftCount,
    advisoryToBlockingDriftCountZero: state.advisoryToBlockingDriftCountZero,
    driftCases: state.driftCases,
  });

  writeJson(path.join(outputDir, 'summary.json'), summary);
  writeJson(path.join(outputDir, 'ticket-meta.json'), ticketMeta);

  process.stdout.write(`${stableStringify(summary)}\n`);
  process.exit(summary.status === 'PASS' ? 0 : 1);
}

main();

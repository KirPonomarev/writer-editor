#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {
  evaluateProcessTaxBudgetGateState,
  DEFAULT_MAX_HEAVY_PASS_PER_WINDOW,
  DEFAULT_KILL_SWITCH_WAVE_THRESHOLD,
  DEFAULT_RUNTIME_BUDGET_MINUTES_MAX,
} from './process-tax-budget-gate-state.mjs';

const DEFAULT_OUTPUT_DIR = 'docs/OPS/EVIDENCE/P2_CONTOUR/TICKET_03';
const DEFAULT_STATUS_PATH = 'docs/OPS/STATUS/PROCESS_TAX_BUDGET_GATE_AUTOMATION_v3.json';

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
    maxHeavyPassPerWindow: DEFAULT_MAX_HEAVY_PASS_PER_WINDOW,
    killSwitchWaveThreshold: DEFAULT_KILL_SWITCH_WAVE_THRESHOLD,
    runtimeBudgetMinutesMax: DEFAULT_RUNTIME_BUDGET_MINUTES_MAX,
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

    if (arg === '--max-heavy-pass-per-window' && i + 1 < argv.length) {
      const parsed = Number.parseInt(normalizeString(argv[i + 1]), 10);
      if (Number.isInteger(parsed) && parsed > 0) out.maxHeavyPassPerWindow = parsed;
      i += 1;
      continue;
    }
    if (arg.startsWith('--max-heavy-pass-per-window=')) {
      const parsed = Number.parseInt(normalizeString(arg.slice('--max-heavy-pass-per-window='.length)), 10);
      if (Number.isInteger(parsed) && parsed > 0) out.maxHeavyPassPerWindow = parsed;
      continue;
    }

    if (arg === '--kill-switch-wave-threshold' && i + 1 < argv.length) {
      const parsed = Number.parseInt(normalizeString(argv[i + 1]), 10);
      if (Number.isInteger(parsed) && parsed > 0) out.killSwitchWaveThreshold = parsed;
      i += 1;
      continue;
    }
    if (arg.startsWith('--kill-switch-wave-threshold=')) {
      const parsed = Number.parseInt(normalizeString(arg.slice('--kill-switch-wave-threshold='.length)), 10);
      if (Number.isInteger(parsed) && parsed > 0) out.killSwitchWaveThreshold = parsed;
      continue;
    }

    if (arg === '--runtime-budget-minutes-max' && i + 1 < argv.length) {
      const parsed = Number.parseInt(normalizeString(argv[i + 1]), 10);
      if (Number.isInteger(parsed) && parsed > 0) out.runtimeBudgetMinutesMax = parsed;
      i += 1;
      continue;
    }
    if (arg.startsWith('--runtime-budget-minutes-max=')) {
      const parsed = Number.parseInt(normalizeString(arg.slice('--runtime-budget-minutes-max='.length)), 10);
      if (Number.isInteger(parsed) && parsed > 0) out.runtimeBudgetMinutesMax = parsed;
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

  const state = evaluateProcessTaxBudgetGateState({
    repoRoot,
    maxHeavyPassPerWindow: args.maxHeavyPassPerWindow,
    killSwitchWaveThreshold: args.killSwitchWaveThreshold,
    runtimeBudgetMinutesMax: args.runtimeBudgetMinutesMax,
  });

  const gates = {
    p2_03_unique_signal_required_check: state.uniqueSignalRequiredCheck ? 'PASS' : 'FAIL',
    p2_03_duplicate_gate_merge_or_disable_check: state.duplicateGateMergeOrDisableCheck ? 'PASS' : 'FAIL',
    p2_03_max_heavy_pass_per_window_check: state.maxHeavyPassPerWindowCheck ? 'PASS' : 'FAIL',
    p2_03_no_daily_strict_without_scope_delta_check: state.noDailyStrictWithoutScopeDeltaCheck ? 'PASS' : 'FAIL',
    p2_03_kill_switch_on_no_signal_delta_check: state.killSwitchOnNoSignalDeltaCheck ? 'PASS' : 'FAIL',
    mc_advisory_blocking_drift_zero: state.advisoryToBlockingDriftCountZero ? 'PASS' : 'FAIL',
  };
  const advisoryGates = {
    p2_03_contour_class_repeat_cap_check: state.repeatClassWithoutDeltaCapCheck ? 'PASS' : 'WARN',
    p2_03_user_artifact_min1_check: state.userArtifactMin1Check ? 'PASS' : 'WARN',
  };

  const coreGatesPass = Object.values(gates).every((value) => value === 'PASS');
  const status = state.ok ? 'PASS' : 'FAIL';
  const generatedAtUtc = new Date().toISOString();

  const summary = {
    status,
    stateOk: state.ok === true,
    coreGatesPass,
    runId: args.runId || process.env.RUN_ID || '',
    ticketId: args.ticketId || process.env.TICKET_ID || '',
    uniqueSignalCount: state.uniqueSignalRequired.uniqueSignalCount,
    duplicateSignalCountBefore: state.duplicateGateMergeOrDisable.before.duplicateSignalCount,
    duplicateSignalCountAfter: state.duplicateGateMergeOrDisable.after.duplicateSignalCount,
    maxHeavyPassPerWindow: state.maxHeavyPassPerWindow.maxHeavyPassPerWindow,
    killSwitchWaveThreshold: state.killSwitchTriggerCases.killSwitchWaveThreshold,
    runtimeBudgetMinutesMax: state.budgetThresholdProof.runtimeBudgetMinutesMax,
    advisoryToBlockingDriftCount: state.advisoryToBlockingDriftCount,
    singleBlockingAuthorityOk: state.singleBlockingAuthority.ok,
    gates,
    advisoryGates,
    loopExitGuardBlockingMode: state.loopExitGuardBlocking === true,
    loopExitGuardAction: state.contourLoopExitGuard?.onViolationAction || 'NONE',
    repeatClassWithoutDeltaCapCheck: state.repeatClassWithoutDeltaCapCheck === true,
    userArtifactMin1Check: state.userArtifactMin1Check === true,
    generatedAtUtc,
  };

  writeJson(statusPath, {
    version: 3,
    token: 'PROCESS_TAX_BUDGET_GATE_AUTOMATION_OK',
    evaluatorId: 'CANONICAL_MODE_MATRIX_EVALUATOR_V1',
    uniqueSignalCount: summary.uniqueSignalCount,
    duplicateSignalCountBefore: summary.duplicateSignalCountBefore,
    duplicateSignalCountAfter: summary.duplicateSignalCountAfter,
    maxHeavyPassPerWindow: summary.maxHeavyPassPerWindow,
    killSwitchWaveThreshold: summary.killSwitchWaveThreshold,
    runtimeBudgetMinutesMax: summary.runtimeBudgetMinutesMax,
    advisoryToBlockingDriftCount: summary.advisoryToBlockingDriftCount,
    gates,
    advisoryGates,
    loopExitGuard: {
      blockingMode: summary.loopExitGuardBlockingMode,
      action: summary.loopExitGuardAction,
      repeatClassWithoutDeltaCapCheck: summary.repeatClassWithoutDeltaCapCheck,
      userArtifactMin1Check: summary.userArtifactMin1Check,
      sameClassStreakCount: state.contourLoopExitGuard?.sameClassStreakCount ?? 0,
      sameClassStreakCountEffective: state.contourLoopExitGuard?.sameClassStreakCountEffective ?? 0,
      maxSameClassWithoutProductDelta: state.contourLoopExitGuard?.maxSameClassWithoutProductDelta ?? 0,
      latestContourId: state.contourLoopExitGuard?.latestContourId || '',
      latestContourClass: state.contourLoopExitGuard?.latestContourClass || '',
      productDeltaTrue: state.contourLoopExitGuard?.productDeltaTrue === true,
      userArtifactMinCount: state.contourLoopExitGuard?.userArtifactMinCount ?? 1,
      userArtifactCount: state.contourLoopExitGuard?.userArtifactCount ?? 0,
      userArtifactIds: Array.isArray(state.contourLoopExitGuard?.userArtifactIds)
        ? state.contourLoopExitGuard.userArtifactIds
        : [],
      latestStatusArtifact: state.contourLoopExitGuard?.latestStatusArtifact || '',
      warnings: Array.isArray(state.contourLoopExitGuard?.warnings) ? state.contourLoopExitGuard.warnings : [],
      violations: Array.isArray(state.contourLoopExitGuard?.violations) ? state.contourLoopExitGuard.violations : [],
    },
    stateOk: summary.stateOk,
    coreGatesPass: summary.coreGatesPass,
    status,
    updatedAtUtc: generatedAtUtc,
  });

  writeJson(path.join(outputDir, 'duplicate-gate-signal-map.json'), {
    uniqueSignalRequiredCheck: state.uniqueSignalRequiredCheck,
    duplicateGateMergeOrDisableCheck: state.duplicateGateMergeOrDisableCheck,
    uniqueSignalRequired: state.uniqueSignalRequired,
    duplicateGateMergeOrDisable: state.duplicateGateMergeOrDisable,
  });

  writeJson(path.join(outputDir, 'kill-switch-trigger-cases.json'), {
    killSwitchOnNoSignalDeltaCheck: state.killSwitchOnNoSignalDeltaCheck,
    killSwitchTriggerCases: state.killSwitchTriggerCases,
    noDailyStrictWithoutScopeDeltaCheck: state.noDailyStrictWithoutScopeDeltaCheck,
    noDailyStrictWithoutScopeDelta: state.noDailyStrictWithoutScopeDelta,
  });

  writeJson(path.join(outputDir, 'budget-threshold-proof.json'), {
    maxHeavyPassPerWindowCheck: state.maxHeavyPassPerWindowCheck,
    maxHeavyPassPerWindow: state.maxHeavyPassPerWindow,
    budgetThresholdProof: state.budgetThresholdProof,
  });

  writeJson(path.join(outputDir, 'advisory-blocking-drift-cases.json'), {
    advisoryToBlockingDriftCount: state.advisoryToBlockingDriftCount,
    advisoryToBlockingDriftCountZero: state.advisoryToBlockingDriftCountZero,
    driftCases: state.driftCases,
  });

  writeJson(path.join(outputDir, 'summary.json'), summary);
  writeJson(path.join(outputDir, 'ticket-meta.json'), {
    runId: summary.runId,
    ticketId: summary.ticketId,
    outputDir: path.relative(repoRoot, outputDir).replaceAll(path.sep, '/'),
    generatedAtUtc,
  });

  process.stdout.write(`${stableStringify(summary)}\n`);
  process.exit(status === 'PASS' ? 0 : 1);
}

main();

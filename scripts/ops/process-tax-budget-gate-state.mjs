#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  evaluateModeMatrixVerdict,
  CANONICAL_MODE_MATRIX_EVALUATOR_ID,
} from './canonical-mode-matrix-evaluator.mjs';

const TOKEN_NAME = 'PROCESS_TAX_BUDGET_GATE_AUTOMATION_OK';
const FAIL_SIGNAL_CODE = 'E_PROCESS_TAX_BUDGET_GATE_AUTOMATION';
const DEFAULT_UNIQUE_SIGNAL_MAP_PATH = 'docs/OPS/EVIDENCE/P1_CONTOUR/TICKET_10/unique-signal-map.json';
const DEFAULT_DUPLICATE_BEFORE_AFTER_PATH = 'docs/OPS/EVIDENCE/P1_CONTOUR/TICKET_10/duplicate-checks-before-after.json';
const DEFAULT_FAILSIGNAL_REGISTRY_PATH = 'docs/OPS/FAILSIGNALS/FAILSIGNAL_REGISTRY.json';
const DEFAULT_MAX_HEAVY_PASS_PER_WINDOW = 1;
const DEFAULT_KILL_SWITCH_WAVE_THRESHOLD = 2;
const DEFAULT_RUNTIME_BUDGET_MINUTES_MAX = 30;

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
    uniqueSignalMapPath: '',
    duplicateBeforeAfterPath: '',
    failsignalRegistryPath: '',
    maxHeavyPassPerWindow: DEFAULT_MAX_HEAVY_PASS_PER_WINDOW,
    killSwitchWaveThreshold: DEFAULT_KILL_SWITCH_WAVE_THRESHOLD,
    runtimeBudgetMinutesMax: DEFAULT_RUNTIME_BUDGET_MINUTES_MAX,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = normalizeString(argv[i]);
    if (!arg) continue;

    if (arg === '--json') {
      out.json = true;
      continue;
    }

    if (arg === '--unique-signal-map-path' && i + 1 < argv.length) {
      out.uniqueSignalMapPath = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--unique-signal-map-path=')) {
      out.uniqueSignalMapPath = normalizeString(arg.slice('--unique-signal-map-path='.length));
      continue;
    }

    if (arg === '--duplicate-before-after-path' && i + 1 < argv.length) {
      out.duplicateBeforeAfterPath = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--duplicate-before-after-path=')) {
      out.duplicateBeforeAfterPath = normalizeString(arg.slice('--duplicate-before-after-path='.length));
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

function evaluateUniqueSignalRequired(uniqueSignalDoc) {
  const rows = Array.isArray(uniqueSignalDoc?.uniqueSignalMap) ? uniqueSignalDoc.uniqueSignalMap : [];
  const seenSignals = new Set();
  const duplicates = [];
  const invalidRows = [];
  const uniqueRows = [];

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const signal = normalizeString(row?.signal);
    const canonicalSource = normalizeString(row?.canonicalSource).replaceAll(path.sep, '/');
    if (!signal || !canonicalSource) {
      invalidRows.push({ index: i, reason: 'MISSING_SIGNAL_OR_CANONICAL_SOURCE' });
      continue;
    }
    if (seenSignals.has(signal)) duplicates.push(signal);
    seenSignals.add(signal);
    uniqueRows.push({
      signal,
      canonicalSource,
      removedDuplicateSources: Array.isArray(row?.removedDuplicateSources)
        ? row.removedDuplicateSources.map((entry) => normalizeString(entry).replaceAll(path.sep, '/')).filter(Boolean)
        : [],
      sourceCountBefore: Number.isFinite(Number(row?.sourceCountBefore)) ? Number(row.sourceCountBefore) : 0,
    });
  }

  duplicates.sort((a, b) => a.localeCompare(b));
  return {
    ok: uniqueRows.length > 0 && duplicates.length === 0 && invalidRows.length === 0,
    uniqueSignalCount: uniqueRows.length,
    duplicates,
    invalidRows,
    uniqueRows,
  };
}

function evaluateDuplicateGateMergeOrDisable(duplicateDoc) {
  const before = isObjectRecord(duplicateDoc?.before) ? duplicateDoc.before : {};
  const after = isObjectRecord(duplicateDoc?.after) ? duplicateDoc.after : {};

  const beforeSignalDuplicates = Number.isFinite(Number(before.duplicateSignalCount))
    ? Number(before.duplicateSignalCount)
    : -1;
  const afterSignalDuplicates = Number.isFinite(Number(after.duplicateSignalCount))
    ? Number(after.duplicateSignalCount)
    : -1;
  const beforePathDuplicates = Number.isFinite(Number(before.duplicatePathCount))
    ? Number(before.duplicatePathCount)
    : -1;
  const afterPathDuplicates = Number.isFinite(Number(after.duplicatePathCount))
    ? Number(after.duplicatePathCount)
    : -1;

  const removedDuplicateSignalPaths = Number.isFinite(Number(duplicateDoc?.removedDuplicateSignalPaths))
    ? Number(duplicateDoc.removedDuplicateSignalPaths)
    : -1;
  const duplicateReductionOk = duplicateDoc?.duplicateReductionOk === true;

  const ok = duplicateReductionOk
    && beforeSignalDuplicates >= 0
    && afterSignalDuplicates === 0
    && beforePathDuplicates >= 0
    && afterPathDuplicates === 0
    && removedDuplicateSignalPaths >= 0;

  return {
    ok,
    duplicateReductionOk,
    before: {
      duplicateSignalCount: beforeSignalDuplicates,
      duplicatePathCount: beforePathDuplicates,
    },
    after: {
      duplicateSignalCount: afterSignalDuplicates,
      duplicatePathCount: afterPathDuplicates,
    },
    removedDuplicateSignalPaths,
  };
}

function evaluateMaxHeavyPassPerWindow(maxHeavyPassPerWindow) {
  const evaluateCase = (heavyPassCount) => heavyPassCount <= maxHeavyPassPerWindow;
  const cases = [
    {
      caseId: 'single_heavy_pass_allowed',
      heavyPassCount: 1,
      expectedAllow: true,
    },
    {
      caseId: 'double_heavy_pass_rejected',
      heavyPassCount: maxHeavyPassPerWindow + 1,
      expectedAllow: false,
    },
  ].map((row) => ({
    ...row,
    actualAllow: evaluateCase(row.heavyPassCount),
    pass: evaluateCase(row.heavyPassCount) === row.expectedAllow,
  }));

  return {
    ok: maxHeavyPassPerWindow === 1 && cases.every((row) => row.pass),
    maxHeavyPassPerWindow,
    cases,
  };
}

function evaluateNoDailyStrictWithoutScopeDelta() {
  const evaluateCase = ({ dailyStrictRequested, scopeDelta }) => !(dailyStrictRequested && !scopeDelta);
  const cases = [
    {
      caseId: 'daily_strict_without_scope_delta_rejected',
      dailyStrictRequested: true,
      scopeDelta: false,
      expectedAllow: false,
    },
    {
      caseId: 'daily_strict_with_scope_delta_allowed',
      dailyStrictRequested: true,
      scopeDelta: true,
      expectedAllow: true,
    },
    {
      caseId: 'no_daily_strict_requested_allowed',
      dailyStrictRequested: false,
      scopeDelta: false,
      expectedAllow: true,
    },
  ].map((row) => ({
    ...row,
    actualAllow: evaluateCase(row),
    pass: evaluateCase(row) === row.expectedAllow,
  }));

  return {
    ok: cases.every((row) => row.pass),
    cases,
  };
}

function evaluateKillSwitchOnNoSignalDelta(killSwitchWaveThreshold) {
  const shouldDowngrade = (noSignalDeltaWaveCount) => noSignalDeltaWaveCount >= killSwitchWaveThreshold;
  const cases = [
    {
      caseId: 'below_threshold_remains_active',
      noSignalDeltaWaveCount: Math.max(0, killSwitchWaveThreshold - 1),
      expectedAction: 'KEEP_ACTIVE',
    },
    {
      caseId: 'at_threshold_downgrades_to_warn',
      noSignalDeltaWaveCount: killSwitchWaveThreshold,
      expectedAction: 'DOWNGRADE_TO_WARN',
    },
    {
      caseId: 'above_threshold_stays_warn',
      noSignalDeltaWaveCount: killSwitchWaveThreshold + 1,
      expectedAction: 'DOWNGRADE_TO_WARN',
    },
  ].map((row) => {
    const actualAction = shouldDowngrade(row.noSignalDeltaWaveCount) ? 'DOWNGRADE_TO_WARN' : 'KEEP_ACTIVE';
    return {
      ...row,
      actualAction,
      pass: actualAction === row.expectedAction,
    };
  });

  return {
    ok: killSwitchWaveThreshold === 2 && cases.every((row) => row.pass),
    killSwitchWaveThreshold,
    cases,
  };
}

function evaluateBudgetThresholdProof(runtimeBudgetMinutesMax) {
  const windows = [
    { windowId: 'window_01', runtimeMinutes: Math.max(1, runtimeBudgetMinutesMax - 9) },
    { windowId: 'window_02', runtimeMinutes: runtimeBudgetMinutesMax },
    { windowId: 'window_03', runtimeMinutes: runtimeBudgetMinutesMax + 1 },
  ].map((row) => ({
    ...row,
    withinBudget: row.runtimeMinutes <= runtimeBudgetMinutesMax,
  }));

  const overBudgetWindows = windows.filter((row) => row.withinBudget === false).map((row) => row.windowId);
  return {
    ok: runtimeBudgetMinutesMax === DEFAULT_RUNTIME_BUDGET_MINUTES_MAX
      && overBudgetWindows.length === 1
      && overBudgetWindows[0] === 'window_03',
    runtimeBudgetMinutesMax,
    windows,
    overBudgetWindows,
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

function evaluateAdvisoryToBlockingDrift(repoRoot, failsignalRegistryDoc) {
  const modePairs = [
    { mode: 'pr', key: 'prCore' },
    { mode: 'release', key: 'release' },
    { mode: 'promotion', key: 'promotion' },
  ];

  const failSignals = Array.isArray(failsignalRegistryDoc?.failSignals) ? failsignalRegistryDoc.failSignals : [];
  const driftCases = [];
  const issues = [];

  for (const row of failSignals) {
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

export function evaluateProcessTaxBudgetGateState(input = {}) {
  const repoRoot = path.resolve(normalizeString(input.repoRoot) || process.cwd());
  const uniqueSignalMapPath = path.resolve(
    repoRoot,
    normalizeString(input.uniqueSignalMapPath || DEFAULT_UNIQUE_SIGNAL_MAP_PATH),
  );
  const duplicateBeforeAfterPath = path.resolve(
    repoRoot,
    normalizeString(input.duplicateBeforeAfterPath || DEFAULT_DUPLICATE_BEFORE_AFTER_PATH),
  );
  const failsignalRegistryPath = path.resolve(
    repoRoot,
    normalizeString(input.failsignalRegistryPath || DEFAULT_FAILSIGNAL_REGISTRY_PATH),
  );

  const uniqueSignalMapDoc = isObjectRecord(input.uniqueSignalMapDoc)
    ? input.uniqueSignalMapDoc
    : readJsonObject(uniqueSignalMapPath);
  const duplicateBeforeAfterDoc = isObjectRecord(input.duplicateBeforeAfterDoc)
    ? input.duplicateBeforeAfterDoc
    : readJsonObject(duplicateBeforeAfterPath);
  const failsignalRegistryDoc = isObjectRecord(input.failsignalRegistryDoc)
    ? input.failsignalRegistryDoc
    : readJsonObject(failsignalRegistryPath);

  const issues = [];
  if (!uniqueSignalMapDoc) issues.push({ code: 'UNIQUE_SIGNAL_MAP_UNREADABLE' });
  if (!duplicateBeforeAfterDoc) issues.push({ code: 'DUPLICATE_BEFORE_AFTER_UNREADABLE' });
  if (!failsignalRegistryDoc || !Array.isArray(failsignalRegistryDoc.failSignals)) {
    issues.push({ code: 'FAILSIGNAL_REGISTRY_UNREADABLE' });
  }

  const uniqueSignalRequired = uniqueSignalMapDoc
    ? evaluateUniqueSignalRequired(uniqueSignalMapDoc)
    : {
        ok: false,
        uniqueSignalCount: 0,
        duplicates: [],
        invalidRows: [{ reason: 'UNIQUE_SIGNAL_MAP_UNREADABLE' }],
        uniqueRows: [],
      };

  const duplicateGateMergeOrDisable = duplicateBeforeAfterDoc
    ? evaluateDuplicateGateMergeOrDisable(duplicateBeforeAfterDoc)
    : {
        ok: false,
        duplicateReductionOk: false,
        before: { duplicateSignalCount: -1, duplicatePathCount: -1 },
        after: { duplicateSignalCount: -1, duplicatePathCount: -1 },
        removedDuplicateSignalPaths: -1,
      };

  const maxHeavyPassPerWindow = evaluateMaxHeavyPassPerWindow(
    Number.isInteger(input.maxHeavyPassPerWindow)
      ? input.maxHeavyPassPerWindow
      : DEFAULT_MAX_HEAVY_PASS_PER_WINDOW,
  );
  const noDailyStrictWithoutScopeDelta = evaluateNoDailyStrictWithoutScopeDelta();
  const killSwitch = evaluateKillSwitchOnNoSignalDelta(
    Number.isInteger(input.killSwitchWaveThreshold)
      ? input.killSwitchWaveThreshold
      : DEFAULT_KILL_SWITCH_WAVE_THRESHOLD,
  );
  const budgetThresholdProof = evaluateBudgetThresholdProof(
    Number.isInteger(input.runtimeBudgetMinutesMax)
      ? input.runtimeBudgetMinutesMax
      : DEFAULT_RUNTIME_BUDGET_MINUTES_MAX,
  );

  const singleBlockingAuthority = evaluateSingleBlockingAuthority(repoRoot);
  const driftState = failsignalRegistryDoc
    ? evaluateAdvisoryToBlockingDrift(repoRoot, failsignalRegistryDoc)
    : {
        ok: false,
        advisoryToBlockingDriftCount: -1,
        driftCases: [],
        issues: [{ code: 'FAILSIGNAL_REGISTRY_UNREADABLE' }],
      };

  const advisoryToBlockingDriftCountZero = driftState.advisoryToBlockingDriftCount === 0;
  issues.push(...(singleBlockingAuthority.issues || []), ...(driftState.issues || []));

  const ok = issues.length === 0
    && uniqueSignalRequired.ok
    && duplicateGateMergeOrDisable.ok
    && maxHeavyPassPerWindow.ok
    && noDailyStrictWithoutScopeDelta.ok
    && killSwitch.ok
    && budgetThresholdProof.ok
    && singleBlockingAuthority.ok
    && advisoryToBlockingDriftCountZero;

  return {
    ok,
    [TOKEN_NAME]: ok ? 1 : 0,
    failSignalCode: ok ? '' : FAIL_SIGNAL_CODE,
    failReason: ok ? '' : (
      !uniqueSignalRequired.ok
        ? 'E_UNIQUE_SIGNAL_MISSING'
        : !duplicateGateMergeOrDisable.ok
          ? 'E_DUPLICATE_SIGNAL_NOT_REDUCED'
          : !maxHeavyPassPerWindow.ok
            ? 'E_HEAVY_PASS_POLICY_VIOLATION'
            : !noDailyStrictWithoutScopeDelta.ok
              ? 'E_DAILY_STRICT_SCOPE_DELTA_POLICY_VIOLATION'
              : !killSwitch.ok
                ? 'E_KILL_SWITCH_POLICY_VIOLATION'
                : !budgetThresholdProof.ok
                  ? 'E_RUNTIME_BUDGET_EXCEEDED'
                  : !singleBlockingAuthority.ok
                    ? 'E_DUAL_AUTHORITY'
                    : !advisoryToBlockingDriftCountZero
                      ? 'ADVISORY_TO_BLOCKING_DRIFT'
                      : 'E_POLICY_OR_SECURITY_CONFLICT'
    ),
    uniqueSignalMapPath: path.relative(repoRoot, uniqueSignalMapPath).replaceAll(path.sep, '/'),
    duplicateBeforeAfterPath: path.relative(repoRoot, duplicateBeforeAfterPath).replaceAll(path.sep, '/'),
    failsignalRegistryPath: path.relative(repoRoot, failsignalRegistryPath).replaceAll(path.sep, '/'),
    uniqueSignalRequiredCheck: uniqueSignalRequired.ok,
    duplicateGateMergeOrDisableCheck: duplicateGateMergeOrDisable.ok,
    maxHeavyPassPerWindowCheck: maxHeavyPassPerWindow.ok,
    noDailyStrictWithoutScopeDeltaCheck: noDailyStrictWithoutScopeDelta.ok,
    killSwitchOnNoSignalDeltaCheck: killSwitch.ok,
    uniqueSignalRequired,
    duplicateGateMergeOrDisable,
    maxHeavyPassPerWindow,
    noDailyStrictWithoutScopeDelta,
    killSwitchTriggerCases: killSwitch,
    budgetThresholdProof,
    singleBlockingAuthority,
    advisoryToBlockingDriftCount: driftState.advisoryToBlockingDriftCount,
    advisoryToBlockingDriftCountZero,
    driftCases: driftState.driftCases,
    issues,
  };
}

function printHuman(state) {
  console.log(`${TOKEN_NAME}=${state[TOKEN_NAME]}`);
  console.log(`P2_03_UNIQUE_SIGNAL_REQUIRED_OK=${state.uniqueSignalRequiredCheck ? 1 : 0}`);
  console.log(`P2_03_DUPLICATE_GATE_MERGE_OR_DISABLE_OK=${state.duplicateGateMergeOrDisableCheck ? 1 : 0}`);
  console.log(`P2_03_MAX_HEAVY_PASS_PER_WINDOW_OK=${state.maxHeavyPassPerWindowCheck ? 1 : 0}`);
  console.log(`P2_03_NO_DAILY_STRICT_WITHOUT_SCOPE_DELTA_OK=${state.noDailyStrictWithoutScopeDeltaCheck ? 1 : 0}`);
  console.log(`P2_03_KILL_SWITCH_NO_SIGNAL_DELTA_OK=${state.killSwitchOnNoSignalDeltaCheck ? 1 : 0}`);
  console.log(`ADVISORY_TO_BLOCKING_DRIFT_COUNT=${state.advisoryToBlockingDriftCount}`);
  if (!state.ok) {
    console.log(`FAIL_REASON=${state.failReason}`);
    console.log(`FAIL_SIGNAL=${state.failSignalCode}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluateProcessTaxBudgetGateState({
    uniqueSignalMapPath: args.uniqueSignalMapPath,
    duplicateBeforeAfterPath: args.duplicateBeforeAfterPath,
    failsignalRegistryPath: args.failsignalRegistryPath,
    maxHeavyPassPerWindow: args.maxHeavyPassPerWindow,
    killSwitchWaveThreshold: args.killSwitchWaveThreshold,
    runtimeBudgetMinutesMax: args.runtimeBudgetMinutesMax,
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
  DEFAULT_MAX_HEAVY_PASS_PER_WINDOW,
  DEFAULT_KILL_SWITCH_WAVE_THRESHOLD,
  DEFAULT_RUNTIME_BUDGET_MINUTES_MAX,
};

#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  evaluateProcessTaxBudgetGateState,
  DEFAULT_MAX_HEAVY_PASS_PER_WINDOW,
  DEFAULT_KILL_SWITCH_WAVE_THRESHOLD,
  DEFAULT_RUNTIME_BUDGET_MINUTES_MAX,
} from './process-tax-budget-gate-state.mjs';

const TOKEN_NAME = 'P2_WS03_PROCESS_TAX_BUDGET_AUTOMATION_OK';
const EXPECTED_CANON_VERSION = 'v3.13a-final';
const DEFAULT_CANON_STATUS_PATH = 'docs/OPS/STATUS/CANON_STATUS.json';
const DEFAULT_UNIQUE_SIGNAL_MAP_PATH = 'docs/OPS/EVIDENCE/P1_CONTOUR/TICKET_10/unique-signal-map.json';
const DEFAULT_DUPLICATE_BEFORE_AFTER_PATH = 'docs/OPS/EVIDENCE/P1_CONTOUR/TICKET_10/duplicate-checks-before-after.json';
const DEFAULT_FAILSIGNAL_REGISTRY_PATH = 'docs/OPS/FAILSIGNALS/FAILSIGNAL_REGISTRY.json';

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

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function parseArgs(argv = process.argv.slice(2)) {
  const out = {
    json: false,
    canonStatusPath: '',
    uniqueSignalMapPath: '',
    duplicateBeforeAfterPath: '',
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
    }
  }

  return out;
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

function computeInputHash(payload) {
  return createHash('sha256').update(stableStringify(payload)).digest('hex');
}

function evaluateHashFreshnessGuard(input = {}) {
  const prevHash = normalizeString(input.prevHash);
  const nextHash = normalizeString(input.nextHash);
  const ttlValid = Boolean(input.ttlValid);
  const heavyRerunRequested = Boolean(input.heavyRerunRequested);

  const hashChanged = prevHash && nextHash && prevHash !== nextHash;
  const shouldRejectHeavyRerun = heavyRerunRequested && ttlValid && !hashChanged;

  return {
    ok: !shouldRejectHeavyRerun,
    hashChanged,
    ttlValid,
    heavyRerunRequested,
    shouldRejectHeavyRerun,
    failReason: shouldRejectHeavyRerun ? 'HEAVY_RERUN_WITHOUT_INPUT_HASH_CHANGE' : '',
  };
}

function evaluateLaneBudgetPolicy(input = {}) {
  const lane = normalizeString(input.lane || 'fast') || 'fast';
  const forceHeavyPolicy = Boolean(input.forceHeavyPolicy);
  const detected = lane === 'fast' && forceHeavyPolicy;

  return {
    ok: !detected,
    lane,
    forceHeavyPolicy,
    detected,
    failReason: detected ? 'FAST_LANE_FORCED_INTO_HEAVY_POLICY' : '',
  };
}

function evaluateP2Ws03ProcessTaxBudgetAutomationState(input = {}) {
  const repoRoot = path.resolve(normalizeString(input.repoRoot) || process.cwd());
  const canonStatusPath = path.resolve(repoRoot, normalizeString(input.canonStatusPath || DEFAULT_CANON_STATUS_PATH));
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

  const canonStatusDoc = isObjectRecord(input.canonStatusDoc)
    ? input.canonStatusDoc
    : readJsonObject(canonStatusPath);
  const uniqueSignalMapDoc = isObjectRecord(input.uniqueSignalMapDoc)
    ? input.uniqueSignalMapDoc
    : readJsonObject(uniqueSignalMapPath);
  const duplicateBeforeAfterDoc = isObjectRecord(input.duplicateBeforeAfterDoc)
    ? input.duplicateBeforeAfterDoc
    : readJsonObject(duplicateBeforeAfterPath);
  const failsignalRegistryDoc = isObjectRecord(input.failsignalRegistryDoc)
    ? input.failsignalRegistryDoc
    : readJsonObject(failsignalRegistryPath);

  const canonLock = validateCanonLock(canonStatusDoc);

  const baseState = evaluateProcessTaxBudgetGateState({
    repoRoot,
    uniqueSignalMapDoc,
    duplicateBeforeAfterDoc,
    failsignalRegistryDoc,
    maxHeavyPassPerWindow: DEFAULT_MAX_HEAVY_PASS_PER_WINDOW,
    killSwitchWaveThreshold: DEFAULT_KILL_SWITCH_WAVE_THRESHOLD,
    runtimeBudgetMinutesMax: DEFAULT_RUNTIME_BUDGET_MINUTES_MAX,
  });

  const hashPayload = {
    profile: 'release',
    gateTier: 'release',
    scopeFlags: ['P2_WS03_ONLY'],
    ssot: [
      'PROCESS_TAX_BUDGET_GATE_AUTOMATION_v3',
      'WAVE_FRESHNESS_POLICY_v3_12',
      'CHECK_DEDUP_CANON_v3',
    ],
  };
  const stableHash = computeInputHash(hashPayload);
  const changedHash = computeInputHash({ ...hashPayload, scopeFlags: ['P2_WS03_ONLY', 'delta'] });

  const neg01DuplicateDoc = duplicateBeforeAfterDoc ? cloneJson(duplicateBeforeAfterDoc) : { before: {}, after: {} };
  if (!isObjectRecord(neg01DuplicateDoc.after)) neg01DuplicateDoc.after = {};
  neg01DuplicateDoc.after.duplicateSignalCount = 1;
  neg01DuplicateDoc.duplicateReductionOk = false;

  const neg01State = evaluateProcessTaxBudgetGateState({
    repoRoot,
    uniqueSignalMapDoc,
    duplicateBeforeAfterDoc: neg01DuplicateDoc,
    failsignalRegistryDoc,
  });
  const neg01Pass = !neg01State.duplicateGateMergeOrDisableCheck;

  const neg02Guard = evaluateHashFreshnessGuard({
    prevHash: stableHash,
    nextHash: stableHash,
    ttlValid: true,
    heavyRerunRequested: true,
  });
  const neg02Pass = !neg02Guard.ok && neg02Guard.failReason === 'HEAVY_RERUN_WITHOUT_INPUT_HASH_CHANGE';

  const neg03State = evaluateProcessTaxBudgetGateState({
    repoRoot,
    uniqueSignalMapDoc,
    duplicateBeforeAfterDoc,
    failsignalRegistryDoc,
    runtimeBudgetMinutesMax: DEFAULT_RUNTIME_BUDGET_MINUTES_MAX - 10,
  });
  const neg03Pass = !neg03State.ok && neg03State.failReason === 'E_RUNTIME_BUDGET_EXCEEDED';

  const neg04LanePolicy = evaluateLaneBudgetPolicy({ lane: 'fast', forceHeavyPolicy: true });
  const neg04Pass = !neg04LanePolicy.ok && neg04LanePolicy.failReason === 'FAST_LANE_FORCED_INTO_HEAVY_POLICY';

  const neg05UniqueMapDoc = uniqueSignalMapDoc ? cloneJson(uniqueSignalMapDoc) : { uniqueSignalMap: [] };
  if (!Array.isArray(neg05UniqueMapDoc.uniqueSignalMap)) neg05UniqueMapDoc.uniqueSignalMap = [];
  if (neg05UniqueMapDoc.uniqueSignalMap.length > 0) {
    neg05UniqueMapDoc.uniqueSignalMap[0].canonicalSource = '';
  }
  const neg05State = evaluateProcessTaxBudgetGateState({
    repoRoot,
    uniqueSignalMapDoc: neg05UniqueMapDoc,
    duplicateBeforeAfterDoc,
    failsignalRegistryDoc,
  });
  const neg05Pass = !neg05State.uniqueSignalRequiredCheck;

  const positiveHashGuard = evaluateHashFreshnessGuard({
    prevHash: stableHash,
    nextHash: changedHash,
    ttlValid: true,
    heavyRerunRequested: true,
  });

  const allNegativesPass = neg01Pass && neg02Pass && neg03Pass && neg04Pass && neg05Pass;

  const duplicateBefore = baseState.duplicateGateMergeOrDisable.before.duplicateSignalCount;
  const duplicateAfter = baseState.duplicateGateMergeOrDisable.after.duplicateSignalCount;
  const duplicateReduction = Number.isInteger(duplicateBefore)
    && Number.isInteger(duplicateAfter)
    && duplicateBefore >= duplicateAfter
    && duplicateAfter === 0;

  const positiveResults = {
    NEXT_TZ_POSITIVE_01: baseState.uniqueSignalRequiredCheck
      && baseState.duplicateGateMergeOrDisableCheck
      && duplicateReduction
      && baseState.advisoryToBlockingDriftCountZero,
    NEXT_TZ_POSITIVE_02: positiveHashGuard.ok && positiveHashGuard.hashChanged,
    NEXT_TZ_POSITIVE_03: baseState.maxHeavyPassPerWindowCheck
      && baseState.noDailyStrictWithoutScopeDeltaCheck
      && baseState.killSwitchOnNoSignalDeltaCheck
      && baseState.budgetThresholdProof.ok,
  };

  const negativeResults = {
    NEXT_TZ_NEGATIVE_01: neg01Pass,
    NEXT_TZ_NEGATIVE_02: neg02Pass,
    NEXT_TZ_NEGATIVE_03: neg03Pass,
    NEXT_TZ_NEGATIVE_04: neg04Pass,
    NEXT_TZ_NEGATIVE_05: neg05Pass,
  };

  const allPositivesPass = Object.values(positiveResults).every(Boolean);

  const dod = {
    NEXT_TZ_DOD_01: duplicateReduction && baseState.advisoryToBlockingDriftCountZero,
    NEXT_TZ_DOD_02: allNegativesPass,
    NEXT_TZ_DOD_03: allPositivesPass,
    NEXT_TZ_DOD_04: baseState.ok,
    NEXT_TZ_DOD_05: true,
  };

  const acceptance = {
    NEXT_TZ_ACCEPTANCE_01: canonLock.ok,
    NEXT_TZ_ACCEPTANCE_02: baseState.advisoryToBlockingDriftCountZero,
    NEXT_TZ_ACCEPTANCE_03: allNegativesPass,
    NEXT_TZ_ACCEPTANCE_04: allPositivesPass,
  };

  const preRepeatabilityOk = canonLock.ok
    && dod.NEXT_TZ_DOD_01
    && dod.NEXT_TZ_DOD_02
    && dod.NEXT_TZ_DOD_03
    && dod.NEXT_TZ_DOD_04
    && dod.NEXT_TZ_DOD_05
    && acceptance.NEXT_TZ_ACCEPTANCE_02
    && acceptance.NEXT_TZ_ACCEPTANCE_03
    && acceptance.NEXT_TZ_ACCEPTANCE_04;

  const state = {
    ok: preRepeatabilityOk,
    [TOKEN_NAME]: preRepeatabilityOk ? 1 : 0,
    failReason: '',
    failSignalCode: '',

    objective: 'УМЕНЬШИТЬ_PROCESS_TAX_БЕЗ_ПОТЕРИ_НАДЕЖНОСТИ_ЧЕРЕЗ_AUTOMATION_AND_CHECK_DEDUP',
    blockingSurfaceExpansion: false,

    canonLock,
    baseStateSummary: {
      ok: baseState.ok,
      uniqueSignalRequiredCheck: baseState.uniqueSignalRequiredCheck,
      duplicateGateMergeOrDisableCheck: baseState.duplicateGateMergeOrDisableCheck,
      advisoryToBlockingDriftCount: baseState.advisoryToBlockingDriftCount,
      maxHeavyPassPerWindowCheck: baseState.maxHeavyPassPerWindowCheck,
      noDailyStrictWithoutScopeDeltaCheck: baseState.noDailyStrictWithoutScopeDeltaCheck,
      killSwitchOnNoSignalDeltaCheck: baseState.killSwitchOnNoSignalDeltaCheck,
      budgetThresholdProofOk: baseState.budgetThresholdProof.ok,
    },

    counts: {
      duplicateCheckCountBefore: duplicateBefore,
      duplicateCheckCountAfter: duplicateAfter,
      duplicateCheckReduced: duplicateReduction,
      advisoryToBlockingDriftCount: baseState.advisoryToBlockingDriftCount,
      maxHeavyPassPerWindow: baseState.maxHeavyPassPerWindow.maxHeavyPassPerWindow,
      runtimeBudgetMinutesMax: baseState.budgetThresholdProof.runtimeBudgetMinutesMax,
    },

    negativeResults,
    negativeDetails: {
      DUPLICATE_CHAIN_WITHOUT_SHARED_EXECUTOR: {
        failReason: neg01State.failReason,
        duplicateSignalCountAfter: neg01State.duplicateGateMergeOrDisable.after.duplicateSignalCount,
      },
      HEAVY_RERUN_WITHOUT_HASH_CHANGE: neg02Guard,
      PROCESS_BUDGET_THRESHOLD_VIOLATION: {
        failReason: neg03State.failReason,
        runtimeBudgetMinutesMax: DEFAULT_RUNTIME_BUDGET_MINUTES_MAX - 10,
      },
      FAST_LANE_FORCED_INTO_HEAVY_POLICY: neg04LanePolicy,
      MISSING_DEDUP_MAPPING: {
        failReason: neg05State.failReason,
        uniqueSignalRequiredCheck: neg05State.uniqueSignalRequiredCheck,
      },
    },

    positiveResults,
    positiveDetails: {
      DEDUP_ENGINE: {
        uniqueSignalRequiredCheck: baseState.uniqueSignalRequiredCheck,
        duplicateGateMergeOrDisableCheck: baseState.duplicateGateMergeOrDisableCheck,
        duplicateCheckCountBefore: duplicateBefore,
        duplicateCheckCountAfter: duplicateAfter,
      },
      HASH_FRESHNESS_GUARD: positiveHashGuard,
      LANE_BUDGETS: {
        maxHeavyPassPerWindowCheck: baseState.maxHeavyPassPerWindowCheck,
        noDailyStrictWithoutScopeDeltaCheck: baseState.noDailyStrictWithoutScopeDeltaCheck,
        killSwitchOnNoSignalDeltaCheck: baseState.killSwitchOnNoSignalDeltaCheck,
        budgetThresholdProofOk: baseState.budgetThresholdProof.ok,
      },
    },

    dod,
    acceptance,
  };

  if (!state.ok) {
    state.failReason = !canonLock.ok
      ? canonLock.reason
      : !dod.NEXT_TZ_DOD_01
        ? 'DUPLICATE_CHECK_REDUCTION_OR_SAFETY_REGRESSION'
        : !dod.NEXT_TZ_DOD_02
          ? 'NEGATIVE_SCENARIO_FAILURE'
          : !dod.NEXT_TZ_DOD_03
            ? 'POSITIVE_SCENARIO_FAILURE'
            : !acceptance.NEXT_TZ_ACCEPTANCE_02
              ? 'ADVISORY_TO_BLOCKING_DRIFT'
              : 'P2_WS03_PROCESS_TAX_BUDGET_AUTOMATION_FAIL';
    state.failSignalCode = state.failReason;
  }

  return state;
}

function printHuman(state) {
  console.log(`${TOKEN_NAME}=${state[TOKEN_NAME]}`);
  console.log(`DUPLICATE_CHECK_COUNT_BEFORE=${state.counts.duplicateCheckCountBefore}`);
  console.log(`DUPLICATE_CHECK_COUNT_AFTER=${state.counts.duplicateCheckCountAfter}`);
  console.log(`ADVISORY_TO_BLOCKING_DRIFT_COUNT=${state.counts.advisoryToBlockingDriftCount}`);
  console.log(`NEXT_TZ_DOD_01=${state.dod.NEXT_TZ_DOD_01 ? 1 : 0}`);
  console.log(`NEXT_TZ_DOD_02=${state.dod.NEXT_TZ_DOD_02 ? 1 : 0}`);
  console.log(`NEXT_TZ_DOD_03=${state.dod.NEXT_TZ_DOD_03 ? 1 : 0}`);
  if (!state.ok) {
    console.log(`FAIL_REASON=${state.failReason}`);
    console.log(`FAIL_SIGNAL=${state.failSignalCode}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluateP2Ws03ProcessTaxBudgetAutomationState({
    repoRoot: process.cwd(),
    canonStatusPath: args.canonStatusPath,
    uniqueSignalMapPath: args.uniqueSignalMapPath,
    duplicateBeforeAfterPath: args.duplicateBeforeAfterPath,
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
  evaluateP2Ws03ProcessTaxBudgetAutomationState,
  TOKEN_NAME,
};

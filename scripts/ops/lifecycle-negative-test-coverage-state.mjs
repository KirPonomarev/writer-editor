#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TOKEN_NAME = 'LIFECYCLE_NEGATIVE_TEST_COVERAGE_OK';
const DEFAULT_STATUS_PATH = 'docs/OPS/STATUS/LIFECYCLE_NEGATIVE_TEST_COVERAGE_v3.json';
const DEFAULT_PHASE_SWITCH_PATH = 'docs/OPS/STATUS/PHASE_SWITCH_V1.json';
const ALLOWED_PHASES = new Set(['PHASE_1_SHADOW', 'PHASE_2_WARN', 'PHASE_3_HARD']);
const ALLOWED_MODES = new Set(['pr', 'release', 'promotion']);

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isObjectRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parseBoolean(value) {
  if (typeof value === 'boolean') return value;
  const normalized = normalizeString(value).toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
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

function uniqueSortedStrings(values) {
  if (!Array.isArray(values)) return [];
  const unique = new Set();
  for (const value of values) {
    const normalized = normalizeString(value);
    if (normalized) unique.add(normalized);
  }
  return [...unique].sort((a, b) => a.localeCompare(b));
}

function parseArgs(argv = process.argv.slice(2)) {
  const out = {
    json: false,
    statusPath: '',
    phaseSwitchPath: '',
    negativeCasesPath: '',
    mode: '',
    skipNegativeChecks: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = normalizeString(argv[i]);
    if (!arg) continue;

    if (arg === '--json') {
      out.json = true;
      continue;
    }

    if (arg === '--status-path' && i + 1 < argv.length) {
      out.statusPath = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--status-path=')) {
      out.statusPath = normalizeString(arg.slice('--status-path='.length));
      continue;
    }

    if (arg === '--phase-switch-path' && i + 1 < argv.length) {
      out.phaseSwitchPath = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--phase-switch-path=')) {
      out.phaseSwitchPath = normalizeString(arg.slice('--phase-switch-path='.length));
      continue;
    }

    if (arg === '--negative-cases-path' && i + 1 < argv.length) {
      out.negativeCasesPath = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--negative-cases-path=')) {
      out.negativeCasesPath = normalizeString(arg.slice('--negative-cases-path='.length));
      continue;
    }

    if (arg === '--mode' && i + 1 < argv.length) {
      out.mode = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--mode=')) {
      out.mode = normalizeString(arg.slice('--mode='.length));
      continue;
    }

    if (arg === '--skip-negative-checks') {
      out.skipNegativeChecks = true;
      continue;
    }
    if (arg.startsWith('--skip-negative-checks=')) {
      out.skipNegativeChecks = parseBoolean(arg.slice('--skip-negative-checks='.length));
    }
  }

  return out;
}

function buildState(base = {}) {
  return {
    ok: false,
    [TOKEN_NAME]: 0,
    statusPath: '',
    phaseSwitchPath: '',
    negativeCasesPath: '',
    mode: 'release',
    activePhase: '',
    phaseEnforcementMode: '',
    phaseShouldBlock: false,
    tokenBindingOk: false,
    requiredMergeFlowGates: [],
    requiredMergeFlowGateCount: 0,
    coveredMergeFlowGateCount: 0,
    missingMergeFlowGates: [],
    missingMergeFlowGateCount: 0,
    negativeCaseCount: 0,
    executableNegativeCaseCount: 0,
    nonExecutableNegativeCaseCount: 0,
    skipNegativeChecksRequested: false,
    skipSuppressionAttempted: false,
    skipSuppressionPrevented: false,
    negativeCoverageOk: false,
    releaseGateNonzeroOnFail: false,
    stopCode: '',
    failReason: 'E_LIFECYCLE_NEGATIVE_COVERAGE_INCOMPLETE',
    productVerdict: 'FAIL',
    deliveryVerdict: 'BLOCK',
    ...base,
  };
}

function resolveDeliveryVerdict(ok, mode, phaseShouldBlock) {
  if (ok) return 'PASS';
  if (mode === 'release' || mode === 'promotion') {
    return phaseShouldBlock ? 'BLOCK' : 'WARN';
  }
  return 'WARN';
}

export function evaluateLifecycleNegativeTestCoverageState(input = {}) {
  const statusPath = normalizeString(input.statusPath || process.env.LIFECYCLE_NEGATIVE_TEST_COVERAGE_STATUS_PATH || DEFAULT_STATUS_PATH);
  const phaseSwitchPath = normalizeString(input.phaseSwitchPath || process.env.PHASE_SWITCH_V1_PATH || DEFAULT_PHASE_SWITCH_PATH);

  const modeRaw = normalizeString(input.mode || process.env.MODE || 'release').toLowerCase();
  const mode = ALLOWED_MODES.has(modeRaw) ? modeRaw : 'release';

  const skipNegativeChecksRequested = parseBoolean(input.skipNegativeChecks ?? process.env.LIFECYCLE_SKIP_NEGATIVE_CHECKS);

  const statusDoc = readJsonObject(statusPath);
  if (!statusDoc) {
    return buildState({
      statusPath,
      phaseSwitchPath,
      mode,
      skipNegativeChecksRequested,
      failReason: 'E_LIFECYCLE_STATUS_UNREADABLE',
      stopCode: 'E_LIFECYCLE_NEGATIVE_COVERAGE_INCOMPLETE',
      releaseGateNonzeroOnFail: mode === 'release' || mode === 'promotion',
      deliveryVerdict: resolveDeliveryVerdict(false, mode, true),
    });
  }

  const phaseSwitchDoc = readJsonObject(phaseSwitchPath);
  if (!phaseSwitchDoc) {
    return buildState({
      statusPath,
      phaseSwitchPath,
      mode,
      skipNegativeChecksRequested,
      failReason: 'E_PHASE_SWITCH_INVALID',
      stopCode: 'E_PHASE_SWITCH_INVALID',
      releaseGateNonzeroOnFail: mode === 'release' || mode === 'promotion',
      deliveryVerdict: resolveDeliveryVerdict(false, mode, true),
    });
  }

  const activePhase = normalizeString(phaseSwitchDoc.activePhase || phaseSwitchDoc.ACTIVE_PHASE);
  if (!ALLOWED_PHASES.has(activePhase)) {
    return buildState({
      statusPath,
      phaseSwitchPath,
      mode,
      skipNegativeChecksRequested,
      activePhase,
      failReason: 'E_PHASE_SWITCH_INVALID',
      stopCode: 'E_PHASE_SWITCH_INVALID',
      releaseGateNonzeroOnFail: mode === 'release' || mode === 'promotion',
      deliveryVerdict: resolveDeliveryVerdict(false, mode, true),
    });
  }

  const phaseRule = isObjectRecord(phaseSwitchDoc.phasePrecedence)
    ? phaseSwitchDoc.phasePrecedence[activePhase]
    : null;
  const phaseEnforcementMode = normalizeString(phaseRule?.newV1Enforcement || '');
  const phaseShouldBlock = Boolean(phaseRule?.shouldBlock);

  const requiredMergeFlowGates = uniqueSortedStrings(statusDoc.requiredMergeFlowGates);
  const tokenBindingOk = normalizeString(statusDoc.token).length > 0
    && normalizeString(statusDoc.machineCheckId).length > 0
    && normalizeString(statusDoc.incompleteCoverageStopCode).length > 0
    && normalizeString(statusDoc.releaseGateNonzeroStopCode).length > 0
    && normalizeString(statusDoc.skipBypassStopCode).length > 0;

  const negativeCasesPath = normalizeString(
    input.negativeCasesPath
      || process.env.LIFECYCLE_NEGATIVE_CASES_PATH
      || statusDoc.mergeFlowNegativeCasesRef,
  );

  const negativeCasesDoc = readJsonObject(negativeCasesPath);
  const cases = Array.isArray(negativeCasesDoc?.cases) ? negativeCasesDoc.cases : [];

  const executableByGate = new Map();
  let executableNegativeCaseCount = 0;
  let nonExecutableNegativeCaseCount = 0;

  for (const row of cases) {
    if (!isObjectRecord(row)) continue;
    const gateId = normalizeString(row.gateId || row.gate || row.machineCheckId);
    if (!gateId) continue;
    const executable = row.executable === true;
    if (executable) {
      executableNegativeCaseCount += 1;
      executableByGate.set(gateId, (executableByGate.get(gateId) || 0) + 1);
    } else {
      nonExecutableNegativeCaseCount += 1;
    }
  }

  const missingMergeFlowGates = requiredMergeFlowGates.filter((gateId) => !executableByGate.has(gateId));
  const coveredMergeFlowGateCount = requiredMergeFlowGates.length - missingMergeFlowGates.length;

  const negativeCoverageOk = tokenBindingOk
    && requiredMergeFlowGates.length > 0
    && missingMergeFlowGates.length === 0;

  const skipSuppressionAttempted = skipNegativeChecksRequested && (mode === 'release' || mode === 'promotion');
  const skipSuppressionPrevented = skipSuppressionAttempted;

  const incompleteCoverageStopCode = normalizeString(statusDoc.incompleteCoverageStopCode) || 'E_LIFECYCLE_NEGATIVE_COVERAGE_INCOMPLETE';
  const skipBypassStopCode = normalizeString(statusDoc.skipBypassStopCode) || 'E_SKIP_FLAG_BYPASS';

  let failReason = '';
  let stopCode = '';
  if (skipSuppressionAttempted) {
    failReason = skipBypassStopCode;
    stopCode = skipBypassStopCode;
  } else if (!negativeCoverageOk) {
    failReason = incompleteCoverageStopCode;
    stopCode = incompleteCoverageStopCode;
  }

  const ok = failReason.length === 0;
  const releaseGateNonzeroOnFail = !ok && (mode === 'release' || mode === 'promotion');

  return buildState({
    ok,
    [TOKEN_NAME]: ok ? 1 : 0,
    statusPath,
    phaseSwitchPath,
    negativeCasesPath,
    mode,
    activePhase,
    phaseEnforcementMode,
    phaseShouldBlock,
    tokenBindingOk,
    requiredMergeFlowGates,
    requiredMergeFlowGateCount: requiredMergeFlowGates.length,
    coveredMergeFlowGateCount,
    missingMergeFlowGates,
    missingMergeFlowGateCount: missingMergeFlowGates.length,
    negativeCaseCount: cases.length,
    executableNegativeCaseCount,
    nonExecutableNegativeCaseCount,
    skipNegativeChecksRequested,
    skipSuppressionAttempted,
    skipSuppressionPrevented,
    negativeCoverageOk,
    releaseGateNonzeroOnFail,
    stopCode,
    failReason,
    productVerdict: ok ? 'PASS' : 'FAIL',
    deliveryVerdict: resolveDeliveryVerdict(ok, mode, phaseShouldBlock),
  });
}

function printHuman(state) {
  console.log(`${TOKEN_NAME}=${state[TOKEN_NAME]}`);
  console.log(`LIFECYCLE_NEGATIVE_COVERAGE_OK=${state.negativeCoverageOk ? 1 : 0}`);
  console.log(`LIFECYCLE_REQUIRED_GATES=${state.requiredMergeFlowGateCount}`);
  console.log(`LIFECYCLE_MISSING_GATES=${state.missingMergeFlowGateCount}`);
  console.log(`LIFECYCLE_NEGATIVE_CASES=${state.negativeCaseCount}`);
  console.log(`LIFECYCLE_NEGATIVE_EXECUTABLE_CASES=${state.executableNegativeCaseCount}`);
  console.log(`LIFECYCLE_SKIP_SUPPRESSION_ATTEMPTED=${state.skipSuppressionAttempted ? 1 : 0}`);
  console.log(`LIFECYCLE_SKIP_SUPPRESSION_PREVENTED=${state.skipSuppressionPrevented ? 1 : 0}`);
  console.log(`PRODUCT_VERDICT=${state.productVerdict}`);
  console.log(`DELIVERY_VERDICT=${state.deliveryVerdict}`);
  if (!state.ok) {
    console.log(`FAIL_REASON=${state.failReason}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluateLifecycleNegativeTestCoverageState({
    statusPath: args.statusPath,
    phaseSwitchPath: args.phaseSwitchPath,
    negativeCasesPath: args.negativeCasesPath,
    mode: args.mode,
    skipNegativeChecks: args.skipNegativeChecks,
  });

  if (args.json) {
    process.stdout.write(`${stableStringify(state)}\n`);
  } else {
    printHuman(state);
  }

  process.exit(state.ok ? 0 : 1);
}

const currentFilePath = fileURLToPath(import.meta.url);
if (
  process.argv[1]
  && fs.existsSync(process.argv[1])
  && fs.existsSync(currentFilePath)
  && fs.realpathSync(process.argv[1]) === fs.realpathSync(currentFilePath)
) {
  main();
}

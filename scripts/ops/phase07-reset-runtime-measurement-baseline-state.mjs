#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { evaluatePhase07StartupProjectOpenSceneSwitchResetRuntimeMeasurementsFoundationState } from './phase07-startup-project-open-scene-switch-reset-runtime-measurements-foundation-state.mjs';
import { evaluatePhase07StartupRuntimeMeasurementBaselineState } from './phase07-startup-runtime-measurement-baseline-state.mjs';
import { evaluatePhase07SceneSwitchRuntimeMeasurementBaselineState } from './phase07-scene-switch-runtime-measurement-baseline-state.mjs';
import { evaluatePhase07StartupProjectOpenSceneSwitchResetBlockingBudgetsBaselineState } from './phase07-startup-project-open-scene-switch-reset-blocking-budgets-baseline-state.mjs';

const FAIL_REASON_FORCED_NEGATIVE = 'E_PHASE07_RESET_RUNTIME_MEASUREMENT_BASELINE_FORCED_NEGATIVE';
const FAIL_REASON_UNEXPECTED = 'E_PHASE07_RESET_RUNTIME_MEASUREMENT_BASELINE_UNEXPECTED';
const PACKET_PATH = 'docs/OPS/STATUS/PHASE07_RESET_RUNTIME_MEASUREMENT_BASELINE_V1.json';
const PERF_RUN_SCRIPT = 'scripts/ops/perf-run.mjs';

const EXPECTED_BLOCKING_BUDGET_IDS = Object.freeze([
  'STARTUP',
  'PROJECT_OPEN',
  'SCENE_SWITCH',
  'RESET',
]);

const EXPECTED_BOUND_SIGNAL_IDS = Object.freeze([
  'STARTUP_MEASUREMENT_BOUND',
  'PROJECT_OPEN_MEASUREMENT_BOUND',
  'SCENE_SWITCH_MEASUREMENT_BOUND',
  'RESET_MEASUREMENT_BOUND',
  'PERF_RUN_RESET_MEASUREMENT_PRESENT',
  'BLOCKING_BUDGET_ORDER_STARTUP_PROJECT_OPEN_SCENE_SWITCH_RESET',
]);

const EXPECTED_LOCKED_TARGET_IDS = Object.freeze([
  'STARTUP_MEASUREMENT_BOUND',
  'PROJECT_OPEN_MEASUREMENT_BOUND',
  'SCENE_SWITCH_MEASUREMENT_BOUND',
  'RESET_MEASUREMENT_BOUND',
  'BLOCKING_BUDGET_ORDER_STARTUP_PROJECT_OPEN_SCENE_SWITCH_RESET',
  'PHASE07_RESET_RUNTIME_MEASUREMENT_BASELINE',
]);

function parseArgs(argv) {
  const out = { json: false, forceNegative: false };
  for (const token of argv) {
    if (token === '--json') out.json = true;
    if (token === '--force-negative') out.forceNegative = true;
  }
  return out;
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.resolve(relativePath), 'utf8'));
}

function asCheck(status, measured, note) {
  return { status, measured, note };
}

function arraysEqual(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

function runPerfRunJson() {
  const result = spawnSync(process.execPath, [PERF_RUN_SCRIPT, '--json'], {
    encoding: 'utf8',
  });
  let parsed = null;
  try {
    parsed = JSON.parse(String(result.stdout || '{}'));
  } catch {
    parsed = null;
  }
  return {
    status: typeof result.status === 'number' ? result.status : 1,
    parsed,
    stdout: String(result.stdout || ''),
    stderr: String(result.stderr || ''),
  };
}

function evaluatePhase07ResetRuntimeMeasurementBaselineState(input = {}) {
  const forceNegative = Boolean(input.forceNegative);

  try {
    const foundationState = evaluatePhase07StartupProjectOpenSceneSwitchResetRuntimeMeasurementsFoundationState({});
    const startupBaselineState = evaluatePhase07StartupRuntimeMeasurementBaselineState({});
    const sceneSwitchBaselineState = evaluatePhase07SceneSwitchRuntimeMeasurementBaselineState({});
    const blockingBudgetsState = evaluatePhase07StartupProjectOpenSceneSwitchResetBlockingBudgetsBaselineState({});
    const perfRun = runPerfRunJson();
    const packetExists = fs.existsSync(path.resolve(PACKET_PATH));
    const packet = packetExists ? readJson(PACKET_PATH) : null;

    const perfRunResetMeasurementPresent = perfRun.status === 0
      && perfRun.parsed
      && Number.isFinite(Number(perfRun.parsed.metrics?.reset_ms));
    const blockingBudgetsBaselinePass = blockingBudgetsState.ok === true
      && blockingBudgetsState.overallStatus === 'PASS'
      && blockingBudgetsState.phase07BlockingBudgetsBaselineStatus === 'PASS'
      && blockingBudgetsState.phase07ReleaseReadinessStatus === 'HOLD';
    const foundationPass = foundationState.ok === true
      && foundationState.overallStatus === 'PASS'
      && foundationState.phase07RuntimeMeasurementsFoundationStatus === 'PASS'
      && foundationState.phase07RuntimeMeasurementsReadinessStatus === 'HOLD';
    const startupBaselinePass = startupBaselineState.ok === true
      && startupBaselineState.overallStatus === 'PASS'
      && startupBaselineState.phase07StartupRuntimeMeasurementBaselineStatus === 'PASS'
      && startupBaselineState.phase07ReadinessStatus === 'HOLD';
    const sceneSwitchBaselinePass = sceneSwitchBaselineState.ok === true
      && sceneSwitchBaselineState.overallStatus === 'PASS'
      && sceneSwitchBaselineState.phase07SceneSwitchRuntimeMeasurementBaselineStatus === 'PASS'
      && sceneSwitchBaselineState.phase07ReadinessStatus === 'HOLD';
    const startupMeasurementBound = foundationState.checkStatusById?.STARTUP_MEASUREMENT_BOUND?.status === 'GREEN'
      && foundationState.checkStatusById?.STARTUP_MEASUREMENT_BOUND?.measured === true;
    const projectOpenMeasurementBound = foundationState.checkStatusById?.PROJECT_OPEN_MEASUREMENT_BOUND?.status === 'GREEN'
      && foundationState.checkStatusById?.PROJECT_OPEN_MEASUREMENT_BOUND?.measured === true;
    const sceneSwitchMeasurementBound = foundationState.checkStatusById?.SCENE_SWITCH_MEASUREMENT_BOUND?.status === 'GREEN'
      && foundationState.checkStatusById?.SCENE_SWITCH_MEASUREMENT_BOUND?.measured === true;
    const resetMeasurementBound = foundationState.checkStatusById?.RESET_MEASUREMENT_BOUND?.status === 'GREEN'
      && foundationState.checkStatusById?.RESET_MEASUREMENT_BOUND?.measured === true;
    const blockingBudgetOrderExact = arraysEqual(blockingBudgetsState.phase07BlockingBudgetIds || [], EXPECTED_BLOCKING_BUDGET_IDS);
    const pendingGapIdsExact = arraysEqual(packet?.phase07PendingGapIds || [], []);
    const sourceFoundationMatches = packet?.sourcePhase07RuntimeMeasurementsFoundationState === 'phase07-startup-project-open-scene-switch-reset-runtime-measurements-foundation-state.mjs';
    const sourceStartupBaselineMatches = packet?.sourcePhase07StartupRuntimeMeasurementBaselineState === 'phase07-startup-runtime-measurement-baseline-state.mjs';
    const sourceSceneSwitchBaselineMatches = packet?.sourcePhase07SceneSwitchRuntimeMeasurementBaselineState === 'phase07-scene-switch-runtime-measurement-baseline-state.mjs';
    const sourceBlockingBudgetsMatches = packet?.sourcePhase07BlockingBudgetsBaselineState === 'phase07-startup-project-open-scene-switch-reset-blocking-budgets-baseline-state.mjs';
    const packetPass = packet?.status === 'PASS';
    const packetReadyHold = packet?.phase07ReadinessStatus === 'HOLD';
    const packetInternalConsistency = Boolean(packet)
      && packet?.artifactId === 'PHASE07_RESET_RUNTIME_MEASUREMENT_BASELINE_V1'
      && packet?.schemaVersion === 1
      && packet?.phaseId === 'PHASE_07'
      && packetPass
      && packet?.phase07ResetRuntimeMeasurementBaselineStatus === 'PASS'
      && packetReadyHold
      && sourceFoundationMatches
      && sourceStartupBaselineMatches
      && sourceSceneSwitchBaselineMatches
      && sourceBlockingBudgetsMatches
      && perfRunResetMeasurementPresent
      && foundationPass
      && startupBaselinePass
      && sceneSwitchBaselinePass
      && blockingBudgetsBaselinePass
      && startupMeasurementBound
      && projectOpenMeasurementBound
      && sceneSwitchMeasurementBound
      && resetMeasurementBound
      && blockingBudgetOrderExact
      && pendingGapIdsExact
      && arraysEqual(packet?.phase07BlockingBudgetIds || [], EXPECTED_BLOCKING_BUDGET_IDS)
      && arraysEqual(packet?.boundSignalIds || [], EXPECTED_BOUND_SIGNAL_IDS)
      && arraysEqual(packet?.lockedTargetIds || [], EXPECTED_LOCKED_TARGET_IDS)
      && packet?.proof?.previousPhase07BlockingBudgetsBaselinePassTrue === true
      && packet?.proof?.phase07RuntimeMeasurementsFoundationPassTrue === true
      && packet?.proof?.phase07StartupRuntimeMeasurementBaselinePassTrue === true
      && packet?.proof?.phase07SceneSwitchRuntimeMeasurementBaselinePassTrue === true
      && packet?.proof?.perfRunResetMeasurementPresentTrue === true
      && packet?.proof?.startupMeasurementBoundTrue === true
      && packet?.proof?.projectOpenMeasurementBoundTrue === true
      && packet?.proof?.sceneSwitchMeasurementBoundTrue === true
      && packet?.proof?.resetMeasurementBoundTrue === true
      && packet?.proof?.blockingBudgetOrderExactTrue === true
      && packet?.proof?.phase07PendingGapIdsExactTrue === true
      && packet?.proof?.phase07ReadinessStatusHoldTrue === true
      && packet?.proof?.noFalsePhase07GreenTrue === true
      && packet?.proof?.packetInternalConsistencyTrue === true;

    const checkStatusById = {
      PREVIOUS_PHASE07_BLOCKING_BUDGETS_BASELINE_PASS: asCheck(blockingBudgetsBaselinePass ? 'GREEN' : 'OPEN_GAP', blockingBudgetsBaselinePass, blockingBudgetsBaselinePass ? 'PREVIOUS_PHASE07_BLOCKING_BUDGETS_BASELINE_PASS' : 'PREVIOUS_PHASE07_BLOCKING_BUDGETS_BASELINE_NOT_PASS'),
      PHASE07_RUNTIME_MEASUREMENTS_FOUNDATION_PASS: asCheck(foundationPass ? 'GREEN' : 'OPEN_GAP', foundationPass, foundationPass ? 'PHASE07_RUNTIME_MEASUREMENTS_FOUNDATION_PASS' : 'PHASE07_RUNTIME_MEASUREMENTS_FOUNDATION_NOT_PASS'),
      PHASE07_STARTUP_RUNTIME_MEASUREMENT_BASELINE_PASS: asCheck(startupBaselinePass ? 'GREEN' : 'OPEN_GAP', startupBaselinePass, startupBaselinePass ? 'PHASE07_STARTUP_RUNTIME_MEASUREMENT_BASELINE_PASS' : 'PHASE07_STARTUP_RUNTIME_MEASUREMENT_BASELINE_NOT_PASS'),
      PHASE07_SCENE_SWITCH_RUNTIME_MEASUREMENT_BASELINE_PASS: asCheck(sceneSwitchBaselinePass ? 'GREEN' : 'OPEN_GAP', sceneSwitchBaselinePass, sceneSwitchBaselinePass ? 'PHASE07_SCENE_SWITCH_RUNTIME_MEASUREMENT_BASELINE_PASS' : 'PHASE07_SCENE_SWITCH_RUNTIME_MEASUREMENT_BASELINE_NOT_PASS'),
      PERF_RUN_RESET_MEASUREMENT_PRESENT: asCheck(perfRunResetMeasurementPresent ? 'GREEN' : 'OPEN_GAP', perfRunResetMeasurementPresent, perfRunResetMeasurementPresent ? 'PERF_RUN_RESET_MEASUREMENT_PRESENT' : 'PERF_RUN_RESET_MEASUREMENT_MISSING'),
      STARTUP_MEASUREMENT_BOUND: asCheck(startupMeasurementBound ? 'GREEN' : 'OPEN_GAP', startupMeasurementBound, startupMeasurementBound ? 'STARTUP_MEASUREMENT_BOUND' : 'STARTUP_MEASUREMENT_NOT_BOUND'),
      PROJECT_OPEN_MEASUREMENT_BOUND: asCheck(projectOpenMeasurementBound ? 'GREEN' : 'OPEN_GAP', projectOpenMeasurementBound, projectOpenMeasurementBound ? 'PROJECT_OPEN_MEASUREMENT_BOUND' : 'PROJECT_OPEN_MEASUREMENT_NOT_BOUND'),
      SCENE_SWITCH_MEASUREMENT_BOUND: asCheck(sceneSwitchMeasurementBound ? 'GREEN' : 'OPEN_GAP', sceneSwitchMeasurementBound, sceneSwitchMeasurementBound ? 'SCENE_SWITCH_MEASUREMENT_BOUND' : 'SCENE_SWITCH_MEASUREMENT_NOT_BOUND'),
      RESET_MEASUREMENT_BOUND: asCheck(resetMeasurementBound ? 'GREEN' : 'OPEN_GAP', resetMeasurementBound, resetMeasurementBound ? 'RESET_MEASUREMENT_BOUND' : 'RESET_MEASUREMENT_NOT_BOUND'),
      BLOCKING_BUDGET_ORDER_EXACT: asCheck(blockingBudgetOrderExact ? 'GREEN' : 'OPEN_GAP', blockingBudgetOrderExact, blockingBudgetOrderExact ? 'BLOCKING_BUDGET_ORDER_EXACT' : 'BLOCKING_BUDGET_ORDER_DRIFT'),
      PACKET_PRESENT: asCheck(packetExists ? 'GREEN' : 'OPEN_GAP', packetExists, packetExists ? 'PACKET_PRESENT' : 'PACKET_MISSING'),
      PACKET_PASS: asCheck(packetPass ? 'GREEN' : 'OPEN_GAP', packetPass, packetPass ? 'PACKET_PASS' : 'PACKET_NOT_PASS'),
      PACKET_READINESS_STATUS_HOLD: asCheck(packetReadyHold ? 'GREEN' : 'OPEN_GAP', packetReadyHold, packetReadyHold ? 'PACKET_READINESS_STATUS_HOLD' : 'PACKET_READINESS_STATUS_NOT_HOLD'),
      PACKET_INTERNAL_CONSISTENCY: asCheck(packetInternalConsistency ? 'GREEN' : 'OPEN_GAP', packetInternalConsistency, packetInternalConsistency ? 'PACKET_INTERNAL_CONSISTENCY' : 'PACKET_INTERNAL_CONSISTENCY_BROKEN')
    };

    const greenCheckIds = Object.entries(checkStatusById)
      .filter(([, value]) => value.status === 'GREEN')
      .map(([id]) => id);
    const openGapIds = Object.entries(checkStatusById)
      .filter(([, value]) => value.status !== 'GREEN')
      .map(([id]) => id);

    if (forceNegative) {
      return {
        ok: false,
        failReason: FAIL_REASON_FORCED_NEGATIVE,
        overallStatus: 'HOLD',
        phase07ResetRuntimeMeasurementBaselineStatus: 'HOLD',
        phase07ReadinessStatus: 'HOLD',
        greenCheckIds,
        openGapIds: Array.from(new Set([...openGapIds, 'FORCED_NEGATIVE_PATH'])),
        checkStatusById,
        phase07PendingGapIds: packet?.phase07PendingGapIds || [],
        phase07BlockingBudgetIds: packet?.phase07BlockingBudgetIds || [],
        boundSignalIds: packet?.boundSignalIds || [],
        lockedTargetIds: packet?.lockedTargetIds || []
      };
    }

    return {
      ok: Boolean(packetInternalConsistency),
      failReason: '',
      overallStatus: packetInternalConsistency ? 'PASS' : 'HOLD',
      phase07ResetRuntimeMeasurementBaselineStatus: packetPass ? 'PASS' : 'HOLD',
      phase07ReadinessStatus: packetReadyHold ? 'HOLD' : 'UNKNOWN',
      greenCheckIds,
      openGapIds,
      checkStatusById,
      phase07PendingGapIds: packet?.phase07PendingGapIds || [],
      phase07BlockingBudgetIds: packet?.phase07BlockingBudgetIds || [],
      boundSignalIds: packet?.boundSignalIds || [],
      lockedTargetIds: packet?.lockedTargetIds || []
    };
  } catch (error) {
    return {
      ok: false,
      failReason: FAIL_REASON_UNEXPECTED,
      overallStatus: 'HOLD',
      phase07ResetRuntimeMeasurementBaselineStatus: 'UNKNOWN',
      phase07ReadinessStatus: 'UNKNOWN',
      greenCheckIds: [],
      openGapIds: ['PHASE07_RESET_RUNTIME_MEASUREMENT_BASELINE_EVALUATION_ERROR'],
      checkStatusById: {},
      phase07PendingGapIds: [],
      phase07BlockingBudgetIds: [],
      boundSignalIds: [],
      lockedTargetIds: [],
      errorMessage: error && typeof error.message === 'string' ? error.message : 'UNKNOWN'
    };
  }
}

function runCli() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluatePhase07ResetRuntimeMeasurementBaselineState({ forceNegative: args.forceNegative });

  if (args.json) {
    console.log(JSON.stringify(state, null, 2));
  } else {
    console.log('PHASE07_RESET_RUNTIME_MEASUREMENT_BASELINE_OK=' + (state.ok ? 1 : 0));
    console.log('PHASE07_RESET_RUNTIME_MEASUREMENT_BASELINE_OVERALL_STATUS=' + state.overallStatus);
    console.log('PHASE07_RESET_RUNTIME_MEASUREMENT_BASELINE_STATUS=' + state.phase07ResetRuntimeMeasurementBaselineStatus);
    console.log('PHASE07_RESET_RUNTIME_MEASUREMENT_BASELINE_READINESS_STATUS=' + state.phase07ReadinessStatus);
    console.log('PHASE07_RESET_RUNTIME_MEASUREMENT_BASELINE_OPEN_GAP_IDS=' + state.openGapIds.join(','));
    console.log('PHASE07_RESET_RUNTIME_MEASUREMENT_BASELINE_FAIL_REASON=' + state.failReason);
  }

  process.exit(state.ok ? 0 : 1);
}

const selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(selfPath)) {
  runCli();
}

export { evaluatePhase07ResetRuntimeMeasurementBaselineState };

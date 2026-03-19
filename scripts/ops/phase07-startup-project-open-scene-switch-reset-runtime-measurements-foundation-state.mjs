#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FAIL_REASON_FORCED_NEGATIVE = 'E_PHASE07_STARTUP_PROJECT_OPEN_SCENE_SWITCH_RESET_RUNTIME_MEASUREMENTS_FOUNDATION_FORCED_NEGATIVE';
const FAIL_REASON_UNEXPECTED = 'E_PHASE07_STARTUP_PROJECT_OPEN_SCENE_SWITCH_RESET_RUNTIME_MEASUREMENTS_FOUNDATION_UNEXPECTED';

const PREVIOUS_PHASE07_BLOCKING_BUDGETS_BASELINE_PACKET_PATH = 'docs/OPS/STATUS/PHASE07_STARTUP_PROJECT_OPEN_SCENE_SWITCH_RESET_BLOCKING_BUDGETS_BASELINE_V1.json';
const PACKET_PATH = 'docs/OPS/STATUS/PHASE07_STARTUP_PROJECT_OPEN_SCENE_SWITCH_RESET_RUNTIME_MEASUREMENTS_FOUNDATION_V1.json';

const PERF_INFRA_FILES = Object.freeze([
  'scripts/perf/perf-lite.mjs',
  'scripts/perf/perf-baseline.mjs',
  'scripts/ops/perf-run.mjs',
  'scripts/ops/perf-state.mjs',
  'docs/OPS/PERF/PERF_LITE_BASELINE.json',
  'src/renderer/commands/projectCommands.mjs',
  'src/renderer/tiptap/runtimeBridge.js',
]);

const EXPECTED_BLOCKING_BUDGET_IDS = Object.freeze([
  'STARTUP',
  'PROJECT_OPEN',
  'SCENE_SWITCH',
  'RESET',
]);

const EXPECTED_PENDING_GAP_IDS = Object.freeze([
  'PHASE07_STARTUP_MEASUREMENT_NOT_BOUND',
  'PHASE07_SCENE_SWITCH_MEASUREMENT_NOT_BOUND',
  'PHASE07_RESET_MEASUREMENT_NOT_BOUND',
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

function readText(relativePath) {
  return fs.readFileSync(path.resolve(relativePath), 'utf8');
}

function asCheck(status, measured, note) {
  return { status, measured, note };
}

function arraysEqual(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

function hasAny(text, markers) {
  return markers.some((marker) => String(text || '').includes(marker));
}

function hasAll(text, markers) {
  return markers.every((marker) => String(text || '').includes(marker));
}

function evaluatePhase07StartupProjectOpenSceneSwitchResetRuntimeMeasurementsFoundationState(input = {}) {
  const forceNegative = Boolean(input.forceNegative);

  try {
    const previousPacket = readJson(PREVIOUS_PHASE07_BLOCKING_BUDGETS_BASELINE_PACKET_PATH);
    const packetExists = fs.existsSync(path.resolve(PACKET_PATH));
    const packet = packetExists ? readJson(PACKET_PATH) : null;

    const perfLiteSource = readText('scripts/perf/perf-lite.mjs');
    const perfBaselineSource = readText('scripts/perf/perf-baseline.mjs');
    const perfRunSource = readText('scripts/ops/perf-run.mjs');
    const perfStateSource = readText('scripts/ops/perf-state.mjs');
    const projectCommandsSource = readText('src/renderer/commands/projectCommands.mjs');
    const runtimeBridgeSource = readText('src/renderer/tiptap/runtimeBridge.js');
    const perfLiteBaselineText = readText('docs/OPS/PERF/PERF_LITE_BASELINE.json');

    const previousPhase07BlockingBudgetsBaselinePass = Boolean(previousPacket)
      && previousPacket?.artifactId === 'PHASE07_STARTUP_PROJECT_OPEN_SCENE_SWITCH_RESET_BLOCKING_BUDGETS_BASELINE_V1'
      && previousPacket?.schemaVersion === 1
      && previousPacket?.phaseId === 'PHASE_07'
      && previousPacket?.status === 'PASS'
      && previousPacket?.phase07BlockingBudgetsBaselineStatus === 'PASS'
      && previousPacket?.phase07ReleaseReadinessStatus === 'HOLD'
      && arraysEqual(previousPacket?.phase07BlockingBudgetIds || [], EXPECTED_BLOCKING_BUDGET_IDS)
      && arraysEqual(previousPacket?.phase07PendingGapIds || [], [
        'PHASE07_RUNTIME_MEASUREMENTS_PENDING',
        'PHASE07_FULL_RELEASE_HARDENING_NOT_OPENED',
      ])
      && previousPacket?.proof?.phase06DecisionPassTrue === true
      && previousPacket?.proof?.canonPerformanceHardeningDirectionPresentTrue === true
      && previousPacket?.proof?.bibleReleaseHardeningDirectionPresentTrue === true
      && previousPacket?.proof?.contextReleaseHardeningDirectionPresentTrue === true
      && previousPacket?.proof?.executionSequencePerformanceHardeningPresentTrue === true
      && previousPacket?.proof?.blockingBudgetIdsExactTrue === true
      && previousPacket?.proof?.advisoryBudgetIdsExactTrue === true
      && previousPacket?.proof?.sourcePhase06DecisionStateMatchesTrue === true
      && previousPacket?.proof?.baselineOnlyTrue === true
      && previousPacket?.proof?.releaseReadinessHeldTrue === true
      && previousPacket?.proof?.noFalsePhase07GreenTrue === true;

    const perfInfrastructurePresent = PERF_INFRA_FILES.every((relativePath) => fs.existsSync(path.resolve(relativePath)))
      && hasAll(perfLiteSource, ['openP95Ms', 'typeBurstP95Ms', 'saveP95Ms', 'reopenP95Ms'])
      && hasAll(perfBaselineSource, ['openP95Ms', 'typeBurstP95Ms', 'saveP95Ms', 'reopenP95Ms'])
      && hasAll(perfRunSource, ['runCommand(commandIds.PROJECT_OPEN', 'runCommand(commandIds.PROJECT_SAVE', 'openResult', 'saveResult'])
      && hasAll(perfStateSource, ['PERF_BASELINE_OK', 'PERF_RUNNER_DETERMINISTIC_OK', 'PERF_THRESHOLD_OK'])
      && hasAll(projectCommandsSource, ['COMMAND_IDS.PROJECT_OPEN', 'registerProjectCommands'])
      && hasAll(runtimeBridgeSource, ['runTiptapUndo', 'runTiptapRedo', 'createTiptapRuntimeBridge'])
      && hasAll(perfLiteBaselineText, ['openP95Ms', 'typeBurstP95Ms', 'saveP95Ms', 'reopenP95Ms']);

    const projectOpenMeasurementBound = perfInfrastructurePresent
      && hasAll(perfLiteSource, ['openP95Ms'])
      && hasAll(perfBaselineSource, ['openP95Ms'])
      && hasAll(perfRunSource, ['runCommand(commandIds.PROJECT_OPEN', 'openResult = await runCommand(commandIds.PROJECT_OPEN'])
      && hasAll(perfStateSource, ['PERF_BASELINE_OK'])
      && hasAll(projectCommandsSource, ['COMMAND_IDS.PROJECT_OPEN', 'registerProjectCommands'])
      && hasAll(perfLiteBaselineText, ['"openP95Ms"']);

    const startupMeasurementBound = hasAny(perfLiteSource, ['startupP95Ms', 'measureStartup', 'startup measurement', 'startup'])
      || hasAny(perfBaselineSource, ['startupP95Ms', 'measureStartup', 'startup measurement', 'startup'])
      || hasAny(perfRunSource, ['startupP95Ms', 'measureStartup', 'startup measurement', 'startup'])
      || hasAny(perfStateSource, ['startupP95Ms', 'measureStartup', 'startup measurement', 'startup']);

    const sceneSwitchMeasurementBound = hasAny(perfLiteSource, ['sceneSwitchP95Ms', 'measureSceneSwitch', 'scene switch'])
      || hasAny(perfBaselineSource, ['sceneSwitchP95Ms', 'measureSceneSwitch', 'scene switch'])
      || hasAny(perfRunSource, ['sceneSwitchP95Ms', 'measureSceneSwitch', 'scene switch'])
      || hasAny(perfStateSource, ['sceneSwitchP95Ms', 'measureSceneSwitch', 'scene switch']);

    const resetMeasurementBound = hasAny(perfLiteSource, ['resetP95Ms', 'measureReset', 'safe-reset-shell', 'reset measurement'])
      || hasAny(perfBaselineSource, ['resetP95Ms', 'measureReset', 'safe-reset-shell', 'reset measurement'])
      || hasAny(perfRunSource, ['resetP95Ms', 'measureReset', 'safe-reset-shell', 'reset measurement'])
      || hasAny(perfStateSource, ['resetP95Ms', 'measureReset', 'safe-reset-shell', 'reset measurement']);

    const phase07PendingGapIdsHonest = arraysEqual(EXPECTED_PENDING_GAP_IDS, [
      'PHASE07_STARTUP_MEASUREMENT_NOT_BOUND',
      'PHASE07_SCENE_SWITCH_MEASUREMENT_NOT_BOUND',
      'PHASE07_RESET_MEASUREMENT_NOT_BOUND',
    ]) && !startupMeasurementBound && !sceneSwitchMeasurementBound && !resetMeasurementBound;

    const phase07BlockingBudgetIdsExact = arraysEqual(packet?.phase07BlockingBudgetIds || [], EXPECTED_BLOCKING_BUDGET_IDS);
    const phase07PendingGapIdsExact = arraysEqual(packet?.phase07PendingGapIds || [], EXPECTED_PENDING_GAP_IDS);
    const phase07FoundationStatusPass = packet?.phase07RuntimeMeasurementsFoundationStatus === 'PASS';
    const phase07ReadinessStatusHold = packet?.phase07RuntimeMeasurementsReadinessStatus === 'HOLD';
    const packetPass = packet?.status === 'PASS';
    const sourceBaselineMatches = packet?.sourcePhase07BlockingBudgetsBaselineState === 'phase07-startup-project-open-scene-switch-reset-blocking-budgets-baseline-state.mjs';

    const packetInternalConsistency = Boolean(packet)
      && packet?.artifactId === 'PHASE07_STARTUP_PROJECT_OPEN_SCENE_SWITCH_RESET_RUNTIME_MEASUREMENTS_FOUNDATION_V1'
      && packet?.schemaVersion === 1
      && packet?.phaseId === 'PHASE_07'
      && packetPass
      && phase07FoundationStatusPass
      && phase07ReadinessStatusHold
      && sourceBaselineMatches
      && phase07BlockingBudgetIdsExact
      && phase07PendingGapIdsExact
      && perfInfrastructurePresent
      && projectOpenMeasurementBound
      && !startupMeasurementBound
      && !sceneSwitchMeasurementBound
      && !resetMeasurementBound
      && phase07PendingGapIdsHonest
      && packet?.proof?.previousPhase07BlockingBudgetsBaselinePassTrue === true
      && packet?.proof?.perfInfrastructurePresentTrue === true
      && packet?.proof?.projectOpenMeasurementBoundTrue === true
      && packet?.proof?.startupMeasurementBindingOpenGapTrue === true
      && packet?.proof?.sceneSwitchMeasurementBindingOpenGapTrue === true
      && packet?.proof?.resetMeasurementBindingOpenGapTrue === true
      && packet?.proof?.phase07BlockingBudgetIdsExactTrue === true
      && packet?.proof?.phase07PendingGapIdsExactTrue === true
      && packet?.proof?.phase07PendingGapIdsHonestTrue === true
      && packet?.proof?.phase07RuntimeMeasurementsFoundationStatusPassTrue === true
      && packet?.proof?.phase07RuntimeMeasurementsReadinessStatusHoldTrue === true
      && packet?.proof?.noFalsePhase07GreenTrue === true
      && packet?.proof?.packetInternalConsistencyTrue === true
      && previousPhase07BlockingBudgetsBaselinePass;

    const checkStatusById = {
      PREVIOUS_PHASE07_BLOCKING_BUDGETS_BASELINE_PASS: asCheck(
        previousPhase07BlockingBudgetsBaselinePass ? 'GREEN' : 'OPEN_GAP',
        previousPhase07BlockingBudgetsBaselinePass,
        previousPhase07BlockingBudgetsBaselinePass
          ? 'PREVIOUS_PHASE07_BLOCKING_BUDGETS_BASELINE_PASS'
          : 'PREVIOUS_PHASE07_BLOCKING_BUDGETS_BASELINE_NOT_PASS',
      ),
      PERF_INFRASTRUCTURE_PRESENT: asCheck(
        perfInfrastructurePresent ? 'GREEN' : 'OPEN_GAP',
        perfInfrastructurePresent,
        perfInfrastructurePresent ? 'PERF_INFRASTRUCTURE_PRESENT' : 'PERF_INFRASTRUCTURE_MISSING',
      ),
      PROJECT_OPEN_MEASUREMENT_BOUND: asCheck(
        projectOpenMeasurementBound ? 'GREEN' : 'OPEN_GAP',
        projectOpenMeasurementBound,
        projectOpenMeasurementBound ? 'PROJECT_OPEN_MEASUREMENT_BOUND' : 'PROJECT_OPEN_MEASUREMENT_NOT_BOUND',
      ),
      STARTUP_MEASUREMENT_NOT_BOUND: asCheck(
        startupMeasurementBound ? 'OPEN_GAP' : 'OPEN_GAP',
        startupMeasurementBound,
        startupMeasurementBound ? 'STARTUP_MEASUREMENT_BOUND_UNEXPECTED' : 'STARTUP_MEASUREMENT_NOT_BOUND',
      ),
      SCENE_SWITCH_MEASUREMENT_NOT_BOUND: asCheck(
        sceneSwitchMeasurementBound ? 'OPEN_GAP' : 'OPEN_GAP',
        sceneSwitchMeasurementBound,
        sceneSwitchMeasurementBound ? 'SCENE_SWITCH_MEASUREMENT_BOUND_UNEXPECTED' : 'SCENE_SWITCH_MEASUREMENT_NOT_BOUND',
      ),
      RESET_MEASUREMENT_NOT_BOUND: asCheck(
        resetMeasurementBound ? 'OPEN_GAP' : 'OPEN_GAP',
        resetMeasurementBound,
        resetMeasurementBound ? 'RESET_MEASUREMENT_BOUND_UNEXPECTED' : 'RESET_MEASUREMENT_NOT_BOUND',
      ),
      PHASE07_PENDING_GAP_IDS_HONEST: asCheck(
        phase07PendingGapIdsHonest ? 'GREEN' : 'OPEN_GAP',
        phase07PendingGapIdsHonest,
        phase07PendingGapIdsHonest ? 'PHASE07_PENDING_GAP_IDS_HONEST' : 'PHASE07_PENDING_GAP_IDS_NOT_HONEST',
      ),
      PACKET_PRESENT: asCheck(
        packetExists ? 'GREEN' : 'OPEN_GAP',
        packetExists,
        packetExists ? 'PACKET_PRESENT' : 'PACKET_MISSING',
      ),
      PACKET_PASS: asCheck(
        packetPass ? 'GREEN' : 'OPEN_GAP',
        packetPass,
        packetPass ? 'PACKET_PASS' : 'PACKET_NOT_PASS',
      ),
      PACKET_FOUNDATION_STATUS_PASS: asCheck(
        phase07FoundationStatusPass ? 'GREEN' : 'OPEN_GAP',
        phase07FoundationStatusPass,
        phase07FoundationStatusPass ? 'PACKET_FOUNDATION_STATUS_PASS' : 'PACKET_FOUNDATION_STATUS_NOT_PASS',
      ),
      PACKET_READINESS_STATUS_HOLD: asCheck(
        phase07ReadinessStatusHold ? 'GREEN' : 'OPEN_GAP',
        phase07ReadinessStatusHold,
        phase07ReadinessStatusHold ? 'PACKET_READINESS_STATUS_HOLD' : 'PACKET_READINESS_STATUS_NOT_HOLD',
      ),
      PACKET_INTERNAL_CONSISTENCY: asCheck(
        packetInternalConsistency ? 'GREEN' : 'OPEN_GAP',
        packetInternalConsistency,
        packetInternalConsistency ? 'PACKET_INTERNAL_CONSISTENCY' : 'PACKET_INTERNAL_CONSISTENCY_BROKEN',
      ),
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
        phase07RuntimeMeasurementsFoundationStatus: 'HOLD',
        phase07RuntimeMeasurementsReadinessStatus: 'HOLD',
        greenCheckIds,
        openGapIds: Array.from(new Set([...openGapIds, 'FORCED_NEGATIVE_PATH'])),
        checkStatusById,
        phase07PendingGapIds: EXPECTED_PENDING_GAP_IDS,
        phase07BlockingBudgetIds: EXPECTED_BLOCKING_BUDGET_IDS,
      };
    }

    const overallPass = packetInternalConsistency;

    return {
      ok: overallPass,
      failReason: '',
      overallStatus: overallPass ? 'PASS' : 'HOLD',
      phase07RuntimeMeasurementsFoundationStatus: overallPass ? 'PASS' : 'HOLD',
      phase07RuntimeMeasurementsReadinessStatus: phase07ReadinessStatusHold ? 'HOLD' : 'UNKNOWN',
      greenCheckIds,
      openGapIds,
      checkStatusById,
      phase07PendingGapIds: EXPECTED_PENDING_GAP_IDS,
      phase07BlockingBudgetIds: EXPECTED_BLOCKING_BUDGET_IDS,
    };
  } catch (error) {
    return {
      ok: false,
      failReason: FAIL_REASON_UNEXPECTED,
      overallStatus: 'HOLD',
      phase07RuntimeMeasurementsFoundationStatus: 'UNKNOWN',
      phase07RuntimeMeasurementsReadinessStatus: 'UNKNOWN',
      greenCheckIds: [],
      openGapIds: ['PHASE07_STARTUP_PROJECT_OPEN_SCENE_SWITCH_RESET_RUNTIME_MEASUREMENTS_FOUNDATION_EVALUATION_ERROR'],
      checkStatusById: {},
      phase07PendingGapIds: [],
      phase07BlockingBudgetIds: [],
      errorMessage: error && typeof error.message === 'string' ? error.message : 'UNKNOWN',
    };
  }
}

function runCli() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluatePhase07StartupProjectOpenSceneSwitchResetRuntimeMeasurementsFoundationState({
    forceNegative: args.forceNegative,
  });

  if (args.json) {
    console.log(JSON.stringify(state, null, 2));
  } else {
    console.log(`PHASE07_STARTUP_PROJECT_OPEN_SCENE_SWITCH_RESET_RUNTIME_MEASUREMENTS_FOUNDATION_OK=${state.ok ? 1 : 0}`);
    console.log(`PHASE07_STARTUP_PROJECT_OPEN_SCENE_SWITCH_RESET_RUNTIME_MEASUREMENTS_FOUNDATION_OVERALL_STATUS=${state.overallStatus}`);
    console.log(`PHASE07_STARTUP_PROJECT_OPEN_SCENE_SWITCH_RESET_RUNTIME_MEASUREMENTS_FOUNDATION_STATUS=${state.phase07RuntimeMeasurementsFoundationStatus}`);
    console.log(`PHASE07_STARTUP_PROJECT_OPEN_SCENE_SWITCH_RESET_RUNTIME_MEASUREMENTS_FOUNDATION_READINESS_STATUS=${state.phase07RuntimeMeasurementsReadinessStatus}`);
    console.log(`PHASE07_STARTUP_PROJECT_OPEN_SCENE_SWITCH_RESET_RUNTIME_MEASUREMENTS_FOUNDATION_OPEN_GAP_IDS=${state.openGapIds.join(',')}`);
    console.log(`PHASE07_STARTUP_PROJECT_OPEN_SCENE_SWITCH_RESET_RUNTIME_MEASUREMENTS_FOUNDATION_FAIL_REASON=${state.failReason}`);
  }

  process.exit(state.ok ? 0 : 1);
}

const selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(selfPath)) {
  runCli();
}

export { evaluatePhase07StartupProjectOpenSceneSwitchResetRuntimeMeasurementsFoundationState };

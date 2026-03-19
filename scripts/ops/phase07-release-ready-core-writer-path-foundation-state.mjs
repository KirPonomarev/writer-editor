#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const FAIL_REASON_FORCED_NEGATIVE = 'E_PHASE07_RELEASE_READY_CORE_WRITER_PATH_FOUNDATION_FORCED_NEGATIVE';
const FAIL_REASON_UNEXPECTED = 'E_PHASE07_RELEASE_READY_CORE_WRITER_PATH_FOUNDATION_UNEXPECTED';
const PREVIOUS_PACKET_PATH = 'docs/OPS/STATUS/PHASE07_STARTUP_PROJECT_OPEN_SCENE_SWITCH_RESET_RUNTIME_MEASUREMENTS_FOUNDATION_V1.json';
const PACKET_PATH = 'docs/OPS/STATUS/PHASE07_RELEASE_READY_CORE_WRITER_PATH_FOUNDATION_V1.json';
const EXECUTION_SEQUENCE_CANON_PATH = 'docs/OPS/STATUS/EXECUTION_SEQUENCE_CANON_v1.json';

const DOC_PATHS = Object.freeze({
  bible: 'docs/BIBLE.md',
  context: 'docs/CONTEXT.md',
});

const EXPECTED_BLOCKING_BUDGET_IDS = Object.freeze([
  'STARTUP',
  'PROJECT_OPEN',
  'SCENE_SWITCH',
  'RESET',
]);

const EXPECTED_PENDING_GAP_IDS = Object.freeze([
  'PHASE07_RELEASE_READY_CORE_WRITER_PATH_NOT_BOUND',
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

function evaluatePhase07ReleaseReadyCoreWriterPathFoundationState(input = {}) {
  const forceNegative = Boolean(input.forceNegative);

  try {
    const previousPacket = readJson(PREVIOUS_PACKET_PATH);
    const packetExists = fs.existsSync(path.resolve(PACKET_PATH));
    const packet = packetExists ? readJson(PACKET_PATH) : null;
    const executionSequenceCanon = readJson(EXECUTION_SEQUENCE_CANON_PATH);
    const bibleText = readText(DOC_PATHS.bible);
    const contextText = readText(DOC_PATHS.context);

    const previousPhase07RuntimeMeasurementsFoundationPass = Boolean(previousPacket)
      && previousPacket?.artifactId === 'PHASE07_STARTUP_PROJECT_OPEN_SCENE_SWITCH_RESET_RUNTIME_MEASUREMENTS_FOUNDATION_V1'
      && previousPacket?.schemaVersion === 1
      && previousPacket?.phaseId === 'PHASE_07'
      && previousPacket?.status === 'PASS'
      && previousPacket?.phase07RuntimeMeasurementsFoundationStatus === 'PASS'
      && previousPacket?.phase07RuntimeMeasurementsReadinessStatus === 'HOLD'
      && arraysEqual(previousPacket?.phase07BlockingBudgetIds || [], EXPECTED_BLOCKING_BUDGET_IDS)
      && Array.isArray(previousPacket?.phase07PendingGapIds)
      && previousPacket.phase07PendingGapIds.length === 0
      && previousPacket?.proof?.previousPhase07BlockingBudgetsBaselinePassTrue === true
      && previousPacket?.proof?.perfInfrastructurePresentTrue === true
      && previousPacket?.proof?.projectOpenMeasurementBoundTrue === true
      && previousPacket?.proof?.startupMeasurementBoundTrue === true
      && previousPacket?.proof?.sceneSwitchMeasurementBoundTrue === true
      && previousPacket?.proof?.resetMeasurementBoundTrue === true
      && previousPacket?.proof?.phase07BlockingBudgetIdsExactTrue === true
      && previousPacket?.proof?.phase07PendingGapIdsExactTrue === true
      && previousPacket?.proof?.phase07PendingGapIdsHonestTrue === true
      && previousPacket?.proof?.phase07RuntimeMeasurementsFoundationStatusPassTrue === true
      && previousPacket?.proof?.phase07RuntimeMeasurementsReadinessStatusHoldTrue === true
      && previousPacket?.proof?.noFalsePhase07GreenTrue === true
      && previousPacket?.proof?.packetInternalConsistencyTrue === true;

    const bibleReleaseHardeningDirectionPresent = bibleText.includes('release hardening');
    const contextReleaseHardeningDirectionPresent = contextText.includes('release hardening');
    const executionSequencePerformanceHardeningPresent = Array.isArray(executionSequenceCanon?.sequence)
      && executionSequenceCanon.sequence.includes('PERFORMANCE_HARDENING');

    const phase07BlockingBudgetIdsExact = arraysEqual(packet?.phase07BlockingBudgetIds || [], EXPECTED_BLOCKING_BUDGET_IDS);
    const phase07PendingGapIdsExact = arraysEqual(packet?.phase07PendingGapIds || [], EXPECTED_PENDING_GAP_IDS);
    const phase07PendingGapIdsHonest = phase07PendingGapIdsExact;
    const packetPass = packet?.status === 'PASS';
    const foundationStatusPass = packet?.phase07ReleaseReadyCoreWriterPathFoundationStatus === 'PASS';
    const phase07ReadinessStatusHold = packet?.phase07ReadinessStatus === 'HOLD';
    const sourceMatches = packet?.sourcePhase07RuntimeMeasurementsFoundationState === 'phase07-startup-project-open-scene-switch-reset-runtime-measurements-foundation-state.mjs';

    const packetInternalConsistency = Boolean(packet)
      && packet?.artifactId === 'PHASE07_RELEASE_READY_CORE_WRITER_PATH_FOUNDATION_V1'
      && packet?.schemaVersion === 1
      && packet?.phaseId === 'PHASE_07'
      && packetPass
      && foundationStatusPass
      && phase07ReadinessStatusHold
      && sourceMatches
      && previousPhase07RuntimeMeasurementsFoundationPass
      && bibleReleaseHardeningDirectionPresent
      && contextReleaseHardeningDirectionPresent
      && executionSequencePerformanceHardeningPresent
      && phase07BlockingBudgetIdsExact
      && phase07PendingGapIdsExact
      && phase07PendingGapIdsHonest
      && packet?.proof?.previousPhase07RuntimeMeasurementsFoundationPassTrue === true
      && packet?.proof?.bibleReleaseHardeningDirectionPresentTrue === true
      && packet?.proof?.contextReleaseHardeningDirectionPresentTrue === true
      && packet?.proof?.executionSequencePerformanceHardeningPresentTrue === true
      && packet?.proof?.phase07BlockingBudgetIdsExactTrue === true
      && packet?.proof?.phase07PendingGapIdsExactTrue === true
      && packet?.proof?.phase07PendingGapIdsHonestTrue === true
      && packet?.proof?.phase07ReleaseReadyCoreWriterPathFoundationStatusPassTrue === true
      && packet?.proof?.phase07ReadinessStatusHoldTrue === true
      && packet?.proof?.noFalsePhase07GreenTrue === true
      && packet?.proof?.packetInternalConsistencyTrue === true;

    const checkStatusById = {
      PREVIOUS_PHASE07_RUNTIME_MEASUREMENTS_FOUNDATION_PASS: asCheck(
        previousPhase07RuntimeMeasurementsFoundationPass ? 'GREEN' : 'OPEN_GAP',
        previousPhase07RuntimeMeasurementsFoundationPass,
        previousPhase07RuntimeMeasurementsFoundationPass
          ? 'PREVIOUS_PHASE07_RUNTIME_MEASUREMENTS_FOUNDATION_PASS'
          : 'PREVIOUS_PHASE07_RUNTIME_MEASUREMENTS_FOUNDATION_NOT_PASS',
      ),
      BIBLE_RELEASE_HARDENING_DIRECTION_PRESENT: asCheck(
        bibleReleaseHardeningDirectionPresent ? 'GREEN' : 'OPEN_GAP',
        true,
        bibleReleaseHardeningDirectionPresent
          ? 'BIBLE_RELEASE_HARDENING_DIRECTION_PRESENT'
          : 'BIBLE_RELEASE_HARDENING_DIRECTION_MISSING',
      ),
      CONTEXT_RELEASE_HARDENING_DIRECTION_PRESENT: asCheck(
        contextReleaseHardeningDirectionPresent ? 'GREEN' : 'OPEN_GAP',
        true,
        contextReleaseHardeningDirectionPresent
          ? 'CONTEXT_RELEASE_HARDENING_DIRECTION_PRESENT'
          : 'CONTEXT_RELEASE_HARDENING_DIRECTION_MISSING',
      ),
      EXECUTION_SEQUENCE_PERFORMANCE_HARDENING_PRESENT: asCheck(
        executionSequencePerformanceHardeningPresent ? 'GREEN' : 'OPEN_GAP',
        true,
        executionSequencePerformanceHardeningPresent
          ? 'EXECUTION_SEQUENCE_PERFORMANCE_HARDENING_PRESENT'
          : 'EXECUTION_SEQUENCE_PERFORMANCE_HARDENING_MISSING',
      ),
      PHASE07_BLOCKING_BUDGET_IDS_EXACT: asCheck(
        phase07BlockingBudgetIdsExact ? 'GREEN' : 'OPEN_GAP',
        true,
        phase07BlockingBudgetIdsExact ? 'PHASE07_BLOCKING_BUDGET_IDS_EXACT' : 'PHASE07_BLOCKING_BUDGET_IDS_DRIFT',
      ),
      PHASE07_PENDING_GAP_IDS_EXACT: asCheck(
        phase07PendingGapIdsExact ? 'GREEN' : 'OPEN_GAP',
        true,
        phase07PendingGapIdsExact ? 'PHASE07_PENDING_GAP_IDS_EXACT' : 'PHASE07_PENDING_GAP_IDS_DRIFT',
      ),
      PHASE07_PENDING_GAP_IDS_HONEST: asCheck(
        phase07PendingGapIdsHonest ? 'GREEN' : 'OPEN_GAP',
        true,
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
        foundationStatusPass ? 'GREEN' : 'OPEN_GAP',
        foundationStatusPass,
        foundationStatusPass ? 'PACKET_FOUNDATION_STATUS_PASS' : 'PACKET_FOUNDATION_STATUS_NOT_PASS',
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
        phase07ReleaseReadyCoreWriterPathFoundationStatus: 'HOLD',
        phase07ReadinessStatus: 'HOLD',
        greenCheckIds,
        openGapIds: Array.from(new Set([...openGapIds, 'FORCED_NEGATIVE_PATH'])),
        checkStatusById,
        phase07BlockingBudgetIds: packet?.phase07BlockingBudgetIds || [],
        phase07PendingGapIds: packet?.phase07PendingGapIds || [],
      };
    }

    const overallPass = openGapIds.length === 0;

    return {
      ok: overallPass,
      failReason: '',
      overallStatus: overallPass ? 'PASS' : 'HOLD',
      phase07ReleaseReadyCoreWriterPathFoundationStatus: overallPass ? 'PASS' : 'HOLD',
      phase07ReadinessStatus: phase07ReadinessStatusHold ? 'HOLD' : 'UNKNOWN',
      greenCheckIds,
      openGapIds,
      checkStatusById,
      phase07BlockingBudgetIds: packet?.phase07BlockingBudgetIds || [],
      phase07PendingGapIds: packet?.phase07PendingGapIds || [],
    };
  } catch (error) {
    return {
      ok: false,
      failReason: FAIL_REASON_UNEXPECTED,
      overallStatus: 'HOLD',
      phase07ReleaseReadyCoreWriterPathFoundationStatus: 'UNKNOWN',
      phase07ReadinessStatus: 'UNKNOWN',
      greenCheckIds: [],
      openGapIds: ['PHASE07_RELEASE_READY_CORE_WRITER_PATH_FOUNDATION_EVALUATION_ERROR'],
      checkStatusById: {},
      phase07BlockingBudgetIds: [],
      phase07PendingGapIds: [],
      errorMessage: error && typeof error.message === 'string' ? error.message : 'UNKNOWN',
    };
  }
}

function runCli() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluatePhase07ReleaseReadyCoreWriterPathFoundationState({ forceNegative: args.forceNegative });

  if (args.json) {
    console.log(JSON.stringify(state, null, 2));
  } else {
    console.log(`PHASE07_RELEASE_READY_CORE_WRITER_PATH_FOUNDATION_OK=${state.ok ? 1 : 0}`);
    console.log(`PHASE07_RELEASE_READY_CORE_WRITER_PATH_FOUNDATION_OVERALL_STATUS=${state.overallStatus}`);
    console.log(`PHASE07_RELEASE_READY_CORE_WRITER_PATH_FOUNDATION_STATUS=${state.phase07ReleaseReadyCoreWriterPathFoundationStatus}`);
    console.log(`PHASE07_RELEASE_READY_CORE_WRITER_PATH_FOUNDATION_READINESS_STATUS=${state.phase07ReadinessStatus}`);
    console.log(`PHASE07_RELEASE_READY_CORE_WRITER_PATH_FOUNDATION_OPEN_GAP_IDS=${state.openGapIds.join(',')}`);
    console.log(`PHASE07_RELEASE_READY_CORE_WRITER_PATH_FOUNDATION_FAIL_REASON=${state.failReason}`);
  }

  process.exit(state.ok && !args.forceNegative ? 0 : 1);
}

if (import.meta.url === new URL(`file:${process.argv[1]}`).href) {
  runCli();
}

export {
  evaluatePhase07ReleaseReadyCoreWriterPathFoundationState,
};

#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const FAIL_REASON_FORCED_NEGATIVE = 'E_Y7_FOUNDATION_STATE_AND_PROOF_REGEN_FORCED_NEGATIVE';
const FAIL_REASON_UNEXPECTED = 'E_Y7_FOUNDATION_STATE_AND_PROOF_REGEN_UNEXPECTED';

const SCRIPT_SET = Object.freeze({
  phase03ProjectWorkspace: 'scripts/ops/phase03-project-workspace-state-foundation-state.mjs',
  phase03SafeResetLastStable: 'scripts/ops/phase03-safe-reset-last-stable-foundation-state.mjs',
  phase03TerminologyMigration: 'scripts/ops/phase03-terminology-migration-foundation-state.mjs',
  phase03UserShellState: 'scripts/ops/phase03-user-shell-state-foundation-state.mjs',
  phase07ReleaseReadyCoreWriterPath: 'scripts/ops/phase07-release-ready-core-writer-path-foundation-state.mjs',
  phase07StartupRuntimeMeasurements: 'scripts/ops/phase07-startup-project-open-scene-switch-reset-runtime-measurements-foundation-state.mjs',
});

const PACKET_SET = Object.freeze({
  phase03ProjectWorkspace: 'docs/OPS/STATUS/PHASE03_PROJECT_WORKSPACE_STATE_FOUNDATION_V1.json',
  phase03SafeResetLastStable: 'docs/OPS/STATUS/PHASE03_SAFE_RESET_LAST_STABLE_FOUNDATION_V1.json',
  phase03TerminologyMigration: 'docs/OPS/STATUS/PHASE03_TERMINOLOGY_MIGRATION_FOUNDATION_V1.json',
  phase03UserShellState: 'docs/OPS/STATUS/PHASE03_USER_SHELL_STATE_FOUNDATION_V1.json',
  phase07ReleaseReadyCoreWriterPath: 'docs/OPS/STATUS/PHASE07_RELEASE_READY_CORE_WRITER_PATH_FOUNDATION_V1.json',
  phase07StartupRuntimeMeasurements: 'docs/OPS/STATUS/PHASE07_STARTUP_PROJECT_OPEN_SCENE_SWITCH_RESET_RUNTIME_MEASUREMENTS_FOUNDATION_V1.json',
});

const EXPECTED_PENDING_GAP_IDS = Object.freeze({
  phase03ProjectWorkspace: ['PROJECT_WORKSPACE_STATE_ARTIFACT_NOT_BOUND'],
  phase03SafeResetLastStable: ['SAFE_RESET_LAST_STABLE_ARTIFACT_NOT_BOUND'],
  phase03TerminologyMigration: ['TERMINOLOGY_MIGRATION_ARTIFACT_NOT_BOUND'],
  phase03UserShellState: [],
  phase07ReleaseReadyCoreWriterPath: ['PHASE07_RELEASE_READY_CORE_WRITER_PATH_NOT_BOUND'],
  phase07StartupRuntimeMeasurements: ['PHASE07_SCENE_SWITCH_MEASUREMENT_NOT_BOUND', 'PHASE07_RESET_MEASUREMENT_NOT_BOUND'],
});

function parseArgs(argv) {
  const out = { json: false, forceNegative: false };
  for (const token of argv) {
    if (token === '--json') out.json = true;
    if (token === '--force-negative') out.forceNegative = true;
  }
  return out;
}

function asCheck(status, measured, note) {
  return { status, measured, note };
}

function arraysEqual(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

function runJsonStateScript(relativePath) {
  const result = spawnSync(process.execPath, [relativePath, '--json'], {
    encoding: 'utf8',
  });
  let payload = null;
  try {
    payload = JSON.parse(String(result.stdout || '{}'));
  } catch {
    payload = null;
  }
  return {
    status: typeof result.status === 'number' ? result.status : 1,
    payload,
  };
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.resolve(relativePath), 'utf8'));
}

function evaluateY7FoundationStateAndProofRegen(input = {}) {
  const forceNegative = Boolean(input.forceNegative);

  try {
    const states = Object.fromEntries(
      Object.entries(SCRIPT_SET).map(([id, scriptPath]) => [id, runJsonStateScript(scriptPath)]),
    );
    const packets = Object.fromEntries(
      Object.entries(PACKET_SET).map(([id, packetPath]) => [id, readJson(packetPath)]),
    );

    const scriptsPass = Object.values(states).every((entry) => entry.status === 0 && entry.payload && entry.payload.ok === true);
    const phase03StatusesHonest = states.phase03ProjectWorkspace.payload?.foundationStatus === 'HOLD'
      && states.phase03SafeResetLastStable.payload?.foundationStatus === 'HOLD'
      && states.phase03TerminologyMigration.payload?.foundationStatus === 'HOLD'
      && states.phase03UserShellState.payload?.foundationStatus === 'PASS';
    const phase07StatusesHonest = states.phase07ReleaseReadyCoreWriterPath.payload?.phase07ReadinessStatus === 'HOLD'
      && states.phase07StartupRuntimeMeasurements.payload?.phase07RuntimeMeasurementsReadinessStatus === 'HOLD';

    const statePendingGapsMatch = arraysEqual(states.phase03ProjectWorkspace.payload?.pendingFoundationGapIds || [], EXPECTED_PENDING_GAP_IDS.phase03ProjectWorkspace)
      && arraysEqual(states.phase03SafeResetLastStable.payload?.pendingFoundationGapIds || [], EXPECTED_PENDING_GAP_IDS.phase03SafeResetLastStable)
      && arraysEqual(states.phase03TerminologyMigration.payload?.pendingFoundationGapIds || [], EXPECTED_PENDING_GAP_IDS.phase03TerminologyMigration)
      && arraysEqual(states.phase03UserShellState.payload?.remainingPhase03GapIds || [], EXPECTED_PENDING_GAP_IDS.phase03UserShellState)
      && arraysEqual(states.phase07ReleaseReadyCoreWriterPath.payload?.phase07PendingGapIds || [], EXPECTED_PENDING_GAP_IDS.phase07ReleaseReadyCoreWriterPath)
      && arraysEqual(states.phase07StartupRuntimeMeasurements.payload?.phase07PendingGapIds || [], EXPECTED_PENDING_GAP_IDS.phase07StartupRuntimeMeasurements);

    const packetStatusAligned = packets.phase03ProjectWorkspace.status === 'PASS'
      && packets.phase03ProjectWorkspace.foundationStatus === states.phase03ProjectWorkspace.payload?.foundationStatus
      && packets.phase03SafeResetLastStable.status === 'PASS'
      && packets.phase03SafeResetLastStable.foundationStatus === states.phase03SafeResetLastStable.payload?.foundationStatus
      && packets.phase03TerminologyMigration.status === 'PASS'
      && packets.phase03TerminologyMigration.foundationStatus === states.phase03TerminologyMigration.payload?.foundationStatus
      && packets.phase03UserShellState.status === 'PASS'
      && packets.phase03UserShellState.foundationStatus === states.phase03UserShellState.payload?.foundationStatus
      && packets.phase07ReleaseReadyCoreWriterPath.status === 'PASS'
      && packets.phase07ReleaseReadyCoreWriterPath.phase07ReleaseReadyCoreWriterPathFoundationStatus === states.phase07ReleaseReadyCoreWriterPath.payload?.phase07ReleaseReadyCoreWriterPathFoundationStatus
      && packets.phase07ReleaseReadyCoreWriterPath.phase07ReadinessStatus === states.phase07ReleaseReadyCoreWriterPath.payload?.phase07ReadinessStatus
      && packets.phase07StartupRuntimeMeasurements.status === 'PASS'
      && packets.phase07StartupRuntimeMeasurements.phase07RuntimeMeasurementsFoundationStatus === states.phase07StartupRuntimeMeasurements.payload?.phase07RuntimeMeasurementsFoundationStatus
      && packets.phase07StartupRuntimeMeasurements.phase07RuntimeMeasurementsReadinessStatus === states.phase07StartupRuntimeMeasurements.payload?.phase07RuntimeMeasurementsReadinessStatus;

    const packetPendingGapsMatch = arraysEqual(packets.phase03ProjectWorkspace.pendingFoundationGapIds || [], EXPECTED_PENDING_GAP_IDS.phase03ProjectWorkspace)
      && arraysEqual(packets.phase03SafeResetLastStable.pendingFoundationGapIds || [], EXPECTED_PENDING_GAP_IDS.phase03SafeResetLastStable)
      && arraysEqual(packets.phase03TerminologyMigration.pendingFoundationGapIds || [], EXPECTED_PENDING_GAP_IDS.phase03TerminologyMigration)
      && arraysEqual(packets.phase03UserShellState.remainingPhase03GapIds || [], EXPECTED_PENDING_GAP_IDS.phase03UserShellState)
      && arraysEqual(packets.phase07ReleaseReadyCoreWriterPath.phase07PendingGapIds || [], EXPECTED_PENDING_GAP_IDS.phase07ReleaseReadyCoreWriterPath)
      && arraysEqual(packets.phase07StartupRuntimeMeasurements.phase07PendingGapIds || [], EXPECTED_PENDING_GAP_IDS.phase07StartupRuntimeMeasurements);

    const checkStatusById = {
      FOUNDATION_STATE_SCRIPTS_PASS: asCheck(
        scriptsPass ? 'GREEN' : 'OPEN_GAP',
        scriptsPass,
        scriptsPass ? 'FOUNDATION_STATE_SCRIPTS_PASS' : 'FOUNDATION_STATE_SCRIPTS_FAIL',
      ),
      PHASE03_PASS_HOLD_PROFILE_HONEST: asCheck(
        phase03StatusesHonest ? 'GREEN' : 'OPEN_GAP',
        phase03StatusesHonest,
        phase03StatusesHonest ? 'PHASE03_PASS_HOLD_PROFILE_HONEST' : 'PHASE03_PASS_HOLD_PROFILE_DRIFT',
      ),
      PHASE07_HOLD_PROFILE_HONEST: asCheck(
        phase07StatusesHonest ? 'GREEN' : 'OPEN_GAP',
        phase07StatusesHonest,
        phase07StatusesHonest ? 'PHASE07_HOLD_PROFILE_HONEST' : 'PHASE07_HOLD_PROFILE_DRIFT',
      ),
      STATE_PENDING_GAP_IDS_MATCH: asCheck(
        statePendingGapsMatch ? 'GREEN' : 'OPEN_GAP',
        statePendingGapsMatch,
        statePendingGapsMatch ? 'STATE_PENDING_GAP_IDS_MATCH' : 'STATE_PENDING_GAP_IDS_DRIFT',
      ),
      PACKET_STATUS_ALIGNED_WITH_STATE: asCheck(
        packetStatusAligned ? 'GREEN' : 'OPEN_GAP',
        packetStatusAligned,
        packetStatusAligned ? 'PACKET_STATUS_ALIGNED_WITH_STATE' : 'PACKET_STATUS_STATE_DRIFT',
      ),
      PACKET_PENDING_GAP_IDS_MATCH: asCheck(
        packetPendingGapsMatch ? 'GREEN' : 'OPEN_GAP',
        packetPendingGapsMatch,
        packetPendingGapsMatch ? 'PACKET_PENDING_GAP_IDS_MATCH' : 'PACKET_PENDING_GAP_IDS_DRIFT',
      ),
      NO_FALSE_GREEN_PROMOTION: asCheck(
        phase03StatusesHonest && phase07StatusesHonest && statePendingGapsMatch && packetPendingGapsMatch
          ? 'GREEN'
          : 'OPEN_GAP',
        true,
        phase03StatusesHonest && phase07StatusesHonest && statePendingGapsMatch && packetPendingGapsMatch
          ? 'NO_FALSE_GREEN_PROMOTION'
          : 'FALSE_GREEN_PROMOTION_RISK',
      ),
    };

    const greenCheckIds = Object.entries(checkStatusById).filter(([, value]) => value.status === 'GREEN').map(([id]) => id);
    const openGapIds = Object.entries(checkStatusById).filter(([, value]) => value.status !== 'GREEN').map(([id]) => id);
    const overallPass = openGapIds.length === 0;

    if (forceNegative) {
      return {
        ok: false,
        failReason: FAIL_REASON_FORCED_NEGATIVE,
        overallStatus: 'HOLD',
        y7FoundationRegenStatus: 'HOLD',
        y7ReadinessStatus: 'HOLD',
        greenCheckIds,
        openGapIds: Array.from(new Set([...openGapIds, 'FORCED_NEGATIVE_PATH'])),
        checkStatusById,
      };
    }

    return {
      ok: overallPass,
      failReason: '',
      overallStatus: overallPass ? 'PASS' : 'HOLD',
      y7FoundationRegenStatus: overallPass ? 'PASS' : 'HOLD',
      y7ReadinessStatus: 'HOLD',
      greenCheckIds,
      openGapIds,
      checkStatusById,
      summary: {
        phase03ProjectWorkspaceFoundationStatus: states.phase03ProjectWorkspace.payload?.foundationStatus || 'UNKNOWN',
        phase03SafeResetLastStableFoundationStatus: states.phase03SafeResetLastStable.payload?.foundationStatus || 'UNKNOWN',
        phase03TerminologyMigrationFoundationStatus: states.phase03TerminologyMigration.payload?.foundationStatus || 'UNKNOWN',
        phase03UserShellStateFoundationStatus: states.phase03UserShellState.payload?.foundationStatus || 'UNKNOWN',
        phase07ReleaseReadyCoreWriterPathFoundationStatus: states.phase07ReleaseReadyCoreWriterPath.payload?.phase07ReleaseReadyCoreWriterPathFoundationStatus || 'UNKNOWN',
        phase07ReleaseReadyReadinessStatus: states.phase07ReleaseReadyCoreWriterPath.payload?.phase07ReadinessStatus || 'UNKNOWN',
        phase07RuntimeMeasurementsFoundationStatus: states.phase07StartupRuntimeMeasurements.payload?.phase07RuntimeMeasurementsFoundationStatus || 'UNKNOWN',
        phase07RuntimeMeasurementsReadinessStatus: states.phase07StartupRuntimeMeasurements.payload?.phase07RuntimeMeasurementsReadinessStatus || 'UNKNOWN',
      },
      phase03PendingGapIds: {
        projectWorkspace: states.phase03ProjectWorkspace.payload?.pendingFoundationGapIds || [],
        safeResetLastStable: states.phase03SafeResetLastStable.payload?.pendingFoundationGapIds || [],
        terminologyMigration: states.phase03TerminologyMigration.payload?.pendingFoundationGapIds || [],
        userShellState: states.phase03UserShellState.payload?.remainingPhase03GapIds || [],
      },
      phase07PendingGapIds: {
        releaseReadyCoreWriterPath: states.phase07ReleaseReadyCoreWriterPath.payload?.phase07PendingGapIds || [],
        startupRuntimeMeasurements: states.phase07StartupRuntimeMeasurements.payload?.phase07PendingGapIds || [],
      },
    };
  } catch (error) {
    return {
      ok: false,
      failReason: FAIL_REASON_UNEXPECTED,
      overallStatus: 'HOLD',
      y7FoundationRegenStatus: 'UNKNOWN',
      y7ReadinessStatus: 'UNKNOWN',
      greenCheckIds: [],
      openGapIds: ['Y7_FOUNDATION_STATE_AND_PROOF_REGEN_EVALUATION_ERROR'],
      checkStatusById: {},
      errorMessage: error && typeof error.message === 'string' ? error.message : 'UNKNOWN',
    };
  }
}

function runCli() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluateY7FoundationStateAndProofRegen({ forceNegative: args.forceNegative });

  if (args.json) {
    console.log(JSON.stringify(state, null, 2));
  } else {
    console.log(`Y7_FOUNDATION_STATE_AND_PROOF_REGEN_OK=${state.ok ? 1 : 0}`);
    console.log(`Y7_FOUNDATION_STATE_AND_PROOF_REGEN_OVERALL_STATUS=${state.overallStatus}`);
    console.log(`Y7_FOUNDATION_STATE_AND_PROOF_REGEN_STATUS=${state.y7FoundationRegenStatus}`);
    console.log(`Y7_FOUNDATION_STATE_AND_PROOF_REGEN_READINESS_STATUS=${state.y7ReadinessStatus}`);
    console.log(`Y7_FOUNDATION_STATE_AND_PROOF_REGEN_OPEN_GAP_IDS=${state.openGapIds.join(',')}`);
    console.log(`Y7_FOUNDATION_STATE_AND_PROOF_REGEN_FAIL_REASON=${state.failReason}`);
  }

  process.exit(state.ok && !args.forceNegative ? 0 : 1);
}

if (import.meta.url === new URL(`file:${process.argv[1]}`).href) {
  runCli();
}

export { evaluateY7FoundationStateAndProofRegen };

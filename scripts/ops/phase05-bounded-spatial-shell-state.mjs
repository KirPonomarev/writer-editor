#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { evaluatePhase05MovableSideContainersBaselineState } from './phase05-movable-side-containers-baseline-state.mjs';
import { evaluatePhase05LayoutRecoveryLastStableBaselineState } from './phase05-layout-recovery-last-stable-baseline-state.mjs';
import { evaluatePhase05InvalidLayoutAndMissingMonitorRecoveryBaselineState } from './phase05-invalid-layout-and-missing-monitor-recovery-baseline-state.mjs';

const FAIL_REASON_FORCED_NEGATIVE = 'E_PHASE05_BOUNDED_SPATIAL_SHELL_FORCED_NEGATIVE';
const FAIL_REASON_UNEXPECTED = 'E_PHASE05_BOUNDED_SPATIAL_SHELL_UNEXPECTED';
const PACKET_PATH = 'docs/OPS/STATUS/PHASE05_BOUNDED_SPATIAL_SHELL_PACKET_V1.json';
const SOURCE_PHASE05_INVALID_LAYOUT_AND_MISSING_MONITOR_RECOVERY_BASELINE = 'phase05-invalid-layout-and-missing-monitor-recovery-baseline-state.mjs';

const EXPECTED_BOUND_SIGNAL_IDS = Object.freeze([
  'PHASE05_MOVABLE_SIDE_CONTAINERS_BASELINE_PASS',
  'PHASE05_LAYOUT_RECOVERY_LAST_STABLE_BASELINE_PASS',
  'PHASE05_INVALID_LAYOUT_AND_MISSING_MONITOR_RECOVERY_BASELINE_PASS',
]);

const EXPECTED_LOCKED_TARGET_IDS = Object.freeze([
  'BOUNDED_SPATIAL_SHELL',
  'MOVABLE_SIDE_CONTAINERS',
  'SAFE_RESTORE_AND_LAYOUT_RECOVERY',
  'INVALID_LAYOUT_AND_MISSING_MONITOR_RECOVERY',
  'PROJECT_SCOPED_SPATIAL_LAYOUT_SNAPSHOTS',
  'EDITOR_ROOT_FIXED_DOCKED',
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

function isPassHoldContour(state) {
  return state?.overallStatus === 'PASS' && state?.phase05ReadinessStatus === 'HOLD';
}

function evaluatePhase05BoundedSpatialShellState(input = {}) {
  const forceNegative = Boolean(input.forceNegative);

  try {
    const movableState = evaluatePhase05MovableSideContainersBaselineState({});
    const layoutRecoveryState = evaluatePhase05LayoutRecoveryLastStableBaselineState({});
    const invalidRecoveryState = evaluatePhase05InvalidLayoutAndMissingMonitorRecoveryBaselineState({});
    const packetExists = fs.existsSync(path.resolve(PACKET_PATH));
    const packet = packetExists ? readJson(PACKET_PATH) : null;

    const movableContourPass = isPassHoldContour(movableState);
    const layoutRecoveryContourPass = isPassHoldContour(layoutRecoveryState);
    const invalidRecoveryContourPass = isPassHoldContour(invalidRecoveryState);

    const packetPass = packet?.status === 'PASS';
    const packetReady = packet?.phase05ReadinessStatus === 'PASS';
    const sourceChainMatches = packet?.sourcePhase05InvalidLayoutAndMissingMonitorRecoveryBaseline === SOURCE_PHASE05_INVALID_LAYOUT_AND_MISSING_MONITOR_RECOVERY_BASELINE;
    const boundSignalIdsMatch = arraysEqual(packet?.boundSignalIds || [], EXPECTED_BOUND_SIGNAL_IDS);
    const lockedTargetIdsMatch = arraysEqual(packet?.lockedTargetIds || [], EXPECTED_LOCKED_TARGET_IDS);
    const pendingGapIdsCleared = Array.isArray(packet?.phase05PendingGapIds) && packet.phase05PendingGapIds.length === 0;
    const packetInternalConsistency = Boolean(packet)
      && packet?.artifactId === 'PHASE05_BOUNDED_SPATIAL_SHELL_PACKET_V1'
      && packet?.schemaVersion === 1
      && packet?.phaseId === 'PHASE_05'
      && packetPass
      && packetReady
      && sourceChainMatches
      && boundSignalIdsMatch
      && lockedTargetIdsMatch
      && pendingGapIdsCleared
      && packet?.proof?.phase05MovableSideContainersBaselinePassTrue === true
      && packet?.proof?.phase05LayoutRecoveryLastStableBaselinePassTrue === true
      && packet?.proof?.phase05InvalidLayoutAndMissingMonitorRecoveryBaselinePassTrue === true
      && packet?.proof?.sourcePhase05InvalidLayoutAndMissingMonitorRecoveryBaselineTrue === true
      && packet?.proof?.boundSignalIdsAlignedTrue === true
      && packet?.proof?.lockedTargetIdsAlignedTrue === true
      && packet?.proof?.phase05PendingGapIdsClearedTrue === true
      && packet?.proof?.noFalsePhase05GreenTrue === true;

    const checkStatusById = {
      PHASE05_MOVABLE_SIDE_CONTAINERS_BASELINE_PASS: asCheck(movableContourPass ? 'GREEN' : 'OPEN_GAP', true, movableContourPass ? 'PHASE05_MOVABLE_SIDE_CONTAINERS_BASELINE_PASS' : 'PHASE05_MOVABLE_SIDE_CONTAINERS_BASELINE_NOT_PASS'),
      PHASE05_LAYOUT_RECOVERY_LAST_STABLE_BASELINE_PASS: asCheck(layoutRecoveryContourPass ? 'GREEN' : 'OPEN_GAP', true, layoutRecoveryContourPass ? 'PHASE05_LAYOUT_RECOVERY_LAST_STABLE_BASELINE_PASS' : 'PHASE05_LAYOUT_RECOVERY_LAST_STABLE_BASELINE_NOT_PASS'),
      PHASE05_INVALID_LAYOUT_AND_MISSING_MONITOR_RECOVERY_BASELINE_PASS: asCheck(invalidRecoveryContourPass ? 'GREEN' : 'OPEN_GAP', true, invalidRecoveryContourPass ? 'PHASE05_INVALID_LAYOUT_AND_MISSING_MONITOR_RECOVERY_BASELINE_PASS' : 'PHASE05_INVALID_LAYOUT_AND_MISSING_MONITOR_RECOVERY_BASELINE_NOT_PASS'),
      PACKET_PRESENT: asCheck(packetExists ? 'GREEN' : 'OPEN_GAP', true, packetExists ? 'PACKET_PRESENT' : 'PACKET_MISSING'),
      PACKET_PASS: asCheck(packetPass ? 'GREEN' : 'OPEN_GAP', true, packetPass ? 'PACKET_PASS' : 'PACKET_NOT_PASS'),
      PACKET_READY: asCheck(packetReady ? 'GREEN' : 'OPEN_GAP', true, packetReady ? 'PACKET_READY' : 'PACKET_NOT_READY'),
      SOURCE_CHAIN_MATCHES: asCheck(sourceChainMatches ? 'GREEN' : 'OPEN_GAP', true, sourceChainMatches ? 'SOURCE_CHAIN_MATCHES' : 'SOURCE_CHAIN_DRIFT'),
      BOUND_SIGNAL_IDS_MATCH: asCheck(boundSignalIdsMatch ? 'GREEN' : 'OPEN_GAP', true, boundSignalIdsMatch ? 'BOUND_SIGNAL_IDS_MATCH' : 'BOUND_SIGNAL_IDS_DRIFT'),
      LOCKED_TARGET_IDS_MATCH: asCheck(lockedTargetIdsMatch ? 'GREEN' : 'OPEN_GAP', true, lockedTargetIdsMatch ? 'LOCKED_TARGET_IDS_MATCH' : 'LOCKED_TARGET_IDS_DRIFT'),
      PENDING_GAP_IDS_CLEARED: asCheck(pendingGapIdsCleared ? 'GREEN' : 'OPEN_GAP', true, pendingGapIdsCleared ? 'PENDING_GAP_IDS_CLEARED' : 'PENDING_GAP_IDS_DRIFT'),
      PACKET_INTERNAL_CONSISTENCY: asCheck(packetInternalConsistency ? 'GREEN' : 'OPEN_GAP', true, packetInternalConsistency ? 'PACKET_INTERNAL_CONSISTENCY' : 'PACKET_INTERNAL_CONSISTENCY_BROKEN'),
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
        phase05ReadinessStatus: 'HOLD',
        greenCheckIds,
        openGapIds: Array.from(new Set([...openGapIds, 'FORCED_NEGATIVE_PATH'])),
        checkStatusById,
        phase05PendingGapIds: packet?.phase05PendingGapIds || [],
        boundSignalIds: packet?.boundSignalIds || [],
        lockedTargetIds: packet?.lockedTargetIds || [],
      };
    }

    const overallPass = openGapIds.length === 0;

    return {
      ok: overallPass,
      failReason: '',
      overallStatus: overallPass ? 'PASS' : 'HOLD',
      phase05ReadinessStatus: overallPass ? 'PASS' : 'HOLD',
      greenCheckIds,
      openGapIds,
      checkStatusById,
      phase05PendingGapIds: packet?.phase05PendingGapIds || [],
      boundSignalIds: packet?.boundSignalIds || [],
      lockedTargetIds: packet?.lockedTargetIds || [],
    };
  } catch (error) {
    return {
      ok: false,
      failReason: FAIL_REASON_UNEXPECTED,
      overallStatus: 'HOLD',
      phase05ReadinessStatus: 'UNKNOWN',
      greenCheckIds: [],
      openGapIds: ['PHASE05_BOUNDED_SPATIAL_SHELL_EVALUATION_ERROR'],
      checkStatusById: {},
      phase05PendingGapIds: [],
      boundSignalIds: [],
      lockedTargetIds: [],
      errorMessage: error && typeof error.message === 'string' ? error.message : 'UNKNOWN',
    };
  }
}

function runCli() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluatePhase05BoundedSpatialShellState({ forceNegative: args.forceNegative });

  if (args.json) {
    console.log(JSON.stringify(state, null, 2));
  } else {
    console.log(`PHASE05_BOUNDED_SPATIAL_SHELL_OK=${state.ok ? 1 : 0}`);
    console.log(`PHASE05_BOUNDED_SPATIAL_SHELL_OVERALL_STATUS=${state.overallStatus}`);
    console.log(`PHASE05_BOUNDED_SPATIAL_SHELL_READINESS_STATUS=${state.phase05ReadinessStatus}`);
    console.log(`PHASE05_BOUNDED_SPATIAL_SHELL_OPEN_GAP_IDS=${state.openGapIds.join(',')}`);
    console.log(`PHASE05_BOUNDED_SPATIAL_SHELL_FAIL_REASON=${state.failReason}`);
  }

  process.exit(state.ok ? 0 : 1);
}

const selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(selfPath)) {
  runCli();
}

export { evaluatePhase05BoundedSpatialShellState };

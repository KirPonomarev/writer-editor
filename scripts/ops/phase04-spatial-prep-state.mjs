#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FAIL_REASON_FORCED_NEGATIVE = 'E_PHASE04_SPATIAL_PREP_FORCED_NEGATIVE';
const FAIL_REASON_UNEXPECTED = 'E_PHASE04_SPATIAL_PREP_UNEXPECTED';
const PACKET_PATH = 'docs/OPS/STATUS/PHASE04_SPATIAL_PREP_PACKET_V1.json';

const EXPECTED_BOUND_SIGNAL_IDS = Object.freeze([
  'PHASE04_BOUNDED_SPATIAL_LAYER_PRESENT',
  'PHASE04_SAFE_SPATIAL_PREP_PASS',
]);
const EXPECTED_LOCKED_TARGET_IDS = Object.freeze([
  'BOUNDED_SPATIAL_LAYER',
  'SAFE_SPATIAL_PREP',
  'CANON_BOUNDED_SPATIAL_LAYER_PRESENT',
  'CONTEXT_BOUNDED_SPATIAL_LAYER_PRESENT',
]);
const EXPECTED_PENDING_GAP_IDS = Object.freeze([
  'CANON_BOUNDED_SPATIAL_LAYER_PRESENT',
  'CONTEXT_BOUNDED_SPATIAL_LAYER_PRESENT',
]);

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function readJsonObject(filePath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function parseArgs(argv = process.argv.slice(2)) {
  const out = {
    json: false,
    forceNegative: false,
  };

  for (const token of argv) {
    const arg = normalizeString(token);
    if (!arg) continue;
    if (arg === '--json') out.json = true;
    if (arg === '--force-negative') out.forceNegative = true;
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

function buildState(base = {}) {
  return {
    ok: false,
    PHASE04_SPATIAL_PREP_OK: 0,
    phase04SpatialPrepOk: false,
    failReason: 'PHASE04_SPATIAL_PREP_NOT_READY',
    overallStatus: 'HOLD',
    phase04ReadinessStatus: 'HOLD',
    greenCheckIds: [],
    openGapIds: [],
    checkStatusById: {},
    phase04PendingGapIds: [],
    boundSignalIds: [],
    lockedTargetIds: [],
    ...base,
  };
}

export function evaluatePhase04SpatialPrepState(input = {}) {
  const forceNegative = Boolean(input.forceNegative);
  const packetPath = normalizeString(input.packetPath || process.env.PHASE04_SPATIAL_PREP_PACKET_PATH || PACKET_PATH);

  try {
    const packet = readJsonObject(packetPath);
    const packetPresent = Boolean(packet);
    const packetPass = packetPresent && packet.status === 'PASS';
    const packetReady = packetPresent && packet.phase04ReadinessStatus === 'HOLD';
    const packetMatches =
      packetPass
      && packetReady
      && packet.artifactId === 'PHASE04_SPATIAL_PREP_PACKET_V1'
      && packet.phaseId === 'PHASE_04'
      && arraysEqual(packet.boundSignalIds || [], EXPECTED_BOUND_SIGNAL_IDS)
      && arraysEqual(packet.lockedTargetIds || [], EXPECTED_LOCKED_TARGET_IDS)
      && arraysEqual(packet.phase04PendingGapIds || [], EXPECTED_PENDING_GAP_IDS)
      && packet.proof?.boundedSpatialLayerPresentTrue === true
      && packet.proof?.canonBoundedSpatialLayerPresentTrue === false
      && packet.proof?.contextBoundedSpatialLayerPresentTrue === false
      && packet.proof?.phase04PendingGapIdsClearedTrue === false
      && packet.proof?.noFalsePhase04GreenTrue === true;

    const checkStatusById = {
      PACKET_PRESENT: asCheck(packetPresent ? 'GREEN' : 'OPEN_GAP', true, packetPresent ? 'PACKET_PRESENT' : 'PACKET_MISSING'),
      PACKET_PASS: asCheck(packetPass ? 'GREEN' : 'OPEN_GAP', true, packetPass ? 'PACKET_PASS' : 'PACKET_NOT_PASS'),
      PACKET_READY: asCheck(packetReady ? 'GREEN' : 'OPEN_GAP', true, packetReady ? 'PACKET_READY' : 'PACKET_NOT_READY'),
      PACKET_MATCHES: asCheck(packetMatches ? 'GREEN' : 'OPEN_GAP', true, packetMatches ? 'PACKET_MATCHES' : 'PACKET_DRIFT'),
      BOUND_SIGNAL_IDS_MATCH: asCheck(packetMatches ? 'GREEN' : 'OPEN_GAP', true, packetMatches ? 'BOUND_SIGNAL_IDS_MATCH' : 'BOUND_SIGNAL_IDS_DRIFT'),
      LOCKED_TARGET_IDS_MATCH: asCheck(packetMatches ? 'GREEN' : 'OPEN_GAP', true, packetMatches ? 'LOCKED_TARGET_IDS_MATCH' : 'LOCKED_TARGET_IDS_DRIFT'),
      PENDING_GAP_IDS_MATCH: asCheck(packetMatches ? 'GREEN' : 'OPEN_GAP', true, packetMatches ? 'PENDING_GAP_IDS_MATCH' : 'PENDING_GAP_IDS_DRIFT'),
      CANON_BOUNDED_SPATIAL_LAYER_PRESENT: asCheck(false, true, packetMatches ? 'CANON_BOUNDED_SPATIAL_LAYER_PRESENT' : 'CANON_BOUNDED_SPATIAL_LAYER_PRESENT_MISSING'),
      CONTEXT_BOUNDED_SPATIAL_LAYER_PRESENT: asCheck(false, true, packetMatches ? 'CONTEXT_BOUNDED_SPATIAL_LAYER_PRESENT' : 'CONTEXT_BOUNDED_SPATIAL_LAYER_PRESENT_MISSING'),
    };

    const greenCheckIds = Object.entries(checkStatusById)
      .filter(([, value]) => value.status === 'GREEN')
      .map(([key]) => key);
    const openGapIds = Object.entries(checkStatusById)
      .filter(([, value]) => value.status !== 'GREEN')
      .map(([key]) => key);

    if (forceNegative) {
      return buildState({
        ok: false,
        PHASE04_SPATIAL_PREP_OK: 0,
        phase04SpatialPrepOk: false,
        failReason: FAIL_REASON_FORCED_NEGATIVE,
        overallStatus: 'HOLD',
        phase04ReadinessStatus: 'HOLD',
        greenCheckIds,
        openGapIds: Array.from(new Set([...openGapIds, 'FORCED_NEGATIVE_PATH'])),
        checkStatusById,
        phase04PendingGapIds: packet?.phase04PendingGapIds || [],
        boundSignalIds: packet?.boundSignalIds || [],
        lockedTargetIds: packet?.lockedTargetIds || [],
      });
    }

    return buildState({
      ok: false,
      PHASE04_SPATIAL_PREP_OK: 0,
      phase04SpatialPrepOk: false,
      failReason: packetMatches ? 'PHASE04_SPATIAL_PREP_PENDING_GAPS' : 'PHASE04_SPATIAL_PREP_NOT_READY',
      overallStatus: 'HOLD',
      phase04ReadinessStatus: 'HOLD',
      greenCheckIds,
      openGapIds,
      checkStatusById,
      phase04PendingGapIds: packet?.phase04PendingGapIds || [],
      boundSignalIds: packet?.boundSignalIds || [],
      lockedTargetIds: packet?.lockedTargetIds || [],
    });
  } catch (error) {
    return buildState({
      ok: false,
      PHASE04_SPATIAL_PREP_OK: 0,
      phase04SpatialPrepOk: false,
      failReason: FAIL_REASON_UNEXPECTED,
      overallStatus: 'HOLD',
      phase04ReadinessStatus: 'UNKNOWN',
      greenCheckIds: [],
      openGapIds: ['PHASE04_SPATIAL_PREP_EVALUATION_ERROR'],
      checkStatusById: {},
      errorMessage: error && typeof error.message === 'string' ? error.message : 'UNKNOWN',
    });
  }
}

function runCli() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluatePhase04SpatialPrepState({ forceNegative: args.forceNegative });

  if (args.json) {
    console.log(JSON.stringify(state, null, 2));
  } else {
    console.log(`PHASE04_SPATIAL_PREP_OK=${state.PHASE04_SPATIAL_PREP_OK}`);
    console.log(`PHASE04_SPATIAL_PREP_OVERALL_STATUS=${state.overallStatus}`);
    console.log(`PHASE04_SPATIAL_PREP_READINESS_STATUS=${state.phase04ReadinessStatus}`);
    console.log(`PHASE04_SPATIAL_PREP_OPEN_GAP_IDS=${state.openGapIds.join(',')}`);
    console.log(`PHASE04_SPATIAL_PREP_FAIL_REASON=${state.failReason}`);
  }

  process.exit(state.ok ? 0 : 1);
}

const selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(selfPath)) {
  runCli();
}

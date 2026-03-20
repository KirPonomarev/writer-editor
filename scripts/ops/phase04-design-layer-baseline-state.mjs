#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { evaluatePhase03BaselineDockedShellState } from './phase03-baseline-docked-shell-state.mjs';

const FAIL_REASON_FORCED_NEGATIVE = 'E_PHASE04_DESIGN_LAYER_BASELINE_FORCED_NEGATIVE';
const FAIL_REASON_UNEXPECTED = 'E_PHASE04_DESIGN_LAYER_BASELINE_UNEXPECTED';
const SUPERSESSION_PACKET_PATH = 'docs/OPS/STATUS/PHASE04_SUPERSESSION_AND_PHASE_MAP_SYNC_PACKET_V1.json';
const DESIGN_PACKET_PATH = 'docs/OPS/STATUS/PHASE04_DESIGN_LAYER_BASELINE_PACKET_V1.json';
const HISTORICAL_PACKET_PATH = 'docs/OPS/STATUS/PHASE04_SPATIAL_PREP_PACKET_V1.json';
const HISTORICAL_STATE_PATH = 'scripts/ops/phase04-spatial-prep-state.mjs';
const CANON_PATH = 'CANON.md';
const BIBLE_PATH = 'docs/BIBLE.md';
const XPLAT_PATH = 'docs/OPS/STATUS/XPLAT_UNIFIED_MASTER_EXECUTION_CONTRACT_v3.13a-final.md';

const EXPECTED_BINDING_ORDER = Object.freeze([
  'LOGICAL_ARTIFACT_ID',
  'ACTIVE_PACKET',
  'HISTORICAL_PREP_IF_PRESENT',
]);

const EXPECTED_SUPERSESSION_SIGNAL_IDS = Object.freeze([
  'LOGICAL_ARTIFACT_ID_FIRST',
  'ACTIVE_PHASE04_PACKET_BOUND',
  'HISTORICAL_PHASE04_PREP_RETAINED_IF_PRESENT',
]);

const EXPECTED_SUPERSESSION_TARGET_IDS = Object.freeze([
  'TRUE_PHASE04_IS_DESIGN_LAYER_BASELINE',
  'OLD_PHASE04_SPATIAL_PREP_IS_HISTORICAL_ONLY',
  'PHASE04_PHASE_MAP_SYNC_MACHINE_BOUND',
]);

const EXPECTED_DESIGN_LAYER_SURFACE_IDS = Object.freeze([
  'TOKENS',
  'TYPOGRAPHY',
  'SKINS',
  'SUPPORTED_MODES',
]);

const EXPECTED_PROFILE_IDS = Object.freeze([
  'BASELINE',
  'SAFE',
  'FOCUS',
  'COMPACT',
]);

const EXPECTED_SHELL_MODE_IDS = Object.freeze([
  'CALM_DOCKED',
  'COMPACT_DOCKED',
  'SPATIAL_ADVANCED',
  'SAFE_RECOVERY',
]);

const EXPECTED_DESIGN_SIGNAL_IDS = Object.freeze([
  'PHASE03_BASELINE_DOCKED_SHELL_PASS',
  'PHASE04_SUPERSESSION_AND_PHASE_MAP_SYNC_PASS',
  'CANON_MUTABLE_DESIGN_SAFE',
  'BIBLE_MUTABLE_DESIGN_SAFE',
  'BIBLE_DESIGN_LAYER_DEFINED',
  'XPLAT_PROFILE_SET_LOCKED',
  'XPLAT_SHELL_MODE_SET_LOCKED',
]);

const EXPECTED_DESIGN_TARGET_IDS = Object.freeze([
  'DESIGN_LAYER_BASELINE',
  'TOKENS',
  'TYPOGRAPHY',
  'SKINS',
  'SUPPORTED_MODES',
  'TEXT_TRUTH_UNTOUCHED',
  'RECOVERY_TRUTH_UNTOUCHED',
  'COMMAND_SEMANTICS_UNTOUCHED',
  'NO_SHELL_OR_SPATIAL_RUNTIME_CLOSURE_CLAIM',
]);

const EXPECTED_ACTIVE_LOGICAL_ARTIFACT_ID = 'PHASE04_DESIGN_LAYER_BASELINE';
const EXPECTED_HISTORICAL_LOGICAL_ARTIFACT_ID = 'PHASE04_SPATIAL_PREP_HISTORICAL';

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

function containsAll(text, markers) {
  return markers.every((marker) => text.includes(marker));
}

function hasHistoricalPrepBinding(packet, packetExists, stateExists) {
  if (!packetExists && !stateExists) return true;
  if (!Array.isArray(packet?.historicalPrepBindings)) return false;

  return packet.historicalPrepBindings.some((binding) => (
    binding?.logicalArtifactId === EXPECTED_HISTORICAL_LOGICAL_ARTIFACT_ID
      && binding?.packetBasename === path.basename(HISTORICAL_PACKET_PATH)
      && binding?.stateScriptBasename === path.basename(HISTORICAL_STATE_PATH)
      && binding?.bindingStatus === 'IMMUTABLE_HISTORICAL_PREP'
  ));
}

function evaluatePhase04DesignLayerBaselineState(input = {}) {
  const forceNegative = Boolean(input.forceNegative);

  try {
    const phase03State = evaluatePhase03BaselineDockedShellState({});
    const supersessionPacketExists = fs.existsSync(path.resolve(SUPERSESSION_PACKET_PATH));
    const supersessionPacket = supersessionPacketExists ? readJson(SUPERSESSION_PACKET_PATH) : null;
    const designPacketExists = fs.existsSync(path.resolve(DESIGN_PACKET_PATH));
    const designPacket = designPacketExists ? readJson(DESIGN_PACKET_PATH) : null;
    const historicalPacketExists = fs.existsSync(path.resolve(HISTORICAL_PACKET_PATH));
    const historicalStateExists = fs.existsSync(path.resolve(HISTORICAL_STATE_PATH));
    const canonText = readText(CANON_PATH);
    const bibleText = readText(BIBLE_PATH);
    const xplatText = readText(XPLAT_PATH);

    const phase03Pass = phase03State.overallStatus === 'PASS'
      && phase03State.phase03ReadinessStatus === 'PASS';

    const supersessionPacketPass = supersessionPacket?.status === 'PASS';
    const supersessionStatusPass = supersessionPacket?.phase04PhaseMapSyncStatus === 'PASS';
    const bindingOrderMatches = arraysEqual(supersessionPacket?.bindingOrder || [], EXPECTED_BINDING_ORDER);
    const activeLogicalArtifactIdMatches = supersessionPacket?.activeLogicalArtifactId === EXPECTED_ACTIVE_LOGICAL_ARTIFACT_ID;
    const activePacketBound = supersessionPacket?.activePacketBasename === path.basename(DESIGN_PACKET_PATH);
    const historicalPrepBoundIfPresent = hasHistoricalPrepBinding(
      supersessionPacket,
      historicalPacketExists,
      historicalStateExists,
    );
    const supersessionSignalIdsMatch = arraysEqual(
      supersessionPacket?.boundSignalIds || [],
      EXPECTED_SUPERSESSION_SIGNAL_IDS,
    );
    const supersessionTargetIdsMatch = arraysEqual(
      supersessionPacket?.lockedTargetIds || [],
      EXPECTED_SUPERSESSION_TARGET_IDS,
    );
    const supersessionPendingGapIdsCleared = arraysEqual(
      supersessionPacket?.phase04PhaseMapPendingGapIds || [],
      [],
    );
    const supersessionPacketInternalConsistency = Boolean(supersessionPacket)
      && supersessionPacket?.artifactId === 'PHASE04_SUPERSESSION_AND_PHASE_MAP_SYNC_PACKET_V1'
      && supersessionPacket?.schemaVersion === 1
      && supersessionPacket?.phaseId === 'PHASE_04'
      && supersessionPacketPass
      && supersessionStatusPass
      && bindingOrderMatches
      && activeLogicalArtifactIdMatches
      && activePacketBound
      && historicalPrepBoundIfPresent
      && supersessionSignalIdsMatch
      && supersessionTargetIdsMatch
      && supersessionPendingGapIdsCleared
      && supersessionPacket?.proof?.logicalArtifactIdFirstTrue === true
      && supersessionPacket?.proof?.activePacketBoundTrue === true
      && supersessionPacket?.proof?.historicalPrepRetainedIfPresentTrue === true
      && supersessionPacket?.proof?.noFalsePhase04SupersessionGreenTrue === true;

    const designPacketPass = designPacket?.status === 'PASS';
    const designBaselineStatusPass = designPacket?.phase04BaselineStatus === 'PASS';
    const designPacketSourcePhase03Matches = designPacket?.sourcePhase03State === 'phase03-baseline-docked-shell-state.mjs';
    const designPacketSourceSupersessionMatches = designPacket?.sourcePhase04SupersessionPacketBasename === path.basename(SUPERSESSION_PACKET_PATH);
    const designLayerOnlyScopeLocked = designPacket?.scope?.designLayerOnly === true
      && designPacket?.scope?.touchesDocumentTruth === false
      && designPacket?.scope?.touchesRecoveryTruth === false
      && designPacket?.scope?.touchesCommandSemantics === false
      && designPacket?.scope?.shellRuntimeClosureClaimed === false
      && designPacket?.scope?.spatialRuntimeClosureClaimed === false;
    const designLayerSurfaceIdsMatch = arraysEqual(
      designPacket?.designLayerSurfaceIds || [],
      EXPECTED_DESIGN_LAYER_SURFACE_IDS,
    );
    const profileIdsMatch = arraysEqual(
      designPacket?.profileIds || [],
      EXPECTED_PROFILE_IDS,
    );
    const shellModeIdsMatch = arraysEqual(
      designPacket?.supportedShellModeIds || [],
      EXPECTED_SHELL_MODE_IDS,
    );
    const designSignalIdsMatch = arraysEqual(
      designPacket?.boundSignalIds || [],
      EXPECTED_DESIGN_SIGNAL_IDS,
    );
    const designTargetIdsMatch = arraysEqual(
      designPacket?.lockedTargetIds || [],
      EXPECTED_DESIGN_TARGET_IDS,
    );
    const designPendingGapIdsCleared = arraysEqual(
      designPacket?.phase04PendingGapIds || [],
      [],
    );

    const canonMutableDesignSafe = containsAll(canonText, [
      'mutable design that never threatens text truth',
    ]);
    const bibleMutableDesignSafe = containsAll(bibleText, [
      'mutable design that never threatens text truth',
    ]);
    const bibleDesignLayerDefined = containsAll(bibleText, [
      '### Design layer',
      '- tokens',
      '- typography',
      '- skins',
      '- supported modes',
    ]);
    const xplatProfileSetLocked = containsAll(xplatText, EXPECTED_PROFILE_IDS.map((id) => `\`${id}\``));
    const xplatShellModeSetLocked = containsAll(xplatText, EXPECTED_SHELL_MODE_IDS.map((id) => `\`${id}\``));
    const designPacketInternalConsistency = Boolean(designPacket)
      && designPacket?.artifactId === 'PHASE04_DESIGN_LAYER_BASELINE_PACKET_V1'
      && designPacket?.schemaVersion === 1
      && designPacket?.phaseId === 'PHASE_04'
      && designPacketPass
      && designBaselineStatusPass
      && designPacketSourcePhase03Matches
      && designPacketSourceSupersessionMatches
      && designLayerOnlyScopeLocked
      && designLayerSurfaceIdsMatch
      && profileIdsMatch
      && shellModeIdsMatch
      && designSignalIdsMatch
      && designTargetIdsMatch
      && designPendingGapIdsCleared
      && designPacket?.proof?.phase03BaselineDockedShellPassTrue === true
      && designPacket?.proof?.supersessionAndPhaseMapSyncPassTrue === true
      && designPacket?.proof?.canonMutableDesignSafeTrue === true
      && designPacket?.proof?.bibleMutableDesignSafeTrue === true
      && designPacket?.proof?.bibleDesignLayerDefinedTrue === true
      && designPacket?.proof?.xplatProfileSetLockedTrue === true
      && designPacket?.proof?.xplatShellModeSetLockedTrue === true
      && designPacket?.proof?.designLayerOnlyScopeTrue === true
      && designPacket?.proof?.noFalsePhase04DesignBaselineGreenTrue === true;

    const checkStatusById = {
      PHASE03_BASELINE_DOCKED_SHELL_PASS: asCheck(phase03Pass ? 'GREEN' : 'OPEN_GAP', true, phase03Pass ? 'PHASE03_BASELINE_DOCKED_SHELL_PASS' : 'PHASE03_BASELINE_DOCKED_SHELL_NOT_PASS'),
      SUPERSESSION_PACKET_PRESENT: asCheck(supersessionPacketExists ? 'GREEN' : 'OPEN_GAP', true, supersessionPacketExists ? 'SUPERSESSION_PACKET_PRESENT' : 'SUPERSESSION_PACKET_MISSING'),
      SUPERSESSION_PACKET_PASS: asCheck(supersessionPacketPass ? 'GREEN' : 'OPEN_GAP', true, supersessionPacketPass ? 'SUPERSESSION_PACKET_PASS' : 'SUPERSESSION_PACKET_NOT_PASS'),
      PHASE_MAP_SYNC_STATUS_PASS: asCheck(supersessionStatusPass ? 'GREEN' : 'OPEN_GAP', true, supersessionStatusPass ? 'PHASE_MAP_SYNC_STATUS_PASS' : 'PHASE_MAP_SYNC_STATUS_NOT_PASS'),
      BINDING_ORDER_MATCH: asCheck(bindingOrderMatches ? 'GREEN' : 'OPEN_GAP', true, bindingOrderMatches ? 'BINDING_ORDER_MATCH' : 'BINDING_ORDER_DRIFT'),
      ACTIVE_LOGICAL_ARTIFACT_ID_MATCH: asCheck(activeLogicalArtifactIdMatches ? 'GREEN' : 'OPEN_GAP', true, activeLogicalArtifactIdMatches ? 'ACTIVE_LOGICAL_ARTIFACT_ID_MATCH' : 'ACTIVE_LOGICAL_ARTIFACT_ID_DRIFT'),
      HISTORICAL_PREP_BOUND_IF_PRESENT: asCheck(historicalPrepBoundIfPresent ? 'GREEN' : 'OPEN_GAP', true, historicalPrepBoundIfPresent ? 'HISTORICAL_PREP_BOUND_IF_PRESENT' : 'HISTORICAL_PREP_BINDING_MISSING'),
      SUPERSESSION_PACKET_INTERNAL_CONSISTENCY: asCheck(supersessionPacketInternalConsistency ? 'GREEN' : 'OPEN_GAP', true, supersessionPacketInternalConsistency ? 'SUPERSESSION_PACKET_INTERNAL_CONSISTENCY' : 'SUPERSESSION_PACKET_INTERNAL_CONSISTENCY_BROKEN'),
      DESIGN_PACKET_PRESENT: asCheck(designPacketExists ? 'GREEN' : 'OPEN_GAP', true, designPacketExists ? 'DESIGN_PACKET_PRESENT' : 'DESIGN_PACKET_MISSING'),
      DESIGN_PACKET_PASS: asCheck(designPacketPass ? 'GREEN' : 'OPEN_GAP', true, designPacketPass ? 'DESIGN_PACKET_PASS' : 'DESIGN_PACKET_NOT_PASS'),
      DESIGN_BASELINE_STATUS_PASS: asCheck(designBaselineStatusPass ? 'GREEN' : 'OPEN_GAP', true, designBaselineStatusPass ? 'DESIGN_BASELINE_STATUS_PASS' : 'DESIGN_BASELINE_STATUS_NOT_PASS'),
      DESIGN_LAYER_SCOPE_LOCKED: asCheck(designLayerOnlyScopeLocked ? 'GREEN' : 'OPEN_GAP', true, designLayerOnlyScopeLocked ? 'DESIGN_LAYER_SCOPE_LOCKED' : 'DESIGN_LAYER_SCOPE_DRIFT'),
      DESIGN_LAYER_SURFACE_IDS_MATCH: asCheck(designLayerSurfaceIdsMatch ? 'GREEN' : 'OPEN_GAP', true, designLayerSurfaceIdsMatch ? 'DESIGN_LAYER_SURFACE_IDS_MATCH' : 'DESIGN_LAYER_SURFACE_IDS_DRIFT'),
      XPLAT_PROFILE_SET_LOCKED: asCheck(xplatProfileSetLocked && profileIdsMatch ? 'GREEN' : 'OPEN_GAP', true, xplatProfileSetLocked && profileIdsMatch ? 'XPLAT_PROFILE_SET_LOCKED' : 'XPLAT_PROFILE_SET_DRIFT'),
      XPLAT_SHELL_MODE_SET_LOCKED: asCheck(xplatShellModeSetLocked && shellModeIdsMatch ? 'GREEN' : 'OPEN_GAP', true, xplatShellModeSetLocked && shellModeIdsMatch ? 'XPLAT_SHELL_MODE_SET_LOCKED' : 'XPLAT_SHELL_MODE_SET_DRIFT'),
      CANON_MUTABLE_DESIGN_SAFE: asCheck(canonMutableDesignSafe ? 'GREEN' : 'OPEN_GAP', true, canonMutableDesignSafe ? 'CANON_MUTABLE_DESIGN_SAFE' : 'CANON_MUTABLE_DESIGN_SAFE_MISSING'),
      BIBLE_MUTABLE_DESIGN_SAFE: asCheck(bibleMutableDesignSafe ? 'GREEN' : 'OPEN_GAP', true, bibleMutableDesignSafe ? 'BIBLE_MUTABLE_DESIGN_SAFE' : 'BIBLE_MUTABLE_DESIGN_SAFE_MISSING'),
      BIBLE_DESIGN_LAYER_DEFINED: asCheck(bibleDesignLayerDefined ? 'GREEN' : 'OPEN_GAP', true, bibleDesignLayerDefined ? 'BIBLE_DESIGN_LAYER_DEFINED' : 'BIBLE_DESIGN_LAYER_MISSING'),
      DESIGN_PACKET_INTERNAL_CONSISTENCY: asCheck(designPacketInternalConsistency ? 'GREEN' : 'OPEN_GAP', true, designPacketInternalConsistency ? 'DESIGN_PACKET_INTERNAL_CONSISTENCY' : 'DESIGN_PACKET_INTERNAL_CONSISTENCY_BROKEN'),
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
        phase04BaselineStatus: 'HOLD',
        greenCheckIds,
        openGapIds: Array.from(new Set([...openGapIds, 'FORCED_NEGATIVE_PATH'])),
        checkStatusById,
        activeLogicalArtifactId: supersessionPacket?.activeLogicalArtifactId || '',
        phase04PendingGapIds: designPacket?.phase04PendingGapIds || [],
        designLayerSurfaceIds: designPacket?.designLayerSurfaceIds || [],
        profileIds: designPacket?.profileIds || [],
        supportedShellModeIds: designPacket?.supportedShellModeIds || [],
      };
    }

    const overallPass = openGapIds.length === 0;

    return {
      ok: overallPass,
      failReason: '',
      overallStatus: overallPass ? 'PASS' : 'HOLD',
      phase04BaselineStatus: overallPass ? 'PASS' : 'HOLD',
      greenCheckIds,
      openGapIds,
      checkStatusById,
      activeLogicalArtifactId: supersessionPacket?.activeLogicalArtifactId || '',
      phase04PendingGapIds: designPacket?.phase04PendingGapIds || [],
      designLayerSurfaceIds: designPacket?.designLayerSurfaceIds || [],
      profileIds: designPacket?.profileIds || [],
      supportedShellModeIds: designPacket?.supportedShellModeIds || [],
    };
  } catch (error) {
    return {
      ok: false,
      failReason: FAIL_REASON_UNEXPECTED,
      overallStatus: 'HOLD',
      phase04BaselineStatus: 'UNKNOWN',
      greenCheckIds: [],
      openGapIds: ['PHASE04_DESIGN_LAYER_BASELINE_EVALUATION_ERROR'],
      checkStatusById: {},
      activeLogicalArtifactId: '',
      phase04PendingGapIds: [],
      designLayerSurfaceIds: [],
      profileIds: [],
      supportedShellModeIds: [],
      errorMessage: error && typeof error.message === 'string' ? error.message : 'UNKNOWN',
    };
  }
}

function runCli() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluatePhase04DesignLayerBaselineState({ forceNegative: args.forceNegative });

  if (args.json) {
    console.log(JSON.stringify(state, null, 2));
  } else {
    console.log(`PHASE04_DESIGN_LAYER_BASELINE_OK=${state.ok ? 1 : 0}`);
    console.log(`PHASE04_DESIGN_LAYER_BASELINE_OVERALL_STATUS=${state.overallStatus}`);
    console.log(`PHASE04_DESIGN_LAYER_BASELINE_STATUS=${state.phase04BaselineStatus}`);
    console.log(`PHASE04_DESIGN_LAYER_BASELINE_OPEN_GAP_IDS=${state.openGapIds.join(',')}`);
    console.log(`PHASE04_DESIGN_LAYER_BASELINE_FAIL_REASON=${state.failReason}`);
  }

  process.exit(state.ok ? 0 : 1);
}

const selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(selfPath)) {
  runCli();
}

export { evaluatePhase04DesignLayerBaselineState };

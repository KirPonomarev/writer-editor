#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { evaluatePhase03BaselineDockedShellState } from './phase03-baseline-docked-shell-state.mjs';

const FAIL_REASON_FORCED_NEGATIVE = 'E_PHASE04_SPATIAL_PREP_FORCED_NEGATIVE';
const FAIL_REASON_UNEXPECTED = 'E_PHASE04_SPATIAL_PREP_UNEXPECTED';
const PREP_PACKET_PATH = 'docs/OPS/STATUS/PHASE04_SPATIAL_PREP_PACKET_V1.json';
const CANON_PATH = 'CANON.md';
const BIBLE_PATH = 'docs/BIBLE.md';
const CONTEXT_PATH = 'docs/CONTEXT.md';
const XPLAT_PATH = 'docs/OPS/STATUS/XPLAT_UNIFIED_MASTER_EXECUTION_CONTRACT_v3.13a-final.md';

const EXPECTED_LOCKED_TARGET_IDS = Object.freeze([
  'BOUNDED_SPATIAL_SCOPE',
  'SPATIAL_COMMIT_POINTS',
  'SPATIAL_PERSISTENCE_BOUNDARIES',
  'SPATIAL_BLOCKING_ACTIVATION',
]);

const EXPECTED_COMMIT_POINT_IDS = Object.freeze([
  'DRAG_END',
  'RESIZE_END',
  'EXPLICIT_APPLY',
  'WORKSPACE_SAVE',
  'MODE_OR_PROFILE_SWITCH',
  'APP_CLOSE_WITH_DEBOUNCE',
  'SAFE_RESET_OR_LAST_STABLE_RESTORE',
]);

const EXPECTED_RUNTIME_GAP_IDS = Object.freeze([
  'SPATIAL_RUNTIME_NOT_EXECUTED',
  'LAYOUT_SNAPSHOT_RUNTIME_NOT_EXECUTED',
  'INVALID_LAYOUT_AND_MISSING_MONITOR_RECOVERY_NOT_EXECUTED',
]);

const EXPECTED_PENDING_GAP_IDS = Object.freeze([
  'PHASE03_BASELINE_DOCKED_SHELL_PASS',
  'CANON_BOUNDED_SPATIAL_LAYER_PRESENT',
  'CONTEXT_BOUNDED_SPATIAL_LAYER_PRESENT',
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

function evaluatePhase04SpatialPrepState(input = {}) {
  const forceNegative = Boolean(input.forceNegative);

  try {
    const phase03State = evaluatePhase03BaselineDockedShellState({});
    const prepPacketExists = fs.existsSync(path.resolve(PREP_PACKET_PATH));
    const prepPacket = prepPacketExists ? readJson(PREP_PACKET_PATH) : null;
    const canonText = readText(CANON_PATH);
    const bibleText = readText(BIBLE_PATH);
    const contextText = readText(CONTEXT_PATH);
    const xplatText = readText(XPLAT_PATH);

    const phase03Pass = phase03State.overallStatus === 'PASS'
      && phase03State.phase03ReadinessStatus === 'PASS';
    const packetPass = prepPacket?.status === 'PASS';
    const prepHold = prepPacket?.phase04ReadinessStatus === 'HOLD';
    const sourcePhase03Matches = prepPacket?.sourcePhase03State === 'phase03-baseline-docked-shell-state.mjs';
    const lockedTargetIdsMatch = arraysEqual(prepPacket?.lockedTargetIds || [], EXPECTED_LOCKED_TARGET_IDS);
    const lockedCommitPointIdsMatch = arraysEqual(prepPacket?.lockedCommitPointIds || [], EXPECTED_COMMIT_POINT_IDS);
    const lockedRuntimeGapIdsMatch = arraysEqual(prepPacket?.lockedRuntimeGapIds || [], EXPECTED_RUNTIME_GAP_IDS);
    const pendingGapIdsMatch = arraysEqual(prepPacket?.phase04PendingGapIds || [], EXPECTED_PENDING_GAP_IDS);

    const canonBoundedSpatialLayerPresent = /bounded spatial layer/.test(canonText);
    const bibleBoundedSpatialShellPresent = /bounded spatial shell/.test(bibleText);
    const contextBoundedSpatialLayerPresent = /4\.\s+bounded spatial layer/.test(contextText);
    const editorRootDocked = /Editor root остаётся docked/.test(xplatText);
    const transientOverlaysExcluded = /Transient overlays не входят в spatial persistence/.test(xplatText);
    const commitPointsLocked = /drag end/.test(xplatText)
      && /resize end/.test(xplatText)
      && /explicit apply/.test(xplatText)
      && /workspace save/.test(xplatText)
      && /mode or profile switch/.test(xplatText)
      && /app close with debounce/.test(xplatText)
      && /safe reset or last stable restore/.test(xplatText);
    const invalidLayoutBlockingRulePresent = /invalid layout and missing monitor recovery/.test(xplatText)
      && /становятся blocking/.test(xplatText);

    const checkStatusById = {
      PHASE03_BASELINE_DOCKED_SHELL_PASS: asCheck(phase03Pass ? 'GREEN' : 'OPEN_GAP', true, phase03Pass ? 'PHASE03_BASELINE_DOCKED_SHELL_PASS' : 'PHASE03_BASELINE_DOCKED_SHELL_NOT_PASS'),
      PREP_PACKET_PRESENT: asCheck(prepPacketExists ? 'GREEN' : 'OPEN_GAP', true, prepPacketExists ? 'PREP_PACKET_PRESENT' : 'PREP_PACKET_MISSING'),
      PREP_PACKET_PASS: asCheck(packetPass ? 'GREEN' : 'OPEN_GAP', true, packetPass ? 'PREP_PACKET_PASS' : 'PREP_PACKET_NOT_PASS'),
      PREP_REMAINS_HOLD: asCheck(prepHold ? 'GREEN' : 'OPEN_GAP', true, prepHold ? 'PREP_REMAINS_HOLD' : 'PREP_FALSE_GREEN'),
      SOURCE_PHASE03_MATCH: asCheck(sourcePhase03Matches ? 'GREEN' : 'OPEN_GAP', true, sourcePhase03Matches ? 'SOURCE_PHASE03_MATCH' : 'SOURCE_PHASE03_DRIFT'),
      LOCKED_TARGET_IDS_MATCH: asCheck(lockedTargetIdsMatch ? 'GREEN' : 'OPEN_GAP', true, lockedTargetIdsMatch ? 'LOCKED_TARGET_IDS_MATCH' : 'LOCKED_TARGET_IDS_DRIFT'),
      LOCKED_COMMIT_POINT_IDS_MATCH: asCheck(lockedCommitPointIdsMatch ? 'GREEN' : 'OPEN_GAP', true, lockedCommitPointIdsMatch ? 'LOCKED_COMMIT_POINT_IDS_MATCH' : 'LOCKED_COMMIT_POINT_IDS_DRIFT'),
      LOCKED_RUNTIME_GAP_IDS_MATCH: asCheck(lockedRuntimeGapIdsMatch ? 'GREEN' : 'OPEN_GAP', true, lockedRuntimeGapIdsMatch ? 'LOCKED_RUNTIME_GAP_IDS_MATCH' : 'LOCKED_RUNTIME_GAP_IDS_DRIFT'),
      PENDING_GAP_IDS_MATCH: asCheck(pendingGapIdsMatch ? 'GREEN' : 'OPEN_GAP', true, pendingGapIdsMatch ? 'PENDING_GAP_IDS_MATCH' : 'PENDING_GAP_IDS_DRIFT'),
      CANON_BOUNDED_SPATIAL_LAYER_PRESENT: asCheck(canonBoundedSpatialLayerPresent ? 'GREEN' : 'OPEN_GAP', true, canonBoundedSpatialLayerPresent ? 'CANON_BOUNDED_SPATIAL_LAYER_PRESENT' : 'CANON_BOUNDED_SPATIAL_LAYER_MISSING'),
      BIBLE_BOUNDED_SPATIAL_SHELL_PRESENT: asCheck(bibleBoundedSpatialShellPresent ? 'GREEN' : 'OPEN_GAP', true, bibleBoundedSpatialShellPresent ? 'BIBLE_BOUNDED_SPATIAL_SHELL_PRESENT' : 'BIBLE_BOUNDED_SPATIAL_SHELL_MISSING'),
      CONTEXT_BOUNDED_SPATIAL_LAYER_PRESENT: asCheck(contextBoundedSpatialLayerPresent ? 'GREEN' : 'OPEN_GAP', true, contextBoundedSpatialLayerPresent ? 'CONTEXT_BOUNDED_SPATIAL_LAYER_PRESENT' : 'CONTEXT_BOUNDED_SPATIAL_LAYER_MISSING'),
      EDITOR_ROOT_DOCKED: asCheck(editorRootDocked ? 'GREEN' : 'OPEN_GAP', true, editorRootDocked ? 'EDITOR_ROOT_DOCKED' : 'EDITOR_ROOT_DOCKED_MISSING'),
      TRANSIENT_OVERLAYS_EXCLUDED: asCheck(transientOverlaysExcluded ? 'GREEN' : 'OPEN_GAP', true, transientOverlaysExcluded ? 'TRANSIENT_OVERLAYS_EXCLUDED' : 'TRANSIENT_OVERLAYS_EXCLUDED_MISSING'),
      COMMIT_POINTS_LOCKED: asCheck(commitPointsLocked ? 'GREEN' : 'OPEN_GAP', true, commitPointsLocked ? 'COMMIT_POINTS_LOCKED' : 'COMMIT_POINTS_INCOMPLETE'),
      INVALID_LAYOUT_BLOCKING_RULE_PRESENT: asCheck(invalidLayoutBlockingRulePresent ? 'GREEN' : 'OPEN_GAP', true, invalidLayoutBlockingRulePresent ? 'INVALID_LAYOUT_BLOCKING_RULE_PRESENT' : 'INVALID_LAYOUT_BLOCKING_RULE_MISSING'),
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
        phase04ReadinessStatus: 'HOLD',
        greenCheckIds,
        openGapIds: Array.from(new Set([...openGapIds, 'FORCED_NEGATIVE_PATH'])),
        checkStatusById,
        lockedTargetIds: prepPacket?.lockedTargetIds || [],
        lockedCommitPointIds: prepPacket?.lockedCommitPointIds || [],
        lockedRuntimeGapIds: prepPacket?.lockedRuntimeGapIds || [],
      };
    }

    return {
      ok: openGapIds.length === 0,
      failReason: openGapIds.length === 0 ? '' : 'PHASE04_SPATIAL_PREP_PENDING_GAPS',
      overallStatus: openGapIds.length === 0 ? 'PASS' : 'HOLD',
      phase04ReadinessStatus: prepHold ? 'HOLD' : 'UNKNOWN',
      greenCheckIds,
      openGapIds,
      checkStatusById,
      phase04PendingGapIds: prepPacket?.phase04PendingGapIds || [],
      lockedTargetIds: prepPacket?.lockedTargetIds || [],
      lockedCommitPointIds: prepPacket?.lockedCommitPointIds || [],
      lockedRuntimeGapIds: prepPacket?.lockedRuntimeGapIds || [],
    };
  } catch (error) {
    return {
      ok: false,
      failReason: FAIL_REASON_UNEXPECTED,
      overallStatus: 'HOLD',
      phase04ReadinessStatus: 'UNKNOWN',
      greenCheckIds: [],
      openGapIds: ['PHASE04_SPATIAL_PREP_EVALUATION_ERROR'],
      checkStatusById: {},
      lockedTargetIds: [],
      lockedCommitPointIds: [],
      lockedRuntimeGapIds: [],
      errorMessage: error && typeof error.message === 'string' ? error.message : 'UNKNOWN',
    };
  }
}

function runCli() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluatePhase04SpatialPrepState({ forceNegative: args.forceNegative });

  if (args.json) {
    console.log(JSON.stringify(state, null, 2));
  } else {
    console.log(`PHASE04_SPATIAL_PREP_OK=${state.ok ? 1 : 0}`);
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

export { evaluatePhase04SpatialPrepState };

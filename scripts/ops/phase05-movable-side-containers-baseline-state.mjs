#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { evaluatePhase04SpatialPrepState } from './phase04-spatial-prep-state.mjs';

const FAIL_REASON_FORCED_NEGATIVE = 'E_PHASE05_MOVABLE_SIDE_CONTAINERS_BASELINE_FORCED_NEGATIVE';
const FAIL_REASON_UNEXPECTED = 'E_PHASE05_MOVABLE_SIDE_CONTAINERS_BASELINE_UNEXPECTED';
const PACKET_PATH = 'docs/OPS/STATUS/PHASE05_MOVABLE_SIDE_CONTAINERS_BASELINE_V1.json';
const EDITOR_PATH = 'src/renderer/editor.js';
const STYLES_PATH = 'src/renderer/styles.css';
const INDEX_PATH = 'src/renderer/index.html';

const EXPECTED_LOCKED_TARGET_IDS = Object.freeze([
  'BOUNDED_MOVABLE_SIDE_CONTAINERS_BASELINE',
  'LEFT_SIDE_CONTAINER',
  'RIGHT_SIDE_CONTAINER',
  'EDITOR_ROOT_FIXED_DOCKED',
  'PROJECT_SCOPED_SPATIAL_LAYOUT_SNAPSHOT',
  'RESIZE_END_SAFE_RESET_LAST_STABLE_RESTORE',
  'SAFE_DEGRADATION_ON_INVALID_LAYOUT_OR_VIEWPORT_SHRINK',
]);

const EXPECTED_LOCKED_COMMIT_POINT_IDS = Object.freeze([
  'RESIZE_END',
  'SAFE_RESET',
  'RESTORE_LAST_STABLE',
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

function hasPattern(text, pattern) {
  return pattern.test(text);
}

function arraysEqual(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

function evaluatePhase05MovableSideContainersBaselineState(input = {}) {
  const forceNegative = Boolean(input.forceNegative);

  try {
    const phase04State = evaluatePhase04SpatialPrepState({});
    const packet = fs.existsSync(path.resolve(PACKET_PATH)) ? readJson(PACKET_PATH) : null;
    const editorText = readText(EDITOR_PATH);
    const stylesText = readText(STYLES_PATH);
    const indexText = readText(INDEX_PATH);

    const phase04Pass = phase04State.overallStatus === 'PASS' && phase04State.phase04ReadinessStatus === 'HOLD';
    const packetPass = packet?.status === 'PASS';
    const readinessHold = packet?.phase05ReadinessStatus === 'HOLD';
    const sourcePhase04Matches = packet?.sourcePhase04State === 'phase04-spatial-prep-state.mjs';
    const lockedTargetIdsMatch = arraysEqual(packet?.lockedTargetIds || [], EXPECTED_LOCKED_TARGET_IDS);
    const lockedCommitPointIdsMatch = arraysEqual(packet?.lockedCommitPointIds || [], EXPECTED_LOCKED_COMMIT_POINT_IDS);

    const editorRootFixedDocked = hasPattern(editorText, /function getSpatialLayoutConstraintsForViewport/) &&
      hasPattern(editorText, /rightSidebarResizer/) &&
      hasPattern(editorText, /commitSpatialLayoutState\(currentProjectId\)/) &&
      hasPattern(editorText, /restoreSpatialLayoutState\(currentProjectId\)/) &&
      hasPattern(editorText, /clearProjectWorkspaceStorage\(projectId = currentProjectId\)/) &&
      hasPattern(editorText, /getSpatialLayoutStorageKey/) &&
      hasPattern(editorText, /updateSpatialLayoutForViewportChange/);
    const leftAndRightResizeHandlesPresent = hasPattern(indexText, /data-right-sidebar-resizer/) &&
      hasPattern(stylesText, /\.sidebar__resize-handle--right/) &&
      hasPattern(stylesText, /--app-left-sidebar-width/) &&
      hasPattern(stylesText, /--app-right-sidebar-width/);
    const projectScopedSpatialLayoutStorage = hasPattern(editorText, /spatialLayout/) &&
      hasPattern(editorText, /currentProjectId/) &&
      hasPattern(editorText, /getSpatialLayoutStorageKey\(projectId = currentProjectId\)/) &&
      hasPattern(editorText, /clearProjectWorkspaceStorage\(projectId = currentProjectId\)/);
    const commitPointPersistenceOnly = hasPattern(editorText, /pointermove/ ) &&
      hasPattern(editorText, /pointerup/ ) &&
      hasPattern(editorText, /commitSpatialLayoutState\(currentProjectId\)/) &&
      hasPattern(editorText, /applySpatialLayoutState\(nextState, \{ persist: false, projectId: currentProjectId \}\)/);
    const safeResetPersistsBaseline = hasPattern(editorText, /applySpatialLayoutState\(getSpatialLayoutBaselineForViewport\(\), \{\n\s+persist: true,\n\s+projectId: currentProjectId,\n\s+\}\);/);
    const restoreLastStableRestoresSnapshot = hasPattern(editorText, /restoreSpatialLayoutState\(currentProjectId\);/);
    const invalidViewportDegradesToBaseline = hasPattern(editorText, /updateSpatialLayoutForViewportChange/) &&
      hasPattern(editorText, /normalizeSpatialLayoutState\(storedState \|\| spatialLayoutState/);

    const checkStatusById = {
      PHASE04_SPATIAL_PREP_PASS: asCheck(phase04Pass ? 'GREEN' : 'OPEN_GAP', true, phase04Pass ? 'PHASE04_SPATIAL_PREP_PASS' : 'PHASE04_SPATIAL_PREP_NOT_PASS'),
      PACKET_PRESENT: asCheck(Boolean(packet) ? 'GREEN' : 'OPEN_GAP', true, packet ? 'PACKET_PRESENT' : 'PACKET_MISSING'),
      PACKET_PASS: asCheck(packetPass ? 'GREEN' : 'OPEN_GAP', true, packetPass ? 'PACKET_PASS' : 'PACKET_NOT_PASS'),
      READINESS_HOLD: asCheck(readinessHold ? 'GREEN' : 'OPEN_GAP', true, readinessHold ? 'READINESS_HOLD' : 'READINESS_FALSE_GREEN'),
      SOURCE_PHASE04_MATCH: asCheck(sourcePhase04Matches ? 'GREEN' : 'OPEN_GAP', true, sourcePhase04Matches ? 'SOURCE_PHASE04_MATCH' : 'SOURCE_PHASE04_DRIFT'),
      LOCKED_TARGET_IDS_MATCH: asCheck(lockedTargetIdsMatch ? 'GREEN' : 'OPEN_GAP', true, lockedTargetIdsMatch ? 'LOCKED_TARGET_IDS_MATCH' : 'LOCKED_TARGET_IDS_DRIFT'),
      LOCKED_COMMIT_POINT_IDS_MATCH: asCheck(lockedCommitPointIdsMatch ? 'GREEN' : 'OPEN_GAP', true, lockedCommitPointIdsMatch ? 'LOCKED_COMMIT_POINT_IDS_MATCH' : 'LOCKED_COMMIT_POINT_IDS_DRIFT'),
      EDITOR_ROOT_FIXED_DOCKED: asCheck(editorRootFixedDocked ? 'GREEN' : 'OPEN_GAP', true, editorRootFixedDocked ? 'EDITOR_ROOT_FIXED_DOCKED' : 'EDITOR_ROOT_FIXED_DOCKED_MISSING'),
      LEFT_AND_RIGHT_RESIZE_HANDLES_PRESENT: asCheck(leftAndRightResizeHandlesPresent ? 'GREEN' : 'OPEN_GAP', true, leftAndRightResizeHandlesPresent ? 'LEFT_AND_RIGHT_RESIZE_HANDLES_PRESENT' : 'LEFT_AND_RIGHT_RESIZE_HANDLES_MISSING'),
      PROJECT_SCOPED_SPATIAL_LAYOUT_STORAGE: asCheck(projectScopedSpatialLayoutStorage ? 'GREEN' : 'OPEN_GAP', true, projectScopedSpatialLayoutStorage ? 'PROJECT_SCOPED_SPATIAL_LAYOUT_STORAGE' : 'PROJECT_SCOPED_SPATIAL_LAYOUT_STORAGE_MISSING'),
      COMMIT_POINT_PERSISTENCE_ONLY: asCheck(commitPointPersistenceOnly ? 'GREEN' : 'OPEN_GAP', true, commitPointPersistenceOnly ? 'COMMIT_POINT_PERSISTENCE_ONLY' : 'COMMIT_POINT_PERSISTENCE_ONLY_MISSING'),
      SAFE_RESET_PERSISTS_BASELINE: asCheck(safeResetPersistsBaseline ? 'GREEN' : 'OPEN_GAP', true, safeResetPersistsBaseline ? 'SAFE_RESET_PERSISTS_BASELINE' : 'SAFE_RESET_PERSISTS_BASELINE_MISSING'),
      RESTORE_LAST_STABLE_RESTORES_SNAPSHOT: asCheck(restoreLastStableRestoresSnapshot ? 'GREEN' : 'OPEN_GAP', true, restoreLastStableRestoresSnapshot ? 'RESTORE_LAST_STABLE_RESTORES_SNAPSHOT' : 'RESTORE_LAST_STABLE_RESTORES_SNAPSHOT_MISSING'),
      INVALID_VIEWPORT_DEGRADES_TO_BASELINE: asCheck(invalidViewportDegradesToBaseline ? 'GREEN' : 'OPEN_GAP', true, invalidViewportDegradesToBaseline ? 'INVALID_VIEWPORT_DEGRADES_TO_BASELINE' : 'INVALID_VIEWPORT_DEGRADES_TO_BASELINE_MISSING'),
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
        lockedTargetIds: packet?.lockedTargetIds || [],
        lockedCommitPointIds: packet?.lockedCommitPointIds || [],
      };
    }

    return {
      ok: openGapIds.length === 0,
      failReason: '',
      overallStatus: openGapIds.length === 0 ? 'PASS' : 'HOLD',
      phase05ReadinessStatus: readinessHold ? 'HOLD' : 'UNKNOWN',
      greenCheckIds,
      openGapIds,
      checkStatusById,
      lockedTargetIds: packet?.lockedTargetIds || [],
      lockedCommitPointIds: packet?.lockedCommitPointIds || [],
    };
  } catch (error) {
    return {
      ok: false,
      failReason: FAIL_REASON_UNEXPECTED,
      overallStatus: 'HOLD',
      phase05ReadinessStatus: 'UNKNOWN',
      greenCheckIds: [],
      openGapIds: ['PHASE05_MOVABLE_SIDE_CONTAINERS_BASELINE_EVALUATION_ERROR'],
      checkStatusById: {},
      lockedTargetIds: [],
      lockedCommitPointIds: [],
      errorMessage: error && typeof error.message === 'string' ? error.message : 'UNKNOWN',
    };
  }
}

function runCli() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluatePhase05MovableSideContainersBaselineState({ forceNegative: args.forceNegative });

  if (args.json) {
    console.log(JSON.stringify(state, null, 2));
  } else {
    console.log(`PHASE05_MOVABLE_SIDE_CONTAINERS_BASELINE_OK=${state.ok ? 1 : 0}`);
    console.log(`PHASE05_MOVABLE_SIDE_CONTAINERS_BASELINE_OVERALL_STATUS=${state.overallStatus}`);
    console.log(`PHASE05_MOVABLE_SIDE_CONTAINERS_BASELINE_READINESS_STATUS=${state.phase05ReadinessStatus}`);
    console.log(`PHASE05_MOVABLE_SIDE_CONTAINERS_BASELINE_OPEN_GAP_IDS=${state.openGapIds.join(',')}`);
    console.log(`PHASE05_MOVABLE_SIDE_CONTAINERS_BASELINE_FAIL_REASON=${state.failReason}`);
  }

  process.exit(state.ok ? 0 : 1);
}

const selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(selfPath)) {
  runCli();
}

export { evaluatePhase05MovableSideContainersBaselineState };

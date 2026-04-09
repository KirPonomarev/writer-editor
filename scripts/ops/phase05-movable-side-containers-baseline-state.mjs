#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FAIL_REASON_FORCED_NEGATIVE = 'E_PHASE05_MOVABLE_SIDE_CONTAINERS_BASELINE_FORCED_NEGATIVE';
const FAIL_REASON_UNEXPECTED = 'E_PHASE05_MOVABLE_SIDE_CONTAINERS_BASELINE_UNEXPECTED';
const EDITOR_SOURCE_PATH = 'src/renderer/editor.js';
const PHASE04_PACKET_PATH = 'docs/OPS/STATUS/PHASE04_DESIGN_LAYER_BASELINE_PACKET_V1.json';

const LOCKED_TARGET_IDS = Object.freeze([
  'BOUNDED_MOVABLE_SIDE_CONTAINERS_BASELINE',
  'LEFT_SIDE_CONTAINER',
  'RIGHT_SIDE_CONTAINER',
  'EDITOR_ROOT_FIXED_DOCKED',
  'PROJECT_SCOPED_SPATIAL_LAYOUT_SNAPSHOT',
  'RESIZE_END_SAFE_RESET_LAST_STABLE_RESTORE',
  'SAFE_DEGRADATION_ON_INVALID_LAYOUT_OR_VIEWPORT_SHRINK',
]);

const LOCKED_COMMIT_POINT_IDS = Object.freeze([
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

function readText(relativePath) {
  return fs.readFileSync(path.resolve(relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function asCheck(status, measured, note) {
  return { status, measured, note };
}

function matchesAll(text, patterns) {
  return patterns.every((pattern) => pattern.test(text));
}

function evaluatePhase05MovableSideContainersBaselineState(input = {}) {
  const forceNegative = Boolean(input.forceNegative);

  try {
    const source = readText(EDITOR_SOURCE_PATH);
    const phase04Packet = readJson(PHASE04_PACKET_PATH);

    const phase04DesignLayerBaselinePass = Boolean(
      phase04Packet?.artifactId === 'PHASE04_DESIGN_LAYER_BASELINE_PACKET_V1'
      && phase04Packet?.status === 'PASS'
      && phase04Packet?.phase04BaselineStatus === 'PASS'
      && phase04Packet?.proof?.noFalsePhase04DesignBaselineGreenTrue === true
    );

    const leftAndRightResizeHandlesPresent = matchesAll(source, [
      /if \(sidebar && sidebarResizer\) \{/,
      /sidebarResizer\.addEventListener\('pointerdown', \(event\) => \{/,
      /startSpatialResize\('left', event\);/,
      /if \(rightSidebar && rightSidebarResizer\) \{/,
      /rightSidebarResizer\.addEventListener\('pointerdown', \(event\) => \{/,
      /startSpatialResize\('right', event\);/,
    ]);

    const projectScopedSpatialLayoutStorage = matchesAll(source, [
      /const SPATIAL_LAYOUT_STORAGE_KEY_PREFIX = 'yalkenSpatialLayout';/,
      /function getSpatialLayoutStorageKey\(projectId = currentProjectId\)/,
      /\? `\$\{SPATIAL_LAYOUT_STORAGE_KEY_PREFIX\}:\$\{normalizedProjectId\}`/,
      /localStorage\.setItem\(getSpatialLayoutStorageKey\(normalizedProjectId\), JSON\.stringify\(nextState\)\);/,
    ]);

    const commitPointPersistenceOnly = matchesAll(source, [
      /function updateSpatialResizeFromClientX\(clientX\) \{[\s\S]*?applySpatialLayoutState\(nextState, \{ persist: false, projectId: currentProjectId \}\);[\s\S]*?\}/,
      /function stopSpatialResize\(\) \{[\s\S]*?commitSpatialLayoutState\(currentProjectId\);[\s\S]*?\}/,
    ]);

    const safeResetPersistsBaseline = matchesAll(source, [
      /function performSafeResetShell\(\)/,
      /applySpatialLayoutState\(getSpatialLayoutBaselineForViewport\(\), \{\s*persist: true,\s*projectId: currentProjectId,\s*\}\);/,
    ]);

    const restoreLastStableRestoresSnapshot = matchesAll(source, [
      /function performRestoreLastStableShell\(\)/,
      /restoreSpatialLayoutState\(currentProjectId\);/,
    ]);

    const invalidViewportDegradesToBaseline = matchesAll(source, [
      /function normalizeSpatialLayoutState\(rawState, viewportWidth = getSpatialLayoutViewportWidth\(\)\)/,
      /const fallback = getSpatialLayoutBaselineForViewport\(viewportWidth\);/,
      /if \(!rawState \|\| typeof rawState !== 'object'\) \{\s*return \{ \.\.\.fallback \};\s*\}/,
      /if \(rawState\.version !== SPATIAL_LAYOUT_VERSION\) \{\s*return \{ \.\.\.fallback \};\s*\}/,
    ]);

    const checkStatusById = {
      PHASE04_DESIGN_LAYER_BASELINE_PASS: asCheck(
        phase04DesignLayerBaselinePass ? 'GREEN' : 'OPEN_GAP',
        phase04Packet?.status || 'UNKNOWN',
        phase04DesignLayerBaselinePass ? 'PHASE04_DESIGN_LAYER_BASELINE_PASS' : 'PHASE04_DESIGN_LAYER_BASELINE_NOT_PASS',
      ),
      LEFT_AND_RIGHT_RESIZE_HANDLES_PRESENT: asCheck(
        leftAndRightResizeHandlesPresent ? 'GREEN' : 'OPEN_GAP',
        true,
        leftAndRightResizeHandlesPresent ? 'LEFT_AND_RIGHT_RESIZE_HANDLES_PRESENT' : 'LEFT_AND_RIGHT_RESIZE_HANDLES_MISSING',
      ),
      PROJECT_SCOPED_SPATIAL_LAYOUT_STORAGE: asCheck(
        projectScopedSpatialLayoutStorage ? 'GREEN' : 'OPEN_GAP',
        true,
        projectScopedSpatialLayoutStorage ? 'PROJECT_SCOPED_SPATIAL_LAYOUT_STORAGE' : 'PROJECT_SCOPED_SPATIAL_LAYOUT_STORAGE_MISSING',
      ),
      COMMIT_POINT_PERSISTENCE_ONLY: asCheck(
        commitPointPersistenceOnly ? 'GREEN' : 'OPEN_GAP',
        true,
        commitPointPersistenceOnly ? 'COMMIT_POINT_PERSISTENCE_ONLY' : 'COMMIT_POINT_PERSISTENCE_NOT_ISOLATED',
      ),
      SAFE_RESET_PERSISTS_BASELINE: asCheck(
        safeResetPersistsBaseline ? 'GREEN' : 'OPEN_GAP',
        true,
        safeResetPersistsBaseline ? 'SAFE_RESET_PERSISTS_BASELINE' : 'SAFE_RESET_BASELINE_PERSISTENCE_MISSING',
      ),
      RESTORE_LAST_STABLE_RESTORES_SNAPSHOT: asCheck(
        restoreLastStableRestoresSnapshot ? 'GREEN' : 'OPEN_GAP',
        true,
        restoreLastStableRestoresSnapshot ? 'RESTORE_LAST_STABLE_RESTORES_SNAPSHOT' : 'RESTORE_LAST_STABLE_SNAPSHOT_MISSING',
      ),
      INVALID_VIEWPORT_DEGRADES_TO_BASELINE: asCheck(
        invalidViewportDegradesToBaseline ? 'GREEN' : 'OPEN_GAP',
        true,
        invalidViewportDegradesToBaseline ? 'INVALID_VIEWPORT_DEGRADES_TO_BASELINE' : 'INVALID_VIEWPORT_BASELINE_DEGRADATION_MISSING',
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
        phase05ReadinessStatus: 'HOLD',
        greenCheckIds,
        openGapIds: Array.from(new Set([...openGapIds, 'FORCED_NEGATIVE_PATH'])),
        lockedTargetIds: [...LOCKED_TARGET_IDS],
        lockedCommitPointIds: [...LOCKED_COMMIT_POINT_IDS],
        checkStatusById,
      };
    }

    return {
      ok: openGapIds.length === 0,
      failReason: '',
      overallStatus: openGapIds.length === 0 ? 'PASS' : 'HOLD',
      phase05ReadinessStatus: 'HOLD',
      greenCheckIds,
      openGapIds,
      lockedTargetIds: [...LOCKED_TARGET_IDS],
      lockedCommitPointIds: [...LOCKED_COMMIT_POINT_IDS],
      checkStatusById,
    };
  } catch (error) {
    return {
      ok: false,
      failReason: FAIL_REASON_UNEXPECTED,
      overallStatus: 'HOLD',
      phase05ReadinessStatus: 'UNKNOWN',
      greenCheckIds: [],
      openGapIds: ['PHASE05_MOVABLE_SIDE_CONTAINERS_BASELINE_EVALUATION_ERROR'],
      lockedTargetIds: [...LOCKED_TARGET_IDS],
      lockedCommitPointIds: [...LOCKED_COMMIT_POINT_IDS],
      checkStatusById: {},
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

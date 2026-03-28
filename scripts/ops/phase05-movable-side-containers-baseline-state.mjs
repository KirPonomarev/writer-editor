#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FAIL_REASON_FORCED_NEGATIVE = 'E_PHASE05_MOVABLE_SIDE_CONTAINERS_BASELINE_FORCED_NEGATIVE';
const FAIL_REASON_UNEXPECTED = 'E_PHASE05_MOVABLE_SIDE_CONTAINERS_BASELINE_UNEXPECTED';
const SOURCE_PATH = 'src/renderer/editor.js';

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

function asCheck(status, measured, note) {
  return { status, measured, note };
}

function matchesAll(text, patterns) {
  return patterns.every((pattern) => pattern.test(text));
}

function evaluatePhase05MovableSideContainersBaselineState(input = {}) {
  const forceNegative = Boolean(input.forceNegative);

  try {
    const source = readText(SOURCE_PATH);

    const movableSideContainersPresent = matchesAll(source, [
      /function startSpatialResize\(side, event\)/,
      /window\.addEventListener\('pointermove', handleSpatialResizeMove\);/,
      /window\.addEventListener\('pointerup', stopSpatialResize\);/,
      /sidebarResizer\.addEventListener\('pointerdown', \(event\) => \{/,
      /startSpatialResize\('left', event\);/,
      /rightSidebarResizer\.addEventListener\('pointerdown', \(event\) => \{/,
      /startSpatialResize\('right', event\);/,
    ]);
    const boundedResizePresent = matchesAll(source, [
      /function clampSpatialSidebarWidth\(value, min, max\)/,
      /clampSpatialSidebarWidth\(/,
      /constraints\.leftMin/,
      /constraints\.leftMax/,
      /constraints\.rightMin/,
      /constraints\.rightMax/,
    ]);
    const commitOnResizeEndPresent = matchesAll(source, [
      /function stopSpatialResize\(\)/,
      /commitSpatialLayoutState\(currentProjectId\);/,
      /scheduleLayoutRefresh\(\);/,
    ]);
    const projectScopedSnapshotPresent = matchesAll(source, [
      /function getSpatialLayoutStorageKey\(projectId = currentProjectId\)/,
      /const SPATIAL_LAYOUT_STORAGE_KEY_PREFIX = 'yalkenSpatialLayout';/,
      /\? `\$\{SPATIAL_LAYOUT_STORAGE_KEY_PREFIX\}:\$\{normalizedProjectId\}`/,
      /localStorage\.setItem\(getSpatialLayoutStorageKey\(normalizedProjectId\), JSON\.stringify\(nextState\)\);/,
    ]);
    const editorRootRemainsDocked = !/mainContentResizer/.test(source)
      && !/editorPaneResizer/.test(source)
      && !/floatingEditor/.test(source);

    const checkStatusById = {
      MOVABLE_SIDE_CONTAINERS_PRESENT: asCheck(
        movableSideContainersPresent ? 'GREEN' : 'OPEN_GAP',
        true,
        movableSideContainersPresent ? 'MOVABLE_SIDE_CONTAINERS_PRESENT' : 'MOVABLE_SIDE_CONTAINERS_MISSING',
      ),
      BOUNDED_RESIZE_PRESENT: asCheck(
        boundedResizePresent ? 'GREEN' : 'OPEN_GAP',
        true,
        boundedResizePresent ? 'BOUNDED_RESIZE_PRESENT' : 'BOUNDED_RESIZE_MISSING',
      ),
      COMMIT_ON_RESIZE_END_PRESENT: asCheck(
        commitOnResizeEndPresent ? 'GREEN' : 'OPEN_GAP',
        true,
        commitOnResizeEndPresent ? 'COMMIT_ON_RESIZE_END_PRESENT' : 'COMMIT_ON_RESIZE_END_MISSING',
      ),
      PROJECT_SCOPED_SPATIAL_SNAPSHOT_PRESENT: asCheck(
        projectScopedSnapshotPresent ? 'GREEN' : 'OPEN_GAP',
        true,
        projectScopedSnapshotPresent ? 'PROJECT_SCOPED_SPATIAL_SNAPSHOT_PRESENT' : 'PROJECT_SCOPED_SPATIAL_SNAPSHOT_MISSING',
      ),
      EDITOR_ROOT_REMAINS_DOCKED: asCheck(
        editorRootRemainsDocked ? 'GREEN' : 'OPEN_GAP',
        true,
        editorRootRemainsDocked ? 'EDITOR_ROOT_REMAINS_DOCKED' : 'EDITOR_ROOT_DOCKED_INVARIANT_BROKEN',
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

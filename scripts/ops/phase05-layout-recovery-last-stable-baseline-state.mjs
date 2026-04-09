#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createLayoutSnapshot, createRepoGroundedDesignOsBrowserRuntime } from '../../src/renderer/design-os/index.mjs';
import { evaluatePhase05MovableSideContainersBaselineState } from './phase05-movable-side-containers-baseline-state.mjs';

const FAIL_REASON_FORCED_NEGATIVE = 'E_PHASE05_LAYOUT_RECOVERY_LAST_STABLE_BASELINE_FORCED_NEGATIVE';
const FAIL_REASON_UNEXPECTED = 'E_PHASE05_LAYOUT_RECOVERY_LAST_STABLE_BASELINE_UNEXPECTED';
const EDITOR_SOURCE_PATH = 'src/renderer/editor.js';

const LOCKED_TARGET_IDS = Object.freeze([
  'CURRENT_SPATIAL_LAYOUT_SNAPSHOT',
  'LAST_STABLE_SPATIAL_LAYOUT_SNAPSHOT',
  'PROJECT_SCOPED_SPATIAL_LAYOUT_STORAGE',
  'RECOVERY_ORDER_CURRENT_LAST_STABLE_BASELINE',
  'SAFE_RESET_REBUILDS_BOTH_SNAPSHOTS',
  'RESTORE_LAST_STABLE_IGNORES_CURRENT_STORAGE',
  'INVALID_LAYOUT_FALLBACK_TO_BASELINE',
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

function asCheck(status, measured, note) {
  return { status, measured, note };
}

function matchesAll(text, patterns) {
  return patterns.every((pattern) => pattern.test(text));
}

function createRuntime() {
  return createRepoGroundedDesignOsBrowserRuntime({
    productTruth: {
      project_id: 'phase05-layout-recovery-last-stable-baseline',
      scenes: { s1: 'phase05-layout-recovery-last-stable-baseline' },
      active_scene_id: 's1',
    },
  }).runtime;
}

function isLayoutEqual(left, right) {
  return Boolean(left)
    && Boolean(right)
    && left.left_width === right.left_width
    && left.right_width === right.right_width
    && left.bottom_height === right.bottom_height
    && left.editor_root === right.editor_root
    && left.viewport_width === right.viewport_width
    && left.viewport_height === right.viewport_height
    && left.shell_mode === right.shell_mode;
}

function evaluatePhase05LayoutRecoveryLastStableBaselineState(input = {}) {
  const forceNegative = Boolean(input.forceNegative);

  try {
    const editorSource = readText(EDITOR_SOURCE_PATH);
    const movableBaselineState = evaluatePhase05MovableSideContainersBaselineState({});
    const context = {
      shell_mode: 'CALM_DOCKED',
      profile: 'BASELINE',
      workspace: 'WRITE',
      platform: 'macos',
      accessibility: 'default',
    };

    const phase05BaselinePass = Boolean(
      movableBaselineState?.ok === true
      && movableBaselineState?.overallStatus === 'PASS'
      && movableBaselineState?.phase05ReadinessStatus === 'HOLD'
    );

    const projectScopedPersistence = matchesAll(editorSource, [
      /function getSpatialLayoutStorageKey\(projectId = currentProjectId\)/,
      /localStorage\.setItem\(getSpatialLayoutStorageKey\(normalizedProjectId\), JSON\.stringify\(nextState\)\);/,
      /const normalizedProjectId = normalizeProjectId\(projectId\);/,
    ]);

    const runtimeForStorage = createRuntime();
    const storageSnapshot = runtimeForStorage.getSnapshot();
    const lastStableStorageKeyPresent = Boolean(
      storageSnapshot
      && storageSnapshot.current_layout
      && storageSnapshot.last_stable_layout
      && storageSnapshot.baseline_layout
    );

    const recoveryOrderExplicit = Boolean(
      typeof runtimeForStorage.safeReset === 'function'
      && typeof runtimeForStorage.restoreLastStable === 'function'
      && storageSnapshot?.current_layout
      && storageSnapshot?.last_stable_layout
      && storageSnapshot?.baseline_layout
    );

    const runtimeForSafeReset = createRuntime();
    runtimeForSafeReset.commit(context, {
      commit_point: 'resize_end',
      layout_patch: {
        left_width: 330,
        right_width: 305,
        viewport_width: 1440,
        viewport_height: 900,
      },
    });
    const safeResetBaseline = runtimeForSafeReset.safeReset();
    const safeResetSnapshot = runtimeForSafeReset.getSnapshot();
    const safeResetRebuildsBothSnapshots = isLayoutEqual(safeResetBaseline, safeResetSnapshot.baseline_layout)
      && isLayoutEqual(safeResetSnapshot.current_layout, safeResetSnapshot.baseline_layout)
      && isLayoutEqual(safeResetSnapshot.last_stable_layout, safeResetSnapshot.baseline_layout);

    const runtimeForRestore = createRuntime();
    const committedPreview = runtimeForRestore.commit(context, {
      commit_point: 'resize_end',
      layout_patch: {
        left_width: 332,
        right_width: 304,
        viewport_width: 1440,
        viewport_height: 900,
      },
    });
    const storedLastStable = runtimeForRestore.getSnapshot().last_stable_layout;
    runtimeForRestore.runtimeState.current_layout = createLayoutSnapshot(runtimeForRestore.getSnapshot().baseline_layout);
    const restoredLayout = runtimeForRestore.restoreLastStable();
    const restoreSnapshot = runtimeForRestore.getSnapshot();
    const restoreLastStableUsesLastStableSnapshot = isLayoutEqual(storedLastStable, committedPreview.layout)
      && isLayoutEqual(restoredLayout, storedLastStable)
      && isLayoutEqual(restoreSnapshot.current_layout, storedLastStable);

    const runtimeForInvalidLayout = createRuntime();
    const invalidPreview = runtimeForInvalidLayout.preview(context, {
      layout_patch: {
        left_width: 520,
        right_width: 520,
        viewport_width: 1200,
        viewport_height: 900,
      },
    });
    runtimeForInvalidLayout.commit(context, {
      commit_point: 'resize_end',
      layout_patch: {
        left_width: 520,
        right_width: 520,
        viewport_width: 1200,
        viewport_height: 900,
      },
    });
    const invalidSnapshot = runtimeForInvalidLayout.getSnapshot();
    const invalidLayoutFallsBackToBaseline = invalidPreview.degraded_to_baseline === true
      && isLayoutEqual(invalidSnapshot.current_layout, invalidSnapshot.baseline_layout);

    const checkStatusById = {
      PHASE05_BASELINE_PASS: asCheck(
        phase05BaselinePass ? 'GREEN' : 'OPEN_GAP',
        movableBaselineState?.overallStatus || 'UNKNOWN',
        phase05BaselinePass ? 'PHASE05_BASELINE_PASS' : 'PHASE05_BASELINE_NOT_PASS',
      ),
      LAST_STABLE_STORAGE_KEY_PRESENT: asCheck(
        lastStableStorageKeyPresent ? 'GREEN' : 'OPEN_GAP',
        true,
        lastStableStorageKeyPresent ? 'LAST_STABLE_STORAGE_KEY_PRESENT' : 'LAST_STABLE_STORAGE_KEY_MISSING',
      ),
      PROJECT_SCOPED_PERSISTENCE: asCheck(
        projectScopedPersistence ? 'GREEN' : 'OPEN_GAP',
        true,
        projectScopedPersistence ? 'PROJECT_SCOPED_PERSISTENCE' : 'PROJECT_SCOPED_PERSISTENCE_MISSING',
      ),
      RECOVERY_ORDER_EXPLICIT: asCheck(
        recoveryOrderExplicit ? 'GREEN' : 'OPEN_GAP',
        true,
        recoveryOrderExplicit ? 'RECOVERY_ORDER_EXPLICIT' : 'RECOVERY_ORDER_NOT_EXPLICIT',
      ),
      SAFE_RESET_REBUILDS_BOTH_SNAPSHOTS: asCheck(
        safeResetRebuildsBothSnapshots ? 'GREEN' : 'OPEN_GAP',
        true,
        safeResetRebuildsBothSnapshots ? 'SAFE_RESET_REBUILDS_BOTH_SNAPSHOTS' : 'SAFE_RESET_REBUILD_MISSING',
      ),
      RESTORE_LAST_STABLE_USES_LAST_STABLE_SNAPSHOT: asCheck(
        restoreLastStableUsesLastStableSnapshot ? 'GREEN' : 'OPEN_GAP',
        true,
        restoreLastStableUsesLastStableSnapshot ? 'RESTORE_LAST_STABLE_USES_LAST_STABLE_SNAPSHOT' : 'RESTORE_LAST_STABLE_SNAPSHOT_MISSING',
      ),
      INVALID_LAYOUT_FALLS_BACK_TO_BASELINE: asCheck(
        invalidLayoutFallsBackToBaseline ? 'GREEN' : 'OPEN_GAP',
        true,
        invalidLayoutFallsBackToBaseline ? 'INVALID_LAYOUT_FALLS_BACK_TO_BASELINE' : 'INVALID_LAYOUT_BASELINE_FALLBACK_MISSING',
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
      openGapIds: ['PHASE05_LAYOUT_RECOVERY_LAST_STABLE_BASELINE_EVALUATION_ERROR'],
      lockedTargetIds: [...LOCKED_TARGET_IDS],
      lockedCommitPointIds: [...LOCKED_COMMIT_POINT_IDS],
      checkStatusById: {},
      errorMessage: error && typeof error.message === 'string' ? error.message : 'UNKNOWN',
    };
  }
}

function runCli() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluatePhase05LayoutRecoveryLastStableBaselineState({ forceNegative: args.forceNegative });

  if (args.json) {
    console.log(JSON.stringify(state, null, 2));
  } else {
    console.log(`PHASE05_LAYOUT_RECOVERY_LAST_STABLE_BASELINE_OK=${state.ok ? 1 : 0}`);
    console.log(`PHASE05_LAYOUT_RECOVERY_LAST_STABLE_BASELINE_OVERALL_STATUS=${state.overallStatus}`);
    console.log(`PHASE05_LAYOUT_RECOVERY_LAST_STABLE_BASELINE_READINESS_STATUS=${state.phase05ReadinessStatus}`);
    console.log(`PHASE05_LAYOUT_RECOVERY_LAST_STABLE_BASELINE_OPEN_GAP_IDS=${state.openGapIds.join(',')}`);
    console.log(`PHASE05_LAYOUT_RECOVERY_LAST_STABLE_BASELINE_FAIL_REASON=${state.failReason}`);
  }

  process.exit(state.ok ? 0 : 1);
}

const selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(selfPath)) {
  runCli();
}

export { evaluatePhase05LayoutRecoveryLastStableBaselineState };

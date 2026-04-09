#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createLayoutSnapshot, createRepoGroundedDesignOsBrowserRuntime } from '../../src/renderer/design-os/index.mjs';
import { evaluatePhase05LayoutRecoveryLastStableBaselineState } from './phase05-layout-recovery-last-stable-baseline-state.mjs';

const FAIL_REASON_FORCED_NEGATIVE = 'E_PHASE05_INVALID_LAYOUT_AND_MISSING_MONITOR_RECOVERY_BASELINE_FORCED_NEGATIVE';
const FAIL_REASON_UNEXPECTED = 'E_PHASE05_INVALID_LAYOUT_AND_MISSING_MONITOR_RECOVERY_BASELINE_UNEXPECTED';
const EDITOR_SOURCE_PATH = 'src/renderer/editor.js';

const LOCKED_TARGET_IDS = Object.freeze([
  'SPATIAL_VIEWPORT_ENVELOPE_METADATA',
  'INVALID_LAYOUT_AND_MISSING_MONITOR_RECOVERY',
  'CURRENT_TO_LAST_STABLE_RECOVERY_ORDER',
  'LAST_STABLE_VALID_FOR_CURRENT_ENVELOPE',
  'LAST_STABLE_INVALID_OR_MISSING_MONITOR_FALLS_BACK_TO_BASELINE',
  'PROJECT_SCOPED_SPATIAL_LAYOUT_SNAPSHOT',
  'EDITOR_ROOT_FIXED_DOCKED',
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
      project_id: 'phase05-invalid-layout-and-missing-monitor-recovery',
      scenes: { s1: 'phase05-invalid-layout-and-missing-monitor-recovery' },
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

function evaluatePhase05InvalidLayoutAndMissingMonitorRecoveryBaselineState(input = {}) {
  const forceNegative = Boolean(input.forceNegative);

  try {
    const editorSource = readText(EDITOR_SOURCE_PATH);
    const layoutRecoveryState = evaluatePhase05LayoutRecoveryLastStableBaselineState({});
    const context = {
      shell_mode: 'CALM_DOCKED',
      profile: 'BASELINE',
      workspace: 'WRITE',
      platform: 'macos',
      accessibility: 'default',
    };

    const phase05LayoutRecoveryLastStablePass = Boolean(
      layoutRecoveryState?.ok === true
      && layoutRecoveryState?.overallStatus === 'PASS'
      && layoutRecoveryState?.phase05ReadinessStatus === 'HOLD'
    );

    const runtimeForEnvelope = createRuntime();
    const envelopeSnapshot = runtimeForEnvelope.getSnapshot();
    const viewportEnvelopeMetadataPresent = ['baseline_layout', 'current_layout', 'last_stable_layout'].every((key) => {
      const layout = envelopeSnapshot?.[key];
      return layout
        && Object.prototype.hasOwnProperty.call(layout, 'viewport_width')
        && Object.prototype.hasOwnProperty.call(layout, 'viewport_height')
        && Object.prototype.hasOwnProperty.call(layout, 'shell_mode');
    });

    const runtimeForEnvelopeShrink = createRuntime();
    const envelopeShrinkPreview = runtimeForEnvelopeShrink.preview(context, {
      layout_patch: {
        left_width: 320,
        right_width: 320,
        viewport_width: 900,
        viewport_height: 900,
      },
    });
    const missingMonitorDetectionPresent = envelopeShrinkPreview.degraded_to_baseline === true;

    const runtimeForInvalidCommit = createRuntime();
    const invalidPreview = runtimeForInvalidCommit.preview(context, {
      layout_patch: {
        left_width: 520,
        right_width: 520,
        viewport_width: 1200,
        viewport_height: 900,
      },
    });
    runtimeForInvalidCommit.commit(context, {
      commit_point: 'resize_end',
      layout_patch: {
        left_width: 520,
        right_width: 520,
        viewport_width: 1200,
        viewport_height: 900,
      },
    });
    const invalidSnapshot = runtimeForInvalidCommit.getSnapshot();
    const invalidLayoutAndMissingMonitorRecoveryExplicit = invalidPreview.degraded_to_baseline === true
      && isLayoutEqual(invalidSnapshot.current_layout, invalidSnapshot.baseline_layout);

    const runtimeForLastStableFallback = createRuntime();
    const initialSnapshot = runtimeForLastStableFallback.getSnapshot();
    const lastStableFallbackToBaselineExplicit = isLayoutEqual(initialSnapshot.last_stable_layout, initialSnapshot.baseline_layout)
      && isLayoutEqual(runtimeForLastStableFallback.safeReset(), initialSnapshot.baseline_layout)
      && isLayoutEqual(runtimeForLastStableFallback.getSnapshot().last_stable_layout, runtimeForLastStableFallback.getSnapshot().baseline_layout);

    const runtimeForRecoveryOrder = createRuntime();
    runtimeForRecoveryOrder.commit(context, {
      commit_point: 'resize_end',
      layout_patch: {
        left_width: 332,
        right_width: 304,
        viewport_width: 1440,
        viewport_height: 900,
      },
    });
    const lastStableBeforeInvalid = runtimeForRecoveryOrder.getSnapshot().last_stable_layout;
    runtimeForRecoveryOrder.commit(context, {
      commit_point: 'resize_end',
      layout_patch: {
        left_width: 520,
        right_width: 520,
        viewport_width: 1200,
        viewport_height: 900,
      },
    });
    const afterInvalidCommit = runtimeForRecoveryOrder.getSnapshot();
    const restoredAfterInvalid = runtimeForRecoveryOrder.restoreLastStable();
    const recoveryOrderDeterministic = isLayoutEqual(afterInvalidCommit.current_layout, afterInvalidCommit.baseline_layout)
      && isLayoutEqual(afterInvalidCommit.last_stable_layout, lastStableBeforeInvalid)
      && isLayoutEqual(restoredAfterInvalid, lastStableBeforeInvalid);

    const runtimeForDockedInvariant = createRuntime();
    const floatingEditorPreview = runtimeForDockedInvariant.preview(context, {
      layout_patch: {
        editor_root: 'floating',
      },
    });
    const editorRootFixedDockedStill = floatingEditorPreview.degraded_to_baseline === true
      && floatingEditorPreview.layout.editor_root === 'docked';

    const projectScopedSpatialLayoutSnapshotStill = matchesAll(editorSource, [
      /function getSpatialLayoutStorageKey\(projectId = currentProjectId\)/,
      /\? `\$\{SPATIAL_LAYOUT_STORAGE_KEY_PREFIX\}:\$\{normalizedProjectId\}`/,
      /restoreSpatialLayoutState\(projectId = currentProjectId\)/,
    ]);

    const checkStatusById = {
      PHASE05_LAYOUT_RECOVERY_LAST_STABLE_PASS: asCheck(
        phase05LayoutRecoveryLastStablePass ? 'GREEN' : 'OPEN_GAP',
        layoutRecoveryState?.overallStatus || 'UNKNOWN',
        phase05LayoutRecoveryLastStablePass ? 'PHASE05_LAYOUT_RECOVERY_LAST_STABLE_PASS' : 'PHASE05_LAYOUT_RECOVERY_LAST_STABLE_NOT_PASS',
      ),
      VIEWPORT_ENVELOPE_METADATA_PRESENT: asCheck(
        viewportEnvelopeMetadataPresent ? 'GREEN' : 'OPEN_GAP',
        true,
        viewportEnvelopeMetadataPresent ? 'VIEWPORT_ENVELOPE_METADATA_PRESENT' : 'VIEWPORT_ENVELOPE_METADATA_MISSING',
      ),
      MISSING_MONITOR_DETECTION_PRESENT: asCheck(
        missingMonitorDetectionPresent ? 'GREEN' : 'OPEN_GAP',
        envelopeShrinkPreview.degraded_to_baseline === true,
        missingMonitorDetectionPresent ? 'MISSING_MONITOR_DETECTION_PRESENT' : 'MISSING_MONITOR_DETECTION_MISSING',
      ),
      INVALID_LAYOUT_AND_MISSING_MONITOR_RECOVERY_EXPLICIT: asCheck(
        invalidLayoutAndMissingMonitorRecoveryExplicit ? 'GREEN' : 'OPEN_GAP',
        invalidPreview.degraded_to_baseline === true,
        invalidLayoutAndMissingMonitorRecoveryExplicit ? 'INVALID_LAYOUT_AND_MISSING_MONITOR_RECOVERY_EXPLICIT' : 'INVALID_LAYOUT_AND_MISSING_MONITOR_RECOVERY_MISSING',
      ),
      LAST_STABLE_FALLBACK_TO_BASELINE_EXPLICIT: asCheck(
        lastStableFallbackToBaselineExplicit ? 'GREEN' : 'OPEN_GAP',
        true,
        lastStableFallbackToBaselineExplicit ? 'LAST_STABLE_FALLBACK_TO_BASELINE_EXPLICIT' : 'LAST_STABLE_BASELINE_FALLBACK_MISSING',
      ),
      RECOVERY_ORDER_DETERMINISTIC: asCheck(
        recoveryOrderDeterministic ? 'GREEN' : 'OPEN_GAP',
        true,
        recoveryOrderDeterministic ? 'RECOVERY_ORDER_DETERMINISTIC' : 'RECOVERY_ORDER_NONDETERMINISTIC',
      ),
      EDITOR_ROOT_FIXED_DOCKED_STILL: asCheck(
        editorRootFixedDockedStill ? 'GREEN' : 'OPEN_GAP',
        floatingEditorPreview.layout.editor_root,
        editorRootFixedDockedStill ? 'EDITOR_ROOT_FIXED_DOCKED_STILL' : 'EDITOR_ROOT_DOCKED_INVARIANT_BROKEN',
      ),
      PROJECT_SCOPED_SPATIAL_LAYOUT_SNAPSHOT_STILL: asCheck(
        projectScopedSpatialLayoutSnapshotStill ? 'GREEN' : 'OPEN_GAP',
        true,
        projectScopedSpatialLayoutSnapshotStill ? 'PROJECT_SCOPED_SPATIAL_LAYOUT_SNAPSHOT_STILL' : 'PROJECT_SCOPED_SPATIAL_LAYOUT_SNAPSHOT_MISSING',
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
      openGapIds: ['PHASE05_INVALID_LAYOUT_AND_MISSING_MONITOR_RECOVERY_BASELINE_EVALUATION_ERROR'],
      lockedTargetIds: [...LOCKED_TARGET_IDS],
      lockedCommitPointIds: [...LOCKED_COMMIT_POINT_IDS],
      checkStatusById: {},
      errorMessage: error && typeof error.message === 'string' ? error.message : 'UNKNOWN',
    };
  }
}

function runCli() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluatePhase05InvalidLayoutAndMissingMonitorRecoveryBaselineState({ forceNegative: args.forceNegative });

  if (args.json) {
    console.log(JSON.stringify(state, null, 2));
  } else {
    console.log(`PHASE05_INVALID_LAYOUT_AND_MISSING_MONITOR_RECOVERY_BASELINE_OK=${state.ok ? 1 : 0}`);
    console.log(`PHASE05_INVALID_LAYOUT_AND_MISSING_MONITOR_RECOVERY_BASELINE_OVERALL_STATUS=${state.overallStatus}`);
    console.log(`PHASE05_INVALID_LAYOUT_AND_MISSING_MONITOR_RECOVERY_BASELINE_READINESS_STATUS=${state.phase05ReadinessStatus}`);
    console.log(`PHASE05_INVALID_LAYOUT_AND_MISSING_MONITOR_RECOVERY_BASELINE_OPEN_GAP_IDS=${state.openGapIds.join(',')}`);
    console.log(`PHASE05_INVALID_LAYOUT_AND_MISSING_MONITOR_RECOVERY_BASELINE_FAIL_REASON=${state.failReason}`);
  }

  process.exit(state.ok ? 0 : 1);
}

const selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(selfPath)) {
  runCli();
}

export { evaluatePhase05InvalidLayoutAndMissingMonitorRecoveryBaselineState };

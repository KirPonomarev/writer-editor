#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { evaluatePhase05MovableSideContainersBaselineState } from './phase05-movable-side-containers-baseline-state.mjs';

const FAIL_REASON_FORCED_NEGATIVE = 'E_PHASE05_LAYOUT_RECOVERY_LAST_STABLE_BASELINE_FORCED_NEGATIVE';
const FAIL_REASON_UNEXPECTED = 'E_PHASE05_LAYOUT_RECOVERY_LAST_STABLE_BASELINE_UNEXPECTED';
const PACKET_PATH = 'docs/OPS/STATUS/PHASE05_LAYOUT_RECOVERY_LAST_STABLE_BASELINE_V1.json';
const EDITOR_PATH = 'src/renderer/editor.js';

const EXPECTED_LOCKED_TARGET_IDS = Object.freeze([
  'CURRENT_SPATIAL_LAYOUT_SNAPSHOT',
  'LAST_STABLE_SPATIAL_LAYOUT_SNAPSHOT',
  'PROJECT_SCOPED_SPATIAL_LAYOUT_STORAGE',
  'RECOVERY_ORDER_CURRENT_LAST_STABLE_BASELINE',
  'SAFE_RESET_REBUILDS_BOTH_SNAPSHOTS',
  'RESTORE_LAST_STABLE_IGNORES_CURRENT_STORAGE',
  'INVALID_LAYOUT_FALLBACK_TO_BASELINE',
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

function arraysEqual(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

function matchesAll(text, patterns) {
  return patterns.every((pattern) => pattern.test(text));
}

function evaluatePhase05LayoutRecoveryLastStableBaselineState(input = {}) {
  const forceNegative = Boolean(input.forceNegative);

  try {
    const baselineState = evaluatePhase05MovableSideContainersBaselineState({});
    const packetExists = fs.existsSync(path.resolve(PACKET_PATH));
    const packet = packetExists ? readJson(PACKET_PATH) : null;
    const editorText = readText(EDITOR_PATH);

    const baselinePass = baselineState.overallStatus === 'PASS' && baselineState.phase05ReadinessStatus === 'HOLD';
    const packetPass = packet?.status === 'PASS';
    const readinessHold = packet?.phase05ReadinessStatus === 'HOLD';
    const sourceBaselineMatches = packet?.sourcePhase05MovableSideContainersBaseline === 'phase05-movable-side-containers-baseline-state.mjs';
    const lockedTargetIdsMatch = arraysEqual(packet?.lockedTargetIds || [], EXPECTED_LOCKED_TARGET_IDS);
    const lockedCommitPointIdsMatch = arraysEqual(packet?.lockedCommitPointIds || [], EXPECTED_LOCKED_COMMIT_POINT_IDS);

    const lastStableStorageKeyPresent = matchesAll(editorText, [
      /const SPATIAL_LAYOUT_LAST_STABLE_STORAGE_KEY_PREFIX = 'yalkenSpatialLayoutLastStable';/,
      /function getSpatialLastStableLayoutStorageKey\(projectId = currentProjectId\)/,
      /function readSpatialLastStableLayoutState\(projectId = currentProjectId\)/,
      /function persistSpatialLastStableLayoutState\(state, projectId = currentProjectId\)/,
    ]);
    const projectScopedPersistence = matchesAll(editorText, [
      /getSpatialLayoutStorageKey\(projectId = currentProjectId\)/,
      /getSpatialLastStableLayoutStorageKey\(projectId = currentProjectId\)/,
      /keysToRemove\.add\(getSpatialLayoutStorageKey\(normalizedProjectId\)\);/,
      /keysToRemove\.add\(getSpatialLastStableLayoutStorageKey\(normalizedProjectId\)\);/,
      /currentProjectId/,
    ]);
    const recoveryOrderExplicit = matchesAll(editorText, [
      /function recoverSpatialLayoutState\(projectId = currentProjectId\)/,
      /rawState: readSpatialLayoutState\(normalizedProjectId\),\s+source: 'stored-current'/s,
      /rawState: readSpatialLastStableLayoutState\(normalizedProjectId\),\s+source: 'last-stable'/s,
      /if \(resolvedCandidate\.wasValid\) \{\s+return resolvedCandidate;\s+\}/s,
      /source: 'baseline',\s+\};/s,
    ]);
    const safeResetRebuildsBothSnapshots = matchesAll(editorText, [
      /function performSafeResetShell\(\)/,
      /applySpatialLayoutState\(getSpatialLayoutBaselineForViewport\(\), \{/,
      /commitSpatialLayoutState\(currentProjectId\);/,
      /persistSpatialLayoutState\(committedState, projectId\);/,
      /persistSpatialLastStableLayoutState\(committedState, projectId\);/,
    ]);
    const restoreLastStableUsesLastStableSnapshot = matchesAll(editorText, [
      /function restoreLastStableSpatialLayoutState\(projectId = currentProjectId\)/,
      /const storedState = readSpatialLastStableLayoutState\(projectId\);/,
      /const stateToApply = resolvedState\.wasValid/,
      /restoreLastStableSpatialLayoutState\(currentProjectId\);/,
    ]);
    const invalidLayoutFallsBackToBaseline = matchesAll(editorText, [
      /function recoverSpatialLayoutState\(projectId = currentProjectId\)/,
      /readSpatialLastStableLayoutState\(normalizedProjectId\)/,
      /getSpatialLayoutBaselineForViewport\(viewportWidth, normalizedProjectId\)/,
      /function updateSpatialLayoutForViewportChange\(\)/,
    ]);

    const checkStatusById = {
      PHASE05_BASELINE_PASS: asCheck(baselinePass ? 'GREEN' : 'OPEN_GAP', true, baselinePass ? 'PHASE05_BASELINE_PASS' : 'PHASE05_BASELINE_NOT_PASS'),
      PACKET_PRESENT: asCheck(packetExists ? 'GREEN' : 'OPEN_GAP', true, packetExists ? 'PACKET_PRESENT' : 'PACKET_MISSING'),
      PACKET_PASS: asCheck(packetPass ? 'GREEN' : 'OPEN_GAP', true, packetPass ? 'PACKET_PASS' : 'PACKET_NOT_PASS'),
      READINESS_HOLD: asCheck(readinessHold ? 'GREEN' : 'OPEN_GAP', true, readinessHold ? 'READINESS_HOLD' : 'READINESS_FALSE_GREEN'),
      SOURCE_BASELINE_MATCH: asCheck(sourceBaselineMatches ? 'GREEN' : 'OPEN_GAP', true, sourceBaselineMatches ? 'SOURCE_BASELINE_MATCH' : 'SOURCE_BASELINE_DRIFT'),
      LOCKED_TARGET_IDS_MATCH: asCheck(lockedTargetIdsMatch ? 'GREEN' : 'OPEN_GAP', true, lockedTargetIdsMatch ? 'LOCKED_TARGET_IDS_MATCH' : 'LOCKED_TARGET_IDS_DRIFT'),
      LOCKED_COMMIT_POINT_IDS_MATCH: asCheck(lockedCommitPointIdsMatch ? 'GREEN' : 'OPEN_GAP', true, lockedCommitPointIdsMatch ? 'LOCKED_COMMIT_POINT_IDS_MATCH' : 'LOCKED_COMMIT_POINT_IDS_DRIFT'),
      LAST_STABLE_STORAGE_KEY_PRESENT: asCheck(lastStableStorageKeyPresent ? 'GREEN' : 'OPEN_GAP', true, lastStableStorageKeyPresent ? 'LAST_STABLE_STORAGE_KEY_PRESENT' : 'LAST_STABLE_STORAGE_KEY_MISSING'),
      PROJECT_SCOPED_PERSISTENCE: asCheck(projectScopedPersistence ? 'GREEN' : 'OPEN_GAP', true, projectScopedPersistence ? 'PROJECT_SCOPED_PERSISTENCE' : 'PROJECT_SCOPED_PERSISTENCE_MISSING'),
      RECOVERY_ORDER_EXPLICIT: asCheck(recoveryOrderExplicit ? 'GREEN' : 'OPEN_GAP', true, recoveryOrderExplicit ? 'RECOVERY_ORDER_EXPLICIT' : 'RECOVERY_ORDER_MISSING'),
      SAFE_RESET_REBUILDS_BOTH_SNAPSHOTS: asCheck(safeResetRebuildsBothSnapshots ? 'GREEN' : 'OPEN_GAP', true, safeResetRebuildsBothSnapshots ? 'SAFE_RESET_REBUILDS_BOTH_SNAPSHOTS' : 'SAFE_RESET_REBUILDS_BOTH_SNAPSHOTS_MISSING'),
      RESTORE_LAST_STABLE_USES_LAST_STABLE_SNAPSHOT: asCheck(restoreLastStableUsesLastStableSnapshot ? 'GREEN' : 'OPEN_GAP', true, restoreLastStableUsesLastStableSnapshot ? 'RESTORE_LAST_STABLE_USES_LAST_STABLE_SNAPSHOT' : 'RESTORE_LAST_STABLE_USES_LAST_STABLE_SNAPSHOT_MISSING'),
      INVALID_LAYOUT_FALLS_BACK_TO_BASELINE: asCheck(invalidLayoutFallsBackToBaseline ? 'GREEN' : 'OPEN_GAP', true, invalidLayoutFallsBackToBaseline ? 'INVALID_LAYOUT_FALLS_BACK_TO_BASELINE' : 'INVALID_LAYOUT_FALLS_BACK_TO_BASELINE_MISSING'),
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
      openGapIds: ['PHASE05_LAYOUT_RECOVERY_LAST_STABLE_BASELINE_EVALUATION_ERROR'],
      checkStatusById: {},
      lockedTargetIds: [],
      lockedCommitPointIds: [],
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

#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { evaluatePhase05LayoutRecoveryLastStableBaselineState } from './phase05-layout-recovery-last-stable-baseline-state.mjs';

const FAIL_REASON_FORCED_NEGATIVE = 'E_PHASE05_INVALID_LAYOUT_AND_MISSING_MONITOR_RECOVERY_BASELINE_FORCED_NEGATIVE';
const FAIL_REASON_UNEXPECTED = 'E_PHASE05_INVALID_LAYOUT_AND_MISSING_MONITOR_RECOVERY_BASELINE_UNEXPECTED';
const PACKET_PATH = 'docs/OPS/STATUS/PHASE05_INVALID_LAYOUT_AND_MISSING_MONITOR_RECOVERY_BASELINE_V1.json';
const EDITOR_PATH = 'src/renderer/editor.js';

const EXPECTED_LOCKED_TARGET_IDS = Object.freeze([
  'SPATIAL_VIEWPORT_ENVELOPE_METADATA',
  'INVALID_LAYOUT_AND_MISSING_MONITOR_RECOVERY',
  'CURRENT_TO_LAST_STABLE_RECOVERY_ORDER',
  'LAST_STABLE_VALID_FOR_CURRENT_ENVELOPE',
  'LAST_STABLE_INVALID_OR_MISSING_MONITOR_FALLS_BACK_TO_BASELINE',
  'PROJECT_SCOPED_SPATIAL_LAYOUT_SNAPSHOT',
  'EDITOR_ROOT_FIXED_DOCKED',
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

function evaluatePhase05InvalidLayoutAndMissingMonitorRecoveryBaselineState(input = {}) {
  const forceNegative = Boolean(input.forceNegative);

  try {
    const layoutRecoveryState = evaluatePhase05LayoutRecoveryLastStableBaselineState({});
    const packetExists = fs.existsSync(path.resolve(PACKET_PATH));
    const packet = packetExists ? readJson(PACKET_PATH) : null;
    const editorText = readText(EDITOR_PATH);

    const layoutRecoveryPass = layoutRecoveryState.overallStatus === 'PASS'
      && layoutRecoveryState.phase05ReadinessStatus === 'HOLD';
    const packetPass = packet?.status === 'PASS';
    const readinessHold = packet?.phase05ReadinessStatus === 'HOLD';
    const sourceLayoutRecoveryMatches = packet?.sourcePhase05LayoutRecoveryLastStableBaseline === 'phase05-layout-recovery-last-stable-baseline-state.mjs';
    const lockedTargetIdsMatch = arraysEqual(packet?.lockedTargetIds || [], EXPECTED_LOCKED_TARGET_IDS);
    const lockedCommitPointIdsMatch = arraysEqual(packet?.lockedCommitPointIds || [], EXPECTED_LOCKED_COMMIT_POINT_IDS);

    const viewportEnvelopeMetadataPresent = matchesAll(editorText, [
      /function getSpatialLayoutViewportEnvelope\(viewportWidth = getSpatialLayoutViewportWidth\(\)\)/,
      /const viewportEnvelope = getSpatialLayoutViewportEnvelope\(viewportWidth\);/,
      /viewportEnvelope: state\?\.viewportEnvelope && typeof state\.viewportEnvelope === 'object'/,
      /signature: `\$\{mode\}:\$\{normalizedViewportWidth\}`/,
    ]);
    const missingMonitorDetectionPresent = matchesAll(editorText, [
      /const SPATIAL_LAYOUT_MISSING_MONITOR_SHRINK_PX = 320;/,
      /const SPATIAL_LAYOUT_MISSING_MONITOR_SHRINK_RATIO = 0\.25;/,
      /function isSpatialLayoutEnvelopeCompatible\(rawState, viewportWidth = getSpatialLayoutViewportWidth\(\)\)/,
      /return viewportShrinkPx <= missingMonitorThresholdPx;/,
    ]);
    const invalidLayoutAndMissingMonitorRecoveryExplicit = matchesAll(editorText, [
      /function resolveSpatialLayoutRecoveryCandidate\(candidate, viewportWidth = getSpatialLayoutViewportWidth\(\), projectId = currentProjectId\)/,
      /const envelopeCompatible = candidate\.rawState \? isSpatialLayoutEnvelopeCompatible\(candidate\.rawState, viewportWidth\) : false;/,
    ]) && editorText.includes('const recoveryReason = envelopeCompatible')
      && editorText.includes("'missing-monitor'")
      && editorText.includes("recoveryReason: 'invalid-layout'")
      && editorText.includes('wasValid: Boolean(normalizedCandidate.wasValid && envelopeCompatible)');
    const lastStableFallbackToBaselineExplicit = matchesAll(editorText, [
      /function restoreLastStableSpatialLayoutState\(projectId = currentProjectId\)/,
      /const stateToApply = resolvedState\.wasValid\s*\?\s*resolvedState\s*:\s*getSpatialLayoutBaselineForViewport\(viewportWidth, projectId\);/s,
    ]);
    const recoveryOrderDeterministic = matchesAll(editorText, [
      /function recoverSpatialLayoutState\(projectId = currentProjectId\)/,
      /source: 'current'/,
      /source: 'stored-current'/,
      /source: 'last-stable'/,
      /for \(const candidate of candidates\)/,
      /if \(resolvedCandidate\.wasValid\) \{/,
      /source: 'baseline'/,
    ]);
    const editorRootFixedDockedStill = /Editor root остаётся docked/.test(readText('docs/OPS/STATUS/XPLAT_UNIFIED_MASTER_EXECUTION_CONTRACT_v3.13a-final.md'));
    const projectScopedSpatialLayoutSnapshotStill = matchesAll(editorText, [
      /function getSpatialLayoutStorageKey\(projectId = currentProjectId\)/,
      /function getSpatialLastStableLayoutStorageKey\(projectId = currentProjectId\)/,
      /persistSpatialLayoutState\(committedState, projectId\);/,
      /persistSpatialLastStableLayoutState\(committedState, projectId\);/,
    ]);

    const checkStatusById = {
      PHASE05_LAYOUT_RECOVERY_LAST_STABLE_PASS: asCheck(layoutRecoveryPass ? 'GREEN' : 'OPEN_GAP', true, layoutRecoveryPass ? 'PHASE05_LAYOUT_RECOVERY_LAST_STABLE_PASS' : 'PHASE05_LAYOUT_RECOVERY_LAST_STABLE_NOT_PASS'),
      PACKET_PRESENT: asCheck(packetExists ? 'GREEN' : 'OPEN_GAP', true, packetExists ? 'PACKET_PRESENT' : 'PACKET_MISSING'),
      PACKET_PASS: asCheck(packetPass ? 'GREEN' : 'OPEN_GAP', true, packetPass ? 'PACKET_PASS' : 'PACKET_NOT_PASS'),
      READINESS_HOLD: asCheck(readinessHold ? 'GREEN' : 'OPEN_GAP', true, readinessHold ? 'READINESS_HOLD' : 'READINESS_FALSE_GREEN'),
      SOURCE_LAYOUT_RECOVERY_MATCH: asCheck(sourceLayoutRecoveryMatches ? 'GREEN' : 'OPEN_GAP', true, sourceLayoutRecoveryMatches ? 'SOURCE_LAYOUT_RECOVERY_MATCH' : 'SOURCE_LAYOUT_RECOVERY_DRIFT'),
      LOCKED_TARGET_IDS_MATCH: asCheck(lockedTargetIdsMatch ? 'GREEN' : 'OPEN_GAP', true, lockedTargetIdsMatch ? 'LOCKED_TARGET_IDS_MATCH' : 'LOCKED_TARGET_IDS_DRIFT'),
      LOCKED_COMMIT_POINT_IDS_MATCH: asCheck(lockedCommitPointIdsMatch ? 'GREEN' : 'OPEN_GAP', true, lockedCommitPointIdsMatch ? 'LOCKED_COMMIT_POINT_IDS_MATCH' : 'LOCKED_COMMIT_POINT_IDS_DRIFT'),
      VIEWPORT_ENVELOPE_METADATA_PRESENT: asCheck(viewportEnvelopeMetadataPresent ? 'GREEN' : 'OPEN_GAP', true, viewportEnvelopeMetadataPresent ? 'VIEWPORT_ENVELOPE_METADATA_PRESENT' : 'VIEWPORT_ENVELOPE_METADATA_MISSING'),
      MISSING_MONITOR_DETECTION_PRESENT: asCheck(missingMonitorDetectionPresent ? 'GREEN' : 'OPEN_GAP', true, missingMonitorDetectionPresent ? 'MISSING_MONITOR_DETECTION_PRESENT' : 'MISSING_MONITOR_DETECTION_MISSING'),
      INVALID_LAYOUT_AND_MISSING_MONITOR_RECOVERY_EXPLICIT: asCheck(invalidLayoutAndMissingMonitorRecoveryExplicit ? 'GREEN' : 'OPEN_GAP', true, invalidLayoutAndMissingMonitorRecoveryExplicit ? 'INVALID_LAYOUT_AND_MISSING_MONITOR_RECOVERY_EXPLICIT' : 'INVALID_LAYOUT_AND_MISSING_MONITOR_RECOVERY_EXPLICIT_MISSING'),
      LAST_STABLE_FALLBACK_TO_BASELINE_EXPLICIT: asCheck(lastStableFallbackToBaselineExplicit ? 'GREEN' : 'OPEN_GAP', true, lastStableFallbackToBaselineExplicit ? 'LAST_STABLE_FALLBACK_TO_BASELINE_EXPLICIT' : 'LAST_STABLE_FALLBACK_TO_BASELINE_EXPLICIT_MISSING'),
      RECOVERY_ORDER_DETERMINISTIC: asCheck(recoveryOrderDeterministic ? 'GREEN' : 'OPEN_GAP', true, recoveryOrderDeterministic ? 'RECOVERY_ORDER_DETERMINISTIC' : 'RECOVERY_ORDER_DETERMINISTIC_MISSING'),
      EDITOR_ROOT_FIXED_DOCKED_STILL: asCheck(editorRootFixedDockedStill ? 'GREEN' : 'OPEN_GAP', true, editorRootFixedDockedStill ? 'EDITOR_ROOT_FIXED_DOCKED_STILL' : 'EDITOR_ROOT_FIXED_DOCKED_STILL_MISSING'),
      PROJECT_SCOPED_SPATIAL_LAYOUT_SNAPSHOT_STILL: asCheck(projectScopedSpatialLayoutSnapshotStill ? 'GREEN' : 'OPEN_GAP', true, projectScopedSpatialLayoutSnapshotStill ? 'PROJECT_SCOPED_SPATIAL_LAYOUT_SNAPSHOT_STILL' : 'PROJECT_SCOPED_SPATIAL_LAYOUT_SNAPSHOT_STILL_MISSING'),
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
      openGapIds: ['PHASE05_INVALID_LAYOUT_AND_MISSING_MONITOR_RECOVERY_BASELINE_EVALUATION_ERROR'],
      checkStatusById: {},
      lockedTargetIds: [],
      lockedCommitPointIds: [],
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

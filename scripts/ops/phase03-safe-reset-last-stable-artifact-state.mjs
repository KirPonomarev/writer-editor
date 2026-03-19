#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { evaluatePhase03SafeResetLastStableFoundationState } from './phase03-safe-reset-last-stable-foundation-state.mjs';

const FAIL_REASON_FORCED_NEGATIVE = 'E_PHASE03_SAFE_RESET_LAST_STABLE_ARTIFACT_FORCED_NEGATIVE';
const FAIL_REASON_UNEXPECTED = 'E_PHASE03_SAFE_RESET_LAST_STABLE_ARTIFACT_UNEXPECTED';
const ARTIFACT_PACKET_PATH = 'docs/OPS/STATUS/PHASE03_SAFE_RESET_LAST_STABLE_ARTIFACT_V1.json';
const MAIN_SOURCE_PATH = 'src/main.js';
const RENDERER_SOURCE_PATH = 'src/renderer/editor.js';
const RUNTIME_BRIDGE_SOURCE_PATH = 'src/renderer/tiptap/runtimeBridge.js';

const EXPECTED_BOUND_RECOVERY_SURFACE_IDS = Object.freeze([
  'AUTOSAVE_RESTORE_ON_REOPEN',
  'RECOVERY_MODAL_ENTRY',
  'WINDOW_STATE_PERSISTENCE',
]);

const EXPECTED_OPEN_RUNTIME_GAP_IDS = Object.freeze([]);

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

function evaluatePhase03SafeResetLastStableArtifactState(input = {}) {
  const forceNegative = Boolean(input.forceNegative);

  try {
    const foundationState = evaluatePhase03SafeResetLastStableFoundationState({});
    const packetExists = fs.existsSync(path.resolve(ARTIFACT_PACKET_PATH));
    const packet = packetExists ? readJson(ARTIFACT_PACKET_PATH) : null;
    const mainSource = readText(MAIN_SOURCE_PATH);
    const rendererSource = readText(RENDERER_SOURCE_PATH);
    const runtimeBridgeSource = readText(RUNTIME_BRIDGE_SOURCE_PATH);

    const foundationPass = foundationState.overallStatus === 'PASS'
      && foundationState.foundationStatus === 'HOLD';
    const packetPass = packet?.status === 'PASS';
    const restorePass = packet?.restoreStatus === 'PASS';
    const scopeFlagsValid = packet?.scope?.recoverySurfaceBound === true
      && packet?.scope?.autosaveRestoreBound === true
      && packet?.scope?.shellLevelSafeResetPresent === true
      && packet?.scope?.lastStableRestorePresent === true
      && packet?.scope?.honestHoldArtifact === true;
    const boundRecoverySurfaceIdsMatch = arraysEqual(
      packet?.boundRecoverySurfaceIds || [],
      EXPECTED_BOUND_RECOVERY_SURFACE_IDS,
    );
    const openRuntimeGapIdsMatch = arraysEqual(
      packet?.openRuntimeGapIds || [],
      EXPECTED_OPEN_RUNTIME_GAP_IDS,
    );

    const autosaveRestorePresent = (
      matchesAll(mainSource, [
        /async function restoreAutosaveIfExists\(\)/,
        /sendEditorText\(\{ content, title: 'Автосохранение', path: '', kind: 'autosave', metaEnabled: false \}\);/,
        /mainWindow\.webContents\.send\('ui:recovery-restored'/,
      ]) || matchesAll(mainSource, [
        /async function restoreAutosaveIfExists\(\)/,
        /sendEditorText\(await attachProjectIdToEditorPayload\(\{ content, title: 'Автосохранение', path: '', kind: 'autosave', metaEnabled: false \}\)\);/,
        /mainWindow\.webContents\.send\('ui:recovery-restored'/,
      ])
    );
    const recoveryEntryPresent = matchesAll(rendererSource, [
      /const recoveryModal = document\.querySelector\('\[data-recovery-modal\]'\);/,
      /case 'open-recovery':/,
      /openRecoveryModal\(/,
    ]);
    const windowStatePersistencePresent = matchesAll(mainSource, [
      /async function loadWindowStateFromSettings\(\)/,
      /async function persistWindowState\(bounds\)/,
      /settings\.windowWidth = bounds\.width;/,
      /settings\.windowHeight = bounds\.height;/,
    ]);
    const shellLevelSafeResetPresent = matchesAll(mainSource, [
      /cmd\.project\.view\.safeReset/,
      /sendRuntimeCommand\('safe-reset-shell', \{ source: 'menu' \}\);/,
    ]) && matchesAll(rendererSource, [
      /function performSafeResetShell\(\)/,
      /clearProjectWorkspaceStorage\(currentProjectId\);/,
      /applyTheme\(SAFE_RESET_BASELINE_THEME\);/,
      /applyFontWeight\(SAFE_RESET_BASELINE_FONT_WEIGHT\);/,
      /applyLineHeight\(SAFE_RESET_BASELINE_LINE_HEIGHT\);/,
      /applyWordWrap\(true\);/,
      /applyViewMode\(SAFE_RESET_BASELINE_VIEW_MODE\);/,
      /setEditorZoom\(EDITOR_ZOOM_DEFAULT\);/,
      /applyFloatingToolbarState\(getDefaultFloatingToolbarState\(\), true\);/,
      /applyLeftFloatingToolbarState\(getDefaultLeftFloatingToolbarState\(\), true\);/,
      /window\.electronAPI\?\.setFontSizePx\(SAFE_RESET_BASELINE_FONT_SIZE_PX\);/,
      /applyMode\('write'\);/,
      /applyLeftTab\('project'\);/,
      /applyRightTab\('inspector'\);/,
      /safeResetShell: \(\) => performSafeResetShell\(\),/,
      /command === 'safe-reset-shell'/,
    ]) && matchesAll(runtimeBridgeSource, [
      /if \(command === 'safe-reset-shell'\)/,
      /runBridgeCallback\(runtimeHandlers\.safeResetShell, command\)/,
    ]);
    const lastStableRestorePresent = matchesAll(mainSource, [
      /cmd\.project\.view\.restoreLastStable/,
      /sendRuntimeCommand\('restore-last-stable-shell', \{ source: 'menu' \}\);/,
    ]) && matchesAll(rendererSource, [
      /function performRestoreLastStableShell\(\)/,
      /readWorkspaceStorage\(getActiveDocumentTitleStorageKey\(currentProjectId\), 'activeDocumentTitle'\)/,
      /loadSavedTheme\(\);/,
      /loadSavedFont\(\);/,
      /loadSavedFontWeight\(\);/,
      /loadSavedLineHeight\(\);/,
      /loadSavedWordWrap\(\);/,
      /loadSavedViewMode\(\);/,
      /loadSavedEditorZoom\(\);/,
      /restoreFloatingToolbarItemOffsets\(\);/,
      /restoreFloatingToolbarPosition\(\);/,
      /restoreLeftToolbarButtonOffsets\(\);/,
      /restoreLeftFloatingToolbarPosition\(\);/,
      /configuratorBucketState = readConfiguratorBucketState\(\);/,
      /expandedNodesByTab = new Map\(\);/,
      /renderTree\(\);/,
      /restoreLastStableShell: \(\) => performRestoreLastStableShell\(\),/,
      /command === 'restore-last-stable-shell'/,
    ]) && matchesAll(runtimeBridgeSource, [
      /if \(command === 'restore-last-stable-shell'\)/,
      /runBridgeCallback\(runtimeHandlers\.restoreLastStableShell, command\)/,
    ]);

    const checkStatusById = {
      SAFE_RESET_FOUNDATION_PASS: asCheck(foundationPass ? 'GREEN' : 'OPEN_GAP', true, foundationPass ? 'SAFE_RESET_FOUNDATION_PASS' : 'SAFE_RESET_FOUNDATION_NOT_READY'),
      ARTIFACT_PACKET_PRESENT: asCheck(packetExists ? 'GREEN' : 'OPEN_GAP', true, packetExists ? 'ARTIFACT_PACKET_PRESENT' : 'ARTIFACT_PACKET_MISSING'),
      ARTIFACT_PACKET_PASS: asCheck(packetPass ? 'GREEN' : 'OPEN_GAP', true, packetPass ? 'ARTIFACT_PACKET_PASS' : 'ARTIFACT_PACKET_NOT_PASS'),
      RESTORE_STATUS_PASS: asCheck(restorePass ? 'GREEN' : 'OPEN_GAP', true, restorePass ? 'RESTORE_STATUS_PASS' : 'RESTORE_STATUS_FALSE_GREEN'),
      SCOPE_FLAGS_VALID: asCheck(scopeFlagsValid ? 'GREEN' : 'OPEN_GAP', true, scopeFlagsValid ? 'SCOPE_FLAGS_VALID' : 'SCOPE_FLAGS_DRIFT'),
      BOUND_RECOVERY_SURFACE_IDS_MATCH: asCheck(boundRecoverySurfaceIdsMatch ? 'GREEN' : 'OPEN_GAP', true, boundRecoverySurfaceIdsMatch ? 'BOUND_RECOVERY_SURFACE_IDS_MATCH' : 'BOUND_RECOVERY_SURFACE_IDS_DRIFT'),
      OPEN_RUNTIME_GAP_IDS_MATCH: asCheck(openRuntimeGapIdsMatch ? 'GREEN' : 'OPEN_GAP', true, openRuntimeGapIdsMatch ? 'OPEN_RUNTIME_GAP_IDS_MATCH' : 'OPEN_RUNTIME_GAP_IDS_DRIFT'),
      AUTOSAVE_RESTORE_PRESENT: asCheck(autosaveRestorePresent ? 'GREEN' : 'OPEN_GAP', true, autosaveRestorePresent ? 'AUTOSAVE_RESTORE_PRESENT' : 'AUTOSAVE_RESTORE_MISSING'),
      RECOVERY_ENTRY_PRESENT: asCheck(recoveryEntryPresent ? 'GREEN' : 'OPEN_GAP', true, recoveryEntryPresent ? 'RECOVERY_ENTRY_PRESENT' : 'RECOVERY_ENTRY_MISSING'),
      WINDOW_STATE_PERSISTENCE_PRESENT: asCheck(windowStatePersistencePresent ? 'GREEN' : 'OPEN_GAP', true, windowStatePersistencePresent ? 'WINDOW_STATE_PERSISTENCE_PRESENT' : 'WINDOW_STATE_PERSISTENCE_MISSING'),
      SHELL_LEVEL_SAFE_RESET_PRESENT: asCheck(shellLevelSafeResetPresent ? 'GREEN' : 'OPEN_GAP', true, shellLevelSafeResetPresent ? 'SHELL_LEVEL_SAFE_RESET_PRESENT' : 'SHELL_LEVEL_SAFE_RESET_MISSING'),
      LAST_STABLE_RESTORE_PRESENT: asCheck(lastStableRestorePresent ? 'GREEN' : 'OPEN_GAP', true, lastStableRestorePresent ? 'LAST_STABLE_RESTORE_PRESENT' : 'LAST_STABLE_RESTORE_MISSING'),
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
        restoreStatus: restorePass ? 'PASS' : 'UNKNOWN',
        phase03ReadinessStatus: 'HOLD',
        greenCheckIds,
        openGapIds: Array.from(new Set([...openGapIds, 'FORCED_NEGATIVE_PATH'])),
        checkStatusById,
      };
    }

    return {
      ok: openGapIds.length === 0,
      failReason: '',
      overallStatus: openGapIds.length === 0 ? 'PASS' : 'HOLD',
      restoreStatus: restorePass ? 'PASS' : 'UNKNOWN',
      phase03ReadinessStatus: 'HOLD',
      greenCheckIds,
      openGapIds,
      checkStatusById,
    };
  } catch (error) {
    return {
      ok: false,
      failReason: FAIL_REASON_UNEXPECTED,
      overallStatus: 'HOLD',
      restoreStatus: 'UNKNOWN',
      phase03ReadinessStatus: 'UNKNOWN',
      greenCheckIds: [],
      openGapIds: ['PHASE03_SAFE_RESET_LAST_STABLE_ARTIFACT_EVALUATION_ERROR'],
      checkStatusById: {},
      errorMessage: error && typeof error.message === 'string' ? error.message : 'UNKNOWN',
    };
  }
}

function runCli() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluatePhase03SafeResetLastStableArtifactState({ forceNegative: args.forceNegative });

  if (args.json) {
    console.log(JSON.stringify(state, null, 2));
  } else {
    console.log(`PHASE03_SAFE_RESET_LAST_STABLE_ARTIFACT_OK=${state.ok ? 1 : 0}`);
    console.log(`PHASE03_SAFE_RESET_LAST_STABLE_ARTIFACT_OVERALL_STATUS=${state.overallStatus}`);
    console.log(`PHASE03_SAFE_RESET_LAST_STABLE_ARTIFACT_STATUS=${state.restoreStatus}`);
    console.log(`PHASE03_SAFE_RESET_LAST_STABLE_ARTIFACT_OPEN_GAP_IDS=${state.openGapIds.join(',')}`);
    console.log(`PHASE03_SAFE_RESET_LAST_STABLE_ARTIFACT_FAIL_REASON=${state.failReason}`);
  }

  process.exit(state.ok ? 0 : 1);
}

const selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(selfPath)) {
  runCli();
}

export { evaluatePhase03SafeResetLastStableArtifactState };

#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FAIL_REASON_FORCED_NEGATIVE = 'E_PHASE05_LAYOUT_RECOVERY_LAST_STABLE_BASELINE_FORCED_NEGATIVE';
const FAIL_REASON_UNEXPECTED = 'E_PHASE05_LAYOUT_RECOVERY_LAST_STABLE_BASELINE_UNEXPECTED';
const EDITOR_SOURCE_PATH = 'src/renderer/editor.js';
const MAIN_SOURCE_PATH = 'src/main.js';
const RUNTIME_BRIDGE_SOURCE_PATH = 'src/renderer/tiptap/runtimeBridge.js';

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

function evaluatePhase05LayoutRecoveryLastStableBaselineState(input = {}) {
  const forceNegative = Boolean(input.forceNegative);

  try {
    const editorSource = readText(EDITOR_SOURCE_PATH);
    const mainSource = readText(MAIN_SOURCE_PATH);
    const runtimeBridgeSource = readText(RUNTIME_BRIDGE_SOURCE_PATH);

    const layoutReadWritePresent = matchesAll(editorSource, [
      /function readSpatialLayoutState\(projectId = currentProjectId\)/,
      /function restoreSpatialLayoutState\(projectId = currentProjectId\)/,
      /function commitSpatialLayoutState\(projectId = currentProjectId\)/,
      /applySpatialLayoutState\(resolvedState, \{ persist: false, projectId \}\);/,
    ]);
    const restoreLastStableCommandPresent = (
      // Canonical runtime envelope path.
      matchesAll(mainSource, [
        /cmd\.project\.view\.restoreLastStable/,
        /sendCanonicalRuntimeCommand\(\s*'cmd\.project\.view\.restoreLastStable',[\s\S]*?'restore-last-stable-shell'/,
      ])
      // Backward-compatible legacy string path.
      || matchesAll(mainSource, [
        /cmd\.project\.view\.restoreLastStable/,
        /sendRuntimeCommand\('restore-last-stable-shell', \{ source: 'menu' \}\);/,
      ])
    ) && (
      // Canonical consumer in runtime bridge.
      matchesAll(runtimeBridgeSource, [
        /if \(commandId === 'cmd\.project\.view\.restoreLastStable'\)/,
        /runBridgeCallback\(runtimeHandlers\.restoreLastStableShell, commandId\)/,
      ])
      // Backward-compatible legacy consumer.
      || matchesAll(runtimeBridgeSource, [
        /if \(command === 'restore-last-stable-shell'\)/,
        /runBridgeCallback\(runtimeHandlers\.restoreLastStableShell, command\)/,
      ])
    );
    const restoreLastStableFlowPresent = matchesAll(editorSource, [
      /function performRestoreLastStableShell\(\)/,
      /restoreSpatialLayoutState\(currentProjectId\);/,
      /restoreFloatingToolbarItemOffsets\(\);/,
      /restoreFloatingToolbarPosition\(\);/,
      /restoreLeftToolbarButtonOffsets\(\);/,
      /restoreLeftFloatingToolbarPosition\(\);/,
    ]);
    const safeResetRemainsSeparate = (
      matchesAll(mainSource, [
        /cmd\.project\.view\.safeReset/,
        /sendCanonicalRuntimeCommand\(\s*'cmd\.project\.view\.safeReset',[\s\S]*?'safe-reset-shell'/,
      ])
      || matchesAll(mainSource, [
        /cmd\.project\.view\.safeReset/,
        /sendRuntimeCommand\('safe-reset-shell', \{ source: 'menu' \}\);/,
      ])
    ) && matchesAll(editorSource, [
      /function performSafeResetShell\(\)/,
      /function performRestoreLastStableShell\(\)/,
    ]) && (
      matchesAll(runtimeBridgeSource, [
        /if \(commandId === 'cmd\.project\.view\.safeReset'\)/,
        /if \(commandId === 'cmd\.project\.view\.restoreLastStable'\)/,
      ])
      || matchesAll(runtimeBridgeSource, [
        /if \(command === 'safe-reset-shell'\)/,
        /if \(command === 'restore-last-stable-shell'\)/,
      ])
    );

    const checkStatusById = {
      LAYOUT_READ_WRITE_PRESENT: asCheck(
        layoutReadWritePresent ? 'GREEN' : 'OPEN_GAP',
        true,
        layoutReadWritePresent ? 'LAYOUT_READ_WRITE_PRESENT' : 'LAYOUT_READ_WRITE_MISSING',
      ),
      RESTORE_LAST_STABLE_COMMAND_PRESENT: asCheck(
        restoreLastStableCommandPresent ? 'GREEN' : 'OPEN_GAP',
        true,
        restoreLastStableCommandPresent ? 'RESTORE_LAST_STABLE_COMMAND_PRESENT' : 'RESTORE_LAST_STABLE_COMMAND_MISSING',
      ),
      RESTORE_LAST_STABLE_FLOW_PRESENT: asCheck(
        restoreLastStableFlowPresent ? 'GREEN' : 'OPEN_GAP',
        true,
        restoreLastStableFlowPresent ? 'RESTORE_LAST_STABLE_FLOW_PRESENT' : 'RESTORE_LAST_STABLE_FLOW_MISSING',
      ),
      SAFE_RESET_REMAINS_SEPARATE: asCheck(
        safeResetRemainsSeparate ? 'GREEN' : 'OPEN_GAP',
        true,
        safeResetRemainsSeparate ? 'SAFE_RESET_REMAINS_SEPARATE' : 'SAFE_RESET_AND_RESTORE_COLLAPSED',
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
      openGapIds: ['PHASE05_LAYOUT_RECOVERY_LAST_STABLE_BASELINE_EVALUATION_ERROR'],
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

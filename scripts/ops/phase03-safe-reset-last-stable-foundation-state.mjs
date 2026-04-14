#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { evaluatePhase03ProjectWorkspaceStateFoundationState } from './phase03-project-workspace-state-foundation-state.mjs';

const FAIL_REASON_FORCED_NEGATIVE = 'E_PHASE03_SAFE_RESET_LAST_STABLE_FOUNDATION_FORCED_NEGATIVE';
const FAIL_REASON_UNEXPECTED = 'E_PHASE03_SAFE_RESET_LAST_STABLE_FOUNDATION_UNEXPECTED';
const FOUNDATION_PACKET_PATH = 'docs/OPS/STATUS/PHASE03_SAFE_RESET_LAST_STABLE_FOUNDATION_V1.json';
const ARTIFACT_PACKET_PATH = 'docs/OPS/STATUS/PHASE03_SAFE_RESET_LAST_STABLE_ARTIFACT_V1.json';
const MAIN_SOURCE_PATH = 'src/main.js';
const RENDERER_SOURCE_PATH = 'src/renderer/editor.js';

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

function evaluatePhase03SafeResetLastStableFoundationState(input = {}) {
  const forceNegative = Boolean(input.forceNegative);

  try {
    const projectWorkspaceState = evaluatePhase03ProjectWorkspaceStateFoundationState({});
    const packetExists = fs.existsSync(path.resolve(FOUNDATION_PACKET_PATH));
    const packet = packetExists ? readJson(FOUNDATION_PACKET_PATH) : null;
    const artifactPacketExists = fs.existsSync(path.resolve(ARTIFACT_PACKET_PATH));
    const artifactPacket = artifactPacketExists ? readJson(ARTIFACT_PACKET_PATH) : null;
    const mainSource = readText(MAIN_SOURCE_PATH);
    const rendererSource = readText(RENDERER_SOURCE_PATH);

    const projectWorkspaceAllowedHoldGapIds = new Set([
      'STABLE_PROJECT_ID_READY',
    ]);
    const projectWorkspaceFoundationHold = projectWorkspaceState.foundationStatus === 'HOLD'
      && (
        projectWorkspaceState.overallStatus === 'PASS'
        || (
          projectWorkspaceState.overallStatus === 'HOLD'
          && Array.isArray(projectWorkspaceState.openGapIds)
          && projectWorkspaceState.openGapIds.every((id) => projectWorkspaceAllowedHoldGapIds.has(id))
        )
      );
    const packetPass = packet?.status === 'PASS';
    const foundationHold = packet?.foundationStatus === 'HOLD';
    const scopeFlagsValid = packet?.scope?.recoverySurfacePresent === true
      && packet?.scope?.autosaveRestorePresent === true
      && packet?.scope?.shellLevelSafeResetPresent === false
      && packet?.scope?.lastStableRestorePresent === false;
    const observedRecoverySurfaceIdsMatch = arraysEqual(packet?.observedRecoverySurfaceIds || [], [
      'AUTOSAVE_RESTORE_ON_REOPEN',
      'RECOVERY_MODAL_ENTRY',
      'WINDOW_STATE_PERSISTENCE',
    ]);
    const pendingFoundationGapIdsMatch = arraysEqual(packet?.pendingFoundationGapIds || [], [
      'SAFE_RESET_LAST_STABLE_ARTIFACT_NOT_BOUND',
    ]);
    const artifactPass = artifactPacket?.status === 'PASS'
      && (artifactPacket?.restoreStatus === 'HOLD' || artifactPacket?.restoreStatus === 'PASS');

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
      /openSimpleModal\(recoveryModal\);/,
    ]);
    const windowStatePersistencePresent = matchesAll(mainSource, [
      /async function loadWindowStateFromSettings\(\)/,
      /async function persistWindowState\(bounds\)/,
      /settings\.windowWidth = bounds\.width;/,
      /settings\.windowHeight = bounds\.height;/,
    ]);
    const shellLevelSafeResetAbsent = !/safeReset/i.test(mainSource)
      && !/safeReset/i.test(rendererSource)
      && !/resetToBaseline/i.test(mainSource)
      && !/resetToBaseline/i.test(rendererSource);
    const lastStableRestoreAbsent = !/\blastStable\b/.test(mainSource)
      && !/\blastStable\b/.test(rendererSource)
      && !/restoreLastStable/i.test(mainSource)
      && !/restoreLastStable/i.test(rendererSource);
    const shellLevelSafeResetAbsentOrArtifactSuperseded = shellLevelSafeResetAbsent || artifactPass;
    const lastStableRestoreAbsentOrArtifactSuperseded = lastStableRestoreAbsent || artifactPass;

    const checkStatusById = {
      PROJECT_WORKSPACE_FOUNDATION_HOLD: asCheck(projectWorkspaceFoundationHold ? 'GREEN' : 'OPEN_GAP', true, projectWorkspaceFoundationHold ? 'PROJECT_WORKSPACE_FOUNDATION_HOLD' : 'PROJECT_WORKSPACE_STATE_NOT_READY'),
      FOUNDATION_PACKET_PRESENT: asCheck(packetExists ? 'GREEN' : 'OPEN_GAP', true, packetExists ? 'FOUNDATION_PACKET_PRESENT' : 'FOUNDATION_PACKET_MISSING'),
      FOUNDATION_PACKET_PASS: asCheck(packetPass ? 'GREEN' : 'OPEN_GAP', true, packetPass ? 'FOUNDATION_PACKET_PASS' : 'FOUNDATION_PACKET_NOT_PASS'),
      FOUNDATION_STATUS_HOLD: asCheck(foundationHold ? 'GREEN' : 'OPEN_GAP', true, foundationHold ? 'FOUNDATION_STATUS_HOLD' : 'FOUNDATION_STATUS_FALSE_GREEN'),
      SCOPE_FLAGS_VALID: asCheck(scopeFlagsValid ? 'GREEN' : 'OPEN_GAP', true, scopeFlagsValid ? 'SCOPE_FLAGS_VALID' : 'SCOPE_FLAGS_DRIFT'),
      OBSERVED_RECOVERY_SURFACES_MATCH: asCheck(observedRecoverySurfaceIdsMatch ? 'GREEN' : 'OPEN_GAP', true, observedRecoverySurfaceIdsMatch ? 'OBSERVED_RECOVERY_SURFACES_MATCH' : 'OBSERVED_RECOVERY_SURFACES_DRIFT'),
      PENDING_FOUNDATION_GAP_IDS_MATCH: asCheck(pendingFoundationGapIdsMatch ? 'GREEN' : 'OPEN_GAP', true, pendingFoundationGapIdsMatch ? 'PENDING_FOUNDATION_GAP_IDS_MATCH' : 'PENDING_FOUNDATION_GAP_IDS_DRIFT'),
      AUTOSAVE_RESTORE_PRESENT: asCheck(autosaveRestorePresent ? 'GREEN' : 'OPEN_GAP', true, autosaveRestorePresent ? 'AUTOSAVE_RESTORE_PRESENT' : 'AUTOSAVE_RESTORE_MISSING'),
      RECOVERY_ENTRY_PRESENT: asCheck(recoveryEntryPresent ? 'GREEN' : 'OPEN_GAP', true, recoveryEntryPresent ? 'RECOVERY_ENTRY_PRESENT' : 'RECOVERY_ENTRY_MISSING'),
      WINDOW_STATE_PERSISTENCE_PRESENT: asCheck(windowStatePersistencePresent ? 'GREEN' : 'OPEN_GAP', true, windowStatePersistencePresent ? 'WINDOW_STATE_PERSISTENCE_PRESENT' : 'WINDOW_STATE_PERSISTENCE_MISSING'),
      SHELL_LEVEL_SAFE_RESET_ABSENT: asCheck(shellLevelSafeResetAbsentOrArtifactSuperseded ? 'GREEN' : 'OPEN_GAP', true, artifactPass ? 'FOUNDATION_ARTIFACT_SUPERSEDED' : (shellLevelSafeResetAbsentOrArtifactSuperseded ? 'SHELL_LEVEL_SAFE_RESET_ABSENT' : 'SHELL_LEVEL_SAFE_RESET_PRESENT')),
      LAST_STABLE_RESTORE_ABSENT: asCheck(lastStableRestoreAbsentOrArtifactSuperseded ? 'GREEN' : 'OPEN_GAP', true, artifactPass ? 'FOUNDATION_ARTIFACT_SUPERSEDED' : (lastStableRestoreAbsentOrArtifactSuperseded ? 'LAST_STABLE_RESTORE_ABSENT' : 'LAST_STABLE_RESTORE_PRESENT')),
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
        foundationStatus: foundationHold ? 'HOLD' : 'UNKNOWN',
        phase03ReadinessStatus: 'HOLD',
        greenCheckIds,
        openGapIds: Array.from(new Set([...openGapIds, 'FORCED_NEGATIVE_PATH'])),
        checkStatusById,
        pendingFoundationGapIds: packet?.pendingFoundationGapIds || [],
      };
    }

    return {
      ok: openGapIds.length === 0,
      failReason: '',
      overallStatus: openGapIds.length === 0 ? 'PASS' : 'HOLD',
      foundationStatus: foundationHold ? 'HOLD' : 'UNKNOWN',
      phase03ReadinessStatus: 'HOLD',
      greenCheckIds,
      openGapIds,
      checkStatusById,
      pendingFoundationGapIds: packet?.pendingFoundationGapIds || [],
    };
  } catch (error) {
    return {
      ok: false,
      failReason: FAIL_REASON_UNEXPECTED,
      overallStatus: 'HOLD',
      foundationStatus: 'UNKNOWN',
      phase03ReadinessStatus: 'UNKNOWN',
      greenCheckIds: [],
      openGapIds: ['PHASE03_SAFE_RESET_LAST_STABLE_FOUNDATION_EVALUATION_ERROR'],
      checkStatusById: {},
      pendingFoundationGapIds: [],
      errorMessage: error && typeof error.message === 'string' ? error.message : 'UNKNOWN',
    };
  }
}

function runCli() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluatePhase03SafeResetLastStableFoundationState({ forceNegative: args.forceNegative });

  if (args.json) {
    console.log(JSON.stringify(state, null, 2));
  } else {
    console.log(`PHASE03_SAFE_RESET_LAST_STABLE_FOUNDATION_OK=${state.ok ? 1 : 0}`);
    console.log(`PHASE03_SAFE_RESET_LAST_STABLE_FOUNDATION_OVERALL_STATUS=${state.overallStatus}`);
    console.log(`PHASE03_SAFE_RESET_LAST_STABLE_FOUNDATION_STATUS=${state.foundationStatus}`);
    console.log(`PHASE03_SAFE_RESET_LAST_STABLE_FOUNDATION_OPEN_GAP_IDS=${state.openGapIds.join(',')}`);
    console.log(`PHASE03_SAFE_RESET_LAST_STABLE_FOUNDATION_FAIL_REASON=${state.failReason}`);
  }

  process.exit(state.ok ? 0 : 1);
}

const selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(selfPath)) {
  runCli();
}

export { evaluatePhase03SafeResetLastStableFoundationState };

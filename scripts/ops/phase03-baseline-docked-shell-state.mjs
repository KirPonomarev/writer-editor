#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { evaluatePhase03PrepState } from './phase03-prep-state.mjs';
import { evaluatePhase03UserShellStateFoundationState } from './phase03-user-shell-state-foundation-state.mjs';
import { evaluatePhase03ProjectWorkspaceStateArtifactState } from './phase03-project-workspace-state-artifact-state.mjs';
import { evaluatePhase03SafeResetLastStableArtifactState } from './phase03-safe-reset-last-stable-artifact-state.mjs';
import { evaluatePhase03StableProjectIdStorageContractState } from './phase03-stable-project-id-storage-contract-state.mjs';
import { evaluatePhase03TerminologyMigrationArtifactState } from './phase03-terminology-migration-artifact-state.mjs';

const FAIL_REASON_FORCED_NEGATIVE = 'E_PHASE03_BASELINE_DOCKED_SHELL_FORCED_NEGATIVE';
const FAIL_REASON_UNEXPECTED = 'E_PHASE03_BASELINE_DOCKED_SHELL_UNEXPECTED';
const PACKET_PATH = 'docs/OPS/STATUS/PHASE03_BASELINE_DOCKED_SHELL_PACKET_V1.json';

const EXPECTED_LOCKED_TARGET_IDS = Object.freeze([
  'BASELINE_DOCKED_SHELL',
  'USER_SHELL_STATE',
  'PROJECT_WORKSPACE_STATE',
  'SAFE_RESET_AND_LAST_STABLE_RESTORE',
  'STABLE_PROJECT_ID_STORAGE_CONTRACT',
  'TERMINOLOGY_MIGRATION_FOR_SHELL_CUTOVER',
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

function asCheck(status, measured, note) {
  return { status, measured, note };
}

function arraysEqual(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

function evaluatePhase03BaselineDockedShellState(input = {}) {
  const forceNegative = Boolean(input.forceNegative);

  try {
    const prepState = evaluatePhase03PrepState({});
    const userShellState = evaluatePhase03UserShellStateFoundationState({});
    const projectWorkspaceState = evaluatePhase03ProjectWorkspaceStateArtifactState({});
    const safeResetLastStableState = evaluatePhase03SafeResetLastStableArtifactState({});
    const stableProjectIdState = evaluatePhase03StableProjectIdStorageContractState({});
    const terminologyMigrationState = evaluatePhase03TerminologyMigrationArtifactState({});

    const packetExists = fs.existsSync(path.resolve(PACKET_PATH));
    const packet = packetExists ? readJson(PACKET_PATH) : null;

    const prepPass = prepState.overallStatus === 'PASS'
      && prepState.phase03ReadinessStatus === 'HOLD';
    const packetPass = packet?.status === 'PASS';
    const packetReady = packet?.phase03ReadinessStatus === 'PASS';
    const userShellPass = userShellState.overallStatus === 'PASS'
      && userShellState.foundationStatus === 'PASS';
    const projectWorkspacePass = projectWorkspaceState.overallStatus === 'PASS'
      && projectWorkspaceState.workspaceStatus === 'PASS';
    const safeResetLastStablePass = safeResetLastStableState.overallStatus === 'PASS'
      && safeResetLastStableState.restoreStatus === 'PASS';
    const stableProjectIdPass = stableProjectIdState.overallStatus === 'PASS'
      && stableProjectIdState.contractStatus === 'PASS';
    const terminologyMigrationPass = terminologyMigrationState.overallStatus === 'PASS'
      && terminologyMigrationState.migrationStatus === 'PASS';
    const targetIdsLocked = arraysEqual(packet?.lockedTargetIds || [], EXPECTED_LOCKED_TARGET_IDS);
    const pendingGapIdsCleared = Array.isArray(packet?.phase03PendingGapIds)
      && packet.phase03PendingGapIds.length === 0;

    const checkStatusById = {
      PHASE03_PREP_PASS: asCheck(prepPass ? 'GREEN' : 'OPEN_GAP', true, prepPass ? 'PHASE03_PREP_PASS' : 'PHASE03_PREP_NOT_PASS'),
      PACKET_PRESENT: asCheck(packetExists ? 'GREEN' : 'OPEN_GAP', true, packetExists ? 'PACKET_PRESENT' : 'PACKET_MISSING'),
      PACKET_PASS: asCheck(packetPass ? 'GREEN' : 'OPEN_GAP', true, packetPass ? 'PACKET_PASS' : 'PACKET_NOT_PASS'),
      PACKET_READY: asCheck(packetReady ? 'GREEN' : 'OPEN_GAP', true, packetReady ? 'PACKET_READY' : 'PACKET_NOT_READY'),
      USER_SHELL_STATE_FOUNDATION_PASS: asCheck(userShellPass ? 'GREEN' : 'OPEN_GAP', true, userShellPass ? 'USER_SHELL_STATE_FOUNDATION_PASS' : 'USER_SHELL_STATE_FOUNDATION_NOT_PASS'),
      PROJECT_WORKSPACE_STATE_ARTIFACT_PASS: asCheck(projectWorkspacePass ? 'GREEN' : 'OPEN_GAP', true, projectWorkspacePass ? 'PROJECT_WORKSPACE_STATE_ARTIFACT_PASS' : 'PROJECT_WORKSPACE_STATE_ARTIFACT_NOT_PASS'),
      SAFE_RESET_LAST_STABLE_ARTIFACT_PASS: asCheck(safeResetLastStablePass ? 'GREEN' : 'OPEN_GAP', true, safeResetLastStablePass ? 'SAFE_RESET_LAST_STABLE_ARTIFACT_PASS' : 'SAFE_RESET_LAST_STABLE_ARTIFACT_NOT_PASS'),
      STABLE_PROJECT_ID_STORAGE_CONTRACT_PASS: asCheck(stableProjectIdPass ? 'GREEN' : 'OPEN_GAP', true, stableProjectIdPass ? 'STABLE_PROJECT_ID_STORAGE_CONTRACT_PASS' : 'STABLE_PROJECT_ID_STORAGE_CONTRACT_NOT_PASS'),
      TERMINOLOGY_MIGRATION_ARTIFACT_PASS: asCheck(terminologyMigrationPass ? 'GREEN' : 'OPEN_GAP', true, terminologyMigrationPass ? 'TERMINOLOGY_MIGRATION_ARTIFACT_PASS' : 'TERMINOLOGY_MIGRATION_ARTIFACT_NOT_PASS'),
      TARGET_IDS_LOCKED: asCheck(targetIdsLocked ? 'GREEN' : 'OPEN_GAP', true, targetIdsLocked ? 'TARGET_IDS_LOCKED' : 'TARGET_IDS_DRIFT'),
      PENDING_GAP_IDS_CLEARED: asCheck(pendingGapIdsCleared ? 'GREEN' : 'OPEN_GAP', true, pendingGapIdsCleared ? 'PENDING_GAP_IDS_CLEARED' : 'PENDING_GAP_IDS_DRIFT'),
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
        phase03ReadinessStatus: packetReady ? 'PASS' : 'UNKNOWN',
        greenCheckIds,
        openGapIds: Array.from(new Set([...openGapIds, 'FORCED_NEGATIVE_PATH'])),
        checkStatusById,
        phase03PendingGapIds: packet?.phase03PendingGapIds || [],
      };
    }

    return {
      ok: openGapIds.length === 0,
      failReason: '',
      overallStatus: openGapIds.length === 0 ? 'PASS' : 'HOLD',
      phase03ReadinessStatus: packetReady ? 'PASS' : 'UNKNOWN',
      greenCheckIds,
      openGapIds,
      checkStatusById,
      phase03PendingGapIds: packet?.phase03PendingGapIds || [],
    };
  } catch (error) {
    return {
      ok: false,
      failReason: FAIL_REASON_UNEXPECTED,
      overallStatus: 'HOLD',
      phase03ReadinessStatus: 'UNKNOWN',
      greenCheckIds: [],
      openGapIds: ['PHASE03_BASELINE_DOCKED_SHELL_EVALUATION_ERROR'],
      checkStatusById: {},
      phase03PendingGapIds: [],
      errorMessage: error && typeof error.message === 'string' ? error.message : 'UNKNOWN',
    };
  }
}

function runCli() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluatePhase03BaselineDockedShellState({ forceNegative: args.forceNegative });

  if (args.json) {
    console.log(JSON.stringify(state, null, 2));
  } else {
    console.log(`PHASE03_BASELINE_DOCKED_SHELL_OK=${state.ok ? 1 : 0}`);
    console.log(`PHASE03_BASELINE_DOCKED_SHELL_OVERALL_STATUS=${state.overallStatus}`);
    console.log(`PHASE03_BASELINE_DOCKED_SHELL_READINESS_STATUS=${state.phase03ReadinessStatus}`);
    console.log(`PHASE03_BASELINE_DOCKED_SHELL_OPEN_GAP_IDS=${state.openGapIds.join(',')}`);
    console.log(`PHASE03_BASELINE_DOCKED_SHELL_FAIL_REASON=${state.failReason}`);
  }

  process.exit(state.ok ? 0 : 1);
}

const selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(selfPath)) {
  runCli();
}

export { evaluatePhase03BaselineDockedShellState };

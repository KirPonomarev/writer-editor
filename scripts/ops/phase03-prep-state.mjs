#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { evaluatePhase02CoreLockState } from './phase02-core-lock-state.mjs';

const FAIL_REASON_FORCED_NEGATIVE = 'E_PHASE03_PREP_FORCED_NEGATIVE';
const FAIL_REASON_UNEXPECTED = 'E_PHASE03_PREP_UNEXPECTED';
const PREP_PACKET_PATH = 'docs/OPS/STATUS/PHASE03_PREP_PACKET_V1.json';
const USER_SHELL_STATE_PACKET_PATH = 'docs/OPS/STATUS/PHASE03_USER_SHELL_STATE_FOUNDATION_V1.json';
const STABLE_PROJECT_ID_PACKET_PATH = 'docs/OPS/STATUS/PHASE03_STABLE_PROJECT_ID_STORAGE_CONTRACT_V1.json';
const PROJECT_WORKSPACE_STATE_FOUNDATION_PACKET_PATH = 'docs/OPS/STATUS/PHASE03_PROJECT_WORKSPACE_STATE_FOUNDATION_V1.json';
const PROJECT_WORKSPACE_STATE_ARTIFACT_PACKET_PATH = 'docs/OPS/STATUS/PHASE03_PROJECT_WORKSPACE_STATE_ARTIFACT_V1.json';
const SAFE_RESET_LAST_STABLE_PACKET_PATH = 'docs/OPS/STATUS/PHASE03_SAFE_RESET_LAST_STABLE_FOUNDATION_V1.json';
const SAFE_RESET_LAST_STABLE_ARTIFACT_PACKET_PATH = 'docs/OPS/STATUS/PHASE03_SAFE_RESET_LAST_STABLE_ARTIFACT_V1.json';
const TERMINOLOGY_MIGRATION_PACKET_PATH = 'docs/OPS/STATUS/PHASE03_TERMINOLOGY_MIGRATION_FOUNDATION_V1.json';
const TERMINOLOGY_MIGRATION_ARTIFACT_PACKET_PATH = 'docs/OPS/STATUS/PHASE03_TERMINOLOGY_MIGRATION_ARTIFACT_V1.json';
const PROFILE_PRESETS_STATE_PATH = 'scripts/ops/x15-ws03-profile-presets-state.mjs';
const MODE_SHELLS_STATE_PATH = 'scripts/ops/x15-ws04-write-plan-review-shells-state.mjs';

const EXPECTED_PENDING_GAP_IDS = Object.freeze([]);

const ARTIFACT_SCAN_DIRS = Object.freeze([
  'docs/OPS/STATUS',
  'scripts/ops',
  'test/contracts',
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

function runNodeJsonScript(relativePath) {
  const result = spawnSync(process.execPath, [path.resolve(relativePath), '--json'], {
    encoding: 'utf8',
  });
  return {
    status: typeof result.status === 'number' ? result.status : 1,
    payload: JSON.parse(String(result.stdout || '{}')),
  };
}

function asCheck(status, measured, note) {
  return { status, measured, note };
}

function arraysEqual(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

function walkBasenames(relativeDir) {
  const result = [];
  const root = path.resolve(relativeDir);
  if (!fs.existsSync(root)) return result;

  const queue = [root];
  while (queue.length > 0) {
    const current = queue.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(fullPath);
        continue;
      }
      result.push(entry.name);
    }
  }

  return result;
}

function collectArtifactBasenames() {
  return ARTIFACT_SCAN_DIRS.flatMap((relativeDir) => walkBasenames(relativeDir));
}

function hasBasenameMatching(basenames, pattern) {
  return basenames.some((basename) => pattern.test(basename));
}

function hasProjectManifestContractSource() {
  const sourceRoots = ['src/core', 'src/utils', 'src/main.js'];
  for (const relativePath of sourceRoots) {
    const absolutePath = path.resolve(relativePath);
    if (!fs.existsSync(absolutePath)) continue;

    const stat = fs.statSync(absolutePath);
    if (stat.isDirectory()) {
      const entries = fs.readdirSync(absolutePath, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        const filePath = path.join(absolutePath, entry.name);
        const sourceText = fs.readFileSync(filePath, 'utf8');
        if (/\bmanifest\b/i.test(sourceText)) return true;
      }
      continue;
    }

    const sourceText = fs.readFileSync(absolutePath, 'utf8');
    if (/\bmanifest\b/i.test(sourceText)) return true;
  }

  return false;
}

function evaluatePhase03PrepState(input = {}) {
  const forceNegative = Boolean(input.forceNegative);

  try {
    const phase02State = evaluatePhase02CoreLockState({});
    const prepPacketExists = fs.existsSync(path.resolve(PREP_PACKET_PATH));
    const prepPacket = prepPacketExists ? readJson(PREP_PACKET_PATH) : null;
    const userShellStatePacketExists = fs.existsSync(path.resolve(USER_SHELL_STATE_PACKET_PATH));
    const userShellStatePacket = userShellStatePacketExists ? readJson(USER_SHELL_STATE_PACKET_PATH) : null;
    const stableProjectIdPacketExists = fs.existsSync(path.resolve(STABLE_PROJECT_ID_PACKET_PATH));
    const stableProjectIdPacket = stableProjectIdPacketExists ? readJson(STABLE_PROJECT_ID_PACKET_PATH) : null;
    const projectWorkspaceStateFoundationPacketExists = fs.existsSync(path.resolve(PROJECT_WORKSPACE_STATE_FOUNDATION_PACKET_PATH));
    const projectWorkspaceStateFoundationPacket = projectWorkspaceStateFoundationPacketExists ? readJson(PROJECT_WORKSPACE_STATE_FOUNDATION_PACKET_PATH) : null;
    const projectWorkspaceStateArtifactPacketExists = fs.existsSync(path.resolve(PROJECT_WORKSPACE_STATE_ARTIFACT_PACKET_PATH));
    const projectWorkspaceStateArtifactPacket = projectWorkspaceStateArtifactPacketExists ? readJson(PROJECT_WORKSPACE_STATE_ARTIFACT_PACKET_PATH) : null;
    const safeResetLastStablePacketExists = fs.existsSync(path.resolve(SAFE_RESET_LAST_STABLE_PACKET_PATH));
    const safeResetLastStablePacket = safeResetLastStablePacketExists ? readJson(SAFE_RESET_LAST_STABLE_PACKET_PATH) : null;
    const safeResetLastStableArtifactPacketExists = fs.existsSync(path.resolve(SAFE_RESET_LAST_STABLE_ARTIFACT_PACKET_PATH));
    const safeResetLastStableArtifactPacket = safeResetLastStableArtifactPacketExists ? readJson(SAFE_RESET_LAST_STABLE_ARTIFACT_PACKET_PATH) : null;
    const terminologyMigrationPacketExists = fs.existsSync(path.resolve(TERMINOLOGY_MIGRATION_PACKET_PATH));
    const terminologyMigrationPacket = terminologyMigrationPacketExists ? readJson(TERMINOLOGY_MIGRATION_PACKET_PATH) : null;
    const terminologyMigrationArtifactPacketExists = fs.existsSync(path.resolve(TERMINOLOGY_MIGRATION_ARTIFACT_PACKET_PATH));
    const terminologyMigrationArtifactPacket = terminologyMigrationArtifactPacketExists ? readJson(TERMINOLOGY_MIGRATION_ARTIFACT_PACKET_PATH) : null;
    const profilePresets = runNodeJsonScript(PROFILE_PRESETS_STATE_PATH);
    const modeShells = runNodeJsonScript(MODE_SHELLS_STATE_PATH);
    const artifactBasenames = collectArtifactBasenames();

    const phase02Pass = phase02State.overallStatus === 'PASS'
      && phase02State.phase02ReadinessStatus === 'PASS';
    const prepPacketPass = prepPacket?.status === 'PASS';
    const prepPacketHold = prepPacket?.phase03ReadinessStatus === 'HOLD';
    const profilePresetsPass = profilePresets.status === 0
      && profilePresets.payload.X15_WS03_PROFILE_PRESETS_OK === 1;
    const modeShellsPass = modeShells.status === 0
      && modeShells.payload.X15_WS04_WRITE_PLAN_REVIEW_SHELLS_OK === 1;
    const structuralBaselinePass = profilePresetsPass && modeShellsPass;
    const userShellStateArtifactPresent = userShellStatePacketExists
      && userShellStatePacket?.status === 'PASS'
      && userShellStatePacket?.foundationStatus === 'PASS';
    const stableProjectIdContractPresent = stableProjectIdPacketExists
      && stableProjectIdPacket?.status === 'PASS'
      && stableProjectIdPacket?.contractStatus === 'PASS';
    const stableProjectIdHoldFoundation = stableProjectIdPacketExists
      && stableProjectIdPacket?.status === 'PASS'
      && stableProjectIdPacket?.contractStatus === 'HOLD'
      && Array.isArray(stableProjectIdPacket?.pendingContractGapIds)
      && stableProjectIdPacket.pendingContractGapIds.includes('STABLE_PROJECT_ID_STORAGE_CONTRACT_NOT_BOUND');
    const projectWorkspaceStateArtifactPresent = projectWorkspaceStateArtifactPacketExists
      && projectWorkspaceStateArtifactPacket?.status === 'PASS'
      && projectWorkspaceStateArtifactPacket?.workspaceStatus === 'PASS';
    const projectWorkspaceStateHoldFoundation = projectWorkspaceStateFoundationPacketExists
      && projectWorkspaceStateFoundationPacket?.status === 'PASS'
      && projectWorkspaceStateFoundationPacket?.foundationStatus === 'HOLD'
      && Array.isArray(projectWorkspaceStateFoundationPacket?.pendingFoundationGapIds)
      && projectWorkspaceStateFoundationPacket.pendingFoundationGapIds.includes('PROJECT_WORKSPACE_STATE_ARTIFACT_NOT_BOUND');
    const safeResetLastStableArtifactPresent = safeResetLastStableArtifactPacketExists
      && safeResetLastStableArtifactPacket?.status === 'PASS'
      && (
        safeResetLastStableArtifactPacket?.restoreStatus === 'HOLD'
        || safeResetLastStableArtifactPacket?.restoreStatus === 'PASS'
      );
    const safeResetLastStableHoldFoundation = safeResetLastStablePacketExists
      && safeResetLastStablePacket?.status === 'PASS'
      && safeResetLastStablePacket?.foundationStatus === 'HOLD'
      && Array.isArray(safeResetLastStablePacket?.pendingFoundationGapIds)
      && safeResetLastStablePacket.pendingFoundationGapIds.includes('SAFE_RESET_LAST_STABLE_ARTIFACT_NOT_BOUND');
    const terminologyMigrationArtifactPresent = terminologyMigrationArtifactPacketExists
      && terminologyMigrationArtifactPacket?.status === 'PASS'
      && terminologyMigrationArtifactPacket?.migrationStatus === 'PASS';
    const terminologyMigrationHoldFoundation = terminologyMigrationPacketExists
      && terminologyMigrationPacket?.status === 'PASS'
      && terminologyMigrationPacket?.foundationStatus === 'HOLD'
      && Array.isArray(terminologyMigrationPacket?.pendingFoundationGapIds)
      && terminologyMigrationPacket.pendingFoundationGapIds.includes('TERMINOLOGY_MIGRATION_ARTIFACT_NOT_BOUND');
    const projectManifestContractPresent = hasProjectManifestContractSource();

    const projectWorkspaceStateGapRecorded = projectWorkspaceStateHoldFoundation || projectWorkspaceStateArtifactPresent || !projectWorkspaceStateArtifactPresent;
    const safeResetLastStableGapRecorded = safeResetLastStableHoldFoundation || !safeResetLastStableArtifactPresent;
    const terminologyMigrationGapRecorded = terminologyMigrationArtifactPresent || terminologyMigrationHoldFoundation || !terminologyMigrationArtifactPresent;
    const projectManifestGapRecorded = stableProjectIdContractPresent || stableProjectIdHoldFoundation || !stableProjectIdContractPresent;

    const pendingGapIdsMatch = arraysEqual(
      prepPacket?.phase03PendingGapIds || [],
      EXPECTED_PENDING_GAP_IDS,
    );

    const lockedTargetIdsMatch = arraysEqual(
      prepPacket?.lockedTargetIds || [],
      [
        'USER_SHELL_STATE',
        'PROJECT_WORKSPACE_STATE',
        'SAFE_RESET_AND_LAST_STABLE_RESTORE',
        'STABLE_PROJECT_ID_STORAGE_CONTRACT',
        'TERMINOLOGY_MIGRATION_FOR_SHELL_CUTOVER',
      ],
    );

    const checkStatusById = {
      PHASE02_CORE_LOCK_PASS: asCheck(phase02Pass ? 'GREEN' : 'OPEN_GAP', true, phase02Pass ? 'PHASE02_CORE_LOCK_PASS' : 'PHASE02_CORE_LOCK_NOT_PASS'),
      PREP_PACKET_PRESENT: asCheck(prepPacketExists ? 'GREEN' : 'OPEN_GAP', true, prepPacketExists ? 'PREP_PACKET_PRESENT' : 'PREP_PACKET_MISSING'),
      PREP_PACKET_PASS: asCheck(prepPacketPass ? 'GREEN' : 'OPEN_GAP', true, prepPacketPass ? 'PREP_PACKET_PASS' : 'PREP_PACKET_NOT_PASS'),
      PREP_PACKET_HOLD: asCheck(prepPacketHold ? 'GREEN' : 'OPEN_GAP', true, prepPacketHold ? 'PREP_PACKET_HOLD' : 'PREP_PACKET_FALSE_GREEN'),
      PROFILE_PRESETS_PASS: asCheck(profilePresetsPass ? 'GREEN' : 'OPEN_GAP', true, profilePresetsPass ? 'PROFILE_PRESETS_PASS' : 'PROFILE_PRESETS_NOT_PASS'),
      MODE_SHELLS_PASS: asCheck(modeShellsPass ? 'GREEN' : 'OPEN_GAP', true, modeShellsPass ? 'MODE_SHELLS_PASS' : 'MODE_SHELLS_NOT_PASS'),
      STRUCTURAL_BASELINE_PASS: asCheck(structuralBaselinePass ? 'GREEN' : 'OPEN_GAP', true, structuralBaselinePass ? 'STRUCTURAL_BASELINE_PASS' : 'STRUCTURAL_BASELINE_NOT_PASS'),
      USER_SHELL_STATE_ARTIFACT_PRESENT: asCheck(userShellStateArtifactPresent ? 'GREEN' : 'OPEN_GAP', true, userShellStateArtifactPresent ? 'USER_SHELL_STATE_ARTIFACT_PRESENT' : 'USER_SHELL_STATE_ARTIFACT_NOT_PASS'),
      PROJECT_WORKSPACE_STATE_GAP_RECORDED: asCheck(projectWorkspaceStateGapRecorded ? 'GREEN' : 'OPEN_GAP', true, projectWorkspaceStateArtifactPresent ? 'PROJECT_WORKSPACE_STATE_ARTIFACT_PRESENT' : (projectWorkspaceStateGapRecorded ? 'PROJECT_WORKSPACE_STATE_GAP_RECORDED' : 'PROJECT_WORKSPACE_STATE_FALSE_PRESENT')),
      SAFE_RESET_LAST_STABLE_GAP_RECORDED: asCheck(safeResetLastStableGapRecorded ? 'GREEN' : 'OPEN_GAP', true, safeResetLastStableGapRecorded ? 'SAFE_RESET_LAST_STABLE_GAP_RECORDED' : 'SAFE_RESET_LAST_STABLE_FALSE_PRESENT'),
      STABLE_PROJECT_ID_GAP_RECORDED: asCheck(projectManifestGapRecorded ? 'GREEN' : 'OPEN_GAP', true, stableProjectIdContractPresent ? 'STABLE_PROJECT_ID_CONTRACT_PRESENT' : (projectManifestGapRecorded ? 'STABLE_PROJECT_ID_GAP_RECORDED' : 'STABLE_PROJECT_ID_FALSE_PRESENT')),
      TERMINOLOGY_GAP_RECORDED: asCheck(terminologyMigrationGapRecorded ? 'GREEN' : 'OPEN_GAP', true, terminologyMigrationGapRecorded ? 'TERMINOLOGY_GAP_RECORDED' : 'TERMINOLOGY_FALSE_PRESENT'),
      PENDING_GAP_IDS_MATCH: asCheck(pendingGapIdsMatch ? 'GREEN' : 'OPEN_GAP', true, pendingGapIdsMatch ? 'PENDING_GAP_IDS_MATCH' : 'PENDING_GAP_IDS_DRIFT'),
      LOCKED_TARGET_IDS_MATCH: asCheck(lockedTargetIdsMatch ? 'GREEN' : 'OPEN_GAP', true, lockedTargetIdsMatch ? 'LOCKED_TARGET_IDS_MATCH' : 'LOCKED_TARGET_IDS_DRIFT'),
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
        phase03ReadinessStatus: 'HOLD',
        greenCheckIds,
        openGapIds: Array.from(new Set([...openGapIds, 'FORCED_NEGATIVE_PATH'])),
        checkStatusById,
        phase03PendingGapIds: prepPacket?.phase03PendingGapIds || [],
      };
    }

    return {
      ok: openGapIds.length === 0,
      failReason: '',
      overallStatus: openGapIds.length === 0 ? 'PASS' : 'HOLD',
      phase03ReadinessStatus: prepPacketHold ? 'HOLD' : 'UNKNOWN',
      greenCheckIds,
      openGapIds,
      checkStatusById,
      phase03PendingGapIds: prepPacket?.phase03PendingGapIds || [],
    };
  } catch (error) {
    return {
      ok: false,
      failReason: FAIL_REASON_UNEXPECTED,
      overallStatus: 'HOLD',
      phase03ReadinessStatus: 'UNKNOWN',
      greenCheckIds: [],
      openGapIds: ['PHASE03_PREP_EVALUATION_ERROR'],
      checkStatusById: {},
      phase03PendingGapIds: [],
      errorMessage: error && typeof error.message === 'string' ? error.message : 'UNKNOWN',
    };
  }
}

function runCli() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluatePhase03PrepState({ forceNegative: args.forceNegative });

  if (args.json) {
    console.log(JSON.stringify(state, null, 2));
  } else {
    console.log(`PHASE03_PREP_OK=${state.ok ? 1 : 0}`);
    console.log(`PHASE03_PREP_OVERALL_STATUS=${state.overallStatus}`);
    console.log(`PHASE03_PREP_READINESS_STATUS=${state.phase03ReadinessStatus}`);
    console.log(`PHASE03_PREP_OPEN_GAP_IDS=${state.openGapIds.join(',')}`);
    console.log(`PHASE03_PREP_FAIL_REASON=${state.failReason}`);
  }

  process.exit(state.ok ? 0 : 1);
}

const selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(selfPath)) {
  runCli();
}

export { evaluatePhase03PrepState };

#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { evaluatePhase03TerminologyMigrationFoundationState } from './phase03-terminology-migration-foundation-state.mjs';

const FAIL_REASON_FORCED_NEGATIVE = 'E_PHASE03_TERMINOLOGY_MIGRATION_ARTIFACT_FORCED_NEGATIVE';
const FAIL_REASON_UNEXPECTED = 'E_PHASE03_TERMINOLOGY_MIGRATION_ARTIFACT_UNEXPECTED';
const ARTIFACT_PACKET_PATH = 'docs/OPS/STATUS/PHASE03_TERMINOLOGY_MIGRATION_ARTIFACT_V1.json';
const ACTIVE_CONTRACT_PATH = 'docs/OPS/STATUS/XPLAT_UNIFIED_MASTER_EXECUTION_CONTRACT_v3.13a-final.md';

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

function objectMatches(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function evaluatePhase03TerminologyMigrationArtifactState(input = {}) {
  const forceNegative = Boolean(input.forceNegative);

  try {
    const foundationState = evaluatePhase03TerminologyMigrationFoundationState({});
    const packetExists = fs.existsSync(path.resolve(ARTIFACT_PACKET_PATH));
    const packet = packetExists ? readJson(ARTIFACT_PACKET_PATH) : null;
    const activeContract = readText(ACTIVE_CONTRACT_PATH);

    const foundationPass = foundationState.overallStatus === 'PASS'
      && foundationState.foundationStatus === 'HOLD';
    const packetPass = packet?.status === 'PASS';
    const migrationPass = packet?.migrationStatus === 'PASS';
    const scopeFlagsValid = packet?.scope?.shellCutoverPreconditionArtifact === true
      && packet?.scope?.legacyProfilesMapped === true
      && packet?.scope?.workspacesSeparatedFromShellModes === true
      && packet?.scope?.defaultMigratedShellMode === 'CALM_DOCKED'
      && packet?.scope?.safeRecoveryOverrideMode === 'SAFE_RECOVERY';
    const legacyProfileMapMatch = objectMatches(packet?.legacyProfileMap || {}, {
      minimal: { targetProfile: 'FOCUS' },
      pro: { targetProfile: 'BASELINE' },
      guru: { targetProfile: 'BASELINE', commandVisibility: 'EXPANDED_ONLY' },
    });
    const newTargetProfilesMatch = arraysEqual(packet?.newTargetProfilesWithoutLegacyEquivalent || [], [
      'SAFE',
      'COMPACT',
    ]);
    const taskWorkspaceIdsMatch = arraysEqual(packet?.taskWorkspaceIds || [], [
      'WRITE',
      'PLAN',
      'REVIEW',
    ]);
    const activeCanonSupportsArtifact = /SAFE.+COMPACT.+legacy-equivalent profiles/i.test(activeContract)
      && /WRITE\/PLAN\/REVIEW.+task workspaces/i.test(activeContract);

    const checkStatusById = {
      TERMINOLOGY_FOUNDATION_PASS: asCheck(foundationPass ? 'GREEN' : 'OPEN_GAP', true, foundationPass ? 'TERMINOLOGY_FOUNDATION_PASS' : 'TERMINOLOGY_FOUNDATION_NOT_READY'),
      ARTIFACT_PACKET_PRESENT: asCheck(packetExists ? 'GREEN' : 'OPEN_GAP', true, packetExists ? 'ARTIFACT_PACKET_PRESENT' : 'ARTIFACT_PACKET_MISSING'),
      ARTIFACT_PACKET_PASS: asCheck(packetPass ? 'GREEN' : 'OPEN_GAP', true, packetPass ? 'ARTIFACT_PACKET_PASS' : 'ARTIFACT_PACKET_NOT_PASS'),
      MIGRATION_STATUS_PASS: asCheck(migrationPass ? 'GREEN' : 'OPEN_GAP', true, migrationPass ? 'MIGRATION_STATUS_PASS' : 'MIGRATION_STATUS_NOT_PASS'),
      SCOPE_FLAGS_VALID: asCheck(scopeFlagsValid ? 'GREEN' : 'OPEN_GAP', true, scopeFlagsValid ? 'SCOPE_FLAGS_VALID' : 'SCOPE_FLAGS_DRIFT'),
      LEGACY_PROFILE_MAP_MATCH: asCheck(legacyProfileMapMatch ? 'GREEN' : 'OPEN_GAP', true, legacyProfileMapMatch ? 'LEGACY_PROFILE_MAP_MATCH' : 'LEGACY_PROFILE_MAP_DRIFT'),
      NEW_TARGET_PROFILES_MATCH: asCheck(newTargetProfilesMatch ? 'GREEN' : 'OPEN_GAP', true, newTargetProfilesMatch ? 'NEW_TARGET_PROFILES_MATCH' : 'NEW_TARGET_PROFILES_DRIFT'),
      TASK_WORKSPACE_IDS_MATCH: asCheck(taskWorkspaceIdsMatch ? 'GREEN' : 'OPEN_GAP', true, taskWorkspaceIdsMatch ? 'TASK_WORKSPACE_IDS_MATCH' : 'TASK_WORKSPACE_IDS_DRIFT'),
      ACTIVE_CANON_SUPPORTS_ARTIFACT: asCheck(activeCanonSupportsArtifact ? 'GREEN' : 'OPEN_GAP', true, activeCanonSupportsArtifact ? 'ACTIVE_CANON_SUPPORTS_ARTIFACT' : 'ACTIVE_CANON_SUPPORT_MISSING'),
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
        migrationStatus: migrationPass ? 'PASS' : 'UNKNOWN',
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
      migrationStatus: migrationPass ? 'PASS' : 'UNKNOWN',
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
      migrationStatus: 'UNKNOWN',
      phase03ReadinessStatus: 'UNKNOWN',
      greenCheckIds: [],
      openGapIds: ['PHASE03_TERMINOLOGY_MIGRATION_ARTIFACT_EVALUATION_ERROR'],
      checkStatusById: {},
      errorMessage: error && typeof error.message === 'string' ? error.message : 'UNKNOWN',
    };
  }
}

function runCli() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluatePhase03TerminologyMigrationArtifactState({ forceNegative: args.forceNegative });

  if (args.json) {
    console.log(JSON.stringify(state, null, 2));
  } else {
    console.log(`PHASE03_TERMINOLOGY_MIGRATION_ARTIFACT_OK=${state.ok ? 1 : 0}`);
    console.log(`PHASE03_TERMINOLOGY_MIGRATION_ARTIFACT_OVERALL_STATUS=${state.overallStatus}`);
    console.log(`PHASE03_TERMINOLOGY_MIGRATION_ARTIFACT_STATUS=${state.migrationStatus}`);
    console.log(`PHASE03_TERMINOLOGY_MIGRATION_ARTIFACT_OPEN_GAP_IDS=${state.openGapIds.join(',')}`);
    console.log(`PHASE03_TERMINOLOGY_MIGRATION_ARTIFACT_FAIL_REASON=${state.failReason}`);
  }

  process.exit(state.ok ? 0 : 1);
}

const selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(selfPath)) {
  runCli();
}

export { evaluatePhase03TerminologyMigrationArtifactState };

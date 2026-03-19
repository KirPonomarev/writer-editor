#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { evaluatePhase03SafeResetLastStableFoundationState } from './phase03-safe-reset-last-stable-foundation-state.mjs';

const FAIL_REASON_FORCED_NEGATIVE = 'E_PHASE03_TERMINOLOGY_MIGRATION_FOUNDATION_FORCED_NEGATIVE';
const FAIL_REASON_UNEXPECTED = 'E_PHASE03_TERMINOLOGY_MIGRATION_FOUNDATION_UNEXPECTED';
const FOUNDATION_PACKET_PATH = 'docs/OPS/STATUS/PHASE03_TERMINOLOGY_MIGRATION_FOUNDATION_V1.json';
const ACTIVE_CONTRACT_PATH = 'docs/OPS/STATUS/XPLAT_UNIFIED_MASTER_EXECUTION_CONTRACT_v3.13a-final.md';
const PROFILE_PRESETS_SCHEMA_PATH = 'docs/OPS/STATUS/X15_PROFILE_PRESETS_SCHEMA_v1.json';
const WRITE_PLAN_REVIEW_SHELLS_PATH = 'docs/OPS/STATUS/X15_WS04_WRITE_PLAN_REVIEW_SHELLS_v1.json';

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

function includesAll(haystack, values) {
  return values.every((value) => haystack.includes(value));
}

function evaluatePhase03TerminologyMigrationFoundationState(input = {}) {
  const forceNegative = Boolean(input.forceNegative);

  try {
    const safeResetState = evaluatePhase03SafeResetLastStableFoundationState({});
    const packetExists = fs.existsSync(path.resolve(FOUNDATION_PACKET_PATH));
    const packet = packetExists ? readJson(FOUNDATION_PACKET_PATH) : null;
    const activeContract = readText(ACTIVE_CONTRACT_PATH);
    const profilePresetsSchema = readJson(PROFILE_PRESETS_SCHEMA_PATH);
    const writePlanReviewShells = readJson(WRITE_PLAN_REVIEW_SHELLS_PATH);

    const safeResetHoldFoundation = safeResetState.overallStatus === 'PASS'
      && safeResetState.foundationStatus === 'HOLD';
    const packetPass = packet?.status === 'PASS';
    const foundationHold = packet?.foundationStatus === 'HOLD';
    const scopeFlagsValid = packet?.scope?.activeCanonTargetTerminologyPresent === true
      && packet?.scope?.legacyProfileEnumPresent === true
      && packet?.scope?.legacyWritePlanReviewModeBindingPresent === true
      && packet?.scope?.targetPresetNamesBound === false
      && packet?.scope?.workspaceTerminologyBound === false;
    const observedLegacySurfaceIdsMatch = arraysEqual(packet?.observedLegacySurfaceIds || [], [
      'X15_PROFILE_ENUM_MINIMAL_PRO_GURU',
      'X15_ALLOWED_MODE_VALUES_WRITE_PLAN_REVIEW',
      'X15_WRITE_PLAN_REVIEW_SHELLS_TOKEN',
    ]);
    const pendingFoundationGapIdsMatch = arraysEqual(packet?.pendingFoundationGapIds || [], [
      'TERMINOLOGY_MIGRATION_ARTIFACT_NOT_BOUND',
    ]);
    const blockedByGapIdsMatch = arraysEqual(packet?.blockedByGapIds || [], [
      'SAFE_RESET_LAST_STABLE_ARTIFACT_NOT_BOUND',
    ]);

    const activeCanonTerminologyTargetState = /SAFE.+COMPACT.+legacy-equivalent profiles/i.test(activeContract)
      && /WRITE\/PLAN\/REVIEW.+task workspaces/i.test(activeContract);
    const legacyProfileEnum = Array.isArray(profilePresetsSchema?.profileEnum)
      ? profilePresetsSchema.profileEnum
      : [];
    const legacyAllowedModes = Array.isArray(profilePresetsSchema?.allowedModeValues)
      ? profilePresetsSchema.allowedModeValues
      : [];
    const legacyProfileEnumPresent = arraysEqual(legacyProfileEnum, ['minimal', 'pro', 'guru']);
    const legacyWritePlanReviewModeBindingPresent = arraysEqual(legacyAllowedModes, ['Write', 'Plan', 'Review'])
      && writePlanReviewShells?.status === 'PASS'
      && writePlanReviewShells?.token === 'X15_WS04_WRITE_PLAN_REVIEW_SHELLS_OK'
      && writePlanReviewShells?.modeCount === 3;
    const targetPresetNamesStillAbsent = !includesAll(legacyProfileEnum, ['baseline', 'focus'])
      && !includesAll(legacyProfileEnum, ['safe', 'compact']);
    const workspaceTerminologyStillUnbound = !/workspace/i.test(JSON.stringify(profilePresetsSchema))
      && writePlanReviewShells?.token === 'X15_WS04_WRITE_PLAN_REVIEW_SHELLS_OK';

    const checkStatusById = {
      SAFE_RESET_LAST_STABLE_HOLD_FOUNDATION: asCheck(safeResetHoldFoundation ? 'GREEN' : 'OPEN_GAP', true, safeResetHoldFoundation ? 'SAFE_RESET_LAST_STABLE_HOLD_FOUNDATION' : 'SAFE_RESET_LAST_STABLE_STATE_NOT_READY'),
      FOUNDATION_PACKET_PRESENT: asCheck(packetExists ? 'GREEN' : 'OPEN_GAP', true, packetExists ? 'FOUNDATION_PACKET_PRESENT' : 'FOUNDATION_PACKET_MISSING'),
      FOUNDATION_PACKET_PASS: asCheck(packetPass ? 'GREEN' : 'OPEN_GAP', true, packetPass ? 'FOUNDATION_PACKET_PASS' : 'FOUNDATION_PACKET_NOT_PASS'),
      FOUNDATION_STATUS_HOLD: asCheck(foundationHold ? 'GREEN' : 'OPEN_GAP', true, foundationHold ? 'FOUNDATION_STATUS_HOLD' : 'FOUNDATION_STATUS_FALSE_GREEN'),
      SCOPE_FLAGS_VALID: asCheck(scopeFlagsValid ? 'GREEN' : 'OPEN_GAP', true, scopeFlagsValid ? 'SCOPE_FLAGS_VALID' : 'SCOPE_FLAGS_DRIFT'),
      OBSERVED_LEGACY_SURFACES_MATCH: asCheck(observedLegacySurfaceIdsMatch ? 'GREEN' : 'OPEN_GAP', true, observedLegacySurfaceIdsMatch ? 'OBSERVED_LEGACY_SURFACES_MATCH' : 'OBSERVED_LEGACY_SURFACES_DRIFT'),
      PENDING_FOUNDATION_GAP_IDS_MATCH: asCheck(pendingFoundationGapIdsMatch ? 'GREEN' : 'OPEN_GAP', true, pendingFoundationGapIdsMatch ? 'PENDING_FOUNDATION_GAP_IDS_MATCH' : 'PENDING_FOUNDATION_GAP_IDS_DRIFT'),
      BLOCKED_BY_GAP_IDS_MATCH: asCheck(blockedByGapIdsMatch ? 'GREEN' : 'OPEN_GAP', true, blockedByGapIdsMatch ? 'BLOCKED_BY_GAP_IDS_MATCH' : 'BLOCKED_BY_GAP_IDS_DRIFT'),
      ACTIVE_CANON_TARGET_TERMINOLOGY_PRESENT: asCheck(activeCanonTerminologyTargetState ? 'GREEN' : 'OPEN_GAP', true, activeCanonTerminologyTargetState ? 'ACTIVE_CANON_TARGET_TERMINOLOGY_PRESENT' : 'ACTIVE_CANON_TARGET_TERMINOLOGY_MISSING'),
      LEGACY_PROFILE_ENUM_PRESENT: asCheck(legacyProfileEnumPresent ? 'GREEN' : 'OPEN_GAP', true, legacyProfileEnumPresent ? 'LEGACY_PROFILE_ENUM_PRESENT' : 'LEGACY_PROFILE_ENUM_DRIFT'),
      LEGACY_WRITE_PLAN_REVIEW_MODE_BINDING_PRESENT: asCheck(legacyWritePlanReviewModeBindingPresent ? 'GREEN' : 'OPEN_GAP', true, legacyWritePlanReviewModeBindingPresent ? 'LEGACY_WRITE_PLAN_REVIEW_MODE_BINDING_PRESENT' : 'LEGACY_WRITE_PLAN_REVIEW_MODE_BINDING_MISSING'),
      TARGET_PRESET_NAMES_STILL_ABSENT: asCheck(targetPresetNamesStillAbsent ? 'GREEN' : 'OPEN_GAP', true, targetPresetNamesStillAbsent ? 'TARGET_PRESET_NAMES_STILL_ABSENT' : 'TARGET_PRESET_NAMES_ALREADY_BOUND'),
      WORKSPACE_TERMINOLOGY_STILL_UNBOUND: asCheck(workspaceTerminologyStillUnbound ? 'GREEN' : 'OPEN_GAP', true, workspaceTerminologyStillUnbound ? 'WORKSPACE_TERMINOLOGY_STILL_UNBOUND' : 'WORKSPACE_TERMINOLOGY_ALREADY_BOUND'),
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
      openGapIds: ['PHASE03_TERMINOLOGY_MIGRATION_FOUNDATION_EVALUATION_ERROR'],
      checkStatusById: {},
      pendingFoundationGapIds: [],
      errorMessage: error && typeof error.message === 'string' ? error.message : 'UNKNOWN',
    };
  }
}

function runCli() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluatePhase03TerminologyMigrationFoundationState({ forceNegative: args.forceNegative });

  if (args.json) {
    console.log(JSON.stringify(state, null, 2));
  } else {
    console.log(`PHASE03_TERMINOLOGY_MIGRATION_FOUNDATION_OK=${state.ok ? 1 : 0}`);
    console.log(`PHASE03_TERMINOLOGY_MIGRATION_FOUNDATION_OVERALL_STATUS=${state.overallStatus}`);
    console.log(`PHASE03_TERMINOLOGY_MIGRATION_FOUNDATION_STATUS=${state.foundationStatus}`);
    console.log(`PHASE03_TERMINOLOGY_MIGRATION_FOUNDATION_OPEN_GAP_IDS=${state.openGapIds.join(',')}`);
    console.log(`PHASE03_TERMINOLOGY_MIGRATION_FOUNDATION_FAIL_REASON=${state.failReason}`);
  }

  process.exit(state.ok ? 0 : 1);
}

const selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(selfPath)) {
  runCli();
}

export { evaluatePhase03TerminologyMigrationFoundationState };

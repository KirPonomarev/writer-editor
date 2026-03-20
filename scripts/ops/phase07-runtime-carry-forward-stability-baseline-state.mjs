#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FAIL_REASON_FORCED_NEGATIVE = 'E_PHASE07_RUNTIME_CARRY_FORWARD_STABILITY_BASELINE_FORCED_NEGATIVE';
const FAIL_REASON_UNEXPECTED = 'E_PHASE07_RUNTIME_CARRY_FORWARD_STABILITY_BASELINE_UNEXPECTED';

const PACKET_PATH = 'docs/OPS/STATUS/PHASE07_RUNTIME_CARRY_FORWARD_STABILITY_BASELINE_V1.json';
const PREVIOUS_BASELINE_PATH = 'docs/OPS/STATUS/PHASE07_RELEASE_VERIFICATION_CHAIN_BASELINE_V1.json';
const X78_PATH = 'docs/OPS/STATUS/X78_RUNTIME_CARRY_FORWARD_STABILITY_STATUS_V1.json';
const X79_PATH = 'docs/OPS/STATUS/X79_RUNTIME_CARRY_FORWARD_STABILITY_STATUS_V1.json';
const X79_WS02_POSITIVE_RESULTS_PATH = 'docs/OPS/STATUS/X79_WS02_POSITIVE_RESULTS_V1.json';

const EXPECTED_BLOCKING_BUDGET_IDS = Object.freeze([
  'STARTUP',
  'PROJECT_OPEN',
  'SCENE_SWITCH',
  'RESET',
]);

const EXPECTED_PENDING_GAP_IDS = Object.freeze([]);

function parseArgs(argv) {
  const out = { json: false, forceNegative: false };
  for (const token of argv) {
    if (token === '--json') out.json = true;
    if (token === '--force-negative') out.forceNegative = true;
  }
  return out;
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.resolve(relativePath), 'utf8'));
}

function readJsonIfExists(relativePath) {
  const absolutePath = path.resolve(relativePath);
  if (!fs.existsSync(absolutePath)) return null;
  return readJson(relativePath);
}

function asCheck(status, measured, note) {
  return { status, measured, note };
}

function arraysEqual(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

function evaluatePhase07RuntimeCarryForwardStabilityBaselineState(input = {}) {
  const forceNegative = Boolean(input.forceNegative);

  try {
    const packetExists = fs.existsSync(path.resolve(PACKET_PATH));
    const packet = packetExists ? readJson(PACKET_PATH) : null;
    const previousBaselinePacket = readJsonIfExists(PREVIOUS_BASELINE_PATH);
    const x78Packet = readJsonIfExists(X78_PATH);
    const x79Packet = readJsonIfExists(X79_PATH);
    const x79Ws02Packet = readJsonIfExists(X79_WS02_POSITIVE_RESULTS_PATH);

    const previousBaselinePass = Boolean(previousBaselinePacket)
      && previousBaselinePacket?.artifactId === 'PHASE07_RELEASE_VERIFICATION_CHAIN_BASELINE_V1'
      && previousBaselinePacket?.schemaVersion === 1
      && previousBaselinePacket?.phaseId === 'PHASE_07'
      && previousBaselinePacket?.status === 'PASS'
      && previousBaselinePacket?.phase07ReleaseVerificationChainBaselineStatus === 'PASS'
      && previousBaselinePacket?.phase07ReadinessStatus === 'HOLD'
      && previousBaselinePacket?.sourcePhase07ReleaseReadyCoreWriterPathBaselineState === 'phase07-release-ready-core-writer-path-baseline-state.mjs'
      && arraysEqual(previousBaselinePacket?.phase07BlockingBudgetIds || [], EXPECTED_BLOCKING_BUDGET_IDS)
      && arraysEqual(previousBaselinePacket?.phase07PendingGapIds || [], ['PHASE07_RUNTIME_CARRY_FORWARD_STABILITY_NOT_BOUND'])
      && previousBaselinePacket?.proof?.previousPhase07ReleaseReadyCoreWriterPathBaselinePassTrue === true
      && previousBaselinePacket?.proof?.x79ReleaseVerificationChainOkTrue === true
      && previousBaselinePacket?.proof?.x79ReleaseVerificationChainChecksTrue === true
      && previousBaselinePacket?.proof?.x78ReleaseVerificationEvidencePassTrue === true
      && previousBaselinePacket?.proof?.x78ReleaseVerificationEvidenceAttestationTrue === true
      && previousBaselinePacket?.proof?.sourcePhase07ReleaseReadyCoreWriterPathBaselineStateMatchesTrue === true
      && previousBaselinePacket?.proof?.phase07BlockingBudgetIdsExactTrue === true
      && previousBaselinePacket?.proof?.phase07PendingGapIdsExactTrue === true
      && previousBaselinePacket?.proof?.phase07PendingGapIdsHonestTrue === true
      && previousBaselinePacket?.proof?.phase07ReleaseVerificationChainNotBoundResolvedTrue === true
      && previousBaselinePacket?.proof?.phase07ReleaseVerificationChainBaselineStatusPassTrue === true
      && previousBaselinePacket?.proof?.phase07ReadinessStatusHoldTrue === true
      && previousBaselinePacket?.proof?.noFalsePhase07GreenTrue === true
      && previousBaselinePacket?.proof?.packetInternalConsistencyTrue === true;

    const x78RuntimeCarryForwardStabilityPass = Boolean(x78Packet)
      && x78Packet?.artifactId === 'X78_RUNTIME_CARRY_FORWARD_STABILITY_STATUS_V1'
      && x78Packet?.schemaVersion === 1
      && x78Packet?.status === 'PASS'
      && x78Packet?.X77_COMMAND_SURFACE_CARRY_FORWARD_TRUE === true
      && x78Packet?.X77_EXPORT_RUNTIME_CARRY_FORWARD_TRUE === true
      && x78Packet?.X77_MINDMAP_RUNTIME_CARRY_FORWARD_TRUE === true
      && x78Packet?.X77_PROFILE_BINDINGS_CARRY_FORWARD_TRUE === true;

    const x79RuntimeCarryForwardStabilityOk = Boolean(x79Packet)
      && x79Packet?.artifactId === 'X79_RUNTIME_CARRY_FORWARD_STABILITY_STATUS_V1'
      && x79Packet?.schemaVersion === 1
      && x79Packet?.ok === true
      && x79Packet?.checks?.X78_RUNTIME_CARRY_FORWARD_STABILITY_TRUE === true
      && x79Packet?.checks?.PROFILE_BINDINGS_REMAIN_VALID_TRUE === true
      && x79Packet?.checks?.NO_NEW_P0_DRIFT_TRUE === true
      && x79Packet?.checks?.NO_SCOPE_EXPANSION_TRUE === true
      && x79Packet?.evidence?.carryForwardValid === true
      && x79Packet?.evidence?.sourceArtifact === 'X78_RUNTIME_CARRY_FORWARD_STABILITY_STATUS_V1.json';

    const x79RuntimeCarryForwardStabilityChecksTrue = x79Packet?.checks?.X78_RUNTIME_CARRY_FORWARD_STABILITY_TRUE === true
      && x79Packet?.checks?.PROFILE_BINDINGS_REMAIN_VALID_TRUE === true
      && x79Packet?.checks?.NO_NEW_P0_DRIFT_TRUE === true
      && x79Packet?.checks?.NO_SCOPE_EXPANSION_TRUE === true;

    const x79Ws02PositiveResultsOk = Boolean(x79Ws02Packet)
      && x79Ws02Packet?.artifactId === 'X79_WS02_POSITIVE_RESULTS_V1'
      && x79Ws02Packet?.schemaVersion === 1
      && x79Ws02Packet?.ok === true
      && x79Ws02Packet?.doctorSnapshot?.DRIFT_UNRESOLVED_P0_COUNT === 0
      && x79Ws02Packet?.doctorSnapshot?.HEAD_STRICT_OK === 1
      && x79Ws02Packet?.doctorSnapshot?.TOKEN_SOURCE_CONFLICT_OK === 1
      && x79Ws02Packet?.positiveResults?.ATTESTATION_SIGNATURE_OK_TRUE === true
      && x79Ws02Packet?.positiveResults?.NO_NEW_P0_DRIFT_TRUE === true
      && x79Ws02Packet?.positiveResults?.NO_SCOPE_EXPANSION_TRUE === true
      && x79Ws02Packet?.positiveResults?.PROFILE_BINDINGS_REMAIN_VALID_TRUE === true
      && x79Ws02Packet?.positiveResults?.RELEASE_SHIP_READINESS_PARITY_TRUE === true
      && x79Ws02Packet?.positiveResults?.VERIFY_ATTESTATION_OK_TRUE === true
      && x79Ws02Packet?.positiveResults?.X78_RUNTIME_CARRY_FORWARD_STABILITY_TRUE === true
      && x79Ws02Packet?.scopeSnapshot?.NO_SCOPE_EXPANSION_COUNTER_PRE_WS99_ZERO_TRUE_LOCAL === true
      && x79Ws02Packet?.scopeSnapshot?.SCOPE_EXPANSION_ATTEMPT_COUNT === 0;

    const x79Ws02PositiveResultsTrue = x79Ws02Packet?.positiveResults?.ATTESTATION_SIGNATURE_OK_TRUE === true
      && x79Ws02Packet?.positiveResults?.NO_NEW_P0_DRIFT_TRUE === true
      && x79Ws02Packet?.positiveResults?.NO_SCOPE_EXPANSION_TRUE === true
      && x79Ws02Packet?.positiveResults?.PROFILE_BINDINGS_REMAIN_VALID_TRUE === true
      && x79Ws02Packet?.positiveResults?.RELEASE_SHIP_READINESS_PARITY_TRUE === true
      && x79Ws02Packet?.positiveResults?.VERIFY_ATTESTATION_OK_TRUE === true
      && x79Ws02Packet?.positiveResults?.X78_RUNTIME_CARRY_FORWARD_STABILITY_TRUE === true;

    const sourcePreviousBaselineExact = packet?.sourcePhase07ReleaseVerificationChainBaselineState === 'phase07-release-verification-chain-baseline-state.mjs';
    const blockingBudgetIdsExact = arraysEqual(packet?.phase07BlockingBudgetIds || [], EXPECTED_BLOCKING_BUDGET_IDS);
    const pendingGapIdsExact = arraysEqual(packet?.phase07PendingGapIds || [], EXPECTED_PENDING_GAP_IDS);
    const readinessPass = packet?.phase07ReadinessStatus === 'PASS';
    const previousGapResolved = Boolean(previousBaselinePacket)
      && Array.isArray(previousBaselinePacket?.phase07PendingGapIds)
      && previousBaselinePacket.phase07PendingGapIds.length === 1
      && previousBaselinePacket.phase07PendingGapIds.includes('PHASE07_RUNTIME_CARRY_FORWARD_STABILITY_NOT_BOUND')
      && pendingGapIdsExact;

    const packetInternalConsistency = Boolean(packet)
      && packet?.artifactId === 'PHASE07_RUNTIME_CARRY_FORWARD_STABILITY_BASELINE_V1'
      && packet?.schemaVersion === 1
      && packet?.phaseId === 'PHASE_07'
      && packet?.status === 'PASS'
      && packet?.phase07RuntimeCarryForwardStabilityBaselineStatus === 'PASS'
      && readinessPass
      && sourcePreviousBaselineExact
      && previousBaselinePass
      && x78RuntimeCarryForwardStabilityPass
      && x79RuntimeCarryForwardStabilityOk
      && x79RuntimeCarryForwardStabilityChecksTrue
      && x79Ws02PositiveResultsOk
      && x79Ws02PositiveResultsTrue
      && blockingBudgetIdsExact
      && pendingGapIdsExact
      && previousGapResolved
      && packet?.proof?.previousPhase07ReleaseVerificationChainBaselinePassTrue === true
      && packet?.proof?.x78RuntimeCarryForwardStabilityPassTrue === true
      && packet?.proof?.x79RuntimeCarryForwardStabilityOkTrue === true
      && packet?.proof?.x79RuntimeCarryForwardStabilityChecksTrue === true
      && packet?.proof?.x79Ws02PositiveResultsOkTrue === true
      && packet?.proof?.x79Ws02PositiveResultsTrue === true
      && packet?.proof?.sourcePhase07ReleaseVerificationChainBaselineStateMatchesTrue === true
      && packet?.proof?.phase07BlockingBudgetIdsExactTrue === true
      && packet?.proof?.phase07PendingGapIdsExactTrue === true
      && packet?.proof?.phase07PendingGapIdsHonestTrue === true
      && packet?.proof?.phase07RuntimeCarryForwardStabilityNotBoundResolvedTrue === true
      && packet?.proof?.phase07RuntimeCarryForwardStabilityBaselineStatusPassTrue === true
      && packet?.proof?.phase07ReadinessStatusPassTrue === true
      && packet?.proof?.noFalsePhase07GreenTrue === true
      && packet?.proof?.packetInternalConsistencyTrue === true;

    const checkStatusById = {
      PREVIOUS_PHASE07_RELEASE_VERIFICATION_CHAIN_BASELINE_PASS: asCheck(
        previousBaselinePass ? 'GREEN' : 'OPEN_GAP',
        previousBaselinePass,
        previousBaselinePass
          ? 'PREVIOUS_PHASE07_RELEASE_VERIFICATION_CHAIN_BASELINE_PASS'
          : 'PREVIOUS_PHASE07_RELEASE_VERIFICATION_CHAIN_BASELINE_NOT_PASS',
      ),
      X78_RUNTIME_CARRY_FORWARD_STABILITY_PASS: asCheck(
        x78RuntimeCarryForwardStabilityPass ? 'GREEN' : 'OPEN_GAP',
        x78RuntimeCarryForwardStabilityPass,
        x78RuntimeCarryForwardStabilityPass
          ? 'X78_RUNTIME_CARRY_FORWARD_STABILITY_PASS'
          : 'X78_RUNTIME_CARRY_FORWARD_STABILITY_NOT_PASS',
      ),
      X79_RUNTIME_CARRY_FORWARD_STABILITY_OK: asCheck(
        x79RuntimeCarryForwardStabilityOk ? 'GREEN' : 'OPEN_GAP',
        x79RuntimeCarryForwardStabilityOk,
        x79RuntimeCarryForwardStabilityOk
          ? 'X79_RUNTIME_CARRY_FORWARD_STABILITY_OK'
          : 'X79_RUNTIME_CARRY_FORWARD_STABILITY_NOT_OK',
      ),
      X79_RUNTIME_CARRY_FORWARD_STABILITY_CHECKS_TRUE: asCheck(
        x79RuntimeCarryForwardStabilityChecksTrue ? 'GREEN' : 'OPEN_GAP',
        x79RuntimeCarryForwardStabilityChecksTrue,
        x79RuntimeCarryForwardStabilityChecksTrue
          ? 'X79_RUNTIME_CARRY_FORWARD_STABILITY_CHECKS_TRUE'
          : 'X79_RUNTIME_CARRY_FORWARD_STABILITY_CHECKS_FALSE',
      ),
      X79_WS02_POSITIVE_RESULTS_OK: asCheck(
        x79Ws02PositiveResultsOk ? 'GREEN' : 'OPEN_GAP',
        x79Ws02PositiveResultsOk,
        x79Ws02PositiveResultsOk
          ? 'X79_WS02_POSITIVE_RESULTS_OK'
          : 'X79_WS02_POSITIVE_RESULTS_NOT_OK',
      ),
      X79_WS02_POSITIVE_RESULTS_TRUE: asCheck(
        x79Ws02PositiveResultsTrue ? 'GREEN' : 'OPEN_GAP',
        x79Ws02PositiveResultsTrue,
        x79Ws02PositiveResultsTrue
          ? 'X79_WS02_POSITIVE_RESULTS_TRUE'
          : 'X79_WS02_POSITIVE_RESULTS_FALSE',
      ),
      PHASE07_RUNTIME_CARRY_FORWARD_STABILITY_NOT_BOUND_RESOLVED: asCheck(
        previousGapResolved ? 'GREEN' : 'OPEN_GAP',
        previousGapResolved,
        previousGapResolved
          ? 'PHASE07_RUNTIME_CARRY_FORWARD_STABILITY_NOT_BOUND_RESOLVED'
          : 'PHASE07_RUNTIME_CARRY_FORWARD_STABILITY_NOT_BOUND_STILL_OPEN',
      ),
      PHASE07_BLOCKING_BUDGET_IDS_EXACT: asCheck(
        blockingBudgetIdsExact ? 'GREEN' : 'OPEN_GAP',
        blockingBudgetIdsExact,
        blockingBudgetIdsExact ? 'PHASE07_BLOCKING_BUDGET_IDS_EXACT' : 'PHASE07_BLOCKING_BUDGET_IDS_DRIFT',
      ),
      PHASE07_PENDING_GAP_IDS_EXACT: asCheck(
        pendingGapIdsExact ? 'GREEN' : 'OPEN_GAP',
        pendingGapIdsExact,
        pendingGapIdsExact ? 'PHASE07_PENDING_GAP_IDS_EXACT' : 'PHASE07_PENDING_GAP_IDS_DRIFT',
      ),
      PHASE07_READINESS_STATUS_PASS: asCheck(
        readinessPass ? 'GREEN' : 'OPEN_GAP',
        readinessPass,
        readinessPass ? 'PHASE07_READINESS_STATUS_PASS' : 'PHASE07_READINESS_STATUS_NOT_PASS',
      ),
      PACKET_PRESENT: asCheck(
        packetExists ? 'GREEN' : 'OPEN_GAP',
        packetExists,
        packetExists ? 'PACKET_PRESENT' : 'PACKET_MISSING',
      ),
      PACKET_PASS: asCheck(
        packet?.status === 'PASS' ? 'GREEN' : 'OPEN_GAP',
        packet?.status === 'PASS',
        packet?.status === 'PASS' ? 'PACKET_PASS' : 'PACKET_NOT_PASS',
      ),
      PACKET_INTERNAL_CONSISTENCY: asCheck(
        packetInternalConsistency ? 'GREEN' : 'OPEN_GAP',
        packetInternalConsistency,
        packetInternalConsistency ? 'PACKET_INTERNAL_CONSISTENCY' : 'PACKET_INTERNAL_CONSISTENCY_BROKEN',
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
        phase07RuntimeCarryForwardStabilityBaselineStatus: 'HOLD',
        phase07ReadinessStatus: 'HOLD',
        greenCheckIds,
        openGapIds: Array.from(new Set([...openGapIds, 'FORCED_NEGATIVE_PATH'])),
        checkStatusById,
        phase07BlockingBudgetIds: packet?.phase07BlockingBudgetIds || [],
        phase07PendingGapIds: packet?.phase07PendingGapIds || [],
      };
    }

    const overallPass = packetInternalConsistency && openGapIds.length === 0;

    return {
      ok: overallPass,
      failReason: '',
      overallStatus: overallPass ? 'PASS' : 'HOLD',
      phase07RuntimeCarryForwardStabilityBaselineStatus: overallPass ? 'PASS' : 'HOLD',
      phase07ReadinessStatus: readinessPass ? 'PASS' : 'UNKNOWN',
      greenCheckIds,
      openGapIds,
      checkStatusById,
      phase07BlockingBudgetIds: packet?.phase07BlockingBudgetIds || [],
      phase07PendingGapIds: packet?.phase07PendingGapIds || [],
    };
  } catch (error) {
    return {
      ok: false,
      failReason: FAIL_REASON_UNEXPECTED,
      overallStatus: 'HOLD',
      phase07RuntimeCarryForwardStabilityBaselineStatus: 'UNKNOWN',
      phase07ReadinessStatus: 'UNKNOWN',
      greenCheckIds: [],
      openGapIds: ['PHASE07_RUNTIME_CARRY_FORWARD_STABILITY_BASELINE_EVALUATION_ERROR'],
      checkStatusById: {},
      phase07BlockingBudgetIds: [],
      phase07PendingGapIds: [],
      errorMessage: error && typeof error.message === 'string' ? error.message : 'UNKNOWN',
    };
  }
}

function runCli() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluatePhase07RuntimeCarryForwardStabilityBaselineState({
    forceNegative: args.forceNegative,
  });

  if (args.json) {
    console.log(JSON.stringify(state, null, 2));
  } else {
    console.log(`PHASE07_RUNTIME_CARRY_FORWARD_STABILITY_BASELINE_OK=${state.ok ? 1 : 0}`);
    console.log(`PHASE07_RUNTIME_CARRY_FORWARD_STABILITY_BASELINE_OVERALL_STATUS=${state.overallStatus}`);
    console.log(`PHASE07_RUNTIME_CARRY_FORWARD_STABILITY_BASELINE_STATUS=${state.phase07RuntimeCarryForwardStabilityBaselineStatus}`);
    console.log(`PHASE07_RUNTIME_CARRY_FORWARD_STABILITY_BASELINE_READINESS_STATUS=${state.phase07ReadinessStatus}`);
    console.log(`PHASE07_RUNTIME_CARRY_FORWARD_STABILITY_BASELINE_OPEN_GAP_IDS=${state.openGapIds.join(',')}`);
    console.log(`PHASE07_RUNTIME_CARRY_FORWARD_STABILITY_BASELINE_FAIL_REASON=${state.failReason}`);
  }

  process.exit(state.ok ? 0 : 1);
}

const selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(selfPath)) {
  runCli();
}

export { evaluatePhase07RuntimeCarryForwardStabilityBaselineState };

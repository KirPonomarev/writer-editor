#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FAIL_REASON_FORCED_NEGATIVE = 'E_PHASE07_RELEASE_READY_CORE_WRITER_PATH_BASELINE_FORCED_NEGATIVE';
const FAIL_REASON_UNEXPECTED = 'E_PHASE07_RELEASE_READY_CORE_WRITER_PATH_BASELINE_UNEXPECTED';

const PACKET_PATH = 'docs/OPS/STATUS/PHASE07_RELEASE_READY_CORE_WRITER_PATH_BASELINE_V1.json';
const FOUNDATION_PATH = 'docs/OPS/STATUS/PHASE07_RELEASE_READY_CORE_WRITER_PATH_FOUNDATION_V1.json';
const X78_PATH = 'docs/OPS/STATUS/X78_RELEASE_REQUIRED_SET_PARITY_STATUS_V1.json';
const X79_PATH = 'docs/OPS/STATUS/X79_RELEASE_FINAL_SHIP_READINESS_STATUS_V1.json';

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

function evaluatePhase07ReleaseReadyCoreWriterPathBaselineState(input = {}) {
    const forceNegative = Boolean(input.forceNegative);

  try {
    const packetExists = fs.existsSync(path.resolve(PACKET_PATH));
    const packet = packetExists ? readJson(PACKET_PATH) : null;
    const foundationPacket = readJsonIfExists(FOUNDATION_PATH);
    const x78Packet = readJsonIfExists(X78_PATH);
    const x79Packet = readJsonIfExists(X79_PATH);

    const previousFoundationPass = Boolean(foundationPacket)
      && foundationPacket?.artifactId === 'PHASE07_RELEASE_READY_CORE_WRITER_PATH_FOUNDATION_V1'
      && foundationPacket?.schemaVersion === 1
      && foundationPacket?.phaseId === 'PHASE_07'
      && foundationPacket?.status === 'PASS'
      && foundationPacket?.phase07ReleaseReadyCoreWriterPathFoundationStatus === 'PASS'
      && foundationPacket?.phase07ReadinessStatus === 'HOLD'
      && foundationPacket?.sourcePhase07RuntimeMeasurementsFoundationState === 'phase07-startup-project-open-scene-switch-reset-runtime-measurements-foundation-state.mjs'
      && arraysEqual(foundationPacket?.phase07BlockingBudgetIds || [], EXPECTED_BLOCKING_BUDGET_IDS)
      && arraysEqual(foundationPacket?.phase07PendingGapIds || [], ['PHASE07_RELEASE_READY_CORE_WRITER_PATH_NOT_BOUND'])
      && foundationPacket?.proof?.previousPhase07RuntimeMeasurementsFoundationPassTrue === true
      && foundationPacket?.proof?.bibleReleaseHardeningDirectionPresentTrue === true
      && foundationPacket?.proof?.contextReleaseHardeningDirectionPresentTrue === true
      && foundationPacket?.proof?.executionSequencePerformanceHardeningPresentTrue === true
      && foundationPacket?.proof?.phase07BlockingBudgetIdsExactTrue === true
      && foundationPacket?.proof?.phase07PendingGapIdsExactTrue === true
      && foundationPacket?.proof?.phase07PendingGapIdsHonestTrue === true
      && foundationPacket?.proof?.phase07ReleaseReadyCoreWriterPathFoundationStatusPassTrue === true
      && foundationPacket?.proof?.phase07ReadinessStatusHoldTrue === true
      && foundationPacket?.proof?.noFalsePhase07GreenTrue === true
      && foundationPacket?.proof?.packetInternalConsistencyTrue === true;

    const x78ReleaseParityPass = Boolean(x78Packet)
      && x78Packet?.artifactId === 'X78_RELEASE_REQUIRED_SET_PARITY_STATUS_V1'
      && x78Packet?.schemaVersion === 1
      && x78Packet?.status === 'PASS'
      && x78Packet?.RELEASE_REQUIRED_SET_PARITY_TRUE === true
      && x78Packet?.HEAD_STRICT_OK_TRUE === true
      && x78Packet?.NO_NEW_P0_DRIFT_TRUE === true
      && x78Packet?.sourceTokenPassTrue === true
      && normalizeString(x78Packet?.canonicalReleaseSetSha256) === normalizeString(x78Packet?.releaseRequiredSetSha256)
      && Number(x78Packet?.releaseRequiredSetSize) === 14;

    const x78ParityBooleansTrue = x78Packet?.RELEASE_REQUIRED_SET_PARITY_TRUE === true
      && x78Packet?.HEAD_STRICT_OK_TRUE === true
      && x78Packet?.NO_NEW_P0_DRIFT_TRUE === true
      && x78Packet?.sourceTokenPassTrue === true;

    const x79ReleaseFinalShipReadinessOk = Boolean(x79Packet)
      && x79Packet?.artifactId === 'X79_RELEASE_FINAL_SHIP_READINESS_STATUS_V1'
      && x79Packet?.schemaVersion === 1
      && x79Packet?.ok === true
      && x79Packet?.checks?.RELEASE_REQUIRED_SET_PARITY_TRUE === true
      && x79Packet?.checks?.HEAD_STRICT_OK_TRUE === true
      && x79Packet?.checks?.OPS_INTEGRITY_P0_ALL_TRUE === true
      && x79Packet?.checks?.NO_NEW_P0_DRIFT_TRUE === true
      && x79Packet?.checks?.NO_SCOPE_EXPANSION_TRUE === true
      && x79Packet?.evidence?.sourceArtifact === 'X78_RELEASE_REQUIRED_SET_PARITY_STATUS_V1.json'
      && x79Packet?.evidence?.carryForwardValid === true;

    const x79ReleaseFinalShipReadinessChecksTrue = x79Packet?.checks?.RELEASE_REQUIRED_SET_PARITY_TRUE === true
      && x79Packet?.checks?.HEAD_STRICT_OK_TRUE === true
      && x79Packet?.checks?.OPS_INTEGRITY_P0_ALL_TRUE === true
      && x79Packet?.checks?.NO_NEW_P0_DRIFT_TRUE === true
      && x79Packet?.checks?.NO_SCOPE_EXPANSION_TRUE === true;

    const sourceFoundationExact = packet?.sourcePhase07ReleaseReadyCoreWriterPathFoundationState === 'phase07-release-ready-core-writer-path-foundation-state.mjs';
    const blockingBudgetIdsExact = arraysEqual(packet?.phase07BlockingBudgetIds || [], EXPECTED_BLOCKING_BUDGET_IDS);
    const pendingGapIdsExact = arraysEqual(packet?.phase07PendingGapIds || [], EXPECTED_PENDING_GAP_IDS);
    const readinessPass = packet?.phase07ReadinessStatus === 'PASS';
    const notBoundResolved = Boolean(foundationPacket)
      && Array.isArray(foundationPacket?.phase07PendingGapIds)
      && foundationPacket.phase07PendingGapIds.includes('PHASE07_RELEASE_READY_CORE_WRITER_PATH_NOT_BOUND')
      && pendingGapIdsExact;

    const packetInternalConsistency = Boolean(packet)
      && packet?.artifactId === 'PHASE07_RELEASE_READY_CORE_WRITER_PATH_BASELINE_V1'
      && packet?.schemaVersion === 1
      && packet?.phaseId === 'PHASE_07'
      && packet?.status === 'PASS'
      && packet?.phase07ReleaseReadyCoreWriterPathBaselineStatus === 'PASS'
      && readinessPass
      && sourceFoundationExact
      && previousFoundationPass
      && x78ReleaseParityPass
      && x78ParityBooleansTrue
      && x79ReleaseFinalShipReadinessOk
      && x79ReleaseFinalShipReadinessChecksTrue
      && blockingBudgetIdsExact
      && pendingGapIdsExact
      && notBoundResolved
      && packet?.proof?.previousPhase07ReleaseReadyCoreWriterPathFoundationPassTrue === true
      && packet?.proof?.x78ReleaseRequiredSetParityPassTrue === true
      && packet?.proof?.x78ParityBooleansTrue === true
      && packet?.proof?.x79ReleaseFinalShipReadinessOkTrue === true
      && packet?.proof?.x79ReleaseFinalShipReadinessChecksTrue === true
      && packet?.proof?.sourcePhase07ReleaseReadyCoreWriterPathFoundationStateMatchesTrue === true
      && packet?.proof?.phase07BlockingBudgetIdsExactTrue === true
      && packet?.proof?.phase07PendingGapIdsExactTrue === true
      && packet?.proof?.phase07PendingGapIdsHonestTrue === true
      && packet?.proof?.phase07ReleaseReadyCoreWriterPathNotBoundResolvedTrue === true
      && packet?.proof?.phase07ReleaseReadyCoreWriterPathBaselineStatusPassTrue === true
      && packet?.proof?.phase07ReadinessStatusPassTrue === true
      && packet?.proof?.noFalsePhase07GreenTrue === true
      && packet?.proof?.packetInternalConsistencyTrue === true;

    const checkStatusById = {
      PREVIOUS_PHASE07_RELEASE_READY_CORE_WRITER_PATH_FOUNDATION_PASS: asCheck(
        previousFoundationPass ? 'GREEN' : 'OPEN_GAP',
        previousFoundationPass,
        previousFoundationPass
          ? 'PREVIOUS_PHASE07_RELEASE_READY_CORE_WRITER_PATH_FOUNDATION_PASS'
          : 'PREVIOUS_PHASE07_RELEASE_READY_CORE_WRITER_PATH_FOUNDATION_NOT_PASS',
      ),
      X78_RELEASE_REQUIRED_SET_PARITY_PASS: asCheck(
        x78ReleaseParityPass ? 'GREEN' : 'OPEN_GAP',
        x78ReleaseParityPass,
        x78ReleaseParityPass ? 'X78_RELEASE_REQUIRED_SET_PARITY_PASS' : 'X78_RELEASE_REQUIRED_SET_PARITY_NOT_PASS',
      ),
      X78_PARITY_BOOLEANS_TRUE: asCheck(
        x78ParityBooleansTrue ? 'GREEN' : 'OPEN_GAP',
        x78ParityBooleansTrue,
        x78ParityBooleansTrue ? 'X78_PARITY_BOOLEANS_TRUE' : 'X78_PARITY_BOOLEANS_FALSE',
      ),
      X79_RELEASE_FINAL_SHIP_READINESS_OK: asCheck(
        x79ReleaseFinalShipReadinessOk ? 'GREEN' : 'OPEN_GAP',
        x79ReleaseFinalShipReadinessOk,
        x79ReleaseFinalShipReadinessOk ? 'X79_RELEASE_FINAL_SHIP_READINESS_OK' : 'X79_RELEASE_FINAL_SHIP_READINESS_NOT_OK',
      ),
      X79_RELEASE_FINAL_SHIP_READINESS_CHECKS_TRUE: asCheck(
        x79ReleaseFinalShipReadinessChecksTrue ? 'GREEN' : 'OPEN_GAP',
        x79ReleaseFinalShipReadinessChecksTrue,
        x79ReleaseFinalShipReadinessChecksTrue
          ? 'X79_RELEASE_FINAL_SHIP_READINESS_CHECKS_TRUE'
          : 'X79_RELEASE_FINAL_SHIP_READINESS_CHECKS_FALSE',
      ),
      PHASE07_RELEASE_READY_CORE_WRITER_PATH_NOT_BOUND_RESOLVED: asCheck(
        notBoundResolved ? 'GREEN' : 'OPEN_GAP',
        notBoundResolved,
        notBoundResolved
          ? 'PHASE07_RELEASE_READY_CORE_WRITER_PATH_NOT_BOUND_RESOLVED'
          : 'PHASE07_RELEASE_READY_CORE_WRITER_PATH_NOT_BOUND_STILL_OPEN',
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
        phase07ReleaseReadyCoreWriterPathBaselineStatus: 'HOLD',
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
      phase07ReleaseReadyCoreWriterPathBaselineStatus: overallPass ? 'PASS' : 'HOLD',
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
      phase07ReleaseReadyCoreWriterPathBaselineStatus: 'UNKNOWN',
      phase07ReadinessStatus: 'UNKNOWN',
      greenCheckIds: [],
      openGapIds: ['PHASE07_RELEASE_READY_CORE_WRITER_PATH_BASELINE_EVALUATION_ERROR'],
      checkStatusById: {},
      phase07BlockingBudgetIds: [],
      phase07PendingGapIds: [],
      errorMessage: error && typeof error.message === 'string' ? error.message : 'UNKNOWN',
    };
  }
}

function runCli() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluatePhase07ReleaseReadyCoreWriterPathBaselineState({
    forceNegative: args.forceNegative,
  });

  if (args.json) {
    console.log(JSON.stringify(state, null, 2));
  } else {
    console.log(`PHASE07_RELEASE_READY_CORE_WRITER_PATH_BASELINE_OK=${state.ok ? 1 : 0}`);
    console.log(`PHASE07_RELEASE_READY_CORE_WRITER_PATH_BASELINE_OVERALL_STATUS=${state.overallStatus}`);
    console.log(`PHASE07_RELEASE_READY_CORE_WRITER_PATH_BASELINE_STATUS=${state.phase07ReleaseReadyCoreWriterPathBaselineStatus}`);
    console.log(`PHASE07_RELEASE_READY_CORE_WRITER_PATH_BASELINE_READINESS_STATUS=${state.phase07ReadinessStatus}`);
    console.log(`PHASE07_RELEASE_READY_CORE_WRITER_PATH_BASELINE_OPEN_GAP_IDS=${state.openGapIds.join(',')}`);
    console.log(`PHASE07_RELEASE_READY_CORE_WRITER_PATH_BASELINE_FAIL_REASON=${state.failReason}`);
  }

  process.exit(state.ok ? 0 : 1);
}

const selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(selfPath)) {
  runCli();
}

export { evaluatePhase07ReleaseReadyCoreWriterPathBaselineState };

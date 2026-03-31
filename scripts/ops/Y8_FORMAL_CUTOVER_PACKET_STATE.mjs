#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const FAIL_REASON_FORCED_NEGATIVE = 'E_Y8_FORMAL_CUTOVER_PACKET_FORCED_NEGATIVE';
const FAIL_REASON_UNEXPECTED = 'E_Y8_FORMAL_CUTOVER_PACKET_UNEXPECTED';

const INPUT_PATHS = Object.freeze({
  y7Record: 'docs/OPS/STATUS/Y7_FOUNDATION_STATE_AND_PROOF_REGEN_RECORD_V1.json',
  phase05: 'docs/OPS/STATUS/PHASE05_BOUNDED_SPATIAL_SHELL_PACKET_V1.json',
  phase06: 'docs/OPS/STATUS/PHASE06_REAL_PACK_VALUE_OR_EXPLICIT_SKIP_DECISION_V1.json',
  phase07ReleaseReadyFoundation: 'docs/OPS/STATUS/PHASE07_RELEASE_READY_CORE_WRITER_PATH_FOUNDATION_V1.json',
  phase07RuntimeMeasurementsFoundation: 'docs/OPS/STATUS/PHASE07_STARTUP_PROJECT_OPEN_SCENE_SWITCH_RESET_RUNTIME_MEASUREMENTS_FOUNDATION_V1.json',
  phase07StartupBaseline: 'docs/OPS/STATUS/PHASE07_STARTUP_RUNTIME_MEASUREMENT_BASELINE_V1.json',
  x68RollbackSource: 'docs/OPS/STATUS/X68_SCOPE_ROLLBACK_PACKET_V1.json',
  x78Parity: 'docs/OPS/STATUS/X78_RELEASE_REQUIRED_SET_PARITY_STATUS_V1.json',
  x79ShipReadiness: 'docs/OPS/STATUS/X79_RELEASE_FINAL_SHIP_READINESS_STATUS_V1.json',
  y8Record: 'docs/OPS/STATUS/Y8_FORMAL_CUTOVER_PACKET_RECORD_V1.json',
  y8RollbackPacket: 'docs/OPS/STATUS/Y8_FORMAL_CUTOVER_ROLLBACK_PACKET_V1.json',
  context: 'docs/CONTEXT.md',
  handoff: 'docs/HANDOFF.md',
});

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

function isHex40(value) {
  return typeof value === 'string' && /^[0-9a-f]{40}$/.test(value);
}

function evaluateY8FormalCutoverPacketState(input = {}) {
  const forceNegative = Boolean(input.forceNegative);

  try {
    const y7Record = readJson(INPUT_PATHS.y7Record);
    const phase05 = readJson(INPUT_PATHS.phase05);
    const phase06 = readJson(INPUT_PATHS.phase06);
    const phase07ReleaseReadyFoundation = readJson(INPUT_PATHS.phase07ReleaseReadyFoundation);
    const phase07RuntimeMeasurementsFoundation = readJson(INPUT_PATHS.phase07RuntimeMeasurementsFoundation);
    const phase07StartupBaseline = readJson(INPUT_PATHS.phase07StartupBaseline);
    const x68RollbackSource = readJson(INPUT_PATHS.x68RollbackSource);
    const x78Parity = readJson(INPUT_PATHS.x78Parity);
    const x79ShipReadiness = readJson(INPUT_PATHS.x79ShipReadiness);

    const y8RecordExists = fs.existsSync(path.resolve(INPUT_PATHS.y8Record));
    const y8RollbackPacketExists = fs.existsSync(path.resolve(INPUT_PATHS.y8RollbackPacket));
    const y8Record = y8RecordExists ? readJson(INPUT_PATHS.y8Record) : null;
    const y8RollbackPacket = y8RollbackPacketExists ? readJson(INPUT_PATHS.y8RollbackPacket) : null;
    const contextText = readText(INPUT_PATHS.context);
    const handoffText = readText(INPUT_PATHS.handoff);

    const y7PassHold = y7Record?.status === 'PASS'
      && y7Record?.y7FoundationRegenStatus === 'PASS'
      && y7Record?.y7ReadinessStatus === 'HOLD';

    const phase05Pass = phase05?.status === 'PASS' && phase05?.phase05ReadinessStatus === 'PASS';
    const phase06PassExplicitSkip = phase06?.status === 'PASS'
      && phase06?.phase06DecisionStatus === 'PASS'
      && phase06?.phase06PackDecision === 'EXPLICIT_SKIP'
      && phase06?.phase06PackLayerRequired === false;
    const phase07ReleaseReadyPassHold = phase07ReleaseReadyFoundation?.status === 'PASS'
      && phase07ReleaseReadyFoundation?.phase07ReleaseReadyCoreWriterPathFoundationStatus === 'PASS'
      && phase07ReleaseReadyFoundation?.phase07ReadinessStatus === 'HOLD';
    const phase07RuntimeMeasurementsPassHold = phase07RuntimeMeasurementsFoundation?.status === 'PASS'
      && phase07RuntimeMeasurementsFoundation?.phase07RuntimeMeasurementsFoundationStatus === 'PASS'
      && phase07RuntimeMeasurementsFoundation?.phase07RuntimeMeasurementsReadinessStatus === 'HOLD';
    const phase07StartupBaselinePassHold = phase07StartupBaseline?.status === 'PASS'
      && phase07StartupBaseline?.phase07StartupRuntimeMeasurementBaselineStatus === 'PASS'
      && phase07StartupBaseline?.phase07ReadinessStatus === 'HOLD';
    const x68RollbackSourcePresent = x68RollbackSource?.schemaVersion === 1
      && Array.isArray(x68RollbackSource?.outOfScopeBasenameResolutionList)
      && x68RollbackSource.outOfScopeBasenameResolutionList.length > 0;
    const x78ParityPass = x78Parity?.status === 'PASS'
      && x78Parity?.RELEASE_REQUIRED_SET_PARITY_TRUE === true
      && x78Parity?.HEAD_STRICT_OK_TRUE === true;
    const x79ShipReadinessOk = x79ShipReadiness?.ok === true
      && x79ShipReadiness?.checks?.RELEASE_REQUIRED_SET_PARITY_TRUE === true
      && x79ShipReadiness?.checks?.HEAD_STRICT_OK_TRUE === true
      && x79ShipReadiness?.checks?.NO_SCOPE_EXPANSION_TRUE === true;

    const y8RecordPresentAndBound = y8RecordExists
      && y8Record?.artifactId === 'Y8_FORMAL_CUTOVER_PACKET_RECORD_V1'
      && y8Record?.schemaVersion === 1
      && y8Record?.phaseId === 'Y8'
      && y8Record?.status === 'PASS'
      && y8Record?.y8FormalCutoverStatus === 'PASS'
      && y8Record?.y8ReadinessStatus === 'HOLD'
      && y8Record?.sourceY7RecordId === 'Y7_FOUNDATION_STATE_AND_PROOF_REGEN_RECORD_V1'
      && y8Record?.sourceRollbackPacketId === 'Y8_FORMAL_CUTOVER_ROLLBACK_PACKET_V1'
      && y8Record?.cutoverEvent?.cutoverEventId === 'Y8_FORMAL_CUTOVER_EVENT_001'
      && y8Record?.cutoverEvent?.cutoverEventStatus === 'BOUND'
      && isHex40(y8Record?.selectedBaseSha);

    const y8RollbackPacketPresentAndBound = y8RollbackPacketExists
      && y8RollbackPacket?.artifactId === 'Y8_FORMAL_CUTOVER_ROLLBACK_PACKET_V1'
      && y8RollbackPacket?.schemaVersion === 1
      && y8RollbackPacket?.phaseId === 'Y8'
      && y8RollbackPacket?.status === 'PASS'
      && y8RollbackPacket?.rollbackReadyStatus === 'PASS'
      && y8RollbackPacket?.rollbackEvent?.rollbackEventId === 'Y8_FORMAL_CUTOVER_ROLLBACK_EVENT_001'
      && y8RollbackPacket?.rollbackEvent?.rollbackEventStatus === 'BOUND'
      && y8RollbackPacket?.sourceScopeRollbackPacketId === 'X68_SCOPE_ROLLBACK_PACKET_V1';

    const factualDocsSynced = contextText.includes('Y8_FORMAL_CUTOVER_PACKET_RECORD_V1.json')
      && contextText.includes('Y8_FORMAL_CUTOVER_ROLLBACK_PACKET_V1.json')
      && contextText.includes('Y9_NOT_OPENED_BY_IMPLICATION: TRUE')
      && handoffText.includes('Y8_FORMAL_CUTOVER_PACKET_RECORD_V1.json')
      && handoffText.includes('Y8_FORMAL_CUTOVER_ROLLBACK_PACKET_V1.json')
      && handoffText.includes('Y9_NOT_OPENED_BY_IMPLICATION: TRUE');

    const noY9Implication = y8RecordPresentAndBound
      && y8Record?.proof?.noY9ImplicationTrue === true
      && y8RollbackPacketPresentAndBound
      && y8RollbackPacket?.proof?.noY9ImplicationTrue === true;

    const checkStatusById = {
      Y7_RECORD_PASS_HOLD: asCheck(
        y7PassHold ? 'GREEN' : 'OPEN_GAP',
        y7PassHold,
        y7PassHold ? 'Y7_RECORD_PASS_HOLD' : 'Y7_RECORD_NOT_PASS_HOLD',
      ),
      PHASE05_PASS: asCheck(
        phase05Pass ? 'GREEN' : 'OPEN_GAP',
        phase05Pass,
        phase05Pass ? 'PHASE05_PASS' : 'PHASE05_NOT_PASS',
      ),
      PHASE06_PASS_EXPLICIT_SKIP: asCheck(
        phase06PassExplicitSkip ? 'GREEN' : 'OPEN_GAP',
        phase06PassExplicitSkip,
        phase06PassExplicitSkip ? 'PHASE06_PASS_EXPLICIT_SKIP' : 'PHASE06_NOT_EXPLICIT_SKIP_PASS',
      ),
      PHASE07_RELEASE_READY_FOUNDATION_PASS_HOLD: asCheck(
        phase07ReleaseReadyPassHold ? 'GREEN' : 'OPEN_GAP',
        phase07ReleaseReadyPassHold,
        phase07ReleaseReadyPassHold
          ? 'PHASE07_RELEASE_READY_FOUNDATION_PASS_HOLD'
          : 'PHASE07_RELEASE_READY_FOUNDATION_DRIFT',
      ),
      PHASE07_RUNTIME_MEASUREMENTS_FOUNDATION_PASS_HOLD: asCheck(
        phase07RuntimeMeasurementsPassHold ? 'GREEN' : 'OPEN_GAP',
        phase07RuntimeMeasurementsPassHold,
        phase07RuntimeMeasurementsPassHold
          ? 'PHASE07_RUNTIME_MEASUREMENTS_FOUNDATION_PASS_HOLD'
          : 'PHASE07_RUNTIME_MEASUREMENTS_FOUNDATION_DRIFT',
      ),
      PHASE07_STARTUP_BASELINE_PASS_HOLD: asCheck(
        phase07StartupBaselinePassHold ? 'GREEN' : 'OPEN_GAP',
        phase07StartupBaselinePassHold,
        phase07StartupBaselinePassHold
          ? 'PHASE07_STARTUP_BASELINE_PASS_HOLD'
          : 'PHASE07_STARTUP_BASELINE_DRIFT',
      ),
      X68_ROLLBACK_SOURCE_PRESENT: asCheck(
        x68RollbackSourcePresent ? 'GREEN' : 'OPEN_GAP',
        x68RollbackSourcePresent,
        x68RollbackSourcePresent ? 'X68_ROLLBACK_SOURCE_PRESENT' : 'X68_ROLLBACK_SOURCE_MISSING',
      ),
      X78_RELEASE_PARITY_PASS: asCheck(
        x78ParityPass ? 'GREEN' : 'OPEN_GAP',
        x78ParityPass,
        x78ParityPass ? 'X78_RELEASE_PARITY_PASS' : 'X78_RELEASE_PARITY_DRIFT',
      ),
      X79_RELEASE_SHIP_READINESS_OK: asCheck(
        x79ShipReadinessOk ? 'GREEN' : 'OPEN_GAP',
        x79ShipReadinessOk,
        x79ShipReadinessOk ? 'X79_RELEASE_SHIP_READINESS_OK' : 'X79_RELEASE_SHIP_READINESS_DRIFT',
      ),
      Y8_RECORD_PRESENT_AND_BOUND: asCheck(
        y8RecordPresentAndBound ? 'GREEN' : 'OPEN_GAP',
        y8RecordPresentAndBound,
        y8RecordPresentAndBound ? 'Y8_RECORD_PRESENT_AND_BOUND' : 'Y8_RECORD_MISSING_OR_DRIFT',
      ),
      Y8_ROLLBACK_PACKET_PRESENT_AND_BOUND: asCheck(
        y8RollbackPacketPresentAndBound ? 'GREEN' : 'OPEN_GAP',
        y8RollbackPacketPresentAndBound,
        y8RollbackPacketPresentAndBound
          ? 'Y8_ROLLBACK_PACKET_PRESENT_AND_BOUND'
          : 'Y8_ROLLBACK_PACKET_MISSING_OR_DRIFT',
      ),
      FACTUAL_DOCS_SYNCED: asCheck(
        factualDocsSynced ? 'GREEN' : 'OPEN_GAP',
        factualDocsSynced,
        factualDocsSynced ? 'FACTUAL_DOCS_SYNCED' : 'FACTUAL_DOCS_NOT_SYNCED',
      ),
      NO_Y9_IMPLICATION: asCheck(
        noY9Implication ? 'GREEN' : 'OPEN_GAP',
        noY9Implication,
        noY9Implication ? 'NO_Y9_IMPLICATION' : 'Y9_IMPLICATION_DETECTED',
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
        y8FormalCutoverStatus: 'HOLD',
        y8ReadinessStatus: 'HOLD',
        greenCheckIds,
        openGapIds: Array.from(new Set([...openGapIds, 'FORCED_NEGATIVE_PATH'])),
        checkStatusById,
      };
    }

    const overallPass = openGapIds.length === 0;

    return {
      ok: overallPass,
      failReason: '',
      overallStatus: overallPass ? 'PASS' : 'HOLD',
      y8FormalCutoverStatus: overallPass ? 'PASS' : 'HOLD',
      y8ReadinessStatus: 'HOLD',
      greenCheckIds,
      openGapIds,
      checkStatusById,
      summary: {
        selectedBaseSha: y8Record?.selectedBaseSha || '',
        cutoverEventId: y8Record?.cutoverEvent?.cutoverEventId || '',
        rollbackEventId: y8RollbackPacket?.rollbackEvent?.rollbackEventId || '',
      },
    };
  } catch (error) {
    return {
      ok: false,
      failReason: FAIL_REASON_UNEXPECTED,
      overallStatus: 'HOLD',
      y8FormalCutoverStatus: 'UNKNOWN',
      y8ReadinessStatus: 'UNKNOWN',
      greenCheckIds: [],
      openGapIds: ['Y8_FORMAL_CUTOVER_PACKET_EVALUATION_ERROR'],
      checkStatusById: {},
      errorMessage: error && typeof error.message === 'string' ? error.message : 'UNKNOWN',
    };
  }
}

function runCli() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluateY8FormalCutoverPacketState({ forceNegative: args.forceNegative });

  if (args.json) {
    console.log(JSON.stringify(state, null, 2));
  } else {
    console.log(`Y8_FORMAL_CUTOVER_PACKET_OK=${state.ok ? 1 : 0}`);
    console.log(`Y8_FORMAL_CUTOVER_PACKET_OVERALL_STATUS=${state.overallStatus}`);
    console.log(`Y8_FORMAL_CUTOVER_PACKET_STATUS=${state.y8FormalCutoverStatus}`);
    console.log(`Y8_FORMAL_CUTOVER_PACKET_READINESS_STATUS=${state.y8ReadinessStatus}`);
    console.log(`Y8_FORMAL_CUTOVER_PACKET_OPEN_GAP_IDS=${state.openGapIds.join(',')}`);
    console.log(`Y8_FORMAL_CUTOVER_PACKET_FAIL_REASON=${state.failReason}`);
  }

  process.exit(state.ok && !args.forceNegative ? 0 : 1);
}

if (import.meta.url === new URL(`file:${process.argv[1]}`).href) {
  runCli();
}

export { evaluateY8FormalCutoverPacketState };

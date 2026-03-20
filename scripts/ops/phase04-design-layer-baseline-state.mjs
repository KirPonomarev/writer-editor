#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FAIL_REASON_FORCED_NEGATIVE = 'E_PHASE04_DESIGN_LAYER_BASELINE_FORCED_NEGATIVE';
const FAIL_REASON_UNEXPECTED = 'E_PHASE04_DESIGN_LAYER_BASELINE_UNEXPECTED';
const SUPERSESSION_PACKET_PATH = 'docs/OPS/STATUS/PHASE04_SUPERSESSION_AND_PHASE_MAP_SYNC_PACKET_V1.json';
const DESIGN_PACKET_PATH = 'docs/OPS/STATUS/PHASE04_DESIGN_LAYER_BASELINE_PACKET_V1.json';
const BINDING_INDEX_PATH = 'docs/OPS/STATUS/BINDING_INDEX_v0.md';
const EXPECTED_SUPERSESSION_ARTIFACT_ID = 'PHASE04_SUPERSESSION_AND_PHASE_MAP_SYNC_PACKET_V1';
const EXPECTED_DESIGN_ARTIFACT_ID = 'PHASE04_DESIGN_LAYER_BASELINE_PACKET_V1';
const EXPECTED_SUPERSEDED_LOGICAL_ARTIFACT_ID = 'PHASE04_SPATIAL_PREP_PACKET_V1';
const EXPECTED_TRUE_PHASE04_LOGICAL_ARTIFACT_ID = 'PHASE04_DESIGN_LAYER_BASELINE_PACKET_V1';
const EXPECTED_BOUND_SIGNAL_IDS = Object.freeze([
  'PHASE04_BASELINE_SAFE_FOCUS_COMPACT_PASS',
  'PHASE04_VISIBLE_DESIGN_SWITCH_PASS',
  'PHASE04_BINDING_INDEX_SYNC_PASS',
]);
const EXPECTED_LOCKED_TARGET_IDS = Object.freeze([
  'DESIGN_LAYER_BASELINE',
  'BASELINE_SAFE_FOCUS_COMPACT',
  'VISIBLE_DESIGN_SWITCH',
  'DOCUMENT_TRUTH_UNCHANGED',
  'RECOVERY_TRUTH_UNCHANGED',
  'COMMAND_SEMANTICS_UNCHANGED',
]);
const EXPECTED_BINDING_INDEX_ROW = Object.freeze({
  mapId: '38',
  mapSection: 'Phase 04 design layer baseline',
  gateToken: 'PHASE04_DESIGN_LAYER_BASELINE_OK',
  failSignal: 'E_PHASE04_DESIGN_LAYER_BASELINE_DRIFT',
  mode: 'ADV/BLK/BLK',
  binding: 'BOUND',
});

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function readJsonObject(filePath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function readText(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

function parseArgs(argv = process.argv.slice(2)) {
  const out = {
    json: false,
    forceNegative: false,
  };

  for (const token of argv) {
    const arg = normalizeString(token);
    if (!arg) continue;
    if (arg === '--json') out.json = true;
    if (arg === '--force-negative') out.forceNegative = true;
  }

  return out;
}

function asCheck(status, measured, note) {
  return { status, measured, note };
}

function arraysEqual(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

function parseBindingIndexRow(text, mapId) {
  const line = String(text || '')
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`| ${mapId} |`));

  if (!line) return null;

  const cells = line.split('|').map((entry) => entry.trim()).slice(1, -1);
  if (cells.length < 7) return null;

  return {
    mapId: cells[0],
    mapSection: cells[1],
    lawSections: cells[2],
    gateToken: cells[3],
    failSignal: cells[4],
    mode: cells[5],
    binding: cells[6],
  };
}

function buildState(base = {}) {
  return {
    ok: false,
    PHASE04_DESIGN_LAYER_BASELINE_OK: 0,
    phase04DesignLayerBaselineOk: false,
    failReason: 'PHASE04_DESIGN_LAYER_BASELINE_NOT_READY',
    overallStatus: 'HOLD',
    phase04ReadinessStatus: 'HOLD',
    greenCheckIds: [],
    openGapIds: [],
    checkStatusById: {},
    phase04PendingGapIds: [],
    boundSignalIds: [],
    lockedTargetIds: [],
    supersededLogicalArtifactId: EXPECTED_SUPERSEDED_LOGICAL_ARTIFACT_ID,
    truePhase04LogicalArtifactId: EXPECTED_TRUE_PHASE04_LOGICAL_ARTIFACT_ID,
    designLayerFocus: '',
    visibleDesignSwitch: '',
    bindingIndexRow: null,
    ...base,
  };
}

export function evaluatePhase04DesignLayerBaselineState(input = {}) {
  const forceNegative = Boolean(input.forceNegative);
  const supersessionPath = normalizeString(input.supersessionPath || process.env.PHASE04_SUPERSESSION_PACKET_PATH || SUPERSESSION_PACKET_PATH);
  const designPath = normalizeString(input.designPath || process.env.PHASE04_DESIGN_PACKET_PATH || DESIGN_PACKET_PATH);
  const bindingIndexPath = normalizeString(input.bindingIndexPath || process.env.PHASE04_BINDING_INDEX_PATH || BINDING_INDEX_PATH);

  try {
    const supersessionDoc = readJsonObject(supersessionPath);
    const designDoc = readJsonObject(designPath);
    const bindingIndexText = readText(bindingIndexPath);
    const bindingIndexRow = parseBindingIndexRow(bindingIndexText, EXPECTED_BINDING_INDEX_ROW.mapId);

    const supersessionPacketPresent = Boolean(supersessionDoc);
    const designPacketPresent = Boolean(designDoc);
    const bindingIndexPresent = bindingIndexText.length > 0;

    const supersessionPacketPass = supersessionPacketPresent && supersessionDoc.status === 'PASS' && supersessionDoc.phase04SupersessionStatus === 'PASS';
    const supersessionPacketMatches =
      supersessionPacketPass
      && supersessionDoc.artifactId === EXPECTED_SUPERSESSION_ARTIFACT_ID
      && supersessionDoc.phaseId === 'PHASE_04'
      && supersessionDoc.supersededLogicalArtifactId === EXPECTED_SUPERSEDED_LOGICAL_ARTIFACT_ID
      && supersessionDoc.supersededHistoricalFileRef === 'docs/OPS/STATUS/PHASE04_SPATIAL_PREP_PACKET_V1.json'
      && supersessionDoc.truePhase04LogicalArtifactId === EXPECTED_TRUE_PHASE04_LOGICAL_ARTIFACT_ID
      && supersessionDoc.truePhase04HistoricalFileRef === 'docs/OPS/STATUS/PHASE04_DESIGN_LAYER_BASELINE_PACKET_V1.json'
      && supersessionDoc.phaseMap?.oldFinalPhase04 === 'SPATIAL_PREP'
      && supersessionDoc.phaseMap?.truePhase04 === 'DESIGN_LAYER_BASELINE'
      && supersessionDoc.phaseMap?.oldPhase04CountsAsFinal === false
      && supersessionDoc.phaseMap?.truePhase04CountsAsFinal === true
      && arraysEqual(supersessionDoc.boundSignalIds || [], [
        'PHASE04_SUPERSESSION_RECORDED_PASS',
        'PHASE04_PHASE_MAP_SYNC_PASS',
        'PHASE04_OLD_SPATIAL_PREP_NO_LONGER_FINAL_PASS',
      ])
      && Array.isArray(supersessionDoc.phase04PendingGapIds)
      && supersessionDoc.phase04PendingGapIds.length === 0
      && supersessionDoc.proof?.supersessionRecordedTrue === true
      && supersessionDoc.proof?.phaseMapSyncedTrue === true
      && supersessionDoc.proof?.oldSpatialPrepNoLongerCountsFinalPhase04True === true
      && supersessionDoc.proof?.historicalFileRefsPreservedTrue === true
      && supersessionDoc.proof?.noDocumentTruthChangeTrue === true
      && supersessionDoc.proof?.noRecoveryTruthChangeTrue === true
      && supersessionDoc.proof?.noCommandSemanticsChangeTrue === true
      && supersessionDoc.proof?.noFalsePhase04SupersessionGreenTrue === true;

    const designPacketPass = designPacketPresent && designDoc.status === 'PASS' && designDoc.phase04ReadinessStatus === 'PASS';
    const designPacketMatches =
      designPacketPass
      && designDoc.artifactId === EXPECTED_DESIGN_ARTIFACT_ID
      && designDoc.phaseId === 'PHASE_04'
      && designDoc.sourcePhase04SupersessionAndPhaseMapSyncPacket === EXPECTED_SUPERSESSION_ARTIFACT_ID
      && designDoc.designLayerFocus === 'BASELINE_SAFE_FOCUS_COMPACT'
      && designDoc.visibleDesignSwitch === 'VISIBLE_DESIGN_SWITCH'
      && arraysEqual(designDoc.boundSignalIds || [], EXPECTED_BOUND_SIGNAL_IDS)
      && arraysEqual(designDoc.lockedTargetIds || [], EXPECTED_LOCKED_TARGET_IDS)
      && Array.isArray(designDoc.phase04PendingGapIds)
      && designDoc.phase04PendingGapIds.length === 0
      && designDoc.proof?.phase04BaselineSafeFocusCompactTrue === true
      && designDoc.proof?.phase04VisibleDesignSwitchTrue === true
      && designDoc.proof?.phase04DocumentTruthUnchangedTrue === true
      && designDoc.proof?.phase04RecoveryTruthUnchangedTrue === true
      && designDoc.proof?.phase04CommandSemanticsUnchangedTrue === true
      && designDoc.proof?.bindingIndexSyncTrue === true
      && designDoc.proof?.sourceSupersessionPacketAlignedTrue === true
      && designDoc.proof?.phase04PendingGapIdsClearedTrue === true
      && designDoc.proof?.noFalsePhase04GreenTrue === true;

    const bindingIndexMatches =
      Boolean(bindingIndexRow)
      && bindingIndexRow.mapId === EXPECTED_BINDING_INDEX_ROW.mapId
      && bindingIndexRow.mapSection === EXPECTED_BINDING_INDEX_ROW.mapSection
      && bindingIndexRow.gateToken === EXPECTED_BINDING_INDEX_ROW.gateToken
      && bindingIndexRow.failSignal === EXPECTED_BINDING_INDEX_ROW.failSignal
      && bindingIndexRow.mode === EXPECTED_BINDING_INDEX_ROW.mode
      && bindingIndexRow.binding === EXPECTED_BINDING_INDEX_ROW.binding;

    const checkStatusById = {
      SUPERSESSION_PACKET_PRESENT: asCheck(supersessionPacketPresent ? 'GREEN' : 'OPEN_GAP', true, supersessionPacketPresent ? 'SUPERSESSION_PACKET_PRESENT' : 'SUPERSESSION_PACKET_MISSING'),
      SUPERSESSION_PACKET_PASS: asCheck(supersessionPacketPass ? 'GREEN' : 'OPEN_GAP', true, supersessionPacketPass ? 'SUPERSESSION_PACKET_PASS' : 'SUPERSESSION_PACKET_NOT_PASS'),
      SUPERSESSION_PACKET_MATCHES: asCheck(supersessionPacketMatches ? 'GREEN' : 'OPEN_GAP', true, supersessionPacketMatches ? 'SUPERSESSION_PACKET_MATCHES' : 'SUPERSESSION_PACKET_DRIFT'),
      DESIGN_PACKET_PRESENT: asCheck(designPacketPresent ? 'GREEN' : 'OPEN_GAP', true, designPacketPresent ? 'DESIGN_PACKET_PRESENT' : 'DESIGN_PACKET_MISSING'),
      DESIGN_PACKET_PASS: asCheck(designPacketPass ? 'GREEN' : 'OPEN_GAP', true, designPacketPass ? 'DESIGN_PACKET_PASS' : 'DESIGN_PACKET_NOT_PASS'),
      DESIGN_PACKET_MATCHES: asCheck(designPacketMatches ? 'GREEN' : 'OPEN_GAP', true, designPacketMatches ? 'DESIGN_PACKET_MATCHES' : 'DESIGN_PACKET_DRIFT'),
      BINDING_INDEX_PRESENT: asCheck(bindingIndexPresent ? 'GREEN' : 'OPEN_GAP', true, bindingIndexPresent ? 'BINDING_INDEX_PRESENT' : 'BINDING_INDEX_MISSING'),
      BINDING_INDEX_MATCHES: asCheck(bindingIndexMatches ? 'GREEN' : 'OPEN_GAP', true, bindingIndexMatches ? 'BINDING_INDEX_MATCHES' : 'BINDING_INDEX_DRIFT'),
      BASELINE_SAFE_FOCUS_COMPACT_TRUE: asCheck(designPacketMatches ? 'GREEN' : 'OPEN_GAP', true, designPacketMatches ? 'BASELINE_SAFE_FOCUS_COMPACT_TRUE' : 'BASELINE_SAFE_FOCUS_COMPACT_FALSE'),
      VISIBLE_DESIGN_SWITCH_TRUE: asCheck(designPacketMatches ? 'GREEN' : 'OPEN_GAP', true, designPacketMatches ? 'VISIBLE_DESIGN_SWITCH_TRUE' : 'VISIBLE_DESIGN_SWITCH_FALSE'),
      DOCUMENT_TRUTH_UNCHANGED_TRUE: asCheck(designPacketMatches ? 'GREEN' : 'OPEN_GAP', true, designPacketMatches ? 'DOCUMENT_TRUTH_UNCHANGED_TRUE' : 'DOCUMENT_TRUTH_UNCHANGED_FALSE'),
      RECOVERY_TRUTH_UNCHANGED_TRUE: asCheck(designPacketMatches ? 'GREEN' : 'OPEN_GAP', true, designPacketMatches ? 'RECOVERY_TRUTH_UNCHANGED_TRUE' : 'RECOVERY_TRUTH_UNCHANGED_FALSE'),
      COMMAND_SEMANTICS_UNCHANGED_TRUE: asCheck(designPacketMatches ? 'GREEN' : 'OPEN_GAP', true, designPacketMatches ? 'COMMAND_SEMANTICS_UNCHANGED_TRUE' : 'COMMAND_SEMANTICS_UNCHANGED_FALSE'),
    };

    const greenCheckIds = Object.entries(checkStatusById)
      .filter(([, value]) => value.status === 'GREEN')
      .map(([key]) => key);
    const openGapIds = Object.entries(checkStatusById)
      .filter(([, value]) => value.status !== 'GREEN')
      .map(([key]) => key);

    if (forceNegative) {
      return buildState({
        ok: false,
        PHASE04_DESIGN_LAYER_BASELINE_OK: 0,
        phase04DesignLayerBaselineOk: false,
        failReason: FAIL_REASON_FORCED_NEGATIVE,
        overallStatus: 'HOLD',
        phase04ReadinessStatus: 'HOLD',
        greenCheckIds,
        openGapIds: Array.from(new Set([...openGapIds, 'FORCED_NEGATIVE_PATH'])),
        checkStatusById,
        phase04PendingGapIds: designDoc?.phase04PendingGapIds || [],
        boundSignalIds: designDoc?.boundSignalIds || [],
        lockedTargetIds: designDoc?.lockedTargetIds || [],
        supersededLogicalArtifactId: supersessionDoc?.supersededLogicalArtifactId || EXPECTED_SUPERSEDED_LOGICAL_ARTIFACT_ID,
        truePhase04LogicalArtifactId: supersessionDoc?.truePhase04LogicalArtifactId || EXPECTED_TRUE_PHASE04_LOGICAL_ARTIFACT_ID,
        designLayerFocus: designDoc?.designLayerFocus || '',
        visibleDesignSwitch: designDoc?.visibleDesignSwitch || '',
        bindingIndexRow,
      });
    }

    const overallPass = openGapIds.length === 0;

    return buildState({
      ok: overallPass,
      PHASE04_DESIGN_LAYER_BASELINE_OK: overallPass ? 1 : 0,
      phase04DesignLayerBaselineOk: overallPass,
      failReason: overallPass ? '' : 'PHASE04_DESIGN_LAYER_BASELINE_NOT_READY',
      overallStatus: overallPass ? 'PASS' : 'HOLD',
      phase04ReadinessStatus: overallPass ? 'PASS' : 'HOLD',
      greenCheckIds,
      openGapIds,
      checkStatusById,
      phase04PendingGapIds: designDoc?.phase04PendingGapIds || [],
      boundSignalIds: designDoc?.boundSignalIds || [],
      lockedTargetIds: designDoc?.lockedTargetIds || [],
      supersededLogicalArtifactId: supersessionDoc?.supersededLogicalArtifactId || EXPECTED_SUPERSEDED_LOGICAL_ARTIFACT_ID,
      truePhase04LogicalArtifactId: supersessionDoc?.truePhase04LogicalArtifactId || EXPECTED_TRUE_PHASE04_LOGICAL_ARTIFACT_ID,
      designLayerFocus: designDoc?.designLayerFocus || '',
      visibleDesignSwitch: designDoc?.visibleDesignSwitch || '',
      bindingIndexRow,
    });
  } catch (error) {
    return buildState({
      ok: false,
      PHASE04_DESIGN_LAYER_BASELINE_OK: 0,
      phase04DesignLayerBaselineOk: false,
      failReason: FAIL_REASON_UNEXPECTED,
      overallStatus: 'HOLD',
      phase04ReadinessStatus: 'UNKNOWN',
      greenCheckIds: [],
      openGapIds: ['PHASE04_DESIGN_LAYER_BASELINE_EVALUATION_ERROR'],
      checkStatusById: {},
      errorMessage: error && typeof error.message === 'string' ? error.message : 'UNKNOWN',
    });
  }
}

function runCli() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluatePhase04DesignLayerBaselineState({ forceNegative: args.forceNegative });

  if (args.json) {
    console.log(JSON.stringify(state, null, 2));
  } else {
    console.log(`PHASE04_DESIGN_LAYER_BASELINE_OK=${state.PHASE04_DESIGN_LAYER_BASELINE_OK}`);
    console.log(`PHASE04_DESIGN_LAYER_BASELINE_OVERALL_STATUS=${state.overallStatus}`);
    console.log(`PHASE04_DESIGN_LAYER_BASELINE_READINESS_STATUS=${state.phase04ReadinessStatus}`);
    console.log(`PHASE04_DESIGN_LAYER_BASELINE_OPEN_GAP_IDS=${state.openGapIds.join(',')}`);
    console.log(`PHASE04_DESIGN_LAYER_BASELINE_FAIL_REASON=${state.failReason}`);
  }

  process.exit(state.ok ? 0 : 1);
}

const selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(selfPath)) {
  runCli();
}

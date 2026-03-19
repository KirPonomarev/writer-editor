#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FAIL_REASON_FORCED_NEGATIVE = 'E_PHASE06_REAL_PACK_VALUE_OR_EXPLICIT_SKIP_DECISION_FORCED_NEGATIVE';
const FAIL_REASON_UNEXPECTED = 'E_PHASE06_REAL_PACK_VALUE_OR_EXPLICIT_SKIP_DECISION_UNEXPECTED';
const PHASE05_PACKET_PATH = 'docs/OPS/STATUS/PHASE05_BOUNDED_SPATIAL_SHELL_PACKET_V1.json';
const PACKET_PATH = 'docs/OPS/STATUS/PHASE06_REAL_PACK_VALUE_OR_EXPLICIT_SKIP_DECISION_V1.json';

const DOC_PATHS = Object.freeze({
  canon: 'CANON.md',
  bible: 'docs/BIBLE.md',
  context: 'docs/CONTEXT.md',
  handoff: 'docs/HANDOFF.md',
});

const OPTIONAL_PACK_RULE_MARKERS = Object.freeze({
  canon: ['minimal pack layer', 'реальной необходимости'],
  bible: [
    'feature pack remains optional',
    'pack layer is allowed only if a real built-in writer feature cannot be expressed by design pack, profile pack, command config or shell config',
  ],
  context: ['pack layer не считается обязательным'],
  handoff: ['Do not expand into spatial or pack work before Phase 02 and Phase 03 order'],
});

const REQUIRED_PACK_MARKERS = Object.freeze([
  'pack layer is required',
  'feature pack is required',
  'must add pack layer',
  'pack layer mandatory',
  'minimal internal pack layer required',
  'requires a minimal internal pack layer',
  'forces a minimal internal pack layer',
  'real built-in writer feature requires pack',
  'pack layer becomes mandatory',
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

function readText(relativePath) {
  return fs.readFileSync(path.resolve(relativePath), 'utf8');
}

function asCheck(status, measured, note) {
  return { status, measured, note };
}

function containsAll(text, markers) {
  return markers.every((marker) => text.includes(marker));
}

function containsAny(text, markers) {
  return markers.some((marker) => text.includes(marker));
}

function evaluatePhase06RealPackValueOrExplicitSkipDecisionState(input = {}) {
  const forceNegative = Boolean(input.forceNegative);

  try {
    const phase05PacketExists = fs.existsSync(path.resolve(PHASE05_PACKET_PATH));
    const phase05Packet = phase05PacketExists ? readJson(PHASE05_PACKET_PATH) : null;
    const packetExists = fs.existsSync(path.resolve(PACKET_PATH));
    const packet = packetExists ? readJson(PACKET_PATH) : null;

    const canonText = readText(DOC_PATHS.canon);
    const bibleText = readText(DOC_PATHS.bible);
    const contextText = readText(DOC_PATHS.context);
    const handoffText = readText(DOC_PATHS.handoff);
    const activeDocsText = [canonText, bibleText, contextText, handoffText].join('\n');

    const phase05Pass = phase05PacketExists
      && phase05Packet?.artifactId === 'PHASE05_BOUNDED_SPATIAL_SHELL_PACKET_V1'
      && phase05Packet?.schemaVersion === 1
      && phase05Packet?.phaseId === 'PHASE_05'
      && phase05Packet?.status === 'PASS'
      && phase05Packet?.phase05ReadinessStatus === 'PASS'
      && phase05Packet?.phase05PendingGapIds?.length === 0
      && phase05Packet?.proof?.phase05MovableSideContainersBaselinePassTrue === true
      && phase05Packet?.proof?.phase05LayoutRecoveryLastStableBaselinePassTrue === true
      && phase05Packet?.proof?.phase05InvalidLayoutAndMissingMonitorRecoveryBaselinePassTrue === true
      && phase05Packet?.proof?.sourcePhase05InvalidLayoutAndMissingMonitorRecoveryBaselineTrue === true
      && phase05Packet?.proof?.boundSignalIdsAlignedTrue === true
      && phase05Packet?.proof?.lockedTargetIdsAlignedTrue === true
      && phase05Packet?.proof?.phase05PendingGapIdsClearedTrue === true
      && phase05Packet?.proof?.noFalsePhase05GreenTrue === true;
    const optionalPackRulesPresent = containsAll(canonText, OPTIONAL_PACK_RULE_MARKERS.canon)
      && containsAll(bibleText, OPTIONAL_PACK_RULE_MARKERS.bible)
      && containsAll(contextText, OPTIONAL_PACK_RULE_MARKERS.context)
      && containsAll(handoffText, OPTIONAL_PACK_RULE_MARKERS.handoff);
    const noExecutablePluginRuntimeV1 = bibleText.includes('no executable plugin runtime in `v1`')
      && canonText.includes('executable plugin ecosystem');
    const noRequiredPackFeatureMarkersFound = !containsAny(activeDocsText, REQUIRED_PACK_MARKERS);

    const packetPass = packet?.status === 'PASS';
    const packetDecisionStatusPass = packet?.phase06DecisionStatus === 'PASS';
    const packetPackDecisionExplicitSkip = packet?.phase06PackDecision === 'EXPLICIT_SKIP';
    const packetPackLayerRequiredFalse = packet?.phase06PackLayerRequired === false;
    const sourceChainMatches = packet?.sourcePhase05BoundedSpatialShellState === 'phase05-bounded-spatial-shell-state.mjs';
    const boundSignalIdsMatch = Array.isArray(packet?.boundSignalIds)
      && packet.boundSignalIds.length === 9
      && packet.boundSignalIds.includes('PHASE05_BOUNDED_SPATIAL_SHELL_PASS')
      && packet.boundSignalIds.includes('BIBLE_PACK_LAYER_OPTIONAL')
      && packet.boundSignalIds.includes('BIBLE_PACK_LAYER_ONLY_IF_JUSTIFIED')
      && packet.boundSignalIds.includes('CANON_PACK_LAYER_ONLY_IF_JUSTIFIED')
      && packet.boundSignalIds.includes('CONTEXT_PACK_LAYER_NOT_REQUIRED')
      && packet.boundSignalIds.includes('HANDOFF_PACK_LAYER_NOT_CURRENT_AXIS')
      && packet.boundSignalIds.includes('NO_EXECUTABLE_PLUGIN_RUNTIME_V1')
      && packet.boundSignalIds.includes('NO_MACHINE_BOUND_REQUIRED_PACK_FEATURE_EVIDENCE')
      && packet.boundSignalIds.includes('PHASE06_EXPLICIT_SKIP_DECISION');
    const lockedTargetIdsMatch = Array.isArray(packet?.lockedTargetIds)
      && packet.lockedTargetIds.length === 4
      && packet.lockedTargetIds.includes('EXPLICIT_SKIP_IN_V1')
      && packet.lockedTargetIds.includes('MINIMAL_INTERNAL_PACK_LAYER_NOT_REQUIRED')
      && packet.lockedTargetIds.includes('NO_EXECUTABLE_PLUGIN_RUNTIME')
      && packet.lockedTargetIds.includes('ACTIVE_DOCS_REMAIN_OPTIONAL_ONLY');
    const pendingGapIdsCleared = Array.isArray(packet?.phase06PendingGapIds) && packet.phase06PendingGapIds.length === 0;
    const packetInternalConsistency = Boolean(packet)
      && packet?.artifactId === 'PHASE06_REAL_PACK_VALUE_OR_EXPLICIT_SKIP_DECISION_V1'
      && packet?.schemaVersion === 1
      && packet?.phaseId === 'PHASE_06'
      && packetPass
      && packetDecisionStatusPass
      && packetPackDecisionExplicitSkip
      && packetPackLayerRequiredFalse
      && sourceChainMatches
      && boundSignalIdsMatch
      && lockedTargetIdsMatch
      && pendingGapIdsCleared
      && packet?.proof?.phase05BoundedSpatialShellPassTrue === true
      && packet?.proof?.biblePackLayerOptionalTrue === true
      && packet?.proof?.biblePackLayerOnlyIfJustifiedTrue === true
      && packet?.proof?.canonPackLayerOnlyIfJustifiedTrue === true
      && packet?.proof?.contextPackLayerNotRequiredTrue === true
      && packet?.proof?.handoffPackWorkNotCurrentAxisTrue === true
      && packet?.proof?.noExecutablePluginRuntimeV1True === true
      && packet?.proof?.noMachineBoundRequiredPackFeatureEvidenceTrue === true
      && packet?.proof?.explicitSkipDecisionTrue === true
      && packet?.proof?.noFalsePhase06GreenTrue === true;

    const checkStatusById = {
      PHASE05_BOUNDED_SPATIAL_SHELL_PASS: asCheck(phase05Pass ? 'GREEN' : 'OPEN_GAP', true, phase05Pass ? 'PHASE05_BOUNDED_SPATIAL_SHELL_PASS' : 'PHASE05_BOUNDED_SPATIAL_SHELL_NOT_PASS'),
      PACKET_PRESENT: asCheck(packetExists ? 'GREEN' : 'OPEN_GAP', true, packetExists ? 'PACKET_PRESENT' : 'PACKET_MISSING'),
      PACKET_PASS: asCheck(packetPass ? 'GREEN' : 'OPEN_GAP', true, packetPass ? 'PACKET_PASS' : 'PACKET_NOT_PASS'),
      PACKET_DECISION_STATUS_PASS: asCheck(packetDecisionStatusPass ? 'GREEN' : 'OPEN_GAP', true, packetDecisionStatusPass ? 'PACKET_DECISION_STATUS_PASS' : 'PACKET_DECISION_STATUS_NOT_PASS'),
      PACKET_PACK_DECISION_EXPLICIT_SKIP: asCheck(packetPackDecisionExplicitSkip ? 'GREEN' : 'OPEN_GAP', true, packetPackDecisionExplicitSkip ? 'PACKET_PACK_DECISION_EXPLICIT_SKIP' : 'PACKET_PACK_DECISION_NOT_EXPLICIT_SKIP'),
      PACKET_PACK_LAYER_REQUIRED_FALSE: asCheck(packetPackLayerRequiredFalse ? 'GREEN' : 'OPEN_GAP', true, packetPackLayerRequiredFalse ? 'PACKET_PACK_LAYER_REQUIRED_FALSE' : 'PACKET_PACK_LAYER_REQUIRED_TRUE'),
      SOURCE_CHAIN_MATCHES: asCheck(sourceChainMatches ? 'GREEN' : 'OPEN_GAP', true, sourceChainMatches ? 'SOURCE_CHAIN_MATCHES' : 'SOURCE_CHAIN_DRIFT'),
      OPTIONAL_PACK_RULES_PRESENT: asCheck(optionalPackRulesPresent ? 'GREEN' : 'OPEN_GAP', true, optionalPackRulesPresent ? 'OPTIONAL_PACK_RULES_PRESENT' : 'OPTIONAL_PACK_RULES_MISSING'),
      NO_EXECUTABLE_PLUGIN_RUNTIME_V1: asCheck(noExecutablePluginRuntimeV1 ? 'GREEN' : 'OPEN_GAP', true, noExecutablePluginRuntimeV1 ? 'NO_EXECUTABLE_PLUGIN_RUNTIME_V1' : 'NO_EXECUTABLE_PLUGIN_RUNTIME_V1_MISSING'),
      NO_REQUIRED_PACK_FEATURE_MARKERS_FOUND: asCheck(noRequiredPackFeatureMarkersFound ? 'GREEN' : 'OPEN_GAP', true, noRequiredPackFeatureMarkersFound ? 'NO_REQUIRED_PACK_FEATURE_MARKERS_FOUND' : 'REQUIRED_PACK_FEATURE_MARKER_FOUND'),
      PACKET_INTERNAL_CONSISTENCY: asCheck(packetInternalConsistency ? 'GREEN' : 'OPEN_GAP', true, packetInternalConsistency ? 'PACKET_INTERNAL_CONSISTENCY' : 'PACKET_INTERNAL_CONSISTENCY_BROKEN'),
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
        phase06DecisionStatus: 'HOLD',
        phase06PackDecision: packet?.phase06PackDecision || 'EXPLICIT_SKIP',
        greenCheckIds,
        openGapIds: Array.from(new Set([...openGapIds, 'FORCED_NEGATIVE_PATH'])),
        checkStatusById,
        phase06PendingGapIds: packet?.phase06PendingGapIds || [],
        boundSignalIds: packet?.boundSignalIds || [],
        lockedTargetIds: packet?.lockedTargetIds || [],
      };
    }

    const overallPass = openGapIds.length === 0;

    return {
      ok: overallPass,
      failReason: '',
      overallStatus: overallPass ? 'PASS' : 'HOLD',
      phase06DecisionStatus: overallPass ? 'PASS' : 'HOLD',
      phase06PackDecision: packet?.phase06PackDecision || 'EXPLICIT_SKIP',
      greenCheckIds,
      openGapIds,
      checkStatusById,
      phase06PendingGapIds: packet?.phase06PendingGapIds || [],
      boundSignalIds: packet?.boundSignalIds || [],
      lockedTargetIds: packet?.lockedTargetIds || [],
    };
  } catch (error) {
    return {
      ok: false,
      failReason: FAIL_REASON_UNEXPECTED,
      overallStatus: 'HOLD',
      phase06DecisionStatus: 'UNKNOWN',
      phase06PackDecision: 'UNKNOWN',
      greenCheckIds: [],
      openGapIds: ['PHASE06_REAL_PACK_VALUE_OR_EXPLICIT_SKIP_DECISION_EVALUATION_ERROR'],
      checkStatusById: {},
      phase06PendingGapIds: [],
      boundSignalIds: [],
      lockedTargetIds: [],
      errorMessage: error && typeof error.message === 'string' ? error.message : 'UNKNOWN',
    };
  }
}

function runCli() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluatePhase06RealPackValueOrExplicitSkipDecisionState({ forceNegative: args.forceNegative });

  if (args.json) {
    console.log(JSON.stringify(state, null, 2));
  } else {
    console.log(`PHASE06_REAL_PACK_VALUE_OR_EXPLICIT_SKIP_DECISION_OK=${state.ok ? 1 : 0}`);
    console.log(`PHASE06_REAL_PACK_VALUE_OR_EXPLICIT_SKIP_DECISION_OVERALL_STATUS=${state.overallStatus}`);
    console.log(`PHASE06_REAL_PACK_VALUE_OR_EXPLICIT_SKIP_DECISION_STATUS=${state.phase06DecisionStatus}`);
    console.log(`PHASE06_REAL_PACK_VALUE_OR_EXPLICIT_SKIP_DECISION_PACK_DECISION=${state.phase06PackDecision}`);
    console.log(`PHASE06_REAL_PACK_VALUE_OR_EXPLICIT_SKIP_DECISION_OPEN_GAP_IDS=${state.openGapIds.join(',')}`);
    console.log(`PHASE06_REAL_PACK_VALUE_OR_EXPLICIT_SKIP_DECISION_FAIL_REASON=${state.failReason}`);
  }

  process.exit(state.ok ? 0 : 1);
}

const selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(selfPath)) {
  runCli();
}

export { evaluatePhase06RealPackValueOrExplicitSkipDecisionState };

#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FAIL_REASON_FORCED_NEGATIVE = 'E_PHASE07_STARTUP_PROJECT_OPEN_SCENE_SWITCH_RESET_BLOCKING_BUDGETS_BASELINE_FORCED_NEGATIVE';
const FAIL_REASON_UNEXPECTED = 'E_PHASE07_STARTUP_PROJECT_OPEN_SCENE_SWITCH_RESET_BLOCKING_BUDGETS_BASELINE_UNEXPECTED';
const PHASE06_PACKET_PATH = 'docs/OPS/STATUS/PHASE06_REAL_PACK_VALUE_OR_EXPLICIT_SKIP_DECISION_V1.json';
const PACKET_PATH = 'docs/OPS/STATUS/PHASE07_STARTUP_PROJECT_OPEN_SCENE_SWITCH_RESET_BLOCKING_BUDGETS_BASELINE_V1.json';
const EXECUTION_SEQUENCE_CANON_PATH = 'docs/OPS/STATUS/EXECUTION_SEQUENCE_CANON_v1.json';

const DOC_PATHS = Object.freeze({
  canon: 'CANON.md',
  bible: 'docs/BIBLE.md',
  context: 'docs/CONTEXT.md',
});

const EXPECTED_BLOCKING_BUDGET_IDS = Object.freeze([
  'STARTUP',
  'PROJECT_OPEN',
  'SCENE_SWITCH',
  'RESET',
]);

const EXPECTED_ADVISORY_BUDGET_IDS = Object.freeze([
  'WORKSPACE_SWITCH',
  'DETAILED_LAYOUT_SETTLE',
  'PACK_APPLY_COST',
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

function arraysEqual(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

function evaluatePhase07StartupProjectOpenSceneSwitchResetBlockingBudgetsBaselineState(input = {}) {
  const forceNegative = Boolean(input.forceNegative);

  try {
    const phase06PacketExists = fs.existsSync(path.resolve(PHASE06_PACKET_PATH));
    const phase06Packet = phase06PacketExists ? readJson(PHASE06_PACKET_PATH) : null;
    const packetExists = fs.existsSync(path.resolve(PACKET_PATH));
    const packet = packetExists ? readJson(PACKET_PATH) : null;
    const executionSequenceCanon = readJson(EXECUTION_SEQUENCE_CANON_PATH);

    const canonText = readText(DOC_PATHS.canon);
    const bibleText = readText(DOC_PATHS.bible);
    const contextText = readText(DOC_PATHS.context);

    const phase06DecisionPass = Boolean(phase06Packet)
      && phase06Packet?.artifactId === 'PHASE06_REAL_PACK_VALUE_OR_EXPLICIT_SKIP_DECISION_V1'
      && phase06Packet?.schemaVersion === 1
      && phase06Packet?.phaseId === 'PHASE_06'
      && phase06Packet?.status === 'PASS'
      && phase06Packet?.phase06DecisionStatus === 'PASS'
      && phase06Packet?.phase06PackDecision === 'EXPLICIT_SKIP'
      && phase06Packet?.phase06PackLayerRequired === false
      && Array.isArray(phase06Packet?.phase06PendingGapIds)
      && phase06Packet.phase06PendingGapIds.length === 0
      && phase06Packet?.proof?.phase05BoundedSpatialShellPassTrue === true
      && phase06Packet?.proof?.biblePackLayerOptionalTrue === true
      && phase06Packet?.proof?.biblePackLayerOnlyIfJustifiedTrue === true
      && phase06Packet?.proof?.canonPackLayerOnlyIfJustifiedTrue === true
      && phase06Packet?.proof?.contextPackLayerNotRequiredTrue === true
      && phase06Packet?.proof?.handoffPackWorkNotCurrentAxisTrue === true
      && phase06Packet?.proof?.noExecutablePluginRuntimeV1True === true
      && phase06Packet?.proof?.noMachineBoundRequiredPackFeatureEvidenceTrue === true
      && phase06Packet?.proof?.explicitSkipDecisionTrue === true
      && phase06Packet?.proof?.noFalsePhase06GreenTrue === true;

    const canonPerformanceHardeningDirectionPresent = canonText.includes('затем minimal pack layer только при реальной необходимости.')
      || canonText.includes('release hardening')
      || canonText.includes('performance hardening');
    const bibleReleaseHardeningDirectionPresent = bibleText.includes('release hardening');
    const contextReleaseHardeningDirectionPresent = contextText.includes('release hardening');
    const executionSequencePerformanceHardeningPresent = Array.isArray(executionSequenceCanon?.sequence)
      && executionSequenceCanon.sequence.includes('PERFORMANCE_HARDENING');

    const blockingBudgetIdsExact = arraysEqual(packet?.phase07BlockingBudgetIds || [], EXPECTED_BLOCKING_BUDGET_IDS);
    const advisoryBudgetIdsExact = arraysEqual(packet?.phase07AdvisoryBudgetIds || [], EXPECTED_ADVISORY_BUDGET_IDS);
    const sourcePhase06DecisionStateMatches = packet?.sourcePhase06DecisionState === 'phase06-real-pack-value-or-explicit-skip-decision-state.mjs';
    const packetPass = packet?.status === 'PASS';
    const packetBaselineStatusPass = packet?.phase07BlockingBudgetsBaselineStatus === 'PASS';
    const packetReleaseReadinessHold = packet?.phase07ReleaseReadinessStatus === 'HOLD';
    const pendingGapIdsPresent = Array.isArray(packet?.phase07PendingGapIds) && packet.phase07PendingGapIds.length === 2;
    const packetInternalConsistency = Boolean(packet)
      && packet?.artifactId === 'PHASE07_STARTUP_PROJECT_OPEN_SCENE_SWITCH_RESET_BLOCKING_BUDGETS_BASELINE_V1'
      && packet?.schemaVersion === 1
      && packet?.phaseId === 'PHASE_07'
      && packetPass
      && packetBaselineStatusPass
      && packetReleaseReadinessHold
      && phase06DecisionPass
      && canonPerformanceHardeningDirectionPresent
      && bibleReleaseHardeningDirectionPresent
      && contextReleaseHardeningDirectionPresent
      && executionSequencePerformanceHardeningPresent
      && blockingBudgetIdsExact
      && advisoryBudgetIdsExact
      && sourcePhase06DecisionStateMatches
      && pendingGapIdsPresent
      && packet?.proof?.phase06DecisionPassTrue === true
      && packet?.proof?.canonPerformanceHardeningDirectionPresentTrue === true
      && packet?.proof?.bibleReleaseHardeningDirectionPresentTrue === true
      && packet?.proof?.contextReleaseHardeningDirectionPresentTrue === true
      && packet?.proof?.executionSequencePerformanceHardeningPresentTrue === true
      && packet?.proof?.blockingBudgetIdsExactTrue === true
      && packet?.proof?.advisoryBudgetIdsExactTrue === true
      && packet?.proof?.sourcePhase06DecisionStateMatchesTrue === true
      && packet?.proof?.baselineOnlyTrue === true
      && packet?.proof?.releaseReadinessHeldTrue === true
      && packet?.proof?.noFalsePhase07GreenTrue === true;

    const checkStatusById = {
      PHASE06_DECISION_PASS: asCheck(phase06DecisionPass ? 'GREEN' : 'OPEN_GAP', true, phase06DecisionPass ? 'PHASE06_DECISION_PASS' : 'PHASE06_DECISION_NOT_PASS'),
      CANON_PERFORMANCE_HARDENING_DIRECTION_PRESENT: asCheck(canonPerformanceHardeningDirectionPresent ? 'GREEN' : 'OPEN_GAP', true, canonPerformanceHardeningDirectionPresent ? 'CANON_PERFORMANCE_HARDENING_DIRECTION_PRESENT' : 'CANON_PERFORMANCE_HARDENING_DIRECTION_MISSING'),
      BIBLE_RELEASE_HARDENING_DIRECTION_PRESENT: asCheck(bibleReleaseHardeningDirectionPresent ? 'GREEN' : 'OPEN_GAP', true, bibleReleaseHardeningDirectionPresent ? 'BIBLE_RELEASE_HARDENING_DIRECTION_PRESENT' : 'BIBLE_RELEASE_HARDENING_DIRECTION_MISSING'),
      CONTEXT_RELEASE_HARDENING_DIRECTION_PRESENT: asCheck(contextReleaseHardeningDirectionPresent ? 'GREEN' : 'OPEN_GAP', true, contextReleaseHardeningDirectionPresent ? 'CONTEXT_RELEASE_HARDENING_DIRECTION_PRESENT' : 'CONTEXT_RELEASE_HARDENING_DIRECTION_MISSING'),
      EXECUTION_SEQUENCE_PERFORMANCE_HARDENING_PRESENT: asCheck(executionSequencePerformanceHardeningPresent ? 'GREEN' : 'OPEN_GAP', true, executionSequencePerformanceHardeningPresent ? 'EXECUTION_SEQUENCE_PERFORMANCE_HARDENING_PRESENT' : 'EXECUTION_SEQUENCE_PERFORMANCE_HARDENING_MISSING'),
      BLOCKING_BUDGET_IDS_EXACT: asCheck(blockingBudgetIdsExact ? 'GREEN' : 'OPEN_GAP', true, blockingBudgetIdsExact ? 'BLOCKING_BUDGET_IDS_EXACT' : 'BLOCKING_BUDGET_IDS_DRIFT'),
      ADVISORY_BUDGET_IDS_EXACT: asCheck(advisoryBudgetIdsExact ? 'GREEN' : 'OPEN_GAP', true, advisoryBudgetIdsExact ? 'ADVISORY_BUDGET_IDS_EXACT' : 'ADVISORY_BUDGET_IDS_DRIFT'),
      SOURCE_PHASE06_DECISION_STATE_MATCHES: asCheck(sourcePhase06DecisionStateMatches ? 'GREEN' : 'OPEN_GAP', true, sourcePhase06DecisionStateMatches ? 'SOURCE_PHASE06_DECISION_STATE_MATCHES' : 'SOURCE_PHASE06_DECISION_STATE_DRIFT'),
      PACKET_PRESENT: asCheck(packetExists ? 'GREEN' : 'OPEN_GAP', true, packetExists ? 'PACKET_PRESENT' : 'PACKET_MISSING'),
      PACKET_PASS: asCheck(packetPass ? 'GREEN' : 'OPEN_GAP', true, packetPass ? 'PACKET_PASS' : 'PACKET_NOT_PASS'),
      PACKET_BASELINE_STATUS_PASS: asCheck(packetBaselineStatusPass ? 'GREEN' : 'OPEN_GAP', true, packetBaselineStatusPass ? 'PACKET_BASELINE_STATUS_PASS' : 'PACKET_BASELINE_STATUS_NOT_PASS'),
      PACKET_RELEASE_READINESS_HOLD: asCheck(packetReleaseReadinessHold ? 'GREEN' : 'OPEN_GAP', true, packetReleaseReadinessHold ? 'PACKET_RELEASE_READINESS_HOLD' : 'PACKET_RELEASE_READINESS_NOT_HOLD'),
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
        phase07BlockingBudgetsBaselineStatus: 'HOLD',
        phase07ReleaseReadinessStatus: 'HOLD',
        greenCheckIds,
        openGapIds: Array.from(new Set([...openGapIds, 'FORCED_NEGATIVE_PATH'])),
        checkStatusById,
        phase07PendingGapIds: packet?.phase07PendingGapIds || [],
        phase07BlockingBudgetIds: packet?.phase07BlockingBudgetIds || [],
        phase07AdvisoryBudgetIds: packet?.phase07AdvisoryBudgetIds || [],
      };
    }

    const overallPass = openGapIds.length === 0;

    return {
      ok: overallPass,
      failReason: '',
      overallStatus: overallPass ? 'PASS' : 'HOLD',
      phase07BlockingBudgetsBaselineStatus: overallPass ? 'PASS' : 'HOLD',
      phase07ReleaseReadinessStatus: packet?.phase07ReleaseReadinessStatus === 'HOLD' ? 'HOLD' : 'UNKNOWN',
      greenCheckIds,
      openGapIds,
      checkStatusById,
      phase07PendingGapIds: packet?.phase07PendingGapIds || [],
      phase07BlockingBudgetIds: packet?.phase07BlockingBudgetIds || [],
      phase07AdvisoryBudgetIds: packet?.phase07AdvisoryBudgetIds || [],
    };
  } catch (error) {
    return {
      ok: false,
      failReason: FAIL_REASON_UNEXPECTED,
      overallStatus: 'HOLD',
      phase07BlockingBudgetsBaselineStatus: 'UNKNOWN',
      phase07ReleaseReadinessStatus: 'UNKNOWN',
      greenCheckIds: [],
      openGapIds: ['PHASE07_STARTUP_PROJECT_OPEN_SCENE_SWITCH_RESET_BLOCKING_BUDGETS_BASELINE_EVALUATION_ERROR'],
      checkStatusById: {},
      phase07PendingGapIds: [],
      phase07BlockingBudgetIds: [],
      phase07AdvisoryBudgetIds: [],
      errorMessage: error && typeof error.message === 'string' ? error.message : 'UNKNOWN',
    };
  }
}

function runCli() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluatePhase07StartupProjectOpenSceneSwitchResetBlockingBudgetsBaselineState({ forceNegative: args.forceNegative });

  if (args.json) {
    console.log(JSON.stringify(state, null, 2));
  } else {
    console.log(`PHASE07_STARTUP_PROJECT_OPEN_SCENE_SWITCH_RESET_BLOCKING_BUDGETS_BASELINE_OK=${state.ok ? 1 : 0}`);
    console.log(`PHASE07_STARTUP_PROJECT_OPEN_SCENE_SWITCH_RESET_BLOCKING_BUDGETS_BASELINE_OVERALL_STATUS=${state.overallStatus}`);
    console.log(`PHASE07_STARTUP_PROJECT_OPEN_SCENE_SWITCH_RESET_BLOCKING_BUDGETS_BASELINE_BLOCKING_BUDGETS_STATUS=${state.phase07BlockingBudgetsBaselineStatus}`);
    console.log(`PHASE07_STARTUP_PROJECT_OPEN_SCENE_SWITCH_RESET_BLOCKING_BUDGETS_BASELINE_RELEASE_READINESS_STATUS=${state.phase07ReleaseReadinessStatus}`);
    console.log(`PHASE07_STARTUP_PROJECT_OPEN_SCENE_SWITCH_RESET_BLOCKING_BUDGETS_BASELINE_OPEN_GAP_IDS=${state.openGapIds.join(',')}`);
    console.log(`PHASE07_STARTUP_PROJECT_OPEN_SCENE_SWITCH_RESET_BLOCKING_BUDGETS_BASELINE_FAIL_REASON=${state.failReason}`);
  }

  process.exit(state.ok ? 0 : 1);
}

const selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(selfPath)) {
  runCli();
}

export { evaluatePhase07StartupProjectOpenSceneSwitchResetBlockingBudgetsBaselineState };

#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { evaluatePhase01CutoverPrepState } from './phase01-cutover-prep-state.mjs';

const FAIL_REASON_FORCED_NEGATIVE = 'E_PHASE01_EXECUTE_READINESS_FORCED_NEGATIVE';
const FAIL_REASON_UNEXPECTED = 'E_PHASE01_EXECUTE_READINESS_UNEXPECTED';
const DELTA_PACKET_PATH = 'docs/OPS/STATUS/PHASE01_REFRESH_DELTA_PACKET_V1.json';
const ONE_PASS_PACKET_PATH = 'docs/OPS/STATUS/PHASE01_ONE_PASS_REFRESH_PACKET_V1.json';
const CANON_STATUS_PATH = 'docs/OPS/STATUS/CANON_STATUS.json';
const ACTIVE_CANON_PATH = 'docs/OPS/STATUS/XPLAT_UNIFIED_MASTER_EXECUTION_CONTRACT_v3.13a-final.md';
const BINDING_INDEX_PATH = 'docs/OPS/STATUS/BINDING_INDEX_v0.md';
const FILE_PATH_BY_BASENAME = Object.freeze({
  'CANON.md': 'CANON.md',
  'BIBLE.md': 'docs/BIBLE.md',
  'CONTEXT.md': 'docs/CONTEXT.md',
  'HANDOFF.md': 'docs/HANDOFF.md',
  'README.md': 'README.md',
});
const STALE_MARKERS_BY_BASENAME = Object.freeze({
  'CANON.md': ['Milestone 0 = docs + CI', 'editor.js не может быть частью Milestone 0'],
  'BIBLE.md': ['# Milestone 0 — “Заморозить новую реальность”', '**M2.2 — Bridge “plain text ↔ tiptap” (временно)**'],
  'CONTEXT.md': ['Milestone 0 выполнен', 'M1: esbuild bundling → M2: Tiptap минимально'],
  'HANDOFF.md': ['Milestone 1: сборка renderer', 'Milestone 2: минимальный Tiptap editor'],
  'README.md': ['### Текущее состояние (legacy)', 'legacy vs vNext'],
});
const REQUIRED_SCOPE = Object.freeze([
  'CANON.md',
  'BIBLE.md',
  'CONTEXT.md',
  'PROCESS.md',
  'HANDOFF.md',
  'README.md',
  'CANON_STATUS.json',
  'XPLAT_UNIFIED_MASTER_EXECUTION_CONTRACT_v3.13a-final.md',
  'BINDING_INDEX_v0.md',
]);
const REQUIRED_APPLIED_ACTIONS = Object.freeze({
  'CANON.md': 'APPLIED',
  'BIBLE.md': 'APPLIED',
  'CONTEXT.md': 'APPLIED',
  'PROCESS.md': 'VERIFIED',
  'HANDOFF.md': 'APPLIED',
  'README.md': 'APPLIED',
  'CANON_STATUS.json': 'VERIFIED',
  'XPLAT_UNIFIED_MASTER_EXECUTION_CONTRACT_v3.13a-final.md': 'VERIFIED',
  'BINDING_INDEX_v0.md': 'VERIFIED',
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

function asCheck(status, measured, note) {
  return { status, measured, note };
}

function sameSet(left, right) {
  const a = [...left].sort();
  const b = [...right].sort();
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function evaluatePhase01ExecuteReadinessState(input = {}) {
  const forceNegative = Boolean(input.forceNegative);

  try {
    const prepState = evaluatePhase01CutoverPrepState({});
    const deltaPacket = readJson(DELTA_PACKET_PATH);
    const onePassPacket = readJson(ONE_PASS_PACKET_PATH);
    const canonStatus = readJson(CANON_STATUS_PATH);
    const activeCanonText = fs.readFileSync(path.resolve(ACTIVE_CANON_PATH), 'utf8');
    const bindingIndexText = fs.readFileSync(path.resolve(BINDING_INDEX_PATH), 'utf8');

    const staleMarkersCleared = Object.entries(STALE_MARKERS_BY_BASENAME).every(([basename, markers]) => {
      const text = fs.readFileSync(path.resolve(FILE_PATH_BY_BASENAME[basename]), 'utf8');
      return markers.every((marker) => !text.includes(marker));
    });

    const onePassScopeMatches = sameSet(onePassPacket.refreshScopeBasenames || [], REQUIRED_SCOPE);
    const actionStatusesMatch = Object.entries(REQUIRED_APPLIED_ACTIONS).every(([basename, expectedStatus]) => {
      const action = (onePassPacket.plannedRefreshActions || []).find((entry) => entry.basename === basename);
      return action && action.mutationStatus === expectedStatus;
    });
    const pendingExecuteCleared = Array.isArray(onePassPacket.pendingExecuteGapIds)
      && onePassPacket.pendingExecuteGapIds.length === 0;
    const onePassMarkedPass = onePassPacket.refreshExecutionStatus === 'PASS';
    const deltaStillBound = deltaPacket.status === 'PASS';
    const prepStatePass = prepState.overallStatus === 'PASS';
    const activeCanonStillBound = String(canonStatus.canonicalDocPath || '').endsWith('XPLAT_UNIFIED_MASTER_EXECUTION_CONTRACT_v3.13a-final.md');
    const activeCanonContainsWriterTrack = activeCanonText.includes('## END PART VI — WRITER_V1_PRODUCT_TRACK_V5_RESOLUTION')
      && activeCanonText.includes('### VI.10 FACTUAL DOC CUTOVER')
      && activeCanonText.includes('### VII.7 FACTUAL DOC REFRESH RULE');
    const bindingIndexStillPointsToCanon = bindingIndexText.includes('SOURCE: XPLAT_UNIFIED_MASTER_EXECUTION_CONTRACT_v3.13a-final.md');

    const checkStatusById = {
      PREP_STATE_PASS: asCheck(prepStatePass ? 'GREEN' : 'OPEN_GAP', true, prepStatePass ? 'PREP_STATE_PASS' : 'PREP_STATE_NOT_READY'),
      DELTA_PACKET_STILL_BOUND: asCheck(deltaStillBound ? 'GREEN' : 'OPEN_GAP', true, deltaStillBound ? 'DELTA_PACKET_STILL_BOUND' : 'DELTA_PACKET_DRIFT'),
      STALE_MARKERS_CLEARED: asCheck(staleMarkersCleared ? 'GREEN' : 'OPEN_GAP', true, staleMarkersCleared ? 'STALE_MARKERS_CLEARED' : 'STALE_MARKERS_REMAIN'),
      ONE_PASS_SCOPE_MATCH: asCheck(onePassScopeMatches ? 'GREEN' : 'OPEN_GAP', true, onePassScopeMatches ? 'ONE_PASS_SCOPE_MATCH' : 'ONE_PASS_SCOPE_MISMATCH'),
      ONE_PASS_ACTIONS_COMPLETE: asCheck(actionStatusesMatch ? 'GREEN' : 'OPEN_GAP', true, actionStatusesMatch ? 'ONE_PASS_ACTIONS_COMPLETE' : 'ONE_PASS_ACTIONS_INCOMPLETE'),
      PENDING_EXECUTE_GAPS_CLEARED: asCheck(pendingExecuteCleared ? 'GREEN' : 'OPEN_GAP', true, pendingExecuteCleared ? 'PENDING_EXECUTE_GAPS_CLEARED' : 'PENDING_EXECUTE_GAPS_REMAIN'),
      ONE_PASS_MARKED_PASS: asCheck(onePassMarkedPass ? 'GREEN' : 'OPEN_GAP', true, onePassMarkedPass ? 'ONE_PASS_MARKED_PASS' : 'ONE_PASS_NOT_PASS'),
      ACTIVE_CANON_STILL_BOUND: asCheck(activeCanonStillBound ? 'GREEN' : 'OPEN_GAP', true, activeCanonStillBound ? 'ACTIVE_CANON_STILL_BOUND' : 'ACTIVE_CANON_DRIFT'),
      ACTIVE_CANON_WRITER_TRACK_PRESENT: asCheck(activeCanonContainsWriterTrack ? 'GREEN' : 'OPEN_GAP', true, activeCanonContainsWriterTrack ? 'ACTIVE_CANON_WRITER_TRACK_PRESENT' : 'ACTIVE_CANON_WRITER_TRACK_MISSING'),
      BINDING_INDEX_STILL_MATCH: asCheck(bindingIndexStillPointsToCanon ? 'GREEN' : 'OPEN_GAP', true, bindingIndexStillPointsToCanon ? 'BINDING_INDEX_STILL_MATCH' : 'BINDING_INDEX_DRIFT'),
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
        executeReadinessStatus: 'HOLD',
        greenCheckIds,
        openGapIds: Array.from(new Set([...openGapIds, 'FORCED_NEGATIVE_PATH'])),
        checkStatusById,
        staleDocBasenames: [],
        lockedRefreshScopeBasenames: REQUIRED_SCOPE,
      };
    }

    return {
      ok: openGapIds.length === 0,
      failReason: '',
      overallStatus: openGapIds.length === 0 ? 'PASS' : 'HOLD',
      executeReadinessStatus: openGapIds.length === 0 ? 'PASS' : 'HOLD',
      greenCheckIds,
      openGapIds,
      checkStatusById,
      staleDocBasenames: staleMarkersCleared ? [] : Object.keys(STALE_MARKERS_BY_BASENAME),
      lockedRefreshScopeBasenames: REQUIRED_SCOPE,
    };
  } catch (error) {
    return {
      ok: false,
      failReason: FAIL_REASON_UNEXPECTED,
      overallStatus: 'HOLD',
      executeReadinessStatus: 'UNKNOWN',
      greenCheckIds: [],
      openGapIds: ['PHASE01_EXECUTE_READINESS_EVALUATION_ERROR'],
      checkStatusById: {},
      staleDocBasenames: [],
      lockedRefreshScopeBasenames: REQUIRED_SCOPE,
      errorMessage: error && typeof error.message === 'string' ? error.message : 'UNKNOWN',
    };
  }
}

function runCli() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluatePhase01ExecuteReadinessState({ forceNegative: args.forceNegative });

  if (args.json) {
    console.log(JSON.stringify(state, null, 2));
  } else {
    console.log(`PHASE01_EXECUTE_READINESS_OK=${state.ok ? 1 : 0}`);
    console.log(`PHASE01_EXECUTE_READINESS_OVERALL_STATUS=${state.overallStatus}`);
    console.log(`PHASE01_EXECUTE_READINESS_STATUS=${state.executeReadinessStatus}`);
    console.log(`PHASE01_EXECUTE_READINESS_OPEN_GAP_IDS=${state.openGapIds.join(',')}`);
    console.log(`PHASE01_EXECUTE_READINESS_FAIL_REASON=${state.failReason}`);
  }

  process.exit(state.ok ? 0 : 1);
}

const selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(selfPath)) {
  runCli();
}

export { evaluatePhase01ExecuteReadinessState };

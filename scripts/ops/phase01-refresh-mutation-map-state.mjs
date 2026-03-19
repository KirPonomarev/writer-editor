#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { evaluatePhase01ExecuteReadinessState } from './phase01-execute-readiness-state.mjs';

const FAIL_REASON_FORCED_NEGATIVE = 'E_PHASE01_REFRESH_MUTATION_MAP_FORCED_NEGATIVE';
const FAIL_REASON_UNEXPECTED = 'E_PHASE01_REFRESH_MUTATION_MAP_UNEXPECTED';
const MAP_PATH = 'docs/OPS/STATUS/PHASE01_REFRESH_MUTATION_MAP_V1.json';
const STATUS_PATH = 'docs/OPS/STATUS/PHASE01_DELTA_REFRESH_STATUS_V1.json';
const REQUIRED_STALE_DOCS = Object.freeze([
  'CANON.md',
  'BIBLE.md',
  'CONTEXT.md',
  'HANDOFF.md',
  'README.md',
]);
const REQUIRED_OUTCOME_IDS_BY_DOC = Object.freeze({
  'CANON.md': [
    'ACTIVE_CANON_RESOLUTION_EXPLICIT',
    'WRITER_V1_SCOPE_NARROWING_REFERENCED',
    'PRIMARY_EDITOR_CLOSURE_AS_HARD_GATE',
    'FACTUAL_DOC_CUTOVER_RULE_EXPLICIT',
    'STALE_MILESTONE_ZERO_LAW_REMOVED',
  ],
  'BIBLE.md': [
    'ACTIVE_EXECUTION_ORDER_ROUTED_TO_ACTIVE_CANON',
    'OLD_MILESTONE_SEQUENCE_MARKED_AS_HISTORICAL_CONTEXT',
    'WRITER_V1_SCOPE_AND_MVP_INVARIANTS_PRESERVED',
    'NO_DUPLICATE_BLOCKING_AUTHORITY',
  ],
  'CONTEXT.md': [
    'PRIMARY_EDITOR_CLOSURE_PASS_RECORDED',
    'TITPTAP_PRIMARY_PATH_RECORDED',
    'PHASE01_PREP_PASS_RECORDED',
    'NO_LEGACY_TRANSITION_WORLD_AS_PRIMARY_REALITY',
    'NEXT_STEP_ROUTED_TO_PHASE01_EXECUTE_AND_PHASE02',
  ],
  'HANDOFF.md': [
    'ACTIVE_CANON_ENTRYPOINT_ORDER_UPDATED',
    'PRIMARY_EDITOR_CLOSURE_PASS_RECORDED',
    'CURRENT_WRITER_V1_STATE_RECORDED',
    'OLD_M1_M2_NEXT_STEPS_REMOVED',
  ],
  'README.md': [
    'LEGACY_HEADING_REMOVED',
    'PRIMARY_EDITOR_PATH_NOW_PRIMARY',
    'OFFLINE_FIRST_AND_WRITER_V1_SCOPE_RETAINED',
    'NO_TRANSITION_WORDING_AS_PRIMARY_REALITY',
  ],
});
const REQUIRED_PRESERVE_OUTCOME_IDS = Object.freeze([
  'DESKTOP_FIRST',
  'OFFLINE_FIRST',
  'SCENES_AS_ENTITIES',
  'ATOMIC_WRITE_AND_RECOVERY',
  'DOCX_FIRST_EXPORT',
  'NO_NETWORK_TRUTH_IN_V1',
  'NO_EXECUTABLE_PLUGIN_RUNTIME_IN_V1',
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

function sha256Text(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function asCheck(status, measured, note) {
  return { status, measured, note };
}

function evaluatePhase01RefreshMutationMapState(input = {}) {
  const forceNegative = Boolean(input.forceNegative);

  try {
    const executeReadiness = evaluatePhase01ExecuteReadinessState({});
    const mapExists = fs.existsSync(path.resolve(MAP_PATH));
    const statusExists = fs.existsSync(path.resolve(STATUS_PATH));
    const mapText = mapExists ? fs.readFileSync(path.resolve(MAP_PATH), 'utf8') : '';
    const mapJson = mapExists ? JSON.parse(mapText) : null;
    const statusJson = statusExists ? readJson(STATUS_PATH) : null;

    const mapScope = Array.isArray(mapJson?.scopeBasenames) ? mapJson.scopeBasenames : [];
    const planEntries = mapJson?.mutationPlanByBasename || {};
    const allDocsCovered = REQUIRED_STALE_DOCS.every((basename) => planEntries[basename]);
    const scopeMatches = REQUIRED_STALE_DOCS.every((basename) => mapScope.includes(basename));
    const outcomesMatch = REQUIRED_STALE_DOCS.every((basename) => {
      const actual = Array.isArray(planEntries[basename]?.targetOutcomeIds) ? planEntries[basename].targetOutcomeIds : [];
      return REQUIRED_OUTCOME_IDS_BY_DOC[basename].every((id) => actual.includes(id));
    });
    const preserveOutcomesBound = REQUIRED_PRESERVE_OUTCOME_IDS.every((id) =>
      Array.isArray(mapJson?.preserveOutcomeIds) && mapJson.preserveOutcomeIds.includes(id));
    const mapHash = mapExists ? sha256Text(mapText) : '';
    const hashMatches = statusJson?.DELTA_MAP_FROZEN_SHA256 === mapHash;
    const statusPointsToMap = statusJson?.deltaMapBasename === 'PHASE01_REFRESH_MUTATION_MAP_V1.json';
    const statusRefreshedTrue = statusJson?.refreshed === true && statusJson?.noScopeExpansionTrue === true;
    const executeReadinessPass = executeReadiness.overallStatus === 'PASS'
      && (executeReadiness.executeReadinessStatus === 'HOLD' || executeReadiness.executeReadinessStatus === 'PASS');

    const checkStatusById = {
      EXECUTE_READINESS_PASS: asCheck(executeReadinessPass ? 'GREEN' : 'OPEN_GAP', true, executeReadinessPass ? 'EXECUTE_READINESS_PASS' : 'EXECUTE_READINESS_NOT_READY'),
      MUTATION_MAP_PRESENT: asCheck(mapExists ? 'GREEN' : 'OPEN_GAP', true, mapExists ? 'MUTATION_MAP_PRESENT' : 'MUTATION_MAP_MISSING'),
      MUTATION_SCOPE_MATCH: asCheck(scopeMatches ? 'GREEN' : 'OPEN_GAP', true, scopeMatches ? 'MUTATION_SCOPE_MATCH' : 'MUTATION_SCOPE_MISMATCH'),
      ALL_STALE_DOCS_COVERED: asCheck(allDocsCovered ? 'GREEN' : 'OPEN_GAP', true, allDocsCovered ? 'ALL_STALE_DOCS_COVERED' : 'STALE_DOC_COVERAGE_GAP'),
      TARGET_OUTCOMES_BOUND: asCheck(outcomesMatch ? 'GREEN' : 'OPEN_GAP', true, outcomesMatch ? 'TARGET_OUTCOMES_BOUND' : 'TARGET_OUTCOMES_MISSING'),
      PRESERVE_OUTCOMES_BOUND: asCheck(preserveOutcomesBound ? 'GREEN' : 'OPEN_GAP', true, preserveOutcomesBound ? 'PRESERVE_OUTCOMES_BOUND' : 'PRESERVE_OUTCOMES_MISSING'),
      DELTA_REFRESH_STATUS_PRESENT: asCheck(statusExists ? 'GREEN' : 'OPEN_GAP', true, statusExists ? 'DELTA_REFRESH_STATUS_PRESENT' : 'DELTA_REFRESH_STATUS_MISSING'),
      DELTA_REFRESH_STATUS_POINTS_TO_MAP: asCheck(statusPointsToMap ? 'GREEN' : 'OPEN_GAP', true, statusPointsToMap ? 'DELTA_REFRESH_STATUS_POINTS_TO_MAP' : 'DELTA_REFRESH_STATUS_MAP_DRIFT'),
      DELTA_MAP_HASH_MATCH: asCheck(hashMatches ? 'GREEN' : 'OPEN_GAP', true, hashMatches ? 'DELTA_MAP_HASH_MATCH' : 'DELTA_MAP_HASH_MISMATCH'),
      DELTA_REFRESH_STATUS_VALID: asCheck(statusRefreshedTrue ? 'GREEN' : 'OPEN_GAP', true, statusRefreshedTrue ? 'DELTA_REFRESH_STATUS_VALID' : 'DELTA_REFRESH_STATUS_INVALID'),
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
        greenCheckIds,
        openGapIds: Array.from(new Set([...openGapIds, 'FORCED_NEGATIVE_PATH'])),
        checkStatusById,
        staleDocBasenames: REQUIRED_STALE_DOCS,
        mutationMapHash: mapHash,
      };
    }

    return {
      ok: openGapIds.length === 0,
      failReason: '',
      overallStatus: openGapIds.length === 0 ? 'PASS' : 'HOLD',
      greenCheckIds,
      openGapIds,
      checkStatusById,
      staleDocBasenames: REQUIRED_STALE_DOCS,
      mutationMapHash: mapHash,
    };
  } catch (error) {
    return {
      ok: false,
      failReason: FAIL_REASON_UNEXPECTED,
      overallStatus: 'HOLD',
      greenCheckIds: [],
      openGapIds: ['PHASE01_REFRESH_MUTATION_MAP_EVALUATION_ERROR'],
      checkStatusById: {},
      staleDocBasenames: REQUIRED_STALE_DOCS,
      mutationMapHash: '',
      errorMessage: error && typeof error.message === 'string' ? error.message : 'UNKNOWN',
    };
  }
}

function runCli() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluatePhase01RefreshMutationMapState({ forceNegative: args.forceNegative });

  if (args.json) {
    console.log(JSON.stringify(state, null, 2));
  } else {
    console.log(`PHASE01_REFRESH_MUTATION_MAP_OK=${state.ok ? 1 : 0}`);
    console.log(`PHASE01_REFRESH_MUTATION_MAP_OVERALL_STATUS=${state.overallStatus}`);
    console.log(`PHASE01_REFRESH_MUTATION_MAP_OPEN_GAP_IDS=${state.openGapIds.join(',')}`);
    console.log(`PHASE01_REFRESH_MUTATION_MAP_FAIL_REASON=${state.failReason}`);
  }

  process.exit(state.ok ? 0 : 1);
}

const selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(selfPath)) {
  runCli();
}

export { evaluatePhase01RefreshMutationMapState };

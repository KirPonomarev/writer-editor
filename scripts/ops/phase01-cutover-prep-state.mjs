#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FAIL_REASON_FORCED_NEGATIVE = 'E_PHASE01_CUTOVER_PREP_FORCED_NEGATIVE';
const FAIL_REASON_UNEXPECTED = 'E_PHASE01_CUTOVER_PREP_UNEXPECTED';
const PREP_PACKET_PATH = 'docs/OPS/STATUS/PHASE01_CUTOVER_PREP_PACKET_V1.json';
const CANON_STATUS_PATH = 'docs/OPS/STATUS/CANON_STATUS.json';
const BINDING_INDEX_PATH = 'docs/OPS/STATUS/BINDING_INDEX_v0.md';
const REQUIRED_REFRESH_SCOPE = Object.freeze([
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

function evaluatePhase01CutoverPrepState(input = {}) {
  const forceNegative = Boolean(input.forceNegative);

  try {
    const prepPacketExists = fs.existsSync(path.resolve(PREP_PACKET_PATH));
    const canonStatusExists = fs.existsSync(path.resolve(CANON_STATUS_PATH));
    const bindingIndexExists = fs.existsSync(path.resolve(BINDING_INDEX_PATH));

    const prepPacket = prepPacketExists ? readJson(PREP_PACKET_PATH) : null;
    const canonStatus = canonStatusExists ? readJson(CANON_STATUS_PATH) : null;
    const bindingIndexText = bindingIndexExists
      ? fs.readFileSync(path.resolve(BINDING_INDEX_PATH), 'utf8')
      : '';

    const activeCanonBasename = String(canonStatus?.canonicalDocPath || '').split('/').pop() || '';
    const prepCanonBasename = prepPacket?.activeExecutionCanon?.canonicalDocBasename || '';
    const bindingIndexSourceLine = bindingIndexText.split('\n').find((line) => line.startsWith('SOURCE:')) || '';
    const bindingIndexSourceBasename = bindingIndexSourceLine.split(':').slice(1).join(':').trim();
    const lockedRefreshScope = Array.isArray(prepPacket?.lockedRefreshScopeBasenames)
      ? prepPacket.lockedRefreshScopeBasenames
      : [];
    const lockedExecuteGapIds = Array.isArray(prepPacket?.lockedExecuteGapIds)
      ? prepPacket.lockedExecuteGapIds
      : [];

    const refreshScopeLocked = REQUIRED_REFRESH_SCOPE.every((basename) => lockedRefreshScope.includes(basename));
    const activeCanonBound = activeCanonBasename === 'XPLAT_UNIFIED_MASTER_EXECUTION_CONTRACT_v3.13a-final.md';
    const prepPacketCanonMatches = prepCanonBasename === activeCanonBasename;
    const bindingIndexMatches = bindingIndexSourceBasename === activeCanonBasename;
    const executeStillBlocked = prepPacket?.executeReadinessStatus === 'HOLD'
      && lockedExecuteGapIds.includes('ONE_PASS_REFRESH_NOT_EXECUTED');

    const checkStatusById = {
      PREP_PACKET_PRESENT: asCheck(prepPacketExists ? 'GREEN' : 'OPEN_GAP', true, prepPacketExists ? 'PREP_PACKET_PRESENT' : 'PREP_PACKET_MISSING'),
      ACTIVE_CANON_BOUND: asCheck(activeCanonBound ? 'GREEN' : 'OPEN_GAP', true, activeCanonBound ? 'ACTIVE_CANON_BOUND' : 'ACTIVE_CANON_DRIFT'),
      PREP_PACKET_CANON_MATCH: asCheck(prepPacketCanonMatches ? 'GREEN' : 'OPEN_GAP', true, prepPacketCanonMatches ? 'PREP_PACKET_CANON_MATCH' : 'PREP_PACKET_CANON_MISMATCH'),
      BINDING_INDEX_PRESENT: asCheck(bindingIndexExists ? 'GREEN' : 'OPEN_GAP', true, bindingIndexExists ? 'BINDING_INDEX_PRESENT' : 'BINDING_INDEX_MISSING'),
      BINDING_INDEX_MATCH: asCheck(bindingIndexMatches ? 'GREEN' : 'OPEN_GAP', true, bindingIndexMatches ? 'BINDING_INDEX_MATCH' : 'BINDING_INDEX_DRIFT'),
      REFRESH_SCOPE_LOCKED: asCheck(refreshScopeLocked ? 'GREEN' : 'OPEN_GAP', true, refreshScopeLocked ? 'REFRESH_SCOPE_LOCKED' : 'REFRESH_SCOPE_INCOMPLETE'),
      EXECUTE_NOT_FALSE_GREEN: asCheck(executeStillBlocked ? 'GREEN' : 'OPEN_GAP', true, executeStillBlocked ? 'EXECUTE_REMAINS_HOLD' : 'EXECUTE_FALSE_GREEN'),
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
        lockedRefreshScopeBasenames: lockedRefreshScope,
        lockedExecuteGapIds,
      };
    }

    return {
      ok: true,
      failReason: '',
      overallStatus: openGapIds.length === 0 ? 'PASS' : 'HOLD',
      executeReadinessStatus: executeStillBlocked ? 'HOLD' : 'UNKNOWN',
      greenCheckIds,
      openGapIds,
      checkStatusById,
      lockedRefreshScopeBasenames: lockedRefreshScope,
      lockedExecuteGapIds,
    };
  } catch (error) {
    return {
      ok: false,
      failReason: FAIL_REASON_UNEXPECTED,
      overallStatus: 'HOLD',
      executeReadinessStatus: 'UNKNOWN',
      greenCheckIds: [],
      openGapIds: ['PHASE01_CUTOVER_PREP_EVALUATION_ERROR'],
      checkStatusById: {},
      lockedRefreshScopeBasenames: [],
      lockedExecuteGapIds: [],
      errorMessage: error && typeof error.message === 'string' ? error.message : 'UNKNOWN',
    };
  }
}

function runCli() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluatePhase01CutoverPrepState({ forceNegative: args.forceNegative });

  if (args.json) {
    console.log(JSON.stringify(state, null, 2));
  } else {
    console.log(`PHASE01_CUTOVER_PREP_OK=${state.ok ? 1 : 0}`);
    console.log(`PHASE01_CUTOVER_PREP_OVERALL_STATUS=${state.overallStatus}`);
    console.log(`PHASE01_CUTOVER_PREP_EXECUTE_READINESS_STATUS=${state.executeReadinessStatus}`);
    console.log(`PHASE01_CUTOVER_PREP_OPEN_GAP_IDS=${state.openGapIds.join(',')}`);
    console.log(`PHASE01_CUTOVER_PREP_FAIL_REASON=${state.failReason}`);
  }

  process.exit(state.ok ? 0 : 1);
}

const selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(selfPath)) {
  runCli();
}

export { evaluatePhase01CutoverPrepState };

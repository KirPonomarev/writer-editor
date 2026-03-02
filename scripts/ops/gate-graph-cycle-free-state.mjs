#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateGateGraphCheckV1State } from './gate-graph-check-v1-state.mjs';

const TOKEN_NAME = 'GATE_GRAPH_CYCLE_FREE_OK';
const FAIL_CODE = 'E_GATE_GRAPH_CYCLE_DETECTED';
const FAIL_PRE_EXECUTION_SKIPPED = 'E_PRE_EXECUTION_CHECK_SKIPPED';
const FAIL_PRE_MERGE_SKIPPED = 'E_PRE_MERGE_CHECK_SKIPPED';

function isObjectRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stableSortObject(value) {
  if (Array.isArray(value)) return value.map((entry) => stableSortObject(entry));
  if (!isObjectRecord(value)) return value;
  const out = {};
  for (const key of Object.keys(value).sort((a, b) => a.localeCompare(b))) {
    out[key] = stableSortObject(value[key]);
  }
  return out;
}

function stableStringify(value) {
  return JSON.stringify(stableSortObject(value), null, 2);
}

function parseArgs(argv = process.argv.slice(2)) {
  const out = {
    json: false,
    mode: '',
    preExecutionCheck: true,
    preMergeCheck: true,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = String(argv[i] || '').trim();
    if (!arg) continue;
    if (arg === '--json') out.json = true;
    if (arg === '--mode' && i + 1 < argv.length) {
      out.mode = String(argv[i + 1] || '').trim();
      i += 1;
    }
    if (arg === '--pre-execution-check' && i + 1 < argv.length) {
      out.preExecutionCheck = String(argv[i + 1] || '').trim() !== '0';
      i += 1;
    }
    if (arg === '--pre-merge-check' && i + 1 < argv.length) {
      out.preMergeCheck = String(argv[i + 1] || '').trim() !== '0';
      i += 1;
    }
  }

  return out;
}

export function evaluateGateGraphCycleFreeState(input = {}) {
  const mode = input.mode || 'release';
  const preExecutionCheckRequested = input.preExecutionCheck !== false;
  const preMergeCheckRequested = input.preMergeCheck !== false;
  const preExecutionState = preExecutionCheckRequested
    ? evaluateGateGraphCheckV1State({ mode })
    : null;
  const preMergeState = preMergeCheckRequested
    ? evaluateGateGraphCheckV1State({ mode })
    : null;
  const preExecutionCheckOk = Boolean(preExecutionState && preExecutionState.CIRCULAR_DEPENDENCY_BREAK_OK === 1 && preExecutionState.ok === true);
  const preMergeCheckOk = Boolean(preMergeState && preMergeState.CIRCULAR_DEPENDENCY_BREAK_OK === 1 && preMergeState.ok === true);
  const cycleDetected = Boolean(
    (preExecutionState && preExecutionState.cycleDetected === true)
    || (preMergeState && preMergeState.cycleDetected === true)
  );
  const ok = preExecutionCheckRequested
    && preMergeCheckRequested
    && preExecutionCheckOk
    && preMergeCheckOk
    && !cycleDetected;
  let failReason = '';
  if (!ok) {
    if (!preExecutionCheckRequested) failReason = FAIL_PRE_EXECUTION_SKIPPED;
    else if (!preMergeCheckRequested) failReason = FAIL_PRE_MERGE_SKIPPED;
    else failReason = FAIL_CODE;
  }

  return {
    ok,
    [TOKEN_NAME]: ok ? 1 : 0,
    failReason,
    failSignalCode: failReason,
    details: {
      preExecutionCheckRequested: preExecutionCheckRequested ? 1 : 0,
      preExecutionCheckOk: preExecutionCheckOk ? 1 : 0,
      preMergeCheckRequested: preMergeCheckRequested ? 1 : 0,
      preMergeCheckOk: preMergeCheckOk ? 1 : 0,
      cycleDetected: cycleDetected ? 1 : 0,
      preExecutionToken: Number(preExecutionState?.CIRCULAR_DEPENDENCY_BREAK_OK || 0),
      preMergeToken: Number(preMergeState?.CIRCULAR_DEPENDENCY_BREAK_OK || 0),
      preExecutionFailReason: String(preExecutionState?.failReason || ''),
      preMergeFailReason: String(preMergeState?.failReason || ''),
      graphNodeCount: Number(preMergeState?.graphNodeCount || preExecutionState?.graphNodeCount || 0),
      graphEdgeCount: Number(preMergeState?.graphEdgeCount || preExecutionState?.graphEdgeCount || 0),
    },
  };
}

function printHuman(state) {
  console.log(`${TOKEN_NAME}=${state[TOKEN_NAME]}`);
  console.log(`GATE_GRAPH_CYCLE_DETECTED=${state.details.cycleDetected}`);
  console.log(`GATE_GRAPH_PRE_EXECUTION_CHECK=${state.details.preExecutionCheckOk}`);
  console.log(`GATE_GRAPH_PRE_MERGE_CHECK=${state.details.preMergeCheckOk}`);
  if (!state.ok) {
    console.log(`FAIL_REASON=${state.failReason}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluateGateGraphCycleFreeState({
    mode: args.mode || 'release',
    preExecutionCheck: args.preExecutionCheck,
    preMergeCheck: args.preMergeCheck,
  });
  if (args.json) {
    process.stdout.write(`${stableStringify(state)}\n`);
  } else {
    printHuman(state);
  }
  process.exit(state[TOKEN_NAME] === 1 ? 0 : 1);
}

const selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === selfPath) {
  main();
}

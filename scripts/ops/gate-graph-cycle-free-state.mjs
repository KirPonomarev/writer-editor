#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateGateGraphCheckV1State } from './gate-graph-check-v1-state.mjs';

const TOKEN_NAME = 'GATE_GRAPH_CYCLE_FREE_OK';
const FAIL_CODE = 'E_GATE_GRAPH_CYCLE_DETECTED';

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
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = String(argv[i] || '').trim();
    if (!arg) continue;
    if (arg === '--json') out.json = true;
    if (arg === '--mode' && i + 1 < argv.length) {
      out.mode = String(argv[i + 1] || '').trim();
      i += 1;
    }
  }

  return out;
}

export function evaluateGateGraphCycleFreeState(input = {}) {
  const base = evaluateGateGraphCheckV1State({ mode: input.mode || 'release' });
  const ok = base.CIRCULAR_DEPENDENCY_BREAK_OK === 1 && base.ok === true;

  return {
    ok,
    [TOKEN_NAME]: ok ? 1 : 0,
    failReason: ok ? '' : FAIL_CODE,
    failSignalCode: ok ? '' : FAIL_CODE,
    details: {
      baseToken: Number(base.CIRCULAR_DEPENDENCY_BREAK_OK || 0),
      baseFailReason: String(base.failReason || ''),
      cycleDetected: base.cycleDetected === true,
      graphNodeCount: Number(base.graphNodeCount || 0),
      graphEdgeCount: Number(base.graphEdgeCount || 0),
    },
  };
}

function printHuman(state) {
  console.log(`${TOKEN_NAME}=${state[TOKEN_NAME]}`);
  console.log(`GATE_GRAPH_CYCLE_DETECTED=${state.details.cycleDetected ? 1 : 0}`);
  if (!state.ok) {
    console.log(`FAIL_REASON=${state.failReason}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluateGateGraphCycleFreeState({ mode: args.mode || 'release' });
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

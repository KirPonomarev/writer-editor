#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TOKEN_NAME = 'STRICT_RUN_CAP_ACTIVE_TRUE';
const FAIL_CODE = 'E_STRICT_RUN_CAP_EXCEEDED';
const DEFAULT_MAX_PER_CONTOUR = 5;

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

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

function toInt(value, fallback) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : fallback;
}

function parseArgs(argv = process.argv.slice(2)) {
  const out = {
    json: false,
    currentRuns: 0,
    maxRuns: DEFAULT_MAX_PER_CONTOUR,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = normalizeString(argv[i]);
    if (!arg) continue;

    if (arg === '--json') {
      out.json = true;
      continue;
    }

    if (arg === '--current-runs' && i + 1 < argv.length) {
      out.currentRuns = toInt(argv[i + 1], out.currentRuns);
      i += 1;
      continue;
    }
    if (arg.startsWith('--current-runs=')) {
      out.currentRuns = toInt(arg.slice('--current-runs='.length), out.currentRuns);
      continue;
    }

    if (arg === '--max-runs' && i + 1 < argv.length) {
      out.maxRuns = toInt(argv[i + 1], out.maxRuns);
      i += 1;
      continue;
    }
    if (arg.startsWith('--max-runs=')) {
      out.maxRuns = toInt(arg.slice('--max-runs='.length), out.maxRuns);
      continue;
    }
  }

  return out;
}

export function evaluateStrictRunCapState(input = {}) {
  const currentRuns = toInt(input.currentRuns, toInt(process.env.STRICT_RUN_CURRENT, 0));
  const maxRuns = toInt(input.maxRuns, toInt(process.env.STRICT_RUN_MAX, DEFAULT_MAX_PER_CONTOUR));
  const ok = currentRuns <= maxRuns;

  return {
    ok,
    [TOKEN_NAME]: ok ? 1 : 0,
    failReason: ok ? '' : FAIL_CODE,
    failSignalCode: ok ? '' : FAIL_CODE,
    details: {
      currentRuns,
      maxRuns,
    },
  };
}

function printHuman(state) {
  console.log(`${TOKEN_NAME}=${state[TOKEN_NAME]}`);
  console.log(`STRICT_RUN_CURRENT=${state.details.currentRuns}`);
  console.log(`STRICT_RUN_MAX=${state.details.maxRuns}`);
  if (!state.ok) {
    console.log(`FAIL_REASON=${state.failReason}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluateStrictRunCapState(args);
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

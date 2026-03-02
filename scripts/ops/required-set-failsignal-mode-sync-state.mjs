#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateFailsignalModeSyncAutomationState } from './failsignal-mode-sync-automation-state.mjs';

const TOKEN_NAME = 'REQUIRED_SET_FAILSIGNAL_MODE_SYNC_OK';
const FAIL_CODE = 'E_REQUIRED_SET_FAILSIGNAL_MODE_SYNC';

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
  return {
    json: argv.includes('--json'),
  };
}

export function evaluateRequiredSetFailsignalModeSyncState() {
  const parsed = evaluateFailsignalModeSyncAutomationState({
    repoRoot: process.cwd(),
  });
  const token = Number(parsed?.FAILSIGNAL_MODE_SYNC_AUTOMATION_OK || 0);
  const ok = parsed?.ok === true && token === 1;

  return {
    ok,
    [TOKEN_NAME]: ok ? 1 : 0,
    failReason: ok ? '' : FAIL_CODE,
    failSignalCode: ok ? '' : FAIL_CODE,
    details: {
      baseExitCode: ok ? 0 : 1,
      baseToken: token,
    },
  };
}

function printHuman(state) {
  console.log(`${TOKEN_NAME}=${state[TOKEN_NAME]}`);
  console.log(`FAILSIGNAL_MODE_SYNC_BASE_EXIT=${state.details.baseExitCode}`);
  console.log(`FAILSIGNAL_MODE_SYNC_BASE_TOKEN=${state.details.baseToken}`);
  if (!state.ok) {
    console.log(`FAIL_REASON=${state.failReason}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluateRequiredSetFailsignalModeSyncState();
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

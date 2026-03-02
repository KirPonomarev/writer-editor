#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TOKEN_NAME = 'OWNER_SIGNAL_SCHEMA_VALID_TRUE';
const FAIL_CODE = 'E_OWNER_OPEN_SIGNAL_INVALID';
const DEFAULT_RECORD_PATH = 'docs/OPS/STATUS/OWNER_OPEN_SIGNAL_RECORD_V1.json';

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

function readJsonObject(filePath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return isObjectRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function parseArgs(argv = process.argv.slice(2)) {
  const out = {
    json: false,
    recordPath: '',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = normalizeString(argv[i]);
    if (!arg) continue;

    if (arg === '--json') {
      out.json = true;
      continue;
    }

    if (arg === '--record-path' && i + 1 < argv.length) {
      out.recordPath = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--record-path=')) {
      out.recordPath = normalizeString(arg.slice('--record-path='.length));
      continue;
    }
  }

  return out;
}

export function evaluateOwnerOpenSignalState(input = {}) {
  const recordPath = normalizeString(input.recordPath || DEFAULT_RECORD_PATH) || DEFAULT_RECORD_PATH;
  const doc = readJsonObject(recordPath);

  const schemaVersionOk = Number(doc?.schemaVersion) === 1;
  const carrierOk = normalizeString(doc?.carrierId) === 'OWNER_OPEN_SIGNAL_RECORD_V1_JSON';
  const ownerIdOk = normalizeString(doc?.ownerId).length > 0;
  const signalTypeOk = typeof doc?.ownerOpenSignal === 'boolean';

  const ok = Boolean(doc) && schemaVersionOk && carrierOk && ownerIdOk && signalTypeOk;

  return {
    ok,
    [TOKEN_NAME]: ok ? 1 : 0,
    failReason: ok ? '' : FAIL_CODE,
    failSignalCode: ok ? '' : FAIL_CODE,
    details: {
      recordPath,
      schemaVersionOk,
      carrierOk,
      ownerIdOk,
      signalTypeOk,
      ownerOpenSignal: signalTypeOk ? doc.ownerOpenSignal : null,
    },
  };
}

function printHuman(state) {
  console.log(`${TOKEN_NAME}=${state[TOKEN_NAME]}`);
  console.log(`OWNER_OPEN_SIGNAL=${state.details.ownerOpenSignal === true ? 1 : 0}`);
  if (!state.ok) {
    console.log(`FAIL_REASON=${state.failReason}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluateOwnerOpenSignalState(args);

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

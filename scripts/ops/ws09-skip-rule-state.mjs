#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TOKEN_NAME = 'WS09_SKIP_RULE_DETERMINISTIC_OK';
const DEFAULT_REASON_CODES_PATH = 'docs/OPS/STATUS/WS09_SKIP_REASON_CODES_V1.json';
const FAIL_CODE = 'E_STAGE_PROMOTION_INVALID';

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function parseBoolean(value) {
  if (typeof value === 'boolean') return value;
  const normalized = normalizeString(value).toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
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

function readReasonCodes(filePath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const rows = Array.isArray(parsed.reasonCodes) ? parsed.reasonCodes : [];
    return new Set(rows.map((item) => normalizeString(item)).filter(Boolean));
  } catch {
    return new Set();
  }
}

function parseArgs(argv = process.argv.slice(2)) {
  const out = {
    json: false,
    reasonCodesPath: '',
    promotionMode: false,
    stageModeAttestationP0Touch: false,
    hashDelta: false,
    reasonCode: '',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = normalizeString(argv[i]);
    if (!arg) continue;

    if (arg === '--json') {
      out.json = true;
      continue;
    }

    if (arg === '--reason-codes-path' && i + 1 < argv.length) {
      out.reasonCodesPath = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--reason-codes-path=')) {
      out.reasonCodesPath = normalizeString(arg.slice('--reason-codes-path='.length));
      continue;
    }

    if (arg === '--promotion-mode' && i + 1 < argv.length) {
      out.promotionMode = parseBoolean(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--promotion-mode=')) {
      out.promotionMode = parseBoolean(arg.slice('--promotion-mode='.length));
      continue;
    }

    if (arg === '--stage-mode-attestation-p0-touch' && i + 1 < argv.length) {
      out.stageModeAttestationP0Touch = parseBoolean(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--stage-mode-attestation-p0-touch=')) {
      out.stageModeAttestationP0Touch = parseBoolean(arg.slice('--stage-mode-attestation-p0-touch='.length));
      continue;
    }

    if (arg === '--hash-delta' && i + 1 < argv.length) {
      out.hashDelta = parseBoolean(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--hash-delta=')) {
      out.hashDelta = parseBoolean(arg.slice('--hash-delta='.length));
      continue;
    }

    if (arg === '--reason-code' && i + 1 < argv.length) {
      out.reasonCode = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--reason-code=')) {
      out.reasonCode = normalizeString(arg.slice('--reason-code='.length));
      continue;
    }
  }

  return out;
}

export function evaluateWs09SkipRuleState(input = {}) {
  const reasonCodesPath = normalizeString(input.reasonCodesPath || DEFAULT_REASON_CODES_PATH) || DEFAULT_REASON_CODES_PATH;
  const reasonCodes = readReasonCodes(reasonCodesPath);
  const promotionMode = parseBoolean(input.promotionMode);
  const stageModeAttestationP0Touch = parseBoolean(input.stageModeAttestationP0Touch);
  const hashDelta = parseBoolean(input.hashDelta);
  const reasonCode = normalizeString(input.reasonCode);

  const ws09Required = promotionMode || stageModeAttestationP0Touch;
  const reasonCodeValid = reasonCodes.has(reasonCode);
  const skipAllowed = !ws09Required && !hashDelta && reasonCodeValid;
  const ok = ws09Required ? true : skipAllowed;

  return {
    ok,
    [TOKEN_NAME]: ok ? 1 : 0,
    failReason: ok ? '' : FAIL_CODE,
    failSignalCode: ok ? '' : FAIL_CODE,
    details: {
      ws09Required,
      promotionMode,
      stageModeAttestationP0Touch,
      hashDelta,
      reasonCode,
      reasonCodeValid,
      skipAllowed,
      reasonCodesPath,
      reasonCodeRegistrySize: reasonCodes.size,
    },
  };
}

function printHuman(state) {
  console.log(`${TOKEN_NAME}=${state[TOKEN_NAME]}`);
  console.log(`WS09_REQUIRED=${state.details.ws09Required ? 1 : 0}`);
  console.log(`WS09_SKIP_ALLOWED=${state.details.skipAllowed ? 1 : 0}`);
  console.log(`WS09_REASON_CODE_VALID=${state.details.reasonCodeValid ? 1 : 0}`);
  if (!state.ok) {
    console.log(`FAIL_REASON=${state.failReason}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluateWs09SkipRuleState(args);

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

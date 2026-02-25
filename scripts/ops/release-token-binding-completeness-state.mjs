#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TOKEN_NAME = 'RELEASE_TOKEN_BINDING_COMPLETENESS_OK';
const FAIL_SIGNAL_CODE = 'E_TOKEN_CATALOG_INVALID';
const DEFAULT_CATALOG_PATH = 'docs/OPS/TOKENS/TOKEN_CATALOG.json';
const DEFAULT_REQUIRED_SET_PATH = 'docs/OPS/EXECUTION/REQUIRED_TOKEN_SET.json';
const SHA256_HEX_RE = /^[0-9a-f]{64}$/u;

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

function uniqueSortedStrings(values) {
  if (!Array.isArray(values)) return [];
  const unique = new Set();
  for (const value of values) {
    const normalized = normalizeString(value);
    if (!normalized) continue;
    unique.add(normalized);
  }
  return [...unique].sort((a, b) => a.localeCompare(b));
}

function parseArgs(argv = process.argv.slice(2)) {
  const out = {
    json: false,
    catalogPath: '',
    requiredSetPath: '',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = normalizeString(argv[i]);
    if (!arg) continue;
    if (arg === '--json') {
      out.json = true;
      continue;
    }
    if (arg === '--catalog-path' && i + 1 < argv.length) {
      out.catalogPath = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--catalog-path=')) {
      out.catalogPath = normalizeString(arg.slice('--catalog-path='.length));
      continue;
    }
    if (arg === '--required-set-path' && i + 1 < argv.length) {
      out.requiredSetPath = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--required-set-path=')) {
      out.requiredSetPath = normalizeString(arg.slice('--required-set-path='.length));
    }
  }

  return out;
}

function buildMissing(tokenId, field, reason, details = {}) {
  return {
    tokenId,
    field,
    reason,
    ...details,
  };
}

export function evaluateReleaseTokenBindingCompleteness(input = {}) {
  const catalogPath = normalizeString(input.catalogPath || process.env.TOKEN_CATALOG_PATH || DEFAULT_CATALOG_PATH);
  const requiredSetPath = normalizeString(input.requiredSetPath || process.env.REQUIRED_TOKEN_SET_PATH || DEFAULT_REQUIRED_SET_PATH);

  const catalogDoc = readJsonObject(catalogPath);
  const requiredSetDoc = readJsonObject(requiredSetPath);
  const missingRequiredBindingFields = [];

  if (!catalogDoc || !Array.isArray(catalogDoc.tokens)) {
    return {
      ok: false,
      [TOKEN_NAME]: 0,
      failSignalCode: FAIL_SIGNAL_CODE,
      completenessOk: false,
      failReason: 'CATALOG_UNREADABLE',
      catalogPath,
      requiredSetPath,
      releaseRequiredTokens: [],
      missingRequiredBindingFields,
      missingRequiredBindingFieldsCount: 0,
    };
  }

  if (!requiredSetDoc || !isObjectRecord(requiredSetDoc.requiredSets)) {
    return {
      ok: false,
      [TOKEN_NAME]: 0,
      failSignalCode: FAIL_SIGNAL_CODE,
      completenessOk: false,
      failReason: 'REQUIRED_SET_UNREADABLE',
      catalogPath,
      requiredSetPath,
      releaseRequiredTokens: [],
      missingRequiredBindingFields,
      missingRequiredBindingFieldsCount: 0,
    };
  }

  const releaseRequiredTokens = uniqueSortedStrings(requiredSetDoc.requiredSets.release);
  const tokenById = new Map();
  for (const row of catalogDoc.tokens) {
    if (!isObjectRecord(row)) continue;
    const tokenId = normalizeString(row.tokenId);
    if (!tokenId) continue;
    tokenById.set(tokenId, row);
  }

  for (const tokenId of releaseRequiredTokens) {
    const token = tokenById.get(tokenId);
    if (!token) {
      missingRequiredBindingFields.push(buildMissing(tokenId, 'token', 'TOKEN_MISSING'));
      continue;
    }

    const proofHook = normalizeString(token.proofHook);
    const sourceBinding = normalizeString(token.sourceBinding);
    const failSignalCode = normalizeString(token.failSignalCode);

    if (!proofHook) {
      missingRequiredBindingFields.push(buildMissing(tokenId, 'proofHook', 'FIELD_EMPTY'));
    }
    if (!sourceBinding) {
      missingRequiredBindingFields.push(buildMissing(tokenId, 'sourceBinding', 'FIELD_EMPTY'));
    }
    if (!failSignalCode) {
      missingRequiredBindingFields.push(buildMissing(tokenId, 'failSignalCode', 'FIELD_EMPTY'));
    }

    if (!Object.prototype.hasOwnProperty.call(token, 'proofHookClosureSha256')) {
      missingRequiredBindingFields.push(buildMissing(tokenId, 'proofHookClosureSha256', 'FIELD_MISSING'));
    } else {
      const closureValue = token.proofHookClosureSha256;
      if (!(closureValue === null || (typeof closureValue === 'string' && SHA256_HEX_RE.test(closureValue.toLowerCase())))) {
        missingRequiredBindingFields.push(buildMissing(tokenId, 'proofHookClosureSha256', 'FIELD_INVALID', { value: closureValue }));
      }
    }
  }

  missingRequiredBindingFields.sort((a, b) => {
    if (a.tokenId !== b.tokenId) return a.tokenId.localeCompare(b.tokenId);
    if (a.field !== b.field) return a.field.localeCompare(b.field);
    return a.reason.localeCompare(b.reason);
  });

  const completenessOk = missingRequiredBindingFields.length === 0;

  return {
    ok: completenessOk,
    [TOKEN_NAME]: completenessOk ? 1 : 0,
    failSignalCode: completenessOk ? '' : FAIL_SIGNAL_CODE,
    completenessOk,
    failReason: completenessOk ? '' : 'MISSING_REQUIRED_BINDING_FIELDS',
    catalogPath,
    requiredSetPath,
    releaseRequiredTokens,
    releaseRequiredTokensCount: releaseRequiredTokens.length,
    missingRequiredBindingFields,
    missingRequiredBindingFieldsCount: missingRequiredBindingFields.length,
  };
}

function printHuman(state) {
  console.log(`${TOKEN_NAME}=${state[TOKEN_NAME]}`);
  console.log(`RELEASE_TOKEN_BINDING_COMPLETENESS_OK=${state.completenessOk ? 1 : 0}`);
  console.log(`RELEASE_TOKEN_BINDING_CATALOG_PATH=${state.catalogPath}`);
  console.log(`RELEASE_TOKEN_BINDING_REQUIRED_SET_PATH=${state.requiredSetPath}`);
  console.log(`RELEASE_TOKEN_BINDING_REQUIRED_COUNT=${state.releaseRequiredTokensCount}`);
  console.log(`RELEASE_TOKEN_BINDING_MISSING_FIELDS_COUNT=${state.missingRequiredBindingFieldsCount}`);
  if (!state.completenessOk) {
    console.log(`FAIL_REASON=${state.failReason}`);
    console.log(`FAIL_SIGNAL=${state.failSignalCode}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluateReleaseTokenBindingCompleteness({
    catalogPath: args.catalogPath,
    requiredSetPath: args.requiredSetPath,
  });

  if (args.json) {
    process.stdout.write(`${stableStringify(state)}\n`);
  } else {
    printHuman(state);
  }

  process.exit(state.completenessOk ? 0 : 1);
}

const selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === selfPath) {
  main();
}

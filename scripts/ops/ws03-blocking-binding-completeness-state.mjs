#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TOKEN_NAME = 'WS03_BLOCKING_BINDING_COMPLETENESS_OK';
const FAIL_CODE = 'E_BLOCKING_TOKEN_UNBOUND';
const ACTIVE_CANON_EXPECTED = 'v3.13a-final';
const DEFAULT_CANON_STATUS_PATH = 'docs/OPS/STATUS/CANON_STATUS.json';
const DEFAULT_TOKEN_CATALOG_PATH = 'docs/OPS/TOKENS/TOKEN_CATALOG.json';
const DEFAULT_CLAIM_MATRIX_PATH = 'docs/OPS/CLAIMS/CRITICAL_CLAIM_MATRIX.json';
const DEFAULT_FAILSIGNAL_REGISTRY_PATH = 'docs/OPS/FAILSIGNALS/FAILSIGNAL_REGISTRY.json';
const DEFAULT_BINDING_SCHEMA_PATH = 'docs/OPS/STATUS/BINDING_SCHEMA_V1.json';

export const TARGET_BLOCKING_SET = Object.freeze([
  'CORE_SOT_EXECUTABLE_OK',
  'RECOVERY_IO_OK',
  'MIGRATIONS_POLICY_OK',
  'MIGRATIONS_ATOMICITY_OK',
  'NORMALIZATION_XPLAT_OK',
  'E2E_CRITICAL_USER_PATH_OK',
  'HEAD_STRICT_OK',
  'PROOFHOOK_INTEGRITY_OK',
  'CONFIG_HASH_LOCK_OK',
  'TOKEN_SOURCE_CONFLICT_OK',
  'REQUIRED_SET_NO_TARGET_OK',
  'SINGLE_VERIFY_CONTOUR_ENFORCED_OK',
  'VERIFY_ATTESTATION_OK',
  'ATTESTATION_SIGNATURE_OK',
]);

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

function parseArgs(argv) {
  const out = {
    json: false,
    canonStatusPath: '',
    tokenCatalogPath: '',
    claimMatrixPath: '',
    failsignalRegistryPath: '',
    bindingSchemaPath: '',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = String(argv[i] || '').trim();
    if (!arg) continue;
    if (arg === '--json') out.json = true;
    if (arg === '--canon-status-path' && i + 1 < argv.length) {
      out.canonStatusPath = String(argv[i + 1] || '').trim();
      i += 1;
    }
    if (arg === '--token-catalog-path' && i + 1 < argv.length) {
      out.tokenCatalogPath = String(argv[i + 1] || '').trim();
      i += 1;
    }
    if (arg === '--claim-matrix-path' && i + 1 < argv.length) {
      out.claimMatrixPath = String(argv[i + 1] || '').trim();
      i += 1;
    }
    if (arg === '--failsignal-registry-path' && i + 1 < argv.length) {
      out.failsignalRegistryPath = String(argv[i + 1] || '').trim();
      i += 1;
    }
    if (arg === '--binding-schema-path' && i + 1 < argv.length) {
      out.bindingSchemaPath = String(argv[i + 1] || '').trim();
      i += 1;
    }
  }

  return out;
}

function collectBindingMissingFields(record, requiredFields) {
  const missing = [];
  for (const field of requiredFields) {
    if (!Object.prototype.hasOwnProperty.call(record, field)) {
      missing.push(field);
      continue;
    }
    const value = record[field];
    if (value === null || value === undefined || normalizeString(String(value)) === '') {
      missing.push(field);
    }
  }
  return missing;
}

export function evaluateWs03BlockingBindingCompleteness(input = {}) {
  const canonStatusPath = normalizeString(input.canonStatusPath || DEFAULT_CANON_STATUS_PATH);
  const tokenCatalogPath = normalizeString(input.tokenCatalogPath || DEFAULT_TOKEN_CATALOG_PATH);
  const claimMatrixPath = normalizeString(input.claimMatrixPath || DEFAULT_CLAIM_MATRIX_PATH);
  const failsignalRegistryPath = normalizeString(input.failsignalRegistryPath || DEFAULT_FAILSIGNAL_REGISTRY_PATH);
  const bindingSchemaPath = normalizeString(input.bindingSchemaPath || DEFAULT_BINDING_SCHEMA_PATH);

  const canonStatus = readJsonObject(canonStatusPath);
  const tokenCatalog = readJsonObject(tokenCatalogPath);
  const claimMatrix = readJsonObject(claimMatrixPath);
  const failsignalRegistry = readJsonObject(failsignalRegistryPath);
  const bindingSchema = readJsonObject(bindingSchemaPath);

  const issues = [];

  if (!canonStatus || normalizeString(canonStatus.canonVersion).toLowerCase() !== ACTIVE_CANON_EXPECTED) {
    issues.push({
      tokenId: '*',
      code: 'ACTIVE_CANON_LOCK_INVALID',
      details: {
        observed: canonStatus ? normalizeString(canonStatus.canonVersion) : '',
        expected: ACTIVE_CANON_EXPECTED,
      },
    });
  }

  if (!tokenCatalog || !Array.isArray(tokenCatalog.tokens)) {
    issues.push({ tokenId: '*', code: 'TOKEN_CATALOG_UNREADABLE' });
  }
  if (!claimMatrix || !Array.isArray(claimMatrix.claims)) {
    issues.push({ tokenId: '*', code: 'CLAIM_MATRIX_UNREADABLE' });
  }
  if (!failsignalRegistry || !Array.isArray(failsignalRegistry.failSignals)) {
    issues.push({ tokenId: '*', code: 'FAILSIGNAL_REGISTRY_UNREADABLE' });
  }
  if (
    !bindingSchema
    || !Array.isArray(bindingSchema.records)
    || !Array.isArray(bindingSchema.requiredFields)
  ) {
    issues.push({ tokenId: '*', code: 'BINDING_SCHEMA_UNREADABLE' });
  }

  if (issues.length > 0) {
    return {
      ok: false,
      [TOKEN_NAME]: 0,
      failSignalCode: FAIL_CODE,
      failReason: FAIL_CODE,
      canonStatusPath,
      tokenCatalogPath,
      claimMatrixPath,
      failsignalRegistryPath,
      bindingSchemaPath,
      targetBlockingSet: [...TARGET_BLOCKING_SET],
      targetBlockingCount: TARGET_BLOCKING_SET.length,
      targetBlockingCoveredCount: 0,
      requiredBindingFieldsCount: Array.isArray(bindingSchema?.requiredFields) ? bindingSchema.requiredFields.length : 0,
      missingBindingFieldsCount: 0,
      alignmentGapCount: issues.length,
      issues,
    };
  }

  const tokenMap = new Map();
  for (const token of tokenCatalog.tokens) {
    if (!isObjectRecord(token)) continue;
    const tokenId = normalizeString(token.tokenId);
    if (!tokenId) continue;
    tokenMap.set(tokenId, token);
  }

  const claimMap = new Map();
  for (const claim of claimMatrix.claims) {
    if (!isObjectRecord(claim)) continue;
    const tokenId = normalizeString(claim.requiredToken);
    if (!tokenId) continue;
    if (!claimMap.has(tokenId)) claimMap.set(tokenId, claim);
  }

  const failsignalSet = new Set();
  for (const row of failsignalRegistry.failSignals) {
    if (!isObjectRecord(row)) continue;
    const code = normalizeString(row.code);
    if (code) failsignalSet.add(code);
  }

  const bindingMap = new Map();
  for (const row of bindingSchema.records) {
    if (!isObjectRecord(row)) continue;
    const tokenId = normalizeString(row.TOKEN_ID);
    if (!tokenId) continue;
    bindingMap.set(tokenId, row);
  }

  const requiredBindingFields = bindingSchema.requiredFields.map((field) => normalizeString(field)).filter(Boolean);
  const alignmentRows = [];
  let missingBindingFieldsCount = 0;

  for (const tokenId of TARGET_BLOCKING_SET) {
    const token = tokenMap.get(tokenId) || null;
    const claim = claimMap.get(tokenId) || null;
    const binding = bindingMap.get(tokenId) || null;

    const row = {
      tokenId,
      tokenPresent: Boolean(token),
      claimPresent: Boolean(claim),
      bindingPresent: Boolean(binding),
      tokenFailSignal: token ? normalizeString(token.failSignalCode) : '',
      claimFailSignal: claim ? normalizeString(claim.failSignalCode || claim.failSignal) : '',
      bindingFailSignal: binding ? normalizeString(binding.FAILSIGNAL_CODE) : '',
      missingBindingFields: [],
      issues: [],
    };

    if (!row.tokenPresent) row.issues.push('MISSING_TOKEN_CATALOG_ENTRY');
    if (!row.claimPresent) row.issues.push('MISSING_CLAIM_MATRIX_ENTRY');
    if (!row.bindingPresent) row.issues.push('MISSING_BINDING_SCHEMA_ENTRY');

    if (row.tokenPresent && !row.tokenFailSignal) row.issues.push('TOKEN_FAILSIGNAL_MISSING');
    if (row.claimPresent && !row.claimFailSignal) row.issues.push('CLAIM_FAILSIGNAL_MISSING');
    if (row.bindingPresent && !row.bindingFailSignal) row.issues.push('BINDING_FAILSIGNAL_MISSING');

    if (row.tokenPresent && row.claimPresent && row.tokenFailSignal && row.claimFailSignal && row.tokenFailSignal !== row.claimFailSignal) {
      row.issues.push('TOKEN_CLAIM_FAILSIGNAL_MISMATCH');
    }
    if (row.tokenPresent && row.bindingPresent && row.tokenFailSignal && row.bindingFailSignal && row.tokenFailSignal !== row.bindingFailSignal) {
      row.issues.push('TOKEN_BINDING_FAILSIGNAL_MISMATCH');
    }
    if (row.tokenFailSignal && !failsignalSet.has(row.tokenFailSignal)) {
      row.issues.push('FAILSIGNAL_NOT_REGISTERED');
    }

    if (row.bindingPresent) {
      row.missingBindingFields = collectBindingMissingFields(binding, requiredBindingFields);
      missingBindingFieldsCount += row.missingBindingFields.length;
      if (row.missingBindingFields.length > 0) {
        row.issues.push('BINDING_FIELDS_MISSING');
      }
    }

    if (row.issues.length > 0) {
      for (const code of row.issues) {
        issues.push({
          tokenId,
          code,
          details: {
            tokenFailSignal: row.tokenFailSignal,
            claimFailSignal: row.claimFailSignal,
            bindingFailSignal: row.bindingFailSignal,
            missingBindingFields: row.missingBindingFields,
          },
        });
      }
    }

    alignmentRows.push(row);
  }

  const targetBlockingCoveredCount = alignmentRows.filter((row) => row.tokenPresent && row.claimPresent && row.bindingPresent).length;
  const alignmentGapCount = issues.length;
  const ok = alignmentGapCount === 0;

  return {
    ok,
    [TOKEN_NAME]: ok ? 1 : 0,
    failSignalCode: ok ? '' : FAIL_CODE,
    failReason: ok ? '' : FAIL_CODE,
    canonStatusPath,
    tokenCatalogPath,
    claimMatrixPath,
    failsignalRegistryPath,
    bindingSchemaPath,
    targetBlockingSet: [...TARGET_BLOCKING_SET],
    targetBlockingCount: TARGET_BLOCKING_SET.length,
    targetBlockingCoveredCount,
    requiredBindingFieldsCount: requiredBindingFields.length,
    missingBindingFieldsCount,
    alignmentGapCount,
    alignmentRows,
    issues,
  };
}

function printHuman(state) {
  console.log(`${TOKEN_NAME}=${state[TOKEN_NAME]}`);
  console.log(`WS03_TARGET_BLOCKING_COUNT=${state.targetBlockingCount}`);
  console.log(`WS03_TARGET_BLOCKING_COVERED_COUNT=${state.targetBlockingCoveredCount}`);
  console.log(`WS03_BINDING_MISSING_FIELDS_COUNT=${state.missingBindingFieldsCount}`);
  console.log(`WS03_ALIGNMENT_GAP_COUNT=${state.alignmentGapCount}`);
  console.log(`WS03_FAIL_SIGNAL_CODE=${state.failSignalCode}`);
  if (!state.ok) {
    console.log(`FAIL_REASON=${state.failReason}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluateWs03BlockingBindingCompleteness({
    canonStatusPath: args.canonStatusPath || undefined,
    tokenCatalogPath: args.tokenCatalogPath || undefined,
    claimMatrixPath: args.claimMatrixPath || undefined,
    failsignalRegistryPath: args.failsignalRegistryPath || undefined,
    bindingSchemaPath: args.bindingSchemaPath || undefined,
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


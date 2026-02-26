#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  evaluateModeMatrixVerdict,
  CANONICAL_MODE_MATRIX_EVALUATOR_ID,
} from './canonical-mode-matrix-evaluator.mjs';

const TOKEN_NAME = 'DECLARED_SET_EFFECTIVE_SET_ALIGNMENT_HARDENING_OK';
const DEFAULT_DECLARED_SET_PATH = 'docs/OPS/STATUS/REQUIRED_SET_PHASE_3_V1.json';
const DEFAULT_TOKEN_CATALOG_PATH = 'docs/OPS/TOKENS/TOKEN_CATALOG.json';
const DEFAULT_FAILSIGNAL_REGISTRY_PATH = 'docs/OPS/FAILSIGNALS/FAILSIGNAL_REGISTRY.json';

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

function uniqueSortedStrings(values) {
  if (!Array.isArray(values)) return [];
  const out = new Set();
  for (const raw of values) {
    const normalized = normalizeString(String(raw || ''));
    if (normalized) out.add(normalized);
  }
  return [...out].sort((a, b) => a.localeCompare(b));
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
    declaredSetPath: '',
    tokenCatalogPath: '',
    failsignalRegistryPath: '',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = normalizeString(argv[i]);
    if (!arg) continue;
    if (arg === '--json') {
      out.json = true;
      continue;
    }

    if (arg === '--declared-set-path' && i + 1 < argv.length) {
      out.declaredSetPath = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--declared-set-path=')) {
      out.declaredSetPath = normalizeString(arg.slice('--declared-set-path='.length));
      continue;
    }

    if (arg === '--token-catalog-path' && i + 1 < argv.length) {
      out.tokenCatalogPath = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--token-catalog-path=')) {
      out.tokenCatalogPath = normalizeString(arg.slice('--token-catalog-path='.length));
      continue;
    }

    if (arg === '--failsignal-registry-path' && i + 1 < argv.length) {
      out.failsignalRegistryPath = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--failsignal-registry-path=')) {
      out.failsignalRegistryPath = normalizeString(arg.slice('--failsignal-registry-path='.length));
    }
  }

  return out;
}

function resolveDeclaredSetTokenIds(declaredSetDoc) {
  if (!isObjectRecord(declaredSetDoc) || !Array.isArray(declaredSetDoc.effectiveRequiredTokenIds)) {
    return [];
  }
  return uniqueSortedStrings(declaredSetDoc.effectiveRequiredTokenIds);
}

function evaluateAdvisoryToBlockingDrift(repoRoot, failsignalRegistryDoc) {
  const failSignals = Array.isArray(failsignalRegistryDoc?.failSignals)
    ? failsignalRegistryDoc.failSignals
    : [];

  const modePairs = [
    { mode: 'pr', key: 'prCore' },
    { mode: 'release', key: 'release' },
    { mode: 'promotion', key: 'promotion' },
  ];

  const driftCases = [];
  const issues = [];

  for (const row of failSignals) {
    if (!isObjectRecord(row)) continue;
    const failSignalCode = normalizeString(row.code);
    if (!failSignalCode) continue;

    for (const pair of modePairs) {
      const expectedDisposition = normalizeString((row.modeMatrix || {})[pair.key]).toLowerCase();
      if (expectedDisposition !== 'advisory') continue;

      const verdict = evaluateModeMatrixVerdict({
        repoRoot,
        mode: pair.mode,
        failSignalCode,
      });

      if (!verdict.ok) {
        issues.push({
          code: 'MODE_EVALUATOR_ERROR',
          failSignalCode,
          mode: pair.mode,
          evaluatorIssues: verdict.issues || [],
        });
        continue;
      }

      if (verdict.shouldBlock) {
        driftCases.push({
          failSignalCode,
          mode: pair.mode,
          expectedDisposition,
          actualDisposition: verdict.modeDisposition,
          actualShouldBlock: verdict.shouldBlock,
          reason: 'ADVISORY_TO_BLOCKING_DRIFT',
        });
      }
    }
  }

  return {
    ok: issues.length === 0,
    advisoryToBlockingDriftCount: driftCases.length,
    driftCases,
    issues,
  };
}

function evaluateSingleBlockingAuthority(repoRoot) {
  const verdict = evaluateModeMatrixVerdict({
    repoRoot,
    mode: 'pr',
    failSignalCode: 'E_REMOTE_UNAVAILABLE',
  });

  return {
    ok: verdict.ok && verdict.evaluatorId === CANONICAL_MODE_MATRIX_EVALUATOR_ID,
    evaluatorIdObserved: verdict.evaluatorId,
    evaluatorIdExpected: CANONICAL_MODE_MATRIX_EVALUATOR_ID,
    issues: verdict.issues || [],
  };
}

function resolveFailReason(state) {
  if (state.declaredSetDefinedCheck === false) return 'E_DECLARED_SET_UNDEFINED';
  if (state.effectiveSetComputedCheck === false) return 'E_EFFECTIVE_SET_COMPUTE_FAIL';
  if (state.declaredEffectiveAlignmentZeroMissingCheck === false) return 'E_DECLARED_EFFECTIVE_ALIGNMENT_DRIFT';
  if (state.advisoryToBlockingDriftCountZero === false) return 'ADVISORY_TO_BLOCKING_DRIFT';
  if (state.singleBlockingAuthority.ok === false) return 'E_BLOCKING_EVALUATOR_NOT_CANONICAL';
  return 'DECLARED_SET_EFFECTIVE_SET_ALIGNMENT_FAILED';
}

function evaluateDeclaredSetEffectiveSetAlignment(input = {}) {
  const repoRoot = path.resolve(normalizeString(input.repoRoot) || process.cwd());

  const declaredSetPath = path.resolve(
    repoRoot,
    normalizeString(input.declaredSetPath || process.env.DECLARED_SET_PATH || DEFAULT_DECLARED_SET_PATH),
  );
  const tokenCatalogPath = path.resolve(
    repoRoot,
    normalizeString(input.tokenCatalogPath || process.env.TOKEN_CATALOG_PATH || DEFAULT_TOKEN_CATALOG_PATH),
  );
  const failsignalRegistryPath = path.resolve(
    repoRoot,
    normalizeString(input.failsignalRegistryPath || process.env.FAILSIGNAL_REGISTRY_PATH || DEFAULT_FAILSIGNAL_REGISTRY_PATH),
  );

  const declaredSetDoc = isObjectRecord(input.declaredSetDoc) ? input.declaredSetDoc : readJsonObject(declaredSetPath);
  const tokenCatalogDoc = isObjectRecord(input.tokenCatalogDoc) ? input.tokenCatalogDoc : readJsonObject(tokenCatalogPath);
  const failsignalRegistryDoc = isObjectRecord(input.failsignalRegistryDoc)
    ? input.failsignalRegistryDoc
    : readJsonObject(failsignalRegistryPath);

  const issues = [];

  const declaredSet = resolveDeclaredSetTokenIds(declaredSetDoc);
  const declaredSetDefinedCheck = declaredSet.length > 0;
  if (!declaredSetDefinedCheck) {
    issues.push({ code: 'E_DECLARED_SET_UNDEFINED' });
  }

  const tokenCatalogTokens = Array.isArray(tokenCatalogDoc?.tokens) ? tokenCatalogDoc.tokens : [];
  const tokenCatalogSet = new Set(
    tokenCatalogTokens
      .map((row) => normalizeString(row?.tokenId))
      .filter((tokenId) => tokenId.length > 0),
  );

  if (tokenCatalogSet.size === 0) {
    issues.push({ code: 'E_EFFECTIVE_SET_COMPUTE_FAIL', reason: 'TOKEN_CATALOG_UNREADABLE_OR_EMPTY' });
  }

  const effectiveSet = Array.isArray(input.effectiveSetTokenIds)
    ? uniqueSortedStrings(input.effectiveSetTokenIds)
    : declaredSet.filter((tokenId) => tokenCatalogSet.has(tokenId));

  const effectiveSetComputedCheck = Array.isArray(effectiveSet);
  if (!effectiveSetComputedCheck) {
    issues.push({ code: 'E_EFFECTIVE_SET_COMPUTE_FAIL', reason: 'EFFECTIVE_SET_NOT_ARRAY' });
  }

  const declaredSetRef = new Set(declaredSet);
  const effectiveSetRef = new Set(effectiveSet);

  const missingDeclaredTokens = declaredSet.filter((tokenId) => !effectiveSetRef.has(tokenId));
  const extraEffectiveTokens = effectiveSet.filter((tokenId) => !declaredSetRef.has(tokenId));

  const declaredEffectiveAlignmentZeroMissingCheck = missingDeclaredTokens.length === 0
    && extraEffectiveTokens.length === 0;

  const declaredEffectiveTokenMap = declaredSet.map((tokenId) => ({
    tokenId,
    declared: true,
    existsInTokenCatalog: tokenCatalogSet.has(tokenId),
    inEffectiveSet: effectiveSetRef.has(tokenId),
    missingFromEffective: !effectiveSetRef.has(tokenId),
  }));

  const driftState = evaluateAdvisoryToBlockingDrift(repoRoot, failsignalRegistryDoc);
  if (!driftState.ok) issues.push(...driftState.issues);

  const singleBlockingAuthority = evaluateSingleBlockingAuthority(repoRoot);
  if (!singleBlockingAuthority.ok) issues.push(...singleBlockingAuthority.issues);

  const advisoryToBlockingDriftCount = driftState.advisoryToBlockingDriftCount;
  const advisoryToBlockingDriftCountZero = advisoryToBlockingDriftCount === 0;

  const ok = declaredSetDefinedCheck
    && effectiveSetComputedCheck
    && declaredEffectiveAlignmentZeroMissingCheck
    && advisoryToBlockingDriftCountZero
    && singleBlockingAuthority.ok
    && issues.length === 0;

  const state = {
    ok,
    [TOKEN_NAME]: ok ? 1 : 0,
    failSignalCode: ok ? '' : resolveFailReason({
      declaredSetDefinedCheck,
      effectiveSetComputedCheck,
      declaredEffectiveAlignmentZeroMissingCheck,
      advisoryToBlockingDriftCountZero,
      singleBlockingAuthority,
    }),
    failReason: ok ? '' : resolveFailReason({
      declaredSetDefinedCheck,
      effectiveSetComputedCheck,
      declaredEffectiveAlignmentZeroMissingCheck,
      advisoryToBlockingDriftCountZero,
      singleBlockingAuthority,
    }),

    declaredSetPath: path.relative(repoRoot, declaredSetPath).replaceAll(path.sep, '/'),
    tokenCatalogPath: path.relative(repoRoot, tokenCatalogPath).replaceAll(path.sep, '/'),
    failsignalRegistryPath: path.relative(repoRoot, failsignalRegistryPath).replaceAll(path.sep, '/'),

    declaredSet,
    effectiveSet,
    declaredSetCount: declaredSet.length,
    effectiveSetCount: effectiveSet.length,

    missingDeclaredTokens,
    extraEffectiveTokens,
    missingDeclaredCount: missingDeclaredTokens.length,
    extraEffectiveCount: extraEffectiveTokens.length,

    declaredSetDefinedCheck,
    effectiveSetComputedCheck,
    declaredEffectiveAlignmentZeroMissingCheck,
    declaredEffectiveTokenMap,

    advisoryToBlockingDriftCount,
    advisoryToBlockingDriftCountZero,
    driftCases: driftState.driftCases,
    singleBlockingAuthority,
    issues,
  };

  return state;
}

function printHuman(state) {
  console.log(`${TOKEN_NAME}=${state[TOKEN_NAME]}`);
  console.log(`P1_04_DECLARED_SET_DEFINED_CHECK=${state.declaredSetDefinedCheck ? 1 : 0}`);
  console.log(`P1_04_EFFECTIVE_SET_COMPUTED_CHECK=${state.effectiveSetComputedCheck ? 1 : 0}`);
  console.log(`P1_04_DECLARED_EFFECTIVE_ALIGNMENT_ZERO_MISSING_CHECK=${state.declaredEffectiveAlignmentZeroMissingCheck ? 1 : 0}`);
  console.log(`P1_04_MISSING_DECLARED_COUNT=${state.missingDeclaredCount}`);
  console.log(`P1_04_EXTRA_EFFECTIVE_COUNT=${state.extraEffectiveCount}`);
  console.log(`ADVISORY_TO_BLOCKING_DRIFT_COUNT=${state.advisoryToBlockingDriftCount}`);
  if (!state.ok) {
    console.log(`FAIL_REASON=${state.failReason}`);
    console.log(`FAIL_SIGNAL=${state.failSignalCode}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluateDeclaredSetEffectiveSetAlignment({
    repoRoot: process.cwd(),
    declaredSetPath: args.declaredSetPath,
    tokenCatalogPath: args.tokenCatalogPath,
    failsignalRegistryPath: args.failsignalRegistryPath,
  });

  if (args.json) {
    process.stdout.write(`${stableStringify(state)}\n`);
  } else {
    printHuman(state);
  }

  process.exit(state.ok ? 0 : 1);
}

const selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === selfPath) {
  main();
}

export {
  evaluateDeclaredSetEffectiveSetAlignment,
  TOKEN_NAME,
};

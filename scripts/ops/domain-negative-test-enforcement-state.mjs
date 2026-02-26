#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  evaluateModeMatrixVerdict,
  CANONICAL_MODE_MATRIX_EVALUATOR_ID,
} from './canonical-mode-matrix-evaluator.mjs';

const TOKEN_NAME = 'DOMAIN_NEGATIVE_TEST_ENFORCEMENT_OK';
const DEFAULT_FAILSIGNAL_REGISTRY_PATH = 'docs/OPS/FAILSIGNALS/FAILSIGNAL_REGISTRY.json';
const DEFAULT_TOKEN_CATALOG_PATH = 'docs/OPS/TOKENS/TOKEN_CATALOG.json';
const DEFAULT_REQUIRED_SET_PHASE_3_PATH = 'docs/OPS/STATUS/REQUIRED_SET_PHASE_3_V1.json';

const GENERIC_SCHEMA_NEGATIVE_TEST_REF = 'test/contracts/failsignal-registry.contract.test.js#schema-invalid';
const NEGATIVE_CONTRACT_REF_RE = /^test\/contracts\/[a-z0-9._-]+\.contract\.test\.js#[a-z0-9._-]+$/u;

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

function parseNegativeRef(ref) {
  const normalized = normalizeString(ref);
  const index = normalized.indexOf('#');
  if (index <= 0) {
    return {
      path: normalized,
      testId: '',
    };
  }
  return {
    path: normalized.slice(0, index),
    testId: normalized.slice(index + 1),
  };
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
    failsignalRegistryPath: '',
    tokenCatalogPath: '',
    requiredSetPath: '',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = normalizeString(argv[i]);
    if (!arg) continue;
    if (arg === '--json') {
      out.json = true;
      continue;
    }

    if (arg === '--failsignal-registry-path' && i + 1 < argv.length) {
      out.failsignalRegistryPath = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--failsignal-registry-path=')) {
      out.failsignalRegistryPath = normalizeString(arg.slice('--failsignal-registry-path='.length));
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

function resolveRequiredSetTokenIds(requiredSetDoc) {
  if (!isObjectRecord(requiredSetDoc) || !Array.isArray(requiredSetDoc.effectiveRequiredTokenIds)) {
    return [];
  }
  const dedup = new Set();
  for (const tokenId of requiredSetDoc.effectiveRequiredTokenIds) {
    const normalized = normalizeString(tokenId);
    if (normalized) dedup.add(normalized);
  }
  return [...dedup].sort((a, b) => a.localeCompare(b));
}

function isDomainFailSignal(row) {
  const code = normalizeString(row.code);
  const sourceBinding = normalizeString(row.sourceBinding);
  if (!code) return false;
  if (code.startsWith('E_FAILSIGNAL_')) return false;
  if (sourceBinding === 'reconcile_p0_02') return false;
  return true;
}

function evaluateDomainFailSignalMapping(repoRoot, failsignalRegistryDoc) {
  const domainFailSignals = [];
  const mappingIssues = [];
  const genericSchemaRejectionCases = [];

  const failSignals = Array.isArray(failsignalRegistryDoc?.failSignals)
    ? failsignalRegistryDoc.failSignals
    : [];

  for (const row of failSignals) {
    if (!isObjectRecord(row) || !isDomainFailSignal(row)) continue;

    const code = normalizeString(row.code);
    const negativeTestRef = normalizeString(row.negativeTestRef);
    const parsedRef = parseNegativeRef(negativeTestRef);
    const issues = [];

    if (!negativeTestRef) {
      issues.push({ code: 'NEGATIVE_TEST_REF_MISSING' });
    } else {
      if (!NEGATIVE_CONTRACT_REF_RE.test(negativeTestRef)) {
        issues.push({ code: 'NEGATIVE_TEST_REF_INVALID_FORMAT', negativeTestRef });
      }

      if (negativeTestRef === GENERIC_SCHEMA_NEGATIVE_TEST_REF) {
        const issue = { code: 'GENERIC_SCHEMA_NEGATIVE_REF_FORBIDDEN', negativeTestRef };
        issues.push(issue);
        genericSchemaRejectionCases.push({ failSignalCode: code, ...issue });
      }

      if (parsedRef.path) {
        const testAbsPath = path.resolve(repoRoot, parsedRef.path);
        if (!fs.existsSync(testAbsPath)) {
          issues.push({ code: 'NEGATIVE_TEST_FILE_MISSING', negativeTestRef, filePath: parsedRef.path });
        }
      }
    }

    const mapped = issues.length === 0;
    domainFailSignals.push({
      code,
      negativeTestRef,
      mapped,
      issues,
    });

    for (const issue of issues) {
      mappingIssues.push({ failSignalCode: code, ...issue });
    }
  }

  domainFailSignals.sort((a, b) => a.code.localeCompare(b.code));
  mappingIssues.sort((a, b) => {
    if (a.failSignalCode !== b.failSignalCode) return a.failSignalCode.localeCompare(b.failSignalCode);
    return String(a.code || '').localeCompare(String(b.code || ''));
  });
  genericSchemaRejectionCases.sort((a, b) => a.failSignalCode.localeCompare(b.failSignalCode));

  const domainFailSignalsCount = domainFailSignals.length;
  const mappedDomainFailSignalsCount = domainFailSignals.filter((entry) => entry.mapped).length;
  const domainMappingCoveragePct = domainFailSignalsCount === 0
    ? 0
    : Number(((mappedDomainFailSignalsCount / domainFailSignalsCount) * 100).toFixed(2));

  return {
    domainFailSignals,
    mappingIssues,
    genericSchemaRejectionCases,
    domainFailSignalsCount,
    mappedDomainFailSignalsCount,
    domainMappingCoveragePct,
    domainMappingCoverageOk: domainFailSignalsCount > 0 && mappedDomainFailSignalsCount === domainFailSignalsCount,
    genericSchemaRejectionOk: genericSchemaRejectionCases.length === 0,
    consistencyOk: mappedDomainFailSignalsCount === domainFailSignalsCount,
  };
}

function isDomainCriticalToken(row) {
  const gateTier = normalizeString(row.gateTier).toLowerCase();
  const positiveContractRef = normalizeString(row.positiveContractRef);
  const failSignalCode = normalizeString(row.failSignalCode);
  return gateTier === 'release' && positiveContractRef.length > 0 && failSignalCode.length > 0;
}

function evaluateTokenNegativeMap({ repoRoot, tokenCatalogDoc, requiredSetTokenIds }) {
  const tokens = Array.isArray(tokenCatalogDoc?.tokens) ? tokenCatalogDoc.tokens : [];
  const domainTokenMap = [];

  for (const row of tokens) {
    if (!isObjectRecord(row) || !isDomainCriticalToken(row)) continue;

    const tokenId = normalizeString(row.tokenId);
    if (!tokenId) continue;

    const failSignalCode = normalizeString(row.failSignalCode);
    const positiveContractRef = normalizeString(row.positiveContractRef);
    const negativeContractRef = normalizeString(row.negativeContractRef);
    const parsedRef = parseNegativeRef(negativeContractRef);
    const issues = [];

    if (!negativeContractRef) {
      issues.push({ code: 'E_DOMAIN_NEGATIVE_MISSING' });
    } else {
      if (!NEGATIVE_CONTRACT_REF_RE.test(negativeContractRef)) {
        issues.push({ code: 'E_DOMAIN_NEGATIVE_INVALID_FORMAT', negativeContractRef });
      }
      if (negativeContractRef === GENERIC_SCHEMA_NEGATIVE_TEST_REF) {
        issues.push({ code: 'E_GENERIC_NEGATIVE_REUSE_FORBIDDEN', negativeContractRef });
      }
      if (parsedRef.path) {
        const testAbsPath = path.resolve(repoRoot, parsedRef.path);
        if (!fs.existsSync(testAbsPath)) {
          issues.push({ code: 'E_DOMAIN_NEGATIVE_TEST_FILE_MISSING', negativeContractRef, filePath: parsedRef.path });
        }
      }
    }

    const hasDomainNegative = issues.length === 0;
    const usesGenericSchemaNegative = negativeContractRef === GENERIC_SCHEMA_NEGATIVE_TEST_REF;

    domainTokenMap.push({
      tokenId,
      failSignalCode,
      positiveContractRef,
      negativeContractRef,
      negativeContractPath: parsedRef.path,
      negativeContractTestId: parsedRef.testId,
      isReleaseRequired: requiredSetTokenIds.includes(tokenId),
      hasDomainNegative,
      usesGenericSchemaNegative,
      issues,
    });
  }

  domainTokenMap.sort((a, b) => a.tokenId.localeCompare(b.tokenId));

  const domainCriticalTokenCount = domainTokenMap.length;
  const mappedDomainCriticalTokenCount = domainTokenMap.filter((entry) => entry.hasDomainNegative).length;
  const domainNegativeCoveragePct = domainCriticalTokenCount === 0
    ? 0
    : Number(((mappedDomainCriticalTokenCount / domainCriticalTokenCount) * 100).toFixed(2));

  const genericNegativeReuseViolations = domainTokenMap
    .filter((entry) => entry.usesGenericSchemaNegative)
    .map((entry) => ({
      tokenId: entry.tokenId,
      failSignalCode: entry.failSignalCode,
      negativeContractRef: entry.negativeContractRef,
      reason: 'E_GENERIC_NEGATIVE_REUSE_FORBIDDEN',
    }));

  const releaseRequiredDomainTokens = domainTokenMap.filter((entry) => entry.isReleaseRequired);
  const releaseRequiredDomainNegativeMissing = releaseRequiredDomainTokens
    .filter((entry) => entry.hasDomainNegative === false)
    .map((entry) => ({
      tokenId: entry.tokenId,
      failSignalCode: entry.failSignalCode,
      negativeContractRef: entry.negativeContractRef,
      issues: entry.issues,
    }));

  return {
    domainTokenMap,
    domainCriticalTokenCount,
    mappedDomainCriticalTokenCount,
    domainNegativeCoveragePct,
    domainCriticalTokensHaveDomainNegativeCheck: domainCriticalTokenCount > 0
      && mappedDomainCriticalTokenCount === domainCriticalTokenCount,
    genericNegativeReuseViolations,
    genericSchemaNegativeReuseForbiddenCheck: genericNegativeReuseViolations.length === 0,
    domainNegativeCoverageCompletenessCheck: domainCriticalTokenCount > 0
      && mappedDomainCriticalTokenCount === domainCriticalTokenCount,
    releaseRequiredDomainTokens,
    releaseRequiredDomainNegativeMissing,
    releaseRequiredDomainNegativeMissingCheck: releaseRequiredDomainNegativeMissing.length === 0,
  };
}

function evaluateAdvisoryToBlockingDrift(repoRoot, failsignalRegistryDoc) {
  const modePairs = [
    { mode: 'pr', key: 'prCore' },
    { mode: 'release', key: 'release' },
    { mode: 'promotion', key: 'promotion' },
  ];

  const driftCases = [];
  const issues = [];
  const failSignals = Array.isArray(failsignalRegistryDoc?.failSignals)
    ? failsignalRegistryDoc.failSignals
    : [];

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
  if (state.genericSchemaNegativeReuseForbiddenCheck === false) return 'E_GENERIC_NEGATIVE_REUSE_FORBIDDEN';
  if (state.domainCriticalTokensHaveDomainNegativeCheck === false) return 'E_DOMAIN_NEGATIVE_MISSING';
  if (state.domainNegativeCoverageCompletenessCheck === false) return 'E_DOMAIN_NEGATIVE_COVERAGE_INCOMPLETE';
  if (state.releaseRequiredDomainNegativeMissingCheck === false) return 'E_DOMAIN_NEGATIVE_MISSING';
  if (state.advisoryToBlockingDriftCountZero === false) return 'ADVISORY_TO_BLOCKING_DRIFT';
  if (state.singleBlockingAuthority.ok === false) return 'E_BLOCKING_EVALUATOR_NOT_CANONICAL';
  if (state.legacyDomainFailSignalConsistencyOk === false) return 'E_FAILSIGNAL_NEGATIVE_TEST_MISSING';
  return 'DOMAIN_NEGATIVE_TEST_ENFORCEMENT_FAILED';
}

function normalizeEffectiveRequiredTokenIds(inputValue, fallbackTokenIds) {
  if (Array.isArray(inputValue)) {
    const dedup = new Set();
    for (const tokenId of inputValue) {
      const normalized = normalizeString(tokenId);
      if (normalized) dedup.add(normalized);
    }
    return [...dedup].sort((a, b) => a.localeCompare(b));
  }
  return [...fallbackTokenIds];
}

function evaluateDomainNegativeTestEnforcement(input = {}) {
  const repoRoot = path.resolve(normalizeString(input.repoRoot) || process.cwd());

  const failsignalRegistryPath = path.resolve(
    repoRoot,
    normalizeString(input.failsignalRegistryPath || process.env.FAILSIGNAL_REGISTRY_PATH || DEFAULT_FAILSIGNAL_REGISTRY_PATH),
  );

  const tokenCatalogPath = path.resolve(
    repoRoot,
    normalizeString(input.tokenCatalogPath || process.env.TOKEN_CATALOG_PATH || DEFAULT_TOKEN_CATALOG_PATH),
  );

  const requiredSetPath = path.resolve(
    repoRoot,
    normalizeString(input.requiredSetPath || process.env.REQUIRED_SET_PHASE_3_PATH || DEFAULT_REQUIRED_SET_PHASE_3_PATH),
  );

  const failsignalRegistryDoc = isObjectRecord(input.failsignalRegistryDoc)
    ? input.failsignalRegistryDoc
    : readJsonObject(failsignalRegistryPath);

  const tokenCatalogDoc = isObjectRecord(input.tokenCatalogDoc)
    ? input.tokenCatalogDoc
    : readJsonObject(tokenCatalogPath);

  const requiredSetDoc = isObjectRecord(input.requiredSetDoc)
    ? input.requiredSetDoc
    : readJsonObject(requiredSetPath);

  const fallbackRequiredTokenIds = resolveRequiredSetTokenIds(requiredSetDoc);
  const effectiveRequiredTokenIds = normalizeEffectiveRequiredTokenIds(
    input.effectiveRequiredTokenIds,
    fallbackRequiredTokenIds,
  );

  const failsignalState = evaluateDomainFailSignalMapping(repoRoot, failsignalRegistryDoc);

  const tokenMapState = evaluateTokenNegativeMap({
    repoRoot,
    tokenCatalogDoc,
    requiredSetTokenIds: effectiveRequiredTokenIds,
  });

  const driftState = evaluateAdvisoryToBlockingDrift(repoRoot, failsignalRegistryDoc);
  const singleBlockingAuthority = evaluateSingleBlockingAuthority(repoRoot);
  const advisoryToBlockingDriftCount = driftState.advisoryToBlockingDriftCount;
  const advisoryToBlockingDriftCountZero = advisoryToBlockingDriftCount === 0;

  const issues = [
    ...driftState.issues,
    ...singleBlockingAuthority.issues,
  ];

  const legacyDomainFailSignalConsistencyOk = failsignalState.domainMappingCoverageOk
    && failsignalState.genericSchemaRejectionOk
    && failsignalState.consistencyOk;

  const ok = tokenMapState.domainCriticalTokensHaveDomainNegativeCheck
    && tokenMapState.genericSchemaNegativeReuseForbiddenCheck
    && tokenMapState.domainNegativeCoverageCompletenessCheck
    && tokenMapState.releaseRequiredDomainNegativeMissingCheck
    && advisoryToBlockingDriftCountZero
    && singleBlockingAuthority.ok
    && legacyDomainFailSignalConsistencyOk
    && issues.length === 0;

  const state = {
    ok,
    [TOKEN_NAME]: ok ? 1 : 0,
    failSignalCode: ok ? '' : resolveFailReason({
      ...tokenMapState,
      advisoryToBlockingDriftCountZero,
      singleBlockingAuthority,
      legacyDomainFailSignalConsistencyOk,
    }),
    failReason: ok ? '' : resolveFailReason({
      ...tokenMapState,
      advisoryToBlockingDriftCountZero,
      singleBlockingAuthority,
      legacyDomainFailSignalConsistencyOk,
    }),
    failsignalRegistryPath: path.relative(repoRoot, failsignalRegistryPath).replaceAll(path.sep, '/'),
    tokenCatalogPath: path.relative(repoRoot, tokenCatalogPath).replaceAll(path.sep, '/'),
    requiredSetPath: path.relative(repoRoot, requiredSetPath).replaceAll(path.sep, '/'),
    effectiveRequiredTokenIds,

    domainCriticalTokenCount: tokenMapState.domainCriticalTokenCount,
    mappedDomainCriticalTokenCount: tokenMapState.mappedDomainCriticalTokenCount,
    domainNegativeCoveragePct: tokenMapState.domainNegativeCoveragePct,
    domainCriticalTokensHaveDomainNegativeCheck: tokenMapState.domainCriticalTokensHaveDomainNegativeCheck,
    genericSchemaNegativeReuseForbiddenCheck: tokenMapState.genericSchemaNegativeReuseForbiddenCheck,
    domainNegativeCoverageCompletenessCheck: tokenMapState.domainNegativeCoverageCompletenessCheck,
    releaseRequiredDomainNegativeMissingCount: tokenMapState.releaseRequiredDomainNegativeMissing.length,
    releaseRequiredDomainNegativeMissingCheck: tokenMapState.releaseRequiredDomainNegativeMissingCheck,

    domainTokenMap: tokenMapState.domainTokenMap,
    genericNegativeReuseViolations: tokenMapState.genericNegativeReuseViolations,
    releaseRequiredDomainTokens: tokenMapState.releaseRequiredDomainTokens,
    releaseRequiredDomainNegativeMissing: tokenMapState.releaseRequiredDomainNegativeMissing,

    advisoryToBlockingDriftCount,
    advisoryToBlockingDriftCountZero,
    driftCases: driftState.driftCases,
    singleBlockingAuthority,

    domainFailSignalsCount: failsignalState.domainFailSignalsCount,
    mappedDomainFailSignalsCount: failsignalState.mappedDomainFailSignalsCount,
    domainMappingCoveragePct: failsignalState.domainMappingCoveragePct,
    domainMappingCoverageOk: failsignalState.domainMappingCoverageOk,
    genericSchemaRejectionOk: failsignalState.genericSchemaRejectionOk,
    consistencyOk: failsignalState.consistencyOk,
    domainFailSignals: failsignalState.domainFailSignals,
    genericSchemaRejectionCases: failsignalState.genericSchemaRejectionCases,
    mappingIssues: failsignalState.mappingIssues,
    legacyDomainFailSignalConsistencyOk,
    issues,
  };

  return state;
}

function printHuman(state) {
  console.log(`${TOKEN_NAME}=${state[TOKEN_NAME]}`);
  console.log(`P1_03_DOMAIN_CRITICAL_TOKEN_COUNT=${state.domainCriticalTokenCount}`);
  console.log(`P1_03_DOMAIN_CRITICAL_TOKEN_MAPPED_COUNT=${state.mappedDomainCriticalTokenCount}`);
  console.log(`P1_03_DOMAIN_NEGATIVE_COVERAGE_PCT=${state.domainNegativeCoveragePct}`);
  console.log(`P1_03_DOMAIN_CRITICAL_TOKENS_HAVE_DOMAIN_NEGATIVE_CHECK=${state.domainCriticalTokensHaveDomainNegativeCheck ? 1 : 0}`);
  console.log(`P1_03_GENERIC_SCHEMA_NEGATIVE_REUSE_FORBIDDEN_CHECK=${state.genericSchemaNegativeReuseForbiddenCheck ? 1 : 0}`);
  console.log(`P1_03_DOMAIN_NEGATIVE_COVERAGE_COMPLETENESS_CHECK=${state.domainNegativeCoverageCompletenessCheck ? 1 : 0}`);
  console.log(`P1_03_RELEASE_REQUIRED_DOMAIN_NEGATIVE_MISSING_CHECK=${state.releaseRequiredDomainNegativeMissingCheck ? 1 : 0}`);
  console.log(`ADVISORY_TO_BLOCKING_DRIFT_COUNT=${state.advisoryToBlockingDriftCount}`);
  if (!state.ok) {
    console.log(`FAIL_REASON=${state.failReason}`);
    console.log(`FAIL_SIGNAL=${state.failSignalCode}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluateDomainNegativeTestEnforcement({
    repoRoot: process.cwd(),
    failsignalRegistryPath: args.failsignalRegistryPath,
    tokenCatalogPath: args.tokenCatalogPath,
    requiredSetPath: args.requiredSetPath,
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
  evaluateDomainNegativeTestEnforcement,
  GENERIC_SCHEMA_NEGATIVE_TEST_REF,
  TOKEN_NAME,
};

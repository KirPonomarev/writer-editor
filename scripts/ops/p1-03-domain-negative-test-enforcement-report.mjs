#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {
  evaluateDomainNegativeTestEnforcement,
  GENERIC_SCHEMA_NEGATIVE_TEST_REF,
} from './domain-negative-test-enforcement-state.mjs';

const DEFAULT_OUTPUT_DIR = 'docs/OPS/EVIDENCE/P1_CONTOUR/TICKET_03';
const DEFAULT_STATUS_PATH = 'docs/OPS/STATUS/DOMAIN_NEGATIVE_TEST_ENFORCEMENT_FULL_v3.json';
const DEFAULT_FAILSIGNAL_REGISTRY_PATH = 'docs/OPS/FAILSIGNALS/FAILSIGNAL_REGISTRY.json';
const DEFAULT_TOKEN_CATALOG_PATH = 'docs/OPS/TOKENS/TOKEN_CATALOG.json';
const DEFAULT_REQUIRED_SET_PATH = 'docs/OPS/STATUS/REQUIRED_SET_PHASE_3_V1.json';

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

function parseArgs(argv = process.argv.slice(2)) {
  const out = {
    outputDir: DEFAULT_OUTPUT_DIR,
    statusPath: DEFAULT_STATUS_PATH,
    failsignalRegistryPath: DEFAULT_FAILSIGNAL_REGISTRY_PATH,
    tokenCatalogPath: DEFAULT_TOKEN_CATALOG_PATH,
    requiredSetPath: DEFAULT_REQUIRED_SET_PATH,
    runId: '',
    ticketId: '',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = normalizeString(argv[i]);
    if (!arg) continue;

    if (arg === '--output-dir' && i + 1 < argv.length) {
      out.outputDir = normalizeString(argv[i + 1]) || DEFAULT_OUTPUT_DIR;
      i += 1;
      continue;
    }
    if (arg.startsWith('--output-dir=')) {
      out.outputDir = normalizeString(arg.slice('--output-dir='.length)) || DEFAULT_OUTPUT_DIR;
      continue;
    }

    if (arg === '--status-path' && i + 1 < argv.length) {
      out.statusPath = normalizeString(argv[i + 1]) || DEFAULT_STATUS_PATH;
      i += 1;
      continue;
    }
    if (arg.startsWith('--status-path=')) {
      out.statusPath = normalizeString(arg.slice('--status-path='.length)) || DEFAULT_STATUS_PATH;
      continue;
    }

    if (arg === '--failsignal-registry-path' && i + 1 < argv.length) {
      out.failsignalRegistryPath = normalizeString(argv[i + 1]) || DEFAULT_FAILSIGNAL_REGISTRY_PATH;
      i += 1;
      continue;
    }
    if (arg.startsWith('--failsignal-registry-path=')) {
      out.failsignalRegistryPath = normalizeString(arg.slice('--failsignal-registry-path='.length)) || DEFAULT_FAILSIGNAL_REGISTRY_PATH;
      continue;
    }

    if (arg === '--token-catalog-path' && i + 1 < argv.length) {
      out.tokenCatalogPath = normalizeString(argv[i + 1]) || DEFAULT_TOKEN_CATALOG_PATH;
      i += 1;
      continue;
    }
    if (arg.startsWith('--token-catalog-path=')) {
      out.tokenCatalogPath = normalizeString(arg.slice('--token-catalog-path='.length)) || DEFAULT_TOKEN_CATALOG_PATH;
      continue;
    }

    if (arg === '--required-set-path' && i + 1 < argv.length) {
      out.requiredSetPath = normalizeString(argv[i + 1]) || DEFAULT_REQUIRED_SET_PATH;
      i += 1;
      continue;
    }
    if (arg.startsWith('--required-set-path=')) {
      out.requiredSetPath = normalizeString(arg.slice('--required-set-path='.length)) || DEFAULT_REQUIRED_SET_PATH;
      continue;
    }

    if (arg === '--run-id' && i + 1 < argv.length) {
      out.runId = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--run-id=')) {
      out.runId = normalizeString(arg.slice('--run-id='.length));
      continue;
    }

    if (arg === '--ticket-id' && i + 1 < argv.length) {
      out.ticketId = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--ticket-id=')) {
      out.ticketId = normalizeString(arg.slice('--ticket-id='.length));
    }
  }

  return out;
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${stableStringify(value)}\n`, 'utf8');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function runBinaryTestB(baselineState, tokenCatalogDoc) {
  const target = baselineState.domainTokenMap[0] || null;
  if (!target) {
    return {
      ok: false,
      failReason: 'NO_DOMAIN_CRITICAL_TOKEN_TARGET',
      targetTokenId: '',
      genericNegativeReuseDetected: false,
      mutatedState: null,
    };
  }

  const mutatedTokenCatalogDoc = deepClone(tokenCatalogDoc);
  const tokens = Array.isArray(mutatedTokenCatalogDoc.tokens) ? mutatedTokenCatalogDoc.tokens : [];
  for (const row of tokens) {
    if (!isObjectRecord(row)) continue;
    if (normalizeString(row.tokenId) === target.tokenId) {
      row.negativeContractRef = GENERIC_SCHEMA_NEGATIVE_TEST_REF;
      break;
    }
  }

  const mutatedState = evaluateDomainNegativeTestEnforcement({
    tokenCatalogDoc: mutatedTokenCatalogDoc,
    effectiveRequiredTokenIds: baselineState.effectiveRequiredTokenIds,
  });

  const genericNegativeReuseDetected = mutatedState.genericNegativeReuseViolations
    .some((entry) => normalizeString(entry.tokenId) === target.tokenId);

  const ok = mutatedState.ok === false
    && mutatedState.genericSchemaNegativeReuseForbiddenCheck === false
    && genericNegativeReuseDetected;

  return {
    ok,
    failReason: ok ? '' : 'E_GENERIC_NEGATIVE_REUSE_FORBIDDEN',
    targetTokenId: target.tokenId,
    genericNegativeReuseDetected,
    mutatedState: {
      ok: mutatedState.ok,
      failReason: mutatedState.failReason,
      genericSchemaNegativeReuseForbiddenCheck: mutatedState.genericSchemaNegativeReuseForbiddenCheck,
      domainCriticalTokensHaveDomainNegativeCheck: mutatedState.domainCriticalTokensHaveDomainNegativeCheck,
      releaseRequiredDomainNegativeMissingCheck: mutatedState.releaseRequiredDomainNegativeMissingCheck,
    },
  };
}

function runBinaryTestC(baselineState, tokenCatalogDoc) {
  const target = baselineState.domainTokenMap[0] || null;
  if (!target) {
    return {
      ok: false,
      failReason: 'NO_DOMAIN_CRITICAL_TOKEN_TARGET',
      targetTokenId: '',
      releaseRequiredMissingDetected: false,
      mutatedState: null,
    };
  }

  const mutatedTokenCatalogDoc = deepClone(tokenCatalogDoc);
  const tokens = Array.isArray(mutatedTokenCatalogDoc.tokens) ? mutatedTokenCatalogDoc.tokens : [];
  for (const row of tokens) {
    if (!isObjectRecord(row)) continue;
    if (normalizeString(row.tokenId) === target.tokenId) {
      row.negativeContractRef = '';
      break;
    }
  }

  const mutatedState = evaluateDomainNegativeTestEnforcement({
    tokenCatalogDoc: mutatedTokenCatalogDoc,
    effectiveRequiredTokenIds: [target.tokenId],
  });

  const releaseRequiredMissingDetected = mutatedState.releaseRequiredDomainNegativeMissing
    .some((entry) => normalizeString(entry.tokenId) === target.tokenId);

  const ok = mutatedState.ok === false
    && mutatedState.releaseRequiredDomainNegativeMissingCheck === false
    && releaseRequiredMissingDetected;

  return {
    ok,
    failReason: ok ? '' : 'E_DOMAIN_NEGATIVE_MISSING',
    targetTokenId: target.tokenId,
    releaseRequiredMissingDetected,
    mutatedState: {
      ok: mutatedState.ok,
      failReason: mutatedState.failReason,
      domainCriticalTokensHaveDomainNegativeCheck: mutatedState.domainCriticalTokensHaveDomainNegativeCheck,
      releaseRequiredDomainNegativeMissingCheck: mutatedState.releaseRequiredDomainNegativeMissingCheck,
      releaseRequiredDomainNegativeMissingCount: mutatedState.releaseRequiredDomainNegativeMissingCount,
    },
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = process.cwd();

  const outputDir = path.resolve(repoRoot, args.outputDir);
  const statusPath = path.resolve(repoRoot, args.statusPath);
  const failsignalRegistryPath = path.resolve(repoRoot, args.failsignalRegistryPath);
  const tokenCatalogPath = path.resolve(repoRoot, args.tokenCatalogPath);
  const requiredSetPath = path.resolve(repoRoot, args.requiredSetPath);

  const tokenCatalogDoc = readJson(tokenCatalogPath);

  const baselineState = evaluateDomainNegativeTestEnforcement({
    repoRoot,
    failsignalRegistryPath,
    tokenCatalogPath,
    requiredSetPath,
  });

  const binaryA = {
    ok: baselineState.domainCriticalTokensHaveDomainNegativeCheck,
    domainCriticalTokenCount: baselineState.domainCriticalTokenCount,
    mappedDomainCriticalTokenCount: baselineState.mappedDomainCriticalTokenCount,
    domainNegativeCoveragePct: baselineState.domainNegativeCoveragePct,
  };

  const binaryB = runBinaryTestB(baselineState, tokenCatalogDoc);
  const binaryC = runBinaryTestC(baselineState, tokenCatalogDoc);

  const gates = {
    p1_03_domain_critical_tokens_have_domain_negative_check: binaryA.ok ? 'PASS' : 'FAIL',
    p1_03_generic_schema_negative_reuse_forbidden_check: binaryB.ok ? 'PASS' : 'FAIL',
    p1_03_domain_negative_coverage_completeness_check: baselineState.domainNegativeCoverageCompletenessCheck ? 'PASS' : 'FAIL',
    p1_03_release_required_domain_negative_missing_fails_check: binaryC.ok ? 'PASS' : 'FAIL',
    mc_advisory_blocking_drift_zero: baselineState.advisoryToBlockingDriftCountZero ? 'PASS' : 'FAIL',
  };

  const status = Object.values(gates).every((row) => row === 'PASS') ? 'PASS' : 'FAIL';
  const generatedAtUtc = new Date().toISOString();

  const summary = {
    status,
    runId: args.runId || process.env.RUN_ID || '',
    ticketId: args.ticketId || process.env.TICKET_ID || '',
    domainCriticalTokenCount: baselineState.domainCriticalTokenCount,
    mappedDomainCriticalTokenCount: baselineState.mappedDomainCriticalTokenCount,
    domainNegativeCoveragePct: baselineState.domainNegativeCoveragePct,
    releaseRequiredDomainNegativeMissingCount: baselineState.releaseRequiredDomainNegativeMissingCount,
    advisoryToBlockingDriftCount: baselineState.advisoryToBlockingDriftCount,
    singleBlockingAuthorityOk: baselineState.singleBlockingAuthority.ok,
    gates,
    generatedAtUtc,
  };

  writeJson(statusPath, {
    version: 3,
    token: 'DOMAIN_NEGATIVE_TEST_ENFORCEMENT_OK',
    evaluatorId: 'CANONICAL_MODE_MATRIX_EVALUATOR_V1',
    domainCriticalTokenCount: baselineState.domainCriticalTokenCount,
    mappedDomainCriticalTokenCount: baselineState.mappedDomainCriticalTokenCount,
    domainNegativeCoveragePct: baselineState.domainNegativeCoveragePct,
    releaseRequiredDomainNegativeMissingCount: baselineState.releaseRequiredDomainNegativeMissingCount,
    genericNegativeReuseViolationCount: baselineState.genericNegativeReuseViolations.length,
    advisoryToBlockingDriftCount: baselineState.advisoryToBlockingDriftCount,
    gates,
    status,
    updatedAtUtc: generatedAtUtc,
  });

  writeJson(path.join(outputDir, 'domain-token-negative-map.json'), {
    domainCriticalTokenCount: baselineState.domainCriticalTokenCount,
    mappedDomainCriticalTokenCount: baselineState.mappedDomainCriticalTokenCount,
    domainNegativeCoveragePct: baselineState.domainNegativeCoveragePct,
    domainCriticalTokensHaveDomainNegativeCheck: baselineState.domainCriticalTokensHaveDomainNegativeCheck,
    releaseRequiredDomainNegativeMissingCount: baselineState.releaseRequiredDomainNegativeMissingCount,
    domainTokenMap: baselineState.domainTokenMap,
  });

  writeJson(path.join(outputDir, 'generic-negative-reuse-violations.json'), {
    genericNegativeReuseViolationCount: baselineState.genericNegativeReuseViolations.length,
    genericNegativeReuseViolations: baselineState.genericNegativeReuseViolations,
    binaryTestB: binaryB,
  });

  writeJson(path.join(outputDir, 'domain-negative-coverage-proof.json'), {
    domainNegativeCoverageCompletenessCheck: baselineState.domainNegativeCoverageCompletenessCheck,
    releaseRequiredDomainNegativeMissingCheck: baselineState.releaseRequiredDomainNegativeMissingCheck,
    releaseRequiredDomainNegativeMissing: baselineState.releaseRequiredDomainNegativeMissing,
    binaryTestA: binaryA,
    binaryTestC: binaryC,
  });

  writeJson(path.join(outputDir, 'advisory-blocking-drift-cases.json'), {
    advisoryToBlockingDriftCount: baselineState.advisoryToBlockingDriftCount,
    advisoryToBlockingDriftCountZero: baselineState.advisoryToBlockingDriftCountZero,
    driftCases: baselineState.driftCases,
  });

  writeJson(path.join(outputDir, 'summary.json'), summary);
  writeJson(path.join(outputDir, 'ticket-meta.json'), {
    runId: summary.runId,
    ticketId: summary.ticketId,
    outputDir: path.relative(repoRoot, outputDir).replaceAll(path.sep, '/'),
    generatedAtUtc,
  });

  process.stdout.write(`${stableStringify(summary)}\n`);
  process.exit(status === 'PASS' ? 0 : 1);
}

main();

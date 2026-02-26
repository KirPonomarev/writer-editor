#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { evaluateDeclaredSetEffectiveSetAlignment } from './declared-set-effective-set-alignment-state.mjs';

const DEFAULT_OUTPUT_DIR = 'docs/OPS/EVIDENCE/P1_CONTOUR/TICKET_04';
const DEFAULT_STATUS_PATH = 'docs/OPS/STATUS/DECLARED_SET_EFFECTIVE_SET_ALIGNMENT_HARDENING_v3.json';
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

function parseArgs(argv = process.argv.slice(2)) {
  const out = {
    outputDir: DEFAULT_OUTPUT_DIR,
    statusPath: DEFAULT_STATUS_PATH,
    declaredSetPath: DEFAULT_DECLARED_SET_PATH,
    tokenCatalogPath: DEFAULT_TOKEN_CATALOG_PATH,
    failsignalRegistryPath: DEFAULT_FAILSIGNAL_REGISTRY_PATH,
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

    if (arg === '--declared-set-path' && i + 1 < argv.length) {
      out.declaredSetPath = normalizeString(argv[i + 1]) || DEFAULT_DECLARED_SET_PATH;
      i += 1;
      continue;
    }
    if (arg.startsWith('--declared-set-path=')) {
      out.declaredSetPath = normalizeString(arg.slice('--declared-set-path='.length)) || DEFAULT_DECLARED_SET_PATH;
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

    if (arg === '--failsignal-registry-path' && i + 1 < argv.length) {
      out.failsignalRegistryPath = normalizeString(argv[i + 1]) || DEFAULT_FAILSIGNAL_REGISTRY_PATH;
      i += 1;
      continue;
    }
    if (arg.startsWith('--failsignal-registry-path=')) {
      out.failsignalRegistryPath = normalizeString(arg.slice('--failsignal-registry-path='.length)) || DEFAULT_FAILSIGNAL_REGISTRY_PATH;
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

function runNegativeMissingTokenCheck(baselineState, baselineArgs) {
  const declaredSet = Array.isArray(baselineState.declaredSet) ? baselineState.declaredSet : [];
  const targetTokenId = normalizeString(declaredSet[0] || '');

  if (!targetTokenId) {
    return {
      ok: false,
      failReason: 'NO_DECLARED_TOKEN_TARGET',
      targetTokenId: '',
      expectedMissingDetected: false,
      mutatedState: null,
    };
  }

  const mutatedEffectiveSet = declaredSet.filter((tokenId) => tokenId !== targetTokenId);
  const mutatedState = evaluateDeclaredSetEffectiveSetAlignment({
    repoRoot: baselineArgs.repoRoot,
    declaredSetPath: baselineArgs.declaredSetPath,
    tokenCatalogPath: baselineArgs.tokenCatalogPath,
    failsignalRegistryPath: baselineArgs.failsignalRegistryPath,
    effectiveSetTokenIds: mutatedEffectiveSet,
  });

  const expectedMissingDetected = mutatedState.missingDeclaredTokens.includes(targetTokenId);

  const ok = baselineState.ok
    && mutatedState.ok === false
    && mutatedState.declaredEffectiveAlignmentZeroMissingCheck === false
    && expectedMissingDetected;

  return {
    ok,
    failReason: ok ? '' : 'E_DECLARED_EFFECTIVE_ALIGNMENT_DRIFT',
    targetTokenId,
    expectedMissingDetected,
    mutatedState: {
      ok: mutatedState.ok,
      failReason: mutatedState.failReason,
      missingDeclaredCount: mutatedState.missingDeclaredCount,
      extraEffectiveCount: mutatedState.extraEffectiveCount,
      declaredEffectiveAlignmentZeroMissingCheck: mutatedState.declaredEffectiveAlignmentZeroMissingCheck,
      missingDeclaredTokens: mutatedState.missingDeclaredTokens,
      extraEffectiveTokens: mutatedState.extraEffectiveTokens,
    },
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = process.cwd();
  const outputDir = path.resolve(repoRoot, args.outputDir);
  const statusPath = path.resolve(repoRoot, args.statusPath);

  const baselineArgs = {
    repoRoot,
    declaredSetPath: path.resolve(repoRoot, args.declaredSetPath),
    tokenCatalogPath: path.resolve(repoRoot, args.tokenCatalogPath),
    failsignalRegistryPath: path.resolve(repoRoot, args.failsignalRegistryPath),
  };

  const baselineState = evaluateDeclaredSetEffectiveSetAlignment(baselineArgs);
  const negativeMissing = runNegativeMissingTokenCheck(baselineState, baselineArgs);

  const gates = {
    p1_04_declared_set_defined_check: baselineState.declaredSetDefinedCheck ? 'PASS' : 'FAIL',
    p1_04_effective_set_computed_check: baselineState.effectiveSetComputedCheck ? 'PASS' : 'FAIL',
    p1_04_declared_effective_alignment_zero_missing_check: baselineState.declaredEffectiveAlignmentZeroMissingCheck ? 'PASS' : 'FAIL',
    p1_04_missing_declared_token_negative_check: negativeMissing.ok ? 'PASS' : 'FAIL',
    mc_advisory_blocking_drift_zero: baselineState.advisoryToBlockingDriftCountZero ? 'PASS' : 'FAIL',
  };

  const status = Object.values(gates).every((value) => value === 'PASS') ? 'PASS' : 'FAIL';
  const generatedAtUtc = new Date().toISOString();

  const summary = {
    status,
    runId: args.runId || process.env.RUN_ID || '',
    ticketId: args.ticketId || process.env.TICKET_ID || '',
    declaredSetCount: baselineState.declaredSetCount,
    effectiveSetCount: baselineState.effectiveSetCount,
    missingDeclaredCount: baselineState.missingDeclaredCount,
    extraEffectiveCount: baselineState.extraEffectiveCount,
    advisoryToBlockingDriftCount: baselineState.advisoryToBlockingDriftCount,
    singleBlockingAuthorityOk: baselineState.singleBlockingAuthority.ok,
    gates,
    generatedAtUtc,
  };

  writeJson(statusPath, {
    version: 3,
    token: 'DECLARED_SET_EFFECTIVE_SET_ALIGNMENT_HARDENING_OK',
    evaluatorId: 'CANONICAL_MODE_MATRIX_EVALUATOR_V1',
    declaredSetCount: baselineState.declaredSetCount,
    effectiveSetCount: baselineState.effectiveSetCount,
    missingDeclaredCount: baselineState.missingDeclaredCount,
    extraEffectiveCount: baselineState.extraEffectiveCount,
    advisoryToBlockingDriftCount: baselineState.advisoryToBlockingDriftCount,
    gates,
    status,
    updatedAtUtc: generatedAtUtc,
  });

  writeJson(path.join(outputDir, 'declared-effective-token-map.json'), {
    declaredSetPath: baselineState.declaredSetPath,
    tokenCatalogPath: baselineState.tokenCatalogPath,
    declaredSetCount: baselineState.declaredSetCount,
    effectiveSetCount: baselineState.effectiveSetCount,
    declaredEffectiveTokenMap: baselineState.declaredEffectiveTokenMap,
  });

  writeJson(path.join(outputDir, 'declared-effective-gap-report.json'), {
    declaredSet: baselineState.declaredSet,
    effectiveSet: baselineState.effectiveSet,
    missingDeclaredTokens: baselineState.missingDeclaredTokens,
    extraEffectiveTokens: baselineState.extraEffectiveTokens,
    missingDeclaredCount: baselineState.missingDeclaredCount,
    extraEffectiveCount: baselineState.extraEffectiveCount,
    declaredEffectiveAlignmentZeroMissingCheck: baselineState.declaredEffectiveAlignmentZeroMissingCheck,
  });

  writeJson(path.join(outputDir, 'declared-effective-negative-missing-token.json'), {
    checkId: 'p1_04_missing_declared_token_negative_check',
    negativeCase: negativeMissing,
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

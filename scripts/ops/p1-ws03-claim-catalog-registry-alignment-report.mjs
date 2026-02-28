#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { evaluateP1Ws03ClaimCatalogRegistryAlignmentState } from './p1-ws03-claim-catalog-registry-alignment-state.mjs';

const DEFAULT_OUTPUT_DIR = 'docs/OPS/EVIDENCE/P1_CONTOUR/TICKET_13';
const DEFAULT_STATUS_PATH = 'docs/OPS/STATUS/P1_WS03_CLAIM_CATALOG_REGISTRY_ALIGNMENT_v1.json';

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

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${stableStringify(value)}\n`, 'utf8');
}

function parseArgs(argv = process.argv.slice(2)) {
  const out = {
    outputDir: DEFAULT_OUTPUT_DIR,
    statusPath: DEFAULT_STATUS_PATH,
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

function comparableState(state) {
  return {
    ok: state.ok,
    token: state.P1_WS03_CLAIM_CATALOG_REGISTRY_ALIGNMENT_OK,
    counts: state.counts,
    negativeResults: state.negativeResults,
    positiveResults: state.positiveResults,
    dod: state.dod,
    acceptance: state.acceptance,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = process.cwd();
  const outputDir = path.resolve(repoRoot, args.outputDir);
  const statusPath = path.resolve(repoRoot, args.statusPath);

  const run1 = evaluateP1Ws03ClaimCatalogRegistryAlignmentState({ repoRoot });
  const run2 = evaluateP1Ws03ClaimCatalogRegistryAlignmentState({ repoRoot });
  const run3 = evaluateP1Ws03ClaimCatalogRegistryAlignmentState({ repoRoot });

  const repeatabilityStable = stableStringify(comparableState(run1)) === stableStringify(comparableState(run2))
    && stableStringify(comparableState(run2)) === stableStringify(comparableState(run3));

  const generatedAtUtc = new Date().toISOString();

  const summary = {
    status: run1.ok && repeatabilityStable ? 'PASS' : 'FAIL',
    runId: args.runId || process.env.RUN_ID || '',
    ticketId: args.ticketId || process.env.TICKET_ID || '',
    objective: 'ACHIEVE_ZERO_GAP_ALIGNMENT_BETWEEN_CLAIM_MATRIX_TOKEN_CATALOG_AND_FAILSIGNAL_REGISTRY_FOR_ACTIVE_SCOPE',
    failSignalTarget: 'E_CRITICAL_CLAIM_MATRIX_INVALID',
    blockingSurfaceExpansion: false,
    claimTokenGapCount: run1.counts.claimTokenGapCount,
    claimFailsignalGapCount: run1.counts.claimFailsignalGapCount,
    tokenFailsignalGapCount: run1.counts.tokenFailsignalGapCount,
    requiredSetUndeclaredEntityCount: run1.counts.requiredSetUndeclaredEntityCount,
    activeScopeAlignmentMismatchCount: run1.counts.activeScopeAlignmentMismatchCount,
    advisoryToBlockingDriftCount: run1.advisoryToBlockingDriftCount,
    negativeResults: run1.negativeResults,
    positiveResults: run1.positiveResults,
    dod: {
      ...run1.dod,
      NEXT_TZ_DOD_06: repeatabilityStable,
      NEXT_TZ_DOD_07: true,
    },
    acceptance: {
      ...run1.acceptance,
      NEXT_TZ_ACCEPTANCE_03: true,
      NEXT_TZ_ACCEPTANCE_04: run1.ok && repeatabilityStable,
    },
    generatedAtUtc,
  };

  const statusDoc = {
    version: 1,
    token: 'P1_WS03_CLAIM_CATALOG_REGISTRY_ALIGNMENT_OK',
    failSignalTarget: 'E_CRITICAL_CLAIM_MATRIX_INVALID',
    claimTokenGapCount: summary.claimTokenGapCount,
    claimFailsignalGapCount: summary.claimFailsignalGapCount,
    tokenFailsignalGapCount: summary.tokenFailsignalGapCount,
    requiredSetUndeclaredEntityCount: summary.requiredSetUndeclaredEntityCount,
    activeScopeAlignmentMismatchCount: summary.activeScopeAlignmentMismatchCount,
    advisoryToBlockingDriftCount: summary.advisoryToBlockingDriftCount,
    repeatabilityStable3Runs: repeatabilityStable,
    status: summary.status,
    updatedAtUtc: generatedAtUtc,
  };

  writeJson(statusPath, statusDoc);

  writeJson(path.join(outputDir, 'alignment-gap-summary.json'), {
    claimTokenGaps: run1.claimTokenGaps,
    claimFailsignalGaps: run1.claimFailsignalGaps,
    tokenFailsignalGaps: run1.tokenFailsignalGaps,
    activeScopeAlignmentMismatches: run1.activeScopeAlignmentMismatches,
    claimTokenGapCount: run1.counts.claimTokenGapCount,
    claimFailsignalGapCount: run1.counts.claimFailsignalGapCount,
    tokenFailsignalGapCount: run1.counts.tokenFailsignalGapCount,
    activeScopeAlignmentMismatchCount: run1.counts.activeScopeAlignmentMismatchCount,
  });

  writeJson(path.join(outputDir, 'required-set-alignment-summary.json'), {
    activeScopeTokenCount: run1.counts.activeScopeTokenCount,
    activeScopeTokens: run1.activeScopeTokens,
    requiredSetUndeclaredEntities: run1.requiredSetUndeclaredEntities,
    requiredSetUndeclaredEntityCount: run1.counts.requiredSetUndeclaredEntityCount,
    scopedClaimCount: run1.counts.scopedClaimCount,
  });

  writeJson(path.join(outputDir, 'negative-results.json'), {
    target: {
      NEXT_TZ_NEGATIVE_01: 'CLAIM_REFERENCES_MISSING_TOKEN_EXPECT_POLICY_FAIL',
      NEXT_TZ_NEGATIVE_02: 'CLAIM_REFERENCES_MISSING_FAILSIGNAL_EXPECT_POLICY_FAIL',
      NEXT_TZ_NEGATIVE_03: 'TOKEN_REFERENCES_MISSING_FAILSIGNAL_EXPECT_POLICY_FAIL',
      NEXT_TZ_NEGATIVE_04: 'REQUIRED_SET_REFERENCES_UNDECLARED_ENTITY_EXPECT_POLICY_FAIL',
      NEXT_TZ_NEGATIVE_05: 'ACTIVE_SCOPE_ALIGNMENT_MISMATCH_EXPECT_POLICY_FAIL',
    },
    results: run1.negativeResults,
  });

  writeJson(path.join(outputDir, 'positive-results.json'), {
    target: {
      NEXT_TZ_POSITIVE_01: 'CLAIM_CATALOG_REGISTRY_GAP_COUNT_EQUALS_ZERO',
      NEXT_TZ_POSITIVE_02: 'ACTIVE_SCOPE_REQUIRED_SET_ALIGNMENT_IS_CONSISTENT',
      NEXT_TZ_POSITIVE_03: 'ALIGNMENT_STATE_REPORT_IS_DETERMINISTIC',
    },
    results: run1.positiveResults,
  });

  writeJson(path.join(outputDir, 'repeatability-summary.json'), {
    stable: repeatabilityStable,
    runs: [comparableState(run1), comparableState(run2), comparableState(run3)],
  });

  writeJson(path.join(outputDir, 'summary.json'), summary);
  writeJson(path.join(outputDir, 'ticket-meta.json'), {
    runId: summary.runId,
    ticketId: summary.ticketId,
    outputDir: path.relative(repoRoot, outputDir).replaceAll(path.sep, '/'),
    generatedAtUtc,
  });

  process.stdout.write(`${stableStringify(summary)}\n`);
  process.exit(summary.status === 'PASS' ? 0 : 1);
}

main();

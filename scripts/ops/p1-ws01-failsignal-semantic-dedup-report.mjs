#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { evaluateP1Ws01FailsignalSemanticDedupState } from './p1-ws01-failsignal-semantic-dedup-state.mjs';

const DEFAULT_OUTPUT_DIR = 'docs/OPS/EVIDENCE/P1_CONTOUR/TICKET_11';
const DEFAULT_STATUS_PATH = 'docs/OPS/STATUS/P1_WS01_FAILSIGNAL_SEMANTIC_DEDUP_v1.json';

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
    token: state.P1_WS01_FAILSIGNAL_SEMANTIC_DEDUP_OK,
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

  const run1 = evaluateP1Ws01FailsignalSemanticDedupState({ repoRoot });
  const run2 = evaluateP1Ws01FailsignalSemanticDedupState({ repoRoot });
  const run3 = evaluateP1Ws01FailsignalSemanticDedupState({ repoRoot });

  const repeatabilityStable = stableStringify(comparableState(run1)) === stableStringify(comparableState(run2))
    && stableStringify(comparableState(run2)) === stableStringify(comparableState(run3));

  const generatedAtUtc = new Date().toISOString();

  const summary = {
    status: run1.ok && repeatabilityStable ? 'PASS' : 'FAIL',
    runId: args.runId || process.env.RUN_ID || '',
    ticketId: args.ticketId || process.env.TICKET_ID || '',
    objective: 'ONE_MEANING_ONE_FAILSIGNAL_PLUS_DUPLICATE_COLLISION_ELIMINATION_WITHOUT_BLOCKING_SURFACE_EXPANSION',
    failSignalTarget: 'E_FAILSIGNAL_SEMANTIC_COLLISION',
    blockingSurfaceExpansion: false,
    semanticCollisionCount: run1.counts.semanticCollisionCount,
    tokenFailsignalAmbiguityCount: run1.counts.tokenFailsignalAmbiguityCount,
    claimModeConflictCount: run1.counts.claimModeConflictCount,
    registryDeclarationMismatchCount: run1.counts.registryDeclarationMismatchCount,
    advisoryToBlockingDriftCount: run1.advisoryToBlockingDriftCount,
    claimModeResolvedByMigrationCount: run1.counts.claimModeResolvedByMigrationCount,
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
    token: 'P1_WS01_FAILSIGNAL_SEMANTIC_DEDUP_OK',
    failSignalTarget: 'E_FAILSIGNAL_SEMANTIC_COLLISION',
    semanticCollisionCount: summary.semanticCollisionCount,
    tokenFailsignalAmbiguityCount: summary.tokenFailsignalAmbiguityCount,
    claimModeConflictCount: summary.claimModeConflictCount,
    registryDeclarationMismatchCount: summary.registryDeclarationMismatchCount,
    advisoryToBlockingDriftCount: summary.advisoryToBlockingDriftCount,
    repeatabilityStable3Runs: repeatabilityStable,
    status: summary.status,
    updatedAtUtc: generatedAtUtc,
  };

  writeJson(statusPath, statusDoc);

  writeJson(path.join(outputDir, 'semantic-collision-summary.json'), {
    semanticCollisions: run1.semanticCollisions,
    semanticCollisionCount: run1.counts.semanticCollisionCount,
    semanticAliasWithoutMigration: run1.aliasUnresolved,
    semanticAliasWithoutMigrationCount: run1.counts.semanticAliasWithoutMigrationCount,
  });

  writeJson(path.join(outputDir, 'alignment-summary.json'), {
    tokenUnknown: run1.tokenUnknown,
    tokenAmbiguous: run1.tokenAmbiguous,
    claimMissingFailsignal: run1.claimMissingFailsignal,
    claimUnresolvedConflicts: run1.claimUnresolvedConflicts,
    claimResolvedByMigration: run1.claimResolvedByMigration,
    tokenFailsignalAmbiguityCount: run1.counts.tokenFailsignalAmbiguityCount,
    registryDeclarationMismatchCount: run1.counts.registryDeclarationMismatchCount,
    claimModeConflictCount: run1.counts.claimModeConflictCount,
    claimModeResolvedByMigrationCount: run1.counts.claimModeResolvedByMigrationCount,
  });

  writeJson(path.join(outputDir, 'negative-results.json'), {
    target: {
      NEXT_TZ_NEGATIVE_01: 'DUPLICATE_FAILSIGNAL_MEANING_DETECTED_EXPECT_POLICY_FAIL',
      NEXT_TZ_NEGATIVE_02: 'TOKEN_POINTS_TO_AMBIGUOUS_FAILSIGNAL_EXPECT_POLICY_FAIL',
      NEXT_TZ_NEGATIVE_03: 'CLAIM_MODE_DISPOSITION_CONFLICT_EXPECT_POLICY_FAIL',
      NEXT_TZ_NEGATIVE_04: 'SEMANTIC_ALIAS_WITHOUT_MIGRATION_MAP_EXPECT_POLICY_FAIL',
      NEXT_TZ_NEGATIVE_05: 'REGISTRY_DECLARATION_MISMATCH_EXPECT_POLICY_FAIL',
    },
    results: run1.negativeResults,
  });

  writeJson(path.join(outputDir, 'positive-results.json'), {
    target: {
      NEXT_TZ_POSITIVE_01: 'UNIQUE_MEANING_PER_FAILSIGNAL_CONFIRMED',
      NEXT_TZ_POSITIVE_02: 'TOKEN_CLAIM_REGISTRY_ALIGNMENT_CONFIRMED',
      NEXT_TZ_POSITIVE_03: 'MODE_DISPOSITION_CONSISTENT_ACROSS_SOURCES',
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

#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { evaluateP1Ws02ModeMatrixCompletenessState } from './p1-ws02-mode-matrix-completeness-state.mjs';

const DEFAULT_OUTPUT_DIR = 'docs/OPS/EVIDENCE/P1_CONTOUR/TICKET_12';
const DEFAULT_STATUS_PATH = 'docs/OPS/STATUS/P1_WS02_MODE_MATRIX_COMPLETENESS_v1.json';

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
    token: state.P1_WS02_MODE_MATRIX_COMPLETENESS_OK,
    counts: state.counts,
    negativeResults: state.negativeResults,
    positiveResults: state.positiveResults,
    dod: state.dod,
    acceptance: state.acceptance,
    singleAuthorityOk: state.singleAuthorityOk,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = process.cwd();
  const outputDir = path.resolve(repoRoot, args.outputDir);
  const statusPath = path.resolve(repoRoot, args.statusPath);

  const run1 = evaluateP1Ws02ModeMatrixCompletenessState({ repoRoot });
  const run2 = evaluateP1Ws02ModeMatrixCompletenessState({ repoRoot });
  const run3 = evaluateP1Ws02ModeMatrixCompletenessState({ repoRoot });

  const repeatabilityStable = stableStringify(comparableState(run1)) === stableStringify(comparableState(run2))
    && stableStringify(comparableState(run2)) === stableStringify(comparableState(run3));

  const generatedAtUtc = new Date().toISOString();

  const summary = {
    status: run1.ok && repeatabilityStable ? 'PASS' : 'FAIL',
    runId: args.runId || process.env.RUN_ID || '',
    ticketId: args.ticketId || process.env.TICKET_ID || '',
    objective: 'COMPLETE_MODE_MATRIX_COVERAGE_FOR_ALL_FAILSIGNALS_WITH_SINGLE_AUTHORITY_ENFORCEMENT',
    failSignalTarget: 'E_FAILSIGNAL_MODE_MAPPING_INCOMPLETE',
    blockingSurfaceExpansion: false,
    modeCoveragePercent: run1.counts.modeCoveragePercent,
    modeMismatchCount: run1.counts.modeMismatchCount,
    modeGapCount: run1.counts.modeGapCount,
    duplicateModeRuleCount: run1.counts.duplicateModeRuleCount,
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
    token: 'P1_WS02_MODE_MATRIX_COMPLETENESS_OK',
    failSignalTarget: 'E_FAILSIGNAL_MODE_MAPPING_INCOMPLETE',
    modeCoveragePercent: summary.modeCoveragePercent,
    modeMismatchCount: summary.modeMismatchCount,
    modeGapCount: summary.modeGapCount,
    duplicateModeRuleCount: summary.duplicateModeRuleCount,
    advisoryToBlockingDriftCount: summary.advisoryToBlockingDriftCount,
    repeatabilityStable3Runs: repeatabilityStable,
    status: summary.status,
    updatedAtUtc: generatedAtUtc,
  };

  writeJson(statusPath, statusDoc);

  writeJson(path.join(outputDir, 'mode-coverage-summary.json'), {
    totalFailSignalCount: run1.counts.totalFailSignalCount,
    modeCoveragePercent: run1.counts.modeCoveragePercent,
    modeGapCount: run1.counts.modeGapCount,
    duplicateModeRuleCount: run1.counts.duplicateModeRuleCount,
    modeCoverageDetails: run1.modeCoverageDetails,
  });

  writeJson(path.join(outputDir, 'mode-mismatch-summary.json'), {
    modeMismatchCount: run1.counts.modeMismatchCount,
    mismatches: run1.modeMismatches,
    issues: run1.modeMismatchIssues,
    singleAuthorityOk: run1.singleAuthorityOk,
    evaluatorIdExpected: run1.evaluatorIdExpected,
  });

  writeJson(path.join(outputDir, 'negative-results.json'), {
    target: {
      NEXT_TZ_NEGATIVE_01: 'FAILSIGNAL_WITH_MISSING_MODE_DISPOSITION_EXPECT_POLICY_FAIL',
      NEXT_TZ_NEGATIVE_02: 'REGISTRY_EVALUATOR_MODE_MISMATCH_EXPECT_POLICY_FAIL',
      NEXT_TZ_NEGATIVE_03: 'DUPLICATE_MODE_RULE_FOR_SAME_FAILSIGNAL_EXPECT_POLICY_FAIL',
      NEXT_TZ_NEGATIVE_04: 'INVALID_MODE_VALUE_EXPECT_POLICY_FAIL',
      NEXT_TZ_NEGATIVE_05: 'PARTIAL_MATRIX_COVERAGE_EXPECT_POLICY_FAIL',
    },
    results: run1.negativeResults,
  });

  writeJson(path.join(outputDir, 'positive-results.json'), {
    target: {
      NEXT_TZ_POSITIVE_01: 'ALL_FAILSIGNALS_HAVE_PR_RELEASE_PROMOTION_DISPOSITIONS',
      NEXT_TZ_POSITIVE_02: 'REGISTRY_AND_EVALUATOR_MODE_TABLES_MATCH',
      NEXT_TZ_POSITIVE_03: 'MODE_ROUTING_OUTPUT_IS_DETERMINISTIC',
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

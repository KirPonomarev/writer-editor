#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { evaluateX59Ws01NextContourAlignmentState } from './x59-ws01-next-contour-alignment-state.mjs';

const DEFAULT_OUTPUT_DIR = 'docs/OPS/EVIDENCE/X59_CONTOUR/TICKET_01';
const DEFAULT_STATUS_PATH = 'docs/OPS/STATUS/X59_WS01_NEXT_CONTOUR_ALIGNMENT_STATUS_V1.json';
const DEFAULT_RUN_ID = 'TZ_X59_WS01_NEXT_CONTOUR_ALIGNMENT_001';

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
    runId: DEFAULT_RUN_ID,
    ticketId: DEFAULT_RUN_ID,
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
      out.runId = normalizeString(argv[i + 1]) || DEFAULT_RUN_ID;
      i += 1;
      continue;
    }
    if (arg.startsWith('--run-id=')) {
      out.runId = normalizeString(arg.slice('--run-id='.length)) || DEFAULT_RUN_ID;
      continue;
    }

    if (arg === '--ticket-id' && i + 1 < argv.length) {
      out.ticketId = normalizeString(argv[i + 1]) || out.runId;
      i += 1;
      continue;
    }
    if (arg.startsWith('--ticket-id=')) {
      out.ticketId = normalizeString(arg.slice('--ticket-id='.length)) || out.runId;
    }
  }

  return out;
}

function comparableState(state) {
  return {
    ok: state.ok,
    token: state.token,
    counts: state.counts,
    negativeResults: state.negativeResults,
    positiveResults: state.positiveResults,
    dod: state.dod,
    acceptance: state.acceptance,
    determinism: {
      runHashes: state.determinism.runHashes,
      stable: state.determinism.stable,
    },
    finalGateSatisfied: state.finalGateSatisfied,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = process.cwd();

  const run1 = evaluateX59Ws01NextContourAlignmentState({ repoRoot });
  const run2 = evaluateX59Ws01NextContourAlignmentState({ repoRoot });
  const run3 = evaluateX59Ws01NextContourAlignmentState({ repoRoot });

  const comp1 = comparableState(run1);
  const comp2 = comparableState(run2);
  const comp3 = comparableState(run3);
  const repeatabilityStable = stableStringify(comp1) === stableStringify(comp2)
    && stableStringify(comp2) === stableStringify(comp3);

  const generatedAtUtc = new Date().toISOString();
  const summary = {
    generatedAtUtc,
    runId: args.runId,
    ticketId: args.ticketId,
    objective: 'EXECUTE_NEXT_CONTOUR_ALIGNMENT_WITH_CANON_LOCK_AND_DETERMINISTIC_OUTPUT',
    status: run1.ok && repeatabilityStable ? 'PASS' : 'FAIL',
    negativeResults: Object.fromEntries(
      Object.entries(run1.negativeResults).map(([k, v]) => [k, v ? 'PASS' : 'FAIL']),
    ),
    positiveResults: Object.fromEntries(
      Object.entries(run1.positiveResults).map(([k, v]) => [k, v ? 'PASS' : 'FAIL']),
    ),
    nextContourAlignmentSummary: {
      entryChecksAllPass: run1.positiveResults.NEXT_TZ_POSITIVE_01,
      queuePriorityAndScopeLockConsistent: run1.positiveResults.NEXT_TZ_POSITIVE_02,
      alignmentOutputDeterministic: run1.positiveResults.NEXT_TZ_POSITIVE_03,
      prestartFailureCount: run1.counts.prestartFailureCount,
      scopeExpansionCount: run1.counts.scopeExpansionCount,
      queuePriorityConflictCount: run1.counts.queuePriorityConflictCount,
      evidenceChainGapCount: run1.counts.evidenceChainGapCount,
      nonDeterministicOutputCount: run1.counts.nonDeterministicOutputCount,
    },
    dod: {
      NEXT_TZ_DOD_01: run1.dod.DOD_01,
      NEXT_TZ_DOD_02: run1.dod.DOD_02,
      NEXT_TZ_DOD_03: run1.dod.DOD_03,
      NEXT_TZ_DOD_04: run1.dod.DOD_04,
      NEXT_TZ_DOD_05: run1.dod.DOD_05,
      NEXT_TZ_DOD_06: run1.dod.DOD_06,
    },
    acceptance: {
      NEXT_TZ_ACCEPTANCE_01: run1.acceptance.ACCEPTANCE_01,
      NEXT_TZ_ACCEPTANCE_02: run1.acceptance.ACCEPTANCE_02,
      NEXT_TZ_ACCEPTANCE_03: run1.acceptance.ACCEPTANCE_03,
      NEXT_TZ_ACCEPTANCE_04: run1.acceptance.ACCEPTANCE_04,
    },
    repeatability: {
      stable: repeatabilityStable,
      runs: [comp1, comp2, comp3],
    },
    finalGate: run1.finalGate,
    finalGateSatisfied: run1.finalGateSatisfied && repeatabilityStable,
  };

  const statusDoc = {
    version: 1,
    token: run1.token,
    runId: args.runId,
    ticketId: args.ticketId,
    generatedAtUtc,
    status: summary.status,
    counts: run1.counts,
    checks: run1.checks,
    repeatabilityStable,
    finalGateSatisfied: summary.finalGateSatisfied,
  };

  const outputDir = path.resolve(repoRoot, args.outputDir);
  const statusPath = path.resolve(repoRoot, args.statusPath);

  writeJson(statusPath, statusDoc);

  writeJson(path.join(outputDir, 'negative-results.json'), summary.negativeResults);
  writeJson(path.join(outputDir, 'positive-results.json'), summary.positiveResults);
  writeJson(path.join(outputDir, 'final-dod-acceptance-summary.json'), {
    dod: summary.dod,
    acceptance: summary.acceptance,
    finalGate: summary.finalGate,
    finalGateSatisfied: summary.finalGateSatisfied,
  });
  writeJson(path.join(outputDir, 'summary.json'), summary);
  writeJson(path.join(outputDir, 'ticket-meta.json'), {
    generatedAtUtc,
    runId: args.runId,
    ticketId: args.ticketId,
  });

  process.stdout.write(`${stableStringify(summary)}\n`);
  process.exit(summary.status === 'PASS' ? 0 : 1);
}

main();

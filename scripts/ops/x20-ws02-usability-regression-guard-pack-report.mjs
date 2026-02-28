#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { evaluateX20Ws02UsabilityRegressionGuardPackState } from './x20-ws02-usability-regression-guard-pack-state.mjs';

const DEFAULT_OUTPUT_DIR = 'docs/OPS/EVIDENCE/X20_CONTOUR/TICKET_02';
const DEFAULT_STATUS_PATH = 'docs/OPS/STATUS/X20_WS02_USABILITY_REGRESSION_GUARD_PACK_v1.json';

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
    token: state.X20_WS02_USABILITY_REGRESSION_GUARD_PACK_OK,
    counts: state.counts,
    negativeResults: state.negativeResults,
    positiveResults: state.positiveResults,
    dod: state.dod,
    acceptance: state.acceptance,
    detector: state.detector,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = process.cwd();
  const outputDir = path.resolve(repoRoot, args.outputDir);
  const statusPath = path.resolve(repoRoot, args.statusPath);

  const run1 = evaluateX20Ws02UsabilityRegressionGuardPackState({ repoRoot });
  const run2 = evaluateX20Ws02UsabilityRegressionGuardPackState({ repoRoot });
  const run3 = evaluateX20Ws02UsabilityRegressionGuardPackState({ repoRoot });

  const repeatabilityStable = stableStringify(comparableState(run1)) === stableStringify(comparableState(run2))
    && stableStringify(comparableState(run2)) === stableStringify(comparableState(run3));

  const generatedAtUtc = new Date().toISOString();

  const summary = {
    status: run1.ok && repeatabilityStable ? 'PASS' : 'FAIL',
    runId: args.runId || process.env.RUN_ID || '',
    ticketId: args.ticketId || process.env.TICKET_ID || '',
    objective: 'BUILD_USABILITY_REGRESSION_GUARD_PACK_FOR_CURRENT_MENU_FEATURE_SET_BEFORE_RELEASE_WRAP',
    blockingSurfaceExpansion: false,
    counts: run1.counts,
    negativeResults: run1.negativeResults,
    positiveResults: run1.positiveResults,
    dod: {
      ...run1.dod,
      NEXT_TZ_DOD_04: repeatabilityStable,
      NEXT_TZ_DOD_05: true,
      NEXT_TZ_DOD_06: run1.drift.advisoryToBlockingDriftCountZero,
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
    token: 'X20_WS02_USABILITY_REGRESSION_GUARD_PACK_OK',
    guardCount: summary.counts.guardCount,
    requiredCriticalFlowCount: summary.counts.requiredCriticalFlowCount,
    missingCriticalFlowGuardCount: summary.counts.missingCriticalFlowGuardCount,
    staleGuardReferenceCount: summary.counts.staleGuardReferenceCount,
    tokenMismatchCount: summary.counts.tokenMismatchCount,
    statusMismatchCount: summary.counts.statusMismatchCount,
    modeProfileGuardGapCount: summary.counts.modeProfileGuardGapCount,
    channelGuardMismatchCount: summary.counts.channelGuardMismatchCount,
    requiredZeroViolationCount: summary.counts.requiredZeroViolationCount,
    requiredPositiveViolationCount: summary.counts.requiredPositiveViolationCount,
    duplicateGuardIdCount: summary.counts.duplicateGuardIdCount,
    duplicateFlowGuardCount: summary.counts.duplicateFlowGuardCount,
    advisoryToBlockingDriftCount: summary.counts.advisoryToBlockingDriftCount,
    expectedChannelCount: summary.counts.expectedChannelCount,
    expectedModeCount: summary.counts.expectedModeCount,
    expectedProfileCount: summary.counts.expectedProfileCount,
    repeatabilityStable3Runs: repeatabilityStable,
    status: summary.status,
    updatedAtUtc: generatedAtUtc,
  };

  writeJson(statusPath, statusDoc);

  writeJson(path.join(outputDir, 'negative-results.json'), {
    target: {
      NEXT_TZ_NEGATIVE_01: 'MISSING_GUARD_FOR_CRITICAL_FLOW_EXPECT_REJECT',
      NEXT_TZ_NEGATIVE_02: 'STALE_GUARD_REFERENCE_EXPECT_REJECT',
      NEXT_TZ_NEGATIVE_03: 'MODE_PROFILE_GUARD_GAP_EXPECT_REJECT',
      NEXT_TZ_NEGATIVE_04: 'CHANNEL_GUARD_MISMATCH_EXPECT_REJECT',
      NEXT_TZ_NEGATIVE_05: 'NON_DETERMINISTIC_GUARD_SUMMARY_EXPECT_REJECT',
    },
    results: run1.negativeResults,
    details: run1.negativeDetails,
  });

  writeJson(path.join(outputDir, 'positive-results.json'), {
    target: {
      NEXT_TZ_POSITIVE_01: 'GUARD_PACK_COVERS_REQUIRED_USABILITY_FLOWS',
      NEXT_TZ_POSITIVE_02: 'GUARD_RESULTS_CONSISTENT_WITH_COMMAND_SURFACE',
      NEXT_TZ_POSITIVE_03: 'GUARD_PACK_OUTPUT_DETERMINISTIC',
    },
    results: run1.positiveResults,
    details: {
      baseline: {
        guardCount: run1.counts.guardCount,
        requiredCriticalFlowCount: run1.counts.requiredCriticalFlowCount,
        projectionHash: run1.baseline.projectionHash,
      },
      determinism: run1.determinism,
      missingCriticalFlowGuards: run1.baseline.missingCriticalFlowGuards,
      staleGuardReferences: run1.baseline.staleGuardReferences,
      modeProfileGuardGaps: run1.baseline.modeProfileGuardGaps,
      channelGuardMismatch: run1.baseline.channelGuardMismatch,
    },
  });

  writeJson(path.join(outputDir, 'usability-guard-pack-summary.json'), {
    guardCount: run1.counts.guardCount,
    requiredCriticalFlowCount: run1.counts.requiredCriticalFlowCount,
    missingCriticalFlowGuardCount: run1.counts.missingCriticalFlowGuardCount,
    staleGuardReferenceCount: run1.counts.staleGuardReferenceCount,
    tokenMismatchCount: run1.counts.tokenMismatchCount,
    statusMismatchCount: run1.counts.statusMismatchCount,
    modeProfileGuardGapCount: run1.counts.modeProfileGuardGapCount,
    channelGuardMismatchCount: run1.counts.channelGuardMismatchCount,
    requiredZeroViolationCount: run1.counts.requiredZeroViolationCount,
    requiredPositiveViolationCount: run1.counts.requiredPositiveViolationCount,
    duplicateGuardIdCount: run1.counts.duplicateGuardIdCount,
    duplicateFlowGuardCount: run1.counts.duplicateFlowGuardCount,
    advisoryToBlockingDriftCount: run1.counts.advisoryToBlockingDriftCount,
    expectedChannelCount: run1.counts.expectedChannelCount,
    expectedModeCount: run1.counts.expectedModeCount,
    expectedProfileCount: run1.counts.expectedProfileCount,
    baseline: run1.baseline,
    determinism: run1.determinism,
    detector: run1.detector,
  });

  writeJson(path.join(outputDir, 'repeatability-summary.json'), {
    stable: repeatabilityStable,
    runs: [comparableState(run1), comparableState(run2), comparableState(run3)],
  });

  writeJson(path.join(outputDir, 'final-dod-acceptance-summary.json'), {
    dod: summary.dod,
    acceptance: summary.acceptance,
    finalGate: summary.status === 'PASS' ? 'GO_TO_X20_WS03_ONLY_IF_ALL_DOD_AND_ACCEPTANCE_TRUE' : 'HOLD',
  });

  writeJson(path.join(outputDir, 'summary.json'), summary);
  writeJson(path.join(outputDir, 'ticket-meta.json'), {
    runId: summary.runId,
    ticketId: summary.ticketId,
    generatedAtUtc,
  });

  process.stdout.write(`${stableStringify(summary)}\n`);
  process.exit(summary.status === 'PASS' ? 0 : 1);
}

main();

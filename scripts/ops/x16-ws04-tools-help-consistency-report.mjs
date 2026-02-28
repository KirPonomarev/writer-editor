#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { evaluateX16Ws04ToolsHelpConsistencyState } from './x16-ws04-tools-help-consistency-state.mjs';

const DEFAULT_OUTPUT_DIR = 'docs/OPS/EVIDENCE/X16_CONTOUR/TICKET_04';
const DEFAULT_STATUS_PATH = 'docs/OPS/STATUS/X16_WS04_TOOLS_HELP_CONSISTENCY_STATUS_v1.json';

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
  const out = { outputDir: DEFAULT_OUTPUT_DIR, statusPath: DEFAULT_STATUS_PATH, runId: '', ticketId: '' };

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
    token: state.X16_WS04_TOOLS_HELP_CONSISTENCY_OK,
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

  const run1 = evaluateX16Ws04ToolsHelpConsistencyState({ repoRoot });
  const run2 = evaluateX16Ws04ToolsHelpConsistencyState({ repoRoot });
  const run3 = evaluateX16Ws04ToolsHelpConsistencyState({ repoRoot });

  const repeatabilityStable = stableStringify(comparableState(run1)) === stableStringify(comparableState(run2))
    && stableStringify(comparableState(run2)) === stableStringify(comparableState(run3));

  const generatedAtUtc = new Date().toISOString();

  const summary = {
    status: run1.ok && repeatabilityStable ? 'PASS' : 'FAIL',
    runId: args.runId || process.env.RUN_ID || '',
    ticketId: args.ticketId || process.env.TICKET_ID || '',
    objective: 'SYNC_TOOLS_HELP_MENU_CONSISTENCY_MODE_PROFILE_CHANNEL_NO_CORE_LEAK',
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
    token: 'X16_WS04_TOOLS_HELP_CONSISTENCY_OK',
    consistencyEntryCount: summary.counts.consistencyEntryCount,
    menuProjectionRowCount: summary.counts.menuProjectionRowCount,
    modeCount: summary.counts.modeCount,
    profileCount: summary.counts.profileCount,
    channelCount: summary.counts.channelCount,
    modeProfileCoverageGapCount: summary.counts.modeProfileCoverageGapCount,
    channelMismatchCount: summary.counts.channelMismatchCount,
    advisoryToBlockingDriftCount: summary.counts.advisoryToBlockingDriftCount,
    repeatabilityStable3Runs: repeatabilityStable,
    status: summary.status,
    updatedAtUtc: generatedAtUtc,
  };

  writeJson(statusPath, statusDoc);

  writeJson(path.join(outputDir, 'negative-results.json'), {
    target: {
      NEXT_TZ_NEGATIVE_01: 'TOOLS_ENTRY_WITHOUT_CAPABILITY_BINDING_EXPECT_REJECT',
      NEXT_TZ_NEGATIVE_02: 'HELP_ENTRY_WITH_INVALID_MODE_PROFILE_GATING_EXPECT_REJECT',
      NEXT_TZ_NEGATIVE_03: 'CHANNEL_VISIBILITY_MISMATCH_EXPECT_REJECT',
      NEXT_TZ_NEGATIVE_04: 'TOOLS_OR_HELP_BOUND_AS_BLOCKING_WITHOUT_MACHINE_BINDING_EXPECT_REJECT',
      NEXT_TZ_NEGATIVE_05: 'REQUIRED_HELP_ENTRY_MISSING_EXPECT_REJECT',
    },
    results: run1.negativeResults,
    details: run1.negativeDetails,
  });

  writeJson(path.join(outputDir, 'positive-results.json'), {
    target: {
      NEXT_TZ_POSITIVE_01: 'TOOLS_GROUP_VISIBLE_WHEN_ALLOWED',
      NEXT_TZ_POSITIVE_02: 'HELP_GROUP_VISIBLE_WHEN_ALLOWED',
      NEXT_TZ_POSITIVE_03: 'TOOLS_HELP_CONSISTENCY_DETERMINISTIC_ACROSS_CHANNELS',
    },
    results: run1.positiveResults,
    details: {
      enabledWhenAllowed: run1.baseline.enabledWhenAllowed,
      determinism: run1.determinism,
      modeProfileCoverageGaps: run1.baseline.modeProfileCoverageGaps,
      channelVisibilityMismatches: run1.baseline.channelVisibilityMismatches,
    },
  });

  writeJson(path.join(outputDir, 'tools-help-consistency-summary.json'), {
    consistencyEntryCount: run1.counts.consistencyEntryCount,
    menuProjectionRowCount: run1.counts.menuProjectionRowCount,
    modeCount: run1.counts.modeCount,
    profileCount: run1.counts.profileCount,
    channelCount: run1.counts.channelCount,
    capabilityBindingCount: run1.counts.capabilityBindingCount,
    runtimeCapabilityBindingCount: run1.counts.runtimeCapabilityBindingCount,
    modeProfileCoverageGapCount: run1.counts.modeProfileCoverageGapCount,
    channelMismatchCount: run1.counts.channelMismatchCount,
    baseline: run1.baseline,
    determinism: run1.determinism,
  });

  writeJson(path.join(outputDir, 'repeatability-summary.json'), {
    stable: repeatabilityStable,
    runs: [comparableState(run1), comparableState(run2), comparableState(run3)],
  });

  writeJson(path.join(outputDir, 'final-dod-acceptance-summary.json'), {
    dod: summary.dod,
    acceptance: summary.acceptance,
    finalGate: summary.status === 'PASS' ? 'GO_TO_X16_CLOSEOUT' : 'HOLD',
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

#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { evaluateX19Ws02RecentProjectsAndQuickResumeState } from './x19-ws02-recent-projects-and-quick-resume-state.mjs';

const DEFAULT_OUTPUT_DIR = 'docs/OPS/EVIDENCE/X19_CONTOUR/TICKET_02';
const DEFAULT_STATUS_PATH = 'docs/OPS/STATUS/X19_WS02_RECENT_PROJECTS_AND_QUICK_RESUME_v1.json';

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
    token: state.X19_WS02_RECENT_PROJECTS_AND_QUICK_RESUME_OK,
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

  const run1 = evaluateX19Ws02RecentProjectsAndQuickResumeState({ repoRoot });
  const run2 = evaluateX19Ws02RecentProjectsAndQuickResumeState({ repoRoot });
  const run3 = evaluateX19Ws02RecentProjectsAndQuickResumeState({ repoRoot });

  const repeatabilityStable = stableStringify(comparableState(run1)) === stableStringify(comparableState(run2))
    && stableStringify(comparableState(run2)) === stableStringify(comparableState(run3));

  const generatedAtUtc = new Date().toISOString();

  const summary = {
    status: run1.ok && repeatabilityStable ? 'PASS' : 'FAIL',
    runId: args.runId || process.env.RUN_ID || '',
    ticketId: args.ticketId || process.env.TICKET_ID || '',
    objective: 'SETUP_RECENT_PROJECTS_AND_QUICK_RESUME_WITH_VISIBILITY_AND_AVAILABILITY_GUARDS',
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
    token: 'X19_WS02_RECENT_PROJECTS_AND_QUICK_RESUME_OK',
    entryCount: summary.counts.entryCount,
    requiredRecentActionCount: summary.counts.requiredRecentActionCount,
    quickResumeBindingCount: summary.counts.quickResumeBindingCount,
    invalidProjectPathCount: summary.counts.invalidProjectPathCount,
    commandBindingGapCount: summary.counts.commandBindingGapCount,
    capabilityBindingGapCount: summary.counts.capabilityBindingGapCount,
    staleRecentReferenceCount: summary.counts.staleRecentReferenceCount,
    modeProfileVisibilityGapCount: summary.counts.modeProfileVisibilityGapCount,
    requiredActionGapCount: summary.counts.requiredActionGapCount,
    quickResumeBindingMissingCount: summary.counts.quickResumeBindingMissingCount,
    quickResumeBindingMismatchCount: summary.counts.quickResumeBindingMismatchCount,
    channelInconsistencyCount: summary.counts.channelInconsistencyCount,
    orderingIssueCount: summary.counts.orderingIssueCount,
    advisoryToBlockingDriftCount: summary.counts.advisoryToBlockingDriftCount,
    channelCount: summary.counts.channelCount,
    modeCount: summary.counts.modeCount,
    profileCount: summary.counts.profileCount,
    repeatabilityStable3Runs: repeatabilityStable,
    status: summary.status,
    updatedAtUtc: generatedAtUtc,
  };

  writeJson(statusPath, statusDoc);

  writeJson(path.join(outputDir, 'negative-results.json'), {
    target: {
      NEXT_TZ_NEGATIVE_01: 'RECENT_ENTRY_WITH_INVALID_PROJECT_PATH_EXPECT_REJECT',
      NEXT_TZ_NEGATIVE_02: 'QUICK_RESUME_WITH_MISSING_BINDING_EXPECT_REJECT',
      NEXT_TZ_NEGATIVE_03: 'STALE_RECENT_REFERENCE_EXPECT_REJECT',
      NEXT_TZ_NEGATIVE_04: 'MODE_PROFILE_INVALID_RECENT_VISIBILITY_EXPECT_REJECT',
      NEXT_TZ_NEGATIVE_05: 'CHANNEL_INCONSISTENCY_FOR_RECENT_ENTRIES_EXPECT_REJECT',
    },
    results: run1.negativeResults,
    details: run1.negativeDetails,
  });

  writeJson(path.join(outputDir, 'positive-results.json'), {
    target: {
      NEXT_TZ_POSITIVE_01: 'RECENT_PROJECTS_ORDERING_AND_ENTRIES_VALID',
      NEXT_TZ_POSITIVE_02: 'QUICK_RESUME_ROUTES_TO_VALID_COMMAND_PATHS',
      NEXT_TZ_POSITIVE_03: 'RECENT_AND_RESUME_BEHAVIOR_DETERMINISTIC',
    },
    results: run1.positiveResults,
    details: {
      baseline: {
        entryCount: run1.counts.entryCount,
        projectionHash: run1.baseline.projectionHash,
      },
      determinism: run1.determinism,
      orderingIssues: run1.baseline.orderingIssues,
      quickResumeBindingMissing: run1.baseline.quickResumeBindingMissing,
      quickResumeBindingMismatch: run1.baseline.quickResumeBindingMismatch,
    },
  });

  writeJson(path.join(outputDir, 'recent-resume-summary.json'), {
    entryCount: run1.counts.entryCount,
    requiredRecentActionCount: run1.counts.requiredRecentActionCount,
    quickResumeBindingCount: run1.counts.quickResumeBindingCount,
    invalidProjectPathCount: run1.counts.invalidProjectPathCount,
    commandBindingGapCount: run1.counts.commandBindingGapCount,
    capabilityBindingGapCount: run1.counts.capabilityBindingGapCount,
    staleRecentReferenceCount: run1.counts.staleRecentReferenceCount,
    modeProfileVisibilityGapCount: run1.counts.modeProfileVisibilityGapCount,
    requiredActionGapCount: run1.counts.requiredActionGapCount,
    quickResumeBindingMissingCount: run1.counts.quickResumeBindingMissingCount,
    quickResumeBindingMismatchCount: run1.counts.quickResumeBindingMismatchCount,
    channelInconsistencyCount: run1.counts.channelInconsistencyCount,
    orderingIssueCount: run1.counts.orderingIssueCount,
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
    finalGate: summary.status === 'PASS' ? 'GO_TO_X19_WS03_ONLY_IF_ALL_DOD_AND_ACCEPTANCE_TRUE' : 'HOLD',
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

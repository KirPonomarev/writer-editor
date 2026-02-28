#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { evaluateX15Ws05CommandVisibilityRefinementState } from './x15-ws05-command-visibility-refinement-state.mjs';

const DEFAULT_OUTPUT_DIR = 'docs/OPS/EVIDENCE/X15_CONTOUR/TICKET_05';
const DEFAULT_STATUS_PATH = 'docs/OPS/STATUS/X15_WS05_COMMAND_VISIBILITY_REFINEMENT_v1.json';

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
    token: state.X15_WS05_COMMAND_VISIBILITY_REFINEMENT_OK,
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

  const run1 = evaluateX15Ws05CommandVisibilityRefinementState({ repoRoot });
  const run2 = evaluateX15Ws05CommandVisibilityRefinementState({ repoRoot });
  const run3 = evaluateX15Ws05CommandVisibilityRefinementState({ repoRoot });

  const repeatabilityStable = stableStringify(comparableState(run1)) === stableStringify(comparableState(run2))
    && stableStringify(comparableState(run2)) === stableStringify(comparableState(run3));

  const generatedAtUtc = new Date().toISOString();

  const summary = {
    status: run1.ok && repeatabilityStable ? 'PASS' : 'FAIL',
    runId: args.runId || process.env.RUN_ID || '',
    ticketId: args.ticketId || process.env.TICKET_ID || '',
    objective: 'УТОЧНИТЬ_COMMAND_VISIBILITY_MATRIX_ДЛЯ_MENU_TOOLBAR_PALETTE_ПО_MODE_AND_PROFILE_БЕЗ_CORE_LEAK',
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
    token: 'X15_WS05_COMMAND_VISIBILITY_REFINEMENT_OK',
    channelCount: summary.counts.channelCount,
    modeCount: summary.counts.modeCount,
    profileCount: summary.counts.profileCount,
    rowCount: summary.counts.rowCount,
    commandBindingCount: summary.counts.commandBindingCount,
    advisoryToBlockingDriftCount: summary.counts.advisoryToBlockingDriftCount,
    repeatabilityStable3Runs: repeatabilityStable,
    status: summary.status,
    updatedAtUtc: generatedAtUtc,
  };

  writeJson(statusPath, statusDoc);

  writeJson(path.join(outputDir, 'negative-results.json'), {
    target: {
      NEXT_TZ_NEGATIVE_01: 'REQUIRED_CORE_COMMAND_HIDDEN_IN_ANY_CHANNEL_EXPECT_REJECT',
      NEXT_TZ_NEGATIVE_02: 'MODE_PROFILE_CONFLICTING_VISIBILITY_RULE_EXPECT_REJECT',
      NEXT_TZ_NEGATIVE_03: 'MENU_TOOLBAR_PALETTE_INCONSISTENT_VISIBILITY_EXPECT_REJECT',
      NEXT_TZ_NEGATIVE_04: 'COMMAND_VISIBLE_WITHOUT_CAPABILITY_BINDING_EXPECT_REJECT',
      NEXT_TZ_NEGATIVE_05: 'DUPLICATE_VISIBILITY_RULE_WITH_CONTRADICTION_EXPECT_REJECT',
    },
    results: run1.negativeResults,
    details: run1.negativeDetails,
  });

  writeJson(path.join(outputDir, 'positive-results.json'), {
    target: {
      NEXT_TZ_POSITIVE_01: 'VISIBILITY_MATRIX_DETERMINISTIC_ACROSS_CHANNELS',
      NEXT_TZ_POSITIVE_02: 'MODE_PROFILE_POLICY_COMPLIANCE_CONFIRMED',
      NEXT_TZ_POSITIVE_03: 'REQUIRED_CORE_COMMANDS_GUARANTEED_VISIBLE',
    },
    results: run1.positiveResults,
    details: {
      baseline: {
        rowCount: run1.baseline.rowCount,
        projectionHash: run1.baseline.projectionHash,
      },
      determinism: run1.determinism,
      requiredCoreNotVisible: run1.baseline.requiredCoreNotVisible,
    },
  });

  writeJson(path.join(outputDir, 'command-visibility-summary.json'), {
    channelCount: run1.counts.channelCount,
    modeCount: run1.counts.modeCount,
    profileCount: run1.counts.profileCount,
    rowCount: run1.counts.rowCount,
    commandBindingCount: run1.counts.commandBindingCount,
    requiredCoreCommandCount: run1.refinement.requiredCoreCommands.length,
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
    finalGate: summary.status === 'PASS' ? 'GO_TO_X15_CLOSEOUT' : 'HOLD',
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

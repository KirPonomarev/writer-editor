#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { evaluateX18Ws01ShortcutsAndDiscoverabilityState } from './x18-ws01-shortcuts-and-discoverability-state.mjs';

const DEFAULT_OUTPUT_DIR = 'docs/OPS/EVIDENCE/X18_CONTOUR/TICKET_01';
const DEFAULT_STATUS_PATH = 'docs/OPS/STATUS/X18_WS01_SHORTCUTS_AND_DISCOVERABILITY_v1.json';

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
    token: state.X18_WS01_SHORTCUTS_AND_DISCOVERABILITY_OK,
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

  const run1 = evaluateX18Ws01ShortcutsAndDiscoverabilityState({ repoRoot });
  const run2 = evaluateX18Ws01ShortcutsAndDiscoverabilityState({ repoRoot });
  const run3 = evaluateX18Ws01ShortcutsAndDiscoverabilityState({ repoRoot });

  const repeatabilityStable = stableStringify(comparableState(run1)) === stableStringify(comparableState(run2))
    && stableStringify(comparableState(run2)) === stableStringify(comparableState(run3));

  const generatedAtUtc = new Date().toISOString();

  const summary = {
    status: run1.ok && repeatabilityStable ? 'PASS' : 'FAIL',
    runId: args.runId || process.env.RUN_ID || '',
    ticketId: args.ticketId || process.env.TICKET_ID || '',
    objective: 'SYNC_SHORTCUTS_HINTS_AND_DISCOVERABILITY_WITH_MODE_PROFILE_GUARDS',
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
    token: 'X18_WS01_SHORTCUTS_AND_DISCOVERABILITY_OK',
    entryCount: summary.counts.entryCount,
    requiredGroupCount: summary.counts.requiredGroupCount,
    requiredShortcutCommandCount: summary.counts.requiredShortcutCommandCount,
    shortcutConflictCount: summary.counts.shortcutConflictCount,
    commandBindingGapCount: summary.counts.commandBindingGapCount,
    capabilityBindingGapCount: summary.counts.capabilityBindingGapCount,
    actionBindingMismatchCount: summary.counts.actionBindingMismatchCount,
    menuHintMismatchCount: summary.counts.menuHintMismatchCount,
    paletteDiscoverabilityGapCount: summary.counts.paletteDiscoverabilityGapCount,
    modeProfileVisibilityGapCount: summary.counts.modeProfileVisibilityGapCount,
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
      NEXT_TZ_NEGATIVE_01: 'DUPLICATE_SHORTCUT_CONFLICT_EXPECT_REJECT',
      NEXT_TZ_NEGATIVE_02: 'SHORTCUT_WITHOUT_COMMAND_BINDING_EXPECT_REJECT',
      NEXT_TZ_NEGATIVE_03: 'MODE_PROFILE_INVALID_SHORTCUT_VISIBILITY_EXPECT_REJECT',
      NEXT_TZ_NEGATIVE_04: 'MENU_HINT_MISMATCH_WITH_SHORTCUT_EXPECT_REJECT',
      NEXT_TZ_NEGATIVE_05: 'PALETTE_DISCOVERABILITY_GAP_EXPECT_REJECT',
    },
    results: run1.negativeResults,
    details: run1.negativeDetails,
  });

  writeJson(path.join(outputDir, 'positive-results.json'), {
    target: {
      NEXT_TZ_POSITIVE_01: 'SHORTCUT_REGISTRY_CONSISTENT_WITH_COMMANDS',
      NEXT_TZ_POSITIVE_02: 'MENU_AND_PALETTE_DISCOVERABILITY_CONSISTENT',
      NEXT_TZ_POSITIVE_03: 'SHORTCUT_BEHAVIOR_DETERMINISTIC',
    },
    results: run1.positiveResults,
    details: {
      baseline: {
        entryCount: run1.counts.entryCount,
        projectionHash: run1.baseline.projectionHash,
      },
      determinism: run1.determinism,
      shortcutConflicts: run1.baseline.shortcutConflicts,
      menuHintMismatch: run1.baseline.menuHintMismatch,
      paletteDiscoverabilityGaps: run1.baseline.paletteDiscoverabilityGaps,
    },
  });

  writeJson(path.join(outputDir, 'shortcut-discoverability-summary.json'), {
    entryCount: run1.counts.entryCount,
    requiredGroupCount: run1.counts.requiredGroupCount,
    requiredShortcutCommandCount: run1.counts.requiredShortcutCommandCount,
    shortcutConflictCount: run1.counts.shortcutConflictCount,
    commandBindingGapCount: run1.counts.commandBindingGapCount,
    capabilityBindingGapCount: run1.counts.capabilityBindingGapCount,
    actionBindingMismatchCount: run1.counts.actionBindingMismatchCount,
    menuHintMismatchCount: run1.counts.menuHintMismatchCount,
    paletteDiscoverabilityGapCount: run1.counts.paletteDiscoverabilityGapCount,
    modeProfileVisibilityGapCount: run1.counts.modeProfileVisibilityGapCount,
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
    finalGate: summary.status === 'PASS' ? 'GO_TO_X18_WS02' : 'HOLD',
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

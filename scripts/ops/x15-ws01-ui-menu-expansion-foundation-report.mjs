#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { evaluateX15Ws01UiMenuExpansionFoundationState } from './x15-ws01-ui-menu-expansion-foundation-state.mjs';

const DEFAULT_OUTPUT_DIR = 'docs/OPS/EVIDENCE/X15_CONTOUR/TICKET_01';
const DEFAULT_STATUS_PATH = 'docs/OPS/STATUS/X15_WS01_UI_MENU_EXPANSION_FOUNDATION_v1.json';

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
    token: state.X15_WS01_UI_MENU_EXPANSION_FOUNDATION_OK,
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

  const run1 = evaluateX15Ws01UiMenuExpansionFoundationState({ repoRoot });
  const run2 = evaluateX15Ws01UiMenuExpansionFoundationState({ repoRoot });
  const run3 = evaluateX15Ws01UiMenuExpansionFoundationState({ repoRoot });

  const repeatabilityStable = stableStringify(comparableState(run1)) === stableStringify(comparableState(run2))
    && stableStringify(comparableState(run2)) === stableStringify(comparableState(run3));

  const generatedAtUtc = new Date().toISOString();

  const summary = {
    status: run1.ok && repeatabilityStable ? 'PASS' : 'FAIL',
    runId: args.runId || process.env.RUN_ID || '',
    ticketId: args.ticketId || process.env.TICKET_ID || '',
    objective: 'НАЧАТЬ_КОНТРОЛИРУЕМОЕ_РАСШИРЕНИЕ_ИНТЕРФЕЙСА_И_МЕНЮ_БЕЗ_ВЛИЯНИЯ_НА_CORE_INVARIANTS',
    blockingSurfaceExpansion: false,
    counts: run1.counts,
    negativeResults: run1.negativeResults,
    positiveResults: run1.positiveResults,
    dod: {
      ...run1.dod,
      NEXT_TZ_DOD_04: repeatabilityStable,
      NEXT_TZ_DOD_05: run1.drift.advisoryToBlockingDriftCountZero,
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
    token: 'X15_WS01_UI_MENU_EXPANSION_FOUNDATION_OK',
    menuLayerCount: summary.counts.menuLayerCount,
    allowlistCommandCount: summary.counts.allowlistCommandCount,
    capabilityOverlapMismatchCount: summary.counts.capabilityOverlapMismatchCount,
    missingHiddenAllowlistCommandsCount: summary.counts.missingHiddenAllowlistCommandsCount,
    missingRequiredCoreCommandsCount: summary.counts.missingRequiredCoreCommandsCount,
    advisoryToBlockingDriftCount: summary.counts.advisoryToBlockingDriftCount,
    repeatabilityStable3Runs: repeatabilityStable,
    status: summary.status,
    updatedAtUtc: generatedAtUtc,
  };

  writeJson(statusPath, statusDoc);

  writeJson(path.join(outputDir, 'negative-results.json'), {
    target: {
      NEXT_TZ_NEGATIVE_01: 'MENU_ITEM_OUTSIDE_ALLOWLIST_EXPECT_REJECT',
      NEXT_TZ_NEGATIVE_02: 'UI_CHANGE_TRIES_TO_ALTER_CORE_CONTRACT_EXPECT_REJECT',
      NEXT_TZ_NEGATIVE_03: 'MODE_VISIBILITY_CONFLICT_EXPECT_REJECT',
      NEXT_TZ_NEGATIVE_04: 'PROFILE_OVERRIDE_BREAKS_CAPABILITY_POLICY_EXPECT_REJECT',
      NEXT_TZ_NEGATIVE_05: 'PLUGIN_OVERLAY_WITHOUT_MANIFEST_RULE_EXPECT_REJECT',
    },
    results: run1.negativeResults,
    details: run1.negativeDetails,
  });

  writeJson(path.join(outputDir, 'positive-results.json'), {
    target: {
      NEXT_TZ_POSITIVE_01: 'MENU_EXPANSION_WORKS_IN_ALLOWED_LAYERS',
      NEXT_TZ_POSITIVE_02: 'WRITE_PLAN_REVIEW_SHELL_SWITCHING_STABLE',
      NEXT_TZ_POSITIVE_03: 'COMMAND_VISIBILITY_AND_CAPABILITY_POLICY_CONSISTENT',
    },
    results: run1.positiveResults,
    details: {
      layerState: run1.layerState,
      modeShellState: run1.modeShellState,
      capabilitySyncState: run1.capabilitySyncState,
    },
  });

  writeJson(path.join(outputDir, 'ui-menu-foundation-summary.json'), {
    menuLayerCount: run1.counts.menuLayerCount,
    allowlistCommandCount: run1.counts.allowlistCommandCount,
    capabilityOverlapMismatchCount: run1.counts.capabilityOverlapMismatchCount,
    missingHiddenAllowlistCommandsCount: run1.counts.missingHiddenAllowlistCommandsCount,
    missingRequiredCoreCommandsCount: run1.counts.missingRequiredCoreCommandsCount,
    layerState: run1.layerState,
    modeShellState: run1.modeShellState,
    capabilitySyncState: run1.capabilitySyncState,
  });

  writeJson(path.join(outputDir, 'repeatability-summary.json'), {
    stable: repeatabilityStable,
    runs: [comparableState(run1), comparableState(run2), comparableState(run3)],
  });

  writeJson(path.join(outputDir, 'final-dod-acceptance-summary.json'), {
    dod: summary.dod,
    acceptance: summary.acceptance,
    finalGate: summary.status === 'PASS' ? 'GO_TO_X15_WS02' : 'HOLD',
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

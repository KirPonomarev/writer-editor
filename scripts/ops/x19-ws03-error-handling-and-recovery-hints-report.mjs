#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { evaluateX19Ws03ErrorHandlingAndRecoveryHintsState } from './x19-ws03-error-handling-and-recovery-hints-state.mjs';

const DEFAULT_OUTPUT_DIR = 'docs/OPS/EVIDENCE/X19_CONTOUR/TICKET_03';
const DEFAULT_STATUS_PATH = 'docs/OPS/STATUS/X19_WS03_ERROR_HANDLING_AND_RECOVERY_HINTS_v1.json';

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
    token: state.X19_WS03_ERROR_HANDLING_AND_RECOVERY_HINTS_OK,
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

  const run1 = evaluateX19Ws03ErrorHandlingAndRecoveryHintsState({ repoRoot });
  const run2 = evaluateX19Ws03ErrorHandlingAndRecoveryHintsState({ repoRoot });
  const run3 = evaluateX19Ws03ErrorHandlingAndRecoveryHintsState({ repoRoot });

  const repeatabilityStable = stableStringify(comparableState(run1)) === stableStringify(comparableState(run2))
    && stableStringify(comparableState(run2)) === stableStringify(comparableState(run3));

  const generatedAtUtc = new Date().toISOString();

  const summary = {
    status: run1.ok && repeatabilityStable ? 'PASS' : 'FAIL',
    runId: args.runId || process.env.RUN_ID || '',
    ticketId: args.ticketId || process.env.TICKET_ID || '',
    objective: 'IMPROVE_ERROR_HANDLING_AND_RECOVERY_HINTS_IN_ENTRY_AND_RESUME_FLOWS_WITHOUT_CORE_CHANGES',
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
    token: 'X19_WS03_ERROR_HANDLING_AND_RECOVERY_HINTS_OK',
    entryCount: summary.counts.entryCount,
    requiredErrorSignalCount: summary.counts.requiredErrorSignalCount,
    requiredRecoveryPathErrorCodeCount: summary.counts.requiredRecoveryPathErrorCodeCount,
    hintMappingGapCount: summary.counts.hintMappingGapCount,
    recoveryHintGapCount: summary.counts.recoveryHintGapCount,
    sourceEventGapCount: summary.counts.sourceEventGapCount,
    commandBindingGapCount: summary.counts.commandBindingGapCount,
    capabilityBindingGapCount: summary.counts.capabilityBindingGapCount,
    modeProfileVisibilityGapCount: summary.counts.modeProfileVisibilityGapCount,
    statusResetGapCount: summary.counts.statusResetGapCount,
    channelErrorFeedbackInconsistencyCount: summary.counts.channelErrorFeedbackInconsistencyCount,
    requiredErrorSignalGapCount: summary.counts.requiredErrorSignalGapCount,
    requiredRecoveryPathErrorCodeGapCount: summary.counts.requiredRecoveryPathErrorCodeGapCount,
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
      NEXT_TZ_NEGATIVE_01: 'ERROR_WITHOUT_HINT_MAPPING_EXPECT_REJECT',
      NEXT_TZ_NEGATIVE_02: 'STALE_PATH_ERROR_WITHOUT_RECOVERY_HINT_EXPECT_REJECT',
      NEXT_TZ_NEGATIVE_03: 'MODE_PROFILE_INVALID_ERROR_VISIBILITY_EXPECT_REJECT',
      NEXT_TZ_NEGATIVE_04: 'ERROR_STATE_NOT_RESET_EXPECT_REJECT',
      NEXT_TZ_NEGATIVE_05: 'CHANNEL_ERROR_FEEDBACK_INCONSISTENCY_EXPECT_REJECT',
    },
    results: run1.negativeResults,
    details: run1.negativeDetails,
  });

  writeJson(path.join(outputDir, 'positive-results.json'), {
    target: {
      NEXT_TZ_POSITIVE_01: 'ERROR_TO_HINT_MAPPING_COMPLETE_FOR_TARGET_FLOW',
      NEXT_TZ_POSITIVE_02: 'RECOVERY_HINTS_PRESENT_AND_CONSISTENT',
      NEXT_TZ_POSITIVE_03: 'ERROR_FEEDBACK_BEHAVIOR_DETERMINISTIC',
    },
    results: run1.positiveResults,
    details: {
      baseline: {
        entryCount: run1.counts.entryCount,
        projectionHash: run1.baseline.projectionHash,
      },
      determinism: run1.determinism,
      hintMappingMissing: run1.baseline.hintMappingMissing,
      recoveryHintMissing: run1.baseline.recoveryHintMissing,
      statusResetGaps: run1.baseline.statusResetGaps,
      channelErrorFeedbackInconsistency: run1.baseline.channelErrorFeedbackInconsistency,
    },
  });

  writeJson(path.join(outputDir, 'error-recovery-hints-summary.json'), {
    entryCount: run1.counts.entryCount,
    requiredErrorSignalCount: run1.counts.requiredErrorSignalCount,
    requiredRecoveryPathErrorCodeCount: run1.counts.requiredRecoveryPathErrorCodeCount,
    hintMappingGapCount: run1.counts.hintMappingGapCount,
    recoveryHintGapCount: run1.counts.recoveryHintGapCount,
    sourceEventGapCount: run1.counts.sourceEventGapCount,
    commandBindingGapCount: run1.counts.commandBindingGapCount,
    capabilityBindingGapCount: run1.counts.capabilityBindingGapCount,
    modeProfileVisibilityGapCount: run1.counts.modeProfileVisibilityGapCount,
    statusResetGapCount: run1.counts.statusResetGapCount,
    channelErrorFeedbackInconsistencyCount: run1.counts.channelErrorFeedbackInconsistencyCount,
    requiredErrorSignalGapCount: run1.counts.requiredErrorSignalGapCount,
    requiredRecoveryPathErrorCodeGapCount: run1.counts.requiredRecoveryPathErrorCodeGapCount,
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
    finalGate: summary.status === 'PASS' ? 'GO_TO_X19_WS04_ONLY_IF_ALL_DOD_AND_ACCEPTANCE_TRUE' : 'HOLD',
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

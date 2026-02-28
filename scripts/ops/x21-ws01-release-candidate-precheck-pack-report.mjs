#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { evaluateX21Ws01ReleaseCandidatePrecheckPackState } from './x21-ws01-release-candidate-precheck-pack-state.mjs';

const DEFAULT_OUTPUT_DIR = 'docs/OPS/EVIDENCE/X21_CONTOUR/TICKET_01';
const DEFAULT_STATUS_PATH = 'docs/OPS/STATUS/X21_WS01_RELEASE_CANDIDATE_PRECHECK_PACK_v1.json';

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
    token: state.X21_WS01_RELEASE_CANDIDATE_PRECHECK_PACK_OK,
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

  const run1 = evaluateX21Ws01ReleaseCandidatePrecheckPackState({ repoRoot });
  const run2 = evaluateX21Ws01ReleaseCandidatePrecheckPackState({ repoRoot });
  const run3 = evaluateX21Ws01ReleaseCandidatePrecheckPackState({ repoRoot });

  const repeatabilityStable = stableStringify(comparableState(run1)) === stableStringify(comparableState(run2))
    && stableStringify(comparableState(run2)) === stableStringify(comparableState(run3));

  const generatedAtUtc = new Date().toISOString();

  const summary = {
    status: run1.ok && repeatabilityStable ? 'PASS' : 'FAIL',
    runId: args.runId || process.env.RUN_ID || '',
    ticketId: args.ticketId || process.env.TICKET_ID || '',
    objective: 'BUILD_RELEASE_CANDIDATE_PRECHECK_PACK_FOR_ACTIVE_CANON_MODE_MATRIX_TOKEN_BINDING_AND_USABILITY_GUARDS',
    blockingSurfaceExpansion: false,
    counts: run1.counts,
    negativeResults: run1.negativeResults,
    positiveResults: run1.positiveResults,
    dod: {
      ...run1.dod,
      NEXT_TZ_DOD_04: repeatabilityStable,
      NEXT_TZ_DOD_05: true,
      NEXT_TZ_DOD_06: run1.counts.advisoryToBlockingDriftCount === 0,
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
    token: 'X21_WS01_RELEASE_CANDIDATE_PRECHECK_PACK_OK',
    requiredReleaseBlockingTokenCount: summary.counts.requiredReleaseBlockingTokenCount,
    releaseBindingMissingTokenCount: summary.counts.releaseBindingMissingTokenCount,
    releaseBindingMissingRecordCount: summary.counts.releaseBindingMissingRecordCount,
    releaseBindingMissingFieldCount: summary.counts.releaseBindingMissingFieldCount,
    releaseBindingFailSignalMissingCount: summary.counts.releaseBindingFailSignalMissingCount,
    releaseBindingFailSignalMismatchCount: summary.counts.releaseBindingFailSignalMismatchCount,
    modeMatrixDuplicateSignalCount: summary.counts.modeMatrixDuplicateSignalCount,
    modeMatrixMissingDispositionCount: summary.counts.modeMatrixMissingDispositionCount,
    modeMatrixInvalidDispositionCount: summary.counts.modeMatrixInvalidDispositionCount,
    modeMatrixBlockingFlagConflictCount: summary.counts.modeMatrixBlockingFlagConflictCount,
    modeMatrixRequiredTokenFailSignalMissingCount: summary.counts.modeMatrixRequiredTokenFailSignalMissingCount,
    advisoryToBlockingDriftCount: summary.counts.advisoryToBlockingDriftCount,
    offlineIntegrityIssueCount: summary.counts.offlineIntegrityIssueCount,
    usabilityGuardIssueCount: summary.counts.usabilityGuardIssueCount,
    requiredModeKeyCount: summary.counts.requiredModeKeyCount,
    repeatabilityStable3Runs: repeatabilityStable,
    status: summary.status,
    updatedAtUtc: generatedAtUtc,
  };

  writeJson(statusPath, statusDoc);

  writeJson(path.join(outputDir, 'negative-results.json'), {
    target: {
      NEXT_TZ_NEGATIVE_01: 'MISSING_BLOCKING_ENTITY_BINDING_EXPECT_REJECT',
      NEXT_TZ_NEGATIVE_02: 'MODE_DISPOSITION_MISMATCH_EXPECT_REJECT',
      NEXT_TZ_NEGATIVE_03: 'OFFLINE_INTEGRITY_CHECK_FAIL_EXPECT_REJECT',
      NEXT_TZ_NEGATIVE_04: 'USABILITY_GUARD_PACK_GAP_EXPECT_REJECT',
      NEXT_TZ_NEGATIVE_05: 'NON_DETERMINISTIC_PRECHECK_OUTPUT_EXPECT_REJECT',
    },
    results: run1.negativeResults,
    details: run1.negativeDetails,
  });

  writeJson(path.join(outputDir, 'positive-results.json'), {
    target: {
      NEXT_TZ_POSITIVE_01: 'PRECHECK_PACK_COVERS_REQUIRED_RELEASE_SURFACE',
      NEXT_TZ_POSITIVE_02: 'PRECHECK_RESULTS_CONSISTENT_WITH_ACTIVE_CANON',
      NEXT_TZ_POSITIVE_03: 'PRECHECK_OUTPUT_DETERMINISTIC',
    },
    results: run1.positiveResults,
    details: {
      releaseBinding: run1.baseline.releaseBinding,
      modeMatrix: {
        ok: run1.baseline.modeMatrix.ok,
        advisoryToBlockingDriftCases: run1.baseline.modeMatrix.advisoryToBlockingDriftCases,
      },
      offlineIntegrity: run1.baseline.offlineIntegrity,
      usabilityGuardPack: run1.baseline.usabilityGuardPack,
      determinism: run1.determinism,
    },
  });

  writeJson(path.join(outputDir, 'release-precheck-summary.json'), {
    requiredReleaseBlockingTokenCount: run1.counts.requiredReleaseBlockingTokenCount,
    releaseBindingMissingTokenCount: run1.counts.releaseBindingMissingTokenCount,
    releaseBindingMissingRecordCount: run1.counts.releaseBindingMissingRecordCount,
    releaseBindingMissingFieldCount: run1.counts.releaseBindingMissingFieldCount,
    releaseBindingFailSignalMissingCount: run1.counts.releaseBindingFailSignalMissingCount,
    releaseBindingFailSignalMismatchCount: run1.counts.releaseBindingFailSignalMismatchCount,
    modeMatrixDuplicateSignalCount: run1.counts.modeMatrixDuplicateSignalCount,
    modeMatrixMissingDispositionCount: run1.counts.modeMatrixMissingDispositionCount,
    modeMatrixInvalidDispositionCount: run1.counts.modeMatrixInvalidDispositionCount,
    modeMatrixBlockingFlagConflictCount: run1.counts.modeMatrixBlockingFlagConflictCount,
    modeMatrixRequiredTokenFailSignalMissingCount: run1.counts.modeMatrixRequiredTokenFailSignalMissingCount,
    advisoryToBlockingDriftCount: run1.counts.advisoryToBlockingDriftCount,
    offlineIntegrityIssueCount: run1.counts.offlineIntegrityIssueCount,
    usabilityGuardIssueCount: run1.counts.usabilityGuardIssueCount,
    requiredModeKeyCount: run1.counts.requiredModeKeyCount,
    releaseBinding: run1.baseline.releaseBinding,
    modeMatrix: run1.baseline.modeMatrix,
    offlineIntegrity: run1.baseline.offlineIntegrity,
    usabilityGuardPack: run1.baseline.usabilityGuardPack,
    detector: run1.detector,
  });

  writeJson(path.join(outputDir, 'repeatability-summary.json'), {
    stable: repeatabilityStable,
    runs: [comparableState(run1), comparableState(run2), comparableState(run3)],
  });

  writeJson(path.join(outputDir, 'final-dod-acceptance-summary.json'), {
    dod: summary.dod,
    acceptance: summary.acceptance,
    finalGate: summary.status === 'PASS' ? 'GO_TO_X21_WS02_ONLY_IF_ALL_DOD_AND_ACCEPTANCE_TRUE' : 'HOLD',
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

#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { evaluateFullCrossPlatformParityState } from './full-cross-platform-parity-state.mjs';

const DEFAULT_OUTPUT_DIR = 'docs/OPS/EVIDENCE/P2_CONTOUR/TICKET_05';
const DEFAULT_STATUS_PATH = 'docs/OPS/STATUS/FULL_CROSS_PLATFORM_PARITY_EXPANSION_v3.json';
const DEFAULT_FAILSIGNAL_REGISTRY_PATH = 'docs/OPS/FAILSIGNALS/FAILSIGNAL_REGISTRY.json';

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

function parseArgs(argv = process.argv.slice(2)) {
  const out = {
    outputDir: DEFAULT_OUTPUT_DIR,
    statusPath: DEFAULT_STATUS_PATH,
    runId: '',
    ticketId: '',
    failsignalRegistryPath: DEFAULT_FAILSIGNAL_REGISTRY_PATH,
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
      continue;
    }

    if (arg === '--failsignal-registry-path' && i + 1 < argv.length) {
      out.failsignalRegistryPath = normalizeString(argv[i + 1]) || DEFAULT_FAILSIGNAL_REGISTRY_PATH;
      i += 1;
      continue;
    }
    if (arg.startsWith('--failsignal-registry-path=')) {
      out.failsignalRegistryPath = normalizeString(arg.slice('--failsignal-registry-path='.length)) || DEFAULT_FAILSIGNAL_REGISTRY_PATH;
    }
  }

  return out;
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${stableStringify(value)}\n`, 'utf8');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = process.cwd();
  const outputDir = path.resolve(repoRoot, args.outputDir);
  const statusPath = path.resolve(repoRoot, args.statusPath);

  const state = evaluateFullCrossPlatformParityState({
    repoRoot,
    failsignalRegistryPath: path.resolve(repoRoot, args.failsignalRegistryPath),
  });

  const gates = {
    p2_05_platform_parity_matrix_complete_check: state.matrixState.ok ? 'PASS' : 'FAIL',
    p2_05_release_critical_paths_parity_check: state.parityState.ok ? 'PASS' : 'FAIL',
    p2_05_cross_platform_negative_cases_check: state.negativeState.ok ? 'PASS' : 'FAIL',
    p2_05_gap_report_zero_for_release_critical_check: state.gapState.ok ? 'PASS' : 'FAIL',
    mc_advisory_blocking_drift_zero: state.advisoryToBlockingDriftCountZero ? 'PASS' : 'FAIL',
  };

  const status = Object.values(gates).every((value) => value === 'PASS') ? 'PASS' : 'FAIL';
  const generatedAtUtc = new Date().toISOString();

  const summary = {
    status,
    runId: args.runId || process.env.RUN_ID || '',
    ticketId: args.ticketId || process.env.TICKET_ID || '',
    platformsCovered: state.matrixState.requiredPlatforms,
    releaseCriticalPaths: state.matrixState.releaseCriticalPaths,
    parityMismatchCount: state.parityState.mismatches.length,
    totalMissingPaths: state.gapState.totalMissingPaths,
    totalFailingPaths: state.gapState.totalFailingPaths,
    advisoryToBlockingDriftCount: state.advisoryToBlockingDriftCount,
    singleBlockingAuthorityOk: state.singleBlockingAuthority.ok,
    gates,
    generatedAtUtc,
  };

  writeJson(statusPath, {
    version: 3,
    token: 'FULL_CROSS_PLATFORM_PARITY_EXPANSION_OK',
    evaluatorId: 'CANONICAL_MODE_MATRIX_EVALUATOR_V1',
    platformsCovered: summary.platformsCovered,
    releaseCriticalPaths: summary.releaseCriticalPaths,
    parityMismatchCount: summary.parityMismatchCount,
    totalMissingPaths: summary.totalMissingPaths,
    totalFailingPaths: summary.totalFailingPaths,
    advisoryToBlockingDriftCount: summary.advisoryToBlockingDriftCount,
    gates,
    status,
    updatedAtUtc: generatedAtUtc,
  });

  writeJson(path.join(outputDir, 'platform-parity-matrix.json'), {
    platformParityMatrixCompleteCheck: state.matrixState.ok,
    requiredPlatforms: state.matrixState.requiredPlatforms,
    releaseCriticalPaths: state.matrixState.releaseCriticalPaths,
    matrix: state.matrixState.matrix,
    missingPlatforms: state.matrixState.missingPlatforms,
    unexpectedPlatforms: state.matrixState.unexpectedPlatforms,
    incompletePaths: state.matrixState.incompletePaths,
  });

  writeJson(path.join(outputDir, 'web-win-linux-android-ios-fixtures.json'), state.fixtureDoc);

  writeJson(path.join(outputDir, 'cross-platform-gap-report.json'), {
    releaseCriticalPathsParityCheck: state.parityState.ok,
    gapReportZeroForReleaseCriticalCheck: state.gapState.ok,
    parityState: state.parityState,
    gapState: state.gapState,
  });

  writeJson(path.join(outputDir, 'cross-platform-negative-cases.json'), {
    crossPlatformNegativeCasesCheck: state.negativeState.ok,
    cases: state.negativeState.cases,
  });

  writeJson(path.join(outputDir, 'advisory-blocking-drift-cases.json'), {
    advisoryToBlockingDriftCount: state.advisoryToBlockingDriftCount,
    advisoryToBlockingDriftCountZero: state.advisoryToBlockingDriftCountZero,
    driftCases: state.driftCases,
  });

  writeJson(path.join(outputDir, 'summary.json'), summary);
  writeJson(path.join(outputDir, 'ticket-meta.json'), {
    runId: summary.runId,
    ticketId: summary.ticketId,
    outputDir: path.relative(repoRoot, outputDir).replaceAll(path.sep, '/'),
    generatedAtUtc,
  });

  process.stdout.write(`${stableStringify(summary)}\n`);
  process.exit(status === 'PASS' ? 0 : 1);
}

main();

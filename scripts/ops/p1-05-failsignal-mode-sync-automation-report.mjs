#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { evaluateFailsignalModeSyncAutomationState } from './failsignal-mode-sync-automation-state.mjs';

const DEFAULT_OUTPUT_DIR = 'docs/OPS/EVIDENCE/P1_CONTOUR/TICKET_05';
const DEFAULT_STATUS_PATH = 'docs/OPS/STATUS/FAILSIGNAL_MODE_SYNC_AUTOMATION_v3.json';
const DEFAULT_FAILSIGNAL_REGISTRY_PATH = 'docs/OPS/FAILSIGNALS/FAILSIGNAL_REGISTRY.json';
const DEFAULT_TOKEN_CATALOG_PATH = 'docs/OPS/TOKENS/TOKEN_CATALOG.json';

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
    failsignalRegistryPath: DEFAULT_FAILSIGNAL_REGISTRY_PATH,
    tokenCatalogPath: DEFAULT_TOKEN_CATALOG_PATH,
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

    if (arg === '--failsignal-registry-path' && i + 1 < argv.length) {
      out.failsignalRegistryPath = normalizeString(argv[i + 1]) || DEFAULT_FAILSIGNAL_REGISTRY_PATH;
      i += 1;
      continue;
    }
    if (arg.startsWith('--failsignal-registry-path=')) {
      out.failsignalRegistryPath = normalizeString(arg.slice('--failsignal-registry-path='.length)) || DEFAULT_FAILSIGNAL_REGISTRY_PATH;
      continue;
    }

    if (arg === '--token-catalog-path' && i + 1 < argv.length) {
      out.tokenCatalogPath = normalizeString(argv[i + 1]) || DEFAULT_TOKEN_CATALOG_PATH;
      i += 1;
      continue;
    }
    if (arg.startsWith('--token-catalog-path=')) {
      out.tokenCatalogPath = normalizeString(arg.slice('--token-catalog-path='.length)) || DEFAULT_TOKEN_CATALOG_PATH;
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

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${stableStringify(value)}\n`, 'utf8');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = process.cwd();
  const outputDir = path.resolve(repoRoot, args.outputDir);
  const statusPath = path.resolve(repoRoot, args.statusPath);

  const state = evaluateFailsignalModeSyncAutomationState({
    repoRoot,
    failsignalRegistryPath: path.resolve(repoRoot, args.failsignalRegistryPath),
    tokenCatalogPath: path.resolve(repoRoot, args.tokenCatalogPath),
  });

  const gates = {
    p1_05_failsignal_has_explicit_pr_release_promotion_disposition_check: state.highImpactExplicitDispositionCheck ? 'PASS' : 'FAIL',
    p1_05_blocking_flag_mode_disposition_conflict_zero_check: state.blockingFlagConflictZeroCheck ? 'PASS' : 'FAIL',
    p1_05_sync_automation_updates_outdated_mode_disposition_check: state.modeSyncAutomationAppliedCheck ? 'PASS' : 'FAIL',
    p1_05_mode_matrix_inconsistency_returns_stop_check: state.modeMatrixInconsistencyStopCheck ? 'PASS' : 'FAIL',
    mc_advisory_blocking_drift_zero: state.advisoryToBlockingDriftCountZero ? 'PASS' : 'FAIL',
  };

  const status = Object.values(gates).every((value) => value === 'PASS') ? 'PASS' : 'FAIL';
  const generatedAtUtc = new Date().toISOString();

  const summary = {
    status,
    runId: args.runId || process.env.RUN_ID || '',
    ticketId: args.ticketId || process.env.TICKET_ID || '',
    highImpactFailSignalCount: state.highImpactFailSignalCount,
    syncAppliedCount: state.syncAppliedCount,
    modeMatrixInconsistencyBeforeCount: state.modeMatrixInconsistencyBeforeCount,
    modeMatrixInconsistencyAfterCount: state.modeMatrixInconsistencyAfterCount,
    advisoryToBlockingDriftCount: state.advisoryToBlockingDriftCount,
    singleBlockingAuthorityOk: state.singleBlockingAuthority.ok,
    gates,
    generatedAtUtc,
  };

  writeJson(statusPath, {
    version: 3,
    token: 'FAILSIGNAL_MODE_SYNC_AUTOMATION_OK',
    evaluatorId: 'CANONICAL_MODE_MATRIX_EVALUATOR_V1',
    highImpactFailSignalCount: state.highImpactFailSignalCount,
    syncAppliedCount: state.syncAppliedCount,
    modeMatrixInconsistencyBeforeCount: state.modeMatrixInconsistencyBeforeCount,
    modeMatrixInconsistencyAfterCount: state.modeMatrixInconsistencyAfterCount,
    advisoryToBlockingDriftCount: state.advisoryToBlockingDriftCount,
    gates,
    status,
    updatedAtUtc: generatedAtUtc,
  });

  writeJson(path.join(outputDir, 'failsignal-mode-sync-map.json'), {
    highImpactFailSignalCount: state.highImpactFailSignalCount,
    highImpactFailSignals: state.highImpactFailSignals,
    syncAppliedCount: state.syncAppliedCount,
    syncUpdates: state.syncUpdates,
    failsignalModeSyncMap: state.failsignalModeSyncMap,
  });

  writeJson(path.join(outputDir, 'failsignal-mode-drift-cases.json'), {
    modeMatrixInconsistencyBeforeCount: state.modeMatrixInconsistencyBeforeCount,
    modeMatrixInconsistencyAfterCount: state.modeMatrixInconsistencyAfterCount,
    blockingFlagConflictsBefore: state.blockingFlagConflictsBefore,
    blockingFlagConflictsAfter: state.blockingFlagConflictsAfter,
    highImpactMissingDisposition: state.highImpactMissingDisposition,
    modeMatrixInconsistencyAfter: state.modeMatrixInconsistencyAfter,
  });

  writeJson(path.join(outputDir, 'failsignal-mode-sync-proof.json'), {
    modeSyncAutomationAppliedCheck: state.modeSyncAutomationAppliedCheck,
    modeMatrixInconsistencyStopCheck: state.modeMatrixInconsistencyStopCheck,
    modeMatrixInconsistencyNegative: state.modeMatrixInconsistencyNegative,
    highImpactExplicitDispositionCheck: state.highImpactExplicitDispositionCheck,
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

#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { evaluateHotpathAcceptanceGuardState } from './hotpath-acceptance-guard-state.mjs';

const DEFAULT_OUTPUT_DIR = 'docs/OPS/EVIDENCE/P2_CONTOUR/TICKET_04';
const DEFAULT_STATUS_PATH = 'docs/OPS/STATUS/HOTPATH_ACCEPTANCE_GUARD_v3.json';
const DEFAULT_FAILSIGNAL_REGISTRY_PATH = 'docs/OPS/FAILSIGNALS/FAILSIGNAL_REGISTRY.json';
const DEFAULT_HOTPATH_POLICY_PATH = 'scripts/perf/hotpath-policy.json';
const DEFAULT_PERF_THRESHOLDS_PATH = 'scripts/perf/perf-thresholds.json';

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
    hotpathPolicyPath: DEFAULT_HOTPATH_POLICY_PATH,
    perfThresholdsPath: DEFAULT_PERF_THRESHOLDS_PATH,
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
      continue;
    }

    if (arg === '--hotpath-policy-path' && i + 1 < argv.length) {
      out.hotpathPolicyPath = normalizeString(argv[i + 1]) || DEFAULT_HOTPATH_POLICY_PATH;
      i += 1;
      continue;
    }
    if (arg.startsWith('--hotpath-policy-path=')) {
      out.hotpathPolicyPath = normalizeString(arg.slice('--hotpath-policy-path='.length)) || DEFAULT_HOTPATH_POLICY_PATH;
      continue;
    }

    if (arg === '--perf-thresholds-path' && i + 1 < argv.length) {
      out.perfThresholdsPath = normalizeString(argv[i + 1]) || DEFAULT_PERF_THRESHOLDS_PATH;
      i += 1;
      continue;
    }
    if (arg.startsWith('--perf-thresholds-path=')) {
      out.perfThresholdsPath = normalizeString(arg.slice('--perf-thresholds-path='.length)) || DEFAULT_PERF_THRESHOLDS_PATH;
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

  const state = evaluateHotpathAcceptanceGuardState({
    repoRoot,
    failsignalRegistryPath: path.resolve(repoRoot, args.failsignalRegistryPath),
    hotpathPolicyPath: path.resolve(repoRoot, args.hotpathPolicyPath),
    perfThresholdsPath: path.resolve(repoRoot, args.perfThresholdsPath),
  });

  const gates = {
    p2_04_no_full_document_rerender_per_keystroke_check: state.noFullDocumentRerenderPerKeystrokeCheck ? 'PASS' : 'FAIL',
    p2_04_input_p95_within_threshold_check: state.inputP95WithinThresholdCheck ? 'PASS' : 'FAIL',
    p2_04_autosave_backup_nonblocking_check: state.autosaveBackupNonblockingCheck ? 'PASS' : 'FAIL',
    p2_04_threshold_ssot_lock_check: state.thresholdSsotLockCheck ? 'PASS' : 'FAIL',
    mc_advisory_blocking_drift_zero: state.advisoryToBlockingDriftCountZero ? 'PASS' : 'FAIL',
  };

  const status = Object.values(gates).every((value) => value === 'PASS') ? 'PASS' : 'FAIL';
  const generatedAtUtc = new Date().toISOString();

  const summary = {
    status,
    runId: args.runId || process.env.RUN_ID || '',
    ticketId: args.ticketId || process.env.TICKET_ID || '',
    noFullDocumentRerenderPerKeystroke: state.noFullDocumentRerenderPerKeystrokeCheck,
    inputP95ThresholdMs: state.thresholds.inputP95ThresholdMs,
    inputP95MeasuredMs: state.baseState.inputP95Check.measuredP95Ms,
    longTaskBudgetMs: state.longTaskBudgetProof.longTaskBudgetMs,
    maxSampleMs: state.longTaskBudgetProof.maxSampleMs,
    autosaveBackupTypingBlockThresholdMs: state.autosaveBackupTypingBlockThresholdProof.autosaveBackupTypingBlockThresholdMs,
    advisoryToBlockingDriftCount: state.advisoryToBlockingDriftCount,
    thresholdSsotLockSha256: state.thresholdSsotLock.sourceLockSha256,
    gates,
    generatedAtUtc,
  };

  writeJson(statusPath, {
    version: 3,
    token: 'HOTPATH_ACCEPTANCE_GUARD_OK',
    evaluatorId: 'CANONICAL_MODE_MATRIX_EVALUATOR_V1',
    noFullDocumentRerenderPerKeystroke: summary.noFullDocumentRerenderPerKeystroke,
    inputP95ThresholdMs: summary.inputP95ThresholdMs,
    inputP95MeasuredMs: summary.inputP95MeasuredMs,
    longTaskBudgetMs: summary.longTaskBudgetMs,
    maxSampleMs: summary.maxSampleMs,
    autosaveBackupTypingBlockThresholdMs: summary.autosaveBackupTypingBlockThresholdMs,
    advisoryToBlockingDriftCount: summary.advisoryToBlockingDriftCount,
    thresholdSsotLockSha256: summary.thresholdSsotLockSha256,
    gates,
    status,
    updatedAtUtc: generatedAtUtc,
  });

  writeJson(path.join(outputDir, 'hotpath-acceptance-thresholds.json'), {
    thresholdSsotLockCheck: state.thresholdSsotLockCheck,
    sourceLockSha256: state.thresholdSsotLock.sourceLockSha256,
    sourcePayload: state.thresholdSsotLock.sourcePayload,
    thresholds: state.thresholdSsotLock.thresholds,
  });

  writeJson(path.join(outputDir, 'hotpath-long-task-budget-proof.json'), {
    longTaskBudgetProof: state.longTaskBudgetProof,
    inputP95Check: state.baseState.inputP95Check,
  });

  writeJson(path.join(outputDir, 'autosave-backup-typing-block-threshold-proof.json'), {
    autosaveBackupTypingBlockThresholdProof: state.autosaveBackupTypingBlockThresholdProof,
    typingLoopNonBlockingCheck: state.baseState.typingLoopNonBlockingCheck,
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

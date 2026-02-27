#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { evaluateConcurrencyLockingState } from './concurrency-locking-state.mjs';

const DEFAULT_OUTPUT_DIR = 'docs/OPS/EVIDENCE/P2_CONTOUR/TICKET_06';
const DEFAULT_STATUS_PATH = 'docs/OPS/STATUS/CONCURRENCY_LOCKING_FOR_SHARED_GOVERNANCE_ARTIFACTS_v3.json';
const DEFAULT_PHASE_SWITCH_PATH = 'docs/OPS/STATUS/PHASE_SWITCH_V1.json';
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
    phaseSwitchPath: DEFAULT_PHASE_SWITCH_PATH,
    failsignalRegistryPath: DEFAULT_FAILSIGNAL_REGISTRY_PATH,
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

    if (arg === '--phase-switch-path' && i + 1 < argv.length) {
      out.phaseSwitchPath = normalizeString(argv[i + 1]) || DEFAULT_PHASE_SWITCH_PATH;
      i += 1;
      continue;
    }
    if (arg.startsWith('--phase-switch-path=')) {
      out.phaseSwitchPath = normalizeString(arg.slice('--phase-switch-path='.length)) || DEFAULT_PHASE_SWITCH_PATH;
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

  const state = evaluateConcurrencyLockingState({
    repoRoot,
    phaseSwitchPath: path.resolve(repoRoot, args.phaseSwitchPath),
    failsignalRegistryPath: path.resolve(repoRoot, args.failsignalRegistryPath),
  });

  const gates = {
    p2_06_lock_acquire_release_check: state.lockAcquireReleaseCheck ? 'PASS' : 'FAIL',
    p2_06_compare_and_swap_conflict_check: state.compareAndSwapConflictCheck ? 'PASS' : 'FAIL',
    p2_06_interleaving_protection_check: state.interleavingProtectionCheck ? 'PASS' : 'FAIL',
    p2_06_serialized_queue_enforcement_check: state.serializedQueueEnforcementCheck ? 'PASS' : 'FAIL',
    mc_advisory_blocking_drift_zero: state.advisoryToBlockingDriftCountZero ? 'PASS' : 'FAIL',
  };

  const status = Object.values(gates).every((value) => value === 'PASS') ? 'PASS' : 'FAIL';
  const generatedAtUtc = new Date().toISOString();

  const summary = {
    status,
    runId: args.runId || process.env.RUN_ID || '',
    ticketId: args.ticketId || process.env.TICKET_ID || '',
    lockAcquireReleaseCaseCount: state.lockAcquireReleaseCases.length,
    compareAndSwapCaseCount: state.compareAndSwapNegativeCases.length,
    interleavingCaseCount: state.interleavingProtectionCases.length,
    serializedQueueCaseCount: state.serializedQueueCases.length,
    advisoryToBlockingDriftCount: state.advisoryToBlockingDriftCount,
    singleBlockingAuthorityOk: state.singleBlockingAuthority.ok,
    gates,
    generatedAtUtc,
  };

  writeJson(statusPath, {
    version: 3,
    token: 'CONCURRENCY_LOCKING_FOR_SHARED_GOVERNANCE_ARTIFACTS_OK',
    evaluatorId: 'CANONICAL_MODE_MATRIX_EVALUATOR_V1',
    lockAcquireReleaseCaseCount: summary.lockAcquireReleaseCaseCount,
    compareAndSwapCaseCount: summary.compareAndSwapCaseCount,
    interleavingCaseCount: summary.interleavingCaseCount,
    serializedQueueCaseCount: summary.serializedQueueCaseCount,
    advisoryToBlockingDriftCount: summary.advisoryToBlockingDriftCount,
    gates,
    status,
    updatedAtUtc: generatedAtUtc,
  });

  writeJson(path.join(outputDir, 'lock-acquire-release-cases.json'), {
    p2_06_lock_acquire_release_check: state.lockAcquireReleaseCheck,
    cases: state.lockAcquireReleaseCases,
  });

  writeJson(path.join(outputDir, 'compare-and-swap-negative-cases.json'), {
    p2_06_compare_and_swap_conflict_check: state.compareAndSwapConflictCheck,
    cases: state.compareAndSwapNegativeCases,
  });

  writeJson(path.join(outputDir, 'interleaving-protection-proof.json'), {
    p2_06_interleaving_protection_check: state.interleavingProtectionCheck,
    p2_06_serialized_queue_enforcement_check: state.serializedQueueEnforcementCheck,
    interleavingCases: state.interleavingProtectionCases,
    serializedQueueCases: state.serializedQueueCases,
    coreArtifactsLockProof: state.coreArtifactsLockProof,
    phaseEnforcement: state.phaseEnforcement,
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

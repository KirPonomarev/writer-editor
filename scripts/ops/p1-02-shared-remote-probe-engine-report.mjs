#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {
  evaluateSharedRemoteProbeEngineState,
  DEFAULT_TTL_SECONDS,
} from './shared-remote-probe-engine-state.mjs';

const DEFAULT_OUTPUT_DIR = 'docs/OPS/EVIDENCE/P1_CONTOUR/TICKET_02';
const DEFAULT_STATUS_PATH = 'docs/OPS/STATUS/SHARED_REMOTE_PROBE_ENGINE_WITH_TTL_v3.json';
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
    ttlSeconds: DEFAULT_TTL_SECONDS,
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

    if (arg === '--ttl-seconds' && i + 1 < argv.length) {
      const parsed = Number.parseInt(normalizeString(argv[i + 1]), 10);
      if (Number.isInteger(parsed) && parsed > 0) out.ttlSeconds = parsed;
      i += 1;
      continue;
    }
    if (arg.startsWith('--ttl-seconds=')) {
      const parsed = Number.parseInt(normalizeString(arg.slice('--ttl-seconds='.length)), 10);
      if (Number.isInteger(parsed) && parsed > 0) out.ttlSeconds = parsed;
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

  const state = evaluateSharedRemoteProbeEngineState({
    repoRoot,
    failsignalRegistryPath: path.resolve(repoRoot, args.failsignalRegistryPath),
    ttlSeconds: args.ttlSeconds,
  });

  const gates = {
    p1_02_shared_remote_probe_single_engine_check: state.singleSource.ok ? 'PASS' : 'FAIL',
    p1_02_probe_ttl_600_seconds_check: state.ttlPolicy.ttlEquals600 ? 'PASS' : 'FAIL',
    p1_02_stale_invalidation_on_phase_change_check: state.staleInvalidation.onPhaseChange ? 'PASS' : 'FAIL',
    p1_02_stale_invalidation_on_main_sha_change_check: state.staleInvalidation.onMainShaChange ? 'PASS' : 'FAIL',
    p1_02_stale_invalidation_on_scope_delta_check: state.staleInvalidation.onScopeDelta ? 'PASS' : 'FAIL',
    p1_02_remote_probe_forbidden_in_interactive_paths_check: state.interactivePathGuard.ok ? 'PASS' : 'FAIL',
    mc_advisory_blocking_drift_zero: state.advisoryToBlockingDriftCountZero ? 'PASS' : 'FAIL',
  };

  const summary = {
    status: Object.values(gates).every((value) => value === 'PASS') ? 'PASS' : 'FAIL',
    runId: args.runId || process.env.RUN_ID || '',
    ticketId: args.ticketId || process.env.TICKET_ID || '',
    ttlSecondsConfigured: state.ttlSeconds,
    duplicateSignalCountBefore: state.reduction.duplicateSignalCountBefore,
    duplicateSignalCountAfter: state.reduction.duplicateSignalCountAfter,
    removedDuplicateSignalPaths: state.reduction.removedDuplicateSignalPaths,
    staleInvalidationOk: state.staleInvalidation.ok,
    interactivePathGuardOk: state.interactivePathGuard.ok,
    advisoryToBlockingDriftCount: state.advisoryToBlockingDriftCount,
    singleBlockingAuthorityOk: state.singleBlockingAuthority.ok,
    outputStable: state.outputStable,
    outputHash: state.outputHash,
    gates,
    generatedAtUtc: new Date().toISOString(),
  };

  const ticketMeta = {
    runId: summary.runId,
    ticketId: summary.ticketId,
    outputDir: path.relative(repoRoot, outputDir).replaceAll(path.sep, '/'),
    generatedAtUtc: summary.generatedAtUtc,
  };

  writeJson(statusPath, {
    version: 3,
    token: 'SHARED_REMOTE_PROBE_ENGINE_WITH_TTL_OK',
    evaluatorId: 'CANONICAL_MODE_MATRIX_EVALUATOR_V1',
    ttlSeconds: state.ttlSeconds,
    staleInvalidationRules: {
      onPhaseChange: state.staleInvalidation.onPhaseChange,
      onMainShaChange: state.staleInvalidation.onMainShaChange,
      onScopeDelta: state.staleInvalidation.onScopeDelta,
    },
    interactivePathGuard: {
      violatingCaseCount: state.interactivePathGuard.violatingCaseCount,
      ok: state.interactivePathGuard.ok,
    },
    duplicateSignalReduction: {
      before: state.reduction.duplicateSignalCountBefore,
      after: state.reduction.duplicateSignalCountAfter,
      removedDuplicateSignalPaths: state.reduction.removedDuplicateSignalPaths,
      reducedOrZeroRemaining: state.reduction.reducedOrZeroRemaining,
    },
    advisoryToBlockingDriftCount: state.advisoryToBlockingDriftCount,
    gates,
    status: summary.status,
    updatedAtUtc: summary.generatedAtUtc,
  });

  writeJson(path.join(outputDir, 'remote-probe-ttl-cases.json'), {
    ttlSecondsConfigured: state.ttlPolicy.ttlSecondsConfigured,
    ttlSecondsExpected: state.ttlPolicy.ttlSecondsExpected,
    ttlEquals600: state.ttlPolicy.ttlEquals600,
    cases: state.ttlPolicy.cases,
    policyEnforced: state.ttlPolicy.ok,
  });

  writeJson(path.join(outputDir, 'remote-probe-stale-invalidation-cases.json'), {
    onPhaseChange: state.staleInvalidation.onPhaseChange,
    onMainShaChange: state.staleInvalidation.onMainShaChange,
    onScopeDelta: state.staleInvalidation.onScopeDelta,
    cases: state.staleInvalidation.cases,
    policyEnforced: state.staleInvalidation.ok,
  });

  writeJson(path.join(outputDir, 'remote-probe-interactive-path-guard-cases.json'), {
    violatingCaseCount: state.interactivePathGuard.violatingCaseCount,
    violatingCases: state.interactivePathGuard.violatingCases,
    cases: state.interactivePathGuard.cases,
    policyEnforced: state.interactivePathGuard.ok,
  });

  writeJson(path.join(outputDir, 'advisory-blocking-drift-cases.json'), {
    advisoryToBlockingDriftCount: state.advisoryToBlockingDriftCount,
    advisoryToBlockingDriftCountZero: state.advisoryToBlockingDriftCountZero,
    driftCases: state.driftCases,
  });

  writeJson(path.join(outputDir, 'summary.json'), summary);
  writeJson(path.join(outputDir, 'ticket-meta.json'), ticketMeta);

  process.stdout.write(`${stableStringify(summary)}\n`);
  process.exit(summary.status === 'PASS' ? 0 : 1);
}

main();

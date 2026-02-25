#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {
  evaluateModeAwareExitPolicyState,
  FAIL_SIGNAL_CODE,
} from './mode-aware-exit-policy-state.mjs';

const DEFAULT_OUTPUT_DIR = 'docs/OPS/EVIDENCE/P1_CONTOUR/TICKET_02';
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

  const state = evaluateModeAwareExitPolicyState({
    repoRoot,
    failsignalRegistryPath: path.resolve(repoRoot, args.failsignalRegistryPath),
  });

  const parityOk = state.releasePromotionParity.ok && state.exitPolicyBeforeAfter.ok;
  const gates = {
    p1_02_mode_routing_check: state.modeRouting.ok ? 'PASS' : 'FAIL',
    p1_02_advisory_never_blocks_outside_matrix_check: state.advisoryToBlockingDriftCountZero ? 'PASS' : 'FAIL',
    p1_02_exit_behavior_parity_check: parityOk ? 'PASS' : 'FAIL',
    advisory_to_blocking_drift_count_zero: state.advisoryToBlockingDriftCountZero ? 'PASS' : 'FAIL',
  };

  const summary = {
    status: Object.values(gates).every((value) => value === 'PASS') ? 'PASS' : 'FAIL',
    runId: args.runId || process.env.RUN_ID || '',
    ticketId: args.ticketId || process.env.TICKET_ID || '',
    modeRoutingOk: state.modeRouting.ok,
    advisoryToBlockingDriftCount: state.advisoryToBlockingDriftCount,
    exitPolicyBeforeAfterMismatchCount: state.exitPolicyBeforeAfter.mismatchCount,
    releasePromotionParityMismatchCount: state.releasePromotionParity.mismatchCount,
    gates,
    generatedAtUtc: new Date().toISOString(),
  };

  const ticketMeta = {
    runId: summary.runId,
    ticketId: summary.ticketId,
    outputDir: path.relative(repoRoot, outputDir).replaceAll(path.sep, '/'),
    generatedAtUtc: summary.generatedAtUtc,
  };

  writeJson(path.join(outputDir, 'mode-aware-exit-policy-cases.json'), {
    gate: 'p1_02_mode_routing_check',
    ok: state.modeRouting.ok,
    evaluatorId: state.evaluatorId,
    caseResults: state.modeRouting.caseResults,
  });

  writeJson(path.join(outputDir, 'exit-policy-before-after.json'), {
    gate: 'p1_02_exit_behavior_parity_check',
    beforeAfter: state.exitPolicyBeforeAfter,
    releasePromotionParity: state.releasePromotionParity,
    p1_02ParityRule: 'SAME_BLOCKING_OUTCOME_FOR_RELEASE_AND_PROMOTION_PATHS_WHEN_INPUTS_EQUAL',
  });

  writeJson(path.join(outputDir, 'advisory-blocking-drift-cases.json'), {
    gate: 'p1_02_advisory_never_blocks_outside_matrix_check',
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

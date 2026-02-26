#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { evaluateHotPathIncrementalRenderState } from './hot-path-incremental-render-state.mjs';

const DEFAULT_OUTPUT_DIR = 'docs/OPS/EVIDENCE/P2_CONTOUR/TICKET_01';
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

  const state = evaluateHotPathIncrementalRenderState({
    repoRoot,
    failsignalRegistryPath: path.resolve(repoRoot, args.failsignalRegistryPath),
    hotpathPolicyPath: path.resolve(repoRoot, args.hotpathPolicyPath),
    perfThresholdsPath: path.resolve(repoRoot, args.perfThresholdsPath),
  });

  const gates = {
    single_blocking_authority_enforced: state.singleBlockingAuthority.ok ? 'PASS' : 'FAIL',
    p2_01_no_full_document_rerender_per_keystroke_check: state.noFullRerenderCheck.ok ? 'PASS' : 'FAIL',
    p2_01_input_p95_within_threshold_check: state.inputP95Check.ok ? 'PASS' : 'FAIL',
    p2_01_autosave_backup_nonblocking_check: state.typingLoopNonBlockingCheck.ok ? 'PASS' : 'FAIL',
    no_runtime_hotpath_governance: state.noRuntimeHotpathGovernance.ok ? 'PASS' : 'FAIL',
    no_advisory_to_blocking_drift: state.advisoryToBlockingDriftCountZero ? 'PASS' : 'FAIL',
  };

  const summary = {
    status: Object.values(gates).every((value) => value === 'PASS') ? 'PASS' : 'FAIL',
    runId: args.runId || process.env.RUN_ID || '',
    ticketId: args.ticketId || process.env.TICKET_ID || '',
    acceptanceMetricA: 'NO_FULL_DOCUMENT_RERENDER_PER_KEYSTROKE',
    acceptanceMetricB: 'INPUT_P95_WITHIN_FAST_LANE_THRESHOLD',
    acceptanceMetricC: 'AUTOSAVE_AND_BACKUP_DO_NOT_BLOCK_TYPING_LOOP',
    inputP95ThresholdMs: state.inputP95Check.thresholdMs,
    inputP95MeasuredMs: state.inputP95Check.measuredP95Ms,
    inputMedianMeasuredMs: state.inputP95Check.measuredMedianMs,
    inputSamplesCount: state.inputP95Check.sampleCount,
    noFullRerenderPerKeystroke: state.noFullRerenderCheck.ok,
    typingLoopNonBlocking: state.typingLoopNonBlockingCheck.ok,
    advisoryToBlockingDriftCount: state.advisoryToBlockingDriftCount,
    failReason: state.failReason,
    gates,
    generatedAtUtc: new Date().toISOString(),
  };

  const ticketMeta = {
    runId: summary.runId,
    ticketId: summary.ticketId,
    outputDir: path.relative(repoRoot, outputDir).replaceAll(path.sep, '/'),
    generatedAtUtc: summary.generatedAtUtc,
  };

  writeJson(path.join(outputDir, 'hotpath-rerender-sampling.json'), {
    editorPath: state.hotpathAnalysis.editorPath,
    inputHandlerAnchor: state.hotpathAnalysis.inputHandlerAnchor,
    hotpathConstants: state.hotpathAnalysis.hotpathConstants,
    noFullRerenderCheck: state.noFullRerenderCheck,
    sampling: {
      ok: state.hotpathAnalysis.sampling.ok,
      failReason: state.hotpathAnalysis.sampling.failReason,
      iterations: state.hotpathAnalysis.sampling.iterations,
      warmupIterations: state.hotpathAnalysis.sampling.warmupIterations,
      p95Ms: state.hotpathAnalysis.sampling.p95Ms,
      medianMs: state.hotpathAnalysis.sampling.medianMs,
      minMs: state.hotpathAnalysis.sampling.minMs,
      maxMs: state.hotpathAnalysis.sampling.maxMs,
      sampleHeadMs: state.hotpathAnalysis.sampling.samplesMs.slice(0, 20),
    },
  });

  writeJson(path.join(outputDir, 'hotpath-p95-latency-proof.json'), {
    thresholdMs: state.inputP95Check.thresholdMs,
    measuredP95Ms: state.inputP95Check.measuredP95Ms,
    measuredMedianMs: state.inputP95Check.measuredMedianMs,
    sampleCount: state.inputP95Check.sampleCount,
    p95WithinThreshold: state.inputP95Check.ok,
  });

  writeJson(path.join(outputDir, 'typing-loop-nonblocking-proof.json'), {
    typingLoopNonBlockingCheck: state.typingLoopNonBlockingCheck,
    noRuntimeHotpathGovernance: state.noRuntimeHotpathGovernance,
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

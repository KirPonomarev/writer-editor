#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {
  evaluateSafeLocalWavePreflightState,
  DEFAULT_MIN_REDUCTION,
} from './safe-local-wave-preflight-state.mjs';

const DEFAULT_OUTPUT_DIR = 'docs/OPS/EVIDENCE/P1_CONTOUR/TICKET_03';
const DEFAULT_FAILSIGNAL_REGISTRY_PATH = 'docs/OPS/FAILSIGNALS/FAILSIGNAL_REGISTRY.json';
const DEFAULT_REQUIRED_SET_PATH = 'docs/OPS/EXECUTION/REQUIRED_TOKEN_SET.json';

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
    requiredSetPath: DEFAULT_REQUIRED_SET_PATH,
    minReduction: DEFAULT_MIN_REDUCTION,
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

    if (arg === '--required-set-path' && i + 1 < argv.length) {
      out.requiredSetPath = normalizeString(argv[i + 1]) || DEFAULT_REQUIRED_SET_PATH;
      i += 1;
      continue;
    }
    if (arg.startsWith('--required-set-path=')) {
      out.requiredSetPath = normalizeString(arg.slice('--required-set-path='.length)) || DEFAULT_REQUIRED_SET_PATH;
      continue;
    }

    if (arg === '--min-reduction' && i + 1 < argv.length) {
      const parsed = Number.parseInt(normalizeString(argv[i + 1]), 10);
      if (Number.isInteger(parsed) && parsed >= 0) out.minReduction = parsed;
      i += 1;
      continue;
    }
    if (arg.startsWith('--min-reduction=')) {
      const parsed = Number.parseInt(normalizeString(arg.slice('--min-reduction='.length)), 10);
      if (Number.isInteger(parsed) && parsed >= 0) out.minReduction = parsed;
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

  const state = evaluateSafeLocalWavePreflightState({
    repoRoot,
    failsignalRegistryPath: path.resolve(repoRoot, args.failsignalRegistryPath),
    requiredSetPath: path.resolve(repoRoot, args.requiredSetPath),
    minReduction: args.minReduction,
  });

  const gates = {
    p1_03_local_preflight_safety_check: state.localPreflightSafety.ok ? 'PASS' : 'FAIL',
    p1_03_duplicate_preflight_reduction_check: state.duplicatePreflightBeforeAfter.duplicateReductionOk ? 'PASS' : 'FAIL',
    p1_03_remote_binding_skip_on_local_safe_mode_check: state.duplicatePreflightBeforeAfter.remoteBindingSkipOnLocalSafeMode.ok ? 'PASS' : 'FAIL',
    advisory_to_blocking_drift_count_zero: state.advisoryToBlockingDriftCountZero ? 'PASS' : 'FAIL',
  };

  const summary = {
    status: Object.values(gates).every((value) => value === 'PASS') ? 'PASS' : 'FAIL',
    runId: args.runId || process.env.RUN_ID || '',
    ticketId: args.ticketId || process.env.TICKET_ID || '',
    minReductionRequired: args.minReduction,
    removedDuplicateSignalPaths: state.duplicatePreflightBeforeAfter.removedDuplicateSignalPaths,
    duplicateSignalCountBefore: state.duplicatePreflightBeforeAfter.before.duplicateSignalCount,
    duplicateSignalCountAfter: state.duplicatePreflightBeforeAfter.after.duplicateSignalCount,
    remoteBindingSignalPathCountBefore: state.duplicatePreflightBeforeAfter.before.remoteBindingSignalPathCount,
    remoteBindingSignalPathCountAfter: state.duplicatePreflightBeforeAfter.after.remoteBindingSignalPathCount,
    advisoryToBlockingDriftCount: state.advisoryToBlockingDriftCount,
    localPreflightSafetyOk: state.localPreflightSafety.ok,
    safetyParityOk: state.safetyParity.ok,
    gates,
    generatedAtUtc: new Date().toISOString(),
  };

  const ticketMeta = {
    runId: summary.runId,
    ticketId: summary.ticketId,
    outputDir: path.relative(repoRoot, outputDir).replaceAll(path.sep, '/'),
    generatedAtUtc: summary.generatedAtUtc,
  };

  writeJson(path.join(outputDir, 'local-wave-preflight-cases.json'), {
    localPreflightSafety: state.localPreflightSafety,
    remoteBindingSkipOnLocalSafeMode: state.duplicatePreflightBeforeAfter.remoteBindingSkipOnLocalSafeMode,
    p1_03ExitCriterion: 'SAFE_LOCAL_PREFLIGHT_ACTIVE_WITH_REDUCED_PROCESS_TAX_AND_ZERO_ADVISORY_TO_BLOCKING_DRIFT',
  });

  writeJson(path.join(outputDir, 'preflight-duplication-before-after.json'), {
    minReductionRequired: args.minReduction,
    before: state.duplicatePreflightBeforeAfter.before,
    after: state.duplicatePreflightBeforeAfter.after,
    removedDuplicateSignalPaths: state.duplicatePreflightBeforeAfter.removedDuplicateSignalPaths,
    duplicateReductionOk: state.duplicatePreflightBeforeAfter.duplicateReductionOk,
    remoteBindingSkipOnLocalSafeMode: state.duplicatePreflightBeforeAfter.remoteBindingSkipOnLocalSafeMode,
  });

  writeJson(path.join(outputDir, 'safety-parity-proof.json'), {
    releaseRequiredBefore: state.safetyParity.releaseRequiredBefore,
    releaseRequiredAfter: state.safetyParity.releaseRequiredAfter,
    releaseRequiredBeforeSha256: state.safetyParity.releaseRequiredBeforeSha256,
    releaseRequiredAfterSha256: state.safetyParity.releaseRequiredAfterSha256,
    assertBlockingSetSizeUnchanged: state.safetyParity.assertBlockingSetSizeUnchanged,
    assertBlockingSetExactEqual: state.safetyParity.assertBlockingSetExactEqual,
    assertBlockingSetSha256Equal: state.safetyParity.assertBlockingSetSha256Equal,
    safetyParityOk: state.safetyParity.ok,
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

#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { evaluateRecursionBypassReleaseBan } from './recursion-bypass-release-ban-state.mjs';

const DEFAULT_OUTPUT_DIR = 'docs/OPS/EVIDENCE/P0_CONTOUR/TICKET_05';
const DEFAULT_GUARD_PATH = 'scripts/guards/ops-current-wave-stop.mjs';
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
    guardPath: DEFAULT_GUARD_PATH,
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

    if (arg === '--guard-path' && i + 1 < argv.length) {
      out.guardPath = normalizeString(argv[i + 1]) || DEFAULT_GUARD_PATH;
      i += 1;
      continue;
    }
    if (arg.startsWith('--guard-path=')) {
      out.guardPath = normalizeString(arg.slice('--guard-path='.length)) || DEFAULT_GUARD_PATH;
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

  const state = evaluateRecursionBypassReleaseBan({
    repoRoot,
    guardPath: args.guardPath,
    failsignalRegistryPath: args.failsignalRegistryPath,
  });

  const gates = {
    p0_05_release_bypass_ban_check: state.releaseContextBypassDisabled ? 'PASS' : 'FAIL',
    p0_05_promotion_bypass_ban_check: state.promotionContextBypassDisabled ? 'PASS' : 'FAIL',
    p0_05_negative_bypass_attempt_check: state.negativeBypassAttemptFails ? 'PASS' : 'FAIL',
    advisory_to_blocking_drift_count_zero: state.advisoryToBlockingDriftCountZero ? 'PASS' : 'FAIL',
  };

  const summary = {
    status: Object.values(gates).every((value) => value === 'PASS') ? 'PASS' : 'FAIL',
    runId: args.runId || process.env.RUN_ID || '',
    ticketId: args.ticketId || process.env.TICKET_ID || '',
    releaseContextBypassDisabled: state.releaseContextBypassDisabled,
    promotionContextBypassDisabled: state.promotionContextBypassDisabled,
    negativeBypassAttemptFails: state.negativeBypassAttemptFails,
    advisoryToBlockingDriftCount: state.advisoryToBlockingDriftCount,
    gates,
    generatedAtUtc: new Date().toISOString(),
  };

  const report = {
    reportId: 'P0_05_RECURSION_BYPASS_RELEASE_BAN_REPORT_V1',
    ...summary,
    guardPath: state.guardPath,
    failSignalCode: state.failSignalCode,
    failReason: state.failReason,
    attempts: state.attempts,
    driftCases: state.driftCases,
    issues: state.issues,
  };

  const ticketMeta = {
    runId: summary.runId,
    ticketId: summary.ticketId,
    outputDir: path.relative(repoRoot, outputDir).replaceAll(path.sep, '/'),
    generatedAtUtc: summary.generatedAtUtc,
  };

  writeJson(path.join(outputDir, 'recursion-bypass-release-check.json'), {
    gate: 'p0_05_release_bypass_ban_check',
    ok: state.releaseContextBypassDisabled,
    failSignalCodeExpected: 'E_GOVERNANCE_STRICT_FAIL',
    attempt: state.attempts.release,
  });

  writeJson(path.join(outputDir, 'recursion-bypass-promotion-check.json'), {
    gate: 'p0_05_promotion_bypass_ban_check',
    ok: state.promotionContextBypassDisabled,
    failSignalCodeExpected: 'E_GOVERNANCE_STRICT_FAIL',
    attempt: state.attempts.promotion,
  });

  writeJson(path.join(outputDir, 'recursion-bypass-negative-attempts.json'), {
    gate: 'p0_05_negative_bypass_attempt_check',
    ok: state.negativeBypassAttemptFails,
    failSignalCodeExpected: 'E_GOVERNANCE_STRICT_FAIL',
    attempt: state.attempts.negative,
  });

  writeJson(path.join(outputDir, 'p0-05-recursion-bypass-ban-report.json'), report);
  writeJson(path.join(outputDir, 'summary.json'), summary);
  writeJson(path.join(outputDir, 'ticket-meta.json'), ticketMeta);

  process.stdout.write(`${stableStringify(summary)}\n`);
  process.exit(summary.status === 'PASS' ? 0 : 1);
}

main();

#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {
  evaluateAttestationTrustLockState,
  FAIL_SIGNAL_CODE,
  TRUST_LOCK_ID,
  TRUST_PROVIDER,
  FORBIDDEN_CONTEXT_SOURCE,
} from './attestation-trust-lock-state.mjs';
import { CANONICAL_MODE_MATRIX_EVALUATOR_ID } from './canonical-mode-matrix-evaluator.mjs';

const DEFAULT_OUTPUT_DIR = 'docs/OPS/EVIDENCE/P0_CONTOUR/TICKET_06';
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

function buildTrustedContextPayload() {
  return {
    attestationKind: 'POST_MERGE_VERIFY',
    taskId: 'strict-verify-release',
    verifyPath: 'scripts/ops/post-merge-verify.mjs',
    verifyOk: 1,
    trustedContext: {
      trustProvider: TRUST_PROVIDER,
      trustLockId: TRUST_LOCK_ID,
      contextId: 'ctx-release-verify-main',
      source: 'trusted_context_record',
    },
  };
}

function buildSelfGeneratedPayload() {
  return {
    attestationKind: 'POST_MERGE_VERIFY',
    taskId: 'strict-verify-release',
    verifyPath: 'scripts/ops/post-merge-verify.mjs',
    verifyOk: 1,
    trustedContext: {
      trustProvider: TRUST_PROVIDER,
      trustLockId: TRUST_LOCK_ID,
      contextId: 'ctx-self-generated',
      source: FORBIDDEN_CONTEXT_SOURCE,
    },
  };
}

function runRepeatablePass3(repoRoot, failsignalRegistryPath) {
  const runs = [];
  const payload = buildTrustedContextPayload();

  for (let i = 0; i < 3; i += 1) {
    const state = evaluateAttestationTrustLockState({
      repoRoot,
      failsignalRegistryPath,
      payload,
    });

    runs.push({
      run: i + 1,
      ok: state.ok,
      token: state.ATTESTATION_TRUST_LOCK_ENFORCEMENT_OK,
      failReason: state.failReason,
      failSignalCode: state.failSignalCode,
      advisoryToBlockingDriftCount: state.advisoryToBlockingDriftCount,
      issues: state.issues,
    });
  }

  const baseline = JSON.stringify({
    ok: runs[0].ok,
    token: runs[0].token,
    failReason: runs[0].failReason,
    failSignalCode: runs[0].failSignalCode,
    advisoryToBlockingDriftCount: runs[0].advisoryToBlockingDriftCount,
    issues: runs[0].issues,
  });
  const identical = runs.every((entry) => JSON.stringify({
    ok: entry.ok,
    token: entry.token,
    failReason: entry.failReason,
    failSignalCode: entry.failSignalCode,
    advisoryToBlockingDriftCount: entry.advisoryToBlockingDriftCount,
    issues: entry.issues,
  }) === baseline);

  const ok = identical && runs.every((entry) => entry.ok === true && entry.advisoryToBlockingDriftCount === 0);
  return {
    ok,
    identical,
    runs,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = process.cwd();
  const outputDir = path.resolve(repoRoot, args.outputDir);
  const failsignalRegistryPath = path.resolve(repoRoot, args.failsignalRegistryPath);

  const trustedContextPositive = evaluateAttestationTrustLockState({
    repoRoot,
    failsignalRegistryPath,
    payload: buildTrustedContextPayload(),
  });

  const selfGeneratedNegative = evaluateAttestationTrustLockState({
    repoRoot,
    failsignalRegistryPath,
    payload: buildSelfGeneratedPayload(),
  });

  const negativeCheckOk = selfGeneratedNegative.ok === false
    && selfGeneratedNegative.failSignalCode === FAIL_SIGNAL_CODE
    && selfGeneratedNegative.failReason === 'SELF_GENERATED_PAYLOAD_FORBIDDEN';

  const repeatable = runRepeatablePass3(repoRoot, failsignalRegistryPath);

  const gates = {
    p0_06_trusted_context_positive_check: trustedContextPositive.ok ? 'PASS' : 'FAIL',
    p0_06_self_generated_payload_rejection_check: negativeCheckOk ? 'PASS' : 'FAIL',
    p0_06_repeatable_pass_3runs: repeatable.ok ? 'PASS' : 'FAIL',
    advisory_to_blocking_drift_count_zero: trustedContextPositive.advisoryToBlockingDriftCountZero ? 'PASS' : 'FAIL',
  };

  const summary = {
    status: Object.values(gates).every((value) => value === 'PASS') ? 'PASS' : 'FAIL',
    runId: args.runId || process.env.RUN_ID || '',
    ticketId: args.ticketId || process.env.TICKET_ID || '',
    blockingEvaluatorId: CANONICAL_MODE_MATRIX_EVALUATOR_ID,
    trustLockId: TRUST_LOCK_ID,
    trustedContextPositiveOk: trustedContextPositive.ok,
    selfGeneratedPayloadRejected: negativeCheckOk,
    advisoryToBlockingDriftCount: trustedContextPositive.advisoryToBlockingDriftCount,
    gates,
    generatedAtUtc: new Date().toISOString(),
  };

  const report = {
    reportId: 'P0_06_ATTESTATION_TRUST_LOCK_ENFORCEMENT_REPORT_V1',
    ...summary,
    declaredFailSignalCode: FAIL_SIGNAL_CODE,
    trustedContextPositive: {
      ok: trustedContextPositive.ok,
      token: trustedContextPositive.ATTESTATION_TRUST_LOCK_ENFORCEMENT_OK,
      failReason: trustedContextPositive.failReason,
      failSignalCode: trustedContextPositive.failSignalCode,
      issues: trustedContextPositive.issues,
      payload: trustedContextPositive.payload,
    },
    selfGeneratedPayloadNegative: {
      ok: negativeCheckOk,
      stateOk: selfGeneratedNegative.ok,
      failReason: selfGeneratedNegative.failReason,
      failSignalCode: selfGeneratedNegative.failSignalCode,
      issues: selfGeneratedNegative.issues,
      payload: selfGeneratedNegative.payload,
    },
    repeatable,
    advisoryBlockingDriftCases: trustedContextPositive.driftCases,
  };

  const ticketMeta = {
    runId: summary.runId,
    ticketId: summary.ticketId,
    outputDir: path.relative(repoRoot, outputDir).replaceAll(path.sep, '/'),
    generatedAtUtc: summary.generatedAtUtc,
  };

  writeJson(path.join(outputDir, 'attestation-trusted-context-positive.json'), {
    gate: 'p0_06_trusted_context_positive_check',
    ok: trustedContextPositive.ok,
    token: trustedContextPositive.ATTESTATION_TRUST_LOCK_ENFORCEMENT_OK,
    failSignalCode: trustedContextPositive.failSignalCode,
    payload: trustedContextPositive.payload,
  });

  writeJson(path.join(outputDir, 'attestation-self-generated-payload-negative.json'), {
    gate: 'p0_06_self_generated_payload_rejection_check',
    ok: negativeCheckOk,
    stateOk: selfGeneratedNegative.ok,
    failSignalCodeExpected: FAIL_SIGNAL_CODE,
    failSignalCodeActual: selfGeneratedNegative.failSignalCode,
    failReasonActual: selfGeneratedNegative.failReason,
    payload: selfGeneratedNegative.payload,
  });

  writeJson(path.join(outputDir, 'repeatable-pass-3runs.json'), repeatable);
  writeJson(path.join(outputDir, 'advisory-blocking-drift-cases.json'), {
    advisoryToBlockingDriftCount: trustedContextPositive.advisoryToBlockingDriftCount,
    advisoryToBlockingDriftCountZero: trustedContextPositive.advisoryToBlockingDriftCountZero,
    driftCases: trustedContextPositive.driftCases,
  });
  writeJson(path.join(outputDir, 'attestation-trust-lock-report.json'), report);
  writeJson(path.join(outputDir, 'summary.json'), summary);
  writeJson(path.join(outputDir, 'ticket-meta.json'), ticketMeta);

  process.stdout.write(`${stableStringify(summary)}\n`);
  process.exit(summary.status === 'PASS' ? 0 : 1);
}

main();

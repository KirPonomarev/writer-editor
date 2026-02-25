#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateModeMatrixVerdict } from './canonical-mode-matrix-evaluator.mjs';

const TOKEN_NAME = 'ATTESTATION_TRUST_LOCK_ENFORCEMENT_OK';
const FAIL_SIGNAL_CODE = 'E_VERIFY_ATTESTATION_INVALID';
const DEFAULT_FAILSIGNAL_REGISTRY_PATH = 'docs/OPS/FAILSIGNALS/FAILSIGNAL_REGISTRY.json';
const TRUST_LOCK_ID = 'ATTESTATION_TRUST_LOCK_ENFORCEMENT_v1';
const TRUST_PROVIDER = 'ATTESTATION_TRUST_LOCK';
const FORBIDDEN_CONTEXT_SOURCE = 'self_generated';

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

function readJsonObject(filePath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return isObjectRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function parseArgs(argv = process.argv.slice(2)) {
  const out = {
    json: false,
    failsignalRegistryPath: '',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = normalizeString(argv[i]);
    if (!arg) continue;
    if (arg === '--json') {
      out.json = true;
      continue;
    }
    if (arg === '--failsignal-registry-path' && i + 1 < argv.length) {
      out.failsignalRegistryPath = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--failsignal-registry-path=')) {
      out.failsignalRegistryPath = normalizeString(arg.slice('--failsignal-registry-path='.length));
    }
  }

  return out;
}

function buildDefaultTrustedPayload() {
  return {
    attestationKind: 'POST_MERGE_VERIFY',
    taskId: 'strict-verify-release',
    verifyPath: 'scripts/ops/post-merge-verify.mjs',
    verifyOk: 1,
    trustedContext: {
      trustProvider: TRUST_PROVIDER,
      trustLockId: TRUST_LOCK_ID,
      contextId: 'ctx-post-merge-verify-main',
      source: 'post_merge_verify_record',
    },
  };
}

function evaluateAttestationPayload(payload) {
  const issues = [];
  const data = isObjectRecord(payload) ? payload : {};

  const attestationKind = normalizeString(data.attestationKind);
  const taskId = normalizeString(data.taskId);
  const verifyPath = normalizeString(data.verifyPath);
  const verifyOk = Number(data.verifyOk) === 1 ? 1 : 0;
  const trustedContext = isObjectRecord(data.trustedContext) ? data.trustedContext : null;

  if (attestationKind !== 'POST_MERGE_VERIFY') issues.push({ code: 'ATTESTATION_KIND_INVALID' });
  if (!taskId) issues.push({ code: 'TASK_ID_MISSING' });
  if (!verifyPath) issues.push({ code: 'VERIFY_PATH_MISSING' });
  if (verifyOk !== 1) issues.push({ code: 'VERIFY_NOT_OK' });

  if (!trustedContext) {
    issues.push({ code: 'TRUSTED_CONTEXT_MISSING' });
  } else {
    const trustProvider = normalizeString(trustedContext.trustProvider);
    const trustLockId = normalizeString(trustedContext.trustLockId);
    const contextId = normalizeString(trustedContext.contextId);
    const source = normalizeString(trustedContext.source).toLowerCase();

    if (trustProvider !== TRUST_PROVIDER) issues.push({ code: 'TRUST_PROVIDER_INVALID' });
    if (trustLockId !== TRUST_LOCK_ID) issues.push({ code: 'TRUST_LOCK_ID_INVALID' });
    if (!contextId) issues.push({ code: 'TRUST_CONTEXT_ID_MISSING' });
    if (!source) issues.push({ code: 'TRUST_CONTEXT_SOURCE_MISSING' });
    if (source === FORBIDDEN_CONTEXT_SOURCE) issues.push({ code: 'SELF_GENERATED_CONTEXT_FORBIDDEN' });
  }

  const ok = issues.length === 0;
  return {
    ok,
    issues,
  };
}

function evaluateAdvisoryToBlockingDrift(repoRoot, failsignalRegistryPath) {
  const registryDoc = readJsonObject(failsignalRegistryPath);
  if (!registryDoc || !Array.isArray(registryDoc.failSignals)) {
    return {
      ok: false,
      advisoryToBlockingDriftCount: -1,
      driftCases: [],
      issues: [
        {
          code: 'FAILSIGNAL_REGISTRY_UNREADABLE',
          failsignalRegistryPath: path.relative(repoRoot, failsignalRegistryPath).replaceAll(path.sep, '/'),
        },
      ],
    };
  }

  const modePairs = [
    { mode: 'pr', key: 'prCore' },
    { mode: 'release', key: 'release' },
    { mode: 'promotion', key: 'promotion' },
  ];

  const driftCases = [];
  const issues = [];

  for (const row of registryDoc.failSignals) {
    if (!isObjectRecord(row)) continue;
    const failSignalCode = normalizeString(row.code);
    if (!failSignalCode) continue;

    for (const pair of modePairs) {
      const expectedDisposition = normalizeString((row.modeMatrix || {})[pair.key]).toLowerCase();
      if (expectedDisposition !== 'advisory') continue;

      const verdict = evaluateModeMatrixVerdict({
        repoRoot,
        mode: pair.mode,
        failSignalCode,
      });

      if (!verdict.ok) {
        issues.push({
          code: 'MODE_EVALUATOR_ERROR',
          failSignalCode,
          mode: pair.mode,
          evaluatorIssues: verdict.issues || [],
        });
        continue;
      }

      if (verdict.shouldBlock) {
        driftCases.push({
          failSignalCode,
          mode: pair.mode,
          expectedDisposition,
          actualDisposition: verdict.modeDisposition,
          actualShouldBlock: verdict.shouldBlock,
          reason: 'ADVISORY_TO_BLOCKING_DRIFT',
        });
      }
    }
  }

  return {
    ok: issues.length === 0,
    advisoryToBlockingDriftCount: driftCases.length,
    driftCases,
    issues,
  };
}

export function evaluateAttestationTrustLockState(input = {}) {
  const repoRoot = path.resolve(normalizeString(input.repoRoot) || process.cwd());
  const failsignalRegistryPath = path.resolve(
    repoRoot,
    normalizeString(input.failsignalRegistryPath || DEFAULT_FAILSIGNAL_REGISTRY_PATH),
  );
  const payload = isObjectRecord(input.payload) ? input.payload : buildDefaultTrustedPayload();

  const payloadState = evaluateAttestationPayload(payload);
  const driftState = evaluateAdvisoryToBlockingDrift(repoRoot, failsignalRegistryPath);

  const advisoryToBlockingDriftCount = driftState.advisoryToBlockingDriftCount;
  const advisoryToBlockingDriftCountZero = advisoryToBlockingDriftCount === 0;
  const issues = [...payloadState.issues];
  if (!driftState.ok) issues.push(...driftState.issues);

  const ok = payloadState.ok && advisoryToBlockingDriftCountZero && issues.length === 0;
  return {
    ok,
    [TOKEN_NAME]: ok ? 1 : 0,
    failSignalCode: ok ? '' : FAIL_SIGNAL_CODE,
    failReason: ok ? '' : (
      payloadState.issues.some((entry) => entry.code === 'SELF_GENERATED_CONTEXT_FORBIDDEN')
        ? 'SELF_GENERATED_PAYLOAD_FORBIDDEN'
        : 'TRUST_LOCK_ENFORCEMENT_FAIL'
    ),
    trustLockId: TRUST_LOCK_ID,
    trustProvider: TRUST_PROVIDER,
    failsignalRegistryPath: path.relative(repoRoot, failsignalRegistryPath).replaceAll(path.sep, '/'),
    payload,
    advisoryToBlockingDriftCount,
    advisoryToBlockingDriftCountZero,
    driftCases: driftState.driftCases,
    issues,
  };
}

function printHuman(state) {
  console.log(`${TOKEN_NAME}=${state[TOKEN_NAME]}`);
  console.log(`ATTESTATION_TRUST_LOCK_ID=${state.trustLockId}`);
  console.log(`ATTESTATION_TRUST_PROVIDER=${state.trustProvider}`);
  console.log(`ATTESTATION_TRUST_LOCK_ADVISORY_DRIFT_COUNT=${state.advisoryToBlockingDriftCount}`);
  console.log(`ATTESTATION_TRUST_LOCK_ADVISORY_DRIFT_COUNT_ZERO=${state.advisoryToBlockingDriftCountZero ? 1 : 0}`);
  if (!state.ok) {
    console.log(`FAIL_REASON=${state.failReason}`);
    console.log(`FAIL_SIGNAL=${state.failSignalCode}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluateAttestationTrustLockState({
    failsignalRegistryPath: args.failsignalRegistryPath,
  });

  if (args.json) {
    process.stdout.write(`${stableStringify(state)}\n`);
  } else {
    printHuman(state);
  }

  process.exit(state.ok ? 0 : 1);
}

const selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === selfPath) {
  main();
}

export {
  TOKEN_NAME,
  FAIL_SIGNAL_CODE,
  TRUST_LOCK_ID,
  TRUST_PROVIDER,
  FORBIDDEN_CONTEXT_SOURCE,
};

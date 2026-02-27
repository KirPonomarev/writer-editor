#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { evaluateHotPathIncrementalRenderState } from './hot-path-incremental-render-state.mjs';

const TOKEN_NAME = 'HOTPATH_ACCEPTANCE_GUARD_OK';
const FAIL_SIGNAL_CODE = 'E_HOTPATH_ACCEPTANCE_GUARD';
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

function sha256(value) {
  return createHash('sha256').update(String(value)).digest('hex');
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
    hotpathPolicyPath: '',
    perfThresholdsPath: '',
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
      continue;
    }

    if (arg === '--hotpath-policy-path' && i + 1 < argv.length) {
      out.hotpathPolicyPath = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--hotpath-policy-path=')) {
      out.hotpathPolicyPath = normalizeString(arg.slice('--hotpath-policy-path='.length));
      continue;
    }

    if (arg === '--perf-thresholds-path' && i + 1 < argv.length) {
      out.perfThresholdsPath = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--perf-thresholds-path=')) {
      out.perfThresholdsPath = normalizeString(arg.slice('--perf-thresholds-path='.length));
    }
  }

  return out;
}

function resolveNumericThreshold(metrics, key) {
  const raw = Number(metrics?.[key]);
  return Number.isFinite(raw) && raw > 0 ? raw : Number.NaN;
}

function evaluateThresholdSsotLock(repoRoot, perfThresholdsDoc, hotpathPolicyDoc, baseState, paths) {
  const perfSchemaVersion = normalizeString(perfThresholdsDoc?.schemaVersion);
  const perfProfile = normalizeString(perfThresholdsDoc?.profile);
  const policySchemaVersion = normalizeString(hotpathPolicyDoc?.schemaVersion);
  const policyProfile = normalizeString(hotpathPolicyDoc?.profile);
  const inputP95ThresholdMs = resolveNumericThreshold(perfThresholdsDoc?.metrics, 'input_handler_p95_ms')
    || resolveNumericThreshold(perfThresholdsDoc?.metrics, 'command_dispatch_p95_ms');
  const longTaskBudgetMs = resolveNumericThreshold(perfThresholdsDoc?.metrics, 'command_dispatch_p95_ms');
  const autosaveBackupTypingBlockThresholdMs = resolveNumericThreshold(perfThresholdsDoc?.metrics, 'command_dispatch_p95_ms');

  const sourcePayload = {
    perfThresholdsPath: path.relative(repoRoot, paths.perfThresholdsPath).replaceAll(path.sep, '/'),
    hotpathPolicyPath: path.relative(repoRoot, paths.hotpathPolicyPath).replaceAll(path.sep, '/'),
    perfSchemaVersion,
    perfProfile,
    policySchemaVersion,
    policyProfile,
    policyRuleIds: Array.isArray(hotpathPolicyDoc?.rules)
      ? hotpathPolicyDoc.rules
        .map((row) => normalizeString(row?.id))
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b))
      : [],
    monitoredPathsCount: Array.isArray(hotpathPolicyDoc?.monitoredPaths) ? hotpathPolicyDoc.monitoredPaths.length : 0,
  };

  const sourceLockSha256 = sha256(stableStringify(sourcePayload));
  const ok = perfSchemaVersion === 'perf-thresholds.v1'
    && policySchemaVersion === 'hotpath-policy.v1'
    && perfProfile.length > 0
    && perfProfile === policyProfile
    && Number.isFinite(inputP95ThresholdMs)
    && Number.isFinite(longTaskBudgetMs)
    && Number.isFinite(autosaveBackupTypingBlockThresholdMs)
    && Number.isFinite(baseState?.inputP95Check?.thresholdMs)
    && Number(baseState.inputP95Check.thresholdMs) === Number(inputP95ThresholdMs)
    && sourceLockSha256.length === 64;

  return {
    ok,
    sourceLockSha256,
    sourcePayload,
    thresholds: {
      inputP95ThresholdMs,
      longTaskBudgetMs,
      autosaveBackupTypingBlockThresholdMs,
    },
  };
}

function evaluateLongTaskBudgetProof(baseState, thresholdSsotLock) {
  const samples = Array.isArray(baseState?.hotpathAnalysis?.sampling?.samplesMs)
    ? baseState.hotpathAnalysis.sampling.samplesMs.filter((value) => Number.isFinite(value))
    : [];
  const longTaskBudgetMs = Number(thresholdSsotLock?.thresholds?.longTaskBudgetMs);
  const overBudgetSamplesCount = samples.filter((value) => value > longTaskBudgetMs).length;
  const maxSampleMs = samples.length > 0 ? Math.max(...samples) : 0;
  const ok = Boolean(baseState?.hotpathAnalysis?.sampling?.ok)
    && Number.isFinite(longTaskBudgetMs)
    && overBudgetSamplesCount === 0
    && maxSampleMs <= longTaskBudgetMs;

  return {
    ok,
    longTaskBudgetMs,
    sampleCount: samples.length,
    maxSampleMs,
    measuredP95Ms: Number(baseState?.inputP95Check?.measuredP95Ms || 0),
    measuredMedianMs: Number(baseState?.inputP95Check?.measuredMedianMs || 0),
    overBudgetSamplesCount,
  };
}

function evaluateAutosaveBackupTypingBlockThresholdProof(baseState, thresholdSsotLock) {
  const thresholdMs = Number(thresholdSsotLock?.thresholds?.autosaveBackupTypingBlockThresholdMs);
  const measuredP95Ms = Number(baseState?.inputP95Check?.measuredP95Ms || 0);
  const typingLoopBlockingPatternHits = Array.isArray(baseState?.hotpathAnalysis?.inputHandlerAnalysis?.typingLoopBlockingPatternHits)
    ? baseState.hotpathAnalysis.inputHandlerAnalysis.typingLoopBlockingPatternHits
    : [];
  const syncHitsNearCriticalQueues = Array.isArray(baseState?.hotpathAnalysis?.autosaveBackupNonBlocking?.syncHitsNearCriticalQueues)
    ? baseState.hotpathAnalysis.autosaveBackupNonBlocking.syncHitsNearCriticalQueues
    : [];

  const ok = Boolean(baseState?.typingLoopNonBlockingCheck?.ok)
    && Number.isFinite(thresholdMs)
    && measuredP95Ms <= thresholdMs
    && typingLoopBlockingPatternHits.length === 0
    && syncHitsNearCriticalQueues.length === 0;

  return {
    ok,
    autosaveBackupTypingBlockThresholdMs: thresholdMs,
    measuredP95Ms,
    typingLoopBlockingPatternHits,
    syncHitsNearCriticalQueues,
    autosaveBackupNonBlocking: baseState?.hotpathAnalysis?.autosaveBackupNonBlocking || {},
  };
}

export function evaluateHotpathAcceptanceGuardState(input = {}) {
  const repoRoot = path.resolve(normalizeString(input.repoRoot) || process.cwd());
  const failsignalRegistryPath = path.resolve(
    repoRoot,
    normalizeString(input.failsignalRegistryPath || DEFAULT_FAILSIGNAL_REGISTRY_PATH),
  );
  const hotpathPolicyPath = path.resolve(
    repoRoot,
    normalizeString(input.hotpathPolicyPath || DEFAULT_HOTPATH_POLICY_PATH),
  );
  const perfThresholdsPath = path.resolve(
    repoRoot,
    normalizeString(input.perfThresholdsPath || DEFAULT_PERF_THRESHOLDS_PATH),
  );

  const perfThresholdsDoc = isObjectRecord(input.perfThresholdsDoc)
    ? input.perfThresholdsDoc
    : readJsonObject(perfThresholdsPath);
  const hotpathPolicyDoc = isObjectRecord(input.hotpathPolicyDoc)
    ? input.hotpathPolicyDoc
    : readJsonObject(hotpathPolicyPath);
  const issues = [];
  if (!perfThresholdsDoc) issues.push({ code: 'PERF_THRESHOLDS_UNREADABLE' });
  if (!hotpathPolicyDoc) issues.push({ code: 'HOTPATH_POLICY_UNREADABLE' });

  const baseState = evaluateHotPathIncrementalRenderState({
    repoRoot,
    failsignalRegistryPath,
    hotpathPolicyPath,
    perfThresholdsPath,
    failsignalRegistryDoc: input.failsignalRegistryDoc,
    hotpathPolicyDoc,
    perfThresholdsDoc,
    editorSourceOverride: input.editorSourceOverride,
    mainSourceOverride: input.mainSourceOverride,
  });

  const thresholdSsotLock = evaluateThresholdSsotLock(
    repoRoot,
    perfThresholdsDoc || {},
    hotpathPolicyDoc || {},
    baseState,
    { perfThresholdsPath, hotpathPolicyPath },
  );
  const longTaskBudgetProof = evaluateLongTaskBudgetProof(baseState, thresholdSsotLock);
  const autosaveBackupTypingBlockThresholdProof = evaluateAutosaveBackupTypingBlockThresholdProof(baseState, thresholdSsotLock);

  const noFullDocumentRerenderPerKeystrokeCheck = Boolean(baseState.noFullRerenderCheck?.ok);
  const inputP95WithinThresholdCheck = Boolean(baseState.inputP95Check?.ok);
  const autosaveBackupNonblockingCheck = Boolean(baseState.typingLoopNonBlockingCheck?.ok)
    && autosaveBackupTypingBlockThresholdProof.ok;
  const thresholdSsotLockCheck = thresholdSsotLock.ok && longTaskBudgetProof.ok;
  const advisoryToBlockingDriftCount = Number(baseState.advisoryToBlockingDriftCount);
  const advisoryToBlockingDriftCountZero = advisoryToBlockingDriftCount === 0;

  if (!baseState.ok && Array.isArray(baseState.issues)) {
    issues.push(...baseState.issues);
  }

  const ok = noFullDocumentRerenderPerKeystrokeCheck
    && inputP95WithinThresholdCheck
    && autosaveBackupNonblockingCheck
    && thresholdSsotLockCheck
    && advisoryToBlockingDriftCountZero
    && issues.length === 0;

  return {
    ok,
    [TOKEN_NAME]: ok ? 1 : 0,
    failSignalCode: ok ? '' : FAIL_SIGNAL_CODE,
    failReason: ok ? '' : (
      !noFullDocumentRerenderPerKeystrokeCheck
        ? 'E_FULL_RERENDER_DETECTED'
        : !inputP95WithinThresholdCheck
          ? 'E_INPUT_P95_THRESHOLD_FAIL'
          : !autosaveBackupNonblockingCheck
            ? 'E_AUTOSAVE_BACKUP_TYPING_BLOCK'
            : !thresholdSsotLockCheck
              ? 'E_THRESHOLD_SSOT_LOCK_FAIL'
              : !advisoryToBlockingDriftCountZero
                ? 'ADVISORY_TO_BLOCKING_DRIFT'
                : 'E_POLICY_OR_SECURITY_CONFLICT'
    ),
    noFullDocumentRerenderPerKeystrokeCheck,
    inputP95WithinThresholdCheck,
    autosaveBackupNonblockingCheck,
    thresholdSsotLockCheck,
    advisoryToBlockingDriftCount,
    advisoryToBlockingDriftCountZero,
    thresholds: thresholdSsotLock.thresholds,
    thresholdSsotLock,
    longTaskBudgetProof,
    autosaveBackupTypingBlockThresholdProof,
    driftCases: baseState.driftCases || [],
    baseState,
    failsignalRegistryPath: path.relative(repoRoot, failsignalRegistryPath).replaceAll(path.sep, '/'),
    hotpathPolicyPath: path.relative(repoRoot, hotpathPolicyPath).replaceAll(path.sep, '/'),
    perfThresholdsPath: path.relative(repoRoot, perfThresholdsPath).replaceAll(path.sep, '/'),
    issues,
  };
}

function printHuman(state) {
  console.log(`${TOKEN_NAME}=${state[TOKEN_NAME]}`);
  console.log(`P2_04_NO_FULL_DOCUMENT_RERENDER_PER_KEYSTROKE_OK=${state.noFullDocumentRerenderPerKeystrokeCheck ? 1 : 0}`);
  console.log(`P2_04_INPUT_P95_WITHIN_THRESHOLD_OK=${state.inputP95WithinThresholdCheck ? 1 : 0}`);
  console.log(`P2_04_AUTOSAVE_BACKUP_NONBLOCKING_OK=${state.autosaveBackupNonblockingCheck ? 1 : 0}`);
  console.log(`P2_04_THRESHOLD_SSOT_LOCK_OK=${state.thresholdSsotLockCheck ? 1 : 0}`);
  console.log(`ADVISORY_TO_BLOCKING_DRIFT_COUNT=${state.advisoryToBlockingDriftCount}`);
  if (!state.ok) {
    console.log(`FAIL_REASON=${state.failReason}`);
    console.log(`FAIL_SIGNAL=${state.failSignalCode}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluateHotpathAcceptanceGuardState({
    failsignalRegistryPath: args.failsignalRegistryPath,
    hotpathPolicyPath: args.hotpathPolicyPath,
    perfThresholdsPath: args.perfThresholdsPath,
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
};

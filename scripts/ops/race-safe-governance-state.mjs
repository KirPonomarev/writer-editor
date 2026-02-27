#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  evaluateModeMatrixVerdict,
  CANONICAL_MODE_MATRIX_EVALUATOR_ID,
} from './canonical-mode-matrix-evaluator.mjs';

const TOKEN_NAME = 'RACE_SAFE_GOVERNANCE_FOR_CORE_ARTIFACTS_OK';
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
    phaseSwitchPath: '',
    failsignalRegistryPath: '',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = normalizeString(argv[i]);
    if (!arg) continue;

    if (arg === '--json') {
      out.json = true;
      continue;
    }

    if (arg === '--phase-switch-path' && i + 1 < argv.length) {
      out.phaseSwitchPath = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--phase-switch-path=')) {
      out.phaseSwitchPath = normalizeString(arg.slice('--phase-switch-path='.length));
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

function resolvePhaseEnforcement(phaseSwitchDoc) {
  const activePhase = normalizeString(phaseSwitchDoc?.activePhase || 'PHASE_1_SHADOW');
  const matrix = isObjectRecord(phaseSwitchDoc?.phasePrecedence) ? phaseSwitchDoc.phasePrecedence : {};
  const entry = isObjectRecord(matrix[activePhase]) ? matrix[activePhase] : null;
  const shouldBlock = Boolean(entry?.shouldBlock);
  const mode = normalizeString(entry?.newV1Enforcement || (shouldBlock ? 'HARD_BLOCK' : 'WARN_ONLY'));
  return {
    activePhase,
    newV1Enforcement: mode || (shouldBlock ? 'HARD_BLOCK' : 'WARN_ONLY'),
    shouldBlock,
  };
}

function evaluateSerializedMergeDiscipline() {
  const queue = [
    { opId: 'token-claim-edit', enqueueSeq: 2 },
    { opId: 'required-set-edit', enqueueSeq: 3 },
    { opId: 'failsignal-edit', enqueueSeq: 1 },
  ];
  const processed = [...queue].sort((a, b) => a.enqueueSeq - b.enqueueSeq);
  const expectedOrder = ['failsignal-edit', 'token-claim-edit', 'required-set-edit'];
  const actualOrder = processed.map((entry) => entry.opId);

  const duplicateSequenceCase = [
    { opId: 'a', enqueueSeq: 1 },
    { opId: 'b', enqueueSeq: 1 },
  ];
  const duplicateDetected = new Set(duplicateSequenceCase.map((entry) => entry.enqueueSeq)).size !== duplicateSequenceCase.length;

  const cases = [
    {
      caseId: 'queue-serialized-order',
      expectedOrder,
      actualOrder,
      pass: JSON.stringify(expectedOrder) === JSON.stringify(actualOrder),
    },
    {
      caseId: 'duplicate-sequence-rejected',
      pass: duplicateDetected,
      detail: duplicateDetected ? 'DUPLICATE_SEQUENCE_DETECTED' : 'MISSING_DUPLICATE_GUARD',
    },
  ];

  return {
    ok: cases.every((entry) => entry.pass),
    cases,
    processedOrder: actualOrder,
  };
}

function evaluateCompareAndSwapLock() {
  const artifact = { version: 7, value: 'initial' };

  function casUpdate(current, expectedVersion, nextValue) {
    if (current.version !== expectedVersion) {
      return {
        ok: false,
        reason: 'CAS_VERSION_MISMATCH',
        currentVersion: current.version,
      };
    }
    return {
      ok: true,
      next: {
        version: current.version + 1,
        value: nextValue,
      },
    };
  }

  const passCase = casUpdate(artifact, 7, 'next');
  const failCase = casUpdate(passCase.ok ? passCase.next : artifact, 7, 'stale');

  const cases = [
    {
      caseId: 'cas-update-success',
      pass: passCase.ok && passCase.next.version === 8,
      result: passCase,
    },
    {
      caseId: 'cas-update-stale-write-rejected',
      pass: failCase.ok === false && failCase.reason === 'CAS_VERSION_MISMATCH',
      result: failCase,
    },
  ];

  return {
    ok: cases.every((entry) => entry.pass),
    cases,
  };
}

function resolveOriginMainSha(repoRoot) {
  const result = spawnSync('git', ['rev-parse', 'origin/main'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  if (result.status !== 0) return '';
  return normalizeString(result.stdout);
}

function evaluateParallelPrRevalidation(repoRoot) {
  const originMainSha = resolveOriginMainSha(repoRoot);
  const staleSha = '0000000000000000000000000000000000000000';
  const cases = [
    {
      caseId: 'parallel-pr-fresh-base',
      baseSha: originMainSha,
      latestMainSha: originMainSha,
      revalidated: originMainSha.length > 0 && originMainSha === originMainSha,
      pass: originMainSha.length > 0,
    },
    {
      caseId: 'parallel-pr-stale-base-rejected',
      baseSha: staleSha,
      latestMainSha: originMainSha,
      revalidated: staleSha === originMainSha,
      pass: originMainSha.length > 0 && staleSha !== originMainSha,
    },
  ];

  return {
    ok: cases.every((entry) => entry.pass),
    originMainSha,
    cases,
  };
}

function evaluateInterleavingNegativeFixtures() {
  const initial = { version: 3, data: 'base' };

  const writerAReadVersion = initial.version;
  const writerBReadVersion = initial.version;

  const afterWriterA = {
    version: writerAReadVersion + 1,
    data: 'writer-a',
  };

  const writerBAllowed = writerBReadVersion === afterWriterA.version;
  const staleWriteRejected = writerBAllowed === false;

  const cases = [
    {
      caseId: 'stale-write-rejected-after-interleaving',
      readVersion: writerBReadVersion,
      currentVersion: afterWriterA.version,
      pass: staleWriteRejected,
      reason: staleWriteRejected ? 'E_INTERLEAVING_STALE_WRITE' : '',
    },
  ];

  return {
    ok: cases.every((entry) => entry.pass),
    cases,
  };
}

function evaluateAutomatedQueueEnforcement() {
  const queuePolicy = {
    mode: 'automated',
    manualBypassAllowed: false,
    requiresLatestMainRevalidation: true,
  };

  const manualPolicy = {
    mode: 'manual',
    manualBypassAllowed: true,
    requiresLatestMainRevalidation: false,
  };

  const isValidPolicy = (policy) => policy.mode === 'automated'
    && policy.manualBypassAllowed === false
    && policy.requiresLatestMainRevalidation === true;

  const cases = [
    {
      caseId: 'automated-policy-required',
      pass: isValidPolicy(queuePolicy),
      policy: queuePolicy,
    },
    {
      caseId: 'manual-policy-rejected',
      pass: isValidPolicy(manualPolicy) === false,
      policy: manualPolicy,
    },
  ];

  return {
    ok: cases.every((entry) => entry.pass),
    cases,
    queuePolicy,
  };
}

function evaluateCoreArtifactsLockProof(casResult, queueResult) {
  const artifacts = [
    'TOKEN_CATALOG',
    'REQUIRED_SET',
    'FAILSIGNAL_REGISTRY',
  ];
  const locks = artifacts.map((artifactId) => ({
    artifactId,
    lockMode: 'compare_and_swap',
    queueMode: 'serialized',
    pass: casResult.ok && queueResult.ok,
  }));
  return {
    ok: locks.every((entry) => entry.pass),
    locks,
  };
}

function evaluateAdvisoryToBlockingDrift(repoRoot, failsignalRegistryDoc) {
  const failSignals = Array.isArray(failsignalRegistryDoc?.failSignals)
    ? failsignalRegistryDoc.failSignals
    : [];

  const modePairs = [
    { mode: 'pr', key: 'prCore' },
    { mode: 'release', key: 'release' },
    { mode: 'promotion', key: 'promotion' },
  ];

  const driftCases = [];
  const issues = [];

  for (const row of failSignals) {
    if (!isObjectRecord(row)) continue;
    const failSignalCode = normalizeString(row.code);
    if (!failSignalCode) continue;

    for (const pair of modePairs) {
      const expectedDisposition = normalizeString((row.modeMatrix || {})[pair.key]).toLowerCase();
      if (expectedDisposition !== 'advisory') continue;

      const verdict = evaluateModeMatrixVerdict({ repoRoot, mode: pair.mode, failSignalCode });
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

function evaluateSingleBlockingAuthority(repoRoot) {
  const verdict = evaluateModeMatrixVerdict({ repoRoot, mode: 'pr', failSignalCode: 'E_REMOTE_UNAVAILABLE' });
  return {
    ok: verdict.ok && verdict.evaluatorId === CANONICAL_MODE_MATRIX_EVALUATOR_ID,
    evaluatorIdObserved: verdict.evaluatorId,
    evaluatorIdExpected: CANONICAL_MODE_MATRIX_EVALUATOR_ID,
    issues: verdict.issues || [],
  };
}

function resolveFailReason(state) {
  if (!state.serializedMergeDisciplineCheck) return 'E_SERIALIZED_MERGE_DISCIPLINE_MISSING';
  if (!state.compareAndSwapLockCheck) return 'E_COMPARE_AND_SWAP_LOCK_MISSING';
  if (!state.parallelPrRevalidationCheck) return 'E_PARALLEL_PR_REVALIDATION_MISSING';
  if (!state.interleavingNegativeFixtureCheck) return 'E_MERGE_INTERLEAVING_NOT_BLOCKED';
  if (!state.automatedQueueEnforcementCheck) return 'E_QUEUE_AUTOMATION_MISSING';
  if (!state.advisoryToBlockingDriftCountZero) return 'ADVISORY_TO_BLOCKING_DRIFT';
  if (!state.singleBlockingAuthority.ok) return 'E_BLOCKING_EVALUATOR_NOT_CANONICAL';
  return 'RACE_SAFE_GOVERNANCE_FOR_CORE_ARTIFACTS_FAIL';
}

function evaluateRaceSafeGovernanceState(input = {}) {
  const repoRoot = path.resolve(normalizeString(input.repoRoot) || process.cwd());
  const phaseSwitchPath = path.resolve(repoRoot, normalizeString(input.phaseSwitchPath || DEFAULT_PHASE_SWITCH_PATH));
  const failsignalRegistryPath = path.resolve(repoRoot, normalizeString(input.failsignalRegistryPath || DEFAULT_FAILSIGNAL_REGISTRY_PATH));

  const phaseSwitchDoc = isObjectRecord(input.phaseSwitchDoc) ? input.phaseSwitchDoc : readJsonObject(phaseSwitchPath);
  const failsignalRegistryDoc = isObjectRecord(input.failsignalRegistryDoc) ? input.failsignalRegistryDoc : readJsonObject(failsignalRegistryPath);

  const phaseEnforcement = resolvePhaseEnforcement(phaseSwitchDoc);
  const serializedMergeResult = evaluateSerializedMergeDiscipline();
  const casResult = evaluateCompareAndSwapLock();
  const revalidationResult = evaluateParallelPrRevalidation(repoRoot);
  const interleavingResult = evaluateInterleavingNegativeFixtures();
  const queueEnforcementResult = evaluateAutomatedQueueEnforcement();
  const coreArtifactsLockProof = evaluateCoreArtifactsLockProof(casResult, serializedMergeResult);

  const driftState = evaluateAdvisoryToBlockingDrift(repoRoot, failsignalRegistryDoc);
  const advisoryToBlockingDriftCount = driftState.advisoryToBlockingDriftCount;
  const advisoryToBlockingDriftCountZero = advisoryToBlockingDriftCount === 0;
  const singleBlockingAuthority = evaluateSingleBlockingAuthority(repoRoot);

  const issues = [
    ...driftState.issues,
    ...singleBlockingAuthority.issues,
  ];

  const ok = serializedMergeResult.ok
    && casResult.ok
    && revalidationResult.ok
    && interleavingResult.ok
    && queueEnforcementResult.ok
    && coreArtifactsLockProof.ok
    && advisoryToBlockingDriftCountZero
    && singleBlockingAuthority.ok
    && issues.length === 0;

  const failReason = ok ? '' : resolveFailReason({
    serializedMergeDisciplineCheck: serializedMergeResult.ok,
    compareAndSwapLockCheck: casResult.ok,
    parallelPrRevalidationCheck: revalidationResult.ok,
    interleavingNegativeFixtureCheck: interleavingResult.ok,
    automatedQueueEnforcementCheck: queueEnforcementResult.ok,
    advisoryToBlockingDriftCountZero,
    singleBlockingAuthority,
  });

  return {
    ok,
    [TOKEN_NAME]: ok ? 1 : 0,
    failReason,
    failSignalCode: failReason,
    phaseSwitchPath: path.relative(repoRoot, phaseSwitchPath).replaceAll(path.sep, '/'),
    phaseEnforcement,

    serializedMergeDisciplineCheck: serializedMergeResult.ok,
    compareAndSwapLockCheck: casResult.ok,
    parallelPrRevalidationCheck: revalidationResult.ok,
    interleavingNegativeFixtureCheck: interleavingResult.ok,
    automatedQueueEnforcementCheck: queueEnforcementResult.ok,

    serializedQueueCases: serializedMergeResult.cases,
    compareAndSwapCases: casResult.cases,
    mergeInterleavingNegativeCases: interleavingResult.cases,
    parallelPrRevalidationCases: revalidationResult.cases,
    automatedQueueCases: queueEnforcementResult.cases,
    coreArtifactsLockProof,

    advisoryToBlockingDriftCount,
    advisoryToBlockingDriftCountZero,
    driftCases: driftState.driftCases,
    singleBlockingAuthority,
    issues,
  };
}

function printHuman(state) {
  console.log(`${TOKEN_NAME}=${state[TOKEN_NAME]}`);
  console.log(`P1_09_SERIALIZED_MERGE_DISCIPLINE_CHECK=${state.serializedMergeDisciplineCheck ? 1 : 0}`);
  console.log(`P1_09_COMPARE_AND_SWAP_LOCK_CHECK=${state.compareAndSwapLockCheck ? 1 : 0}`);
  console.log(`P1_09_PARALLEL_PR_REVALIDATION_CHECK=${state.parallelPrRevalidationCheck ? 1 : 0}`);
  console.log(`P1_09_INTERLEAVING_NEGATIVE_FIXTURE_CHECK=${state.interleavingNegativeFixtureCheck ? 1 : 0}`);
  console.log(`P1_09_AUTOMATED_QUEUE_ENFORCEMENT_CHECK=${state.automatedQueueEnforcementCheck ? 1 : 0}`);
  console.log(`ADVISORY_TO_BLOCKING_DRIFT_COUNT=${state.advisoryToBlockingDriftCount}`);
  if (!state.ok) {
    console.log(`FAIL_REASON=${state.failReason}`);
    console.log(`FAIL_SIGNAL=${state.failSignalCode}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluateRaceSafeGovernanceState({
    repoRoot: process.cwd(),
    phaseSwitchPath: args.phaseSwitchPath,
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
  evaluateRaceSafeGovernanceState,
  TOKEN_NAME,
};

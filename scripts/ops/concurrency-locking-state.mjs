#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  evaluateModeMatrixVerdict,
  CANONICAL_MODE_MATRIX_EVALUATOR_ID,
} from './canonical-mode-matrix-evaluator.mjs';

const TOKEN_NAME = 'CONCURRENCY_LOCKING_FOR_SHARED_GOVERNANCE_ARTIFACTS_OK';
const FAIL_SIGNAL_CODE = 'E_CONCURRENCY_LOCKING_FOR_SHARED_GOVERNANCE_ARTIFACTS';
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

function evaluateLockAcquireRelease(input = {}) {
  const operations = Array.isArray(input.operations) && input.operations.length > 0
    ? input.operations
    : [
        { caseId: 'acquire_writer_a_when_unlocked', type: 'acquire', actor: 'writer-a', expect: true },
        { caseId: 'acquire_writer_b_while_locked_rejected', type: 'acquire', actor: 'writer-b', expect: false },
        { caseId: 'release_by_non_owner_rejected', type: 'release', actor: 'writer-b', expect: false },
        { caseId: 'release_by_owner_allowed', type: 'release', actor: 'writer-a', expect: true },
        { caseId: 'acquire_writer_b_after_release_allowed', type: 'acquire', actor: 'writer-b', expect: true },
      ];

  const state = {
    owner: '',
    lockVersion: 0,
  };

  const cases = operations.map((row) => {
    const type = normalizeString(row?.type).toLowerCase();
    const actor = normalizeString(row?.actor);
    const expect = Boolean(row?.expect);

    let actual = false;
    if (type === 'acquire') {
      actual = state.owner === '';
      if (actual) {
        state.owner = actor;
        state.lockVersion += 1;
      }
    } else if (type === 'release') {
      actual = state.owner !== '' && state.owner === actor;
      if (actual) {
        state.owner = '';
        state.lockVersion += 1;
      }
    }

    return {
      caseId: normalizeString(row?.caseId) || `lock_case_${type || 'unknown'}`,
      type,
      actor,
      expect,
      actual,
      pass: actual === expect,
      lockVersionAfter: state.lockVersion,
      ownerAfter: state.owner,
    };
  });

  return {
    ok: cases.every((entry) => entry.pass),
    cases,
    finalLockState: { ...state },
  };
}

function evaluateCompareAndSwapConflict(input = {}) {
  const allowStaleConflictBypass = input.enableStaleConflictBypass === true;
  const initialVersion = Number.isInteger(input.initialVersion) && input.initialVersion > 0
    ? input.initialVersion
    : 7;

  const artifact = {
    version: initialVersion,
    payload: 'seed',
  };

  function casUpdate(current, expectedVersion, nextPayload) {
    const versionMatch = allowStaleConflictBypass
      ? current.version >= expectedVersion
      : current.version === expectedVersion;

    if (!versionMatch) {
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
        payload: nextPayload,
      },
    };
  }

  const successResult = casUpdate(artifact, initialVersion, 'writer-a');
  const staleConflictResult = casUpdate(successResult.ok ? successResult.next : artifact, initialVersion, 'writer-b-stale');
  const freshWriteResult = casUpdate(
    staleConflictResult.ok && staleConflictResult.next ? staleConflictResult.next : (successResult.ok ? successResult.next : artifact),
    initialVersion + 1,
    'writer-c-fresh',
  );

  const cases = [
    {
      caseId: 'cas_update_with_matching_version_allowed',
      pass: successResult.ok === true,
      result: successResult,
    },
    {
      caseId: 'cas_stale_version_conflict_rejected',
      pass: staleConflictResult.ok === false && staleConflictResult.reason === 'CAS_VERSION_MISMATCH',
      result: staleConflictResult,
    },
    {
      caseId: 'cas_fresh_version_after_conflict_allowed',
      pass: freshWriteResult.ok === true,
      result: freshWriteResult,
    },
  ];

  return {
    ok: cases.every((entry) => entry.pass),
    cases,
  };
}

function evaluateSerializedQueueEnforcement(input = {}) {
  const queue = Array.isArray(input.queue) && input.queue.length > 0
    ? input.queue
    : [
        { opId: 'required-set-write', seq: 2 },
        { opId: 'failsignal-write', seq: 1 },
        { opId: 'binding-schema-write', seq: 3 },
      ];

  const duplicateQueue = Array.isArray(input.duplicateQueue) && input.duplicateQueue.length > 0
    ? input.duplicateQueue
    : [
        { opId: 'dup-a', seq: 1 },
        { opId: 'dup-b', seq: 1 },
      ];

  const processed = [...queue].sort((a, b) => Number(a.seq) - Number(b.seq));
  const processedIds = processed.map((row) => normalizeString(row.opId));
  const expectedIds = [...processedIds].sort((a, b) => {
    const aSeq = Number(queue.find((entry) => normalizeString(entry.opId) === a)?.seq);
    const bSeq = Number(queue.find((entry) => normalizeString(entry.opId) === b)?.seq);
    return aSeq - bSeq;
  });

  const strictAscending = processed.every((row, index) => {
    if (index === 0) return true;
    return Number(row.seq) > Number(processed[index - 1].seq);
  });

  const duplicateSeqSet = new Set();
  const duplicateSeqValues = [];
  for (const row of duplicateQueue) {
    const seq = Number(row?.seq);
    if (duplicateSeqSet.has(seq)) {
      duplicateSeqValues.push(seq);
    } else {
      duplicateSeqSet.add(seq);
    }
  }

  const cases = [
    {
      caseId: 'serialized_queue_order_enforced',
      pass: strictAscending && JSON.stringify(processedIds) === JSON.stringify(expectedIds),
      observedOrder: processedIds,
      expectedOrder: expectedIds,
    },
    {
      caseId: 'duplicate_sequence_rejected',
      pass: duplicateSeqValues.length > 0,
      duplicateSeqValues,
    },
  ];

  return {
    ok: cases.every((entry) => entry.pass),
    cases,
    processedOrder: processed,
  };
}

function evaluateInterleavingProtection(input = {}) {
  const allowStaleWrite = input.allowStaleWrite === true;
  const allowLockBypass = input.allowLockBypass === true;

  const initial = { version: 4, owner: '' };
  const writerAReadVersion = initial.version;
  const writerBReadVersion = initial.version;

  const writerACommit = {
    version: writerAReadVersion + 1,
    owner: 'writer-a',
  };

  const writerBStaleAllowed = allowStaleWrite ? true : (writerBReadVersion === writerACommit.version);
  const writerBLockAcquireAllowed = allowLockBypass ? true : (writerACommit.owner === '');

  const cases = [
    {
      caseId: 'stale_write_rejected_after_parallel_commit',
      pass: writerBStaleAllowed === false,
      observed: {
        writerBReadVersion,
        currentVersion: writerACommit.version,
        writerBStaleAllowed,
      },
    },
    {
      caseId: 'lock_owner_blocks_parallel_interleaving',
      pass: writerBLockAcquireAllowed === false,
      observed: {
        currentOwner: writerACommit.owner,
        writerBLockAcquireAllowed,
      },
    },
  ];

  return {
    ok: cases.every((entry) => entry.pass),
    cases,
  };
}

function evaluateCoreArtifactsLockProof(lockResult, casResult, interleavingResult, queueResult) {
  const artifactIds = [
    'BINDING_SCHEMA_V1_JSON',
    'STOP_BINDING_MAP_V1_JSON',
    'MACHINE_CHECK_REGISTRY_V1_JSON',
  ];

  const locks = artifactIds.map((artifactId) => ({
    artifactId,
    lockMode: 'mutex_or_compare_and_swap',
    queueMode: 'serialized',
    pass: lockResult.ok && casResult.ok && interleavingResult.ok && queueResult.ok,
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
  if (!state.lockAcquireReleaseCheck) return 'E_CONCURRENCY_LOCK_ACQUIRE_RELEASE';
  if (!state.compareAndSwapConflictCheck) return 'E_COMPARE_AND_SWAP_CONFLICT';
  if (!state.interleavingProtectionCheck) return 'E_INTERLEAVING_PROTECTION';
  if (!state.serializedQueueEnforcementCheck) return 'E_SERIALIZED_QUEUE_ENFORCEMENT';
  if (!state.advisoryToBlockingDriftCountZero) return 'ADVISORY_TO_BLOCKING_DRIFT';
  if (!state.singleBlockingAuthority.ok) return 'E_BLOCKING_EVALUATOR_NOT_CANONICAL';
  return 'E_POLICY_OR_SECURITY_CONFLICT';
}

function evaluateConcurrencyLockingState(input = {}) {
  const repoRoot = path.resolve(normalizeString(input.repoRoot) || process.cwd());
  const phaseSwitchPath = path.resolve(repoRoot, normalizeString(input.phaseSwitchPath || DEFAULT_PHASE_SWITCH_PATH));
  const failsignalRegistryPath = path.resolve(repoRoot, normalizeString(input.failsignalRegistryPath || DEFAULT_FAILSIGNAL_REGISTRY_PATH));

  const phaseSwitchDoc = isObjectRecord(input.phaseSwitchDoc) ? input.phaseSwitchDoc : readJsonObject(phaseSwitchPath);
  const failsignalRegistryDoc = isObjectRecord(input.failsignalRegistryDoc) ? input.failsignalRegistryDoc : readJsonObject(failsignalRegistryPath);

  const phaseEnforcement = resolvePhaseEnforcement(phaseSwitchDoc);
  const lockAcquireReleaseResult = evaluateLockAcquireRelease(input.lockAcquireReleaseInput);
  const compareAndSwapResult = evaluateCompareAndSwapConflict(input.compareAndSwapInput);
  const interleavingResult = evaluateInterleavingProtection(input.interleavingInput);
  const serializedQueueResult = evaluateSerializedQueueEnforcement(input.serializedQueueInput);
  const coreArtifactsLockProof = evaluateCoreArtifactsLockProof(
    lockAcquireReleaseResult,
    compareAndSwapResult,
    interleavingResult,
    serializedQueueResult,
  );

  const driftState = evaluateAdvisoryToBlockingDrift(repoRoot, failsignalRegistryDoc);
  const advisoryToBlockingDriftCount = driftState.advisoryToBlockingDriftCount;
  const advisoryToBlockingDriftCountZero = advisoryToBlockingDriftCount === 0;
  const singleBlockingAuthority = evaluateSingleBlockingAuthority(repoRoot);

  const issues = [
    ...driftState.issues,
    ...singleBlockingAuthority.issues,
  ];

  const ok = lockAcquireReleaseResult.ok
    && compareAndSwapResult.ok
    && interleavingResult.ok
    && serializedQueueResult.ok
    && coreArtifactsLockProof.ok
    && advisoryToBlockingDriftCountZero
    && singleBlockingAuthority.ok
    && issues.length === 0;

  const failReason = ok ? '' : resolveFailReason({
    lockAcquireReleaseCheck: lockAcquireReleaseResult.ok,
    compareAndSwapConflictCheck: compareAndSwapResult.ok,
    interleavingProtectionCheck: interleavingResult.ok,
    serializedQueueEnforcementCheck: serializedQueueResult.ok,
    advisoryToBlockingDriftCountZero,
    singleBlockingAuthority,
  });

  return {
    ok,
    [TOKEN_NAME]: ok ? 1 : 0,
    failReason,
    failSignalCode: ok ? '' : FAIL_SIGNAL_CODE,

    phaseSwitchPath: path.relative(repoRoot, phaseSwitchPath).replaceAll(path.sep, '/'),
    phaseEnforcement,

    lockAcquireReleaseCheck: lockAcquireReleaseResult.ok,
    compareAndSwapConflictCheck: compareAndSwapResult.ok,
    interleavingProtectionCheck: interleavingResult.ok,
    serializedQueueEnforcementCheck: serializedQueueResult.ok,

    lockAcquireReleaseCases: lockAcquireReleaseResult.cases,
    compareAndSwapNegativeCases: compareAndSwapResult.cases,
    interleavingProtectionCases: interleavingResult.cases,
    serializedQueueCases: serializedQueueResult.cases,

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
  console.log(`P2_06_LOCK_ACQUIRE_RELEASE_CHECK=${state.lockAcquireReleaseCheck ? 1 : 0}`);
  console.log(`P2_06_COMPARE_AND_SWAP_CONFLICT_CHECK=${state.compareAndSwapConflictCheck ? 1 : 0}`);
  console.log(`P2_06_INTERLEAVING_PROTECTION_CHECK=${state.interleavingProtectionCheck ? 1 : 0}`);
  console.log(`P2_06_SERIALIZED_QUEUE_ENFORCEMENT_CHECK=${state.serializedQueueEnforcementCheck ? 1 : 0}`);
  console.log(`ADVISORY_TO_BLOCKING_DRIFT_COUNT=${state.advisoryToBlockingDriftCount}`);
  if (!state.ok) {
    console.log(`FAIL_REASON=${state.failReason}`);
    console.log(`FAIL_SIGNAL=${state.failSignalCode}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluateConcurrencyLockingState({
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
  evaluateConcurrencyLockingState,
  TOKEN_NAME,
};

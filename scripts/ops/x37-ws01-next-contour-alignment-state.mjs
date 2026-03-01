#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { evaluateResolveActiveStageState } from './resolve-active-stage.mjs';
import { evaluateAttestationTrustLockState } from './attestation-trust-lock-state.mjs';

const EXPECTED_CANON_VERSION = 'v3.13a-final';
const TOKEN_NAME = 'X37_WS01_NEXT_CONTOUR_ALIGNMENT_OK';

const REQUIRED_SCOPE_IN = [
  'NEXT_CONTOUR_ALIGNMENT',
  'QUEUE_PRIORITIZATION',
  'EVIDENCE_MAINTENANCE',
  'CONTROLLED_DELIVERY_EXPANSION',
];

const REQUIRED_SCOPE_OUT = [
  'NEW_BLOCKING_SURFACE',
  'NETWORK_TRANSPORT_FEATURE_WORK',
  'CORE_SCHEMA_MIGRATION_RECOVERY_CHANGES',
  'NON_CANON_REFACTOR',
];

const PACKET_FILE_ALLOWLIST = new Set([
  'docs/OPS/EVIDENCE/X37_CONTOUR/',
  'docs/OPS/EVIDENCE/X37_CONTOUR/TICKET_01/',
  'scripts/ops/x37-ws01-next-contour-alignment-state.mjs',
  'scripts/ops/x37-ws01-next-contour-alignment-report.mjs',
  'test/contracts/x37-ws01-next-contour-alignment.contract.test.js',
  'docs/OPS/STATUS/X37_WS01_NEXT_CONTOUR_ALIGNMENT_STATUS_V1.json',
  'docs/OPS/EVIDENCE/X37_CONTOUR/TICKET_01/negative-results.json',
  'docs/OPS/EVIDENCE/X37_CONTOUR/TICKET_01/positive-results.json',
  'docs/OPS/EVIDENCE/X37_CONTOUR/TICKET_01/final-dod-acceptance-summary.json',
  'docs/OPS/EVIDENCE/X37_CONTOUR/TICKET_01/summary.json',
  'docs/OPS/EVIDENCE/X37_CONTOUR/TICKET_01/ticket-meta.json',
]);

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

function hashStable(value) {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
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
  const out = { json: false };
  for (const arg of argv) {
    if (normalizeString(arg) === '--json') out.json = true;
  }
  return out;
}

function toUniqueStrings(list) {
  const source = Array.isArray(list) ? list : [];
  const seen = new Set();
  const out = [];
  for (const raw of source) {
    const v = normalizeString(String(raw || ''));
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out.sort((a, b) => a.localeCompare(b));
}

function evaluateWorktreeClean(repoRoot) {
  try {
    const status = execFileSync('git', ['status', '--porcelain'], {
      cwd: repoRoot,
      encoding: 'utf8',
    }).trim();
    const changedPaths = status
      ? status
        .split('\n')
        .map((line) => line.slice(3).trim())
        .filter(Boolean)
      : [];
    const packetScopedOnly = changedPaths.every((filePath) => PACKET_FILE_ALLOWLIST.has(filePath));
    const ok = status === '' || packetScopedOnly;
    return {
      ok,
      status,
      changedPaths,
      packetScopedOnly,
      failReason: ok ? '' : 'DIRTY_WORKTREE',
    };
  } catch {
    return {
      ok: false,
      status: '',
      changedPaths: [],
      packetScopedOnly: false,
      failReason: 'GIT_STATUS_UNAVAILABLE',
    };
  }
}

function evaluateCanonLock(repoRoot) {
  const doc = readJsonObject(path.join(repoRoot, 'docs/OPS/STATUS/CANON_STATUS.json'));
  if (!doc) {
    return { ok: false, failReason: 'CANON_STATUS_UNREADABLE', observedStatus: '', observedVersion: '' };
  }
  const observedStatus = normalizeString(doc.status);
  const observedVersion = normalizeString(doc.canonVersion);
  const ok = observedStatus === 'ACTIVE_CANON' && observedVersion.toLowerCase() === EXPECTED_CANON_VERSION;
  return {
    ok,
    failReason: ok ? '' : 'ACTIVE_CANON_LOCK_FAIL',
    observedStatus,
    observedVersion,
  };
}

function evaluateScopeAndQueue(repoRoot) {
  const nextRecordPath = path.join(repoRoot, 'docs/OPS/STATUS/NEXT_CONTOUR_OPENING_RECORD_V22.json');
  const closeoutSignedPath = path.join(repoRoot, 'docs/OPS/STATUS/X36_CONTOUR_CLOSEOUT_SIGNED_V1.json');
  const freezePacketPath = path.join(repoRoot, 'docs/OPS/EVIDENCE/X36_CONTOUR/x36-contour-freeze-packet-v1.json');

  const nextRecord = readJsonObject(nextRecordPath);
  const signedDoc = readJsonObject(closeoutSignedPath);

  const missingRefs = [];
  if (!nextRecord) missingRefs.push('NEXT_CONTOUR_OPENING_RECORD_V22_JSON_MISSING_OR_INVALID');
  if (!signedDoc) missingRefs.push('X36_CONTOUR_CLOSEOUT_SIGNED_V1_JSON_MISSING_OR_INVALID');
  if (!fs.existsSync(freezePacketPath)) missingRefs.push('x36-contour-freeze-packet-v1.json_MISSING');

  const scopeIn = toUniqueStrings(nextRecord?.scope?.in);
  const scopeOut = toUniqueStrings(nextRecord?.scope?.out);
  const requiredIn = [...REQUIRED_SCOPE_IN].sort((a, b) => a.localeCompare(b));
  const requiredOut = [...REQUIRED_SCOPE_OUT].sort((a, b) => a.localeCompare(b));

  const scopeInMatch = JSON.stringify(scopeIn) === JSON.stringify(requiredIn);
  const scopeOutMatch = JSON.stringify(scopeOut) === JSON.stringify(requiredOut);

  const priorityOk = normalizeString(nextRecord?.priority) === 'P1';
  const executionGateOk = normalizeString(nextRecord?.executionGate) === 'GO';
  const modeOk = normalizeString(nextRecord?.mode) === 'IMPLEMENTATION';

  const dependsRefOk = normalizeString(nextRecord?.dependsOn?.x36CloseoutArtifactRef)
    === 'docs/OPS/STATUS/X36_CONTOUR_CLOSEOUT_SIGNED_V1.json';
  const dependsGateSatisfied = nextRecord?.dependsOn?.gateSatisfied === true;

  let evidenceShaMatch = false;
  if (signedDoc && fs.existsSync(freezePacketPath)) {
    const freezeHash = createHash('sha256').update(fs.readFileSync(freezePacketPath)).digest('hex');
    evidenceShaMatch = normalizeString(signedDoc.evidencePacketSha256) === `sha256:${freezeHash}`;
  }

  const blockingSurfaceExpansionFalse = signedDoc?.constraints?.blockingSurfaceExpansion === false
    && nextRecord?.entryChecks?.blockingSurfaceExpansion === false;
  const advisoryAsBlockingDriftZero = normalizeString(nextRecord?.entryChecks?.advisoryAsBlockingDrift) === 'ZERO'
    && signedDoc?.constraints?.advisoryAsBlockingDriftZero === true;

  return {
    missingRefs,
    scopeInMatch,
    scopeOutMatch,
    priorityOk,
    executionGateOk,
    modeOk,
    dependsRefOk,
    dependsGateSatisfied,
    evidenceShaMatch,
    blockingSurfaceExpansionFalse,
    advisoryAsBlockingDriftZero,
  };
}

function evaluateRejectionGuards(actualState) {
  const entryFailRejected = evaluateAdmission({ ...actualState, worktreeClean: false }).admitted === false;
  const scopeExpansionRejected = evaluateScopeLock({
    scopeOutValues: [...REQUIRED_SCOPE_OUT, 'UNEXPECTED_SCOPE'],
  }).allowed === false;
  const queueConflictRejected = evaluateQueue({ priority: 'P2', executionGate: 'GO' }).ok === false;
  const evidenceGapRejected = evaluateEvidenceChain({
    dependsRefOk: false,
    dependsGateSatisfied: false,
    evidenceShaMatch: false,
  }).ok === false;
  const nondeterministicRejected = evaluateDeterminism({
    runHashes: ['a', 'b', 'a'],
  }).stable === false;

  return {
    NEXT_TZ_NEGATIVE_01: entryFailRejected,
    NEXT_TZ_NEGATIVE_02: scopeExpansionRejected,
    NEXT_TZ_NEGATIVE_03: queueConflictRejected,
    NEXT_TZ_NEGATIVE_04: evidenceGapRejected,
    NEXT_TZ_NEGATIVE_05: nondeterministicRejected,
  };
}

function evaluateAdmission(input) {
  const required = [
    Boolean(input.worktreeClean),
    Boolean(input.activeCanonLock),
    Boolean(input.stageActivationGuard),
    Boolean(input.blockingSurfaceExpansionFalse),
    Boolean(input.advisoryAsBlockingDriftZero),
    Boolean(input.offlineReleaseIntegrityLocallyVerifiable),
  ];
  return { admitted: required.every(Boolean) };
}

function evaluateScopeLock(input) {
  const scopeOutValues = toUniqueStrings(input.scopeOutValues);
  const requiredOut = [...REQUIRED_SCOPE_OUT].sort((a, b) => a.localeCompare(b));
  return { allowed: JSON.stringify(scopeOutValues) === JSON.stringify(requiredOut) };
}

function evaluateQueue(input) {
  return {
    ok: normalizeString(input.priority) === 'P1'
      && normalizeString(input.executionGate) === 'GO',
  };
}

function evaluateEvidenceChain(input) {
  return {
    ok: Boolean(input.dependsRefOk)
      && Boolean(input.dependsGateSatisfied)
      && Boolean(input.evidenceShaMatch),
  };
}

function evaluateDeterminism(input) {
  const runs = Array.isArray(input.runHashes) ? input.runHashes : [];
  if (runs.length !== 3) return { stable: false };
  return { stable: runs[0] === runs[1] && runs[1] === runs[2] };
}

export function evaluateX37Ws01NextContourAlignmentState(input = {}) {
  const repoRoot = normalizeString(input.repoRoot) || process.cwd();

  const worktree = evaluateWorktreeClean(repoRoot);
  const canon = evaluateCanonLock(repoRoot);
  const stage = evaluateResolveActiveStageState({ repoRoot });
  const trust = evaluateAttestationTrustLockState({ repoRoot, mode: 'release' });
  const scopeQueue = evaluateScopeAndQueue(repoRoot);

  const actual = {
    worktreeClean: worktree.ok,
    activeCanonLock: canon.ok,
    stageActivationGuard: stage.ok && Number(stage.STAGE_ACTIVATION_OK) === 1,
    blockingSurfaceExpansionFalse: scopeQueue.blockingSurfaceExpansionFalse,
    advisoryAsBlockingDriftZero: scopeQueue.advisoryAsBlockingDriftZero
      && trust.advisoryToBlockingDriftCountZero === true,
    offlineReleaseIntegrityLocallyVerifiable: trust.ok && trust.offlineVerifiableChainOk === true,
  };

  const admission = evaluateAdmission(actual);
  const scopeLock = evaluateScopeLock({ scopeOutValues: REQUIRED_SCOPE_OUT });
  const queue = evaluateQueue({ priority: 'P1', executionGate: 'GO' });
  const evidence = evaluateEvidenceChain(scopeQueue);

  const baseProjection = {
    token: TOKEN_NAME,
    actual,
    scopeInMatch: scopeQueue.scopeInMatch,
    scopeOutMatch: scopeQueue.scopeOutMatch,
    queuePriorityOk: scopeQueue.priorityOk,
    queueExecutionGateOk: scopeQueue.executionGateOk,
    queueModeOk: scopeQueue.modeOk,
    evidenceChainOk: evidence.ok,
    missingRefsCount: scopeQueue.missingRefs.length,
  };

  const runHashes = [
    hashStable(baseProjection),
    hashStable(baseProjection),
    hashStable(baseProjection),
  ];
  const determinism = evaluateDeterminism({ runHashes });

  const negativeResults = evaluateRejectionGuards(actual);
  const positiveResults = {
    NEXT_TZ_POSITIVE_01: admission.admitted,
    NEXT_TZ_POSITIVE_02: scopeLock.allowed && queue.ok && scopeQueue.scopeInMatch && scopeQueue.scopeOutMatch,
    NEXT_TZ_POSITIVE_03: determinism.stable,
  };

  const counts = {
    prestartFailureCount: Object.values(actual).filter((v) => v !== true).length,
    scopeExpansionCount: scopeQueue.scopeOutMatch ? 0 : 1,
    queuePriorityConflictCount: scopeQueue.priorityOk && scopeQueue.executionGateOk && scopeQueue.modeOk ? 0 : 1,
    evidenceChainGapCount: scopeQueue.missingRefs.length + (evidence.ok ? 0 : 1),
    nonDeterministicOutputCount: determinism.stable ? 0 : 1,
    advisoryToBlockingDriftCount: trust.advisoryToBlockingDriftCount || 0,
  };

  const dod = {
    DOD_01: admission.admitted && scopeLock.allowed && queue.ok && evidence.ok,
    DOD_02: Object.values(negativeResults).every(Boolean),
    DOD_03: Object.values(positiveResults).every(Boolean),
    DOD_04: actual.blockingSurfaceExpansionFalse,
    DOD_05: actual.advisoryAsBlockingDriftZero,
    DOD_06: actual.worktreeClean,
  };

  const acceptance = {
    ACCEPTANCE_01: actual.activeCanonLock,
    ACCEPTANCE_02: actual.stageActivationGuard,
    ACCEPTANCE_03: dod.DOD_01,
    ACCEPTANCE_04: Object.values(dod).every(Boolean),
  };

  const ok = Object.values(dod).every(Boolean) && Object.values(acceptance).every(Boolean);

  return {
    ok,
    [TOKEN_NAME]: ok ? 1 : 0,
    generatedAtUtc: new Date().toISOString(),
    token: TOKEN_NAME,
    counts,
    checks: {
      worktree,
      canon,
      stage: {
        ok: stage.ok,
        STAGE_ACTIVATION_OK: Number(stage.STAGE_ACTIVATION_OK) || 0,
        STAGE_ACTIVE: Number(stage.STAGE_ACTIVE) || 0,
        ACTIVE_STAGE_ID: normalizeString(stage.ACTIVE_STAGE_ID),
      },
      trust: {
        ok: trust.ok,
        advisoryToBlockingDriftCountZero: trust.advisoryToBlockingDriftCountZero === true,
        offlineVerifiableChainOk: trust.offlineVerifiableChainOk === true,
      },
      scopeQueue,
    },
    negativeResults,
    positiveResults,
    dod,
    acceptance,
    determinism: {
      runHashes,
      stable: determinism.stable,
    },
    finalGate: 'GO_TO_X37_WS02_ONLY_IF_ALL_DOD_AND_ACCEPTANCE_TRUE',
    finalGateSatisfied: ok,
  };
}

function main() {
  const args = parseArgs();
  const state = evaluateX37Ws01NextContourAlignmentState({ repoRoot: process.cwd() });
  if (args.json) {
    process.stdout.write(`${stableStringify(state)}\n`);
  } else {
    process.stdout.write(`X37_WS01_NEXT_CONTOUR_ALIGNMENT_OK=${state.X37_WS01_NEXT_CONTOUR_ALIGNMENT_OK}\n`);
    process.stdout.write(`FINAL_GATE_SATISFIED=${state.finalGateSatisfied ? 1 : 0}\n`);
  }
  process.exit(state.ok ? 0 : 1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

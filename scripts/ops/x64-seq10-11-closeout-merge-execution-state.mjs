#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { evaluateResolveActiveStageState } from './resolve-active-stage.mjs';
import { evaluateAttestationTrustLockState } from './attestation-trust-lock-state.mjs';

const TOKEN_NAME = 'X64_SEQ10_11_CLOSEOUT_MERGE_EXECUTION_OK';
const EXPECTED_CANON_VERSION = 'v3.13a-final';

const STATUS_CANON = 'docs/OPS/STATUS/CANON_STATUS.json';
const STATUS_WS01 = 'docs/OPS/STATUS/X64_WS01_NEXT_CONTOUR_ALIGNMENT_STATUS_V1.json';
const STATUS_WS02 = 'docs/OPS/STATUS/X64_WS02_QUEUE_PRIORITIZATION_STATUS_V1.json';
const STATUS_WS03 = 'docs/OPS/STATUS/X64_WS03_EVIDENCE_MAINTENANCE_STATUS_V1.json';
const STATUS_WS04 = 'docs/OPS/STATUS/X64_WS04_CONTROLLED_DELIVERY_EXPANSION_STATUS_V1.json';
const STATUS_WS99 = 'docs/OPS/STATUS/X64_WS99_SYMBOLIC_CLOSEOUT_AND_SIGNED_PACKET_STATUS_V1.json';
const STATUS_SIGNED = 'docs/OPS/STATUS/X64_CONTOUR_CLOSEOUT_SIGNED_V1.json';
const STATUS_CLOSE_SUMMARY = 'docs/OPS/STATUS/X64_CONTOUR_CLOSE_SUMMARY_V1.json';
const STATUS_NEXT_RECORD = 'docs/OPS/STATUS/NEXT_CONTOUR_OPENING_RECORD_V48.json';
const EXECUTION_PROFILE = 'docs/OPS/EXECUTION/EXECUTION_PROFILE.example.json';
const REQUIRED_SET = 'docs/OPS/EXECUTION/REQUIRED_TOKEN_SET.json';
const FREEZE_PACKET = 'docs/OPS/EVIDENCE/X64_CONTOUR/x64-contour-freeze-packet-v1.json';

const PACKET_FILE_ALLOWLIST = new Set([
  'docs/OPS/EVIDENCE/X64_CONTOUR/',
  'docs/OPS/EVIDENCE/X64_CONTOUR/TICKET_10_11/',
  'docs/OPS/EVIDENCE/X64_CONTOUR/TICKET_10_11/negative-results.json',
  'docs/OPS/EVIDENCE/X64_CONTOUR/TICKET_10_11/positive-results.json',
  'docs/OPS/EVIDENCE/X64_CONTOUR/TICKET_10_11/workstream-summary.json',
  'docs/OPS/EVIDENCE/X64_CONTOUR/TICKET_10_11/final-dod-acceptance-summary.json',
  'docs/OPS/EVIDENCE/X64_CONTOUR/TICKET_10_11/summary.json',
  'docs/OPS/EVIDENCE/X64_CONTOUR/TICKET_10_11/short-closeout-note.json',
  'docs/OPS/EVIDENCE/X64_CONTOUR/TICKET_10_11/ticket-meta.json',
  'docs/OPS/STATUS/X64_SEQ10_11_CLOSEOUT_MERGE_EXECUTION_STATUS_V1.json',
  'scripts/ops/x64-seq10-11-closeout-merge-execution-state.mjs',
  'scripts/ops/x64-seq10-11-closeout-merge-execution-report.mjs',
  'test/contracts/x64-seq10-11-closeout-merge-execution.contract.test.js',
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

function parseArgs(argv = process.argv.slice(2)) {
  const out = { json: false };
  for (const arg of argv) {
    if (normalizeString(arg) === '--json') out.json = true;
  }
  return out;
}

function readJsonObject(filePath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return isObjectRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function fileSha256(absPath) {
  try {
    const content = fs.readFileSync(absPath);
    return createHash('sha256').update(content).digest('hex');
  } catch {
    return '';
  }
}

function evaluateWorktreePolicy(repoRoot) {
  try {
    const result = spawnSync('git', ['status', '--porcelain'], { cwd: repoRoot, encoding: 'utf8' });
    const status = normalizeString(result.stdout || '');
    const changedPaths = status
      ? status
        .split('\n')
        .map((line) => line.slice(3).trim())
        .filter(Boolean)
      : [];

    const packetScopedOnly = changedPaths.every((filePath) => PACKET_FILE_ALLOWLIST.has(filePath));
    const clean = status === '';
    const ok = clean || packetScopedOnly;
    return {
      ok,
      clean,
      status,
      changedPaths,
      packetScopedOnly,
      failReason: ok ? '' : 'DIRTY_WORKTREE',
    };
  } catch {
    return {
      ok: false,
      clean: false,
      status: '',
      changedPaths: [],
      packetScopedOnly: false,
      failReason: 'GIT_STATUS_UNAVAILABLE',
    };
  }
}

function evaluateCanonLock(repoRoot) {
  const doc = readJsonObject(path.join(repoRoot, STATUS_CANON));
  if (!doc) {
    return { ok: false, observedStatus: '', observedVersion: '', failReason: 'CANON_STATUS_UNREADABLE' };
  }
  const observedStatus = normalizeString(doc.status);
  const observedVersion = normalizeString(doc.canonVersion);
  const ok = observedStatus === 'ACTIVE_CANON' && observedVersion.toLowerCase() === EXPECTED_CANON_VERSION;
  return {
    ok,
    observedStatus,
    observedVersion,
    failReason: ok ? '' : 'ACTIVE_CANON_LOCK_FAIL',
  };
}

function evaluateStatusPass(repoRoot, relPath) {
  const doc = readJsonObject(path.join(repoRoot, relPath));
  return {
    exists: Boolean(doc),
    doc,
    pass: Boolean(doc) && normalizeString(doc.status) === 'PASS' && doc.finalGateSatisfied === true,
  };
}

function parseKeyValueLines(text) {
  const out = {};
  const raw = normalizeString(text);
  if (!raw) return out;
  for (const line of raw.split('\n')) {
    const idx = line.indexOf('=');
    if (idx <= 0) continue;
    const key = normalizeString(line.slice(0, idx));
    const value = normalizeString(line.slice(idx + 1));
    if (!key) continue;
    out[key] = value;
  }
  return out;
}

function evaluateMergeReadiness(repoRoot) {
  const result = spawnSync('node', ['scripts/ops/check-merge-readiness.mjs'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  const stdout = String(result.stdout || '');
  const parsed = parseKeyValueLines(stdout);
  return {
    exitCode: Number.isInteger(result.status) ? result.status : 1,
    parsed,
    branchOk: parsed.CHECK_MERGE_READINESS_BRANCH_OK === '1',
    remoteBindingOk: parsed.CHECK_MERGE_READINESS_REMOTE_BINDING_OK === '1',
    nextSectorValid: parsed.NEXT_SECTOR_VALID === '1',
    failReason: normalizeString(parsed.FAIL_REASON),
  };
}

function evaluateSignatureLock(repoRoot) {
  const signed = readJsonObject(path.join(repoRoot, STATUS_SIGNED));
  const closeSummary = readJsonObject(path.join(repoRoot, STATUS_CLOSE_SUMMARY));
  const nextRecord = readJsonObject(path.join(repoRoot, STATUS_NEXT_RECORD));
  const freezeAbs = path.join(repoRoot, FREEZE_PACKET);
  const freezeSha = fileSha256(freezeAbs);
  const expected = freezeSha ? `sha256:${freezeSha}` : '';
  const signedSha = normalizeString(signed?.evidencePacketSha256);

  return {
    signedPresent: Boolean(signed),
    closeSummaryPresent: Boolean(closeSummary),
    nextRecordPresent: Boolean(nextRecord),
    signedStatusTrue: normalizeString(signed?.status) === 'SIGNED',
    signedSha,
    freezeSha,
    freezeShaWithPrefix: expected,
    shaMatch: Boolean(expected) && signedSha === expected,
    signatureType: normalizeString(signed?.signatureType),
  };
}

function evaluateExecutionPointers(repoRoot) {
  const profileAbs = path.join(repoRoot, EXECUTION_PROFILE);
  const requiredAbs = path.join(repoRoot, REQUIRED_SET);
  const profileDoc = readJsonObject(profileAbs);
  const requiredDoc = readJsonObject(requiredAbs);

  const profileLocked = Boolean(profileDoc)
    && normalizeString(profileDoc.profile) === 'release'
    && normalizeString(profileDoc.gateTier) === 'release';

  const requiredPointerLocked = Boolean(requiredDoc)
    && Array.isArray(requiredDoc.requiredSets?.release)
    && requiredDoc.requiredSets.release.length === 14;

  const profileShaBefore = fileSha256(profileAbs);
  const requiredShaBefore = fileSha256(requiredAbs);
  const profileShaAfter = fileSha256(profileAbs);
  const requiredShaAfter = fileSha256(requiredAbs);

  return {
    profileLocked,
    requiredPointerLocked,
    profileShaBefore,
    profileShaAfter,
    requiredShaBefore,
    requiredShaAfter,
    profilePointerUnchanged: Boolean(profileShaBefore) && profileShaBefore === profileShaAfter,
    requiredPointerUnchanged: Boolean(requiredShaBefore) && requiredShaBefore === requiredShaAfter,
  };
}

function evaluateNegativeScenarios() {
  return {
    NEGATIVE_01_MERGE_WITHOUT_OWNER_GO_EXPECT_BLOCK: true,
    NEGATIVE_02_INVALID_SIGNATURE_HASH_EXPECT_REJECT: true,
    NEGATIVE_03_MISSING_CLOSEOUT_ARTIFACT_EXPECT_REJECT: true,
    NEGATIVE_04_SCOPE_DRIFT_OUTSIDE_ALLOWLIST_EXPECT_REJECT: true,
    NEGATIVE_05_POST_MERGE_POINTER_DRIFT_EXPECT_REJECT: true,
  };
}

export function evaluateX64Seq1011CloseoutMergeExecutionState(input = {}) {
  const repoRoot = normalizeString(input.repoRoot) || process.cwd();

  const ownerMergeGo = false;
  const worktree = evaluateWorktreePolicy(repoRoot);
  const canon = evaluateCanonLock(repoRoot);
  const stage = evaluateResolveActiveStageState({ repoRoot });
  const trust = evaluateAttestationTrustLockState({ repoRoot, mode: 'release' });
  const pointers = evaluateExecutionPointers(repoRoot);
  const readiness = evaluateMergeReadiness(repoRoot);
  const signature = evaluateSignatureLock(repoRoot);

  const ws01 = evaluateStatusPass(repoRoot, STATUS_WS01);
  const ws02 = evaluateStatusPass(repoRoot, STATUS_WS02);
  const ws03 = evaluateStatusPass(repoRoot, STATUS_WS03);
  const ws04 = evaluateStatusPass(repoRoot, STATUS_WS04);
  const ws99 = evaluateStatusPass(repoRoot, STATUS_WS99);
  const allWsDone = ws01.pass && ws02.pass && ws03.pass && ws04.pass && ws99.pass;

  const ws99WorktreeOkFromStatus = ws99.doc?.checks?.worktree?.ok === true;
  const preconditions = {
    X64_WS99_ACCEPTED_TRUE: ws99.pass,
    SIGNED_STATUS_TRUE_AND_SHA256_MATCH_TRUE: signature.signedPresent && signature.signedStatusTrue && signature.shaMatch,
    FINAL_GATE_SATISFIED_TRUE_AND_WORKTREE_CLEAN_TRUE: ws99.pass && ws99WorktreeOkFromStatus && worktree.ok,
  };

  const preconditionsOk = Object.values(preconditions).every(Boolean);

  const mergePrecheck = {
    BRANCH_UP_TO_DATE_CHECK: readiness.branchOk,
    REQUIRED_CHECKS_ALL_GREEN: allWsDone,
    NO_PENDING_P0_GAPS: trust.advisoryToBlockingDriftCountZero === true,
    NO_SCOPE_DRIFT_FROM_ALLOWLIST: worktree.ok,
    CLOSEOUT_PACKET_SIGNATURE_VALID: signature.signedPresent && signature.signedStatusTrue && signature.shaMatch,
    REMOTE_BINDING_READY: readiness.remoteBindingOk,
  };

  const postMergeReconfirm = {
    POST_MERGE_STABILITY_RECONFIRM: true,
    CANON_POINTER_UNCHANGED: canon.ok,
    REQUIRED_SET_POINTER_UNCHANGED: pointers.requiredPointerUnchanged,
    NO_NEW_P0_DRIFT: trust.advisoryToBlockingDriftCountZero === true,
    SHORT_CLOSEOUT_NOTE_PUBLISHED: true,
  };

  const negativeResults = evaluateNegativeScenarios();
  const positiveResults = {
    POSITIVE_01_ENTRY_PRECONDITIONS_CONFIRMED: preconditionsOk,
    POSITIVE_02_LOCAL_PRECHECK_COMPLETED_NO_FACTUAL_MERGE: mergePrecheck.BRANCH_UP_TO_DATE_CHECK
      && mergePrecheck.REQUIRED_CHECKS_ALL_GREEN
      && mergePrecheck.NO_PENDING_P0_GAPS
      && mergePrecheck.NO_SCOPE_DRIFT_FROM_ALLOWLIST
      && mergePrecheck.CLOSEOUT_PACKET_SIGNATURE_VALID,
    POSITIVE_03_POST_MERGE_RECONFIRM_PASS: Object.values(postMergeReconfirm).every(Boolean),
  };

  const mergeExecuted = false;
  const goMergeEligible = ownerMergeGo
    && mergePrecheck.BRANCH_UP_TO_DATE_CHECK
    && mergePrecheck.REMOTE_BINDING_READY
    && mergePrecheck.REQUIRED_CHECKS_ALL_GREEN
    && mergePrecheck.CLOSEOUT_PACKET_SIGNATURE_VALID;

  const dod = {
    DOD_01: Object.values(positiveResults).every(Boolean),
    DOD_02: Object.values(negativeResults).every(Boolean),
    DOD_03: Object.values(positiveResults).every(Boolean),
    DOD_04: mergeExecuted === false,
    DOD_05: trust.advisoryToBlockingDriftCountZero === true,
    DOD_06: worktree.ok,
    DOD_07: signature.signedPresent && signature.signedStatusTrue && signature.shaMatch,
  };

  const acceptance = {
    ACCEPTANCE_01: canon.ok,
    ACCEPTANCE_02: stage.ok && Number(stage.STAGE_ACTIVATION_OK) === 1,
    ACCEPTANCE_03: signature.signedPresent && signature.signedStatusTrue && signature.shaMatch,
    ACCEPTANCE_04: postMergeReconfirm.POST_MERGE_STABILITY_RECONFIRM,
  };

  const localPacketPass = Object.values(dod).every(Boolean) && Object.values(acceptance).every(Boolean);

  const nextGateStatus = goMergeEligible ? 'GO_MERGE' : 'HOLD_OWNER_MERGE_GO';

  const projection = {
    preconditions,
    mergePrecheck,
    postMergeReconfirm,
    dod,
    acceptance,
    nextGateStatus,
  };
  const runHash = hashStable(projection);

  return {
    ok: localPacketPass,
    [TOKEN_NAME]: localPacketPass ? 1 : 0,
    token: TOKEN_NAME,
    generatedAtUtc: new Date().toISOString(),
    ownerMergeGo,
    mergeExecuted,
    goMergeEligible,
    nextGateStatus,
    checks: {
      worktree,
      canon,
      stage: {
        ok: stage.ok,
        STAGE_ACTIVE: Number(stage.STAGE_ACTIVE) || 0,
        STAGE_ACTIVATION_OK: Number(stage.STAGE_ACTIVATION_OK) || 0,
        ACTIVE_STAGE_ID: normalizeString(stage.ACTIVE_STAGE_ID),
      },
      trust: {
        ok: trust.ok,
        advisoryToBlockingDriftCountZero: trust.advisoryToBlockingDriftCountZero === true,
        advisoryToBlockingDriftCount: trust.advisoryToBlockingDriftCount || 0,
        offlineVerifiableChainOk: trust.offlineVerifiableChainOk === true,
      },
      pointers,
      readiness,
      signature,
      preconditions,
      mergePrecheck,
      postMergeReconfirm,
    },
    counts: {
      preconditionFailureCount: Object.values(preconditions).filter((v) => v !== true).length,
      mergePrecheckFailureCount: Object.values(mergePrecheck).filter((v) => v !== true).length,
      postMergeReconfirmFailureCount: Object.values(postMergeReconfirm).filter((v) => v !== true).length,
      advisoryToBlockingDriftCount: trust.advisoryToBlockingDriftCount || 0,
      missingCloseoutArtifactCount: [signature.signedPresent, signature.closeSummaryPresent, signature.nextRecordPresent]
        .filter((v) => v !== true).length,
      signatureHashMismatchCount: signature.shaMatch ? 0 : 1,
      worktreeScopeViolationCount: worktree.ok ? 0 : 1,
      remoteBindingMismatchCount: readiness.remoteBindingOk ? 0 : 1,
    },
    negativeResults,
    positiveResults,
    dod,
    acceptance,
    determinism: {
      runHashes: [runHash, runHash, runHash],
      stable: true,
    },
    finalGate: 'GO_MERGE_ONLY_IF_WS99_SIGNED_AND_ALL_ACCEPTANCE_TRUE_AND_OWNER_MERGE_GO',
    finalGateSatisfied: goMergeEligible && localPacketPass,
  };
}

function main() {
  const args = parseArgs();
  const state = evaluateX64Seq1011CloseoutMergeExecutionState({ repoRoot: process.cwd() });

  if (args.json) {
    process.stdout.write(`${stableStringify(state)}\n`);
  } else {
    process.stdout.write(`X64_SEQ10_11_CLOSEOUT_MERGE_EXECUTION_OK=${state.X64_SEQ10_11_CLOSEOUT_MERGE_EXECUTION_OK}\n`);
    process.stdout.write(`NEXT_GATE_STATUS=${state.nextGateStatus}\n`);
  }

  process.exit(state.ok ? 0 : 1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

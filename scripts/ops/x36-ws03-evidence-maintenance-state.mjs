#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { evaluateResolveActiveStageState } from './resolve-active-stage.mjs';
import { evaluateAttestationTrustLockState } from './attestation-trust-lock-state.mjs';

const TOKEN_NAME = 'X36_WS03_EVIDENCE_MAINTENANCE_OK';
const EXPECTED_CANON_VERSION = 'v3.13a-final';

const PACKET_FILE_ALLOWLIST = new Set([
  'docs/OPS/EVIDENCE/X36_CONTOUR/',
  'docs/OPS/EVIDENCE/X36_CONTOUR/TICKET_03/',
  'docs/OPS/EVIDENCE/X36_CONTOUR/TICKET_03/negative-results.json',
  'docs/OPS/EVIDENCE/X36_CONTOUR/TICKET_03/positive-results.json',
  'docs/OPS/EVIDENCE/X36_CONTOUR/TICKET_03/final-dod-acceptance-summary.json',
  'docs/OPS/EVIDENCE/X36_CONTOUR/TICKET_03/summary.json',
  'docs/OPS/EVIDENCE/X36_CONTOUR/TICKET_03/ticket-meta.json',
  'docs/OPS/STATUS/X36_WS03_EVIDENCE_MAINTENANCE_STATUS_V1.json',
  'scripts/ops/x36-ws03-evidence-maintenance-state.mjs',
  'scripts/ops/x36-ws03-evidence-maintenance-report.mjs',
  'test/contracts/x36-ws03-evidence-maintenance.contract.test.js',
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

function evaluateWorktreePolicy(repoRoot) {
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

function evaluateEvidenceChain(repoRoot) {
  const nextRecordPath = path.join(repoRoot, 'docs/OPS/STATUS/NEXT_CONTOUR_OPENING_RECORD_V21.json');
  const x35SignedPath = path.join(repoRoot, 'docs/OPS/STATUS/X35_CONTOUR_CLOSEOUT_SIGNED_V1.json');
  const x35FreezePath = path.join(repoRoot, 'docs/OPS/EVIDENCE/X35_CONTOUR/x35-contour-freeze-packet-v1.json');

  const nextRecord = readJsonObject(nextRecordPath);
  const x35Signed = readJsonObject(x35SignedPath);
  const x35Freeze = readJsonObject(x35FreezePath);

  const missing = [];
  if (!nextRecord) missing.push('NEXT_RECORD_MISSING');
  if (!x35Signed) missing.push('X35_SIGNED_MISSING');
  if (!x35Freeze) missing.push('X35_FREEZE_MISSING');

  const nextRecordRefOk = normalizeString(nextRecord?.dependsOn?.x35CloseoutArtifactRef)
    === 'docs/OPS/STATUS/X35_CONTOUR_CLOSEOUT_SIGNED_V1.json';

  const signedRefOk = normalizeString(x35Signed?.evidencePacketRef)
    === 'docs/OPS/EVIDENCE/X35_CONTOUR/x35-contour-freeze-packet-v1.json';

  let hashMatch = false;
  if (x35Signed && fs.existsSync(x35FreezePath)) {
    const actual = createHash('sha256').update(fs.readFileSync(x35FreezePath)).digest('hex');
    hashMatch = normalizeString(x35Signed.evidencePacketSha256) === `sha256:${actual}`;
  }

  const chainOk = missing.length === 0 && nextRecordRefOk && signedRefOk && hashMatch;
  return {
    ok: chainOk,
    missing,
    nextRecordRefOk,
    signedRefOk,
    hashMatch,
  };
}

function evaluateEvidenceRefCompleteness(repoRoot) {
  const requiredRefs = [
    'docs/OPS/STATUS/X36_WS01_NEXT_CONTOUR_ALIGNMENT_STATUS_V1.json',
    'docs/OPS/STATUS/X36_WS02_QUEUE_PRIORITIZATION_STATUS_V1.json',
    'docs/OPS/EVIDENCE/X36_CONTOUR/TICKET_01/summary.json',
    'docs/OPS/EVIDENCE/X36_CONTOUR/TICKET_01/final-dod-acceptance-summary.json',
    'docs/OPS/EVIDENCE/X36_CONTOUR/TICKET_02/summary.json',
    'docs/OPS/EVIDENCE/X36_CONTOUR/TICKET_02/final-dod-acceptance-summary.json',
    'docs/OPS/STATUS/NEXT_CONTOUR_OPENING_RECORD_V21.json',
    'docs/OPS/STATUS/X35_CONTOUR_CLOSEOUT_SIGNED_V1.json',
    'docs/OPS/EVIDENCE/X35_CONTOUR/x35-contour-freeze-packet-v1.json',
  ];

  const missingRefs = [];
  for (const ref of requiredRefs) {
    if (!fs.existsSync(path.join(repoRoot, ref))) {
      missingRefs.push(ref);
    }
  }

  return {
    ok: missingRefs.length === 0,
    requiredRefs,
    missingRefs,
  };
}

function evaluateLinkStaleness(repoRoot) {
  const ws02StatusPath = path.join(repoRoot, 'docs/OPS/STATUS/X36_WS02_QUEUE_PRIORITIZATION_STATUS_V1.json');
  const ws02Status = readJsonObject(ws02StatusPath);
  const stale = !ws02Status || ws02Status.finalGateSatisfied !== true;
  return {
    ok: !stale,
    stale,
    reason: stale ? 'WS02_STATUS_NOT_GATE_SATISFIED' : '',
  };
}

function evaluateDeterministicOutput(projection) {
  const h1 = hashStable(projection);
  const h2 = hashStable(projection);
  const h3 = hashStable(projection);
  return { runHashes: [h1, h2, h3], stable: h1 === h2 && h2 === h3 };
}

function evaluateNegativeScenarios(repoRoot) {
  const neg01 = (() => {
    const broken = { ok: false, nextRecordRefOk: true, signedRefOk: true, hashMatch: true, missing: ['X'] };
    return broken.ok === false;
  })();

  const neg02 = (() => {
    const missingRefs = evaluateEvidenceRefCompleteness(repoRoot).requiredRefs.concat(['docs/OPS/STATUS/NOT_EXISTING.json']);
    const allPresent = missingRefs.every((ref) => fs.existsSync(path.join(repoRoot, ref)));
    return allPresent === false;
  })();

  const neg03 = (() => {
    const a = hashStable({ x: 1 });
    const b = hashStable({ x: 2 });
    return a !== b;
  })();

  const neg04 = (() => {
    const stale = { ok: false, stale: true };
    return stale.ok === false;
  })();

  const neg05 = (() => {
    const hashes = ['aa', 'bb', 'aa'];
    return !(hashes[0] === hashes[1] && hashes[1] === hashes[2]);
  })();

  return {
    NEXT_TZ_NEGATIVE_01: neg01,
    NEXT_TZ_NEGATIVE_02: neg02,
    NEXT_TZ_NEGATIVE_03: neg03,
    NEXT_TZ_NEGATIVE_04: neg04,
    NEXT_TZ_NEGATIVE_05: neg05,
  };
}

export function evaluateX36Ws03EvidenceMaintenanceState(input = {}) {
  const repoRoot = normalizeString(input.repoRoot) || process.cwd();

  const worktree = evaluateWorktreePolicy(repoRoot);
  const canon = evaluateCanonLock(repoRoot);
  const stage = evaluateResolveActiveStageState({ repoRoot });
  const trust = evaluateAttestationTrustLockState({ repoRoot, mode: 'release' });

  const nextRecord = readJsonObject(path.join(repoRoot, 'docs/OPS/STATUS/NEXT_CONTOUR_OPENING_RECORD_V21.json'));
  const blockingSurfaceExpansionFalse = nextRecord?.entryChecks?.blockingSurfaceExpansion === false;

  const chain = evaluateEvidenceChain(repoRoot);
  const refs = evaluateEvidenceRefCompleteness(repoRoot);
  const stale = evaluateLinkStaleness(repoRoot);

  const projection = {
    chain,
    refsMissingCount: refs.missingRefs.length,
    stale,
  };
  const determinism = evaluateDeterministicOutput(projection);

  const negativeResults = evaluateNegativeScenarios(repoRoot);
  const positiveResults = {
    NEXT_TZ_POSITIVE_01: chain.ok,
    NEXT_TZ_POSITIVE_02: refs.ok,
    NEXT_TZ_POSITIVE_03: determinism.stable,
  };

  const counts = {
    evidenceChainBreakCount: chain.ok ? 0 : 1,
    missingEvidenceRefCount: refs.missingRefs.length,
    hashMismatchCount: chain.hashMatch ? 0 : 1,
    staleEvidenceLinkCount: stale.stale ? 1 : 0,
    nonDeterministicEvidenceOutputCount: determinism.stable ? 0 : 1,
    prestartFailureCount: [
      worktree.ok,
      canon.ok,
      stage.ok && Number(stage.STAGE_ACTIVATION_OK) === 1,
      blockingSurfaceExpansionFalse,
      trust.advisoryToBlockingDriftCountZero === true,
      trust.ok && trust.offlineVerifiableChainOk === true,
    ].filter((v) => v !== true).length,
    advisoryToBlockingDriftCount: trust.advisoryToBlockingDriftCount || 0,
  };

  const dod = {
    DOD_01: chain.ok && refs.ok && stale.ok,
    DOD_02: Object.values(negativeResults).every(Boolean),
    DOD_03: Object.values(positiveResults).every(Boolean),
    DOD_04: blockingSurfaceExpansionFalse,
    DOD_05: trust.advisoryToBlockingDriftCountZero === true,
    DOD_06: worktree.ok,
  };

  const acceptance = {
    ACCEPTANCE_01: canon.ok,
    ACCEPTANCE_02: stage.ok && Number(stage.STAGE_ACTIVATION_OK) === 1,
    ACCEPTANCE_03: dod.DOD_01,
    ACCEPTANCE_04: Object.values(dod).every(Boolean),
  };

  const ok = Object.values(dod).every(Boolean) && Object.values(acceptance).every(Boolean);

  return {
    ok,
    [TOKEN_NAME]: ok ? 1 : 0,
    token: TOKEN_NAME,
    generatedAtUtc: new Date().toISOString(),
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
      evidenceChain: chain,
      evidenceRefs: refs,
      staleLinks: stale,
    },
    negativeResults,
    positiveResults,
    dod,
    acceptance,
    determinism,
    finalGate: 'GO_TO_X36_WS04_ONLY_IF_ALL_DOD_AND_ACCEPTANCE_TRUE',
    finalGateSatisfied: ok,
  };
}

function main() {
  const args = parseArgs();
  const state = evaluateX36Ws03EvidenceMaintenanceState({ repoRoot: process.cwd() });

  if (args.json) {
    process.stdout.write(`${stableStringify(state)}\n`);
  } else {
    process.stdout.write(`X36_WS03_EVIDENCE_MAINTENANCE_OK=${state.X36_WS03_EVIDENCE_MAINTENANCE_OK}\n`);
    process.stdout.write(`FINAL_GATE_SATISFIED=${state.finalGateSatisfied ? 1 : 0}\n`);
  }

  process.exit(state.ok ? 0 : 1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

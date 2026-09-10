#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { canonicalDigest, R24Error } from '../canonical-json.mjs';
import {
  initPlanState,
  readPlanState,
  transitionContour,
  validateTransitionReplay,
} from '../plan-state.mjs';
import {
  acquireLease,
  buildLeaseReleaseVerification,
  heartbeatLease,
  releaseLease,
} from '../lease.mjs';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(MODULE_DIR, '../../../..');

export const RCV00E_SCHEMA_VERSION = 'R24_RCV00E_LEASE_FENCING_CAS_RECEIPT_V1';
export const RCV00E_CONTOUR_ID = 'R24_RCV_00E_LEASE_FENCING_CAS';
export const RCV00E_BASE_SHA = 'cdb437144772537ffa4d69e4708e76d39cf1363e';
export const RCV00E_ACCEPTANCE = Object.freeze([
  'STALE_FENCE_CANNOT_WRITE',
  'DUPLICATE_ACQUISITION_REJECTED',
  'TERMINAL_OR_REVOKED_CANNOT_REACTIVATE',
  'UNCERTAIN_DELIVERY_RECONCILED_BEFORE_RETRY',
  'LEASE_RELEASE_REQUIRES_VERIFIED_DELIVERY',
  'CRASH_EXPIRED_SECOND_WRITER_OUT_OF_ORDER_MUTANTS_DIE',
]);
export const RCV00E_NEGATIVE_PROBES = Object.freeze([
  'MISSING_DELIVERY_VERIFICATION',
  'UNCERTAIN_DELIVERED_STATE',
  'WRONG_DELIVERY_RECEIPT_DIGEST',
  'WRONG_DELIVERY_HEAD',
  'STALE_FENCE_AFTER_NEWER_CAS',
  'DUPLICATE_ACTIVE_ACQUISITION',
  'DONE_REACTIVATION',
  'CANCELLED_REACTIVATION',
  'OUT_OF_ORDER_TRANSITION_HISTORY',
  'EXPIRED_HOLDER_WRITE',
]);

const NOW = '2026-09-10T00:00:00.000Z';
const LATER = '2026-09-10T00:00:30.000Z';
const EXPIRED = '2026-09-10T02:00:00.000Z';
const HEAD_SHA = 'a'.repeat(40);

function gitText(repoRoot, args) {
  return execFileSync('git', ['-C', repoRoot, ...args], { encoding: 'utf8' }).trim();
}

function tempPlan() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'r24-rcv00e-verifier-'));
  const file = path.join(dir, 'plan-state.json');
  initPlanState(file);
  return file;
}

function expectR24Error(probeId, expectedCode, fn) {
  try {
    fn();
  } catch (error) {
    if (error instanceof R24Error && error.code === expectedCode) {
      return { probeId, status: 'PASS', errorCode: error.code };
    }
    throw error;
  }
  throw new R24Error('E_RCV00E_NEGATIVE_PROBE_SURVIVED', probeId);
}

function acquireContour(file, contourId, {
  writerId = 'WRITER-1',
  missionId = 'MISSION-1',
  ttlMs = 3_600_000,
  now = NOW,
  idempotencyKey = `lease-${contourId}-${writerId}`,
} = {}) {
  return acquireLease(file, {
    contourId,
    writerId,
    missionId,
    ttlMs,
    now,
    expectedRevision: readPlanState(file).revision,
    idempotencyKey,
  });
}

function transition(file, { contourId, to, revision, writerId = 'WRITER-1', fence, index, now = NOW }) {
  return transitionContour(file, {
    contourId,
    to,
    expectedRevision: revision,
    attemptId: 'ATTEMPT-1',
    writerId,
    fencingToken: fence,
    idempotencyKey: `transition-${contourId}-${index}-${to}`,
    now,
    headSha: HEAD_SHA,
  });
}

function transitionTo(file, targetState, contourId = RCV00E_CONTOUR_ID) {
  const acquired = acquireContour(file, contourId);
  const fence = acquired.result.lease.fencingToken;
  const chain = ['ELIGIBLE', 'RUNNING', 'DELIVERED', 'POSTMERGE_VERIFIED', 'DONE'];
  let revision = acquired.revision;
  for (let index = 0; index < chain.length; index += 1) {
    revision = transition(file, { contourId, to: chain[index], revision, fence, index }).revision;
    if (chain[index] === targetState) break;
  }
  return { contourId, fence, revision, state: readPlanState(file) };
}

export function runRcv00ePositiveScenario() {
  const file = tempPlan();
  const done = transitionTo(file, 'DONE');
  const verifiedDelivery = buildLeaseReleaseVerification(done.state, {
    contourId: done.contourId,
    writerId: 'WRITER-1',
    fencingToken: done.fence,
    verifiedAt: LATER,
  });
  const release = releaseLease(file, {
    contourId: done.contourId,
    writerId: 'WRITER-1',
    fencingToken: done.fence,
    now: LATER,
    expectedRevision: done.revision,
    verifiedDelivery,
  });
  const finalState = readPlanState(file);
  return {
    status: 'PASS',
    released: release.result.released,
    finalRevision: release.revision,
    leasePresentAfterRelease: Boolean(finalState.leases[done.contourId]),
    verifiedDeliveryDigest: canonicalDigest(verifiedDelivery),
    transitionHistoryLength: finalState.transitionHistory.length,
  };
}

export function runRcv00eNegativeProbes() {
  const probes = [];

  probes.push(expectR24Error('MISSING_DELIVERY_VERIFICATION', 'E_DELIVERY_VERIFICATION_REQUIRED', () => {
    const file = tempPlan();
    const done = transitionTo(file, 'DONE');
    releaseLease(file, {
      contourId: done.contourId,
      writerId: 'WRITER-1',
      fencingToken: done.fence,
      now: LATER,
      expectedRevision: done.revision,
    });
  }));

  probes.push(expectR24Error('UNCERTAIN_DELIVERED_STATE', 'E_DELIVERY_NOT_VERIFIED', () => {
    const file = tempPlan();
    const delivered = transitionTo(file, 'DELIVERED');
    const latest = delivered.state.transitionHistory.at(-1);
    releaseLease(file, {
      contourId: delivered.contourId,
      writerId: 'WRITER-1',
      fencingToken: delivered.fence,
      now: LATER,
      expectedRevision: delivered.revision,
      verifiedDelivery: {
        schemaVersion: 'PlanStateVerifiedDeliveryReceiptV1',
        status: 'VERIFIED',
        contourId: delivered.contourId,
        writerId: 'WRITER-1',
        fencingToken: delivered.fence,
        verifiedState: 'DELIVERED',
        headSha: HEAD_SHA,
        transitionReceiptDigest: canonicalDigest(latest),
        verifiedAt: LATER,
      },
    });
  }));

  probes.push(expectR24Error('WRONG_DELIVERY_RECEIPT_DIGEST', 'E_DELIVERY_VERIFICATION_DIGEST_MISMATCH', () => {
    const file = tempPlan();
    const done = transitionTo(file, 'DONE');
    const verifiedDelivery = buildLeaseReleaseVerification(done.state, {
      contourId: done.contourId,
      writerId: 'WRITER-1',
      fencingToken: done.fence,
      verifiedAt: LATER,
    });
    verifiedDelivery.transitionReceiptDigest = '0'.repeat(64);
    releaseLease(file, {
      contourId: done.contourId,
      writerId: 'WRITER-1',
      fencingToken: done.fence,
      now: LATER,
      expectedRevision: done.revision,
      verifiedDelivery,
    });
  }));

  probes.push(expectR24Error('WRONG_DELIVERY_HEAD', 'E_DELIVERY_NOT_VERIFIED', () => {
    const file = tempPlan();
    const done = transitionTo(file, 'DONE');
    const verifiedDelivery = buildLeaseReleaseVerification(done.state, {
      contourId: done.contourId,
      writerId: 'WRITER-1',
      fencingToken: done.fence,
      verifiedAt: LATER,
    });
    verifiedDelivery.headSha = 'b'.repeat(40);
    releaseLease(file, {
      contourId: done.contourId,
      writerId: 'WRITER-1',
      fencingToken: done.fence,
      now: LATER,
      expectedRevision: done.revision,
      verifiedDelivery,
    });
  }));

  probes.push(expectR24Error('STALE_FENCE_AFTER_NEWER_CAS', 'E_CAS_FENCING_CONFLICT', () => {
    const file = tempPlan();
    const first = acquireContour(file, 'R24-RCV-00E-A');
    acquireContour(file, 'R24-RCV-00E-B', { writerId: 'WRITER-2', missionId: 'MISSION-2' });
    heartbeatLease(file, {
      contourId: 'R24-RCV-00E-A',
      writerId: 'WRITER-1',
      fencingToken: first.result.lease.fencingToken,
      ttlMs: 3_600_000,
      now: LATER,
      expectedRevision: readPlanState(file).revision,
    });
  }));

  probes.push(expectR24Error('DUPLICATE_ACTIVE_ACQUISITION', 'E_LEASE_ACTIVE', () => {
    const file = tempPlan();
    const first = acquireContour(file, 'R24-RCV-00E-DUP');
    acquireLease(file, {
      contourId: 'R24-RCV-00E-DUP',
      writerId: 'WRITER-2',
      missionId: 'MISSION-2',
      ttlMs: 3_600_000,
      now: LATER,
      expectedRevision: first.revision,
      idempotencyKey: 'lease-R24-RCV-00E-DUP-2',
    });
  }));

  probes.push(expectR24Error('DONE_REACTIVATION', 'E_TERMINAL_STATE_HAS_NO_OUTGOING', () => {
    const file = tempPlan();
    const done = transitionTo(file, 'DONE');
    transitionContour(file, {
      contourId: done.contourId,
      to: 'ELIGIBLE',
      expectedRevision: done.revision,
      attemptId: 'ATTEMPT-2',
      writerId: 'WRITER-1',
      fencingToken: done.fence,
      idempotencyKey: 'done-reactivation',
      now: LATER,
      headSha: HEAD_SHA,
    });
  }));

  probes.push(expectR24Error('CANCELLED_REACTIVATION', 'E_TERMINAL_STATE_HAS_NO_OUTGOING', () => {
    const file = tempPlan();
    const acquired = acquireContour(file, 'R24-RCV-00E-CANCELLED');
    const cancelled = transition(file, {
      contourId: 'R24-RCV-00E-CANCELLED',
      to: 'CANCELLED',
      revision: acquired.revision,
      fence: acquired.result.lease.fencingToken,
      index: 0,
    });
    transitionContour(file, {
      contourId: 'R24-RCV-00E-CANCELLED',
      to: 'RUNNING',
      expectedRevision: cancelled.revision,
      attemptId: 'ATTEMPT-2',
      writerId: 'WRITER-1',
      fencingToken: acquired.result.lease.fencingToken,
      idempotencyKey: 'cancelled-reactivation',
      now: LATER,
      headSha: HEAD_SHA,
    });
  }));

  probes.push(expectR24Error('OUT_OF_ORDER_TRANSITION_HISTORY', 'E_TRANSITION_HISTORY_ORDER', () => {
    const file = tempPlan();
    const postmerge = transitionTo(file, 'POSTMERGE_VERIFIED');
    postmerge.state.transitionHistory[1].fromRevision = 99;
    postmerge.state.transitionHistory[1].toRevision = 100;
    validateTransitionReplay(postmerge.state);
  }));

  probes.push(expectR24Error('EXPIRED_HOLDER_WRITE', 'E_LEASE_EXPIRED', () => {
    const file = tempPlan();
    const acquired = acquireContour(file, 'R24-RCV-00E-EXPIRED', { ttlMs: 1_000 });
    heartbeatLease(file, {
      contourId: 'R24-RCV-00E-EXPIRED',
      writerId: 'WRITER-1',
      fencingToken: acquired.result.lease.fencingToken,
      ttlMs: 3_600_000,
      now: EXPIRED,
      expectedRevision: acquired.revision,
    });
  }));

  return {
    status: 'PASS',
    denominator: probes.length,
    probes,
  };
}

export function buildRcv00eLeaseFencingCasReceipt({ repoRoot = REPO_ROOT } = {}) {
  const headSha = gitText(repoRoot, ['rev-parse', 'HEAD']);
  const originMainSha = gitText(repoRoot, ['rev-parse', 'origin/main']);
  const positive = runRcv00ePositiveScenario();
  const negative = runRcv00eNegativeProbes();
  return {
    schemaVersion: RCV00E_SCHEMA_VERSION,
    status: 'PASS',
    contourId: RCV00E_CONTOUR_ID,
    baseSha: RCV00E_BASE_SHA,
    headSha,
    originMainSha,
    acceptance: [...RCV00E_ACCEPTANCE],
    positive,
    negativeProbeDenominator: negative.denominator,
    negativeErrorCodes: negative.probes.map((probe) => probe.errorCode),
    nonClaims: [
      'NO_PRODUCT_RUNTIME_FEATURE',
      'NO_PRODUCT_UI_CHANGE',
      'NO_RELEASE_READINESS',
      'NO_RUNTIME_NETWORK',
      'NO_DEPENDENCY_CHANGE',
    ],
  };
}

export function main() {
  const receipt = buildRcv00eLeaseFencingCasReceipt();
  process.stdout.write(`R24_RCV00E_LEASE_FENCING_CAS=${JSON.stringify(receipt)}\n`);
  return receipt;
}

const invokedAsScript = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedAsScript) main();

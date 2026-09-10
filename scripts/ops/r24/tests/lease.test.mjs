import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { initPlanState, readPlanState, transitionContour } from '../plan-state.mjs';
import { canonicalDigest } from '../canonical-json.mjs';
import {
  acquireLease,
  assertLeaseCurrent,
  buildLeaseReleaseVerification,
  heartbeatLease,
  releaseLease,
  reconcileLease,
  takeoverLease,
} from '../lease.mjs';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'r24-lease-'));
const T0 = '2026-08-20T00:00:00Z';
const T1 = '2026-08-20T00:00:30Z';
const T2 = '2026-08-20T00:02:00Z';
const HEAD_SHA = 'a'.repeat(40);

function transitionToDone(file, { contourId, writerId, fencingToken, revision }) {
  let nextRevision = revision;
  for (const [index, to] of ['ELIGIBLE', 'RUNNING', 'DELIVERED', 'POSTMERGE_VERIFIED', 'DONE'].entries()) {
    nextRevision = transitionContour(file, {
      contourId,
      to,
      expectedRevision: nextRevision,
      attemptId: 'ATTEMPT-1',
      writerId,
      fencingToken,
      idempotencyKey: `transition-${index}-${to}`,
      now: T1,
      headSha: HEAD_SHA,
    }).revision;
  }
  return nextRevision;
}

function transitionTo(file, { contourId, writerId, fencingToken, revision, targetState }) {
  let nextRevision = revision;
  const chain = ['ELIGIBLE', 'RUNNING', 'DELIVERED', 'POSTMERGE_VERIFIED', 'DONE'];
  for (const [index, to] of chain.entries()) {
    nextRevision = transitionContour(file, {
      contourId,
      to,
      expectedRevision: nextRevision,
      attemptId: 'ATTEMPT-1',
      writerId,
      fencingToken,
      idempotencyKey: `transition-${targetState}-${index}-${to}`,
      now: T1,
      headSha: HEAD_SHA,
    }).revision;
    if (to === targetState) break;
  }
  return nextRevision;
}

test('acquire, heartbeat, release round-trip with monotonic fencing', () => {
  const dir = tmp();
  const file = path.join(dir, 'plan.json');
  initPlanState(file);
  const acquired = acquireLease(file, {
    contourId: 'C1', writerId: 'W1', missionId: 'M1', ttlMs: 60000, now: T0, expectedRevision: 0,
  });
  const lease = acquired.result.lease;
  assert.equal(lease.fencingToken, 1);
  assert.equal(lease.writerId, 'W1');
  const heartbeat = heartbeatLease(file, {
    contourId: 'C1', writerId: 'W1', fencingToken: 1, ttlMs: 120000, now: T1, expectedRevision: acquired.revision,
  });
  assert.equal(heartbeat.result.lease.heartbeatAt, T1);
  const doneRevision = transitionToDone(file, {
    contourId: 'C1',
    writerId: 'W1',
    fencingToken: 1,
    revision: heartbeat.revision,
  });
  const verifiedDelivery = buildLeaseReleaseVerification(readPlanState(file), {
    contourId: 'C1',
    writerId: 'W1',
    fencingToken: 1,
    verifiedAt: T1,
  });
  const released = releaseLease(file, {
    contourId: 'C1',
    writerId: 'W1',
    fencingToken: 1,
    now: T1,
    expectedRevision: doneRevision,
    verifiedDelivery,
  });
  assert.equal(released.result.released, 'C1');
  assert.equal(readPlanState(file).leases.C1, undefined);
});

test('second writer is refused while a live lease exists', () => {
  const dir = tmp();
  const file = path.join(dir, 'plan.json');
  initPlanState(file);
  const acquired = acquireLease(file, {
    contourId: 'C1', writerId: 'W1', missionId: 'M1', ttlMs: 60000, now: T0, expectedRevision: 0,
  });
  assert.throws(
    () => acquireLease(file, {
      contourId: 'C1', writerId: 'W2', missionId: 'M1', ttlMs: 60000, now: T1, expectedRevision: acquired.revision,
    }),
    (e) => e.code === 'E_LEASE_ACTIVE',
  );
});

test('release requires verified DONE delivery bound to the terminal transition', () => {
  const dir = tmp();
  const file = path.join(dir, 'plan.json');
  initPlanState(file);
  const acquired = acquireLease(file, {
    contourId: 'C1', writerId: 'W1', missionId: 'M1', ttlMs: 60000, now: T0, expectedRevision: 0,
  });
  const doneRevision = transitionToDone(file, {
    contourId: 'C1',
    writerId: 'W1',
    fencingToken: acquired.result.lease.fencingToken,
    revision: acquired.revision,
  });
  assert.throws(
    () => releaseLease(file, {
      contourId: 'C1',
      writerId: 'W1',
      fencingToken: acquired.result.lease.fencingToken,
      now: T1,
      expectedRevision: doneRevision,
    }),
    (e) => e.code === 'E_DELIVERY_VERIFICATION_REQUIRED',
  );
  const verifiedDelivery = buildLeaseReleaseVerification(readPlanState(file), {
    contourId: 'C1',
    writerId: 'W1',
    fencingToken: acquired.result.lease.fencingToken,
    verifiedAt: T1,
  });
  const wrongDigest = { ...verifiedDelivery, transitionReceiptDigest: '0'.repeat(64) };
  assert.throws(
    () => releaseLease(file, {
      contourId: 'C1',
      writerId: 'W1',
      fencingToken: acquired.result.lease.fencingToken,
      now: T1,
      expectedRevision: doneRevision,
      verifiedDelivery: wrongDigest,
    }),
    (e) => e.code === 'E_DELIVERY_VERIFICATION_DIGEST_MISMATCH',
  );
  const wrongHead = { ...verifiedDelivery, headSha: 'b'.repeat(40) };
  assert.throws(
    () => releaseLease(file, {
      contourId: 'C1',
      writerId: 'W1',
      fencingToken: acquired.result.lease.fencingToken,
      now: T1,
      expectedRevision: doneRevision,
      verifiedDelivery: wrongHead,
    }),
    (e) => e.code === 'E_DELIVERY_NOT_VERIFIED',
  );
});

test('delivered-only proof remains uncertain and cannot release a lease', () => {
  const dir = tmp();
  const file = path.join(dir, 'plan.json');
  initPlanState(file);
  const acquired = acquireLease(file, {
    contourId: 'C1', writerId: 'W1', missionId: 'M1', ttlMs: 60000, now: T0, expectedRevision: 0,
  });
  const deliveredRevision = transitionTo(file, {
    contourId: 'C1',
    writerId: 'W1',
    fencingToken: acquired.result.lease.fencingToken,
    revision: acquired.revision,
    targetState: 'DELIVERED',
  });
  const latest = readPlanState(file).transitionHistory.at(-1);
  assert.throws(
    () => releaseLease(file, {
      contourId: 'C1',
      writerId: 'W1',
      fencingToken: acquired.result.lease.fencingToken,
      now: T1,
      expectedRevision: deliveredRevision,
      verifiedDelivery: {
        schemaVersion: 'PlanStateVerifiedDeliveryReceiptV1',
        status: 'VERIFIED',
        contourId: 'C1',
        writerId: 'W1',
        fencingToken: acquired.result.lease.fencingToken,
        verifiedState: 'DELIVERED',
        headSha: HEAD_SHA,
        transitionReceiptDigest: canonicalDigest(latest),
        verifiedAt: T1,
      },
    }),
    (e) => e.code === 'E_DELIVERY_NOT_VERIFIED',
  );
});

test('stale fencing token and writer mismatch fail closed', () => {
  const dir = tmp();
  const file = path.join(dir, 'plan.json');
  initPlanState(file);
  acquireLease(file, {
    contourId: 'C1', writerId: 'W1', missionId: 'M1', ttlMs: 60000, now: T0, expectedRevision: 0,
  });
  const state = readPlanState(file);
  assert.throws(
    () => assertLeaseCurrent(state, { contourId: 'C1', writerId: 'W1', fencingToken: 999, now: T1 }),
    (e) => e.code === 'E_FENCE_STALE',
  );
  assert.throws(
    () => assertLeaseCurrent(state, { contourId: 'C1', writerId: 'W2', fencingToken: 1, now: T1 }),
    (e) => e.code === 'E_LEASE_WRITER_MISMATCH',
  );
  assert.throws(
    () => assertLeaseCurrent(state, { contourId: 'C1', writerId: 'W1', fencingToken: 1, now: '2026-08-20T01:00:00Z' }),
    (e) => e.code === 'E_LEASE_EXPIRED',
  );
  assert.throws(
    () => assertLeaseCurrent(state, { contourId: 'NOPE', writerId: 'W1', fencingToken: 1, now: T1 }),
    (e) => e.code === 'E_LEASE_MISSING',
  );
});

test('expired writer cannot continue; takeover requires read-only reconcile', () => {
  const dir = tmp();
  const file = path.join(dir, 'plan.json');
  initPlanState(file);
  const acquired = acquireLease(file, {
    contourId: 'C1', writerId: 'W1', missionId: 'M1', ttlMs: 30000, now: T0, expectedRevision: 0,
  });
  assert.throws(
    () => takeoverLease(file, {
      contourId: 'C1', writerId: 'W2', missionId: 'M1', ttlMs: 60000, now: T2, expectedRevision: acquired.revision, reconcile: null,
    }),
    (e) => e.code === 'E_BLIND_TAKEOVER_FORBIDDEN',
  );
  const reconcile = reconcileLease(file, { contourId: 'C1', now: T2 });
  assert.equal(reconcile.leaseState, 'EXPIRED');
  const taken = takeoverLease(file, {
    contourId: 'C1', writerId: 'W2', missionId: 'M1', ttlMs: 60000, now: T2, expectedRevision: acquired.revision, reconcile,
  });
  assert.equal(taken.result.lease.writerId, 'W2');
  assert.equal(taken.result.lease.fencingToken, 2);
  assert.equal(taken.result.lease.takeoverOf, 1);
  const state = readPlanState(file);
  assert.throws(
    () => assertLeaseCurrent(state, { contourId: 'C1', writerId: 'W1', fencingToken: 1, now: T2 }),
    (e) => e.code === 'E_LEASE_WRITER_MISMATCH',
  );
});

test('heartbeat requires the presented fence to match the global CAS fence', () => {
  const dir = tmp();
  const file = path.join(dir, 'plan.json');
  initPlanState(file);
  const first = acquireLease(file, {
    contourId: 'C1', writerId: 'W1', missionId: 'M1', ttlMs: 60000, now: T0, expectedRevision: 0,
  });
  acquireLease(file, {
    contourId: 'C2',
    writerId: 'W2',
    missionId: 'M2',
    ttlMs: 60000,
    now: T1,
    expectedRevision: first.revision,
  });
  assert.throws(
    () => heartbeatLease(file, {
      contourId: 'C1',
      writerId: 'W1',
      fencingToken: first.result.lease.fencingToken,
      ttlMs: 120000,
      now: T1,
      expectedRevision: readPlanState(file).revision,
    }),
    (e) => e.code === 'E_CAS_FENCING_CONFLICT',
  );
});

test('fabricated reconcile report against live lease is refused', () => {
  const dir = tmp();
  const file = path.join(dir, 'plan.json');
  initPlanState(file);
  const acquired = acquireLease(file, {
    contourId: 'C1', writerId: 'W1', missionId: 'M1', ttlMs: 60000, now: T0, expectedRevision: 0,
  });
  const fakeReconcile = { leaseState: 'EXPIRED', lease: { ...acquired.result.lease, expiresAt: T0 } };
  assert.throws(
    () => takeoverLease(file, {
      contourId: 'C1', writerId: 'W2', missionId: 'M1', ttlMs: 60000, now: T1, expectedRevision: acquired.revision, reconcile: fakeReconcile,
    }),
    (e) => e.code === 'E_TAKEOVER_LEASE_ACTIVE',
  );
});

test('lease acquire is idempotent under duplicate dispatch key', () => {
  const dir = tmp();
  const file = path.join(dir, 'plan.json');
  initPlanState(file);
  const first = acquireLease(file, {
    contourId: 'C1', writerId: 'W1', missionId: 'M1', ttlMs: 60000, now: T0, expectedRevision: 0, idempotencyKey: 'acq-1',
  });
  const second = acquireLease(file, {
    contourId: 'C1', writerId: 'W1', missionId: 'M1', ttlMs: 60000, now: T0, expectedRevision: 0, idempotencyKey: 'acq-1',
  });
  assert.equal(second.duplicate, true);
  assert.equal(readPlanState(file).leases.C1.fencingToken, 1);
  assert.equal(readPlanState(file).revision, 1);
});

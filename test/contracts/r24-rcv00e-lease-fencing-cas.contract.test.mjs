import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { canonicalDigest } from '../../scripts/ops/r24/canonical-json.mjs';
import {
  initPlanState,
  readPlanState,
  transitionContour,
  validateTransitionReplay,
} from '../../scripts/ops/r24/plan-state.mjs';
import {
  acquireLease,
  heartbeatLease,
  releaseLease,
} from '../../scripts/ops/r24/lease.mjs';

const NOW = '2026-09-10T00:00:00.000Z';
const LATER = '2026-09-10T00:00:30.000Z';
const HEAD_SHA = 'a'.repeat(40);

function tempPlan() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'r24-rcv00e-'));
  const file = path.join(dir, 'plan-state.json');
  initPlanState(file);
  return file;
}

function acquireContour(file, contourId = 'R24-RCV-00E') {
  return acquireLease(file, {
    contourId,
    writerId: 'WRITER-1',
    missionId: 'MISSION-1',
    ttlMs: 3_600_000,
    now: NOW,
    expectedRevision: readPlanState(file).revision,
    idempotencyKey: `lease-${contourId}`,
  });
}

function transition(file, { contourId, to, revision, fence, index }) {
  return transitionContour(file, {
    contourId,
    to,
    expectedRevision: revision,
    attemptId: 'ATTEMPT-1',
    writerId: 'WRITER-1',
    fencingToken: fence,
    idempotencyKey: `transition-${contourId}-${index}-${to}`,
    now: NOW,
    headSha: HEAD_SHA,
  });
}

function transitionTo(file, targetState) {
  const contourId = 'R24-RCV-00E';
  const acquired = acquireContour(file, contourId);
  const fence = acquired.result.lease.fencingToken;
  const chain = ['ELIGIBLE', 'RUNNING', 'DELIVERED', 'POSTMERGE_VERIFIED', 'DONE'];
  let revision = acquired.revision;
  for (let index = 0; index < chain.length; index += 1) {
    revision = transition(file, { contourId, to: chain[index], revision, fence, index }).revision;
    if (chain[index] === targetState) break;
  }
  const state = readPlanState(file);
  const terminalReceipt = state.transitionHistory.at(-1);
  return {
    contourId,
    fence,
    revision,
    verifiedDelivery: {
      schemaVersion: 'PlanStateVerifiedDeliveryReceiptV1',
      status: 'VERIFIED',
      contourId,
      writerId: 'WRITER-1',
      fencingToken: fence,
      verifiedState: targetState,
      headSha: HEAD_SHA,
      transitionReceiptDigest: canonicalDigest(terminalReceipt),
      verifiedAt: LATER,
    },
  };
}

test('R24-RCV-00E refuses lease release without independently verified delivery', () => {
  const file = tempPlan();
  const done = transitionTo(file, 'DONE');

  assert.throws(
    () => releaseLease(file, {
      contourId: done.contourId,
      writerId: 'WRITER-1',
      fencingToken: done.fence,
      now: LATER,
      expectedRevision: done.revision,
    }),
    (error) => error.code === 'E_DELIVERY_VERIFICATION_REQUIRED',
  );
});

test('R24-RCV-00E accepts release only when delivery receipt binds terminal state and transition digest', () => {
  const file = tempPlan();
  const done = transitionTo(file, 'DONE');

  const released = releaseLease(file, {
    contourId: done.contourId,
    writerId: 'WRITER-1',
    fencingToken: done.fence,
    now: LATER,
    expectedRevision: done.revision,
    verifiedDelivery: done.verifiedDelivery,
  });

  assert.equal(released.result.released, done.contourId);
  assert.equal(readPlanState(file).leases[done.contourId], undefined);
});

test('R24-RCV-00E treats delivered-but-not-postmerge terminal proof as uncertain delivery', () => {
  const file = tempPlan();
  const delivered = transitionTo(file, 'DELIVERED');

  assert.throws(
    () => releaseLease(file, {
      contourId: delivered.contourId,
      writerId: 'WRITER-1',
      fencingToken: delivered.fence,
      now: LATER,
      expectedRevision: delivered.revision,
      verifiedDelivery: delivered.verifiedDelivery,
    }),
    (error) => error.code === 'E_DELIVERY_NOT_VERIFIED',
  );
});

test('R24-RCV-00E rejects stale fence writes after a newer CAS fence exists', () => {
  const file = tempPlan();
  const first = acquireContour(file, 'R24-RCV-00E-A');
  acquireLease(file, {
    contourId: 'R24-RCV-00E-B',
    writerId: 'WRITER-2',
    missionId: 'MISSION-2',
    ttlMs: 3_600_000,
    now: NOW,
    expectedRevision: first.revision,
    idempotencyKey: 'lease-R24-RCV-00E-B',
  });

  assert.throws(
    () => heartbeatLease(file, {
      contourId: 'R24-RCV-00E-A',
      writerId: 'WRITER-1',
      fencingToken: first.result.lease.fencingToken,
      ttlMs: 3_600_000,
      now: LATER,
      expectedRevision: readPlanState(file).revision,
    }),
    (error) => error.code === 'E_CAS_FENCING_CONFLICT',
  );
});

test('R24-RCV-00E keeps terminal and revoked contours non-reactivatable', () => {
  const doneFile = tempPlan();
  const done = transitionTo(doneFile, 'DONE');
  assert.throws(
    () => transitionContour(doneFile, {
      contourId: done.contourId,
      to: 'ELIGIBLE',
      expectedRevision: done.revision,
      attemptId: 'ATTEMPT-2',
      writerId: 'WRITER-1',
      fencingToken: done.fence,
      idempotencyKey: 'done-reactivation',
      now: LATER,
      headSha: HEAD_SHA,
    }),
    (error) => error.code === 'E_TERMINAL_STATE_HAS_NO_OUTGOING',
  );

  const cancelledFile = tempPlan();
  const acquired = acquireContour(cancelledFile, 'R24-RCV-00E-CANCELLED');
  const cancelled = transition(cancelledFile, {
    contourId: 'R24-RCV-00E-CANCELLED',
    to: 'CANCELLED',
    revision: acquired.revision,
    fence: acquired.result.lease.fencingToken,
    index: 0,
  });
  assert.throws(
    () => transitionContour(cancelledFile, {
      contourId: 'R24-RCV-00E-CANCELLED',
      to: 'RUNNING',
      expectedRevision: cancelled.revision,
      attemptId: 'ATTEMPT-2',
      writerId: 'WRITER-1',
      fencingToken: acquired.result.lease.fencingToken,
      idempotencyKey: 'cancelled-reactivation',
      now: LATER,
      headSha: HEAD_SHA,
    }),
    (error) => error.code === 'E_TERMINAL_STATE_HAS_NO_OUTGOING',
  );
});

test('R24-RCV-00E rejects duplicate acquisition and out-of-order transition replay', () => {
  const file = tempPlan();
  const acquired = acquireContour(file, 'R24-RCV-00E-DUP');
  assert.throws(
    () => acquireLease(file, {
      contourId: 'R24-RCV-00E-DUP',
      writerId: 'WRITER-2',
      missionId: 'MISSION-2',
      ttlMs: 3_600_000,
      now: LATER,
      expectedRevision: acquired.revision,
      idempotencyKey: 'lease-R24-RCV-00E-DUP-2',
    }),
    (error) => error.code === 'E_LEASE_ACTIVE',
  );

  const orderFile = tempPlan();
  transitionTo(orderFile, 'POSTMERGE_VERIFIED');
  const badState = readPlanState(orderFile);
  badState.transitionHistory[1].fromRevision = 99;
  badState.transitionHistory[1].toRevision = 100;
  assert.throws(
    () => validateTransitionReplay(badState),
    (error) => error.code === 'E_TRANSITION_HISTORY_ORDER',
  );
});

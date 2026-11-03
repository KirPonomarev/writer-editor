import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { initPlanState, readPlanState, transitionContour } from '../plan-state.mjs';
import { acquireLease, buildLeaseReleaseVerification, releaseLease } from '../lease.mjs';
import { canonicalDigest } from '../canonical-json.mjs';
import { compileEffectiveState } from '../effective-state-compiler.mjs';

const NOW = '2026-08-20T00:00:00.000Z';
const HEAD = 'a'.repeat(40);
function fixture() {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'r24-plan-')), 'plan.json');
  initPlanState(file);
  return file;
}
function acquire(file, contourId, expectedRevision) {
  return acquireLease(file, { contourId, writerId: 'W1', missionId: 'M1',
    ttlMs: 3600000, now: NOW, expectedRevision });
}
function doneFixture() {
  const file = fixture();
  const lease = acquire(file, 'C1', 0);
  const fencingToken = lease.result.lease.fencingToken;
  let revision = lease.revision;
  for (const to of ['ELIGIBLE', 'RUNNING', 'DELIVERED', 'POSTMERGE_VERIFIED', 'DONE']) {
    revision = transitionContour(file, { contourId: 'C1', to, expectedRevision: revision,
      attemptId: 'A1', writerId: 'W1', fencingToken, idempotencyKey: 'boundary-' + to,
      now: NOW, headSha: HEAD }).revision;
  }
  return { file, revision, fencingToken };
}
function verification(file, fencingToken) {
  return buildLeaseReleaseVerification(readPlanState(file),
    { contourId: 'C1', writerId: 'W1', fencingToken, verifiedAt: NOW });
}

test('transition with a valid global fence but absent contour lease refuses before persistence', () => {
  const file = fixture(), other = acquire(file, 'OTHER', 0);
  const state = readPlanState(file);
  assert.equal(state.fencingCounter, 1);
  assert.equal(state.leases.C1, undefined);
  const before = fs.readFileSync(file);
  assert.throws(() => transitionContour(file, { contourId: 'C1', to: 'ELIGIBLE',
    expectedRevision: other.revision, attemptId: 'A1', writerId: 'W1',
    fencingToken: other.result.lease.fencingToken, idempotencyKey: 'boundary-no-lease',
    now: NOW, headSha: HEAD }), error => error.code === 'E_TRANSITION_LEASE_REQUIRED');
  assert.equal(fs.readFileSync(file).equals(before), true);
});

test('verified DONE release still requires the independent global CAS fence', () => {
  const { file, revision, fencingToken } = doneFixture();
  const other = acquire(file, 'OTHER', revision);
  assert.equal(other.result.lease.fencingToken, fencingToken + 1);
  const verifiedDelivery = verification(file, fencingToken);
  assert.equal(verifiedDelivery.verifiedState, 'DONE');
  const before = fs.readFileSync(file);
  assert.throws(() => releaseLease(file, { contourId: 'C1', writerId: 'W1', fencingToken,
    now: NOW, expectedRevision: other.revision, verifiedDelivery }),
  error => error.code === 'E_CAS_FENCING_CONFLICT');
  assert.equal(fs.readFileSync(file).equals(before), true);
});

test('otherwise valid DONE proof cannot advertise a DELIVERED verified state', () => {
  const { file, revision, fencingToken } = doneFixture();
  const valid = verification(file, fencingToken);
  assert.equal(readPlanState(file).contours.C1.state, 'DONE');
  const before = fs.readFileSync(file);
  assert.throws(() => releaseLease(file, { contourId: 'C1', writerId: 'W1', fencingToken,
    now: NOW, expectedRevision: revision, verifiedDelivery: { ...valid, verifiedState: 'DELIVERED' } }),
  error => error.code === 'E_DELIVERY_NOT_VERIFIED');
  assert.equal(fs.readFileSync(file).equals(before), true);
});

test('well-bound non-NOOP overlay must match the current state before projection', () => {
  const file = fixture(), state = readPlanState(file);
  const program = { schemaVersion: 'fixture', guards: [{ id: 'G0_AUTHORITY_CLOSURE', state: 'CURRENT' }],
    nodes: [
      { id: 'ROOT', kind: 'FOUNDATION', profile: 'P1', dependsOn: [], state: 'DONE' },
      { id: 'A', kind: 'WORK_PACKAGE', profile: 'P1', dependsOn: ['ROOT'], state: 'PENDING' },
    ] };
  const before = canonicalDigest(state), fileBefore = fs.readFileSync(file);
  const overlay = { schemaVersion: 'R24_EFFECTIVE_STATE_OVERLAY_V1', overlayId: 'boundary-conflict',
    sequence: 0, predecessorOverlayId: null, baseHeadSha: HEAD,
    basePlanStateDigest: canonicalDigest(state), baseProgramDigest: canonicalDigest(program),
    targetNodeId: 'A', from: 'RUNNING', to: 'DONE', transitionId: '1'.repeat(64),
    receiptSha256: '2'.repeat(64), proofAuthority: 'EXTERNAL_TERMINAL_RECEIPT' };
  assert.throws(() => compileEffectiveState({ program, planState: state, overlays: [overlay],
    generatedAt: NOW, exactIdentity: { implementationSourceSha: HEAD, evaluationHeadSha: HEAD,
      evaluationTreeSha: 'b'.repeat(40), originMainSha: HEAD } }),
  error => error.code === 'E_R24_EFFECTIVE_OVERLAY_CONFLICT');
  assert.equal(canonicalDigest(state), before);
  assert.equal(fs.readFileSync(file).equals(fileBefore), true);
});

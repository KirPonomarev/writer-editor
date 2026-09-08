import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PRE00D_BASE_SHA,
  PRE00D_BASE_TREE,
  PRE00D_LEASE_COUNTER,
  SUCCESSOR_BRANCH,
  SUCCESSOR_PLAN_PATH,
  buildPre00dSuccessorAdmissionPacket,
  runPre00dNegativeProbes,
  verifyPre00dSuccessorAdmission,
} from '../../scripts/ops/r24/corrective/pre00d-successor-admission-lease-handoff.mjs';

const clone = (value) => JSON.parse(JSON.stringify(value));

test('PRE00D admits the fresh successor as one exact plan-doc create against current base', () => {
  const packet = buildPre00dSuccessorAdmissionPacket();
  const result = verifyPre00dSuccessorAdmission(packet);
  assert.equal(result.status, 'PASS');
  assert.equal(result.baseSha, PRE00D_BASE_SHA);
  assert.equal(result.baseTree, PRE00D_BASE_TREE);
  assert.equal(result.successorBranch, SUCCESSOR_BRANCH);
  assert.deepEqual(result.admittedPaths, [SUCCESSOR_PLAN_PATH]);
  assert.equal(result.admittedPathDenominator, 1);
  assert.equal(result.leaseCounter, PRE00D_LEASE_COUNTER);
});

test('PRE00D focused negative probes reject stale, broad, drifted and rebinding candidates', () => {
  const result = runPre00dNegativeProbes();
  assert.equal(result.status, 'PASS');
  assert.equal(result.negativeProbeDenominator, 9);
  assert.deepEqual(result.negativeErrors, [
    'E_PRE00D_BASE_SHA',
    'E_PRE00D_CREATE_SET',
    'E_PRE00D_CREATE_SET',
    'E_PRE00D_LEASE_COUNTER',
    'E_PRE00D_SIMULTANEOUS_WRITER',
    'E_PRE00D_CREATE_SET',
    'E_PRE00D_PRE00C_REBIND',
    'E_PRE00D_REVIEW_CARRIER_MERGE',
    'E_PRE00D_NON_CLAIM_LEAK',
  ]);
});

test('PRE00D separately rejects digest self-repair, omitted path and operation-class mismatch', () => {
  const packet = buildPre00dSuccessorAdmissionPacket();
  packet.operations.createPaths.push('docs/tasks/unadmitted.md');
  packet.digests.writeSetDigest = packet.digests.commandScopeDigest;
  assert.throws(
    () => verifyPre00dSuccessorAdmission(packet),
    (error) => error.code === 'E_PRE00D_CREATE_SET',
  );

  const omitted = buildPre00dSuccessorAdmissionPacket();
  omitted.operations.createPaths = [];
  omitted.digests.writeSetDigest = omitted.digests.commandScopeDigest;
  assert.throws(
    () => verifyPre00dSuccessorAdmission(omitted),
    (error) => error.code === 'E_PRE00D_CREATE_SET',
  );

  const mismatch = buildPre00dSuccessorAdmissionPacket();
  mismatch.operations.createPaths = [];
  mismatch.operations.modifyPaths = [SUCCESSOR_PLAN_PATH];
  assert.throws(
    () => verifyPre00dSuccessorAdmission(mismatch),
    (error) => error.code === 'E_PRE00D_CREATE_SET',
  );
});

test('PRE00D rejects broad path admission before digest interpretation can grant authority', () => {
  for (const badPath of [
    '/tmp/yalken-plan.md',
    '../docs/tasks/escape.md',
    'docs/tasks/*.md',
    'docs/tasks/[all].md',
    'docs/tasks/2026-09-08--r24-consolidated-remediation-and-completion-plan.md.bak',
  ]) {
    const packet = buildPre00dSuccessorAdmissionPacket();
    packet.operations.createPaths = [badPath];
    assert.throws(
      () => verifyPre00dSuccessorAdmission(packet),
      (error) => ['E_PRE00D_CREATE_SET', 'E_PRE00D_PATH_ABSOLUTE', 'E_PRE00D_PATH_ESCAPE', 'E_PRE00D_PATH_WILDCARD', 'E_PRE00D_PATH_NOT_ADMITTED'].includes(error.code),
      badPath,
    );
  }
});

test('PRE00D repo check verifies exact base tree and that successor plan is still absent at base', () => {
  const packet = buildPre00dSuccessorAdmissionPacket();
  const result = verifyPre00dSuccessorAdmission(packet, { repoRoot: process.cwd() });
  assert.equal(result.status, 'PASS');
});

test('PRE00D closed evidence binding stays exact even if attacker recomputes digests', () => {
  const packet = buildPre00dSuccessorAdmissionPacket();
  packet.closedEvidence.pre00c.deliverySha = '1'.repeat(40);
  packet.digests.predecessorBindingDigest = packet.digests.writeSetDigest;
  assert.throws(
    () => verifyPre00dSuccessorAdmission(packet),
    (error) => error.code === 'E_PRE00D_PRE00C_REBIND',
  );

  const nonClaim = clone(buildPre00dSuccessorAdmissionPacket());
  nonClaim.nonClaims.pk1ReleaseSecurityPhysicalStarted = true;
  assert.throws(
    () => verifyPre00dSuccessorAdmission(nonClaim),
    (error) => error.code === 'E_PRE00D_NON_CLAIM_LEAK',
  );
});

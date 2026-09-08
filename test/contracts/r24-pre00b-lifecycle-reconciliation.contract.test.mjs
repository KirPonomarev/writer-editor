import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildPre00bLifecycleReconciliation,
  readPre00bSources,
  runPre00bNegativeProbes,
  verifyPre00bLifecycleReconciliation,
} from '../../scripts/ops/r24/corrective/pre00b-lifecycle-reconciliation.mjs';

const clone = (value) => JSON.parse(JSON.stringify(value));

test('PRE00B reconciles stale legacy plan state to PK1R1 merged lifecycle without release authority', () => {
  const status = buildPre00bLifecycleReconciliation(readPre00bSources());
  assert.equal(status.status, 'RECONCILED_TO_PK1R1_MERGED_HEAD');
  assert.equal(status.binding.sourceHeadSha, 'af74b9542c17c24a7515ce9017d98ea7b2e4d55a');
  assert.deepEqual(status.legacyPlanState.counts, {
    BLOCKED_TYPED: 4,
    DONE: 49,
    INELIGIBLE_OPTIONAL: 10,
    PENDING: 46,
  });
  assert.deepEqual(status.reconciledLifecycleProjection.counts, {
    BLOCKED_TYPED: 2,
    DONE: 90,
    INELIGIBLE_OPTIONAL: 10,
    PENDING: 7,
  });
  assert.deepEqual(status.reconciliation.countsDeltaFromLegacyPlanState, {
    BLOCKED_TYPED: -2,
    DONE: 41,
    INELIGIBLE_OPTIONAL: 0,
    PENDING: -39,
  });
  assert.equal(status.legacyPlanState.latestUpdate.id, 'WP-308_BRAND_BASELINE');
  assert.equal(status.reconciledLifecycleProjection.programDone, false);
  assert.equal(status.reconciledLifecycleProjection.productionReleaseReady, false);
  assert.equal(status.reconciledLifecycleProjection.publicationAuthorityGranted, false);
  assert.equal(status.nonClaims.noProcessInspectionOrTermination, true);
  assert.equal(status.reconciliation.legacyPlanStateMutated, false);
  assert.equal(status.reconciliation.productRuntimeMutated, false);
});

test('PRE00B checked-in status and governance approvals bind exact current files', () => {
  const result = verifyPre00bLifecycleReconciliation();
  assert.equal(result.status, 'PASS');
  assert.equal(result.programDone, false);
  assert.equal(result.productionReleaseReady, false);
  assert.equal(result.approvalDenominator, 8);
  assert.equal(result.ciApprovalDenominator, 8);
  assert.equal(result.claimBindingDenominator, 2);
  assert.equal(result.negativeProbeDenominator, 6);
});

test('PRE00B negative probes reject false-green lifecycle drift', () => {
  const result = runPre00bNegativeProbes();
  assert.equal(result.status, 'PASS');
  assert.deepEqual(result.negativeErrors, [
    'E_PRE00B_LEGACY_COUNTS_UNEXPECTED',
    'E_PRE00B_RECONCILED_COUNTS_UNEXPECTED',
    'E_PRE00B_RELEASE_AUTHORITY_LEAK',
    'E_PRE00B_ACCEPTANCE_ROW_UNVERIFIED',
    'E_PRE00B_LEASE_TARGET_NOT_RELEASED',
    'E_PRE00B_SOURCE_HEAD_NOT_ANCESTOR',
  ]);
});

test('PRE00B explicitly rejects owner-signal and acceptance-matrix substitution', () => {
  const base = readPre00bSources();
  const missingOwnerSignal = clone(base);
  missingOwnerSignal.files.ownerAuthority.value.acceptanceSignals =
    missingOwnerSignal.files.ownerAuthority.value.acceptanceSignals.filter((signal) => signal !== 'PK1R1_FENCE_104_RELEASED_WIP_0');
  assert.throws(
    () => buildPre00bLifecycleReconciliation(missingOwnerSignal),
    /E_PRE00B_OWNER_SIGNAL_MISSING/,
  );

  const rowDrift = clone(base);
  rowDrift.files.acceptanceMatrix.value.rows[1].observation = 'PASS';
  assert.throws(
    () => buildPre00bLifecycleReconciliation(rowDrift),
    /E_PRE00B_ACCEPTANCE_ROW_DRIFT/,
  );
});

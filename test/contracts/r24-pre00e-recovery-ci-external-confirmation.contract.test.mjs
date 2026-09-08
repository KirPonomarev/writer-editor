import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FORMERLY_FAILING_PRIMARY_LANES,
  PRE00D_RECOVERY_HEAD_SHA,
  PRE00E_BASE_SHA,
  PRE00E_BASE_TREE,
  RECOVERY_REQUIRED_CHECKS,
  REVIEW_CARRIER_PR,
  buildPre00eRecoveryCiStatus,
  runPre00eNegativeProbes,
  verifyPre00eRecoveryCiStatus,
} from '../../scripts/ops/r24/corrective/pre00e-recovery-ci-external-confirmation.mjs';

const clone = (value) => JSON.parse(JSON.stringify(value));

test('PRE00E proves all seventeen recovery candidate jobs passed on the exact PR1847 head', () => {
  const status = buildPre00eRecoveryCiStatus();
  const result = verifyPre00eRecoveryCiStatus(status);
  assert.equal(result.status, 'PASS');
  assert.equal(result.recoveredOriginMainSha, PRE00E_BASE_SHA);
  assert.equal(result.recoveredOriginMainTree, PRE00E_BASE_TREE);
  assert.equal(result.recoveryHeadSha, PRE00D_RECOVERY_HEAD_SHA);
  assert.equal(result.recoveryRequiredJobDenominator, 17);
  assert.equal(result.recoveryRequiredJobDenominator, RECOVERY_REQUIRED_CHECKS.length);
});

test('PRE00E binds the five formerly failing primary lanes as historical failure to recovered success', () => {
  const status = buildPre00eRecoveryCiStatus();
  const result = verifyPre00eRecoveryCiStatus(status);
  assert.equal(result.formerlyFailingPrimaryLaneDenominator, 5);
  assert.equal(result.formerlyFailingPrimaryLaneDenominator, FORMERLY_FAILING_PRIMARY_LANES.length);
  assert.equal(result.historicalReviewCarrierPr, REVIEW_CARRIER_PR);
  for (const lane of status.formerlyFailingPrimaryLanes) {
    assert.equal(lane.historicalState, 'FAILURE');
    assert.equal(lane.recoveryState, 'SUCCESS');
  }
});

test('PRE00E aggregate lanes can pass only from successful real dependencies', () => {
  const status = buildPre00eRecoveryCiStatus();
  const result = verifyPre00eRecoveryCiStatus(status);
  assert.equal(result.aggregateLaneDenominator, 2);

  const mutant = clone(status);
  mutant.aggregateLanes[0].dependencyCheckNames = mutant.aggregateLanes[0].dependencyCheckNames.slice(1);
  assert.throws(
    () => verifyPre00eRecoveryCiStatus(mutant),
    (error) => error.code === 'E_PRE00E_MERGE_GATE_DEPENDENCIES',
  );
});

test('PRE00E focused negative probes reject missing jobs false-green role leaks and plan-rebind leaks', () => {
  const result = runPre00eNegativeProbes();
  assert.equal(result.status, 'PASS');
  assert.equal(result.negativeProbeDenominator, 8);
  assert.deepEqual(result.negativeErrors, [
    'E_PRE00E_JOB_COUNT',
    'E_PRE00E_JOB_STATE',
    'E_PRE00E_HISTORICAL_LANE_STATE',
    'E_PRE00E_MERGE_GATE_DEPENDENCIES',
    'E_PRE00E_REVIEW_CARRIER_MERGED',
    'E_PRE00E_REVIEW_CARRIER_AUTHORITY',
    'E_PRE00E_RECOVERED_ORIGIN_SHA',
    'E_PRE00E_NON_CLAIM_LEAK',
  ]);
});

test('PRE00E repo check verifies the recovered main tree and ancestor binding', () => {
  const status = buildPre00eRecoveryCiStatus();
  const result = verifyPre00eRecoveryCiStatus(status, { repoRoot: process.cwd(), requireOriginMainAtRecovered: true });
  assert.equal(result.status, 'PASS');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CANDIDATE_JOBS,
  FULL_DENOMINATOR_CELLS,
  SUPPORTED_CELL_IDS,
  durationOverridesFromState,
  planBatch,
} from '../../scripts/ops/rtk-interop-word-manuscript-batch-plan.mjs';

test('candidate matrix is bounded and deterministic', () => {
  assert.equal(CANDIDATE_JOBS.length, 38);
  assert.equal(SUPPORTED_CELL_IDS.length, 252);
  assert.equal(FULL_DENOMINATOR_CELLS, 1120);
  assert.deepEqual(CANDIDATE_JOBS, [...CANDIDATE_JOBS].sort((left, right) => left.key.localeCompare(right.key)));
});

test('planner reaches a 100-cell target without duplicate cell credit', () => {
  const plan = planBatch({ targetNewCells: 100 });
  assert.equal(plan.targetReached, true);
  assert.ok(plan.plannedNewCells >= 100);
  assert.equal(new Set(plan.jobs.flatMap((job) => job.newCellIds)).size, plan.plannedNewCells);
  assert.ok(plan.estimatedSeconds > 0);
  assert.equal(plan.authority, 'PLANNING_PROJECTION_ONLY_NO_PRODUCT_ADMISSION');
});

test('planner exposes unreachable work instead of repeating accepted cells', () => {
  const accepted = SUPPORTED_CELL_IDS.slice(0, 228);
  const plan = planBatch({ acceptedCellIds: accepted, targetNewCells: 100 });
  assert.equal(plan.targetReached, false);
  assert.equal(plan.plannedNewCells, 24);
  assert.equal(plan.unreachableTarget, 76);
  assert.equal(plan.supportedUncoveredCells, 24);
  assert.equal(plan.missingRecipeCells, 868);
  assert.equal(new Set(plan.jobs.flatMap((job) => job.newCellIds)).size, 24);
});

test('completed and blocked jobs are excluded before ranking', () => {
  const [first, second] = CANDIDATE_JOBS;
  const plan = planBatch({
    targetNewCells: 1,
    completedJobKeys: [first.key],
    blockedJobKeys: [second.key],
  });
  assert.equal(plan.skippedCompletedJobs, 1);
  assert.equal(plan.skippedBlockedJobs, 1);
  assert.equal(plan.jobs.some((job) => job.key === first.key || job.key === second.key), false);
});

test('unknown accepted cells fail closed', () => {
  assert.throws(() => planBatch({ acceptedCellIds: ['TEXT__UNKNOWN__C1__SOURCE_RUNTIME'] }), /UNKNOWN_CELL/);
});

test('historical state timings stay separate from fixed delivery overhead', () => {
  const [job] = CANDIDATE_JOBS;
  const key = job.key;
  const overrides = durationOverridesFromState({ entries: { one: {
    volume: job.volume,
    route: job.route,
    profile: job.profile,
    recipe: job.recipe,
    physicalWallSeconds: 12,
    verifyWallSeconds: 3,
  } } });
  const plan = planBatch({ targetNewCells: 1, durationOverrides: overrides, fixedOverheadSeconds: 60, targetBudgetSeconds: 120 });
  assert.equal(overrides[key], 15);
  assert.equal(plan.fixedOverheadSeconds, 60);
  assert.equal(plan.estimatedTotalSeconds, 75);
  assert.equal(plan.withinTargetBudget, true);
});

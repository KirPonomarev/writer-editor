import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CANDIDATE_JOBS,
  FULL_DENOMINATOR_CELLS,
  SUPPORTED_CELL_IDS,
  durationOverridesFromState,
  planBatch,
} from './rtk-interop-word-manuscript-batch-plan.mjs';

test('candidate matrix is bounded and deterministic', () => {
  assert.equal(CANDIDATE_JOBS.length, 92);
  assert.equal(SUPPORTED_CELL_IDS.length, 354);
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
  const accepted = SUPPORTED_CELL_IDS.slice(0, -24);
  const plan = planBatch({ acceptedCellIds: accepted, targetNewCells: 100 });
  assert.equal(plan.targetReached, false);
  assert.equal(plan.plannedNewCells, 24);
  assert.equal(plan.unreachableTarget, 76);
  assert.equal(plan.supportedUncoveredCells, 24);
  assert.equal(plan.missingRecipeCells, 766);
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


test('note extension plans exactly 48 unique new cells in 24 physical jobs', () => {
  const accepted = SUPPORTED_CELL_IDS.filter(id => !/^(?:NOTES|FOOTNOTES_ENDNOTES)__/.test(id));
  assert.equal(accepted.length, 306);
  const plan = planBatch({ acceptedCellIds: accepted, targetNewCells: 48 });
  assert.equal(plan.targetReached, true);
  assert.equal(plan.plannedNewCells, 48);
  assert.equal(plan.jobs.length, 24);
  assert.equal(plan.jobs.every(job => job.newCells === 2), true);
  assert.equal(plan.jobs.every(job => job.newCellIds.every(id => /^(?:NOTES|FOOTNOTES_ENDNOTES)__/.test(id))), true);
  assert.deepEqual(plan.remainingSupportedCellIds, []);
  const complete = planBatch({ acceptedCellIds: SUPPORTED_CELL_IDS, targetNewCells: 48 });
  assert.equal(complete.plannedNewCells, 0);
  assert.equal(complete.targetReached, false);
  assert.deepEqual(complete.jobs, []);
});


test('media candidates remain schedulable without invented timing and accepted jobs are not remeasured', () => {
 const accepted=SUPPORTED_CELL_IDS.filter(id=>!id.startsWith('MEDIA_ASSETS__'));
 const plan=planBatch({acceptedCellIds:accepted,targetNewCells:24,targetBudgetSeconds:3600});
 assert.equal(plan.plannedNewCells,24);assert.equal(plan.jobs.length,24);
 assert.equal(plan.unmeasuredJobs,24);assert.equal(plan.estimatedSeconds,null);
 assert.equal(plan.estimatedTotalSeconds,null);assert.equal(plan.withinTargetBudget,null);
 assert.ok(plan.jobs.every(j=>j.cellsPerSecond===null));
 const overrides=Object.fromEntries(plan.jobs.map(j=>[j.key,30]));
 const measured=planBatch({acceptedCellIds:accepted,targetNewCells:24,durationOverrides:overrides});
 assert.equal(measured.estimatedSeconds,720);assert.equal(measured.unmeasuredJobs,0);
 const complete=planBatch({acceptedCellIds:SUPPORTED_CELL_IDS,targetNewCells:1,durationOverrides:Object.fromEntries(plan.jobs.map(j=>[j.key,-1]))});
 assert.deepEqual(complete.jobs,[]);assert.equal(complete.estimatedSeconds,0);
});

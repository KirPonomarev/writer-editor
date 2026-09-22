#!/usr/bin/env node

import fs from 'node:fs';
import {
  MANUSCRIPT_CELLS,
  MANUSCRIPT_PROFILES,
  MANUSCRIPT_ROUTES,
  MANUSCRIPT_VOLUMES,
  manuscriptFields,
  manuscriptRecipes,
} from '../ops/rtk-interop-word-manuscript-fixtures.mjs';

/**
 * Build an execution plan from uncovered cells.
 *
 * This module is deliberately a planning projection. It never reads a
 * receipt, changes a ledger, or grants product admission. A caller must pass
 * independently accepted cell IDs and may then use the selected job keys to
 * drive a resumable physical runner.
 */

export const FULL_DENOMINATOR_CELLS = 1120;
export const PLANNER_SCHEMA_VERSION = 'WORD_MANUSCRIPT_BATCH_PLAN_V1';

const DEFAULT_SECONDS = Object.freeze({
  C1_DEFAULT: 35,
  C1_REVIEW_RETURN: 55,
  C2_DEFAULT: 80,
  C3_DEFAULT: 240,
  C5_DEFAULT: 150,
});

const keyFor = ({ volume, route, profile, recipe }) => `${volume}|${route}|${profile}|${recipe}`;
const cellFor = (field, { volume, route, profile }) => `${field}__${volume}__${route}__${profile}`;

const assertPositiveInteger = (value, label) => {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`PLANNER_${label}_INVALID`);
};

const asSet = (values, label) => {
  if (values === undefined) return new Set();
  if (!Array.isArray(values)) throw new Error(`PLANNER_${label}_MUST_BE_ARRAY`);
  const result = new Set();
  for (const value of values) {
    if (typeof value !== 'string' || value.length === 0) throw new Error(`PLANNER_${label}_ITEM_INVALID`);
    if (result.has(value)) throw new Error(`PLANNER_${label}_DUPLICATE`);
    result.add(value);
  }
  return result;
};

function allCandidateJobs() {
  const jobs = [];
  for (const volume of MANUSCRIPT_VOLUMES) {
    for (const route of MANUSCRIPT_ROUTES) {
      for (const profile of MANUSCRIPT_PROFILES) {
        for (const recipe of manuscriptRecipes(route)) {
          // The fixture itself is the authority for supported combinations.
          // C5/LARGE_DOCUMENT throws here and is intentionally not a candidate.
          let fields;
          try {
            fields = manuscriptFields(volume, route, recipe);
          } catch (error) {
            if (String(error?.message) === 'GOOGLE_NATIVE_VOLUME_UNQUALIFIED') continue;
            throw error;
          }
          const job = { volume, route, profile, recipe };
          jobs.push(Object.freeze({
            ...job,
            key: keyFor(job),
            fields: Object.freeze([...fields]),
            cellIds: Object.freeze(fields.map((field) => cellFor(field, job))),
          }));
        }
      }
    }
  }
  return Object.freeze(jobs);
}

export const CANDIDATE_JOBS = Object.freeze([...allCandidateJobs()].sort((left, right) => left.key.localeCompare(right.key)));
export const SUPPORTED_CELL_IDS = Object.freeze([...new Set(CANDIDATE_JOBS.flatMap((job) => job.cellIds))].sort());
const SUPPORTED_CELL_SET = new Set(SUPPORTED_CELL_IDS);
const JOB_BY_KEY = new Map(CANDIDATE_JOBS.map((job) => [job.key, job]));

export function estimateJobSeconds(job, overrides = {}) {
  if (!job || !JOB_BY_KEY.has(job.key)) throw new Error('PLANNER_UNKNOWN_JOB');
  if (overrides[job.key] !== undefined) {
    const value = overrides[job.key];
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) throw new Error('PLANNER_DURATION_INVALID');
    return value;
  }
  const value = DEFAULT_SECONDS[job.recipe === 'DEFAULT' ? `${job.route}_DEFAULT` : job.recipe];
  if (!value) throw new Error('PLANNER_DURATION_UNAVAILABLE');
  return value + (job.profile === 'PACKAGED_BUILD_RUNTIME' ? 15 : 0);
}

export function durationOverridesFromState(state) {
  if (!state || typeof state !== 'object' || !state.entries || typeof state.entries !== 'object') {
    throw new Error('PLANNER_TIMING_STATE_INVALID');
  }
  const result = {};
  for (const entry of Object.values(state.entries)) {
    if (!entry || typeof entry !== 'object') throw new Error('PLANNER_TIMING_ENTRY_INVALID');
    const job = {
      volume: entry.volume,
      route: entry.route,
      profile: entry.profile,
      recipe: entry.recipe,
    };
    const key = keyFor(job);
    if (!JOB_BY_KEY.has(key)) throw new Error(`PLANNER_TIMING_UNKNOWN_JOB:${key}`);
    const physical = entry.physicalWallSeconds ?? entry.runnerSeconds;
    const verification = entry.verifyWallSeconds ?? entry.verifySeconds ?? 0;
    if (![physical, verification].every((value) => typeof value === 'number' && Number.isFinite(value) && value >= 0)) {
      throw new Error(`PLANNER_TIMING_VALUE_INVALID:${key}`);
    }
    const seconds = physical + verification;
    if (seconds <= 0) throw new Error(`PLANNER_TIMING_VALUE_ZERO:${key}`);
    result[key] = Math.max(result[key] ?? 0, seconds);
  }
  return result;
}

export function validateCellIds(values, label = 'ACCEPTED_CELL_IDS') {
  const result = asSet(values, label);
  for (const cellId of result) {
    if (!SUPPORTED_CELL_SET.has(cellId)) throw new Error(`PLANNER_${label}_UNKNOWN_CELL:${cellId}`);
  }
  return result;
}

function validateJobKeys(values, label) {
  const result = asSet(values, label);
  for (const key of result) if (!JOB_BY_KEY.has(key)) throw new Error(`PLANNER_${label}_UNKNOWN_JOB:${key}`);
  return result;
}

function rank(available, covered, durationOverrides) {
  return available.map((job) => {
    const newCellIds = job.cellIds.filter((cellId) => !covered.has(cellId));
    const estimatedSeconds = estimateJobSeconds(job, durationOverrides);
    return {
      job,
      newCellIds,
      newCells: newCellIds.length,
      estimatedSeconds,
      cellsPerSecond: newCellIds.length / estimatedSeconds,
    };
  }).filter((entry) => entry.newCells > 0).sort((left, right) => (
    right.cellsPerSecond - left.cellsPerSecond
    || right.newCells - left.newCells
    || left.estimatedSeconds - right.estimatedSeconds
    || left.job.key.localeCompare(right.job.key)
  ));
}

export function planBatch({
  acceptedCellIds = [],
  completedJobKeys = [],
  blockedJobKeys = [],
  targetNewCells = 100,
  maxJobs = CANDIDATE_JOBS.length,
  durationOverrides = {},
  fixedOverheadSeconds = 0,
  targetBudgetSeconds = null,
} = {}) {
  assertPositiveInteger(targetNewCells, 'TARGET_NEW_CELLS');
  assertPositiveInteger(maxJobs, 'MAX_JOBS');
  if (typeof fixedOverheadSeconds !== 'number' || !Number.isFinite(fixedOverheadSeconds) || fixedOverheadSeconds < 0) throw new Error('PLANNER_FIXED_OVERHEAD_INVALID');
  if (targetBudgetSeconds !== null && (!Number.isFinite(targetBudgetSeconds) || targetBudgetSeconds <= 0)) throw new Error('PLANNER_TARGET_BUDGET_INVALID');
  const covered = validateCellIds(acceptedCellIds);
  const initiallyCovered = new Set(covered);
  const completed = validateJobKeys(completedJobKeys, 'COMPLETED_JOB_KEYS');
  const blocked = validateJobKeys(blockedJobKeys, 'BLOCKED_JOB_KEYS');
  const available = CANDIDATE_JOBS.filter((job) => !completed.has(job.key) && !blocked.has(job.key));
  const selected = [];
  let estimatedSeconds = 0;

  while (selected.length < maxJobs && selected.reduce((sum, item) => sum + item.newCells, 0) < targetNewCells) {
    const ranked = rank(available.filter((job) => !selected.some((item) => item.job.key === job.key)), covered, durationOverrides);
    const next = ranked[0];
    if (!next) break;
    selected.push(next);
    next.newCellIds.forEach((cellId) => covered.add(cellId));
    estimatedSeconds += next.estimatedSeconds;
  }

  const plannedNewCells = selected.reduce((sum, item) => sum + item.newCells, 0);
  const estimatedTotalSeconds = estimatedSeconds + fixedOverheadSeconds;
  const supportedUncoveredCellIds = SUPPORTED_CELL_IDS.filter((cellId) => !initiallyCovered.has(cellId));
  const selectedCellIds = selected.flatMap((item) => item.newCellIds);
  if (new Set(selectedCellIds).size !== selectedCellIds.length) throw new Error('PLANNER_DUPLICATE_PLANNED_CELL');
  return {
    schemaVersion: PLANNER_SCHEMA_VERSION,
    authority: 'PLANNING_PROJECTION_ONLY_NO_PRODUCT_ADMISSION',
    denominator: FULL_DENOMINATOR_CELLS,
    supportedRecipeCells: SUPPORTED_CELL_IDS.length,
    acceptedCells: acceptedCellIds.length,
    supportedUncoveredCells: supportedUncoveredCellIds.length,
    missingRecipeCells: FULL_DENOMINATOR_CELLS - SUPPORTED_CELL_IDS.length,
    targetNewCells,
    targetReached: plannedNewCells >= targetNewCells,
    plannedNewCells,
    unreachableTarget: Math.max(0, targetNewCells - plannedNewCells),
    estimatedSeconds,
    fixedOverheadSeconds,
    estimatedTotalSeconds,
    estimatedMinutes: Number((estimatedSeconds / 60).toFixed(3)),
    estimatedTotalMinutes: Number((estimatedTotalSeconds / 60).toFixed(3)),
    targetBudgetSeconds,
    withinTargetBudget: targetBudgetSeconds === null ? null : estimatedTotalSeconds <= targetBudgetSeconds,
    candidatesConsidered: available.length,
    skippedCompletedJobs: completed.size,
    skippedBlockedJobs: blocked.size,
    jobs: selected.map((entry) => ({
      key: entry.job.key,
      volume: entry.job.volume,
      route: entry.job.route,
      profile: entry.job.profile,
      recipe: entry.job.recipe,
      fields: entry.job.fields,
      newCellIds: entry.newCellIds,
      newCells: entry.newCells,
      estimatedSeconds: entry.estimatedSeconds,
      cellsPerSecond: Number(entry.cellsPerSecond.toFixed(6)),
    })),
    remainingSupportedCellIds: SUPPORTED_CELL_IDS.filter((cellId) => !covered.has(cellId)),
    invariants: [
      'Every planned cell belongs to the current fixture recipe matrix.',
      'A cell is counted at most once in this plan.',
      'Accepted IDs are caller facts; this projection cannot promote evidence.',
      'A target beyond the supported recipe matrix is reported as unreachable.',
    ],
  };
}

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

function cli(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) throw new Error('PLANNER_UNKNOWN_ARGUMENT');
    const key = arg.slice(2);
    if (key === 'help') return null;
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`PLANNER_ARGUMENT_VALUE_REQUIRED:${key}`);
    options[key] = value;
    index += 1;
  }
  const input = options.accepted ? readJson(options.accepted) : {};
  const acceptedCellIds = Array.isArray(input) ? input : input.acceptedCellIds;
  const completedJobKeys = options.completed ? readJson(options.completed) : [];
  const blockedJobKeys = options.blocked ? readJson(options.blocked) : [];
  const durationOverrides = options.timings ? durationOverridesFromState(readJson(options.timings)) : {};
  return planBatch({
    acceptedCellIds,
    completedJobKeys,
    blockedJobKeys,
    targetNewCells: options.target ? Number(options.target) : 100,
    maxJobs: options.maxJobs ? Number(options.maxJobs) : CANDIDATE_JOBS.length,
    durationOverrides,
    fixedOverheadSeconds: options.overhead ? Number(options.overhead) : 0,
    targetBudgetSeconds: options.budget ? Number(options.budget) : null,
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const result = cli(process.argv.slice(2));
    if (result === null) {
      console.log('Usage: node rtk-interop-word-manuscript-batch-plan.mjs [--accepted FILE] [--target N] [--maxJobs N]');
    } else {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

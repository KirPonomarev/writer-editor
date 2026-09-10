import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  buildEffectiveStateProjectionOnFullGraph,
  buildSelectionReceiptOnFullGraph,
  validateCommittedR24Sot,
} from '../../scripts/ops/r24/executable-program.mjs';
import { canonicalDigest, readJsonBounded } from '../../scripts/ops/r24/canonical-json.mjs';

const PLAN_STATE = 'docs/OPS/R24/PLAN_STATE_R24.json';
const PROGRAM = 'docs/OPS/R24/EXECUTABLE_PROGRAM_R2_4.json';
const NOW = '2026-09-09T00:00:00.000Z';

test('R24-RCV-00B binds status, next-node selection and completion to one effective projection', () => {
  const planState = readJsonBounded(PLAN_STATE);
  const before = fs.readFileSync(PLAN_STATE, 'utf8');
  const { effectiveStateProjection } = buildEffectiveStateProjectionOnFullGraph({ now: NOW, planState });
  const selection = buildSelectionReceiptOnFullGraph({ now: NOW, planState });
  const status = validateCommittedR24Sot({ now: NOW });

  assert.equal(fs.readFileSync(PLAN_STATE, 'utf8'), before);
  assert.equal(effectiveStateProjection.sourceDigests.rawPlanStateDigest, canonicalDigest(planState));
  assert.equal(effectiveStateProjection.sourceDigests.programDigest, canonicalDigest(readJsonBounded(PROGRAM)));
  assert.equal(selection.stateDigest, effectiveStateProjection.schedulerProjection.stateDigest);
  assert.equal(selection.contourStatesDigest, effectiveStateProjection.effectiveState.digest);
  assert.equal(status.effectiveSchedulerStateDigest, effectiveStateProjection.schedulerProjection.stateDigest);
  assert.deepEqual(status.effectiveStateCounts, effectiveStateProjection.statusProjection.counts);
  assert.equal(status.effectiveCompletionProgramDone, effectiveStateProjection.completion.programDone);
  assert.equal(status.effectiveCompletionRequiredPendingCount, effectiveStateProjection.completion.requiredPendingCount);
  assert.equal(effectiveStateProjection.noAutomaticGraphTransition, true);
});

import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  W0_CURRENT_HEAD_EFFECTIVE_STATE_OVERLAY_PATH,
  buildEffectiveStateProjectionOnFullGraph,
  buildSelectionReceiptOnFullGraph,
  loadCommittedEffectiveStateOverlays,
  normalizeW0EffectiveStateOverlay,
  validateCommittedR24Sot,
} from '../../scripts/ops/r24/executable-program.mjs';
import { readJsonBounded } from '../../scripts/ops/r24/canonical-json.mjs';

const PLAN_STATE_PATH = 'docs/OPS/R24/PLAN_STATE_R24.json';
const NOW = '2026-09-11T00:00:00.000Z';

const clone = (value) => JSON.parse(JSON.stringify(value));

function loadInputs() {
  const planState = readJsonBounded(PLAN_STATE_PATH);
  const carrier = readJsonBounded(W0_CURRENT_HEAD_EFFECTIVE_STATE_OVERLAY_PATH);
  const { effectiveStateProjection, program, evaluationHeadSha, evaluationTreeSha } = buildEffectiveStateProjectionOnFullGraph({
    now: NOW,
    planState,
  });
  return { planState, carrier, effectiveStateProjection, program, evaluationHeadSha, evaluationTreeSha };
}

test('W0 current-head overlay closes only the effective state while preserving raw plan state', () => {
  const before = fs.readFileSync(PLAN_STATE_PATH, 'utf8');
  const planState = readJsonBounded(PLAN_STATE_PATH);
  const { effectiveStateProjection } = buildEffectiveStateProjectionOnFullGraph({ now: NOW, planState });
  const selection = buildSelectionReceiptOnFullGraph({ now: NOW, planState });
  const status = validateCommittedR24Sot({ now: NOW });

  assert.equal(fs.readFileSync(PLAN_STATE_PATH, 'utf8'), before);
  assert.equal(effectiveStateProjection.rawState.contourStates.W0_WORD_PHYSICAL_RECERTIFICATION, 'BLOCKED_TYPED');
  assert.equal(effectiveStateProjection.effectiveState.states.W0_WORD_PHYSICAL_RECERTIFICATION, 'DONE');
  assert.equal(effectiveStateProjection.overlayResolution.appliedCount, 1);
  assert.deepEqual(
    effectiveStateProjection.overlayResolution.applied.map((overlay) => overlay.overlayId),
    ['W0_WORD_PHYSICAL_RECERTIFICATION_CURRENT_HEAD_OVERLAY_V1'],
  );
  assert.deepEqual(effectiveStateProjection.effectiveState.counts, {
    BLOCKED_TYPED: 3,
    DONE: 50,
    INELIGIBLE_OPTIONAL: 10,
    PENDING: 46,
  });
  assert.equal(effectiveStateProjection.completion.programDone, false);
  assert.equal(effectiveStateProjection.completion.requiredPendingCount, 49);
  assert.equal(selection.selectedKind, 'NONE');
  assert.equal(selection.selectedId, null);
  assert.equal(selection.verdict, 'NO_ELIGIBLE_NODE');
  assert.deepEqual(selection.reasons, ['NO_DEPENDENCY_CLOSED_PENDING_NODE']);
  assert.deepEqual(selection.readySet, []);
  assert.deepEqual(status.effectiveStateCounts, effectiveStateProjection.statusProjection.counts);
  assert.equal(status.effectiveCompletionRequiredPendingCount, 49);
});

test('W0 overlay loader returns an exact current-head effective-state overlay', () => {
  const { planState, carrier, program, evaluationHeadSha, evaluationTreeSha } = loadInputs();
  const overlays = loadCommittedEffectiveStateOverlays({ program, planState, evaluationHeadSha, evaluationTreeSha });

  assert.equal(overlays.length, 1);
  assert.deepEqual(overlays[0], normalizeW0EffectiveStateOverlay(carrier, {
    program,
    planState,
    evaluationHeadSha,
    evaluationTreeSha,
  }));
  assert.equal(overlays[0].schemaVersion, 'R24_EFFECTIVE_STATE_OVERLAY_V1');
  assert.equal(overlays[0].targetNodeId, 'W0_WORD_PHYSICAL_RECERTIFICATION');
  assert.equal(overlays[0].from, 'BLOCKED_TYPED');
  assert.equal(overlays[0].to, 'DONE');
  assert.equal(overlays[0].baseHeadSha, evaluationHeadSha);
  assert.equal(overlays[0].baseTreeSha, evaluationTreeSha);
  assert.equal(overlays[0].selfPromotion, false);
});

test('W0 overlay rejects stale or widened plan digest evidence', () => {
  const { carrier, program, planState, evaluationHeadSha, evaluationTreeSha } = loadInputs();
  const stale = clone(carrier);
  stale.basePlanStateDigest = '0'.repeat(64);

  assert.throws(
    () => normalizeW0EffectiveStateOverlay(stale, { program, planState, evaluationHeadSha, evaluationTreeSha }),
    (error) => error.code === 'E_R24_W0_OVERLAY_PLAN_DIGEST',
  );
});

test('W0 overlay rejects wrong physical receipt evidence', () => {
  const { carrier, program, planState, evaluationHeadSha, evaluationTreeSha } = loadInputs();
  const wrong = clone(carrier);
  wrong.physicalReceiptSha256 = '1'.repeat(64);

  assert.throws(
    () => normalizeW0EffectiveStateOverlay(wrong, { program, planState, evaluationHeadSha, evaluationTreeSha }),
    (error) => error.code === 'E_R24_W0_OVERLAY_FIELD',
  );
});

test('W0 overlay rejects a mutated immutable candidate tree binding', () => {
  const { carrier, program, planState, evaluationHeadSha, evaluationTreeSha } = loadInputs();
  const mutated = clone(carrier);
  mutated.immutableCandidateTreeSha = '2'.repeat(40);

  assert.throws(
    () => normalizeW0EffectiveStateOverlay(mutated, { program, planState, evaluationHeadSha, evaluationTreeSha }),
    (error) => error.code === 'E_R24_W0_OVERLAY_CANDIDATE_TREE',
  );
});

test('W0 overlay rejects missing non-claim fences', () => {
  const { carrier, program, planState, evaluationHeadSha, evaluationTreeSha } = loadInputs();
  const missing = clone(carrier);
  missing.nonClaims = missing.nonClaims.filter((claim) => claim !== 'NO_RELEASE_READINESS');

  assert.throws(
    () => normalizeW0EffectiveStateOverlay(missing, { program, planState, evaluationHeadSha, evaluationTreeSha }),
    (error) => error.code === 'E_R24_W0_OVERLAY_NON_CLAIMS',
  );
});

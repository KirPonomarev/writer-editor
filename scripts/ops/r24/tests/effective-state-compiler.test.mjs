import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { canonicalDigest, readJsonBounded } from '../canonical-json.mjs';
import {
  EFFECTIVE_STATE_COMPILER_ID,
  buildRawContourStates,
  compileEffectiveState,
  countStates,
} from '../effective-state-compiler.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const R24_DIR = path.join(REPO_ROOT, 'docs', 'OPS', 'R24');
const NOW = '2026-09-09T00:00:00.000Z';
const HEAD = '4761f80544808396bd287a44a640104d400bbf55';
const TREE = '9'.repeat(40);
const DIGEST = '1'.repeat(64);

function miniProgram() {
  return {
    schemaVersion: 'fixture',
    guards: [{ id: 'G0_AUTHORITY_CLOSURE', state: 'CURRENT' }],
    nodes: [
      { id: 'ROOT', kind: 'FOUNDATION', profile: 'P1', dependsOn: [], state: 'DONE' },
      { id: 'A', kind: 'WORK_PACKAGE', profile: 'P1', dependsOn: ['ROOT'], state: 'PENDING' },
      { id: 'B', kind: 'WORK_PACKAGE', profile: 'P1', dependsOn: ['A'], state: 'PENDING' },
    ],
  };
}

function planState(contours = {}, leases = {}) {
  return {
    schemaVersion: 'yalken.plan-state.r24.v2',
    revision: 7,
    fencingCounter: 3,
    contours,
    leases,
    idempotency: {},
    replayBaseline: {
      schemaVersion: 'PlanStateReplayBaselineV1',
      revision: 7,
      fencingCounter: 3,
      contourStatesDigest: canonicalDigest(Object.fromEntries(Object.entries(contours).map(([id, row]) => [id, row.state]))),
      classification: 'GENESIS',
      sourceHeadSha: null,
      adoptedAt: null,
      authority: 'FIXTURE',
      unreplayableContourIds: [],
    },
    transitionHistory: [],
  };
}

function exact() {
  return {
    implementationSourceSha: HEAD,
    evaluationHeadSha: HEAD,
    evaluationTreeSha: TREE,
    originMainSha: HEAD,
  };
}

function overlay(overrides = {}) {
  const program = miniProgram();
  const state = planState();
  return {
    schemaVersion: 'R24_EFFECTIVE_STATE_OVERLAY_V1',
    overlayId: 'overlay-1',
    sequence: 0,
    predecessorOverlayId: null,
    baseHeadSha: HEAD,
    basePlanStateDigest: canonicalDigest(state),
    baseProgramDigest: canonicalDigest(program),
    targetNodeId: 'A',
    from: 'PENDING',
    to: 'DONE',
    transitionId: DIGEST,
    receiptSha256: '2'.repeat(64),
    proofAuthority: 'EXTERNAL_TERMINAL_RECEIPT',
    ...overrides,
  };
}

test('current committed R24 plan compiles to one immutable projection for status and completion', () => {
  const program = readJsonBounded(path.join(R24_DIR, 'EXECUTABLE_PROGRAM_R2_4.json'));
  const state = readJsonBounded(path.join(R24_DIR, 'PLAN_STATE_R24.json'));
  const before = canonicalDigest(state);
  const projection = compileEffectiveState({
    program,
    planState: state,
    generatedAt: NOW,
    exactIdentity: exact(),
  });
  assert.equal(canonicalDigest(state), before);
  assert.equal(projection.schemaVersion, 'R24_EFFECTIVE_STATE_PROJECTION_V1');
  assert.equal(projection.compilerId, EFFECTIVE_STATE_COMPILER_ID);
  assert.equal(projection.rawState.immutable, true);
  assert.equal(projection.rawState.revision, 283);
  assert.equal(projection.rawState.fencingCounter, 47);
  assert.equal(projection.rawState.activeLeaseCount, 0);
  assert.deepEqual(projection.effectiveState.counts, {
    BLOCKED_TYPED: 4,
    DONE: 49,
    INELIGIBLE_OPTIONAL: 10,
    PENDING: 46,
  });
  assert.equal(projection.statusProjection.counts.DONE, 49);
  assert.equal(projection.completion.programDone, false);
  assert.equal(projection.completion.requiredPendingCount, 50);
  assert.equal(projection.noAutomaticGraphTransition, true);
});

test('valid append-only overlay updates only effective projection and preserves raw state', () => {
  const program = miniProgram();
  const state = planState();
  const before = canonicalDigest(state);
  const projection = compileEffectiveState({
    program,
    planState: state,
    overlays: [overlay()],
    generatedAt: NOW,
    exactIdentity: exact(),
  });
  assert.equal(canonicalDigest(state), before);
  assert.equal(projection.rawState.contourStates.A, 'PENDING');
  assert.equal(projection.effectiveState.states.A, 'DONE');
  assert.deepEqual(projection.overlayResolution.applied.map((row) => row.overlayId), ['overlay-1']);
  assert.equal(projection.schedulerProjection.contourStates.A, 'DONE');
});

test('delivery receipts and external attestations stay freshly-proven, not recorded state', () => {
  const program = miniProgram();
  const state = planState();
  const projection = compileEffectiveState({
    program,
    planState: state,
    deliveryReceipts: [{
      schemaVersion: 'R24_EFFECTIVE_DELIVERY_RECEIPT_V1',
      deliveryId: 'delivery-1',
      nodeId: 'A',
      status: 'POSTMERGE_VERIFIED',
      currentHeadSha: HEAD,
      observedSha: HEAD,
      receiptSha256: '3'.repeat(64),
      proofAuthority: 'CI_TERMINAL_RECEIPT',
    }],
    externalAttestations: [{
      schemaVersion: 'R24_EFFECTIVE_EXTERNAL_ATTESTATION_V1',
      attestationId: 'attestation-1',
      nodeId: 'A',
      result: 'PASS',
      evaluationHeadSha: HEAD,
      evaluationTreeSha: TREE,
      attestationSha256: '4'.repeat(64),
      proofAuthority: 'EXTERNAL_TERMINAL_RECEIPT',
    }],
    generatedAt: NOW,
    exactIdentity: exact(),
  });
  assert.equal(projection.effectiveState.states.A, 'PENDING');
  assert.equal(projection.freshlyProvenProgress.deliveryReceipts.length, 1);
  assert.equal(projection.freshlyProvenProgress.externalAttestations.length, 1);
});

test('negative matrix rejects conflicting overlays, stale sha, missing predecessor, cycle, duplicate transition and self-promotion', () => {
  const program = miniProgram();
  const state = planState();
  const rejects = [
    () => compileEffectiveState({ program, planState: state, overlays: [overlay({ from: 'DONE' })], generatedAt: NOW, exactIdentity: exact() }),
    () => compileEffectiveState({ program, planState: state, overlays: [overlay({ baseHeadSha: '8'.repeat(40) })], generatedAt: NOW, exactIdentity: exact() }),
    () => compileEffectiveState({ program, planState: state, overlays: [overlay({ predecessorOverlayId: 'missing' })], generatedAt: NOW, exactIdentity: exact() }),
    () => compileEffectiveState({ program: { ...program, nodes: [...program.nodes, { id: 'C', kind: 'WORK_PACKAGE', profile: 'P1', dependsOn: ['C'], state: 'PENDING' }] }, planState: state, generatedAt: NOW, exactIdentity: exact() }),
    () => compileEffectiveState({ program, planState: state, overlays: [overlay(), { ...overlay({ overlayId: 'overlay-2', sequence: 1, predecessorOverlayId: 'overlay-1' }) }], generatedAt: NOW, exactIdentity: exact() }),
    () => compileEffectiveState({ program, planState: state, overlays: [overlay({ selfPromotion: true })], generatedAt: NOW, exactIdentity: exact() }),
  ];
  for (const reject of rejects) assert.throws(reject, /E_R24_EFFECTIVE_/);
  assert.equal(rejects.length, 6);
});

test('implementation mutants: raw-state bypass and completion overclaim are observable', () => {
  const program = miniProgram();
  const state = planState();
  const projection = compileEffectiveState({
    program,
    planState: state,
    overlays: [overlay()],
    generatedAt: NOW,
    exactIdentity: exact(),
  });
  assert.notDeepEqual(projection.rawState.contourStates, projection.effectiveState.states);
  assert.deepEqual(countStates(projection.effectiveState.states), { DONE: 2, PENDING: 1 });
  assert.equal(buildRawContourStates({ program, planState: state }).A, 'PENDING');
  const overclaim = { ...projection, completion: { ...projection.completion, programDone: true } };
  assert.notDeepEqual(overclaim.completion, projection.completion);
});

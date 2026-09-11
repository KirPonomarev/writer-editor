import assert from 'node:assert/strict';
import test from 'node:test';
import {
  RCV00D_BASE_SHA,
  RCV00D_BASE_TREE,
  RCV00D_EXPECTED_GRAPH_CANDIDATE,
  RCV00D_EXPECTED_GRAPH_VERDICT,
  RCV00D_NON_CLAIMS,
  RCV00D_REQUIRED_COVERAGE,
  RCV00D_REQUIRED_PROOF,
  RCV00D_SELECTED_CONTOUR,
  RCV00D_SELECTED_OBSERVATION_ID,
  buildRcv00dSelectorContext,
  buildRcv00dSelectorReceipt,
  parseNarrativeNextStep,
  selectRcv00dCorrectiveCandidate,
  validateRcv00dSelectorReceipt,
} from '../../scripts/ops/r24/corrective/rcv00d-graph-derived-selector.mjs';
import {
  RCV00C_REGISTER_PATH,
  validateCorrectiveRegister,
} from '../../scripts/ops/r24/corrective/rcv00c-corrective-register.mjs';
import { readJsonBounded } from '../../scripts/ops/r24/canonical-json.mjs';

const NOW = '2026-09-09T00:00:00.000Z';
const clone = (value) => structuredClone(value);
const loadRegister = () => readJsonBounded(RCV00C_REGISTER_PATH);
const baseContext = () => buildRcv00dSelectorContext({ now: NOW });

test('RCV00D selector chooses the active P1 current observation when the graph has no eligible node', () => {
  const receipt = buildRcv00dSelectorReceipt({ now: NOW });
  const result = validateRcv00dSelectorReceipt(receipt);

  assert.equal(result.status, 'PASS');
  assert.equal(receipt.identity.headSha, RCV00D_BASE_SHA);
  assert.equal(receipt.identity.treeSha, RCV00D_BASE_TREE);
  assert.equal(receipt.graphSchedulerCandidate.selectedId, RCV00D_EXPECTED_GRAPH_CANDIDATE);
  assert.equal(receipt.graphSchedulerCandidate.selectedKind, 'NONE');
  assert.equal(receipt.graphSchedulerCandidate.verdict, RCV00D_EXPECTED_GRAPH_VERDICT);
  assert.equal(receipt.graphSchedulerCandidate.readySet.length, 0);
  assert.equal(receipt.narrativeNextStep, 'R24-RCV-00A');
  assert.equal(receipt.narrativeNextStepAuthoritative, false);
  assert.equal(receipt.selected.kind, 'CURRENT_OBSERVATION');
  assert.equal(receipt.selected.id, RCV00D_SELECTED_OBSERVATION_ID);
  assert.equal(receipt.selected.contourId, RCV00D_SELECTED_CONTOUR);
  assert.equal(receipt.selected.severity, 'P1');
  assert.equal(receipt.selected.requiredProof, RCV00D_REQUIRED_PROOF);
  for (const token of RCV00D_REQUIRED_COVERAGE) assert(receipt.selected.requiredCoverage.includes(token));
  for (const token of RCV00D_NON_CLAIMS) assert(receipt.nonClaims.includes(token));
  assert.equal(receipt.selectedCount, 1);
  assert.equal(receipt.registerSummary.findingCount, 45);
  assert.equal(receipt.registerSummary.currentObservationCount, 1);
});

test('RCV00D selector records narrative NEXT_STEP as non-authoritative input', () => {
  const control = buildRcv00dSelectorReceipt({ now: NOW });
  const context = baseContext();
  context.planText = context.planText.replace(/^NEXT_STEP:.+$/m, 'NEXT_STEP: PK1_RELEASE_SECURITY_PHYSICAL');
  context.narrativeNextStep = parseNarrativeNextStep(context.planText);
  const selection = selectRcv00dCorrectiveCandidate(context);

  assert.equal(context.narrativeNextStep, 'PK1_RELEASE_SECURITY_PHYSICAL');
  assert.equal(selection.selected.id, control.selected.id);
  assert.equal(selection.selected.contourId, RCV00D_SELECTED_CONTOUR);
});

test('RCV00D selector keeps blocked external graph nodes out of the selected corrective lane', () => {
  const receipt = buildRcv00dSelectorReceipt({ now: NOW });
  const pk1 = receipt.candidates.find((candidate) => candidate.id === 'REL-01');

  assert.equal(pk1.mappedExistingGraphNode, 'PK1_RELEASE_SECURITY_PHYSICAL');
  assert.equal(pk1.eligible, false);
  assert(pk1.ineligibilityReasons.includes('GRAPH_NODE_NOT_READY_OR_BLOCKED'));
  assert.equal(receipt.selected.id, RCV00D_SELECTED_OBSERVATION_ID);
});

test('RCV00D selector ranks active P1 data authority ahead of P3 deferred debt', () => {
  const context = baseContext();
  const selection = selectRcv00dCorrectiveCandidate(context);
  const eligibleP3 = selection.eligibleCandidates.filter((candidate) => candidate.severity === 'P3');

  assert(eligibleP3.length > 0);
  assert.equal(selection.selected.severity, 'P1');
  assert.equal(selection.selected.id, RCV00D_SELECTED_OBSERVATION_ID);
});

test('RCV00D selector is deterministic for equal graph/register inputs', () => {
  const left = buildRcv00dSelectorReceipt({ now: NOW });
  const right = buildRcv00dSelectorReceipt({ now: NOW });

  assert.deepEqual(left.selected, right.selected);
  assert.equal(left.candidateSetDigest, right.candidateSetDigest);
  assert.equal(left.eligibleCandidateSetDigest, right.eligibleCandidateSetDigest);
  assert.equal(left.inputDigests.correctiveRegister, right.inputDigests.correctiveRegister);
  assert.equal(left.inputDigests.effectiveStateProjection, right.inputDigests.effectiveStateProjection);
});

test('RCV00D selector rejects a graph-promotion mutant on the current observation', () => {
  const context = baseContext();
  context.register = clone(context.register);
  context.register.currentObservations[0].graphPromotionAllowed = true;

  assert.throws(() => selectRcv00dCorrectiveCandidate(context), /E_RCV00D_CURRENT_OBSERVATION_GRAPH_PROMOTION/);
});

test('RCV00D selector rejects a mutated current observation proof contract', () => {
  const context = baseContext();
  context.register = clone(context.register);
  context.register.currentObservations[0].requiredProof = 'GLOBAL_TRUTHY_OK_WEAKENING';

  assert.throws(() => selectRcv00dCorrectiveCandidate(context), /E_RCV00D_SELECTED_REQUIRED_PROOF/);
});

test('RCV00D selector rejects wrong graph receipt identity', () => {
  const context = baseContext();
  context.graphSelectionReceipt = clone(context.graphSelectionReceipt);
  context.graphSelectionReceipt.stateDigest = '0'.repeat(64);

  assert.throws(() => selectRcv00dCorrectiveCandidate(context), /E_RCV00D_GRAPH_RECEIPT_STATE_BINDING/);
});

test('RCV00D selector rejects graph-only candidate drift', () => {
  const context = baseContext();
  context.graphSelectionReceipt = clone(context.graphSelectionReceipt);
  context.graphSelectionReceipt.selectedKind = 'NODE';
  context.graphSelectionReceipt.selectedId = 'PK1_RELEASE_SECURITY_PHYSICAL';
  context.graphSelectionReceipt.verdict = 'SELECTED';

  assert.throws(() => selectRcv00dCorrectiveCandidate(context), /E_RCV00D_GRAPH_CANDIDATE_BINDING/);
});

test('RCV00D selector rejects a stale/mutated RCV00C register before selection', () => {
  const register = clone(loadRegister());
  register.currentObservations = [];

  assert.throws(() => validateCorrectiveRegister(register), /E_RCV00C_CURRENT_OBSERVATION_DENOMINATOR/);
  assert.throws(() => buildRcv00dSelectorContext({ now: NOW, register }), /E_RCV00C_CURRENT_OBSERVATION_DENOMINATOR/);
});

test('RCV00D receipt rejects a same-count candidate-set digest mutant', () => {
  const receipt = buildRcv00dSelectorReceipt({ now: NOW });
  const mutant = clone(receipt);
  mutant.candidates[0].severity = 'P3';

  assert.throws(() => validateRcv00dSelectorReceipt(mutant), /E_RCV00D_SELECTED_SEVERITY_STATUS_PROOF|E_RCV00D_CANDIDATE_SET_DIGEST/);
});

test('RCV00D receipt rejects graph-node selection as a false closure', () => {
  const receipt = buildRcv00dSelectorReceipt({ now: NOW });
  const mutant = clone(receipt);
  mutant.selected = receipt.candidates.find((candidate) => candidate.id === 'REL-01');

  assert.throws(() => validateRcv00dSelectorReceipt(mutant), /E_RCV00D_SELECTED_ITEM_BINDING/);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
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
import { canonicalDigest, readJsonBounded } from '../../scripts/ops/r24/canonical-json.mjs';

const NOW = '2026-09-09T00:00:00.000Z';
const clone = (value) => structuredClone(value);
const loadRegister = () => readJsonBounded(RCV00C_REGISTER_PATH);
const baseContext = () => buildRcv00dSelectorContext({ now: NOW });

test('RCV00D selector chooses the active P1 current observation when the graph has no eligible node', () => {
  const receipt = buildRcv00dSelectorReceipt({ now: NOW });
  const context = baseContext();
  const result = validateRcv00dSelectorReceipt(receipt, context);

  assert.equal(result.status, 'PASS');
  assert.equal(receipt.identity.headSha, context.effectiveStateProjection.exactIdentity.evaluationHeadSha);
  assert.equal(receipt.identity.treeSha, context.effectiveStateProjection.exactIdentity.evaluationTreeSha);
  assert.equal(receipt.identity.originMainSha, context.effectiveStateProjection.exactIdentity.originMainSha);
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

test('RCV00D immutable historical receipt remains valid only at its pinned identity', () => {
  const receipt = readJsonBounded('docs/OPS/R24/EVIDENCE/ES-R24-RCV00D-GRAPH-DERIVED-SELECTOR-RECEIPT.json');
  assert.equal(receipt.identity.headSha, RCV00D_BASE_SHA);
  assert.equal(receipt.identity.treeSha, RCV00D_BASE_TREE);
  assert.equal(validateRcv00dSelectorReceipt(receipt).status, 'PASS');
  const changed = clone(receipt);
  changed.identity.headSha = '1'.repeat(40);
  assert.throws(() => validateRcv00dSelectorReceipt(changed), /E_RCV00D_RECEIPT_IDENTITY_BINDING/);
});

for (const field of ['headSha', 'originMainSha', 'treeSha']) {
  test(`RCV00D current receipt rejects wrong, malformed and absent ${field}`, () => {
    const context = baseContext();
    const receipt = buildRcv00dSelectorReceipt({ now: NOW });
    for (const value of ['1'.repeat(40), 'invalid-sha', undefined]) {
      const changed = clone(receipt);
      if (value === undefined) delete changed.identity[field]; else changed.identity[field] = value;
      assert.throws(() => validateRcv00dSelectorReceipt(changed, context), /E_RCV00D_RECEIPT_IDENTITY_BINDING/);
    }
  });
}

test('RCV00D current receipt requires context and rejects stale successor identity after digest resealing', () => {
  const context = baseContext();
  const receipt = buildRcv00dSelectorReceipt({ now: NOW });
  assert.equal(validateRcv00dSelectorReceipt(receipt, context).status, 'PASS');
  assert.throws(() => validateRcv00dSelectorReceipt(receipt), /E_RCV00D_RECEIPT_IDENTITY_BINDING/);
  const stale = clone(receipt);
  stale.identity = { headSha: RCV00D_BASE_SHA, originMainSha: RCV00D_BASE_SHA, treeSha: RCV00D_BASE_TREE };
  assert.throws(() => validateRcv00dSelectorReceipt(stale, context), /E_RCV00D_RECEIPT_IDENTITY_BINDING/);
  const absent = clone(receipt);
  delete absent.identity;
  assert.throws(() => validateRcv00dSelectorReceipt(absent, context), /E_RCV00D_RECEIPT_IDENTITY_REQUIRED/);
});

test('RCV00D selector rejects mixed graph and projection identity roles', () => {
  for (const field of ['implementationSourceSha', 'evaluationHeadSha', 'evaluationTreeSha']) {
    const context = baseContext();
    context.graphSelectionReceipt.identityRoles[field] = '2'.repeat(40);
    assert.throws(() => selectRcv00dCorrectiveCandidate(context), /E_RCV00D_(EVALUATION|IMPLEMENTATION)_IDENTITY_BINDING/);
  }
  for (const field of ['implementationSourceSha', 'evaluationHeadSha', 'evaluationTreeSha', 'originMainSha']) {
    const context = baseContext();
    context.effectiveStateProjection.exactIdentity[field] = '3'.repeat(40);
    assert.throws(() => selectRcv00dCorrectiveCandidate(context), /E_RCV00D_(EVALUATION|IMPLEMENTATION|ORIGIN)_IDENTITY_BINDING/);
  }
});

test('RCV00D current receipt rejects changed source-file digests and graph snapshot revision', () => {
  const context = baseContext();
  const receipt = buildRcv00dSelectorReceipt({ now: NOW });
  for (const field of ['correctiveRegisterFile', 'planTextFile', 'planStateFile']) {
    const changed = clone(receipt);
    changed.inputDigests[field] = '4'.repeat(64);
    assert.throws(() => validateRcv00dSelectorReceipt(changed, context), /E_RCV00D_SOURCE_FILE_DIGEST_BINDING/);
  }
  for (const field of ['stateRevision', 'fencingCounter', 'readySet']) {
    const changed = clone(receipt);
    changed.graphSchedulerCandidate[field] = field === 'readySet' ? ['PK1_RELEASE_SECURITY_PHYSICAL'] : changed.graphSchedulerCandidate[field] + 1;
    assert.throws(() => validateRcv00dSelectorReceipt(changed, context), /E_RCV00D_GRAPH_SNAPSHOT_BINDING/);
  }
});

test('RCV00D receipt validation independently rejects resealed mixed-head context', () => {
  const context = baseContext();
  const receipt = buildRcv00dSelectorReceipt({ now: NOW });
  context.graphSelectionReceipt.identityRoles.evaluationHeadSha = '5'.repeat(40);
  receipt.inputDigests.graphSelectionReceipt = canonicalDigest(context.graphSelectionReceipt);
  context.inputDigests.graphSelectionReceipt = receipt.inputDigests.graphSelectionReceipt;
  assert.throws(() => validateRcv00dSelectorReceipt(receipt, context), /E_RCV00D_EVALUATION_IDENTITY_BINDING/);
});

const serializedReceipt = () => JSON.parse(JSON.stringify(buildRcv00dSelectorReceipt({ now: NOW })));
const unrelatedCandidateIndex = (receipt) => {
  const index = receipt.candidates.findIndex((candidate) => candidate.id !== receipt.selected.id && candidate.id !== 'REL-01');
  assert.ok(index >= 0);
  return index;
};
const resealCandidates = (receipt) => {
  const eligible = receipt.candidates.filter((candidate) => candidate.eligible);
  receipt.candidateSetDigest = canonicalDigest(receipt.candidates);
  receipt.eligibleCandidateSetDigest = canonicalDigest(eligible);
  receipt.candidateCount = receipt.candidates.length;
  receipt.eligibleCandidateCount = eligible.length;
};

test('RCV00D serialized current receipt validates without selected-candidate object aliasing', () => {
  const receipt = serializedReceipt();
  const candidate = receipt.candidates.find((entry) => entry.id === receipt.selected.id);
  assert.notStrictEqual(receipt.selected, candidate);
  assert.deepEqual(receipt.selected, candidate);
  assert.equal(validateRcv00dSelectorReceipt(receipt, baseContext()).status, 'PASS');
});

const resealedMutations = [
  ['eligible digest forged', (receipt) => { receipt.eligibleCandidateSetDigest = '0'.repeat(64); }],
  ['candidate count forged', (receipt) => { receipt.candidateCount += 7; }],
  ['eligible count forged', (receipt) => { receipt.eligibleCandidateCount += 7; }],
  ['register summary forged', (receipt) => { receipt.registerSummary.findingCount += 7; }],
  ['reasons erased', (receipt) => { receipt.reasons = []; }],
  ['selection policy erased', (receipt) => { receipt.correctiveSelectionPolicy.deliveredContourIds = []; }],
  ['selected source audit forged', (receipt) => { receipt.selected.sourceAuditId = 'FORGED_SOURCE_AUDIT'; }],
  ['unrelated candidate removed and resealed', (receipt) => {
    receipt.candidates.splice(unrelatedCandidateIndex(receipt), 1);
    resealCandidates(receipt);
  }],
  ['unrelated candidate mutated and resealed', (receipt) => {
    receipt.candidates[unrelatedCandidateIndex(receipt)].sourceAuditId = 'FORGED_CANDIDATE_SOURCE';
    resealCandidates(receipt);
  }],
  ['candidate order reversed and resealed', (receipt) => {
    receipt.candidates.reverse();
    resealCandidates(receipt);
  }],
];

for (const [name, mutate] of resealedMutations) {
  test(`RCV00D current context rejects serialized receipt with ${name}`, () => {
    const receipt = serializedReceipt();
    mutate(receipt);
    assert.throws(() => validateRcv00dSelectorReceipt(receipt, baseContext()), /E_RCV00D_CONTEXT_DERIVATION_BINDING/);
  });
}

const historicalSnapshots = [
  { sha: '0b2476fc6ab881202ccc2c0087a57fea85a54195', digest: 'f432c3683d945466e95df98bbf9d2b82d81e471ce60e1dd01c0ebcb398af706a' },
  { sha: '9c85e70b3166f2a78e61d5aba454820afa303e80', digest: '85fe2b9ed1cce00367444ad6654e51add80c7ce8484015947b20e7a6b8e9af61' },
];
const loadHistoricalSnapshot = (snapshot) => JSON.parse(execFileSync('git', [
  'show', `${snapshot.sha}:docs/OPS/R24/EVIDENCE/ES-R24-RCV00D-GRAPH-DERIVED-SELECTOR-RECEIPT.json`,
]));
const historicalMutations = [
  ['selected source audit forged', (receipt) => { receipt.selected.sourceAuditId = 'FORGED_HISTORICAL_SOURCE'; }],
  ['unrelated candidate forged and resealed', (receipt) => {
    receipt.candidates[unrelatedCandidateIndex(receipt)].sourceAuditId = 'FORGED_HISTORICAL_CANDIDATE';
    resealCandidates(receipt);
  }],
  ['unrelated candidate removed and resealed', (receipt) => {
    receipt.candidates.splice(unrelatedCandidateIndex(receipt), 1);
    resealCandidates(receipt);
  }],
  ['eligible digest forged', (receipt) => { receipt.eligibleCandidateSetDigest = '0'.repeat(64); }],
  ['register summary forged', (receipt) => { receipt.registerSummary.findingCount += 9; }],
  ['input digests forged', (receipt) => {
    for (const key of Object.keys(receipt.inputDigests)) receipt.inputDigests[key] = '0'.repeat(64);
  }],
  ['reasons erased', (receipt) => { receipt.reasons = []; }],
  ['selection policy erased', (receipt) => { receipt.correctiveSelectionPolicy.deliveredContourIds = []; }],
  ['generated time forged', (receipt) => { receipt.generatedAtUtc = '2099-01-01T00:00:00.000Z'; }],
];
const historicalDifferencePaths = [
  ['graphSchedulerCandidate', 'stateDigest'],
  ['inputDigests', 'effectiveStateProjection'],
  ['inputDigests', 'graphSelectionReceipt'],
];

for (const [index, snapshot] of historicalSnapshots.entries()) {
  test(`RCV00D exact historical snapshot ${snapshot.sha} accepts serialization and key-order changes`, () => {
    const receipt = loadHistoricalSnapshot(snapshot);
    assert.equal(canonicalDigest(receipt), snapshot.digest);
    const selectedCandidate = receipt.candidates.find((entry) => entry.id === receipt.selected.id);
    assert.notStrictEqual(receipt.selected, selectedCandidate);
    assert.deepEqual(receipt.selected, selectedCandidate);
    assert.equal(validateRcv00dSelectorReceipt(receipt).status, 'PASS');
    const formatted = JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(receipt).reverse()), null, 4));
    assert.equal(validateRcv00dSelectorReceipt(formatted).status, 'PASS');
  });
  for (const [name, mutate] of historicalMutations) {
    test(`RCV00D historical snapshot ${snapshot.sha} rejects serialized receipt with ${name}`, () => {
      const receipt = loadHistoricalSnapshot(snapshot);
      mutate(receipt);
      assert.throws(() => validateRcv00dSelectorReceipt(receipt), /E_RCV00D_HISTORICAL_RECEIPT_BINDING/);
    });
  }
  for (const [parent, field] of historicalDifferencePaths) {
    test(`RCV00D historical snapshot ${snapshot.sha} rejects mixed ${parent}.${field}`, () => {
      const receipt = loadHistoricalSnapshot(snapshot);
      const other = loadHistoricalSnapshot(historicalSnapshots[1 - index]);
      assert.notEqual(receipt[parent][field], other[parent][field]);
      receipt[parent][field] = other[parent][field];
      assert.throws(() => validateRcv00dSelectorReceipt(receipt), /E_RCV00D_HISTORICAL_RECEIPT_BINDING/);
    });
  }
}

{
  const api = await import('../../scripts/ops/r24/corrective/rcv00d-graph-derived-selector.mjs');
  const { spawnSync } = await import('node:child_process');
  const { default: fs } = await import('node:fs');
  const { sha256hex: hash } = await import('../../scripts/ops/r24/canonical-json.mjs');
  const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
  const head = git('rev-parse', 'HEAD');
  const context = api.buildRcv00dSelectorContext({ now: '2026-09-12T08:43:37.000Z' });
  const nativeStore = api.loadCurrentCorrectiveClosureStore();
  const acceptedDigest = '029adc338ef8b51510eadd82b4405c5dc9ae23e11fc392891c956b2a3322e5ce';
  const acceptedBytes = nativeStore.readClosureReceipt(acceptedDigest);
  assert.equal(hash(acceptedBytes), acceptedDigest);
  const accepted = JSON.parse(acceptedBytes);
  const realGit = {
    tree: sha => git('rev-parse', `${sha}^{tree}`),
    isAncestor(left, right) {
      const result = spawnSync('git', ['merge-base', '--is-ancestor', left, right]);
      assert([0, 1].includes(result.status));
      return result.status === 0;
    },
  };
const makeRef = receipt => ({
  kind: receipt.observationId ? 'CURRENT_OBSERVATION' : 'FINDING',
  id: receipt.observationId || receipt.findingId,
  contourId: receipt.contourId,
  sourceCommit: receipt.head,
  mergeSha: receipt.merged,
  mergeTree: receipt.tree,
});
const acceptedRef = { ...makeRef(accepted), receiptDigest: acceptedDigest };
const readAccepted = digest => {
  assert.equal(digest, acceptedDigest, 'UNTRUSTED_RECEIPT_DIGEST');
  return acceptedBytes;
};
const options = overrides => ({ context, closureReferences: [acceptedRef], readClosureReceipt: readAccepted, gitEvidence: realGit, ...overrides });
const derive = overrides => api.deriveCurrentCorrectiveSelection(options(overrides));
const expectReject = (overrides, pattern) => assert.throws(() => derive(overrides), pattern);

// Synthetic catalogs are only boundary-test fixtures, never repository closure.
function syntheticCatalog(receipts) {
  const catalog = new Map();
  const refs = receipts.map(receipt => {
    const bytes = Buffer.from(JSON.stringify(receipt));
    const digest = hash(bytes);
    catalog.set(digest, bytes);
    return { ...makeRef(receipt), receiptDigest: digest };
  });
  return { closureReferences: refs, readClosureReceipt: digest => {
    assert(catalog.has(digest));
    return catalog.get(digest);
  } };
}

test('RCV00D current closure: real accepted closure removes the closed observation and ranks OPS-03 without admission', () => {
  const result = derive();
  assert(result.selected, 'GENERIC_NEXT_ITEM_MUST_EXIST_BEFORE_PLAN_ADMISSION');
  assert.equal(result.selected.id, 'OPS-03');
  assert.equal(result.selected.contourId, 'R24-RCV-00G');
  assert.equal(result.verdict, 'CORRECTIVE_CANDIDATE_RANKED_NOT_ADMITTED');
  assert.equal(result.candidates.find(row => row.id === acceptedRef.id).eligible, false);
  assert.equal(result.verifiedClosures[0].receiptDigest, acceptedDigest);
});

test('RCV00D current closure: same current inputs have deterministic closure and candidate projections', () => {
  assert.deepEqual(derive(), derive());
});

test('RCV00D current closure: without verified closure the original observation stays active', () => {
  assert.equal(derive({ closureReferences: [] }).selected.id, acceptedRef.id);
});

test('RCV00D current closure: bare CLOSED label cannot acquire closure authority', () => {
  expectReject({ closureReferences: [{ status: 'CLOSED', id: acceptedRef.id }] }, /E_CURRENT_CLOSURE_REFERENCE_SHAPE/);
});

test('RCV00D current closure: forged digest is rejected even if a resolver returns other valid bytes', () => {
  expectReject({ closureReferences: [{ ...acceptedRef, receiptDigest: 'f'.repeat(64) }], readClosureReceipt: () => acceptedBytes }, /E_CURRENT_CLOSURE_DIGEST/);
});

test('RCV00D current closure: wrong observation is rejected', () => {
  expectReject({ closureReferences: [{ ...acceptedRef, id: 'NOT_THE_CLOSED_OBSERVATION' }] }, /E_CURRENT_CLOSURE_SUBJECT_UNKNOWN/);
});

test('RCV00D current closure: wrong contour is rejected', () => {
  expectReject({ closureReferences: [{ ...acceptedRef, contourId: 'R24-RCV-00G' }] }, /E_CURRENT_CLOSURE_SUBJECT_UNKNOWN/);
});

test('RCV00D current closure: a known finding cannot reuse the observation closure receipt', () => {
  expectReject({ closureReferences: [{ ...acceptedRef, kind: 'FINDING', id: 'OPS-03', contourId: 'R24-RCV-00G' }] }, /E_CURRENT_CLOSURE_SUBJECT_BINDING/);
});

test('RCV00D current closure: different source commit cannot reuse the same terminal closure', () => {
  expectReject({ closureReferences: [{ ...acceptedRef, sourceCommit: accepted.base }] }, /E_CURRENT_CLOSURE_DELIVERY_BINDING/);
});

test('RCV00D current closure: stale or different merge SHA cannot reuse the current receipt', () => {
  expectReject({ closureReferences: [{ ...acceptedRef, mergeSha: accepted.base }] }, /E_CURRENT_CLOSURE_DELIVERY_BINDING/);
});

test('RCV00D current closure: different merge tree cannot reuse the current receipt', () => {
  expectReject({ closureReferences: [{ ...acceptedRef, mergeTree: realGit.tree(accepted.base) }] }, /E_CURRENT_CLOSURE_DELIVERY_BINDING/);
});

test('RCV00D current closure: actual Git merge tree is checked independently of receipt equality', () => {
  expectReject({ gitEvidence: { ...realGit, tree: () => 'a'.repeat(40) } }, /E_CURRENT_CLOSURE_MERGE_TREE/);
});

test('RCV00D current closure: source not ancestor of merge is rejected after coherent receipt binding', () => {
  const receipt = structuredClone(accepted);
  receipt.merged = accepted.base;
  receipt.tree = realGit.tree(accepted.base);
  receipt.pr.mergeCommit.oid = accepted.base;
  expectReject(syntheticCatalog([receipt]), /E_CURRENT_CLOSURE_SOURCE_NOT_ANCESTOR/);
});

test('RCV00D current closure: merge outside evaluated head ancestry is rejected', () => {
  expectReject({ gitEvidence: { ...realGit, isAncestor: (left, right) => left === acceptedRef.sourceCommit && right === acceptedRef.mergeSha } }, /E_CURRENT_CLOSURE_MERGE_NOT_ANCESTOR/);
});

test('RCV00D current closure: duplicate closure is rejected', () => {
  expectReject({ closureReferences: [acceptedRef, acceptedRef] }, /E_CURRENT_CLOSURE_DUPLICATE_OR_CONFLICT/);
});

test('RCV00D current closure: conflicting closure for the same subject is rejected', () => {
  expectReject({ closureReferences: [acceptedRef, { ...acceptedRef, mergeSha: accepted.base }] }, /E_CURRENT_CLOSURE_DUPLICATE_OR_CONFLICT/);
});

test('RCV00D current closure: synthetic valid finding closure is applied as well as observation closure', () => {
  const findingReceipt = structuredClone(accepted);
  delete findingReceipt.observationId;
  findingReceipt.findingId = 'OPS-03';
  findingReceipt.contourId = 'R24-RCV-00G';
  const result = derive(syntheticCatalog([accepted, findingReceipt]));
  assert.equal(result.candidates.find(row => row.id === 'OPS-03').eligible, false);
  assert(result.selected, 'GENERIC_DEBT_CANDIDATE_MUST_EXIST_BEFORE_PLAN_ADMISSION');
  assert.equal(result.selected.id, 'DATA-09');
});

test('RCV00D current closure: verified E leaves typed NO_ELIGIBLE while F lacks closure', () => {
  const result = api.buildCurrentCorrectivePlanOutcome(options());
  assert.equal(result.graphSchedulerSelectedId, null);
  assert.equal(result.rankedCandidateId, 'OPS-03');
  assert.equal(result.verdict, 'NO_ELIGIBLE');
  assert.equal(result.selected, null);
  assert.equal(result.reason, 'PLAN_PREDECESSOR_CLOSURE_UNRESOLVED');
  assert.deepEqual(result.unresolvedPredecessors, ['R24-RCV-00F']);
  assert.equal(result.mutationAllowed, false);
});

test('RCV00D current closure: resealed noncommitted plan or narrative text cannot change next selection', () => {
  const changed = structuredClone(context);
  changed.planText = changed.planText.replace('NEXT_STEP: R24-RCV-00A', 'NEXT_STEP: R24-RCV-00G');
  changed.inputDigests.planTextFile = hash(Buffer.from(changed.planText));
  assert.throws(() => api.buildCurrentCorrectivePlanOutcome(options({ context: changed })), /E_CURRENT_SELECTION_PLAN_DIGEST/);
});

test('RCV00D current closure: graph ready-set cannot be bypassed by the corrective prototype', () => {
  const changed = structuredClone(context);
  changed.graphSelectionReceipt.readySet = ['PK1_RELEASE_SECURITY_PHYSICAL'];
  expectReject({ context: changed }, /E_CURRENT_SELECTION_REQUIRES_NO_READY_GRAPH_NODE/);
});

test('RCV00D current closure: historical V1 receipt still validates and identity mutation still rejects', () => {
  const receipt = JSON.parse(fs.readFileSync('docs/OPS/R24/EVIDENCE/ES-R24-RCV00D-GRAPH-DERIVED-SELECTOR-RECEIPT.json'));
  assert.equal(api.validateRcv00dSelectorReceipt(receipt).status, 'PASS');
  receipt.identity.headSha = head;
  assert.throws(() => api.validateRcv00dSelectorReceipt(receipt), /E_RCV00D_RECEIPT_IDENTITY_BINDING/);
});

test('RCV00D current closure: current V1 compatibility remains unchanged and separate from new current outcome', () => {
  const receipt = api.buildRcv00dSelectorReceipt({ now: '2026-09-12T08:43:37.000Z' });
  assert.equal(api.validateRcv00dSelectorReceipt(receipt, context).status, 'PASS');
  assert.equal(receipt.selected.id, acceptedRef.id);
  const current = derive();
  assert(current.selected, 'CURRENT_GENERIC_SELECTION_MUST_NOT_BE_PINNED');
  assert.equal(current.selected.id, 'OPS-03');
});

test('RCV00D current closure: native store never follows embedded evidence paths', () => {
  const originalRead = fs.readFileSync;
  const reads = [];
  fs.readFileSync = function (file, ...args) {
    reads.push(String(file));
    return originalRead.call(this, file, ...args);
  };
  let store;
  try { store = api.loadCurrentCorrectiveClosureStore(); } finally { fs.readFileSync = originalRead; }
  assert.equal(reads.length, 1);
  const hasCarrierSuffix = pathname => pathname.replaceAll('\\', '/').endsWith(api.CURRENT_CORRECTIVE_CLOSURES_PATH);
  assert(hasCarrierSuffix(reads[0]));
  assert(hasCarrierSuffix('C:\\repo\\' + api.CURRENT_CORRECTIVE_CLOSURES_PATH.replaceAll('/', '\\')));
  assert(!hasCarrierSuffix('C:\\repo\\untrusted.json'));
  assert.equal(hash(store.readClosureReceipt(acceptedDigest)), acceptedDigest);
  assert.throws(() => store.readClosureReceipt('f'.repeat(64)), /E_CURRENT_CLOSURE_UNTRUSTED_RECEIPT/);
});

test('RCV00D current closure: modified or oversized native carrier is rejected', async () => {
  const os = await import('node:os');
  const path = await import('node:path');
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'r24-current-closure-'));
  try {
    const destination = path.join(temporary, api.CURRENT_CORRECTIVE_CLOSURES_PATH);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    const carrier = fs.readFileSync(api.CURRENT_CORRECTIVE_CLOSURES_PATH, 'utf8');
    fs.writeFileSync(destination, carrier + ' ');
    assert.throws(() => api.loadCurrentCorrectiveClosureStore({ repoRoot: temporary }), /E_CURRENT_CLOSURE_CARRIER_DIGEST/);
    fs.writeFileSync(destination, 'x'.repeat(32769));
    assert.throws(() => api.loadCurrentCorrectiveClosureStore({ repoRoot: temporary }), /E_CURRENT_CLOSURE_CARRIER_BOUNDS/);
  } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
});

test('RCV00D current closure: default CLI selects the native current typed outcome', () => {
  const originalWrite = process.stdout.write;
  let output = '';
  let result;
  process.stdout.write = chunk => { output += String(chunk); return true; };
  try { result = api.main(['--json', '--now', '2026-09-12T08:43:37.000Z']); }
  finally { process.stdout.write = originalWrite; }
  assert.equal(JSON.parse(output).verdict, 'NO_ELIGIBLE');
  assert.equal(result.selected, null);
  assert.deepEqual(result.unresolvedPredecessors, ['R24-RCV-00F']);
  assert.equal(result.identity.headSha, head);
  assert.equal(result.programDone, false);
  assert.equal(result.mutationAllowed, false);
});

test('RCV00D current closure: historical CLI is explicit and closure-file injection is forbidden', () => {
  const originalWrite = process.stdout.write;
  let result;
  process.stdout.write = () => true;
  try { result = api.main(['--historical-v1', '--now', '2026-09-12T08:43:37.000Z']); }
  finally { process.stdout.write = originalWrite; }
  assert.equal(result.selectedId, acceptedRef.id);
  assert.throws(() => api.main(['--closure-file', 'untrusted.json']), /E_RCV00D_CLI_ARGUMENT/);
});

}

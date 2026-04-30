const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

async function loadKernel() {
  return import(pathToFileURL(path.join(process.cwd(), 'src', 'revisionBridge', 'reviewIrKernel.mjs')).href);
}

test('static MatchProof record is deterministic and hash-bound', async () => {
  const { createMatchProof, canonicalHash, MATCH_PROOF_STATUS } = await loadKernel();
  const input = {
    itemId: 'item-1',
    targetScope: { sceneId: 'scene-1' },
    candidateCount: 1,
    sourceViewState: {
      revisionToken: 'rev-1',
      viewMode: 'inline',
      normalizationPolicy: 'TEXT_V1',
    },
    selectors: [{ selectorKind: 'TEXT_QUOTE', selectorEvidence: { exact: 'same' } }],
    evidence: [{ exactText: 'same', prefix: 'before', suffix: 'after' }],
  };
  const first = createMatchProof(input);
  const second = createMatchProof(input);

  assert.deepEqual(first, second);
  assert.equal(first.proofKind, 'STATIC_MATCH_PROOF');
  assert.equal(first.matchStatus, MATCH_PROOF_STATUS.EXACT);
  assert.equal(first.proofHash, canonicalHash({
    proofKind: first.proofKind,
    itemId: first.itemId,
    targetScope: first.targetScope,
    selectorStack: first.selectorStack,
    evidenceRefs: first.evidenceRefs,
    candidateCount: first.candidateCount,
    matchStatus: first.matchStatus,
    reasonCodes: first.reasonCodes,
    sourceViewState: first.sourceViewState,
  }));
});

test('ambiguous static MatchProof records carry manual blocker reason only', async () => {
  const { createMatchProof, MATCH_PROOF_STATUS, REASON_CODES } = await loadKernel();
  const proof = createMatchProof({
    itemId: 'item-ambiguous',
    targetScope: { sceneId: 'scene-1' },
    candidateCount: 2,
    selectors: [{ selectorKind: 'TEXT_QUOTE', selectorEvidence: { exact: 'repeat' } }],
    evidence: [{ exactText: 'repeat' }],
  });

  assert.equal(proof.matchStatus, MATCH_PROOF_STATUS.AMBIGUOUS);
  assert.deepEqual(proof.reasonCodes, [REASON_CODES.MULTI_MATCH]);
});

test('no-match static MatchProof records carry low-confidence blocker reason', async () => {
  const { createMatchProof, MATCH_PROOF_STATUS, REASON_CODES } = await loadKernel();
  const proof = createMatchProof({
    itemId: 'item-missing',
    targetScope: { sceneId: 'scene-1' },
    candidateCount: 0,
    selectors: [{ selectorKind: 'TEXT_QUOTE', selectorEvidence: { exact: 'missing' } }],
    evidence: [{ exactText: 'missing' }],
  });

  assert.equal(proof.matchStatus, MATCH_PROOF_STATUS.NO_MATCH);
  assert.deepEqual(proof.reasonCodes, [REASON_CODES.LOW_SELECTOR_CONFIDENCE]);
});

test('ReviewOpIR propagates static MatchProof blocker reason codes', async () => {
  const {
    buildReviewPatchSet,
    createMatchProof,
    AUTOMATION_POLICY,
    REASON_CODES,
  } = await loadKernel();
  const matchProof = createMatchProof({
    itemId: 'item-ambiguous',
    targetScope: { sceneId: 'scene-1' },
    candidateCount: 2,
    selectors: [{ selectorKind: 'TEXT_QUOTE', selectorEvidence: { exact: 'repeat' } }],
    evidence: [{ exactText: 'repeat' }],
  });
  const patchSet = buildReviewPatchSet({
    projectId: 'project-1',
    artifactHash: 'artifact-a',
    contextHash: 'baseline-a',
    items: [{
      id: 'item-ambiguous',
      kind: 'TEXT_REPLACE',
      targetScope: { sceneId: 'scene-1' },
      selectors: [{ selectorKind: 'TEXT_QUOTE', selectorEvidence: { exact: 'repeat' } }],
      evidence: [{ exactText: 'repeat' }],
      matchProof,
    }],
  });

  assert.equal(patchSet.reviewOps[0].automationPolicy, AUTOMATION_POLICY.MANUAL_ONLY);
  assert.deepEqual(patchSet.reviewOps[0].reasonCodes, [REASON_CODES.MULTI_MATCH]);
  assert.equal(patchSet.reviewOps[0].matchProof.proofHash, matchProof.proofHash);
});

test('MatchProof rejects status that conflicts with candidate count', async () => {
  const { createMatchProof, MATCH_PROOF_STATUS } = await loadKernel();

  assert.throws(() => createMatchProof({
    itemId: 'item-conflict',
    candidateCount: 2,
    matchStatus: MATCH_PROOF_STATUS.EXACT,
    selectors: [{ selectorKind: 'TEXT_QUOTE', selectorEvidence: { exact: 'repeat' } }],
    evidence: [{ exactText: 'repeat' }],
  }), /candidate count/u);
});

test('MatchProof adds no adapter, parser, matcher, project search, or compiler wiring', () => {
  const moduleText = fs.readFileSync(
    path.join(process.cwd(), 'src', 'revisionBridge', 'reviewIrKernel.mjs'),
    'utf8',
  );
  const forbidden = [
    /parseMarkdown/u,
    /matcherEngine/u,
    /projectTextSearch/u,
    /applyCompiler/u,
    /from\s+['"]node:fs['"]/u,
    /from\s+['"]electron['"]/u,
    /\bfetch\s*\(/u,
  ];

  for (const pattern of forbidden) {
    assert.equal(pattern.test(moduleText), false, `forbidden scope pattern: ${pattern.source}`);
  }
});

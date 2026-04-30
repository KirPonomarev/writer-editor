const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

async function loadKernel() {
  return import(pathToFileURL(path.join(process.cwd(), 'src', 'revisionBridge', 'reviewIrKernel.mjs')).href);
}

function buildFreshInput() {
  return {
    projectId: 'project-1',
    artifactHash: 'artifact-a',
    contextHash: 'baseline-a',
    sourceViewState: {
      revisionToken: 'rev-1',
      viewMode: 'inline',
    },
    items: [
      {
        id: 'item-1',
        kind: 'TEXT_REPLACE',
        targetScope: { sceneId: 'scene-1' },
        selectors: [
          {
            selectorKind: 'TEXT_QUOTE',
            selectorEvidence: { exact: 'old text' },
          },
        ],
        evidence: [{ exactText: 'old text', quotedSegment: 'old text' }],
      },
    ],
  };
}

test('stale baseline compiles zero apply ops with explicit reason', async () => {
  const { buildReviewPatchSet, previewApplyBlockers, REASON_CODES } = await loadKernel();
  const patchSet = buildReviewPatchSet(buildFreshInput());
  const preview = previewApplyBlockers(patchSet, {
    projectId: 'project-1',
    currentBaselineHash: 'baseline-b',
  });

  assert.deepEqual(preview.applyOps, []);
  assert.deepEqual(preview.blockedReasons, [REASON_CODES.STALE_BASELINE]);
});

test('wrong project and missing binding compile zero apply ops', async () => {
  const { buildReviewPatchSet, previewApplyBlockers, REASON_CODES } = await loadKernel();
  const wrongProjectPatchSet = buildReviewPatchSet(buildFreshInput());
  const missingProjectPatchSet = buildReviewPatchSet({
    ...buildFreshInput(),
    projectId: '',
  });

  assert.deepEqual(
    previewApplyBlockers(wrongProjectPatchSet, {
      projectId: 'other-project',
      currentBaselineHash: 'baseline-a',
    }),
    {
      applyOps: [],
      blockedReasons: [REASON_CODES.WRONG_PROJECT],
    },
  );
  assert.deepEqual(
    previewApplyBlockers(missingProjectPatchSet, {
      projectId: 'project-1',
      currentBaselineHash: 'baseline-a',
    }),
    {
      applyOps: [],
      blockedReasons: [REASON_CODES.MISSING_PROJECT_BINDING],
    },
  );
});

test('ambiguous selectors remain blocked without apply compiler output', async () => {
  const { buildReviewPatchSet, previewApplyBlockers, REASON_CODES, AUTOMATION_POLICY } = await loadKernel();
  const patchSet = buildReviewPatchSet({
    ...buildFreshInput(),
    items: [
      {
        id: 'item-ambiguous',
        kind: 'TEXT_REPLACE',
        ambiguous: true,
        targetScope: { sceneId: 'scene-1' },
        selectors: [{ selectorKind: 'TEXT_QUOTE', selectorEvidence: { exact: 'same' } }],
        evidence: [{ exactText: 'same' }],
      },
    ],
  });

  assert.equal(patchSet.reviewOps[0].automationPolicy, AUTOMATION_POLICY.MANUAL_ONLY);
  assert.deepEqual(patchSet.reviewOps[0].reasonCodes, [REASON_CODES.MULTI_MATCH]);
  assert.deepEqual(
    previewApplyBlockers(patchSet, {
      projectId: 'project-1',
      currentBaselineHash: 'baseline-a',
    }),
    {
      applyOps: [],
      blockedReasons: [REASON_CODES.MULTI_MATCH],
    },
  );
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const MODULE_BASENAME = 'reviewIrKernel.mjs';

async function loadKernel() {
  return import(pathToFileURL(path.join(process.cwd(), 'src', 'revisionBridge', MODULE_BASENAME)).href);
}

function syntheticSurface() {
  return {
    projectId: 'project-1',
    artifactHash: 'artifact-a',
    contextHash: 'baseline-a',
    sourceViewState: {
      revisionToken: 'rev-1',
      viewMode: 'inline',
      normalizationPolicy: 'TEXT_V1',
      newlinePolicy: 'LF',
      unicodePolicy: 'NFC',
      artifactCompletenessClass: 'TEXT_ONLY',
    },
    items: [
      {
        id: 'supported-1',
        kind: 'TEXT_REPLACE',
        targetScope: { sceneId: 'scene-1' },
        selectors: [
          {
            selectorKind: 'TEXT_QUOTE',
            selectorEvidence: { exact: 'old text', prefix: 'before', suffix: 'after' },
          },
        ],
        evidence: [{ exactText: 'old text', prefix: 'before', suffix: 'after' }],
      },
      {
        id: 'unsupported-1',
        supported: false,
        kind: 'TABLE',
        surfaceKind: 'TABLE',
        reasonCodes: ['UNSUPPORTED_SURFACE'],
        evidence: [{ exactText: '| a | b |', sourcePart: 'synthetic-markdown' }],
      },
    ],
  };
}

test('review IR kernel module stays pure and in-memory only', () => {
  const moduleText = fs.readFileSync(
    path.join(process.cwd(), 'src', 'revisionBridge', MODULE_BASENAME),
    'utf8',
  );
  const forbidden = [
    /from\s+['"]node:fs['"]/u,
    /from\s+['"]node:child_process['"]/u,
    /from\s+['"]node:http['"]/u,
    /from\s+['"]node:https['"]/u,
    /from\s+['"]node:net['"]/u,
    /from\s+['"]electron['"]/u,
    /\bfetch\s*\(/u,
    /\bDate\.now\s*\(/u,
    /\bMath\.random\s*\(/u,
  ];

  for (const pattern of forbidden) {
    assert.equal(pattern.test(moduleText), false, `forbidden pure pattern: ${pattern.source}`);
  }
});

test('synthetic parsed surface normalizes into deterministic ReviewPatchSet', async () => {
  const { buildReviewPatchSet, canonicalHash, AUTOMATION_POLICY } = await loadKernel();
  const first = buildReviewPatchSet(syntheticSurface());
  const second = buildReviewPatchSet(syntheticSurface());

  assert.deepEqual(first, second);
  assert.equal(first.patchSetId, second.patchSetId);
  assert.equal(first.reviewOps.length, 1);
  assert.equal(first.unsupportedObservations.length, 1);
  assert.equal(first.reviewOps[0].automationPolicy, AUTOMATION_POLICY.AUTO_ELIGIBLE);
  assert.equal(first.reviewOps[0].canonicalHash, canonicalHash({
    opId: first.reviewOps[0].opId,
    opKind: first.reviewOps[0].opKind,
    targetScope: first.reviewOps[0].targetScope,
    selectorStack: first.reviewOps[0].selectorStack,
    evidenceRefs: first.reviewOps[0].evidenceRefs,
    riskClass: first.reviewOps[0].riskClass,
    automationPolicy: first.reviewOps[0].automationPolicy,
    preconditions: first.reviewOps[0].preconditions,
    reasonCodes: first.reviewOps[0].reasonCodes,
  }));
});

test('patchset identity is bound to artifact hash and context hash', async () => {
  const { buildReviewPatchSet } = await loadKernel();
  const base = buildReviewPatchSet(syntheticSurface());
  const differentArtifact = buildReviewPatchSet({
    ...syntheticSurface(),
    artifactHash: 'artifact-b',
  });
  const differentContext = buildReviewPatchSet({
    ...syntheticSurface(),
    contextHash: 'baseline-b',
  });

  assert.notEqual(base.patchSetId, differentArtifact.patchSetId);
  assert.notEqual(base.patchSetId, differentContext.patchSetId);
});

test('unsupported surfaces become observations and ReviewBOM counts', async () => {
  const { buildReviewPatchSet, REASON_CODES } = await loadKernel();
  const patchSet = buildReviewPatchSet(syntheticSurface());

  assert.equal(patchSet.unsupportedObservations.length, 1);
  assert.equal(patchSet.unsupportedObservations[0].reasonCodes.includes(REASON_CODES.UNSUPPORTED_SURFACE), true);
  assert.equal(patchSet.reviewBom.supportedSurfaceCount, 1);
  assert.equal(patchSet.reviewBom.unsupportedSurfaceCount, 1);
  assert.equal(patchSet.reviewBom.reasonCodeCounts[REASON_CODES.UNSUPPORTED_SURFACE], 1);
  assert.equal(patchSet.reviewBom.evidenceRefCount, 2);
});

test('weak selector lanes are manual only, not auto eligible', async () => {
  const { buildReviewPatchSet, REASON_CODES, AUTOMATION_POLICY } = await loadKernel();
  const cases = [
    ['TEXT_POSITION', REASON_CODES.TEXT_POSITION_ONLY],
    ['HEADING', REASON_CODES.HEADING_ONLY],
    ['ORDINAL', REASON_CODES.ORDINAL_ONLY],
  ];

  for (const [selectorKind, reasonCode] of cases) {
    const patchSet = buildReviewPatchSet({
      ...syntheticSurface(),
      items: [
        {
          id: `weak-${selectorKind}`,
          kind: 'TEXT_REPLACE',
          targetScope: { sceneId: 'scene-1' },
          selectors: [{ selectorKind, selectorEvidence: { value: 'weak' } }],
          evidence: [{ exactText: 'weak' }],
        },
      ],
    });

    assert.equal(patchSet.reviewOps[0].automationPolicy, AUTOMATION_POLICY.MANUAL_ONLY);
    assert.deepEqual(patchSet.reviewOps[0].reasonCodes, [reasonCode]);
  }
});

test('structural risk is manual only in minimal kernel', async () => {
  const { buildReviewPatchSet, REASON_CODES, RISK_CLASS, AUTOMATION_POLICY } = await loadKernel();
  const patchSet = buildReviewPatchSet({
    ...syntheticSurface(),
    items: [
      {
        id: 'move-1',
        kind: 'MOVE',
        targetScope: { sceneId: 'scene-1' },
        selectors: [{ selectorKind: 'TEXT_QUOTE', selectorEvidence: { exact: 'moved' } }],
        evidence: [{ exactText: 'moved' }],
      },
    ],
  });

  assert.equal(patchSet.reviewOps[0].automationPolicy, AUTOMATION_POLICY.MANUAL_ONLY);
  assert.equal(patchSet.reviewOps[0].riskClass, RISK_CLASS.HIGH);
  assert.deepEqual(patchSet.reviewOps[0].reasonCodes, [REASON_CODES.STRUCTURAL_RISK]);
});

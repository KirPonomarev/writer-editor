const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const MODULE_BASENAME = 'reviewIrKernel.mjs';

async function loadKernel() {
  return import(pathToFileURL(path.join(process.cwd(), 'src', 'revisionBridge', MODULE_BASENAME)).href);
}

function exactTextDecision(overrides = {}) {
  const item = {
    id: 'decision-1',
    kind: 'TEXT_REPLACE',
    targetScope: { sceneId: 'scene-1', blockId: 'block-1' },
    blockVersionHash: 'block-v1',
    selectors: [
      {
        selectorKind: 'TEXT_QUOTE',
        selectorEvidence: { exact: 'old text', prefix: 'before', suffix: 'after' },
      },
    ],
    evidence: [{ exactText: 'old text', prefix: 'before', suffix: 'after' }],
    expectedText: 'old text',
    replacementText: 'new text',
    ...(overrides.item || {}),
  };
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
    items: [item],
    ...overrides.surface,
  };
}

function acceptedEnvironment(overrides = {}) {
  return {
    projectId: 'project-1',
    currentBaselineHash: 'baseline-a',
    sessionOpen: true,
    sceneId: 'scene-1',
    currentBlockVersions: { 'block-1': 'block-v1' },
    currentTextByBlock: { 'block-1': 'old text' },
    ...overrides,
  };
}

async function acceptedApplyResult(overrides = {}) {
  const { buildReviewPatchSet, compileExactTextApplyOps } = await loadKernel();
  return compileExactTextApplyOps(
    buildReviewPatchSet(exactTextDecision(overrides.decision || {})),
    acceptedEnvironment(overrides.environment || {}),
  );
}

test('accepted contract ApplyOp produces one deterministic effect preview', async () => {
  const { compileExactTextApplyEffectPreviews, canonicalHash } = await loadKernel();
  const applyResult = await acceptedApplyResult();
  const first = compileExactTextApplyEffectPreviews(applyResult);
  const second = compileExactTextApplyEffectPreviews(applyResult);

  assert.equal(first.contractOnly, true);
  assert.equal(first.runtimeWritable, false);
  assert.deepEqual(first.blockedReasons, []);
  assert.equal(first.planKind, 'EXACT_TEXT_APPLY_EFFECT_PREVIEW_PLAN');
  assert.equal(first.planId.startsWith('effect_plan_'), true);
  assert.equal(first.canonicalHash, canonicalHash({
    planId: first.planId,
    planKind: first.planKind,
    contractOnly: first.contractOnly,
    runtimeWritable: first.runtimeWritable,
    effectPreviews: first.effectPreviews,
    blockedReasons: first.blockedReasons,
  }));
  assert.deepEqual(first, second);
  assert.equal(first.effectPreviews.length, 1);

  const applyOp = applyResult.applyOps[0];
  const preview = first.effectPreviews[0];
  assert.deepEqual(Object.keys(preview).sort(), [
    'afterHashPreview',
    'baselineHash',
    'beforeHash',
    'blockVersionHash',
    'canonicalHash',
    'effectPreviewId',
    'effectPreviewKind',
    'exactTextAfter',
    'exactTextBefore',
    'inversePatchPreview',
    'projectId',
    'runtimeWritable',
    'sceneId',
    'sourceApplyOpHash',
    'sourceApplyOpId',
  ].sort());
  assert.equal(preview.effectPreviewKind, 'EXACT_TEXT_REPLACE_EFFECT_PREVIEW');
  assert.equal(preview.sourceApplyOpId, applyOp.opId);
  assert.equal(preview.sourceApplyOpHash, applyOp.canonicalHash);
  assert.equal(preview.projectId, 'project-1');
  assert.equal(preview.sceneId, 'scene-1');
  assert.equal(preview.baselineHash, 'baseline-a');
  assert.equal(preview.blockVersionHash, 'block-v1');
  assert.equal(preview.exactTextBefore, 'old text');
  assert.equal(preview.exactTextAfter, 'new text');
  assert.equal(preview.beforeHash, canonicalHash({
    effectPreviewTextKind: 'EXACT_TEXT_BEFORE',
    text: 'old text',
  }));
  assert.equal(preview.afterHashPreview, canonicalHash({
    effectPreviewTextKind: 'EXACT_TEXT_AFTER_PREVIEW',
    text: 'new text',
  }));
  assert.deepEqual(preview.inversePatchPreview, {
    expectedText: 'new text',
    replacementText: 'old text',
  });
  assert.equal(preview.runtimeWritable, false);
  assert.equal(preview.canonicalHash, canonicalHash({
    effectPreviewId: preview.effectPreviewId,
    effectPreviewKind: preview.effectPreviewKind,
    sourceApplyOpId: preview.sourceApplyOpId,
    sourceApplyOpHash: preview.sourceApplyOpHash,
    projectId: preview.projectId,
    sceneId: preview.sceneId,
    baselineHash: preview.baselineHash,
    blockVersionHash: preview.blockVersionHash,
    exactTextBefore: preview.exactTextBefore,
    exactTextAfter: preview.exactTextAfter,
    beforeHash: preview.beforeHash,
    afterHashPreview: preview.afterHashPreview,
    inversePatchPreview: preview.inversePatchPreview,
    runtimeWritable: preview.runtimeWritable,
  }));
});

test('effect preview hash changes when source ApplyOp hash text baseline or block version changes', async () => {
  const { compileExactTextApplyEffectPreviews } = await loadKernel();
  const base = compileExactTextApplyEffectPreviews(await acceptedApplyResult()).effectPreviews[0];
  const changedText = compileExactTextApplyEffectPreviews(await acceptedApplyResult({
    decision: { item: { replacementText: 'changed text' } },
  })).effectPreviews[0];
  const changedBaseline = compileExactTextApplyEffectPreviews(await acceptedApplyResult({
    decision: { surface: { contextHash: 'baseline-b' } },
    environment: { currentBaselineHash: 'baseline-b' },
  })).effectPreviews[0];
  const changedBlockVersion = compileExactTextApplyEffectPreviews(await acceptedApplyResult({
    decision: { item: { blockVersionHash: 'block-v2' } },
    environment: { currentBlockVersions: { 'block-1': 'block-v2' } },
  })).effectPreviews[0];
  const changedSourceHash = compileExactTextApplyEffectPreviews({
    ...(await acceptedApplyResult()),
    applyOps: [
      {
        ...(await acceptedApplyResult()).applyOps[0],
        canonicalHash: 'manual-source-hash-change',
      },
    ],
  }).effectPreviews[0];

  assert.notEqual(base.canonicalHash, changedText.canonicalHash);
  assert.notEqual(base.canonicalHash, changedBaseline.canonicalHash);
  assert.notEqual(base.canonicalHash, changedBlockVersion.canonicalHash);
  assert.notEqual(base.canonicalHash, changedSourceHash.canonicalHash);
});

test('blocked or empty applyOps produce zero effect previews', async () => {
  const { buildReviewPatchSet, compileExactTextApplyOps, compileExactTextApplyEffectPreviews, REASON_CODES } = await loadKernel();
  const blockedApplyResult = compileExactTextApplyOps(
    buildReviewPatchSet(exactTextDecision()),
    acceptedEnvironment({ currentBaselineHash: 'baseline-b' }),
  );
  const blocked = compileExactTextApplyEffectPreviews(blockedApplyResult);
  const empty = compileExactTextApplyEffectPreviews({
    contractOnly: true,
    runtimeWritable: false,
    applyOps: [],
    blockedReasons: [],
  });

  assert.deepEqual(blocked.effectPreviews, []);
  assert.equal(blocked.blockedReasons.includes(REASON_CODES.STALE_BASELINE), true);
  assert.deepEqual(empty.effectPreviews, []);
  assert.deepEqual(empty.blockedReasons, []);
});

test('runtimeWritable true contractOnly false or missing precondition input blocks previews', async () => {
  const { compileExactTextApplyEffectPreviews, REASON_CODES } = await loadKernel();
  const applyResult = await acceptedApplyResult();
  const applyOp = applyResult.applyOps[0];
  const cases = [
    [
      REASON_CODES.RUNTIME_WRITE_FORBIDDEN_IN_CONTOUR,
      {
      ...applyResult,
      runtimeWritable: true,
      },
    ],
    [
      REASON_CODES.NON_CONTRACT_APPLYOP_FORBIDDEN,
      {
      ...applyResult,
      contractOnly: false,
      },
    ],
    [
      REASON_CODES.RUNTIME_WRITE_FORBIDDEN_IN_CONTOUR,
      {
      ...applyResult,
      applyOps: [{ ...applyOp, runtimeWritable: true }],
      },
    ],
    [
      REASON_CODES.NON_CONTRACT_APPLYOP_FORBIDDEN,
      {
      ...applyResult,
      applyOps: [{ ...applyOp, contractOnly: false }],
      },
    ],
    [
      REASON_CODES.EFFECT_PRECONDITION_MISSING,
      {
      ...applyResult,
      applyOps: [{ ...applyOp, tests: { ...applyOp.tests, baselineHashEquals: '' } }],
      },
    ],
  ];

  for (const [reasonCode, input] of cases) {
    const previewResult = compileExactTextApplyEffectPreviews(input);
    assert.deepEqual(previewResult.effectPreviews, []);
    assert.equal(previewResult.runtimeWritable, false);
    assert.equal(previewResult.blockedReasons.includes(reasonCode), true, reasonCode);
  }
});

test('effect preview implementation has no runtime write, storage, electron, network, command, or public surface imports', () => {
  const moduleText = fs.readFileSync(
    path.join(process.cwd(), 'src', 'revisionBridge', MODULE_BASENAME),
    'utf8',
  );
  const forbidden = [
    /from\s+['"]node:fs(?:\/promises)?['"]/u,
    /from\s+['"]node:child_process['"]/u,
    /from\s+['"]node:http['"]/u,
    /from\s+['"]node:https['"]/u,
    /from\s+['"]node:net['"]/u,
    /from\s+['"]node:dns['"]/u,
    /from\s+['"]electron['"]/u,
    /from\s+['"][^'"]*(?:storage|main|preload|editor|command-catalog|projectCommands)[^'"]*['"]/u,
    /\bfetch\s*\(/u,
    /\bXMLHttpRequest\b/u,
    /\bwriteFile(?:Atomic)?\b/u,
    /\bmkdir\b/u,
    /\bApplyReceipt\b/u,
    /\breceiptWritable\b/u,
    /\bApplyTxn\b/u,
    /\bipc(?:Main|Renderer)\b/u,
  ];

  for (const pattern of forbidden) {
    assert.equal(pattern.test(moduleText), false, `forbidden effect preview pattern: ${pattern.source}`);
  }
});

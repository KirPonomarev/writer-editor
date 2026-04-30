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

test('exact accepted low risk text decision compiles to one contract only ApplyOp', async () => {
  const { buildReviewPatchSet, compileExactTextApplyOps, canonicalHash } = await loadKernel();
  const patchSet = buildReviewPatchSet(exactTextDecision());
  const result = compileExactTextApplyOps(patchSet, acceptedEnvironment());

  assert.equal(result.contractOnly, true);
  assert.equal(result.runtimeWritable, false);
  assert.deepEqual(result.blockedReasons, []);
  assert.equal(result.applyOps.length, 1);
  assert.equal(result.applyOps[0].contractOnly, true);
  assert.equal(result.applyOps[0].runtimeWritable, false);
  assert.deepEqual(Object.keys(result.applyOps[0]).sort(), [
    'automationPolicy',
    'canonicalHash',
    'contractOnly',
    'evidenceRefs',
    'opId',
    'opKind',
    'patch',
    'reasonCodes',
    'riskClass',
    'runtimeWritable',
    'sourceReviewOpHash',
    'sourceReviewOpId',
    'target',
    'tests',
  ].sort());
  assert.equal(result.applyOps[0].opKind, 'EXACT_TEXT_REPLACE');
  assert.deepEqual(result.applyOps[0].target, { sceneId: 'scene-1', blockId: 'block-1' });
  assert.deepEqual(result.applyOps[0].patch, {
    expectedText: 'old text',
    replacementText: 'new text',
  });
  assert.deepEqual(result.applyOps[0].tests, {
    projectIdEquals: 'project-1',
    sceneIdEquals: 'scene-1',
    baselineHashEquals: 'baseline-a',
    blockVersionHashEquals: 'block-v1',
    exactTextEquals: 'old text',
    sessionStatusOpen: true,
    selectorStatusExact: true,
  });
  assert.deepEqual(result.applyOps[0].reasonCodes, []);
  assert.equal(result.applyOps[0].canonicalHash, canonicalHash({
    opId: result.applyOps[0].opId,
    opKind: result.applyOps[0].opKind,
    target: result.applyOps[0].target,
    tests: result.applyOps[0].tests,
    patch: result.applyOps[0].patch,
    riskClass: result.applyOps[0].riskClass,
    automationPolicy: result.applyOps[0].automationPolicy,
    evidenceRefs: result.applyOps[0].evidenceRefs,
    runtimeWritable: result.applyOps[0].runtimeWritable,
    reasonCodes: result.applyOps[0].reasonCodes,
    contractOnly: result.applyOps[0].contractOnly,
    sourceReviewOpId: result.applyOps[0].sourceReviewOpId,
    sourceReviewOpHash: result.applyOps[0].sourceReviewOpHash,
  }));
});

test('blocked exact text decisions compile zero ApplyOps with required reason codes', async () => {
  const { buildReviewPatchSet, compileExactTextApplyOps, REASON_CODES } = await loadKernel();
  const cases = [
    [
      REASON_CODES.STALE_BASELINE,
      exactTextDecision(),
      acceptedEnvironment({ currentBaselineHash: 'baseline-b' }),
    ],
    [
      REASON_CODES.WRONG_PROJECT,
      exactTextDecision(),
      acceptedEnvironment({ projectId: 'project-2' }),
    ],
    [
      REASON_CODES.CLOSED_SESSION,
      exactTextDecision(),
      acceptedEnvironment({ sessionOpen: false }),
    ],
    [
      REASON_CODES.SCENE_MISMATCH,
      exactTextDecision(),
      acceptedEnvironment({ sceneId: 'scene-2' }),
    ],
    [
      REASON_CODES.BLOCK_VERSION_MISMATCH,
      exactTextDecision(),
      acceptedEnvironment({ currentBlockVersions: { 'block-1': 'block-v2' } }),
    ],
    [
      REASON_CODES.MULTI_MATCH,
      exactTextDecision({ item: { ambiguous: true } }),
      acceptedEnvironment(),
    ],
    [
      REASON_CODES.LOW_SELECTOR_CONFIDENCE,
      exactTextDecision({ item: { selectors: [] } }),
      acceptedEnvironment(),
    ],
    [
      REASON_CODES.EXACT_TEXT_MISMATCH,
      exactTextDecision(),
      acceptedEnvironment({ currentTextByBlock: { 'block-1': 'different text' } }),
    ],
    [
      REASON_CODES.UNSUPPORTED_SURFACE,
      exactTextDecision({
        surface: {
          items: [
            {
              id: 'unsupported-table',
              supported: false,
              kind: 'TABLE',
              surfaceKind: 'TABLE',
              reasonCodes: [REASON_CODES.UNSUPPORTED_SURFACE],
              evidence: [{ exactText: '| a | b |' }],
            },
          ],
        },
      }),
      acceptedEnvironment(),
    ],
    [
      REASON_CODES.STRUCTURAL_MANUAL_ONLY,
      exactTextDecision({ item: { kind: 'MOVE' } }),
      acceptedEnvironment(),
    ],
    [
      REASON_CODES.COMMENT_APPLY_OUT_OF_SCOPE,
      exactTextDecision({ item: { kind: 'COMMENT' } }),
      acceptedEnvironment(),
    ],
    [
      REASON_CODES.MISSING_PRECONDITION,
      exactTextDecision(),
      acceptedEnvironment({ currentTextByBlock: {} }),
    ],
    [
      REASON_CODES.UNSUPPORTED_OP_KIND,
      exactTextDecision({ item: { kind: 'STYLE_CHANGE' } }),
      acceptedEnvironment(),
    ],
  ];

  for (const [reasonCode, surface, environment] of cases) {
    const result = compileExactTextApplyOps(buildReviewPatchSet(surface), environment);

    assert.deepEqual(result.applyOps, [], reasonCode);
    assert.equal(result.runtimeWritable, false, reasonCode);
    assert.equal(result.blockedReasons.includes(reasonCode), true, reasonCode);
  }
});

test('contract ApplyOp hash is deterministic and changes with required fields', async () => {
  const { buildReviewPatchSet, compileExactTextApplyOps } = await loadKernel();
  const first = compileExactTextApplyOps(
    buildReviewPatchSet(exactTextDecision()),
    acceptedEnvironment(),
  ).applyOps[0];
  const second = compileExactTextApplyOps(
    buildReviewPatchSet(exactTextDecision()),
    acceptedEnvironment(),
  ).applyOps[0];
  const changedReplacement = compileExactTextApplyOps(
    buildReviewPatchSet(exactTextDecision({ item: { replacementText: 'changed text' } })),
    acceptedEnvironment(),
  ).applyOps[0];
  const changedBlockVersion = compileExactTextApplyOps(
    buildReviewPatchSet(exactTextDecision({ item: { blockVersionHash: 'block-v2' } })),
    acceptedEnvironment({
      currentBlockVersions: { 'block-1': 'block-v2' },
    }),
  ).applyOps[0];

  assert.deepEqual(first, second);
  assert.notEqual(first.canonicalHash, changedReplacement.canonicalHash);
  assert.notEqual(first.canonicalHash, changedBlockVersion.canonicalHash);
});

test('exact text apply foundation has no runtime write, storage, electron, network, command, or public surface imports', () => {
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
    /\bApplyTxn\b/u,
    /\bipc(?:Main|Renderer)\b/u,
  ];

  for (const pattern of forbidden) {
    assert.equal(pattern.test(moduleText), false, `forbidden apply foundation pattern: ${pattern.source}`);
  }
});

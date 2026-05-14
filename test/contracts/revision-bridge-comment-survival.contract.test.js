const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const MODULE_PATH = 'src/io/revisionBridge/index.mjs';
const TEST_PATH = 'test/contracts/revision-bridge-comment-survival.contract.test.js';
const P0_TEST_PATH = 'test/contracts/revision-bridge-p0-safety-kernel.contract.test.js';
const RB10_TEST_PATH = 'test/contracts/revision-bridge-inline-range-anchor-contract.contract.test.js';
const RB11_TEST_PATH = 'test/contracts/revision-bridge-anchor-confidence-engine-contract.contract.test.js';
const RB19_TEST_PATH = 'test/contracts/revision-bridge-exact-text-apply-plan-no-disk.contract.test.js';
const C04_TEST_PATH = 'test/contracts/revision-bridge-exact-text-min-safe-write.contract.test.js';
const C06_TEST_PATH = 'test/contracts/revision-bridge-minimal-block-id.contract.test.js';
const ALLOWLIST = [MODULE_PATH, TEST_PATH, P0_TEST_PATH, RB10_TEST_PATH, RB11_TEST_PATH, RB19_TEST_PATH, C04_TEST_PATH, C06_TEST_PATH];

async function loadBridge() {
  return import(pathToFileURL(path.join(process.cwd(), MODULE_PATH)).href);
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function validThread(overrides = {}) {
  return {
    schemaVersion: 'revision-bridge.comment-thread.v1',
    threadId: 'thread-1',
    authorId: 'author-1',
    status: 'open',
    createdAt: '2026-05-14T00:00:00.000Z',
    updatedAt: '',
    tags: [],
    messages: [
      {
        messageId: 'message-1',
        authorId: 'author-1',
        body: 'Keep this comment text.',
        createdAt: '2026-05-14T00:00:00.000Z',
      },
    ],
    ...overrides,
  };
}

function validInlineRange(overrides = {}) {
  return {
    schemaVersion: 'revision-bridge.inline-range.v1',
    kind: 'span',
    blockId: 'block-1',
    lineageId: 'lineage-1',
    from: 0,
    to: 5,
    quote: 'Alpha',
    prefix: '',
    suffix: '',
    confidence: 'exact',
    riskClass: 'low',
    automationPolicy: 'manualOnly',
    deletedTarget: false,
    reasonCodes: [],
    ...overrides,
  };
}

function validPlacement(overrides = {}) {
  return {
    schemaVersion: 'revision-bridge.comment-anchor-placement.v1',
    placementId: 'placement-1',
    threadId: 'thread-1',
    targetScope: { type: 'scene', id: 'scene-1' },
    inlineRange: validInlineRange(),
    resolvedState: 'open',
    acceptedState: 'pending',
    diagnosticsOnly: false,
    ...overrides,
  };
}

function validContext(text = 'Alpha beta gamma.') {
  return {
    blockMap: {
      'block-1': {
        lineageId: 'lineage-1',
        text,
      },
    },
  };
}

function buildInput(overrides = {}) {
  return {
    commentThreads: [validThread()],
    commentAnchorPlacements: [validPlacement()],
    context: validContext(),
    ...overrides,
  };
}

function collectKeys(value) {
  const keys = [];
  const seen = new Set();
  function visit(candidate) {
    if (!candidate || typeof candidate !== 'object' || seen.has(candidate)) return;
    seen.add(candidate);
    for (const [key, nested] of Object.entries(candidate)) {
      keys.push(key);
      visit(nested);
    }
  }
  visit(value);
  return keys;
}

function changedFilesFromGitStatus(statusText) {
  return statusText
    .split('\n')
    .filter((line) => line !== '')
    .map((line) => line.slice(3).replace(/^"|"$/gu, ''));
}

function assertPreviewShape(result) {
  assert.deepEqual(Object.keys(result), [
    'schemaVersion',
    'type',
    'status',
    'code',
    'reason',
    'canAutoApply',
    'autoApplyCount',
    'autoApplyCandidates',
    'totalThreads',
    'totalPlacements',
    'preservedThreads',
    'placementResults',
    'diagnostics',
    'diagnosticSummary',
  ]);
}

function assertZeroAutoApply(result) {
  assert.equal(result.canAutoApply, false);
  assert.equal(result.autoApplyCount, 0);
  assert.deepEqual(result.autoApplyCandidates, []);
  for (const placementResult of result.placementResults) {
    assert.equal(placementResult.canAutoApply, false);
  }
}

function assertPreservedBody(result, body = 'Keep this comment text.') {
  assert.equal(result.totalThreads, 1);
  assert.equal(result.preservedThreads[0].messages[0].body, body);
}

test('CONTOUR-05 exports comment survival preview schema function and reason catalog', async () => {
  const bridge = await loadBridge();

  assert.equal(
    bridge.REVISION_BRIDGE_COMMENT_SURVIVAL_PREVIEW_SCHEMA,
    'revision-bridge.comment-survival-preview.v1',
  );
  assert.equal(typeof bridge.buildCommentSurvivalPreview, 'function');
  assert.equal(Object.isFrozen(bridge.REVISION_BRIDGE_COMMENT_SURVIVAL_PREVIEW_REASON_CODES), true);
  assert.deepEqual(bridge.REVISION_BRIDGE_COMMENT_SURVIVAL_PREVIEW_REASON_CODES, [
    'REVISION_BRIDGE_COMMENT_SURVIVAL_PREVIEW_READY',
    'E_REVISION_BRIDGE_COMMENT_SURVIVAL_PREVIEW_DIAGNOSTICS',
    'REVISION_BRIDGE_COMMENT_SURVIVAL_THREAD_INVALID',
    'REVISION_BRIDGE_COMMENT_SURVIVAL_THREAD_ID_MISSING',
    'REVISION_BRIDGE_COMMENT_SURVIVAL_THREAD_ID_DUPLICATE',
    'REVISION_BRIDGE_COMMENT_SURVIVAL_THREAD_TEXT_EMPTY',
    'REVISION_BRIDGE_COMMENT_SURVIVAL_PLACEMENT_THREAD_MISSING',
    'REVISION_BRIDGE_COMMENT_SURVIVAL_PLACEMENT_NOT_EVALUATED',
    'REVISION_BRIDGE_COMMENT_SURVIVAL_LEGACY_PLACEMENT_UNSUPPORTED',
  ]);
});

test('CONTOUR-05 orphan preserves thread text and never creates auto apply', async () => {
  const bridge = await loadBridge();
  const result = bridge.buildCommentSurvivalPreview(buildInput({
    commentAnchorPlacements: [
      validPlacement({
        inlineRange: validInlineRange({
          kind: 'orphan',
          blockId: '',
          lineageId: '',
          from: 0,
          to: 0,
          quote: '',
          confidence: 'unresolved',
          automationPolicy: 'diagnosticsOnly',
        }),
      }),
    ],
  }));

  assertPreviewShape(result);
  assertPreservedBody(result);
  assertZeroAutoApply(result);
  assert.equal(result.placementResults[0].status, 'unplaced');
  assert.equal(
    result.placementResults[0].evaluation.reasonCodes.includes('REVISION_BRIDGE_ANCHOR_CONFIDENCE_ORPHAN'),
    true,
  );
});

test('CONTOUR-05 deleted anchor preserves thread text', async () => {
  const bridge = await loadBridge();
  const result = bridge.buildCommentSurvivalPreview(buildInput({
    commentAnchorPlacements: [
      validPlacement({
        inlineRange: validInlineRange({
          kind: 'deleted',
          from: 5,
          to: 5,
          quote: '',
          deletedTarget: true,
        }),
      }),
    ],
  }));

  assertPreservedBody(result);
  assertZeroAutoApply(result);
  assert.equal(
    result.placementResults[0].evaluation.reasonCodes.includes('REVISION_BRIDGE_ANCHOR_CONFIDENCE_DELETED_TARGET'),
    true,
  );
});

test('CONTOUR-05 ambiguous placement preserves thread text and zero auto apply', async () => {
  const bridge = await loadBridge();
  const result = bridge.buildCommentSurvivalPreview(buildInput({
    commentAnchorPlacements: [
      validPlacement({
        inlineRange: validInlineRange({
          from: 6,
          to: 10,
          quote: 'Alpha',
        }),
      }),
    ],
    context: validContext('Alpha beta Alpha.'),
  }));

  assertPreservedBody(result);
  assertZeroAutoApply(result);
  assert.equal(result.placementResults[0].status, 'unplaced');
  assert.equal(
    result.placementResults[0].evaluation.reasonCodes.includes('REVISION_BRIDGE_ANCHOR_CONFIDENCE_QUOTE_ELSEWHERE'),
    true,
  );
});

test('CONTOUR-05 duplicate thread id is diagnostic without silent merge', async () => {
  const bridge = await loadBridge();
  const result = bridge.buildCommentSurvivalPreview(buildInput({
    commentThreads: [
      validThread({
        threadId: 'same-id',
        messages: [{ messageId: 'message-1', body: 'First body.' }],
      }),
      validThread({
        threadId: 'same-id',
        messages: [{ messageId: 'message-2', body: 'Second body.' }],
      }),
    ],
    commentAnchorPlacements: [],
  }));

  assert.equal(result.totalThreads, 2);
  assert.deepEqual(result.preservedThreads.map((thread) => thread.messages[0].body), ['First body.', 'Second body.']);
  assert.equal(
    result.diagnostics.some((diagnostic) => diagnostic.code === 'REVISION_BRIDGE_COMMENT_SURVIVAL_THREAD_ID_DUPLICATE'),
    true,
  );
  assertZeroAutoApply(result);
});

test('CONTOUR-05 duplicate comment content is allowed across different ids', async () => {
  const bridge = await loadBridge();
  const result = bridge.buildCommentSurvivalPreview(buildInput({
    commentThreads: [
      validThread({
        threadId: 'thread-1',
        messages: [{ messageId: 'message-1', body: 'Same body.' }],
      }),
      validThread({
        threadId: 'thread-2',
        messages: [{ messageId: 'message-2', body: 'Same body.' }],
      }),
    ],
    commentAnchorPlacements: [],
  }));

  assert.equal(result.totalThreads, 2);
  assert.deepEqual(result.preservedThreads.map((thread) => thread.messages[0].body), ['Same body.', 'Same body.']);
  assert.equal(
    result.diagnostics.some((diagnostic) => diagnostic.code === 'REVISION_BRIDGE_COMMENT_SURVIVAL_THREAD_ID_DUPLICATE'),
    false,
  );
  assert.equal(
    result.diagnostics.some((diagnostic) => diagnostic.message.includes('content')),
    false,
  );
});

test('CONTOUR-05 empty raw comment text yields invalid diagnostic and zero auto apply', async () => {
  const bridge = await loadBridge();
  const result = bridge.buildCommentSurvivalPreview(buildInput({
    commentThreads: [
      validThread({
        messages: [{ messageId: 'message-empty', body: '   ' }],
      }),
    ],
    commentAnchorPlacements: [],
  }));

  assertPreservedBody(result, '   ');
  assertZeroAutoApply(result);
  assert.equal(result.status, 'diagnostics');
  assert.equal(
    result.diagnostics.some((diagnostic) => diagnostic.code === 'REVISION_BRIDGE_COMMENT_SURVIVAL_THREAD_TEXT_EMPTY'),
    true,
  );
});

test('CONTOUR-05 placement failure never drops preserved thread', async () => {
  const bridge = await loadBridge();
  const result = bridge.buildCommentSurvivalPreview(buildInput({
    commentAnchorPlacements: [
      validPlacement({
        inlineRange: validInlineRange({
          to: 999,
        }),
      }),
    ],
  }));

  assertPreservedBody(result);
  assert.equal(result.placementResults[0].status, 'unplaced');
  assert.equal(result.totalThreads, 1);
  assertZeroAutoApply(result);
});

test('CONTOUR-05 hardFail placement preserves thread text', async () => {
  const bridge = await loadBridge();
  const result = bridge.buildCommentSurvivalPreview(buildInput({
    commentAnchorPlacements: [
      {
        schemaVersion: 'revision-bridge.comment-anchor-placement.v1',
        placementId: '',
        threadId: 'thread-1',
        targetScope: { type: 'scene', id: 'scene-1' },
        inlineRange: validInlineRange({ to: 999 }),
      },
    ],
  }));

  assertPreservedBody(result);
  assert.equal(result.placementResults[0].status, 'unplaced');
  assert.equal(result.placementResults[0].evaluation.status, 'hardFail');
  assertZeroAutoApply(result);
});

test('CONTOUR-05 non-object placement preserves thread text and fails placement only', async () => {
  const bridge = await loadBridge();
  const result = bridge.buildCommentSurvivalPreview(buildInput({
    commentAnchorPlacements: [null],
  }));

  assertPreservedBody(result);
  assert.equal(result.placementResults[0].status, 'unplaced');
  assert.equal(result.placementResults[0].evaluation.status, 'hardFail');
  assertZeroAutoApply(result);
});

test('CONTOUR-05 missing referenced thread is diagnostic and does not fabricate thread', async () => {
  const bridge = await loadBridge();
  const result = bridge.buildCommentSurvivalPreview(buildInput({
    commentAnchorPlacements: [
      validPlacement({ threadId: 'missing-thread' }),
    ],
  }));

  assertPreservedBody(result);
  assert.deepEqual(result.placementResults[0].threadIndexes, []);
  assert.equal(
    result.diagnostics.some((diagnostic) => diagnostic.code === 'REVISION_BRIDGE_COMMENT_SURVIVAL_PLACEMENT_THREAD_MISSING'),
    true,
  );
  assertZeroAutoApply(result);
});

test('CONTOUR-05 no placements still preserves valid thread without diagnostics', async () => {
  const bridge = await loadBridge();
  const result = bridge.buildCommentSurvivalPreview(buildInput({
    commentAnchorPlacements: [],
  }));

  assertPreservedBody(result);
  assert.equal(result.totalPlacements, 0);
  assert.equal(result.status, 'ready');
  assert.deepEqual(result.diagnostics, []);
  assertZeroAutoApply(result);
});

test('CONTOUR-05 legacy commentPlacement input is diagnosed and not adapted silently', async () => {
  const bridge = await loadBridge();
  const result = bridge.buildCommentSurvivalPreview({
    commentThreads: [validThread()],
    commentPlacements: [
      {
        schemaVersion: 'revision-bridge.comment-placement.v1',
        placementId: 'legacy-placement-1',
        threadId: 'thread-1',
        targetScope: { type: 'scene', id: 'scene-1' },
        anchor: { kind: 'quote', value: 'Alpha' },
        range: { from: 0, to: 5 },
        quote: 'Alpha',
      },
    ],
    context: validContext(),
  });

  assertPreservedBody(result);
  assert.equal(result.totalPlacements, 0);
  assert.equal(
    result.diagnostics.some((diagnostic) => diagnostic.code === 'REVISION_BRIDGE_COMMENT_SURVIVAL_LEGACY_PLACEMENT_UNSUPPORTED'),
    true,
  );
  assertZeroAutoApply(result);
});

test('CONTOUR-05 exact autoEligible input remains non-auto-applicable in survival output', async () => {
  const bridge = await loadBridge();
  const result = bridge.buildCommentSurvivalPreview(buildInput({
    commentAnchorPlacements: [
      validPlacement({
        inlineRange: validInlineRange({ automationPolicy: 'autoEligible' }),
      }),
    ],
  }));

  assertPreservedBody(result);
  assertZeroAutoApply(result);
  assert.equal(result.placementResults[0].status, 'placed');
});

test('CONTOUR-05 placement does not duplicate comment text', async () => {
  const bridge = await loadBridge();
  const result = bridge.buildCommentSurvivalPreview(buildInput({
    commentAnchorPlacements: [
      validPlacement({
        commentText: 'Keep this comment text.',
        body: 'Keep this comment text.',
        messages: [{ body: 'Keep this comment text.' }],
      }),
    ],
  }));
  const placementResultText = JSON.stringify(result.placementResults);

  assert.equal(placementResultText.includes('Keep this comment text.'), false);
  assert.equal(
    result.placementResults[0].evaluation.diagnostics.some((diagnostic) => (
      diagnostic.code === 'REVISION_BRIDGE_PLACEMENT_EVALUATION_VALIDATION_FAILED'
    )),
    true,
  );
  assertPreservedBody(result);
});

test('CONTOUR-05 preserved thread does not store anchor as truth', async () => {
  const bridge = await loadBridge();
  const result = bridge.buildCommentSurvivalPreview(buildInput({
    commentThreads: [
      validThread({
        anchor: { kind: 'span', value: 'not truth' },
        range: { from: 0, to: 5 },
        inlineRange: validInlineRange(),
        placement: validPlacement(),
      }),
    ],
  }));
  const threadKeys = collectKeys(result.preservedThreads[0]);

  for (const forbiddenKey of ['anchor', 'range', 'inlineRange', 'placement']) {
    assert.equal(threadKeys.includes(forbiddenKey), false);
  }
  assertPreservedBody(result);
});

test('CONTOUR-05 result is deterministic and does not mutate input', async () => {
  const bridge = await loadBridge();
  const input = buildInput({
    commentAnchorPlacements: [
      validPlacement({
        inlineRange: validInlineRange({
          from: 6,
          to: 10,
          quote: 'Alpha',
        }),
      }),
    ],
    context: validContext('Alpha beta Alpha.'),
  });
  const before = deepClone(input);
  const first = bridge.buildCommentSurvivalPreview(input);
  const second = bridge.buildCommentSurvivalPreview(input);

  assert.deepEqual(input, before);
  assert.deepEqual(first, second);
});

test('CONTOUR-05 source section has no forbidden surface tokens', () => {
  const source = fs.readFileSync(path.join(process.cwd(), MODULE_PATH), 'utf8');
  const start = source.indexOf('// RB_18_COMMENT_SURVIVAL_PREVIEW_CONTRACTS_START');
  const end = source.indexOf('// RB_18_COMMENT_SURVIVAL_PREVIEW_CONTRACTS_END');
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const section = source.slice(start, end).toLowerCase();
  const forbiddenTokens = [
    'ui',
    'ipc',
    'runtime',
    'docx',
    'package',
    'history',
    'collab',
    'fetch',
    'electron',
    'parser',
    'storage',
    'command',
  ];

  for (const token of forbiddenTokens) {
    assert.equal(new RegExp(`\\b${token}\\b`, 'u').test(section), false, `${token} must not appear in CONTOUR-05 section`);
  }
});

test('CONTOUR-05 allowlist guard and dependency manifests are untouched', () => {
  const statusText = execFileSync('git', ['status', '--short'], { encoding: 'utf8' });
  const changedFiles = changedFilesFromGitStatus(statusText);
  const outsideAllowlist = changedFiles.filter((filePath) => !ALLOWLIST.includes(filePath));
  const packageManifestDiff = changedFiles.filter((filePath) => (
    filePath === 'package.json'
    || filePath === 'package-lock.json'
    || filePath === 'npm-shrinkwrap.json'
  ));

  assert.deepEqual(outsideAllowlist, []);
  assert.deepEqual(packageManifestDiff, []);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const MODULE_PATH = 'src/io/revisionBridge/index.mjs';
const TEST_PATH = 'test/contracts/revision-bridge-stage01-minimal-bundle-contract.contract.test.js';
const BASE_SHA = 'e9a35b45af1efa8bdded7eb679b0ecf27b9b53ba';
const ALLOWLIST = [TEST_PATH];

async function loadBridge() {
  return import(pathToFileURL(path.join(process.cwd(), MODULE_PATH)).href);
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function changedFilesFromGitStatus(statusText) {
  return statusText
    .split('\n')
    .filter((line) => line !== '')
    .map((line) => line.slice(3).replace(/^"|"$/gu, ''));
}

function changedFilesOutsideAllowlist(changedFiles) {
  const allowedPaths = new Set(ALLOWLIST);
  return changedFiles.filter((filePath) => !allowedPaths.has(filePath));
}

function findForbiddenKeys(value, forbiddenKeys, pathSegments = []) {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => findForbiddenKeys(item, forbiddenKeys, pathSegments.concat(String(index))));
  }
  if (!value || typeof value !== 'object') return [];

  return Object.keys(value).flatMap((key) => {
    const keyPath = pathSegments.concat(key);
    const nested = findForbiddenKeys(value[key], forbiddenKeys, keyPath);
    return forbiddenKeys.includes(key) ? [keyPath.join('.'), ...nested] : nested;
  });
}

function validThread(body = 'Tighten this sentence.') {
  return {
    threadId: 'thread-1',
    authorId: 'editor-1',
    status: 'open',
    createdAt: '2026-04-24T08:00:00.000Z',
    updatedAt: '2026-04-24T08:30:00.000Z',
    tags: ['clarity'],
    messages: [
      {
        messageId: 'message-1',
        authorId: 'editor-1',
        body,
        createdAt: '2026-04-24T08:00:00.000Z',
      },
    ],
  };
}

function validPlacement({
  placementId = 'placement-1',
  quote = 'original sentence',
  prefix = 'before',
  suffix = 'after',
} = {}) {
  return {
    placementId,
    threadId: 'thread-1',
    targetScope: {
      type: 'scene',
      id: 'scene-1',
    },
    anchor: {
      kind: 'text',
      value: 'anchor-1',
    },
    range: {
      from: 10,
      to: 24,
    },
    quote,
    prefix,
    suffix,
    confidence: 1,
    policy: 'exact',
    selector: {
      type: 'text-position',
      start: 10,
      end: 24,
    },
    createdAt: '2026-04-24T08:01:00.000Z',
  };
}

function validTextChange({
  changeId = 'text-change-1',
  quote = 'replacement source',
  prefix = 'left',
  suffix = 'right',
} = {}) {
  return {
    changeId,
    targetScope: {
      type: 'scene',
      id: 'scene-1',
    },
    match: {
      kind: 'exact',
      quote,
      prefix,
      suffix,
    },
    replacementText: 'revised sentence',
    createdAt: '2026-04-24T08:02:00.000Z',
  };
}

function validStructuralChange() {
  return {
    structuralChangeId: 'structural-change-1',
    kind: 'split-scene',
    targetScope: {
      type: 'scene',
      id: 'scene-1',
    },
    summary: 'Consider splitting the scene.',
    createdAt: '2026-04-24T08:03:00.000Z',
  };
}

function validDiagnosticItem() {
  return {
    diagnosticId: 'diagnostic-1',
    severity: 'warning',
    message: 'Manual review required.',
    targetScope: {
      type: 'scene',
      id: 'scene-1',
    },
    relatedItemId: 'structural-change-1',
    createdAt: '2026-04-24T08:04:00.000Z',
  };
}

function validDecisionState() {
  return {
    decisionId: 'decision-1',
    itemKind: 'textChange',
    itemId: 'text-change-1',
    status: 'accepted',
    decidedAt: '2026-04-24T08:05:00.000Z',
    reason: 'Editor approved manually.',
  };
}

function validReviewPacket({
  commentThreads = [validThread()],
  commentPlacements = [validPlacement()],
  textChanges = [validTextChange()],
  structuralChanges = [validStructuralChange()],
  diagnosticItems = [validDiagnosticItem()],
  decisionStates = [validDecisionState()],
} = {}) {
  return {
    commentThreads,
    commentPlacements,
    textChanges,
    structuralChanges,
    diagnosticItems,
    decisionStates,
  };
}

function validParsedSurface() {
  return {
    ...validReviewPacket(),
    unsupportedItems: [
      {
        unsupportedId: 'unsupported-1',
        severity: 'warning',
        message: 'Unsupported floating comment.',
        targetScope: {
          type: 'scene',
          id: 'scene-1',
        },
        relatedItemId: 'comment-9',
        createdAt: '2026-04-24T08:09:00.000Z',
      },
    ],
  };
}

function validPreviewInput(overrides = {}) {
  return {
    projectId: 'project-1',
    sessionId: 'session-1',
    baselineHash: 'baseline-hash-1',
    currentBaselineHash: 'baseline-hash-1',
    sourceViewState: {
      revisionToken: 'rev-1',
      viewMode: 'doc',
      normalizationPolicy: 'canon',
      newlinePolicy: 'lf',
      unicodePolicy: 'nfc',
      artifactCompletenessClass: 'minimal',
    },
    parsedSurface: validParsedSurface(),
    ...overrides,
  };
}

function reviewItemsById(preview) {
  return new Map(preview.reviewBom.items.map((item) => [item.itemId, item]));
}

function reviewPatchItemsById(preview) {
  return new Map(preview.reviewPatchset.items.map((item) => [item.itemId, item]));
}

function reviewOpsById(preview) {
  return new Map(preview.reviewOpIr.ops.map((item) => [item.itemId, item]));
}

test('RB-18 exports the Stage01 minimal bundle schema surfaces and builder', async () => {
  const bridge = await loadBridge();
  const expectedExports = [
    'REVISION_BRIDGE_REVIEWPATCHSET_SCHEMA',
    'REVISION_BRIDGE_REVIEWOPIR_SCHEMA',
    'REVISION_BRIDGE_SELECTORSTACK_SCHEMA_V1',
    'REVISION_BRIDGE_SOURCE_VIEW_STATE_SCHEMA',
    'REVISION_BRIDGE_EVIDENCEREF_SCHEMA',
    'REVISION_BRIDGE_PROV_MIN_SCHEMA',
    'REVISION_BRIDGE_MINIMAL_REVIEWBOM_SCHEMA',
    'REVISION_BRIDGE_SHADOW_PREVIEW_SCHEMA',
    'REVISION_BRIDGE_BLOCKED_APPLY_PLAN_SCHEMA',
    'REVISION_BRIDGE_STAGE01_FIXED_CORE_PREVIEW_SCHEMA',
    'buildStage01FixedCorePreview',
  ];

  for (const exportName of expectedExports) {
    assert.notEqual(bridge[exportName], undefined, `${exportName} must be exported`);
  }
  assert.equal(typeof bridge.buildStage01FixedCorePreview, 'function');
});

test('RB-18 builds a deterministic preview-only Stage01 bundle with explicit schema-bound surfaces', async () => {
  const bridge = await loadBridge();
  const input = validPreviewInput();
  const before = deepClone(input);

  const first = bridge.buildStage01FixedCorePreview(input);
  const second = bridge.buildStage01FixedCorePreview(deepClone(input));

  assert.deepEqual(first, second);
  assert.deepEqual(input, before);
  assert.equal(first.ok, true);
  assert.equal(first.type, 'revisionBridge.stage01FixedCorePreview');
  assert.equal(first.status, 'preview');
  assert.equal(first.code, 'REVISION_BRIDGE_STAGE01_FIXED_CORE_PREVIEW_READY');
  assert.equal(first.reason, 'REVISION_BRIDGE_STAGE01_FIXED_CORE_PREVIEW_READY');
  assert.deepEqual(first.reasons, []);

  const preview = first.preview;
  assert.deepEqual(Object.keys(preview).sort(), [
    'baselineHash',
    'blockedApplyPlan',
    'canonicalHash',
    'currentBaselineHash',
    'evidenceRefs',
    'projectId',
    'provMinEntries',
    'reviewBom',
    'reviewOpIr',
    'reviewPatchset',
    'schemaVersion',
    'selectorStack',
    'sessionId',
    'shadowPreview',
    'sourceViewState',
  ]);
  assert.equal(preview.schemaVersion, bridge.REVISION_BRIDGE_STAGE01_FIXED_CORE_PREVIEW_SCHEMA);
  assert.equal(preview.reviewPatchset.schemaVersion, bridge.REVISION_BRIDGE_REVIEWPATCHSET_SCHEMA);
  assert.equal(preview.reviewOpIr.schemaVersion, bridge.REVISION_BRIDGE_REVIEWOPIR_SCHEMA);
  assert.equal(preview.selectorStack.schemaVersion, bridge.REVISION_BRIDGE_SELECTORSTACK_SCHEMA_V1);
  assert.equal(preview.sourceViewState.schemaVersion, bridge.REVISION_BRIDGE_SOURCE_VIEW_STATE_SCHEMA);
  assert.equal(preview.reviewBom.schemaVersion, bridge.REVISION_BRIDGE_MINIMAL_REVIEWBOM_SCHEMA);
  assert.equal(preview.shadowPreview.schemaVersion, bridge.REVISION_BRIDGE_SHADOW_PREVIEW_SCHEMA);
  assert.equal(preview.blockedApplyPlan.schemaVersion, bridge.REVISION_BRIDGE_BLOCKED_APPLY_PLAN_SCHEMA);
  assert.equal(preview.sourceViewState.packetHash.length > 0, true);

  assert.equal(preview.blockedApplyPlan.status, 'blocked');
  assert.equal(preview.blockedApplyPlan.canApply, false);
  assert.deepEqual(preview.blockedApplyPlan.applyOps, []);
  assert.deepEqual(
    preview.blockedApplyPlan.reasons.map((reason) => reason.code),
    ['REVISION_BRIDGE_STAGE01_PREVIEW_ONLY'],
  );

  assert.equal(preview.evidenceRefs.length, 6);
  assert.equal(preview.provMinEntries.length, 6);
  assert.equal(preview.evidenceRefs.every((entry) => entry.schemaVersion === bridge.REVISION_BRIDGE_EVIDENCEREF_SCHEMA), true);
  assert.equal(preview.provMinEntries.every((entry) => entry.schemaVersion === bridge.REVISION_BRIDGE_PROV_MIN_SCHEMA), true);
  assert.equal(preview.reviewBom.items.length, 6);
  assert.equal(preview.reviewPatchset.items.length, 6);
  assert.equal(preview.reviewOpIr.ops.length, 6);
  assert.equal(preview.selectorStack.selectors.length, 6);
  assert.deepEqual(preview.reviewPatchset.unsupportedObservations, [
    {
      itemId: 'unsupported-1',
      itemKind: 'unsupportedObservation',
      reason: 'REVISION_BRIDGE_STAGE01_UNSUPPORTED_OBSERVATION',
      sourceKind: 'unsupportedItems',
    },
  ]);
  assert.deepEqual(
    preview.evidenceRefs,
    preview.reviewBom.items.map((item) => item.evidenceRef),
  );
  assert.deepEqual(
    preview.provMinEntries,
    preview.reviewBom.items.map((item) => item.provMin),
  );
  assert.deepEqual(
    preview.reviewPatchset.items.map((item) => item.itemId),
    preview.reviewBom.items.map((item) => item.itemId),
  );
  assert.deepEqual(
    preview.reviewOpIr.ops.map((item) => item.itemId),
    preview.reviewBom.items.map((item) => item.itemId),
  );
  assert.deepEqual(
    preview.selectorStack.selectors.map((item) => item.itemId),
    preview.reviewBom.items.map((item) => item.itemId),
  );
  assert.deepEqual(findForbiddenKeys(first, [
    'applyAuthorized',
    'applyDecision',
    'authorized',
    'authorization',
  ]), []);
  assert.deepEqual(findForbiddenKeys(preview.shadowPreview, [
    'apply',
    'canApply',
    'authorized',
    'applyPlan',
  ]), []);
});

test('RB-18 stale baselines stay blocked and never emit apply ops', async () => {
  const bridge = await loadBridge();
  const result = bridge.buildStage01FixedCorePreview({
    projectId: 'project-1',
    sessionId: 'session-1',
    baselineHash: 'baseline-a',
    currentBaselineHash: 'baseline-b',
    reviewPacket: validReviewPacket({
      structuralChanges: [],
      diagnosticItems: [],
      decisionStates: [],
      textChanges: [],
      commentPlacements: [],
    }),
  });

  assert.equal(result.ok, true);
  assert.equal(result.preview.blockedApplyPlan.canApply, false);
  assert.deepEqual(result.preview.blockedApplyPlan.applyOps, []);
  assert.deepEqual(
    result.preview.blockedApplyPlan.reasons.map((reason) => reason.code),
    ['REVISION_BRIDGE_STAGE01_PREVIEW_ONLY', 'REVISION_BRIDGE_STAGE01_STALE_BASELINE'],
  );
});

test('RB-18 duplicate exact text changes become manualOnly with duplicate reason', async () => {
  const bridge = await loadBridge();
  const result = bridge.buildStage01FixedCorePreview({
    projectId: 'project-1',
    sessionId: 'session-1',
    baselineHash: 'baseline-hash-1',
    reviewPacket: validReviewPacket({
      commentPlacements: [validPlacement({ placementId: 'placement-a', quote: 'same', prefix: 'before', suffix: 'after' })],
      textChanges: [validTextChange({ changeId: 'change-a', quote: 'same', prefix: 'before', suffix: 'after' })],
      structuralChanges: [],
      diagnosticItems: [],
      decisionStates: [],
    }),
  });

  const items = reviewItemsById(result.preview);
  assert.equal(items.get('placement-a').status, 'manualOnly');
  assert.equal(items.get('placement-a').reason, 'REVISION_BRIDGE_STAGE01_DUPLICATE_TEXT_MANUAL_ONLY');
  assert.equal(items.get('change-a').status, 'manualOnly');
  assert.equal(items.get('change-a').reason, 'REVISION_BRIDGE_STAGE01_DUPLICATE_TEXT_MANUAL_ONLY');
});

test('RB-18 empty exact text changes become manualOnly with ambiguous reason', async () => {
  const bridge = await loadBridge();
  const result = bridge.buildStage01FixedCorePreview({
    projectId: 'project-1',
    sessionId: 'session-1',
    baselineHash: 'baseline-hash-1',
    reviewPacket: validReviewPacket({
      commentPlacements: [validPlacement({ placementId: 'placement-empty', quote: '' })],
      textChanges: [validTextChange({ changeId: 'change-empty', quote: '' })],
      structuralChanges: [],
      diagnosticItems: [],
      decisionStates: [],
    }),
  });

  const items = reviewItemsById(result.preview);
  assert.equal(items.get('placement-empty').status, 'manualOnly');
  assert.equal(items.get('placement-empty').reason, 'REVISION_BRIDGE_STAGE01_AMBIGUOUS_TEXT_MANUAL_ONLY');
  assert.equal(items.get('change-empty').status, 'manualOnly');
  assert.equal(items.get('change-empty').reason, 'REVISION_BRIDGE_STAGE01_AMBIGUOUS_TEXT_MANUAL_ONLY');
});

test('RB-18 structural changes become manualOnly with structural reason', async () => {
  const bridge = await loadBridge();
  const result = bridge.buildStage01FixedCorePreview({
    projectId: 'project-1',
    sessionId: 'session-1',
    baselineHash: 'baseline-hash-1',
    reviewPacket: validReviewPacket({
      commentPlacements: [],
      textChanges: [],
      structuralChanges: [validStructuralChange()],
      diagnosticItems: [],
      decisionStates: [],
    }),
  });

  const items = reviewItemsById(result.preview);
  assert.equal(items.get('structural-change-1').status, 'manualOnly');
  assert.equal(items.get('structural-change-1').reason, 'REVISION_BRIDGE_STAGE01_STRUCTURAL_MANUAL_ONLY');
});

test('RB-18 accounts for every input entity across Stage01 bundle surfaces', async () => {
  const bridge = await loadBridge();
  const result = bridge.buildStage01FixedCorePreview(validPreviewInput());
  const preview = result.preview;

  const expectedReviewIds = [
    'thread-1',
    'placement-1',
    'text-change-1',
    'structural-change-1',
    'diagnostic-1',
    'decision-1',
  ];
  const reviewBomIds = preview.reviewBom.items.map((item) => item.itemId);
  const reviewPatchIds = preview.reviewPatchset.items.map((item) => item.itemId);
  const reviewOpIds = preview.reviewOpIr.ops.map((item) => item.itemId);
  const selectorIds = preview.selectorStack.selectors.map((item) => item.itemId);

  assert.deepEqual(reviewBomIds, expectedReviewIds);
  assert.deepEqual(reviewPatchIds, expectedReviewIds);
  assert.deepEqual(reviewOpIds, expectedReviewIds);
  assert.deepEqual(selectorIds, expectedReviewIds);
  assert.deepEqual(preview.reviewPatchset.unsupportedObservations.map((item) => item.itemId), ['unsupported-1']);

  const patchItems = reviewPatchItemsById(preview);
  const opItems = reviewOpsById(preview);
  for (const reviewId of expectedReviewIds) {
    assert.equal(patchItems.has(reviewId), true);
    assert.equal(opItems.has(reviewId), true);
  }
});

test('RB-18 changed files stay inside the exact task allowlist', () => {
  const changedFiles = changedFilesFromGitStatus(
    execFileSync('git', ['status', '--porcelain', '-uall'], { encoding: 'utf8' }),
  );

  assert.deepEqual(changedFilesOutsideAllowlist(changedFiles), []);
});

test('RB-18 historical byte lock remains provenance only after later contours', () => {
  const currentText = fs.readFileSync(MODULE_PATH, 'utf8');
  const baseText = execFileSync('git', ['show', `${BASE_SHA}:${MODULE_PATH}`], { encoding: 'utf8' });

  assert.equal(baseText.includes('buildStage01FixedCorePreview'), true);
  assert.equal(currentText.includes('buildStage01FixedCorePreview'), true);
  assert.equal(currentText.includes('REVISION_BRIDGE_STAGE01_FIXED_CORE_PREVIEW_SCHEMA'), true);
  assert.equal(currentText.includes('buildExactTextApplyPlanNoDiskPreview'), true);
});

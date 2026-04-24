const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const MODULE_PATH = 'src/io/revisionBridge/index.mjs';
const P0_TEST_PATH = 'test/contracts/revision-bridge-p0-safety-kernel.contract.test.js';
const RB02_TEST_PATH = 'test/contracts/revision-bridge-reviewgraph-contract.contract.test.js';
const TEST_PATH = 'test/contracts/revision-bridge-review-packet-preview-contract.contract.test.js';
const ALLOWLIST = [MODULE_PATH, P0_TEST_PATH, RB02_TEST_PATH, TEST_PATH];

async function loadBridge() {
  return import(pathToFileURL(path.join(process.cwd(), MODULE_PATH)).href);
}

function validThread() {
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
        body: 'Tighten this sentence.',
        createdAt: '2026-04-24T08:00:00.000Z',
      },
    ],
  };
}

function validPlacement() {
  return {
    placementId: 'placement-1',
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
    quote: 'original sentence',
    prefix: 'before',
    suffix: 'after',
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

function validTextChange() {
  return {
    changeId: 'text-change-1',
    targetScope: {
      type: 'scene',
      id: 'scene-1',
    },
    match: {
      kind: 'exact',
      quote: 'original sentence',
      prefix: 'before',
      suffix: 'after',
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

function validReviewPacket() {
  return {
    commentThreads: [validThread()],
    commentPlacements: [validPlacement()],
    textChanges: [validTextChange()],
    structuralChanges: [validStructuralChange()],
    diagnosticItems: [validDiagnosticItem()],
    decisionStates: [validDecisionState()],
  };
}

function validPreviewInput() {
  return {
    projectId: 'project-1',
    sessionId: 'session-1',
    baselineHash: 'baseline-hash-1',
    createdAt: '2026-04-24T08:00:00.000Z',
    updatedAt: '2026-04-24T08:05:00.000Z',
    reviewPacket: validReviewPacket(),
  };
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

test('RB-03 exports review packet preview schema and builder', async () => {
  const bridge = await loadBridge();

  assert.equal(
    bridge.REVISION_BRIDGE_REVIEW_PACKET_PREVIEW_SCHEMA,
    'revision-bridge.review-packet-preview.v1',
  );
  assert.equal(typeof bridge.buildRevisionPacketPreview, 'function');
});

test('RB-03 builds a normalized cloned RevisionSession preview from parsed review packet data', async () => {
  const bridge = await loadBridge();
  const input = validPreviewInput();

  const result = bridge.buildRevisionPacketPreview(input);

  assert.equal(result.ok, true);
  assert.equal(result.type, 'revisionBridge.reviewPacketPreview');
  assert.equal(result.status, 'preview');
  assert.equal(result.code, 'REVISION_BRIDGE_REVIEW_PACKET_PREVIEW_READY');
  assert.equal(result.reason, 'REVISION_BRIDGE_REVIEW_PACKET_PREVIEW_READY');
  assert.deepEqual(result.reasons, []);
  assert.equal(result.session.schemaVersion, bridge.REVISION_BRIDGE_REVISION_SESSION_SCHEMA);
  assert.equal(result.session.projectId, 'project-1');
  assert.equal(result.session.sessionId, 'session-1');
  assert.equal(result.session.baselineHash, 'baseline-hash-1');
  assert.equal(result.session.reviewGraph.textChanges[0].schemaVersion, bridge.REVISION_BRIDGE_TEXT_CHANGE_SCHEMA);
  assert.notEqual(result.session, input.reviewPacket);
  assert.notEqual(result.session.reviewGraph.commentThreads[0], input.reviewPacket.commentThreads[0]);
});

test('RB-03 returns diagnostics instead of throwing for malformed preview input', async () => {
  const bridge = await loadBridge();

  assert.doesNotThrow(() => bridge.buildRevisionPacketPreview(null));

  const topLevelResult = bridge.buildRevisionPacketPreview({
    projectId: 'project-1',
    sessionId: 'session-1',
    baselineHash: 'baseline-hash-1',
    createdAt: 1,
    reviewPacket: null,
  });

  assert.equal(topLevelResult.ok, false);
  assert.equal(topLevelResult.type, 'revisionBridge.reviewPacketPreview');
  assert.equal(topLevelResult.status, 'diagnostics');
  assert.equal(topLevelResult.code, 'E_REVISION_BRIDGE_REVIEW_PACKET_PREVIEW_DIAGNOSTICS');
  assert.equal(topLevelResult.reason, 'REVISION_BRIDGE_FIELD_REQUIRED');
  assert.equal(topLevelResult.session, null);
  assert.equal(topLevelResult.reasons.some((reason) => reason.field === 'reviewPacket'), true);
  assert.equal(topLevelResult.reasons.some((reason) => reason.field === 'createdAt'), true);

  const packetResult = bridge.buildRevisionPacketPreview({
    projectId: 'project-1',
    sessionId: 'session-1',
    baselineHash: 'baseline-hash-1',
    reviewPacket: {
      ...validReviewPacket(),
      textChanges: 'bad',
    },
  });

  assert.equal(packetResult.ok, false);
  assert.equal(packetResult.reason, 'REVISION_BRIDGE_FIELD_INVALID');
  assert.equal(packetResult.reasons.some((reason) => (
    reason.field === 'revisionSession.reviewGraph.textChanges'
  )), true);
});

test('RB-03 preserves RB-02 cross-entity validation diagnostics', async () => {
  const bridge = await loadBridge();
  const input = validPreviewInput();
  input.reviewPacket.commentPlacements[0].threadId = 'missing-thread';
  input.reviewPacket.decisionStates[0].itemId = 'missing-change';

  const result = bridge.buildRevisionPacketPreview(input);

  assert.equal(result.ok, false);
  assert.equal(result.code, 'E_REVISION_BRIDGE_REVIEW_PACKET_PREVIEW_DIAGNOSTICS');
  assert.equal(result.reasons.some((reason) => (
    reason.code === 'REVISION_BRIDGE_FIELD_INVALID'
    && reason.field === 'revisionSession.reviewGraph.commentPlacements.0.threadId'
  )), true);
  assert.equal(result.reasons.some((reason) => (
    reason.code === 'REVISION_BRIDGE_FIELD_INVALID'
    && reason.field === 'revisionSession.reviewGraph.decisionStates.0.itemId'
  )), true);
});

test('RB-03 preview builder is deterministic and does not mutate caller input', async () => {
  const bridge = await loadBridge();
  const input = validPreviewInput();
  const before = deepClone(input);

  const first = bridge.buildRevisionPacketPreview(input);
  const second = bridge.buildRevisionPacketPreview(input);

  assert.deepEqual(first, second);
  assert.deepEqual(input, before);
  assert.equal(bridge.buildRevisionPacketPreview({
    projectId: 'project-1',
    sessionId: 'session-1',
    baselineHash: 'baseline-hash-1',
    reviewPacket: validReviewPacket(),
  }).session.createdAt, '');
});

test('RB-03 preview does not authorize apply or call apply safety', async () => {
  const bridge = await loadBridge();
  const text = fs.readFileSync(MODULE_PATH, 'utf8');
  const builderStart = text.indexOf('export function buildRevisionPacketPreview');
  const builderEnd = text.indexOf('function normalizeTargetScope');
  const builderSection = text.slice(builderStart, builderEnd);

  const result = bridge.buildRevisionPacketPreview(validPreviewInput());

  assert.equal(result.ok, true);
  assert.deepEqual(findForbiddenKeys(result, ['apply', 'applyPlan', 'authorized', 'canApply']), []);
  assert.equal(builderSection.includes('evaluateRevisionBridgeApplySafety'), false);
  assert.equal(builderSection.includes('APPLY_BLOCKED_CODE'), false);
});

test('RB-03 changed files stay inside the exact task allowlist', () => {
  const changedFiles = changedFilesFromGitStatus(
    execFileSync('git', ['status', '--porcelain', '-uall'], { encoding: 'utf8' }),
  );

  assert.deepEqual(changedFilesOutsideAllowlist(changedFiles), []);
});

test('RB-03 changed-file allowlist still rejects outside paths', () => {
  assert.deepEqual(changedFilesOutsideAllowlist([]), []);
  assert.deepEqual(changedFilesOutsideAllowlist([TEST_PATH]), []);
  assert.deepEqual(changedFilesOutsideAllowlist(ALLOWLIST), []);
  assert.deepEqual(
    changedFilesOutsideAllowlist([
      `tmp/${path.basename(TEST_PATH)}`,
      'tmp/rb03-probe-unique.js',
    ]),
    [
      `tmp/${path.basename(TEST_PATH)}`,
      'tmp/rb03-probe-unique.js',
    ],
  );
});

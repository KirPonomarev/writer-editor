const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MAIN_PATH = path.join(REPO_ROOT, 'src', 'main.js');
const BRIDGE_MODULE_PATH = path.join(REPO_ROOT, 'src', 'io', 'revisionBridge', 'index.mjs');
const SECTION_START = '// CONTOUR_01A_REVIEW_MUTATE_PORT_START';
const SECTION_END = '// CONTOUR_01A_REVIEW_MUTATE_PORT_END';

function readMainSource() {
  return fs.readFileSync(MAIN_PATH, 'utf8');
}

function extractMarkedSection(text, startMarker, endMarker) {
  const start = text.indexOf(startMarker);
  const end = text.indexOf(endMarker);
  assert.notEqual(start, -1, `missing marker: ${startMarker}`);
  assert.notEqual(end, -1, `missing marker: ${endMarker}`);
  assert.ok(end > start, `marker order invalid: ${startMarker}`);
  return text.slice(start, end + endMarker.length);
}

function cloneJsonSafe(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function isPlainObjectValue(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasReviewSurfacePayload(value) {
  return isPlainObjectValue(value) && Object.keys(value).length > 0;
}

function computeHash(text) {
  return crypto.createHash('sha256').update(String(text || ''), 'utf8').digest('hex');
}

async function loadBridge() {
  return import(pathToFileURL(BRIDGE_MODULE_PATH).href);
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

function validReviewPacket(overrides = {}) {
  return {
    commentThreads: [validThread()],
    commentPlacements: [validPlacement()],
    textChanges: [validTextChange()],
    structuralChanges: [validStructuralChange()],
    diagnosticItems: [validDiagnosticItem()],
    decisionStates: [validDecisionState()],
    ...overrides,
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

function instantiateReviewMutatePort(options = {}) {
  const mainSource = readMainSource();
  const section = extractMarkedSection(mainSource, SECTION_START, SECTION_END);
  const sandbox = {
    activeReviewSessionStore: null,
    activeReviewSessionLifecycle: 'passive',
    currentReviewSurfacePayload: {},
    currentReviewSurfacePayloadSource: 'none',
    currentReviewSurfacePayloadContentHash: '',
    cloneJsonSafe,
    computeHash,
    hasReviewSurfacePayload,
    isPlainObjectValue,
    loadRevisionBridgeModule: typeof options.loadRevisionBridgeModule === 'function'
      ? options.loadRevisionBridgeModule
      : async () => {
        throw new Error('loadRevisionBridgeModule unavailable in test sandbox');
      },
    module: { exports: {} },
    exports: {},
  };
  vm.runInNewContext(
    `${section}
module.exports = {
  resetActiveReviewSessionStore,
  normalizeReviewSessionImportRecord,
  cloneActiveReviewSessionStore,
  readActiveReviewSessionReviewSurface,
  handleReviewSurfaceImportPacketCommandSurface,
  handleReviewSurfaceClearSessionCommandSurface,
  handleReviewSurfaceApplyExactTextChangeCommandSurface,
  getState() {
    return {
      activeReviewSessionStore,
      activeReviewSessionLifecycle,
      currentReviewSurfacePayload,
      currentReviewSurfacePayloadSource,
      currentReviewSurfacePayloadContentHash,
    };
  },
};`,
    sandbox,
    { filename: MAIN_PATH },
  );
  return sandbox.module.exports;
}

function normalizeVmValue(value) {
  return cloneJsonSafe(value);
}

test('review mutate port contract: review commands are exposed through ui command bridge and menu handlers', () => {
  const source = readMainSource();

  assert.match(
    source,
    /UI_COMMAND_BRIDGE_ALLOWED_COMMAND_IDS\s*=\s*new Set\(\[[\s\S]*'cmd\.project\.review\.importPacket'[\s\S]*'cmd\.project\.review\.clearSession'[\s\S]*'cmd\.project\.review\.applyExactTextChange'/,
  );
  assert.match(
    source,
    /'cmd\.project\.review\.importPacket':\s*async\s*\(payload\s*=\s*\{\}\)\s*=>\s*\{\s*return handleReviewSurfaceImportPacketCommandSurface\(payload\);/,
  );
  assert.match(
    source,
    /'cmd\.project\.review\.clearSession':\s*async\s*\(\)\s*=>\s*\{\s*return handleReviewSurfaceClearSessionCommandSurface\(\);/,
  );
  assert.match(
    source,
    /'cmd\.project\.review\.applyExactTextChange':\s*async\s*\(payload\s*=\s*\{\}\)\s*=>\s*\{\s*return handleReviewSurfaceApplyExactTextChangeCommandSurface\(payload\);/,
  );
});

test('review mutate port contract: import stores canonical in-memory session shape', async () => {
  const port = instantiateReviewMutatePort();

  const payload = {
    projectId: 'project-1',
    sessionId: 'session-1',
    baselineHash: 'baseline-1',
    reviewSurface: {
      summary: { total: 1 },
      changes: [{ changeId: 'change-1' }],
    },
    revisionSession: {
      status: 'preview',
    },
    sourcePacketHash: 'packet-hash-1',
    createdAt: '2026-05-24T12:00:00.000Z',
  };

  const result = await port.handleReviewSurfaceImportPacketCommandSurface(payload);
  const state = port.getState();

  assert.equal(result.ok, true);
  assert.deepEqual(normalizeVmValue(result.reviewSurface), payload.reviewSurface);
  assert.deepEqual(normalizeVmValue(result.session), {
    projectId: 'project-1',
    sessionId: 'session-1',
    baselineHash: 'baseline-1',
    reviewSurface: payload.reviewSurface,
    revisionSession: { status: 'preview' },
    sourcePacketHash: 'packet-hash-1',
    createdAt: '2026-05-24T12:00:00.000Z',
  });
  assert.equal(state.activeReviewSessionLifecycle, 'active');
  assert.deepEqual(normalizeVmValue(state.activeReviewSessionStore), normalizeVmValue(result.session));
  assert.deepEqual(normalizeVmValue(state.currentReviewSurfacePayload), payload.reviewSurface);
  assert.equal(state.currentReviewSurfacePayloadSource, 'session');
  assert.equal(state.currentReviewSurfacePayloadContentHash, '');
  assert.deepEqual(normalizeVmValue(port.readActiveReviewSessionReviewSurface()), payload.reviewSurface);
});

test('review mutate port contract: import builds Stage01 preview surface from reviewPacket without authorizing apply', async () => {
  const port = instantiateReviewMutatePort({ loadRevisionBridgeModule: loadBridge });
  const payload = {
    projectId: 'project-1',
    sessionId: 'session-1',
    baselineHash: 'baseline-a',
    currentBaselineHash: 'baseline-b',
    reviewPacket: validReviewPacket(),
    createdAt: '2026-05-24T12:00:00.000Z',
  };
  const before = cloneJsonSafe(payload);

  const result = await port.handleReviewSurfaceImportPacketCommandSurface(payload);
  const state = port.getState();
  const reviewSurface = normalizeVmValue(result.reviewSurface);

  assert.equal(result.ok, true);
  assert.deepEqual(payload, before);
  assert.equal(reviewSurface.revisionSession.projectId, 'project-1');
  assert.equal(reviewSurface.revisionSession.sessionId, 'session-1');
  assert.equal(reviewSurface.revisionSession.baselineHash, 'baseline-a');
  assert.equal(reviewSurface.revisionSession.reviewGraph.textChanges.length, 1);
  assert.equal(reviewSurface.shadowPreview.status, 'preview');
  assert.equal(reviewSurface.blockedApplyPlan.status, 'blocked');
  assert.equal(reviewSurface.blockedApplyPlan.canApply, false);
  assert.deepEqual(reviewSurface.blockedApplyPlan.applyOps, []);
  assert.deepEqual(
    reviewSurface.blockedApplyPlan.reasons.map((reason) => reason.code),
    ['REVISION_BRIDGE_STAGE01_PREVIEW_ONLY', 'REVISION_BRIDGE_STAGE01_STALE_BASELINE'],
  );
  assert.equal(reviewSurface.structuralManualReviewPreview.status, 'preview');
  assert.equal(reviewSurface.structuralManualReviewPreview.canAutoApply, false);
  assert.equal(reviewSurface.structuralManualReviewPreview.items[0].structuralChangeId, 'structural-change-1');
  assert.equal(
    reviewSurface.structuralManualReviewPreview.items[0].manualOnlyReason,
    'REVISION_BRIDGE_STAGE01_STRUCTURAL_MANUAL_ONLY',
  );
  assert.deepEqual(findForbiddenKeys(reviewSurface, [
    'applyAuthorized',
    'applyDecision',
    'authorized',
    'authorization',
  ]), []);
  assert.equal(state.activeReviewSessionLifecycle, 'active');
  assert.deepEqual(normalizeVmValue(state.currentReviewSurfacePayload), reviewSurface);
  assert.equal(state.currentReviewSurfacePayloadSource, 'session');
  assert.equal(state.currentReviewSurfacePayloadContentHash, '');
});

test('review mutate port contract: import maps parsedSurface unsupported items into preview diagnostics only', async () => {
  const port = instantiateReviewMutatePort({ loadRevisionBridgeModule: loadBridge });

  const result = await port.handleReviewSurfaceImportPacketCommandSurface({
    projectId: 'project-1',
    sessionId: 'session-1',
    baselineHash: 'baseline-1',
    parsedSurface: validParsedSurface(),
  });

  const reviewSurface = normalizeVmValue(result.reviewSurface);

  assert.equal(result.ok, true);
  assert.deepEqual(reviewSurface.structuralManualReviewPreview.unsupportedObservations, [
    {
      itemId: 'unsupported-1',
      structuralKind: 'unsupportedObservation',
      reason: 'REVISION_BRIDGE_STAGE01_UNSUPPORTED_OBSERVATION',
    },
  ]);
  assert.deepEqual(reviewSurface.blockedApplyPlan.applyOps, []);
  assert.equal(reviewSurface.revisionSession.reviewGraph.textChanges.length, 1);
  assert.equal(reviewSurface.revisionSession.reviewGraph.structuralChanges.length, 1);
});

test('review mutate port contract: packet diagnostics are typed and do not activate a session', async () => {
  const port = instantiateReviewMutatePort({ loadRevisionBridgeModule: loadBridge });

  const result = await port.handleReviewSurfaceImportPacketCommandSurface({
    projectId: 'project-1',
    sessionId: 'session-1',
    baselineHash: 'baseline-1',
    reviewPacket: {
      commentThreads: 'not-an-array',
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'E_REVIEW_SESSION_IMPORT_INVALID');
  assert.equal(result.error.op, 'cmd.project.review.importPacket');
  assert.equal(result.error.reason, 'REVIEW_STAGE01_PREVIEW_DIAGNOSTICS');
  assert.equal(Array.isArray(result.error.details.reasons), true);
  assert.deepEqual(normalizeVmValue(port.readActiveReviewSessionReviewSurface()), {});
  assert.equal(port.getState().activeReviewSessionLifecycle, 'passive');
});

test('review mutate port contract: missing Stage01 builder fails closed as typed diagnostics', async () => {
  const port = instantiateReviewMutatePort({
    loadRevisionBridgeModule: async () => {
      throw new Error('bridge unavailable');
    },
  });

  const result = await port.handleReviewSurfaceImportPacketCommandSurface({
    projectId: 'project-1',
    sessionId: 'session-1',
    baselineHash: 'baseline-1',
    reviewPacket: validReviewPacket(),
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'E_REVIEW_SESSION_IMPORT_INVALID');
  assert.equal(result.error.op, 'cmd.project.review.importPacket');
  assert.equal(result.error.reason, 'REVIEW_STAGE01_PREVIEW_BUILDER_UNAVAILABLE');
  assert.equal(result.error.details.message, 'bridge unavailable');
  assert.deepEqual(normalizeVmValue(port.readActiveReviewSessionReviewSurface()), {});
  assert.equal(port.getState().activeReviewSessionLifecycle, 'passive');
});

test('review mutate port contract: preview import section stays storage-free', () => {
  const section = extractMarkedSection(readMainSource(), SECTION_START, SECTION_END);
  const forbiddenRuntimeCalls = [
    'writeFileAtomic',
    'writeFlowSceneBatchAtomic',
    'writeBufferAtomic',
    'exactTextMinSafeWrite',
    'ensureProjectManifest',
    'resolveProjectBindingForFile',
    'docxMin',
    'buildDocxMinBuffer',
    'runDocxMinExport',
    'markdownImportSafeCreate',
    'applyMarkdownImportSafeCreate',
    'fs.',
    'readFile',
    'writeFile',
  ];

  for (const forbidden of forbiddenRuntimeCalls) {
    assert.equal(section.includes(forbidden), false, `${forbidden} must stay out of review packet preview import`);
  }
});

test('review mutate port contract: import rejects payload without required metadata', async () => {
  const port = instantiateReviewMutatePort();

  const result = await port.handleReviewSurfaceImportPacketCommandSurface({
    reviewSurface: {
      summary: { total: 1 },
    },
  });

  assert.equal(result.ok, false);
  assert.deepEqual(normalizeVmValue(result.error), {
    code: 'E_REVIEW_SESSION_IMPORT_INVALID',
    op: 'cmd.project.review.importPacket',
    reason: 'REVIEW_SESSION_METADATA_REQUIRED',
  });
  assert.deepEqual(normalizeVmValue(port.readActiveReviewSessionReviewSurface()), {});
  assert.equal(port.getState().activeReviewSessionLifecycle, 'passive');
});

test('review mutate port contract: clear closes active session and read returns empty surface', async () => {
  const port = instantiateReviewMutatePort();

  await port.handleReviewSurfaceImportPacketCommandSurface({
    projectId: 'project-1',
    sessionId: 'session-1',
    baselineHash: 'baseline-1',
    reviewSurface: {
      summary: { total: 1 },
    },
  });

  const result = port.handleReviewSurfaceClearSessionCommandSurface();
  const state = port.getState();

  assert.deepEqual(normalizeVmValue(result), {
    ok: true,
    cleared: true,
    hadActiveSession: true,
  });
  assert.equal(state.activeReviewSessionLifecycle, 'cleared');
  assert.equal(state.activeReviewSessionStore, null);
  assert.deepEqual(normalizeVmValue(state.currentReviewSurfacePayload), {});
  assert.equal(state.currentReviewSurfacePayloadSource, 'none');
  assert.equal(state.currentReviewSurfacePayloadContentHash, '');
  assert.deepEqual(normalizeVmValue(port.readActiveReviewSessionReviewSurface()), {});
});

test('review mutate port contract: reserved apply stays typed disabled until contour 04', () => {
  const port = instantiateReviewMutatePort();

  const result = port.handleReviewSurfaceApplyExactTextChangeCommandSurface({
    projectId: 'project-1',
  });

  assert.deepEqual(normalizeVmValue(result), {
    ok: false,
    error: {
      code: 'E_REVIEW_EXACT_TEXT_CHANGE_NOT_ENABLED',
      op: 'cmd.project.review.applyExactTextChange',
      reason: 'REVIEW_EXACT_TEXT_CHANGE_NOT_ENABLED',
      details: {
        status: 'RESERVED_UNTIL_CONTOUR_04',
      },
    },
  });
});

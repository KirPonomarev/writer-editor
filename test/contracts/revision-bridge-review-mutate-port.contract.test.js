const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MAIN_PATH = path.join(REPO_ROOT, 'src', 'main.js');
const BRIDGE_MODULE_PATH = path.join(REPO_ROOT, 'src', 'io', 'revisionBridge', 'index.mjs');
const EXACT_SAFE_WRITE_MODULE_PATH = path.join(REPO_ROOT, 'src', 'io', 'revisionBridge', 'exactTextMinSafeWrite.mjs');
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

async function loadExactSafeWrite() {
  return import(pathToFileURL(EXACT_SAFE_WRITE_MODULE_PATH).href);
}

function tmpScene(text) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rb-review-mutate-port-'));
  const scenePath = path.join(dir, 'scene.txt');
  fs.writeFileSync(scenePath, text, 'utf8');
  return { dir, scenePath };
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
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

function validExactApplyRevisionSession({
  projectId = 'project-1',
  sessionId = 'session-1',
  baselineHash = 'baseline-1',
  sceneId = 'scene-1',
  quote = 'beta',
  replacementText = 'delta',
  textChanges,
  structuralChanges = [],
  commentThreads = [],
  commentPlacements = [],
  status = 'open',
} = {}) {
  return {
    projectId,
    sessionId,
    baselineHash,
    status,
    reviewGraph: {
      commentThreads,
      commentPlacements,
      textChanges: textChanges || [
        {
          changeId: 'text-change-1',
          targetScope: {
            type: 'scene',
            id: sceneId,
          },
          match: {
            kind: 'exact',
            quote,
            prefix: '',
            suffix: '',
          },
          replacementText,
          createdAt: '2026-04-24T08:02:00.000Z',
        },
      ],
      structuralChanges,
      diagnosticItems: [],
      decisionStates: [],
    },
  };
}

async function buildReadyExactApplyInput({ scenePath, sceneText, revisionSession }) {
  const bridge = await loadBridge();
  const sceneId = revisionSession.reviewGraph.textChanges[0].targetScope.id;
  const projectSnapshot = {
    projectId: revisionSession.projectId,
    baselineHash: revisionSession.baselineHash,
    scenes: [
      {
        sceneId,
        text: sceneText,
      },
    ],
  };
  const reviewItem = revisionSession.reviewGraph.textChanges[0];
  const planPreview = bridge.buildExactTextApplyPlanNoDiskPreview({
    projectSnapshot,
    revisionSession,
    reviewItem,
  });
  assert.equal(planPreview.status, 'ready');
  return {
    projectRoot: path.dirname(scenePath),
    projectSnapshot,
    revisionSession,
    reviewItem,
    planPreview,
    scenePath,
    scenePathBySceneId: {
      [sceneId]: scenePath,
    },
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
  assert.equal(state.activeReviewSessionStore.currentBaselineHash, 'baseline-b');
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

test('review mutate port contract: preview import path stays storage-free while apply delegates through safe writer', () => {
  const section = extractMarkedSection(readMainSource(), SECTION_START, SECTION_END);
  const previewOnlySection = section.slice(0, section.indexOf('const REVIEW_EXACT_TEXT_APPLY_COMMAND_ID'));
  const forbiddenRuntimeCalls = [
    'writeFileAtomic',
    'writeFlowSceneBatchAtomic',
    'writeBufferAtomic',
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
    assert.equal(previewOnlySection.includes(forbidden), false, `${forbidden} must stay out of review packet preview import`);
  }

  const forbiddenDirectWriteCalls = [
    'writeFileAtomic',
    'writeFlowSceneBatchAtomic',
    'writeBufferAtomic',
    'fileManager.writeFileAtomic',
    'fs.',
    'readFile',
    'writeFile',
  ];
  for (const forbidden of forbiddenDirectWriteCalls) {
    assert.equal(section.includes(forbidden), false, `${forbidden} must stay out of review mutate port section`);
  }

  for (const forbiddenPayloadAccess of [
    /payload\s*\.\s*scenePath/u,
    /payload\s*\.\s*projectRoot/u,
    /payload\s*\.\s*scenePathBySceneId/u,
    /payload\s*\.\s*projectSnapshot/u,
    /payload\s*\.\s*planPreview/u,
    /payload\s*\.\s*plan/u,
    /payload\s*\.\s*applyOps/u,
    /payload\s*\.\s*receipt/u,
  ]) {
    assert.equal(forbiddenPayloadAccess.test(section), false, `${forbiddenPayloadAccess} must not be renderer authority`);
  }
});

test('review mutate port contract: main apply context is main-owned and never renderer snapshot-owned', () => {
  const source = readMainSource();
  const start = source.indexOf('async function buildReviewExactTextApplyInputFromMainState');
  const end = source.indexOf('function mapMarkdownErrorCode', start);
  assert.ok(start > -1 && end > start, 'main-owned apply context builder must exist');
  const snippet = source.slice(start, end);

  assert.equal(snippet.includes('requestEditorSnapshot'), false);
  assert.equal(snippet.includes('readCurrentReviewSurfaceSourceText'), false);
  assert.equal(snippet.includes('buildDerivedReviewSurfacePayload'), false);
  assert.equal(snippet.includes('payload.scenePath'), false);
  assert.equal(snippet.includes('payload.projectRoot'), false);
  assert.equal(snippet.includes('payload.projectSnapshot'), false);
  assert.equal(snippet.includes('fs.readFile(currentFilePath, \'utf8\')'), true);
  assert.equal(snippet.includes('isDirty || autoSaveInProgress'), true);
  assert.equal(snippet.includes('buildExactTextApplyPlanNoDiskPreview'), true);
  assert.equal(snippet.includes('scenePathBySceneId'), true);
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

test('review mutate port contract: apply exact text requires active session and rejects renderer authority fields', async () => {
  const port = instantiateReviewMutatePort();

  const noSession = await port.handleReviewSurfaceApplyExactTextChangeCommandSurface({
    projectId: 'project-1',
  });

  assert.deepEqual(normalizeVmValue(noSession), {
    ok: false,
    error: {
      code: 'E_REVIEW_EXACT_TEXT_APPLY_PAYLOAD_INVALID',
      op: 'cmd.project.review.applyExactTextChange',
      reason: 'REVIEW_EXACT_TEXT_APPLY_PAYLOAD_UNSUPPORTED_FIELDS',
      details: {
        fields: ['projectId'],
      },
    },
  });

  const rendererAuthority = await port.handleReviewSurfaceApplyExactTextChangeCommandSurface({
    scenePath: '/tmp/renderer-owned.txt',
    projectId: 'project-1',
  });

  assert.deepEqual(normalizeVmValue(rendererAuthority), {
    ok: false,
    error: {
      code: 'E_REVIEW_EXACT_TEXT_APPLY_PAYLOAD_INVALID',
      op: 'cmd.project.review.applyExactTextChange',
      reason: 'REVIEW_EXACT_TEXT_APPLY_RENDERER_AUTHORITY_DENIED',
      details: {
        fields: ['scenePath'],
      },
    },
  });

  const emptyPayload = await port.handleReviewSurfaceApplyExactTextChangeCommandSurface({});
  assert.equal(emptyPayload.ok, false);
  assert.equal(emptyPayload.error.code, 'E_REVIEW_EXACT_TEXT_APPLY_NO_ACTIVE_SESSION');
  assert.equal(emptyPayload.error.reason, 'REVIEW_EXACT_TEXT_APPLY_NO_ACTIVE_SESSION');
});

test('review mutate port contract: apply exact text writes through safe core and exposes receipt on review surface', async () => {
  const port = instantiateReviewMutatePort();
  const { scenePath } = tmpScene('Alpha beta gamma.');
  const revisionSession = validExactApplyRevisionSession({ sceneId: scenePath });
  const applyInput = await buildReadyExactApplyInput({
    scenePath,
    sceneText: 'Alpha beta gamma.',
    revisionSession,
  });

  const importResult = await port.handleReviewSurfaceImportPacketCommandSurface({
    projectId: 'project-1',
    sessionId: 'session-1',
    baselineHash: 'baseline-1',
    reviewSurface: {
      revisionSession,
      summary: { total: 1 },
    },
    revisionSession,
    sourcePacketHash: 'packet-hash-apply-1',
    createdAt: '2026-05-24T12:00:00.000Z',
  });
  assert.equal(importResult.ok, true);

  const result = await port.handleReviewSurfaceApplyExactTextChangeCommandSurface(
    { changeId: 'text-change-1' },
    {
      buildReviewExactTextApplyInput: async () => ({ ok: true, input: applyInput }),
      loadExactTextMinSafeWriteModule: loadExactSafeWrite,
      safeWriteOptions: { now: () => 1700000000000 },
    },
  );

  const value = normalizeVmValue(result);
  const state = normalizeVmValue(port.getState());

  assert.equal(value.ok, true);
  assert.equal(value.applied, true);
  assert.equal(readText(scenePath), 'Alpha delta gamma.');
  assert.equal(value.receipt.projectId, 'project-1');
  assert.equal(value.receipt.sessionId, 'session-1');
  assert.equal(value.receipt.sceneId, scenePath);
  assert.equal(value.receipt.changeId, 'text-change-1');
  assert.equal(value.receipt.writeStatus, 'applied');
  assert.equal(value.reviewSurface.receipt.transactionId, value.receipt.transactionId);
  assert.equal(value.reviewSurface.exactTextApplyResult.applied, true);
  assert.equal(value.reviewSurface.exactTextApplyResult.status, 'applied');
  assert.equal(state.currentReviewSurfacePayloadSource, 'session');
  assert.equal(state.currentReviewSurfacePayload.receipt.transactionId, value.receipt.transactionId);
  assert.equal(normalizeVmValue(port.readActiveReviewSessionReviewSurface()).receipt.transactionId, value.receipt.transactionId);
});

test('review mutate port contract: apply exact text blocks structural and multi-change sessions before write context', async () => {
  const port = instantiateReviewMutatePort();
  const buildContext = async () => {
    throw new Error('context builder must not be called');
  };

  await port.handleReviewSurfaceImportPacketCommandSurface({
    projectId: 'project-1',
    sessionId: 'session-1',
    baselineHash: 'baseline-1',
    reviewSurface: { summary: { total: 1 } },
    revisionSession: validExactApplyRevisionSession({
      structuralChanges: [{ structuralChangeId: 'structural-1', kind: 'split-scene' }],
    }),
  });
  const structural = await port.handleReviewSurfaceApplyExactTextChangeCommandSurface({}, {
    buildReviewExactTextApplyInput: buildContext,
    loadExactTextMinSafeWriteModule: loadExactSafeWrite,
  });
  assert.equal(structural.ok, false);
  assert.equal(structural.error.reason, 'REVIEW_EXACT_TEXT_APPLY_STRUCTURAL_CHANGE_BLOCKED');

  await port.handleReviewSurfaceImportPacketCommandSurface({
    projectId: 'project-1',
    sessionId: 'session-2',
    baselineHash: 'baseline-1',
    reviewSurface: { summary: { total: 2 } },
    revisionSession: validExactApplyRevisionSession({
      textChanges: [
        validTextChange(),
        {
          ...validTextChange(),
          changeId: 'text-change-2',
          match: { kind: 'exact', quote: 'another', prefix: '', suffix: '' },
          replacementText: 'other',
        },
      ],
    }),
  });
  const multi = await port.handleReviewSurfaceApplyExactTextChangeCommandSurface({}, {
    buildReviewExactTextApplyInput: buildContext,
    loadExactTextMinSafeWriteModule: loadExactSafeWrite,
  });
  assert.equal(multi.ok, false);
  assert.equal(multi.error.reason, 'REVIEW_EXACT_TEXT_APPLY_SINGLE_TEXT_CHANGE_REQUIRED');
});

test('review mutate port contract: blocked safe-write result does not attach receipt', async () => {
  const port = instantiateReviewMutatePort();

  await port.handleReviewSurfaceImportPacketCommandSurface({
    projectId: 'project-1',
    sessionId: 'session-1',
    baselineHash: 'baseline-1',
    reviewSurface: {
      summary: { total: 1 },
    },
    revisionSession: validExactApplyRevisionSession(),
  });

  const result = await port.handleReviewSurfaceApplyExactTextChangeCommandSurface({}, {
    buildReviewExactTextApplyInput: async () => ({ ok: true, input: { fake: true } }),
    loadExactTextMinSafeWriteModule: async () => ({
      applyExactTextMinSafeWrite: async () => ({
        ok: false,
        status: 'blocked',
        code: 'E_FAKE_BLOCKED',
        reason: 'FAKE_BLOCKED_REASON',
        applied: false,
        reasons: [
          {
            code: 'FAKE_BLOCKED_REASON',
            field: 'scenePath',
            message: 'blocked in test',
          },
        ],
      }),
    }),
  });
  const state = normalizeVmValue(port.getState());

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'E_FAKE_BLOCKED');
  assert.equal(result.error.reason, 'FAKE_BLOCKED_REASON');
  assert.equal(Object.prototype.hasOwnProperty.call(state.currentReviewSurfacePayload, 'receipt'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(
    normalizeVmValue(port.readActiveReviewSessionReviewSurface()),
    'receipt',
  ), false);
});

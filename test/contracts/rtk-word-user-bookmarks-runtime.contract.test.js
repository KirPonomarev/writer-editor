'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), vm = require('node:vm');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), crypto = require('node:crypto');
const core = require('../../src/core/word-user-bookmarks-v1.cjs');
const envelope = require('../../src/core/document-content-envelope-v1.cjs');
const pending = require('../../src/core/word-pending-text-revisions-v1.cjs');
const { bindSaveReceiptToAck } = require('../../src/core/save-receipt-ack-v1.cjs');
const { SAVE_ACK_KINDS } = require('../../src/core/dirty-admission-v1.cjs');
const { TRANSACTION_PHASE_CHAIN } = require('../../src/core/project-transaction-v1.cjs');
const { createCommandSurfaceKernel } = require('../../src/command/commandSurfaceKernel.js');
const main = fs.readFileSync(path.join(__dirname, '../../src/main.js'), 'utf8');
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const clone = value => JSON.parse(JSON.stringify(value));
const doc = text => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });
const endpoint = offsetUtf16 => ({ paragraphIndex: 0, offsetUtf16, edge: 'text' });
function seed() { return core.planMutation({ doc: doc('ABCDEF'), action: 'create', name: 'Anchor', start: endpoint(2), end: endpoint(5),
  requestId: 'seed', projectId: 'p', sceneId: 'a.txt' }).doc; }
function edit(before, text) { const next = clone(before); next.content[0].content[0].text = text; return next; }
async function harness(t, initial = seed()) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bookmarks-runtime-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const manifestPath = path.join(dir, 'project.craftsman.json'); fs.writeFileSync(manifestPath, JSON.stringify({ schemaVersion: 1, projectId: 'p' }));
  const file = path.join(dir, 'a.txt'); fs.writeFileSync(file, envelope.composeObservablePayload({ doc: initial }));
  const h = { writes: 0, generation: 0, working: fs.readFileSync(file, 'utf8'), publications: [], dirty: false };
  const c = vm.createContext({ console, Buffer, JSON, userBookmarkModel: core, pendingTextRevisions: pending,
    fs: fs.promises, path, currentFilePath: file, commentAuthoringSessionId: 'session', lastSignaledEditGeneration: 0,
    currentLifecycleSubjectId: () => h.subject || 'life', cloneJsonSafe: clone, computeHash: hash,
    SAVE_ACK_KINDS, bindSaveReceiptToAck, mergeSignaledGeneration: (a,b) => Math.max(a,b),
    setDirtyState: state => { h.dirty = state; },
    loadDocumentContentEnvelopeModule: async () => envelope,
    getProjectRootPath: () => dir, getProjectManifestPath: () => manifestPath, PROJECT_MANIFEST_SCHEMA_VERSION: 1,
    isPathInside: (root, file) => file.startsWith(root + path.sep), isAllowedFilePath: value => value === file,
    resolveProjectBindingForFile: async () => { throw Error('UNSAFE_ENSURE_RESOLVER_FOR_BOOKMARKS'); },
    loadMarkdownIoModule: async () => import('../../src/io/markdown/index.mjs'),
    prepareBookProfileManifestForFile: async () => ({ expectedText: '{}', nextText: '{}', manifestPath: path.join(dir, 'manifest.json'), projectId: 'p' }),
    SAVE_AUTHORITY_ROUTES: { PROJECT_TRANSACTION_V1: 'project', DURABLE_SAVE_V1: 'durable' }, SAVE_AUTHORITY_OBSERVER_IDS: {},
    executeAtomicSceneManifestGatewayCutover: ({ executeGateway }) => executeGateway(),
    getMainProjectManifestAuthority: async () => ({ withProjectLease: (id, fn) => fn({ publish: fn => fn() }) }),
    getDocumentContextFromPath: () => ({ kind: 'scene' }), getProjectRelativeFilePath: () => 'a.txt',
    loadProRoundtripPreservationModule: async () => ({ applyFreeEditProDataInvalidation: m => ({ ok: true, manifest: m }) }),
    activePendingRecording: null,
    isPlainObjectValue: value => value && typeof value === 'object' && !Array.isArray(value),
    loadRtkNonTextReturnModule: async () => ({ readCommentAuthoringState: async () => ({ text: null }),
      commentSceneSnapshotsEqual: (a,b) => JSON.stringify(pending.normalizeNode(a)) === JSON.stringify(pending.normalizeNode(b)) }),
    planCommentAnchorSave: () => null,
    loadNotesStorageModule: async () => ({ readNotesStorage: async () => ({ ok: true, sourceExists: false }) }),
    manuscriptNoteModel: { planManuscriptNoteAnchorSave: () => null },
    commitProjectTransaction: async request => {
      assert.equal(fs.readFileSync(file, 'utf8'), request.expectedSceneContent);
      h.writes++; fs.writeFileSync(file, request.sceneContent);
      if (h.afterWrite) { const fn = h.afterWrite; h.afterWrite = null; fn(); }
      return { success: true, revision: request.revision, sceneDigest: hash(request.sceneContent), phases: TRANSACTION_PHASE_CHAIN };
    },
    mainWindow: { webContents: { send(channel, payload) {
      assert.equal(channel, 'editor:set-text'); h.publications.push(payload);
      if (payload.expectedContent === h.working && payload.expectedGeneration === h.generation) h.working = payload.content;
    } } },
    requestEditorSnapshot: async () => ({ content: h.working, generation: h.generation }),
    evaluateWriterLocalCommandAccess: () => ({ allowed: h.allowed !== false }), getWriterLocalRuntimeProfile: () => ({}),
    getProductCommandRecord: () => ({}), decideCommandEntitlement: () => ({ available: h.allowed !== false }), getProductEntitlementTier: () => 'FREE',
    queueDiskOperation: fn => fn(), isDirty: false, autoSaveInProgress: false,
    makeReviewMutateTypedError: (id, code) => ({ ok: false, code }),
  });
  const slice = (from,to) => main.slice(main.indexOf(from), main.indexOf(to));
  vm.runInContext(slice('let userBookmarkSaveContinuation =', 'async function recoverWriterProjectTransactionForFile('), c);
  vm.runInContext(slice('function acknowledgeMainOwnedSave(', 'function sendRuntimeCommand('), c);
  const source = () => { const raw = fs.readFileSync(file, 'utf8'); return { filePath: file, projectId: 'p', sceneId: 'a.txt', subjectId: 'life:session',
    sceneSha256: hash(raw), raw, parsed: envelope.parseObservablePayload(raw) }; };
  c.readCommentAuthoringContext = async () => { const current = source(); if (current.parsed.issue) throw Error('COMMENT_SCENE_INVALID'); return current; };
  vm.runInContext(slice('async function readProjectManifestRawAtPath(', 'function isProjectBindingFutureSchema('), c);
  vm.runInContext(slice('function userBookmarkEnvelopeMetadataEqual(', 'let activePendingRecording ='), c);
  Object.assign(c, {
    COMMAND_BUS_ROUTE: 'command.bus', PRODUCT_COMMAND_ID_SET: require('../../src/shared/productCommandRegistry.cjs').PRODUCT_COMMAND_ID_SET,
    UI_COMMAND_BRIDGE_ALLOWED_COMMAND_IDS: new Set(['managePrompt', 'create', 'copy', 'rename', 'delete'].map(action => `cmd.project.bookmarks.${action}`)
      .concat(['cmd.project.review.applyExactTextChange', 'cmd.project.review.applyExactTextChangesBatch'])),
    getProductCommandRecord: require('../../src/shared/productCommandRegistry.cjs').getProductCommandRecord,
    decideCommandEntitlement: require('../../src/core/entitlement-law-v1.cjs').decideCommandEntitlement,
    getProductEntitlementTier: () => 'free',
    resolveMenuCommandId: require('../../src/menu/command-namespace-canon.js').resolveMenuCommandId,
    isMenuLocalCustomizationCommandId: () => false,
    E_COMMAND_DISABLED_FOR_ENTITLEMENT: 'E_COMMAND_DISABLED_FOR_ENTITLEMENT',
    validateIpcEnvelope: require('../../src/core/ipc-envelope-v1.cjs').validateIpcEnvelope,
    guardedProtocolHandle: (channel, handler) => { assert.equal(channel, 'ui:command-bridge'); h.ipc = handler; },
    dispatchProductCommandBridge: () => { throw Error('WRONG_STAGE10_PRODUCT_ROUTE'); },
    sendCanonicalRuntimeCommand: commandId => { h.prompt = commandId; return true; },
    makeCommandBridgeSuccess: require('../../src/shared/commandBridgeResponse.cjs').makeCommandBridgeSuccess,
    makeCommandBridgeFailure: require('../../src/shared/commandBridgeResponse.cjs').makeCommandBridgeFailure,
    findCommandBridgeFailureReason: result => result?.code || result?.error?.code || result?.reason,
    makeCommandBridgeException: require('../../src/shared/commandBridgeResponse.cjs').makeCommandBridgeException,
  });
  const menuStart = main.indexOf('const MENU_COMMAND_HANDLERS = Object.freeze({');
  const menuEnd = main.indexOf("  'cmd.project.new':", menuStart);
  const reviewMenuStart = main.indexOf("  'cmd.project.review.applyExactTextChange': async");
  const reviewMenuEnd = main.indexOf("  'cmd.project.review.applyFullManuscriptExactTextReturn':", reviewMenuStart);
  vm.runInContext(main.slice(menuStart, menuEnd) + main.slice(reviewMenuStart, reviewMenuEnd) + '});', c);
  vm.runInContext(slice('function dispatchMenuCommand(', 'function buildCommandClickHandler('), c);
  vm.runInContext(slice("guardedProtocolHandle('ui:command-bridge'", 'const WORKSPACE_QUERY_BRIDGE_HANDLERS ='), c);
  h.dispatch = (commandId, payload) => h.ipc(null, { v: 1, correlationId: 'bookmark-actual-ipc', issuedAt: new Date().toISOString(),
    route: 'command.bus', commandId, payload });
  h.c = c; h.file = file; h.manifestPath = manifestPath; h.source = source;
  h.command = async (action, extras = {}) => {
    const current = source(); const result = await h.dispatch('cmd.project.bookmarks.' + action, {
      requestId: 'request-' + action, projectId: 'p', sceneId: 'a.txt', subjectId: current.subjectId,
      expectedSceneSha256: current.sceneSha256, registryRevision: core.readRegistry(current.parsed.doc)?.revision || 0, ...extras,
    });
    return typeof result.value?.ok === 'boolean' ? result.value
      : { ...result.value, ok: result.ok, reason: result.reason };
  };
  h.save = async () => {
    const raw = h.working, generation = h.generation;
    const receipt = await c.commitWriterProjectSnapshot(file, raw, generation, null, 'test save');
    return { receipt, ack: receipt.success ? await c.acknowledgeMainOwnedSave(receipt, raw, generation) : null };
  };
  return h;
}
function historyHarness(h) {
  Object.assign(h.c, {
    HISTORY_RESTORE_APPLY_COMMAND_ID: 'cmd.project.history.restoreApply', MARKDOWN_LOCAL_FILE_MAX_BYTES: 16 * 1024 * 1024,
    lastHistoryRestoreReceipt: null, backupHashes: new Map(),
    resolveProjectTreeNodeIdentity: async (nodeId, projectId) => {
      if (nodeId !== 'node-a' || projectId !== 'p') throw Error('FOREIGN_HISTORY_TARGET');
      return { nodeId, projectId, projectRoot: path.dirname(h.file) };
    },
    getResolvedTreeDocumentTarget: () => ({ filePath: h.file, kind: 'scene' }),
    sanitizePayloadWithinProjectRoot: payload => ({ ok: true, payload }),
    loadSceneHistoryReadModelModule: () => import('../../src/derived/sceneHistoryReadModel.mjs'),
    getProjectDocumentIdentityPayload: async () => ({ projectId: 'p', nodeId: 'node-a' }),
    attachProjectIdToEditorPayload: async payload => payload,
    sendEditorText: payload => { h.working = payload.content; }, updateStatus: () => {},
  });
  h.c.mainWindow.webContents.isDestroyed = () => false;
  vm.runInContext(main.slice(main.indexOf('function normalizeHistoryRestorePayload('), main.indexOf('function makeReplaceSingleSafeError(')), h.c);
}
test('actual history restore and restoreUndo recover the whole rich registry after first create', async t => {
  const h = await harness(t, doc('ABCDEF')); historyHarness(h);
  const original = h.working;
  assert.equal((await h.command('create', { name: 'First', selectionStart: 2, selectionEnd: 5 })).ok, true);
  const created = fs.readFileSync(h.file, 'utf8');
  const paths = await h.c.loadMarkdownIoModule().then(io => io.listRecoverySnapshots(h.file));
  const snapshotId = 'recovery-snapshot-' + path.basename(paths[0]).slice(-13);
  const preview = await h.c.handleHistoryRestorePreviewCommand({ projectId: 'p', nodeId: 'node-a', snapshotId });
  assert.equal(preview.ok, true, JSON.stringify(preview));
  const restored = await h.c.handleHistoryRestoreApplyCommand({ confirmed: true, previewPlan: preview.previewPlan });
  assert.equal(restored.ok, true, JSON.stringify(restored)); assert.equal(restored.receipt.undoAvailable, true);
  assert.equal(fs.readFileSync(h.file, 'utf8'), original); assert.equal(h.working, original);
  const undone = await h.c.handleHistoryRestoreUndoCommand({ receiptId: restored.receipt.receiptId });
  assert.equal(undone.ok, true, JSON.stringify(undone)); assert.equal(fs.readFileSync(h.file, 'utf8'), created); assert.equal(h.working, created);
  const writes = h.writes;
  assert.equal((await h.c.handleHistoryRestoreUndoCommand({ receiptId: restored.receipt.receiptId })).ok, false);
  assert.equal(h.writes, writes);
});
test('history preserves the legacy plain-text route and rejects stale artifacts and async generation', async t => {
  const h = await harness(t); historyHarness(h);
  const plainPath = path.join(path.dirname(h.file), '.a.txt.bak.1000000000000'); fs.writeFileSync(plainPath, 'ABCDEF');
  const preview = await h.c.handleHistoryRestorePreviewCommand({ projectId: 'p', nodeId: 'node-a', snapshotId: 'recovery-snapshot-1000000000000' });
  assert.equal(preview.ok, true);
  fs.writeFileSync(plainPath, 'changed');
  assert.equal((await h.c.handleHistoryRestoreApplyCommand({ confirmed: true, previewPlan: preview.previewPlan })).ok, false); assert.equal(h.writes, 0);
  fs.writeFileSync(plainPath, 'ABCDEF');
  const raw = fs.readFileSync(h.file, 'utf8');
  h.c.lastSignaledEditGeneration = 1;
  await assert.rejects(() => h.c.publishUserBookmarkHistorySnapshot(h.file, raw, 'ABCDEF', plainPath,
    async () => ({ ok: true, filePath: h.file })), /HISTORY_RESTORE_STALE_TARGET/);
  assert.equal(h.writes, 0); h.c.lastSignaledEditGeneration = 0;
  const result = await h.c.publishUserBookmarkHistorySnapshot(h.file, raw, 'ABCDEF', plainPath,
    async () => ({ ok: true, filePath: h.file }));
  assert.equal(result.receipt.success, true); assert.equal(fs.readFileSync(h.file, 'utf8'), 'ABCDEF');
  assert.equal(await h.c.publishUserBookmarkHistorySnapshot(h.file, 'ABCDEF', 'XYZ', plainPath, async () => ({})), null);
  h.c.lastSignaledEditGeneration = 2;
  assert.equal((await h.c.syncHistoryRestoreEditorFromMainState(h.file, 'restore', 1)).reason, 'HISTORY_RESTORE_EDITOR_STALE');
  assert.equal(h.working, raw);
});
function returnHarness(h) {
  const before = h.source(), beforeDoc = before.parsed.doc;
  const candidateDoc = core.planMutation({ doc: beforeDoc, action: 'delete',
    bookmarkId: core.readRegistry(beforeDoc).bookmarks[0].id }).doc;
  const changeId = 'docx-user-bookmarks-private-test', projectRoot = path.dirname(h.file);
  const input = { projectRoot, scenePath: h.file, reviewItems: [{ changeId, replacementText: 'ABCDEF' }] };
  const store = { input: clone(input), intakeGeneration: 1, sessionToken: { sessionId: 'review', sourcePacketHash: 'packet' },
    keyAuthority: { scope: 'full-manuscript', keyRef: 'private-key-ref',
      exportMap: { scenes: [{ sceneId: 'a.txt', rawSha256: 'sha256:' + hash(before.raw) }] }, scenePathBySceneId: { 'a.txt': h.file } },
    userBookmarksCandidate: { sceneId: 'a.txt', beforeDoc, plan: core.planReturn({ beforeDoc, candidateDoc }),
      raw: before.raw, parsed: before.parsed, changeId } };
  Object.assign(h.c, { activeRtkCleanLinkLabelApplyStore: store, activeReviewSessionLifecycle: 'active',
    activeReviewSessionStore: { sessionId: 'review', sourcePacketHash: 'packet' }, activeDocxReviewIntakeGeneration: 1,
    getProjectRootPath: () => projectRoot, fsSync: fs,
    readRtkNonOverlapTrackedReplacementSessionToken: session => session,
    resolveDocxReviewRoundKeyHandle: async () => { if (h.afterKey) { const fn = h.afterKey; h.afterKey = null; fn(); } return { state: h.keyState || 'ACTIVE' }; },
    verifyFullManuscriptCurrentSceneBindings: require('../../src/main/rtkDocxActivationGuards.cjs').verifyFullManuscriptCurrentSceneBindings,
    isPathInsideBoundary: (root, file) => path.dirname(file) === root,
    makeReviewExactTextApplyContextBlock: reason => ({ ok: false, reason }),
    publishReviewSceneWithProjectTransaction: () => { throw Error('ORDINARY_WRITER_MUST_NOT_RUN'); },
    normalizeReviewExactTextApplyString: value => typeof value === 'string' ? value.trim() : '',
  });
  vm.runInContext(main.slice(main.indexOf('function cleanLinkLabelStoreMatches('), main.indexOf('function mapMarkdownErrorCode(')), h.c);
  return { input, store, candidateDoc, apply: value => h.c.runReviewExactTextBatchSafeWriteFromMainState(() => { throw Error('FORGED_ORDINARY_WRITER'); }, value || input) };
}
test('actual main cleanR private candidate applies once, then history restores all rich metadata', async t => {
  const h = await harness(t); historyHarness(h); const r = returnHarness(h), original = h.working;
  const result = await r.apply(); assert.equal(result.ok, true, JSON.stringify(result)); assert.equal(h.writes, 1);
  assert.equal(core.readRegistry(envelope.parseObservablePayload(fs.readFileSync(h.file, 'utf8')).doc).bookmarks[0].state, 'deleted');
  const sync = await h.c.syncReviewExactTextApplyEditorFromMainState({ applyInput: r.input, receipt: result.receipt });
  assert.equal(sync.ok, true); assert.equal(h.working, fs.readFileSync(h.file, 'utf8'));
  assert.equal((await r.apply()).ok, false); assert.equal(h.writes, 1);
  const snapshotId = 'recovery-snapshot-' + path.basename(result.receipt.userBookmarkHistorySnapshot.snapshotPath).slice(-13);
  const preview = await h.c.handleHistoryRestorePreviewCommand({ projectId: 'p', nodeId: 'node-a', snapshotId });
  const restored = await h.c.handleHistoryRestoreApplyCommand({ confirmed: true, previewPlan: preview.previewPlan });
  assert.equal(restored.ok, true, JSON.stringify(restored)); assert.equal(h.working, original);
  assert.equal((await h.c.handleHistoryRestoreUndoCommand({ receiptId: restored.receipt.receiptId })).ok, true);
  assert.deepEqual(envelope.parseObservablePayload(h.working).doc, envelope.canonicalizeDocumentJson(r.candidateDoc));
});
for (const kind of ['publicCandidate', 'mixedBatch', 'foreignSession', 'inactiveKey', 'asyncSession', 'richSource', 'rawRegistry', 'diskCAS', 'capability']) {
  test(`actual cleanR private gate rejects ${kind} with zero writes`, async t => {
    const h = await harness(t); const r = returnHarness(h); let input = clone(r.input);
    if (kind === 'publicCandidate') input.userBookmarksCandidate = r.store.userBookmarksCandidate;
    if (kind === 'mixedBatch') input.reviewItems.push({ changeId: 'ordinary-text', replacementText: 'FORGED' });
    if (kind === 'foreignSession') h.c.activeReviewSessionStore.sourcePacketHash = 'foreign';
    if (kind === 'inactiveKey') h.keyState = 'REVOKED';
    if (kind === 'asyncSession') h.afterKey = () => { h.c.activeReviewSessionLifecycle = 'closed'; };
    if (kind === 'richSource' || kind === 'rawRegistry') {
      const changed = clone(seed());
      if (kind === 'richSource') changed.content[0].content[0].marks = [{ type: 'bold' }];
      else changed.attrs.wordUserBookmarks.bookmarks[0].name = 'Forged';
      h.working = envelope.composeObservablePayload({ doc: changed });
    }
    if (kind === 'diskCAS') fs.writeFileSync(h.file, envelope.composeObservablePayload({ doc: edit(seed(), 'XABCDEF') }));
    if (kind === 'capability') h.allowed = false;
    try { assert.equal((await r.apply(input)).ok, false); } catch (error) { assert.equal(kind, 'capability'); }
    assert.equal(h.writes, 0);
  });
}
test('cleanR asynchronous editor publication cannot erase typing after durable commit', async t => {
  const h = await harness(t); historyHarness(h); const r = returnHarness(h), result = await r.apply();
  h.generation = 1; h.c.lastSignaledEditGeneration = 1; h.working = envelope.composeObservablePayload({ doc: edit(seed(), 'XABCDEF') });
  const typed = h.working;
  assert.equal((await h.c.syncReviewExactTextApplyEditorFromMainState({ applyInput: r.input, receipt: result.receipt })).reason, 'RTK_USER_BOOKMARK_EDITOR_SYNC_STALE');
  assert.equal(h.working, typed); assert.equal(h.writes, 1);
});
for (const kind of ['typing', 'lifecycle', 'capability', 'diskCAS']) {
  test(`last asynchronous payload attachment cannot publish stale bookmark state after ${kind}`, async t => {
    for (const route of ['return', 'history']) {
      const h = await harness(t); historyHarness(h); const r = returnHarness(h), applied = await r.apply();
      assert.equal(applied.ok, true);
      const previous = h.working;
      h.c.attachProjectIdToEditorPayload = async payload => {
        await Promise.resolve();
        if (kind === 'typing') { h.generation = 1; h.c.lastSignaledEditGeneration = 1; h.working = 'UNSAVED_OWNER_TEXT'; }
        if (kind === 'lifecycle') h.subject = 'foreign';
        if (kind === 'capability') h.allowed = false;
        if (kind === 'diskCAS') fs.writeFileSync(h.file, 'EXTERNAL_CHANGED_SOURCE');
        return payload;
      };
      const result = route === 'return'
        ? await h.c.syncReviewExactTextApplyEditorFromMainState({ applyInput: r.input, receipt: applied.receipt })
        : await h.c.syncHistoryRestoreEditorFromMainState(h.file, 'restore', applied.receipt.revision, applied.receipt.bookmarkPublication);
      assert.equal(result.ok, false, route); assert.equal(h.working, kind === 'typing' ? 'UNSAVED_OWNER_TEXT' : previous); assert.equal(h.writes, 1);
    }
  });
}
test('actual main save maps inherited coordinates and ACK binds the durable transformed bytes', async t => {
  const h = await harness(t); h.working = envelope.composeObservablePayload({ doc: edit(seed(), 'XABCDEF') });
  h.generation = 1; h.c.lastSignaledEditGeneration = 1;
  const result = await h.save(); assert.equal(result.receipt.success, true, JSON.stringify(result));
  assert.equal(result.ack.kind, SAVE_ACK_KINDS.SAVED); assert.equal(h.dirty, false); assert.equal(h.writes, 1);
  assert.equal(h.working, fs.readFileSync(h.file, 'utf8'));
  assert.equal(core.readRegistry(envelope.parseObservablePayload(h.working).doc).bookmarks[0].start.offsetUtf16, 3);
});
test('actual query is read-only and rejects forged authority and asynchronous lifecycle changes', async t => {
  const h = await harness(t);
  const query = await h.c.handleUserBookmarkQuery({ requestId: 'query' });
  assert.equal(query.ok, true); assert.equal(query.expectedSceneSha256, hash(fs.readFileSync(h.file, 'utf8')));
  assert.equal(Object.hasOwn(query, 'filePath'), false); assert.equal(h.writes, 0);
  query.bookmarks[0].name = 'Forged';
  assert.equal(core.readRegistry(h.source().parsed.doc).bookmarks[0].name, 'Anchor');
  assert.equal((await h.c.handleUserBookmarkQuery({ sourcePath: h.file })).ok, false);
  const read = h.c.readUserBookmarkContext;
  h.c.readUserBookmarkContext = async () => { const result = await read(); h.subject = 'foreign'; return result; };
  assert.equal((await h.c.handleUserBookmarkQuery({})).reason, 'USER_BOOKMARK_QUERY_STALE'); assert.equal(h.writes, 0);
});
test('query revalidates capability and lifecycle after its final filesystem await', async t => {
  for (const kind of ['capability', 'lifecycle']) {
    const h = await harness(t);
    h.c.fs = { ...fs.promises, readFile: async (...args) => {
      const raw = await fs.promises.readFile(...args);
      if (kind === 'capability') h.allowed = false; else h.subject = 'foreign';
      return raw;
    } };
    const result = await h.c.handleUserBookmarkQuery({});
    assert.equal(result.ok, false); assert.equal(result.available, false); assert.equal(h.writes, 0);
  }
});
test('typing during save rejects stale metadata ACK and private CAS receipt permits subsequent save', async t => {
  const h = await harness(t); h.working = envelope.composeObservablePayload({ doc: edit(seed(), 'XABCDEF') }); h.generation = 1;
  h.afterWrite = () => { h.working = envelope.composeObservablePayload({ doc: edit(seed(), 'XYABCDEF') }); h.generation = 2; h.c.lastSignaledEditGeneration = 2; };
  const first = await h.save(); assert.equal(first.ack.reason, 'USER_BOOKMARK_PUBLICATION_STALE'); assert.equal(h.dirty, true);
  assert.equal(envelope.parseObservablePayload(h.working).text, 'XYABCDEF');
  const next = await h.save(); assert.equal(next.receipt.success, true, JSON.stringify(next)); assert.equal(next.ack.kind, SAVE_ACK_KINDS.SAVED, JSON.stringify(next));
  assert.equal(core.readRegistry(envelope.parseObservablePayload(h.working).doc).bookmarks[0].start.offsetUtf16, 4);
});
test('actual Kernel authoring create survives postcommit typing race and remains saveable', async t => {
  const h = await harness(t, doc('ABCDEF'));
  h.afterWrite = () => { h.working = envelope.composeObservablePayload({ doc: doc('XABCDEF') }); h.generation = 1; h.c.lastSignaledEditGeneration = 1; };
  const result = await h.command('create', { name: 'Цель_Ω', selectionStart: 2, selectionEnd: 5 });
  assert.equal(result.ok, false); assert.equal(result.details.storageWritten, true, JSON.stringify(result)); assert.equal(h.writes, 1);
  assert.equal(envelope.parseObservablePayload(h.working).text, 'XABCDEF');
  const next = await h.save(); assert.equal(next.receipt.success, true, JSON.stringify(next)); assert.equal(next.ack.kind, SAVE_ACK_KINDS.SAVED, JSON.stringify(next));
  const record = core.readRegistry(envelope.parseObservablePayload(h.working).doc).bookmarks[0];
  assert.equal(record.name, 'Цель_Ω'); assert.equal(record.start.offsetUtf16, 3);
});
test('first create preserves captured Tiptap default attributes and receives exact byte ACK', async t => {
  const h = await harness(t, doc('ABCDEF'));
  const live = doc('ABCDEF'); live.attrs = { wordPendingRevisions: null, wordUserBookmarks: null };
  live.content[0].attrs = { textAlign: null };
  h.working = envelope.composeObservablePayload({ doc: live });
  const result = await h.command('create', { name: 'First', selectionStart: 2, selectionEnd: 5 });
  assert.equal(result.ok, true, JSON.stringify(result)); assert.equal(h.writes, 1);
  const saved = envelope.parseObservablePayload(fs.readFileSync(h.file, 'utf8'));
  assert.equal(saved.doc.attrs.wordPendingRevisions, null); assert.equal(saved.doc.content[0].attrs.textAlign, null);
  assert.equal(h.working, fs.readFileSync(h.file, 'utf8')); assert.equal(h.dirty, false);
});
test('first bookmark on genuine legacy durably preserves exact readable prior bytes before the atomic writer', async t => {
  const h = await harness(t, doc('ABCDEF')), legacy = h.working;
  assert.equal(envelope.parseObservablePayload(legacy).payloadVersion, 2);
  const result = await h.command('create', { name: 'First', selectionStart: 2, selectionEnd: 5 });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(envelope.parseObservablePayload(h.working).payloadVersion, 3);
  const paths = await h.c.loadMarkdownIoModule().then(io => io.listRecoverySnapshots(h.file));
  assert.equal(paths.length, 1); assert.equal(fs.readFileSync(paths[0], 'utf8'), legacy);
  assert.equal(h.working, fs.readFileSync(h.file, 'utf8')); assert.equal(h.dirty, false); assert.equal(h.writes, 1);
});
test('manufactured legacy registry cannot bypass declared format at the Main writer', async t => {
  const h = await harness(t), json = envelope.serializeDocumentJson(seed());
  const legacy = `[doc-v2 length=${json.length}]\n${json}`;
  fs.writeFileSync(h.file, legacy); h.working = legacy;
  const result = await h.save(); assert.equal(result.receipt.success, false);
  assert.equal(h.writes, 0); assert.equal(fs.readFileSync(h.file, 'utf8'), legacy);
  assert.equal((await h.c.handleUserBookmarkQuery()).available, false);
});
test('failed pre-upgrade recovery and future payload prevent all scene publication', async t => {
  const h = await harness(t, doc('ABCDEF'));
  h.c.loadMarkdownIoModule = async () => ({ listRecoverySnapshots: async () => [], createRecoverySnapshot: async () => ({ snapshotCreated: false, synced: false }) });
  const original = fs.readFileSync(h.file, 'utf8');
  assert.equal((await h.command('create', { name: 'First', selectionStart: 2, selectionEnd: 5 })).ok, false);
  assert.equal(h.writes, 0); assert.equal(fs.readFileSync(h.file, 'utf8'), original);
  const json = JSON.stringify({ format: 'yalken.scene-document', version: 4, requiredFeatures: ['word-user-bookmarks.v1'] }) + '\n' + envelope.serializeDocumentJson(seed());
  const future = `[doc-v2 length=${json.length}]\n${json}`;
  h.working = future;
  assert.ok(envelope.parseObservablePayload(future).issue);
  assert.equal((await h.save()).receipt.success, false); assert.equal(h.writes, 0);
});
test('copy resolves private active endpoints and gives an independent stable ID on the same range', async t => {
  const h = await harness(t), source = core.readRegistry(seed()).bookmarks[0];
  const result = await h.command('copy', { bookmarkId: source.id, name: 'Independent' });
  assert.equal(result.ok, true, JSON.stringify(result));
  const records = core.readRegistry(envelope.parseObservablePayload(h.working).doc).bookmarks;
  assert.equal(records.length, 2); assert.notEqual(records[0].id, records[1].id);
  assert.deepEqual(records[0].start, records[1].start); assert.deepEqual(records[0].end, records[1].end);
  for (const input of [{ bookmarkId: 'foreign', name: 'Unknown' }, { bookmarkId: source.id, name: 'anchor' }]) {
    const before = h.writes; assert.equal((await h.command('copy', input)).ok, false); assert.equal(h.writes, before);
  }
});
for (const kind of ['capability', 'generation', 'registry', 'malformed', 'sourceCAS', 'lifecycle']) {
  test(`main save and Kernel guard ${kind} without unauthorized writes`, async t => {
    const h = await harness(t);
    if (kind === 'capability') { h.allowed = false; assert.equal((await h.command('delete', { bookmarkId: core.readRegistry(seed()).bookmarks[0].id })).ok, false); }
    else if (kind === 'generation') { h.c.lastSignaledEditGeneration = 2; assert.equal((await h.command('rename', { bookmarkId: core.readRegistry(seed()).bookmarks[0].id, name: 'Other' })).ok, false); }
    else if (kind === 'registry' || kind === 'malformed') {
      const modified = clone(seed()); modified.attrs.wordUserBookmarks.revision++;
      h.working = envelope.composeObservablePayload({ doc: modified });
      if (kind === 'malformed') h.working = h.working.replace('"bookmarks":[', '"bookmarks":[').replace('"Anchor"', '"YRTK_bad"');
      assert.equal((await h.save()).receipt.success, false);
    } else {
      h.working = envelope.composeObservablePayload({ doc: edit(seed(), 'XABCDEF') }); h.generation = 1;
      h.afterWrite = () => { h.working = envelope.composeObservablePayload({ doc: edit(seed(), 'XYABCDEF') }); h.generation = 2; };
      await h.save(); assert.equal(h.writes, 1);
      if (kind === 'sourceCAS') fs.writeFileSync(h.file, envelope.composeObservablePayload({ doc: core.planMutation({ doc: seed(), action: 'rename', bookmarkId: core.readRegistry(seed()).bookmarks[0].id, name: 'Foreign', requestId: 'foreign' }).doc }));
      else h.subject = 'foreign';
      assert.equal((await h.save()).receipt.success, false); assert.equal(h.writes, 1); return;
    }
    assert.equal(h.writes, 0);
  });
}

const { buildStoredZip, buildDocxMinBuffer } = require('../../src/export/docx/docxMinBuilder.js');
const { buildFullManuscriptDocxReviewPacketSource } = require('../../src/export/docx/fullManuscriptDocxReviewPacketSource.js');
const { buildDocxReviewPacketBuffer, REVIEW_DOCX_TYPOGRAPHY_DEFAULTS } = require('../../src/export/docx/docxReviewPacketBuilder.js');
const fixture = require('../fixtures/word-user-bookmarks-native-v1.json');
const bytesOf = parts => buildStoredZip(Object.entries(parts).map(([name,data]) => ({ name, data })));
const cryptoPort = { sha256Text: text => 'sha256:' + hash(text), sha256Json: value => 'sha256:' + hash(JSON.stringify(value)), byteLength: Buffer.byteLength };
async function wordHarness() {
  const io = await import('../../src/io/revisionBridge/index.mjs');
  const analyzer = await import('../../src/io/revisionBridge/reviewTransportUserBookmarksV1.mjs');
  const [docxPageSetupBindModule, semanticMappingModule, styleMapModule] = await Promise.all([
    import('../../src/docxPageSetupBind.mjs'), import('../../src/derived/semanticMapping.mjs'), import('../../src/derived/styleMap.mjs'),
  ]);
  const read = bytes => {
    const plan = io.buildDocxImportPreviewPlanFromContentPreview(io.buildDocxContentPreviewFromZipBytes(bytes));
    assert.equal(plan.ok, true, JSON.stringify(plan).slice(0, 1000));
    assert.equal(plan.code, 'DOCX_IMPORT_PREVIEW_READY');
    return envelope.parseObservablePayload(plan.candidateCreatePlan.entries[0].content).doc;
  };
  return { io, analyzer, read, minimum: doc => buildDocxMinBuffer({ doc, bookProfile: { formatId: 'A4' }, plainText: envelope.deriveVisibleTextFromDocument(doc) },
    { docxPageSetupBindModule, semanticMappingModule, styleMapModule }) };
}
test('all 17 genuine Word inventories survive G and minimal Y0 with distinct target occurrences', async () => {
  const w = await wordHarness();
  for (const sample of fixture.snapshots) {
    assert.equal(hash(sample.parts['word/document.xml']), sample.documentXmlSha256.replace(/^sha256:/, ''));
    const imported = w.read(bytesOf({ ...fixture.sharedParts, ...sample.parts }));
    const registry = core.readRegistry(imported);
    const actual = registry?.bookmarks.filter(record => record.state === 'active').map(({ name,start,end }) => ({ name,start,end })) || [];
    const expected = sample.expected.bookmarks.map(({ name,start,end }) => ({ name,start,end }));
    assert.deepEqual(actual.sort((a,b) => a.name.localeCompare(b.name)), expected.sort((a,b) => a.name.localeCompare(b.name)), sample.name);
    let returned = imported;
    for (let round = 0; round < 3; round++) {
      returned = w.read(w.minimum(returned));
      const next = core.readRegistry(returned)?.bookmarks.filter(record => record.state === 'active').map(({name,start,end}) => ({name,start,end})) || [];
      assert.deepEqual(next.sort((a,b) => a.name.localeCompare(b.name)), expected, `${sample.name} round ${round}`);
      assert.equal(envelope.deriveVisibleTextFromDocument(returned), envelope.deriveVisibleTextFromDocument(imported));
    }
  }
});
test('full product export retained transport self-return and clean target/delete/label changes pass Core', async () => {
  const w = await wordHarness();
  const sample = fixture.snapshots.find(item => item.name.startsWith('04-'));
  const baselineDoc = w.read(bytesOf({ ...fixture.sharedParts, ...sample.parts }));
  const product = buildFullManuscriptDocxReviewPacketSource({ projectId: 'p', projectRoot: '/synthetic', manifestPath: '/synthetic/manifest.json',
    scenes: [{ sceneId: 'a.txt', scenePath: '/synthetic/a.txt', order: 0, title: 'A', doc: baselineDoc,
      text: envelope.deriveVisibleTextFromDocument(baselineDoc), observableContent: envelope.composeObservablePayload({ doc: baselineDoc }) }] },
  { createdAtUtc: '2026-09-30T09:00:00.000Z', roundIdHex: 'a'.repeat(32), keyIdHex: 'b'.repeat(32), hmacSecret: 'synthetic-test-key-only' });
  const original = buildDocxReviewPacketBuffer(product);
  const privateMap = w.io.bindUserBookmarkExportTransportPartsV1(product.localAuthorityCapsule.exportMap, original);
  const parts = w.io.extractDocxReviewTransportPackagePartsFromZipBytes({ bytes: original }).parts;
  for (const kind of ['unchanged', 'retarget', 'delete', 'label', 'rename', 'alter-technical', 'foreign-part', 'alter-relationship', 'old-baseline']) {
    const changed = { ...parts }; let xml = changed['word/document.xml'];
    if (kind === 'retarget') xml = xml.replace('w:anchor="UserTwinA"', 'w:anchor="UserTwinB"');
    if (kind === 'label') xml = xml.replace('Link One', 'Edited One');
    if (kind === 'rename') xml = xml.replace('w:name="UserTwinA"', 'w:name="NewName"').replace('w:anchor="UserTwinA"', 'w:anchor="NewName"');
    if (kind === 'delete') { const start = xml.match(/<w:bookmarkStart w:id="(\d+)" w:name="UserTwinA"\/>/);
      assert.ok(start); xml = xml.replace(start[0], '').replace(`<w:bookmarkEnd w:id="${start[1]}"/>`, ''); }
    changed['word/document.xml'] = xml;
    if (kind === 'alter-technical') changed['customXml/item1.xml'] = changed['customXml/item1.xml'].replace('encoding="json"', 'encoding="xml"');
    if (kind === 'foreign-part') changed['customXml/foreign.xml'] = changed['customXml/item1.xml'];
    if (kind === 'alter-relationship') changed['customXml/_rels/item1.xml.rels'] = changed['customXml/_rels/item1.xml.rels'].replace('rIdYrtkCustomXmlProps', 'changed');
    const seen = w.io.buildDocxReviewTransportAnalysisFromZipBytes({ bytes: bytesOf(changed) }, { cryptoPort });
    const result = w.analyzer.analyzeUserBookmarksReturn({ baselineDoc, exportMap: kind === 'old-baseline' ? { scenes: privateMap.scenes } : privateMap,
      sceneId: 'a.txt', reviewIr: seen.reviewIr, exportTypography: REVIEW_DOCX_TYPOGRAPHY_DEFAULTS });
    const expected = ['unchanged', 'retarget', 'delete', 'label'].includes(kind);
    assert.equal(result.ok, expected, `${kind}: ${result.detail}`);
    if (expected) {
      const plan = core.planReturn({ beforeDoc: baselineDoc, candidateDoc: result.doc });
      assert.equal(plan.changed, kind !== 'unchanged');
      if (kind === 'delete') {
        const deleted = plan.registry.bookmarks.find(record => record.name === 'UserTwinA');
        assert.equal(deleted.state, 'deleted');
        assert.throws(() => core.planMutation({ doc: plan.doc, action: 'create', name: 'usertwina', start: endpoint(0), end: endpoint(0),
          requestId: 'reuse', projectId: 'p', sceneId: 'a.txt' }), /USER_BOOKMARK_LINKED_TOMBSTONE_NAME_RESERVED/);
      }
    }
  }
});

function installActualRendererPublication(h, editor, api) {
  const tiptap = fs.readFileSync(path.join(__dirname, '../../src/renderer/tiptap/index.js'), 'utf8');
  const renderer = fs.readFileSync(path.join(__dirname, '../../src/renderer/editor.js'), 'utf8');
  assert.match(renderer, /initTiptap\(editor, \{\s*attachIpc: false/);
  editor.getJSON = () => editor.state.doc.toJSON();
  editor.getText = () => editor.state.doc.textBetween(0, editor.state.doc.content.size, '\n');
  const observable = envelope.parseObservablePayload(h.working);
  const r = vm.createContext({ currentEditorInstance: editor, currentIpcSession: null,
    applyUserBookmarkPublication: api.applyUserBookmarkPublication, ...envelope,
    isTiptapMode: true, centralSheetStripLargePayloadFastPathActive: false,
    metaEnabled: observable.hasMetaBlock, currentMeta: observable.meta, currentCards: observable.cards,
    localEditGeneration: h.generation,
    window: { electronAPI: { onEditorSetText(fn) { r.onEditorSetText = fn; } } },
  });
  const slice = (source, from, to) => source.slice(source.indexOf(from), source.indexOf(to)).replace(/^export /, '');
  vm.runInContext(slice(tiptap, 'function readEditorText(', 'function notifyDirtyState('), r);
  vm.runInContext(slice(tiptap, 'function readEditorDocument(', 'function normalizeFormattingColor('), r);
  vm.runInContext(slice(tiptap, 'export function getTiptapDocumentSnapshot(', 'export function setTiptapDocumentSnapshot('), r);
  vm.runInContext(slice(tiptap, 'export function applyTiptapUserBookmarkPublication(', 'function readEditorText('), r);
  vm.runInContext(slice(renderer, 'function composeDocumentContent(', 'function composeEditorSnapshot('), r);
  const callbackStart = renderer.indexOf('window.electronAPI.onEditorSetText((payload) => {');
  const callbackEnd = renderer.indexOf('    cancelLinkDialog();', callbackStart);
  vm.runInContext(renderer.slice(callbackStart, callbackEnd) + '});', r);
  h.renderer = r;
  h.capture = () => { h.working = r.composeDocumentContent(); };
  h.c.mainWindow.webContents.send = (channel, payload) => {
    assert.equal(channel, 'editor:set-text'); h.publications.push(payload);
    r.localEditGeneration = h.generation;
    r.onEditorSetText(payload); h.capture();
  };
  return r;
}

async function linkedPmHarness(t) {
  const { getSchema } = await import('@tiptap/core'), { default: StarterKit } = await import('@tiptap/starter-kit');
  const { EditorState } = await import('@tiptap/pm/state'), { history, undo, redo } = await import('@tiptap/pm/history');
  const api = await import('../../src/renderer/tiptap/userBookmarks.mjs');
  const initial = core.planMutation({ doc: doc('ABCDEF'), action: 'create', name: 'Anchor', start: endpoint(0), end: endpoint(6),
    requestId: 'pm-seed', projectId: 'p', sceneId: 'a.txt' }).doc, record = core.readRegistry(initial).bookmarks[0];
  initial.content[0].content[0].marks = [{ type: 'link', attrs: core.linkAttrs(record) }];
  const schema = getSchema([StarterKit.configure({ link: false, undoRedo: false }), api.UserBookmarks, api.UserBookmarkLink]);
  const editor = { schema, state: EditorState.create({ schema, doc: schema.nodeFromJSON(initial), plugins: [history()] }) };
  editor.view = { dispatch: tr => { editor.state = editor.state.apply(tr); } };
  const h = await harness(t, editor.state.doc.toJSON());
  h.pm = editor; h.record = record;
  installActualRendererPublication(h, editor, api);
  h.undo = () => { assert.equal(undo(editor.state, editor.view.dispatch), true); h.generation++; h.capture(); };
  h.redo = () => { assert.equal(redo(editor.state, editor.view.dispatch), true); h.generation++; h.capture(); };
  h.deleteCharacter = () => { editor.view.dispatch(editor.state.tr.delete(2, 3)); h.generation++; h.capture(); };
  return h;
}

test('actual PM delete/save/rename/text Undo/Redo saves exact current targets and survives restart', async t => {
  const h = await linkedPmHarness(t);
  h.deleteCharacter(); assert.equal(h.pm.state.doc.textContent, 'ACDEF');
  const firstSave = await h.save(); assert.equal(firstSave.receipt.success, true, firstSave.receipt.error); assert.equal(firstSave.ack.kind, 'SAVED');
  assert.equal((await h.command('rename', { bookmarkId: h.record.id, name: 'Renamed' })).ok, true);
  h.undo(); assert.equal(h.pm.state.doc.textContent, 'ABCDEF');
  assert.ok(h.pm.state.doc.toJSON().content[0].content.some(node => node.marks[0].attrs.wordBookmarkName === 'Anchor'));
  const saved = await h.save(); assert.equal(saved.receipt.success, true, saved.receipt.error); assert.equal(saved.ack.kind, 'SAVED');
  assert.deepEqual(clone(saved.receipt.bookmarkPublication.bookmarkId), [h.record.id]);
  for (const node of h.pm.state.doc.toJSON().content[0].content) assert.equal(node.marks[0].attrs.href, '#Renamed');
  h.redo(); assert.equal(h.pm.state.doc.textContent, 'ACDEF'); assert.equal((await h.save()).ack.kind, 'SAVED');
  h.undo(); assert.equal((await h.save()).ack.kind, 'SAVED');
  const durable = fs.readFileSync(h.file, 'utf8'), restarted = await harness(t, envelope.parseObservablePayload(durable).doc);
  assert.equal((await restarted.save()).receipt.success, true);
  assert.equal(fs.readFileSync(restarted.file, 'utf8'), durable);
});

test('private rename lineage accumulates exact aliases without redirecting a reused name to another ID', async t => {
  const h = await linkedPmHarness(t); h.deleteCharacter(); assert.equal((await h.save()).ack.kind, 'SAVED');
  for (const name of ['Middle', 'Renamed']) assert.equal((await h.command('rename', { bookmarkId: h.record.id, name })).ok, true);
  assert.equal((await h.command('create', { name: 'Anchor', selectionStart: 0, selectionEnd: 1 })).ok, true);
  const other = core.readRegistry(h.pm.state.doc.toJSON()).bookmarks.find(record => record.name === 'Anchor');
  assert.notEqual(other.id, h.record.id);
  h.undo(); const saved = await h.save(); assert.equal(saved.receipt.success, true, saved.receipt.error);
  for (const node of h.pm.state.doc.toJSON().content[0].content) {
    assert.equal(node.marks[0].attrs.wordBookmarkId, h.record.id); assert.equal(node.marks[0].attrs.wordBookmarkName, 'Renamed');
  }
});

for (const kind of ['lifecycle', 'session', 'disk', 'public', 'mismatchedPair']) test(`rename receipt ${kind} cannot authorize stale/forged text save`, async t => {
  const h = await linkedPmHarness(t); h.deleteCharacter(); assert.equal((await h.save()).ack.kind, 'SAVED');
  assert.equal((await h.command('rename', { bookmarkId: h.record.id, name: 'Renamed' })).ok, true); h.undo();
  const writes = h.writes;
  if (kind === 'lifecycle') h.subject = 'other';
  if (kind === 'session') h.c.commentAuthoringSessionId = 'other';
  if (kind === 'disk') fs.appendFileSync(h.file, '\nforeign');
  if (kind === 'public') {
    vm.runInContext('userBookmarkRenameLineage = null', h.c);
    const raw = envelope.parseObservablePayload(h.working), forged = raw.doc;
    forged.attrs.renameLineage = [{ bookmarkId: h.record.id, oldName: 'Anchor' }];
    h.working = envelope.composeObservablePayload({ doc: forged });
  }
  if (kind === 'mismatchedPair') {
    const raw = envelope.parseObservablePayload(h.working);
    raw.doc.content[0].content.find(node => node.marks[0].attrs.wordBookmarkName === 'Anchor').marks[0].attrs.href = '#Renamed';
    h.working = envelope.composeObservablePayload({ doc: raw.doc });
  }
  const result = await h.save(); assert.equal(result.receipt.success, false); assert.equal(h.writes, writes);
});

function backupHarness(h) {
  const manager = require('../../src/utils/backupManager');
  h.backupWrites = 0;
  Object.assign(h.c, { backupHashes: new Map(), getBackupBasePathForFile: () => path.dirname(h.file),
    backupManager: { createBackup: async (...args) => { h.backupWrites++; return manager.createBackup(...args); } },
    updateStatus: () => {}, logDevError: (label, error) => { h.backupError = error.message; },
  });
  vm.runInContext(main.slice(main.indexOf('async function prepareUserBookmarkBackup('), main.indexOf('async function handleSave(')), h.c);
}

test('actual PM Undo backup before autosave contains all text and canonical links readable and saveable in a fresh process', async t => {
  const h = await linkedPmHarness(t); backupHarness(h);
  h.deleteCharacter(); assert.equal((await h.save()).ack.kind, 'SAVED');
  assert.equal((await h.command('rename', { bookmarkId: h.record.id, name: 'Renamed' })).ok, true);
  h.undo(); const unsaved = h.working, disk = fs.readFileSync(h.file, 'utf8'), writes = h.writes;
  await h.c.createBackup(); assert.equal(h.backupWrites, 1, h.backupError); assert.equal(h.writes, writes);
  assert.equal(h.working, unsaved); assert.equal(fs.readFileSync(h.file, 'utf8'), disk);
  const backups = path.join(path.dirname(h.file), 'backups', hash(h.file));
  const file = fs.readdirSync(backups).find(name => name !== 'meta.json');
  const backupPath = path.join(backups, file), recovered = envelope.parseObservablePayload(fs.readFileSync(backupPath, 'utf8'));
  assert.equal(envelope.deriveVisibleTextFromDocument(recovered.doc), 'ABCDEF');
  for (const node of recovered.doc.content[0].content) assert.equal(node.marks[0].attrs.wordBookmarkName, 'Renamed');
  const script = `const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm'),assert=require('node:assert/strict');
    const core=require('./src/core/word-user-bookmarks-v1.cjs'),envelope=require('./src/core/document-content-envelope-v1.cjs'),pending=require('./src/core/word-pending-text-revisions-v1.cjs');
    const {bindSaveReceiptToAck}=require('./src/core/save-receipt-ack-v1.cjs'),{SAVE_ACK_KINDS}=require('./src/core/dirty-admission-v1.cjs'),{TRANSACTION_PHASE_CHAIN}=require('./src/core/project-transaction-v1.cjs'),{createCommandSurfaceKernel}=require('./src/command/commandSurfaceKernel.js');
    const runtimeRequire=require('node:module').createRequire(require('node:path').resolve('test/contracts/rtk-word-user-bookmarks-runtime.contract.test.js'));const requireHarness=runtimeRequire;
    const main=fs.readFileSync('./src/main.js','utf8'),clone=v=>JSON.parse(JSON.stringify(v)),hash=v=>crypto.createHash('sha256').update(v).digest('hex');
    ${harness.toString().replace(/require\(/g, 'requireHarness(')}
    (async()=>{const cleanup=[];const t={after:fn=>cleanup.push(fn)};try {
      const recovered=envelope.parseObservablePayload(fs.readFileSync(process.env.YALKEN_TEST_BACKUP,'utf8'));
      const h=await harness(t,recovered.doc);const result=await h.save();
      assert.equal(result.receipt.success,true,result.receipt.error);assert.equal(h.writes,1);
      process.stdout.write(JSON.stringify({text:envelope.deriveVisibleTextFromDocument(h.source().parsed.doc),
        registry:core.readRegistry(h.source().parsed.doc),writes:h.writes}));
    }finally{cleanup.forEach(fn=>fn())}})().catch(e=>{console.error(e);process.exitCode=1});`;
  const child = require('node:child_process').spawnSync(process.execPath, ['-e', script], {
    cwd: path.resolve(__dirname, '../..'), env: { ...process.env, YALKEN_TEST_BACKUP: backupPath }, encoding: 'utf8',
  });
  assert.equal(child.status, 0, child.stderr); const result = JSON.parse(child.stdout);
  assert.equal(result.text, 'ABCDEF'); assert.equal(result.registry.bookmarks[0].name, 'Renamed'); assert.equal(result.writes, 1);
});

for (const kind of ['lifecycle', 'generation', 'disk', 'forgedPair', 'noReceipt']) test(`backup ${kind} counterexample cannot persist an unbound recovery document`, async t => {
  const h = await linkedPmHarness(t); backupHarness(h); h.deleteCharacter(); assert.equal((await h.save()).ack.kind, 'SAVED');
  assert.equal((await h.command('rename', { bookmarkId: h.record.id, name: 'Renamed' })).ok, true); h.undo();
  if (kind === 'lifecycle') h.subject = 'other';
  if (kind === 'generation') h.c.lastSignaledEditGeneration = h.generation + 1;
  if (kind === 'disk') fs.appendFileSync(h.file, '\nforeign');
  if (kind === 'noReceipt') vm.runInContext('userBookmarkRenameLineage = null', h.c);
  if (kind === 'forgedPair') {
    const parsed = envelope.parseObservablePayload(h.working);
    parsed.doc.content[0].content.find(node => node.marks[0].attrs.wordBookmarkName === 'Anchor').marks[0].attrs.href = '#Forged';
    h.working = envelope.composeObservablePayload({ doc: parsed.doc });
  }
  const writes = h.writes; await h.c.createBackup(); assert.equal(h.backupWrites, 0); assert.equal(h.writes, writes);
  assert.ok(h.backupError);
});

test('existing ordinary backup retains bytes without introducing bookmark metadata', async t => {
  const h = await harness(t, doc('ABCDEF')); backupHarness(h);
  const raw = h.working; await h.c.createBackup(); assert.equal(h.backupWrites, 1, h.backupError);
  const folder = path.join(path.dirname(h.file), 'backups', hash(h.file));
  const file = fs.readdirSync(folder).find(name => name !== 'meta.json');
  assert.equal(fs.readFileSync(path.join(folder, file), 'utf8'), raw); assert.equal(h.writes, 0);
});

for (const kind of ['lifecycle', 'capability', 'generation']) test(`metadata ACK rechecks ${kind} after its final disk await`, async t => {
  const h = await harness(t); h.working = envelope.composeObservablePayload({ doc: edit(seed(), 'XABCDEF') }); h.generation = 1;
  h.afterWrite = () => {
    const previous = h.c.fs.readFile; let reads = 0;
    h.c.fs = { ...fs.promises, readFile: async (...args) => {
      const value = await previous(...args);
      if (++reads !== 2) return value;
      if (kind === 'lifecycle') h.subject = 'other';
      if (kind === 'capability') h.allowed = false;
      if (kind === 'generation') h.c.lastSignaledEditGeneration = 2;
      return value;
    } };
  };
  const result = await h.save(); assert.equal(result.receipt.success, true); assert.equal(h.writes, 1);
  assert.equal(result.ack.kind, 'NOT_SAVED'); assert.equal(h.dirty, true);
});

for (const kind of ['lifecycle', 'capability', 'generation', 'disk']) test(`backup queue rechecks ${kind} immediately before its port`, async t => {
  const h = await linkedPmHarness(t); backupHarness(h); h.deleteCharacter(); assert.equal((await h.save()).ack.kind, 'SAVED');
  assert.equal((await h.command('rename', { bookmarkId: h.record.id, name: 'Renamed' })).ok, true); h.undo();
  h.c.queueDiskOperation = async fn => {
    if (kind === 'lifecycle') h.subject = 'other';
    if (kind === 'capability') h.allowed = false;
    if (kind === 'generation') h.c.lastSignaledEditGeneration = h.generation + 1;
    if (kind === 'disk') fs.appendFileSync(h.file, '\nforeign');
    return fn();
  };
  const writes = h.writes; await h.c.createBackup(); assert.equal(h.backupWrites, 0); assert.equal(h.writes, writes); assert.ok(h.backupError);
});

test('persisted out-of-scene endpoints cannot publish authoring inventory or enter the scene writer', async t => {
  const h = await harness(t), invalid = seed();
  invalid.attrs.wordUserBookmarks.bookmarks[0].start.offsetUtf16 = 999999;
  invalid.attrs.wordUserBookmarks.bookmarks[0].end.offsetUtf16 = 999999;
  const raw = envelope.composeObservablePayload({ doc: invalid }); fs.writeFileSync(h.file, raw); h.working = raw;
  // Working decoding deliberately tolerates old endpoint coordinates while text
  // is being edited. Persisted-source Core validation is the write boundary.
  assert.equal(envelope.parseObservablePayload(raw).issue, null);
  assert.equal((await h.c.handleUserBookmarkQuery()).available, false);
  const saved = await h.save(); assert.equal(saved.receipt.success, false); assert.equal(h.writes, 0);
  assert.equal(fs.readFileSync(h.file, 'utf8'), raw);
});

for (const action of ['rename', 'return', 'history']) for (const kind of ['capability', 'lifecycle', 'generation']) {
  test(`${action} checks ${kind} after final source read before scene publication`, async t => {
    const h = await harness(t); let invoke;
    if (action === 'rename') {
      const record = core.readRegistry(h.source().parsed.doc).bookmarks[0];
      invoke = () => h.command('rename', { bookmarkId: record.id, name: 'Changed' });
    } else if (action === 'return') {
      const r = returnHarness(h); invoke = () => r.apply();
    } else {
      historyHarness(h);
      const snapshotPath = path.join(path.dirname(h.file), '.a.txt.bak.1000000000000'); fs.writeFileSync(snapshotPath, 'ABCDEF');
      invoke = async () => {
        try { await h.c.publishUserBookmarkHistorySnapshot(h.file, h.source().raw, 'ABCDEF', snapshotPath,
          async () => ({ ok: true, filePath: h.file })); return { ok: true }; }
        catch (error) { return { ok: false, reason: error.message }; }
      };
    }
    // First source read in return verifies baseline; next read is its final
    // publication guard. CRUD context is provided by the owned harness above.
    let reads = 0;
    h.c.fs = { ...fs.promises, readFile: async (...args) => {
      const raw = await fs.promises.readFile(...args);
      if (args[0] === h.file && ++reads === (action === 'return' ? 2 : 1)) {
        if (kind === 'capability') h.allowed = false;
        if (kind === 'lifecycle') { h.subject = 'other'; if (action === 'return') h.c.activeReviewSessionLifecycle = 'inactive'; }
        if (kind === 'generation') h.c.lastSignaledEditGeneration = 1;
      }
      return raw;
    } };
    const result = await invoke(); assert.equal(result.ok, false, JSON.stringify(result)); assert.equal(h.writes, 0);
  });
}

for (const kind of ['disk', 'lifecycle', 'capability', 'generation']) test(`metadata pre-send ${kind} race publishes nothing and preserves dirty risk`, async t => {
  const h = await harness(t); h.working = envelope.composeObservablePayload({ doc: edit(seed(), 'XABCDEF') }); h.generation = 1;
  const captured = h.working;
  h.afterWrite = () => {
    const previous = h.c.fs.readFile;
    h.c.fs = { ...fs.promises, readFile: async (...args) => {
      if (kind === 'disk') fs.writeFileSync(h.file, 'newer durable content');
      const raw = await previous(...args);
      if (kind === 'lifecycle') h.subject = 'other';
      if (kind === 'capability') h.allowed = false;
      if (kind === 'generation') h.c.lastSignaledEditGeneration = 2;
      return raw;
    } };
  };
  const result = await h.save(); assert.equal(result.receipt.success, true); assert.equal(result.ack.kind, 'NOT_SAVED');
  assert.equal(h.publications.length, 0); assert.equal(h.working, captured); assert.equal(h.dirty, true);
  if (kind === 'disk') assert.equal(fs.readFileSync(h.file, 'utf8'), 'newer durable content');
});

test('actual renderer runtime catalog registers five visible/typed writer commands and real IPC publishes first bookmark', async t => {
  const h = await harness(t, doc('ABCDEF'));
  const { registerProjectCommands } = await import('../../src/renderer/commands/projectCommands.mjs');
  const { CAPABILITY_BINDING } = await import('../../src/renderer/commands/capabilityPolicy.mjs');
  const records = new Map();
  registerProjectCommands({ registerCommand(meta, handler) {
    assert.equal(records.has(meta.id), false, meta.id); records.set(meta.id, { meta, handler });
  } }, { electronAPI: { invokeUiCommandBridge: request => h.ipc(null, {
    v: 1, correlationId: 'actual-renderer-ipc', issuedAt: new Date().toISOString(), ...request,
  }) } });
  for (const action of ['managePrompt', 'create', 'copy', 'rename', 'delete']) {
    const id = 'cmd.project.bookmarks.' + action;
    assert.ok(records.has(id)); assert.equal(CAPABILITY_BINDING[id], 'cap.project.bookmarks.authoring');
    assert.equal(require('../../src/core/entitlement-law-v1.cjs').decideCommandEntitlement(id, 'free').available, true);
    assert.equal(require('../../src/shared/productCommandRegistry.cjs').PRODUCT_COMMAND_ID_SET.has(id), false);
    assert.equal(require('../../src/command/commandSurfaceKernel.js').ALLOWED_COMMAND_IDS.includes(id), false);
  }
  assert.deepEqual(clone(records.get('cmd.project.bookmarks.managePrompt').meta.surface), ['palette']);
  assert.equal((await records.get('cmd.project.bookmarks.managePrompt').handler()).ok, true);
  assert.equal(h.prompt, 'cmd.project.bookmarks.managePrompt'); assert.equal(h.writes, 0);
  const current = h.source();
  const result = await records.get('cmd.project.bookmarks.create').handler({ requestId: 'actual-runtime-create', projectId: 'p', sceneId: 'a.txt',
    subjectId: 'life:session', expectedSceneSha256: current.sceneSha256, registryRevision: 0, name: 'Actual', selectionStart: 2, selectionEnd: 5 });
  assert.equal(result.ok, true, JSON.stringify(result)); assert.equal(h.writes, 1);
  assert.equal(core.readRegistry(h.source().parsed.doc).bookmarks[0].name, 'Actual');
});

for (const kind of ['readonly', 'deniedCapability', 'dirty', 'lifecycle', 'invalidEnvelope', 'unknownCommand']) {
  test(`actual ui command bridge ${kind} rejects before scene writer`, async t => {
    const h = await harness(t, doc('ABCDEF')); let result;
    if (kind === 'readonly') fs.writeFileSync(h.manifestPath, JSON.stringify({ schemaVersion: 2, projectId: 'p' }));
    if (kind === 'deniedCapability') h.allowed = false;
    if (kind === 'dirty') h.c.isDirty = true;
    if (kind === 'lifecycle') h.subject = 'other';
    if (kind === 'invalidEnvelope') result = await h.ipc(null, { v: 99, route: 'command.bus', commandId: 'cmd.project.bookmarks.create', payload: {} });
    else if (kind === 'unknownCommand') result = await h.dispatch('cmd.project.bookmarks.forged', {});
    else result = await h.command('create', { name: 'Blocked', selectionStart: 2, selectionEnd: 5 });
    assert.equal(result.ok, false, JSON.stringify(result)); assert.equal(h.writes, 0);
  });
}


test('raw future manifest blocks query and Manage before any writer or UI forward', async t => {
  const h = await harness(t, doc('ABCDEF'));
  const future = JSON.stringify({ schemaVersion: 2, projectId: 'p', unknownRequiredState: { retained: true } }, null, 2);
  fs.writeFileSync(h.manifestPath, future); const original = fs.readFileSync(h.file, 'utf8');
  for (const admissionOnly of [true, false]) {
    const result = await h.c.handleUserBookmarkQuery({ admissionOnly });
    assert.equal(result.available, false); assert.equal(result.reason, 'USER_BOOKMARK_PROJECT_READ_ONLY');
  }
  const result = await h.dispatch('cmd.project.bookmarks.managePrompt', {});
  assert.equal(result.ok, false); assert.equal(h.prompt, undefined); assert.equal(h.writes, 0);
  assert.equal(fs.readFileSync(h.manifestPath, 'utf8'), future); assert.equal(fs.readFileSync(h.file, 'utf8'), original);
});

for (const kind of ['untitled', 'nonScene', 'outside']) test(`Manage admission refuses ${kind} before automatic save`, async t => {
  const h = await harness(t, doc('ABCDEF'));
  if (kind === 'untitled') h.c.currentFilePath = null;
  if (kind === 'nonScene') h.c.getDocumentContextFromPath = () => ({ kind: 'notes' });
  if (kind === 'outside') h.c.currentFilePath = path.join(os.tmpdir(), 'outside-project.txt');
  assert.equal((await h.c.handleUserBookmarkQuery({ admissionOnly: true })).available, false);
  assert.equal((await h.dispatch('cmd.project.bookmarks.managePrompt', {})).ok, false);
  assert.equal(h.prompt, undefined); assert.equal(h.writes, 0);
});

function useActualManifestPreparation(h) {
  let manifestWrites = 0;
  Object.assign(h.c, { DEFAULT_PROJECT_NAME: 'Test', currentProjectName: 'Test', crypto,
    normalizeProjectId: value => typeof value === 'string' ? value.trim() : '', createStableProjectId: () => 'new-project',
    sanitizeFilename: value => value, logDevError: () => {},
    getMainProjectManifestAuthority: async () => ({ withProjectLease: (id, fn) => fn({ publish: fn => fn() }),
      commitManifestText: async request => {
        assert.equal(fs.existsSync(request.targetPath) ? fs.readFileSync(request.targetPath, 'utf8') : null, request.expectedText);
        manifestWrites++; fs.writeFileSync(request.targetPath, request.nextText);
      } }),
  });
  vm.runInContext(main.slice(main.indexOf('function normalizeStableProjectId('), main.indexOf('let bookProfileModulePromise =')), h.c);
  vm.runInContext(main.slice(main.indexOf('async function normalizeProjectManifest('), main.indexOf('async function writeNotesOrSettingsThroughAtomicGateway(')), h.c);
  vm.runInContext(main.slice(main.indexOf('async function resolveProjectBindingForFile('), main.indexOf('function getProjectRelativeFilePath(')), h.c);
  vm.runInContext(main.slice(main.indexOf('async function prepareBookProfileManifestForFile('), main.indexOf('async function persistBookProfileForFile(')), h.c);
  return () => manifestWrites;
}

test('actual manifest preparation refuses future version arriving after initial CRUD admission', async t => {
  const h = await harness(t, doc('ABCDEF')), count = useActualManifestPreparation(h);
  const original = fs.readFileSync(h.file, 'utf8');
  const future = JSON.stringify({ schemaVersion: 2, projectId: 'p', projectName: 'Test', createdAtUtc: '2000-01-01T00:00:00Z', requiredData: 'untouched' });
  const prepare = h.c.prepareBookProfileManifestForFile;
  h.c.prepareBookProfileManifestForFile = async (...args) => {
    fs.writeFileSync(h.manifestPath, future); return prepare(...args);
  };
  const result = await h.command('create', { name: 'FutureRace', selectionStart: 2, selectionEnd: 5 });
  assert.equal(result.ok, false); assert.equal(result.code, 'PROJECT_READONLY_SCHEMA');
  assert.equal(count(), 0); assert.equal(h.writes, 0); assert.equal(h.publications.length, 0);
  assert.equal(fs.readFileSync(h.manifestPath, 'utf8'), future); assert.equal(fs.readFileSync(h.file, 'utf8'), original);
});

test('actual manifest preparation retains current bytes and upgrades genuine missing-schema legacy through existing writer', async t => {
  const h = await harness(t, doc('ABCDEF')), count = useActualManifestPreparation(h);
  const current = JSON.stringify({ schemaVersion: 1, projectId: 'p', projectName: 'Test', createdAtUtc: '2000-01-01T00:00:00Z' });
  fs.writeFileSync(h.manifestPath, current);
  assert.equal((await h.c.prepareBookProfileManifestForFile(h.file, null)).projectId, 'p');
  assert.equal(count(), 0); assert.equal(fs.readFileSync(h.manifestPath, 'utf8'), current);
  const legacy = JSON.parse(current); delete legacy.schemaVersion; fs.writeFileSync(h.manifestPath, JSON.stringify(legacy));
  assert.equal((await h.c.prepareBookProfileManifestForFile(h.file, null)).projectId, 'p');
  assert.equal(count(), 1); assert.equal(JSON.parse(fs.readFileSync(h.manifestPath, 'utf8')).schemaVersion, 1);
});


test('actual full bookmark query leaves missing-defaults manifest and scene byte-identical with zero effects', async t => {
  const h = await harness(t, doc('ABCDEF'));
  useActualManifestPreparation(h);
  const manifest = JSON.stringify({ schemaVersion: 1, projectId: 'p' }); fs.writeFileSync(h.manifestPath, manifest);
  const scene = fs.readFileSync(h.file, 'utf8'), tree = fs.readdirSync(path.dirname(h.file)).sort();
  h.c.activePendingRecording = null;
  h.c.normalizeReviewExactTextApplyString = value => typeof value === 'string' ? value.trim() : '';
  h.c.makeReviewExactTextApplyContextBlock = reason => ({ ok: false, reason });
  h.c.ensureProjectManifest = async () => { throw Error('QUERY_MUST_NOT_ENSURE_MANIFEST'); };
  h.c.resolveProjectBindingForFile = async () => { throw Error('QUERY_MUST_NOT_RESOLVE_MUTATING_BINDING'); };
  h.c.loadRtkNonTextReturnModule = () => import('../../src/io/revisionBridge/reviewTransportNonTextReturnRuntime.mjs');
  vm.runInContext(main.slice(main.indexOf('async function readReviewExactTextApplyProjectBinding('), main.indexOf('async function buildReviewExactTextApplyInputFromMainState(')), h.c);
  vm.runInContext(main.slice(main.indexOf('async function readCommentAuthoringContext('), main.indexOf('async function readCommentAuthoringProjection(')), h.c);
  for (const admissionOnly of [true, false]) {
    const result = await h.c.handleUserBookmarkQuery({ admissionOnly });
    assert.equal(result.ok, true, JSON.stringify(result)); assert.equal(result.available, true);
  }
  assert.equal(h.writes, 0); assert.equal(h.publications.length, 0);
  assert.equal(fs.readFileSync(h.manifestPath, 'utf8'), manifest); assert.equal(fs.readFileSync(h.file, 'utf8'), scene);
  assert.deepEqual(fs.readdirSync(path.dirname(h.file)).sort(), tree);
});


for (const withMetadata of [false, true]) test(`first native-shaped bookmark create preserves envelope metadata=${withMetadata} through actual renderer with attachIpc false`, async t => {
  const { getSchema } = await import('@tiptap/core'), { default: StarterKit } = await import('@tiptap/starter-kit');
  const { EditorState } = await import('@tiptap/pm/state');
  const api = await import('../../src/renderer/tiptap/userBookmarks.mjs');
  const { WordPendingRevisions } = await import('../../src/renderer/tiptap/wordPendingRevisions.mjs');
  const { DocumentParagraphAlignment } = await import('../../src/renderer/tiptap/documentParagraphAlignment.mjs');
  const schema = getSchema([StarterKit.configure({ link: false, undoRedo: false }), DocumentParagraphAlignment, WordPendingRevisions, api.UserBookmarks, api.UserBookmarkLink]);
  const initial = { type: 'doc', content: ['Mac bookmark source', 'Alpha target unique', 'Link destination', 'Tail text']
    .map(text => ({ type: 'paragraph', content: [{ type: 'text', text }] })) };
  const editor = { schema, state: EditorState.create({ schema, doc: schema.nodeFromJSON(initial) }) };
  editor.view = { dispatch: tr => { editor.state = editor.state.apply(tr); } };
  const h = await harness(t, editor.state.doc.toJSON());
  if (withMetadata) {
    h.working = envelope.composeObservablePayload({ doc: editor.state.doc.toJSON(), metaEnabled: true,
      meta: { status: 'готово', synopsis: 'Synopsis\nSecond line', tags: { pov: 'Alpha', line: 'Main', place: 'Mac' } },
      cards: [{ title: 'Card', text: 'Kept\nVerbatim', tags: 'native' }] });
    fs.writeFileSync(h.file, h.working);
  }
  const before = envelope.parseObservablePayload(h.working);
  installActualRendererPublication(h, editor, api); h.capture();
  const created = await h.command('create', { name: 'MacSourceRange', selectionStart: 20, selectionEnd: 39 });
  assert.equal(created.ok, true, JSON.stringify(created)); assert.equal(h.writes, 1); assert.equal(h.dirty, false);
  assert.equal(h.working, fs.readFileSync(h.file, 'utf8'));
  const savedEnvelope = envelope.parseObservablePayload(h.working);
  assert.equal(savedEnvelope.hasMetaBlock, withMetadata);
  assert.deepEqual(savedEnvelope.meta, before.meta); assert.deepEqual(savedEnvelope.cards, before.cards);
  const record = core.readRegistry(editor.state.doc.toJSON()).bookmarks[0];
  assert.deepEqual(record.start, { paragraphIndex: 1, offsetUtf16: 0, edge: 'text' });
  assert.deepEqual(record.end, { paragraphIndex: 1, offsetUtf16: 19, edge: 'text' });
  assert.equal((await h.c.handleUserBookmarkQuery()).available, true);
  for (const kind of ['content', 'generation', 'rich']) {
    const before = editor.state.doc.toJSON(), beforeContent = h.working, next = clone(before);
    next.attrs.wordUserBookmarks.revision++;
    if (kind === 'rich') next.content[0].content[0].text = 'FORGED';
    h.renderer.onEditorSetText({ userBookmarkAuthoringPublication: true,
      content: envelope.composeObservablePayload({ doc: next }),
      expectedContent: kind === 'content' ? 'forged source bytes' : beforeContent,
      expectedGeneration: kind === 'generation' ? h.generation + 1 : h.generation });
    assert.deepEqual(editor.state.doc.toJSON(), before);
  }
});


async function actualNativeImportHarness(t, bytes) {
  const h = await harness(t, doc('existing scene'));
  const root = path.dirname(h.file), roman = path.join(root, 'roman'); fs.mkdirSync(roman);
  const inputFile = path.join(root, 'native-input.docx'); fs.writeFileSync(inputFile, bytes);
  const local = require('../../src/utils/docxImportLocalFilePreview.js');
  const safe = require('../../src/utils/docxImportSafeCreate.js');
  const { createMainProjectManifestAuthority } = await import('../../src/product/mainProjectManifestAuthority.mjs');
  const authority = createMainProjectManifestAuthority({ anchorRoot: path.join(root, '.test-authority'), useLeaseHeartbeatWorker: false });
  Object.assign(h.c, {
    ...local, ...safe, createDocxImportPreviewReferences: require('../../src/utils/docxImportPreviewReferences.js').createDocxImportPreviewReferences,
    dialog: { showOpenDialog: async () => ({ canceled: false, filePaths: [inputFile] }) },
    fileManager: { getDocumentsPath: () => root }, mainWindow: null,
    readExternalFileBounded: async (file, options) => {
      assert.equal(file, inputFile); const value = await fs.promises.readFile(file);
      assert.ok(value.length <= options.maxBytes); return { bytes: value };
    },
    loadRevisionBridgeModule: () => import('../../src/io/revisionBridge/index.mjs'),
    ensureProjectStructure: async () => {}, getProjectSectionPath: () => roman,
    getMainProjectManifestAuthority: async () => authority,
    resolveProjectBindingForFile: async file => {
      assert.equal(file, roman); return { projectId: 'p', manifestPath: h.manifestPath, manifestRaw: fs.readFileSync(h.manifestPath, 'utf8') };
    },
  });
  for (const [start, end] of [
    ['// DOCX_IMPORT_PREVIEW_REFERENCES_START', '// DOCX_IMPORT_PREVIEW_REFERENCES_END'],
    ['// DOCX_IMPORT_PREVIEW_COMMAND_SURFACE_START', '// DOCX_IMPORT_PREVIEW_COMMAND_SURFACE_END'],
    ['// DOCX_IMPORT_SAFE_CREATE_COMMAND_SURFACE_START', '// DOCX_IMPORT_SAFE_CREATE_COMMAND_SURFACE_END'],
    ['// DOCX_IMPORT_LOCAL_FILE_PREVIEW_COMMAND_SURFACE_START', '// DOCX_IMPORT_LOCAL_FILE_PREVIEW_COMMAND_SURFACE_END'],
  ]) vm.runInContext(main.slice(main.indexOf(start), main.indexOf(end)), h.c);
  h.createdFiles = () => fs.existsSync(path.join(roman, 'Imported')) ? fs.readdirSync(path.join(roman, 'Imported')).filter(file => file.endsWith('.txt')) : [];
  return h;
}

for (const kind of ['G17', 'zeroActive']) test(`actual native-local private content and plan references preserve ${kind} through real SafeCreate writer`, async t => {
  const sample = kind === 'G17' ? fixture.snapshots.find(value => value.name.startsWith('17-')) : fixture.zeroActiveTargets;
  const h = await actualNativeImportHarness(t, bytesOf({ ...fixture.sharedParts, ...sample.parts }));
  const local = await h.c.handleDocxImportLocalFilePreviewCommandSurface({ requestId: 'native-local' });
  assert.equal(local.contentPreviewOk, true, JSON.stringify(local).slice(0, 400));
  assert.ok(local.docxContentPreviewReport.contentPreview.userBookmarkInventory);
  const preview = await h.c.handleDocxImportPreviewCommandSurface({ requestId: 'native-plan', docxContentPreviewRef: local.docxContentPreviewRef });
  assert.equal(preview.importPreviewOk, true, JSON.stringify(preview).slice(0, 400));
  const planned = envelope.parseObservablePayload(preview.docxImportPreviewPlan.candidateCreatePlan.entries[0].content).doc;
  const created = await h.c.handleDocxImportSafeCreateCommandSurface({ requestId: 'native-create', docxImportPreviewRef: preview.docxImportPreviewRef });
  assert.equal(created.ok, true, JSON.stringify(created)); assert.equal(h.createdFiles().length, 1);
  const persisted = envelope.parseObservablePayload(fs.readFileSync(path.join(path.dirname(h.file), 'roman', 'Imported', h.createdFiles()[0]), 'utf8'));
  assert.equal(persisted.payloadVersion, 3); assert.deepEqual(persisted.doc, planned);
  assert.equal(core.readRegistry(persisted.doc).bookmarks.filter(record => record.state === 'active').length, kind === 'G17' ? 7 : 0);
  if (kind === 'zeroActive') assert.equal(core.readRegistry(persisted.doc).bookmarks.filter(record => record.state === 'deleted').length, 2);
  assert.match(JSON.stringify(persisted.doc), /wordBookmarkId/);
  assert.equal((await h.c.handleDocxImportSafeCreateCommandSurface({ requestId: 'forged', docxImportPreviewPlan: { ...clone(preview.docxImportPreviewPlan), previewHash: 'f'.repeat(64) } })).ok, false);
  h.c.invalidateDocxImportPreviewReferences();
  assert.equal((await h.c.handleDocxImportSafeCreateCommandSurface({ requestId: 'stale', docxImportPreviewRef: preview.docxImportPreviewRef })).ok, false);
  assert.equal(h.createdFiles().length, 1);
});

test('Main raw inventory validation rejects unknown shape and accessors before interpretation or clone', async t => {
  const sample = fixture.snapshots.find(value => value.name.startsWith('17-'));
  const h = await actualNativeImportHarness(t, bytesOf({ ...fixture.sharedParts, ...sample.parts }));
  const { io } = await wordHarness(), report = io.buildDocxContentPreviewFromZipBytes(bytesOf({ ...fixture.sharedParts, ...sample.parts }));
  for (const kind of ['path', 'bounds', 'getter']) {
    const changed = clone(report); let reads = 0;
    if (kind === 'path') changed.contentPreview.userBookmarkInventory.projectRoot = 'foreign';
    if (kind === 'bounds') changed.contentPreview.userBookmarkInventory.bookmarks[0].end.offsetUtf16 = 999999;
    if (kind === 'getter') Object.defineProperty(changed.contentPreview.userBookmarkInventory, 'bookmarks', {
      enumerable: true, get() { reads++; throw Error('getter must not run'); },
    });
    const result = await h.c.handleDocxImportPreviewCommandSurface({ requestId: 'hostile', docxContentPreviewReport: changed });
    assert.equal(result.ok, false, JSON.stringify(result)); assert.equal(reads, 0); assert.equal(h.createdFiles().length, 0);
  }
});

for (const operation of ['mappedSave', 'backup', 'cleanR']) test(`bookmark ${operation} preserves metadata and cards without changing ordinary envelope semantics`, async t => {
  const h = await harness(t);
  const raw = envelope.composeObservablePayload({ doc: seed(), metaEnabled: true,
    meta: { status: 'готово', synopsis: 'Keep synopsis\nSecond line', tags: { pov: 'POV', line: 'Line', place: 'Place' } },
    cards: [{ title: 'Keep title', text: 'Keep card\nSecond line', tags: 'tag' }] });
  fs.writeFileSync(h.file, raw); h.working = raw;
  const baseline = envelope.parseObservablePayload(raw);
  let actual;
  if (operation === 'mappedSave') {
    h.working = envelope.composeObservablePayload({ ...baseline, metaEnabled: true, doc: edit(seed(), 'XABCDEF') });
    h.generation = 1; h.c.lastSignaledEditGeneration = 1;
    const saved = await h.save(); assert.equal(saved.receipt.success, true, saved.receipt.error); assert.equal(saved.ack.kind, 'SAVED');
    actual = fs.readFileSync(h.file, 'utf8');
  } else if (operation === 'backup') {
    backupHarness(h); await h.c.createBackup(); assert.equal(h.backupWrites, 1, h.backupError);
    const directory = path.join(path.dirname(h.file), 'backups', hash(h.file));
    actual = fs.readFileSync(path.join(directory, fs.readdirSync(directory).find(file => file !== 'meta.json')), 'utf8');
    assert.equal(fs.readFileSync(h.file, 'utf8'), raw); assert.equal(h.writes, 0);
  } else {
    const r = returnHarness(h), result = await r.apply(); assert.equal(result.ok, true, JSON.stringify(result));
    actual = fs.readFileSync(h.file, 'utf8');
  }
  const saved = envelope.parseObservablePayload(actual); assert.equal(saved.hasMetaBlock, true);
  assert.deepEqual(saved.meta, baseline.meta); assert.deepEqual(saved.cards, baseline.cards);
});

for (const operation of ['create', 'cleanR']) for (const drift of ['meta', 'cards', 'presence']) {
  test(`bookmark ${operation} rejects unsaved ${drift} drift with zero writes and publications`, async t => {
    const h = await harness(t, operation === 'create' ? doc('ABCDEF') : seed());
    const raw = envelope.composeObservablePayload({ doc: envelope.parseObservablePayload(h.working).doc, metaEnabled: true,
      meta: { status: 'готово', synopsis: 'Trusted synopsis', tags: { pov: 'POV', line: 'Line', place: 'Place' } },
      cards: [{ title: 'Trusted', text: 'Trusted card', tags: 'tag' }] });
    fs.writeFileSync(h.file, raw); h.working = raw; const trusted = envelope.parseObservablePayload(raw);
    const r = operation === 'cleanR' ? returnHarness(h) : null;
    const changed = clone(trusted);
    if (drift === 'meta') changed.meta.synopsis = 'Unsaved synopsis';
    if (drift === 'cards') changed.cards[0].text = 'Unsaved card';
    h.working = envelope.composeObservablePayload({ ...changed, metaEnabled: drift !== 'presence' });
    const result = r ? await r.apply() : await h.command('create', { name: 'First', selectionStart: 2, selectionEnd: 5 });
    assert.equal(result.ok, false, JSON.stringify(result));
    assert.equal(result.code || result.reason, operation === 'create' ? 'USER_BOOKMARK_EDITOR_STALE' : 'RTK_USER_BOOKMARK_SOURCE_STALE');
    assert.equal(h.writes, 0); assert.equal(h.publications.length, 0);
    assert.equal(fs.readFileSync(h.file, 'utf8'), raw);
    assert.equal(envelope.parseObservablePayload(h.working).meta.synopsis, drift === 'meta' ? 'Unsaved synopsis' : drift === 'presence' ? '' : 'Trusted synopsis');
  });
}

async function reopenedMinimalLinkedReturn(t, persisted) {
  const { getSchema } = await import('@tiptap/core'), { default: StarterKit } = await import('@tiptap/starter-kit');
  const { EditorState } = await import('@tiptap/pm/state');
  const api = await import('../../src/renderer/tiptap/userBookmarks.mjs');
  const { WordPendingRevisions } = await import('../../src/renderer/tiptap/wordPendingRevisions.mjs');
  const { DocumentParagraphAlignment } = await import('../../src/renderer/tiptap/documentParagraphAlignment.mjs');
  const actual = await import('../../src/io/revisionBridge/reviewTransportNonTextReturnRuntime.mjs');
  const initial = persisted || seed();
  if (!persisted) {
    initial.attrs.wordPendingRevisions = null; initial.content[0].attrs = { textAlign: null };
    initial.content[0].content[0].marks = [{ type: 'link', attrs: core.linkAttrs(core.readRegistry(initial).bookmarks[0]) }];
  }
  const h = await harness(t, initial);
  const schema = getSchema([StarterKit.configure({ link: false, undoRedo: false }), DocumentParagraphAlignment,
    WordPendingRevisions, api.UserBookmarks, api.UserBookmarkLink.configure({ autolink: false, linkOnPaste: false, openOnClick: false })]);
  const editor = { schema, state: EditorState.create({ schema, doc: schema.nodeFromJSON(initial) }) };
  editor.view = { dispatch: tr => { editor.state = editor.state.apply(tr); } };
  h.c.loadRtkNonTextReturnModule = async () => ({ readCommentAuthoringState: async () => ({ text: null }),
    commentSceneSnapshotsEqual: actual.commentSceneSnapshotsEqual });
  installActualRendererPublication(h, editor, api); h.capture();
  const r = returnHarness(h), before = r.store.userBookmarksCandidate.beforeDoc;
  const record = core.readRegistry(before).bookmarks[0];
  const candidate = core.planMutation({ doc: before, action: 'rename', bookmarkId: record.id,
    name: record.name === 'anchor' ? 'ANCHOR' : 'anchor' }).doc;
  r.store.userBookmarksCandidate.plan = core.planReturn({ beforeDoc: before, candidateDoc: candidate });
  return { h, r, editor, actual };
}

test('actual schema reopen of a minimal signed-return link admits a second changed return and persists stable defaults', async t => {
  const { h, r, actual } = await reopenedMinimalLinkedReturn(t);
  const before = r.store.userBookmarksCandidate.beforeDoc, live = envelope.parseObservablePayload(h.working).doc;
  assert.equal(actual.commentSceneSnapshotsEqual(live, before), false, 'real pinned schema reproduces the native mismatch');
  const result = await r.apply(); assert.equal(result.ok, true, JSON.stringify(result)); assert.equal(h.writes, 1);
  const saved = envelope.parseObservablePayload(fs.readFileSync(h.file, 'utf8')).doc;
  const attrs = saved.content[0].content[0].marks[0].attrs;
  assert.equal(attrs.target, '_blank'); assert.equal(attrs.rel, 'noopener noreferrer nofollow');
  assert.equal(attrs.class, null); assert.equal(attrs.title, null);
  const reopened = await reopenedMinimalLinkedReturn(t, saved);
  assert.equal(reopened.actual.commentSceneSnapshotsEqual(envelope.parseObservablePayload(reopened.h.working).doc, saved), true);
  assert.equal((await reopened.r.apply()).ok, true); assert.equal(reopened.h.writes, 1);
});

for (const drift of ['rel', 'target', 'extraMark', 'label', 'forgedIdentity']) {
  test(`actual reopened-link compatibility rejects unsaved ${drift} with no write`, async t => {
    const { h, r } = await reopenedMinimalLinkedReturn(t), changed = envelope.parseObservablePayload(h.working).doc;
    const node = changed.content[0].content[0], attrs = node.marks[0].attrs;
    if (drift === 'rel') attrs.rel = 'nofollow';
    if (drift === 'target') attrs.target = '_self';
    if (drift === 'extraMark') node.marks.push({ type: 'bold' });
    if (drift === 'label') node.text = 'ABCXEF';
    if (drift === 'forgedIdentity') attrs.wordBookmarkId = 'ubm-' + 'f'.repeat(32);
    const raw = fs.readFileSync(h.file, 'utf8'); h.working = envelope.composeObservablePayload({ doc: changed });
    const working = h.working;
    let result; try { result = await r.apply(); } catch (error) { result = { ok: false, code: error.code || error.message }; }
    assert.equal(result.ok, false); assert.match(result.code || result.reason, /SOURCE_STALE|USER_BOOKMARK_LINK_TARGET_INVALID/);
    assert.equal(h.writes, 0); assert.equal(h.publications.length, 0);
    assert.equal(fs.readFileSync(h.file, 'utf8'), raw); assert.equal(h.working, working);
  });
}

test('actual imported minimal link can be renamed after schema reopen without a preliminary save', async t => {
  const { h } = await reopenedMinimalLinkedReturn(t);
  const record = core.readRegistry(h.source().parsed.doc).bookmarks[0];
  const result = await h.command('rename', { bookmarkId: record.id, name: 'AfterImport' });
  assert.equal(result.ok, true, JSON.stringify(result)); assert.equal(h.writes, 1);
  assert.equal(h.working, fs.readFileSync(h.file, 'utf8'));
  assert.equal(core.readRegistry(h.source().parsed.doc).bookmarks[0].name, 'AfterImport');
});

for (const drift of ['rel', 'target', 'extraMark', 'label', 'identity', 'disk']) {
  test(`actual imported-link CRUD compatibility refuses ${drift} drift without a write`, async t => {
    const { h } = await reopenedMinimalLinkedReturn(t), record = core.readRegistry(h.source().parsed.doc).bookmarks[0];
    const changed = envelope.parseObservablePayload(h.working).doc, node = changed.content[0].content[0];
    if (drift === 'rel') node.marks[0].attrs.rel = 'nofollow';
    if (drift === 'target') node.marks[0].attrs.target = '_self';
    if (drift === 'extraMark') node.marks.push({ type: 'italic' });
    if (drift === 'label') node.text = 'ABCXEF';
    if (drift === 'identity') node.marks[0].attrs.wordBookmarkId = 'ubm-' + 'f'.repeat(32);
    h.working = envelope.composeObservablePayload({ doc: changed });
    if (drift === 'disk') fs.writeFileSync(h.file, envelope.composeObservablePayload({ doc: edit(h.source().parsed.doc, 'ABCXEF') }));
    const disk = fs.readFileSync(h.file, 'utf8'), working = h.working;
    const result = await h.command('rename', { bookmarkId: record.id, name: 'AfterImport' });
    assert.equal(result.ok, false); assert.equal(h.writes, 0); assert.equal(h.publications.length, 0);
    assert.equal(fs.readFileSync(h.file, 'utf8'), disk); assert.equal(h.working, working);
  });
}

function loadNamedFunctions(source, names, context) {
  vm.runInContext(names.map(name => {
    const match = source.match(new RegExp('(?:async )?function ' + name + '\\([^]*?\\n}(?=\\n|$)'));
    assert.ok(match, name); return match[0];
  }).join('\n'), context);
}
async function bookmarkReviewUiHarness(t) {
  const { h, r } = await reopenedMinimalLinkedReturn(t), c = h.c;
  const change = { ...r.store.input.reviewItems[0], targetScope: { type: 'scene', id: 'a.txt' }, match: { kind: 'exact', quote: 'ABCDEF' } };
  r.store.input.reviewItems = [change]; r.store.input.projectSnapshot = { projectId: 'p' };
  c.activeReviewSessionStore.revisionSession = { projectId: 'p', sessionId: 'review', reviewGraph: { textChanges: [change] } };
  c.activeReviewSessionStore.reviewSurface = { revisionSession: clone(c.activeReviewSessionStore.revisionSession) };
  c.hasReviewSurfacePayload = value => value && typeof value === 'object' && Object.keys(value).length > 0;
  vm.runInContext(main.slice(main.indexOf('const REVIEW_EXACT_TEXT_APPLY_COMMAND_ID ='), main.indexOf('function normalizeReviewExactTextApplyPayload(')), c);
  Object.assign(c, { REVIEW_EXACT_TEXT_UI_PLAN_SCHEMA: 'revision-bridge.exact-text-ui-plan.v1',
    REVIEW_EXACT_TEXT_UI_PLAN_BLOCKED_CODE: 'E_REVISION_BRIDGE_EXACT_TEXT_UI_PLAN_BLOCKED',
    currentReviewSurfacePayload: {}, currentReviewSurfacePayloadSource: '', currentReviewSurfacePayloadContentHash: '',
    activeReviewSessionDirtyImportBlocked: false, activeRtkNonOverlapTrackedReplacementApplyStore: null,
    buildReviewExactTextApplyBatchInputFromMainState: async () => { throw Error('GENERIC_TEXT_INPUT_FORBIDDEN'); },
    buildReviewExactTextApplyInputFromMainState: async () => { h.genericPlans = (h.genericPlans || 0) + 1; throw Error('REVISION_BRIDGE_EXACT_TEXT_APPLY_PLAN_NO_MATCH'); },
    loadExactTextMinSafeWriteModule: async () => import('../../src/io/revisionBridge/exactTextMinSafeWrite.mjs'),
    runRtkNonOverlapTrackedReplacementProductApplyFromMainState: async () => null,
  });
  loadNamedFunctions(main, ['cloneActiveReviewSessionStore', 'readActiveReviewSessionReviewSurface',
    'normalizeReviewExactTextApplyPayload', 'normalizeReviewExactTextApplyBatchPayload',
    'readReviewExactTextRevisionSession', 'readReviewExactTextReviewGraph', 'readReviewExactTextChangeCollections',
    'selectReviewExactTextChange', 'selectReviewExactTextChangesBatch', 'rtkNonOverlapTrackedReplacementDetailString', 'reviewExactTextChangeRequiresRtkNonOverlapProductPath',
    'deriveReviewExactTextApplyOperationId', 'summarizeReviewExactTextBatchSafeWriteResult', 'attachReviewExactTextApplyBatchResult',
    'makeReviewExactTextApplyBatchResponseFromSafeWrite', 'handleReviewSurfaceApplyExactTextChangeCommandSurface',
    'handleReviewSurfaceApplyExactTextChangesBatchCommandSurface', 'makeReviewExactTextUiPlanReason',
    'buildReviewExactTextUiBlockedPreview', 'readReviewExactTextUiPlanSessionToken', 'reviewExactTextUiPlanSessionTokenMatchesCurrent',
    'attachReviewExactTextUiPlanPreview', 'refreshActiveReviewExactTextUiPlan'], c);
  const renderer = fs.readFileSync(path.join(__dirname, '../../src/renderer/editor.js'), 'utf8');
  class Element {} class HTMLElement extends Element { contains() { return true; } }
  class HTMLButtonElement extends HTMLElement { closest(selector) { return selector === '[data-review-apply-exact-change]' ? this : null; } }
  const view = vm.createContext({ Element, HTMLElement, HTMLButtonElement, Date, console,
    reviewSurfaceHost: new HTMLElement(), reviewSurfaceExactTextApplyTransientState: null,
    REVIEW_SURFACE_EXACT_APPLY_TRANSIENT_STATES: ['applying', 'applied', 'blocked', 'failed'],
    REVIEW_SURFACE_EXACT_TEXT_APPLY_COMMAND_ID: 'cmd.project.review.applyExactTextChange',
    REVIEW_SURFACE_EXACT_TEXT_APPLY_BATCH_COMMAND_ID: 'cmd.project.review.applyExactTextChangesBatch',
    REVIEW_SURFACE_EXACT_APPLY_BLOCKED_REASON: 'PREVIEW_BLOCKED',
    REVIEW_SURFACE_EXACT_APPLY_CHANGE_ID_REQUIRED_REASON: 'CHANGE_ID_REQUIRED',
    renderReviewSurface: () => {}, setReviewSurfaceState: () => {}, loadReviewSurfaceFromQuery: async () => {},
    invokePreloadUiCommandBridge: async (id, payload) => { h.clickedCommand = id; h.clickedPayload = payload;
      return h.clickedResult = await h.dispatch(id, payload); },
  });
  loadNamedFunctions(renderer, ['reviewSurfaceText', 'reviewSurfaceArray', 'reviewSurfaceIsPlainObject',
    'reviewSurfaceNormalizeExactTextApplyState', 'reviewSurfaceTokenizeDisplayText', 'reviewSurfaceBuildBoundedDisplayDiff', 'reviewSurfacePresentExactApplyState',
    'reviewSurfaceBuildExactTextPreview', 'reviewSurfaceBuildReviewItems', 'setReviewSurfaceExactTextApplyTransientState',
    'reviewSurfaceCreateExactTextApplyRequestId', 'reviewSurfaceBuildExactTextApplyPayload', 'reviewSurfaceBuildExactTextApplyBatchPayload',
    'reviewSurfaceUnwrapCommandResult', 'reviewSurfaceExtractCommandFailureReason', 'reviewSurfaceIsExactApplyBlockedReason',
    'reviewSurfaceIsExactApplyAmbiguousReason', 'handleReviewSurfaceExactTextApplyClick'], view);
  const button = new HTMLButtonElement(); button.dataset = { changeId: change.changeId }; button.disabled = false;
  return { h, r, c, view, button, change };
}

test('private semantic preview feeds the existing view and actual click-to-IPC batch writer', async t => {
  const { h, c, view, button } = await bookmarkReviewUiHarness(t);
  const refreshed = await c.refreshActiveReviewExactTextUiPlan();
  assert.equal(refreshed.status, 'ready', JSON.stringify(refreshed)); assert.equal(h.genericPlans || 0, 0);
  const preview = refreshed.reviewSurface.exactTextPlanPreview;
  assert.equal(preview.plan.canApply, false); assert.equal(preview.plan.safeWriteCandidate, false);
  const displayed = view.reviewSurfaceBuildExactTextPreview(refreshed.reviewSurface);
  assert.equal(displayed.ops[0].applyDisabled, false); assert.equal(displayed.ops[0].userBookmarkReturn, true);
  assert.match(displayed.ops[0].expectedText, /Anchor.*абзац 1/); assert.match(displayed.ops[0].replacementText, /anchor.*абзац 1/);
  assert.equal(view.reviewSurfaceBuildReviewItems(refreshed.reviewSurface)[0].title, 'Закладки и внутренние ссылки');
  await view.handleReviewSurfaceExactTextApplyClick({ target: button });
  assert.equal(h.clickedCommand, 'cmd.project.review.applyExactTextChangesBatch'); assert.equal(h.writes, 1, JSON.stringify(h.clickedResult));
  assert.deepEqual(Object.keys(h.clickedPayload).sort(), ['changeIds', 'requestId']);
  assert.equal(core.readRegistry(h.source().parsed.doc).bookmarks[0].name, 'anchor');
});

test('private semantic preview describes a newly created paragraph-mark point without granting endpoint relocation', async t => {
  const { r, c } = await bookmarkReviewUiHarness(t), before = r.store.userBookmarksCandidate.beforeDoc;
  const point = { paragraphIndex: 0, offsetUtf16: 6, edge: 'afterParagraph' };
  const candidateDoc = core.planMutation({ doc: before, action: 'create', name: 'BoundaryPoint', start: point, end: point,
    requestId: 'boundary-point', projectId: 'p', sceneId: 'a.txt' }).doc;
  r.store.userBookmarksCandidate.plan = core.planReturn({ beforeDoc: before, candidateDoc });
  const result = await c.refreshActiveReviewExactTextUiPlan(); assert.equal(result.status, 'ready');
  const op = result.reviewSurface.exactTextPlanPreview.plan.applyOps[0];
  assert.equal(op.expectedText, 'Нет закладки'); assert.match(op.replacementText, /BoundaryPoint.*после знака абзаца/);
});

for (const drift of ['missingStore', 'forgedCard', 'disk', 'capability', 'typingDuringKey', 'typingAfterHelper', 'pendingRecording', 'endpointOnly']) {
  test(`private bookmark UI preview and actual batch refuse ${drift} without a writer`, async t => {
    const { h, r, c, view, button, change } = await bookmarkReviewUiHarness(t), original = h.working;
    if (drift === 'missingStore') c.activeRtkCleanLinkLabelApplyStore = null;
    if (drift === 'forgedCard') { c.activeReviewSessionStore.revisionSession.reviewGraph.textChanges[0].changeId += '-forged'; button.dataset.changeId += '-forged'; }
    if (drift === 'disk') fs.writeFileSync(h.file, 'EXTERNAL');
    if (drift === 'capability') h.allowed = false;
    if (drift === 'typingDuringKey') h.afterKey = () => { h.generation++; c.lastSignaledEditGeneration++; h.working = 'OWNER UNSAVED'; };
    if (drift === 'typingAfterHelper') {
      const build = c.buildPrivateUserBookmarksUiPlan;
      c.buildPrivateUserBookmarksUiPlan = async changes => { const result = await build(changes);
        h.generation++; c.lastSignaledEditGeneration++; h.working = 'OWNER UNSAVED'; return result; };
    }
    const recording = { state: 'active', filePath: h.file }; if (drift === 'pendingRecording') c.activePendingRecording = recording;
    if (drift === 'endpointOnly') { const changed = clone(r.store.userBookmarksCandidate.beforeDoc); changed.attrs.wordUserBookmarks.bookmarks[0].start.offsetUtf16 = 1;
      changed.attrs.wordUserBookmarks.revision++; r.store.userBookmarksCandidate.plan = { doc: changed }; }
    const disk = fs.readFileSync(h.file, 'utf8');
    const preview = await c.refreshActiveReviewExactTextUiPlan(); assert.equal(preview.status, 'blocked');
    if (drift === 'endpointOnly') assert.equal(preview.reviewSurface.exactTextPlanPreview.reason, 'USER_BOOKMARK_RETURN_ENDPOINT_RELOCATED');
    if (drift.startsWith('typing')) c.isDirty = true;
    await view.handleReviewSurfaceExactTextApplyClick({ target: button });
    assert.equal(h.writes, 0); assert.equal(fs.readFileSync(h.file, 'utf8'), disk);
    assert.equal(h.working, drift.startsWith('typing') ? 'OWNER UNSAVED' : original);
    if (drift === 'pendingRecording') assert.equal(c.activePendingRecording, recording);
  });
}

for (const superseded of [false, true]) test(`actual activation installs its private candidate before refreshing and returning the semantic surface; superseded=${superseded}`, async t => {
  const { h, r, c, change } = await bookmarkReviewUiHarness(t);
  const capsule = { ...r.store.keyAuthority, projectRoot: path.dirname(h.file),
    authenticatedFullManuscriptExportMap: r.store.keyAuthority.exportMap,
    exportMapAuthority: 'main-owned-active-export-authority-store-after-return-authentication', returnedArtifactExportMapAccepted: false,
    userBookmarksCandidate: clone(r.store.userBookmarksCandidate), cleanLinkLabel: { ok: true, change },
    writerContext: { ...clone(r.store.input), revisionSession: clone(c.activeReviewSessionStore.revisionSession) } };
  Object.assign(c, { DOCX_REVIEW_PREVIEW_SESSION_COMMAND_ID: 'cmd.project.review.activateDocxReviewPreviewSession',
    activeRtkFormattingReturnApplyStore: null, activeRtkStructuralReturnApplyStore: null,
    activeDocxActivationRequestDigestGuard: { check: () => ({ ok: true }), remember: () => {} },
    decodeDocxIntakeGateBufferSource: () => ({ ok: true, bytes: Buffer.from('controlled upstream intake') }),
    normalizeDocxIntakeGateRequestId: value => value,
    buildDocxReviewPreviewSessionMainContext: async () => ({ ok: true, projectId: 'p', baselineHash: hash(h.working) }),
    loadRevisionBridgeModule: async () => ({ buildDocxReviewPreviewSessionCandidateFromZipBytes: () => {} }),
    // Authentication belongs to its separately tested intake port; this case
    // exercises the real downstream activation ordering with a controlled result.
    inspectDocxReviewReturnIntakeV2: async () => ({ ok: true, authenticated: true, localAuthorityCapsule: capsule,
      legacyCandidate: { status: 'ready', reviewPacket: {}, canAutoApply: false, canImportMutate: false,
        canWriteStorage: false, canOpenReviewSession: true } }),
    prepareAuthenticatedPendingReturn: async () => null,
    makeDocxReviewPreviewSessionTypedError: (code, reason) => ({ ok: false, error: { code, reason } }),
    handleReviewSurfaceImportPacketCommandSurface: async payload => {
      c.activeReviewSessionLifecycle = 'active'; c.activeReviewSessionStore = { ...payload,
        revisionSession: { ...clone(capsule.writerContext.revisionSession), reviewGraph: clone(payload.reviewPacket) },
        reviewSurface: { revisionSession: { ...clone(capsule.writerContext.revisionSession), reviewGraph: clone(payload.reviewPacket) } } };
      h.importPreview = await c.refreshActiveReviewExactTextUiPlan();
      return { ok: true, session: clone(c.activeReviewSessionStore), reviewSurface: clone(h.importPreview.reviewSurface) };
    },
    buildDocxReviewPreviewSessionCommentShadowPayload: () => null,
    prepareDocxReviewPreviewSessionNonOverlapTrackedReplacementProductPath: async () => null,
    prepareAuthenticatedNoteDelta: async () => null,
    prepareAuthenticatedDocxFormattingReturnProductPath: () => null,
    prepareAuthenticatedDocxStructuralReturnProductPath: () => null,
    sanitizeDocxReviewReturnIntakeForResult: () => ({ authenticated: true }),
  });
  loadNamedFunctions(main, ['docxReviewPreviewSessionDetailString', 'buildDocxReviewPreviewSessionImportPayload',
    'buildCleanLinkLabelPreviewPacket', 'summarizeDocxReviewPreviewSessionCandidate',
    'docxReviewReturnIntakeProductBudgets', 'assertDocxReviewPreviewSessionActivationResult', 'handleDocxReviewPreviewSessionActivationCommandSurface'], c);
  const budgets = main.match(/const DOCX_REVIEW_RETURN_INTAKE_FULL_MANUSCRIPT_PRODUCT_BUDGETS = Object\.freeze\(\{[^]*?\}\);/);
  assert.ok(budgets); vm.runInContext(budgets[0], c);
  if (superseded) h.afterKey = () => { c.activeDocxReviewIntakeGeneration++; };
  const result = await c.handleDocxReviewPreviewSessionActivationCommandSurface({ requestId: 'activation-order' });
  assert.equal(h.importPreview.status, 'blocked', 'first import refresh has no private candidate yet');
  assert.equal(h.writes, 0); assert.equal(h.genericPlans || 0, 0);
  if (superseded) { assert.equal(result.ok, false); assert.equal(result.error.reason, 'RTK_DOCX_ACTIVATION_SUPERSEDED'); }
  else {
    assert.equal(result.ok, true, JSON.stringify(result)); assert.equal(result.activated, true);
    assert.equal(result.reviewSurface.exactTextPlanPreview.status, 'ready');
    assert.equal(result.session.reviewSurface.exactTextPlanPreview.status, 'ready');
    assert.equal(c.activeReviewSessionStore.reviewSurface.exactTextPlanPreview.status, 'ready');
  }
});

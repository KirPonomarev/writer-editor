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
const mediaModel = require('../../src/core/word-media-return-v1.cjs'), media = require('../../src/io/documentMedia.js');
const jpeg = require('../fixtures/document-jpeg-fixtures.cjs');
const initialDoc = () => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'AB' }] }] });
async function harness(t, initial = initialDoc()) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'media-runtime-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const manifestPath = path.join(dir, 'project.craftsman.json'); fs.writeFileSync(manifestPath, JSON.stringify({ schemaVersion: 1, projectId: 'p' }));
  const file = path.join(dir, 'a.txt'); fs.writeFileSync(file, envelope.composeObservablePayload({ doc: initial }));
  const h = { writes: 0, generation: 0, working: fs.readFileSync(file, 'utf8'), publications: [], dirty: false };
  const c = vm.createContext({ console, Buffer, JSON, userBookmarkModel: core, wordMediaReturnModel: mediaModel, wordMediaData: media, pendingTextRevisions: pending,
    fs: fs.promises, path, currentFilePath: file, commentAuthoringSessionId: 'session', lastSignaledEditGeneration: 0,
    currentLifecycleSubjectId: () => h.subject || 'life', cloneJsonSafe: clone, computeHash: hash,
    SAVE_ACK_KINDS, bindSaveReceiptToAck, mergeSignaledGeneration: (a,b) => Math.max(a,b),
    setDirtyState: state => { h.dirty = state; },
    loadDocumentContentEnvelopeModule: async () => envelope,
    getProjectRootPath: () => dir, getProjectManifestPath: () => manifestPath, PROJECT_MANIFEST_SCHEMA_VERSION: 1,
    isPathInside: (root, file) => file.startsWith(root + path.sep), isAllowedFilePath: value => value === file,
    resolveProjectBindingForFile: async () => { throw Error('UNSAFE_ENSURE_RESOLVER_FOR_BOOKMARKS'); },
    loadMarkdownIoModule: async () => import('../../src/io/markdown/index.mjs'),
    prepareBookProfileManifestForFile: async () => ({ expectedText: fs.readFileSync(manifestPath, 'utf8'), nextText: fs.readFileSync(manifestPath, 'utf8'), manifestPath, projectId: 'p' }),
    SAVE_AUTHORITY_ROUTES: { PROJECT_TRANSACTION_V1: 'project', DURABLE_SAVE_V1: 'durable' }, SAVE_AUTHORITY_OBSERVER_IDS: {},
    executeAtomicSceneManifestGatewayCutover: ({ executeGateway }) => executeGateway(),
    getMainProjectManifestAuthority: async () => ({ withProjectLease: (id, fn) => fn({ publish: fn => fn() }), commitManifestText: async ({ expectedText, nextText }) => { assert.equal(fs.readFileSync(manifestPath, 'utf8'), expectedText); fs.writeFileSync(manifestPath, nextText); } }),
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
      const result = await require('../../src/core/project-transaction-v1.cjs').commitProjectTransaction(request);
      if (result.success) h.writes++;
      return result;
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
function returnHarness(h) {
  const before = h.source(), beforeDoc = before.parsed.doc;
  const placements = h.placements || [{ paragraphIndex: 0, offset: 1, attrs: media.createImageAttrs(jpeg.rgb, { alt: 'Image', displayName: 'test.jpg' }) }];
  const plan = mediaModel.planMediaReturn({ beforeDoc, placements });
  const candidateDoc = plan.doc;
  const changeId = 'docx-media-return-private-test', projectRoot = path.dirname(h.file);
  const input = { projectRoot, scenePath: h.file, projectSnapshot: { projectId: 'p' }, reviewItems: [{ changeId, replacementText: 'ABCDEF' }] };
  const store = { input: clone(input), intakeGeneration: 1, sessionToken: { sessionId: 'review', sourcePacketHash: 'packet' },
    keyAuthority: { scope: 'full-manuscript', keyRef: 'private-key-ref',
      exportMap: { scenes: [{ sceneId: 'a.txt', rawSha256: 'sha256:' + hash(before.raw) }] }, scenePathBySceneId: { 'a.txt': h.file } },
    mediaReturnCandidate: { sceneId: 'a.txt', beforeDoc, plan,
      raw: before.raw, parsed: before.parsed, changeId } };
  Object.assign(h.c, { activeRtkCleanLinkLabelApplyStore: store, activeReviewSessionLifecycle: 'active',
    activeReviewSessionStore: { sessionId: 'review', sourcePacketHash: 'packet' }, activeDocxReviewIntakeGeneration: 1,
    getProjectRootPath: () => projectRoot, fsSync: fs,
    readRtkNonOverlapTrackedReplacementSessionToken: session => session,
    resolveDocxReviewRoundKeyHandle: async () => { if (h.afterKey) { const fn = h.afterKey; h.afterKey = null; fn(); } return { state: h.keyState || 'ACTIVE' }; },
    verifyFullManuscriptCurrentSceneBindings: require('../../src/main/rtkDocxActivationGuards.cjs').verifyFullManuscriptCurrentSceneBindings,
    isPathInsideBoundary: (root, file) => file.startsWith(root + path.sep),
    makeReviewExactTextApplyContextBlock: reason => ({ ok: false, reason }),
    publishReviewSceneWithProjectTransaction: () => { throw Error('ORDINARY_WRITER_MUST_NOT_RUN'); },
    normalizeReviewExactTextApplyString: value => typeof value === 'string' ? value.trim() : '',
  });
  vm.runInContext(main.slice(main.indexOf('function cleanLinkLabelStoreMatches('), main.indexOf('function mapMarkdownErrorCode(')), h.c);
  return { input, store, candidateDoc, apply: value => h.c.runReviewExactTextBatchSafeWriteFromMainState(() => { throw Error('FORGED_ORDINARY_WRITER'); }, value || input) };
}

function savedDoc(h) { return envelope.parseObservablePayload(fs.readFileSync(h.file, 'utf8')).doc; }
test('actual Main media Apply atomically adds an asset, retains rich history and rejects replay', async t => {
  const h = await harness(t), r = returnHarness(h), before = h.working;
  const result = await r.apply(); assert.equal(result.ok, true, JSON.stringify(result)); assert.equal(h.writes, 1);
  const after = savedDoc(h), placement = mediaModel.mediaPlacements(after)[0];
  assert.equal(envelope.deriveVisibleTextFromDocument(after), 'AB');
  assert.deepEqual(fs.readFileSync(path.join(path.dirname(h.file), placement.attrs.assetPath)), jpeg.rgb);
  assert.equal(fs.readFileSync(result.receipt.userBookmarkHistorySnapshot.snapshotPath, 'utf8'), before);
  assert.equal(result.receipt.mediaReturnPublication.savedContent, fs.readFileSync(h.file, 'utf8'));
  assert.equal((await r.apply()).ok, false); assert.equal(h.writes, 1);
});
for (const operation of ['delete', 'resize', 'replace', 'repeated']) test(`actual Main ${operation} preserves original shared bytes`, async t => {
  const before = mediaModel.planMediaReturn({ beforeDoc: initialDoc(), placements: [{ paragraphIndex: 0, offset: 1, attrs: media.createImageAttrs(jpeg.rgb) }] }).doc;
  const h = await harness(t, before), original = mediaModel.mediaPlacements(before)[0];
  const asset = path.join(path.dirname(h.file), original.attrs.assetPath); fs.mkdirSync(path.dirname(asset), { recursive: true }); fs.writeFileSync(asset, jpeg.rgb);
  h.placements = operation === 'delete' ? [] : operation === 'resize'
    ? [{ ...original, attrs: { ...original.attrs, displayWidthEmu: 1800000, displayHeightEmu: 1200000 } }]
    : operation === 'replace' ? [{ ...original, attrs: media.createImageAttrs(jpeg.gray) }]
    : [original, { ...original, offset: 2 }];
  const r = returnHarness(h), result = await r.apply(); assert.equal(result.ok, true, JSON.stringify(result));
  assert.deepEqual(mediaModel.mediaPlacements(savedDoc(h)), h.placements);
  assert.deepEqual(fs.readFileSync(asset), jpeg.rgb);
});
for (const kind of ['publicCandidate', 'mixedBatch', 'foreignSession', 'inactiveKey', 'asyncSession', 'richSource', 'diskCAS', 'capability', 'generation', 'project', 'symlink', 'assetCollision']) {
  test(`actual media gate rejects ${kind} without any scene, manifest or resource publication`, async t => {
    const h = await harness(t), r = returnHarness(h), input = clone(r.input), root = path.dirname(h.file);
    if (kind === 'publicCandidate') input.mediaReturnCandidate = r.store.mediaReturnCandidate;
    if (kind === 'mixedBatch') input.reviewItems.push({ changeId: 'ordinary-text' });
    if (kind === 'foreignSession') h.c.activeReviewSessionStore.sourcePacketHash = 'foreign';
    if (kind === 'inactiveKey') h.keyState = 'REVOKED';
    if (kind === 'asyncSession') h.afterKey = () => { h.c.activeReviewSessionLifecycle = 'closed'; };
    if (kind === 'richSource') { const d = initialDoc(); d.content[0].content[0].marks = [{ type: 'bold' }]; h.working = envelope.composeObservablePayload({ doc: d }); }
    if (kind === 'diskCAS') fs.appendFileSync(h.file, 'foreign');
    if (kind === 'capability') h.allowed = false;
    if (kind === 'generation') h.c.lastSignaledEditGeneration = 1;
    if (kind === 'project') h.c.currentFilePath = path.join(root, 'foreign.txt');
    const asset = path.join(root, r.store.mediaReturnCandidate.plan.after[0].attrs.assetPath);
    if (kind === 'symlink' || kind === 'assetCollision') {
      fs.mkdirSync(path.dirname(asset), { recursive: true });
      if (kind === 'symlink') fs.symlinkSync(h.file, asset); else fs.writeFileSync(asset, 'foreign');
    }
    const before = fs.readFileSync(h.file), manifest = fs.readFileSync(h.manifestPath);
    try { assert.equal((await r.apply(input)).ok, false); } catch (error) { assert.equal(kind, 'capability', error.stack); }
    assert.equal(h.writes, 0); assert.deepEqual(fs.readFileSync(h.file), before); assert.deepEqual(fs.readFileSync(h.manifestPath), manifest);
    if (kind === 'symlink') assert.equal(fs.lstatSync(asset).isSymbolicLink(), true);
    else if (kind === 'assetCollision') assert.equal(fs.readFileSync(asset, 'utf8'), 'foreign');
    else assert.equal(fs.existsSync(asset), false);
  });
}

test('actual authority store selects current project after switching and rejects mixed persistence', () => {
  const project = root => ({ lastRoundId: 'round-' + root, roundsById: { ['round-' + root]: { projectRoot: root } } });
  const previous = project('/first'), current = project('/second');
  const c = vm.createContext({ activeReviewDocxExportAuthorityStore: previous,
    isPlainObjectValue: v => v && typeof v === 'object' && !Array.isArray(v), getProjectRootPath: () => '/second',
    readDurableDocxReviewReturnAuthorityStore: options => { assert.equal(options.projectRoot, '/second'); return current; },
    docxReviewPreviewSessionDetailString: value => typeof value === 'string' ? value.trim() : '' });
  vm.runInContext(main.slice(main.indexOf('function readActiveDocxReviewReturnAuthorityStore('), main.indexOf('// ROUND-01 (V3): import an export-time')), c);
  vm.runInContext(main.slice(main.indexOf('function projectRootFromDocxReviewAuthorityStore('), main.indexOf('async function persistDocxReviewReturnAuthorityStore(')), c);
  assert.equal(c.readActiveDocxReviewReturnAuthorityStore({ projectRoot: '/second' }), current);
  assert.equal(c.projectRootFromDocxReviewAuthorityStore(current), '/second');
  assert.throws(() => c.projectRootFromDocxReviewAuthorityStore({ roundsById: { ...previous.roundsById, ...current.roundsById } }), /MIXED_PROJECTS/);
  assert.equal(previous.roundsById['round-/first'].projectRoot, '/first');
});

test('actual editor schema defaults do not falsely mark an unchanged imported media scene stale', async t => {
  const { getSchema } = await import('@tiptap/core'), { default: StarterKit } = await import('@tiptap/starter-kit');
  const { DocumentMedia } = await import('../../src/renderer/tiptap/documentMedia.mjs');
  const { UserBookmarks, UserBookmarkLink } = await import('../../src/renderer/tiptap/userBookmarks.mjs');
  const { WordPendingRevisions } = await import('../../src/renderer/tiptap/wordPendingRevisions.mjs');
  const before = initialDoc(); before.content[0].content[0].marks = [{ type: 'link', attrs: { href: 'https://example.invalid/' } }];
  const h = await harness(t, before), schema = getSchema([StarterKit.configure({ link: false }), DocumentMedia, UserBookmarks, UserBookmarkLink, WordPendingRevisions]);
  const live = schema.nodeFromJSON(before).toJSON();
  assert.equal(mediaModel.mediaSourceEqual(live, before), true);
  h.working = envelope.composeObservablePayload({ doc: live });
  const result = await returnHarness(h).apply(); assert.equal(result.ok, true, JSON.stringify(result));
  const changed = clone(live); changed.content[0].content[0].marks[0].attrs.href = 'https://other.invalid/';
  assert.equal(mediaModel.mediaSourceEqual(changed, before), false);
  const rootChanged = clone(live); rootChanged.attrs.foreign = null;
  assert.equal(mediaModel.mediaSourceEqual(rootChanged, before), false);
});

test('imported scenes materialize an empty metadata panel without authoring metadata or blocking media Apply', async t => {
  const h = await harness(t), raw = envelope.parseObservablePayload(h.working);
  assert.equal(raw.hasMetaBlock, false);
  h.working = envelope.composeObservablePayload({ ...raw, doc: raw.doc, metaEnabled: true });
  const result = await returnHarness(h).apply(); assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(envelope.parseObservablePayload(fs.readFileSync(h.file, 'utf8')).hasMetaBlock, false);
});
test('an unsaved synopsis in the materialized scene panel remains a no-write conflict', async t => {
  const h = await harness(t), raw = envelope.parseObservablePayload(h.working);
  h.working = envelope.composeObservablePayload({ ...raw, doc: raw.doc, metaEnabled: true, meta: { ...raw.meta, synopsis: 'unsaved owner content' } });
  const result = await returnHarness(h).apply(); assert.equal(result.ok, false); assert.equal(h.writes, 0);
});

test('media intake refuses notes without authenticated proof before acquiring a candidate', async () => {
  const start = main.indexOf('async function prepareCleanMediaReturnCapsule('), end = main.indexOf('\nasync function ', start + 1);
  const c = vm.createContext({ compareCommentExportReadback: () => ({ ok: true }),
    loadDocumentContentEnvelopeModule: () => { throw Error('must refuse before baseline access'); } });
  vm.runInContext(main.slice(start, end), c);
  for (const documentNotes of [{ sourceBindings: [{}] }, { notes: [{}] }]) {
    const result = await c.prepareCleanMediaReturnCapsule({ documentNotes }, { reviewIr: { documentNotes: { notes: [] } } }, {}, {});
    assert.equal(result.code, 'RTK_MEDIA_ANNOTATION_COMPOSITE_UNSUPPORTED');
  }
});

test('media editor publication preserves a newer buffer or changed project after disk Apply', async t => {
  for (const mode of ['generation', 'project', 'async-lifecycle']) {
    const h = await harness(t), r = returnHarness(h), applied = await r.apply();
    assert.equal(applied.ok, true);
    const committed = fs.readFileSync(h.file);
    h.c.mainWindow.webContents.isDestroyed = () => false;
    h.c.getProjectDocumentIdentityPayload = async () => {
      if (mode === 'async-lifecycle') h.subject = 'new-life';
      return {};
    };
    h.c.attachProjectIdToEditorPayload = async payload => payload;
    const newer = h.working + '\nowner edit'; h.working = newer;
    if (mode === 'generation') h.c.lastSignaledEditGeneration = 2;
    if (mode === 'project') h.c.currentFilePath = path.join(path.dirname(h.file), 'another.txt');
    const result = await h.c.syncReviewExactTextApplyEditorFromMainState({ applyInput: r.input, receipt: applied.receipt });
    assert.equal(result.ok, false); assert.equal(h.publications.length, 0);
    assert.equal(h.working, newer); assert.deepEqual(fs.readFileSync(h.file), committed);
  }
});

for (const mode of ['same', 'changed', 'missing', 'wrong-project', 'during-commit']) {
  test(`actual media Apply protects notes source: ${mode}`, async t => {
    const h = await harness(t), r = returnHarness(h), projectRoot = path.dirname(h.file);
    const notesModel = require('../../src/core/word-manuscript-notes-v1.cjs');
    const storage = await import('../../src/product/notesStoragePersistence.mjs');
    const schema = await import('../../src/core/notesStorage.mjs');
    const document = schema.normalizeNotesDocument({ schemaVersion: 1, projectId: 'p', notes: [
      { id: 'private', title: 'Private', scope: 'project', body: 'Owner text', deleted: false },
      { id: 'note-a', title: '', scope: 'manuscript', body: 'Note body', deleted: false,
        manuscript: notesModel.bindManuscriptPayload({ body: doc('Note body'), kind: 'footnote', sceneId: 'a.txt', offsetUtf16: 1, sceneContent: 'AB' }) },
    ] }, { projectId: 'p', now: () => '2026-10-01T00:00:00Z' }).value;
    const notesPath = storage.getNotesStoragePath(projectRoot), noteText = JSON.stringify(document);
    fs.writeFileSync(notesPath, noteText);
    r.store.mediaReturnCandidate.noteSourceGuard = { projectId: 'p', projectRoot, sourceText: noteText };
    h.c.manuscriptNoteModel = notesModel;
    h.c.loadNotesStorageModule = async () => ({ ...storage, readNotesStorage: async options => {
      const result = await storage.readNotesStorage(options);
      if (mode === 'during-commit') fs.writeFileSync(notesPath, noteText + '\n');
      return result;
    } });
    h.c.getProjectNotesContext = async () => ({ ok: true, projectRoot: mode === 'wrong-project' ? projectRoot + '-foreign' : projectRoot });
    h.c.readProjectNotesDocument = async () => {
      const current = await storage.readNotesStorage({ projectRoot, projectId: 'p' });
      return { ok: current.ok, current };
    };
    if (mode === 'changed') fs.writeFileSync(notesPath, noteText + '\n');
    if (mode === 'missing') fs.unlinkSync(notesPath);
    const rawBefore = fs.readFileSync(h.file, 'utf8'), result = await r.apply();
    if (mode === 'same') {
      assert.equal(result.ok, true, JSON.stringify(result)); assert.equal(h.writes, 1);
      assert.equal(fs.readFileSync(notesPath, 'utf8'), noteText);
      assert.equal(mediaModel.mediaPlacements(savedDoc(h)).length, 1);
    } else {
      assert.equal(result.ok, false, JSON.stringify(result)); assert.equal(h.writes, 0);
      assert.equal(fs.readFileSync(h.file, 'utf8'), rawBefore);
      assert.equal(fs.existsSync(path.join(projectRoot, r.store.mediaReturnCandidate.plan.after[0].attrs.assetPath)), false);
    }
  });
}

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
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'local-image-runtime-'))); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const manifestPath = path.join(dir, 'project.craftsman.json'); fs.writeFileSync(manifestPath, JSON.stringify({ schemaVersion: 1, projectId: 'p' }));
  const file = path.join(dir, 'a.txt'); fs.writeFileSync(file, envelope.composeObservablePayload({ doc: initial }));
  const selected = path.join(dir, 'chosen.jpg'); fs.writeFileSync(selected, jpeg.rgb);
  const h = { selected, position: 2, writes: 0, generation: 0, working: fs.readFileSync(file, 'utf8'), publications: [], dirty: false };
  const c = vm.createContext({ console, Buffer, JSON, require: require('node:module').createRequire(path.join(__dirname, '../../src/main.js')),
    dialog: { showOpenDialog: async () => { if (h.onPicker) await h.onPicker(); return h.cancel ? { canceled: true } : { canceled: false, filePaths: [h.selected] }; } },
    handleSave: async () => true, logDevError: () => {}, updateStatus: value => { h.status = value; }, userBookmarkModel: core, wordMediaReturnModel: mediaModel, wordMediaData: media, pendingTextRevisions: pending,
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
    requestEditorSnapshot: async () => ({ content: h.working, generation: h.generation, imageInsertionPosition: h.position }),
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
      .concat(['cmd.project.media.insertLocal', 'cmd.project.review.applyExactTextChange', 'cmd.project.review.applyExactTextChangesBatch'])),
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
  c.isPathInsideBoundary = (root, file) => file.startsWith(root + path.sep);
  h.insert = async (payload = { editorMode: 'tiptap' }) => { const r = await h.dispatch('cmd.project.media.insertLocal', payload); return typeof r.value?.ok === 'boolean' ? r.value : r; };
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

test('local image actual command commits content-addressed asset and incrementally publishes the exact scene', async t => {
  const h = await harness(t), before = h.working;
  const r = await h.insert(); assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(h.writes, 1); assert.notEqual(h.working, before);
  const doc = envelope.parseObservablePayload(h.working).doc;
  const placement = mediaModel.mediaPlacements(doc)[0];
  assert.equal(placement.offset, 1);
  assert.deepEqual(fs.readFileSync(path.join(path.dirname(h.file), placement.attrs.assetPath)), jpeg.rgb);
  assert.equal(fs.readFileSync(h.file,'utf8'), h.working);
  assert.equal(h.publications[0].localImageAuthoringPublication, true);
  assert.equal(h.publications[0].position, 2);
  assert.equal(h.dirty, false);
});
for (const failure of ['cancel','generation','lifecycle','project','capability','disk','symlink','corrupt','cursor','payload']) {
  test(`local image ${failure} during picker cannot publish an image or asset`, async t => {
    const h = await harness(t), before = fs.readFileSync(h.file), manifest = fs.readFileSync(h.manifestPath);
    if (failure === 'cancel') h.cancel = true;
    if (failure === 'cursor') h.position = 999;
    h.onPicker = async () => {
      if (failure === 'generation') h.c.lastSignaledEditGeneration = 1;
      if (failure === 'lifecycle') h.subject = 'other';
      if (failure === 'project') h.c.currentFilePath = path.join(path.dirname(h.file),'other.txt');
      if (failure === 'capability') h.c.evaluateWriterLocalCommandAccess = () => ({ allowed:false });
      if (failure === 'disk') fs.appendFileSync(h.file,'foreign');
      if (failure === 'symlink') { fs.unlinkSync(h.selected); fs.symlinkSync(h.file,h.selected); }
      if (failure === 'corrupt') fs.writeFileSync(h.selected,'not image');
    };
    const r = await h.insert(failure === 'payload' ? { path:h.selected } : { editorMode:'tiptap' });
    assert.equal(r.ok, failure === 'cancel', JSON.stringify(r));
    assert.equal(h.writes,0); assert.equal(h.publications.length,0);
    assert.equal(fs.existsSync(path.join(path.dirname(h.file),'assets')),false);
    assert.deepEqual(fs.readFileSync(h.manifestPath),manifest);
    assert.deepEqual(fs.readFileSync(h.file),failure === 'disk' ? Buffer.concat([before,Buffer.from('foreign')]) : before);
  });
}

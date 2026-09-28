'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), vm = require('node:vm');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), crypto = require('node:crypto');
const model = require('../../src/core/word-pending-text-revisions-v1.cjs');
const envelope = require('../../src/core/document-content-envelope-v1.cjs');
const { buildFullManuscriptDocxReviewPacketSource } = require('../../src/export/docx/fullManuscriptDocxReviewPacketSource.js');
const { buildDocxReviewPacketBuffer } = require('../../src/export/docx/docxReviewPacketBuilder.js');
const { createCommandSurfaceKernel } = require('../../src/command/commandSurfaceKernel.js');
const main = fs.readFileSync(path.join(__dirname, '../../src/main.js'), 'utf8');
const prepareSource = main.slice(main.indexOf('async function prepareAuthenticatedPendingReturn('), main.indexOf('// Only an object retained by authenticated main intake'));
const source = main.slice(main.indexOf('const authenticatedPendingReturnAdmissions ='), main.indexOf('async function handleCommentAuthoringCommand('));
const bus = main.slice(main.indexOf('function dispatchMenuCommand('), main.indexOf('function buildCommandClickHandler('));
const id = 'cmd.project.review.decidePendingRevision';
const hash = v => crypto.createHash('sha256').update(v).digest('hex');
function document() {
  return model.bindLedger({ schemaVersion: 1, source: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'oldnew' }] }] },
    revisions: ['delete', 'insert'].map((operation, i) => ({ id: 'revision-' + (i + 1), nativeId: '' + i, operation, author: 'A', date: '', dateUtc: '',
      paragraphIndex: 0, from: i * 3, to: i * 3 + 3, state: 'pending', groupId: 'group-1' })), undo: [], redo: [] });
}
async function harness(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pending-runtime-')); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'roman')); const file = path.join(root, 'roman/a.txt'); fs.writeFileSync(file, envelope.composeObservablePayload({ doc: document() }));
  const h = { writes: 0, opens: 0, snapshot: null, race: null };
  const context = () => { const raw = fs.readFileSync(file, 'utf8'); return { filePath: file, projectRoot: root, projectId: 'p', sceneId: 'roman/a.txt',
    subjectId: 'life:session', saved: { state: { threads: h.threads || [] } }, sceneSha256: hash(raw), raw, parsed: envelope.parseObservablePayload(raw) }; };
  const c = { pendingTextRevisions: model, isPlainObjectValue: v => v && typeof v === 'object' && !Array.isArray(v),
    queueDiskOperation: fn => fn(), readCommentAuthoringContext: async () => context(), requestEditorSnapshot: async () => {
      const value = h.snapshot || { generation: 0, content: fs.readFileSync(file, 'utf8') }; if (h.afterSnapshot) h.afterSnapshot(); return value;
    }, loadDocumentContentEnvelopeModule: async () => envelope, fs: fs.promises,
    loadNotesStorageModule: async () => ({ readNotesStorage: async () => ({ ok: true, document: { notes: h.notes || [] } }) }),
    currentFilePath: file, currentLifecycleSubjectId: () => 'life', commentAuthoringSessionId: 'session',
    isDirty: false, autoSaveInProgress: false, lastSignaledEditGeneration: 0,
    commitWriterProjectSnapshot: async (target, content, generation, profile, label, options) => {
      assert.equal(target, file); assert.equal(options.pendingRevisionDecision, true);
      if (h.race) h.race(); await options.beforeScenePublish();
      assert.equal(fs.readFileSync(file, 'utf8'), options.expectedSceneContent);
      h.writes++; fs.writeFileSync(file, content); return { success: true, projectTransaction: true };
    }, openProjectDocumentFile: async () => { throw Error('nested navigation would deadlock disk queue'); },
    getProjectDocumentIdentityPayload: async () => ({ documentId: 'd' }),
    getDocumentContextFromPath: () => ({ title: 'scene', kind: 'scene', metaEnabled: true }),
    attachProjectIdToEditorPayload: async value => { if (h.publicationRace) h.publicationRace(); return value; },
    sendEditorText: value => { h.opens++; assert.equal(value.content, fs.readFileSync(file, 'utf8')); },
    computeHash: hash, backupHashes: new Map(), lastAutosaveHash: '', updateStatus() {},
    COMMAND_BUS_ROUTE: 'command.bus', resolveMenuCommandId: commandId => ({ ok: true, commandId }),
    evaluateWriterLocalCommandAccess: () => ({ allowed: h.allowed !== false, reason: 'PROFILE_DENIED' }), getWriterLocalRuntimeProfile: () => ({}),
    getProductCommandRecord: () => null, decideCommandEntitlement: () => ({ available: h.entitled !== false, reason: 'ENTITLEMENT_DENIED' }),
    getProductEntitlementTier: () => 'free', E_COMMAND_DISABLED_FOR_ENTITLEMENT: 'ENTITLEMENT_DENIED', isMenuLocalCustomizationCommandId: () => false,
  };
  Object.assign(c, { Buffer, activeStage10ApplicationBootstrap: {}, getProjectRootPath: () => root,
    createRtkReviewTransportCryptoPort: () => ({ sha256Text: text => 'sha256:' + hash(text), sha256Json: v => 'sha256:' + hash(JSON.stringify(v)), byteLength: v => Buffer.byteLength(v) }),
    docxReviewReturnIntakeProductBudgets: () => ({}), resetActiveReviewSessionStore: () => { h.reset = (h.reset || 0) + 1; },
  });
  vm.createContext(c); vm.runInContext(source + '\n' + bus + '\n' + prepareSource, c);
  const kernel = createCommandSurfaceKernel({ [id]: payload => c.handlePendingRevisionCommand(payload) });
  c.MENU_COMMAND_HANDLERS = { [id]: payload => kernel.dispatch(id, payload) };
  h.command = (action, override = {}) => c.dispatchMenuCommand(id, { projectId: 'p', sceneId: 'roman/a.txt', subjectId: 'life:session',
    expectedSceneSha256: context().sceneSha256, action, ...override }, { route: 'command.bus' });
  h.c = c; h.file = file; h.context = context;
  const b = await import('../../src/io/revisionBridge/index.mjs');
  const doc = document(); doc.content[0].content.push({ type: 'text', text: ' added' });
  doc.attrs.wordPendingRevisions.source.content[0].content.push({ type: 'text', text: ' added' });
  const exported = buildFullManuscriptDocxReviewPacketSource({ projectId: 'p', projectRoot: root,
    scenes: [{ sceneId: 'roman/a.txt', scenePath: file, text: 'new added', doc, order: 0 }] });
  const bytes = buildDocxReviewPacketBuffer(exported);
  const capsule = { ...exported.localAuthorityCapsule, projectRoot: root, roundId: 'round-1',
    exportMapAuthority: 'main-owned-active-export-authority-store-after-return-authentication', returnedArtifactExportMapAccepted: false,
    scenePathBySceneId: { 'roman/a.txt': file }, baselineObservableContentBySceneId: { 'roman/a.txt': context().raw } };
  h.input = { context: { projectId: 'p', projectRoot: root, reviewTransportAuthorityCapsule: capsule,
    reviewTransportReturnIntake: { authenticated: true, returnedArtifactSha256: 'sha256:' + hash(bytes) } },
    requestId: 'return-test', isCurrent: () => h.current !== false, docxBytes: bytes, revisionBridge: b,
    onPrepared: value => { h.prepared = value; } };
  h.prepare = () => c.prepareAuthenticatedPendingReturn(h.input);
  return h;
}
test('actual authenticated preparation and Kernel write round history; restart, undo, replay and redo', async t => {
  const h = await harness(t);
  let result = await h.prepare(); assert.equal(result.status, 'preview-ready', JSON.stringify(result));
  assert.equal(h.writes, 0); assert.equal(model.projection(h.prepared.changes.after).current, 'new added');
  result = await h.prepared.apply(); assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(h.writes, 1); assert.equal(h.reset, 1); assert.equal(h.opens, 1);
  assert.equal(model.projection(h.context().parsed.doc).current, 'new added');
  assert.equal((await h.command('undo')).ok, true); assert.equal(model.projection(h.context().parsed.doc).current, 'new');
  result = await h.prepare(); assert.equal(result.status, 'replayed', JSON.stringify(result)); assert.equal(h.writes, 2);
  assert.equal((await h.command('redo')).ok, true); assert.equal(model.projection(h.context().parsed.doc).current, 'new added');
});
for (const kind of ['project', 'hash', 'untrustedMap', 'wrongScene', 'multipleScenes', 'baseline', 'superseded',
  'dirty', 'generation', 'draft', 'noteDraft', 'annotations', 'notes', 'liveText', 'diskRace', 'capability', 'serializedAdmission', 'returnedComment', 'returnedNote', 'consumed']) {
  test(`authenticated return blocks ${kind} before writing`, async t => {
    const h = await harness(t), capsule = h.input.context.reviewTransportAuthorityCapsule;
    const before = fs.readFileSync(h.file, 'utf8');
    if (kind === 'project') h.input.context.projectId = 'foreign';
    if (kind === 'hash') h.input.context.reviewTransportReturnIntake.returnedArtifactSha256 = 'sha256:' + '0'.repeat(64);
    if (kind === 'untrustedMap') capsule.returnedArtifactExportMapAccepted = true;
    if (kind === 'wrongScene') capsule.scenePathBySceneId['roman/a.txt'] = '/foreign';
    if (kind === 'multipleScenes') capsule.exportMap.scenes.push(structuredClone(capsule.exportMap.scenes[0]));
    if (kind === 'baseline') capsule.baselineObservableContentBySceneId['roman/a.txt'] += '\n';
    if (kind === 'returnedComment') h.input.context.reviewTransportReturnIntake.parserResult = { reviewIr: { commentThreads: [{}] } };
    if (kind === 'returnedNote') h.input.context.reviewTransportReturnIntake.parserResult = { reviewIr: { documentNotes: { notes: [{}] } } };
    let result = await h.prepare();
    if (h.prepared) {
      if (kind === 'superseded') h.current = false;
      if (kind === 'dirty') h.c.isDirty = true;
      if (kind === 'generation') h.c.lastSignaledEditGeneration++;
      if (kind === 'draft' || kind === 'noteDraft') h.snapshot = { generation: 0, content: before,
        [kind === 'draft' ? 'commentAuthoringPending' : 'manuscriptNoteAuthoringPending']: true };
      if (kind === 'annotations') h.threads = [{ sceneId: 'roman/a.txt', status: 'open' }];
      if (kind === 'notes') h.notes = [{ manuscript: { reference: { sceneId: 'roman/a.txt' } } }];
      if (kind === 'liveText') h.snapshot = { generation: 0, content: envelope.composeObservablePayload({ doc: model.decide(document(), { action: 'rejectAll' }).doc }) };
      if (kind === 'diskRace') h.race = () => { fs.writeFileSync(h.file, 'owner changed scene'); };
      if (kind === 'capability') h.allowed = false;
      if (kind === 'serializedAdmission') result = await h.command('authenticated-pending-return');
      else {
        if (kind === 'consumed') {
          h.allowed = false; await assert.rejects(h.prepared.apply()); h.allowed = true;
        }
        try { result = await h.prepared.apply(); } catch (error) { result = { ok: false, code: error.message }; }
      }
    }
    assert.equal(result.ok, false, JSON.stringify(result)); assert.equal(h.writes, 0);
    assert.equal(fs.readFileSync(h.file, 'utf8'), kind === 'diskRace' ? 'owner changed scene' : before);
  });
}

test('native confirmation describes complete semantics, defaults to Cancel, and refuses truncated previews', async t => {
  const h = await harness(t); assert.equal((await h.prepare()).status, 'preview-ready');
  const dialogSource = main.slice(main.indexOf('async function confirmLocalWordPendingReturn('), main.indexOf('async function confirmLocalWordNoteDelta('));
  let calls = 0;
  Object.assign(h.c, { mainWindow: { isDestroyed: () => false }, dialog: { showMessageBox: async (_window, options) => {
    calls++; assert.equal(options.cancelId, 0); assert.equal(options.defaultId, 0);
    for (const text of ['До возврата', 'После возврата', 'Исходный текст', 'Текущий текст', 'Вставка', 'Удаление', 'new', 'old', 'added']) assert.ok(options.detail.includes(text));
    return { response: 0 };
  } } });
  vm.runInContext(dialogSource, h.c);
  assert.equal(await h.c.confirmLocalWordPendingReturn({ fileName: 'Word.docx', changes: h.prepared.changes }), false);
  assert.equal(h.writes, 0); assert.equal(calls, 1);
  await assert.rejects(h.c.confirmLocalWordPendingReturn({ fileName: 'x'.repeat(32001), changes: h.prepared.changes }), /PREVIEW_BUDGET/);
  assert.equal(calls, 1);
});

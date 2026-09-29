'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), vm = require('node:vm');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), crypto = require('node:crypto');
const model = require('../../src/core/word-pending-text-revisions-v1.cjs');
const recording = require('../../src/core/word-pending-recording-v1.cjs');
const envelope = require('../../src/core/document-content-envelope-v1.cjs');
const tx = require('../../src/core/project-transaction-v1.cjs');
const gateway = require('../../src/core/legacy-strangler-v1.cjs');
const { durableSaveTransaction } = require('../../src/core/save-coordinator-v1.cjs');
const { planCommentAnchorSave } = require('../../src/core/word-comment-anchor-save-v1.cjs');
const { createCommandSurfaceKernel } = require('../../src/command/commandSurfaceKernel.js');
const { evaluateWriterLocalCommandAccess, createWriterLocalProfileProjection } = require('../../src/core/writer-local-profile-v1.cjs');
const { decideCommandEntitlement } = require('../../src/core/entitlement-law-v1.cjs');
const main = fs.readFileSync(path.join(__dirname, '../../src/main.js'), 'utf8');
const extract = name => main.match(new RegExp('(?:async )?function ' + name + '\\([^]*?\\n}'))[0];
const id = 'cmd.project.review.recordTextRevisions';
const hash = v => crypto.createHash('sha256').update(v).digest('hex');
const doc = text => ({ type: 'doc', content: [{ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] }] });
async function harness(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'recording-runtime-')); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const file = path.join(root, 'roman/a.txt'), manifest = path.join(root, 'project.json');
  fs.mkdirSync(path.dirname(file)); fs.writeFileSync(file, envelope.composeObservablePayload({ doc: doc('Alpha beta') }));
  fs.writeFileSync(manifest, JSON.stringify({ projectId: 'recording-project', revision: 1 }));
  const h = { writes: 0, generation: 0, editor: fs.readFileSync(file, 'utf8'), publications: 0 };
  const context = () => { const raw = fs.readFileSync(file, 'utf8'); return { filePath: file, projectRoot: root, projectId: 'recording-project', sceneId: 'roman/a.txt',
    subjectId: 'life:session', saved: { state: { threads: [] } }, sceneSha256: hash(raw), raw, parsed: envelope.parseObservablePayload(raw) }; };
  const { createMainProjectManifestAuthority } = await import('../../src/product/mainProjectManifestAuthority.mjs');
  const authority = createMainProjectManifestAuthority({ anchorRoot: path.join(root, 'leases'), useLeaseHeartbeatWorker: false });
  const requests = new Map();
  const c = { Buffer, crypto, setTimeout, clearTimeout, pendingSnapshotRequests: requests,
    pendingTextRevisions: model, pendingRecordingModel: recording, cloneJsonSafe: v => JSON.parse(JSON.stringify(v)),
    isPlainObjectValue: v => v && typeof v === 'object' && !Array.isArray(v),
    queueDiskOperation: fn => fn(), readCommentAuthoringContext: async () => { if (c.isDirty || c.autoSaveInProgress) throw Error('DIRTY'); return context(); },
    loadDocumentContentEnvelopeModule: async () => envelope, fs: fs.promises, path,
    loadRtkNonTextReturnModule: async () => ({ readCommentAuthoringState: async () => ({ text: null, state: { threads: h.threads || [] } }) }),
    loadNotesStorageModule: () => import('../../src/product/notesStoragePersistence.mjs'),
    currentFilePath: file, currentLifecycleSubjectId: () => h.lifecycle || 'life', commentAuthoringSessionId: 'session',
    isDirty: false, autoSaveInProgress: false, activeAutoSavePromise: null, lastSignaledEditGeneration: 0,
    getProjectDocumentIdentityPayload: async () => ({ documentId: 'd' }),
    getDocumentContextFromPath: () => ({ title: 'scene', kind: 'scene', metaEnabled: true }),
    attachProjectIdToEditorPayload: async value => { if (h.publicationRace) h.publicationRace(); return value; },
    sendEditorText: value => { h.publications++; h.editor = value.content; },
    computeHash: hash, backupHashes: new Map(), lastAutosaveHash: '', updateStatus() {},
    COMMAND_BUS_ROUTE: 'command.bus', resolveMenuCommandId: commandId => ({ ok: true, commandId }),
    evaluateWriterLocalCommandAccess: options => h.allowed === false ? { allowed: false, reason: 'PROFILE_DENIED' } : evaluateWriterLocalCommandAccess(options),
    getWriterLocalRuntimeProfile: () => createWriterLocalProfileProjection({ isPackaged: true, platform: 'darwin' }),
    getProductCommandRecord: () => null, decideCommandEntitlement: (command, tier) => h.entitled === false ? { available: false, reason: 'DENIED' } : decideCommandEntitlement(command, tier),
    getProductEntitlementTier: () => 'free', E_COMMAND_DISABLED_FOR_ENTITLEMENT: 'ENTITLEMENT_DENIED', isMenuLocalCustomizationCommandId: () => false,
    activeStage10ApplicationBootstrap: {},
    readReviewExactTextApplyProjectBinding: async () => ({ ok: true, projectRoot: root, projectId: h.foreignProject ? 'foreign' : 'recording-project' }),
    ...gateway, SAVE_AUTHORITY_OBSERVER_IDS: gateway.OBSERVER_IDS, durableSaveTransaction, planCommentAnchorSave,
    manuscriptNoteModel: require('../../src/core/word-manuscript-notes-v1.cjs'),
    prepareBookProfileManifestForFile: async target => ({ manifestPath: manifest, projectId: 'recording-project', expectedText: fs.readFileSync(manifest, 'utf8'), nextText: fs.readFileSync(manifest, 'utf8') }),
    getMainProjectManifestAuthority: async () => authority,
    getProjectRelativeFilePath: target => path.relative(root, target),
    loadProRoundtripPreservationModule: async () => ({ applyFreeEditProDataInvalidation: value => ({ ok: true, manifest: value }) }),
    commitProjectTransaction: async args => { if (h.writeFailure) throw Error('INJECTED_WRITE_FAILURE'); const r = await tx.commitProjectTransaction(args); h.writes++; return r; },
  };
  c.mainWindow = { isDestroyed: () => false, webContents: { send: (_channel, { requestId }) => {
    const p = requests.get(requestId); clearTimeout(p.timeoutId); requests.delete(requestId);
    p.resolve({ content: h.editor, generation: h.generation, commentAuthoringPending: h.draft === true });
  } } };
  vm.createContext(c);
  const recordingSource = main.slice(main.indexOf('let activePendingRecording ='), main.indexOf('const authenticatedPendingReturnAdmissions ='));
  vm.runInContext([extract('commitWriterProjectSnapshot'), extract('requestEditorSnapshot'), recordingSource,
    main.slice(main.indexOf('function dispatchMenuCommand('), main.indexOf('function buildCommandClickHandler('))].join('\n'), c);
  const kernel = createCommandSurfaceKernel({ [id]: payload => c.handlePendingRecordingCommand(payload) });
  c.MENU_COMMAND_HANDLERS = { [id]: payload => kernel.dispatch(id, payload) };
  h.capture = () => c.requestEditorSnapshot();
  h.commit = snapshot => c.commitWriterProjectSnapshot(file, snapshot.content, snapshot.generation, null, 'test recording save');
  h.save = async () => { const s = await h.capture(); const result = await h.commit(s); if (result.success) c.isDirty = false; return result; };
  c.handleSave = async () => (await h.save()).success === true;
  h.command = (action, override = {}) => c.dispatchMenuCommand(id, { projectId: 'recording-project', sceneId: 'roman/a.txt', subjectId: 'life:session',
    ...(action === 'start' ? { expectedSceneSha256: context().sceneSha256, author: 'Yalken tester' } : { sessionId: h.sessionId }), action, ...override }, { route: 'command.bus' });
  h.start = async () => { const r = await h.command('start'); assert.equal(r.ok, true, JSON.stringify(r)); h.sessionId = r.result?.sessionId || r.sessionId; return r; };
  h.type = text => { h.editor = envelope.composeObservablePayload({ doc: doc(text) }); h.generation++; c.lastSignaledEditGeneration = h.generation; c.isDirty = true; };
  h.c = c; h.file = file; h.context = context; return h;
}
test('actual Kernel, main snapshot and atomic save preserve authored revisions across autosaves, stop and reopen', async t => {
  const h = await harness(t); await h.start();
  assert.equal(h.writes, 0); h.type('Alpha beta!'); assert.equal((await h.save()).success, true);
  const first = model.readLedger(h.context().parsed.doc); assert.equal(first.revisions[0].author, 'Yalken tester');
  h.type('Alpha beta!!'); assert.equal((await h.save()).success, true);
  assert.equal(model.readLedger(h.context().parsed.doc).roundUndo.length, 1);
  const stopped = await h.command('stop'); assert.equal(stopped.ok, true, JSON.stringify(stopped));
  const reopened = JSON.parse(JSON.stringify(h.context().parsed.doc));
  assert.equal(model.projection(reopened).current, 'Alpha beta!!');
  assert.equal(model.projection(model.decide(reopened, { action: 'undo' }).doc).current, 'Alpha beta');
  assert.equal(model.readLedger(envelope.parseObservablePayload(h.editor).doc).revisions.length, 1);
});
test('typing Undo after autosave restores original durable bytes without extra pending decisions', async t => {
  const h = await harness(t), before = fs.readFileSync(h.file, 'utf8'); await h.start();
  h.type('Alpha beta!'); assert.equal((await h.save()).success, true);
  h.type('Alpha beta'); assert.equal((await h.save()).success, true);
  assert.equal(fs.readFileSync(h.file, 'utf8'), before); assert.equal(model.readLedger(h.context().parsed.doc), null);
});
for (const kind of ['forgedLedger', 'unprepared', 'wrongTarget', 'sceneRace', 'projectRace', 'lifecycleRace', 'profile', 'entitlement', 'annotations', 'draft', 'writeFailure', 'oldGeneration', 'structure']) {
  test(`recording ${kind} cannot overwrite prior scene or clear the working buffer`, async t => {
    const h = await harness(t); await h.start(); h.type('Alpha beta!'); const before = fs.readFileSync(h.file, 'utf8');
    if (kind === 'forgedLedger') h.editor = envelope.composeObservablePayload({ doc: recording.derive(doc('Alpha beta'), doc('evil'), { author: 'forged', date: new Date().toISOString() }).doc });
    if (kind === 'draft') h.draft = true;
    if (kind === 'structure') h.editor = envelope.composeObservablePayload({ doc: { type: 'doc', content: [...doc('a').content, ...doc('b').content] } });
    const buffer = h.editor; let result;
    try {
      const snap = await h.capture();
      if (kind === 'sceneRace') fs.writeFileSync(h.file, 'owner edit');
      if (kind === 'projectRace') h.foreignProject = true;
      if (kind === 'lifecycleRace') h.lifecycle = 'foreign';
      if (kind === 'profile') h.allowed = false;
      if (kind === 'entitlement') h.entitled = false;
      if (kind === 'annotations') h.threads = [{ sceneId: 'roman/a.txt', status: 'open' }];
      if (kind === 'writeFailure') h.writeFailure = true;
      if (kind === 'oldGeneration') snap.generation = 0;
      if (kind === 'unprepared') snap.content += ' ';
      result = kind === 'wrongTarget' ? await h.c.commitWriterProjectSnapshot(h.file + '-copy', snap.content, snap.generation, null, 'copy') : await h.commit(snap);
    } catch (error) { result = { success: false, error: error.message }; }
    assert.equal(result.success, false, JSON.stringify(result)); assert.equal(h.writes, 0); assert.equal(h.c.isDirty, true);
    assert.equal(h.editor, buffer); assert.equal(fs.readFileSync(h.file, 'utf8'), kind === 'sceneRace' ? 'owner edit' : before);
  });
}
test('out-of-order capture cannot overwrite newer autosave; stop publication cannot discard new typing', async t => {
  const h = await harness(t); await h.start(); h.type('Alpha beta!'); const older = await h.capture();
  h.type('Alpha beta!!'); assert.equal((await h.save()).success, true);
  assert.equal((await h.commit(older)).success, false); assert.equal(model.projection(h.context().parsed.doc).current, 'Alpha beta!!');
  h.publicationRace = () => h.type('new unsaved text');
  const stopped = await h.command('stop'); assert.equal(stopped.ok, false); assert.equal(h.c.isDirty, true);
  assert.equal(envelope.parseObservablePayload(h.editor).text, 'new unsaved text');
});

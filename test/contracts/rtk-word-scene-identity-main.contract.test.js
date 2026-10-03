'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const Module = require('node:module');
const crypto = require('node:crypto');
const ROOT = path.resolve(__dirname, '../..');
const envelope = require('../../src/core/document-content-envelope-v1.cjs');
const bookmarks = require('../../src/core/word-user-bookmarks-v1.cjs');
const notes = require('../../src/core/word-manuscript-notes-v1.cjs');
const sha = x => crypto.createHash('sha256').update(x).digest('hex');
const read = x => fs.readFileSync(x, 'utf8');
const find = (root, label) => root?.label === label ? root : (root?.children || []).map(x => find(x, label)).find(Boolean);

// Compile the actual entire Main source with owned local adapters. Private
// state access is added ONLY to this test module, never shipped in production.
async function fixture(t, rich = false, alphaFileName = '01_Alpha.txt', packagedMac = false) {
  const spelled = await fsp.mkdtemp(path.join(os.tmpdir(), 'scene-identity-main-'));
  const temp = await fsp.realpath(spelled);
  t.after(() => fsp.rm(temp, { recursive: true, force: true }));
  const documents = path.join(temp, 'Documents'), data = path.join(temp, 'userData');
  fs.mkdirSync(data, { recursive: true });
  const root = path.join(documents, 'craftsman', 'Роман'), imported = path.join(root, 'roman', 'Imported');
  fs.mkdirSync(imported, { recursive: true });
  const alpha = path.join(imported, alphaFileName), beta = path.join(imported, '02_Beta.txt');
  fs.writeFileSync(alpha, 'Alpha'); fs.writeFileSync(beta, 'Beta');
  const handles = new Map(), listeners = new Map();
  let nextSavePath = null, saveDialogs = 0, onSaveDialog = null;
  const warnings = [];
  const app = { isPackaged: packagedMac, getPath: name => name === 'documents' ? documents : name === 'userData' ? data : temp,
    setPath() {}, whenReady: () => new Promise(() => {}), on() {}, quit() {}, exit() {}, setName() {}, requestSingleInstanceLock: () => true };
  const electron = { safeStorage: {isEncryptionAvailable:()=>true,getSelectedStorageBackend:()=> 'gnome_libsecret',
    encryptString(value){const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',Buffer.alloc(32,9),iv);return Buffer.concat([iv,cipher.update(value,'utf8'),cipher.final(),cipher.getAuthTag()]);},
    decryptString(value){const cipher=crypto.createDecipheriv('aes-256-gcm',Buffer.alloc(32,9),value.subarray(0,12));cipher.setAuthTag(value.subarray(-16));return Buffer.concat([cipher.update(value.subarray(12,-16)),cipher.final()]).toString('utf8');}},
    app, BrowserWindow: { getFocusedWindow: () => null, getAllWindows: () => [] },
    Menu: { buildFromTemplate: () => ({}), setApplicationMenu() {} },
    dialog: { showMessageBox: async (_window, value) => { warnings.push(value); return { response: 0 }; }, showSaveDialog: async () => { saveDialogs++; if (onSaveDialog) onSaveDialog(); return nextSavePath ? { canceled: false, filePath: nextSavePath } : { canceled: true }; }, showOpenDialog: async () => ({ canceled: true }) },
    ipcMain: { on: (name, callback) => listeners.set(name, callback), handle: (name, callback) => handles.set(name, callback) },
    session: { defaultSession: { webRequest: { onHeadersReceived() {} } } } };
  const mainPath = path.join(ROOT, 'src/main.js'), originalLoad = Module._load;
  const compiled = new Module(mainPath, module);
  compiled.filename = mainPath; compiled.paths = Module._nodeModulePaths(path.dirname(mainPath));
  const hooks = `\nmodule.exports.__probe = {
    state(values = {}) {
      if ('filePath' in values) currentFilePath = values.filePath;
      if ('projectName' in values) currentProjectName = values.projectName;
      if ('dirty' in values) isDirty = values.dirty;
      if ('generation' in values) lastSignaledEditGeneration = values.generation;
      if ('pending' in values) activePendingRecording = values.pending;
      if ('window' in values) mainWindow = values.window;
      return { filePath: currentFilePath, dirty: isDirty, generation: lastSignaledEditGeneration };
    },
    dispatch: dispatchLegacyUiTreeDocumentCommand, shellUrl: getExpectedIpcShellUrl,
    reviewBatchApply: handleReviewSurfaceApplyExactTextChangesBatchCommandSurface,
    bind: bindPendingDocxReviewPublication, activate: activateReviewDocxExportAuthority,
    buildAuthority: buildDocxReviewReturnAuthorityStoreRecord, authorityPath: docxReviewReturnAuthorityStorePath,
    fresh: assertFreshDocxReviewRoundAuthority, strict: readStrictDocxReviewAuthorityStore,
    persist: persistDocxReviewReturnAuthorityStore, expire: expireProjectWordRoundsBeforeTree,
    setReviewStore(value) { activeReviewDocxExportAuthorityStore = value; },
    recover: recoverPendingWriterProjectTransaction, save: handleSave, autosave: runAutoSave, backup: createBackup, text: requestEditorText, snapshot: requestEditorSnapshot, normalizeSnapshot: normalizeEditorSnapshotPayload, exportMin: handleExportDocxMin, saveAs: handleSaveAs,
    exportReview: handleReviewDocxExportPacketCommandSurface, exportFullReview: handleFullManuscriptReviewDocxExportPacketCommandSurface,
    sceneSource:readDocxReviewPacketExportSource,fullSource:readFullManuscriptDocxReviewPacketExportSource,reviewBuild:buildDocxReviewPacketBuffer,
    reviewActivate:handleDocxReviewPreviewSessionActivationCommandSurface,fullApply:handleReviewSurfaceApplyFullManuscriptExactTextReturnCommandSurface,
    reconcileStartup: reconcileReviewExactTextApplyJournalsAtStartup,
    formatApply: payload => MENU_COMMAND_HANDLERS['cmd.project.review.applyFormattingReturn'](payload),
    formattingInput:()=>cloneJsonSafe(activeRtkFormattingReturnApplyStore?.input),
    setFormattingRound(value){if(value===undefined)delete activeRtkFormattingReturnApplyStore.input.formattingRoundId;else activeRtkFormattingReturnApplyStore.input.formattingRoundId=value;},
    observeDeferredEditorSync() { const original=syncReviewExactTextApplyEditorFromMainState,pending=[];
      syncReviewExactTextApplyEditorFromMainState=(...args)=>{const result=original(...args);pending.push(result);return result;};
      return async()=>{await new Promise(resolve=>setImmediate(resolve));return Promise.all(pending.splice(0));}; },
    refreshReview:refreshActiveReviewExactTextUiPlan,reviewState:()=>cloneJsonSafe(activeReviewSessionStore),
    captureExportLogs() { const records=[]; const previous=logDevError; logDevError=(context,error)=>records.push({context,error}); return {records,restore(){logDevError=previous;}}; },
    async observeLocalReviewReceipt(receipt) {
      const statuses=[], opened=[], previousHandler=handleDocxReviewPreviewSessionLocalFileCommandSurface, previousStatus=updateStatus, previousSender=sendCanonicalRuntimeCommand;
      handleDocxReviewPreviewSessionLocalFileCommandSurface=async()=>receipt;
      updateStatus=value=>statuses.push(value); sendCanonicalRuntimeCommand=(...args)=>{opened.push(args);return true;};
      try { return {result:await MENU_COMMAND_HANDLERS['cmd.project.review.openDocxReviewPreviewSession']({requestId:'observation'}),statuses,opened}; }
      finally {handleDocxReviewPreviewSessionLocalFileCommandSurface=previousHandler;updateStatus=previousStatus;sendCanonicalRuntimeCommand=previousSender;}
    },
    changeSession() { commentAuthoringSessionId += 1; },
    queue: queueDiskOperation,
    session: () => commentAuthoringSessionId,
    clearBackupCaches() { backupHashes.clear(); treeBackupSeeds.clear(); },
    captureQueued(label) {
      const previous = queueDiskOperation; let captured = null;
      queueDiskOperation = (operation, name) => {
        if (name === label && !captured) {
          captured = operation; queueDiskOperation = previous;
          return Promise.resolve({success:false,code:'E_TEST_QUEUE_DEFERRED'});
        }
        return previous(operation, name);
      };
      return () => { if (!captured) throw Error('QUEUE_NOT_CAPTURED'); return previous(captured,label); };
    },
  };`;
  Module._load = function (request, parent, isMain) { return request === 'electron' ? electron : originalLoad.call(this, request, parent, isMain); };
  try { compiled._compile((packagedMac ? "const process=Object.create(global.process);Object.defineProperty(process,'platform',{value:'darwin'});\n" : '') + fs.readFileSync(mainPath, 'utf8') + hooks, mainPath); }
  finally { Module._load = originalLoad; }
  const main = compiled.exports, probe = main.__probe;
  const manager = require('../../src/utils/fileManager');
  const originalDocuments = manager.getDocumentsPath; manager.getDocumentsPath = () => path.join(documents, 'craftsman');
  t.after(() => { manager.getDocumentsPath = originalDocuments; });
  await main.buildProjectTreeRootsWithIdentities('Роман');
  const query = await main.handleWorkspaceProjectTreeQuery({ tab: 'roman' });
  assert.equal(query.ok, true, JSON.stringify(query));
  const a = find(query.root, 'Alpha'), b = find(query.root, 'Beta'), parent = find(query.root, 'Imported');
  let source = read(alpha);
  if (rich) {
    const result = bookmarks.planMutation({ doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Alpha' }] }] },
      action: 'create', projectId: query.projectId, sceneId: 'roman/Imported/' + alphaFileName, requestId: 'local-create', name: 'Anchor',
      start: { paragraphIndex: 0, offsetUtf16: 0, edge: 'text' }, end: { paragraphIndex: 0, offsetUtf16: 5, edge: 'text' } });
    result.doc.content.push({ type: 'paragraph', content: [{ type: 'text', text: 'Link', marks: [{ type: 'link', attrs: bookmarks.linkAttrs(result.registry.bookmarks[0]) }] }] });
    source = envelope.composeObservablePayload({ doc: result.doc, metaEnabled: true, meta: { status: 'черновик', synopsis: 'keep', tags: {} }, cards: [] });
    fs.writeFileSync(alpha, source);
    const manuscript = notes.bindManuscriptPayload({ kind: 'footnote', body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Note' }] }] },
      sceneId: 'roman/Imported/' + alphaFileName, offsetUtf16: 2, sceneContent: source });
    fs.writeFileSync(path.join(root, 'notes.craftsman.json'), JSON.stringify({ schemaVersion: 1, projectId: query.projectId,
      notes: [{ id: 'note-source', scope: 'manuscript', body: 'Note', manuscript }] }));
  }
  const manifestPath = path.join(root, 'project.craftsman.json');
  const capture = () => {
    const files = {};
    const visit = (relative) => {
      const target = path.join(root, relative);
      if (!fs.existsSync(target)) return;
      if (fs.lstatSync(target).isDirectory()) { for (const name of fs.readdirSync(target).sort()) visit(relative + '/' + name); return; }
      files[relative] = fs.readFileSync(target).toString('base64');
    };
    visit('roman'); visit('notes.craftsman.json'); visit('.yalken/word-review/non-text-return-state.v1.json');
    return { files, manifest: read(manifestPath) };
  };
  const move = (extra = {}, options) => main.handleUiMoveNodeCommand({ projectId: query.projectId, nodeId: a.nodeId,
    targetParentNodeId: parent.nodeId, targetIndex: 1, ...extra }, options);
  function installRound(state = 'PUBLISHED_ACTIVE', id = 'round-one') {
    const capsule = { projectRoot: root, roundId: id, keyRef: 'keyref:' + id, lifecycleState: state, recordVersion: 2,
      scenePath: alpha, expectedAuthority: { sceneId: 'roman/Imported/01_Alpha.txt' } };
    const store = { lastRoundId: id, roundsById: { [id]: capsule } };
    const target = probe.authorityPath(root); fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, JSON.stringify(probe.buildAuthority(store), null, 2) + '\n');
    probe.setReviewStore(store); return { capsule, store, target };
  }
  return { temp, root, imported, alpha, beta, main, probe, a, b, parent, query, source, manifestPath, capture, move, installRound, handles, listeners,
    chooseSavePath: (target, callback) => { nextSavePath = target; onSaveDialog = callback; }, saveDialogs: () => saveDialogs, warnings };
}

test('actual Main simultaneous sibling permutation rebinds active sibling and note owner, exact persisted Undo survives reopen', async t => {
  const f = await fixture(t, true), before = f.capture();
  f.probe.state({ filePath: f.beta });
  const result = await f.move({ expectedTreeRevision: 0 });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(f.probe.state().filePath, path.join(f.imported, '01_Beta.txt'));
  const rawNotes = JSON.parse(read(path.join(f.root, 'notes.craftsman.json')));
  assert.equal(rawNotes.notes[0].manuscript.reference.sceneId, 'roman/Imported/02_Alpha.txt');
  const moved = await f.main.handleWorkspaceProjectTreeQuery({ tab: 'roman' });
  assert.equal(moved.treeRevision, 1); assert.equal(moved.lastMutation.canUndo, true);
  const undo = await f.main.handleUiTreeUndoCommand({ projectId: f.query.projectId, expectedTreeRevision: 1, mutationId: moved.lastMutation.id });
  assert.equal(undo.ok, true, JSON.stringify(undo));
  assert.deepEqual(f.capture(), before);
  assert.equal(f.probe.state().filePath, f.beta);
  const end = await f.main.handleWorkspaceProjectTreeQuery({ tab: 'roman' });
  assert.equal(end.treeRevision, 2); assert.equal(end.lastMutation.canUndo, false);
  const replay = await f.main.handleUiTreeUndoCommand({ projectId: f.query.projectId, expectedTreeRevision: 1, mutationId: moved.lastMutation.id });
  assert.equal(replay.ok, false); assert.deepEqual(f.capture(), before);
});

test('actual command bridge copy forks local IDs and source stays exact; Undo removes only owned unchanged fork', async t => {
  const f = await fixture(t, true), before = f.capture();
  const copy = await f.probe.dispatch('cmd.project.tree.copyNode', { projectId: f.query.projectId, nodeId: f.a.nodeId, name: 'Fork', expectedTreeRevision: 0 });
  assert.equal(copy.ok, true, JSON.stringify(copy));
  assert.notEqual(copy.nodeId, f.a.nodeId);
  assert.equal(read(f.alpha), f.source);
  const forkPath = path.join(f.imported, '03_Fork.txt'), fork = envelope.parseObservablePayload(read(forkPath)).doc;
  const source = envelope.parseObservablePayload(f.source).doc;
  assert.notEqual(bookmarks.readRegistry(fork).bookmarks[0].id, bookmarks.readRegistry(source).bookmarks[0].id);
  assert.equal(fork.content[1].content[0].marks[0].attrs.wordBookmarkId, bookmarks.readRegistry(fork).bookmarks[0].id);
  const query = await f.main.handleWorkspaceProjectTreeQuery({ tab: 'roman' });
  const undo = await f.probe.dispatch('cmd.project.tree.undoLastMutation', { projectId: f.query.projectId, expectedTreeRevision: query.treeRevision, mutationId: query.lastMutation.id });
  assert.equal(undo.ok, true, JSON.stringify(undo)); assert.deepEqual(f.capture(), before);
});

test('late typing after durable commit rebinds active sibling before refusing publication and preserves dirty state', async t => {
  const f = await fixture(t);
  f.probe.state({ filePath: f.beta });
  const transaction = require('../../src/core/project-transaction-v1.cjs');
  const unlink = fsp.unlink;
  let injected = false;
  fsp.unlink = async function (target, ...args) {
    if (target === transaction.journalPathFor(f.manifestPath)
      && fs.existsSync(transaction.treeCommitPathFor(f.manifestPath))) {
      injected = true;
      f.probe.state({ generation: 1, dirty: true });
    }
    return unlink.call(this, target, ...args);
  };
  try {
    const result = await f.move({ expectedTreeRevision: 0 });
    assert.equal(injected, true);
    assert.equal(result.ok, false); assert.equal(result.committed, true, JSON.stringify(result));
    assert.equal(result.treeRevision, 1);
    assert.deepEqual(f.probe.state(), { filePath: path.join(f.imported, '01_Beta.txt'), dirty: true, generation: 1 });
    assert.equal(fs.existsSync(f.beta), false);
    assert.equal(read(path.join(f.imported, '01_Beta.txt')), 'Beta');
    assert.equal(fs.existsSync(transaction.journalPathFor(f.manifestPath)), false);
  } finally { fsp.unlink = unlink; }
});

test('actual existing scene backup root and history follow their owner through cohort and exact Undo', async t => {
  const f = await fixture(t, true);
  const backup = await require('../../src/utils/backupManager').createBackup(f.alpha, f.source, { basePath: f.root });
  assert.equal(backup.success, true);
  const beforeDir = path.join(f.root, 'backups', sha(f.alpha));
  const beforeFiles = Object.fromEntries(fs.readdirSync(beforeDir).map(name => [name, read(path.join(beforeDir, name))]));
  const result = await f.move({ expectedTreeRevision: 0 });
  assert.equal(result.ok, true, JSON.stringify(result));
  const movedFile = path.join(f.imported, '02_Alpha.txt');
  const afterDir = path.join(f.root, 'backups', sha(movedFile));
  assert.equal(fs.existsSync(beforeDir), false);
  assert.equal(JSON.parse(read(path.join(afterDir, 'meta.json'))).originalPath, movedFile);
  assert.equal(fs.readdirSync(afterDir).filter(x => x !== 'meta.json').length, 1);
  const query = await f.main.handleWorkspaceProjectTreeQuery({ tab: 'roman' });
  const undo = await f.main.handleUiTreeUndoCommand({ projectId: f.query.projectId, expectedTreeRevision: query.treeRevision, mutationId: query.lastMutation.id });
  assert.equal(undo.ok, true, JSON.stringify(undo));
  assert.deepEqual(Object.fromEntries(fs.readdirSync(beforeDir).map(name => [name, read(path.join(beforeDir, name))])), beforeFiles);
  assert.equal(fs.existsSync(afterDir), false);
});

for (const failure of ['dirty', 'pending', 'future', 'stale-revision', 'forged-path', 'unsafe-symlink']) {
  test(`actual Main ${failure} refuses without changing canonical cohort`, async t => {
    const f = await fixture(t);
    let extra = {};
    if (failure === 'dirty') f.probe.state({ filePath: f.beta, dirty: true });
    if (failure === 'pending') f.probe.state({ pending: {} });
    if (failure === 'future') { const manifest = JSON.parse(read(f.manifestPath)); manifest.schemaVersion = 99; fs.writeFileSync(f.manifestPath, JSON.stringify(manifest)); }
    if (failure === 'stale-revision') extra.expectedTreeRevision = 4;
    if (failure === 'forged-path') extra.path = f.alpha;
    if (failure === 'unsafe-symlink') { fs.unlinkSync(f.alpha); fs.writeFileSync(path.join(f.temp, 'outside.txt'), 'outside'); fs.symlinkSync(path.join(f.temp, 'outside.txt'), f.alpha); }
    const before = f.capture();
    const result = await f.move(extra);
    assert.equal(result.ok, false, JSON.stringify(result)); assert.deepEqual(f.capture(), before);
    if (failure === 'dirty') assert.equal(f.probe.state().dirty, true);
  });
}

for (const failure of ['malformed-authority', 'foreign-authority', 'symlink-authority', 'expiry-write-failure', 'late-edit', 'tree-failure-after-expiry']) {
  test(`actual Main round fence ${failure} preserves tree; terminal expiry is not rolled back`, async t => {
    const f = await fixture(t), round = f.installRound();
    if (failure === 'malformed-authority') fs.writeFileSync(round.target, '{');
    if (failure === 'foreign-authority') { const record = f.probe.buildAuthority({ ...round.store, roundsById: { 'round-one': { ...round.capsule, projectRoot: f.temp } } }); fs.writeFileSync(round.target, JSON.stringify(record)); }
    if (failure === 'symlink-authority') { fs.unlinkSync(round.target); fs.writeFileSync(path.join(f.temp, 'outside-authority'), 'outside'); fs.symlinkSync(path.join(f.temp, 'outside-authority'), round.target); }
    const before = f.capture();
    const manager = require('../../src/utils/fileManager'), write = manager.writeFileAtomic;
    if (failure === 'expiry-write-failure') { manager.writeFileAtomic = async (file, bytes) => file === round.target ? { success: false } : write(file, bytes); t.after(() => { manager.writeFileAtomic = write; }); }
    const options = failure === 'late-edit' ? { beforeFsMove: async () => f.probe.state({ generation: 1, dirty: true }) }
      : failure === 'tree-failure-after-expiry' ? { afterFsMoveBeforeIdentity: async () => { throw Error('controlled-crash'); } } : {};
    const result = await f.move({}, options);
    assert.equal(result.ok, false, JSON.stringify(result)); assert.deepEqual(f.capture(), before);
    if (failure === 'late-edit' || failure === 'tree-failure-after-expiry') {
      assert.equal(JSON.parse(read(round.target)).roundsById['round-one'].lifecycleState, 'EXPIRED');
      assert.throws(() => f.probe.fresh(round.capsule), /RTK_ROUND_LIFECYCLE_NOT_ELIGIBLE/);
      assert.equal((await f.main.handleWorkspaceProjectTreeQuery({ tab: 'roman' })).ok, true);
    }
  });
}

test('durable expiry survives exact tree Undo; cached fresh key and old export cannot resurrect it', async t => {
  const f = await fixture(t), round = f.installRound();
  f.probe.fresh(round.capsule);
  // Bind a genuine Main-owned pending store before the tree intent.
  f.probe.bind(round.store, f.root);
  const changed = await f.move(); assert.equal(changed.ok, true, JSON.stringify(changed));
  assert.equal(JSON.parse(read(round.target)).roundsById['round-one'].lifecycleState, 'EXPIRED');
  const query = await f.main.handleWorkspaceProjectTreeQuery({ tab: 'roman' });
  const undo = await f.main.handleUiTreeUndoCommand({ projectId: f.query.projectId, expectedTreeRevision: query.treeRevision, mutationId: query.lastMutation.id });
  assert.equal(undo.ok, true, JSON.stringify(undo));
  assert.throws(() => f.probe.fresh(round.capsule), /RTK_ROUND_LIFECYCLE_NOT_ELIGIBLE/);
  await assert.rejects(f.probe.activate(round.store), /RTK_ROUND_PUBLICATION_STALE/);
  await assert.rejects(f.probe.persist(round.store), /RTK_ROUND_CAS_CONFLICT/);
  assert.equal(JSON.parse(read(round.target)).roundsById['round-one'].lifecycleState, 'EXPIRED');
});

function mountRenderer(f, content, generation = 0, onSnapshot = null, identity = null, onPublication = null) {
  const sends = [], session = {}, url = f.probe.shellUrl();
  const wc = { id: 91, session, getURL: () => url, isDestroyed: () => false,
    send(channel, payload) {
      sends.push({ channel, payload });
      if (channel === 'editor:set-text' && onPublication) onPublication(payload);
      if (channel === 'editor:snapshot-request') {
        const current = typeof content === 'function' ? content() : content;
        if (onSnapshot && onSnapshot() === false) return;
        queueMicrotask(() => f.listeners.get('editor:snapshot-response')({ sender: wc, senderFrame: { url } }, {
          requestId: payload.requestId, snapshot: { ...(typeof identity === 'function' ? identity() : identity || {}), content: current, generation: typeof generation === 'function' ? generation() : generation, selectionRange: { start: 0, end: 0 } },
        }));
      }
    } };
  f.probe.state({ filePath: f.beta, window: { webContents: wc, isDestroyed: () => false }, generation: typeof generation === 'function' ? generation() : generation });
  return { sends, event: { sender: wc, senderFrame: { url } } };
}

test('actual IPC move retains clean active editor and publishes only guarded metadata without nested save deadlock', async t => {
  const f = await fixture(t), raw = read(f.beta), ui = mountRenderer(f, raw);
  const result = await f.handles.get('ui:move-node')(ui.event, { projectId: f.query.projectId, nodeId: f.a.nodeId,
    targetParentNodeId: f.parent.nodeId, targetIndex: 1, expectedTreeRevision: 0 });
  assert.equal(result.ok, true, JSON.stringify(result));
  const publications = ui.sends.filter(x => x.channel === 'editor:set-text');
  assert.equal(publications.length, 1);
  assert.equal(publications[0].payload.treePublication, true);
  assert.equal(publications[0].payload.documentId, f.b.nodeId);
  assert.equal(publications[0].payload.content, raw);
  assert.equal(publications[0].payload.expectedContent, raw);
  assert.equal(publications[0].payload.expectedGeneration, 0);
  assert.equal(ui.sends.some(x => x.channel === 'set-dirty'), false);
  assert.equal(f.probe.state().filePath, path.join(f.imported, '01_Beta.txt'));
});

test('real snapshot response raced by typing refuses before tree or authority writes', async t => {
  const f = await fixture(t), before = f.capture(), round = f.installRound(), authorityBefore = read(round.target);
  mountRenderer(f, read(f.beta), 0, () => f.probe.state({ generation: 1, dirty: true }));
  const result = await f.move();
  assert.equal(result.ok, false); assert.deepEqual(f.capture(), before);
  assert.equal(read(round.target), authorityBefore); assert.equal(f.probe.state().dirty, true);
});

test('actual dirty snapshot saves through existing writer ACK before tree; resulting working text survives move and reopen', async t => {
  const f = await fixture(t), working = 'Beta edited';
  const ui = mountRenderer(f, working, 1); f.probe.state({ dirty: true });
  const result = await f.move();
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(read(path.join(f.imported, '01_Beta.txt')), working);
  assert.equal(f.probe.state().dirty, false);
  const ack = ui.sends.find(x => x.channel === 'set-dirty');
  assert.equal(ack.payload.ack.kind, 'SAVED');
  assert.equal((await f.main.handleWorkspaceProjectTreeQuery({ tab: 'roman' })).ok, true);
});

test('future manifest refuses before requesting/saving even a dirty real editor snapshot', async t => {
  const f = await fixture(t);
  const manifest = JSON.parse(read(f.manifestPath)); manifest.schemaVersion = 99; fs.writeFileSync(f.manifestPath, JSON.stringify(manifest));
  const ui = mountRenderer(f, 'unsaved Beta', 1); f.probe.state({ dirty: true });
  const before = f.capture(), result = await f.move();
  assert.equal(result.ok, false); assert.deepEqual(f.capture(), before);
  assert.equal(ui.sends.length, 0); assert.equal(f.probe.state().dirty, true);
});

test('late dirty copied-scene Undo detaches its live buffer and actual SaveAs dialog writes a fresh scene without touching original', async t => {
  const f = await fixture(t);
  const copy = await f.main.handleUiCopyNodeCommand({ projectId: f.query.projectId, nodeId: f.a.nodeId, name: 'Fork', expectedTreeRevision: 0 });
  assert.equal(copy.ok, true, JSON.stringify(copy));
  const fork = path.join(f.imported, '03_Fork.txt');
  let working = read(fork), generation = 0;
  let identity = { projectId: f.query.projectId, documentId: copy.nodeId };
  const ui = mountRenderer(f, () => working, () => generation, null, () => identity, payload => {
    if (payload.treeDetached) identity = { projectId: f.query.projectId, documentId: '' };
    if (payload.treeRecovery) { working = payload.content; identity = { projectId: f.query.projectId, documentId: payload.documentId }; }
  });
  f.probe.state({ filePath: fork });
  const transaction = require('../../src/core/project-transaction-v1.cjs'), unlink = fsp.unlink;
  fsp.unlink = async function (target, ...args) {
    if (target === transaction.journalPathFor(f.manifestPath) && fs.existsSync(transaction.treeCommitPathFor(f.manifestPath))) {
      working += ' typed after commit'; generation = 1;
      f.probe.state({ generation, dirty: true });
    }
    return unlink.call(this, target, ...args);
  };
  try {
    const result = await f.main.handleUiTreeUndoCommand({ projectId: f.query.projectId, expectedTreeRevision: 1, mutationId: copy.lastMutation.id });
    assert.equal(result.ok, false); assert.equal(result.committed, true, JSON.stringify(result));
    assert.equal(result.error, 'E_TREE_UNSAVED_COPY_SAVE_AS_REQUIRED', JSON.stringify(result));
    assert.deepEqual(f.probe.state(), { filePath: null, dirty: true, generation: 1 });
    const detached = ui.sends.filter(x => x.channel === 'editor:set-text');
    assert.equal(detached.length, 1); assert.equal(detached[0].payload.treeDetached, true);
    assert.equal(detached[0].payload.expectedDocumentId, copy.nodeId);
    assert.equal(detached[0].payload.expectedContent, working); assert.equal(detached[0].payload.expectedGeneration, 1);
    assert.equal(read(f.alpha), 'Alpha'); assert.equal(fs.existsSync(fork), false);
  } finally { fsp.unlink = unlink; }
  const recovered = path.join(f.imported, '03_Recovered.txt'); f.chooseSavePath(recovered);
  assert.equal(await f.probe.saveAs(), true);
  assert.equal(f.saveDialogs(), 1); assert.equal(read(recovered), working);
  assert.equal(read(f.alpha), 'Alpha'); assert.equal(f.probe.state().dirty, false);
});

for (const mode of ['save', 'autosave']) test(`${mode} captured during the final tree commit cannot recreate the removed prior active path`, async t => {
  const f = await fixture(t);
  let working = read(f.beta), generation = 0;
  mountRenderer(f, () => working, () => generation);
  const transaction = require('../../src/core/project-transaction-v1.cjs'), unlink = fsp.unlink;
  let save;
  fsp.unlink = async function (target, ...args) {
    if (target === transaction.journalPathFor(f.manifestPath) && fs.existsSync(transaction.treeCommitPathFor(f.manifestPath))) {
      working = 'Beta typed concurrently'; generation = 1;
      f.probe.state({ generation, dirty: true });
      save = f.probe[mode]();
    }
    return unlink.call(this, target, ...args);
  };
  try {
    const result = await f.move({ expectedTreeRevision: 0 });
    assert.equal(result.committed, true, JSON.stringify(result));
    assert.notEqual(await save, true, 'the captured old-path save must refuse');
    assert.equal(fs.existsSync(f.beta), false, 'no stale save may resurrect the removed path');
    assert.equal(read(path.join(f.imported, '01_Beta.txt')), 'Beta');
    assert.equal(f.probe.state().dirty, true);
  } finally { fsp.unlink = unlink; }
});

test('actual bookmark boundary Save refusal shows one dismiss-only warning and keeps the working buffer dirty', async t => {
  const f = await fixture(t, true), before = f.capture();
  const parsed = envelope.parseObservablePayload(f.source); parsed.doc.content[0].content = [];
  const working = envelope.composeObservablePayload({ ...parsed, metaEnabled: parsed.hasMetaBlock });
  mountRenderer(f, working, 1); f.probe.state({ filePath: f.alpha, dirty: true });
  const result = await f.probe.save();
  assert.notEqual(result, true); assert.deepEqual(f.capture(), before);
  assert.equal(f.warnings.length, 1); assert.match(f.warnings[0].message, /закладками/u);
  assert.equal(f.warnings[0].buttons.length, 1); assert.equal(f.warnings[0].defaultId, 0);
  assert.equal(f.probe.state().dirty, true);
});


test('untitled Save dialog cannot publish after the authoring session changes during native choice', async t => {
  const f = await fixture(t), before = f.capture();
  mountRenderer(f, 'Unsaved buffer', 1); f.probe.state({ filePath: null, dirty: true });
  const target = path.join(f.imported, '03_Unsaved.txt'); f.chooseSavePath(target, () => f.probe.changeSession());
  assert.notEqual(await f.probe.save(), true); assert.equal(f.saveDialogs(), 1);
  assert.equal(fs.existsSync(target), false); assert.deepEqual(f.capture(), before);
  assert.equal(f.probe.state().dirty, true); assert.equal(f.probe.state().filePath, null);
});

test('rich late-copy Undo preserves working buffer and readable graph packet while normal Save remains fenced', async t => {
  const f = await fixture(t, true), commentModel = require('../../src/core/word-comment-authoring-v1.cjs');
  const commentPath = path.join(f.root, '.yalken/word-review/non-text-return-state.v1.json');
  const sceneId = 'roman/Imported/01_Alpha.txt';
  const comment = commentModel.planCommentAuthoring({ beforeText: null, projectId: f.query.projectId, sceneId,
    sceneSha256: sha(f.source), paragraphs: ['Alpha', 'Link'], now: '2026-10-02T00:00:00.000Z',
    input: { action: 'create', requestId: 'comment-source', projectId: f.query.projectId, sceneId,
      expectedStateSha256: '', expectedSceneSha256: sha(f.source), body: 'Comment graph',
      anchor: { paragraphIndex: 0, startUtf16: 0, selectedText: 'Alpha' } } });
  fs.mkdirSync(path.dirname(commentPath), { recursive: true }); fs.writeFileSync(commentPath, comment.afterText);
  const before = f.capture();
  const copy = await f.main.handleUiCopyNodeCommand({ projectId: f.query.projectId, nodeId: f.a.nodeId, name: 'Fork', expectedTreeRevision: 0 });
  assert.equal(copy.ok, true, JSON.stringify(copy));
  const fork = path.join(f.imported, '03_Fork.txt'), copied = read(fork);
  const copiedRegistry = bookmarks.readRegistry(envelope.parseObservablePayload(copied).doc);
  const copiedNotes = read(path.join(f.root, 'notes.craftsman.json')), copiedComments = read(commentPath);
  assert.equal(JSON.parse(copiedNotes).notes.length, 2); assert.equal(JSON.parse(copiedComments).threads.length, 2);
  let working = copied, generation = 0;
  const ui = mountRenderer(f, () => working, () => generation, null, { projectId: f.query.projectId, documentId: copy.nodeId }); f.probe.state({ filePath: fork });
  const transaction = require('../../src/core/project-transaction-v1.cjs'), unlink = fsp.unlink;
  fsp.unlink = async function (target, ...args) {
    if (target === transaction.journalPathFor(f.manifestPath) && fs.existsSync(transaction.treeCommitPathFor(f.manifestPath))) {
      const parsed = envelope.parseObservablePayload(working);
      parsed.doc.content.push({ type: 'paragraph', content: [{ type: 'text', text: 'Unsaved rich buffer' }] });
      working = envelope.composeObservablePayload({ ...parsed, metaEnabled: parsed.hasMetaBlock }); generation = 1;
      f.probe.state({ generation, dirty: true });
    }
    return unlink.call(this, target, ...args);
  };
  try {
    const result = await f.main.handleUiTreeUndoCommand({ projectId: f.query.projectId, expectedTreeRevision: 1, mutationId: copy.lastMutation.id });
    assert.equal(result.committed, true, JSON.stringify(result)); assert.equal(result.error, 'E_TREE_UNSAVED_COPY_SAVE_AS_REQUIRED');
  } finally { fsp.unlink = unlink; }
  assert.deepEqual(f.capture(), before);
  assert.equal(ui.sends.at(-1).payload.expectedContent, working); assert.equal(ui.sends.at(-1).payload.treeDetached, true);
  assert.deepEqual(bookmarks.readRegistry(envelope.parseObservablePayload(working).doc), copiedRegistry);
  const retained = (await transaction.readVerifiedProjectTreeMutation({ manifestPath: f.manifestPath, projectId: f.query.projectId })).retainedPacket;
  const retainedBefore = relative => Buffer.from(retained.plan.entries.find(x => x.relativePath === relative).beforeBase64, 'base64').toString('utf8');
  assert.equal(retainedBefore('roman/Imported/03_Fork.txt'), copied);
  assert.equal(retainedBefore('notes.craftsman.json'), copiedNotes);
  assert.equal(retainedBefore('.yalken/word-review/non-text-return-state.v1.json'), copiedComments);
  const fresh = path.join(f.imported, '03_Recovered.txt'); f.chooseSavePath(fresh);
  assert.notEqual(await f.probe.save(), true); assert.equal(fs.existsSync(fresh), false);
  assert.deepEqual(f.capture(), before); assert.equal(f.probe.state().dirty, true);
  assert.equal(f.warnings.length, 1); assert.match(f.warnings[0].detail, /Текст остаётся в редакторе/u);
});


test('delayed periodic backup is drained before copy and unchanged post-copy timer cannot invalidate exact Undo', async t => {
  const f = await fixture(t, true);
  mountRenderer(f, f.source, 0); f.probe.state({ filePath: f.alpha });
  const manager = require('../../src/utils/backupManager'), original = manager.createBackup;
  let release, started; const gate = new Promise(r => { release = r; }), arrived = new Promise(r => { started = r; });
  let calls = 0;
  manager.createBackup = async (...args) => { calls++; if (calls === 1) { started(); await gate; } return original(...args); };
  try {
    const pending = f.probe.backup(); await arrived;
    let completed = false;
    const copying = f.main.handleUiCopyNodeCommand({ projectId: f.query.projectId, nodeId: f.a.nodeId, name: 'Fork', expectedTreeRevision: 0 }).then(x => { completed = true; return x; });
    await new Promise(r => setImmediate(r)); assert.equal(completed, false);
    release(); await pending; const copy = await copying; assert.equal(copy.ok, true, JSON.stringify(copy));
    const fork = path.join(f.imported, '03_Fork.txt');
    const parsed = envelope.parseObservablePayload(read(fork));
    parsed.doc.content.forEach(p => { p.attrs = { ...(p.attrs || {}), textAlign: null }; });
    parsed.doc = bookmarks.materializeInternalLinkSchemaDefaults(parsed.doc);
    const opened = envelope.composeObservablePayload({ ...parsed, metaEnabled: parsed.hasMetaBlock });
    const openedUi = mountRenderer(f, opened, 0); f.probe.state({ filePath: fork });
    const beforeTimer = f.capture(); await f.probe.backup(); assert.deepEqual(f.capture(), beforeTimer);
    assert.equal(calls, 2, 'one drained scene snapshot and one manifest checkpoint; unchanged timer writes nothing');
    const undone = await f.main.handleUiTreeUndoCommand({ projectId: f.query.projectId, expectedTreeRevision: 1, mutationId: copy.lastMutation.id });
    assert.equal(undone.ok, true, JSON.stringify(undone));
    const replacement = openedUi.sends.find(x => x.channel === 'editor:set-text');
    assert.equal(replacement.payload.treeReplacement, true);
    assert.equal(replacement.payload.expectedContent, opened, 'publication must bind the actual checked PM composer, not differently serialized disk bytes');
    assert.equal(replacement.payload.content, read(f.alpha));
    assert.equal(replacement.payload.title, 'Alpha');
    assert.equal(fs.existsSync(path.join(f.imported, '03_Fork.txt')), false);
  } finally { release(); manager.createBackup = original; }
});

test('periodic backup snapshot raced by a path change never publishes old-path history', async t => {
  const f = await fixture(t); const before = f.capture();
  mountRenderer(f, 'Beta', 0, () => f.probe.state({ filePath: f.alpha }));
  await f.probe.backup();
  assert.deepEqual(f.capture(), before); assert.equal(fs.existsSync(path.join(f.root, 'backups', sha(f.beta))), false);
});

test('actual dirty-free rename, copy, open-copy Undo and subsequent reorder keep current publication and stable owners', async t => {
  const f = await fixture(t, true, 'Alpha.txt');
  mountRenderer(f, f.source, 9); f.probe.state({ filePath: f.alpha, generation: 0 });
  const renamed = await f.main.handleUiRenameNodeCommand({ projectId: f.query.projectId, nodeId: f.a.nodeId, name: 'RenamedAlpha', expectedTreeRevision: 0 });
  assert.equal(renamed.ok, true, JSON.stringify(renamed));
  const alpha = path.join(f.imported, 'RenamedAlpha.txt');
  const copied = await f.main.handleUiCopyNodeCommand({ projectId: f.query.projectId, nodeId: f.b.nodeId, name: 'BetaCopy', expectedTreeRevision: 1 });
  assert.equal(copied.ok, true, JSON.stringify(copied));
  const copy = path.join(f.imported, '03_BetaCopy.txt');
  const opened = mountRenderer(f, read(copy), 9); f.probe.state({ filePath: copy, generation: 0 });
  const undone = await f.main.handleUiTreeUndoCommand({ projectId: f.query.projectId, expectedTreeRevision: 2, mutationId: copied.lastMutation.id });
  assert.equal(undone.ok, true, JSON.stringify(undone));
  const replacement = opened.sends.find(x => x.channel === 'editor:set-text');
  assert.equal(replacement.payload.content, 'Beta'); assert.equal(replacement.payload.title, 'Beta');
  assert.equal(replacement.payload.expectedGeneration, 9, 'actual renderer generation survives clean document open independently of Main signal generation');
  mountRenderer(f, 'Beta', 9, null, { projectId: f.query.projectId, documentId: f.b.nodeId });
  f.probe.state({ filePath: f.beta, generation: 0 });
  await f.probe.snapshot();
  const parsed = envelope.parseObservablePayload(read(alpha));
  parsed.doc.attrs = { wordPendingRevisions: null, ...parsed.doc.attrs };
  parsed.doc.content.forEach(p => { p.attrs = { textAlign: null, ...(p.attrs || {}) }; });
  parsed.doc = bookmarks.materializeInternalLinkSchemaDefaults(parsed.doc);
  const view = envelope.composeObservablePayload({ ...parsed, metaEnabled: parsed.hasMetaBlock });
  const active = mountRenderer(f, view, 9, null, { projectId: f.query.projectId, documentId: f.a.nodeId }); f.probe.state({ filePath: alpha, generation: 0 });
  const moved = await f.main.handleUiMoveNodeCommand({ projectId: f.query.projectId, nodeId: f.b.nodeId,
    targetParentNodeId: f.parent.nodeId, targetIndex: 1, expectedTreeRevision: 3 });
  assert.equal(moved.ok, true, JSON.stringify(moved));
  assert.equal(f.probe.state().filePath, path.join(f.imported, '01_RenamedAlpha.txt'));
  const publication = active.sends.find(x => x.channel === 'editor:set-text');
  assert.equal(publication.payload.treePublication, true);
  assert.equal(publication.payload.expectedGeneration, 9);
  assert.equal(publication.payload.content, view); assert.equal(publication.payload.expectedContent, view);
});

test('actual versioned command bridge routes the existing move ID through Kernel and rejects stale replay and malformed peers', async t => {
  const f = await fixture(t), ui = mountRenderer(f, read(f.beta));
  const protocol = require('../../src/core/ipc-envelope-v1.cjs');
  const payload = { projectId: f.query.projectId, nodeId: f.a.nodeId, targetParentNodeId: f.parent.nodeId,
    targetIndex: 1, expectedTreeRevision: 0 };
  const request = protocol.createEnvelope('ui:command-bridge', 'cmd.project.tree.moveNode', payload,
    { correlationId: 'move-native-route', issuedAt: '2026-10-02T00:00:00.000Z' });
  const before = f.capture();
  const malformed = await f.handles.get('ui:command-bridge')(ui.event, { ...request, v: 99 });
  assert.equal(malformed.ok, false); assert.deepEqual(f.capture(), before);
  assert.throws(() => f.handles.get('ui:command-bridge')({ ...ui.event, senderFrame: { url: 'https://foreign.invalid/' } }, request), /E_IPC_FRAME_PROTOCOL_DENIED/u);
  assert.deepEqual(f.capture(), before);
  const accepted = await f.handles.get('ui:command-bridge')(ui.event, request);
  assert.equal(accepted.ok, true, JSON.stringify(accepted));
  assert.equal(f.probe.state().filePath, path.join(f.imported, '01_Beta.txt'));
  const after = f.capture();
  const replay = await f.handles.get('ui:command-bridge')(ui.event, request);
  assert.equal(replay.ok, false); assert.deepEqual(f.capture(), after);
});

for (const observed of ['old-copy', 'missing', 'foreign-project', 'malformed']) test(`late rejected copy replacement with ${observed} snapshot cannot write the original through save, autosave, backup or tree`, async t => {
  const f = await fixture(t);
  const copy = await f.main.handleUiCopyNodeCommand({ projectId: f.query.projectId, nodeId: f.a.nodeId, name: 'Fork', expectedTreeRevision: 0 });
  assert.equal(copy.ok, true, JSON.stringify(copy));
  const fork = path.join(f.imported, '03_Fork.txt');
  let content = read(fork), identity = { projectId: f.query.projectId, documentId: copy.nodeId };
  const ui = mountRenderer(f, () => content, 9, null, () => identity);
  f.probe.state({ filePath: fork, generation: 0 });
  const undo = await f.main.handleUiTreeUndoCommand({ projectId: f.query.projectId, expectedTreeRevision: 1, mutationId: copy.lastMutation.id });
  assert.equal(undo.ok, true, JSON.stringify(undo));
  const replacement = ui.sends.find(x => x.channel === 'editor:set-text');
  assert.equal(replacement.payload.treeReplacement, true); assert.equal(replacement.payload.expectedGeneration, 9);
  // A real renderer can reject after send due to another edit; it retains the
  // copied identity and buffer. Its observations cannot authorize source paths.
  content += ' late copied typing';
  if (observed === 'missing') identity = {};
  if (observed === 'foreign-project') identity = { projectId: 'foreign', documentId: f.a.nodeId };
  if (observed === 'malformed') identity = { projectId: f.query.projectId, documentId: { id: f.a.nodeId } };
  const before = f.capture();
  const autosave = await f.probe.autosave();
  assert.equal(autosave.ok, false, JSON.stringify(autosave)); assert.equal(f.probe.state().dirty, true);
  assert.equal(f.warnings.length, 0, 'autosave does not produce repeated warnings');
  assert.equal((await f.probe.save()).ok, false);
  assert.equal(f.warnings.length, 1); assert.match(f.warnings[0].message, /Сохранение остановлено/u); assert.match(f.warnings[0].detail, /Сохранить как.*Cmd\+Shift\+S/u);
  const backup = await f.probe.backup(); assert.notEqual(backup?.success, true);
  const blockedOpen = await f.main.handleUiOpenDocumentCommand({ projectId: f.query.projectId, nodeId: f.b.nodeId });
  assert.equal(blockedOpen.ok, false); assert.equal(blockedOpen.cancelled, true);
  const rename = await f.main.handleUiRenameNodeCommand({ projectId: f.query.projectId, nodeId: f.a.nodeId, name: 'Wrong', expectedTreeRevision: 2 });
  assert.equal(rename.ok, false, JSON.stringify(rename));
  await assert.rejects(f.probe.text(), /TREE_EDITOR_IDENTITY_UNCONFIRMED/u);
  assert.deepEqual(f.capture(), before); assert.equal(read(f.alpha), 'Alpha');
  assert.equal(content.endsWith(' late copied typing'), true);
  // Only an actual matching current viewer observation clears the private
  // pending fence, with all Main lifecycle/path bindings still unchanged.
  identity = { projectId: f.query.projectId, documentId: f.a.nodeId }; content = read(f.alpha);
  const snapshot = await f.probe.snapshot(); assert.equal(snapshot.documentId, f.a.nodeId);
  assert.equal(await f.probe.save(), true); assert.equal(read(f.alpha), 'Alpha');
});

test('matching snapshot cannot clear a replacement fence after authoring lifecycle changes', async t => {
  const f = await fixture(t);
  const copy = await f.main.handleUiCopyNodeCommand({ projectId: f.query.projectId, nodeId: f.a.nodeId, name: 'Fork', expectedTreeRevision: 0 });
  assert.equal(copy.ok, true);
  const fork = path.join(f.imported, '03_Fork.txt'); let identity = { projectId: f.query.projectId, documentId: copy.nodeId };
  mountRenderer(f, read(fork), 9, null, () => identity); f.probe.state({ filePath: fork, generation: 0 });
  const undo = await f.main.handleUiTreeUndoCommand({ projectId: f.query.projectId, expectedTreeRevision: 1, mutationId: copy.lastMutation.id });
  assert.equal(undo.ok, true);
  const before = f.capture(); identity = { projectId: f.query.projectId, documentId: f.a.nodeId }; f.probe.changeSession();
  await assert.rejects(f.probe.snapshot(), /TREE_EDITOR_IDENTITY_UNCONFIRMED/u);
  assert.equal((await f.probe.save()).ok, false); assert.equal(f.probe.state().dirty, true); assert.deepEqual(f.capture(), before);
});

test('one valid replacement observation cannot release an older wrong-copy snapshot request', async t => {
  const f = await fixture(t);
  const copy = await f.main.handleUiCopyNodeCommand({ projectId: f.query.projectId, nodeId: f.a.nodeId, name: 'Fork', expectedTreeRevision: 0 });
  const fork = path.join(f.imported, '03_Fork.txt');
  let identity = { projectId: f.query.projectId, documentId: copy.nodeId }, defer = false;
  const ui = mountRenderer(f, () => read(f.alpha), 9, () => defer ? false : undefined, () => identity);
  f.probe.state({ filePath: fork, generation: 0 });
  const pendingText = f.probe.text().then(value => ({ value }), error => ({ error }));
  const textRequest = ui.sends.at(-1).payload.requestId;
  // The initial capture must describe the copied buffer exactly.
  // Both plain source and its clean copy contain identical text, distinct IDs.
  const undo = await f.main.handleUiTreeUndoCommand({ projectId: f.query.projectId, expectedTreeRevision: 1, mutationId: copy.lastMutation.id });
  assert.equal(undo.ok, true, JSON.stringify(undo));
  defer = true;
  const pending = f.probe.snapshot(); const outcome = pending.then(value => ({ value }), error => ({ error }));
  const request = ui.sends.at(-1).payload.requestId;
  defer = false; identity = { projectId: f.query.projectId, documentId: f.a.nodeId };
  assert.equal((await f.probe.snapshot()).documentId, f.a.nodeId);
  f.listeners.get('editor:text-response')(ui.event, { requestId: textRequest, text: 'Old delayed copied text' });
  assert.equal((await pendingText).error?.code, 'E_TREE_EDITOR_IDENTITY_UNCONFIRMED');
  f.listeners.get('editor:snapshot-response')(ui.event, { requestId: request,
    snapshot: { content: 'Copied buffer', generation: 9, projectId: f.query.projectId, documentId: copy.nodeId } });
  const rejected = await outcome; assert.equal(rejected.error?.code, 'E_TREE_EDITOR_IDENTITY_UNCONFIRMED');
  assert.equal(read(f.alpha), 'Alpha'); assert.equal(f.probe.state().dirty, true);
});

test('successful canonical open retires obsolete replacement context but an old pending snapshot keeps its lifecycle binding', async t => {
  const f = await fixture(t);
  const copy = await f.main.handleUiCopyNodeCommand({ projectId: f.query.projectId, nodeId: f.a.nodeId, name: 'Fork', expectedTreeRevision: 0 });
  const fork = path.join(f.imported, '03_Fork.txt');
  let content = read(fork), identity = { projectId: f.query.projectId, documentId: copy.nodeId }, defer = false;
  const ui = mountRenderer(f, () => content, 9, () => defer ? false : undefined, () => identity);
  f.probe.state({ filePath: fork, generation: 0 });
  const undo = await f.main.handleUiTreeUndoCommand({ projectId: f.query.projectId, expectedTreeRevision: 1, mutationId: copy.lastMutation.id });
  assert.equal(undo.ok, true);
  defer = true; const pending = f.probe.snapshot(); const outcome = pending.then(value => ({ value }), error => ({ error }));
  const request = ui.sends.at(-1).payload.requestId;
  // The actual source viewer is observed before the existing no-loss Open
  // barrier; this permits the deliberate switch without discarding a copy.
  defer = false; content = read(f.alpha); identity = { projectId: f.query.projectId, documentId: f.a.nodeId };
  const opened = await f.main.handleUiOpenDocumentCommand({ projectId: f.query.projectId, nodeId: f.b.nodeId });
  assert.equal(opened.ok, true, JSON.stringify(opened)); assert.equal(f.probe.state().filePath, f.beta);
  const before = f.capture();
  f.listeners.get('editor:snapshot-response')(ui.event, { requestId: request,
    snapshot: { content: 'Old delayed copied buffer', generation: 9, projectId: f.query.projectId, documentId: copy.nodeId } });
  assert.equal((await outcome).error?.code, 'E_TREE_EDITOR_IDENTITY_UNCONFIRMED');
  assert.deepEqual(f.capture(), before);
  content = read(f.beta); identity = { projectId: f.query.projectId, documentId: f.b.nodeId };
  assert.equal(await f.probe.save(), true); assert.equal(read(f.alpha), 'Alpha'); assert.equal(read(f.beta), 'Beta');
});

async function installMixedScene(f) {
  const sceneId = 'roman/Imported/01_Alpha.txt';
  let doc = { type: 'doc', content: ['Alpha target unique', 'Twin repeated text', 'Twin repeated text', 'CrossStart', 'CrossEnd', 'After canary 🌋', 'Link destination', 'Link second']
    .map(text => ({ type: 'paragraph', content: [{ type: 'text', text }] })) };
  const ep = (paragraphIndex, offsetUtf16) => ({ paragraphIndex, offsetUtf16, edge: 'text' });
  const specs = [['UserTwinA', ep(1, 0), ep(1, 18)], ['UserTwinB', ep(1, 0), ep(1, 18)], ['UserTwinSecond', ep(2, 0), ep(2, 18)],
    ['UserPoint', ep(5, 0), ep(5, 0)], ['UserCrossBlock', ep(3, 0), ep(4, 8)], ['UserSpanTwo', ep(3, 0), ep(5, 1)], ['UserSurrogate', ep(5, 13), ep(5, 15)]];
  for (const [name, start, end] of specs) doc = bookmarks.planMutation({ doc, action: 'create', projectId: f.query.projectId, sceneId,
    requestId: 'mixed-' + name, name, start, end }).doc;
  const registry = bookmarks.readRegistry(doc);
  for (const [index, name] of [[6, 'UserTwinB'], [7, 'UserTwinSecond']]) doc.content[index].content[0].marks = [{ type: 'link', attrs: bookmarks.linkAttrs(registry.bookmarks.find(x => x.name === name)) }];
  f.source = envelope.composeObservablePayload({ doc, metaEnabled: true, meta: { status: 'черновик', synopsis: 'Mixed graph metadata', tags: {} }, cards: [] });
  fs.writeFileSync(f.alpha, f.source);
  const manuscript = notes.bindManuscriptPayload({ kind: 'footnote', body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Mixed footnote' }] }] }, sceneId, offsetUtf16: 2, sceneContent: f.source });
  const storage = await import('../../src/core/notesStorage.mjs');
  const normalized = storage.normalizeNotesDocument({ schemaVersion: 1, projectId: f.query.projectId, notes: [{ id: 'note-mixed', scope: 'manuscript', body: 'Mixed footnote', manuscript }] }, { projectId: f.query.projectId, now: () => '2026-10-02T00:00:00.000Z' });
  fs.writeFileSync(path.join(f.root, 'notes.craftsman.json'), JSON.stringify(normalized.value));
  const model = require('../../src/core/word-comment-authoring-v1.cjs');
  const comment = model.planCommentAuthoring({ beforeText: null, projectId: f.query.projectId, sceneId, sceneSha256: sha(f.source),
    paragraphs: doc.content.map(p => p.content.map(n => n.text).join('')), now: '2026-10-02T00:00:00.000Z',
    input: { action: 'create', requestId: 'mixed-comment', projectId: f.query.projectId, sceneId, expectedStateSha256: '', expectedSceneSha256: sha(f.source),
      body: 'Mixed comment', anchor: { paragraphIndex: 0, startUtf16: 0, selectedText: 'Alpha' } } });
  const target = path.join(f.root, '.yalken/word-review/non-text-return-state.v1.json'); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, comment.afterText);
}

test('actual mixed seven-bookmark two-link note/comment copy, reorder and current-scene DOCX export retain the complete graph', async t => {
  const f = await fixture(t); await installMixedScene(f);
  const copy = await f.main.handleUiCopyNodeCommand({ projectId: f.query.projectId, nodeId: f.a.nodeId, name: 'RichCopy', expectedTreeRevision: 0 });
  assert.equal(copy.ok, true, JSON.stringify(copy));
  const copied = path.join(f.imported, '03_RichCopy.txt');
  f.probe.state({ filePath: copied });
  const moved = await f.main.handleUiMoveNodeCommand({ projectId: f.query.projectId, nodeId: copy.nodeId, targetParentNodeId: f.parent.nodeId, targetIndex: 1, expectedTreeRevision: 1 });
  assert.equal(moved.ok, true, JSON.stringify(moved));
  const activePath = f.probe.state().filePath, doc = envelope.parseObservablePayload(read(activePath)).doc;
  assert.equal(bookmarks.readRegistry(doc).bookmarks.length, 7);
  const sourcePath = path.join(f.root, JSON.parse(read(f.manifestPath)).treeIdentity.nodes[f.a.nodeId].bindingKey.slice(5));
  const ids = new Set(bookmarks.readRegistry(envelope.parseObservablePayload(read(sourcePath)).doc).bookmarks.map(x => x.id));
  assert.equal(bookmarks.readRegistry(doc).bookmarks.some(x => ids.has(x.id)), false);
  const state = JSON.parse(read(path.join(f.root, 'notes.craftsman.json'))), commentState = JSON.parse(read(path.join(f.root, '.yalken/word-review/non-text-return-state.v1.json')));
  assert.equal(state.notes.length, 2); assert.equal(commentState.threads.length, 2);
  assert.equal(state.notes.filter(x => x.manuscript.reference.sceneId === path.relative(f.root, activePath).split(path.sep).join('/')).length, 1);
  const before = f.capture(), outPath = path.join(f.temp, 'mixed.docx');
  const result = await f.probe.exportMin({ outPath }); assert.equal(result.ok, 1, JSON.stringify(result));
  assert.equal(fs.existsSync(outPath), true); assert.deepEqual(f.capture(), before, 'export is read-only');
  const bridge = await import('../../src/io/revisionBridge/index.mjs');
  const imported = bridge.buildDocxContentPreviewFromZipBytes(fs.readFileSync(outPath));
  assert.equal(imported.ok, true, JSON.stringify(imported));
  assert.equal(imported.contentPreview.userBookmarkInventory.bookmarks.length, 7);
  assert.equal(imported.contentPreview.userBookmarkInventory.links.length, 2);
  assert.deepEqual(imported.contentPreview.manuscriptNotes, [{ kind: 'footnote', paragraphIndex: 0, offsetUtf16: 2, body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Mixed footnote' }] }] } }]);
});

async function rejectedRichCopy(t) {
  const f = await fixture(t); await installMixedScene(f);
  const original = read(f.alpha);
  const copy = await f.main.handleUiCopyNodeCommand({ projectId: f.query.projectId, nodeId: f.a.nodeId, name: 'Fork', expectedTreeRevision: 0 });
  assert.equal(copy.ok, true, JSON.stringify(copy));
  const fork = path.join(f.imported, '03_Fork.txt');
  let content = read(fork), identity = { projectId: f.query.projectId, documentId: copy.nodeId }, accept = false, generation = 9;
  const ui = mountRenderer(f, () => content, () => generation, null, () => identity, payload => {
    if (accept && payload.treeReplacement && payload.expectedDocumentId === identity.documentId
      && payload.expectedContent === content && payload.expectedGeneration === generation) {
      content = payload.content; identity = { projectId: payload.projectId, documentId: payload.documentId };
    }
  });
  f.probe.state({ filePath: fork, generation: 0 });
  const undo = await f.main.handleUiTreeUndoCommand({ projectId: f.query.projectId, expectedTreeRevision: 1, mutationId: copy.lastMutation.id });
  assert.equal(undo.ok, true, JSON.stringify(undo));
  const parsed = envelope.parseObservablePayload(content);
  parsed.doc.content[7].content.push({ type: 'text', text: ' retained typing' });
  content = envelope.composeObservablePayload({ ...parsed, metaEnabled: parsed.hasMetaBlock });
  generation++; f.probe.state({ dirty: true, generation: 1 });
  return { f, ui, copy, original, content: () => content, identity: () => identity,
    accept: () => { accept = true; }, corrupt: fn => { content = fn(content); generation++; }, identify: value => { identity = value; } };
}

test('actual existing SaveAs recovers rejected rich copy from private Undo packet with fresh graph and stable periodic backup, then opens original', async t => {
  const r = await rejectedRichCopy(t), { f } = r;
  const rawCopied = envelope.parseObservablePayload(r.content()).doc;
  const priorCopyIds = new Set(bookmarks.readRegistry(rawCopied).bookmarks.map(x => x.id));
  const target = path.join(f.imported, 'Recovered.txt'); f.chooseSavePath(target); r.accept();
  assert.equal(await f.probe.saveAs(), true, JSON.stringify(r.ui.sends.filter(x => x.channel.includes("status"))));
  assert.equal(f.probe.state().filePath, target); assert.equal(read(f.alpha), r.original);
  const recovered = envelope.parseObservablePayload(read(target));
  assert.equal(recovered.hasMetaBlock, true); assert.equal(recovered.meta.synopsis, 'Mixed graph metadata');
  assert.match(recovered.text, /retained typing/u);
  const registry = bookmarks.readRegistry(recovered.doc); assert.equal(registry.bookmarks.length, 7);
  assert.equal(registry.bookmarks.some(x => priorCopyIds.has(x.id)), false);
  const notesState = JSON.parse(read(path.join(f.root, 'notes.craftsman.json'))), commentsState = JSON.parse(read(path.join(f.root, '.yalken/word-review/non-text-return-state.v1.json')));
  assert.equal(notesState.notes.length, 2); assert.equal(commentsState.threads.length, 2);
  assert.equal(notesState.notes.filter(x => x.manuscript.reference.sceneId === 'roman/Imported/Recovered.txt').length, 1);
  assert.equal(commentsState.threads.filter(x => x.anchor.sceneId === 'roman/Imported/Recovered.txt').length, 1);
  const beforeBackup = f.capture(); const backup = await f.probe.backup();
  assert.equal(backup.success, true, JSON.stringify(backup)); assert.deepEqual(f.capture(), beforeBackup, 'same recovered bytes dedupe against its own checkpoint');
  const exported = await f.probe.exportMin({ outPath: path.join(f.temp, 'recovered.docx') }); assert.equal(exported.ok, 1, JSON.stringify(exported));
  const opened = await f.main.handleUiOpenDocumentCommand({ projectId: f.query.projectId, nodeId: f.a.nodeId });
  assert.equal(opened.ok, true, JSON.stringify(opened)); assert.equal(f.probe.state().filePath, f.alpha); assert.equal(read(f.alpha), r.original);
});

for (const variant of ['cancel', 'outside', 'existing', 'symlink', 'wrong-id', 'foreign-project', 'stale-session', 'typing-during-dialog', 'changed-graph', 'comment-draft', 'note-draft']) test(`private rich recovery ${variant} refuses without original or graph writes and retains working buffer`, async t => {
  const r = await rejectedRichCopy(t), { f } = r;
  let target = path.join(f.imported, 'Recovered.txt'), during = null;
  if (variant === 'cancel') target = null;
  if (variant === 'outside') target = path.join(f.temp, 'Outside.txt');
  if (variant === 'existing') target = f.alpha;
  if (variant === 'symlink') { fs.symlinkSync(f.alpha, target); }
  if (variant === 'wrong-id') r.identify({ projectId: f.query.projectId, documentId: f.a.nodeId });
  if (variant === 'foreign-project') r.identify({ projectId: 'foreign', documentId: r.copy.nodeId });
  if (variant === 'stale-session') f.probe.changeSession();
  if (variant === 'comment-draft') r.identify({ projectId: f.query.projectId, documentId: r.copy.nodeId, commentAuthoringPending: true });
  if (variant === 'note-draft') r.identify({ projectId: f.query.projectId, documentId: r.copy.nodeId, manuscriptNoteAuthoringPending: true });
  if (variant === 'typing-during-dialog') during = () => f.probe.state({ generation: 2, dirty: true });
  if (variant === 'changed-graph') r.corrupt(raw => { const parsed = envelope.parseObservablePayload(raw); parsed.doc.attrs.wordUserBookmarks.bookmarks[0].id = 'ubm-' + 'f'.repeat(32); return envelope.composeObservablePayload({ ...parsed, metaEnabled: parsed.hasMetaBlock }); });
  const content = r.content(), before = f.capture(); f.chooseSavePath(target, during);
  assert.equal(await f.probe.saveAs(), false); assert.deepEqual(f.capture(), before); assert.equal(read(f.alpha), r.original); assert.equal(r.content(), content);
});

for (const variant of ['second-publication-rejected', 'late-typing-at-durable-cleanup']) test(`recovered rich copy ${variant} stays recoverable through another native SaveAs and original Open`, async t => {
  const r = await rejectedRichCopy(t), { f } = r;
  const first = path.join(f.imported, 'RecoveryOne.txt'); f.chooseSavePath(first);
  const transaction = require('../../src/core/project-transaction-v1.cjs'), originalUnlink = fsp.unlink;
  if (variant === 'late-typing-at-durable-cleanup') fsp.unlink = async function (target, ...args) {
    if (target === transaction.journalPathFor(f.manifestPath) && fs.existsSync(first)) {
      r.corrupt(raw => { const parsed = envelope.parseObservablePayload(raw); parsed.doc.content[7].content.push({ type: 'text', text: ' even later typing' }); return envelope.composeObservablePayload({ ...parsed, metaEnabled: parsed.hasMetaBlock }); });
      f.probe.state({ generation: 2, dirty: true });
    }
    return originalUnlink.call(this, target, ...args);
  };
  try { assert.equal(await f.probe.saveAs(), false); } finally { fsp.unlink = originalUnlink; }
  assert.equal(fs.existsSync(first), true); assert.equal(read(f.alpha), r.original); assert.equal(f.probe.state().filePath, first);
  const firstBytes = read(first), retained = r.content();
  const second = path.join(f.imported, 'RecoveryTwo.txt'); f.chooseSavePath(second); r.accept();
  assert.equal(await f.probe.saveAs(), true, JSON.stringify(r.ui.sends.filter(x => x.channel.includes('status'))));
  assert.equal(read(first), firstBytes); assert.equal(read(f.alpha), r.original);
  assert.equal(bookmarks.readRegistry(envelope.parseObservablePayload(read(second)).doc).bookmarks.length, 7);
  assert.match(envelope.parseObservablePayload(read(second)).text, /retained typing/u);
  if (variant === 'late-typing-at-durable-cleanup') assert.match(envelope.parseObservablePayload(read(second)).text, /even later typing/u);
  assert.equal(r.content(), read(second)); assert.notEqual(r.content(), retained);
  assert.equal(JSON.parse(read(path.join(f.root, 'notes.craftsman.json'))).notes.length, 3);
  assert.equal(JSON.parse(read(path.join(f.root, '.yalken/word-review/non-text-return-state.v1.json'))).threads.length, 3);
  const beforeBackup = f.capture(); assert.equal((await f.probe.backup()).success, true); assert.deepEqual(f.capture(), beforeBackup);
  assert.equal((await f.main.handleUiOpenDocumentCommand({ projectId: f.query.projectId, nodeId: f.a.nodeId })).ok, true);
  assert.equal(read(f.alpha), r.original);
});

test('durable recovered graph cannot rebind or dirty a foreign Main authoring context during journal cleanup', async t => {
  const r = await rejectedRichCopy(t), { f } = r, target = path.join(f.imported, 'Recovered.txt'); f.chooseSavePath(target); r.accept();
  const transaction = require('../../src/core/project-transaction-v1.cjs'), originalUnlink = fsp.unlink;
  fsp.unlink = async function (file, ...args) {
    if (file === transaction.journalPathFor(f.manifestPath) && fs.existsSync(target)) {
      f.probe.state({ filePath: f.beta, dirty: false, generation: 0 }); f.probe.changeSession();
    }
    return originalUnlink.call(this, file, ...args);
  };
  try { assert.equal(await f.probe.saveAs(), false); } finally { fsp.unlink = originalUnlink; }
  assert.equal(fs.existsSync(target), true); assert.equal(read(f.alpha), r.original); assert.equal(read(f.beta), 'Beta');
  assert.equal(f.probe.state().filePath, f.beta); assert.equal(f.probe.state().dirty, false);
  assert.equal(r.ui.sends.filter(x => x.payload?.treeReplacement).length, 1, 'only original rejected Undo publication, no foreign recovery publication');
});

async function lateDetachedRichCopy(t, receiptRace = false) {
  const f = await fixture(t); await installMixedScene(f); const original = read(f.alpha);
  const copy = await f.main.handleUiCopyNodeCommand({ projectId: f.query.projectId, nodeId: f.a.nodeId, name: 'Fork', expectedTreeRevision: 0 });
  const fork = path.join(f.imported, '03_Fork.txt'); let content = read(fork), generation = 9;
  let identity = { projectId: f.query.projectId, documentId: copy.nodeId }, accepted = false;
  const ui = mountRenderer(f, () => content, () => generation, null, () => identity, payload => {
    if (payload.treeDetached && payload.expectedContent === content && payload.expectedGeneration === generation) {
      identity = { projectId: payload.projectId, documentId: '' }; accepted = true;
    } else if (payload.treeReplacement && payload.expectedContent === content && payload.expectedGeneration === generation
      && (payload.expectedDocumentId === identity.documentId || payload.treeRecovery === true && identity.documentId === '' && payload.expectedDocumentId === copy.nodeId)) { content = payload.content; identity = { projectId: payload.projectId, documentId: payload.documentId }; }
  });
  f.probe.state({ filePath: fork, generation: 0 });
  const transaction = require('../../src/core/project-transaction-v1.cjs'), originalUnlink = fsp.unlink, originalReadFile = fsp.readFile;
  let raced = false;
  if (receiptRace) fsp.readFile = async function (file, ...args) {
    const result = await originalReadFile.call(this, file, ...args);
    if (!raced && file === transaction.treeCommitPathFor(f.manifestPath) && f.probe.state().filePath === null) {
      raced = true;
      const parsed = envelope.parseObservablePayload(content); parsed.doc.content[7].content.push({ type: 'text', text: ' receipt-race typing' });
      content = envelope.composeObservablePayload({ ...parsed, metaEnabled: parsed.hasMetaBlock }); generation++;
      f.probe.state({ dirty: true, generation: 2 });
    }
    return result;
  };
  fsp.unlink = async function (file, ...args) {
    if (file === transaction.journalPathFor(f.manifestPath)) {
      const parsed = envelope.parseObservablePayload(content); parsed.doc.content[7].content.push({ type: 'text', text: ' late original Undo typing' });
      content = envelope.composeObservablePayload({ ...parsed, metaEnabled: parsed.hasMetaBlock }); generation++;
      f.probe.state({ dirty: true, generation: 1 });
    }
    return originalUnlink.call(this, file, ...args);
  };
  let undo;
  try { undo = await f.main.handleUiTreeUndoCommand({ projectId: f.query.projectId, expectedTreeRevision: 1, mutationId: copy.lastMutation.id }); }
  finally { fsp.unlink = originalUnlink; fsp.readFile = originalReadFile; }
  return { f, copy, fork, ui, original, undo, accepted: () => accepted, raced: () => raced, identity: () => identity, content: () => content,
    identify: value => { identity = value; }, corrupt: change => { content = change(content); } };
}

test('late original copy Undo detached rich buffer reaches actual private SaveAs with monotonic renderer epoch and full graph', async t => {
  const r = await lateDetachedRichCopy(t), { f, copy, fork, ui, original, undo } = r;
  assert.equal(undo.committed, true, JSON.stringify(undo)); assert.equal(f.probe.state().filePath, null);
  assert.equal(r.accepted(), true, 'actual detached publication must use renderer epoch10 independently of Main signal1');
  assert.equal(r.identity().documentId, '');
  const before = f.capture(); assert.notEqual(await f.probe.save(), true); assert.deepEqual(f.capture(), before);
  const target = path.join(f.imported, 'RecoveredDetached.txt'); f.chooseSavePath(target);
  assert.equal(await f.probe.saveAs(), true, JSON.stringify(ui.sends.filter(x => x.channel.includes('status'))));
  assert.equal(read(f.alpha), original); assert.equal(fs.existsSync(fork), false);
  const doc = envelope.parseObservablePayload(read(target)); assert.equal(bookmarks.readRegistry(doc.doc).bookmarks.length, 7);
  assert.match(doc.text, /late original Undo typing/u); assert.equal(doc.hasMetaBlock, true);
  assert.equal(JSON.parse(read(path.join(f.root, 'notes.craftsman.json'))).notes.length, 2);
  assert.equal(JSON.parse(read(path.join(f.root, '.yalken/word-review/non-text-return-state.v1.json'))).threads.length, 2);
  assert.equal((await f.probe.exportMin({ outPath: path.join(f.temp, 'detached.docx') })).ok, 1);
  assert.equal((await f.main.handleUiOpenDocumentCommand({ projectId: f.query.projectId, nodeId: f.a.nodeId })).ok, true);
  assert.equal(read(f.alpha), original);
});

for (const variant of ['wrong-document', 'foreign-project', 'stale-session', 'stale-token', 'pending-comment', 'pending-note', 'forged-registry']) test(`detached rich private recovery ${variant} refuses without writes or buffer loss`, async t => {
  const r = await lateDetachedRichCopy(t), { f } = r;
  assert.equal(r.accepted(), true); assert.equal(f.probe.state().filePath, null);
  if (variant === 'wrong-document') r.identify({ projectId: f.query.projectId, documentId: f.a.nodeId });
  if (variant === 'foreign-project') r.identify({ projectId: 'foreign', documentId: '' });
  if (variant === 'pending-comment') r.identify({ ...r.identity(), commentAuthoringPending: true });
  if (variant === 'pending-note') r.identify({ ...r.identity(), manuscriptNoteAuthoringPending: true });
  if (variant === 'stale-session') f.probe.changeSession();
  if (variant === 'stale-token') {
    const transaction = require('../../src/core/project-transaction-v1.cjs'), receiptPath = transaction.treeCommitPathFor(f.manifestPath);
    const receipt = JSON.parse(read(receiptPath)); receipt.treeRevision++; fs.writeFileSync(receiptPath, JSON.stringify(receipt));
  }
  if (variant === 'forged-registry') r.corrupt(raw => {
    const parsed = envelope.parseObservablePayload(raw); parsed.doc.attrs.wordUserBookmarks.bookmarks[0].id = 'ubm-' + 'c'.repeat(32);
    return envelope.composeObservablePayload({ ...parsed, metaEnabled: parsed.hasMetaBlock });
  });
  const raw = r.content(), before = f.capture(), target = path.join(f.imported, 'RecoveredDetached.txt'); f.chooseSavePath(target);
  assert.equal(await f.probe.saveAs(), false); assert.equal(fs.existsSync(target), false);
  assert.deepEqual(f.capture(), before); assert.equal(read(f.alpha), r.original); assert.equal(r.content(), raw); assert.equal(f.probe.state().filePath, null);
});

test('typing during detached Undo receipt read installs verified private recovery for the fresh buffer epoch', async t => {
  const r = await lateDetachedRichCopy(t, true), { f } = r;
  assert.equal(r.raced(), true); assert.equal(r.accepted(), true); assert.equal(f.probe.state().generation, 2);
  assert.equal(r.undo.committed, true); assert.equal(r.undo.error, 'E_TREE_UNSAVED_COPY_SAVE_AS_REQUIRED');
  const target = path.join(f.imported, 'ReceiptRaceRecovery.txt'); f.chooseSavePath(target);
  assert.equal(await f.probe.saveAs(), true); assert.equal(read(f.alpha), r.original);
  assert.match(envelope.parseObservablePayload(read(target)).text, /receipt-race typing/u);
  assert.equal(bookmarks.readRegistry(envelope.parseObservablePayload(read(target)).doc).bookmarks.length, 7);
});

async function topologyFixture(t, { refuse = false, lateTarget = false } = {}) {
  const f = await fixture(t); await installMixedScene(f);
  let working = read(f.alpha), documentId = f.a.nodeId, publicationId = '', uiGeneration = 9;
  let cut = { boundaryRootIndex: 1, position: 22 }, serial = 0, decline = refuse;
  const publications = [];
  const ui = mountRenderer(f, () => working, () => uiGeneration, null,
    () => ({ projectId: f.query.projectId, documentId, treeContentPublicationId: publicationId, rootSplitBoundary: cut }),
    payload => {
      publications.push(payload);
      if (payload.treeContentReplacement && !decline) {
        assert.equal(payload.expectedContent, working);
        assert.equal(payload.expectedDocumentId, documentId);
        assert.equal(payload.expectedGeneration, uiGeneration);
        assert.equal(payload.expectedTreeContentPublicationId, publicationId);
        working = payload.content; documentId = payload.documentId; publicationId = payload.treeContentPublicationId;
        cut = null;
        if (lateTarget) {
          lateTarget = false;
          const parsed = envelope.parseObservablePayload(working);
          parsed.doc.content.push({type:'paragraph',content:[{type:'text',text:'typed new partition 🧭'}]});
          working = envelope.composeObservablePayload({...parsed,metaEnabled:parsed.hasMetaBlock,doc:parsed.doc});
          uiGeneration++; f.probe.state({dirty:true,generation:uiGeneration});
        }
      }
    });
  // Main's open epoch is independent of the renderer's monotonic text epoch.
  f.probe.state({ filePath: f.alpha, generation: 0 });
  const request = (split, overrides = {}) => ({ projectId: f.query.projectId, nodeId: f.a.nodeId,
    expectedTreeRevision: 0, expectedDocumentId: documentId, expectedGeneration: uiGeneration,
    expectedTreeContentPublicationId: publicationId, ...(split ? { name: 'Right', boundaryRootIndex: 1 } : {}), ...overrides });
  const dispatch = async (commandId, payload) => {
    const protocol = require('../../src/core/ipc-envelope-v1.cjs');
    const packet = protocol.createEnvelope('ui:command-bridge', commandId, payload,
      { correlationId: 'topology-real-' + ++serial, issuedAt: '2026-10-02T00:00:00.000Z' });
    const receipt = await f.handles.get('ui:command-bridge')(ui.event, packet);
    return receipt.ok === true ? receipt.value : receipt;
  };
  return { f, ui, publications, request, dispatch,
    working: () => working, identity: () => ({ projectId: f.query.projectId, documentId, treeContentPublicationId: publicationId }),
    edit(fn) { working = fn(working); uiGeneration++; f.probe.state({ dirty: true, generation: uiGeneration }); },
    observation(value) { if ('documentId' in value) documentId = value.documentId; if ('epoch' in value) publicationId = value.epoch; },
    boundary(value) { cut = value; },
    accept() { decline = false; },
    refuse() { decline = true; },
    deferNextSnapshot() {
      const wc = ui.event.sender, send = wc.send;
      let request = null;
      wc.send = (channel, payload) => {
        if (channel === 'editor:snapshot-request') { request = payload.requestId; wc.send = send; }
        else send(channel, payload);
      };
      return snapshot => f.listeners.get('editor:snapshot-response')(ui.event, { requestId: request, snapshot });
    },
  };
}

test('topology actual versioned bridge splits the mixed graph, replaces same-ID content, merges and restores exact structural Undo', async t => {
  const r = await topologyFixture(t), { f } = r, original = read(f.alpha);
  const split = await r.dispatch('cmd.project.tree.splitScene', r.request(true));
  assert.equal(split.ok, true, JSON.stringify(split));
  const right = path.join(f.imported, '02_Right.txt');
  assert.equal(fs.existsSync(right), true);
  assert.equal(envelope.parseObservablePayload(read(f.alpha)).text, 'Alpha target unique');
  assert.equal(bookmarks.readRegistry(envelope.parseObservablePayload(read(right)).doc).bookmarks.length, 7);
  assert.equal(f.probe.state().filePath, f.alpha);
  assert.equal(r.publications[0].treeContentReplacement, true);
  assert.equal(r.publications[0].documentId, f.a.nodeId);
  assert.notEqual(r.identity().treeContentPublicationId, '');
  assert.equal((await f.probe.snapshot()).treeContentPublicationId, r.identity().treeContentPublicationId);
  const merge = await r.dispatch('cmd.project.tree.mergeNextScene', r.request(false, { expectedTreeRevision: 1 }));
  assert.equal(merge.ok, true, JSON.stringify(merge));
  assert.equal(fs.existsSync(right), false);
  assert.equal(envelope.parseObservablePayload(read(f.alpha)).text, envelope.parseObservablePayload(original).text);
  assert.equal(bookmarks.readRegistry(envelope.parseObservablePayload(read(f.alpha)).doc).bookmarks.length, 7);
  const undoMerge = await f.main.handleUiTreeUndoCommand({ projectId: f.query.projectId, expectedTreeRevision: 2, mutationId: merge.lastMutation.id });
  assert.equal(undoMerge.ok, true, JSON.stringify(undoMerge));
  assert.equal(fs.existsSync(right), true); assert.equal(envelope.parseObservablePayload(read(f.alpha)).text, 'Alpha target unique');
  const state = JSON.parse(read(path.join(f.root, 'notes.craftsman.json'))), comments = JSON.parse(read(path.join(f.root, '.yalken/word-review/non-text-return-state.v1.json')));
  assert.equal(state.notes.length, 1); assert.equal(comments.threads.length, 1);
});

for (const variant of ['cut-position', 'cut-index', 'epoch', 'document', 'generation', 'foreign-path']) test(`topology raw/current ${variant} refuses before graph or authority writes`, async t => {
  const r = await topologyFixture(t), { f } = r, before = f.capture();
  const request = r.request(true);
  if (variant === 'cut-position') r.boundary({ boundaryRootIndex: 1, position: 21 });
  if (variant === 'cut-index') request.boundaryRootIndex = 2;
  if (variant === 'epoch') request.expectedTreeContentPublicationId = 'forged';
  if (variant === 'document') request.expectedDocumentId = f.b.nodeId;
  if (variant === 'generation') request.expectedGeneration = 8;
  if (variant === 'foreign-path') request.sourceRelativePath = 'roman/02_Beta.txt';
  const result = await r.dispatch('cmd.project.tree.splitScene', request);
  assert.equal(result.ok, false, JSON.stringify(result)); assert.deepEqual(f.capture(), before);
  assert.equal(r.publications.length, 0);
});

test('topology refused same-ID replacement cannot authorize old full buffer even with a forged target epoch', async t => {
  const r = await topologyFixture(t, { refuse: true }), { f } = r;
  const result = await r.dispatch('cmd.project.tree.splitScene', r.request(true));
  assert.equal(result.ok, false, JSON.stringify(result));
  assert.equal(envelope.parseObservablePayload(read(f.alpha)).text, 'Alpha target unique');
  const before = f.capture(), targetEpoch = r.publications[0].treeContentPublicationId;
  r.observation({ epoch: targetEpoch });
  await assert.rejects(f.probe.snapshot(), /TREE_EDITOR_IDENTITY_UNCONFIRMED/u);
  assert.equal((await f.probe.save()).ok, false);
  const recoveryTarget = path.join(f.imported, 'ForgedTargetRecovery.txt'); f.chooseSavePath(recoveryTarget);
  assert.equal(await f.probe.saveAs(), false); assert.equal(fs.existsSync(recoveryTarget), false);
  assert.deepEqual(f.capture(), before);
  assert.match(envelope.parseObservablePayload(r.working()).text, /Link destination/u);
});

test('topology old same-ID snapshot answered after new content ACK remains session-stale', async t => {
  const r = await topologyFixture(t), { f } = r, original = r.working(), oldIdentity = r.identity();
  const answer = r.deferNextSnapshot();
  const old = f.probe.snapshot().then(value => ({ value }), error => ({ error }));
  const split = await r.dispatch('cmd.project.tree.splitScene', r.request(true));
  assert.equal(split.ok, true, JSON.stringify(split));
  assert.equal((await f.probe.snapshot()).treeContentPublicationId, r.identity().treeContentPublicationId);
  const after = f.capture();
  answer({ ...oldIdentity, content: original, generation: 9 });
  assert.equal((await old).error?.code, 'E_TREE_EDITOR_IDENTITY_UNCONFIRMED');
  assert.deepEqual(f.capture(), after); assert.equal(f.probe.state().dirty, false);
});

test('topology refused old whole rich buffer forks through actual SaveAs using verified preimage; partitions stay exact', async t => {
  const r = await topologyFixture(t, { refuse: true }), { f } = r;
  const original = r.working(), split = await r.dispatch('cmd.project.tree.splitScene', r.request(true));
  assert.equal(split.ok, false); assert.equal(fs.existsSync(path.join(f.imported, '02_Right.txt')), true);
  r.edit(raw => {
    const parsed = envelope.parseObservablePayload(raw);
    parsed.doc.content.push({ type: 'paragraph', content: [{ type: 'text', text: 'late original buffer 🧭' }] });
    return envelope.composeObservablePayload({ ...parsed, metaEnabled: parsed.hasMetaBlock, doc: parsed.doc });
  });
  const left = read(f.alpha), right = read(path.join(f.imported, '02_Right.txt'));
  const target = path.join(f.imported, 'RecoveredOriginal.txt'); f.chooseSavePath(target); r.accept();
  assert.equal(await f.probe.saveAs(), true);
  assert.equal(read(f.alpha), left); assert.equal(read(path.join(f.imported, '02_Right.txt')), right);
  const recovered = envelope.parseObservablePayload(read(target));
  assert.match(recovered.text, /late original buffer 🧭/u);
  assert.equal(bookmarks.readRegistry(recovered.doc).bookmarks.length, 7);
  const originalIds = new Set(bookmarks.readRegistry(envelope.parseObservablePayload(original).doc).bookmarks.map(x => x.id));
  assert.equal(bookmarks.readRegistry(recovered.doc).bookmarks.some(x => originalIds.has(x.id)), false);
  const state = JSON.parse(read(path.join(f.root, 'notes.craftsman.json'))), comments = JSON.parse(read(path.join(f.root, '.yalken/word-review/non-text-return-state.v1.json')));
  assert.equal(state.notes.length, 2); assert.equal(comments.threads.length, 2);
  assert.equal(f.probe.state().filePath, target); assert.equal(f.probe.state().dirty, false);
  assert.equal((await f.probe.snapshot()).documentId, r.identity().documentId);
});

for (const kind of ['save', 'autosave']) test(`topology old ${kind} queue callback cannot write same-ID partitions after successful new ACK`, async t => {
  const r = await topologyFixture(t), { f } = r, oldSession = f.probe.session();
  const resume = f.probe.captureQueued(kind === 'save' ? 'save existing project transaction' : 'autosave project transaction');
  if (kind === 'autosave') f.probe.state({ dirty: true });
  const deferred = await f.probe[kind === 'save' ? 'save' : 'autosave']();
  assert.notEqual(deferred, true); assert.equal(deferred.ok, false);
  // A normal real Save settles the already durable unchanged buffer, without
  // retiring the captured authoring session or fabricating a successful write.
  assert.equal(await f.probe.save(), true); assert.equal(f.probe.session(), oldSession);
  const split = await r.dispatch('cmd.project.tree.splitScene', r.request(true));
  assert.equal(split.ok, true, JSON.stringify(split)); assert.notEqual(f.probe.session(), oldSession);
  assert.equal((await f.probe.snapshot()).treeContentPublicationId, r.identity().treeContentPublicationId);
  const before = f.capture(), outcome = await resume();
  assert.equal(outcome.success, false); assert.equal(outcome.code, 'E_SAVE_AUTHORING_TARGET_STALE');
  assert.deepEqual(f.capture(), before); assert.equal(envelope.parseObservablePayload(read(f.alpha)).text, 'Alpha target unique');
});

test('topology typing in an applied partition before initial ACK recovers only its verified afterimage through SaveAs', async t => {
  const r = await topologyFixture(t,{lateTarget:true}), { f } = r;
  const result = await r.dispatch('cmd.project.tree.splitScene', r.request(true));
  assert.equal(result.ok,false); assert.equal(result.value.committed,true);
  const left = read(f.alpha), rightPath = path.join(f.imported,'02_Right.txt'), right = read(rightPath);
  const partitionText = envelope.parseObservablePayload(r.working()).text;
  assert.match(partitionText,/typed new partition 🧭/u); assert.doesNotMatch(partitionText,/Twin repeated text/u);
  assert.equal((await f.probe.save()).ok,false);
  const target = path.join(f.imported,'RecoveredPartition.txt'); f.chooseSavePath(target);
  assert.equal(await f.probe.saveAs(),true);
  assert.equal(read(f.alpha),left); assert.equal(read(rightPath),right);
  const recovered = envelope.parseObservablePayload(read(target));
  assert.equal(recovered.text,partitionText);
  assert.equal(bookmarks.readRegistry(recovered.doc)?.bookmarks.length || 0,0);
  assert.equal(bookmarks.readRegistry(envelope.parseObservablePayload(right).doc).bookmarks.length,7);
  const noteState=JSON.parse(read(path.join(f.root,'notes.craftsman.json'))), commentState=JSON.parse(read(path.join(f.root,'.yalken/word-review/non-text-return-state.v1.json')));
  const sceneId=path.relative(f.root,target).split(path.sep).join('/');
  assert.equal(noteState.notes.filter(n=>n.manuscript?.reference.sceneId===sceneId).length,1);
  assert.equal(commentState.threads.filter(thread=>thread.sceneId===sceneId).length,1);
  assert.equal(f.probe.state().dirty,false);
});

test('topology rejected afterimage recovery retries its retained partition graph without rebinding original IDs', async t => {
  const r = await topologyFixture(t,{lateTarget:true}), { f } = r;
  const split = await r.dispatch('cmd.project.tree.splitScene',r.request(true));
  assert.equal(split.ok,false); assert.equal(split.value.committed,true);
  const left=read(f.alpha), rightPath=path.join(f.imported,'02_Right.txt'), right=read(rightPath), working=r.working();
  const first=path.join(f.imported,'RecoveryDeclined.txt'); f.chooseSavePath(first); r.refuse();
  assert.equal(await f.probe.saveAs(),false); assert.equal(fs.existsSync(first),true);
  const firstContent=read(first), second=path.join(f.imported,'RecoveryAccepted.txt'); f.chooseSavePath(second); r.accept();
  assert.equal(await f.probe.saveAs(),true);
  assert.equal(read(f.alpha),left); assert.equal(read(rightPath),right); assert.equal(read(first),firstContent);
  assert.equal(envelope.parseObservablePayload(read(second)).text,envelope.parseObservablePayload(working).text);
  assert.equal(bookmarks.readRegistry(envelope.parseObservablePayload(read(second)).doc)?.bookmarks.length || 0,0);
  const notes=JSON.parse(read(path.join(f.root,'notes.craftsman.json'))), comments=JSON.parse(read(path.join(f.root,'.yalken/word-review/non-text-return-state.v1.json')));
  assert.equal(notes.notes.length,3); assert.equal(comments.threads.length,3);
  assert.equal(new Set(notes.notes.map(n=>n.id)).size,3); assert.equal(new Set(comments.threads.map(thread=>thread.threadId)).size,3);
  assert.equal(f.probe.state().filePath,second); assert.equal(f.probe.state().dirty,false);
});

for (const variant of ['wrong-target-epoch','wrong-target-owner']) test(`topology afterimage ${variant} refuses SaveAs without partition or graph writes`,async t=>{
  const r=await topologyFixture(t,{lateTarget:true}), {f}=r;
  const split=await r.dispatch('cmd.project.tree.splitScene',r.request(true));
  assert.equal(split.ok,false); assert.equal(split.value.committed,true);
  if(variant==='wrong-target-epoch') r.observation({epoch:'unowned-epoch'});
  else r.observation({documentId:f.b.nodeId});
  const before=f.capture(), working=r.working(), target=path.join(f.imported,'InvalidAfterimage.txt'); f.chooseSavePath(target);
  assert.equal(await f.probe.saveAs(),false); assert.equal(fs.existsSync(target),false);
  assert.deepEqual(f.capture(),before); assert.equal(r.working(),working);
});

for (const scope of ['exportReview','exportFullReview']) for (const stage of ['source','build','gate','cancel']) test(`actual ${scope} resolved ${stage} outcome surfaces safe diagnostics without altering receipt or writing`, async t=>{
  const f=await fixture(t), statuses=[], logger=f.probe.captureExportLogs(); t.after(()=>logger.restore());
  const detail=stage==='source'?'REVIEW_FULL_MANUSCRIPT_DOCX_EXPORT_DIRTY_EDITOR_BLOCKED':stage==='gate'?'RTK_V4_PUBLICATION_COMMENT_FINAL_MISMATCH':'private manuscript text /private/source/path';
  let sourceCalls=0, writes=0;
  const result=await f.probe[scope]({}, {
    resolveDocxReviewPacketExportPath:async()=>stage==='cancel'?'':path.join(f.temp,'export.docx'),
    validateDocxExportTarget:async()=>({ok:true}),
    readDocxReviewPacketExportSource:async()=>{sourceCalls++; if(stage==='source')throw Error(detail); return {};},
    buildDocxReviewPacketBuffer:async()=>{if(stage==='gate')return {documentBuffer:Buffer.from('gate-observation-only'),exportCapsule:{fullManuscript:true},publicationGate:{ok:false,code:detail,publishAllowed:false}};throw Error(detail);},
    writeBufferAtomic:async()=>{writes++;}, updateStatus:value=>statuses.push(value),
  });
  assert.equal(result.ok,false); assert.equal(writes,0);
  assert.equal(result.error.op,scope==='exportFullReview'?'cmd.project.review.exportFullManuscriptDocxReviewPacket':'cmd.project.review.exportDocxReviewPacket');
  if(stage==='cancel'){
    assert.equal(result.error.code,'E_REVIEW_DOCX_EXPORT_CANCELED'); assert.equal(sourceCalls,0);
    assert.deepEqual(statuses,['Экспорт отменён.']); assert.deepEqual(logger.records,[]);
  }else{
    const code=stage==='source'?'E_REVIEW_DOCX_EXPORT_SOURCE_UNAVAILABLE':stage==='gate'?'E_REVIEW_DOCX_EXPORT_PUBLICATION_GATE_BLOCKED':'E_REVIEW_DOCX_EXPORT_BUILD_FAILED';
    assert.equal(result.error.code,code);
    if(stage==='gate'){assert.equal(result.error.reason,detail);assert.equal(result.error.details.code,detail);assert.equal(result.error.details.message,undefined);}else assert.equal(result.error.details.message,detail);
    assert.equal(statuses.length,1); assert.ok(statuses[0].includes(code));
    if(stage==='source'||stage==='gate')assert.ok(statuses[0].includes(detail)); else assert.equal(statuses[0].includes(detail),false);
    assert.deepEqual(logger.records,[{context:'review-docx-export',error:{code,...(stage==='source'||stage==='gate'?{refusalCode:detail}:{})}}]);
    assert.equal(JSON.stringify(logger.records).includes('/private'),false);
  }
});

test('structural merge periodic backup dedupes durable afterimage even with cold process caches, while changed buffer still backs up',async t=>{
  const r=await topologyFixture(t), {f}=r;
  assert.equal((await r.dispatch('cmd.project.tree.splitScene',r.request(true))).ok,true);
  const merged=await r.dispatch('cmd.project.tree.mergeNextScene',r.request(false,{expectedTreeRevision:1})); assert.equal(merged.ok,true);
  const manager=require('../../src/utils/backupManager'), original=manager.createBackup; let calls=0;
  manager.createBackup=async(...args)=>{calls++;return original(...args);}; t.after(()=>{manager.createBackup=original;});
  const before=f.capture(); assert.equal((await f.probe.backup()).unchanged,true); assert.equal(calls,0);
  f.probe.clearBackupCaches();
  assert.equal((await f.probe.backup()).unchanged,true); assert.equal(calls,0); assert.deepEqual(f.capture(),before);
  const state=await require('../../src/core/project-transaction-v1.cjs').readVerifiedProjectTreeMutation({manifestPath:f.manifestPath});
  assert.equal(state.lastMutation.canUndo,true);
  const undo=await f.main.handleUiTreeUndoCommand({projectId:f.query.projectId,expectedTreeRevision:2,mutationId:merged.lastMutation.id});
  assert.equal(undo.ok,true,JSON.stringify(undo));
  assert.equal((await r.dispatch('cmd.project.tree.mergeNextScene',r.request(false,{expectedTreeRevision:3}))).ok,true);
  const durable=read(f.alpha), callsBeforeEdit=calls;
  r.edit(raw=>{const parsed=envelope.parseObservablePayload(raw); parsed.doc.content.push({type:'paragraph',content:[{type:'text',text:'actual changed backup'}]});return envelope.composeObservablePayload({...parsed,metaEnabled:parsed.hasMetaBlock});});
  assert.equal((await f.probe.backup()).success,true); assert.equal(calls,callsBeforeEdit+1);
  assert.equal(read(f.alpha),durable);
});

test('structural backup dedupe preserves foreign history bytes and exact Undo refusal',async t=>{
  const r=await topologyFixture(t), {f}=r;
  assert.equal((await r.dispatch('cmd.project.tree.splitScene',r.request(true))).ok,true);
  const merged=await r.dispatch('cmd.project.tree.mergeNextScene',r.request(false,{expectedTreeRevision:1})); assert.equal(merged.ok,true);
  const foreign=path.join(f.root,'backups',sha(f.alpha),'1790924312766_01_Alpha.txt'); fs.mkdirSync(path.dirname(foreign),{recursive:true}); fs.writeFileSync(foreign,'foreign history');
  f.probe.clearBackupCaches(); assert.equal((await f.probe.backup()).unchanged,true);
  const tx=require('../../src/core/project-transaction-v1.cjs'),state=await tx.readVerifiedProjectTreeMutation({manifestPath:f.manifestPath});
  assert.equal(state.lastMutation.canUndo,false); assert.equal(state.lastMutation.unavailableReason,'E_TREE_COHORT_FOREIGN_ENTRY');
  const before=f.capture(),result=await f.main.handleUiTreeUndoCommand({projectId:f.query.projectId,expectedTreeRevision:2,mutationId:merged.lastMutation.id});
  assert.equal(result.ok,false); assert.deepEqual(f.capture(),before); assert.equal(read(foreign),'foreign history');
});

for(const variant of ['typed-failure','secret-filter','cancel','pending','success']) test(`actual native DOCX review menu observes ${variant} receipt without changing activation semantics`,async t=>{
  const f=await fixture(t), logger=f.probe.captureExportLogs();t.after(()=>logger.restore());
  const receipt=variant==='typed-failure'?{ok:false,error:{code:'E_DOCX_REVIEW_PREVIEW_SESSION_RETURN_INTAKE_BLOCKED',reason:'RTK_RETURN_INTAKE_PARSER_V2_BLOCKED',details:{nestedCode:'RTK_WORD_UNSUPPORTED',nestedReason:'RTK_RETURN_INTAKE_DOCUMENT_METADATA_MISMATCH',message:'private manuscript /private/source'}}}
    :variant==='secret-filter'?{ok:false,error:{code:'private secret /private/source',reason:'private manuscript text',details:{nestedCode:'RTK_WORD_'+'A'.repeat(170),nestedReason:'/private/source'}}}
    :variant==='cancel'?{ok:true,activated:false,cancelled:true}
    :variant==='pending'?{ok:true,activated:false,pendingProductPath:{ok:true,status:'preview-ready'}}
    :{ok:true,activated:true,requestId:'actual-success'};
  const before=structuredClone(receipt), out=await f.probe.observeLocalReviewReceipt(receipt);
  assert.strictEqual(out.result,receipt);assert.deepEqual(receipt,before);
  if(variant==='typed-failure'){
    for(const code of [receipt.error.code,receipt.error.reason,receipt.error.details.nestedCode,receipt.error.details.nestedReason])assert.ok(out.statuses[0].includes(code));
    assert.deepEqual(logger.records,[{context:'review-docx-return',error:{code:receipt.error.code,reason:receipt.error.reason,nestedCode:receipt.error.details.nestedCode,nestedReason:receipt.error.details.nestedReason}}]);
    assert.deepEqual(out.opened,[]);assert.equal(out.statuses.length,1);
  }else if(variant==='secret-filter'){
    assert.deepEqual(logger.records,[{context:'review-docx-return',error:{code:'E_DOCX_REVIEW_PREVIEW_SESSION_FAILED'}}]);
    assert.equal(out.statuses.length,1);assert.ok(out.statuses[0].includes('E_DOCX_REVIEW_PREVIEW_SESSION_FAILED'));assert.deepEqual(out.opened,[]);
  }else{
    assert.deepEqual(out.statuses,[]);assert.deepEqual(logger.records,[]);
    assert.deepEqual(out.opened,variant==='success'?[['cmd.project.review.openComments',{source:'review-docx-local-file-preview-session',requestId:'actual-success'},'review-comment']]:[]);
  }
  assert.equal(JSON.stringify({statuses:out.statuses,logs:logger.records}).includes('/private'),false);
  assert.equal(JSON.stringify({statuses:out.statuses,logs:logger.records}).includes('private manuscript'),false);
});

async function cleanTextReturnFixture(t,{sectionType,typedBreak,headingLevel,schemaDefaults=false,sceneScope=false,bookmarked=true,mutateReturn,localCase,mixedLanguage=false,listType,continuedList=false,nativeStyle=false,nativeSuffix=false,nativeDefaults=false,inlineParser=true}={}) {
  const f=await fixture(t); if(bookmarked)await installMixedScene(f);
  const initial=read(f.alpha);let parsed=envelope.parseObservablePayload(initial);
  if(!parsed.doc)parsed.doc={type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Alpha'}]}]};
  if(headingLevel)Object.assign(parsed.doc.content[0],{type:'heading',attrs:{level:headingLevel}});
  if(typedBreak)parsed.doc.content[0].content.push({type:'hardBreak',attrs:{wordBreakType:typedBreak}},{type:'text',text:'After break'});
  if(listType)parsed.doc.content=[{type:'orderedList',attrs:{start:3,type:listType},content:[{type:'listItem',content:parsed.doc.content}]}];
  if(nativeStyle) {
    parsed.doc.attrs={wordPendingRevisions:null,wordUserBookmarks:null};
    const paragraph=parsed.doc.content[0].content[0].content[0];
    paragraph.attrs={textAlign:null};
    paragraph.content=[{type:'text',text:'Alpha',marks:[{type:'textStyle',attrs:{color:null,fontFamily:'Aptos',fontSize:'12pt'}}]},
      {type:'text',text:' SourceEdit02',marks:[{type:'textStyle',attrs:{color:'',fontFamily:'Aptos',fontSize:'12pt'}}]}];
  }
  if(continuedList) {
    const first=parsed.doc.content[0];Object.assign(first.attrs,{wordListId:'chain',wordListStart:3});
    const second=structuredClone(first);second.attrs.start=4;second.content[0].content[0].content[0].text='Continued';
    parsed.doc.content.push({type:'paragraph',content:[{type:'text',text:'gap'}]},second);
  }
  const beforeDoc=structuredClone(parsed.doc);
  const target=bookmarked?'Unannotated target':'Alpha';
  if(bookmarked){
    parsed.doc.content.unshift({type:'paragraph',content:[{type:'text',text:target}]});
    parsed.doc=bookmarks.planSave({beforeDoc,workingDoc:parsed.doc}).doc;
  }
  if(mixedLanguage){
    parsed.doc.content[0].content=[{type:'text',text:target.slice(0,1)},
      {type:'text',text:target.slice(1),marks:[{type:'textStyle',attrs:{wordLanguage:{val:'en-US'}}}]}];
  }
  const intermediate=envelope.composeObservablePayload({...parsed,metaEnabled:true,doc:parsed.doc});
  const beforeAppend=structuredClone(parsed.doc);
  // Repeated quote belongs to a different signed block, not this operation.
  parsed.doc.content.push({type:'paragraph',content:[{type:'text',text:'STARTBOUND_'+target+'_ENDBOUND'}]});
  parsed.doc=bookmarks.planSave({beforeDoc:beforeAppend,workingDoc:parsed.doc}).doc;
  if(nativeDefaults)for(const paragraph of parsed.doc.content){paragraph.attrs={...paragraph.attrs,textAlign:'left'};for(const node of paragraph.content||[])if(node.type==='text')node.marks=[...(node.marks||[]),{type:'textStyle',attrs:{fontFamily:'Times New Roman',fontSize:'12pt'}}];}
  if(sectionType)parsed.doc=require('../../src/core/word-sections-v1.cjs').bind(parsed.doc,{schemaVersion:1,boundaries:[{endParagraphIndex:0,properties:{type:sectionType,columns:{count:2,spaceTwips:720}}}],final:{type:'oddPage',columns:{count:2,spaceTwips:720}}});
  fs.writeFileSync(f.alpha,envelope.composeObservablePayload({...parsed,metaEnabled:true,doc:parsed.doc}));
  if(bookmarked){
    const notePath=path.join(f.root,'notes.craftsman.json'),commentPath=path.join(f.root,'.yalken/word-review/non-text-return-state.v1.json');
    let beforeContent=initial;
    for(const afterContent of [intermediate,read(f.alpha)]){
      const notePlan=notes.planManuscriptNoteAnchorSave({beforeText:read(notePath),projectId:f.query.projectId,sceneId:'roman/Imported/01_Alpha.txt',beforeContent,afterContent});
      fs.writeFileSync(notePath,notePlan.afterText);
      const commentPlan=require('../../src/core/word-comment-anchor-save-v1.cjs').planCommentAnchorSave({beforeText:read(commentPath),projectId:f.query.projectId,sceneId:'roman/Imported/01_Alpha.txt',beforeContent,afterContent});
      if(commentPlan)fs.writeFileSync(commentPath,commentPlan.afterText);
      beforeContent=afterContent;
    }
  }
  f.source=read(f.alpha); let observed=f.source;
  if(schemaDefaults){
    const live=envelope.parseObservablePayload(observed);
    live.doc.attrs={wordUserBookmarks:null,wordPendingRevisions:null,...live.doc.attrs};
    if(schemaDefaults==='unknown-attribute')live.doc.attrs.ownerData='unsaved';
    if(schemaDefaults==='false-attribute')live.doc.attrs.ownerData=false;
    const visit=node=>{if(node.type==='paragraph')node.attrs={textAlign:null,...node.attrs};for(const child of node.content||[])visit(child);};visit(live.doc);
    observed=envelope.composeObservablePayload({...live,metaEnabled:true,doc:live.doc});
  }
  const ui=mountRenderer(f,()=>observed,0,null,()=>({projectId:f.query.projectId,documentId:f.a.nodeId}),payload=>{observed=payload.content;});
  f.probe.state({filePath:f.alpha,projectName:'Роман'});
  const source=await (sceneScope?f.probe.sceneSource():f.probe.fullSource()),built=await f.probe.reviewBuild(source);
  assert.equal(built.publicationGate.publishAllowed,true,JSON.stringify(built.publicationGate));
  await f.probe.activate(source.pendingAuthorityStore);
  const bridge=await import('../../src/io/revisionBridge/index.mjs');
  const zip=bridge.extractDocxReviewTransportPackagePartsFromZipBytes({bytes:built.documentBuffer}).parts;
  assert.ok(zip['word/document.xml'].includes(target));
  const editedText=nativeSuffix?'SourceEdit02':mixedLanguage?target.slice(1):target;
  zip['word/document.xml']=zip['word/document.xml'].replace(editedText,editedText+' CLEAN_EDIT');
  if(mutateReturn)mutateReturn(zip);
  const bytes=require('../../src/export/docx/docxMinBuilder.js').buildStoredZip(Object.entries(zip).map(([name,data])=>({name,data})));
  if(localCase){
    const local=envelope.parseObservablePayload(read(f.alpha));
    const index=['overlap','same-paragraph','mixed-runs'].includes(localCase)?0:local.doc.content.length-1;
    const node=local.doc.content[index].content[0];
    if(localCase==='mixed-runs')local.doc.content[index].content.splice(1,0,{type:'text',text:'LOCAL ',marks:[{type:'italic'}]});
    else node.text=localCase==='same-paragraph'?'LOCAL '+node.text:node.text+' LOCAL_EDIT';
    observed=envelope.composeObservablePayload({...local,metaEnabled:true,doc:local.doc});
    f.probe.state({dirty:true});
    assert.equal(await f.probe.save(),true,'local edit must pass actual product Save');
    observed=read(f.alpha);
  }
  const beforeActivation=f.capture();
  const activated=await f.probe.reviewActivate({requestId:'clean-activation',bufferSource:bytes.toString('base64')},{allowInlineDocxReturnIntakeParserForTests:inlineParser});
  return {f,ui,source,bytes,activated,bridge,beforeActivation,getObserved:()=>observed};
}
for(const bookmarked of [true,false])test(`actual whole Main clean return activation, owner preview, full Apply and replay with bookmarks ${bookmarked}`,async t=>{
  const {f,ui,activated}=await cleanTextReturnFixture(t,{bookmarked});
  assert.equal(activated.ok,true,JSON.stringify(activated)); assert.equal(activated.activated,true,JSON.stringify(activated));
  assert.equal(activated.nonOverlapTrackedReplacementProductPath.prepared,true,JSON.stringify(activated));
  assert.equal(activated.noteProductPath?.status,'unchanged',JSON.stringify(activated.noteProductPath));
  const before=f.capture(), sibling=read(f.beta);
  await f.probe.refreshReview();
  assert.equal(f.probe.reviewState().reviewSurface.exactTextPlanPreview.status,'ready');assert.deepEqual(f.capture(),before);
  const result=await f.probe.fullApply({requestId:'clean-full-apply'});
  assert.equal(result.ok,true,JSON.stringify(result));assert.equal(result.applied,true,JSON.stringify(result));
  assert.equal(read(f.beta),sibling);
  const doc=envelope.parseObservablePayload(read(f.alpha)).doc;
  assert.match(doc.content[0].content[0].text,/CLEAN_EDIT/);assert.equal(doc.content.at(-1).content[0].text,'STARTBOUND_'+(bookmarked?'Unannotated target':'Alpha')+'_ENDBOUND');
  if(bookmarked){assert.equal(bookmarks.readRegistry(doc).bookmarks.length,7);
    const state=JSON.parse(read(path.join(f.root,'notes.craftsman.json')));
    const old=JSON.parse(Buffer.from(before.files['notes.craftsman.json'],'base64').toString());
    assert.equal(state.notes[0].manuscript.reference.sourceTextSha256,sha(envelope.deriveVisibleTextFromDocument(doc)));
    assert.equal(state.notes[0].manuscript.reference.offsetUtf16,old.notes[0].manuscript.reference.offsetUtf16+' CLEAN_EDIT'.length);}
  assert.equal(result.editorSync.ok,true,JSON.stringify(result));assert.ok(ui.sends.some(x=>x.channel==='editor:set-text'));
  const after=f.capture(),replay=await f.probe.fullApply({requestId:'clean-full-apply'});
  assert.notEqual(replay.applied,true);assert.ok(replay.ok===false || replay.status==='blocked');assert.deepEqual(f.capture(),after);
});

for (const languageOnly of [false,true]) test(`actual whole Main clean Word language return preserves the run boundary through Apply and re-export; language-only ${languageOnly}`,async t=>{
  const originalPart=languageOnly?'Unannotated':'Unannotated target',changedPart=languageOnly?' target':' CLEAN_EDIT';
  const {f,activated}=await cleanTextReturnFixture(t,{mutateReturn:parts=>{
    parts['word/document.xml']=parts['word/document.xml']
      .replace(/(<w:p\b[^>]*>)/u,'$1<w:pPr><w:rPr><w:lang w:val="en-US"/></w:rPr></w:pPr>')
      .replace('Unannotated target CLEAN_EDIT',originalPart+'</w:t></w:r><w:r><w:rPr><w:lang w:val="en-US"/></w:rPr><w:t xml:space="preserve">'+changedPart);
  }});
  assert.equal(activated.ok,true,JSON.stringify(activated));assert.equal(activated.activated,true,JSON.stringify(activated));
  const before=f.capture(),sibling=read(f.beta);await f.probe.refreshReview();
  const result=await f.probe.fullApply({requestId:'clean-language-apply'});
  assert.equal(result.applied,true,JSON.stringify(result));assert.equal(read(f.beta),sibling);
  const reopened=envelope.parseObservablePayload(read(f.alpha));assert.equal(reopened.issue,null);
  const paragraph=reopened.doc.content[0];
  assert.deepEqual(paragraph.attrs.wordParagraphMarkLanguage,{val:'en-US'});
  assert.equal(paragraph.content[0].text,originalPart);assert.equal(paragraph.content[0].marks,undefined);
  assert.equal(paragraph.content[1].text,changedPart);assert.deepEqual(paragraph.content[1].marks,[{type:'textStyle',attrs:{wordLanguage:{val:'en-US'}}}]);
  assert.equal(bookmarks.readRegistry(reopened.doc).bookmarks.length,7);
  const notesAfter=JSON.parse(read(path.join(f.root,'notes.craftsman.json'))),notesBefore=JSON.parse(Buffer.from(before.files['notes.craftsman.json'],'base64').toString());
  assert.equal(notesAfter.notes[0].manuscript.reference.offsetUtf16,notesBefore.notes[0].manuscript.reference.offsetUtf16+(languageOnly?0:' CLEAN_EDIT'.length));
  const source=await f.probe.fullSource(),built=await f.probe.reviewBuild(source);
  assert.equal(built.publicationGate.publishAllowed,true,JSON.stringify(built.publicationGate));
  const bridge=await import('../../src/io/revisionBridge/index.mjs'),xml=bridge.extractDocxReviewTransportPackagePartsFromZipBytes({bytes:built.documentBuffer}).parts['word/document.xml'];
  assert.match(xml,/<w:pPr><w:rPr><w:lang w:val="en-US"\/><\/w:rPr><\/w:pPr>/u);
  assert.ok(xml.includes('<w:lang w:val="en-US"/></w:rPr><w:t xml:space="preserve">'+changedPart+'</w:t></w:r>'));
});

for(const variant of ['comment-body','note-body','tracked-composite'])test(`actual whole Main clean return refuses ${variant} without canonical writes`,async t=>{
  const {f,activated,beforeActivation}=await cleanTextReturnFixture(t,{mutateReturn:parts=>{
    if(variant==='comment-body'){
      assert.ok(parts['word/comments.xml'].includes('Mixed comment'));
      parts['word/comments.xml']=parts['word/comments.xml'].replace('Mixed comment','Changed comment');
    }else if(variant==='note-body'){
      assert.ok(parts['word/footnotes.xml'].includes('Mixed footnote'));
      parts['word/footnotes.xml']=parts['word/footnotes.xml'].replace('Mixed footnote','Changed footnote');
    }else{
      const run=/<w:r(?:\s[^>]*)?>(?:(?!<\/w:r>)[\s\S])*?Unannotated target CLEAN_EDIT(?:(?!<\/w:r>)[\s\S])*?<\/w:r>/u;
      assert.ok(run.test(parts['word/document.xml']));
      parts['word/document.xml']=parts['word/document.xml'].replace(run,match=>'<w:ins w:id="901" w:author="Review" w:date="2026-10-02T00:00:00Z">'+match+'</w:ins>');
    }
  }});
  assert.equal(activated.ok,false,JSON.stringify(activated));
  assert.deepEqual(f.capture(),beforeActivation);
  const apply=await f.probe.fullApply({requestId:'refused-full-apply'});
  assert.equal(apply.ok,false,JSON.stringify(apply));assert.deepEqual(f.capture(),beforeActivation);
});

for(const variant of ['dirty','sibling','note-state','session'])test(`actual whole Main clean return revalidates ${variant} before Apply`,async t=>{
  const {f,activated}=await cleanTextReturnFixture(t);
  assert.equal(activated.ok,true,JSON.stringify(activated));
  if(variant==='dirty')f.probe.state({dirty:true,generation:1});
  if(variant==='sibling')fs.writeFileSync(f.beta,'New unrelated owner edit');
  if(variant==='note-state'){
    const target=path.join(f.root,'notes.craftsman.json'),document=JSON.parse(read(target));
    document.notes[0].title='Owner note change';fs.writeFileSync(target,JSON.stringify(document));
  }
  if(variant==='session')f.probe.changeSession();
  const before=f.capture(),result=await f.probe.fullApply({requestId:'stale-full-apply'});
  assert.notEqual(result.applied,true,JSON.stringify({status:result.status,reason:result.reason,error:result.error}));
  assert.ok(result.ok===false || result.status==='blocked');assert.deepEqual(f.capture(),before);
});

test('actual clean-return renderer click uses admitted Free batch and actual Main writes once',async t=>{
  const {f,activated}=await cleanTextReturnFixture(t);assert.equal(activated.ok,true);
  const changeId=f.probe.reviewState().revisionSession.reviewGraph.textChanges[0].changeId;
  const source=read(path.join(ROOT,'src/renderer/editor.js'));
  const fn=name=>{const a=source.indexOf('function '+name+'('),b=source.indexOf('\n}\n',a)+3;
    assert(a>=0&&b>a);return source.slice(source.slice(a-6,a)==='async '?a-6:a,b);};
  class Element{} class HTMLElement extends Element{} class HTMLButtonElement extends HTMLElement{}
  const button=new HTMLButtonElement();button.dataset={changeId};button.disabled=false;
  button.closest=selector=>selector==='[data-review-apply-exact-change]'?button:null;
  const host=new HTMLElement();host.contains=value=>value===button;const calls=[];
  const ui={Element,HTMLElement,HTMLButtonElement,reviewSurfaceHost:host,
    REVIEW_SURFACE_EXACT_TEXT_APPLY_COMMAND_ID:'cmd.project.review.applyExactTextChange',
    REVIEW_SURFACE_EXACT_TEXT_APPLY_BATCH_COMMAND_ID:'cmd.project.review.applyExactTextChangesBatch',
    reviewSurfaceText:x=>typeof x==='string'?x:'',reviewSurfaceArray:x=>Array.isArray(x)?x:[],
    reviewSurfaceCreateExactTextApplyRequestId:()=> 'explicit-clean-click',setReviewSurfaceExactTextApplyTransientState:()=>{},
    invokePreloadUiCommandBridge:async(id,payload)=>{
      assert.equal(require('../../src/core/entitlement-law-v1.cjs').decideCommandEntitlement(id,'free').available,true);
      const local=require('../../src/core/writer-local-profile-v1.cjs');
      assert.equal(local.evaluateWriterLocalCommandAccess({profile:local.createWriterLocalProfileProjection({isPackaged:true,platform:'darwin'}),commandId:id}).allowed,true);
      calls.push({id,payload});assert.equal(id,'cmd.project.review.applyExactTextChangesBatch');
      const result=await f.probe.reviewBatchApply(JSON.parse(JSON.stringify(payload)));
      assert.equal(result.applied,true,JSON.stringify({status:result.status,reason:result.reason,error:result.error}));
      return {ok:true,value:result};
    },reviewSurfaceUnwrapCommandResult:x=>x.value,reviewSurfaceIsPlainObject:x=>!!x&&typeof x==='object',
    setReviewSurfaceState:()=>{}};
  const vm=require('node:vm');vm.createContext(ui);
  for(const name of ['reviewSurfaceBuildExactTextApplyPayload','reviewSurfaceBuildExactTextApplyBatchPayload','handleReviewSurfaceExactTextApplyClick'])vm.runInContext(fn(name),ui);
  await ui.handleReviewSurfaceExactTextApplyClick({target:button});assert.equal(calls.length,1);
  assert.equal(envelope.parseObservablePayload(read(f.alpha)).doc.content[0].content[0].text,'Unannotated target CLEAN_EDIT');
  const refreshed=await f.probe.refreshReview();
  assert.equal(refreshed.status,'applied');
  assert.equal(refreshed.reviewSurface.exactTextPlanPreview.status,'ready');
  assert.deepEqual(refreshed.reviewSurface.exactTextAppliedChangeIds,[changeId]);
  assert.equal(refreshed.reviewSurface.exactTextBatchApplyResult.totals.applied,1);
  vm.runInContext(fn('reviewSurfaceBuildTerminalSummary'),ui);
  const terminal=ui.reviewSurfaceBuildTerminalSummary(refreshed.reviewSurface);
  assert.equal(terminal.status,'applied');assert.match(terminal.detail,/1 applied/);
  const after=f.capture();button.disabled=true;await ui.handleReviewSurfaceExactTextApplyClick({target:button});
  assert.equal(calls.length,1);assert.deepEqual(f.capture(),after);
  const replay=await f.probe.reviewBatchApply({requestId:'new-repeat-request',changeIds:[changeId]});
  assert.notEqual(replay.applied,true);assert.deepEqual(f.capture(),after);
});

for(const bookmarked of [false,true])for(const localCase of ['disjoint','same-paragraph'])test(`actual concurrent Main merges ${localCase} saved local edit with Word return; graph ${bookmarked}`,async t=>{
  const {f,activated,beforeActivation}=await cleanTextReturnFixture(t,{bookmarked,localCase});
  assert.equal(activated.ok,true,JSON.stringify(activated));
  assert.equal(activated.nonOverlapTrackedReplacementProductPath.prepared,true,JSON.stringify(activated));
  assert.deepEqual(f.capture(),beforeActivation);
  const sibling=read(f.beta);
  const applied=await f.probe.fullApply({requestId:'concurrent-apply'});
  assert.equal(applied.ok,true,JSON.stringify(applied));assert.equal(applied.applied,true,JSON.stringify(applied));
  const doc=envelope.parseObservablePayload(read(f.alpha)).doc;
  const target=bookmarked?'Unannotated target':'Alpha';
  assert.equal(doc.content[0].content[0].text,(localCase==='same-paragraph'?'LOCAL ':'')+target+' CLEAN_EDIT');
  assert.equal(doc.content.at(-1).content[0].text,'STARTBOUND_'+target+'_ENDBOUND'+(localCase==='disjoint'?' LOCAL_EDIT':''));
  if(bookmarked){
    const source=envelope.parseObservablePayload(Buffer.from(beforeActivation.files['roman/Imported/01_Alpha.txt'],'base64').toString());
    assert.deepEqual(bookmarks.readRegistry(doc),bookmarks.readRegistry(source.doc));
    assert.deepEqual(doc.content.slice(1,-1),source.doc.content.slice(1,-1));
    const notePath='notes.craftsman.json',oldNotes=JSON.parse(Buffer.from(beforeActivation.files[notePath],'base64').toString());
    const currentNotes=JSON.parse(read(path.join(f.root,notePath))),reference=currentNotes.notes[0].manuscript.reference;
    assert.equal(reference.sourceTextSha256,sha(envelope.deriveVisibleTextFromDocument(doc)));
    assert.equal(reference.offsetUtf16,oldNotes.notes[0].manuscript.reference.offsetUtf16+' CLEAN_EDIT'.length);
    const expected=structuredClone(oldNotes);expected.notes[0].manuscript.reference=reference;
    assert.deepEqual(currentNotes,expected);
    const comments='.yalken/word-review/non-text-return-state.v1.json';
    assert.equal(read(path.join(f.root,comments)),Buffer.from(beforeActivation.files[comments],'base64').toString());
  }
  assert.equal(read(f.beta),sibling);
  const after=f.capture(),replay=await f.probe.fullApply({requestId:'concurrent-replay'});
  assert.notEqual(replay.applied,true);assert.deepEqual(f.capture(),after);
});
test('actual concurrent Main overlapping edit is explicit conflict without canonical writes',async t=>{
  const {f,activated,beforeActivation}=await cleanTextReturnFixture(t,{bookmarked:false,localCase:'overlap'});
  assert.equal(activated.ok,false,JSON.stringify(activated));
  assert.match(JSON.stringify(activated),/RTK_WORD_CONCURRENT_CONFLICT/);
  assert.deepEqual(f.capture(),beforeActivation);
});

test('actual concurrent Main preserves mixed language runs and separately styled local insertion through Apply',async t=>{
  const {f,activated,beforeActivation}=await cleanTextReturnFixture(t,{bookmarked:false,localCase:'mixed-runs',mixedLanguage:true});
  assert.equal(activated.ok,true,JSON.stringify(activated));
  assert.equal(activated.nonOverlapTrackedReplacementProductPath.prepared,true,JSON.stringify(activated));
  assert.deepEqual(f.capture(),beforeActivation);
  const before=envelope.parseObservablePayload(read(f.alpha)).doc;
  const result=await f.probe.fullApply({requestId:'concurrent-mixed-language'});
  assert.equal(result.applied,true,JSON.stringify(result));
  const expected=structuredClone(before);expected.content[0].content[2].text+=' CLEAN_EDIT';
  assert.deepEqual(envelope.parseObservablePayload(read(f.alpha)).doc,expected);
});

for(const variant of ['scene','sibling','dirty','session','notes'])test(`actual concurrent Main preview rejects later ${variant} changes without overwriting them`,async t=>{
  const {f,activated}=await cleanTextReturnFixture(t,{bookmarked:false,localCase:'disjoint'});
  assert.equal(activated.ok,true,JSON.stringify(activated));
  if(variant==='scene')fs.appendFileSync(f.alpha,' LATER');
  if(variant==='sibling')fs.writeFileSync(f.beta,'LATER SIBLING');
  if(variant==='dirty')f.probe.state({dirty:true,generation:1});
  if(variant==='session')f.probe.changeSession();
  if(variant==='notes')fs.writeFileSync(path.join(f.root,'notes.craftsman.json'),'LATER NOTES');
  const before=f.capture(),applied=await f.probe.fullApply({requestId:'stale-concurrent'});
  assert.notEqual(applied.applied,true);assert.deepEqual(f.capture(),before);
});

for(const type of ['I','i','A','a'])test(`actual whole Main numbered-list ${type} clean return preserves format through Apply and re-export`,async t=>{
 const {f,activated}=await cleanTextReturnFixture(t,{bookmarked:false,listType:type});
 assert.equal(activated.ok,true,JSON.stringify(activated));assert.equal(activated.activated,true,JSON.stringify(activated));
 const sibling=read(f.beta);await f.probe.refreshReview();assert.equal(f.probe.reviewState().reviewSurface.exactTextPlanPreview.status,'ready');
 const result=await f.probe.fullApply({requestId:'list-format-apply'});assert.equal(result.applied,true,JSON.stringify(result));
 const parsed=envelope.parseObservablePayload(read(f.alpha));assert.equal(parsed.issue,null);assert.equal(parsed.doc.content[0].attrs.type,type);assert.equal(parsed.doc.content[0].attrs.start,3);
 assert.equal(parsed.doc.content[0].content[0].content[0].content[0].text,'Alpha CLEAN_EDIT');assert.equal(read(f.beta),sibling);
 const source=await f.probe.fullSource(),built=await f.probe.reviewBuild(source);assert.equal(built.publicationGate.publishAllowed,true,JSON.stringify(built.publicationGate));
 const bridge=await import('../../src/io/revisionBridge/index.mjs');const zip=bridge.extractDocxReviewTransportPackagePartsFromZipBytes({bytes:built.documentBuffer}).parts;
 assert.ok(zip['word/numbering.xml'].includes(`w:numFmt w:val="${{I:'upperRoman',i:'lowerRoman',A:'upperLetter',a:'lowerLetter'}[type]}"`));
});
for(const variant of ['format','start','level','removed'])test(`actual whole Main numbered-list rejects changed ${variant} without writes`,async t=>{
 const mutateReturn=zip=>{
  if(variant==='format')zip['word/numbering.xml']=zip['word/numbering.xml'].replaceAll('w:val="upperRoman"','w:val="decimal"');
  if(variant==='start')zip['word/numbering.xml']=zip['word/numbering.xml'].replaceAll('<w:start w:val="3"/>','<w:start w:val="4"/>');
  if(variant==='level')zip['word/document.xml']=zip['word/document.xml'].replace('<w:ilvl w:val="0"/>','<w:ilvl w:val="1"/>');
  if(variant==='removed')zip['word/document.xml']=zip['word/document.xml'].replace(/<w:numPr>[\s\S]*?<\/w:numPr>/u,'');
 };
 const {f,activated,beforeActivation}=await cleanTextReturnFixture(t,{bookmarked:false,listType:'I',mutateReturn});
 assert.equal(activated.ok,false,JSON.stringify(activated));assert.deepEqual(f.capture(),beforeActivation);
});
test('actual whole Main numbered-list allows bijective Word numId renumbering',async t=>{
 const {f,activated}=await cleanTextReturnFixture(t,{bookmarked:false,listType:'I',mutateReturn:zip=>{
  zip['word/document.xml']=zip['word/document.xml'].replace(/<w:numId w:val="(\d+)"\/>/gu,(_,n)=>`<w:numId w:val="${Number(n)+100}"/>`);
  zip['word/numbering.xml']=zip['word/numbering.xml'].replace(/<w:num w:numId="(\d+)"/gu,(_,n)=>`<w:num w:numId="${Number(n)+100}"`);
 }});
 assert.equal(activated.ok,true,JSON.stringify(activated));await f.probe.refreshReview();assert.equal((await f.probe.fullApply({requestId:'renumbered-list'})).applied,true);
 const doc=envelope.parseObservablePayload(read(f.alpha)).doc;assert.equal(doc.content[0].attrs.type,'I');assert.equal(doc.content[0].attrs.start,3);
});

test('numbered-list worker module binds numbering projection into packet integrity',async t=>{
 const {bytes}=await cleanTextReturnFixture(t,{bookmarked:false,listType:'I'});
 const worker=require('../../src/main/rtkDocxReturnIntakeWorker.cjs');
 const artifactSha256=`sha256:${sha(bytes)}`;
 const result=await worker.run({bytes,requestId:'list-worker-evidence',returnedArtifactSha256:artifactSha256});
 assert.equal(result.ok,true,JSON.stringify(result));
 const proof=result.packet.returnedProjection.listNumbering;
 assert.equal(proof.schemaVersion,'yalken.word-list-numbering-proof.v1');
 assert.deepEqual(proof,result.parserResult.reviewIr.listNumbering);
 assert.equal(result.packet.projectionDigest,result.parserResult.supportedSemanticDigest);
 const {verifyReturnEvidencePacketV1}=await import('../../src/io/revisionBridge/reviewTransportReturnEvidenceV1.mjs');
 assert.equal(verifyReturnEvidencePacketV1(result.packet,{expectedArtifactSha256:artifactSha256}).ok,true);
 const altered=structuredClone(result.packet);
 const paragraph=altered.returnedProjection.listNumbering.paragraphs.find(p=>p.list);
 assert.equal(paragraph.list.type,'I');paragraph.list.type='a';
 assert.equal(verifyReturnEvidencePacketV1(altered,{expectedArtifactSha256:artifactSha256}).ok,false);
});

for(const nativeSuffix of [false,true])test(`actual whole Main native styled list clean return preserves split textStyle runs suffix ${nativeSuffix}`,async t=>{
  const {f,activated}=await cleanTextReturnFixture(t,{bookmarked:false,listType:'a',nativeStyle:true,nativeSuffix});
  assert.equal(activated.ok,true,JSON.stringify(activated));
  await f.probe.refreshReview();
  const before=envelope.parseObservablePayload(read(f.alpha)).doc;
  const result=await f.probe.fullApply({requestId:'native-styled-list'});
  assert.equal(result.applied,true,JSON.stringify(result));
  const doc=envelope.parseObservablePayload(read(f.alpha)).doc;
  const expected=structuredClone(before);
  expected.content[0].content[0].content[0].content[1].text=nativeSuffix?' SourceEdit02 CLEAN_EDIT':' CLEAN_EDIT SourceEdit02';
  assert.deepEqual(doc,expected);
  const after=f.capture();assert.notEqual((await f.probe.fullApply({requestId:'native-styled-list-replay'})).applied,true);assert.deepEqual(f.capture(),after);
});


test('actual whole Main continued list survives authenticated text Apply and re-export',async t=>{
 const {f,activated}=await cleanTextReturnFixture(t,{bookmarked:false,listType:'I',continuedList:true});
 assert.equal(activated.ok,true,JSON.stringify(activated));await f.probe.refreshReview();
 assert.equal(f.probe.reviewState().reviewSurface.exactTextPlanPreview.status,'ready');
 const result=await f.probe.fullApply({requestId:'continued-list-apply'});assert.equal(result.applied,true,JSON.stringify(result));
 const parsed=envelope.parseObservablePayload(read(f.alpha));assert.equal(parsed.issue,null);
 assert.equal(parsed.doc.content[0].attrs.wordListId,parsed.doc.content[2].attrs.wordListId);
 assert.equal(parsed.doc.content[2].attrs.start,4);
 const source=await f.probe.fullSource(),built=await f.probe.reviewBuild(source);
 assert.equal(built.publicationGate.publishAllowed,true,JSON.stringify(built.publicationGate));
});


for(const variant of ['plain','outside-bookmark','continued-list','opened-import-defaults','heading7','heading8','heading9','numbered-heading9','page-break','column-break','page-break-language','section-continuous','section-nextColumn','section-numbered']) test(`actual Main single-scene ordinary Word return reaches preview and guarded Apply: ${variant}`,async t=>{
  const {f,activated}=await cleanTextReturnFixture(t,{sceneScope:true,bookmarked:false,schemaDefaults:variant==='opened-import-defaults',
    ...(variant.includes('-break')?{typedBreak:variant.split('-')[0]}:{}),
    ...(variant.startsWith('section-')?{sectionType:variant==='section-numbered'?'continuous':variant.slice(8),...(variant==='section-numbered'?{listType:'I'}:{})}:{}),
    ...(variant.startsWith('heading')?{headingLevel:Number(variant.slice(7))}:{}),
    ...(variant==='continued-list'?{listType:'I',continuedList:true}:{}),
    ...(variant==='numbered-heading9'?{headingLevel:9,listType:'I',continuedList:true}:{}),
    ...(variant==='page-break-language'?{mutateReturn:parts=>{parts['word/document.xml']=parts['word/document.xml'].replaceAll('<w:r>','<w:r><w:rPr><w:lang w:val="en-US"/></w:rPr>');}}:{}),
    ...(variant==='outside-bookmark'?{mutateReturn:parts=>{
      const xml=parts['word/document.xml'];
      parts['word/document.xml']=xml.replace(/Alpha CLEAN_EDIT(<\/w:t><\/w:r><w:bookmarkEnd[^>]*\/>)/u,
        'Alpha$1<w:r><w:t xml:space="preserve"> CLEAN_EDIT</w:t></w:r>');
      assert.notEqual(parts['word/document.xml'],xml,'append must be outside transport bookmark');
    }}:{})});
  assert.equal(activated.ok,true,JSON.stringify(activated));
  assert.equal(activated.nonOverlapTrackedReplacementProductPath.prepared,true,JSON.stringify(activated));
  const before=f.capture(),sibling=read(f.beta);
  await f.probe.refreshReview();
  assert.equal(f.probe.reviewState().reviewSurface.exactTextPlanPreview.status,'ready');
  assert.deepEqual(f.capture(),before);
  const result=await f.probe.fullApply({requestId:'scene-clean-apply'});
  assert.equal(result.applied,true,JSON.stringify(result));
  assert.equal(read(f.beta),sibling);
  assert.match(envelope.parseObservablePayload(read(f.alpha)).text,/Alpha CLEAN_EDIT/u);
  if(variant.startsWith('heading'))assert.equal(envelope.parseObservablePayload(read(f.alpha)).doc.content[0].attrs.level,Number(variant.slice(7)));
  if(variant.includes('-break'))assert.equal(envelope.parseObservablePayload(read(f.alpha)).doc.content[0].content.find(n=>n.type==='hardBreak').attrs.wordBreakType,variant.split('-')[0]);
  if(variant==='numbered-heading9'){const doc=envelope.parseObservablePayload(read(f.alpha)).doc;assert.equal(doc.content[0].content[0].content[0].attrs.level,9);assert.equal(doc.content[0].attrs.type,'I');assert.equal(doc.content[2].attrs.start,4);}
  if(variant==='continued-list'){const doc=envelope.parseObservablePayload(read(f.alpha)).doc;assert.equal(doc.content[2].attrs.start,4);assert.equal(doc.content[2].attrs.wordListId,'chain');}
  const source=await f.probe.sceneSource(),built=await f.probe.reviewBuild(source);assert.equal(built.publicationGate.publishAllowed,true,JSON.stringify(built.publicationGate));
  const after=f.capture();
  assert.notEqual((await f.probe.fullApply({requestId:'scene-clean-replay'})).applied,true);
  assert.deepEqual(f.capture(),after);
});

for(const variant of ['unknown-attribute','false-attribute'])test(`single-scene clean return preserves non-default root state guard: ${variant}`,async t=>{
  const {f,activated}=await cleanTextReturnFixture(t,{sceneScope:true,bookmarked:false,schemaDefaults:variant});
  assert.equal(activated.ok,true,JSON.stringify(activated));
  const before=f.capture(),result=await f.probe.fullApply({requestId:'scene-root-state-apply'});
  assert.equal(result.reason,'RTK_CLEAN_BLOCK_TEXT_SOURCE_STALE',JSON.stringify(result));
  assert.deepEqual(f.capture(),before);
});

for(const variant of ['dirty','scene','session','annotation-state']) test(`single-scene clean return revalidates ${variant} before Apply`,async t=>{
  const {f,activated}=await cleanTextReturnFixture(t,{sceneScope:true,bookmarked:false});
  assert.equal(activated.ok,true,JSON.stringify(activated));
  if(variant==='dirty')f.probe.state({dirty:true,generation:1});
  if(variant==='scene')fs.writeFileSync(f.alpha,'Owner changed this scene');
  if(variant==='session')f.probe.changeSession();
  if(variant==='annotation-state')fs.writeFileSync(path.join(f.root,'notes.craftsman.json'),'{}');
  const before=f.capture(),result=await f.probe.fullApply({requestId:'scene-stale-apply'});
  assert.notEqual(result.applied,true,JSON.stringify(result));
  assert.deepEqual(f.capture(),before);
});
for(const variant of ['topology','format','tracked','stale-baseline']) test(`single-scene clean return rejects ${variant} without writing`,async t=>{
  const {f,activated,beforeActivation}=await cleanTextReturnFixture(t,{sceneScope:true,bookmarked:false,
    ...(variant==='stale-baseline'?{localCase:'overlap'}:{}),
    mutateReturn:parts=>{
      if(variant==='topology')parts['word/document.xml']=parts['word/document.xml'].replace('</w:body>','<w:p><w:r><w:t>Injected paragraph</w:t></w:r></w:p></w:body>');
      if(variant==='format')parts['word/document.xml']=parts['word/document.xml'].replace('<w:t xml:space="preserve">Alpha CLEAN_EDIT','<w:rPr><w:b/></w:rPr><w:t xml:space="preserve">Alpha CLEAN_EDIT');
      if(variant==='tracked')parts['word/document.xml']=parts['word/document.xml'].replace('Alpha CLEAN_EDIT','Alpha CLEAN_EDIT</w:t></w:r><w:ins w:id="901" w:author="Review" w:date="2026-10-03T00:00:00Z"><w:r><w:t>Tracked</w:t></w:r></w:ins><w:r><w:t>');
    }});
  assert.ok(activated.ok===false || activated.nonOverlapTrackedReplacementProductPath?.prepared!==true,JSON.stringify(activated));
  assert.deepEqual(f.capture(),beforeActivation);
  assert.notEqual((await f.probe.fullApply({requestId:'scene-rejected'})).applied,true);
  assert.deepEqual(f.capture(),beforeActivation);
});

for(const variant of ['type','delete','move','unknown'])test(`typed break return ${variant} rejects without writes`,async t=>{
 const {f,activated,beforeActivation}=await cleanTextReturnFixture(t,{sceneScope:true,bookmarked:false,typedBreak:'page',mutateReturn:parts=>{
  const before=parts['word/document.xml'];
  parts['word/document.xml']=variant==='type'?before.replace('w:type="page"','w:type="column"'):
   variant==='delete'?before.replace('<w:br w:type="page"/>',''):
   variant==='unknown'?before.replace('w:type="page"','w:type="invalid"'):
   before.replace('<w:br w:type="page"/>','').replace('After break','After<w:br w:type="page"/> break');
  assert.notEqual(parts['word/document.xml'],before);
 }});
 assert.ok(activated.ok===false||activated.nonOverlapTrackedReplacementProductPath?.prepared!==true,JSON.stringify(activated));
 assert.deepEqual(f.capture(),beforeActivation);
 assert.notEqual((await f.probe.fullApply({requestId:'typed-break-rejected'})).applied,true);
 assert.deepEqual(f.capture(),beforeActivation);
});

for(const variant of ['type','final','delete'])test(`section return ${variant} rejects without writes`,async t=>{
 const {f,activated,beforeActivation}=await cleanTextReturnFixture(t,{sceneScope:true,bookmarked:false,sectionType:'continuous',mutateReturn:parts=>{
  const before=parts['word/document.xml'];parts['word/document.xml']=variant==='type'?before.replace('w:val="continuous"','w:val="nextPage"'):variant==='final'?before.replace('w:val="oddPage"','w:val="evenPage"'):before.replace(/<w:sectPr>[\s\S]*?<\/w:sectPr>/u,'');
  assert.notEqual(parts['word/document.xml'],before);
 }});
 assert.ok(activated.ok===false||activated.nonOverlapTrackedReplacementProductPath?.prepared!==true,JSON.stringify(activated));
 assert.deepEqual(f.capture(),beforeActivation);assert.notEqual((await f.probe.fullApply({requestId:'section-rejected'})).applied,true);assert.deepEqual(f.capture(),beforeActivation);
});
test('actual Main section Save proves separated splits, undo and redo; forged boundary movement refuses',async t=>{
 const f=await fixture(t),model=require('../../src/core/word-sections-v1.cjs');
 const p=text=>({type:'paragraph',content:[{type:'text',text}]});
 const initial=model.bind({type:'doc',content:[p('AAA'),p('BBB'),p('CCC'),p('DDD')]},{schemaVersion:1,boundaries:[{endParagraphIndex:1,properties:{type:'continuous'}}],final:{type:'oddPage'}});
 const raw=doc=>envelope.composeObservablePayload({doc});fs.writeFileSync(f.alpha,raw(initial));
 let working=raw(initial),generation=0;mountRenderer(f,()=>working,()=>generation,null,()=>({projectId:f.query.projectId,documentId:f.a.nodeId}));
 const save=async doc=>{working=raw(doc);generation++;f.probe.state({filePath:f.alpha,projectName:'Роман',dirty:true,generation});return f.probe.save();};
 const divided=structuredClone(initial);divided.content=[p('A'),p('AA'),p('BBB'),p('C'),p('CC'),p('DDD')];
 const split=model.bind(divided,model.project(initial,divided));assert.equal(await save(split),true);assert.deepEqual(model.read(envelope.parseObservablePayload(read(f.alpha)).doc),model.read(split));
 assert.equal(await save(initial),true,'undo after Save');assert.equal(await save(split),true,'redo after Save');
 const typed=structuredClone(split);typed.content[3].content[0].text+=' typed';assert.equal(await save(initial),true);assert.equal(await save(typed),true,'two splits plus typing before Save');
 assert.equal(await save(initial),true,'undo mixed split and text');assert.equal(await save(split),true);
 const forged=structuredClone(split);forged.attrs.wordSections.boundaries[0].endParagraphIndex=3;const before=read(f.alpha);assert.notEqual(await save(forged),true);assert.equal(read(f.alpha),before);
});
for(const kind of ['orderedList','blockquote'])test(`actual Main section Save retains ${kind} carrier through text edit`,async t=>{
 const f=await fixture(t),model=require('../../src/core/word-sections-v1.cjs'),p=text=>({type:'paragraph',content:[{type:'text',text}]});
 const paragraphs=[p('First'),p('Second')],doc=model.bind({type:'doc',content:kind==='blockquote'?paragraphs.map(node=>({type:kind,content:[node]})):[{type:kind,attrs:{start:1},content:paragraphs.map(node=>({type:'listItem',content:[node]}))}]},{schemaVersion:1,boundaries:[{endParagraphIndex:0,properties:{type:'continuous'}}],final:{type:'oddPage'}});
 fs.writeFileSync(f.alpha,envelope.composeObservablePayload({doc}));const edited=structuredClone(doc),leaf=kind==='blockquote'?edited.content[0].content[0]:edited.content[0].content[0].content[0];leaf.content[0].text+=' typed';const working=envelope.composeObservablePayload({doc:edited});
 mountRenderer(f,()=>working,1,null,()=>({projectId:f.query.projectId,documentId:f.a.nodeId}));f.probe.state({filePath:f.alpha,projectName:'Роман',dirty:true,generation:1});
 assert.equal(await f.probe.save(),true);const persisted=envelope.parseObservablePayload(read(f.alpha)).doc;assert.deepEqual(model.read(persisted),model.read(doc));assert.match(envelope.deriveVisibleTextFromDocument(persisted),/First typed/);
});

for(const styleCase of ['paragraph-inherit','paragraph-repeat-true','character-chain','paragraph-character-toggle','word-defaults','native-normalized-defaults'])test(`actual Main style cascade return ${styleCase} previews without writes and applies effective formatting through native menu handler`,async t=>{
 const {f,activated,beforeActivation,getObserved}=await cleanTextReturnFixture(t,{sceneScope:true,bookmarked:false,nativeDefaults:styleCase==='native-normalized-defaults',mutateReturn:parts=>{
  parts['word/document.xml']=parts['word/document.xml'].replace('Alpha CLEAN_EDIT','Alpha');
  const xml=parts['word/document.xml'];
  const target=xml.match(/<w:p(?:\s[^>]*)?>[\s\S]*?<w:t[^>]*>Alpha<\/w:t>[\s\S]*?<\/w:p>/u);
  assert.ok(target,'target paragraph must exist');
  let paragraph=target[0];
  paragraph=paragraph.includes('<w:pPr>')?paragraph.replace('<w:pPr>','<w:pPr><w:pStyle w:val="OwnerDerived"/>'):paragraph.replace(/(<w:p(?:\s[^>]*)?>)/u,'$1<w:pPr><w:pStyle w:val="OwnerDerived"/></w:pPr>');
  if(styleCase.includes('character')) { paragraph=paragraph.includes('<w:rPr>') ? paragraph.replace('<w:rPr>','<w:rPr><w:rStyle w:val="OwnerCharDerived"/>') : paragraph.replace('<w:r>','<w:r><w:rPr><w:rStyle w:val="OwnerCharDerived"/></w:rPr>'); assert.match(paragraph,/<w:rStyle w:val="OwnerCharDerived"\/>/u); }
  parts['word/document.xml']=xml.replace(target[0],paragraph);
  let styles='<w:style w:type="paragraph" w:styleId="OwnerBase"><w:name w:val="Owner Base"/><w:pPr><w:jc w:val="right"/></w:pPr><w:rPr><w:b/><w:color w:val="224466"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="OwnerDerived"><w:name w:val="Owner Derived"/><w:basedOn w:val="OwnerBase"/></w:style>';
  if(styleCase==='paragraph-repeat-true')styles=styles.replace('<w:basedOn w:val="OwnerBase"/>','<w:basedOn w:val="OwnerBase"/><w:rPr><w:b/></w:rPr>');
  if(styleCase==='paragraph-character-toggle')styles=styles.replace('<w:b/>','<w:b/><w:i/>');
  if(styleCase.includes('character'))styles+='<w:style w:type="character" w:styleId="OwnerCharBase"><w:name w:val="Character Base"/><w:rPr><w:i/></w:rPr></w:style><w:style w:type="character" w:styleId="OwnerCharDerived"><w:name w:val="Character Derived"/><w:basedOn w:val="OwnerCharBase"/><w:rPr><w:i/></w:rPr></w:style>';
  assert.match(parts['word/styles.xml'],/<\/w:styles>/u);
  parts['word/styles.xml']=parts['word/styles.xml'].replace('</w:styles>',styles+'</w:styles>');
  if(styleCase==='native-normalized-defaults'){
   parts['word/document.xml']=parts['word/document.xml'].replace(/<w:jc\b[^>]*\/>/gu,'').replace(/<w:rFonts\b[^>]*\/>/gu,'');
   parts['word/styles.xml']=parts['word/styles.xml'].replace(/<w:jc\b[^>]*\/>/gu,'').replace(/<w:rFonts\b[^>]*\/>/gu,'');
   parts['word/styles.xml']=parts['word/styles.xml'].replace('<w:rPrDefault><w:rPr>','<w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman" w:cs="Times New Roman"/>');
   assert.doesNotMatch(parts['word/document.xml'],/<w:(?:jc|rFonts)\b/u);
  }
  if(styleCase==='word-defaults'){
   const language='<w:lang w:val="ru-FI" w:eastAsia="ru-RU" w:bidi="ar-SA"/>';
   assert.match(parts['word/styles.xml'],/<w:rPrDefault><w:rPr>/u);
   parts['word/styles.xml']=parts['word/styles.xml'].replace('<w:rPrDefault><w:rPr>','<w:rPrDefault><w:rPr>'+language);
   const spacing='<w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="278" w:lineRule="auto"/></w:pPr></w:pPrDefault>';
   parts['word/styles.xml']=parts['word/styles.xml'].replace(/<w:pPrDefault>[\s\S]*?<\/w:pPrDefault>/u,'').replace('</w:docDefaults>',spacing+'</w:docDefaults>');
  }

 }});
 assert.equal(activated.ok,true,JSON.stringify(activated));
 assert.equal(activated.formattingProductPath?.prepared,true,JSON.stringify(activated));
 assert.equal(activated.formattingProductPath.diagnosticCount,0,'all supported effective formatting must be actionable, not manual');
 assert.deepEqual(f.capture(),beforeActivation,'intake and preview must not write');
 const sibling=read(f.beta),before=envelope.parseObservablePayload(read(f.alpha));
 const settleSync=f.probe.observeDeferredEditorSync();
 const result=await f.probe.formatApply({requestId:'effective-style-apply'});
 const sync=await settleSync();assert.equal(sync.length,1);assert.equal(sync[0].ok,true,JSON.stringify(sync));assert.equal(getObserved(),read(f.alpha));
 assert.equal(result.ok,true,JSON.stringify(result));assert.equal(result.status,'applied-and-replayed',JSON.stringify(result));assert.equal(result.replayVerified,true);
 const after=envelope.parseObservablePayload(read(f.alpha));
 assert.equal(after.text,before.text);assert.equal(read(f.beta),sibling);
 assert.equal(after.doc.content[0].attrs.textAlign,styleCase==='native-normalized-defaults'?'left':'right');
 const alpha=after.doc.content[0].content.find(node=>node.type==='text'&&node.text==='Alpha');
 assert.ok(alpha);assert.ok(alpha.marks.some(mark=>mark.type==='bold'));
 assert.equal(alpha.marks.some(mark=>mark.type==='italic'),styleCase==='character-chain','native Word chain assignment followed by one character toggle');
 assert.equal(alpha.marks.find(mark=>mark.type==='textStyle')?.attrs.color?.toLowerCase(),'#224466');
 if(styleCase==='native-normalized-defaults')assert.equal(alpha.marks.find(mark=>mark.type==='textStyle')?.attrs.fontFamily,'Times New Roman');
 if(styleCase==='word-defaults'){
  const language={val:'ru-FI',eastAsia:'ru-RU',bidi:'ar-SA'};
  for(const paragraph of after.doc.content){assert.deepEqual(paragraph.attrs.wordParagraphSpacing,{after:160,line:278,lineRule:'auto'});assert.deepEqual(paragraph.attrs.wordParagraphMarkLanguage,language);for(const node of paragraph.content)if(node.type==='text')assert.deepEqual(node.marks.find(mark=>mark.type==='textStyle')?.attrs.wordLanguage,language);}
 }

 const persisted=f.capture();const replay=await f.probe.formatApply({requestId:'effective-style-replay'});await settleSync();
 assert.equal(replay.ok,true,JSON.stringify(replay));assert.equal(replay.status,'applied-and-replayed');assert.equal(replay.reviewSurface.formattingReturnResult.status,'replay');assert.equal(replay.reviewSurface.formattingReturnResult.writerCalled,false);assert.deepEqual(f.capture(),persisted);
 const exported=await f.probe.sceneSource(),built=await f.probe.reviewBuild(exported);
 assert.equal(built.publicationGate.publishAllowed,true,JSON.stringify(built.publicationGate));
});

test('actual Main empty paragraph style return applies zero-length paragraph actions and replays without writes',async t=>{
 const f=await fixture(t),doc={type:'doc',content:[{type:'paragraph'}]};
 let observed=envelope.composeObservablePayload({doc});fs.writeFileSync(f.alpha,observed);
 mountRenderer(f,()=>observed,0,null,()=>({projectId:f.query.projectId,documentId:f.a.nodeId}),payload=>{observed=payload.content;});
 f.probe.state({filePath:f.alpha,projectName:'Роман'});
 const source=await f.probe.sceneSource(),built=await f.probe.reviewBuild(source);
 assert.equal(built.publicationGate.publishAllowed,true,JSON.stringify(built.publicationGate));await f.probe.activate(source.pendingAuthorityStore);
 const bridge=await import('../../src/io/revisionBridge/index.mjs');
 const parts=bridge.extractDocxReviewTransportPackagePartsFromZipBytes({bytes:built.documentBuffer}).parts;
 const xml=parts['word/document.xml'];
 parts['word/document.xml']=xml.replace(/(<w:p(?:\s[^>]*)?>)/u,'$1<w:pPr><w:pStyle w:val="EmptyStyle"/></w:pPr>');
 assert.notEqual(parts['word/document.xml'],xml);
 parts['word/styles.xml']=parts['word/styles.xml'].replace('</w:styles>','<w:style w:type="paragraph" w:styleId="EmptyStyle"><w:pPr><w:jc w:val="right"/><w:spacing w:before="0" w:after="160" w:line="278" w:lineRule="auto"/></w:pPr><w:rPr><w:lang w:val="ru-FI" w:eastAsia="ru-RU" w:bidi="ar-SA"/></w:rPr></w:style></w:styles>');
 const bytes=require('../../src/export/docx/docxMinBuilder.js').buildStoredZip(Object.entries(parts).map(([name,data])=>({name,data})));
 const before=f.capture(),sibling=read(f.beta);
 const activated=await f.probe.reviewActivate({requestId:'empty-style-intake',bufferSource:bytes.toString('base64')},{allowInlineDocxReturnIntakeParserForTests:true});
 assert.equal(activated.ok,true,JSON.stringify(activated));assert.equal(activated.formattingProductPath?.prepared,true,JSON.stringify(activated));assert.deepEqual(f.capture(),before);
 const settle=f.probe.observeDeferredEditorSync();const applied=await f.probe.formatApply({requestId:'empty-style-apply'});await settle();
 assert.equal(applied.ok,true,JSON.stringify(applied));assert.equal(applied.replayVerified,true);
 const after=envelope.parseObservablePayload(read(f.alpha));assert.equal(after.text,'');assert.equal(after.doc.content.length,1);assert.equal(after.doc.content[0].attrs.textAlign,'right');
 assert.deepEqual(after.doc.content[0].attrs.wordParagraphSpacing,{before:0,after:160,line:278,lineRule:'auto'});
 assert.deepEqual(after.doc.content[0].attrs.wordParagraphMarkLanguage,{val:'ru-FI',eastAsia:'ru-RU',bidi:'ar-SA'});
 assert.equal(observed,read(f.alpha));assert.equal(read(f.beta),sibling);
 const persisted=f.capture(),replay=await f.probe.formatApply({requestId:'empty-style-replay'});await settle();assert.equal(replay.ok,true);assert.equal(replay.reviewSurface.formattingReturnResult.writerCalled,false);assert.deepEqual(f.capture(),persisted);
});


test('packaged Mac actual bridge admits only read-only formatting and structural replay inspectors',async t=>{
 const f=await fixture(t,false,'01_Alpha.txt',true),ui=mountRenderer(f,read(f.beta));
 f.probe.state({projectName:'Роман'});
 const protocol=require('../../src/core/ipc-envelope-v1.cjs');
 const before=f.capture();
 for(const kind of ['Formatting','Structural']){
  const id=`cmd.project.review.inspect${kind}ReturnReplay`;
  const request=protocol.createEnvelope('ui:command-bridge',id,{requestId:`packaged-${kind}-replay`});
  const result=await f.handles.get('ui:command-bridge')(ui.event,request);
  assert.equal(result.ok,true,JSON.stringify(result));
  assert.equal(result.value.code,`RTK_${kind.toUpperCase()}_REPLAY_STATE_INSPECTED`);
  assert.equal(result.value.writerCalled,false);
  assert.deepEqual(f.capture(),before,'replay inspection must not alter scenes or project metadata');
 }
 const denied=await f.handles.get('ui:command-bridge')(ui.event,protocol.createEnvelope('ui:command-bridge','cmd.project.review.clearSession',{requestId:'unrelated-review'}));
 assert.equal(denied.ok,false);assert.equal(denied.reason,'WRITER_LOCAL_PROFILE_OPTIONAL_SYSTEM_DISABLED');
 assert.equal(denied.value.storageWritten,false);assert.deepEqual(f.capture(),before);
});


test('packaged Mac actual bridge reloads reconciled Word writes and retains no-loss guards',async t=>{
 const f=await fixture(t,false,'01_Alpha.txt',true);
 fs.writeFileSync(f.alpha,'Alpha beta gamma.');
 const crashed=require('node:child_process').spawnSync(process.execPath,[path.join(ROOT,'test/fixtures/revision-bridge-exact-text-apply-crash-child.mjs'),f.root,'before_receipt','roman/Imported/01_Alpha.txt'],{cwd:ROOT,encoding:'utf8'});
 assert.equal(crashed.status,73,crashed.stderr);
 const ui=mountRenderer(f,read(f.alpha));f.probe.state({projectName:'Роман',filePath:f.alpha});
 const startup=await f.probe.reconcileStartup();assert.deepEqual(startup.userRelevant[0].safeActions,['RELOAD_CANONICAL']);
 const operationId='op_crash_before_receipt',journal=path.join(f.root,'backups/revision-bridge-apply-journal',operationId+'.json');
 const before=f.capture(),journalBefore=read(journal),protocol=require('../../src/core/ipc-envelope-v1.cjs');
 const dispatch=(extra={})=>f.handles.get('ui:command-bridge')(ui.event,protocol.createEnvelope('ui:command-bridge','cmd.project.review.reloadReconciledScene',{requestId:'packaged-reload',operationId,...extra}));
 const unchanged=()=>{assert.deepEqual(f.capture(),before);assert.equal(read(journal),journalBefore);assert.equal(ui.sends.filter(x=>x.channel==='editor:set-text').length,0);};
 f.probe.state({dirty:true});const dirty=await dispatch();assert.equal(dirty.ok,false);assert.match(JSON.stringify(dirty),/RECONCILIATION_DIRTY_EDITOR_BLOCKED/);unchanged();
 f.probe.state({dirty:false,filePath:f.beta});const wrong=await dispatch();assert.equal(wrong.ok,false);assert.match(JSON.stringify(wrong),/RECONCILIATION_CURRENT_SCENE_MISMATCH/);unchanged();
 f.probe.state({filePath:f.alpha});const forged=await dispatch({scenePath:f.beta});assert.equal(forged.ok,false);assert.match(JSON.stringify(forged),/RECONCILIATION_WRITE_AUTHORITY_DENIED/);unchanged();
 const missing=await dispatch({operationId:'op_missing'});assert.equal(missing.ok,false);assert.match(JSON.stringify(missing),/ENOENT/);unchanged();
 const result=await dispatch();assert.equal(result.ok,true,JSON.stringify(result));assert.equal(result.value.reloaded,true);
 assert.deepEqual(f.capture(),before,'canonical reload never rewrites manuscript or metadata');
 const acknowledged=JSON.parse(read(journal));assert.equal(acknowledged.status,'reconciled');assert.equal(acknowledged.reconciliation.acknowledgedAction,'RELOAD_CANONICAL');
 const publications=ui.sends.filter(x=>x.channel==='editor:set-text');assert.equal(publications.length,1);assert.equal(publications[0].payload.content,read(f.alpha));
});

test('actual Main fresh authenticated formatting rounds revisit the same transition and deny forged round authority',async t=>{
 const f=await fixture(t),doc={type:'doc',content:[{type:'paragraph',attrs:{textAlign:'left'},content:[{type:'text',text:'Alpha'}]}]};
 let observed=envelope.composeObservablePayload({doc});fs.writeFileSync(f.alpha,observed);
 mountRenderer(f,()=>observed,0,null,()=>({projectId:f.query.projectId,documentId:f.a.nodeId}),payload=>{observed=payload.content;});
 f.probe.state({filePath:f.alpha,projectName:'Роман'});
 const bridge=await import('../../src/io/revisionBridge/index.mjs'),settle=f.probe.observeDeferredEditorSync(),rounds=[],operationIds=[],baselines=[];
 const sibling=read(f.beta);
 for(const [index,alignment] of ['right','left','right'].entries()) {
  baselines.push(read(f.alpha));
  const source=await f.probe.sceneSource(),built=await f.probe.reviewBuild(source);
  assert.equal(built.publicationGate.publishAllowed,true);await f.probe.activate(source.pendingAuthorityStore);
  const parts=bridge.extractDocxReviewTransportPackagePartsFromZipBytes({bytes:built.documentBuffer}).parts;
  parts['word/document.xml']=parts['word/document.xml'].replace(/<w:jc\b[^>]*\/>/gu,`<w:jc w:val="${alignment}"/>`);
  const bytes=require('../../src/export/docx/docxMinBuilder.js').buildStoredZip(Object.entries(parts).map(([name,data])=>({name,data})));
  const before=f.capture(),activated=await f.probe.reviewActivate({requestId:`fresh-round-intake-${index}`,bufferSource:bytes.toString('base64')},{allowInlineDocxReturnIntakeParserForTests:true});
  assert.equal(activated.ok,true,JSON.stringify(activated));assert.equal(activated.formattingProductPath?.prepared,true,JSON.stringify(activated));assert.deepEqual(f.capture(),before);
  const input=f.probe.formattingInput();rounds.push(input.formattingRoundId);operationIds.push(input.operations.map(o=>o.operationId));
  assert.match(input.formattingRoundId,/^round-[a-f0-9]{32}$/u);
  for(const wrong of [undefined,`round-${'0'.repeat(32)}`]){
   f.probe.setFormattingRound(wrong);
   const rejected=await f.probe.formatApply({requestId:`forged-round-${index}`});await settle();
   assert.equal(rejected.ok,false,JSON.stringify(rejected));assert.deepEqual(f.capture(),before);
  }
  f.probe.setFormattingRound(input.formattingRoundId);
  const applied=await f.probe.formatApply({requestId:`fresh-round-apply-${index}`});await settle();
  assert.equal(applied.ok,true,JSON.stringify(applied));assert.equal(applied.replayVerified,true);
  assert.equal(envelope.parseObservablePayload(read(f.alpha)).doc.content[0].attrs.textAlign,alignment);
  assert.equal(read(f.beta),sibling);assert.equal(observed,read(f.alpha));
 }
 assert.equal(new Set(rounds).size,3,'exports mint distinct authenticated rounds');
 assert.equal(baselines[0],baselines[2],'the same exact before bytes are revisited');
 assert.deepEqual(operationIds[0],operationIds[2],'semantic operation identity repeats; round authority separates applications');
});
for(const scope of ['scene','full'])test(`actual Main authenticated paragraph layout ${scope} root and paragraph delta preserve raw zeros and replay`,async t=>{
 const f=await fixture(t);
 const doc={type:'doc',attrs:{wordDefaultTabStop:567},content:[{type:'paragraph',attrs:{wordParagraphIndent:{left:720,firstLine:240},wordParagraphTabs:[{pos:1701,val:'right',leader:'dot'}]},content:[{type:'text',text:'Alpha\t12.34'}]},{type:'paragraph',attrs:{wordParagraphIndent:{left:0,right:0,firstLine:0}},content:[{type:'text',text:'Zero reset'}]}]};
 let observed=envelope.composeObservablePayload({doc});fs.writeFileSync(f.alpha,observed);if(scope==='full')fs.writeFileSync(f.beta,observed);
 mountRenderer(f,()=>observed,0,null,()=>({projectId:f.query.projectId,documentId:f.a.nodeId}),payload=>{observed=payload.content;});f.probe.state({filePath:f.alpha,projectName:'Роман'});
 const source=await f.probe[scope==='scene'?'sceneSource':'fullSource'](),built=await f.probe.reviewBuild(source);assert.equal(built.publicationGate.publishAllowed,true,JSON.stringify(built.publicationGate));await f.probe.activate(source.pendingAuthorityStore);
 const bridge=await import('../../src/io/revisionBridge/index.mjs'),parts=bridge.extractDocxReviewTransportPackagePartsFromZipBytes({bytes:built.documentBuffer}).parts;
 assert.match(parts['word/settings.xml'],/defaultTabStop w:val="567"/);
 parts['word/settings.xml']=parts['word/settings.xml'].replace('defaultTabStop w:val="567"','defaultTabStop w:val="851"');
 parts['word/document.xml']=parts['word/document.xml'].replaceAll('<w:ind w:left="0" w:right="0" w:firstLine="0"/>','').replaceAll('w:left="720" w:firstLine="240"','w:left="1080" w:firstLine="240"');
 const bytes=require('../../src/export/docx/docxMinBuilder.js').buildStoredZip(Object.entries(parts).map(([name,data])=>({name,data})));
 const before=f.capture(),beta=read(f.beta),activated=await f.probe.reviewActivate({requestId:`layout-${scope}`,bufferSource:bytes.toString('base64')},{allowInlineDocxReturnIntakeParserForTests:true});
 assert.equal(activated.ok,true,JSON.stringify(activated));assert.equal(activated.formattingProductPath?.prepared,true,JSON.stringify(activated));assert.equal(activated.formattingProductPath.diagnosticCount,0,JSON.stringify(activated));assert.deepEqual(f.capture(),before);
 const input=f.probe.formattingInput(),roots=input.operations.filter(op=>op.kind==='document-properties');assert.equal(roots.length,scope==='scene'?1:2);for(const op of roots){assert.equal(Object.hasOwn(op,'blockId'),false);assert.equal(op.document.wordDefaultTabStop.value,851);}
 const settle=f.probe.observeDeferredEditorSync(),applied=await f.probe.formatApply({requestId:'layout-apply'});await settle();assert.equal(applied.ok,true,JSON.stringify(applied));assert.equal(applied.replayVerified,true);
 for(const target of scope==='scene'?[f.alpha]:[f.alpha,f.beta]){const saved=envelope.parseObservablePayload(read(target)).doc;assert.equal(saved.attrs.wordDefaultTabStop,851);assert.equal(saved.content[0].attrs.wordParagraphIndent.left,1080);assert.deepEqual(saved.content[1].attrs.wordParagraphIndent,{left:0,right:0,firstLine:0});assert.deepEqual(saved.content.map(p=>p.content),doc.content.map(p=>p.content));}
 if(scope==='scene')assert.equal(read(f.beta),beta);assert.equal(observed,read(f.alpha));
 const persisted=f.capture(),replay=await f.probe.formatApply({requestId:'layout-replay'});await settle();assert.equal(replay.ok,true);assert.equal(replay.reviewSurface.formattingReturnResult.writerCalled,false);assert.deepEqual(f.capture(),persisted);
 const reexport=await f.probe[scope==='scene'?'sceneSource':'fullSource'](),rebuilt=await f.probe.reviewBuild(reexport);assert.equal(rebuilt.publicationGate.publishAllowed,true);assert.match(bridge.extractDocxReviewTransportPackagePartsFromZipBytes({bytes:rebuilt.documentBuffer}).parts['word/settings.xml'],/defaultTabStop w:val="851"/);
});

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
async function fixture(t, rich = false, alphaFileName = '01_Alpha.txt') {
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
  const app = { getPath: name => name === 'documents' ? documents : name === 'userData' ? data : temp,
    setPath() {}, whenReady: () => new Promise(() => {}), on() {}, quit() {}, exit() {}, setName() {}, requestSingleInstanceLock: () => true };
  const electron = { app, BrowserWindow: { getFocusedWindow: () => null, getAllWindows: () => [] },
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
      if ('dirty' in values) isDirty = values.dirty;
      if ('generation' in values) lastSignaledEditGeneration = values.generation;
      if ('pending' in values) activePendingRecording = values.pending;
      if ('window' in values) mainWindow = values.window;
      return { filePath: currentFilePath, dirty: isDirty, generation: lastSignaledEditGeneration };
    },
    dispatch: dispatchLegacyUiTreeDocumentCommand, shellUrl: getExpectedIpcShellUrl,
    bind: bindPendingDocxReviewPublication, activate: activateReviewDocxExportAuthority,
    buildAuthority: buildDocxReviewReturnAuthorityStoreRecord, authorityPath: docxReviewReturnAuthorityStorePath,
    fresh: assertFreshDocxReviewRoundAuthority, strict: readStrictDocxReviewAuthorityStore,
    persist: persistDocxReviewReturnAuthorityStore, expire: expireProjectWordRoundsBeforeTree,
    setReviewStore(value) { activeReviewDocxExportAuthorityStore = value; },
    recover: recoverPendingWriterProjectTransaction, save: handleSave, autosave: runAutoSave, backup: createBackup, text: requestEditorText, snapshot: requestEditorSnapshot, normalizeSnapshot: normalizeEditorSnapshotPayload, exportMin: handleExportDocxMin, saveAs: handleSaveAs,
    changeSession() { commentAuthoringSessionId += 1; },
  };`;
  Module._load = function (request, parent, isMain) { return request === 'electron' ? electron : originalLoad.call(this, request, parent, isMain); };
  try { compiled._compile(fs.readFileSync(mainPath, 'utf8') + hooks, mainPath); }
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

test('late dirty copied-scene Undo detaches its live buffer and actual Save dialog writes a fresh scene without touching original', async t => {
  const f = await fixture(t);
  const copy = await f.main.handleUiCopyNodeCommand({ projectId: f.query.projectId, nodeId: f.a.nodeId, name: 'Fork', expectedTreeRevision: 0 });
  assert.equal(copy.ok, true, JSON.stringify(copy));
  const fork = path.join(f.imported, '03_Fork.txt');
  let working = read(fork), generation = 0;
  const ui = mountRenderer(f, () => working, () => generation);
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
  assert.equal(await f.probe.save(), true);
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

test('rich late-copy Undo preserves the working buffer and readable graph packet while fresh SaveAs safely refuses', async t => {
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
  const ui = mountRenderer(f, () => working, () => generation); f.probe.state({ filePath: fork });
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

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
async function fixture(t, rich = false) {
  const spelled = await fsp.mkdtemp(path.join(os.tmpdir(), 'scene-identity-main-'));
  const temp = await fsp.realpath(spelled);
  t.after(() => fsp.rm(temp, { recursive: true, force: true }));
  const documents = path.join(temp, 'Documents'), data = path.join(temp, 'userData');
  fs.mkdirSync(data, { recursive: true });
  const root = path.join(documents, 'craftsman', 'Роман'), imported = path.join(root, 'roman', 'Imported');
  fs.mkdirSync(imported, { recursive: true });
  const alpha = path.join(imported, '01_Alpha.txt'), beta = path.join(imported, '02_Beta.txt');
  fs.writeFileSync(alpha, 'Alpha'); fs.writeFileSync(beta, 'Beta');
  const handles = new Map(), listeners = new Map();
  const app = { getPath: name => name === 'documents' ? documents : name === 'userData' ? data : temp,
    setPath() {}, whenReady: () => new Promise(() => {}), on() {}, quit() {}, exit() {}, setName() {}, requestSingleInstanceLock: () => true };
  const electron = { app, BrowserWindow: { getFocusedWindow: () => null, getAllWindows: () => [] },
    Menu: { buildFromTemplate: () => ({}), setApplicationMenu() {} },
    dialog: { showMessageBox: async () => ({}), showSaveDialog: async () => ({ canceled: true }), showOpenDialog: async () => ({ canceled: true }) },
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
    recover: recoverPendingWriterProjectTransaction,
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
      action: 'create', projectId: query.projectId, sceneId: 'roman/Imported/01_Alpha.txt', requestId: 'local-create', name: 'Anchor',
      start: { paragraphIndex: 0, offsetUtf16: 0, edge: 'text' }, end: { paragraphIndex: 0, offsetUtf16: 5, edge: 'text' } });
    result.doc.content.push({ type: 'paragraph', content: [{ type: 'text', text: 'Link', marks: [{ type: 'link', attrs: bookmarks.linkAttrs(result.registry.bookmarks[0]) }] }] });
    source = envelope.composeObservablePayload({ doc: result.doc, metaEnabled: true, meta: { status: 'черновик', synopsis: 'keep', tags: {} }, cards: [] });
    fs.writeFileSync(alpha, source);
    const manuscript = notes.bindManuscriptPayload({ kind: 'footnote', body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Note' }] }] },
      sceneId: 'roman/Imported/01_Alpha.txt', offsetUtf16: 2, sceneContent: source });
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
  return { temp, root, imported, alpha, beta, main, probe, a, b, parent, query, source, manifestPath, capture, move, installRound, handles, listeners };
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

function mountRenderer(f, content, generation = 0, onSnapshot = null) {
  const sends = [], session = {}, url = f.probe.shellUrl();
  const wc = { id: 91, session, getURL: () => url, isDestroyed: () => false,
    send(channel, payload) {
      sends.push({ channel, payload });
      if (channel === 'editor:snapshot-request') {
        const current = typeof content === 'function' ? content() : content;
        if (onSnapshot) onSnapshot();
        queueMicrotask(() => f.listeners.get('editor:snapshot-response')({ sender: wc, senderFrame: { url } }, {
          requestId: payload.requestId, snapshot: { content: current, generation, selectionRange: { start: 0, end: 0 } },
        }));
      }
    } };
  f.probe.state({ filePath: f.beta, window: { webContents: wc, isDestroyed: () => false }, generation });
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

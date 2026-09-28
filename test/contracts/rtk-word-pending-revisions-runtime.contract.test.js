'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), vm = require('node:vm');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), crypto = require('node:crypto');
const model = require('../../src/core/word-pending-text-revisions-v1.cjs');
const envelope = require('../../src/core/document-content-envelope-v1.cjs');
const { createCommandSurfaceKernel } = require('../../src/command/commandSurfaceKernel.js');
const main = fs.readFileSync(path.join(__dirname, '../../src/main.js'), 'utf8');
const source = main.slice(main.indexOf('async function readPendingRevisionProjection('), main.indexOf('async function handleCommentAuthoringCommand('));
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
  const file = path.join(root, 'scene.txt'); fs.writeFileSync(file, envelope.composeObservablePayload({ doc: document() }));
  const h = { writes: 0, opens: 0, snapshot: null, race: null };
  const context = () => { const raw = fs.readFileSync(file, 'utf8'); return { filePath: file, projectId: 'p', sceneId: 'roman/a.txt',
    subjectId: 'life:session', sceneSha256: hash(raw), raw, parsed: envelope.parseObservablePayload(raw) }; };
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
    }, openProjectDocumentFile: async () => { h.opens++; return { ok: true }; },
    COMMAND_BUS_ROUTE: 'command.bus', resolveMenuCommandId: commandId => ({ ok: true, commandId }),
    evaluateWriterLocalCommandAccess: () => ({ allowed: h.allowed !== false, reason: 'PROFILE_DENIED' }), getWriterLocalRuntimeProfile: () => ({}),
    getProductCommandRecord: () => null, decideCommandEntitlement: () => ({ available: h.entitled !== false, reason: 'ENTITLEMENT_DENIED' }),
    getProductEntitlementTier: () => 'free', E_COMMAND_DISABLED_FOR_ENTITLEMENT: 'ENTITLEMENT_DENIED', isMenuLocalCustomizationCommandId: () => false,
  };
  vm.createContext(c); vm.runInContext(source + '\n' + bus, c);
  const kernel = createCommandSurfaceKernel({ [id]: payload => c.handlePendingRevisionCommand(payload) });
  c.MENU_COMMAND_HANDLERS = { [id]: payload => kernel.dispatch(id, payload) };
  h.command = (action, override = {}) => c.dispatchMenuCommand(id, { projectId: 'p', sceneId: 'roman/a.txt', subjectId: 'life:session',
    expectedSceneSha256: context().sceneSha256, action, ...override }, { route: 'command.bus' });
  h.c = c; h.file = file; h.context = context; return h;
}
test('actual main bus and Kernel persist decisions, reopen, undo redo and no-op replay', async t => {
  const h = await harness(t);
  let r = await h.command('reject', { revisionId: 'revision-2' }); assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(h.writes, 1);
  assert.equal(model.projection(h.context().parsed.doc).current, 'old');
  r = await h.command('reject', { revisionId: 'revision-1' }); assert.equal(r.ok, true); assert.equal(h.writes, 1);
  assert.equal((await h.command('undo')).ok, true); assert.equal(model.projection(h.context().parsed.doc).current, 'new');
  assert.equal((await h.command('redo')).ok, true); assert.equal(model.projection(h.context().parsed.doc).current, 'old');
  assert.equal(h.writes, 3); assert.equal(h.opens, 3);
});
for (const kind of ['scene', 'project', 'subject', 'hash', 'draft', 'noteDraft', 'dirtyRace', 'generationRace', 'diskRace', 'profile', 'entitlement', 'payloadPath', 'annotationUndo']) {
  test(`pending decisions block ${kind} without write`, async t => {
    const h = await harness(t), before = fs.readFileSync(h.file, 'utf8'); let override = {};
    if (kind === 'scene') override.sceneId = 'roman/duplicate-text.txt';
    if (kind === 'project') override.projectId = 'foreign';
    if (kind === 'subject') override.subjectId = 'old';
    if (kind === 'hash') override.expectedSceneSha256 = 'bad';
    if (kind === 'draft') h.snapshot = { generation: 0, content: before, commentAuthoringPending: true };
    if (kind === 'noteDraft') h.snapshot = { generation: 0, content: before, manuscriptNoteAuthoringPending: true };
    if (kind === 'dirtyRace') h.race = () => { h.c.isDirty = true; };
    if (kind === 'generationRace') h.race = () => { h.c.lastSignaledEditGeneration = 1; };
    if (kind === 'diskRace') h.race = () => { fs.writeFileSync(h.file, 'concurrent owner text'); };
    if (kind === 'profile') h.allowed = false;
    if (kind === 'entitlement') h.entitled = false;
    if (kind === 'payloadPath') override.path = '/not-authority';
    if (kind === 'annotationUndo') h.notes = [{ manuscript: { reference: { sceneId: 'roman/a.txt' } } }];
    const result = await h.command('acceptAll', override); assert.equal(result.ok, false, JSON.stringify(result)); assert.equal(h.writes, 0);
    assert.equal(fs.readFileSync(h.file, 'utf8'), kind === 'diskRace' ? 'concurrent owner text' : before);
  });
}
test('real ProseMirror schema preserves ledger; typing, formatting and forged metadata are blocked; checked publication works', async () => {
  const [{ getSchema }, { default: StarterKit }, { WordPendingRevisions }, { EditorState }] = await Promise.all([
    import('@tiptap/core'), import('@tiptap/starter-kit'), import('../../src/renderer/tiptap/wordPendingRevisions.mjs'), import('@tiptap/pm/state'),
  ]);
  const schema = getSchema([StarterKit, WordPendingRevisions]);
  const doc = schema.nodeFromJSON(document());
  const plugins = WordPendingRevisions.config.addProseMirrorPlugins.call({});
  let state = EditorState.create({ schema, doc, plugins });
  assert.ok(model.readLedger(state.doc.toJSON())); assert.equal(plugins[0].props.editable(state), false);
  const old = JSON.stringify(state.doc.toJSON());
  state = state.apply(state.tr.insertText('evil', 1)); assert.equal(JSON.stringify(state.doc.toJSON()), old);
  state = state.apply(state.tr.addMark(1, 2, schema.marks.bold.create())); assert.equal(JSON.stringify(state.doc.toJSON()), old);
  const next = schema.nodeFromJSON(model.decide(document(), { action: 'rejectAll' }).doc);
  state = state.apply(state.tr.replaceWith(0, state.doc.content.size, next.content).setDocAttribute('wordPendingRevisions', next.attrs.wordPendingRevisions)
    .setMeta('wordPendingRevisionsExternal', true));
  assert.equal(model.projection(state.doc.toJSON()).current, 'old');
});

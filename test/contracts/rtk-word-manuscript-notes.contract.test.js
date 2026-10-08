'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const model = require('../../src/core/word-manuscript-notes-v1.cjs');
const body = () => ({ type: 'doc', content: [{ type: 'paragraph', content: [
  { type: 'text', text: 'Точная\tсноска 😀', marks: [{ type: 'bold' }] },
  { type: 'hardBreak' }, { type: 'text', text: 'ссылка', marks: [{ type: 'link', attrs: { href: 'https://example.invalid/note' } }] },
] }, { type: 'paragraph' }] });
const payload = () => model.bindManuscriptPayload({ kind: 'footnote', body: body(), sceneId: 'roman/scene.txt', offsetUtf16: 3, sceneContent: 'До слова' });
test('rich manuscript note retains paragraphs, exact atoms and marks without flattening', () => {
  const value = model.validateNoteBody(body());
  assert.deepEqual(value.body, body());
  assert.equal(value.text, 'Точная\tсноска 😀\nссылка\n');
  assert.equal(payload().reference.sourceTextSha256, model.sha('До слова'));
});
test('unsupported body content and attributes are rejected before normalization', () => {
  for (const mutate of [
    x => x.content.push({ type: 'table', content: [] }),
    x => x.content[0].content.push({ type: 'image', attrs: {} }),
    x => x.content[0].content[0].marks.push({ type: 'unknown' }),
    x => x.content[0].content[0].marks.push({ type: 'link', attrs: { href: 'file:///secret' } }),
    x => x.content[0].content[0].text = '\ud800',
    x => x.content[0].content[0].text = 'x\rhidden',
    x => x.content[0].attrs = { hidden: true },
  ]) { const value = body(); mutate(value); assert.throws(() => model.validateNoteBody(value)); }
});
test('points cannot split UTF16 pairs or accept path authority', () => {
  assert.throws(() => model.bindManuscriptPayload({ kind: 'footnote', body: body(), sceneId: 'roman/a.txt', offsetUtf16: 1, sceneContent: '😀' }), /BOUNDARY/);
  for (const sceneId of ['/private/a', '../secret', 'roman/../a', 'roman\\a']) {
    const value = payload(); value.reference.sceneId = sceneId;
    assert.throws(() => model.validateManuscriptPayload(value), /REFERENCE/);
  }
});
test('point moves across Enter and stable surrounding edits; ambiguous edits are explicit conflicts', () => {
  assert.equal(model.mapPoint('До слова', 'До \nслова', 3), 4);
  assert.equal(model.mapPoint('До слова', 'До слова!', 3), 3);
  assert.equal(model.mapPoint('До слова', '!До слова', 3), 4);
  assert.equal(model.mapPoint('До \nслова', 'До слова', 5), 4);
  assert.throws(() => model.mapPoint('До слова', 'Длова', 3), /CONFLICT/);
  assert.throws(() => model.mapPoint('aaaa', 'aaaaa', 2), /CONFLICT/);
});
test('anchor save changes only the bound manuscript reference and preserves private data', () => {
  const before = { schemaVersion: 1, projectId: 'p', notes: [
    { id: 'private', scope: 'manuscript', body: 'Секрет', opaque: { keep: true } },
    { id: 'note-a', scope: 'manuscript', body: model.validateNoteBody(body()).text, manuscript: payload() },
  ] };
  const input = { beforeText: JSON.stringify(before), projectId: 'p', sceneId: 'roman/scene.txt', beforeContent: 'До слова', afterContent: '!До слова' };
  const plan = model.planManuscriptNoteAnchorSave(input);
  const expected = structuredClone(before);
  expected.notes[1].manuscript.reference.offsetUtf16 = 4;
  expected.notes[1].manuscript.reference.sourceTextSha256 = model.sha('!До слова');
  assert.deepEqual(JSON.parse(plan.afterText), expected);
  assert.throws(() => model.planManuscriptNoteAnchorSave({ ...input, beforeContent: 'Чужой текст' }), /STALE/);
});
test('canonical notes commands preserve private defaults and require rich manuscript updates', async () => {
  const storage = await import('../../src/core/notesStorage.mjs');
  const options = { projectId: 'p', now: () => '2026-09-28T01:00:00Z' };
  const empty = storage.buildEmptyNotesDocument('p', options);
  const privateResult = storage.applyNotesMutation(empty, { op: 'create', noteId: 'private', scope: 'manuscript', body: 'Личная заметка' }, options);
  assert.equal(privateResult.ok, true); assert.equal(privateResult.note.manuscript, undefined);
  const rich = payload();
  const created = storage.applyNotesMutation(privateResult.document, { op: 'create', noteId: 'note-a', scope: 'manuscript', body: model.validateNoteBody(rich.body).text, manuscript: rich }, options);
  assert.equal(created.ok, true); assert.deepEqual(created.note.manuscript, rich);
  assert.equal(storage.applyNotesMutation(created.document, { op: 'update', noteId: 'note-a', body: 'flattened' }, options).ok, false);
  assert.equal(storage.applyNotesMutation(created.document, { op: 'delete', noteId: 'note-a', expectedDocumentHash: 'stale' }, options).reason, 'NOTES_REVISION_STALE');
  const deleted = storage.applyNotesMutation(created.document, { op: 'delete', noteId: 'note-a', expectedDocumentHash: created.hash }, options);
  assert.equal(deleted.note.deleted, true); assert.deepEqual(deleted.note.manuscript, rich);
  const restored = storage.applyNotesMutation(deleted.document, { op: 'restore', noteId: 'note-a', expectedDocumentHash: deleted.hash }, options);
  assert.equal(restored.note.deleted, false);
  assert.equal(storage.buildNotesReadModel(restored.document, options).documentHash, restored.hash);
});

test('manuscript drafts and pending publication veto unload before editor destruction', () => {
  const vm = require('node:vm'), fs = require('node:fs'), path = require('node:path');
  const source = fs.readFileSync(path.resolve(__dirname, '../../src/renderer/editor.js'), 'utf8');
  const start = source.indexOf('function guardManuscriptNoteDraftUnload(event) {');
  const end = source.indexOf("window.addEventListener('beforeunload', guardManuscriptNoteDraftUnload, { capture: true });", start);
  let listener, notice;
  const sandbox = { storyDrafts: new Map(), storyMutationPending: false, pendingStoryRequestId: null, manuscriptDrafts: new Map(), notesMutationPending: 0, setNotesWorkspaceStatus: text => { notice = text; },
    window: { addEventListener: (name, fn, options) => { assert.equal(name, 'beforeunload'); assert.equal(options.capture, true); listener = fn; } } };
  vm.runInNewContext(source.slice(start, end + "window.addEventListener('beforeunload', guardManuscriptNoteDraftUnload, { capture: true });".length), sandbox);
  let stopped = 0;
  const event = { preventDefault() { stopped++; }, stopImmediatePropagation() { stopped++; } };
  listener(event);assert.equal(stopped, 0);
  sandbox.manuscriptDrafts.set('p:note-a', { body: body() });listener(event);assert.equal(stopped, 2);assert.equal(event.returnValue, false);assert.match(notice, /сохраните/);
  sandbox.manuscriptDrafts.clear();sandbox.notesMutationPending = 1;listener(event);assert.equal(stopped, 4);assert.match(notice, /Дождитесь/);
});

test('actual manuscript command revalidates scene, notes, lease and lifecycle before canonical publication', async t => {
  const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), vm = require('node:vm');
  const storage = await import('../../src/core/notesStorage.mjs');
  const envelope = require('../../src/core/document-content-envelope-v1.cjs');
  const review = await import('../../src/io/revisionBridge/reviewTransportNonTextReturnRuntime.mjs');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'notes-main-handler-'));t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const filePath = path.join(root, 'scene.txt');fs.writeFileSync(filePath, 'До слова');
  const source = { projectId: 'p', projectRoot: root, filePath, subjectId: 'subject:session', sceneId: 'scene.txt', raw: 'До слова', sceneSha256: model.sha('До слова'), parsed: { text: 'До слова', doc: null } };
  let document = storage.buildEmptyNotesDocument('p'), writes = 0, loseLease = false, staleOnWrite = false;
  const read = () => ({ ok: true, current: { document, hash: storage.buildNotesReadModel(document, { projectId: 'p' }).documentHash, sourceText: JSON.stringify(document) } });
  const sandbox = { Buffer, fs: fs.promises, isDirty: false, autoSaveInProgress: false, currentFilePath: filePath, lastSignaledEditGeneration: 0,
    commentAuthoringSessionId: 'session', currentLifecycleSubjectId: () => 'subject', manuscriptNoteModel: model,
    isPlainObjectValue: value => value && typeof value === 'object' && !Array.isArray(value), queueDiskOperation: fn => fn(),
    readCommentAuthoringContext: async () => source, requestEditorSnapshot: async () => ({ content: 'До слова', generation: 0 }),
    loadDocumentContentEnvelopeModule: async () => envelope, loadRtkNonTextReturnModule: async () => review,
    getMainProjectManifestAuthority: async () => ({ withProjectLease: (_id, fn) => fn({ publish: fn => fn(), assertOwned: async () => { if (loseLease) throw Error('LEASE_LOST'); } }) }),
    readProjectNotesDocument: async () => read(),
    writeProjectNotesDocument: async (_context, _previous, next, _command, options) => {
      if (staleOnWrite) sandbox.currentFilePath = '/foreign/scene.txt';
      await options.beforeWrite(); assert.equal(options.inDiskOperation, true);
      fs.writeFileSync(path.join(root, 'notes.json'), JSON.stringify(next));document = next;writes++;return { ok: true };
    },
    makeNotesCommandError: (_command, code, reason) => ({ ok: false, code, reason }), buildNotesMutationReceipt: () => ({}),
  };
  const main = fs.readFileSync(path.resolve(__dirname, '../../src/main.js'), 'utf8');
  vm.runInNewContext(main.slice(main.indexOf('async function runManuscriptNotesMutation('), main.indexOf('async function handleWorkspaceProjectNotesQuery(')), sandbox);
  const context = { projectId: 'p', projectRoot: root, notesStorage: storage };
  const input = () => ({ projectId: 'p', subjectId: source.subjectId, expectedSceneSha256: source.sceneSha256, expectedDocumentHash: read().current.hash });
  const mutation = { op: 'create', manuscriptRequest: { kind: 'footnote', bodyJson: JSON.stringify(body()), offsetUtf16: 3 } };
  const run = payload => sandbox.runManuscriptNotesMutation('notes.create', payload, mutation, context);
  assert.equal((await run({ ...input(), subjectId: 'foreign' })).reason, 'NOTE_SOURCE_IDENTITY_STALE');
  assert.equal((await run({ ...input(), expectedDocumentHash: 'stale' })).reason, 'NOTES_REVISION_STALE');
  loseLease = true;assert.equal((await run(input())).reason, 'LEASE_LOST');loseLease = false;
  staleOnWrite = true;assert.equal((await run(input())).reason, 'NOTE_SOURCE_IDENTITY_STALE');staleOnWrite = false;sandbox.currentFilePath = filePath;
  assert.equal(writes, 0);
  const result = await run(input());assert.equal(result.ok, true, JSON.stringify(result));assert.equal(writes, 1);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, 'notes.json'))).notes[0].manuscript.body, body());
  const created = document.notes[0];created.deleted = true;
  const referenceHash = created.manuscript.reference.sourceTextSha256;
  created.manuscript.reference.sourceTextSha256 = model.sha('Changed scene');
  const restore = () => sandbox.runManuscriptNotesMutation('notes.restore', { ...input(), noteId: created.id }, { op: 'restore' }, context);
  assert.equal((await restore()).reason, 'NOTE_REFERENCE_STALE');assert.equal(writes, 1);assert.equal(created.deleted, true);
  created.manuscript.reference.sourceTextSha256 = referenceHash;
  assert.equal((await restore()).ok, true);assert.equal(writes, 2);assert.equal(document.notes[0].deleted, false);
});

test('actual editor offset mapping stops at the matched paragraph and counts hard breaks', async () => {
  const fs = require('node:fs'), path = require('node:path');
  const { Schema } = require('@tiptap/pm/model');
  const schema = new Schema({ nodes: { doc: { content: 'paragraph+' }, paragraph: { content: '(text|hardBreak)*', group: 'block' }, text: { group: 'inline' }, hardBreak: { inline: true, group: 'inline' } } });
  const doc = schema.node('doc', null, [schema.node('paragraph', null, [schema.text('До слова после.')]),
    schema.node('paragraph', null, [schema.text('abc'), schema.node('hardBreak'), schema.text('def')])]);
  const text = fs.readFileSync(path.join(__dirname, '../../src/renderer/tiptap/index.js'), 'utf8');
  const section = text.slice(text.indexOf('function getDocumentPositionForTextOffset('), text.indexOf('function runFocusedChainCommand('));
  const { positionForTextOffset } = await import('../../src/renderer/tiptap/textCoordinates.mjs');
  const resolve = new Function('positionForTextOffset', section + ';return getDocumentPositionForTextOffset;')(positionForTextOffset);
  const editor = { state: { doc } };
  assert.equal(resolve(editor, 8), 9);
  assert.equal(resolve(editor, 0), 1);
  assert.equal(resolve(editor, 15), 16);
  assert.equal(resolve(editor, 16), 18);
  assert.equal(resolve(editor, 20), 22);
  for (let offset = 0; offset <= 23; offset++) {
    assert.equal(doc.textBetween(0, resolve(editor, offset), '\n', '\0').length, offset);
  }
});

test('rich note command crosses unchanged IPC depth and breadth limits as bounded validated JSON', () => {
  const { createEnvelope, validateIpcEnvelope } = require('../../src/core/ipc-envelope-v1.cjs');
  const payload = { projectId: 'p', subjectId: 'saved-scene', expectedSceneSha256: 'a'.repeat(64), expectedDocumentHash: 'b'.repeat(64),
    manuscript: { kind: 'footnote', offsetUtf16: 3, bodyJson: JSON.stringify(body()) } };
  const wire = createEnvelope('ui:command-bridge', 'cmd.project.notes.create', payload);
  assert.equal(validateIpcEnvelope(wire, 'ui:command-bridge').ok, true);
  assert.deepEqual(model.validateNoteBody(JSON.parse(wire.payload.manuscript.bodyJson)).body, body());
  const forged = structuredClone(wire);forged.payload.manuscript.bodyJson = 'x'.repeat(1024 * 1024);
  assert.equal(validateIpcEnvelope(forged, 'ui:command-bridge').code, 'E_ENVELOPE_BYTES');
});

test('body save refreshes scene identity but never overwrites a concurrent note or changed editor identity', async () => {
  const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
  const text = fs.readFileSync(path.join(__dirname, '../../src/renderer/editor.js'), 'utf8');
  const source = text.slice(text.indexOf('async function saveManuscriptNote('), text.indexOf('function renderNotesWorkspace()'));
  const note = { id: 'note-a', contentHash: 'baseline', manuscript: payload() };
  const draft = { body: body(), kind: 'footnote', baselineHash: 'baseline' };
  let writes = [], pending, status;
  const fresh = () => ({ ok: true, projectId: 'p', documentHash: 'notes-before', notes: [note],
    manuscriptAuthoring: { available: true, sceneId: 'roman/scene.txt', subjectId: 'fresh-subject', expectedSceneSha256: 'new-raw-scene' } });
  const sandbox = { currentProjectId: 'p', currentDocumentId: 'scene', manuscriptBodyIdentity: 'p:note-a', notesMutationPending: 0,
    manuscriptBodyEditor: { getJSON: body }, manuscriptKindSelect: { value: 'footnote' }, manuscriptInsertionPoint: 3,
    storyDrafts: new Map(), storyMutationPending: false, pendingStoryRequestId: null, manuscriptDrafts: new Map([['p:note-a', draft]]),
    notesWorkspaceState: { documentHash: 'notes-before', selectedId: 'note-a', manuscriptAuthoring: { expectedSceneSha256: 'old-raw-scene' } },
    NOTES_WORKSPACE_QUERY_ID: 'notes', EXTRA_COMMAND_IDS: { NOTES_UPDATE: 'update' },
    invokeWorkspaceQueryBridge: () => new Promise(resolve => { pending = resolve; }),
    manuscriptMutationBinding: () => ({ ...sandbox.notesWorkspaceState.manuscriptAuthoring, expectedDocumentHash: sandbox.notesWorkspaceState.documentHash }),
    runNotesMutation: async (command, value) => { writes.push(value); return { ok: true }; },
    setNotesWorkspaceStatus: value => { status = value; }, renderNotesWorkspaceDetail() {},
  };
  vm.runInNewContext(source, sandbox);
  let work = sandbox.saveManuscriptNote(note);pending(fresh());await work;
  assert.equal(writes.length, 1);assert.equal(writes[0].expectedSceneSha256, 'new-raw-scene');assert.equal(writes[0].expectedDocumentHash, 'notes-before');
  assert.equal(sandbox.manuscriptDrafts.size, 0);
  for (const changed of [value => { value.documentHash = 'concurrent'; }, value => { value.notes = [{ ...note, contentHash: 'changed-body' }]; },
    value => { value.projectId = 'foreign'; }, value => { value.notes = [{ ...note, deleted: true }]; }]) {
    sandbox.manuscriptDrafts.set('p:note-a', draft);work = sandbox.saveManuscriptNote(note);const value = fresh();changed(value);pending(value);await work;
    assert.equal(writes.length, 1);assert.equal(sandbox.manuscriptDrafts.get('p:note-a'), draft);assert.match(status, /черновик сохранён/);
  }
  work = sandbox.saveManuscriptNote(note);sandbox.currentDocumentId = 'other';pending(fresh());await work;
  assert.equal(writes.length, 1);sandbox.currentDocumentId = 'scene';
  work = sandbox.saveManuscriptNote(note);const newer = { ...draft, body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'New typing' }] }] } };
  sandbox.manuscriptDrafts.set('p:note-a', newer);pending(fresh());await work;
  assert.equal(writes.length, 2);assert.equal(sandbox.manuscriptDrafts.get('p:note-a'), newer);
});

test('32 MiB scene note binding preserves full body and strict source and byte boundaries',()=>{
 const cap=32*1024*1024,raw='x'.repeat(cap),before=body();
 assert.equal(model.sceneText(raw),raw);
 const bound=model.bindManuscriptPayload({kind:'endnote',body:before,sceneId:'roman/large.txt',offsetUtf16:raw.length,sceneContent:raw});
 assert.deepEqual(bound.body,before);assert.equal(bound.reference.sourceTextSha256,model.sha(raw));assert.equal(bound.reference.offsetUtf16,cap);
 const state={schemaVersion:1,projectId:'p',notes:[{id:'large',scope:'manuscript',body:model.validateNoteBody(before).text,manuscript:bound}]},beforeText=JSON.stringify(state);
 assert.equal(model.planManuscriptNoteAnchorSave({beforeText,projectId:'p',sceneId:'roman/large.txt',beforeContent:raw,afterContent:raw,includeUnchanged:true}).afterText,beforeText);
 assert.throws(()=>model.sceneText(raw+'x'),e=>e.code==='NOTE_SCENE_BUDGET');
 assert.throws(()=>model.planManuscriptNoteAnchorSave({beforeText,projectId:'p',sceneId:'roman/large.txt',beforeContent:raw.slice(1),afterContent:raw}),e=>e.code==='NOTE_REFERENCE_STALE');
 assert.deepEqual(JSON.parse(beforeText),state);assert.deepEqual(body(),before);
});

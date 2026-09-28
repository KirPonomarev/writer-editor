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
  const sandbox = { manuscriptDrafts: new Map(), notesMutationPending: 0, setNotesWorkspaceStatus: text => { notice = text; },
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
  const sandbox = { fs: fs.promises, isDirty: false, autoSaveInProgress: false, currentFilePath: filePath, lastSignaledEditGeneration: 0,
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
  const mutation = { op: 'create', manuscriptRequest: { kind: 'footnote', body: body(), offsetUtf16: 3 } };
  const run = payload => sandbox.runManuscriptNotesMutation('notes.create', payload, mutation, context);
  assert.equal((await run({ ...input(), subjectId: 'foreign' })).reason, 'NOTE_SOURCE_IDENTITY_STALE');
  assert.equal((await run({ ...input(), expectedDocumentHash: 'stale' })).reason, 'NOTES_REVISION_STALE');
  loseLease = true;assert.equal((await run(input())).reason, 'LEASE_LOST');loseLease = false;
  staleOnWrite = true;assert.equal((await run(input())).reason, 'NOTE_SOURCE_IDENTITY_STALE');staleOnWrite = false;sandbox.currentFilePath = filePath;
  assert.equal(writes, 0);
  const result = await run(input());assert.equal(result.ok, true, JSON.stringify(result));assert.equal(writes, 1);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, 'notes.json'))).notes[0].manuscript.body, body());
});

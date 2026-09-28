'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const model = require('../../src/core/word-manuscript-notes-v1.cjs');
const { notesStateDigest } = require('../../src/export/docx/docxReviewPacketNotes.js');
const { buildFullManuscriptDocxReviewPacketSource: makeSource } = require('../../src/export/docx/fullManuscriptDocxReviewPacketSource.js');
const { buildDocxReviewPacketBuffer } = require('../../src/export/docx/docxReviewPacketBuilder.js');
const sourceMain = fs.readFileSync(path.join(__dirname, '../../src/main.js'), 'utf8');
const helper = sourceMain.slice(sourceMain.indexOf('const authenticatedNoteDeltaAdmissions ='), sourceMain.indexOf('// Admission is object-identity scoped'));
const handler = sourceMain.slice(sourceMain.indexOf('async function handleNotesUpdateCommand('), sourceMain.indexOf('async function handleNotesDeleteCommand('));
const snapshotNormalizer = sourceMain.slice(sourceMain.indexOf('function normalizeEditorSnapshotPayload('), sourceMain.indexOf('function requestEditorSnapshot('));
const stable = v => Array.isArray(v) ? `[${v.map(stable).join(',')}]` : v && typeof v === 'object'
  ? `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}` : JSON.stringify(v);
async function harness(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'note-return-runtime-')); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'roman'));
  const sceneId = 'roman/a.txt', scenePath = path.join(root, sceneId), text = 'До слова после.', projectId = 'p';
  fs.writeFileSync(scenePath, text);
  const body = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Old' }] }] };
  const document = { schemaVersion: 1, projectId, notes: [{ id: 'note-a', title: '', scope: 'manuscript', body: 'Old', deleted: false,
    manuscript: model.bindManuscriptPayload({ body, kind: 'footnote', sceneId, offsetUtf16: 3, sceneContent: text }) }] };
  const source = makeSource({ projectId, projectRoot: root, notesDocument: document,
    scenes: [{ sceneId, scenePath, order: 0, text, doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] } }] });
  const bytes = buildDocxReviewPacketBuffer(source), bridge = await import('../../src/io/revisionBridge/index.mjs');
  const parsed = bridge.buildDocxReviewTransportAnalysisFromZipBytes({ bytes }, { cryptoPort: {
    sha256Text: model.sha, sha256Json: v => 'sha256:' + model.sha(stable(v)), byteLength: v => Buffer.byteLength(v),
  } });
  assert.equal(parsed.ok, true);
  const returned = bridge.parseDocumentNotesRichReturn(bytes, parsed.reviewIr.documentNotes);
  returned[0].body.content[0].content[0].text = 'Edited'; returned[0].paragraphs = ['Edited'];
  const notesPath = path.join(root, 'notes.craftsman.json'); fs.writeFileSync(notesPath, JSON.stringify(document));
  const envelope = await import('../../src/renderer/documentContentEnvelope.mjs');
  const runtime = await import('../../src/io/revisionBridge/reviewTransportNonTextReturnRuntime.mjs');
  const h = { root, scenePath, bytes, notesPath, writes: 0, dispatches: 0, leaseCalls: 0, snapshot: { content: text, generation: 0 }, prepared: null,
    current: true, duringWrite: null, duringPublish: null };
  const context = { projectRoot: root, projectId, reviewTransportAuthorityCapsule: source.localAuthorityCapsule,
    reviewTransportReturnIntake: { authenticated: true, returnedArtifactSha256: model.sha(bytes), parserResult: parsed } };
  const sandbox = { Buffer, console, require: createRequire(path.join(__dirname, '../../src/main.js')), fs: fs.promises, path,
    activeStage10ApplicationBootstrap: {}, currentLifecycleSubjectId: () => 'life', currentFilePath: scenePath,
    lastSignaledEditGeneration: 0, isDirty: false, autoSaveInProgress: false, notesStateDigest,
    NOTES_UPDATE_COMMAND_ID: 'cmd.project.notes.update', getProjectRootPath: () => root, computeHash: model.sha,
    loadRtkNonTextReturnModule: async () => runtime, loadDocumentContentEnvelopeModule: async () => envelope,
    requestEditorSnapshot: async () => h.snapshot, getProjectNotesContext: async () => ({ ok: true, projectId, projectRoot: root }),
    readProjectNotesDocument: async () => { const sourceText = fs.readFileSync(notesPath, 'utf8'); return { ok: true, current: { sourceText, document: JSON.parse(sourceText) } }; },
    queueDiskOperation: operation => operation(), getMainProjectManifestAuthority: async () => ({ withProjectLease: async (id, fn) => {
      h.leaseCalls++; assert.equal(id, projectId); return fn({ assertOwned: async () => {}, publish: async fn => { if (h.duringPublish) await h.duringPublish(); return fn(); } });
    } }),
    writeProjectNotesDocument: async (ctx, before, after, commandId, options) => {
      if (h.duringWrite) await h.duringWrite(); await options.beforeWrite(); h.writes++;
      fs.writeFileSync(notesPath, JSON.stringify(after)); return { ok: true };
    },
    makeNotesCommandError: (id, code) => ({ ok: false, code }), runNotesMutationCommand: () => { throw Error('unexpected ordinary route'); },
    cloneJsonSafe: value => JSON.parse(JSON.stringify(value)),
  };
  vm.createContext(sandbox); vm.runInContext(helper + '\n' + handler + '\nglobalThis.prepare = prepareAuthenticatedNoteDelta; globalThis.update = handleNotesUpdateCommand;', sandbox);
  sandbox.dispatchCommandSurfaceKernel = async (id, payload) => { h.dispatches++; assert.equal(id, 'cmd.project.notes.update'); return sandbox.update(payload); };
  h.prepare = () => sandbox.prepare({ context, requestId: 'test', isCurrent: () => h.current, docxBytes: bytes,
    revisionBridge: { parseDocumentNotesRichReturn: () => structuredClone(returned) }, onPrepared: value => { h.prepared = value; } });
  h.context = context; h.sandbox = sandbox; h.document = document; return h;
}
test('actual main return is preview-only until Kernel apply, publishes once and rejects forged or consumed admission', async t => {
  const h = await harness(t); const preview = await h.prepare();
  assert.equal(preview.status, 'preview-ready', JSON.stringify(preview)); assert.equal(h.writes, 0); assert.equal(h.dispatches, 0);
  const forged = await h.sandbox.update({ action: 'authenticated-note-delta', requestId: 'test', projectId: 'p' });
  assert.equal(forged.code, 'NOTE_RETURN_ADMISSION_REQUIRED'); assert.equal(h.writes, 0);
  const receipt = await h.prepared.apply(); assert.equal(receipt.status, 'applied'); assert.equal(h.writes, 1); assert.equal(h.dispatches, 1); assert.equal(h.leaseCalls, 1);
  const after = JSON.parse(fs.readFileSync(h.notesPath)); assert.equal(after.notes[0].body, 'Edited'); assert.equal(after.notes[0].id, 'note-a');
  await assert.rejects(h.prepared.apply(), /NOTE_RETURN_PREPARED_CONSUMED/);
  const replay = await h.prepare(); assert.equal(replay.status, 'replayed', JSON.stringify(replay)); assert.equal(h.writes, 1);
});
for (const [name, mutate] of [
  ['unsaved note draft', h => { h.snapshot.manuscriptNoteAuthoringPending = true; }],
  ['unsaved scene', h => { h.snapshot.content += '!'; }],
  ['scene changed on disk', h => fs.appendFileSync(h.scenePath, '!')],
  ['project lifecycle changed', h => { h.sandbox.activeStage10ApplicationBootstrap = {}; }],
  ['generation advanced', h => { h.sandbox.lastSignaledEditGeneration++; }],
  ['cancelled activation', h => { h.current = false; }],
  ['notes changed on disk', h => { const d = JSON.parse(fs.readFileSync(h.notesPath)); d.notes[0].title = 'Local'; fs.writeFileSync(h.notesPath, JSON.stringify(d)); }],
]) test(`prepared apply rejects ${name} with no write`, async t => {
  const h = await harness(t); assert.equal((await h.prepare()).status, 'preview-ready'); mutate(h);
  await assert.rejects(h.prepared.apply(), /NOTE_(RETURN|SAVE)/); assert.equal(h.writes, 0);
});
test('notes CAS and note-draft guard revalidate at the actual atomic-write boundary', async t => {
  const h = await harness(t); assert.equal((await h.prepare()).status, 'preview-ready');
  h.duringWrite = async () => { h.snapshot.manuscriptNoteAuthoringPending = true; };
  await assert.rejects(h.prepared.apply(), /NOTE_RETURN_EDITOR_STALE/); assert.equal(h.writes, 0);
});
test('malformed parser inventory never prepares a deletion or writes state', async t => {
  const h = await harness(t); h.context.reviewTransportReturnIntake.parserResult.reasons.push({ code: 'RTK_WORD_NOTES_MALFORMED_BLOCKED' });
  const result = await h.prepare(); assert.equal(result.code, 'NOTE_RETURN_PACKAGE_INCOMPLETE'); assert.equal(h.prepared, null); assert.equal(h.writes, 0);
});
test('actual editor snapshot normalization retains the no-loss note draft flag', () => {
  assert(snapshotNormalizer.includes('manuscriptNoteAuthoringPending'), 'snapshot normalizer must retain draft signal');
  const name = snapshotNormalizer.match(/function (\w+)\(/)?.[1];
  const context = { isPlainObjectValue: v => v && typeof v === 'object' && !Array.isArray(v), normalizeSelectionRangeForSettings: () => null };
  vm.createContext(context); vm.runInContext(snapshotNormalizer + `\nglobalThis.normalize = ${name};`, context);
  assert.equal(context.normalize({ content: 'x', generation: 1, manuscriptNoteAuthoringPending: true }).manuscriptNoteAuthoringPending, true);
  const renderer = fs.readFileSync(path.join(__dirname, '../../src/renderer/editor.js'), 'utf8');
  assert(renderer.includes('manuscriptNoteAuthoringPending: Boolean(manuscriptDrafts.size || notesMutationPending)'));
});

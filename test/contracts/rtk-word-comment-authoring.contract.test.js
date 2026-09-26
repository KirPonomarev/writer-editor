'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const model = require('../../src/core/word-comment-authoring-v1.cjs');
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const scene = 'Before anchor after 👩‍💻';
const context = { projectId: 'p1', sceneId: 'roman/a.txt', sceneSha256: hash(scene), paragraphs: [scene], now: '2026-09-27T00:00:00Z' };
function intent(beforeText, action, extra = {}, requestId = 'op-' + crypto.randomUUID()) {
  return { requestId, action, projectId: 'p1', sceneId: 'roman/a.txt', subjectId: 'subject1',
    expectedStateSha256: beforeText === null ? '' : hash(beforeText), expectedSceneSha256: context.sceneSha256, ...extra };
}
function create(text = null) { return model.planCommentAuthoring({ ...context, beforeText: text,
  input: intent(text, 'create', { body: '  Literal\nтекст 👩‍💻  ', anchor: { paragraphIndex: 0, startUtf16: 7, selectedText: 'anchor' } }, 'root-op') }); }
function apply(previous, action, extra = {}) {
  return model.planCommentAuthoring({ ...context, beforeText: previous.afterText,
    input: intent(previous.afterText, action, { threadId: previous.threadId, ...extra }) });
}

test('ordinary authoring preserves literal root and reply bodies, original provenance and exact anchors through lifecycle', () => {
  let result = create(); const root = result.state.threads[0]; const provenance = root.messages[0].provenance;
  assert.equal(root.messages[0].body, '  Literal\nтекст 👩‍💻  '); assert.equal(root.anchor.startUtf16, 7);
  result = apply(result, 'reply', { body: '\nОтвет  ' }); const replyId = result.state.threads[0].messages[1].commentId;
  result = apply(result, 'edit', { commentId: root.rootCommentId, body: 'Правка root\n' });
  assert.deepEqual(result.state.threads[0].messages[0].provenance, provenance);
  result = apply(result, 'edit', { commentId: replyId, body: 'Правка ответа  ' });
  assert.equal(result.state.threads[0].messages[1].body, 'Правка ответа  ');
  result = apply(result, 'resolve'); assert.equal(result.state.threads[0].status, 'resolved');
  assert.throws(() => apply(result, 'reply', { body: 'not open' }), /COMMENT_REPLY_UNAVAILABLE/);
  result = apply(result, 'reopen');
  result = apply(result, 'reanchor', { anchor: { paragraphIndex: 0, startUtf16: 0, selectedText: 'Before' } });
  assert.equal(result.state.threads[0].anchor.selectedText, 'Before');
  result = apply(result, 'delete'); assert.equal(result.state.threads[0].status, 'deleted');
  assert.equal(result.state.threads[0].messages.length, 2); // Recoverable tombstone, not purge.
});

test('state and scene CAS, foreign thread, untrusted path, empty body and grapheme split fail before a delta exists', () => {
  const result = create(); const before = result.afterText;
  const base = intent(before, 'reply', { threadId: result.threadId, body: 'Reply' });
  for (const [change, reason] of [
    [{ expectedStateSha256: 'f'.repeat(64) }, /COMMENT_STATE_CONFLICT/],
    [{ expectedSceneSha256: 'e'.repeat(64) }, /COMMENT_IDENTITY_STALE/],
    [{ projectId: 'foreign' }, /COMMENT_IDENTITY_STALE/],
    [{ threadId: 'foreign' }, /COMMENT_TARGET_INVALID/],
    [{ statePath: '/tmp/not-authority' }, /COMMENT_INPUT_INVALID/],
    [{ body: '   ' }, /COMMENT_BODY_INVALID/],
    [{ body: 'x'.repeat(16385) }, /COMMENT_BODY_INVALID/],
  ]) assert.throws(() => model.planCommentAuthoring({ ...context, beforeText: before, input: { ...base, ...change } }), reason);
  assert.throws(() => apply(result, 'reanchor', { anchor: { paragraphIndex: 0, startUtf16: 20, selectedText: '👩' } }), /COMMENT_ANCHOR_GRAPHEME/);
  assert.equal(result.afterText, before);
});

test('same operation is idempotent only on its exact resulting revision, different payload is a conflict', () => {
  const input = intent(null, 'create', { body: 'root', anchor: { paragraphIndex: 0, startUtf16: 7, selectedText: 'anchor' } }, 'stable-op');
  const one = model.planCommentAuthoring({ ...context, beforeText: null, input });
  const replay = model.planCommentAuthoring({ ...context, beforeText: one.afterText, input });
  assert.equal(replay.replay, true); assert.equal(replay.afterText, one.afterText);
  assert.throws(() => model.planCommentAuthoring({ ...context, beforeText: one.afterText, input: { ...input, body: 'different' } }), /COMMENT_REPLAY_CONFLICT/);
  const two = apply(one, 'resolve');
  assert.throws(() => model.planCommentAuthoring({ ...context, beforeText: two.afterText, input }), /COMMENT_REPLAY_CONFLICT/);
});

const runtimePromise = import(pathToFileURL(path.resolve(__dirname, '../../src/io/revisionBridge/reviewTransportNonTextReturnRuntime.mjs')).href);
const stateRelative = '.yalken/word-review/non-text-return-state.v1.json';
async function disk(t) {
  const projectRoot = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'word-authoring-')));
  t.after(() => fs.rmSync(projectRoot, { recursive: true, force: true }));
  const statePath = path.join(projectRoot, stateRelative);
  return { projectRoot, statePath, runtime: await runtimePromise };
}

test('real atomic writer persists exact state plus readable before state; repeat invocation does not duplicate', async t => {
  const { projectRoot, statePath, runtime } = await disk(t);
  let checks = 0;
  const ports = { publish: operation => operation(), revalidate: async () => { checks++; } };
  const input = intent(null, 'create', { body: 'first', anchor: { paragraphIndex: 0, startUtf16: 7, selectedText: 'anchor' } }, 'disk-op');
  const call = { ...context, projectRoot, input };
  const first = await runtime.commitCommentAuthoring(call, ports);
  const raw = fs.readFileSync(statePath, 'utf8'); assert.equal(hash(raw), first.stateSha256);
  const before = JSON.parse(fs.readFileSync(path.join(projectRoot, '.yalken/recovery/non-text-return-state.v1.json')));
  assert.deepEqual(before.threads, []); assert.ok(checks >= 3);
  assert.equal((await runtime.commitCommentAuthoring(call, ports)).replay, true);
  assert.equal(fs.readFileSync(statePath, 'utf8'), raw);
});

test('lost lease, stale state after recovery and symlink or hardlink state never publish canonical changes', async t => {
  const { projectRoot, statePath, runtime } = await disk(t);
  const initial = create(); fs.mkdirSync(path.dirname(statePath), { recursive: true }); fs.writeFileSync(statePath, initial.afterText);
  const input = intent(initial.afterText, 'resolve', { threadId: initial.threadId });
  const call = { ...context, projectRoot, input };
  await assert.rejects(runtime.commitCommentAuthoring(call, { publish: operation => operation(), revalidate: async () => { throw Error('LEASE_LOST'); } }), /LEASE_LOST/);
  assert.equal(fs.readFileSync(statePath, 'utf8'), initial.afterText);
  const foreign = initial.afterText.replace('Literal', 'foreign');
  await assert.rejects(runtime.commitCommentAuthoring(call, { publish: operation => operation(), revalidate: async () => {},
    atomicWriter: async (target, text) => { fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, text); fs.writeFileSync(statePath, foreign); } }), /COMMENT_STATE_CONFLICT/);
  assert.equal(fs.readFileSync(statePath, 'utf8'), foreign);
  fs.renameSync(statePath, statePath + '.original'); fs.symlinkSync(statePath + '.original', statePath);
  await assert.rejects(runtime.readCommentAuthoringState({ projectRoot, projectId: 'p1' }), /COMMENT_STATE_PATH_UNSAFE/);
  fs.unlinkSync(statePath); fs.linkSync(statePath + '.original', statePath);
  await assert.rejects(runtime.readCommentAuthoringState({ projectRoot, projectId: 'p1' }), /COMMENT_STATE_PATH_UNSAFE/);
});

test('failure before canonical rename keeps the old graph and readable recovery, failure after rename yields complete new graph', async t => {
  const { projectRoot, statePath, runtime } = await disk(t);
  const initial = create();fs.mkdirSync(path.dirname(statePath), { recursive: true });fs.writeFileSync(statePath, initial.afterText);
  const input = intent(initial.afterText, 'resolve', { threadId: initial.threadId });
  const call = { ...context, projectRoot, input };
  for (const afterWrite of [false, true]) {
    fs.writeFileSync(statePath, initial.afterText);
    await assert.rejects(runtime.commitCommentAuthoring(call, { publish: operation => operation(), revalidate: async () => {}, atomicWriter: async (target, text) => {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      if (target === statePath && !afterWrite) throw Error('FAULT_BEFORE');
      fs.writeFileSync(target, text);
      if (target === statePath) throw Error('FAULT_AFTER');
    } }), /FAULT_/);
    const graph = JSON.parse(fs.readFileSync(statePath));
    assert.equal(graph.threads[0].status, afterWrite ? 'resolved' : 'open');
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(projectRoot, '.yalken/recovery/non-text-return-state.v1.json'))), initial.state);
  }
});

test('actual main handler captures committed scene and rejects forged identity, unsaved changes and lifecycle switches', async t => {
  const { projectRoot, statePath, runtime } = await disk(t);
  const scenePath = path.join(projectRoot, 'roman/a.txt'); fs.mkdirSync(path.dirname(scenePath), { recursive: true }); fs.writeFileSync(scenePath, scene);
  const source = fs.readFileSync(path.resolve(__dirname, '../../src/main.js'), 'utf8');
  const fragment = source.slice(source.indexOf('// Ordinary comment authoring uses committed scene truth'), source.indexOf('async function handleRtkRootCommentReturnCommandSurface'));
  const vm = require('node:vm');
  let switchDuringCapture = false, unsaved = false;
  const sandbox = { crypto, path, fs: fs.promises, isDirty: false, autoSaveInProgress: false,
    currentFilePath: scenePath, lastSignaledEditGeneration: 0, currentLifecycleSubjectId: () => 'subject1',
    isAllowedFilePath: p => p === scenePath, getDocumentContextFromPath: () => ({ kind: 'scene' }),
    readReviewExactTextApplyProjectBinding: async () => ({ ok: true, projectRoot, projectId: 'p1' }),
    loadDocumentContentEnvelopeModule: async () => ({ parseObservablePayload: value => ({ text: value, doc: null }) }),
    computeHash: hash, canonicalizeComparableValue: value => value, normalizeRtkNonTextReturnThreadProjection: value => value,
    loadRtkNonTextReturnModule: async () => runtime, queueDiskOperation: operation => operation(),
    getMainProjectManifestAuthority: async () => ({ withProjectLease: (_id, operation) => operation({ assertOwned: async () => {}, publish: op => op() }) }),
    requestEditorSnapshot: async () => { if (switchDuringCapture) sandbox.currentFilePath = '/other/scene.txt'; return { content: unsaved ? 'not saved' : scene, generation: 0 }; },
  };
  const ctx = vm.createContext(sandbox); vm.runInContext(fragment, ctx);
  const projection = await ctx.readCommentAuthoringProjection(); assert.equal(projection.available, true);
  const input = { ...intent(null, 'create', { body: 'main-owned', anchor: { paragraphIndex: 0, startUtf16: 7, selectedText: 'anchor' } }), subjectId: projection.subjectId };
  assert.equal((await ctx.handleCommentAuthoringCommand({ ...input, projectId: 'forged' })).ok, false); assert.equal(fs.existsSync(statePath), false);
  unsaved = true; assert.equal((await ctx.handleCommentAuthoringCommand(input)).reason, 'COMMENT_SAVE_SCENE_FIRST'); assert.equal(fs.existsSync(statePath), false);
  unsaved = false; switchDuringCapture = true; assert.equal((await ctx.handleCommentAuthoringCommand(input)).reason, 'COMMENT_SCENE_CHANGED'); assert.equal(fs.existsSync(statePath), false);
  switchDuringCapture = false; sandbox.currentFilePath = scenePath;
  const result = await ctx.handleCommentAuthoringCommand(input); assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(JSON.parse(fs.readFileSync(statePath)).threads[0].messages[0].body, 'main-owned');
});

test('authored root and reply body/status/anchor survive actual DOCX serialization and independent existing parser', async () => {
  const { buildFullManuscriptDocxReviewPacketSource } = require('../../src/export/docx/fullManuscriptDocxReviewPacketSource.js');
  const { buildDocxReviewPacketBuffer } = require('../../src/export/docx/docxReviewPacketBuilder.js');
  const bridge = await import('../../src/io/revisionBridge/index.mjs');
  let result = create();result = apply(result, 'reply', { body: 'Ответ\nточный' });
  result = apply(result, 'edit', { commentId: result.state.threads[0].rootCommentId, body: 'Изменённый root' });
  result = apply(result, 'reanchor', { anchor: { paragraphIndex: 0, startUtf16: 0, selectedText: 'Before' } });
  result = apply(result, 'resolve');
  const source = buildFullManuscriptDocxReviewPacketSource({ projectId: 'p1', projectRoot: '/synthetic',
    scenes: [{ sceneId: 'roman/a.txt', scenePath: '/synthetic/roman/a.txt', text: scene, observableContent: scene, order: 0 }], nonTextReturnState: result.state });
  const readback = bridge.buildDocxReviewTransportAnalysisFromZipBytes({ bytes: buildDocxReviewPacketBuffer(source) },
    { cryptoPort: { sha256Text: hash, sha256Json: value => 'sha256:' + hash(JSON.stringify(value)), byteLength: value => Buffer.byteLength(value) } });
  assert.equal(readback.ok, true);const root = readback.reviewIr.commentThreads[0];
  assert.equal(root.body, 'Изменённый root');assert.equal(root.quotedAnchorText, 'Before');
  assert.equal(root.authorPersonIdentity.author, 'Автор Yalken');assert.equal(root.replies[0].body, 'Ответ\nточный');
});

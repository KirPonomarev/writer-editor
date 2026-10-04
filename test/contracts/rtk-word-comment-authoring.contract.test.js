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

for (const nativeDefaults of [false, true]) test(`actual main handler captures committed scene and rejects forged identity, unsaved changes and lifecycle switches; native defaults=${nativeDefaults}`, async t => {
  const { projectRoot, statePath, runtime } = await disk(t);
  const envelope = require('../../src/core/document-content-envelope-v1.cjs');
  const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: scene, marks: [{ type: 'textStyle', attrs: { fontFamily: 'Aptos', fontSize: '12pt' } }] }] }] };
  const liveDoc = structuredClone(doc); liveDoc.content[0].attrs = { textAlign: null }; liveDoc.content[0].content[0].marks[0].attrs.color = null;
  const sceneRaw = nativeDefaults ? envelope.composeObservablePayload({ doc }) : scene;
  const liveRaw = nativeDefaults ? envelope.composeObservablePayload({ doc: liveDoc }) : scene;
  const scenePath = path.join(projectRoot, 'roman/a.txt'); fs.mkdirSync(path.dirname(scenePath), { recursive: true }); fs.writeFileSync(scenePath, sceneRaw);
  const source = fs.readFileSync(path.resolve(__dirname, '../../src/main.js'), 'utf8');
  const fragment = source.slice(source.indexOf('// Ordinary comment authoring uses committed scene truth'), source.indexOf('async function handleRtkRootCommentReturnCommandSurface'));
  const vm = require('node:vm');
  let switchDuringCapture = false, unsaved = false;
  const sandbox = { crypto, path, fs: fs.promises, isDirty: false, autoSaveInProgress: false,
    currentFilePath: scenePath, lastSignaledEditGeneration: 0, currentLifecycleSubjectId: () => 'subject1',
    isAllowedFilePath: p => p === scenePath, getDocumentContextFromPath: () => ({ kind: 'scene' }),
    readReviewExactTextApplyProjectBinding: async () => ({ ok: true, projectRoot, projectId: 'p1' }),
    loadDocumentContentEnvelopeModule: async () => envelope,
    commentSceneParagraphs: require('../../src/core/word-comment-anchor-save-v1.cjs').paragraphs,
    userBookmarkModel: require('../../src/core/word-user-bookmarks-v1.cjs'),
    computeHash: hash, canonicalizeComparableValue: value => value, normalizeRtkNonTextReturnThreadProjection: value => value,
    loadRtkNonTextReturnModule: async () => runtime, queueDiskOperation: operation => operation(),
    getMainProjectManifestAuthority: async () => ({ withProjectLease: (_id, operation) => operation({ assertOwned: async () => {}, publish: op => op() }) }),
    requestEditorSnapshot: async () => { if (switchDuringCapture) sandbox.currentFilePath = '/other/scene.txt'; return { content: unsaved ? 'not saved' : liveRaw, generation: 0 }; },
  };
  const ctx = vm.createContext(sandbox); vm.runInContext(fragment, ctx);
  const kernel = require('../../src/command/commandSurfaceKernel.js').createCommandSurfaceKernel({ [model.COMMAND_ID]: ctx.handleCommentAuthoringCommand });
  const command = payload => kernel.dispatch(model.COMMAND_ID, payload);
  const projection = await ctx.readCommentAuthoringProjection(); assert.equal(projection.available, true);
  const input = { ...intent(null, 'create', { body: 'main-owned', anchor: { paragraphIndex: 0, startUtf16: 7, selectedText: 'anchor' } }), subjectId: projection.subjectId, expectedSceneSha256: hash(sceneRaw) };
  assert.equal((await command({ ...input, projectId: 'forged' })).ok, false); assert.equal(fs.existsSync(statePath), false);
  unsaved = true; assert.equal((await command(input)).error.reason, 'COMMENT_SAVE_SCENE_FIRST'); assert.equal(fs.existsSync(statePath), false);
  unsaved = false; switchDuringCapture = true; assert.equal((await command(input)).error.reason, 'COMMENT_SCENE_CHANGED'); assert.equal(fs.existsSync(statePath), false);
  switchDuringCapture = false; sandbox.currentFilePath = scenePath;
  const result = await command(input); assert.equal(result.ok, true, JSON.stringify(result));
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


test('pending comment draft and publication veto unload; empty state permits close and veto resets main lifecycle flags', () => {
  const vm = require('node:vm');
  const editor = fs.readFileSync(path.resolve(__dirname, '../../src/renderer/editor.js'), 'utf8');
  const start = editor.indexOf('function guardWordCommentDraftUnload(event) {');
  const end = editor.indexOf('function renderWordCommentAuthoring(projection)', start);
  let listener, renders = 0;
  const ctx = vm.createContext({ wordCommentDraft: null, wordCommentBusy: false, wordCommentNotice: '',
    renderReviewSurface: () => { renders++; }, window: { addEventListener: (name, fn) => { assert.equal(name, 'beforeunload'); listener = fn; } } });
  vm.runInContext(editor.slice(start, end), ctx);
  for (const [draft, busy, blocked] of [[null, false, false], [{body:'do not lose'}, false, true], [null, true, true]]) {
    ctx.wordCommentDraft = draft; ctx.wordCommentBusy = busy;
    let prevented = false; const event = { preventDefault() { prevented = true; }, stopImmediatePropagation() { this.cleanupStopped = true; } };
    listener(event); assert.equal(prevented, blocked); assert.equal(event.returnValue, blocked ? false : undefined);
    assert.equal(event.cleanupStopped, blocked ? true : undefined);
    assert.equal(ctx.wordCommentDraft, draft); // Closing never discards or commits authoring.
  }
  assert.equal(renders, 2);
  const main = fs.readFileSync(path.resolve(__dirname, '../../src/main.js'), 'utf8');
  const a = main.indexOf("  mainWindow.webContents.on('will-prevent-unload',");
  const b = main.indexOf("  mainWindow.on('closed',", a);
  let veto; const mainCtx = vm.createContext({ isWindowClosing: true, isQuitting: true, updateStatus: () => {},
    mainWindow: { webContents: { on: (name, fn) => { assert.equal(name, 'will-prevent-unload'); veto = fn; } } } });
  vm.runInContext(main.slice(a, b), mainCtx);
  veto({ preventDefault() { assert.fail('must not override authoring veto'); } });
  assert.equal(mainCtx.isWindowClosing, false); assert.equal(mainCtx.isQuitting, false);
});


test('actual lifecycle confirmation vetoes pending comment authoring before document replacement without changing saved text', async () => {
  const vm = require('node:vm');
  const main = fs.readFileSync(path.resolve(__dirname, '../../src/main.js'), 'utf8');
  const a = main.indexOf('async function confirmDiscardChanges() {');
  const b = main.indexOf('async function ensureCleanAction', a);
  let pending = true, subject = 'scene1', barrierCalls = 0;
  const ctx = vm.createContext({ mainWindow: {}, currentLifecycleSubjectId: () => subject,
    autoSave: async () => ({ok:true, ack:{kind:'SAVED'}, subjectId:subject}),
    requestEditorSnapshot: async () => ({commentAuthoringPending:pending}), updateStatus: () => {},
    evaluateLifecycleBarrier: () => { barrierCalls++;return {allowed:true}; }, LIFECYCLE_EVENTS:{QUIT:'QUIT'},
    lastSignaledEditGeneration:0,lastAcknowledgedEditGeneration:0,createSaveReceipt: x=>x,createDetachedOutboxObservation:x=>x });
  vm.runInContext(main.slice(a,b),ctx);
  assert.equal(await ctx.confirmDiscardChanges(),false);assert.equal(barrierCalls,0);
  pending=false;assert.equal(await ctx.confirmDiscardChanges(),true);assert.equal(barrierCalls,1);
  ctx.requestEditorSnapshot=async()=>{subject='scene2';return {commentAuthoringPending:false};};
  assert.equal(await ctx.confirmDiscardChanges(),false);assert.equal(barrierCalls,1);
  const editor=fs.readFileSync(path.resolve(__dirname,'../../src/renderer/editor.js'),'utf8');
  const sa=editor.indexOf('function composeEditorSnapshot() {'), sb=editor.indexOf('function applyIncomingBookProfile',sa);
  const snapshotCtx=vm.createContext({getTiptapCommentEditIntentsJson:()=>null,isTiptapMode:true,getTiptapImageInsertionPosition:()=>6,currentTreeContentPublicationId:'',getTiptapRootSplitBoundary:()=>null,composeDocumentContent:()=> 'saved text',getPlainText:()=> 'saved text',getActiveBookProfile:()=>null,getSelectionOffsets:()=>({start:0,end:0}),localEditGeneration:2,wordCommentDraft:{body:'unsaved reply'},wordCommentBusy:false,storyDrafts: new Map(), storyMutationPending: false, pendingStoryRequestId: null, manuscriptDrafts:new Map(),notesMutationPending:false});
  vm.runInContext(editor.slice(sa,sb),snapshotCtx);assert.equal(snapshotCtx.composeEditorSnapshot().commentAuthoringPending,true);
  snapshotCtx.wordCommentDraft=null;assert.equal(snapshotCtx.composeEditorSnapshot().commentAuthoringPending,false);
  snapshotCtx.wordCommentBusy=true;assert.equal(snapshotCtx.composeEditorSnapshot().commentAuthoringPending,true);
  const na=main.indexOf('function normalizeEditorSnapshotPayload(payload) {'),nb=main.indexOf('function requestEditorSnapshot',na);
  const norm=vm.createContext({isPlainObjectValue:x=>x!==null&&typeof x==='object',normalizeSelectionRangeForSettings:x=>x});vm.runInContext(main.slice(na,nb),norm);
  assert.equal(norm.normalizeEditorSnapshotPayload({content:'saved',commentAuthoringPending:true}).commentAuthoringPending,true);
  assert.equal(norm.normalizeEditorSnapshotPayload({content:'saved',commentAuthoringPending:'false'}).commentAuthoringPending,false);
});

test('local individual reply deletion archives exact history, preserves peers and cannot delete root through reply intent', () => {
  let result = apply(create(), 'reply', { body: 'first reply' });
  const first = result.state.threads[0].messages[1];
  result = apply(result, 'reply', { body: 'second reply' });
  const before = result, root = before.state.threads[0].messages[0], second = before.state.threads[0].messages[2];
  assert.throws(() => apply(before, 'delete', { commentId: root.commentId }), /REPLY_TARGET_INVALID/);
  assert.throws(() => apply(before, 'delete', { commentId: 'foreign' }), /REPLY_TARGET_INVALID/);
  result = apply(before, 'delete', { commentId: first.commentId });
  assert.deepEqual(result.state.threads[0].messages, [root, second]);
  assert.deepEqual(result.state.threads[0].deletedMessages, [first]);
  assert.equal(result.state.threads[0].status, 'open');
  assert.throws(() => apply(result, 'edit', { commentId: first.commentId, body: 'revived' }), /MESSAGE_UNKNOWN/);
  assert.throws(() => apply(result, 'delete', { commentId: first.commentId }), /REPLY_TARGET_INVALID/);
  const corrupt = structuredClone(result.state); corrupt.threads[0].deletedMessages.push(root);
  assert.throws(() => model.readState(JSON.stringify(corrupt), 'p1'), /STATE_INVALID/);
  const invalidRoot = structuredClone(result.state); invalidRoot.threads[0].deletedMessages[0].kind = 'root';
  assert.throws(() => model.readState(JSON.stringify(invalidRoot), 'p1'), /STATE_INVALID/);
});

function replyUiHarness(saved = apply(create(), 'reply', { body: 'Reply to remove' })) {
  const vm = require('node:vm');
  const source = fs.readFileSync(path.resolve(__dirname, '../../src/renderer/editor.js'), 'utf8');
  const fragment = source.slice(source.indexOf('function renderWordCommentAuthoring(projection)'),
    source.indexOf('function reviewSurfaceNormalizeState(input'));
  const projection = { available: true, ...intent(saved.afterText, 'delete'), threads: saved.state.threads };
  const calls = []; let current = saved, focused = 0;
  const sandbox = { wordCommentDraft: null, wordCommentBusy: false, wordCommentNotice: '', wordCommentEditor: null,
    renderCommentBodyHtml: message => message.body,
    commentBodyDocumentForEditor: message => require('../../src/core/word-comment-body-v1.cjs').commentBodyDocument(message),
    reviewSurfaceState: { commentAuthoring: projection }, crypto,
    reviewSurfaceArray: v => Array.isArray(v) ? v : [],
    reviewSurfaceEscapeHtml: value => String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]),
    renderReviewSurface: () => {}, document: { getElementById: () => ({ focus: () => { focused++; } }) },
    reviewSurfaceUnwrapCommandResult: value => value,
    loadReviewSurfaceFromQuery: async () => {},
    invokePreloadUiCommandBridge: async (id, input) => {
      calls.push({ id, input: JSON.parse(JSON.stringify(input)) });
      try { current = model.planCommentAuthoring({ ...context, beforeText: current.afterText, input }); return { ok: true }; }
      catch (error) { return { ok: false, reason: error.message }; }
    },
  };
  const ctx = vm.createContext(sandbox); vm.runInContext(fragment, ctx);
  const button = (action = 'deleteReply', commentId = saved.state.threads[0].messages[1].commentId, threadId = saved.threadId) =>
    ({ disabled: false, dataset: { wordCommentAction: action, commentId, threadId } });
  return { ctx, calls, projection, button, state: () => current, focused: () => focused,
    advance: () => { current = apply(current, 'edit', { commentId: current.state.threads[0].rootCommentId, body: 'Concurrent root edit' }); } };
}

test('ordinary renderer reply deletion dispatches exact identity through existing command and preserves root/history', async () => {
  const h = replyUiHarness(), before = h.state(), reply = before.state.threads[0].messages[1];
  const html = h.ctx.renderWordCommentAuthoring(h.projection);
  assert.equal((html.match(/data-word-comment-action="deleteReply"/g) || []).length, 1);
  assert.match(html, /Удалить ответ/); assert.match(html, /Удалить обсуждение/);
  await h.ctx.handleWordCommentAction(h.button());
  assert.equal(h.calls.length, 1); assert.equal(h.calls[0].id, model.COMMAND_ID);
  assert.equal(h.calls[0].input.action, 'delete'); assert.equal(h.calls[0].input.commentId, reply.commentId);
  assert.equal(h.calls[0].input.expectedStateSha256, hash(before.afterText));
  assert.deepEqual(h.state().state.threads[0].messages, [before.state.threads[0].messages[0]]);
  assert.deepEqual(h.state().state.threads[0].deletedMessages, [reply]);
  assert.equal(h.state().state.threads[0].status, 'open');
});

test('missing, foreign, archived and root reply targets never fall back to whole-thread deletion', async () => {
  for (const target of ['missing', 'empty', 'foreign', 'root', 'thread', 'archived']) {
    const h = replyUiHarness(), before = h.state().afterText, button = h.button();
    if (target === 'missing') delete button.dataset.commentId;
    if (target === 'empty') button.dataset.commentId = '';
    if (target === 'foreign') button.dataset.commentId = 'not-a-reply';
    if (target === 'root') button.dataset.commentId = h.state().state.threads[0].rootCommentId;
    if (target === 'thread') button.dataset.threadId = 'foreign-thread';
    if (target === 'archived') h.projection.threads = [{ ...h.projection.threads[0], messages: h.projection.threads[0].messages.slice(0, 1) }];
    await h.ctx.handleWordCommentAction(button);
    assert.equal(h.calls.length, 0, target); assert.equal(h.state().afterText, before, target);
    assert.match(h.ctx.wordCommentNotice, /ответ больше недоступен/);
  }
});

test('reply UI protects drafts and busy state; stale projection is rejected by real Core without losing concurrent edits', async () => {
  for (const blocked of ['draft', 'busy', 'disabled', 'unavailable']) {
    const h = replyUiHarness(), button = h.button(), before = h.state().afterText;
    const draft = { binding: { subjectId: h.projection.subjectId }, action: 'reply', body: 'Unsent body' };
    if (blocked === 'draft') h.ctx.wordCommentDraft = draft;
    if (blocked === 'busy') h.ctx.wordCommentBusy = true;
    if (blocked === 'disabled') button.disabled = true;
    if (blocked === 'unavailable') h.projection.available = false;
    await h.ctx.handleWordCommentAction(button);
    assert.equal(h.calls.length, 0, blocked); assert.equal(h.state().afterText, before, blocked);
    if (blocked === 'draft') { assert.equal(h.ctx.wordCommentDraft, draft); assert.equal(h.focused(), 1); }
    if (blocked === 'busy') assert.match(h.ctx.renderWordCommentAuthoring(h.projection), /data-word-comment-action="deleteReply"[^>]*disabled/);
  }
  const h = replyUiHarness(); h.advance(); const concurrent = h.state().afterText;
  await h.ctx.handleWordCommentAction(h.button());
  assert.equal(h.calls.length, 1); assert.match(h.ctx.wordCommentNotice, /COMMENT_STATE_CONFLICT/);
  assert.equal(h.state().afterText, concurrent); assert.equal(h.ctx.wordCommentBusy, false);
});


test('comment snapshot equality admits only declared null defaults and preserves substantive differences', async () => {
  const { commentSceneSnapshotsEqual: equal } = await runtimePromise;
  const original = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'якорь', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Aptos', fontSize: '12pt' } }] }] }] };
  const opened = structuredClone(original); opened.content[0].attrs = { textAlign: null };
  opened.content[0].content[0].marks[0].attrs.color = null;
  const preserved = JSON.stringify(original);
  assert(equal(original, opened)); assert(equal(opened, original));
  for (const mutate of [
    d => { d.content[0].attrs.textAlign = 'right'; },
    d => { d.content[0].attrs.unknown = null; },
    d => { d.content[0].content[0].marks[0].attrs.color = '#ff0000'; },
    d => { d.content[0].content[0].marks[0].attrs.fontFamily = 'Arial'; },
    d => { d.content[0].content[0].marks[0].attrs.fontSize = '14pt'; },
    d => { d.content[0].content[0].marks.push({ type: 'bold' }); },
    d => { d.content[0].content[0].text += ' '; },
    d => { d.content.push({ type: 'paragraph' }); },
    d => { d.content[0].type = 'heading'; },
  ]) { const changed = structuredClone(opened); mutate(changed); assert(!equal(original, changed)); assert(!equal(changed, original)); }
  assert(!equal('якорь', original)); assert(!equal({ type: 'unknown' }, { type: 'unknown', attrs: { textAlign: null } }));
  assert.equal(JSON.stringify(original), preserved);
});

test('actual full editor schema roundtrip preserves imported scene authority while only materializing declared root nulls', async () => {
  const { getSchema } = await import('@tiptap/core');
  const { default: StarterKit } = await import('@tiptap/starter-kit');
  const { default: Color } = await import('@tiptap/extension-color');
  const { default: Highlight } = await import('@tiptap/extension-highlight');
  const { default: Underline } = await import('@tiptap/extension-underline');
  const envelope = require('../../src/core/document-content-envelope-v1.cjs');
  const { commentSceneSnapshotsEqual: equal } = await runtimePromise;
  const exports = {documentStories:['DocumentStories'],documentSections:['DocumentSections'],documentBreaks:['DocumentBreaks'],documentListNumbering:['DocumentListNumbering'],documentListItems:['DocumentListItems'],documentHeadings:['DocumentHeadings'],wordPendingRevisions:['WordPendingRevisions'],userBookmarks:['UserBookmarks','UserBookmarkLink'],documentTextStyle:['DocumentTextStyle'],documentParagraphAlignment:['DocumentParagraphAlignment'],documentTables:['DocumentTables'],documentMedia:['DocumentMedia'],manuscriptNotes:['ManuscriptNoteReferences']};
  const extensions=[StarterKit.configure({trailingNode:false,heading:false,listItem:false,hardBreak:false,link:false,underline:false})];
  for (const [file,names] of Object.entries(exports)) { const mod=await import(`../../src/renderer/tiptap/${file}.mjs`); for(const name of names)extensions.push(mod[name]); }
  extensions.push(Color,Highlight.configure({multicolor:true}),Underline);
  const doc={type:'doc',attrs:{wordDefaultTabStop:708},content:[{type:'paragraph',attrs:{wordParagraphMarkLanguage:{val:'en-US',eastAsia:'ru-RU',bidi:'ar-SA'},wordParagraphSpacing:{after:160,line:278,lineRule:'auto'}},content:[{type:'text',text:'Rich comment anchor.',marks:[{type:'textStyle',attrs:{fontFamily:'Times New Roman',fontSize:'12pt',wordLanguage:{val:'en-US',eastAsia:'ru-RU',bidi:'ar-SA'}}}]}]}]};
  const bytes=envelope.composeObservablePayload({doc});
  const before=envelope.parseObservablePayload(bytes).doc;
  const opened=envelope.parseObservablePayload(envelope.composeObservablePayload({doc:getSchema(extensions).nodeFromJSON(before).toJSON()})).doc;
  assert.equal(opened.attrs.wordPendingRevisions,null);assert.equal(opened.attrs.wordUserBookmarks,null);
  assert(equal(before,opened));assert(equal(opened,before));
  for(const mutate of [
    d=>{d.attrs.wordPendingRevisions={schemaVersion:'yalken.word.pending-revisions.v1',revisions:[]};},
    d=>{d.attrs.wordUserBookmarks={schemaVersion:'yalken.word.user-bookmarks.v1',bookmarks:[]};},
    d=>{d.attrs.foreign=null;},d=>{d.attrs.wordDefaultTabStop=720;},
    d=>{d.content[0].attrs.wordParagraphSpacing.after=161;},
    d=>{d.content[0].attrs.wordParagraphIndent={left:0};},
    d=>{d.content[0].attrs.wordParagraphTabs=[{pos:720,val:'left'}];},
    d=>{d.content[0].attrs.wordParagraphMarkLanguage.val='ru-RU';},
    d=>{d.content[0].content[0].marks[0].attrs.wordLanguage.val='ru-RU';},
    d=>{d.content[0].content[0].marks.push({type:'underline'});},
  ]) {const changed=structuredClone(opened);mutate(changed);assert(!equal(before,changed));assert(!equal(changed,before));}
  assert.equal(envelope.composeObservablePayload({doc}),bytes);
});

test('actual editor reopen joins identical native Word text runs without invalidating saved scene authority',async()=>{
  const {Editor}=await import('@tiptap/core'),{default:StarterKit}=await import('@tiptap/starter-kit');
  const {DocumentTextStyle}=await import('../../src/renderer/tiptap/documentTextStyle.mjs');
  const {DocumentParagraphAlignment}=await import('../../src/renderer/tiptap/documentParagraphAlignment.mjs');
  const {DocumentListNumbering}=await import('../../src/renderer/tiptap/documentListNumbering.mjs');
  const {WordPendingRevisions}=await import('../../src/renderer/tiptap/wordPendingRevisions.mjs');
  const {UserBookmarks}=await import('../../src/renderer/tiptap/userBookmarks.mjs');
  const {commentSceneSnapshotsEqual:equal}=await runtimePromise;
  const language={val:'ru-FI',eastAsia:'ru-RU',bidi:'ar-SA'};
  const marks=[{type:'textStyle',attrs:{fontFamily:'Times New Roman',wordLanguage:language}}];
  const original={type:'doc',content:[{type:'orderedList',attrs:{start:4,type:'1',wordNumbering:{schemaVersion:1,instanceId:'native',level:0,levels:[{format:'1',start:4,text:'Item %1)',restartAfterLevel:null}]}},content:[{type:'listItem',content:[{type:'paragraph',attrs:{wordParagraphSpacing:{after:160,line:278,lineRule:'auto'},wordParagraphMarkLanguage:language},content:[{type:'text',text:' Structural fourth',marks:structuredClone(marks)},{type:'text',text:' native-continuation-11',marks:structuredClone(marks)}]}]}]}]};
  const bytes=JSON.stringify(original);
  const editor=new Editor({element:null,extensions:[StarterKit.configure({trailingNode:false}),DocumentTextStyle,DocumentParagraphAlignment,DocumentListNumbering,WordPendingRevisions,UserBookmarks],content:original});
  try {
    const envelope=require('../../src/core/document-content-envelope-v1.cjs');
    const opened=envelope.parseObservablePayload(envelope.composeObservablePayload({doc:editor.getJSON()})).doc;
    assert.equal(opened.content[0].content[0].content[0].content.length,1,'real ProseMirror merges the two identical runs');
    assert.equal(equal(original,opened),true,JSON.stringify({original,opened}));assert.equal(equal(opened,original),true);
    assert.equal(JSON.stringify(original),bytes,'comparison cannot mutate persisted input');
    const changed=structuredClone(opened);changed.content[0].content[0].content[0].content[0].text+=' user edit';
    assert.equal(equal(original,changed),false);
  } finally {editor.destroy();}
});

test('snapshot run equivalence is confined to adjacent identical leaves in document inline content',async()=>{
  const {commentSceneSnapshotsEqual:equal}=await runtimePromise;
  const leaf=(text,attrs={fontFamily:'Aptos'})=>({type:'text',text,marks:[{type:'textStyle',attrs}]});
  const doc=content=>({type:'doc',content:[{type:'paragraph',content}]});
  const original=doc([leaf('A'),leaf('B')]),joined=doc([leaf('AB')]);
  assert(equal(original,joined));
  for(const content of [
    [leaf('A'),leaf('B',{fontFamily:'Arial'})],
    [leaf('A',{fontFamily:'Aptos',color:null}),leaf('B',{fontFamily:'Aptos',color:''})],
    [leaf('A'),{...leaf('B'),unknown:'retained'}],
    [leaf('A'),{...leaf('B'),marks:[...leaf('B').marks,{type:'bold'}]}],
    [leaf('A'),{type:'hardBreak'},leaf('B')],
    [leaf('B'),leaf('A')],
  ])assert.equal(equal(doc(content),joined),false,JSON.stringify(content));
  for(const key of ['id','foreign','attrs'])assert.equal(equal(doc([{...leaf('A'),[key]:'same'},{...leaf('B'),[key]:'same'}]),doc([{...leaf('AB'),[key]:'same'}])),false,'unknown leaf identity cannot lose an occurrence: '+key);
  assert.equal(equal({type:'doc',content:[{type:'paragraph',content:[leaf('A')]},{type:'paragraph',content:[leaf('B')]}]},joined),false);
  for(const key of ['attrs','marks','foreign']){
    const a=structuredClone(joined),b=structuredClone(joined);
    a[key]={type:'paragraph',content:[leaf('A'),leaf('B')]};b[key]={type:'paragraph',content:[leaf('AB')]};
    assert.equal(equal(a,b),false,'lookalike content inside '+key+' remains exact');
  }
  const a=structuredClone(joined),b=structuredClone(joined);
  a.content[0].attrs={foreign:[leaf('A'),leaf('B')]};b.content[0].attrs={foreign:[leaf('AB')]};
  assert.equal(equal(a,b),false);
});

test('actual Main multi-paragraph authoring preserves identities across lifecycle and independently refuses foreign cell ranges', async t => {
  const {projectRoot,statePath,runtime}=await disk(t), envelope=require('../../src/core/document-content-envelope-v1.cjs');
  const paragraph=text=>({type:'paragraph',content:[{type:'text',text}]});
  let doc={type:'doc',content:[paragraph('Left same'),paragraph('Middle same'),paragraph('Right same')]};
  const scenePath=path.join(projectRoot,'roman/a.txt');fs.mkdirSync(path.dirname(scenePath),{recursive:true});
  const saveDoc=()=>fs.writeFileSync(scenePath,envelope.composeObservablePayload({doc}));saveDoc();
  const source=fs.readFileSync(path.resolve(__dirname,'../../src/main.js'),'utf8'), vm=require('node:vm');
  const sandbox={crypto,path,fs:fs.promises,isDirty:false,autoSaveInProgress:false,currentFilePath:scenePath,
    lastSignaledEditGeneration:0,currentLifecycleSubjectId:()=> 'subject1',isAllowedFilePath:p=>p===scenePath,
    getDocumentContextFromPath:()=>({kind:'scene'}),readReviewExactTextApplyProjectBinding:async()=>({ok:true,projectRoot,projectId:'p1'}),
    loadDocumentContentEnvelopeModule:async()=>envelope,userBookmarkModel:require('../../src/core/word-user-bookmarks-v1.cjs'),
    commentSceneParagraphs:require('../../src/core/word-comment-anchor-save-v1.cjs').paragraphs,computeHash:hash,
    docxReviewPreviewSessionDetailString:v=>typeof v==='string'?v:'',isPlainObjectValue:v=>v&&typeof v==='object'&&!Array.isArray(v),
    normalizeCommentProvenance:require('../../src/export/docx/docxReviewPacketComments.js').normalizeCommentProvenance,
    loadRtkNonTextReturnModule:async()=>runtime,queueDiskOperation:op=>op(),
    getMainProjectManifestAuthority:async()=>({withProjectLease:(_id,op)=>op({assertOwned:async()=>{},publish:fn=>fn()})}),
    requestEditorSnapshot:async()=>({content:fs.readFileSync(scenePath,'utf8'),generation:0})};
  const ctx=vm.createContext(sandbox);
  vm.runInContext(source.slice(source.indexOf('function normalizeRtkNonTextReturnThreadProjection('),source.indexOf('function buildRtkNonTextReturnReviewSurfaceProjection(')),ctx);
  vm.runInContext(source.slice(source.indexOf('// Ordinary comment authoring uses committed scene truth'),source.indexOf('async function handleRtkRootCommentReturnCommandSurface')),ctx);
  const kernel=require('../../src/command/commandSurfaceKernel.js').createCommandSurfaceKernel({[model.COMMAND_ID]:ctx.handleCommentAuthoringCommand});
  const dispatch=async(action,extra={})=>{
    const p=await ctx.readCommentAuthoringProjection();assert.equal(p.available,true,JSON.stringify(p));
    return kernel.dispatch(model.COMMAND_ID,{requestId:crypto.randomUUID(),action,projectId:p.projectId,sceneId:p.sceneId,subjectId:p.subjectId,
      expectedStateSha256:p.expectedStateSha256,expectedSceneSha256:p.expectedSceneSha256,...extra});
  };
  const range={kind:'multi-paragraph-range',paragraphIndex:0,startUtf16:5,endParagraphIndex:2,endUtf16:5,selectedText:'same\nMiddle same\nRight'};
  const createResult=await dispatch('create',{body:'Root literal',anchor:range});assert.equal(createResult.ok,true,JSON.stringify(createResult));
  const initial=JSON.parse(fs.readFileSync(statePath)),threadId=initial.threads[0].threadId,rootId=initial.threads[0].rootCommentId;
  const p=await ctx.readCommentAuthoringProjection();assert.deepEqual(JSON.parse(JSON.stringify(p.threads[0].anchor)),{
    sceneId:'roman/a.txt',blockId:'',paragraphIndex:0,kind:range.kind,startUtf16:5,endParagraphIndex:2,endUtf16:5,
    selectedText:range.selectedText,selectedTextSha256:hash(range.selectedText),authoritySource:'CANONICAL_LOCAL_AUTHORING',sourceChangeId:''});
  for(const [action,extra] of [['reply',{body:'Reply literal'}],['resolve',{}],['reopen',{}],
    ['reanchor',{anchor:{paragraphIndex:1,startUtf16:0,selectedText:'Middle'}}],['reanchor',{anchor:range}]]) {
    const result=await dispatch(action,{threadId,...extra});assert.equal(result.ok,true,JSON.stringify(result));
  }
  const current=JSON.parse(fs.readFileSync(statePath));assert.equal(current.threads[0].threadId,threadId);assert.equal(current.threads[0].rootCommentId,rootId);
  assert.deepEqual(current.threads[0].messages.map(m=>m.body),['Root literal','Reply literal']);
  const before=fs.readFileSync(statePath,'utf8');
  for(const anchor of [{...range,endUtf16:500},{...range,selectedText:'forged'},{...range,endParagraphIndex:0}]) {
    assert.equal((await dispatch('reanchor',{threadId,anchor})).ok,false);assert.equal(fs.readFileSync(statePath,'utf8'),before);
  }
  doc={type:'doc',content:[{type:'table',content:[{type:'tableRow',content:[{type:'tableCell',content:[paragraph('Left same')]},{type:'tableCell',content:[paragraph('Right same')]}]}]}]};saveDoc();
  const raw=fs.readFileSync(scenePath,'utf8');
  const denied=await dispatch('create',{body:'Foreign cell',anchor:{...range,endParagraphIndex:1,selectedText:'same\nRight'}});
  assert.equal(denied.ok,false);assert.match(JSON.stringify(denied),/COMMENT_ANCHOR_OWNER/);
  assert.equal(fs.readFileSync(statePath,'utf8'),before);assert.equal(fs.readFileSync(scenePath,'utf8'),raw);
});

test('legacy selection sends both endpoints through existing create/reanchor and preserves draft when context changes',async()=>{
  const vm=require('node:vm'), envelope=require('../../src/core/document-content-envelope-v1.cjs');
  const source=fs.readFileSync(path.resolve(__dirname,'../../src/renderer/editor.js'),'utf8');
  const doc={type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Left same'}]},{type:'paragraph'},{type:'paragraph',content:[{type:'text',text:'Right same'}]}]};
  const calls=[],projection={available:true,projectId:'p1',sceneId:'roman/a.txt',subjectId:'subject',expectedStateSha256:'state',expectedSceneSha256:'scene',threads:[]};
  const sandbox={isTiptapMode:false,getSelectionOffsets:()=>({start:5,end:16}),parseObservablePayload:envelope.parseObservablePayload,
    composeDocumentContent:()=>envelope.composeObservablePayload({doc}),deriveVisibleTextFromDocument:envelope.deriveVisibleTextFromDocument,
    Intl,crypto,TextEncoder,wordCommentDraft:null,wordCommentBusy:false,wordCommentNotice:'',wordCommentEditor:null,
    reviewSurfaceState:{commentAuthoring:projection},reviewSurfaceArray:x=>x||[],renderReviewSurface:()=>{},focusWordCommentDraft:()=>{},
    commentBodyDocumentForEditor:()=>({type:'doc',content:[{type:'paragraph'}]}),reviewSurfaceUnwrapCommandResult:x=>x,
    invokePreloadUiCommandBridge:async(id,input)=>{calls.push({id,input:JSON.parse(JSON.stringify(input))});return {ok:true};},loadReviewSurfaceFromQuery:async()=>{}};
  const ctx=vm.createContext(sandbox);vm.runInContext(source.slice(source.indexOf('function wordCommentSelectionIntent()'),source.indexOf('function reviewSurfaceNormalizeState(input')),ctx);
  const button=action=>({disabled:false,dataset:{wordCommentAction:action,threadId:'thread'}});
  await ctx.handleWordCommentAction(button('create'));
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.wordCommentDraft.anchor)),{kind:'multi-paragraph-range',paragraphIndex:0,startUtf16:5,endParagraphIndex:2,endUtf16:5,selectedText:'same\n\nRight'});
  projection.expectedStateSha256='changed';await ctx.handleWordCommentAction(button('save'));assert.equal(calls.length,0);assert.ok(ctx.wordCommentDraft);
  projection.expectedStateSha256='state';await ctx.handleWordCommentAction(button('save'));assert.equal(calls.length,1);assert.equal(calls[0].id,model.COMMAND_ID);assert.equal(calls[0].input.anchor.endParagraphIndex,2);
  await ctx.handleWordCommentAction(button('reanchor'));assert.equal(calls.length,2);assert.equal(calls[1].input.anchor.endUtf16,5);
});

test('actual Main private comment proof retains original signed table ancestry and Core rejects conflicting covered owners',()=>{
  const vm=require('node:vm'),ranges=require('../../src/core/word-comment-ranges-v1.cjs');
  const source=fs.readFileSync(path.resolve(__dirname,'../../src/main.js'),'utf8');
  const start=source.indexOf('const commentExportMap={...proof.exportMap'),end=source.indexOf('if(commentExportMap.commentExport',start);
  assert.ok(start>=0&&end>start);
  const table={tableId:'outer',row:0,column:0,rowCount:1,columnCount:1,colspan:1,rowspan:1,header:false,paragraphIndex:0,paragraphCount:2,
    nested:{tableId:'inner',row:0,column:0,rowCount:1,columnCount:2,colspan:1,rowspan:1,header:false,paragraphIndex:0,paragraphCount:2}};
  const blocks=['First','Last'].map((text,index)=>({documentParagraphIndex:index,formatIr:{runs:[{text}],table:{...structuredClone(table),paragraphIndex:index}}}));
  const proof={exportMap:{scenes:[{sceneId:'s',rawSha256:'a'.repeat(64),blocks}]},returnedThreads:[{table:{tableId:'forged',row:9,column:9}}]};
  const ctx=vm.createContext({proof,cloneJsonSafe:v=>JSON.parse(JSON.stringify(v))});
  const compact=vm.runInContext(source.slice(start,end)+';commentExportMap',ctx);
  const clean=JSON.parse(JSON.stringify(compact));
  assert.deepEqual(clean.scenes[0].blocks.map(b=>b.formatIr.table),blocks.map(b=>b.formatIr.table));
  assert.notEqual(compact.scenes[0].blocks[0].formatIr.table,table);
  const rows=clean.scenes[0].blocks.map(b=>({text:b.formatIr.runs.map(r=>r.text).join(''),table:b.formatIr.table}));
  const anchor=ranges.deriveCommentAnchor({sceneId:'s',paragraphs:rows,input:{kind:'multi-paragraph-range',paragraphIndex:0,startUtf16:0,endParagraphIndex:1,endUtf16:4,selectedText:'First\nLast'}});
  for(const mutate of [r=>{r[1].table.nested.column=1;},r=>{delete r[1].table;},r=>{r[1].table.tableId='foreign';}]) {
    const changed=structuredClone(rows);mutate(changed);
    assert.throws(()=>ranges.validateCommentAnchor({sceneId:'s',paragraphs:changed,anchor}),/COMMENT_ANCHOR_OWNER/);
  }
  assert.deepEqual(proof.exportMap.scenes[0].blocks,blocks);
});

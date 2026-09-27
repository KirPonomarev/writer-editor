'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { planCommentReturnDelta: plan } = require('../../src/core/word-comment-return-delta-v1.cjs');
const { exactAnchor } = require('../../src/core/word-comment-authoring-v1.cjs');
const { buildFullManuscriptDocxReviewPacketSource: makeSource } = require('../../src/export/docx/fullManuscriptDocxReviewPacketSource.js');
const { buildDocxReviewPacketBuffer } = require('../../src/export/docx/docxReviewPacketBuilder.js');
const hash = v => crypto.createHash('sha256').update(v).digest('hex');
const stable = v => Array.isArray(v) ? `[${v.map(stable).join(',')}]` : v && typeof v === 'object'
  ? `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}` : JSON.stringify(v);

async function fixture() {
  const sceneId = 'roman/a.md', text = 'Before 🧭 anchor after';
  const state = { schemaVersion: 'yalken.rtk.word.non-text-return-state.v1', projectId: 'delta-project', revision: 2, events: [],
    threads: [{ threadId: 'thread-a', rootCommentId: 'root-a', sceneId, status: 'open',
      anchor: exactAnchor({ paragraphIndex: 0, startUtf16: 7, selectedText: '🧭 anchor' }, sceneId, [text]),
      messages: [{ commentId: 'root-a', kind: 'root', body: 'Root before', provenance: { author: 'Alice', date: '2026-09-26T00:00:00Z' } },
        { commentId: 'reply-a', kind: 'reply', body: 'Reply before', provenance: { author: 'Bob' } }] }] };
  const source = makeSource({ projectId: state.projectId, projectRoot: '/project', nonTextReturnState: state,
    scenes: [{ sceneId, scenePath: '/project/' + sceneId, order: 0, text,
      doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] } }] });
  const bridge = await import('../../src/io/revisionBridge/index.mjs');
  const bytes = buildDocxReviewPacketBuffer(source);
  const parsed = bridge.buildDocxReviewTransportAnalysisFromZipBytes({ bytes }, { cryptoPort: {
    sha256Text: hash, sha256Json: v => 'sha256:' + hash(stable(v)), byteLength: v => Buffer.byteLength(v),
  } });
  assert.equal(parsed.ok, true);
  return { state, source, bytes, reviewIr: parsed.reviewIr, input: { beforeText: JSON.stringify(state, null, 2) + '\n', projectId: state.projectId,
    roundId: 'round-delta-test', artifactSha256: hash(bytes), baseline: source.commentExport,
    exportMap: source.localAuthorityCapsule.exportMap, returnedThreads: parsed.reviewIr.commentThreads,
    returnedParagraphs: parsed.reviewIr.formattingParagraphs } };
}

async function preparedHarness(t) {
  const fs = require('node:fs/promises'), path = require('node:path'), os = require('node:os'), vm = require('node:vm');
  const { input, source, bytes, reviewIr } = await fixture(); input.returnedThreads[0].body = 'Main Word delta';
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'comment-return-main-')));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const sceneId = 'roman/a.md', file = path.join(root, sceneId), text = input.returnedParagraphs[0].paragraphText;
  const stateFile = path.join(root, '.yalken/word-review/non-text-return-state.v1.json');
  await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, text);
  await fs.mkdir(path.dirname(stateFile), { recursive: true }); await fs.writeFile(stateFile, input.beforeText);
  const runtime = await import('../../src/io/revisionBridge/reviewTransportNonTextReturnRuntime.mjs');
  const { createMainProjectManifestAuthority } = await import('../../src/product/mainProjectManifestAuthority.mjs');
  const authority = createMainProjectManifestAuthority({ anchorRoot: path.join(root, 'anchors') });
  const context = { projectRoot: root, projectId: input.projectId,
    reviewTransportAuthorityCapsule: { ...source.localAuthorityCapsule, projectRoot: root,
      roundId: input.roundId, scenePathBySceneId: { [sceneId]: file },
      baselineFinalTextBySceneId: { [sceneId]: text }, baselineObservableContentBySceneId: {}, commentExport: input.baseline },
    reviewTransportReturnIntake: { authenticated: true, returnedArtifactSha256: input.artifactSha256,
      parserResult: { reviewIr } } };
  let current = true, draft = false;
  const sandbox = { path, fs, Buffer, computeHash: hash, cloneJsonSafe: v => JSON.parse(JSON.stringify(v)),
    docxReviewReturnIntakeProductBudgets: () => ({}),
    createRtkReviewTransportCryptoPort: () => ({ sha256Text: hash, sha256Json: v => 'sha256:' + hash(stable(v)), byteLength: v => Buffer.byteLength(v) }), isDirty: false, autoSaveInProgress: false, currentFilePath: file,
    lastSignaledEditGeneration: 0, activeStage10ApplicationBootstrap: {}, currentLifecycleSubjectId: () => 'life1',
    getProjectRootPath: () => root, loadRtkNonTextReturnModule: async () => runtime,
    loadDocumentContentEnvelopeModule: () => import('../../src/renderer/documentContentEnvelope.mjs'),
    requestEditorSnapshot: async () => ({ content: draft ? 'unsaved' : text, generation: 0 }),
    canonicalizeComparableValue: v => v, queueDiskOperation: operation => operation(),
    getMainProjectManifestAuthority: async () => authority,
  };
  const main = await fs.readFile(path.join(__dirname, '../../src/main.js'), 'utf8');
  const extract = name => main.match(new RegExp('async function ' + name + '\\([^]*?\\n}(?=\\n|$)'))[0];
  const ctx = vm.createContext(sandbox);
  vm.runInContext('const authenticatedCommentDeltaAdmissions = new WeakMap();\n'
    + extract('applyAuthenticatedCommentDelta') + '\n' + extract('handleRtkCommentLifecycleReturnCommandSurface'), ctx);
  const kernel = require('../../src/command/commandSurfaceKernel.js').createCommandSurfaceKernel({
    'cmd.rtk.review.applyCommentLifecycleReturn': ctx.handleRtkCommentLifecycleReturnCommandSurface,
  });
  sandbox.dispatchCommandSurfaceKernel = kernel.dispatch;

  let prepared;
  const result = await ctx.applyAuthenticatedCommentDelta({ context, docxBytes: bytes,
    requestId: 'prepared', explicitCanonicalApplyConfirmed: false, isCurrent: () => current,
    onPrepared: value => { prepared = value; } });
  assert.equal(result.status, 'preview-ready'); assert.equal(typeof prepared.apply, 'function');
  assert.equal(await fs.readFile(stateFile, 'utf8'), input.beforeText);
  return { sandbox, prepared, stateFile, input, fs, supersede: () => { current = false; }, draft: () => { draft = true; } };
}

for (const change of ['superseded', 'dirty', 'generation', 'file', 'owner', 'draft']) {
  test('prepared native Apply rejects ' + change + ' without publication', async t => {
    const h = await preparedHarness(t);
    if (change === 'superseded') h.supersede();
    if (change === 'dirty') h.sandbox.isDirty = true;
    if (change === 'generation') h.sandbox.lastSignaledEditGeneration++;
    if (change === 'file') h.sandbox.currentFilePath += '.other';
    if (change === 'owner') h.sandbox.activeStage10ApplicationBootstrap = {};
    if (change === 'draft') h.draft();
    await assert.rejects(() => h.prepared.apply(), /COMMENT_RETURN_CONTEXT_STALE|COMMENT_SAVE_SCENE_FIRST/u);
    assert.equal(await h.fs.readFile(h.stateFile, 'utf8'), h.input.beforeText);
    await assert.rejects(() => h.prepared.apply(), /PREPARED_CONSUMED/u);
  });
}

test('prepared callback uses actual Kernel and lease exactly once', async t => {
  const h = await preparedHarness(t), result = await h.prepared.apply();
  assert.equal(result.status, 'applied'); assert.equal(result.writerCalled, true);
  const after = await h.fs.readFile(h.stateFile, 'utf8');
  assert.equal(JSON.parse(after).threads[0].messages[0].body, 'Main Word delta');
  await assert.rejects(() => h.prepared.apply(), /PREPARED_CONSUMED/u);
  assert.equal(await h.fs.readFile(h.stateFile, 'utf8'), after);
});

function localEntryHarness({ confirm = false, failure = false } = {}) {
  const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
  const main = fs.readFileSync(path.join(__dirname, '../../src/main.js'), 'utf8');
  const extract = name => main.match(new RegExp('async function ' + name + '\\([^]*?\\n}(?=\\n|$)'))[0];
  let parses = 0, writes = 0, prompts = 0;
  const surface = { unrelated: 'preserved', commentSurvivalPreview: { orphanComments: ['old'] } };
  const sandbox = { Buffer, isPlainObjectValue: v => !!v && typeof v === 'object', cloneJsonSafe: v => JSON.parse(JSON.stringify(v)),
    DOCX_REVIEW_PREVIEW_SESSION_LOCAL_FILE_ALLOWED_PAYLOAD_KEYS: new Set(['requestId']),
    DOCX_REVIEW_PREVIEW_SESSION_LOCAL_FILE_COMMAND_ID: 'local-entry', DOCX_INTAKE_GATE_MAX_BYTES: 100,
    normalizeDocxReviewPreviewSessionLocalFileRequestId: id => id,
    validateDocxReviewPreviewSessionLocalFileSelection: v => ({ ok: true, value: v }),
    makeDocxReviewPreviewSessionLocalFileTypedError: code => ({ ok: false, code }),
    activeReviewSessionStore: { reviewSurface: surface },
    handleWorkspaceRtkNonTextReturnStateQuery: () => ({ ok: true, reviewSurface: { commentSurvivalPreview: { preservedThreads: ['canonical'], orphanComments: [] } } }),
    handleDocxReviewPreviewSessionActivationCommandSurface: async (_, options) => {
      parses++;
      options.onCommentDeltaPrepared({ changes: [{ threadId: 'a' }], apply: async () => {
        if (failure) throw new Error('COMMENT_RETURN_BASELINE_CONFLICT');
        writes++; return { ok: true, status: 'applied', writerCalled: true };
      } });
      return { ok: true, activated: true, reviewSurface: surface,
        commentProductPath: { ok: true, status: 'preview-ready', writerCalled: false } };
    },
  };
  const ctx = vm.createContext(sandbox); vm.runInContext(extract('handleDocxReviewPreviewSessionLocalFileCommandSurface'), ctx);
  return { sandbox, counts: () => ({ parses, writes, prompts }), run: () => ctx.handleDocxReviewPreviewSessionLocalFileCommandSurface({ requestId: 'local' }, {
    pickLocalFile: async () => ({ name: 'returned.docx' }), readLocalFileBytes: async () => Buffer.from('docx'),
    confirmCommentDelta: async () => { prompts++; return confirm; },
    notifyCommentDeltaFailure: async () => {},
  }) };
}

test('ordinary entry cancel keeps preview and writes nothing', async () => {
  const h = localEntryHarness(), result = await h.run();
  assert.equal(result.commentProductPath.status, 'cancelled');
  assert.deepEqual(h.counts(), { parses: 1, writes: 0, prompts: 1 });
});
test('ordinary entry explicit Apply reuses one parse and replaces false orphan projection', async () => {
  const h = localEntryHarness({ confirm: true }), result = await h.run();
  assert.equal(result.commentProductPath.status, 'applied');
  assert.equal(result.reviewSurface.unrelated, 'preserved');
  assert.equal(result.reviewSurface.commentSurvivalPreview.orphanComments.length, 0);
  assert.equal(h.sandbox.activeReviewSessionStore.reviewSurface.commentSurvivalPreview.preservedThreads[0], 'canonical');
  assert.deepEqual(h.counts(), { parses: 1, writes: 1, prompts: 1 });
});
test('ordinary entry apply conflict cannot publish a success projection', async () => {
  const h = localEntryHarness({ confirm: true, failure: true }), result = await h.run();
  assert.equal(result.commentProductPath.status, 'blocked');
  assert.equal(result.reviewSurface.commentSurvivalPreview.orphanComments[0], 'old');
  assert.deepEqual(h.counts(), { parses: 1, writes: 0, prompts: 1 });
});

test('ordinary DOCX return entry is available in FREE and the packaged local Word profile only through its exact command', () => {
  const commandId = 'cmd.project.review.openDocxReviewPreviewSession';
  const entitlement = require('../../src/core/entitlement-law-v1.cjs');
  const localProfile = require('../../src/core/writer-local-profile-v1.cjs');
  const packaged = localProfile.createWriterLocalProfileProjection({
    isPackaged: true,
    platform: 'darwin',
  });

  assert.equal(entitlement.isFreeAlwaysAvailableCommandId(commandId), true);
  assert.equal(entitlement.isProComplexityCommandId(commandId), false);
  assert.deepEqual(entitlement.decideCommandEntitlement(commandId), {
    ok: true,
    available: true,
    visible: true,
    access: 'free_authorship',
    commandId,
    reason: '',
  });
  assert.equal(
    localProfile.evaluateWriterLocalCommandAccess({ profile: packaged, commandId }).allowed,
    true,
  );

  for (const optionalCommandId of [
    'cmd.project.review.importLocalPacket',
    'cmd.project.review.clearSession',
    'cmd.project.review.applyExactTextChange',
  ]) {
    assert.equal(entitlement.isProComplexityCommandId(optionalCommandId), true);
    assert.equal(
      localProfile.evaluateWriterLocalCommandAccess({
        profile: packaged,
        commandId: optionalCommandId,
      }).allowed,
      false,
    );
  }
});

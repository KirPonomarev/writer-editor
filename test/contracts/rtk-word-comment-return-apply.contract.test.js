'use strict';
const { installMainDocxRoundAuthority } = require('../helpers/main-docx-round-authority');
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { planCommentReturnDelta: plan } = require('../../src/core/word-comment-return-delta-v1.cjs');
const { exactAnchor } = require('../../src/core/word-comment-authoring-v1.cjs');
const { buildFullManuscriptDocxReviewPacketSource: makeSource } = require('../../src/export/docx/fullManuscriptDocxReviewPacketSource.js');
const { buildDocxReviewPacketBuffer } = require('../../src/export/docx/docxReviewPacketBuilder.js');
const hash = v => crypto.createHash('sha256').update(v).digest('hex');

test('ordinary Word Apply admits the real candidate and rejects corrupted or mixed successor bytes', async () => {
  const path = require('node:path');
  const { execFileSync } = require('node:child_process');
  const root = path.resolve(__dirname, '../..');
  const cert = await import('../../scripts/ops/r24/corrective/post-audit-certification-set.mjs');
  const git = (args, options = {}) => execFileSync('git', args, { cwd: root, ...options, maxBuffer: 64 * 1024 * 1024 });
  const candidate = git(['rev-parse', 'HEAD']).toString().trim();
  const current = cert.R24_INTEROP_WORD_SAFE_CONFIRMATION_SUCCESSOR;
  const result = cert.verifyR24InteropWordPromotionSuccessor({ candidateSha: candidate, git });
  assert.equal(result.status, 'PASS');
  assert.equal(result.candidateSha, candidate);
  assert.equal(result.cellAcceptanceAuthority, false);
  assert.deepEqual(result.bindings, current.bindings);
  for (const binding of [...current.bindings, ...current.guards]) {
    let mutated = false;
    const mutate = (args, options) => {
      if (args[0] === 'show' && args[1] === candidate + ':' + binding.path) {
        mutated = true;
        return Buffer.concat([git(args, options), Buffer.from('\nchanged-after-admission')]);
      }
      return git(args, options);
    };
    assert.throws(() => cert.verifyR24InteropWordPromotionSuccessor({ candidateSha: candidate, git: mutate }),
      /E_INTEROP_WORD_PROMOTION_PIN/);
    assert.equal(mutated, true, 'corruption must execute for ' + binding.path);
  }
  let mixedRead = false;
  const mixed = (args, options) => {
    if (args[0] === 'show' && args[1] === candidate + ':' + current.guards[0].path) {
      mixedRead = true;
      return git(['show', 'c00d33d2ceee761e391eb742c98a68f629d355d8:' + current.guards[0].path], options);
    }
    return git(args, options);
  };
  assert.throws(() => cert.verifyR24InteropWordPromotionSuccessor({ candidateSha: candidate, git: mixed }),
    /E_INTEROP_WORD_PROMOTION_PIN/);
  assert.equal(mixedRead, true, 'mixed predecessor bytes must execute');
  let ancestryChecked = false;
  const unrelated = (args, options) => {
    if (args[0] === 'merge-base') { ancestryChecked = true; throw new Error('unrelated candidate'); }
    return git(args, options);
  };
  assert.throws(() => cert.verifyR24InteropWordPromotionSuccessor({ candidateSha: candidate, git: unrelated }),
    /E_INTEROP_WORD_TABLES_ANCESTRY/);
  assert.equal(ancestryChecked, true, 'ancestry rejection must execute');
});
const stable = v => Array.isArray(v) ? `[${v.map(stable).join(',')}]` : v && typeof v === 'object'
  ? `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}` : JSON.stringify(v);

async function fixture({ deletion = false, addition = false, replyDeletion = false } = {}) {
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
  let bytes = buildDocxReviewPacketBuffer(source);
  if (addition) {
    const edited = structuredClone(state), thread = structuredClone(state.threads[0]);
    thread.threadId = 'new-provider-thread'; thread.rootCommentId = 'new-provider-root';
    thread.messages = [{ commentId: 'new-provider-root', kind: 'root', body: 'New Word discussion', provenance: { author: 'Reviewer' } }];
    edited.threads.push(thread);
    const returnedSource = makeSource({ projectId: state.projectId, projectRoot: '/project', nonTextReturnState: edited,
      scenes: [{ sceneId, scenePath: '/project/' + sceneId, order: 0, text,
        doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] } }] });
    bytes = buildDocxReviewPacketBuffer(returnedSource);
  }
  if (deletion) {
    const parts = { ...bridge.extractDocxReviewTransportPackagePartsFromZipBytes({ bytes }).parts };
    for (const name of Object.keys(parts).filter(n => n.startsWith('word/comments'))) delete parts[name];
    parts['word/document.xml'] = parts['word/document.xml'].replace(/<w:(?:commentRangeStart|commentRangeEnd|commentReference)\b[^>]*\/>/gu, '');
    parts['word/_rels/document.xml.rels'] = parts['word/_rels/document.xml.rels'].replace(/<Relationship\b[^>]*\bType="[^"]*\/comments[^"]*"[^>]*\/>/gu, '');
    parts['[Content_Types].xml'] = parts['[Content_Types].xml'].replace(/<Override\b[^>]*\bPartName="\/word\/comments[^"]*"[^>]*\/>/gu, '');
    bytes = require('../../src/export/docx/docxMinBuilder.js').buildStoredZip(Object.entries(parts).map(([name, data]) => ({ name, data })));
  }
  if (replyDeletion) {
    const edited = structuredClone(state);
    edited.threads[0].messages.pop();
    bytes = buildDocxReviewPacketBuffer(makeSource({ projectId: state.projectId, projectRoot: '/project', nonTextReturnState: edited,
      scenes: [{ sceneId, scenePath: '/project/' + sceneId, order: 0, text,
        doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] } }] }));
  }
  const parsed = bridge.buildDocxReviewTransportAnalysisFromZipBytes({ bytes }, { cryptoPort: {
    sha256Text: hash, sha256Json: v => 'sha256:' + hash(stable(v)), byteLength: v => Buffer.byteLength(v),
  } });
  assert.equal(parsed.ok, true);
  return { state, source, bytes, reviewIr: parsed.reviewIr, input: { beforeText: JSON.stringify(state, null, 2) + '\n', projectId: state.projectId,
    roundId: 'round-delta-test', artifactSha256: hash(bytes), baseline: source.commentExport,
    exportMap: source.localAuthorityCapsule.exportMap, returnedThreads: parsed.reviewIr.commentThreads,
    returnedParagraphs: parsed.reviewIr.formattingParagraphs } };
}

async function preparedHarness(t, { deletion = false, addition = false, replyDeletion = false, explicitConfirmed = false } = {}) {
  const fs = require('node:fs/promises'), path = require('node:path'), os = require('node:os'), vm = require('node:vm');
  const { input, source, bytes, reviewIr } = await fixture({ deletion, addition, replyDeletion });
  if (!deletion && !addition && !replyDeletion) {
    input.returnedThreads[0].body = 'Main Word delta';
    input.returnedThreads[0].richBody.document.content[0].content[0].text = 'Main Word delta';
  }
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
  installMainDocxRoundAuthority(sandbox, { projectRoot: root, references: [context.reviewTransportAuthorityCapsule], publishAllocated: true });
  const ctx = vm.createContext(sandbox);
  vm.runInContext('const authenticatedCommentDeltaAdmissions = new WeakMap();\n'
    + extract('buildAuthenticatedPendingCommentScenes') + '\n' + extract('applyAuthenticatedCommentDelta') + '\n' + extract('handleRtkCommentLifecycleReturnCommandSurface'), ctx);
  const kernel = require('../../src/command/commandSurfaceKernel.js').createCommandSurfaceKernel({
    'cmd.rtk.review.applyCommentLifecycleReturn': ctx.handleRtkCommentLifecycleReturnCommandSurface,
  });
  sandbox.dispatchCommandSurfaceKernel = kernel.dispatch;

  let prepared;
  const result = await ctx.applyAuthenticatedCommentDelta({ context, docxBytes: bytes,
    requestId: 'prepared', explicitCanonicalApplyConfirmed: explicitConfirmed, isCurrent: () => current,
    onPrepared: value => { prepared = value; } });
  assert.equal(result.status, 'preview-ready', JSON.stringify(result)); assert.equal(typeof prepared.apply, 'function');
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

test('whole-thread deletion cannot use a broad prior Apply flag; native callback preserves history through actual Kernel', async t => {
  const h = await preparedHarness(t, { deletion: true, explicitConfirmed: true });
  const before = JSON.parse(h.input.beforeText);
  assert.equal(h.prepared.changes[0].statusAfter, 'deleted');
  assert.equal(await h.fs.readFile(h.stateFile, 'utf8'), h.input.beforeText);
  const result = await h.prepared.apply();
  assert.equal(result.writerCalled, true);
  const after = JSON.parse(await h.fs.readFile(h.stateFile, 'utf8'));
  assert.deepEqual(after.threads[0], { ...before.threads[0], status: 'deleted' });
  await assert.rejects(() => h.prepared.apply(), /PREPARED_CONSUMED/);
});

test('native deletion confirmation discloses missing discussions and retained content; Cancel is default', async () => {
  const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
  const main = fs.readFileSync(path.join(__dirname, '../../src/main.js'), 'utf8');
  const source = main.match(/async function confirmLocalWordCommentDelta\([^]*?\n\}(?=\n|$)/u)[0];
  let prompt;
  const context = vm.createContext({ mainWindow: { isDestroyed: () => false }, dialog: {
    showMessageBox: async (_, value) => { prompt = value; return { response: 0 }; },
  } });
  vm.runInContext(source, context);
  assert.equal(await context.confirmLocalWordCommentDelta({ fileName: 'returned.docx', changes: [{ statusAfter: 'deleted' }] }), false);
  assert.match(prompt.detail, /отсутствует обсуждений: 1/u);
  assert.match(prompt.detail, /тексты и авторы сохранятся/u);
  assert.equal(prompt.defaultId, 0); assert.equal(prompt.cancelId, 0);
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


test('new root requires fresh explicit confirmation and commits via Kernel once with unchanged peers', async t => {
  const h = await preparedHarness(t, { addition: true, explicitConfirmed: true });
  const before = JSON.parse(h.input.beforeText);
  assert.equal(h.prepared.changes.length, 1);
  assert.equal(h.prepared.changes[0].created, true);
  const result = await h.prepared.apply();
  assert.equal(result.writerCalled, true);
  const after = JSON.parse(await h.fs.readFile(h.stateFile, 'utf8'));
  assert.deepEqual(after.threads[0], before.threads[0]);
  assert.equal(after.threads[1].messages[0].body, 'New Word discussion');
  await assert.rejects(() => h.prepared.apply(), /PREPARED_CONSUMED/);
});

test('new root native prompt discloses added discussions and defaults to Cancel', async () => {
  const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
  const main = fs.readFileSync(path.join(__dirname, '../../src/main.js'), 'utf8');
  const source = main.match(/async function confirmLocalWordCommentDelta\([^]*?\n\}(?=\n|$)/u)[0];
  let prompt;
  const context = vm.createContext({ mainWindow: { isDestroyed: () => false }, dialog: {
    showMessageBox: async (_, value) => { prompt = value; return { response: 0 }; },
  } });
  vm.runInContext(source, context);
  assert.equal(await context.confirmLocalWordCommentDelta({ fileName: 'returned.docx', changes: [{ created: true }] }), false);
  assert.match(prompt.detail, /Новых обсуждений: 1/u);
  assert.equal(prompt.defaultId, 0); assert.equal(prompt.cancelId, 0);
});

test('reply deletion needs fresh explicit confirmation; Kernel preserves root and readable prior state', async t => {
  const h = await preparedHarness(t, { replyDeletion: true, explicitConfirmed: true });
  const before = JSON.parse(h.input.beforeText);
  assert.deepEqual(Array.from(h.prepared.changes[0].deletedMessageIds), ['reply-a']);
  assert.equal(await h.fs.readFile(h.stateFile, 'utf8'), h.input.beforeText);
  assert.equal((await h.prepared.apply()).writerCalled, true);
  const after = JSON.parse(await h.fs.readFile(h.stateFile, 'utf8'));
  assert.deepEqual(after.threads[0].messages, [before.threads[0].messages[0]]);
  assert.deepEqual(after.threads[0].deletedMessages, [before.threads[0].messages[1]]);
  const recovery = h.stateFile.replace('word-review/non-text-return-state', 'recovery/non-text-return-state');
  assert.equal(await h.fs.readFile(recovery, 'utf8'), h.input.beforeText);
  await assert.rejects(() => h.prepared.apply(), /PREPARED_CONSUMED/);
});

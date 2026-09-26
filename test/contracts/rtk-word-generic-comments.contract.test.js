'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const tx = require('../../src/core/project-transaction-v1.cjs');
const { durableSaveTransaction } = require('../../src/core/save-coordinator-v1.cjs');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const generic = import('../../src/io/revisionBridge/genericWordComments.mjs');
const text = 'Before 🧭 anchor after';
const candidate = () => ({ paragraphIndex: 0, startUtf16: 7, selectedText: '🧭 anchor', blockTextSha256: sha(text),
  status: 'open', messages: [{ sourceCommentId: '0', body: 'Check literal 😀', provenance: { author: 'Alice' } }] });

function ordinaryBytes({ body = 'Check literal 😀', start = '0', end = '0' } = {}) {
  const { buildStoredZip } = require('../../src/export/docx/docxMinBuilder.js');
  const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const O = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const P = 'http://schemas.openxmlformats.org/package/2006/relationships';
  return buildStoredZip([
    { name: '[Content_Types].xml', data: '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/comments.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml"/></Types>' },
    { name: '_rels/.rels', data: `<Relationships xmlns="${P}"><Relationship Id="d" Type="${O}/officeDocument" Target="word/document.xml"/></Relationships>` },
    { name: 'word/_rels/document.xml.rels', data: `<Relationships xmlns="${P}"><Relationship Id="c" Type="${O}/comments" Target="comments.xml"/></Relationships>` },
    { name: 'word/document.xml', data: `<w:document xmlns:w="${W}"><w:body><w:p><w:r><w:t xml:space="preserve">Before </w:t></w:r><w:commentRangeStart w:id="${start}"/><w:r><w:t>🧭 anchor</w:t></w:r><w:commentRangeEnd w:id="${end}"/><w:r><w:commentReference w:id="0"/></w:r><w:r><w:t xml:space="preserve"> after</w:t></w:r></w:p></w:body></w:document>` },
    { name: 'word/comments.xml', data: `<w:comments xmlns:w="${W}"><w:comment w:id="0" w:author="Alice" w:date="2026-09-26T00:00:00Z"><w:p><w:r><w:t>${body}</w:t></w:r></w:p></w:comment></w:comments>` },
  ]);
}

async function setup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'word-generic-comments-'));
  const scenePath = path.join(root, 'roman/new.txt'), manifestPath = path.join(root, 'project.json');
  const commentPath = path.join(root, '.yalken/word-review/non-text-return-state.v1.json');
  fs.mkdirSync(path.dirname(scenePath), { recursive: true }); fs.mkdirSync(path.dirname(commentPath), { recursive: true });
  const beforeText = JSON.stringify({ schemaVersion: 'yalken.rtk.word.non-text-return-state.v1', projectId: 'p', revision: 0,
    threads: [], events: [] }) + '\n';
  fs.writeFileSync(commentPath, beforeText); fs.writeFileSync(manifestPath, '{"revision":0}');
  const change = (await generic).materializeGenericComments({ candidates: [candidate()], paragraphs: [{ text }],
    projectId: 'p', sceneId: 'roman/new.txt', importOperationId: 'op', beforeText });
  const receipt = path.join(root, '.yalken/import/receipt.json');
  const publishManifest = async ({ expectedText, nextText, revision }) => {
    assert.equal(fs.readFileSync(manifestPath, 'utf8'), expectedText);
    await durableSaveTransaction({ filePath: manifestPath, content: nextText, revision });
  };
  const input = { scenePath, sceneContent: text, expectedSceneContent: null, manifestPath,
    expectedManifestContent: '{"revision":0}', manifestContent: '{"revision":1}', revision: 1, publishManifest,
    createResources: [{ path: receipt, content: 'receipt' }],
    commentState: { beforeText: change.beforeText, afterText: change.afterText } };
  return { root, commentPath, receipt, input, change };
}

test('generic comment identities derive from local operation and preserve literal provenance', async () => {
  const module = await generic;
  const options = { candidates: [candidate()], paragraphs: [{ text }], projectId: 'p', sceneId: 'roman/new.txt', importOperationId: 'op', beforeText: null };
  const first = module.materializeGenericComments(options), state = JSON.parse(first.afterText);
  assert.equal(state.threads[0].messages[0].body, candidate().messages[0].body);
  assert.equal(state.threads[0].anchor.startUtf16, 7);
  assert.equal(state.threads[0].anchor.selectedText, '🧭 anchor');
  assert.notEqual(state.threads[0].threadId, '0');
  const forged = candidate(); forged.messages[0].sourceCommentId = state.threads[0].threadId;
  assert.deepEqual(module.materializeGenericComments({ ...options, candidates: [forged] }).threadIds, first.threadIds);
  assert.notDeepEqual(module.materializeGenericComments({ ...options, importOperationId: 'second' }).threadIds, first.threadIds);
  assert.throws(() => module.materializeGenericComments({ ...options, beforeText: first.afterText }), /IDENTITY_CONFLICT/);
  const bad = candidate(); bad.startUtf16 = 8; bad.selectedText = '\udded anchor';
  assert.throws(() => module.materializeGenericComments({ ...options, candidates: [bad] }), /ANCHOR/);
});

test('scene, receipt and appended comments have one verified durable commit', async () => {
  const { input, commentPath, change, receipt } = await setup();
  const result = await tx.commitProjectTransaction(input); assert.equal(result.success, true);
  const record = await tx.readVerifiedProjectTransaction(input);
  assert.equal(record.schemaVersion, 'yalken.project-transaction.commit.v3');
  assert.equal(record.commentState.afterDigest, sha(change.afterText));
  assert.equal(fs.readFileSync(commentPath, 'utf8'), change.afterText);
  assert.equal(fs.readFileSync(receipt, 'utf8'), 'receipt');
  assert.equal(tx.classifyProjectTransactionState(input).classification, 'NEW_COMMITTED');
  fs.writeFileSync(commentPath, change.beforeText);
  await assert.rejects(tx.readVerifiedProjectTransaction(input), /COMMENT_READBACK/);
  assert.equal(tx.classifyProjectTransactionState(input).classification, 'PARTIAL_CORRUPTION_DETECTED');
});

for (const phase of ['scene', 'comment', 'commit', 'cleanup']) test(`crash after ${phase} recovers all four artifacts coherently`, async () => {
  const { input, commentPath, change, receipt } = await setup();
  let fired = false;
  const failAfter = async (method, args) => {
    const result = await fsp[method](...args);
    const target = method === 'unlink' ? args[0] : args[1];
    if (!fired && ((phase === 'scene' && method === 'link' && target === input.scenePath)
      || (phase === 'comment' && method === 'rename' && target === commentPath)
      || (phase === 'commit' && method === 'rename' && target === tx.commitPathFor(input.scenePath))
      || (phase === 'cleanup' && method === 'unlink' && target.includes('.wp201-')))) {
      fired = true; throw new Error('INJECTED_PROCESS_STOP');
    }
    return result;
  };
  const fsAdapter = { ...fsp, link: (...args) => failAfter('link', args), rename: (...args) => failAfter('rename', args),
    unlink: (...args) => failAfter('unlink', args) };
  await assert.rejects(tx.commitProjectTransaction({ ...input, fsAdapter })); assert.equal(fired, true);
  const result = await tx.recoverProjectTransaction(input), committed = ['commit', 'cleanup'].includes(phase);
  assert.equal(result.outcome, committed ? 'COMMITTED_CONVERGED' : 'UNCOMMITTED_ROLLED_BACK');
  assert.equal(fs.existsSync(input.scenePath), committed); assert.equal(fs.existsSync(receipt), committed);
  assert.equal(fs.readFileSync(input.manifestPath, 'utf8'), committed ? input.manifestContent : input.expectedManifestContent);
  assert.equal(fs.readFileSync(commentPath, 'utf8'), committed ? change.afterText : change.beforeText);
  assert.equal(fs.existsSync(tx.journalPathFor(input.manifestPath)), false);
});

test('stale or foreign comment state refuses the transaction before a journal exists', async () => {
  const { input, commentPath, change } = await setup();
  fs.writeFileSync(commentPath, change.afterText);
  await assert.rejects(tx.commitProjectTransaction(input), /COMMENT_CAS/);
  assert.equal(fs.existsSync(tx.journalPathFor(input.manifestPath)), false);
  fs.writeFileSync(commentPath, change.beforeText);
  const foreign = JSON.parse(change.afterText); foreign.threads[0].sceneId = 'roman/other.txt';
  await assert.rejects(tx.commitProjectTransaction({ ...input, commentState: { ...input.commentState, afterText: JSON.stringify(foreign) } }), /COMMENT_STATE/);
  assert.equal(fs.existsSync(input.scenePath), false);
});

test('ordinary DOCX imports comments through real lease, reopens, exports and preserves earlier threads', async () => {
  const bridge = await import('../../src/io/revisionBridge/index.mjs');
  const envelope = await import('../../src/renderer/documentContentEnvelope.mjs');
  const safe = require('../fixtures/docx-import-real-authority.cjs');
  const bytes = ordinaryBytes(), preview = bridge.buildDocxContentPreviewFromZipBytes(bytes);
  const plan = bridge.buildDocxImportPreviewPlanFromContentPreview(preview);
  assert.equal(plan.ok, true, JSON.stringify(plan)); assert.equal(plan.candidateCreatePlan.entries[0].comments.length, 1);
  assert.equal(safe.validateDocxImportPreviewPlan(plan).ok, true);
  safe.rememberDocxImportPreviewPlanAdmission(plan);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'word-comments-real-import-'));
  const romanRoot = path.join(root, 'roman'); fs.mkdirSync(romanRoot);
  const opts = { projectRoot: root, romanRoot, projectId: 'p' };
  const first = await safe.applyDocxImportSafeCreate({ docxImportPreviewPlan: plan }, opts);
  assert.equal(first.ok, true, JSON.stringify(first));
  const statePath = path.join(root, '.yalken/word-review/non-text-return-state.v1.json');
  const original = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  assert.equal(original.threads.length, 1); assert.equal(original.threads[0].messages[0].body, 'Check literal 😀');
  const second = await safe.applyDocxImportSafeCreate({ docxImportPreviewPlan: plan }, { ...opts, importRequestNonce: 'second-local-import' });
  assert.equal(second.ok, true, JSON.stringify(second));
  const current = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  assert.equal(current.threads.length, 2); assert.deepEqual(current.threads[0], original.threads[0]);
  assert.notEqual(current.threads[1].threadId, original.threads[0].threadId);
  const replay = await safe.applyDocxImportSafeCreate({ docxImportPreviewPlan: plan }, { ...opts, importRequestNonce: 'second-local-import' });
  assert.equal(replay.ok, true, JSON.stringify(replay)); assert.equal(replay.value.idempotent, true);
  const { buildFullManuscriptDocxReviewPacketSource } = require('../../src/export/docx/fullManuscriptDocxReviewPacketSource.js');
  const { buildDocxReviewPacketBuffer } = require('../../src/export/docx/docxReviewPacketBuilder.js');
  const scenes = current.threads.map((thread, order) => {
    const scenePath = path.join(root, thread.sceneId), content = fs.readFileSync(scenePath, 'utf8');
    const parsed = envelope.parseObservablePayload(content);
    return { sceneId: thread.sceneId, scenePath, text: parsed.text, doc: parsed.doc, observableContent: content, order };
  });
  const source = buildFullManuscriptDocxReviewPacketSource({ projectId: 'p', projectRoot: root, scenes, nonTextReturnState: current });
  const returned = bridge.buildDocxReviewTransportAnalysisFromZipBytes({ bytes: buildDocxReviewPacketBuffer(source) },
    { cryptoPort: { sha256Text: sha, sha256Json: value => `sha256:${sha(JSON.stringify(value))}`, byteLength: value => Buffer.byteLength(value) } });
  assert.equal(returned.ok, true); assert.equal(returned.reviewIr.commentThreads.length, 2);
  for (const thread of returned.reviewIr.commentThreads) {
    assert.equal(thread.body, 'Check literal 😀'); assert.equal(thread.quotedAnchorText, '🧭 anchor');
    assert.equal(thread.authorPersonIdentity.author, 'Alice'); assert.equal(thread.date, '2026-09-26T00:00:00Z');
  }
});

test('orphan range and unsupported empty body never become successful generic imports', async () => {
  const bridge = await import('../../src/io/revisionBridge/index.mjs');
  for (const options of [{ start: '1' }, { end: '1' }, { body: '' }]) {
    const preview = bridge.buildDocxContentPreviewFromZipBytes(ordinaryBytes(options));
    assert.equal(bridge.buildDocxImportPreviewPlanFromContentPreview(preview).ok, false, JSON.stringify(preview));
  }
});

test('generic import preserves resolved roots, ordered replies and distinct literal authors', async () => {
  const bridge = await import('../../src/io/revisionBridge/index.mjs');
  const { buildFullManuscriptDocxReviewPacketSource: makeSource } = require('../../src/export/docx/fullManuscriptDocxReviewPacketSource.js');
  const { buildDocxReviewPacketBuffer } = require('../../src/export/docx/docxReviewPacketBuilder.js');
  const before = (await generic).materializeGenericComments({ candidates: [candidate()], paragraphs: [{ text }],
    projectId: 'p', sceneId: 'roman/a.txt', importOperationId: 'original-op', beforeText: null });
  const state = JSON.parse(before.afterText), root = state.threads[0]; root.status = 'resolved';
  root.messages.push({ commentId: 'reply-A', kind: 'reply', body: 'Ответ один\nс новой строкой', provenance: { author: 'Bob', initials: 'Б', date: '2026-09-26T11:00:00Z' } },
    { commentId: 'reply-B', kind: 'reply', body: 'Second reply', provenance: { author: 'Carol' } });
  const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] };
  const source = makeSource({ projectId: 'p', projectRoot: '/synthetic', scenes: [{ sceneId: 'roman/a.txt', scenePath: '/synthetic/roman/a.txt', text, doc, order: 0 }], nonTextReturnState: state });
  const exported = buildDocxReviewPacketBuffer(source);
  const analysis = bridge.buildDocxReviewTransportAnalysisFromZipBytes({ bytes: exported },
    { cryptoPort: { sha256Text: sha, sha256Json: value => `sha256:${sha(JSON.stringify(value))}`, byteLength: value => Buffer.byteLength(value) } });
  assert.equal(analysis.ok, true, JSON.stringify(analysis.reasons));
  const { genericCommentCandidates } = await generic;
  assert.doesNotThrow(() => assert.equal(genericCommentCandidates(analysis, [{ text }]).length, 1), JSON.stringify(analysis.reasons));
  const preview = bridge.buildDocxContentPreviewFromZipBytes(exported);
  const plan = bridge.buildDocxImportPreviewPlanFromContentPreview(preview);
  assert.equal(plan.ok, true, JSON.stringify(preview));
  const imported = plan.candidateCreatePlan.entries[0].comments;
  assert.equal(imported.length, 1); assert.equal(imported[0].status, 'resolved');
  assert.deepEqual(imported[0].messages.map(message => message.body), root.messages.map(message => message.body));
  assert.deepEqual(imported[0].messages.map(message => message.provenance.author), ['Alice', 'Bob', 'Carol']);
  const recreated = (await generic).materializeGenericComments({ candidates: imported, paragraphs: [{ text }],
    projectId: 'new-project', sceneId: 'roman/new.txt', importOperationId: 'generic-op', beforeText: null });
  assert.notEqual(recreated.threadIds[0], root.threadId);
});

test('comment-state symlink and recovery divergence preserve the existing foreign bytes', async () => {
  const { input, commentPath, root, change } = await setup();
  const external = path.join(root, 'protected.json'); fs.writeFileSync(external, change.beforeText);
  fs.unlinkSync(commentPath); fs.symlinkSync(external, commentPath);
  await assert.rejects(tx.commitProjectTransaction(input), /RESOURCE_BOUNDARY/);
  assert.equal(fs.readFileSync(external, 'utf8'), change.beforeText);
  assert.equal(fs.existsSync(tx.journalPathFor(input.manifestPath)), false);
  fs.unlinkSync(commentPath); fs.writeFileSync(commentPath, change.beforeText);
  const adapter = { ...fsp, rename: async (source, target) => {
    await fsp.rename(source, target); if (target === commentPath) throw Error('INTERRUPTED');
  } };
  await assert.rejects(tx.commitProjectTransaction({ ...input, fsAdapter: adapter }));
  const foreign = 'owner changed canonical state'; fs.writeFileSync(commentPath, foreign);
  const sceneBefore = fs.readFileSync(input.scenePath), manifestBefore = fs.readFileSync(input.manifestPath);
  await assert.rejects(tx.recoverProjectTransaction(input), /COMMENT_CAS/);
  assert.equal(fs.readFileSync(commentPath, 'utf8'), foreign);
  assert.deepEqual(fs.readFileSync(input.scenePath), sceneBefore); assert.deepEqual(fs.readFileSync(input.manifestPath), manifestBefore);
});

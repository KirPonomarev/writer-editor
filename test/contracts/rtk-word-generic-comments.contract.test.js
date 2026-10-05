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
  for (const malformed of [{ ...candidate(), paragraphIndex: '0' }, { ...candidate(), writePath: '/foreign' }]) {
    assert.throws(() => module.materializeGenericComments({ ...options, candidates: [malformed] }), /CANDIDATE/);
  }
  const injected = candidate(); injected.messages[0].command = 'write';
  assert.throws(() => module.materializeGenericComments({ ...options, candidates: [injected] }), /MESSAGE/);
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
  const { validateGenericCommentMetadataV1 } = await import('../../src/io/revisionBridge/reviewTransportPackageParserV2.mjs');
  const parts = bridge.extractDocxReviewTransportPackagePartsFromZipBytes({ bytes: exported }).parts;
  const ports = { cryptoPort: { sha256Text: sha, sha256Json: value => `sha256:${sha(JSON.stringify(value))}`, byteLength: value => Buffer.byteLength(value) } };
  const metadataValidated = validateGenericCommentMetadataV1(parts, ports);
  assert.equal(genericCommentCandidates(analysis, [{ text }], { metadataValidated }).length, 1);
  for (const extra of ['unrepresented text', '<w16cex:unknown/>', '<w16cex:commentExtensible w16cex:durableId="X" w16cex:unknown="hidden"/>']) {
    const changed = { ...parts, 'word/commentsExtensible.xml': parts['word/commentsExtensible.xml'].replace('</w16cex:commentsExtensible>', `${extra}</w16cex:commentsExtensible>`) };
    assert.throws(() => validateGenericCommentMetadataV1(changed, ports), /METADATA_UNSUPPORTED/);
  }
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


test('generic comment plaintext admission rejects rich effects instead of losing their contents', async () => {
  const bridge = await import('../../src/io/revisionBridge/index.mjs');
  for (const body of [
    '</w:t><w:drawing/><w:t>image',
    '</w:t><w:fldChar w:fldCharType="begin"/><w:instrText>HYPERLINK hidden</w:instrText><w:t>label',
    '</w:t><w:rPr><w:b/></w:rPr><w:t>bold',
    '</w:t><w:br w:type="page"/><w:t>page',
    '</w:t>unrepresented text<w:t>literal',
  ]) {
    const preview = bridge.buildDocxContentPreviewFromZipBytes(ordinaryBytes({ body }));
    assert.equal(bridge.buildDocxImportPreviewPlanFromContentPreview(preview).ok, false, body);
    assert.match(JSON.stringify(preview), /DOCX_GENERIC_COMMENT_METADATA_UNSUPPORTED/);
    assert.doesNotMatch(JSON.stringify(preview), /DOCX_CONTENT_PREVIEW_INTERNAL_ERROR/);
  }
  const body = '  literal &amp; &lt;tag&gt;</w:t><w:tab/><w:t>tab</w:t><w:br/><w:t>line</w:t><w:noBreakHyphen/><w:softHyphen/><w:t>  ';
  const plan = bridge.buildDocxImportPreviewPlanFromContentPreview(bridge.buildDocxContentPreviewFromZipBytes(ordinaryBytes({ body })));
  assert.equal(plan.ok, true, JSON.stringify(plan));
  assert.equal(plan.candidateCreatePlan.entries[0].comments[0].messages[0].body, '  literal & <tag>\ttab\nline\u2011\u00ad  ');
});


test('Word localized annotation marker style is admitted only on the non-message run', async () => {
  const bridge = await import('../../src/io/revisionBridge/index.mjs');
  const body = '</w:t></w:r><w:r><w:rPr><w:rStyle w:val="a5"/></w:rPr><w:annotationRef/></w:r><w:r><w:t>native marker';
  const plan = bridge.buildDocxImportPreviewPlanFromContentPreview(bridge.buildDocxContentPreviewFromZipBytes(ordinaryBytes({ body })));
  assert.equal(plan.ok, true, JSON.stringify(plan));
  assert.equal(plan.candidateCreatePlan.entries[0].comments[0].messages[0].body, 'native marker');
  const unsafe = body.replace('<w:annotationRef/>', '<w:annotationRef/><w:t>styled</w:t>');
  assert.equal(bridge.buildDocxImportPreviewPlanFromContentPreview(bridge.buildDocxContentPreviewFromZipBytes(ordinaryBytes({ body: unsafe }))).ok, false);
});


test('actual main preview canonicalization retains comments through import planning', async () => {
  const bridge = await import('../../src/io/revisionBridge/index.mjs');
  const source = fs.readFileSync(path.join(__dirname, '../../src/main.js'), 'utf8');
  const section = source.slice(source.indexOf('function copyDocxImportPreviewAllowedFields('),
    source.indexOf('function validateDocxImportPreviewPayload('));
  const canonicalize = new Function('isPlainObjectValue', 'cloneJsonSafe',
    section + '; return canonicalizeDocxImportPreviewSourceReport;')(
    value => !!value && typeof value === 'object' && !Array.isArray(value),
    value => value === undefined ? undefined : JSON.parse(JSON.stringify(value)));
  const preview = bridge.buildDocxContentPreviewFromZipBytes(ordinaryBytes());
  assert.equal(preview.diagnostics.some(item => /^w:comment/.test(item.tagName || '')), false);
  const normalized = canonicalize(preview);
  assert.deepEqual(normalized.contentPreview.genericComments, preview.contentPreview.genericComments);
  normalized.contentPreview.genericComments[0].messages[0].body = 'isolated clone';
  assert.equal(preview.contentPreview.genericComments[0].messages[0].body, 'Check literal 😀');
  const plan = bridge.buildDocxImportPreviewPlanFromContentPreview(canonicalize(preview));
  assert.equal(plan.ok, true, JSON.stringify(plan));
  assert.equal(plan.candidateCreatePlan.entries[0].comments[0].messages[0].body, 'Check literal 😀');
  assert.equal(plan.lossReport.items.some(item => /COMMENTS_NOT_IMPORTED/.test(item.code)), false);
});


test('generic-imported comments survive actual single-scene export; malformed state still blocks keys and publication', async t => {
  // Reuse the entire-Main fixture without registering its separate tests.
  // No source, capability, parser or durable-authority predicate is replaced.
  const fixtureFile = path.join(__dirname, 'rtk-word-scene-comment-export.contract.test.js');
  const prefix = fs.readFileSync(fixtureFile, 'utf8').split("\ntest('actual Main Review source emits")[0];
  const mod = { exports: {} };
  new Function('require', 'module', '__dirname', prefix + '\nmodule.exports={fixture,parsed};')(
    require('node:module').createRequire(fixtureFile), mod, __dirname);
  const { fixture, parsed } = mod.exports;
  const f = await fixture(t, { empty: true }), bridge = f.bridge;
  const preview = bridge.buildDocxContentPreviewFromZipBytes(ordinaryBytes());
  const imported = bridge.buildDocxImportPreviewPlanFromContentPreview(preview);
  assert.equal(imported.ok, true, JSON.stringify(imported));
  const entry = imported.candidateCreatePlan.entries[0];
  const paragraphs = require('../../src/core/word-comment-anchor-save-v1.cjs').paragraphs(entry.content);
  const canonical = (await generic).materializeGenericComments({ candidates: entry.comments, paragraphs,
    projectId: f.query.projectId, sceneId: f.sceneId, importOperationId: 'generic-export-source',
    beforeText: fs.readFileSync(f.statePath, 'utf8') });
  fs.writeFileSync(f.alpha, entry.content); fs.writeFileSync(f.statePath, canonical.afterText);
  const before = f.capture(), state = JSON.parse(canonical.afterText);
  const source = await f.probe.reviewSource(), output = await f.probe.reviewBuild(source);
  const decoded = parsed(f, output.documentBuffer, source);
  const { commentStateDigest, compareCommentExportReadback } = require('../../src/export/docx/docxReviewPacketComments.js');
  assert.equal(decoded.authorityCarrier.status, 'verified-baseline-bound');
  assert.equal(source.commentExport.stateDigest, commentStateDigest(state));
  assert.equal(decoded.authorityCarrier.selectedCarrier.payload.commentStateDigest, commentStateDigest(state));
  assert.deepEqual(source.commentExport.threads.map(thread => thread.threadId), canonical.threadIds);
  assert.deepEqual(output.publicationGate.commentProofs.map(proof => proof.phase), ['provisional', 'final']);
  assert.equal(compareCommentExportReadback(source.commentExport, decoded.reviewIr.commentThreads).ok, true);
  const returned = decoded.reviewIr.commentThreads[0];
  assert.equal(returned.body, 'Check literal 😀'); assert.equal(returned.quotedAnchorText, '🧭 anchor');
  assert.equal(returned.anchorRange.startUtf16, 7); assert.equal(returned.authorPersonIdentity.author, 'Alice');
  assert.equal(returned.date, '2026-09-26T00:00:00Z');
  assert.equal(output.documentBuffer.includes(Buffer.from('SIBLING_PRIVATE_BODY')), false);
  assert.deepEqual(f.capture(), before);
  const reimport = bridge.buildDocxImportPreviewPlanFromContentPreview(bridge.buildDocxContentPreviewFromZipBytes(output.documentBuffer));
  assert.equal(reimport.ok, true, JSON.stringify(reimport));
  const reentry = reimport.candidateCreatePlan.entries[0];
  const fresh = (await generic).materializeGenericComments({ candidates: reentry.comments,
    paragraphs: require('../../src/core/word-comment-anchor-save-v1.cjs').paragraphs(reentry.content),
    projectId: f.query.projectId, sceneId: 'roman/fresh.txt', importOperationId: 'generic-export-reimport', beforeText: null });
  const freshThread = JSON.parse(fresh.afterText).threads[0];
  assert.notEqual(freshThread.threadId, canonical.threadIds[0]);
  assert.equal(freshThread.messages[0].body, returned.body);
  assert.equal(freshThread.anchor.selectedText, returned.quotedAnchorText);

  const captureFiles = directory => !fs.existsSync(directory) ? [] : fs.readdirSync(directory, { withFileTypes: true })
    .flatMap(item => item.isDirectory() ? captureFiles(path.join(directory, item.name))
      : [[path.join(directory, item.name), fs.readFileSync(path.join(directory, item.name)).toString('base64')]]);
  for (const mutation of ['selected-anchor', 'sibling-message']) {
    const bad = await fixture(t), malformed = structuredClone(bad.state);
    if (mutation === 'selected-anchor') malformed.threads[0].anchor.selectedTextSha256 = '0'.repeat(64);
    else malformed.threads.at(-1).messages[0].body = '\uD800';
    fs.writeFileSync(bad.statePath, JSON.stringify(malformed));
    const canonicalBefore = bad.capture(), keysBefore = captureFiles(path.join(bad.temp, 'userData'));
    await assert.rejects(bad.probe.reviewSource(), mutation === 'selected-anchor' ? /DOCX_COMMENT_ANCHOR_INVALID/ : /COMMENT_BODY_INVALID/);
    assert.deepEqual(bad.capture(), canonicalBefore);
    assert.deepEqual(captureFiles(path.join(bad.temp, 'userData')), keysBefore);
    assert.equal(bad.probe.strict(bad.root).record, null);
  }
});

async function nativeLiteralCommentBytes({ styleId = 'ad', includeTheme = true, mutate = () => {} } = {}) {
  const bridge = await import('../../src/io/revisionBridge/index.mjs');
  const parts = { ...bridge.extractDocxReviewTransportPackagePartsFromZipBytes({ bytes: ordinaryBytes() }).parts };
  const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const W14 = 'http://schemas.microsoft.com/office/word/2010/wordml';
  parts['word/comments.xml'] = parts['word/comments.xml'].replace('<w:p>',
    `<w:p w:rsidRPr="0041448B"><w:pPr><w:pStyle w:val="${styleId}"/><w:rPr><w:lang w:val="ru-RU"/></w:rPr></w:pPr>`)
    .replace('<w:r>', '<w:r><w:rPr><w:lang w:val="ru-RU"/><w:rFonts w:ascii="Aptos" w:hAnsi="Aptos"/></w:rPr>');
  parts['word/styles.xml'] = `<w:styles xmlns:w="${W}" xmlns:w14="${W14}"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:asciiTheme="minorHAnsi" w:eastAsiaTheme="minorHAnsi" w:hAnsiTheme="minorHAnsi" w:cstheme="minorBidi"/><w:kern w:val="2"/><w:sz w:val="24"/><w:szCs w:val="24"/><w:lang w:val="ru-FI"/><w14:ligatures w14:val="standardContextual"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="278" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style><w:style w:type="paragraph" w:styleId="${styleId}"><w:name w:val="annotation text"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:line="240" w:lineRule="auto"/></w:pPr><w:rPr><w:sz w:val="20"/></w:rPr></w:style></w:styles>`;
  parts['word/_rels/document.xml.rels'] = parts['word/_rels/document.xml.rels'].replace('</Relationships>',
    '<Relationship Id="styles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>');
  parts['[Content_Types].xml'] = parts['[Content_Types].xml'].replace('</Types>',
    '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>');
  if (includeTheme) {
    parts['word/theme/theme1.xml'] = '<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:themeElements><a:fontScheme name="Comment fixture"><a:majorFont><a:latin typeface="Aptos"/><a:ea typeface="Aptos"/><a:cs typeface="Arial"/></a:majorFont><a:minorFont><a:latin typeface="Aptos"/><a:ea typeface="Aptos"/><a:cs typeface="Arial"/></a:minorFont></a:fontScheme></a:themeElements></a:theme>';
    parts['word/_rels/document.xml.rels'] = parts['word/_rels/document.xml.rels'].replace('</Relationships>', '<Relationship Id="theme" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/></Relationships>');
    parts['[Content_Types].xml'] = parts['[Content_Types].xml'].replace('</Types>', '<Override PartName="/word/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/></Types>');
  }
  mutate(parts);
  return require('../../src/export/docx/docxMinBuilder.js').buildStoredZip(Object.entries(parts).map(([name, data]) => ({ name, data })));
}

test('native literal comment presentation survives main preview and real import receipt with fresh local IDs', async () => {
  const bridge = await import('../../src/io/revisionBridge/index.mjs');
  const source = fs.readFileSync(path.join(__dirname, '../../src/main.js'), 'utf8');
  const section = source.slice(source.indexOf('function copyDocxImportPreviewAllowedFields('), source.indexOf('function validateDocxImportPreviewPayload('));
  const canonicalize = new Function('isPlainObjectValue', 'cloneJsonSafe', section + '; return canonicalizeDocxImportPreviewSourceReport;')(
    value => !!value && typeof value === 'object' && !Array.isArray(value), value => value === undefined ? undefined : JSON.parse(JSON.stringify(value)));
  const preview = bridge.buildDocxContentPreviewFromZipBytes(await nativeLiteralCommentBytes());
  assert.equal(preview.ok, true, JSON.stringify(preview));
  const normalized = canonicalize(preview);
  assert.deepEqual(normalized.contentPreview.commentNormalizationLedger, preview.contentPreview.commentNormalizationLedger);
  const plan = bridge.buildDocxImportPreviewPlanFromContentPreview(normalized);
  assert.equal(plan.ok, true, JSON.stringify(plan));
  assert.equal(plan.candidateCreatePlan.entries[0].comments[0].messages[0].body, 'Check literal 😀');
  const item = plan.lossReport.items.find(item => item.code === 'DOCX_GENERIC_COMMENT_PRESENTATION_NORMALIZED');
  assert.equal(item.severity, 'warning');
  assert.deepEqual(item.normalizationLedger, preview.contentPreview.commentNormalizationLedger);
  assert(item.normalizationLedger.some(item => item.definitionPart === 'word/styles.xml'));
  assert(item.normalizationLedger.some(item => item.reason === 'WORD_COMMENT_NON_AUTHORING_PRESENTATION'));
  const safe = require('../fixtures/docx-import-real-authority.cjs');
  safe.rememberDocxImportPreviewPlanAdmission(plan);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'word-native-literal-'));
  const romanRoot = path.join(root, 'roman'); fs.mkdirSync(romanRoot);
  const options = { projectRoot: root, romanRoot, projectId: 'native-literal' };
  const result = await safe.applyDocxImportSafeCreate({ docxImportPreviewPlan: plan }, options);
  assert.equal(result.ok, true, JSON.stringify(result));
  const statePath = path.join(root, '.yalken/word-review/non-text-return-state.v1.json');
  const first = JSON.parse(fs.readFileSync(statePath));
  assert.equal(first.threads[0].messages[0].body, 'Check literal 😀');
  assert.equal(first.threads[0].anchor.selectedText, '🧭 anchor');
  assert.notEqual(first.threads[0].rootCommentId, '0');
  const again = await safe.applyDocxImportSafeCreate({ docxImportPreviewPlan: plan }, options);
  assert.equal(again.ok, true, JSON.stringify(again)); assert.equal(again.value.idempotent, true);
  assert.deepEqual(JSON.parse(fs.readFileSync(statePath)), first);
  // The idempotence check verifies the complete persisted loss report, not
  // only a display counter; a modified receipt must not become success.
  const visit = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? visit(path.join(dir, e.name)) : [path.join(dir, e.name)]);
  const receipts = visit(root).filter(file => file.endsWith('.json')).map(file => ({ file, text: fs.readFileSync(file, 'utf8') }))
    .filter(x => x.text.includes('DOCX_GENERIC_COMMENT_PRESENTATION_NORMALIZED'));
  assert(receipts.length > 0);
  assert(receipts.some(x => JSON.stringify(JSON.parse(x.text).lossReport?.items) === JSON.stringify(plan.lossReport.items)));
});

test('localized and English comment styles require safe definitions in both generic and return parsing', async () => {
  const bridge = await import('../../src/io/revisionBridge/index.mjs');
  const ports = { cryptoPort: { sha256Text: sha, sha256Json: v => 'sha256:' + sha(JSON.stringify(v)), byteLength: v => Buffer.byteLength(v) } };
  const mutants = [
    p => { p['word/styles.xml'] = p['word/styles.xml'].replace('<w:sz w:val="20"/>', '<w:vanish/>'); },
    p => { p['word/styles.xml'] = p['word/styles.xml'].replace('<w:sz w:val="20"/>', '<w:webHidden/>'); },
    p => { p['word/styles.xml'] = p['word/styles.xml'].replace('<w:sz w:val="20"/>', '<w:vertAlign w:val="superscript"/>'); },
    p => { p['word/styles.xml'] = p['word/styles.xml'].replace('<w:qFormat/>', '<w:qFormat/><w:rPr><w:vanish/></w:rPr>'); },
    p => { p['word/styles.xml'] = p['word/styles.xml'].replace('<w:kern w:val="2"/>', '<w:kern w:val="2"/><w:vanish/>'); },
    p => { p['word/styles.xml'] = p['word/styles.xml'].replace('w:val="Normal"/><w:pPr>', 'w:val="unknown"/><w:pPr>'); },
    p => { p['word/styles.xml'] = p['word/styles.xml'].replace('minorHAnsi', 'execute'); },
    p => { p['word/styles.xml'] = p['word/styles.xml'].replace('w:kern w:val="2"', 'w:kern w:val="20000"'); },
    p => { p['word/styles.xml'] = p['word/styles.xml'].replace('standardContextual', 'unknown'); },
    p => { p['word/comments.xml'] = p['word/comments.xml'].replace('<w:lang w:val="ru-RU"/>', '<w:rStyle w:val="CommentReference"/>'); },
  ];
  for (const styleId of ['ad', 'CommentText']) {
    const good = await nativeLiteralCommentBytes({ styleId });
    assert.equal(bridge.buildDocxContentPreviewFromZipBytes(good).ok, true);
    for (const mutate of mutants) {
      const bytes = await nativeLiteralCommentBytes({ styleId, mutate });
      const preview = bridge.buildDocxContentPreviewFromZipBytes(bytes);
      assert.equal(preview.ok, false, JSON.stringify(preview));
      assert.equal(bridge.buildDocxImportPreviewPlanFromContentPreview(preview).ok, false);
      const analysis = bridge.buildDocxReviewTransportAnalysisFromZipBytes({ bytes }, ports);
      assert(analysis.ok === false || analysis.reviewIr?.commentBodyGrammar?.status === 'UNSUPPORTED', JSON.stringify(analysis));
    }
  }
});

test('implicit paragraph and character defaults cannot hide literal comment text', async () => {
  const bridge = await import('../../src/io/revisionBridge/index.mjs');
  for (const hidden of ['none', 'paragraph', 'character', 'defaults']) {
    const bytes = await nativeLiteralCommentBytes({ mutate(parts) {
      parts['word/comments.xml'] = parts['word/comments.xml'].replace('<w:pStyle w:val="ad"/>', '');
      if (hidden === 'paragraph') parts['word/styles.xml'] = parts['word/styles.xml'].replace('<w:qFormat/>', '<w:qFormat/><w:rPr><w:vanish/></w:rPr>');
      if (hidden === 'character') parts['word/styles.xml'] = parts['word/styles.xml'].replace('</w:styles>', '<w:style w:type="character" w:default="1" w:styleId="DefaultParagraphFont"><w:name w:val="Default Paragraph Font"/><w:rPr><w:vanish/></w:rPr></w:style></w:styles>');
      if (hidden === 'defaults') parts['word/styles.xml'] = parts['word/styles.xml'].replace('<w:kern w:val="2"/>', '<w:kern w:val="2"/><w:vanish/>');
    } });
    const preview = bridge.buildDocxContentPreviewFromZipBytes(bytes);
    assert.equal(preview.ok, hidden === 'none', hidden + JSON.stringify(preview));
    if (hidden === 'none') assert.equal(preview.contentPreview.genericComments[0].messages[0].richBody.document.content[0].attrs.wordParagraphMarkLanguage.val,'ru-RU');
  }
});

test('native file-selection preview retains the full comment graph and normalization ledger before safe-create planning', async () => {
  const bridge = await import('../../src/io/revisionBridge/index.mjs');
  const { createDocxImportLocalFilePreview: localPreview } = require('../../src/utils/docxImportLocalFilePreview.js');
  for (const native of [false, true]) {
    const bytes = native ? await nativeLiteralCommentBytes() : ordinaryBytes();
    const direct = bridge.buildDocxContentPreviewFromZipBytes(bytes);
    const options = { pickLocalFile: async () => ({ path: '/synthetic/native-comments.docx', size: bytes.length }),
      readLocalFileBytes: async () => bytes };
    const result = await localPreview({ requestId: 'native-graph-preview' }, options);
    assert.equal(result.ok, true, JSON.stringify(result)); assert.equal(result.importPreviewOk, true, JSON.stringify(result));
    assert.deepEqual(result.docxContentPreviewReport.contentPreview.genericComments, direct.contentPreview.genericComments);
    assert.deepEqual(result.docxContentPreviewReport.contentPreview.commentNormalizationLedger, direct.contentPreview.commentNormalizationLedger);
    assert.deepEqual(result.docxImportPreviewPlan.candidateCreatePlan.entries[0].comments, direct.contentPreview.genericComments);
    const expectedPlan = bridge.buildDocxImportPreviewPlanFromContentPreview(direct);
    assert.deepEqual(result.docxImportPreviewPlan.lossReport, expectedPlan.lossReport);
    const malformed = structuredClone(direct);
    malformed.contentPreview.commentNormalizationLedger = [{ path: '/foreign' }];
    const rejected = await localPreview({ requestId: 'forged-metadata' }, { ...options,
      loadRevisionBridgeModule: async () => ({ ...bridge, buildDocxContentPreviewFromZipBytes: () => malformed }) });
    assert.equal(rejected.ok, false); assert.equal(rejected.error.reason, 'DOCX_IMPORT_LOCAL_FILE_PREVIEW_OUTPUT_FORBIDDEN');
  }
});

// Preserve the original unresolved-theme fixture as a typed refusal. Its old
// text-only admission discarded the theme semantics; rich intake cannot.
test('comment themes require their actual bound definition instead of literal-only flattening',async()=>{
 const bridge=await import('../../src/io/revisionBridge/index.mjs');
 const original=bridge.buildDocxContentPreviewFromZipBytes(await nativeLiteralCommentBytes({includeTheme:false}));
 assert.equal(original.ok,false);assert.match(JSON.stringify(original),/DOCX_GENERIC_COMMENT_METADATA_UNSUPPORTED/);
 const complete=bridge.buildDocxContentPreviewFromZipBytes(await nativeLiteralCommentBytes());
 assert.equal(complete.ok,true,JSON.stringify(complete));
 const p=complete.contentPreview.genericComments[0].messages[0].richBody.document.content[0];
 assert.equal(p.attrs.wordParagraphMarkLanguage.val,'ru-RU');
 assert.equal(p.content[0].marks.find(m=>m.type==='textStyle').attrs.fontFamily,'Aptos');
 assert.equal(p.content[0].marks.find(m=>m.type==='textStyle').attrs.fontSize,'10pt');
});

test('generic rich import refuses an invalid legacy rich state before upgrading',async()=>{
 const api=await generic;const base=api.materializeGenericComments({candidates:[candidate()],paragraphs:[{text}],projectId:'p',sceneId:'scene',importOperationId:'old',beforeText:null});
 const corrupt=JSON.parse(base.afterText);corrupt.threads[0].messages[0].richBody={schemaVersion:'yalken.word.comment-body.v1',document:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:corrupt.threads[0].messages[0].body}]}]}};
 assert.throws(()=>api.materializeGenericComments({candidates:[candidate()],paragraphs:[{text}],projectId:'p',sceneId:'scene',importOperationId:'new',beforeText:JSON.stringify(corrupt)}),/COMMENT_RICH_STATE_VERSION_REQUIRED/);
});

test('real safe-create upgrades a valid legacy state once and retains previous threads on rich import and replay',async()=>{
 const bridge=await import('../../src/io/revisionBridge/index.mjs');
 const safe=require('../fixtures/docx-import-real-authority.cjs');
 const api=await generic;
 const previous=api.materializeGenericComments({candidates:[candidate()],paragraphs:[{text}],projectId:'upgrade-project',sceneId:'roman/existing.txt',importOperationId:'old',beforeText:null});
 const old=JSON.parse(previous.afterText);
 const preview=bridge.buildDocxContentPreviewFromZipBytes(await nativeLiteralCommentBytes());
 const plan=bridge.buildDocxImportPreviewPlanFromContentPreview(preview);assert.equal(plan.ok,true,JSON.stringify(plan));
 safe.rememberDocxImportPreviewPlanAdmission(plan);
 const projectRoot=fs.mkdtempSync(path.join(os.tmpdir(),'word-rich-upgrade-')),romanRoot=path.join(projectRoot,'roman');fs.mkdirSync(romanRoot);
 fs.writeFileSync(path.join(romanRoot,'existing.txt'),text);
 const stateFile=path.join(projectRoot,'.yalken/word-review/non-text-return-state.v1.json');fs.mkdirSync(path.dirname(stateFile),{recursive:true});fs.writeFileSync(stateFile,previous.afterText);
 const options={projectRoot,romanRoot,projectId:'upgrade-project'};
 const result=await safe.applyDocxImportSafeCreate({docxImportPreviewPlan:plan},options);assert.equal(result.ok,true,JSON.stringify(result));
 const after=JSON.parse(fs.readFileSync(stateFile));assert.equal(after.schemaVersion,'yalken.rtk.word.non-text-return-state.v2');
 assert.deepEqual(after.threads.slice(0,old.threads.length),old.threads);assert(after.threads.at(-1).messages[0].richBody);
 const bytes=fs.readFileSync(stateFile);
 const repeated=await safe.applyDocxImportSafeCreate({docxImportPreviewPlan:plan},options);assert.equal(repeated.ok,true,JSON.stringify(repeated));assert.equal(repeated.value.idempotent,true);assert.deepEqual(fs.readFileSync(stateFile),bytes);
});

test('generic graph serialization stays lossless below compact budget after pretty graph exceeds 64 KiB',async()=>{
 const {materializeGenericComments}=await generic;
 const candidates=Array.from({length:60},(_,i)=>({...candidate(),messages:[{...candidate().messages[0],sourceCommentId:String(i),body:'Literal '+i+' '+ 'x'.repeat(120)}]}));
 const result=materializeGenericComments({candidates,paragraphs:[{text}],projectId:'p',sceneId:'roman/new.txt',importOperationId:'compact-op',beforeText:null});
 const state=JSON.parse(result.afterText);
 assert.ok(Buffer.byteLength(JSON.stringify(state,null,2))>65536);assert.ok(Buffer.byteLength(result.afterText)<=65536);
 assert.equal(state.threads.length,60);state.threads.forEach((thread,i)=>assert.equal(thread.messages[0].body,candidates[i].messages[0].body));
 assert.deepEqual(require('../../src/core/word-comment-authoring-v1.cjs').readState(result.afterText,'p'),state);
});

test('compact imported graph remains writable through authoring, anchor save, signed return and recovery with exact history',async t=>{
 const {materializeGenericComments}=await generic;
 const author=require('../../src/core/word-comment-authoring-v1.cjs'),body=require('../../src/core/word-comment-body-v1.cjs');
 const candidates=Array.from({length:60},(_,i)=>({...candidate(),messages:[{...candidate().messages[0],sourceCommentId:String(i),body:'Literal '+i+' '+ 'x'.repeat(120)}]}));
 const input={candidates,paragraphs:[{text}],projectId:'p',sceneId:'roman/new.txt',importOperationId:'compact-cycle',beforeText:null};
 const imported=materializeGenericComments(input),original=JSON.parse(imported.afterText),threadId=original.threads[0].threadId;
 const authorContext={now:'2026-10-04T12:00:00Z',projectId:'p',sceneId:input.sceneId,sceneSha256:sha(text),paragraphs:[text]};
 const authored=author.planCommentAuthoring({...authorContext,beforeText:imported.afterText,input:{requestId:'compact-edit',action:'edit',projectId:'p',sceneId:input.sceneId,subjectId:'subject',expectedStateSha256:sha(imported.afterText),expectedSceneSha256:sha(text),threadId,commentId:original.threads[0].rootCommentId,body:'Changed root literal'}});
 assert.equal(authored.state.threads[0].messages[0].body,'Changed root literal');assert.deepEqual(authored.state.threads.slice(1),original.threads.slice(1));
 const anchor=require('../../src/core/word-comment-anchor-save-v1.cjs').planCommentAnchorSave({beforeText:authored.afterText,projectId:'p',sceneId:input.sceneId,beforeContent:text,afterContent:'! '+text});
 const shifted=author.readState(anchor.afterText,'p');assert.equal(shifted.threads.length,60);assert.deepEqual(shifted.events,authored.state.events);
 shifted.threads.forEach((thread,i)=>{assert.equal(thread.anchor.startUtf16,original.threads[i].anchor.startUtf16+2);assert.deepEqual(thread.messages,authored.state.threads[i].messages);});
 const {buildFullManuscriptDocxReviewPacketSource}=require('../../src/export/docx/fullManuscriptDocxReviewPacketSource.js');
 const {buildDocxReviewPacketBuffer}=require('../../src/export/docx/docxReviewPacketBuilder.js');
 const bridge=await import('../../src/io/revisionBridge/index.mjs');
 const source=buildFullManuscriptDocxReviewPacketSource({projectId:'p',projectRoot:'/project',nonTextReturnState:shifted,scenes:[{sceneId:input.sceneId,scenePath:'/project/'+input.sceneId,order:0,text:'! '+text,doc:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'! '+text}]}]}}]});
 const bytes=buildDocxReviewPacketBuffer(source),parsed=bridge.buildDocxReviewTransportAnalysisFromZipBytes({bytes},{cryptoPort:{sha256Text:sha,sha256Json:v=>'sha256:'+sha(JSON.stringify(v)),byteLength:v=>Buffer.byteLength(v)}});assert.equal(parsed.ok,true);
 const returned=structuredClone(parsed.reviewIr.commentThreads);returned[0].status='RESOLVED';returned[0].doneResolvedReopenedState='resolved';
 const delta=require('../../src/core/word-comment-return-delta-v1.cjs').planCommentReturnDelta({beforeText:anchor.afterText,projectId:'p',roundId:'compact-return',artifactSha256:sha(bytes),baseline:source.commentExport,exportMap:source.localAuthorityCapsule.exportMap,returnedThreads:returned,returnedParagraphs:parsed.reviewIr.formattingParagraphs});
 const final=author.readState(delta.afterText,'p');assert.equal(final.threads[0].status,'resolved');assert.deepEqual(final.threads.slice(1),shifted.threads.slice(1));assert.deepEqual(final.events.slice(0,-1),shifted.events);assert.equal(final.events.length,shifted.events.length+1);
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'compact-comment-port-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const runtime=await import('../../src/io/revisionBridge/reviewTransportNonTextReturnRuntime.mjs'),port=runtime.createRtkNonTextReturnFilePort();
 const recovery=await port.writeRecovery({projectRoot:root,state:final}),canonical=await port.writeCanonical({projectRoot:root,state:final});
 for(const file of [recovery.recoveryPath,canonical.statePath]){const raw=fs.readFileSync(file,'utf8');assert.ok(Buffer.byteLength(raw)<=65536);assert.deepEqual(author.readState(raw,'p'),final);}
 assert.deepEqual(await port.readCanonical({projectRoot:root,projectId:'p'}),final);
 const call={...authorContext,paragraphs:['! '+text],sceneSha256:sha('! '+text),projectRoot:root,input:{requestId:'compact-reopen',action:'reopen',projectId:'p',sceneId:input.sceneId,subjectId:'subject',threadId,expectedStateSha256:sha(fs.readFileSync(canonical.statePath,'utf8')),expectedSceneSha256:sha('! '+text)}};
 await runtime.commitCommentAuthoring(call,{publish:op=>op(),revalidate:async()=>{}});
 assert.deepEqual(author.readState(fs.readFileSync(recovery.recoveryPath,'utf8'),'p'),final,'authoring recovery never expands the compact graph');
 const oversized=structuredClone(final);oversized.threads[0].messages[0].body='x'.repeat(16384);oversized.threads[1].messages[0].body='y'.repeat(16384);
 assert.ok(Buffer.byteLength(JSON.stringify(oversized))>65536);let writes=0;
 const guarded=runtime.createRtkNonTextReturnFilePort({atomicWriteFile:async()=>{writes++;}});
 await assert.rejects(guarded.writeRecovery({projectRoot:root,state:oversized}),/COMMENT_STATE_BUDGET/);await assert.rejects(guarded.writeCanonical({projectRoot:root,state:oversized}),/COMMENT_STATE_BUDGET/);assert.equal(writes,0);
 assert.throws(()=>body.serializeCommentState(oversized,'CUSTOM_BUDGET'),error=>error.code==='CUSTOM_BUDGET');
 const overCount={...original,threads:Array.from({length:128},(_,i)=>({threadId:'t'+i,sceneId:'s',status:'open',rootCommentId:'m'+i,anchor:{},messages:[{commentId:'m'+i,kind:'root',body:'x'}]}))};
 const atLimit=materializeGenericComments({...input,candidates:[candidate()],beforeText:JSON.stringify({...overCount,threads:overCount.threads.slice(0,127)})});assert.equal(author.readState(atLimit.afterText,'p').threads.length,128);
 const old=JSON.stringify(overCount);assert.ok(Buffer.byteLength(old)<65536);assert.throws(()=>materializeGenericComments({...input,candidates:[candidate()],beforeText:old}),/DOCX_GENERIC_COMMENT_STATE/);assert.equal(JSON.stringify(overCount),old);
});

test('generic import retains a comment at the start of a pending insertion for exact reexport',async()=>{
 const review=require('../../src/core/word-pending-text-revisions-v1.cjs'),ranges=require('../../src/core/word-comment-ranges-v1.cjs');
 const make=require('../../src/export/docx/fullManuscriptDocxReviewPacketSource.js').buildFullManuscriptDocxReviewPacketSource;
 const build=require('../../src/export/docx/docxReviewPacketBuilder.js').buildDocxReviewPacketBuffer;
 const env=require('../../src/core/document-content-envelope-v1.cjs');
 const bridge=await import('../../src/io/revisionBridge/index.mjs'),api=await import('../../src/io/revisionBridge/genericWordComments.mjs');
 const source={type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'oldnew'}]}]};
 const doc=review.bindLedger({schemaVersion:1,source,revisions:['delete','insert'].map((operation,i)=>({id:'revision-'+(i+1),nativeId:String(i),operation,author:'A',date:'',dateUtc:'',paragraphIndex:0,from:i*3,to:i*3+3,state:'pending',groupId:null})),undo:[],redo:[]});
 const sceneId='roman/a.txt',anchor=ranges.deriveCommentAnchor({sceneId,paragraphs:['new'],input:{paragraphIndex:0,startUtf16:0,selectedText:'new'}});
 anchor.pendingUnionLocator=review.createCommentUnionLocator({document:doc,anchor,unionStart:{paragraphIndex:0,offsetUtf16:3},unionEnd:{paragraphIndex:0,offsetUtf16:6}});
 const state={schemaVersion:'yalken.rtk.word.non-text-return-state.v1',projectId:'p',revision:0,events:[],threads:[{threadId:'t',rootCommentId:'m',sceneId,status:'open',anchor,messages:[{commentId:'m',kind:'root',body:'Insertion discussion'}]}]};
 const exported=(d,s)=>make({projectId:'p',projectRoot:'/synthetic',nonTextReturnState:s,scenes:[{sceneId,scenePath:'/synthetic/'+sceneId,order:0,text:'new',doc:d}]});
 const bytes=build(exported(doc,state)),preview=bridge.buildDocxContentPreviewFromZipBytes(bytes);assert.equal(preview.ok,true);
 const plan=bridge.buildDocxImportPreviewPlanFromContentPreview(preview);assert.equal(plan.ok,true);const entry=plan.candidateCreatePlan.entries[0],parsed=env.parseObservablePayload(entry.content).doc;
 assert.ok(entry.comments[0].pendingUnionLocator);
 const input={candidates:entry.comments,paragraphs:['new'],pendingDocument:parsed,projectId:'p',sceneId,importOperationId:'boundary-import',beforeText:null};
 const imported=api.materializeGenericComments(input),round=exported(parsed,JSON.parse(imported.afterText));assert.ok(build(round).length);
 assert.equal(round.localAuthorityCapsule.exportMap.scenes[0].pendingCommentBinding.anchors[0].unionStart.offsetUtf16,3);
 assert.throws(()=>api.materializeGenericComments({...input,pendingDocument:undefined}),/PENDING_DOCUMENT_REQUIRED/);
 const forged=structuredClone(entry.comments);forged[0].pendingUnionLocator.geometrySha256='0'.repeat(64);
 assert.throws(()=>api.materializeGenericComments({...input,candidates:forged}),/LOCATOR_STALE/);
});

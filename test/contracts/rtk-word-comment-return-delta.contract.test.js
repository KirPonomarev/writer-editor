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

test('unchanged actual exporter/parser graph has no publication', async () => {
  const { input } = await fixture(); const result = plan(input);
  assert.equal(result.unchanged, true); assert.equal(result.afterText, input.beforeText);
});

test('Word proofing metadata has an explicit return ledger and never widens rich-comment admission', async () => {
  const { bytes, input, state } = await fixture();
  const bridge = await import('../../src/io/revisionBridge/index.mjs');
  const { validateGenericCommentMetadataV1 } = await import('../../src/io/revisionBridge/reviewTransportPackageParserV2.mjs');
  const parts = bridge.extractDocxReviewTransportPackagePartsFromZipBytes({ bytes }).parts;
  const options = { cryptoPort: { sha256Text: hash, sha256Json: v => 'sha256:' + hash(stable(v)),
    byteLength: v => Buffer.byteLength(v) } };
  const original = parts['word/comments.xml'];
  const changed = original.replace(/<w:p(?=[ >])/u, '<w:p w:rsidRPr="002E54A5"')
    .replace(/(<w:p\b[^>]*>)/u, '$1<w:pPr><w:rPr><w:lang w:val="ru-RU"/></w:rPr></w:pPr>')
    .replace('<w:r>', '<w:r><w:rPr><w:lang w:val="ru-RU" w:eastAsia="ja-JP" w:bidi="ar-SA"/></w:rPr>')
    .replace('Root before', 'Из Word 🧭');
  const analyze = xml => {
    const packageParts = { ...parts, 'word/comments.xml': xml };
    const returned = require('../../src/export/docx/docxMinBuilder.js').buildStoredZip(
      Object.entries(packageParts).map(([name, data]) => ({ name, data })));
    return { returned, parsed: bridge.buildDocxReviewTransportAnalysisFromZipBytes({ bytes: returned }, options) };
  };
  const { returned, parsed } = analyze(changed);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.reviewIr.commentBodyGrammar.status, 'SUPPORTED');
  assert.equal(parsed.reviewIr.commentBodyGrammar.normalizationLedger.length, 5);
  assert.deepEqual(parsed.reviewIr.commentBodyGrammar.normalizationLedger.map(item => item.value).sort(),
    ['002E54A5', 'ru-RU', 'ru-RU', 'ja-JP', 'ar-SA'].sort());
  assert(parsed.reviewIr.commentBodyGrammar.normalizationLedger.every(item => item.part === 'word/comments.xml'
    && Number.isInteger(item.offset) && item.disposition === 'NORMALIZED_NON_AUTHORING_METADATA'));
  const result = plan({ ...input, artifactSha256: hash(returned), returnedThreads: parsed.reviewIr.commentThreads,
    returnedParagraphs: parsed.reviewIr.formattingParagraphs });
  const after = JSON.parse(result.afterText);
  assert.equal(after.threads[0].messages[0].body, 'Из Word 🧭');
  assert.deepEqual(after.threads[0].messages[1], state.threads[0].messages[1]);
  assert.deepEqual(after.threads[0].anchor, state.threads[0].anchor);
  assert.throws(() => validateGenericCommentMetadataV1({ ...parts, 'word/comments.xml': changed }, options), /METADATA_UNSUPPORTED/u);
  for (const bad of [
    changed.replace('ru-RU', '../../foreign'),
    changed.replace('w:lang w:val', 'w:lang w:unknown'),
    changed.replace('<w:lang', '<w:vanish/><w:lang'),
    changed.replace('<w:lang', '<w:b/><w:lang'),
    changed.replace('<w:lang', '<w:rStyle w:val="Hidden"/><w:lang'),
    changed.replace('<w:lang', '<w:drawing/><w:lang'),
    changed.replace('002E54A5', 'command'),
    changed.replace('w:val="ru-RU"/>', 'w:val="ru-RU">unrepresented</w:lang>'),
  ]) assert.equal(analyze(bad).parsed.reviewIr.commentBodyGrammar.status, 'UNSUPPORTED', bad);
});

test('one delta preserves canonical IDs and combines root/reply edits, resolution and a proved range', async () => {
  const { input, state } = await fixture(), t = input.returnedThreads[0];
  t.body = '  Changed 🧭 root\nsecond line '; t.replies[0].body = 'Changed reply'; t.status = 'RESOLVED';
  t.quotedAnchorText = 'after'; t.finalTextAnchorRange = { startUtf16: 17, endUtf16: 22,
    selectedText: 'after', blockTextSha256: hash(input.returnedParagraphs[0].paragraphText) };
  const result = plan(input), after = JSON.parse(result.afterText);
  assert.equal(after.revision, 3); assert.equal(after.events.length, 1); assert.equal(after.threads.length, 1);
  assert.equal(after.threads[0].status, 'resolved'); assert.equal(after.threads[0].anchor.selectedText, 'after');
  assert.equal(after.threads[0].messages[0].body, t.body); assert.equal(after.threads[0].messages[1].body, t.replies[0].body);
  assert.deepEqual(after.threads[0].messages.map(m => m.commentId), ['root-a', 'reply-a']);
  assert.deepEqual(after.threads[0].messages.map(m => m.provenance), state.threads[0].messages.map(m => m.provenance));
  assert.equal(result.changes.length, 1);
});

test('new reply uses a fresh local identity and preserves the parent/root', async () => {
  const { input } = await fixture(), t = input.returnedThreads[0];
  t.replies.push({ rawId: '9', parentRawId: t.commentId, durableId: 'AABBCCDD', body: 'New reply', author: 'Carol' });
  const after = JSON.parse(plan(input).afterText);
  assert.equal(after.threads[0].rootCommentId, 'root-a');
  assert.match(after.threads[0].messages[2].commentId, /^word-reply-[a-f0-9]{64}$/u);
  assert.equal(after.threads[0].messages[2].body, 'New reply');
});

test('native Word reply style resolves definitions, defaults and parent before literal return', async () => {
  const { bytes, input, state } = await fixture();
  const bridge = await import('../../src/io/revisionBridge/index.mjs');
  const { validateGenericCommentMetadataV1 } = await import('../../src/io/revisionBridge/reviewTransportPackageParserV2.mjs');
  const parts = bridge.extractDocxReviewTransportPackagePartsFromZipBytes({ bytes }).parts;
  const options = { cryptoPort: { sha256Text: hash, sha256Json: v => 'sha256:' + hash(stable(v)), byteLength: v => Buffer.byteLength(v) } };
  const ns = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const styles = `<w:styles xmlns:w="${ns}"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:sz w:val="24"/><w:lang w:val="ru-FI"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="278" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="a"><w:name w:val="Normal"/><w:qFormat/></w:style><w:style w:type="paragraph" w:styleId="a3"><w:name w:val="annotation text"/><w:basedOn w:val="a"/><w:link w:val="a4"/><w:uiPriority w:val="99"/><w:semiHidden/><w:unhideWhenUsed/><w:pPr><w:spacing w:line="240" w:lineRule="auto"/></w:pPr><w:rPr><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr></w:style></w:styles>`;
  const rootPara = parts['word/comments.xml'].match(/w14:paraId="([^"]+)"/u)[1];
  const comments = parts['word/comments.xml'].replace('</w:comments>', '<w:comment w:id="9" w:author="Carol" w:initials="C" w:date="2026-09-27T14:29:00Z"><w:p w14:paraId="6AEAA8E0" w:rsidRPr="00E65C11"><w:pPr><w:pStyle w:val="a3"/><w:rPr><w:lang w:val="ru-RU"/></w:rPr></w:pPr><w:r><w:rPr><w:rStyle w:val="a5"/></w:rPr><w:annotationRef/></w:r><w:r><w:rPr><w:lang w:val="ru-RU"/></w:rPr><w:t>Ответ 🧭 مرحبا</w:t></w:r></w:p></w:comment></w:comments>');
  const extended = parts['word/commentsExtended.xml'].replace('</w15:commentsEx>', `<w15:commentEx w15:paraId="6AEAA8E0" w15:paraIdParent="${rootPara}" w15:done="0"/></w15:commentsEx>`);
  const ids = parts['word/commentsIds.xml'].replace('</w16cid:commentsIds>', '<w16cid:commentId w16cid:paraId="6AEAA8E0" w16cid:durableId="5152C897"/></w16cid:commentsIds>');
  const returnedParts = { ...parts, 'word/styles.xml': styles, 'word/comments.xml': comments,
    'word/commentsExtended.xml': extended, 'word/commentsIds.xml': ids };
  const analyze = (styleXml, commentXml = comments) => {
    const returned = require('../../src/export/docx/docxMinBuilder.js').buildStoredZip(Object.entries({ ...returnedParts,
      'word/styles.xml': styleXml, 'word/comments.xml': commentXml }).map(([name, data]) => ({ name, data })));
    return { returned, parsed: bridge.buildDocxReviewTransportAnalysisFromZipBytes({ bytes: returned }, options) };
  };
  const { returned, parsed } = analyze(styles);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.reviewIr.commentBodyGrammar.status, 'SUPPORTED');
  assert(parsed.reviewIr.commentBodyGrammar.normalizationLedger.some(x => x.value === 'a3'
    && x.definitionPart === 'word/styles.xml' && x.reason === 'WORD_BUILTIN_COMMENT_STYLE_LITERAL_PRESENTATION'));
  const planned = plan({ ...input, artifactSha256: hash(returned), returnedThreads: parsed.reviewIr.commentThreads,
    returnedParagraphs: parsed.reviewIr.formattingParagraphs });
  const after = JSON.parse(planned.afterText);
  assert.deepEqual(after.threads[0].messages.slice(0, 2), state.threads[0].messages);
  assert.deepEqual(after.threads[0].anchor, state.threads[0].anchor);
  const reply = after.threads[0].messages[2];
  assert.equal(reply.body, 'Ответ 🧭 مرحبا');
  assert.equal(reply.provenance.author, 'Carol');
  assert.match(reply.commentId, /^word-reply-[a-f0-9]{64}$/u);
  assert.throws(() => validateGenericCommentMetadataV1(returnedParts, options), /METADATA_UNSUPPORTED/u);
  assert.equal(analyze(styles.replaceAll('a3', 'LocalizedComment'), comments.replaceAll('a3', 'LocalizedComment')).parsed.reviewIr.commentBodyGrammar.status, 'SUPPORTED');
  for (const bad of [
    styles.replace('<w:sz w:val="20"/>', '<w:vanish/>'),
    styles.replace('<w:sz w:val="20"/>', '<w:b/>'),
    styles.replace('<w:qFormat/>', '<w:rPr><w:vanish/></w:rPr>'),
    styles.replace('<w:sz w:val="24"/>', '<w:vanish/>'),
    styles.replace('<w:spacing w:line="240" w:lineRule="auto"/>', '<w:numPr><w:numId w:val="1"/></w:numPr>'),
    styles.replace('w:basedOn w:val="a"', 'w:basedOn w:val="a3"'),
    styles.replace('w:basedOn w:val="a"', 'w:basedOn w:val="missing"'),
    styles.replace('w:type="paragraph" w:styleId="a3"', 'w:type="character" w:styleId="a3"'),
    styles.replace('<w:basedOn w:val="a"/>', ''),
    styles.replace('annotation text', 'Untrusted style'),
    styles.replace('<w:qFormat/>', '<w:qFormat>hidden payload</w:qFormat>'),
    styles.replace('w:sz w:val="20"', 'w:sz w:val="0"'),
    styles.replace('w:lang w:val="ru-FI"', 'w:lang w:unknown="ru-FI"'),
    styles.replace('</w:styles>', '<w:style w:type="paragraph" w:styleId="a3"><w:name w:val="annotation text"/></w:style></w:styles>'),
  ]) {
    const result = analyze(bad).parsed;
    assert(result.ok === false || result.reviewIr.commentBodyGrammar?.status === 'UNSUPPORTED', bad);
    assert.notEqual(result.reviewIr.commentBodyGrammar?.status, 'SUPPORTED', bad);
  }
});

test('duplicate Apply is no-write; mutated payload or intervening canonical state is rejected', async () => {
  const { input } = await fixture(); input.returnedThreads[0].body = 'Changed';
  const result = plan(input); const replay = { ...input, beforeText: result.afterText };
  assert.equal(plan(replay).replay, true);
  const altered = structuredClone(replay); altered.returnedThreads[0].body = 'Different';
  assert.throws(() => plan(altered), /COMMENT_RETURN_REPLAY_CONFLICT/u);
  const state = JSON.parse(result.afterText); state.revision++;
  assert.throws(() => plan({ ...replay, beforeText: JSON.stringify(state) }), /COMMENT_RETURN_REPLAY_CONFLICT/u);
});

test('concurrent local body/status/anchor change and revision-only change cannot be overwritten', async () => {
  for (const mutate of [s => s.revision++, s => s.threads[0].messages[0].body = 'local',
    s => s.threads[0].status = 'resolved', s => s.threads[0].anchor.startUtf16++]) {
    const { input, state } = await fixture(); input.returnedThreads[0].body = 'Word'; mutate(state);
    assert.throws(() => plan({ ...input, beforeText: JSON.stringify(state) }), /COMMENT_RETURN_BASELINE_CONFLICT/u);
  }
});

test('missing root/reply/carrier, duplicate identities and changed reply parent do not imply permission', async () => {
  for (const mutate of [i => i.returnedThreads.pop(), i => i.returnedThreads[0].replies.pop(),
    i => delete i.returnedThreads[0].durableId, i => i.returnedThreads[0].replies[0].durableId = i.returnedThreads[0].durableId,
    i => i.returnedThreads[0].replies[0].parentRawId = 'foreign', i => i.returnedThreads[0].status = 'ORPHAN']) {
    const { input } = await fixture(); mutate(input); assert.throws(() => plan(input), /COMMENT_RETURN_/u);
  }
});

test('mixed manuscript text/revisions, cross-scene routing and malformed range are blocked', async () => {
  for (const mutate of [i => i.returnedParagraphs[0].paragraphText += ' changed', i => i.returnedParagraphs[0].trackedRevision = true,
    i => i.exportMap.scenes[0].sceneId = 'foreign', i => i.returnedThreads[0].finalTextAnchorRange.startUtf16++,
    i => i.returnedThreads[0].finalTextAnchorRange.blockTextSha256 = '0'.repeat(64)]) {
    const { input } = await fixture(); mutate(input); assert.throws(() => plan(input), /COMMENT_RETURN_|COMMENT_ANCHOR_/u);
  }
});

test('literal body/provenance budgets and invalid Unicode refuse before serialization', async () => {
  for (const value of ['', 'x'.repeat(16385), 'bad\u0000', '\ud800']) {
    const { input } = await fixture(); input.returnedThreads[0].body = value;
    assert.throws(() => plan(input), /COMMENT_RETURN_BODY_INVALID/u);
  }
  const { input } = await fixture(); input.returnedThreads[0].authorPersonIdentity.author = '\ud800';
  assert.throws(() => plan(input), /COMMENT_RETURN_PROVENANCE_INVALID/u);
});

test('atomic return port recovers failures before publication and reconciles a completed rename', async t => {
  const fs = require('node:fs/promises'), os = require('node:os'), path = require('node:path');
  const runtime = await import('../../src/io/revisionBridge/reviewTransportNonTextReturnRuntime.mjs');
  const { atomicWriteFile } = await import('../../src/io/markdown/atomicWriteFile.mjs');
  for (const failure of ['recovery', 'before-canonical', 'after-canonical', 'none']) {
    const { input } = await fixture(); input.returnedThreads[0].body = 'Word changed';
    const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'comment-delta-port-'));
    t.after(() => fs.rm(projectRoot, { recursive: true, force: true }));
    const target = path.join(projectRoot, '.yalken/word-review/non-text-return-state.v1.json');
    await fs.mkdir(path.dirname(target), { recursive: true }); await fs.writeFile(target, input.beforeText);
    let writes = 0, checks = 0;
    const options = { publish: operation => operation(), revalidate: async () => { checks++; },
      atomicWriter: async (file, bytes, opts) => {
        writes++;
        if (failure === 'recovery' && writes === 1 || failure === 'before-canonical' && writes === 2) throw new Error('INJECTED');
        await atomicWriteFile(file, bytes, opts);
        if (failure === 'after-canonical' && writes === 2) throw new Error('INJECTED');
      } };
    const run = () => runtime.commitAuthenticatedCommentDelta({ ...input, projectRoot }, options);
    if (failure === 'none') assert.equal((await run()).writerCalled, true);
    else await assert.rejects(run, /INJECTED/u);
    const disk = await fs.readFile(target, 'utf8');
    if (['recovery', 'before-canonical'].includes(failure)) assert.equal(disk, input.beforeText);
    else {
      assert.equal(JSON.parse(disk).threads[0].messages[0].body, 'Word changed');
      const count = writes, repeated = await run();
      assert.equal(repeated.replay, true); assert.equal(repeated.writerCalled, false); assert.equal(writes, count);
      assert.equal(await fs.readFile(path.join(projectRoot, '.yalken/recovery/non-text-return-state.v1.json'), 'utf8'), input.beforeText);
    }
    assert.ok(checks > 0);
  }
});

test('return port requires publication authority and rejects lease loss without canonical changes', async t => {
  const fs = require('node:fs/promises'), os = require('node:os'), path = require('node:path');
  const runtime = await import('../../src/io/revisionBridge/reviewTransportNonTextReturnRuntime.mjs');
  const { input } = await fixture(); input.returnedThreads[0].body = 'Changed';
  await assert.rejects(() => runtime.commitAuthenticatedCommentDelta(input), /AUTHORITY_REQUIRED/u);
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'comment-delta-lease-'));
  t.after(() => fs.rm(projectRoot, { recursive: true, force: true }));
  const target = path.join(projectRoot, '.yalken/word-review/non-text-return-state.v1.json');
  await fs.mkdir(path.dirname(target), { recursive: true }); await fs.writeFile(target, input.beforeText);
  let checks = 0;
  await assert.rejects(() => runtime.commitAuthenticatedCommentDelta({ ...input, projectRoot }, {
    publish: operation => operation(), revalidate: async () => { if (++checks === 3) throw new Error('LEASE_LOST'); },
  }), /LEASE_LOST/u);
  assert.equal(await fs.readFile(target, 'utf8'), input.beforeText);
});

test('actual main command with real project lease applies once; forged admission, dirty editor and stale intake cannot write', async t => {
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
  const sandbox = { path, fs, Buffer, computeHash: hash,
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
  const revisionBridge = await import('../../src/io/revisionBridge/index.mjs');
  const run = (explicitCanonicalApplyConfirmed, docxBytes = bytes) => ctx.applyAuthenticatedCommentDelta({ context, docxBytes, revisionBridge,
    requestId: 'test', explicitCanonicalApplyConfirmed, isCurrent: () => current });
  assert.equal((await kernel.dispatch('cmd.rtk.review.applyCommentLifecycleReturn', { action: 'authenticated-comment-delta' })).error.code, 'COMMENT_RETURN_ADMISSION_REQUIRED');
  assert.equal((await run(false)).status, 'preview-ready'); assert.equal(await fs.readFile(stateFile, 'utf8'), input.beforeText);
  assert.equal((await run(true, Buffer.from('foreign'))).code, 'COMMENT_RETURN_ARTIFACT_MISMATCH');
  const parts = revisionBridge.extractDocxReviewTransportPackagePartsFromZipBytes({ bytes }).parts;
  const originalComments = parts['word/comments.xml'];
  parts['word/comments.xml'] = originalComments.replace('<w:r>', '<w:r><w:rPr><w:b/></w:rPr>');
  assert.notEqual(parts['word/comments.xml'], originalComments);
  const richBytes = require('../../src/export/docx/docxMinBuilder.js').buildStoredZip(Object.entries(parts).map(([name, data]) => ({ name, data })));
  context.reviewTransportReturnIntake.returnedArtifactSha256 = hash(richBytes);
  const richAnalysis = revisionBridge.buildDocxReviewTransportAnalysisFromZipBytes({ bytes: richBytes },
    { cryptoPort: sandbox.createRtkReviewTransportCryptoPort() });
  assert.equal(richAnalysis.reviewIr.commentBodyGrammar.status, 'UNSUPPORTED');
  context.reviewTransportReturnIntake.parserResult = richAnalysis;

  assert.equal((await run(true, richBytes)).code, 'DOCX_GENERIC_COMMENT_METADATA_UNSUPPORTED');
  assert.equal(await fs.readFile(stateFile, 'utf8'), input.beforeText);
  context.reviewTransportReturnIntake.returnedArtifactSha256 = input.artifactSha256;
  context.reviewTransportReturnIntake.parserResult = { reviewIr };

  draft = true; assert.equal((await run(true)).code, 'COMMENT_SAVE_SCENE_FIRST'); draft = false;
  current = false; assert.equal((await run(true)).code, 'COMMENT_RETURN_AUTHORITY_REQUIRED'); current = true;
  const result = await run(true); assert.equal(result.ok, true, JSON.stringify(result)); assert.equal(result.writerCalled, true);
  const after = await fs.readFile(stateFile, 'utf8'); assert.equal(JSON.parse(after).threads[0].messages[0].body, 'Main Word delta');
  assert.equal((await run(true)).status, 'replayed'); assert.equal(await fs.readFile(stateFile, 'utf8'), after);
  sandbox.isDirty = true; assert.equal((await run(true)).code, 'COMMENT_RETURN_CONTEXT_STALE');
});

test('Word minute rounding preserves original provenance; unrelated author or date changes are conflicts', async () => {
  const { input } = await fixture();
  // The exported original contains seconds; the actual Mac provider drops them.
  const before = JSON.parse(input.beforeText);
  before.threads[0].messages[0].provenance.date = '2026-09-26T00:00:52.402Z';
  input.baseline.threads[0].messages[0].provenance.date = '2026-09-26T00:00:52.402Z';
  input.baseline.stateDigest = hash(stable(before)); input.beforeText = JSON.stringify(before);
  input.returnedThreads[0].body = 'Word body edit';
  const after = JSON.parse(plan(input).afterText);
  assert.equal(after.threads[0].messages[0].provenance.date, '2026-09-26T00:00:52.402Z');
  input.returnedThreads[0].date = '2026-09-25T00:00:00Z';
  assert.throws(() => plan(input), /PROVENANCE_CHANGED/u);
  input.returnedThreads[0].date = '2026-09-26T00:00:00Z';
  input.returnedThreads[0].authorPersonIdentity.author = 'Another author';
  assert.throws(() => plan(input), /AUTHOR_CHANGED/u);
});

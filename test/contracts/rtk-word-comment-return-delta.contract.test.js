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
const stable = v => Array.isArray(v) ? `[${v.map(stable).join(',')}]` : v && typeof v === 'object'
  ? `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}` : JSON.stringify(v);

function setReturnedBody(message, body) {
  message.body = body;
  if (message.richBody) {
    const marks = message.richBody.document.content[0]?.content?.find(n => n.type === 'text')?.marks;
    message.richBody.document = {type:'doc',content:[{type:'paragraph',content:[{type:'text',text:body,...(marks ? {marks:structuredClone(marks)} : {})}]}]};
  }
}

async function fixture({ twoThreads = false, empty = false, threeReplies = false, richBreak = false } = {}) {
  const sceneId = 'roman/a.md', text = 'Before 🧭 anchor after';
  const state = { schemaVersion: 'yalken.rtk.word.non-text-return-state.v1', projectId: 'delta-project', revision: 2, events: [],
    threads: [{ threadId: 'thread-a', rootCommentId: 'root-a', sceneId, status: 'open',
      anchor: exactAnchor({ paragraphIndex: 0, startUtf16: 7, selectedText: '🧭 anchor' }, sceneId, [text]),
      messages: [{ commentId: 'root-a', kind: 'root', body: 'Root before', provenance: { author: 'Alice', date: '2026-09-26T00:00:00Z' } },
        { commentId: 'reply-a', kind: 'reply', body: 'Reply before', provenance: { author: 'Bob' } }] }] };
  if (richBreak) {
    state.schemaVersion='yalken.rtk.word.non-text-return-state.v2';
    Object.assign(state.threads[0].messages[0], {body:'Root\nbefore',richBody:{schemaVersion:'yalken.word.comment-body.v1',document:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Root'},{type:'hardBreak'},{type:'text',text:'before'}]}]}}});
  }
  if (threeReplies) for (const suffix of ['middle', 'last']) state.threads[0].messages.push({
    commentId: 'reply-' + suffix, kind: 'reply', body: 'Reply ' + suffix, provenance: { author: suffix } });
  if (twoThreads) {
    const second = structuredClone(state.threads[0]);
    second.threadId = 'thread-b'; second.rootCommentId = 'root-b';
    second.messages[0].commentId = 'root-b'; second.messages[1].commentId = 'reply-b';
    state.threads.push(second);
  }
  if (empty) { state.threads = []; state.revision = 0; }
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

async function deletionFixture({ partial = false, mutate } = {}) {
  const f = await fixture({ twoThreads: partial });
  const bridge = await import('../../src/io/revisionBridge/index.mjs');
  const parts = { ...bridge.extractDocxReviewTransportPackagePartsFromZipBytes({ bytes: f.bytes }).parts };
  const removed = f.source.commentExport.threads[0].messages;
  for (const m of removed) {
    parts['word/comments.xml'] = parts['word/comments.xml'].replace(new RegExp(`<w:comment w:id="${m.commentId}"[^]*?</w:comment>`), '');
    parts['word/commentsExtended.xml'] = parts['word/commentsExtended.xml'].replace(new RegExp(`<w15:commentEx w15:paraId="${m.paraId}"[^>]*?/>`), '');
    parts['word/commentsIds.xml'] = parts['word/commentsIds.xml'].replace(new RegExp(`<w16cid:commentId w16cid:paraId="${m.paraId}"[^>]*?/>`), '');
    parts['word/commentsExtensible.xml'] = parts['word/commentsExtensible.xml'].replace(new RegExp(`<w16cex:commentExtensible w16cex:durableId="${m.durableId}"[^>]*?/>`), '');
    parts['word/document.xml'] = parts['word/document.xml'].replace(new RegExp(`<w:(?:commentRangeStart|commentRangeEnd|commentReference) w:id="${m.commentId}"/>`, 'gu'), '');
  }
  if (!partial) {
    for (const name of Object.keys(parts).filter(name => name.startsWith('word/comments'))) delete parts[name];
    parts['word/_rels/document.xml.rels'] = parts['word/_rels/document.xml.rels'].replace(/<Relationship\b[^>]*\bType="[^"]*\/comments[^"]*"[^>]*\/>/gu, '');
    parts['[Content_Types].xml'] = parts['[Content_Types].xml'].replace(/<Override\b[^>]*\bPartName="\/word\/comments[^"]*"[^>]*\/>/gu, '');
  }
  if (mutate) mutate(parts, f);
  const returned = require('../../src/export/docx/docxMinBuilder.js').buildStoredZip(Object.entries(parts).map(([name, data]) => ({ name, data })));
  const parsed = bridge.buildDocxReviewTransportAnalysisFromZipBytes({ bytes: returned }, { cryptoPort: {
    sha256Text: hash, sha256Json: v => 'sha256:' + hash(stable(v)), byteLength: v => Buffer.byteLength(v) } });
  return { ...f, parsed, input: { ...f.input, artifactSha256: hash(returned),
    returnedThreads: parsed.reviewIr?.commentThreads, returnedParagraphs: parsed.reviewIr?.formattingParagraphs,
    commentReturnInventory: parsed.reviewIr?.commentReturnInventory } };
}

for (const partial of [false, true]) test(`whole-thread absence (${partial ? 'partial' : 'last thread'}) preserves all history, rejects races and replays once`, async () => {
  const { input, state, parsed } = await deletionFixture({ partial });
  assert.equal(parsed.ok, true);
  assert.equal(input.commentReturnInventory.status, 'COMPLETE');
  assert.equal(input.commentReturnInventory.deletionAuthority, false);
  const result = plan(input), after = JSON.parse(result.afterText);
  assert.equal(after.threads[0].status, 'deleted');
  assert.deepEqual({ ...after.threads[0], status: state.threads[0].status }, state.threads[0]);
  assert.deepEqual(after.threads.slice(1), state.threads.slice(1));
  assert.equal(result.changes[0].deletionDecision, 'CONSISTENT_ABSENCE_REQUIRES_EXPLICIT_CONFIRMATION');
  assert.equal(plan({ ...input, beforeText: result.afterText }).replay, true);
  assert.throws(() => plan({ ...input, commentReturnInventory: undefined }), /COMMENT_RETURN_PACKAGE_INCOMPLETE/);
  const stale = structuredClone(state); stale.threads[0].messages[0].body += ' concurrent';
  assert.throws(() => plan({ ...input, beforeText: JSON.stringify(stale) }), /COMMENT_RETURN_BASELINE_CONFLICT/);
  const sceneId = state.threads[0].sceneId, text = input.returnedParagraphs[0].paragraphText;
  const reexport = makeSource({ projectId: state.projectId, projectRoot: '/project', nonTextReturnState: after,
    scenes: [{ sceneId, scenePath: '/project/' + sceneId, order: 0, text,
      doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] } }] });
  assert.equal(reexport.commentExport.tombstones.length, 1);
  assert.equal(reexport.commentExport.threads.length, partial ? 1 : 0);
  assert.deepEqual(reexport.commentExport.tombstones[0].messageIds, ['root-a', 'reply-a']);
});

test('Word may omit the whole optional extensible part, but never leave a dangling relationship or type', async () => {
  for (const dangling of ['none', 'relationship', 'type']) {
    const { input, state, parsed } = await deletionFixture({ partial: true, mutate(parts) {
      delete parts['word/commentsExtensible.xml'];
      if (dangling !== 'relationship') parts['word/_rels/document.xml.rels'] = parts['word/_rels/document.xml.rels']
        .replace(/<Relationship\b[^>]*\bTarget="commentsExtensible.xml"[^>]*\/>/gu, '');
      if (dangling !== 'type') parts['[Content_Types].xml'] = parts['[Content_Types].xml']
        .replace(/<Override\b[^>]*\bPartName="\/word\/commentsExtensible.xml"[^>]*\/>/gu, '');
    } });
    if (dangling !== 'none') {
      assert(parsed.ok === false || input.commentReturnInventory?.status === 'INCOMPLETE');
      assert.throws(() => plan(input), /COMMENT_RETURN_/);
    } else {
      assert.equal(input.commentReturnInventory.status, 'COMPLETE');
      const after = JSON.parse(plan(input).afterText);
      assert.equal(after.threads[0].status, 'deleted');
      assert.deepEqual(after.threads[0].messages, state.threads[0].messages);
      assert.deepEqual(after.threads[1], state.threads[1]);
    }
  }
});

test('lost part, dangling marker/metadata/relationship and incomplete projections never become deletion proposals', async () => {
  for (const [partial, mutate] of [
    [false, p => { p['word/document.xml'] = p['word/document.xml'].replace('</w:p>', '<w:commentReference w:id="0"/></w:p>'); }],
    [false, p => { p['word/_rels/document.xml.rels'] = p['word/_rels/document.xml.rels'].replace('</Relationships>', '<Relationship Id="lost" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments" Target="comments.xml"/></Relationships>'); }],
    [false, p => { p['[Content_Types].xml'] = p['[Content_Types].xml'].replace('</Types>', '<Override PartName="/word/comments.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml"/></Types>'); }],
    [true, p => { delete p['word/commentsIds.xml']; }],
    [true, p => { delete p['word/comments.xml']; }],
    [true, p => { p['word/commentsIds.xml'] = p['word/commentsIds.xml'].replace('</w16cid:commentsIds>', '<w16cid:commentId w16cid:paraId="AABBCCDD" w16cid:durableId="12345678"/></w16cid:commentsIds>'); }],
    [true, p => { p['word/document.xml'] = p['word/document.xml'].replace('<w:commentReference w:id="2"/>', ''); }],
    [true, p => { p['word/commentsExtensible.xml'] = p['word/commentsExtensible.xml'].replace(/<w16cex:commentExtensible\b[^>]*\/>/u, ''); }],
  ]) {
    const { input, parsed } = await deletionFixture({ partial, mutate });
    assert(parsed.ok === false || input.commentReturnInventory?.status !== 'COMPLETE');
    assert.throws(() => plan(input), /COMMENT_RETURN_/);
  }
  const { input } = await deletionFixture({ partial: true });
  input.commentReturnInventory.messageDurableIds = [];
  assert.throws(() => plan(input), /COMMENT_RETURN_PACKAGE_INCOMPLETE/);
});

test('last-thread absence reaches a diagnostic preview only with the local authenticated baseline', async () => {
  const { parsed, input } = await deletionFixture();
  const bridge = await import('../../src/io/revisionBridge/index.mjs');
  const packet = { returnedProjection: parsed.reviewIr, diagnostics: [] };
  const candidate = bridge.buildDocxReviewPreviewSessionCandidateFromEvidence(packet,
    { authenticatedCommentExport: input.baseline });
  assert.equal(candidate.status, 'diagnostics');
  assert.equal(candidate.canWriteStorage, false); assert.equal(candidate.canAutoApply, false);
  assert.deepEqual(candidate.reviewPacket.commentThreads, []);
  assert(candidate.reviewPacket.diagnosticItems.some(d => d.diagnosticId.includes('MISSING_DISCUSSIONS_REQUIRE_DECISION')));
  const generic = bridge.buildDocxReviewPreviewSessionCandidateFromEvidence(packet);
  assert.equal(generic.reviewPacket, null);
  const broken = structuredClone(packet); broken.returnedProjection.commentReturnInventory.status = 'INCOMPLETE';
  assert.equal(bridge.buildDocxReviewPreviewSessionCandidateFromEvidence(broken,
    { authenticatedCommentExport: input.baseline }).reviewPacket, null);
});

test('Word proofing language is retained as rich authoring data and unsafe metadata remains refused', async () => {
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
  assert.equal(parsed.reviewIr.commentBodyGrammar.status, 'SUPPORTED', JSON.stringify(parsed.reviewIr.commentBodyGrammar));
  const rootRich = parsed.reviewIr.commentThreads[0].richBody.document.content[0];
  assert.deepEqual(rootRich.attrs.wordParagraphMarkLanguage, {val:'ru-RU'});
  assert.deepEqual(rootRich.content.find(n=>n.type==='text').marks.find(m=>m.type==='textStyle').attrs.wordLanguage,
    {val:'ru-RU',eastAsia:'ja-JP',bidi:'ar-SA'});
  const result = plan({ ...input, artifactSha256: hash(returned), returnedThreads: parsed.reviewIr.commentThreads,
    returnedParagraphs: parsed.reviewIr.formattingParagraphs });
  const after = JSON.parse(result.afterText);
  assert.equal(after.threads[0].messages[0].body, 'Из Word 🧭');
  assert.deepEqual(after.threads[0].messages[1], state.threads[0].messages[1]);
  assert.deepEqual(after.threads[0].anchor, state.threads[0].anchor);
  assert.doesNotThrow(() => validateGenericCommentMetadataV1({ ...parts, 'word/comments.xml': changed }, options));
  for (const bad of [
    changed.replace('ru-RU', '../../foreign'),
    changed.replace('w:lang w:val', 'w:lang w:unknown'),
    changed.replace('<w:lang', '<w:vanish/><w:lang'),
    changed.replace('<w:lang', '<w:rStyle w:val="Hidden"/><w:lang'),
    changed.replace('<w:lang', '<w:drawing/><w:lang'),
    changed.replace('002E54A5', 'command'),
    changed.replace('w:val="ru-RU"/>', 'w:val="ru-RU">unrepresented</w:lang>'),
  ]) assert.equal(analyze(bad).parsed.reviewIr.commentBodyGrammar.status, 'UNSUPPORTED', bad);
});

test('native Unicode reply font fallback survives typed rich return', async () => {
  const { bytes, input, state } = await fixture();
  const bridge = await import('../../src/io/revisionBridge/index.mjs');
  const { validateGenericCommentMetadataV1 } = await import('../../src/io/revisionBridge/reviewTransportPackageParserV2.mjs');
  const parts = bridge.extractDocxReviewTransportPackagePartsFromZipBytes({ bytes }).parts;
  const options = { cryptoPort: { sha256Text: hash, sha256Json: v => 'sha256:' + hash(stable(v)), byteLength: v => Buffer.byteLength(v) } };
  const font = '<w:rFonts w:ascii="Segoe UI Symbol" w:hAnsi="Segoe UI Symbol" w:cs="Segoe UI Symbol"/>';
  const changed = parts['word/comments.xml'].replace(/<w:t(?: xml:space="preserve")?>Reply before<\/w:t>/u,
    '<w:t xml:space="preserve">Reply edited 🧭 — </w:t></w:r><w:r><w:rPr>' + font + '</w:rPr><w:t>✓</w:t>');
  assert(changed.includes(font));
  const analyze = xml => {
    const returned = require('../../src/export/docx/docxMinBuilder.js').buildStoredZip(
      Object.entries({ ...parts, 'word/comments.xml': xml }).map(([name, data]) => ({ name, data })));
    return { returned, parsed: bridge.buildDocxReviewTransportAnalysisFromZipBytes({ bytes: returned }, options) };
  };
  const { returned, parsed } = analyze(changed);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.reviewIr.commentBodyGrammar.status, 'SUPPORTED', JSON.stringify(parsed.reviewIr.commentBodyGrammar));
  const symbol = parsed.reviewIr.commentThreads[0].replies[0].richBody.document.content[0].content.find(n=>n.text === '✓');
  assert.equal(symbol.marks.find(m=>m.type==='textStyle').attrs.fontFamily,'Segoe UI Symbol');
  const after = JSON.parse(plan({ ...input, artifactSha256: hash(returned), returnedThreads: parsed.reviewIr.commentThreads,
    returnedParagraphs: parsed.reviewIr.formattingParagraphs }).afterText);
  const expected = structuredClone(state.threads); expected[0].messages[1].body = 'Reply edited 🧭 — ✓';
  expected[0].messages[1].richBody = after.threads[0].messages[1].richBody;
  assert.equal(expected[0].messages[1].richBody.document.content[0].content.find(n=>n.text==='✓').marks.find(m=>m.type==='textStyle').attrs.fontFamily,'Segoe UI Symbol');
  assert.deepEqual(after.threads, expected);
  assert.doesNotThrow(() => validateGenericCommentMetadataV1({ ...parts, 'word/comments.xml': changed }, options));
  for (const badFont of [
    '<w:rFonts/>', font + font, font.replace('w:ascii=', 'w:asciiTheme='),
    font.replace('w:ascii=', 'w:hint='), font.replace('Segoe UI Symbol', ''),
    font.replace('Segoe UI Symbol', 'x'.repeat(129)), font.replace('Segoe UI Symbol', 'bad&#10;font'),
    font.replace('/>', '>unrepresented</w:rFonts>'), font.replace('/>', '><w:lang w:val="en-US"/></w:rFonts>'),
    '<w:vanish/>' + font, '<w:rStyle w:val="Hidden"/>' + font,
  ]) assert.equal(analyze(changed.replace(font, badFont)).parsed.reviewIr.commentBodyGrammar.status, 'UNSUPPORTED', badFont);
});

test('one delta preserves canonical IDs and combines root/reply edits, resolution and a proved range', async () => {
  const { input, state } = await fixture(), t = input.returnedThreads[0];
  setReturnedBody(t, '  Changed 🧭 root\nsecond line '); setReturnedBody(t.replies[0], 'Changed reply'); t.status = 'RESOLVED';
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

test('native Word reply style resolves and preserves definitions, defaults and parent', async () => {
  const { bytes, input, state } = await fixture();
  const bridge = await import('../../src/io/revisionBridge/index.mjs');
  const { validateGenericCommentMetadataV1 } = await import('../../src/io/revisionBridge/reviewTransportPackageParserV2.mjs');
  const parts = bridge.extractDocxReviewTransportPackagePartsFromZipBytes({ bytes }).parts;
  const options = { cryptoPort: { sha256Text: hash, sha256Json: v => 'sha256:' + hash(stable(v)), byteLength: v => Buffer.byteLength(v) } };
  const ns = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const styles = `<w:styles xmlns:w="${ns}"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="24"/><w:lang w:val="ru-FI"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="278" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="a"><w:name w:val="Normal"/><w:qFormat/></w:style><w:style w:type="paragraph" w:styleId="a3"><w:name w:val="annotation text"/><w:basedOn w:val="a"/><w:link w:val="a4"/><w:uiPriority w:val="99"/><w:semiHidden/><w:unhideWhenUsed/><w:pPr><w:spacing w:line="240" w:lineRule="auto"/></w:pPr><w:rPr><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr></w:style></w:styles>`;
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
  assert.equal(parsed.reviewIr.commentBodyGrammar.status, 'SUPPORTED', JSON.stringify(parsed.reviewIr.commentBodyGrammar));
  const parsedReply = parsed.reviewIr.commentThreads[0].replies.at(-1);
  assert.equal(parsedReply.richBody.document.content[0].content.find(n=>n.type==='text').marks.find(m=>m.type==='textStyle').attrs.fontSize, '10pt');
  const planned = plan({ ...input, artifactSha256: hash(returned), returnedThreads: parsed.reviewIr.commentThreads,
    returnedParagraphs: parsed.reviewIr.formattingParagraphs });
  const after = JSON.parse(planned.afterText);
  for (const [i,message] of after.threads[0].messages.slice(0,2).entries()) {
    assert.equal(message.body,state.threads[0].messages[i].body);
    assert.deepEqual(message.provenance,state.threads[0].messages[i].provenance);
    assert.equal(message.richBody.document.content[0].content[0].marks.find(m=>m.type==='textStyle').attrs.fontFamily,'Times New Roman');
  }
  assert.deepEqual(after.threads[0].anchor, state.threads[0].anchor);
  const reply = after.threads[0].messages[2];
  assert.equal(reply.body, 'Ответ 🧭 مرحبا');
  assert.equal(reply.provenance.author, 'Carol');
  assert.match(reply.commentId, /^word-reply-[a-f0-9]{64}$/u);
  assert.doesNotThrow(() => validateGenericCommentMetadataV1(returnedParts, options));
  assert.equal(analyze(styles.replaceAll('a3', 'LocalizedComment'), comments.replaceAll('a3', 'LocalizedComment')).parsed.reviewIr.commentBodyGrammar.status, 'SUPPORTED');
  for (const bad of [
    styles.replace('<w:sz w:val="20"/>', '<w:vanish/>'),
    styles.replace('<w:qFormat/>', '<w:rPr><w:vanish/></w:rPr>'),
    styles.replace('<w:sz w:val="24"/>', '<w:vanish/>'),
    styles.replace('<w:spacing w:line="240" w:lineRule="auto"/>', '<w:numPr><w:numId w:val="1"/></w:numPr>'),
    styles.replace('w:basedOn w:val="a"', 'w:basedOn w:val="a3"'),
    styles.replace('w:basedOn w:val="a"', 'w:basedOn w:val="missing"'),
    styles.replace('w:type="paragraph" w:styleId="a3"', 'w:type="character" w:styleId="a3"'),
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
  const { input } = await fixture(); setReturnedBody(input.returnedThreads[0], 'Changed');
  const result = plan(input); const replay = { ...input, beforeText: result.afterText };
  assert.equal(plan(replay).replay, true);
  const altered = structuredClone(replay); setReturnedBody(altered.returnedThreads[0], 'Different');
  assert.throws(() => plan(altered), /COMMENT_RETURN_REPLAY_CONFLICT/u);
  const state = JSON.parse(result.afterText); state.revision++;
  assert.throws(() => plan({ ...replay, beforeText: JSON.stringify(state) }), /COMMENT_RETURN_REPLAY_CONFLICT/u);
});

test('concurrent local body/status/anchor change and revision-only change cannot be overwritten', async () => {
  for (const mutate of [s => s.revision++, s => s.threads[0].messages[0].body = 'local',
    s => s.threads[0].status = 'resolved', s => s.threads[0].anchor.startUtf16++]) {
    const { input, state } = await fixture(); setReturnedBody(input.returnedThreads[0], 'Word'); mutate(state);
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
    const { input } = await fixture(); setReturnedBody(input.returnedThreads[0], value);
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
    const { input } = await fixture(); setReturnedBody(input.returnedThreads[0], 'Word changed');
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
  const { input } = await fixture(); setReturnedBody(input.returnedThreads[0], 'Changed');
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
  const { input, source, bytes, reviewIr } = await fixture(); setReturnedBody(input.returnedThreads[0], 'Main Word delta');
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
  installMainDocxRoundAuthority(sandbox, { projectRoot: root, references: [context.reviewTransportAuthorityCapsule], publishAllocated: true });
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
  const supportedProfile=reviewIr.commentBodyGrammar.profile;
  reviewIr.commentBodyGrammar.profile='UNKNOWN_RICH_PROFILE';
  assert.equal((await run(false)).status,'blocked');assert.equal(await fs.readFile(stateFile,'utf8'),input.beforeText);
  reviewIr.commentBodyGrammar.profile=supportedProfile;
  assert.equal((await run(false)).status, 'preview-ready'); assert.equal(await fs.readFile(stateFile, 'utf8'), input.beforeText);
  assert.equal((await run(true, Buffer.from('foreign'))).code, 'COMMENT_RETURN_ARTIFACT_MISMATCH');
  const parts = revisionBridge.extractDocxReviewTransportPackagePartsFromZipBytes({ bytes }).parts;
  const originalComments = parts['word/comments.xml'];
  parts['word/comments.xml'] = originalComments.replace('<w:r>', '<w:r><w:rPr><w:vanish/></w:rPr>');
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
  setReturnedBody(input.returnedThreads[0], 'Word body edit');
  const after = JSON.parse(plan(input).afterText);
  assert.equal(after.threads[0].messages[0].provenance.date, '2026-09-26T00:00:52.402Z');
  input.returnedThreads[0].date = '2026-09-25T00:00:00Z';
  assert.throws(() => plan(input), /PROVENANCE_CHANGED/u);
  input.returnedThreads[0].date = '2026-09-26T00:00:00Z';
  input.returnedThreads[0].authorPersonIdentity.author = 'Another author';
  assert.throws(() => plan(input), /AUTHOR_CHANGED/u);
});


// Generated OOXML passes through the actual parser; the authenticated baseline
// remains the pre-edit graph rather than adopting authority from the new export.
async function addedRootFixture({ empty = false, partialMetadata = false, corruptMetadata = false } = {}) {
  const f = await fixture({ empty });
  const sceneId = 'roman/a.md', text = f.input.returnedParagraphs[0].paragraphText;
  const edited = structuredClone(f.state);
  edited.threads.push({ threadId: 'provider-created', rootCommentId: 'provider-root', sceneId, status: 'open',
    anchor: exactAnchor({ paragraphIndex: 0, startUtf16: 0, selectedText: 'Before ' }, sceneId, [text]),
    messages: [{ commentId: 'provider-root', kind: 'root', body: 'New Word discussion', provenance: { author: 'Reviewer' } },
      { commentId: 'provider-reply', kind: 'reply', body: 'New Word reply', provenance: { author: 'Second reviewer' } }] });
  const source = makeSource({ projectId: f.state.projectId, projectRoot: '/project', nonTextReturnState: edited,
    scenes: [{ sceneId, scenePath: '/project/' + sceneId, order: 0, text,
      doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] } }] });
  const bridge = await import('../../src/io/revisionBridge/index.mjs');
  let bytes = buildDocxReviewPacketBuffer(source);
  if (partialMetadata) {
    const parts = { ...bridge.extractDocxReviewTransportPackagePartsFromZipBytes({ bytes }).parts };
    const oldIds = new Set(f.source.commentExport.threads.flatMap(t => t.messages.map(m => m.durableId)));
    parts['word/commentsExtensible.xml'] = parts['word/commentsExtensible.xml'].replace(/<w16cex:commentExtensible\b[^>]*\/>/gu,
      tag => [...oldIds].some(id => tag.includes('durableId="' + id + '"')) ? '' : tag);
    if (corruptMetadata) parts['word/commentsExtensible.xml'] = parts['word/commentsExtensible.xml'].replace('</w16cex:commentsExtensible>',
      '<w16cex:commentExtensible w16cex:durableId="FFFFFFFF"/></w16cex:commentsExtensible>');
    bytes = require('../../src/export/docx/docxMinBuilder.js').buildStoredZip(Object.entries(parts).map(([name, data]) => ({ name, data })));
  }
  const parsed = bridge.buildDocxReviewTransportAnalysisFromZipBytes({ bytes }, { cryptoPort: {
    sha256Text: hash, sha256Json: v => 'sha256:' + hash(stable(v)), byteLength: v => Buffer.byteLength(v) } });
  assert.equal(parsed.ok, true);
  return { ...f, input: { ...f.input, beforeText: empty ? null : f.input.beforeText, artifactSha256: hash(bytes),
    returnedThreads: parsed.reviewIr.commentThreads, returnedParagraphs: parsed.reviewIr.formattingParagraphs,
    commentReturnInventory: parsed.reviewIr.commentReturnInventory } };
}

for (const empty of [false, true]) test(`new Word root (${empty ? 'first ever' : 'existing graph'}) preserves peers, canonicalizes IDs and replays once`, async () => {
  const { input, state } = await addedRootFixture({ empty });
  const { compareCommentExportReadback } = require('../../src/export/docx/docxReviewPacketComments.js');
  const comparison = compareCommentExportReadback(input.baseline, input.returnedThreads);
  assert.equal(comparison.ok, false);
  assert(comparison.changed.some(item => item.code === 'COMMENT_ROOT_ADDED'));
  const result = plan(input), after = JSON.parse(result.afterText);
  assert.equal(after.threads.length, state.threads.length + 1);
  assert.deepEqual(after.threads.slice(0, state.threads.length), state.threads);
  const added = after.threads.at(-1);
  assert.match(added.threadId, /^word-thread-[a-f0-9]{64}$/);
  assert.match(added.rootCommentId, /^word-root-[a-f0-9]{64}$/);
  assert.equal(added.messages[0].body, 'New Word discussion');
  assert.equal(added.messages[0].provenance.author, 'Reviewer');
  assert.equal(added.messages[1].body, 'New Word reply');
  assert.equal(added.anchor.selectedText, 'Before '); assert.equal(added.anchor.startUtf16, 0);
  assert.equal(result.changes.length, 1); assert.equal(result.changes[0].created, true);
  assert.equal(plan({ ...input, beforeText: result.afterText }).replay, true);
  assert.equal(JSON.parse(plan({ ...input, beforeText: result.afterText }).afterText).threads.length, after.threads.length);
  // Re-export generated canonical identities and independently parse them.
  const text = input.returnedParagraphs[0].paragraphText, sceneId = added.sceneId;
  const source = makeSource({ projectId: state.projectId, projectRoot: '/project', nonTextReturnState: after,
    scenes: [{ sceneId, scenePath: '/project/' + sceneId, order: 0, text,
      doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] } }] });
  const bridge = await import('../../src/io/revisionBridge/index.mjs');
  const parsed = bridge.buildDocxReviewTransportAnalysisFromZipBytes({ bytes: buildDocxReviewPacketBuffer(source) }, { cryptoPort: {
    sha256Text: hash, sha256Json: v => 'sha256:' + hash(stable(v)), byteLength: v => Buffer.byteLength(v) } });
  assert.equal(parsed.ok, true);
  assert.equal(compareCommentExportReadback(source.commentExport, parsed.reviewIr.commentThreads).ok, true);
  assert.equal(plan({ ...input, beforeText: result.afterText, baseline: source.commentExport, roundId: 'fresh-round',
    returnedThreads: parsed.reviewIr.commentThreads, commentReturnInventory: parsed.reviewIr.commentReturnInventory }).unchanged, true);
});

test('new roots require complete inventory, fresh graph and exact scene anchors; identities never resurrect', async () => {
  for (const mutate of [i => delete i.commentReturnInventory,
    i => i.commentReturnInventory.messageDurableIds.pop(),
    i => i.returnedThreads.at(-1).paragraphIndex = 1234,
    i => i.returnedThreads.at(-1).finalTextAnchorRange.startUtf16++,
    i => i.returnedThreads.at(-1).durableId = i.returnedThreads[0].replies[0].durableId,
    i => i.baseline.tombstones = [{ messageDurableIds: [i.returnedThreads.at(-1).durableId] }],
    i => i.returnedThreads.at(-1).replies[0].parentRawId = 'foreign',
    i => i.returnedParagraphs[0].paragraphText += ' changed',
    i => { const current = JSON.parse(i.beforeText); current.revision++; i.beforeText = JSON.stringify(current); },
    i => i.returnedThreads.at(-1).body = '\ud800']) {
    const { input } = await addedRootFixture(); mutate(input);
    assert.throws(() => plan(input), /COMMENT_RETURN_|COMMENT_ANCHOR_/);
  }
});

test('first Word root writes readable empty recovery; failed recovery or lost lease creates no canonical graph', async t => {
  const fs = require('node:fs/promises'), os = require('node:os'), path = require('node:path');
  const runtime = await import('../../src/io/revisionBridge/reviewTransportNonTextReturnRuntime.mjs');
  const { atomicWriteFile } = await import('../../src/io/markdown/atomicWriteFile.mjs');
  for (const failure of ['recovery', 'before-canonical', 'after-canonical', 'none']) {
    const { input, state } = await addedRootFixture({ empty: true });
    const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'first-word-root-'));
    t.after(() => fs.rm(projectRoot, { recursive: true, force: true }));
    const target = path.join(projectRoot, '.yalken/word-review/non-text-return-state.v1.json');
    let writes = 0;
    const opts = { publish: fn => fn(), revalidate: async () => {}, atomicWriter: async (file, bytes, options) => {
      writes++;
      if (failure === 'recovery' && writes === 1 || failure === 'before-canonical' && writes === 2) throw new Error('INJECTED');
      await atomicWriteFile(file, bytes, options);
      if (failure === 'after-canonical' && writes === 2) throw new Error('INJECTED');
    } };
    const run = () => runtime.commitAuthenticatedCommentDelta({ ...input, projectRoot }, opts);
    if (failure === 'none') assert.equal((await run()).writerCalled, true);
    else await assert.rejects(run, /INJECTED/);
    if (['recovery', 'before-canonical'].includes(failure)) await assert.rejects(fs.stat(target), { code: 'ENOENT' });
    else {
      assert.equal(JSON.parse(await fs.readFile(target, 'utf8')).threads.length, 1);
      const count = writes;
      assert.equal((await run()).replay, true); assert.equal(writes, count);
    }
    if (failure !== 'recovery') assert.deepEqual(JSON.parse(await fs.readFile(path.join(projectRoot,
      '.yalken/recovery/non-text-return-state.v1.json'), 'utf8')), state);
  }
});


test('native-style partial optional UTC metadata proves additions but never deletion or dangling identity', async () => {
  const { input } = await addedRootFixture({ partialMetadata: true });
  assert.equal(input.commentReturnInventory.status, 'COMPLETE_BODY_GRAPH');
  assert.equal(plan(input).changes[0].created, true);
  const partial = await deletionFixture({ partial: true, mutate(parts) {
    parts['word/commentsExtensible.xml'] = parts['word/commentsExtensible.xml'].replace(/<w16cex:commentExtensible\b[^>]*\/>/u, '');
  } });
  assert.equal(partial.input.commentReturnInventory.status, 'COMPLETE_BODY_GRAPH');
  assert.throws(() => plan(partial.input), /COMMENT_RETURN_PACKAGE_INCOMPLETE/);
  const corrupt = await addedRootFixture({ partialMetadata: true, corruptMetadata: true });
  assert.equal(corrupt.input.commentReturnInventory.status, 'INCOMPLETE');
  assert.throws(() => plan(corrupt.input), /COMMENT_RETURN_PACKAGE_INCOMPLETE/);
});

async function replyDeletionFixture({ removedIndex = 1, mutate } = {}) {
  const f = await fixture({ threeReplies: true });
  const bridge = await import('../../src/io/revisionBridge/index.mjs');
  const parts = { ...bridge.extractDocxReviewTransportPackagePartsFromZipBytes({ bytes: f.bytes }).parts };
  const m = f.source.commentExport.threads[0].messages[removedIndex];
  parts['word/comments.xml'] = parts['word/comments.xml'].replace(new RegExp(`<w:comment w:id="${m.commentId}"[^]*?</w:comment>`), '');
  for (const [name, tag, attr, value] of [
    ['commentsExtended', 'w15:commentEx', 'w15:paraId', m.paraId],
    ['commentsIds', 'w16cid:commentId', 'w16cid:paraId', m.paraId],
    ['commentsExtensible', 'w16cex:commentExtensible', 'w16cex:durableId', m.durableId],
  ]) parts[`word/${name}.xml`] = parts[`word/${name}.xml`].replace(new RegExp(`<${tag} ${attr}="${value}"[^>]*?/>`), '');
  parts['word/document.xml'] = parts['word/document.xml'].replace(new RegExp(`<w:(?:commentRangeStart|commentRangeEnd|commentReference) w:id="${m.commentId}"/>`, 'gu'), '');
  if (mutate) mutate(parts, f);
  const bytes = require('../../src/export/docx/docxMinBuilder.js').buildStoredZip(Object.entries(parts).map(([name, data]) => ({ name, data })));
  const parsed = bridge.buildDocxReviewTransportAnalysisFromZipBytes({ bytes }, { cryptoPort: {
    sha256Text: hash, sha256Json: v => 'sha256:' + hash(stable(v)), byteLength: v => Buffer.byteLength(v) } });
  return { ...f, parsed, removed: m, input: { ...f.input, artifactSha256: hash(bytes),
    returnedThreads: parsed.reviewIr?.commentThreads, returnedParagraphs: parsed.reviewIr?.formattingParagraphs,
    commentReturnInventory: parsed.reviewIr?.commentReturnInventory } };
}

for (const removedIndex of [1, 2, 3]) test(`delete reply ${removedIndex}: preserve root, survivors, history, replay and export tombstone`, async () => {
  const f = await replyDeletionFixture({ removedIndex });
  assert.equal(f.parsed.ok, true); assert.equal(f.input.commentReturnInventory.status, 'COMPLETE');
  const result = plan(f.input), after = JSON.parse(result.afterText), old = f.state.threads[0];
  assert.deepEqual(after.threads[0].messages, old.messages.filter((_, i) => i !== removedIndex));
  assert.deepEqual(after.threads[0].deletedMessages, [old.messages[removedIndex]]);
  assert.deepEqual(after.threads[0].anchor, old.anchor);
  assert.deepEqual(result.changes[0].deletedMessageIds, [old.messages[removedIndex].commentId]);
  assert.equal(plan({ ...f.input, beforeText: result.afterText }).replay, true);
  const sceneId = old.sceneId, text = f.input.returnedParagraphs[0].paragraphText;
  const source = makeSource({ projectId: after.projectId, projectRoot: '/project', nonTextReturnState: after,
    scenes: [{ sceneId, scenePath: '/project/' + sceneId, order: 0, text,
      doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] } }] });
  assert.deepEqual(source.commentExport.tombstones[0].messageIds, [old.messages[removedIndex].commentId]);
  assert.deepEqual(source.commentExport.threads[0].messages.map(m => m.canonicalCommentId), after.threads[0].messages.map(m => m.commentId));
  const bridge = await import('../../src/io/revisionBridge/index.mjs');
  const roundtrip = bridge.buildDocxReviewTransportAnalysisFromZipBytes({ bytes: buildDocxReviewPacketBuffer(source) },
    { cryptoPort: { sha256Text: hash, sha256Json: v => 'sha256:' + hash(stable(v)), byteLength: v => Buffer.byteLength(v) } });
  assert.equal(roundtrip.ok, true);
  assert.deepEqual([roundtrip.reviewIr.commentThreads[0].body, ...roundtrip.reviewIr.commentThreads[0].replies.map(m => m.body)], after.threads[0].messages.map(m => m.body));
  assert.throws(() => plan({ ...f.input, beforeText: result.afterText, baseline: source.commentExport,
    artifactSha256: 'a'.repeat(64), returnedThreads: f.reviewIr.commentThreads }), /IDENTITY_COLLISION/);
});

test('reply absence requires full carrier inventory, cannot hide reorder/reparent or overwrite newer state', async () => {
  const f = await replyDeletionFixture();
  for (const status of [undefined, 'INCOMPLETE', 'COMPLETE_BODY_GRAPH']) {
    const inventory = status ? { ...f.input.commentReturnInventory, status } : undefined;
    assert.throws(() => plan({ ...f.input, commentReturnInventory: inventory }), /PACKAGE_INCOMPLETE/);
  }
  const wrong = structuredClone(f.input); wrong.returnedThreads[0].replies.reverse();
  assert.throws(() => plan(wrong), /REORDERED/);
  const parent = structuredClone(f.input); parent.returnedThreads[0].replies[0].parentRawId = 'foreign';
  assert.throws(() => plan(parent), /PARENT_CHANGED/);
  const stale = structuredClone(f.state); stale.threads[0].messages[1].body = 'Concurrent change';
  assert.throws(() => plan({ ...f.input, beforeText: JSON.stringify(stale) }), /BASELINE_CONFLICT/);
  const partial = await replyDeletionFixture({ mutate(parts) {
    parts['word/commentsExtensible.xml'] = parts['word/commentsExtensible.xml'].replace(/<w16cex:commentExtensible\b[^>]*\/>/u, '');
  } });
  assert.notEqual(partial.input.commentReturnInventory?.status, 'COMPLETE');
  assert.throws(() => plan(partial.input), /COMMENT_RETURN_/);
});

test('export-only explicit UTC transport survives return without rewriting canonical provenance', async () => {
  const f = await fixture();
  const root = f.source.commentExport.threads[0].messages[0];
  assert.equal(root.transportDateUtc, f.state.threads[0].messages[0].provenance.date);
  assert.equal(root.provenance.dateUtc, undefined);
  assert.equal(f.reviewIr.commentThreads[0].dateUtc, root.transportDateUtc);
  assert.equal(plan(f.input).unchanged, true);
  setReturnedBody(f.input.returnedThreads[0], 'edited');
  assert.deepEqual(JSON.parse(plan(f.input).afterText).threads[0].messages[0].provenance, f.state.threads[0].messages[0].provenance);
  f.input.returnedThreads[0].dateUtc = '2026-09-25T00:00:00Z';
  assert.throws(() => plan(f.input), /PROVENANCE_CHANGED/);
  const sceneId = f.state.threads[0].sceneId, text = f.input.returnedParagraphs[0].paragraphText;
  for (const date of [undefined, '2026-09-26T10:20:00', '2026-02-31T00:00:00Z', 'unknown']) {
    const state = structuredClone(f.state);state.threads[0].messages[0].provenance = date ? { author: 'Alice', date } : { author: 'Alice' };
    const source = makeSource({ projectId: state.projectId, projectRoot: '/project', nonTextReturnState: state,
      scenes: [{ sceneId, scenePath: '/project/' + sceneId, order: 0, text,
        doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] } }] });
    assert.equal(source.commentExport.threads[0].messages[0].transportDateUtc, undefined);
    assert.deepEqual(source.commentExport.threads[0].messages[0].provenance, state.threads[0].messages[0].provenance);
  }
});

test('format-only root and reply deltas upgrade state, replay exactly and explicitly clear stale rich content', async () => {
  const { input, state } = await fixture();
  const enriched = structuredClone(input.returnedThreads);
  const rich = (body, type) => ({ schemaVersion:'yalken.word.comment-body.v1', document:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:body,marks:[{type}]}]}]} });
  enriched[0].richBody = rich(enriched[0].body,'bold');
  enriched[0].replies[0].richBody = rich(enriched[0].replies[0].body,'italic');
  const changedInput = {...input, returnedThreads:enriched};
  const result=plan(changedInput), after=JSON.parse(result.afterText);
  assert.equal(after.schemaVersion,'yalken.rtk.word.non-text-return-state.v2');
  assert.deepEqual(result.changes[0].messageIds,['root-a','reply-a']);
  assert.equal(after.threads[0].messages[0].body,state.threads[0].messages[0].body);
  assert.deepEqual(after.threads[0].messages[0].provenance,state.threads[0].messages[0].provenance);
  assert.equal(plan({...changedInput,beforeText:result.afterText}).replay,true);
  const clearInput={...input,beforeText:result.afterText,roundId:'clear-rich-format',artifactSha256:'e'.repeat(64),baseline:{...input.baseline,stateDigest:hash(stable(after)),stateRevision:after.revision,threads:input.baseline.threads.map((t,i)=>({...t,messages:t.messages.map((m,j)=>({...m,richBody:after.threads[i].messages[j].richBody}))}))}};
  clearInput.returnedThreads=structuredClone(input.returnedThreads);
  delete clearInput.returnedThreads[0].richBody;delete clearInput.returnedThreads[0].replies[0].richBody;
  const cleared=plan(clearInput), final=JSON.parse(cleared.afterText);
  assert.equal(final.schemaVersion,'yalken.rtk.word.non-text-return-state.v2');
  assert.equal(final.threads[0].messages[0].richBody,undefined);
  assert.equal(final.threads[0].messages[1].richBody,undefined);
  const malformed=structuredClone(changedInput);malformed.returnedThreads[0].richBody.document.content[0].content[0].text='different';
  assert.throws(()=>plan(malformed),/COMMENT_BODY_PROJECTION_MISMATCH/);
});

test('prior-round baseline lacking rich transport projection derives only its authenticated export typography',async()=>{
 const {input}=await fixture();for(const thread of input.baseline.threads)for(const message of thread.messages)delete message.transportRichBody;
 const before=input.beforeText;
 assert.equal(plan(input).unchanged,true);assert.equal(plan(input).afterText,before);
 const changed=structuredClone(input);
 changed.returnedThreads[0].richBody.document.content[0].content[0].marks.find(m=>m.type==='textStyle').attrs.fontSize='14pt';
 const result=plan(changed),after=JSON.parse(result.afterText);
 assert.equal(after.threads[0].messages[0].body,JSON.parse(before).threads[0].messages[0].body);
 assert.equal(after.threads[0].messages[0].richBody.document.content[0].content[0].marks.find(m=>m.type==='textStyle').attrs.fontSize,'14pt');
 const forged=structuredClone(input);forged.exportMap.exportTypography.schemaVersion='unknown-profile';assert.throws(()=>plan(forged),/TYPOGRAPHY_INVALID/);
});

test('formatting only a line break is a comment delta, while text and other messages remain exact',async()=>{
 const {input,state,source}=await fixture({richBreak:true});
 assert.equal(plan(input).unchanged,true);
 const changed=structuredClone(input),line=changed.returnedThreads[0].richBody.document.content[0].content.find(n=>n.type==='hardBreak');
 line.marks.push({type:'underline'});
 const result=plan(changed),after=JSON.parse(result.afterText);
 assert.deepEqual(result.changes[0].messageIds,['root-a']);
 assert.equal(after.threads[0].messages[0].body,state.threads[0].messages[0].body);
 assert.deepEqual(after.threads[0].messages[1],state.threads[0].messages[1]);
 assert(after.threads[0].messages[0].richBody.document.content[0].content.find(n=>n.type==='hardBreak').marks.some(m=>m.type==='underline'));
 const {buildCanonicalCommentExport,commentPackageParts}=require('../../src/export/docx/docxReviewPacketComments.js');
 const projection=buildCanonicalCommentExport(after,source.blocks,input.projectId,{exportTypography:input.exportMap.exportTypography});
 const xml=commentPackageParts(projection).entries.find(e=>e.name==='word/comments.xml').data;
 assert.match(xml,/<w:r><w:rPr>[^]*?<w:u w:val="single"\/[^]*?<\/w:rPr><w:br\/><\/w:r>/);
});
test('authenticated text replacement inside a range retains exact changed quote and replies atomically',async()=>{
 const f=await fixture(), bridge=await import('../../src/io/revisionBridge/index.mjs');
 const parts=bridge.extractDocxReviewTransportPackagePartsFromZipBytes({bytes:f.bytes}).parts;
 assert.match(parts['word/document.xml'],/🧭 anchor/u);
 parts['word/document.xml']=parts['word/document.xml'].replace('🧭 anchor','🧭 changed anchor');
 const bytes=require('../../src/export/docx/docxMinBuilder.js').buildStoredZip(Object.entries(parts).map(([name,data])=>({name,data})));
 const analysis=bridge.buildDocxReviewTransportAnalysisFromZipBytes({bytes},{cryptoPort:{sha256Text:hash,sha256Json:v=>'sha256:'+hash(stable(v)),byteLength:v=>Buffer.byteLength(v)}});
 assert.equal(analysis.ok,true);
 const input={...f.input,artifactSha256:hash(bytes),returnedThreads:analysis.reviewIr.commentThreads,returnedParagraphs:analysis.reviewIr.formattingParagraphs,
 textChanges:[{sceneId:'roman/a.md',paragraphIndex:0,oldText:'Before 🧭 anchor after',newText:'Before 🧭 changed anchor after'}]};
 const result=plan(input),after=JSON.parse(result.afterText);
 assert.equal(after.threads[0].anchor.selectedText,'🧭 changed anchor');assert.equal(after.threads[0].anchor.startUtf16,7);
 assert.deepEqual(after.threads[0].messages,f.state.threads[0].messages);assert.equal(after.threads[0].threadId,f.state.threads[0].threadId);
 assert.throws(()=>plan({...input,textChanges:[]}),/MANUSCRIPT_CHANGED/);
});
test('actual whole-anchor text plus Word comment removal retains explicit tombstone and original body',async()=>{
 const f=await deletionFixture({mutate(parts){parts['word/document.xml']=parts['word/document.xml'].replace('🧭 anchor','');}});
 assert.equal(f.parsed.ok,true);assert.equal(f.input.commentReturnInventory.status,'COMPLETE');
 const textChanges=[{sceneId:'roman/a.md',paragraphIndex:0,oldText:'Before 🧭 anchor after',newText:'Before  after'}];
 const result=plan({...f.input,textChanges}),after=JSON.parse(result.afterText);
 assert.deepEqual(after.threads[0],{...f.state.threads[0],status:'deleted'});
 assert.equal(result.changes[0].deletionDecision,'CONSISTENT_ABSENCE_REQUIRES_EXPLICIT_CONFIRMATION');
 assert.throws(()=>plan({...f.input,textChanges,commentReturnInventory:undefined}),/PACKAGE_INCOMPLETE/);
 assert.throws(()=>plan(f.input),/MANUSCRIPT_CHANGED/);
});

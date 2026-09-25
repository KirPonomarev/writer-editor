'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { deflateSync } = require('node:zlib');
const { createImageAttrs } = require('../../src/io/documentMedia.js');
const { buildFullManuscriptDocxReviewPacketSource } = require('../../src/export/docx/fullManuscriptDocxReviewPacketSource.js');
const { buildDocxReviewPacketBuffer } = require('../../src/export/docx/docxReviewPacketBuilder.js');
const { buildStoredZip } = require('../../src/export/docx/docxMinBuilder.js');
const stable = v => Array.isArray(v) ? '[' + v.map(stable).join(',') + ']' : v && typeof v === 'object'
  ? '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}' : JSON.stringify(v);
const digest = v => crypto.createHash('sha256').update(v).digest('hex');
const cryptoPort = { sha256Text: digest, sha256Json: v => 'sha256:' + digest(stable(v)),
  hmacSha256Json: (v, key) => 'hmac-sha256:' + crypto.createHmac('sha256', key).update(stable(v)).digest('hex'),
  hmacSha256Text: (v, key) => 'hmac-sha256:' + crypto.createHmac('sha256', key).update(v).digest('hex'), byteLength: Buffer.byteLength };
const date = '2026-09-25T00:00:00Z';
const esc = v => v.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const run = (text, deleted = false) => `<w:r><w:${deleted ? 'delText' : 't'} xml:space="preserve">${esc(text)}</w:${deleted ? 'delText' : 't'}></w:r>`;
const tracked = (text, kind, id) => `<w:${kind} w:id="${id}" w:author="W4" w:date="${date}">${run(text, kind === 'del')}</w:${kind}>`;
function replaceRun(xml, text, replacement) {
  const escaped = esc(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp('<w:r>(?:<w:rPr>.*?</w:rPr>)?<w:t[^>]*>' + escaped + '</w:t></w:r>', 'u');
  assert(regex.test(xml), text);
  return xml.replace(regex, () => replacement);
}
async function fixture({ before = 'before ', after = ' after', duplicate = false, duplicateParagraph = false, linkSuffix = '', wrap = p => p } = {}) {
  const bridge = await import('../../src/io/revisionBridge/index.mjs');
  const envelope = await import('../../src/renderer/documentContentEnvelope.mjs');
  const { crc32 } = await import('../../src/io/revisionBridge/reviewTransportZipEvidenceV1.mjs');
  const chunk = (tag, data) => { const b = Buffer.alloc(data.length + 12); b.writeUInt32BE(data.length); b.write(tag, 4); data.copy(b, 8); b.writeUInt32BE(crc32(b.subarray(4, -4)), b.length - 4); return b; };
  const ihdr = Buffer.from('00000001000000010806000000', 'hex');
  const png = Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(Buffer.from([0, 255, 0, 0, 255]))), chunk('IEND', Buffer.alloc(0))]);
  const attrs = createImageAttrs(png, { alt: 'protected W4', displayName: 'w4.png' });
  const content = [{ type: 'text', text: before }, { type: 'image', attrs }, { type: 'text', text: after }];
  if (linkSuffix) content.splice(1, 0, { type: 'text', text: linkSuffix, marks: [{ type: 'link', attrs: { href: 'https://example.com/w6', target: '_blank', rel: 'noopener noreferrer nofollow' } }] });
  if (duplicate) content.push({ type: 'image', attrs }, { type: 'text', text: ' tail' });
  const doc = { type: 'doc', content: [wrap({ type: 'paragraph', content })] };
  if (duplicateParagraph) doc.content.push(structuredClone(doc.content[0]));
  const original = envelope.composeObservablePayload({ doc });
  const scene = { sceneId: 'roman/w4.txt', scenePath: '/synthetic/roman/w4.txt', text: envelope.deriveVisibleTextFromDocument(doc), doc, observableContent: original, order: 0 };
  const source = buildFullManuscriptDocxReviewPacketSource({ projectId: 'w4-test', projectRoot: '/synthetic', manifestPath: '/synthetic/manifest.json', scenes: [scene], expectedOrderedSceneIds: [scene.sceneId] },
    { revisionBridge: bridge, cryptoPort, createdAtUtc: date, roundIdHex: 'e'.repeat(32), keyIdHex: 'd'.repeat(32), hmacSecret: 'synthetic-w4-test-key-not-published' });
  const bytes = buildDocxReviewPacketBuffer(source);
  const extracted = bridge.extractDocxReviewTransportPackagePartsFromZipBytes({ bytes }, { cryptoPort });
  assert.equal(extracted.ok, true);
  const parts = { ...extracted.parts, ...extracted.binaryParts }, xml = parts['word/document.xml'];
  const parse = (changedXml = xml, changedParts = {}) => bridge.buildDocxReviewTransportAnalysisFromZipBytes({
    bytes: buildStoredZip(Object.entries({ ...parts, ...changedParts, 'word/document.xml': changedXml }).map(([name, data]) => ({ name, data }))),
    hmacSecret: source.forbiddenSecret, expectedAuthority: source.localAuthorityCapsule.expectedAuthority,
  }, { cryptoPort });
  const map = source.localAuthorityCapsule.exportMap;
  const candidate = result => bridge.buildDocxReviewPreviewSessionCandidateFromEvidence({ returnedProjection: result.reviewIr, diagnostics: [] }, { fullManuscriptExportMap: map, createdAt: date });
  const control = parse(); assert.equal(control.ok, true); assert.equal(control.authorityCarrier.status, 'verified-baseline-bound');
  assert.equal(bridge.bindDocxReviewMedia(control.reviewIr, map).ok, true);
  return { bridge, envelope, source, original, attrs, xml, map, parse, candidate };
}

for (const kind of ['insert', 'delete', 'replace']) for (const side of ['before', 'after', 'both']) {
  test(`W4 signed ${kind} ${side}: source placement binding, actual Apply and durable image identity`, async t => {
    const f = await fixture({ duplicate: true });
    let xml = f.xml, before = 'before ', after = ' after';
    const mutate = (old, id) => kind === 'insert' ? run(old) + tracked('追加😀é', 'ins', id)
      : kind === 'delete' ? tracked(old, 'del', id)
        : tracked(old, 'del', id) + tracked('longer replacement', 'ins', id + 1);
    if (side !== 'after') { xml = replaceRun(xml, before, mutate(before, 801)); before = kind === 'insert' ? before + '追加😀é' : kind === 'delete' ? '' : 'longer replacement'; }
    if (side !== 'before') { xml = replaceRun(xml, after, mutate(after, 811)); after = kind === 'insert' ? after + '追加😀é' : kind === 'delete' ? '' : 'longer replacement'; }
    const parsed = f.parse(xml); assert.equal(parsed.ok, true, JSON.stringify(parsed.reasons));
    assert.equal(parsed.authorityCarrier.status, 'verified-baseline-bound');
    const binding = f.bridge.bindDocxReviewMedia(parsed.reviewIr, f.map);
    assert.equal(binding.ok, true, JSON.stringify(binding)); assert.equal(binding.proof.automaticApplyAuthority, false);
    assert.deepEqual(parsed.reviewIr.documentMedia.placements.map(x => x.offset), [before.length, before.length + after.length]);
    const candidate = f.candidate(parsed); assert.equal(candidate.ok, true, JSON.stringify(candidate));
    const changes = candidate.reviewPacket.textChanges;
    assert.equal(changes.length, side === 'both' ? 2 : 1);
    assert(changes.every(c => c.match.kind === 'exact'));
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'w4-media-text-')); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const scenePath = path.join(root, 'scene.txt'); fs.writeFileSync(scenePath, f.original);
    const writer = await import('../../src/io/revisionBridge/exactTextMinSafeWrite.mjs');
    const projectSnapshot = { projectId: 'w4-test', baselineHash: 'w4-baseline', scenes: [{ sceneId: 'roman/w4.txt', text: f.original }] };
    const revisionSession = { projectId: 'w4-test', sessionId: 'w4-session', baselineHash: 'w4-baseline', status: 'open', reviewGraph: candidate.reviewPacket };
    const result = await writer.applyExactTextBatchMinSafeWrite({ projectRoot: root, projectSnapshot, revisionSession, reviewItems: changes, scenePath, scenePathBySceneId: { 'roman/w4.txt': scenePath } });
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(fs.readFileSync(result.receipt.recovery.snapshotPath, 'utf8'), f.original);
    const reopened = f.envelope.parseObservablePayload(fs.readFileSync(scenePath, 'utf8'));
    assert.equal(reopened.text, before + after + ' tail');
    assert.deepEqual(reopened.doc.content[0].content.filter(n => n.type === 'image').map(n => n.attrs), [f.attrs, f.attrs]);
    const observedOffsets = []; let cursor = 0;
    for (const n of reopened.doc.content[0].content) { if (n.type === 'text') cursor += n.text.length; if (n.type === 'image') observedOffsets.push(cursor); }
    assert.deepEqual(observedOffsets, [before.length, before.length + after.length]);
  });
}

test('W4 unknown untracked text, moved/deleted image, alt and size substitution remain blocked', async () => {
  const f = await fixture();
  const cases = [x => x.replace('before ', 'untracked before '), x => x.replace(' after', 'unknown after'),
    x => x.replace('protected W4', 'substituted'), x => x.replace(/<w:drawing>[^]*?<\/w:drawing>/u, ''),
    x => x.replaceAll('cx="9525"', 'cx="19050"'),
    x => replaceRun(x, 'before ', '') .replace('</w:drawing>', '</w:drawing>' + run('before '))];
  for (const mutate of cases) { const changed = mutate(f.xml); assert.notEqual(changed, f.xml); const result = f.parse(changed);
    assert.equal(result.ok && f.bridge.bindDocxReviewMedia(result.reviewIr, f.map).ok, false); }
});

test('W4 independent edits in the same segment retain separate decisions; lost locator grants no exact Apply', async () => {
  const f = await fixture();
  const xml = replaceRun(f.xml, 'before ', tracked('one', 'ins', 901) + run('before ') + tracked('two', 'ins', 902));
  const result = f.parse(xml); assert.equal(f.bridge.bindDocxReviewMedia(result.reviewIr, f.map).ok, true);
  const changes = f.candidate(result).reviewPacket.textChanges;
  assert.equal(changes.length, 2); assert(changes.every(c => c.match.kind === 'manual'));
  const lost = f.parse(replaceRun(f.xml, 'before ', run('before ') + tracked('edit', 'ins', 903)).replace(/<w:bookmark(?:Start|End)\b[^>]*\/>/gu, ''));
  const candidate = f.candidate(lost); assert(candidate.reviewPacket.textChanges.every(c => c.match.kind === 'manual'));
});

test('W4 unsupported nested and move revisions cannot provide Original/Current remapping', async () => {
  const f = await fixture();
  for (const wrapped of [tracked('nested', 'ins', 4).replace('<w:r>', '<w:del w:id="5"><w:r>').replace('</w:r>', '</w:r></w:del>'),
    '<w:moveTo w:id="8">' + run('moved') + '</w:moveTo>']) {
    const result = f.parse(replaceRun(f.xml, 'before ', run('before ') + wrapped));
    assert.equal(result.ok && f.bridge.bindDocxReviewMedia(result.reviewIr, f.map).ok, false);
  }
});

test('W4 insertion inside an original grapheme stays manual; tab and surrogate offsets remain UTF-16 exact', async () => {
  const f = await fixture({ before: '😀é before ' });
  const split = f.parse(replaceRun(f.xml, '😀é before ', run('😀e') + tracked('X', 'ins', 920) + run('́ before ')));
  assert.equal(f.bridge.bindDocxReviewMedia(split.reviewIr, f.map).ok, true);
  assert.equal(f.candidate(split).reviewPacket.textChanges[0].match.kind, 'manual');
  const valid = f.parse(replaceRun(f.xml, '😀é before ', run('😀é before ') + tracked('✅', 'ins', 921)));
  assert.equal(f.bridge.bindDocxReviewMedia(valid.reviewIr, f.map).ok, true);
  assert.equal(valid.reviewIr.documentMedia.placements[0].offset, '😀é before ✅'.length);
  assert.equal(f.candidate(valid).reviewPacket.textChanges[0].match.kind, 'exact');
});

test('W4 source tab and line break count once in both coordinate projections', async () => {
  const f = await fixture({ before: 'tab\tline\nbefore ' });
  const xml = f.xml.replace('<w:r><w:drawing>', tracked('added', 'ins', 924) + '<w:r><w:drawing>');
  assert.notEqual(xml, f.xml);
  const result = f.parse(xml);
  assert.equal(f.bridge.bindDocxReviewMedia(result.reviewIr, f.map).ok, true);
  assert.equal(result.reviewIr.documentMedia.placements[0].originalOffset, 'tab\tline\nbefore '.length);
  assert.equal(result.reviewIr.documentMedia.placements[0].offset, 'tab\tline\nbefore added'.length);
  // Existing writer deliberately does not replace across a hard-break atom.
  assert.equal(f.candidate(result).reviewPacket.textChanges[0].match.kind, 'manual');
});

for (const [label, wrap] of [
  ['list', p => ({ type: 'bulletList', content: [{ type: 'listItem', content: [p] }] })],
  ['table', p => ({ type: 'table', content: [{ type: 'tableRow', content: [{ type: 'tableCell', attrs: { colspan: 1, rowspan: 1, colwidth: null }, content: [p] }] }] })],
]) test(`W4 ${label}: authenticated image-bearing paragraph keeps local identity`, async () => {
  const f = await fixture({ wrap });
  const result = f.parse(replaceRun(f.xml, 'before ', run('before ') + tracked('added', 'ins', 930)));
  assert.equal(result.ok, true, JSON.stringify(result.reasons));
  assert.equal(result.authorityCarrier.status, 'verified-baseline-bound');
  assert.equal(f.bridge.bindDocxReviewMedia(result.reviewIr, f.map).ok, true);
  const candidate = f.candidate(result);
  assert.equal(candidate.ok, true, JSON.stringify(candidate));
  assert.equal(candidate.reviewPacket.textChanges[0].match.kind, 'exact');
});

test('W4 stale canonical paragraph and forged original offset cannot rescue matching PNG bytes', async () => {
  const f = await fixture();
  const result = f.parse(replaceRun(f.xml, 'before ', run('before ') + tracked('added', 'ins', 940)));
  const stale = structuredClone(f.map); stale.scenes[0].blocks[0].canonicalTextSha256 = 'sha256:' + '0'.repeat(64);
  assert.equal(f.bridge.bindDocxReviewMedia(result.reviewIr, stale).ok, false);
  const forged = structuredClone(result.reviewIr); forged.documentMedia.placements[0].originalOffset += 1;
  assert.equal(f.bridge.bindDocxReviewMedia(forged, f.map).ok, false);
  const lost = structuredClone(result.reviewIr); delete lost.documentMedia.placements[0].textCorrespondence;
  assert.equal(f.bridge.bindDocxReviewMedia(lost, f.map).ok, false);
});

test('W4 full-manuscript router binds raw rich bytes separately from visible coordinates and preserves whitespace', async () => {
  const f = await fixture();
  const router = require('../../src/export/docx/fullManuscriptDocxReviewReturnRouter.js');
  const sceneId = 'roman/w4.txt', baselineText = 'before  after';
  assert.equal(f.source.localAuthorityCapsule.baselineObservableContentBySceneId[sceneId], f.original);
  const result = f.parse(replaceRun(f.xml, 'before ', run('before ') + tracked('added ', 'ins', 951)));
  const candidate = f.candidate(result), change = candidate.reviewPacket.textChanges[0];
  const operations = [{ id: change.changeId, family: 'tracked_text_edit', sceneId,
    anchor: { sceneId, selectedText: change.match.quote }, semanticIntent: { kind: 'replace', replacementText: change.replacementText } }];
  const capsule = f.source.localAuthorityCapsule;
  const proof = { status: 'authenticated-return-ir-ready', authenticated: true,
    returnedArtifactSha256: 'sha256:' + digest('synthetic-router-identity'), coreManifestDigest: capsule.coreManifestDigest,
    yrtk2Verification: { code: 'RTK_RETURN_INTAKE_YRTK2_VERIFIED', coreManifestDigest: capsule.coreManifestDigest, ...capsule.yrtk2 },
    parserProfileDigest: 'sha256:' + digest('parser'), analysisDigest: 'sha256:' + digest('analysis'),
    reviewIrDigest: cryptoPort.sha256Json(result.reviewIr), operationSource: 'parsed-review-ir', operationIds: operations.map(o => o.id) };
  proof.mainIntakeAuthorityDigest = router.buildFullManuscriptReturnIntakeProofBindingDigest({ proof, localAuthority: capsule, operations });
  const plan = router.buildFullManuscriptReviewReturnApplyPlan({ projectId: 'w4-test', localAuthorityCapsule: capsule,
    returnedAuthority: result.authorityCarrier.selectedCarrier.payload, operations, returnIntakeProof: proof });
  assert.equal(plan.ok, true, JSON.stringify(plan));
  const input = plan.sceneCommands[0].input;
  assert.equal(input.writerContext.projectSnapshot.scenes[0].text, f.original);
  assert.equal(input.localBaseline.sceneBlocks[0].text, baselineText);
  assert.equal(input.writerInput.reviewItems[0].replacementText, 'before added ');
  const runtime = await import('../../src/io/revisionBridge/reviewTransportNonOverlapTrackedReplacementRuntime.mjs');
  const preview = runtime.buildNonOverlapTrackedReplacementRuntimePreview(input, { cryptoPort });
  assert.equal(preview.ok, true, JSON.stringify(preview));
  const base = { sceneId, baselineText, baselineContent: f.original, exportMap: f.map, operations };
  assert.equal(router.deriveFullManuscriptSceneExactAuthority(base).ok, true);
  assert.equal(router.deriveFullManuscriptSceneExactAuthority({ ...base, baselineContent: f.original + 'stale' }).code, 'FULL_MANUSCRIPT_EXACT_AUTHORITY_BASELINE_STALE');
  assert.equal(router.deriveFullManuscriptSceneExactAuthority({ ...base, baselineText: baselineText + 'stale' }).code, 'FULL_MANUSCRIPT_EXACT_AUTHORITY_VISIBLE_BASELINE_MISMATCH');
});

test('W4 complete Office locator rewrite needs signed sections, full Original vector and unique source paragraph', async () => {
  const { validateFullManuscriptDocumentSectionsReturn } = require('../../src/export/docx/fullManuscriptDocxReviewPacketSource.js');
  for (const duplicateParagraph of [false, true]) {
    const f = await fixture({ duplicateParagraph });
    const xml = replaceRun(f.xml, 'before ', run('before ') + tracked('added', 'ins', 960))
      .replace(/<w:bookmark(?:Start|End)\b[^>]*\/>/gu, '');
    const result = f.parse(xml);
    const sections = validateFullManuscriptDocumentSectionsReturn({ expected: f.source.localAuthorityCapsule.documentSections,
      returned: result.reviewIr.documentSections, signedDigest: result.authorityCarrier.selectedCarrier.payload.documentSectionsDigest });
    assert.equal(sections.ok, true, JSON.stringify(sections));
    const build = verifiedDocumentSections => f.bridge.buildDocxReviewPreviewSessionCandidateFromEvidence({ returnedProjection: result.reviewIr },
      { fullManuscriptExportMap: f.map, verifiedDocumentSections });
    const candidate = build({ ...sections.proof, status: sections.status });
    assert.equal(candidate.reviewPacket.textChanges[0].match.kind, duplicateParagraph ? 'manual' : 'exact');
    const forged = { ...sections.proof, status: sections.status, sourceBindings: [] };
    assert.equal(build(forged).reviewPacket.textChanges[0].match.kind, 'manual');
  }
});

for (const kind of ['replace', 'insert', 'delete']) test(`W6 ${kind} before image keeps unchanged Unicode hyperlink marks`, async t => {
  const suffix = '日本語 é link';
  const f = await fixture({ linkSuffix: suffix });
  const changed = kind === 'replace' ? tracked('before ', 'del', 970) + tracked('Changed prefix: ', 'ins', 971)
    : kind === 'insert' ? run('before ') + tracked('inserted ', 'ins', 970) : tracked('before ', 'del', 970);
  const result = f.parse(replaceRun(f.xml, 'before ', changed));
  assert.equal(result.ok, true, JSON.stringify(result.reasons));
  assert.equal(f.bridge.bindDocxReviewMedia(result.reviewIr, f.map).ok, true);
  const candidate = f.candidate(result); const changes = candidate.reviewPacket.textChanges;
  assert.equal(changes.length, 1); assert.equal(changes[0].match.kind, 'exact');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'w6-rich-context-')); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const scenePath = path.join(root, 'scene.txt'); fs.writeFileSync(scenePath, f.original);
  const statePath = path.join(root, '.yalken', 'word-review', 'non-text-return-state.v1.json');
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  const state = { schemaVersion: 'yalken.rtk.word.non-text-return-state.v1', projectId: 'w4-test', revision: 1, events: [], threads: [{ threadId: 't', rootCommentId: 'c', sceneId: 'roman/w4.txt', status: 'open', anchor: { sceneId: 'roman/w4.txt', sceneParagraphIndex: 0, blockTextSha256: digest('before ' + suffix + ' after'), startUtf16: 7, selectedText: suffix, selectedTextSha256: digest(suffix) }, messages: [{ commentId: 'c', kind: 'root', body: 'Comment 日本語' }] }] };
  fs.writeFileSync(statePath, JSON.stringify(state));
  const writer = await import('../../src/io/revisionBridge/exactTextMinSafeWrite.mjs');
  const projectSnapshot = { projectId: 'w4-test', baselineHash: 'w6-baseline', scenes: [{ sceneId: 'roman/w4.txt', text: f.original }] };
  const revisionSession = { projectId: 'w4-test', sessionId: 'w6-session', baselineHash: 'w6-baseline', status: 'open', reviewGraph: candidate.reviewPacket };
  const applied = await writer.applyExactTextBatchMinSafeWrite({ projectRoot: root, projectSnapshot, revisionSession, reviewItems: changes, scenePath, scenePathBySceneId: { 'roman/w4.txt': scenePath } });
  assert.equal(applied.ok, true, JSON.stringify(applied));
  const doc = f.envelope.parseObservablePayload(fs.readFileSync(scenePath, 'utf8')).doc;
  const nodes = doc.content[0].content;
  assert.deepEqual(nodes.find(n => n.marks?.some(m => m.type === 'link')), f.envelope.parseObservablePayload(f.original).doc.content[0].content[1]);
  assert.deepEqual(nodes.find(n => n.type === 'image').attrs, f.attrs);
  const reopenedState = JSON.parse(fs.readFileSync(statePath));
  assert.deepEqual(reopenedState.threads[0].messages, state.threads[0].messages);
  assert.equal(reopenedState.revision, 2);
  const visible = f.envelope.deriveVisibleTextFromDocument(doc);
  assert.equal(reopenedState.threads[0].anchor.startUtf16, visible.indexOf(suffix));
  assert.equal(reopenedState.threads[0].anchor.blockTextSha256, digest(visible));
  const reexport = buildFullManuscriptDocxReviewPacketSource({ projectId: 'w4-test', projectRoot: root, scenes: [{ sceneId: 'roman/w4.txt', scenePath, order: 0, text: visible, doc }], nonTextReturnState: reopenedState });
  assert.equal(reexport.commentExport.threads[0].anchor.selectedText, suffix);
  assert.equal(f.envelope.deriveVisibleTextFromDocument(doc), (kind === 'replace' ? 'Changed prefix: ' : kind === 'insert' ? 'before inserted ' : '') + suffix + ' after');
});

for (const failure of ['overlap', 'stale', 'changed-state', 'snapshot-tamper', 'forged-transition', 'crash-before-comment']) test(`W6 comment anchor ${failure} has no false success and preserves recoverable bytes`, async t => {
  const f = await fixture({ linkSuffix: '日本語 é link' }), sceneId = 'roman/w4.txt';
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'w6-comment-fault-')); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const scenePath = path.join(root, 'scene.txt'), statePath = path.join(root, '.yalken/word-review/non-text-return-state.v1.json');
  fs.writeFileSync(scenePath, f.original); fs.mkdirSync(path.dirname(statePath), { recursive: true });
  const selected = failure === 'overlap' ? 'before ' : '日本語 é link';
  const state = { schemaVersion: 'yalken.rtk.word.non-text-return-state.v1', projectId: 'w4-test', revision: 1, events: [], threads: [{ threadId: 't', rootCommentId: 'c', sceneId, status: 'open', anchor: { sceneId, sceneParagraphIndex: 0, blockTextSha256: failure === 'stale' ? '0'.repeat(64) : digest('before 日本語 é link after'), startUtf16: failure === 'overlap' ? 0 : 7, selectedText: selected, selectedTextSha256: digest(selected) }, messages: [{ commentId: 'c', kind: 'root', body: 'unchanged comment' }] }] };
  const beforeState = JSON.stringify(state); fs.writeFileSync(statePath, beforeState);
  const writer = await import('../../src/io/revisionBridge/exactTextMinSafeWrite.mjs');
  const journal = await import('../../src/io/revisionBridge/exactTextApplyJournal.mjs');
  const changes = f.candidate(f.parse(replaceRun(f.xml, 'before ', tracked('before ', 'del', 980) + tracked('new prefix ', 'ins', 981)))).reviewPacket.textChanges;
  const input = { projectRoot: root, projectSnapshot: { projectId: 'w4-test', baselineHash: 'b', scenes: [{ sceneId, text: f.original }] }, revisionSession: { projectId: 'w4-test', sessionId: 's', baselineHash: 'b', status: 'open', reviewGraph: { textChanges: changes } }, reviewItems: changes, scenePath, scenePathBySceneId: { [sceneId]: scenePath } };
  const operationId = 'op_w6_' + failure.replaceAll('-', '_');
  let snapshot;
  const options = { operationId, afterStage: async event => {
    if (event.stage !== 'SNAPSHOT_CREATED') return; snapshot = event.snapshotPath;
    if (failure === 'changed-state') fs.writeFileSync(statePath, beforeState + ' ');
    if (failure === 'snapshot-tamper') fs.writeFileSync(snapshot, 'forged snapshot');
    if (failure === 'forged-transition') {
      const file = path.join(root, 'backups/revision-bridge-apply-journal', operationId + '.json');
      const saved = JSON.parse(fs.readFileSync(file)); const forged = JSON.parse(saved.commentRebase.afterText); forged.threads[0].messages[0].body = 'forged body';
      saved.commentRebase.afterText = JSON.stringify(forged); saved.commentRebase.afterHash = digest(saved.commentRebase.afterText); fs.writeFileSync(file, JSON.stringify(saved));
    }
  } };
  if (failure === 'crash-before-comment') options.publishScene = async (file, content) => {
    fs.writeFileSync(file, content); throw Object.assign(new Error('simulated crash after scene commit'), { code: 'EIO' });
  };
  const result = await writer.applyExactTextBatchMinSafeWrite(input, options);
  assert.notEqual(result.status, 'applied');
  if (['overlap', 'stale', 'changed-state'].includes(failure)) assert.equal(fs.readFileSync(scenePath, 'utf8'), f.original);
  if (failure !== 'changed-state' && failure !== 'crash-before-comment') assert.equal(fs.readFileSync(statePath, 'utf8'), beforeState);
  if (failure === 'crash-before-comment') {
    const recovered = await journal.reconcileExactTextApplyJournal(root, operationId);
    assert.equal(recovered.outcome, 'applied_receipt_missing');
    const rebased = JSON.parse(fs.readFileSync(statePath)); assert.equal(rebased.threads[0].anchor.startUtf16, 11); assert.deepEqual(rebased.threads[0].messages, state.threads[0].messages);
    const bytes = fs.readFileSync(statePath, 'utf8'); await journal.reconcileExactTextApplyJournal(root, operationId); assert.equal(fs.readFileSync(statePath, 'utf8'), bytes);
    assert.equal(fs.readFileSync(snapshot, 'utf8'), f.original);
  }
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { DOMParser } = require('@xmldom/xmldom');
const { extractParts } = require('../fixtures/r24-wp703-docx-profile-fixtures.js');
const { buildZip } = require('../fixtures/r24-wp701-parser-quarantine-fixtures.js');
const pending = require('../../src/core/word-pending-text-revisions-v1.cjs');
const envelope = require('../../src/core/document-content-envelope-v1.cjs');
const admission = require('../fixtures/docx-import-real-authority.cjs');
const { planPendingCommentDecision } = require('../../src/core/word-pending-comment-decisions-v1.cjs');
const { execFileSync } = require('node:child_process');
const ROOT = path.resolve(__dirname, '../..');
const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const SAMPLE = 'google-c4-native-review-returned.docx';
const CROSS = 'google-c4-pr1918-sanitized-derivative-of-physical-return.docx';
const input = () => fs.readFileSync(path.join(ROOT, 'test/fixtures/revision-bridge', SAMPLE));
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const rewrite = (bytes, mutate) => {
  const parts = extractParts(bytes);mutate(parts);
  return buildZip([...parts].map(([name, data]) => ({ name, data })));
};
const changeMain = (bytes, fn) => rewrite(bytes, p => p.set('word/document.xml', fn(p.get('word/document.xml').toString())));
async function read(bytes = input(), profile = true) {
  const io = await import('../../src/io/revisionBridge/index.mjs');
  const preview = io.buildDocxContentPreviewFromZipBytes(profile ? { bytes, manuscriptProfile: 'YALKEN_MANUSCRIPT_V1' } : bytes);
  return { preview, plan: io.buildDocxNovelImportPreviewPlanFromContentPreview(preview) };
}
function oracle(bytes) {
  const parts = extractParts(bytes), parser = new DOMParser({ onError: (level, m) => { throw Error(level + ':' + m); } });
  const dom = parser.parseFromString(parts.get('word/document.xml').toString(), 'application/xml');
  const own = (p, n) => Array.from(p.childNodes).filter(x => x.nodeType === 1 && x.namespaceURI === W && (!n || x.localName === n));
  const body = own(dom.documentElement, 'body')[0];
  const text = (node, mode) => {
    if (node.nodeType !== 1) return '';
    if (node.namespaceURI !== W) throw Error('FOREIGN_ORACLE_NODE');
    if (mode === 'current' && node.localName === 'del' || mode === 'original' && node.localName === 'ins') return '';
    if (['t', 'delText'].includes(node.localName)) return node.textContent;
    if (node.localName === 'tab') return '\t';
    if (['br', 'cr'].includes(node.localName)) return '\n';
    return own(node).map(x => text(x, mode)).join('');
  };
  const rows = own(body, 'p');
  const comments = parser.parseFromString(parts.get('word/comments.xml').toString(), 'application/xml');
  return { current: rows.map(p => text(p, 'current')).join('\n'), original: rows.map(p => text(p, 'original')).join('\n'),
    union: rows.map(p => text(p, 'union')).join('\n'), bodies: own(comments.documentElement, 'comment').map(c => own(c, 'p').map(p => text(p, 'current')).join('\n')) };
}
const identity = () => ({ projectId: crypto.randomUUID(), projectName: 'Small Google manuscript', operationId: 'google-small', createdAtUtc: '2026-10-17T00:00:00.000Z' });

for (const sample of [SAMPLE, CROSS]) test(`original ${sample} preserves independent text, discussion and durable new project`, async t => {
  const bytes = fs.readFileSync(path.join(ROOT, 'test/fixtures/revision-bridge', sample)), before = sha(bytes), expected = oracle(bytes);
  assert.equal(before, sample === SAMPLE ? 'f1bb75df191e945aeb2be29eccc4eaf71448195322eac2b31cc5f0ecf1689515' : '5f806e5eb0325b91e17a947c773f6ee9683dca31cd4e0831a62cd38dd52d67ba');
  const { preview, plan } = await read(bytes);
  assert.equal(preview.ok, true, JSON.stringify(preview.diagnostics));assert.equal(plan.ok, true, JSON.stringify(plan));
  assert.equal(preview.sourceArtifactSha256, before);
  const { prepareDocxNewProject } = await import('../../src/core/docx-new-project-v1.mjs');
  const id = identity(), model = prepareDocxNewProject({ plan, ...id });
  assert.equal(model.summary.revisionCount, 2);assert.equal(model.summary.commentCount, 1);
  const scene = model.files.find(f => f.role === 'scene'), doc = envelope.parseObservablePayload(scene.content).doc;
  const projection = pending.projection(doc), ledger = pending.readLedger(doc);
  assert.equal(projection.current, expected.current);assert.equal(projection.original, expected.original);
  assert.equal(ledger.revisions[0].nativeId, '0');assert.equal(ledger.revisions[1].nativeId, '0');
  assert.equal(ledger.revisions[0].groupId, ledger.revisions[1].groupId);
  const state = JSON.parse(model.files.find(f => f.role === 'comments').content), thread = state.threads[0];
  assert.equal(thread.messages[0].body, expected.bodies[0]);
  const quote = sample === SAMPLE ? 'sentinel omeg' : 'omega';
  assert.equal(thread.anchor.sceneParagraphIndex, 0);assert.equal(thread.anchor.startUtf16, sample === SAMPLE ? 31 : 40);
  assert.equal(thread.anchor.selectedText, quote);
  assert.equal(expected.current.split('\n')[0].slice(thread.anchor.startUtf16,thread.anchor.startUtf16+quote.length),quote);
  if (sample === CROSS) assert.deepEqual(pending.readCommentUnionContext({ document: doc, anchor: thread.anchor }), {quote:'omegasentinel',hidden:false});
  for (const choice of ['accepted', 'rejected']) {
    const intent = { revisionId: ledger.revisions[0].id, action: choice === 'accepted' ? 'accept' : 'reject' };
    const decision = pending.decide(doc, intent);
    assert.equal(pending.projection(decision.doc).current, choice === 'accepted' ? expected.current : expected.original);
    const changed = planPendingCommentDecision({beforeText:JSON.stringify(state),projectId:id.projectId,sceneId:scene.relativePath,
      beforeContent:scene.content,afterContent:envelope.composeObservablePayload({doc:decision.doc}),decision:intent});
    assert.deepEqual(JSON.parse(changed.afterText).threads[0].messages,thread.messages);
    const undo=pending.decide(decision.doc,{action:'undo'}).doc;
    const restored=planPendingCommentDecision({beforeText:changed.afterText,projectId:id.projectId,sceneId:scene.relativePath,
      beforeContent:envelope.composeObservablePayload({doc:decision.doc}),afterContent:envelope.composeObservablePayload({doc:undo}),decision:{action:'undo'}});
    assert.deepEqual(JSON.parse(restored.afterText).threads[0].anchor,thread.anchor);
  }
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'yalken-google-small-'));
  t.after(() => fs.rmSync(parent, { recursive: true, force: true }));
  const { createMainProjectManifestAuthority } = await import('../../src/product/mainProjectManifestAuthority.mjs');
  const { createDocxNewProject } = await import('../../src/product/docxNewProjectCreateV1.mjs');
  admission.rememberDocxImportPreviewPlanAdmission(plan);
  const authority = createMainProjectManifestAuthority({ anchorRoot: path.join(parent, '.authority'), useLeaseHeartbeatWorker: false });
  const created = await createDocxNewProject({ plan, identity: id, parentDirectoryPath: parent, ownership: {}, transactionAuthority: authority, assertPublication: async () => {} });
  assert.equal(created.created, true);
  for (const file of model.files) assert.equal(fs.readFileSync(path.join(created.projectRoot, file.relativePath), 'utf8'), file.content);
  assert.equal(fs.readFileSync(created.manifestPath, 'utf8'), model.manifestText);
  const cold = JSON.parse(execFileSync(process.execPath,['-e',`const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
    const root=process.argv[1], files=JSON.parse(process.argv[2]);console.log(JSON.stringify(files.map(f=>({role:f.role,
    sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,f.relativePath))).digest('hex')}))));`,created.projectRoot,JSON.stringify(model.files.map(f=>({relativePath:f.relativePath,role:f.role})))],{encoding:'utf8',timeout:10000,env:{...process.env,ELECTRON_RUN_AS_NODE:'1'}}));
  assert.deepEqual(cold,model.files.map(f=>({role:f.role,sha256:f.sha256})));
  assert.equal(sha(fs.readFileSync(path.join(ROOT, 'test/fixtures/revision-bridge', sample))), before);
});

test('strict profile does not inherit manuscript normalization', async () => {
  const { preview, plan } = await read(input(), false);
  assert.equal(preview.ok, false);assert.equal(plan.ok, false);
  assert.equal(preview.reason, 'PENDING_REVISIONS_USER_BOOKMARK_UNSUPPORTED');
});

const firstStart=/<w:bookmarkStart\b[^>]*\/>/u, firstPair=/<w:bookmarkStart\b[^>]*\/>\s*<w:bookmarkEnd\b[^>]*\/>/u;
const badMain = {
  'missing bookmark end': s => s.replace('<w:bookmarkEnd w:id="0"/>',''),
  'duplicate bookmark pair': s => s.replace(firstPair,m=>m+m),
  'duplicate bookmark name': s => s.replace('w:name="niptk38u43yd"','w:name="23lyuzk1k37s"'),
  'point becomes text range': s => s.replace(firstPair,m=>m.replace('<w:bookmarkEnd','<w:r><w:t>hidden?</w:t></w:r><w:bookmarkEnd')),
  'bookmark column range': s => s.replace('w:colLast="0"','w:colLast="1"'),
  'foreign marker namespace': s => s.replace(firstStart,m=>m.replace('<w:bookmarkStart','<x:bookmarkStart xmlns:x="urn:foreign"')),
  'wrong endpoint id': s => s.replace('<w:bookmarkEnd w:id="0"/>','<w:bookmarkEnd w:id="99"/>'),
  'referenced point bookmark': s => s.replace('</w:p>','<w:hyperlink w:anchor="23lyuzk1k37s"><w:r><w:t>link</w:t></w:r></w:hyperlink></w:p>'),
  'same-kind duplicate revision': s => s.replace('<w:del ','<w:ins ').replace('</w:del>','</w:ins>'),
  'different replacement author': s => s.replace(/(<w:del\b[^>]*w:author=")[^"]+/u,'$1Another editor'),
  'different replacement date': s => s.replace(/(<w:del\b[^>]*w:date=")[^"]+/u,'$12026-10-17T00:00:00Z'),
  'separated duplicate revision': s => s.replace('</w:ins>','</w:ins><w:r><w:t>gap</w:t></w:r>'),
  'third revision with same id': s => s.replace('</w:del>','</w:del><w:ins w:id="0" w:author="Yalken Reviewer0" w:date="2026-09-15T02:15:37Z"><w:r><w:t>x</w:t></w:r></w:ins>'),
  'duplicate replacement across paragraphs': s => s.replace('</w:ins><w:del','</w:ins></w:p><w:p><w:del'),
  'unknown page numbering format': s => s.replace('<w:pgNumType w:start="1"/>','<w:pgNumType w:start="1" w:fmt="upperRoman"/>'),
  'page numbering active child': s => s.replace('<w:pgNumType w:start="1"/>','<w:pgNumType w:start="1"><w:r><w:t>hidden</w:t></w:r></w:pgNumType>'),
};
for (const [name, mutate] of Object.entries(badMain)) test(`small manuscript refuses ${name} before a project plan`,async()=>{
  const changed=changeMain(input(),mutate);assert.notEqual(sha(changed),sha(input()));
  const {preview,plan}=await read(changed);assert.equal(preview.ok,false,JSON.stringify({name,preview}));assert.equal(plan.ok,false);
});
for(const [name,old,value] of [['visible comment caps','<w:smallCaps w:val="0"/>','<w:smallCaps w:val="1"/>'],
 ['superscript comment','<w:vertAlign w:val="baseline"/>','<w:vertAlign w:val="superscript"/>'],
 ['visible comment border','w:sz="0" w:val="nil"','w:sz="8" w:val="single"'],
 ['active comment keep rule','<w:keepNext w:val="0"/>','<w:keepNext w:val="1"/>'],
 ['bad comment revision metadata','w:rsidDel="00000000"','w:rsidDel="oops"']]) test(`small manuscript refuses ${name}`,async()=>{
 const changed=rewrite(input(),p=>{const xml=p.get('word/comments.xml').toString();assert.ok(xml.includes(old));p.set('word/comments.xml',xml.replace(old,value));});
 const {preview,plan}=await read(changed);assert.equal(preview.ok,false);assert.equal(plan.ok,false);
});

test('small Google-shaped composite retains existing replies, note, highlights and pending text without provider claims',async()=>{
 const bytes=fs.readFileSync(path.join(ROOT,'test/fixtures/docx-pending-deleted-comment-import.docx'));
 const shaped=changeMain(bytes,s=>s.replace('<w:body>','<w:body><w:bookmarkStart w:id="700" w:name="7point"/><w:bookmarkEnd w:id="700"/>'));
 const baseline=await read(bytes), actual=await read(shaped);assert.equal(actual.plan.ok,true,JSON.stringify(actual.preview.diagnostics));
 const {prepareDocxNewProject}=await import('../../src/core/docx-new-project-v1.mjs');const id=identity();
 const left=prepareDocxNewProject({plan:baseline.plan,...id}),right=prepareDocxNewProject({plan:actual.plan,...id});
 assert.deepEqual(right.files,left.files);assert.deepEqual(right.summary,left.summary);
 assert.equal(right.summary.revisionCount,2);assert.equal(right.summary.noteCount,1);assert.equal(right.summary.commentCount,3);
 assert.equal(JSON.parse(right.files.find(f=>f.role==='comments').content).threads[0].messages[1].body,'Ответ к вставке');
 assert.equal(JSON.parse(right.files.find(f=>f.role==='notes').content).notes[0].body,'Содержание сноски сохраняется.');
});

test('ordinary clean user bookmark ranges keep their existing identity instead of being omitted',async()=>{
 const {packageBytes,xml}=require('../fixtures/r24-wp703-docx-profile-fixtures.js');
 const bytes=packageBytes({xml:xml('<w:p><w:bookmarkStart w:id="1" w:name="AuthorRange"/><w:r><w:t>keep</w:t></w:r><w:bookmarkEnd w:id="1"/></w:p>')});
 const {preview,plan}=await read(bytes);assert.equal(preview.ok,true,JSON.stringify(preview.diagnostics));assert.equal(plan.ok,true);
 assert.equal(preview.contentPreview.userBookmarkInventory.bookmarks[0].name,'AuthorRange');
 assert.equal(preview.contentPreview.userBookmarkInventory.bookmarks[0].end.offsetUtf16,4);
 const doc=envelope.parseObservablePayload(plan.candidateCreatePlan.entries[0].content).doc;
 assert.equal(require('../../src/core/word-user-bookmarks-v1.cjs').readRegistry(doc).bookmarks[0].name,'AuthorRange');
});

test('interior deletion anchors require the manuscript profile and retain the full union proof',async()=>{
 const {genericCommentCandidates}=await import('../../src/io/revisionBridge/genericWordComments.mjs');
 const {preview}=await read(fs.readFileSync(path.join(ROOT,'test/fixtures/revision-bridge',CROSS)));
 const io=await import('../../src/io/revisionBridge/index.mjs');const hash=await import('../../src/core/browser-safe-hash.mjs');
 const analysis=io.buildDocxReviewTransportAnalysisFromZipBytes({bytes:fs.readFileSync(path.join(ROOT,'test/fixtures/revision-bridge',CROSS))},
  {manuscriptProfile:'YALKEN_MANUSCRIPT_V1',cryptoPort:{sha256Text:hash.sha256Hex,sha256Json:v=>'sha256:'+hash.sha256Hex(hash.canonicalSerialize(v)),byteLength:t=>Buffer.byteLength(t)}});
 assert.equal(analysis.ok,true);const options={metadataValidated:true,pendingDocument:preview.contentPreview.pendingRevisionDocument};
 assert.throws(()=>genericCommentCandidates(analysis,preview.contentPreview.paragraphs,options),/DOCX_GENERIC_COMMENT_PENDING_DELETED_ENDPOINT/u);
 const altered=structuredClone(analysis);altered.reviewIr.commentThreads[0].anchorRange.endUtf16--;
 assert.throws(()=>genericCommentCandidates(altered,preview.contentPreview.paragraphs,{...options,manuscriptProfile:'YALKEN_MANUSCRIPT_V1'}),/DOCX_GENERIC_COMMENT_PENDING_UNION/u);
});

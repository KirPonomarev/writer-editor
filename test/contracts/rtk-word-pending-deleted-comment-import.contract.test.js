'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm');
const pending=require('../../src/core/word-pending-text-revisions-v1.cjs');
const envelope=require('../../src/core/document-content-envelope-v1.cjs');
const comments=require('../../src/core/word-comment-authoring-v1.cjs');
const {planPendingCommentDecision}=require('../../src/core/word-pending-comment-decisions-v1.cjs');
const fixture=path.join(__dirname,'../fixtures/docx-pending-deleted-comment-import.docx');
// Literal OOXML, authored independently of the application DOCX builder. The
// expected Unicode text and occurrence coordinates were fixed before parsing.
const sourceSha='796093baf899f924a0e9f401cbc9c241144931a96beecab71e20655a2641fabf';
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const rows=doc=>pending.paragraphs(doc).map(p=>(p.content||[]).map(n=>n.type==='hardBreak'?'\n':n.text).join(''));
const current=['Одинаковая фраза: повтор 🧭.','До ВСТАВКА😀 после.','До  после.','Одинаковая фраза: повтор 🧭.','Перед сноской.','Кавычки «точно», Café, Ελληνικά, 中文 и семья 👨‍👩‍👧‍👦.'];
const original=[...current];original[1]='До  после.';original[2]='До УДАЛЕНИЕ🧭 после.';
const bridgePromise=import('../../src/io/revisionBridge/index.mjs');
async function input({includeNotes=true}={}) {
  const bridge=await bridgePromise;let bytes=fs.readFileSync(fixture);assert.equal(sha(bytes),sourceSha);
  // Isolate the comment writer from the separately diagnosed pending-note
  // admission gap. The original full fixture stays unchanged and is tested
  // above; this variant removes the reference, part and exact relationships.
  if(!includeNotes) {
    const parts={...bridge.extractDocxReviewTransportPackagePartsFromZipBytes({bytes}).parts};
    parts['word/document.xml']=parts['word/document.xml'].replace('<w:footnoteReference w:id="7"/>','');
    parts['[Content_Types].xml']=parts['[Content_Types].xml'].replace(/<Override PartName="\/word\/footnotes.xml"[^>]*\/>/u,'');
    parts['word/_rels/document.xml.rels']=parts['word/_rels/document.xml.rels'].replace(/<Relationship Id="fn"[^>]*\/>/u,'');
    delete parts['word/footnotes.xml'];
    bytes=require('../../src/export/docx/docxMinBuilder.js').buildStoredZip(Object.entries(parts).map(([name,data])=>({name,data})));
  }
  const preview=bridge.buildDocxContentPreviewFromZipBytes(bytes);assert.equal(preview.ok,true,JSON.stringify(preview));
  const plan=bridge.buildDocxImportPreviewPlanFromContentPreview(preview);assert.equal(plan.ok,true,JSON.stringify(plan));
  const entry=plan.candidateCreatePlan.entries[0],doc=envelope.parseObservablePayload(entry.content).doc;
  const generic=await import('../../src/io/revisionBridge/genericWordComments.mjs');
  const state=generic.materializeGenericComments({candidates:entry.comments,paragraphs:rows(pending.normalizeNode(doc)),pendingDocument:doc,
    projectId:'tiny-import',sceneId:'roman/tiny.txt',importOperationId:'tiny-independent-docx',beforeText:null}).afterText;
  return {bridge,bytes,preview,plan,entry,doc,state};
}
function decide({doc,state},decision,projectId='tiny-import',sceneId='roman/tiny.txt') {
  // Reparse both persisted representations: no in-memory anchor identity is
  // needed for the next decision. This uses the existing history, not a new one.
  doc=envelope.parseObservablePayload(envelope.composeObservablePayload({doc})).doc;
  comments.readState(state,projectId); // CAS keeps the exact saved bytes.
  const after=pending.decide(doc,decision).doc;
  const plan=planPendingCommentDecision({beforeText:state,projectId,sceneId,beforeContent:envelope.composeObservablePayload({doc}),
    afterContent:envelope.composeObservablePayload({doc:after}),decision});
  return {doc:after,state:plan.afterText,plan};
}
function deletedThread(state) {return JSON.parse(state).threads.find(t=>t.messages[0].body==='Обсуждение удаления');}
function validateLive(doc,state) {
  const threads=JSON.parse(state).threads.filter(t=>t.status!=='deleted');
  return pending.buildCommentExportBinding({document:doc,anchors:threads.map(t=>({threadId:t.threadId,anchor:t.anchor}))});
}

test('independent ordinary DOCX keeps literal text, reply, hidden deletion and duplicate occurrence',async()=>{
  const x=await input(),ledger=pending.readLedger(x.doc);
  assert.deepEqual(rows(pending.materialize(ledger)),current);assert.deepEqual(rows(pending.materialize(ledger,'original')),original);
  assert.deepEqual(ledger.revisions.map(r=>[r.operation,r.paragraphIndex,r.from,r.to]),[['insert',1,3,12],['delete',2,3,13]]);
  const threads=JSON.parse(x.state).threads;assert.equal(threads.length,3);
  assert.deepEqual(threads[0].messages.map(m=>m.body),['Обсуждение вставки','Ответ к вставке']);
  assert.equal(threads[2].anchor.sceneParagraphIndex,3);assert.equal(threads[2].anchor.startUtf16,18);assert.equal(threads[2].anchor.selectedText,'повтор 🧭');
  const hidden=deletedThread(x.state);assert.equal(hidden.anchor.kind,'point');assert.equal(hidden.anchor.startUtf16,3);
  assert.deepEqual(pending.readCommentUnionContext({document:x.doc,anchor:hidden.anchor}),{quote:'УДАЛЕНИЕ🧭',hidden:true});
  const bound=validateLive(x.doc,x.state).binding.anchors.find(a=>a.threadId===hidden.threadId);
  assert.deepEqual(bound.unionStart,{paragraphIndex:2,offsetUtf16:3});assert.deepEqual(bound.unionEnd,{paragraphIndex:2,offsetUtf16:13});
  assert.equal(x.entry.notes.length,1);assert.equal(x.entry.notes[0].body.content[0].content[0].text,'Содержание сноски сохраняется.');
  assert.ok(JSON.stringify(x.doc).includes('highlight'));assert.equal(sha(fs.readFileSync(fixture)),sourceSha);
});

for(const status of ['open','resolved'])test(`hidden ${status} comment reveals its exact interval on reject and existing Undo/Redo`,async()=>{
  const x=await input(),state=JSON.parse(x.state);deletedThread(x.state);state.threads[1].status=status;x.state=JSON.stringify(state);
  const rejected=decide(x,{action:'rejectAll'}),thread=deletedThread(rejected.state);
  assert.deepEqual(rows(pending.normalizeNode(rejected.doc)),original);assert.equal(thread.status,status);
  assert.equal(thread.anchor.startUtf16,3);assert.equal(thread.anchor.selectedText,'УДАЛЕНИЕ🧭');assert.equal(thread.anchor.kind,undefined);
  assert.deepEqual(thread.messages,deletedThread(x.state).messages);validateLive(rejected.doc,rejected.state);
  assert.deepEqual(pending.readCommentUnionContext({document:rejected.doc,anchor:thread.anchor}),{quote:'УДАЛЕНИЕ🧭',hidden:false});
  const inserted=JSON.parse(rejected.state).threads[0];assert.equal(inserted.status,'deleted');assert.equal(inserted.anchor.selectedText,'ВСТАВКА😀');assert.equal(inserted.messages.length,2);
  const undone=decide(rejected,{action:'undo'});assert.deepEqual(deletedThread(undone.state).anchor,deletedThread(x.state).anchor);validateLive(undone.doc,undone.state);
  const redone=decide(undone,{action:'redo'});assert.deepEqual(deletedThread(redone.state).anchor,thread.anchor);assert.equal(deletedThread(redone.state).status,status);validateLive(redone.doc,redone.state);
});

test('accepting deletion keeps the source quote; manual deleted discussion never revives',async()=>{
  const x=await input(),accepted=decide(x,{action:'acceptAll'});validateLive(accepted.doc,accepted.state);
  assert.deepEqual(rows(pending.normalizeNode(accepted.doc)),current);
  assert.deepEqual(pending.readCommentUnionContext({document:accepted.doc,anchor:deletedThread(accepted.state).anchor}),{quote:'УДАЛЕНИЕ🧭',hidden:true});
  const manual=JSON.parse(x.state);manual.threads[1].status='deleted';
  const changed=decide({...x,state:JSON.stringify(manual)},{action:'rejectAll'});
  assert.deepEqual(deletedThread(changed.state),manual.threads[1]);
});

test('forged union identity refuses before materialization or a pending decision plan',async()=>{
  const x=await input(),thread=deletedThread(x.state),wrong=structuredClone(thread.anchor);wrong.pendingUnionLocator.geometrySha256='0'.repeat(64);
  assert.throws(()=>pending.readCommentUnionContext({document:x.doc,anchor:wrong}),/LOCATOR_STALE/);
  const state=JSON.parse(x.state);state.threads[1].anchor=wrong;
  assert.throws(()=>decide({...x,state:JSON.stringify(state)},{action:'rejectAll'}),/LOCATOR_STALE/);
  const shifted=structuredClone(thread.anchor);shifted.startUtf16++;
  assert.throws(()=>pending.readCommentUnionContext({document:x.doc,anchor:shifted}),/ANCHOR_STALE|LOCATOR_ENDPOINT/);
  const rejected=pending.decide(x.doc,{action:'rejectAll'}).doc;
  const forged=structuredClone(rejected),ledger=pending.readLedger(forged);ledger.source.content[2].content[0].text='Foreign source';
  assert.throws(()=>pending.rebaseCommentUnionAnchor({beforeDocument:x.doc,afterDocument:pending.bindLedger(ledger),anchor:thread.anchor}));
});

test('an endpoint inside pending deletion gives a typed refusal before project writes',async()=>{
  const bridge=await bridgePromise,bytes=fs.readFileSync(fixture),parts={...bridge.extractDocxReviewTransportPackagePartsFromZipBytes({bytes}).parts};
  const marker='<w:commentRangeStart w:id="1"/>';
  parts['word/document.xml']=parts['word/document.xml'].replace(marker,'').replace('<w:delText>УДАЛЕНИЕ🧭</w:delText>',
    '<w:delText>УД</w:delText></w:r>'+marker+'<w:r><w:delText>АЛЕНИЕ🧭</w:delText>');
  const changed=require('../../src/export/docx/docxMinBuilder.js').buildStoredZip(Object.entries(parts).map(([name,data])=>({name,data})));
  const preview=bridge.buildDocxContentPreviewFromZipBytes(changed);assert.equal(preview.ok,false);
  assert.match(JSON.stringify(preview),/DOCX_GENERIC_COMMENT_PENDING_DELETED_ENDPOINT/);
  assert.doesNotMatch(JSON.stringify(preview),/DOCX_CONTENT_PREVIEW_INTERNAL_ERROR/);
  assert.equal(bridge.buildDocxImportPreviewPlanFromContentPreview(preview).ok,false);
});

test('successive adjacent deletions and true point boundaries retain union occurrence ownership',async()=>{
  const ranges=require('../../src/core/word-comment-ranges-v1.cjs'),generic=await import('../../src/io/revisionBridge/genericWordComments.mjs');
  const source={type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'A oldnew Z'}]}]};
  const doc=pending.bindLedger({schemaVersion:1,source,revisions:[0,1].map(i=>({id:'revision-'+(i+1),nativeId:String(i),operation:'delete',
    paragraphIndex:0,from:2+i*3,to:5+i*3,state:'pending',groupId:null,author:'Editor',date:'',dateUtc:''})),undo:[],redo:[]});
  const anchor=ranges.deriveCommentAnchor({sceneId:'roman/tiny.txt',paragraphs:['A  Z'],input:{paragraphIndex:0,startUtf16:2,kind:'point',affinity:'right',selectedText:''}});
  const candidates=[[2,8],[2,2],[8,8]].map(([from,to])=>({paragraphIndex:0,startUtf16:2,selectedText:'',blockTextSha256:sha('A  Z'),kind:'point',affinity:'right',
    pendingUnionLocator:pending.createCommentUnionLocator({document:doc,anchor,unionStart:{paragraphIndex:0,offsetUtf16:from},unionEnd:{paragraphIndex:0,offsetUtf16:to}}),
    status:'open',messages:[{sourceCommentId:String(from)+':'+to,body:'Exact occurrence '+from+':'+to,provenance:{}}]}));
  const state=generic.materializeGenericComments({candidates,paragraphs:['A  Z'],pendingDocument:doc,projectId:'tiny-import',sceneId:'roman/tiny.txt',importOperationId:'adjacent-deletes',beforeText:null}).afterText;
  const first=decide({doc,state},{action:'reject',revisionId:'revision-1'});validateLive(first.doc,first.state);
  assert.equal(JSON.parse(first.state).threads[0].anchor.selectedText,'old');
  const second=decide(first,{action:'reject',revisionId:'revision-2'});validateLive(second.doc,second.state);
  const threads=JSON.parse(second.state).threads;assert.equal(threads[0].anchor.selectedText,'oldnew');
  assert.equal(threads[1].anchor.startUtf16,2);assert.equal(threads[2].anchor.startUtf16,8);
  const undo=decide(second,{action:'undo'});validateLive(undo.doc,undo.state);assert.equal(JSON.parse(undo.state).threads[0].anchor.selectedText,'old');
});

test('comment-only variant commits through real lease and durable decision reopens coherently',async t=>{
  const x=await input({includeNotes:false}),safe=require('../fixtures/docx-import-real-authority.cjs');
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'docx-deleted-comment-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const romanRoot=path.join(root,'roman');fs.mkdirSync(romanRoot);safe.rememberDocxImportPreviewPlanAdmission(x.plan);
  const options=await safe.withRealDocxImportAuthority({projectRoot:root,romanRoot,projectId:'tiny-import'});
  const result=await safe.applyDocxImportSafeCreate({docxImportPreviewPlan:x.plan},options);assert.equal(result.ok,true,JSON.stringify(result));
  const statePath=path.join(root,'.yalken/word-review/non-text-return-state.v1.json');
  const state=fs.readFileSync(statePath,'utf8'),sceneId=JSON.parse(state).threads[0].sceneId,scenePath=path.join(root,sceneId);
  const content=fs.readFileSync(scenePath,'utf8');
  const doc=envelope.parseObservablePayload(content).doc;assert.deepEqual(rows(pending.normalizeNode(doc)),current);validateLive(doc,state);
  assert.equal(deletedThread(state).sceneId,sceneId);assert.equal(deletedThread(state).anchor.kind,'point');
  const after=decide({doc,state},{action:'rejectAll'},options.projectId,sceneId),afterContent=envelope.composeObservablePayload({doc:after.doc});
  const tx=require('../../src/core/project-transaction-v1.cjs');
  await options.transactionAuthority.withProjectLease(options.projectId,lease=>lease.publish(async proof=>{
    await proof.assertOwned();const beforeManifest=fs.readFileSync(options.manifestPath,'utf8'),next=JSON.parse(beforeManifest);next.lastCommandId++;
    const args={scenePath,expectedSceneContent:content,sceneContent:afterContent,manifestPath:options.manifestPath,
      expectedManifestContent:beforeManifest,manifestContent:JSON.stringify(next),revision:lease.fencingGeneration,
      commentState:after.plan,revalidate:()=>proof.assertOwned(),
      verifyManifestContinuation:request=>options.transactionAuthority.verifyManifestContinuation({...request,projectId:options.projectId}),
      publishManifest:async({manifestPath,expectedText,nextText})=>{
        const r=await options.transactionAuthority.commitManifestText({projectId:options.projectId,lease,targetPath:manifestPath,expectedText,nextText,label:'tiny deleted comment decision'});
        assert.equal(r.readbackVerified,true);assert.equal(r.durablePublication,true);
      }};
    assert.equal((await tx.commitProjectTransaction(args)).success,true);await tx.readVerifiedProjectTransaction(args);
  }));
  const reopenedDoc=envelope.parseObservablePayload(fs.readFileSync(scenePath,'utf8')).doc,reopenedState=fs.readFileSync(statePath,'utf8');
  assert.deepEqual(rows(pending.normalizeNode(reopenedDoc)),original);assert.equal(deletedThread(reopenedState).anchor.selectedText,'УДАЛЕНИЕ🧭');
  assert.deepEqual(deletedThread(reopenedState).messages,deletedThread(state).messages);validateLive(reopenedDoc,reopenedState);
  assert.equal(JSON.parse(reopenedState).threads[0].messages.length,2);
  const undo=decide({doc:reopenedDoc,state:reopenedState},{action:'undo'},options.projectId,sceneId);assert.equal(deletedThread(undo.state).anchor.kind,'point');validateLive(undo.doc,undo.state);
  assert.equal(sha(fs.readFileSync(fixture)),sourceSha);
});

test('Main quote projection is derived; renderer escapes hidden text without changing the canonical anchor',async()=>{
  const x=await input(),state=JSON.parse(x.state),before=JSON.stringify(state);
  const main=fs.readFileSync(path.join(__dirname,'../../src/main.js'),'utf8');
  const fragment=main.slice(main.indexOf('async function readCommentAuthoringProjection()'),main.indexOf('function userBookmarkEnvelopeMetadataEqual('));
  const sandbox={pendingTextRevisions:pending,readCommentAuthoringContext:async()=>({projectId:'tiny-import',sceneId:'roman/tiny.txt',subjectId:'subject',
    sceneSha256:sha(x.entry.content),parsed:{doc:x.doc},saved:{state,stateSha256:sha(x.state)}}),normalizeRtkNonTextReturnThreadProjection:t=>structuredClone(t)};
  vm.createContext(sandbox);vm.runInContext(fragment,sandbox);const projection=await sandbox.readCommentAuthoringProjection();assert.equal(projection.available,true);
  assert.deepEqual(JSON.parse(JSON.stringify(projection.threads[1].anchorContext)),{kind:'hidden-revision-text',quote:'УДАЛЕНИЕ🧭'});assert.equal(JSON.stringify(state),before);
  const editor=fs.readFileSync(path.join(__dirname,'../../src/renderer/editor.js'),'utf8');
  const render=editor.slice(editor.indexOf('function renderWordCommentAuthoring(projection)'),editor.indexOf('function reviewSurfaceNormalizeState(input'));
  const ctx={wordCommentDraft:null,wordCommentBusy:false,wordCommentNotice:'',reviewSurfaceArray:v=>Array.isArray(v)?v:[],renderCommentBodyHtml:m=>m.body,
    reviewSurfaceEscapeHtml:value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c])};
  vm.createContext(ctx);vm.runInContext(render,ctx);assert.match(ctx.renderWordCommentAuthoring(projection),/Скрытый фрагмент: «УДАЛЕНИЕ🧭»/);
  projection.threads[1].anchorContext.quote='<img src=x onerror=alert(1)>';
  const html=ctx.renderWordCommentAuthoring(projection);assert.doesNotMatch(html,/<img/);assert.match(html,/&lt;img/);
});

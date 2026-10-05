'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const review=require('../../src/core/word-pending-text-revisions-v1.cjs');
const envelope=require('../../src/core/document-content-envelope-v1.cjs');
const {exactAnchor}=require('../../src/core/word-comment-authoring-v1.cjs');
const {planMixedPendingReturn}=require('../../src/core/word-pending-comment-return-v1.cjs');
const {buildFullManuscriptDocxReviewPacketSource:makeSource}=require('../../src/export/docx/fullManuscriptDocxReviewPacketSource.js');
const {buildDocxReviewPacketBuffer:build}=require('../../src/export/docx/docxReviewPacketBuilder.js');
const sha=v=>crypto.createHash('sha256').update(v).digest('hex');
const stable=v=>JSON.stringify(v,(_k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
const encode=doc=>envelope.composeObservablePayload({doc});
const projectId='mixed-test',sceneId='roman/a.txt';
async function fixture(clean=false) {
  const source={type:'doc',content:['oldnew','tail AAA BBB'].map(text=>({type:'paragraph',content:[{type:'text',text}]}))};
  const revisions=['delete','insert'].map((operation,i)=>({id:'revision-'+(i+1),nativeId:''+i,operation,author:'Writer',date:'',dateUtc:'',paragraphIndex:0,from:i*3,to:i*3+3,state:'pending',groupId:'group-1'}));
  let beforeDoc=review.bindLedger({schemaVersion:1,source,revisions,undo:[],redo:[]});
  if(clean)beforeDoc=review.normalizeNode(beforeDoc);
  const state={schemaVersion:'yalken.rtk.word.non-text-return-state.v1',projectId,revision:0,events:[],threads:[
    {threadId:'first',rootCommentId:'first-root',sceneId,status:'open',anchor:exactAnchor({paragraphIndex:0,startUtf16:1,selectedText:'ew'},sceneId,['new','tail AAA BBB']),messages:[{commentId:'first-root',kind:'root',body:'Old query',provenance:{author:'Writer'}}]},
    {threadId:'second',rootCommentId:'second-root',sceneId,status:'open',anchor:exactAnchor({paragraphIndex:1,startUtf16:9,selectedText:'BBB'},sceneId,['new','tail AAA BBB']),messages:[{commentId:'second-root',kind:'root',body:'Second query',provenance:{author:'Writer'}}]}]};
  const beforeContent=encode(beforeDoc),beforeText=JSON.stringify(state);
  const exported=makeSource({projectId,projectRoot:'/project',nonTextReturnState:state,scenes:[{sceneId,scenePath:'/project/'+sceneId,order:0,text:'new\ntail AAA BBB',doc:beforeDoc,observableContent:beforeContent}]});
  const ledger=structuredClone(review.readLedger(beforeDoc)||{schemaVersion:2,source:beforeDoc,revisions:[],undo:[],redo:[],roundUndo:[],roundRedo:[],returnReceipts:[]});ledger.source.content[1].content[0].text='tail AAAZZZ BBB';
  ledger.revisions.push(...['delete','insert'].map((operation,i)=>({id:'revision-'+(3+i),nativeId:''+(2+i),operation,author:'Editor',date:'',dateUtc:'',paragraphIndex:1,from:5+i*3,to:8+i*3,state:'pending',groupId:'group-2'})));
  const returnedDoc=review.bindLedger(ledger),afterState=structuredClone(state);
  afterState.threads.forEach((t,i)=>t.messages.push({commentId:'reply-'+i,kind:'reply',body:'Answer '+i,provenance:{author:'Editor'}}));
  afterState.threads[0].messages[0].body='Edited query';
  afterState.threads[1].anchor=exactAnchor({paragraphIndex:1,startUtf16:9,selectedText:'BBB'},sceneId,['new','tail ZZZ BBB']);
  afterState.threads.push({threadId:'new-root-thread',rootCommentId:'new-root',sceneId,status:'open',anchor:exactAnchor({paragraphIndex:1,startUtf16:6,selectedText:'ZZ'},sceneId,['new','tail ZZZ BBB']),messages:[{commentId:'new-root',kind:'root',body:'Fresh insertion query',provenance:{author:'Editor'}}]});
  const bytes=build(makeSource({projectId,projectRoot:'/project',nonTextReturnState:afterState,scenes:[{sceneId,scenePath:'/project/'+sceneId,order:0,text:'new\ntail ZZZ BBB',doc:returnedDoc}]}));
  const bridge=await import('../../src/io/revisionBridge/index.mjs'),cryptoPort={sha256Text:sha,sha256Json:v=>'sha256:'+sha(stable(v)),byteLength:v=>Buffer.byteLength(v)};
  const parsed=bridge.buildDocxReviewTransportAnalysisFromZipBytes({bytes},{cryptoPort});assert.equal(parsed.ok,true);
  const capsule=exported.localAuthorityCapsule;
  const documents=bridge.buildDocxPendingCommentReturnDocumentsFromZipBytes({bytes,exportMap:capsule.exportMap,baselineDocuments:[{sceneId,document:beforeDoc}],documentSections:capsule.documentSections,signedSectionsDigest:capsule.documentSections.protectedDigest,retainPendingSceneId:sceneId});assert.equal(documents.ok,true,JSON.stringify(documents));
  const proof={schemaVersion:1,projectId,roundId:'round-mixed',artifactSha256:'sha256:'+sha(bytes),baseline:capsule.commentExport,exportMap:capsule.exportMap,returnedDocument:documents.scenes[0].returnedDocument,
    returnedThreads:parsed.reviewIr.commentThreads,returnedParagraphs:parsed.reviewIr.formattingParagraphs.map(({paragraphIndex,paragraphText,trackedRevision})=>({paragraphIndex,paragraphText,trackedRevision})),commentReturnInventory:parsed.reviewIr.commentReturnInventory};
  return {beforeContent,beforeText,beforeDoc,proof,projectId,sceneId};
}
const plan=f=>planMixedPendingReturn({...f,returnProofJson:JSON.stringify(f.proof)});
async function assertDiscussionReadback(doc,state) {
 const canonical=JSON.parse(state),bridge=await import('../../src/io/revisionBridge/index.mjs');
 const bytes=build(makeSource({projectId,projectRoot:'/project',nonTextReturnState:canonical,scenes:[{sceneId,scenePath:'/project/'+sceneId,order:0,text:review.projection(doc).current,doc}]}));
 const result=bridge.buildDocxReviewTransportAnalysisFromZipBytes({bytes},{cryptoPort:{sha256Text:sha,sha256Json:v=>'sha256:'+sha(stable(v)),byteLength:v=>Buffer.byteLength(v)}});
 assert.equal(result.ok,true);const active=canonical.threads.filter(t=>t.status!=='deleted');assert.equal(result.reviewIr.commentThreads.length,active.length);
 for(const expected of active) {
  const actual=result.reviewIr.commentThreads.find(t=>t.body===expected.messages[0].body);assert.ok(actual);
  assert.deepEqual([actual.body,...actual.replies.map(r=>r.body)],expected.messages.map(m=>m.body));
  assert.equal(actual.finalTextAnchorRange.selectedText,expected.anchor.selectedText);
  assert.equal(actual.paragraphIndex,expected.anchor.sceneParagraphIndex);assert.equal(actual.finalTextAnchorRange.startUtf16,expected.anchor.startUtf16);
 }
}

test('mixed Word replacement preserves old partitions, rich source, multiple discussions and restart round inverse',async()=>{
  const f=await fixture(),p=plan(f),ledger=review.readLedger(p.replacement.doc);
  assert.equal(review.projection(p.replacement.doc).current,'new\ntail ZZZ BBB');
  assert.deepEqual(ledger.revisions.slice(0,2),review.readLedger(f.beforeDoc).revisions);
  assert.equal(JSON.parse(p.afterText).threads.length,3);
  const decisions=require('../../src/core/word-pending-comment-decisions-v1.cjs');
  let doc=JSON.parse(JSON.stringify(p.replacement.doc)),state=p.afterText;
  for(const action of ['undo','redo']) {
    const next=review.decide(doc,{action}).doc;
    state=decisions.planPendingCommentDecision({beforeText:state,projectId,sceneId,beforeContent:encode(doc),afterContent:encode(next),decision:{action}}).afterText;doc=next;
    assert.equal(JSON.parse(state).threads.reduce((n,t)=>n+t.messages.length,0),5);
    assert.equal(JSON.parse(state).threads.at(-1).status,action==='undo'?'deleted':'open');
  }
  assert.equal(review.projection(doc).current,'new\ntail ZZZ BBB');
  const reexport=makeSource({projectId,projectRoot:'/project',nonTextReturnState:JSON.parse(state),scenes:[{sceneId,scenePath:'/project/'+sceneId,order:0,text:review.projection(doc).current,doc}]});
  assert.ok(build(reexport).length>0);
});
for(const [name,mutate] of Object.entries({
  provenance:f=>{const d=f.proof.returnedDocument,l=review.readLedger(d);l.revisions[0].author='forged';l.revisions.forEach(r=>r.groupId=null);f.proof.returnedDocument=review.bindLedger(l);},
  missingPartition:f=>{const l=review.readLedger(f.proof.returnedDocument);l.revisions.shift();l.revisions.forEach(r=>r.groupId=null);f.proof.returnedDocument=review.bindLedger(l);},
  missingInventory:f=>{delete f.proof.commentReturnInventory;},
  anchor:f=>{f.proof.returnedThreads[0].anchorRange.startUtf16++;},
  foreignProject:f=>{f.proof.projectId='foreign';},
  baseline:f=>{f.beforeContent+=' ';},
  visibleText:f=>{f.proof.returnedParagraphs[1].paragraphText+='forged';},
  format:f=>{const l=review.readLedger(f.proof.returnedDocument);l.source.content[1].content[0].marks=[{type:'bold'}];f.proof.returnedDocument=review.bindLedger(l);},
  unknownField:f=>{f.proof.extra=true;},
}))test('mixed return refuses '+name+' before publication',async()=>{const f=await fixture();mutate(f);assert.throws(()=>plan(f));});
test('first clean signed rich baseline admits changed pending graph with reversible empty source round',async()=>{
 const f=await fixture(true),p=plan(f);assert.equal(review.readLedger(f.beforeDoc),null);
 assert.equal(review.projection(p.replacement.doc).current,'new\ntail ZZZ BBB');
 const undo=review.decide(p.replacement.doc,{action:'undo'}).doc;
 assert.deepEqual(review.normalizeNode(undo),review.normalizeNode(f.beforeDoc));
});
test('repeated equal pending insertion cannot choose an old occurrence by matching quote',()=>{
 const make=value=>review.bindLedger({schemaVersion:1,source:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:value}]}]},
   revisions:[{id:'revision-1',nativeId:'0',operation:'insert',author:'A',date:'',dateUtc:'',paragraphIndex:0,from:0,to:value.length,state:'pending',groupId:null}],undo:[],redo:[]});
 const before=make('a'),after=make('aa'),binding=review.buildCommentExportBinding({document:before,schemaVersion:2}).binding;
 const ledger=review.readLedger(after);ledger.source=review.buildCommentExportBinding({document:after,schemaVersion:2}).projection.union;
 assert.throws(()=>require('../../src/core/word-pending-comment-return-v1.cjs').deriveMixedPendingDocument({document:before,returnedDocument:review.bindLedger(ledger),binding,anchors:[]}),/MAPPING_AMBIGUOUS/);
});
test('changed megaparagraph refuses before character atom allocation',()=>{
 const make=value=>review.bindLedger({schemaVersion:1,source:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:value}]}]},
   revisions:[{id:'revision-1',nativeId:'0',operation:'insert',author:'A',date:'',dateUtc:'',paragraphIndex:0,from:0,to:value.length,state:'pending',groupId:null}],undo:[],redo:[]});
 const before=make('a'.repeat(10000)),after=make('a'.repeat(10000)+'b'),binding=review.buildCommentExportBinding({document:before,schemaVersion:2}).binding;
 const ledger=review.readLedger(after);ledger.source=review.buildCommentExportBinding({document:after,schemaVersion:2}).projection.union;
 assert.throws(()=>require('../../src/core/word-pending-comment-return-v1.cjs').deriveMixedPendingDocument({document:before,returnedDocument:review.bindLedger(ledger),binding,anchors:[]}),/CHANGED_PARAGRAPH_BUDGET/);
});

test('mixed comment starting at replacement insertion keeps its explicit Word union endpoint on reexport and round redo',async()=>{
 const f=await fixture(),thread=f.proof.returnedThreads.at(-1);
 thread.anchorRange.startUtf16=8;thread.anchorRange.endUtf16=11;thread.anchorRange.selectedText='ZZZ';thread.quotedAnchorText='ZZZ';
 thread.finalTextAnchorRange.startUtf16=5;thread.finalTextAnchorRange.endUtf16=8;thread.finalTextAnchorRange.selectedText='ZZZ';
 const p=plan(f),decisions=require('../../src/core/word-pending-comment-decisions-v1.cjs');let doc=p.replacement.doc,state=p.afterText;
 const exported=()=>makeSource({projectId,projectRoot:'/project',nonTextReturnState:JSON.parse(state),scenes:[{sceneId,scenePath:'/project/'+sceneId,order:0,text:review.projection(doc).current,doc}]});
 assert.ok(build(exported()).length);await assertDiscussionReadback(doc,state);
 for(const action of ['undo','redo']) {const next=review.decide(doc,{action}).doc;state=decisions.planPendingCommentDecision({beforeText:state,projectId,sceneId,beforeContent:encode(doc),afterContent:encode(next),decision:{action}}).afterText;doc=next;assert.ok(build(exported()).length);await assertDiscussionReadback(doc,state);}
});

for(const action of ['accept','reject'])for(const targetId of ['revision-1','revision-2','revision-3','revision-4'])test('boundary discussion stays exportable through '+action+' '+targetId+' and decision Undo/Redo',async()=>{
 const f=await fixture(),thread=f.proof.returnedThreads.at(-1);
 Object.assign(thread.anchorRange,{startUtf16:8,endUtf16:11,selectedText:'ZZZ'});thread.quotedAnchorText='ZZZ';
 Object.assign(thread.finalTextAnchorRange,{startUtf16:5,endUtf16:8,selectedText:'ZZZ'});
 const p=plan(f),decisions=require('../../src/core/word-pending-comment-decisions-v1.cjs');let doc=p.replacement.doc,state=p.afterText;
 for(const decision of [{action,revisionId:targetId},{action:'undo'},{action:'redo'}]) {
   const next=review.decide(doc,decision).doc;
   state=decisions.planPendingCommentDecision({beforeText:state,projectId,sceneId,beforeContent:encode(doc),afterContent:encode(next),decision}).afterText;doc=next;
   await assertDiscussionReadback(doc,state);
 }
});
for(const kind of ['stale','endpoint','unknown'])test('export refuses '+kind+' pending union locator before publication',async()=>{
 const f=await fixture(),thread=f.proof.returnedThreads.at(-1);
 Object.assign(thread.anchorRange,{startUtf16:8,endUtf16:11,selectedText:'ZZZ'});thread.quotedAnchorText='ZZZ';
 Object.assign(thread.finalTextAnchorRange,{startUtf16:5,endUtf16:8,selectedText:'ZZZ'});
 const p=plan(f),state=JSON.parse(p.afterText),locator=state.threads.at(-1).anchor.pendingUnionLocator;
 if(kind==='stale')locator.geometrySha256='0'.repeat(64);else if(kind==='endpoint')locator.unionStart.offsetUtf16++;else locator.extra=true;
 assert.throws(()=>makeSource({projectId,projectRoot:'/project',nonTextReturnState:state,scenes:[{sceneId,scenePath:'/project/'+sceneId,order:0,text:review.projection(p.replacement.doc).current,doc:p.replacement.doc}]}),/LOCATOR/);
});

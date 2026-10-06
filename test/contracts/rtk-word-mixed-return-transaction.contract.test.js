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
async function fixture(clean=false,missing=false,dense=false,format=false) {
  const source={type:'doc',content:['oldnew','tail AAA BBB'].map(text=>({type:'paragraph',content:[{type:'text',text}]}))};
  const revisions=['delete','insert'].map((operation,i)=>({id:'revision-'+(i+1),nativeId:''+i,operation,author:'Writer',date:'',dateUtc:'',paragraphIndex:0,from:i*3,to:i*3+3,state:'pending',groupId:'group-1'}));
  let beforeDoc=review.bindLedger({schemaVersion:1,source,revisions,undo:[],redo:[]});
  if(clean)beforeDoc=review.normalizeNode(beforeDoc);
  const state={schemaVersion:'yalken.rtk.word.non-text-return-state.v1',projectId,revision:0,events:[],threads:[
    {threadId:'first',rootCommentId:'first-root',sceneId,status:'open',anchor:exactAnchor({paragraphIndex:0,startUtf16:1,selectedText:'ew'},sceneId,['new','tail AAA BBB']),messages:[{commentId:'first-root',kind:'root',body:'Old query',provenance:{author:'Writer'}}]},
    {threadId:'second',rootCommentId:'second-root',sceneId,status:'open',anchor:exactAnchor({paragraphIndex:1,startUtf16:9,selectedText:'BBB'},sceneId,['new','tail AAA BBB']),messages:[{commentId:'second-root',kind:'root',body:'Second query',provenance:{author:'Writer'}}]}]};
  if(dense){
    const first=structuredClone(state.threads[0]);
    while(state.threads.length<40){const i=state.threads.length,t=structuredClone(first);t.threadId='dense-'+i;t.rootCommentId='dense-root-'+i;t.messages=[{commentId:t.rootCommentId,kind:'root',body:'Р'.repeat(400),provenance:{author:'Writer'}},{commentId:'dense-reply-'+i,kind:'reply',body:'О'.repeat(400),provenance:{author:'Editor'}}];state.threads.push(t);}
    state.schemaVersion='yalken.rtk.word.non-text-return-state.v6';
  }
  if(missing)state.threads=[];
  const beforeContent=encode(beforeDoc),beforeText=missing?null:JSON.stringify(state);
  const exported=makeSource({projectId,projectRoot:'/project',nonTextReturnState:state,scenes:[{sceneId,scenePath:'/project/'+sceneId,order:0,text:'new\ntail AAA BBB',doc:beforeDoc,observableContent:beforeContent}]});
  const ledger=structuredClone(review.readLedger(beforeDoc)||{schemaVersion:2,source:beforeDoc,revisions:[],undo:[],redo:[],roundUndo:[],roundRedo:[],returnReceipts:[]});ledger.source.content[1].content[0].text='tail AAAZZZ BBB';
  ledger.revisions.push(...['delete','insert'].map((operation,i)=>({id:'revision-'+(3+i),nativeId:''+(2+i),operation,author:'Editor',date:'',dateUtc:'',paragraphIndex:1,from:5+i*3,to:8+i*3,state:'pending',groupId:'group-2'})));
  if(format) {
    const marks=[{type:'textStyle',attrs:{wordLanguage:{val:'ru-RU'}}}];
    ledger.source.content[1].content=[{type:'text',text:'tail AAAZZZ '},{type:'text',text:'BBB',marks}];
    ledger.revisions.push({id:'revision-5',nativeId:'4',operation:'format',author:'Editor',date:'',dateUtc:'',paragraphIndex:1,from:12,to:15,state:'pending',groupId:null,format:{kind:'run',before:[],after:marks}});
  }
  const returnedDoc=review.bindLedger(ledger),afterState=structuredClone(state);
  afterState.threads.forEach((t,i)=>t.messages.push({commentId:'reply-'+i,kind:'reply',body:'Answer '+i,provenance:{author:'Editor'}}));
  if(!missing)afterState.threads[0].messages[0].body='Edited query';
  if(!missing)afterState.threads[1].anchor=exactAnchor({paragraphIndex:1,startUtf16:9,selectedText:'BBB'},sceneId,['new','tail ZZZ BBB']);
  afterState.threads.push({threadId:'new-root-thread',rootCommentId:'new-root',sceneId,status:'open',anchor:exactAnchor({paragraphIndex:1,startUtf16:6,selectedText:'ZZ'},sceneId,['new','tail ZZZ BBB']),messages:[{commentId:'new-root',kind:'root',body:'Fresh insertion query',provenance:{author:'Editor'}}]});
  const bytes=build(makeSource({projectId,projectRoot:'/project',nonTextReturnState:afterState,scenes:[{sceneId,scenePath:'/project/'+sceneId,order:0,text:'new\ntail ZZZ BBB',doc:returnedDoc}]}));
  const bridge=await import('../../src/io/revisionBridge/index.mjs'),cryptoPort={sha256Text:sha,sha256Json:v=>'sha256:'+sha(stable(v)),byteLength:v=>Buffer.byteLength(v)};
  const parsed=bridge.buildDocxReviewTransportAnalysisFromZipBytes({bytes},{cryptoPort});assert.equal(parsed.ok,true);
  const capsule=exported.localAuthorityCapsule;
  const documents=bridge.buildDocxPendingCommentReturnDocumentsFromZipBytes({bytes,exportMap:capsule.exportMap,baselineDocuments:[{sceneId,document:beforeDoc}],documentSections:capsule.documentSections,signedSectionsDigest:capsule.documentSections.protectedDigest,retainPendingSceneId:sceneId});assert.equal(documents.ok,true,JSON.stringify(documents));
  const proof={schemaVersion:1,projectId,roundId:'round-mixed',artifactSha256:'sha256:'+sha(bytes),baseline:capsule.commentExport,exportMap:capsule.exportMap,returnedDocument:documents.scenes[0].returnedDocument,
    returnedThreads:parsed.reviewIr.commentThreads,returnedParagraphs:parsed.reviewIr.formattingParagraphs.map(({paragraphIndex,paragraphText,trackedRevision})=>({paragraphIndex,paragraphText,trackedRevision})),commentReturnInventory:parsed.reviewIr.commentReturnInventory};
  if(dense){proof.schemaVersion=2;proof.returnedLedger=review.readLedger(proof.returnedDocument);delete proof.returnedDocument;delete proof.exportMap.commentExport;}
  return {beforeContent,beforeText,beforeDoc,proof,projectId,sceneId};
}
const plan=f=>planMixedPendingReturn({...f,returnProofJson:JSON.stringify(f.proof)});

test('changed text, comment bodies and pending language survive exact mixed return and round Undo/Redo', async () => {
  const f=await fixture(true,false,false,true),result=plan(f);
  const doc=envelope.parseObservablePayload(result.content).doc,ledger=review.readLedger(doc);
  assert.equal(review.projection(doc).current,'new\ntail ZZZ BBB');
  assert.equal(review.projection(doc).original,'new\ntail AAA BBB');
  const format=ledger.revisions.find(r=>r.operation==='format');assert.ok(format);
  assert.deepEqual(format.format.before,[]);
  assert.deepEqual(format.format.after,[{type:'textStyle',attrs:{wordLanguage:{val:'ru-RU'}}}]);
  const state=JSON.parse(result.afterText);
  assert.equal(state.threads[0].messages[0].body,'Edited query');
  assert.equal(state.threads[1].anchor.startUtf16,9);
  const undone=review.decide(doc,{action:'undo'}).doc;
  assert.deepEqual(review.normalizeNode(undone),review.normalizeNode(f.beforeDoc));
  const redone=review.decide(undone,{action:'redo'}).doc;
  assert.deepEqual(review.normalizeNode(redone),review.normalizeNode(doc));
  assert.deepEqual(review.readLedger(redone).revisions,ledger.revisions);
  const source = makeSource({projectId,projectRoot:'/project',nonTextReturnState:state,
    scenes:[{sceneId,scenePath:'/project/'+sceneId,order:0,text:review.projection(doc).current,doc,observableContent:result.content}]});
  const bridge=await import('../../src/io/revisionBridge/index.mjs');
  const bytes=build(source),preview=bridge.buildDocxContentPreviewFromZipBytes(bytes);
  assert.equal(preview.ok,true,JSON.stringify(preview));
  const unchanged=require('../../src/core/word-pending-comment-return-v1.cjs').deriveMixedPendingDocument({
    document:doc,returnedDocument:preview.contentPreview.pendingRevisionDocument,
    binding:source.localAuthorityCapsule.exportMap.scenes[0].pendingCommentBinding,
    anchors:state.threads.map(t=>({threadId:t.threadId,anchor:t.anchor})),
    exportTypography:source.localAuthorityCapsule.exportMap.exportTypography,
    exportParagraphs:source.localAuthorityCapsule.exportMap.scenes[0].blocks.map(b=>b.formatIr.paragraph)});
  assert.equal(unchanged.changed,false);
  assert.deepEqual(review.readLedger(unchanged.document).revisions,ledger.revisions);
  const forged=structuredClone(preview.contentPreview.pendingRevisionDocument),bad=review.readLedger(forged);
  const property=bad.revisions.find(r=>r.operation==='format');
  property.format.before=[{type:'bold'}];
  const forgedDoc=review.bindLedger(bad);
  assert.throws(()=>require('../../src/core/word-pending-comment-return-v1.cjs').deriveMixedPendingDocument({
    document:doc,returnedDocument:forgedDoc,binding:source.localAuthorityCapsule.exportMap.scenes[0].pendingCommentBinding,
    anchors:state.threads.map(t=>({threadId:t.threadId,anchor:t.anchor})),exportTypography:source.localAuthorityCapsule.exportMap.exportTypography,
    exportParagraphs:source.localAuthorityCapsule.exportMap.scenes[0].blocks.map(b=>b.formatIr.paragraph)}),/MIXED_RETURN_SOURCE_CHANGED/);
});
const fs=require('node:fs'),fsp=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {spawn}=require('node:child_process');
const tx=require('../../src/core/project-transaction-v1.cjs');
const {durableSaveTransaction}=require('../../src/core/save-coordinator-v1.cjs');
async function diskFixture(t,clean=false,missing=false,dense=false) {
  const input=await fixture(clean,missing,dense),p=plan(input);
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'word-mixed-atomic-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const scenePath=path.join(root,sceneId),manifestPath=path.join(root,'project.json'),commentPath=path.join(root,'.yalken/word-review/non-text-return-state.v1.json');
  fs.mkdirSync(path.dirname(scenePath),{recursive:true});fs.mkdirSync(path.dirname(commentPath),{recursive:true});
  const beforeManifest=JSON.stringify({projectId,revision:1}),afterManifest=JSON.stringify({projectId,revision:2});
  fs.writeFileSync(scenePath,input.beforeContent);fs.writeFileSync(manifestPath,beforeManifest);if(input.beforeText!==null)fs.writeFileSync(commentPath,input.beforeText);
  const commentState={mode:p.mode,beforeText:p.beforeText,afterText:p.afterText,returnProofJson:p.returnProofJson};
  const request={scenePath,manifestPath,expectedSceneContent:input.beforeContent,sceneContent:p.content,expectedManifestContent:beforeManifest,manifestContent:afterManifest,revision:2,commentState};
  fs.writeFileSync(path.join(root,'request.json'),JSON.stringify(request));
  return {root,scenePath,manifestPath,commentPath,request,before:[input.beforeContent,beforeManifest,input.beforeText],after:[p.content,afterManifest,p.afterText]};
}
const observed=f=>[f.scenePath,f.manifestPath,f.commentPath].map(p=>fs.existsSync(p)?fs.readFileSync(p,'utf8'):null);
const publishManifest=async({manifestPath,expectedText,nextText,revision})=>{assert.equal(fs.readFileSync(manifestPath,'utf8'),expectedText);await durableSaveTransaction({filePath:manifestPath,content:nextText,revision});};
test('mixed transaction independently rejects forged companion and stale CAS, then commits exact scene and discussions',async t=>{
  const f=await diskFixture(t),forged=structuredClone(f.request),state=JSON.parse(forged.commentState.afterText);
  state.threads[0].messages[0].body='forged after planner';forged.commentState.afterText=JSON.stringify(state);
  await assert.rejects(tx.commitProjectTransaction({...forged,publishManifest}),/COMMENT_STATE/);assert.deepEqual(observed(f),f.before);
  fs.writeFileSync(f.commentPath,f.before[2]+' ');
  await assert.rejects(tx.commitProjectTransaction({...f.request,publishManifest}),/COMMENT_CAS/);assert.deepEqual(observed(f),[...f.before.slice(0,2),f.before[2]+' ']);
  fs.writeFileSync(f.commentPath,f.before[2]);
  await tx.commitProjectTransaction({...f.request,publishManifest});assert.deepEqual(observed(f),f.after);
});
const CHILD=String.raw`
const fs=require('node:fs'),fsp=require('node:fs/promises'),path=require('node:path');
const tx=require(process.argv[1]),{durableSaveTransaction}=require(process.argv[2]),root=process.argv[3],mode=process.argv[4],boundary=process.argv[5];
const q=JSON.parse(fs.readFileSync(path.join(root,'request.json'))),comments=path.join(root,'.yalken/word-review/non-text-return-state.v1.json');
const points=new Map([[tx.journalPathFor(q.manifestPath),'JOURNAL'],[q.manifestPath,'MANIFEST'],[q.scenePath,'SCENE'],[comments,'COMMENT'],[tx.commitPathFor(q.scenePath),'COMMIT']]);
const adapter={...fsp,rename:async(a,b)=>{await fsp.rename(a,b);if(mode==='crash'&&points.get(b)===boundary)process.kill(process.pid,'SIGKILL');},unlink:async p=>{if(mode==='crash'&&p===tx.journalPathFor(q.manifestPath)&&boundary==='BEFORE_CLEANUP')process.kill(process.pid,'SIGKILL');await fsp.unlink(p);if(mode==='crash'&&p===tx.journalPathFor(q.manifestPath)&&boundary==='AFTER_CLEANUP')process.kill(process.pid,'SIGKILL');}};
const publishManifest=async({manifestPath,expectedText,nextText,revision})=>{if(fs.readFileSync(manifestPath,'utf8')!==expectedText)throw Error('CAS');await durableSaveTransaction({filePath:manifestPath,content:nextText,revision,fsAdapter:adapter});};
(mode==='recover'?tx.recoverProjectTransaction({scenePath:q.scenePath,manifestPath:q.manifestPath,publishManifest,fsAdapter:adapter}):tx.commitProjectTransaction({...q,publishManifest,fsAdapter:adapter})).then(r=>{console.log(JSON.stringify(r));}).catch(e=>{console.error(e.code||e.message);process.exitCode=1;});
`;
const child=(f,mode,boundary='')=>new Promise((resolve,reject)=>{
  const c=spawn(process.execPath,['-e',CHILD,require.resolve('../../src/core/project-transaction-v1.cjs'),require.resolve('../../src/core/save-coordinator-v1.cjs'),f.root,mode,boundary],{stdio:['ignore','pipe','pipe']});let stdout='',stderr='';
  const timer=setTimeout(()=>{c.kill('SIGKILL');reject(Error('owned test process timeout'));},15000);
  c.stdout.on('data',v=>stdout+=v);c.stderr.on('data',v=>stderr+=v);c.on('error',reject);c.on('close',(code,signal)=>{clearTimeout(timer);resolve({code,signal,stdout,stderr});});
});
for(const boundary of ['MANIFEST','SCENE','COMMENT','COMMIT'])test('mixed transaction SIGKILL '+boundary+' recovers coherently in fresh process',async t=>{
  const f=await diskFixture(t),crash=await child(f,'crash',boundary);assert.equal(crash.signal,'SIGKILL',JSON.stringify(crash));
  const recovery=await child(f,'recover');assert.equal(recovery.code,0,recovery.stderr);
  assert.deepEqual(observed(f),boundary==='COMMIT'?f.after:f.before);
  assert.equal((await child(f,'recover')).code,0);
  if(boundary!=='COMMIT')assert.equal((await child(f,'commit')).code,0);
  assert.deepEqual(observed(f),f.after);
});
test('first clean rich scene and multiple discussions use the same independently checked atomic writer',async t=>{
 const f=await diskFixture(t,true);await tx.commitProjectTransaction({...f.request,publishManifest});assert.deepEqual(observed(f),f.after);
});


test('missing first discussion file commits through actual atomic writer and binds explicit null receipt',async t=>{
 const f=await diskFixture(t,true,true);assert.equal(fs.existsSync(f.commentPath),false);
 await tx.commitProjectTransaction({...f.request,publishManifest});assert.deepEqual(observed(f),f.after);
 const record=JSON.parse(fs.readFileSync(tx.commitPathFor(f.scenePath),'utf8'));
 assert.equal(record.commentState.beforeDigest,null);assert.equal(record.commentState.mode,f.request.commentState.mode);
 assert.equal(tx.classifyProjectTransactionState(f).classification,'NEW_COMMITTED');
 const originalRecord=fs.readFileSync(tx.commitPathFor(f.scenePath),'utf8');
 record.commentState.mode='SAFE_ANCHOR_REBASE_V1';fs.writeFileSync(tx.commitPathFor(f.scenePath),JSON.stringify(record));
 assert.equal(tx.classifyProjectTransactionState(f).classification,'PARTIAL_CORRUPTION_DETECTED');
 fs.writeFileSync(tx.commitPathFor(f.scenePath),originalRecord);
});
for(const boundary of ['JOURNAL','MANIFEST','SCENE','COMMENT','COMMIT','BEFORE_CLEANUP','AFTER_CLEANUP'])test('missing first discussion SIGKILL '+boundary+' restores absence or committed cohort',async t=>{
 const f=await diskFixture(t,true,true),crash=await child(f,'crash',boundary);assert.equal(crash.signal,'SIGKILL',JSON.stringify(crash));
 const recovery=await child(f,'recover');assert.equal(recovery.code,0,recovery.stderr);assert.deepEqual(observed(f),['COMMIT','BEFORE_CLEANUP','AFTER_CLEANUP'].includes(boundary)?f.after:f.before);
 assert.equal((await child(f,'recover')).code,0);
 if(!['COMMIT','BEFORE_CLEANUP','AFTER_CLEANUP'].includes(boundary))assert.equal((await child(f,'commit')).code,0);
 assert.deepEqual(observed(f),f.after);assert.equal(tx.classifyProjectTransactionState(f).classification,'NEW_COMMITTED');
});
test('nullable comment source cannot overwrite concurrent file or bypass existing-state proof',async t=>{
 const missing=await diskFixture(t,true,true);fs.writeFileSync(missing.commentPath,'concurrent');
 await assert.rejects(tx.commitProjectTransaction({...missing.request,publishManifest}),/COMMENT_CAS/);
 assert.deepEqual(observed(missing),[...missing.before.slice(0,2),'concurrent']);
 const existing=await diskFixture(t),forged=structuredClone(existing.request);forged.commentState.beforeText=null;
 await assert.rejects(tx.commitProjectTransaction({...forged,publishManifest}),/COMMENT_STATE/);assert.deepEqual(observed(existing),existing.before);
 const wrongMode=structuredClone(missing.request);delete wrongMode.commentState.mode;delete wrongMode.commentState.returnProofJson;
 await assert.rejects(tx.commitProjectTransaction({...wrongMode,publishManifest}),/COMMENT_STATE/);
});

for(const location of ['leaf','parent'])test('first discussion refuses '+location+' symlink without publishing scene or following external target',async t=>{
 const f=await diskFixture(t,true,true),outside=path.join(f.root,'outside');fs.mkdirSync(outside);
 const target=path.join(outside,'non-text-return-state.v1.json');fs.writeFileSync(target,'external');
 if(location==='leaf')fs.symlinkSync(target,f.commentPath);
 else {fs.rmdirSync(path.dirname(f.commentPath));fs.symlinkSync(outside,path.dirname(f.commentPath));}
 await assert.rejects(tx.commitProjectTransaction({...f.request,publishManifest}),/BOUNDARY|SYMLINK/);
 assert.equal(fs.readFileSync(target,'utf8'),'external');assert.deepEqual(observed(f).slice(0,2),f.before.slice(0,2));
});
test('first discussion with missing parent fails through existing writer and recovers original absence',async t=>{
 const f=await diskFixture(t,true,true);fs.rmdirSync(path.dirname(f.commentPath));fs.rmdirSync(path.dirname(path.dirname(f.commentPath)));
 await assert.rejects(tx.commitProjectTransaction({...f.request,publishManifest}),/ENOENT/);
 await tx.recoverProjectTransaction({...f,publishManifest});assert.deepEqual(observed(f),f.before);
 assert.equal(fs.existsSync(path.dirname(f.commentPath)),false);
});

for(const boundary of ['JOURNAL','MANIFEST','SCENE','COMMENT','COMMIT','BEFORE_CLEANUP','AFTER_CLEANUP'])test('V6 greater than 64KiB SIGKILL '+boundary+' recovers exact cohort in a fresh process',async t=>{
 const f=await diskFixture(t,false,false,true);assert.ok(Buffer.byteLength(f.before[2])>65536);assert.ok(Buffer.byteLength(f.after[2])>65536);
 const crash=await child(f,'crash',boundary);assert.equal(crash.signal,'SIGKILL',JSON.stringify(crash));
 if(fs.existsSync(tx.journalPathFor(f.manifestPath)))assert.ok(fs.statSync(tx.journalPathFor(f.manifestPath)).size<32*1024*1024);
 const recovery=await child(f,'recover');assert.equal(recovery.code,0,recovery.stderr);
 const committed=['COMMIT','BEFORE_CLEANUP','AFTER_CLEANUP'].includes(boundary);assert.deepEqual(observed(f),committed?f.after:f.before);
 const repeated=await child(f,'recover');assert.equal(repeated.code,0,repeated.stderr);assert.deepEqual(observed(f),committed?f.after:f.before);
 if(!committed){const result=await child(f,'commit');assert.equal(result.code,0,result.stderr);}
 assert.deepEqual(observed(f),f.after);assert.equal(tx.classifyProjectTransactionState(f).classification,'NEW_COMMITTED');
});
test('V6 large-state forged companion and concurrent canonical update cannot publish',async t=>{
 const f=await diskFixture(t,false,false,true),bad=structuredClone(f.request),state=JSON.parse(bad.commentState.afterText);state.threads[2].messages[0].body='forged';bad.commentState.afterText=JSON.stringify(state);
 await assert.rejects(tx.commitProjectTransaction({...bad,publishManifest}),/COMMENT_STATE/);assert.deepEqual(observed(f),f.before);
 fs.writeFileSync(f.commentPath,f.before[2]+' ');await assert.rejects(tx.commitProjectTransaction({...f.request,publishManifest}),/COMMENT_CAS/);assert.deepEqual(observed(f),[...f.before.slice(0,2),f.before[2]+' ']);
});

test('compact proof2 reconstructs exact legacy1 outcome and rejects conflicting or malformed source representations',async()=>{
 const f=await fixture(),legacy=plan(f),proof=structuredClone(f.proof);proof.schemaVersion=2;proof.returnedLedger=review.readLedger(proof.returnedDocument);delete proof.returnedDocument;delete proof.exportMap.commentExport;
 const compact=plan({...f,proof});assert.equal(compact.content,legacy.content);assert.equal(compact.afterText,legacy.afterText);
 for(const alter of [p=>p.schemaVersion=3,p=>p.returnedDocument=f.proof.returnedDocument,p=>p.returnedLedger=null,p=>p.returnedLedger.extra=true,p=>p.exportMap.commentExport=p.baseline,p=>p.returnedLedger.source.content[0].content[0].text='forged']){
  const changed=structuredClone(proof);alter(changed);assert.throws(()=>plan({...f,proof:changed}),/MIXED_RETURN_|PENDING_/);
 }
});

// Three independently persisted owners, one global discussion state. The
// journal receives a regenerated semantic proof, not precomputed after bytes.
async function bookDiskFixture(t) {
 const f=await fixture(),single=plan(f),root=fs.mkdtempSync(path.join(os.tmpdir(),'word-book-atomic-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const manifestPath=path.join(root,'project.craftsman.json'),ids=[sceneId,'roman/b.txt','roman/c.txt'];
 const marks=[{type:'textStyle',attrs:{fontFamily:'Times New Roman',fontSize:'12pt',wordLanguage:{val:'en-US',eastAsia:'en-US',bidi:'en-US'}}}];
 const clean=text=>({type:'doc',content:[{type:'paragraph',content:[{type:'text',text,marks}]}]});
 const docs=[f.beforeDoc,clean('Beta'),clean('BBB')],raws=docs.map(encode),before=JSON.parse(f.beforeText);
 const initial=makeSource({projectId,projectRoot:root,nonTextReturnState:before,scenes:ids.map((id,i)=>({sceneId:id,scenePath:path.join(root,id),order:i,text:envelope.deriveVisibleTextFromDocument(docs[i]),doc:docs[i],observableContent:raws[i]}))});
 const changedB=review.bindLedger({schemaVersion:1,source:clean('Beta NEW'),revisions:[{id:'revision-1',nativeId:'1',operation:'insert',author:'Editor',date:'',dateUtc:'',paragraphIndex:0,from:4,to:8,state:'pending',groupId:null}],undo:[],redo:[]});
 const returned=[envelope.parseObservablePayload(single.content).doc,changedB,docs[2]],afterState=JSON.parse(single.afterText);
 const bytes=build(makeSource({projectId,projectRoot:root,nonTextReturnState:afterState,scenes:ids.map((id,i)=>({sceneId:id,scenePath:path.join(root,id),order:i,text:envelope.deriveVisibleTextFromDocument(returned[i]),doc:returned[i]}))}));
 const bridge=await import('../../src/io/revisionBridge/index.mjs'),parsed=bridge.buildDocxReviewTransportAnalysisFromZipBytes({bytes},{cryptoPort:{sha256Text:sha,sha256Json:v=>'sha256:'+sha(stable(v)),byteLength:v=>Buffer.byteLength(v)}});assert.equal(parsed.ok,true);
 const capsule=initial.localAuthorityCapsule,documents=bridge.buildDocxPendingCommentReturnDocumentsFromZipBytes({bytes,exportMap:capsule.exportMap,baselineDocuments:ids.map((id,i)=>({sceneId:id,document:docs[i]})),retainPendingScenes:true,documentSections:capsule.documentSections,signedSectionsDigest:capsule.documentSections.protectedDigest});assert.equal(documents.ok,true,JSON.stringify(documents));
 const exportMap=structuredClone(capsule.exportMap);delete exportMap.commentExport;
 const proof={schemaVersion:3,projectId,roundId:'book-round',artifactSha256:'sha256:'+sha(bytes),baseline:capsule.commentExport,exportMap,returnedScenes:documents.scenes.map(item=>({sceneId:item.sceneId,ledger:review.readLedger(item.returnedDocument)})),returnedThreads:parsed.reviewIr.commentThreads,returnedParagraphs:parsed.reviewIr.formattingParagraphs.map(({paragraphIndex,paragraphText,trackedRevision})=>({paragraphIndex,paragraphText,trackedRevision})),commentReturnInventory:parsed.reviewIr.commentReturnInventory};
 const manifest=JSON.stringify({projectId,revision:1});fs.mkdirSync(path.join(root,'roman'));fs.mkdirSync(path.join(root,'.yalken/word-review'),{recursive:true});fs.writeFileSync(manifestPath,manifest);
 ids.forEach((id,i)=>fs.writeFileSync(path.join(root,id),raws[i]));const commentPath=path.join(root,'.yalken/word-review/non-text-return-state.v1.json');fs.writeFileSync(commentPath,f.beforeText);
 const model=await import('../../src/core/project-tree-cohort-v1.mjs');
 const input={operation:'word-mixed-return',operationId:'book-op',projectId,manifestPath,beforeManifestText:manifest,expectedTreeRevision:0,scenes:ids.map((id,i)=>({sceneId:id,beforeContent:raws[i],commitText:null})),notesText:null,commentsText:f.beforeText,returnProofJson:JSON.stringify(proof)};
 const planned=model.planProjectMixedWordReturnCohort(input),request={manifestPath,revision:1,treeCohort:planned};
 fs.writeFileSync(path.join(root,'request.json'),JSON.stringify(request));
 const tracked=[...ids.map(id=>path.join(root,id)),commentPath,manifestPath],observe=()=>tracked.map(file=>fs.readFileSync(file,'utf8'));
 return {root,input,model,manifestPath,ids,request,observe,before:observe(),after:[...ids.map(id=>Buffer.from(planned.entries.find(entry=>entry.relativePath===id).afterBase64,'base64').toString()),Buffer.from(planned.entries.find(entry=>entry.role==='comments').afterBase64,'base64').toString(),manifest]};
}
test('book cohort admission regenerates all owners, rejects forged output, and forbids structural Undo',async t=>{
 const f=await bookDiskFixture(t),forged=structuredClone(f.request);forged.treeCohort.entries[0].afterBase64=Buffer.from('forged').toString('base64');
 await assert.rejects(tx.commitProjectTransaction({...forged,publishManifest,revalidate:async()=>{}}),/PLAN_MISMATCH/);assert.deepEqual(f.observe(),f.before);
 const oversized=structuredClone(f.input);oversized.scenes[0].beforeContent='x'.repeat(32*1024*1024);assert.throws(()=>f.model.planProjectMixedWordReturnCohort(oversized),/E_TREE_COHORT_BUDGET/);assert.deepEqual(f.observe(),f.before);
 const receipt=await tx.commitProjectTransaction({...f.request,publishManifest,revalidate:async()=>{}});assert.equal(receipt.success,true);assert.deepEqual(f.observe(),f.after);
 const verified=await tx.readVerifiedProjectTreeMutation({manifestPath:f.manifestPath,projectId});assert.equal(verified.lastMutation.canUndo,false);assert.equal(verified.lastMutation.unavailableReason,'EDITORIAL_SCENE_HISTORY_ONLY');
 assert.throws(()=>f.model.planProjectTreeUndo({projectId,operationId:'forged-undo',expectedTreeRevision:1,lastMutation:receipt.transactionId,receipt:verified.receipt,retainedPacket:verified.retainedPacket}),/E_TREE_UNDO_UNAVAILABLE/);
 for(const id of f.ids)assert.equal((await tx.readVerifiedProjectTransaction({scenePath:path.join(f.root,id),manifestPath:f.manifestPath})).schemaVersion,'yalken.project-transaction.commit.v7');
});

const BOOK_CHILD=String.raw`
const fs=require('node:fs'),fsp=require('node:fs/promises'),path=require('node:path');
const tx=require(process.argv[1]),{durableSaveTransaction}=require(process.argv[2]),root=process.argv[3],mode=process.argv[4],boundary=process.argv[5];
const q=JSON.parse(fs.readFileSync(path.join(root,'request.json'))),scenes=q.treeCohort.input.scenes;
const points=new Map([[tx.journalPathFor(q.manifestPath),'JOURNAL'],[tx.treeCommitPathFor(q.manifestPath),'TREE_COMMIT'],[path.join(root,'.yalken/word-review/non-text-return-state.v1.json'),'COMMENTS']]);
scenes.forEach((scene,index)=>{const p=path.join(root,scene.sceneId);points.set(p,'SCENE_'+index);points.set(tx.commitPathFor(p),'RECEIPT_'+index);});
const hit=p=>{if(boundary===p){process.stdout.write('HIT:'+p+'\n');process.kill(process.pid,'SIGKILL');}};
const adapter={...fsp,rename:async(a,b)=>{await fsp.rename(a,b);hit(points.get(b));},unlink:async p=>{if(p===tx.journalPathFor(q.manifestPath))hit('BEFORE_CLEANUP');await fsp.unlink(p);if(p===tx.journalPathFor(q.manifestPath))hit('AFTER_CLEANUP');}};
const publishManifest=async({manifestPath,expectedText,nextText,revision})=>{if(fs.readFileSync(manifestPath,'utf8')!==expectedText)throw Error('CAS');await durableSaveTransaction({filePath:manifestPath,content:nextText,revision,fsAdapter:adapter});};
(mode==='recover'?tx.recoverProjectTransaction({manifestPath:q.manifestPath,treeCohort:q.treeCohort,publishManifest,fsAdapter:adapter,revalidate:async()=>{}}):tx.commitProjectTransaction({...q,publishManifest,fsAdapter:adapter,revalidate:async()=>{}})).then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(e.code||e.message);process.exitCode=1;});
`;
const bookChild=(f,mode,boundary='')=>new Promise((resolve,reject)=>{
 const c=spawn(process.execPath,['-e',BOOK_CHILD,require.resolve('../../src/core/project-transaction-v1.cjs'),require.resolve('../../src/core/save-coordinator-v1.cjs'),f.root,mode,boundary],{stdio:['ignore','pipe','pipe']});let stdout='',stderr='';
 const timer=setTimeout(()=>{c.kill('SIGKILL');reject(Error('owned book process timeout'));},15000);
 c.stdout.on('data',v=>stdout+=v);c.stderr.on('data',v=>stderr+=v);c.on('error',reject);c.on('close',(code,signal)=>{clearTimeout(timer);resolve({code,signal,stdout,stderr});});
});
for(const boundary of ['JOURNAL','SCENE_0','RECEIPT_0','SCENE_1','RECEIPT_1','RECEIPT_2','COMMENTS','TREE_COMMIT','BEFORE_CLEANUP','AFTER_CLEANUP'])test('book atomic SIGKILL '+boundary+' recovers all owners and discussions in a fresh process',async t=>{
 const f=await bookDiskFixture(t),crash=await bookChild(f,'commit',boundary);assert.equal(crash.signal,'SIGKILL',JSON.stringify(crash));assert.match(crash.stdout,new RegExp('HIT:'+boundary));
 const journal=tx.journalPathFor(f.manifestPath);if(fs.existsSync(journal))assert.ok(fs.statSync(journal).size<=32*1024*1024);
 const committed=['TREE_COMMIT','BEFORE_CLEANUP','AFTER_CLEANUP'].includes(boundary),expected=committed?f.after:f.before;
 const recovered=await bookChild(f,'recover');assert.equal(recovered.code,0,recovered.stderr);assert.deepEqual(f.observe(),expected);
 const snapshot=()=>f.ids.map(id=>{const p=tx.commitPathFor(path.join(f.root,id));return fs.existsSync(p)?fs.readFileSync(p,'utf8'):null;});
 const receiptBytes=snapshot();if(committed)for(const id of f.ids)assert.equal((await tx.readVerifiedProjectTransaction({scenePath:path.join(f.root,id),manifestPath:f.manifestPath})).schemaVersion,'yalken.project-transaction.commit.v7');else assert.deepEqual(receiptBytes,[null,null,null]);
 const again=await bookChild(f,'recover');assert.equal(again.code,0,again.stderr);assert.deepEqual(f.observe(),expected);assert.deepEqual(snapshot(),receiptBytes);
 if(!committed){const result=await bookChild(f,'commit');assert.equal(result.code,0,result.stderr);assert.deepEqual(f.observe(),f.after);}
});
test('book recovery interrupted during rollback resumes exactly and preserves foreign bytes on conflict',async t=>{
 // Comments sort before scene entries. Crash after the second scene receipt
 // so rollback really has a first-scene durable write to interrupt.
 const f=await bookDiskFixture(t);assert.equal((await bookChild(f,'commit','RECEIPT_1')).signal,'SIGKILL');
 const interrupted=await bookChild(f,'recover','SCENE_0');assert.equal(interrupted.signal,'SIGKILL',JSON.stringify(interrupted));assert.match(interrupted.stdout,/HIT:SCENE_0/);
 const result=await bookChild(f,'recover');assert.equal(result.code,0,result.stderr);assert.deepEqual(f.observe(),f.before);
 assert.equal((await bookChild(f,'commit','SCENE_1')).signal,'SIGKILL');const other=path.join(f.root,f.ids[1]);fs.writeFileSync(other,'independent foreign update');const before=f.observe();
 const conflict=await bookChild(f,'recover');assert.equal(conflict.code,1);assert.match(conflict.stderr,/UNKNOWN_BYTES|RECOVERY_CONFLICT/);assert.deepEqual(f.observe(),before);assert.ok(fs.existsSync(tx.journalPathFor(f.manifestPath)));
});

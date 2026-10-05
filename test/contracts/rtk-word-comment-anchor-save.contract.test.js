'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const vm = require('node:vm');
const tx = require('../../src/core/project-transaction-v1.cjs');
const { durableSaveTransaction } = require('../../src/core/save-coordinator-v1.cjs');
const envelope = require('../../src/core/document-content-envelope-v1.cjs');
const { planCommentAuthoring } = require('../../src/core/word-comment-authoring-v1.cjs');
const { planCommentAnchorSave } = require('../../src/core/word-comment-anchor-save-v1.cjs');
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const sceneId = 'roman/s.txt', projectId = 'anchor-project';
const content = text => envelope.composeObservablePayload({doc: {type:'doc', content:[{type:'paragraph',content:[{type:'text',text}]}]}});
function graph(text='Left anchor right',start=5,quote='anchor') {
  return planCommentAuthoring({beforeText:null,projectId,sceneId,sceneSha256:sha(content(text)),paragraphs:[text],now:'2026-09-27T00:00:00Z',input:{requestId:'root-1',action:'create',projectId,sceneId,subjectId:'test-scene',expectedStateSha256:'',expectedSceneSha256:sha(content(text)),body:'Keep this body exactly',anchor:{paragraphIndex:0,startUtf16:start,selectedText:quote}}}).afterText;
}
function plan(old,next,beforeText=graph(old)) {return planCommentAnchorSave({beforeText,projectId,sceneId,beforeContent:content(old),afterContent:content(next)});}

test('comment save: safe prefix/suffix edits retain immutable graph, identity and grapheme range',()=>{
  const before=graph(), old=JSON.parse(before);
  for(const [text,offset] of [['PREFIX Left anchor right',12],['Left anchor right suffix',5],['L anchor right',2]]) {
    const delta=plan('Left anchor right',text,before),after=JSON.parse(delta.afterText);
    assert.equal(after.threads[0].anchor.startUtf16,offset);
    assert.equal(after.threads[0].anchor.blockTextSha256,sha(text));
    assert.deepEqual(after.threads[0].messages,old.threads[0].messages);
    assert.deepEqual(after.events,old.events);
    const restored=structuredClone(after);restored.revision=old.revision;restored.threads[0].anchor=old.threads[0].anchor;
    assert.deepEqual(restored,old);
  }
  const unicode='a 👩🏽‍💻 e\u0301 z',g=graph(unicode,2,'👩🏽‍💻');
  assert.equal(JSON.parse(plan(unicode,'XX '+unicode,g).afterText).threads[0].anchor.startUtf16,5);
  assert.equal(plan('Left anchor right','Left anchor right',before),null);
});

test('comment save: repeated insertion/deletion and changed anchor reject rather than choose matching text',()=>{
  for(const [old,next,start] of [['aaaa','aaaaa',1],['aaaa','aaa',0],['aaaa','aaa',3]]) {
    assert.throws(()=>plan(old,next,graph(old,start,'a')),/COMMENT_SAVE_RANGE_CONFLICT/);
  }
  assert.throws(()=>plan('Left anchor right','Left changed right'),/COMMENT_SAVE_RANGE_CONFLICT/);
  const state=JSON.parse(graph());state.threads[0].anchor.blockTextSha256=sha('wrong');
  assert.throws(()=>plan('Left anchor right','prefix Left anchor right',JSON.stringify(state)),/COMMENT_SAVE_ANCHOR_STALE/);
  const multi=envelope.composeObservablePayload({doc:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Left anchor'}]},{type:'paragraph',content:[{type:'text',text:' right'}]}]}});
  const split = planCommentAnchorSave({beforeText:graph(),projectId,sceneId,beforeContent:content('Left anchor right'),afterContent:multi});
  assert.equal(JSON.parse(split.afterText).threads[0].anchor.blockTextSha256,sha('Left anchor'));
});

function fixture(t) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'word-comment-save-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const scenePath=path.join(root,sceneId),manifestPath=path.join(root,'project.json'),commentPath=path.join(root,'.yalken/word-review/non-text-return-state.v1.json');
  fs.mkdirSync(path.dirname(scenePath),{recursive:true});fs.mkdirSync(path.dirname(commentPath),{recursive:true});
  const beforeScene=content('Left anchor right'),afterScene=content('PREFIX Left anchor right'),beforeManifest=JSON.stringify({projectId,revision:1}),afterManifest=JSON.stringify({projectId,revision:2}),beforeText=graph();
  fs.writeFileSync(scenePath,beforeScene);fs.writeFileSync(manifestPath,beforeManifest);fs.writeFileSync(commentPath,beforeText);
  const commentState=planCommentAnchorSave({beforeText,projectId,sceneId,beforeContent:beforeScene,afterContent:afterScene});
  const request={scenePath,manifestPath,expectedSceneContent:beforeScene,sceneContent:afterScene,expectedManifestContent:beforeManifest,manifestContent:afterManifest,revision:2,commentState};
  fs.writeFileSync(path.join(root,'request.json'),JSON.stringify(request));
  return {root,scenePath,manifestPath,commentPath,request,beforeScene,afterScene,beforeManifest,afterManifest,beforeText};
}
const publishManifest=async({manifestPath,expectedText,nextText,revision})=>{
  assert.equal(fs.readFileSync(manifestPath,'utf8'),expectedText);
  await durableSaveTransaction({filePath:manifestPath,content:nextText,revision});
};
function observed(f){return [f.scenePath,f.manifestPath,f.commentPath].map(p=>fs.readFileSync(p,'utf8'));}
const CHILD=String.raw`
const fs=require('node:fs'),fsp=require('node:fs/promises'),path=require('node:path');
const tx=require(process.argv[1]),{durableSaveTransaction}=require(process.argv[2]);
const root=process.argv[3],mode=process.argv[4],boundary=process.argv[5],q=JSON.parse(fs.readFileSync(path.join(root,'request.json')));
const commentPath=path.join(root,'.yalken/word-review/non-text-return-state.v1.json');
const points=new Map([[tx.journalPathFor(q.manifestPath),'JOURNAL'],[q.manifestPath,'MANIFEST'],[q.scenePath,'SCENE'],[commentPath,'COMMENT'],[tx.commitPathFor(q.scenePath),'COMMIT']]);
const kill=()=>process.kill(process.pid,'SIGKILL');
const adapter={...fsp,rename:async(a,b)=>{const r=await fsp.rename(a,b);if(mode==='crash'&&points.get(b)===boundary)kill();return r;},unlink:async(p)=>{if(mode==='crash'&&p===tx.journalPathFor(q.manifestPath)&&boundary==='BEFORE_CLEANUP')kill();const r=await fsp.unlink(p);if(mode==='crash'&&p===tx.journalPathFor(q.manifestPath)&&boundary==='AFTER_CLEANUP')kill();return r;}};
const publishManifest=async({manifestPath,expectedText,nextText,revision})=>{if(fs.readFileSync(manifestPath,'utf8')!==expectedText)throw Error('CAS');await durableSaveTransaction({filePath:manifestPath,content:nextText,revision,fsAdapter:adapter});};
(mode==='recover'?tx.recoverProjectTransaction({scenePath:q.scenePath,manifestPath:q.manifestPath,publishManifest,fsAdapter:adapter}):tx.commitProjectTransaction({...q,publishManifest,fsAdapter:adapter})).then(r=>{console.log(JSON.stringify(r));process.exit(0);}).catch(e=>{console.error(e.code||e.message);process.exit(1);});
`;
function child(f,mode,boundary=''){return new Promise((resolve,reject)=>{
 const c=spawn(process.execPath,['-e',CHILD,require.resolve('../../src/core/project-transaction-v1.cjs'),require.resolve('../../src/core/save-coordinator-v1.cjs'),f.root,mode,boundary],{stdio:['ignore','pipe','pipe']});let stdout='',stderr='';
 const timer=setTimeout(()=>{c.kill('SIGKILL');reject(Error('owned child timeout'));},15000);c.stdout.on('data',b=>stdout+=b);c.stderr.on('data',b=>stderr+=b);c.on('error',reject);c.on('close',(code,signal)=>{clearTimeout(timer);resolve({code,signal,stdout,stderr});});
});}
for(const boundary of ['JOURNAL','MANIFEST','SCENE','COMMENT','COMMIT','BEFORE_CLEANUP','AFTER_CLEANUP'])test(`comment save: SIGKILL ${boundary} and new-process recovery keep all three files coherent`,async t=>{
 const f=fixture(t),crash=await child(f,'crash',boundary);assert.equal(crash.signal,'SIGKILL',JSON.stringify(crash));
 const recovered=await child(f,'recover');assert.equal(recovered.code,0,recovered.stderr);
 const committed=['COMMIT','BEFORE_CLEANUP','AFTER_CLEANUP'].includes(boundary);
 assert.deepEqual(observed(f),committed?[f.afterScene,f.afterManifest,f.request.commentState.afterText]:[f.beforeScene,f.beforeManifest,f.beforeText]);
 assert.equal(fs.existsSync(tx.journalPathFor(f.manifestPath)),false);
 assert.equal((await child(f,'recover')).code,0);
 if(!committed)assert.equal((await child(f,'commit')).code,0);
 assert.deepEqual(observed(f),[f.afterScene,f.afterManifest,f.request.commentState.afterText]);
});

test('comment save: forged companion body, foreign project and CAS reject before publication',async t=>{
 const f=fixture(t),before=observed(f);
 for(const mutate of [s=>s.threads[0].messages[0].body='forged',s=>s.projectId='foreign',s=>s.threads[0].threadId='foreign']){
  const after=JSON.parse(f.request.commentState.afterText);mutate(after);
  await assert.rejects(tx.commitProjectTransaction({...f.request,commentState:{...f.request.commentState,afterText:JSON.stringify(after,null,2)+'\n'},publishManifest}),/COMMENT_STATE/);
  assert.deepEqual(observed(f),before);assert.equal(fs.existsSync(tx.journalPathFor(f.manifestPath)),false);
 }
 fs.writeFileSync(f.commentPath,f.beforeText+' ');
 await assert.rejects(tx.commitProjectTransaction({...f.request,publishManifest}),/COMMENT_CAS/);
 assert.deepEqual(observed(f),[f.beforeScene,f.beforeManifest,f.beforeText+' ']);
});

test('comment save: hostile pending journal rejects before any recovery write',async t=>{
 const f=fixture(t);assert.equal((await child(f,'crash','SCENE')).signal,'SIGKILL');
 const journalPath=tx.journalPathFor(f.manifestPath),j=JSON.parse(fs.readFileSync(journalPath));
 const altered=JSON.parse(j.commentState.afterText);altered.threads[0].messages[0].body='attacker';j.commentState.afterText=JSON.stringify(altered,null,2)+'\n';fs.writeFileSync(journalPath,JSON.stringify(j));
 const before=observed(f),r=await child(f,'recover');assert.equal(r.code,1);assert.match(r.stderr,/COMMENT_STATE/);assert.deepEqual(observed(f),before);assert.equal(fs.existsSync(journalPath),true);
});

const mainSource=fs.readFileSync(path.resolve(__dirname,'../../src/main.js'),'utf8');
const extract=name=>mainSource.match(new RegExp('(?:async )?function '+name+'\\([^]*?\\n}'))[0];
async function mainHarness(t,options={}) {
 const f=fixture(t);
 const {createMainProjectManifestAuthority}=await import('../../src/product/mainProjectManifestAuthority.mjs');
 const real=createMainProjectManifestAuthority({anchorRoot:path.join(f.root,'leases'),useLeaseHeartbeatWorker:false});
 let leases=0,active=false,publications=0;
 const authority={...real,withProjectLease:async(id,operation)=>{
  leases++;return real.withProjectLease(id,async lease=>{
   if(options.staleLease)await real.leaseManager.release(lease);
   active=true;try{return await operation(lease);}finally{active=false;}
  });
 },commitManifestText:async args=>{
  if(!options.review){assert.equal(active,true);assert.ok(args.lease,'same lease passed to manifest authority');}
  publications++;return real.commitManifestText(args);
 }};
 const gateway=require('../../src/core/legacy-strangler-v1.cjs');
 const sandbox={require:require('node:module').createRequire(require.resolve('../../src/main.js')),computeHash:sha,currentLifecycleSubjectId:()=> 'scene-subject',commentSceneParagraphs:require('../../src/core/word-comment-anchor-save-v1.cjs').paragraphs,commentAuthoringSessionId:"main-session-1",fs:fsp,path,Buffer,...gateway,SAVE_AUTHORITY_OBSERVER_IDS:gateway.OBSERVER_IDS,
  loadDocumentContentEnvelopeModule:()=>import('../../src/renderer/documentContentEnvelope.mjs'),
  pendingTextRevisions:require('../../src/core/word-pending-text-revisions-v1.cjs'),
  commitProjectTransaction:tx.commitProjectTransaction,recoverProjectTransaction:tx.recoverProjectTransaction,
  durableSaveTransaction,planCommentAnchorSave,
  manuscriptNoteModel:require('../../src/core/word-manuscript-notes-v1.cjs'),
  loadNotesStorageModule:()=>import('../../src/product/notesStoragePersistence.mjs'),
  prepareBookProfileManifestForFile:async()=>({manifestPath:f.manifestPath,projectId,expectedText:fs.readFileSync(f.manifestPath,'utf8'),nextText:f.afterManifest}),
  getMainProjectManifestAuthority:async()=>authority,
  getDocumentContextFromPath:()=>({kind:'scene'}),getProjectRelativeFilePath:p=>path.relative(f.root,p),
  loadProRoundtripPreservationModule:async()=>({applyFreeEditProDataInvalidation:manifest=>({ok:true,manifest})}),
  isPlainObjectValue:v=>!!v&&typeof v==='object'&&!Array.isArray(v),
  loadRtkNonTextReturnModule:async()=>({readCommentAuthoringState:async()=>{assert.equal(active,true);if(options.review)throw Error('double rebase');return{text:fs.readFileSync(f.commentPath,'utf8')};}}),
  captureDocxImportPreviewContext:()=>JSON.stringify([f.root,sandbox.commentAuthoringSessionId,sandbox.currentLifecycleSubjectId()]),
  getProjectRootPath:()=>f.root,isPathInside:(root,p)=>p.startsWith(root+path.sep),
  getProjectManifestPath:()=>f.manifestPath,currentProjectName:'test',DEFAULT_PROJECT_NAME:'test',normalizeStableProjectId:s=>s,
 };
 vm.createContext(sandbox);vm.runInContext(['commitWriterProjectSnapshot','recoverWriterProjectTransactionForFile','writerSaveFailureStatus'].map(extract).join('\n'),sandbox);
 return{...f,sandbox,save:(text=f.afterScene,opts={})=>sandbox.commitWriterProjectSnapshot(f.scenePath,text,2,{},'test',opts),counts:()=>({leases,publications})};
}
test('actual main Save atomically rebases under one real project lease; recovery shares that lease',async t=>{
 const f=await mainHarness(t),result=await f.save();assert.equal(result.success,true,JSON.stringify(result));
 assert.deepEqual(observed(f),[f.afterScene,JSON.stringify(JSON.parse(f.afterManifest),null,2),f.request.commentState.afterText]);
 assert.deepEqual(f.counts(),{leases:1,publications:1});
 await f.sandbox.recoverWriterProjectTransactionForFile(f.scenePath);
 assert.equal(f.counts().leases,2);
});
test('actual main unchanged Save binds canonical comments without changing their revision or bytes',async t=>{
 const f=await mainHarness(t),before=fs.readFileSync(f.commentPath,'utf8');
 const result=await f.save(f.beforeScene);assert.equal(result.success,true,JSON.stringify(result));
 assert.equal(fs.readFileSync(f.commentPath,'utf8'),before);
 const record=JSON.parse(fs.readFileSync(tx.commitPathFor(f.scenePath),'utf8'));
 assert.equal(record.commentState.beforeDigest,sha(before));assert.equal(record.commentState.afterDigest,sha(before));
 assert.deepEqual(f.counts(),{leases:1,publications:1});
});
test('unchanged anchor ownership is opt-in, validates active anchors and retains deleted state exactly',()=>{
 const beforeText=graph(),args={beforeText,projectId,sceneId,beforeContent:content('Left anchor right'),afterContent:content('Left anchor right')};
 assert.equal(planCommentAnchorSave(args),null);
 assert.deepEqual(planCommentAnchorSave({...args,includeUnchanged:true}),{mode:require('../../src/core/word-comment-anchor-save-v1.cjs').MODE,beforeText,afterText:beforeText});
 assert.throws(()=>planCommentAnchorSave({...args,includeUnchanged:true,projectId:'foreign'}));
 assert.throws(()=>planCommentAnchorSave({...args,includeUnchanged:true,beforeContent:content('wrong')}),/ANCHOR_STALE/);
 const deleted=JSON.parse(beforeText);deleted.threads[0].status='deleted';const text=JSON.stringify(deleted);
 assert.equal(planCommentAnchorSave({...args,beforeText:text}),null);
 assert.equal(planCommentAnchorSave({...args,beforeText:text,includeUnchanged:true}).afterText,text);
});
test('actual main Save rejects ambiguous anchor before writing, with actionable status and unchanged graph',async t=>{
 const f=await mainHarness(t),before=observed(f),r=await f.save(content('Left changed right'));
 assert.equal(r.success,false);assert.equal(r.code,'COMMENT_SAVE_RANGE_CONFLICT');assert.deepEqual(observed(f),before);
 assert.equal(f.counts().publications,0);assert.match(f.sandbox.writerSaveFailureStatus(r),/Отмените.*скопируйте/);
});
test('actual main Save refuses stale lease before scene, comment or manifest publication',async t=>{
 const f=await mainHarness(t,{staleLease:true}),before=observed(f),r=await f.save();assert.equal(r.success,false);assert.match(r.code,/PROJECT_LEASE/);assert.deepEqual(observed(f),before);assert.equal(f.counts().publications,0);
});
test('authenticated review retains existing journal ownership instead of applying an ordinary-save anchor delta twice',async t=>{
 const f=await mainHarness(t,{review:true}),r=await f.save(f.afterScene,{commentRebaseOwner:'EXACT_REVIEW_JOURNAL'});
 assert.equal(r.success,true,JSON.stringify(r));assert.equal(fs.readFileSync(f.commentPath,'utf8'),f.beforeText);assert.equal(f.counts().leases,0);
});
for(const kind of ['symlink','hardlink'])test('canonical comment '+kind+' rejects without touching scene or manifest',async t=>{
 const f=fixture(t),original=path.join(f.root,'protected.json');fs.renameSync(f.commentPath,original);
 if(kind==='symlink')fs.symlinkSync(original,f.commentPath);else fs.linkSync(original,f.commentPath);
 await assert.rejects(tx.commitProjectTransaction({...f.request,publishManifest}));
 assert.deepEqual(observed(f),[f.beforeScene,f.beforeManifest,f.beforeText]);assert.equal(fs.readFileSync(original,'utf8'),f.beforeText);
});

test('v4 corrupt commit repair requires exact packet authority and restores the three-file transaction',async t=>{
 const f=fixture(t);fs.writeFileSync(tx.commitPathFor(f.scenePath),'{torn');let failure;
 try{await tx.commitProjectTransaction({...f.request,publishManifest});}catch(e){failure=e;}
 assert.equal(failure?.code,'E_PROJECT_COMMIT_CORRUPT');
 const request={scenePath:f.scenePath,manifestPath:f.manifestPath,publishManifest,decision:'REPAIR_TO_AFTER',authorityProof:{proofId:'independent-test'},recoveryTransactionId:failure.recovery.transactionId,recoveryPacketDigest:failure.recovery.packetDigest};
 await assert.rejects(tx.repairCorruptProjectCommit({...request,verifyAuthorityProof:()=>false}));
 assert.deepEqual(observed(f),[f.beforeScene,f.beforeManifest,f.beforeText]);
 const result=await tx.repairCorruptProjectCommit({...request,verifyAuthorityProof:q=>q.transactionId===request.recoveryTransactionId&&q.packetDigest===request.recoveryPacketDigest&&q.decision==='REPAIR_TO_AFTER'});
 assert.equal(result.outcome,'COMMITTED_CONVERGED');assert.deepEqual(observed(f),[f.afterScene,f.afterManifest,f.request.commentState.afterText]);
 assert.equal(JSON.parse(fs.readFileSync(tx.commitPathFor(f.scenePath))).schemaVersion,'yalken.project-transaction.commit.v4');
});

test('v4 synthetic repair refuses a resource-bearing packet even with fresh outer hash',async t=>{
 const f=fixture(t);fs.writeFileSync(tx.commitPathFor(f.scenePath),'{torn');let failure;
 try{await tx.commitProjectTransaction({...f.request,publishManifest});}catch(e){failure=e;}
 const p=tx.recoveryPacketPathFor(f.manifestPath,failure.recovery.transactionId),packet=JSON.parse(fs.readFileSync(p));
 packet.companionResources=[{path:path.join(f.root,'assets/injected.bin'),contentBase64:Buffer.from('forbidden').toString('base64')}];
 const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
 const bytes=JSON.stringify(canonical(packet))+'\n';fs.writeFileSync(p,bytes);
 await assert.rejects(tx.repairCorruptProjectCommit({scenePath:f.scenePath,manifestPath:f.manifestPath,publishManifest,decision:'REPAIR_TO_AFTER',authorityProof:{proofId:'not-authority-to-add-resources'},recoveryTransactionId:failure.recovery.transactionId,recoveryPacketDigest:sha(bytes),verifyAuthorityProof:()=>true}),/COMMENT_STATE/);
 assert.deepEqual(observed(f),[f.beforeScene,f.beforeManifest,f.beforeText]);assert.equal(fs.existsSync(path.join(f.root,'assets/injected.bin')),false);
});

test('other-scene threads and deleted ranges remain byte-equivalent across an ordinary edit',()=>{
 const original=JSON.parse(graph());original.threads.push({...structuredClone(original.threads[0]),threadId:'other-scene',sceneId:'roman/other.txt',anchor:{...original.threads[0].anchor,sceneId:'roman/other.txt'}});
 original.threads.push({...structuredClone(original.threads[0]),threadId:'deleted',status:'deleted'});
 const after=JSON.parse(plan('Left anchor right','NEW Left anchor right',JSON.stringify(original)).afterText);
 assert.deepEqual(after.threads.slice(1),original.threads.slice(1));
});

test('manual Save warning is dismiss-only, coalesced, reset after dismissal and never publishes',async()=>{
 let close,calls=0;const displays=[];
 const sandbox={mainWindow:{isDestroyed:()=>false},dialog:{showMessageBox:(_win,options)=>{calls++;displays.push(options);return new Promise(resolve=>close=resolve);}}};
 vm.createContext(sandbox);vm.runInContext('let commentSaveWarningPromise=null;\n'+extract('showCommentSaveFailure'),sandbox);
 await sandbox.showCommentSaveFailure({code:'E_OTHER'});assert.equal(calls,0);
 const first=sandbox.showCommentSaveFailure({code:'COMMENT_SAVE_RANGE_CONFLICT'}),second=sandbox.showCommentSaveFailure({code:'COMMENT_SAVE_RANGE_CONFLICT'});
 assert.equal(calls,1);assert.deepEqual(Array.from(displays[0].buttons),['Вернуться к тексту']);assert.equal(displays[0].cancelId,0);assert.match(displays[0].detail,/Текст остаётся в редакторе/);
 close({response:0});await Promise.all([first,second]);const third=sandbox.showCommentSaveFailure({code:'COMMENT_STATE_INVALID'});assert.equal(calls,2);close({response:0});await third;
 sandbox.mainWindow.isDestroyed=()=>true;await sandbox.showCommentSaveFailure({code:'COMMENT_SAVE_RANGE_CONFLICT'});assert.equal(calls,2);
 const autosave=mainSource.slice(mainSource.indexOf('async function autoSave'),mainSource.indexOf('async function handleSave'));
 assert.equal(autosave.includes('showCommentSaveFailure'),false);
});

const blocks = (texts, types=[]) => envelope.composeObservablePayload({doc:{type:'doc',content:texts.map((text,i)=>({type:types[i]||'paragraph',content:text?[{type:'text',text}]:[]}))}});
function structural(beforeText,oldTexts,newTexts,types=[]) {
 return planCommentAnchorSave({beforeText,projectId,sceneId,beforeContent:blocks(oldTexts),afterContent:blocks(newTexts,types)});
}
test('paragraph boundary split and inverse merge preserve exact thread identity, bodies and provenance',()=>{
 const old='Left anchor right',before=graph();
 for(const pos of [0,1,5,11,12,old.length]) {
  const texts=[old.slice(0,pos),old.slice(pos)],split=structural(before,[old],texts),splitText=split?.afterText||before,state=JSON.parse(splitText);
  const a=state.threads[0].anchor, index=pos<=5?1:0;
  assert.equal(a.sceneParagraphIndex,index);assert.equal(a.paragraphIndex,index);
  assert.equal(a.startUtf16,index?5-pos:5);assert.equal(a.blockTextSha256,sha(texts[index]));
  const joined=JSON.parse(structural(splitText,texts,[old])?.afterText||splitText);
  joined.revision=JSON.parse(before).revision;assert.deepEqual(joined,JSON.parse(before));
 }
 for(const pos of [6,8,10]) assert.throws(()=>structural(before,[old],[old.slice(0,pos),old.slice(pos)]),/COMMENT_SAVE_RANGE_CONFLICT/);
});
test('paragraph rebase moves adjacent anchors independently and retains Unicode grapheme boundaries',()=>{
 const old='Before👩🏽‍💻after',before=JSON.parse(graph(old,0,'Before'));
 const peer=JSON.parse(graph(old,6,'👩🏽‍💻')).threads[0];peer.threadId='peer';before.threads.push(peer);
 const split=structural(JSON.stringify(before),[old],['Before','👩🏽‍💻after']),state=JSON.parse(split.afterText);
 assert.deepEqual(state.threads.map(t=>[t.anchor.sceneParagraphIndex,t.anchor.startUtf16]),[[0,0],[1,0]]);
 assert.deepEqual(state.threads.map(t=>t.messages),before.threads.map(t=>t.messages));
 assert.throws(()=>structural(JSON.stringify(before),[old],['Before👩','🏽‍💻after']),/COMMENT_SAVE_RANGE_CONFLICT/);
});
test('paragraph mapping rejects repeated-boundary ambiguity, split ranges, removed quotes and type changes',()=>{
 const initial=JSON.parse(graph('a',0,'a'));initial.threads[0].anchor.sceneParagraphIndex=1;initial.threads[0].anchor.paragraphIndex=1;
 for(const next of [['a','a','a'],['a']]) assert.throws(()=>structural(JSON.stringify(initial),['a','a'],next),/COMMENT_SAVE_RANGE_CONFLICT/);
 assert.throws(()=>structural(graph(),['Left anchor right'],['Left ',' right']),/COMMENT_SAVE_RANGE_CONFLICT/);
 assert.throws(()=>structural(graph(),['Left anchor right'],['Left ','anchor right'],['paragraph','heading']),/COMMENT_SAVE_RANGE_CONFLICT/);
 const old='Left anchor\nright',before=graph(old,5,'anchor\nright');
 assert.throws(()=>structural(before,[old],['Left anchor','right']),/COMMENT_SAVE_RANGE_CONFLICT/);
});
test('paragraph insertion before an unchanged anchor block updates its index without touching other graph state',()=>{
 const before=graph(),delta=structural(before,['Left anchor right'],['new paragraph','Left anchor right']),after=JSON.parse(delta.afterText);
 assert.equal(after.threads[0].anchor.sceneParagraphIndex,1);assert.equal(after.threads[0].anchor.startUtf16,5);
 after.revision=JSON.parse(before).revision;after.threads[0].anchor=JSON.parse(before).threads[0].anchor;
 assert.deepEqual(after,JSON.parse(before));
});
test('actual main Save split and merge use authenticated three-file transaction; in-range Enter writes nothing',async t=>{
 const f=await mainHarness(t),split=blocks(['Left ','anchor right']);
 assert.equal((await f.save(split)).success,true);
 const state=JSON.parse(fs.readFileSync(f.commentPath));assert.equal(state.threads[0].anchor.sceneParagraphIndex,1);
 await f.sandbox.recoverWriterProjectTransactionForFile(f.scenePath);
 assert.equal((await f.save(f.beforeScene)).success,true);
 const joined=JSON.parse(fs.readFileSync(f.commentPath));joined.revision=JSON.parse(f.beforeText).revision;
 assert.deepEqual(joined,JSON.parse(f.beforeText));
 const before=observed(f),bad=await f.save(blocks(['Left anc','hor right']));
 assert.equal(bad.success,false);assert.equal(bad.code,'COMMENT_SAVE_RANGE_CONFLICT');assert.deepEqual(observed(f),before);
});
for(const boundary of ['SCENE','COMMENT','COMMIT'])test(`paragraph split SIGKILL ${boundary} and new-process recovery preserve exact quote and graph`,async t=>{
 const f=fixture(t);f.afterScene=blocks(['Left ','anchor right']);f.request.sceneContent=f.afterScene;
 f.request.commentState=planCommentAnchorSave({beforeText:f.beforeText,projectId,sceneId,beforeContent:f.beforeScene,afterContent:f.afterScene});
 fs.writeFileSync(path.join(f.root,'request.json'),JSON.stringify(f.request));
 assert.equal((await child(f,'crash',boundary)).signal,'SIGKILL');
 const r=await child(f,'recover');assert.equal(r.code,0,r.stderr);
 assert.deepEqual(observed(f),boundary==='COMMIT'?[f.afterScene,f.afterManifest,f.request.commentState.afterText]:[f.beforeScene,f.beforeManifest,f.beforeText]);
});

const editModel = require('../../src/core/word-comment-edit-intents-v1.cjs');
function intent(old,from,to,insertText,{id='ledger-e1',historyId='ledger-h1',direction='forward'}={}) {
  return {schemaVersion:1,baselineTextSha256:editModel.textDigest([old]),edits:[{id,historyId,direction,paragraphIndex:0,fromUtf16:from,toUtf16:to,removedText:old.slice(from,to),insertText}]};
}
function intentSave(old,next,state,edits,sessionId='main-session-1') {
  return planCommentAnchorSave({beforeText:state,projectId,sceneId,beforeContent:content(old),afterContent:content(next),editIntents:edits,sessionId,includeUnchanged:true});
}
test('actual splices preserve duplicate occurrence, calibrated affinities, interior text and exact Undo after saved deletion',()=>{
  const old='Alpha anchor omega', before=graph(old,0,'Alpha');
  const inserted='AlINSIDEpha anchor omega';
  const first=intentSave(old,inserted,before,intent(old,2,2,'INSIDE'));
  assert.equal(JSON.parse(first.afterText).threads[0].anchor.selectedText,'AlINSIDEpha');
  const undo=intentSave(inserted,old,first.afterText,intent(inserted,2,8,'',{id:'ledger-e2',direction:'undo'}));
  assert.deepEqual(JSON.parse(undo.afterText).threads[0].anchor,JSON.parse(before).threads[0].anchor);
  const deleted=' anchor omega';
  const deletion=intentSave(old,deleted,before,intent(old,0,5,''));
  const dead=JSON.parse(deletion.afterText).threads[0];assert.equal(dead.status,'deleted');
  assert.deepEqual(dead.messages,JSON.parse(before).threads[0].messages);
  const restored=intentSave(deleted,old,deletion.afterText,intent(deleted,0,0,'Alpha',{id:'ledger-e2',direction:'undo'}));
  assert.equal(JSON.parse(restored.afterText).threads[0].status,'open');
  assert.deepEqual(JSON.parse(restored.afterText).threads[0].anchor,JSON.parse(before).threads[0].anchor);
  const redo=intentSave(old,deleted,restored.afterText,intent(old,0,5,'',{id:'ledger-e3',direction:'redo'}));
  assert.equal(JSON.parse(redo.afterText).threads[0].status,'deleted');
  const replaced=intentSave(old,'Beta anchor omega',before,intent(old,0,5,'Beta'));
  assert.equal(JSON.parse(replaced.afterText).threads[0].status,'deleted');
  for(const [at,expectedStart,expectedQuote] of [[0,1,'Alpha'],[5,0,'Alpha'],[2,0,'AlXpha']]) {
    const next=old.slice(0,at)+'X'+old.slice(at);
    const a=JSON.parse(intentSave(old,next,before,intent(old,at,at,'X')).afterText).threads[0].anchor;
    assert.equal(a.startUtf16,expectedStart);assert.equal(a.selectedText,expectedQuote);
  }
  const repeated=graph('aaaa',1,'a');
  assert.equal(JSON.parse(intentSave('aaaa','aaaaa',repeated,intent('aaaa',1,1,'a')).afterText).threads[0].anchor.startUtf16,2);
});
test('intent proof rejects wrong replay, accessor, cycle, stale history/session and does not revive manual deletion',()=>{
  const old='Alpha anchor omega',before=graph(old,0,'Alpha'),next=' anchor omega';
  const deleted=intentSave(old,next,before,intent(old,0,5,''));
  const forged=intent(next,0,0,'Alpha',{id:'ledger-e2',direction:'undo'});
  assert.throws(()=>intentSave(next,'X'+old,deleted.afterText,forged),/COMMENT_EDIT_REPLAY_MISMATCH/);
  const unrelated=JSON.parse(before);unrelated.threads[0].status='deleted';
  const retained=intentSave(old,'X'+old,JSON.stringify(unrelated),intent(old,0,0,'X',{direction:'undo'}));
  assert.equal(JSON.parse(retained.afterText).threads[0].status,'deleted');
  const wrongSession=intentSave(next,old,deleted.afterText,forged,'different-session');
  assert.equal(JSON.parse(wrongSession.afterText).threads[0].status,'deleted');
  let invoked=false;const getter={get schemaVersion(){invoked=true;return 1;}};
  assert.throws(()=>editModel.validateEditIntents(getter),/COMMENT_EDIT_INTENT_INVALID/);assert.equal(invoked,false);
  const cycle={};cycle.self=cycle;assert.throws(()=>editModel.validateEditIntents(cycle),/COMMENT_EDIT_INTENT_INVALID/);
  const invalid=intent(old,0,1,'X');invalid.edits[0].removedText='Z';
  assert.throws(()=>intentSave(old,'X'+old.slice(1),before,invalid),/COMMENT_EDIT_SPLICE_STALE/);
});
test('point Save uses explicit version and right affinity; transaction recomputes splice and rejects forged after graph',async t=>{
  const f=fixture(t),state=JSON.parse(f.beforeText),a=state.threads[0].anchor;
  Object.assign(a,{kind:'point',affinity:'right',selectedText:'',selectedTextSha256:sha('')});state.schemaVersion='yalken.rtk.word.non-text-return-state.v3';
  const beforeText=JSON.stringify(state),old='Left anchor right',next='Left Xanchor right';
  const delta=intentSave(old,next,beforeText,intent(old,5,5,'X'));
  assert.equal(JSON.parse(delta.afterText).threads[0].anchor.startUtf16,6);
  fs.writeFileSync(f.commentPath,beforeText);
  const request={...f.request,sceneContent:content(next),commentState:delta};
  const forged=JSON.parse(delta.afterText);forged.threads[0].messages[0].body='injected';
  await assert.rejects(()=>tx.commitProjectTransaction({...request,commentState:{...delta,afterText:JSON.stringify(forged)},publishManifest}),/E_PROJECT_TRANSACTION_COMMENT_STATE/);
  await tx.commitProjectTransaction({...request,publishManifest});
  assert.equal(fs.readFileSync(f.commentPath,'utf8'),delta.afterText);assert.equal(fs.readFileSync(f.scenePath,'utf8'),content(next));
});
test('actual Main Save admits interior splice and historical Undo after saved whole replacement atomically',async t=>{
  const f=await mainHarness(t),old='Left anchor right',next='Left Beta right';
  const forward=intent(old,5,11,'Beta');
  const saved=await f.save(content(next),{commentEditIntentsJson:JSON.stringify(forward)});
  assert.equal(saved.success,true,JSON.stringify(saved));
  const dead=JSON.parse(fs.readFileSync(f.commentPath,'utf8'));assert.equal(dead.threads[0].status,'deleted');
  const undo=intent(next,5,9,'anchor',{id:'ledger-e2',direction:'undo'});
  const restored=await f.save(content(old),{commentEditIntentsJson:JSON.stringify(undo)});
  assert.equal(restored.success,true,JSON.stringify(restored));
  const state=JSON.parse(fs.readFileSync(f.commentPath,'utf8'));assert.equal(state.threads[0].status,'open');
  assert.deepEqual(state.threads[0].anchor,JSON.parse(f.beforeText).threads[0].anchor);
  assert.deepEqual(state.threads[0].messages,JSON.parse(f.beforeText).threads[0].messages);
  assert.equal(fs.readFileSync(f.scenePath,'utf8'),f.beforeScene);
});
test('many harmless outside-anchor groups never exhaust canonical comment history',()=>{
  let text='Alpha anchor omega',state=graph(text,0,'Alpha');
  for(let n=0;n<80;n++){
    const next=text+'x';state=intentSave(text,next,state,intent(text,text.length,text.length,'x',{id:`e${n}`,historyId:`h${n}`})).afterText;text=next;
  }
  assert.equal(JSON.parse(state).threads[0].anchorEditHistory,undefined);
  assert.equal(JSON.parse(state).threads[0].anchor.selectedText,'Alpha');
});
test('covered point deletion tombstones and exact saved Undo reconstructs point; legacy fallback refuses ambiguous point move',()=>{
  const old='Alpha anchor omega',state=JSON.parse(graph(old,0,'Alpha'));
  Object.assign(state.threads[0].anchor,{kind:'point',affinity:'right',startUtf16:5,selectedText:'',selectedTextSha256:sha('')});state.schemaVersion='yalken.rtk.word.non-text-return-state.v3';
  const raw=JSON.stringify(state),next=' omega';
  const deleted=intentSave(old,next,raw,intent(old,0,12,''));assert.equal(JSON.parse(deleted.afterText).threads[0].status,'deleted');
  const restored=intentSave(next,old,deleted.afterText,intent(next,0,0,'Alpha anchor',{id:'e2',direction:'undo'}));
  assert.deepEqual(JSON.parse(restored.afterText).threads[0].anchor,state.threads[0].anchor);
  assert.throws(()=>plan(old,'AlphaX anchor omega',raw),/COMMENT_SAVE_POINT_INTENT_REQUIRED/);
});
test('actual Main verifies admitted prefix when newer typing overlaps save acknowledgment',async t=>{
  const f=await mainHarness(t),old='Left anchor right',middle='Left anXchor right',next='Left anXYchor right';
  const first=intent(old,7,7,'X');
  const a=await f.save(content(middle),{commentEditIntentsJson:JSON.stringify(first)});assert.equal(a.success,true,JSON.stringify(a));
  assert.equal(a.commentEditIntentsSha256,sha(JSON.stringify(first)));
  const cumulative={...first,edits:[...first.edits,...intent(middle,8,8,'Y',{id:'e2',historyId:'h2'}).edits]};
  const b=await f.save(content(next),{commentEditIntentsJson:JSON.stringify(cumulative)});assert.equal(b.success,true,JSON.stringify(b));
  assert.equal(JSON.parse(readFile(f.commentPath)).threads[0].anchor.selectedText,'anXYchor');
  const forged=structuredClone(cumulative);forged.edits[0].id='different';const before=observed(f);
  const result=await f.save(content(next+'Z'),{commentEditIntentsJson:JSON.stringify(forged)});
  assert.equal(result.success,false);assert.equal(result.code,'COMMENT_EDIT_BASELINE_STALE');assert.deepEqual(observed(f),before);
});
function readFile(file){return fs.readFileSync(file,'utf8');}
test('bounded history is compact, remains valid after many groups and expired destructive Undo fails without revival',()=>{
  let text='Alpha anchor omega',state=graph(text,0,'Alpha');
  for(let n=0;n<40;n++) {
    const next=text.slice(0,2)+'x'+text.slice(2);
    state=intentSave(text,next,state,intent(text,2,2,'x',{id:`e${n}`,historyId:`h${n}`})).afterText;text=next;
  }
  const after=JSON.parse(state);assert.equal(after.threads[0].anchorEditHistory.length,32);
  assert.ok(after.threads[0].anchorEditHistory.every(h=>h.before.length>=5 && !Object.hasOwn(h.before,'anchor')));
  require('../../src/core/word-comment-authoring-v1.cjs').readState(state,projectId);
  assert.throws(()=>intentSave(text,text.slice(0,2)+text.slice(3),state,intent(text,2,3,'',{id:'expired',historyId:'h0',direction:'undo'})),/COMMENT_EDIT_HISTORY_EXPIRED/);
  const corrupt=structuredClone(after);corrupt.threads[0].anchorEditHistory[0].before.foreign=true;
  assert.throws(()=>require('../../src/core/word-comment-authoring-v1.cjs').readState(JSON.stringify(corrupt),projectId),/COMMENT_HISTORY_INVALID/);
});
test('near 64KiB comment graphs either fit compact history exactly or refuse before publication',()=>{
  const make=target=>{
    const state=JSON.parse(graph('Alpha anchor omega',0,'Alpha'));
    for(let i=0;i<3;i++)state.threads[0].messages.push({commentId:'budget-reply-'+i,kind:'reply',body:'r'.repeat(16000),provenance:{}});
    state.threads[0].messages[0].body='';
    const remaining=target-Buffer.byteLength(JSON.stringify(state));assert.ok(remaining>0 && remaining<=16384);
    state.threads[0].messages[0].body='x'.repeat(remaining);
    const raw=JSON.stringify(state);assert.equal(Buffer.byteLength(raw),target);
    require('../../src/core/word-comment-authoring-v1.cjs').readState(raw,projectId);return raw;
  };
  const fits=make(64000),saved=intentSave('Alpha anchor omega','AlXpha anchor omega',fits,intent('Alpha anchor omega',2,2,'X'));
  assert.ok(Buffer.byteLength(saved.afterText)<=65536);assert.equal(JSON.parse(saved.afterText).threads[0].anchor.selectedText,'AlXpha');
  assert.deepEqual(JSON.parse(saved.afterText).threads[0].messages,JSON.parse(fits).threads[0].messages);
  const full=make(65500),unchanged=full;
  assert.throws(()=>intentSave('Alpha anchor omega','AlXpha anchor omega',full,intent('Alpha anchor omega',2,2,'X')),/COMMENT_SAVE_STATE_BUDGET/);
  assert.equal(full,unchanged);
});
test('saved tombstone typing continues same history group and Undo/Redo retain exact deleted quote',()=>{
  const old='Alpha',before=graph(old,0,old);
  const first=intentSave(old,'X',before,intent(old,0,5,'X'));
  const second=intentSave('X','XY',first.afterText,intent('X',1,1,'Y',{id:'e2'}));
  const dead=JSON.parse(second.afterText).threads[0];assert.equal(dead.status,'deleted');assert.equal(dead.anchor.selectedText,'Alpha');assert.equal(dead.anchorEditHistory.length,1);
  assert.equal(dead.anchorEditHistory[0].afterTextSha256,sha('XY'));
  const undone=intentSave('XY',old,second.afterText,intent('XY',0,2,old,{id:'e3',direction:'undo'}));
  assert.equal(JSON.parse(undone.afterText).threads[0].status,'open');assert.deepEqual(JSON.parse(undone.afterText).threads[0].anchor,JSON.parse(before).threads[0].anchor);
  const redone=intentSave(old,'XY',undone.afterText,intent(old,0,5,'XY',{id:'e4',direction:'redo'}));
  assert.equal(JSON.parse(redone.afterText).threads[0].status,'deleted');assert.deepEqual(JSON.parse(redone.afterText).threads[0].anchor,dead.anchor);
  assert.deepEqual(JSON.parse(redone.afterText).threads[0].messages,dead.messages);
  const forged=JSON.parse(first.afterText);forged.threads[0].anchorEditHistory[0].afterTextSha256=sha('forged');forged.threads[0].anchorEditHistory[0].after.blockTextSha256=sha('forged');
  assert.throws(()=>intentSave('X','XY',JSON.stringify(forged),intent('X',1,1,'Y',{id:'e2'})),/COMMENT_EDIT_HISTORY_STALE/);
  const unrelated=intentSave('X','XY',first.afterText,intent('X',1,1,'Y',{id:'e2',historyId:'other'}));
  assert.equal(JSON.parse(unrelated.afterText).threads[0].anchorEditHistory[0].afterTextSha256,sha('X'),'unrelated group must not rewrite original deletion endpoint');
});

test('multi-paragraph fixed topology Save then saved Undo/Redo preserves root/reply and exact covered authority',()=>{
 const {deriveCommentAnchor}=require('../../src/core/word-comment-ranges-v1.cjs');
 const {STATE_V4}=require('../../src/core/word-comment-body-v1.cjs');
 const {readState}=require('../../src/core/word-comment-authoring-v1.cjs');
 const encode=texts=>envelope.composeObservablePayload({doc:{type:'doc',content:texts.map(text=>({type:'paragraph',content:[{type:'text',text}]}))}});
 const initial=['Alpha','Middle','Omega'];
 const anchor=deriveCommentAnchor({sceneId,paragraphs:initial,input:{kind:'multi-paragraph-range',paragraphIndex:0,startUtf16:2,endParagraphIndex:2,endUtf16:2}});
 const original={schemaVersion:STATE_V4,projectId,revision:1,events:[],threads:[{threadId:'multi',rootCommentId:'root',sceneId,status:'open',anchor,messages:[{commentId:'root',kind:'root',body:'Root'},{commentId:'reply',kind:'reply',body:'Reply'}]}]};
 let state=JSON.stringify(original),texts=initial;
 const save=(next,edit)=>{const result=planCommentAnchorSave({beforeText:state,projectId,sceneId,beforeContent:encode(texts),afterContent:encode(next),sessionId:'session',editIntents:{schemaVersion:1,baselineTextSha256:sha(JSON.stringify(texts)),edits:[edit]}});state=result.afterText;texts=next;return readState(state,projectId);};
 const forward={id:'e1',historyId:'h1',direction:'forward',paragraphIndex:1,fromUtf16:1,toUtf16:1,removedText:'',insertText:'X'};
 let saved=save(['Alpha','MXiddle','Omega'],forward);
 assert.equal(saved.threads[0].anchor.selectedText,'pha\nMXiddle\nOm');assert.equal(saved.threads[0].anchorEditHistory.length,1);
 // A second Save within the same actual PM history group must refresh the span endpoint.
 saved=save(['Alpha','MXYiddle','Omega'],{...forward,id:'e2',fromUtf16:2,toUtf16:2,insertText:'Y'});
 assert.equal(saved.threads[0].anchorEditHistory.length,1);
 saved=save(initial,{...forward,id:'e3',direction:'undo',fromUtf16:1,toUtf16:3,removedText:'XY',insertText:''});
 assert.deepEqual(saved.threads[0].anchor,anchor);assert.deepEqual(saved.threads[0].messages,original.threads[0].messages);
 saved=save(['Alpha','MXYiddle','Omega'],{...forward,id:'e4',direction:'redo',insertText:'XY'});
 assert.equal(saved.threads[0].anchor.selectedText,'pha\nMXYiddle\nOm');
 const priorOutside=saved.threads[0].anchor;
 save(['XXAlpha','MXYiddle','Omega'],{...forward,id:'e5',historyId:'h2',paragraphIndex:0,fromUtf16:0,toUtf16:0,insertText:'XX'});
 saved=save(['Alpha','MXYiddle','Omega'],{...forward,id:'e6',historyId:'h2',direction:'undo',paragraphIndex:0,fromUtf16:0,toUtf16:2,removedText:'XX',insertText:''});
 assert.deepEqual(saved.threads[0].anchor,priorOutside);
 const before=state;
 assert.throws(()=>planCommentAnchorSave({beforeText:state,projectId,sceneId,beforeContent:encode(texts),afterContent:encode(['Alpha','MXY','iddle','Omega'])}),{code:'COMMENT_SAVE_STRUCTURE_UNSUPPORTED'});
 assert.equal(state,before);
 const forged=JSON.parse(state);forged.threads[0].anchorEditHistory[0].before.coveredParagraphsSha256=sha('forged');
 assert.throws(()=>readState(JSON.stringify(forged),projectId),{code:'COMMENT_HISTORY_INVALID'});
});

for(const boundary of ['SCENE','COMMENT','COMMIT']) test(`multi-paragraph V4 saved edit fresh-process ${boundary} recovery is atomic`,async t=>{
 const f=fixture(t),{deriveCommentAnchor}=require('../../src/core/word-comment-ranges-v1.cjs');
 const encode=texts=>envelope.composeObservablePayload({doc:{type:'doc',content:texts.map(text=>({type:'paragraph',content:[{type:'text',text}]}))}});
 const old=['Alpha','Beta'],next=['AlXpha','Beta'];
 f.beforeScene=encode(old);f.afterScene=encode(next);
 const state=JSON.parse(f.beforeText);state.schemaVersion='yalken.rtk.word.non-text-return-state.v4';
 state.threads[0].anchor=deriveCommentAnchor({sceneId,paragraphs:old,input:{kind:'multi-paragraph-range',paragraphIndex:0,startUtf16:1,endParagraphIndex:1,endUtf16:2}});
 f.beforeText=JSON.stringify(state);
 const editIntents={schemaVersion:1,baselineTextSha256:sha(JSON.stringify(old)),edits:[{id:'e',historyId:'h',direction:'forward',paragraphIndex:0,fromUtf16:2,toUtf16:2,removedText:'',insertText:'X'}]};
 f.request={...f.request,expectedSceneContent:f.beforeScene,sceneContent:f.afterScene,commentState:planCommentAnchorSave({beforeText:f.beforeText,projectId,sceneId,beforeContent:f.beforeScene,afterContent:f.afterScene,sessionId:'s',editIntents})};
 fs.writeFileSync(f.scenePath,f.beforeScene);fs.writeFileSync(f.commentPath,f.beforeText);fs.writeFileSync(path.join(f.root,'request.json'),JSON.stringify(f.request));
 const prior=observed(f);
 const forged=structuredClone(f.request);const graph=JSON.parse(forged.commentState.afterText);graph.threads[0].anchor.endUtf16++;forged.commentState.afterText=JSON.stringify(graph);
 await assert.rejects(tx.commitProjectTransaction({...forged,publishManifest}),/COMMENT_STATE/);assert.deepEqual(observed(f),prior);
 const crash=await child(f,'crash',boundary);assert.equal(crash.signal,'SIGKILL',JSON.stringify(crash));
 const recovered=await child(f,'recover');assert.equal(recovered.code,0,recovered.stderr);
 assert.deepEqual(observed(f),boundary==='COMMIT'?[f.afterScene,f.afterManifest,f.request.commentState.afterText]:prior);
 assert.equal((await child(f,'recover')).code,0);
});

test('actual Main structural V2 Save and saved Undo publish one exact scene-comment pair; forged replay writes nothing',async t=>{
 const f=await mainHarness(t),before=observed(f),old=['Left anchor right'],split=['Left anc','hor right'];
 const multi=envelope.composeObservablePayload({doc:{type:'doc',content:split.map(text=>({type:'paragraph',content:[{type:'text',text}]}))}});
 const ledger=(texts,edit)=>JSON.stringify({schemaVersion:2,baselineTextSha256:sha(JSON.stringify(texts)),edits:[edit]});
 const forward={id:'struct-e1',historyId:'struct-h1',direction:'forward',fromParagraphIndex:0,fromUtf16:8,toParagraphIndex:0,toUtf16:8,removedParagraphs:[''],insertedParagraphs:['','']};
 const bad=await f.save(multi,{commentEditIntentsJson:ledger(old,{...forward,removedParagraphs:['forged']})});
 assert.equal(bad.success,false);assert.match(bad.code,/COMMENT_EDIT_SPLICE_STALE/);assert.deepEqual(observed(f),before);
 const done=await f.save(multi,{commentEditIntentsJson:ledger(old,forward)});assert.equal(done.success,true,JSON.stringify(done));
 assert.equal(fs.readFileSync(f.scenePath,'utf8'),multi);
 const saved=JSON.parse(fs.readFileSync(f.commentPath,'utf8'));assert.equal(saved.schemaVersion,'yalken.rtk.word.non-text-return-state.v5');
 assert.equal(saved.threads[0].anchor.selectedText,'anc\nhor');assert.deepEqual(saved.threads[0].messages,JSON.parse(f.beforeText).threads[0].messages);
 const undone=await f.save(f.beforeScene,{commentEditIntentsJson:ledger(split,{id:'struct-e2',historyId:'struct-h1',direction:'undo',fromParagraphIndex:0,fromUtf16:8,toParagraphIndex:1,toUtf16:0,removedParagraphs:['',''],insertedParagraphs:['']})});
 assert.equal(undone.success,true,JSON.stringify(undone));assert.equal(fs.readFileSync(f.scenePath,'utf8'),f.beforeScene);
 assert.deepEqual(JSON.parse(fs.readFileSync(f.commentPath,'utf8')).threads[0].anchor,JSON.parse(f.beforeText).threads[0].anchor);
 const current=observed(f);const stale=await f.save(multi,{commentEditIntentsJson:ledger(['foreign'],forward)});
 assert.equal(stale.success,false);assert.match(stale.code,/COMMENT_EDIT_BASELINE_STALE/);assert.deepEqual(observed(f),current);
});

test('comment traversal preserves finite quote, code, continuation and table ownership without treating quotes as root paragraphs',()=>{
  const model=require('../../src/core/word-comment-anchor-save-v1.cjs');
  const p=text=>({type:'paragraph',content:[{type:'text',text}]});
  const doc={type:'doc',content:[{type:'blockquote',content:[p('Left anchor right'),{type:'blockquote',content:[{type:'codeBlock',content:[{type:'text',text:'code\nline'}]}]}]},
    {type:'orderedList',content:[{type:'listItem',content:[p('Item'),p('Continuation')]}]},
    {type:'table',content:[{type:'tableRow',content:[{type:'tableCell',content:[p('Cell A')]},{type:'tableCell',content:[p('Cell B')]}]}]}]};
  const raw=envelope.composeObservablePayload({doc}),rows=model.paragraphs(raw);
  assert.deepEqual(rows.map(r=>r.text),['Left anchor right','code\nline','Item','Continuation','Cell A','Cell B']);
  assert.notDeepEqual(rows[4].table,rows[5].table);
  const changed=structuredClone(doc);changed.content[0].content[0].content[0].text='PREFIX Left anchor right';
  const saved=model.planCommentAnchorSave({beforeText:graph(),projectId,sceneId,beforeContent:raw,afterContent:envelope.composeObservablePayload({doc:changed})});
  assert.equal(JSON.parse(saved.afterText).threads[0].anchor.startUtf16,12);
  assert.deepEqual(JSON.parse(saved.afterText).threads[0].messages,JSON.parse(graph()).threads[0].messages);
  for(const value of [{type:'blockquote',content:[]},{type:'blockquote',attrs:{unknown:true},content:[p('x')]},
    {type:'blockquote',content:[{type:'future-widget',content:[p('x')]}]},
    {type:'blockquote',extra:true,content:[p('x')]}]) {
    assert.throws(()=>model.paragraphs(envelope.composeObservablePayload({doc:{type:'doc',content:[value]}})),/COMMENT_SAVE_STRUCTURE_UNSUPPORTED/);
  }
  let nested=p('x');for(let i=0;i<9;i++)nested={type:'blockquote',content:[nested]};
  assert.throws(()=>model.paragraphs(envelope.composeObservablePayload({doc:{type:'doc',content:[nested]}})),/COMMENT_SAVE_STRUCTURE_UNSUPPORTED/);
  const split=structuredClone(doc);split.content[0].content.splice(0,1,p('Left'),p(' anchor right'));
  const intent={schemaVersion:2,baselineTextSha256:sha(JSON.stringify(rows.map(r=>r.text))),edits:[{id:'split',historyId:'h1',direction:'forward',fromParagraphIndex:0,fromUtf16:4,toParagraphIndex:0,toUtf16:4,removedParagraphs:[''],insertedParagraphs:['','']}]};
  assert.throws(()=>model.planCommentAnchorSave({beforeText:graph(),projectId,sceneId,beforeContent:raw,afterContent:envelope.composeObservablePayload({doc:split}),editIntents:intent,sessionId:'quote-session'}),/COMMENT_SAVE_STRUCTURE_UNSUPPORTED/);
});

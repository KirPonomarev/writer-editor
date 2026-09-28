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
 const sandbox={fs:fsp,path,Buffer,...gateway,SAVE_AUTHORITY_OBSERVER_IDS:gateway.OBSERVER_IDS,
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

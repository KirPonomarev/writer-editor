const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const crypto=require('node:crypto');
const vm=require('node:vm');
const {commitProjectTransaction}=require('../../src/core/project-transaction-v1.cjs');
const digest=x=>crypto.createHash('sha256').update(String(x)).digest('hex');
const stable=x=>Array.isArray(x)?'['+x.map(stable).join(',')+']':x&&typeof x==='object'?'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+stable(x[k])).join(',')+'}':JSON.stringify(x);
const cryptoPort={sha256Text:digest,sha256Json:x=>'sha256:'+digest(stable(x)),byteLength:x=>Buffer.byteLength(String(x))};
const modules=Promise.all([import('../../src/io/revisionBridge/reviewTransportStructuralReturnRuntime.mjs'),import('../../src/renderer/documentContentEnvelope.mjs'),import('../../src/product/mainProjectManifestAuthority.mjs')]);

for(const mode of ['success','rollback','restart','stale','publisher-reject','parent-swap'])test('structural return real transaction continuity: '+mode,async t=>{
 const [runtime,envelope,{createMainProjectManifestAuthority}]=await modules;
 const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'word-structural-tx-')));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));fs.mkdirSync(root+'/roman');
 const paths={'scene-a':root+'/roman/a.txt','scene-b':root+'/roman/b.txt'};
 const rawA=envelope.composeObservablePayload({text:'Alpha chapter opening'}),rawB=envelope.composeObservablePayload({text:'Beta section title'});
 fs.writeFileSync(paths['scene-a'],rawA);fs.writeFileSync(paths['scene-b'],rawB);
 const projectId='structural-continuity',manifestPath=root+'/project.json';fs.writeFileSync(manifestPath,JSON.stringify({projectId,protected:{title:'Keep',unknown:[1,2]}}));
 const authority=createMainProjectManifestAuthority({anchorRoot:root+'/anchors',useLeaseHeartbeatWorker:false});
 const verifyManifestContinuation=r=>authority.verifyManifestContinuation({...r,projectId});
 const publishManifest=({manifestPath:targetPath,expectedText,nextText})=>authority.commitManifestText({projectId,targetPath,expectedText,nextText});
 let revision=0,calls=0,ready=false;
 const publishScene=async(file,content,options)=>{
  calls++;if(ready&&mode==='publisher-reject')return {ok:0};
  if(options.beforeRename)await options.beforeRename();
  const beforeManifest=fs.readFileSync(manifestPath,'utf8');
  const receipt=await commitProjectTransaction({scenePath:file,sceneContent:content,expectedSceneContent:options.expectedText,manifestPath,manifestContent:beforeManifest,expectedManifestContent:beforeManifest,revision:++revision,publishManifest,verifyManifestContinuation});
  assert.equal(receipt.success,true);return {ok:1,receipt};
 };
 for(const file of Object.values(paths))await publishScene(file,fs.readFileSync(file,'utf8'),{expectedText:fs.readFileSync(file,'utf8')});calls=0;ready=true;
 const input={commandId:'cmd.rtk.review.applyMultiSceneStructuralReturn',callerRole:'main',commandAuthority:{issuer:'main',intent:'rtk.structuralApply',commandId:'cmd.rtk.review.applyMultiSceneStructuralReturn'},projectId,projectRoot:root,requestId:'structural-'+mode,returnArtifactSha256:'sha256:'+'d'.repeat(64),scenePathBySceneId:paths,previewConfirmed:true,operations:Object.entries(paths).map(([sceneId,file])=>({operationId:'heading-'+sceneId,sceneId,blockId:'block-'+sceneId,paragraphOrdinal:0,from:0,to:sceneId==='scene-a'?21:18,selectedText:sceneId==='scene-a'?'Alpha chapter opening':'Beta section title',structural:{action:'setNodeType',nodeType:'heading',headingLevel:2},sourceAuthority:'authenticated-full-manuscript-export-map-structural-ir-v1',sourceSceneRevision:'sha256:'+digest(fs.readFileSync(file,'utf8')),sourceRawSha256:'sha256:'+digest(fs.readFileSync(file,'utf8'))}))};
 const options={cryptoPort,publishScene};
 if(mode==='rollback')options.beforeSceneWrite=({index})=>{if(index===1)throw Error('INJECTED_SECOND_SCENE_FAILURE');};
 if(mode==='restart')options.simulateAbruptFailureAtSceneIndex=0;
 if(mode==='stale')options.beforeAtomicSceneRename=()=>fs.writeFileSync(paths['scene-a'],'concurrent author text');
 if(mode==='parent-swap')options.beforeAtomicSceneRename=()=>{fs.renameSync(root+'/roman',root+'/saved-roman');fs.mkdirSync(root+'/roman');fs.writeFileSync(paths['scene-a'],'unrelated new directory');};
 let result;
 if(mode==='restart'){
  await assert.rejects(runtime.applyMultiSceneStructuralReturnRuntime(input,options),/SIMULATED_ABRUPT_PROCESS_EXIT/);
  result=await runtime.reconcileStructuralReturnRuntimeAtStartup({projectRoot:root,projectId,scenePathBySceneId:paths,startupSingleInstanceAuthority:true},{cryptoPort,publishScene});assert.equal(result.ok,true,JSON.stringify(result));
 }else result=await runtime.applyMultiSceneStructuralReturnRuntime(input,options);
 if(mode==='success'){
  assert.equal(result.status,'applied',JSON.stringify(result));assert.equal(calls,2);
  assert.equal(envelope.parseObservablePayload(fs.readFileSync(paths['scene-a'],'utf8')).doc.content[0].type,'heading');
  const replay=await runtime.applyMultiSceneStructuralReturnRuntime(input,{cryptoPort,publishScene});assert.equal(replay.status,'replay');assert.equal(calls,2);
 }else if(mode==='stale'){assert.equal(result.ok,false);assert.equal(fs.readFileSync(paths['scene-a'],'utf8'),'concurrent author text');}
 else if(mode==='parent-swap'){assert.equal(result.ok,false);assert.equal(fs.readFileSync(paths['scene-a'],'utf8'),'unrelated new directory');assert.equal(fs.readFileSync(root+'/saved-roman/a.txt','utf8'),rawA);}
 else{assert.equal(fs.readFileSync(paths['scene-a'],'utf8'),rawA);assert.equal(fs.readFileSync(paths['scene-b'],'utf8'),rawB);if(mode!=='restart')assert.equal(result.ok,false);}
 if(!['stale','parent-swap'].includes(mode)){
  ready=false;
  for(const file of Object.values(paths)){
   const before=fs.readFileSync(file,'utf8');const record=JSON.parse(fs.readFileSync(file+'.wp201-commit.json','utf8'));assert.equal(record.sceneDigest,digest(before));
   // A subsequent real transaction validates previous commit identity and CAS.
   await publishScene(file,before+'\n',{expectedText:before});
  }
  assert.deepEqual(JSON.parse(fs.readFileSync(manifestPath,'utf8')).protected,{title:'Keep',unknown:[1,2]});
 }
});

function mainFunction(name){const source=fs.readFileSync(path.join(__dirname,'../../src/main.js'),'utf8');const start=source.indexOf('async function '+name+'('),end=source.indexOf('\n}\n',start)+3;assert(start>=0&&end>start);return source.slice(start,end);}
for(const phase of ['apply','startup'])test('main structural '+phase+' supplies the project transaction publisher',async()=>{
 let received;const publisher=()=>{};const module={createRtkStructuralReturnCommandHandler:o=>{received=o;return async()=>({ok:true});},reconcileStructuralReturnRuntimeAtStartup:async(_,o)=>{received=o;return {ok:true};}};
 const box={loadRtkStructuralReturnModule:async()=>module,createRtkReviewTransportCryptoPort:()=>cryptoPort,publishReviewSceneWithProjectTransaction:publisher,revalidateRtkReturnApplyKey:async()=>({ok:true}),buildRtkStructuralReturnRuntimeProjectScope:async()=>({}),attachRtkStructuralReturnReplayInspection:()=>{}};vm.createContext(box);
 const name=phase==='apply'?'handleRtkStructuralReturnCommandSurface':'reconcileReviewStructuralReturnAtStartup';vm.runInContext(mainFunction(name),box);await box[name]({});assert.equal(received.publishScene,publisher);
});

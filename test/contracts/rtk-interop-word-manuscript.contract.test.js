"use strict";
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const crypto = require('node:crypto');
const {pathToFileURL} = require('node:url');
const {commitProjectTransaction,commitPathFor} = require('../../src/core/project-transaction-v1.cjs');
const {durableSaveTransaction} = require('../../src/core/save-coordinator-v1.cjs');
const gateway = require('../../src/core/legacy-strangler-v1.cjs');
const ROOT = path.resolve(__dirname,'../..');
const source = fs.readFileSync(path.join(ROOT,'src/main.js'),'utf8');
const adapter = source.match(/async function commitWriterProjectSnapshot\([^]*?\n}/)[0];
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
async function harness(t,options={}) {
 const root=await fsp.mkdtemp(path.join(os.tmpdir(),'manuscript-save-'));
 t.after(()=>fsp.rm(root,{recursive:true,force:true}));
 const scenePath=path.join(root,'scene.txt'),manifestPath=path.join(root,'project.json');
 await fsp.writeFile(scenePath,'original');
 await fsp.writeFile(manifestPath,JSON.stringify({projectId:'fixture-project',proUnknown:{comments:[{sceneId:'scene.txt',body:'preserve me'}]}}));
 const preservation=await import(pathToFileURL(path.join(ROOT,'src/core/proRoundtripPreservation.mjs')));
 let publications=0;
 const context=vm.createContext({fs:fsp,Buffer,commitProjectTransaction,durableSaveTransaction,...gateway,
  isDirty:false,autoSaveInProgress:false,lastSignaledEditGeneration:7,isAllowedFilePath:p=>p===scenePath,queueDiskOperation:fn=>fn(),
  resolveProjectBindingForFile:async()=>({manifestPath,manifest:JSON.parse(await fsp.readFile(manifestPath,'utf8'))}),
  SAVE_AUTHORITY_OBSERVER_IDS:gateway.OBSERVER_IDS,
  isPlainObjectValue:v=>!!v&&typeof v==='object'&&!Array.isArray(v),
  getDocumentContextFromPath:()=>({kind:'scene'}),getProjectRelativeFilePath:p=>path.relative(root,p),
  loadProRoundtripPreservationModule:async()=>options.missingInvalidation?{}:preservation,
  prepareBookProfileManifestForFile:async()=>{const raw=await fsp.readFile(manifestPath,'utf8');return {manifestPath,projectId:'fixture-project',expectedText:raw,nextText:raw};},
  getMainProjectManifestAuthority:async()=>({commitManifestText:async({expectedText,nextText,targetPath})=>{
   assert.equal(await fsp.readFile(targetPath,'utf8'),expectedText,'manifest compare-and-swap');
   if(options.failPublication)throw Object.assign(new Error('injected write refusal'),{code:'E_TEST_WRITE_REFUSED'});
   publications++;
   await durableSaveTransaction({filePath:targetPath,content:nextText,revision:publications});
  }}),
 });
 vm.runInContext(adapter+'\n'+['publishReviewSceneWithProjectTransaction','runReviewExactTextSafeWriteFromMainState','runReviewExactTextBatchSafeWriteFromMainState'].map(n=>source.match(new RegExp('async function '+n+'\\([^]*?\\n}'))[0]).join('\n'),context);
 return {root,scenePath,manifestPath,publish:context.publishReviewSceneWithProjectTransaction,context,save:(content,revision)=>context.commitWriterProjectSnapshot(scenePath,content,revision,{},'test atomic invalidation'),publications:()=>publications};
}
test('Actual Writer adapter preserves atomic invalidation across changed, identical and subsequent saves',async t=>{
 const h=await harness(t);
 for(const [revision,content] of [[1,'日本語. é'],[2,'日本語. é'],[3,'日本語. é next']]){
  const result=await h.save(content,revision);assert.equal(result.success,true,JSON.stringify(result));assert.equal(result.projectTransaction,true);
  const bytes=await fsp.readFile(h.manifestPath),manifest=JSON.parse(bytes),commit=JSON.parse(await fsp.readFile(commitPathFor(h.scenePath)));
  assert.equal(commit.sceneDigest,digest(await fsp.readFile(h.scenePath)));
  assert.equal(commit.manifestDigest,digest(bytes));
  assert.deepEqual(manifest.proDataInvalidation.changedSceneIds,['scene.txt']);
  assert.equal(manifest.proUnknown.comments[0].body,'preserve me');assert.equal(manifest.proUnknown.comments[0].stale,true);
  if(revision===1)h.firstManifest=bytes;
  if(revision===2)assert.deepEqual(bytes,h.firstManifest,'identical save must not create another invalidation revision');
 }
});
for(const corruption of ['scene','manifest'])test('Atomic invalidation retains rejection and recovery evidence for corrupt '+corruption,async t=>{
 const h=await harness(t);assert.equal((await h.save('committed',1)).success,true);
 const target=corruption==='scene'?h.scenePath:h.manifestPath;
 await fsp.appendFile(target,' ');const before=await fsp.readFile(target);
 const result=await h.save('next',2);assert.equal(result.success,false);assert.equal(result.code,'E_PROJECT_COMMIT_CORRUPT');
 assert.deepEqual(await fsp.readFile(target),before);assert.ok((await fsp.readdir(path.join(h.root,'.yalken-recovery'))).length>0);
});
test('Missing invalidation transformer fails before any scene or manifest publication',async t=>{
 const h=await harness(t,{missingInvalidation:true});const before=await fsp.readFile(h.manifestPath);
 const result=await h.save('new',1);assert.equal(result.success,false);assert.equal(result.code,'E_PROJECT_SAVE_INVALIDATION_FAILED');
 assert.equal(h.publications(),0);assert.equal(await fsp.readFile(h.scenePath,'utf8'),'original');assert.deepEqual(await fsp.readFile(h.manifestPath),before);
});
test('Rejected manifest publication never acknowledges or publishes the changed scene',async t=>{
 const h=await harness(t,{failPublication:true});const result=await h.save('new',1);
 assert.equal(result.success,false);assert.equal(await fsp.readFile(h.scenePath,'utf8'),'original');
});

test('Existing review recovery wrapper publishes through the actual main project writer and preserves the next Save',async t=>{
 const h=await harness(t);assert.equal((await h.save('before review',1)).success,true);
 const {writeMarkdownWithTransactionRecovery}=await import(pathToFileURL(path.join(ROOT,'src/io/markdown/index.mjs')));
 const stages=[];let afterRename=0;
 const written=await writeMarkdownWithTransactionRecovery(h.scenePath,'after review',{expectedText:'before review',publishScene:h.publish,afterStage:e=>stages.push(e.stage),afterRename:()=>{afterRename++;}});
 assert.equal(written.snapshotCreated,true);assert.equal(await fsp.readFile(written.snapshotPath,'utf8'),'before review');
 assert.deepEqual(stages,['INTENT_CREATED','SNAPSHOT_CREATED','WRITE_COMMITTED']);assert.equal(afterRename,1);
 const commit=JSON.parse(await fsp.readFile(commitPathFor(h.scenePath)));
 assert.equal(commit.sceneDigest,digest(Buffer.from('after review')));assert.equal(commit.manifestDigest,digest(await fsp.readFile(h.manifestPath)));
 assert.equal((await h.save('after review',8)).success,true,'Save after accepted review must retain valid commit');
});
test('Main review publication refuses stale expected input before writing or invalidating',async t=>{
 const h=await harness(t);const before=await fsp.readFile(h.manifestPath);
 await assert.rejects(h.publish(h.scenePath,'overwrite',{expectedText:'obsolete'}),e=>e.code==='E_PROJECT_TRANSACTION_SCENE_CAS');
 assert.equal(await fsp.readFile(h.scenePath,'utf8'),'original');assert.deepEqual(await fsp.readFile(h.manifestPath),before);assert.equal(h.publications(),0);
});

for(const mode of ['Single','Batch'])test('Main '+mode+' review route injects project publication inside its existing disk queue',async t=>{
 const h=await harness(t);assert.equal((await h.save('saved before Word',1)).success,true);
 const {writeMarkdownWithTransactionRecovery}=await import(pathToFileURL(path.join(ROOT,'src/io/markdown/index.mjs')));
 const run=mode==='Batch'?h.context.runReviewExactTextBatchSafeWriteFromMainState:h.context.runReviewExactTextSafeWriteFromMainState;
 await run(async(input,options)=>{assert.equal(options.publishScene,h.publish);return writeMarkdownWithTransactionRecovery(h.scenePath,'returned from Word',{...options,expectedText:'saved before Word'});},{},{});
 assert.equal((await h.save('returned from Word',8)).success,true);
});

test('Custom-property signed tokens escape Word Xstring decoding exactly once',()=>{
 const builder=fs.readFileSync(path.join(ROOT,'src/export/docx/docxReviewPacketBuilder.js'),'utf8');
 const fn=n=>builder.match(new RegExp('function '+n+'\\([^]*?\\n}'))[0];
 const decoder=source.match(/function decodeDocxCustomPropertyText\([^]*?\n}/)[0];
 const context=vm.createContext({docxReviewPreviewSessionDetailString:v=>v,normalizeString:v=>v,isPlainObjectValue:v=>v&&typeof v==='object',CUSTOM_PROPS_NS:'custom',CUSTOM_PROPS_VT_NS:'vt',escapeXml:v=>v.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')});
 vm.runInContext(fn('normalizeCustomProperties')+'\n'+fn('buildCustomPropertiesXml')+'\n'+decoder,context);
 for(const original of ['WVJUMgF_x3eCC_token','_x005F_x3eCC_','_x0000_','a&b_x0041_<end>']){
  const xml=context.buildCustomPropertiesXml([{name:'YRTK2_TOKEN',value:original}]);
  const encoded=xml.match(/<vt:lpwstr>([^]*?)<\/vt:lpwstr>/)[1];
  assert.ok(encoded.includes('_x005F_'));assert.equal(context.decodeDocxCustomPropertyText(encoded),original);
  // Independent one-pass reference for Word's custom-string interpretation.
  const word=encoded.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/_x([a-fA-F0-9]{4})_/g,(_,h)=>String.fromCharCode(Number('0x'+h)));
  assert.equal(word,original);assert.notEqual(context.decodeDocxCustomPropertyText(encoded+'x'),original);
 }
 assert.equal(context.decodeDocxCustomPropertyText('_x005F_x0041_'),'_x0041_');
});

test('Actual manifest authority proves cross-scene succession and rejects an unrecorded edit',async t=>{
 const root=await fsp.mkdtemp(path.join(os.tmpdir(),'manifest-continuation-'));t.after(()=>fsp.rm(root,{recursive:true,force:true}));
 const {createMainProjectManifestAuthority}=await import(pathToFileURL(path.join(ROOT,'src/product/mainProjectManifestAuthority.mjs')));
 const authority=createMainProjectManifestAuthority({anchorRoot:path.join(root,'anchors'),useLeaseHeartbeatWorker:false});
 const manifestPath=path.join(root,'project.json'),projectId='fixture-project';
 const scenes=['a','b','c'].map(n=>path.join(root,n+'.txt'));
 await fsp.writeFile(manifestPath,JSON.stringify({projectId,n:0}));for(const p of scenes)await fsp.writeFile(p,'initial');
 const verifyManifestContinuation=req=>authority.verifyManifestContinuation({...req,projectId});
 const commit=async(i,n)=>commitProjectTransaction({scenePath:scenes[i],sceneContent:'edited-'+n,expectedSceneContent:await fsp.readFile(scenes[i],'utf8'),manifestPath,expectedManifestContent:await fsp.readFile(manifestPath,'utf8'),manifestContent:JSON.stringify({projectId,n}),revision:n,verifyManifestContinuation,publishManifest:({manifestPath:targetPath,expectedText,nextText})=>authority.commitManifestText({projectId,targetPath,expectedText,nextText})});
 for(const [i,n] of [[0,1],[1,2],[2,3],[0,4],[1,5],[0,6]])assert.equal((await commit(i,n)).success,true);
 const before=await fsp.readFile(scenes[0],'utf8');await fsp.writeFile(manifestPath,JSON.stringify({projectId,n:999}));
 await assert.rejects(commit(0,7),e=>e.code==='E_PROJECT_COMMIT_CORRUPT');assert.equal(await fsp.readFile(scenes[0],'utf8'),before);
});

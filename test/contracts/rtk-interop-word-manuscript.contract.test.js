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
 const context=vm.createContext({fs:fsp,commitProjectTransaction,durableSaveTransaction,...gateway,
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
 vm.runInContext(adapter,context);
 return {root,scenePath,manifestPath,save:(content,revision)=>context.commitWriterProjectSnapshot(scenePath,content,revision,{},'test atomic invalidation'),publications:()=>publications};
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

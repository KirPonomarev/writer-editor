'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const envelope=require('../../src/core/document-content-envelope-v1.cjs');
const stories=require('../../src/core/word-stories-v1.cjs');
const txn=require('../../src/core/project-transaction-v1.cjs');
const body=text=>({type:'doc',content:[{type:'paragraph',content:[{type:'text',text}]}]});
function doc(text) {return {...body('Protected manuscript'),attrs:{wordSections:{schemaVersion:1,boundaries:[],final:{type:'nextPage'}},wordStories:{schemaVersion:1,evenAndOddHeaders:false,stories:[{id:'header',role:'header',body:body(text)}],sections:[{titlePage:false,header:{default:'header'},footer:{}}]}}};}
async function fixture(t) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'story-cohort-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  fs.mkdirSync(path.join(root,'roman'));const manifestPath=path.join(root,'project.craftsman.json'),beforeManifestText=JSON.stringify({projectId:'p',schemaVersion:1});fs.writeFileSync(manifestPath,beforeManifestText);
  const changes=['a','b'].map(name=>{const before=doc(name),after=stories.replaceBody(before,'header',body(name+' Word'));const item={sceneId:`roman/${name}.txt`,beforeContent:envelope.composeObservablePayload({doc:before}),afterContent:envelope.composeObservablePayload({doc:after}),commitText:null};fs.writeFileSync(path.join(root,item.sceneId),item.beforeContent);return item;});
  const model=await import('../../src/core/project-tree-cohort-v1.mjs');
  const input={operation:'story-bodies',operationId:'story-test',projectId:'p',manifestPath,beforeManifestText,expectedTreeRevision:0,changes,notesText:null,commentsText:null};
  const plan=model.planProjectStoryBodyCohort(input);
  const request={manifestPath,revision:1,treeCohort:plan,revalidate:async()=>{},publishManifest:()=>{throw Error('MANIFEST_MUST_NOT_CHANGE');}};
  return {root,input,plan,request,changes,model};
}
test('two scene header edits use one recoverable cohort and retain ordinary manuscript bytes',async t=>{
  const f=await fixture(t);const result=await txn.commitProjectTransaction(f.request);assert.equal(result.success,true);
  for(const item of f.changes)assert.equal(fs.readFileSync(path.join(f.root,item.sceneId),'utf8'),item.afterContent);
  const saved=await txn.readVerifiedProjectTreeMutation({manifestPath:f.request.manifestPath,projectId:'p'});
  assert.equal(saved.treeRevision,1);assert.equal(saved.receipt.kind,'story-bodies');assert.equal(fs.existsSync(f.request.manifestPath+'.wp201-transaction.json'),false);
});
test('cohort rejects a forged manuscript edit and a stale scene without publishing any new bytes',async t=>{
  const f=await fixture(t),bad=JSON.parse(JSON.stringify(f.input));const parsed=envelope.parseObservablePayload(bad.changes[0].afterContent);parsed.doc.content[0].content[0].text='forged';bad.changes[0].afterContent=envelope.composeObservablePayload({doc:parsed.doc});
  assert.throws(()=>f.model.planProjectStoryBodyCohort(bad),/BODY_ONLY/);
  fs.writeFileSync(path.join(f.root,f.changes[1].sceneId),'foreign');await assert.rejects(txn.commitProjectTransaction(f.request),/UNKNOWN_BYTES|CAS/);
  assert.equal(fs.readFileSync(path.join(f.root,f.changes[0].sceneId),'utf8'),f.changes[0].beforeContent);assert.equal(fs.existsSync(f.request.manifestPath+'.wp201-transaction.json'),false);
});
test('failure after all scene publications recovers both scenes together and never acknowledges partial success',async t=>{
  const f=await fixture(t);await assert.rejects(txn.commitProjectTransaction({...f.request,afterTreeFilesPublish:()=>{throw Error('INJECT_AFTER_FILES');}}),/INJECT_AFTER_FILES/);
  assert.equal(fs.existsSync(f.request.manifestPath+'.wp201-transaction.json'),true);
  await txn.recoverProjectTransaction(f.request);
  for(const item of f.changes)assert.equal(fs.readFileSync(path.join(f.root,item.sceneId),'utf8'),item.beforeContent);
  assert.equal((await txn.readVerifiedProjectTreeMutation({manifestPath:f.request.manifestPath,projectId:'p'})).treeRevision,0);
});
for(let failAt=1;failAt<=7;failAt++)test(`cohort interrupted at durable rename ${failAt} recovers to a complete before or after state`,async t=>{
  const f=await fixture(t);let n=0,injected=false;
  const adapter={...fs.promises,rename:async(a,b)=>{await fs.promises.rename(a,b);if(++n===failAt){injected=true;throw Error('INJECT_DURABLE_RENAME');}}};
  let result;try{result=await txn.commitProjectTransaction({...f.request,fsAdapter:adapter});}catch(error){assert.match(error.message,/INJECT_DURABLE_RENAME/);}
  assert.equal(injected,true,`Only ${n} publications; test must target a real phase`);assert.notEqual(result?.success,true);
  await txn.recoverProjectTransaction(f.request);
  const states=f.changes.map(item=>{const raw=fs.readFileSync(path.join(f.root,item.sceneId),'utf8');return raw===item.beforeContent?'before':raw===item.afterContent?'after':'unknown';});
  assert.equal(new Set(states).size,1);assert.notEqual(states[0],'unknown');
  const verified=await txn.readVerifiedProjectTreeMutation({manifestPath:f.request.manifestPath,projectId:'p'});
  assert.equal(verified.treeRevision,states[0]==='after'?1:0);
});

test('Main batch Apply publishes both authenticated scene body candidates with one cohort receipt',async t=>{
  const f=await fixture(t),vm=require('node:vm'),{pathToFileURL}=require('node:url');
  const candidates=f.changes.map(item=>{
    const parsed=envelope.parseObservablePayload(item.beforeContent),after=envelope.parseObservablePayload(item.afterContent);
    return {sceneId:item.sceneId,raw:item.beforeContent,parsed,beforeDoc:parsed.doc,plan:{changed:true,doc:after.doc},
      changes:[{sceneId:item.sceneId,storyId:'header',role:'header',beforeBody:stories.read(parsed.doc).stories[0].body,afterBody:stories.read(after.doc).stories[0].body}]};
  });
  const current=path.join(f.root,f.changes[0].sceneId),changeId='docx-story-return-batch';
  const candidate={...candidates[0],changeId,batchScenes:candidates,sourceScenes:f.changes.map(item=>({sceneId:item.sceneId,path:path.join(f.root,item.sceneId),raw:item.beforeContent})),changes:candidates.flatMap(item=>item.changes)};
  const store={storyReturnCandidate:candidate},input={projectRoot:f.root,scenePath:current,projectSnapshot:{projectId:'p'},reviewItems:[{changeId}]};
  let writes=0;const c=vm.createContext({JSON,Buffer,path,pathToFileURL,__dirname:path.resolve(__dirname,'../../src'),
    activeRtkCleanLinkLabelApplyStore:store,activePendingRecording:null,currentFilePath:current,
    activeStage10ApplicationBootstrap:{},commentAuthoringSessionId:'session',lastSignaledEditGeneration:0,
    REVIEW_EXACT_TEXT_APPLY_BATCH_COMMAND_ID:'cmd.project.review.applyExactTextChangesBatch',
    revalidateCleanLinkLabelApplyInput:async()=>({ok:true}),userBookmarkCapability:()=>{},cleanLinkLabelStoreMatches:()=>true,
    requestEditorSnapshot:async()=>({content:f.changes[0].beforeContent,generation:1}),loadDocumentContentEnvelopeModule:async()=>envelope,
    loadRtkNonTextReturnModule:async()=>({commentSceneSnapshotsEqual:(a,b)=>JSON.stringify(a)===JSON.stringify(b)}),
    userBookmarkModel:require('../../src/core/word-user-bookmarks-v1.cjs'),userBookmarkEnvelopeMetadataEqual:()=>true,
    currentLifecycleSubjectId:()=>'life',fs:fs.promises,
    getMainProjectManifestAuthority:async()=>({withProjectLease:(id,fn)=>{assert.equal(id,'p');return fn({publish:fn=>fn()});},commitManifestText:()=>{throw Error('MANIFEST_WRITE');}}),
    readVerifiedProjectTreeMutation:txn.readVerifiedProjectTreeMutation,prepareWordMediaReturnResources:async()=>[],
    loadProjectTreeCohortModule:async()=>f.model,
    commitProjectTransaction:async request=>{writes++;return txn.commitProjectTransaction(request);},recoverProjectTransaction:txn.recoverProjectTransaction,
  });
  const main=fs.readFileSync(path.join(__dirname,'../../src/main.js'),'utf8');
  const source=main.slice(main.indexOf('async function capturePrivateDocumentStoriesBatch('),main.indexOf('async function buildPrivateUserBookmarksUiPlan('));
  new vm.Script(source,{importModuleDynamically:vm.constants.USE_MAIN_CONTEXT_DEFAULT_LOADER}).runInContext(c);
  const result=await c.applyPrivateDocumentStoriesBatch(input,store);
  assert.equal(result.ok,true,JSON.stringify(result));assert.equal(result.applied,true);assert.equal(writes,1);
  for(const item of f.changes)assert.equal(fs.readFileSync(path.join(f.root,item.sceneId),'utf8'),item.afterContent);
  assert.equal(result.receipt.bookmarkPublication.savedContent,f.changes[0].afterContent);
});

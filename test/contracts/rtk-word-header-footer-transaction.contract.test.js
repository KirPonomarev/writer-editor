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

async function mediaFixture(t) {
  const f=await fixture(t),attrs=require('../../src/io/documentMedia.js').createImageAttrs(require('../fixtures/document-jpeg-fixtures.cjs').rgb);
  for(const change of f.input.changes){const parsed=envelope.parseObservablePayload(change.afterContent);parsed.doc.attrs.wordStories.stories[0].body.content[0].content.push({type:'image',attrs});change.afterContent=envelope.composeObservablePayload({doc:parsed.doc});}
  f.input.mediaResources=[{relativePath:attrs.assetPath,contentBase64:attrs.dataBase64}];
  f.request.treeCohort=f.model.planProjectStoryBodyCohort(f.input);
  return {...f,attrs};
}
test('cohort persists new shared header image once with both scene resource proofs',async t=>{
  const f=await mediaFixture(t);assert.equal((await txn.commitProjectTransaction(f.request)).success,true);
  assert.equal(fs.readFileSync(path.join(f.root,f.attrs.assetPath)).toString('base64'),f.attrs.dataBase64);
  for(const change of f.changes){const record=JSON.parse(fs.readFileSync(path.join(f.root,change.sceneId+'.wp201-commit.json'),'utf8'));assert.ok(record.resources.some(r=>r.path===path.join(f.root,f.attrs.assetPath)));}
  assert.equal((await txn.readVerifiedProjectTreeMutation({manifestPath:f.request.manifestPath,projectId:'p'})).treeRevision,1);
});
test('cohort rejects image bytes or paths not derived from validated canonical story bodies',async t=>{
  const f=await mediaFixture(t);for(const mutation of [x=>x.mediaResources[0].contentBase64='YWJj',x=>x.mediaResources[0].relativePath='../foreign']){const bad=JSON.parse(JSON.stringify(f.input));mutation(bad);assert.throws(()=>f.model.planProjectStoryBodyCohort(bad),/ASSET_BINDING/);}
});
test('interruption after new image publication restores asset absence and both original scenes',async t=>{
  const f=await mediaFixture(t);let injected=false;
  const adapter={...fs.promises,rename:async(a,b)=>{await fs.promises.rename(a,b);if(b===path.join(f.root,f.attrs.assetPath)){injected=true;throw Error('INJECT_IMAGE_PUBLISHED');}}};
  await assert.rejects(txn.commitProjectTransaction({...f.request,fsAdapter:adapter}),/INJECT_IMAGE_PUBLISHED/);assert.equal(injected,true);
  await txn.recoverProjectTransaction(f.request);
  assert.equal(fs.existsSync(path.join(f.root,f.attrs.assetPath)),false);
  for(const change of f.changes)assert.equal(fs.readFileSync(path.join(f.root,change.sceneId),'utf8'),change.beforeContent);
});

test('shared empty exported section creates first header in two scenes through one typed atomic cohort',async t=>{
  const f=await fixture(t),source=require('../../src/export/docx/fullManuscriptDocxReviewPacketSource.js'),exporter=require('../../src/export/docx/docxReviewPacketStories.js');
  const {analyzeDocumentStoriesReturn}=await import('../../src/io/revisionBridge/reviewTransportStoriesV1.mjs');
  const scenes=f.changes.map((change,index)=>({sceneId:change.sceneId,doc:body('Plain scene '+index)}));
  const blocks=scenes.map((scene,index)=>({sceneId:scene.sceneId,documentParagraphIndex:index}));
  const sections=source.buildFullManuscriptDocumentSections(scenes,blocks),expected=exporter.buildDocumentStoriesExport(scenes,sections,{includeEmpty:true,blocks});
  assert.equal(expected.registry.sections.length,1);
  const returned={schemaVersion:1,evenAndOddHeaders:false,stories:[{id:'native-new',role:'header',body:body('First shared Word header')}],sections:[{titlePage:false,header:{default:'native-new'},footer:{}}]};
  const analyzed=analyzeDocumentStoriesReturn({expected,returned,beforeDocs:Object.fromEntries(scenes.map(scene=>[scene.sceneId,scene.doc])),allowTopology:true,idSeed:'main-trusted'});
  assert.equal(analyzed.ok,true,JSON.stringify(analyzed));assert.equal(analyzed.candidates.length,2);
  f.input.changes=analyzed.candidates.map(candidate=>{const change={sceneId:candidate.sceneId,beforeContent:envelope.composeObservablePayload({doc:candidate.beforeDoc}),afterContent:envelope.composeObservablePayload({doc:candidate.plan.doc}),storyMutationReplay:candidate.storyMutationReplay,commitText:null};fs.writeFileSync(path.join(f.root,change.sceneId),change.beforeContent);return change;});
  f.request.treeCohort=f.model.planProjectStoryBodyCohort(f.input);
  assert.equal((await txn.commitProjectTransaction(f.request)).success,true);
  for(const change of f.input.changes)assert.equal(fs.readFileSync(path.join(f.root,change.sceneId),'utf8'),change.afterContent);
});

async function mixedPlainGuardsFixture(t) {
  const f=await fixture(t);
  const guards=[{sceneId:'roman/plain.txt',raw:'Untouched plain sibling\nSecond paragraph'},{sceneId:'roman/empty.txt',raw:''}];
  for(const guard of guards){fs.writeFileSync(path.join(f.root,guard.sceneId),guard.raw);f.input.changes.push({sceneId:guard.sceneId,beforeContent:guard.raw,afterContent:guard.raw,commitText:null});}
  f.request.treeCohort=f.model.planProjectStoryBodyCohort(f.input);
  return {...f,guards};
}
test('two header changes retain exact plain and empty sibling bytes as cohort CAS guards',async t=>{
  const f=await mixedPlainGuardsFixture(t);assert.equal(f.request.treeCohort.affectedScenes.length,2);
  assert.equal((await txn.commitProjectTransaction(f.request)).success,true);
  for(const change of f.input.changes)assert.equal(fs.readFileSync(path.join(f.root,change.sceneId),'utf8'),change.afterContent);
  for(const guard of f.guards)assert.equal(fs.readFileSync(path.join(f.root,guard.sceneId),'utf8'),guard.raw);
});
for(const target of ['plain.txt','empty.txt'])test(`changed ${target} guard blocks all header writes`,async t=>{
  const f=await mixedPlainGuardsFixture(t);fs.writeFileSync(path.join(f.root,'roman',target),'External edit');
  await assert.rejects(txn.commitProjectTransaction(f.request),/UNKNOWN_BYTES|CAS/);
  for(const change of f.input.changes.slice(0,2))assert.equal(fs.readFileSync(path.join(f.root,change.sceneId),'utf8'),change.beforeContent);
  assert.equal(fs.existsSync(f.request.manifestPath+'.wp201-transaction.json'),false);
});
test('mixed rich/plain/empty cohort restores every original after interrupted publication',async t=>{
  const f=await mixedPlainGuardsFixture(t);
  await assert.rejects(txn.commitProjectTransaction({...f.request,afterTreeFilesPublish:()=>{throw Error('INJECT_MIXED_FILES');}}),/INJECT_MIXED_FILES/);
  await txn.recoverProjectTransaction(f.request);
  for(const change of f.input.changes)assert.equal(fs.readFileSync(path.join(f.root,change.sceneId),'utf8'),change.beforeContent);
});
test('actual Main batch capture admits unchanged open plain and empty scenes without weakening raw CAS',async t=>{
  const f=await mixedPlainGuardsFixture(t),vm=require('node:vm');
  const main=fs.readFileSync(path.join(__dirname,'../../src/main.js'),'utf8');
  const code=main.slice(main.indexOf('function mediaReturnEnvelopeMetadataEqual('),main.indexOf('async function buildPrivateDocumentStoriesBatchPreview('));
  for(const open of f.guards){
    const current=path.join(f.root,open.sceneId),candidate={changeId:'test',batchScenes:[{}],sourceScenes:f.input.changes.map(change=>({sceneId:change.sceneId,path:path.join(f.root,change.sceneId),raw:change.beforeContent}))};
    const store={storyReturnCandidate:candidate};
    const c=vm.createContext({activeRtkCleanLinkLabelApplyStore:store,activePendingRecording:null,currentFilePath:current,
      activeStage10ApplicationBootstrap:{},commentAuthoringSessionId:'session',lastSignaledEditGeneration:0,
      REVIEW_EXACT_TEXT_APPLY_BATCH_COMMAND_ID:'cmd.project.review.applyExactTextChangesBatch',
      revalidateCleanLinkLabelApplyInput:async()=>({ok:true}),userBookmarkCapability:()=>{},cleanLinkLabelStoreMatches:()=>true,
      requestEditorSnapshot:async()=>{const doc=envelope.buildParagraphDocumentFromText(open.raw);doc.attrs={wordUserBookmarks:null,wordPendingRevisions:null};for(const p of doc.content)p.attrs={textAlign:null};return {content:envelope.composeObservablePayload({doc,metaEnabled:true,meta:envelope.createDefaultDocumentMeta()}),generation:1};},loadDocumentContentEnvelopeModule:async()=>envelope,
      loadRtkNonTextReturnModule:async()=>({commentSceneSnapshotsEqual:(a,b)=>JSON.stringify(a)===JSON.stringify(b)}),
      userBookmarkModel:require('../../src/core/word-user-bookmarks-v1.cjs'),wordMediaReturnModel:require('../../src/core/word-media-return-v1.cjs'),userBookmarkEnvelopeMetadataEqual:(a,b)=>JSON.stringify(a.meta)===JSON.stringify(b.meta)&&a.hasMetaBlock===b.hasMetaBlock,
      currentLifecycleSubjectId:()=>'life',fs:fs.promises});
    new vm.Script(code).runInContext(c);
    assert.equal((await c.capturePrivateDocumentStoriesBatch({reviewItems:[{changeId:'test'}]},store)).open.raw,open.raw);
    fs.writeFileSync(current,'External change');
    await assert.rejects(c.capturePrivateDocumentStoriesBatch({reviewItems:[{changeId:'test'}]},store),/EDITOR_STALE/);
    fs.writeFileSync(current,open.raw);
  }
});

async function firstPlainHeaderFixture(t,raw) {
  const f=await fixture(t),parsed=envelope.parseObservablePayload(raw);
  const before=parsed.doc || envelope.buildParagraphDocumentFromText(!parsed.hasMetaBlock&&!parsed.hasCardsBlock?raw:parsed.text);
  const step={kind:'intent',intent:{op:'create',sectionIndex:0,role:'header',variant:'default',source:'empty'},
    options:{idSeed:'private-cohort-plain',trustedSections:{schemaVersion:1,boundaries:[],final:{type:'nextPage'}}}};
  const planned=stories.planStoryMutation(before,step.intent,step.options);
  const afterContent=envelope.composeObservablePayload({...parsed,metaEnabled:parsed.hasMetaBlock,doc:planned.doc});
  const changed={sceneId:'roman/plain.txt',beforeContent:raw,afterContent,commitText:null,storyMutationReplay:[step]};
  const guard={...f.changes[0],afterContent:f.changes[0].beforeContent};
  f.input.changes=[changed,guard];fs.writeFileSync(path.join(f.root,changed.sceneId),raw);
  f.request.treeCohort=f.model.planProjectStoryBodyCohort(f.input);
  return {...f,changed,guard,before};
}
for(const raw of ['\n\nLeading','Trailing\n','One\n\n\nTwo','\r\nOne\r\n\r\nTwo\r\n','',
 '[meta]\nstatus: draft\n[/meta]\n\nManuscript\n',
 '[cards]\n[card]\ntitle: Private card\ntext: Card body\ntags: local\n[/card]\n[/cards]\n\nManuscript\n'])test(`first Word header on plain source preserves authored paragraphs ${JSON.stringify(raw)}`,async t=>{
 const f=await firstPlainHeaderFixture(t,raw);
 assert.equal((await txn.commitProjectTransaction(f.request)).success,true);
 assert.deepEqual(envelope.parseObservablePayload(fs.readFileSync(path.join(f.root,f.changed.sceneId),'utf8')).doc.content,f.before.content);
 assert.equal(fs.readFileSync(path.join(f.root,f.guard.sceneId),'utf8'),f.guard.beforeContent);
 const bad=JSON.parse(JSON.stringify(f.input));const after=envelope.parseObservablePayload(bad.changes[0].afterContent);
 after.doc.content.push({type:'paragraph',content:[{type:'text',text:'forged manuscript'}]});bad.changes[0].afterContent=envelope.composeObservablePayload({...after,metaEnabled:after.hasMetaBlock,doc:after.doc});
 assert.throws(()=>f.model.planProjectStoryBodyCohort(bad),/E_STORY_COHORT_INTENT/);
});
test('first header on CRLF plain source retains exact raw CAS and rollback bytes',async t=>{
 const raw='\r\nOne\r\n\r\nTwo\r\n',f=await firstPlainHeaderFixture(t,raw),target=path.join(f.root,f.changed.sceneId);
 fs.writeFileSync(target,raw.replaceAll('\r\n','\n'));
 await assert.rejects(txn.commitProjectTransaction(f.request),/UNKNOWN_BYTES|CAS/);
 assert.equal(fs.readFileSync(path.join(f.root,f.guard.sceneId),'utf8'),f.guard.beforeContent);
 fs.writeFileSync(target,raw);
 await assert.rejects(txn.commitProjectTransaction({...f.request,afterTreeFilesPublish:()=>{throw Error('INJECT_PLAIN_HEADER');}}),/INJECT_PLAIN_HEADER/);
 await txn.recoverProjectTransaction(f.request);
 assert.equal(fs.readFileSync(target,'utf8'),raw);
 assert.equal(fs.readFileSync(path.join(f.root,f.guard.sceneId),'utf8'),f.guard.beforeContent);
});

test('single-scene Main writer replays first-header intent from exact plain paragraphs with metadata exclusion',async t=>{
 const vm=require('node:vm'),{pathToFileURL}=require('node:url');
 const main=fs.readFileSync(path.join(__dirname,'../../src/main.js'),'utf8');
 const start=main.indexOf('            const replayPlainText = options.storyReturnPlan?.storyMutationReplay');
 const end=main.indexOf('            if (options.storyAuthoringIntent)',start);
 assert.ok(start>0&&end>start);
 const code='async function validate(){'+main.slice(start,end)+'return {beforeDoc,workingDoc};}';
 for(const raw of ['\n\nLeading','Trailing\n','One\n\n\nTwo','\r\nOne\r\n\r\nTwo\r\n','',
 '[meta]\nstatus: draft\n[/meta]\n\nManuscript\n',
 '[cards]\n[card]\ntitle: Card\ntext: Private\ntags: local\n[/card]\n[/cards]\nManuscript\n']){
  const f=await firstPlainHeaderFixture(t,raw);
  const c=vm.createContext({JSON,path,pathToFileURL,__dirname:path.resolve(__dirname,'../../src'),envelope,
   beforeDocument:envelope.parseObservablePayload(raw),afterDocument:envelope.parseObservablePayload(f.changed.afterContent),expectedSceneContent:raw,
   options:{storyReturnPlan:{storyMutationReplay:f.changed.storyMutationReplay}}});
  new vm.Script(code,{importModuleDynamically:vm.constants.USE_MAIN_CONTEXT_DEFAULT_LOADER}).runInContext(c);
  const checked=await c.validate();assert.deepEqual(checked.beforeDoc.content,f.before.content);
  c.afterDocument.doc.content.push({type:'paragraph',content:[{type:'text',text:'forged'}]});
  await assert.rejects(c.validate(),/WORD_STORIES_INTENT_MISMATCH/);
 }
});

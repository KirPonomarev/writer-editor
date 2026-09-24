"use strict";
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const crypto = require('node:crypto');
const {execFileSync,spawn} = require('node:child_process');
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
  getDocumentContextFromPath:()=>({kind:options.contextKind||'scene'}),getProjectRelativeFilePath:p=>path.relative(root,p),
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

test('Full-manuscript DOCX metadata is dual-carried, signed, parsed independently and rejects protected drift',async()=>{
 const {buildFullManuscriptDocxReviewPacketSource,validateFullManuscriptDocumentMetadataReturn}=require('../../src/export/docx/fullManuscriptDocxReviewPacketSource.js');
 const {buildDocxReviewPacketBuffer}=require('../../src/export/docx/docxReviewPacketBuilder.js');
 const {extractStoredZipEntries}=require('../../src/export/docx/docxArtifactValidator.js');
 const bridge=await import(pathToFileURL(path.join(ROOT,'src/io/revisionBridge/index.mjs')));
 const stable=value=>Array.isArray(value)?`[${value.map(stable).join(',')}]`:value&&typeof value==='object'?`{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`:JSON.stringify(value);
 const cryptoPort={sha256Text:value=>crypto.createHash('sha256').update(String(value||''),'utf8').digest('hex'),sha256Json(value){return 'sha256:'+this.sha256Text(stable(value));},hmacSha256Json(value,secret){return 'hmac-sha256:'+crypto.createHmac('sha256',String(secret||'')).update(stable(value),'utf8').digest('hex');},byteLength:value=>Buffer.byteLength(String(value||''),'utf8')};
 const sourceMetadata={projectId:'project-metadata-contract',projectName:'Роман & Metadata',projectCreatedAtUtc:'2026-09-17T10:11:12Z',scenes:[{sceneId:'roman/one.txt',title:'One',text:'sentinel alpha',observableContent:'sentinel alpha',order:0}]};
 const source=buildFullManuscriptDocxReviewPacketSource(sourceMetadata,{createdAtUtc:'2026-09-18T01:02:03Z',roundIdHex:'a'.repeat(32),keyIdHex:'b'.repeat(32),hmacSecret:'metadata-test-secret',cryptoPort});
 const bytes=buildDocxReviewPacketBuffer(source),entries=extractStoredZipEntries(bytes);
 assert.ok(entries.has('docProps/core.xml'));assert.match(entries.get('[Content_Types].xml').toString('utf8'),/PartName="\/docProps\/core\.xml"/u);assert.match(entries.get('_rels/.rels').toString('utf8'),/metadata\/core-properties/u);
 const parsed=bridge.buildDocxReviewTransportAnalysisFromZipBytes({bytes,hmacSecret:source.forbiddenSecret,expectedAuthority:source.localAuthorityCapsule.expectedAuthority},{cryptoPort});
 assert.equal(parsed.ok,true);const metadata=parsed.reviewIr.documentMetadata,payload=parsed.authorityCarrier.selectedCarrier.payload;
 assert.deepEqual(metadata.protectedProperties,{schemaVersion:'yalken.rtk.word.document-metadata.v1',projectId:sourceMetadata.projectId,title:sourceMetadata.projectName,createdAtUtc:'2026-09-17T10:11:12.000Z',creator:'Yalken'});
 assert.equal(metadata.transportBindingProperties.yrtk2Token,source.customProperties.find(row=>row.name==='YRTK2_TOKEN').value);assert.equal(metadata.transportBindingProperties.coreManifestDigest,source.localAuthorityCapsule.coreManifestDigest);
 assert.equal(payload.documentMetadataDigest,source.documentMetadata.protectedDigest);assert.deepEqual(metadata.lossLedger.missingProtectedProperties,[]);assert.deepEqual(metadata.lossLedger.unknownCustomPropertyNames,[]);
 const verify=value=>validateFullManuscriptDocumentMetadataReturn({expected:source.documentMetadata,returned:value,signedDigest:payload.documentMetadataDigest});
 assert.equal(verify(metadata).ok,true);
 const minuteNormalized=structuredClone(metadata);minuteNormalized.coreProtectedProperties.createdAtUtc='2026-09-17T10:11:00Z';minuteNormalized.lossLedger.providerNormalizedFields=['createdAtUtc.minutePrecision'];assert.equal(verify(minuteNormalized).ok,true);
 const wrongMinute=structuredClone(minuteNormalized);wrongMinute.coreProtectedProperties.createdAtUtc='2026-09-17T10:12:00Z';assert.equal(verify(wrongMinute).ok,false);
 const volatile=structuredClone(metadata);volatile.volatileCoreProperties={lastModifiedBy:'Native Word User',modifiedAtUtc:'2026-09-18T02:03:04Z',revision:'9'};volatile.lossLedger.unknownCustomPropertyNames=['WORD_PROVIDER_PROPERTY'];assert.equal(verify(volatile).ok,true);assert.deepEqual(verify(volatile).proof.lossLedger.unknownCustomPropertyNames,['WORD_PROVIDER_PROPERTY']);
 const mutations=[
  value=>value.protectedProperties.title='Changed title',
  value=>value.protectedProperties.projectId='other-project',
  value=>value.corePropertiesPresent=false,
  value=>delete value.publicCustomProperties.YALKEN_PROJECT_TITLE,
  value=>value.protectedProperties.createdAtUtc='2026-09-17T10:11:13.000Z',
  value=>value.duplicateCustomPropertyNames=['YALKEN_PROJECT_ID'],
 ];
 for(const mutate of mutations){const changed=structuredClone(metadata);mutate(changed);assert.equal(verify(changed).ok,false);}
 const officeCoreLoss=structuredClone(metadata);
 officeCoreLoss.coreProtectedProperties.projectId='';
 officeCoreLoss.coreProtectedProperties.title='';
 officeCoreLoss.lossLedger.missingCoreProtectedProperties=['projectId','title'];
 assert.equal(verify(officeCoreLoss).ok,false);
 const verifyOffice=value=>validateFullManuscriptDocumentMetadataReturn({
   expected:source.documentMetadata,returned:value,
   signedDigest:payload.documentMetadataDigest,allowAdvisoryCoreOmissions:true,
 });
 const degraded=verifyOffice(officeCoreLoss);
 assert.equal(degraded.ok,true);
 assert.equal(degraded.status,'VERIFIED_SIGNED_DOCUMENT_METADATA_WITH_CORE_OMISSIONS');
 assert.equal(degraded.proof.coreMetadataPreserved,false);
 assert.deepEqual(degraded.proof.coreOmissions,['projectId','title']);
 for(const mutate of [
   value=>value.coreProtectedProperties.projectId='forged-project',
   value=>value.coreProtectedProperties.creator='forged-creator',
   value=>value.coreProtectedProperties.createdAtUtc='2026-09-18T01:03:00Z',
   value=>value.publicCustomProperties.YALKEN_PROJECT_ID='forged-project',
   value=>value.duplicateCorePropertyNames=['title'],
 ]){const changed=structuredClone(officeCoreLoss);mutate(changed);assert.equal(verifyOffice(changed).ok,false);}
 assert.equal(validateFullManuscriptDocumentMetadataReturn({
   expected:source.documentMetadata,returned:officeCoreLoss,
   signedDigest:'sha256:'+'0'.repeat(64),allowAdvisoryCoreOmissions:true,
 }).ok,false);
 assert.equal(validateFullManuscriptDocumentMetadataReturn({expected:source.documentMetadata,returned:metadata,signedDigest:'sha256:'+'0'.repeat(64)}).ok,false);
 const withUnknown=buildDocxReviewPacketBuffer({...source,customProperties:[...source.customProperties,{name:'WORD_PROVIDER_PROPERTY',value:'account me'}]});
 const parsedUnknown=bridge.buildDocxReviewTransportAnalysisFromZipBytes({bytes:withUnknown},{cryptoPort});
 assert.deepEqual(parsedUnknown.reviewIr.documentMetadata.lossLedger.unknownCustomPropertyNames,['WORD_PROVIDER_PROPERTY']);
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

test('Read-only manuscript tree exposes registered part/chapter/scene hierarchy in physical order',async t=>{
 const root=await fsp.mkdtemp(path.join(os.tmpdir(),'manuscript-tree-'));t.after(()=>fsp.rm(root,{recursive:true,force:true}));
 const roman=path.join(root,'roman'),nodes={};
 for(const [relative,kind] of [['01_part','part'],['01_part/01_chapter','chapter-folder'],['01_part/01_chapter/02_second.txt','scene'],['01_part/01_chapter/01_first.txt','scene']]){
  const target=path.join(roman,relative);if(kind==='scene')await fsp.writeFile(target,'text');else await fsp.mkdir(target,{recursive:true});nodes[relative]={bindingKey:'file:roman/'+relative,kind,present:true};
 }
 const outside=path.join(root,'outside');await fsp.mkdir(outside);await fsp.writeFile(path.join(outside,'secret.txt'),'private');await fsp.symlink(outside,path.join(roman,'02_link'));nodes.link={bindingKey:'file:roman/02_link',kind:'part',present:true};
 const context=vm.createContext({path,readProjectManifest:async()=>({manifest:{treeIdentity:{nodes}}}),toProjectTreeBindingKey:(base,p)=>'file:'+path.relative(base,p),buildNode:n=>n,readDirectoryEntries:async dir=>(await fsp.readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name)).map(e=>({name:e.name,baseName:e.name.replace(/^\d+_/,'').replace(/\.txt$/,''),path:path.join(dir,e.name),isDirectory:e.isDirectory(),isFile:e.isFile()}))});
 vm.runInContext(source.match(/async function buildAuthoredRomanTree\([^]*?\n}/)[0],context);
 const tree=JSON.parse(JSON.stringify(await context.buildAuthoredRomanTree(roman,'fixture')));
 assert.equal(tree.length,1);assert.equal(tree[0].kind,'part');assert.equal(tree[0].children[0].kind,'chapter-folder');assert.deepEqual(tree[0].children[0].children.map(n=>[n.kind,n.name]),[['scene','first'],['scene','second']]);
});

test('Comment admission rejects missing hops, weak controls, lost tombstones and fabricated no-write evidence',async()=>{
 const {validateManuscriptCommentProof:check}=await import(pathToFileURL(path.join(ROOT,'scripts/ops/rtk-interop-word-manuscript-batch.mjs')));
 const h=ch=>ch.repeat(64),rounds=[{exportSha256:h('a'),returnedSha256:h('b')}];
 const stage={messageCount:4,threadCount:2,intentionalDeletionCount:1,artifactSha256:h('a'),semanticSha256:h('c'),
  partsSha256:Object.fromEntries(['comments','commentsExtended','commentsIds','commentsExtensible'].map(n=>[n,h('d')]))};
 const controls=['missing-root','missing-reply','body-whitespace','wrong-author','wrong-date','wrong-utc-namespace','wrong-parent','wrong-status','wrong-anchor','missing-reference','duplicate-identity','deleted-reappeared'];
 const p={sourceKind:'OWNED_SAVED_PROJECT_FIXTURE',canonicalApplyClaim:false,sourceStateSha256:h('e'),scope:'Unit oracle fixture, no product admission',
  stages:Object.fromEntries(['rounds/1/export','rounds/1/word','rounds/1/review-probe','reexport','final-word-lifecycle'].map(n=>[n,{...structuredClone(stage),artifactSha256:n==='rounds/1/word'?h('b'):h('a')}])),
  queries:Object.fromEntries(['source-comments','rounds/1/comments','reopened-comments'].map(n=>[n,{rawStateSha256:h('e'),querySha256:h('f')}])),
  negativeControls:controls.map(id=>({id,rejected:true,sha256:digest(Buffer.from(id))})),
  lossControl:{sourceSha256:h('b'),mutantSha256:h('c'),intakeSha256:h('d'),canonicalStateSha256:h('e'),writerCalled:false,
   missing:['open','resolved'].map(s=>({threadId:'manuscript-comment-'+s,canonicalCommentId:'manuscript-comment-'+s+'-root',code:'COMMENT_ROOT_MISSING'}))},
  intentionalDeletionLedger:[{threadId:'manuscript-comment-deleted',status:'deleted',messageCount:2,outcome:'CANONICAL_DELETION_NOT_EXPORTED'}]};
 assert.equal(check(p,1,rounds),true);
 for(const mutate of [x=>delete x.stages['final-word-lifecycle'],x=>delete x.queries['reopened-comments'],x=>x.canonicalApplyClaim=true,
  x=>x.stages.reexport.semanticSha256=h('0'),x=>delete x.stages.reexport.partsSha256.commentsIds,x=>x.queries['reopened-comments'].rawStateSha256=h('0'),
  x=>x.negativeControls.pop(),x=>x.negativeControls[0].rejected=false,x=>x.negativeControls[0].sha256=x.negativeControls[1].sha256,
  x=>x.lossControl.writerCalled=true,x=>x.lossControl.mutantSha256=x.lossControl.sourceSha256,x=>x.lossControl.missing.pop(),
  x=>x.intentionalDeletionLedger=[],x=>x.stages['rounds/1/word'].artifactSha256=h('0'),x=>x.sourceStateSha256='count-only']){
  const bad=structuredClone(p);mutate(bad);assert.throws(()=>check(bad,1,rounds));
 }
 assert.throws(()=>check(p,5,rounds));
});

test('Metadata admission binds dual OOXML carriers, intake no-write state and seven corruptions',async()=>{
 const {validateManuscriptMetadataProof:check}=await import(pathToFileURL(path.join(ROOT,'scripts/ops/rtk-interop-word-manuscript-batch.mjs')));
 const h=value=>crypto.createHash('sha256').update(value).digest('hex'),stable=value=>Array.isArray(value)?`[${value.map(stable).join(',')}]`:value&&typeof value==='object'?`{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`:JSON.stringify(value),protectedProperties={schemaVersion:'yalken.rtk.word.document-metadata.v1',projectId:'project-unit',title:'Роман',createdAtUtc:'2026-09-18T01:02:03.000Z',creator:'Yalken'};
 const protectedDigest='sha256:'+h(stable(protectedProperties)),publicCustomProperties={YALKEN_METADATA_SCHEMA:protectedProperties.schemaVersion,YALKEN_METADATA_POLICY:'CANONICAL_PROJECT_METADATA_PROTECTED_PROVIDER_VOLATILE_V1',YALKEN_PROJECT_ID:protectedProperties.projectId,YALKEN_PROJECT_TITLE:protectedProperties.title,YALKEN_PROJECT_CREATED_AT_UTC:protectedProperties.createdAtUtc,YALKEN_APPLICATION_CREATOR:protectedProperties.creator,YALKEN_METADATA_DIGEST:protectedDigest};
 const policies={authorship:'APPLICATION_CREATOR_IS_YALKEN_PROJECT_AUTHOR_NOT_INFERRED',timestamps:'PROJECT_CREATED_AT_PROTECTED_MODIFIED_AT_PROVIDER_VOLATILE',returnedAuthority:'ADVISORY_ONLY_NO_PROJECT_METADATA_WRITE',unknownCustomProperties:'LEDGER_ONLY_NO_AUTHORITY',policyId:'CANONICAL_PROJECT_METADATA_PROTECTED_PROVIDER_VOLATILE_V1'};
 const stage=artifactSha256=>({artifactSha256,protectedDigest,protectedProperties,coreProtectedProperties:{projectId:protectedProperties.projectId,title:protectedProperties.title,createdAtUtc:'2026-09-18T01:02:00Z',creator:protectedProperties.creator},publicCustomProperties,createdTimestampType:'dcterms:W3CDTF',corePropertiesPresent:true,customPropertiesPresent:true,duplicateCorePropertyNames:[],duplicateCustomPropertyNames:[],missingProtectedProperties:[],missingCoreProtectedProperties:[],unknownCustomPropertyNames:[],providerVolatileFields:['lastModifiedBy','modifiedAtUtc','revision'],providerNormalizedFields:['createdAtUtc.minutePrecision'],volatileCoreProperties:{lastModifiedBy:'Word User',modifiedAtUtc:'2026-09-18T02:03:04Z',revision:'9'}});
 const exportSha=h('export'),returnedSha=h('returned'),state={sceneHashes:[h('scene')],manifestSha256:h('manifest')},ids=['changed-title','changed-project-id','changed-created-at','missing-core-part','missing-custom-property','duplicate-protected-property','forged-signed-digest'];
 const p={schemaVersion:'WORD_MANUSCRIPT_METADATA_PROOF_V1',authority:'ADVISORY_ONLY_NO_PROJECT_METADATA_WRITE',policies,expected:{protectedProperties,protectedDigest,publicCustomProperties},stages:{'rounds/1/export':stage(exportSha),'rounds/1/word':stage(returnedSha),reexport:stage(h('reexport')),'final-word-lifecycle':stage(h('final'))},intakeBindings:[{ordinal:1,status:'VERIFIED_PROTECTED_DOCUMENT_METADATA',authority:'ADVISORY_ONLY_NO_PROJECT_METADATA_WRITE',protectedDigest,protectedProperties,before:[h('scene')],after:[h('scene')],manifestSha256:h('manifest'),writerCalled:false}],negativeControls:ids.map(id=>({id,rejected:true,code:['missing-core-part','forged-signed-digest'].includes(id)?'RTK_RETURN_INTAKE_PACKAGE_BLOCKED':'RTK_RETURN_INTAKE_DOCUMENT_METADATA_MISMATCH',mismatches:['missing-core-part','forged-signed-digest'].includes(id)?[]:['protected'],mutantSha256:h('mutant-'+id),intakeSha256:h('intake-'+id),canonicalStateSha256:h('state-'+id),writerCalled:false,before:state,after:structuredClone(state)})),lossLedger:{missingProtectedProperties:[],missingCoreProtectedProperties:[],duplicateCorePropertyNames:[],duplicateCustomPropertyNames:[],unknownCustomPropertyNames:[],providerVolatileFields:['lastModifiedBy','modifiedAtUtc','revision'],providerNormalizedFieldsObserved:['createdAtUtc.minutePrecision'],providerNormalizationPolicy:'WORD_CORE_CREATED_AT_MINUTE_PRECISION_CUSTOM_PROPERTY_RETAINS_EXACT',scope:'unit proof'}};
 const rounds=[{exportSha256:exportSha,returnedSha256:returnedSha}];assert.equal(check(p,1,rounds),true);
 for(const mutate of [x=>delete x.stages.reexport,x=>x.stages['rounds/1/word'].artifactSha256=h('wrong'),x=>x.expected.protectedProperties.title='Other',x=>x.intakeBindings[0].after=[],x=>x.negativeControls.pop(),x=>x.negativeControls[0].before.sceneHashes=[],x=>x.lossLedger.providerVolatileFields.pop()]){const bad=structuredClone(p);mutate(bad);assert.throws(()=>check(bad,1,rounds));}
});

test('Section admission binds canonical boundaries, protected geometry, no-write intake and seven corruptions',async()=>{
 const {validateManuscriptSectionsProof:check,MANUSCRIPT_SECTION_CONTROL_CODES:controlCodes}=await import(pathToFileURL(path.join(ROOT,'scripts/ops/rtk-interop-word-manuscript-batch.mjs')));
 const h=value=>crypto.createHash('sha256').update(value).digest('hex'),stable=value=>Array.isArray(value)?`[${value.map(stable).join(',')}]`:value&&typeof value==='object'?`{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`:JSON.stringify(value);
 const properties={type:'nextPage',pageSize:{widthTwips:11906,heightTwips:16838,orientation:'portrait'},margins:{topTwips:1440,rightTwips:1440,bottomTwips:1440,leftTwips:1440,headerTwips:720,footerTwips:720,gutterTwips:0},columns:{count:1,spaceTwips:720}};
 const protectedSections=[[0,1],[2,3],[4,5]].map(([startParagraphIndex,endParagraphIndex],ordinal)=>({ordinal,startParagraphIndex,endParagraphIndex,breakPlacement:ordinal===2?'BODY_FINAL':'PARAGRAPH_PROPERTIES',carriers:{sectionProperties:true,pageSize:true,margins:true,columns:true},properties:structuredClone(properties)}));
 const schemaVersion='yalken.rtk.word.document-sections.v1',protectedDigest='sha256:'+h(stable({schemaVersion,protectedSections}));
 const sourceBindings=protectedSections.map((_,ordinal)=>({ordinal,sectionId:'section-'+String(ordinal+1).padStart(3,'0')+'-'+h('chapter-'+ordinal).slice(0,12),groupKey:'roman/part/chapter-'+ordinal,sceneIds:['roman/part/chapter-'+ordinal+'/scene.txt']}));
 const policies={policyId:'CANONICAL_SCENE_GROUPS_TO_WORD_SECTIONS_V1',sourceAuthority:'CANONICAL_ORDERED_SCENE_DIRECTORY_GROUPS',returnedAuthority:'ADVISORY_ONLY_NO_PROJECT_STRUCTURE_WRITE',providerExtensions:'LOSS_LEDGER_ONLY_NO_AUTHORITY'};
 const expected={schemaVersion,protectedSections,protectedDigest,sourceBindings,policies},artifact=value=>h(value),stage=value=>({artifactSha256:artifact(value),schemaVersion,protectedSections:structuredClone(protectedSections),protectedDigest,providerExtensionElements:[]});
 const exportSha=artifact('export'),returnedSha=artifact('returned'),state={sceneHashes:[artifact('scene')],manifestSha256:artifact('manifest')},ids=Object.keys(controlCodes);
 const p={schemaVersion:'WORD_MANUSCRIPT_SECTIONS_PROOF_V1',authority:'ADVISORY_ONLY_NO_PROJECT_STRUCTURE_WRITE',policies,expected,
  stages:{'rounds/1/export':stage('export'),'rounds/1/word':stage('returned'),reexport:stage('reexport'),'final-word-lifecycle':stage('final')},
  intakeBindings:[{ordinal:1,status:'VERIFIED_PROTECTED_DOCUMENT_SECTIONS',authority:'ADVISORY_ONLY_NO_PROJECT_STRUCTURE_WRITE',protectedDigest,protectedSections,sourceBindings,before:state,after:structuredClone(state),manifestSha256:state.manifestSha256,writerCalled:false}],
  negativeControls:ids.map(id=>({id,rejected:true,code:controlCodes[id],mutantSha256:artifact('mutant-'+id),intakeSha256:artifact('intake-'+id),canonicalStateSha256:artifact('state-'+id),writerCalled:false,before:state,after:structuredClone(state)})),
  lossLedger:{providerExtensionElementsObserved:[],scope:'unit proof'}};
 assert.equal(check(p,'MULTI_SCENE',1,[{exportSha256:exportSha,returnedSha256:returnedSha}]),true);
 for(const mutate of [x=>delete x.stages.reexport,x=>x.expected.protectedSections[0].endParagraphIndex=2,x=>x.intakeBindings[0].after.sceneHashes=[],x=>x.negativeControls.pop(),x=>x.negativeControls[0].writerCalled=true,x=>x.negativeControls[1].code='RTK_RETURN_INTAKE_DOCUMENT_SECTIONS_MISMATCH',x=>x.lossLedger.scope='']){const bad=structuredClone(p);mutate(bad);assert.throws(()=>check(bad,'MULTI_SCENE',1,[{exportSha256:exportSha,returnedSha256:returnedSha}]));}
});

test('Manuscript admission preserves 306 legacy targets and adds eight separately qualified C1 table targets',async()=>{
 const m=await import(pathToFileURL(path.join(ROOT,'scripts/ops/rtk-interop-word-manuscript-batch.mjs')));
 const f=await import(pathToFileURL(path.join(ROOT,'scripts/ops/rtk-interop-word-manuscript-fixtures.mjs')));
 const d=await import(pathToFileURL(path.join(ROOT,'scripts/ops/rtk-interop-100-denominator-v1.mjs')));
 const spec=d.readInterop100Denominator(ROOT),cells=d.buildRequiredCells(spec);
 assert.equal(cells.length,1120);assert.equal(f.MANUSCRIPT_CELLS.length,314);assert.equal(new Set(f.MANUSCRIPT_CELLS).size,314);
 for(const id of f.MANUSCRIPT_CELLS)assert.ok(cells.some(c=>c.cellId===id),id);
 for(const route of ['C1','C2','C3','C5'])assert.deepEqual(m.MANUSCRIPT_HOPS[route],spec.routes.find(r=>r.id===route).hops);
 assert.throws(()=>m.validateManuscriptRuns(['ORDER__LARGE_DOCUMENT__C5__SOURCE_RUNTIME__not-qualified']));
 assert.deepEqual(f.manuscriptFields('MULTI_SCENE','C5'),['TEXT','ORDER','UNICODE_IME_LOCALE']);
 const run='ORDER__MULTI_SCENE__C3__SOURCE_RUNTIME__contract';assert.equal(m.validateManuscriptRuns([run]).length,1);
 for(const runs of [[],[run,run+'repeat'],[run.replace('C3','C4')],[run.replace('ORDER','STYLES')],[run+'../escape'],[null]])assert.throws(()=>m.validateManuscriptRuns(runs));
 const row=m.validateManuscriptRuns([run])[0],obs={type:'PHYSICAL_OBSERVATION',runId:run,cellId:row.cellId,recipe:'DEFAULT',artifactHash:'a'.repeat(64)};
 assert.equal(m.selectManuscriptObservation([obs],row),obs);
 for(const ledger of [[],[obs,obs],[obs,{type:'EVIDENCE_SUPERSEDES',supersedesRunId:run}],[obs,{type:'PRIVACY_INVALIDATED',runId:run}]])assert.throws(()=>m.selectManuscriptObservation(ledger,row));
 for(const extra of [{wordTextOrderLabRoot:ROOT},{wordTextOrderRunIds:[run]},{spec},{ledger:[]},{dataC1RunId:run},{orderRunId:run},{textOrderRunId:run},{freshC1EvidenceRoot:ROOT},{requireExternalEvidencePackage:true}]){
  const result=d.verifyInterop100(ROOT,{wordManuscriptLabRoot:ROOT,wordManuscriptRunIds:[run],...extra});assert.equal(result.passedRequiredCells,0);assert.equal(result.authoritativeAdmission,false);assert.ok(result.errors.includes('WORD_MANUSCRIPT_MODE_OPTIONS_CONFLICT'));
 }
});

test('Manuscript verifier promotion preserves evidence only across allowlisted descendant verifier changes',async t=>{
 const root=await fsp.mkdtemp(path.join(os.tmpdir(),'manuscript-verifier-promotion-'));t.after(()=>fsp.rm(root,{recursive:true,force:true}));
 const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
 git('init');git('config','user.email','test@example.invalid');git('config','user.name','Yalken Test');
 await fsp.writeFile(path.join(root,'product.txt'),'runtime-v1\n');await fsp.writeFile(path.join(root,'oracle.txt'),'oracle-v1\n');git('add','.');git('commit','-m','base');
 const identity=()=>({head:git('rev-parse','HEAD'),tree:git('rev-parse','HEAD^{tree}')}),runtimeIdentity=identity();
 await fsp.writeFile(path.join(root,'oracle.txt'),'oracle-v2\n');git('add','oracle.txt');git('commit','-m','verifier only');const verifierIdentity=identity();
 const {validateManuscriptVerifierPromotion:check}=await import(pathToFileURL(path.join(ROOT,'scripts/ops/rtk-interop-word-manuscript-batch.mjs')));
 assert.deepEqual(check({repoRoot:root,runtimeIdentity,verifierIdentity,allowedPaths:['oracle.txt']}),['oracle.txt']);
 for(const bad of [[],['/oracle.txt'],['../oracle.txt'],['oracle.txt','oracle.txt']])assert.throws(()=>check({repoRoot:root,runtimeIdentity,verifierIdentity,allowedPaths:bad}));
 assert.throws(()=>check({repoRoot:root,runtimeIdentity,verifierIdentity,allowedPaths:['product.txt']}),/PROMOTION_SCOPE/);
 await fsp.writeFile(path.join(root,'product.txt'),'runtime-v2\n');git('add','product.txt');git('commit','-m','runtime changed');
 assert.throws(()=>check({repoRoot:root,runtimeIdentity,verifierIdentity:identity(),allowedPaths:['oracle.txt']}),/PROMOTION_SCOPE/);
 git('checkout','-b','divergent',runtimeIdentity.head);await fsp.writeFile(path.join(root,'oracle.txt'),'oracle-divergent\n');git('add','oracle.txt');git('commit','-m','divergent verifier');
 assert.throws(()=>check({repoRoot:root,runtimeIdentity:verifierIdentity,verifierIdentity:identity(),allowedPaths:['oracle.txt']}),/PROMOTION_NOT_DESCENDANT/);
});

test('C1 review return cannot replace safe-create fields, reuse a recipe or masquerade as another route',async()=>{
 const m=await import(pathToFileURL(path.join(ROOT,'scripts/ops/rtk-interop-word-manuscript-batch.mjs')));
 const f=await import(pathToFileURL(path.join(ROOT,'scripts/ops/rtk-interop-word-manuscript-fixtures.mjs')));
 const runs=[];
 for(const volume of f.MANUSCRIPT_VOLUMES)for(const route of f.MANUSCRIPT_ROUTES)for(const profile of f.MANUSCRIPT_PROFILES){
  if(volume==='LARGE_DOCUMENT'&&route==='C5')continue;
  const base=`ORDER__${volume}__${route}__${profile}__`;
  runs.push(base+'unit');
  if(route==='C1'){
   runs.push(base+'review-return-unit');
   assert.deepEqual(f.manuscriptFields(volume,route),['TEXT','ORDER','UNICODE_IME_LOCALE','STYLES']);
   assert.deepEqual(f.manuscriptFields(volume,route,f.C1_REVIEW_RECIPE),[...(volume==='SINGLE_SCENE'?[]:['NOVEL_SCENE_STRUCTURE']),'TRACKED_REVIEW_SEMANTICS','COMMENTS','IDENTIFIERS_ANCHORS','METADATA','SECTIONS','NOTES','FOOTNOTES_ENDNOTES']);
   assert.equal(f.manuscriptUsesSafeCreate(route),true);assert.equal(f.manuscriptUsesSafeCreate(route,f.C1_REVIEW_RECIPE),false);
  }else assert.throws(()=>f.buildWordManuscriptFixture(volume,route,f.C1_REVIEW_RECIPE),/MANUSCRIPT_RECIPE/);
 }
 const rows=m.validateManuscriptRuns(runs);assert.equal(rows.length,38);
 const cellIds=rows.flatMap(r=>f.manuscriptFields(r.volume,r.route,r.recipe).map(field=>`${field}__${r.volume}__${r.route}__${r.profile}`));
 assert.equal(new Set(cellIds).size,300);assert.equal(cellIds.length,300);
 const review=rows.find(r=>r.recipe===f.C1_REVIEW_RECIPE);
 for(const bad of [[review.runId,review.runId+'repeat'],[review.runId.replace('__C1__','__C2__')]])assert.throws(()=>m.validateManuscriptRuns(bad));
 for(const recipe of ['',null,'review','DEFAULT_OTHER'])assert.throws(()=>f.manuscriptFields('SINGLE_SCENE','C1',recipe),/MANUSCRIPT_RECIPE/);
 const obs={type:'PHYSICAL_OBSERVATION',runId:review.runId,cellId:review.cellId,recipe:'DEFAULT'};
 assert.throws(()=>m.selectManuscriptObservation([obs],review),/EXACT_OBSERVATION/);
 assert.equal(m.manuscriptStages('C1')['imported-raw'],0);
 assert.equal(m.manuscriptStages('C1',f.C1_REVIEW_RECIPE)['rounds/1/persisted'],1);
 assert.equal(m.manuscriptStages('C1',f.C1_REVIEW_RECIPE)['imported-raw'],undefined);
});

test('single-scene structure uses a distinct review recipe and never upgrades legacy observations',async()=>{
 const m=await import(pathToFileURL(path.join(ROOT,'scripts/ops/rtk-interop-word-manuscript-batch.mjs')));
 const f=await import(pathToFileURL(path.join(ROOT,'scripts/ops/rtk-interop-word-manuscript-fixtures.mjs')));
 const expected=[];
 for(const route of ['C1','C2','C3'])for(const profile of f.MANUSCRIPT_PROFILES){
  const id=`NOVEL_SCENE_STRUCTURE__SINGLE_SCENE__${route}__${profile}`;
  expected.push(id);
  assert.deepEqual(f.manuscriptFields('SINGLE_SCENE',route,f.SINGLE_STRUCTURE_RECIPE),['NOVEL_SCENE_STRUCTURE']);
  assert.equal(f.manuscriptUsesSafeCreate(route,f.SINGLE_STRUCTURE_RECIPE),false);
  const fixture=f.buildWordManuscriptFixture('SINGLE_SCENE',route,f.SINGLE_STRUCTURE_RECIPE);
  assert.equal(fixture.scenes.length,1);
  assert.equal(fixture.scenes[0].chapter,0);
  const run=`ORDER__SINGLE_SCENE__${route}__${profile}__structure-v2-unit`;
  const row=m.validateManuscriptRuns([run])[0];
  assert.equal(row.recipe,f.SINGLE_STRUCTURE_RECIPE);
  assert.equal(row.cellId,`ORDER__SINGLE_SCENE__${route}__${profile}`);
  assert.throws(()=>m.validateManuscriptRuns([run,run.replace('unit','other')]),/DUPLICATE_JOURNEY/);
 }
 assert.deepEqual(expected.sort(),f.MANUSCRIPT_CELLS.filter(id=>id.startsWith('NOVEL_SCENE_STRUCTURE__SINGLE_SCENE__')).sort());
 assert.equal(new Set(f.MANUSCRIPT_CELLS).size,314);
 assert.deepEqual(f.manuscriptFields('SINGLE_SCENE','C1'),['TEXT','ORDER','UNICODE_IME_LOCALE','STYLES']);
 assert.deepEqual(f.manuscriptFields('SINGLE_SCENE','C2'),['TEXT','ORDER','UNICODE_IME_LOCALE','STYLES','TRACKED_REVIEW_SEMANTICS','COMMENTS','IDENTIFIERS_ANCHORS','METADATA','SECTIONS','NOTES','FOOTNOTES_ENDNOTES']);
});

test('independent raw reader completes a bounded request without waiting for pipe EOF',async()=>{
 const payload=Buffer.from('{}');
 const frame=Buffer.alloc(4+payload.length);
 frame.writeUInt32BE(payload.length,0);payload.copy(frame,4);
 const child=spawn('python3',['-I','-B',path.join(ROOT,'scripts/ops/rtk-interop-word-manuscript-readback.py')],{stdio:['pipe','pipe','pipe']});
 let timer;
 try{
  const response=await new Promise((resolve,reject)=>{
   timer=setTimeout(()=>reject(new Error('RAW_READER_WAITED_FOR_EOF')),2000);
   child.once('error',reject);
   child.stdout.once('data',resolve);
   child.stdin.write(frame);
  });
  const parsed=JSON.parse(String(response));
  assert.equal(parsed.ok,false);
  assert.notEqual(parsed.error,'REQUEST_SIZE');
 }finally{clearTimeout(timer);child.kill();}
});

test('Lab CDP source-app revision is admitted only by a complete exact code-binding set',()=>{
 const policyPath='docs/OPS/RTK/YALKEN_INTEROP_DATA_C1_POLICY_V1.json';
 const baselineSha='2c4b35d20a22d6bd3dbdfc9b732da0dc160c8c31';
 const baseline=JSON.parse(execFileSync('git',['show',`${baselineSha}:${policyPath}`],{cwd:ROOT,encoding:'utf8'}));
 const policy=JSON.parse(fs.readFileSync(path.join(ROOT,policyPath),'utf8'));
 for(const previous of baseline.labCodeBindingSets){
  assert.deepEqual(policy.labCodeBindingSets.find(set=>set.id===previous.id),previous,`preserve ${previous.id}`);
 }
 const setId='WORD_MANUSCRIPT_CDP_SOURCE_APP_V1';
 const matches=policy.labCodeBindingSets.filter(set=>set.id===setId);
 assert.equal(matches.length,1);
 const expected=structuredClone(baseline.labCodeBindingSets.find(set=>set.id==='WORD_CANONICAL_NOTES_ROUNDTRIP_V1'));
 expected.id=setId;
 const helperPath='src/m1-text-single-scene-source-runtime.mjs';
 const helper=expected.bindings.find(binding=>binding.path===helperPath);
 assert.ok(helper);
 helper.sha256='70c7324296225ca143246b3fb54e508c348a830f57a25b3ecfe1fcc0e002a68c';
 assert.deepEqual(matches[0],expected);
 const verifier=fs.readFileSync(path.join(ROOT,'scripts/ops/rtk-interop-word-manuscript-batch.mjs'),'utf8');
 const labRevision=verifier.match(/function labRevision\(labRoot,revision,policy\)\{[^]*?\n\}/u)?.[0]||'';
 assert.match(labRevision,/bindingSets\.some\(bindings=>Array\.isArray\(bindings\)&&bindings\.every\(b=>/u);
 const pinnedBytes=new Map(expected.bindings.map(binding=>[binding.path,binding.sha256]));
 const matchesWholeSet=()=>expected.bindings.every(binding=>pinnedBytes.get(binding.path)===binding.sha256);
 assert.equal(matchesWholeSet(),true);
 pinnedBytes.set(helperPath,'0'.repeat(64));
 assert.equal(matchesWholeSet(),false,'one changed helper byte hash must reject the entire binding set');
});

test('Lab native-CUA manuscript revision requires the exact new identity set and two support paths',()=>{
 const policyPath='docs/OPS/RTK/YALKEN_INTEROP_DATA_C1_POLICY_V1.json';
 const baselineSha='fe1c69e7046da8fa17d6715941816b0a229864e1';
 const baseline=JSON.parse(execFileSync('git',['show',`${baselineSha}:${policyPath}`],{cwd:ROOT,encoding:'utf8'}));
 const policy=JSON.parse(fs.readFileSync(path.join(ROOT,policyPath),'utf8'));
 const expected={id:'WORD_MANUSCRIPT_NATIVE_IDENTITY_V1',bindings:[
  {path:'cli/lab.mjs',sha256:'150b9ef5b2ffa34d70f38ea24fe8d2502ea525e625e086aaec5e9aab51840ba6'},
  {path:'scripts/run_sequential.py',sha256:'f5e5092590f6444fa06102a378a8c04cf607fbd61574ba8be8d68c1bd5d660d2'},
  {path:'src/m1-text-single-scene-source-runtime.mjs',sha256:'87ad8cb5899a2b5f2a86f2787977bd1b31d6f1ccf0b06a2350546bcd5754726f'},
  {path:'src/c1-data-case.mjs',sha256:'6fe3fc064fd2ae032c2c9f79893bd6be8fce9b55fbcbe0c8e96f94af4fcd7680'},
  {path:'src/data-c1-machine-review.mjs',sha256:'162f4b13d31a3891b931117cff46b43f497c636362701fe11397e6b0f6ec59fd'},
  {path:'src/m0-validators.mjs',sha256:'6e4c3d1a0ac5d6fb183abe95387ea1ca052b2e7ebb6157a3aeb20bc942c15dc9'},
  {path:'src/order-single-scene.mjs',sha256:'50ca1e1bda1f8240c61e80225113c99ce94ed624bb5b1eef797401471ecd2ab2'},
  {path:'src/order-machine-review.mjs',sha256:'bc7b86387ec4ec3f612646b42abdf9c5fc97b1cf61f3ad265bd31a09b66a2351'},
  {path:'src/text-order-machine-review.mjs',sha256:'cf18ba8ebb051781fb3736186b9829931ac6aaa6248379ceab9726d8997c20fb'},
  {path:'scripts/check-physical-run.mjs',sha256:'ef16dbc87b3e5e1a6cf758b8759015077b4de6c93597535552b3a9a548eea11b'},
  {path:'src/word-volume-text-order.mjs',sha256:'f3919aa7878e4f5b14603184381de6290116dbceb2896ed3f439b676407dfe22'},
  {path:'src/word-manuscript-fields.mjs',sha256:'1813227f46e61c120a135736a316b277bd3f55b439ff9f358120bf4adffa37d1'},
  {path:'src/word-metadata-mutant.py',sha256:'e7658e0e7e8eecd51580d3bf0e710aaea3dbcedf131fc13fb22b311736b1eeeb'},
  {path:'src/word-sections-mutant.py',sha256:'c82868e8479ea1e71ddddcee3f820d08ecf8564fa3467bd7c2691ff0ef14c5df'},
  {path:'test/m0-audit-repair.test.mjs',sha256:'4492e13f5ba945c1205dec1fb46518a6835ab3e62392f3d4157bab769f4ed403'},
  {path:'test/word-manuscript-fields.test.mjs',sha256:'21accb28802ea0696cebbd3c9e26f891658e70a61736be1a62113d7257e306a4'},
  {path:'src/word-notes-mutant.py',sha256:'cd128e05ee6d080a12ab8f5009f7b9ef5d36fffaeb30c363613008028b12f40c'},
  {path:'scripts/native-cua-target.mjs',sha256:'0ca57312401750018eb459cc70c9930592deae74be601cda33703e6effbf259a'},
  {path:'test/native-cua-target.test.mjs',sha256:'da4dea27274e93ac5ceb74e8cbb78f1c22deb73f7a255631fdecf898c2175285'}
 ]};
 const supportPaths=['scripts/native-cua-target.mjs','test/native-cua-target.test.mjs','src/word-table-readback.mjs','test/word-table-readback.test.mjs','test/fixtures/word-tables-native-v1.json'];
 const matchesExactAdmission=candidate=>{
  const sets=candidate.labCodeBindingSets.filter(set=>set.id===expected.id);
  return sets.length===1&&JSON.stringify(sets[0])===JSON.stringify(expected)
   &&candidate.labCodeBindingSets.length>=baseline.labCodeBindingSets.length+1
   &&JSON.stringify(candidate.allowedLabDeltaPaths)==JSON.stringify([...baseline.allowedLabDeltaPaths,...supportPaths]);
 };
 for(const previous of baseline.labCodeBindingSets){
  assert.deepEqual(policy.labCodeBindingSets.find(set=>set.id===previous.id),previous,`preserve ${previous.id}`);
 }
 assert.equal(matchesExactAdmission(policy),true);
 const structureSets=policy.labCodeBindingSets.filter(set=>set.id==='WORD_SINGLE_STRUCTURE_V2');
 assert.equal(structureSets.length,1);
 const expectedStructure=structuredClone(expected);
 expectedStructure.id='WORD_SINGLE_STRUCTURE_V2';
 expectedStructure.bindings.find(b=>b.path==='src/word-manuscript-fields.mjs').sha256='ae82c51632b0c8abd5ca330a688b889044fdb96679066c298739a85cd5f8db66';
 assert.deepEqual(structureSets[0],expectedStructure);
 const mutants=[
  candidate=>candidate.labCodeBindingSets.find(set=>set.id===expected.id).bindings.pop(),
  candidate=>candidate.labCodeBindingSets.find(set=>set.id===expected.id).bindings[0].sha256='0'.repeat(64),
  candidate=>candidate.labCodeBindingSets.find(set=>set.id===expected.id).bindings.push({...expected.bindings[0]}),
  candidate=>candidate.labCodeBindingSets.push(structuredClone(expected)),
  candidate=>candidate.allowedLabDeltaPaths.pop(),
  candidate=>candidate.allowedLabDeltaPaths.push('src/main.js')
 ];
 for(const mutate of mutants){const candidate=structuredClone(policy);mutate(candidate);assert.equal(matchesExactAdmission(candidate),false);}
});

test('Independent manuscript Python tests reject semantic, style, structure and caller-authority corruption',()=>{
 const {spawnSync}=require('node:child_process');const child=spawnSync('python3',['-I','-B','test/unit/rtk-interop-word-manuscript.test.py'],{cwd:ROOT,encoding:'utf8',timeout:30000});
 assert.equal(child.status,0,child.stdout+child.stderr);assert.match(child.stderr,/Ran [1-9][0-9]* tests/);assert.match(child.stderr,/\nOK\n/);
});

test('Current C5 direct transport is scoped to manuscript evidence and cannot rewrite frozen V1 qualification',async()=>{
 const m=await import(pathToFileURL(path.join(ROOT,'scripts/ops/rtk-interop-word-manuscript-batch.mjs')));
 const d=await import(pathToFileURL(path.join(ROOT,'scripts/ops/rtk-interop-100-denominator-v1.mjs')));
 const policy=JSON.parse(fs.readFileSync(path.join(ROOT,'docs/OPS/RTK/YALKEN_INTEROP_DATA_C1_POLICY_V1.json'))),p=policy.wordManuscriptBatch.googleNativeTransport;
 const spec=d.readInterop100Denominator(ROOT),specSha256=digest(fs.readFileSync(path.join(ROOT,'docs/OPS/RTK/YALKEN_INTEROP_100_DENOMINATOR_V1.json')));
 const resolved=m.validateGoogleManuscriptTransport(p,spec,specSha256);
 assert.deepEqual(resolved,{status:'SCOPED_C5_CURRENT_TRANSPORT',evidenceMode:m.MANUSCRIPT_BATCH_MODE,route:'C5',
  archivedDenominatorSha256:specSha256,archivedSourceReferenceKind:'INTERNAL_UPLOADED_FILE_REFERENCE',
  currentSourceReferenceKind:'ABSOLUTE_LOCAL_FILE_PATH',routeQualificationCountsAsCellPass:false});
 assert.equal(specSha256,p.supersedesArchivedTransportAssumption.specSha256);
 assert.equal(spec.providerTransportPolicy.googleLocalDocxToNativeImport.directLocalPathImport.supported,false);
 assert.equal(p.directLocalPathImport.supported,true);
 assert.equal(p.directLocalPathImport.countsAsPass,false);
 const genericSpec=structuredClone(spec);genericSpec.providerTransportPolicy.googleLocalDocxToNativeImport.directLocalPathImport.supported=true;
 const generic=d.validateInterop100({spec:genericSpec,envelope:d.readInterop100EvidenceEnvelope(ROOT),ledger:d.readInterop100EvidenceLedger(ROOT),currentHead:spec.bindingBaseSha,repoRoot:ROOT});
 assert.equal(generic.ok,false);assert.ok(generic.errors.includes('GOOGLE_DIRECT_LOCAL_PATH_IMPORT_MUST_NOT_BE_SUPPORTED'));
 for(const mutate of [p=>p.transportResolutionStatus='ALL_GOOGLE_ROUTES',p=>p.directLocalPathImport.countsAsPass=true,p=>p.directLocalPathImport.supported=false,p=>p.requiredSteps.pop(),p=>p.routeQualificationCountsAsCellPass=true,p=>p.createdDriveFilesCleanup='OPTIONAL',p=>p.productRuntimeNetworkPolicy='NETWORK_ENABLED',p=>p.externalConnectorUse='USER_DOCUMENTS',p=>p.supersedesArchivedTransportAssumption.retainsHistoricalStagingReceipt=false,p=>p.scope='All Google routes',p=>p.historicalStagingQualification.requiredSteps.pop(),p=>p.historicalStagingQualification.stillCountsAsCellPass=true]){
  const changed=structuredClone(p);mutate(changed);assert.throws(()=>m.validateGoogleManuscriptTransport(changed,spec,specSha256),/GOOGLE_TRANSPORT_POLICY/);
 }
 for(const mutate of [s=>s.providerTransportPolicy.googleLocalDocxToNativeImport.directLocalPathImport.supported=true,s=>s.providerTransportPolicy.googleLocalDocxToNativeImport.sourceReferenceKind='ABSOLUTE_LOCAL_FILE_PATH',s=>s.providerTransportPolicy.googleLocalDocxToNativeImport.requiredSteps.pop()]){
  const changed=structuredClone(spec);mutate(changed);assert.throws(()=>m.validateGoogleManuscriptTransport(p,changed,specSha256),/GOOGLE_TRANSPORT_POLICY/);
 }
});

test('Manuscript raw consumer rejects incomplete rounds, missing fields and coherently relabelled proof',async()=>{
 const m=await import(pathToFileURL(path.join(ROOT,'scripts/ops/rtk-interop-word-manuscript-batch.mjs'))),f=await import(pathToFileURL(path.join(ROOT,'scripts/ops/rtk-interop-word-manuscript-fixtures.mjs')));
 const run='ORDER__SINGLE_SCENE__C1__SOURCE_RUNTIME__test',row=m.validateManuscriptRuns([run])[0],h='a'.repeat(64),head='b'.repeat(40),tree='c'.repeat(40);
 const policy={requiredOracles:['unit-validator-fixture'],wordManuscriptBatch:{semanticStyleSha256:h,paragraphHashes:{SINGLE_SCENE:{C1:[{sha256:h,count:15}]}}}};
 const ids=['swap-paragraphs','delete-empty','trim-spaces','corrupt-unicode','drop-final-paragraph','duplicate-paragraph','swap-scenes','truncate-half','corrupt-last-scene','normalize-nfd','remove-bidi-isolate','remove-ime-character'];
 const stageProofs=Object.fromEntries(Object.entries(m.manuscriptStages('C1')).map(([k,round])=>[k,{round,paragraphCount:15,paragraphSha256:h,sortKeysSha256:h}]));
 const unicodeProof={probes:f.UNICODE_PROBES,compositionEventsSha256:h,locale:{language:'ru',languages:['ru'],intl:{locale:'ru',timeZone:'Europe/Helsinki'}},providerLocale:{locale:'ru',languages:['ru']},fontLedger:Array.from({length:3},()=>({fonts:[{glyphCount:1}],scope:'Chromium actual platform fonts'})),limitations:{ime:'Bounded Chromium composition',fonts:'Actual glyph fallback'}};
 const raw={ok:true,schemaVersion:'WORD_MANUSCRIPT_RAW_READBACK_V1',admissionCredit:0,runId:run,recipe:'DEFAULT',productHead:head,productTree:tree,observationSha256:h,filesVerified:1,roundProofs:[{ordinal:1,exportId:'export-a',roundId:'round-a',exportSha256:h,returnedSha256:h,savedSceneHashes:[h]}],finalHops:{ok:true,acceptanceCredit:0},fieldProofs:['TEXT','ORDER','UNICODE_IME_LOCALE','STYLES'].map(field=>({field,cellId:field+'__SINGLE_SCENE__C1__SOURCE_RUNTIME',runId:run,status:'PASS',subcases:m.MANUSCRIPT_SUBCASES[field],requiredHops:m.MANUSCRIPT_HOPS.C1,requiredCycles:1,oracles:policy.requiredOracles,stageProofs,unicodeProof,styleProofs:Object.fromEntries(['rounds/1/export','rounds/1/word','reexport','final-word-lifecycle'].map(k=>[k,{semanticStyleSha256:h,stylePartsSha256:{'word/styles.xml':h,'word/numbering.xml':h}}])),unsupportedStylesDeclared:'Fixed supported corpus',controls:{positiveControls:['identity','split-xml-runs'],textMutants:ids.map((id,i)=>({id,rejected:true,sha256:crypto.createHash('sha256').update(String(i)).digest('hex')})),styleMutants:['remove-bold','change-align','change-heading','change-font','change-number-start','remove-code-style','remove-quote-style'].map((id,i)=>({id,rejected:true,sha256:crypto.createHash('sha256').update('style'+i).digest('hex')})),structureMutants:[]}}))};
 const options={row,head,tree,observationSha256:h,files:[{}],policy};assert.equal(m.validateManuscriptRaw(raw,options),true);
 const tableRun=run.replace('__test','__tables-v1-test'),tableRow=m.validateManuscriptRuns([tableRun])[0];
 const tableRaw=structuredClone(raw);tableRaw.runId=tableRun;tableRaw.recipe=f.TABLES_RECIPE;
 const field={...tableRaw.fieldProofs[0],field:'TABLES',cellId:'TABLES__SINGLE_SCENE__C1__SOURCE_RUNTIME',runId:tableRun,subcases:m.MANUSCRIPT_SUBCASES.TABLES};
 const graphStages=['rounds/1/export','rounds/1/word','imported','saved','reopened','reexport','final-word-lifecycle'];
 field.tableProof={schemaVersion:'WORD_TABLES_INDEPENDENT_PROOF_V1',expectedGraphSha256:h,stages:{
  ...Object.fromEntries(graphStages.map(name=>[name,{graphSha256:h,artifactSha256:h,tableCount:2}])),
  ...Object.fromEntries(['rounds/1/word-native','final-word-lifecycle-native'].map(name=>[name,{method:'INDEPENDENT_NATIVE_CELLS_AND_COMPLETE_BODY_V1',bodySha256:h,indexSha256:h,tableCount:2,cellHashes:Array(16).fill(h)}]))},
  negativeControls:['drop-cell','swap-rows','swap-columns','remove-grid-span','break-vertical-merge','flatten-table'].map((id,i)=>({id,rejected:true,sha256:crypto.createHash('sha256').update('table'+i).digest('hex')})),
  lossLedger:{lostCells:[],flattenedTables:[],changedMerges:[],profile:'RECTANGULAR_CELLS_WITH_GRIDSPAN_VMERGE_AND_LITERAL_PARAGRAPHS'}};
 tableRaw.fieldProofs=[field];
 const tableOptions={...options,row:tableRow,policy:{...policy,wordManuscriptBatch:{...policy.wordManuscriptBatch,tableParagraphHashes:{SINGLE_SCENE:[{sha256:h,count:15}]},tableGraphHashes:{SINGLE_SCENE:h}}}};
 assert.equal(m.validateManuscriptRaw(tableRaw,tableOptions),true);
 for(const mutate of [r=>delete r.fieldProofs[0].tableProof,r=>r.fieldProofs[0].tableProof.negativeControls.pop(),
  r=>delete r.fieldProofs[0].tableProof.stages['final-word-lifecycle-native'],r=>r.fieldProofs[0].tableProof.stages.saved.graphSha256='e'.repeat(64),
  r=>r.fieldProofs[0].tableProof.stages['rounds/1/word-native'].cellHashes.pop(),r=>r.fieldProofs[0].tableProof.lossLedger.lostCells.push(1)]){
  const changed=structuredClone(tableRaw);mutate(changed);assert.throws(()=>m.validateManuscriptRaw(changed,tableOptions));
 }
 assert.throws(()=>m.validateManuscriptRuns([tableRun.replace('__C1__','__C2__')]),/MANUSCRIPT_RECIPE/);

 const mutants=[r=>delete r.recipe,r=>r.recipe='C1_REVIEW_RETURN',r=>r.admissionCredit=3,r=>r.productHead='d'.repeat(40),r=>r.filesVerified=0,r=>r.roundProofs=[],r=>r.roundProofs[0].ordinal=5,r=>r.fieldProofs.pop(),r=>r.fieldProofs[0].requiredCycles=5,r=>r.fieldProofs[0].subcases.pop(),r=>delete r.fieldProofs[0].stageProofs['reopened-renderer'],r=>r.fieldProofs[0].stageProofs.source.paragraphSha256='e'.repeat(64),r=>r.fieldProofs[0].controls.textMutants[0].rejected=false,r=>r.fieldProofs[0].unicodeProof.fontLedger=[],r=>r.finalHops=null,r=>delete r.fieldProofs[0].stageProofs['reexport-docx'],r=>r.fieldProofs[0].controls.styleMutants.pop(),r=>r.fieldProofs.at(-1).styleProofs.reexport.semanticStyleSha256='f'.repeat(64)];
 for(const mutate of mutants){const changed=JSON.parse(JSON.stringify(raw));mutate(changed);assert.throws(()=>m.validateManuscriptRaw(changed,options));}
});

for(const mutation of ['missing','corrupt','wrong-project','wrong-path','symbolic-link','hard-link','directory-link'])test('Durable manifest succession rejects '+mutation+' after fresh authority restart',async t=>{
 const root=await fsp.mkdtemp(path.join(os.tmpdir(),'manifest-proof-negative-'));t.after(()=>fsp.rm(root,{recursive:true,force:true}));
 const {createMainProjectManifestAuthority}=await import(pathToFileURL(path.join(ROOT,'src/product/mainProjectManifestAuthority.mjs')));
 const anchorRoot=path.join(root,'anchors'),manifestPath=path.join(root,'project.json'),projectId='fixture-project',a=JSON.stringify({projectId,n:0}),b=JSON.stringify({projectId,n:1}),c=JSON.stringify({projectId,n:2});
 const authority=createMainProjectManifestAuthority({anchorRoot,useLeaseHeartbeatWorker:false});await fsp.writeFile(manifestPath,a);
 await authority.commitManifestText({projectId,targetPath:manifestPath,expectedText:a,nextText:b});await authority.commitManifestText({projectId,targetPath:manifestPath,expectedText:b,nextText:c});
 const fresh=createMainProjectManifestAuthority({anchorRoot,useLeaseHeartbeatWorker:false});const req={projectId,manifestPath,fromDigest:digest(a),toDigest:digest(c)};assert.equal((await fresh.verifyManifestContinuation(req)).ok,true);
 const dir=path.join(anchorRoot,'manifest-transitions',digest(projectId+'\0'+manifestPath),digest(a)),file=path.join(dir,digest(b)+'.json');const before=await fsp.readFile(file,'utf8');
 if(mutation==='missing')await fsp.unlink(file);
 if(mutation==='corrupt')await fsp.writeFile(file,'{broken');
 if(mutation==='wrong-project'||mutation==='wrong-path'){const value=JSON.parse(before);value[mutation==='wrong-project'?'projectId':'targetPath']='other';await fsp.writeFile(file,JSON.stringify(value));}
 if(mutation==='symbolic-link'){const other=path.join(root,'other.json');await fsp.writeFile(other,before);await fsp.unlink(file);await fsp.symlink(other,file);}
 if(mutation==='hard-link')await fsp.link(file,path.join(root,'hard.json'));
 if(mutation==='directory-link'){const other=path.join(root,'other-dir');await fsp.rename(dir,other);await fsp.symlink(other,dir);}
 assert.equal((await fresh.verifyManifestContinuation(req)).ok,false);assert.equal(await fsp.readFile(manifestPath,'utf8'),c);
});

test('Uncommitted cross-scene transaction rolls back safely through a fresh authority',async t=>{
 const root=await fsp.mkdtemp(path.join(os.tmpdir(),'manifest-proof-recovery-'));t.after(()=>fsp.rm(root,{recursive:true,force:true}));
 const {createMainProjectManifestAuthority}=await import(pathToFileURL(path.join(ROOT,'src/product/mainProjectManifestAuthority.mjs')));
 const {recoverProjectTransaction}=require('../../src/core/project-transaction-v1.cjs');
 const anchorRoot=path.join(root,'anchors'),manifestPath=path.join(root,'project.json'),projectId='fixture-project',scenes=['a','b'].map(n=>path.join(root,n+'.txt'));
 let authority=createMainProjectManifestAuthority({anchorRoot,useLeaseHeartbeatWorker:false});await fsp.writeFile(manifestPath,JSON.stringify({projectId,n:0}));for(const p of scenes)await fsp.writeFile(p,'initial');
 const verifyManifestContinuation=req=>authority.verifyManifestContinuation({...req,projectId});
 const publish=({manifestPath:targetPath,expectedText,nextText})=>authority.commitManifestText({projectId,targetPath,expectedText,nextText});
 const commit=async(i,n,publishManifest=publish)=>commitProjectTransaction({scenePath:scenes[i],sceneContent:'edited-'+n,expectedSceneContent:await fsp.readFile(scenes[i],'utf8'),manifestPath,expectedManifestContent:await fsp.readFile(manifestPath,'utf8'),manifestContent:JSON.stringify({projectId,n}),revision:n,verifyManifestContinuation,publishManifest});
 await commit(0,1);await commit(1,2);
 await assert.rejects(commit(0,3,async args=>{await publish(args);throw new Error('simulated interruption after manifest publication');}),/simulated interruption/);
 authority=createMainProjectManifestAuthority({anchorRoot,useLeaseHeartbeatWorker:false});
 const recovered=await recoverProjectTransaction({scenePath:scenes[0],manifestPath,verifyManifestContinuation,publishManifest:publish});
 assert.equal(recovered.outcome,'UNCOMMITTED_ROLLED_BACK');assert.equal(await fsp.readFile(scenes[0],'utf8'),'edited-1');assert.equal(JSON.parse(await fsp.readFile(manifestPath,'utf8')).n,2);assert.equal((await commit(1,4)).success,true);
});


test('Flat manuscript chapter-file supports atomic Word apply and following Save without admitting non-body files',async t=>{
 const h=await harness(t,{contextKind:'chapter-file'});assert.equal((await h.save('saved before Word',1)).success,true);
 const {writeMarkdownWithTransactionRecovery}=await import(pathToFileURL(path.join(ROOT,'src/io/markdown/index.mjs')));
 await writeMarkdownWithTransactionRecovery(h.scenePath,'returned from Word',{publishScene:h.publish,expectedText:'saved before Word'});
 assert.equal((await h.save('returned from Word',8)).success,true);assert.equal(await fsp.readFile(h.scenePath,'utf8'),'returned from Word');
 for(const kind of ['external','roman-section','material','reference']){
  h.context.getDocumentContextFromPath=()=>({kind});await assert.rejects(h.publish(h.scenePath,'forbidden',{expectedText:'returned from Word'}),e=>e.code==='E_REVIEW_PROJECT_SCENE_BINDING_REQUIRED');assert.equal(await fsp.readFile(h.scenePath,'utf8'),'returned from Word');
 }
});

for(const code of ['EISDIR','EINVAL','EPERM','EIO'])test('Manifest transition retains existing directory-sync policy for '+code,async t=>{
 const root=await fsp.mkdtemp(path.join(os.tmpdir(),'manifest-sync-policy-'));t.after(()=>fsp.rm(root,{recursive:true,force:true}));
 const {createMainProjectManifestAuthority}=await import(pathToFileURL(path.join(ROOT,'src/product/mainProjectManifestAuthority.mjs')));
 const anchorRoot=path.join(root,'anchors'),targetPath=path.join(root,'project.json'),projectId='fixture-project',before=JSON.stringify({projectId,n:0}),after=JSON.stringify({projectId,n:1});
 await fsp.writeFile(targetPath,before);const probePath=path.join(anchorRoot,'manifest-transitions',digest(projectId+'\0'+targetPath)),original=fsp.open;let reached=0;
 t.mock.method(fsp,'open',async(p,...args)=>{if(p===probePath&&args[0]==='r'){reached++;throw Object.assign(new Error('injected directory sync condition'),{code});}return original(p,...args);});
 const authority=createMainProjectManifestAuthority({anchorRoot,useLeaseHeartbeatWorker:false}),publish=()=>authority.commitManifestText({projectId,targetPath,expectedText:before,nextText:after});
 if(code==='EIO')await assert.rejects(publish(),e=>e.code==='EIO');
 else{await publish();assert.equal((await authority.verifyManifestContinuation({projectId,manifestPath:targetPath,fromDigest:digest(before),toDigest:digest(after)})).ok,true);}
 assert.equal(reached,1);assert.equal(await fsp.readFile(targetPath,'utf8'),after);
});

test('Actual intake result preserves revision metadata without sharing state, secrets or mutation authority',()=>{
 const fn=source.match(/function sanitizeDocxReviewReturnIntakeForResult\([^]*?\n}/)[0];
 const context=vm.createContext({isPlainObjectValue:v=>v!==null&&typeof v==='object'&&!Array.isArray(v),docxReviewPreviewSessionDetailString:v=>typeof v==='string'?v.trim():''});vm.runInContext(fn,context);
 const meta={nativeRevisionId:'7',author:' A é ',date:'2026-09-17T13:23:00Z',dateUtc:'2026-09-17T10:23:00Z',classification:'MANUAL_REVIEW',reasonCode:'RTK_BLOCKED_STRUCTURAL'};
 const intake={authenticated:true,returnedArtifactSha256:'sha256:'+'a'.repeat(64),canWriteStorage:true,parserResult:{reviewIr:{textRevisions:[{...meta,operation:'insert',text:'new',hmacSecret:'never-public',path:'/private/secret',canWriteStorage:true}],propertyRevisions:[{...meta,propertyKind:'rPrChange',rawXml:'do-not-publish'}]}}};
 const result=JSON.parse(JSON.stringify(context.sanitizeDocxReviewReturnIntakeForResult(intake))),p=result.reviewMetadata;
 assert.deepEqual(p.textRevisions,[{...meta,operation:'insert',text:'new'}]);assert.deepEqual(p.propertyRevisions,[{...meta,propertyKind:'rPrChange'}]);
 assert.equal(p.sourceArtifactSha256,intake.returnedArtifactSha256);assert.equal(p.authority,'ADVISORY_ONLY');assert.equal(p.timestampPolicy,'LITERAL_WORD_DATE_AND_NAMESPACED_DATE_UTC_NO_NORMALIZATION');
 for(const name of ['canAutoApply','canImportMutate','canWriteStorage'])assert.equal(result[name],false);
 assert.doesNotMatch(JSON.stringify(result),/never-public|private|do-not-publish/);
 p.textRevisions[0].author='mutated';assert.equal(intake.parserResult.reviewIr.textRevisions[0].author,' A é ');
 intake.parserResult.reviewIr.textRevisions[0].dateUtc='later';assert.equal(p.textRevisions[0].dateUtc,'2026-09-17T10:23:00Z');
 const empty=context.sanitizeDocxReviewReturnIntakeForResult({parserResult:{reviewIr:{textRevisions:[null,{author:{toString:()=> 'authority'}}]}}});
 assert.equal(empty.reviewMetadata.textRevisions.length,2);assert.equal(empty.reviewMetadata.textRevisions[1].author,'');assert.equal(empty.counts.textRevisions,2);
});

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

test('Manuscript admission targets 142 distinct frozen whole cells and five real C3 rounds',async()=>{
 const m=await import(pathToFileURL(path.join(ROOT,'scripts/ops/rtk-interop-word-manuscript-batch.mjs')));
 const f=await import(pathToFileURL(path.join(ROOT,'scripts/ops/rtk-interop-word-manuscript-fixtures.mjs')));
 const d=await import(pathToFileURL(path.join(ROOT,'scripts/ops/rtk-interop-100-denominator-v1.mjs')));
 const spec=d.readInterop100Denominator(ROOT),cells=d.buildRequiredCells(spec);
 assert.equal(cells.length,1120);assert.equal(f.MANUSCRIPT_CELLS.length,142);assert.equal(new Set(f.MANUSCRIPT_CELLS).size,142);
 for(const id of f.MANUSCRIPT_CELLS)assert.ok(cells.some(c=>c.cellId===id),id);
 for(const route of ['C1','C2','C3','C5'])assert.deepEqual(m.MANUSCRIPT_HOPS[route],spec.routes.find(r=>r.id===route).hops);
 assert.throws(()=>m.validateManuscriptRuns(['ORDER__LARGE_DOCUMENT__C5__SOURCE_RUNTIME__not-qualified']));
 assert.deepEqual(f.manuscriptFields('MULTI_SCENE','C5'),['TEXT','ORDER','UNICODE_IME_LOCALE']);
 const run='ORDER__MULTI_SCENE__C3__SOURCE_RUNTIME__contract';assert.equal(m.validateManuscriptRuns([run]).length,1);
 for(const runs of [[],[run,run+'repeat'],[run.replace('C3','C4')],[run.replace('ORDER','STYLES')],[run+'../escape'],[null]])assert.throws(()=>m.validateManuscriptRuns(runs));
 const row=m.validateManuscriptRuns([run])[0],obs={type:'PHYSICAL_OBSERVATION',runId:run,cellId:row.cellId,artifactHash:'a'.repeat(64)};
 assert.equal(m.selectManuscriptObservation([obs],row),obs);
 for(const ledger of [[],[obs,obs],[obs,{type:'EVIDENCE_SUPERSEDES',supersedesRunId:run}],[obs,{type:'PRIVACY_INVALIDATED',runId:run}]])assert.throws(()=>m.selectManuscriptObservation(ledger,row));
 for(const extra of [{wordTextOrderLabRoot:ROOT},{wordTextOrderRunIds:[run]},{spec},{ledger:[]},{dataC1RunId:run},{orderRunId:run},{textOrderRunId:run},{freshC1EvidenceRoot:ROOT},{requireExternalEvidencePackage:true}]){
  const result=d.verifyInterop100(ROOT,{wordManuscriptLabRoot:ROOT,wordManuscriptRunIds:[run],...extra});assert.equal(result.passedRequiredCells,0);assert.equal(result.authoritativeAdmission,false);assert.ok(result.errors.includes('WORD_MANUSCRIPT_MODE_OPTIONS_CONFLICT'));
 }
});

test('Independent manuscript Python tests reject semantic, style, structure and caller-authority corruption',()=>{
 const {spawnSync}=require('node:child_process');const child=spawnSync('python3',['-I','-B','test/unit/rtk-interop-word-manuscript.test.py'],{cwd:ROOT,encoding:'utf8',timeout:30000});
 assert.equal(child.status,0,child.stdout+child.stderr);assert.match(child.stderr,/Ran [1-9][0-9]* tests/);assert.match(child.stderr,/\nOK\n/);
});

test('Current Google qualification preserves archived transport bytes and cannot promote a conversion to cell credit',async()=>{
 const m=await import(pathToFileURL(path.join(ROOT,'scripts/ops/rtk-interop-word-manuscript-batch.mjs')));
 const policy=JSON.parse(fs.readFileSync(path.join(ROOT,'docs/OPS/RTK/YALKEN_INTEROP_DATA_C1_POLICY_V1.json'))),p=policy.wordManuscriptBatch.googleNativeTransport;
 assert.equal(m.validateGoogleManuscriptTransport(p),true);
 assert.equal(digest(fs.readFileSync(path.join(ROOT,'docs/OPS/RTK/YALKEN_INTEROP_100_DENOMINATOR_V1.json'))),p.supersedesArchivedTransportAssumption.specSha256);
 for(const mutate of [p=>p.directLocalPathImport.countsAsPass=true,p=>p.directLocalPathImport.supported=false,p=>p.requiredSteps.pop(),p=>p.routeQualificationCountsAsCellPass=true,p=>p.createdDriveFilesCleanup='OPTIONAL',p=>p.productRuntimeNetworkPolicy='NETWORK_ENABLED',p=>p.externalConnectorUse='USER_DOCUMENTS',p=>p.supersedesArchivedTransportAssumption.retainsHistoricalStagingReceipt=false]){
  const changed=structuredClone(p);mutate(changed);assert.throws(()=>m.validateGoogleManuscriptTransport(changed),/GOOGLE_TRANSPORT_POLICY/);
 }
});

test('Manuscript raw consumer rejects incomplete rounds, missing fields and coherently relabelled proof',async()=>{
 const m=await import(pathToFileURL(path.join(ROOT,'scripts/ops/rtk-interop-word-manuscript-batch.mjs'))),f=await import(pathToFileURL(path.join(ROOT,'scripts/ops/rtk-interop-word-manuscript-fixtures.mjs')));
 const run='ORDER__SINGLE_SCENE__C1__SOURCE_RUNTIME__test',row=m.validateManuscriptRuns([run])[0],h='a'.repeat(64),head='b'.repeat(40),tree='c'.repeat(40);
 const policy={requiredOracles:['unit-validator-fixture'],wordManuscriptBatch:{semanticStyleSha256:h,paragraphHashes:{SINGLE_SCENE:{C1:[{sha256:h,count:15}]}}}};
 const ids=['swap-paragraphs','delete-empty','trim-spaces','corrupt-unicode','drop-final-paragraph','duplicate-paragraph','swap-scenes','truncate-half','corrupt-last-scene','normalize-nfd','remove-bidi-isolate','remove-ime-character'];
 const stageProofs=Object.fromEntries(Object.entries(m.manuscriptStages('C1')).map(([k,round])=>[k,{round,paragraphCount:15,paragraphSha256:h,sortKeysSha256:h}]));
 const unicodeProof={probes:f.UNICODE_PROBES,compositionEventsSha256:h,locale:{language:'ru',languages:['ru'],intl:{locale:'ru',timeZone:'Europe/Helsinki'}},providerLocale:{locale:'ru',languages:['ru']},fontLedger:Array.from({length:3},()=>({fonts:[{glyphCount:1}],scope:'Chromium actual platform fonts'})),limitations:{ime:'Bounded Chromium composition',fonts:'Actual glyph fallback'}};
 const raw={ok:true,schemaVersion:'WORD_MANUSCRIPT_RAW_READBACK_V1',admissionCredit:0,runId:run,productHead:head,productTree:tree,observationSha256:h,filesVerified:1,roundProofs:[{ordinal:1,exportId:'export-a',roundId:'round-a',exportSha256:h,returnedSha256:h,savedSceneHashes:[h]}],finalHops:{ok:true,acceptanceCredit:0},fieldProofs:['TEXT','ORDER','UNICODE_IME_LOCALE','STYLES'].map(field=>({field,cellId:field+'__SINGLE_SCENE__C1__SOURCE_RUNTIME',runId:run,status:'PASS',subcases:m.MANUSCRIPT_SUBCASES[field],requiredHops:m.MANUSCRIPT_HOPS.C1,requiredCycles:1,oracles:policy.requiredOracles,stageProofs,unicodeProof,styleProofs:Object.fromEntries(['rounds/1/export','rounds/1/word','reexport','final-word-lifecycle'].map(k=>[k,{semanticStyleSha256:h,stylePartsSha256:{'word/styles.xml':h,'word/numbering.xml':h}}])),unsupportedStylesDeclared:'Fixed supported corpus',controls:{positiveControls:['identity','split-xml-runs'],textMutants:ids.map((id,i)=>({id,rejected:true,sha256:crypto.createHash('sha256').update(String(i)).digest('hex')})),styleMutants:['remove-bold','change-align','change-heading','change-font','change-number-start','remove-code-style','remove-quote-style'].map((id,i)=>({id,rejected:true,sha256:crypto.createHash('sha256').update('style'+i).digest('hex')})),structureMutants:[]}}))};
 const options={row,head,tree,observationSha256:h,files:[{}],policy};assert.equal(m.validateManuscriptRaw(raw,options),true);
 const mutants=[r=>r.admissionCredit=3,r=>r.productHead='d'.repeat(40),r=>r.filesVerified=0,r=>r.roundProofs=[],r=>r.roundProofs[0].ordinal=5,r=>r.fieldProofs.pop(),r=>r.fieldProofs[0].requiredCycles=5,r=>r.fieldProofs[0].subcases.pop(),r=>delete r.fieldProofs[0].stageProofs['reopened-renderer'],r=>r.fieldProofs[0].stageProofs.source.paragraphSha256='e'.repeat(64),r=>r.fieldProofs[0].controls.textMutants[0].rejected=false,r=>r.fieldProofs[0].unicodeProof.fontLedger=[],r=>r.finalHops=null,r=>delete r.fieldProofs[0].stageProofs['reexport-docx'],r=>r.fieldProofs[0].controls.styleMutants.pop(),r=>r.fieldProofs.at(-1).styleProofs.reexport.semanticStyleSha256='f'.repeat(64)];
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

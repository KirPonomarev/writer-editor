const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const vm=require('node:vm');
const {buildFormatIrParagraphs}=require('../../src/export/docx/fullManuscriptDocxReviewPacketSource.js');
const mods=Promise.all([import('../../src/io/revisionBridge/reviewTransportCleanLinkLabel.mjs'),import('../../src/renderer/documentContentEnvelope.mjs'),import('../../src/io/revisionBridge/exactTextMinSafeWrite.mjs')]);
const href='https://example.invalid/label';
function fixture(label='old label',next='новая 😀 é') {
 const doc={type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'before '},{type:'text',text:label,marks:[{type:'bold'},{type:'link',attrs:{href}}]},{type:'text',text:' after'}]}]};
 const baselineParagraphs=buildFormatIrParagraphs({sceneId:'roman/a.txt',text:'before '+label+' after',doc});
 const returnedParagraphs=baselineParagraphs.map((p,i)=>({paragraphIndex:i,paragraphText:'before '+next+' after',paragraphState:{},paragraphStructure:{},formattedRuns:[{from:0,to:7,text:'before ',inlineState:{}},{from:7,to:7+next.length,text:next,inlineState:{bold:true,link:href}},{from:7+next.length,to:13+next.length,text:' after',inlineState:{}}]}));
 return {doc,baselineParagraphs,returnedParagraphs,sceneId:'roman/a.txt',reviewIr:{textRevisions:[],opaqueUnsupported:[]}};
}

test('clean label: single Unicode semantic effect has no writer authority and preserves provenance',async()=>{
 const [m]=await mods,f=fixture(),r=m.analyzeCleanLinkLabelReturn(f);
 assert.equal(r.ok,true,JSON.stringify(r));assert.equal(r.canWriteManuscript,false);assert.equal(r.analysisOnly,true);
 assert.equal(r.change.match.quote,'old label');assert.equal(r.change.replacementText,'новая 😀 é');assert.equal(r.effect.href,href);
 assert.equal(r.change.nativeRevisionId,undefined);assert.equal(r.change.author,undefined);
});

test('clean label: split runs with identical meaning produce the same bounded label',async()=>{
 const [m]=await mods,f=fixture('old label','new label'),p=f.returnedParagraphs[0];
 const old=p.formattedRuns[1];p.formattedRuns.splice(1,1,{...old,text:'new ',to:11},{...old,text:'label',from:11});
 assert.equal(m.analyzeCleanLinkLabelReturn(f).ok,true);
});

for(const fault of ['target','style','neighbor','duplicate','unknown','tracked','comment','second','cardinality','range','grapheme','budget']) test('clean label rejects '+fault,async()=>{
 const [m]=await mods,f=fixture();const p=f.returnedParagraphs[0];
 if(fault==='target')p.formattedRuns[1].inlineState.link='https://example.invalid/other';
 if(fault==='style')p.formattedRuns[1].inlineState.bold=false;
 if(fault==='neighbor')p.formattedRuns[0].text='BEFORE ';
 if(fault==='duplicate'){f.baselineParagraphs.push(structuredClone(f.baselineParagraphs[0]));f.returnedParagraphs.push(structuredClone(p));}
 if(fault==='unknown')p.formattedRuns[1].unsupportedNames=['vanish'];
 if(fault==='tracked')f.reviewIr.textRevisions=[{operation:'insert',text:'x'}];
 if(fault==='comment')f.reviewIr.commentThreads=[{id:'c'}];
 if(fault==='second'){f.baselineParagraphs.push(fixture('other','changed').baselineParagraphs[0]);f.returnedParagraphs.push(fixture('other','changed').returnedParagraphs[0]);}
 if(fault==='cardinality')f.returnedParagraphs.push(p);
 if(fault==='range')p.formattedRuns[1].from++;
 if(fault==='grapheme'){const g=fixture('\u0301','x');g.baselineParagraphs[0].formatIr.runs[0].text='beforea';g.baselineParagraphs[0].text='beforea\u0301 after';Object.assign(f,g);}
 if(fault==='budget')f.baselineParagraphs=Array(257).fill(f.baselineParagraphs[0]);
 const r=m.analyzeCleanLinkLabelReturn(f);assert.equal(r.ok,false,JSON.stringify(r));assert.equal(r.canWriteManuscript,false);
});

test('clean label uses real rich writer, restart readback, replay and stale baseline rejection',async t=>{
 const [m,e,w]=await mods,f=fixture(),r=m.analyzeCleanLinkLabelReturn(f);assert.equal(r.ok,true);
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'yalken-clean-label-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const scenePath=path.join(root,'roman/a.txt');fs.mkdirSync(path.dirname(scenePath));
 const before=e.composeObservablePayload({doc:f.doc,metaEnabled:false});fs.writeFileSync(scenePath,before);
 const input={projectRoot:root,projectSnapshot:{projectId:'label-test',baselineHash:'baseline',scenes:[{sceneId:f.sceneId,text:before}]},revisionSession:{projectId:'label-test',sessionId:'label-session',baselineHash:'baseline',status:'open',reviewGraph:{textChanges:[r.change]}},reviewItems:[r.change],scenePath,scenePathBySceneId:{[f.sceneId]:scenePath}};
 const result=await w.applyExactTextBatchMinSafeWrite(input,{operationId:'op_clean_label_test'});assert.equal(result.applied,true,JSON.stringify(result));
 const after=fs.readFileSync(scenePath,'utf8'),parsed=e.parseObservablePayload(after);
 assert.equal(parsed.text,'before новая 😀 é after');assert.deepEqual(parsed.doc.content[0].content,[f.doc.content[0].content[0],{...f.doc.content[0].content[1],text:'новая 😀 é'},f.doc.content[0].content[2]]);
 const replay=await w.applyExactTextBatchMinSafeWrite(input,{operationId:'op_clean_label_test'});assert.equal(replay.status,'replay');assert.equal(fs.readFileSync(scenePath,'utf8'),after);
 fs.writeFileSync(scenePath,before+'local drift');const blocked=await w.applyExactTextBatchMinSafeWrite(input,{operationId:'op_clean_label_stale'});assert.notEqual(blocked.applied,true);assert.equal(fs.readFileSync(scenePath,'utf8'),before+'local drift');
});

function extracted(name) {
 const source=fs.readFileSync(path.join(__dirname,'../../src/main.js'),'utf8');
 const start=source.indexOf('function '+name+'('),asyncStart=source.slice(start-6,start)==='async '?start-6:start;
 const end=source.indexOf('\n}\n',start)+3;assert(start>=0&&end>start);return source.slice(asyncStart,end);
}
for(const fault of ['none','forged','revoked','session-during-key','project','dirty'])test('clean label main queued authority '+fault,async()=>{
 const input={projectRoot:'/synthetic/project',scenePath:'/synthetic/project/roman/a.txt',reviewItems:[{changeId:'docx-clean-link-label-test',replacementText:'bound'}]};
 const store={input,sessionToken:{sessionId:'s',sourcePacketHash:'p'},intakeGeneration:7,keyAuthority:{keyRef:'k',roundId:'r'}};
 const sandbox={activeRtkCleanLinkLabelApplyStore:store,activeReviewSessionLifecycle:'active',activeReviewSessionStore:{sessionId:'s',sourcePacketHash:'p'},activeDocxReviewIntakeGeneration:7,isDirty:fault==='dirty',autoSaveInProgress:false,currentFilePath:input.scenePath,getProjectRootPath:()=>fault==='project'?'/different':input.projectRoot,readRtkNonOverlapTrackedReplacementSessionToken:s=>s,resolveDocxReviewRoundKeyHandle:async()=>{if(fault==='session-during-key')sandbox.activeDocxReviewIntakeGeneration++;return {state:fault==='revoked'?'REVOKED':'ACTIVE'};}};
 vm.createContext(sandbox);vm.runInContext(extracted('cleanLinkLabelStoreMatches')+'\n'+extracted('revalidateCleanLinkLabelApplyInput'),sandbox);
 const supplied=structuredClone(input);if(fault==='forged')supplied.reviewItems[0].replacementText='unbound';
 const result=await sandbox.revalidateCleanLinkLabelApplyInput(supplied);assert.equal(result.ok,fault==='none');
});

test('real parser accounts only balanced inert hyperlink instructions, never orphan or arbitrary fields',async()=>{
 const [m]=await mods,b=await import('../../src/io/revisionBridge/index.mjs');
 const {buildStoredZip}=require('../../src/export/docx/docxMinBuilder.js');
 const crypto=require('node:crypto'),hash=x=>crypto.createHash('sha256').update(x).digest('hex');
 const cryptoPort={sha256Text:hash,sha256Json:x=>hash(JSON.stringify(x)),byteLength:x=>Buffer.byteLength(x)};
 const W='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
 for(const kind of ['valid','arbitrary','orphan','unbalanced','nested']) {
  const instruction=kind==='arbitrary'?'DATE':`HYPERLINK "${href}"`;
  const controls=kind==='orphan'?`<w:r><w:instrText>${instruction}</w:instrText></w:r>`:
   '<w:r><w:fldChar w:fldCharType="begin"/></w:r>'+(kind==='nested'?'<w:r><w:fldChar w:fldCharType="begin"/></w:r>':'')+`<w:r><w:instrText>${instruction}</w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r>`;
  const xml=`<w:document xmlns:w="${W}"><w:body><w:p><w:r><w:t>before </w:t></w:r>${controls}<w:r><w:rPr><w:b/></w:rPr><w:t>new label</w:t></w:r>${kind==='unbalanced'||kind==='orphan'?'':'<w:r><w:fldChar w:fldCharType="end"/></w:r>'}<w:r><w:t> after</w:t></w:r></w:p></w:body></w:document>`;
  const parts={'word/document.xml':xml,'[Content_Types].xml':'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>','_rels/.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="doc" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'};
  const analysis=b.buildDocxReviewTransportAnalysisFromZipBytes({bytes:buildStoredZip(Object.entries(parts).map(([name,data])=>({name,data})))},{cryptoPort});
  const f=fixture('old label','new label');f.returnedParagraphs=analysis.reviewIr.formattingParagraphs;f.reviewIr=analysis.reviewIr;
  const r=m.analyzeCleanLinkLabelReturn(f);assert.equal(r.ok,kind==='valid',JSON.stringify({kind,r,reasons:analysis.reasons}));
  if(kind==='valid') {
   assert.equal(f.returnedParagraphs[0].inertHyperlinkInstructions.length,1);
   f.returnedParagraphs[0].inertHyperlinkInstructions[0].openStart++;
   assert.equal(m.analyzeCleanLinkLabelReturn(f).ok,false);
  }
 }
});

 test('writer failure summary exposes only bounded codes without private diagnostics',()=>{
 const box={isPlainObjectValue:v=>v!==null&&typeof v==='object'&&!Array.isArray(v),cloneJsonSafe:structuredClone};vm.createContext(box);vm.runInContext(extracted('summarizeReviewExactTextBatchSafeWriteResult'),box);
 const summarize=box.summarizeReviewExactTextBatchSafeWriteResult;
 assert.equal(summarize({reasons:[{errorCode:'E_SCENE_CAS_MISMATCH'}]}).writerFailureCode,'E_SCENE_CAS_MISMATCH');
 for(const errorCode of ['/private/secret','secret message','X'.repeat(129),null])assert.equal(summarize({reasons:[{errorCode}]}).writerFailureCode,'');
 assert.equal(summarize({}).writerFailureCode,'');
 });

for (const mode of ['success','rollback','restart','stale','publisher-reject']) test('formatting/text transaction continuity: '+mode,async t=>{
 const crypto=require('node:crypto');
 const digest=v=>crypto.createHash('sha256').update(String(v)).digest('hex');
 const canonical=v=>Array.isArray(v)?'['+v.map(canonical).join(',')+']':v&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}':JSON.stringify(v);
 const cryptoPort={sha256Text:digest,sha256Json:v=>'sha256:'+digest(canonical(v)),byteLength:v=>Buffer.byteLength(String(v))};
 const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'label-continuity-')));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 fs.mkdirSync(path.join(root,'roman'));const paths={'scene-a':path.join(root,'roman/a.txt'),'scene-b':path.join(root,'roman/b.txt')};
 for(const [id,p] of Object.entries(paths))fs.writeFileSync(p,id==='scene-a'?'Alpha scene':'Beta scene');
 const manifestPath=path.join(root,'project.json');fs.writeFileSync(manifestPath,JSON.stringify({projectId:'project-formatting-n3'}));
 const fixtureSource=fs.readFileSync(path.join(__dirname,'rtk-word-n3-formatting-return.contract.test.js'),'utf8');
 const start=fixtureSource.indexOf('function runtimeInput('),end=fixtureSource.indexOf('\nfunction runtimeProject',start);
 const box={fs,cryptoPort};vm.createContext(box);vm.runInContext(fixtureSource.slice(start,end),box);const input=box.runtimeInput(root,paths);
 const runtime=await import('../../src/io/revisionBridge/reviewTransportFormattingReturnRuntime.mjs');
 const {commitProjectTransaction,recoverProjectTransaction}=require('../../src/core/project-transaction-v1.cjs');
 const {createMainProjectManifestAuthority}=await import('../../src/product/mainProjectManifestAuthority.mjs');
 const authority=createMainProjectManifestAuthority({anchorRoot:path.join(root,'anchors'),useLeaseHeartbeatWorker:false});
 const verifyManifestContinuation=r=>authority.verifyManifestContinuation({...r,projectId:input.projectId});
 const publishManifest=({manifestPath:targetPath,expectedText,nextText})=>authority.commitManifestText({projectId:input.projectId,targetPath,expectedText,nextText});
 let revision=0,calls=0,fixtureReady=false;
 const publishScene=async(file,content,options)=>{
  calls++;if(fixtureReady&&mode==='publisher-reject')return {ok:0};
  if(options.beforeRename)await options.beforeRename();
  const manifest=fs.readFileSync(manifestPath,'utf8');
  const receipt=await commitProjectTransaction({scenePath:file,sceneContent:content,expectedSceneContent:options.expectedText,manifestPath,manifestContent:manifest,expectedManifestContent:manifest,revision:++revision,publishManifest,verifyManifestContinuation});
  assert.equal(receipt.success,true);return {ok:1,receipt};
 };
 // Establish real pre-existing commit records, exactly as an imported project has.
 for(const p of Object.values(paths))await publishScene(p,fs.readFileSync(p,'utf8'),{expectedText:fs.readFileSync(p,'utf8')});calls=0;fixtureReady=true;
 const options={cryptoPort,publishScene};
 if(mode==='rollback')options.beforeSceneWrite=({index})=>{if(index===1)throw Error('INJECTED_SECOND_SCENE_FAILURE');};
 if(mode==='restart')options.simulateAbruptFailureAtSceneIndex=0;
 if(mode==='stale')options.beforeAtomicSceneRename=()=>{fs.writeFileSync(paths['scene-a'],'concurrent author text');};
 let result;
 if(mode==='restart'){
  await assert.rejects(runtime.applyMultiSceneFormattingReturnRuntime(input,options),/SIMULATED_ABRUPT_PROCESS_EXIT/);
  result=await runtime.reconcileFormattingReturnRuntimeAtStartup({projectRoot:root,projectId:input.projectId,scenePathBySceneId:paths,startupSingleInstanceAuthority:true},{cryptoPort,publishScene});assert.equal(result.ok,true,JSON.stringify(result));
 }else result=await runtime.applyMultiSceneFormattingReturnRuntime(input,options);
 if(mode==='success'){
  assert.equal(result.status,'applied',JSON.stringify(result));assert.equal(calls,2);
  const [,envelope]=await mods;const before=fs.readFileSync(paths['scene-a'],'utf8');assert.equal(envelope.parseObservablePayload(before).doc.content[0].content[0].marks[0].type,'bold');
  await publishScene(paths['scene-a'],before.replace('Alpha','Omega'),{expectedText:before});
 }else if(mode==='stale'){assert.equal(result.ok,false);assert.equal(fs.readFileSync(paths['scene-a'],'utf8'),'concurrent author text');}
 else {assert.equal(fs.readFileSync(paths['scene-a'],'utf8'),'Alpha scene');if(mode!=='restart')assert.equal(result.ok,false);}
 if(mode!=='stale')for(const p of Object.values(paths))await recoverProjectTransaction({scenePath:p,manifestPath,publishManifest,verifyManifestContinuation});
});

'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const model=require('../../src/core/word-list-numbering-v1.cjs');
const envelope=require('../../src/core/document-content-envelope-v1.cjs');
const levels=[{format:'1',start:3,text:'%1)',restartAfterLevel:null}];
const changed=[{...levels[0],text:'Article %1'}];
const list=(id,text,extra={})=>({type:'orderedList',attrs:{start:3,type:'1',wordNumbering:{schemaVersion:1,instanceId:id,lineageId:'shared',level:0,levels,...extra}},content:[{type:'listItem',content:[{type:'paragraph',content:[{type:'text',text}]}]}]});
const document=()=>({type:'doc',content:[list('a','before'),list('b','reset',{startOverrides:[{level:0,start:9}]}),list('a','after')]});
const operation=()=>({kind:'list-numbering',operationId:'numbering-op',sceneId:'scene',sourceAuthority:'authenticated-full-manuscript-export-map-list-numbering-v1',sourceSceneRevision:`sha256:${'a'.repeat(64)}`,sourceRawSha256:`sha256:${'b'.repeat(64)}`,numbering:{instanceId:'a',expectedLevels:levels,levels:changed}});
test('formatting Apply changes complete authenticated lineage, preserves text/reset events and rejects stale replay',async()=>{
 const {applyFormattingOperationsToObservableContent:apply}=await import('../../src/io/revisionBridge/reviewTransportFormattingReturnRuntime.mjs');
 const raw=envelope.composeObservablePayload({doc:document()}),result=apply(raw,[operation()]);assert.equal(result.ok,true,JSON.stringify(result));
 assert.equal(envelope.parseObservablePayload(result.content).text,envelope.parseObservablePayload(raw).text);
 assert.deepEqual([...model.resolveMarkers(result.doc).values()].flatMap(v=>v.items.map(i=>i.label)),['Article 3','Article 9','Article 10']);
 assert.deepEqual(result.doc.content[1].attrs.wordNumbering.startOverrides,[{level:0,start:9}]);
 assert.equal(apply(result.content,[operation()]).code,'RTK_FORMATTING_NUMBERING_CONFLICT');
 assert.equal(apply(raw,[operation(),{...operation(),operationId:'another',numbering:{...operation().numbering,instanceId:'b'}}]).code,'RTK_FORMATTING_NUMBERING_DUPLICATE_OPERATION');
});
test('formatting numbering refuses foreign selector, authority, definitions, getters and forged extension keys',async()=>{
 const {applyFormattingOperationsToObservableContent:apply}=await import('../../src/io/revisionBridge/reviewTransportFormattingReturnRuntime.mjs');
 const raw=envelope.composeObservablePayload({doc:document()});let calls=0;
 for(const mutate of [op=>op.numbering.instanceId='foreign',op=>op.numbering.instanceId='shared',op=>op.sourceAuthority='renderer',op=>op.sourceRawSha256='',op=>op.numbering.extra='authority',op=>op.numbering.levels[0].text='%2',op=>Object.defineProperty(op.numbering,'levels',{get(){calls++;return changed;}})]){
  const op=structuredClone(operation());mutate(op);assert.equal(apply(raw,[op]).ok,false);
 }
 assert.equal(calls,0);
});
test('actual Main public preview preserves exact numbering diff without private writer authority',()=>{
 const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
 const source=fs.readFileSync(path.resolve(__dirname,'../../src/main.js'),'utf8');
 const start=source.indexOf('function attachRtkFormattingReturnProductPreview('),end=source.indexOf('function prepareAuthenticatedDocxFormattingReturnProductPath(',start);
 const clone=value=>JSON.parse(JSON.stringify(value));
 const context=vm.createContext({activeReviewSessionLifecycle:'active',activeReviewSessionStore:{reviewSurface:{}},activeRtkFormattingReturnApplyStore:null,
  currentReviewSurfacePayload:null,currentReviewSurfacePayloadSource:'',currentReviewSurfacePayloadContentHash:'',
  isPlainObjectValue:value=>value&&typeof value==='object'&&!Array.isArray(value),cloneJsonSafe:clone,
  docxReviewPreviewSessionDetailString:value=>typeof value==='string'?value:'',
  readRtkNonOverlapTrackedReplacementSessionToken:()=>({sessionId:'s',sourcePacketHash:'hash'}),sanitizeRtkFormattingReturnDiagnostics:()=>[],
  readActiveReviewSessionReviewSurface:()=>context.currentReviewSurfacePayload});
 vm.runInContext(source.slice(start,end),context);
 const op=operation(),input={operations:[op]},result=context.attachRtkFormattingReturnProductPreview({input,candidates:[op],diagnostics:[],keyAuthority:{keyRef:'private'}});
 const publicOp=clone(result.formattingReturnPreview.operations[0]);assert.equal(publicOp.kind,'list-numbering');assert.deepEqual(publicOp.numbering,op.numbering);
 for(const key of ['sourceAuthority','sourceSceneRevision','sourceRawSha256','keyRef'])assert.equal(Object.hasOwn(publicOp,key),false);
 result.formattingReturnPreview.operations[0].numbering.levels[0].text='untrusted renderer copy';
 assert.equal(context.activeRtkFormattingReturnApplyStore.input.operations[0].numbering.levels[0].text,'Article %1');
 assert.equal(op.numbering.levels[0].text,'Article %1');
});

test('actual Main section preview preserves disabled document grid values and absent legacy shape',()=>{
 const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
 const source=fs.readFileSync(path.resolve(__dirname,'../../src/main.js'),'utf8');
 const start=source.indexOf('function sanitizeDocxReviewReturnIntakeForResult('),end=source.indexOf('function findDocxReviewReturnIntakeRoundAuthority(',start);
 const context=vm.createContext({require:id=>{assert.equal(id,'./core/word-sections-v1.cjs');return require('../../src/core/word-sections-v1.cjs');},
   isPlainObjectValue:value=>value&&typeof value==='object'&&!Array.isArray(value),docxReviewPreviewSessionDetailString:value=>typeof value==='string'?value:''});
 vm.runInContext(source.slice(start,end),context);
 const clone=value=>JSON.parse(JSON.stringify(value));
 for(const grid of [undefined,{type:'default'},{type:'default',linePitch:0,charSpace:-123},{type:'default',linePitch:360,charSpace:0}]) {
   const section={ordinal:0,startParagraphIndex:0,endParagraphIndex:0,breakPlacement:'BODY_FINAL',carriers:{sectionProperties:true,pageSize:true,margins:true,columns:true,...(grid?{docGrid:true}:{})},properties:{type:'nextPage',...(grid?{docGrid:grid}:{})}};
   const input={parserResult:{documentSectionsBinding:{protectedSections:[section]}}};
   const result=clone(context.sanitizeDocxReviewReturnIntakeForResult(input));
   const output=result.documentSections.protectedSections[0];
   if(grid){assert.deepEqual(output.properties.docGrid,grid);assert.equal(output.carriers.docGrid,true);output.properties.docGrid.type='mutated';assert.equal(grid.type,'default');}
   else {assert.equal(Object.hasOwn(output.properties,'docGrid'),false);assert.equal(Object.hasOwn(output.carriers,'docGrid'),false);}
 }
 assert.throws(()=>context.sanitizeDocxReviewReturnIntakeForResult({parserResult:{documentSectionsBinding:{protectedSections:[{properties:{type:'nextPage',docGrid:{type:'lines'}}}]}}}),/WORD_SECTIONS_INVALID/);
});

test('grid formatting journal forwards private plans, rolls back exact plain bytes and recovers interrupted publication',async t=>{
 const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
 const runtime=await import('../../src/io/revisionBridge/reviewTransportFormattingReturnRuntime.mjs'),sections=require('../../src/core/word-sections-v1.cjs');
 const stable=v=>JSON.stringify(v,(_,value)=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b))):value);
 const cryptoPort={sha256Text:v=>crypto.createHash('sha256').update(String(v)).digest('hex'),sha256Json:v=>'sha256:'+crypto.createHash('sha256').update(stable(v)).digest('hex')};
 for(const abrupt of [false,true]){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'grid-journal-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));fs.mkdirSync(path.join(root,'roman'));
  const scenePath=path.join(root,'roman','a.txt'),sibling=path.join(root,'roman','b.txt');fs.writeFileSync(scenePath,'Alpha');fs.writeFileSync(sibling,'Sibling');
  const revision='sha256:'+cryptoPort.sha256Text('Alpha'),plan={expectedRegistry:null,additions:[{endParagraphIndex:0,docGrid:{type:'default',linePitch:-12}}]};
  const commandId=runtime.RTK_FORMATTING_RETURN_COMMAND_ID,input={commandId,callerRole:'main',commandAuthority:{issuer:'main',intent:'rtk.formattingApply',commandId},projectId:'grid-project',projectRoot:root,requestId:'grid-request',returnArtifactSha256:'sha256:'+'a'.repeat(64),previewConfirmed:true,scenePathBySceneId:{a:scenePath},operations:[{kind:'section-doc-grid',operationId:'grid-op',sceneId:'a',sectionGrid:plan,sourceAuthority:'authenticated-full-manuscript-section-doc-grid-v1',sourceRawSha256:revision,sourceSceneRevision:revision}]};
  const calls=[];const publishScene=async(file,content,options)=>{
   assert.equal(fs.readFileSync(file,'utf8'),options.expectedText);await options.beforeRename();assert.deepEqual(options.inactiveGridPlan,plan);
   const before=envelope.parseObservablePayload(options.expectedText),after=envelope.parseObservablePayload(content),doc=p=>p.doc||envelope.buildParagraphDocumentFromText(p.text);
   if(options.inactiveGridRollback)sections.validateGridRollback(doc(before),doc(after),options.inactiveGridPlan);else sections.validateSaveWithGridAddition(doc(before),doc(after),options.inactiveGridPlan);
   calls.push(options.inactiveGridRollback?'rollback':'forward');fs.writeFileSync(file,content);return {ok:1};
  };
  if(abrupt){await assert.rejects(runtime.applyMultiSceneFormattingReturnRuntime(input,{cryptoPort,publishScene,simulateAbruptFailureAtSceneIndex:0}),/ABRUPT/);
   const recovered=await runtime.applyMultiSceneFormattingReturnRuntime(input,{cryptoPort,publishScene});assert.equal(recovered.status,'replay',JSON.stringify(recovered));assert.equal(recovered.receipt.status,'applied-after-recovery-readback');assert.deepEqual(calls,['forward']);assert.deepEqual(sections.read(envelope.parseObservablePayload(fs.readFileSync(scenePath,'utf8')).doc).final.docGrid,plan.additions[0].docGrid);
  }else{const result=await runtime.applyMultiSceneFormattingReturnRuntime(input,{cryptoPort,publishScene,simulateFailureAtSceneIndex:0});assert.equal(result.code,'RTK_FORMATTING_WRITE_FAILED_ROLLED_BACK',JSON.stringify(result));assert.equal(fs.readFileSync(scenePath,'utf8'),'Alpha');assert.deepEqual(calls,['forward','rollback']);}
  assert.equal(fs.readFileSync(sibling,'utf8'),'Sibling');
 }
});

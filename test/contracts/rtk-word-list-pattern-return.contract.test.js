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

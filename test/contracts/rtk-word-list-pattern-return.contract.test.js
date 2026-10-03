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
 for(const mutate of [op=>op.numbering.instanceId='foreign',op=>op.sourceAuthority='renderer',op=>op.sourceRawSha256='',op=>op.numbering.extra='authority',op=>op.numbering.levels[0].text='%2',op=>Object.defineProperty(op.numbering,'levels',{get(){calls++;return changed;}})]){
  const op=structuredClone(operation());mutate(op);assert.equal(apply(raw,[op]).ok,false);
 }
 assert.equal(calls,0);
});

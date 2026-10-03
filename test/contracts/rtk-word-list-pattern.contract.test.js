const test = require('node:test');
const assert = require('node:assert/strict');
const model = require('../../src/core/word-list-numbering-v1.cjs');
const pattern = (levels = model.defaultLevels(3)) => ({ schemaVersion: 1, instanceId: 'example', level: 0, levels });

test('literal and parent-dependent numbering definitions retain exact semantics', () => {
  const input = pattern(); input.levels[0].text = 'Article %1'; input.levels[1].text = '%1.%2)';
  const result = model.validateNumbering(input);
  assert.deepEqual(result, input); assert.notEqual(result.levels, input.levels);
  assert.deepEqual([model.formatOrdinal(0,'1'),model.formatOrdinal(3999,'I'),model.formatOrdinal(26,'A'),model.formatOrdinal(27,'A')], ['0','MMMCMXCIX','Z','AA']);
});

test('numbering rejects unsupported grammar, overflow, accessors and unknown authority fields', () => {
  for (const [key,value] of [['format','chicago'],['start',-1],['start',2147483648],['text','%2.'],['text','%10.'],['text','%0'],['text','%'],['text','\ud800'],['text','x\n'],['restartAfterLevel',0]]) {
    const input = pattern(); input.levels[0][key] = value;
    assert.throws(() => model.validateNumbering(input), /WORD_LIST_NUMBERING_INVALID/);
  }
  for (const [format,start] of [['I',4000],['i',0],['A',0],['a',2147483648]]) {
    const input = pattern(); Object.assign(input.levels[0], {format,start});
    assert.throws(() => model.validateNumbering(input), /WORD_LIST_NUMBERING_INVALID/);
  }
  let calls=0; const input=pattern(); Object.defineProperty(input.levels[0],'text',{get(){calls++;return '%1.';}});
  assert.throws(() => model.validateNumbering(input), /WORD_LIST_NUMBERING_INVALID/); assert.equal(calls,0);
  assert.throws(() => model.validateNumbering({...pattern(),numId:1}), /WORD_LIST_NUMBERING_INVALID/);
  const cycle=pattern();cycle.levels[0]=cycle;assert.throws(()=>model.validateNumbering(cycle),/WORD_LIST_NUMBERING_INVALID/);
});
const paragraph=text=>({type:'paragraph',content:[{type:'text',text}]});
const item=(text,...children)=>({type:'listItem',content:[paragraph(text),...children]});
const list=(numbering,...items)=>({type:'orderedList',attrs:{start:1,type:numbering.levels[numbering.level].format,wordNumbering:numbering},content:items});
const document=(...content)=>({type:'doc',content});
const labels=doc=>[...model.resolveMarkers(doc).values()].flatMap(value=>value.items.map(item=>item.label));
test('native Word calibrated shared abstract lineage applies instance override once; equal distinct lineages stay independent',()=>{
 const levels=model.defaultLevels(1);levels[0].start=3;
 const a={...pattern(levels),instanceId:'a',lineageId:'shared'};
 const b={...a,instanceId:'b',startOverrides:[{level:0,start:9}]};
 const nodes=[a,a,b,a,b,a].map((value,i)=>list(value,item(String(i))));
 assert.deepEqual(labels(document(...nodes)),['3.','4.','9.','10.','11.','12.']);
 b.lineageId='separate';assert.deepEqual(labels(document(...nodes)),['3.','4.','9.','5.','10.','6.']);
});
test('parent labels use current parent counter and restart on declared ancestor; never restart retains child counter',()=>{
 const levels=model.defaultLevels(2);levels[0].start=3;levels[1]={format:'a',start:1,text:'%1.%2)',restartAfterLevel:null};
 const root=pattern(levels),child={...root,level:1};
 const doc=document(list(root,item('first',list(child,item('a'),item('b'))),item('second',list(child,item('c')))));
 const values=[...model.resolveMarkers(doc).values()];
 assert.deepEqual(values.map(value=>value.items.map(item=>item.label)),[['3.','4.'],['3.a)','3.b)'],['4.c)']]);
 for(const node of [doc.content[0],doc.content[0].content[0].content[1],doc.content[0].content[1].content[1]])node.attrs.wordNumbering.levels[1].restartAfterLevel=0;
 assert.deepEqual([...model.resolveMarkers(doc).values()].map(value=>value.items.map(item=>item.label)),[['3.','4.'],['3.a)','3.b)'],['4.a)']]);
});
test('authoring wraps a paragraph and edits the complete group without changing text',()=>{
 const before=document(paragraph('hello'));const next=model.planNumberingEdit(before,{listPath:[0],action:'configure',levels:model.defaultLevels(2)});
 assert.equal(next.content[0].type,'orderedList');assert.deepEqual(labels(next),['1.']);assert.equal(before.content[0].type,'paragraph');
 const levels=model.defaultLevels(2);levels[0].text='Article %1';
 const changed=model.planNumberingEdit(next,{listPath:[0],action:'configure',levels});assert.deepEqual(labels(changed),['Article 1']);
});
function storedPart(bytes,name){let offset=0;while(bytes.readUInt32LE(offset)===0x04034b50){const size=bytes.readUInt32LE(offset+18),length=bytes.readUInt16LE(offset+26),extra=bytes.readUInt16LE(offset+28),start=offset+30+length+extra;if(bytes.subarray(offset+30,offset+30+length).toString()===name)return bytes.subarray(start,start+size).toString();offset=start+size;}throw Error('missing '+name);}
test('scene save and both exports preserve live hierarchy, literal templates and reset lineage',async()=>{
 const envelope=require('../../src/core/document-content-envelope-v1.cjs');
 const levels=model.defaultLevels(2);levels[0].text='Article %1';levels[0].start=3;levels[1].text='%1.%2)';
 const root={...pattern(levels),lineageId:'lineage'},child={...root,level:1};
 const doc=document(list(root,item('one',list(child,item('child')))),paragraph('gap'),list({...root,instanceId:'reset',startOverrides:[{level:0,start:9}]},item('reset')),list(root,item('continue')));
 const raw=envelope.composeObservablePayload({doc});assert.match(raw,/word-list-pattern.v1/);
 const reopened=envelope.parseObservablePayload(raw);assert.equal(reopened.issue,null);assert.deepEqual(labels(reopened.doc),['Article 3','3.1)','Article 9','Article 10']);
 const [docxPageSetupBindModule,semanticMappingModule,styleMapModule,bridge]=await Promise.all([import('../../src/docxPageSetupBind.mjs'),import('../../src/derived/semanticMapping.mjs'),import('../../src/derived/styleMap.mjs'),import('../../src/io/revisionBridge/index.mjs')]);
 const min=require('../../src/export/docx/docxMinBuilder.js').buildDocxMinBuffer({doc,bookProfile:{formatId:'A4'}},{docxPageSetupBindModule,semanticMappingModule,styleMapModule});
 const source=require('../../src/export/docx/fullManuscriptDocxReviewPacketSource.js');
 const blocks=source.buildFormatIrParagraphs({sceneId:'scene',doc,text:'one\nchild\ngap\nreset\ncontinue'}).map((p,i)=>({...p,sceneId:'scene',blockId:'b'+i,paragraphId:'p'+i}));
 const review=require('../../src/export/docx/docxReviewPacketBuilder.js').buildDocxReviewPacketBuffer({blocks,customProperties:[{name:'YRTK_C01_AUTH',value:'test'},{name:'YRTK2_TOKEN',value:'test'}]});
 for(const bytes of [min,review]) {
  const xml=storedPart(bytes,'word/numbering.xml');assert.equal((xml.match(/<w:abstractNum /g)||[]).length,1);assert.match(xml,/<w:startOverride w:val="9"/);assert.match(xml,/Article %1/);assert.doesNotMatch(xml,/<w:lvlRestart w:val="1"/);
  const preview=bridge.buildDocxContentPreviewFromZipBytes(bytes);assert.equal(preview.ok,true,JSON.stringify(preview));
  const plan=bridge.buildDocxImportPreviewPlanFromContentPreview(preview);assert.equal(plan.ok,true,JSON.stringify(plan));
  const imported=envelope.parseObservablePayload(plan.candidateCreatePlan.entries[0].content);assert.equal(imported.issue,null);
  assert.deepEqual(labels(imported.doc),['Article 3','3.1)','Article 9','Article 10']);
 }
});
test('full manuscript scopes equal canonical instance IDs and abstract lineages to their owning scene',()=>{
 const source=require('../../src/export/docx/fullManuscriptDocxReviewPacketSource.js');
 const doc=document(list(pattern(model.defaultLevels(1)),item('same')));
 const full=source.buildFullManuscriptDocxReviewPacketSource({projectId:'p',projectRoot:'/synthetic',scenes:[0,1].map(i=>({sceneId:`roman/${i}.txt`,scenePath:`/synthetic/roman/${i}.txt`,order:i,doc,text:'same'}))});
 const ids=full.blocks.filter(b=>b.formatIr?.paragraph?.list).map(b=>b.formatIr.paragraph.list.numId);assert.equal(new Set(ids).size,2);
 const bytes=require('../../src/export/docx/docxReviewPacketBuilder.js').buildDocxReviewPacketBuffer(full),xml=storedPart(bytes,'word/numbering.xml');
 assert.equal((xml.match(/<w:abstractNum /g)||[]).length,2);
});

test('native Word alphabetic sequence repeats letters rather than spreadsheet column digits',()=>{
 assert.deepEqual([26,27,28,29,52,53,54].map(n=>model.formatOrdinal(n,'a')),['z','aa','bb','cc','zz','aaa','bbb']);
 assert.equal(model.formatOrdinal(780,'A'),'Z'.repeat(30));
 assert.throws(()=>model.formatOrdinal(781,'A'),/WORD_LIST_NUMBERING_INVALID/);
});
test('normalization preserves declared skipped levels when unrelated edits shift every list path',()=>{
 const levels=model.defaultLevels(3),root=pattern(levels),child={...root,level:2};
 const before=document(list(root,item('root',list(child,item('child')))));
 const shifted=document(paragraph('prepended'),...structuredClone(before.content));
 const actual=model.normalizeAuthoring(shifted,before);assert.equal(actual.content[1].content[0].content[1].attrs.wordNumbering.level,2);
});
test('nested legacy configuration uses logical parent level and continues whole existing lineage',()=>{
 const plain={type:'orderedList',attrs:{start:1},content:[item('nested')]};
 const root=pattern(model.defaultLevels(3)),before=document(list(root,item('root',plain)));
 const next=model.planNumberingEdit(before,{listPath:[0,0,1],action:'configure'});
 assert.equal(next.content[0].content[0].content[1].attrs.wordNumbering.level,1);
 assert.equal(next.content[0].content[0].content[1].attrs.wordNumbering.instanceId,root.instanceId);
 const a={...root,instanceId:'prior'},b={...root,instanceId:'later'};
 const separated=document(list(a,item('one')),paragraph('gap'),list(b,item('two')),paragraph('gap2'),list(b,item('three')));
 const joined=model.planNumberingEdit(separated,{listPath:[2],action:'continue',instanceId:'prior'});
 assert.deepEqual(labels(joined),['1.','2.','3.']);
 const restarted=model.planNumberingEdit(joined,{listPath:[2],action:'restart'});assert.deepEqual(labels(restarted),['1.','1.','2.']);
});
test('authoring rejects path accessors and old-document serialization hooks without executing them',()=>{
 let calls=0;const path=[];Object.defineProperty(path,0,{enumerable:true,get(){calls++;return 0;}});path.length=1;
 assert.throws(()=>model.planNumberingEdit(document(paragraph('safe')),{listPath:path,action:'configure'}),/WORD_LIST_NUMBERING_INVALID/);
 const old=document(paragraph('safe'));Object.defineProperty(old.content[0],'toJSON',{get(){calls++;return()=>({});}});
 assert.throws(()=>model.normalizeAuthoring(document(paragraph('safe')),old),/WORD_LIST_NUMBERING_INVALID/);assert.equal(calls,0);
});
test('legacy and pattern identifiers occupy separate DOCX instance namespaces',async()=>{
 const patternList=list({...pattern(model.defaultLevels(1)),instanceId:'same'},item('pattern'));
 const legacy={type:'orderedList',attrs:{start:1,wordListId:'same',wordListStart:1},content:[item('legacy')]};
 const doc=document(patternList,paragraph('gap'),legacy);
 const [docxPageSetupBindModule,semanticMappingModule,styleMapModule]=await Promise.all([import('../../src/docxPageSetupBind.mjs'),import('../../src/derived/semanticMapping.mjs'),import('../../src/derived/styleMap.mjs')]);
 const bytes=require('../../src/export/docx/docxMinBuilder.js').buildDocxMinBuffer({doc,bookProfile:{formatId:'A4'}},{docxPageSetupBindModule,semanticMappingModule,styleMapModule});
 assert.equal((storedPart(bytes,'word/numbering.xml').match(/<w:num w:numId=/g)||[]).length,2);
 const blocks=require('../../src/export/docx/fullManuscriptDocxReviewPacketSource.js').buildFormatIrParagraphs({sceneId:'scene',doc,text:'pattern\ngap\nlegacy'});
 assert.notEqual(blocks[0].formatIr.paragraph.list.numId,blocks[2].formatIr.paragraph.list.numId);
});

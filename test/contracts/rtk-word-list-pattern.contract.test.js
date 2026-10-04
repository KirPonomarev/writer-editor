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

test('fresh authoring identity never reuses a surviving lineage after its original instance is deleted',()=>{
 const survivor={...pattern(model.defaultLevels()),instanceId:'numbering-2',lineageId:'numbering-1',startOverrides:[{level:0,start:5}]};
 const before=document(list(survivor,item('surviving restarted instance')),paragraph('independent new list'));
 const after=model.planNumberingEdit(before,{listPath:[1],action:'configure'});
 assert.equal(after.content[1].attrs.wordNumbering.instanceId,'numbering-3');
 assert.deepEqual(labels(after),['5.','1.']);
 assert.deepEqual(after.content[0].attrs.wordNumbering,survivor);
});
const clipboardPlain=doc=>{const next=structuredClone(doc);const walk=n=>{if(n.attrs)delete n.attrs.wordNumbering;for(const c of n.content||[])walk(c);};walk(next);return next;};
test('clipboard carries visible numbering across intervening edits and freshens both identity namespaces',()=>{
 const levels=model.defaultLevels(1);Object.assign(levels[0],{start:4,text:'Item %1)'});
 const source=model.normalize(document(list({...pattern(levels),instanceId:'numbering-1',lineageId:'numbering-2'},item('first'),item('second'))));
 const carrier=model.createNumberingClipboard(source);
 const destination=model.normalize(document(list({...pattern(levels),instanceId:'other',lineageId:'numbering-1'},item('later edit'))));
 const before=structuredClone(destination),pasted=model.prepareNumberingPaste(destination,{fragment:clipboardPlain(source),numberingCarrier:carrier});
 assert.deepEqual(labels(pasted),['Item 4)','Item 5)']);assert.deepEqual(destination,before);
 const p=pasted.content[0].attrs.wordNumbering;assert.notEqual(p.instanceId,'numbering-1');assert.notEqual(p.lineageId,'numbering-1');assert.notEqual(p.instanceId,'other');
 assert.deepEqual(labels(document(...destination.content,...pasted.content)),['Item 4)','Item 4)','Item 5)']);
});
test('clipboard continuation retains visible start and shared lineage override sequence',()=>{
 const levels=model.defaultLevels(1);levels[0].start=3;
 const a={...pattern(levels),instanceId:'a',lineageId:'shared'},b={...a,instanceId:'b',startOverrides:[{level:0,start:9}]};
 const original=model.normalize(document(...[a,a,b,a,b,a].map((p,i)=>list(p,item(String(i))))));
 const fragment=document(...structuredClone(original.content.slice(1)));
 const pasted=model.prepareNumberingPaste(document(),{fragment:clipboardPlain(fragment),numberingCarrier:model.createNumberingClipboard(fragment)});
 assert.deepEqual(labels(pasted),['4.','9.','10.','11.','12.']);
 assert.equal(new Set(pasted.content.map(n=>n.attrs.wordNumbering.lineageId)).size,1);
});
test('clipboard rejects forged shape, unknown keys, orphan dependent levels and oversize without mutating destination',()=>{
 const source=model.normalize(document(list(pattern(),item('protected')))),plain=clipboardPlain(source),carrier=model.createNumberingClipboard(source),destination=document();
 for(const change of [v=>{v.authority='yes';},v=>{v.lists[0].numbering.path='/tmp/x';},v=>{v.lists[0].start=-1;},v=>{v.lists.push(v.lists[0]);},v=>{v.lists[0].numbering.levels[0].text='%2';}]){
  const bad=JSON.parse(carrier);change(bad);assert.throws(()=>model.prepareNumberingPaste(destination,{fragment:plain,numberingCarrier:JSON.stringify(bad)}),/WORD_LIST_NUMBERING_INVALID/);
 }
 const changed=structuredClone(plain);changed.content[0].content[0].content[0].content[0].text='tampered';assert.throws(()=>model.prepareNumberingPaste(destination,{fragment:changed,numberingCarrier:carrier}));
 assert.throws(()=>model.prepareNumberingPaste(destination,{fragment:plain,numberingCarrier:' '.repeat(65537)}));
 const orphan=model.normalize(document(list({...pattern(),level:1},item('orphan'))));assert.throws(()=>model.createNumberingClipboard(orphan));
 let calls=0;const hostile={};Object.defineProperty(hostile,'type',{get(){calls++;return 'doc';}});assert.throws(()=>model.createNumberingClipboard(hostile));assert.equal(calls,0);assert.deepEqual(destination,document());
});
test('same-lineage Continue cancels only selected first root reset, preserving child and other instance overrides',()=>{
 const levels=model.defaultLevels(2);Object.assign(levels[0],{start:3,text:'Clause %1'});Object.assign(levels[1],{format:'a',text:'%1.%2.'});
 const a={...pattern(levels),instanceId:'a',lineageId:'shared'},b={...a,instanceId:'b',startOverrides:[{level:0,start:9}]};
 const restarted={...a,instanceId:'restart',startOverrides:[{level:0,start:3},{level:1,start:2}]};
 const child=p=>({...p,level:1});
 const source=model.normalize(document(list(a,item('first')),list(b,item('nine')),list(restarted,item('restart',list(child(restarted),item('child')))),list(b,item('next'))));
 const before=structuredClone(source),result=model.planNumberingEdit(source,{listPath:[2],action:'continue',instanceId:'a'});
 assert.deepEqual(labels(source),['Clause 3','Clause 9','Clause 3','3.b.','Clause 4']);
 assert.deepEqual(labels(result),['Clause 3','Clause 9','Clause 10','10.b.','Clause 11']);
 assert.deepEqual(result.content.slice(0,2),source.content.slice(0,2));assert.deepEqual(source,before);
 assert.deepEqual(result.content[2].attrs.wordNumbering.startOverrides,[{level:1,start:2}]);
 assert.deepEqual(result.content[2].content[0].content[1].attrs.wordNumbering.startOverrides,[{level:1,start:2}]);
 assert.deepEqual(result.content[3].attrs.wordNumbering.startOverrides,[{level:0,start:9}]);
 assert.deepEqual(model.planNumberingEdit(result,{listPath:[2],action:'continue',instanceId:'a'}),result);
});
test('Continue on a later same-instance representative does not rewrite an already consumed prefix reset',()=>{
 const levels=model.defaultLevels(1),a={...pattern(levels),instanceId:'a',lineageId:'shared'},b={...a,instanceId:'b',startOverrides:[{level:0,start:9}]};
 const source=model.normalize(document(list(a,item('first')),list(b,item('reset')),list(b,item('continued'))));
 assert.deepEqual(labels(source),['1.','9.','10.']);
 assert.deepEqual(model.planNumberingEdit(source,{listPath:[2],action:'continue',instanceId:'a'}),source);
});
test('newly loaded identities retain skipped logical levels and existing plain nested lists',()=>{
 const levels=model.defaultLevels(3);levels[0].start=3;levels[1].format='a';levels[1].text='%1.%2.';levels[2].text='%3';levels[2].restartAfterLevel=0;
 const root=pattern(levels),deep={...root,level:2};
 const plain={type:'orderedList',attrs:{start:7},content:[item('legacy peer')]};
 const source=model.normalize(document(list(root,item('first',list(deep,item('logical third')),plain))));
 for(const previous of [document(paragraph('old scene')),model.normalize(document(list({...root,instanceId:'unrelated'},item('other identity'))))]){
  const result=model.normalizeAuthoring(source,previous);
  assert.deepEqual(result,source);
  assert.equal(result.content[0].content[0].content[1].attrs.wordNumbering.level,2);
  assert.equal(result.content[0].content[0].content[2].attrs.wordNumbering,undefined);
  assert.deepEqual(labels(result),['3.','1']);
 }
});
test('mapped occurrence ancestry repairs lifted descendants without rewriting unrelated skipped-level context',()=>{
 const levels=model.defaultLevels(3);levels[0].start=3;levels[1].format='a';levels[1].text='%1.%2.';levels[2].text='%3';levels[2].restartAfterLevel=0;
 const pat=level=>({...pattern(levels),level});
 const before=model.normalize(document(list(pat(0),item('1',list(pat(1),item('2',list(pat(2),item('3'),item('4'))),item('5',list(pat(2),item('6'))))),item('7',list(pat(2),item('8'))))));
 const working=document(list(pat(0),item('1'),item('2',list(pat(2),item('3'),item('4'),item('5',list(pat(2),item('6'))))),item('7',list(pat(2),item('8')))));
 const oldPaths=[[0,0,0],[0,0,1,0,0],[0,0,1,0,1,0,0],[0,0,1,0,1,1,0],[0,0,1,1,0],[0,0,1,1,1,0,0],[0,1,0],[0,1,1,0,0]];
 const newPaths=[[0,0,0],[0,1,0],[0,1,1,0,0],[0,1,1,1,0],[0,1,1,2,0],[0,1,1,2,1,0,0],[0,2,0],[0,2,1,0,0]];
 const provenance={schemaVersion:1,paragraphs:oldPaths.map((beforePath,i)=>({beforePath,afterPath:newPaths[i]}))};
 const original=structuredClone(working),result=model.normalizeAuthoring(working,before,provenance);
 assert.deepEqual(working,original);
 assert.deepEqual(labels(result),['3.','4.','5.','4.a.','4.b.','4.c.','1','1']);
 assert.equal(result.content[0].content[1].content[1].attrs.wordNumbering.level,1);
 assert.equal(result.content[0].content[2].content[1].attrs.wordNumbering.level,2);
 for(const change of [v=>{v.authority=true;},v=>{v.paragraphs.push(v.paragraphs[0]);},v=>{v.paragraphs[0].afterPath=[999];},v=>{v.paragraphs[0].beforePath=['0'];}]){
  const bad=structuredClone(provenance);change(bad);assert.throws(()=>model.normalizeAuthoring(working,before,bad),/WORD_LIST_NUMBERING_INVALID/);
 }
 let reads=0;const hostile={schemaVersion:1,paragraphs:[]};Object.defineProperty(hostile,'schemaVersion',{get(){reads++;return 1;}});assert.throws(()=>model.normalizeAuthoring(working,before,hostile));assert.equal(reads,0);
});
test('mapped lift joins an existing destination level and shifts only its own descendants',()=>{
 const levels=model.defaultLevels(4),pat=level=>({...pattern(levels),level});
 const before=model.normalize(document(list(pat(0),item('same',list(pat(2),item('same',list(pat(3),item('same'))))),item('same',list(pat(2),item('same'))))));
 const working=document(list(pat(0),item('same'),item('same',list(pat(3),item('same'))),item('same',list(pat(2),item('same')))));
 const beforePaths=[[0,0,0],[0,0,1,0,0],[0,0,1,0,1,0,0],[0,1,0],[0,1,1,0,0]],afterPaths=[[0,0,0],[0,1,0],[0,1,1,0,0],[0,2,0],[0,2,1,0,0]];
 const result=model.normalizeAuthoring(working,before,{schemaVersion:1,paragraphs:beforePaths.map((beforePath,i)=>({beforePath,afterPath:afterPaths[i]}))});
 assert.equal(result.content[0].attrs.wordNumbering.level,0);
 assert.equal(result.content[0].content[1].content[1].attrs.wordNumbering.level,1);
 assert.equal(result.content[0].content[2].content[1].attrs.wordNumbering.level,2);
 assert.deepEqual(result.content[0].content[2].content[1].attrs.wordNumbering,before.content[0].content[1].content[1].attrs.wordNumbering);
 assert.deepEqual(labels(result),['1.','2.','3.','1.','1.']);
});
test('ordinary and review exports number each list item once while preserving continuation paragraphs and nested order',async()=>{
 const levels=model.defaultLevels(2);levels[0].start=4;levels[0].text='Item %1)';
 const root=pattern(levels),nested={...root,level:1};
 const doc=document(list(root,item('first'),item('second'),item('third',paragraph('continuation'),list(nested,item('child',paragraph('child continuation'))),{...paragraph('after child'),attrs:{wordParagraphIndent:{left:1234,right:99,firstLine:80}}})));
 const [docxPageSetupBindModule,semanticMappingModule,styleMapModule]=await Promise.all([import('../../src/docxPageSetupBind.mjs'),import('../../src/derived/semanticMapping.mjs'),import('../../src/derived/styleMap.mjs')]);
 const min=require('../../src/export/docx/docxMinBuilder.js').buildDocxMinBuffer({doc,bookProfile:{formatId:'A4'}},{docxPageSetupBindModule,semanticMappingModule,styleMapModule});
 const source=require('../../src/export/docx/fullManuscriptDocxReviewPacketSource.js');
 const texts=['first','second','third','continuation','child','child continuation','after child'];
 const blocks=source.buildFormatIrParagraphs({sceneId:'scene',doc,text:texts.join('\n')}).map((block,i)=>({...block,sceneId:'scene',blockId:'b'+i,paragraphId:'p'+i}));
 assert.deepEqual(blocks.map(block=>block.formatIr.paragraph.list.itemOrdinal),[0,1,2,2,0,0,2]);
 assert.deepEqual(blocks.map(block=>block.formatIr.paragraph.list.continuation===true),[false,false,false,true,false,true,true]);
 const review=require('../../src/export/docx/docxReviewPacketBuilder.js').buildDocxReviewPacketBuffer({blocks,customProperties:[{name:'YRTK_C01_AUTH',value:'test'},{name:'YRTK2_TOKEN',value:'test'}]});
 for(const bytes of [min,review]){
  const xml=storedPart(bytes,'word/document.xml'),paras=[...xml.matchAll(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g)].map(match=>match[0]);
  assert.equal(paras.length,7);
  assert.deepEqual(paras.map(p=>[...p.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(m=>m[1]).join('')),texts);
  assert.deepEqual(paras.map(p=>p.includes('<w:numPr>')),[true,true,true,false,true,false,false]);
  assert.match(paras[3],/<w:ind w:left="720"\/>/);
  assert.match(paras[5],/<w:ind w:left="1440"\/>/);
  assert.match(paras[6],/<w:ind w:left="1234" w:right="99" w:firstLine="80"\/>/);
  assert.equal((storedPart(bytes,'word/numbering.xml').match(/<w:num w:numId=/g)||[]).length,1);
 }
 const invalid=structuredClone(blocks);invalid[3].formatIr.paragraph.list.continuation='true';
 assert.throws(()=>require('../../src/export/docx/docxReviewPacketBuilder.js').buildDocxReviewPacketBuffer({blocks:invalid,customProperties:[{name:'YRTK_C01_AUTH',value:'test'},{name:'YRTK2_TOKEN',value:'test'}]}),/FORMAT_IR_LIST_UNSUPPORTED/);
 assert.deepEqual(labels(doc),['Item 4)','Item 5)','Item 6)','1.']);
});

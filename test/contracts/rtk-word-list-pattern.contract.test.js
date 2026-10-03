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

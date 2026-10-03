'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const envelope=require('../../src/core/document-content-envelope-v1.cjs');
const pending=require('../../src/core/word-pending-text-revisions-v1.cjs');
const comments=require('../../src/core/word-comment-anchor-save-v1.cjs');
const {buildFormatIrParagraphs}=require('../../src/export/docx/fullManuscriptDocxReviewPacketSource.js');
const {buildDocxReviewPacketBuffer}=require('../../src/export/docx/docxReviewPacketBuilder.js');
const h=(text,level=9)=>({type:'heading',attrs:{level},content:[{type:'text',text}]});
const p=text=>({type:'paragraph',content:text?[{type:'text',text}]:[]});
const li=node=>({type:'listItem',content:[node]});
const ol=(...items)=>({type:'orderedList',attrs:{start:3,type:'I'},content:items.map(li)});
const modules=Promise.all([import('@tiptap/core'),import('@tiptap/starter-kit'),import('@tiptap/pm/state'),
 import('@tiptap/pm/schema-list'),import('@tiptap/pm/history'),import('../../src/renderer/tiptap/documentHeadings.mjs'),
 import('../../src/renderer/tiptap/documentListItems.mjs'),import('../../src/renderer/tiptap/documentTables.mjs'),
 import('../../src/renderer/tiptap/documentListNumbering.mjs'),import('../../src/io/revisionBridge/index.mjs')]);

for(const inTable of [false,true])test(`numbered headings: real editor split/indent/outdent/history/save retains ownership; cell ${inTable}`,async()=>{
 const [{getSchema},{default:StarterKit},{EditorState,TextSelection},{splitListItem,sinkListItem,liftListItem},{history,undo,redo,closeHistory},{DocumentHeadings},{DocumentListItems},{DocumentTables}]=await modules;
 const schema=getSchema([StarterKit.configure({heading:false,listItem:false,trailingNode:false}),DocumentHeadings,DocumentListItems,DocumentTables]);
 const list=ol(h('First',2),h('Second',9));
 const json={type:'doc',content:inTable?[{type:'table',content:[{type:'tableRow',content:[{type:'tableCell',content:[list]},{type:'tableCell',content:[p('protected')]}]}]}]:[list,p('protected')]};
 const doc=schema.nodeFromJSON(json);doc.check();let target;
 doc.descendants((node,pos)=>{if(node.isText&&node.text==='Second')target=pos+3;});
 let state=EditorState.create({schema,doc,selection:TextSelection.create(doc,target),plugins:[history()]});
 const dispatch=tr=>{state=state.apply(tr);};
 const before=state.doc.toJSON();assert.equal(splitListItem(schema.nodes.listItem)(state,dispatch),true);state.doc.check();
 const split=state.doc.toJSON();assert.equal(undo(state,dispatch),true);assert.deepEqual(state.doc.toJSON(),before);
 assert.equal(redo(state,dispatch),true);assert.deepEqual(state.doc.toJSON(),split);
 dispatch(closeHistory(state.tr));assert.equal(sinkListItem(schema.nodes.listItem)(state,dispatch),true);state.doc.check();
 dispatch(closeHistory(state.tr));assert.equal(liftListItem(schema.nodes.listItem)(state,dispatch),true);state.doc.check();
 assert.deepEqual(state.doc.toJSON(),split);
 const leaves=[];state.doc.descendants(node=>{if(node.isTextblock)leaves.push([node.type.name,node.attrs.level,node.textContent]);});
 assert.deepEqual(leaves,[['heading',2,'First'],['heading',9,'Sec'],['heading',9,'ond'],['paragraph',undefined,'protected']]);
 const saved=envelope.composeObservablePayload({doc:state.doc.toJSON(),metaEnabled:false});
 const reopened=envelope.parseObservablePayload(saved);assert.equal(reopened.issue,null);
 assert.deepEqual(schema.nodeFromJSON(reopened.doc).toJSON(),split);
 assert.deepEqual(comments.paragraphs(saved).map(x=>[x.type,x.text]),[['heading','First'],['heading','Sec'],['heading','ond'],['paragraph','protected']]);
 if(inTable){assert.equal(comments.paragraphs(saved)[0].table.column,0);assert.equal(comments.paragraphs(saved).at(-1).table.column,1);}
});

test('numbered heading insertion updates continued counter and undo restores it',async()=>{
 const [{getSchema},{default:StarterKit},{EditorState,TextSelection},{splitListItem},{history,undo}, {DocumentHeadings},{DocumentListItems},,{DocumentListNumbering}]=await modules;
 const schema=getSchema([StarterKit.configure({heading:false,listItem:false,trailingNode:false}),DocumentHeadings,DocumentListItems,DocumentListNumbering]);
 const first=ol(h('First')),last=ol(h('Last'));first.attrs={...first.attrs,wordListId:'chain',wordListStart:3};last.attrs={...first.attrs,start:4};
 const doc=schema.nodeFromJSON({type:'doc',content:[first,p('gap'),last]});
 const plugins=DocumentListNumbering.config.addProseMirrorPlugins.call({});
 let state=EditorState.create({schema,doc,selection:TextSelection.create(doc,5),plugins:[history(),...plugins]});
 const dispatch=tr=>{state=state.applyTransaction(tr).state;};
 assert.ok(splitListItem(schema.nodes.listItem)(state,dispatch));assert.equal(state.doc.lastChild.attrs.start,5);
 assert.ok(undo(state,dispatch));assert.equal(state.doc.lastChild.attrs.start,4);assert.deepEqual(state.doc.toJSON(),doc.toJSON());
});

test('numbered heading pending text decisions retain list and outline identity',()=>{
 const source={type:'doc',content:[ol(h('Heading'))]};
 const doc=pending.bindLedger({schemaVersion:1,source,revisions:[{id:'revision-1',nativeId:'1',operation:'insert',author:'Reviewer',date:'2026-10-03T00:00:00Z',dateUtc:'2026-10-03T00:00:00Z',groupId:null,paragraphIndex:0,from:0,to:1,state:'pending'}],undo:[],redo:[]});
 for(const action of ['accept','reject']){
  const decided=pending.decide(doc,{action,revisionId:'revision-1'}).doc;
  assert.equal(decided.content[0].attrs.start,3);assert.equal(decided.content[0].attrs.type,'I');assert.equal(decided.content[0].content[0].content[0].attrs.level,9);
 }
});

for(const inTable of [false,true])test(`numbered heading review and ordinary exports preserve both roles; cell ${inTable}`,async()=>{
 const bridge=(await modules)[9];
 const list=ol(h('Heading',9),h('Next',2));
 const doc={type:'doc',content:inTable?[{type:'table',content:[{type:'tableRow',content:[{type:'tableCell',content:[list]}]}]}]:[list]};
 const blocks=buildFormatIrParagraphs({sceneId:'roman/test.txt',doc,text:envelope.deriveVisibleTextFromDocument(doc)}).map((p,i)=>({...p,blockId:'block'+i,paragraphId:'paragraph'+i}));
 assert.equal(blocks[0].formatIr.paragraph.headingLevel,9);assert.equal(blocks[0].formatIr.paragraph.list.kind,'ordered');
 const review=buildDocxReviewPacketBuffer({blocks,customProperties:[{name:'YRTK_C01_AUTH',value:'test-authority'},{name:'YRTK2_TOKEN',value:'test-token'}]});
 const [{default:page},semantic,styles]=await Promise.all([import('../../src/docxPageSetupBind.mjs').then(m=>({default:m})),import('../../src/derived/semanticMapping.mjs'),import('../../src/derived/styleMap.mjs')]);
 const ordinary=require('../../src/export/docx/docxMinBuilder.js').buildDocxMinBuffer({doc,bookProfile:{formatId:'A4'}},{docxPageSetupBindModule:page,semanticMappingModule:semantic,styleMapModule:styles});
 for(const bytes of [review,ordinary]){
  const parts=bridge.extractDocxReviewTransportPackagePartsFromZipBytes({bytes}).parts;
  assert.match(parts['word/document.xml'],/<w:outlineLvl w:val="8"\/>|<w:pStyle w:val="Heading9"\/>/);
  assert.match(parts['word/document.xml'],/<w:numPr>/);assert.match(parts['word/numbering.xml'],/upperRoman/);
  const report=bridge.buildDocxContentPreviewFromZipBytes(bytes);assert.equal(report.ok,true,JSON.stringify(report));
  const plan=bridge.buildDocxImportPreviewPlanFromContentPreview(report);assert.equal(plan.ok,true,JSON.stringify(plan));
  const imported=envelope.parseObservablePayload(plan.candidateCreatePlan.entries[0].content).doc;
  const actual=inTable?imported.content[0].content[0].content[0].content[0]:imported.content[0];
  assert.equal(actual.type,'orderedList');assert.equal(actual.attrs.type,'I');assert.equal(actual.attrs.start,3);
  assert.deepEqual(actual.content.map(item=>[item.content[0].type,item.content[0].attrs.level]),[['heading',9],['heading',2]]);
 }
});

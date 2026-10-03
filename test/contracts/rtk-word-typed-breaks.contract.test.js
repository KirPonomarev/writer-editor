'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const breaks=require('../../src/core/word-typed-breaks-v1.cjs');
const envelope=require('../../src/core/document-content-envelope-v1.cjs');
const min=require('../../src/export/docx/docxMinBuilder.js');
const review=require('../../src/export/docx/docxReviewPacketBuilder.js');
const source=require('../../src/export/docx/fullManuscriptDocxReviewPacketSource.js');
const text=value=>({type:'text',text:value});
const br=type=>({type:'hardBreak',...(type?{attrs:{wordBreakType:type}}:{})});
const fixture=()=>({type:'doc',content:[{type:'paragraph',content:[text('Before'),br('page'),text('Middle'),br('column'),text('End'),br(),text('Line')]}]});
const modules=Promise.all([import('../../src/io/revisionBridge/index.mjs'),import('../../src/docxPageSetupBind.mjs'),import('../../src/derived/semanticMapping.mjs'),import('../../src/derived/styleMap.mjs')]);
function ordinary(doc,mods){return min.buildDocxMinBuffer({doc,bookProfile:{formatId:'A4'}},{docxPageSetupBindModule:mods[1],semanticMappingModule:mods[2],styleMapModule:mods[3]});}
function packet(doc){const blocks=source.buildFormatIrParagraphs({sceneId:'roman/test.txt',doc,text:envelope.deriveVisibleTextFromDocument(doc)}).map((p,i)=>({...p,blockId:'block'+i,paragraphId:'paragraph'+i}));return review.buildDocxReviewPacketBuffer({blocks,customProperties:[{name:'YRTK_C01_AUTH',value:'test-authority'},{name:'YRTK2_TOKEN',value:'test-token'}]});}

test('typed break kinds reject malformed metadata without invoking getters',()=>{
 for(const type of ['page','column'])assert.equal(breaks.kind(br(type)),type);
 for(const node of [br(),br(null),{type:'hardBreak',attrs:{wordBreakType:null}}])assert.equal(breaks.kind(node),'line');
 for(const node of [br('section'),br(1),{type:'text',attrs:{wordBreakType:'page'}},{type:'hardBreak',attrs:{wordBreakType:'page',extra:true}}])assert.throws(()=>breaks.kind(node),/WORD_TYPED_BREAK_INVALID/);
 let called=false;const node={type:'hardBreak',attrs:{}};Object.defineProperty(node.attrs,'wordBreakType',{get(){called=true;return 'page';},enumerable:true});
 assert.throws(()=>breaks.kind(node),/WORD_TYPED_BREAK_INVALID/);assert.equal(called,false);
 for(const entries of [[{offset:0,type:'page'}],[{offset:1,type:'bad'}],[{offset:1,type:'page'},{offset:1,type:'column'}],[{offset:1,type:'page',extra:true}]])assert.throws(()=>breaks.validateOffsets('a\nb',entries));
 assert.deepEqual(breaks.textBreaks('a\nb\nc',[{offset:3,type:'column'}]),[{offset:1,type:'line'},{offset:3,type:'column'}]);
});

test('schema default line kind canonicalizes away while typed kinds survive save',async()=>{
 const [{getSchema},{default:StarterKit},{DocumentBreaks},{EditorState,TextSelection},{history,undo,redo}]=await Promise.all([import('@tiptap/core'),import('@tiptap/starter-kit'),import('../../src/renderer/tiptap/documentBreaks.mjs'),import('@tiptap/pm/state'),import('@tiptap/pm/history')]);
 const schema=getSchema([StarterKit.configure({hardBreak:false,trailingNode:false}),DocumentBreaks]);
 const doc=schema.nodeFromJSON(fixture());doc.check();let state=EditorState.create({schema,doc,selection:TextSelection.create(doc,2),plugins:[history()]});
 const dispatch=tr=>{state=state.apply(tr);};dispatch(state.tr.insertText('EDIT'));
 assert.ok(undo(state,dispatch));assert.deepEqual(state.doc.toJSON(),doc.toJSON());assert.ok(redo(state,dispatch));
 const saved=envelope.composeObservablePayload({doc:state.doc.toJSON()});const parsed=envelope.parseObservablePayload(saved);assert.equal(parsed.issue,null);
 assert.deepEqual(breaks.paragraphBreaks(parsed.doc.content[0]).map(b=>b.type),['page','column','line']);
 assert.deepEqual(parsed.doc.content[0].content.find(n=>n.type==='hardBreak'&&!n.attrs),{type:'hardBreak'});
 assert.deepEqual(schema.nodeFromJSON(parsed.doc).toJSON(),state.doc.toJSON());
});

for(const exporter of ['ordinary','review'])test(`${exporter} retains three break kinds over five import/export cycles`,async()=>{
 const mods=await modules;let doc=fixture();
 for(let cycle=0;cycle<5;cycle++){
  const bytes=exporter==='ordinary'?ordinary(doc,mods):packet(doc);
  const parts=mods[0].extractDocxReviewTransportPackagePartsFromZipBytes({bytes}).parts;
  assert.equal((parts['word/document.xml'].match(/<w:br w:type="page"\/>/gu)||[]).length,1);
  assert.equal((parts['word/document.xml'].match(/<w:br w:type="column"\/>/gu)||[]).length,1);
  assert.equal((parts['word/document.xml'].match(/<w:br\/>/gu)||[]).length,1);
  const report=mods[0].buildDocxContentPreviewFromZipBytes(bytes);assert.equal(report.ok,true,JSON.stringify(report));
  const plan=mods[0].buildDocxImportPreviewPlanFromContentPreview(report);assert.equal(plan.ok,true,JSON.stringify(plan));
  assert.equal(plan.lossReport.items.some(x=>['pageBreak','columnBreak'].includes(x.category)),false);
  doc=envelope.parseObservablePayload(plan.candidateCreatePlan.entries[0].content).doc;
  assert.deepEqual(breaks.paragraphBreaks(doc.content[0]),breaks.paragraphBreaks(fixture().content[0]));
 }
});

for(const attrs of ['w:type="bad"','w:type="page" w:type="column"','type="page"','xmlns:x="urn:evil" x:type="page"','w:clear="all"'])test(`literal invalid break rejects import: ${attrs}`,async()=>{
 const [bridge]=await modules;const bytes=min.buildStoredZip([{name:'word/document.xml',data:`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Before</w:t><w:br ${attrs}/><w:t>After</w:t></w:r></w:p></w:body></w:document>`}]);
 assert.equal(bridge.buildDocxContentPreviewFromZipBytes(bytes).ok,false);
});

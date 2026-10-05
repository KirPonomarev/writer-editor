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

for(const container of ['heading','list','table'])test(`typed breaks survive ${container} import/export`,async()=>{
 const mods=await modules;const doc=fixture();
 if(container==='heading'){doc.content[0].type='heading';doc.content[0].attrs={level:9};}
 if(container==='list')doc.content=[{type:'orderedList',attrs:{start:3,type:'I'},content:[{type:'listItem',content:doc.content}]}];
 if(container==='table')doc.content=[{type:'table',content:[{type:'tableRow',content:[{type:'tableCell',content:doc.content}]}]}];
 for(const bytes of [ordinary(doc,mods),packet(doc)]){
  const report=mods[0].buildDocxContentPreviewFromZipBytes(bytes);assert.equal(report.ok,true,JSON.stringify(report));
  const plan=mods[0].buildDocxImportPreviewPlanFromContentPreview(report);assert.equal(plan.ok,true,JSON.stringify(plan));
  const imported=envelope.parseObservablePayload(plan.candidateCreatePlan.entries[0].content).doc;
  const ps=[];const visit=n=>{if(n.type==='paragraph'||n.type==='heading')ps.push(n);else for(const child of n.content||[])visit(child);};visit(imported);
  assert.deepEqual(breaks.paragraphBreaks(ps[0]),breaks.paragraphBreaks(fixture().content[0]));
 }
});

test('pending adjacent text decision preserves both typed breaks and exports them',async()=>{
 const pending=require('../../src/core/word-pending-text-revisions-v1.cjs');
 const doc=pending.bindLedger({schemaVersion:1,source:fixture(),revisions:[{id:'revision-1',nativeId:'1',operation:'insert',author:'Reviewer',date:'2026-10-03T00:00:00Z',dateUtc:'2026-10-03T00:00:00Z',groupId:null,paragraphIndex:0,from:0,to:1,state:'pending'}],undo:[],redo:[]});
 const mods=await modules;
 for(const state of [doc,...['accept','reject'].map(action=>pending.decide(doc,{action,revisionId:'revision-1'}).doc)]){
  assert.deepEqual(breaks.paragraphBreaks(state.content[0]).map(b=>b.type),['page','column','line']);
  for(const bytes of [ordinary(state,mods),packet(state)]){
   const xml=mods[0].extractDocxReviewTransportPackagePartsFromZipBytes({bytes}).parts['word/document.xml'];
   assert.match(xml,/<w:br w:type="page"\/>/);assert.match(xml,/<w:br w:type="column"\/>/);
  }
 }
});

test('real local-file preview adapter retains typed breaks through both sanitization passes',async()=>{
 const mods=await modules;
 const result=await require('../../src/utils/docxImportLocalFilePreview.js').createDocxImportLocalFilePreview({requestId:'typed-break-import'}, {
  pickLocalFile:async()=>({path:require('node:path').join(require('node:os').tmpdir(),'typed-break.docx')}),
  readLocalFileBytes:async()=>ordinary(fixture(),mods),loadRevisionBridgeModule:async()=>mods[0]
 });
 assert.equal(result.importPreviewOk,true,JSON.stringify(result));
 const doc=envelope.parseObservablePayload(result.docxImportPreviewPlan.candidateCreatePlan.entries[0].content).doc;
 assert.deepEqual(breaks.paragraphBreaks(doc.content[0]),breaks.paragraphBreaks(fixture().content[0]));
});

test('typed breaks require explicit scene feature admission and unknown kinds refuse instead of flattening',()=>{
 const saved=envelope.composeObservablePayload({doc:fixture()});assert.match(saved,/word-typed-breaks.v1/);
 const parsed=envelope.parseObservablePayload(saved);assert.equal(parsed.issue,null);
 assert.equal(envelope.parseObservablePayload(saved.replace('word-typed-breaks.v1','word-typed-Xreaks.v1')).issue.reason,'DOC_BLOCK_REQUIRED_FEATURES_UNSUPPORTED');
 assert.doesNotMatch(envelope.composeObservablePayload({doc:{type:'doc',content:[{type:'paragraph',content:[text('A'),br(),text('B')]}]}}),/word-typed-breaks.v1/);
});

// Existing XML DOM supplies real nodes/serialization. This bounded compatibility
// layer supplies browser Element APIs consumed by the pinned PM HTML parser;
// it is not a native clipboard/browser oracle.
function clipboardDom() {
 const {DOMImplementation,DOMParser,XMLSerializer}=require('@xmldom/xmldom');
 const document=new DOMImplementation().createDocument(null,null,null);
 const decorate=root=>{
  if(root.nodeType===1){
   Object.defineProperty(root,'children',{get:()=>Array.from(root.childNodes).filter(n=>n.nodeType===1)});
   const values=()=>Object.fromEntries((root.getAttribute('style')||'').split(';').filter(Boolean).map(p=>{const i=p.indexOf(':');return [p.slice(0,i).trim(),p.slice(i+1).trim()];}));
   Object.defineProperty(root,'style',{get:()=>({get length(){return Object.keys(values()).length;},getPropertyValue:key=>values()[key]||'',get fontFamily(){return values()['font-family']||'';},get fontSize(){return values()['font-size']||'';},get whiteSpace(){return values()['white-space']||'';},get cssText(){return root.getAttribute('style')||'';},set cssText(value){root.setAttribute('style',value);}})});
   root.matches=selector=>{
    const match=/^([a-z][a-z0-9]*)(?:\[([\w-]+)(?:="([^"]*)")?\])?$/iu.exec(selector);
    assert.ok(match,`Unhandled fixture selector: ${selector}`);
    return root.tagName.toLowerCase()===match[1].toLowerCase()&&(!match[2]||(root.hasAttribute(match[2])&&(match[3]===undefined||root.getAttribute(match[2])===match[3])));
   };
  }
  for(const child of Array.from(root.childNodes||[]))decorate(child);
  return root;
 };
 const create=document.createElement.bind(document);document.createElement=name=>decorate(create(name));
 return {document,serialize:node=>new XMLSerializer().serializeToString(node),parse:html=>decorate(new DOMParser().parseFromString(`<div>${html}</div>`,'application/xhtml+xml').documentElement)};
}

for(const languageOnly of [false,true])test(`actual PM HTML serialization and paste retain break metadata (${languageOnly?'language only':'font and language'})`,async()=>{
 const [{getSchema},{default:StarterKit},{DocumentBreaks},{DocumentTextStyle},{DOMSerializer,DOMParser},{EditorState,TextSelection}]=await Promise.all([import('@tiptap/core'),import('@tiptap/starter-kit'),import('../../src/renderer/tiptap/documentBreaks.mjs'),import('../../src/renderer/tiptap/documentTextStyle.mjs'),import('@tiptap/pm/model'),import('@tiptap/pm/state')]);
 const schema=getSchema([StarterKit.configure({hardBreak:false,trailingNode:false}),DocumentBreaks,DocumentTextStyle]);
 const language={val:'ru-FI',eastAsia:'ru-RU',bidi:'ar-SA'};
 const marks=[{type:'textStyle',attrs:{wordLanguage:language,...(languageOnly?{}:{fontFamily:'Times New Roman',fontSize:'12pt'})}}];
 const input={type:'doc',content:[{type:'paragraph',content:[text('Before'),...['line','page','column'].map(type=>({...br(type==='line'?null:type),marks})),text('After')]}]};
 const original=schema.nodeFromJSON(input);original.check();
 const dom=clipboardDom(),serialized=DOMSerializer.fromSchema(schema).serializeFragment(original.content,{document:dom.document});
 const html=dom.serialize(serialized);
 assert.match(html,/data-word-language=/);assert.match(html,/data-word-break="page"/);assert.match(html,/data-word-break="column"/);
 const parser=DOMParser.fromSchema(schema),parsed=parser.parse(dom.parse(html));
 assert.deepEqual(parsed.toJSON(),original.toJSON());
 // The clipboard parser returns a Slice; apply it through the real PM replace
 // transaction, retaining surrounding authored text and all inline metadata.
 const target=schema.nodeFromJSON({type:'doc',content:[{type:'paragraph',content:[text('LR')]}]});
 let state=EditorState.create({schema,doc:target,selection:TextSelection.create(target,2)});
 state=state.apply(state.tr.replaceSelection(parser.parseSlice(dom.parse(html))));
 const expected=schema.nodeFromJSON({...input,content:[{...input.content[0],content:[text('LBefore'),...input.content[0].content.slice(1,-1),text('AfterR')]}]});
 assert.deepEqual(state.doc.toJSON(),expected.toJSON());
 assert.deepEqual(breaks.paragraphBreaks(state.doc.toJSON().content[0]).map(item=>item.type),['line','page','column']);
});

test('PM clipboard parser does not grant language metadata to malformed tuples or plain spans',async()=>{
 const [{getSchema},{default:StarterKit},{DocumentBreaks},{DocumentTextStyle},{DOMParser}]=await Promise.all([import('@tiptap/core'),import('@tiptap/starter-kit'),import('../../src/renderer/tiptap/documentBreaks.mjs'),import('../../src/renderer/tiptap/documentTextStyle.mjs'),import('@tiptap/pm/model')]);
 const schema=getSchema([StarterKit.configure({hardBreak:false,trailingNode:false}),DocumentBreaks,DocumentTextStyle]);
 const dom=clipboardDom(),parser=DOMParser.fromSchema(schema);
 for(const raw of [null,'not-json','null','[]','{}','{"val":"ru RU"}','{"val":"ru-RU","extra":"forged"}']){
  const p=dom.document.createElement('p'),span=dom.document.createElement('span'),line=dom.document.createElement('br');
  if(raw!==null)span.setAttribute('data-word-language',raw);
  line.setAttribute('data-word-break','page');span.appendChild(line);p.appendChild(dom.document.createTextNode('Before'));p.appendChild(span);p.appendChild(dom.document.createTextNode('After'));
  const parsed=parser.parse(dom.parse(dom.serialize(p)));
  assert.deepEqual(parsed.toJSON(),schema.nodeFromJSON({type:'doc',content:[{type:'paragraph',content:[text('Before'),br('page'),text('After')]}]}).toJSON(),String(raw));
 }
 assert.throws(()=>parser.parse(dom.parse('<p><span data-word-language="{&quot;val&quot;:&quot;ru-RU&quot;}"><br data-word-break="section" /></span></p>')),/WORD_TYPED_BREAK_INVALID/);
});

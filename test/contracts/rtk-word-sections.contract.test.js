'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const sections=require('../../src/core/word-sections-v1.cjs');
const envelope=require('../../src/core/document-content-envelope-v1.cjs');
const min=require('../../src/export/docx/docxMinBuilder.js');
const review=require('../../src/export/docx/docxReviewPacketBuilder.js');
const source=require('../../src/export/docx/fullManuscriptDocxReviewPacketSource.js');
const modules=Promise.all([import('../../src/io/revisionBridge/index.mjs'),import('../../src/docxPageSetupBind.mjs'),import('../../src/derived/semanticMapping.mjs'),import('../../src/derived/styleMap.mjs')]);
const p=text=>({type:'paragraph',content:[{type:'text',text}]});
const props=type=>({type,pageSize:{widthTwips:11906,heightTwips:16838,orientation:'portrait'},margins:{topTwips:1440,rightTwips:1440,bottomTwips:1440,leftTwips:1440,headerTwips:720,footerTwips:720,gutterTwips:0},columns:{count:2,spaceTwips:720}});
const fixture=()=>sections.bind({type:'doc',content:Array.from({length:6},(_,i)=>p(`SECTION_${i+1}`))},{schemaVersion:1,boundaries:sections.TYPES.map((type,endParagraphIndex)=>({endParagraphIndex,properties:props(type)})),final:props('continuous')});
function ordinary(doc,mods){return min.buildDocxMinBuffer({doc,bookProfile:{formatId:'A4'}},{docxPageSetupBindModule:mods[1],semanticMappingModule:mods[2],styleMapModule:mods[3]});}
function packet(doc){const scene={sceneId:'roman/test.txt',doc,text:envelope.deriveVisibleTextFromDocument(doc)};const blocks=source.buildFormatIrParagraphs(scene).map((p,i)=>({...p,sceneId:scene.sceneId,documentParagraphIndex:i,blockId:'block'+i,paragraphId:'paragraph'+i}));return review.buildDocxReviewPacketBuffer({blocks,documentSections:source.buildFullManuscriptDocumentSections([scene],blocks),customProperties:[{name:'YRTK_C01_AUTH',value:'test-authority'},{name:'YRTK2_TOKEN',value:'test-token'}]});}
for(const exporter of ['ordinary','review'])test(`${exporter}: six typed sections and final type survive five changed cycles`,async()=>{
 const mods=await modules;let doc=fixture();for(let i=0;i<5;i++){
 doc.content[i].content[0].text+=' EDIT';const bytes=exporter==='ordinary'?ordinary(doc,mods):packet(doc);
 const xml=mods[0].extractDocxReviewTransportPackagePartsFromZipBytes({bytes}).parts['word/document.xml'];
 assert.deepEqual([...xml.matchAll(/<w:type w:val="([^"]+)"/g)].map(m=>m[1]),[...sections.TYPES,'continuous']);
 assert.equal((xml.match(/<w:cols w:num="2" w:space="720"\/>/g)||[]).length,6);
 const report=mods[0].buildDocxContentPreviewFromZipBytes(bytes);assert.equal(report.ok,true,JSON.stringify(report));
 const plan=mods[0].buildDocxImportPreviewPlanFromContentPreview(report);assert.equal(plan.ok,true,JSON.stringify(plan));
 const next=envelope.parseObservablePayload(plan.candidateCreatePlan.entries[0].content).doc;
 assert.deepEqual(sections.read(next),sections.read(doc));assert.equal(envelope.deriveVisibleTextFromDocument(next),envelope.deriveVisibleTextFromDocument(doc));doc=next;
 }
});
test('section metadata validates before access and preserves explicit required feature',()=>{
 const doc=fixture(),payload=envelope.composeObservablePayload({doc});assert.ok(payload.includes('word-sections.v1'));assert.deepEqual(sections.read(envelope.parseObservablePayload(payload).doc),sections.read(doc));
 for(const mutate of [d=>d.attrs.wordSections.final.type='bogus',d=>d.attrs.wordSections.final.columns=null,d=>d.attrs.wordSections.boundaries[1].endParagraphIndex=0,d=>d.attrs.wordSections.boundaries[0].extra=true]){const d=fixture();mutate(d);assert.throws(()=>sections.read(d));}
 let touched=false;const d=fixture();Object.defineProperty(d.attrs.wordSections.boundaries,'0',{enumerable:true,get(){touched=true;return{};}});assert.throws(()=>sections.read(d));assert.equal(touched,false);
 const invalid=fixture();invalid.attrs.wordSections.boundaries=new Array(1);assert.throws(()=>sections.read(invalid));
});
test('Core remaps paragraph splits and refuses deletion of protected boundary',()=>{
 const before=fixture(),split=JSON.parse(JSON.stringify(before));split.content.splice(0,1,p('SEC'),p('TION_1'));
 const mapped=sections.project(before,split);assert.deepEqual(mapped.boundaries.map(x=>x.endParagraphIndex),[1,2,3,4,5]);
 const working=sections.bind(split,mapped);assert.doesNotThrow(()=>sections.validateSave(before,working));
 assert.deepEqual(sections.project(working,before),sections.read(before));
 const joined=JSON.parse(JSON.stringify(before));joined.content.splice(0,2,p('SECTION_1SECTION_2'));
 assert.throws(()=>sections.project(before,joined),/BOUNDARY_CONFLICT/);
 const tampered=fixture();tampered.attrs.wordSections.final.type='oddPage';assert.throws(()=>sections.validateSave(before,tampered),/AUTHORITY/);
});
for(const carrier of ['w:type w:val="bogus"','w:type val="continuous"','w:type xmlns:x="urn:foreign" x:val="continuous"','w:cols w:num="2" w:equalWidth="0"'])test(`invalid literal section refuses: ${carrier}`,async()=>{
 const [bridge]=await modules;const bytes=min.buildStoredZip([{name:'word/document.xml',data:`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:pPr><w:sectPr><${carrier}/></w:sectPr></w:pPr><w:r><w:t>A</w:t></w:r></w:p><w:p><w:r><w:t>B</w:t></w:r></w:p><w:sectPr/></w:body></w:document>`}]);assert.equal(bridge.buildDocxContentPreviewFromZipBytes(bytes).ok,false);
});
test('real editor split, typing, Undo/Redo and repeated save retain root registry',async()=>{
 const [{getSchema},{default:StarterKit},{DocumentSections},{EditorState,TextSelection},{history,undo,redo}]=await Promise.all([import('@tiptap/core'),import('@tiptap/starter-kit'),import('../../src/renderer/tiptap/documentSections.mjs'),import('@tiptap/pm/state'),import('@tiptap/pm/history')]);
 const schema=getSchema([StarterKit.configure({trailingNode:false}),DocumentSections]);const plugins=DocumentSections.config.addProseMirrorPlugins.call({});
 let state=EditorState.create({schema,doc:schema.nodeFromJSON(fixture()),plugins:[history(),...plugins]});const original=state.doc.toJSON();
 const dispatch=tr=>{state=state.applyTransaction(tr).state;};dispatch(state.tr.split(4));const first=state.doc.toJSON();assert.equal(sections.read(first).boundaries[0].endParagraphIndex,1);sections.validateSave(original,first);
 dispatch(state.tr.insertText('EDIT',2));sections.validateSave(first,state.doc.toJSON());
 assert.equal(undo(state,dispatch),true);assert.equal(redo(state,dispatch),true);
 const saved=envelope.parseObservablePayload(envelope.composeObservablePayload({doc:state.doc.toJSON()})).doc;assert.deepEqual(sections.read(saved),sections.read(state.doc.toJSON()));
 const beforeJoin=state.doc;let pos=0;for(let i=0;i<2;i++)pos+=state.doc.child(i).nodeSize;dispatch(state.tr.join(pos));assert.ok(state.doc.eq(beforeJoin),'join across protected boundary rejected');
});
test('actual local-file adapter retains section registry and final type',async()=>{
 const mods=await modules;const result=await require('../../src/utils/docxImportLocalFilePreview.js').createDocxImportLocalFilePreview({requestId:'sections-import'},{pickLocalFile:async()=>({path:require('node:path').join(require('node:os').tmpdir(),'sections.docx')}),readLocalFileBytes:async()=>ordinary(fixture(),mods),loadRevisionBridgeModule:async()=>mods[0]});
 assert.equal(result.importPreviewOk,true,JSON.stringify(result));assert.deepEqual(sections.read(envelope.parseObservablePayload(result.docxImportPreviewPlan.candidateCreatePlan.entries[0].content).doc),sections.read(fixture()));
});
test('full manuscript adds semantic carriers while retaining folder-group source authority',()=>{
 const scenes=[{sceneId:'first/a.txt',doc:fixture()},{sceneId:'second/b.txt',doc:{type:'doc',content:[p('Other folder')]}}];let index=0;
 const blocks=scenes.flatMap(scene=>source.buildFormatIrParagraphs({...scene,text:envelope.deriveVisibleTextFromDocument(scene.doc)}).map(block=>({...block,sceneId:scene.sceneId,documentParagraphIndex:index++})));
 const actual=source.buildFullManuscriptDocumentSections(scenes,blocks);assert.deepEqual(actual.sourceBindings.map(x=>[x.groupKey,x.sceneIds]),[['first',['first/a.txt']],['second',['second/b.txt']]]);
 assert.deepEqual(actual.protectedSections.map(x=>x.properties.type),[...sections.TYPES,'continuous','nextPage']);assert.deepEqual(actual.protectedSections.map(x=>x.endParagraphIndex),[0,1,2,3,4,5,6]);
});
test('table leaves retain global carrier positions without permitting a cell section carrier',async()=>{
 const mods=await modules,doc=fixture();const table={type:'table',content:[{type:'tableRow',content:[{type:'tableCell',content:[p('Cell')]}]}]};doc.content.splice(1,0,table);doc.attrs.wordSections.boundaries.slice(1).forEach(x=>x.endParagraphIndex++);
 const report=mods[0].buildDocxContentPreviewFromZipBytes(ordinary(doc,mods));assert.equal(report.ok,true,JSON.stringify(report));const plan=mods[0].buildDocxImportPreviewPlanFromContentPreview(report);assert.equal(plan.ok,true,JSON.stringify(plan));assert.deepEqual(sections.read(envelope.parseObservablePayload(plan.candidateCreatePlan.entries[0].content).doc),sections.read(doc));
 const invalid=structuredClone(doc);invalid.attrs.wordSections.boundaries[1].endParagraphIndex=1;assert.throws(()=>sections.read(invalid));
});
test('separated splits and within-section join project exactly, same-count cross-boundary repartition refuses',async()=>{
 const [{getSchema},{default:StarterKit},{DocumentSections},{EditorState},{history,undo,redo}]=await Promise.all([import('@tiptap/core'),import('@tiptap/starter-kit'),import('../../src/renderer/tiptap/documentSections.mjs'),import('@tiptap/pm/state'),import('@tiptap/pm/history')]);
 const schema=getSchema([StarterKit.configure({trailingNode:false}),DocumentSections]);
 const initial=sections.bind({type:'doc',content:[p('AAA'),p('BBB'),p('CCC'),p('DDD')]},{schemaVersion:1,boundaries:[{endParagraphIndex:1,properties:props('continuous')}],final:props('oddPage')});
 let state=EditorState.create({schema,doc:schema.nodeFromJSON(initial),plugins:[history(),...DocumentSections.config.addProseMirrorPlugins.call({})]});
 const dispatch=tr=>{state=state.applyTransaction(tr).state;};const start=index=>Array.from({length:index},(_,i)=>state.doc.child(i).nodeSize).reduce((a,b)=>a+b,0);
 dispatch(state.tr.split(2));dispatch(state.tr.split(start(3)+2));
 dispatch(state.tr.insertText(' typed',2));
 const split=state.doc.toJSON();assert.equal(state.doc.childCount,6);assert.equal(sections.read(split).boundaries[0].endParagraphIndex,2);sections.validateSave(initial,split);
 assert.equal(undo(state,dispatch),true);sections.validateSave(split,state.doc.toJSON());assert.equal(redo(state,dispatch),true);sections.validateSave(initial,state.doc.toJSON());
 dispatch(state.tr.join(state.doc.child(0).nodeSize));const joined=state.doc.toJSON();sections.validateSave(split,joined);assert.equal(sections.read(joined).boundaries[0].endParagraphIndex,1);
 const before=state.doc;const crossing=state.tr.join(start(2)).split(2);dispatch(crossing);assert.ok(state.doc.eq(before),'compound join crossing boundary rejected although final count matches');
 const forged=structuredClone(initial);forged.content=[p('AA'),p('ABBBCCC'),p(''),p('DDD')];assert.throws(()=>sections.project(initial,forged),/BOUNDARY_CONFLICT/);
 // Compound legitimate structural edits use exactly the same per-step projection
 // in filtering and append, including the equal final paragraph count case.
 const safe=state.tr.split(2);safe.join(safe.doc.child(0).nodeSize);assert.doesNotThrow(()=>dispatch(safe));assert.ok(state.doc.eq(before));
});

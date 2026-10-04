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
for(const container of ['heading','orderedList','bulletList','blockquote'])test(`section carriers in ${container} retain paragraph meaning through both exporters and import`,async()=>{
 const mods=await modules,doc=fixture();
 doc.content=container==='heading'?doc.content.map(node=>({...node,type:'heading',attrs:{level:3}})):container==='blockquote'?doc.content.map(node=>({type:'blockquote',content:[node]})):[{type:container,...(container==='orderedList'?{attrs:{start:3,type:'I'}}:{}),content:doc.content.map(node=>({type:'listItem',content:[node]}))}];
 assert.doesNotThrow(()=>sections.read(doc));const edited=structuredClone(doc);const first=container==='heading'?edited.content[0]:container==='blockquote'?edited.content[0].content[0]:edited.content[0].content[0].content[0];first.content[0].text+=' EDIT';sections.validateSave(doc,edited);
 for(const bytes of [ordinary(edited,mods),packet(edited)]){
  const report=mods[0].buildDocxContentPreviewFromZipBytes(bytes);assert.equal(report.ok,true,JSON.stringify(report));const plan=mods[0].buildDocxImportPreviewPlanFromContentPreview(report);assert.equal(plan.ok,true,JSON.stringify(plan));const imported=envelope.parseObservablePayload(plan.candidateCreatePlan.entries[0].content).doc;
  assert.deepEqual(sections.read(imported),sections.read(edited));assert.equal(envelope.deriveVisibleTextFromDocument(imported),envelope.deriveVisibleTextFromDocument(edited));assert.equal(imported.content[0].type,container);
 }
});
test('final-only nextPage custom geometry survives import and both exports while exact default remains legacy',async()=>{
 const mods=await modules;const geometry=props('nextPage');geometry.pageSize={widthTwips:16838,heightTwips:11906,orientation:'landscape'};geometry.columns={count:1,spaceTwips:1440};geometry.margins.leftTwips=2160;
 const doc=sections.bind({type:'doc',content:[p('Landscape text')]},{schemaVersion:1,boundaries:[],final:geometry});
 for(const bytes of [ordinary(doc,mods),packet(doc)]){
  const report=mods[0].buildDocxContentPreviewFromZipBytes(bytes);assert.equal(report.ok,true,JSON.stringify(report));const plan=mods[0].buildDocxImportPreviewPlanFromContentPreview(report);assert.equal(plan.ok,true,JSON.stringify(plan));const imported=envelope.parseObservablePayload(plan.candidateCreatePlan.entries[0].content).doc;
  assert.deepEqual(sections.read(imported),sections.read(doc));assert.equal(plan.lossReport.items.some(item=>item.category==='sectionBreak'),false);
 }
 const ordinaryPlain=ordinary({type:'doc',content:[p('Legacy')]},mods);const report=mods[0].buildDocxContentPreviewFromZipBytes(ordinaryPlain);assert.equal(report.ok,true);assert.equal(report.contentPreview.wordSections,undefined);
});
test('disabled document grid preserves optional signed latent values and requires explicit reader support',()=>{
 for(const grid of [{type:'default'},{type:'default',linePitch:360},{type:'default',linePitch:0,charSpace:-4096},{type:'default',linePitch:Number.MIN_SAFE_INTEGER,charSpace:Number.MAX_SAFE_INTEGER}]){
  const d=fixture();d.attrs.wordSections.final.docGrid=grid;
  assert.deepEqual(sections.read(d).final.docGrid,grid);
  const payload=envelope.composeObservablePayload({doc:d});assert.ok(payload.includes('word-section-doc-grid.v1'));
  assert.deepEqual(sections.read(envelope.parseObservablePayload(payload).doc).final.docGrid,grid);
  assert.ok(sections.xml(d.attrs.wordSections.final).includes('<w:docGrid w:type="default"'));
 }
 assert.equal(envelope.composeObservablePayload({doc:fixture()}).includes('word-section-doc-grid.v1'),false);
 for(const grid of [{type:'lines',linePitch:360},{type:'linesAndChars'},{type:'snapToChars'},{type:'default',linePitch:1.5},{type:'default',linePitch:Number.MAX_SAFE_INTEGER+1},{type:'default',charSpace:'0'},{type:'default',extra:0}])assert.throws(()=>sections.validateDocGrid(grid),/WORD_SECTIONS_INVALID/);
 let calls=0;const grid={type:'default'};Object.defineProperty(grid,'linePitch',{enumerable:true,get(){calls++;return 360;}});assert.throws(()=>sections.validateDocGrid(grid));assert.equal(calls,0);
});
test('disabled grids survive generic import, save and both DOCX exporters with exact latent values',async()=>{
 const mods=await modules;const original=fixture();original.attrs.wordSections.boundaries[0].properties.docGrid={type:'default',charSpace:-4096};original.attrs.wordSections.final.docGrid={type:'default',linePitch:360,charSpace:0};
 for(const exporter of ['ordinary','review']){
  let d=original;for(let round=0;round<2;round++){
   const bytes=exporter==='ordinary'?ordinary(d,mods):packet(d);
   const report=mods[0].buildDocxContentPreviewFromZipBytes(bytes);assert.equal(report.ok,true,JSON.stringify(report));
   const plan=mods[0].buildDocxImportPreviewPlanFromContentPreview(report);assert.equal(plan.ok,true,JSON.stringify(plan));
   d=envelope.parseObservablePayload(plan.candidateCreatePlan.entries[0].content).doc;
   assert.deepEqual(sections.read(d),sections.read(original));
  }
 }
});
test('authenticated section proof binds existing disabled grid values and refuses mutation or removal',async()=>{
 const mods=await modules,bridge=mods[0];const d=fixture();d.attrs.wordSections.final.docGrid={type:'default',linePitch:360,charSpace:-4096};
 const scene={sceneId:'roman/test.txt',scenePath:'/synthetic/roman/test.txt',doc:d,text:envelope.deriveVisibleTextFromDocument(d),observableContent:envelope.composeObservablePayload({doc:d}),order:0};
 const crypto=require('node:crypto'),stable=value=>Array.isArray(value)?'['+value.map(stable).join(',')+']':value&&typeof value==='object'?'{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+stable(value[key])).join(',')+'}':JSON.stringify(value);
 const cryptoPort={sha256Text:value=>crypto.createHash('sha256').update(String(value)).digest('hex'),sha256Json(value){return 'sha256:'+this.sha256Text(stable(value));},hmacSha256Text:(value,secret)=>'hmac-sha256:'+crypto.createHmac('sha256',secret).update(String(value)).digest('hex'),hmacSha256Json(value,secret){return this.hmacSha256Text(stable(value),secret);},byteLength:value=>Buffer.byteLength(String(value))};
 const input=source.buildFullManuscriptDocxReviewPacketSource({projectId:'doc-grid',projectRoot:'/synthetic',scenes:[scene]},{revisionBridge:bridge,cryptoPort,hmacSecret:'grid-test-secret',roundIdHex:'e'.repeat(32),keyIdHex:'f'.repeat(32)});
 const bytes=review.buildDocxReviewPacketBuffer(input),parsed=bridge.buildDocxReviewTransportAnalysisFromZipBytes({bytes,hmacSecret:input.forbiddenSecret,expectedAuthority:input.localAuthorityCapsule.expectedAuthority},{cryptoPort});
 const returned=parsed.reviewIr?.documentSections;assert.ok(returned,JSON.stringify(parsed));
 const signedDigest=parsed.authorityCarrier.selectedCarrier.payload.documentSectionsDigest;
 assert.equal(source.validateFullManuscriptDocumentSectionsReturn({expected:input.documentSections,returned,signedDigest}).ok,true);
 for(const mutate of [value=>value.protectedSections.at(-1).properties.docGrid.linePitch++,value=>delete value.protectedSections.at(-1).properties.docGrid,value=>value.protectedSections.at(-1).properties.docGrid.charSpace=0]){
  const changed=structuredClone(returned);mutate(changed);assert.equal(source.validateFullManuscriptDocumentSectionsReturn({expected:input.documentSections,returned:changed,signedDigest}).ok,false);
 }
 assert.equal(source.validateFullManuscriptDocumentSectionsReturn({expected:input.documentSections,returned,signedDigest:'sha256:'+'0'.repeat(64)}).ok,false);
});
test('authenticated inactive grid addition belongs only to the section end owner and preserves multi-scene topology',()=>{
 const first={type:'doc',content:[p('First')]},last={type:'doc',content:[p('Last')]};
 const exportMap={scenes:[{sceneId:'a',blocks:[{documentParagraphIndex:0}]},{sceneId:'b',blocks:[{documentParagraphIndex:1}]}]};
 const protectedSections=[{ordinal:0,startParagraphIndex:0,endParagraphIndex:1,properties:props('nextPage'),carriers:{sectionProperties:true}}];
 const additions=[{ordinal:0,docGrid:{type:'default',linePitch:360,charSpace:-4096}}];
 assert.equal(sections.planInactiveGridAdditions(first,{sceneId:'a',exportMap,protectedSections,additions}),null);
 const plan=sections.planInactiveGridAdditions(last,{sceneId:'b',exportMap,protectedSections,additions});
 assert.deepEqual(plan,{expectedRegistry:null,additions:[{endParagraphIndex:0,docGrid:additions[0].docGrid}]});
 const changed=sections.applyInactiveGridAdditions(last,plan);assert.equal(sections.read(first),null);
 assert.deepEqual(sections.read(changed),{schemaVersion:1,boundaries:[],final:{type:'nextPage',docGrid:additions[0].docGrid}});
 assert.deepEqual(last,{type:'doc',content:[p('Last')]});
 const edited=structuredClone(changed);edited.content[0].content[0].text='Changed last';
 sections.validateSaveWithGridAddition(last,edited,plan);
 assert.throws(()=>sections.validateSave(last,edited),/SAVE_AUTHORITY/);
 const forged=structuredClone(edited);forged.attrs.wordSections.final.type='continuous';assert.throws(()=>sections.validateSaveWithGridAddition(last,forged,plan),/SAVE_AUTHORITY/);
 assert.throws(()=>sections.applyInactiveGridAdditions(changed,plan),/WORD_SECTIONS_INVALID/);
 for(const mutate of [v=>v.additions[0].endParagraphIndex=1,v=>v.additions[0].docGrid.type='lines',v=>v.path='/forged',v=>v.additions.push(v.additions[0])]){const bad=structuredClone(plan);mutate(bad);assert.throws(()=>sections.applyInactiveGridAdditions(last,bad));}
 const badSource=structuredClone(protectedSections);badSource[0].properties.docGrid={type:'default'};assert.throws(()=>sections.planInactiveGridAdditions(last,{sceneId:'b',exportMap,protectedSections:badSource,additions}));
 assert.throws(()=>sections.planInactiveGridAdditions(last,{sceneId:'foreign',exportMap,protectedSections,additions}));
 let calls=0;const bad={expectedRegistry:null,additions:[]};Object.defineProperty(bad,'additions',{enumerable:true,get(){calls++;return plan.additions;}});assert.throws(()=>sections.validateInactiveGridPlan(bad));assert.equal(calls,0);
});
test('inactive grid additions preserve existing section geometry and reject a non-boundary endpoint',()=>{
 const doc=fixture(),count=require('../../src/core/word-user-bookmarks-v1.cjs').paragraphs(doc).length;
 const before=sections.read(doc),end=before.boundaries[0].endParagraphIndex;
 const plan={expectedRegistry:before,additions:[{endParagraphIndex:end,docGrid:{type:'default',linePitch:0}},{endParagraphIndex:count-1,docGrid:{type:'default',charSpace:0}}]};
 const changed=sections.applyInactiveGridAdditions(doc,plan),actual=sections.read(changed);
 delete actual.boundaries[0].properties.docGrid;delete actual.final.docGrid;assert.deepEqual(actual,before);
 const stale=structuredClone(doc);stale.attrs.wordSections.final.type='oddPage';assert.throws(()=>sections.applyInactiveGridAdditions(stale,plan));
 const invalid={expectedRegistry:before,additions:[{endParagraphIndex:count,docGrid:{type:'default'}}]};
 assert.throws(()=>sections.applyInactiveGridAdditions(doc,invalid));
});

test('end-owner inactive grid plan reexports multiple scenes without adding section breaks or changing geometry',()=>{
 const scenes=['roman/a.txt','roman/b.txt','other/c.txt'].map(sceneId=>({sceneId,text:sceneId,doc:{type:'doc',content:[p(sceneId)]}}));
 const blocks=scenes.flatMap((scene,i)=>source.buildFormatIrParagraphs(scene).map(block=>({...block,sceneId:scene.sceneId,documentParagraphIndex:i})));
 const before=source.buildFullManuscriptDocumentSections(scenes,blocks);
 assert.deepEqual(before.protectedSections.map(section=>section.endParagraphIndex),[1,2]);
 const exportMap={scenes:scenes.map((scene,i)=>({sceneId:scene.sceneId,blocks:[blocks[i]]}))};
 const additions=before.protectedSections.map(section=>({ordinal:section.ordinal,docGrid:{type:'default',linePitch:360+section.ordinal}}));
 const updated=scenes.map(scene=>{const plan=sections.planInactiveGridAdditions(scene.doc,{sceneId:scene.sceneId,exportMap,protectedSections:before,additions});return {...scene,doc:plan?sections.applyInactiveGridAdditions(scene.doc,plan):scene.doc};});
 assert.equal(sections.read(updated[0].doc),null);
 const after=source.buildFullManuscriptDocumentSections(updated,blocks);
 assert.deepEqual(after.protectedSections.map(section=>section.endParagraphIndex),[1,2]);
 for(let i=0;i<after.protectedSections.length;i++){
  assert.deepEqual(after.protectedSections[i].properties.docGrid,additions[i].docGrid);
  delete after.protectedSections[i].properties.docGrid;delete after.protectedSections[i].carriers.docGrid;
 }
 assert.deepEqual(after.protectedSections,before.protectedSections);
});

test('inactive grid rollback verifies exact inverse section effect and unchanged paragraph text',()=>{
 const before=fixture(),count=require('../../src/core/word-user-bookmarks-v1.cjs').paragraphs(before).length;
 const plan={expectedRegistry:sections.read(before),additions:[{endParagraphIndex:count-1,docGrid:{type:'default',linePitch:360}}]};
 const after=sections.applyInactiveGridAdditions(before,plan);
 sections.validateGridRollback(after,before,plan);
 const beforeBytes=JSON.stringify(before),afterBytes=JSON.stringify(after);
 sections.validateGridRollback(after,before,plan);assert.equal(JSON.stringify(before),beforeBytes);assert.equal(JSON.stringify(after),afterBytes);
 for(const mutate of [doc=>doc.attrs.wordSections.final.docGrid.linePitch++,doc=>doc.attrs.wordSections.final.type='oddPage',doc=>doc.content[0].content[0].text+=' stale',doc=>doc.content.push(p('extra'))]){
  const stale=structuredClone(after);mutate(stale);assert.throws(()=>sections.validateGridRollback(stale,before,plan));
 }
 const forged=structuredClone(plan);forged.expectedRegistry.final.type='oddPage';assert.throws(()=>sections.validateGridRollback(after,before,forged));
 const badTarget=structuredClone(before);badTarget.attrs.wordSections.final.margins.leftTwips++;assert.throws(()=>sections.validateGridRollback(after,badTarget,plan));
 assert.throws(()=>sections.validateGridRollback(before,after,plan));
});

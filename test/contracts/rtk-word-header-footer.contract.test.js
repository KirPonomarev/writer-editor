'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {buildStoredZip,buildDocxMinBuffer}=require('../../src/export/docx/docxMinBuilder.js');
const {buildDocxReviewPacketBuffer}=require('../../src/export/docx/docxReviewPacketBuilder.js');
const {buildFullManuscriptDocxReviewPacketSource}=require('../../src/export/docx/fullManuscriptDocxReviewPacketSource.js');
const {buildDocumentStoriesExport}=require('../../src/export/docx/docxReviewPacketStories.js');
const model=require('../../src/core/word-stories-v1.cjs'),envelope=require('../../src/core/document-content-envelope-v1.cjs');
const W='http://schemas.openxmlformats.org/wordprocessingml/2006/main',R='http://schemas.openxmlformats.org/officeDocument/2006/relationships',P='http://schemas.openxmlformats.org/package/2006/relationships';
const modules=Promise.all([import('../../src/io/revisionBridge/index.mjs'),import('../../src/docxPageSetupBind.mjs'),import('../../src/derived/semanticMapping.mjs'),import('../../src/derived/styleMap.mjs')]);
const paragraph=text=>({type:'paragraph',content:text?[{type:'text',text}]:[]});
function literalParts(){
 const ref=(kind,type,id)=>`<w:${kind}Reference w:type="${type}" r:id="${id}"/>`;
 const sect=extra=>`<w:sectPr>${extra}<w:type w:val="nextPage"/></w:sectPr>`;
 return [
 {name:'[Content_Types].xml',data:`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>${['header1','header2','header3','header4','footer1'].map(n=>`<Override PartName="/word/${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.${n.startsWith('header')?'header':'footer'}+xml"/>`).join('')}</Types>`},
 {name:'_rels/.rels',data:`<Relationships xmlns="${P}"><Relationship Id="main" Type="${R}/officeDocument" Target="word/document.xml"/></Relationships>`},
 {name:'word/document.xml',data:`<w:document xmlns:w="${W}" xmlns:r="${R}"><w:body><w:p><w:pPr>${sect(ref('header','default','h1')+ref('header','first','h2')+ref('header','even','h3')+ref('footer','default','f1')+'<w:titlePg/>')}</w:pPr><w:hyperlink r:id="same"><w:r><w:t>MAIN LINK</w:t></w:r></w:hyperlink></w:p><w:p><w:pPr>${sect('')}</w:pPr><w:r><w:t>INHERITED</w:t></w:r></w:p><w:p><w:r><w:t>EMPTY HEADER</w:t></w:r></w:p>${sect(ref('header','default','h4'))}</w:body></w:document>`},
 {name:'word/_rels/document.xml.rels',data:`<Relationships xmlns="${P}">${['header1','header2','header3','header4','footer1'].map(n=>`<Relationship Id="${n[0]}${n.at(-1)}" Type="${R}/${n.startsWith('header')?'header':'footer'}" Target="${n}.xml"/>`).join('')}<Relationship Id="same" Type="${R}/hyperlink" Target="https://example.invalid/main" TargetMode="External"/></Relationships>`},
 ...['DEFAULT','FIRST','EVEN',''].map((text,i)=>({name:`word/header${i+1}.xml`,data:`<w:hdr xmlns:w="${W}" xmlns:r="${R}"><w:p><w:r><w:t>${text}</w:t></w:r>${i===0?'<w:hyperlink r:id="same"><w:r><w:t>HEADER LINK</w:t></w:r></w:hyperlink>':''}</w:p></w:hdr>`})),
 {name:'word/footer1.xml',data:`<w:ftr xmlns:w="${W}"><w:p><w:r><w:t>FOOTER</w:t></w:r></w:p></w:ftr>`},
 {name:'word/_rels/header1.xml.rels',data:`<Relationships xmlns="${P}"><Relationship Id="same" Type="${R}/hyperlink" Target="https://example.invalid/header" TargetMode="External"/></Relationships>`},
 {name:'word/settings.xml',data:`<w:settings xmlns:w="${W}"><w:evenAndOddHeaders/></w:settings>`}].map(part => ({...part,data:part.data.replaceAll('<w:r>', '<w:r><w:rPr><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>')}));
}
async function importDoc(bytes){const [bridge]=await modules;const preview=bridge.buildDocxContentPreviewFromZipBytes(bytes);assert.equal(preview.ok,true,JSON.stringify(preview));const plan=bridge.buildDocxImportPreviewPlanFromContentPreview(preview);assert.equal(plan.ok,true,JSON.stringify(plan));return {doc:envelope.parseObservablePayload(plan.candidateCreatePlan.entries[0].content).doc,preview,plan};}
async function exported(doc,kind){const [,docxPageSetupBindModule,semanticMappingModule,styleMapModule]=await modules;return kind==='ordinary'?buildDocxMinBuffer({doc,bookProfile:{formatId:'A4'}},{docxPageSetupBindModule,semanticMappingModule,styleMapModule}):buildDocxReviewPacketBuffer(buildFullManuscriptDocxReviewPacketSource({projectId:'p',projectRoot:'/synthetic',scenes:[{sceneId:'roman/a.txt',scenePath:'/synthetic/roman/a.txt',order:0,doc,text:envelope.deriveVisibleTextFromDocument(doc)}]}));}
function resolvedBodies(doc){const registry=model.read(doc),byId=new Map(registry.stories.map(s=>[s.id,s.body]));return model.resolved(registry).map(section=>({titlePage:section.titlePage,...Object.fromEntries(model.ROLES.map(role=>[role,Object.fromEntries(model.VARIANTS.map(v=>[v,byId.get(section[role][v])||{type:'doc',content:[{type:'paragraph'}]}]))]))}));}
test('literal default/first/even, shared inheritance and explicit empty retain part-local link targets through five edited ordinary/Review cycles',async()=>{
 const initial=await importDoc(buildStoredZip(literalParts()));
 assert.equal(initial.doc.content[0].content[0].marks.find(m=>m.type==='link').attrs.href,'https://example.invalid/main');
 const stories=model.read(initial.doc);assert.equal(stories.stories.length,5);assert.equal(stories.evenAndOddHeaders,true);
 assert.equal(model.resolved(stories)[1].header.default,stories.sections[0].header.default);
 assert.notEqual(model.resolved(stories)[2].header.default,stories.sections[0].header.default);
 assert.equal(initial.preview.diagnostics.some(d=>/STORY/.test(d.code)&&/header|footer/.test(d.entryId||'')),false);
 const body=stories.stories.find(s=>s.id===stories.sections[0].header.default).body;
 assert.equal(body.content[0].content[1].marks.find(m=>m.type==='link').attrs.href,'https://example.invalid/header');
 for(const kind of ['ordinary','review']){let doc=initial.doc;for(let cycle=0;cycle<5;cycle++){
 const current=model.read(doc),id=current.sections[0].header.default,body=structuredClone(current.stories.find(s=>s.id===id).body);body.content[0].content[0].text+=String(cycle);
 doc=model.replaceBody(doc,id,body);const expected=resolvedBodies(doc);const next=await importDoc(await exported(doc,kind));
 assert.deepEqual(resolvedBodies(next.doc),expected,`${kind} cycle${cycle}`);doc=next.doc;
 }}
});
test('story body Save preserves immutable identity/reference topology and rejects accessors without invoking them',async()=>{
 const {doc}=await importDoc(buildStoredZip(literalParts())),value=model.read(doc);
 const edited=model.replaceBody(doc,value.stories[0].id,{type:'doc',content:[paragraph('EDIT')]});assert.doesNotThrow(()=>model.validateSave(doc,edited));
 for(const mutate of [v=>v.stories[0].role='footer',v=>v.sections[1].header.default=v.stories[1].id,v=>v.evenAndOddHeaders=false,v=>v.stories[0].id='forged']){
 const next=structuredClone(doc);mutate(next.attrs.wordStories);assert.throws(()=>model.validateSave(doc,next),/WORD_STOR/);
 }
 let calls=0;const next=structuredClone(doc);Object.defineProperty(next.attrs.wordStories.stories[0],'body',{get(){calls++;return{};},enumerable:true});assert.throws(()=>model.read(next),/WORD_STOR/);assert.equal(calls,0);
});
test('full manuscript resets absent scene stories and retains default appearance under global even-page enablement',async()=>{
 const {doc}=await importDoc(buildStoredZip(literalParts()));const a=structuredClone(doc);a.attrs.wordStories.evenAndOddHeaders=false;
 const plain={type:'doc',content:[paragraph('No header scene')]};
 const projection=buildDocumentStoriesExport([{sceneId:'a',doc:a},{sceneId:'b',doc},{sceneId:'c',doc:plain}]);
 assert.equal(projection.registry.evenAndOddHeaders,true);const resolved=model.resolved(projection.registry);
 assert.equal(resolved[0].header.even,resolved[0].header.default);assert.equal(resolved[1].header.even,resolved[1].header.default);
 assert.notEqual(resolved[3].header.even,resolved[3].header.default);
 const emptyId=resolved.at(-1).header.default;assert.deepEqual(projection.registry.stories.find(s=>s.id===emptyId).body,{type:'doc',content:[{type:'paragraph'}]});
 assert.equal(projection.sourceScenes[0].registry.evenAndOddHeaders,false);
 const source=buildFullManuscriptDocxReviewPacketSource({projectId:'p',projectRoot:'/synthetic',scenes:[a,doc,plain].map((doc,i)=>({sceneId:`roman/${i}.txt`,scenePath:`/synthetic/roman/${i}.txt`,order:i,doc,text:envelope.deriveVisibleTextFromDocument(doc)}))});
 const actual=await importDoc(buildDocxReviewPacketBuffer(source));assert.equal(model.read(actual.doc).sections.length,7);
 assert.equal(model.read(actual.doc).stories.find(s=>s.id===model.resolved(model.read(actual.doc)).at(-1).header.default).body.content[0].content?.length||0,0);
});
for(const mutation of ['missing','external','symbol','duplicate','wrong-role'])test(`header/footer ${mutation} rejects before candidate`,async()=>{
 const [bridge]=await modules;let parts=literalParts();
 if(mutation==='missing')parts=parts.filter(p=>p.name!=='word/header1.xml');
 if(mutation==='external')parts.find(p=>p.name==='word/_rels/document.xml.rels').data=parts.find(p=>p.name==='word/_rels/document.xml.rels').data.replace('Target="header1.xml"','Target="https://evil.invalid/header.xml" TargetMode="External"');
 if(mutation==='symbol')parts.find(p=>p.name==='word/header1.xml').data=parts.find(p=>p.name==='word/header1.xml').data.replace('<w:t>DEFAULT</w:t>','<w:t>A</w:t><w:sym w:font="Wingdings" w:char="F0FC"/><w:t>B</w:t>');
 if(mutation==='duplicate')parts.find(p=>p.name==='word/document.xml').data=parts.find(p=>p.name==='word/document.xml').data.replace('<w:headerReference w:type="default" r:id="h1"/>','<w:headerReference w:type="default" r:id="h1"/><w:headerReference w:type="default" r:id="h2"/>');
 if(mutation==='wrong-role')parts.find(p=>p.name==='word/document.xml').data=parts.find(p=>p.name==='word/document.xml').data.replace('r:id="h1"','r:id="f1"');
 const preview=bridge.buildDocxContentPreviewFromZipBytes(buildStoredZip(parts));assert.equal(preview.ok,false,JSON.stringify(preview));const plan=bridge.buildDocxImportPreviewPlanFromContentPreview(preview);assert.equal(plan.ok,false);assert.equal(plan.candidateCreatePlan,null);
});

test('image projection has no binary authority: strict Save and both exporters refuse forged byte identity',async()=>{
 const {doc}=await importDoc(buildStoredZip(literalParts()));
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAABAAAAAICAYAAADwdn+XAAAAFklEQVR4nGP4z8DwHx8mAo4aMPQNAADNZv8BGUNAhgAAAABJRU5ErkJggg==','base64');
 const attrs=require('../../src/io/documentMedia.js').createImageAttrs(png,{alt:'Header PNG',displayName:'header.png'});
 const id=model.read(doc).stories[0].id;
 const good=model.replaceBody(doc,id,{type:'doc',content:[{type:'paragraph',content:[{type:'image',attrs}]}]});
 assert.doesNotThrow(()=>model.readProjection(good));assert.doesNotThrow(()=>model.validateSave(doc,good));
 const bad=structuredClone(good),image=bad.attrs.wordStories.stories[0].body.content[0].content[0];
 image.attrs.sha256='0'.repeat(64);image.attrs.assetId=`sha256-${image.attrs.sha256}`;image.attrs.assetPath=`assets/media/${image.attrs.sha256}.png`;
 assert.doesNotThrow(()=>model.readProjection(bad));
 assert.throws(()=>model.read(bad),/DOCUMENT_MEDIA_IDENTITY/);
 assert.throws(()=>model.validateSave(doc,bad),/DOCUMENT_MEDIA_IDENTITY/);
 for(const kind of ['ordinary','review'])await assert.rejects(exported(bad,kind),/DOCUMENT_MEDIA_IDENTITY/);
 let calls=0;const body={type:'doc'};Object.defineProperty(body,'content',{get(){calls++;return[];},enumerable:true});
 assert.throws(()=>model.replaceBodyProjection(doc,id,body),/WORD_STORIES_INVALID/);assert.equal(calls,0);
});

test('explicit empty self-closing header retains empty override through ordinary and Review exports',async()=>{
 const parts=literalParts();parts.find(p=>p.name==='word/header4.xml').data=`<w:hdr xmlns:w="${W}"/>`;
 const {doc}=await importDoc(buildStoredZip(parts));
 for(const kind of ['ordinary','review']){
 const next=await importDoc(await exported(doc,kind));
 assert.deepEqual(resolvedBodies(next.doc),resolvedBodies(doc));
 }
});

test('Core story intents create native slots, copy inheritance, clear or relink without losing peers or geometry',async()=>{
 const native={type:'doc',content:[paragraph('NATIVE')]};
 const trustedSections={schemaVersion:1,boundaries:[],final:{type:'nextPage',columns:{count:2,spaceTwips:400}}};
 assert.throws(()=>model.planStoryMutation(native,{op:'create',sectionIndex:0,role:'header',variant:'default'}),/TRUSTED_GEOMETRY/);
 const created=model.planStoryMutation(native,{op:'create',sectionIndex:0,role:'header',variant:'default'},{trustedSections,idSeed:'native-create'});
 assert.deepEqual(native,{type:'doc',content:[paragraph('NATIVE')]});
 assert.deepEqual(created.doc.attrs.wordSections,trustedSections);
 assert.match(created.storyId,/^story-[a-f0-9]{64}$/u);
 let next=model.planStoryMutation(created.doc,{op:'create',sectionIndex:0,role:'footer',variant:'even'},{idSeed:'native-footer'}).doc;
 next=model.planStoryMutation(next,{op:'setSectionOptions',sectionIndex:0,titlePage:true,evenAndOddHeaders:true}).doc;
 assert.equal(model.read(next).stories.length,2);assert.equal(model.read(next).sections[0].titlePage,true);
 assert.equal(model.read(next).evenAndOddHeaders,true);
 const {doc}=await importDoc(buildStoredZip(literalParts())),before=model.read(doc), original=JSON.stringify(doc);
 const copied=model.planStoryMutation(doc,{op:'create',sectionIndex:1,role:'header',variant:'default'},{idSeed:'copy-inherited'});
 const copiedValue=model.read(copied.doc);
 assert.notEqual(copied.storyId,before.sections[0].header.default);
 assert.deepEqual(copiedValue.stories.find(s=>s.id===copied.storyId).body,before.stories.find(s=>s.id===before.sections[0].header.default).body);
 assert.deepEqual(copied.doc.attrs.wordSections,doc.attrs.wordSections);
 const removed=model.planStoryMutation(copied.doc,{op:'remove',sectionIndex:1,role:'header',variant:'default'},{idSeed:'clear-inherited'});
 assert.deepEqual(model.read(removed.doc).stories.find(s=>s.id===removed.storyId).body,{type:'doc',content:[{type:'paragraph'}]});
 assert.equal(model.read(removed.doc).stories.some(s=>s.id===copied.storyId),false);
 const relinked=model.planStoryMutation(removed.doc,{op:'linkPrevious',sectionIndex:1,role:'header',variant:'default'});
 assert.equal(relinked.storyId,before.sections[0].header.default);
 assert.deepEqual(model.read(relinked.doc),before);assert.equal(JSON.stringify(doc),original);
 for(const kind of ['ordinary','review'])assert.deepEqual(resolvedBodies((await importDoc(await exported(removed.doc,kind))).doc),resolvedBodies(removed.doc));
 for(const intent of [
 {op:'create',sectionIndex:-1,role:'header',variant:'default'},
 {op:'create',sectionIndex:3,role:'header',variant:'default'},
 {op:'create',sectionIndex:0,role:'header',variant:'default',storyId:'forged'},
 {op:'create',sectionIndex:0,role:'header',variant:'wrong'},
 {op:'linkPrevious',sectionIndex:0,role:'header',variant:'default'},
 {op:'setSectionOptions',sectionIndex:0,titlePage:'true'},
 ])assert.throws(()=>model.planStoryMutation(doc,intent),/WORD_STOR/);
});

test('flags-only zero-story authoring retains first/even semantics through ordinary and Review',async()=>{
 for(const flags of [{titlePage:true},{evenAndOddHeaders:true},{titlePage:true,evenAndOddHeaders:true}]){
 const doc=model.planStoryMutation({type:'doc',content:[paragraph('FLAGS')]},
 {op:'setSectionOptions',sectionIndex:0,...flags},{trustedSections:{schemaVersion:1,boundaries:[],final:{type:'nextPage'}}}).doc;
 assert.equal(model.read(doc).stories.length,0);
 for(const kind of ['ordinary','review']){
 const next=(await importDoc(await exported(doc,kind))).doc,registry=model.read(next);
 assert.equal(registry.evenAndOddHeaders,Boolean(flags.evenAndOddHeaders));
 assert.equal(registry.sections[0].titlePage,Boolean(flags.titlePage));
 assert.deepEqual(resolvedBodies(next),resolvedBodies(doc));
 }
 }
});

test('Core fresh IDs never recycle a removed identity, while trusted seed regeneration is deterministic',async()=>{
 const {doc}=await importDoc(buildStoredZip(literalParts()));
 const intent={op:'create',sectionIndex:1,role:'header',variant:'default'};
 for(const op of ['create','remove']) for(const idSeed of [undefined,'',42,'x'.repeat(1025)])
  assert.throws(()=>model.planStoryMutation(doc,{...intent,op},idSeed===undefined?{}:{idSeed}),/WORD_STORY_ID_SEED/);
 const first=model.planStoryMutation(doc,intent,{idSeed:'allocation-1'});
 const linked=model.planStoryMutation(first.doc,{...intent,op:'linkPrevious'});
 const second=model.planStoryMutation(linked.doc,intent,{idSeed:'allocation-2'});
 assert.notEqual(second.storyId,first.storyId);
 assert.deepEqual(model.planStoryMutation(doc,intent,{idSeed:'trusted-request-1'}),model.planStoryMutation(doc,intent,{idSeed:'trusted-request-1'}));
 assert.notEqual(model.planStoryMutation(doc,intent,{idSeed:'trusted-request-2'}).storyId,model.planStoryMutation(doc,intent,{idSeed:'trusted-request-1'}).storyId);
});

test('private return reference planner preserves canonical shared aliases and rejects transport ID or cross-role authority',async()=>{
 const {doc}=await importDoc(buildStoredZip(literalParts())), original=structuredClone(doc);
 const intent={sectionIndex:1,role:'header',variant:'even',sourceSectionIndex:0,sourceVariant:'default'};
 const planned=model.planStoryReference(doc,intent),value=model.read(planned.doc);
 assert.equal(planned.storyId,model.read(doc).sections[0].header.default);
 assert.equal(model.resolved(value)[2].header.even,planned.storyId);
 assert.deepEqual(doc,original);assert.deepEqual(planned.doc.content,doc.content);
 assert.deepEqual(planned.doc.attrs.wordSections,doc.attrs.wordSections);
 assert.deepEqual(value.stories.find(s=>s.id===planned.storyId),model.read(doc).stories.find(s=>s.id===planned.storyId));
 for(const bad of [{...intent,storyId:'external'}, {...intent,sourceSectionIndex:3}, {...intent,sourceVariant:'missing'},
 {...intent,role:'footer',sourceVariant:'even'}, {...intent,sourceRole:'footer'}])assert.throws(()=>model.planStoryReference(doc,bad),/WORD_STOR/);
 let getterCalls=0;const accessor={...intent};Object.defineProperty(accessor,'sourceSectionIndex',{enumerable:true,get(){getterCalls++;return 0;}});
 assert.throws(()=>model.planStoryReference(doc,accessor),/WORD_STOR/);assert.equal(getterCalls,0);
 for(const kind of ['ordinary','review'])assert.deepEqual(resolvedBodies((await importDoc(await exported(planned.doc,kind))).doc),resolvedBodies(planned.doc));
});

test('empty Review story projection binds actual shared folder sections without changing exported layout',async()=>{
 const docs=[{type:'doc',content:[paragraph('ONE'),paragraph('TWO')]},{type:'doc',content:[paragraph('THREE')]}];
 const scenes=docs.map((doc,i)=>({sceneId:`roman/${i}.txt`,scenePath:`/synthetic/roman/${i}.txt`,order:i,doc,text:envelope.deriveVisibleTextFromDocument(doc)}));
 const source=buildFullManuscriptDocxReviewPacketSource({projectId:'p',projectRoot:'/synthetic',scenes});
 assert.equal(source.documentSections.protectedSections.length,1);
 const projection=source.documentStories;
 assert.deepEqual(projection.registry.stories,[]);assert.equal(projection.registry.sections.length,1);
 assert.deepEqual(projection.sourceScenes.map(s=>[s.sectionStart,s.sectionCount]),[[0,1],[0,1]]);
 for(const binding of projection.sourceScenes){
 assert.equal(binding.registry,null);assert.deepEqual(binding.trustedSections.boundaries,[]);
 assert.deepEqual(binding.trustedSections.final,source.documentSections.protectedSections[0].properties);
 const scene=scenes.find(s=>s.sceneId===binding.sceneId);
 const created=model.planStoryMutation(scene.doc,{op:'create',sectionIndex:0,role:'header',variant:'default'},{trustedSections:binding.trustedSections,idSeed:'first-header'});
 assert.deepEqual(created.doc.content,scene.doc.content);
 }
 assert.equal(buildDocumentStoriesExport(scenes,source.documentSections),null,'ordinary helper behavior remains unchanged');
 const withProjection=buildDocxReviewPacketBuffer(source),withoutProjection=buildDocxReviewPacketBuffer({...source,documentStories:null});
 const [bridge]=await modules;
 const withReport=bridge.buildDocxContentPreviewFromZipBytes(withProjection),withoutReport=bridge.buildDocxContentPreviewFromZipBytes(withoutProjection);
 assert.equal(withReport.ok,true);assert.equal(withoutReport.ok,true);
 assert.deepEqual(withReport.contentPreview.paragraphs,withoutReport.contentPreview.paragraphs);
 assert.deepEqual(withReport.contentPreview.wordSections,withoutReport.contentPreview.wordSections);
 assert.equal(withReport.contentPreview.wordStories,undefined);
});

test('envelope optional story admission rejects raw accessors and keeps absent/null consumers dependency-compatible',()=>{
 const fs=require('node:fs'),vm=require('node:vm');let loads=0,executed=0;
 const sandbox={module:{exports:{}},require(name){
  if(name==='./word-stories-projection-v1.cjs'){loads++;throw Error('STORY_MODULE_NOT_COPIED');}
  if(name==='./word-pending-text-revisions-v1.cjs')return {readLedger(){return null;}};
  if(name==='./word-list-format-v1.cjs')return require('../../src/core/word-list-format-v1.cjs');
  if(name==='./word-list-numbering-v1.cjs')return require('../../src/core/word-list-numbering-v1.cjs');
  throw Error('Unexpected module '+name);
 }};
 vm.runInNewContext(fs.readFileSync(require.resolve('../../src/core/document-content-envelope-v1.cjs'),'utf8'),sandbox);
 const doc={type:'doc',content:[paragraph('legacy')]};
 assert.doesNotThrow(()=>sandbox.module.exports.canonicalizeDocumentJson(doc));
 assert.doesNotThrow(()=>sandbox.module.exports.canonicalizeDocumentJson({...doc,attrs:{wordStories:null}}));assert.equal(loads,0);
 const hostile={...doc,attrs:{}};Object.defineProperty(hostile.attrs,'wordStories',{enumerable:true,get(){executed++;return {};}});
 assert.throws(()=>envelope.canonicalizeDocumentJson(hostile),/WORD_STORIES_INVALID/);assert.equal(executed,0);
 assert.throws(()=>sandbox.module.exports.canonicalizeDocumentJson({...doc,attrs:{wordStories:{}}}),/STORY_MODULE_NOT_COPIED/);assert.equal(loads,1);
});

test('full Review export preserves rich headers and raw plain/empty siblings in every scene order',async()=>{
 const {doc}=await importDoc(buildStoredZip(literalParts()));
 const richRaw=envelope.composeObservablePayload({doc});
 const originals=[
 {sceneId:'roman/rich.txt',doc,text:envelope.deriveVisibleTextFromDocument(doc),observableContent:richRaw},
 {sceneId:'roman/plain.txt',doc:null,text:'PLAIN FIRST\r\n\r\nPLAIN LAST',observableContent:'PLAIN FIRST\r\n\r\nPLAIN LAST'},
 {sceneId:'roman/empty.txt',doc:null,text:'',observableContent:''},
 ];
 const before=JSON.stringify(originals),sha=value=>'sha256:'+require('node:crypto').createHash('sha256').update(value).digest('hex');
 for(const order of [[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]]){
 const scenes=order.map((index,i)=>({...originals[index],order:i,scenePath:'/synthetic/'+originals[index].sceneId}));
 const source=buildFullManuscriptDocxReviewPacketSource({projectId:'p',projectRoot:'/synthetic',scenes});
 const actual=await importDoc(buildDocxReviewPacketBuffer(source));
 assert.equal(source.documentSections.protectedSections.length,5);
 const resolved=resolvedBodies(actual.doc);
 assert.equal(resolved.length,5);
 for(const binding of source.documentStories.sourceScenes){
 const original=scenes.find(scene=>scene.sceneId===binding.sceneId);
 const expected=original.doc?resolvedBodies(original.doc):[{titlePage:false,
 header:Object.fromEntries(model.VARIANTS.map(v=>[v,{type:'doc',content:[{type:'paragraph'}]}])),
 footer:Object.fromEntries(model.VARIANTS.map(v=>[v,{type:'doc',content:[{type:'paragraph'}]}]))}];
 assert.deepEqual(resolved.slice(binding.sectionStart,binding.sectionStart+binding.sectionCount),expected);
 const capsule=source.localAuthorityCapsule;
 assert.equal(capsule.baselineObservableContentBySceneId[original.sceneId]??capsule.baselineFinalTextBySceneId[original.sceneId],original.observableContent);
 assert.equal(capsule.exportMap.scenes.find(scene=>scene.sceneId===original.sceneId).rawSha256,sha(original.observableContent));
 }
 assert.equal(JSON.stringify(originals),before);
 }
 const malformed={...doc,content:[{type:'unsupported'}]};
 assert.throws(()=>buildFullManuscriptDocxReviewPacketSource({projectId:'p',projectRoot:'/synthetic',scenes:[{sceneId:'roman/bad.txt',doc:malformed,text:'bad',order:0}, {...originals[1],order:1}]}));
});

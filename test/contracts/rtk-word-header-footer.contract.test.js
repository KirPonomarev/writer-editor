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

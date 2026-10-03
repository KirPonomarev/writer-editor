'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const model=require('../../src/core/word-paragraph-layout-v1.cjs');
const envelope=require('../../src/core/document-content-envelope-v1.cjs');
const invalid=fn=>assert.throws(fn,/WORD_PARAGRAPH_LAYOUT_INVALID/);
test('layout preserves raw twips, stops, zero and native opposite special-indent inheritance',()=>{
 assert.deepEqual(model.normalizeWordParagraphIndent({left:-120,right:0,firstLine:240}),{left:-120,right:0,firstLine:240});
 assert.deepEqual(model.mergeWordParagraphIndent({left:1080,hanging:360},{firstLine:240}),{left:1080,firstLine:240});
 assert.deepEqual(model.mergeWordParagraphIndent({firstLine:240},{hanging:0}),{hanging:0});
 assert.deepEqual(model.mergeWordParagraphTabs([{pos:567,val:'left'},{pos:1701,val:'right'}],[{pos:567,val:'clear'},{pos:2268,val:'decimal',leader:'dot'}]),[{pos:567,val:'clear'},{pos:1701,val:'right'},{pos:2268,val:'decimal',leader:'dot'}]);
 assert.equal(model.normalizeWordDefaultTabStop(567),567);
});
test('layout rejects coercion, sparse/accessor stops, unknown units and unsupported zero default',()=>{
 for(const input of [0,-1,31681,'567',null,NaN])invalid(()=>model.normalizeWordDefaultTabStop(input));
 for(const input of [{left:'720'},{leftChars:100},{hanging:-1},{left:31681}])invalid(()=>model.normalizeWordParagraphIndent(input));
 for(const input of [[{pos:567,val:'left'},{pos:567,val:'right'}],Array(1),[{pos:567,val:'left',unknown:1}],[{pos:0,val:'clear',leader:'dot'}]])invalid(()=>model.normalizeWordParagraphTabs(input));
 let calls=0;const input={};Object.defineProperty(input,'left',{enumerable:true,get(){calls++;return 0;}});invalid(()=>model.normalizeWordParagraphIndent(input));assert.equal(calls,0);
});
test('layout envelope preserves root and paragraph values with required feature and placement checks',()=>{
 const doc={type:'doc',attrs:{wordDefaultTabStop:567},content:[{type:'paragraph',attrs:{wordParagraphIndent:{left:720},wordParagraphTabs:[{pos:1701,val:'left'}]},content:[{type:'text',text:'A\tB'}]}]};
 const serialized=envelope.composeObservablePayload({doc});
 assert.deepEqual(envelope.parseObservablePayload(serialized).doc,doc);
 assert.match(serialized,/word-paragraph-layout.v1/);
 invalid(()=>model.inspectDocumentParagraphLayout({type:'doc',content:[{type:'paragraph',attrs:{wordDefaultTabStop:567}}]}));
});
const crypto=require('node:crypto');
const cryptoPort={sha256Text:v=>crypto.createHash('sha256').update(String(v)).digest('hex'),sha256Json:v=>'sha256:'+crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex'),byteLength:v=>Buffer.byteLength(String(v))};
const W='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
test('style scanner resolves inherited stops, clears and native special-indent while preserving literal tab offsets',async()=>{
 const {extractReviewTransportFormattingRunsV2:scan}=await import('../../src/io/revisionBridge/reviewTransportPackageParserV2.mjs');
 const result=scan(`<w:document xmlns:w="${W}"><w:body><w:p><w:pPr><w:pStyle w:val="Child"/><w:ind w:firstLine="240"/><w:tabs><w:tab w:pos="567" w:val="clear"/></w:tabs></w:pPr><w:r><w:t>A</w:t><w:tab/><w:t>B</w:t></w:r></w:p></w:body></w:document>`,{cryptoPort,stylesXml:`<w:styles xmlns:w="${W}"><w:style w:type="paragraph" w:styleId="Base"><w:pPr><w:ind w:left="1080" w:hanging="360"/><w:tabs><w:tab w:pos="567" w:val="left"/><w:tab w:pos="1701" w:val="right" w:leader="dot"/></w:tabs></w:pPr></w:style><w:style w:type="paragraph" w:styleId="Child"><w:basedOn w:val="Base"/></w:style></w:styles>`,settingsXml:`<w:settings xmlns:w="${W}"><w:defaultTabStop w:val="567"/></w:settings>`});
 assert.equal(result.ok,true,JSON.stringify(result));assert.deepEqual(result.documentProperties,{effective:567,explicit:true});
 const paragraph=result.paragraphs[0];assert.equal(paragraph.paragraphText,'A\tB');assert.deepEqual(paragraph.unsupportedParagraphNames,[]);
 assert.deepEqual(paragraph.paragraphState.wordParagraphIndent,{left:1080,firstLine:240});assert.deepEqual(paragraph.paragraphState.wordParagraphTabs,[{pos:567,val:'clear'},{pos:1701,val:'right',leader:'dot'}]);
});
test('root settings rejects duplicate, foreign, nested and unknown attributes rather than defaulting',async()=>{
 const {extractDocumentDefaultTabStopV1:read}=await import('../../src/io/revisionBridge/reviewTransportPackageParserV2.mjs');
 assert.deepEqual(read('',{cryptoPort}),{effective:720,explicit:false});
 for(const inner of ['<w:defaultTabStop w:val="567"/><w:defaultTabStop w:val="720"/>','<w:defaultTabStop w:val="567" w:x="1"/>','<w:defaultTabStop w:val="567"><w:b/></w:defaultTabStop>','<x:defaultTabStop xmlns:x="wrong" w:val="567"/>'])assert.throws(()=>read(`<w:settings xmlns:w="${W}">${inner}</w:settings>`,{cryptoPort}),/WORD_DEFAULT_TAB_STOP_INVALID/);
});
test('document root action preserves content, combines paragraph actions, rejects duplicate root and forged selector',async()=>{
 const runtime=await import('../../src/io/revisionBridge/reviewTransportFormattingReturnRuntime.mjs');
 const doc={type:'doc',attrs:{wordDefaultTabStop:567},content:[{type:'paragraph',content:[{type:'text',text:'A\tB'}]}]};
 const input=envelope.composeObservablePayload({doc});
 const op={kind:'document-properties',operationId:'root-1',sceneId:'scene1',sourceAuthority:'authenticated-full-manuscript-export-map-document-properties-v1',sourceSceneRevision:'sha256:'+'a'.repeat(64),sourceRawSha256:'sha256:'+'b'.repeat(64),document:{wordDefaultTabStop:{action:'set',value:960}}};
 const applied=runtime.applyFormattingOperationsToObservableContent(input,[op]);assert.equal(applied.ok,true,JSON.stringify(applied));
 const parsed=envelope.parseObservablePayload(applied.content);assert.equal(parsed.doc.attrs.wordDefaultTabStop,960);assert.deepEqual(parsed.doc.content,doc.content);
 assert.equal(runtime.applyFormattingOperationsToObservableContent(input,[op,{...op,operationId:'root2'}]).ok,false);
 assert.equal(runtime.applyFormattingOperationsToObservableContent(input,[{...op,blockId:'fake'}]).ok,false);
});
test('ordinary and homogeneous full Review preserve literal root and paragraph layout; mixed defaults refuse',async()=>{
 const bridge=await import('../../src/io/revisionBridge/index.mjs');
 const {buildDocxMinBuffer}=require('../../src/export/docx/docxMinBuilder.js');
 const {buildDocxReviewPacketBuffer}=require('../../src/export/docx/docxReviewPacketBuilder.js');
 const {buildFullManuscriptDocxReviewPacketSource:source}=require('../../src/export/docx/fullManuscriptDocxReviewPacketSource.js');
 const [docxPageSetupBindModule,semanticMappingModule,styleMapModule]=await Promise.all([import('../../src/docxPageSetupBind.mjs'),import('../../src/derived/semanticMapping.mjs'),import('../../src/derived/styleMap.mjs')]);
 const doc={type:'doc',attrs:{wordDefaultTabStop:567},content:[{type:'paragraph',attrs:{wordParagraphIndent:{left:720,firstLine:240},wordParagraphTabs:[{pos:1701,val:'decimal',leader:'dot'}]},content:[{type:'text',text:'A\t12.34'}]}]};
 const scene=(doc,i)=>({sceneId:`roman/${i}.txt`,scenePath:`/synthetic/roman/${i}.txt`,order:i,doc,text:'A\t12.34'});
 const full=source({projectId:'p',projectRoot:'/synthetic',scenes:[scene(doc,0),scene(doc,1)]});
 assert.equal(full.wordDefaultTabStop,567);assert.deepEqual(full.localAuthorityCapsule.exportMap.scenes.map(s=>s.documentFormatIr),[{wordDefaultTabStop:567,explicit:true},{wordDefaultTabStop:567,explicit:true}]);
 for(const bytes of [await buildDocxMinBuffer({doc,bookProfile:{formatId:'A4'}},{docxPageSetupBindModule,semanticMappingModule,styleMapModule}),buildDocxReviewPacketBuffer(full)]){
  const report=bridge.buildDocxContentPreviewFromZipBytes(bytes);assert.equal(report.ok,true,JSON.stringify(report));const plan=bridge.buildDocxImportPreviewPlanFromContentPreview(report);assert.equal(plan.ok,true,JSON.stringify(plan));
  const imported=envelope.parseObservablePayload(plan.candidateCreatePlan.entries[0].content).doc;assert.equal(imported.attrs.wordDefaultTabStop,567);
  for(const paragraph of imported.content){assert.deepEqual(paragraph.attrs.wordParagraphIndent,doc.content[0].attrs.wordParagraphIndent);assert.deepEqual(paragraph.attrs.wordParagraphTabs,doc.content[0].attrs.wordParagraphTabs);assert.equal(paragraph.content.map(n=>n.text||'').join(''),'A\t12.34');}
 }
 const other=structuredClone(doc);other.attrs.wordDefaultTabStop=720;
 assert.throws(()=>source({projectId:'p',projectRoot:'/synthetic',scenes:[scene(doc,0),scene(other,1)]}),/WORD_DEFAULT_TAB_STOP_MIXED_SCENES/);
});
test('root and paragraph action accessors reject without evaluation',async()=>{
 const runtime=await import('../../src/io/revisionBridge/reviewTransportFormattingReturnRuntime.mjs');
 const base={kind:'document-properties',operationId:'root',sceneId:'scene',sourceAuthority:'authenticated-full-manuscript-export-map-document-properties-v1',sourceSceneRevision:'sha256:'+'a'.repeat(64),sourceRawSha256:'sha256:'+'b'.repeat(64),document:{wordDefaultTabStop:{action:'set',value:851}}};let calls=0;
 for(const mutate of [op=>Object.defineProperty(op,'document',{enumerable:true,get(){calls++;return{};}}),op=>Object.defineProperty(op.document.wordDefaultTabStop,'value',{enumerable:true,get(){calls++;return851;}}),op=>Object.defineProperty(op.document.wordDefaultTabStop,'action',{enumerable:true,get(){calls++;return'set';}})]){const op=structuredClone(base);mutate(op);assert.equal(runtime.applyFormattingOperationsToObservableContent('plain',[op]).ok,false);}
 assert.equal(calls,0);
});
test('generic layout rejects foreign properties and orphan/mistyped settings ownership',async()=>{
 const bridge=await import('../../src/io/revisionBridge/index.mjs');const {buildStoredZip}=require('../../src/export/docx/docxMinBuilder.js');
 const parts=[{name:'[Content_Types].xml',data:'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/></Types>'},{name:'_rels/.rels',data:'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="doc" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'},{name:'word/_rels/document.xml.rels',data:'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="settings" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/></Relationships>'},{name:'word/document.xml',data:`<w:document xmlns:w="${W}"><w:body><w:p><w:pPr><w:ind w:left="720"/></w:pPr><w:r><w:t>Keep</w:t></w:r></w:p></w:body></w:document>`},{name:'word/settings.xml',data:`<w:settings xmlns:w="${W}"><w:defaultTabStop w:val="567"/></w:settings>`}];
 assert.equal(bridge.buildDocxContentPreviewFromZipBytes(buildStoredZip(parts)).ok,true);
 for(const mutate of [p=>p.find(p=>p.name==='word/document.xml').data=p.find(p=>p.name==='word/document.xml').data.replace('<w:ind w:left="720"/>','<x:ind xmlns:x="wrong" w:left="720"/>'),p=>p.splice(p.findIndex(p=>p.name==='word/_rels/document.xml.rels'),1),p=>{const part=p.find(p=>p.name==='[Content_Types].xml');part.data=part.data.replace('wordprocessingml.settings+xml','wordprocessingml.styles+xml');}]){const next=structuredClone(parts);mutate(next);const report=bridge.buildDocxContentPreviewFromZipBytes(buildStoredZip(next));assert.equal(report.ok,false,JSON.stringify(report));assert.equal(bridge.buildDocxImportPreviewPlanFromContentPreview(report).ok,false);}
});

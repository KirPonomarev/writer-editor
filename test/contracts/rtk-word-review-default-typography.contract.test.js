const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const {buildFormatIrParagraphs}=require('../../src/export/docx/fullManuscriptDocxReviewPacketSource.js');
const {buildDocxReviewPacketBuffer}=require('../../src/export/docx/docxReviewPacketBuilder.js');
const modules=Promise.all([import('../../src/io/revisionBridge/reviewTransportCleanLinkLabel.mjs'),import('../../src/io/revisionBridge/index.mjs'),import('../../src/renderer/documentContentEnvelope.mjs'),import('../../src/io/revisionBridge/exactTextMinSafeWrite.mjs')]);
const typography={schemaVersion:'yalken.review-docx.typography-defaults.v1',fontSize:'12pt'};
const sceneId='roman/y0.txt',href='https://example.invalid/y0#target';
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const cryptoPort={sha256Text:hash,sha256Json:x=>hash(JSON.stringify(x)),byteLength:x=>Buffer.byteLength(x)};
test('Word language scene feature survives durable reopen and prevents old-reader silent loss',()=>{
 const e=require('../../src/core/document-content-envelope-v1.cjs');
 const doc={type:'doc',content:[{type:'paragraph',attrs:{wordParagraphMarkLanguage:{val:'en-US'}},content:[
  {type:'text',text:'original'},
  {type:'text',text:' appended',marks:[{type:'textStyle',attrs:{wordLanguage:{val:'en-US',eastAsia:'ja-JP',bidi:'ar-SA'}}}]}]}]};
 const raw=e.composeObservablePayload({doc,metaEnabled:false});
 assert.match(raw,/"requiredFeatures":\["word-language.v1"\]/u);
 assert.deepEqual(e.parseObservablePayload(raw).doc,e.canonicalizeDocumentJson(doc));
 const legacy={type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'old'}]}]};
 assert.deepEqual(e.parseObservablePayload(e.composeObservablePayload({doc:legacy,metaEnabled:false})).doc,legacy);
 // Execute the exact predecessor reader from retained main ancestry. Its blob
 // is identical to the old intermediate commit, which a squash does not retain.
 const vm=require('node:vm'),cp=require('node:child_process'),module={exports:{}};
 const old=cp.execFileSync('git',['show','a2a5ae6cbefffce13475a0f71a3de3252d9deac6:src/core/document-content-envelope-v1.cjs'],{encoding:'utf8'});
 vm.runInNewContext(old,{module,exports:module.exports,require:id=>require(path.resolve(__dirname,'../../src/core',id))});
 assert.equal(module.exports.parseObservablePayload(raw).issue?.reason,'DOC_BLOCK_REQUIRED_FEATURES_UNSUPPORTED');
 for(const value of [{val:'en_US'},{val:''},{val:'en-US',ignored:'drop'},[],{val:42},{}]){
  const bad=structuredClone(doc);bad.content[0].content[1].marks[0].attrs.wordLanguage=value;
  assert.throws(()=>e.composeObservablePayload({doc:bad}),/WORD_LANGUAGE/u);
 }
});
test('Word language XML retains separate run and paragraph-mark tuples in digest-bound evidence',async()=>{
 const [,b]=await modules;
 const bytes=fontDefaultsPackage({paragraphProperties:'<w:pPr><w:rPr><w:lang w:val="en-US"/></w:rPr></w:pPr>',runProperties:'<w:rPr><w:lang w:val="ru-RU" w:eastAsia="ja-JP" w:bidi="ar-SA"/></w:rPr>'});
 const result=b.buildDocxReviewTransportAnalysisFromZipBytes({bytes},{cryptoPort});
 const p=result.reviewIr?.formattingParagraphs[0];assert.ok(p,JSON.stringify(result));
 assert.deepEqual(p.wordParagraphMarkLanguage,{val:'en-US'});
 assert.deepEqual(p.formattedRuns[0].wordLanguage,{val:'ru-RU',eastAsia:'ja-JP',bidi:'ar-SA'});
 const other=b.buildDocxReviewTransportAnalysisFromZipBytes({bytes:fontDefaultsPackage({runProperties:'<w:rPr><w:lang w:val="en-US"/></w:rPr>'})},{cryptoPort});
 assert.notEqual(result.supportedSemanticDigest,other.supportedSemanticDigest);
});
test('Word language survives actual editor schema and review DOCX export without leaking paragraph-mark scope',async()=>{
 const [{getSchema},{default:StarterKit},{DocumentTextStyle},{DocumentParagraphAlignment}]=await Promise.all([
  import('@tiptap/core'),import('@tiptap/starter-kit'),import('../../src/renderer/tiptap/documentTextStyle.mjs'),import('../../src/renderer/tiptap/documentParagraphAlignment.mjs')]);
 const schema=getSchema([StarterKit,DocumentTextStyle,DocumentParagraphAlignment]);
 const doc={type:'doc',content:[{type:'paragraph',attrs:{wordParagraphMarkLanguage:{val:'en-US'}},content:[
  {type:'text',text:'original'}, {type:'text',text:' appended',marks:[{type:'textStyle',attrs:{wordLanguage:{val:'ru-RU',eastAsia:'ja-JP',bidi:'ar-SA'}}}]}]}]};
 const live=schema.nodeFromJSON(doc);live.check();const reopened=schema.nodeFromJSON(live.toJSON()).toJSON();
 assert.deepEqual(reopened.content[0].attrs.wordParagraphMarkLanguage,{val:'en-US'});
 assert.equal(reopened.content[0].content[0].marks,undefined);
 assert.deepEqual(reopened.content[0].content[1].marks[0].attrs.wordLanguage,{val:'ru-RU',eastAsia:'ja-JP',bidi:'ar-SA'});
 const blocks=buildFormatIrParagraphs({sceneId,doc:reopened,text:'original appended'}).map((p,i)=>({...p,blockId:'b'+i,paragraphId:'p'+i}));
 assert.deepEqual(blocks[0].formatIr.runs[0].inline,{});
 const xml=storedParts(buildDocxReviewPacketBuffer({blocks,customProperties:[{name:'YRTK_C01_AUTH',value:'test-authority'},{name:'YRTK2_TOKEN',value:'test-token'}]})).find(p=>p.name==='word/document.xml').data.toString();
 assert.match(xml,/<w:pPr><w:rPr><w:lang w:val="en-US"\/><\/w:rPr><\/w:pPr>/u);
 assert.match(xml,/<w:rPr><w:lang w:val="ru-RU" w:eastAsia="ja-JP" w:bidi="ar-SA"\/><\/w:rPr><w:t[^>]*> appended<\/w:t>/u);
 assert.match(xml,/<w:r><w:t[^>]*>original<\/w:t><\/w:r>/u);
 const [docxPageSetupBindModule,semanticMappingModule,styleMapModule]=await Promise.all([import('../../src/docxPageSetupBind.mjs'),import('../../src/derived/semanticMapping.mjs'),import('../../src/derived/styleMap.mjs')]);
 const minimal=require('../../src/export/docx/docxMinBuilder.js').buildDocxMinBuffer({doc:reopened,bookProfile:{formatId:'A4'}},{docxPageSetupBindModule,semanticMappingModule,styleMapModule});
 const minimalXml=storedParts(minimal).find(p=>p.name==='word/document.xml').data.toString();
 assert.match(minimalXml,/<w:rPr><w:lang w:val="en-US"\/><\/w:rPr><\/w:pPr>/u);
 assert.match(minimalXml,/<w:lang w:val="ru-RU" w:eastAsia="ja-JP" w:bidi="ar-SA"\/>/u);
});
for(const lang of ['<w:lang/>','<w:lang w:val="en_US"/>','<w:lang w:val="en-US"/><w:lang w:val="ru-RU"/>','<w:lang val="en-US"/>','<w:lang w:val="en-US" w:unknown="ignored"/>','<w:lang w:val="en-US"><w:b/></w:lang>','<w:lang w:val="en-US">ignored</w:lang>','<x:lang xmlns:x="urn:foreign" w:val="en-US"/>'])test('Word language malformed literal XML is not admissible: '+lang,async()=>{
 const [,b]=await modules;
 const result=b.buildDocxReviewTransportAnalysisFromZipBytes({bytes:fontDefaultsPackage({runProperties:'<w:rPr>'+lang+'</w:rPr>',paragraphProperties:'<w:pPr><w:rPr>'+lang+'</w:rPr></w:pPr>'})},{cryptoPort});
 const p=result.reviewIr?.formattingParagraphs[0];
 assert.ok(!result.ok || (p?.wordLanguageInvalid===true && p.formattedRuns[0].wordLanguageInvalid===true));
 assert.notEqual(p?.wordParagraphMarkLanguageOnly,true);
});
test('Word language raw accessors, foreign owners and forged segment shapes cannot acquire semantics',()=>{
 const core=require('../../src/core/word-language-v1.cjs'),e=require('../../src/core/document-content-envelope-v1.cjs');let calls=0;
 const tuple={};Object.defineProperty(tuple,'val',{enumerable:true,get(){calls++;return 'en-US';}});
 assert.throws(()=>core.normalizeWordLanguage(tuple),/WORD_LANGUAGE/);assert.equal(calls,0);
 assert.throws(()=>core.normalizeWordLanguage(Object.create({val:'en-US'})),/WORD_LANGUAGE/);
 const doc={type:'doc',attrs:{wordParagraphMarkLanguage:{val:'en-US'}},content:[]};
 assert.throws(()=>e.composeObservablePayload({doc}),/WORD_LANGUAGE/);
 const p={type:'paragraph',content:[{type:'text',text:'a🌋b',marks:[{type:'bold'}]}]};
 const patch={schemaVersion:1,paragraphMark:null,runs:[{from:0,to:4,language:{val:'en-US'}}]};
 assert.deepEqual(core.applyParagraphLanguage(p,patch).content[0].marks,[{type:'bold'},{type:'textStyle',attrs:{wordLanguage:{val:'en-US'}}}]);
 for(const mutate of [v=>v.runs[0].from=1,v=>v.runs[0].to=3,v=>v.runs.push({...v.runs[0]}),v=>v.runs[0].language={val:'bad_tag'},v=>v.runs[0].fontFamily='Arial',v=>v.paragraphMark={},v=>v.runs=[{from:0,to:2,language:null},{from:2,to:4,language:null}]]){
  const bad=structuredClone(patch);mutate(bad);assert.throws(()=>core.applyParagraphLanguage(p,bad),/WORD_LANGUAGE/);
 }
});
test('language validation admits repeated serialized values but rejects ancestry cycles and wrong mark owners',()=>{
 const core=require('../../src/core/word-language-v1.cjs'),e=require('../../src/core/document-content-envelope-v1.cjs');
 const mark={type:'textStyle',attrs:{wordLanguage:{val:'en-US'}}};
 const paragraph={type:'paragraph',content:[{type:'text',text:'shared',marks:[mark]}]};
 const doc={type:'doc',content:[paragraph,paragraph]};
 assert.equal(core.inspectDocumentLanguage(doc),true);
 assert.deepEqual(e.parseObservablePayload(e.composeObservablePayload({doc})).doc,doc);
 const absent={type:'paragraph',content:[{type:'text',text:'absent'}]};
 assert.deepEqual(e.parseObservablePayload(e.composeObservablePayload({doc:{type:'doc',content:[absent,absent]}})).doc,{type:'doc',content:[absent,absent]});
 const cycle={type:'doc',content:[]};cycle.content.push(cycle);
 assert.throws(()=>core.inspectDocumentLanguage(cycle),/WORD_LANGUAGE/);
 assert.throws(()=>e.composeObservablePayload({doc:cycle}),/WORD_LANGUAGE/);
 assert.throws(()=>core.inspectDocumentLanguage({type:'doc',content:[paragraph,{type:'paragraph',marks:[mark]}]}),/WORD_LANGUAGE/);
});
function fixture({explicitSize,returnedSize='12pt',bind=true}={}) {
 const doc={type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'original',marks:[{type:'link',attrs:{href}},...(explicitSize?[{type:'textStyle',attrs:{fontSize:explicitSize}}]:[])]}]}]};
 const baselineParagraphs=buildFormatIrParagraphs({sceneId,text:'original',doc});
 const returnedParagraphs=[{paragraphIndex:0,paragraphText:'изменено',paragraphState:{},paragraphStructure:{nodeType:'paragraph'},formattedRuns:[{from:0,to:8,text:'изменено',inlineState:{link:href},inheritedFontSize:returnedSize,unsupportedNames:[]}]}];
 return {sceneId,doc,baselineParagraphs,returnedParagraphs,reviewIr:{},...(bind?{exportTypography:structuredClone(typography)}:{})};
}
test('bound serialization default admits label-only unstyled Y0 without inventing canonical formatting',async t=>{
 const [m,,e,w]=await modules,f=fixture(),result=m.analyzeCleanLinkLabelReturn(f);assert.equal(result.ok,true,JSON.stringify(result));assert.equal(result.canWriteManuscript,false);
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'word-y0-default-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const scenePath=path.join(root,sceneId);fs.mkdirSync(path.dirname(scenePath));const before=e.composeObservablePayload({doc:f.doc,metaEnabled:false});fs.writeFileSync(scenePath,before);
 const input={projectRoot:root,projectSnapshot:{projectId:'p',baselineHash:'b',scenes:[{sceneId,text:before}]},revisionSession:{projectId:'p',sessionId:'s',baselineHash:'b',status:'open',reviewGraph:{textChanges:[result.change]}},reviewItems:[result.change],scenePath,scenePathBySceneId:{[sceneId]:scenePath}};
 const applied=await w.applyExactTextBatchMinSafeWrite(input,{operationId:'op_y0_default'});assert.equal(applied.applied,true,JSON.stringify(applied));
 const expected=structuredClone(f.doc);expected.content[0].content[0].text='изменено';assert.deepEqual(e.parseObservablePayload(fs.readFileSync(scenePath,'utf8')).doc,expected);
});
for(const fault of ['unbound','wrong-default','unknown-key','wrong-version','returned-size','explicit-baseline','missing-returned-size','target','style'])test('bound typography rejects '+fault,async()=>{
 const [m]=await modules,f=fixture(),r=f.returnedParagraphs[0].formattedRuns[0];
 if(fault==='unbound')delete f.exportTypography;
 if(fault==='wrong-default')f.exportTypography.fontSize='18pt';
 if(fault==='unknown-key')f.exportTypography.ignoreChanges=true;
 if(fault==='wrong-version')f.exportTypography.schemaVersion='other';
 if(fault==='returned-size')r.inheritedFontSize='18pt';
 if(fault==='explicit-baseline')Object.assign(f,fixture({explicitSize:'14pt'}));
 if(fault==='missing-returned-size')delete r.inheritedFontSize;
 if(fault==='target')r.inlineState.link='https://example.invalid/other';
 if(fault==='style')r.inlineState.bold=true;
 assert.equal(m.analyzeCleanLinkLabelReturn(f).ok,false);
});
test('explicit canonical size remains authoritative over serialized default',async()=>{
 const [m]=await modules,f=fixture({explicitSize:'14pt',returnedSize:'14pt'});assert.equal(m.analyzeCleanLinkLabelReturn(f).ok,true);
 const g=fixture();g.returnedParagraphs[0].formattedRuns[0].inlineState.fontSize='18pt';assert.equal(m.analyzeCleanLinkLabelReturn(g).ok,false);
});
function storedParts(bytes) {
 const parts=[];let offset=0;
 while(bytes.readUInt32LE(offset)===0x04034b50){const n=bytes.readUInt16LE(offset+26),e=bytes.readUInt16LE(offset+28),size=bytes.readUInt32LE(offset+18),start=offset+30+n+e;assert.equal(bytes.readUInt16LE(offset+8),0);parts.push({name:bytes.subarray(offset+30,offset+30+n).toString(),data:bytes.subarray(start,start+size)});offset=start+size;}
 return parts;
}
test('real review export declares default bytes and parser independently resolves them',async()=>{
 const [m,b]=await modules,f=fixture();const paragraphs=f.baselineParagraphs;
 const zip=buildDocxReviewPacketBuffer({blocks:paragraphs.map((p,i)=>({...p,blockId:'b'+i,paragraphId:'p'+i})),customProperties:[{name:'YRTK_C01_AUTH',value:'test-authority'},{name:'YRTK2_TOKEN',value:'test-token'}]});
 const parts=storedParts(zip),styles=parts.find(p=>p.name==='word/styles.xml').data.toString();
 assert.match(styles,/<w:docDefaults><w:rPrDefault><w:rPr><w:sz w:val="24"\/><w:szCs w:val="24"\/>/);
 const {buildStoredZip}=require('../../src/export/docx/docxMinBuilder.js');
 for(const size of ['24','36']){
  // The native Word return strips advisory custom XML. This fixture isolates
  // the same public Word parts; it never overrides an unsupported diagnostic.
  const changed=parts.filter(p=>p.name.startsWith('word/')).map(p=>({name:p.name,data:p.name==='word/document.xml'?p.data.toString().replace('original','изменено'):p.name==='word/styles.xml'?p.data.toString().replace(/w:val="24"/g,'w:val="'+size+'"'):p.data}));
  changed.push({name:'[Content_Types].xml',data:'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/></Types>'},
   {name:'_rels/.rels',data:'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="doc" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'});
  const result=b.buildDocxReviewTransportAnalysisFromZipBytes({bytes:buildStoredZip(changed)},{cryptoPort});
  assert.ok(result.reviewIr,JSON.stringify(result));
  const input={...f,returnedParagraphs:result.reviewIr.formattingParagraphs,reviewIr:result.reviewIr};
  assert.equal(input.returnedParagraphs[0].formattedRuns[0].inheritedFontSize,size==='24'?'12pt':'18pt');
  assert.equal(m.analyzeCleanLinkLabelReturn(input).ok,size==='24',JSON.stringify({analysis:m.analyzeCleanLinkLabelReturn(input),paragraphs:input.returnedParagraphs,unsupported:input.reviewIr.opaqueUnsupported,structure:input.reviewIr.structureChanges}));
 }
});

function fontDefaultsPackage({fonts='<w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman" w:cs="Times New Roman"/>',extraDefaults='',styles='',paragraphProperties='',runProperties='',table=false}={}) {
 const {buildStoredZip}=require('../../src/export/docx/docxMinBuilder.js');
 const ns='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
 const paragraph='<w:p>'+paragraphProperties+'<w:r>'+runProperties+'<w:t xml:space="preserve"> </w:t></w:r></w:p>';
 return buildStoredZip([
  {name:'word/document.xml',data:'<w:document xmlns:w="'+ns+'"><w:body>'+(table?'<w:tbl><w:tblPr/><w:tblGrid><w:gridCol w:w="1000"/></w:tblGrid><w:tr><w:tc><w:tcPr/>'+paragraph+'</w:tc></w:tr></w:tbl>':paragraph)+'</w:body></w:document>'},
  {name:'word/styles.xml',data:'<w:styles xmlns:w="'+ns+'"><w:docDefaults><w:rPrDefault><w:rPr>'+fonts+'</w:rPr></w:rPrDefault></w:docDefaults>'+extraDefaults+styles+'</w:styles>'},
  {name:'[Content_Types].xml',data:'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>'},
  {name:'_rels/.rels',data:'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="doc" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'},
 ]);
}
test('literal document font defaults are separate digest-bound evidence, never fabricated inline formatting',async()=>{
 const [,b]=await modules;
 const parse=options=>b.buildDocxReviewTransportAnalysisFromZipBytes({bytes:fontDefaultsPackage(options)},{cryptoPort});
 const result=parse(),run=result.reviewIr?.formattingParagraphs[0].formattedRuns[0];
 assert.ok(run,JSON.stringify(result));assert.equal(run.resolvedFontFamily,'Times New Roman');
 assert.equal(Object.hasOwn(run.inlineState,'fontFamily'),false);
 const other=parse({fonts:'<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial"/>'});
 assert.equal(other.reviewIr.formattingParagraphs[0].formattedRuns[0].resolvedFontFamily,'Arial');
 assert.notEqual(result.supportedSemanticDigest,other.supportedSemanticDigest);
});
for(const fault of ['theme','duplicate-font','mixed-font','missing-script-font','duplicate-defaults','based-on','character-override','duplicate-style','paragraph-style','run-style','explicit-font'])test('font defaults evidence refuses '+fault,async()=>{
 const [,b]=await modules,options={};
 const fonts='<w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman" w:cs="Times New Roman"/>';
 if(fault==='theme')options.fonts=fonts.replace('/>',' w:asciiTheme="minorHAnsi"/>');
 if(fault==='duplicate-font')options.fonts=fonts+fonts;
 if(fault==='mixed-font')options.fonts=fonts.replace('w:cs="Times New Roman"','w:cs="Arial"');
 if(fault==='missing-script-font')options.fonts=fonts.replace(' w:cs="Times New Roman"','');
 if(fault==='duplicate-defaults')options.extraDefaults='<w:docDefaults><w:rPrDefault><w:rPr>'+fonts+'</w:rPr></w:rPrDefault></w:docDefaults>';
 if(fault==='based-on')options.styles='<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:basedOn w:val="Other"/></w:style>';
 if(fault==='character-override')options.styles='<w:style w:type="character" w:default="1" w:styleId="Default"><w:rPr>'+fonts+'</w:rPr></w:style>';
 if(fault==='duplicate-style')options.styles='<w:style w:type="paragraph" w:default="1" w:styleId="A"/><w:style w:type="paragraph" w:default="1" w:styleId="B"/>';
 if(fault==='paragraph-style')options.paragraphProperties='<w:pPr><w:pStyle w:val="Normal"/></w:pPr>';
 if(fault==='run-style')options.runProperties='<w:rPr><w:rStyle w:val="Default"/></w:rPr>';
 if(fault==='explicit-font')options.runProperties='<w:rPr>'+fonts+'</w:rPr>';
 const result=b.buildDocxReviewTransportAnalysisFromZipBytes({bytes:fontDefaultsPackage(options)},{cryptoPort});
 const run=result.reviewIr?.formattingParagraphs[0]?.formattedRuns[0];
 assert.ok(run,JSON.stringify(result));assert.equal(Object.hasOwn(run,'resolvedFontFamily'),false);
});

test('table font defaults remain digest-bound inheritance and competing table text styles refuse',async()=>{
 const [,b]=await modules;
 const parse=options=>b.buildDocxReviewTransportAnalysisFromZipBytes({bytes:fontDefaultsPackage({table:true,...options})},{cryptoPort});
 const normal=parse(),paragraph=normal.reviewIr.formattingParagraphs[0],run=paragraph.formattedRuns[0];
 assert.ok(paragraph.table);assert.equal(run.resolvedFontFamily,'Times New Roman');assert.equal(Object.hasOwn(run.inlineState,'fontFamily'),false);
 const arial=parse({fonts:'<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial"/>'});
 assert.equal(arial.reviewIr.formattingParagraphs[0].formattedRuns[0].resolvedFontFamily,'Arial');assert.notEqual(normal.supportedSemanticDigest,arial.supportedSemanticDigest);
 const competing=parse({styles:'<w:style w:type="table" w:default="1" w:styleId="Table"><w:rPr><w:b/></w:rPr></w:style>'});
 assert.ok(competing.reviewIr.formattingParagraphs[0].unsupportedParagraphNames.includes('styleResolution'));
 assert.equal(Object.hasOwn(competing.reviewIr.formattingParagraphs[0].formattedRuns[0],'resolvedFontFamily'),false);
});

test('language set and removal preserve typed break metadata and adjacent text exactly',()=>{
 const core=require('../../src/core/word-language-v1.cjs'),env=require('../../src/core/document-content-envelope-v1.cjs');
 const tuple={val:'ru-FI',eastAsia:'ru-RU',bidi:'ar-SA'};
 for(const kind of ['line','page','column']){
  const paragraph={type:'paragraph',content:[{type:'text',text:'A',marks:[{type:'italic'}]},{type:'hardBreak',...(kind==='line'?{}:{attrs:{wordBreakType:kind}}),marks:[{type:'bold'},{type:'textStyle',attrs:{fontFamily:'Georgia',color:'#123456'}}]},{type:'text',text:'B',marks:[{type:'underline'}]}]};
  const before=structuredClone(paragraph);
  const change={schemaVersion:1,paragraphMark:null,runs:[{from:0,to:1,language:null},{from:1,to:2,language:tuple},{from:2,to:3,language:null}]};
  const applied=core.applyParagraphLanguage(paragraph,change);
  const expected=structuredClone(before);expected.content[1].marks[1].attrs.wordLanguage=tuple;
  assert.deepEqual(applied,expected);assert.deepEqual(paragraph,before);
  const doc={type:'doc',content:[applied]},raw=env.composeObservablePayload({doc,metaEnabled:false});
  assert.deepEqual(env.parseObservablePayload(raw).doc,env.canonicalizeDocumentJson(doc));
  assert.match(raw,/word-language.v1/u);
  const removal=structuredClone(change);removal.runs[1].language=null;
  assert.deepEqual(core.applyParagraphLanguage(applied,removal),before);
  for(const bad of [{val:'ru_FI'},{val:'ru-FI',unknown:'x'},[],{}]){
   const invalid=structuredClone(change);invalid.runs[1].language=bad;
   assert.throws(()=>core.applyParagraphLanguage(paragraph,invalid),/WORD_LANGUAGE/u);assert.deepEqual(paragraph,before);
   const malformed=structuredClone(doc);malformed.content[0].content[1].marks[1].attrs.wordLanguage=bad;
   assert.throws(()=>env.composeObservablePayload({doc:malformed}),/WORD_LANGUAGE/u);
  }
 }
});

test('Paragraph mark typography: real editor schema and durable reopen retain explicit off without visible run leakage',async()=>{
 const [{getSchema},{default:StarterKit},{DocumentTextStyle},{DocumentParagraphAlignment}]=await Promise.all([import('@tiptap/core'),import('@tiptap/starter-kit'),import('../../src/renderer/tiptap/documentTextStyle.mjs'),import('../../src/renderer/tiptap/documentParagraphAlignment.mjs')]);
 const e=require('../../src/core/document-content-envelope-v1.cjs'),schema=getSchema([StarterKit,DocumentTextStyle,DocumentParagraphAlignment]);
 const tuple={bold:true,italic:false,fontFamily:'Georgia',fontSize:'14pt'},doc={type:'doc',content:[{type:'paragraph',attrs:{wordParagraphMarkTypography:tuple},content:[{type:'text',text:'italic',marks:[{type:'italic'}]}]},{type:'paragraph',attrs:{wordParagraphMarkTypography:tuple},content:[]}]};
 const live=schema.nodeFromJSON(doc);live.check();const raw=e.composeObservablePayload({doc:live.toJSON()}),parsed=e.parseObservablePayload(raw);assert.equal(parsed.issue,null);
 const reopened=schema.nodeFromJSON(parsed.doc);reopened.check();assert.deepEqual(reopened.toJSON().content.map(p=>p.attrs.wordParagraphMarkTypography),[tuple,tuple]);
 assert.deepEqual(reopened.toJSON().content[0].content[0].marks,[{type:'italic'}]);assert.equal(reopened.toJSON().content[1].content,undefined);assert.match(raw,/word-paragraph-mark-typography.v1/);
});

test('Paragraph mark typography: closed values reject malformed state before invoking accessors and preserve legacy bytes',()=>{
 const v=require('../../src/io/inlineTypography.cjs'),e=require('../../src/core/document-content-envelope-v1.cjs');
 for(const tuple of [{},{bold:1},{italic:'false'},{fontFamily:'serif'},{fontSize:'1.2pt'},{fontSize:'1639pt'},{color:'red'},{highlight:'#123'},{rawXml:'<w:b/>'},[],Object.create({bold:true})])assert.throws(()=>v.normalizeParagraphMarkTypography(tuple));
 let calls=0;const getter={};Object.defineProperty(getter,'bold',{enumerable:true,get(){calls++;return true;}});assert.throws(()=>v.normalizeParagraphMarkTypography(getter));assert.equal(calls,0);
 const symbol={bold:true};symbol[Symbol('hidden')]=true;assert.throws(()=>v.normalizeParagraphMarkTypography(symbol));
 const doc={type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'legacy'}]}]},raw=e.composeObservablePayload({doc});
 assert.deepEqual(e.parseObservablePayload(raw).doc,doc);assert.doesNotMatch(raw,/word-paragraph-mark-typography/);
 for(const bad of [{...doc,attrs:{wordParagraphMarkTypography:{bold:true}}},{type:'doc',content:[{type:'text',text:'wrong',attrs:{wordParagraphMarkTypography:{bold:true}}}]}])assert.throws(()=>e.composeObservablePayload({doc:bad}));
});
test('Paragraph mark typography: predecessor refuses required feature retained only by Original and round history',()=>{
 const e=require('../../src/core/document-content-envelope-v1.cjs'),review=require('../../src/core/word-pending-text-revisions-v1.cjs'),recording=require('../../src/core/word-pending-recording-v1.cjs');
 const before={type:'doc',content:[{type:'paragraph',attrs:{wordParagraphMarkTypography:{bold:false,fontFamily:'Georgia',fontSize:'14pt'}},content:[]}]},after={type:'doc',content:[{type:'paragraph',content:[]}]};
 const pending=recording.derive(before,after,{author:'Owner',date:'2026-10-05T12:00:00.000Z'}).doc;
 const frame=review.roundFrame(review.readLedger(pending));const history=review.bindLedger({schemaVersion:2,source:after,revisions:[],undo:[],redo:[],roundUndo:[frame],roundRedo:[],returnReceipts:[]});
 const oldModule={exports:{}},old=require('node:child_process').execFileSync('git',['show','4b9fb5f3ff3029d85722a4655ca47cc0c3cfb583:src/core/document-content-envelope-v1.cjs'],{encoding:'utf8'});
 require('node:vm').runInNewContext(old,{module:oldModule,exports:oldModule.exports,require:id=>require(path.resolve(__dirname,'../../src/core',id))});
 for(const doc of [pending,history]){assert.equal(doc.content[0].attrs?.wordParagraphMarkTypography,undefined);const raw=e.composeObservablePayload({doc});assert.match(raw,/word-paragraph-mark-typography.v1/);assert.equal(e.parseObservablePayload(raw).issue,null);assert.equal(oldModule.exports.parseObservablePayload(raw).issue.reason,'DOC_BLOCK_REQUIRED_FEATURES_UNSUPPORTED');}
});

test('Paragraph mark typography: optional raw detection rejects hidden/getter fields without changing legacy absent loading',()=>{
 const e=require('../../src/core/document-content-envelope-v1.cjs');let calls=0;
 for(const descriptor of [{enumerable:true,get(){calls++;throw Error('getter must not execute');}},{enumerable:false,value:{bold:true}}]){
  const doc={type:'doc',content:[{type:'paragraph',attrs:{},content:[]}]};Object.defineProperty(doc.content[0].attrs,'wordParagraphMarkTypography',descriptor);
  assert.throws(()=>e.canonicalizeDocumentJson(doc),/WORD_PARAGRAPH_MARK_TYPOGRAPHY_INVALID/);assert.equal(calls,0);
 }
 const fs=require('node:fs'),vm=require('node:vm'),real=require('node:module').createRequire(require.resolve('../../src/core/document-content-envelope-v1.cjs'));let loads=0;
 const sandbox={module:{exports:{}},require(name){if(name==='../io/inlineTypography.cjs'){loads++;throw Error('MARK_VALIDATOR_NOT_COPIED');}return real(name);}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../../src/core/document-content-envelope-v1.cjs'),'utf8'),sandbox);
 for(const attrs of [undefined,{wordParagraphMarkTypography:null}])assert.doesNotThrow(()=>sandbox.module.exports.canonicalizeDocumentJson({type:'doc',content:[{type:'paragraph',...(attrs?{attrs}:{}),content:[]}]}));
 assert.equal(loads,0);assert.throws(()=>sandbox.module.exports.canonicalizeDocumentJson({type:'doc',content:[{type:'paragraph',attrs:{wordParagraphMarkTypography:{bold:false}},content:[]}]}),/MARK_VALIDATOR_NOT_COPIED/);assert.equal(loads,1);
});

test('Paragraph mark fontSlots: closed literal tuple rejects malformed hidden accessor symbol theme and scalar conflict',()=>{
 const v=require('../../src/io/inlineTypography.cjs');let calls=0;
 const accessor={};Object.defineProperty(accessor,'ascii',{enumerable:true,get(){calls++;return 'Arial';}});
 const hidden={};Object.defineProperty(hidden,'ascii',{value:'Arial'});const symbol={ascii:'Arial'};symbol[Symbol('slot')]='Georgia';
 for(const slots of [{},{ascii:'Arial',hAnsi:'Arial',eastAsia:'Arial',cs:'Arial'},[],{ascii:'serif'},{asciiTheme:'minorHAnsi'},{ascii:{theme:'minorHAnsi'}},{ascii:'Arial',extra:'Georgia'},Object.create({ascii:'Arial'}),accessor,hidden,symbol])assert.throws(()=>v.normalizeParagraphMarkTypography({fontSlots:slots}));
 assert.equal(calls,0);assert.throws(()=>v.normalizeParagraphMarkTypography({fontFamily:'Arial',fontSlots:{ascii:'Arial'}}));
 assert.deepEqual(v.normalizeParagraphMarkTypography({fontSlots:{hAnsi:'Georgia',ascii:'Arial'}}),{fontSlots:{ascii:'Arial',hAnsi:'Georgia'}});
});


function freshBodySource(doc,nonTextReturnState) {
 const {buildFullManuscriptDocxReviewPacketSource}=require('../../src/export/docx/fullManuscriptDocxReviewPacketSource.js');
 return buildFullManuscriptDocxReviewPacketSource({projectId:'project-body-profile',...(nonTextReturnState?{nonTextReturnState}:{}),scenes:[{sceneId,doc,text:require('../../src/core/document-content-envelope-v1.cjs').deriveVisibleTextFromDocument(doc),order:0}]},
  {createdAtUtc:'2026-10-07T00:00:00.000Z',roundIdHex:'ab'.repeat(16),keyIdHex:'cd'.repeat(16),hmacSecret:'owned-local-body-profile-test',cryptoPort:{sha256Text:x=>'sha256:'+hash(x),sha256Json:x=>'sha256:'+hash(JSON.stringify(x,(_key,value)=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.keys(value).sort().map(key=>[key,value[key]])):value)),hmacSha256Json:(x,key)=>'hmac-sha256:'+crypto.createHmac('sha256',key).update(JSON.stringify(x)).digest('hex'),byteLength:x=>Buffer.byteLength(x)}});
}
function actualBodyPublication(doc,bridge) {
 const vm=require('node:vm'),mainPath=require.resolve('../../src/main.js'),main=fs.readFileSync(mainPath,'utf8'),rq=require('node:module').createRequire(mainPath),producer=rq('./export/docx/fullManuscriptDocxReviewPacketSource.js'),envelope=rq('./core/document-content-envelope-v1.cjs');
 const names=['stableRtkReviewTransportJson','createRtkReviewTransportCryptoPort','normalizeRtkSignedSha256','buildFullManuscriptProvisionalSelfParse','docxReviewReturnIntakeProductBudgets','decodeDocxCustomPropertyText','extractDocxCustomPropertyValue','extractDocxReviewReturnYrtk2PropertiesFromCustomXml','extractDocxReviewReturnYrtk2PropertiesFromParserResult','verifyDocxReviewReturnYrtk2Binding','buildFullManuscriptPublicationGate'];
 const context=vm.createContext({crypto,Buffer,require:rq,isPlainObjectValue:x=>!!x&&typeof x==='object'&&!Array.isArray(x),docxReviewPreviewSessionDetailString:x=>typeof x==='string'?x:'',sha256DocxReviewPreviewSessionBytes:hash,cloneJsonSafe:x=>JSON.parse(JSON.stringify(x)),docxReviewReturnIntakeBlocked:code=>({ok:false,code}),validateFullManuscriptDocumentSectionsReturn:producer.validateFullManuscriptDocumentSectionsReturn});
 vm.runInContext(main.match(/const DOCX_REVIEW_RETURN_INTAKE_FULL_MANUSCRIPT_PRODUCT_BUDGETS = Object.freeze\([^]*?\n}\);/)[0]+'\n'+names.map(name=>{const declaration=main.match(new RegExp('function '+name+'\\([^]*?\\n}(?=\\n|$)'));assert.ok(declaration,name);return declaration[0];}).join('\n'),context);
 const raw=envelope.composeObservablePayload({doc}),source=producer.buildFullManuscriptDocxReviewPacketSource({projectId:'synthetic-publication-observation',projectRoot:'/synthetic',scenes:[{sceneId,scenePath:'/synthetic/'+sceneId,text:envelope.deriveVisibleTextFromDocument(doc),doc,observableContent:raw,order:0}]},{revisionBridge:bridge,cryptoPort:context.createRtkReviewTransportCryptoPort()});
 return {source,raw,bytes:buildDocxReviewPacketBuffer(source),publish:(bytes,candidate=source)=>context.buildFullManuscriptPublicationGate(candidate,bytes,bridge)};
}
for(const kind of ['boundary','paragraph-mark'])test('checked carrier actual Main publication '+kind,async()=>{
 const [,bridge]=await modules,review=require('../../src/core/word-pending-text-revisions-v1.cjs'),recording=require('../../src/core/word-pending-recording-v1.cjs'),envelope=require('../../src/core/document-content-envelope-v1.cjs');
 const p=text=>({type:'paragraph',content:[{type:'text',text}]}),before={type:'doc',content:[p('AB')]};
 if(kind==='paragraph-mark')before.content[0].attrs={wordParagraphMarkTypography:{fontFamily:'Arial',fontSize:'12pt',bold:false}};
 const working=kind==='boundary'?{type:'doc',content:[p('A'),p('B')]}:structuredClone(before);
 if(kind==='paragraph-mark')working.content[0].attrs.wordParagraphMarkTypography={fontFamily:'Georgia',fontSize:'14pt',bold:true};
 const doc=recording.derive(before,working,{author:'Synthetic Writer',date:'2026-10-05T12:00:03.000Z'}).doc,captured=structuredClone(doc),f=actualBodyPublication(doc,bridge),map=structuredClone(f.source.localAuthorityCapsule.exportMap);
 const result=await f.publish(f.bytes);assert.equal(result.ok,true,JSON.stringify(result));assert.equal(result.publishAllowed,true,JSON.stringify(result));
 const analysis=bridge.buildDocxReviewTransportAnalysisFromZipBytes({bytes:f.bytes},{cryptoPort});assert.equal(analysis.ok,true);
 for(const row of analysis.reviewIr.formattingParagraphs){assert.equal(row.effectiveParagraphMarkTypographyInvalid,undefined);assert.equal(row.paragraphFormattingInvalid,false);assert.deepEqual(row.unsupportedParagraphNames,[]);assert.deepEqual(row.effectiveParagraphMarkTypography,kind==='paragraph-mark'?{fontFamily:'Georgia',fontSize:'14pt',bold:true}:{fontFamily:'Times New Roman',fontSize:'12pt'});assert.deepEqual(row.wordParagraphMarkLanguage,{val:'en-US',eastAsia:'en-US',bidi:'en-US'});assert.deepEqual(row.paragraphState.wordParagraphSpacing,{before:0,after:0,line:240,lineRule:'auto'});}
 const xml=bridge.extractDocxReviewTransportPackagePartsFromZipBytes({bytes:f.bytes}).parts['word/document.xml'],family=kind==='paragraph-mark'?'Georgia':'Times New Roman',size=kind==='paragraph-mark'?'28':'24';
 assert.ok(xml.includes('<w:rFonts w:ascii="'+family+'" w:hAnsi="'+family+'" w:eastAsia="'+family+'" w:cs="'+family+'"/>'));assert.ok(xml.includes('<w:sz w:val="'+size+'"/><w:szCs w:val="'+size+'"/>'));
 const parsed=bridge.buildDocxContentPreviewFromZipBytes(f.bytes);assert.equal(parsed.ok,true,JSON.stringify(parsed));assert.equal(review.projection(parsed.contentPreview.pendingRevisionDocument).current,kind==='boundary'?'A\nB':'AB');assert.equal(review.projection(parsed.contentPreview.pendingRevisionDocument).original,'AB');
 const ledger=review.readLedger(parsed.contentPreview.pendingRevisionDocument);assert.equal(ledger.revisions[0].author,'Synthetic Writer');assert.equal(ledger.revisions[0].dateUtc,'2026-10-05T12:00:03.000Z');
 if(kind==='paragraph-mark'){assert.match(xml,/<w:rPrChange[^>]*>[\s\S]*?<w:rFonts w:ascii="Arial"/u);assert.deepEqual(ledger.revisions[0].format.before.attrs.wordParagraphMarkTypography,{bold:false,fontFamily:'Arial',fontSize:'12pt'});assert.deepEqual(ledger.revisions[0].format.after.attrs.wordParagraphMarkTypography,{bold:true,fontFamily:'Georgia',fontSize:'14pt'});}
 // Rehash only the existing actual provisional artifact identity. The
 // source/capsule semantics stay original; this valid property edit reaches BODY.
 const provisional=bridge.extractDocxReviewTransportPackagePartsFromZipBytes({bytes:f.source.provisionalSelfParseArtifact.bytes}).parts,original=provisional['word/document.xml'];provisional['word/document.xml']=original.replace('<w:sz w:val="'+size+'"/>','<w:sz w:val="36"/>').replace('<w:szCs w:val="'+size+'"/>','<w:szCs w:val="36"/>');assert.notEqual(provisional['word/document.xml'],original);
 const changed=require('../../src/export/docx/docxMinBuilder.js').buildStoredZip(Object.entries(provisional).map(([name,data])=>({name,data}))),candidate={...f.source,provisionalSelfParseArtifact:{...f.source.provisionalSelfParseArtifact,bytes:changed},advisoryManifest:{...f.source.advisoryManifest,coreManifest:{...f.source.advisoryManifest.coreManifest,artifactIdentities:{...f.source.advisoryManifest.coreManifest.artifactIdentities,provisionalDocxSha256:'sha256:'+hash(changed)}}}},denied=await f.publish(f.bytes,candidate);
 assert.equal(denied.ok,false,JSON.stringify(denied));assert.equal(denied.code,'RTK_V4_PUBLICATION_BODY_TYPOGRAPHY_MISMATCH');assert.equal(denied.reason,'WORD_BODY_READBACK_PROVISIONAL');assert.deepEqual(candidate.localAuthorityCapsule,f.source.localAuthorityCapsule);
 assert.deepEqual(doc,captured);assert.deepEqual(f.source.localAuthorityCapsule.exportMap,map);assert.equal(envelope.composeObservablePayload({doc}),f.raw);assert.deepEqual(review.decide(review.decide(doc,{action:'acceptAll'}).doc,{action:'undo'}).doc.content,doc.content);
});
test('checked carrier actual ZIP rejects malformed current previous and structural owners in both publication phases',async()=>{
 const [,bridge]=await modules,recording=require('../../src/core/word-pending-recording-v1.cjs'),zip=require('../../src/export/docx/docxMinBuilder.js').buildStoredZip;
 const paragraph=text=>({type:'paragraph',content:[{type:'text',text}]}),row=text=>({type:'tableRow',content:[{type:'tableCell',attrs:{colspan:1,rowspan:1,colwidth:null},content:[paragraph(text)]}]}),date='2026-10-05T12:00:03.000Z';
 for(const kind of ['boundary','paragraph-mark','row']){
  const before={type:'doc',content:kind==='row'?[{type:'table',content:[row('Keep')]}]:[paragraph('AB')]};if(kind==='paragraph-mark')before.content[0].attrs={wordParagraphMarkTypography:{bold:false,fontFamily:'Arial',fontSize:'12pt'}};
  const after=kind==='boundary'?{type:'doc',content:[paragraph('A'),paragraph('B')]}:structuredClone(before);if(kind==='row')after.content[0].content.push(row('New'));if(kind==='paragraph-mark')after.content[0].attrs.wordParagraphMarkTypography={bold:true,fontFamily:'Georgia',fontSize:'14pt'};
  const doc=recording.derive(before,after,{author:'Owner',date}).doc,captured=structuredClone(doc),f=actualBodyPublication(doc,bridge),saved=structuredClone(f.source.localAuthorityCapsule),parts=bridge.extractDocxReviewTransportPackagePartsFromZipBytes({bytes:f.bytes}).parts,xml=parts['word/document.xml'];
  const mutations=kind==='paragraph-mark'?{
   duplicateOwner:x=>x.replace('</w:pPr>','<w:rPr/></w:pPr>'),
   duplicateChange:x=>x.replace(/(<w:rPrChange\b[^]*?<\/w:rPrChange>)/u,'$1$1'),
   foreignChangeAttribute:x=>x.replace('<w:rPrChange ','<w:rPrChange w:foreign="x" '),
   priorUnknownProperty:x=>x.replace(/(<w:rPrChange\b[^>]*><w:rPr>)/u,'$1<w:unsupported/>'),
   nestedPriorChange:x=>x.replace(/(<w:rPrChange\b[^>]*><w:rPr>)/u,'$1<w:rPrChange w:id="90"><w:rPr/></w:rPrChange>'),
   priorInvalidLanguage:x=>x.replace(/(<w:rPrChange\b[^]*?w:val=")en-US/u,'$1bad_tag'),
   ordinaryUnknownProperty:x=>x.replace('<w:rPr>','<w:rPr><w:unsupported/>'),
   wrongPreviousOwner:x=>x.replace(/(<w:rPrChange\b[^>]*>)<w:rPr>/u,'$1<w:pPr>').replace('</w:rPr></w:rPrChange>','</w:pPr></w:rPrChange>')
  }:kind==='boundary'?{
   duplicateOwner:x=>x.replace('</w:pPr>','<w:rPr/></w:pPr>'),
   duplicateCarrier:x=>x.replace(/(<w:ins\b[^>]*\/>)/u,'$1$1'),
   foreignAttribute:x=>x.replace('<w:ins ','<w:ins w:foreign="x" '),
   foreignNamespace:x=>x.replace('<w:ins ','<foreign:ins xmlns:foreign="urn:foreign" '),
   nonSelfClosing:x=>x.replace(/(<w:ins\b[^>]*)\/>/u,'$1></w:ins>'),
   wrongOwner:x=>x.replace(/(<w:ins\b[^>]*\/>)(<\/w:rPr>)/u,'$2$1'),
   ordinaryUnknownProperty:x=>x.replace('<w:rPr>','<w:rPr><w:unsupported/>'),
   mixedFormatBoundary:x=>x.replace('</w:rPr></w:pPr>','<w:rPrChange w:id="90" w:author="Owner"><w:rPr/></w:rPrChange></w:rPr></w:pPr>')
  }:{
   duplicateOwner:x=>x.replace(/(<w:ins\b[^>]*\/>)(<\/w:rPr>)/u,'$1$2<w:rPr/>'),
   childAuthor:x=>x.replace(/(<w:rPr>(?:(?!<\/w:rPr>)[^])*?<w:ins\b[^>]*w:author=")Owner/u,'$1Foreign'),
   childDate:x=>x.replace(/(<w:rPr>(?:(?!<\/w:rPr>)[^])*?<w:ins\b[^>]*w:date=")2026-10-05T12:00:03.000Z/u,'$12026-10-05T12:00:04.000Z'),
   childUtc:x=>x.replace(/(<w:rPr>(?:(?!<\/w:rPr>)[^])*?<w:ins\b[^>]*w16du:dateUtc=")2026-10-05T12:00:03.000Z/u,'$12026-10-05T12:00:04.000Z'),
   duplicateNativeId:x=>x.replace(/(<w:rPr>(?:(?!<\/w:rPr>)[^])*?<w:ins\b[^>]*w:id=")[^"]+/u,'$11'),
   childForeignAttribute:x=>x.replace(/(<w:rPr>(?:(?!<\/w:rPr>)[^])*?<w:ins )/u,'$1w:foreign="x" '),
   parentForeignAttribute:x=>x.replace(/(<w:trPr><w:ins )/u,'$1w:foreign="x" '),
   parentAuthor:x=>x.replace(/(<w:trPr><w:ins\b[^>]*w:author=")Owner/u,'$1Foreign'),
   parentDate:x=>x.replace(/(<w:trPr><w:ins\b[^>]*w:date=")2026-10-05T12:00:03.000Z/u,'$12026-10-05T12:00:04.000Z'),
   parentUtc:x=>x.replace(/(<w:trPr><w:ins\b[^>]*w16du:dateUtc=")2026-10-05T12:00:03.000Z/u,'$12026-10-05T12:00:04.000Z')
  };
  for(const [name,mutate] of Object.entries(mutations)){
   const changed=mutate(xml);assert.notEqual(changed,xml,kind+':'+name);const bytes=zip(Object.entries({...parts,'word/document.xml':changed}).map(([name,data])=>({name,data})));
   const actual=bridge.buildDocxReviewTransportAnalysisFromZipBytes({bytes},{cryptoPort});assert.ok(!actual.ok||actual.reviewIr.formattingParagraphs.some(p=>p.effectiveParagraphMarkTypographyInvalid||p.paragraphFormattingInvalid||p.unsupportedParagraphNames.length),JSON.stringify({kind,name,actual}));
   for(const phase of ['provisional','final']){const candidate=phase==='provisional'?{...f.source,provisionalSelfParseArtifact:{...f.source.provisionalSelfParseArtifact,bytes}}:f.source,result=await f.publish(phase==='final'?bytes:f.bytes,candidate);assert.equal(result.ok,false,JSON.stringify({kind,name,phase,result}));assert.equal(result.publishAllowed,false);assert.equal(result.code,phase==='provisional'?'RTK_V4_PUBLICATION_GATE_PROVISIONAL_DOCX_SHA_MISMATCH':'RTK_V4_PUBLICATION_BODY_TYPOGRAPHY_MISMATCH');}
   if(kind==='boundary'&&name==='wrongOwner'||kind==='paragraph-mark'&&name==='priorUnknownProperty') {
    const provisional=bridge.extractDocxReviewTransportPackagePartsFromZipBytes({bytes:f.source.provisionalSelfParseArtifact.bytes}).parts,original=provisional['word/document.xml'];provisional['word/document.xml']=mutate(original);assert.notEqual(provisional['word/document.xml'],original);
    const bytes=zip(Object.entries(provisional).map(([name,data])=>({name,data}))),candidate={...f.source,provisionalSelfParseArtifact:{...f.source.provisionalSelfParseArtifact,bytes},advisoryManifest:{...f.source.advisoryManifest,coreManifest:{...f.source.advisoryManifest.coreManifest,artifactIdentities:{...f.source.advisoryManifest.coreManifest.artifactIdentities,provisionalDocxSha256:'sha256:'+hash(bytes)}}}},result=await f.publish(f.bytes,candidate);
    assert.equal(result.ok,false,JSON.stringify({kind,name,phase:'actual-provisional-body',result}));assert.equal(result.code,kind==='boundary'?'PENDING_REVISIONS_STRUCTURE_UNSUPPORTED':'PENDING_FORMAT_PROPERTIES_UNSUPPORTED');assert.deepEqual(candidate.localAuthorityCapsule,saved);
   }
  }
  assert.deepEqual(doc,captured);assert.deepEqual(f.source.localAuthorityCapsule,saved);
 }
});
test('finite body timed pending emission preserves raw provenance through five checked rounds',async()=>{
 const [,bridge]=await modules,review=require('../../src/core/word-pending-text-revisions-v1.cjs'),adapter=require('../../src/core/word-pending-comment-return-v1.cjs');
 const date='2026-10-05T12:00:03Z',original={type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'A'}]}]};
 let doc=review.bindLedger({schemaVersion:1,source:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'AB'}]}]},revisions:[{id:'revision-3',nativeId:'3',operation:'insert',author:'Editor',date,dateUtc:date,paragraphIndex:0,from:1,to:2,state:'pending',groupId:null}],undo:[],redo:[]});
 const cp={sha256Text:hash,sha256Json:x=>'sha256:'+hash(JSON.stringify(x,(_key,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v)),byteLength:Buffer.byteLength};
 const parse=(source,bytes,before)=>{const cap=source.localAuthorityCapsule;return bridge.buildDocxPendingCommentReturnDocumentsFromZipBytes({bytes,exportMap:cap.exportMap,baselineDocuments:[{sceneId,document:before}],documentSections:cap.documentSections,signedSectionsDigest:cap.documentSections.protectedDigest,retainPendingScenes:true,cryptoPort:cp});};
 const derive=(source,before,returned)=>{const map=source.localAuthorityCapsule.exportMap;return adapter.deriveMixedPendingDocument({document:before,returnedDocument:returned,binding:map.scenes[0].pendingCommentBinding,anchors:[],exportTypography:map.exportTypography,exportParagraphs:map.scenes[0].blocks.map(b=>b.formatIr.paragraph),allowUntrackedRichFormatting:true});};
 const first=structuredClone(doc),source=freshBodySource(doc),bytes=buildDocxReviewPacketBuffer(source),map=structuredClone(source.localAuthorityCapsule.exportMap);
 const own=parse(source,bytes,doc);assert.equal(own.ok,true,JSON.stringify(own));
 const xml=bridge.extractDocxReviewTransportPackagePartsFromZipBytes({bytes}).parts['word/document.xml'];
 assert.match(xml,/<w:ins[^>]*w:date="2026-10-05T12:00:00Z"[^>]*w16du:dateUtc="2026-10-05T12:00:03Z"/u);
 assert.deepEqual(review.readLedger(own.scenes[0].returnedDocument).revisions.map(r=>[r.date,r.dateUtc]),[['2026-10-05T12:00:00Z',date]]);
 const unchanged=derive(source,doc,own.scenes[0].returnedDocument);assert.equal(unchanged.changed,false);
 assert.deepEqual(review.readLedger(unchanged.document).source,review.readLedger(doc).source);assert.deepEqual(review.readLedger(unchanged.document).revisions,review.readLedger(doc).revisions);
 assert.deepEqual(doc,first);assert.deepEqual(source.localAuthorityCapsule.exportMap,map);
 const parts=bridge.extractDocxReviewTransportPackagePartsFromZipBytes({bytes}).parts;
 for(const fault of ['author','date','dateUtc','kind','range','binding']){
  const bad=structuredClone(parts),before=structuredClone(doc),badSource=structuredClone(source);
  if(fault==='author')bad['word/document.xml']=xml.replace('w:author="Editor"','w:author="Foreign"');
  if(fault==='date')bad['word/document.xml']=xml.replace('w:date="2026-10-05T12:00:00Z"','w:date="2026-10-05T12:01:00Z"');
  if(fault==='dateUtc')bad['word/document.xml']=xml.replace('w16du:dateUtc="'+date+'"','w16du:dateUtc="2026-10-05T12:00:04Z"');
  if(fault==='kind')bad['word/document.xml']=xml.replace('<w:ins ','<w:del ').replace('</w:ins>','</w:del>').replace('>B</w:t>','>B</w:delText>').replace(/<w:t([^>]*)>B<\/w:delText>/u,'<w:delText$1>B</w:delText>');
  if(fault==='range')bad['word/document.xml']=xml.replace('>A</w:t>','>B</w:t>').replace('>B</w:t></w:r></w:ins>','>A</w:t></w:r></w:ins>');
  if(fault==='binding')badSource.localAuthorityCapsule.exportMap.scenes[0].pendingCommentBinding.ledgerSha256='0'.repeat(64);
  else assert.notEqual(bad['word/document.xml'],xml,fault);
  const denied=parse(badSource,require('../../src/export/docx/docxMinBuilder.js').buildStoredZip(Object.entries(bad).map(([name,data])=>({name,data}))),doc);
  assert.equal(denied.ok,true,JSON.stringify({fault,denied}));
  assert.throws(()=>derive(badSource,doc,denied.scenes[0].returnedDocument),error=>error.code===(fault==='binding'?'PENDING_COMMENT_BINDING_CHANGED':'MIXED_RETURN_SOURCE_CHANGED'),fault);
  assert.deepEqual(doc,before);assert.deepEqual(source.localAuthorityCapsule.exportMap,map);
 }
 const states=[structuredClone(doc)];
 for(let round=0;round<5;round++){
  const before=structuredClone(doc),packet=freshBodySource(doc),ledger=review.readLedger(doc),prior=structuredClone(ledger.revisions),length=review.projection(doc).current.length;
  const next=structuredClone(ledger),from=next.source.content[0].content.reduce((n,node)=>n+node.text.length,0),text=' B';
  next.source.content[0].content.push({type:'text',text});
  next.revisions.push({id:'revision-'+(4+round),nativeId:String(4+round),operation:'insert',author:'Editor',date:'2026-10-05T12:00:0'+(4+round)+'Z',dateUtc:'2026-10-05T12:00:0'+(4+round)+'Z',paragraphIndex:0,from,to:from+text.length,state:'pending',groupId:null});
  const returnedBytes=buildDocxReviewPacketBuffer(freshBodySource(review.bindLedger(next))),returned=parse(packet,returnedBytes,doc);assert.equal(returned.ok,true,JSON.stringify(returned));
  const result=derive(packet,doc,returned.scenes[0].returnedDocument);assert.equal(result.changed,true);
  for(const revision of prior)assert.deepEqual(review.readLedger(result.document).revisions.find(r=>r.id===revision.id),revision);
  assert.deepEqual(review.materialize(review.readLedger(result.document),'original'),original);assert.equal(review.projection(result.document).current,'AB'+' B'.repeat(round+1));
  assert.equal(review.projection(result.document).current.length,length+text.length);assert.deepEqual(doc,before);
  doc=review.replaceFromReturn(doc,result.document,{roundId:'finite-timed-'+round,artifactSha256:hash(returnedBytes)}).doc;states.push(structuredClone(doc));
  const undone=review.decide(doc,{action:'undo'}).doc;assert.deepEqual(review.readLedger(undone).source,review.readLedger(before).source);assert.deepEqual(review.readLedger(undone).revisions,prior);
  assert.deepEqual(review.decide(undone,{action:'redo'}).doc,doc);
 }
 for(let round=4;round>=0;round--){doc=review.decide(doc,{action:'undo'}).doc;assert.deepEqual(review.readLedger(doc).source,review.readLedger(states[round]).source);assert.deepEqual(review.readLedger(doc).revisions,review.readLedger(states[round]).revisions);}
 for(let round=1;round<=5;round++){doc=review.decide(doc,{action:'redo'}).doc;assert.deepEqual(review.readLedger(doc).source,review.readLedger(states[round]).source);assert.deepEqual(review.readLedger(doc).revisions,review.readLedger(states[round]).revisions);}
});
test('finite body no-comment structural Enter keeps its original timestamp and export route',async()=>{
 const [,bridge]=await modules,recording=require('../../src/core/word-pending-recording-v1.cjs'),review=require('../../src/core/word-pending-text-revisions-v1.cjs');
 const before={type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'AB'}]}]},working={type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'A'}]},{type:'paragraph',content:[{type:'text',text:'B'}]}]};
 const doc=recording.derive(before,working,{author:'Synthetic Writer',date:'2026-10-05T12:00:03.000Z'}).doc,raw=structuredClone(doc),source=freshBodySource(doc);
 assert.equal(source.commentExport,null);assert.equal(source.localAuthorityCapsule.exportMap.scenes[0].pendingCommentBinding,undefined);
 const bytes=buildDocxReviewPacketBuffer(source),xml=bridge.extractDocxReviewTransportPackagePartsFromZipBytes({bytes}).parts['word/document.xml'];
 assert.match(xml,/w:date="2026-10-05T12:00:03.000Z"/u);assert.match(xml,/w16du:dateUtc="2026-10-05T12:00:03.000Z"/u);
 const preview=bridge.buildDocxContentPreviewFromZipBytes(bytes);assert.equal(preview.ok,true,JSON.stringify(preview));
 const returned=preview.contentPreview.pendingRevisionDocument;assert.deepEqual(review.projection(returned).current,'A\nB');assert.deepEqual(review.projection(returned).original,'AB');
 assert.deepEqual(review.readLedger(returned).revisions.map(r=>[r.operation,r.boundary,r.date,r.dateUtc]),[['insert','paragraph','2026-10-05T12:00:03.000Z','2026-10-05T12:00:03.000Z']]);
 assert.throws(()=>review.buildCommentExportBinding({document:doc,exportTypography:source.exportTypography,schemaVersion:2}),/PENDING_COMMENT_REVISION_UNSUPPORTED/u);
 const ownedProperties=[...xml.matchAll(/<w:p\b[^>]*><w:pPr>([\s\S]*?)<\/w:pPr>/gu)].map(m=>m[1]);assert.equal(ownedProperties.length,2);
 for(const props of ownedProperties){assert.ok(props.includes('<w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman" w:cs="Times New Roman"/>'));assert.ok(props.includes('<w:sz w:val="24"/><w:szCs w:val="24"/>'));assert.ok(props.includes('<w:lang w:val="en-US" w:eastAsia="en-US" w:bidi="en-US"/>'));assert.ok(props.includes('<w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/>'));assert.equal((props.match(/<w:rPr>/gu)||[]).length,1);}
 // Complete ordinary-current marker evidence follows the independently checked
 // structural carrier; the separate pending parser still proves both phases.
 const analysis=bridge.buildDocxReviewTransportAnalysisFromZipBytes({bytes},{cryptoPort});assert.equal(analysis.ok,true);assert.equal(analysis.reviewIr.formattingParagraphs.length,2);for(const p of analysis.reviewIr.formattingParagraphs){assert.equal(p.effectiveParagraphMarkTypographyInvalid,undefined);assert.equal(p.paragraphFormattingInvalid,false);assert.deepEqual(p.unsupportedParagraphNames,[]);assert.deepEqual(p.effectiveParagraphMarkTypography,{fontFamily:'Times New Roman',fontSize:'12pt'});assert.deepEqual(p.wordParagraphMarkLanguage,{val:'en-US',eastAsia:'en-US',bidi:'en-US'});assert.deepEqual(p.paragraphState.wordParagraphSpacing,{before:0,after:0,line:240,lineRule:'auto'});}
 const parts=bridge.extractDocxReviewTransportPackagePartsFromZipBytes({bytes}).parts,bad={...parts,'word/document.xml':xml.replace('</w:pPr>','<w:rPr/></w:pPr>')};assert.notEqual(bad['word/document.xml'],xml);const refused=bridge.buildDocxContentPreviewFromZipBytes(require('../../src/export/docx/docxMinBuilder.js').buildStoredZip(Object.entries(bad).map(([name,data])=>({name,data}))));assert.equal(refused.ok,false);assert.equal(refused.reason,'PENDING_PARAGRAPH_BOUNDARY_OWNER');
 const authoring=require('../../src/core/word-comment-authoring-v1.cjs'),state={schemaVersion:'yalken.rtk.word.non-text-return-state.v1',projectId:'project-body-profile',revision:0,events:[],threads:[{threadId:'root',rootCommentId:'message',sceneId,status:'open',anchor:authoring.exactAnchor({paragraphIndex:0,startUtf16:0,selectedText:'A'},sceneId,['A','B']),messages:[{commentId:'message',kind:'root',body:'Protected body',provenance:{author:'Reader'}}]}]},stateBefore=structuredClone(state);
 assert.throws(()=>freshBodySource(doc,state),/PENDING_COMMENT_REVISION_UNSUPPORTED/u);assert.deepEqual(state,stateBefore);
 assert.deepEqual(doc,raw);
});
test('finite body complete-source binding distinguishes eligible and resolved structural timestamps',async()=>{
 const [,bridge]=await modules,review=require('../../src/core/word-pending-text-revisions-v1.cjs'),recording=require('../../src/core/word-pending-recording-v1.cjs');
 const original={type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'AB'}]}]},split={type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'A'}]},{type:'paragraph',content:[{type:'text',text:'B'}]}]};
 const first=recording.derive(original,split,{author:'Owner',date:'2026-10-05T12:00:03.000Z'}).doc;
 for(const action of ['acceptAll','rejectAll']){
  const resolved=review.decide(first,{action}).doc,working=recording.prepare(resolved).working;working.content.at(-1).content.at(-1).text+='C';
  const next=recording.derive(resolved,working,{author:'Owner',date:'2026-10-05T12:00:07.000Z'}).doc,raw=structuredClone(next),source=freshBodySource(next),savedMap=structuredClone(source.localAuthorityCapsule.exportMap);
  const ledger=review.readLedger(next);assert.ok(ledger.roundUndo.length);assert.ok(review.readLedger(resolved).undo.length);assert.equal(ledger.revisions[0].state,action==='acceptAll'?'accepted':'rejected');
  assert.equal(source.commentExport,null);assert.equal(savedMap.scenes[0].pendingCommentBinding,undefined);assert.ok(source.blocks.every(b=>!b.pendingBoundaryRevision));
  const bytes=buildDocxReviewPacketBuffer(source),xml=bridge.extractDocxReviewTransportPackagePartsFromZipBytes({bytes}).parts['word/document.xml'];
  assert.match(xml,/<w:ins[^>]*w:date="2026-10-05T12:00:07.000Z"[^>]*w16du:dateUtc="2026-10-05T12:00:07.000Z"/u);
  const preview=bridge.buildDocxContentPreviewFromZipBytes(bytes);assert.equal(preview.ok,true,JSON.stringify(preview));
  const incoming=preview.contentPreview.pendingRevisionDocument;assert.equal(review.projection(incoming).current,action==='acceptAll'?'A\nBC':'ABC');
  assert.equal(review.readLedger(incoming).revisions[0].date,'2026-10-05T12:00:07.000Z');assert.equal(review.readLedger(incoming).revisions[0].dateUtc,'2026-10-05T12:00:07.000Z');
  assert.throws(()=>review.buildCommentExportBinding({document:next,exportTypography:source.exportTypography,schemaVersion:2}),/PENDING_COMMENT_REVISION_UNSUPPORTED/u);
  assert.deepEqual(next,raw);assert.deepEqual(source.localAuthorityCapsule.exportMap,savedMap);
  const undone=review.decide(next,{action:'undo'}).doc;assert.deepEqual(review.roundFrame(review.readLedger(undone)),review.roundFrame(review.readLedger(resolved)));assert.deepEqual(review.decide(undone,{action:'redo'}).doc,next);
 }
});
test('finite body direct V2 builder preserves literal provenance while full producer owns bound transport',async()=>{
 const [,bridge]=await modules,review=require('../../src/core/word-pending-text-revisions-v1.cjs'),recording=require('../../src/core/word-pending-recording-v1.cjs');
 const original={type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'A'}]}]},working=structuredClone(original);working.content[0].content[0].text+='B';
 const doc=recording.derive(original,working,{author:'Owner',date:'2026-10-05T12:00:07.000Z'}).doc,raw=structuredClone(doc),source=freshBodySource(doc),originalBlocks=require('../../src/export/docx/fullManuscriptDocxReviewPacketSource.js').buildFullManuscriptBlocks([{sceneId,sceneOrdinal:0,doc,text:'AB'}],{sha256Json:x=>'sha256:'+hash(JSON.stringify(x))},{roundId:'round-'+ 'ab'.repeat(16)}),blocks=structuredClone(originalBlocks);
 const fullXml=bridge.extractDocxReviewTransportPackagePartsFromZipBytes({bytes:buildDocxReviewPacketBuffer(source)}).parts['word/document.xml'];
 assert.ok(source.localAuthorityCapsule.exportMap.scenes[0].pendingCommentBinding);assert.match(fullXml,/<w:ins[^>]*w:date="2026-10-05T12:00:00Z"[^>]*w16du:dateUtc="2026-10-05T12:00:07Z"/u);
 for(const profile of [source.exportTypography,typography]){
  const packet={blocks,exportTypography:profile,customProperties:[{name:'YRTK_C01_AUTH',value:'owned-synthetic'},{name:'YRTK2_TOKEN',value:'owned-synthetic'}]},xml=bridge.extractDocxReviewTransportPackagePartsFromZipBytes({bytes:buildDocxReviewPacketBuffer(packet)}).parts['word/document.xml'];
  assert.match(xml,/<w:ins[^>]*w:date="2026-10-05T12:00:07.000Z"[^>]*w16du:dateUtc="2026-10-05T12:00:07.000Z"/u);assert.deepEqual(blocks,originalBlocks);
 }
 assert.deepEqual(doc,raw);
 for(const block of source.blocks){const signed=source.localAuthorityCapsule.exportMap.scenes[0].blocks.find(b=>b.blockId===block.blockId);assert.deepEqual(block.formatIr,signed.formatIr);assert.equal(block.canonicalMarksSha256,signed.canonicalMarksSha256);}
});
test('finite body owned direct boundary and row markers retain nested previous properties and refuse duplicate owners',async()=>{
 const [,bridge]=await modules,emitter=require('../../src/export/docx/docxPendingRevisions.js'),review=require('../../src/core/word-pending-text-revisions-v1.cjs'),recording=require('../../src/core/word-pending-recording-v1.cjs');
 const date='2026-10-05T12:00:03.000Z',revision={id:'revision-1',nativeId:'1',operation:'insert',author:'Owner',date,dateUtc:date,state:'pending',boundary:'paragraph'};
 const fonts='<w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="24"/><w:szCs w:val="24"/><w:lang w:val="en-US" w:eastAsia="en-US" w:bidi="en-US"/>',previous='<w:rPrChange w:id="90" w:author="Reviewer"><w:rPr><w:rFonts w:ascii="Georgia"/><w:lang w:val="ru-RU"/></w:rPr></w:rPrChange>',properties='<w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/><w:rPr>'+fonts+previous+'</w:rPr></w:pPr>';
 const marker='<w:ins w:id="1" w:author="Owner" w:date="'+date+'" xmlns:w16du="http://schemas.microsoft.com/office/word/2023/wordml/word16du" w16du:dateUtc="'+date+'"/>';
 const rowRevision={...revision,structure:{kind:'tableRow'}};delete rowRevision.boundary;
 for(const [emit,r,code] of [[emitter.buildPendingParagraphBoundaryXml,revision,'PENDING_PARAGRAPH_BOUNDARY_INVALID'],[emitter.buildPendingRowParagraphXml,rowRevision,'PENDING_TABLE_ROW_EXPORT_INVALID']]){
  const actual=emit(properties,r,{next:1});assert.equal(actual,properties.replace('</w:rPr></w:pPr>',marker+'</w:rPr></w:pPr>'));assert.ok(actual.includes(previous));
  assert.equal(emit('',r,{next:1}),'<w:pPr><w:rPr>'+marker+'</w:rPr></w:pPr>');
  assert.equal(emit('<w:pPr><w:jc w:val="left"/></w:pPr>',r,{next:1}),'<w:pPr><w:jc w:val="left"/><w:rPr>'+marker+'</w:rPr></w:pPr>');
  assert.equal(emit('<w:pPr><w:rPr/></w:pPr>',r,{next:1}),'<w:pPr><w:rPr>'+marker+'</w:rPr></w:pPr>');
  assert.throws(()=>emit('<w:pPr><w:rPr w:foreign="x"/></w:pPr>',r,{next:1}),new RegExp(code,'u'));
  for(const bad of [properties.replace('</w:pPr>','<w:rPr/></w:pPr>'),properties.replace('</w:rPrChange>',''),properties.replace('<w:rPr>'+fonts,'<w:rPr><w:del w:id="88"/>'+fonts)])assert.throws(()=>emit(bad,r,{next:1}),new RegExp(code,'u'));
 }
 const paragraph=text=>({type:'paragraph',content:[{type:'text',text}]}),row=text=>({type:'tableRow',content:[{type:'tableCell',attrs:{colspan:1,rowspan:1,colwidth:null},content:[paragraph(text)]}]}),before={type:'doc',content:[{type:'table',content:[row('Keep')]}]},working=structuredClone(before);working.content[0].content.push(row('New'));
 const doc=recording.derive(before,working,{author:'Owner',date}).doc,raw=structuredClone(doc),source=freshBodySource(doc),bytes=buildDocxReviewPacketBuffer(source),parts=bridge.extractDocxReviewTransportPackagePartsFromZipBytes({bytes}).parts,xml=parts['word/document.xml'];
 assert.equal(source.localAuthorityCapsule.exportMap.scenes[0].pendingCommentBinding,undefined);const dates=[...xml.matchAll(/w:date="([^"]+)"/gu)].map(m=>m[1]);assert.ok(dates.length>=3);assert.ok(dates.every(d=>d===date));
 const parsed=bridge.buildDocxContentPreviewFromZipBytes(bytes);assert.equal(parsed.ok,true,JSON.stringify(parsed));assert.equal(review.projection(parsed.contentPreview.pendingRevisionDocument).current,'Keep\nNew');assert.equal(review.projection(parsed.contentPreview.pendingRevisionDocument).original,'Keep');
 const ownedProperties=[...xml.matchAll(/<w:p\b[^>]*><w:pPr>([\s\S]*?)<\/w:pPr>/gu)].map(m=>m[1]);assert.equal(ownedProperties.length,2);
 for(const props of ownedProperties){assert.ok(props.includes('<w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman" w:cs="Times New Roman"/>'));assert.ok(props.includes('<w:sz w:val="24"/><w:szCs w:val="24"/>'));assert.ok(props.includes('<w:lang w:val="en-US" w:eastAsia="en-US" w:bidi="en-US"/>'));assert.ok(props.includes('<w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/>'));assert.equal((props.match(/<w:rPr>/gu)||[]).length,1);}
 // Complete ordinary-current marker evidence follows the independently checked
 // structural carrier; the separate pending parser still proves both phases.
 const analysis=bridge.buildDocxReviewTransportAnalysisFromZipBytes({bytes},{cryptoPort});assert.equal(analysis.ok,true);assert.equal(analysis.reviewIr.formattingParagraphs.length,2);for(const p of analysis.reviewIr.formattingParagraphs){assert.equal(p.effectiveParagraphMarkTypographyInvalid,undefined);assert.equal(p.paragraphFormattingInvalid,false);assert.deepEqual(p.unsupportedParagraphNames,[]);assert.deepEqual(p.effectiveParagraphMarkTypography,{fontFamily:'Times New Roman',fontSize:'12pt'});assert.deepEqual(p.wordParagraphMarkLanguage,{val:'en-US',eastAsia:'en-US',bidi:'en-US'});assert.deepEqual(p.paragraphState.wordParagraphSpacing,{before:0,after:0,line:240,lineRule:'auto'});}
 const bad={...parts,'word/document.xml':xml.replace('w:author="Owner"','w:author="Foreign"')};assert.notEqual(bad['word/document.xml'],xml);const refused=bridge.buildDocxContentPreviewFromZipBytes(require('../../src/export/docx/docxMinBuilder.js').buildStoredZip(Object.entries(bad).map(([name,data])=>({name,data}))));assert.equal(refused.ok,false);assert.equal(refused.reason,'PENDING_TABLE_ROW_NESTED_REVISION_UNSUPPORTED');
 assert.deepEqual(doc,raw);
});
test('fresh body actual ZIP pins source-owned defaults, partial slots and code without changing authored IR',async()=>{
 const [,bridge]=await modules;
 const doc={type:'doc',content:[
  {type:'heading',attrs:{level:2,wordParagraphMarkTypography:{fontSlots:{ascii:'Times New Roman'}}},content:[{type:'text',text:'Heading 😀'}]},
  {type:'paragraph',attrs:{wordParagraphMarkTypography:{fontSlots:{ascii:'Georgia'}},wordParagraphMarkLanguage:{val:'ru-RU',eastAsia:'ja-JP',bidi:'ar-SA'},wordParagraphSpacing:{after:160}},content:[{type:'text',text:'Partial source',marks:[{type:'textStyle',attrs:{wordLanguage:{bidi:'he-IL'}}}]}]},
  {type:'codeBlock',attrs:{language:''},content:[{type:'text',text:'code();'}]},
  {type:'paragraph'}]};
 const before=structuredClone(doc),source=freshBodySource(doc),signed=source.localAuthorityCapsule.exportMap;
 assert.deepEqual(doc,before);assert.equal(signed.exportTypography.schemaVersion,'yalken.review-docx.typography-defaults.v2');
 const authored=buildFormatIrParagraphs({sceneId,doc,text:require('../../src/core/document-content-envelope-v1.cjs').deriveVisibleTextFromDocument(doc)});
 assert.deepEqual(signed.scenes[0].blocks.map(block=>block.formatIr),authored.map(row=>row.formatIr));
 for(const block of signed.scenes[0].blocks)assert.equal(block.canonicalMarksSha256,'sha256:'+hash(JSON.stringify(block.formatIr,(_key,value)=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.keys(value).sort().map(key=>[key,value[key]])):value)));
 const bytes=buildDocxReviewPacketBuffer(source),parts=bridge.extractDocxReviewTransportPackagePartsFromZipBytes({bytes}).parts;
 assert.match(parts['word/settings.xml'],/<w:defaultTabStop w:val="720"\/>/u);
 assert.deepEqual(signed.scenes[0].documentFormatIr,{wordDefaultTabStop:720,explicit:false});
 assert.match(parts['word/document.xml'],/<w:rFonts w:ascii="Georgia" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman" w:cs="Times New Roman"\/>/u);
 assert.match(parts['word/document.xml'],/<w:rFonts w:ascii="Menlo" w:hAnsi="Menlo" w:eastAsia="Menlo" w:cs="Menlo"\/>/u);
 assert.match(parts['word/document.xml'],/<w:spacing w:before="80" w:after="80" w:line="240" w:lineRule="auto"\/>/u);
 const own=bridge.buildDocxContentPreviewFromZipBytes(bytes);assert.equal(own.ok,true,JSON.stringify(own));
});
for(const mutation of ['none','font','size','aux-language','mark-slot','spacing','tab-stop'])test('fresh body source-bound actual ZIP formatting comparison '+mutation,async()=>{
 const [,bridge]=await modules,doc={type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Anchor 😀'}]}]},source=freshBodySource(doc);
 const before=structuredClone(source.localAuthorityCapsule.exportMap),bytes=buildDocxReviewPacketBuffer(source);
 const parts=bridge.extractDocxReviewTransportPackagePartsFromZipBytes({bytes}).parts;
 if(mutation==='font')parts['word/document.xml']=parts['word/document.xml'].replaceAll('Times New Roman','Georgia');
 if(mutation==='size')parts['word/document.xml']=parts['word/document.xml'].replaceAll('w:val="24"','w:val="28"');
 if(mutation==='aux-language')parts['word/document.xml']=parts['word/document.xml'].replaceAll('w:eastAsia="en-US"','w:eastAsia="ja-JP"');
 if(mutation==='mark-slot')parts['word/document.xml']=parts['word/document.xml'].replace('w:ascii="Times New Roman"','w:ascii="Georgia"');
 if(mutation==='spacing')parts['word/document.xml']=parts['word/document.xml'].replace('w:line="240"','w:line="278"');
 if(mutation==='tab-stop')parts['word/settings.xml']=parts['word/settings.xml'].replace('w:val="720"','w:val="708"');
 const returned=require('../../src/export/docx/docxMinBuilder.js').buildStoredZip(Object.entries(parts).map(([name,data])=>({name,data})));
 const plan=bridge.buildDocxReviewFormattingReturnCandidatesFromZipBytes(returned,{fullManuscriptExportMap:source.localAuthorityCapsule.exportMap,cryptoPort});
 assert.equal(plan.ok,true,JSON.stringify(plan));assert.equal(plan.diagnostics.length,0,JSON.stringify(plan));
 assert.equal(plan.candidates.length===0,mutation==='none',JSON.stringify(plan));
 assert.deepEqual(source.localAuthorityCapsule.exportMap,before);assert.deepEqual(doc,{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Anchor 😀'}]}]});
});
for(const fault of ['missing-run','partial-language','foreign-font','extra-key','accessor'])test('complete body descriptor refuses '+fault+' before emission',()=>{
 const profile=require('../../src/core/word-review-typography-v1.cjs').freshBodyTypography();let accessed=false;
 if(fault==='missing-run')delete profile.bodyRunDefaults;
 if(fault==='partial-language')delete profile.bodyRunDefaults.wordLanguage.bidi;
 if(fault==='foreign-font')profile.bodyRunDefaults.fontFamily='Aptos';
 if(fault==='extra-key')profile.bodyParagraphDefaults.ignoreUnknown=true;
 if(fault==='accessor')Object.defineProperty(profile.bodyRunDefaults,'fontFamily',{enumerable:true,get(){accessed=true;return 'Times New Roman';}});
 assert.throws(()=>buildDocxReviewPacketBuffer({exportTypography:profile,blocks:[{blockId:'b',paragraphId:'p',text:'Anchor',formatIr:{schemaVersion:'yalken.rtk.format-ir.v1',paragraph:{nodeType:'paragraph'},runs:[{from:0,to:6,text:'Anchor',inline:{},preservedMarks:[]}]}}],customProperties:[{name:'YRTK_C01_AUTH',value:'owned'},{name:'YRTK2_TOKEN',value:'owned'}]}),/WORD_REVIEW_TYPOGRAPHY_INVALID/u);
 assert.equal(accessed,false);
});


test('legacy v1 no-comment pending producer does not retrofit body bindings',()=>{
 const pending=require('../../src/core/word-pending-text-revisions-v1.cjs'),doc=pending.bindLedger({schemaVersion:1,source:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'AxxB'}]}]},revisions:[{id:'revision-1',nativeId:'1',operation:'delete',author:'Writer',date:'2026-10-07T00:00:00Z',dateUtc:'2026-10-07T00:00:00Z',groupId:null,paragraphIndex:0,from:1,to:3,state:'pending'}],undo:[],redo:[]});
 const before=structuredClone(doc),result=require('../../src/export/docx/docxReviewPacketComments.js').bindPendingCommentExport({commentExport:null,scenes:[{sceneId,doc}],blocks:[],exportTypography:typography});
 assert.deepEqual(result,{commentExport:null,pendingCommentBindings:[]});assert.deepEqual(doc,before);
});

function wordRelocatedBodyParts(parts) {
 parts['word/styles.xml']=parts['word/styles.xml'].replace(/<w:docDefaults>[\s\S]*?<\/w:docDefaults>/u,
  '<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="24"/><w:szCs w:val="24"/><w:lang w:val="ru-FI" w:eastAsia="ru-RU" w:bidi="ar-SA"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="278" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>');
 parts['word/document.xml']=parts['word/document.xml'].replace(/<w:pPr>[\s\S]*?<\/w:pPr>/gu,p=>{
  p=p.replace(/<w:rFonts[^>]*\/>/u,f=>f.includes('Georgia')?'<w:rFonts w:ascii="Georgia"/>':'').replace(/<w:sz(?:Cs)? w:val="(?:24|20)"\/>/gu,'').replace(' w:before="0"','');
  if(p.includes('YalkenCodeBlock'))p=p.replace(' w:before="80"','').replace(' w:after="80"','');
  if(p.includes('YalkenBlockquote1'))p=p.replace('<w:ind w:left="720"/>','');
  if(p.includes('Georgia'))p=p.replace(' w:bidi="ar-SA"','');
  return p;
 }).replace(/<w:rFonts w:ascii="(?:Times New Roman|Menlo)"[^>]*\/>/gu,'').replace(/<w:sz(?:Cs)? w:val="24"\/>/gu,'');
 return parts;
}
function completeBodyRoleDocument() {
 const p=text=>({type:'paragraph',content:text?[{type:'text',text}]:[]});
 return {type:'doc',content:[p('Anchor alpha: Строка для правки.'),{type:'heading',attrs:{level:2},content:[{type:'text',text:'Глава первая'}]},
 {type:'paragraph',content:[{type:'text',text:'bold',marks:[{type:'bold'}]},{type:'text',text:' / italic',marks:[{type:'italic'}]},{type:'text',text:' / Привет 😀'}]},p(''),
 {type:'paragraph',content:[{type:'text',text:'break before'},{type:'hardBreak'},{type:'text',text:'break after'}]},
 {type:'blockquote',content:[p('Quote retained.')]},{type:'bulletList',content:[{type:'listItem',content:[p('Bullet retained.')]}]},
 {type:'orderedList',attrs:{start:1},content:[{type:'listItem',content:[p('Number retained.')]}]},
 {type:'codeBlock',attrs:{language:''},content:[{type:'text',text:'code = 1;'}]},
 {type:'paragraph',attrs:{wordParagraphMarkTypography:{fontSlots:{ascii:'Georgia'},fontSize:'14pt'},wordParagraphMarkLanguage:{val:'ru-RU',eastAsia:'ja-JP',bidi:'ar-SA'},wordParagraphSpacing:{before:40,after:80,line:260,lineRule:'auto'}},content:[{type:'text',text:'Authored Georgia text.',marks:[{type:'textStyle',attrs:{fontFamily:'Georgia',fontSize:'14pt'}}]}]},
 p('Second scene plain text.'),p('Final sibling unchanged: Ελληνικά 中文 שלום.'),p('End sentinel gamma.')]};
}
test('scoped finite body actual inherited markers preserve complete text return and refuse malformed or changed slots',async()=>{
 const [,bridge]=await modules,review=require('../../src/core/word-pending-text-revisions-v1.cjs'),adapter=require('../../src/core/word-pending-comment-return-v1.cjs');
 const doc=completeBodyRoleDocument(),before=structuredClone(doc),source=freshBodySource(doc),capsule=source.localAuthorityCapsule,map=structuredClone(capsule.exportMap);
 const parts=wordRelocatedBodyParts(bridge.extractDocxReviewTransportPackagePartsFromZipBytes({bytes:buildDocxReviewPacketBuffer(source)}).parts);
 parts['word/document.xml']=parts['word/document.xml'].replace(/<w:r>(<w:rPr>[\s\S]*?<\/w:rPr>)<w:t[^>]*>Anchor alpha: Строка для правки\.<\/w:t><\/w:r>/u,(_all,rPr)=>{
  const run=(text,deleted=false)=>'<w:r>'+rPr+'<w:'+(deleted?'delText':'t')+' xml:space="preserve">'+text+'</w:'+(deleted?'delText':'t')+'></w:r>';
  return run('Anchor ')+'<w:del w:id="901" w:author="Writer" w:date="2026-10-07T00:00:00Z">'+run('alpha',true)+'</w:del><w:ins w:id="902" w:author="Writer" w:date="2026-10-07T00:00:00Z">'+run('writer')+'</w:ins>'+run(': Строка для правки.');});
 assert.match(parts['word/document.xml'],/<w:ins w:id="902"/u);
 const cp={sha256Text:hash,sha256Json:x=>'sha256:'+hash(JSON.stringify(x,(_key,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v)),byteLength:Buffer.byteLength};
 const parse=parts=>bridge.buildDocxPendingCommentReturnDocumentsFromZipBytes({bytes:require('../../src/export/docx/docxMinBuilder.js').buildStoredZip(Object.entries(parts).map(([name,data])=>({name,data}))),exportMap:capsule.exportMap,baselineDocuments:[{sceneId,document:doc}],documentSections:capsule.documentSections,signedSectionsDigest:capsule.documentSections.protectedDigest,retainPendingScenes:true,cryptoPort:cp});
 const derive=returnedDocument=>adapter.deriveMixedPendingDocument({document:doc,returnedDocument,anchors:[],exportTypography:map.exportTypography,exportParagraphs:map.scenes[0].blocks.map(b=>b.formatIr.paragraph),cleanTransportSchemaVersion:1,allowUntrackedRichFormatting:true});
 const parsed=parse(parts);assert.equal(parsed.ok,true,JSON.stringify(parsed));const result=derive(parsed.scenes[0].returnedDocument),ledger=review.readLedger(result.document);
 assert.equal(result.changed,true);assert.deepEqual(review.normalizeNode(review.materialize(ledger,'original')),review.normalizeNode(doc));
 assert.equal(review.projection(result.document).current,require('../../src/core/document-content-envelope-v1.cjs').deriveVisibleTextFromDocument(doc).replace('alpha','writer'));
 assert.equal(review.paragraphs(ledger.source)[9].attrs.wordParagraphMarkTypography.fontSlots.hAnsi,undefined);
 for(const fault of ['ascii','hAnsi','eastAsia','cs','direct-slot','size','sizeCs','missing-font','missing-size','unknown-style','ambiguous-style','invalid-color']) {
  const bad=structuredClone(parts);
  if(['ascii','hAnsi','eastAsia','cs'].includes(fault))bad['word/styles.xml']=bad['word/styles.xml'].replace('w:'+fault+'="Times New Roman"','w:'+fault+'="Arial"');
  if(fault==='direct-slot')bad['word/document.xml']=bad['word/document.xml'].replace(/(<w:pPr>[\s\S]*?<w:rPr>)/u,'$1<w:rFonts w:cs="Arial"/>');
  if(fault==='size')bad['word/styles.xml']=bad['word/styles.xml'].replace('<w:sz w:val="24"/>','<w:sz w:val="28"/>').replace('<w:szCs w:val="24"/>','<w:szCs w:val="28"/>');
  if(fault==='sizeCs')bad['word/styles.xml']=bad['word/styles.xml'].replace('<w:szCs w:val="24"/>','<w:szCs w:val="28"/>');
  if(fault==='missing-font')bad['word/styles.xml']=bad['word/styles.xml'].replace(/<w:rFonts w:ascii="Times New Roman"[^>]*\/>/u,'');
  if(fault==='missing-size')bad['word/styles.xml']=bad['word/styles.xml'].replace('<w:sz w:val="24"/>','').replace('<w:szCs w:val="24"/>','');
  if(fault==='unknown-style')bad['word/document.xml']=bad['word/document.xml'].replace('<w:pPr>','<w:pPr><w:pStyle w:val="ForeignMissing"/>');
  if(fault==='ambiguous-style')bad['word/document.xml']=bad['word/document.xml'].replace('<w:pPr>','<w:pPr><w:pStyle w:val="YalkenBlockquote1"/><w:pStyle w:val="YalkenBlockquote1"/>');
  if(fault==='invalid-color')bad['word/document.xml']=bad['word/document.xml'].replace(/(<w:pPr>[\s\S]*?<w:rPr>)/u,'$1<w:color w:val="ZZZZZZ"/>');
  assert.notDeepEqual(bad,parts,fault);
  if(fault==='direct-slot')assert.match(bad['word/document.xml'],/<w:pPr>[\s\S]*?<w:rPr><w:rFonts w:cs="Arial"\/>/u);
  if(fault==='invalid-color')assert.match(bad['word/document.xml'],/<w:pPr>[\s\S]*?<w:rPr><w:color w:val="ZZZZZZ"\/>/u);
  const denied=parse(bad);if(denied.ok)assert.throws(()=>derive(denied.scenes[0].returnedDocument),undefined,fault);
  assert.deepEqual(doc,before,fault);assert.deepEqual(capsule.exportMap,map,fault);
 }
});
test('scoped finite body actual retained paragraph-format keeps raw snapshots and independent history on reexport',async()=>{
 const [,bridge]=await modules,review=require('../../src/core/word-pending-text-revisions-v1.cjs'),adapter=require('../../src/core/word-pending-comment-return-v1.cjs');
 const old={type:'paragraph',attrs:{wordParagraphMarkTypography:{fontSlots:{ascii:'Georgia'},fontSize:'14pt'}},content:[{type:'text',text:'Retained marker'}]},after=structuredClone(old);after.attrs.wordParagraphMarkTypography.fontSlots.ascii='Arial';
 const sourceDoc=review.bindLedger({schemaVersion:1,source:{type:'doc',content:[after]},revisions:[{id:'revision-1',nativeId:'1',operation:'format',author:'Writer',date:'',dateUtc:'',groupId:null,paragraphIndex:0,from:0,to:15,state:'pending',format:{kind:'paragraph',before:review.paragraphProperties(old),after:review.paragraphProperties(after)}}],undo:[],redo:[]});
 const before=structuredClone(sourceDoc),source=freshBodySource(sourceDoc),capsule=source.localAuthorityCapsule,bytes=buildDocxReviewPacketBuffer(source);
 const cp={sha256Text:hash,sha256Json:x=>'sha256:'+hash(JSON.stringify(x,(_key,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v)),byteLength:Buffer.byteLength};
 const parsed=bridge.buildDocxPendingCommentReturnDocumentsFromZipBytes({bytes,exportMap:capsule.exportMap,baselineDocuments:[{sceneId,document:sourceDoc}],documentSections:capsule.documentSections,signedSectionsDigest:capsule.documentSections.protectedDigest,retainPendingScenes:true,cryptoPort:cp});assert.equal(parsed.ok,true,JSON.stringify(parsed));
 const result=adapter.deriveMixedPendingDocument({document:sourceDoc,returnedDocument:parsed.scenes[0].returnedDocument,binding:capsule.exportMap.scenes[0].pendingCommentBinding,anchors:[],exportTypography:capsule.exportMap.exportTypography,exportParagraphs:capsule.exportMap.scenes[0].blocks.map(b=>b.formatIr.paragraph),allowUntrackedRichFormatting:true});
 assert.equal(result.changed,false);assert.deepEqual(result.document,before);assert.deepEqual(sourceDoc,before);
 const accepted=review.decide(result.document,{action:'acceptAll'}).doc,undone=review.decide(accepted,{action:'undo'}).doc;
 assert.equal(review.projection(undone).canRedo,true);assert.deepEqual(review.readLedger(undone).source,review.readLedger(sourceDoc).source);assert.deepEqual(review.readLedger(undone).revisions,review.readLedger(sourceDoc).revisions);
 const redone=review.decide(undone,{action:'redo'}).doc;assert.deepEqual(redone,accepted);
 for(const state of [accepted,review.decide(result.document,{action:'rejectAll'}).doc,undone]){
  const exported=freshBodySource(state),cap=exported.localAuthorityCapsule;
  const returned=bridge.buildDocxPendingCommentReturnDocumentsFromZipBytes({bytes:buildDocxReviewPacketBuffer(exported),exportMap:cap.exportMap,baselineDocuments:[{sceneId,document:state}],documentSections:cap.documentSections,signedSectionsDigest:cap.documentSections.protectedDigest,retainPendingScenes:true,cryptoPort:cp});assert.equal(returned.ok,true,JSON.stringify(returned));
  const replay=adapter.deriveMixedPendingDocument({document:state,returnedDocument:returned.scenes[0].returnedDocument,binding:cap.exportMap.scenes[0].pendingCommentBinding,anchors:[],exportTypography:cap.exportMap.exportTypography,exportParagraphs:cap.exportMap.scenes[0].blocks.map(b=>b.formatIr.paragraph),allowUntrackedRichFormatting:true});
  assert.equal(replay.changed,false);assert.deepEqual(replay.document,state,'complete raw ledger including actual decision history');
  for(const operand of ['source','returned']){
   const sourceState=structuredClone(state),actualState=structuredClone(returned.scenes[0].returnedDocument),forged=operand==='source'?sourceState:actualState;
   forged.attrs.wordPendingRevisions.source.content[0].attrs.foreignAuthority=true;
   assert.throws(()=>adapter.deriveMixedPendingDocument({document:sourceState,returnedDocument:actualState,binding:cap.exportMap.scenes[0].pendingCommentBinding,anchors:[],exportTypography:cap.exportMap.exportTypography,exportParagraphs:cap.exportMap.scenes[0].blocks.map(b=>b.formatIr.paragraph),allowUntrackedRichFormatting:true}));
   assert.deepEqual(replay.document,state);assert.equal(Object.hasOwn(review.readLedger(state).source.content[0].attrs,'foreignAuthority'),false);
  }
 }
 const parts=bridge.extractDocxReviewTransportPackagePartsFromZipBytes({bytes}).parts,mapBefore=structuredClone(capsule.exportMap);
 const pack=parts=>require('../../src/export/docx/docxMinBuilder.js').buildStoredZip(Object.entries(parts).map(([name,data])=>({name,data})));
 const parseBytes=bytes=>bridge.buildDocxPendingCommentReturnDocumentsFromZipBytes({bytes,exportMap:capsule.exportMap,baselineDocuments:[{sceneId,document:sourceDoc}],documentSections:capsule.documentSections,signedSectionsDigest:capsule.documentSections.protectedDigest,retainPendingScenes:true,cryptoPort:cp});
 const derive=returnedDocument=>adapter.deriveMixedPendingDocument({document:sourceDoc,returnedDocument,binding:capsule.exportMap.scenes[0].pendingCommentBinding,anchors:[],exportTypography:capsule.exportMap.exportTypography,exportParagraphs:capsule.exportMap.scenes[0].blocks.map(b=>b.formatIr.paragraph),allowUntrackedRichFormatting:true});
 for(const side of ['before','after'])for(const field of ['ascii','hAnsi','eastAsia','cs','size','sizeCs','val','eastAsia-language','bidi','spacing','role']){
  const bad=structuredClone(parts),edit=xml=>{
   if(['ascii','hAnsi','eastAsia','cs'].includes(field))return xml.replace(new RegExp('w:'+field+'="[^"]+"','u'),'w:'+field+'="Aptos"');
   if(field==='size')return xml.replace('w:sz w:val="28"','w:sz w:val="32"').replace('w:szCs w:val="28"','w:szCs w:val="32"');
   if(field==='sizeCs')return xml.replace('w:szCs w:val="28"','w:szCs w:val="32"');
   if(['val','eastAsia-language','bidi'].includes(field)){const slot=field==='eastAsia-language'?'eastAsia':field;return xml.replace(/<w:lang[^>]*\/>/u,lang=>lang.replace('w:'+slot+'="en-US"','w:'+slot+'="fr-FR"'));}
   return xml.replace('<w:rPr>','<w:rPr>'+(field==='spacing'?'<w:spacing w:before="40"/>':'<w:outlineLvl w:val="2"/>'));
  };
  const xml=bad['word/document.xml'];
  bad['word/document.xml']=side==='before'?xml.replace(/(<w:rPrChange\b[^>]*>)([\s\S]*?)(<\/w:rPrChange>)/u,(_all,start,body,end)=>start+edit(body)+end)
   :xml.slice(0,xml.indexOf('<w:rPrChange'))===edit(xml.slice(0,xml.indexOf('<w:rPrChange')))?xml:edit(xml.slice(0,xml.indexOf('<w:rPrChange')))+xml.slice(xml.indexOf('<w:rPrChange'));
  assert.notEqual(bad['word/document.xml'],xml,side+field);
  const denied=parseBytes(pack(bad));if(denied.ok)assert.throws(()=>derive(denied.scenes[0].returnedDocument),undefined,side+field);
  assert.deepEqual(sourceDoc,before);assert.deepEqual(capsule.exportMap,mapBefore);
 }
 for(const fault of ['author','date','dateUtc','duplicate native ID','extra wrapper','untracked range','signed binding']){
  const bad=structuredClone(parts),xml=bad['word/document.xml'];
  if(fault==='author')bad['word/document.xml']=xml.replace('w:author="Writer"','w:author="Foreign"');
  if(fault==='date')bad['word/document.xml']=xml.replace('<w:rPrChange ','<w:rPrChange w:date="2026-10-08T00:00:00Z" ');
  if(fault==='dateUtc')bad['word/document.xml']=xml.replace('<w:rPrChange ','<w:rPrChange xmlns:w16du="http://schemas.microsoft.com/office/word/2023/wordml/word16du" w16du:dateUtc="2026-10-08T00:00:00Z" ');
  if(fault==='duplicate native ID')bad['word/document.xml']=xml.replace(/(<w:rPrChange\b[\s\S]*?<\/w:rPrChange>)/u,'$1$1');
  if(fault==='extra wrapper')bad['word/document.xml']=xml.replace(/(<w:rPrChange\b[\s\S]*?<\/w:rPrChange>)/u,wrapper=>wrapper+wrapper.replace(/w:id="[^"]+"/u,'w:id="9001"'));
  if(fault==='untracked range')bad['word/document.xml']=xml.replace('>Retained marker<','>Retained marker foreign<');
  if(fault==='signed binding'){const binding=structuredClone(capsule.exportMap.scenes[0].pendingCommentBinding);binding.revisionSpans[0].formatSha256='0'.repeat(64);assert.throws(()=>adapter.deriveMixedPendingDocument({document:sourceDoc,returnedDocument:parsed.scenes[0].returnedDocument,binding,anchors:[],exportTypography:capsule.exportMap.exportTypography,exportParagraphs:capsule.exportMap.scenes[0].blocks.map(b=>b.formatIr.paragraph),allowUntrackedRichFormatting:true}));}
  else{assert.notEqual(bad['word/document.xml'],xml,fault);const denied=parseBytes(pack(bad));if(denied.ok)assert.throws(()=>derive(denied.scenes[0].returnedDocument),undefined,fault);}
  assert.deepEqual(sourceDoc,before);assert.deepEqual(capsule.exportMap,mapBefore);
 }
 const changed=structuredClone(parts);changed['word/document.xml']=changed['word/document.xml'].replace(/(<w:r>)(<w:rPr>[\s\S]*?<\/w:rPr>)(<w:t[^>]*>Retained marker<\/w:t><\/w:r>)/u,(_all,start,props,tail)=>'<w:ins w:id="900" w:author="Editor">'+start+props+'<w:t xml:space="preserve">new </w:t></w:r></w:ins>'+start+props+tail);
 assert.notEqual(changed['word/document.xml'],parts['word/document.xml']);const mixed=parseBytes(pack(changed));assert.equal(mixed.ok,true,JSON.stringify(mixed));const delta=derive(mixed.scenes[0].returnedDocument);assert.equal(delta.changed,true);
 assert.deepEqual(review.materialize(review.readLedger(delta.document),'original'),review.materialize(review.readLedger(sourceDoc),'original'));
 assert.equal(review.projection(delta.document).current,'new Retained marker');assert.deepEqual(review.readLedger(delta.document).revisions[0].format,review.readLedger(sourceDoc).revisions[0].format);
 const round=review.replaceFromReturn(sourceDoc,delta.document,{roundId:'owned-retained-format-round',artifactSha256:hash(pack(changed))}).doc;
 for(const state of [round,review.decide(round,{action:'undo'}).doc,review.decide(review.decide(round,{action:'undo'}).doc,{action:'redo'}).doc]){
  const exported=freshBodySource(state),cap=exported.localAuthorityCapsule,returned=bridge.buildDocxPendingCommentReturnDocumentsFromZipBytes({bytes:buildDocxReviewPacketBuffer(exported),exportMap:cap.exportMap,baselineDocuments:[{sceneId,document:state}],documentSections:cap.documentSections,signedSectionsDigest:cap.documentSections.protectedDigest,retainPendingScenes:true,cryptoPort:cp});assert.equal(returned.ok,true,JSON.stringify(returned));
  const replay=adapter.deriveMixedPendingDocument({document:state,returnedDocument:returned.scenes[0].returnedDocument,binding:cap.exportMap.scenes[0].pendingCommentBinding,anchors:[],exportTypography:cap.exportMap.exportTypography,exportParagraphs:cap.exportMap.scenes[0].blocks.map(b=>b.formatIr.paragraph),allowUntrackedRichFormatting:true});assert.equal(replay.changed,false);assert.deepEqual(replay.document,state,'complete source-owned round history');
 }
});
for(const mutation of ['none','inherited-ascii','inherited-hAnsi','inherited-eastAsia','inherited-cs','direct-slot','inherited-size','inherited-sizeCs','direct-sizeCs','inherited-color-invalid','direct-color-invalid','inherited-color','direct-highlight','inherited-highlight-invalid','direct-bold','inherited-bold-invalid','main-language','aux-language','before','quote-indent','list-start','code-fill','code-style','theme'])test('actual producer complete13 Word style relocation '+mutation,async()=>{
 const [,bridge]=await modules,doc=completeBodyRoleDocument(),before=structuredClone(doc),source=freshBodySource(doc),map=structuredClone(source.localAuthorityCapsule.exportMap);
 const own=buildDocxReviewPacketBuffer(source),parts=wordRelocatedBodyParts(bridge.extractDocxReviewTransportPackagePartsFromZipBytes({bytes:own}).parts);
 const styles=s=>{parts['word/styles.xml']=parts['word/styles.xml'].replace('</w:rPr></w:rPrDefault>',s+'</w:rPr></w:rPrDefault>');};
 if(mutation.startsWith('inherited-')&&['ascii','hAnsi','eastAsia','cs'].includes(mutation.slice(10)))parts['word/styles.xml']=parts['word/styles.xml'].replace('w:'+mutation.slice(10)+'="Times New Roman"','w:'+mutation.slice(10)+'="Arial"');
 if(mutation==='direct-slot')parts['word/document.xml']=parts['word/document.xml'].replace('<w:pPr>','<w:pPr><w:rPr><w:rFonts w:cs="Arial"/><w:sz w:val="24"/></w:rPr>');
 if(mutation==='inherited-size')parts['word/styles.xml']=parts['word/styles.xml'].replaceAll('w:val="24"','w:val="28"');
 if(mutation==='inherited-sizeCs')parts['word/styles.xml']=parts['word/styles.xml'].replace('<w:szCs w:val="24"/>','<w:szCs w:val="28"/>');
 if(mutation==='direct-sizeCs')parts['word/document.xml']=parts['word/document.xml'].replace('<w:rPr>','<w:rPr><w:szCs w:val="28"/>');
 if(mutation==='inherited-color-invalid')styles('<w:color w:val="ZZZZZZ"/>');
 if(mutation==='inherited-color')styles('<w:color w:val="FF0000"/>');
 if(mutation==='inherited-highlight-invalid')styles('<w:highlight w:val="not-a-color"/>');
 if(mutation==='inherited-bold-invalid')styles('<w:b w:val="invalid"/>');
 if(mutation==='direct-color-invalid')parts['word/document.xml']=parts['word/document.xml'].replace('<w:rPr>','<w:rPr><w:color w:val="ZZZZZZ"/>');
 if(mutation==='direct-highlight')parts['word/document.xml']=parts['word/document.xml'].replace('<w:rPr>','<w:rPr><w:highlight w:val="yellow"/>');
 if(mutation==='direct-bold')parts['word/document.xml']=parts['word/document.xml'].replace('<w:rPr>','<w:rPr><w:b/>');
 if(mutation==='main-language')parts['word/document.xml']=parts['word/document.xml'].replace('w:val="en-US"','w:val="en-GB"');
 if(mutation==='aux-language')parts['word/document.xml']=parts['word/document.xml'].replace('w:bidi="en-US"','w:bidi="he-IL"');
 if(mutation==='before')parts['word/document.xml']=parts['word/document.xml'].replace('<w:spacing w:after="0"','<w:spacing w:before="40" w:after="0"');
 if(mutation==='quote-indent')parts['word/styles.xml']=parts['word/styles.xml'].replace('w:left="720"','w:left="960"');
 if(mutation==='list-start')parts['word/numbering.xml']=parts['word/numbering.xml'].replaceAll('w:start w:val="1"','w:start w:val="3"');
 if(mutation==='code-fill')parts['word/styles.xml']=parts['word/styles.xml'].replace('w:fill="F3F4F6"','w:fill="FF0000"');
 if(mutation==='code-style'){parts['word/styles.xml']=parts['word/styles.xml'].replaceAll('YalkenCodeBlock','ForeignCode');parts['word/document.xml']=parts['word/document.xml'].replaceAll('YalkenCodeBlock','ForeignCode');}
 if(mutation==='theme')parts['word/styles.xml']=parts['word/styles.xml'].replace('w:ascii="Times New Roman"','w:asciiTheme="minorHAnsi"');
 const bytes=require('../../src/export/docx/docxMinBuilder.js').buildStoredZip(Object.entries(parts).map(([name,data])=>({name,data})));
 const literal=await import('../../src/io/revisionBridge/reviewTransportPackageParserV2.mjs');
 const observed=literal.extractReviewTransportFormattingRunsV2(parts['word/document.xml'],{stylesXml:parts['word/styles.xml'],settingsXml:parts['word/settings.xml'],cryptoPort});
 if(['inherited-sizeCs','direct-sizeCs','inherited-color-invalid','direct-color-invalid','inherited-highlight-invalid','inherited-bold-invalid'].includes(mutation))assert.ok(observed.paragraphs[0].effectiveParagraphMarkTypographyInvalid,JSON.stringify(observed.paragraphs[0]));
 let analysis;
 try{analysis=bridge.buildDocxReviewTransportAnalysisFromZipBytes({bytes},{cryptoPort});}
 catch(error){
  const expected={'direct-sizeCs':'WORD_PARAGRAPH_MARK_SIZE_UNSUPPORTED','inherited-color-invalid':'DOCX_INLINE_COLOR_INVALID','direct-color-invalid':'DOCX_INLINE_COLOR_INVALID','inherited-highlight-invalid':'DOCX_INLINE_HIGHLIGHT_INVALID','inherited-bold-invalid':'DOCX_INLINE_ON_OFF_INVALID'};
  assert.equal(error.code||error.message,expected[mutation]);assert.deepEqual(source.localAuthorityCapsule.exportMap,map);assert.deepEqual(doc,before);return;
 }
 const result=bridge.buildDocxReviewFormattingReturnCandidatesFromEvidence({returnedProjection:analysis.reviewIr},{fullManuscriptExportMap:map,cryptoPort});
 if(mutation==='none'){
  assert.equal(analysis.ok,true,JSON.stringify(analysis));assert.equal(result.ok,true,JSON.stringify(result));assert.deepEqual(result.candidates,[]);assert.deepEqual(result.diagnostics,[]);
  assert.equal(analysis.reviewIr.formattingParagraphs.length,13);const rows=analysis.reviewIr.formattingParagraphs;
  assert.equal(rows[3].paragraphState.wordParagraphMarkTypography,undefined);assert.deepEqual(rows[3].effectiveParagraphMarkTypography,{fontFamily:'Times New Roman',fontSize:'12pt'});
  assert.deepEqual(rows[9].paragraphState.wordParagraphMarkTypography,{fontSlots:{ascii:'Georgia'},fontSize:'14pt'});
  assert.deepEqual(rows[9].effectiveParagraphMarkTypography,{fontSlots:{ascii:'Georgia',hAnsi:'Times New Roman',eastAsia:'Times New Roman',cs:'Times New Roman'},fontSize:'14pt'});
  assert.equal(rows[8].unsupportedParagraphNames.includes('shd'),true);assert.equal(rows[6].unsupportedParagraphNames.includes('numPr'),true);
 }else assert.ok(!analysis.ok||!result.ok||result.candidates?.length||result.diagnostics?.length,JSON.stringify({mutation,result}));
 assert.deepEqual(source.localAuthorityCapsule.exportMap,map);assert.deepEqual(doc,before);
});

test('actual effective marker and code facts remain bound by existing worker packet integrity',async()=>{
 const [,bridge]=await modules,source=freshBodySource(completeBodyRoleDocument()),bytes=buildDocxReviewPacketBuffer(source),analysis=bridge.buildDocxReviewTransportAnalysisFromZipBytes({bytes},{cryptoPort});assert.equal(analysis.ok,true);
 const artifactSha256='sha256:'+hash(bytes),packet=bridge.buildReturnEvidencePacketV1({requestId:'owned-effective-projection',artifactSha256,returnedProjection:analysis.reviewIr,projectionDigest:analysis.supportedSemanticDigest,effectiveBudgets:analysis.effectiveBudgets,effectiveBudgetDigest:analysis.effectiveBudgetDigest,workerBuildDigest:analysis.parserProfileDigest});
 assert.equal(bridge.verifyReturnEvidencePacketV1(packet,{expectedArtifactSha256:artifactSha256}).ok,true);
 for(const mutate of [p=>p.returnedProjection.formattingParagraphs[0].effectiveParagraphMarkTypography.fontFamily='Arial',p=>p.returnedProjection.formattingParagraphs[8].effectiveCodeStyle.shading.fill='ff0000',p=>delete p.returnedProjection.formattingParagraphs[0].effectiveParagraphMarkTypography]){
  const forged=structuredClone(packet);mutate(forged);const rejected=bridge.verifyReturnEvidencePacketV1(forged,{expectedArtifactSha256:artifactSha256});assert.equal(rejected.ok,false);assert.equal(rejected.detail,'packet-digest-mismatch');
 }
});

test('actual effective marker equality preserves authored off and reset spelling in raw source',async()=>{
 const [,bridge]=await modules,doc={type:'doc',content:[{type:'paragraph',attrs:{wordParagraphMarkTypography:{bold:false,color:null,highlight:null}},content:[{type:'text',text:'Authored off'}]}]},before=structuredClone(doc),source=freshBodySource(doc),map=structuredClone(source.localAuthorityCapsule.exportMap);
 const parts=wordRelocatedBodyParts(bridge.extractDocxReviewTransportPackagePartsFromZipBytes({bytes:buildDocxReviewPacketBuffer(source)}).parts);
 parts['word/document.xml']=parts['word/document.xml'].replace(/<w:b w:val="0"\/>|<w:color w:val="auto"\/>|<w:highlight w:val="none"\/>|<w:shd w:val="nil"\/>/gu,'');
 const bytes=require('../../src/export/docx/docxMinBuilder.js').buildStoredZip(Object.entries(parts).map(([name,data])=>({name,data}))),analysis=bridge.buildDocxReviewTransportAnalysisFromZipBytes({bytes},{cryptoPort});assert.equal(analysis.ok,true,JSON.stringify(analysis));
 const result=bridge.buildDocxReviewFormattingReturnCandidatesFromEvidence({returnedProjection:analysis.reviewIr},{fullManuscriptExportMap:map});assert.deepEqual(result.candidates,[]);assert.deepEqual(result.diagnostics,[]);assert.deepEqual(doc,before);assert.deepEqual(source.localAuthorityCapsule.exportMap,map);
});

test('closed body profiles accept native ordinary realms without executing foreign object callbacks',()=>{
 const vm=require('node:vm'),helper=require('../../src/core/word-review-typography-v1.cjs');
 for(const original of [typography,helper.freshBodyTypography()]){
  const foreign=vm.runInNewContext('('+JSON.stringify(original)+')');
  assert.deepEqual(helper.validate(foreign),original);
  const nullOwned=Object.assign(Object.create(null),original);assert.deepEqual(helper.validate(nullOwned),original);
 }
 let calls=0;
 const base={...typography},getter={...base};Object.defineProperty(getter,'fontSize',{enumerable:true,get(){calls++;return '12pt';}});
 const hidden={...base};Object.defineProperty(hidden,'extra',{value:true});
 const symbol={...base,[Symbol('extra')]:true},callback={...base,toJSON(){calls++;return base;}};
 const fakeProto=Object.create(null);Object.defineProperty(fakeProto,'constructor',{value:Object});
 const accessorProto=Object.create(null);Object.defineProperty(accessorProto,'constructor',{get(){calls++;return Object;}});
 const classValue=new (class Profile{constructor(){Object.assign(this,base);}})();
 for(const value of [getter,hidden,symbol,callback,classValue,Object.assign(Object.create(fakeProto),base),Object.assign(Object.create(accessorProto),base),Object.assign(Object.create({}),base),{...base,extra:true},{fontSize:'12pt'},null])assert.throws(()=>helper.validate(value),/WORD_REVIEW_TYPOGRAPHY_INVALID/u);
 const pollution=JSON.parse('{"schemaVersion":"yalken.review-docx.typography-defaults.v1","fontSize":"12pt","__proto__":{}}');assert.throws(()=>helper.validate(pollution),/WORD_REVIEW_TYPOGRAPHY_INVALID/u);
 assert.equal(calls,0);
});

test('body publication compares exact source-owned internal hyperlink join and refuses foreign metadata',async()=>{
 const [,bridge]=await modules,model=require('../../src/core/word-user-bookmarks-v1.cjs'),helper=require('../../src/core/word-review-typography-v1.cjs');
 const p={type:'paragraph',content:[{type:'text',text:'Target'}]},created=model.planMutation({doc:{type:'doc',content:[p]},action:'create',projectId:'project-body-profile',sceneId,requestId:'body-join',name:'Target',start:{paragraphIndex:0,offsetUtf16:0,edge:'text'},end:{paragraphIndex:0,offsetUtf16:6,edge:'text'}});
 created.doc.content[0].content[0].marks=[{type:'link',attrs:model.linkAttrs(created.registry.bookmarks[0])}];
 const before=structuredClone(created.doc),source=freshBodySource(created.doc),bytes=buildDocxReviewPacketBuffer(source),analysis=bridge.buildDocxReviewTransportAnalysisFromZipBytes({bytes},{cryptoPort});assert.equal(analysis.ok,true);
 const raw=source.blocks[0].formatIr,actual=analysis.reviewIr.formattingParagraphs[0];
 assert.deepEqual(actual.formattedRuns[0].inlineState,{fontFamily:'Times New Roman',fontSize:'12pt',wordLanguage:{val:'en-US',eastAsia:'en-US',bidi:'en-US'},link:'#Target',wordBookmarkName:'Target'});
 assert.equal(helper.readback(raw,actual,source.exportTypography),true);
 for(const mutate of [r=>r.inlineState.wordBookmarkName='Foreign',r=>r.inlineState.link='#Foreign',r=>r.inlineState.link='https://example.invalid',r=>r.inlineState.foreign=true]){
  const forged=structuredClone(actual);mutate(forged.formattedRuns[0]);assert.equal(helper.readback(raw,forged,source.exportTypography),false);
 }
 for(const mutate of [m=>m.type='foreign',m=>m.attrs.wordBookmarkId='ubm-invalid',m=>m.attrs.wordBookmarkName='Foreign',m=>m.attrs.href='https://example.invalid']){
  const forged=structuredClone(raw);mutate(forged.runs[0].preservedMarks[0]);assert.equal(helper.readback(forged,actual,source.exportTypography),false);
 }
 const parts=bridge.extractDocxReviewTransportPackagePartsFromZipBytes({bytes}).parts;parts['word/document.xml']=parts['word/document.xml'].replace('w:anchor="Target"','w:anchor="Foreign"');
 const altered=bridge.buildDocxReviewTransportAnalysisFromZipBytes({bytes:require('../../src/export/docx/docxMinBuilder.js').buildStoredZip(Object.entries(parts).map(([name,data])=>({name,data})))},{cryptoPort});assert.equal(altered.ok,true);
 assert.equal(helper.readback(raw,altered.reviewIr.formattingParagraphs[0],source.exportTypography),false);
 const unknown=structuredClone(created.doc.content[0].content[0].marks[0]);unknown.attrs.wordBookmarkId='ubm-'+'f'.repeat(32);
 assert.throws(()=>model.inspectInternalLink(unknown,created.registry),/USER_BOOKMARK_LINK_TARGET_INVALID/u,'typed source attr classification cannot grant registry membership');
 assert.deepEqual(created.doc,before);
});

test('source-owned settings reject duplicate default tab stops before return meaning is selected',async()=>{
 const [,bridge]=await modules,source=freshBodySource({type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Tab sentinel'}]}]}),bytes=buildDocxReviewPacketBuffer(source);
 const parts=bridge.extractDocxReviewTransportPackagePartsFromZipBytes({bytes}).parts,settings=parts['word/settings.xml'],parser=await import('../../src/io/revisionBridge/reviewTransportPackageParserV2.mjs');
 assert.deepEqual(parser.extractDocumentDefaultTabStopV1(settings,{cryptoPort}),{effective:720,explicit:true});
 assert.throws(()=>parser.extractDocumentDefaultTabStopV1(settings.replace('</w:settings>','<w:defaultTabStop w:val="708"/></w:settings>'),{cryptoPort}),/WORD_DEFAULT_TAB_STOP_INVALID/u);
 assert.deepEqual(parser.extractDocumentDefaultTabStopV1(settings.replace('<w:defaultTabStop w:val="720"/>','<w:defaultTabStop w:val="708"/>'),{cryptoPort}),{effective:708,explicit:true});
});


test('finite body language effects validate complete coverage and preserve raw UTF16 break and partial authored fields',()=>{
 const body=require('../../src/core/word-review-typography-v1.cjs'),language=require('../../src/core/word-language-v1.cjs'),profile=body.freshBodyTypography();
 const source={type:'paragraph',attrs:{wordParagraphMarkLanguage:{eastAsia:'ja-JP'}},content:[
  {type:'text',text:'A😀',marks:[{type:'bold'},{type:'textStyle',attrs:{wordLanguage:{bidi:'ar-SA'}}}]},
  {type:'hardBreak',attrs:{wordBreakType:'page'},marks:[{type:'italic'}]},
  {type:'text',text:'B',marks:[{type:'italic'}]}]};
 const original=JSON.stringify(source),marker={val:'en-US',eastAsia:'ja-JP',bidi:'en-US'};
 for(const key of ['val','eastAsia','bidi']) {
  const changed={...marker,[key]:{val:'fr-FR',eastAsia:'zh-CN',bidi:'he-IL'}[key]};
  const actual={schemaVersion:1,paragraphMark:marker,runs:[
   {from:0,to:3,language:{...marker,bidi:'ar-SA'}},{from:3,to:4,language:marker},{from:4,to:5,language:changed}]};
  const effect=body.languageEffects(source,actual,profile),applied=language.applyParagraphLanguage(source,effect);
  assert.deepEqual(effect.paragraphMark,{eastAsia:'ja-JP'});assert.deepEqual(effect.runs.map(r=>r.language),[{bidi:'ar-SA'},null,{[key]:changed[key]}]);
  assert.deepEqual(applied.content[1],source.content[1]);assert.equal(applied.content[0].text,'A😀');assert.equal(applied.content[2].marks[0].type,'italic');
  const projected=body.document({type:'doc',content:[applied]},profile).content[0];
  assert.deepEqual(projected.content.map(n=>n.marks.find(m=>m.type==='textStyle').attrs.wordLanguage),actual.runs.map(r=>r.language));
 }
 const valid={schemaVersion:1,paragraphMark:marker,runs:[{from:0,to:5,language:marker}]};
 for(const mutate of [x=>x.runs[0].from=1,x=>x.runs[0].to=6,x=>x.runs[0].to=4,
  x=>x.runs=[{from:0,to:2,language:marker},{from:2,to:5,language:marker}],
  x=>x.runs=[{from:0,to:3,language:marker},{from:2,to:5,language:marker}],
  x=>x.runs=[{from:0,to:3,language:marker},{from:4,to:5,language:marker}],
  x=>x.runs[0].ignored=true,x=>delete x.runs[0].language.bidi,x=>x.ignored=true]) {
  const bad=structuredClone(valid);mutate(bad);assert.throws(()=>body.languageEffects(source,bad,profile),/WORD_LANGUAGE_INVALID|WORD_BODY_LANGUAGE_EFFECT_UNPROVEN/u);
  assert.equal(JSON.stringify(source),original);
 }
});


test('actual finite body producer ZIP language edits retain partial authored source and UTF16 typed breaks for each slot',async()=>{
 const [,bridge]=await modules,body=require('../../src/core/word-review-typography-v1.cjs'),language=require('../../src/core/word-language-v1.cjs');
 const paragraph={type:'paragraph',attrs:{wordParagraphMarkLanguage:{eastAsia:'ja-JP'}},content:[
  {type:'text',text:'A😀',marks:[{type:'bold'},{type:'textStyle',attrs:{wordLanguage:{bidi:'ar-SA'}}}]},
  {type:'hardBreak',attrs:{wordBreakType:'page'},marks:[{type:'italic'}]},{type:'text',text:'B',marks:[{type:'italic'}]}]};
 const doc={type:'doc',content:[paragraph]},original=JSON.stringify(doc),source=freshBodySource(doc),own=buildDocxReviewPacketBuffer(source);
 const originalParts=bridge.extractDocxReviewTransportPackagePartsFromZipBytes({bytes:own}).parts;
 for(const [key,value] of [['val','fr-FR'],['eastAsia','zh-CN'],['bidi','he-IL']]) {
  const parts={...originalParts};let changed=false;
  parts['word/document.xml']=parts['word/document.xml'].replace(/<w:r>[\s\S]*?<\/w:r>/gu,run=>{
   if(!run.includes('>B</w:t>'))return run;assert.equal(changed,false);changed=true;return run.replace(new RegExp('w:'+key+'="[^"]+"','u'),'w:'+key+'="'+value+'"');
  });assert.equal(changed,true);
  const bytes=require('../../src/export/docx/docxMinBuilder.js').buildStoredZip(Object.entries(parts).map(([name,data])=>({name,data}))),actual=bridge.buildDocxReviewTransportAnalysisFromZipBytes({bytes},{cryptoPort});assert.equal(actual.ok,true);
  const row=actual.reviewIr.formattingParagraphs[0],change={schemaVersion:1,paragraphMark:row.wordParagraphMarkLanguage,runs:row.formattedRuns.map(run=>({from:run.from,to:run.to,language:run.wordLanguage}))};
  assert.deepEqual(row.typedBreaks,[{offset:3,type:'page'}]);
  const effect=body.languageEffects(paragraph,change,source.exportTypography),next=language.applyParagraphLanguage(paragraph,effect);
  assert.deepEqual(next.attrs,paragraph.attrs);assert.deepEqual(next.content.slice(0,2),paragraph.content.slice(0,2));assert.deepEqual(next.content[2].marks,[{type:'italic'},{type:'textStyle',attrs:{wordLanguage:{[key]:value}}}]);assert.equal(JSON.stringify(doc),original);
  const reexport=bridge.buildDocxReviewTransportAnalysisFromZipBytes({bytes:buildDocxReviewPacketBuffer(freshBodySource({type:'doc',content:[next]}))},{cryptoPort});assert.equal(reexport.ok,true);
  assert.deepEqual(reexport.reviewIr.formattingParagraphs[0].formattedRuns.map(run=>run.wordLanguage),row.formattedRuns.map(run=>run.wordLanguage));
  assert.deepEqual(reexport.reviewIr.formattingParagraphs[0].wordParagraphMarkLanguage,row.wordParagraphMarkLanguage);assert.deepEqual(reexport.reviewIr.formattingParagraphs[0].typedBreaks,row.typedBreaks);
 }
});

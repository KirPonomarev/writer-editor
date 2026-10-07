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


function freshBodySource(doc) {
 const {buildFullManuscriptDocxReviewPacketSource}=require('../../src/export/docx/fullManuscriptDocxReviewPacketSource.js');
 return buildFullManuscriptDocxReviewPacketSource({projectId:'project-body-profile',scenes:[{sceneId,doc,text:require('../../src/core/document-content-envelope-v1.cjs').deriveVisibleTextFromDocument(doc),order:0}]},
  {createdAtUtc:'2026-10-07T00:00:00.000Z',roundIdHex:'ab'.repeat(16),keyIdHex:'cd'.repeat(16),hmacSecret:'owned-local-body-profile-test',cryptoPort:{sha256Text:x=>'sha256:'+hash(x),sha256Json:x=>'sha256:'+hash(JSON.stringify(x,(_key,value)=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.keys(value).sort().map(key=>[key,value[key]])):value)),hmacSha256Json:(x,key)=>'hmac-sha256:'+crypto.createHmac('sha256',key).update(JSON.stringify(x)).digest('hex'),byteLength:x=>Buffer.byteLength(x)}});
}
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

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
 // Execute the exact predecessor reader, whose bytes predate this feature.
 const vm=require('node:vm'),cp=require('node:child_process'),module={exports:{}};
 const old=cp.execFileSync('git',['show','56de05bf:src/core/document-content-envelope-v1.cjs'],{encoding:'utf8'});
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
  changed.push({name:'[Content_Types].xml',data:'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'},
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
  {name:'[Content_Types].xml',data:'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'},
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
for(const fault of ['theme','duplicate-font','mixed-font','missing-script-font','duplicate-defaults','based-on','character-override','duplicate-style','paragraph-style','run-style','explicit-font','table'])test('font defaults evidence refuses '+fault,async()=>{
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
 if(fault==='table')options.table=true;
 const result=b.buildDocxReviewTransportAnalysisFromZipBytes({bytes:fontDefaultsPackage(options)},{cryptoPort});
 const run=result.reviewIr?.formattingParagraphs[0]?.formattedRuns[0];
 assert.ok(run,JSON.stringify(result));assert.equal(Object.hasOwn(run,'resolvedFontFamily'),false);
});

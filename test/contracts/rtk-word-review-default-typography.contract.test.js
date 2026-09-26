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

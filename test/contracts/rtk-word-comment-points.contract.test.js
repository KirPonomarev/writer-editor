'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {buildStoredZip} = require('../../src/export/docx/docxMinBuilder.js');
const {buildFullManuscriptDocxReviewPacketSource:source} = require('../../src/export/docx/fullManuscriptDocxReviewPacketSource.js');
const {buildDocxReviewPacketBuffer:exportDocx} = require('../../src/export/docx/docxReviewPacketBuilder.js');
const sha = v => crypto.createHash('sha256').update(v).digest('hex');
const ports = {cryptoPort:{sha256Text:sha,sha256Json:v=>'sha256:'+sha(JSON.stringify(v)),byteLength:v=>Buffer.byteLength(v)}};
function pointDocx(offset=5) {
 const text='Alpha anchor omega.', W='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
 return buildStoredZip([
 {name:'[Content_Types].xml',data:'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/comments.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml"/></Types>'},
 {name:'_rels/.rels',data:'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="r1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'},
 {name:'word/_rels/document.xml.rels',data:'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="r2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments" Target="comments.xml"/></Relationships>'},
 {name:'word/document.xml',data:`<w:document xmlns:w="${W}"><w:body><w:p><w:r><w:t>${text.slice(0,offset)}</w:t></w:r><w:commentRangeStart w:id="0"/><w:commentRangeEnd w:id="0"/><w:r><w:commentReference w:id="0"/></w:r><w:r><w:t xml:space="preserve">${text.slice(offset)}</w:t></w:r></w:p></w:body></w:document>`},
 {name:'word/comments.xml',data:`<w:comments xmlns:w="${W}"><w:comment w:id="0" w:author="Alice"><w:p><w:r><w:t>Point body</w:t></w:r></w:p></w:comment></w:comments>`}]);
}
test('generic adjacent Word markers retain exact point identity through canonical export and parser',async()=>{
 const bridge=await import('../../src/io/revisionBridge/index.mjs');
 const {materializeGenericComments}=await import('../../src/io/revisionBridge/genericWordComments.mjs');
 for(const offset of [0,5,19]) {
  const preview=bridge.buildDocxContentPreviewFromZipBytes(pointDocx(offset));
  const plan=bridge.buildDocxImportPreviewPlanFromContentPreview(preview);
  assert.equal(plan.ok,true,JSON.stringify(plan));
  const entry=plan.candidateCreatePlan.entries[0], text='Alpha anchor omega.';
  const state=JSON.parse(materializeGenericComments({candidates:entry.comments,paragraphs:[{text}],projectId:'p',sceneId:'roman/a.txt',importOperationId:'point-'+offset,beforeText:null}).afterText);
  assert.equal(state.schemaVersion,'yalken.rtk.word.non-text-return-state.v3');
  assert.equal(state.threads[0].anchor.kind,'point');assert.equal(state.threads[0].anchor.affinity,'right');assert.equal(state.threads[0].anchor.startUtf16,offset);
  const doc={type:'doc',content:[{type:'paragraph',content:[{type:'text',text}]}]};
  const exported=exportDocx(source({projectId:'p',projectRoot:'/synthetic',scenes:[{sceneId:'roman/a.txt',scenePath:'/synthetic/roman/a.txt',text,doc,order:0}],nonTextReturnState:state}));
  const analysis=bridge.buildDocxReviewTransportAnalysisFromZipBytes({bytes:exported},ports);
  assert.equal(analysis.ok,true,JSON.stringify(analysis.reasons));const root=analysis.reviewIr.commentThreads[0];
  assert.equal(root.status,'ANCHORED');assert.equal(root.anchorRange.startUtf16,offset);assert.equal(root.anchorRange.endUtf16,root.anchorRange.startUtf16);assert.equal(root.body,'Point body');
  const parts=bridge.extractDocxReviewTransportPackagePartsFromZipBytes({bytes:exported}).parts;
  assert.match(parts['word/document.xml'],/<w:commentRangeStart w:id="0"\/><w:commentRangeEnd w:id="0"\/><w:r><w:commentReference w:id="0"\/><\/w:r>/u);
 }
});
test('generic point admission rejects empty legacy quote and forged point affinity or offset',async()=>{
 const {materializeGenericComments}=await import('../../src/io/revisionBridge/genericWordComments.mjs');const text='Alpha';
 const candidate={paragraphIndex:0,startUtf16:5,selectedText:'',blockTextSha256:sha(text),status:'open',messages:[{sourceCommentId:'0',body:'Point',provenance:{author:'A'}}]};
 for(const extra of [{},{kind:'point',affinity:'left'},{kind:'point',affinity:'right',startUtf16:6},{kind:'point',affinity:'right',selectedText:'A'}]) assert.throws(()=>materializeGenericComments({candidates:[{...candidate,...extra}],paragraphs:[{text}],projectId:'p',sceneId:'a',importOperationId:'x',beforeText:null}),/ANCHOR/);
});
test('point markers coexist with ending and starting ranges without reversed point or reply order',()=>{
 const {commentMarkersForBlock}=require('../../src/export/docx/docxReviewPacketComments.js');
 const block={blockId:'b',sceneId:'s',text:'AlphaBeta'};
 const thread=(id,start,end,point=false)=>({sceneId:'s',anchor:{blockId:'b',startUtf16:start,endUtf16:end,selectedText:block.text.slice(start,end),...(point?{kind:'point',affinity:'right'}:{})},messages:[{commentId:id}]});
 const markers=commentMarkersForBlock({threads:[thread('left',0,5),thread('point',5,5,true),thread('right',5,9)]},block);
 assert.equal(markers.get(5),'<w:commentRangeEnd w:id="left"/><w:r><w:commentReference w:id="left"/></w:r><w:commentRangeStart w:id="point"/><w:commentRangeEnd w:id="point"/><w:r><w:commentReference w:id="point"/></w:r><w:commentRangeStart w:id="right"/>');
 const root=thread('root',5,5,true);root.messages.push({commentId:'reply'});
 const xml=commentMarkersForBlock({threads:[root]},block).get(5);
 assert.match(xml,/<w:commentReference w:id="root"\/><\/w:r><w:commentRangeStart w:id="reply"/u);
 assert.throws(()=>commentMarkersForBlock({threads:[thread('empty',5,5)]},block),/ANCHOR_STALE/);
});
test('authenticated point movement requires exact admitted text delta and preserves thread identity',async()=>{
 const bridge=await import('../../src/io/revisionBridge/index.mjs');
 const {materializeGenericComments}=await import('../../src/io/revisionBridge/genericWordComments.mjs');
 const {planCommentReturnDelta}=require('../../src/core/word-comment-return-delta-v1.cjs');
 const text='Alpha anchor omega.',sceneId='roman/a.txt';
 const preview=bridge.buildDocxContentPreviewFromZipBytes(pointDocx(5));const candidates=bridge.buildDocxImportPreviewPlanFromContentPreview(preview).candidateCreatePlan.entries[0].comments;
 const beforeText=materializeGenericComments({candidates,paragraphs:[{text}],projectId:'p',sceneId,importOperationId:'point-return',beforeText:null}).afterText;
 const state=JSON.parse(beforeText),doc={type:'doc',content:[{type:'paragraph',content:[{type:'text',text}]}]};
 const baseline=source({projectId:'p',projectRoot:'/synthetic',scenes:[{sceneId,scenePath:'/synthetic/'+sceneId,text,doc,order:0}],nonTextReturnState:state});
 const bytes=exportDocx(baseline),parts=bridge.extractDocxReviewTransportPackagePartsFromZipBytes({bytes}).parts;
 const inputFor=bytes=>{const a=bridge.buildDocxReviewTransportAnalysisFromZipBytes({bytes},ports);assert.equal(a.ok,true,JSON.stringify(a.reasons));return {beforeText,projectId:'p',roundId:'point-return',artifactSha256:sha(bytes),baseline:baseline.commentExport,exportMap:baseline.localAuthorityCapsule.exportMap,returnedThreads:a.reviewIr.commentThreads,returnedParagraphs:a.reviewIr.formattingParagraphs,commentReturnInventory:a.reviewIr.commentReturnInventory};};
 assert.equal(planCommentReturnDelta(inputFor(bytes)).unchanged,true);
 assert.match(parts['word/document.xml'],/>Alpha<\/w:t>/u);
 const changedParts={...parts,'word/document.xml':parts['word/document.xml'].replace('>Alpha</w:t>','>AlphaX</w:t>')};
 const changed=buildStoredZip(Object.entries(changedParts).map(([name,data])=>({name,data}))),input=inputFor(changed);
 assert.throws(()=>planCommentReturnDelta(input),/MANUSCRIPT_CHANGED/);
 const proof={sceneId,paragraphIndex:0,oldText:text,newText:'AlphaX anchor omega.'};
 const result=planCommentReturnDelta({...input,textChanges:[proof]}),after=JSON.parse(result.afterText);
 assert.equal(after.threads[0].anchor.startUtf16,6);assert.equal(after.threads[0].anchor.kind,'point');assert.equal(after.threads[0].anchor.selectedText,'');assert.equal(after.threads[0].threadId,state.threads[0].threadId);assert.deepEqual(after.threads[0].messages,state.threads[0].messages);
 for(const textChanges of [[{...proof,sceneId:'other'}],[{...proof,oldText:'forged'}],[{...proof,newText:text}],[proof,proof],[{...proof,paragraphIndex:1}],[{...proof,extra:true}]]) assert.throws(()=>planCommentReturnDelta({...input,textChanges}),/TEXT_PROOF_INVALID/);
 const forged=structuredClone(input);forged.returnedThreads[0].finalTextAnchorRange.blockTextSha256=sha(text);
 assert.throws(()=>planCommentReturnDelta({...forged,textChanges:[proof]}),/ANCHOR_INVALID/);
});
test('point admission rejects splitting surrogate or combining grapheme and never clamps an offset',async()=>{
 const {materializeGenericComments}=await import('../../src/io/revisionBridge/genericWordComments.mjs');
 for(const [text,startUtf16] of [['A😀B',2],['Ae\u0301B',2],['Alpha',6],['Alpha',-1]]) {
  const candidate={kind:'point',affinity:'right',paragraphIndex:0,startUtf16,selectedText:'',blockTextSha256:sha(text),status:'open',messages:[{sourceCommentId:'0',body:'Point',provenance:{}}]};
  assert.throws(()=>materializeGenericComments({candidates:[candidate],paragraphs:[{text}],projectId:'p',sceneId:'a',importOperationId:'x',beforeText:null}),/ANCHOR/);
 }
});
test('reference-only point is exact, while missing range halves and duplicate references remain rejected',async()=>{
 const bridge=await import('../../src/io/revisionBridge/index.mjs');
 const base=bridge.extractDocxReviewTransportPackagePartsFromZipBytes({bytes:pointDocx(5)}).parts;
 const document=base['word/document.xml'];
 const transform=xml=>buildStoredZip(Object.entries({...base,'word/document.xml':xml}).map(([name,data])=>({name,data})));
 const noMarkers=document.replace('<w:commentRangeStart w:id="0"/>','').replace('<w:commentRangeEnd w:id="0"/>','');
 const preview=bridge.buildDocxContentPreviewFromZipBytes(transform(noMarkers));
 assert.equal(preview.ok,true,JSON.stringify(preview));const candidate=bridge.buildDocxImportPreviewPlanFromContentPreview(preview).candidateCreatePlan.entries[0].comments[0];
 assert.equal(candidate.startUtf16,5);assert.equal(candidate.kind,'point');assert.equal(candidate.selectedText,'');
 for(const xml of [document.replace('<w:commentRangeStart w:id="0"/>',''),document.replace('<w:commentRangeEnd w:id="0"/>',''),noMarkers.replace('<w:commentReference w:id="0"/>','<w:commentReference w:id="0"/><w:commentReference w:id="0"/>'),noMarkers.replace('<w:commentReference w:id="0"/>','').replace('</w:body>','<w:r><w:commentReference w:id="0"/></w:r></w:body>')]) assert.equal(bridge.buildDocxContentPreviewFromZipBytes(transform(xml)).ok,false);
});
test('Word-saved point markers may straddle an adjacent range end without semantic crossing',async()=>{
 const bridge=await import('../../src/io/revisionBridge/index.mjs');
 const base=bridge.extractDocxReviewTransportPackagePartsFromZipBytes({bytes:pointDocx(5)}).parts;
 base['word/comments.xml']=base['word/comments.xml'].replace('</w:comments>','<w:comment w:id="1" w:author="B"><w:p><w:r><w:t>Range</w:t></w:r></w:p></w:comment></w:comments>');
 base['word/document.xml']=base['word/document.xml'].replace('<w:p>','<w:p><w:commentRangeStart w:id="1"/>').replace('<w:commentRangeStart w:id="0"/>','<w:commentRangeStart w:id="0"/><w:commentRangeEnd w:id="1"/><w:r><w:commentReference w:id="1"/></w:r>');
 const bytes=buildStoredZip(Object.entries(base).map(([name,data])=>({name,data})));
 const preview=bridge.buildDocxContentPreviewFromZipBytes(bytes);assert.equal(preview.ok,true,JSON.stringify(preview));
 const comments=bridge.buildDocxImportPreviewPlanFromContentPreview(preview).candidateCreatePlan.entries[0].comments;
 assert.deepEqual(comments.map(c=>[c.startUtf16,c.selectedText,c.kind]).sort((a,b)=>a[0]-b[0]),[[0,'Alpha',undefined],[5,'','point']]);
});

test('comment-bearing text return keeps fontless boundary breaks without admitting unresolved text fonts or lost break fonts',async()=>{
 const bridge=await import('../../src/io/revisionBridge/index.mjs');
 const analyzer=await import('../../src/io/revisionBridge/reviewTransportUserBookmarksV1.mjs');
 const {stableJson}=await import('../../src/io/revisionBridge/reviewTransportCore.mjs');
 const env=require('../../src/core/document-content-envelope-v1.cjs');
 const model=require('../../src/core/word-comment-authoring-v1.cjs');
 const sceneId='roman/breaks.txt',text='\nAlpha omega\n';
 const family=[{type:'textStyle',attrs:{fontFamily:'Aptos'}}];
 const doc={type:'doc',content:[{type:'paragraph',content:[{type:'hardBreak'},{type:'text',text:'Alpha omega',marks:family},{type:'hardBreak'}]},{type:'paragraph'}]};
 const state={schemaVersion:'yalken.rtk.word.non-text-return-state.v3',projectId:'breaks',revision:0,events:[],threads:[{
  threadId:'point',rootCommentId:'point-root',sceneId,status:'open',anchor:model.exactAnchor({paragraphIndex:0,startUtf16:6,selectedText:'',kind:'point',affinity:'right'},sceneId,[text]),
  messages:[{commentId:'point-root',kind:'root',body:'Point at Alpha end',provenance:{author:'A'}}],
 }]};
 const cryptoPort={...ports.cryptoPort,sha256Json:v=>'sha256:'+sha(stableJson(v))};
 const baseline=source({projectId:'breaks',projectRoot:'/synthetic',nonTextReturnState:state,scenes:[{sceneId,scenePath:'/synthetic/'+sceneId,order:0,doc,text:env.deriveVisibleTextFromDocument(doc),observableContent:env.composeObservablePayload({doc})}]});
 const original=exportDocx(baseline),map=bridge.bindUserBookmarkExportTransportPartsV1(baseline.localAuthorityCapsule.exportMap,original);
 const parts=bridge.extractDocxReviewTransportPackagePartsFromZipBytes({bytes:original}).parts;
 // Simulate Word's fontless break representation; explicit export typography
 // is independently covered by canonical-comment-reexport.
 let fontlessBreaks=0;
 parts['word/document.xml']=parts['word/document.xml'].replace(/<w:r>[\s\S]*?<\/w:r>/gu,run=>{if(!/<w:br\/><\/w:r>$/u.test(run))return run;assert.match(run,/<w:rPr>/u);fontlessBreaks++;return run.replace(/<w:rPr>[\s\S]*?<\/w:rPr>/u,'');});
 assert.equal(fontlessBreaks,2);
 assert.match(parts['word/document.xml'],/>Alpha<\/w:t>/u);
 parts['word/document.xml']=parts['word/document.xml'].replace('>Alpha</w:t>','>AlphaX</w:t>');
 const returned=bridge.buildDocxReviewTransportAnalysisFromZipBytes({bytes:buildStoredZip(Object.entries(parts).map(([name,data])=>({name,data})))},{cryptoPort});
 assert.equal(returned.ok,true,JSON.stringify(returned.reasons));
 const ir=returned.reviewIr;
 assert.equal(ir.formattingParagraphs[0].paragraphText,'\nAlphaX omega\n');
 assert.equal(ir.commentThreads[0].finalTextAnchorRange.startUtf16,7);
 const input={baselineDoc:doc,sceneId,exportMap:map,reviewIr:ir,ordinaryTextMode:true,exportTypography:map.exportTypography};
 const accepted=analyzer.analyzeUserBookmarksReturn(input);assert.equal(accepted.ok,true,JSON.stringify(accepted));
 assert.equal(require('../../src/core/word-user-bookmarks-v1.cjs').textOf(accepted.doc.content[0]),'\nAlphaX omega\n');
 assert.deepEqual(accepted.doc.content[1],{type:'paragraph'},'unchanged empty paragraph keeps absent content key');
 assert.equal(accepted.doc.content[0].content[0].type,'hardBreak');assert.equal(accepted.doc.content[0].content.at(-1).type,'hardBreak');
 const emptyOwner=map.scenes[0].blocks[1].wordSignals.find(s=>s.kind==='bookmarkName').value.name;
 const languageXml=parts['word/document.xml'].replace(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/gu,row=>row.includes(`w:name="${emptyOwner}"`)?row.replace('w:val="en-US" w:eastAsia="en-US" w:bidi="en-US"','w:val="ru-FI" w:eastAsia="en-US" w:bidi="en-US"'):row);
 assert.notEqual(languageXml,parts['word/document.xml']);
 const languageIR=bridge.buildDocxReviewTransportAnalysisFromZipBytes({bytes:buildStoredZip(Object.entries({...parts,'word/document.xml':languageXml}).map(([name,data])=>({name,data})))},{cryptoPort}).reviewIr;
 const languageReturn=analyzer.analyzeUserBookmarksReturn({...input,reviewIr:languageIR});assert.equal(languageReturn.ok,true,JSON.stringify(languageReturn));
 assert.ok(languageReturn.ordinaryTextChanges.every(change=>change.expectedText!==''));
 const emptyLanguage=languageReturn.ordinaryFormattingOperations.find(op=>op.paragraphOrdinal===1 && op.paragraph.wordParagraphMarkLanguage);
 assert.deepEqual({from:emptyLanguage.from,to:emptyLanguage.to,text:emptyLanguage.selectedText,inline:emptyLanguage.inline,paragraph:emptyLanguage.paragraph},
  {from:0,to:0,text:'',inline:{},paragraph:{wordParagraphMarkLanguage:{action:'set',value:{val:'ru-FI',eastAsia:'en-US',bidi:'en-US'}}}});
 for(const mutate of [
  ir=>{const r=ir.formattingParagraphs[0].formattedRuns.find(r=>r.text.includes('AlphaX'));delete r.inlineState.fontFamily;delete r.resolvedFontFamily;},
  ir=>{const r=ir.formattingParagraphs[0].formattedRuns[0];r.from=1;r.to=2;},
 ]){const altered=structuredClone(ir);mutate(altered);const refused=analyzer.analyzeUserBookmarksReturn({...input,reviewIr:altered});assert.equal(refused.ok,false);assert.equal(refused.detail,'ordinary-text-font-profile-incomplete');}
 const languageLost=structuredClone(ir);for(const run of languageLost.formattingParagraphs[0].formattedRuns)if(run.text.includes('AlphaX')){delete run.wordLanguage;delete run.inlineState.wordLanguage;}
 assert.equal(analyzer.analyzeUserBookmarksReturn({...input,reviewIr:languageLost}).ok,false,'unresolved text language is never the bare-break exception');
 const authoredLanguage=structuredClone(doc);authoredLanguage.content[0].content[0].marks=[{type:'textStyle',attrs:{wordLanguage:{val:'en-US'}}}];
 const languageMap=structuredClone(map);languageMap.scenes[0].blocks[0].formatIr=require('../../src/export/docx/fullManuscriptDocxReviewPacketSource.js').buildFormatIrParagraphs({sceneId,doc:authoredLanguage,text:env.deriveVisibleTextFromDocument(authoredLanguage)})[0].formatIr;
 assert.equal(analyzer.analyzeUserBookmarksReturn({...input,baselineDoc:authoredLanguage,exportMap:languageMap}).ok,false,'authored break proofing language cannot disappear');
 assert.deepEqual(languageReturn.doc,accepted.doc,'empty-language effect does not alter the text, point or bare breaks');
 const styled=structuredClone(doc);styled.content[0].content[0].marks=[{type:'textStyle',attrs:{fontFamily:'Courier New'}}];
 const styledMap=structuredClone(map);const formats=require('../../src/export/docx/fullManuscriptDocxReviewPacketSource.js').buildFormatIrParagraphs({sceneId,doc:styled,text:env.deriveVisibleTextFromDocument(styled)});
 styledMap.scenes[0].blocks[0].formatIr=formats[0].formatIr;
 const lost=analyzer.analyzeUserBookmarksReturn({...input,baselineDoc:styled,exportMap:styledMap});assert.equal(lost.ok,false);assert.equal(lost.detail,'ordinary-text-font-profile-incomplete');
});

test('table comment paragraphs resolve owned default and paragraph styles, refusing competing or malformed table style chains',async()=>{
 const bridge=await import('../../src/io/revisionBridge/index.mjs');
 const base=bridge.extractDocxReviewTransportPackagePartsFromZipBytes({bytes:pointDocx(5)}).parts;
 const W='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
 base['[Content_Types].xml']=base['[Content_Types].xml'].replace('</Types>','<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>');
 base['word/_rels/document.xml.rels']=base['word/_rels/document.xml.rels'].replace('</Relationships>','<Relationship Id="style" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>');
 const originalParagraph=base['word/document.xml'].match(/<w:p>[\s\S]*?<\/w:p>/u)[0];
 const styledParagraph=originalParagraph.replace('<w:p>','<w:p><w:pPr><w:pStyle w:val="Normal"/></w:pPr>');
 base['word/document.xml']=base['word/document.xml'].replace(originalParagraph,`<w:tbl><w:tblPr/><w:tblGrid><w:gridCol w:w="7200"/></w:tblGrid><w:tr><w:tc><w:tcPr/>${styledParagraph}</w:tc></w:tr></w:tbl>`);
 const defaults='<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman" w:cs="Times New Roman"/><w:lang w:val="ru-FI"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="278" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>';
 const normal='<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>';
 const table=body=>`<w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/>${body}</w:style>`;
 const parse=(tableBody='',paragraphStyle=normal,documentXml=base['word/document.xml'],extraStyles='')=>bridge.buildDocxReviewTransportAnalysisFromZipBytes({bytes:buildStoredZip(Object.entries({...base,'word/document.xml':documentXml,'word/styles.xml':`<w:styles xmlns:w="${W}">${defaults}${paragraphStyle}${table(tableBody)}${extraStyles}</w:styles>`}).map(([name,data])=>({name,data})))},ports);
 const result=parse('<w:tblPr><w:tblInd w:w="0" w:type="dxa"/></w:tblPr>');assert.equal(result.ok,true,JSON.stringify(result.reasons));
 const paragraph=result.reviewIr.formattingParagraphs[0];assert.ok(paragraph.table);assert.equal(paragraph.paragraphText,'Alpha anchor omega.');
 assert.deepEqual(paragraph.paragraphState.wordParagraphSpacing,{after:160,line:278,lineRule:'auto'});
 assert.equal(paragraph.wordParagraphMarkLanguage.val,'ru-FI');assert.ok(paragraph.formattedRuns.every(run=>run.inlineState.fontFamily==='Times New Roman'||run.resolvedFontFamily==='Times New Roman'));
 assert.equal(result.reviewIr.commentThreads[0].anchorRange.startUtf16,5);
 for(const body of ['<w:tblPr><w:pPr><w:spacing w:after="0"/></w:pPr></w:tblPr>','<w:tcPr><w:rPr><w:b/></w:rPr></w:tcPr>','<w:trPr><w:tblStylePr w:type="firstRow"/></w:trPr>','<w:pPr><w:spacing w:after="0"/></w:pPr>','<w:rPr><w:b/></w:rPr>','<w:tblStylePr w:type="firstRow"><w:rPr><w:b/></w:rPr></w:tblStylePr>','<w:basedOn w:val="TableNormal"/>','<w:basedOn w:val="Missing"/>','<w:basedOn w:val="Normal"/>','<w:basedOn w:val="Missing"><w:b/></w:basedOn>']){
  const refused=parse(body);assert.ok(refused.ok===false || refused.reviewIr.formattingParagraphs[0]?.unsupportedParagraphNames.includes('styleResolution'),body+' '+JSON.stringify(refused.reasons));
 }
 const inner=base['word/document.xml'].match(/<w:tbl>[\s\S]*?<\/w:tbl>/u)[0];
 const nested=base['word/document.xml'].replace(inner,`<w:tbl><w:tblPr><w:tblStyle w:val="Outer"/></w:tblPr><w:tblGrid><w:gridCol w:w="7200"/></w:tblGrid><w:tr><w:tc><w:tcPr/>${inner}<w:p><w:r><w:t>Outer tail</w:t></w:r></w:p></w:tc></w:tr></w:tbl>`);
 const nestedResult=parse('',normal,nested,'<w:style w:type="table" w:styleId="Outer"><w:rPr><w:b/></w:rPr></w:style>');
 assert.equal(nestedResult.reviewIr.formattingParagraphs[0].unsupportedParagraphNames.includes('styleResolution'),false);
 assert.equal(nestedResult.reviewIr.formattingParagraphs[1].paragraphText,'Outer tail');
 assert.ok(nestedResult.reviewIr.formattingParagraphs[1].unsupportedParagraphNames.includes('styleResolution'));
 const cycle=parse('',normal.replace('<w:name w:val="Normal"/>','<w:name w:val="Normal"/><w:basedOn w:val="Normal"/>'));
 assert.ok(cycle.ok===false || cycle.reviewIr.formattingParagraphs[0]?.unsupportedParagraphNames.includes('styleResolution'));
});

test('ordinary and review export preserve nondefault marks on line page and column breaks',async()=>{
 const [bridge,docxPageSetupBindModule,semanticMappingModule,styleMapModule]=await Promise.all([import('../../src/io/revisionBridge/index.mjs'),import('../../src/docxPageSetupBind.mjs'),import('../../src/derived/semanticMapping.mjs'),import('../../src/derived/styleMap.mjs')]);
 const env=require('../../src/core/document-content-envelope-v1.cjs');
 const marks=[{type:'textStyle',attrs:{fontFamily:'Courier New',fontSize:'18pt',color:'#123456',wordLanguage:{val:'ru-FI',eastAsia:'ru-RU',bidi:'ar-SA'}}},{type:'bold'}];
 for(const kind of ['line','page','column']){
  const br={type:'hardBreak',...(kind==='line'?{}:{attrs:{wordBreakType:kind}}),marks};
  const doc={type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'A'},br,{type:'text',text:'B'}]}]};
  const baseline=source({projectId:'breaks',projectRoot:'/synthetic',scenes:[{sceneId:'a',scenePath:'/synthetic/a',order:0,doc,text:env.deriveVisibleTextFromDocument(doc)}]});
  assert.equal(baseline.blocks[0].formatIr.runs[1].inline.fontFamily,'Courier New');
  const ordinary=require('../../src/export/docx/docxMinBuilder.js').buildDocxMinBuffer({doc,bookProfile:{formatId:'A4'}},{docxPageSetupBindModule,semanticMappingModule,styleMapModule});
  for(const bytes of [ordinary,exportDocx(baseline)]){
   const xml=bridge.extractDocxReviewTransportPackagePartsFromZipBytes({bytes}).parts['word/document.xml'];
   assert.ok(xml.includes('Courier New'));assert.ok(xml.includes('w:val="36"'));
   const analysis=bridge.buildDocxReviewTransportAnalysisFromZipBytes({bytes},ports);assert.equal(analysis.ok,true,JSON.stringify(analysis.reasons));
   const paragraph=analysis.reviewIr.formattingParagraphs[0],run=paragraph.formattedRuns.find(run=>run.text==='\n');
   assert.equal(paragraph.paragraphText,'A\nB');assert.equal(run.inlineState.fontFamily,'Courier New');assert.equal(run.inlineState.fontSize,'18pt');assert.equal(run.inlineState.bold,true);assert.equal(run.inlineState.color,'#123456');assert.deepEqual(run.wordLanguage,{val:'ru-FI',eastAsia:'ru-RU',bidi:'ar-SA'});assert.match(xml,/<w:lang w:val="ru-FI" w:eastAsia="ru-RU" w:bidi="ar-SA"\/>/u);
   assert.deepEqual(paragraph.typedBreaks,kind==='line'?undefined:[{offset:1,type:kind}]);
  }
 }
 const plain={type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'A'},{type:'hardBreak'},{type:'text',text:'B'}]}]};
 const bytes=require('../../src/export/docx/docxMinBuilder.js').buildDocxMinBuffer({doc:plain,bookProfile:{formatId:'A4'}},{docxPageSetupBindModule,semanticMappingModule,styleMapModule});
 const xml=bridge.extractDocxReviewTransportPackagePartsFromZipBytes({bytes}).parts['word/document.xml'];
 assert.ok(xml.includes('<w:r><w:t xml:space="preserve">A</w:t><w:br/><w:t xml:space="preserve">B</w:t></w:r>'));
});

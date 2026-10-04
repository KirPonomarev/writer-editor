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

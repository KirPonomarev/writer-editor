'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const {buildFullManuscriptDocxReviewPacketSource:source}=require('../../src/export/docx/fullManuscriptDocxReviewPacketSource.js');
const {buildDocxReviewPacketBuffer:review}=require('../../src/export/docx/docxReviewPacketBuilder.js');
const {buildDocxMinBuffer:ordinary,buildStoredZip}=require('../../src/export/docx/docxMinBuilder.js');
const {compareCommentExportReadback}=require('../../src/export/docx/docxReviewPacketComments.js');
const {parseObservablePayload,deriveVisibleTextFromDocument}=require('../../src/core/document-content-envelope-v1.cjs');
const {paragraphs}=require('../../src/core/word-comment-anchor-save-v1.cjs');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const ports={cryptoPort:{sha256Text:sha,sha256Json:x=>sha(JSON.stringify(x)),byteLength:x=>Buffer.byteLength(x)}};
const hashes={'empty-end':'77fba3ad26bf7414827b923ef36d8303193c5f3426abf36ceaf437226b5364b7',root:'1611fb0b9bd1908c7745fc5dd64151fda9f0d3b1fbf07b921e0f56228c92f8c2',reply:'fd67b0dbfa55659c4bd44d298fff0bc04c09f8b7f14e9f5f355c82db9476d3dd','rich-ru':'6d615064f9e12ea00d99d36cf24df59bb934a05b47cb30f428d2c3229a3d3e3a'};
function native(name){const bytes=fs.readFileSync(require('node:path').join(__dirname,'../fixtures/word-multiparagraph-'+name+'-native.docx'));assert.equal(sha(bytes),hashes[name]);return bytes;}
async function setup(name){const bridge=await import('../../src/io/revisionBridge/index.mjs'),generic=await import('../../src/io/revisionBridge/genericWordComments.mjs');const preview=bridge.buildDocxContentPreviewFromZipBytes(native(name));assert.equal(preview.ok,true,JSON.stringify(preview));const plan=bridge.buildDocxImportPreviewPlanFromContentPreview(preview);assert.equal(plan.ok,true,JSON.stringify(plan));const entry=plan.candidateCreatePlan.entries[0],rows=paragraphs(entry.content),sceneId='roman/native.txt';const args={candidates:entry.comments,paragraphs:rows,projectId:'p',sceneId,importOperationId:'native-'+name,beforeText:null};const state=JSON.parse(generic.materializeGenericComments(args).afterText);const doc=parseObservablePayload(entry.content).doc;const input={projectId:'p',projectRoot:'/synthetic',nonTextReturnState:state,scenes:[{sceneId,scenePath:'/synthetic/'+sceneId,order:0,text:deriveVisibleTextFromDocument(doc),doc}]};return {bridge,generic,entry,rows,state,doc,input,args};}
for(const name of ['root','reply'])test('native Word '+name+' range imports and survives ordinary and Review export',async()=>{
 const f=await setup(name),anchor=f.state.threads[0].anchor;
 assert.equal(f.state.schemaVersion,'yalken.rtk.word.non-text-return-state.v4');
 assert.deepEqual(f.rows.map(r=>r.text),['Alpha one.','Beta two.','Gamma protected.']);
 assert.equal(anchor.sceneParagraphIndex,0);assert.equal(anchor.startUtf16,6);assert.equal(anchor.endSceneParagraphIndex,1);assert.equal(anchor.endUtf16,4);
 assert.equal(anchor.selectedText,'one.\nBeta');assert.equal(anchor.coveredParagraphsSha256,sha(JSON.stringify(['Alpha one.','Beta two.'])));
 assert.deepEqual(f.state.threads[0].messages.map(m=>m.body),['Check the transition across both paragraphs.',...(name==='reply'?['Keep this transition together after the next edit.']:[])]);
 const projection=source(f.input);
 const [docxPageSetupBindModule,semanticMappingModule,styleMapModule]=await Promise.all([import('../../src/docxPageSetupBind.mjs'),import('../../src/derived/semanticMapping.mjs'),import('../../src/derived/styleMap.mjs')]);
 for(const bytes of [review(projection),ordinary({doc:f.doc,plainText:f.input.scenes[0].text,bookProfile:{formatId:'A4'}},{docxPageSetupBindModule,semanticMappingModule,styleMapModule,commentExport:projection.commentExport,commentBlocks:projection.blocks})]){
  const analysis=f.bridge.buildDocxReviewTransportAnalysisFromZipBytes({bytes},ports);assert.equal(analysis.ok,true);
  assert.equal(compareCommentExportReadback(projection.commentExport,analysis.reviewIr.commentThreads).ok,true);
  const again=f.bridge.buildDocxContentPreviewFromZipBytes(bytes);assert.equal(again.ok,true,JSON.stringify(again));
  assert.deepEqual(again.contentPreview.paragraphs.map(p=>p.text),f.rows.map(p=>p.text));
  assert.equal(again.contentPreview.genericComments[0].selectedText,'one.\nBeta');
  const xml=f.bridge.extractDocxReviewTransportPackagePartsFromZipBytes({bytes}).parts['word/document.xml'];
  assert.match(xml,/<w:t xml:space="preserve">Alpha <\/w:t>/);assert.match(xml,/<w:t xml:space="preserve"> two\.<\/w:t>/);
 }
});
test('multi-range import rejects changed middle/endpoint proof and foreign cell ownership',async()=>{
 const f=await setup('reply');
 for(const mutate of [a=>{a.candidates[0].endParagraphIndex=2;},a=>{a.candidates[0].endUtf16=99;},a=>{a.candidates[0].coveredParagraphsSha256='0'.repeat(64);},a=>{a.paragraphs[1].text='Beta too.';},a=>{a.paragraphs[1].table={tableId:'other',row:0,column:0};}]){
  const args=structuredClone(f.args);mutate(args);assert.throws(()=>f.generic.materializeGenericComments(args),/ANCHOR/);
 }
});
test('native active automatic paragraph spacing stays an explicit unsupported input',async()=>{
 const bridge=await import('../../src/io/revisionBridge/index.mjs'),bytes=native('rich-ru');
 const result=bridge.buildDocxContentPreviewFromZipBytes(bytes);assert.equal(result.ok,true,JSON.stringify(result));
 const parts=bridge.extractDocxReviewTransportPackagePartsFromZipBytes({bytes}).parts;
 const create=changes=>buildStoredZip(Object.entries({...parts,...changes}).map(([name,data])=>({name,data})));
 // Keep unsupported style definition intact but remove only its document usage.
 const document=parts['word/document.xml'];
 const active=document.replace(/(<w:p(?:\s[^>]*)?>)/,'$1<w:pPr><w:pStyle w:val="ac"/></w:pPr>');
 const blocked=bridge.buildDocxContentPreviewFromZipBytes(create({'word/document.xml':active}));
 assert.equal(blocked.ok,false);assert.equal(blocked.reason,'DOCX_PARAGRAPH_SPACING_UNSUPPORTED');
 const inactive=bridge.buildDocxContentPreviewFromZipBytes(create({'word/document.xml':document}));
 assert.equal(inactive.ok,true,JSON.stringify(inactive));
 assert.equal(inactive.contentPreview.genericComments[0].kind,'multi-paragraph-range');
 const inherited=parts['word/styles.xml'].replace(/(<w:style\b[^>]*w:styleId="a"[^>]*>)/,'$1<w:basedOn w:val="ac"/>');
 assert.equal(bridge.buildDocxContentPreviewFromZipBytes(create({'word/document.xml':document,'word/styles.xml':inherited})).ok,false);
 const malformed=parts['word/styles.xml'].replace('w:beforeAutospacing="1"','w:beforeAutospacing="garbage"');
 assert.equal(bridge.buildDocxContentPreviewFromZipBytes(create({'word/document.xml':document,'word/styles.xml':malformed})).ok,false);
});

test('native Normal-style Cyrillic interval preserves paragraph separators, hardBreak and inherited Emphasis',async()=>{
 const f=await setup('rich-ru');
 assert.equal(f.state.threads[0].anchor.selectedText,'Начало диапазона.\nСредний абзац с курсивом и строкой\nпосле мягкого переноса.\nКонец диапазона.');
 assert.equal(f.state.threads[0].anchor.startUtf16,10);assert.equal(f.state.threads[0].anchor.endSceneParagraphIndex,2);assert.equal(f.state.threads[0].anchor.endUtf16,16);
 const middle=f.doc.content[1];assert.equal(middle.content.filter(n=>n.type==='hardBreak').length,1);
 assert.ok(middle.content.some(n=>n.type==='text'&&n.marks?.some(m=>m.type==='italic')));
 const bytes=review(source(f.input)),again=f.bridge.buildDocxContentPreviewFromZipBytes(bytes);
 assert.equal(again.ok,true,JSON.stringify(again));assert.deepEqual(again.contentPreview.paragraphs.map(p=>p.text),f.rows.map(p=>p.text));
 assert.equal(again.contentPreview.genericComments[0].selectedText,f.state.threads[0].anchor.selectedText);
});

test('range adapters reject contradictory legacy end and forbidden affinities',async()=>{
 const f=await setup('root');
 for(const kind of ['multi-paragraph-range',undefined]) {
  const args=structuredClone(f.args);args.candidates[0].affinity='right';
  if(kind===undefined)Object.assign(args.candidates[0],{kind:undefined,selectedText:'one.',endParagraphIndex:undefined,endUtf16:undefined,endBlockTextSha256:undefined,coveredParagraphsSha256:undefined});
  assert.throws(()=>f.generic.materializeGenericComments(args),/ANCHOR/);
 }
 const bytes=review(source(f.input)),analysis=f.bridge.buildDocxReviewTransportAnalysisFromZipBytes({bytes},ports);
 const thread=analysis.reviewIr.commentThreads[0];thread.anchorRange=thread.finalTextAnchorRange={startUtf16:6,endUtf16:8,selectedText:'one.',blockTextSha256:sha('Alpha one.')};thread.quotedAnchorText='one.';
 assert.throws(()=>f.generic.genericCommentCandidates(analysis,f.rows,{metadataValidated:true}),/ANCHOR/);
});

test('multi-range exact rebase preserves outside edits and rejects edits inside covered text',async()=>{
 const f=await setup('reply'),runtime=await import('../../src/io/revisionBridge/reviewTransportNonTextReturnRuntime.mjs');
 const beforeContent='Alpha one.\nBeta two.\nGamma protected.',beforeText=JSON.stringify(f.state);
 const result=runtime.computeExactTextCommentRebase({projectId:'p',sceneId:'roman/native.txt',beforeContent,afterContent:'ZAlpha one.\nBeta two.\nGamma protected.',beforeText});
 const after=JSON.parse(result.afterText);assert.equal(after.threads[0].anchor.startUtf16,7);assert.equal(after.threads[0].anchor.endUtf16,4);assert.equal(after.threads[0].anchor.selectedText,'one.\nBeta');
 assert.throws(()=>runtime.computeExactTextCommentRebase({projectId:'p',sceneId:'roman/native.txt',beforeContent,afterContent:'Alpha oXne.\nBeta two.\nGamma protected.',beforeText}),/RANGE_CHANGED/);
});
test('multi-range signed delta keeps unchanged native-root export and rejects forged endpoint owner',async()=>{
 const f=await setup('reply'),projection=source(f.input),bytes=review(projection),ir=f.bridge.buildDocxReviewTransportAnalysisFromZipBytes({bytes},ports).reviewIr;
 const {planCommentReturnDelta}=require('../../src/core/word-comment-return-delta-v1.cjs');
 const input={beforeText:JSON.stringify(f.state),projectId:'p',roundId:'multi-native',artifactSha256:sha(bytes),baseline:projection.commentExport,exportMap:projection.localAuthorityCapsule.exportMap,returnedThreads:ir.commentThreads,returnedParagraphs:ir.formattingParagraphs};
 assert.equal(planCommentReturnDelta(input).unchanged,true);
 const bad=structuredClone(input);bad.exportMap.scenes.push({sceneId:'foreign',blocks:[bad.exportMap.scenes[0].blocks.splice(1,1)[0]]});
 assert.throws(()=>planCommentReturnDelta(bad),/COMMENT_RETURN/);
});

test('multi exact rebase refuses repeated-text ambiguous edits at final endpoint',async()=>{
 const {deriveCommentAnchor}=require('../../src/core/word-comment-ranges-v1.cjs');
 const {computeExactTextCommentRebase}=await import('../../src/io/revisionBridge/reviewTransportNonTextReturnRuntime.mjs');
 const f=await setup('root');f.state.threads[0].anchor=deriveCommentAnchor({sceneId:'roman/native.txt',paragraphs:['Alpha','aaa'],input:{kind:'multi-paragraph-range',paragraphIndex:0,startUtf16:2,endParagraphIndex:1,endUtf16:2}});
 assert.throws(()=>computeExactTextCommentRebase({projectId:'p',sceneId:'roman/native.txt',beforeContent:'Alpha\naaa',afterContent:'Alpha\naaaa',beforeText:JSON.stringify(f.state)}),/RANGE_CHANGED/);
 f.state.threads[0].anchor=deriveCommentAnchor({sceneId:'roman/native.txt',paragraphs:['Alpha','aaa'],input:{kind:'multi-paragraph-range',paragraphIndex:0,startUtf16:2,endParagraphIndex:1,endUtf16:1}});
 assert.throws(()=>computeExactTextCommentRebase({projectId:'p',sceneId:'roman/native.txt',beforeContent:'Alpha\naaa',afterContent:'Alpha\naa',beforeText:JSON.stringify(f.state)}),/RANGE_CHANGED/);
});


test('actual Word empty-final-paragraph boundary retains both roots and reply; forged boundary ownership refuses',async()=>{
 const bridge=await import('../../src/io/revisionBridge/index.mjs'),bytes=native('empty-end');
 const parse=b=>bridge.buildDocxReviewTransportAnalysisFromZipBytes({bytes:b},ports);
 const result=parse(bytes);assert.equal(result.ok,true);
 const original=result.reviewIr.commentThreads.find(t=>t.commentId==='3'),root=result.reviewIr.commentThreads.find(t=>t.commentId==='1');
 assert.equal(original.status,'ANCHORED');assert.equal(original.anchorRange.startUtf16,10);assert.equal(original.anchorRange.endParagraphIndex,2);assert.equal(original.anchorRange.endUtf16,16);
 assert.equal(root.status,'ANCHORED');assert.equal(root.paragraphIndex,0);assert.equal(root.anchorRange.startUtf16,0);assert.equal(root.anchorRange.endParagraphIndex,4);assert.equal(root.anchorRange.endUtf16,0);assert.equal(root.replies.length,1);
 assert.equal(root.anchorRange.endBlockTextSha256,sha(''));
 const f=await setup('empty-end');assert.equal(f.state.threads.length,2);assert.deepEqual(f.state.threads.map(t=>t.messages.length),[1,2]);
 const projection=source(f.input),again=parse(review(projection));assert.equal(compareCommentExportReadback(projection.commentExport,again.reviewIr.commentThreads).ok,true);
 const parts=bridge.extractDocxReviewTransportPackagePartsFromZipBytes({bytes}).parts,xml=parts['word/document.xml'];
 const marker='<w:commentRangeEnd w:id="1"/>',ref='<w:commentReference w:id="1"/>';
 assert.ok(xml.includes(marker));assert.ok(xml.includes(ref));
 const lastP=xml.indexOf('<w:p ',xml.indexOf(marker)+marker.length);assert.ok(lastP>0);
 const negatives=[
  xml.replace(ref,''),
  xml.replace(ref,ref+ref),
  xml.replace(ref,'<w:smartTag>'+ref+'</w:smartTag>'),
  xml.replace(marker,marker+'<w:p><w:r><w:t>foreign intervening text</w:t></w:r></w:p>'),
  xml.replace(marker,marker+'<w:tbl><w:tr><w:tc><w:p/></w:tc></w:tr></w:tbl>'),
  xml.slice(0,lastP)+xml.slice(lastP).replace(ref,ref+'<w:t>not empty</w:t>'),
  xml.replace(marker,marker+marker),
 ];
 for(const document of negatives){const altered=buildStoredZip(Object.entries({...parts,'word/document.xml':document}).map(([name,data])=>({name,data})));const parsed=parse(altered);assert.notEqual(parsed.reviewIr?.commentThreads?.find(t=>t.commentId==='1')?.status,'ANCHORED');}
});

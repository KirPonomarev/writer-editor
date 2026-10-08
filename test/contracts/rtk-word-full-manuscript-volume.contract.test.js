'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');
const vm=require('node:vm');
const {createRequire}=require('node:module');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'../..');
const main=fs.readFileSync(path.join(ROOT,'src/main.js'),'utf8');
const {
  buildFullManuscriptDocxReviewPacketSource,
  validateFullManuscriptDocumentSectionsReturn,
}=require('../../src/export/docx/fullManuscriptDocxReviewPacketSource');
const {buildDocxReviewPacketBuffer}=require('../../src/export/docx/docxReviewPacketBuilder');
const {sanitizeReviewDocxExportCapsule}=require('../../src/export/docx/docxReviewPacketExportHandler');
const {buildStoredZip}=require('../../src/export/docx/docxMinBuilder');
const hash=b=>'sha256:'+crypto.createHash('sha256').update(b).digest('hex');
const clone=v=>JSON.parse(JSON.stringify(v));
function declaration(name){const match=main.match(new RegExp('function '+name+'\\([^]*?\\n}(?=\\n|$)'));assert.ok(match,name);return match[0];}
function harness(){
  const context=vm.createContext({crypto,Buffer,require:createRequire(path.join(ROOT,'src/main.js')),
    isPlainObjectValue:x=>!!x&&typeof x==='object'&&!Array.isArray(x),
    docxReviewPreviewSessionDetailString:x=>typeof x==='string'?x:'',
    sha256DocxReviewPreviewSessionBytes:b=>hash(b).slice(7),cloneJsonSafe:clone,docxReviewReturnIntakeBlocked:code=>({ok:false,code}),
    validateFullManuscriptDocumentSectionsReturn,
    createDocxImportPreviewReferences:require('../../src/utils/docxImportPreviewReferences').createDocxImportPreviewReferences,
    copyValidatedDocxUserBookmarkInventory:require('../../src/utils/docxImportLocalFilePreview').copyValidatedDocxUserBookmarkInventory,
    rememberDocxImportPreviewPlanAdmission:require('../../src/utils/docxImportSafeCreate').rememberDocxImportPreviewPlanAdmission,
    getProjectRootPath:()=>'/synthetic',loadRevisionBridgeModule:()=>import(pathToFileURL(path.join(ROOT,'src/io/revisionBridge/index.mjs'))),
  });
  vm.runInContext(['PROFILE_DEFAULTS','CEILING','FULL_MANUSCRIPT_PRODUCT_BUDGETS'].map(name=>main.match(new RegExp('const DOCX_REVIEW_RETURN_INTAKE_'+name+' = Object.freeze\\([^]*?\\n}\\);'))[0]).join('\n')+'\n'+['stableRtkReviewTransportJson','createRtkReviewTransportCryptoPort','normalizeRtkSignedSha256','buildFullManuscriptProvisionalSelfParse','docxReviewReturnIntakeProductBudgets','resolveDocxReturnIntakeEffectiveBudgets','docxReviewReturnIntakeEffectiveBudgets','decodeDocxCustomPropertyText','extractDocxCustomPropertyValue','extractDocxReviewReturnYrtk2PropertiesFromCustomXml','extractDocxReviewReturnYrtk2PropertiesFromParserResult','verifyDocxReviewReturnYrtk2Binding','buildFullManuscriptPublicationGate'].map(declaration).join('\n'),context);
  vm.runInContext(['DOCX_IMPORT_PREVIEW_REFERENCES','DOCX_CONTENT_PREVIEW_COMMAND_SURFACE','DOCX_IMPORT_PREVIEW_COMMAND_SURFACE'].map(name=>{
    const start=main.indexOf('// '+name+'_START'),end=main.indexOf('// '+name+'_END',start);assert.ok(start>=0&&end>start,name);return main.slice(start,end);
  }).join('\n'),context);
  return context;
}
test('Existing Main full manuscript budgets retain tighter requests and declared clamps',()=>{
  const c=harness(),tight={budgets:{maxBlocks:1,maxWorkerOutputBytes:1024,maxInflatedPartBytes:1024}};
  assert.deepEqual(clone(c.docxReviewReturnIntakeProductBudgets(tight)),tight.budgets);
  const result=c.docxReviewReturnIntakeEffectiveBudgets(tight);
  for(const [key,value] of Object.entries(tight.budgets))assert.equal(result.effective[key],value,key);
  assert.deepEqual(clone(c.docxReviewReturnIntakeProductBudgets()),{maxBlocks:50000,maxWorkerOutputBytes:64*1024*1024});
  const large=c.docxReviewReturnIntakeEffectiveBudgets({budgets:{maxBlocks:50001,maxWorkerOutputBytes:64*1024*1024+1}});
  assert.equal(large.effective.maxBlocks,50000);assert.equal(large.effective.maxWorkerOutputBytes,64*1024*1024);
  assert.deepEqual(Array.from(large.clampedFields,entry=>entry.field).sort(),['maxBlocks','maxWorkerOutputBytes']);
});
test('Finite pending preview and scoped return honor caller budgets without creating authority',async()=>{
  const review=require('../../src/core/word-pending-text-revisions-v1.cjs'),envelope=require('../../src/core/document-content-envelope-v1.cjs');
  const doc=review.bindLedger({schemaVersion:1,source:{type:'doc',content:['AB','second','third'].map(text=>({type:'paragraph',content:[{type:'text',text}]}))},revisions:[{id:'revision-1',nativeId:'1',operation:'insert',author:'Writer',date:'',dateUtc:'',groupId:null,paragraphIndex:0,from:1,to:2,state:'pending'}],undo:[],redo:[]});
  const f=await fixture([['']],{observableContents:[envelope.composeObservablePayload({doc})]}),bytes=buildDocxReviewPacketBuffer(f.source),cap=f.source.localAuthorityCapsule,before=JSON.stringify(f.source);
  const input={bytes,exportMap:cap.exportMap,baselineDocuments:[{sceneId:cap.exportMap.scenes[0].sceneId,document:doc}],documentSections:cap.documentSections,signedSectionsDigest:cap.documentSections.protectedDigest,retainPendingScenes:true,cryptoPort:f.context.createRtkReviewTransportCryptoPort()};
  const normal=f.bridge.buildDocxContentPreviewFromZipBytes(bytes);assert.equal(normal.ok,true,JSON.stringify(normal));
  const full=f.bridge.buildDocxContentPreviewFromZipBytes({bytes,budgets:f.context.docxReviewReturnIntakeProductBudgets()});assert.equal(full.ok,true,JSON.stringify(full));
  assert.deepEqual(full.contentPreview.pendingRevisionDocument,normal.contentPreview.pendingRevisionDocument);
  assert.equal(full.carrierIgnored?.tokenDetected,true);assert.equal(full.carrierIgnored?.ignored,true);
  assert.equal(full.canWriteStorage,undefined);assert.equal(full.canImportMutate,undefined);
  for(const [budgets,code] of [[{maxBlocks:2},'PENDING_REVISIONS_XML_INVALID'],[{maxWorkerOutputBytes:1024},'PENDING_COMMENT_SECTION_CHANGED']]) {
    const analysis=f.bridge.buildDocxReviewTransportAnalysisFromZipBytes({bytes,budgets},{cryptoPort:f.context.createRtkReviewTransportCryptoPort()});
    assert.equal(analysis.ok,false);assert.equal(analysis.code,'RTK_BUDGET_EXCEEDED');
    assert.ok(analysis.reasons.some(reason=>reason.code==='RTK_BUDGET_EXCEEDED'));
    const denied=f.bridge.buildDocxPendingCommentReturnDocumentsFromZipBytes({...input,budgets});
    assert.equal(denied.ok,false,JSON.stringify({budgets,denied}));assert.equal(denied.code,code);
  }
  const parsed=f.bridge.buildDocxPendingCommentReturnDocumentsFromZipBytes({...input,budgets:f.context.docxReviewReturnIntakeProductBudgets()});assert.equal(parsed.ok,true,JSON.stringify(parsed));
  const adapter=require('../../src/core/word-pending-comment-return-v1.cjs'),map=cap.exportMap;
  const derived=adapter.deriveMixedPendingDocument({document:doc,returnedDocument:parsed.scenes[0].returnedDocument,binding:map.scenes[0].pendingCommentBinding,anchors:[],exportTypography:map.exportTypography,exportParagraphs:map.scenes[0].blocks.map(block=>block.formatIr.paragraph),allowUntrackedRichFormatting:true});
  assert.equal(derived.changed,false);assert.deepEqual(review.readLedger(derived.document).source,review.readLedger(doc).source);assert.deepEqual(review.readLedger(derived.document).revisions,review.readLedger(doc).revisions);assert.equal(JSON.stringify(f.source),before);
});
test('Finite preview preserves tighter package part and total byte requests before interpretation',async()=>{
  const {source,bridge}=await fixture([['one','two','three']]),bytes=buildDocxReviewPacketBuffer(source),before=JSON.stringify(source);
  for(const [key,value,field] of [['maxInflatedPartBytes',1024,/^zip\..+\.partBytes$/u],['maxTotalInflatedBytes',1024,'zip.totalInflatedBytes'],['maxDocxBytes',1024,'zip.rawDocxBytes'],['maxZipEntries',1,'zip.entries']]) {
    const result=bridge.buildDocxContentPreviewFromZipBytes({bytes,budgets:{[key]:value}});
    assert.equal(result.ok,false,key+':'+JSON.stringify(result));assert.equal(result.contentPreview,null,key);assert.equal(result.parse.attempted,false,key);
    assert.equal(result.parse.completed,false);assert.equal(result.reason,'RTK_BUDGET_EXCEEDED');
    assert.equal(result.diagnostics[0].sourceCode,'RTK_BUDGET_EXCEEDED');assert.equal(result.diagnostics[0].limit,value);
    assert.ok(result.diagnostics[0].actual>value);if(typeof field==='string')assert.equal(result.diagnostics[0].field,field);else assert.match(result.diagnostics[0].field,field);
  }
  const clamped=bridge.buildDocxReviewTransportAnalysisFromZipBytes({bytes,budgets:{maxInflatedPartBytes:17*1024*1024,maxBlocks:50001,maxWorkerOutputBytes:65*1024*1024}},{cryptoPort:harness().createRtkReviewTransportCryptoPort()});
  assert.equal(clamped.ok,true);assert.equal(clamped.effectiveBudgets.maxInflatedPartBytes,16*1024*1024);assert.equal(clamped.effectiveBudgets.maxBlocks,50000);assert.equal(clamped.effectiveBudgets.maxWorkerOutputBytes,64*1024*1024);
  assert.equal(bridge.buildDocxContentPreviewFromZipBytes({bytes,budgets:{maxInflatedPartBytes:17*1024*1024}}).ok,true);
  for(const input of [{bytes:'/foreign/path',budgets:{maxBlocks:50000}},{path:'/foreign/path',budgets:{maxBlocks:50000}},{bytes:[],budgets:{maxBlocks:50000}}]) {
    const denied=bridge.buildDocxContentPreviewFromZipBytes(input);assert.equal(denied.ok,false);assert.equal(denied.parse.attempted,false);assert.equal(denied.reason,'STAGE02_PACKAGE_MALFORMED');
  }
  assert.equal(JSON.stringify(source),before);
});
async function fixture(paragraphs,{rich=false,observableContents}={}){
  const bridge=await import(pathToFileURL(path.join(ROOT,'src/io/revisionBridge/index.mjs')));
  const envelope=await import(pathToFileURL(path.join(ROOT,'src/renderer/documentContentEnvelope.mjs')));
  const context=harness();
  const scenes=paragraphs.map((ps,i)=>{
    const doc={type:'doc',content:ps.map(text=>({type:'paragraph',...(text?{content:[{type:'text',text}]}:{})}))};
    const raw=observableContents?.[i]??(rich?envelope.composeObservablePayload({doc}):ps.join('\n'));
    const parsed=envelope.parseObservablePayload(raw);
    return {sceneId:'roman/scene-'+i+'.txt',scenePath:'/synthetic/roman/scene-'+i+'.txt',text:rich||parsed.doc||parsed.hasMetaBlock||parsed.hasCardsBlock?parsed.text:raw,doc:parsed.doc,observableContent:raw,order:i};
  });
  const source=buildFullManuscriptDocxReviewPacketSource({projectId:'volume-project',projectRoot:'/synthetic',manifestPath:'/synthetic/manifest.json',scenes,expectedOrderedSceneIds:scenes.map(s=>s.sceneId)},{revisionBridge:bridge,cryptoPort:context.createRtkReviewTransportCryptoPort(),createdAtUtc:'2026-09-17T00:00:00Z',roundIdHex:'a'.repeat(32),keyIdHex:'b'.repeat(32),hmacSecret:'test-local-key-never-published'});
  const gate=s=>context.buildFullManuscriptProvisionalSelfParse({source:s,revisionBridge:bridge,cryptoPort:context.createRtkReviewTransportCryptoPort(),coreManifest:s.advisoryManifest.coreManifest});
  return {source,gate,bridge,context};
}
async function sectionFixture({trailingEmpty=false,docGrid,carrierNode}={}){
  const bridge=await import(pathToFileURL(path.join(ROOT,'src/io/revisionBridge/index.mjs')));
  const context=harness();
  const scenes=[
    {sceneId:'roman/part-01/chapter-01/a.txt',scenePath:'/synthetic/roman/part-01/chapter-01/a.txt',text:'a-1\na-2',order:0},
    {sceneId:'roman/part-01/chapter-01/b.txt',scenePath:'/synthetic/roman/part-01/chapter-01/b.txt',text:trailingEmpty?'b-1\n':'b-1',order:1},
    {sceneId:'roman/part-01/chapter-02/c.txt',scenePath:'/synthetic/roman/part-01/chapter-02/c.txt',text:'c-1\nc-2',order:2},
  ];
  if(docGrid!==undefined) for(const scene of scenes) scene.doc={type:'doc',attrs:{wordSections:{schemaVersion:1,boundaries:[],final:{type:'nextPage',docGrid:clone(docGrid)}}},content:scene.text.split('\n').map(text=>({type:'paragraph',...(text?{content:[{type:'text',text}]}:{})}))};
  if(carrierNode) {
    const envelope=require('../../src/core/document-content-envelope-v1.cjs'),scene=scenes[1];
    scene.doc={type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'b-1'}]},clone(carrierNode)]};
    scene.observableContent=envelope.composeObservablePayload({doc:scene.doc});scene.text=envelope.parseObservablePayload(scene.observableContent).text;
  }
  const source=buildFullManuscriptDocxReviewPacketSource({projectId:'section-project',projectRoot:'/synthetic',manifestPath:'/synthetic/manifest.json',scenes,expectedOrderedSceneIds:scenes.map(s=>s.sceneId)},{revisionBridge:bridge,cryptoPort:context.createRtkReviewTransportCryptoPort(),createdAtUtc:'2026-09-18T00:00:00Z',roundIdHex:'c'.repeat(32),keyIdHex:'d'.repeat(32),hmacSecret:'section-local-key-never-published'});
  const parse=bytes=>bridge.buildDocxReviewTransportAnalysisFromZipBytes({bytes,hmacSecret:source.forbiddenSecret,expectedAuthority:source.localAuthorityCapsule.expectedAuthority},{cryptoPort:context.createRtkReviewTransportCryptoPort()});
  const validate=(parsed,options={})=>validateFullManuscriptDocumentSectionsReturn({expected:source.documentSections,returned:parsed.reviewIr?.documentSections,signedDigest:parsed.authorityCarrier?.selectedCarrier?.payload?.documentSectionsDigest,...options});
  const repack=mutate=>{
    const extracted=bridge.extractDocxReviewTransportPackagePartsFromZipBytes({bytes:buildDocxReviewPacketBuffer(source)},{cryptoPort:context.createRtkReviewTransportCryptoPort()});
    assert.equal(extracted.ok,true,JSON.stringify(extracted));
    const parts={...extracted.parts,'word/document.xml':mutate(extracted.parts['word/document.xml'])};
    return buildStoredZip(Object.entries(parts).map(([name,data])=>({name,data})));
  };
  return {source,bridge,context,parse,validate,repack};
}
for(const rich of [false,true])test('Full manuscript provisional gate preserves all authored paragraph boundaries, rich='+rich,async()=>{
  const ps=[['','  Привет Café 🧑‍💻  ','','','end-a',''],['','שלום 中文','end-b'],['Καλημέρα','final  ','']];
  const {source,gate}=await fixture(ps,{rich});
  assert.deepEqual(source.blocks.map(b=>b.text),ps.flat());
  assert.equal(source.sceneText,ps.map(s=>s.join('\n')).join('\n\n'));
  assert.equal(gate(source).ok,true,JSON.stringify(gate(source)));
});
test('Actual Main plain publication preserves normalized raw empty lines in both complete package phases',async()=>{
  const raws=['\nfirst','last\n','a\n\n\nb','\n\n\n','','\r\nA\r\n\r\nB\r\n','\rA\r\rB\r','  🧑‍💻 Café  \n \n'];
  const {source,bridge,context}=await fixture(raws.map(raw=>raw.split('\n')));
  const before=JSON.stringify(source),expected=raws.map(raw=>raw.replace(/\r\n?/gu,'\n'));
  assert.deepEqual(source.blocks.map(block=>block.text),expected.flatMap(raw=>raw.split('\n')));
  for(const [i,scene] of source.localAuthorityCapsule.exportMap.scenes.entries()) {
    assert.equal(scene.rawSha256,hash(raws[i]));
    assert.equal(source.localAuthorityCapsule.baselineObservableContentBySceneId?.[scene.sceneId]??source.localAuthorityCapsule.baselineFinalTextBySceneId[scene.sceneId],raws[i]);
  }
  const bytes=buildDocxReviewPacketBuffer(source),publication=await context.buildFullManuscriptPublicationGate(source,bytes,bridge);
  assert.equal(publication.ok,true,JSON.stringify(publication));assert.equal(publication.publishAllowed,true);
  assert.equal(publication.provisionalSelfParse.verified,true);assert.equal(publication.finalSelfParse.semanticEquivalent,true);assert.equal(publication.yrtk2Verification.ok,true);
  for(const actual of [source.provisionalSelfParseArtifact.bytes,bytes]) {
    const read=bridge.buildDocxReviewTransportAnalysisFromZipBytes({bytes:actual},{cryptoPort:context.createRtkReviewTransportCryptoPort()});
    assert.equal(read.ok,true,JSON.stringify(read));assert.equal(read.reviewIr.formattingParagraphs.length,expected.flatMap(raw=>raw.split('\n')).length);
    const parts=bridge.extractDocxReviewTransportPackagePartsFromZipBytes({bytes:actual},{cryptoPort:context.createRtkReviewTransportCryptoPort()});
    const visible=bridge.visibleSceneTextsFromWordDocumentXml(parts.parts['word/document.xml'],source.localAuthorityCapsule.exportMap,{cryptoPort:context.createRtkReviewTransportCryptoPort(),stylesXml:parts.parts['word/styles.xml'],relationshipsXml:parts.parts['word/_rels/document.xml.rels']});
    assert.equal(visible.ok,true,JSON.stringify(visible));assert.deepEqual(visible.sceneTexts,expected);
  }
  assert.equal(JSON.stringify(source),before);
});
test('Actual Main publication retains rich and private envelope interpretation and strict plain source bindings',async()=>{
  const envelope=require('../../src/core/document-content-envelope-v1.cjs');
  const privateRaw=envelope.composeObservablePayload({text:'\nprivate-visible\n\n\nend\n',metaEnabled:true,meta:{synopsis:'private-title',tags:{pov:'protected'}},cards:[{id:'card-a',title:'private-card',text:'private-body'}]});
  const richDoc={type:'doc',content:[{type:'paragraph'},{type:'paragraph',content:[{type:'text',text:'Rich',marks:[{type:'bold'}]}]},{type:'paragraph'}]};
  const richRaw=envelope.composeObservablePayload({doc:richDoc,metaEnabled:true,meta:{synopsis:'rich-private'}});
  const richV3Doc=clone(richDoc);richV3Doc.content[1].attrs={wordParagraphSpacing:{after:30}};
  const richV3Raw=envelope.composeObservablePayload({doc:richV3Doc});
  assert.equal(envelope.parseObservablePayload(richRaw).payloadVersion,2);assert.equal(envelope.parseObservablePayload(richV3Raw).payloadVersion,3);
  const {source,bridge,context}=await fixture([[''],[''],['']],{observableContents:[privateRaw,richRaw,richV3Raw]});
  const before=JSON.stringify(source),bytes=buildDocxReviewPacketBuffer(source);
  assert.equal(envelope.parseObservablePayload(privateRaw).hasMetaBlock,true);assert.equal(envelope.parseObservablePayload(privateRaw).hasCardsBlock,true);
  assert.deepEqual(source.blocks.map(block=>block.text),['private-visible','','end','','Rich','','','Rich','']);
  const publication=await context.buildFullManuscriptPublicationGate(source,bytes,bridge);
  assert.equal(publication.ok,true,JSON.stringify(publication));assert.equal(publication.provisionalSelfParse.verified,true);assert.equal(publication.finalSelfParse.semanticEquivalent,true);
  assert.ok(!source.sceneText.includes('private-title'));assert.ok(!source.sceneText.includes('private-card'));assert.equal(JSON.stringify(source),before);
  const plain=await fixture([['','a','','','b','']]),plainBytes=buildDocxReviewPacketBuffer(plain.source),plainBefore=JSON.stringify(plain.source);
  for(const [name,mutate,reason] of [
    ['raw hash',s=>{s.localAuthorityCapsule.exportMap.scenes[0].rawSha256=hash('foreign');},'WORD_BODY_BASELINE'],
    ['missing baseline',s=>{s.localAuthorityCapsule.baselineFinalTextBySceneId={};s.localAuthorityCapsule.baselineObservableContentBySceneId={};},'WORD_BODY_BASELINE'],
    ['coherent raw differs',s=>{const id=s.localAuthorityCapsule.exportMap.scenes[0].sceneId,raw='\na\n\nb\n';s.localAuthorityCapsule.baselineFinalTextBySceneId[id]=raw;s.localAuthorityCapsule.exportMap.scenes[0].rawSha256=hash(raw);},'WORD_BODY_RAW_FORMAT_BINDING'],
    ['malformed envelope',s=>{const id=s.localAuthorityCapsule.exportMap.scenes[0].sceneId,raw='[doc-v2 length=1]\n{';s.localAuthorityCapsule.baselineFinalTextBySceneId[id]=raw;s.localAuthorityCapsule.exportMap.scenes[0].rawSha256=hash(raw);},'WORD_BODY_BASELINE'],
    ['unknown rich declaration',s=>{const id=s.localAuthorityCapsule.exportMap.scenes[0].sceneId,raw=richV3Raw.replace('"version":3','"version":4');assert.notEqual(raw,richV3Raw);s.localAuthorityCapsule.baselineFinalTextBySceneId[id]=raw;s.localAuthorityCapsule.exportMap.scenes[0].rawSha256=hash(raw);},'WORD_BODY_BASELINE'],
    ['map IR',s=>{s.localAuthorityCapsule.exportMap.scenes[0].blocks[0].formatIr.paragraph.nodeType='heading';},'WORD_BODY_RAW_FORMAT_BINDING'],
    ['source IR',s=>{s.blocks[0].formatIr.paragraph.wordParagraphSpacing={after:1};},'WORD_BODY_RAW_FORMAT_BINDING'],
    ['source marks hash',s=>{s.blocks[0].canonicalMarksSha256=hash('foreign');},'WORD_BODY_RAW_FORMAT_BINDING'],
  ]) {
    const forged=clone(plain.source);forged.provisionalSelfParseArtifact.bytes=plain.source.provisionalSelfParseArtifact.bytes;mutate(forged);const captured=JSON.stringify(forged),denied=await plain.context.buildFullManuscriptPublicationGate(forged,plainBytes,plain.bridge);
    assert.equal(denied.ok,false,name);assert.equal(denied.publishAllowed,false,name);assert.equal(denied.reason,reason,name+':'+JSON.stringify(denied));assert.equal(JSON.stringify(forged),captured);
  }
  const parts=plain.bridge.extractDocxReviewTransportPackagePartsFromZipBytes({bytes:plainBytes},{cryptoPort:plain.context.createRtkReviewTransportCryptoPort()}).parts;
  const xml=parts['word/document.xml'],paragraphs=xml.match(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/gu),empty=paragraphs.find(p=>!p.includes('<w:t'));
  assert.ok(empty,'actual owned empty paragraph');const changedXml=xml.replace(empty,'');assert.notEqual(changedXml,xml);
  const removed=buildStoredZip(Object.entries(parts).map(([name,data])=>({name,data:name==='word/document.xml'?changedXml:data})));
  const denied=await plain.context.buildFullManuscriptPublicationGate(plain.source,removed,plain.bridge);
  assert.equal(denied.ok,false,JSON.stringify(denied));assert.equal(denied.publishAllowed,false);assert.equal(denied.code,'RTK_V4_PUBLICATION_DOCUMENT_SECTIONS_MISMATCH');assert.deepEqual(Array.from(denied.documentSectionsMismatches),['protectedSections']);assert.equal(JSON.stringify(plain.source),plainBefore);
});
test('Full manuscript Word sections bind canonical scene groups to exact OOXML boundaries and protected page semantics',async()=>{
  const {source,parse,validate}=await sectionFixture();
  assert.deepEqual(source.documentSections.sourceBindings.map(section=>section.sceneIds),[
    ['roman/part-01/chapter-01/a.txt','roman/part-01/chapter-01/b.txt'],
    ['roman/part-01/chapter-02/c.txt'],
  ]);
  assert.deepEqual(source.documentSections.protectedSections.map(section=>[section.startParagraphIndex,section.endParagraphIndex,section.breakPlacement]),[
    [0,2,'PARAGRAPH_PROPERTIES'],[3,4,'BODY_FINAL'],
  ]);
  const parsed=parse(buildDocxReviewPacketBuffer(source));
  assert.equal(parsed.ok,true,JSON.stringify(parsed));
  assert.equal(parsed.reviewIr.structureChanges.some(change=>change.structureKind==='sectPr'),false);
  const binding=validate(parsed);
  assert.equal(binding.ok,true,JSON.stringify(binding));
  assert.equal(binding.proof.protectedSections[0].properties.pageSize.orientation,'portrait');
  assert.equal(binding.proof.protectedSections[0].properties.margins.leftTwips,1440);
});
test('Office transport retains an authored empty section carrier and only normalizes omitted Word defaults',async()=>{
  const {source,bridge,context}=await sectionFixture({trailingEmpty:true});
  source.officeModeTransport=true;
  source.localAuthorityCapsule.officeModeTransport=true;
  const bytes=buildDocxReviewPacketBuffer(source);
  const publication=await context.buildFullManuscriptPublicationGate(source,bytes,bridge);
  assert.equal(publication.ok,true,JSON.stringify(publication));
  const extracted=bridge.extractDocxReviewTransportPackagePartsFromZipBytes({bytes},{cryptoPort:context.createRtkReviewTransportCryptoPort()});
  assert.equal(extracted.ok,true,JSON.stringify(extracted));
  const xml=extracted.parts['word/document.xml'].toString('utf8');
  assert.ok(xml.includes('<w:t xml:space="preserve">\u2060</w:t>'));
  const read=bridge.buildDocxReviewTransportAnalysisFromZipBytes({bytes},{cryptoPort:context.createRtkReviewTransportCryptoPort()});
  assert.equal(read.ok,true,JSON.stringify(read));const carrier=read.reviewIr.formattingParagraphs[3];
  assert.equal(carrier.paragraphText,'\u2060');assert.equal(carrier.formattedRuns.length,1);
  assert.deepEqual(carrier.formattedRuns[0].inlineState,{fontFamily:'Times New Roman',fontSize:'12pt',wordLanguage:{val:'en-US',eastAsia:'en-US',bidi:'en-US'}});
  assert.deepEqual(source.blocks[3].formatIr.runs,[]);assert.equal(source.blocks[3].text,'');
  assert.equal(buildDocxReviewPacketBuffer({...source,officeModeTransport:false}).includes(Buffer.from('\u2060')),false);
  const returned=buildStoredZip(Object.entries(extracted.parts).map(([name,data])=>({name,data:name==='word/document.xml'
    ?data.toString('utf8').replaceAll(' w:gutter="0"','').replaceAll('<w:cols w:num="1" w:space="720"/>','')
    :data})));
  const parsed=bridge.buildDocxReviewTransportAnalysisFromZipBytes({bytes:returned,hmacSecret:source.forbiddenSecret,
    expectedAuthority:source.localAuthorityCapsule.expectedAuthority},{cryptoPort:context.createRtkReviewTransportCryptoPort()});
  assert.equal(parsed.ok,true,JSON.stringify(parsed));
  const signedDigest=parsed.authorityCarrier?.selectedCarrier?.payload?.documentSectionsDigest;
  const binding=validateFullManuscriptDocumentSectionsReturn({expected:source.documentSections,
    returned:parsed.reviewIr.documentSections,signedDigest,allowOfficeDefaultOmissions:true});
  assert.equal(binding.ok,true,JSON.stringify(binding));
  assert.equal(binding.proof.lossLedger.providerNormalizedFields.length,4);
  const strict=validateFullManuscriptDocumentSectionsReturn({expected:source.documentSections,
    returned:parsed.reviewIr.documentSections,signedDigest});
  assert.equal(strict.ok,false);
  const mutated=clone(parsed.reviewIr.documentSections);
  mutated.protectedSections[0].properties.pageSize.widthTwips+=1;
  const changed=validateFullManuscriptDocumentSectionsReturn({expected:source.documentSections,
    returned:mutated,signedDigest,allowOfficeDefaultOmissions:true});
  assert.equal(changed.ok,false);
});
test('Office section carrier preserves authored paragraph language code and quote roles with complete raw authority',async()=>{
  const language={val:'ru-RU',eastAsia:'ja-JP',bidi:'ar-SA'};
  for(const [name,node,font,size,mark] of [
    ['authored',{type:'paragraph',attrs:{wordParagraphMarkLanguage:language,wordParagraphMarkTypography:{fontFamily:'Georgia',fontSize:'14pt',bold:true},wordParagraphSpacing:{before:20,after:40}}},'Times New Roman','12pt',{fontFamily:'Georgia',fontSize:'14pt',bold:true}],
    ['code',{type:'codeBlock',attrs:{language:'javascript'}},'Menlo','10pt',{fontFamily:'Menlo',fontSize:'10pt'}],
    ['quote',{type:'blockquote',content:[{type:'paragraph',attrs:{wordParagraphMarkLanguage:language}}]},'Times New Roman','12pt',{fontFamily:'Times New Roman',fontSize:'12pt'}],
  ]) {
    const {source,bridge,context}=await sectionFixture({carrierNode:node});source.officeModeTransport=true;source.localAuthorityCapsule.officeModeTransport=true;
    const before=JSON.stringify(source),bytes=buildDocxReviewPacketBuffer(source),gate=await context.buildFullManuscriptPublicationGate(source,bytes,bridge);
    assert.equal(gate.ok,true,name+':'+JSON.stringify(gate));assert.equal(gate.provisionalSelfParse.verified,true);assert.equal(gate.finalSelfParse.semanticEquivalent,true);assert.equal(gate.yrtk2Verification.ok,true);
    for(const [phase,actual] of [['provisional',source.provisionalSelfParseArtifact.bytes],['final',bytes]]) {
      const parsed=bridge.buildDocxReviewTransportAnalysisFromZipBytes({bytes:actual},{cryptoPort:context.createRtkReviewTransportCryptoPort()});assert.equal(parsed.ok,true,name+':'+phase);
      const row=parsed.reviewIr.formattingParagraphs[3];assert.equal(row.paragraphText,phase==='final'?'\u2060':'');assert.deepEqual(row.effectiveParagraphMarkTypography,mark);
      assert.deepEqual(row.wordParagraphMarkLanguage,name==='code'?{val:'en-US',eastAsia:'en-US',bidi:'en-US'}:language);
      if(phase==='final')assert.deepEqual(row.formattedRuns[0].inlineState,{fontFamily:font,fontSize:size,wordLanguage:name==='code'?{val:'en-US',eastAsia:'en-US',bidi:'en-US'}:language});
      if(name==='code'){assert.deepEqual(row.effectiveCodeStyle,{styleId:'YalkenCodeBlock',shading:{val:'clear',color:'auto',fill:'f3f4f6'}});assert.deepEqual(row.paragraphState.wordParagraphSpacing,{before:80,after:80,line:240,lineRule:'auto'});}
      if(name==='quote')assert.deepEqual(row.paragraphState.wordParagraphIndent,{left:720});
      if(name==='authored')assert.deepEqual(row.paragraphState.wordParagraphSpacing,{before:20,after:40,line:240,lineRule:'auto'});
    }
    assert.equal(source.blocks[3].text,'');assert.deepEqual(source.blocks[3].formatIr.runs,[]);assert.equal(JSON.stringify(source),before);
  }
  const {source,bridge,context}=await fixture([['\u2060',''],['ordinary','']]);source.officeModeTransport=true;source.localAuthorityCapsule.officeModeTransport=true;
  const before=JSON.stringify(source),bytes=buildDocxReviewPacketBuffer(source),gate=await context.buildFullManuscriptPublicationGate(source,bytes,bridge);
  assert.equal(gate.ok,true,JSON.stringify(gate));assert.equal(source.blocks[0].text,'\u2060');assert.equal(source.blocks[0].canonicalTextSha256,hash('\u2060'));
  const rows=bridge.buildDocxReviewTransportAnalysisFromZipBytes({bytes},{cryptoPort:context.createRtkReviewTransportCryptoPort()}).reviewIr.formattingParagraphs;
  assert.deepEqual(rows.map(row=>row.paragraphText),['\u2060','','ordinary','']);assert.equal(JSON.stringify(source),before);
  const parts=bridge.extractDocxReviewTransportPackagePartsFromZipBytes({bytes},{cryptoPort:context.createRtkReviewTransportCryptoPort()}).parts,xml=parts['word/document.xml'];
  const paragraphs=xml.match(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/gu),run=paragraphs[0].match(/<w:r>[\s\S]*?<\/w:r>/u)[0];
  for(const index of [1,3]) {
    const changed=xml.replace(paragraphs[index],paragraphs[index].replace('</w:p>',run+'</w:p>'));assert.notEqual(changed,xml);
    const actual=buildStoredZip(Object.entries(parts).map(([name,data])=>({name,data:name==='word/document.xml'?changed:data})));
    assert.equal(bridge.buildDocxReviewTransportAnalysisFromZipBytes({bytes:actual},{cryptoPort:context.createRtkReviewTransportCryptoPort()}).ok,true);
    const denied=await context.buildFullManuscriptPublicationGate(source,actual,bridge);assert.equal(denied.ok,false);assert.equal(denied.reason,'WORD_BODY_READBACK_FINAL');assert.equal(JSON.stringify(source),before);
  }
});
test('Office section carrier actual package phase style occurrence and signed section corruptions refuse publication',async()=>{
  const {source,bridge,context}=await sectionFixture({trailingEmpty:true});source.officeModeTransport=true;source.localAuthorityCapsule.officeModeTransport=true;
  const before=JSON.stringify(source),bytes=buildDocxReviewPacketBuffer(source),parts=bridge.extractDocxReviewTransportPackagePartsFromZipBytes({bytes},{cryptoPort:context.createRtkReviewTransportCryptoPort()}).parts;
  const xml=parts['word/document.xml'],paragraphs=xml.match(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/gu),owned=paragraphs[3],run=owned.match(/<w:r>[\s\S]*?<\/w:r>/u)[0];assert.ok(run.includes('\u2060'));
  for(const [name,change] of [
    ['missing',()=>xml.replace(run,'')],['doubled',()=>xml.replace(run,run+run)],['extra text',()=>xml.replace(run,run.replace('\u2060','\u2060X'))],
    ['wrong ordinary placement',()=>xml.replace(paragraphs[0],paragraphs[0].replace('</w:p>',run+'</w:p>')).replace(owned,owned.replace(run,''))],
    ['font',()=>xml.replace(run,run.replaceAll('Times New Roman','Georgia'))],['size',()=>xml.replace(run,run.replaceAll('w:val="24"','w:val="28"'))],
    ...['ascii','hAnsi','eastAsia','cs'].map(slot=>['font slot '+slot,()=>xml.replace(run,run.replace(`w:${slot}="Times New Roman"`,`w:${slot}="Georgia"`))]),
    ['language val',()=>xml.replace(run,run.replace('w:val="en-US"','w:val="fr-FR"'))],['language eastAsia',()=>xml.replace(run,run.replace('w:eastAsia="en-US"','w:eastAsia="ja-JP"'))],['language bidi',()=>xml.replace(run,run.replace('w:bidi="en-US"','w:bidi="ar-SA"'))],
    ['paragraph mark',()=>xml.replace(owned,owned.replace('<w:sz w:val="24"/>','<w:sz w:val="28"/>'))],
    ['paragraph spacing',()=>xml.replace(owned,owned.replace('w:after="0"','w:after="40"'))],
    ['foreign owner',()=>xml.replace(owned,owned.replace(/w:name="YRTK_[^"]+"/u,'w:name="YRTK_'+ 'f'.repeat(32)+'"'))],
    ['missing owner',()=>xml.replace(owned,owned.replace(/<w:bookmarkStart\b[^>]+\/>/u,''))],
    ['duplicate owner',()=>xml.replace(owned,owned.replace(/(<w:bookmarkStart\b[^>]+\/>)/u,'$1$1'))],
    ['swapped owner',()=>{const a=paragraphs[0].match(/w:name="YRTK_[^"]+"/u)[0],b=owned.match(/w:name="YRTK_[^"]+"/u)[0];return xml.replace(paragraphs[0],paragraphs[0].replace(a,b)).replace(owned,owned.replace(b,a));}],
  ]) {
    const changed=change();assert.notEqual(changed,xml,name);const actual=buildStoredZip(Object.entries(parts).map(([part,data])=>({name:part,data:part==='word/document.xml'?changed:data})));
    const read=bridge.buildDocxReviewTransportAnalysisFromZipBytes({bytes:actual},{cryptoPort:context.createRtkReviewTransportCryptoPort()});assert.equal(read.ok,true,name+':'+JSON.stringify(read));
    const denied=await context.buildFullManuscriptPublicationGate(source,actual,bridge);assert.equal(denied.ok,false,name);assert.equal(denied.publishAllowed,false,name);assert.equal(denied.reason,name.includes('owner')?'WORD_BODY_OFFICE_CARRIER_OWNER':'WORD_BODY_READBACK_FINAL',name+':'+JSON.stringify(denied));assert.equal(JSON.stringify(source),before,name);
  }
  for(const [name,change,reason] of [
    ['source-only mode',s=>{s.localAuthorityCapsule.officeModeTransport=false;},'WORD_BODY_OFFICE_MODE_MISMATCH'],
    ['local-only mode',s=>{s.officeModeTransport=false;},'WORD_BODY_OFFICE_MODE_MISMATCH'],
    ['both disabled with carrier',s=>{s.officeModeTransport=false;s.localAuthorityCapsule.officeModeTransport=false;},'WORD_BODY_READBACK_FINAL'],
    ['section digest',s=>{s.localAuthorityCapsule.documentSections.protectedDigest=hash('foreign');},null],
  ]) {
    const forged=clone(source);forged.provisionalSelfParseArtifact.bytes=source.provisionalSelfParseArtifact.bytes;change(forged);const captured=JSON.stringify(forged);
    const denied=await context.buildFullManuscriptPublicationGate(forged,bytes,bridge);assert.equal(denied.ok,false,name);assert.equal(denied.publishAllowed,false,name);if(reason)assert.equal(denied.reason,reason,name);else assert.equal(denied.code,'RTK_V4_PUBLICATION_DOCUMENT_SECTIONS_MISMATCH');assert.equal(JSON.stringify(forged),captured);
  }
  const disabled=clone(source);disabled.provisionalSelfParseArtifact.bytes=source.provisionalSelfParseArtifact.bytes;disabled.officeModeTransport=false;disabled.localAuthorityCapsule.officeModeTransport=false;
  const disabledBefore=JSON.stringify(disabled),disabledGate=await context.buildFullManuscriptPublicationGate(disabled,buildDocxReviewPacketBuffer(disabled),bridge);
  assert.equal(disabledGate.ok,true,JSON.stringify(disabledGate));assert.equal(JSON.stringify(disabled),disabledBefore);
  const provisionalParts=bridge.extractDocxReviewTransportPackagePartsFromZipBytes({bytes:source.provisionalSelfParseArtifact.bytes},{cryptoPort:context.createRtkReviewTransportCryptoPort()}).parts;
  const pxml=provisionalParts['word/document.xml'],powned=pxml.match(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/gu)[3],changed=pxml.replace(powned,powned.replace('</w:p>',run+'</w:p>'));assert.notEqual(changed,pxml);
  const premature=buildStoredZip(Object.entries(provisionalParts).map(([name,data])=>({name,data:name==='word/document.xml'?changed:data})));
  const forged=clone(source);forged.provisionalSelfParseArtifact.bytes=premature;forged.advisoryManifest.coreManifest.artifactIdentities.provisionalDocxSha256=hash(premature);const captured=JSON.stringify(forged);
  const denied=await context.buildFullManuscriptPublicationGate(forged,bytes,bridge);assert.equal(denied.ok,false);assert.equal(denied.code,'RTK_V4_PUBLICATION_GATE_PROVISIONAL_TEXT_MISMATCH');assert.equal(JSON.stringify(forged),captured);
});
test('Public export capsule preserves only a typed signed section digest',async()=>{
  const {source}=await sectionFixture();
  const capsule=sanitizeReviewDocxExportCapsule(source.exportCapsule);
  assert.equal(capsule.documentSectionsDigest,source.documentSections.protectedDigest);
  assert.equal(sanitizeReviewDocxExportCapsule({...source.exportCapsule,documentSectionsDigest:{value:source.documentSections.protectedDigest}}).documentSectionsDigest,'');
});
test('Full manuscript Word sections reject boundary and protected-layout drift even when the DOCX remains parseable',async()=>{
  const {source,parse,validate}=await sectionFixture();
  for(const kind of ['boundary','page-size','margin']){
    const documentSections=clone(source.documentSections);
    if(kind==='boundary'){
      documentSections.protectedSections[0].endParagraphIndex-=1;
      documentSections.protectedSections[1].startParagraphIndex-=1;
    }
    if(kind==='page-size')documentSections.protectedSections[0].properties.pageSize.widthTwips+=1;
    if(kind==='margin')documentSections.protectedSections[0].properties.margins.leftTwips+=1;
    const parsed=parse(buildDocxReviewPacketBuffer({...source,documentSections}));
    assert.equal(parsed.ok,true,kind+':'+JSON.stringify(parsed));
    const binding=validate(parsed);
    assert.equal(binding.ok,false,kind);
    assert.ok(binding.mismatches.includes('protectedSections'),kind+':'+JSON.stringify(binding));
  }
});
test('Full manuscript Word sections retain inactive grid additions and block missing duplicate or forged carriers',async()=>{
  const {source,context,parse,validate,repack}=await sectionFixture();
  const extended=parse(repack(xml=>xml.replaceAll('</w:sectPr>','<w:docGrid w:linePitch="360"/></w:sectPr>')));
  assert.equal(extended.ok,true,JSON.stringify(extended));
  const binding=validate(extended,{allowOfficeDefaultOmissions:true,allowInactiveGridAdditions:true});
  assert.equal(binding.ok,true,JSON.stringify(binding));
  assert.deepEqual(binding.proof.inactiveGridAdditions,source.documentSections.protectedSections.map((_,ordinal)=>({ordinal,docGrid:{type:'default',linePitch:360}})));
  assert.deepEqual(binding.proof.protectedSections,source.documentSections.protectedSections);
  assert.equal(binding.proof.protectedDigest,source.documentSections.protectedDigest);
  assert.equal(validate(extended).ok,false,'strict mode does not treat a new retained property as unchanged');
  for (const options of [{allowOfficeDefaultOmissions:true}, {allowOfficeDefaultOmissions:true,allowInactiveGridAdditions:false}]) {
    const rejected=validate(extended,options);
    assert.equal(rejected.ok,false,'Office default omissions never authorize retained grid additions: '+JSON.stringify(options));
    assert.ok(rejected.mismatches.includes('protectedSections'));
    assert.equal(rejected.proof,undefined);
  }
  const gridOnly=validate(extended,{allowInactiveGridAdditions:true});
  assert.equal(gridOnly.ok,true,JSON.stringify(gridOnly));
  assert.deepEqual(gridOnly.proof.inactiveGridAdditions,binding.proof.inactiveGridAdditions);
  assert.ok(extended.reviewIr.documentSections.protectedSections.length>0);
  for(const section of extended.reviewIr.documentSections.protectedSections){
    assert.deepEqual(section.properties.docGrid,{type:'default',linePitch:360});
    assert.equal(section.carriers.docGrid,true);
  }
  assert.equal(extended.reviewIr.documentSections.lossLedger.providerExtensionElements.some(item=>item.elementName==='docGrid'),false);
  for(const [name,mutate,rehash] of [
    ['wrong digest',sections=>{sections.protectedDigest='sha256:'+'0'.repeat(64);},false],
    ['missing carrier',sections=>{delete sections.protectedSections[0].carriers.docGrid;},true],
    ['wrong ordinal',sections=>{sections.protectedSections[0].ordinal=99;},true],
    ['active behavior',sections=>{sections.protectedSections[0].properties.docGrid.type='lines';},true],
    ['unsafe integer',sections=>{sections.protectedSections[0].properties.docGrid.linePitch=Number.MAX_SAFE_INTEGER+1;},true],
  ]){
    const changed=clone(extended);mutate(changed.reviewIr.documentSections);
    if(rehash)changed.reviewIr.documentSections.protectedDigest=context.createRtkReviewTransportCryptoPort().sha256Json({schemaVersion:changed.reviewIr.documentSections.schemaVersion,protectedSections:changed.reviewIr.documentSections.protectedSections});
    assert.equal(validate(changed,{allowOfficeDefaultOmissions:true,allowInactiveGridAdditions:true}).ok,false,name);
  }
  assert.equal(validateFullManuscriptDocumentSectionsReturn({expected:source.documentSections,returned:extended.reviewIr.documentSections,signedDigest:'sha256:'+'0'.repeat(64),allowOfficeDefaultOmissions:true,allowInactiveGridAdditions:true}).ok,false);
  const missing=parse(repack(xml=>xml.replace(/<w:sectPr>[\s\S]*?<\/w:sectPr>/u,'')));
  assert.equal(missing.ok,true,JSON.stringify(missing));
  assert.equal(validate(missing).ok,false);
  const duplicate=parse(repack(xml=>xml.replace(/(<w:sectPr>[\s\S]*?<\/w:sectPr>)/u,'$1$1')));
  assert.equal(duplicate.ok,false,JSON.stringify(duplicate));
  assert.equal(duplicate.code,'RTK_WORD_SECTIONS_MALFORMED_BLOCKED');
  const identity=parse(buildDocxReviewPacketBuffer(source));
  const forged=validateFullManuscriptDocumentSectionsReturn({expected:source.documentSections,returned:identity.reviewIr.documentSections,signedDigest:'sha256:'+'0'.repeat(64)});
  assert.equal(forged.ok,false);
  assert.ok(forged.mismatches.includes('signedDigest'));
});
test('Full manuscript signed inactive grid protects latent values presence and removal while accepting omitted default type',async()=>{
  const docGrid={type:'default',linePitch:360,charSpace:-4096};
  const {source,parse,validate,repack}=await sectionFixture({docGrid});
  const identity=parse(buildDocxReviewPacketBuffer(source));
  assert.equal(identity.ok,true,JSON.stringify(identity));assert.equal(validate(identity).ok,true,JSON.stringify(validate(identity)));
  assert.ok(source.documentSections.protectedSections.every(section=>JSON.stringify(section.properties.docGrid)===JSON.stringify(docGrid)));
  const omittedType=parse(repack(xml=>xml.replaceAll('<w:docGrid w:type="default"','<w:docGrid')));
  assert.equal(omittedType.ok,true,JSON.stringify(omittedType));assert.equal(validate(omittedType).ok,true,JSON.stringify(validate(omittedType)));
  for(const [name,mutate] of [
    ['line pitch',xml=>xml.replaceAll('w:linePitch="360"','w:linePitch="361"')],
    ['character pitch',xml=>xml.replaceAll('w:charSpace="-4096"','w:charSpace="-4095"')],
    ['removed field',xml=>xml.replaceAll(' w:charSpace="-4096"','')],
    ['removed grid',xml=>xml.replace(/<w:docGrid\b[^>]*\/>/gu,'')],
  ]){
    const returned=parse(repack(mutate));assert.equal(returned.ok,true,name+':'+JSON.stringify(returned));
    assert.notEqual(returned.reviewIr.documentSections.protectedDigest,identity.reviewIr.documentSections.protectedDigest,name);
    const checked=validate(returned);assert.equal(checked.ok,false,name);assert.ok(checked.mismatches.includes('protectedSections'),name+':'+JSON.stringify(checked));
  }
  for(const type of ['lines','linesAndChars','snapToChars']){
    const active=parse(repack(xml=>xml.replaceAll('<w:docGrid w:type="default"',`<w:docGrid w:type="${type}"`)));
    assert.equal(active.ok,false,type);assert.ok(active.reasons.some(item=>item.code==='RTK_WORD_SECTIONS_MALFORMED_BLOCKED'),type+':'+JSON.stringify(active));
  }
});
for(const mutant of ['drop-empty','duplicate','swap-paragraphs','swap-scenes','change-codepoint'])test('Coherently rehashed provisional '+mutant+' is rejected',async()=>{
  const {source,gate}=await fixture([['alpha','','beta'],['gamma','delta']]);
  let blocks=source.blocks.map(clone);
  if(mutant==='drop-empty')blocks.splice(1,1);
  if(mutant==='duplicate')blocks.splice(1,0,clone(blocks[0]));
  if(mutant==='swap-paragraphs')[blocks[0],blocks[2]]=[blocks[2],blocks[0]];
  if(mutant==='swap-scenes')blocks=[...blocks.slice(3),...blocks.slice(0,3)];
  if(mutant==='change-codepoint'){blocks[0].text='Alpha';blocks[0].formatIr.runs[0].text='Alpha';}
  let bytes;
  try {
    bytes=buildDocxReviewPacketBuffer({...source,blocks});
  } catch (error) {
    assert.match(error.message,/DOCX_REVIEW_PACKET_DOCUMENT_SECTION_BOUNDARY_INVALID/u);
    return;
  }
  const altered={...source,advisoryManifest:clone(source.advisoryManifest),provisionalSelfParseArtifact:{...source.provisionalSelfParseArtifact,bytes}};
  altered.advisoryManifest.coreManifest.artifactIdentities.provisionalDocxSha256=hash(bytes);
  assert.equal(gate(altered).ok,false,'semantic verification must reject '+mutant+' even after digest rebinding');
});
test('Full manuscript source reader preserves plain bytes and excludes parsed legacy metadata',async()=>{
  const envelope=await import(pathToFileURL(path.join(ROOT,'src/renderer/documentContentEnvelope.mjs')));
  const fn=main.match(/async function readFullManuscriptDocxReviewExportDocumentContent\([^]*?\n}/)[0];
  const samples=['\n  leading  \n\n\ntrailing  \n',envelope.composeObservablePayload({text:'body',metaEnabled:true,meta:{title:'private metadata',tags:[]}})];
  for(const raw of samples){
    const context=vm.createContext({isAllowedFilePath:()=>true,getDocumentContextFromPath:()=>({kind:'scene'}),ROMAN_CONTEXT_KINDS:new Set(['scene']),currentFilePath:'',fs:{readFile:async()=>raw},loadDocumentContentEnvelopeModule:async()=>envelope});
    vm.runInContext(fn,context);
    const out=await context.readFullManuscriptDocxReviewExportDocumentContent({path:'/synthetic/roman/source.txt'});
    const parsed=envelope.parseObservablePayload(raw);
    assert.equal(out.text,parsed.hasMetaBlock?parsed.text:raw);
    assert.equal(out.observableContent,raw);
    if(parsed.hasMetaBlock)assert.ok(!out.text.includes('[meta]'));
  }
});
test('Compact advisory keeps every document part and signed carrier while retaining the local baseline',async()=>{
  const {source,bridge,context}=await fixture([['alpha','  beta  '],['שלום','tail']]);
  const localBefore=JSON.stringify(source.localAuthorityCapsule);
  const compact=buildDocxReviewPacketBuffer(source);
  // A non-product advisory uses the unchanged general builder path. Only that
  // advisory part differs; all real document and authority parts must be equal.
  const legacy=buildDocxReviewPacketBuffer({...source,advisoryManifest:{...source.advisoryManifest,schemaVersion:'test-legacy-full-advisory'}});
  const parts=b=>bridge.extractDocxReviewTransportPackagePartsFromZipBytes({bytes:b},{cryptoPort:context.createRtkReviewTransportCryptoPort()}).parts;
  const a=parts(compact),b=parts(legacy);
  assert.deepEqual(Object.keys(a).sort(),Object.keys(b).sort());
  for(const key of Object.keys(a))if(key!=='customXml/item1.xml')assert.equal(a[key],b[key],key);
  assert.equal(JSON.stringify(source.localAuthorityCapsule),localBefore);
  assert.ok(a['customXml/item1.xml'].includes('MAIN_OWNED_AUTHENTICATED_LOCAL_CAPSULE'));
  assert.ok(a['customXml/item1.xml'].includes(source.advisoryManifest.coreManifest.coreManifestDigest));
  assert.ok(!a['customXml/item1.xml'].includes('sceneSnapshots'));
  assert.ok(!a['customXml/item1.xml'].includes('exportMap'));
  const gate=await context.buildFullManuscriptPublicationGate(source,compact,bridge);
  assert.equal(gate.ok,true,JSON.stringify(gate));
  assert.equal(gate.yrtk2Verification.ok,true);
});
test('500k-word publication uses the bounded16MiB full-manuscript file profile',async()=>{
  const {buildWordVolumeFixture}=await import(pathToFileURL(path.join(ROOT,'scripts/ops/rtk-interop-word-volume-fixtures.mjs')));
  const corpus=buildWordVolumeFixture('LARGE_DOCUMENT');
  assert.equal(corpus.scenes.length,21);
  assert.equal(corpus.minimumWords,500000);
  const {source,bridge,context}=await fixture(corpus.scenes.map(s=>s.paragraphs),{rich:true});
  assert.ok(source.blocks.length>5000);
  const protectedSource=hash(JSON.stringify(source));
  const bytes=buildDocxReviewPacketBuffer(source);
  assert.ok(bytes.length<16*1024*1024,'The actual 500k-word DOCX must fit the declared16MiB intake budget');
  const gate=await context.buildFullManuscriptPublicationGate(source,bytes,bridge);
  assert.equal(gate.ok,true,JSON.stringify(gate));
  assert.equal(gate.provisionalSelfParse.verified,true);
  assert.equal(gate.finalSelfParse.semanticEquivalent,true);
  assert.equal(gate.yrtk2Verification.ok,true);
  assert.equal(hash(JSON.stringify(source)),protectedSource);
  const actual=bridge.extractDocxReviewTransportWordDocumentProjection({bytes},{cryptoPort:context.createRtkReviewTransportCryptoPort()});
  assert.equal(actual.ok,true,JSON.stringify(actual));
  const observed=bridge.visibleSceneTextsFromWordDocumentXml(actual.documentXml,source.localAuthorityCapsule.exportMap,{cryptoPort:context.createRtkReviewTransportCryptoPort(),stylesXml:actual.stylesXml,relationshipsXml:actual.relationshipsXml,budgets:context.docxReviewReturnIntakeProductBudgets()});
  assert.equal(observed.ok,true,JSON.stringify(observed));
  assert.deepEqual(observed.sceneTexts,corpus.scenes.map(s=>s.paragraphs.join('\n')));
  assert.equal(observed.sceneTexts.join('\n\n'),source.sceneText);
  const content=await context.handleDocxContentPreviewCommandSurface({requestId:'volume-content',bufferSource:bytes.toString('base64')});
  assert.equal(content.previewOk,true,JSON.stringify(content));assert.match(content.docxContentPreviewRef,/^[a-f0-9]{64}$/u);
  const literal=corpus.scenes.flatMap(scene=>scene.paragraphs);
  assert.deepEqual(clone(content.docxContentPreviewReport.contentPreview.paragraphs.map(p=>p.text)),literal);
  const plan=await context.handleDocxImportPreviewCommandSurface({requestId:'volume-plan',docxContentPreviewRef:content.docxContentPreviewRef});
  assert.equal(plan.importPreviewOk,true,JSON.stringify(plan));assert.match(plan.docxImportPreviewRef,/^[a-f0-9]{64}$/u);
  const entries=plan.docxImportPreviewPlan.candidateCreatePlan.entries;assert.equal(entries.length,1);
  const imported=require('../../src/core/document-content-envelope-v1.cjs').parseObservablePayload(entries[0].content).doc;
  assert.deepEqual(imported.content.map(p=>p.type),literal.map(()=> 'paragraph'));
  assert.deepEqual(imported.content.map(p=>(p.content||[]).map(n=>n.text||'').join('')),literal);
  assert.equal(hash(JSON.stringify(source)),protectedSource);
  const rejected=bridge.buildDocxReviewTransportAnalysisFromZipBytes({bytes,budgets:{maxInflatedPartBytes:1024},hmacSecret:source.forbiddenSecret,expectedAuthority:source.localAuthorityCapsule.expectedAuthority},{cryptoPort:context.createRtkReviewTransportCryptoPort()});
  assert.equal(rejected.ok,false);
  assert.equal(rejected.code,'RTK_BUDGET_EXCEEDED');
});

test('Finite actual Main content and import preview retain all three-scene literal paragraphs through bounded references',async()=>{
  const ps=[['','first 🧑‍💻',''],['second','Café'],['','last','']],{source,context}=await fixture(ps,{rich:true});
  const protectedSource=JSON.stringify(source),bytes=buildDocxReviewPacketBuffer(source),literal=ps.flat();
  const content=await context.handleDocxContentPreviewCommandSurface({requestId:'finite-content',bufferSource:bytes.toString('base64')});
  assert.equal(content.previewOk,true,JSON.stringify(content));assert.match(content.docxContentPreviewRef,/^[a-f0-9]{64}$/u);
  assert.deepEqual(clone(content.docxContentPreviewReport.contentPreview.paragraphs.map(p=>p.text)),literal);
  const plan=await context.handleDocxImportPreviewCommandSurface({requestId:'finite-plan',docxContentPreviewRef:content.docxContentPreviewRef});
  assert.equal(plan.importPreviewOk,true,JSON.stringify(plan));assert.match(plan.docxImportPreviewRef,/^[a-f0-9]{64}$/u);
  const entries=plan.docxImportPreviewPlan.candidateCreatePlan.entries;assert.equal(entries.length,1);
  const imported=require('../../src/core/document-content-envelope-v1.cjs').parseObservablePayload(entries[0].content).doc;
  assert.deepEqual(imported.content.map(p=>p.type),literal.map(()=> 'paragraph'));
  assert.deepEqual(imported.content.map(p=>(p.content||[]).map(n=>n.text||'').join('')),literal);
  assert.equal(JSON.stringify(source),protectedSource);
});

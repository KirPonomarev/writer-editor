'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');
const vm=require('node:vm');
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
  const context=vm.createContext({crypto,Buffer,
    isPlainObjectValue:x=>!!x&&typeof x==='object'&&!Array.isArray(x),
    docxReviewPreviewSessionDetailString:x=>typeof x==='string'?x:'',
    sha256DocxReviewPreviewSessionBytes:b=>hash(b).slice(7),cloneJsonSafe:clone,docxReviewReturnIntakeBlocked:code=>({ok:false,code}),
    validateFullManuscriptDocumentSectionsReturn,
  });
  vm.runInContext(main.match(/const DOCX_REVIEW_RETURN_INTAKE_FULL_MANUSCRIPT_PRODUCT_BUDGETS = Object.freeze\([^]*?\n}\);/)[0]+'\n'+['stableRtkReviewTransportJson','createRtkReviewTransportCryptoPort','normalizeRtkSignedSha256','buildFullManuscriptProvisionalSelfParse','docxReviewReturnIntakeProductBudgets','decodeDocxCustomPropertyText','extractDocxCustomPropertyValue','extractDocxReviewReturnYrtk2PropertiesFromCustomXml','extractDocxReviewReturnYrtk2PropertiesFromParserResult','verifyDocxReviewReturnYrtk2Binding','buildFullManuscriptPublicationGate'].map(declaration).join('\n'),context);
  return context;
}
async function fixture(paragraphs,{rich=false}={}){
  const bridge=await import(pathToFileURL(path.join(ROOT,'src/io/revisionBridge/index.mjs')));
  const envelope=await import(pathToFileURL(path.join(ROOT,'src/renderer/documentContentEnvelope.mjs')));
  const context=harness();
  const scenes=paragraphs.map((ps,i)=>{
    const doc={type:'doc',content:ps.map(text=>({type:'paragraph',...(text?{content:[{type:'text',text}]}:{})}))};
    const raw=rich?envelope.composeObservablePayload({doc}):ps.join('\n');
    const parsed=envelope.parseObservablePayload(raw);
    return {sceneId:'roman/scene-'+i+'.txt',scenePath:'/synthetic/roman/scene-'+i+'.txt',text:rich?parsed.text:raw,doc:parsed.doc,observableContent:raw,order:i};
  });
  const source=buildFullManuscriptDocxReviewPacketSource({projectId:'volume-project',projectRoot:'/synthetic',manifestPath:'/synthetic/manifest.json',scenes,expectedOrderedSceneIds:scenes.map(s=>s.sceneId)},{revisionBridge:bridge,cryptoPort:context.createRtkReviewTransportCryptoPort(),createdAtUtc:'2026-09-17T00:00:00Z',roundIdHex:'a'.repeat(32),keyIdHex:'b'.repeat(32),hmacSecret:'test-local-key-never-published'});
  const gate=s=>context.buildFullManuscriptProvisionalSelfParse({source:s,revisionBridge:bridge,cryptoPort:context.createRtkReviewTransportCryptoPort(),coreManifest:s.advisoryManifest.coreManifest});
  return {source,gate,bridge,context};
}
async function sectionFixture(){
  const bridge=await import(pathToFileURL(path.join(ROOT,'src/io/revisionBridge/index.mjs')));
  const context=harness();
  const scenes=[
    {sceneId:'roman/part-01/chapter-01/a.txt',scenePath:'/synthetic/roman/part-01/chapter-01/a.txt',text:'a-1\na-2',order:0},
    {sceneId:'roman/part-01/chapter-01/b.txt',scenePath:'/synthetic/roman/part-01/chapter-01/b.txt',text:'b-1',order:1},
    {sceneId:'roman/part-01/chapter-02/c.txt',scenePath:'/synthetic/roman/part-01/chapter-02/c.txt',text:'c-1\nc-2',order:2},
  ];
  const source=buildFullManuscriptDocxReviewPacketSource({projectId:'section-project',projectRoot:'/synthetic',manifestPath:'/synthetic/manifest.json',scenes,expectedOrderedSceneIds:scenes.map(s=>s.sceneId)},{revisionBridge:bridge,cryptoPort:context.createRtkReviewTransportCryptoPort(),createdAtUtc:'2026-09-18T00:00:00Z',roundIdHex:'c'.repeat(32),keyIdHex:'d'.repeat(32),hmacSecret:'section-local-key-never-published'});
  const parse=bytes=>bridge.buildDocxReviewTransportAnalysisFromZipBytes({bytes,hmacSecret:source.forbiddenSecret,expectedAuthority:source.localAuthorityCapsule.expectedAuthority},{cryptoPort:context.createRtkReviewTransportCryptoPort()});
  const validate=parsed=>validateFullManuscriptDocumentSectionsReturn({expected:source.documentSections,returned:parsed.reviewIr?.documentSections,signedDigest:parsed.authorityCarrier?.selectedCarrier?.payload?.documentSectionsDigest});
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
test('Full manuscript Word sections account provider extensions and block missing duplicate or forged carriers',async()=>{
  const {source,parse,validate,repack}=await sectionFixture();
  const extended=parse(repack(xml=>xml.replaceAll('</w:sectPr>','<w:docGrid w:linePitch="360"/></w:sectPr>')));
  assert.equal(extended.ok,true,JSON.stringify(extended));
  assert.equal(validate(extended).ok,true);
  assert.equal(extended.reviewIr.documentSections.lossLedger.providerExtensionElements.every(item=>item.elementName==='docGrid'),true);
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
test('500k-word publication uses the existing full-manuscript profile within unchanged byte ceilings',async()=>{
  const {buildWordVolumeFixture}=await import(pathToFileURL(path.join(ROOT,'scripts/ops/rtk-interop-word-volume-fixtures.mjs')));
  const corpus=buildWordVolumeFixture('LARGE_DOCUMENT');
  assert.equal(corpus.scenes.length,21);
  assert.equal(corpus.minimumWords,500000);
  const {source,bridge,context}=await fixture(corpus.scenes.map(s=>s.paragraphs),{rich:true});
  assert.ok(source.blocks.length>5000);
  const bytes=buildDocxReviewPacketBuffer(source);
  assert.ok(bytes.length<8*1024*1024,'The actual 500k-word DOCX must fit existing evidence and intake byte budgets');
  const gate=await context.buildFullManuscriptPublicationGate(source,bytes,bridge);
  assert.equal(gate.ok,true,JSON.stringify(gate));
  assert.equal(gate.provisionalSelfParse.verified,true);
  assert.equal(gate.finalSelfParse.semanticEquivalent,true);
  assert.equal(gate.yrtk2Verification.ok,true);
  const rejected=bridge.buildDocxReviewTransportAnalysisFromZipBytes({bytes,budgets:{maxInflatedPartBytes:1024},hmacSecret:source.forbiddenSecret,expectedAuthority:source.localAuthorityCapsule.expectedAuthority},{cryptoPort:context.createRtkReviewTransportCryptoPort()});
  assert.equal(rejected.ok,false);
  assert.equal(rejected.code,'RTK_BUDGET_EXCEEDED');
});

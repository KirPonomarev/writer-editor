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
const {buildFullManuscriptDocxReviewPacketSource}=require('../../src/export/docx/fullManuscriptDocxReviewPacketSource');
const {buildDocxReviewPacketBuffer}=require('../../src/export/docx/docxReviewPacketBuilder');
const hash=b=>'sha256:'+crypto.createHash('sha256').update(b).digest('hex');
const clone=v=>JSON.parse(JSON.stringify(v));
function declaration(name){const match=main.match(new RegExp('function '+name+'\\([^]*?\\n}(?=\\n|$)'));assert.ok(match,name);return match[0];}
function harness(){
  const context=vm.createContext({crypto,Buffer,
    isPlainObjectValue:x=>!!x&&typeof x==='object'&&!Array.isArray(x),
    docxReviewPreviewSessionDetailString:x=>typeof x==='string'?x:'',
    sha256DocxReviewPreviewSessionBytes:b=>hash(b).slice(7),cloneJsonSafe:clone,docxReviewReturnIntakeBlocked:code=>({ok:false,code}),
  });
  vm.runInContext(main.match(/const DOCX_REVIEW_RETURN_INTAKE_FULL_MANUSCRIPT_PRODUCT_BUDGETS = Object.freeze\([^]*?\n}\);/)[0]+'\n'+['stableRtkReviewTransportJson','createRtkReviewTransportCryptoPort','normalizeRtkSignedSha256','buildFullManuscriptProvisionalSelfParse','docxReviewReturnIntakeProductBudgets','decodeDocxCustomPropertyText','extractDocxCustomPropertyValue','extractDocxReviewReturnYrtk2PropertiesFromCustomXml','verifyDocxReviewReturnYrtk2Binding','buildFullManuscriptPublicationGate'].map(declaration).join('\n'),context);
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
for(const rich of [false,true])test('Full manuscript provisional gate preserves all authored paragraph boundaries, rich='+rich,async()=>{
  const ps=[['','  Привет Café 🧑‍💻  ','','','end-a',''],['','שלום 中文','end-b'],['Καλημέρα','final  ','']];
  const {source,gate}=await fixture(ps,{rich});
  assert.deepEqual(source.blocks.map(b=>b.text),ps.flat());
  assert.equal(source.sceneText,ps.map(s=>s.join('\n')).join('\n\n'));
  assert.equal(gate(source).ok,true,JSON.stringify(gate(source)));
});
for(const mutant of ['drop-empty','duplicate','swap-paragraphs','swap-scenes','change-codepoint'])test('Coherently rehashed provisional '+mutant+' is rejected',async()=>{
  const {source,gate}=await fixture([['alpha','','beta'],['gamma','delta']]);
  let blocks=source.blocks.map(clone);
  if(mutant==='drop-empty')blocks.splice(1,1);
  if(mutant==='duplicate')blocks.splice(1,0,clone(blocks[0]));
  if(mutant==='swap-paragraphs')[blocks[0],blocks[2]]=[blocks[2],blocks[0]];
  if(mutant==='swap-scenes')blocks=[...blocks.slice(3),...blocks.slice(0,3)];
  if(mutant==='change-codepoint'){blocks[0].text='Alpha';blocks[0].formatIr.runs[0].text='Alpha';}
  const bytes=buildDocxReviewPacketBuffer({...source,blocks});
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

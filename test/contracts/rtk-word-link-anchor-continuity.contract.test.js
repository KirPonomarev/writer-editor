'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const vm=require('node:vm');
const {spawnSync}=require('node:child_process');
const {pathToFileURL}=require('node:url');
const ROOT=path.resolve(__dirname,'../..');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
function productCryptoPort(){
 const main=fs.readFileSync(path.join(ROOT,'src/main.js'),'utf8');
 const context=vm.createContext({crypto,Buffer,isPlainObjectValue:v=>v!==null&&typeof v==='object'&&!Array.isArray(v)});
 for(const name of ['stableRtkReviewTransportJson','createRtkReviewTransportCryptoPort'])vm.runInContext(main.match(new RegExp('function '+name+'\\([^]*?\\n}'))[0],context);
 return context.createRtkReviewTransportCryptoPort();
}


test('Authenticated manuscript preview never promotes missing, duplicate or conflicting bookmarks through paragraph position',async()=>{
 const {buildFullManuscriptDocxReviewPacketSource}=require('../../src/export/docx/fullManuscriptDocxReviewPacketSource.js');
 const {buildDocxReviewPacketBuffer}=require('../../src/export/docx/docxReviewPacketBuilder.js');
 const bridge=await import(pathToFileURL(path.join(ROOT,'src/io/revisionBridge/index.mjs')));
 const source=buildFullManuscriptDocxReviewPacketSource({projectId:'owned-anchor-guard',scenes:[{sceneId:'first',scenePath:'/owned/first',title:'first',text:'alpha\nshared',order:0},{sceneId:'second',scenePath:'/owned/second',title:'second',text:'other\nshared',order:1}]},{hmacSecret:'unit-only'});
 const child=spawnSync('python3',['-I','-B','-c',String.raw`
import sys,io,re,zipfile,json,base64
data=base64.b64decode(sys.stdin.read())
with zipfile.ZipFile(io.BytesIO(data)) as z:parts={n:z.read(n) for n in z.namelist()}
xml=parts['word/document.xml'].decode()
tracked='<w:del w:id="11" w:author="Unit"><w:r><w:delText>alpha</w:delText></w:r></w:del><w:ins w:id="12" w:author="Unit"><w:r><w:t>changed</w:t></w:r></w:ins>'
xml,count=re.subn(r'<w:r\b[^>]*>(?:(?!</w:r>)[\s\S])*?<w:t\b[^>]*>alpha</w:t></w:r>',lambda _:tracked,xml,count=1);assert count==1
starts=list(re.finditer(r'<w:bookmarkStart\b[^>]*/>',xml));assert len(starts)==4
names=[re.search(r'w:name="([^"]+)"',m[0])[1] for m in starts]
variants={'identity':xml,'missing':xml[:starts[0].start()]+xml[starts[0].end():],'duplicate':xml.replace(names[1],names[0]),'swapped':xml.replace(names[0],'TEMP_BOOKMARK').replace(names[1],names[0]).replace('TEMP_BOOKMARK',names[1]),'native-renumbered':re.sub(r'w14:(paraId|textId)="[^"]*"',r'w14:\1="ABCDEF01"',xml)}
result={}
for kind,body in variants.items():
 out=io.BytesIO()
 with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as z:
  for n,b in parts.items():z.writestr(n,body.encode() if n=='word/document.xml' else b)
 result[kind]=base64.b64encode(out.getvalue()).decode()
print(json.dumps(result))
`],{input:buildDocxReviewPacketBuffer(source).toString('base64'),encoding:'utf8',timeout:30000,maxBuffer:4*1024*1024});
 assert.equal(child.status,0,child.stderr);const variants=JSON.parse(child.stdout);
 for(const [kind,bytes] of Object.entries(variants)){
  const actualBytes=Buffer.from(bytes,'base64'),options={projectId:'owned-anchor-guard',targetScope:{type:'scene',id:'first'},fullManuscriptExportMap:source.localAuthorityCapsule.exportMap};
  const analysis=bridge.buildDocxReviewTransportAnalysisFromZipBytes({bytes:actualBytes},{cryptoPort:productCryptoPort()});
  assert.equal(analysis.ok,true,JSON.stringify(analysis));
  for(const r of [bridge.buildDocxReviewPreviewSessionCandidateFromZipBytes(actualBytes,options),bridge.buildDocxReviewPreviewSessionCandidateFromEvidence({returnedProjection:analysis.reviewIr,diagnostics:analysis.reasons},options)]){
  assert.equal(r.ok,true,JSON.stringify(r));assert.equal(r.reviewPacket.textChanges.length,1,JSON.stringify(r));
  const c=r.reviewPacket.textChanges[0];assert.equal(c.match.quote,'alpha');assert.equal(c.replacementText,'changed');
  if(kind==='identity'||kind==='native-renumbered'){assert.equal(c.match.kind,'exact',JSON.stringify({kind,diagnostics:r.diagnostics,paragraphs:analysis.reviewIr.formattingParagraphs,revisions:analysis.reviewIr.textRevisions}));assert.equal(c.targetScope.id,'first');}
  else {assert.equal(c.match.kind,'manual',kind);assert.equal(c.sourceAuthority,undefined);assert.ok(r.diagnostics.some(d=>d.diagnosticId.startsWith('docx-review-bookmark-'+({missing:'missing',duplicate:'duplicate',swapped:'locator-conflict'}[kind])+'-')),JSON.stringify(r.diagnostics));}
  }
 }
});

test('Office-wide identity rewrite resolves one replacement only with the authenticated full text and section vector',async()=>{
 const {buildFullManuscriptDocxReviewPacketSource}=require('../../src/export/docx/fullManuscriptDocxReviewPacketSource.js');
 const {buildDocxReviewPacketBuffer}=require('../../src/export/docx/docxReviewPacketBuilder.js');
 const bridge=await import(pathToFileURL(path.join(ROOT,'src/io/revisionBridge/index.mjs')));
 const source=buildFullManuscriptDocxReviewPacketSource({projectId:'owned-vector-guard',scenes:[
  {sceneId:'part/a/one',scenePath:'/part/a/one',title:'one',text:'alpha sentinel text.\nMore alpha.',order:0},
  {sceneId:'part/b/two',scenePath:'/part/b/two',title:'two',text:'bravo text.',order:1},
  {sceneId:'part/c/three',scenePath:'/part/c/three',title:'three',text:'charlie text.',order:2},
 ]},{hmacSecret:'unit-only'});
 const exportMap=source.localAuthorityCapsule.exportMap;
 const parsed=bridge.buildDocxReviewTransportAnalysisFromZipBytes(
  {bytes:buildDocxReviewPacketBuffer(source)},{cryptoPort:productCryptoPort()});
 assert.equal(parsed.ok,true);
 const verifiedSections={...source.localAuthorityCapsule.documentSections,
  status:'VERIFIED_PROTECTED_DOCUMENT_SECTIONS'};
 const projection=structuredClone(parsed.reviewIr);
 projection.formattingParagraphs.forEach((paragraph,index)=>{
  paragraph.bookmarkNames=[];
  paragraph.paraId=String(index+1).padStart(8,'0');
  paragraph.textId='';
 });
 projection.formattingParagraphs[0].paragraphText='alpha changed text.';
 projection.textRevisions=[
  {operation:'insert',paragraphIndex:0,text:'changed',replacementGroupId:'office-pair',author:'Office User'},
  {operation:'delete',paragraphIndex:0,text:'sentinel',replacementGroupId:'office-pair',author:'Office User'},
 ];
 projection.commentThreads=[{threadId:'comment-1',commentId:'1',status:'ANCHORED',paragraphIndex:0,
  quotedAnchorText:'alpha changed',anchorLocator:{paraId:'00000001',textId:'',bookmarkNames:[]},body:'Review'}];
 const candidate=(returnProjection,sections=verifiedSections,map=exportMap)=>
  bridge.buildDocxReviewPreviewSessionCandidateFromEvidence({returnedProjection:returnProjection},
   {targetScope:{type:'scene',id:'part/a/one'},fullManuscriptExportMap:map,verifiedDocumentSections:sections});
 const exact=candidate(projection);
 assert.equal(exact.ok,true);
 assert.equal(exact.reviewPacket.textChanges.length,1);
 assert.equal(exact.reviewPacket.textChanges[0].match.kind,'exact');
 assert.equal(exact.reviewPacket.textChanges[0].match.blockId,exportMap.scenes[0].blocks[0].blockId);
 assert.equal(exact.reviewPacket.textChanges[0].sourceAuthority,'full-manuscript-export-map-full-text-vector');
 assert.equal(exact.reviewPacket.commentPlacements[0].sceneAuthority.authority,
  'full-manuscript-export-map-full-text-vector');
 assert.equal(exact.reviewPacket.commentPlacements[0].targetScope.id,'part/a/one');
 const negative=[
  p=>{p.formattingParagraphs[2].paragraphText='drifted bravo text.';},
  p=>{p.formattingParagraphs[0].bookmarkNames=['partial-bookmark'];},
  p=>{p.formattingParagraphs[0].paraId=exportMap.scenes[1].blocks[0].wordSignals.find(s=>s.kind==='w14ParaIdTextId').value.paraId;},
  p=>{p.formattingParagraphs[0].paragraphText='alpha changed changed text.';},
  p=>{p.structureChanges=[{kind:'movedParagraph'}];},
 ];
 for(const mutate of negative){const bad=structuredClone(projection);mutate(bad);
  assert.equal(candidate(bad).reviewPacket.textChanges[0].match.kind,'manual');}
 for(const badSections of [null,{...verifiedSections,status:'UNVERIFIED'},
  {...verifiedSections,protectedSections:verifiedSections.protectedSections.map((section,index)=>
   index===0?{...section,endParagraphIndex:0}:section)},
  {...verifiedSections,sourceBindings:verifiedSections.sourceBindings.map((binding,index)=>
   index===0?{...binding,sceneIds:['part/b/two']}:binding)}]){
  assert.equal(candidate(projection,badSections).reviewPacket.textChanges[0].match.kind,'manual');
 }
 const ambiguousMap=structuredClone(exportMap);
 ambiguousMap.scenes[1].blocks[0].formatIr.runs=structuredClone(ambiguousMap.scenes[0].blocks[0].formatIr.runs);
 ambiguousMap.scenes[1].blocks[0].canonicalTextSha256=ambiguousMap.scenes[0].blocks[0].canonicalTextSha256;
 assert.equal(candidate(projection,verifiedSections,ambiguousMap).reviewPacket.textChanges[0].match.kind,'manual');
});

test('Real product exporter binds linked ranges to persisted locators; independent reader rejects coherent locator corruption',async()=>{
 const {buildWordManuscriptFixture}=await import(pathToFileURL(path.join(ROOT,'scripts/ops/rtk-interop-word-manuscript-fixtures.mjs')));
 const {buildFullManuscriptDocxReviewPacketSource}=require('../../src/export/docx/fullManuscriptDocxReviewPacketSource.js');
 const {buildDocxReviewPacketBuffer}=require('../../src/export/docx/docxReviewPacketBuilder.js');
 const main=fs.readFileSync(path.join(ROOT,'src/main.js'),'utf8');
 const context=vm.createContext({crypto,Buffer,isPlainObjectValue:v=>v!==null&&typeof v==='object'&&!Array.isArray(v)});
 for(const name of ['stableRtkReviewTransportJson','createRtkReviewTransportCryptoPort'])vm.runInContext(main.match(new RegExp('function '+name+'\\([^]*?\\n}'))[0],context);
 const port=context.createRtkReviewTransportCryptoPort();
 const fixture=buildWordManuscriptFixture('MULTI_SCENE','C2');
 const scenes=fixture.scenes.map((s,i)=>({sceneId:'roman/'+String(i+1).padStart(2,'0')+'_scene.txt',scenePath:'/owned/scene-'+i,title:'scene-'+i,doc:s.doc,observableContent:JSON.stringify(s.doc),text:s.paragraphs.join('\n').replace(/\n{3,}/gu,'\n\n').replace(/^\n+|\n+$/gu,''),order:i}));
 const source=buildFullManuscriptDocxReviewPacketSource({projectId:'owned-link-contract',scenes},{roundIdHex:'12'.repeat(16),keyIdHex:'34'.repeat(16),hmacSecret:'owned-unit-only-key',cryptoPort:port});
 const local={...source.localAuthorityCapsule};delete local.hmacSecret;
 const unsigned={scope:'full-manuscript',lastRoundId:source.exportCapsule.roundId,roundsById:{[source.exportCapsule.roundId]:local},secretExposedToRenderer:false,secretEmbeddedInDocx:false};
 const store={...unsigned,authorityStoreDigest:port.sha256Json(unsigned)};
 const request={bytes:buildDocxReviewPacketBuffer(source).toString('base64'),cap:source.exportCapsule,store,ids:scenes.map(s=>s.sceneId),hashes:scenes.map(s=>hash(s.observableContent))};
 const script=String.raw`
import sys,json,base64,copy,importlib.util
from pathlib import Path
s=importlib.util.spec_from_file_location('oracle',Path.cwd()/'scripts/ops/rtk-interop-word-manuscript-readback.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
q=json.load(sys.stdin);docs=m.expected_docs('MULTI_SCENE','C2');data=base64.b64decode(q['bytes']);_,parts,document=m.docx(data)
proof=m.identifier_doc(parts,document,q['cap']['roundId'],q['ids'],docs)
assert [x['href'] for x in proof['links']]==[m.LINK_TARGETS[0],m.LINK_TARGETS[1],m.LINK_TARGETS[0]]
assert all(x['rejected'] for x in m.identifier_controls(data,q['cap']['roundId'],q['ids'],docs))
def verify(store,activation=None):
 return m.locator_store(m.canonical(store),activation or {'authorityStoreDigest':store['authorityStoreDigest']},q['cap'],q['ids'],docs,q['hashes'])
good=verify(q['store']);assert good['sceneCount']==3 and good['sourceSceneHashes']==q['hashes']
cases=['store-digest','scene-baseline','block-position','block-id','bookmark-name','text-hash','marks-hash','run-range','coherent-link-target','secret-in-store','wrong-activation']
for name in cases:
 x=copy.deepcopy(q['store']);local=x['roundsById'][q['cap']['roundId']];scene=local['exportMap']['scenes'][0];b=scene['blocks'][0]
 if name=='scene-baseline':scene['rawSha256']='sha256:'+'0'*64
 elif name=='block-position':b['documentParagraphIndex']+=1
 elif name=='block-id':b['blockId']+='x'
 elif name=='bookmark-name':next(s for s in b['wordSignals'] if s['kind']=='bookmarkName')['value']['name']+='x'
 elif name=='text-hash':b['canonicalTextSha256']='sha256:'+'0'*64
 elif name=='marks-hash':b['canonicalMarksSha256']='sha256:'+'0'*64
 elif name=='run-range':b['formatIr']['runs'][0]['to']+=1;b['canonicalMarksSha256']='sha256:'+m.digest(m.canonical(b['formatIr']))
 elif name=='coherent-link-target':
  linked=next(b for b in scene['blocks'] if any(any(k.get('type')=='link' for k in r.get('preservedMarks',[])) for r in b['formatIr']['runs']))
  link=next(k for r in linked['formatIr']['runs'] for k in r.get('preservedMarks',[]) if k.get('type')=='link');link['attrs']['href']=m.LINK_TARGETS[1]
  linked['canonicalMarksSha256']='sha256:'+m.digest(m.canonical(linked['formatIr']))
 elif name=='secret-in-store':local['hmacSecret']='must-not-persist'
 if name!='store-digest':x['authorityStoreDigest']='sha256:'+m.digest(m.canonical({k:v for k,v in x.items() if k!='authorityStoreDigest'}))
 else:x['authorityStoreDigest']='sha256:'+'0'*64
 activation={'authorityStoreDigest':'sha256:'+'0'*64} if name=='wrong-activation' else None
 try:verify(x,activation)
 except ValueError:pass
 else:raise AssertionError('false green: '+name)
print(json.dumps({'links':len(proof['links']),'locatorCorruptions':len(cases),'rawCorruptions':11,'admissionCredit':0}))
`;
 const child=spawnSync('python3',['-I','-B','-c',script],{cwd:ROOT,input:JSON.stringify(request),encoding:'utf8',timeout:30000,maxBuffer:4*1024*1024});
 assert.equal(child.status,0,child.stdout+child.stderr);
 assert.deepEqual(JSON.parse(child.stdout),{links:3,locatorCorruptions:11,rawCorruptions:11,admissionCredit:0});
});

test('Identifier admission rejects lost stages, rebound links, incomplete controls and false zero-mutation claims',async()=>{
 const {validateManuscriptIdentifierProof:check}=await import(pathToFileURL(path.join(ROOT,'scripts/ops/rtk-interop-word-manuscript-batch.mjs')));
 const {buildWordManuscriptFixture,MANUSCRIPT_LINK_TARGETS}=await import(pathToFileURL(path.join(ROOT,'scripts/ops/rtk-interop-word-manuscript-fixtures.mjs')));
 const {stableOrderJson}=await import(pathToFileURL(path.join(ROOT,'scripts/ops/rtk-interop-order-c1.mjs')));
 const h=s=>hash(s),fixture=buildWordManuscriptFixture('MULTI_SCENE','C2'),paragraphIndex=fixture.scenes[0].paragraphs.indexOf('[links] reference / reference / reference.');
 const links=[0,1,0].map((target,i)=>({paragraphIndex,startUtf16:8+12*i,endUtf16:17+12*i,text:'reference',href:MANUSCRIPT_LINK_TARGETS[target]}));
 const rounds=[{roundId:'round-test',exportId:'export-test',exportSha256:h('export'),returnedSha256:h('returned'),savedSceneHashes:['one','two','three'].map(h)}];
 const stage={bookmarkCount:fixture.paragraphsForRound(0).length,links,linkSemanticSha256:h(stableOrderJson(links)),bookmarkSha256:h('bookmarks'),relationshipsSha256:h('relationships'),artifactSha256:h('export'),roundId:'round-test',scope:'Unit-only oracle data'};
 const locator={storage:{encoding:'gzip',encodedSha256:h('encoded'),encodedBytes:128,decodedBytes:2048},artifactSha256:h('store'),storeDigest:'sha256:'+h('store'),coreManifestDigest:'sha256:'+h('core'),locatorSha256:h('locator'),sourceMapSha256:h('map'),blockCount:stage.bookmarkCount,sceneCount:3,sourceSceneHashes:rounds[0].savedSceneHashes,roundId:'round-test',exportId:'export-test'};
 const controls=['missing-bookmark','duplicate-bookmark','wrong-bookmark-end','partial-bookmark-range','renamed-bookmark','removed-link','swapped-link-targets','dangling-link','duplicate-relationship','unsafe-link','unreferenced-link'];
 const p={stages:Object.fromEntries(['rounds/1/export','rounds/1/word','rounds/1/review-probe','reexport','final-word-lifecycle'].map(n=>[n,{...structuredClone(stage),artifactSha256:n==='rounds/1/word'?h('returned'):h('export')}])),
  locators:Object.fromEntries(['rounds/1/export','reexport'].map(n=>[n,structuredClone(locator)])),negativeControls:controls.map(id=>({id,rejected:true,sha256:h(id)})),
  intakeControls:['identity','missing-bookmark','duplicate-bookmark'].map(kind=>({kind,sourceSha256:h('returned'),mutantSha256:h(kind),intakeSha256:h(kind+'intake'),canonicalStateSha256:h('unchanged'),writerCalled:false,previewAccepted:true,exactMatchAllowed:kind==='identity',code:kind==='identity'?null:'DOCX_REVIEW_BOOKMARK_'+(kind==='missing-bookmark'?'MISSING':'DUPLICATE'),applyAttempted:kind!=='identity',applyCode:kind==='identity'?null:'E_REVIEW_EXACT_TEXT_APPLY_BATCH_BLOCKED',applyResultSha256:kind==='identity'?null:h(kind+'apply'),lostIdentifiers:kind==='missing-bookmark'?['YRTK_'+'a'.repeat(32)]:[],duplicateIdentifiers:kind==='duplicate-bookmark'?['YRTK_'+'a'.repeat(32)]:[]})),
  lossLedger:{lostIdentifiers:[],duplicateIdentifiers:[],unsafeHyperlinks:[],scope:'Every positive raw stage checked'}};
 assert.equal(check(p,'MULTI_SCENE',1,rounds),true);
 const mutations=[x=>delete x.stages['final-word-lifecycle'],x=>delete x.locators.reexport,x=>x.stages.reexport.links[1].href=MANUSCRIPT_LINK_TARGETS[0],x=>x.stages.reexport.links[0].startUtf16++,x=>x.stages.reexport.bookmarkCount--,x=>x.stages['rounds/1/word'].roundId='round-other',x=>x.locators['rounds/1/export'].exportId='wrong',x=>x.locators.reexport.sourceSceneHashes[0]=h('stale'),x=>x.locators.reexport.storeDigest='count-only',x=>x.locators.reexport.storage.decodedBytes=128*1024*1024+1,x=>delete x.locators.reexport.storage,x=>x.negativeControls.pop(),x=>x.negativeControls[0].rejected=false,x=>x.intakeControls.pop(),x=>x.intakeControls[0].exactMatchAllowed=false,x=>x.intakeControls[1].exactMatchAllowed=true,x=>x.intakeControls[1].writerCalled=true,x=>x.intakeControls[1].code='',x=>x.intakeControls[1].applyAttempted=false,x=>x.intakeControls[1].applyCode='E_OTHER_FAILURE',x=>x.intakeControls[1].applyResultSha256=null,x=>x.intakeControls[1].lostIdentifiers=[],x=>x.intakeControls[2].canonicalStateSha256=h('mutated'),x=>x.intakeControls[2].duplicateIdentifiers=['YRTK_'+'b'.repeat(32)],x=>x.lossLedger.lostIdentifiers=['unexplained-loss']];
 for(const mutate of mutations){const bad=structuredClone(p);mutate(bad);assert.throws(()=>check(bad,'MULTI_SCENE',1,rounds));}
 assert.throws(()=>check(p,'MULTI_SCENE',5,rounds));
});

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
 const locator={artifactSha256:h('store'),storeDigest:'sha256:'+h('store'),coreManifestDigest:'sha256:'+h('core'),locatorSha256:h('locator'),sourceMapSha256:h('map'),blockCount:stage.bookmarkCount,sceneCount:3,sourceSceneHashes:rounds[0].savedSceneHashes,roundId:'round-test',exportId:'export-test'};
 const controls=['missing-bookmark','duplicate-bookmark','wrong-bookmark-end','partial-bookmark-range','renamed-bookmark','removed-link','swapped-link-targets','dangling-link','duplicate-relationship','unsafe-link','unreferenced-link'];
 const p={stages:Object.fromEntries(['rounds/1/export','rounds/1/word','rounds/1/review-probe','reexport','final-word-lifecycle'].map(n=>[n,{...structuredClone(stage),artifactSha256:n==='rounds/1/word'?h('returned'):h('export')}])),
  locators:Object.fromEntries(['rounds/1/export','reexport'].map(n=>[n,structuredClone(locator)])),negativeControls:controls.map(id=>({id,rejected:true,sha256:h(id)})),
  intakeControls:['identity','missing-bookmark','duplicate-bookmark'].map(kind=>({kind,sourceSha256:h('returned'),mutantSha256:h(kind),intakeSha256:h(kind+'intake'),canonicalStateSha256:h('unchanged'),writerCalled:false,accepted:kind==='identity',code:kind==='identity'?null:'E_TYPED_IDENTITY',lostIdentifiers:kind==='missing-bookmark'?['YRTK_'+'a'.repeat(32)]:[],duplicateIdentifiers:kind==='duplicate-bookmark'?['YRTK_'+'a'.repeat(32)]:[]})),
  lossLedger:{lostIdentifiers:[],duplicateIdentifiers:[],unsafeHyperlinks:[],scope:'Every positive raw stage checked'}};
 assert.equal(check(p,'MULTI_SCENE',1,rounds),true);
 const mutations=[x=>delete x.stages['final-word-lifecycle'],x=>delete x.locators.reexport,x=>x.stages.reexport.links[1].href=MANUSCRIPT_LINK_TARGETS[0],x=>x.stages.reexport.links[0].startUtf16++,x=>x.stages.reexport.bookmarkCount--,x=>x.stages['rounds/1/word'].roundId='round-other',x=>x.locators['rounds/1/export'].exportId='wrong',x=>x.locators.reexport.sourceSceneHashes[0]=h('stale'),x=>x.locators.reexport.storeDigest='count-only',x=>x.negativeControls.pop(),x=>x.negativeControls[0].rejected=false,x=>x.intakeControls.pop(),x=>x.intakeControls[0].accepted=false,x=>x.intakeControls[1].accepted=true,x=>x.intakeControls[1].writerCalled=true,x=>x.intakeControls[1].code='',x=>x.intakeControls[1].lostIdentifiers=[],x=>x.intakeControls[2].canonicalStateSha256=h('mutated'),x=>x.intakeControls[2].duplicateIdentifiers=['YRTK_'+'b'.repeat(32)],x=>x.lossLedger.lostIdentifiers=['unexplained-loss']];
 for(const mutate of mutations){const bad=structuredClone(p);mutate(bad);assert.throws(()=>check(bad,'MULTI_SCENE',1,rounds));}
 assert.throws(()=>check(p,'MULTI_SCENE',5,rounds));
});

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {spawnSync} = require('node:child_process');
const fs = require('node:fs');
const vm = require('node:vm');
const load = () => import(pathToFileURL(path.join(process.cwd(),'scripts/ops/rtk-interop-word-hostile.mjs')));
const hash = value => crypto.createHash('sha256').update(value).digest('hex');

function unitProof(module, route='C3') {
  const row={volume:'MULTI_SCENE',route,profile:'SOURCE_RUNTIME',recipe:route==='C1'?'C1_REVIEW_RETURN':'DEFAULT',
    runId:`ORDER__MULTI_SCENE__${route}__SOURCE_RUNTIME__${route==='C1'?'review-return-':''}hostile-v1-unit`};
  const cycles=route==='C3'?5:1,hops=['UNIT_HOPS_NOT_PHYSICAL_EVIDENCE'],oracles=['UNIT_ORACLES_NOT_PHYSICAL_EVIDENCE'];
  const raw={campaign:module.WORD_HOSTILE_CAMPAIGN,fieldProofs:[{cellId:'UNCLAIMED_POSITIVE_CARRIER'}],
    roundProofs:Array.from({length:cycles},(_,index)=>({ordinal:index+1,returnedSha256:hash('return'+index)}))};
  raw.hostileProofs=module.WORD_HOSTILE_FIELDS.map(field=>({field,cellId:`${field}__MALFORMED_HOSTILE_INPUT__${route}__SOURCE_RUNTIME`,
    runId:row.runId,status:'PASS',outcome:'REJECTED_INVALID_NO_MUTATION',typedResult:true,mutationCount:0,requiredCycles:cycles,
    requiredHops:hops,oracles,authorityScope:'CANONICAL_PROJECT_AND_AUTHORING_UNCHANGED_DERIVED_DIAGNOSTICS_RETAINED',
    rounds:raw.roundProofs.map((r,index)=>({ordinal:index+1,mutationCount:0,protectedFileCount:8,sourceSha256:r.returnedSha256,
      artifactSha256:hash(field+index),probeSha256:hash('probe'+field+index),canonicalStateSha256:hash('canonical'+index),
      intakeCode:'TYPED_REJECTION',applyCode:'TYPED_APPLY_REJECTION',classification:{field,invalid:true,reason:'INDEPENDENT_INVALIDITY',
        sourceSha256:r.returnedSha256,artifactSha256:hash(field+index)}}))}));
  return {raw,context:{row,hops,oracles,admittedCells:module.WORD_HOSTILE_CELLS}};
}

test('hostile admission covers the 84 frozen Word cells and excludes positive carrier credit',async()=>{
  const module=await load();assert.equal(module.WORD_HOSTILE_CELLS.length,84);assert.equal(new Set(module.WORD_HOSTILE_CELLS).size,84);
  for(const route of ['C1','C2','C3']) {
    const {raw,context}=unitProof(module,route);assert.equal(module.validateWordHostileRaw(raw,context),true);
    assert.equal(module.selectedManuscriptProofs(raw).length,14);
    assert.ok(module.selectedManuscriptProofs(raw).every(p=>p.cellId.includes('__MALFORMED_HOSTILE_INPUT__')));
  }
});

test('one missing cycle, mutation, weak classification, changed profile or duplicate input cannot receive hostile credit',async()=>{
  const module=await load();
  const changes=[
    raw=>raw.hostileProofs.pop(),raw=>raw.hostileProofs[0].rounds.pop(),
    raw=>raw.hostileProofs[0].mutationCount=1,raw=>raw.hostileProofs[0].typedResult=false,
    raw=>raw.hostileProofs[0].rounds[0].classification.invalid=false,
    raw=>raw.hostileProofs[0].rounds[0].classification.field='METADATA',
    raw=>raw.hostileProofs[0].rounds[0].sourceSha256=hash('other source'),
    raw=>raw.hostileProofs[0].cellId=raw.hostileProofs[0].cellId.replace('SOURCE_RUNTIME','PACKAGED_BUILD_RUNTIME'),
    raw=>raw.hostileProofs[0].rounds[0].applyCode='',
    raw=>{const a=raw.hostileProofs[0].rounds[0],b=raw.hostileProofs[1].rounds[0];b.artifactSha256=a.artifactSha256;b.classification.artifactSha256=a.artifactSha256;},
    raw=>raw.campaign='FORGED_CAMPAIGN',raw=>raw.roundProofs.pop(),
  ];
  for(const mutate of changes){const {raw,context}=unitProof(module);mutate(raw);assert.throws(()=>module.validateWordHostileRaw(raw,context),/HOSTILE_/);}
});

test('campaign is bound to the exact native Word recipe and cannot be added to an old run',async()=>{
  const module=await load();const {raw,context}=unitProof(module);
  for(const delta of [{volume:'LARGE_DOCUMENT'},{route:'C5'},{recipe:'TABLES_V1'}])assert.throws(()=>module.wordHostileCampaign({...context.row,...delta}),/HOSTILE_CAMPAIGN_SCOPE/);
  assert.throws(()=>module.validateWordHostileRaw(raw,{...context,row:{...context.row,runId:'ORDER__MULTI_SCENE__C3__SOURCE_RUNTIME__old-run'}}),/HOSTILE_UNBOUND_PROOF/);
  assert.throws(()=>module.validateWordHostileRaw(raw,{...context,admittedCells:module.WORD_HOSTILE_CELLS.slice(1)}),/HOSTILE_POLICY_SCOPE/);
});

test('independent raw classifier and snapshot tamper counterexamples execute',()=>{
  const result=spawnSync('python3',['-I','-B','test/unit/rtk-word-hostile.test.py'],{encoding:'utf8',timeout:30000});
  assert.equal(result.status,0,result.stderr || result.stdout);
  assert.match(result.stderr,/Ran [1-9][0-9]* tests/);assert.match(result.stderr,/\bOK\b/);
});

function activationHarness() {
  const source=fs.readFileSync(path.join(process.cwd(),'src/main.js'),'utf8');
  const start=source.indexOf('// DOCX_REVIEW_PREVIEW_SESSION_COMMAND_SURFACE_START');
  const end=source.indexOf('// DOCX_REVIEW_PREVIEW_SESSION_COMMAND_SURFACE_END',start);
  assert.ok(start>=0 && end>start);
  const prior={reviewSurface:{revisionSession:{sessionId:'previous-document'}}};
  const context={Buffer,console,activeReviewSessionStore:prior,activeReviewSessionLifecycle:'active',
    activeRtkNonOverlapTrackedReplacementApplyStore:{oldPreparedWrite:true},activeRtkFormattingReturnApplyStore:{oldPreparedWrite:true},activeRtkStructuralReturnApplyStore:{oldPreparedWrite:true},
    activeDocxActivationRequestDigestGuard:{check:()=>({ok:true})},
    isPlainObjectValue:value=>!!value && typeof value==='object' && !Array.isArray(value),cloneJsonSafe:value=>JSON.parse(JSON.stringify(value)),
    decodeDocxIntakeGateBufferSource:()=>({ok:true,bytes:Buffer.from('malformed input')}),normalizeDocxIntakeGateRequestId:value=>value,
    loadRevisionBridgeModule:async()=>({buildDocxReviewPreviewSessionCandidateFromZipBytes(){}})};
  vm.createContext(context);vm.runInContext(source.slice(start,end),context);
  context.rejectInput=async()=>({ok:false,reason:'RTK_XML_MALFORMED_BLOCKED'});
  vm.runInContext('inspectDocxReviewReturnIntakeV2 = (...args) => rejectInput(...args);',context);
  return context;
}

test('rejected replacement DOCX revokes every old prepared writer while retaining prior preview data',async()=>{
  const context=activationHarness(),saved=JSON.stringify(context.activeReviewSessionStore);
  const result=await context.handleDocxReviewPreviewSessionActivationCommandSurface({requestId:'invalid-next-document'},{buildMainReviewContext:async()=>({ok:true})});
  assert.equal(result.ok,false);assert.equal(result.error.reason,'RTK_XML_MALFORMED_BLOCKED');
  assert.notEqual(context.activeReviewSessionLifecycle,'active');
  assert.equal(context.activeRtkNonOverlapTrackedReplacementApplyStore,null);
  assert.equal(context.activeRtkFormattingReturnApplyStore,null);
  assert.equal(context.activeRtkStructuralReturnApplyStore,null);
  assert.equal(JSON.stringify(context.activeReviewSessionStore),saved);
});

test('late older DOCX intake cannot publish a candidate after a newer attempt',async()=>{
  const context=activationHarness();let release,entered;
  const reached=new Promise(resolve=>entered=resolve);
  context.rejectInput=async({context:request})=>{if(request.marker==='old'){entered();return new Promise(resolve=>release=resolve);}return {ok:false,reason:'RTK_XML_MALFORMED_BLOCKED'};};
  const old=context.handleDocxReviewPreviewSessionActivationCommandSurface({requestId:'old'},{buildMainReviewContext:async()=>({ok:true,marker:'old'})});
  await reached;
  await context.handleDocxReviewPreviewSessionActivationCommandSurface({requestId:'new'},{buildMainReviewContext:async()=>({ok:true,marker:'new'})});
  release({ok:true,authenticated:false,packet:{}});
  const result=await old;assert.equal(result.ok,false);assert.equal(result.error.reason,'RTK_DOCX_ACTIVATION_SUPERSEDED');
  assert.notEqual(context.activeReviewSessionLifecycle,'active');
});

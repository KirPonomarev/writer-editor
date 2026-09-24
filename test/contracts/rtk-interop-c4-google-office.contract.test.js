'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'../..');

test('C4 policy fixes six denominator IDs, real Google hops and pinned independent readers',async()=>{
  const c4=await import('../../scripts/ops/rtk-interop-c4-google-office-batch.mjs');
  const official=await import('../../scripts/ops/rtk-interop-100-denominator-v1.mjs');
  const policy=c4.loadC4Policy();
  const frozen=new Set(official.buildRequiredCells(official.readInterop100Denominator(ROOT)).map(c=>c.cellId));
  assert.equal(c4.C4_GOOGLE_MODE,'GOOGLE_OFFICE_C4_BATCH_V1');
  assert.equal(policy.readerBindings.length,4);
  assert.deepEqual(policy.cellIds,c4.C4_GOOGLE_CELLS);
  assert.deepEqual(policy.requiredHops,c4.C4_GOOGLE_HOPS);
  assert.deepEqual(policy.verifierPromotionPaths,c4.C4_VERIFIER_PROMOTION_PATHS);
  assert.ok(policy.verifierPromotionPaths.every(file=>!file.startsWith('src/')));
  assert.ok(policy.verifierPromotionPaths.includes('scripts/ops/rtk-interop-c4-google-office-readback.py'));
  assert.ok(policy.verifierPromotionPaths.includes('test/unit/rtk-interop-c4-google-office.test.py'));
  assert.equal(policy.cellIds.length,6);
  assert.ok(policy.cellIds.every(id=>frozen.has(id)));
  assert.deepEqual(policy.cellIds.filter(id=>id.startsWith('NOVEL_SCENE_STRUCTURE__')),[
    'NOVEL_SCENE_STRUCTURE__SINGLE_SCENE__C4__SOURCE_RUNTIME',
    'NOVEL_SCENE_STRUCTURE__SINGLE_SCENE__C4__PACKAGED_BUILD_RUNTIME']);
  assert.equal(Object.keys(policy.legacyFieldProofSha256).length,4);
  assert.deepEqual(policy.allowedLabDeltaPaths,[
    'LAB_MANIFEST.json','dashboard/index.html','data/artifacts/ARTIFACTS.json',
    'data/evidence/ledger.jsonl','src/m1-text-single-scene-source-runtime.mjs',
    'test/m0-audit-repair.test.mjs']);
  assert.deepEqual(policy.labCodeBindings,[
    {path:'src/m1-text-single-scene-source-runtime.mjs',
      sha256:'a7fa328c62d6d85c36d8182cf684c107151e8dc7c215ab5c3f8126717abd397c'},
    {path:'test/m0-audit-repair.test.mjs',
      sha256:'bbbfa513a373fa5e2fb23b10a8b17eca103c477aff1e596e67f940abb4174770'}]);
  const promotion=JSON.parse(fs.readFileSync(path.join(ROOT,'docs/OPS/RTK/YALKEN_INTEROP_DATA_C1_POLICY_V1.json')))
    .wordManuscriptBatch.verifierPromotionPaths;
  for(const file of [
    'scripts/ops/rtk-interop-c4-google-office-batch.mjs',
    'scripts/ops/rtk-interop-c4-google-office-readback.py',
    'test/unit/rtk-interop-c4-google-office.test.py',
    'docs/OPS/RTK/YALKEN_INTEROP_C4_POLICY_V1.json',
    'test/contracts/rtk-interop-c4-google-office.contract.test.js',
  ])assert.ok(promotion.includes(file),file);
  assert.ok(!promotion.includes('src/main.js'));
});

test('C4 promotion carries physical evidence only over exact verifier-only descendants',async()=>{
  const c4=await import('../../scripts/ops/rtk-interop-c4-google-office-batch.mjs');
  const policy=c4.loadC4Policy(),old={head:'a'.repeat(40),tree:'b'.repeat(40)},
    current={head:'c'.repeat(40),tree:'d'.repeat(40)};
  const diff=['scripts/ops/r24/corrective/post-audit-certification-set.mjs',
    'docs/OPS/RTK/YALKEN_INTEROP_100_GOVERNANCE_CHANGE_APPROVALS_V1.json'];
  const git=paths=>args=>args[0]==='diff'?paths.join('\n'):'';
  const check=(paths,more={})=>c4.validateC4VerifierPromotion({
    runtimeIdentity:old,verifierIdentity:current,
    allowedPaths:policy.verifierPromotionPaths,git:git(paths),...more});
  assert.deepEqual(check(diff),diff);
  for(const path of ['src/main.js','package-lock.json',
    'scripts/ops/rtk-interop-c4-google-office-unreviewed-reader.py',
    'docs/OPS/RTK/YALKEN_INTEROP_100_DENOMINATOR_V1.json'])
    assert.throws(()=>check([...diff,path]),/C4_PROMOTION_SCOPE/,path);
  assert.deepEqual(check([...diff,'scripts/ops/rtk-interop-c4-google-office-readback.py']),
    [...diff,'scripts/ops/rtk-interop-c4-google-office-readback.py']);
  assert.throws(()=>check([]),/C4_PROMOTION_SCOPE/);
  assert.throws(()=>check(diff,{allowedPaths:[...policy.verifierPromotionPaths,'src/main.js']}),
    /C4_PROMOTION_POLICY_SCOPE/);
  assert.throws(()=>check(diff,{git:args=>{if(args[0]==='merge-base')throw new Error('not descendant');return '';}}),
    /C4_PROMOTION_NOT_DESCENDANT/);
  assert.deepEqual(c4.validateC4VerifierPromotion({runtimeIdentity:old,
    verifierIdentity:{...old},allowedPaths:policy.verifierPromotionPaths}),[]);
  assert.throws(()=>c4.validateC4VerifierPromotion({runtimeIdentity:old,
    verifierIdentity:{...old,tree:'e'.repeat(40)},allowedPaths:policy.verifierPromotionPaths}),
    /C4_PROMOTION_TREE/);
});

test('C4 Lab admission rejects unlisted paths and altered code at an observation revision',async()=>{
  const c4=await import('../../scripts/ops/rtk-interop-c4-google-office-batch.mjs');
  const crypto=require('node:crypto');
  const source=Buffer.from('bounded C4 authored scene source');
  const testSource=Buffer.from('bounded C4 authored scene test');
  const sha256=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
  const sourcePath='src/m1-text-single-scene-source-runtime.mjs';
  const testPath='test/m0-audit-repair.test.mjs';
  const policy={allowedLabDeltaPaths:[sourcePath,testPath,'LAB_MANIFEST.json'],
    labCodeBindings:[{path:sourcePath,sha256:sha256(source)},
      {path:testPath,sha256:sha256(testSource)}]};
  const valid={changedPaths:[sourcePath,testPath,'LAB_MANIFEST.json'],
    codeBlobs:{[sourcePath]:source,[testPath]:testSource},policy};
  assert.doesNotThrow(()=>c4.validateC4LabRevision(valid));
  assert.throws(()=>c4.validateC4LabRevision({...valid,
    changedPaths:[...valid.changedPaths,'src/unreviewed-runner.mjs']}),/C4_LAB_CODE_DRIFT/);
  assert.throws(()=>c4.validateC4LabRevision({...valid,
    codeBlobs:{...valid.codeBlobs,[sourcePath]:Buffer.from('altered')}}),/C4_LAB_CODE_PIN/);
  assert.throws(()=>c4.validateC4LabRevision({...valid,
    codeBlobs:{[sourcePath]:source}}),/C4_LAB_CODE_PIN/);
});

test('C4 run selection requires one physical execution per exact profile',async()=>{
  const c4=await import('../../scripts/ops/rtk-interop-c4-google-office-batch.mjs');
  const source='ORDER__SINGLE_SCENE__C4__SOURCE_RUNTIME__run-one';
  const packaged='ORDER__SINGLE_SCENE__C4__PACKAGED_BUILD_RUNTIME__run-two';
  assert.deepEqual(c4.validateC4Runs([source,packaged]).map(row=>row.profile),
    ['SOURCE_RUNTIME','PACKAGED_BUILD_RUNTIME']);
  for(const inputs of [[],[source,source],[packaged,packaged],
    ['TEXT__SINGLE_SCENE__C4__SOURCE_RUNTIME__forged'],
    ['ORDER__SINGLE_SCENE__C5__SOURCE_RUNTIME__wrong-route']])
    assert.throws(()=>c4.validateC4Runs(inputs),/C4_/);
});

test('mixed official aggregate refuses overlap, stale head, false PASS and altered denominator',async()=>{
  const official=await import('../../scripts/ops/rtk-interop-100-denominator-v1.mjs');
  const ids=official.buildRequiredCells(official.readInterop100Denominator(ROOT)).map(c=>c.cellId);
  const head='a'.repeat(40),tree='b'.repeat(40);
  const report=(mode,cellId)=>({ok:true,errors:[],authoritativeAdmission:true,evidenceMode:mode,
    currentHead:head,currentTree:tree,requiredCells:1120,recordedCells:1,passedRequiredCells:1,
    acceptedCellIds:[cellId],statusCounts:{PASS:1,NOT_EXECUTED:1119},broadPassClaim:false,
    cellDecisions:[{cellId,status:'PASS',sourceRunId:'physical-run'}]});
  const word=report('WORD_MANUSCRIPT_COHORTS_V1',ids[0]);
  const google=report('GOOGLE_OFFICE_C4_BATCH_V1','TEXT__SINGLE_SCENE__C4__SOURCE_RUNTIME');
  const check=(w,g,requiredCellIds=ids)=>official.reconcileInteropAggregateReports({
    wordReport:w,googleReport:g,requiredCellIds,currentHead:head,currentTree:tree});
  assert.deepEqual(check(word,google).acceptedCellIds,[ids[0],google.acceptedCellIds[0]].sort());
  for(const bad of [
    {...google,acceptedCellIds:[ids[0]],cellDecisions:[{cellId:ids[0],status:'PASS'}]},
    {...google,currentHead:'c'.repeat(40)},
    {...google,currentTree:'c'.repeat(40)},
    {...google,ok:false},
    {...google,authoritativeAdmission:false},
    {...google,cellDecisions:[{cellId:google.acceptedCellIds[0],status:'FAIL'}]},
    {...google,acceptedCellIds:['UNFROZEN'],cellDecisions:[{cellId:'UNFROZEN',status:'PASS'}]},
    {...google,evidenceMode:'WORD_MANUSCRIPT_BATCH_V1'},
  ]){
    const rejected=check(word,bad);
    assert.equal(rejected.acceptedCellIds.length,0);
    assert.ok(rejected.errors.length>0);
  }
  assert.equal(check(word,google,ids.slice(1)).acceptedCellIds.length,0);
});

test('mixed mode cannot count C4 without the previous authoritative cohorts',async()=>{
  const official=await import('../../scripts/ops/rtk-interop-100-denominator-v1.mjs');
  const report=official.verifyInterop100(ROOT,{googleOfficeCohort:{labRoot:'/missing',runIds:[]}});
  assert.equal(report.authoritativeAdmission,false);
  assert.equal(report.passedRequiredCells,0);
  assert.match(report.errors.join('|'),/INTEROP_MIXED_COHORT_MODE_OPTIONS_CONFLICT/);
});

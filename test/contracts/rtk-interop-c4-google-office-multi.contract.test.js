'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');
const path=require('node:path');
const {spawnSync}=require('node:child_process');

const ROOT=path.resolve(__dirname,'../..');

test('C4 multi raw-oracle counterexamples execute in the required contract lane',()=>{
  const result=spawnSync('python3',['-I','-B',
    'test/unit/rtk-interop-c4-google-office-multi.test.py'],
  {cwd:ROOT,encoding:'utf8',timeout:30000});
  assert.equal(result.status,0,result.stderr||String(result.error));
  assert.match(result.stderr,/Ran 3 tests/);
});

test('C4 multi policy pins only six frozen IDs and verifier-only promotion paths',async()=>{
  const multi=await import('../../scripts/ops/rtk-interop-c4-google-office-multi-batch.mjs');
  const official=await import('../../scripts/ops/rtk-interop-100-denominator-v1.mjs');
  const policy=multi.loadC4MultiPolicy();
  const frozen=new Set(official.buildRequiredCells(
    official.readInterop100Denominator(ROOT)).map(cell=>cell.cellId));
  assert.equal(multi.C4_MULTI_MODE,'GOOGLE_OFFICE_C4_MULTI_BATCH_V1');
  assert.deepEqual(policy.cellIds,multi.C4_MULTI_CELLS);
  assert.equal(policy.cellIds.length,6);
  assert.ok(policy.cellIds.every(id=>frozen.has(id)));
  assert.deepEqual(policy.verifierPromotionPaths,multi.C4_MULTI_PROMOTION_PATHS);
  assert.ok(policy.verifierPromotionPaths.every(file=>!file.startsWith('src/')));
  const reader=fs.readFileSync(path.join(ROOT,policy.readerBinding.path));
  assert.equal(crypto.createHash('sha256').update(reader).digest('hex'),
    policy.readerBinding.sha256);
  assert.deepEqual(multi.validateC4MultiRuns(policy.runBindings.map(row=>row.runId),
    policy).map(row=>row.profile),['SOURCE_RUNTIME','PACKAGED_BUILD_RUNTIME']);
  assert.throws(()=>multi.validateC4MultiRuns([
    policy.runBindings[0].runId,policy.runBindings[0].runId],policy),
  /C4_MULTI_DUPLICATE_PROFILE/);
  assert.throws(()=>multi.validateC4MultiRuns([
    policy.runBindings[0].runId,'ORDER__MULTI_SCENE__C4__PACKAGED_BUILD_RUNTIME__forged'],policy),
  /C4_MULTI_RUN_NOT_PINNED/);
});

test('C4 multi promotion rejects product changes even when mock git reports ancestry',async()=>{
  const multi=await import('../../scripts/ops/rtk-interop-c4-google-office-multi-batch.mjs');
  const old={head:'a'.repeat(40),tree:'b'.repeat(40)};
  const current={head:'c'.repeat(40),tree:'d'.repeat(40)};
  const changed=['scripts/ops/rtk-interop-c4-google-office-multi-readback.py',
    'docs/OPS/RTK/YALKEN_INTEROP_C4_MULTI_POLICY_V1.json'];
  const check=(paths,extra={})=>multi.validateC4MultiPromotion({
    runtimeIdentity:old,verifierIdentity:current,
    allowedPaths:multi.C4_MULTI_PROMOTION_PATHS,
    git:args=>args[0]==='diff'?paths.join('\n'):'',...extra});
  assert.deepEqual(check(changed),changed);
  for(const file of ['src/main.js','package-lock.json',
    'docs/OPS/RTK/YALKEN_INTEROP_100_DENOMINATOR_V1.json'])
    assert.throws(()=>check([...changed,file]),/C4_MULTI_PROMOTION_SCOPE/);
  assert.throws(()=>check([]),/C4_MULTI_PROMOTION_SCOPE/);
  assert.throws(()=>check(changed,{git:args=>{
    if(args[0]==='merge-base')throw new Error('no ancestor');
    return changed.join('\n');
  }}),/C4_MULTI_PROMOTION_NOT_DESCENDANT/);
});

test('official 1120-cell entrypoint does not count conflicted or missing C4 multi input',async()=>{
  const official=await import('../../scripts/ops/rtk-interop-100-denominator-v1.mjs');
  const empty=official.verifyInterop100(ROOT,{googleOfficeMultiCohort:{labRoot:'/missing',
    runIds:[]}});
  assert.equal(empty.authoritativeAdmission,false);
  assert.equal(empty.passedRequiredCells,0);
  const conflict=official.verifyInterop100(ROOT,{googleOfficeMultiCohort:{labRoot:'/missing',
    runIds:[]},googleOfficeCohort:{labRoot:'/missing',runIds:[]}});
  assert.equal(conflict.authoritativeAdmission,false);
  assert.match(conflict.errors.join('|'),/C4_MULTI_COHORT_MODE_OPTIONS_CONFLICT/);
  const mixed=official.verifyInterop100(ROOT,{googleOfficeMultiCohort:{labRoot:'/missing',
    runIds:[]},wordManuscriptCohorts:[]});
  assert.equal(mixed.evidenceMode,'INTEROP_MIXED_COHORTS_V1');
  assert.equal(mixed.authoritativeAdmission,false);
  assert.equal(mixed.passedRequiredCells,0);
  assert.match(mixed.errors.join('|'),/INTEROP_MIXED_WORD_INPUT/);
  assert.doesNotMatch(mixed.errors.join('|'),/C4_MULTI_COHORT_MODE_OPTIONS_CONFLICT/);
});

test('unified aggregate binds C4 multi and Word to one head and rejects fabricated totals',async()=>{
  const official=await import('../../scripts/ops/rtk-interop-100-denominator-v1.mjs');
  const multi=await import('../../scripts/ops/rtk-interop-c4-google-office-multi-batch.mjs');
  const ids=official.buildRequiredCells(official.readInterop100Denominator(ROOT)).map(c=>c.cellId);
  const head='a'.repeat(40),tree='b'.repeat(40);
  const report=(mode,cells)=>({ok:true,errors:[],authoritativeAdmission:true,evidenceMode:mode,
    currentHead:head,currentTree:tree,requiredCells:1120,recordedCells:cells.length,
    passedRequiredCells:cells.length,acceptedCellIds:cells,
    statusCounts:{PASS:cells.length,NOT_EXECUTED:1120-cells.length},broadPassClaim:false,
    cellDecisions:cells.map(cellId=>({cellId,status:'PASS',sourceRunId:'physical-run'}))});
  const word=report('WORD_MANUSCRIPT_COHORTS_V1',['TEXT__MULTI_SCENE__C1__SOURCE_RUNTIME']);
  const google=report(multi.C4_MULTI_MODE,[...multi.C4_MULTI_CELLS]);
  const check=(googleMultiReport,extra={})=>official.reconcileInteropAggregateReports({
    wordReport:word,googleMultiReport,requiredCellIds:ids,currentHead:head,currentTree:tree,...extra});
  const accepted=check(google);
  assert.deepEqual(accepted.errors,[]);
  assert.deepEqual(accepted.acceptedCellIds,[...word.acceptedCellIds,...google.acceptedCellIds].sort());
  for(const bad of [
    {...google,currentHead:'c'.repeat(40)},
    {...google,currentTree:'c'.repeat(40)},
    {...google,evidenceMode:'GOOGLE_OFFICE_C4_BATCH_V1'},
    {...google,ok:false},
    {...google,authoritativeAdmission:false},
    {...google,errors:['RAW_FAILED']},
    {...google,passedRequiredCells:312},
    {...google,requiredCells:6},
    {...google,cellDecisions:google.cellDecisions.map((row,index)=>index?row:{...row,status:'FAIL'})},
    report(multi.C4_MULTI_MODE,[...google.acceptedCellIds,google.acceptedCellIds[0]]),
    report(multi.C4_MULTI_MODE,[...google.acceptedCellIds,word.acceptedCellIds[0]]),
    report(multi.C4_MULTI_MODE,['UNFROZEN']),
  ]){
    const rejected=check(bad);
    assert.deepEqual(rejected.acceptedCellIds,[]);
    assert.ok(rejected.errors.length);
  }
  assert.deepEqual(check(google,{googleReport:google}).acceptedCellIds,[]);
  assert.deepEqual(check(google,{wordReport:null}).acceptedCellIds,[]);
});

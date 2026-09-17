const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const {spawnSync}=require('node:child_process');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'../..');
const load=()=>import(pathToFileURL(path.join(root,'scripts/ops/rtk-interop-word-text-order-batch.mjs')).href);
const run='ORDER__SINGLE_SCENE__C2__SOURCE_RUNTIME__contract';

test('Word batch supports exactly thirty-two frozen cells and all six C2 hops',async()=>{
  const m=await load();
  const d=await import(pathToFileURL(path.join(root,'scripts/ops/rtk-interop-100-denominator-v1.mjs')).href);
  const cells=d.buildRequiredCells(d.readInterop100Denominator(root));
  assert.equal(cells.length,1120);assert.equal(m.WORD_BATCH_CELLS.length,32);
  assert.equal(new Set(m.WORD_BATCH_CELLS).size,32);
  for(const cellId of m.WORD_BATCH_CELLS)assert.ok(cells.some(c=>c.cellId===cellId));
  assert.deepEqual(m.WORD_BATCH_HOPS.C2,['YALKEN_EXPORT','WORD_LIFECYCLE','YALKEN_RETURN_INTAKE','YALKEN_APPLY','YALKEN_REEXPORT','WORD_REOPEN_READBACK']);
});
test('one to sixteen named journeys are allowed, repetitions cannot grow credit',async()=>{
  const {validateWordBatchRuns}=await load();
  assert.equal(validateWordBatchRuns([run]).length,1);
  assert.throws(()=>validateWordBatchRuns([run,run.replace('contract','repeat')]),/DUPLICATE_JOURNEY/);
  for(const value of [[],[null],[run.replace('ORDER','TEXT')],[run.replace('C2','C4')],
    [run.replace('SOURCE_RUNTIME','UNIT_RUNTIME')],[run+'../escape'],Array(5).fill(run),'latest']){
    assert.throws(()=>validateWordBatchRuns(value),/WORD_BATCH_/);
  }
});
test('exact observation selection rejects duplicate, invalidated and superseded artifacts',async()=>{
  const {validateWordBatchRuns,selectWordBatchObservation}=await load();
  const row=validateWordBatchRuns([run])[0];
  const e={type:'PHYSICAL_OBSERVATION',runId:run,cellId:row.cellId,artifactHash:'a'.repeat(64)};
  assert.equal(selectWordBatchObservation([e],row),e);
  for(const ledger of [[],[e,e],[{...e,cellId:'wrong'}],[e,{runId:run,stale:true}],
    [e,{runId:run,type:'PRIVACY_INVALIDATED'}],[e,{type:'EVIDENCE_SUPERSEDES',supersedesRunId:run}],
    [e,{type:'AUDIT_INVALIDATED_PHYSICAL_OBSERVATION',artifactHash:e.artifactHash}]]){
    assert.throws(()=>selectWordBatchObservation(ledger,row),/WORD_BATCH_(EXACT_OBSERVATION|INVALIDATED)/);
  }
});
test('independent C2 checker executes positive and coherently rebound negative controls',()=>{
  const child=spawnSync('python3',['-I','-B','test/unit/rtk-interop-c2-final-hops.test.py'],{cwd:root,encoding:'utf8',timeout:30000});
  assert.equal(child.status,0,child.stdout+child.stderr);
  assert.match(child.stderr,/Ran [1-9][0-9]* tests/);assert.match(child.stderr,/\nOK\n/);
});
test('raw reader has no external execution or product parser imports',()=>{
  const s=fs.readFileSync(path.join(root,'scripts/ops/rtk-interop-word-text-order-readback.py'),'utf8');
  assert.doesNotMatch(s,/import (?:subprocess|requests)|from (?:subprocess|requests)|src\/io|verify_text_artifacts/);
  assert.match(s,/order\.checked_read/);
});
test('candidate and caller-authored proof cannot enter official batch through mixed modes',async()=>{
  const {verifyInterop100,readInterop100Denominator}=await import(pathToFileURL(path.join(root,'scripts/ops/rtk-interop-100-denominator-v1.mjs')).href);
  for(const extra of [{spec:readInterop100Denominator(root)},{envelope:{}},{ledger:[]},{dataC1RunId:run},
    {orderRunId:run},{textOrderRunId:run},{freshC1EvidenceRoot:root},{requireExternalEvidencePackage:true},{requireLocalPhysicalPackage:true}]){
    const result=verifyInterop100(root,{wordTextOrderLabRoot:root,wordTextOrderRunIds:[run],...extra});
    assert.equal(result.passedRequiredCells,0);assert.equal(result.authoritativeAdmission,false);
    assert.ok(result.errors.includes('WORD_TEXT_ORDER_MODE_OPTIONS_CONFLICT'));
  }
});

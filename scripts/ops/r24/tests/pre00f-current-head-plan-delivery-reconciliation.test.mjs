import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import { canonicalBytes } from '../corrective/canonical-json.mjs';
import {
  PRE00F_CURRENT_HEAD_PLAN_DELIVERY_RECONCILIATION_EXPECTATION,
  verifyPre00fCurrentHeadPlanDeliveryReconciliation,
} from '../corrective/pre00f-current-head-plan-delivery-reconciliation.mjs';

const objectFromCommit=(sha,repoPath)=>execFileSync('git',['show',`${sha}:${repoPath}`],{maxBuffer:64*1024*1024});
function resolveFixtureCandidateSha(){
  const e=PRE00F_CURRENT_HEAD_PLAN_DELIVERY_RECONCILIATION_EXPECTATION;
  const candidates=String(execFileSync('git',['rev-list','--reverse',`${e.baseSha}..HEAD`],{encoding:'utf8'})).trim().split('\n').filter(Boolean);
  for(const sha of candidates){
    const changed=String(execFileSync('git',['diff','--name-only',`${e.baseSha}..${sha}`],{encoding:'utf8'})).trim().split('\n').filter(Boolean).sort();
    if(JSON.stringify(changed)===JSON.stringify(e.admittedPaths))return sha;
  }
  throw new Error('PRE00F_CURRENT_HEAD_FIXTURE_CANDIDATE_NOT_FOUND');
}

function currentHeadFixture({changedPaths,baseTree,currentTree,statusBytes,evidenceBytes,historicalAncestor=true,baseAncestor=true}={}){
  const e=PRE00F_CURRENT_HEAD_PLAN_DELIVERY_RECONCILIATION_EXPECTATION,candidateSha='3'.repeat(40),candidateTree=currentTree??'4'.repeat(40);
  const fixtureCandidateSha=resolveFixtureCandidateSha();
  const boundBytes=(repoPath)=>objectFromCommit(fixtureCandidateSha,repoPath);
  const bytesByPath=new Map([
    [e.planPath,boundBytes(e.planPath)],
    [e.inventoryPath,boundBytes(e.inventoryPath)],
    [e.statusPath,statusBytes??boundBytes(e.statusPath)],
    [e.evidencePath,evidenceBytes??boundBytes(e.evidencePath)],
    [e.approvalsPath,boundBytes(e.approvalsPath)],
    [e.verifierPath,boundBytes(e.verifierPath)],
    [e.contractTestPath,boundBytes(e.contractTestPath)],
    [e.postAuditVerifierPath,boundBytes(e.postAuditVerifierPath)],
    [e.postAuditTestPath,boundBytes(e.postAuditTestPath)],
  ]);
  return{candidateSha,git:(args,options={})=>{
    let value='';
    if(args[0]==='rev-parse'&&args[1]===candidateSha)value=candidateSha;
    else if(args[0]==='rev-parse'&&args[1]===`${e.baseSha}^{tree}`)value=baseTree??e.baseTree;
    else if(args[0]==='rev-parse'&&args[1]===`${e.historicalDeliverySha}^{tree}`)value=e.historicalDeliveryTree;
    else if(args[0]==='rev-parse'&&args[1]===`${candidateSha}^{tree}`)value=candidateTree;
    else if(args[0]==='merge-base'){
      if(args[2]===e.historicalDeliverySha&&args[3]===e.baseSha&&!historicalAncestor)throw new Error('NOT_ANCESTOR:HISTORICAL_PRE00F');
      if(args[2]===e.baseSha&&args[3]===candidateSha&&!baseAncestor)throw new Error('NOT_ANCESTOR:CURRENT_BASE');
      value='';
    }else if(args[0]==='diff')value=`${(changedPaths??e.admittedPaths).join('\n')}\n`;
    else if(args[0]==='show'){
      const spec=String(args[1]),separator=spec.indexOf(':'),objectish=spec.slice(0,separator),repoPath=spec.slice(separator+1);
      if(objectish===candidateSha&&bytesByPath.has(repoPath)){
        const bytes=bytesByPath.get(repoPath);
        return options.encoding==='utf8'?bytes.toString('utf8'):Buffer.from(bytes);
      }
      return execFileSync('git',args,options);
    }else return execFileSync('git',args,options);
    return options.encoding==='utf8'?`${value}\n`:Buffer.from(`${value}\n`);
  }};
}

test('PRE00F current-head plan delivery reconciliation accepts the exact current delta',()=>{
  const fixture=currentHeadFixture();
  const result=verifyPre00fCurrentHeadPlanDeliveryReconciliation({candidateSha:fixture.candidateSha,git:fixture.git});
  assert.equal(result.status,'PASS');
  assert.equal(result.baseSha,PRE00F_CURRENT_HEAD_PLAN_DELIVERY_RECONCILIATION_EXPECTATION.baseSha);
  assert.equal(result.candidateSha,fixture.candidateSha);
  assert.equal(result.historicalDeliverySha,PRE00F_CURRENT_HEAD_PLAN_DELIVERY_RECONCILIATION_EXPECTATION.historicalDeliverySha);
  assert.equal(result.admittedPathDenominator,PRE00F_CURRENT_HEAD_PLAN_DELIVERY_RECONCILIATION_EXPECTATION.admittedPaths.length);
  assert.equal(result.changedPathDenominator,PRE00F_CURRENT_HEAD_PLAN_DELIVERY_RECONCILIATION_EXPECTATION.admittedPaths.length);
  assert.equal(result.programDone,false);
  assert.equal(result.productionReleaseReady,false);
  assert.equal(result.graphIncrement,0);
  assert.equal(result.nextStep,'R24-RCV-00A');
});

test('PRE00F current-head plan delivery reconciliation rejects a wrong current base tree',()=>{
  const fixture=currentHeadFixture({baseTree:'0'.repeat(40)});
  assert.throws(()=>verifyPre00fCurrentHeadPlanDeliveryReconciliation({candidateSha:fixture.candidateSha,git:fixture.git}),/E_PRE00F_CURRENT_BASE_TREE_DRIFT/);
});

test('PRE00F current-head plan delivery reconciliation rejects a missing historical PRE00F ancestor',()=>{
  const fixture=currentHeadFixture({historicalAncestor:false});
  assert.throws(()=>verifyPre00fCurrentHeadPlanDeliveryReconciliation({candidateSha:fixture.candidateSha,git:fixture.git}),/E_PRE00F_CURRENT_HISTORICAL_DELIVERY_NOT_ANCESTOR/);
});

test('PRE00F current-head plan delivery reconciliation rejects an unadmitted current path',()=>{
  const e=PRE00F_CURRENT_HEAD_PLAN_DELIVERY_RECONCILIATION_EXPECTATION,fixture=currentHeadFixture({changedPaths:[...e.admittedPaths,'package.json'].sort()});
  assert.throws(()=>verifyPre00fCurrentHeadPlanDeliveryReconciliation({candidateSha:fixture.candidateSha,git:fixture.git}),/E_PRE00F_CURRENT_EXACT_ADMITTED_DELTA/);
});

test('PRE00F current-head plan delivery reconciliation rejects a mutated status rebind',()=>{
  const e=PRE00F_CURRENT_HEAD_PLAN_DELIVERY_RECONCILIATION_EXPECTATION,status=JSON.parse(objectFromCommit(resolveFixtureCandidateSha(),e.statusPath).toString('utf8'));
  status.rebinding.authoringBaseSha='0'.repeat(40);
  const fixture=currentHeadFixture({statusBytes:canonicalBytes(status)});
  assert.throws(()=>verifyPre00fCurrentHeadPlanDeliveryReconciliation({candidateSha:fixture.candidateSha,git:fixture.git}),/E_PRE00F_CURRENT_STATUS_REBINDING/);
});

test('PRE00F current-head plan delivery reconciliation rejects a stale evidence head binding',()=>{
  const e=PRE00F_CURRENT_HEAD_PLAN_DELIVERY_RECONCILIATION_EXPECTATION,evidence=JSON.parse(objectFromCommit(resolveFixtureCandidateSha(),e.evidencePath).toString('utf8'));
  evidence.headSha='0'.repeat(40);
  const fixture=currentHeadFixture({evidenceBytes:canonicalBytes(evidence)});
  assert.throws(()=>verifyPre00fCurrentHeadPlanDeliveryReconciliation({candidateSha:fixture.candidateSha,git:fixture.git}),/E_PRE00F_CURRENT_EVIDENCE_HEAD_BINDING/);
});

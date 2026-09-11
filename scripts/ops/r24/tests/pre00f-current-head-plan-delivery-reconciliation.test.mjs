import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { canonicalBytes } from '../corrective/canonical-json.mjs';
import {
  PRE00F_CURRENT_HEAD_PLAN_DELIVERY_RECONCILIATION_EXPECTATION,
  verifyPre00fCurrentHeadPlanDeliveryReconciliation,
} from '../corrective/pre00f-current-head-plan-delivery-reconciliation.mjs';
import {
  R24_RCV00B_SUCCESSOR_ADMISSION_REGISTRY_EXPECTATION,
  verifyR24Rcv00bSuccessorAdmissionsPostEvaluationException,
} from '../corrective/post-audit-certification-set.mjs';

const TEST_DIR=path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT=path.resolve(TEST_DIR,'..','..','..','..');
const readRepo=(repoPath,encoding)=>fs.readFileSync(path.join(REPO_ROOT,repoPath),encoding);

function currentHeadFixture({changedPaths,baseTree,currentTree,statusBytes,evidenceBytes,historicalAncestor=true,baseAncestor=true}={}){
  const e=PRE00F_CURRENT_HEAD_PLAN_DELIVERY_RECONCILIATION_EXPECTATION,candidateSha='3'.repeat(40),candidateTree=currentTree??'4'.repeat(40);
  const bytesByPath=new Map([
    [e.planPath,readRepo(e.planPath)],
    [e.inventoryPath,readRepo(e.inventoryPath)],
    [e.statusPath,statusBytes??readRepo(e.statusPath)],
    [e.evidencePath,evidenceBytes??readRepo(e.evidencePath)],
    [e.approvalsPath,readRepo(e.approvalsPath)],
    [e.verifierPath,readRepo(e.verifierPath)],
    [e.contractTestPath,readRepo(e.contractTestPath)],
    [e.postAuditVerifierPath,readRepo(e.postAuditVerifierPath)],
    [e.postAuditTestPath,readRepo(e.postAuditTestPath)],
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
  const e=PRE00F_CURRENT_HEAD_PLAN_DELIVERY_RECONCILIATION_EXPECTATION,status=JSON.parse(readRepo(e.statusPath,'utf8'));
  status.rebinding.authoringBaseSha='0'.repeat(40);
  const fixture=currentHeadFixture({statusBytes:canonicalBytes(status)});
  assert.throws(()=>verifyPre00fCurrentHeadPlanDeliveryReconciliation({candidateSha:fixture.candidateSha,git:fixture.git}),/E_PRE00F_CURRENT_STATUS_REBINDING/);
});

test('PRE00F current-head plan delivery reconciliation rejects a stale evidence head binding',()=>{
  const e=PRE00F_CURRENT_HEAD_PLAN_DELIVERY_RECONCILIATION_EXPECTATION,evidence=JSON.parse(readRepo(e.evidencePath,'utf8'));
  evidence.headSha='0'.repeat(40);
  const fixture=currentHeadFixture({evidenceBytes:canonicalBytes(evidence)});
  assert.throws(()=>verifyPre00fCurrentHeadPlanDeliveryReconciliation({candidateSha:fixture.candidateSha,git:fixture.git}),/E_PRE00F_CURRENT_EVIDENCE_HEAD_BINDING/);
});

test('RCV00B successor verifier accepts exact current head and reports later contours separately',()=>{
  const result=verifyR24Rcv00bSuccessorAdmissionsPostEvaluationException({candidateSha:'HEAD'});
  assert.equal(result.status,'PASS');
  assert.equal(result.baseSha,R24_RCV00B_SUCCESSOR_ADMISSION_REGISTRY_EXPECTATION.baseSha);
  assert.equal(result.predecessorAdmittedPathDenominator,19);
  assert.equal(result.admittedPathDenominator,12);
  assert(result.changedPathDenominator<result.admittedPathDenominator);
  assert(result.laterContourPathDenominator>0);
  assert(result.laterContourPaths.includes('docs/OPS/GOVERNANCE_APPROVALS/GOVERNANCE_CHANGE_APPROVALS.json'));
  assert(result.laterContourPaths.includes('scripts/ops/r24/corrective/post-audit-certification-set.mjs'));
  assert(result.laterContourPaths.includes('src/export/docx/docxMinBuilder.js'));
});

test('RCV00B successor verifier treats the exact current SHA as current head evidence',()=>{
  const headSha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
  const result=verifyR24Rcv00bSuccessorAdmissionsPostEvaluationException({candidateSha:headSha});
  assert.equal(result.status,'PASS');
  assert.equal(result.candidateSha,headSha);
  assert(result.laterContourPathDenominator>0);
});

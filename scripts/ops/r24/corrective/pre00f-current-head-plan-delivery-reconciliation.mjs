#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

export const PRE00F_CURRENT_HEAD_PLAN_DELIVERY_RECONCILIATION_EXPECTATION=Object.freeze({
  baseSha:'87072a10c690b99ffb25f20516ebfd410377e2fb',
  baseTree:'3c5943055c95b20598125ca8020a917d37516250',
  historicalDeliverySha:'31d27ce0f8ef7e4e4b6f2fee33382612f07a2e18',
  historicalDeliveryTree:'4e3947455f98d19bed8aaf1687bfdcaf9a21e83b',
  approvedBy:'OWNER_CHAT_DIRECT_R24_PRE00F_CURRENT_HEAD_PLAN_DELIVERY_RECONCILIATION_AFTER_W0_2026_09_11',
  evidenceStampId:'ES-R24-PRE00F-CURRENT-HEAD-PLAN-DELIVERY-RECONCILIATION',
  planPath:'docs/tasks/2026-09-08--r24-consolidated-remediation-and-completion-plan.md',
  approvalsPath:'docs/OPS/R24/CORRECTIVE/PK1R1_GOVERNANCE_CHANGE_APPROVALS_V1.json',
  inventoryPath:'docs/OPS/R24/CORRECTIVE/C1B_TEST_INVENTORY_V1.json',
  statusPath:'docs/OPS/R24/CORRECTIVE/PRE00F_CURRENT_HEAD_PLAN_DELIVERY_RECONCILIATION_STATUS_V1.json',
  evidencePath:'docs/OPS/R24/EVIDENCE/ES-R24-PRE00F-CURRENT-HEAD-PLAN-DELIVERY-RECONCILIATION.json',
  verifierPath:'scripts/ops/r24/corrective/pre00f-current-head-plan-delivery-reconciliation.mjs',
  contractTestPath:'scripts/ops/r24/tests/pre00f-current-head-plan-delivery-reconciliation.test.mjs',
  postAuditVerifierPath:'scripts/ops/r24/corrective/post-audit-certification-set.mjs',
  postAuditTestPath:'test/contracts/r24-post-audit-certification-set.contract.test.mjs',
  admittedPaths:[
    'docs/OPS/R24/CORRECTIVE/PK1R1_GOVERNANCE_CHANGE_APPROVALS_V1.json',
    'docs/OPS/R24/CORRECTIVE/C1B_TEST_INVENTORY_V1.json',
    'docs/OPS/R24/CORRECTIVE/PRE00F_CURRENT_HEAD_PLAN_DELIVERY_RECONCILIATION_STATUS_V1.json',
    'docs/OPS/R24/EVIDENCE/ES-R24-PRE00F-CURRENT-HEAD-PLAN-DELIVERY-RECONCILIATION.json',
    'scripts/ops/r24/corrective/post-audit-certification-set.mjs',
    'scripts/ops/r24/corrective/pre00f-current-head-plan-delivery-reconciliation.mjs',
    'scripts/ops/r24/tests/pre00f-current-head-plan-delivery-reconciliation.test.mjs',
    'test/contracts/r24-post-audit-certification-set.contract.test.mjs',
  ].sort(),
});

const h=(bytes)=>crypto.createHash('sha256').update(bytes).digest('hex');
const fail=(code,detail='')=>{const error=new Error(detail?`${code}:${detail}`:code);error.code=code;throw error;};
const assert=(condition,code,detail='')=>{if(!condition)fail(code,detail);};
const defaultGit=(args,options={})=>execFileSync('git',args,{...options,maxBuffer:64*1024*1024});
const gitText=(git,args)=>String(git(args,{encoding:'utf8'})).trim();
const objectBytes=(git,sha,repoPath)=>git(['show',`${sha}:${repoPath}`]);
const evaluationTree=(git,sha)=>gitText(git,['rev-parse',`${sha}^{tree}`]);
const approvalMatchesApprovedBy=(entry,approvedBy)=>entry?.approvedBy===approvedBy||String(entry?.approvedBy??'').includes(approvedBy);

export function verifyPre00fCurrentHeadPlanDeliveryReconciliation({candidateSha='HEAD',git=defaultGit}={}){
  const e=PRE00F_CURRENT_HEAD_PLAN_DELIVERY_RECONCILIATION_EXPECTATION;
  const resolvedCandidate=gitText(git,['rev-parse',candidateSha]);
  assert(evaluationTree(git,e.baseSha)===e.baseTree,'E_PRE00F_CURRENT_BASE_TREE_DRIFT');
  assert(evaluationTree(git,e.historicalDeliverySha)===e.historicalDeliveryTree,'E_PRE00F_CURRENT_HISTORICAL_DELIVERY_TREE_DRIFT');
  try{git(['merge-base','--is-ancestor',e.historicalDeliverySha,e.baseSha],{encoding:null});}catch{fail('E_PRE00F_CURRENT_HISTORICAL_DELIVERY_NOT_ANCESTOR');}
  try{git(['merge-base','--is-ancestor',e.baseSha,resolvedCandidate],{encoding:null});}catch{fail('E_PRE00F_CURRENT_BASE_NOT_ANCESTOR');}
  const changed=gitText(git,['diff','--name-only',`${e.baseSha}..${resolvedCandidate}`]).split('\n').filter(Boolean).sort();
  assert(JSON.stringify(changed)===JSON.stringify(e.admittedPaths),'E_PRE00F_CURRENT_EXACT_ADMITTED_DELTA',`${changed.length}:${e.admittedPaths.length}`);
  const readText=(repoPath)=>{let bytes;try{bytes=objectBytes(git,resolvedCandidate,repoPath);}catch{fail('E_PRE00F_CURRENT_ARTIFACT_MISSING',repoPath);}assert(bytes.at(-1)===0x0a,'E_PRE00F_CURRENT_CANONICAL_LF',repoPath);return{bytes,text:bytes.toString('utf8'),digest:h(bytes)};};
  const readJson=(repoPath)=>{const file=readText(repoPath);return{...file,value:JSON.parse(file.text)};};
  const plan=readText(e.planPath),inventory=readJson(e.inventoryPath),status=readJson(e.statusPath),evidence=readJson(e.evidencePath),approvals=readJson(e.approvalsPath),verifier=readText(e.verifierPath),contractTest=readText(e.contractTestPath),postAuditVerifier=readText(e.postAuditVerifierPath),postAuditTest=readText(e.postAuditTestPath);
  for(const token of [
    'STATUS: FRESH_PRE00F_PLAN_DELIVERY_CANDIDATE_AFTER_PRE00E_CLOSURE',
    'AUTHORING_BASE_SHA: 6e9be072a12ff3bd5cc1608da153caf13c5e94c2',
    'PROGRAM_OBSERVATION_BASE_SHA: 6e9be072a12ff3bd5cc1608da153caf13c5e94c2',
    'PROGRAM_OBSERVATION_BASE_TREE: e442f006f5c5b8229d51df9b8f1fff5c68803aab',
    'CURRENT_PROGRAM_DONE: false',
    'CURRENT_PRODUCTION_RELEASE_READY: false',
    'NEXT_STEP: R24-RCV-00A',
    'W7/C1-C8 full-book portability route matrix',
    'NOT_PROVEN_NO_PASS_PROMOTION',
  ])assert(plan.text.includes(token),'E_PRE00F_CURRENT_PLAN_PRESERVATION_TOKEN',token);
  assert(status.value.schemaVersion==='PRE00F_CURRENT_HEAD_PLAN_DELIVERY_RECONCILIATION_STATUS_V1'&&status.value.contourId==='PRE00F_CURRENT_HEAD_PLAN_DELIVERY_RECONCILIATION'&&status.value.taskId==='R24_PRE00F_CURRENT_HEAD_PLAN_DELIVERY_RECONCILIATION_20260911','E_PRE00F_CURRENT_STATUS_SHAPE');
  assert(status.value.baseSha===e.baseSha&&status.value.baseTree===e.baseTree&&status.value.historicalPre00fDeliverySha===e.historicalDeliverySha&&status.value.historicalPre00fDeliveryTree===e.historicalDeliveryTree,'E_PRE00F_CURRENT_STATUS_IDENTITY');
  assert(status.value.planPath===e.planPath&&status.value.nextStep==='R24-RCV-00A'&&status.value.rebinding?.authoringBaseSha===e.baseSha&&status.value.rebinding?.programObservationBaseSha===e.baseSha&&status.value.rebinding?.programObservationBaseTree===e.baseTree,'E_PRE00F_CURRENT_STATUS_REBINDING');
  const nonClaims=new Set(status.value.nonClaims??[]);
  for(const token of ['NO_PROGRAM_DONE','NO_PRODUCTION_RELEASE_READY','NO_GRAPH_INCREMENT','NO_PK1_RELEASE_SECURITY_PHYSICAL','NO_V3_PACKAGE_CLAIM_COMPILER','NO_WP900_PLAN_DELIVERY','NO_RUNTIME_UI_CORE_MUTATION','NO_DEPENDENCY_CHANGE','NO_NETWORK_OR_CLOUD_TRUTH','NO_HISTORICAL_PRE00F_REWRITE'])assert(nonClaims.has(token),'E_PRE00F_CURRENT_STATUS_NONCLAIMS',token);
  assert(evidence.value.schemaVersion==='ClaimBindingV1'&&evidence.value.stampId===e.evidenceStampId&&evidence.value.contourId==='PRE00F_CURRENT_HEAD_PLAN_DELIVERY_RECONCILIATION'&&evidence.value.evidenceClass==='CONTRACT'&&evidence.value.verdict==='PASS'&&evidence.value.oracle==='PRE00F_CURRENT_HEAD_PLAN_DELIVERY_RECONCILIATION_WITH_IMMUTABLE_HISTORICAL_DELIVERY','E_PRE00F_CURRENT_EVIDENCE_SHAPE');
  assert(evidence.value.headSha===e.baseSha&&evidence.value.originMainSha===e.baseSha,'E_PRE00F_CURRENT_EVIDENCE_HEAD_BINDING');
  const claimBindingMap=new Map((evidence.value.claimBindings??[]).map((binding)=>[binding.filePath,binding]));
  const inventoryBinding=claimBindingMap.get(e.inventoryPath);
  const statusBinding=claimBindingMap.get(e.statusPath);
  assert(inventoryBinding?.sha256===inventory.digest&&inventoryBinding.claimTerms?.includes('PASS'),'E_PRE00F_CURRENT_INVENTORY_BINDING_DIGEST');
  assert(statusBinding?.sha256===status.digest&&statusBinding.claimTerms?.includes('PASS'),'E_PRE00F_CURRENT_CLAIM_BINDING_DIGEST');
  const implementationDigestMap=new Map((evidence.value.implementationArtifactDigests??[]).map((entry)=>[entry.path,entry]));
  assert(inventory.value.schemaVersion==='R24_C1B_TEST_INVENTORY_V1'&&inventory.value.totals?.requiredSkips===0&&inventory.value.totals?.unexplainedSkips===0,'E_PRE00F_CURRENT_INVENTORY_SHAPE');
  const inventoryEntry=inventory.value.entries.find((entry)=>entry.path===e.postAuditTestPath);
  assert(inventoryEntry?.sha256===postAuditTest.digest,'E_PRE00F_CURRENT_INVENTORY_TEST_DIGEST');
  for(const [relative,digest] of [[e.planPath,plan.digest],[e.inventoryPath,inventory.digest],[e.statusPath,status.digest],[e.verifierPath,verifier.digest],[e.contractTestPath,contractTest.digest],[e.postAuditVerifierPath,postAuditVerifier.digest],[e.postAuditTestPath,postAuditTest.digest]]){const artifact=implementationDigestMap.get(relative);assert(artifact?.sha256===digest,'E_PRE00F_CURRENT_IMPLEMENTATION_DIGEST',relative);}
  assert(approvals.value.version==='v1.0'&&Array.isArray(approvals.value.approvals)&&approvals.value.evidenceStampIds?.includes(e.evidenceStampId),'E_PRE00F_CURRENT_APPROVALS_SHAPE');
  const approvalMap=new Map(approvals.value.approvals.map((entry)=>[`${entry.filePath}\0${entry.sha256}`,entry]));
  for(const relative of [e.inventoryPath,e.statusPath,e.evidencePath,e.verifierPath,e.contractTestPath,e.postAuditVerifierPath,e.postAuditTestPath]){
    const digest=h(objectBytes(git,resolvedCandidate,relative));
    const approval=approvalMap.get(`${relative}\0${digest}`);
    assert(approval?.approved===true&&approvalMatchesApprovedBy(approval,e.approvedBy)&&approval.evidenceStampIds?.includes(e.evidenceStampId),'E_PRE00F_CURRENT_APPROVAL_DIGEST',relative);
  }
  for(const token of ['PRE00F_CURRENT_HEAD_PLAN_DELIVERY_RECONCILIATION_EXPECTATION','verifyPre00fCurrentHeadPlanDeliveryReconciliation','E_PRE00F_CURRENT_EXACT_ADMITTED_DELTA'])assert(verifier.text.includes(token),'E_PRE00F_CURRENT_VERIFIER_TOKEN',token);
  for(const token of ['PRE00F current-head plan delivery reconciliation accepts the exact current delta','PRE00F current-head plan delivery reconciliation rejects a mutated status rebind','PRE00F current-head plan delivery reconciliation rejects a stale evidence head binding'])assert(contractTest.text.includes(token),'E_PRE00F_CURRENT_TEST_TOKEN',token);
  for(const token of ['pre00fCurrentHeadPlanDeliveryReconciliationPostEvaluationException','verifyPre00fCurrentHeadPlanDeliveryReconciliation'])assert(postAuditVerifier.text.includes(token),'E_PRE00F_CURRENT_POST_AUDIT_VERIFIER_TOKEN',token);
  for(const token of ['PRE00F current-head reconciliation is admitted as a post-evaluation exception','pre00fCurrentHeadPlanDeliveryReconciliationPostEvaluationException'])assert(postAuditTest.text.includes(token),'E_PRE00F_CURRENT_POST_AUDIT_TEST_TOKEN',token);
  return{schemaVersion:'PRE00F_CURRENT_HEAD_PLAN_DELIVERY_RECONCILIATION_VERIFICATION_V1',status:'PASS',baseSha:e.baseSha,baseTree:e.baseTree,candidateSha:resolvedCandidate,candidateTree:evaluationTree(git,resolvedCandidate),historicalDeliverySha:e.historicalDeliverySha,historicalDeliveryTree:e.historicalDeliveryTree,admittedPathDenominator:e.admittedPaths.length,changedPathDenominator:changed.length,admittedPaths:e.admittedPaths,changedPaths:changed,planDigest:plan.digest,inventoryDigest:inventory.digest,statusDigest:status.digest,evidenceDigest:evidence.digest,verifierDigest:verifier.digest,contractTestDigest:contractTest.digest,postAuditVerifierDigest:postAuditVerifier.digest,postAuditTestDigest:postAuditTest.digest,programDone:false,productionReleaseReady:false,graphIncrement:0,nextStep:'R24-RCV-00A'};
}

if(import.meta.url===`file://${process.argv[1]}`){
  const result=verifyPre00fCurrentHeadPlanDeliveryReconciliation({candidateSha:process.argv[2]??'HEAD'});
  process.stdout.write(`${JSON.stringify(result,null,2)}\n`);
}

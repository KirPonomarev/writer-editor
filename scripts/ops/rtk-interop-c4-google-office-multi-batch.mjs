import fs from 'node:fs';
import path from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {performance} from 'node:perf_hooks';
import {hashOrderObservation,readOrderFile,stableOrderJson} from './rtk-interop-order-c1.mjs';
import {hash} from './rtk-interop-data-c1.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const POLICY_PATH='docs/OPS/RTK/YALKEN_INTEROP_C4_MULTI_POLICY_V1.json';
const SPEC_PATH='docs/OPS/RTK/YALKEN_INTEROP_100_DENOMINATOR_V1.json';
export const C4_MULTI_MODE='GOOGLE_OFFICE_C4_MULTI_BATCH_V1';
export const C4_MULTI_CELLS=Object.freeze(['SOURCE_RUNTIME','PACKAGED_BUILD_RUNTIME'].flatMap(
  profile=>['TEXT','ORDER','NOVEL_SCENE_STRUCTURE'].map(field=>
    `${field}__MULTI_SCENE__C4__${profile}`)));
export const C4_MULTI_PROMOTION_PATHS=Object.freeze([
  'docs/OPS/RTK/YALKEN_INTEROP_C4_MULTI_POLICY_V1.json',
  'scripts/ops/rtk-interop-c4-google-office-multi-readback.py',
  'scripts/ops/rtk-interop-c4-google-office-multi-batch.mjs',
  'scripts/ops/rtk-interop-100-denominator-v1.mjs',
  'docs/OPS/RTK/YALKEN_INTEROP_DATA_C1_POLICY_V1.json',
  'scripts/ops/rtk-interop-data-c1.mjs',
  'test/unit/rtk-interop-c4-google-office-multi.test.py',
  'test/contracts/rtk-interop-c4-google-office-multi.contract.test.js',
  'test/contracts/rtk-interop-100-denominator.contract.test.js',
  'docs/OPS/RTK/RTK_TEST_GRAPH_CATALOG_V1.json',
  'docs/OPS/R24/CORRECTIVE/C1B_TEST_INVENTORY_V1.json',
  'docs/OPS/R24/CORRECTIVE/C2A_GOVERNANCE_CHANGE_APPROVALS_V1.json',
  'docs/OPS/RTK/YALKEN_INTEROP_100_GOVERNANCE_CHANGE_APPROVALS_V1.json',
  'scripts/ops/r24/corrective/post-audit-certification-set.mjs',
  'docs/tasks/2026-09-24--c4-google-office-multiscene-admission.md',
]);
export const C4_MULTI_POLICY_SHA256='eb9cabec39d6fa3518ba57a87423a735198f811c3e19f6e1c33e5ab3e2afc27f';
const READBACK='scripts/ops/rtk-interop-c4-google-office-multi-readback.py';
const sha40=value=>typeof value==='string'&&/^[a-f0-9]{40}$/u.test(value);
const sha64=value=>typeof value==='string'&&/^[a-f0-9]{64}$/u.test(value);
const same=(a,b)=>stableOrderJson(a)===stableOrderJson(b);
const demand=(ok,code)=>{if(!ok)throw new Error(code);};
const gitAt=root=>args=>execFileSync('git',args,
  {cwd:root,encoding:'utf8',timeout:10000,maxBuffer:16*1024*1024});
const json=(root,file,max)=>JSON.parse(readOrderFile(root,file,max).bytes);

function clean(root){
  const git=gitAt(root);
  demand(!git(['status','--porcelain=v1','--untracked-files=all']).trim(),'C4_MULTI_DIRTY_CHECKOUT');
  const [head,tree]=git(['rev-parse','HEAD','HEAD^{tree}']).trim().split('\n');
  demand(sha40(head)&&sha40(tree),'C4_MULTI_GIT_IDENTITY');
  return {head,tree};
}

export function loadC4MultiPolicy(){
  const bytes=readOrderFile(ROOT,POLICY_PATH).bytes;
  demand(hash(bytes)===C4_MULTI_POLICY_SHA256,'C4_MULTI_POLICY_PIN');
  const policy=JSON.parse(bytes);
  demand(policy.schemaVersion==='YALKEN_INTEROP_C4_MULTI_POLICY_V1'
    &&policy.evidenceMode===C4_MULTI_MODE
    &&same(policy.cellIds,C4_MULTI_CELLS)
    &&same(policy.requiredHops,['YALKEN_DOCX_EXPORT','GOOGLE_OFFICE_LIFECYCLE','YALKEN_RETURN_INTAKE'])
    &&same(policy.verifierPromotionPaths,C4_MULTI_PROMOTION_PATHS)
    &&policy.productSpecSha256===hash(readOrderFile(ROOT,SPEC_PATH).bytes)
    &&sha40(policy.productRuntimeHead)&&sha40(policy.productRuntimeTree)
    &&sha40(policy.labBaseHead)&&sha40(policy.labBaseTree)
    &&sha64(policy.labRegistrySha256)
    &&Array.isArray(policy.labCodeBindings)&&policy.labCodeBindings.length===3
    &&policy.labCodeBindings.every(row=>sha64(row.sha256))
    &&policy.readerBinding?.path===READBACK
    &&policy.readerBinding.sha256===hash(readOrderFile(ROOT,READBACK).bytes)
    &&Array.isArray(policy.runBindings)&&policy.runBindings.length===2
    &&policy.runBindings.every(row=>sha64(row.observationArtifactHash)
      &&sha64(row.observationSha256)),'C4_MULTI_POLICY_SCOPE');
  return policy;
}

export function validateC4MultiPromotion({runtimeIdentity,verifierIdentity,allowedPaths,
  git=gitAt(ROOT)}){
  demand(runtimeIdentity&&verifierIdentity&&sha40(runtimeIdentity.head)
    &&sha40(runtimeIdentity.tree)&&sha40(verifierIdentity.head)
    &&sha40(verifierIdentity.tree),'C4_MULTI_PROMOTION_IDENTITY');
  demand(same(allowedPaths,C4_MULTI_PROMOTION_PATHS),'C4_MULTI_PROMOTION_POLICY_SCOPE');
  if(runtimeIdentity.head===verifierIdentity.head){
    demand(runtimeIdentity.tree===verifierIdentity.tree,'C4_MULTI_PROMOTION_TREE');
    return [];
  }
  try{git(['merge-base','--is-ancestor',runtimeIdentity.head,verifierIdentity.head]);}
  catch{throw new Error('C4_MULTI_PROMOTION_NOT_DESCENDANT');}
  let changed;
  try{changed=git(['diff','--name-only','--no-renames',
    runtimeIdentity.head+'..'+verifierIdentity.head,'--']).trim().split('\n').filter(Boolean);}
  catch{throw new Error('C4_MULTI_PROMOTION_DIFF_UNAVAILABLE');}
  demand(changed.length>0&&changed.every(file=>allowedPaths.includes(file)),
    'C4_MULTI_PROMOTION_SCOPE');
  return changed;
}

function registeredLab(root,policy){
  const registry=JSON.parse(fs.readFileSync(policy.labRegistryPath,'utf8'));
  const entry=registry.projects?.find(row=>row.key===policy.labRegistryKey);
  demand(entry?.status==='active'&&entry.canonical_path===policy.labCanonicalRoot
    &&entry.worktree_root===policy.labManagedRoot,'C4_MULTI_LAB_REGISTRY_AUTHORITY');
  const real=fs.realpathSync(root),managed=fs.realpathSync(policy.labManagedRoot);
  demand(real.startsWith(managed+path.sep),'C4_MULTI_UNREGISTERED_LAB');
  const worktrees=gitAt(policy.labCanonicalRoot)(['worktree','list','--porcelain'])
    .split('\n').filter(line=>line.startsWith('worktree ')).map(line=>line.slice(9));
  demand(worktrees.some(value=>fs.realpathSync(value)===real),'C4_MULTI_LAB_NOT_LINKED');
  return real;
}

function labRevision(labRoot,revision,policy){
  demand(sha40(revision),'C4_MULTI_LAB_REVISION');
  const git=gitAt(labRoot);
  demand(git(['rev-parse',policy.labBaseHead+'^{tree}']).trim()===policy.labBaseTree,
    'C4_MULTI_LAB_BASE_TREE');
  git(['merge-base','--is-ancestor',policy.labBaseHead,revision]);
  const changed=git(['diff','--name-only','--no-renames',
    policy.labBaseHead,revision,'--']).trim().split('\n').filter(Boolean);
  demand(changed.every(file=>policy.allowedLabDeltaPaths.includes(file)),
    'C4_MULTI_LAB_SCOPE');
  for(const binding of policy.labCodeBindings){
    const bytes=execFileSync('git',['show',`${revision}:${binding.path}`],
      {cwd:labRoot,timeout:10000,maxBuffer:16*1024*1024});
    demand(hash(bytes)===binding.sha256,'C4_MULTI_LAB_CODE_PIN');
  }
}

export function validateC4MultiRuns(runIds,policy){
  demand(Array.isArray(runIds)&&runIds.length===2,'C4_MULTI_RUN_SET');
  const rows=runIds.map(runId=>{
    demand(typeof runId==='string','C4_MULTI_RUN_ID');
    const match=/^ORDER__MULTI_SCENE__C4__(SOURCE_RUNTIME|PACKAGED_BUILD_RUNTIME)__[A-Za-z0-9_-]{1,80}$/u.exec(runId);
    demand(match,'C4_MULTI_RUN_ID');
    const binding=policy.runBindings.find(row=>row.runId===runId);
    demand(binding,'C4_MULTI_RUN_NOT_PINNED');
    return {runId,profile:match[1],binding};
  });
  demand(new Set(rows.map(row=>row.profile)).size===2,'C4_MULTI_DUPLICATE_PROFILE');
  return rows;
}

export function verifyGoogleOfficeC4MultiBatch({repoRoot=ROOT,labRoot,runIds,
  requiredCells,specErrors=[],currentHead}={}){
  const started=performance.now(),errors=[...specErrors];
  let identity=null,runtimeIdentity=null,labIdentity=null,promotionPaths=[],reviews=[];
  try{
    demand(!errors.length,'C4_MULTI_SPEC_OR_MODE');
    demand(fs.realpathSync(repoRoot)===ROOT,'C4_MULTI_CHECKOUT');
    identity=clean(ROOT);
    const policy=loadC4MultiPolicy(),rows=validateC4MultiRuns(runIds,policy);
    const realLab=registeredLab(labRoot,policy);
    labIdentity=clean(realLab);
    const git=gitAt(ROOT);
    demand(git(['rev-parse','origin/main']).trim()===identity.head
      &&(!currentHead||currentHead===identity.head),'C4_MULTI_CURRENT_MAIN');
    demand(requiredCells?.length===1120
      &&new Set(requiredCells.map(row=>row.cellId)).size===1120
      &&C4_MULTI_CELLS.every(id=>requiredCells.some(row=>row.cellId===id)),
    'C4_MULTI_DENOMINATOR');
    const shadow=json(realLab,'LAB_MANIFEST.json').shadow.yalken;
    const runtimeRoot=fs.realpathSync(shadow.root);
    runtimeIdentity=clean(runtimeRoot);
    demand(runtimeRoot===fs.realpathSync(path.join(realLab,'.shadow','yalken-origin-main'))
      &&shadow.readOnly===true&&shadow.detached===true
      &&shadow.head===runtimeIdentity.head&&shadow.tree===runtimeIdentity.tree
      &&shadow.declaredOriginMainHead===runtimeIdentity.head
      &&shadow.declaredOriginMainTree===runtimeIdentity.tree
      &&runtimeIdentity.head===policy.productRuntimeHead
      &&runtimeIdentity.tree===policy.productRuntimeTree
      &&git(['rev-parse',runtimeIdentity.head+'^{tree}']).trim()===runtimeIdentity.tree,
      'C4_MULTI_RUNTIME_SHADOW');
    promotionPaths=validateC4MultiPromotion({runtimeIdentity,verifierIdentity:identity,
      allowedPaths:policy.verifierPromotionPaths});
    demand(hash(readOrderFile(realLab,'data/registry/frozen-denominator-registry-v2.json').bytes)
      ===policy.labRegistrySha256,'C4_MULTI_LAB_DENOMINATOR');
    labRevision(realLab,labIdentity.head,policy);
    const ledgerFile=readOrderFile(realLab,'data/evidence/ledger.jsonl',64*1024*1024);
    const ledger=ledgerFile.bytes.toString('utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
    for(const row of rows){
      const prefix='runs/'+row.runId+'/';
      const entries=ledger.filter(entry=>entry.type==='PHYSICAL_OBSERVATION'
        &&entry.runId===row.runId);
      demand(entries.length===1&&entries[0].cellId===`ORDER__MULTI_SCENE__C4__${row.profile}`
        &&entries[0].artifactHash===row.binding.observationArtifactHash,
        'C4_MULTI_LEDGER_BINDING');
      demand(!ledger.some(entry=>(entry.runId===row.runId
        &&(entry.stale===true||['PRIVACY_INVALIDATED','AUDIT_INVALIDATED_PHYSICAL_OBSERVATION'].includes(entry.type)))
        ||(entry.type==='EVIDENCE_SUPERSEDES'&&entry.supersedesRunId===row.runId)),
        'C4_MULTI_INVALIDATED');
      const observation=readOrderFile(realLab,prefix+'observation.json');
      const obs=JSON.parse(observation.bytes);
      const withoutHash={...obs};delete withoutHash.artifactHash;
      demand(hash(observation.bytes)===row.binding.observationSha256
        &&obs.artifactHash===row.binding.observationArtifactHash
        &&obs.artifactHashScope==='observation_without_artifactHash'
        &&hashOrderObservation(withoutHash)===obs.artifactHash,
        'C4_MULTI_OBSERVATION_HASH');
      for(const key of ['labHead','labTree','createdAt','status','yalkenShadowHead','yalkenShadowTree'])
        demand(obs[key]===entries[0][key],'C4_MULTI_LEDGER_FIELDS');
      demand(obs.yalkenShadowHead===runtimeIdentity.head
        &&obs.yalkenShadowTree===runtimeIdentity.tree
        &&obs.candidateDiagnosticOnly===false
        &&Date.parse(obs.createdAt)>=Date.parse(policy.notBeforeUtc)
        &&Date.parse(obs.createdAt)<=Date.now(),'C4_MULTI_OBSERVATION_SCOPE');
      labRevision(realLab,obs.labHead,policy);
      demand(gitAt(realLab)(['rev-parse',obs.labHead+'^{tree}']).trim()===obs.labTree,
        'C4_MULTI_OBSERVATION_LAB_TREE');
      const files=[...obs.artifacts.map(({path:p,bytes,sha256})=>({path:p,bytes,sha256})),
        observation.binding];
      demand(files.length===25
        &&files.every(file=>file.path.startsWith(prefix)
          &&Number.isSafeInteger(file.bytes)&&file.bytes>=0&&file.bytes<=8*1024*1024
          &&sha64(file.sha256)),'C4_MULTI_FILE_SCOPE');
      const input=JSON.stringify({root:realLab,runId:row.runId,
        productHead:runtimeIdentity.head,productTree:runtimeIdentity.tree,files});
      demand(Buffer.byteLength(input)<=1024*1024,'C4_MULTI_READER_REQUEST');
      const proc=spawnSync('python3',['-I','-B',path.join(ROOT,READBACK)],
        {input,encoding:'utf8',timeout:60000,maxBuffer:4*1024*1024});
      demand(!proc.error&&proc.status===0,
        'C4_MULTI_RAW_FAILED:'+String(proc.stdout||proc.stderr||proc.error));
      const raw=JSON.parse(proc.stdout);
      demand(raw.ok===true&&raw.admissionCredit===0
        &&raw.schemaVersion==='GOOGLE_OFFICE_C4_MULTI_RAW_READBACK_V1'
        &&raw.runId===row.runId&&raw.productHead===runtimeIdentity.head
        &&raw.productTree===runtimeIdentity.tree
        &&raw.observationSha256===observation.binding.sha256
        &&raw.filesVerified===25&&same(raw.requiredHops,policy.requiredHops)
        &&raw.sceneCount===3&&raw.paragraphCount===35
        &&same(raw.fieldProofs.map(field=>field.field),['TEXT','ORDER','NOVEL_SCENE_STRUCTURE'])
        &&raw.fieldProofs.every(field=>field.runId===row.runId
          &&field.status==='PASS'&&policy.cellIds.includes(field.cellId)),
        'C4_MULTI_RAW_SCOPE');
      reviews.push({runId:row.runId,profile:row.profile,
        observationArtifactHash:obs.artifactHash,raw});
    }
    demand(readOrderFile(realLab,'data/evidence/ledger.jsonl',64*1024*1024).bytes.equals(ledgerFile.bytes)
      &&same(clean(ROOT),identity)&&same(clean(realLab),labIdentity),
      'C4_MULTI_CHANGED_DURING_REVIEW');
  }catch(error){errors.push(String(error.message));}
  const ok=errors.length===0;
  const proofs=ok?reviews.flatMap(review=>review.raw.fieldProofs):[];
  const acceptedCellIds=[...new Set(proofs.map(field=>field.cellId))].sort();
  if(ok&&acceptedCellIds.length!==6)errors.push('C4_MULTI_SIX_FIELD_PROOFS_REQUIRED');
  const accepted=errors.length===0?acceptedCellIds:[];
  return {ok:errors.length===0,errors,contractId:'YALKEN_INTEROP_100_SUPPORTED_CONTRACT_V1',
    evidenceMode:C4_MULTI_MODE,authoritativeAdmission:errors.length===0,
    requiredCells:1120,recordedCells:accepted.length,passedRequiredCells:accepted.length,
    acceptedCellIds:accepted,diagnosticPassedRequiredCells:0,broadPassClaim:false,
    claimVerdict:errors.length?'FAIL_GOOGLE_OFFICE_C4_MULTI_EVIDENCE':'NEEDS_MORE_EVIDENCE',
    statusCounts:{PASS:accepted.length,NOT_EXECUTED:1120-accepted.length},
    currentHead:identity?.head||null,currentTree:identity?.tree||null,
    evidenceRuntimeHead:runtimeIdentity?.head||null,evidenceRuntimeTree:runtimeIdentity?.tree||null,
    verifierPromotionPaths:promotionPaths,percentage:accepted.length/1120*100,
    cellDecisions:proofs.map(field=>({cellId:field.cellId,status:'PASS',outcome:'PRESERVED',
      sourceRunId:field.runId,fieldProofSha256:hash(Buffer.from(stableOrderJson(field)))})),
    policySha256:C4_MULTI_POLICY_SHA256,rawReadbacks:errors.length?[]:reviews,
    seconds:(performance.now()-started)/1000,
    limitations:['Only the named three-scene C4 TEXT, ORDER and NOVEL_SCENE_STRUCTURE journeys are verified.',
      'Saved Office transcript and current provider metadata bind the route; raw OOXML and canonical files are independently re-read.',
      'No Google Native, unexecuted field, full 1120 or release claim follows.']};
}

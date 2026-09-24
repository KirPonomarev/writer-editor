import fs from 'node:fs';
import path from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {performance} from 'node:perf_hooks';
import {hashOrderObservation,readOrderFile,stableOrderJson} from './rtk-interop-order-c1.mjs';
import {hash} from './rtk-interop-data-c1.mjs';
import {TEXT_CONTROL_IDS} from './rtk-interop-text-order-c1.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const POLICY='docs/OPS/RTK/YALKEN_INTEROP_C4_POLICY_V1.json';
const SPEC='docs/OPS/RTK/YALKEN_INTEROP_100_DENOMINATOR_V1.json';
const READER='scripts/ops/rtk-interop-c4-google-office-readback.py';
export const C4_GOOGLE_MODE='GOOGLE_OFFICE_C4_BATCH_V1';
export const C4_GOOGLE_CELLS=Object.freeze(['SOURCE_RUNTIME','PACKAGED_BUILD_RUNTIME'].flatMap(profile=>
  ['TEXT','ORDER'].map(field=>`${field}__SINGLE_SCENE__C4__${profile}`)));
export const C4_GOOGLE_HOPS=Object.freeze(['YALKEN_DOCX_EXPORT','GOOGLE_OFFICE_LIFECYCLE','YALKEN_RETURN_INTAKE']);
export const C4_VERIFIER_PROMOTION_PATHS=Object.freeze([
  'docs/OPS/R24/CORRECTIVE/C1B_TEST_INVENTORY_V1.json',
  'docs/OPS/R24/CORRECTIVE/C2A_GOVERNANCE_CHANGE_APPROVALS_V1.json',
  'docs/OPS/RTK/YALKEN_INTEROP_100_GOVERNANCE_CHANGE_APPROVALS_V1.json',
  'docs/OPS/RTK/YALKEN_INTEROP_C4_POLICY_V1.json',
  'scripts/ops/r24/corrective/post-audit-certification-set.mjs',
  'scripts/ops/rtk-interop-c4-google-office-batch.mjs',
  'test/contracts/rtk-interop-c4-google-office.contract.test.js',
]);
export const C4_POLICY_SHA256='c752b52aa9f12dea5bc7aa572cdc431edc3480bd2ce8d72ff4bcf64f62ccb0ef';
const C4_LAB_DELTA_PATHS=Object.freeze(['LAB_MANIFEST.json','dashboard/index.html',
  'data/artifacts/ARTIFACTS.json','data/evidence/ledger.jsonl',
  'src/m1-text-single-scene-source-runtime.mjs','test/m0-audit-repair.test.mjs']);
const C4_LAB_CODE_PATHS=Object.freeze(['src/m1-text-single-scene-source-runtime.mjs',
  'test/m0-audit-repair.test.mjs']);
const demand=(ok,code)=>{if(!ok)throw new Error(code);};
const same=(a,b)=>stableOrderJson(a)===stableOrderJson(b);
const sha40=value=>typeof value==='string'&&/^[a-f0-9]{40}$/u.test(value);
const sha64=value=>typeof value==='string'&&/^[a-f0-9]{64}$/u.test(value);
const gitAt=root=>args=>execFileSync('git',args,{cwd:root,encoding:'utf8',timeout:10000,maxBuffer:16*1024*1024});
const json=(root,file,max)=>JSON.parse(readOrderFile(root,file,max).bytes);

function clean(root){
  const git=gitAt(root);
  demand(!git(['status','--porcelain=v1','--untracked-files=all']).trim(),'C4_DIRTY_CHECKOUT');
  const [head,tree]=git(['rev-parse','HEAD','HEAD^{tree}']).trim().split('\n');
  demand(sha40(head)&&sha40(tree),'C4_GIT_IDENTITY');
  return {head,tree};
}

function registeredLabRoot(labRoot,policy){
  const registry=JSON.parse(fs.readFileSync(policy.labRegistryPath,'utf8'));
  const entry=registry.projects?.find(project=>project.key===policy.labRegistryKey);
  demand(entry?.status==='active'&&entry.canonical_path===policy.labCanonicalRoot
    &&entry.worktree_root===policy.labManagedRoot,'C4_LAB_REGISTRY_AUTHORITY');
  const realRoot=fs.realpathSync(labRoot),managed=fs.realpathSync(policy.labManagedRoot);
  demand(realRoot.startsWith(managed+path.sep),'C4_LAB_UNREGISTERED_ROOT');
  const registered=gitAt(policy.labCanonicalRoot)(['worktree','list','--porcelain'])
    .split('\n').filter(line=>line.startsWith('worktree ')).map(line=>line.slice(9));
  demand(registered.some(root=>fs.realpathSync(root)===realRoot),'C4_LAB_NOT_LINKED');
  return realRoot;
}

export function validateC4Runs(runIds){
  demand(Array.isArray(runIds)&&runIds.length>=1&&runIds.length<=2,'C4_RUN_SET');
  const rows=runIds.map(runId=>{
    demand(typeof runId==='string','C4_RUN_ID');
    const match=/^ORDER__SINGLE_SCENE__C4__(SOURCE_RUNTIME|PACKAGED_BUILD_RUNTIME)__[A-Za-z0-9_-]{1,80}$/u.exec(runId);
    demand(match,'C4_RUN_ID');
    return {runId,profile:match[1],cellId:`ORDER__SINGLE_SCENE__C4__${match[1]}`};
  });
  demand(new Set(rows.map(row=>row.profile)).size===rows.length,'C4_DUPLICATE_PROFILE');
  return rows;
}

export function loadC4Policy(){
  const bytes=readOrderFile(ROOT,POLICY).bytes;
  demand(hash(bytes)===C4_POLICY_SHA256,'C4_POLICY_PIN');
  const policy=JSON.parse(bytes);
  demand(policy.schemaVersion==='YALKEN_INTEROP_C4_POLICY_V1'
    &&same(policy.cellIds,C4_GOOGLE_CELLS)&&same(policy.requiredHops,C4_GOOGLE_HOPS)
    &&policy.productSpecSha256===hash(readOrderFile(ROOT,SPEC).bytes)
    &&sha40(policy.productBaseHead)&&sha40(policy.labBaseHead)&&sha40(policy.labBaseTree)
    &&sha64(policy.labRegistrySha256)&&Array.isArray(policy.allowedLabDeltaPaths)
    &&same(policy.allowedLabDeltaPaths,C4_LAB_DELTA_PATHS)
    &&same(policy.verifierPromotionPaths,C4_VERIFIER_PROMOTION_PATHS)
    &&Array.isArray(policy.labCodeBindings)
    &&same(policy.labCodeBindings.map(binding=>binding.path),C4_LAB_CODE_PATHS)
    &&policy.labCodeBindings.every(binding=>sha64(binding.sha256)),'C4_POLICY_SCOPE');
  for(const binding of policy.readerBindings)
    demand(hash(readOrderFile(ROOT,binding.path).bytes)===binding.sha256,'C4_READER_PIN');
  return policy;
}

export function validateC4LabRevision({changedPaths,codeBlobs,policy}){
  demand(Array.isArray(changedPaths)&&changedPaths.every(file=>policy.allowedLabDeltaPaths.includes(file)),
    'C4_LAB_CODE_DRIFT');
  for(const binding of policy.labCodeBindings)
    demand(Buffer.isBuffer(codeBlobs[binding.path])
      &&hash(codeBlobs[binding.path])===binding.sha256,'C4_LAB_CODE_PIN');
}

// The raw oracle still verifies the physical run against the product bytes it
// executed. Promotion changes only the verifier identity and fails closed if
// any product/runtime/reader path changed between that run and current main.
export function validateC4VerifierPromotion({repoRoot=ROOT,runtimeIdentity,verifierIdentity,
  allowedPaths,git=gitAt(repoRoot)}){
  demand(runtimeIdentity&&verifierIdentity&&sha40(runtimeIdentity.head)
    &&sha40(runtimeIdentity.tree)&&sha40(verifierIdentity.head)
    &&sha40(verifierIdentity.tree),'C4_PROMOTION_IDENTITY');
  demand(same(allowedPaths,C4_VERIFIER_PROMOTION_PATHS),'C4_PROMOTION_POLICY_SCOPE');
  if(runtimeIdentity.head===verifierIdentity.head){
    demand(runtimeIdentity.tree===verifierIdentity.tree,'C4_PROMOTION_TREE');
    return [];
  }
  try{git(['merge-base','--is-ancestor',runtimeIdentity.head,verifierIdentity.head]);}
  catch{throw new Error('C4_PROMOTION_NOT_DESCENDANT');}
  let changed;
  try{changed=git(['diff','--name-only','--no-renames',
    runtimeIdentity.head+'..'+verifierIdentity.head,'--']).trim().split('\n').filter(Boolean);}
  catch{throw new Error('C4_PROMOTION_DIFF_UNAVAILABLE');}
  const allowed=new Set(allowedPaths);
  demand(changed.length>0&&changed.every(file=>allowed.has(file)),'C4_PROMOTION_SCOPE');
  return changed;
}

function labRevision(labRoot,revision,policy){
  demand(sha40(revision),'C4_LAB_REVISION');
  const git=gitAt(labRoot);
  demand(git(['rev-parse',policy.labBaseHead+'^{tree}']).trim()===policy.labBaseTree,'C4_LAB_BASE_TREE');
  git(['merge-base','--is-ancestor',policy.labBaseHead,revision]);
  const changed=git(['diff','--name-only','--no-renames',policy.labBaseHead,revision,'--']).trim().split('\n').filter(Boolean);
  const codeBlobs=Object.fromEntries(policy.labCodeBindings.map(binding=>[binding.path,
    execFileSync('git',['show',`${revision}:${binding.path}`],
      {cwd:labRoot,timeout:10000,maxBuffer:16*1024*1024})]));
  validateC4LabRevision({changedPaths:changed,codeBlobs,policy});
}

export function selectC4Observation(ledger,row){
  const rows=ledger.filter(entry=>entry.type==='PHYSICAL_OBSERVATION'&&entry.runId===row.runId);
  demand(rows.length===1&&rows[0].cellId===row.cellId,'C4_EXACT_OBSERVATION');
  demand(!ledger.some(entry=>(entry.runId===row.runId&&(entry.stale===true||
    ['PRIVACY_INVALIDATED','AUDIT_INVALIDATED_PHYSICAL_OBSERVATION'].includes(entry.type)))
    ||(entry.type==='EVIDENCE_SUPERSEDES'&&entry.supersedesRunId===row.runId)
    ||(entry.type==='AUDIT_INVALIDATED_PHYSICAL_OBSERVATION'&&entry.artifactHash===rows[0].artifactHash)),
  'C4_INVALIDATED');
  return rows[0];
}

export function validateC4Raw(raw,{row,head,tree,observationSha256,files,requiredCells}){
  demand(raw?.ok===true&&raw.schemaVersion==='GOOGLE_OFFICE_C4_RAW_READBACK_V1'
    &&raw.admissionCredit===0&&raw.runId===row.runId
    &&raw.productHead===head&&raw.productTree===tree
    &&raw.observationSha256===observationSha256&&raw.filesVerified===files.length
    &&same(raw.requiredHops,C4_GOOGLE_HOPS),'C4_RAW_BINDING');
  const fields=raw.fieldProofs;
  demand(Array.isArray(fields)&&same(fields.map(field=>field.field),['TEXT','ORDER'])
    &&same(fields.map(field=>field.cellId),['TEXT','ORDER'].map(field=>`${field}__SINGLE_SCENE__C4__${row.profile}`))
    &&fields.every(field=>field.runId===row.runId&&field.status==='PASS'
      &&sha64(field.sourceParagraphSha256)&&sha64(field.reviewedParagraphSha256)
      &&requiredCells.some(cell=>cell.cellId===field.cellId)),'C4_FIELD_SCOPE');
  const text=fields[0].controls,order=fields[1].controls;
  demand(same(text?.positiveControls,['identity','split-xml-runs'])
    &&same(text.rawMutantsExecuted.map(control=>control.id),TEXT_CONTROL_IDS)
    &&text.rawMutantsExecuted.every(control=>control.rejected===true&&sha64(control.sha256))
    &&order.orderMutantsExecuted.length===24
    &&new Set(order.orderMutantsExecuted).size===24
    &&same(order.rawMutantsExecuted.map(control=>control.id),['swap','delete-empty','trim'])
    &&order.rawMutantsExecuted.every(control=>control.rejected===true&&sha64(control.sha256)),
  'C4_NEGATIVE_CONTROLS');
  return fields;
}

export function verifyGoogleOfficeC4Batch({repoRoot=ROOT,labRoot,runIds,requiredCells,specErrors=[],currentHead}={}){
  const started=performance.now(),errors=[...specErrors];
  let identity=null,runtimeIdentity=null,runtimeRoot=null,promotionPaths=[],reviews=[];
  try{
    demand(!errors.length,'C4_SPEC_OR_MODE');
    const rows=validateC4Runs(runIds);
    demand(fs.realpathSync(repoRoot)===ROOT,'C4_CHECKOUT');
    identity=clean(ROOT);
    const policy=loadC4Policy(),realLabRoot=registeredLabRoot(labRoot,policy);
    const labIdentity=clean(realLabRoot),git=gitAt(ROOT);
    demand(git(['rev-parse','origin/main']).trim()===identity.head&&(!currentHead||currentHead===identity.head),'C4_CURRENT_MAIN');
    git(['merge-base','--is-ancestor',policy.productBaseHead,identity.head]);
    demand(requiredCells?.length===1120&&new Set(requiredCells.map(cell=>cell.cellId)).size===1120
      &&C4_GOOGLE_CELLS.every(id=>requiredCells.some(cell=>cell.cellId===id)),'C4_DENOMINATOR');
    const shadow=json(labRoot,'LAB_MANIFEST.json').shadow.yalken;
    runtimeRoot=fs.realpathSync(shadow.root);runtimeIdentity=clean(runtimeRoot);
    const expectedShadowRoot=fs.realpathSync(path.join(realLabRoot,'.shadow','yalken-origin-main'));
    demand(runtimeRoot===expectedShadowRoot&&shadow.readOnly===true&&shadow.detached===true
      &&shadow.head===runtimeIdentity.head
      &&shadow.tree===runtimeIdentity.tree
      &&shadow.declaredOriginMainHead===runtimeIdentity.head
      &&shadow.declaredOriginMainTree===runtimeIdentity.tree
      &&git(['rev-parse',runtimeIdentity.head+'^{tree}']).trim()===runtimeIdentity.tree,
    'C4_SHADOW');
    promotionPaths=validateC4VerifierPromotion({runtimeIdentity,verifierIdentity:identity,
      allowedPaths:policy.verifierPromotionPaths});
    demand(hash(readOrderFile(labRoot,'data/registry/frozen-denominator-registry-v2.json').bytes)===policy.labRegistrySha256,
      'C4_LAB_REGISTRY');
    labRevision(labRoot,labIdentity.head,policy);
    const ledgerFile=readOrderFile(labRoot,'data/evidence/ledger.jsonl',64*1024*1024);
    const ledger=ledgerFile.bytes.toString('utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
    for(const row of rows){
      const prefix='runs/'+row.runId+'/',entry=selectC4Observation(ledger,row);
      const obsFile=readOrderFile(labRoot,prefix+'observation.json'),obs=JSON.parse(obsFile.bytes);
      demand(obs.runId===row.runId&&obs.cellId===row.cellId&&obs.artifactHash===entry.artifactHash,'C4_OBSERVATION_FILE');
      for(const key of ['labHead','labTree','createdAt','status','yalkenShadowHead','yalkenShadowTree'])
        demand(obs[key]===entry[key],'C4_LEDGER_BINDING');
      const withoutHash={...obs};delete withoutHash.artifactHash;
      demand(obs.artifactHashScope==='observation_without_artifactHash'
        &&hashOrderObservation(withoutHash)===obs.artifactHash,'C4_OBSERVATION_HASH');
      demand(obs.yalkenShadowHead===runtimeIdentity.head&&obs.yalkenShadowTree===runtimeIdentity.tree
        &&obs.candidateDiagnosticOnly===false,'C4_ACTUAL_RUNTIME');
      demand(Date.parse(obs.createdAt)>=Date.parse(policy.notBeforeUtc)
        &&Date.parse(obs.createdAt)<=Date.now(),'C4_OBSERVATION_TIME');
      labRevision(labRoot,obs.labHead,policy);
      demand(gitAt(labRoot)(['rev-parse',obs.labHead+'^{tree}']).trim()===obs.labTree,'C4_LAB_TREE');
      const snapshot=json(labRoot,prefix+'runtime-project-snapshot.json');
      const files=[...obs.artifacts,...snapshot.files].map(({path:p,bytes,sha256})=>({path:p,bytes,sha256}));
      files.push(obsFile.binding);
      demand(files.length<=128&&new Set(files.map(file=>file.path)).size===files.length
        &&files.every(file=>file.path.startsWith(prefix)&&Number.isSafeInteger(file.bytes)
          &&file.bytes>=0&&file.bytes<=8*1024*1024&&sha64(file.sha256))
        &&files.reduce((n,file)=>n+file.bytes,0)<=64*1024*1024,'C4_FILE_SCOPE');
      const input=JSON.stringify({root:fs.realpathSync(labRoot),runId:row.runId,
        productHead:runtimeIdentity.head,productTree:runtimeIdentity.tree,files});
      demand(Buffer.byteLength(input)<=1024*1024,'C4_READER_REQUEST');
      const proc=spawnSync('python3',['-I','-B',path.join(ROOT,READER)],
        {input,encoding:'utf8',timeout:60000,maxBuffer:4*1024*1024});
      demand(!proc.error&&proc.status===0,'C4_RAW_FAILED:'+String(proc.stdout||proc.stderr||proc.error));
      const raw=JSON.parse(proc.stdout);
      validateC4Raw(raw,{row,...runtimeIdentity,observationSha256:obsFile.binding.sha256,files,requiredCells});
      reviews.push({runId:row.runId,observationArtifactHash:obs.artifactHash,raw});
    }
    demand(readOrderFile(labRoot,'data/evidence/ledger.jsonl',64*1024*1024).bytes.equals(ledgerFile.bytes)
      &&same(clean(ROOT),identity)&&same(clean(runtimeRoot),runtimeIdentity)
      &&same(clean(labRoot),labIdentity),'C4_CHANGED_DURING_REVIEW');
  }catch(error){errors.push(String(error.message));}
  const ok=!errors.length,fieldProofs=ok?reviews.flatMap(review=>review.raw.fieldProofs):[];
  const acceptedCellIds=[...new Set(fieldProofs.map(field=>field.cellId))].sort();
  return {ok,errors,contractId:'YALKEN_INTEROP_100_SUPPORTED_CONTRACT_V1',evidenceMode:C4_GOOGLE_MODE,
    authoritativeAdmission:ok,requiredCells:1120,recordedCells:acceptedCellIds.length,
    passedRequiredCells:acceptedCellIds.length,acceptedCellIds,diagnosticPassedRequiredCells:0,
    broadPassClaim:false,claimVerdict:ok?'NEEDS_MORE_EVIDENCE':'FAIL_GOOGLE_OFFICE_C4_EVIDENCE',
    statusCounts:{PASS:acceptedCellIds.length,NOT_EXECUTED:1120-acceptedCellIds.length},
    currentHead:identity?.head||null,currentTree:identity?.tree||null,
    evidenceRuntimeHead:runtimeIdentity?.head||null,evidenceRuntimeTree:runtimeIdentity?.tree||null,
    verifierPromotionPaths:promotionPaths,
    percentage:acceptedCellIds.length/1120*100,
    cellDecisions:fieldProofs.map(field=>({cellId:field.cellId,status:'PASS',outcome:'PRESERVED',
      sourceRunId:field.runId,fieldProofSha256:hash(Buffer.from(stableOrderJson(field)))})),
    policySha256:C4_POLICY_SHA256,rawReadbacks:ok?reviews:[],seconds:(performance.now()-started)/1000,
    limitations:['Only the named single-scene Google Office TEXT/ORDER review journeys are verified.',
      'The Google document edit/comment is bound to native evidence and returned DOCX bytes; Lab PASS alone grants zero credit.',
      'SOURCE and PACKAGED profiles require separate real provider executions.']};
}

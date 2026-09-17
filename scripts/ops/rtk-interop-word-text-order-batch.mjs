import fs from 'node:fs';
import path from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {performance} from 'node:perf_hooks';
import {readOrderFile,stableOrderJson,hashOrderObservation} from './rtk-interop-order-c1.mjs';
import {loadDataPolicy,DATA_POLICY_SHA256,hash} from './rtk-interop-data-c1.mjs';
import {TEXT_SUBCASES,TEXT_CONTROL_IDS} from './rtk-interop-text-order-c1.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const READER='scripts/ops/rtk-interop-word-text-order-readback.py';
const VOLUME_READER='scripts/ops/rtk-interop-word-volume-readback.py';
export const WORD_BATCH_VOLUMES=Object.freeze(['SINGLE_SCENE','MULTI_SCENE','FULL_SYNTHETIC_NOVEL','LARGE_DOCUMENT']);
export const WORD_VOLUME_CONTROLS=Object.freeze(['swap-paragraphs','delete-empty','trim-spaces','corrupt-unicode','drop-final-paragraph','duplicate-paragraph','swap-scenes','truncate-half','corrupt-last-scene']);
const SPEC='docs/OPS/RTK/YALKEN_INTEROP_100_DENOMINATOR_V1.json';
export const WORD_BATCH_MODE='WORD_TEXT_ORDER_BATCH_V1';
export const WORD_BATCH_HOPS=Object.freeze({
  C1:['YALKEN_EXPORT','WORD_LIFECYCLE','YALKEN_RETURN_INTAKE'],
  C2:['YALKEN_EXPORT','WORD_LIFECYCLE','YALKEN_RETURN_INTAKE','YALKEN_APPLY','YALKEN_REEXPORT','WORD_REOPEN_READBACK'],
});
export const WORD_BATCH_CELLS=Object.freeze(WORD_BATCH_VOLUMES.flatMap(volume=>['C1','C2'].flatMap(route=>['SOURCE_RUNTIME','PACKAGED_BUILD_RUNTIME']
  .flatMap(profile=>['TEXT','ORDER'].map(field=>`${field}__${volume}__${route}__${profile}`)))));
const demand=(ok,code)=>{if(!ok)throw new Error(code);};
const same=(a,b)=>stableOrderJson(a)===stableOrderJson(b);
const sha40=x=>typeof x==='string'&&/^[a-f0-9]{40}$/u.test(x);
const sha64=x=>typeof x==='string'&&/^[a-f0-9]{64}$/u.test(x);
const gitAt=root=>args=>execFileSync('git',args,{cwd:root,encoding:'utf8',timeout:10000,maxBuffer:16*1024*1024});
const json=(root,file,max)=>JSON.parse(readOrderFile(root,file,max).bytes);
function clean(root){
  const git=gitAt(root);
  demand(!git(['status','--porcelain=v1','--untracked-files=all']).trim(),'WORD_BATCH_DIRTY');
  const [head,tree]=git(['rev-parse','HEAD','HEAD^{tree}']).trim().split('\n');
  demand(sha40(head)&&sha40(tree),'WORD_BATCH_GIT_IDENTITY');return {head,tree};
}
export function validateWordBatchRuns(runIds){
  demand(Array.isArray(runIds)&&runIds.length>=1&&runIds.length<=16,'WORD_BATCH_RUN_SET');
  const rows=runIds.map(runId=>{
    demand(typeof runId==='string','WORD_BATCH_RUN_ID');
    const m=/^ORDER__(SINGLE_SCENE|MULTI_SCENE|FULL_SYNTHETIC_NOVEL|LARGE_DOCUMENT)__(C[12])__(SOURCE_RUNTIME|PACKAGED_BUILD_RUNTIME)__[A-Za-z0-9_-]{1,80}$/u.exec(runId);
    demand(m,'WORD_BATCH_RUN_ID');return {runId,volume:m[1],route:m[2],profile:m[3],cellId:runId.slice(0,runId.lastIndexOf('__'))};
  });
  demand(new Set(rows.map(x=>x.cellId)).size===rows.length,'WORD_BATCH_DUPLICATE_JOURNEY');return rows;
}
function labRevision(labRoot,revision,policy){
  demand(sha40(revision),'WORD_BATCH_LAB_REVISION');const git=gitAt(labRoot);
  git(['merge-base','--is-ancestor',policy.labBaseHead,revision]);
  const delta=git(['diff','--name-only','--no-renames',policy.labBaseHead,revision,'--']).trim().split('\n').filter(Boolean);
  demand(delta.every(p=>policy.allowedLabDeltaPaths.includes(p)||/^data\/cases\/[a-z][a-z0-9-]{0,63}\.json$/u.test(p)),'WORD_BATCH_LAB_SCOPE');
  for(const b of policy.labCodeBindings)demand(hash(git(['show',revision+':'+b.path]))===b.sha256,'WORD_BATCH_LAB_CODE');
}
export function selectWordBatchObservation(ledger,row){
  const candidates=ledger.filter(e=>e.type==='PHYSICAL_OBSERVATION'&&e.runId===row.runId);
  demand(candidates.length===1&&candidates[0].cellId===row.cellId,'WORD_BATCH_EXACT_OBSERVATION');
  const obs=candidates[0];
  demand(!ledger.some(e=>(e.runId===row.runId&&(e.stale===true||['PRIVACY_INVALIDATED','AUDIT_INVALIDATED_PHYSICAL_OBSERVATION'].includes(e.type)))
    ||(e.type==='EVIDENCE_SUPERSEDES'&&e.supersedesRunId===row.runId)
    ||(e.type==='AUDIT_INVALIDATED_PHYSICAL_OBSERVATION'&&e.artifactHash===obs.artifactHash)),'WORD_BATCH_INVALIDATED');
  return obs;
}
export function validateWordBatchRaw(raw,{row,head,tree,observationSha256,files,policy}){
  const volumeProof=row.volume!=='SINGLE_SCENE';
  demand(raw?.ok===true&&raw.schemaVersion===(volumeProof?'WORD_VOLUME_RAW_READBACK_V1':'WORD_TEXT_ORDER_RAW_READBACK_V1')&&raw.admissionCredit===0
    &&raw.runId===row.runId&&raw.productHead===head&&raw.productTree===tree
    &&raw.observationSha256===observationSha256&&raw.filesVerified===files.length,'WORD_BATCH_RAW_BINDING');
  demand(Array.isArray(raw.fieldProofs)&&same(raw.fieldProofs.map(f=>f.field),['TEXT','ORDER']),'WORD_BATCH_FIELD_SET');
  for(const f of raw.fieldProofs){
    demand(f.runId===row.runId&&f.cellId===`${f.field}__${row.volume}__${row.route}__${row.profile}`&&f.status==='PASS'
      &&same(f.requiredHops,WORD_BATCH_HOPS[row.route])&&same(f.oracles,policy.requiredOracles),'WORD_BATCH_FIELD_SCOPE');
    const expectedStages=row.route==='C1'?['source','export-docx','word-native','returned-docx','source-renderer','import-renderer','persisted','reopened']:
      ['source','export-docx','returned-docx','source-renderer','applied-renderer','persisted','reopened-renderer','reexport-docx','final-word-docx','final-word-native'];
    if(volumeProof&&row.route==='C2')expectedStages.push('word-native');
    demand(same(Object.keys(f.stageProofs).sort(),expectedStages.sort()),'WORD_BATCH_STAGE_SET');
    for(const [name,stage] of Object.entries(f.stageProofs)){
      const reviewed=row.route==='C2'&&!['source','export-docx','source-renderer'].includes(name);
      demand(stage.reviewed===reviewed&&stage.paragraphSha256===(volumeProof?policy.wordTextOrderBatch.volumeParagraphHashes[row.volume]:policy.wordTextOrderBatch)[reviewed?'reviewedParagraphSha256':'sourceParagraphSha256']
        &&sha64(stage.sortKeysSha256),'WORD_BATCH_STAGE_HASH');
    }
    if(volumeProof){
      demand(same(f.subcases,f.field==='TEXT'?TEXT_SUBCASES:policy.requiredSubcases)
        &&same(f.controls.positiveControls,['identity','split-xml-runs'])
        &&same(f.controls.rawMutantsExecuted.map(x=>x.id),WORD_VOLUME_CONTROLS)
        &&f.controls.rawMutantsExecuted.every(x=>x.rejected===true&&sha64(x.sha256))
        &&new Set(f.controls.rawMutantsExecuted.map(x=>x.sha256)).size===WORD_VOLUME_CONTROLS.length,'WORD_BATCH_VOLUME_CONTROLS');
    }else if(f.field==='TEXT'){
      demand(same(f.subcases,TEXT_SUBCASES)&&same(f.controls.positiveControls,['identity','split-xml-runs'])
        &&same(f.controls.rawMutantsExecuted.map(x=>x.id),TEXT_CONTROL_IDS)
        &&f.controls.rawMutantsExecuted.every(x=>x.rejected===true&&sha64(x.sha256)),'WORD_BATCH_TEXT_CONTROLS');
    }else{
      demand(same(f.subcases,policy.requiredSubcases)&&f.controls.orderMutantsExecuted.length===24
        &&new Set(f.controls.orderMutantsExecuted).size===24
        &&same(f.controls.rawMutantsExecuted.map(x=>x.id),['swap','delete-empty','trim'])
        &&f.controls.rawMutantsExecuted.every(x=>x.rejected===true&&sha64(x.sha256)),'WORD_BATCH_ORDER_CONTROLS');
    }
  }
  demand(row.route==='C1'?raw.finalHops===null:raw.finalHops?.ok===true&&raw.finalHops.acceptanceCredit===0,'WORD_BATCH_FINAL_HOPS');
  return true;
}

export function verifyWordTextOrderBatch({repoRoot=ROOT,labRoot,runIds,requiredCells,specErrors=[],currentHead}={}){
  const started=performance.now(),errors=[...specErrors];let identity=null,reviews=[];
  try{
    demand(!errors.length,'WORD_BATCH_SPEC_OR_MODE');
    const rows=validateWordBatchRuns(runIds);
    demand(fs.realpathSync(repoRoot)===ROOT,'WORD_BATCH_CHECKOUT');
    identity=clean(ROOT);const labIdentity=clean(labRoot),policy=loadDataPolicy(),batch=policy.wordTextOrderBatch;
    demand(gitAt(ROOT)(['rev-parse','origin/main']).trim()===identity.head&&(!currentHead||currentHead===identity.head),'WORD_BATCH_CURRENT_MAIN');
    demand(batch?.schemaVersion===WORD_BATCH_MODE&&same(batch.cellIds,WORD_BATCH_CELLS)&&same(batch.requiredHops,WORD_BATCH_HOPS),'WORD_BATCH_POLICY_SCOPE');
    demand(hash(readOrderFile(ROOT,SPEC).bytes)===policy.productSpecSha256,'WORD_BATCH_SPEC_PIN');
    demand(requiredCells?.length===1120&&new Set(requiredCells.map(c=>c.cellId)).size===1120
      &&WORD_BATCH_CELLS.every(id=>requiredCells.some(c=>c.cellId===id)),'WORD_BATCH_DENOMINATOR');
    for(const b of batch.readerBindings)demand(hash(readOrderFile(ROOT,b.path).bytes)===b.sha256,'WORD_BATCH_READER_PIN');
    const manifest=json(labRoot,'LAB_MANIFEST.json'),shadow=manifest.shadow.yalken;
    demand(fs.realpathSync(shadow.root)===ROOT&&shadow.readOnly===true&&shadow.head===identity.head&&shadow.tree===identity.tree
      &&shadow.declaredOriginMainHead===identity.head&&shadow.declaredOriginMainTree===identity.tree,'WORD_BATCH_SHADOW');
    demand(hash(readOrderFile(labRoot,'data/registry/frozen-denominator-registry-v2.json').bytes)===policy.labRegistrySha256,'WORD_BATCH_REGISTRY');
    labRevision(labRoot,labIdentity.head,policy);
    const ledgerFile=readOrderFile(labRoot,'data/evidence/ledger.jsonl',64*1024*1024);
    const ledger=ledgerFile.bytes.toString('utf8').trim().split('\n').filter(Boolean).map(s=>JSON.parse(s));
    for(const row of rows){
      const prefix='runs/'+row.runId+'/',entry=selectWordBatchObservation(ledger,row);
      const obsFile=readOrderFile(labRoot,prefix+'observation.json'),obs=JSON.parse(obsFile.bytes);
      demand(obs.runId===row.runId&&obs.cellId===row.cellId&&obs.artifactHash===entry.artifactHash,'WORD_BATCH_OBSERVATION_FILE');
      for(const k of ['labHead','labTree','createdAt','status','yalkenShadowHead','yalkenShadowTree'])demand(obs[k]===entry[k],'WORD_BATCH_LEDGER_BINDING');
      const withoutHash={...obs};delete withoutHash.artifactHash;
      demand(obs.artifactHashScope==='observation_without_artifactHash'&&hashOrderObservation(withoutHash)===obs.artifactHash,'WORD_BATCH_OBSERVATION_HASH');
      demand(obs.yalkenShadowHead===identity.head&&obs.yalkenShadowTree===identity.tree&&obs.candidateDiagnosticOnly===false,'WORD_BATCH_ACTUAL_RUNTIME');
      demand(Date.parse(obs.createdAt)>=Date.parse(batch.notBeforeUtc)&&Date.parse(obs.createdAt)<=Date.now(),'WORD_BATCH_OBSERVATION_TIME');
      labRevision(labRoot,obs.labHead,policy);
      demand(gitAt(labRoot)(['rev-parse',obs.labHead+'^{tree}']).trim()===obs.labTree,'WORD_BATCH_LAB_TREE');
      const snapshot=json(labRoot,prefix+'runtime-project-snapshot.json');
      const files=[...obs.artifacts,...snapshot.files].map(({path:p,bytes,sha256})=>({path:p,bytes,sha256}));
      files.push(obsFile.binding);
      const volumeProof=row.volume!=='SINGLE_SCENE';
      demand(files.length<=(volumeProof?512:128)&&new Set(files.map(f=>f.path)).size===files.length,'WORD_BATCH_INVENTORY');
      demand(files.every(f=>f.path.startsWith(prefix)&&Number.isSafeInteger(f.bytes)&&f.bytes>=0&&f.bytes<=(volumeProof?32:8)*1024*1024&&sha64(f.sha256))
        &&files.reduce((n,f)=>n+f.bytes,0)<=(volumeProof?128:64)*1024*1024,'WORD_BATCH_FILE_SCOPE');
      const request={root:fs.realpathSync(labRoot),runId:row.runId,productHead:identity.head,productTree:identity.tree,files,
        qualifiedProvider:policy.qualifiedProvider,packageJsonSha256:hash(readOrderFile(ROOT,'package.json').bytes),
        packageLockSha256:hash(readOrderFile(ROOT,'package-lock.json').bytes),electronVersion:batch.electronVersion};
      const process=spawnSync('python3',['-I','-B',path.join(ROOT,volumeProof?VOLUME_READER:READER)],{input:JSON.stringify(request),encoding:'utf8',timeout:60000,maxBuffer:4*1024*1024});
      demand(!process.error&&process.status===0,'WORD_BATCH_RAW_FAILED:'+String(process.stdout||process.stderr||process.error));
      const raw=JSON.parse(process.stdout);
      validateWordBatchRaw(raw,{row,...identity,observationSha256:obsFile.binding.sha256,files,policy});
      reviews.push({runId:row.runId,observationArtifactHash:obs.artifactHash,raw});
    }
    demand(readOrderFile(labRoot,'data/evidence/ledger.jsonl',64*1024*1024).bytes.equals(ledgerFile.bytes)
      &&same(clean(ROOT),identity)&&same(clean(labRoot),labIdentity),'WORD_BATCH_CHANGED_DURING_REVIEW');
  }catch(error){errors.push(String(error.message));}
  const ok=!errors.length,fieldProofs=ok?reviews.flatMap(r=>r.raw.fieldProofs):[];
  const acceptedCellIds=[...new Set(fieldProofs.map(f=>f.cellId))].sort();
  return {ok,errors,contractId:'YALKEN_INTEROP_100_SUPPORTED_CONTRACT_V1',evidenceMode:WORD_BATCH_MODE,
    authoritativeAdmission:ok,requiredCells:1120,recordedCells:acceptedCellIds.length,passedRequiredCells:acceptedCellIds.length,
    acceptedCellIds,diagnosticPassedRequiredCells:0,broadPassClaim:false,
    claimVerdict:ok?'NEEDS_MORE_EVIDENCE':'FAIL_WORD_TEXT_ORDER_EVIDENCE',
    statusCounts:{PASS:acceptedCellIds.length,NOT_EXECUTED:1120-acceptedCellIds.length},
    currentHead:identity?.head||null,currentTree:identity?.tree||null,percentage:acceptedCellIds.length/1120*100,
    cellDecisions:fieldProofs.map(f=>({cellId:f.cellId,status:'PASS',outcome:f.outcome,sourceRunId:f.runId,fieldProofSha256:hash(Buffer.from(stableOrderJson(f)))})),
    policySha256:DATA_POLICY_SHA256,rawReadbacks:ok?reviews:[],seconds:(performance.now()-started)/1000,
    limitations:['Exact observed paragraph grammar at the named fixed volumes on C1/C2 and the named runtime profiles.',
      'Single-scene packaged C1 uses the governed command bridge after preview; volume C1 uses the owned native local-file preview. Content import does not preserve scene structure or metadata.',
      'Each actual journey yields independently checked TEXT and ORDER only; repeats never add cell IDs.']};
}

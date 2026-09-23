import fs from 'node:fs';
import path from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {readOrderFile,stableOrderJson,hashOrderObservation} from './rtk-interop-order-c1.mjs';
import {loadDataPolicy,hash as hashBytes} from './rtk-interop-data-c1.mjs';
import {validateManuscriptVerifierPromotion} from './rtk-interop-word-manuscript-batch.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
export const C4_POLICY_PATH='docs/OPS/RTK/YALKEN_INTEROP_C4_GOOGLE_OFFICE_POLICY_V1.json';
export const C4_POLICY_SHA256='ffa0dc27ab11a867eced1b19947c04c913c81a55bac2d3deeb7169979661ac4a';
export const C4_MODE='C4_GOOGLE_OFFICE_BATCH_V1';
export const C4_CELLS=Object.freeze(['TEXT__SINGLE_SCENE__C4__SOURCE_RUNTIME','ORDER__SINGLE_SCENE__C4__SOURCE_RUNTIME']);
export const C4_HOPS=Object.freeze(['YALKEN_DOCX_EXPORT','GOOGLE_OFFICE_LIFECYCLE','YALKEN_RETURN_INTAKE']);
export const C4_SUBCASES=Object.freeze({
  TEXT:['bodyTextReadbackIndependent','emptyParagraphsAccounted','lineBreakPolicyDeclared','paragraphBoundariesPreserved','plainTextPreserved','whitespaceEdgesPreserved'],
  ORDER:['blockOrderPreserved','providerTraversalStable','roundTripOrderStable','reorderDetected','sortKeysHashBound','orderDiffVisible'],
});
export const C4_STAGES=Object.freeze(['source-export','google-native-lifecycle','google-docx-export','yalken-return-intake','cleanup']);
const same=(a,b)=>stableOrderJson(a)===stableOrderJson(b);
const demand=(ok,code)=>{if(!ok)throw new Error(code);};
const sha64=value=>typeof value==='string'&&/^[a-f0-9]{64}$/u.test(value);
const sha40=value=>typeof value==='string'&&/^[a-f0-9]{40}$/u.test(value);
const hash=value=>createHash('sha256').update(value).digest('hex');
const gitAt=root=>args=>execFileSync('git',args,{cwd:root,encoding:'utf8',timeout:10000,maxBuffer:16*1024*1024});

function cleanIdentity(root,code){
  demand(typeof root==='string'&&fs.realpathSync(root)===root,code+'_ROOT');
  const git=gitAt(root);demand(!git(['status','--porcelain=v1','--untracked-files=all']).trim(),code+'_DIRTY');
  const [head,tree]=git(['rev-parse','HEAD','HEAD^{tree}']).trim().split('\n');
  demand(sha40(head)&&sha40(tree),code+'_IDENTITY');return {head,tree};
}

function loadC4Policy(){
  const bytes=readOrderFile(ROOT,C4_POLICY_PATH).bytes;
  demand(hash(bytes)===C4_POLICY_SHA256,'C4_POLICY_PIN');
  const policy=JSON.parse(bytes);
  demand(policy.schemaVersion==='YALKEN_INTEROP_C4_GOOGLE_OFFICE_POLICY_V1'
    &&policy.admission?.mode===C4_MODE&&same(policy.scope?.cellIds,C4_CELLS)
    &&policy.scope?.route==='C4'&&policy.scope?.volume==='SINGLE_SCENE'&&policy.scope?.profile==='SOURCE_RUNTIME'
    &&same(policy.scope?.fields,['TEXT','ORDER'])&&same(policy.scope?.hops,C4_HOPS)
    &&policy.scope?.expectedParagraphCount===12&&policy.scope?.sourceToken==='sentinel alpha'&&policy.scope?.suggestedToken==='sentinel omega'
    &&policy.scenePolicy?.kind==='scene'&&policy.scenePolicy?.exportCommandId==='cmd.project.review.exportDocxReviewPacket'
    &&policy.scenePolicy?.sceneCount===1&&policy.scenePolicy?.orderedSceneIdsCount===1&&policy.scenePolicy?.romanSectionRejected===true
    &&policy.providerPolicy?.nativeDocumentMimeType==='application/vnd.google-apps.document'
    &&policy.providerPolicy?.sourceMimeType==='application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    &&policy.providerPolicy?.exportMimeType==='application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    &&policy.providerPolicy?.uiMode==='SUGGESTING'&&same(policy.providerPolicy?.requiredUiStages,['suggestingMode','anchoredComment','reopen'])
    &&policy.admission?.denominatorMutation===false&&policy.admission?.productMutationAuthority===false
    &&policy.admission?.writerAuthority===false&&policy.admission?.admissionCreditFromRawReader===0,'C4_POLICY_SCOPE');
  for(const binding of policy.readerBindings||[]){
    const source=readOrderFile(ROOT,binding.path).bytes;
    const pinnedBytes=binding.normalization==='C4_POLICY_SHA256_ZEROED'
      ?Buffer.from(source.toString('utf8').replace(/export const C4_POLICY_SHA256='[a-f0-9]{64}';/u,
        "export const C4_POLICY_SHA256='"+'0'.repeat(64)+"';"))
      :source;
    demand(hash(pinnedBytes)===binding.sha256,'C4_READER_PIN:'+binding.path);
  }
  return {policy,sha256:C4_POLICY_SHA256};
}

function parseRunId(runId){
  demand(typeof runId==='string','C4_RUN_ID');
  const m=/^(TEXT|ORDER)__SINGLE_SCENE__C4__SOURCE_RUNTIME__([A-Za-z0-9_-]{1,80})$/u.exec(runId);
  demand(m,'C4_RUN_ID');
  return {runId,field:m[1],volume:'SINGLE_SCENE',route:'C4',profile:'SOURCE_RUNTIME',cellId:runId.slice(0,runId.lastIndexOf('__'))};
}

export function validateC4GoogleOfficeReadback(raw,{row,head,tree,observationSha256,files,policy}={}){
  demand(policy?.schemaVersion==='YALKEN_INTEROP_C4_GOOGLE_OFFICE_POLICY_V1'&&same(policy.scope?.cellIds,C4_CELLS)
    &&same(policy.scope?.hops,C4_HOPS),'C4_READBACK_POLICY');
  demand(row&&row.route==='C4'&&row.volume==='SINGLE_SCENE'&&row.profile==='SOURCE_RUNTIME'
    &&['TEXT','ORDER'].includes(row.field)&&row.cellId===`${row.field}__SINGLE_SCENE__C4__SOURCE_RUNTIME`,'C4_READBACK_ROW');
  demand(raw?.ok===true&&raw.schemaVersion==='YALKEN_C4_GOOGLE_OFFICE_RAW_V1'&&raw.admissionCredit===0
    &&raw.runId===row.runId&&raw.cellId===row.cellId&&raw.field===row.field&&raw.productHead===head&&raw.productTree===tree
    &&raw.observationSha256===observationSha256&&raw.filesVerified===files.length,'C4_READBACK_BINDING');
  const proof=raw.c4Proof;
  demand(proof?.schemaVersion==='YALKEN_C4_GOOGLE_OFFICE_PROOF_V1'&&proof.route==='C4'&&proof.volume==='SINGLE_SCENE'
    &&proof.profile==='SOURCE_RUNTIME'&&proof.field===row.field&&proof.runId===row.runId&&proof.cellId===row.cellId
    &&proof.productHead===head&&proof.productTree===tree,'C4_PROOF_BINDING');
  const required=policy.requiredArtifacts,bindings=proof.artifactBindings;
  demand(Array.isArray(required)&&bindings&&same(Object.keys(bindings).sort(),[...required].sort())
    &&Object.values(bindings).every(sha64),'C4_ARTIFACT_BINDINGS');
  const filesByPath=new Map(files.map(file=>[file.path,file]));
  for(const name of required){
    const file=filesByPath.get(`runs/${row.runId}/${name}`);
    demand(file&&file.sha256===bindings[name],'C4_ARTIFACT_HASH');
  }
  demand(!(policy.forbiddenArtifacts||[]).some(name=>filesByPath.has(`runs/${row.runId}/${name}`)),'C4_FORBIDDEN_APPLY');
  const scene=proof.scene,google=proof.googleOffice,intake=proof.intake,textOrder=proof.textOrder;
  demand(scene&&typeof scene.projectId==='string'&&scene.projectId.length>0&&typeof scene.sceneId==='string'&&scene.sceneId.length>0
    &&typeof scene.sceneNodeId==='string'&&/^[A-Za-z0-9_-]{8,128}$/u.test(scene.sceneNodeId)&&scene.sceneKind==='scene'
    &&scene.sceneCount===1&&same(scene.orderedSceneIds,[scene.sceneId])&&scene.paragraphCount===policy.scope.expectedParagraphCount
    &&[scene.sceneFileSha256,scene.sourceDocxSha256,scene.paragraphSha256,scene.paragraphOrderSha256,scene.exportCapsuleSha256].every(sha64)
    &&typeof scene.exportId==='string'&&/^[A-Za-z0-9_-]{8,128}$/u.test(scene.exportId)
    &&typeof scene.roundId==='string'&&/^[A-Za-z0-9_-]{8,128}$/u.test(scene.roundId),'C4_SCENE_IDENTITY');
  demand(google&&typeof google.nativeDocumentId==='string'&&/^[A-Za-z0-9_-]{10,200}$/u.test(google.nativeDocumentId)
    &&google.nativeDocumentMimeType===policy.providerPolicy.nativeDocumentMimeType
    &&google.exportMimeType===policy.providerPolicy.exportMimeType
    &&[google.sourceRevisionId,google.postSuggestionRevisionId,google.revisionBeforeExport,google.revisionAfterExport].every(value=>typeof value==='string'&&value.length>0)
    &&google.sourceRevisionId!==google.postSuggestionRevisionId&&google.revisionBeforeExport===google.revisionAfterExport
    &&google.revisionBeforeExport===google.postSuggestionRevisionId
    &&[google.sourceBodySha256,google.nativeBodySha256,google.returnedBodySha256,google.sourceDocxSha256,google.returnedDocxSha256,google.transcriptSha256].every(sha64)
    &&google.sourceDocxSha256===scene.sourceDocxSha256&&google.uiMode===policy.providerPolicy.uiMode
    &&google.suggestionObserved===true&&google.anchoredCommentObserved===true&&google.autosaveObserved===true&&google.reopenObserved===true
    &&google.postExportMutation===false&&Array.isArray(google.screenshots)
    &&same(google.screenshots.map(item=>item.stage),policy.providerPolicy.requiredUiStages)
    &&google.screenshots.every(item=>sha64(item.sha256))
    &&same(google.exactCreatedDocumentIds,[google.nativeDocumentId])&&same(google.deletedDocumentIds,[google.nativeDocumentId])
    &&google.cleanupVerified===true,'C4_GOOGLE_OFFICE');
  demand(intake&&intake.writerCalled===false&&intake.rendererAuthority===false&&intake.canAutoApply===false
    &&intake.canImportMutate===false&&intake.canWriteStorage===false&&intake.beforeSceneSha256===scene.sceneFileSha256
    &&intake.afterSceneSha256===scene.sceneFileSha256&&sha64(intake.previewBodySha256),'C4_ADVISORY_INTAKE');
  demand(textOrder&&textOrder.sourceBodySha256===google.sourceBodySha256&&textOrder.returnedBodySha256===google.returnedBodySha256
    &&textOrder.sourceParagraphCount===policy.scope.expectedParagraphCount&&textOrder.returnedParagraphCount===policy.scope.expectedParagraphCount
    &&textOrder.sourceOrderSha256===textOrder.returnedOrderSha256&&sha64(textOrder.sourceOrderSha256)
    &&textOrder.orderStableAfterSuggestion===true,'C4_TEXT_ORDER');
  const fieldProof=raw.fieldProof,expectedStageMap={
    'source-export':'source-review-export-phase.json','google-native-lifecycle':'google-docs-native-provider-receipt.json',
    'google-docx-export':'word-tracked-review-return.docx','yalken-return-intake':'review-return-intake.json','cleanup':'google-docs-native-cleanup.json',
  };
  demand(fieldProof?.field===row.field&&fieldProof.cellId===row.cellId&&fieldProof.runId===row.runId&&fieldProof.status==='PASS'
    &&fieldProof.outcome==='EXACT_OBSERVED_MANUSCRIPT_PRESERVATION'&&fieldProof.requiredCycles===1
    &&same(fieldProof.requiredHops,C4_HOPS)&&same(fieldProof.subcases,C4_SUBCASES[row.field])
    &&same(Object.keys(fieldProof.stageProofs||{}).sort(),C4_STAGES.slice().sort()),'C4_FIELD_PROOF');
  for(const [stage,name] of Object.entries(expectedStageMap))
    demand(fieldProof.stageProofs[stage]?.ok===true&&fieldProof.stageProofs[stage]?.artifactSha256===bindings[name],'C4_STAGE_BINDING');
  demand(same(fieldProof.proof,{sourceBodySha256:textOrder.sourceBodySha256,returnedBodySha256:textOrder.returnedBodySha256,
    sourceParagraphOrderSha256:textOrder.sourceOrderSha256,returnedParagraphOrderSha256:textOrder.returnedOrderSha256,
    sceneId:scene.sceneId,sceneCount:1,suggestionObserved:true}),'C4_FIELD_READBACK');
  demand(raw.roundProof?.ordinal===1&&raw.roundProof.exportId===scene.exportId&&raw.roundProof.roundId===scene.roundId
    &&raw.roundProof.exportSha256===scene.sourceDocxSha256&&raw.roundProof.returnedSha256===google.returnedDocxSha256
    &&same(raw.roundProof.savedSceneHashes,[scene.sceneFileSha256])&&raw.finalHops?.ok===true&&raw.finalHops.acceptanceCredit===0,'C4_ROUND_PROOF');
  const observation=filesByPath.get(`runs/${row.runId}/observation.json`);
  demand(observation&&observation.sha256===observationSha256,'C4_OBSERVATION_HASH');
  return true;
}

function labRevision(labRoot,revision,dataPolicy){
  demand(sha40(revision),'C4_LAB_REVISION');const git=gitAt(labRoot);git(['merge-base','--is-ancestor',dataPolicy.labBaseHead,revision]);
  const delta=git(['diff','--name-only','--no-renames',dataPolicy.labBaseHead,revision,'--']).trim().split('\n').filter(Boolean);
  demand(delta.every(file=>dataPolicy.allowedLabDeltaPaths.includes(file)||/^data\/cases\/[a-z][a-z0-9-]{0,63}\.json$/u.test(file)),'C4_LAB_SCOPE');
  const sets=Array.isArray(dataPolicy.labCodeBindingSets)&&dataPolicy.labCodeBindingSets.length?dataPolicy.labCodeBindingSets.map(set=>set.bindings):[dataPolicy.labCodeBindings];
  const pinned=sets.some(bindings=>Array.isArray(bindings)&&bindings.every(binding=>{
    try{return hash(Buffer.from(git(['show',revision+':'+binding.path])))===binding.sha256;}catch{return false;}
  }));demand(pinned,'C4_LAB_CODE_PIN');
}

function selectObservation(ledger,row){
  const matches=ledger.filter(item=>item.type==='PHYSICAL_OBSERVATION'&&item.runId===row.runId);
  demand(matches.length===1&&matches[0].cellId===row.cellId,'C4_EXACT_OBSERVATION');
  const observation=matches[0];
  demand(!ledger.some(item=>(item.runId===row.runId&&(item.stale===true||['PRIVACY_INVALIDATED','AUDIT_INVALIDATED_PHYSICAL_OBSERVATION'].includes(item.type)))
    ||(item.type==='EVIDENCE_SUPERSEDES'&&item.supersedesRunId===row.runId)
    ||(item.type==='AUDIT_INVALIDATED_PHYSICAL_OBSERVATION'&&item.artifactHash===observation.artifactHash)),'C4_INVALIDATED_OBSERVATION');
  return observation;
}

export function verifyC4GoogleOfficeBatch({repoRoot=ROOT,labRoot,runIds,requiredCells,specErrors=[]}={}){
  const started=performance.now(),errors=[...specErrors];let identity=null,runtimeIdentity=null,labIdentity=null,policy=null,reviews=[];
  try{
    demand(errors.length===0,'C4_SPEC_OR_MODE');
    demand(Array.isArray(runIds)&&runIds.length>=1&&runIds.length<=C4_CELLS.length,'C4_RUN_SET');
    const rows=runIds.map(parseRunId);demand(new Set(rows.map(row=>row.cellId)).size===rows.length,'C4_DUPLICATE_CELL');
    demand(fs.realpathSync(repoRoot)===ROOT,'C4_CHECKOUT');
    identity=cleanIdentity(ROOT,'C4_PRODUCT');
    demand(gitAt(ROOT)(['rev-parse','origin/main']).trim()===identity.head,'C4_CURRENT_MAIN');
    const loaded=loadC4Policy();policy=loaded.policy;
    const specFile=readOrderFile(ROOT,policy.denominatorPath);
    demand(hashBytes(specFile.bytes)===policy.denominatorSha256,'C4_DENOMINATOR_PIN');
    demand(Array.isArray(requiredCells)&&requiredCells.length===1120&&new Set(requiredCells.map(cell=>cell.cellId)).size===1120
      &&C4_CELLS.every(cellId=>requiredCells.some(cell=>cell.cellId===cellId)),'C4_DENOMINATOR_SCOPE');
    demand(rows.every(row=>C4_CELLS.includes(row.cellId)),'C4_CELL_SCOPE');
    labIdentity=cleanIdentity(labRoot,'C4_LAB');
    const dataPolicy=loadDataPolicy();
    const manifest=JSON.parse(readOrderFile(labRoot,'LAB_MANIFEST.json').bytes);const shadow=manifest.shadow?.yalken;
    const runtimeRoot=fs.realpathSync(shadow?.root);runtimeIdentity=cleanIdentity(runtimeRoot,'C4_RUNTIME');
    demand(shadow.readOnly===true&&shadow.head===runtimeIdentity.head&&shadow.tree===runtimeIdentity.tree
      &&shadow.declaredOriginMainHead===runtimeIdentity.head&&shadow.declaredOriginMainTree===runtimeIdentity.tree,'C4_RUNTIME_SHADOW');
    validateManuscriptVerifierPromotion({runtimeIdentity,verifierIdentity:identity,allowedPaths:policy.allowedVerifierPromotionPaths});
    demand(hash(readOrderFile(labRoot,'data/registry/frozen-denominator-registry-v2.json').bytes)===dataPolicy.labRegistrySha256,'C4_LAB_REGISTRY');
    labRevision(labRoot,labIdentity.head,dataPolicy);
    const ledgerFile=readOrderFile(labRoot,'data/evidence/ledger.jsonl',64*1024*1024);
    const ledger=ledgerFile.bytes.toString('utf8').trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));
    for(const row of rows){
      const prefix='runs/'+row.runId+'/',entry=selectObservation(ledger,row);
      const obsFile=readOrderFile(labRoot,prefix+'observation.json'),obs=JSON.parse(obsFile.bytes);
      demand(obs.runId===row.runId&&obs.cellId===row.cellId&&obs.field===row.field&&obs.volume===row.volume&&obs.route===row.route&&obs.profile===row.profile
        &&obs.artifactHash===entry.artifactHash&&obs.status==='PASS'&&obs.candidateDiagnosticOnly===false,'C4_OBSERVATION_STATUS');
      for(const key of ['labHead','labTree','createdAt','status','yalkenShadowHead','yalkenShadowTree'])demand(obs[key]===entry[key],'C4_LEDGER_BINDING');
      const noHash={...obs};delete noHash.artifactHash;
      demand(obs.artifactHashScope==='observation_without_artifactHash'&&hashOrderObservation(noHash)===obs.artifactHash,'C4_OBSERVATION_HASH');
      demand(obs.yalkenShadowHead===runtimeIdentity.head&&obs.yalkenShadowTree===runtimeIdentity.tree,'C4_ACTUAL_RUNTIME');
      const created=Date.parse(obs.createdAt);demand(Number.isFinite(created)&&created>=Date.parse(policy.timePolicy.notBeforeUtc)&&created<=Date.now(),'C4_OBSERVATION_TIME');
      labRevision(labRoot,obs.labHead,dataPolicy);demand(gitAt(labRoot)(['rev-parse',obs.labHead+'^{tree}']).trim()===obs.labTree,'C4_LAB_TREE');
      demand(Array.isArray(obs.artifacts)&&obs.artifacts.length>0&&obs.artifacts.length<=2048,'C4_OBSERVATION_ARTIFACTS');
      const artifactNames=obs.artifacts.map(item=>typeof item?.path==='string'&&item.path.startsWith(prefix)?item.path.slice(prefix.length):'');
      const expectedArtifactNames=[...policy.requiredArtifacts,policy.proofArtifact].sort();
      demand(new Set(artifactNames).size===artifactNames.length&&same([...artifactNames].sort(),expectedArtifactNames),
        'C4_OBSERVATION_ARTIFACT_BINDING');
      for(const name of policy.forbiddenArtifacts)demand(!artifactNames.includes(name),'C4_FORBIDDEN_APPLY');
      const directDescriptors=obs.artifacts.map(item=>{
        demand(typeof item.path==='string'&&item.path.startsWith(prefix)&&Number.isSafeInteger(item.bytes)&&item.bytes>=0&&sha64(item.sha256),'C4_OBSERVATION_ARTIFACT_DESCRIPTOR');
        const binding=readOrderFile(labRoot,item.path).binding;
        demand(binding.bytes===item.bytes&&binding.sha256===item.sha256,'C4_OBSERVATION_ARTIFACT_HASH');return binding;
      });
      const snapshot=JSON.parse(readOrderFile(labRoot,prefix+'runtime-project-snapshot.json').bytes);
      const files=[...directDescriptors,...snapshot.files].map(({path:filePath,bytes,sha256})=>({path:filePath,bytes,sha256}));files.push(obsFile.binding);
      demand(files.length<=2048&&new Set(files.map(file=>file.path)).size===files.length,'C4_INVENTORY');
      demand(files.every(file=>file.path.startsWith(prefix)&&Number.isSafeInteger(file.bytes)&&file.bytes>=0&&file.bytes<=32*1024*1024&&sha64(file.sha256))
        &&files.reduce((total,file)=>total+file.bytes,0)<=384*1024*1024,'C4_FILE_SCOPE');
      const request={root:fs.realpathSync(labRoot),runId:row.runId,productHead:runtimeIdentity.head,productTree:runtimeIdentity.tree,files,policy,
        packageJsonSha256:hash(readOrderFile(runtimeRoot,'package.json').bytes),packageLockSha256:hash(readOrderFile(runtimeRoot,'package-lock.json').bytes),
        electronVersion:dataPolicy.wordManuscriptBatch.electronVersion};
      const process=spawnSync('python3',['-I','-B',path.join(ROOT,'scripts/ops/rtk-interop-c4-google-office-readback.py')],
        {input:JSON.stringify(request),encoding:'utf8',timeout:120000,maxBuffer:8*1024*1024});
      demand(!process.error&&process.status===0,'C4_RAW_READBACK:'+String(process.stdout||process.stderr||process.error));
      const raw=JSON.parse(process.stdout);
      validateC4GoogleOfficeReadback(raw,{row,...runtimeIdentity,observationSha256:obsFile.binding.sha256,files,policy});
      reviews.push({runId:row.runId,cellId:row.cellId,observationArtifactHash:obs.artifactHash,raw});
    }
    demand(readOrderFile(labRoot,'data/evidence/ledger.jsonl',64*1024*1024).bytes.equals(ledgerFile.bytes)
      &&same(cleanIdentity(ROOT,'C4_PRODUCT'),identity)&&same(cleanIdentity(runtimeRoot,'C4_RUNTIME'),runtimeIdentity)
      &&same(cleanIdentity(labRoot,'C4_LAB'),labIdentity),'C4_CHANGED_DURING_REVIEW');
  }catch(error){errors.push(String(error.message));}
  const ok=errors.length===0,fieldProofs=ok?reviews.map(review=>review.raw.fieldProof):[];
  const acceptedCellIds=ok?[...new Set(fieldProofs.map(proof=>proof.cellId))].sort():[];
  return {ok,errors,contractId:'YALKEN_INTEROP_100_SUPPORTED_CONTRACT_V1',evidenceMode:C4_MODE,authoritativeAdmission:ok,
    requiredCells:1120,recordedCells:acceptedCellIds.length,passedRequiredCells:acceptedCellIds.length,acceptedCellIds,
    diagnosticPassedRequiredCells:0,broadPassClaim:false,claimVerdict:ok?'NEEDS_MORE_EVIDENCE':'FAIL_C4_GOOGLE_OFFICE_EVIDENCE',
    statusCounts:{PASS:acceptedCellIds.length,NOT_EXECUTED:1120-acceptedCellIds.length},currentHead:identity?.head||null,currentTree:identity?.tree||null,
    evidenceRuntimeHead:runtimeIdentity?.head||null,evidenceRuntimeTree:runtimeIdentity?.tree||null,
    percentage:acceptedCellIds.length/1120*100,cellDecisions:fieldProofs.map(proof=>({cellId:proof.cellId,status:'PASS',outcome:proof.outcome,sourceRunId:proof.runId})),
    policySha256:C4_POLICY_SHA256,rawReadbacks:ok?reviews:[],seconds:(performance.now()-started)/1000,
    limitations:['C4 SINGLE_SCENE TEXT/ORDER SOURCE_RUNTIME only.','PACKAGED_BUILD_RUNTIME and other C4 fields are outside this policy.','Raw readback is diagnostic only; only the outer exact-observation verifier emits cell acceptance.']};
}

'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const {pathToFileURL}=require('node:url');
const ROOT=path.resolve(__dirname,'../..');
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');

function fixture(field='TEXT'){
 const policy=JSON.parse(fs.readFileSync(path.join(ROOT,'docs/OPS/RTK/YALKEN_INTEROP_C4_GOOGLE_OFFICE_POLICY_V1.json'),'utf8'));
 const runId=`${field}__SINGLE_SCENE__C4__SOURCE_RUNTIME__contract`,cellId=runId.slice(0,runId.lastIndexOf('__'));
 const artifactBindings=Object.fromEntries(policy.requiredArtifacts.map(name=>[name,sha(name)]));
 const files=policy.requiredArtifacts.map(name=>({path:`runs/${runId}/${name}`,bytes:Buffer.byteLength(name),sha256:artifactBindings[name]}));
 const observationSha256=sha('observation');files.push({path:`runs/${runId}/observation.json`,bytes:11,sha256:observationSha256});
 const sceneSha=sha('scene'),sourceDocxSha=sha('source-docx'),returnedDocxSha=sha('returned-docx');
 const bodySha=sha('body'),orderSha=sha('order');
 const nativeId='a1b2c3d4e5f6g7h8i9j0';
 const scene={projectId:'synthetic-project',sceneId:'scenes/scene-001.txt',sceneNodeId:'tree-node-12345678',sceneKind:'scene',sceneCount:1,
  orderedSceneIds:['scenes/scene-001.txt'],sceneFileSha256:sceneSha,sourceDocxSha256:sourceDocxSha,paragraphCount:12,
  paragraphSha256:bodySha,paragraphOrderSha256:orderSha,exportCapsuleSha256:sha('capsule'),exportId:'export-12345678',roundId:'round-12345678'};
 const googleOffice={nativeDocumentId:nativeId,nativeDocumentMimeType:policy.providerPolicy.nativeDocumentMimeType,
  exportMimeType:policy.providerPolicy.exportMimeType,sourceRevisionId:'rev-source',postSuggestionRevisionId:'rev-after-edit',
  revisionBeforeExport:'rev-after-edit',revisionAfterExport:'rev-after-edit',sourceBodySha256:bodySha,nativeBodySha256:bodySha,
  returnedBodySha256:sha('returned-body'),sourceDocxSha256:sourceDocxSha,returnedDocxSha256:returnedDocxSha,
  uiMode:'SUGGESTING',suggestionObserved:true,anchoredCommentObserved:true,autosaveObserved:true,reopenObserved:true,postExportMutation:false,
  transcriptSha256:sha('transcript'),screenshots:policy.providerPolicy.requiredUiStages.map(stage=>({stage,sha256:sha(stage)})),
  exactCreatedDocumentIds:[nativeId],deletedDocumentIds:[nativeId],cleanupVerified:true};
 const intake={writerCalled:false,rendererAuthority:false,canAutoApply:false,canImportMutate:false,canWriteStorage:false,
  beforeSceneSha256:sceneSha,afterSceneSha256:sceneSha,previewBodySha256:sha('preview')};
 const textOrder={sourceBodySha256:bodySha,returnedBodySha256:googleOffice.returnedBodySha256,sourceParagraphCount:12,
  returnedParagraphCount:12,sourceOrderSha256:orderSha,returnedOrderSha256:orderSha,orderStableAfterSuggestion:true};
 const fieldProof={field,cellId,runId,status:'PASS',outcome:'EXACT_OBSERVED_MANUSCRIPT_PRESERVATION',requiredCycles:1,
  requiredHops:policy.scope.hops,subcases:field==='TEXT'
   ? ['bodyTextReadbackIndependent','emptyParagraphsAccounted','lineBreakPolicyDeclared','paragraphBoundariesPreserved','plainTextPreserved','whitespaceEdgesPreserved']
   : ['blockOrderPreserved','providerTraversalStable','roundTripOrderStable','reorderDetected','sortKeysHashBound','orderDiffVisible'],
  stageProofs:{'source-export':{ok:true,artifactSha256:artifactBindings['source-review-export-phase.json']},
   'google-native-lifecycle':{ok:true,artifactSha256:artifactBindings['google-docs-native-provider-receipt.json']},
   'google-docx-export':{ok:true,artifactSha256:artifactBindings['word-tracked-review-return.docx']},
   'yalken-return-intake':{ok:true,artifactSha256:artifactBindings['review-return-intake.json']},
   cleanup:{ok:true,artifactSha256:artifactBindings['google-docs-native-cleanup.json']}},
  proof:{sourceBodySha256:bodySha,returnedBodySha256:textOrder.returnedBodySha256,sourceParagraphOrderSha256:orderSha,
   returnedParagraphOrderSha256:orderSha,sceneId:scene.sceneId,sceneCount:1,suggestionObserved:true}};
 const raw={ok:true,schemaVersion:'YALKEN_C4_GOOGLE_OFFICE_RAW_V1',admissionCredit:0,runId,cellId,field,
  productHead:'b'.repeat(40),productTree:'c'.repeat(40),observationSha256,filesVerified:files.length,fieldProof,
  roundProof:{ordinal:1,exportId:scene.exportId,roundId:scene.roundId,exportSha256:sourceDocxSha,returnedSha256:returnedDocxSha,savedSceneHashes:[sceneSha]},
  finalHops:{ok:true,acceptanceCredit:0},c4Proof:{schemaVersion:'YALKEN_C4_GOOGLE_OFFICE_PROOF_V1',route:'C4',volume:'SINGLE_SCENE',
   profile:'SOURCE_RUNTIME',field,runId,cellId,productHead:'b'.repeat(40),productTree:'c'.repeat(40),artifactBindings,scene,googleOffice,intake,textOrder}};
 return {policy,files,raw,row:{runId,field,cellId,volume:'SINGLE_SCENE',route:'C4',profile:'SOURCE_RUNTIME'},head:'b'.repeat(40),tree:'c'.repeat(40),observationSha256};
}

test('C4 source-runtime consumer remains limited to its two frozen cells and route',async()=>{
 const {C4_CELLS,C4_HOPS,validateC4GoogleOfficeReadback}=await import(pathToFileURL(path.join(ROOT,'scripts/ops/rtk-interop-c4-google-office-batch.mjs')));
 assert.deepEqual(C4_CELLS,['TEXT__SINGLE_SCENE__C4__SOURCE_RUNTIME','ORDER__SINGLE_SCENE__C4__SOURCE_RUNTIME']);
 assert.deepEqual(C4_HOPS,['YALKEN_DOCX_EXPORT','GOOGLE_OFFICE_LIFECYCLE','YALKEN_RETURN_INTAKE']);
 for(const field of ['TEXT','ORDER']){
  const f=fixture(field);
  assert.equal(validateC4GoogleOfficeReadback(f.raw,{row:f.row,head:f.head,tree:f.tree,observationSha256:f.observationSha256,files:f.files,policy:f.policy}),true);
 }
});

test('C4 proof rejects scene mismatch, apply authority, stale revision, cleanup gaps and byte drift',async()=>{
 const {validateC4GoogleOfficeReadback}=await import(pathToFileURL(path.join(ROOT,'scripts/ops/rtk-interop-c4-google-office-batch.mjs')));
 const cases=[
  f=>f.raw.c4Proof.scene.sceneKind='roman-section',
  f=>f.raw.c4Proof.scene.sceneCount=0,
  f=>f.raw.c4Proof.intake.writerCalled=true,
  f=>f.raw.c4Proof.intake.rendererAuthority=true,
  f=>f.raw.c4Proof.googleOffice.revisionAfterExport='stale-revision',
  f=>f.raw.c4Proof.googleOffice.deletedDocumentIds=[],
  f=>f.raw.c4Proof.googleOffice.screenshots.pop(),
  f=>f.raw.c4Proof.textOrder.returnedOrderSha256='d'.repeat(64),
  f=>f.raw.admissionCredit=1,
  f=>f.raw.c4Proof.artifactBindings['word-tracked-review-return.docx']='e'.repeat(64),
 ];
 for(const mutate of cases){const f=fixture();mutate(f);assert.throws(()=>validateC4GoogleOfficeReadback(f.raw,{row:f.row,head:f.head,tree:f.tree,
  observationSha256:f.observationSha256,files:f.files,policy:f.policy}));}
 const f=fixture();f.files.push({path:`runs/${f.row.runId}/review-apply-receipt.json`,bytes:1,sha256:sha('apply')});f.raw.filesVerified=f.files.length;
 f.raw.c4Proof.artifactBindings['review-apply-receipt.json']=sha('apply');
 f.policy.requiredArtifacts.push('review-apply-receipt.json');f.raw.c4Proof.artifactBindings=Object.fromEntries(f.policy.requiredArtifacts.map(name=>[name,f.raw.c4Proof.artifactBindings[name]||sha(name)]));
 assert.throws(()=>validateC4GoogleOfficeReadback(f.raw,{row:f.row,head:f.head,tree:f.tree,observationSha256:f.observationSha256,files:f.files,policy:f.policy}));
});

test('C4 policy scopes evidence separately and leaves both canonical policies untouched',async()=>{
 const c4=JSON.parse(fs.readFileSync(path.join(ROOT,'docs/OPS/RTK/YALKEN_INTEROP_C4_GOOGLE_OFFICE_POLICY_V1.json'),'utf8'));
 const denominator=JSON.parse(fs.readFileSync(path.join(ROOT,'docs/OPS/RTK/YALKEN_INTEROP_100_DENOMINATOR_V1.json'),'utf8'));
 const data=JSON.parse(fs.readFileSync(path.join(ROOT,'docs/OPS/RTK/YALKEN_INTEROP_DATA_C1_POLICY_V1.json'),'utf8'));
 const batchPath=path.join(ROOT,'scripts/ops/rtk-interop-c4-google-office-batch.mjs');
 const normalized=fs.readFileSync(batchPath,'utf8').replace(/export const C4_POLICY_SHA256='[a-f0-9]{64}';/u,
  "export const C4_POLICY_SHA256='"+'0'.repeat(64)+"';");
 assert.equal(c4.admission.denominatorMutation,false);assert.deepEqual(c4.scope.cellIds,['TEXT__SINGLE_SCENE__C4__SOURCE_RUNTIME','ORDER__SINGLE_SCENE__C4__SOURCE_RUNTIME']);
 assert.equal(denominator.denominator.expectedRequiredCells,1120);assert.equal(data.schemaVersion,'YALKEN_INTEROP_DATA_C1_POLICY_V1');
 assert.equal(data.wordManuscriptBatch.cellIds.length,300);
 assert.equal(c4.scenePolicy.exportCommandId,'cmd.project.review.exportDocxReviewPacket');assert.equal(sha(fs.readFileSync(path.join(ROOT,'docs/OPS/RTK/YALKEN_INTEROP_C4_GOOGLE_OFFICE_POLICY_V1.json'))),
  (await import(pathToFileURL(batchPath))).C4_POLICY_SHA256);
 for(const binding of c4.readerBindings){
  const bytes=fs.readFileSync(path.join(ROOT,binding.path));
  assert.equal(sha(binding.normalization==='C4_POLICY_SHA256_ZEROED'?Buffer.from(normalized):bytes),binding.sha256,binding.path);
 }
});

test('C4 options route to the isolated mode and malformed scope returns zero credit',async()=>{
 const {verifyInterop100}=await import(pathToFileURL(path.join(ROOT,'scripts/ops/rtk-interop-100-denominator-v1.mjs')));
 const report=verifyInterop100(ROOT,{c4GoogleOfficeLabRoot:'/tmp',c4GoogleOfficeRunIds:['ORDER__LARGE_DOCUMENT__C1__SOURCE_RUNTIME__bad'],spec:{}});
 assert.equal(report.evidenceMode,'C4_GOOGLE_OFFICE_BATCH_V1');assert.equal(report.passedRequiredCells,0);
 assert.deepEqual(report.acceptedCellIds,[]);assert.equal(report.authoritativeAdmission,false);
});

test('Independent C4 raw reader rejects an invalid route ID with zero admission credit',()=>{
 const policy=JSON.parse(fs.readFileSync(path.join(ROOT,'docs/OPS/RTK/YALKEN_INTEROP_C4_GOOGLE_OFFICE_POLICY_V1.json'),'utf8'));
 const result=spawnSync('python3',['-I','-B','scripts/ops/rtk-interop-c4-google-office-readback.py'],{cwd:ROOT,encoding:'utf8',
  input:JSON.stringify({root:ROOT,runId:'ORDER__SINGLE_SCENE__C1__SOURCE_RUNTIME__bad',policy})});
 assert.equal(result.status,1,result.stdout+result.stderr);
 const report=JSON.parse(result.stdout);assert.equal(report.ok,false);assert.equal(report.admissionCredit,0);assert.equal(report.error,'C4_RUN_ID');
});

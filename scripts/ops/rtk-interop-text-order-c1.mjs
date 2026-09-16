import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {performance} from 'node:perf_hooks';
import {ORDER_CELL,inspectOrderArtifacts,readOrderFile,stableOrderJson,validateOrderRunId} from './rtk-interop-order-c1.mjs';

export const TEXT_CELL='TEXT__SINGLE_SCENE__C1__SOURCE_RUNTIME';
export const SHARED_CELLS=Object.freeze([TEXT_CELL,ORDER_CELL]);
export const SHARED_MODE='SHARED_TEXT_ORDER_RECIPE_REVIEW_V1';
export const SHARED_POLICY_PATH='docs/OPS/RTK/YALKEN_INTEROP_TEXT_ORDER_C1_RECIPE_POLICY_V1.json';
export const SHARED_POLICY_SHA256='8fd205ca279453d7d34bd158d36348ec4c827581c94b7256eed57c8acd680fcc';
export const SHARED_BASE='d91813a56d14f08dcd9f6ed1fad61bddacff05a4';
export const SHARED_BASE_TREE='7e1e5e52ac176654a85c3d533ecfbffc4f29bf00';
export const SHARED_ADMITTED_PATHS=Object.freeze([
  'docs/tasks/2026-09-16--interop-text-order-shared-c1.md',SHARED_POLICY_PATH,
  'scripts/ops/rtk-interop-text-order-c1.mjs','scripts/ops/rtk-interop-text-c1-readback.py',
  'scripts/ops/rtk-interop-100-denominator-v1.mjs','test/contracts/rtk-interop-100-denominator.contract.test.js',
  'scripts/ops/r24/corrective/post-audit-certification-set.mjs',
  'docs/OPS/R24/CORRECTIVE/C1B_TEST_INVENTORY_V1.json',
  'docs/OPS/RTK/YALKEN_INTEROP_100_GOVERNANCE_CHANGE_APPROVALS_V1.json',
  'docs/OPS/R24/CORRECTIVE/PK1R1_GOVERNANCE_CHANGE_APPROVALS_V1.json',
  'docs/OPS/R24/CORRECTIVE/C2A_GOVERNANCE_CHANGE_APPROVALS_V1.json',
]);
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const SPEC_PATH='docs/OPS/RTK/YALKEN_INTEROP_100_DENOMINATOR_V1.json';
const SPEC_SHA='5a4bc6e1d3946028ca4fa71fba622727a29d65d5a1c0cf7e5a76126504ddad93';
const TEXT_RAW_PATH='scripts/ops/rtk-interop-text-c1-readback.py';
const FIXTURE_SHA='693edfc41dd7963622bb9c5e6ea1a2766ea05245e8e390781e8c64988df278e1';
export const TEXT_SUBCASES=Object.freeze(['bodyTextReadbackIndependent','emptyParagraphsAccounted',
  'lineBreakPolicyDeclared','paragraphBoundariesPreserved','plainTextPreserved','whitespaceEdgesPreserved']);
export const TEXT_CONTROL_IDS=Object.freeze(['content-replacement','leading-space','trailing-space',
  'nbsp-substitution','unicode-nfd','zwj-deletion','empty-paragraph-deletion','embedded-line-break',
  'cyrillic-deletion','cjk-insertion']);
export const stableSharedJson=stableOrderJson;
export const sharedHash=b=>createHash('sha256').update(b).digest('hex');
const same=(a,b)=>stableSharedJson(a)===stableSharedJson(b);
const requireThat=(condition,code)=>{if(!condition)throw new Error(code);};
const sha40=v=>typeof v==='string'&&/^[a-f0-9]{40}$/u.test(v);
const gitAt=root=>args=>execFileSync('git',args,{cwd:root,encoding:'utf8',timeout:10000,maxBuffer:16*1024*1024});
function cleanIdentity(root) {
  const git=gitAt(root);
  requireThat(!git(['status','--porcelain=v1','--untracked-files=all']).trim(),'SHARED_DIRTY_CHECKOUT');
  const [head,tree]=git(['rev-parse','HEAD','HEAD^{tree}']).trim().split('\n');
  requireThat(sha40(head)&&sha40(tree),'SHARED_GIT_IDENTITY');
  return {head,tree};
}
export function readSharedPolicy(bytes) {
  requireThat(sharedHash(bytes)===SHARED_POLICY_SHA256,'SHARED_POLICY_PIN');
  const p=JSON.parse(bytes);
  requireThat(p.schemaVersion==='YALKEN_TEXT_ORDER_C1_RECIPE_POLICY_V1'&&p.sourceCellId===ORDER_CELL
    &&same(p.targetCellIds,SHARED_CELLS)&&p.productSpecSha256===SPEC_SHA
    &&p.baseSha===SHARED_BASE&&p.baseTree===SHARED_BASE_TREE
    &&same(p.admittedPaths,SHARED_ADMITTED_PATHS)&&same(p.textSubcases,TEXT_SUBCASES)
    &&same(p.textControlIds,TEXT_CONTROL_IDS),'SHARED_POLICY_SCOPE');
  return p;
}
export function verifyTextOrderPostEvaluation({candidateSha='HEAD',git=gitAt(ROOT)}={}) {
  const resolved=git(['rev-parse',candidateSha]).trim();
  requireThat(sha40(resolved),'SHARED_GIT_HEAD');
  if(!git(['ls-tree','--name-only',resolved,'--',SHARED_POLICY_PATH]).trim())
    return {status:'NOT_APPLICABLE',admittedPaths:[]};
  const policy=readSharedPolicy(git(['show',resolved+':'+SHARED_POLICY_PATH]));
  const revisions=git(['log','--format=%H',resolved,'--',SHARED_POLICY_PATH]).trim().split('\n').filter(Boolean);
  requireThat(revisions.length>0&&revisions.length<=32,'SHARED_DELIVERY_IDENTITY');
  const delivery=revisions.filter(sha=>sharedHash(git(['show',sha+':'+SHARED_POLICY_PATH]))===SHARED_POLICY_SHA256).at(-1);
  requireThat(sha40(delivery),'SHARED_DELIVERY_IDENTITY');
  git(['merge-base','--is-ancestor',SHARED_BASE,delivery]);
  requireThat(git(['rev-parse',SHARED_BASE+'^{tree}']).trim()===SHARED_BASE_TREE,'SHARED_BASE_TREE');
  const changed=git(['diff','--name-only','--no-renames',SHARED_BASE,delivery,'--']).trim().split('\n').filter(Boolean);
  requireThat(changed.every(p=>SHARED_ADMITTED_PATHS.includes(p)),'SHARED_UNADMITTED_DELTA');
  for(const b of policy.protectedFiles)
    requireThat(sharedHash(git(['show',resolved+':'+b.path]))===b.sha256,'SHARED_PROTECTED_FILE');
  const drift=new Set(git(['diff','--name-only','--no-renames',delivery,resolved,'--',...SHARED_ADMITTED_PATHS]).trim().split('\n').filter(Boolean));
  const immutable=[SHARED_POLICY_PATH,TEXT_RAW_PATH,'scripts/ops/rtk-interop-text-order-c1.mjs',
    'docs/tasks/2026-09-16--interop-text-order-shared-c1.md'];
  requireThat(immutable.every(p=>!drift.has(p)),'SHARED_IMPLEMENTATION_DRIFT');
  return {status:'PASS',deliverySha:delivery,admittedPaths:SHARED_ADMITTED_PATHS.filter(p=>!drift.has(p)),
    cellAcceptanceAuthority:false,programDone:false};
}

export function validateTextRawResult(raw,common) {
  const r=common.review;
  requireThat(raw?.ok===true&&raw.schemaVersion==='TEXT_C1_RAW_READBACK_V1'&&raw.admissionCredit===0
    &&raw.cellId===TEXT_CELL&&raw.sourceCellId===ORDER_CELL&&raw.runId===r.runId
    &&raw.productHead===r.productHead&&raw.productTree===r.productTree
    &&raw.observationSha256===r.observationSha256&&raw.fixtureParagraphSha256===FIXTURE_SHA
    &&raw.sourceDocxSha256===r.sourceDocxSha256&&raw.returnedDocxSha256===r.returnedDocxSha256
    &&raw.persistedSceneSha256===r.persistedSceneSha256&&raw.filesVerified===r.files.length
    &&same(raw.subcases,TEXT_SUBCASES),'SHARED_TEXT_RAW_BINDING');
  requireThat(same(raw.controls?.positiveControls,['identity','split-xml-runs'])
    &&same(raw.controls?.rawMutantsExecuted?.map(x=>x.id),TEXT_CONTROL_IDS)
    &&new Set(raw.controls.rawMutantsExecuted.map(x=>x.sha256)).size===TEXT_CONTROL_IDS.length
    &&raw.controls.rawMutantsExecuted.every(x=>x.rejected===true&&/^[a-f0-9]{64}$/u.test(x.sha256)
      &&x.failure===(x.id==='embedded-line-break'?'TEXT_CONTROL_LINE_BREAK_POLICY':'TEXT_CONTROL_CODEPOINTS_OR_BOUNDARIES')),
    'SHARED_TEXT_CONTROLS');
  requireThat(raw.presence?.paragraphs===12&&same(raw.presence.emptyParagraphOrdinals,[1,10])
    &&same(raw.presence.whitespaceEdgeOrdinals,[9])&&raw.presence.localeProfiles===7
    &&same(Object.keys(raw.stageParagraphSha256).sort(),['source','export-docx','word-native','returned-docx',
      'source-renderer','import-renderer','persisted','reopened'].sort())
    &&Object.values(raw.stageParagraphSha256).every(h=>h===FIXTURE_SHA)
    &&raw.lineBreakPolicy==='NO_EMBEDDED_BREAKS;SOURCE_DOUBLE_LF;PERSISTED_SINGLE_LF;WORD_NATIVE_CR',
    'SHARED_TEXT_NONVACUOUS_FACTS');
  return true;
}

// Candidate replay shares bytes and parsing with the delivered bounded reader.
// It deliberately grants zero credit and omits current-main/source authority.
export function inspectTextOrderArtifacts({labRoot,runId,productHead,productTree}={}) {
  const started=performance.now();
  const policy=readSharedPolicy(readOrderFile(ROOT,SHARED_POLICY_PATH).bytes);
  for(const b of policy.protectedFiles)
    requireThat(sharedHash(readOrderFile(ROOT,b.path).bytes)===b.sha256,'SHARED_PROTECTED_FILE');
  requireThat(sharedHash(readOrderFile(ROOT,TEXT_RAW_PATH).bytes)===policy.textRawCheckerSha256,'SHARED_TEXT_CHECKER_PIN');
  const common=inspectOrderArtifacts({labRoot,runId,productHead,productTree});
  const result=spawnSync('python3',['-I','-B',path.join(ROOT,TEXT_RAW_PATH)],{
    shell:false,timeout:10000,maxBuffer:1024*1024,encoding:'utf8',
    input:JSON.stringify({root:labRoot,runId,productHead,productTree,files:common.review.files})});
  requireThat(!result.error&&result.status===0,'SHARED_TEXT_RAW_FAILED:'+
    (result.error?.code||result.stdout?.trim()||result.signal||result.status));
  const text=JSON.parse(result.stdout);validateTextRawResult(text,common);
  const {seconds:_seconds,...textFacts}=text;
  const fields=[
    {cellId:TEXT_CELL,field:'TEXT',outcome:'PRESERVED',subcases:text.subcases,
      oracles:common.raw.oracles,checkerSha256:policy.textRawCheckerSha256,
      controls:text.controls,facts:textFacts},
    {cellId:ORDER_CELL,field:'ORDER',outcome:'PRESERVED',subcases:common.raw.subcases,
      oracles:common.raw.oracles,checkerSha256:common.review.rawCheckerSha256,
      controls:common.raw.controls,facts:{semanticParagraphSha256:common.raw.semanticParagraphSha256}},
  ];
  const review={schemaVersion:'TEXT_ORDER_C1_MACHINE_REVIEW_INDEX_V1',reviewMode:SHARED_MODE,
    sourceCellId:ORDER_CELL,targetCellIds:SHARED_CELLS,runId,policySha256:SHARED_POLICY_SHA256,
    productHead,productTree,labRuntimeHead:common.observation.labHead,labRuntimeTree:common.observation.labTree,
    observationArtifactHash:common.observation.artifactHash,observationSha256:common.review.observationSha256,
    artifactSetSha256:common.review.artifactSetSha256,files:common.review.files,
    commonOrderReviewSha256:sharedHash(Buffer.from(stableSharedJson(common.review)+'\n')),
    fieldProofs:fields,productAdmissionCredit:0};
  for(const b of review.files)requireThat(same(readOrderFile(labRoot,b.path).binding,b),'SHARED_ARTIFACT_CHANGED_DURING_READ');
  const ledger=readOrderFile(labRoot,'data/evidence/ledger.jsonl',64*1024*1024).bytes.toString('utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
  requireThat(same(ledger,common.ledger),'SHARED_LEDGER_CHANGED_DURING_READ');
  return {ok:true,admissionCredit:0,review,raw:{ORDER:common.raw,TEXT:text},
    ledger,observation:common.observation,seconds:(performance.now()-started)/1000};
}

export function inspectTextOrderEvidence({repoRoot=ROOT,labRoot,runId,currentHead}={}) {
  const started=performance.now();validateOrderRunId(runId);
  requireThat(fs.realpathSync(repoRoot)===ROOT,'SHARED_VERIFIER_CHECKOUT');
  const identity=cleanIdentity(repoRoot),git=gitAt(repoRoot);
  requireThat(git(['rev-parse','origin/main']).trim()===identity.head,'SHARED_CURRENT_MAIN_REQUIRED');
  requireThat(!currentHead||currentHead===identity.head,'SHARED_ACTUAL_HEAD_MISMATCH');
  const policy=readSharedPolicy(readOrderFile(ROOT,SHARED_POLICY_PATH).bytes);
  requireThat(sharedHash(readOrderFile(ROOT,SPEC_PATH).bytes)===SPEC_SHA,'SHARED_SPEC_DRIFT');
  const labIdentity=cleanIdentity(labRoot),labGit=gitAt(labRoot);
  const manifest=JSON.parse(readOrderFile(labRoot,'LAB_MANIFEST.json').bytes);
  const shadow=manifest.shadow.yalken;
  requireThat(fs.realpathSync(shadow.root)===ROOT&&shadow.readOnly===true
    &&shadow.head===identity.head&&shadow.tree===identity.tree
    &&shadow.declaredOriginMainHead===identity.head&&shadow.declaredOriginMainTree===identity.tree,'SHARED_SHADOW_BINDING');
  requireThat(sharedHash(readOrderFile(labRoot,'data/registry/frozen-denominator-registry-v2.json').bytes)===policy.labRegistrySha256,'SHARED_LAB_REGISTRY');
  const facts=inspectTextOrderArtifacts({labRoot,runId,productHead:identity.head,productTree:identity.tree});
  const {ledger,observation}=facts;
  requireThat(!ledger.some(e=>(e.runId===runId&&(e.stale===true||['PRIVACY_INVALIDATED','AUDIT_INVALIDATED_PHYSICAL_OBSERVATION'].includes(e.type)))
    ||(e.type==='EVIDENCE_SUPERSEDES'&&e.supersedesRunId===runId)
    ||(e.type==='AUDIT_INVALIDATED_PHYSICAL_OBSERVATION'&&e.artifactHash===observation.artifactHash)),'SHARED_INVALIDATED');
  for(const revision of new Set([observation.labHead,labIdentity.head])) {
    requireThat(sha40(revision),'SHARED_LAB_IDENTITY');
    labGit(['merge-base','--is-ancestor',policy.labBaseHead,revision]);
    const changed=labGit(['diff','--name-only','--no-renames',policy.labBaseHead,revision,'--']).trim().split('\n').filter(Boolean);
    requireThat(changed.every(p=>policy.allowedLabDeltaPaths.includes(p)),'SHARED_LAB_RUNTIME_DRIFT');
    for(const b of policy.labCodeBindings)
      requireThat(sharedHash(labGit(['show',revision+':'+b.path]))===b.sha256,'SHARED_LAB_CODE_PIN');
  }
  requireThat(labGit(['rev-parse',observation.labHead+'^{tree}']).trim()===observation.labTree,'SHARED_LAB_RUNTIME_TREE');
  requireThat(Date.parse(observation.createdAt)>=Date.parse(policy.notBeforeUtc)
    &&Date.parse(observation.createdAt)<=Date.now(),'SHARED_OBSERVATION_TIME');
  requireThat(same(cleanIdentity(repoRoot),identity)&&same(cleanIdentity(labRoot),labIdentity),'SHARED_IDENTITY_CHANGED_DURING_READ');
  return {...facts,labIdentity,seconds:(performance.now()-started)/1000};
}

export function validateTextOrderAcceptances(entries,review) {
  requireThat(Array.isArray(entries)&&entries.length===2
    &&same(entries.map(e=>e.cellId).sort(),[...SHARED_CELLS].sort()),'SHARED_DECISION_SET');
  const indexHash=sharedHash(Buffer.from(stableSharedJson(review)+'\n'));
  for(const entry of entries) {
    const proof=review.fieldProofs.find(f=>f.cellId===entry.cellId);
    requireThat(entry.type==='CELL_ACCEPTED'&&entry.admissionMode===SHARED_MODE&&entry.status==='PASS'
      &&entry.field===proof.field&&entry.sourceRunId===review.runId&&entry.sourceCellId===ORDER_CELL
      &&entry.sourceObservationHash===review.observationArtifactHash
      &&entry.productHead===review.productHead&&entry.productTree===review.productTree
      &&entry.policySha256===SHARED_POLICY_SHA256&&entry.reviewIndexSha256===indexHash
      &&entry.fieldProofSha256===sharedHash(Buffer.from(stableSharedJson(proof))),'SHARED_FIELD_ACCEPTANCE_BINDING');
  }
  return true;
}
export function verifyTextOrderC1(options={}) {
  const started=performance.now(),errors=[...(options.specErrors||[])];let result=null;
  try {
    requireThat(!errors.length&&options.requiredCells?.length===1120
      &&new Set(options.requiredCells.map(c=>c.cellId)).size===1120
      &&SHARED_CELLS.every(id=>options.requiredCells.some(c=>c.cellId===id)),'SHARED_DENOMINATOR_INVALID');
    result=inspectTextOrderEvidence(options);
    const accepted=result.ledger.filter(e=>e.type==='CELL_ACCEPTED'&&e.admissionMode===SHARED_MODE&&e.sourceRunId===options.runId);
    validateTextOrderAcceptances(accepted,result.review);
    const index=readOrderFile(options.labRoot,'runs/'+options.runId+'/text-order-review-index.json').bytes;
    requireThat(index.equals(Buffer.from(stableSharedJson(result.review)+'\n')),'SHARED_REVIEW_INDEX_BINDING');
  } catch(error) {errors.push(String(error.message));}
  const ok=errors.length===0;
  return {ok,errors,contractId:'YALKEN_INTEROP_100_SUPPORTED_CONTRACT_V1',evidenceMode:'TEXT_ORDER_C1_RECIPE_V1',
    authoritativeAdmission:ok,requiredCells:1120,recordedCells:ok?2:0,passedRequiredCells:ok?2:0,
    acceptedCellIds:ok?[...SHARED_CELLS]:[],cellDecisions:ok?result.review.fieldProofs.map(f=>({
      cellId:f.cellId,status:'PASS',outcome:f.outcome,sourceRunId:options.runId,
      fieldProofSha256:sharedHash(Buffer.from(stableSharedJson(f)))})):[],
    diagnosticPassedRequiredCells:0,percentage:ok?0.178571:0,statusCounts:{PASS:ok?2:0,NOT_EXECUTED:ok?1118:1120},
    broadPassClaim:false,claimVerdict:ok?'NEEDS_MORE_EVIDENCE':'FAIL_TEXT_ORDER_C1_EVIDENCE',
    currentHead:result?.review.productHead||null,currentTree:result?.review.productTree||null,
    runId:options.runId,policySha256:SHARED_POLICY_SHA256,rawReadback:result?.raw||null,
    reviewIndexSha256:result?sharedHash(Buffer.from(stableSharedJson(result.review)+'\n')):null,
    seconds:(performance.now()-started)/1000,
    limitations:['Two fixed field decisions from one known Product.C1 source execution. Other fields and historical different-head evidence are not added.']};
}

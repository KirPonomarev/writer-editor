import fs from 'node:fs';
import path from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {performance} from 'node:perf_hooks';
import {readOrderFile,stableOrderJson,hashOrderObservation} from './rtk-interop-order-c1.mjs';
import {loadDataPolicy,DATA_POLICY_SHA256,hash} from './rtk-interop-data-c1.mjs';
import {MANUSCRIPT_VOLUMES,MANUSCRIPT_CELLS,manuscriptFields,UNICODE_PROBES} from './rtk-interop-word-manuscript-fixtures.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const READER='scripts/ops/rtk-interop-word-manuscript-readback.py';
const SPEC='docs/OPS/RTK/YALKEN_INTEROP_100_DENOMINATOR_V1.json';
export const MANUSCRIPT_BATCH_MODE='WORD_MANUSCRIPT_BATCH_V1';
export const MANUSCRIPT_HOPS=Object.freeze({
 C1:['YALKEN_EXPORT','WORD_LIFECYCLE','YALKEN_RETURN_INTAKE'],
 C2:['YALKEN_EXPORT','WORD_LIFECYCLE','YALKEN_RETURN_INTAKE','YALKEN_APPLY','YALKEN_REEXPORT','WORD_REOPEN_READBACK'],
 C3:['YALKEN_EXPORT_ROUND_N','WORD_LIFECYCLE_ROUND_N','YALKEN_RETURN_INTAKE_ROUND_N','YALKEN_APPLY_ROUND_N'],
});
export const MANUSCRIPT_SUBCASES=Object.freeze({
 TEXT:['bodyTextReadbackIndependent','emptyParagraphsAccounted','lineBreakPolicyDeclared','paragraphBoundariesPreserved','plainTextPreserved','whitespaceEdgesPreserved'],
 ORDER:['blockOrderPreserved','providerTraversalStable','roundTripOrderStable','reorderDetected','sortKeysHashBound','orderDiffVisible'],
 UNICODE_IME_LOCALE:['unicodeNormalizationStable','bidiRunsAccounted','imeCompositionTextPreserved','localeProfileBound','fontScriptFallbackDeclared','unicodeReadbackIndependent'],
 STYLES:['inlineStylesAccounted','paragraphStylesAccounted','styleCascadeReadback','fontFallbackLedgered','unsupportedStylesDeclared','styleHashBound'],
 NOVEL_SCENE_STRUCTURE:['sceneBoundariesPreserved','chapterOrderPreserved','splitMergeDetected','projectHierarchyMapped','structureLossLedgered','sceneCountReadback'],
});
const TEXT_CONTROLS=['swap-paragraphs','delete-empty','trim-spaces','corrupt-unicode','drop-final-paragraph','duplicate-paragraph','swap-scenes','truncate-half','corrupt-last-scene','normalize-nfd','remove-bidi-isolate','remove-ime-character'];
const STYLE_CONTROLS=['remove-bold','change-align','change-heading','change-font','change-number-start','remove-code-style'];
const STRUCTURE_CONTROLS=['remove-bookmark','duplicate-bookmark','swap-scene-bookmarks','remove-scene','swap-chapters','merge-scene-path'];
export function manuscriptStages(route){
 const stages={source:0,'source-renderer':0,composition:0},cycles=route==='C3'?5:1;
 for(let n=1;n<=cycles;n++){
  const r=route==='C1'?0:n,p='rounds/'+n;
  stages[p+'/export-docx']=route==='C1'?0:n-1;stages[p+'/word-native']=r;stages[p+'/word-docx']=r;
  if(route!=='C1'){stages[p+'/persisted']=r;stages[p+'/applied-renderer']=r;}
 }
 if(route==='C1')for(const p of ['import-renderer','imported-raw','persisted','saved-renderer','reopened-renderer'])stages[p]=0;
 else for(const p of ['reopened-persisted','reopened-renderer','reexport-docx','final-word-lifecycle-native','final-word-lifecycle-docx'])stages[p]=cycles;
 return stages;
}
const demand=(ok,code)=>{if(!ok)throw new Error(code);};
const same=(a,b)=>stableOrderJson(a)===stableOrderJson(b);
const sha40=x=>typeof x==='string'&&/^[a-f0-9]{40}$/u.test(x);
const sha64=x=>typeof x==='string'&&/^[a-f0-9]{64}$/u.test(x);
const gitAt=root=>args=>execFileSync('git',args,{cwd:root,encoding:'utf8',timeout:10000,maxBuffer:16*1024*1024});
const json=(root,file,max)=>JSON.parse(readOrderFile(root,file,max).bytes);
function clean(root){
  const git=gitAt(root);
  demand(!git(['status','--porcelain=v1','--untracked-files=all']).trim(),'MANUSCRIPT_BATCH_DIRTY');
  const [head,tree]=git(['rev-parse','HEAD','HEAD^{tree}']).trim().split('\n');
  demand(sha40(head)&&sha40(tree),'MANUSCRIPT_BATCH_GIT_IDENTITY');return {head,tree};
}
export function validateManuscriptRuns(runIds){
  demand(Array.isArray(runIds)&&runIds.length>=1&&runIds.length<=24,'MANUSCRIPT_BATCH_RUN_SET');
  const rows=runIds.map(runId=>{
    demand(typeof runId==='string','MANUSCRIPT_BATCH_RUN_ID');
    const m=/^ORDER__(SINGLE_SCENE|MULTI_SCENE|FULL_SYNTHETIC_NOVEL|LARGE_DOCUMENT)__(C[123])__(SOURCE_RUNTIME|PACKAGED_BUILD_RUNTIME)__[A-Za-z0-9_-]{1,80}$/u.exec(runId);
    demand(m,'MANUSCRIPT_BATCH_RUN_ID');return {runId,volume:m[1],route:m[2],profile:m[3],cellId:runId.slice(0,runId.lastIndexOf('__'))};
  });
  demand(new Set(rows.map(x=>x.cellId)).size===rows.length,'MANUSCRIPT_BATCH_DUPLICATE_JOURNEY');return rows;
}
function labRevision(labRoot,revision,policy){
  demand(sha40(revision),'MANUSCRIPT_BATCH_LAB_REVISION');const git=gitAt(labRoot);
  git(['merge-base','--is-ancestor',policy.labBaseHead,revision]);
  const delta=git(['diff','--name-only','--no-renames',policy.labBaseHead,revision,'--']).trim().split('\n').filter(Boolean);
  demand(delta.every(p=>policy.allowedLabDeltaPaths.includes(p)||/^data\/cases\/[a-z][a-z0-9-]{0,63}\.json$/u.test(p)),'MANUSCRIPT_BATCH_LAB_SCOPE');
  for(const b of policy.labCodeBindings)demand(hash(git(['show',revision+':'+b.path]))===b.sha256,'MANUSCRIPT_BATCH_LAB_CODE');
}
export function selectManuscriptObservation(ledger,row){
  const candidates=ledger.filter(e=>e.type==='PHYSICAL_OBSERVATION'&&e.runId===row.runId);
  demand(candidates.length===1&&candidates[0].cellId===row.cellId,'MANUSCRIPT_BATCH_EXACT_OBSERVATION');
  const obs=candidates[0];
  demand(!ledger.some(e=>(e.runId===row.runId&&(e.stale===true||['PRIVACY_INVALIDATED','AUDIT_INVALIDATED_PHYSICAL_OBSERVATION'].includes(e.type)))
    ||(e.type==='EVIDENCE_SUPERSEDES'&&e.supersedesRunId===row.runId)
    ||(e.type==='AUDIT_INVALIDATED_PHYSICAL_OBSERVATION'&&e.artifactHash===obs.artifactHash)),'MANUSCRIPT_BATCH_INVALIDATED');
  return obs;
}
export function validateManuscriptRaw(raw,{row,head,tree,observationSha256,files,policy}){
 const cycles=row.route==='C3'?5:1,fields=manuscriptFields(row.volume,row.route),batch=policy.wordManuscriptBatch;
 demand(raw?.ok===true&&raw.schemaVersion==='WORD_MANUSCRIPT_RAW_READBACK_V1'&&raw.admissionCredit===0
  &&raw.runId===row.runId&&raw.productHead===head&&raw.productTree===tree
  &&raw.observationSha256===observationSha256&&raw.filesVerified===files.length,'MANUSCRIPT_RAW_BINDING');
 demand(Array.isArray(raw.fieldProofs)&&same(raw.fieldProofs.map(f=>f.field),fields),'MANUSCRIPT_FIELD_SET');
 demand(raw.roundProofs?.length===cycles&&same(raw.roundProofs.map(r=>r.ordinal),Array.from({length:cycles},(_,i)=>i+1))
  &&new Set(raw.roundProofs.map(r=>r.exportId)).size===cycles&&new Set(raw.roundProofs.map(r=>r.roundId)).size===cycles,'MANUSCRIPT_FIVE_ACTUAL_CYCLES');
 const sceneCount=row.volume==='SINGLE_SCENE'?1:row.volume==='MULTI_SCENE'?3:21;
 for(const r of raw.roundProofs)demand(typeof r.exportId==='string'&&r.exportId.startsWith('export-')&&typeof r.roundId==='string'&&r.roundId.startsWith('round-')
  &&sha64(r.exportSha256)&&sha64(r.returnedSha256)&&r.savedSceneHashes?.length===sceneCount&&r.savedSceneHashes.every(sha64),'MANUSCRIPT_ROUND_RAW_PROOF');
 const expected=manuscriptStages(row.route),stageNames=Object.keys(expected).sort();
 const controls=(rows,ids)=>Array.isArray(rows)&&same(rows.map(x=>x.id),ids)&&rows.every(x=>x.rejected===true&&sha64(x.sha256))&&new Set(rows.map(x=>x.sha256)).size===ids.length;
 for(const f of raw.fieldProofs){
  demand(f.runId===row.runId&&f.cellId===`${f.field}__${row.volume}__${row.route}__${row.profile}`&&f.status==='PASS'
   &&same(f.subcases,MANUSCRIPT_SUBCASES[f.field])&&same(f.requiredHops,MANUSCRIPT_HOPS[row.route])&&f.requiredCycles===cycles&&same(f.oracles,policy.requiredOracles),'MANUSCRIPT_FIELD_SCOPE');
  demand(same(Object.keys(f.stageProofs).sort(),stageNames),'MANUSCRIPT_STAGE_SET');
  for(const [name,n] of Object.entries(expected)){
   const stage=f.stageProofs[name],qualified=batch.paragraphHashes[row.volume][row.route][n];
   demand(stage.round===n&&stage.paragraphSha256===qualified.sha256&&stage.paragraphCount===qualified.count&&sha64(stage.sortKeysSha256),'MANUSCRIPT_STAGE_HASH');
  }
  demand(same(f.controls.positiveControls,['identity','split-xml-runs'])&&controls(f.controls.textMutants,TEXT_CONTROLS)
   &&controls(f.controls.styleMutants,row.route==='C1'?[]:STYLE_CONTROLS)
   &&controls(f.controls.structureMutants,row.volume==='SINGLE_SCENE'?[]:row.route==='C1'?STRUCTURE_CONTROLS.slice(0,3):STRUCTURE_CONTROLS),'MANUSCRIPT_RAW_MUTATIONS');
  const u=f.unicodeProof;demand(same(u?.probes,UNICODE_PROBES)&&sha64(u?.compositionEventsSha256)&&u.locale?.language&&u.locale.languages.includes(u.locale.language)
   &&u.locale.intl?.locale&&u.locale.intl.timeZone&&u.providerLocale?.locale&&u.providerLocale?.languages&&u.fontLedger?.length===(row.route==='C1'?sceneCount+2:2*sceneCount+cycles)
   &&u.fontLedger.every(x=>x.fonts?.length&&x.fonts.reduce((s,f)=>s+f.glyphCount,0)>0&&x.scope.includes('Chromium'))&&u.limitations?.ime&&u.limitations?.fonts,'MANUSCRIPT_UNICODE_FONT_BINDING');
  if(f.field==='STYLES'){
   const names=Array.from({length:cycles},(_,i)=>['rounds/'+(i+1)+'/export','rounds/'+(i+1)+'/word']).flat().concat(['reexport','final-word-lifecycle']);
   demand(same(Object.keys(f.styleProofs).sort(),names.sort())&&Object.values(f.styleProofs).every(p=>p.semanticStyleSha256===batch.semanticStyleSha256&&sha64(p.stylePartsSha256['word/styles.xml'])&&sha64(p.stylePartsSha256['word/numbering.xml']))&&f.unsupportedStylesDeclared,'MANUSCRIPT_STYLE_CONTINUITY');
  }
  if(f.field==='NOVEL_SCENE_STRUCTURE'){
   const names=['source-tree','reopen-tree','reexport','final-word-lifecycle',...Array.from({length:cycles},(_,i)=>['rounds/'+(i+1)+'/export','rounds/'+(i+1)+'/word','rounds/'+(i+1)+'/tree']).flat()];
   demand(same(Object.keys(f.structureProofs).sort(),names.sort())&&Object.entries(f.structureProofs).every(([name,p])=>name.endsWith('tree')?p.sceneCount===sceneCount&&sha64(p.hierarchySha256):sha64(p.bookmarkSha256))
    &&['lostScenes','lostChapters','mergedScenes','splitScenes'].every(k=>same(f.structureLossLedger[k],[]))&&f.structureLossLedger.scope,'MANUSCRIPT_SCENE_STRUCTURE');
  }
 }
 demand(row.route==='C1'?raw.finalHops===null:raw.finalHops?.ok===true&&raw.finalHops.acceptanceCredit===0,'MANUSCRIPT_FINAL_HOPS');
 return true;
}

export function verifyWordManuscriptBatch({repoRoot=ROOT,labRoot,runIds,requiredCells,specErrors=[],currentHead}={}){
  const started=performance.now(),errors=[...specErrors];let identity=null,reviews=[];
  try{
    demand(!errors.length,'MANUSCRIPT_BATCH_SPEC_OR_MODE');
    const rows=validateManuscriptRuns(runIds);
    demand(fs.realpathSync(repoRoot)===ROOT,'MANUSCRIPT_BATCH_CHECKOUT');
    identity=clean(ROOT);const labIdentity=clean(labRoot),policy=loadDataPolicy(),batch=policy.wordManuscriptBatch;
    demand(gitAt(ROOT)(['rev-parse','origin/main']).trim()===identity.head&&(!currentHead||currentHead===identity.head),'MANUSCRIPT_BATCH_CURRENT_MAIN');
    demand(batch?.schemaVersion===MANUSCRIPT_BATCH_MODE&&same(batch.cellIds,MANUSCRIPT_CELLS)&&same(batch.requiredHops,MANUSCRIPT_HOPS),'MANUSCRIPT_BATCH_POLICY_SCOPE');
    demand(hash(readOrderFile(ROOT,SPEC).bytes)===policy.productSpecSha256,'MANUSCRIPT_BATCH_SPEC_PIN');
    demand(requiredCells?.length===1120&&new Set(requiredCells.map(c=>c.cellId)).size===1120
      &&MANUSCRIPT_CELLS.every(id=>requiredCells.some(c=>c.cellId===id)),'MANUSCRIPT_BATCH_DENOMINATOR');
    for(const b of batch.readerBindings)demand(hash(readOrderFile(ROOT,b.path).bytes)===b.sha256,'MANUSCRIPT_BATCH_READER_PIN');
    const manifest=json(labRoot,'LAB_MANIFEST.json'),shadow=manifest.shadow.yalken;
    demand(fs.realpathSync(shadow.root)===ROOT&&shadow.readOnly===true&&shadow.head===identity.head&&shadow.tree===identity.tree
      &&shadow.declaredOriginMainHead===identity.head&&shadow.declaredOriginMainTree===identity.tree,'MANUSCRIPT_BATCH_SHADOW');
    demand(hash(readOrderFile(labRoot,'data/registry/frozen-denominator-registry-v2.json').bytes)===policy.labRegistrySha256,'MANUSCRIPT_BATCH_REGISTRY');
    labRevision(labRoot,labIdentity.head,policy);
    const ledgerFile=readOrderFile(labRoot,'data/evidence/ledger.jsonl',64*1024*1024);
    const ledger=ledgerFile.bytes.toString('utf8').trim().split('\n').filter(Boolean).map(s=>JSON.parse(s));
    for(const row of rows){
      const prefix='runs/'+row.runId+'/',entry=selectManuscriptObservation(ledger,row);
      const obsFile=readOrderFile(labRoot,prefix+'observation.json'),obs=JSON.parse(obsFile.bytes);
      demand(obs.runId===row.runId&&obs.cellId===row.cellId&&obs.artifactHash===entry.artifactHash,'MANUSCRIPT_BATCH_OBSERVATION_FILE');
      for(const k of ['labHead','labTree','createdAt','status','yalkenShadowHead','yalkenShadowTree'])demand(obs[k]===entry[k],'MANUSCRIPT_BATCH_LEDGER_BINDING');
      const withoutHash={...obs};delete withoutHash.artifactHash;
      demand(obs.artifactHashScope==='observation_without_artifactHash'&&hashOrderObservation(withoutHash)===obs.artifactHash,'MANUSCRIPT_BATCH_OBSERVATION_HASH');
      demand(obs.yalkenShadowHead===identity.head&&obs.yalkenShadowTree===identity.tree&&obs.candidateDiagnosticOnly===false,'MANUSCRIPT_BATCH_ACTUAL_RUNTIME');
      demand(Date.parse(obs.createdAt)>=Date.parse(batch.notBeforeUtc)&&Date.parse(obs.createdAt)<=Date.now(),'MANUSCRIPT_BATCH_OBSERVATION_TIME');
      labRevision(labRoot,obs.labHead,policy);
      demand(gitAt(labRoot)(['rev-parse',obs.labHead+'^{tree}']).trim()===obs.labTree,'MANUSCRIPT_BATCH_LAB_TREE');
      const snapshot=json(labRoot,prefix+'runtime-project-snapshot.json');
      const files=[...obs.artifacts,...snapshot.files].map(({path:p,bytes,sha256})=>({path:p,bytes,sha256}));
      files.push(obsFile.binding);
      demand(files.length<=2048&&new Set(files.map(f=>f.path)).size===files.length,'MANUSCRIPT_BATCH_INVENTORY');
      demand(files.every(f=>f.path.startsWith(prefix)&&Number.isSafeInteger(f.bytes)&&f.bytes>=0&&f.bytes<=32*1024*1024&&sha64(f.sha256))
        &&files.reduce((n,f)=>n+f.bytes,0)<=384*1024*1024,'MANUSCRIPT_BATCH_FILE_SCOPE');
      const request={root:fs.realpathSync(labRoot),runId:row.runId,productHead:identity.head,productTree:identity.tree,files,
        qualifiedProvider:policy.qualifiedProvider,packageJsonSha256:hash(readOrderFile(ROOT,'package.json').bytes),
        packageLockSha256:hash(readOrderFile(ROOT,'package-lock.json').bytes),electronVersion:batch.electronVersion};
      const process=spawnSync('python3',['-I','-B',path.join(ROOT,READER)],{input:JSON.stringify(request),encoding:'utf8',timeout:180000,maxBuffer:16*1024*1024});
      demand(!process.error&&process.status===0,'MANUSCRIPT_BATCH_RAW_FAILED:'+String(process.stdout||process.stderr||process.error));
      const raw=JSON.parse(process.stdout);
      validateManuscriptRaw(raw,{row,...identity,observationSha256:obsFile.binding.sha256,files,policy});
      reviews.push({runId:row.runId,observationArtifactHash:obs.artifactHash,raw});
    }
    demand(readOrderFile(labRoot,'data/evidence/ledger.jsonl',64*1024*1024).bytes.equals(ledgerFile.bytes)
      &&same(clean(ROOT),identity)&&same(clean(labRoot),labIdentity),'MANUSCRIPT_BATCH_CHANGED_DURING_REVIEW');
  }catch(error){errors.push(String(error.message));}
  const ok=!errors.length,fieldProofs=ok?reviews.flatMap(r=>r.raw.fieldProofs):[];
  const acceptedCellIds=[...new Set(fieldProofs.map(f=>f.cellId))].sort();
  return {ok,errors,contractId:'YALKEN_INTEROP_100_SUPPORTED_CONTRACT_V1',evidenceMode:MANUSCRIPT_BATCH_MODE,
    authoritativeAdmission:ok,requiredCells:1120,recordedCells:acceptedCellIds.length,passedRequiredCells:acceptedCellIds.length,
    acceptedCellIds,diagnosticPassedRequiredCells:0,broadPassClaim:false,
    claimVerdict:ok?'NEEDS_MORE_EVIDENCE':'FAIL_WORD_MANUSCRIPT_EVIDENCE',
    statusCounts:{PASS:acceptedCellIds.length,NOT_EXECUTED:1120-acceptedCellIds.length},
    currentHead:identity?.head||null,currentTree:identity?.tree||null,percentage:acceptedCellIds.length/1120*100,
    cellDecisions:fieldProofs.map(f=>({cellId:f.cellId,status:'PASS',outcome:f.outcome,sourceRunId:f.runId,fieldProofSha256:hash(Buffer.from(stableOrderJson(f)))})),
    policySha256:DATA_POLICY_SHA256,rawReadbacks:ok?reviews:[],seconds:(performance.now()-started)/1000,
    limitations:['Only complete named field subcases at four fixed volumes and actual source/packaged profiles.',
      'C1 safe-create imports plain text and declares metadata/bookmark loss; C1 does not claim rich styles or hierarchy.',
      'C3 requires five actual authenticated Word edit/apply rounds, a fresh process and terminal Word readback.',
      'IME proof covers native Chromium composition on the bound locale; all OS IME engines and pixel identity remain unproved.']};
}

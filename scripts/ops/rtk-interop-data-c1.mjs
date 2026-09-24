import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {performance} from 'node:perf_hooks';
import {ORDER_CELL,readOrderFile,stableOrderJson,validateOrderRunId,selectOrderObservation,hashOrderObservation} from './rtk-interop-order-c1.mjs';
import {TEXT_CELL,TEXT_SUBCASES,TEXT_CONTROL_IDS} from './rtk-interop-text-order-c1.mjs';
export const DATA_POLICY_PATH='docs/OPS/RTK/YALKEN_INTEROP_DATA_C1_POLICY_V1.json';
export const DATA_POLICY_SHA256='c0f95f381873575910a8e935a473a7d613e1be2617a5640c41bdcc5f9a7acc97';
export const DATA_MODE='DATA_C1_MACHINE_REVIEW_V1';
export const CELLS=[TEXT_CELL,ORDER_CELL];
export const stableSharedJson=stableOrderJson;
export const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const RAW_PATH='scripts/ops/rtk-interop-data-c1-readback.py';
const SPEC_PATH='docs/OPS/RTK/YALKEN_INTEROP_100_DENOMINATOR_V1.json';
const MAX_FILE=8*1024*1024;
const same=(a,b)=>stableOrderJson(a)===stableOrderJson(b);
const demand=(ok,code)=>{if(!ok)throw new Error(code);};
const sha40=v=>typeof v==='string'&&/^[a-f0-9]{40}$/u.test(v);
const sha64=v=>typeof v==='string'&&/^[a-f0-9]{64}$/u.test(v);
const gitAt=root=>args=>execFileSync('git',args,{cwd:root,encoding:'utf8',timeout:10000,maxBuffer:16*1024*1024});
const MARKERS=['latin-basic','latin-diacritic','cyrillic','greek','cjk','rtl-hebrew','emoji-zwj'];
export function validateDataCase(v) {
  demand(v&&typeof v==='object'&&!Array.isArray(v)&&same(Object.keys(v).sort(),['id','paragraphs','schemaVersion']),'DATA_CASE_FIELDS');
  demand(v.schemaVersion==='YALKEN_C1_PARAGRAPH_CASE_V1'&&typeof v.id==='string'&&/^[a-z][a-z0-9-]{0,63}$/u.test(v.id),'DATA_CASE_ID');
  const a=v.paragraphs;
  demand(Array.isArray(a)&&a.length>=12&&a.length<=64&&a.every(x=>typeof x==='string'&&x.isWellFormed()),'DATA_CASE_PARAGRAPHS');
  demand(a.reduce((n,x)=>n+Buffer.byteLength(x),0)<=65536,'DATA_CASE_BYTES');
  demand(a.every(x=>!/[\u0000-\u001f\u007f-\u009f\ufffe\uffff]/u.test(x)),'DATA_CASE_CODEPOINTS');
  demand(a[0]&&a.at(-1)&&a.every((x,i)=>!i||x!==a[i-1]),'DATA_CASE_BOUNDARIES');
  demand(a.filter(x=>x==='').length>=2&&a.some(x=>x.includes('[whitespaceEdgesPreserved]')&&x.startsWith(' ')&&x.endsWith(' ')),'DATA_CASE_PRESENCE');
  for(const m of MARKERS)demand(a.filter(x=>x.includes('['+m+']')).length===1,'DATA_CASE_LOCALE:'+m);
  for(const t of ['alpha.','Café','Привет','中文','\u200d','Καλημέρα','שלום'])demand(a.some(x=>x.includes(t)),'DATA_CASE_CONTROL_PRESENCE');
  return structuredClone(v);
}
export function loadDataPolicy() {
  const bytes=readOrderFile(ROOT,DATA_POLICY_PATH).bytes;
  demand(hash(bytes)===DATA_POLICY_SHA256,'DATA_POLICY_PIN');
  const p=JSON.parse(bytes);
  demand(p.schemaVersion==='YALKEN_INTEROP_DATA_C1_POLICY_V1'&&same(p.targetCellIds,CELLS),'DATA_POLICY_SCOPE');
  for(const binding of p.protectedFiles)demand(hash(readOrderFile(ROOT,binding.path).bytes)===binding.sha256,'DATA_PROTECTED_FILE');
  demand(hash(readOrderFile(ROOT,RAW_PATH).bytes)===p.rawCheckerSha256,'DATA_CHECKER_PIN');
  for(const b of p.qualifiedRuntimeRepair.sourceBindings)demand(hash(readOrderFile(ROOT,b.path).bytes)===b.sha256,'DATA_RUNTIME_REPAIR_PIN');
  return p;
}
function cleanIdentity(root) {
  const git=gitAt(root);demand(!git(['status','--porcelain=v1','--untracked-files=all']).trim(),'DATA_DIRTY_CHECKOUT');
  const [head,tree]=git(['rev-parse','HEAD','HEAD^{tree}']).trim().split('\n');
  demand(sha40(head)&&sha40(tree),'DATA_GIT_IDENTITY');return {head,tree};
}
function validateLabRevision(labRoot,revision,policy) {
  const git=gitAt(labRoot);demand(sha40(revision),'DATA_LAB_REVISION');
  git(['merge-base','--is-ancestor',policy.labBaseHead,revision]);
  const changes=git(['diff','--name-only','--no-renames',policy.labBaseHead,revision,'--']).trim().split('\n').filter(Boolean);
  demand(changes.every(p=>policy.allowedLabDeltaPaths.includes(p)||/^data\/cases\/[a-z][a-z0-9-]{0,63}\.json$/u.test(p)),'DATA_LAB_SCOPE');
  const bindingSets=Array.isArray(policy.labCodeBindingSets)&&policy.labCodeBindingSets.length
    ? policy.labCodeBindingSets.map(set=>set.bindings)
    : [policy.labCodeBindings];
  const pinned=bindingSets.some(bindings=>Array.isArray(bindings)&&bindings.every(b=>{
    try{return hash(git(['show',revision+':'+b.path]))===b.sha256;}catch{return false;}
  }));
  demand(pinned,'DATA_LAB_CODE_PIN');
}
// Readiness checks run before native effects and again before actual admission.
export function prepareDataC1({repoRoot=ROOT,labRoot,caseId}={}) {
  const started=performance.now();demand(fs.realpathSync(repoRoot)===ROOT,'DATA_CHECKOUT');
  const identity=cleanIdentity(ROOT),labIdentity=cleanIdentity(labRoot),policy=loadDataPolicy();
  demand(gitAt(ROOT)(['rev-parse','origin/main']).trim()===identity.head,'DATA_CURRENT_MAIN');
  demand(hash(readOrderFile(ROOT,SPEC_PATH).bytes)===policy.productSpecSha256,'DATA_SPEC_PIN');
  const m=JSON.parse(readOrderFile(labRoot,'LAB_MANIFEST.json').bytes),s=m.shadow.yalken;
  demand(fs.realpathSync(s.root)===ROOT&&s.readOnly===true&&s.head===identity.head&&s.tree===identity.tree
    &&s.declaredOriginMainHead===identity.head&&s.declaredOriginMainTree===identity.tree,'DATA_SHADOW');
  demand(hash(readOrderFile(labRoot,'data/registry/frozen-denominator-registry-v2.json').bytes)===policy.labRegistrySha256,'DATA_REGISTRY');
  validateLabRevision(labRoot,labIdentity.head,policy);
  demand(typeof caseId==='string'&&/^[a-z][a-z0-9-]{0,63}$/u.test(caseId),'DATA_CASE_ID');
  const casePath='data/cases/'+caseId+'.json',raw=readOrderFile(labRoot,casePath,131072),input=validateDataCase(JSON.parse(raw.bytes));
  demand(input.id===caseId&&hash(gitAt(labRoot)(['show',labIdentity.head+':'+casePath]))===raw.binding.sha256,'DATA_COMMITTED_INPUT');
  const requirements=JSON.parse(readOrderFile(labRoot,'data/rtm/requirements-v2.json').bytes);
  const rtm=JSON.parse(readOrderFile(labRoot,'data/rtm/rtm-v2.json').bytes);
  for(const id of policy.requirementIds){
    const row=requirements.requirements.find(r=>r.requirementId===id);
    demand(row&&hash(Buffer.from(stableOrderJson(row)))===policy.requirementBindings.find(b=>b.id===id)?.sha256,'DATA_REQUIREMENT_PIN');
    demand(row?.mappingMethod==='reviewed-bounded-c1-input-preservation'&&CELLS.every(cell=>row.mappedCellIds.includes(cell)),'DATA_REQUIREMENT_MAPPING');
    demand(CELLS.every(cell=>rtm.mappedCells.find(c=>c.cellId===cell)?.requirementIds.includes(id)),'DATA_RTM_MAPPING');
  }
  const checked=spawnSync('python3',['-I','-B',path.join(ROOT,RAW_PATH),'--check-input'],{input:raw.bytes,encoding:'utf8',timeout:10000,maxBuffer:1024*1024});
  demand(!checked.error&&checked.status===0&&JSON.parse(checked.stdout).ok===true,'DATA_INPUT_READER_UNAVAILABLE:'+String(checked.stdout||checked.error||checked.stderr));
  const plist=JSON.parse(execFileSync('/usr/bin/plutil',['-convert','json','-o','-','/Applications/Microsoft Word.app/Contents/Info.plist'],{encoding:'utf8',timeout:10000}));
  const actualProvider={wordAppPath:'/Applications/Microsoft Word.app',wordVersion:plist.CFBundleShortVersionString,wordBuild:plist.CFBundleVersion,
    macosVersion:execFileSync('/usr/bin/sw_vers',['-productVersion'],{encoding:'utf8'}).trim(),
    macosBuild:execFileSync('/usr/bin/sw_vers',['-buildVersion'],{encoding:'utf8'}).trim(),
    locale:execFileSync('/usr/bin/defaults',['read','-g','AppleLocale'],{encoding:'utf8'}).trim()};
  demand(same(actualProvider,policy.qualifiedProvider),'DATA_PROVIDER_QUALIFICATION');
  return {ok:true,admissionCredit:0,identity,labIdentity,input,casePath,caseSha256:raw.binding.sha256,policy,actualProvider,seconds:(performance.now()-started)/1000};
}
const DATA_ADMITTED_PATHS=["docs/tasks/2026-09-16--interop-data-recipes-c1.md","docs/OPS/RTK/YALKEN_INTEROP_DATA_C1_POLICY_V1.json","docs/OPS/RTK/YALKEN_INTEROP_DATA_C1_FIXTURES_V1.json","scripts/ops/rtk-interop-data-c1.mjs","scripts/ops/rtk-interop-data-c1-readback.py","scripts/ops/rtk-interop-100-denominator-v1.mjs","test/contracts/rtk-interop-100-denominator.contract.test.js","scripts/ops/r24/corrective/post-audit-certification-set.mjs","docs/OPS/R24/CORRECTIVE/C1B_TEST_INVENTORY_V1.json","docs/OPS/RTK/YALKEN_INTEROP_100_GOVERNANCE_CHANGE_APPROVALS_V1.json","docs/OPS/R24/CORRECTIVE/PK1R1_GOVERNANCE_CHANGE_APPROVALS_V1.json","docs/OPS/R24/CORRECTIVE/C2A_GOVERNANCE_CHANGE_APPROVALS_V1.json","docs/OPS/GOVERNANCE_APPROVALS/GOVERNANCE_CHANGE_APPROVALS.json","src/main.js","src/utils/docxImportPreviewReferences.js","src/renderer/commands/projectCommands.mjs","test/contracts/revision-bridge-docx-import-reference.contract.test.js","docs/tasks/2026-09-16--docx-import-preview-reference.md","src/renderer/editor.bundle.js","docs/ARCH_DIFF_LOG.md","test/contracts/revision-bridge-docx-import-preview-plan.contract.test.js","test/contracts/revision-bridge-docx-import-preview-command-surface.contract.test.js","test/unit/r24-wp307-writer-local-profile-integration.test.js","test/contracts/r24-post-audit-certification-set.contract.test.mjs","src/export/docx/docxMinBuilder.js","src/io/revisionBridge/index.mjs","src/utils/docxImportSafeCreate.js","src/utils/docxImportLocalFilePreview.js","test/contracts/revision-bridge-docx-inline-styles.contract.test.js","docs/tasks/2026-09-16--docx-inline-styles-c1.md","src/derived/navigatorCounters.mjs","test/unit/navigator-derived-counters.test.js","docs/tasks/2026-09-16--docx-navigator-visible-word-count.md",".github/workflows/oss-policy.yml","test/contracts/r24-postbuild-lanes.contract.test.mjs","docs/tasks/2026-09-16--parallel-postbuild-ci-lanes.md","test/contracts/revision-bridge-docx-headings.contract.test.js","docs/tasks/2026-09-16--docx-heading-roundtrip.md","test/contracts/revision-bridge-docx-lists.contract.test.js","docs/tasks/2026-09-16--docx-list-roundtrip.md","test/contracts/revision-bridge-docx-content-preview.contract.test.js","src/renderer/styles.css","docs/tasks/2026-09-16--editor-list-marker-flow.md","src/export/docx/docxInlineColors.js","src/export/docx/docxReviewPacketBuilder.js","src/io/revisionBridge/reviewTransportPackageParserV2.mjs","test/contracts/revision-bridge-docx-colors.contract.test.js","docs/tasks/2026-09-16--docx-colors-roundtrip.md","src/io/inlineTypography.mjs","src/export/docx/docxInlineTypography.js","src/export/docx/fullManuscriptDocxReviewPacketSource.js","src/renderer/tiptap/index.js","src/renderer/tiptap/documentTextStyle.mjs","test/contracts/revision-bridge-docx-typography.contract.test.js","docs/tasks/2026-09-16--docx-typography-roundtrip.md","test/unit/sector-m-tiptap-runtime-bridge.test.js","src/io/inlineTypography.cjs","src/io/paragraphAlignment.cjs","src/io/paragraphAlignment.mjs","src/renderer/tiptap/documentParagraphAlignment.mjs","src/renderer/editor.js","test/contracts/revision-bridge-docx-alignment.contract.test.js","docs/tasks/2026-09-16--docx-paragraph-alignment.md","test/unit/sector-m-toolbar-expansion-wave-a1.test.js","test/contracts/rtk-release01-terminal-claims.contract.test.js","test/contracts/revision-bridge-docx-theme-fonts.contract.test.js","docs/tasks/2026-09-16--docx-theme-fonts.md","scripts/ops/rtk-interop-word-text-order-batch.mjs","scripts/ops/rtk-interop-word-text-order-readback.py","scripts/ops/rtk-interop-c2-final-hops.py","test/contracts/rtk-interop-word-text-order-batch.contract.test.js","test/unit/rtk-interop-c2-final-hops.test.py","docs/tasks/2026-09-17--interop-word-text-order-batch.md","test/contracts/rtk-word-c2-rich-scene-reexport.contract.test.js","docs/OPS/RTK/RTK_TEST_GRAPH_CATALOG_V1.json","scripts/ops/rtk-interop-word-volume-fixtures.mjs","scripts/ops/rtk-interop-word-volume-readback.py","test/contracts/rtk-interop-word-volume.contract.test.js","test/unit/rtk-interop-word-volume.test.py","docs/tasks/2026-09-17--interop-word-volume-text-order.md","test/contracts/rtk-word-full-manuscript-volume.contract.test.js","src/core/writer-local-profile-v1.cjs","test/unit/r24-wp307-writer-local-profile.test.js","test/unit/r24-wp307-writer-local-profile-mutants.test.js","scripts/ops/rtk-interop-word-manuscript-fixtures.mjs","scripts/ops/rtk-interop-word-manuscript-readback.py","scripts/ops/rtk-interop-word-manuscript-batch.mjs","test/contracts/rtk-interop-word-manuscript.contract.test.js","test/unit/rtk-interop-word-manuscript.test.py","docs/tasks/2026-09-17--interop-word-manuscript-fields.md","src/io/revisionBridge/exactTextMinSafeWrite.mjs","src/io/markdown/index.mjs","src/core/project-transaction-v1.cjs","src/product/mainProjectManifestAuthority.mjs","test/unit/sector-m-scene-rich-truth.test.js","test/contracts/revision-bridge-docx-block-styles.contract.test.js","docs/tasks/2026-09-17--c1-word-block-styles.md","src/export/docx/docxBlockStyles.js","docs/OPS/RTK/YALKEN_INTEROP_100_DENOMINATOR_V1.json","docs/tasks/2026-09-17--c5-google-native-manuscript.md","docs/tasks/2026-09-17--word-review-semantics.md","test/contracts/rtk-word-latest-semantic-b02-package-parser.contract.test.js","src/export/docx/docxReviewPacketExportHandler.js","src/export/docx/docxReviewPacketComments.js","src/io/revisionBridge/reviewTransportNonTextReturnRuntime.mjs","test/contracts/rtk-word-canonical-comment-reexport.contract.test.js","test/contracts/rtk-word-c5v2-root-comment-return-runtime.contract.test.js","test/contracts/rtk-word-c5v2-comment-lifecycle-return-runtime.contract.test.js","test/contracts/rtk-word-latest-semantic-b03-modern-comments.contract.test.js","test/contracts/rtk-c4-canonical-comment-product-query.contract.test.js","test/contracts/rtk-word-c5v2-full-manuscript-product-export.contract.test.js","docs/tasks/2026-09-17--word-canonical-comment-reexport.md","src/io/revisionBridge/reviewTransportMatchProofV1.mjs","test/contracts/rtk-word-link-anchor-continuity.contract.test.js","docs/tasks/2026-09-17--word-link-anchor-continuity.md","test/contracts/revision-bridge-docx-review-preview-session-command-surface.contract.test.js","test/contracts/rtk-export01-unified-bookmark.contract.test.js","docs/tasks/2026-09-17--c1-review-intake-fields.md","docs/tasks/2026-09-18--word-metadata-roundtrip.md","docs/tasks/2026-09-18--word-document-parts-roundtrip.md","src/main/rtkDocxReturnIntakeWorker.cjs","scripts/perf/rtk-interop-word-manuscript-batch-plan.mjs","scripts/perf/rtk-interop-word-manuscript-batch-plan.test.mjs","src/export/docx/docxReviewPacketNotes.js","test/contracts/rtk-word-canonical-notes-roundtrip.contract.test.js","docs/tasks/2026-09-22--word-notes-footnotes.md"];
function readDataPolicyBytes(b){demand(hash(b)===DATA_POLICY_SHA256,'DATA_POLICY_PIN');return JSON.parse(b);}
export function verifyDataC1PostEvaluation({candidateSha='HEAD',git=gitAt(ROOT)}={}) {
  const resolved=String(git(['rev-parse',candidateSha])).trim();
  demand(sha40(resolved),'SHARED_GIT_HEAD');
  if(!String(git(['ls-tree','--name-only',resolved,'--',DATA_POLICY_PATH])).trim())
    return {status:'NOT_APPLICABLE',admittedPaths:[]};
  const policy=readDataPolicyBytes(git(['show',resolved+':'+DATA_POLICY_PATH]));
  demand(same(policy.admittedPaths,DATA_ADMITTED_PATHS),'DATA_DELIVERY_SCOPE');
  for(const b of policy.qualifiedRuntimeRepair.sourceBindings)demand(hash(git(['show',resolved+':'+b.path]))===b.sha256,'DATA_RUNTIME_REPAIR_PIN');
  const revisions=String(git(['log','--format=%H',resolved,'--',DATA_POLICY_PATH])).trim().split('\n').filter(Boolean);
  // Git I/O is bounded by timeout and maxBuffer, not by lifetime policy updates.
  // Keep the oldest exact-policy delivery so later reverts cannot erase drift.
  demand(revisions.length>0&&revisions.every(sha40),'SHARED_DELIVERY_IDENTITY');
  const delivery=revisions.filter(sha=>hash(git(['show',sha+':'+DATA_POLICY_PATH]))===DATA_POLICY_SHA256).at(-1);
  demand(sha40(delivery),'SHARED_DELIVERY_IDENTITY');
  git(['merge-base','--is-ancestor','d9220b6b7131043068564081e1c6a15f273afeb5',delivery]);
  demand(String(git(['rev-parse','d9220b6b7131043068564081e1c6a15f273afeb5'+'^{tree}'])).trim()==='5b10838d67d56032ad72f501bbeb36b90f33a719','DATA_BASE_TREE');
  const changed=String(git(['diff','--name-only','--no-renames','d9220b6b7131043068564081e1c6a15f273afeb5',delivery,'--'])).trim().split('\n').filter(Boolean);
  demand(changed.every(p=>DATA_ADMITTED_PATHS.includes(p)),'SHARED_UNADMITTED_DELTA');
  for(const b of policy.protectedFiles)
    demand(hash(git(['show',resolved+':'+b.path]))===b.sha256,'SHARED_PROTECTED_FILE');
  const drift=new Set(String(git(['diff','--name-only','--no-renames',delivery,resolved,'--',...DATA_ADMITTED_PATHS])).trim().split('\n').filter(Boolean));
  const immutable=[DATA_POLICY_PATH,RAW_PATH,'scripts/ops/rtk-interop-data-c1.mjs',
    'docs/tasks/2026-09-16--interop-data-recipes-c1.md'];
  demand(immutable.every(p=>!drift.has(p)),'SHARED_IMPLEMENTATION_DRIFT');
  return {status:'PASS',deliverySha:delivery,admittedPaths:DATA_ADMITTED_PATHS.filter(p=>!drift.has(p)),
    cellAcceptanceAuthority:false,programDone:false};
}
export function inspectDataC1Artifacts({labRoot,runId,productHead,productTree}={}) {
  const started=performance.now();
  validateOrderRunId(runId);
  demand(sha40(productHead) && sha40(productTree), 'ORDER_REPLAY_IDENTITY');
  const identity={head:productHead,tree:productTree};
  const policy=loadDataPolicy();
  demand(hash(readOrderFile(ROOT,RAW_PATH).bytes)===policy.rawCheckerSha256, 'ORDER_RAW_CHECKER_PIN');

  const ledgerBytes=readOrderFile(labRoot,'data/evidence/ledger.jsonl',64*1024*1024).bytes;
  const ledger=ledgerBytes.toString('utf8').trim().split('\n').filter(Boolean).map(s=>JSON.parse(s));
  const observation=selectOrderObservation(ledger,runId);
  demand(observation.yalkenShadowHead===productHead && observation.yalkenShadowTree===productTree,'ORDER_REPLAY_RUNTIME');
  const prefix = `runs/${runId}/`;
  const obsFile = readOrderFile(labRoot, prefix+'observation.json');
  const obs = JSON.parse(obsFile.bytes);
  demand(obs.runId === runId && obs.cellId === ORDER_CELL && obs.artifactHash === observation.artifactHash, 'ORDER_OBSERVATION_FILE_BINDING');
  demand(['labHead','labTree','createdAt','status','yalkenShadowHead','yalkenShadowTree'].every(k => obs[k] === observation[k]), 'ORDER_OBSERVATION_METADATA_BINDING');
  const withoutHash = { ...obs }; delete withoutHash.artifactHash;
  demand(obs.artifactHashScope === 'observation_without_artifactHash', 'ORDER_OBSERVATION_HASH_SCOPE');
  demand(hashOrderObservation(withoutHash) === obs.artifactHash, 'ORDER_OBSERVATION_HASH');
  const snapshotFile = readOrderFile(labRoot, prefix+'runtime-project-snapshot.json');
  const snapshot = JSON.parse(snapshotFile.bytes);
  const records = [...obs.artifacts, ...snapshot.files].map(({path:p,bytes,sha256}) => ({path:p,bytes,sha256}));
  records.push(obsFile.binding);
  demand(records.length <= 128 && new Set(records.map(b => b.path)).size === records.length, 'ORDER_INVENTORY_DUPLICATE');
  demand(records.every(b => b.path.startsWith(prefix) && Number.isSafeInteger(b.bytes) && b.bytes >= 0 && b.bytes <= MAX_FILE && sha64(b.sha256)), 'ORDER_INVENTORY_SCOPE');
  const total = records.reduce((n,b) => n+b.bytes,0); demand(total <= 64*1024*1024, 'ORDER_INVENTORY_BYTES');
  for (const b of records) { const file=readOrderFile(labRoot,b.path); demand(same(file.binding,b), 'ORDER_ARTIFACT_CHANGED'); }
  const caseFile=readOrderFile(labRoot,prefix+'case-input.json',131072);
  const input=validateDataCase(JSON.parse(caseFile.bytes));
  demand(same(obs.dataCase,{id:input.id,path:'data/cases/'+input.id+'.json',sha256:caseFile.binding.sha256}),'DATA_CASE_OBSERVATION');
  const result = spawnSync('python3', ['-I','-B',path.join(ROOT,RAW_PATH)], { shell:false, timeout:10000, maxBuffer:1024*1024, encoding:'utf8',
    input:JSON.stringify({root:labRoot,runId,productHead:identity.head,productTree:identity.tree,files:records,qualifiedProvider:policy.qualifiedProvider,caseId:input.id,caseSha256:caseFile.binding.sha256}) });
  demand(!result.error && result.status === 0, `ORDER_RAW_FAILED:${result.error?.code || result.stdout?.trim() || result.signal || result.status}`);
  const raw=JSON.parse(result.stdout);
  demand(raw.ok===true && raw.schemaVersion==='DATA_C1_RAW_READBACK_V1' && raw.admissionCredit===0 && raw.runId===runId
    && raw.cellId===ORDER_CELL && raw.productHead===identity.head && raw.productTree===identity.tree && raw.filesVerified===records.length
    && same(raw.oracles,policy.requiredOracles) && same(raw.subcases,policy.requiredSubcases)
    && raw.controls.orderMutantsExecuted.length===2*input.paragraphs.length && raw.controls.rawMutantsExecuted.length===3
    &&raw.caseId===input.id&&raw.caseSha256===caseFile.binding.sha256
    &&same(raw.textSubcases,TEXT_SUBCASES)&&same(raw.textControls.rawMutantsExecuted.map(x=>x.id),TEXT_CONTROL_IDS)
    &&raw.textControls.rawMutantsExecuted.every(x=>x.rejected===true)
    &&same(raw.textControls.positiveControls,['identity','split-xml-runs']), 'ORDER_RAW_REPORT_BINDING');
  const fieldProofs=[
    {cellId:TEXT_CELL,field:'TEXT',outcome:'PRESERVED',subcases:raw.textSubcases,oracles:raw.oracles,
      checkerSha256:policy.rawCheckerSha256,controls:raw.textControls,facts:{semanticParagraphSha256:raw.semanticParagraphSha256}},
    {cellId:ORDER_CELL,field:'ORDER',outcome:'PRESERVED',subcases:raw.subcases,oracles:raw.oracles,
      checkerSha256:policy.rawCheckerSha256,controls:raw.controls,facts:{semanticParagraphSha256:raw.semanticParagraphSha256}},
  ];
  const review={schemaVersion:'DATA_C1_MACHINE_REVIEW_INDEX_V1',reviewMode:DATA_MODE,
    sourceCellId:ORDER_CELL,targetCellIds:CELLS,runId,caseId:input.id,caseSha256:caseFile.binding.sha256,
    policySha256:DATA_POLICY_SHA256,productHead,productTree,
    labRuntimeHead:observation.labHead,labRuntimeTree:observation.labTree,
    observationArtifactHash:observation.artifactHash,observationSha256:obsFile.binding.sha256,
    artifactSetSha256:hash(Buffer.from(stableOrderJson(records))),files:records,fieldProofs,
    productAdmissionCredit:0};
  for (const b of records) demand(same(readOrderFile(labRoot,b.path).binding,b), 'ORDER_ARTIFACT_CHANGED_DURING_READ');
  demand(readOrderFile(labRoot,'data/evidence/ledger.jsonl',64*1024*1024).bytes.equals(ledgerBytes), 'ORDER_LEDGER_CHANGED_DURING_READ');
  return {ok:true,admissionCredit:0,review,raw,ledger,observation,seconds:(performance.now()-started)/1000};
}

export function inspectDataC1Evidence(options={}) {
  const {labRoot,runId}=options;validateOrderRunId(runId);
  const obs=JSON.parse(readOrderFile(labRoot,'runs/'+runId+'/observation.json').bytes);
  const ready=prepareDataC1({...options,caseId:obs.dataCase?.id});
  demand(!options.currentHead||options.currentHead===ready.identity.head,'DATA_ACTUAL_HEAD');
  const facts=inspectDataC1Artifacts({labRoot,runId,productHead:ready.identity.head,productTree:ready.identity.tree});
  demand(facts.review.caseSha256===ready.caseSha256,'DATA_INPUT_CHANGED');
  validateLabRevision(labRoot,obs.labHead,ready.policy);
  demand(gitAt(labRoot)(['rev-parse',obs.labHead+'^{tree}']).trim()===obs.labTree,'DATA_LAB_TREE');
  demand(hash(gitAt(labRoot)(['show',obs.labHead+':'+ready.casePath]))===ready.caseSha256,'DATA_RUNTIME_INPUT');
  demand(Date.parse(obs.createdAt)>=Date.parse(ready.policy.notBeforeUtc)&&Date.parse(obs.createdAt)<=Date.now(),'DATA_RUN_TIME');
  demand(!facts.ledger.some(e=>(e.runId===runId&&(e.stale===true||['PRIVACY_INVALIDATED','AUDIT_INVALIDATED_PHYSICAL_OBSERVATION'].includes(e.type)))
    ||(e.type==='EVIDENCE_SUPERSEDES'&&e.supersedesRunId===runId)
    ||(e.type==='AUDIT_INVALIDATED_PHYSICAL_OBSERVATION'&&e.artifactHash===obs.artifactHash)),'DATA_INVALIDATED');
  demand(same(cleanIdentity(ROOT),ready.identity)&&same(cleanIdentity(labRoot),ready.labIdentity),'DATA_CHANGED_DURING_READ');
  return {...facts,labIdentity:ready.labIdentity};
}
export function validateDataC1Acceptances(entries,review) {
  demand(Array.isArray(entries)&&entries.length===2&&same(entries.map(e=>e.cellId).sort(),[...CELLS].sort()),'DATA_DECISION_SET');
  for(const e of entries){
    const f=review.fieldProofs.find(x=>x.cellId===e.cellId);
    demand(e.type==='CELL_ACCEPTED'&&e.admissionMode===DATA_MODE&&e.status==='PASS'&&e.field===f.field
      &&e.sourceRunId===review.runId&&e.sourceCellId===ORDER_CELL&&e.sourceObservationHash===review.observationArtifactHash
      &&e.productHead===review.productHead&&e.productTree===review.productTree&&e.policySha256===DATA_POLICY_SHA256
      &&e.reviewIndexSha256===hash(Buffer.from(stableOrderJson(review)+'\n'))&&e.fieldProofSha256===hash(Buffer.from(stableOrderJson(f))),'DATA_ACCEPTANCE_BINDING');
  }return true;
}
export function verifyDataC1(options={}) {
  const started=performance.now(),errors=[...(options.specErrors||[])];let result=null;
  try{
    demand(!errors.length&&options.requiredCells?.length===1120&&new Set(options.requiredCells.map(c=>c.cellId)).size===1120
      &&CELLS.every(id=>options.requiredCells.some(c=>c.cellId===id)),'DATA_DENOMINATOR');
    result=inspectDataC1Evidence(options);
    validateDataC1Acceptances(result.ledger.filter(e=>e.type==='CELL_ACCEPTED'&&e.admissionMode===DATA_MODE&&e.sourceRunId===options.runId),result.review);
    demand(readOrderFile(options.labRoot,'runs/'+options.runId+'/data-c1-review-index.json').bytes.equals(Buffer.from(stableOrderJson(result.review)+'\n')),'DATA_INDEX_BINDING');
  }catch(error){errors.push(String(error.message));}
  const ok=!errors.length;
  return {ok,errors,contractId:'YALKEN_INTEROP_100_SUPPORTED_CONTRACT_V1',evidenceMode:'DATA_C1_RECIPE_V1',authoritativeAdmission:ok,
    requiredCells:1120,recordedCells:ok?2:0,passedRequiredCells:ok?2:0,acceptedCellIds:ok?CELLS:[],
    diagnosticPassedRequiredCells:0,broadPassClaim:false,claimVerdict:ok?'NEEDS_MORE_EVIDENCE':'FAIL_DATA_C1_EVIDENCE',
    statusCounts:{PASS:ok?2:0,NOT_EXECUTED:ok?1118:1120},currentHead:result?.review.productHead||null,currentTree:result?.review.productTree||null,
    cellDecisions:ok?result.review.fieldProofs.map(f=>({cellId:f.cellId,status:'PASS',outcome:f.outcome,sourceRunId:options.runId,fieldProofSha256:hash(Buffer.from(stableOrderJson(f)))})):[],
    percentage:ok?0.178571:0,runId:options.runId,caseId:result?.review.caseId||null,caseSha256:result?.review.caseSha256||null,
    policySha256:DATA_POLICY_SHA256,rawReadback:result?.raw||null,seconds:(performance.now()-started)/1000,
    limitations:['Bounded paragraph data on one C1 source route; fixture variants and repeats do not add unique cell IDs.']};
}

if(path.resolve(process.argv[1]||'')===fileURLToPath(import.meta.url)){
  try{
    const args=process.argv.slice(2);demand(args.length>=1,'DATA_CLI_MODE');
    const mode=args.shift(),options={};
    demand(args.length%2===0,'DATA_CLI_ARGS');
    const keys={'--lab-root':'labRoot','--case-id':'caseId','--run-id':'runId','--product-head':'productHead','--product-tree':'productTree'};
    for(let i=0;i<args.length;i+=2){const key=keys[args[i]];demand(key&&!Object.hasOwn(options,key),'DATA_CLI_ARGS');options[key]=args[i+1];}
    demand(['preflight','raw'].includes(mode),'DATA_CLI_MODE');
    console.log(JSON.stringify(mode==='preflight'?prepareDataC1(options):inspectDataC1Artifacts(options)));
  }catch(error){console.log(JSON.stringify({ok:false,admissionCredit:0,error:String(error.message)}));process.exitCode=1;}
}

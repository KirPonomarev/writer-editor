import fs from 'node:fs';
import path from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {performance} from 'node:perf_hooks';
import {readOrderFile,stableOrderJson,hashOrderObservation} from './rtk-interop-order-c1.mjs';
import {loadDataPolicy,DATA_POLICY_SHA256,hash} from './rtk-interop-data-c1.mjs';
import {MANUSCRIPT_VOLUMES,MANUSCRIPT_CELLS,manuscriptFields,manuscriptUsesSafeCreate,C1_REVIEW_RECIPE,UNICODE_PROBES,MANUSCRIPT_LINK_TARGETS,buildWordManuscriptFixture} from './rtk-interop-word-manuscript-fixtures.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const READER='scripts/ops/rtk-interop-word-manuscript-readback.py';
const SPEC='docs/OPS/RTK/YALKEN_INTEROP_100_DENOMINATOR_V1.json';
export const MANUSCRIPT_BATCH_MODE='WORD_MANUSCRIPT_BATCH_V1';
export const MANUSCRIPT_HOPS=Object.freeze({
 C1:['YALKEN_EXPORT','WORD_LIFECYCLE','YALKEN_RETURN_INTAKE'],
 C2:['YALKEN_EXPORT','WORD_LIFECYCLE','YALKEN_RETURN_INTAKE','YALKEN_APPLY','YALKEN_REEXPORT','WORD_REOPEN_READBACK'],
 C3:['YALKEN_EXPORT_ROUND_N','WORD_LIFECYCLE_ROUND_N','YALKEN_RETURN_INTAKE_ROUND_N','YALKEN_APPLY_ROUND_N'],
 C5:['YALKEN_SOURCE_EXPORT','GOOGLE_NATIVE_LIFECYCLE','GOOGLE_NATIVE_DOCX_EXPORT','YALKEN_RETURN_INTAKE'],
});
export const MANUSCRIPT_SUBCASES=Object.freeze({
 TEXT:['bodyTextReadbackIndependent','emptyParagraphsAccounted','lineBreakPolicyDeclared','paragraphBoundariesPreserved','plainTextPreserved','whitespaceEdgesPreserved'],
 ORDER:['blockOrderPreserved','providerTraversalStable','roundTripOrderStable','reorderDetected','sortKeysHashBound','orderDiffVisible'],
 UNICODE_IME_LOCALE:['unicodeNormalizationStable','bidiRunsAccounted','imeCompositionTextPreserved','localeProfileBound','fontScriptFallbackDeclared','unicodeReadbackIndependent'],
 STYLES:['inlineStylesAccounted','paragraphStylesAccounted','styleCascadeReadback','fontFallbackLedgered','unsupportedStylesDeclared','styleHashBound'],
 NOVEL_SCENE_STRUCTURE:['sceneBoundariesPreserved','chapterOrderPreserved','splitMergeDetected','projectHierarchyMapped','structureLossLedgered','sceneCountReadback'],
 TRACKED_REVIEW_SEMANTICS:['trackedInsertDetected','trackedDeleteDetected','moveOrPropertyChangeTyped','reviewAuthorMetadataAccounted','noSilentApplyProof','manualOnlyReasonsLedgered'],
 COMMENTS:['commentBodiesPreserved','commentAnchorsPreserved','threadShapeAccounted','resolvedDeletedStateDeclared','lostCommentsLedgered','commentReadbackIndependent'],
 IDENTIFIERS_ANCHORS:['bookmarkIdentityPreserved','anchorBijectionVerified','hyperlinkRelationshipsValidated','duplicateAnchorRejected','locatorHashBound','identifierLossLedgered'],
 METADATA:['documentPropertiesAccounted','customPropertiesAccounted','authorshipPolicyDeclared','timestampPolicyDeclared','receiptIdentityBound','metadataLossLedgered'],
});
const TEXT_CONTROLS=['swap-paragraphs','delete-empty','trim-spaces','corrupt-unicode','drop-final-paragraph','duplicate-paragraph','swap-scenes','truncate-half','corrupt-last-scene','normalize-nfd','remove-bidi-isolate','remove-ime-character'];
const STYLE_CONTROLS=['remove-bold','change-align','change-heading','change-font','change-number-start','remove-code-style','remove-quote-style'];
const STRUCTURE_CONTROLS=['remove-bookmark','duplicate-bookmark','swap-scene-bookmarks','remove-scene','swap-chapters','merge-scene-path'];
export function manuscriptStages(route,recipe='DEFAULT'){
 const stages={source:0,'source-renderer':0,composition:0},cycles=route==='C3'?5:1,generic=manuscriptUsesSafeCreate(route,recipe);
 for(let n=1;n<=cycles;n++){
  const r=generic?0:n,p='rounds/'+n;
  stages[p+'/export-docx']=generic?0:n-1;
  if(route==='C5'){stages[p+'/google-native-before']=0;stages[p+'/google-native-after']=0;stages[p+'/google-docx']=0;}
  else{stages[p+'/word-native']=r;stages[p+'/word-docx']=r;}
  if(!generic){stages[p+'/persisted']=r;stages[p+'/applied-renderer']=r;}
 }
 if(generic)for(const p of ['import-renderer','imported-raw','persisted','saved-renderer','reopened-renderer','reexport-docx','final-word-lifecycle-native','final-word-lifecycle-docx'])stages[p]=0;
 else for(const p of ['reopened-persisted','reopened-renderer','reexport-docx','final-word-lifecycle-native','final-word-lifecycle-docx'])stages[p]=cycles;
 return stages;
}
const demand=(ok,code)=>{if(!ok)throw new Error(code);};
const same=(a,b)=>stableOrderJson(a)===stableOrderJson(b);
const sha40=x=>typeof x==='string'&&/^[a-f0-9]{40}$/u.test(x);
const sha64=x=>typeof x==='string'&&/^[a-f0-9]{64}$/u.test(x);
export function validateManuscriptIdentifierProof(p,volume,cycles,roundProofs){
 const names=['rounds/1/review-probe','reexport','final-word-lifecycle',...Array.from({length:cycles},(_,i)=>['rounds/'+(i+1)+'/export','rounds/'+(i+1)+'/word']).flat()];
 const locatorNames=['reexport',...Array.from({length:cycles},(_,i)=>'rounds/'+(i+1)+'/export')];
 const fixture=buildWordManuscriptFixture(volume,'C2'),paragraphIndex=fixture.scenes[0].paragraphs.indexOf('[links] reference / reference / reference.');
 const links=[0,1,0].map((target,i)=>({paragraphIndex,startUtf16:8+12*i,endUtf16:17+12*i,text:'reference',href:MANUSCRIPT_LINK_TARGETS[target]}));
 const linkHash=hash(stableOrderJson(links)),blockCount=fixture.paragraphsForRound(0).length,sceneCount=fixture.scenes.length;
 demand(p&&same(Object.keys(p.stages||{}).sort(),names.sort())&&same(Object.keys(p.locators||{}).sort(),locatorNames.sort()),'MANUSCRIPT_IDENTIFIER_STAGES');
 for(const s of Object.values(p.stages))demand(s.bookmarkCount===blockCount&&same(s.links,links)&&s.linkSemanticSha256===linkHash
  &&[s.bookmarkSha256,s.relationshipsSha256,s.artifactSha256].every(sha64)&&typeof s.roundId==='string'&&s.roundId.startsWith('round-')&&s.scope,'MANUSCRIPT_IDENTIFIER_RAW');
 for(const l of Object.values(p.locators))demand([l.artifactSha256,l.locatorSha256,l.sourceMapSha256].every(sha64)&&/^sha256:[a-f0-9]{64}$/u.test(l.storeDigest)&&/^sha256:[a-f0-9]{64}$/u.test(l.coreManifestDigest)
  &&l.blockCount===blockCount&&l.sceneCount===sceneCount&&l.sourceSceneHashes?.length===sceneCount&&l.sourceSceneHashes.every(sha64)
  &&l.storage?.encoding==='gzip'&&sha64(l.storage.encodedSha256)&&Number.isSafeInteger(l.storage.encodedBytes)&&l.storage.encodedBytes>0&&l.storage.encodedBytes<=32*1024*1024
  &&Number.isSafeInteger(l.storage.decodedBytes)&&l.storage.decodedBytes>0&&l.storage.decodedBytes<=128*1024*1024,'MANUSCRIPT_LOCATOR_HASH');
 for(const [i,r] of roundProofs.entries()){
  const key='rounds/'+(i+1),e=p.stages[key+'/export'],w=p.stages[key+'/word'],l=p.locators[key+'/export'];
  demand(e.artifactSha256===r.exportSha256&&w.artifactSha256===r.returnedSha256&&e.roundId===r.roundId&&w.roundId===r.roundId&&l.roundId===r.roundId&&l.exportId===r.exportId&&e.bookmarkSha256===w.bookmarkSha256,'MANUSCRIPT_IDENTIFIER_ROUND_BINDING');
  if(i)demand(same(l.sourceSceneHashes,roundProofs[i-1].savedSceneHashes),'MANUSCRIPT_LOCATOR_ROUND_BASELINE');
 }
 demand(p.locators.reexport.roundId===p.stages.reexport.roundId&&p.stages.reexport.roundId===p.stages['final-word-lifecycle'].roundId&&p.stages.reexport.bookmarkSha256===p.stages['final-word-lifecycle'].bookmarkSha256
  &&same(p.locators.reexport.sourceSceneHashes,roundProofs.at(-1).savedSceneHashes),'MANUSCRIPT_IDENTIFIER_REEXPORT');
 const ids=['missing-bookmark','duplicate-bookmark','wrong-bookmark-end','partial-bookmark-range','renamed-bookmark','removed-link','swapped-link-targets','dangling-link','duplicate-relationship','unsafe-link','unreferenced-link'];
 demand(Array.isArray(p.negativeControls)&&same(p.negativeControls.map(c=>c.id),ids)&&p.negativeControls.every(c=>c.rejected===true&&sha64(c.sha256))
  &&new Set(p.negativeControls.map(c=>c.sha256)).size===ids.length,'MANUSCRIPT_IDENTIFIER_CONTROLS');
 demand(Array.isArray(p.intakeControls)&&same(p.intakeControls.map(c=>c.kind),['identity','missing-bookmark','duplicate-bookmark']),'MANUSCRIPT_IDENTIFIER_INTAKES');
 for(const c of p.intakeControls)demand(c.sourceSha256===roundProofs[0].returnedSha256&&c.sourceSha256!==c.mutantSha256
  &&[c.mutantSha256,c.intakeSha256,c.canonicalStateSha256].every(sha64)&&c.writerCalled===false&&c.previewAccepted===true&&c.exactMatchAllowed===(c.kind==='identity')
  &&c.applyAttempted===(c.kind!=='identity')&&(c.kind==='identity'?(c.code===null&&c.applyCode===null&&c.applyResultSha256===null):
   c.code==='DOCX_REVIEW_BOOKMARK_'+(c.kind==='missing-bookmark'?'MISSING':'DUPLICATE')&&c.applyCode==='E_REVIEW_EXACT_TEXT_APPLY_BATCH_BLOCKED'&&sha64(c.applyResultSha256))
  &&c.lostIdentifiers?.length===(c.kind==='missing-bookmark'?1:0)&&c.duplicateIdentifiers?.length===(c.kind==='duplicate-bookmark'?1:0)
  &&[...c.lostIdentifiers,...c.duplicateIdentifiers].every(n=>/^YRTK_[a-f0-9]{32}$/u.test(n)),'MANUSCRIPT_IDENTIFIER_INTAKE_BINDING');
 demand(new Set(p.intakeControls.map(c=>c.canonicalStateSha256)).size===1&&new Set(p.intakeControls.map(c=>c.mutantSha256)).size===3
  &&p.intakeControls[1].lostIdentifiers[0]===p.intakeControls[2].duplicateIdentifiers[0],'MANUSCRIPT_IDENTIFIER_NEGATIVE_STATE');
 demand(p.lossLedger&&['lostIdentifiers','duplicateIdentifiers','unsafeHyperlinks'].every(k=>same(p.lossLedger[k],[]))&&p.lossLedger.scope,'MANUSCRIPT_IDENTIFIER_LOSS_LEDGER');
 return true;
}
export function validateManuscriptCommentProof(p,cycles,roundProofs){
 const names=['rounds/1/review-probe','reexport','final-word-lifecycle',...Array.from({length:cycles},(_,i)=>['rounds/'+(i+1)+'/export','rounds/'+(i+1)+'/word']).flat()];
 const queries=['source-comments','reopened-comments',...Array.from({length:cycles},(_,i)=>'rounds/'+(i+1)+'/comments')];
 demand(p?.sourceKind==='OWNED_SAVED_PROJECT_FIXTURE'&&p.canonicalApplyClaim===false&&sha64(p.sourceStateSha256)&&typeof p.scope==='string'&&p.scope.length>0,'MANUSCRIPT_COMMENT_SCOPE');
 demand(same(Object.keys(p.stages||{}).sort(),names.sort())&&same(Object.keys(p.queries||{}).sort(),queries.sort()),'MANUSCRIPT_COMMENT_STAGES');
 for(const s of Object.values(p.stages))demand(s.messageCount===4&&s.threadCount===2&&s.intentionalDeletionCount===1&&sha64(s.artifactSha256)&&sha64(s.semanticSha256)
  &&same(Object.keys(s.partsSha256),['comments','commentsExtended','commentsIds','commentsExtensible'])&&Object.values(s.partsSha256).every(sha64),'MANUSCRIPT_COMMENT_RAW');
 demand(new Set(Object.values(p.stages).map(s=>s.semanticSha256)).size===1&&Object.values(p.queries).every(q=>q.rawStateSha256===p.sourceStateSha256&&sha64(q.querySha256)),'MANUSCRIPT_COMMENT_CONTINUITY');
 for(const [i,r] of roundProofs.entries())demand(p.stages['rounds/'+(i+1)+'/export'].artifactSha256===r.exportSha256&&p.stages['rounds/'+(i+1)+'/word'].artifactSha256===r.returnedSha256,'MANUSCRIPT_COMMENT_ROUND_BYTES');
 const controls=['missing-root','missing-reply','body-whitespace','wrong-author','wrong-date','wrong-utc-namespace','wrong-parent','wrong-status','wrong-anchor','missing-reference','duplicate-identity','deleted-reappeared'];
 demand(Array.isArray(p.negativeControls)&&same(p.negativeControls.map(c=>c.id),controls)&&p.negativeControls.every(c=>c.rejected===true&&sha64(c.sha256))
  &&new Set(p.negativeControls.map(c=>c.sha256)).size===controls.length,'MANUSCRIPT_COMMENT_CONTROLS');
 const l=p.lossControl;
 demand(l?.sourceSha256===roundProofs[0].returnedSha256&&sha64(l.mutantSha256)&&l.mutantSha256!==l.sourceSha256&&sha64(l.intakeSha256)
  &&l.canonicalStateSha256===p.sourceStateSha256&&l.writerCalled===false
  &&same(l.missing,['open','resolved'].map(status=>({threadId:'manuscript-comment-'+status,canonicalCommentId:'manuscript-comment-'+status+'-root',code:'COMMENT_ROOT_MISSING'}))),'MANUSCRIPT_COMMENT_LOSS');
 demand(same(p.intentionalDeletionLedger,[{threadId:'manuscript-comment-deleted',status:'deleted',messageCount:2,outcome:'CANONICAL_DELETION_NOT_EXPORTED'}]),'MANUSCRIPT_COMMENT_DELETION');
 return true;
}
export function validateManuscriptMetadataProof(p,cycles,roundProofs){
 const names=['reexport','final-word-lifecycle',...Array.from({length:cycles},(_,i)=>['rounds/'+(i+1)+'/export','rounds/'+(i+1)+'/word']).flat()];
 const protectedKeys=['schemaVersion','projectId','title','createdAtUtc','creator'];
 const publicKeys=['YALKEN_METADATA_SCHEMA','YALKEN_METADATA_POLICY','YALKEN_PROJECT_ID','YALKEN_PROJECT_TITLE','YALKEN_PROJECT_CREATED_AT_UTC','YALKEN_APPLICATION_CREATOR','YALKEN_METADATA_DIGEST'];
 demand(p?.schemaVersion==='WORD_MANUSCRIPT_METADATA_PROOF_V1'&&p.authority==='ADVISORY_ONLY_NO_PROJECT_METADATA_WRITE'
  &&p.policies?.authorship==='APPLICATION_CREATOR_IS_YALKEN_PROJECT_AUTHOR_NOT_INFERRED'
  &&p.policies?.timestamps==='PROJECT_CREATED_AT_PROTECTED_MODIFIED_AT_PROVIDER_VOLATILE'
  &&p.policies?.returnedAuthority==='ADVISORY_ONLY_NO_PROJECT_METADATA_WRITE'
  &&p.policies?.unknownCustomProperties==='LEDGER_ONLY_NO_AUTHORITY'
  &&p.policies?.policyId==='CANONICAL_PROJECT_METADATA_PROTECTED_PROVIDER_VOLATILE_V1','MANUSCRIPT_METADATA_POLICY');
 demand(same(Object.keys(p.stages||{}).sort(),names.sort()),'MANUSCRIPT_METADATA_STAGES');
 const expected=p.expected;
 demand(expected&&same(Object.keys(expected.protectedProperties||{}),protectedKeys)&&expected.protectedProperties.creator==='Yalken'
  &&expected.protectedProperties.schemaVersion==='yalken.rtk.word.document-metadata.v1'&&/^sha256:[a-f0-9]{64}$/u.test(expected.protectedDigest)
  &&expected.protectedDigest===`sha256:${hash(stableOrderJson(expected.protectedProperties))}`
  &&same(Object.keys(expected.publicCustomProperties||{}).sort(),publicKeys.sort()),'MANUSCRIPT_METADATA_EXPECTED');
 for(const [name,s] of Object.entries(p.stages))demand(sha64(s.artifactSha256)&&s.protectedDigest===expected.protectedDigest
  &&same(s.protectedProperties,expected.protectedProperties)&&same(s.publicCustomProperties,expected.publicCustomProperties)
  &&['projectId','title','creator'].every(k=>s.coreProtectedProperties?.[k]===expected.protectedProperties[k])
  &&s.coreProtectedProperties?.createdAtUtc?.slice(0,16)===expected.protectedProperties.createdAtUtc.slice(0,16)
  &&s.createdTimestampType==='dcterms:W3CDTF'&&s.corePropertiesPresent===true&&s.customPropertiesPresent===true
  &&same(s.duplicateCorePropertyNames,[])&&same(s.duplicateCustomPropertyNames,[])&&same(s.missingProtectedProperties,[])&&same(s.missingCoreProtectedProperties,[])
  &&same(s.unknownCustomPropertyNames,[])&&same(s.providerVolatileFields,['lastModifiedBy','modifiedAtUtc','revision'])
  &&(same(s.providerNormalizedFields,[])||same(s.providerNormalizedFields,['createdAtUtc.minutePrecision']))
  &&s.volatileCoreProperties&&typeof s.volatileCoreProperties.lastModifiedBy==='string'&&typeof s.volatileCoreProperties.modifiedAtUtc==='string'&&typeof s.volatileCoreProperties.revision==='string','MANUSCRIPT_METADATA_STAGE:'+name);
 for(const [i,r] of roundProofs.entries())demand(p.stages['rounds/'+(i+1)+'/export'].artifactSha256===r.exportSha256
  &&p.stages['rounds/'+(i+1)+'/word'].artifactSha256===r.returnedSha256,'MANUSCRIPT_METADATA_ROUND_BINDING');
 demand(p.stages.reexport.artifactSha256!==''&&p.stages['final-word-lifecycle'].artifactSha256!==''
  &&p.stages.reexport.protectedDigest===p.stages['final-word-lifecycle'].protectedDigest,'MANUSCRIPT_METADATA_REEXPORT');
 demand(Array.isArray(p.intakeBindings)&&p.intakeBindings.length===cycles&&p.intakeBindings.every((x,i)=>x.ordinal===i+1
  &&x.status==='VERIFIED_PROTECTED_DOCUMENT_METADATA'&&x.authority==='ADVISORY_ONLY_NO_PROJECT_METADATA_WRITE'
  &&x.protectedDigest===expected.protectedDigest&&same(x.protectedProperties,expected.protectedProperties)
  &&same(x.before,x.after)&&sha64(x.manifestSha256)&&x.writerCalled===false),'MANUSCRIPT_METADATA_INTAKES');
 const ids=['changed-title','changed-project-id','changed-created-at','missing-core-part','missing-custom-property','duplicate-protected-property','forged-signed-digest'];
 demand(Array.isArray(p.negativeControls)&&same(p.negativeControls.map(x=>x.id),ids)&&p.negativeControls.every(x=>x.rejected===true
  &&typeof x.code==='string'&&x.code.startsWith('RTK_RETURN_INTAKE_')&&sha64(x.mutantSha256)&&sha64(x.intakeSha256)&&sha64(x.canonicalStateSha256)
  &&x.writerCalled===false&&same(x.before,x.after)&&Array.isArray(x.mismatches))
  &&p.negativeControls.filter(x=>!['missing-core-part','forged-signed-digest'].includes(x.id)).every(x=>x.code==='RTK_RETURN_INTAKE_DOCUMENT_METADATA_MISMATCH'&&x.mismatches.length>0)
  &&new Set(p.negativeControls.map(x=>x.mutantSha256)).size===ids.length,'MANUSCRIPT_METADATA_CONTROLS');
 demand(p.lossLedger&&same(p.lossLedger.missingProtectedProperties,[])&&same(p.lossLedger.missingCoreProtectedProperties,[])&&same(p.lossLedger.duplicateCorePropertyNames,[])
  &&same(p.lossLedger.duplicateCustomPropertyNames,[])&&same(p.lossLedger.unknownCustomPropertyNames,[])
  &&same(p.lossLedger.providerVolatileFields,['lastModifiedBy','modifiedAtUtc','revision'])&&Array.isArray(p.lossLedger.providerNormalizedFieldsObserved)
  &&p.lossLedger.providerNormalizedFieldsObserved.every(x=>x==='createdAtUtc.minutePrecision')&&new Set(p.lossLedger.providerNormalizedFieldsObserved).size===p.lossLedger.providerNormalizedFieldsObserved.length
  &&p.lossLedger.providerNormalizationPolicy==='WORD_CORE_CREATED_AT_MINUTE_PRECISION_CUSTOM_PROPERTY_RETAINS_EXACT'
  &&typeof p.lossLedger.scope==='string'&&p.lossLedger.scope.length>0,'MANUSCRIPT_METADATA_LEDGER');
 return true;
}
export function validateGoogleManuscriptTransport(p){
 demand(p?.schemaVersion==='GOOGLE_NATIVE_DIRECT_TRANSPORT_V2'&&p.status==='ROUTE_QUALIFIED_NOT_CELL_PASS'
  &&same(p.directLocalPathImport,{supported:true,countsAsPass:false,qualification:'ACTUAL_SYNTHETIC_IMPORT_NATIVE_READBACK_EXPORT_AND_EXACT_ID_CLEANUP'})
  &&p.sourceReferenceKind==='ABSOLUTE_LOCAL_FILE_PATH'
  &&same(p.requiredSteps,['IMPORT_LOCAL_DOCX_AS_NATIVE_GOOGLE_DOC','VERIFY_NATIVE_ID_MIME_REVISION_AND_FULL_BODY','EXPORT_NATIVE_DOCX','VERIFY_UNCHANGED_NATIVE_REVISION','DELETE_EXACT_CREATED_GOOGLE_FILES'])
  &&p.createdDriveFilesCleanup==='EXACT_CREATED_IDS_DELETE_REQUIRED'&&p.routeQualificationCountsAsCellPass===false
  &&p.productRuntimeNetworkPolicy==='OFFLINE_FIRST_RUNTIME_NETWORK_DENIED'&&p.externalConnectorUse==='DISPOSABLE_SYNTHETIC_TEST_EVIDENCE_ONLY'
  &&p.supersedesArchivedTransportAssumption?.specSha256==='5a4bc6e1d3946028ca4fa71fba622727a29d65d5a1c0cf7e5a76126504ddad93'
  &&p.supersedesArchivedTransportAssumption?.field==='providerTransportPolicy.googleLocalDocxToNativeImport'
  &&p.supersedesArchivedTransportAssumption?.retainsHistoricalStagingReceipt===true,'MANUSCRIPT_GOOGLE_TRANSPORT_POLICY');
 return true;
}
const gitAt=root=>args=>execFileSync('git',args,{cwd:root,encoding:'utf8',timeout:10000,maxBuffer:16*1024*1024});
const json=(root,file,max)=>JSON.parse(readOrderFile(root,file,max).bytes);
function clean(root){
  const git=gitAt(root);
  demand(!git(['status','--porcelain=v1','--untracked-files=all']).trim(),'MANUSCRIPT_BATCH_DIRTY');
  const [head,tree]=git(['rev-parse','HEAD','HEAD^{tree}']).trim().split('\n');
  demand(sha40(head)&&sha40(tree),'MANUSCRIPT_BATCH_GIT_IDENTITY');return {head,tree};
}
export function validateManuscriptRuns(runIds){
  demand(Array.isArray(runIds)&&runIds.length>=1&&runIds.length<=38,'MANUSCRIPT_BATCH_RUN_SET');
  const rows=runIds.map(runId=>{
    demand(typeof runId==='string','MANUSCRIPT_BATCH_RUN_ID');
    const m=/^ORDER__(SINGLE_SCENE|MULTI_SCENE|FULL_SYNTHETIC_NOVEL|LARGE_DOCUMENT)__(C[1235])__(SOURCE_RUNTIME|PACKAGED_BUILD_RUNTIME)__([A-Za-z0-9_-]{1,80})$/u.exec(runId);
    demand(m,'MANUSCRIPT_BATCH_RUN_ID');
    const recipe=m[4].startsWith('review-return-')?C1_REVIEW_RECIPE:'DEFAULT';
    manuscriptFields(m[1],m[2],recipe);return {runId,volume:m[1],route:m[2],profile:m[3],recipe,cellId:runId.slice(0,runId.lastIndexOf('__'))};
  });
  demand(new Set(rows.map(x=>x.cellId+':'+x.recipe)).size===rows.length,'MANUSCRIPT_BATCH_DUPLICATE_JOURNEY');return rows;
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
  demand(candidates.length===1&&candidates[0].cellId===row.cellId&&candidates[0].recipe===row.recipe,'MANUSCRIPT_BATCH_EXACT_OBSERVATION');
  const obs=candidates[0];
  demand(!ledger.some(e=>(e.runId===row.runId&&(e.stale===true||['PRIVACY_INVALIDATED','AUDIT_INVALIDATED_PHYSICAL_OBSERVATION'].includes(e.type)))
    ||(e.type==='EVIDENCE_SUPERSEDES'&&e.supersedesRunId===row.runId)
    ||(e.type==='AUDIT_INVALIDATED_PHYSICAL_OBSERVATION'&&e.artifactHash===obs.artifactHash)),'MANUSCRIPT_BATCH_INVALIDATED');
  return obs;
}
export function validateManuscriptRaw(raw,{row,head,tree,observationSha256,files,policy}){
 const cycles=row.route==='C3'?5:1,fields=manuscriptFields(row.volume,row.route,row.recipe),batch=policy.wordManuscriptBatch,generic=manuscriptUsesSafeCreate(row.route,row.recipe);
 demand(raw?.ok===true&&raw.schemaVersion==='WORD_MANUSCRIPT_RAW_READBACK_V1'&&raw.admissionCredit===0
  &&raw.runId===row.runId&&raw.recipe===row.recipe&&raw.productHead===head&&raw.productTree===tree
  &&raw.observationSha256===observationSha256&&raw.filesVerified===files.length,'MANUSCRIPT_RAW_BINDING');
 demand(Array.isArray(raw.fieldProofs)&&same(raw.fieldProofs.map(f=>f.field),fields),'MANUSCRIPT_FIELD_SET');
 demand(raw.roundProofs?.length===cycles&&same(raw.roundProofs.map(r=>r.ordinal),Array.from({length:cycles},(_,i)=>i+1))
  &&new Set(raw.roundProofs.map(r=>r.exportId)).size===cycles&&new Set(raw.roundProofs.map(r=>r.roundId)).size===cycles,'MANUSCRIPT_FIVE_ACTUAL_CYCLES');
 const sceneCount=row.volume==='SINGLE_SCENE'?1:row.volume==='MULTI_SCENE'?3:21;
 for(const r of raw.roundProofs)demand(typeof r.exportId==='string'&&r.exportId.startsWith('export-')&&typeof r.roundId==='string'&&r.roundId.startsWith('round-')
  &&sha64(r.exportSha256)&&sha64(r.returnedSha256)&&r.savedSceneHashes?.length===sceneCount&&r.savedSceneHashes.every(sha64),'MANUSCRIPT_ROUND_RAW_PROOF');
 const expected=manuscriptStages(row.route,row.recipe),stageNames=Object.keys(expected).sort();
 const controls=(rows,ids)=>Array.isArray(rows)&&same(rows.map(x=>x.id),ids)&&rows.every(x=>x.rejected===true&&sha64(x.sha256))&&new Set(rows.map(x=>x.sha256)).size===ids.length;
 for(const f of raw.fieldProofs){
  demand(f.runId===row.runId&&f.cellId===`${f.field}__${row.volume}__${row.route}__${row.profile}`&&f.status==='PASS'
   &&same(f.subcases,MANUSCRIPT_SUBCASES[f.field])&&same(f.requiredHops,MANUSCRIPT_HOPS[row.route])&&f.requiredCycles===cycles&&same(f.oracles,policy.requiredOracles),'MANUSCRIPT_FIELD_SCOPE');
  demand(same(Object.keys(f.stageProofs).sort(),stageNames),'MANUSCRIPT_STAGE_SET');
  for(const [name,n] of Object.entries(expected)){
   const stage=f.stageProofs[name],qualified=row.recipe===C1_REVIEW_RECIPE?batch.reviewReturnParagraphHashes[row.volume][n]:batch.paragraphHashes[row.volume][row.route][n];
   demand(stage.round===n&&stage.paragraphSha256===qualified.sha256&&stage.paragraphCount===qualified.count&&sha64(stage.sortKeysSha256),'MANUSCRIPT_STAGE_HASH');
  }
  demand(same(f.controls.positiveControls,['identity','split-xml-runs'])&&controls(f.controls.textMutants,TEXT_CONTROLS)
   &&controls(f.controls.styleMutants,STYLE_CONTROLS)
   &&controls(f.controls.structureMutants,row.volume==='SINGLE_SCENE'?[]:generic?STRUCTURE_CONTROLS.slice(0,3):STRUCTURE_CONTROLS),'MANUSCRIPT_RAW_MUTATIONS');
  const u=f.unicodeProof;demand(same(u?.probes,UNICODE_PROBES)&&sha64(u?.compositionEventsSha256)&&u.locale?.language&&u.locale.languages.includes(u.locale.language)
   &&u.locale.intl?.locale&&u.locale.intl.timeZone&&u.fontLedger?.length===(generic?sceneCount+2:2*sceneCount+cycles)
   &&u.fontLedger.every(x=>x.fonts?.length&&x.fonts.reduce((s,f)=>s+f.glyphCount,0)>0&&x.scope.includes('Chromium'))&&u.limitations?.ime&&u.limitations?.fonts,'MANUSCRIPT_UNICODE_FONT_BINDING');
  if(row.route==='C5'){
   const g=f.googleProof;
   demand(g?.transport==='DIRECT_LOCAL_PATH_NATIVE_CONVERSION_V2'&&g.cleanupVerified===true&&typeof g.documentId==='string'&&/^[A-Za-z0-9_-]{10,200}$/u.test(g.documentId)&&typeof g.revisionId==='string'&&g.revisionId.length>0
    &&sha64(g.sourceSha256)&&sha64(g.returnedSha256)&&sha64(g.rawResponseSha256)&&sha64(g.productLossLedgerSha256)&&g.sourceSha256===raw.roundProofs[0].exportSha256&&g.returnedSha256===raw.roundProofs[0].returnedSha256
    &&g.nativeBodySha256===f.stageProofs['rounds/1/google-native-before'].paragraphSha256&&same(u.providerLocale,g.providerLocale)
    &&same(g.providerLocale,{mode:'CONTENT_API_NO_PROVIDER_UI_SESSION',sourceLocaleBoundSeparately:true,normalization:'LITERAL_CODEPOINTS_NO_NORMALIZATION'})
    &&controls(g.negativeControls,['wrong-source-binding','non-native-mime','mixed-document-id','changed-revision','missing-cleanup','missing-tab','coherent-native-text-loss','returned-byte-substitution'])
    &&same(g.unclaimedFieldLedger?.notAdmitted,['STYLES','NOVEL_SCENE_STRUCTURE','IDENTIFIERS_ANCHORS'])&&Array.isArray(g.unclaimedFieldLedger.headingChanges)&&sha64(g.unclaimedFieldLedger.sourceBookmarkNamesSha256)&&sha64(g.unclaimedFieldLedger.returnedBookmarkNamesSha256),'MANUSCRIPT_GOOGLE_PROVIDER_BINDING');
  }else demand(u.providerLocale?.locale&&u.providerLocale?.languages&&!f.googleProof,'MANUSCRIPT_WORD_PROVIDER_LOCALE');
  if(f.field==='TRACKED_REVIEW_SEMANTICS'){
   const p=f.trackedReviewProof,b=p?.propertyProbe;
   const noWrite=r=>r&&same(r.canonicalBefore,r.canonicalAfter)&&r.authority==='ADVISORY_ONLY'&&sha64(r.metadataSha256);
   const revision=r=>typeof r.nativeRevisionId==='string'&&/^\d+$/u.test(r.nativeRevisionId)&&typeof r.author==='string'&&r.author.trim().length>0&&r.author.length<=1024
    &&[r.date,r.dateUtc].every(x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/u.test(x));
   const text=(r,n)=>Array.isArray(r.textRevisions)&&r.textRevisions.length===2&&same(r.textRevisions.map(x=>x.operation).sort(),['delete','insert'])
    &&r.textRevisions.every(x=>revision(x)&&x.classification==='TEXT_MANUAL'&&x.reasonCode==='RTK_MANUAL_DEGRADED_LOCATOR'&&x.text===(x.operation==='insert'?'sentinel round'+n:n===1?'sentinel alpha':'sentinel round'+(n-1)));
   demand(p&&same(p.lostRevisionFootprints,[])&&p.unappliedPropertyPolicy==='VISIBLE_MANUAL_REVIEW_WITH_ORIGINAL_RAW_ARTIFACT_RETAINED'
    &&p.timestampPolicy==='LITERAL_WORD_DATE_AND_NAMESPACED_DATE_UTC_NO_NORMALIZATION'&&p.rounds?.length===cycles,'MANUSCRIPT_REVIEW_SCOPE');
   for(const [i,r] of p.rounds.entries())demand(r.ordinal===i+1&&r.returnedSha256===raw.roundProofs[i].returnedSha256&&noWrite(r)&&text(r,i+1)&&same(r.propertyRevisions,[])&&same(r.manualOnlyReasonCodes,[])
    &&Array.isArray(r.canonicalBefore)&&r.canonicalBefore.length===sceneCount&&r.canonicalBefore.every(sha64),'MANUSCRIPT_REVIEW_ROUND');
   demand(noWrite(b)&&text(b,1)&&b.sourceSha256===raw.roundProofs[0].exportSha256&&sha64(b.returnedSha256)&&b.returnedSha256!==raw.roundProofs[0].returnedSha256
    &&b.roundId===raw.roundProofs[0].roundId&&b.exportId===raw.roundProofs[0].exportId&&same(b.manualOnlyReasonCodes,['RTK_BLOCKED_STRUCTURAL'])
    &&b.propertyRevisions?.length===1&&revision(b.propertyRevisions[0])&&b.propertyRevisions[0].propertyKind==='rPrChange'&&b.propertyRevisions[0].classification==='MANUAL_REVIEW'&&b.propertyRevisions[0].reasonCode==='RTK_BLOCKED_STRUCTURAL'
    &&same(b.canonicalBefore.sceneHashes,p.rounds[0].canonicalBefore)&&sha64(b.canonicalBefore.manifestSha256)&&sha64(b.canonicalBefore.commentStateSha256)
    &&b.canonicalBefore.commentStateSha256===raw.fieldProofs.find(f=>f.field==='COMMENTS')?.commentProof?.sourceStateSha256
    &&controls(b.negativeControls,['missing-insert','missing-delete','missing-property','changed-author','changed-legacy-date','changed-utc-date','wrong-utc-namespace','missing-current-format','wrong-property-kind','missing-manual-reason','granted-write','silent-canonical-apply']),'MANUSCRIPT_REVIEW_PROPERTY_SUBCASE');
  }
  if(f.field==='STYLES'){
   const names=Array.from({length:cycles},(_,i)=>['rounds/'+(i+1)+'/export','rounds/'+(i+1)+'/word']).flat().concat(['reexport','final-word-lifecycle']);
   demand(same(Object.keys(f.styleProofs).sort(),names.sort())&&Object.values(f.styleProofs).every(p=>p.semanticStyleSha256===batch.semanticStyleSha256&&sha64(p.stylePartsSha256['word/styles.xml'])&&sha64(p.stylePartsSha256['word/numbering.xml']))&&f.unsupportedStylesDeclared,'MANUSCRIPT_STYLE_CONTINUITY');
  }
  if(f.field==='COMMENTS')validateManuscriptCommentProof(f.commentProof,cycles,raw.roundProofs);
  if(f.field==='IDENTIFIERS_ANCHORS')validateManuscriptIdentifierProof(f.identifierProof,row.volume,cycles,raw.roundProofs);
  if(f.field==='METADATA')validateManuscriptMetadataProof(f.metadataProof,cycles,raw.roundProofs);
  if(f.field==='NOVEL_SCENE_STRUCTURE'){
   const names=['source-tree','reopen-tree','reexport','final-word-lifecycle',...Array.from({length:cycles},(_,i)=>['rounds/'+(i+1)+'/export','rounds/'+(i+1)+'/word','rounds/'+(i+1)+'/tree']).flat()];
   demand(same(Object.keys(f.structureProofs).sort(),names.sort())&&Object.entries(f.structureProofs).every(([name,p])=>name.endsWith('tree')?p.sceneCount===sceneCount&&sha64(p.hierarchySha256):sha64(p.bookmarkSha256))
    &&['lostScenes','lostChapters','mergedScenes','splitScenes'].every(k=>same(f.structureLossLedger[k],[]))&&f.structureLossLedger.scope,'MANUSCRIPT_SCENE_STRUCTURE');
  }
 }
 demand(raw.finalHops?.ok===true&&raw.finalHops.acceptanceCredit===0,'MANUSCRIPT_FINAL_HOPS');
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
    validateGoogleManuscriptTransport(batch.googleNativeTransport);
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
      for(const k of ['labHead','labTree','createdAt','status','recipe','yalkenShadowHead','yalkenShadowTree'])demand(obs[k]===entry[k],'MANUSCRIPT_BATCH_LEDGER_BINDING');
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
    const proved=reviews.flatMap(r=>r.raw.fieldProofs.map(f=>f.cellId));
    demand(new Set(proved).size===proved.length,'MANUSCRIPT_BATCH_DUPLICATE_CELL_CREDIT');
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
    limitations:['Only complete named field subcases at executed fixed volumes and actual source/packaged profiles.',
      'C1 safe-create retains its four original fields. Separate C1 review-return runs prove only their disjoint review/comment/identifier/hierarchy fields; ordinary content import still declares metadata/bookmark loss.',
      'C3 requires five actual authenticated Word edit/apply rounds, a fresh process and terminal Word readback.',
      'C5 additionally binds complete native Google bodies before/after DOCX export, an unchanged provider revision and exact created-ID deletion. LARGE_DOCUMENT and non-text fields remain unproved in C5.',
      'IME proof covers native Chromium composition on the bound locale; all OS IME engines and pixel identity remain unproved.']};
}

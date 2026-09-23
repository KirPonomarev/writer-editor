#!/usr/bin/env python3
"""Independent C4 Google Office readback. Raw results never grant cell credit."""
import hashlib, importlib.util, json, re, sys, time
from pathlib import Path

_spec=importlib.util.spec_from_file_location('word_volume_oracle',Path(__file__).with_name('rtk-interop-word-volume-readback.py'))
v=importlib.util.module_from_spec(_spec);_spec.loader.exec_module(v)
require=v.require;digest=v.digest;canonical=v.canonical
TEXT_SUBCASES=['bodyTextReadbackIndependent','emptyParagraphsAccounted','lineBreakPolicyDeclared','paragraphBoundariesPreserved','plainTextPreserved','whitespaceEdgesPreserved']
ORDER_SUBCASES=['blockOrderPreserved','providerTraversalStable','roundTripOrderStable','reorderDetected','sortKeysHashBound','orderDiffVisible']
SUBCASES={'TEXT':TEXT_SUBCASES,'ORDER':ORDER_SUBCASES}
STAGES=['source-export','google-native-lifecycle','google-docx-export','yalken-return-intake','cleanup']
NATIVE_MIME='application/vnd.google-apps.document'
DOCX_MIME='application/vnd.openxmlformats-officedocument.wordprocessingml.document'

def sha64(value):return isinstance(value,str) and re.fullmatch('[a-f0-9]{64}',value) is not None
def same(a,b):return canonical(a)==canonical(b)
def order_sha(paragraphs):return digest(canonical([digest(p.encode('utf8')) for p in paragraphs]))

def audit(request):
    started=time.perf_counter()
    root=Path(request['root']);require(root.is_absolute() and root.resolve()==root and root.is_dir(),'C4_RAW_ROOT')
    run=request.get('runId','');m=re.fullmatch(r'(TEXT|ORDER)__SINGLE_SCENE__C4__SOURCE_RUNTIME__([A-Za-z0-9_-]{1,80})',run)
    require(m is not None,'C4_RUN_ID');field=m.group(1);cell_id='__'.join(run.split('__')[:-1])
    head=request.get('productHead');tree=request.get('productTree')
    require(all(isinstance(x,str) and re.fullmatch('[a-f0-9]{40}',x) for x in (head,tree)),'C4_HEAD_TREE')
    policy=request.get('policy') or {};scope=policy.get('scope') or {}
    require(policy.get('schemaVersion')=='YALKEN_INTEROP_C4_GOOGLE_OFFICE_POLICY_V1'
      and scope.get('route')=='C4' and scope.get('volume')=='SINGLE_SCENE' and scope.get('profile')=='SOURCE_RUNTIME'
      and scope.get('fields')==['TEXT','ORDER'] and policy.get('admission',{}).get('admissionCreditFromRawReader')==0,'C4_POLICY')
    prefix='runs/'+run+'/';bindings=request.get('files')
    require(isinstance(bindings,list) and 0<len(bindings)<=2048 and len({b.get('path') for b in bindings})==len(bindings),'C4_INVENTORY')
    require(all(isinstance(b.get('path'),str) and b['path'].startswith(prefix) for b in bindings)
      and sum(b.get('bytes',0) for b in bindings)<=384*1024*1024,'C4_INVENTORY_BOUND')
    files={b['path']:v.checked_read(root,b) for b in bindings}
    raw=lambda name:files[prefix+name]
    read=lambda name:json.loads(raw(name))
    required=policy.get('requiredArtifacts');require(isinstance(required,list) and len(required)==len(set(required)),'C4_REQUIRED_ARTIFACTS')
    require(prefix+policy.get('proofArtifact','') in files,'C4_PROOF_MISSING')
    require(not any(prefix+name in files for name in policy.get('forbiddenArtifacts',[])),'C4_FORBIDDEN_APPLY')
    proof=read(policy['proofArtifact']);obs=read('observation.json')
    observation_artifacts=obs.get('artifacts')
    require(isinstance(observation_artifacts,list) and len(observation_artifacts)>0,'C4_OBSERVATION_ARTIFACTS')
    artifact_paths={item.get('path'):item for item in observation_artifacts if isinstance(item,dict)}
    expected_artifact_paths={prefix+name for name in [*required,policy['proofArtifact']]}
    require(len(artifact_paths)==len(observation_artifacts) and set(artifact_paths)==expected_artifact_paths,'C4_OBSERVATION_ARTIFACT_SET')
    for name in [*required,policy['proofArtifact']]:
        descriptor=artifact_paths[prefix+name]
        require(descriptor.get('bytes')==len(raw(name)) and descriptor.get('sha256')==digest(raw(name)),'C4_OBSERVATION_ARTIFACT_BINDING')
    require(proof.get('schemaVersion')=='YALKEN_C4_GOOGLE_OFFICE_PROOF_V1' and proof.get('runId')==run
      and proof.get('cellId')==cell_id and proof.get('field')==field and proof.get('productHead')==head and proof.get('productTree')==tree,'C4_PROOF_BINDING')
    artifact_bindings=proof.get('artifactBindings')
    require(isinstance(artifact_bindings,dict) and set(artifact_bindings)==set(required),'C4_ARTIFACT_BINDINGS')
    for name in required:
        require(prefix+name in files and sha64(artifact_bindings[name]) and digest(raw(name))==artifact_bindings[name],'C4_ARTIFACT_HASH')
    require(obs.get('type')=='PHYSICAL_OBSERVATION' and obs.get('runId')==run and obs.get('cellId')==cell_id
      and obs.get('field')==field and obs.get('volume')=='SINGLE_SCENE' and obs.get('route')=='C4'
      and obs.get('profile')=='SOURCE_RUNTIME' and obs.get('status')=='PASS' and obs.get('candidateDiagnosticOnly') is False
      and obs.get('recipe')=='DEFAULT' and obs.get('candidateOverlay')=={'id':'baseline','changed':False}
      and (obs.get('yalkenShadowHead'),obs.get('yalkenShadowTree'))==(head,tree)
      and obs.get('providerExecution')=={'requested':'Google Docs Native UI','executed':True},'C4_OBSERVATION')
    snapshot=read('runtime-project-snapshot.json');source_phase=read('source-review-export-phase.json');scene_readback=read('source-scene-readback.json')
    export_result=source_phase.get('exportResult',{});capsule=export_result.get('exportCapsule');scene=capsule.get('sceneId') if isinstance(capsule,dict) else None
    require(isinstance(scene,str) and scene and not scene.startswith('/') and '\\' not in scene and len(scene)<=512
      and all(part not in ('','.','..') for part in scene.split('/')) and scene.endswith('.txt'),'C4_SCENE_PATH')
    require(isinstance(capsule,dict) and capsule.get('schemaVersion')=='yalken.rtk.word.product-review-docx-export.v1'
      and capsule.get('projectId')==snapshot.get('manifest',{}).get('projectId')
      and capsule.get('sceneId')==scene and capsule.get('sceneRevision')=='sha256:'+proof.get('sourceSceneSha256')
      and capsule.get('rawSha256')=='sha256:'+proof.get('sourceSceneSha256')
      and capsule.get('blockCount')==policy.get('scope',{}).get('expectedParagraphCount')
      and capsule.get('automaticApplyCertified') is False and capsule.get('productRuntimeWired') is True
      and capsule.get('returnIntakeWired') is False and capsule.get('secretEmbeddedInDocx') is False
      and capsule.get('fullManuscript',False) is False,'C4_EXPORT_CAPSULE')
    node_id=source_phase.get('sourceNodeId');nodes=snapshot.get('manifest',{}).get('treeIdentity',{}).get('nodes',{})
    node=nodes.get(node_id) if isinstance(nodes,dict) else None
    scene_nodes=[(ident,value) for ident,value in nodes.items() if isinstance(value,dict) and value.get('kind')=='scene'] if isinstance(nodes,dict) else []
    require(isinstance(node_id,str) and isinstance(node,dict) and node.get('kind')=='scene' and node.get('present') is True
      and node.get('bindingKey')=='file:'+scene,'C4_CANONICAL_SCENE')
    require(len(scene_nodes)==1 and scene_nodes[0][0]==node_id and scene_nodes[0][1].get('bindingKey')=='file:'+scene,'C4_SCENE_UNIQUENESS')
    scene_path=prefix+'runtime-project-snapshot/'+scene
    require(scene_path in files and digest(files[scene_path])==proof.get('sourceSceneSha256')
      and scene_readback.get('sceneId')==scene
      and scene_readback.get('sceneFileSha256')==proof.get('sourceSceneSha256'),'C4_SCENE_FILE')
    expected=list(v.PROBES);source_text=raw('source.txt').decode('utf8').split('\n')
    precondition=source_phase.get('sourceAuthoringPrecondition',{})
    export_command=policy.get('scenePolicy',{}).get('exportCommandId')
    require(source_text==expected and source_phase.get('schemaVersion')=='yalken.portability.lab.v2.c2-source-review-export-phase'
      and source_phase.get('commandId')==export_command and export_result.get('commandId')==export_command
      and source_phase.get('ok') is True and source_phase.get('openResult',{}).get('ok') is True
      and source_phase.get('openResult',{}).get('documentId')==node_id and export_result.get('ok') is True
      and export_result.get('exported') is True and export_result.get('canAutoApply') is False
      and export_result.get('canWriteManuscript') is False and export_result.get('canImportMutate') is False
      and source_phase.get('sceneHashBeforeExport')==source_phase.get('sceneHashAfterExport')==proof.get('sourceSceneSha256')
      and export_result.get('bytesWritten')==len(raw('yalken-review-source.docx'))
      and source_phase.get('noMutationDuringExport') is True
      and source_phase.get('projectId')==snapshot.get('manifest',{}).get('projectId')
      and source_phase.get('sceneId')==scene and source_phase.get('sourceNodeId')==node_id
      and precondition.get('expectedParagraphs')==expected and precondition.get('persistedParagraphs')==expected
      and precondition.get('rendererParagraphs')==expected and scene_readback.get('rendererSourceParagraphs')==expected
      and scene_readback.get('sourceSceneParse',{}).get('paragraphs')==expected,'C4_SOURCE_BODY')
    source_docx=raw('yalken-review-source.docx');returned_docx=raw('word-tracked-review-return.docx')
    source_paragraphs,_=v.docx(source_docx)
    returned_paragraphs,_=v.docx(returned_docx,tracked=True)
    expected_return=expected.copy();expected_return[0]=expected_return[0].replace(scope['sourceToken'],scope['suggestedToken'])
    require(source_paragraphs==expected and returned_paragraphs==expected_return,'C4_DOCX_BODY')
    source_docx_sha=digest(source_docx);returned_docx_sha=digest(returned_docx)
    source_body_sha=digest(canonical(source_paragraphs));returned_body_sha=digest(canonical(returned_paragraphs))
    source_order_sha=order_sha(source_paragraphs);returned_order_sha=order_sha([p.replace(scope['suggestedToken'],scope['sourceToken']) for p in returned_paragraphs])
    require(source_phase.get('sourceDocx',{}).get('sha256')==source_docx_sha
      and proof.get('sourceDocxSha256')==source_docx_sha and proof.get('returnedDocxSha256')==returned_docx_sha
      and source_order_sha==returned_order_sha,'C4_DOCX_BINDING')
    provider=read('google-docs-native-provider-receipt.json');metadata=read('google-docs-native-provider-metadata.json')
    transcript=read('google-docs-native-ui-transcript.json');native=provider.get('providerMetadata',{}).get('nativeDocument',{})
    life=provider.get('providerMetadata',{}).get('lifecycle',{});revision=proof.get('googleOffice',{})
    native_id=provider.get('nativeDocumentId')
    require(provider.get('schemaVersion')=='yalken.portability.lab.v2.google-docs-native-provider-receipt'
      and provider.get('type')=='GOOGLE_DOCS_NATIVE_PROVIDER_RECEIPT' and provider.get('runId')==run and provider.get('cellId')==cell_id
      and provider.get('route')=='C4' and provider.get('profile')=='SOURCE_RUNTIME'
      and (provider.get('yalkenShadowHead'),provider.get('yalkenShadowTree'))==(head,tree)
      and provider.get('sourceDocxSha256')==source_docx_sha and provider.get('returnedDocxSha256')==returned_docx_sha
      and provider.get('sourceMimeType')==DOCX_MIME and provider.get('nativeDocumentMimeType')==NATIVE_MIME and provider.get('exportMimeType')==DOCX_MIME
      and isinstance(native_id,str) and re.fullmatch('[A-Za-z0-9_-]{10,200}',native_id) and native.get('id')==native_id and native.get('mimeType')==NATIVE_MIME
      and metadata.get('providerMetadata')==provider.get('providerMetadata')
      and metadata.get('providerMetadataSha256')==provider.get('providerMetadataSha256')
      and provider.get('providerMetadataSha256')==digest(canonical(provider.get('providerMetadata')))
      and life.get('googleDocsUiMode')=='SUGGESTING' and life.get('nativeEditApplied') is True
      and life.get('nativeCommentCreated') is True and life.get('nativeAnchoredCommentCreated') is True
      and life.get('autosaveObserved') is True and life.get('reopenObserved') is True and life.get('postExportMutation') is False,'C4_PROVIDER_RECEIPT')
    require(transcript.get('schemaVersion')=='yalken.portability.lab.v2.google-docs-native-ui-transcript'
      and transcript.get('runId')==run and transcript.get('cellId')==cell_id and transcript.get('nativeDocumentId')==native_id
      and transcript.get('googleDocsUiMode')=='SUGGESTING'
      and transcript.get('findAndReplace')=={'sourceToken':scope['sourceToken'],'replacementToken':scope['suggestedToken'],'suggestionObserved':True}
      and transcript.get('nativeAnchoredCommentVisible') is True and transcript.get('autosaveObserved') is True
      and transcript.get('reopenObserved') is True and transcript.get('postExportMutation') is False
      and transcript.get('rawDownloadMethod')=='GOOGLE_DOCS_UI_EXPORT_GSUITE_DOCX'
      and transcript.get('rawDownloadReturnedDocxSha256')==returned_docx_sha,'C4_UI_TRANSCRIPT')
    screenshot_names=['google-docs-native-ui-suggesting.png','google-docs-native-ui-comment.png','google-docs-native-ui-reopen.png']
    for name in screenshot_names:require(raw(name).startswith(b'\x89PNG\r\n\x1a\n') and len(raw(name))>100,'C4_UI_SCREENSHOT')
    cleanup=read('google-docs-native-cleanup.json')
    require(cleanup.get('schemaVersion')=='YALKEN_C4_GOOGLE_OFFICE_CLEANUP_V1' and cleanup.get('runId')==run
      and cleanup.get('createdDocumentIds')==[native_id] and cleanup.get('deletedDocumentIds')==[native_id] and cleanup.get('verified') is True,'C4_EXACT_CLEANUP')
    intake=read('review-return-intake.json');selected=intake.get('selectedChange') or {};before=proof.get('sourceSceneSha256')
    require(intake.get('schemaVersion')=='yalken.portability.lab.v2.c2-review-return-intake'
      and intake.get('writerCalled') is False and intake.get('rendererAuthority') is False and intake.get('canAutoApply') is False
      and intake.get('canImportMutate') is False and intake.get('canWriteStorage') is False and intake.get('noMutationDuringIntake') is True
      and intake.get('beforeIntakeSceneHash')==intake.get('afterIntakeSceneHash')==before
      and intake.get('textChangeCount')==1 and selected.get('match',{}).get('quote')==scope['sourceToken']
      and selected.get('replacementText')==scope['suggestedToken'],'C4_ADVISORY_INTAKE')
    build=read('runtime-build.json');toolchain=build.get('toolchain',{});copy=build.get('runtimeAppCopyProof',{})
    require(build.get('runId')==run and build.get('cellId')==cell_id and (build.get('shadowHead'),build.get('shadowTree'))==(head,tree)
      and build.get('build',{}).get('status')==0 and build.get('packagedBuild') is None
      and copy.get('ok') is True and copy.get('sourceFileCount')==copy.get('copyFileCount')>0
      and copy.get('sourceDigest')==copy.get('copyDigest') and copy.get('failures')==[]
      and toolchain.get('compatibleWithShadowManifests') is True
      and toolchain.get('shadowPackageJsonSha256')==toolchain.get('dependencyPackageJsonSha256')==request.get('packageJsonSha256')
      and toolchain.get('shadowPackageLockSha256')==toolchain.get('dependencyPackageLockSha256')==request.get('packageLockSha256')
      and toolchain.get('electronPackageVersion')==request.get('electronVersion'),'C4_SOURCE_RUNTIME')
    require(revision.get('sourceRevisionId') and revision.get('postSuggestionRevisionId')
      and revision.get('sourceRevisionId')!=revision.get('postSuggestionRevisionId')
      and revision.get('revisionBeforeExport')==revision.get('revisionAfterExport')==revision.get('postSuggestionRevisionId')
      and revision.get('nativeBodySha256') in (source_body_sha,returned_body_sha),'C4_REVISION_BINDING')
    require(proof.get('sourceSceneSha256')==digest(files[scene_path]) and proof.get('sourceBodySha256')==source_body_sha
      and proof.get('returnedBodySha256')==returned_body_sha,'C4_PROOF_CONTENT_BINDING')
    capsule_sha=digest(canonical(capsule));export_id=capsule.get('exportId');round_id=capsule.get('roundId')
    require(re.fullmatch('[A-Za-z0-9_-]{8,128}',str(export_id)) and re.fullmatch('[A-Za-z0-9_-]{8,128}',str(round_id)),'C4_EXPORT_IDENTITY')
    field_proof={'field':field,'cellId':cell_id,'runId':run,'status':'PASS','outcome':'EXACT_OBSERVED_MANUSCRIPT_PRESERVATION',
      'requiredHops':scope['hops'],'requiredCycles':1,'subcases':SUBCASES[field],
      'proof':{'sourceBodySha256':source_body_sha,'returnedBodySha256':returned_body_sha,
        'sourceParagraphOrderSha256':source_order_sha,'returnedParagraphOrderSha256':returned_order_sha,
        'sceneId':scene,'sceneCount':1,'suggestionObserved':True}}
    c4proof={'schemaVersion':'YALKEN_C4_GOOGLE_OFFICE_PROOF_V1','route':'C4','volume':'SINGLE_SCENE','profile':'SOURCE_RUNTIME',
      'field':field,'runId':run,'cellId':cell_id,'productHead':head,'productTree':tree,'artifactBindings':artifact_bindings,
      'scene':{'projectId':snapshot['manifest']['projectId'],'sceneId':scene,'sceneNodeId':node_id,'sceneKind':'scene','sceneCount':1,
        'orderedSceneIds':[scene],'sceneFileSha256':before,'sourceDocxSha256':source_docx_sha,'paragraphCount':len(source_paragraphs),
        'paragraphSha256':source_body_sha,'paragraphOrderSha256':source_order_sha,'exportCapsuleSha256':capsule_sha,'exportId':export_id,'roundId':round_id},
      'googleOffice':{'nativeDocumentId':native_id,'nativeDocumentMimeType':NATIVE_MIME,'exportMimeType':DOCX_MIME,
        'sourceRevisionId':revision['sourceRevisionId'],'postSuggestionRevisionId':revision['postSuggestionRevisionId'],
        'revisionBeforeExport':revision['revisionBeforeExport'],'revisionAfterExport':revision['revisionAfterExport'],
        'sourceBodySha256':source_body_sha,'nativeBodySha256':revision['nativeBodySha256'],'returnedBodySha256':returned_body_sha,
        'sourceDocxSha256':source_docx_sha,'returnedDocxSha256':returned_docx_sha,'uiMode':'SUGGESTING','suggestionObserved':True,
        'anchoredCommentObserved':True,'autosaveObserved':True,'reopenObserved':True,'postExportMutation':False,
        'transcriptSha256':digest(raw('google-docs-native-ui-transcript.json')),
        'screenshots':[{'stage':stage,'sha256':digest(raw(name))} for stage,name in zip(['suggestingMode','anchoredComment','reopen'],screenshot_names)],
        'exactCreatedDocumentIds':[native_id],'deletedDocumentIds':[native_id],'cleanupVerified':True},
      'intake':{'writerCalled':False,'rendererAuthority':False,'canAutoApply':False,'canImportMutate':False,'canWriteStorage':False,
        'beforeSceneSha256':before,'afterSceneSha256':before,'previewBodySha256':returned_body_sha},
      'textOrder':{'sourceBodySha256':source_body_sha,'returnedBodySha256':returned_body_sha,'sourceParagraphCount':len(source_paragraphs),
        'returnedParagraphCount':len(returned_paragraphs),'sourceOrderSha256':source_order_sha,'returnedOrderSha256':returned_order_sha,'orderStableAfterSuggestion':True}}
    round_proof={'ordinal':1,'exportId':export_id,'roundId':round_id,'exportSha256':source_docx_sha,'returnedSha256':returned_docx_sha,'savedSceneHashes':[before]}
    stages={'source-export':'source-review-export-phase.json','google-native-lifecycle':'google-docs-native-provider-receipt.json',
      'google-docx-export':'word-tracked-review-return.docx','yalken-return-intake':'review-return-intake.json','cleanup':'google-docs-native-cleanup.json'}
    field_proof['stageProofs']={stage:{'ok':True,'artifactSha256':digest(raw(name))} for stage,name in stages.items()}
    return {'ok':True,'schemaVersion':'YALKEN_C4_GOOGLE_OFFICE_RAW_V1','admissionCredit':0,'runId':run,'cellId':cell_id,'field':field,
      'productHead':head,'productTree':tree,'observationSha256':digest(raw('observation.json')),'filesVerified':len(files),
      'fieldProof':field_proof,'roundProof':round_proof,'finalHops':{'ok':True,'acceptanceCredit':0},'c4Proof':c4proof,
      'seconds':time.perf_counter()-started}

if __name__=='__main__':
    try:
        data=sys.stdin.buffer.read(1024*1024+1);require(len(data)<=1024*1024,'C4_REQUEST_SIZE')
        result=audit(json.loads(data));print(json.dumps(result,ensure_ascii=False))
    except Exception as e:
        print(json.dumps({'ok':False,'error':str(e),'admissionCredit':0}));sys.exit(1)

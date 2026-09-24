#!/usr/bin/env python3
"""Independent, bounded raw readback for the single-scene C4 review route.

The Lab observation and provider receipt are untrusted inputs. This reader
rehashes their complete artifact inventory and derives TEXT/ORDER continuity
from DOCX XML and the reopened project bytes, with zero admission authority.
"""
import importlib.util
from datetime import datetime
import io
import json
from pathlib import Path
import re
import sys
import time
import xml.etree.ElementTree as ET
import zipfile


def load(name, filename):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(filename))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


order = load('c4_order', 'rtk-interop-order-c1-readback.py')
text = load('c4_text', 'rtk-interop-text-c1-readback.py')
require, digest, W = order.require, order.digest, order.W
SOURCE = tuple(order.EXPECTED)
REVIEWED = tuple(p.replace('sentinel alpha', 'sentinel omega') for p in SOURCE)
PROFILES = ('SOURCE_RUNTIME', 'PACKAGED_BUILD_RUNTIME')
FIELDS = ('TEXT', 'ORDER')
SUBCASES = {
    'TEXT': tuple(text.SUBCASES),
    'ORDER': tuple(order.SUBCASES),
}
HOPS = ('YALKEN_DOCX_EXPORT', 'GOOGLE_OFFICE_LIFECYCLE', 'YALKEN_RETURN_INTAKE')
MAX_FILE = 8 * 1024 * 1024


def same(actual, expected, code):
    require(actual == expected, code)


def docx_paragraphs(data, returned):
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        info = archive.infolist()
        names = [item.filename for item in info]
        require(0 < len(names) <= 128 and len(names) == len(set(names)), 'C4_ZIP_ENTRIES')
        require(all(not n.startswith('/') and '\\' not in n and all(p not in ('', '.', '..') for p in n.split('/')) for n in names), 'C4_ZIP_PATH')
        require(all(not item.flag_bits & 1 and item.file_size <= MAX_FILE for item in info)
                and sum(item.file_size for item in info) <= MAX_FILE and archive.testzip() is None, 'C4_ZIP_BOUNDS')
        raw = archive.read('word/document.xml')
        require(b'<!DOCTYPE' not in raw.upper() and b'<!ENTITY' not in raw.upper(), 'C4_XML_ENTITY')
        doc = ET.fromstring(raw)
        body = doc.find(W+'body')
        require(doc.tag == W+'document' and body is not None, 'C4_XML_BODY')
        allowed_body = {W+'p', W+'sectPr', W+'bookmarkStart', W+'bookmarkEnd'}
        allowed_para = {W+'pPr', W+'r', W+'ins', W+'del', W+'bookmarkStart', W+'bookmarkEnd'}
        allowed_run = {W+'rPr', W+'t', W+'delText', W+'commentReference'}
        require(all(node.tag in allowed_body for node in body), 'C4_UNDECLARED_BODY')
        paragraphs = body.findall(W+'p')
        require(len(paragraphs) == len(SOURCE), 'C4_PARAGRAPH_COUNT')
        for para in paragraphs:
            require(all(node.tag in allowed_para for node in para), 'C4_UNDECLARED_PARAGRAPH')
            for revision in [*para.findall(W+'ins'), *para.findall(W+'del')]:
                require(all(node.tag in (W+'r', W+'commentRangeStart', W+'commentRangeEnd')
                            for node in revision), 'C4_UNDECLARED_REVISION')
            for run in para.iter(W+'r'):
                require(all(node.tag in allowed_run for node in run), 'C4_UNDECLARED_RUN')
        insertions = body.findall('.//'+W+'ins')
        deletions = body.findall('.//'+W+'del')
        require((len(insertions), len(deletions)) == ((1, 1) if returned else (0, 0)), 'C4_TRACKED_REVIEW')
        visible = []
        for para in paragraphs:
            chunks = []
            for node in para.iter():
                if node.tag == W+'t' and not any(parent.tag == W+'del' and node in parent.iter()
                                                    for parent in para.iter(W+'del')):
                    chunks.append(node.text or '')
            visible.append(''.join(chunks))
        same(tuple(visible), REVIEWED if returned else SOURCE, 'C4_DOCX_TEXT_ORDER')
        return visible


def scene_paragraphs(data):
    source = data.decode('utf8')
    first, payload = source.split('\n', 1)
    require(re.fullmatch(r'\[doc-v2 length=[1-9][0-9]{0,6}\]', first), 'C4_SCENE_HEADER')
    doc = json.loads(payload)
    require(doc.get('type') == 'doc' and isinstance(doc.get('content'), list), 'C4_SCENE_DOC')
    result = []
    for para in doc['content']:
        require(para.get('type') == 'paragraph', 'C4_SCENE_PARAGRAPH')
        children = para.get('content', [])
        require(isinstance(children, list) and all(child.get('type') == 'text' and isinstance(child.get('text'), str)
                                                    for child in children), 'C4_SCENE_CONTENT')
        result.append(''.join(child['text'] for child in children))
    same(tuple(result), REVIEWED, 'C4_SCENE_TEXT_ORDER')
    return result


def audit(request):
    started = time.perf_counter()
    run = request['runId']
    match = re.fullmatch(r'ORDER__SINGLE_SCENE__C4__(SOURCE_RUNTIME|PACKAGED_BUILD_RUNTIME)__[A-Za-z0-9_-]{1,80}', run)
    require(match is not None, 'C4_RUN_ID')
    profile = match.group(1)
    head, tree = request['productHead'], request['productTree']
    require(all(re.fullmatch('[a-f0-9]{40}', value) for value in (head, tree)), 'C4_PRODUCT_IDENTITY')
    root = Path(request['root'])
    require(root.is_absolute() and root.resolve() == root and root.is_dir(), 'C4_LAB_ROOT')
    bindings = request['files']
    prefix = 'runs/'+run+'/'
    require(0 < len(bindings) <= 128 and len({item['path'] for item in bindings}) == len(bindings)
            and all(item['path'].startswith(prefix) and type(item['bytes']) is int
                    and 0 <= item['bytes'] <= MAX_FILE for item in bindings)
            and sum(item['bytes'] for item in bindings) <= 64*1024*1024, 'C4_INVENTORY')
    files = {item['path']: order.checked_read(root, item) for item in bindings}
    raw = lambda name: files[prefix+name]
    read = lambda name: json.loads(raw(name))
    observation = read('observation.json')
    require(observation['runId'] == run and observation['cellId'] == run.rsplit('__', 1)[0]
            and observation['field'] == 'ORDER' and observation['volume'] == 'SINGLE_SCENE'
            and observation['route'] == 'C4' and observation['profile'] == profile
            and observation['yalkenShadowHead'] == head and observation['yalkenShadowTree'] == tree
            and observation['status'] == 'PASS' and observation['candidateDiagnosticOnly'] is False
            and observation['candidateOverlay']['id'] == 'baseline'
            and observation['candidateOverlay']['changed'] is False, 'C4_OBSERVATION_SCOPE')
    runtime = observation['yalkenShadowRuntime']
    require(runtime['headBefore'] == runtime['headAfter'] == head
            and runtime['treeBefore'] == runtime['treeAfter'] == tree
            and runtime['statusBefore'] == runtime['statusAfter'] == '', 'C4_RUNTIME_CLEAN')
    same(tuple(raw('source.txt').decode('utf8').split('\n')), SOURCE, 'C4_SOURCE_FIXTURE')
    source = raw('yalken-review-source.docx')
    returned = raw('word-tracked-review-return.docx')
    docx_paragraphs(source, False)
    docx_paragraphs(returned, True)
    require(digest(source) != digest(returned), 'C4_PROVIDER_NO_CHANGE')
    controls = {'TEXT': text.text_controls(source), 'ORDER': order.semantic_controls(source)}
    receipt = read('google-docs-native-provider-receipt.json')
    metadata = read('google-docs-native-provider-metadata.json')
    lifecycle = read('word-lifecycle.json')
    provider = receipt['providerMetadata']
    same(metadata['providerMetadata'], provider, 'C4_PROVIDER_METADATA')
    same(metadata['providerMetadataSha256'], receipt['providerMetadataSha256'], 'C4_PROVIDER_METADATA_HASH')
    require(digest(json.dumps(provider, ensure_ascii=False, separators=(',', ':'), sort_keys=True).encode())
            == receipt['providerMetadataSha256'], 'C4_PROVIDER_METADATA_DIGEST')
    require(receipt['runId'] == run and receipt['cellId'] == observation['cellId']
            and receipt['route'] == 'C4' and receipt['profile'] == profile
            and receipt['yalkenShadowHead'] == head and receipt['yalkenShadowTree'] == tree
            and receipt['sourceDocxSha256'] == lifecycle['sourceDocxSha256'] == digest(source)
            and receipt['returnedDocxSha256'] == lifecycle['returnedDocxSha256'] == digest(returned)
            and receipt['nativeDocumentMimeType'] == 'application/vnd.google-apps.document'
            and receipt['exportMimeType'] == 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            and receipt['nativeDocumentId'] == provider['nativeDocument']['id']
            and re.fullmatch(r'[A-Za-z0-9_-]{20,160}', receipt['nativeDocumentId'])
            and receipt['nativeDocumentUrl'] == 'https://docs.google.com/document/d/'+receipt['nativeDocumentId']
            and receipt['validation']['ok'] is True and receipt['validation']['failures'] == []
            and receipt['validation']['sourceDocxSha256'] == digest(source)
            and receipt['validation']['returnedDocxSha256'] == digest(returned)
            and 0 < datetime.fromisoformat(receipt['exportedAt'].replace('Z', '+00:00')).timestamp()
                    - datetime.fromisoformat(receipt['importedAt'].replace('Z', '+00:00')).timestamp() < 3600
            and provider['export']['returnedDocxSha256'] == digest(returned)
            and provider['lifecycle']['googleDocsUiMode'] == 'SUGGESTING'
            and all(provider['lifecycle'][name] is True for name in
                    ('nativeEditApplied', 'nativeCommentCreated', 'nativeAnchoredCommentCreated',
                     'rawGoogleUiDownload', 'reviewReturnIntakeTarget', 'reopenedVisible'))
            and provider['lifecycle']['commentCount'] >= 1
            and provider['lifecycle']['revisionCount'] >= 2, 'C4_PROVIDER_PROVENANCE')
    require(lifecycle['status'] == 'PASS' and lifecycle['cleanupOk'] is True
            and lifecycle['runId'] == run and lifecycle['returnedArtifactChanged'] is True,
            'C4_LIFECYCLE')
    transcript = read('google-docs-native-ui-transcript.json')
    require(transcript['googleDocsUiMode'] == 'SUGGESTING'
            and transcript['nativeAnchoredCommentVisible'] is True
            and transcript['autosaveObserved'] is True and transcript['reopenObserved'] is True
            and transcript['rawDownloadReturnedDocxSha256'] == digest(returned)
            and transcript['postExportMutation'] is False, 'C4_GOOGLE_UI_TRANSCRIPT')
    for artifact, pointer in [('google-docs-native-ui-transcript.json', provider['uiEvidence']['transcript']),
                              ('google-docs-native-ui-suggesting.png', provider['uiEvidence']['screenshots']['suggestingMode']),
                              ('google-docs-native-ui-comment.png', provider['uiEvidence']['screenshots']['anchoredComment']),
                              ('google-docs-native-ui-reopen.png', provider['uiEvidence']['screenshots']['reopen'])]:
        data = raw(artifact)
        require(pointer['sha256'] == digest(data), 'C4_GOOGLE_UI_BINDING')
        if artifact.endswith('.png'):
            # The native CUA screenshot transport can store JPEG bytes under
            # the Lab's historical .png artifact name. Bind the real bytes.
            require((data.startswith(b'\x89PNG\r\n\x1a\n') or
                     (data.startswith(b'\xff\xd8\xff') and data.endswith(b'\xff\xd9')))
                    and len(data) > 100,
                    'C4_GOOGLE_UI_SCREENSHOT')
    intake = read('review-return-intake.json')
    apply = read('review-apply-receipt.json')
    reopen = read('source-review-reopen-phase.json')
    require(intake['commandId'] == 'cmd.project.review.activateDocxReviewPreviewSession'
            and intake['authenticated'] is True and intake['prepared'] is True
            and intake['writerCalled'] is False and intake['noMutationDuringIntake'] is True
            and intake['textChangeCount'] == 1
            and intake['beforeIntakeSceneHash'] == intake['afterIntakeSceneHash'] == digest(raw('source.txt')),
            'C4_PREVIEW_NO_MUTATION')
    require(apply['commandId'] == 'cmd.project.review.applyExactTextChangesBatch'
            and apply['requestedChangeCount'] == 1 and apply['mutationOnlyAfterExplicitApply'] is True
            and apply['beforeApplySceneHash'] == intake['beforeIntakeSceneHash']
            and apply['afterApplySceneHash'] != apply['beforeApplySceneHash']
            and apply['saveResult']['ok'] is True and reopen['ok'] is True
            and reopen['freshProcess'] is True, 'C4_EXPLICIT_APPLY')
    scene_id = reopen['sceneId']
    require(isinstance(scene_id, str) and scene_id and '..' not in scene_id.split('/'), 'C4_SCENE_ID')
    scene = raw('runtime-project-snapshot/'+scene_id)
    scene_paragraphs(scene)
    require(reopen['sceneFileSha256'] == digest(scene)
            and tuple(reopen['rendererParagraphs']) == REVIEWED
            and tuple(reopen['sceneReadback']['paragraphs']) == REVIEWED
            and apply['savedReadback']['sceneFileText'].encode('utf8') == scene
            and tuple(apply['savedReadback']['readback']['paragraphs']) == REVIEWED,
            'C4_REOPENED_SCENE')
    coverage = read('subcase-coverage.json')
    require(coverage['ok'] is True and tuple(coverage['requiredSubcases']) == SUBCASES['ORDER']
            and set(coverage['subcases']) == set(SUBCASES['ORDER'])
            and all(value == 'PASS' for value in coverage['subcases'].values()), 'C4_ORDER_SUBCASES')
    for artifact in ('source-yalken.png', 'review-preview-yalken.png',
                     'returned-yalken.png', 'reopened-yalken.png'):
        data = raw(artifact)
        require(data.startswith(b'\x89PNG\r\n\x1a\n') and len(data) > 100,
                'C4_PRODUCT_SCREENSHOT')
    return {'ok': True, 'schemaVersion': 'GOOGLE_OFFICE_C4_RAW_READBACK_V1', 'admissionCredit': 0,
            'runId': run, 'productHead': head, 'productTree': tree,
            'sourceDocxSha256': digest(source), 'returnedDocxSha256': digest(returned),
            'reopenedSceneSha256': digest(scene), 'observationSha256': digest(raw('observation.json')),
            'filesVerified': len(files), 'requiredHops': list(HOPS),
            'fieldProofs': [{'field': field, 'cellId': f'{field}__SINGLE_SCENE__C4__{profile}',
                             'runId': run, 'status': 'PASS', 'subcases': list(SUBCASES[field]),
                             'controls': controls[field],
                             'sourceParagraphSha256': digest(json.dumps(SOURCE, ensure_ascii=False, separators=(',', ':')).encode()),
                             'reviewedParagraphSha256': digest(json.dumps(REVIEWED, ensure_ascii=False, separators=(',', ':')).encode())}
                            for field in FIELDS],
            'seconds': time.perf_counter()-started}


if __name__ == '__main__':
    try:
        payload = sys.stdin.buffer.read(1024*1024+1)
        require(len(payload) <= 1024*1024, 'C4_REQUEST_SIZE')
        print(json.dumps(audit(json.loads(payload)), ensure_ascii=False))
    except Exception as error:
        print(json.dumps({'ok': False, 'error': str(error), 'admissionCredit': 0}))
        sys.exit(1)

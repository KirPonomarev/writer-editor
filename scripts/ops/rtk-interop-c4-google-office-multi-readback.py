#!/usr/bin/env python3
"""Read-only, independent raw oracle for the C4 three-scene Office return.

Lab JSON is an inventory and a set of hypotheses, never the oracle. The
decision below is recomputed from bounded OOXML and canonical scene bytes.
"""
import hashlib
import io
import json
from pathlib import Path
import re
import sys
import time
import xml.etree.ElementTree as ET
import zipfile

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
HOPS = ['YALKEN_DOCX_EXPORT', 'GOOGLE_OFFICE_LIFECYCLE', 'YALKEN_RETURN_INTAKE']
FIELDS = ['TEXT', 'ORDER', 'NOVEL_SCENE_STRUCTURE']
MAX_FILE = 8 * 1024 * 1024
MAX_TOTAL = 64 * 1024 * 1024
SOURCE_TOKEN = 'sentinel alpha'
REVIEWED_TOKEN = 'sentinel round1'


def need(condition, code):
    if not condition:
        raise ValueError(code)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def strict_json(data):
    def pairs(items):
        output = {}
        for key, value in items:
            need(key not in output, 'C4_MULTI_DUPLICATE_JSON_KEY')
            output[key] = value
        return output
    return json.loads(data, object_pairs_hook=pairs)


def bound_files(root, run, bindings):
    prefix = 'runs/' + run + '/'
    need(isinstance(bindings, list) and 1 <= len(bindings) <= 64,
         'C4_MULTI_INVENTORY_COUNT')
    need(len({b.get('path') for b in bindings}) == len(bindings),
         'C4_MULTI_INVENTORY_DUPLICATE')
    output = {}
    total = 0
    for binding in bindings:
        name = binding.get('path')
        size = binding.get('bytes')
        checksum = binding.get('sha256')
        need(isinstance(name, str) and name.startswith(prefix)
             and all(part not in ('', '.', '..') for part in name.split('/'))
             and '\\' not in name and isinstance(size, int)
             and not isinstance(size, bool) and 0 <= size <= MAX_FILE
             and isinstance(checksum, str) and re.fullmatch('[a-f0-9]{64}', checksum),
             'C4_MULTI_INVENTORY_PATH')
        file = root / name
        need(file.resolve().is_relative_to(root) and file.is_file()
             and not file.is_symlink(), 'C4_MULTI_FILE_PATH')
        data = file.read_bytes()
        need(len(data) == size and digest(data) == checksum,
             'C4_MULTI_FILE_HASH')
        output[name[len(prefix):]] = data
        total += size
    need(total <= MAX_TOTAL, 'C4_MULTI_INVENTORY_BOUNDS')
    return output


def docx_paragraphs(data, returned):
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        infos = archive.infolist()
        names = [entry.filename for entry in infos]
        need(0 < len(names) <= 256 and len(set(names)) == len(names)
             and all(not n.startswith('/') and '\\' not in n
                     and all(part not in ('', '.', '..') for part in n.split('/'))
                     for n in names)
             and all(not entry.flag_bits & 1 and entry.file_size <= MAX_FILE
                     for entry in infos)
             and sum(entry.file_size for entry in infos) <= MAX_TOTAL
             and archive.testzip() is None, 'C4_MULTI_ZIP_BOUNDS')
        need('word/document.xml' in names, 'C4_MULTI_DOCUMENT_MISSING')
        raw = archive.read('word/document.xml')
        need(b'<!DOCTYPE' not in raw.upper() and b'<!ENTITY' not in raw.upper(),
             'C4_MULTI_XML_ENTITY')
        document = ET.fromstring(raw)
        body = document.find(W + 'body')
        need(document.tag == W + 'document' and body is not None,
             'C4_MULTI_XML_BODY')
        # A table or body-level wrapper would otherwise be invisible to the
        # top-level paragraph vector. This bounded recipe has no such content.
        need(all(child.tag in {W + tag for tag in
                               ('p', 'sectPr', 'bookmarkStart', 'bookmarkEnd')}
                 for child in body), 'C4_MULTI_UNDECLARED_BODY_CONTENT')
        need(not any(node.tag in {W + tag for tag in
                 ('altChunk', 'instrText', 'fldChar', 'moveFrom', 'moveTo', 'drawing')}
                 for node in body.iter()), 'C4_MULTI_UNDECLARED_CONTENT')
        paragraphs = body.findall(W + 'p')
        need(len(paragraphs) == 35, 'C4_MULTI_PARAGRAPH_COUNT')
        visible = [''.join(node.text or '' for node in para.iter(W + 't'))
                   for para in paragraphs]
        # The product emits one U+2060 scene-boundary sentinel as the final
        # paragraph of scene 1. It is a transport carrier, not authoring text.
        need(visible[26] == '\u2060'
             and all('\u2060' not in value for index, value in enumerate(visible)
                     if index != 26), 'C4_MULTI_BOUNDARY_CARRIER')
        visible[26] = ''
        revisions = [(index, node) for index, para in enumerate(paragraphs)
                     for node in para.iter() if node.tag in (W + 'ins', W + 'del')]
        starts = [(index, node.get(W + 'id')) for index, para in enumerate(paragraphs)
                  for node in para.iter(W + 'commentRangeStart')]
        ends = [(index, node.get(W + 'id')) for index, para in enumerate(paragraphs)
                for node in para.iter(W + 'commentRangeEnd')]
        refs = [(index, node.get(W + 'id')) for index, para in enumerate(paragraphs)
                for node in para.iter(W + 'commentReference')]
        if returned:
            need(revisions and all(index == 0 for index, _ in revisions)
                 and ''.join(node.text or '' for node in paragraphs[0].iter(W + 'delText'))
                 == SOURCE_TOKEN
                 and sum(REVIEWED_TOKEN in ''.join(t.text or '' for t in node.iter(W + 't'))
                         for _, node in revisions if node.tag == W + 'ins') >= 1,
                 'C4_MULTI_TRACKED_REVIEW')
            need(len(starts) == len(ends) == len(refs) == 1
                 and starts[0][0] == ends[0][0] == refs[0][0] == 0
                 and starts[0][1] is not None
                 and starts[0][1] == ends[0][1] == refs[0][1],
                 'C4_MULTI_COMMENT_ANCHOR')
            need('word/comments.xml' in names, 'C4_MULTI_COMMENT_MISSING')
            comment_raw = archive.read('word/comments.xml')
            need(b'<!DOCTYPE' not in comment_raw.upper()
                 and b'<!ENTITY' not in comment_raw.upper(),
                 'C4_MULTI_COMMENT_ENTITY')
            comments = ET.fromstring(comment_raw)
            rows = comments.findall(W + 'comment')
            need(comments.tag == W + 'comments' and len(rows) == 1
                 and rows[0].get(W + 'id') == starts[0][1]
                 and 'synthetic anchor' in ''.join(t.text or '' for t in rows[0].iter(W + 't')),
                 'C4_MULTI_COMMENT_PAYLOAD')
        else:
            need(not revisions and not starts and not ends and not refs
                 and 'word/comments.xml' not in names, 'C4_MULTI_SOURCE_REVIEW_FREE')
        return visible


def scene_paragraphs(data):
    source = data.decode('utf8')
    metadata = '[meta]\nstatus: черновик\ntags: POV=; линия=; место=\nsynopsis: \n[/meta]\n\n'
    need(source.startswith(metadata), 'C4_MULTI_SCENE_METADATA')
    match = re.match(r'\[doc-v2 length=[1-9][0-9]{0,6}\]\n', source[len(metadata):])
    need(match is not None, 'C4_MULTI_SCENE_HEADER')
    document = strict_json(source[len(metadata) + match.end():])
    need(document.get('type') == 'doc' and isinstance(document.get('content'), list),
         'C4_MULTI_SCENE_DOCUMENT')
    paragraphs = []

    def text(node):
        need(isinstance(node, dict), 'C4_MULTI_SCENE_NODE')
        if node.get('type') == 'text':
            need(isinstance(node.get('text'), str), 'C4_MULTI_SCENE_TEXT')
            return node['text']
        children = node.get('content', [])
        need(isinstance(children, list), 'C4_MULTI_SCENE_CHILDREN')
        return ''.join(text(child) for child in children)

    def visit(node):
        need(isinstance(node, dict), 'C4_MULTI_SCENE_BLOCK')
        if node.get('type') in ('paragraph', 'heading', 'codeBlock'):
            paragraphs.append(text(node))
            return
        for child in node.get('content', []):
            visit(child)

    visit(document)
    need(0 < len(paragraphs) <= 128, 'C4_MULTI_SCENE_PARAGRAPHS')
    return paragraphs


def tree_scenes(tree):
    result = []

    def visit(node):
        need(isinstance(node, dict), 'C4_MULTI_TREE_NODE')
        if node.get('kind') == 'scene':
            result.append(node.get('nodeId'))
        for child in node.get('children', []):
            visit(child)

    need(tree.get('ok') is True and isinstance(tree.get('root'), dict),
         'C4_MULTI_TREE')
    visit(tree['root'])
    return result


def verify_core(files, run, head, tree):
    def raw(name):
        need(name in files, 'C4_MULTI_MISSING_FILE:' + name)
        return files[name]

    def read(name):
        return strict_json(raw(name))

    observation = read('observation.json')
    profile = re.fullmatch(
        r'ORDER__MULTI_SCENE__C4__(SOURCE_RUNTIME|PACKAGED_BUILD_RUNTIME)__[A-Za-z0-9_-]{1,80}',
        run)
    need(profile is not None, 'C4_MULTI_RUN_ID')
    profile = profile.group(1)
    need(observation.get('runId') == run
         and observation.get('cellId') == 'ORDER__MULTI_SCENE__C4__' + profile
         and observation.get('field') == 'ORDER'
         and observation.get('volume') == 'MULTI_SCENE'
         and observation.get('route') == 'C4'
         and observation.get('profile') == profile
         and observation.get('status') == 'PASS'
         and observation.get('candidateDiagnosticOnly') is False
         and observation.get('admissionCredit') == 0
         and observation.get('yalkenShadowHead') == head
         and observation.get('yalkenShadowTree') == tree,
         'C4_MULTI_OBSERVATION_SCOPE')
    runtime = read('runtime-build.json')
    need(runtime.get('product') == {'head': head, 'tree': tree}
         and runtime.get('profile') == profile
         and runtime.get('toolchain', {}).get('compatibleWithShadowManifests') is True
         and runtime.get('copyProof', {}).get('ok') is True
         and runtime.get('copyProof', {}).get('sourceDigest')
             == runtime.get('copyProof', {}).get('copyDigest'),
         'C4_MULTI_RUNTIME_BUILD')
    if profile == 'PACKAGED_BUILD_RUNTIME':
        need(runtime.get('build', {}).get('packagedBuild') is not None,
             'C4_MULTI_PACKAGED_BUILD')
    else:
        need(runtime.get('build', {}).get('sourceBuild', {}).get('status') == 0,
             'C4_MULTI_SOURCE_BUILD')
    source = read('source.json')
    reopened = read('reopened.json')
    export = read('export.json')
    intake = read('intake.json')
    apply = read('apply.json')
    source_project = read('source-project.json')
    reopened_project = read('reopened-project.json')
    need(len(source.get('scenes', [])) == len(reopened.get('scenes', [])) == 3,
         'C4_MULTI_SCENE_COUNT')
    scene_ids = [row.get('sceneId') for row in source['scenes']]
    node_ids = [row.get('nodeId') for row in source['scenes']]
    need(len(set(scene_ids)) == len(set(node_ids)) == 3
         and all(isinstance(scene_id, str) and
                 re.fullmatch(r'roman/[^/]+/[^/]+/[^/]+\.txt', scene_id)
                 for scene_id in scene_ids)
         and [row.get('sceneId') for row in reopened['scenes']] == scene_ids
         and [row.get('nodeId') for row in reopened['scenes']] == node_ids,
         'C4_MULTI_SCENE_IDENTITY')
    need(tree_scenes(source['tree']) == tree_scenes(reopened['tree']) == node_ids
         and source['tree'].get('projectId') == reopened['tree'].get('projectId')
         == source_project.get('projectId') == reopened_project.get('projectId')
         and source_project.get('treeIdentity') == reopened_project.get('treeIdentity'),
         'C4_MULTI_TREE_IDENTITY')
    nodes = source_project['treeIdentity']['nodes']
    for scene_id, node_id in zip(scene_ids, node_ids):
        need(nodes.get(node_id) == {'bindingKey': 'file:' + scene_id,
                                   'kind': 'scene', 'present': True},
             'C4_MULTI_MANIFEST_BINDING')
    source_vectors, reopened_vectors = [], []
    source_hashes, saved_hashes = [], []
    for index, scene_id in enumerate(scene_ids):
        before = raw(f'source-scenes/{index}.txt')
        saved = raw(f'saved-scenes/{index}.txt')
        after = raw(f'reopened-scenes/{index}.txt')
        need(saved == after, 'C4_MULTI_REOPENED_BYTES')
        source_hashes.append(digest(before))
        saved_hashes.append(digest(after))
        before_vector = scene_paragraphs(before)
        after_vector = scene_paragraphs(after)
        need(source['scenes'][index].get('paragraphs') == before_vector
             and reopened['scenes'][index].get('paragraphs') == after_vector,
             'C4_MULTI_SCENE_READBACK')
        source_vectors.append(before_vector)
        reopened_vectors.append(after_vector)
    need(source.get('hashes') == source_hashes
         and apply.get('before') == intake.get('before') == intake.get('after') == source_hashes
         and apply.get('after') == saved_hashes,
         'C4_MULTI_CANONICAL_HASHES')
    expected = [list(values) for values in source_vectors]
    need(expected[0][0].count(SOURCE_TOKEN) == 1,
         'C4_MULTI_AMBIGUOUS_CHANGE')
    expected[0][0] = expected[0][0].replace(SOURCE_TOKEN, REVIEWED_TOKEN)
    need(reopened_vectors == expected
         and source_hashes[0] != saved_hashes[0]
         and source_hashes[1:] == saved_hashes[1:],
         'C4_MULTI_REOPENED_SCENES')
    source_flat = [p for group in source_vectors for p in group]
    returned_flat = [p for group in expected for p in group]
    need(len(source_flat) == len(returned_flat) == 35
         and docx_paragraphs(raw('source.docx'), False) == source_flat
         and docx_paragraphs(raw('returned.docx'), True) == returned_flat,
         'C4_MULTI_RAW_DOCX_VECTOR')
    capsule = export.get('result', {}).get('exportCapsule', {})
    need(export.get('result', {}).get('ok') is True
         and export.get('result', {}).get('commandId')
             == 'cmd.project.review.exportFullManuscriptDocxReviewPacket'
         and capsule.get('scope') == 'full-manuscript'
         and capsule.get('sceneCount') == 3
         and capsule.get('orderedSceneIds') == scene_ids
         and export['result'].get('publicationGate', {}).get('finalArtifactSha256')
             == 'sha256:' + digest(raw('source.docx')),
         'C4_MULTI_EXPORT_BINDING')
    changes = intake.get('result', {}).get('session', {}).get('reviewSurface', {}).get(
        'revisionSession', {}).get('reviewGraph', {}).get('textChanges', [])
    need(intake.get('result', {}).get('activated') is True
         and intake.get('result', {}).get('diagnosticOnly') is False
         and len(changes) == 1
         and changes[0].get('targetScope') == {'type': 'scene', 'id': scene_ids[0]}
         and changes[0].get('match', {}).get('quote') == SOURCE_TOKEN
         and changes[0].get('replacementText') == REVIEWED_TOKEN
         and apply.get('changeId') == changes[0].get('changeId')
         and apply.get('result', {}).get('applied') is True
         and apply.get('result', {}).get('totals') ==
             {'requested': 1, 'applied': 1, 'blocked': 0, 'failed': 0, 'skipped': 0}
         and isinstance(reopened.get('firstPid'), int)
         and isinstance(reopened.get('secondPid'), int)
         and reopened['firstPid'] != reopened['secondPid'],
         'C4_MULTI_EXPLICIT_APPLY')
    receipt = read('office-provider-receipt.json')
    transcript = read('office-ui-transcript.json')
    provider = read('office-provider.json')
    file_id = receipt.get('driveFileId')
    before, after = receipt.get('before', {}), receipt.get('after', {})
    need(receipt.get('runId') == transcript.get('runId') == run
         and receipt.get('cellId') == observation['cellId']
         and receipt.get('productHead') == head
         and receipt.get('productTree') == tree
         and isinstance(file_id, str) and re.fullmatch('[A-Za-z0-9_-]{20,160}', file_id)
         and transcript.get('driveFileId') == file_id
         and before.get('id') == after.get('id') == file_id
         and before.get('mimeType') == after.get('mimeType') == DOCX
         and before.get('revisionId') != after.get('revisionId')
         and all(isinstance(v.get('revisionId'), str) and v['revisionId']
                 for v in (before, after))
         and int(before.get('size', -1)) == len(raw('source.docx'))
         and int(after.get('size', -1)) == len(raw('returned.docx'))
         and receipt.get('sourceDocxSha256') == digest(raw('source.docx'))
         and receipt.get('returnedDocxSha256') == digest(raw('returned.docx'))
         and transcript.get('before') == before and transcript.get('after') == after
         and transcript.get('rawProof', {}).get('returnedDocxSha256')
             == digest(raw('returned.docx'))
         and transcript.get('source') == 'CUA_SAFARI_AND_GOOGLE_DRIVE_CONNECTOR'
         and [step.get('step') for step in transcript.get('steps', [])]
             == ['upload', 'office-format', 'suggestion', 'anchored-comment',
                 'save-and-reopen', 'raw-download']
         and receipt.get('lifecycle') ==
             {'officeModeFormatVisible': True, 'suggestionCreated': True,
              'anchoredCommentCreated': True, 'reopenedSameOfficeFile': True,
              'rawDownload': True, 'nativeConversion': False,
              'postDownloadMutation': False}
         and receipt.get('uiEvidence', {}).get('transcript', {}).get('sha256')
             == digest(raw('office-ui-transcript.json'))
         and provider.get('receiptSha256') == digest(raw('office-provider-receipt.json'))
         and provider.get('mode') == 'GOOGLE_OFFICE_MODE_DOCX_NO_NATIVE_CONVERSION',
         'C4_MULTI_OFFICE_ROUTE')
    result = read('result.json')
    need(result.get('ok') is True and result.get('admissionCredit') == 0
         and result.get('productHead') == head and result.get('profile') == profile,
         'C4_MULTI_LAB_ZERO_CREDIT')
    return {
        'ok': True, 'schemaVersion': 'GOOGLE_OFFICE_C4_MULTI_RAW_READBACK_V1',
        'admissionCredit': 0, 'runId': run, 'productHead': head,
        'productTree': tree, 'observationSha256': digest(raw('observation.json')),
        'sourceDocxSha256': digest(raw('source.docx')),
        'returnedDocxSha256': digest(raw('returned.docx')),
        'providerFileId': file_id, 'filesVerified': len(files),
        'requiredHops': HOPS, 'sceneCount': 3, 'paragraphCount': 35,
        'fieldProofs': [
            {'field': field, 'cellId': f'{field}__MULTI_SCENE__C4__{profile}',
             'runId': run, 'status': 'PASS',
             'sourceParagraphSha256': digest(json.dumps(source_flat, ensure_ascii=False,
                 separators=(',', ':')).encode('utf8')),
             'reviewedParagraphSha256': digest(json.dumps(returned_flat, ensure_ascii=False,
                 separators=(',', ':')).encode('utf8')),
             'sceneIds': scene_ids, 'sourceSceneSha256': source_hashes,
             'reopenedSceneSha256': saved_hashes}
            for field in FIELDS],
    }


def audit(request):
    started = time.perf_counter()
    run, head, tree = request['runId'], request['productHead'], request['productTree']
    need(isinstance(run, str) and all(isinstance(v, str)
         and re.fullmatch('[a-f0-9]{40}', v) for v in (head, tree)),
         'C4_MULTI_REQUEST')
    root = Path(request['root'])
    need(root.is_absolute() and root.resolve() == root and root.is_dir(),
         'C4_MULTI_LAB_ROOT')
    files = bound_files(root, run, request['files'])
    output = verify_core(files, run, head, tree)
    output['seconds'] = time.perf_counter() - started
    return output


if __name__ == '__main__':
    try:
        payload = sys.stdin.buffer.read(1024 * 1024 + 1)
        need(len(payload) <= 1024 * 1024, 'C4_MULTI_REQUEST_SIZE')
        print(json.dumps(audit(strict_json(payload)), ensure_ascii=False))
    except Exception as error:
        print(json.dumps({'ok': False, 'error': str(error), 'admissionCredit': 0}))
        sys.exit(1)

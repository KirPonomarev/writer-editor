#!/usr/bin/env python3
"""Bounded independent ORDER reader. Inputs are data; this module grants no credit.

The literal expectation comes from the immutable, previously physically reviewed
TEXT fixture. Neither the product parser nor a producer-provided expected result
is used. Only execution identities vary between runs of this recipe.
"""
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import re
import stat
import sys
import time
import xml.etree.ElementTree as ET
import zipfile

legacy_path = Path(__file__).with_name('rtk-interop-c1-raw-readback.py')
spec = importlib.util.spec_from_file_location('reviewed_c1_literal', legacy_path)
literal = importlib.util.module_from_spec(spec)
spec.loader.exec_module(literal)
EXPECTED = tuple(literal.EXPECTED)
CELL = 'ORDER__SINGLE_SCENE__C1__SOURCE_RUNTIME'
FIXTURE_DIGEST = '693edfc41dd7963622bb9c5e6ea1a2766ea05245e8e390781e8c64988df278e1'
SUBCASES = ('blockOrderPreserved', 'providerTraversalStable', 'roundTripOrderStable',
            'reorderDetected', 'sortKeysHashBound', 'orderDiffVisible')
W = literal.W
MAX_FILE = 8 * 1024 * 1024
require = literal.require
digest = literal.digest


def stable(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':'), sort_keys=True).encode()


def paragraphs(value, label):
    require(list(value) == list(EXPECTED), label + '_ORDER_OR_CONTENT')


def checked_read(root, binding):
    """Open every component relative to an owned directory FD; no link following."""
    parts = binding['path'].split('/')
    require(parts and all(x and x not in ('.', '..') and '\\' not in x for x in parts), 'RAW_PATH')
    require(type(binding['bytes']) is int and 0 <= binding['bytes'] <= MAX_FILE, 'RAW_SIZE')
    parent = os.open(root, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        for part in parts[:-1]:
            child = os.open(part, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=parent)
            os.close(parent)
            parent = child
        fd = os.open(parts[-1], os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=parent)
        try:
            before = os.fstat(fd)
            require(stat.S_ISREG(before.st_mode) and before.st_nlink == 1, 'RAW_FILE_KIND')
            require(before.st_size == binding['bytes'], 'RAW_SIZE')
            with os.fdopen(fd, 'rb', closefd=False) as stream:
                data = stream.read(binding['bytes'] + 1)
            after = os.fstat(fd)
            require((before.st_dev, before.st_ino, before.st_size, before.st_mtime_ns, before.st_ctime_ns)
                    == (after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns, after.st_ctime_ns), 'RAW_CHANGED')
            require(len(data) == binding['bytes'] and digest(data) == binding['sha256'], 'RAW_HASH')
            return data
        finally:
            os.close(fd)
    finally:
        os.close(parent)


def docx_document(data):
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        names = z.namelist()
        require(0 < len(names) <= 128 and len(names) == len(set(names)), 'DOCX_ENTRIES')
        require(all(not n.startswith('/') and all(p not in ('', '.', '..') for p in n.split('/'))
                    and '\\' not in n for n in names), 'DOCX_PATH')
        require(sum(f.file_size for f in z.infolist()) <= MAX_FILE, 'DOCX_EXPANSION')
        require(all(not f.flag_bits & 1 for f in z.infolist()), 'DOCX_ENCRYPTED')
        require(z.testzip() is None, 'DOCX_CRC')
        xml = z.read('word/document.xml').decode('utf8')
        require('<!DOCTYPE' not in xml.upper() and '<!ENTITY' not in xml.upper(), 'DOCX_DTD')
        doc = ET.fromstring(xml)
        body = doc.find(W + 'body')
        require(doc.tag == W + 'document' and body is not None, 'DOCX_BODY')
        require(all(n.tag in (W+'p', W+'sectPr') for n in body), 'DOCX_UNKNOWN_BODY_STRUCTURE')
        for p in body.findall(W+'p'):
            require(all(n.tag in {W+'pPr', W+'r', W+'proofErr', W+'bookmarkStart', W+'bookmarkEnd'} for n in p), 'DOCX_UNKNOWN_PARAGRAPH_STRUCTURE')
            for run in p.findall(W+'r'):
                require(all(n.tag in {W+'rPr', W+'t'} for n in run), 'DOCX_UNKNOWN_RUN_STRUCTURE')
        return doc


def docx_paragraphs(data):
    return [''.join(n.text or '' for n in p.iter(W+'t')) for p in docx_document(data).find(W+'body').findall(W+'p')]


def replace_document(original, doc):
    out = io.BytesIO()
    with zipfile.ZipFile(io.BytesIO(original)) as src, zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as dst:
        for member in src.infolist():
            dst.writestr(member, ET.tostring(doc, encoding='utf-8') if member.filename == 'word/document.xml' else src.read(member.filename))
    return out.getvalue()


def semantic_controls(source):
    vectors = []
    for i in range(len(EXPECTED)-1):
        v = list(EXPECTED); v[i], v[i+1] = v[i+1], v[i]
        vectors.append(('swap-'+str(i), v))
    vectors += [('delete-'+str(i), list(EXPECTED[:i]+EXPECTED[i+1:])) for i in range(len(EXPECTED))]
    vectors.append(('duplicate', [EXPECTED[0], *EXPECTED]))
    killed = []
    for name, vector in vectors:
        try: paragraphs(vector, 'CONTROL')
        except ValueError as error:
            require(str(error) == 'CONTROL_ORDER_OR_CONTENT', 'CONTROL_WRONG_FAILURE')
            killed.append(name)
        else: raise ValueError('CONTROL_SURVIVED:'+name)
    raw = []
    for name in ('swap', 'delete-empty', 'trim'):
        doc = docx_document(source); body = doc.find(W+'body')
        if name == 'swap':
            first = body[0]; body.remove(first); body.insert(2, first)
        elif name == 'delete-empty': body.remove(body[1])
        else:
            for t in body.iter(W+'t'): t.text = (t.text or '').strip()
        mutated = replace_document(source, doc)
        try: paragraphs(docx_paragraphs(mutated), 'RAW_CONTROL')
        except ValueError as error:
            require(str(error) == 'RAW_CONTROL_ORDER_OR_CONTENT', 'RAW_CONTROL_WRONG_FAILURE')
            raw.append({'id':name, 'sha256':digest(mutated), 'rejected':True})
        else: raise ValueError('RAW_CONTROL_SURVIVED:'+name)
    require(len(killed) == 24 and len(raw) == 3, 'CONTROL_SET')
    return {'orderMutantsExecuted':killed, 'rawMutantsExecuted':raw}


def audit(request):
    started = time.perf_counter()
    run = request['runId']; head = request['productHead']; tree = request['productTree']
    require(re.fullmatch(re.escape(CELL)+r'__[A-Za-z0-9_-]{1,80}', run), 'RUN_ID')
    require(all(re.fullmatch('[a-f0-9]{40}', s) for s in (head, tree)), 'PRODUCT_IDENTITY')
    root = Path(request['root'])
    require(root.is_absolute() and root.resolve() == root and root.is_dir(), 'RAW_ROOT')
    bindings = request['files']; prefix = 'runs/'+run+'/'
    require(0 < len(bindings) <= 128 and len({b['path'] for b in bindings}) == len(bindings), 'RAW_INVENTORY')
    require(all(b['path'].startswith(prefix) for b in bindings), 'RAW_RUN_SCOPE')
    require(sum(b['bytes'] for b in bindings) <= 64*1024*1024, 'RAW_TOTAL_SIZE')
    files = {b['path']:checked_read(root,b) for b in bindings}
    raw = lambda name: files[prefix+name]
    read = lambda name: json.loads(raw(name))
    obs = read('observation.json')
    require(obs['cellId']==CELL and obs['runId']==run and obs['field']=='ORDER'
            and obs['volume']=='SINGLE_SCENE' and obs['route']=='C1' and obs['profile']=='SOURCE_RUNTIME'
            and obs['yalkenShadowHead']==head and obs['yalkenShadowTree']==tree, 'OBS_IDENTITY')
    require(obs['status']=='PASS' and obs['candidateDiagnosticOnly'] is False
            and obs['candidateOverlay']['id']=='baseline' and obs['candidateOverlay']['changed'] is False, 'OBS_DIAGNOSTIC')
    identity=obs['yalkenShadowRuntime']
    require(identity['headBefore']==identity['headAfter']==head and identity['treeBefore']==identity['treeAfter']==tree
            and identity['statusBefore']==identity['statusAfter']=='', 'RUNTIME_CLEAN')
    require(digest(json.dumps(EXPECTED,ensure_ascii=False,separators=(',', ':')).encode())==FIXTURE_DIGEST, 'EXPECTED_LITERAL')
    paragraphs(raw('source.txt').decode('utf8').split('\n\n'), 'SOURCE')
    source, returned = raw('yalken-electron-source-export.docx'), raw('word-returned.docx')
    paragraphs(docx_paragraphs(source), 'EXPORT'); paragraphs(docx_paragraphs(returned), 'RETURN')
    paragraphs(literal.native_paragraphs(raw('word-native-readback.txt')), 'WORD_NATIVE')
    life=read('word-lifecycle.json')
    require(life['runId']==run and life['process']['status']==life['compileProcess']['status']==0, 'WORD_LIFECYCLE')
    lines=life['process']['stdout'].splitlines()
    for key,value in [('WORD_STATUS','PASS'),('DOCUMENTS_BEFORE','0'),('DOCUMENTS_AFTER','0'),('REVISION_COUNT','0'),('COMMENT_COUNT','0'),('SCREENSHOT_STATUS','PASS')]:
        require([s for s in lines if s.startswith(key+'=')]==[key+'='+value], key)
    require(life['cleanupOk'] is True, 'WORD_CLEANUP')
    require(read('provider-identity.json')==obs['provider'], 'PROVIDER_OBSERVATION')
    require(all(obs['provider'][k]==v for k,v in request['qualifiedProvider'].items()), 'PROVIDER_QUALIFICATION')
    require(obs['providerExecution']['executed'] is True and obs['providerExecution']['requested']=='Microsoft Word', 'PROVIDER_EXECUTED')
    for name in ('source-yalken.png','word-after-reopen.png','returned-yalken.png','reopened-yalken.png'):
        require(raw(name).startswith(b'\x89PNG\r\n\x1a\n') and len(raw(name))>100, 'SCREENSHOT_ARTIFACT')
    phases={name:read('electron-'+name+'-phase.json') for name in ('export','import','reopen')}
    for name,p in phases.items():
        require(p['process']['status']==0 and p['ok'] is True and p['final']['ok']==1
                and p['final']['phase']==name+'-final' and read('electron-'+name+'-config.json')['mode']==name, 'PHASE_'+name)
    ex,im,reopen=[phases[k]['final'] for k in ('export','import','reopen')]
    paragraphs(ex['sourceScene']['rendererSourceParagraphs'], 'SOURCE_RENDERER')
    paragraphs(im['importedScene']['rendererReturnedParagraphs'], 'IMPORT_RENDERER')
    scene=raw('runtime-project-snapshot/'+obs['import']['importIdentity']['actualSceneId'])
    paragraphs(scene.decode('utf8').split('\n'), 'PERSISTED')
    require(im['rendererAccept']['clickedConfirm'] is True and im['rendererAccept']['openedByActiveNavigator'] is True, 'COMMAND_ACCEPT')
    require(reopen['reopenScene']['sceneFileText'].encode()==scene and reopen['reopenScene']['sceneFileSha256']==digest(scene)
            and reopen['openResult']['documentId']==im['importIdentity']['canonicalPublicNodeId'], 'FRESH_REOPEN')
    receipt=im['safeCreate']['receipt']
    require(ex['sourceDocx']['sha256']==life['sourceDocxHash']==life['preOpenHash']==digest(source)
            and life['postWordHash']==life['copiedBackHash']==digest(returned)
            and receipt['sourceArtifactSha256']==digest(returned) and receipt['candidateContentSha256']==digest(scene), 'HOP_PROVENANCE')
    require(receipt['manifestAuthority']['durablePublication'] is True
            and receipt['atomicEvidence']=={'sceneCount':1,'markerCleared':True}, 'DURABLE_IMPORT')
    literal.loss(im['importPreview']['docxImportPreviewPlan']['lossReport']); literal.loss(receipt['lossReport'])
    require(receipt['lossReportSummary']['itemCount']==1, 'LOSS_SUMMARY')
    snapshot=read('runtime-project-snapshot.json')
    for b in obs['artifacts']+snapshot['files']:
        require(b['path'].startswith(prefix) and b['path'] in files and len(files[b['path']])==b['bytes']
                and digest(files[b['path']])==b['sha256'], 'ARTIFACT_BINDING')
    coverage=read('subcase-coverage.json')
    require(coverage==obs['subcaseCoverage'] and tuple(coverage['requiredSubcases'])==SUBCASES
            and set(coverage['subcases'])==set(SUBCASES) and all(v=='PASS' for v in coverage['subcases'].values()), 'ORDER_SUBCASES')
    vector=[[i,digest(p.encode())] for i,p in enumerate(EXPECTED)]
    require(coverage['sortKeys']==vector and coverage['sortKeyPolicy']=='PARAGRAPH_ORDINAL_WITH_UTF8_CONTENT_SHA256'
            and coverage['sortKeysSha256']==digest(json.dumps(vector,separators=(',',':')).encode()), 'ORDER_SORT_KEYS')
    controls=semantic_controls(source)
    return {'ok':True,'schemaVersion':'ORDER_C1_RAW_READBACK_V1','admissionCredit':0,'cellId':CELL,'runId':run,
            'productHead':head,'productTree':tree,'semanticParagraphSha256':FIXTURE_DIGEST,
            'observationSha256':digest(raw('observation.json')),'sourceDocxSha256':digest(source),
            'returnedDocxSha256':digest(returned),'persistedSceneSha256':digest(scene),
            'oracles':['SEMANTIC','STRUCTURE','ORDER','LOSS','PROVENANCE','INDEPENDENT_READBACK','CLEANUP'],
            'subcases':list(SUBCASES),'controls':controls,'filesVerified':len(files),'seconds':time.perf_counter()-started}


if __name__=='__main__':
    try:
        data=sys.stdin.buffer.read(1024*1024+1)
        require(len(data)<=1024*1024,'REQUEST_SIZE')
        print(json.dumps(audit(json.loads(data)),ensure_ascii=False))
    except Exception as error:
        print(json.dumps({'ok':False,'error':str(error),'admissionCredit':0}))
        sys.exit(1)

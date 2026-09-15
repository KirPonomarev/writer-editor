#!/usr/bin/env python3
"""Independent, read-only raw C1 oracle. No product/Lab imports or admission credit.

The repository Node entrypoint supplies already trusted file bindings on stdin.
This program reopens every input safely and rechecks bytes before interpretation.
It never runs any executable retained in the evidence package.
"""
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import stat
import sys
import time
import xml.etree.ElementTree as ET
import zipfile

CELL = 'TEXT__SINGLE_SCENE__C1__SOURCE_RUNTIME'
RUN = CELL + '__2026-09-15T20-14-30-759Z'
HEAD = 'f4a7d6541f5fc230f4a7a7f6dc7504eb85a615e9'
TREE = 'bc3cf4b4787d62c5ae8e854be791b9c0c241b681'
EXPECTED = [
    '[plainTextPreserved] Body text sentinel alpha.', '',
    '[latin-basic] Plain ASCII text survives Word and Yalken return.',
    '[latin-diacritic] Café naïve façade coöperate jalapeño résumé.',
    '[cyrillic] Привет мир. Текст сцены сохраняется.',
    '[greek] Καλημέρα κόσμε. Το κείμενο παραμένει.',
    '[cjk] 中文文本保留。日本語の本文も保持。한국어 문장도 유지.',
    '[rtl-hebrew] שלום עולם. טקסט בעברית נשמר.',
    '[emoji-zwj] Family 👨‍👩‍👧‍👦 and technologist 🧑‍💻 stay intact.',
    '  [whitespaceEdgesPreserved] leading and trailing spaces stay here  ', '',
    '[paragraphBoundariesPreserved] Final paragraph after an intentional empty paragraph.',
]
W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
MAX_FILE = 8 * 1024 * 1024


def require(condition, code):
    if not condition:
        raise ValueError(code)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def checked_read(root, binding):
    relative = binding['path']
    parts = PurePosixPath(relative).parts
    require(parts and not relative.startswith('/') and '\\' not in relative
            and all(p not in ('', '.', '..') for p in relative.split('/')), 'RAW_PATH')
    target = root
    for part in parts:
        target = target / part
        require(not target.is_symlink(), 'RAW_SYMLINK')
    require(target.resolve().is_relative_to(root), 'RAW_CONTAINMENT')
    fd = os.open(target, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    try:
        before = os.fstat(fd)
        require(stat.S_ISREG(before.st_mode) and before.st_nlink == 1, 'RAW_FILE_KIND')
        require(0 <= before.st_size == binding['bytes'] <= MAX_FILE, 'RAW_SIZE')
        with os.fdopen(fd, 'rb', closefd=False) as f:
            data = f.read(MAX_FILE + 1)
        after = os.fstat(fd)
        require((before.st_ino, before.st_size, before.st_mtime_ns, before.st_ctime_ns)
                == (after.st_ino, after.st_size, after.st_mtime_ns, after.st_ctime_ns), 'RAW_CHANGED_DURING_READ')
        require(len(data) == binding['bytes'] and digest(data) == binding['sha256'], 'RAW_HASH')
        return data
    finally:
        os.close(fd)


def paragraphs(vector, label):
    require(vector == EXPECTED, label + '_PARAGRAPHS')


def docx_paragraphs(data):
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        names = z.namelist()
        require(0 < len(names) <= 128 and len(names) == len(set(names)), 'DOCX_ENTRIES')
        require(sum(f.file_size for f in z.infolist()) <= MAX_FILE, 'DOCX_EXPANSION')
        require(all(not f.flag_bits & 1 for f in z.infolist()), 'DOCX_ENCRYPTED')
        require(z.testzip() is None, 'DOCX_CRC')
        xml = z.read('word/document.xml')
        require(b'<!DOCTYPE' not in xml.upper() and b'<!ENTITY' not in xml.upper(), 'DOCX_DTD')
        doc = ET.fromstring(xml)
        require(all(not list(doc.iter(W + t)) for t in ['tbl', 'br', 'tab', 'del', 'ins']), 'DOCX_UNTESTED_STRUCTURE')
        body = doc.find(W + 'body')
        require(body is not None, 'DOCX_BODY')
        return [''.join(n.text or '' for n in p.iter(W + 't')) for p in body if p.tag == W + 'p']


def native_paragraphs(data):
    require(data.endswith(b'\r'), 'WORD_NATIVE_TERMINAL_CR')
    return data[:-1].decode('utf8').split('\r')


def lifecycle(record):
    require(record['runId'] == RUN and record['process']['status'] == 0
            and record['compileProcess']['status'] == 0, 'WORD_LIFECYCLE')
    lines = record['process']['stdout'].splitlines()
    for key, value in [('WORD_STATUS', 'PASS'), ('DOCUMENTS_BEFORE', '0'),
                       ('DOCUMENTS_AFTER', '0'), ('REVISION_COUNT', '0'),
                       ('COMMENT_COUNT', '0'), ('SCREENSHOT_STATUS', 'PASS')]:
        require([line for line in lines if line.startswith(key + '=')] == [key + '=' + value], key)
    require(record['cleanupOk'] is True, 'WORD_STAGING_CLEANUP')


def loss(report):
    require(report['schemaVersion'] == 'revision-bridge.docx-import-preview.loss-report.v1'
            and report['mode'] == 'plain-text-only' and report['itemCount'] == 1
            and len(report['items']) == 1, 'LOSS_REPORT_SHAPE')
    item = report['items'][0]
    require(item['code'] == 'DOCX_IMPORT_PREVIEW_PLAIN_TEXT_ONLY'
            and item['severity'] == 'info' and item['category'] == 'formatting', 'LOSS_UNACCOUNTED')


def audit(request):
    started = time.perf_counter()
    root = Path(request['root'])
    require(root.is_absolute() and root.resolve() == root and root.is_dir(), 'PACKAGE_ROOT')
    bindings = request['files']
    require(0 < len(bindings) <= 128 and len({b['path'] for b in bindings}) == len(bindings), 'PACKAGE_FILES')
    require(sum(b['bytes'] for b in bindings) <= 64 * 1024 * 1024, 'PACKAGE_SIZE')
    files = {b['path']: checked_read(root, b) for b in bindings}
    prefix = 'runs/' + RUN + '/'
    raw = lambda name: files[prefix + name]
    read = lambda name: json.loads(raw(name))
    obs = read('observation.json')
    require(obs['cellId'] == CELL and obs['runId'] == RUN and obs['route'] == 'C1'
            and obs['profile'] == 'SOURCE_RUNTIME' and obs['yalkenShadowHead'] == HEAD
            and obs['yalkenShadowTree'] == TREE, 'OBS_IDENTITY')
    identity = obs['yalkenShadowRuntime']
    require(identity['headBefore'] == identity['headAfter'] == HEAD
            and identity['treeBefore'] == identity['treeAfter'] == TREE
            and identity['statusBefore'] == identity['statusAfter'] == '', 'PHYSICAL_RUNTIME_CLEAN')
    paragraphs(raw('source.txt').decode('utf8').split('\n\n'), 'SOURCE')
    source, returned = raw('yalken-electron-source-export.docx'), raw('word-returned.docx')
    paragraphs(docx_paragraphs(source), 'EXPORT_DOCX')
    paragraphs(docx_paragraphs(returned), 'RETURN_DOCX')
    paragraphs(native_paragraphs(raw('word-native-readback.txt')), 'WORD_NATIVE')
    life = read('word-lifecycle.json')
    lifecycle(life)
    provider = read('provider-identity.json')
    require(provider == obs['provider'] and provider['wordVersion'] == '16.112'
            and provider['wordBuild'] == '16.112.26081010' and provider['macosVersion'] == '26.6.1'
            and provider['macosBuild'] == '25G76' and provider['locale'] == 'ru_FI', 'PROVIDER_IDENTITY')
    phases = {name: read('electron-' + name + '-phase.json') for name in ['export', 'import', 'reopen']}
    for name, phase in phases.items():
        require(phase['process']['status'] == 0 and phase['ok'] is True
                and phase['final']['ok'] == 1 and phase['final']['phase'] == name + '-final'
                and read('electron-' + name + '-config.json')['mode'] == name, 'PHASE_' + name)
    ex, im, re = [phases[name]['final'] for name in ['export', 'import', 'reopen']]
    paragraphs(ex['sourceScene']['rendererSourceParagraphs'], 'SOURCE_RENDERER')
    paragraphs(im['importedScene']['rendererReturnedParagraphs'], 'IMPORTED_RENDERER')
    scene = raw('runtime-project-snapshot/' + obs['import']['importIdentity']['actualSceneId'])
    paragraphs(scene.decode('utf8').split('\n'), 'PERSISTED_SCENE')
    require(im['rendererAccept']['clickedConfirm'] is True
            and im['rendererAccept']['openedByActiveNavigator'] is True, 'COMMAND_ACCEPTANCE')
    require(re['reopenScene']['sceneFileText'].encode() == scene
            and re['reopenScene']['sceneFileSha256'] == digest(scene)
            and re['openResult']['documentId'] == im['importIdentity']['canonicalPublicNodeId'], 'FRESH_PROCESS_REOPEN')
    receipt = im['safeCreate']['receipt']
    require(ex['sourceDocx']['sha256'] == life['sourceDocxHash'] == life['preOpenHash'] == digest(source)
            and life['postWordHash'] == life['copiedBackHash'] == digest(returned)
            and receipt['sourceArtifactSha256'] == digest(returned)
            and receipt['candidateContentSha256'] == digest(scene), 'HOP_PROVENANCE')
    require(receipt['manifestAuthority']['durablePublication'] is True
            and receipt['atomicEvidence'] == {'sceneCount': 1, 'markerCleared': True}, 'DURABLE_IMPORT')
    loss(im['importPreview']['docxImportPreviewPlan']['lossReport'])
    loss(receipt['lossReport'])
    require(receipt['lossReportSummary']['itemCount'] == 1, 'LOSS_SUMMARY')
    snapshot = read('runtime-project-snapshot.json')
    for b in obs['artifacts'] + snapshot['files']:
        require(b['path'].startswith(prefix) and b['path'] in files
                and len(files[b['path']]) == b['bytes'] and digest(files[b['path']]) == b['sha256'], 'OBS_ARTIFACT_BINDING')
    review = json.loads(files['review/independent-review/supervisor-review-receipt-e63b9a82.json'])
    require(review['cellId'] == CELL and review['runId'] == RUN
            and review['yalkenShadowHead'] == HEAD and review['yalkenShadowTree'] == TREE
            and review['reviewerIdentity'] == 'root/c1_independent_review'
            and review['decision'] == review['physicalEvidence'] == 'PASS'
            and review['observationArtifactHash'] == obs['artifactHash'], 'INDEPENDENT_REVIEW')
    return {'ok': True, 'schemaVersion': 'C1_RAW_READBACK_V1', 'admissionCredit': 0,
            'runId': RUN, 'productHead': HEAD, 'productTree': TREE,
            'oracles': ['SEMANTIC', 'STRUCTURE', 'ORDER', 'LOSS', 'PROVENANCE', 'INDEPENDENT_READBACK', 'CLEANUP'],
            'semanticParagraphSha256': digest(json.dumps(EXPECTED, ensure_ascii=False, separators=(',', ':')).encode()),
            'sourceDocxSha256': digest(source), 'returnedDocxSha256': digest(returned),
            'persistedSceneSha256': digest(scene), 'filesVerified': len(files),
            'seconds': time.perf_counter() - started}


if __name__ == '__main__':
    try:
        print(json.dumps(audit(json.loads(sys.stdin.read(1024 * 1024)))))
    except Exception as error:
        print(json.dumps({'ok': False, 'error': str(error), 'admissionCredit': 0}))
        sys.exit(1)

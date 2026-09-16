#!/usr/bin/env python3
"""Independent TEXT facts for the reviewed shared C1 fixture; no admission."""
import copy
import importlib.util
import json
from pathlib import Path
import re
import sys
import time

spec = importlib.util.spec_from_file_location(
    'frozen_order_raw', Path(__file__).with_name('rtk-interop-order-c1-readback.py'))
order = importlib.util.module_from_spec(spec)
spec.loader.exec_module(order)
EXPECTED = order.EXPECTED
CELL = 'TEXT__SINGLE_SCENE__C1__SOURCE_RUNTIME'
SUBCASES = ('bodyTextReadbackIndependent', 'emptyParagraphsAccounted',
            'lineBreakPolicyDeclared', 'paragraphBoundariesPreserved',
            'plainTextPreserved', 'whitespaceEdgesPreserved')
CONTROL_IDS = ('content-replacement', 'leading-space', 'trailing-space',
               'nbsp-substitution', 'unicode-nfd', 'zwj-deletion',
               'empty-paragraph-deletion', 'embedded-line-break',
               'cyrillic-deletion', 'cjk-insertion')
require = order.require


def text_paragraphs(values, label):
    require(isinstance(values, (list, tuple)) and all(isinstance(x, str) for x in values),
            'TEXT_' + label + '_SHAPE')
    require(all('\r' not in p and '\n' not in p for p in values),
            'TEXT_' + label + '_LINE_BREAK_POLICY')
    require(list(values) == list(EXPECTED), 'TEXT_' + label + '_CODEPOINTS_OR_BOUNDARIES')


def text_controls(source):
    """Calibrate this field directly on real ZIP/XML bytes, without producer flags."""
    text_paragraphs(order.docx_paragraphs(source), 'POSITIVE')
    doc = order.docx_document(source)
    paragraph = doc.find(order.W + 'body').find(order.W + 'p')
    run = paragraph.find(order.W + 'r')
    nodes = run.findall(order.W + 't')
    require(len(nodes) == 1 and len(nodes[0].text or '') > 1, 'TEXT_SPLIT_CONTROL_SOURCE')
    second = copy.deepcopy(run)
    value = nodes[0].text
    cut = len(value) // 2
    nodes[0].text = value[:cut]
    second.find(order.W + 't').text = value[cut:]
    paragraph.insert(list(paragraph).index(run) + 1, second)
    split = order.replace_document(source, doc)
    require(split != source, 'TEXT_SPLIT_CONTROL_UNCHANGED')
    text_paragraphs(order.docx_paragraphs(split), 'SPLIT_POSITIVE')
    killed = []
    for name in CONTROL_IDS:
        doc = order.docx_document(source)
        body = doc.find(order.W + 'body')
        if name == 'empty-paragraph-deletion':
            empty = next(p for p in body.findall(order.W + 'p')
                         if not ''.join(t.text or '' for t in p.iter(order.W + 't')))
            body.remove(empty)
        else:
            changed = False
            for text in body.iter(order.W + 't'):
                value = text.text or ''
                new = value
                if name == 'content-replacement' and 'alpha.' in value:
                    new = value.replace('alpha.', 'omega.', 1)
                elif name == 'leading-space' and value.startswith(' '):
                    new = value[1:]
                elif name == 'trailing-space' and value.endswith(' '):
                    new = value[:-1]
                elif name == 'nbsp-substitution' and value.startswith(' '):
                    new = '\u00a0' + value[1:]
                elif name == 'unicode-nfd' and 'Café' in value:
                    new = value.replace('Café', 'Cafe\u0301', 1)
                elif name == 'zwj-deletion' and '\u200d' in value:
                    new = value.replace('\u200d', '', 1)
                elif name == 'embedded-line-break' and 'alpha.' in value:
                    new = value.replace('alpha.', 'alpha.\n', 1)
                elif name == 'cyrillic-deletion' and 'Привет' in value:
                    new = value.replace('Привет', 'ривет', 1)
                elif name == 'cjk-insertion' and '中文' in value:
                    new = value.replace('中文', '中X文', 1)
                if new != value:
                    text.text = new
                    changed = True
                    break
            require(changed, 'TEXT_CONTROL_NOT_APPLICABLE:' + name)
        mutated = order.replace_document(source, doc)
        require(mutated != source, 'TEXT_CONTROL_UNCHANGED:' + name)
        expected_error = ('TEXT_CONTROL_LINE_BREAK_POLICY' if name == 'embedded-line-break'
                          else 'TEXT_CONTROL_CODEPOINTS_OR_BOUNDARIES')
        try:
            text_paragraphs(order.docx_paragraphs(mutated), 'CONTROL')
        except ValueError as error:
            require(str(error) == expected_error, 'TEXT_CONTROL_WRONG_FAILURE:' + name)
            killed.append({'id': name, 'sha256': order.digest(mutated),
                           'rejected': True, 'failure': str(error)})
        else:
            raise ValueError('TEXT_CONTROL_SURVIVED:' + name)
    return {'positiveControls': ['identity', 'split-xml-runs'],
            'rawMutantsExecuted': killed}


def audit(request):
    started = time.perf_counter()
    run, head, tree = (request[k] for k in ('runId', 'productHead', 'productTree'))
    require(re.fullmatch(re.escape(order.CELL) + r'__[A-Za-z0-9_-]{1,80}', run),
            'TEXT_SOURCE_RUN')
    require(all(re.fullmatch('[a-f0-9]{40}', x) for x in (head, tree)), 'TEXT_IDENTITY')
    root = Path(request['root'])
    require(root.is_absolute() and root.resolve() == root and root.is_dir(), 'TEXT_ROOT')
    bindings, prefix = request['files'], 'runs/' + run + '/'
    require(0 < len(bindings) <= 128 and len({b['path'] for b in bindings}) == len(bindings),
            'TEXT_INVENTORY')
    require(all(b['path'].startswith(prefix) for b in bindings)
            and sum(b['bytes'] for b in bindings) <= 64 * 1024 * 1024, 'TEXT_INVENTORY_SCOPE')
    files = {b['path']: order.checked_read(root, b) for b in bindings}
    raw = lambda name: files[prefix + name]
    read = lambda name: json.loads(raw(name))
    obs = read('observation.json')
    require(obs['cellId'] == order.CELL and obs['runId'] == run
            and obs['yalkenShadowHead'] == head and obs['yalkenShadowTree'] == tree,
            'TEXT_OBSERVATION_BINDING')
    require(order.digest(json.dumps(EXPECTED, ensure_ascii=False, separators=(',', ':')).encode())
            == order.FIXTURE_DIGEST, 'TEXT_FIXED_EXPECTATION')
    source = raw('yalken-electron-source-export.docx')
    returned = raw('word-returned.docx')
    im = read('electron-import-phase.json')['final']
    scene = raw('runtime-project-snapshot/' + obs['import']['importIdentity']['actualSceneId'])
    reopen = read('electron-reopen-phase.json')['final']['reopenScene']
    stages = {
        'source': raw('source.txt').decode('utf8').split('\n\n'),
        'export-docx': order.docx_paragraphs(source),
        'word-native': order.literal.native_paragraphs(raw('word-native-readback.txt')),
        'returned-docx': order.docx_paragraphs(returned),
        'source-renderer': read('electron-export-phase.json')['final']['sourceScene']['rendererSourceParagraphs'],
        'import-renderer': im['importedScene']['rendererReturnedParagraphs'],
        'persisted': scene.decode('utf8').split('\n'),
        'reopened': reopen['sceneFileText'].split('\n'),
    }
    for stage, paragraphs in stages.items():
        text_paragraphs(paragraphs, stage.upper())
    require(raw('source.txt') == '\n\n'.join(EXPECTED).encode()
            and scene == '\n'.join(EXPECTED).encode()
            and reopen['sceneFileSha256'] == order.digest(scene), 'TEXT_SERIALIZATION_POLICY')
    empty = [i for i, p in enumerate(EXPECTED) if p == '']
    edges = [i for i, p in enumerate(EXPECTED) if p and p != p.strip()]
    require(len(empty) == 2 and len(edges) == 1 and all(
        any(marker in p for p in EXPECTED)
        for marker in ('[latin-basic]', '[latin-diacritic]', '[cyrillic]', '[greek]',
                       '[cjk]', '[rtl-hebrew]', '[emoji-zwj]')), 'TEXT_NONVACUOUS_FIXTURE')
    controls = text_controls(source)
    for b in bindings:
        require(order.checked_read(root, b) == files[b['path']], 'TEXT_CHANGED_DURING_READ')
    return {
        'ok': True, 'schemaVersion': 'TEXT_C1_RAW_READBACK_V1', 'admissionCredit': 0,
        'cellId': CELL, 'sourceCellId': order.CELL, 'runId': run,
        'productHead': head, 'productTree': tree,
        'fixtureParagraphSha256': order.FIXTURE_DIGEST,
        'observationSha256': order.digest(raw('observation.json')),
        'sourceDocxSha256': order.digest(source), 'returnedDocxSha256': order.digest(returned),
        'persistedSceneSha256': order.digest(scene),
        'subcases': list(SUBCASES), 'controls': controls,
        'presence': {'paragraphs': len(EXPECTED), 'emptyParagraphOrdinals': empty,
                     'whitespaceEdgeOrdinals': edges, 'localeProfiles': 7},
        'lineBreakPolicy': 'NO_EMBEDDED_BREAKS;SOURCE_DOUBLE_LF;PERSISTED_SINGLE_LF;WORD_NATIVE_CR',
        'stageParagraphSha256': {
            stage: order.digest(json.dumps(values, ensure_ascii=False, separators=(',', ':')).encode())
            for stage, values in stages.items()},
        'filesVerified': len(files), 'seconds': time.perf_counter() - started,
    }


if __name__ == '__main__':
    try:
        data = sys.stdin.buffer.read(1024 * 1024 + 1)
        require(len(data) <= 1024 * 1024, 'TEXT_REQUEST_SIZE')
        print(json.dumps(audit(json.loads(data)), ensure_ascii=False))
    except Exception as error:
        print(json.dumps({'ok': False, 'error': str(error), 'admissionCredit': 0}))
        sys.exit(1)

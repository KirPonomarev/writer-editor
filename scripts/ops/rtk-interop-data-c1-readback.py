#!/usr/bin/env python3
"""One bounded independent read for data-driven TEXT/ORDER C1. No admission.

Expected paragraphs are immutable authored INPUT, never derived from returned
bytes. The only supported transformation is exact paragraph preservation.
"""
import copy
import importlib.util
import json
from pathlib import Path
import re
import sys
import time
spec=importlib.util.spec_from_file_location('frozen_order_primitives',Path(__file__).with_name('rtk-interop-order-c1-readback.py'))
order=importlib.util.module_from_spec(spec);spec.loader.exec_module(order)
literal=order.literal
require=order.require;digest=order.digest;checked_read=order.checked_read
W=order.W;docx_document=order.docx_document;docx_paragraphs=order.docx_paragraphs;replace_document=order.replace_document
CELL=order.CELL;SUBCASES=order.SUBCASES
TEXT_SUBCASES=('bodyTextReadbackIndependent','emptyParagraphsAccounted','lineBreakPolicyDeclared','paragraphBoundariesPreserved','plainTextPreserved','whitespaceEdgesPreserved')
CONTROL_IDS=('content-replacement','leading-space','trailing-space','nbsp-substitution','unicode-nfd','zwj-deletion','empty-paragraph-deletion','embedded-line-break','cyrillic-deletion','cjk-insertion')
MARKERS=('latin-basic','latin-diacritic','cyrillic','greek','cjk','rtl-hebrew','emoji-zwj')

def validate_case(case):
    require(type(case) is dict and set(case)=={'schemaVersion','id','paragraphs'},'CASE_FIELDS')
    require(case['schemaVersion']=='YALKEN_C1_PARAGRAPH_CASE_V1' and type(case['id']) is str and re.fullmatch('[a-z][a-z0-9-]{0,63}',case['id']),'CASE_ID')
    values=case['paragraphs']
    require(type(values) is list and 12<=len(values)<=64 and all(type(p) is str for p in values),'CASE_PARAGRAPHS')
    require(sum(len(p.encode('utf8')) for p in values)<=65536,'CASE_BYTES')
    require(all(not re.search('[\x00-\x1f\x7f-\x9f\ud800-\udfff\ufffe\uffff]',p) for p in values),'CASE_CODEPOINTS')
    require(bool(values[0]) and bool(values[-1]) and all(a!=b for a,b in zip(values,values[1:])),'CASE_BOUNDARIES')
    require(sum(p=='' for p in values)>=2 and any('[whitespaceEdgesPreserved]' in p and p.startswith(' ') and p.endswith(' ') for p in values),'CASE_PRESENCE')
    for marker in MARKERS:
        require(sum(('['+marker+']') in p for p in values)==1,'CASE_LOCALE_'+marker)
    for token in ('alpha.','Café','Привет','中文','\u200d','Καλημέρα','שלום'):
        require(any(token in p for p in values),'CASE_CONTROL_PRESENCE')
    return values

def compare_paragraphs(expected,actual,label):
    require(type(actual) in (list,tuple) and all(type(p) is str for p in actual),label+'_SHAPE')
    if list(actual)!=list(expected):
        first=next(i for i in range(max(len(expected),len(actual))) if (expected[i] if i<len(expected) else None)!=(actual[i] if i<len(actual) else None))
        raise ValueError(label+'_ORDER_OR_CONTENT:'+json.dumps({'firstParagraph':first,'expected':expected[first] if first<len(expected) else None,'actual':actual[first] if first<len(actual) else None},ensure_ascii=False))

def split_text_run(source):
    """XML run boundaries may change without changing authored text."""
    doc = docx_document(source)
    for paragraph in doc.find(W+'body').findall(W+'p'):
        for run in paragraph.findall(W+'r'):
            nodes = run.findall(W+'t')
            if len(nodes) != 1 or len(nodes[0].text or '') < 2:
                continue
            second = copy.deepcopy(run)
            value = nodes[0].text
            cut = len(value) // 2
            nodes[0].text = value[:cut]
            second.find(W+'t').text = value[cut:]
            paragraph.insert(list(paragraph).index(run)+1, second)
            result = replace_document(source, doc)
            require(result != source, 'TEXT_SPLIT_CONTROL_UNCHANGED')
            return result
    raise ValueError('TEXT_SPLIT_CONTROL_SOURCE')

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
    case_bytes=raw('case-input.json')
    case=json.loads(case_bytes)
    expected=tuple(validate_case(case))
    fixture_digest=digest(json.dumps(expected,ensure_ascii=False,separators=(',',':')).encode())
    require(case['id']==request['caseId'] and digest(case_bytes)==request['caseSha256'], 'CASE_INPUT_PIN')
    def paragraphs(values,label):
        compare_paragraphs(expected, values, label)
    def text_paragraphs(values,label):
        require(all('\r' not in p and '\n' not in p for p in values),'TEXT_'+label+'_LINE_BREAK_POLICY')
        require(list(values)==list(expected),'TEXT_'+label+'_CODEPOINTS_OR_BOUNDARIES')
    def semantic_controls(source):
        vectors = []
        for i in range(len(expected)-1):
            v = list(expected); v[i], v[i+1] = v[i+1], v[i]
            vectors.append(('swap-'+str(i), v))
        vectors += [('delete-'+str(i), list(expected[:i]+expected[i+1:])) for i in range(len(expected))]
        vectors.append(('duplicate', [expected[0], *expected]))
        killed = []
        for name, vector in vectors:
            try: paragraphs(vector, 'CONTROL')
            except ValueError as error:
                require(str(error).startswith('CONTROL_ORDER_OR_CONTENT:'), 'CONTROL_WRONG_FAILURE')
                killed.append(name)
            else: raise ValueError('CONTROL_SURVIVED:'+name)
        raw = []
        for name in ('swap', 'delete-empty', 'trim'):
            doc = docx_document(source); body = doc.find(W+'body')
            if name == 'swap':
                first = body[0]; body.remove(first); body.insert(2, first)
            elif name == 'delete-empty':
                body.remove(next(p for p in body.findall(W+'p') if not ''.join(t.text or '' for t in p.iter(W+'t'))))
            else:
                for t in body.iter(W+'t'): t.text = (t.text or '').strip()
            mutated = replace_document(source, doc)
            try: paragraphs(docx_paragraphs(mutated), 'RAW_CONTROL')
            except ValueError as error:
                require(str(error).startswith('RAW_CONTROL_ORDER_OR_CONTENT:'), 'RAW_CONTROL_WRONG_FAILURE')
                raw.append({'id':name, 'sha256':digest(mutated), 'rejected':True})
            else: raise ValueError('RAW_CONTROL_SURVIVED:'+name)
        require(len(killed) == 2*len(expected) and len(raw) == 3, 'CONTROL_SET')
        return {'orderMutantsExecuted':killed, 'rawMutantsExecuted':raw}


    def text_controls(source):
        """Calibrate this field directly on real ZIP/XML bytes, without producer flags."""
        text_paragraphs(order.docx_paragraphs(source), 'POSITIVE')
        split = split_text_run(source)
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

    obs = read('observation.json')
    require(obs['cellId']==CELL and obs['runId']==run and obs['field']=='ORDER'
            and obs['volume']=='SINGLE_SCENE' and obs['route']=='C1' and obs['profile']=='SOURCE_RUNTIME'
            and obs['yalkenShadowHead']==head and obs['yalkenShadowTree']==tree, 'OBS_IDENTITY')
    require(obs['status']=='PASS' and obs['candidateDiagnosticOnly'] is False
            and obs['candidateOverlay']['id']=='baseline' and obs['candidateOverlay']['changed'] is False, 'OBS_DIAGNOSTIC')
    identity=obs['yalkenShadowRuntime']
    require(identity['headBefore']==identity['headAfter']==head and identity['treeBefore']==identity['treeAfter']==tree
            and identity['statusBefore']==identity['statusAfter']=='', 'RUNTIME_CLEAN')
    require(digest(json.dumps(expected,ensure_ascii=False,separators=(',', ':')).encode())==fixture_digest, 'expected_LITERAL')
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
    vector=[[i,digest(p.encode())] for i,p in enumerate(expected)]
    require(coverage['sortKeys']==vector and coverage['sortKeyPolicy']=='PARAGRAPH_ORDINAL_WITH_UTF8_CONTENT_SHA256'
            and coverage['sortKeysSha256']==digest(json.dumps(vector,separators=(',',':')).encode()), 'ORDER_SORT_KEYS')
    controls=semantic_controls(source)
    text_checks=text_controls(source)
    paragraphs(reopen['reopenScene']['sceneFileText'].split('\n'),'REOPENED')
    for b in bindings: require(checked_read(root,b)==files[b['path']], 'RAW_CHANGED_AFTER_CHECK')
    return {'ok':True,'schemaVersion':'DATA_C1_RAW_READBACK_V1','admissionCredit':0,'cellId':CELL,'runId':run,
            'productHead':head,'productTree':tree,'semanticParagraphSha256':fixture_digest,
            'observationSha256':digest(raw('observation.json')),'sourceDocxSha256':digest(source),
            'returnedDocxSha256':digest(returned),'persistedSceneSha256':digest(scene),
            'oracles':['SEMANTIC','STRUCTURE','ORDER','LOSS','PROVENANCE','INDEPENDENT_READBACK','CLEANUP'],
            'caseId':case['id'],'caseSha256':digest(case_bytes),'paragraphCount':len(expected),'textSubcases':list(TEXT_SUBCASES),'textControls':text_checks,'subcases':list(SUBCASES),'controls':controls,'filesVerified':len(files),'seconds':time.perf_counter()-started}

if __name__=='__main__':
    try:
        data=sys.stdin.buffer.read(1024*1024+1);require(len(data)<=1024*1024,'REQUEST_SIZE')
        if sys.argv[1:]==['--check-input']:
            case=json.loads(data);validate_case(case);print(json.dumps({'ok':True,'admissionCredit':0,'caseId':case['id']}))
        else:
            require(not sys.argv[1:],'RAW_ARGUMENTS');print(json.dumps(audit(json.loads(data)),ensure_ascii=False))
    except Exception as error:
        print(json.dumps({'ok':False,'error':str(error),'admissionCredit':0},ensure_ascii=False));sys.exit(1)

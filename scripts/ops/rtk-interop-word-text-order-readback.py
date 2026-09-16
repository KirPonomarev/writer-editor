#!/usr/bin/env python3
"""Read-only, zero-credit evidence reader for four native Word journeys.

The immutable paragraph oracle and calibrated readers are reused. No product
parser, producer PASS, caller expectation, or receipt alone proves preservation.
"""
import importlib.util
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


order = load('word_batch_order', 'rtk-interop-order-c1-readback.py')
text = load('word_batch_text', 'rtk-interop-text-c1-readback.py')
c2 = load('word_batch_c2', 'rtk-interop-c2-final-hops.py')
require, digest, W = order.require, order.digest, order.W
EXPECTED, REVIEWED = tuple(order.EXPECTED), tuple(c2.REVIEWED)
ORACLES = ['SEMANTIC', 'STRUCTURE', 'ORDER', 'LOSS', 'PROVENANCE', 'INDEPENDENT_READBACK', 'CLEANUP']
PROFILES = ('SOURCE_RUNTIME', 'PACKAGED_BUILD_RUNTIME')
HOPS = {
    'C1': ['YALKEN_EXPORT', 'WORD_LIFECYCLE', 'YALKEN_RETURN_INTAKE'],
    'C2': ['YALKEN_EXPORT', 'WORD_LIFECYCLE', 'YALKEN_RETURN_INTAKE',
           'YALKEN_APPLY', 'YALKEN_REEXPORT', 'WORD_REOPEN_READBACK'],
}


def exact(values, expected, label):
    require(isinstance(values, (tuple, list)) and all(isinstance(p, str) for p in values), label + '_SHAPE')
    require(not any('\r' in p or '\n' in p for p in values), label + '_LINE_BREAK')
    require(list(values) == list(expected), label + '_CODEPOINTS_OR_ORDER')


def tracked_docx(data):
    """Only the observed plain paragraph + native ins/del review grammar."""
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        names = z.namelist()
        require(0 < len(names) <= 128 and len(set(names)) == len(names), 'TRACKED_ZIP_ENTRIES')
        require(all(not n.startswith('/') and '\\' not in n and all(p not in ('', '.', '..') for p in n.split('/')) for n in names), 'TRACKED_ZIP_PATH')
        require(sum(f.file_size for f in z.infolist()) <= order.MAX_FILE and all(not f.flag_bits & 1 for f in z.infolist()), 'TRACKED_ZIP_BOUNDS')
        require(z.testzip() is None, 'TRACKED_ZIP_CRC')
        xml = z.read('word/document.xml')
        require(b'<!DOCTYPE' not in xml.upper() and b'<!ENTITY' not in xml.upper(), 'TRACKED_DTD')
        doc = ET.fromstring(xml)
        body = doc.find(W+'body')
        require(doc.tag == W+'document' and body is not None and all(n.tag in (W+'p', W+'sectPr') for n in body), 'TRACKED_BODY')
        for p in body.findall(W+'p'):
            require(all(n.tag in {W+'r', W+'ins', W+'del', W+'bookmarkStart', W+'bookmarkEnd'} for n in p), 'TRACKED_PARAGRAPH_GRAMMAR')
            for revision in [*p.findall(W+'ins'), *p.findall(W+'del')]:
                require(all(n.tag == W+'r' for n in revision), 'TRACKED_REVISION_GRAMMAR')
            for run in p.iter(W+'r'):
                require(all(n.tag in (W+'t', W+'delText') for n in run), 'TRACKED_RUN_GRAMMAR')
        return [c2._visible(p) for p in body.findall(W+'p')], doc


def audit(request):
    started = time.perf_counter()
    root = Path(request['root'])
    require(root.is_absolute() and root.resolve() == root and root.is_dir(), 'BATCH_RAW_ROOT')
    run, head, tree = (request[k] for k in ('runId', 'productHead', 'productTree'))
    match = re.fullmatch(r'ORDER__SINGLE_SCENE__(C[12])__(SOURCE_RUNTIME|PACKAGED_BUILD_RUNTIME)__[A-Za-z0-9_-]{1,80}', run)
    require(match is not None and all(re.fullmatch('[a-f0-9]{40}', s) for s in (head, tree)), 'BATCH_IDENTITY')
    route, profile = match.groups()
    prefix = 'runs/'+run+'/'
    bindings = request['files']
    require(0 < len(bindings) <= 128 and len({b['path'] for b in bindings}) == len(bindings), 'BATCH_RAW_INVENTORY')
    require(all(b['path'].startswith(prefix) for b in bindings) and sum(b['bytes'] for b in bindings) <= 64*1024*1024, 'BATCH_RAW_SCOPE')
    files = {b['path']: order.checked_read(root, b) for b in bindings}
    raw = lambda name: files[prefix+name]
    read = lambda name: json.loads(raw(name))
    obs = read('observation.json')
    require(obs['runId'] == run and obs['cellId'] == run.rsplit('__', 1)[0]
            and (obs['field'], obs['volume'], obs['route'], obs['profile']) == ('ORDER', 'SINGLE_SCENE', route, profile)
            and (obs['yalkenShadowHead'], obs['yalkenShadowTree']) == (head, tree), 'BATCH_OBSERVATION_IDENTITY')
    diagnostic = request.get('diagnosticOnly') is True
    require(obs['status'] == 'PASS' and (diagnostic or obs['candidateDiagnosticOnly'] is False)
            and obs['candidateOverlay']['id'] == 'baseline' and obs['candidateOverlay']['changed'] is False, 'BATCH_DIAGNOSTIC')
    identity = obs['yalkenShadowRuntime']
    require(identity['headBefore'] == identity['headAfter'] == head and identity['treeBefore'] == identity['treeAfter'] == tree
            and identity['statusBefore'] == identity['statusAfter'] == '', 'BATCH_RUNTIME_CLEAN')
    snapshot = read('runtime-project-snapshot.json')
    kinds = {a['kind']: a for a in obs['artifacts']}
    require(len(kinds) == len(obs['artifacts']), 'BATCH_DUPLICATE_KIND')
    for b in [*obs['artifacts'], *snapshot['files']]:
        require(b['path'] in files and len(files[b['path']]) == b['bytes'] and digest(files[b['path']]) == b['sha256'], 'BATCH_ARTIFACT_BINDING')
    artifact = lambda kind: files[kinds[kind]['path']]
    provider = read('provider-identity.json')
    require(provider == obs['provider'] and all(provider[k] == v for k,v in request['qualifiedProvider'].items()), 'BATCH_PROVIDER')
    require(obs['providerExecution']['executed'] is True and obs['providerExecution']['requested'] == 'Microsoft Word', 'BATCH_PROVIDER_EXECUTED')
    for kind in ('source-yalken-screenshot', 'word-after-reopen-screenshot', 'returned-yalken-screenshot', 'reopened-yalken-screenshot'):
        b = artifact(kind)
        require(b.startswith(b'\x89PNG\r\n\x1a\n') and len(b) > 100, 'BATCH_SCREENSHOT')
    build = read('runtime-build.json')
    cp, tc = build['runtimeAppCopyProof'], build['toolchain']
    require(build['shadowHead'] == head and build['shadowTree'] == tree and build['build']['status'] == 0, 'BATCH_BUILD')
    require(cp['ok'] is True and cp['sourceFileCount'] == cp['copyFileCount'] > 0 and cp['sourceDigest'] == cp['copyDigest']
            and re.fullmatch('[a-f0-9]{64}', cp['sourceDigest']) and cp['failures'] == [], 'BATCH_RUNTIME_COPY')
    require(tc['compatibleWithShadowManifests'] is True
            and tc['shadowPackageJsonSha256'] == tc['dependencyPackageJsonSha256'] == request['packageJsonSha256']
            and tc['shadowPackageLockSha256'] == tc['dependencyPackageLockSha256'] == request['packageLockSha256']
            and tc['electronPackageVersion'] == request['electronVersion'], 'BATCH_TOOLCHAIN')
    if profile == 'PACKAGED_BUILD_RUNTIME':
        pkg = obs['packagedBuildEvidence']
        require(pkg['cellId'] == obs['cellId'] and pkg['runId'] == run and pkg['profile'] == profile
                and pkg['shadowHead'] == head and pkg['shadowTree'] == tree, 'BATCH_PACKAGE_IDENTITY')
        require(all(pkg.get(k) is True for k in ('built', 'executed', 'freshProcessReopen', 'packageRuntimeCleaned'))
                and build['packagedBuild']['build']['status'] == 0 and pkg['proof'] == build['packagedBuild']['proof'], 'BATCH_PACKAGE_LIFECYCLE')
        require(pkg['proof']['ok'] is True and pkg['proof']['failures'] == [], 'BATCH_PACKAGE_PROOF')
        for key, suffix in [('executableProof', '/Contents/MacOS/Yalken'), ('appAsarProof', '/Contents/Resources/app.asar'), ('infoPlistProof', '/Contents/Info.plist')]:
            p = pkg['proof'][key]
            require(p['exists'] is True and p['bytes'] > 0 and re.fullmatch('[a-f0-9]{64}', p['sha256']) and p['path'].endswith(suffix), 'BATCH_PACKAGE_ARTIFACT')
        require(pkg['proof']['executableProof']['sha256'] == tc['electronBinarySha256'], 'BATCH_PACKAGE_EXECUTABLE')
        require(pkg['phases'] and all(v['ok'] is True and v['runtimeKind'] == pkg['runtimeKind'] for v in pkg['phases'].values()), 'BATCH_PACKAGE_PHASES')
    else:
        require(build['packagedBuild'] is None and obs.get('packagedBuildEvidence') is None, 'BATCH_SOURCE_PROFILE')

    source, returned = artifact('source-docx'), artifact('returned-docx')
    stages = {}
    def stage(name, values, reviewed=False):
        expected = REVIEWED if reviewed else EXPECTED
        exact(values, expected, name)
        stages[name] = {'paragraphSha256': digest(order.stable(list(values))),
                        'sortKeysSha256': digest(order.stable([[i, digest(p.encode())] for i,p in enumerate(values)])),
                        'reviewed': reviewed}
    require(EXPECTED == c2.EXPECTED, 'BATCH_INDEPENDENT_ORACLE_AGREEMENT')
    stage('source', artifact('source-text').decode('utf8').split('\n\n' if route == 'C1' else '\n'))
    stage('export-docx', order.docx_paragraphs(source))
    life = read('word-lifecycle.json')
    require(life['process']['status'] == life['compileProcess']['status'] == 0 and life['cleanupOk'] is True, 'BATCH_WORD_LIFECYCLE')
    require(life['sourceDocxHash'] == life['preOpenHash'] == digest(source)
            and life['postWordHash'] == life['copiedBackHash'] == digest(returned), 'BATCH_WORD_HASH_CHAIN')
    stdout = life['process']['stdout'].splitlines()
    for k,v in [('WORD_STATUS','PASS'), ('REVISION_COUNT','0' if route == 'C1' else '2'), ('COMMENT_COUNT','0')]:
        require([s for s in stdout if s.startswith(k+'=')] == [k+'='+v], 'BATCH_WORD_'+k)

    if route == 'C1':
        for k in ('DOCUMENTS_BEFORE','DOCUMENTS_AFTER'):
            require([s for s in stdout if s.startswith(k+'=')] == [k+'=0'], 'BATCH_WORD_DOCUMENTS')
        stage('word-native', order.literal.native_paragraphs(raw('word-native-readback.txt')))
        stage('returned-docx', order.docx_paragraphs(returned))
        phases = [read('electron-'+name+'-phase.json') for name in ('export','import','reopen')]
        for name,p in zip(('export','import','reopen'),phases):
            require(p['process']['status'] == 0 and p['ok'] is True and p['final']['ok'] == 1
                    and p['final']['phase'] == name+'-final' and read('electron-'+name+'-config.json')['mode'] == name, 'BATCH_C1_PHASE')
        ex, im, reopen = [p['final'] for p in phases]
        stage('source-renderer', ex['sourceScene']['rendererSourceParagraphs'])
        stage('import-renderer', im['importedScene']['rendererReturnedParagraphs'])
        scene = raw('runtime-project-snapshot/'+im['importIdentity']['actualSceneId'])
        stage('persisted', scene.decode('utf8').split('\n'))
        require(reopen['reopenScene']['sceneFileText'].encode() == scene
                and reopen['reopenScene']['sceneFileSha256'] == digest(scene)
                and reopen['openResult']['documentId'] == im['importIdentity']['canonicalPublicNodeId'], 'BATCH_C1_FRESH_REOPEN')
        stage('reopened', reopen['reopenScene']['sceneFileText'].split('\n'))
        accept = im['rendererAccept']
        if profile == 'SOURCE_RUNTIME':
            require(accept['clickedConfirm'] is True and accept['openedByActiveNavigator'] is True, 'BATCH_C1_COMMAND_ACCEPT')
        else:
            require(accept['directSafeCreateBridge'] is True and accept['dialogRouteUsed'] is False
                    and accept['openCommandDocumentId'] == im['importIdentity']['canonicalPublicNodeId']
                    and im['safeCreate']['commandId'] == 'cmd.project.docx.importSafeCreate' and im['safeCreate']['commandOk'] is True, 'BATCH_C1_PACKAGED_COMMAND')
        receipt = im['safeCreate']['receipt']
        require(ex['sourceDocx']['sha256'] == digest(source) and receipt['sourceArtifactSha256'] == digest(returned)
                and receipt['candidateContentSha256'] == digest(scene), 'BATCH_C1_HOP_PROVENANCE')
        require(receipt['manifestAuthority']['durablePublication'] is True and receipt['atomicEvidence'] == {'sceneCount':1,'markerCleared':True}, 'BATCH_C1_DURABLE')
        order.literal.loss(im['importPreview']['docxImportPreviewPlan']['lossReport'])
        order.literal.loss(receipt['lossReport'])
        require(receipt['lossReportSummary']['itemCount'] == 1, 'BATCH_C1_LOSS_SUMMARY')
        final_hops = None
    else:
        visible, doc = tracked_docx(returned)
        stage('returned-docx', visible, True)
        require([''.join(n.itertext()) for n in doc.iter(W+'delText')] == ['sentinel alpha']
                and [''.join(t.text or '' for t in n.iter(W+'t')) for n in doc.iter(W+'ins')] == ['sentinel omega']
                and len(list(doc.iter(W+'del'))) == 1, 'BATCH_C2_NATIVE_TRACKED_EDIT')
        ex, intake, applied, reopen = [read(n+'.json') for n in ('source-review-export-phase','review-return-intake','review-apply-receipt','source-review-reopen-phase')]
        baseline = digest(artifact('source-text'))
        require(ex['sceneHashBeforeExport'] == ex['sceneHashAfterExport'] == baseline and ex['noMutationDuringExport'] is True, 'BATCH_C2_EXPORT_READ_ONLY')
        stage('source-renderer', ex['sourceAuthoringPrecondition']['rendererParagraphs'])
        require(intake['commandId'] == 'cmd.project.review.activateDocxReviewPreviewSession' and intake['activation']['ok'] is True
                and intake['beforeIntakeSceneHash'] == intake['afterIntakeSceneHash'] == baseline
                and intake['noMutationDuringIntake'] is True and intake['writerCalled'] is False
                and intake['rendererAuthority'] is False and intake['authenticated'] is True and intake['prepared'] is True, 'BATCH_C2_READ_ONLY_INTAKE')
        authority = intake['activation']['returnIntake']
        require(authority['returnedArtifactSha256'] == 'sha256:'+digest(returned)
                and authority['sceneId'] == ex['sceneId'] and authority['authenticated'] is True
                and all(authority['authority'].get(k) is True for k in ('validSignedLocator','sceneRevisionUnchanged','rawSha256Unchanged','baselineBound')),
                'BATCH_C2_RETURN_AUTHORITY')
        require(applied['commandId'] == 'cmd.project.review.applyExactTextChangesBatch' and applied['requestedChangeCount'] == 1
                and applied['changeId'] == intake['selectedChange']['changeId'] and applied['beforeApplySceneHash'] == baseline
                and applied['applyResult']['applied'] is True and applied['applyResult']['result']['writerCalled'] is True
                and applied['applyResult']['editorSync']['ok'] is True and applied['saveResult']['ok'] is True
                and applied['mutationOnlyAfterExplicitApply'] is True, 'BATCH_C2_EXPLICIT_APPLY')
        stage('applied-renderer', applied['rendererAppliedParagraphs'], True)
        scene = raw('runtime-project-snapshot/'+ex['sceneId'])
        require(applied['savedReadback']['sceneFileText'].encode() == scene, 'BATCH_C2_SAVED_BYTES')
        stage('persisted', c2._scene_paragraphs(scene), True)
        stage('reopened-renderer', reopen['rendererParagraphs'], True)
        stage('reexport-docx', order.docx_paragraphs(artifact('canonical-c2-reexport-docx')), True)
        stage('final-word-docx', order.docx_paragraphs(artifact('canonical-c2-final-word-docx')), True)
        stage('final-word-native', order.literal.native_paragraphs(artifact('canonical-c2-final-word-native-text')), True)
        loss = read('loss-report.json')
        require(loss['ok'] is True and loss['itemCount'] == 0 and loss['items'] == [], 'BATCH_C2_TEXT_LOSS')
        final_hops = c2.check_c2_final_hops(root, root/prefix, obs, kinds, EXPECTED,
                    root/prefix/'runtime-project-snapshot'/ex['sceneId'], allow_candidate=diagnostic)
        require(final_hops['ok'] is True, 'BATCH_C2_FINAL_HOPS:'+str(final_hops['findings']))

    coverage = read('subcase-coverage.json')
    vector = [[i,digest(p.encode())] for i,p in enumerate(EXPECTED)]
    require(coverage == obs['subcaseCoverage'] and coverage['sortKeys'] == vector
            and coverage['sortKeysSha256'] == digest(order.stable(vector)), 'BATCH_ORDER_SORT_BINDING')
    controls = {'TEXT': text.text_controls(source), 'ORDER': order.semantic_controls(source)}
    field_proofs = []
    for field, subcases in [('TEXT', text.SUBCASES), ('ORDER', order.SUBCASES)]:
        field_proofs.append({'field':field, 'cellId':f'{field}__SINGLE_SCENE__{route}__{profile}',
            'runId':run, 'status':'PASS', 'outcome':'EXACT_OBSERVED_PARAGRAPH_PRESERVATION',
            'subcases':list(subcases), 'requiredHops':HOPS[route], 'stageProofs':stages,
            'controls':controls[field], 'oracles':ORACLES})
    # Re-read through the same no-follow FD chain after every secondary reader.
    require(all(order.checked_read(root,b) == files[b['path']] for b in bindings), 'BATCH_CHANGED_DURING_READ')
    return {'ok':True, 'schemaVersion':'WORD_TEXT_ORDER_RAW_READBACK_V1', 'admissionCredit':0,
            'runId':run, 'productHead':head, 'productTree':tree, 'observationSha256':digest(raw('observation.json')),
            'filesVerified':len(files), 'fieldProofs':field_proofs, 'finalHops':final_hops,
            'seconds':time.perf_counter()-started}


if __name__ == '__main__':
    try:
        data = sys.stdin.buffer.read(1024*1024+1)
        require(len(data) <= 1024*1024, 'BATCH_REQUEST_SIZE')
        print(json.dumps(audit(json.loads(data)), ensure_ascii=False))
    except Exception as error:
        print(json.dumps({'ok':False, 'admissionCredit':0, 'error':str(error)}))
        sys.exit(1)

#!/usr/bin/env python3
"""Independent full-body oracle. Producer outputs never supply expected text."""
import hashlib, io, json, os, re, stat, sys, zipfile, time, copy
from pathlib import Path
from xml.etree import ElementTree as ET
W='{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
PROBES=(
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
)
VOCABULARY=('keeper','signal','harbor','granite','lantern','weather','channel','compass','tide','copper','window','vessel','north','patient','archive','steady','returns','before','dawn','safely')
VOLUMES={'MULTI_SCENE':0,'FULL_SYNTHETIC_NOVEL':100000,'LARGE_DOCUMENT':500000}
def require(ok,code):
    if not ok: raise ValueError(code)
def digest(data): return hashlib.sha256(data).hexdigest()
def canonical(value): return json.dumps(value,ensure_ascii=False,separators=(',',':'),sort_keys=True).encode()
def expected_scenes(volume,reviewed=False):
    require(volume in VOLUMES,'VOLUME_ID')
    count=VOLUMES[volume]
    if not count: scenes=[list(PROBES[i*4:i*4+4]) for i in range(3)]
    else:
        scenes=[]
        for i in range(21):
            size=count//21+(1 if i<count%21 else 0)
            words=[f'L{i+1:02d}W{n+1:06d}' if n%17==0 else VOCABULARY[(i*7+n)%20] for n in range(size)]
            paragraphs=[]
            for start in range(0,size,120):
                if paragraphs: paragraphs.append('')
                paragraphs.append(' '.join(words[start:start+120])+'.')
            scenes.append((list(PROBES) if i==0 else [])+[f'[scene-start-{i+1:02d}]']+paragraphs+[f'[scene-end-{i+1:02d}]'])
    if reviewed: scenes[0][0]=scenes[0][0].replace('sentinel alpha','sentinel omega')
    return scenes
def expected_paragraphs(volume,reviewed=False):return [p for s in expected_scenes(volume,reviewed) for p in s]
def exact(actual,expected,stage):
    require(isinstance(actual,list) and all(isinstance(p,str) for p in actual),stage+'_SHAPE')
    require(actual==expected,stage+'_TEXT_OR_ORDER_MISMATCH')
    return {'paragraphCount':len(actual),'paragraphSha256':digest(canonical(actual))}
def read_regular(root,relative,maximum=16*1024*1024):
    require(isinstance(relative,str) and relative and not relative.startswith('/') and '\\' not in relative,'FILE_PATH')
    pieces=relative.split('/');require(all(x not in ('','.','..') for x in pieces),'FILE_PATH')
    target=root.joinpath(*pieces)
    require(target.resolve()==target and root.resolve()==root and target.is_relative_to(root),'FILE_ESCAPE')
    with os.fdopen(os.open(target,os.O_RDONLY|os.O_NOFOLLOW),'rb') as f:
        before=os.fstat(f.fileno());require(stat.S_ISREG(before.st_mode) and before.st_size<=maximum,'FILE_BOUND')
        data=f.read(maximum+1);after=os.fstat(f.fileno())
    final=os.stat(target,follow_symlinks=False)
    key=lambda s:(s.st_dev,s.st_ino,s.st_size,s.st_mtime_ns,s.st_ctime_ns)
    require(key(before)==key(after)==key(final) and len(data)==before.st_size,'FILE_CHANGED')
    return data
def visible(node):
    if node.tag==W+'del':return ''
    if node.tag==W+'t':return node.text or ''
    if node.tag in (W+'tab',W+'br',W+'cr'):raise ValueError('UNDECLARED_INLINE_BREAK')
    return ''.join(visible(c) for c in node)
def docx(data,tracked=False):
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        entries=z.infolist();names=[x.filename for x in entries]
        require(0<len(entries)<=128 and len(names)==len(set(names)),'ZIP_ENTRIES')
        require(all(not n.startswith('/') and '\\' not in n and all(x not in ('','.','..') for x in n.split('/')) for n in names),'ZIP_PATH')
        require(all(x.file_size<=10*1024*1024 and not x.flag_bits&1 for x in entries) and sum(x.file_size for x in entries)<=50*1024*1024,'ZIP_BOUND')
        parts={n:z.read(n) for n in names}
    for n,b in parts.items():
        if n.endswith(('.xml','.rels')):
            require(b'<!DOCTYPE' not in b.upper() and b'<!ENTITY' not in b.upper(),'XML_DTD')
        if n.endswith('.rels'):
            rels=ET.fromstring(b)
            require(all(c.attrib.get('TargetMode','Internal')!='External' for c in rels),'EXTERNAL_RELATIONSHIP')
    document=ET.fromstring(parts['word/document.xml']);body=document.find(W+'body')
    require(document.tag==W+'document' and body is not None and all(c.tag in (W+'p',W+'sectPr') for c in body),'DOCUMENT_SHAPE')
    forbidden={'tbl','drawing','pict','object','fldSimple','instrText','altChunk','moveFrom','moveTo','footnoteReference','endnoteReference'}
    require(not any(n.tag==W+t for n in body.iter() for t in forbidden),'DOCUMENT_UNSUPPORTED')
    for p in body.findall(W+'p'):
        require(all(c.tag in {W+'pPr',W+'r',W+'ins',W+'del',W+'bookmarkStart',W+'bookmarkEnd',W+'proofErr'} for c in p),'PARAGRAPH_GRAMMAR')
        for revision in [*p.findall(W+'ins'),*p.findall(W+'del')]:require(all(c.tag==W+'r' for c in revision),'REVISION_GRAMMAR')
        for r in p.iter(W+'r'):
            require(all(c.tag in {W+'rPr',W+'t',W+'delText',W+'lastRenderedPageBreak'} for c in r),'RUN_GRAMMAR')
            require(all(not list(c) for c in r if c.tag in {W+'t',W+'delText'}),'TEXT_LEAF_GRAMMAR')
            # ISO/IEC 29500: cached pagination position; no authored character.
            require(all(not list(c) and not c.attrib and not c.text for c in r if c.tag==W+'lastRenderedPageBreak'),'RENDERED_PAGE_MARKER_GRAMMAR')
    inserts=document.findall('.//'+W+'ins');deletes=document.findall('.//'+W+'del')
    if tracked:
        require(len(inserts)==len(deletes)==1,'EXACT_TRACKED_REPLACEMENT')
        require(''.join(n.text or '' for n in inserts[0].iter(W+'t'))=='sentinel omega','TRACKED_INSERT')
        require(''.join(n.text or '' for n in deletes[0].iter(W+'delText'))=='sentinel alpha','TRACKED_DELETE')
    else:require(not inserts and not deletes,'UNEXPECTED_TRACKED_EDIT')
    return [visible(p) for p in body.findall(W+'p')],parts

def scene(data):
    s=data.decode('utf8')
    if s.startswith('[meta]\n'):
        meta=re.match(r'^\[meta\]\nstatus: [^\n]*\ntags: [^\n]*\nsynopsis: [^\n]*\n\[/meta\]\n\n',s)
        require(meta is not None,'SCENE_META');s=s[meta.end():]
    m=re.match(r'^\[doc-v2 length=(\d+)\]\n',s)
    require(m is not None,'SCENE_ENVELOPE')
    payload=s[m.end():].rstrip('\n')
    require(len(payload.encode('utf-16-le'))//2==int(m.group(1)),'SCENE_LENGTH')
    doc=json.loads(payload);require(doc.get('type')=='doc' and isinstance(doc.get('content'),list),'SCENE_DOC')
    result=[]
    for p in doc['content']:
        require(p.get('type')=='paragraph' and isinstance(p.get('content',[]),list),'SCENE_BLOCK')
        require(all(n.get('type')=='text' and isinstance(n.get('text'),str) for n in p.get('content',[])),'SCENE_INLINE')
        result.append(''.join(n['text'] for n in p.get('content',[])))
    return result

def diagnostic(root,volume):
    require(root.is_absolute() and root.resolve()==root,'ROOT')
    result={}
    for filename,reviewed,tracked in [('source.docx',False,False),('returned.docx',True,True),('reexport.docx',True,False),('final-word.docx',True,False)]:
        data=read_regular(root,filename);ps,_=docx(data,tracked)
        result[filename]={**exact(ps,expected_paragraphs(volume,reviewed),filename),'sha256':digest(data)}
    native=read_regular(root,'word-native-readback.txt').decode('utf8');require(native.endswith('\r') and '\n' not in native,'WORD_NATIVE_TERMINATOR')
    result['native']=exact(native[:-1].split('\r'),expected_paragraphs(volume,True),'NATIVE')
    return {'ok':True,'diagnosticOnly':True,'admissionCredit':0,'volume':volume,'stageProofs':result}

HOPS={'C1':['YALKEN_EXPORT','WORD_LIFECYCLE','YALKEN_RETURN_INTAKE'],'C2':['YALKEN_EXPORT','WORD_LIFECYCLE','YALKEN_RETURN_INTAKE','YALKEN_APPLY','YALKEN_REEXPORT','WORD_REOPEN_READBACK']}
ORACLES=['SEMANTIC','STRUCTURE','ORDER','LOSS','PROVENANCE','INDEPENDENT_READBACK','CLEANUP']
TEXT_SUBCASES=['bodyTextReadbackIndependent','emptyParagraphsAccounted','lineBreakPolicyDeclared','paragraphBoundariesPreserved','plainTextPreserved','whitespaceEdgesPreserved']
ORDER_SUBCASES=['blockOrderPreserved','providerTraversalStable','roundTripOrderStable','reorderDetected','sortKeysHashBound','orderDiffVisible']
CONTROLS=['swap-paragraphs','delete-empty','trim-spaces','corrupt-unicode','drop-final-paragraph','duplicate-paragraph','swap-scenes','truncate-half','corrupt-last-scene']
MAX_FILE=32*1024*1024

def checked_read(root,binding):
    pieces=binding['path'].split('/')
    require(all(x and x not in ('.','..') and '\\' not in x for x in pieces),'RAW_PATH')
    require(type(binding['bytes']) is int and 0<=binding['bytes']<=MAX_FILE,'RAW_SIZE')
    require(re.fullmatch('[a-f0-9]{64}',binding['sha256']) is not None,'RAW_SHA')
    parent=os.open(root,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW)
    try:
        for part in pieces[:-1]:
            child=os.open(part,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW,dir_fd=parent);os.close(parent);parent=child
        fd=os.open(pieces[-1],os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK,dir_fd=parent)
        try:
            before=os.fstat(fd);require(stat.S_ISREG(before.st_mode) and before.st_nlink==1 and before.st_size==binding['bytes'],'RAW_KIND_SIZE')
            with os.fdopen(fd,'rb',closefd=False) as stream:data=stream.read(binding['bytes']+1)
            after=os.fstat(fd);final=os.stat(pieces[-1],dir_fd=parent,follow_symlinks=False)
            key=lambda x:(x.st_dev,x.st_ino,x.st_size,x.st_mtime_ns,x.st_ctime_ns)
            require(key(before)==key(after)==key(final),'RAW_CHANGED')
            require(len(data)==binding['bytes'] and digest(data)==binding['sha256'],'RAW_HASH')
            return data
        finally:os.close(fd)
    finally:os.close(parent)

def native(data):
    require(data.endswith(b'\r') and b'\n' not in data,'NATIVE_PARAGRAPH_TERMINATOR')
    # Word exposes a section break as form feed in the native text stream.
    # It is a boundary between paragraphs, not authored paragraph content.
    return data[:-1].decode('utf8').replace('\f','\r').split('\r')

def rewrite(original,document):
    out=io.BytesIO()
    with zipfile.ZipFile(io.BytesIO(original)) as src,zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as dst:
        for n in src.namelist():dst.writestr(n,ET.tostring(document,encoding='utf-8') if n=='word/document.xml' else src.read(n))
    return out.getvalue()

def controls(source,volume):
    expected=expected_paragraphs(volume);_,parts=docx(source);template=ET.fromstring(parts['word/document.xml'])
    exact(docx(source)[0],expected,'CONTROL_IDENTITY')
    d=copy.deepcopy(template);t=next(n for n in d.iter(W+'t') if len(n.text or '')>5);text=t.text;t.text=text[:5]
    # Splitting one text run is a legal positive transform; content and spaces remain literal.
    for r in d.iter(W+'r'):
        if t in list(r):r.insert(list(r).index(t)+1,ET.Element(W+'t'));r[list(r).index(t)+1].text=text[5:];break
    exact(docx(rewrite(source,d))[0],expected,'CONTROL_SPLIT_RUN')
    results=[]
    for control in CONTROLS:
        d=copy.deepcopy(template);b=d.find(W+'body');ps=b.findall(W+'p')
        if control=='swap-paragraphs':b.remove(ps[0]);b.insert(1,ps[0])
        elif control=='delete-empty':b.remove(next(p for p in ps if visible(p)==''))
        elif control=='trim-spaces':
            for t in d.iter(W+'t'):
                if 'whitespaceEdgesPreserved' in (t.text or ''):t.text=t.text.strip()
        elif control=='corrupt-unicode':
            for t in d.iter(W+'t'):
                if 'Café' in (t.text or ''):t.text=t.text.replace('Café','Cafe')
        elif control=='drop-final-paragraph':b.remove(ps[-1])
        elif control=='duplicate-paragraph':b.insert(len(ps)-1,copy.deepcopy(ps[-1]))
        elif control=='swap-scenes':
            count=len(expected_scenes(volume)[0]);first=ps[:count]
            for p in first:b.remove(p)
            for i,p in enumerate(first):b.insert(len(ps)-count+i,p)
        elif control=='truncate-half':
            for p in ps[len(ps)//2:]:b.remove(p)
        elif control=='corrupt-last-scene':next(t for t in ps[-1].iter(W+'t')).text+='x'
        raw=rewrite(source,d);rejected=False
        try:exact(docx(raw)[0],expected,'CONTROL_'+control)
        except ValueError:rejected=True
        require(rejected,'CONTROL_FALSE_GREEN_'+control);results.append({'id':control,'rejected':True,'sha256':digest(raw)})
    return {'positiveControls':['identity','split-xml-runs'],'rawMutantsExecuted':results}

def audit(request):
    started=time.perf_counter();root=Path(request['root']);require(root.is_absolute() and root.resolve()==root and root.is_dir(),'VOLUME_RAW_ROOT')
    run=request['runId'];m=re.fullmatch(r'ORDER__(MULTI_SCENE|FULL_SYNTHETIC_NOVEL|LARGE_DOCUMENT)__(C[12])__(SOURCE_RUNTIME|PACKAGED_BUILD_RUNTIME)__[A-Za-z0-9_-]{1,80}',run)
    require(m is not None,'VOLUME_RUN_ID');volume,route,profile=m.groups();head,tree=request['productHead'],request['productTree']
    require(all(re.fullmatch('[a-f0-9]{40}',s) for s in (head,tree)),'VOLUME_HEAD_TREE')
    prefix='runs/'+run+'/';bindings=request['files']
    require(isinstance(bindings,list) and 0<len(bindings)<=512 and len({b['path'] for b in bindings})==len(bindings),'VOLUME_INVENTORY')
    require(all(b['path'].startswith(prefix) for b in bindings) and sum(b['bytes'] for b in bindings)<=128*1024*1024,'VOLUME_INVENTORY_BOUND')
    files={b['path']:checked_read(root,b) for b in bindings};raw=lambda name:files[prefix+name];read=lambda name:json.loads(raw(name))
    obs=read('observation.json');require((obs['runId'],obs['cellId'],obs['field'],obs['volume'],obs['route'],obs['profile'])==(run,run.rsplit('__',1)[0],'ORDER',volume,route,profile),'VOLUME_OBSERVATION')
    require(obs['volumeProofVersion']=='WORD_VOLUME_NATIVE_V1' and obs['status']=='PASS' and (request.get('diagnosticOnly') is True or obs['candidateDiagnosticOnly'] is False),'VOLUME_CANDIDATE')
    require(obs['candidateOverlay']=={'id':'baseline','changed':False} and (obs['yalkenShadowHead'],obs['yalkenShadowTree'])==(head,tree),'VOLUME_ACTUAL_SOURCE')
    rt=obs['yalkenShadowRuntime'];require(rt['headBefore']==rt['headAfter']==head and rt['treeBefore']==rt['treeAfter']==tree and rt['statusBefore']==rt['statusAfter']=='','VOLUME_CLEAN_RUNTIME')
    snap=read('runtime-project-snapshot.json');descriptors=obs['artifacts']+snap['files']
    require(len({b['path'] for b in descriptors})==len(descriptors) and set(files)=={b['path'] for b in descriptors}|{prefix+'observation.json'},'VOLUME_EXACT_FILES')
    for b in descriptors:require(len(files[b['path']])==b['bytes'] and digest(files[b['path']])==b['sha256'],'VOLUME_DESCRIPTOR')
    provider=read('provider-identity.json');require(provider==obs['provider'] and all(provider.get(k)==v for k,v in request['qualifiedProvider'].items()),'VOLUME_PROVIDER')
    require(obs['providerExecution']=={'requested':'Microsoft Word','executed':True},'VOLUME_PROVIDER_EXECUTION')
    build=read('runtime-build.json');cp,tc=build['runtimeAppCopyProof'],build['toolchain']
    require((build['shadowHead'],build['shadowTree'])==(head,tree) and build['build']['status']==0,'VOLUME_BUILD')
    require(cp['ok'] is True and cp['sourceFileCount']==cp['copyFileCount']>0 and cp['sourceDigest']==cp['copyDigest'] and re.fullmatch('[a-f0-9]{64}',cp['sourceDigest']) and cp['failures']==[],'VOLUME_COPY')
    require(tc['compatibleWithShadowManifests'] is True and tc['shadowPackageJsonSha256']==tc['dependencyPackageJsonSha256']==request['packageJsonSha256'] and tc['shadowPackageLockSha256']==tc['dependencyPackageLockSha256']==request['packageLockSha256'] and tc['electronPackageVersion']==request['electronVersion'],'VOLUME_TOOLCHAIN')
    if profile=='PACKAGED_BUILD_RUNTIME':
        pkg=build['packagedBuild'];proof=pkg['proof'];require(pkg['built'] is True and pkg['build']['status']==0 and proof['ok'] is True and proof['failures']==[],'VOLUME_PACKAGED_BUILD')
        for key,suffix in [('executableProof','/Contents/MacOS/Yalken'),('appAsarProof','/Contents/Resources/app.asar'),('infoPlistProof','/Contents/Info.plist')]:
            p=proof[key];require(p['exists'] is True and p['bytes']>0 and re.fullmatch('[a-f0-9]{64}',p['sha256']) and p['path'].endswith(suffix),'VOLUME_PACKAGE_ARTIFACT')
        require(proof['executableProof']['sha256']==tc['electronBinarySha256'],'VOLUME_PACKAGE_EXECUTABLE')
    else:require(build['packagedBuild'] is None,'VOLUME_SOURCE_PROFILE')
    stages={}
    def stage(name,ps,reviewed=False):
        stages[name]={**exact(ps,expected_paragraphs(volume,reviewed),name),'sortKeysSha256':digest(canonical([[i,digest(p.encode())] for i,p in enumerate(ps)])),'reviewed':reviewed}
    src=read('source-scenes.json');expected=expected_scenes(volume);require(len(src)==len(expected),'VOLUME_SCENE_COUNT')
    ids=[s['sceneId'] for s in src];nodes=[s['nodeId'] for s in src]
    require(ids==[f'roman/{i+1:02d}_volume-{i+1:02d}.txt' for i in range(len(src))] and len(set(nodes))==len(src) and all(nodes),'VOLUME_SCENE_ID_ORDER')
    src_raw=[];source_renderer=[]
    for i,(s,ps) in enumerate(zip(src,expected)):
        b=files[s['sourceFile']];require(s['sourceFile']==prefix+f'source-scenes/{i}.txt' and digest(b)==s['sha256'],'VOLUME_SOURCE_SCENE_BINDING')
        exact(scene(b),ps,'SOURCE_SCENE');exact(s['renderer'],ps,'SOURCE_RENDERER');require(s['open']['ok'] is True and s['open']['documentId']==s['nodeId'],'VOLUME_SOURCE_OPEN')
        src_raw.extend(scene(b));source_renderer.extend(s['renderer'])
    stage('source',src_raw);stage('source-renderer',source_renderer)
    def export(name,filename,reviewed):
        ex=read(name+'.json');result=ex['result'];capsule=result['exportCapsule'];b=raw(filename)
        require(ex['before']==ex['after'] and len(ex['before'])==len(src),'VOLUME_EXPORT_NO_WRITE')
        if not reviewed:require(ex['before']==[s['sha256'] for s in src],'VOLUME_EXPORT_SOURCE_HASHES')
        require(result['ok'] is True and result['commandId']=='cmd.project.review.exportFullManuscriptDocxReviewPacket' and result['exported'] is True and result['bytesWritten']==len(b) and ex['artifactSha256']==digest(b),'VOLUME_CANONICAL_EXPORT')
        require(capsule['projectId']==read('source-project.json')['projectId'] and capsule['scope']=='full-manuscript' and capsule['orderedSceneIds']==ids and capsule['sceneCount']==len(src) and capsule['blockCount']==len(expected_paragraphs(volume)),'VOLUME_EXPORT_IDENTITY')
        require(result['publicationGate']['finalArtifactSha256']=='sha256:'+digest(b) and result['publicationGate']['ok'] is True and result['canAutoApply'] is False and result['canImportMutate'] is False,'VOLUME_EXPORT_PUBLICATION')
        stage('reexport-docx' if reviewed else 'export-docx',docx(b)[0],reviewed);return capsule
    capsule=export('export','source.docx',False)
    def word(lifecycle,source,returned,directory,reviewed,tracked):
        life=read(lifecycle+'.json');require(life['status']=='PASS' and life['process']['status']==life['compileProcess']['status']==0 and life['cleanupOk'] is True,'VOLUME_WORD_PROCESS')
        require(life['sourceDocxHash']==life['preOpenHash']==digest(raw(source)) and life['postWordHash']==life['copiedBackHash']==digest(raw(returned)),'VOLUME_WORD_HASH_CHAIN')
        lines=life['process']['stdout'].splitlines()
        for k,v in [('WORD_STATUS','PASS'),('DOCUMENTS_BEFORE','0'),('DOCUMENTS_AFTER','0'),('REVISION_COUNT','2' if tracked else '0'),('COMMENT_COUNT','0'),('SCREENSHOT_STATUS','PASS')]:require([s for s in lines if s.startswith(k+'=')]==[k+'='+v],'VOLUME_WORD_'+k)
        require(life['screenshotProof']['ok'] is True and raw(directory+'/word.png').startswith(b'\x89PNG\r\n\x1a\n'),'VOLUME_WORD_SCREENSHOT')
        require(life['nativeReadbackPath'].endswith('/'+run+'/'+directory+'/word-native-readback.txt') and life['evidencePath'].endswith('/'+run+'/'+returned),'VOLUME_WORD_RAW_BINDING')
        stage('final-word-native' if directory=='final-word' else 'word-native',native(raw(directory+'/word-native-readback.txt')),reviewed)
        stage('final-word-docx' if directory=='final-word' else 'returned-docx',docx(raw(returned),tracked)[0],reviewed)
    word('word-lifecycle','source.docx','returned.docx','word',route=='C2',route=='C2')
    reopened=read('reopen-scenes.json');require(reopened['firstPid']==read('boot.json')['pid'] and read('boot.json')['profile']==profile and reopened['pid']!=reopened['firstPid'],'VOLUME_FRESH_PROCESS')
    if route=='C2':
        intake=read('intake.json');r=intake['result'];authority=r['returnIntake'];require(intake['before']==intake['after']==[s['sha256'] for s in src] and r['commandId']=='cmd.project.review.activateDocxReviewPreviewSession' and r['ok'] is True,'VOLUME_READONLY_INTAKE')
        require(authority['authenticated'] is True and authority['returnedArtifactSha256']=='sha256:'+digest(raw('returned.docx')) and authority['roundId']==capsule['roundId'] and authority['exportId']==capsule['exportId'] and all(authority['authority'].get(k) is True for k in ['validSignedLocator','sceneRevisionUnchanged','rawSha256Unchanged','baselineBound']),'VOLUME_AUTHENTICATED_RETURN')
        require(all(r[k] is False for k in ['canAutoApply','canImportMutate','canWriteStorage']),'VOLUME_INTAKE_AUTHORITY')
        changes=r['reviewSurface']['revisionSession']['reviewGraph']['textChanges'];require(len(changes)==1 and changes[0]['match']['quote']=='sentinel alpha' and changes[0]['replacementText']=='sentinel omega','VOLUME_EXACT_CHANGE')
        ap=read('apply.json');receipt=ap['result']['result']['receipt'];require(ap['commandId']=='cmd.project.review.applyExactTextChangesBatch' and ap['changeId']==changes[0]['changeId'] and ap['result']['ok'] is True and ap['result']['applied'] is True and ap['result']['totals']=={'requested':1,'applied':1,'blocked':0,'failed':0,'skipped':0},'VOLUME_EXPLICIT_APPLY')
        require(ap['before']==[s['sha256'] for s in src] and ap['after'][0]!=ap['before'][0] and ap['after'][1:]==ap['before'][1:] and receipt['sceneId']==ids[0] and receipt['projectId']==capsule['projectId'] and receipt['changeIds']==[ap['changeId']] and receipt['writeStatus']=='applied' and ap['result']['editorSync']['ok'] is True,'VOLUME_APPLY_MUTATION')
        saved=read('saved-scenes.json');require(len(saved)==len(src)==len(reopened['scenes']),'VOLUME_DURABLE_COUNT');saved_all=[];reopen_all=[];render_all=[]
        for i,(s,r,ps) in enumerate(zip(saved,reopened['scenes'],expected_scenes(volume,True))):
            require(s['sceneId']==r['sceneId']==ids[i] and s['nodeId']==r['nodeId']==nodes[i] and s['save']['ok'] is True and s['open']['documentId']==r['open']['documentId']==nodes[i],'VOLUME_SAVED_IDENTITY')
            b=files[s['savedFile']];final=raw('runtime-project-snapshot/'+ids[i]);require(b==final and digest(b)==s['sha256']==r['sha256'],'VOLUME_FRESH_PERSISTED_BYTES')
            exact(scene(b),ps,'SAVED_SCENE');exact(s['renderer'],ps,'SAVED_RENDERER');exact(r['renderer'],ps,'REOPEN_RENDERER');saved_all.extend(scene(b));render_all.extend(s['renderer']);reopen_all.extend(r['renderer'])
        stage('persisted',saved_all,True);stage('applied-renderer',render_all,True);stage('reopened-renderer',reopen_all,True)
        require(read('reexport.json')['before']==[s['sha256'] for s in saved],'VOLUME_REEXPORT_SAVED_BINDING')
        export('reexport','reexport.docx',True);word('final-word-lifecycle','reexport.docx','final-word.docx','final-word',True,False)
    else:
        im=read('import.json');r=im['result'];receipt=r['safeCreate']['receipt'];actual=r['importedScene'];require(im['before']==im['after']==[s['sha256'] for s in src] and im['save']['ok'] is True and r['ok']==1 and r['safeCreate']['commandOk'] is True and r['safeCreate']['commandId']=='cmd.project.docx.importSafeCreate','VOLUME_C1_SAFE_CREATE')
        require(receipt['projectId']==capsule['projectId'] and receipt['sourceArtifactSha256']==digest(raw('returned.docx')) and receipt['candidateContentSha256']==digest(raw('imported-scene.txt')) and receipt['manifestAuthority']['durablePublication'] is True and receipt['atomicEvidence']=={'sceneCount':1,'markerCleared':True},'VOLUME_C1_RECEIPT')
        if volume!='MULTI_SCENE':
            dialog=read('owned-docx-dialog.json');require(dialog['schemaVersion']=='WORD_VOLUME_OWNED_DIALOG_V1' and dialog['pid']==reopened['firstPid'] and dialog['sourceSha256']==dialog['chosenSha256']==digest(raw('returned.docx')) and dialog['interactionDriver']=='CODEX_CUA_NATIVE' and r['contentPreview']['commandId']==dialog['commandId']=='cmd.project.docx.previewLocalFile','VOLUME_OWNED_LOCAL_FILE')
        else:require(r['contentPreview']['commandId']=='cmd.project.docx.previewContent','VOLUME_BOUNDED_CONTENT_PREVIEW')
        require(r['rendererAccept']['directSafeCreateBridge'] is True and r['rendererAccept']['dialogRouteUsed'] is False,'VOLUME_C1_COMMAND_SCOPE')
        require(len(reopened['scenes'])==1,'VOLUME_C1_REOPEN_COUNT');rr=reopened['scenes'][0]
        b=raw('imported-scene.txt');saved=raw('imported-saved.txt');require(saved==raw('runtime-project-snapshot/'+actual['sceneId']) and digest(b)==actual['sceneFileSha256'] and digest(saved)==rr['sha256'] and actual['sceneId']==rr['sceneId'] and actual['nodeId']==rr['nodeId']==rr['open']['documentId'],'VOLUME_C1_DURABLE_BINDING')
        stage('import-renderer',actual['rendererReturnedParagraphs']);exact(b.decode('utf8').split('\n'),expected_paragraphs(volume),'RAW_IMPORTED');stage('persisted',scene(saved));stage('reopened',rr['renderer'])
        for loss in [receipt['lossReport'],r['importPreview']['docxImportPreviewPlan']['lossReport']]:
            require(loss['mode']=='plain-text-only' and loss['itemCount']==len(loss['items'])==6 and sorted((x['code'],x['severity']) for x in loss['items'])==sorted([('DOCX_IMPORT_PREVIEW_BOOKMARKS_NOT_IMPORTED','warning')]*2+[('DOCX_IMPORT_PREVIEW_CUSTOM_METADATA_NOT_IMPORTED','warning'),('DOCX_IMPORT_PREVIEW_PLAIN_TEXT_ONLY','info')]+[('DOCX_IMPORT_PREVIEW_RELATIONSHIPS_NOT_IMPORTED','warning')]*2),'VOLUME_C1_DECLARED_LOSS')
    for name in ['source.png','saved.png','reopen.png']:require(raw(name).startswith(b'\x89PNG\r\n\x1a\n') and len(raw(name))>100,'VOLUME_PRODUCT_SCREENSHOT')
    cleanup=read('cleanup.json');require(cleanup['ok'] is True and len(cleanup['ownedProcesses'])==2 and {p['pid'] for p in cleanup['ownedProcesses']}=={reopened['firstPid'],reopened['pid']} and all(p['exitCode'] is not None or p['signalCode'] is not None for p in cleanup['ownedProcesses']),'VOLUME_RUNTIME_CLEANUP')
    calibration=controls(raw('source.docx'),volume)
    proofs=[{'field':field,'cellId':f'{field}__{volume}__{route}__{profile}','runId':run,'status':'PASS','outcome':'EXACT_OBSERVED_PARAGRAPH_PRESERVATION','subcases':TEXT_SUBCASES if field=='TEXT' else ORDER_SUBCASES,'requiredHops':HOPS[route],'stageProofs':stages,'controls':calibration,'oracles':ORACLES} for field in ['TEXT','ORDER']]
    require(all(checked_read(root,b)==files[b['path']] for b in bindings),'VOLUME_CHANGED_DURING_READ')
    return {'ok':True,'schemaVersion':'WORD_VOLUME_RAW_READBACK_V1','admissionCredit':0,'runId':run,'productHead':head,'productTree':tree,'observationSha256':digest(raw('observation.json')),'filesVerified':len(files),'fieldProofs':proofs,'finalHops':None if route=='C1' else {'ok':True,'acceptanceCredit':0},'seconds':time.perf_counter()-started}
if __name__=='__main__':
    try:
        data=sys.stdin.buffer.read(1024*1024+1);require(len(data)<=1024*1024,'REQUEST_SIZE');print(json.dumps(audit(json.loads(data)),ensure_ascii=False))
    except Exception as e:print(json.dumps({'ok':False,'error':str(e),'admissionCredit':0}));sys.exit(1)

#!/usr/bin/env python3
"""Independent bounded manuscript oracle: fixed expectations, raw bytes, no product parser."""
import base64,copy,hashlib,importlib.util,io,json,os,re,sys,time,unicodedata,zipfile
from pathlib import Path
from xml.etree import ElementTree as ET
_spec=importlib.util.spec_from_file_location('volume_oracle',Path(__file__).with_name('rtk-interop-word-volume-readback.py'))
v=importlib.util.module_from_spec(_spec);_spec.loader.exec_module(v)
W=v.W;require=v.require;digest=v.digest;canonical=v.canonical;exact=v.exact
UNICODE=['[normalization] NFC é Å ö; NFD e\u0301 A\u030a o\u0308; Hangul 한 한.','[bidi] LTR abc \u2067שלום 123\u2069 xyz العربية.','[ime] 日本語.']
SUBCASES={
 'TEXT':v.TEXT_SUBCASES,'ORDER':v.ORDER_SUBCASES,
 'UNICODE_IME_LOCALE':['unicodeNormalizationStable','bidiRunsAccounted','imeCompositionTextPreserved','localeProfileBound','fontScriptFallbackDeclared','unicodeReadbackIndependent'],
 'STYLES':['inlineStylesAccounted','paragraphStylesAccounted','styleCascadeReadback','fontFallbackLedgered','unsupportedStylesDeclared','styleHashBound'],
 'NOVEL_SCENE_STRUCTURE':['sceneBoundariesPreserved','chapterOrderPreserved','splitMergeDetected','projectHierarchyMapped','structureLossLedgered','sceneCountReadback'],
 'TRACKED_REVIEW_SEMANTICS':['trackedInsertDetected','trackedDeleteDetected','moveOrPropertyChangeTyped','reviewAuthorMetadataAccounted','noSilentApplyProof','manualOnlyReasonsLedgered'],
 'COMMENTS':['commentBodiesPreserved','commentAnchorsPreserved','threadShapeAccounted','resolvedDeletedStateDeclared','lostCommentsLedgered','commentReadbackIndependent'],
 'IDENTIFIERS_ANCHORS':['bookmarkIdentityPreserved','anchorBijectionVerified','hyperlinkRelationshipsValidated','duplicateAnchorRejected','locatorHashBound','identifierLossLedgered'],
}
HOPS={**v.HOPS,'C3':['YALKEN_EXPORT_ROUND_N','WORD_LIFECYCLE_ROUND_N','YALKEN_RETURN_INTAKE_ROUND_N','YALKEN_APPLY_ROUND_N'],'C5':['YALKEN_SOURCE_EXPORT','GOOGLE_NATIVE_LIFECYCLE','GOOGLE_NATIVE_DOCX_EXPORT','YALKEN_RETURN_INTAKE']}
TEXT_CONTROLS=['swap-paragraphs','delete-empty','trim-spaces','corrupt-unicode','drop-final-paragraph','duplicate-paragraph','swap-scenes','truncate-half','corrupt-last-scene','normalize-nfd','remove-bidi-isolate','remove-ime-character']
STYLE_CONTROLS=['remove-bold','change-align','change-heading','change-font','change-number-start','remove-code-style','remove-quote-style']
STRUCTURE_CONTROLS=['remove-bookmark','duplicate-bookmark','swap-scene-bookmarks','remove-scene','swap-chapters','merge-scene-path']
def fields(volume,route):
    if route=='C5':
        require(volume in ['SINGLE_SCENE','MULTI_SCENE','FULL_SYNTHETIC_NOVEL'],'GOOGLE_NATIVE_VOLUME_UNQUALIFIED')
        return ['TEXT','ORDER','UNICODE_IME_LOCALE']
    return ['TEXT','ORDER','UNICODE_IME_LOCALE','STYLES']+([] if route=='C1' or volume=='SINGLE_SCENE' else ['NOVEL_SCENE_STRUCTURE'])+([] if route=='C1' else ['TRACKED_REVIEW_SEMANTICS','COMMENTS','IDENTIFIERS_ANCHORS'])
def para(text,**attrs):return {'type':'paragraph',**({'attrs':attrs} if attrs else {}),**({'content':[{'type':'text','text':text}]} if text else {})}
def styles():
    out=[{'type':'heading','attrs':{'level':i},'content':[{'type':'text','text':f'[heading-{i}] Authored heading.'}]} for i in range(1,7)]
    out += [para(f'[align-{a}] Authored paragraph alignment.',textAlign=a) for a in ['left','center','right','justify']]
    runs=[{'type':'text','text':'[inline] '}]
    for word,mark in [('bold',{'type':'bold'}),('italic',{'type':'italic'}),('underline',{'type':'underline'}),('strike',{'type':'strike'}),('color',{'type':'textStyle','attrs':{'color':'#123456'}}),('highlight',{'type':'highlight','attrs':{'color':'#ffff00'}}),('font',{'type':'textStyle','attrs':{'fontFamily':'Arial','fontSize':'14pt'}})]:
        if len(runs)>1:runs.append({'type':'text','text':' '})
        runs.append({'type':'text','text':word,'marks':[mark]})
    out.append({'type':'paragraph','content':runs})
    item=lambda *content:{'type':'listItem','content':list(content)}
    out += [{'type':'orderedList','attrs':{'start':3},'content':[item(para('[ordered-3] First numbered item.')),item(para('[ordered-4] Second numbered item.'),{'type':'bulletList','content':[item(para('[nested-bullet] Nested bullet item.'))]})]}, {'type':'bulletList','content':[item(para('[bullet-1] First bullet item.')),item(para('[bullet-2] Second bullet item.'))]}, {'type':'blockquote','content':[para('[quote] Authored quotation.')]}, {'type':'codeBlock','attrs':{'language':''},'content':[{'type':'text','text':'[code] const answer = 42;'}]},para('')]
    return out

def expected_docs(volume,route,round=0):
    ps=[list(v.PROBES)] if volume=='SINGLE_SCENE' else v.expected_scenes(volume)
    docs=[{'type':'doc','content':[para(p.replace('sentinel alpha','sentinel round'+str(round)) if round else p) for p in s]} for s in ps]
    docs[0]['content'] += [para(p) for p in UNICODE]+styles()
    if route in ['C2','C3']:
        runs=[{'type':'text','text':'[links] '}]
        for i,target in enumerate([LINK_TARGETS[0],LINK_TARGETS[1],LINK_TARGETS[0]]):
            if i:runs.append({'type':'text','text':' / '})
            runs.append({'type':'text','text':'reference','marks':[{'type':'link','attrs':{'href':target,'target':'_blank','rel':'noopener noreferrer nofollow'}}]})
        runs.append({'type':'text','text':'.'});docs[0]['content'].insert(-1,{'type':'paragraph','content':runs})
    return docs

LINK_TARGETS=['https://example.test/research?a=1&b=%D1%91#chapter-2','https://example.test/other?q=%F0%9F%A7%AD#note']
REL='{http://schemas.openxmlformats.org/package/2006/relationships}'
OFFICE_REL='{http://schemas.openxmlformats.org/officeDocument/2006/relationships}'
LINK_REL='http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink'

def paragraphs(doc):
    out=[]
    def visit(n):
        require(isinstance(n,dict),'DOC_NODE')
        if n.get('type') in ['paragraph','heading','codeBlock']:
            require(all(c.get('type')=='text' and isinstance(c.get('text'),str) for c in n.get('content',[])),'DOC_INLINE')
            out.append(''.join(c['text'] for c in n.get('content',[])))
        else:
            require(n.get('type') in ['doc','orderedList','bulletList','listItem','blockquote'],'DOC_BLOCK')
            for child in n.get('content',[]):visit(child)
    visit(doc);return out

def normalize_doc(node):
    require(isinstance(node,dict) and set(node)<= {'type','text','attrs','content','marks'},'RICH_NODE_KEYS')
    result={k:copy.deepcopy(value) for k,value in node.items() if k not in ['attrs','content','marks']}
    if node.get('attrs'):
        attrs={k:value for k,value in node['attrs'].items() if value is not None}
        if attrs:result['attrs']=attrs
    if node.get('marks'):result['marks']=sorted([normalize_doc(m) for m in node['marks']],key=lambda m:canonical(m))
    if node.get('content'):
        content=[]
        for child in node['content']:
            n=normalize_doc(child)
            if content and n.get('type')=='text' and content[-1].get('type')=='text' and n.get('marks')==content[-1].get('marks'):content[-1]['text']+=n['text']
            else:content.append(n)
        result['content']=content
    return result

def scene(data):
    s=data.decode('utf8')
    if s.startswith('[meta]\n'):
        meta=re.match(r'^\[meta\]\nstatus: [^\n]*\ntags: [^\n]*\nsynopsis: [^\n]*\n\[/meta\]\n\n',s);require(meta is not None,'SCENE_META');s=s[meta.end():]
    m=re.match(r'^\[doc-v2 length=(\d+)\]\n',s);require(m is not None,'SCENE_ENVELOPE');payload=s[m.end():].rstrip('\n')
    require(len(payload.encode('utf-16-le'))//2==int(m.group(1)),'SCENE_LENGTH');d=json.loads(payload);require(d.get('type')=='doc','SCENE_ROOT');paragraphs(d);return d

def docx(data,round=0,google=False):
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        entries=z.infolist();names=[e.filename for e in entries]
        require(0<len(entries)<=128 and len(set(names))==len(names),'ZIP_ENTRIES')
        require(all(not n.startswith('/') and '\\' not in n and all(p not in ('','.','..') for p in n.split('/')) for n in names),'ZIP_PATH')
        require(all(e.file_size<=10*1024*1024 and not e.flag_bits&1 for e in entries) and sum(e.file_size for e in entries)<=50*1024*1024,'ZIP_BOUND')
        parts={n:z.read(n) for n in names}
    for name,b in parts.items():
        if name.endswith(('.xml','.rels')):require(b'<!DOCTYPE' not in b.upper() and b'<!ENTITY' not in b.upper(),'XML_DTD')
        if name.endswith('.rels'):
            for e in ET.fromstring(b):
                if e.attrib.get('TargetMode','Internal')=='External':require(name=='word/_rels/document.xml.rels' and e.tag==REL+'Relationship' and e.get('Type')==LINK_REL and e.get('Target') in LINK_TARGETS,'EXTERNAL_RELATIONSHIP')
    d=ET.fromstring(parts['word/document.xml']);body=d.find(W+'body')
    allowed_body=[W+'p',W+'sectPr']+([W+'bookmarkStart',W+'bookmarkEnd'] if google else [])
    require(d.tag==W+'document' and body is not None and all(n.tag in allowed_body for n in body),'DOCX_BODY')
    if google:
        starts=[n for n in body if n.tag==W+'bookmarkStart'];ends=[n for n in body if n.tag==W+'bookmarkEnd']
        require(all(not list(n) and not n.text for n in starts+ends),'GOOGLE_BOOKMARK_TEXT')
        a=[n.get(W+'id') for n in starts];b=[n.get(W+'id') for n in ends]
        require(a==b and len(set(a))==len(a) and all(isinstance(i,str) and i.isdecimal() for i in a),'GOOGLE_BOOKMARK_PAIRING')
    for p in body.findall(W+'p'):
        require(all(n.tag in {W+x for x in ['pPr','r','ins','del','bookmarkStart','bookmarkEnd','proofErr','commentRangeStart','commentRangeEnd','hyperlink']} for n in p),'DOCX_PARAGRAPH')
        for link in p.findall(W+'hyperlink'):
            require(set(link.attrib)<={OFFICE_REL+'id',W+'history'} and link.get(OFFICE_REL+'id') and all(n.tag==W+'r' for n in link),'DOCX_HYPERLINK_SHAPE')
        for rev in [*p.findall(W+'ins'),*p.findall(W+'del')]:require(all(n.tag==W+'r' for n in rev),'DOCX_REVISION')
        for r in p.iter(W+'r'):
            require(all(n.tag in {W+x for x in ['rPr','t','delText','lastRenderedPageBreak','commentReference']} for n in r),'DOCX_RUN')
            for n in r:
                if n.tag in [W+'t',W+'delText']:require(not list(n),'DOCX_TEXT_LEAF')
                if n.tag==W+'lastRenderedPageBreak':require(not list(n) and not n.attrib and not n.text,'DOCX_PAGE_CACHE')
    ins=d.findall('.//'+W+'ins');dele=d.findall('.//'+W+'del')
    if round:
        require(len(ins)==len(dele)==1,'TRACKED_PAIR_COUNT');require(''.join(n.text or '' for n in ins[0].iter(W+'t'))=='sentinel round'+str(round),'TRACKED_INSERT')
        require(''.join(n.text or '' for n in dele[0].iter(W+'delText'))==('sentinel alpha' if round==1 else 'sentinel round'+str(round-1)),'TRACKED_DELETE')
    else:require(not ins and not dele,'UNEXPECTED_TRACKED_EDIT')
    raw_links(parts,d)
    return [v.visible(p) for p in body.findall(W+'p')],parts,d

def raw_links(parts,document):
    relationships={}
    if 'word/_rels/document.xml.rels' in parts:
        root=ET.fromstring(parts['word/_rels/document.xml.rels'])
        require(root.tag==REL+'Relationships','LINK_RELATIONSHIPS_NAMESPACE')
        for item in root:
            ident=item.get('Id')
            require(item.tag==REL+'Relationship' and ident and ident not in relationships,'LINK_RELATIONSHIP_ID')
            relationships[ident]=item
    rows=[];used=set()
    for index,p in enumerate(document.findall(W+'body/'+W+'p')):
        offset=0
        for child in p:
            text=v.visible(child);size=len(text.encode('utf-16-le'))//2
            if child.tag==W+'hyperlink':
                ident=child.get(OFFICE_REL+'id');rel=relationships.get(ident)
                require(rel is not None and rel.get('Type')==LINK_REL and rel.get('TargetMode')=='External' and rel.get('Target') in LINK_TARGETS and size>0,'LINK_RELATIONSHIP_TARGET')
                used.add(ident);row={'paragraphIndex':index,'startUtf16':offset,'endUtf16':offset+size,'text':text,'href':rel.get('Target')}
                if rows and all(rows[-1][k]==row[k] for k in ['paragraphIndex','href']) and rows[-1]['endUtf16']==offset:
                    rows[-1]['endUtf16']=offset+size;rows[-1]['text']+=text
                else:rows.append(row)
            offset+=size
    require(used=={ident for ident,r in relationships.items() if r.get('Type')==LINK_REL},'LINK_UNREFERENCED_RELATIONSHIP')
    return rows

def expected_links(docs):
    result=[];index=0
    def visit(n):
        nonlocal index
        if n.get('type') in ['paragraph','heading','codeBlock']:
            offset=0
            for run in n.get('content',[]):
                value=run['text'];end=offset+len(value.encode('utf-16-le'))//2
                links=[m for m in run.get('marks',[]) if m['type']=='link']
                require(len(links)<=1,'LINK_EXPECTED_UNIQUE_MARK')
                if links:result.append({'paragraphIndex':index,'startUtf16':offset,'endUtf16':end,'text':value,'href':links[0]['attrs']['href']})
                offset=end
            index+=1
        else:
            for c in n.get('content',[]):visit(c)
    for doc in docs:visit(doc)
    return result

def identifier_doc(parts,document,round_id,ids,docs):
    bookmarks=bookmark_partition(document,round_id,ids,docs)
    actual=raw_links(parts,document);expected=expected_links(docs)
    require(len(expected)==3 and actual==expected,'IDENTIFIER_LINK_RANGES_AND_TARGETS')
    return {'bookmarkSha256':bookmarks,'bookmarkCount':sum(len(paragraphs(d)) for d in docs),
            'links':actual,'linkSemanticSha256':digest(canonical(actual)),
            'relationshipsSha256':digest(parts['word/_rels/document.xml.rels']),
            'scope':'Declared YRTK per-round locators and literal safe hyperlink ranges; native relationship renumbering is allowed only with unchanged range-to-target mapping.'}

def locator_store(data,activation,cap,ids,docs,hashes):
    store=json.loads(data);unsigned={k:v for k,v in store.items() if k!='authorityStoreDigest'}
    require(store['authorityStoreDigest']==activation['authorityStoreDigest']=='sha256:'+digest(canonical(unsigned)),'LOCATOR_STORE_DIGEST')
    require(store['lastRoundId']==cap['roundId'] and store['secretExposedToRenderer'] is False and store['secretEmbeddedInDocx'] is False,'LOCATOR_STORE_ROUND')
    local=store['roundsById'][cap['roundId']];mapping=local['exportMap']
    require('hmacSecret' not in local and local['roundId']==mapping['roundId']==cap['roundId'] and mapping['scope']=='full-manuscript','LOCATOR_MAP_IDENTITY')
    require([s['sceneId'] for s in mapping['scenes']]==ids and local['coreManifestDigest']==cap['coreManifestDigest'],'LOCATOR_MAP_SCENES')
    keys=[];position=0;map_links=[]
    for ordinal,(s,doc,raw_hash) in enumerate(zip(mapping['scenes'],docs,hashes)):
        ps=paragraphs(doc)
        require(s['sceneOrdinal']==ordinal and s['rawSha256']=='sha256:'+raw_hash and s['sceneRevision']=='sha256:'+raw_hash and len(s['blocks'])==len(ps),'LOCATOR_SCENE_BASELINE')
        for index,(b,text) in enumerate(zip(s['blocks'],ps)):
            seed=digest((s['sceneId']+'\n'+str(ordinal)+'\n'+str(index)+'\n'+text).encode())
            expected_name='YRTK_'+digest(b'word-bookmark-v1'+canonical({'roundBlockOccurrenceId':str(index),'roundId':cap['roundId'],'sceneId':s['sceneId']}))[:32]
            require(b['blockId']==f'scene-{ordinal+1:02d}-block-{index+1:04d}-'+seed[:16] and b['paragraphId']==f'yrtk-{ordinal+1:02d}-p-'+seed[:16] and b['documentParagraphIndex']==position,'LOCATOR_BLOCK_IDENTITY')
            require(b['canonicalTextSha256']=='sha256:'+digest(text.encode()) and b['canonicalMarksSha256']=='sha256:'+digest(canonical(b['formatIr'])),'LOCATOR_BLOCK_HASH')
            require([x['value']['name'] for x in b['wordSignals'] if x['kind']=='bookmarkName']==[expected_name] and ''.join(x['text'] for x in b['formatIr']['runs'])==text,'LOCATOR_DECLARED_BOOKMARK')
            offset=0
            for run in b['formatIr']['runs']:
                end=offset+len(run['text'].encode('utf-16-le'))//2
                require(run['from']==offset and run['to']==end,'LOCATOR_RUN_RANGE')
                links=[mark for mark in run.get('preservedMarks',[]) if mark.get('type')=='link'];require(len(links)<=1,'LOCATOR_LINK_MARK')
                if links:map_links.append({'paragraphIndex':position,'startUtf16':offset,'endUtf16':end,'text':run['text'],'href':links[0]['attrs']['href']})
                offset=end
            keys.append([s['sceneId'],b['blockId'],b['paragraphId'],expected_name,b['canonicalTextSha256'],b['canonicalMarksSha256']]);position+=1
    require(len(keys)==cap['blockCount'] and len({k[1] for k in keys})==len(keys) and len({k[3] for k in keys})==len(keys),'LOCATOR_BIJECTION')
    require(map_links==expected_links(docs),'LOCATOR_LINK_BINDING')
    return {'artifactSha256':digest(data),'storeDigest':store['authorityStoreDigest'],'roundId':cap['roundId'],'exportId':cap['exportId'],'coreManifestDigest':cap['coreManifestDigest'],
            'locatorSha256':digest(canonical(keys)),'sourceMapSha256':digest(canonical(mapping)),'blockCount':len(keys),'sceneCount':len(ids),'sourceSceneHashes':hashes}

IDENTIFIER_CONTROLS=['missing-bookmark','duplicate-bookmark','wrong-bookmark-end','partial-bookmark-range','renamed-bookmark','removed-link','swapped-link-targets','dangling-link','duplicate-relationship','unsafe-link','unreferenced-link']
def identifier_controls(source,round_id,ids,docs):
    _,parts,template=docx(source);identifier_doc(parts,template,round_id,ids,docs);rows=[]
    for name in IDENTIFIER_CONTROLS:
        d=copy.deepcopy(template);changed=dict(parts);ps=d.findall(W+'body/'+W+'p');first=ps[0];starts=d.findall('.//'+W+'bookmarkStart');links=d.findall('.//'+W+'hyperlink')
        rels=ET.fromstring(parts['word/_rels/document.xml.rels']);link_rels=[r for r in rels if r.get('Type')==LINK_REL]
        if name=='missing-bookmark':first.remove(first.find(W+'bookmarkStart'))
        elif name=='duplicate-bookmark':ps[1].find(W+'bookmarkStart').set(W+'name',starts[0].get(W+'name'))
        elif name=='wrong-bookmark-end':first.find(W+'bookmarkEnd').set(W+'id','unknown')
        elif name=='partial-bookmark-range':
            x=first.find(W+'bookmarkStart');first.remove(x);first.insert(len(first)-1,x)
        elif name=='renamed-bookmark':starts[0].set(W+'name',starts[0].get(W+'name')+'X')
        elif name=='removed-link':
            p=next(p for p in ps if links[0] in list(p));at=list(p).index(links[0]);p.remove(links[0])
            for c in list(links[0]):p.insert(at,c);at+=1
        elif name=='swapped-link-targets':
            left,right=link_rels[:2];one=left.get('Target');left.set('Target',right.get('Target'));right.set('Target',one)
        elif name=='dangling-link':links[0].set(OFFICE_REL+'id','not-present')
        elif name=='duplicate-relationship':rels.append(copy.deepcopy(link_rels[0]))
        elif name=='unsafe-link':link_rels[0].set('Target','file:///not-authorized')
        elif name=='unreferenced-link':
            item=copy.deepcopy(link_rels[0]);item.set('Id','unused-link');rels.append(item)
        changed['word/document.xml']=ET.tostring(d);changed['word/_rels/document.xml.rels']=ET.tostring(rels)
        rejected=False
        try:identifier_doc(changed,d,round_id,ids,docs)
        except ValueError:rejected=True
        require(rejected,'FALSE_GREEN_IDENTIFIER_'+name)
        rows.append({'id':name,'rejected':True,'sha256':digest(canonical({n:digest(b) for n,b in changed.items()}))})
    return rows


# Independent comment oracle. Fixed source data and raw OOXML, not a product
# projection or its own PASS flag, define the expected result.
C14='{http://schemas.microsoft.com/office/word/2010/wordml}'
C15='{http://schemas.microsoft.com/office/word/2012/wordml}'
CID='{http://schemas.microsoft.com/office/word/2016/wordml/cid}'
CEX='{http://schemas.microsoft.com/office/word/2018/wordml/cex}'
COMMENT_PARTS=['comments','commentsExtended','commentsIds','commentsExtensible']
COMMENT_RELATIONSHIPS=[
 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments',
 'http://schemas.microsoft.com/office/2011/relationships/commentsExtended',
 'http://schemas.microsoft.com/office/2016/09/relationships/commentsIds',
 'http://schemas.microsoft.com/office/2018/08/relationships/commentsExtensible']
COMMENT_CONTROLS=['missing-root','missing-reply','body-whitespace','wrong-author','wrong-date','wrong-utc-namespace','wrong-parent','wrong-status','wrong-anchor','missing-reference','duplicate-identity','deleted-reappeared']
def comment_expected(volume,route,pid,scene_id):
    ps=paragraphs(expected_docs(volume,route)[0]);out=[]
    for status,quote in [('open','[quote] Authored quotation.'),('resolved','[code] const answer = 42;'),('deleted','[heading-1] Authored heading.')]:
        ident='manuscript-comment-'+status;index=ps.index(quote)
        messages=[{'commentId':ident+'-root','kind':'root','body':'  Root '+status+' & <замечание>\n\t尾 ','provenance':{'author':'Alice & editor','initials':'AE','date':'2026-09-17T10:00:00Z','dateUtc':'2026-09-17T10:00:00Z'}},
                  {'commentId':ident+'-reply','kind':'reply','body':'Reply '+status+' 🧭','provenance':{'author':'Bob','initials':'B','date':'2026-09-17T10:01:00Z','dateUtc':'2026-09-17T10:01:00Z'}}]
        out.append({'threadId':ident,'sceneId':scene_id,'rootCommentId':messages[0]['commentId'],'status':status,**({'deleted':True} if status=='deleted' else {}),
                    'anchor':{'sceneId':scene_id,'blockId':'','paragraphIndex':index,'sceneParagraphIndex':index,'blockTextSha256':digest(quote.encode()),'startUtf16':0,'selectedText':quote,'selectedTextSha256':digest(quote.encode()),'authoritySource':'saved-project-exact-paragraph-range'},'messages':messages})
    return {'schemaVersion':'yalken.rtk.word.non-text-return-state.v1','projectId':pid,'revision':1,'threads':out,'events':[]}
def comment_durable(ident):
    return format((int(digest(('comment-durable:'+ident).encode())[:8],16)&0x7fffffff) or 1,'08X')
def comment_parts(parts,document,expected):
    parsed={}
    ct=ET.fromstring(parts['[Content_Types].xml']);rels=ET.fromstring(parts['word/_rels/document.xml.rels'])
    for name,rel in zip(COMMENT_PARTS,COMMENT_RELATIONSHIPS):
        p='word/'+name+'.xml'
        require([n.get('ContentType') for n in ct if n.get('PartName')=='/'+p]==['application/vnd.openxmlformats-officedocument.wordprocessingml.'+name+'+xml'],'COMMENT_CONTENT_TYPE')
        require([n.get('Target') for n in rels if n.get('Type')==rel]==[name+'.xml'],'COMMENT_RELATIONSHIP')
        parsed[name]=ET.fromstring(parts[p])
    require(parsed['comments'].tag==W+'comments' and parsed['commentsExtended'].tag==C15+'commentsEx'
            and parsed['commentsIds'].tag==CID+'commentsIds' and parsed['commentsExtensible'].tag==CEX+'commentsExtensible','COMMENT_PART_NAMESPACE')
    def indexed(root,tag,attr):
        require(all(n.tag==tag for n in root),'COMMENT_ENTRY_NAMESPACE')
        ids=[n.get(attr) for n in root];require(len(ids)==4 and len(set(ids))==4 and all(ids),'COMMENT_IDENTITY_SET')
        return dict(zip(ids,list(root)))
    cs=indexed(parsed['comments'],W+'comment',W+'id')
    ex=indexed(parsed['commentsExtended'],C15+'commentEx',C15+'paraId')
    cid=indexed(parsed['commentsIds'],CID+'commentId',CID+'paraId')
    cex=indexed(parsed['commentsExtensible'],CEX+'commentExtensible',CEX+'durableId')
    by_durable={};by_para={}
    for ident,c in cs.items():
        ps=c.findall(W+'p');require(ps and all(n.tag==W+'p' for n in c),'COMMENT_BODY_STRUCTURE')
        par=ps[-1].get(C14+'paraId');require(par in ex and par in cid and par not in by_para,'COMMENT_PARAGRAPH_JOIN')
        durable=cid[par].get(CID+'durableId');require(durable in cex and durable not in by_durable,'COMMENT_DURABLE_JOIN')
        texts=[]
        for p in ps:
            # The body's only authored atoms are text, tabs and line breaks.
            require(not list(p.iter(W+'del')) and not list(p.iter(W+'ins')),'COMMENT_BODY_REVISIONS')
            require(all(n.tag in {W+x for x in ['pPr','r','proofErr','bookmarkStart','bookmarkEnd']} for n in p),'COMMENT_BODY_NODE')
            for r in p.findall(W+'r'):require(all(n.tag in {W+x for x in ['rPr','t','tab','br','cr','annotationRef']} for n in r),'COMMENT_BODY_ATOM')
            texts.append(''.join(n.text or '' if n.tag==W+'t' else '\t' if n.tag==W+'tab' else '\n' if n.tag in [W+'br',W+'cr'] else '' for n in p.iter()))
        row={'id':ident,'paraId':par,'durableId':durable,'body':'\n'.join(texts),'parent':ex[par].get(C15+'paraIdParent'),
             'done':ex[par].get(C15+'done'),'provenance':{'author':c.get(W+'author'),'initials':c.get(W+'initials'),'date':c.get(W+'date'),'dateUtc':cex[durable].get(CEX+'dateUtc')}}
        by_durable[durable]=row;by_para[par]=row
    require(set(ex)==set(cid)==set(by_para) and set(cex)==set(by_durable),'COMMENT_GRAPH_EXACT_JOIN')
    ranges={};starts={};ends={};refs={}
    body=document.find(W+'body')
    for pi,p in enumerate(body.findall(W+'p')):
        position=0;value=''
        def walk(n,deleted=False):
            nonlocal position,value
            deleted=deleted or n.tag in [W+'del',W+'moveFrom']
            if deleted:return
            if n.tag in [W+'commentRangeStart',W+'commentRangeEnd',W+'commentReference']:
                ident=n.get(W+'id');require(ident in cs and not list(n) and not n.text,'COMMENT_MARKER_ID')
                target=starts if n.tag==W+'commentRangeStart' else ends if n.tag==W+'commentRangeEnd' else refs
                require(ident not in target,'COMMENT_DUPLICATE_RANGE');target[ident]=(pi,position)
            atom=(n.text or '') if n.tag==W+'t' else '\t' if n.tag==W+'tab' else '\n' if n.tag in [W+'br',W+'cr'] else ''
            position+=len(atom.encode('utf-16-le'))//2;value+=atom
            for child in n:walk(child,deleted)
        walk(p);ranges[pi]=value
    require(set(starts)==set(ends)==set(refs)==set(cs),'COMMENT_REFERENCE_SET')
    result=[]
    for thread in expected['threads']:
        if thread['status']=='deleted':
            require(all(comment_durable(m['commentId']) not in by_durable for m in thread['messages']),'COMMENT_DELETED_REAPPEARED');continue
        parent=None
        for message in thread['messages']:
            durable=comment_durable(message['commentId']);require(durable in by_durable,'COMMENT_MESSAGE_MISSING')
            row=by_durable[durable];require(row['body']==message['body'] and row['provenance']==message['provenance'],'COMMENT_LITERAL_BODY_PROVENANCE')
            require(row['parent']==parent and row['done']==('1' if thread['status']=='resolved' else '0'),'COMMENT_THREAD_SHAPE_STATE')
            ident=row['id'];a=thread['anchor'];pos=a['sceneParagraphIndex'];start=a['startUtf16'];end=start+len(a['selectedText'].encode('utf-16-le'))//2
            require(starts[ident]==(pos,start) and ends[ident]==refs[ident]==(pos,end),'COMMENT_EXACT_RANGE')
            require(ranges[pos].encode('utf-16-le')[2*start:2*end].decode('utf-16-le')==a['selectedText'],'COMMENT_ANCHOR_TEXT')
            result.append({'canonicalCommentId':message['commentId'],'durableId':durable,'body':row['body'],'provenance':row['provenance'],'kind':message['kind'],'status':thread['status'],'paragraphIndex':pos,'startUtf16':start,'endUtf16':end})
            if message['kind']=='root':parent=row['paraId']
    require(len(result)==len(by_durable)==4,'COMMENT_EXACT_MESSAGE_SET')
    return {'semanticSha256':digest(canonical(result)),'messageCount':4,'threadCount':2,'intentionalDeletionCount':1,
            'partsSha256':{n:digest(parts['word/'+n+'.xml']) for n in COMMENT_PARTS}}
def comment_controls(parts,document,expected):
    result=[]
    for name in COMMENT_CONTROLS:
        pp=dict(parts);d=copy.deepcopy(document)
        key='comments.xml' if name in ['missing-root','missing-reply','body-whitespace','wrong-author','wrong-date','duplicate-identity','deleted-reappeared'] else 'commentsExtensible.xml' if name=='wrong-utc-namespace' else 'commentsExtended.xml'
        root=ET.fromstring(pp['word/'+key]);items=list(root)
        if name=='missing-root':root.remove(items[0])
        elif name=='missing-reply':root.remove(items[1])
        elif name=='body-whitespace':
            atom=items[0].find('.//'+W+'t');atom.text=(atom.text or '').strip()
        elif name=='wrong-author':items[0].set(W+'author','Mallory')
        elif name=='wrong-date':items[0].set(W+'date','2000-01-01T00:00:00Z')
        elif name=='wrong-utc-namespace':
            value=items[0].attrib.pop(CEX+'dateUtc');items[0].set(W+'dateUtc',value)
        elif name=='wrong-parent':items[1].set(C15+'paraIdParent',items[2].get(C15+'paraId'))
        elif name=='wrong-status':items[0].set(C15+'done','1')
        elif name=='wrong-anchor':
            marker=next(d.iter(W+'commentRangeStart'))
            for p in d.iter():
                if marker in list(p):p.remove(marker);p.append(marker);break
        elif name=='missing-reference':
            marker=next(d.iter(W+'commentReference'))
            for p in d.iter():
                if marker in list(p):p.remove(marker);break
        elif name=='duplicate-identity':root.append(copy.deepcopy(items[0]))
        elif name=='deleted-reappeared':
            message=copy.deepcopy(items[0]);message.set(W+'id','999999');message.find('.//'+W+'t').text='  Root deleted & <замечание>\n\t尾 ';root.append(message)
        pp['word/'+key]=ET.tostring(root)
        rejected=False
        try:comment_parts(pp,d,expected)
        except (ValueError,KeyError):rejected=True
        require(rejected,'COMMENT_FALSE_GREEN_'+name)
        result.append({'id':name,'rejected':True,'sha256':digest(canonical({'parts':{k:digest(b) for k,b in pp.items()},'document':digest(ET.tostring(d))}))})
    return result

REVIEW_CONTROLS=['missing-insert','missing-delete','missing-property','changed-author','changed-legacy-date','changed-utc-date','wrong-utc-namespace','missing-current-format','wrong-property-kind','missing-manual-reason','granted-write','silent-canonical-apply']
WORD_DATE_UTC='{http://schemas.microsoft.com/office/word/2023/wordml/word16du}dateUtc'
def review_revision_proof(document,intake,ordinal,property_probe=False):
    result=intake['result'];returned=result['returnIntake'];metadata=returned['reviewMetadata']
    require(result['ok'] is True and result['commandId']=='cmd.project.review.activateDocxReviewPreviewSession','REVIEW_PRODUCT_COMMAND')
    require(all(result[k] is False and returned[k] is False for k in ['canAutoApply','canImportMutate','canWriteStorage']),'REVIEW_NO_WRITE_AUTHORITY')
    require(intake['before']==intake['after'],'REVIEW_NO_SILENT_APPLY')
    require(returned['authenticated'] is True and returned['sourceMode']=='TRACKED','REVIEW_AUTHENTICATED')
    require(metadata['authority']=='ADVISORY_ONLY' and metadata['timestampPolicy']=='LITERAL_WORD_DATE_AND_NAMESPACED_DATE_UTC_NO_NORMALIZATION' and metadata['sourceArtifactSha256']==returned['returnedArtifactSha256'] and re.fullmatch('sha256:[a-f0-9]{64}',metadata['sourceArtifactSha256']),'REVIEW_METADATA_BINDING')
    text=[];properties=[];ids=[]
    for node in document.iter():
        kind=node.tag.removeprefix(W)
        if node.tag not in [W+k for k in ['ins','del','rPrChange','pPrChange','numPrChange']]:continue
        ident=node.get(W+'id');author=node.get(W+'author');date=node.get(W+'date');utc=node.get(WORD_DATE_UTC)
        require(isinstance(ident,str) and ident.isdecimal() and ident not in ids,'REVIEW_NATIVE_IDENTITY');ids.append(ident)
        require(isinstance(author,str) and author.strip() and len(author)<=1024,'REVIEW_AUTHOR')
        require(all(isinstance(t,str) and re.fullmatch(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z',t) for t in [date,utc]),'REVIEW_NATIVE_TIMESTAMPS')
        row={'nativeRevisionId':ident,'author':author,'date':date,'dateUtc':utc}
        if kind in ['ins','del']:
            operation='insert' if kind=='ins' else 'delete';value=''.join(n.text or '' for n in node.iter(W+('t' if kind=='ins' else 'delText')))
            expected='sentinel round'+str(ordinal) if kind=='ins' else ('sentinel alpha' if ordinal==1 else 'sentinel round'+str(ordinal-1))
            require(value==expected,'REVIEW_LITERAL_REVISION')
            text.append({**row,'operation':operation,'text':value,'classification':'TEXT_MANUAL','reasonCode':'RTK_MANUAL_DEGRADED_LOCATOR'})
        else:
            require(property_probe and kind=='rPrChange' and node.find(W+'rPr') is not None and not list(node.find(W+'rPr')),'REVIEW_OLD_PROPERTY')
            parent=next((n for n in document.iter(W+'rPr') if node in list(n)),None)
            require(parent is not None and parent.find(W+'b') is not None and parent.find(W+'b').get(W+'val','1') in ['1','true','on'],'REVIEW_CURRENT_PROPERTY')
            properties.append({**row,'propertyKind':kind,'classification':'MANUAL_REVIEW','reasonCode':'RTK_BLOCKED_STRUCTURAL'})
    require(len(text)==2 and sorted(x['operation'] for x in text)==['delete','insert'] and len(properties)==(1 if property_probe else 0),'REVIEW_REQUIRED_FOOTPRINTS')
    require(metadata['textRevisions']==text and metadata['propertyRevisions']==properties,'REVIEW_PRODUCT_METADATA_CONTINUITY')
    counts=returned['counts'];require(counts['textRevisions']==2 and counts['propertyRevisions']==len(properties) and counts['moveRevisions']==0,'REVIEW_PRODUCT_COUNTS')
    graph=result['reviewSurface']['revisionSession']['reviewGraph'];changes=graph['textChanges']
    require(len(changes)==1 and changes[0]['match']['quote']==next(r['text'] for r in text if r['operation']=='delete') and changes[0]['replacementText']==next(r['text'] for r in text if r['operation']=='insert') and changes[0]['createdAt']==next(r['date'] for r in text if r['operation']=='insert'),'REVIEW_PREVIEW_REVISION')
    if property_probe:
        require(intake['explicitCanonicalApplyConfirmed'] is False and result['formattingProductPath']['writerCalled'] is False,'REVIEW_PROPERTY_UNAPPLIED')
        require(any(d['diagnosticId']=='docx-review-diagnostic-RTK_BLOCKED_STRUCTURAL' and d['severity']=='warning' and d['message']=='Structure and property changes require manual review.' for d in graph['diagnosticItems']),'REVIEW_MANUAL_REASON_VISIBLE')
    return {'textRevisions':text,'propertyRevisions':properties,'metadataSha256':digest(canonical(metadata)),'canonicalBefore':intake['before'],'canonicalAfter':intake['after'],'authority':'ADVISORY_ONLY','manualOnlyReasonCodes':['RTK_BLOCKED_STRUCTURAL'] if property_probe else []}

def review_controls(document,intake):
    # Calibrate the revision predicate on the actual native first paragraph.
    # Full-document preservation is independently required by the journey oracle.
    first=document.find(W+'body/'+W+'p');require(first is not None,'REVIEW_CONTROL_PARAGRAPH')
    rows=[]
    for name in REVIEW_CONTROLS:
        root=ET.Element(W+'document');body=ET.SubElement(root,W+'body');body.append(copy.deepcopy(first));value=copy.deepcopy(intake)
        def remove(tag):
            parent=next(n for n in root.iter() if any(c.tag==W+tag for c in n));parent.remove(next(c for c in parent if c.tag==W+tag))
        if name in ['missing-insert','missing-delete','missing-property']:remove({'missing-insert':'ins','missing-delete':'del','missing-property':'rPrChange'}[name])
        elif name in ['changed-author','changed-legacy-date','changed-utc-date']:
            key={'changed-author':'author','changed-legacy-date':'date','changed-utc-date':'dateUtc'}[name];value['result']['returnIntake']['reviewMetadata']['textRevisions'][0][key]='changed'
        elif name=='wrong-utc-namespace':
            node=next(root.iter(W+'ins'));node.set('{urn:lookalike}dateUtc',node.attrib.pop(WORD_DATE_UTC))
        elif name=='missing-current-format':remove('b')
        elif name=='wrong-property-kind':value['result']['returnIntake']['reviewMetadata']['propertyRevisions'][0]['propertyKind']='pPrChange'
        elif name=='missing-manual-reason':value['result']['reviewSurface']['revisionSession']['reviewGraph']['diagnosticItems']=[]
        elif name=='granted-write':value['result']['canWriteStorage']=True
        elif name=='silent-canonical-apply':value['after']={'sceneHashes':['0'*64]}
        rejected=False
        try:review_revision_proof(root,value,1,True)
        except ValueError:rejected=True
        require(rejected,'FALSE_GREEN_REVIEW_'+name)
        rows.append({'id':name,'rejected':True,'sha256':digest(ET.tostring(root)+canonical(value))})
    return rows


class StyleCascade:
    def __init__(self,parts):
        root=ET.fromstring(parts.get('word/styles.xml',b'<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"/>'))
        nodes=root.findall(W+'style');self.styles={n.get(W+'styleId'):n for n in nodes};require(len(nodes)==len(self.styles)<=4096,'STYLE_IDENTITIES')
        self.defaults={kind:self.props(root.find(W+'docDefaults/'+W+kind+'Default/'+W+kind)) for kind in ['pPr','rPr']}
        self.defaultStyle=next((n.get(W+'styleId') for n in nodes if n.get(W+'type')=='paragraph' and n.get(W+'default') in ('1','true')),None)
        self.numbering=ET.fromstring(parts.get('word/numbering.xml',b'<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"/>'))
    def props(self,node):
        if node is None:return {}
        return {c.tag:dict(c.attrib) for c in node if c.tag not in [W+'rPrChange',W+'pPrChange',W+'sectPr']}
    def merge(self,*layers):
        result={}
        for layer in layers:
            for k,value in layer.items():result[k]={**result.get(k,{}),**value}
        return result
    def chain(self,ident,kind,seen=()):
        if ident is None:return {}
        require(ident in self.styles and ident not in seen and len(seen)<32,'STYLE_CHAIN')
        node=self.styles[ident];base=node.find(W+'basedOn');parent=base.get(W+'val') if base is not None else None
        return self.merge(self.chain(parent,kind,seen+(ident,)),self.props(node.find(W+kind)))
    def paragraph(self,p):
        ppr=p.find(W+'pPr');style=ppr.find(W+'pStyle') if ppr is not None else None;ident=style.get(W+'val') if style is not None else self.defaultStyle
        return self.merge(self.defaults['pPr'],self.chain(ident,'pPr'),self.props(ppr)),ident
    def run(self,p,r):
        _,ident=self.paragraph(p);rpr=r.find(W+'rPr');style=rpr.find(W+'rStyle') if rpr is not None else None
        return self.merge(self.defaults['rPr'],self.chain(ident,'rPr'),self.chain(style.get(W+'val'),'rPr') if style is not None else {},self.props(rpr))
    def number(self,p):
        num=p.find(W+'pPr/'+W+'numPr');require(num is not None,'NUMBERING_MISSING')
        ident=num.find(W+'numId').get(W+'val');level=num.find(W+'ilvl').get(W+'val');n=next((n for n in self.numbering.findall(W+'num') if n.get(W+'numId')==ident),None);require(n is not None,'NUMBERING_ID')
        aid=n.find(W+'abstractNumId').get(W+'val');abstract=next((a for a in self.numbering.findall(W+'abstractNum') if a.get(W+'abstractNumId')==aid),None);require(abstract is not None,'NUMBERING_ABSTRACT')
        lvl=next((l for l in abstract.findall(W+'lvl') if l.get(W+'ilvl')==level),None);require(lvl is not None,'NUMBERING_LEVEL');start=int(lvl.find(W+'start').get(W+'val'))
        over=next((l for l in n.findall(W+'lvlOverride') if l.get(W+'ilvl')==level),None)
        if over is not None:
            if over.find(W+'lvl') is not None:lvl=over.find(W+'lvl')
            if over.find(W+'startOverride') is not None:start=int(over.find(W+'startOverride').get(W+'val'))
        return ident,int(level),lvl.find(W+'numFmt').get(W+'val'),start

def assert_docx_styles(parts,document):
    cascade=StyleCascade(parts);ps=document.findall(W+'body/'+W+'p');by={v.visible(p):p for p in ps};proof={}
    for i in range(1,7):
        p=by[f'[heading-{i}] Authored heading.'];pr,_=cascade.paragraph(p);require(pr.get(W+'outlineLvl',{}).get(W+'val')==str(i-1),'STYLE_HEADING');proof['heading-'+str(i)]=i
    for align in ['left','center','right','justify']:
        p=by[f'[align-{align}] Authored paragraph alignment.'];pr,_=cascade.paragraph(p);require(pr.get(W+'jc',{}).get(W+'val','left')==('both' if align=='justify' else align) and W+'bidi' not in pr,'STYLE_ALIGN');proof['align-'+align]=align
    p=by['[inline] bold italic underline strike color highlight font'];segments=[]
    for r in p.findall(W+'r'):segments += [(c,cascade.run(p,r)) for c in v.visible(r)]
    text=''.join(c for c,_ in segments)
    expected={'bold':('b',None),'italic':('i',None),'underline':('u','single'),'strike':('strike',None),'color':('color','123456'),'highlight':('highlight','yellow'),'font':('sz','28')}
    for word,(key,value) in expected.items():
        start=text.index(word);props=[s for _,s in segments[start:start+len(word)]]
        require(all(W+key in s and (s[W+key].get(W+'val','1') not in ('0','false','off') if value is None else s[W+key].get(W+'val')==value) for s in props),'STYLE_INLINE_'+word)
        if word=='font':require(all(s.get(W+'rFonts',{}).get(W+'ascii')=='Arial' and s.get(W+'rFonts',{}).get(W+'hAnsi')=='Arial' for s in props),'STYLE_FONT')
        proof[word]=value or True
    number3=cascade.number(by['[ordered-3] First numbered item.']);number4=cascade.number(by['[ordered-4] Second numbered item.'])
    require(number3==number4 and number3[1:]==(0,'decimal',3),'STYLE_NUMBER_START');proof['ordered']=[3,4]
    for text,level in [('[nested-bullet] Nested bullet item.',1),('[bullet-1] First bullet item.',0),('[bullet-2] Second bullet item.',0)]:require(cascade.number(by[text])[1:3]==(level,'bullet'),'STYLE_BULLET')
    quote,_=cascade.paragraph(by['[quote] Authored quotation.']);require(quote.get(W+'ind',{}).get(W+'left')=='720','STYLE_QUOTE')
    require(cascade.paragraph(by['[quote] Authored quotation.'])[1]=='YalkenBlockquote1','STYLE_QUOTE_ROLE')
    code=by['[code] const answer = 42;'];pr,_=cascade.paragraph(code);require(pr.get(W+'shd',{}).get(W+'fill')=='F3F4F6','STYLE_CODE_SHADE')
    require(all(cascade.run(code,r).get(W+'rFonts',{}).get(W+'ascii')=='Menlo' and cascade.run(code,r).get(W+'sz',{}).get(W+'val')=='20' for r in code.findall(W+'r') if v.visible(r)),'STYLE_CODE_CASCADE')
    proof.update(code={'font':'Menlo','points':10,'fill':'F3F4F6'},bullets=[1,0,0],quoteIndent=720)
    return {'semanticStyleSha256':digest(canonical(proof)),'declaredStyles':proof,'stylePartsSha256':{n:digest(b) for n,b in parts.items() if n in ['word/styles.xml','word/numbering.xml']}}

def expected_ids(volume,count):
    if volume=='SINGLE_SCENE':return ['roman/01_scene-01.txt']
    per=1 if volume=='MULTI_SCENE' else 7
    return [f'roman/01_part-01/{i//per+1:02d}_chapter-{i//per+1:02d}/{i%per+1:02d}_scene-{i+1:02d}.txt' for i in range(count)]

def bookmark_partition(document,round_id,ids,docs):
    ps=document.findall(W+'body/'+W+'p');expected=[]
    for ident,doc in zip(ids,docs):
        for i in range(len(paragraphs(doc))):expected.append('YRTK_'+digest(b'word-bookmark-v1'+canonical({'roundBlockOccurrenceId':str(i),'roundId':round_id,'sceneId':ident}))[:32])
    actual=[];used_ids=set()
    for p in ps:
        starts=[n for n in p.findall(W+'bookmarkStart') if n.get(W+'name','').startswith('YRTK_')];require(len(starts)==1,'STRUCTURE_ONE_BOOKMARK_PER_BLOCK');start=starts[0];ident=start.get(W+'id');require(ident not in used_ids,'STRUCTURE_BOOKMARK_ID');used_ids.add(ident)
        ends=[n for n in p.findall(W+'bookmarkEnd') if n.get(W+'id')==ident];require(len(ends)==1,'STRUCTURE_BOOKMARK_END')
        begin,finish=list(p).index(start),list(p).index(ends[0])
        require(begin<finish and ''.join(v.visible(n) for n in list(p)[begin+1:finish])==v.visible(p),'STRUCTURE_BOOKMARK_FULL_RANGE')
        actual.append(start.get(W+'name'))
    require(actual==expected,'STRUCTURE_BOOKMARK_PARTITIONS');return digest(canonical(actual))

def replace_part(original,name,data):
    out=io.BytesIO()
    with zipfile.ZipFile(io.BytesIO(original)) as src,zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as dst:
        for n in src.namelist():dst.writestr(n,data if n==name else src.read(n))
    return out.getvalue()

def controls(source,volume,route,ids,round_id):
    ps,parts,template=docx(source);docs=expected_docs(volume,route);expected=sum([paragraphs(d) for d in docs],[]);exact(ps,expected,'CONTROL_IDENTITY');results=[]
    # A run split preserves both exact text and inherited style semantics.
    d=copy.deepcopy(template);p=d.find(W+'body/'+W+'p');r=next(r for r in p.findall(W+'r') if r.find(W+'t') is not None);t=r.find(W+'t');clone=copy.deepcopy(r);original=t.text;t.text=original[:5];clone.find(W+'t').text=original[5:];p.insert(list(p).index(r)+1,clone)
    b=replace_part(source,'word/document.xml',ET.tostring(d,encoding='utf-8'));exact(docx(b)[0],expected,'CONTROL_SPLIT_RUN')
    assert_docx_styles(docx(b)[1],docx(b)[2])
    for name in TEXT_CONTROLS:
        d=copy.deepcopy(template);body=d.find(W+'body');ps=body.findall(W+'p')
        if name=='swap-paragraphs':body.remove(ps[0]);body.insert(1,ps[0])
        elif name=='delete-empty':body.remove(next(p for p in ps if v.visible(p)==''))
        elif name=='trim-spaces':
            for n in d.iter(W+'t'):
                if 'whitespaceEdgesPreserved' in (n.text or ''):n.text=n.text.strip()
        elif name=='corrupt-unicode':
            for n in d.iter(W+'t'):
                if 'Café' in (n.text or ''):n.text=n.text.replace('Café','Cafe')
        elif name=='drop-final-paragraph':body.remove(ps[-1])
        elif name=='duplicate-paragraph':body.insert(1,copy.deepcopy(ps[0]))
        elif name=='swap-scenes':
            size=len(paragraphs(docs[0])) if len(docs)>1 else 2;first=ps[:size]
            for p in first:body.remove(p)
            for p in first:body.insert(len(body)-1,p)
        elif name=='truncate-half':
            for p in ps[len(ps)//2:]:body.remove(p)
        elif name=='corrupt-last-scene':next(n for n in reversed(list(d.iter(W+'t'))) if n.text).text+='x'
        elif name=='normalize-nfd':
            for n in d.iter(W+'t'):n.text=unicodedata.normalize('NFC',n.text or '')
        elif name=='remove-bidi-isolate':
            for n in d.iter(W+'t'):n.text=(n.text or '').replace('\u2067','')
        elif name=='remove-ime-character':
            for n in d.iter(W+'t'):
                if (n.text or '').startswith('[ime]'):n.text=n.text.replace('語','')
        b=replace_part(source,'word/document.xml',ET.tostring(d,encoding='utf-8'));rejected=False
        try:exact(docx(b)[0],expected,'CONTROL_'+name)
        except ValueError:rejected=True
        require(rejected,'FALSE_GREEN_'+name);results.append({'id':name,'rejected':True,'sha256':digest(b)})
    style_results=[]
    for name in STYLE_CONTROLS:
        d=copy.deepcopy(template);part_name='word/document.xml';root=d
        if name=='remove-bold':
            for r in d.iter(W+'r'):
                if v.visible(r)=='bold':r.remove(r.find(W+'rPr'))
        elif name=='change-align':next(p for p in d.iter(W+'p') if v.visible(p).startswith('[align-center]')).find(W+'pPr/'+W+'jc').set(W+'val','right')
        elif name=='change-heading':next(p for p in d.iter(W+'p') if v.visible(p).startswith('[heading-1]')).find(W+'pPr/'+W+'outlineLvl').set(W+'val','5')
        elif name=='change-font':next(r for r in d.iter(W+'r') if v.visible(r)=='font').find(W+'rPr/'+W+'rFonts').set(W+'ascii','Courier New')
        elif name=='change-number-start':
            part_name='word/numbering.xml';root=ET.fromstring(parts[part_name]);next(l for l in root.iter(W+'lvl') if l.find(W+'numFmt').get(W+'val')=='decimal').find(W+'start').set(W+'val','1')
        elif name in ['remove-code-style','remove-quote-style']:
            part_name='word/styles.xml';root=ET.fromstring(parts[part_name]);ident='YalkenCodeBlock' if name=='remove-code-style' else 'YalkenBlockquote1';root.remove(next(n for n in root if n.get(W+'styleId')==ident))
        b=replace_part(source,part_name,ET.tostring(root,encoding='utf-8'));rejected=False
        try:
            actual,mp,md=docx(b);exact(actual,expected,'STYLE_CONTROL_TEXT');assert_docx_styles(mp,md)
        except (ValueError,KeyError):rejected=True
        require(rejected,'FALSE_GREEN_'+name);style_results.append({'id':name,'rejected':True,'sha256':digest(b)})
    structural=[]
    if volume!='SINGLE_SCENE':
        for name in STRUCTURE_CONTROLS[:3]:
            d=copy.deepcopy(template);ps=d.find(W+'body').findall(W+'p')
            if name=='remove-bookmark':ps[0].remove(ps[0].find(W+'bookmarkStart'))
            elif name=='duplicate-bookmark':ps[1].find(W+'bookmarkStart').set(W+'name',ps[0].find(W+'bookmarkStart').get(W+'name'))
            else:
                a=ps[0].find(W+'bookmarkStart');b=ps[len(paragraphs(docs[0]))].find(W+'bookmarkStart');one,two=a.get(W+'name'),b.get(W+'name');a.set(W+'name',two);b.set(W+'name',one)
            b=replace_part(source,'word/document.xml',ET.tostring(d,encoding='utf-8'));rejected=False
            try:bookmark_partition(docx(b)[2],round_id,ids,docs)
            except ValueError:rejected=True
            require(rejected,'FALSE_GREEN_'+name);structural.append({'id':name,'rejected':True,'sha256':digest(b)})
    return {'positiveControls':['identity','split-xml-runs'],'textMutants':results,'styleMutants':style_results,'structureMutants':structural}

GOOGLE_NATIVE_MIME='application/vnd.google-apps.document'
GOOGLE_DOCX_MIME='application/vnd.openxmlformats-officedocument.wordprocessingml.document'

def google_native_paragraphs(doc,document_id):
    require(doc.get('documentId')==document_id and isinstance(doc.get('revisionId'),str) and doc['revisionId'],'GOOGLE_NATIVE_ID_REVISION')
    tabs=doc.get('tabs');require(isinstance(tabs,list) and len(tabs)==1 and not doc.get('body'),'GOOGLE_NATIVE_TABS')
    tab=tabs[0];require(tab.get('documentId')==document_id and isinstance(tab.get('tabId'),str) and tab['tabId'] and not tab.get('parentTabId'),'GOOGLE_NATIVE_TAB_ID')
    require(not any(tab.get(k) for k in ['headers','footers','footnotes','inlineObjects','positionedObjects','suggestedDocumentStyleChanges','suggestedNamedStylesChanges']),'GOOGLE_NATIVE_UNSUPPORTED_OBJECT')
    content=tab.get('body',{}).get('content');require(isinstance(content,list) and 1<len(content)<=10000,'GOOGLE_NATIVE_BODY')
    require(set(content[0])<={'startIndex','endIndex','sectionBreak'} and content[0].get('startIndex',0)==0 and content[0].get('endIndex')==1 and isinstance(content[0].get('sectionBreak'),dict),'GOOGLE_NATIVE_INITIAL_SECTION')
    paragraphs=[];offset=1
    for block in content[1:]:
        require(set(block)=={'startIndex','endIndex','paragraph'} and block['startIndex']==offset,'GOOGLE_NATIVE_BLOCK')
        paragraph=block['paragraph'];require(set(paragraph)<={'elements','paragraphStyle','bullet','positionedObjectIds'} and not paragraph.get('positionedObjectIds'),'GOOGLE_NATIVE_PARAGRAPH')
        elements=paragraph.get('elements');require(isinstance(elements,list) and elements,'GOOGLE_NATIVE_ELEMENTS');pieces=[]
        for element in elements:
            require(set(element)=={'startIndex','endIndex','textRun'} and element['startIndex']==offset,'GOOGLE_NATIVE_RUN')
            text_run=element['textRun'];require(set(text_run)<={'content','textStyle'} and isinstance(text_run.get('content'),str),'GOOGLE_NATIVE_TEXT')
            text=text_run['content'];require(text and element['endIndex']==offset+len(text.encode('utf-16-le'))//2,'GOOGLE_NATIVE_UTF16_RANGE')
            offset=element['endIndex'];pieces.append(text)
        text=''.join(pieces);require(text.endswith('\n') and '\n' not in text[:-1] and block['endIndex']==offset,'GOOGLE_NATIVE_BOUNDARY')
        paragraphs.append(text[:-1])
    return paragraphs

def google_exchange(response,request,source,returned):
    require(request['schemaVersion']=='GOOGLE_NATIVE_REQUEST_V1' and request['sourceSha256']==digest(source) and request['profile']=='GOOGLE_NATIVE' and request['uploadMode']=='native_google_docs','GOOGLE_REQUEST_BINDING')
    require(response['schemaVersion']=='GOOGLE_NATIVE_RETURN_V1' and response['runId']==request['runId'] and response['sourceSha256']==digest(source),'GOOGLE_REPLY_BINDING')
    def ok(row):
        require(isinstance(row,dict) and row.get('response',{}).get('isError') is False,'GOOGLE_TOOL_FAILED')
        return row['response']['structuredContent']
    imp=ok(response['import']);ident=imp.get('fileId')
    require(isinstance(ident,str) and re.fullmatch('[A-Za-z0-9_-]{10,200}',ident) and imp.get('documentId')==ident and imp.get('success') is True and imp.get('converted') is True and imp.get('mimeType')==GOOGLE_NATIVE_MIME,'GOOGLE_NATIVE_IMPORT')
    require(response['import']['request']['source_file']==request['source'] and response['import']['request']['upload_mode']=='native_google_docs','GOOGLE_IMPORT_SOURCE')
    meta=ok(response['metadata']);require(response['metadata']['request']['fileId']==ident and meta.get('id')==ident and meta.get('mime_type')==GOOGLE_NATIVE_MIME,'GOOGLE_NATIVE_METADATA')
    before=ok(response['nativeBefore']);after=ok(response['nativeAfter'])
    for k in ['nativeBefore','nativeAfter']:require(response[k]['request']['document_id']==ident,'GOOGLE_READ_TARGET')
    a=google_native_paragraphs(before,ident);b=google_native_paragraphs(after,ident)
    require(before['revisionId']==after['revisionId'] and canonical(before)==canonical(after),'GOOGLE_CHANGED_DURING_EXPORT')
    exp=ok(response['export']);require(response['export']['request']=={'url':'https://docs.google.com/document/d/'+ident,'download_raw_file':True,'include_base64':True,'raw_export_mime_type':GOOGLE_DOCX_MIME},'GOOGLE_EXPORT_REQUEST')
    require(exp.get('id')==ident and exp.get('mime_type')==GOOGLE_DOCX_MIME and exp.get('file_size_bytes')==len(returned) and isinstance(exp.get('b64_string'),str),'GOOGLE_EXPORT_ID')
    require(base64.b64decode(exp['b64_string'],validate=True)==returned and base64.b64encode(returned).decode()==exp['b64_string'],'GOOGLE_RETURN_BYTES')
    cleanup=response['cleanup'];require(ok(cleanup['delete']).get('success') is True and cleanup['delete']['request']=={'url':'https://drive.google.com/file/d/'+ident+'/view'},'GOOGLE_DELETE')
    readback=cleanup['readback'];error=readback['response'];require(readback['request']['fileId']==ident and error.get('isError') is True and error.get('structuredContent',{}).get('error_code')=='NOT_FOUND' and ident in error['structuredContent'].get('error',''),'GOOGLE_DELETE_READBACK')
    return a,b,{'documentId':ident,'revisionId':before['revisionId'],'sourceSha256':digest(source),'returnedSha256':digest(returned),'nativeBodySha256':digest(canonical(a)),'cleanupVerified':True,'transport':'DIRECT_LOCAL_PATH_NATIVE_CONVERSION_V2','providerLocale':{'mode':'CONTENT_API_NO_PROVIDER_UI_SESSION','sourceLocaleBoundSeparately':True,'normalization':'LITERAL_CODEPOINTS_NO_NORMALIZATION'}}

GOOGLE_CONTROLS=['wrong-source-binding','non-native-mime','mixed-document-id','changed-revision','missing-cleanup','missing-tab','coherent-native-text-loss','returned-byte-substitution']
def google_controls(response,request,source,returned,expected):
    out=[]
    for name in GOOGLE_CONTROLS:
        changed=copy.deepcopy(response);candidate=returned
        if name=='wrong-source-binding':changed['sourceSha256']='0'*64
        elif name=='non-native-mime':changed['metadata']['response']['structuredContent']['mime_type']=GOOGLE_DOCX_MIME
        elif name=='mixed-document-id':changed['nativeBefore']['response']['structuredContent']['documentId']='different-document'
        elif name=='changed-revision':changed['nativeAfter']['response']['structuredContent']['revisionId']+='different'
        elif name=='missing-cleanup':changed['cleanup']['delete']['response']['structuredContent']['success']=False
        elif name=='missing-tab':
            for side in ['nativeBefore','nativeAfter']:changed[side]['response']['structuredContent']['tabs']=[]
        elif name=='coherent-native-text-loss':
            for side in ['nativeBefore','nativeAfter']:
                run=changed[side]['response']['structuredContent']['tabs'][0]['body']['content'][1]['paragraph']['elements'][0]['textRun'];run['content']='X'+run['content'][1:]
        else:candidate=returned[:-1]+bytes([returned[-1]^1])
        rejected=False
        try:
            a,b,_=google_exchange(changed,request,source,candidate);exact(a,expected,'GOOGLE_CONTROL_BEFORE');exact(b,expected,'GOOGLE_CONTROL_AFTER')
        except (ValueError,KeyError,TypeError):rejected=True
        require(rejected,'FALSE_GREEN_GOOGLE_'+name);out.append({'id':name,'rejected':True,'sha256':digest(canonical([changed,digest(candidate)]))})
    return out

def audit(request):
    started=time.perf_counter();root=Path(request['root']);require(root.is_absolute() and root.resolve()==root and root.is_dir(),'MANUSCRIPT_RAW_ROOT')
    run=request['runId'];m=re.fullmatch(r'ORDER__(SINGLE_SCENE|MULTI_SCENE|FULL_SYNTHETIC_NOVEL|LARGE_DOCUMENT)__(C[1235])__(SOURCE_RUNTIME|PACKAGED_BUILD_RUNTIME)__[A-Za-z0-9_-]{1,80}',run)
    require(m is not None,'MANUSCRIPT_RUN_ID');volume,route,profile=m.groups();fields(volume,route);generic=route in ['C1','C5'];head,tree=request['productHead'],request['productTree']
    require(all(re.fullmatch('[a-f0-9]{40}',s) for s in (head,tree)),'MANUSCRIPT_HEAD_TREE')
    prefix='runs/'+run+'/';bindings=request['files']
    require(isinstance(bindings,list) and 0<len(bindings)<=2048 and len({b['path'] for b in bindings})==len(bindings),'MANUSCRIPT_INVENTORY')
    require(all(b['path'].startswith(prefix) for b in bindings) and sum(b['bytes'] for b in bindings)<=384*1024*1024,'MANUSCRIPT_INVENTORY_BOUND')
    files={b['path']:v.checked_read(root,b) for b in bindings};raw=lambda name:files[prefix+name];read=lambda name:json.loads(raw(name))
    obs=read('observation.json');require((obs['runId'],obs['cellId'],obs['field'],obs['volume'],obs['route'],obs['profile'])==(run,run.rsplit('__',1)[0],'ORDER',volume,route,profile),'MANUSCRIPT_OBSERVATION')
    require(obs['manuscriptProofVersion']=='WORD_MANUSCRIPT_NATIVE_V1' and obs['status']=='PASS' and (request.get('diagnosticOnly') is True or obs['candidateDiagnosticOnly'] is False),'MANUSCRIPT_CANDIDATE')
    require(obs['candidateOverlay']=={'id':'baseline','changed':False} and (obs['yalkenShadowHead'],obs['yalkenShadowTree'])==(head,tree),'MANUSCRIPT_ACTUAL_SOURCE')
    rt=obs['yalkenShadowRuntime'];require(rt['headBefore']==rt['headAfter']==head and rt['treeBefore']==rt['treeAfter']==tree and rt['statusBefore']==rt['statusAfter']=='','MANUSCRIPT_CLEAN_RUNTIME')
    snap=read('runtime-project-snapshot.json');descriptors=obs['artifacts']+snap['files']
    require(len({b['path'] for b in descriptors})==len(descriptors) and set(files)=={b['path'] for b in descriptors}|{prefix+'observation.json'},'MANUSCRIPT_EXACT_FILES')
    for b in descriptors:require(len(files[b['path']])==b['bytes'] and digest(files[b['path']])==b['sha256'],'MANUSCRIPT_DESCRIPTOR')
    provider=read('provider-identity.json');require(provider==obs['provider'] and all(provider.get(k)==v for k,v in request['qualifiedProvider'].items()),'MANUSCRIPT_PROVIDER')
    require(obs['providerExecution']=={'requested':'Google Docs Native and terminal Microsoft Word' if route=='C5' else 'Microsoft Word','executed':True},'MANUSCRIPT_PROVIDER_EXECUTION')
    build=read('runtime-build.json');cp,tc=build['runtimeAppCopyProof'],build['toolchain']
    require((build['shadowHead'],build['shadowTree'])==(head,tree) and build['build']['status']==0,'MANUSCRIPT_BUILD')
    require(cp['ok'] is True and cp['sourceFileCount']==cp['copyFileCount']>0 and cp['sourceDigest']==cp['copyDigest'] and re.fullmatch('[a-f0-9]{64}',cp['sourceDigest']) and cp['failures']==[],'MANUSCRIPT_COPY')
    require(cp['excluded']==['.git','node_modules','dist','/docs/**','/test/'] and cp['included']==['/docs/OPS/STATUS/**'],'MANUSCRIPT_COPY_SCOPE')
    require(tc['compatibleWithShadowManifests'] is True and tc['shadowPackageJsonSha256']==tc['dependencyPackageJsonSha256']==request['packageJsonSha256'] and tc['shadowPackageLockSha256']==tc['dependencyPackageLockSha256']==request['packageLockSha256'] and tc['electronPackageVersion']==request['electronVersion'],'MANUSCRIPT_TOOLCHAIN')
    if profile=='PACKAGED_BUILD_RUNTIME':
        pkg=build['packagedBuild'];proof=pkg['proof'];require(pkg['built'] is True and pkg['build']['status']==0 and proof['ok'] is True and proof['failures']==[],'MANUSCRIPT_PACKAGED_BUILD')
        for key,suffix in [('executableProof','/Contents/MacOS/Yalken'),('appAsarProof','/Contents/Resources/app.asar'),('infoPlistProof','/Contents/Info.plist')]:
            p=proof[key];require(p['exists'] is True and p['bytes']>0 and re.fullmatch('[a-f0-9]{64}',p['sha256']) and p['path'].endswith(suffix),'MANUSCRIPT_PACKAGE_ARTIFACT')
        require(proof['executableProof']['sha256']==tc['electronBinarySha256'],'MANUSCRIPT_PACKAGE_EXECUTABLE')
    else:require(build['packagedBuild'] is None,'MANUSCRIPT_SOURCE_PROFILE')
    cycles=5 if route=='C3' else 1;final_round=0 if generic else cycles
    docs=expected_docs(volume,route);expected=sum([paragraphs(d) for d in docs],[]);stages={};style_stages={};structure_stages={};font_ledger=[];identifier_stages={};locator_stages={};identifier_intakes=[];identifier_negative=[]
    def stage(name,ps,round=0):
        es=sum([paragraphs(d) for d in expected_docs(volume,route,round)],[])
        stages[name]={**exact(ps,es,name),'round':round,'sortKeysSha256':digest(canonical([[i,digest(p.encode())] for i,p in enumerate(ps)]))}
    def font_check(value,label):
        ff=value.get('fonts',[]);require(isinstance(ff,list) and ff and all(isinstance(f.get('familyName'),str) and isinstance(f.get('postScriptName'),str) and type(f.get('glyphCount')) is int and f['glyphCount']>=0 for f in ff) and sum(f['glyphCount'] for f in ff)>0,'FONT_PLATFORM_READBACK')
        require('Chromium' in value.get('scope',''),'FONT_FALLBACK_DECLARATION');font_ledger.append({'stage':label,'fonts':ff,'scope':value['scope']})
    def renderer(s,doc,label,check_styles=True):
        exact(s['renderer']['paragraphs'],paragraphs(doc),label);require(s['open']['ok'] is True and s['open']['documentId']==s['nodeId'],'DOCUMENT_OPEN_ID');font_check(s['fonts'],label)
        if check_styles and any(p.startswith('[inline]') for p in paragraphs(doc)):
            probes={p['text']:p for p in s['renderer']['probes']}
            for i in range(1,7):require(probes[f'[heading-{i}] Authored heading.']['tag']=='H'+str(i),'RENDERER_HEADING')
            for a in ['left','center','right','justify']:require(probes[f'[align-{a}] Authored paragraph alignment.']['align']==a,'RENDERER_ALIGNMENT')
            require(probes['[quote] Authored quotation.']['blockquoteDepth']==1 and probes['[code] const answer = 42;']['tag']=='PRE','RENDERER_BLOCK_STYLES')
            inline=probes['[inline] bold italic underline strike color highlight font']['runs'];by={r['text']:r for r in inline}
            require(float(by['bold']['fontWeight'])>float(by['[inline] ']['fontWeight']) and by['italic']['fontStyle']=='italic','RENDERER_BOLD_ITALIC')
            require('underline' in by['underline']['textDecorationLine'] and 'line-through' in by['strike']['textDecorationLine'],'RENDERER_DECORATION')
            require(by['color']['color']=='rgb(18, 52, 86)' and by['highlight']['backgroundColor']=='rgb(255, 255, 0)','RENDERER_COLORS')
            require(by['font']['fontFamily']=='Arial' and abs(float(by['font']['fontSize'].removesuffix('px'))-14*4/3)<0.01,'RENDERER_FONT')
    source=read('source.json');src=source['scenes'];count=len(docs);ids=expected_ids(volume,count);nodes=[s['nodeId'] for s in src]
    require(len(src)==count and [s['sceneId'] for s in src]==ids and len(set(nodes))==count and all(nodes),'SCENE_IDENTITIES')
    project=read('source-project.json');pid=project['projectId'];registry=project['treeIdentity']['nodes'];by_binding={r['bindingKey']:n for n,r in registry.items() if r.get('present') is not False}
    require([by_binding['file:'+s] for s in ids]==nodes,'PROJECT_SCENE_REGISTRY')
    def tree_check(value,label):
        require(value['ok'] is True and value['projectId']==pid,'TREE_PROJECT')
        observed=[]
        def visit(n,anc):
            if n['nodeId'] in nodes:observed.append((n['nodeId'],n['kind'],n['name'],[(a['nodeId'],a['kind'],a['name']) for a in anc if a['kind'] in ['part','chapter-folder']]))
            for c in n.get('children',[]):visit(c,anc+[n])
        visit(value['root'],[]);wanted=[]
        for i,ident in enumerate(ids):
            parts=ident.split('/');anc=[]
            for j in range(1,len(parts)-1):
                name=parts[j];binding='file:'+'/'.join(parts[:j+1]);node=by_binding[binding];kind=registry[node]['kind'];require(kind==('part' if j==1 else 'chapter-folder'),'HIERARCHY_KIND');anc.append((node,kind,re.sub(r'^\d+_','',name)))
            wanted.append((nodes[i],'scene','scene-'+str(i+1).zfill(2),anc))
        require(observed==wanted,'HIERARCHY_SCENE_CHAPTER_ORDER');structure_stages[label]={'hierarchySha256':digest(canonical(observed)),'sceneCount':len(observed)}
    # C1 retains its original sources during safe-create; structure is not claimed for that route.
    if not generic:tree_check(source['tree'],'source-tree')
    source_hashes=[]
    for i,(s,d) in enumerate(zip(src,docs)):
        require(s['file']==prefix+f'source-scenes/{i}.txt' and s['save']['ok'] is True,'SOURCE_SAVE_BINDING');b=files[s['file']];source_hashes.append(digest(b));require(digest(b)==s['sha256'],'SOURCE_FILE_HASH')
        actual=scene(b);exact(paragraphs(actual),paragraphs(d),'SOURCE_RAW')
        require(normalize_doc(actual)==normalize_doc(d),'SOURCE_RICH_DOCUMENT')
        renderer(s,d,'source-renderer-'+str(i))
    stage('source',sum([paragraphs(scene(files[s['file']])) for s in src],[]));stage('source-renderer',sum([s['renderer']['paragraphs'] for s in src],[]))
    boot=read('boot.json');locale=boot['locale'];require(boot['profile']==profile and locale['language'] in locale['languages'] and locale['intl']['locale'] and locale['intl']['timeZone'] and 'Electron/' in locale['userAgent'] and provider['locale'] and provider['languages'],'LOCALE_BINDING')
    ime=read('composition.json');events=ime['events'];require(events==read('composition-events.json') and ime['driver']=='CHROMIUM_NATIVE_COMPOSITION_PROTOCOL' and ime['save']['ok'] is True and ime['sceneId']==ids[0] and ime['committedText']=='日本語.','IME_BINDING')
    initial=[p if p!='[ime] 日本語.' else '[ime] ' for p in paragraphs(docs[0])];exact(ime['afterCancel']['paragraphs'],initial,'IME_CANCEL');exact(ime['afterCommit']['paragraphs'],paragraphs(docs[0]),'IME_COMMIT')
    require(all(e['isTrusted'] is True for e in events if e['type']!='compositionend'),'IME_TRUSTED_INPUT')
    require(all(any(e['type']==typ and e['data']==data for e in events) for typ,data in [('compositionupdate','取消'),('compositionupdate','にほんご'),('compositionupdate','日本語')]),'IME_CANDIDATE_SEQUENCE')
    require(sum(e['type']=='compositionstart' for e in events)>=2 and sum(e['type']=='compositionend' for e in events)>=2 and any(e['type']=='input' and e['inputType']=='insertText' and e['isComposing'] is False and e['data']=='.' for e in events),'IME_COMMIT_END')
    stage('composition',sum([ime['afterCommit']['paragraphs']]+[paragraphs(d) for d in docs[1:]],[]))
    export_ids=set();previous_hashes=source_hashes;round_proofs=[];review_rounds=[];review_probe=None
    comment_stages={};comment_queries={};comment_negative=[];comment_loss=None;comment_state_sha=None
    expected_comments=comment_expected(volume,route,pid,ids[0]) if not generic else None
    def comment_query(name):
        value=read(name+'.json');b=raw(name+'-state.json');p=value['result']['rtkNonTextReturnState']
        require(value['file']==prefix+name+'-state.json' and digest(b)==value['sha256']==comment_state_sha
                and json.loads(b)==expected_comments and value['result']['ok'] is True,'COMMENT_CANONICAL_BYTES')
        require(p['projectId']==pid and p['present'] is True and p['stateSha256']==comment_state_sha
                and p['revision']==1 and p['threadCount']==3 and p['openRootCommentCount']==1,'COMMENT_PRODUCT_QUERY')
        require(len(p['threads'])==3,'COMMENT_QUERY_COUNT')
        for actual,wanted in zip(p['threads'],expected_comments['threads']):
            require(all(actual[k]==wanted[k] for k in ['threadId','sceneId','rootCommentId','status','messages'])
                and actual['rootBody']==wanted['messages'][0]['body']
                and actual['rootBodySha256']==digest(wanted['messages'][0]['body'].encode())
                and all(actual['anchor'][k]==wanted['anchor'][k] for k in ['sceneId','blockId','paragraphIndex','selectedText','selectedTextSha256','authoritySource']),'COMMENT_QUERY_LITERAL_FIELDS')
        comment_queries[name]={'rawStateSha256':digest(b),'querySha256':digest(raw(name+'.json'))}
    if not generic:
        comment_state_sha=digest(raw('source-comments-state.json'));comment_query('source-comments')
        require(read('comment-origin.json')=={'kind':'OWNED_SAVED_PROJECT_FIXTURE','canonicalApplyClaim':False,'sourceSha256':comment_state_sha},'COMMENT_SOURCE_AUTHORITY')
    def comment_doc(name,parts,document,data):
        proof=comment_parts(parts,document,expected_comments)
        comment_stages[name]={**proof,'artifactSha256':digest(data)}
    def export_check(name,filename,round,hashes):
        x=read(name+'.json');r=x['result'];cap=r['exportCapsule'];b=raw(filename)
        require(x['before']==x['after']==hashes and r['ok'] is True and r['exported'] is True and r['commandId']=='cmd.project.review.exportFullManuscriptDocxReviewPacket' and r['bytesWritten']==len(b) and x['sha256']==digest(b),'EXPORT_COMMAND_HASH_CHAIN')
        require(cap['projectId']==pid and cap['scope']=='full-manuscript' and cap['orderedSceneIds']==ids and cap['sceneCount']==count and cap['blockCount']==len(expected),'EXPORT_CAPSULE')
        require(cap['exportId'] not in export_ids and cap['roundId'].startswith('round-'),'EXPORT_FRESH_ROUND');export_ids.add(cap['exportId'])
        require(r['publicationGate']['ok'] is True and r['publicationGate']['finalArtifactSha256']=='sha256:'+digest(b) and r['canAutoApply'] is False and r['canImportMutate'] is False,'EXPORT_AUTHORITY')
        ps,parts,doc=docx(b);stage(name+'-docx',ps,round)
        if not generic:
            comment_doc(name,parts,doc,b)
            require(cap['commentSummary']=={'stateRevision':1,'exportedThreadCount':2,'exportedMessageCount':4,'intentionalDeletionCount':1}
                    and r['publicationGate']['commentPreservationVerified'] is True and r['publicationGate']['intentionalDeletionCount']==1,'COMMENT_EXPORT_PUBLICATION')
        # Bind physical bookmark partitions to each separately saved scene.
        structure_stages[name]={'bookmarkSha256':bookmark_partition(doc,cap['roundId'],ids,expected_docs(volume,route,round))}
        style_stages[name]=assert_docx_styles(parts,doc)
        custom=ET.fromstring(parts['docProps/custom.xml']);properties={n.get('name'):re.sub(r'_x([0-9a-fA-F]{4})_',lambda m:chr(int(m[1],16)),n[0].text or '') for n in custom}
        token=properties['YRTK_C01_AUTH'];require(token.startswith('YRTK1.'),'AUTHORITY_CARRIER');encoded=token[6:];payload=json.loads(base64.urlsafe_b64decode(encoded+'='*((-len(encoded))%4)))['payload']
        require(payload['projectId']==pid and payload['orderedSceneIds']==ids and [s['sceneId'] for s in payload['sceneRevisions']]==ids and [s['rawSha256'] for s in payload['sceneRevisions']]==['sha256:'+h for h in hashes] and payload['roundId']==cap['roundId'],'EXPORTED_RAW_SCENE_PARTITION')
        if not generic:
            data=raw(name+'-authority-store.json')
            require(x['authorityStoreFile']==prefix+name+'-authority-store.json' and x['authorityStoreSha256']==digest(data),'LOCATOR_STORE_FILE')
            locator_stages[name]=locator_store(data,r['activation'],cap,ids,expected_docs(volume,route,round),hashes)
            identifier_stages[name]={**identifier_doc(parts,doc,cap['roundId'],ids,expected_docs(volume,route,round)),'artifactSha256':digest(b),'roundId':cap['roundId']}
        return cap
    def word_check(name,source_file,returned_file,directory,round,tracked,cap):
        life=read(name+'.json');require(life['status']=='PASS' and life['process']['status']==life['compileProcess']['status']==0 and life['cleanupOk'] is True,'WORD_LIFECYCLE')
        require(life['sourceDocxHash']==life['preOpenHash']==digest(raw(source_file)) and life['postWordHash']==life['copiedBackHash']==digest(raw(returned_file)),'WORD_HASH_CHAIN')
        lines=life['process']['stdout'].splitlines()
        for k,val in [('WORD_STATUS','PASS'),('DOCUMENTS_BEFORE','0'),('DOCUMENTS_AFTER','0'),('REVISION_COUNT','2' if tracked else '0'),('COMMENT_COUNT','0' if generic else '4'),('SCREENSHOT_STATUS','PASS')]:require([line for line in lines if line.startswith(k+'=')]==[k+'='+val],'WORD_'+k)
        require(life['screenshotProof']['ok'] is True and raw(directory+'/word.png').startswith(b'\x89PNG\r\n\x1a\n'),'WORD_SCREENSHOT')
        require(life['nativeReadbackPath'].endswith('/'+run+'/'+directory+'/word-native-readback.txt') and life['evidencePath'].endswith('/'+run+'/'+returned_file),'WORD_FILE_BINDING')
        stage(name+'-native',v.native(raw(directory+'/word-native-readback.txt')),round)
        ps,parts,d=docx(raw(returned_file),round if tracked else 0);stage(name+'-docx',ps,round)
        if not generic:comment_doc(name,parts,d,raw(returned_file))
        if cap is not None:structure_stages[name]={'bookmarkSha256':bookmark_partition(d,cap['roundId'],ids,expected_docs(volume,route,round))}
        else:require(generic and name=='final-word-lifecycle','WORD_UNAUTHENTICATED_SCOPE')
        if not generic:
            identifier_stages[name]={**identifier_doc(parts,d,cap['roundId'],ids,expected_docs(volume,route,round)),'artifactSha256':digest(raw(returned_file)),'roundId':cap['roundId']}
        if route!='C5':style_stages[name]=assert_docx_styles(parts,d)
    google_proof=None
    for ordinal in range(1,cycles+1):
        base=f'rounds/{ordinal}';before_round=ordinal-1 if not generic else 0;after_round=ordinal if not generic else 0
        cap=export_check(base+'/export',base+'/source.docx',before_round,previous_hashes)
        if route=='C5':
            response=read('google-response.json');request=read('google-request.json');require(request['runId']==run and request['source'].endswith('/'+run+'/'+base+'/source.docx'),'GOOGLE_RUN_SOURCE_PATH')
            before,after,google_proof=google_exchange(response,request,raw(base+'/source.docx'),raw(base+'/returned.docx'))
            stage(base+'/google-native-before',before);stage(base+'/google-native-after',after)
            returned_ps,returned_parts,returned_document=docx(raw(base+'/returned.docx'),google=True);stage(base+'/google-docx',returned_ps)
            life=read(base+'/google.json');require(life['status']=='PASS' and life['admissionCredit']==0 and life['cleanupOk'] is True and life['sourceSha256']==google_proof['sourceSha256'] and life['returnedSha256']==google_proof['returnedSha256'] and life['documentId']==google_proof['documentId'] and life['revisionId']==google_proof['revisionId'] and life['rawResponseSha256']==digest(raw('google-response.json')),'GOOGLE_NATIVE_HASH_CHAIN')
            google_proof['rawResponseSha256']=life['rawResponseSha256']
            google_proof['negativeControls']=google_controls(response,request,raw(base+'/source.docx'),raw(base+'/returned.docx'),expected)
            # Bound and report unclaimed provider transformations; never award STYLES or anchor credit.
            source_document=docx(raw(base+'/source.docx'))[2]
            src_names=[n.get(W+'name') for n in source_document.iter(W+'bookmarkStart')];ret_names=[n.get(W+'name') for n in returned_document.iter(W+'bookmarkStart')]
            cascade=StyleCascade(returned_parts);heading_changes=[]
            for i,p in enumerate(returned_document.find(W+'body').findall(W+'p')):
                text=v.visible(p);match=re.match(r'^\[heading-([1-6])\]',text)
                if match:
                    props=cascade.paragraph(p)[0];level=props.get(W+'outlineLvl',{}).get(W+'val');actual=int(level)+1 if level is not None and level.isdecimal() else None
                    if actual!=int(match[1]):heading_changes.append({'paragraph':i,'expected':int(match[1]),'returned':actual})
            google_proof['unclaimedFieldLedger']={'headingChanges':heading_changes,'bookmarkNamesChanged':src_names!=ret_names,'sourceBookmarkNamesSha256':digest(canonical(src_names)),'returnedBookmarkNamesSha256':digest(canonical(ret_names)),'notAdmitted':['STYLES','NOVEL_SCENE_STRUCTURE','IDENTIFIERS_ANCHORS'],'scope':'Literal text, order and Unicode only. Full returned style and metadata parts remain bound by the raw DOCX hash.'}
        else:word_check(base+'/word',base+'/source.docx',base+'/returned.docx',base+'/word',after_round,route!='C1',cap)
        done=read(base+'/round.json');require(done=={'ordinal':ordinal,'reviewedOrdinal':after_round,'requiredCycles':cycles,'complete':True,'admissionCredit':0},'ROUND_COUNT')
        if not generic:
            x=read(base+'/intake.json');r=x['result'];a=r['returnIntake'];require(x['before']==x['after']==previous_hashes and r['ok'] is True and r['commandId']=='cmd.project.review.activateDocxReviewPreviewSession','INTAKE_NO_WRITE')
            cp=r['commentProductPath']
            require(cp['ok'] is True and cp['status']=='unchanged' and cp['code']=='RTK_COMMENT_REEXPORT_RETURN_UNCHANGED'
                    and cp['writerCalled'] is False and cp['applyReceipts']==cp['replayReceipts']==[]
                    and cp['baselineReadback']=={'ok':True,'unchangedThreadIds':['manuscript-comment-open','manuscript-comment-resolved'],'missing':[],'changed':[]},'COMMENT_NO_DUPLICATE_APPLY')
            require(a['authenticated'] is True and a['returnedArtifactSha256']=='sha256:'+digest(raw(base+'/returned.docx')) and a['roundId']==cap['roundId'] and a['exportId']==cap['exportId'] and all(a['authority'].get(k) is True for k in ['validSignedLocator','sceneRevisionUnchanged','rawSha256Unchanged','baselineBound']),'RETURN_AUTHORITY')
            require(all(r[k] is False for k in ['canAutoApply','canImportMutate','canWriteStorage']),'INTAKE_NO_MUTATION_AUTHORITY')
            changes=r['reviewSurface']['revisionSession']['reviewGraph']['textChanges'];require(len(changes)==1 and changes[0]['match']['quote']==('sentinel alpha' if ordinal==1 else 'sentinel round'+str(ordinal-1)) and changes[0]['replacementText']=='sentinel round'+str(ordinal),'EXACT_ROUND_CHANGE')
            reviewed_document=docx(raw(base+'/returned.docx'),ordinal)[2]
            review_rounds.append({'ordinal':ordinal,'returnedSha256':digest(raw(base+'/returned.docx')),**review_revision_proof(reviewed_document,x,ordinal)})
            if ordinal==1:
                source_doc=docx(raw(base+'/source.docx'))[2]
                identifier_negative=identifier_controls(raw(base+'/source.docx'),cap['roundId'],ids,expected_docs(volume,route))
                original=docx(raw(base+'/returned.docx'),1);original_starts=[n.get(W+'name') for n in original[2].findall('.//'+W+'bookmarkStart')]
                for kind in ['identity','missing-bookmark','duplicate-bookmark']:
                    control=read(base+'/identifier-'+kind+'-intake.json');mutant=raw(base+'/identifiers-'+kind+'.docx');mps,mparts,mdoc=docx(mutant,1)
                    require(control==read(base+'/identifier-'+kind+'-intake-observed.json') and control['kind']==kind and control['sourceSha256']==digest(raw(base+'/returned.docx')) and control['mutantSha256']==digest(mutant),'IDENTIFIER_CONTROL_BYTES')
                    require(mps==original[0] and raw_links(mparts,mdoc)==raw_links(original[1],original[2]),'IDENTIFIER_CONTROL_TEXT_UNCHANGED')
                    names=[n.get(W+'name') for n in mdoc.findall('.//'+W+'bookmarkStart')]
                    wanted=original_starts[:] if kind=='identity' else original_starts[1:] if kind=='missing-bookmark' else [original_starts[0],original_starts[0]]+original_starts[2:]
                    require(names==wanted,'IDENTIFIER_INDEPENDENT_CORRUPTION')
                    before=control['before'];result=control['result']
                    require(before==control['after'] and before['sceneHashes']==source_hashes and before['commentStateSha256']==comment_state_sha and re.fullmatch('[a-f0-9]{64}',before['manifestSha256']),'IDENTIFIER_CONTROL_NO_WRITE')
                    require(all(result.get(k) is not True for k in ['canAutoApply','canImportMutate','canWriteStorage']),'IDENTIFIER_CONTROL_NO_AUTHORITY')
                    require(result['ok'] is True and result['returnIntake']['authenticated'] is True and result['returnIntake']['returnedArtifactSha256']=='sha256:'+digest(mutant),'IDENTIFIER_AUTHENTICATED_PREVIEW')
                    graph=result['reviewSurface']['revisionSession']['reviewGraph'];changes=graph['textChanges']
                    require(len(changes)==1 and changes[0]['match']['quote']=='sentinel alpha' and changes[0]['replacementText']=='sentinel round1','IDENTIFIER_CONTROL_CHANGE')
                    require(before['manifestSha256']==digest(raw(base+'/review-probe/manifest-before.json')),'IDENTIFIER_CANONICAL_MANIFEST')
                    code=None;apply_code=None;apply_hash=None
                    if kind=='identity':
                        require(changes[0]['match']['kind']=='exact' and 'applyAttempt' not in control and mparts==original[1],'IDENTIFIER_POSITIVE_CONTROL')
                    else:
                        word='missing' if kind=='missing-bookmark' else 'duplicate';code='DOCX_REVIEW_BOOKMARK_'+word.upper()
                        require(changes[0]['match']['kind']=='manual' and 'sourceAuthority' not in changes[0]
                                and any(d['diagnosticId'].startswith('docx-review-bookmark-'+word+'-') and d['relatedItemId']==original_starts[0].lower() for d in graph['diagnosticItems']),'IDENTIFIER_TYPED_LOSS')
                        attempt=control['applyAttempt'];ar=attempt['result'];error=ar.get('value',{}).get('error',{})
                        require(attempt['commandId']=='cmd.project.review.applyExactTextChangesBatch' and attempt['changeId']==changes[0]['changeId'] and attempt['after']==before
                                and ar['ok'] is False and ar.get('applied') is not True and ar['value']['ok'] is False and error.get('code')=='E_REVIEW_EXACT_TEXT_APPLY_BATCH_BLOCKED'
                                and ar['code']==ar['reason']==error.get('reason')=='REVIEW_EXACT_TEXT_APPLY_BATCH_EXACT_MATCH_REQUIRED'
                                and error['op']==attempt['commandId'] and error['details']['changeIds']==[attempt['changeId']],'IDENTIFIER_ACTUAL_APPLY_REJECTION')
                        apply_code=error['code'];apply_hash=digest(canonical(ar))
                    identifier_intakes.append({'kind':kind,'sourceSha256':control['sourceSha256'],'mutantSha256':digest(mutant),'intakeSha256':digest(raw(base+'/identifier-'+kind+'-intake.json')),'canonicalStateSha256':digest(canonical(before)),'writerCalled':False,'previewAccepted':True,'exactMatchAllowed':kind=='identity','code':code,'applyAttempted':kind!='identity','applyCode':apply_code,'applyResultSha256':apply_hash,'lostIdentifiers':[original_starts[0]] if kind=='missing-bookmark' else [],'duplicateIdentifiers':[original_starts[0]] if kind=='duplicate-bookmark' else []})
                probe_file=base+'/review-probe/returned.docx';probe=raw(probe_file);ps,parts,pdoc=docx(probe,1);exact(ps,sum([paragraphs(d) for d in expected_docs(volume,route,1)],[]),'REVIEW_PROBE_FULL_TEXT')
                lifecycle=read(base+'/review-probe-word.json');require(lifecycle['status']=='PASS' and lifecycle['cleanupOk'] is True and lifecycle['compileProcess']['status']==lifecycle['process']['status']==0,'REVIEW_PROBE_WORD_LIFECYCLE')
                require(lifecycle['sourceDocxHash']==lifecycle['preOpenHash']==digest(raw(base+'/source.docx')) and lifecycle['postWordHash']==lifecycle['copiedBackHash']==digest(probe),'REVIEW_PROBE_BYTES')
                for k,value in [('WORD_STATUS','PASS'),('DOCUMENTS_BEFORE','0'),('DOCUMENTS_AFTER','0'),('REVISION_COUNT','3'),('COMMENT_COUNT','4'),('SCREENSHOT_STATUS','PASS')]:require([line for line in lifecycle['process']['stdout'].splitlines() if line.startswith(k+'=')]==[k+'='+value],'REVIEW_PROBE_'+k)
                comment_doc(base+'/review-probe',parts,pdoc,probe)
                identifier_stages[base+'/review-probe']={**identifier_doc(parts,pdoc,cap['roundId'],ids,expected_docs(volume,route,1)),'artifactSha256':digest(probe),'roundId':cap['roundId']}
                require(lifecycle['screenshotProof']['ok'] is True and raw(base+'/review-probe/word.png').startswith(b'\x89PNG\r\n\x1a\n'),'REVIEW_PROBE_SCREENSHOT')
                exact(v.native(raw(base+'/review-probe/word-native-readback.txt')),ps,'REVIEW_PROBE_NATIVE_TEXT')
                require(lifecycle['evidencePath'].endswith('/'+run+'/'+probe_file) and lifecycle['nativeReadbackPath'].endswith('/'+run+'/'+base+'/review-probe/word-native-readback.txt'),'REVIEW_PROBE_NATIVE_PATH')
                probe_intake=read(base+'/review-probe-intake.json');pr=probe_intake['result']['returnIntake']
                require(pr['returnedArtifactSha256']=='sha256:'+digest(probe) and pr['roundId']==cap['roundId'] and pr['exportId']==cap['exportId'] and all(pr['authority'][k] is True for k in ['validSignedLocator','sceneRevisionUnchanged','rawSha256Unchanged','baselineBound']),'REVIEW_PROBE_AUTHENTICATED_RETURN')
                require(probe_intake['before']['sceneHashes']==source_hashes and probe_intake['before']['commentStateSha256']==comment_state_sha and raw(base+'/review-probe/manifest-before.json')==raw(base+'/review-probe/manifest-after.json') and probe_intake['before']['manifestSha256']==digest(raw(base+'/review-probe/manifest-before.json')),'REVIEW_PROBE_CANONICAL_NO_WRITE')
                review_probe={'returnedSha256':digest(probe),'sourceSha256':digest(raw(base+'/source.docx')),'roundId':cap['roundId'],'exportId':cap['exportId'],'negativeControls':review_controls(pdoc,probe_intake),**review_revision_proof(pdoc,probe_intake,1,True)}
                comment_negative=comment_controls(parts,pdoc,expected_comments)
                loss=read(base+'/comment-loss-intake.json');lb=raw(base+'/comments-missing.docx');lps,lparts,ldoc=docx(lb,1)
                require(lps==docx(raw(base+'/returned.docx'),1)[0] and not any(n.startswith('word/comments') for n in lparts)
                        and not any(n.tag in [W+'commentRangeStart',W+'commentRangeEnd',W+'commentReference'] for n in ldoc.iter()),'COMMENT_ACTUAL_LOSS_MUTANT')
                require(loss['kind']=='EXPLICIT_CORRUPTION_NEGATIVE_CONTROL' and loss['sourceSha256']==digest(raw(base+'/returned.docx'))
                        and loss['mutantSha256']==digest(lb) and loss['before']==loss['after']
                        and loss['before']['sceneHashes']==source_hashes and loss['before']['commentStateSha256']==comment_state_sha
                        and loss['before']['manifestSha256']==digest(raw(base+'/review-probe/manifest-before.json')),'COMMENT_LOSS_NO_WRITE')
                lr=loss['result'];li=lr['returnIntake'];lp=lr['commentProductPath']
                require(lr['ok'] is True and li['authenticated'] is True and li['returnedArtifactSha256']=='sha256:'+digest(lb)
                        and li['roundId']==cap['roundId'] and li['exportId']==cap['exportId']
                        and lp['ok'] is False and lp['status']=='blocked' and lp['writerCalled'] is False
                        and lp['code']=='RTK_COMMENT_REEXPORT_RETURN_CHANGED_OR_MISSING'
                        and lp['applyReceipts']==lp['replayReceipts']==[]
                        and lp['typedBlocked']==[{'threadId':t['threadId'],'canonicalCommentId':t['rootCommentId'],'code':'COMMENT_ROOT_MISSING'} for t in expected_comments['threads'][:2]],'COMMENT_VISIBLE_LOSS_LEDGER')
                comment_loss={'sourceSha256':loss['sourceSha256'],'mutantSha256':digest(lb),'intakeSha256':digest(raw(base+'/comment-loss-intake.json')),'canonicalStateSha256':comment_state_sha,'missing':lp['typedBlocked'],'writerCalled':False}
            ap=read(base+'/apply.json');result=ap['result'];receipt=result['result']['receipt'];require(result==read(base+'/apply-command-result.json'),'APPLY_RAW_RESULT')
            require(ap['commandId']=='cmd.project.review.applyExactTextChangesBatch' and result['ok'] is True and result['applied'] is True and result['totals']=={'requested':1,'applied':1,'blocked':0,'failed':0,'skipped':0} and ap['changeId']==changes[0]['changeId'],'EXPLICIT_APPLY')
            require(ap['before']==previous_hashes and ap['afterApply'][0]!=previous_hashes[0] and ap['afterApply'][1:]==previous_hashes[1:] and receipt['sceneId']==ids[0] and receipt['projectId']==pid and receipt['changeIds']==[ap['changeId']] and receipt['writeStatus']=='applied' and result['editorSync']['ok'] is True and ap['save']['ok'] is True,'APPLY_CANONICAL_MUTATION')
            new_docs=expected_docs(volume,route,ordinal);saved=ap['scenes'];require(len(saved)==count and [s['sceneId'] for s in saved]==ids and [s['nodeId'] for s in saved]==nodes,'APPLY_ALL_SCENES')
            hashes=[];all_ps=[]
            for i,(s,d) in enumerate(zip(saved,new_docs)):
                require(s['file']==prefix+base+f'/saved-scenes/{i}.txt','APPLY_SCENE_PATH');b=files[s['file']];actual=scene(b);require(digest(b)==s['sha256'] and normalize_doc(actual)==normalize_doc(d),'APPLY_RAW_RICH_SCENE');hashes.append(digest(b));all_ps+=paragraphs(actual)
            require(hashes==ap['afterSave'] and hashes[1:]==previous_hashes[1:],'APPLY_SAVED_HASH_CHAIN');previous_hashes=hashes;stage(base+'/persisted',all_ps,ordinal)
            renderer({**ap,'nodeId':nodes[0]},new_docs[0],base+'/applied-renderer');stage(base+'/applied-renderer',ap['renderer']['paragraphs']+sum([paragraphs(d) for d in new_docs[1:]],[]),ordinal);tree_check(ap['tree'],base+'/tree')
            comment_query(base+'/comments')
        round_proofs.append({'ordinal':ordinal,'exportId':cap['exportId'],'roundId':cap['roundId'],'exportSha256':digest(raw(base+'/source.docx')),'returnedSha256':digest(raw(base+'/returned.docx')),'savedSceneHashes':previous_hashes})
    reopened=read('reopen.json');close=read('close.json')
    require(reopened['firstPid']==boot['pid']==close['pid'] and reopened['pid']!=boot['pid'] and close['closed'] is True,'FRESH_PROCESS')
    if not generic:
        comment_query('reopened-comments')
        require(raw('reopened-comments-state.json')==raw('runtime-project-snapshot/.yalken/word-review/non-text-return-state.v1.json'),'COMMENT_FRESH_PROCESS_DURABILITY')
        require(len(reopened['scenes'])==count,'REOPEN_SCENE_COUNT');all_raw=[];all_render=[]
        for i,(s,d) in enumerate(zip(reopened['scenes'],expected_docs(volume,route,final_round))):
            require(s['sceneId']==ids[i] and s['nodeId']==nodes[i] and s['file']==prefix+f'reopened-scenes/{i}.txt','REOPEN_SCENE_BINDING')
            b=files[s['file']];require(b==raw('runtime-project-snapshot/'+ids[i]) and digest(b)==s['sha256']==previous_hashes[i],'REOPEN_DURABLE_BYTES')
            actual=scene(b);require(normalize_doc(actual)==normalize_doc(d),'REOPEN_RICH_DOCUMENT');renderer(s,d,'reopen-renderer-'+str(i));all_raw+=paragraphs(actual);all_render+=s['renderer']['paragraphs']
        stage('reopened-persisted',all_raw,final_round);stage('reopened-renderer',all_render,final_round);tree_check(reopened['tree'],'reopen-tree')
        cap_final=export_check('reexport','reexport.docx',final_round,previous_hashes)
        word_check('final-word-lifecycle','reexport.docx','final-word.docx','final-word',final_round,False,cap_final)
        # The style signature is independent of OOXML run splitting and Word style ids.
        require(len({s['semanticStyleSha256'] for s in style_stages.values()})==1,'STYLE_STAGE_CONTINUITY')
    else:
        im=read('import.json');r=im['result'];receipt=r['safeCreate']['receipt'];actual=r['importedScene'];returned='rounds/1/returned.docx'
        require(im['before']==im['after']==source_hashes and im['save']['ok'] is True and r['ok']==1 and r['safeCreate']['commandOk'] is True and r['safeCreate']['commandId']=='cmd.project.docx.importSafeCreate','C1_SAFE_CREATE')
        require(receipt['projectId']==pid and receipt['sourceArtifactSha256']==digest(raw(returned)) and receipt['candidateContentSha256']==digest(raw('imported-scene.txt')) and receipt['manifestAuthority']['durablePublication'] is True and receipt['atomicEvidence']=={'sceneCount':1,'markerCleared':True},'C1_ATOMIC_RECEIPT')
        if volume in ['FULL_SYNTHETIC_NOVEL','LARGE_DOCUMENT']:
            dialog=read('owned-docx-dialog.json');require(dialog['schemaVersion']=='WORD_VOLUME_OWNED_DIALOG_V1' and dialog['pid']==boot['pid'] and dialog['sourceSha256']==dialog['chosenSha256']==digest(raw(returned)) and dialog['interactionDriver']=='CODEX_CUA_NATIVE' and r['contentPreview']['commandId']==dialog['commandId']=='cmd.project.docx.previewLocalFile','C1_OWNED_LOCAL_FILE')
        else:require(r['contentPreview']['commandId']=='cmd.project.docx.previewContent','C1_BOUNDED_PREVIEW')
        require(r['rendererAccept']['directSafeCreateBridge'] is True and r['rendererAccept']['dialogRouteUsed'] is False,'C1_COMMAND_SCOPE')
        require(len(reopened['scenes'])==1,'C1_REOPEN_COUNT');rr=reopened['scenes'][0]
        b=raw('imported-scene.txt');saved=raw('imported-saved.txt')
        require(rr['file']==prefix+'reopened-scenes/0.txt' and saved==files[rr['file']]==raw('runtime-project-snapshot/'+actual['sceneId']) and digest(b)==actual['sceneFileSha256'] and digest(saved)==rr['sha256'] and actual['sceneId']==rr['sceneId'] and actual['nodeId']==rr['nodeId'],'C1_DURABLE_BINDING')
        stage('import-renderer',actual['rendererReturnedParagraphs']);stage('imported-raw',paragraphs(scene(b)));stage('persisted',paragraphs(scene(saved)));stage('saved-renderer',im['renderer']['paragraphs']);font_check(im['fonts'],'import-renderer')
        imported_doc={'type':'doc','content':sum([d['content'] for d in docs],[])}
        if route=='C1':
            for data in [b,saved,files[rr['file']]]:require(normalize_doc(scene(data))==normalize_doc(imported_doc),'C1_RICH_PERSISTENCE')
        renderer(rr,imported_doc,'reopened-renderer',check_styles=route!='C5');stage('reopened-renderer',rr['renderer']['paragraphs'])
        x=read('reexport.json');rmin=x['result'];exported=raw('reexport.docx')
        require(x['commandId']=='cmd.project.export.docxMin' and rmin['ok'] is True and rmin['bytesWritten']==len(exported) and x['before']==x['after']==[digest(saved)] and x['sha256']==digest(exported),'C1_REEXPORT_COMMAND_HASH')
        ps,parts,d=docx(exported);stage('reexport-docx',ps)
        if route=='C1':style_stages['reexport']=assert_docx_styles(parts,d)
        word_check('final-word-lifecycle','reexport.docx','final-word.docx','final-word',0,False,None)
        if route=='C1':require(len({s['semanticStyleSha256'] for s in style_stages.values()})==1,'STYLE_STAGE_CONTINUITY')
        for loss in [receipt['lossReport'],r['importPreview']['docxImportPreviewPlan']['lossReport']]:
            if route=='C1':
                require(loss['mode']=='block-styles-headings-lists-and-inline-marks' and loss['itemCount']==len(loss['items'])==6 and sorted((x['code'],x['severity']) for x in loss['items'])==sorted([('DOCX_IMPORT_PREVIEW_BOOKMARKS_NOT_IMPORTED','warning')]*2+[('DOCX_IMPORT_PREVIEW_CUSTOM_METADATA_NOT_IMPORTED','warning'),('DOCX_IMPORT_PREVIEW_BLOCK_STYLES_HEADINGS_LISTS_AND_INLINE_MARKS','info')]+[('DOCX_IMPORT_PREVIEW_RELATIONSHIPS_NOT_IMPORTED','warning')]*2),'C1_DECLARED_LOSS')
            else:
                require(loss['mode']=='lists-headings-and-inline-marks' and loss['itemCount']==len(loss['items'])==5 and sorted((x['code'],x['severity']) for x in loss['items'])==sorted([('DOCX_IMPORT_PREVIEW_BOOKMARKS_NOT_IMPORTED','warning')]*2+[('DOCX_IMPORT_PREVIEW_CUSTOM_METADATA_NOT_IMPORTED','warning'),('DOCX_IMPORT_PREVIEW_LISTS_HEADINGS_AND_INLINE_MARKS','info'),('DOCX_IMPORT_PREVIEW_RELATIONSHIPS_NOT_IMPORTED','warning')]),'C5_DECLARED_LOSS')
                google_proof['productLossLedgerSha256']=digest(canonical(loss))
    for name in ['source.png','reopen.png']+(['saved.png'] if generic else []):require(raw(name).startswith(b'\x89PNG\r\n\x1a\n') and len(raw(name))>100,'PRODUCT_SCREENSHOT')
    cleanup=read('cleanup.json');require(cleanup['ok'] is True and len(cleanup['ownedProcesses'])==2 and {p['pid'] for p in cleanup['ownedProcesses']}=={boot['pid'],reopened['pid']} and all(p['exitCode'] is not None or p['signalCode'] is not None for p in cleanup['ownedProcesses']),'RUNTIME_CLEANUP')
    result=read('result.json');require(result['ok'] is True and result['failure'] is None and result['admissionCredit']==0 and result['candidateDiagnosticOnly']==obs['candidateDiagnosticOnly'],'NATIVE_COMPLETION')
    first_cap=read('rounds/1/export.json')['result']['exportCapsule'];calibration=controls(raw('rounds/1/source.docx'),volume,route,ids,first_cap['roundId'])
    if not generic and volume!='SINGLE_SCENE':
        # Corrupt the actual hierarchy, without changing text, and require the independent tree reader to reject it.
        for name in STRUCTURE_CONTROLS[3:]:
            value=copy.deepcopy(source['tree']);parents={};all_nodes=[]
            def index(n):
                all_nodes.append(n)
                for child in n.get('children',[]):parents[child['nodeId']]=n;index(child)
            index(value['root']);scene_nodes=[next(n for n in all_nodes if n['nodeId']==ident) for ident in nodes]
            if name=='remove-scene':parents[nodes[0]]['children'].remove(scene_nodes[0])
            elif name=='swap-chapters':
                parent=next(n for n in all_nodes if n['kind']=='part');parent['children'][0],parent['children'][1]=parent['children'][1],parent['children'][0]
            elif name=='merge-scene-path':scene_nodes[1]['nodeId']=nodes[0]
            rejected=False
            try:tree_check(value,'negative-'+name)
            except ValueError:rejected=True
            require(rejected,'FALSE_GREEN_'+name);calibration['structureMutants'].append({'id':name,'rejected':True,'sha256':digest(canonical(value))})
    limitations={'ime':'Native Chromium composition, cancellation and committed typing on the bound macOS locale; other OS IME engines are unproved.','fonts':'Actual Chromium glyph fallback plus independent Word font declarations; pixel identity is not claimed.','styles':'Fixed declared styles only; unsupported objects and external relationships reject the whole proof.','structure':'Existing scene/chapter identities and order survive exact text editing; structural editing is outside these fixtures.'}
    unicode_proof={'probes':UNICODE,'locale':locale,'providerLocale':{k:provider[k] for k in ['locale','languages']},'compositionEventsSha256':digest(raw('composition-events.json')),'fontLedger':font_ledger,'limitations':limitations}
    if route=='C5':
        unicode_proof['providerLocale']=google_proof['providerLocale']
        limitations['fonts']='Actual Chromium glyph fallback on the bound source/return runtime. Google content API has no interactive UI font session; literal Unicode is read before and after export. Pixel identity is not claimed.'
    comment_proof=None
    if not generic:
        require(len({p['semanticSha256'] for p in comment_stages.values()})==1,'COMMENT_ALL_STAGE_CONTINUITY')
        comment_proof={'sourceKind':'OWNED_SAVED_PROJECT_FIXTURE','canonicalApplyClaim':False,'sourceStateSha256':comment_state_sha,
                       'stages':comment_stages,'queries':comment_queries,'negativeControls':comment_negative,'lossControl':comment_loss,
                       'intentionalDeletionLedger':[{'threadId':'manuscript-comment-deleted','status':'deleted','messageCount':2,'outcome':'CANONICAL_DELETION_NOT_EXPORTED'}],
                       'scope':'Two existing canonical root threads with one reply each, open/resolved states, one intentional tombstone; exact body, provenance and anchors. Edited existing comments return a typed block; automatic conflict resolution is not claimed.'}
    proofs=[{'field':field,'cellId':f'{field}__{volume}__{route}__{profile}','runId':run,'status':'PASS','outcome':'EXACT_OBSERVED_MANUSCRIPT_PRESERVATION','subcases':SUBCASES[field],'requiredHops':HOPS[route],'requiredCycles':cycles,'stageProofs':stages,'controls':calibration,'oracles':v.ORACLES,'unicodeProof':unicode_proof,**({'googleProof':google_proof} if route=='C5' else {}),**({'styleProofs':style_stages,'unsupportedStylesDeclared':limitations['styles']} if field=='STYLES' else {}),**({'trackedReviewProof':{'rounds':review_rounds,'propertyProbe':review_probe,'lostRevisionFootprints':[],'unappliedPropertyPolicy':'VISIBLE_MANUAL_REVIEW_WITH_ORIGINAL_RAW_ARTIFACT_RETAINED','timestampPolicy':'LITERAL_WORD_DATE_AND_NAMESPACED_DATE_UTC_NO_NORMALIZATION'}} if field=='TRACKED_REVIEW_SEMANTICS' else {}),**({'structureProofs':structure_stages,'structureLossLedger':{'lostScenes':[],'lostChapters':[],'mergedScenes':[],'splitScenes':[],'scope':limitations['structure']}} if field=='NOVEL_SCENE_STRUCTURE' else {})} for field in fields(volume,route)]
    for proof in proofs:
        if proof['field']=='COMMENTS':proof['commentProof']=comment_proof
        if proof['field']=='IDENTIFIERS_ANCHORS':proof['identifierProof']={'stages':identifier_stages,'locators':locator_stages,'negativeControls':identifier_negative,'intakeControls':identifier_intakes,'lossLedger':{'lostIdentifiers':[],'duplicateIdentifiers':[],'unsafeHyperlinks':[],'scope':'Declared per-round locator names and all three explicit hyperlink ranges across saved, applied and reopened project state; intentional negative-control losses are recorded separately.'}}
    require(all(v.checked_read(root,b)==files[b['path']] for b in bindings),'CHANGED_DURING_READ')
    return {'ok':True,'schemaVersion':'WORD_MANUSCRIPT_RAW_READBACK_V1','admissionCredit':0,'runId':run,'productHead':head,'productTree':tree,'observationSha256':digest(raw('observation.json')),'filesVerified':len(files),'fieldProofs':proofs,'roundProofs':round_proofs,'finalHops':{'ok':True,'acceptanceCredit':0},'seconds':time.perf_counter()-started}

if __name__=='__main__':
    try:
        data=sys.stdin.buffer.read(1024*1024+1);require(len(data)<=1024*1024,'REQUEST_SIZE');print(json.dumps(audit(json.loads(data)),ensure_ascii=False))
    except Exception as e:print(json.dumps({'ok':False,'error':str(e),'admissionCredit':0}));sys.exit(1)

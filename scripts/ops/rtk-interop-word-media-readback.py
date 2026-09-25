"""Bounded independent PNG, Word inline-shape and canonical media oracle.
No product parser, fixture import, producer PASS or filesystem write authority.
Qualification is deliberately limited to the declared inline PNG specimen.
"""
import base64,copy,hashlib,json,re,struct,zlib
from xml.etree import ElementTree as ET
W='{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
R='{http://schemas.openxmlformats.org/officeDocument/2006/relationships}'
REL='{http://schemas.openxmlformats.org/package/2006/relationships}'
CT='{http://schemas.openxmlformats.org/package/2006/content-types}'
WP='{http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing}'
A='{http://schemas.openxmlformats.org/drawingml/2006/main}'
PIC='{http://schemas.openxmlformats.org/drawingml/2006/picture}'
IMAGE_REL=R[1:-1]+'/image'
CONTROLS=['drop-image','swap-binary','change-alt','break-relationship','externalize-target','lose-placement']
SUBCASES=['mediaInventoryPreserved','altTextPreserved','relationshipTargetsValidated','binaryHashBound','mediaLossLedgered','providerMediaReadback']
ENCODED=["iVBORw0KGgoAAAANSUhEUgAAAKAAAABQCAYAAACeXX40AAAA5ElEQVR4nO3SoQEAMBCEsNt/6e8YiEbEI9htB5XVAfzNgKQMSMqApAxIyoCkDEjKgKQMSMqApAxIyoCkDEjKgKQMSMqApAxIyoCkDEjKgKQMSMqApAxIyoCkDEjKgKQMSMqApAxIyoCkDEjKgKQMSMqApAxIyoCkDEjKgKQMSMqApAxIyoCkDEjKgKQMSMqApAxIyoCkDEjKgKQMSMqApAxIyoCkDEjKgKQMSMqApAxIyoCkDEjKgKQMSMqApAxIyoCkDEjKgKQMSMqApAxIyoCkDEjKgKQMSMqApAxIyoCkDEjqAdoXoc6EqImWAAAAAElFTkSuQmCC", "iVBORw0KGgoAAAANSUhEUgAAAKAAAABQCAYAAACeXX40AAABCUlEQVR4nO3OoQEAAAyDsP7/9HYGAkR8tt0lHDwQNzwQNzwQNzwQNzwQNzwQNzwQNzwQNzwQNzwQNzwQNzwQNzwQNzwQNzwQNzwQNzwQNzwQNzwQNzwQNzwQNzwQNzwQNzwQNzwQNzwQNzwQNzwQNzwQNzwQNzwQNzwQNzwQNzwQNzwQNzwQNzwQNzwQNzwQNzwQNzwQNzwQNzwQNzwQNzwQNzwQNzwQNzwQNzwQNzwQNzwQNzwQNzwQNzwQNzwQNzwQNzwQNzwQNzwQNzwQNzwQNzwQNzwQNzwQNzwQNzwQNzwQNzwQNzwQNzwQNzwQNzwQNzwQNzwQNzwQNzwQNzwQNzwQNzwQswc4SqHO8x7U4wAAAABJRU5ErkJggg=="]
HASHES=['96b7c372a1c239bfa3d615ebf9802bab0287624caa16b62a69111e82cf609340','9d47aee715e8f104320f16a4e41d4325dc2c2088725ab827b4faad4311cb2d9d']
ALTS=['Красное & <red> 🧭','Синее blue']
COLORS=[bytes([255,0,0,255]),bytes([0,0,255,255])]
def need(value,code):
    if not value:raise ValueError('MEDIA_'+code)
def sha(b):return hashlib.sha256(b).hexdigest()
def stable(v):return json.dumps(v,ensure_ascii=False,separators=(',',':'),sort_keys=True).encode()
def u16(s):return len(s.encode('utf-16-le'))//2

def png(data):
    need(isinstance(data,bytes) and 57<=len(data)<=4*1024*1024 and data[:8]==b'\x89PNG\r\n\x1a\n','PNG_BOUND')
    at=8;chunks=[];compressed=[]
    while at<len(data):
        need(at+12<=len(data),'PNG_CHUNK');size=struct.unpack('>I',data[at:at+4])[0]
        need(size<=4*1024*1024 and at+12+size<=len(data),'PNG_CHUNK_BOUND')
        tag=data[at+4:at+8];body=data[at+8:at+8+size];crc=struct.unpack('>I',data[at+8+size:at+12+size])[0]
        need(zlib.crc32(tag+body)&0xffffffff==crc,'PNG_CRC');chunks.append((tag,body));at+=12+size
        if tag==b'IDAT':compressed.append(body)
    need([t for t,b in chunks]==[b'IHDR',b'IDAT',b'IEND'] and chunks[-1][1]==b'','PNG_DECLARED_PROFILE')
    need(chunks[0][1]==struct.pack('>IIBBBBB',160,80,8,6,0,0,0),'PNG_DIMENSIONS')
    inflater=zlib.decompressobj();pixels=inflater.decompress(b''.join(compressed),51281)
    need(len(pixels)==51280 and inflater.eof and not inflater.unused_data and not inflater.unconsumed_tail,'PNG_INFLATE')
    h=sha(data);need(h in HASHES,'PNG_BINARY_IDENTITY');color=COLORS[HASHES.index(h)]
    need(pixels==(b'\0'+color*160)*80,'PNG_PIXEL_IDENTITY')
    return {'sha256':h,'width':160,'height':80}

def attrs(i):
    b=base64.b64decode(ENCODED[i],validate=True);p=png(b);h=p['sha256']
    return {'assetId':'sha256-'+h,'assetPath':'assets/media/'+h+'.png',**p,'mimeType':'image/png','alt':ALTS[i],'displayName':'same.png','dataBase64':ENCODED[i]}
def expected_blocks():
    t=lambda value:{'type':'text','text':value}
    image=lambda i:{'type':'image','attrs':attrs(i)}
    return [{'type':'paragraph','content':[t('[media-before] '),image(0),t(' [media-middle] '),image(1),image(0),t(' [media-after]')]}]
def canonical_graph(docs):
    graph=[];pi=0
    def visit(node):
        nonlocal pi
        if node.get('type') in ['paragraph','heading','codeBlock']:
            offset=0
            for child in node.get('content',[]):
                if child.get('type')=='image':
                    need(node['type']!='codeBlock' and set(child)=={'type','attrs'},'CANON_OWNER')
                    a=child['attrs'];need(a in [attrs(0),attrs(1)],'CANON_ATTRS')
                    graph.append({'paragraphIndex':pi,'offset':offset,**{k:a[k] for k in ['sha256','width','height','alt','displayName']}})
                else:
                    need(child.get('type')=='text' and isinstance(child.get('text'),str),'CANON_INLINE');offset+=u16(child['text'])
            pi+=1;return
        for child in node.get('content',[]):visit(child)
    for doc in docs:visit(doc)
    need(len(graph)<=128,'CANON_COUNT');return graph

def xml(raw):
    need(isinstance(raw,bytes) and len(raw)<=10*1024*1024 and b'<!DOCTYPE' not in raw.upper() and b'<!ENTITY' not in raw.upper(),'XML_BOUND')
    return ET.fromstring(raw)
def one(root,query):
    found=root.findall(query);need(len(found)==1,'XML_UNIQUE_'+query.split('}')[-1]);return found[0]
def package_graph(parts,document):
    rel=xml(parts['word/_rels/document.xml.rels']);ct=xml(parts['[Content_Types].xml'])
    need(rel.tag==REL+'Relationships' and ct.tag==CT+'Types','PACKAGE_ROOT')
    relationships={};image_targets=set()
    for n in rel:
        need(n.tag==REL+'Relationship' and n.get('Id') not in relationships,'REL_UNIQUE');relationships[n.get('Id')]=n
        if n.get('Type')==IMAGE_REL:
            need(n.get('TargetMode','Internal')=='Internal' and re.fullmatch(r'media/[A-Za-z0-9_-]+\.png',n.get('Target','')),'REL_INTERNAL')
            image_targets.add('word/'+n.get('Target'))
    need({n for n in parts if n.startswith('word/media/')}==image_targets and len(image_targets)<=128,'PACKAGE_INVENTORY')
    for target in image_targets:
        matches=[n.get('ContentType') for n in ct if (n.tag==CT+'Default' and n.get('Extension')=='png') or (n.tag==CT+'Override' and n.get('PartName')=='/'+target)]
        need(matches==['image/png'],'MIME_UNIQUE');png(parts[target])
    graph=[];used=set();ids=set();parents={child:parent for parent in document.iter() for child in parent}
    ps=list(document.find(W+'body').iter(W+'p'))
    for pi,p in enumerate(ps):
        offset=0
        def visit(n):
            nonlocal offset
            if n.tag==W+'del':return
            if n.tag==W+'t':offset+=u16(n.text or '');return
            if n.tag in [W+'tab',W+'br',W+'cr']:offset+=1;return
            if n.tag==W+'drawing':
                need(len(graph)<128 and len(n)==1 and n[0].tag==WP+'inline','INLINE_ONLY')
                ancestor=parents.get(n)
                while ancestor is not None and ancestor is not p:
                    need(ancestor.tag not in [W+'ins',W+'del',W+'moveFrom',W+'moveTo'],'TRACKED_IMAGE');ancestor=parents.get(ancestor)
                inline=n[0];extent=one(inline,WP+'extent');pr=one(inline,WP+'docPr');picture=one(inline,'.//'+PIC+'pic');blip=one(picture,'.//'+A+'blip')
                need(pr.get('id') not in ids and pr.get('id') is not None,'DRAWING_ID');ids.add(pr.get('id'))
                need(set(blip.attrib)=={R+'embed'} and not list(blip),'BLIP_UNSUPPORTED')
                relationship=relationships.get(blip.get(R+'embed'));need(relationship is not None and relationship.get('Type')==IMAGE_REL,'REL_TARGET')
                target='word/'+relationship.get('Target','');need(target in image_targets,'TARGET_EXISTS');used.add(target)
                binary=png(parts[target]);need(extent.attrib=={'cx':str(160*9525),'cy':str(80*9525)},'DISPLAY_SIZE')
                need(pr.get('hidden','0') in ['0','false'] and not pr.get('title'),'HIDDEN_OR_TITLE')
                for child in inline.iter():
                    need(child.tag not in [A+'srcRect',A+'tile',A+'alphaModFix',A+'lum',A+'duotone',A+'effectLst',A+'effectDag'],'EFFECT_UNSUPPORTED')
                    if child.tag==A+'xfrm':need(all(v=='0' for v in child.attrib.values()) and set(child.attrib)<={'rot','flipH','flipV'},'TRANSFORM')
                    if child.tag==A+'off':need(child.attrib=={'x':'0','y':'0'},'TRANSFORM_OFFSET')
                    if child.tag==A+'ext':need(child.attrib==extent.attrib,'TRANSFORM_SIZE')
                    if child.tag==A+'prstGeom':need(child.get('prst')=='rect','GEOMETRY')
                graph.append({'paragraphIndex':pi,'offset':offset,**binary,'alt':pr.get('descr',''),'displayName':pr.get('name','')});return
            for c in n:visit(c)
        visit(p)
    need(used==image_targets and len(graph)==len(list(document.iter(W+'drawing'))),'ALL_PLACEMENTS');return graph

def deleted_prefixes(document):
    # Word range coordinates include retained deletion markup although its
    # content text stream projects only the accepted text. Read actual raw XML.
    deleted=0;out=[]
    for node in document.find(W+'body').iter():
        if node.tag==W+'delText':deleted+=u16(node.text or '')
        if node.tag==W+'drawing':out.append(deleted)
    return out

def native_body(body,index,read_alt,graph,paragraphs,notes=(),deleted=()):
    text=body.decode('utf8');rows=index.decode('utf8').splitlines()
    need(rows and rows[0]==str(len(graph)) and len(rows)==len(graph)+1,'NATIVE_COUNT')
    positions=[]
    for i,m in enumerate(graph):
        cols=rows[i+1].split('\t');need(len(cols)==5 and cols[0]==str(i+1) and all(re.fullmatch(r'\d+(?:[.,]\d+)?',s) for s in cols),'NATIVE_ROW')
        nums=[float(s.replace(',','.')) for s in cols]
        start=sum(u16(p)+1 for p in paragraphs[:m['paragraphIndex']])+m['offset']+i+sum(n['paragraphIndex']<m['paragraphIndex'] or (n['paragraphIndex']==m['paragraphIndex'] and n['offsetUtf16']<=m['offset']) for n in notes)
        need(nums[1:]==[m['width']*.75,m['height']*.75,start+(deleted[i] if deleted else 0),start+1+(deleted[i] if deleted else 0)],'NATIVE_SIZE_POSITION')
        need(read_alt(f'word-media-alt-{i+1}.txt').decode('utf8')==m['alt'],'NATIVE_ALT');positions.append(start)
    raw=text.encode('utf-16-le')
    for start in reversed(positions):
        need(raw[start*2:(start+1)*2]==b'/\0','NATIVE_OBJECT_MARKER');raw=raw[:start*2]+raw[(start+1)*2:]
    return raw.decode('utf-16-le').encode('utf8')

def renderer(value,graph,views=False):
    need(isinstance(value,list) and len(value)==len(graph),'RENDERER_COUNT')
    for i,(row,m) in enumerate(zip(value,graph)):
        need(row.get('src','').startswith('data:image/png;base64,'),'RENDERER_SOURCE')
        actual=png(base64.b64decode(row['src'].split(',',1)[1],validate=True))
        need(actual['sha256']==m['sha256'] and row.get('alt')==m['alt'] and row.get('naturalWidth')==m['width'] and row.get('naturalHeight')==m['height'],'RENDERER_CONTENT')
        need(row.get('width')==m['width'] and row.get('height')==m['height'],'RENDERER_SIZE')
        if views:need(row.get('index')==i and row.get('hit') is True and row.get('display')!='none' and row.get('visibility')=='visible' and row.get('opacity')=='1','RENDERER_VISIBLE')
        else:need(row.get('paragraphIndex')==m['paragraphIndex'] and row.get('offset')==m['offset'] and row.get('displayName')==m['displayName'] and row.get('complete') is True,'RENDERER_POSITION')

def negative_controls(parts,document,expected):
    results=[]
    for kind in CONTROLS:
        pp=dict(parts);dd=copy.deepcopy(document);drawings=list(dd.iter(W+'drawing'));need(len(drawings)>=3,'CONTROL_SPECIMEN')
        rel=xml(pp['word/_rels/document.xml.rels']);images=[n for n in rel if n.get('Type')==IMAGE_REL]
        parents={c:p for p in dd.iter() for c in p}
        if kind=='drop-image':parents[drawings[0]].remove(drawings[0])
        elif kind=='swap-binary':pp['word/'+images[0].get('Target')]=pp['word/'+images[1].get('Target')]
        elif kind=='change-alt':one(drawings[0],'.//'+WP+'docPr').set('descr','changed')
        elif kind=='break-relationship':one(drawings[0],'.//'+A+'blip').set(R+'embed','missing')
        elif kind=='externalize-target':images[0].set('TargetMode','External');images[0].set('Target','https://example.invalid/image.png');pp['word/_rels/document.xml.rels']=ET.tostring(rel)
        else:
            parent=parents[drawings[0]];parent.remove(drawings[0]);target=dd.find(W+'body').find(W+'p');ET.SubElement(target,W+'r').append(drawings[0])
        rejected=False
        try:rejected=package_graph(pp,dd)!=expected
        except (ValueError,KeyError):rejected=True
        need(rejected,'CONTROL_SURVIVED_'+kind)
        results.append({'id':kind,'rejected':True,'sha256':sha(stable([sha(ET.tostring(dd)),{k:sha(v) for k,v in pp.items()}]))})
    return results

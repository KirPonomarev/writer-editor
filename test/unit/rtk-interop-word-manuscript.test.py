import copy,importlib.util,io,json,unittest,zipfile
from pathlib import Path
from xml.etree import ElementTree as ET
from xml.sax.saxutils import escape
ROOT=Path(__file__).resolve().parents[2]
s=importlib.util.spec_from_file_location('m',ROOT/'scripts/ops/rtk-interop-word-manuscript-readback.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
NS='http://schemas.openxmlformats.org/wordprocessingml/2006/main'
def archive(xml,extra=None):
 out=io.BytesIO()
 with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as z:
  z.writestr('word/document.xml',xml)
  for n,b in (extra or {}).items():z.writestr(n,b)
 return out.getvalue()
def document(ps):return ('<w:document xmlns:w="'+NS+'"><w:body>'+''.join('<w:p><w:r><w:t xml:space="preserve">'+escape(p)+'</w:t></w:r></w:p>' for p in ps)+'</w:body></w:document>').encode()
def identifier_archive():
 docs=m.expected_docs('MULTI_SCENE','C2');ids=m.expected_ids('MULTI_SCENE',len(docs));d=ET.fromstring(document(sum([m.paragraphs(x) for x in docs],[])));ps=d.find(m.W+'body').findall(m.W+'p');offset=0
 rels=ET.Element(m.REL+'Relationships')
 for i,href in enumerate(m.LINK_TARGETS):ET.SubElement(rels,m.REL+'Relationship',Id='link'+str(i),Type=m.LINK_REL,Target=href,TargetMode='External')
 for ident,doc in zip(ids,docs):
  for i,text in enumerate(m.paragraphs(doc)):
   p=ps[offset];name='YRTK_'+m.digest(b'word-bookmark-v1'+m.canonical({'roundBlockOccurrenceId':str(i),'roundId':'round-unit','sceneId':ident}))[:32]
   if text.startswith('[links]'):
    p.clear()
    def atom(parent,value):ET.SubElement(ET.SubElement(parent,m.W+'r'),m.W+'t').text=value
    atom(p,'[links] ')
    for j,target in enumerate([0,1,0]):
     if j:atom(p,' / ')
     atom(ET.SubElement(p,m.W+'hyperlink',{m.OFFICE_REL+'id':'link'+str(target)}),'reference')
    atom(p,'.')
   p.insert(0,ET.Element(m.W+'bookmarkStart',{m.W+'id':str(offset),m.W+'name':name}));p.append(ET.Element(m.W+'bookmarkEnd',{m.W+'id':str(offset)}));offset+=1
 parts={'word/_rels/document.xml.rels':ET.tostring(rels)};return archive(ET.tostring(d),parts),ids,docs
def metadata_parts():
 protected={'schemaVersion':'yalken.rtk.word.document-metadata.v1','projectId':'project-unit','title':'Роман & metadata','createdAtUtc':'2026-09-18T01:02:03.000Z','creator':'Yalken'};sha='sha256:'+m.digest(m.canonical(protected))
 core=ET.Element(m.CORE+'coreProperties');values=[(m.DC+'title',protected['title']),(m.DC+'creator','Yalken'),(m.CORE+'lastModifiedBy','Word User'),(m.DCTERMS+'created',protected['createdAtUtc']),(m.DCTERMS+'modified','2026-09-18T02:03:04Z'),(m.CORE+'revision','9'),(m.DC+'identifier',protected['projectId'])]
 for tag,value in values:
  n=ET.SubElement(core,tag);n.text=value
  if tag in [m.DCTERMS+'created',m.DCTERMS+'modified']:n.set(m.XSI+'type','dcterms:W3CDTF')
 custom=ET.Element(m.CUSTOM+'Properties');props={'YALKEN_METADATA_SCHEMA':protected['schemaVersion'],'YALKEN_METADATA_POLICY':'CANONICAL_PROJECT_METADATA_PROTECTED_PROVIDER_VOLATILE_V1','YALKEN_PROJECT_ID':protected['projectId'],'YALKEN_PROJECT_TITLE':protected['title'],'YALKEN_PROJECT_CREATED_AT_UTC':protected['createdAtUtc'],'YALKEN_APPLICATION_CREATOR':protected['creator'],'YALKEN_METADATA_DIGEST':sha,'YRTK_C01_AUTH':'token','YRTK2_TOKEN':'token2','YRTK_CORE_DIGEST':'sha256:'+'f'*64}
 for i,(name,value) in enumerate(props.items(),2):
  p=ET.SubElement(custom,m.CUSTOM+'property',name=name,pid=str(i));ET.SubElement(p,m.VT+'lpwstr').text=value
 return {'docProps/core.xml':ET.tostring(core),'docProps/custom.xml':ET.tostring(custom)},protected,sha
class ManuscriptOracle(unittest.TestCase):
 def test_native_note_reader_preserves_bodies_order_and_typed_corruption(self):
  d=ET.fromstring(document(['Before 🧭 after.','last']))
  rel=ET.Element(m.REL+'Relationships');ct=ET.Element('{http://schemas.openxmlformats.org/package/2006/content-types}Types');parts={}
  for kind,paragraph,offset,title,body in [('footnote',0,9,'Foot & <title>','  Body\n\t尾 e\u0301 🧭  '),('endnote',1,0,'','End body')]:
   root=ET.Element(m.W+kind+'s');note=ET.SubElement(root,m.W+kind,{m.W+'id':'4'})
   for i,value in enumerate([title,body]):
    p=ET.SubElement(note,m.W+'p');r=ET.SubElement(p,m.W+'r')
    if i==0:ET.SubElement(r,m.W+kind+'Ref')
    for atom in m.re.split(r'([\n\t])',value):
     if atom=='\n':ET.SubElement(r,m.W+'br')
     elif atom=='\t':ET.SubElement(r,m.W+'tab')
     else:ET.SubElement(r,m.W+'t').text=atom
   name='word/'+kind+'s.xml';parts[name]=ET.tostring(root)
   ET.SubElement(rel,m.REL+'Relationship',Id=kind,Type='http://schemas.openxmlformats.org/officeDocument/2006/relationships/'+kind+'s',Target=kind+'s.xml')
   ET.SubElement(ct,'{http://schemas.openxmlformats.org/package/2006/content-types}Override',PartName='/'+name,ContentType='application/vnd.openxmlformats-officedocument.wordprocessingml.'+kind+'s+xml')
   p=d.find(m.W+'body').findall(m.W+'p')[paragraph];text=m.v.visible(p);p.clear();raw=text.encode('utf-16-le');a=raw[:offset*2].decode('utf-16-le');b=raw[offset*2:].decode('utf-16-le')
   ET.SubElement(ET.SubElement(p,m.W+'r'),m.W+'t').text=a
   ET.SubElement(ET.SubElement(p,m.W+'r'),m.W+kind+'Reference',{m.W+'id':'4'})
   ET.SubElement(ET.SubElement(p,m.W+'r'),m.W+'t').text=b
  parts['word/_rels/document.xml.rels']=ET.tostring(rel);parts['[Content_Types].xml']=ET.tostring(ct)
  proof=m.notes_doc(parts,d,b'owned-native-bytes');self.assertEqual([x['offsetUtf16'] for x in proof['notes']],[9,0]);self.assertEqual(proof['notes'][0]['paragraphs'],['Foot & <title>','  Body\n\t尾 e\u0301 🧭  '])
  actual='Before 🧭\x02 after.\rlast\r'.replace('last','\x02last').encode();self.assertEqual(m.native_note_body(actual,['Before 🧭 after.','last'],proof['notes']),['Before 🧭 after.','last'])
  for raw in [actual.replace(b'\x02',b'',1),actual.replace(b'\x02',b'\x02\x02',1),actual.replace(b'\x02 after',b' after\x02')]:
   with self.assertRaises(ValueError):m.native_note_body(raw,['Before 🧭 after.','last'],proof['notes'])
  for kind in ['missing','duplicate','dangling','orphan','foreign','drawing','external','moved','changed-body']:
   changed=copy.deepcopy(d);pp=copy.deepcopy(parts);p=changed.find(m.W+'body').findall(m.W+'p')[0];r=p.findall(m.W+'r')[1]
   if kind=='missing':p.remove(r)
   elif kind=='duplicate':p.insert(1,copy.deepcopy(r))
   elif kind=='dangling':r[0].set(m.W+'id','999')
   elif kind=='orphan':
    root=ET.fromstring(pp['word/footnotes.xml']);n=copy.deepcopy(root[0]);n.set(m.W+'id','6');root.append(n);pp['word/footnotes.xml']=ET.tostring(root)
   elif kind in ['foreign','drawing','changed-body']:
    root=ET.fromstring(pp['word/footnotes.xml']);node=root.find('.//'+m.W+'t')
    if kind=='changed-body':node.text='Changed'
    elif kind=='foreign':node.tag='{urn:foreign}t'
    else:ET.SubElement(root.find('.//'+m.W+'r'),m.W+'drawing')
    pp['word/footnotes.xml']=ET.tostring(root)
   elif kind=='external':
    root=ET.fromstring(pp['word/_rels/document.xml.rels']);root[0].set('TargetMode','External');pp['word/_rels/document.xml.rels']=ET.tostring(root)
   elif kind=='moved':p.remove(r);changed.find(m.W+'body').findall(m.W+'p')[1].append(r)
   with self.subTest(kind=kind):
    if kind in ['moved','changed-body']:self.assertNotEqual(m.notes_doc(pp,changed,b'mutant')['protectedDigest'],proof['protectedDigest'])
    else:
     with self.assertRaises(ValueError):m.notes_doc(pp,changed,b'mutant')

 def test_c1_declared_loss_is_derived_from_raw_section_break_types(self):
  root=ET.fromstring(document(['one','two','three']))
  paragraphs=root.find(m.W+'body').findall(m.W+'p')
  for paragraph,value in [(paragraphs[0],'nextPage'),(paragraphs[1],'nextPage'),(paragraphs[2],'continuous')]:
   ppr=ET.SubElement(paragraph,m.W+'pPr');sect=ET.SubElement(ppr,m.W+'sectPr');ET.SubElement(sect,m.W+'type',{m.W+'val':value})
  expected=m.C1_BASE_DECLARED_LOSSES+[m.C1_SECTION_BREAK_DECLARED_LOSSES['nextPage'],m.C1_SECTION_BREAK_DECLARED_LOSSES['continuous']]
  loss={'mode':'block-styles-headings-lists-and-inline-marks','itemCount':len(expected),'items':[{'code':code,'severity':severity} for code,severity in expected]}
  m.c1_declared_loss(root,loss)
  for mutate in [lambda x:x['items'].pop(),lambda x:x['items'].append({'code':'EXTRA','severity':'warning'}),lambda x:x.update(itemCount=0)]:
   changed=copy.deepcopy(loss);mutate(changed)
   with self.assertRaisesRegex(ValueError,'C1_DECLARED_LOSS'):m.c1_declared_loss(root,changed)
  unknown=copy.deepcopy(root);unknown.find('.//'+m.W+'type').set(m.W+'val','oddPage')
  with self.assertRaisesRegex(ValueError,'C1_SECTION_BREAK_TYPE'):m.c1_declared_loss(unknown,loss)
  plain=ET.fromstring(document(['one']));base={'mode':loss['mode'],'itemCount':len(m.C1_BASE_DECLARED_LOSSES),'items':[{'code':code,'severity':severity} for code,severity in m.C1_BASE_DECLARED_LOSSES]}
  m.c1_declared_loss(plain,base)
 def test_c5_declared_loss_allows_only_source_bound_empty_section_carriers(self):
  root=ET.fromstring(document(['one','','three']))
  paragraph=root.find(m.W+'body').findall(m.W+'p')[1];ppr=ET.SubElement(paragraph,m.W+'pPr');section=ET.SubElement(ppr,m.W+'sectPr');ET.SubElement(section,m.W+'type',{m.W+'val':'nextPage'})
  expected=m.C5_BASE_DECLARED_LOSSES+[m.C5_SECTION_BREAK_DECLARED_LOSS]
  loss={'mode':'lists-headings-and-inline-marks','itemCount':len(expected),'items':[{'code':code,'severity':severity} for code,severity in expected]}
  m.c5_declared_loss(root,loss,[1])
  missing=copy.deepcopy(loss);missing['items'].pop();missing['itemCount']-=1
  with self.assertRaisesRegex(ValueError,'C5_DECLARED_LOSS'):m.c5_declared_loss(root,missing,[1])
  wrong=copy.deepcopy(loss);wrong['items'][-1]={'code':'DOCX_IMPORT_PREVIEW_SECTION_BREAK_NEXT_PAGE_NOT_IMPORTED','severity':'warning'}
  with self.assertRaisesRegex(ValueError,'C5_DECLARED_LOSS'):m.c5_declared_loss(root,wrong,[1])
  m.c5_declared_loss(root,wrong,[])
  for indexes in [[0],[1,1],[True],'1']:
   with self.assertRaisesRegex(ValueError,'C5_RECOVERY_BOUNDARY'):m.c5_declared_loss(root,loss,indexes)
  plain=ET.fromstring(document(['one']));base={'mode':loss['mode'],'itemCount':len(m.C5_BASE_DECLARED_LOSSES),'items':[{'code':code,'severity':severity} for code,severity in m.C5_BASE_DECLARED_LOSSES]}
  m.c5_declared_loss(plain,base,[])
 def test_c5_section_diagnostics_are_deduplicated_and_recovery_is_source_bound(self):
  for texts,recovered in [(['one','two','three'],False),(['one','','three'],True),(['','two',''],True)]:
   root=ET.fromstring(document(texts))
   for paragraph in root.find(m.W+'body').findall(m.W+'p'):
    ppr=ET.SubElement(paragraph,m.W+'pPr');section=ET.SubElement(ppr,m.W+'sectPr');ET.SubElement(section,m.W+'type',{m.W+'val':'nextPage'})
   diagnostic=m.C5_SECTION_BREAK_DECLARED_LOSS if recovered else m.C1_SECTION_BREAK_DECLARED_LOSSES['nextPage']
   omitted=[i for i,text in enumerate(texts) if text=='']
   expected=m.C5_BASE_DECLARED_LOSSES+[diagnostic]
   loss={'mode':'lists-headings-and-inline-marks','itemCount':len(expected),'items':[{'code':code,'severity':severity} for code,severity in expected]}
   with self.subTest(texts=texts):
    m.c5_declared_loss(root,loss,omitted)
    for mutate in [lambda x:x['items'].pop(),lambda x:x['items'].append(copy.deepcopy(x['items'][-1])),lambda x:x['items'][-1].update(severity='info'),lambda x:x['items'][-1].update(code=(m.C1_SECTION_BREAK_DECLARED_LOSSES['nextPage'] if recovered else m.C5_SECTION_BREAK_DECLARED_LOSS)[0])]:
     changed=copy.deepcopy(loss);mutate(changed);changed['itemCount']=len(changed['items'])
     with self.assertRaisesRegex(ValueError,'C5_DECLARED_LOSS'):m.c5_declared_loss(root,changed,omitted)
    for value in ['continuous','oddPage','']:
     changed=copy.deepcopy(root);changed.find('.//'+m.W+'type').set(m.W+'val',value)
     with self.assertRaisesRegex(ValueError,'C5_SECTION_BREAK_TYPE'):m.c5_declared_loss(changed,loss,omitted)
 def test_c1_review_recipe_has_disjoint_credit_and_independent_rich_expectations(self):
  for volume in ['SINGLE_SCENE','MULTI_SCENE','FULL_SYNTHETIC_NOVEL','LARGE_DOCUMENT']:
   default=m.fields(volume,'C1');review=m.fields(volume,'C1','C1_REVIEW_RETURN')
   self.assertEqual(default,['TEXT','ORDER','UNICODE_IME_LOCALE','STYLES']);self.assertFalse(set(default)&set(review))
   self.assertEqual(review,([] if volume=='SINGLE_SCENE' else ['NOVEL_SCENE_STRUCTURE'])+['TRACKED_REVIEW_SEMANTICS','COMMENTS','IDENTIFIERS_ANCHORS','METADATA','SECTIONS','NOTES','FOOTNOTES_ENDNOTES'])
   source=m.expected_docs(volume,'C1',recipe='C1_REVIEW_RETURN');returned=m.expected_docs(volume,'C1',1,'C1_REVIEW_RETURN')
   self.assertIn('[links] reference / reference / reference.',m.paragraphs(source[0]))
   self.assertNotIn('[links] reference / reference / reference.',m.paragraphs(m.expected_docs(volume,'C1')[0]))
   self.assertEqual([i for i,(a,b) in enumerate(zip(m.paragraphs(source[0]),m.paragraphs(returned[0]))) if a!=b],[0])
   self.assertIn('sentinel round1',m.paragraphs(returned[0])[0]);self.assertEqual(source[1:],returned[1:])
  for route,recipe in [('C1','unknown'),('C1',None),('C2','C1_REVIEW_RETURN'),('C3','C1_REVIEW_RETURN'),('C5','C1_REVIEW_RETURN')]:
   with self.assertRaisesRegex(ValueError,'MANUSCRIPT_RECIPE'):m.expected_docs('SINGLE_SCENE',route,recipe=recipe)
 def test_lossless_locator_archive_rejects_wrong_hash_length_truncation_and_bombs(self):
  data=b'{"owned":"'+b'x'*2048+b'"}';encoded=m.gzip.compress(data)
  self.assertEqual(m.decode_locator_store(encoded,m.digest(data),len(data)),data)
  for archive,sha,length in [(encoded,'0'*64,len(data)),(encoded,m.digest(data),len(data)-1),(encoded,m.digest(data),len(data)+1),(encoded,m.digest(data),128*1024*1024+1),(encoded[:-3],m.digest(data),len(data)),(encoded+encoded,m.digest(data),len(data)),(encoded,m.digest(data),True)]:
   with self.assertRaises((ValueError,OSError,EOFError)):m.decode_locator_store(archive,sha,length)
 def test_metadata_oracle_reads_dual_carriers_and_ledgers_provider_changes(self):
  parts,protected,sha=metadata_parts();proof=m.metadata_doc(parts,b'fixture')
  self.assertEqual(proof['protectedProperties'],protected);self.assertEqual(proof['protectedDigest'],sha);self.assertEqual(proof['createdTimestampType'],'dcterms:W3CDTF')
  self.assertEqual(proof['coreProtectedProperties'],{'projectId':'project-unit','title':'Роман & metadata','createdAtUtc':'2026-09-18T01:02:03.000Z','creator':'Yalken'})
  self.assertEqual(proof['volatileCoreProperties'],{'lastModifiedBy':'Word User','modifiedAtUtc':'2026-09-18T02:03:04Z','revision':'9'})
  self.assertEqual(proof['missingProtectedProperties'],[]);self.assertEqual(proof['unknownCustomPropertyNames'],[])
  custom=ET.fromstring(parts['docProps/custom.xml']);p=ET.SubElement(custom,m.CUSTOM+'property',name='WORD_PROVIDER_PROPERTY',pid='99');ET.SubElement(p,m.VT+'lpwstr').text='visible'
  changed=m.metadata_doc({**parts,'docProps/custom.xml':ET.tostring(custom)},b'changed');self.assertEqual(changed['protectedDigest'],sha);self.assertEqual(changed['unknownCustomPropertyNames'],['WORD_PROVIDER_PROPERTY'])
  custom.append(copy.deepcopy(next(p for p in custom if p.get('name')=='YALKEN_PROJECT_ID')))
  duplicate=m.metadata_doc({**parts,'docProps/custom.xml':ET.tostring(custom)},b'duplicate');self.assertEqual(duplicate['duplicateCustomPropertyNames'],['YALKEN_PROJECT_ID']);self.assertEqual(duplicate['publicCustomProperties']['YALKEN_PROJECT_ID'],'')
  with self.assertRaisesRegex(ValueError,'METADATA_PARTS'):m.metadata_doc({'docProps/custom.xml':parts['docProps/custom.xml']},b'missing')
 def test_section_oracle_derives_scene_groups_and_reads_protected_word_geometry(self):
  docs=m.expected_docs('MULTI_SCENE','C2');ids=m.expected_ids('MULTI_SCENE',len(docs));expected=m.expected_section_contract(ids,docs)
  root=ET.fromstring(document(sum([m.paragraphs(x) for x in docs],[])));body=root.find(m.W+'body');ps=body.findall(m.W+'p')
  def props(section):
   s=ET.Element(m.W+'sectPr')
   if section['breakPlacement']!='BODY_FINAL':ET.SubElement(s,m.W+'type',{m.W+'val':'nextPage'})
   ET.SubElement(s,m.W+'pgSz',{m.W+'w':'11906',m.W+'h':'16838',m.W+'orient':'portrait'})
   ET.SubElement(s,m.W+'pgMar',{m.W+'top':'1440',m.W+'right':'1440',m.W+'bottom':'1440',m.W+'left':'1440',m.W+'header':'720',m.W+'footer':'720',m.W+'gutter':'0'})
   ET.SubElement(s,m.W+'cols',{m.W+'num':'1',m.W+'space':'720'});return s
  for section in expected['protectedSections'][:-1]:
   p=ps[section['endParagraphIndex']];ppr=ET.Element(m.W+'pPr');p.insert(0,ppr);ppr.append(props(section))
  body.append(props(expected['protectedSections'][-1]));proof=m.section_doc(root,b'sections')
  self.assertEqual(proof['protectedSections'],expected['protectedSections']);self.assertEqual(proof['protectedDigest'],expected['protectedDigest']);self.assertEqual(len(expected['sourceBindings']),3)
  for mutate in ['boundary','page','margin','duplicate']:
   changed=copy.deepcopy(root)
   if mutate=='boundary':
    first=changed.find('.//'+m.W+'pPr/'+m.W+'sectPr');parent=next(p.find(m.W+'pPr') for p in changed.findall('.//'+m.W+'p') if p.find(m.W+'pPr/'+m.W+'sectPr') is first);parent.remove(first);target=changed.findall('.//'+m.W+'p')[expected['protectedSections'][0]['endParagraphIndex']+1];ppr=target.find(m.W+'pPr') or ET.Element(m.W+'pPr');target.insert(0,ppr) if ppr not in list(target) else None;ppr.append(first)
   elif mutate=='page':changed.find('.//'+m.W+'sectPr/'+m.W+'pgSz').set(m.W+'w','11907')
   elif mutate=='margin':changed.find('.//'+m.W+'sectPr/'+m.W+'pgMar').set(m.W+'left','1441')
   else:
    first=changed.find('.//'+m.W+'pPr/'+m.W+'sectPr');parent=next(p.find(m.W+'pPr') for p in changed.findall('.//'+m.W+'p') if p.find(m.W+'pPr/'+m.W+'sectPr') is first);parent.append(copy.deepcopy(first))
   if mutate=='duplicate':
    with self.assertRaises(ValueError):m.section_doc(changed,b'changed')
   else:self.assertNotEqual(m.section_doc(changed,b'changed')['protectedDigest'],expected['protectedDigest'])
 def test_word_split_uri_fragment_preserves_full_target_and_rejects_fragment_loss(self):
  data,ids,docs=identifier_archive();_,parts,d=m.docx(data);rels=ET.fromstring(parts['word/_rels/document.xml.rels'])
  by_id={r.get('Id'):r for r in rels}
  for link in d.iter(m.W+'hyperlink'):link.set(m.W+'anchor',by_id[link.get(m.OFFICE_REL+'id')].get('Target').split('#',1)[1])
  for r in rels:r.set('Target',r.get('Target').split('#',1)[0])
  parts['word/_rels/document.xml.rels']=ET.tostring(rels)
  self.assertEqual([r['href'] for r in m.identifier_doc(parts,d,'round-unit',ids,docs)['links']],[m.LINK_TARGETS[0],m.LINK_TARGETS[1],m.LINK_TARGETS[0]])
  for kind in ['missing','wrong','ambiguous']:
   x=copy.deepcopy(d);changed=dict(parts);link=next(x.iter(m.W+'hyperlink'))
   if kind=='missing':del link.attrib[m.W+'anchor']
   elif kind=='wrong':link.set(m.W+'anchor','other')
   else:
    other=copy.deepcopy(rels);other[0].set('Target',m.LINK_TARGETS[0]);changed['word/_rels/document.xml.rels']=ET.tostring(other)
   with self.assertRaises(ValueError):m.identifier_doc(changed,x,'round-unit',ids,docs)
 def test_identifier_ranges_relationships_and_eleven_corruptions(self):
  data,ids,docs=identifier_archive();ps,parts,d=m.docx(data)
  proof=m.identifier_doc(parts,d,'round-unit',ids,docs)
  self.assertEqual([x['href'] for x in proof['links']],[m.LINK_TARGETS[0],m.LINK_TARGETS[1],m.LINK_TARGETS[0]])
  self.assertEqual([(x['startUtf16'],x['endUtf16']) for x in proof['links']],[(8,17),(20,29),(32,41)])
  controls=m.identifier_controls(data,'round-unit',ids,docs)
  self.assertEqual([x['id'] for x in controls],m.IDENTIFIER_CONTROLS);self.assertTrue(all(x['rejected'] for x in controls));self.assertEqual(len({x['sha256'] for x in controls}),11)
 def test_identifier_native_id_renumbering_and_split_runs_preserve_semantics(self):
  data,ids,docs=identifier_archive();_,parts,d=m.docx(data);original=m.identifier_doc(parts,d,'round-unit',ids,docs)
  for n in [*d.iter(m.W+'bookmarkStart'),*d.iter(m.W+'bookmarkEnd')]:n.set(m.W+'id',str(int(n.get(m.W+'id'))+7000))
  rels=ET.fromstring(parts['word/_rels/document.xml.rels'])
  for r in rels:r.set('Id','new-'+r.get('Id'))
  for link in d.iter(m.W+'hyperlink'):
   link.set(m.OFFICE_REL+'id','new-'+link.get(m.OFFICE_REL+'id'));run=link[0];run[0].text='ref';clone=copy.deepcopy(run);clone[0].text='erence';link.append(clone)
  changed=m.identifier_doc({**parts,'word/_rels/document.xml.rels':ET.tostring(rels)},d,'round-unit',ids,docs)
  self.assertEqual(original['bookmarkSha256'],changed['bookmarkSha256']);self.assertEqual(original['linkSemanticSha256'],changed['linkSemanticSha256'])
 def test_all_volumes_have_literal_unicode_and_five_distinct_rounds(self):
  for volume in ['SINGLE_SCENE','MULTI_SCENE','FULL_SYNTHETIC_NOVEL','LARGE_DOCUMENT']:
   for route in ['C1','C2','C3']:
    docs=m.expected_docs(volume,route);ps=sum([m.paragraphs(d) for d in docs],[])
    self.assertTrue(all(p in ps for p in m.UNICODE));self.assertEqual(len(docs),1 if volume=='SINGLE_SCENE' else 3 if volume=='MULTI_SCENE' else 21)
    self.assertTrue(any(p.startswith('[heading-6]') for p in ps));self.assertIn('[ordered-4] Second numbered item.',ps)
  for n in range(1,6):
   a=m.paragraphs(m.expected_docs('MULTI_SCENE','C3',n-1)[0]);b=m.paragraphs(m.expected_docs('MULTI_SCENE','C3',n)[0]);self.assertEqual([i for i,(x,y) in enumerate(zip(a,b)) if x!=y],[0]);self.assertIn('round'+str(n),b[0])
 def test_unicode_must_not_normalize_or_drop_ime_or_bidi(self):
  e=m.UNICODE
  for x in [[p.replace('e\u0301','é') for p in e],[p.replace('\u2067','') for p in e],[p.replace('語','') for p in e]]:
   with self.assertRaises(ValueError):m.exact(x,e,'UNICODE')
 def test_rich_raw_envelope_preserves_marks_and_utf16(self):
  d=m.expected_docs('SINGLE_SCENE','C2')[0];raw=json.dumps(d,ensure_ascii=False);b=('[doc-v2 length='+str(len(raw.encode('utf-16-le'))//2)+']\n'+raw+'\n').encode();self.assertEqual(m.scene(b),d)
  for wrong in [b.replace(b'length=',b'length=1'),b+b'x',b.replace(b'heading',b'unknown')]:
   with self.assertRaises(ValueError):m.scene(wrong)
  n=copy.deepcopy(d);inline=next(p for p in n['content'] if p.get('content',[{}])[0].get('text')=='[inline] ');inline['content'][1].pop('marks');self.assertNotEqual(m.normalize_doc(n),m.normalize_doc(d))
 def test_style_cascade_uses_defaults_based_on_and_direct_override(self):
  styles=('<w:styles xmlns:w="'+NS+'"><w:docDefaults><w:rPrDefault><w:rPr><w:sz w:val="22"/></w:rPr></w:rPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:rPr><w:rFonts w:ascii="Arial"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Derived"><w:basedOn w:val="Normal"/><w:pPr><w:outlineLvl w:val="2"/></w:pPr><w:rPr><w:b/></w:rPr></w:style></w:styles>').encode();c=m.StyleCascade({'word/styles.xml':styles})
  p=ET.fromstring('<w:p xmlns:w="'+NS+'"><w:pPr><w:pStyle w:val="Derived"/></w:pPr><w:r><w:rPr><w:sz w:val="28"/></w:rPr><w:t>text</w:t></w:r></w:p>');r=p.find(m.W+'r');props=c.run(p,r)
  self.assertEqual(props[m.W+'sz'][m.W+'val'],'28');self.assertEqual(props[m.W+'rFonts'][m.W+'ascii'],'Arial');self.assertIn(m.W+'b',props);self.assertEqual(c.paragraph(p)[0][m.W+'outlineLvl'][m.W+'val'],'2')
  for bad in [styles.replace(b'w:val="Normal"',b'w:val="Derived"'),styles.replace(b'w:val="Normal"',b'w:val="Missing"')]:
   with self.assertRaisesRegex(ValueError,'STYLE_CHAIN'):m.StyleCascade({'word/styles.xml':bad}).run(p,r)
 def test_bookmarks_bind_scene_ids_order_and_every_empty_paragraph(self):
  docs=m.expected_docs('MULTI_SCENE','C1');ids=m.expected_ids('MULTI_SCENE',3);d=ET.fromstring(document(sum([m.paragraphs(x) for x in docs],[])));ps=d.find(m.W+'body').findall(m.W+'p');offset=0
  for ident,doc in zip(ids,docs):
   for i in range(len(m.paragraphs(doc))):
    name='YRTK_'+m.digest(b'word-bookmark-v1'+m.canonical({'roundBlockOccurrenceId':str(i),'roundId':'round-test','sceneId':ident}))[:32];p=ps[offset];p.insert(0,ET.Element(m.W+'bookmarkStart',{m.W+'id':str(offset),m.W+'name':name}));p.append(ET.Element(m.W+'bookmarkEnd',{m.W+'id':str(offset)}));offset+=1
  self.assertEqual(len(m.bookmark_partition(d,'round-test',ids,docs)),64)
  for kind in ['removed','duplicate','wrong-round','wrong-scene']:
   x=copy.deepcopy(d);first=x.find(m.W+'body/'+m.W+'p');rid='round-test';changed_ids=ids[:]
   if kind=='removed':first.remove(first.find(m.W+'bookmarkEnd'))
   if kind=='duplicate':first.append(copy.deepcopy(first.find(m.W+'bookmarkStart')))
   if kind=='wrong-round':rid='round-other'
   if kind=='wrong-scene':changed_ids[0]=ids[1]
   with self.assertRaises(ValueError):m.bookmark_partition(x,rid,changed_ids,docs)
 def test_tracked_fifth_round_requires_fourth_round_baseline(self):
  xml=('<w:document xmlns:w="'+NS+'"><w:body><w:p><w:del><w:r><w:delText>sentinel round4</w:delText></w:r></w:del><w:ins><w:r><w:t>sentinel round5</w:t></w:r></w:ins></w:p></w:body></w:document>').encode()
  self.assertEqual(m.docx(archive(xml),5)[0],['sentinel round5'])
  for n in [0,1,4]:
   with self.assertRaises(ValueError):m.docx(archive(xml),n)
 def test_untrusted_package_rejects_unknown_text_and_external_objects(self):
  base=document(m.UNICODE)
  for b in [archive(base,{'../escape':b'x'}),archive(base,{'x.xml':b'<!DOCTYPE x><x/>'}),archive(base,{'x.rels':b'<Relationships><Relationship TargetMode="External"/></Relationships>'}),archive(base.replace(b'<w:body>',b'<w:body><w:tbl/>')),archive(base.replace(b'</w:t>',b'</w:t><w:br/>',1))]:
   with self.assertRaises(ValueError):m.docx(b)
 def test_count_only_or_caller_expected_value_never_grants_credit(self):
  request={'root':str(ROOT),'runId':'ORDER__MULTI_SCENE__C3__SOURCE_RUNTIME__fake','productHead':'a'*40,'productTree':'b'*40,'files':[],'expectedParagraphs':m.UNICODE,'ok':True,'admissionCredit':100}
  with self.assertRaisesRegex(ValueError,'INVENTORY'):m.audit(request)
 def test_google_native_readback_preserves_utf16_ranges_and_rejects_omitted_content(self):
  ps=['  é e\u0301 日本語 🧑‍💻  ','','end'];ident='native-test-document'
  def native():
   body=[{'endIndex':1,'sectionBreak':{}}];offset=1
   for index,text in enumerate(ps):
    run=text+'\n';end=offset+len(run.encode('utf-16-le'))//2;body.append({'startIndex':offset,'endIndex':end,'paragraph':{'elements':[{'startIndex':offset,'endIndex':end,'textRun':{'content':run}}]}});offset=end
    if index==0:
     body.append({'startIndex':offset,'endIndex':offset+1,'sectionBreak':{'sectionStyle':{'sectionType':'NEXT_PAGE','contentDirection':'LEFT_TO_RIGHT','columnSeparatorStyle':'NONE','marginTop':{'magnitude':72,'unit':'PT'},'useFirstPageHeaderFooter':False,'flipPageOrientation':False}}});offset+=1
   return {'documentId':ident,'revisionId':'revision-test','body':None,'tabs':[{'documentId':ident,'tabId':'t.0','parentTabId':None,'body':{'content':body}}]}
  doc=native();self.assertEqual(m.google_native_paragraphs(doc,ident),ps)
  mutations=[lambda d:d['tabs'].append(copy.deepcopy(d['tabs'][0])),lambda d:d['tabs'][0].update(headers={'hidden':'text'}),lambda d:d['tabs'][0]['body']['content'][1]['paragraph']['elements'][0].update(inlineObjectElement={'id':'hidden'}),lambda d:d['tabs'][0]['body']['content'][1].update(startIndex=2),lambda d:d['tabs'][0]['body']['content'][1]['paragraph']['elements'][0]['textRun'].update(suggestedInsertionIds=['hidden']),lambda d:d.update(documentId='other')]
  for mutate in mutations:
   changed=native();mutate(changed)
   with self.assertRaises(ValueError):m.google_native_paragraphs(changed,ident)
  section_index=2
  section_mutations=[lambda b:b.update(startIndex=b['startIndex']+1),lambda b:b.update(endIndex=b['endIndex']+1),lambda b:b.update(hidden='text'),lambda b:b.update(sectionBreak={}),lambda b:b['sectionBreak']['sectionStyle'].update(sectionType='UNKNOWN'),lambda b:b['sectionBreak']['sectionStyle'].update(marginTop={'magnitude':-1,'unit':'PT'})]
  for mutate in section_mutations:
   changed=native();mutate(changed['tabs'][0]['body']['content'][section_index])
   with self.assertRaises(ValueError):m.google_native_paragraphs(changed,ident)
 def test_google_provider_loss_reconciles_only_source_bound_empty_section_carriers(self):
  root=ET.fromstring(document(['before','','after']));body=root.find(m.W+'body');carrier=body.findall(m.W+'p')[1];ppr=ET.Element(m.W+'pPr');ppr.append(ET.Element(m.W+'sectPr'));ppr.find(m.W+'sectPr').append(ET.Element(m.W+'type',{m.W+'val':'nextPage'}));carrier.insert(0,ppr);body.append(ET.Element(m.W+'sectPr'))
  source=archive(ET.tostring(root));expected,ledger=m.google_provider_reconcile(source,['before','after'],[1],['NEXT_PAGE'])
  self.assertEqual(expected,['before','','after']);self.assertEqual(ledger['omittedEmptySectionCarrierIndexes'],[1]);self.assertEqual(ledger['mode'],'SOURCE_BOUND_EMPTY_SECTION_CARRIER_RELOCATION')
  returned_root=ET.fromstring(document(['before','after']));returned_body=returned_root.find(m.W+'body');returned_body.findall(m.W+'p')[0].insert(0,copy.deepcopy(ppr));returned_body.append(ET.Element(m.W+'sectPr'));returned=archive(ET.tostring(returned_root));self.assertEqual(m.google_provider_reconcile_docx(source,returned),(expected,ledger))
  for observed,positions,types in [(['before'],[1],['NEXT_PAGE']),(['before','after'],[2],['NEXT_PAGE']),(['before','after'],[1],['CONTINUOUS'])]:
   with self.assertRaises(ValueError):m.google_provider_reconcile(source,observed,positions,types)
  ambiguous=ET.fromstring(document(['before','','','after']));ambiguous_body=ambiguous.find(m.W+'body');ambiguous_body.findall(m.W+'p')[2].insert(0,copy.deepcopy(ppr));ambiguous_body.append(ET.Element(m.W+'sectPr'))
  with self.assertRaisesRegex(ValueError,'GOOGLE_SOURCE_SECTION_CARRIER_AMBIGUOUS'):m.google_provider_reconcile(archive(ET.tostring(ambiguous)),['before','','after'],[2],['NEXT_PAGE'])
 def test_google_exchange_binds_actual_bytes_and_rejects_coherent_text_loss_and_forged_cleanup(self):
  import base64
  ident='native-test-document';ps=['sentinel',''];offset=1;body=[{'endIndex':1,'sectionBreak':{}}]
  for text in ps:
   end=offset+len(text)+1;body.append({'startIndex':offset,'endIndex':end,'paragraph':{'elements':[{'startIndex':offset,'endIndex':end,'textRun':{'content':text+'\n'}}]}});offset=end
  doc={'documentId':ident,'revisionId':'revision-test','body':None,'tabs':[{'documentId':ident,'tabId':'t.0','body':{'content':body}}]};data=archive(document(ps))
  row=lambda req,value:{'request':req,'response':{'isError':False,'structuredContent':value}}
  req={'schemaVersion':'GOOGLE_NATIVE_REQUEST_V1','runId':'unit-fixture','source':'/synthetic/source.docx','sourceSha256':m.digest(data),'profile':'GOOGLE_NATIVE','uploadMode':'native_google_docs'}
  response={'schemaVersion':'GOOGLE_NATIVE_RETURN_V1','runId':req['runId'],'sourceSha256':m.digest(data),'import':row({'source_file':req['source'],'upload_mode':'native_google_docs'},{'fileId':ident,'documentId':ident,'success':True,'converted':True,'mimeType':m.GOOGLE_NATIVE_MIME}),'metadata':row({'fileId':ident},{'id':ident,'mime_type':m.GOOGLE_NATIVE_MIME}),'nativeBefore':row({'document_id':ident},copy.deepcopy(doc)),'nativeAfter':row({'document_id':ident},copy.deepcopy(doc)),'export':row({'url':'https://docs.google.com/document/d/'+ident,'download_raw_file':True,'include_base64':True,'raw_export_mime_type':m.GOOGLE_DOCX_MIME},{'id':ident,'mime_type':m.GOOGLE_DOCX_MIME,'file_size_bytes':len(data),'b64_string':base64.b64encode(data).decode()}),'cleanup':{'delete':row({'url':'https://drive.google.com/file/d/'+ident+'/view'},{'success':True}),'readback':{'request':{'fileId':ident},'response':{'isError':True,'structuredContent':{'error_code':'NOT_FOUND','error':'404 missing '+ident}}}}}
  self.assertEqual(m.google_exchange(response,req,data,data)[:2],(ps,ps));controls=m.google_controls(response,req,data,data,ps);self.assertEqual([x['id'] for x in controls],m.GOOGLE_CONTROLS);self.assertTrue(all(x['rejected'] for x in controls))
  # IDs must agree in requests too, even if response text is copied unchanged.
  for side,key in [('metadata','fileId'),('nativeAfter','document_id')]:
   bad=copy.deepcopy(response);bad[side]['request'][key]='other'
   with self.assertRaises(ValueError):m.google_exchange(bad,req,data,data)
 def test_google_body_bookmarks_cannot_hide_text_or_weaken_word_reader(self):
  xml=document(['text']);xml=xml.replace(b'<w:body>',b'<w:body><w:bookmarkStart w:id="0" w:name="provider"/><w:bookmarkEnd w:id="0"/>')
  self.assertEqual(m.docx(archive(xml),google=True)[0],['text'])
  with self.assertRaises(ValueError):m.docx(archive(xml))
  for bad in [xml.replace(b'<w:bookmarkEnd w:id="0"/>',b'<w:bookmarkEnd w:id="1"/>'),xml.replace(b'w:name="provider"/>',b'w:name="provider"><w:t>hidden</w:t></w:bookmarkStart>')]:
   with self.assertRaises(ValueError):m.docx(archive(bad),google=True)
  with self.assertRaises(ValueError):m.fields('LARGE_DOCUMENT','C5')
 def test_tracked_review_requires_literal_native_metadata_property_diagnostic_and_no_write(self):
  attrs='w:author="Synthetic Ada" w:date="2026-09-17T13:23:00Z" u:dateUtc="2026-09-17T10:23:00Z"'
  xml=('<w:document xmlns:w="'+NS+'" xmlns:u="http://schemas.microsoft.com/office/word/2023/wordml/word16du"><w:body><w:p><w:r><w:rPr><w:b/><w:rPrChange w:id="1" '+attrs+'><w:rPr/></w:rPrChange></w:rPr><w:t>prefix</w:t></w:r><w:del w:id="2" '+attrs+'><w:r><w:delText>sentinel alpha</w:delText></w:r></w:del><w:ins w:id="3" '+attrs+'><w:r><w:t>sentinel round1</w:t></w:r></w:ins></w:p></w:body></w:document>').encode()
  d=ET.fromstring(xml);common={'author':'Synthetic Ada','date':'2026-09-17T13:23:00Z','dateUtc':'2026-09-17T10:23:00Z'}
  text=[{**common,'nativeRevisionId':str(i),'operation':op,'text':value,'classification':'TEXT_MANUAL','reasonCode':'RTK_MANUAL_DEGRADED_LOCATOR'} for i,op,value in [(2,'delete','sentinel alpha'),(3,'insert','sentinel round1')]]
  props=[{**common,'nativeRevisionId':'1','propertyKind':'rPrChange','classification':'MANUAL_REVIEW','reasonCode':'RTK_BLOCKED_STRUCTURAL'}]
  returned={'authenticated':True,'sourceMode':'TRACKED','returnedArtifactSha256':'sha256:'+m.digest(xml),'counts':{'textRevisions':2,'propertyRevisions':1,'moveRevisions':0},'canAutoApply':False,'canImportMutate':False,'canWriteStorage':False,'reviewMetadata':{'sourceArtifactSha256':'sha256:'+m.digest(xml),'authority':'ADVISORY_ONLY','timestampPolicy':'LITERAL_WORD_DATE_AND_NAMESPACED_DATE_UTC_NO_NORMALIZATION','textRevisions':text,'propertyRevisions':props}}
  value={'before':{'sceneHashes':['a'*64]},'after':{'sceneHashes':['a'*64]},'explicitCanonicalApplyConfirmed':False,'result':{'ok':True,'commandId':'cmd.project.review.activateDocxReviewPreviewSession','canAutoApply':False,'canImportMutate':False,'canWriteStorage':False,'returnIntake':returned,'formattingProductPath':{'writerCalled':False},'reviewSurface':{'revisionSession':{'reviewGraph':{'textChanges':[{'match':{'quote':'sentinel alpha'},'replacementText':'sentinel round1','createdAt':common['date']}],'diagnosticItems':[{'diagnosticId':'docx-review-diagnostic-RTK_BLOCKED_STRUCTURAL','severity':'warning','message':'Structure and property changes require manual review.'}]}}}}}
  proof=m.review_revision_proof(d,value,1,True);self.assertEqual(proof['textRevisions'],text);self.assertEqual(proof['propertyRevisions'],props)
  rows=m.review_controls(d,value);self.assertEqual([r['id'] for r in rows],m.REVIEW_CONTROLS);self.assertTrue(all(r['rejected'] for r in rows));self.assertEqual(len({r['sha256'] for r in rows}),len(rows))
  for mutate in [lambda v:v['result']['returnIntake']['reviewMetadata'].update(sourceArtifactSha256='sha256:'+'0'*64),lambda v:v['result']['returnIntake']['reviewMetadata'].update(authority='CAN_WRITE'),lambda v:v['result']['returnIntake']['reviewMetadata']['textRevisions'].reverse(),lambda v:v['result']['returnIntake']['counts'].update(propertyRevisions=0)]:
   bad=copy.deepcopy(value);mutate(bad)
   with self.assertRaises(ValueError):m.review_revision_proof(d,bad,1,True)
def test_comment_oracle_matches_raw_namespaces_graph_ranges_and_twelve_mutants(self):
  expected=m.comment_expected('SINGLE_SCENE','C2','project-unit','roman/01_scene-01.txt')
  d=ET.fromstring(document(m.paragraphs(m.expected_docs('SINGLE_SCENE','C2')[0])))
  comments=ET.Element(m.W+'comments');ex=ET.Element(m.C15+'commentsEx');ids=ET.Element(m.CID+'commentsIds');cex=ET.Element(m.CEX+'commentsExtensible')
  ct=ET.Element('{http://schemas.openxmlformats.org/package/2006/content-types}Types')
  rels=ET.Element('{http://schemas.openxmlformats.org/package/2006/relationships}Relationships')
  for n,r in zip(m.COMMENT_PARTS,m.COMMENT_RELATIONSHIPS):
   ET.SubElement(ct,'{http://schemas.openxmlformats.org/package/2006/content-types}Override',PartName='/word/'+n+'.xml',ContentType='application/vnd.openxmlformats-officedocument.wordprocessingml.'+n+'+xml')
   ET.SubElement(rels,'{http://schemas.openxmlformats.org/package/2006/relationships}Relationship',Id=n,Type=r,Target=n+'.xml')
  i=0
  for thread in expected['threads'][:2]:
   p=d.find(m.W+'body').findall(m.W+'p')[thread['anchor']['sceneParagraphIndex']];parent=None;starts=[];ends=[]
   for message in thread['messages']:
    ident=str(i);pid=format(1024+i,'08X');i+=1;durable=m.comment_durable(message['commentId']);pro=message['provenance']
    c=ET.SubElement(comments,m.W+'comment',{m.W+'id':ident,**{m.W+k:pro[k] for k in ['author','initials','date']}})
    cp=ET.SubElement(c,m.W+'p',{m.C14+'paraId':pid});run=ET.SubElement(cp,m.W+'r')
    for atom in __import__('re').split(r'([\t\n])',message['body']):
     if atom in ['\t','\n']:ET.SubElement(run,m.W+('tab' if atom=='\t' else 'br'))
     elif atom:ET.SubElement(run,m.W+'t').text=atom
    ET.SubElement(ex,m.C15+'commentEx',{m.C15+'paraId':pid,m.C15+'done':'1' if thread['status']=='resolved' else '0',**({m.C15+'paraIdParent':parent} if parent else {})})
    ET.SubElement(ids,m.CID+'commentId',{m.CID+'paraId':pid,m.CID+'durableId':durable})
    ET.SubElement(cex,m.CEX+'commentExtensible',{m.CEX+'durableId':durable,m.CEX+'dateUtc':pro['dateUtc']})
    starts.append(ET.Element(m.W+'commentRangeStart',{m.W+'id':ident}));ends.append(ET.Element(m.W+'commentRangeEnd',{m.W+'id':ident}));rr=ET.Element(m.W+'r');ET.SubElement(rr,m.W+'commentReference',{m.W+'id':ident});ends.append(rr)
    if parent is None:parent=pid
   for j,x in enumerate(starts):p.insert(j,x)
   p.extend(ends)
  parts={'[Content_Types].xml':ET.tostring(ct),'word/_rels/document.xml.rels':ET.tostring(rels),'word/document.xml':ET.tostring(d)}
  parts.update({'word/'+name+'.xml':ET.tostring(root) for name,root in zip(m.COMMENT_PARTS,[comments,ex,ids,cex])})
  proof=m.comment_parts(parts,d,expected);self.assertEqual(proof['messageCount'],4);self.assertEqual(proof['intentionalDeletionCount'],1)
  controls=m.comment_controls(parts,d,expected);self.assertEqual([r['id'] for r in controls],m.COMMENT_CONTROLS);self.assertEqual(len(set(r['sha256'] for r in controls)),12)
  # Word may split runs and renumber local IDs; neither operation changes meaning.
  changed=copy.deepcopy(comments);first=changed[0].find('.//'+m.W+'r');atom=first.find(m.W+'t');value=atom.text;atom.text=value[:3];ET.SubElement(first,m.W+'t').text=value[3:]
  # Keep literal order: insert the split atom immediately after the original.
  new=first[-1];first.remove(new);first.insert(list(first).index(atom)+1,new)
  split={**parts,'word/comments.xml':ET.tostring(changed)}
  self.assertEqual(m.comment_parts(split,d,expected)['semanticSha256'],proof['semanticSha256'])
  for mutated in [{**parts,'word/comments.xml':ET.tostring(changed).replace(b'Alice &amp; editor',b'Alice')},
                  {**parts,'[Content_Types].xml':parts['[Content_Types].xml'].replace(b'application/vnd.openxmlformats-officedocument.wordprocessingml.commentsExtended+xml',b'application/vnd.ms-word.commentsExtended+xml')}]:
   with self.assertRaises(ValueError):m.comment_parts(mutated,d,expected)

if __name__=='__main__':unittest.main()

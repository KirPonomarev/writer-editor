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
class ManuscriptOracle(unittest.TestCase):
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
if __name__=='__main__':unittest.main()

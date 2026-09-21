import importlib.util,io,json,os,tempfile,unittest,zipfile
from pathlib import Path
from xml.sax.saxutils import escape
ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('volume',ROOT/'scripts/ops/rtk-interop-word-volume-readback.py');v=importlib.util.module_from_spec(spec);spec.loader.exec_module(v)
def archive(xml,extra=None):
    out=io.BytesIO()
    with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as z:
        z.writestr('word/document.xml',xml)
        for n,b in (extra or {}).items():z.writestr(n,b)
    return out.getvalue()
def document(ps):
    body=''.join('<w:p><w:r><w:t xml:space="preserve">'+escape(p)+'</w:t></w:r></w:p>' for p in ps)
    return ('<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+body+'</w:body></w:document>').encode()
class VolumeOracle(unittest.TestCase):
    def test_fixed_minima_and_all_locale_probes(self):
        for volume,count in v.VOLUMES.items():
            scenes=v.expected_scenes(volume);self.assertEqual(len(scenes),3 if not count else 21)
            ps=v.expected_paragraphs(volume);self.assertTrue(all(p in ps for p in v.PROBES))
            self.assertGreaterEqual(sum(len(p.split()) for p in ps),count)
            changed=[i for i,(a,b) in enumerate(zip(ps,v.expected_paragraphs(volume,True))) if a!=b];self.assertEqual(changed,[0])
    def test_multiscene_complete_raw_corruption_calibration(self):
        b=archive(document(v.expected_paragraphs('MULTI_SCENE')));c=v.controls(b,'MULTI_SCENE')
        self.assertEqual([x['id'] for x in c['rawMutantsExecuted']],v.CONTROLS)
        self.assertEqual(len({x['sha256'] for x in c['rawMutantsExecuted']}),len(v.CONTROLS))
    def test_wrong_volume_cannot_be_relabelled(self):
        for volume in ['FULL_SYNTHETIC_NOVEL','LARGE_DOCUMENT']:
            with self.assertRaisesRegex(ValueError,'MISMATCH'):v.exact(list(v.PROBES),v.expected_paragraphs(volume),'WRONG_VOLUME')
    def test_tail_and_scene_order_are_not_prefix_checks(self):
        e=v.expected_scenes('FULL_SYNTHETIC_NOVEL');x=[p for s in e[1:]+e[:1] for p in s]
        with self.assertRaises(ValueError):v.exact(x,v.expected_paragraphs('FULL_SYNTHETIC_NOVEL'),'REORDER')
        x=v.expected_paragraphs('LARGE_DOCUMENT');x[-1]+='corrupt'
        with self.assertRaises(ValueError):v.exact(x,v.expected_paragraphs('LARGE_DOCUMENT'),'TAIL')
    def test_native_cr_and_spaces_are_literal(self):
        ps=list(v.PROBES);self.assertEqual(v.native(('\r'.join(ps)+'\r').encode()),ps)
        self.assertEqual(v.native(b'first\r\x0csecond\x0cthird\r'),['first','','second','third'])
        for b in [b'no final mark',b'a\n\r']:
            with self.assertRaises(ValueError):v.native(b)
    def test_utf16_envelope_and_optional_metadata(self):
        doc={'type':'doc','content':[{'type':'paragraph','content':[{'type':'text','text':'  Привет 🧑‍💻  '}]},{'type':'paragraph'}]};raw=json.dumps(doc,ensure_ascii=False);b=('[doc-v2 length='+str(len(raw.encode('utf-16-le'))//2)+']\n'+raw+'\n').encode()
        for prefix in [b'', '[meta]\nstatus: черновик\ntags: POV=; линия=; место=\nsynopsis: \n[/meta]\n\n'.encode()]:self.assertEqual(v.scene(prefix+b),['  Привет 🧑‍💻  ',''])
        for bad in [b.replace(b'length=',b'length=1'),b+b'trailing',b.replace(b'paragraph',b'table')]:
            with self.assertRaises((ValueError,json.JSONDecodeError)):v.scene(bad)
    def test_zip_xml_and_unknown_structure_fail_closed(self):
        base=document(list(v.PROBES))
        for b in [archive(base,{'../escape':b'x'}),archive(base,{'x.xml':b'<!DOCTYPE x><x/>'}),archive(base,{'x.rels':b'<Relationships><Relationship TargetMode="External"/></Relationships>'}),archive(base.replace(b'<w:body>',b'<w:body><w:tbl/>')),archive(base.replace(b'<w:t xml:space="preserve">',b'<w:t xml:space="preserve"><w:br/>',1))]:
            with self.assertRaises(ValueError):v.docx(b)
    def test_cached_pagination_marker_has_no_authored_character(self):
        base=document(list(v.PROBES));marked=base.replace(b'</w:t>',b'</w:t><w:lastRenderedPageBreak/>',1)
        self.assertEqual(v.docx(archive(marked))[0],list(v.PROBES))
        for bad in [base.replace(b'</w:t>',b'</w:t><w:br/>',1),base.replace(b'</w:t>',b'</w:t><w:lastRenderedPageBreak><w:t>hidden</w:t></w:lastRenderedPageBreak>',1)]:
            with self.assertRaises(ValueError):v.docx(archive(bad))
    def test_unknown_volume_rejected(self):
        for volume in ['SINGLE_SCENE','one-million','',None]:
            with self.assertRaises(ValueError):v.expected_scenes(volume)
    def test_hash_links_paths_and_bounds_are_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d);p=root/'data';p.write_bytes(b'abc');binding={'path':'data','bytes':3,'sha256':v.digest(b'abc')};self.assertEqual(v.checked_read(root,binding),b'abc')
            for patch in [{'path':'../data'},{'path':'/data'},{'bytes':v.MAX_FILE+1},{'bytes':2},{'sha256':'0'*64}]:
                with self.assertRaises((ValueError,OSError)):v.checked_read(root,{**binding,**patch})
            (root/'link').symlink_to(p)
            with self.assertRaises(OSError):v.checked_read(root,{**binding,'path':'link'})
            os.link(p,root/'hard')
            with self.assertRaises(ValueError):v.checked_read(root,binding)
    def test_no_count_only_or_caller_oracle_can_pass(self):
        for request in [{'root':str(ROOT),'runId':'ORDER__SINGLE_SCENE__C1__SOURCE_RUNTIME__fake'},{'root':str(ROOT),'runId':'ORDER__LARGE_DOCUMENT__C1__SOURCE_RUNTIME__fake','productHead':'a'*40,'productTree':'b'*40,'files':[],'expectedParagraphs':list(v.PROBES),'ok':True}]:
            with self.assertRaises(ValueError):v.audit(request)
if __name__=='__main__':unittest.main()

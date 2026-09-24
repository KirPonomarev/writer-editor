"""Counterexamples for the independent three-scene Office raw oracle."""
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
import xml.etree.ElementTree as ET
import zipfile

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location(
    'c4_multi_raw', ROOT / 'scripts/ops/rtk-interop-c4-google-office-multi-readback.py')
C4 = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(C4)
W = C4.W


def document(returned=False, changed_index=0, native_comment=True, hidden_body=None):
    doc = ET.Element(W + 'document')
    body = ET.SubElement(doc, W + 'body')
    for index in range(35):
        p = ET.SubElement(body, W + 'p')
        if returned and index == 0 and native_comment:
            ET.SubElement(p, W + 'commentRangeStart', {W + 'id': '0'})
        if returned and index == changed_index:
            old = ET.SubElement(p, W + 'del')
            ET.SubElement(ET.SubElement(old, W + 'r'), W + 'delText').text = C4.SOURCE_TOKEN
            new = ET.SubElement(p, W + 'ins')
            ET.SubElement(ET.SubElement(new, W + 'r'), W + 't').text = C4.REVIEWED_TOKEN
        else:
            ET.SubElement(ET.SubElement(p, W + 'r'), W + 't').text = (
                '\u2060' if index == 26 else f'paragraph {index}')
        if returned and index == 0 and native_comment:
            ET.SubElement(p, W + 'commentRangeEnd', {W + 'id': '0'})
            ET.SubElement(ET.SubElement(p, W + 'r'), W + 'commentReference',
                          {W + 'id': '0'})
    if hidden_body:
        extra = ET.SubElement(body, W + hidden_body)
        ET.SubElement(ET.SubElement(ET.SubElement(extra, W + 'p'), W + 'r'),
                      W + 't').text = 'content omitted by a paragraph-only oracle'
    ET.SubElement(body, W + 'sectPr')
    output = io.BytesIO()
    with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as archive:
        archive.writestr('word/document.xml', ET.tostring(doc, encoding='utf-8'))
        if returned:
            comments = ET.Element(W + 'comments')
            comment = ET.SubElement(comments, W + 'comment', {W + 'id': '0'})
            ET.SubElement(ET.SubElement(ET.SubElement(comment, W + 'p'), W + 'r'),
                          W + 't').text = 'Yalken C4 Office-mode synthetic anchor'
            archive.writestr('word/comments.xml', ET.tostring(comments, encoding='utf-8'))
    return output.getvalue()


def scene(paragraphs):
    blocks = [{'type': 'paragraph',
               'content': [{'type': 'text', 'text': value}] if value else []}
              for value in paragraphs]
    return ('[meta]\nstatus: черновик\ntags: POV=; линия=; место=\nsynopsis: \n'
            '[/meta]\n\n[doc-v2 length=1]\n'
            + json.dumps({'type': 'doc', 'content': blocks}, ensure_ascii=False)).encode()


class C4MultiRawOracleTest(unittest.TestCase):
    def test_docx_requires_one_first_paragraph_review_and_anchored_comment(self):
        self.assertEqual(len(C4.docx_paragraphs(document(), False)), 35)
        returned = C4.docx_paragraphs(document(True), True)
        self.assertEqual(returned[0], C4.REVIEWED_TOKEN)
        self.assertEqual(returned[26], '')
        for changed in (document(True, changed_index=1),
                        document(True, native_comment=False),
                        document(False)):
            with self.assertRaisesRegex(ValueError, 'C4_MULTI_'):
                C4.docx_paragraphs(changed, True)
        for hidden in ('tbl', 'sdt', 'customXml'):
            with self.assertRaisesRegex(ValueError, 'C4_MULTI_UNDECLARED_BODY_CONTENT'):
                C4.docx_paragraphs(document(True, hidden_body=hidden), True)

    def test_scene_reader_preserves_empty_and_unicode_paragraphs(self):
        paragraphs = ['A', '', 'é 日本語 👨\u200d👩\u200d👧\u200d👦']
        self.assertEqual(C4.scene_paragraphs(scene(paragraphs)), paragraphs)
        with self.assertRaisesRegex(ValueError, 'C4_MULTI_SCENE_HEADER'):
            C4.scene_paragraphs(scene(paragraphs).replace(
                b'[doc-v2 length=1]', b'[doc-v1 length=1]'))
        with self.assertRaisesRegex(ValueError, 'C4_MULTI_SCENE_METADATA'):
            C4.scene_paragraphs(scene(paragraphs).replace(
                'черновик'.encode(), b'published'))

    def test_rehashed_path_escape_and_duplicate_inventory_still_fail(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            run = 'ORDER__MULTI_SCENE__C4__SOURCE_RUNTIME__test'
            p = root / 'runs' / run
            p.mkdir(parents=True)
            (p / 'proof.json').write_text('{}')
            binding = {'path': f'runs/{run}/proof.json', 'bytes': 2,
                       'sha256': C4.digest(b'{}')}
            self.assertEqual(C4.bound_files(root, run, [binding])['proof.json'], b'{}')
            with self.assertRaisesRegex(ValueError, 'C4_MULTI_INVENTORY_DUPLICATE'):
                C4.bound_files(root, run, [binding, binding])
            with self.assertRaisesRegex(ValueError, 'C4_MULTI_INVENTORY_PATH'):
                C4.bound_files(root, run, [{**binding, 'path': f'runs/{run}/../proof.json'}])
            with self.assertRaisesRegex(ValueError, 'C4_MULTI_FILE_HASH'):
                C4.bound_files(root, run, [{**binding, 'sha256': '0' * 64}])


if __name__ == '__main__':
    unittest.main()

"""C4 raw oracle counterexamples; no Lab receipt or self-PASS is involved."""
import importlib.util
import io
import json
from pathlib import Path
import unittest
import xml.etree.ElementTree as ET
import zipfile


ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location(
    'c4_raw', ROOT / 'scripts/ops/rtk-interop-c4-google-office-readback.py')
C4 = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(C4)
W = C4.W


def document(paragraphs, tracked=False, extra=None):
    doc = ET.Element(W+'document')
    body = ET.SubElement(doc, W+'body')
    for index, value in enumerate(paragraphs):
        paragraph = ET.SubElement(body, W+'p')
        if tracked and index == 0:
            before, after = value.split('sentinel omega')
            ET.SubElement(ET.SubElement(paragraph, W+'r'), W+'t').text = before
            deleted = ET.SubElement(paragraph, W+'del')
            ET.SubElement(ET.SubElement(deleted, W+'r'), W+'delText').text = 'sentinel alpha'
            inserted = ET.SubElement(paragraph, W+'ins')
            ET.SubElement(ET.SubElement(inserted, W+'r'), W+'t').text = 'sentinel omega'
            ET.SubElement(ET.SubElement(paragraph, W+'r'), W+'t').text = after
        elif value:
            ET.SubElement(ET.SubElement(paragraph, W+'r'), W+'t').text = value
    ET.SubElement(body, W+'sectPr')
    xml = ET.tostring(doc, encoding='utf-8') if extra is None else extra
    output = io.BytesIO()
    with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as archive:
        archive.writestr('word/document.xml', xml)
    return output.getvalue()


def scene(paragraphs):
    doc = {'type': 'doc', 'content': [
        {'type': 'paragraph', 'content': [{'type': 'text', 'text': value}]} if value else {'type': 'paragraph'}
        for value in paragraphs]}
    return ('[doc-v2 length=1]\n'+json.dumps(doc, ensure_ascii=False)).encode('utf8')


class C4RawOracleTest(unittest.TestCase):
    def test_raw_docx_and_reopened_scene_agree_on_literal_paragraphs(self):
        self.assertEqual(C4.docx_paragraphs(document(C4.SOURCE), False), list(C4.SOURCE))
        self.assertEqual(C4.docx_paragraphs(document(C4.REVIEWED, True), True), list(C4.REVIEWED))
        self.assertEqual(C4.scene_paragraphs(scene(C4.REVIEWED)), list(C4.REVIEWED))

    def test_reorder_loss_and_forged_review_are_rejected(self):
        for changed in [
            [C4.SOURCE[1], C4.SOURCE[0], *C4.SOURCE[2:]],
            [*C4.SOURCE[:1], *C4.SOURCE[2:]],
            [C4.SOURCE[0].replace('alpha', 'omega'), *C4.SOURCE[1:]],
        ]:
            with self.assertRaises(ValueError):
                C4.docx_paragraphs(document(changed), False)
        with self.assertRaisesRegex(ValueError, 'C4_TRACKED_REVIEW'):
            C4.docx_paragraphs(document(C4.REVIEWED), True)
        with self.assertRaisesRegex(ValueError, 'C4_SCENE_TEXT_ORDER'):
            C4.scene_paragraphs(scene(C4.SOURCE))

    def test_malformed_or_unbounded_container_fails_before_semantic_credit(self):
        with self.assertRaisesRegex(ValueError, 'C4_ZIP_PATH'):
            output = io.BytesIO()
            with zipfile.ZipFile(output, 'w') as archive:
                archive.writestr('../word/document.xml', b'<xml/>')
            C4.docx_paragraphs(output.getvalue(), False)
        with self.assertRaisesRegex(ValueError, 'C4_XML_ENTITY'):
            C4.docx_paragraphs(document(C4.SOURCE, extra=b'<!DOCTYPE x [<!ENTITY a "b">]><x/>'), False)
        with self.assertRaisesRegex(ValueError, 'C4_SCENE_HEADER'):
            C4.scene_paragraphs(b'not-a-doc-v2\n{}')


if __name__ == '__main__':
    unittest.main()

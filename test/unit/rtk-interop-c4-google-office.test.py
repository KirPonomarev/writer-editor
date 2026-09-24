"""C4 raw oracle counterexamples; no Lab receipt or self-PASS is involved."""
import importlib.util
from copy import deepcopy
import hashlib
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


def document(paragraphs, tracked=False, extra=None, comment_paragraph=0,
             comment_end_id='0', comment_reference_id='0', comments_id='0'):
    doc = ET.Element(W+'document')
    body = ET.SubElement(doc, W+'body')
    for index, value in enumerate(paragraphs):
        paragraph = ET.SubElement(body, W+'p')
        if tracked and index == comment_paragraph:
            ET.SubElement(paragraph, W+'commentRangeStart', {W+'id': '0'})
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
        if tracked and index == comment_paragraph:
            ET.SubElement(paragraph, W+'commentRangeEnd', {W+'id': comment_end_id})
            ET.SubElement(ET.SubElement(paragraph, W+'r'), W+'commentReference',
                          {W+'id': comment_reference_id})
    ET.SubElement(body, W+'sectPr')
    xml = ET.tostring(doc, encoding='utf-8') if extra is None else extra
    output = io.BytesIO()
    with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as archive:
        archive.writestr('word/document.xml', xml)
        if tracked:
            comments = ET.Element(W+'comments')
            comment = ET.SubElement(comments, W+'comment', {W+'id': comments_id})
            ET.SubElement(ET.SubElement(ET.SubElement(comment, W+'p'), W+'r'), W+'t').text = 'Anchored review comment'
            archive.writestr('word/comments.xml', ET.tostring(comments, encoding='utf-8'))
    return output.getvalue()


def scene(paragraphs):
    doc = {'type': 'doc', 'content': [
        {'type': 'paragraph', 'content': [{'type': 'text', 'text': value}]} if value else {'type': 'paragraph'}
        for value in paragraphs]}
    return ('[meta]\nstatus: черновик\ntags: POV=; линия=; место=\nsynopsis: \n[/meta]\n\n'
            '[doc-v2 length=1]\n'+json.dumps(doc, ensure_ascii=False)).encode('utf8')


def structure_context():
    scene_id = 'roman/01 Part/01 Chapter/01 Scene.txt'
    source_bytes = '\n'.join(C4.SOURCE).encode('utf8')
    source_hash = hashlib.sha256(source_bytes).hexdigest()
    saved = b'authentic reopened scene bytes'
    saved_hash = hashlib.sha256(saved).hexdigest()
    proof = [{'kind': kind, 'nodeId': key} for kind, key in
             [('part', 'part-id'), ('chapter-folder', 'chapter-id'), ('scene', 'scene-id')]]
    blocks = [{'blockId': 'block-'+str(i), 'paragraphId': 'paragraph-'+str(i),
               'documentParagraphIndex': i,
               'canonicalTextSha256': 'sha256:'+hashlib.sha256(value.encode('utf8')).hexdigest()}
              for i, value in enumerate(C4.SOURCE)]
    return {
        'exportMap': {'schemaVersion': 'yalken.rtk.word-v4.export-map.v1',
                      'scope': 'scene', 'scenes': [{'sceneId': scene_id, 'sceneOrdinal': 0,
                          'sceneRevision': 'sha256:'+source_hash, 'rawSha256': 'sha256:'+source_hash,
                          'blocks': blocks}]},
        'sourceParagraphs': list(C4.SOURCE), 'returnedParagraphs': list(C4.REVIEWED),
        'exportPhase': {'ok': True, 'sceneId': scene_id, 'sourceNodeId': 'scene-id',
                        'sourceAuthoringStrategy': 'PRODUCT_COMMAND_CREATED_NESTED_SCENE',
                        'sourceCreationProof': proof},
        'sourceReadback': {'sceneId': scene_id, 'sourceNodeKind': 'scene',
                           'sourceCreationProof': deepcopy(proof), 'sceneFileSha256': source_hash},
        'intake': {'authenticated': True, 'textChangeCount': 1,
                   'selectedChange': {'changeId': 'change-id',
                                      'targetScope': {'type': 'scene', 'id': scene_id},
                                      'match': {'blockId': 'block-0'},
                                      'documentParagraphIndex': 0, 'paragraphIndex': 0,
                                      'replacementText': 'sentinel omega'}},
        'apply': {'commandId': 'cmd.project.review.applyExactTextChangesBatch',
                  'changeId': 'change-id', 'requestedChangeCount': 1,
                  'mutationOnlyAfterExplicitApply': True, 'saveResult': {'ok': True}},
        'reopen': {'ok': True, 'freshProcess': True, 'sceneId': scene_id,
                   'sceneFileSha256': saved_hash},
        'manifest': {'treeIdentity': {'nodes': {
            'part-id': {'kind': 'part', 'bindingKey': 'file:roman/01 Part', 'present': True},
            'chapter-id': {'kind': 'chapter-folder',
                           'bindingKey': 'file:roman/01 Part/01 Chapter', 'present': True},
            'scene-id': {'kind': 'scene', 'bindingKey': 'file:'+scene_id, 'present': True}}}},
        'loss': {'ok': True, 'itemCount': 0, 'items': []},
        'sourceBytes': source_bytes, 'sceneBytes': saved,
    }


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

    def test_native_comment_must_bind_to_reviewed_first_paragraph_and_payload(self):
        for kwargs in ({'comment_paragraph': 1}, {'comment_end_id': '1'},
                       {'comment_reference_id': '1'}):
            with self.subTest(kwargs=kwargs), self.assertRaisesRegex(ValueError, 'C4_COMMENT_ANCHOR'):
                C4.docx_paragraphs(document(C4.REVIEWED, True, **kwargs), True)
        with self.assertRaisesRegex(ValueError, 'C4_COMMENT_PAYLOAD'):
            C4.docx_paragraphs(document(C4.REVIEWED, True, comments_id='1'), True)

    def test_malformed_or_unbounded_container_fails_before_semantic_credit(self):
        with self.assertRaisesRegex(ValueError, 'C4_ZIP_PATH'):
            output = io.BytesIO()
            with zipfile.ZipFile(output, 'w') as archive:
                archive.writestr('../word/document.xml', b'<xml/>')
            C4.docx_paragraphs(output.getvalue(), False)
        with self.assertRaisesRegex(ValueError, 'C4_XML_ENTITY'):
            C4.docx_paragraphs(document(C4.SOURCE, extra=b'<!DOCTYPE x [<!ENTITY a "b">]><x/>'), False)
        with self.assertRaisesRegex(ValueError, 'C4_SCENE_HEADER'):
            C4.scene_paragraphs(scene(C4.REVIEWED).replace(b'[doc-v2 length=1]', b'not-a-doc-v2'))
        with self.assertRaisesRegex(ValueError, 'C4_SCENE_METADATA'):
            C4.scene_paragraphs(scene(C4.REVIEWED).replace('черновик'.encode('utf8'), b'published'))


class C4StructureOracleTest(unittest.TestCase):
    def test_real_scene_hierarchy_range_and_target_are_jointly_required(self):
        context = structure_context()
        proof = C4.validate_structure_core(context)
        self.assertEqual(proof['sceneCount'], 1)
        self.assertEqual(proof['sourceRange'], [0, len(C4.SOURCE)-1])
        self.assertEqual(proof['subcases'], list(C4.STRUCTURE_SUBCASES))
        controls = C4.structure_controls(context)
        self.assertEqual(len(controls), 7)
        self.assertTrue(all(row['rejected'] for row in controls))

    def test_noncontiguous_map_wrong_target_and_rebound_tree_fail_closed(self):
        mutations = [
            lambda x: x['exportMap']['scenes'][0]['blocks'][1].update(documentParagraphIndex=0),
            lambda x: x['exportMap']['scenes'][0]['blocks'][1].update(blockId='block-0'),
            lambda x: x['exportMap']['scenes'][0]['blocks'][1].update(canonicalTextSha256='sha256:'+'0'*64),
            lambda x: x['intake']['selectedChange']['targetScope'].update(id='roman/other.txt'),
            lambda x: x['manifest']['treeIdentity']['nodes']['chapter-id'].update(present=False),
            lambda x: x['manifest']['treeIdentity']['nodes']['scene-id'].update(bindingKey='file:roman/blob.txt'),
            lambda x: x['returnedParagraphs'].pop(),
            lambda x: x['loss'].update(itemCount=1, items=['structure-loss']),
        ]
        for change in mutations:
            with self.subTest(change=change), self.assertRaises(ValueError):
                context = structure_context()
                change(context)
                C4.validate_structure_core(context)

    def test_untrusted_transport_rejects_duplicate_keys_and_xml_entities(self):
        with self.assertRaisesRegex(ValueError, 'C4_STRUCTURE_DUPLICATE_JSON_KEY'):
            C4.strict_json('{"sceneId":"one","sceneId":"two"}')
        payload = ('<yrtk:reviewTransport xmlns:yrtk="urn:yalken:rtk:word-review-packet:v1" '
                   'authorityRole="advisory-not-apply-authority"><yrtk:payload encoding="json">'
                   '{"schemaVersion":"yalken.rtk.word.product-review-docx-export.advisory-manifest.v1",'
                   '"coreManifest":{"exportMap":{"scope":"scene"}}}'
                   '</yrtk:payload></yrtk:reviewTransport>').encode()
        zipped = io.BytesIO()
        with zipfile.ZipFile(zipped, 'w') as archive:
            archive.writestr('customXml/item1.xml', payload)
        self.assertEqual(C4.source_export_map(zipped.getvalue())[0]['scope'], 'scene')
        with self.assertRaisesRegex(ValueError, 'C4_STRUCTURE_MAP_XML_BOUNDS'):
            poisoned = io.BytesIO()
            with zipfile.ZipFile(poisoned, 'w') as archive:
                archive.writestr('customXml/item1.xml', b'<!DOCTYPE x [<!ENTITY x "y">]>'+payload)
            C4.source_export_map(poisoned.getvalue())


if __name__ == '__main__':
    unittest.main()

import copy
import html
import importlib.util
import json
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

spec = importlib.util.spec_from_file_location('c2_final_hops', Path(__file__).resolve().parents[2] / 'scripts/ops/rtk-interop-c2-final-hops.py')
checker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(checker)
EXPECTED, REVIEWED, check_c2_final_hops = checker.EXPECTED, checker.REVIEWED, checker.check_c2_final_hops


RUN_ID = 'TEXT__SINGLE_SCENE__C2__SOURCE_RUNTIME__UNIT'


def _docx(paragraphs):
    body = []
    for paragraph in paragraphs:
        if paragraph == '':
            body.append('<w:p/>')
        else:
            body.append(
                '<w:p><w:r><w:t xml:space="preserve">'
                + html.escape(paragraph)
                + '</w:t></w:r></w:p>'
            )
    document = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        '<w:body>' + ''.join(body) + '</w:body></w:document>'
    ).encode('utf-8')
    with tempfile.NamedTemporaryFile(suffix='.docx') as temporary:
        # The temporary archive is used only as a byte builder; the returned
        # bytes are copied into the synthetic run below.
        with zipfile.ZipFile(temporary, 'w', zipfile.ZIP_DEFLATED) as archive:
            archive.writestr('[Content_Types].xml', '<Types/>')
            archive.writestr('word/document.xml', document)
            archive.writestr('docProps/custom.xml', '<Properties>' + ''.join(
                f'<property name="{key}"><value>unit-{key}</value></property>'
                for key in ('YRTK_C01_AUTH', 'YRTK2_TOKEN', 'YRTK_CORE_DIGEST')) + '</Properties>')
        temporary.seek(0)
        return temporary.read()


def _scene(paragraphs):
    doc = {
        'type': 'doc',
        'content': [
            {'type': 'paragraph', **({'content': [{'type': 'text', 'text': p}]} if p else {})}
            for p in paragraphs
        ],
    }
    serialized = json.dumps(doc, ensure_ascii=False, separators=(',', ':'))
    return (f'[doc-v2 length={len(serialized.encode("utf-16-le")) // 2}]\n' + serialized).encode('utf-8')


class SyntheticC2Fixture:
    def __init__(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)
        self.run = self.root / 'runs' / RUN_ID
        (self.run / 'runtime-project-snapshot' / 'roman').mkdir(parents=True)
        (self.run / 'final-word').mkdir()
        self.scene = self.run / 'runtime-project-snapshot' / 'roman' / 'черновик.txt'
        self.descriptors = []

        self._put('source-text', b'\n'.join(p.encode('utf-8') for p in EXPECTED))
        self._put('source-docx', _docx(EXPECTED))
        self._put_json('source-review-export-phase', {
            'projectId': 'project-unit', 'sceneId': 'roman/черновик.txt', 'sourceNodeId': 'node-unit',
        })
        self._put('returned-docx', _docx(REVIEWED))
        self._put('canonical-c2-reexport-docx', _docx(REVIEWED))
        self.scene.write_bytes(_scene(REVIEWED))
        self._put('canonical-c2-final-word-docx', _docx(REVIEWED), 'final-word/word-final.docx')
        self._put('canonical-c2-final-word-native-text', ('\r'.join(REVIEWED) + '\r').encode('utf-8'), 'final-word/word-native-readback.txt')
        self._put('canonical-c2-final-word-screenshot', b'png-synthetic', 'final-word/word-final.png')
        self._put('canonical-c2-final-word-script', b'applescript-synthetic', 'final-word/m1-word.applescript')

        scene_descriptor = self._descriptor('runtime-project-snapshot/roman/черновик.txt', self.scene.read_bytes())
        snapshot = {'schemaVersion': 'synthetic', 'files': [scene_descriptor]}
        snapshot_path = self.run / 'runtime-project-snapshot.json'
        snapshot_path.write_text(json.dumps(snapshot, ensure_ascii=False), encoding='utf-8')
        self._put('runtime-project-snapshot', snapshot_path.read_bytes(), 'runtime-project-snapshot.json')

        receipt = {
            'schemaVersion': 'yalken.portability.lab.v2.c2-canonical-reexport',
            'commandId': 'cmd.project.review.exportDocxReviewPacket',
            'projectId': 'project-unit', 'sceneId': 'roman/черновик.txt', 'nodeId': 'node-unit',
            'reexportResult': {
                'ok': True, 'exported': True, 'commandId': 'cmd.project.review.exportDocxReviewPacket',
                'bytesWritten': self._by_kind()['canonical-c2-reexport-docx']['bytes'],
                'exportCapsule': {
                    'projectId': 'project-unit', 'sceneId': 'roman/черновик.txt',
                    'rawSha256': 'sha256:' + self._sha(self.scene.read_bytes()),
                    'sceneRevision': 'sha256:' + self._sha(self.scene.read_bytes()), 'blockCount': 12,
                },
            },
            'beforeSceneSha256': self._sha(self.scene.read_bytes()),
            'afterSceneSha256': self._sha(self.scene.read_bytes()),
            'sourceReviewedDocxSha256': self._by_kind()['returned-docx']['sha256'],
            'reexportDocxSha256': self._by_kind()['canonical-c2-reexport-docx']['sha256'],
        }
        self._put_json('canonical-c2-reexport-receipt', receipt)

        final_lifecycle = {
            'status': 'PASS',
            'process': {
                'status': 0,
                'stdout': 'WORD_STATUS=PASS\nDOCUMENTS_BEFORE=0\nDOCUMENTS_AFTER=0\n',
            },
            'compileProcess': {'status': 0},
            'cleanupOk': True,
            'nativeReadback': {'ok': True, 'paragraphs': list(REVIEWED)},
            'evidencePath': 'runs/' + RUN_ID + '/final-word/word-final.docx',
            'nativeReadbackPath': 'runs/' + RUN_ID + '/final-word/word-native-readback.txt',
            'scriptPath': 'runs/' + RUN_ID + '/final-word/m1-word.applescript',
            'screenshotPath': 'runs/' + RUN_ID + '/final-word/word-final.png',
            'sourceDocxHash': self._by_kind()['canonical-c2-reexport-docx']['sha256'],
            'preOpenHash': self._by_kind()['canonical-c2-reexport-docx']['sha256'],
            'postWordHash': self._by_kind()['canonical-c2-final-word-docx']['sha256'],
            'copiedBackHash': self._by_kind()['canonical-c2-final-word-docx']['sha256'],
            'sourceToStagingHashOk': True,
            'stagingToEvidenceHashOk': True,
        }
        self._put_json('canonical-c2-final-word-lifecycle', final_lifecycle)

        reopen = {
            'schemaVersion': 'yalken.portability.lab.v2.c2-source-review-reopen-phase',
            'ok': True, 'freshProcess': True, 'sceneId': 'roman/черновик.txt',
            'reopenResult': {'ok': True, 'documentId': 'node-unit'},
            'sceneFileSha256': self._sha(self.scene.read_bytes()),
            'rendererParagraphs': list(REVIEWED),
            'sceneReadback': {'ok': True, 'paragraphs': list(REVIEWED)},
        }
        self._put_json('source-review-reopen-phase', reopen)

        self.observation = {
            'status': 'PASS', 'runId': RUN_ID, 'route': 'C2', 'field': 'TEXT',
            'cellId': RUN_ID.rsplit('__', 1)[0],
            'volume': 'SINGLE_SCENE', 'profile': 'SOURCE_RUNTIME',
            'candidateDiagnosticOnly': False,
            'canonicalC2': {
                'complete': True, 'sceneUnchangedDuringReexport': True,
                'reexportDocxSha256': self._by_kind()['canonical-c2-reexport-docx']['sha256'],
                'finalWordDocxSha256': self._by_kind()['canonical-c2-final-word-docx']['sha256'],
                'finalWordNativeTextSha256': self._by_kind()['canonical-c2-final-word-native-text']['sha256'],
            },
            'freshReopen': {'ok': True, 'sceneFileSha256': self._sha(self.scene.read_bytes())},
            'reviewExport': {
                'commandPath': 'electron.commandBridge.cmd.project.review.exportDocxReviewPacket',
                'sourceDocxSha256': self._by_kind()['source-docx']['sha256'],
            },
            'reviewReturnIntake': {'authenticated': True, 'prepared': True, 'noMutationDuringIntake': True},
            'explicitApply': {'applied': True, 'saved': True, 'writerCalled': True, 'editorSyncOk': True},
            'sourceAuthoringPrecondition': {'ok': True},
            'oracles': {name: 'PASS' for name in (
                'source-authoring-precondition', 'semantic', 'structure', 'order',
                'provenance', 'loss', 'independent-readback', 'cleanup',
                'format-roundtrip', 'path-authority', 'hash-binding', 'locale-font',
                'negative-mutation',
            )},
            'artifacts': self.descriptors,
        }
        reopen['canonicalC2'] = self.observation['canonicalC2']
        self.replace_json('source-review-reopen-phase', reopen)

    @staticmethod
    def _sha(data):
        import hashlib
        return hashlib.sha256(data).hexdigest()

    def _descriptor(self, relative, data):
        return {'path': 'runs/' + RUN_ID + '/' + relative, 'bytes': len(data), 'sha256': self._sha(data)}

    def _put(self, kind, data, relative=None):
        relative = relative or kind + ('.txt' if kind == 'source-text' else '.docx')
        path = self.run / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        self.descriptors.append({'kind': kind, **self._descriptor(relative, data)})

    def _put_json(self, kind, value):
        self._put(kind, json.dumps(value, ensure_ascii=False, separators=(',', ':')).encode('utf-8'), kind + '.json')

    def _by_kind(self):
        return {item['kind']: item for item in self.descriptors}

    def replace(self, kind, data):
        descriptor = self._by_kind()[kind]
        (self.root / descriptor['path']).write_bytes(data)
        descriptor.update(bytes=len(data), sha256=self._sha(data))

    def read_json(self, kind):
        return json.loads((self.root / self._by_kind()[kind]['path']).read_bytes())

    def replace_json(self, kind, value):
        self.replace(kind, json.dumps(value, ensure_ascii=False).encode('utf-8'))

    def by_kind(self):
        return copy.deepcopy(self._by_kind())

    def close(self):
        self.temporary.cleanup()


class C2FinalHopsTests(unittest.TestCase):
    def make(self):
        fixture = SyntheticC2Fixture()
        self.addCleanup(fixture.close)
        return fixture

    def check(self, fixture, observation=None, by_kind=None, expected=EXPECTED, scene=None):
        return check_c2_final_hops(
            fixture.root, fixture.run, observation or fixture.observation,
            by_kind or fixture.by_kind(), expected, scene or fixture.scene,
        )

    def test_positive_full_route(self):
        result = self.check(self.make())
        self.assertTrue(result['ok'], result)
        self.assertEqual(result['acceptanceCredit'], 0)
        self.assertEqual(result['summary']['paragraphCount'], 12)

    def test_missing_final_hop_is_rejected(self):
        fixture = self.make()
        observation = copy.deepcopy(fixture.observation)
        observation['artifacts'] = [a for a in observation['artifacts'] if a['kind'] != 'canonical-c2-final-word-native-text']
        by_kind = fixture.by_kind()
        by_kind.pop('canonical-c2-final-word-native-text')
        result = self.check(fixture, observation, by_kind)
        self.assertFalse(result['ok'])
        self.assertEqual(result['findings'][0]['code'], 'REQUIRED_FINAL_HOP_MISSING')

    def test_text_order_space_and_unicode_mutations_rejected(self):
        mutations = [
            list(REVIEWED[:-1]) + ['changed final text'],
            [REVIEWED[1], REVIEWED[0]] + list(REVIEWED[2:]),
            [REVIEWED[0].replace('omega', 'omega ') if i == 0 else p for i, p in enumerate(REVIEWED)],
            [REVIEWED[0].replace('omega', 'Ωmega')] + list(REVIEWED[1:]),
        ]
        for paragraphs in mutations:
            fixture = self.make()
            fixture.replace('canonical-c2-final-word-docx', _docx(paragraphs))
            descriptor = fixture._by_kind()['canonical-c2-final-word-docx']
            fixture.observation['canonicalC2']['finalWordDocxSha256'] = descriptor['sha256']
            lifecycle = fixture.read_json('canonical-c2-final-word-lifecycle')
            lifecycle.update(postWordHash=descriptor['sha256'], copiedBackHash=descriptor['sha256'])
            fixture.replace_json('canonical-c2-final-word-lifecycle', lifecycle)
            reopen = fixture.read_json('source-review-reopen-phase')
            reopen['canonicalC2'] = fixture.observation['canonicalC2']
            fixture.replace_json('source-review-reopen-phase', reopen)
            result = self.check(fixture)
            self.assertFalse(result['ok'], paragraphs)
            self.assertEqual(result['findings'][0]['code'], 'FINAL_WORD_DOCX_PARAGRAPH_MISMATCH')

    def test_fake_hash_is_rejected(self):
        fixture = self.make()
        by_kind = fixture.by_kind()
        by_kind['canonical-c2-reexport-docx']['sha256'] = '0' * 64
        result = self.check(fixture, by_kind=by_kind)
        self.assertFalse(result['ok'])
        self.assertEqual(result['findings'][0]['code'], 'BY_KIND_DESCRIPTOR_MISMATCH')

    def test_scene_identity_and_scene_hash_are_rejected(self):
        fixture = self.make()
        observation = copy.deepcopy(fixture.observation)
        receipt_path = fixture.run / 'canonical-c2-reexport-receipt.json'
        receipt = json.loads(receipt_path.read_text(encoding='utf-8'))
        receipt['sceneId'] = 'other-scene'
        receipt_path.write_text(json.dumps(receipt), encoding='utf-8')
        receipt_descriptor = next(item for item in fixture.observation['artifacts'] if item['kind'] == 'canonical-c2-reexport-receipt')
        receipt_descriptor['bytes'] = receipt_path.stat().st_size
        receipt_descriptor['sha256'] = fixture._sha(receipt_path.read_bytes())
        copied_receipt_descriptor = next(item for item in observation['artifacts'] if item['kind'] == 'canonical-c2-reexport-receipt')
        copied_receipt_descriptor.update(bytes=receipt_descriptor['bytes'], sha256=receipt_descriptor['sha256'])
        result = self.check(fixture, observation)
        self.assertFalse(result['ok'])
        self.assertEqual(result['findings'][0]['code'], 'REEXPORT_SCENE_ID_MISMATCH')

        fixture = self.make()
        observation = copy.deepcopy(fixture.observation)
        observation['freshReopen']['sceneFileSha256'] = '0' * 64
        result = self.check(fixture, observation)
        self.assertFalse(result['ok'])
        self.assertEqual(result['findings'][0]['code'], 'OBSERVATION_REOPEN_BINDING_MISMATCH')

    def test_failed_lifecycle_is_rejected(self):
        fixture = self.make()
        lifecycle_path = fixture.run / 'canonical-c2-final-word-lifecycle.json'
        lifecycle = json.loads(lifecycle_path.read_text(encoding='utf-8'))
        lifecycle['process']['status'] = 1
        fixture.replace_json('canonical-c2-final-word-lifecycle', lifecycle)
        result = self.check(fixture)
        self.assertFalse(result['ok'])
        self.assertEqual(result['findings'][0]['code'], 'LIFECYCLE_PROCESS_FAILED')

    def test_wrong_project_and_node_are_rejected_with_rebound_hashes(self):
        for key in ('projectId', 'nodeId'):
            fixture = self.make()
            receipt = fixture.read_json('canonical-c2-reexport-receipt')
            receipt[key] = 'other-' + key
            fixture.replace_json('canonical-c2-reexport-receipt', receipt)
            result = self.check(fixture)
            self.assertEqual(result['findings'][0]['code'], 'REEXPORT_PROJECT_NODE_IDENTITY_MISMATCH')

    def test_raw_native_loss_is_rejected_with_rebound_hashes(self):
        fixture = self.make()
        fixture.replace('canonical-c2-final-word-native-text', ('\r'.join(REVIEWED).replace('\u200d', '') + '\r').encode('utf-8'))
        fixture.observation['canonicalC2']['finalWordNativeTextSha256'] = fixture._by_kind()['canonical-c2-final-word-native-text']['sha256']
        result = self.check(fixture)
        self.assertEqual(result['findings'][0]['code'], 'FINAL_WORD_NATIVE_TEXT_MISMATCH')

    def test_scrubbed_paths_are_supported(self):
        fixture = self.make()
        lifecycle = fixture.read_json('canonical-c2-final-word-lifecycle')
        for key in ('evidencePath', 'nativeReadbackPath', 'scriptPath', 'screenshotPath'):
            lifecycle[key] = '[LAB_ROOT]/' + lifecycle[key]
        fixture.replace_json('canonical-c2-final-word-lifecycle', lifecycle)
        self.assertTrue(self.check(fixture)['ok'])

    def test_candidate_requires_explicit_diagnostic_mode_and_never_earns_credit(self):
        fixture = self.make()
        fixture.observation['candidateDiagnosticOnly'] = True
        self.assertEqual(self.check(fixture)['findings'][0]['code'], 'CANDIDATE_DIAGNOSTIC_ONLY')
        result = check_c2_final_hops(fixture.root, fixture.run, fixture.observation,
                                    fixture.by_kind(), EXPECTED, fixture.scene, allow_candidate=True)
        self.assertTrue(result['ok'], result)
        self.assertEqual(result['acceptanceCredit'], 0)

    def test_swapped_source_profile_is_rejected(self):
        fixture = self.make()
        observation = copy.deepcopy(fixture.observation)
        observation['profile'] = 'PACKAGED_BUILD_RUNTIME'
        result = self.check(fixture, observation)
        self.assertFalse(result['ok'])
        self.assertEqual(result['findings'][0]['code'], 'PROFILE_RUN_ID_MISMATCH')

    def test_path_escape_is_rejected(self):
        fixture = self.make()
        outside = fixture.root / 'outside.docx'
        outside.write_bytes((fixture.run / 'source-docx.docx').read_bytes())
        observation = copy.deepcopy(fixture.observation)
        by_kind = fixture.by_kind()
        descriptor = next(item for item in observation['artifacts'] if item['kind'] == 'canonical-c2-reexport-docx')
        descriptor['path'] = 'outside.docx'
        by_kind['canonical-c2-reexport-docx'] = descriptor
        result = self.check(fixture, observation, by_kind)
        self.assertFalse(result['ok'])
        self.assertEqual(result['findings'][0]['code'], 'PATH_ESCAPE')

    def test_caller_cannot_replace_independent_expected_oracle(self):
        fixture = self.make()
        result = self.check(fixture, expected=list(REVIEWED))
        self.assertFalse(result['ok'])
        self.assertEqual(result['findings'][0]['code'], 'EXPECTED_PARAGRAPHS_ORACLE_MISMATCH')

    def test_scene_envelope_length_and_unsupported_structure_fail_closed(self):
        valid = _scene(REVIEWED)
        self.assertEqual(checker._scene_paragraphs(valid), list(REVIEWED))
        for invalid in [b'[doc-v2 length=0]\n' + valid.split(b'\n', 1)[1], valid + b'{}',
                        valid.replace(b'"type":"paragraph"', b'"type":"blockXXXX"', 1)]:
            with self.assertRaises(checker._Reject):
                checker._scene_paragraphs(invalid)

    def test_parent_symlink_cannot_supply_an_artifact_with_matching_bytes(self):
        fixture = self.make()
        alias = fixture.run / 'alias'
        alias.symlink_to(fixture.run / 'final-word', target_is_directory=True)
        descriptor = fixture._by_kind()['canonical-c2-final-word-docx']
        descriptor['path'] = 'runs/' + RUN_ID + '/alias/word-final.docx'
        result = self.check(fixture)
        self.assertEqual(result['findings'][0]['code'], 'SYMLINK_ARTIFACT')

    def test_complete_reader_rejects_unknown_review_grammar_and_calibrates_raw_controls(self):
        spec = importlib.util.spec_from_file_location('batch_reader', Path(__file__).resolve().parents[2] / 'scripts/ops/rtk-interop-word-text-order-readback.py')
        reader = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(reader)
        source = _docx(EXPECTED)
        paragraphs, document = reader.tracked_docx(source)
        reader.exact(paragraphs, EXPECTED, 'VALID')
        controls = reader.text.text_controls(source)
        self.assertEqual(len(controls['rawMutantsExecuted']), 10)
        self.assertEqual(len(reader.order.semantic_controls(source)['orderMutantsExecuted']), 24)
        table = reader.ET.SubElement(document.find(reader.W + 'body'), reader.W + 'tbl')
        reader.ET.SubElement(table, reader.W + 'p')
        with self.assertRaisesRegex(ValueError, 'TRACKED_BODY'):
            reader.tracked_docx(reader.order.replace_document(source, document))


if __name__ == '__main__':
    unittest.main(verbosity=2)

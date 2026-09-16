"""Independent, zero-credit checker for the C2 final reexport/readback hops.

The checker intentionally has no dependency on Yalken code, the Lab semantic
oracle, Word, Electron, or a network.  It validates raw artifacts and returns
a JSON-compatible diagnostic object.  A receipt or a precomputed PASS field
is never sufficient evidence.
"""

from __future__ import annotations

import datetime as _datetime
import hashlib
import json
import re
import time
import zipfile
from pathlib import Path
import xml.etree.ElementTree as ET


# Keep this specification local and immutable.  The caller-provided list is
# accepted only after exact equality with this independent oracle.
EXPECTED = (
    '[plainTextPreserved] Body text sentinel alpha.',
    '',
    '[latin-basic] Plain ASCII text survives Word and Yalken return.',
    '[latin-diacritic] Café naïve façade coöperate jalapeño résumé.',
    '[cyrillic] Привет мир. Текст сцены сохраняется.',
    '[greek] Καλημέρα κόσμε. Το κείμενο παραμένει.',
    '[cjk] 中文文本保留。日本語の本文も保持。한국어 문장도 유지.',
    '[rtl-hebrew] שלום עולם. טקסט בעברית נשמר.',
    '[emoji-zwj] Family 👨‍👩‍👧‍👦 and technologist 🧑‍💻 stay intact.',
    '  [whitespaceEdgesPreserved] leading and trailing spaces stay here  ',
    '',
    '[paragraphBoundariesPreserved] Final paragraph after an intentional empty paragraph.',
)
REVIEWED = tuple(value.replace('sentinel alpha', 'sentinel omega') for value in EXPECTED)

_W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
_MAX_FILE = 8 * 1024 * 1024
_RUN_ID = re.compile(
    r'^(?P<field>TEXT|ORDER)__SINGLE_SCENE__C2__'
    r'(?P<profile>SOURCE_RUNTIME|PACKAGED_BUILD_RUNTIME)__(?P<suffix>[A-Za-z0-9_-]+)$'
)
_REQUIRED_KINDS = (
    'source-text',
    'source-docx',
    'source-review-export-phase',
    'returned-docx',
    'canonical-c2-reexport-receipt',
    'canonical-c2-reexport-docx',
    'canonical-c2-final-word-lifecycle',
    'canonical-c2-final-word-docx',
    'canonical-c2-final-word-native-text',
    'canonical-c2-final-word-screenshot',
    'canonical-c2-final-word-script',
    'source-review-reopen-phase',
    'runtime-project-snapshot',
)


class _Reject(Exception):
    def __init__(self, code: str, detail: str = '') -> None:
        self.code = code
        self.detail = detail
        super().__init__(f'{code}: {detail}' if detail else code)


def _sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _plain(value) -> bool:
    return isinstance(value, dict) and type(value) is dict


def _same_path(left: Path, right: Path) -> bool:
    return left.resolve() == right.resolve()


def _inside(path: Path, parent: Path) -> bool:
    try:
        path.resolve().relative_to(parent.resolve())
        return True
    except ValueError:
        return False


def _require(condition: bool, code: str, detail: str = '') -> None:
    if not condition:
        raise _Reject(code, detail)


def _json_file(path: Path):
    try:
        with path.open('r', encoding='utf-8', newline='') as handle:
            return json.load(handle)
    except (OSError, UnicodeError, json.JSONDecodeError) as error:
        raise _Reject('JSON_READ_FAILED', f'{path.name}: {error}') from error


def _regular_file(path: Path, run_dir: Path, label: str) -> bytes:
    _require(not path.is_symlink(), 'SYMLINK_ARTIFACT', label)
    _require(_inside(path, run_dir), 'PATH_ESCAPE', label)
    _require(path.is_file(), 'MISSING_ARTIFACT', label)
    _require(path.stat().st_nlink == 1, 'NON_IMMUTABLE_ARTIFACT', label)
    _require(path.stat().st_size <= _MAX_FILE, 'ARTIFACT_TOO_LARGE', label)
    try:
        return path.read_bytes()
    except OSError as error:
        raise _Reject('ARTIFACT_READ_FAILED', f'{label}: {error}') from error


def _artifact_path(root: Path, run_dir: Path, descriptor: dict, label: str) -> Path:
    _require(_plain(descriptor), 'ARTIFACT_DESCRIPTOR_INVALID', label)
    raw_path = descriptor.get('path')
    _require(isinstance(raw_path, str) and raw_path and not Path(raw_path).is_absolute(),
             'ARTIFACT_PATH_INVALID', label)
    _require(all(part and part not in ('.', '..') and '\\' not in part for part in raw_path.split('/')),
             'ARTIFACT_PATH_INVALID', label)
    unresolved = root / raw_path
    cursor = root
    for part in raw_path.split('/'):
        cursor = cursor / part
        _require(not cursor.is_symlink(), 'SYMLINK_ARTIFACT', label)
    _require(not unresolved.is_symlink(), 'SYMLINK_ARTIFACT', label)
    path = unresolved.resolve()
    _require(_inside(path, run_dir), 'PATH_ESCAPE', f'{label}:{raw_path}')
    data = _regular_file(path, run_dir, label)
    _require(type(descriptor.get('bytes')) is int and 0 <= descriptor['bytes'] <= _MAX_FILE,
             'ARTIFACT_LENGTH_INVALID', label)
    _require(isinstance(descriptor.get('sha256'), str)
             and re.fullmatch(r'[0-9a-f]{64}', descriptor['sha256']),
             'ARTIFACT_HASH_INVALID', label)
    _require(len(data) == descriptor['bytes'] and _sha(data) == descriptor['sha256'],
             'ARTIFACT_HASH_OR_LENGTH_MISMATCH', label)
    return path


def _visible(node: ET.Element) -> str:
    if node.tag == _W + 'del':
        return ''
    if node.tag == _W + 't':
        return node.text or ''
    if node.tag == _W + 'tab':
        return '\t'
    if node.tag == _W + 'br':
        return '\n'
    return ''.join(_visible(child) for child in node)


def _docx_paragraphs(path: Path) -> tuple[list[str], ET.Element, dict[str, str]]:
    try:
        with zipfile.ZipFile(path) as archive:
            names = archive.namelist()
            _require(0 < len(names) <= 128 and sum(m.file_size for m in archive.infolist()) <= _MAX_FILE,
                     'DOCX_BOUNDS', path.name)
            _require(all(not n.startswith('/') and all(p and p not in ('.', '..') and '\\' not in p
                         for p in n.split('/')) for n in names), 'DOCX_PATH_INVALID')
            _require(all(not m.flag_bits & 1 for m in archive.infolist()), 'DOCX_ENCRYPTED')
            _require(len(names) == len(set(names)), 'DOCX_DUPLICATE_ZIP_ENTRY', path.name)
            _require(archive.testzip() is None, 'DOCX_ZIP_CRC_FAILED', path.name)
            _require('word/document.xml' in names, 'DOCX_DOCUMENT_XML_MISSING', path.name)
            xml = archive.read('word/document.xml')
            _require(b'<!DOCTYPE' not in xml.upper() and b'<!ENTITY' not in xml.upper(), 'DOCX_DTD')
            document = ET.fromstring(xml)
            _require(document.tag == _W + 'document' and document.find(_W + 'body') is not None,
                     'DOCX_DOCUMENT_SHAPE')
            props = {}
            if 'docProps/custom.xml' in names:
                custom = ET.fromstring(archive.read('docProps/custom.xml'))
                props = {
                    item.get('name'): ''.join(item.itertext())
                    for item in custom
                    if item.get('name')
                }
    except _Reject:
        raise
    except (OSError, zipfile.BadZipFile, ET.ParseError, KeyError) as error:
        raise _Reject('DOCX_READ_FAILED', f'{path.name}: {error}') from error
    return [_visible(node) for node in document.iter(_W + 'p')], document, props


def _read_utf8_raw(path: Path, run_dir: Path, label: str) -> bytes:
    return _regular_file(path, run_dir, label)


def _word_native_paragraphs(raw: bytes) -> list[str]:
    _require(raw.endswith(b'\r'), 'WORD_READBACK_FINAL_CR_MISSING')
    try:
        text = raw[:-1].decode('utf-8')
    except UnicodeDecodeError as error:
        raise _Reject('WORD_READBACK_NOT_UTF8', str(error)) from error
    # split, deliberately: no trim(), splitlines(), or Unicode normalization.
    return text.split('\r')


def _resolve_scene(root: Path, run_dir: Path, value) -> Path:
    _require(isinstance(value, (str, Path)) and str(value), 'SCENE_PATH_MISSING')
    candidate = Path(value)
    if not candidate.is_absolute():
        candidate = root / candidate
    _require(not candidate.is_symlink(), 'SYMLINK_ARTIFACT', 'scene_path')
    candidate = candidate.resolve()
    _require(_inside(candidate, run_dir), 'PATH_ESCAPE', 'scene_path')
    _regular_file(candidate, run_dir, 'scene_path')
    return candidate


def _scene_paragraphs(raw: bytes) -> list[str]:
    try:
        text = raw.decode('utf-8')
    except UnicodeDecodeError as error:
        raise _Reject('SCENE_NOT_UTF8', str(error)) from error
    _require(text.startswith('[doc-v2 length=') and '\n' in text, 'SCENE_ENCODING_INVALID')
    serialized = text.split('\n', 1)[1]
    try:
        document, end = json.JSONDecoder().raw_decode(serialized)
    except json.JSONDecodeError as error:
        raise _Reject('SCENE_JSON_INVALID', str(error)) from error
    _require(not serialized[end:].strip(), 'SCENE_TRAILING_PAYLOAD')
    header = re.fullmatch(r'\[doc-v2 length=(\d+)\]', text.split('\n', 1)[0])
    _require(header is not None and int(header.group(1)) == len(serialized[:end].encode('utf-16-le')) // 2,
             'SCENE_ENVELOPE_LENGTH')
    _require(_plain(document) and document.get('type') == 'doc', 'SCENE_DOCUMENT_INVALID')

    def node_text(node):
        _require(_plain(node), 'SCENE_NODE_INVALID')
        value = node.get('text', '')
        _require(isinstance(value, str), 'SCENE_TEXT_NODE_INVALID')
        children = node.get('content', [])
        _require(isinstance(children, list), 'SCENE_CONTENT_INVALID')
        return value + ''.join(node_text(child) for child in children)

    content = document.get('content')
    _require(isinstance(content, list), 'SCENE_CONTENT_INVALID')
    _require(all(_plain(node) and node.get('type') == 'paragraph' for node in content), 'SCENE_PARAGRAPH_GRAMMAR')
    for node in content:
        _require(all(_plain(child) and child.get('type') == 'text' and 'content' not in child
                     for child in node.get('content', [])), 'SCENE_INLINE_GRAMMAR')
    return [node_text(node) for node in content]


def _descriptor_map(observation: dict, by_kind) -> dict[str, dict]:
    artifacts = observation.get('artifacts')
    _require(isinstance(artifacts, list) and artifacts, 'OBSERVATION_ARTIFACTS_MISSING')
    result = {}
    for descriptor in artifacts:
        _require(_plain(descriptor) and isinstance(descriptor.get('kind'), str),
                 'ARTIFACT_DESCRIPTOR_INVALID')
        kind = descriptor['kind']
        _require(kind not in result, 'DUPLICATE_ARTIFACT_KIND', kind)
        result[kind] = descriptor
    _require(isinstance(by_kind, dict), 'BY_KIND_INVALID')
    _require(set(by_kind) == set(result), 'BY_KIND_OBSERVATION_MISMATCH')
    for kind, descriptor in result.items():
        _require(by_kind.get(kind) == descriptor, 'BY_KIND_DESCRIPTOR_MISMATCH', kind)
    return result


def _process_field(process: dict, key: str, label: str) -> int:
    _require(_plain(process) and type(process.get('status')) is int, 'LIFECYCLE_STATUS_INVALID', label)
    _require(process['status'] == 0, 'LIFECYCLE_PROCESS_FAILED', label)
    return process['status']


def _stdout_fields(stdout) -> dict[str, str]:
    _require(isinstance(stdout, str), 'WORD_STDOUT_MISSING')
    result = {}
    for line in stdout.splitlines():
        if '=' not in line:
            continue
        key, value = line.split('=', 1)
        if key in {'WORD_STATUS', 'DOCUMENTS_BEFORE', 'DOCUMENTS_AFTER'}:
            _require(key not in result, 'WORD_STDOUT_DUPLICATE_FIELD', key)
            result[key] = value
    return result


def _path_field_matches(root: Path, run_dir: Path, value, expected: Path, label: str) -> None:
    _require(isinstance(value, str) and value, 'LIFECYCLE_PATH_MISSING', label)
    if value.startswith('[LAB_ROOT]/'):
        value = value[len('[LAB_ROOT]/'):]
    value_path = Path(value)
    if not value_path.is_absolute():
        value_path = root / value_path
    _require(_same_path(value_path, expected), 'LIFECYCLE_PATH_BINDING_MISMATCH', label)
    _require(_inside(value_path, run_dir), 'PATH_ESCAPE', label)


def _check_artifact(
    root: Path, run_dir: Path, descriptors: dict[str, dict], kind: str
) -> Path:
    _require(kind in descriptors, 'REQUIRED_FINAL_HOP_MISSING', kind)
    return _artifact_path(root, run_dir, descriptors[kind], kind)


def check_c2_final_hops(
    root,
    run_dir,
    observation,
    by_kind,
    expected_paragraphs,
    scene_path,
    *,
    allow_candidate=False,
):
    """Check C2 final hops and return a detailed JSON-compatible result.

    ``expected_paragraphs`` is a caller agreement input, not an oracle: the
    checker rejects it unless it exactly equals this module's independent
    ``EXPECTED`` tuple.  ``root``, ``run_dir``, and ``scene_path`` may be
    strings or ``Path`` objects.
    """
    started = time.perf_counter()
    findings = []
    checks = {}
    summary = {
        'oracle': 'independent-stdlib-raw-artifact-checker',
        'acceptanceCredit': 0,
        'scope': 'TEXT|ORDER / SINGLE_SCENE / C2 final reexport and Word readback only',
    }

    def mark(name: str, value=True):
        checks[name] = bool(value)

    try:
        root_candidate = Path(root)
        _require(not root_candidate.is_symlink(), 'ROOT_SYMLINK')
        root_path = root_candidate.resolve()
        run_path = Path(run_dir)
        if not run_path.is_absolute():
            run_path = root_path / run_path
        _require(not run_path.is_symlink(), 'RUN_DIRECTORY_SYMLINK')
        run_path = run_path.resolve()
        _require(root_path.is_dir() and not root_path.is_symlink(), 'ROOT_INVALID')
        _require(run_path.is_dir() and not run_path.is_symlink(), 'RUN_DIRECTORY_INVALID')
        _require(_inside(run_path, root_path), 'RUN_PATH_ESCAPE')
        mark('rootAndRunContainment')

        _require(isinstance(expected_paragraphs, (list, tuple))
                 and tuple(expected_paragraphs) == EXPECTED,
                 'EXPECTED_PARAGRAPHS_ORACLE_MISMATCH')
        mark('independentExpectedAgreement')

        _require(_plain(observation), 'OBSERVATION_INVALID')
        run_id = observation.get('runId')
        match = _RUN_ID.fullmatch(str(run_id or ''))
        _require(match is not None, 'RUN_ID_UNSUPPORTED_OR_UNSAFE')
        _require(observation.get('route') == 'C2', 'ROUTE_NOT_C2')
        _require(observation.get('field') == match.group('field'), 'FIELD_OUT_OF_SCOPE')
        _require(observation.get('cellId') == run_id.rsplit('__', 1)[0], 'CELL_ID_MISMATCH')
        _require(observation.get('volume') == 'SINGLE_SCENE', 'VOLUME_OUT_OF_SCOPE')
        _require(observation.get('profile') == match.group('profile'), 'PROFILE_RUN_ID_MISMATCH')
        _require(allow_candidate is True or observation.get('candidateDiagnosticOnly') is False,
                 'CANDIDATE_DIAGNOSTIC_ONLY')
        _require(observation.get('status') == 'PASS', 'OBSERVATION_STATUS_NOT_PASS')
        _require(run_path.name == run_id, 'RUN_DIRECTORY_IDENTITY_MISMATCH')
        mark('routeFieldProfileIdentity')

        descriptors = _descriptor_map(observation, by_kind)
        for kind in _REQUIRED_KINDS:
            _check_artifact(root_path, run_path, descriptors, kind)
        mark('requiredDescriptorKinds')

        artifact_paths = {
            kind: _artifact_path(root_path, run_path, descriptor, kind)
            for kind, descriptor in descriptors.items()
        }
        snapshot_descriptor = descriptors['runtime-project-snapshot']
        snapshot = _json_file(artifact_paths['runtime-project-snapshot'])
        _require(_plain(snapshot) and isinstance(snapshot.get('files'), list),
                 'RUNTIME_SNAPSHOT_INVALID')
        for index, item in enumerate(snapshot['files']):
            label = f'snapshot.files[{index}]'
            path = _artifact_path(root_path, run_path, item, label)
            _require(_inside(path, run_path), 'PATH_ESCAPE', label)
        mark('snapshotFilesBound')

        source_path = artifact_paths['source-text']
        source_raw = _read_utf8_raw(source_path, run_path, 'source-text')
        _require(source_raw.decode('utf-8').split('\n') == list(EXPECTED), 'SOURCE_TEXT_MISMATCH')
        source_paragraphs, _, source_props = _docx_paragraphs(artifact_paths['source-docx'])
        returned_paragraphs, returned_doc, returned_props = _docx_paragraphs(artifact_paths['returned-docx'])
        _require(source_paragraphs == list(EXPECTED), 'SOURCE_DOCX_PARAGRAPH_MISMATCH')
        _require(returned_paragraphs == list(REVIEWED), 'RETURNED_DOCX_PARAGRAPH_MISMATCH')
        mark('sourceAndReturnedRawDocx')

        # Bind the scene through both the caller argument and the persisted
        # runtime snapshot.  The caller cannot point at an external file.
        scene = _resolve_scene(root_path, run_path, scene_path)
        scene_raw = _read_utf8_raw(scene, run_path, 'scene_path')
        scene_sha = _sha(scene_raw)
        snapshot_scene_paths = []
        for item in snapshot['files']:
            item_path = (root_path / item['path']).resolve()
            if _same_path(item_path, scene):
                snapshot_scene_paths.append(item)
        _require(len(snapshot_scene_paths) == 1, 'SNAPSHOT_SCENE_BINDING_MISSING')
        mark('persistedSceneAndSnapshotBinding')
        _require(_scene_paragraphs(scene_raw) == list(REVIEWED), 'PERSISTED_SCENE_PARAGRAPH_MISMATCH')
        mark('persistedSceneParagraphs')

        reopen = _json_file(artifact_paths['source-review-reopen-phase'])
        _require(_plain(reopen), 'REOPEN_PHASE_INVALID')
        _require(reopen.get('freshProcess') is True and reopen.get('ok') is True,
                 'FRESH_REOPEN_FAILED')
        _require(reopen.get('sceneFileSha256') == scene_sha, 'REOPEN_SCENE_HASH_MISMATCH')
        _require(reopen.get('sceneId'), 'REOPEN_SCENE_ID_MISSING')
        _require(reopen.get('rendererParagraphs') == list(REVIEWED), 'REOPEN_RENDERER_TEXT_MISMATCH')
        scene_readback = reopen.get('sceneReadback')
        _require(_plain(scene_readback) and scene_readback.get('paragraphs') == list(REVIEWED),
                 'REOPEN_PERSISTED_TEXT_MISMATCH')
        mark('freshPersistedReopen')

        receipt = _json_file(artifact_paths['canonical-c2-reexport-receipt'])
        _require(_plain(receipt), 'REEXPORT_RECEIPT_INVALID')
        _require(receipt.get('schemaVersion') == 'yalken.portability.lab.v2.c2-canonical-reexport',
                 'REEXPORT_RECEIPT_SCHEMA_INVALID')
        _require(receipt.get('commandId') == 'cmd.project.review.exportDocxReviewPacket',
                 'REEXPORT_COMMAND_INVALID')
        for field in ('projectId', 'sceneId', 'nodeId'):
            _require(isinstance(receipt.get(field), str) and receipt[field],
                     'REEXPORT_IDENTITY_MISSING', field)
        _require(receipt['sceneId'] == reopen['sceneId'], 'REEXPORT_SCENE_ID_MISMATCH')
        initial_export = _json_file(artifact_paths['source-review-export-phase'])
        _require(initial_export.get('projectId') == receipt['projectId']
                 and initial_export.get('sceneId') == receipt['sceneId']
                 and initial_export.get('sourceNodeId') == receipt['nodeId']
                 and reopen.get('reopenResult', {}).get('documentId') == receipt['nodeId'],
                 'REEXPORT_PROJECT_NODE_IDENTITY_MISMATCH')
        _require(scene == run_path / 'runtime-project-snapshot' / receipt['sceneId'],
                 'REEXPORT_SCENE_PATH_MISMATCH')
        _require(receipt.get('beforeSceneSha256') == scene_sha
                 and receipt.get('afterSceneSha256') == scene_sha,
                 'REEXPORT_SCENE_HASH_MISMATCH')
        _require(receipt.get('sourceReviewedDocxSha256') == descriptors['returned-docx']['sha256'],
                 'REEXPORT_SOURCE_HASH_MISMATCH')
        _require(receipt.get('reexportDocxSha256') == descriptors['canonical-c2-reexport-docx']['sha256'],
                 'REEXPORT_ARTIFACT_HASH_MISMATCH')
        _require(_plain(receipt.get('reexportResult')) and receipt['reexportResult'].get('ok') is True,
                 'REEXPORT_RESULT_NOT_ACCEPTED')
        result = receipt['reexportResult']
        capsule = result.get('exportCapsule', {})
        _require(result.get('commandId') == receipt['commandId'] and result.get('exported') is True
                 and result.get('bytesWritten') == descriptors['canonical-c2-reexport-docx']['bytes']
                 and capsule.get('projectId') == receipt['projectId'] and capsule.get('sceneId') == receipt['sceneId']
                 and capsule.get('rawSha256') == 'sha256:' + scene_sha
                 and capsule.get('sceneRevision') == 'sha256:' + scene_sha
                 and capsule.get('blockCount') == len(REVIEWED), 'REEXPORT_CAPSULE_BINDING')
        reexport_paragraphs, _, reexport_props = _docx_paragraphs(artifact_paths['canonical-c2-reexport-docx'])
        _require(reexport_paragraphs == list(REVIEWED), 'REEXPORT_DOCX_PARAGRAPH_MISMATCH')
        mark('canonicalYalkenReexport')

        lifecycle = _json_file(artifact_paths['canonical-c2-final-word-lifecycle'])
        _require(_plain(lifecycle), 'FINAL_WORD_LIFECYCLE_INVALID')
        _require(lifecycle.get('status') == 'PASS', 'FINAL_WORD_STATUS_NOT_PASS')
        _process_field(lifecycle.get('process'), 'process', 'final-word-process')
        _process_field(lifecycle.get('compileProcess'), 'compileProcess', 'final-word-compile')
        fields = _stdout_fields(lifecycle['process'].get('stdout'))
        _require(fields == {
            'WORD_STATUS': 'PASS',
            'DOCUMENTS_BEFORE': '0',
            'DOCUMENTS_AFTER': '0',
        }, 'WORD_NATIVE_LIFECYCLE_FIELDS_INVALID')
        _require(lifecycle.get('cleanupOk') is True, 'FINAL_WORD_CLEANUP_FAILED')
        _require(_plain(lifecycle.get('nativeReadback'))
                 and lifecycle['nativeReadback'].get('ok') is True,
                 'FINAL_WORD_NATIVE_READBACK_NOT_OK')
        _path_field_matches(root_path, run_path, lifecycle.get('evidencePath'),
                            artifact_paths['canonical-c2-final-word-docx'], 'evidencePath')
        _path_field_matches(root_path, run_path, lifecycle.get('nativeReadbackPath'),
                            artifact_paths['canonical-c2-final-word-native-text'], 'nativeReadbackPath')
        _path_field_matches(root_path, run_path, lifecycle.get('scriptPath'),
                            artifact_paths['canonical-c2-final-word-script'], 'scriptPath')
        if lifecycle.get('screenshotPath') is not None:
            _path_field_matches(root_path, run_path, lifecycle.get('screenshotPath'),
                                artifact_paths['canonical-c2-final-word-screenshot'], 'screenshotPath')
        _require(lifecycle.get('sourceDocxHash') == descriptors['canonical-c2-reexport-docx']['sha256'],
                 'FINAL_WORD_SOURCE_HASH_MISMATCH')
        _require(lifecycle.get('preOpenHash') == lifecycle.get('sourceDocxHash'),
                 'FINAL_WORD_PREOPEN_HASH_MISMATCH')
        _require(lifecycle.get('postWordHash') == descriptors['canonical-c2-final-word-docx']['sha256'],
                 'FINAL_WORD_POSTWORD_HASH_MISMATCH')
        _require(lifecycle.get('copiedBackHash') == descriptors['canonical-c2-final-word-docx']['sha256'],
                 'FINAL_WORD_COPYBACK_HASH_MISMATCH')
        _require(lifecycle.get('sourceToStagingHashOk') is True
                 and lifecycle.get('stagingToEvidenceHashOk') is True,
                 'FINAL_WORD_STAGING_HASH_BINDING_FAILED')
        native_raw = _read_utf8_raw(artifact_paths['canonical-c2-final-word-native-text'], run_path,
                                    'canonical-c2-final-word-native-text')
        native_paragraphs = _word_native_paragraphs(native_raw)
        _require(native_paragraphs == list(REVIEWED), 'FINAL_WORD_NATIVE_TEXT_MISMATCH')
        _require(lifecycle['nativeReadback'].get('paragraphs') in (None, native_paragraphs),
                 'FINAL_WORD_NATIVE_PARAGRAPH_BINDING_MISMATCH')
        final_paragraphs, _, final_props = _docx_paragraphs(artifact_paths['canonical-c2-final-word-docx'])
        _require(final_paragraphs == list(REVIEWED), 'FINAL_WORD_DOCX_PARAGRAPH_MISMATCH')
        for key in ('YRTK_C01_AUTH', 'YRTK2_TOKEN', 'YRTK_CORE_DIGEST'):
            _require(bool(reexport_props.get(key)) and final_props.get(key) == reexport_props[key],
                     'FINAL_WORD_AUTHORITY_CARRIER_MISMATCH', key)
        mark('finalWordLifecycleAndIndependentReadback')

        canonical = observation.get('canonicalC2')
        _require(_plain(canonical) and canonical.get('complete') is True
                 and canonical.get('sceneUnchangedDuringReexport') is True,
                 'OBSERVATION_CANONICAL_C2_INCOMPLETE')
        _require(reopen.get('canonicalC2') == canonical, 'REOPEN_CANONICAL_C2_BINDING')
        _require(canonical.get('reexportDocxSha256') == descriptors['canonical-c2-reexport-docx']['sha256'],
                 'OBSERVATION_REEXPORT_HASH_MISMATCH')
        _require(canonical.get('finalWordDocxSha256') == descriptors['canonical-c2-final-word-docx']['sha256'],
                 'OBSERVATION_FINAL_WORD_HASH_MISMATCH')
        _require(canonical.get('finalWordNativeTextSha256') == descriptors['canonical-c2-final-word-native-text']['sha256'],
                 'OBSERVATION_NATIVE_HASH_MISMATCH')
        _require(_plain(observation.get('freshReopen'))
                 and observation['freshReopen'].get('ok') is True
                 and observation['freshReopen'].get('sceneFileSha256') == scene_sha,
                 'OBSERVATION_REOPEN_BINDING_MISMATCH')
        _require(_plain(observation.get('reviewExport'))
                 and observation['reviewExport'].get('commandPath')
                 == 'electron.commandBridge.cmd.project.review.exportDocxReviewPacket'
                 and observation['reviewExport'].get('sourceDocxSha256')
                 == descriptors['source-docx']['sha256'], 'OBSERVATION_EXPORT_BINDING_MISMATCH')
        _require(_plain(observation.get('reviewReturnIntake'))
                 and observation['reviewReturnIntake'].get('authenticated') is True
                 and observation['reviewReturnIntake'].get('prepared') is True
                 and observation['reviewReturnIntake'].get('noMutationDuringIntake') is True,
                 'OBSERVATION_INTAKE_BINDING_MISMATCH')
        _require(_plain(observation.get('explicitApply'))
                 and observation['explicitApply'].get('applied') is True
                 and observation['explicitApply'].get('saved') is True
                 and observation['explicitApply'].get('writerCalled') is True
                 and observation['explicitApply'].get('editorSyncOk') is True,
                 'OBSERVATION_APPLY_BINDING_MISMATCH')
        _require(_plain(observation.get('sourceAuthoringPrecondition'))
                 and observation['sourceAuthoringPrecondition'].get('ok') is True,
                 'OBSERVATION_SOURCE_PRECONDITION_MISSING')
        oracles = observation.get('oracles')
        _require(_plain(oracles), 'OBSERVATION_ORACLES_MISSING')
        _require(all(oracles.get(name) == 'PASS' for name in (
            'source-authoring-precondition', 'semantic', 'structure', 'order',
            'provenance', 'loss', 'independent-readback', 'cleanup',
            'format-roundtrip', 'path-authority', 'hash-binding', 'locale-font',
            'negative-mutation',
        )), 'OBSERVATION_ORACLE_INCOMPLETE')
        mark('observationAndRawBindings')

        summary.update({
            'runId': run_id,
            'field': observation['field'],
            'profile': observation['profile'],
            'sceneSha256': scene_sha,
            'sourceDocxSha256': descriptors['source-docx']['sha256'],
            'returnedDocxSha256': descriptors['returned-docx']['sha256'],
            'reexportDocxSha256': descriptors['canonical-c2-reexport-docx']['sha256'],
            'finalWordDocxSha256': descriptors['canonical-c2-final-word-docx']['sha256'],
            'finalWordNativeTextSha256': descriptors['canonical-c2-final-word-native-text']['sha256'],
            'paragraphCount': len(REVIEWED),
            'artifactCount': len(descriptors),
        })
        ok = True
    except _Reject as error:
        findings.append({'code': error.code, 'detail': error.detail})
        ok = False
    except (OSError, ValueError, TypeError, KeyError) as error:
        findings.append({'code': 'CHECKER_INPUT_REJECTED', 'detail': str(error)})
        ok = False

    result = {
        'type': 'INDEPENDENT_C2_FINAL_HOPS_SELFCHECK',
        'ok': ok,
        'status': 'PASS' if ok else 'REJECTED',
        'acceptanceCredit': 0,
        'checkedAtUtc': _datetime.datetime.now(_datetime.timezone.utc).isoformat(),
        'seconds': round(time.perf_counter() - started, 6),
        'checks': checks,
        'findings': findings,
        'summary': summary,
    }
    return result


__all__ = ['EXPECTED', 'REVIEWED', 'check_c2_final_hops']

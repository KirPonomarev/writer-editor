#!/usr/bin/env python3
"""Independent invalid-input oracle. No product parser, Lab mutator or assertions.

This is a bounded classifier for the admitted corruption families, not a complete
OOXML validator. No matched defect means no hostile credit, not general validity.
Authority-envelope integrity is distinct from ordinary document fidelity.
"""
import base64
import hashlib
import io
import json
import posixpath
import re
import stat
import zipfile
from collections import Counter
from urllib.parse import unquote, urlsplit
from xml.etree import ElementTree as ET

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
CUSTOM = '{http://schemas.openxmlformats.org/officeDocument/2006/custom-properties}'
VT = '{http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes}'
REL = '{http://schemas.openxmlformats.org/package/2006/relationships}'
FIELDS = ['TEXT', 'ORDER', 'UNICODE_IME_LOCALE', 'STYLES', 'NOVEL_SCENE_STRUCTURE',
          'TRACKED_REVIEW_SEMANTICS', 'NOTES', 'FOOTNOTES_ENDNOTES', 'COMMENTS',
          'IDENTIFIERS_ANCHORS', 'METADATA', 'SECTIONS', 'TABLES', 'MEDIA_ASSETS']


def require(value, code):
    if not value:
        raise ValueError(code)


def digest(value):
    return hashlib.sha256(value).hexdigest()


def canonical(value):
    return json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(',', ':')).encode('utf-8')


def read_parts(raw):
    require(isinstance(raw, bytes) and 0 < len(raw) <= 64 * 1024 * 1024, 'HOSTILE_ZIP_BYTES')
    try:
        with zipfile.ZipFile(io.BytesIO(raw)) as archive:
            infos = archive.infolist()
            names = [item.filename for item in infos]
            require(0 < len(infos) <= 2048 and len(set(names)) == len(names), 'HOSTILE_ZIP_ENTRIES')
            require(sum(item.file_size for item in infos) <= 128 * 1024 * 1024, 'HOSTILE_ZIP_TOTAL')
            for item in infos:
                name = item.filename
                require(name and not name.startswith('/') and '\\' not in name and '\x00' not in name
                        and ':' not in name and not any(p in ['.', '..'] for p in name.split('/'))
                        and not stat.S_ISLNK(item.external_attr >> 16), 'HOSTILE_ZIP_PATH')
                require(0 <= item.file_size <= 32 * 1024 * 1024 and not item.flag_bits & 1, 'HOSTILE_ZIP_PART')
            parts = {name: archive.read(name) for name in names}
    except (zipfile.BadZipFile, RuntimeError, NotImplementedError) as error:
        raise ValueError('HOSTILE_ZIP_INVALID') from error
    require('word/document.xml' in parts, 'HOSTILE_DOCUMENT_MISSING')
    return parts


def xml_text(raw):
    # XML permits UTF-16, including valid Unicode text outside the ASCII range.
    encoding = 'utf-16' if raw.startswith((b'\xff\xfe', b'\xfe\xff')) else 'utf-8-sig'
    text = raw.decode(encoding, errors='strict')
    require('<!DOCTYPE' not in text.upper() and '<!ENTITY' not in text.upper(), 'HOSTILE_XML_ENTITY')
    return text


def xml_part(parts, name):
    if name not in parts:
        return None
    try:
        return ET.fromstring(xml_text(parts[name]))
    except (UnicodeError, ET.ParseError):
        return None


def decode_xstring(value):
    return re.sub(r'_x([0-9a-fA-F]{4})_', lambda m: chr(int(m[1], 16)), value or '')


def custom_properties(parts):
    root = xml_part(parts, 'docProps/custom.xml')
    return [] if root is None else root.findall(CUSTOM + 'property')


def authority(parts):
    rows = [p for p in custom_properties(parts) if decode_xstring(p.get('name')) == 'YRTK_C01_AUTH']
    if len(rows) != 1 or len(rows[0]) != 1 or rows[0][0].tag != VT + 'lpwstr':
        return None
    token = decode_xstring(rows[0][0].text)
    if not re.fullmatch(r'YRTK1\.[A-Za-z0-9_-]{1,1000000}', token):
        return None
    try:
        encoded = token[6:]
        value = json.loads(base64.b64decode(encoded + '=' * (-len(encoded) % 4), altchars=b'-_', validate=True))
    except (ValueError, UnicodeError):
        return None
    return value if isinstance(value, dict) and isinstance(value.get('payload'), dict) else None


def duplicates(values):
    return any(count > 1 for count in Counter(values).values())


def invalid_reason(field, parts, control=None):
    raw = parts['word/document.xml']
    try:
        text = xml_text(raw)
    except UnicodeError:
        return 'DOCUMENT_INVALID_UNICODE_ENCODING' if field == 'UNICODE_IME_LOCALE' else ''
    try:
        document = ET.fromstring(text)
    except ET.ParseError:
        return 'DOCUMENT_NOT_WELL_FORMED_XML' if field == 'TEXT' else ''
    if field in ['TEXT', 'UNICODE_IME_LOCALE']:
        return ''
    if field in ['ORDER', 'NOVEL_SCENE_STRUCTURE', 'NOTES']:
        auth = authority(parts)
        if auth is None:
            return ''  # An unrelated missing property is not proof for three fields.
        payload = auth['payload']
        mismatch = auth.get('payloadDigest') != 'sha256:' + digest(canonical(payload))
        if field == 'NOVEL_SCENE_STRUCTURE':
            ids = payload.get('orderedSceneIds')
            if isinstance(ids, list) and all(isinstance(x, str) for x in ids) and duplicates(ids):
                return 'SIGNED_SCENE_IDS_DUPLICATED'
        if field == 'ORDER':
            scenes = payload.get('sceneRevisions')
            if isinstance(scenes, list) and all(isinstance(x, dict) and isinstance(x.get('sceneOrdinal'), int) for x in scenes):
                if duplicates([x['sceneOrdinal'] for x in scenes]):
                    return 'SIGNED_SCENE_ORDINALS_DUPLICATED'
        if field == 'NOTES' and mismatch and control is not None:
            before = authority(control)
            if before is not None:
                changed = {k for k in set(before['payload']) | set(payload) if before['payload'].get(k) != payload.get(k)}
                if changed == {'documentNotesDigest'} and auth.get('payloadDigest') == before.get('payloadDigest'):
                    return 'SIGNED_NOTES_DIGEST_TAMPERED'
        return ''
    if field == 'METADATA':
        names = [decode_xstring(p.get('name')) for p in custom_properties(parts)]
        if names.count('YALKEN_PROJECT_ID') > 1:
            return 'PROTECTED_PROJECT_PROPERTY_DUPLICATED'
    elif field == 'IDENTIFIERS_ANCHORS':
        starts = list(document.iter(W + 'bookmarkStart'))
        if any(not re.fullmatch(r'[+-]?[0-9]+', n.get(W + 'id', '').strip()) for n in starts):
            return 'WORD_BOOKMARK_ID_NOT_DECIMAL'
    elif field == 'SECTIONS':
        for parent in document.iter():
            if parent.tag in [W + 'body', W + 'pPr'] and len(parent.findall(W + 'sectPr')) > 1:
                return 'WORD_SECTION_PROPERTY_DUPLICATED'
    elif field == 'STYLES':
        styles = xml_part(parts, 'word/styles.xml')
        if styles is not None:
            for style in styles.findall(W + 'style'):
                if style.get(W + 'type') not in [None, 'paragraph', 'character', 'table', 'numbering']:
                    return 'WORD_STYLE_TYPE_INVALID'
    elif field == 'TABLES':
        for span in document.iter(W + 'gridSpan'):
            value = span.get(W + 'val', '')
            if not re.fullmatch(r'\+?[0-9]+', value) or int(value) < 1:
                return 'WORD_TABLE_GRID_SPAN_INVALID'
    elif field == 'TRACKED_REVIEW_SEMANTICS':
        # Nested revisions are legal CT_RunTrackChange; they alone prove nothing.
        for change in document.iter():
            if change.tag in [W + 'ins', W + 'del', W + 'moveFrom', W + 'moveTo']:
                if not re.fullmatch(r'[+-]?[0-9]+', change.get(W + 'id', '').strip()):
                    return 'WORD_REVISION_ID_NOT_DECIMAL'
    elif field == 'COMMENTS':
        comments = xml_part(parts, 'word/comments.xml')
        ids = [] if comments is None else [n.get(W + 'id') for n in comments.findall(W + 'comment')]
        # OOXML permits ignoring duplicate/orphan comments; that is not proof
        # of malformed bytes. A non-integer CT_Comment identifier is invalid.
        if any(not re.fullmatch(r'[+-]?[0-9]+', (value or '').strip()) for value in ids):
            return 'WORD_COMMENT_ID_NOT_DECIMAL'
    elif field == 'FOOTNOTES_ENDNOTES':
        for kind in ['footnote', 'endnote']:
            root = xml_part(parts, 'word/' + kind + 's.xml')
            ids = [] if root is None else [n.get(W + 'id') for n in root.findall(W + kind)]
            if any(not re.fullmatch(r'[+-]?[0-9]+', (value or '').strip()) for value in ids):
                return 'WORD_NATIVE_NOTE_ID_NOT_DECIMAL'
    elif field == 'MEDIA_ASSETS':
        rels = xml_part(parts, 'word/_rels/document.xml.rels')
        for rel in [] if rels is None else rels.findall(REL + 'Relationship'):
            if rel.get('Type') != 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image' or rel.get('TargetMode') == 'External':
                continue
            target = unquote(rel.get('Target', ''))
            uri = urlsplit(target)
            if uri.scheme or uri.netloc or '\\' in target or '\x00' in target:
                return 'WORD_IMAGE_INTERNAL_TARGET_INVALID'
            resolved = posixpath.normpath(posixpath.join('word', uri.path))
            if resolved == '..' or resolved.startswith('../'):
                return 'WORD_IMAGE_TARGET_ESCAPES_PACKAGE'
    return ''


def classify_invalid(field, source_bytes, artifact_bytes):
    require(field in FIELDS, 'HOSTILE_FIELD_UNKNOWN')
    source = read_parts(source_bytes)
    candidate = read_parts(artifact_bytes)
    require(xml_part(source, 'word/document.xml') is not None, 'HOSTILE_CONTROL_XML_INVALID')
    require(not invalid_reason(field, source), 'HOSTILE_CONTROL_ALREADY_INVALID')
    if field in ['NOTES', 'ORDER', 'NOVEL_SCENE_STRUCTURE']:
        auth = authority(source)
        require(auth is not None and auth.get('payloadDigest') == 'sha256:' + digest(canonical(auth['payload'])), 'HOSTILE_CONTROL_PAYLOAD_INTEGRITY')
    reason = invalid_reason(field, candidate, source)
    return {'field': field, 'invalid': bool(reason), 'reason': reason,
            'sourceSha256': digest(source_bytes), 'artifactSha256': digest(artifact_bytes)}


CAMPAIGN = 'WORD_HOSTILE_V1'
COMMANDS = ['cmd.project.review.activateDocxReviewPreviewSession', 'cmd.project.review.applyExactTextChangesBatch']


def snapshot_class(name):
    if re.fullmatch(r'backups/revision-bridge-rtk-comment-shadow-(sessions|receipts)/[A-Za-z0-9_.-]+\.json', name):
        return 'DERIVED_REVIEW'
    if name == '.stage10-local/command-receipt-authority-store.v2.json':
        return 'COMMAND_RECEIPTS'
    return 'PROTECTED'


def checked_snapshot(snapshot, raw, scene_paths):
    require(isinstance(snapshot, dict) and set(snapshot) == {'files', 'authoring'}, 'HOSTILE_SNAPSHOT_SCHEMA')
    files = snapshot['files']
    require(isinstance(files, list) and 0 < len(files) <= 2048, 'HOSTILE_SNAPSHOT_INVENTORY')
    names = set()
    protected = []
    for row in files:
        require(isinstance(row, dict) and set(row) == {'path', 'bytes', 'sha256', 'stateClass', 'blob'}, 'HOSTILE_SNAPSHOT_ROW')
        name = row['path']
        require(isinstance(name, str) and name and not name.startswith('/') and '\\' not in name
                and not any(p in ['', '.', '..'] for p in name.split('/')) and name not in names, 'HOSTILE_SNAPSHOT_PATH')
        names.add(name)
        sha = row['sha256']
        require(isinstance(sha, str) and re.fullmatch('[a-f0-9]{64}', sha) and row['blob'] == 'hostile-blobs/' + sha, 'HOSTILE_SNAPSHOT_BLOB')
        data = raw(row['blob'])
        require(type(row['bytes']) is int and len(data) == row['bytes'] and digest(data) == sha, 'HOSTILE_SNAPSHOT_BYTES')
        state_class = snapshot_class(name)
        require(row['stateClass'] == state_class, 'HOSTILE_SNAPSHOT_CLASS')
        if state_class == 'PROTECTED':
            protected.append({'path': name, 'sha256': sha, 'bytes': len(data)})
    required = {'project.craftsman.json', 'notes.craftsman.json',
                '.yalken/word-review/non-text-return-state.v1.json', '.yalken/word-review/return-authority-store.v1.json', *scene_paths}
    require(required <= names, 'HOSTILE_CANONICAL_COVERAGE')
    authoring = snapshot['authoring']
    require(isinstance(authoring, dict) and set(authoring) == {'renderer', 'html', 'tree'}
            and isinstance(authoring['html'], str) and authoring['html']
            and isinstance(authoring['renderer'], dict) and isinstance(authoring['tree'], dict), 'HOSTILE_AUTHORING_SNAPSHOT')
    return {'files': sorted(protected, key=lambda row: row['path']), 'authoring': authoring}


def typed_refusal(value, command):
    require(isinstance(value, dict) and value.get('applied') is not True
            and (value.get('ok') is False or value.get('status') == 'blocked'), 'HOSTILE_TYPED_REFUSAL')
    error = value.get('value', {}).get('error', {}) if isinstance(value.get('value'), dict) else value.get('error', {})
    code = value.get('code') or (error.get('code') if isinstance(error, dict) else None)
    require(isinstance(code, str) and re.fullmatch('[A-Z][A-Z0-9_]{2,200}', code), 'HOSTILE_TYPED_CODE')
    require(isinstance(error, dict) and error.get('op') == command, 'HOSTILE_REFUSAL_COMMAND')
    return code


def audit_hostile(*, run, route, profile, raw, read, round_proofs, required_hops, oracles):
    require(route in ['C1', 'C2', 'C3'] and profile in ['SOURCE_RUNTIME', 'PACKAGED_BUILD_RUNTIME'], 'HOSTILE_ROUTE_PROFILE')
    cycles = 5 if route == 'C3' else 1
    require(len(round_proofs) == cycles, 'HOSTILE_FIVE_CYCLES')
    scenes = read('source-scenes.json')['createdScenes']
    scene_paths = [scene['sceneId'] for scene in scenes]
    require(len(scene_paths) == len(set(scene_paths)) == 3, 'HOSTILE_CARRIER_SCENES')
    rows = {field: [] for field in FIELDS}
    for ordinal in range(1, cycles + 1):
        round_proof = round_proofs[ordinal - 1]
        source = raw(f'rounds/{ordinal}/returned.docx')
        require(digest(source) == round_proof['returnedSha256'], 'HOSTILE_NATIVE_RETURN_BINDING')
        summary = read(f'rounds/{ordinal}/hostile-round.json')
        require(summary['schemaVersion'] == 'WORD_HOSTILE_ROUND_V1' and summary['round'] == ordinal
                and summary['sourceSha256'] == digest(source) and summary['admissionCredit'] == 0
                and [r['field'] for r in summary['fields']] == FIELDS, 'HOSTILE_ROUND_COMPLETE')
        hashes = set()
        for field in FIELDS:
            prefix = f'rounds/{ordinal}/hostile/{field}/'
            invalid = raw(prefix + 'invalid.docx')
            classification = classify_invalid(field, source, invalid)
            require(classification['invalid'] is True and classification['sourceSha256'] != classification['artifactSha256'], 'HOSTILE_INVALID_CLASSIFICATION')
            hashes.add(classification['artifactSha256'])
            probe = read(prefix + 'observed.json')
            require(probe == read(prefix + 'probe.json'), 'HOSTILE_COMPLETED_PROBE')
            require(probe['schemaVersion'] == 'WORD_HOSTILE_COMMAND_PROBE_V1' and probe['field'] == field
                    and probe['round'] == ordinal and probe['commandIds'] == COMMANDS and probe['admissionCredit'] == 0
                    and probe['sourceSha256'] == digest(source) and probe['mutantSha256'] == digest(invalid), 'HOSTILE_COMMAND_BINDING')
            control = probe['control']
            require(control.get('ok') is True and control.get('commandId') == COMMANDS[0]
                    and control['returnIntake']['authenticated'] is True
                    and control['returnIntake']['returnedArtifactSha256'] == 'sha256:' + digest(source), 'HOSTILE_POSITIVE_NATIVE_CONTROL')
            changes = control['reviewSurface']['revisionSession']['reviewGraph']['textChanges']
            require(len(changes) == 1 and changes[0]['match']['kind'] == 'exact', 'HOSTILE_CONTROL_SAFE_CANDIDATE')
            intake = probe['intake']
            require(intake.get('canAutoApply') is not True and intake.get('canWriteStorage') is not True, 'HOSTILE_INPUT_NO_WRITE_AUTHORITY')
            if intake.get('ok') is True:
                require(intake.get('commandId') == COMMANDS[0] and intake['returnIntake']['returnedArtifactSha256'] == 'sha256:' + digest(invalid), 'HOSTILE_MANUAL_BINDING')
                candidates = intake['reviewSurface']['revisionSession']['reviewGraph']['textChanges']
                require(candidates and all(c['match']['kind'] == 'manual' for c in candidates), 'HOSTILE_MANUAL_ONLY')
                require(probe['changeIds'] == [c['changeId'] for c in candidates], 'HOSTILE_ACTUAL_MANUAL_APPLY')
                intake_code = 'MANUAL_ONLY_NO_SAFE_APPLY'
            else:
                intake_code = typed_refusal(intake, COMMANDS[0])
                require(probe['changeIds'] == [c['changeId'] for c in changes], 'HOSTILE_STALE_CONTROL_APPLY')
            apply_code = typed_refusal(probe['apply'], COMMANDS[1])
            before = checked_snapshot(probe['before'], raw, scene_paths)
            require(before == checked_snapshot(probe['afterIntake'], raw, scene_paths)
                    and before == checked_snapshot(probe['afterApply'], raw, scene_paths), 'HOSTILE_ZERO_CANONICAL_MUTATION')
            expected_hashes = round_proofs[ordinal - 2]['savedSceneHashes'] if ordinal > 1 else [scene['sha256'] for scene in read('source.json')['scenes']]
            by_path = {f['path']: f['sha256'] for f in before['files']}
            require([by_path[name] for name in scene_paths] == expected_hashes, 'HOSTILE_ROUND_CANONICAL_BASELINE')
            rows[field].append({'ordinal': ordinal, 'sourceSha256': digest(source), 'artifactSha256': digest(invalid),
                                'classification': classification, 'intakeCode': intake_code, 'applyCode': apply_code,
                                'probeSha256': digest(raw(prefix + 'observed.json')), 'canonicalStateSha256': digest(canonical(before)),
                                'protectedFileCount': len(before['files']), 'mutationCount': 0})
        require(len(hashes) == len(FIELDS) and {r['mutantSha256'] for r in summary['fields']} == hashes, 'HOSTILE_DISTINCT_FIELD_BYTES')
    return [{'field': field, 'cellId': f'{field}__MALFORMED_HOSTILE_INPUT__{route}__{profile}',
             'runId': run, 'status': 'PASS', 'outcome': 'REJECTED_INVALID_NO_MUTATION', 'typedResult': True,
             'mutationCount': 0, 'requiredCycles': cycles, 'requiredHops': required_hops, 'oracles': oracles,
             'rounds': rows[field], 'authorityScope': 'CANONICAL_PROJECT_AND_AUTHORING_UNCHANGED_DERIVED_DIAGNOSTICS_RETAINED'} for field in FIELDS]

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
        if duplicates([n.get(W + 'id') for n in starts]) or duplicates([n.get(W + 'name') for n in starts]):
            return 'WORD_BOOKMARK_IDENTITY_DUPLICATED'
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
                if not re.fullmatch(r'[+-]?[0-9]+', change.get(W + 'id', '')):
                    return 'WORD_REVISION_ID_NOT_DECIMAL'
    elif field == 'COMMENTS':
        comments = xml_part(parts, 'word/comments.xml')
        ids = [] if comments is None else [n.get(W + 'id') for n in comments.findall(W + 'comment')]
        refs = [n.get(W + 'id') for n in document.iter(W + 'commentReference')]
        if duplicates(ids) or any(value not in ids for value in refs):
            return 'WORD_COMMENT_ID_GRAPH_INVALID'
    elif field == 'FOOTNOTES_ENDNOTES':
        for kind in ['footnote', 'endnote']:
            root = xml_part(parts, 'word/' + kind + 's.xml')
            ids = [] if root is None else [n.get(W + 'id') for n in root.findall(W + kind)]
            refs = [n.get(W + 'id') for n in document.iter(W + kind + 'Reference')]
            if duplicates(ids) or any(value not in ids for value in refs):
                return 'WORD_NATIVE_NOTE_ID_GRAPH_INVALID'
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

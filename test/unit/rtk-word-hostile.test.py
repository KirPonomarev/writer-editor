import base64, copy, hashlib, importlib.util, io, json, unittest, zipfile
from pathlib import Path
from xml.etree import ElementTree as E

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('hostile', ROOT / 'scripts/ops/rtk-interop-word-hostile-readback.py')
h = importlib.util.module_from_spec(spec)
spec.loader.exec_module(h)
W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
CP = '{http://schemas.openxmlformats.org/officeDocument/2006/custom-properties}'
VT = '{http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes}'
REL = '{http://schemas.openxmlformats.org/package/2006/relationships}'

def canonical(value):
    return json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(',', ':')).encode()

def parts():
    payload = {'orderedSceneIds': ['scene-a', 'scene-b'], 'sceneCount': 2,
               'sceneRevisions': [{'sceneId': 'scene-a', 'sceneOrdinal': 0}, {'sceneId': 'scene-b', 'sceneOrdinal': 1}],
               'documentNotesDigest': 'sha256:' + 'a' * 64}
    auth = {'payload': payload, 'payloadDigest': 'sha256:' + hashlib.sha256(canonical(payload)).hexdigest()}
    custom = E.Element(CP + 'Properties')
    for name, value in [('YALKEN_PROJECT_ID', 'project-unit'), ('YRTK_C01_AUTH', 'YRTK1.' + base64.urlsafe_b64encode(canonical(auth)).decode().rstrip('='))]:
        E.SubElement(E.SubElement(custom, CP + 'property', {'name': name}), VT + 'lpwstr').text = value
    doc = E.Element(W + 'document'); body = E.SubElement(doc, W + 'body'); p = E.SubElement(body, W + 'p')
    E.SubElement(E.SubElement(p, W + 'pPr'), W + 'sectPr')
    E.SubElement(p, W + 'bookmarkStart', {W + 'id': '1', W + 'name': 'YRTK_unit'})
    r = E.SubElement(p, W + 'r'); E.SubElement(r, W + 't').text = ' e\u0301 العربية 日本語 '
    E.SubElement(r, W + 'footnoteReference', {W + 'id': '1'})
    E.SubElement(p, W + 'bookmarkEnd', {W + 'id': '1'})
    E.SubElement(p, W + 'commentReference', {W + 'id': '1'})
    ins = E.SubElement(p, W + 'ins', {W + 'id': '2'}); E.SubElement(E.SubElement(ins, W + 'r'), W + 't').text = 'edit'
    E.SubElement(body, W + 'sectPr')
    styles = E.Element(W + 'styles'); E.SubElement(styles, W + 'style', {W + 'styleId': 'Normal'})
    notes = E.Element(W + 'footnotes'); E.SubElement(notes, W + 'footnote', {W + 'id': '1'})
    comments = E.Element(W + 'comments'); E.SubElement(comments, W + 'comment', {W + 'id': '1'})
    return {n: E.tostring(x) for n, x in {'word/document.xml': doc, 'word/styles.xml': styles,
            'word/footnotes.xml': notes, 'word/comments.xml': comments, 'docProps/custom.xml': custom,
            'word/_rels/document.xml.rels': E.Element(REL + 'Relationships')}.items()}

def pack(p):
    out = io.BytesIO()
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
        for n, value in p.items(): z.writestr(n, value)
    return out.getvalue()

def mutate(field, source):
    p = dict(source)
    name = 'word/document.xml'; doc = E.fromstring(p[name]); body = doc.find(W + 'body'); first = body.find(W + 'p')
    if field == 'TEXT': p[name] = p[name][:-8]; return p
    if field == 'UNICODE_IME_LOCALE': p[name] = p[name].replace(b'edit', b'bad\xc0\xaf'); return p
    if field == 'TABLES':
        table = E.SubElement(body, W + 'tbl'); E.SubElement(E.SubElement(table, W + 'tblGrid'), W + 'gridCol')
        cell = E.SubElement(E.SubElement(table, W + 'tr'), W + 'tc')
        E.SubElement(E.SubElement(cell, W + 'tcPr'), W + 'gridSpan', {W + 'val': 'not-a-decimal'}); E.SubElement(cell, W + 'p')
    elif field == 'SECTIONS': first.find(W + 'pPr').append(E.Element(W + 'sectPr'))
    elif field == 'IDENTIFIERS_ANCHORS': first.append(copy.deepcopy(first.find(W + 'bookmarkStart')))
    elif field == 'TRACKED_REVIEW_SEMANTICS': first.find(W + 'ins').set(W + 'id', 'not-a-decimal')
    elif field in ['COMMENTS', 'FOOTNOTES_ENDNOTES', 'STYLES', 'MEDIA_ASSETS']:
        name = {'COMMENTS': 'word/comments.xml', 'FOOTNOTES_ENDNOTES': 'word/footnotes.xml', 'STYLES': 'word/styles.xml', 'MEDIA_ASSETS': 'word/_rels/document.xml.rels'}[field]
        doc = E.fromstring(p[name])
        if field == 'STYLES': doc[0].set(W + 'type', 'not-a-style-type')
        elif field == 'MEDIA_ASSETS': E.SubElement(doc, REL + 'Relationship', {'Id': 'image1', 'Type': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image', 'Target': '../../escape.png'})
        else: doc.append(copy.deepcopy(doc[0]))
    else:
        name = 'docProps/custom.xml'; doc = E.fromstring(p[name])
        if field == 'METADATA': doc.append(copy.deepcopy(doc[0]))
        else:
            token = doc[1][0].text[6:]; auth = json.loads(base64.urlsafe_b64decode(token + '=' * (-len(token) % 4)))
            if field == 'NOTES': auth['payload']['documentNotesDigest'] = 'sha256:' + '0' * 64
            elif field == 'NOVEL_SCENE_STRUCTURE': auth['payload']['orderedSceneIds'][1] = 'scene-a'
            elif field == 'ORDER': auth['payload']['sceneRevisions'][1]['sceneOrdinal'] = 0
            else: raise AssertionError(field)
            doc[1][0].text = 'YRTK1.' + base64.urlsafe_b64encode(canonical(auth)).decode().rstrip('=')
    p[name] = E.tostring(doc); return p

class HostileClassifier(unittest.TestCase):
    def test_each_field_needs_its_own_actual_invalid_bytes(self):
        source = parts(); original = pack(source)
        for field in h.FIELDS:
            with self.subTest(field=field):
                self.assertFalse(h.classify_invalid(field, original, original)['invalid'])
                result = h.classify_invalid(field, original, pack(mutate(field, source)))
                self.assertTrue(result['invalid'], result)
                self.assertEqual(result['field'], field)
                self.assertNotEqual(result['sourceSha256'], result['artifactSha256'])
                self.assertTrue(result['reason'])

    def test_repacking_valid_nfd_and_namespace_decoys_are_not_invalidity(self):
        p = parts(); original = pack(p); doc = E.fromstring(p['word/document.xml'])
        E.SubElement(doc.find(W + 'body'), '{urn:foreign}bookmarkStart', {W + 'name': 'YRTK_unit'})
        p['word/document.xml'] = E.tostring(doc)
        for field in h.FIELDS:
            with self.subTest(field=field): self.assertFalse(h.classify_invalid(field, original, pack(p))['invalid'])

    def test_wrong_field_is_not_credited(self):
        p = parts(); original = pack(p)
        pairs = [('COMMENTS', 'METADATA'), ('ORDER', 'NOTES'), ('TABLES', 'STYLES'), ('UNICODE_IME_LOCALE', 'TEXT')]
        for made, requested in pairs:
            with self.subTest(made=made, requested=requested):
                self.assertFalse(h.classify_invalid(requested, original, pack(mutate(made, p)))['invalid'])

    def test_legal_nested_revision_and_expanded_table_grid_are_not_invalid(self):
        # CT_RunTrackChange permits nested ins/del; gridSpan can extend tblGrid.
        # https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.wordprocessing.runtrackchangetype
        p = parts(); original = pack(p); doc = E.fromstring(p['word/document.xml'])
        doc.find('.//' + W + 'ins').append(E.Element(W + 'del', {W + 'id': '3'}))
        table = E.SubElement(doc.find(W + 'body'), W + 'tbl')
        E.SubElement(E.SubElement(table, W + 'tblGrid'), W + 'gridCol')
        cell = E.SubElement(E.SubElement(table, W + 'tr'), W + 'tc')
        E.SubElement(E.SubElement(cell, W + 'tcPr'), W + 'gridSpan', {W + 'val': '2'})
        E.SubElement(cell, W + 'p'); p['word/document.xml'] = E.tostring(doc)
        for field in ['TABLES', 'TRACKED_REVIEW_SEMANTICS']:
            self.assertFalse(h.classify_invalid(field, original, pack(p))['invalid'])

    def test_invalid_source_and_archive_bypass_fail_closed(self):
        p = parts(); original = pack(p)
        with self.assertRaises(ValueError): h.classify_invalid('UNKNOWN', original, original)
        with self.assertRaises(ValueError): h.classify_invalid('TEXT', b'not a zip', original)
        p['../escape'] = b'no authority'
        with self.assertRaises(ValueError): h.classify_invalid('TEXT', original, pack(p))
        bad = pack(mutate('COMMENTS', parts()))
        with self.assertRaises(ValueError): h.classify_invalid('COMMENTS', bad, bad)

if __name__ == '__main__': unittest.main()

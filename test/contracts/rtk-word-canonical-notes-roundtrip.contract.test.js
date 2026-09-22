'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { buildFullManuscriptDocxReviewPacketSource } = require('../../src/export/docx/fullManuscriptDocxReviewPacketSource');
const { buildDocxReviewPacketBuffer } = require('../../src/export/docx/docxReviewPacketBuilder');
const { buildStoredZip } = require('../../src/export/docx/docxMinBuilder');
const { normalizeDocumentNoteSelections, validateDocumentNotesReturn } = require('../../src/export/docx/docxReviewPacketNotes');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const stable = value => Array.isArray(value) ? `[${value.map(stable).join(',')}]`
  : value && typeof value === 'object' ? `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stable(value[k])}`).join(',')}}` : JSON.stringify(value);
const cryptoPort = { sha256Text: sha, sha256Json: value => `sha256:${sha(stable(value))}`, byteLength: value => Buffer.byteLength(value),
  hmacSha256Json: (value, secret) => `hmac-sha256:${crypto.createHmac('sha256', secret).update(stable(value)).digest('hex')}`,
  hmacSha256Text: (value, secret) => `hmac-sha256:${crypto.createHmac('sha256', secret).update(value).digest('hex')}` };

function input() {
  const sceneId = 'roman/chapter/a.txt';
  const note = (id, scope, title, body) => ({ id, scope, title, body, deleted: false,
    attachment: { scope, sceneId, nodeId: 'node-a', ...(scope === 'selection'
      ? { anchor: { kind: 'text-range', start: 7, end: 9, quoteHash: sha('🧭') } } : {}) } });
  return { projectId: 'notes-project', projectRoot: '/synthetic', scenes: [
    { sceneId, scenePath: '/synthetic/roman/chapter/a.txt', text: 'Before 🧭 after.\nSecond paragraph.', order: 0 },
  ], notesDocument: { schemaVersion: 1, projectId: 'notes-project', notes: [
    note('note-foot', 'selection', 'Foot & <title>', '  Body\n\t尾 e\u0301 🧭  '),
    note('note-end', 'scene', '', 'End body'),
    note('note-private', 'inbox', 'Private', 'Never exported'),
    { ...note('note-deleted', 'scene', 'Deleted', 'Never exported either'), deleted: true },
  ] }, documentNoteSelections: [{ noteId: 'note-foot', kind: 'footnote' }, { noteId: 'note-end', kind: 'endnote' }] };
}

async function fixture(value = input()) {
  const bridge = await import('../../src/io/revisionBridge/index.mjs');
  const source = buildFullManuscriptDocxReviewPacketSource(value, { revisionBridge: bridge, cryptoPort });
  const bytes = buildDocxReviewPacketBuffer(source);
  const parse = data => bridge.buildDocxReviewTransportAnalysisFromZipBytes({ bytes: data,
    hmacSecret: source.forbiddenSecret, expectedAuthority: source.localAuthorityCapsule.expectedAuthority }, { cryptoPort });
  const extracted = bridge.extractDocxReviewTransportPackagePartsFromZipBytes({ bytes }, { cryptoPort });
  assert.equal(extracted.ok, true, JSON.stringify(extracted.reasons));
  const repack = mutate => { const parts = { ...extracted.parts }; mutate(parts);
    return buildStoredZip(Object.entries(parts).map(([name, data]) => ({ name, data }))); };
  const verify = result => validateDocumentNotesReturn({ expected: source.localAuthorityCapsule.documentNotes,
    returned: result.reviewIr?.documentNotes, signedDigest: result.authorityCarrier?.selectedCarrier?.payload?.documentNotesDigest });
  return { source, bytes, parse, repack, verify, parts: extracted.parts };
}

test('selected canonical notes emit real footnotes and endnotes with literal bodies and exact references', async () => {
  const { source, bytes, parse, verify, parts } = await fixture();
  const parsed = parse(bytes);
  assert.equal(parsed.ok, true, JSON.stringify(parsed.reasons));
  assert.equal(verify(parsed).ok, true, JSON.stringify(verify(parsed)));
  assert.deepEqual(parsed.reviewIr.documentNotes.notes, [
    { kind: 'endnote', paragraphIndex: 0, offsetUtf16: 0, paragraphs: ['', 'End body'] },
    { kind: 'footnote', paragraphIndex: 0, offsetUtf16: 9, paragraphs: ['Foot & <title>', '  Body\n\t尾 e\u0301 🧭  '] },
  ]);
  assert.match(parts['word/document.xml'], /<w:footnoteReference w:id="1"\/>/u);
  assert.match(parts['word/document.xml'], /<w:endnoteReference w:id="1"\/>/u);
  assert.match(parts['word/footnotes.xml'], /<w:footnoteRef\/>/u);
  assert.match(parts['word/endnotes.xml'], /<w:endnoteRef\/>/u);
  assert.match(parts['word/_rels/document.xml.rels'], /relationships\/footnotes/u);
  assert.match(parts['[Content_Types].xml'], /wordprocessingml.endnotes\+xml/u);
  assert.ok(!Object.values(parts).some(part => part.includes('Never exported')));
  assert.equal(parsed.reviewIr.structureChanges.some(item => /noteReference/u.test(item.structureKind)), false);
  assert.equal(source.localAuthorityCapsule.documentNotes.stateDigest, source.documentNotes.stateDigest);
});

test('default export does not include private notes and selectors never accept bodies or paths', async () => {
  const value = input(); delete value.documentNoteSelections;
  const { source, parts } = await fixture(value);
  assert.equal(source.documentNotes, null);
  assert.equal(parts['word/footnotes.xml'], undefined);
  assert.equal(parts['word/endnotes.xml'], undefined);
  for (const invalid of [null, {}, 'all', [{ noteId: 'note-foot', kind: 'footnote', body: 'injected' }],
    [{ noteId: '../notes', kind: 'footnote' }], [{ noteId: 'note-foot', kind: 'comment' }],
    [{ noteId: 'note-foot', kind: 'footnote' }, { noteId: 'note-foot', kind: 'endnote' }]]) {
    assert.throws(() => normalizeDocumentNoteSelections(invalid), /DOCX_NOTES_SELECTION_INVALID/u);
  }
});

test('missing, deleted, wrong-project, stale and split-surrogate source anchors fail before producing a DOCX', () => {
  for (const change of [
    v => { v.notesDocument.projectId = 'other'; },
    v => { v.documentNoteSelections[0].noteId = 'missing'; },
    v => { v.documentNoteSelections[0].noteId = 'note-deleted'; },
    v => { v.notesDocument.notes[0].attachment.sceneId = 'other'; },
    v => { v.notesDocument.notes[0].attachment.anchor.quoteHash = '0'.repeat(64); },
    v => { v.notesDocument.notes[0].attachment.anchor.end = 8; },
    v => { v.notesDocument.notes[0].attachment.anchor.end = 30; },
    v => { v.notesDocument.notes[0].body = 'bad\rnewline'; },
    v => { v.notesDocument.notes[0].body = 'x'.repeat(200001); },
  ]) { const value = input(); change(value); assert.throws(() => buildFullManuscriptDocxReviewPacketSource(value), /DOCX_NOTE/u); }
});

test('native numbering may change only when each reference still maps bijectively to the same body', async () => {
  const { repack, parse, verify } = await fixture();
  const renumbered = repack(parts => {
    parts['word/footnotes.xml'] = parts['word/footnotes.xml'].replace('<w:footnote w:id="1">', '<w:footnote w:id="23">');
    parts['word/document.xml'] = parts['word/document.xml'].replace('<w:footnoteReference w:id="1"/>', '<w:footnoteReference w:id="23"/>');
  });
  const parsed = parse(renumbered);
  assert.equal(parsed.ok, true, JSON.stringify(parsed.reasons));
  assert.equal(verify(parsed).ok, true);
});

test('missing parts, orphan bodies, duplicate references, external targets and unsupported note content reject', async () => {
  const { repack, parse } = await fixture();
  const cases = [
    parts => { delete parts['word/footnotes.xml']; },
    parts => { parts['word/document.xml'] = parts['word/document.xml'].replace('<w:footnoteReference w:id="1"/>', ''); },
    parts => { parts['word/document.xml'] = parts['word/document.xml'].replace('<w:footnoteReference w:id="1"/>', '<w:footnoteReference w:id="1"/><w:footnoteReference w:id="1"/>'); },
    parts => { parts['word/footnotes.xml'] = parts['word/footnotes.xml'].replace('<w:footnote w:id="1">', '<w:footnote w:id="0">'); },
    parts => { parts['word/footnotes.xml'] = parts['word/footnotes.xml'].replace('<w:footnoteRef/>', '<w:drawing/>'); },
    parts => { parts['word/_rels/document.xml.rels'] = parts['word/_rels/document.xml.rels'].replace('Target="footnotes.xml"', 'Target="https://example.test/footnotes.xml" TargetMode="External"'); },
    parts => { parts['word/footnotes.xml'] = parts['word/footnotes.xml'].replace('<w:footnoteRef/>', '<x:footnoteRef xmlns:x="urn:foreign"/>'); },
  ];
  for (const [index, mutate] of cases.entries()) {
    const result = parse(repack(mutate));
    assert.equal(result.ok, false, `mutant ${index}`);
    const codes = [result.code, ...(result.reasons || []).map(item => item.code)];
    const expected = index === 0 ? 'STAGE02_INTERNAL_RELATIONSHIP_TARGET_MISSING'
      : index === 5 ? 'STAGE02_EXTERNAL_RELATIONSHIP_PRESENT' : 'RTK_WORD_NOTES_MALFORMED_BLOCKED';
    assert.ok(codes.includes(expected), JSON.stringify({ index, result }));
    assert.equal(result.canApply, false);
    assert.equal(result.canWriteManuscript, false);
  }
});

test('parseable changes to body, title, position or signed digest never pass the local return binding', async () => {
  const { repack, parse, verify, source } = await fixture();
  const mutations = [
    parts => { parts['word/footnotes.xml'] = parts['word/footnotes.xml'].replace('Body', 'Changed'); },
    parts => { parts['word/footnotes.xml'] = parts['word/footnotes.xml'].replace('Foot &amp;', 'Other &amp;'); },
    parts => { parts['word/document.xml'] = parts['word/document.xml'].replace('Before 🧭', 'Before x🧭'); },
  ];
  for (const mutate of mutations) {
    const result = parse(repack(mutate));
    assert.equal(result.ok, true, JSON.stringify(result.reasons));
    assert.equal(verify(result).ok, false);
  }
  assert.equal(validateDocumentNotesReturn({ expected: source.documentNotes, returned: source.documentNotes,
    signedDigest: 'sha256:' + '0'.repeat(64) }).ok, false);
  assert.equal(validateDocumentNotesReturn({ returned: source.documentNotes }).ok, false);
});

test('physical fixture note selectors survive five canonical text rounds and private notes stay excluded', async () => {
  const f=await import('../../scripts/ops/rtk-interop-word-manuscript-fixtures.mjs');
  const {normalizeNotesDocument}=await import('../../src/core/notesStorage.mjs');
  for(const volume of f.MANUSCRIPT_VOLUMES){
    const fixture=f.buildWordManuscriptFixture(volume,'C3');
    const scenes=fixture.scenes.map((s,i)=>({sceneId:`roman/${i}.txt`,nodeId:`node-${i}`,scenePath:`/synthetic/roman/${i}.txt`,order:i}));
    const notes=f.buildWordManuscriptNoteState({fixture,projectId:'notes-project',scenes});
    assert.equal(normalizeNotesDocument(notes.document,{projectId:'notes-project'}).changed,false);
    let digest;
    for(const round of [0,1,5]){
      const source=buildFullManuscriptDocxReviewPacketSource({projectId:'notes-project',projectRoot:'/synthetic',scenes:scenes.map((s,i)=>({...s,text:fixture.forRound(round)[i].join('\n')})),notesDocument:notes.document,documentNoteSelections:notes.selections});
      assert.deepEqual(source.documentNotes.notes,notes.projection);
      digest??=source.documentNotes.protectedDigest;assert.equal(source.documentNotes.protectedDigest,digest);
      assert.equal(source.documentNotes.sourceBindings.length,4);
      assert.ok(source.documentNotes.sourceBindings.every(n=>!['note-private','note-deleted'].includes(n.noteId)));
    }
  }
});

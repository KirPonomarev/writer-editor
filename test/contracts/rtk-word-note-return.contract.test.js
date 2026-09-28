'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const model = require('../../src/core/word-manuscript-notes-v1.cjs');
const { planNoteReturnDelta: plan } = require('../../src/core/word-note-return-delta-v1.cjs');
const { buildFullManuscriptDocxReviewPacketSource: makeSource } = require('../../src/export/docx/fullManuscriptDocxReviewPacketSource.js');
const { buildDocxReviewPacketBuffer } = require('../../src/export/docx/docxReviewPacketBuilder.js');
const { buildStoredZip } = require('../../src/export/docx/docxMinBuilder.js');
const hash = model.sha;
const stable = v => Array.isArray(v) ? `[${v.map(stable).join(',')}]` : v && typeof v === 'object'
  ? `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}` : JSON.stringify(v);
const ports = { cryptoPort: { sha256Text: hash, sha256Json: v => 'sha256:' + hash(stable(v)), byteLength: v => Buffer.byteLength(v) } };
async function fixture(mutate) {
  const text = 'До слова 😀 после.', sceneId = 'roman/a.txt', projectId = 'notes-return';
  const body = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Точная сноска', marks: [{ type: 'bold' }] }] }, { type: 'paragraph', content: [{ type: 'text', text: 'Второй абзац.' }] }] };
  const document = { schemaVersion: 1, projectId, notes: [{ schemaVersion: 1, id: 'note-a', title: '', scope: 'manuscript', body: 'Точная сноска\nВторой абзац.', deleted: false,
    manuscript: model.bindManuscriptPayload({ kind: 'footnote', body, sceneId, offsetUtf16: 3, sceneContent: text }) },
  { id: 'private', title: 'Private', body: 'Never export', scope: 'project', deleted: false }] };
  const source = makeSource({ projectId, projectRoot: '/project', notesDocument: document,
    scenes: [{ sceneId, scenePath: '/project/' + sceneId, order: 0, text, doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] } }] });
  const bridge = await import('../../src/io/revisionBridge/index.mjs');
  const original = buildDocxReviewPacketBuffer(source);
  const parts = { ...bridge.extractDocxReviewTransportPackagePartsFromZipBytes({ bytes: original }).parts };
  if (mutate) mutate(parts, source);
  const bytes = buildStoredZip(Object.entries(parts).map(([name, data]) => ({ name, data })));
  const parsed = bridge.buildDocxReviewTransportAnalysisFromZipBytes({ bytes }, ports);
  return { document, source, bytes, parts, parsed, bridge, input: { document, projectId, roundId: source.roundId || 'round-test',
    artifactSha256: hash(bytes), baseline: source.documentNotes, exportMap: source.localAuthorityCapsule.exportMap,
    returnedNotes: parsed.ok && !parsed.reasons.some(x => /NOTES.*BLOCKED/.test(x.code)) ? bridge.parseDocumentNotesRichReturn(bytes, parsed.reviewIr.documentNotes) : null,
    returnedParagraphs: parsed.reviewIr?.formattingParagraphs, now: '2026-09-28T03:00:00.000Z' } };
}
test('actual full exporter and parser retain stable identity, exact rich body and unchanged graph', async () => {
  const f = await fixture(); assert.equal(f.parsed.ok, true, JSON.stringify(f.parsed.reasons));
  assert.match(f.input.returnedNotes[0].transportIdentity, /^_YALKEN_NOTE_[a-f0-9]{24}$/);
  assert.equal(f.input.returnedNotes[0].body.content[0].content[0].marks[0].type, 'bold');
  assert.equal(model.validateNoteBody(f.input.returnedNotes[0].body).text, f.document.notes[0].body);
  assert.equal(plan(f.input).unchanged, true);
});
test('body edit and native ID renumber preserve local identity; replay and local conflict are guarded', async () => {
  const f = await fixture(p => {
    p['word/footnotes.xml'] = p['word/footnotes.xml'].replace('Точная сноска', 'Правка Word').replace('w:id="1"', 'w:id="19"');
    p['word/document.xml'] = p['word/document.xml'].replace('footnoteReference w:id="1"', 'footnoteReference w:id="19"');
  });
  assert.equal(f.parsed.ok, true, JSON.stringify(f.parsed.reasons));
  const result = plan(f.input); assert.equal(result.changes.length, 1); assert.equal(result.changes[0].operation, 'update');
  assert.equal(result.document.notes[0].id, 'note-a'); assert.match(result.document.notes[0].body, /Правка Word/);
  assert.deepEqual(result.document.notes[1], f.document.notes[1]);
  assert.equal(plan({ ...f.input, document: result.document }).replay, true);
  const local = structuredClone(f.document); local.notes[1].body += '!';
  assert.throws(() => plan({ ...f.input, document: local }), /NOTE_RETURN_BASELINE_CONFLICT/);
  const editedAfter = structuredClone(result.document); editedAfter.notes[1].body += '!';
  assert.throws(() => plan({ ...f.input, document: editedAfter }), /NOTE_RETURN_REPLAY_CONFLICT/);
});
test('kind conversion and point movement preserve identity; deletion retains original rich body', async () => {
  const f = await fixture();
  const moved = structuredClone(f.input.returnedNotes); moved[0].kind = 'endnote'; moved[0].offsetUtf16 = 2;
  const changed = plan({ ...f.input, returnedNotes: moved });
  assert.equal(changed.document.notes[0].manuscript.kind, 'endnote');
  assert.equal(changed.document.notes[0].manuscript.reference.offsetUtf16, 2);
  const removed = plan({ ...f.input, returnedNotes: [] });
  assert.equal(removed.document.notes[0].deleted, true);
  assert.deepEqual(removed.document.notes[0].manuscript, f.document.notes[0].manuscript);
  assert.deepEqual(removed.document.notes[1], f.document.notes[1]);
});
test('new note receives local identity; foreign and duplicated identity, split surrogate and changed manuscript fail closed', async () => {
  const f = await fixture();
  const created = { ...structuredClone(f.input.returnedNotes[0]), transportIdentity: null };
  const result = plan({ ...f.input, returnedNotes: [...f.input.returnedNotes, created] });
  assert.equal(result.document.notes.length, 3); assert.match(result.document.notes[2].id, /^note-[a-f0-9]{32}$/);
  for (const returnedNotes of [[...f.input.returnedNotes, ...f.input.returnedNotes],
    [{ ...created, transportIdentity: '_YALKEN_NOTE_' + '0'.repeat(24) }], [{ ...created, offsetUtf16: 10 }]]) {
    assert.throws(() => plan({ ...f.input, returnedNotes }), /NOTE_RETURN_(IDENTITY_COLLISION|POINT_INVALID)/);
  }
  const paragraphs = structuredClone(f.input.returnedParagraphs); paragraphs[0].paragraphText += '!';
  assert.throws(() => plan({ ...f.input, returnedParagraphs: paragraphs }), /NOTE_RETURN_MANUSCRIPT_CHANGED/);
});
test('malformed bookmark pair and duplicate identity are rejected by actual package parser', async () => {
  for (const mutate of [p => { p['word/footnotes.xml'] = p['word/footnotes.xml'].replace('<w:bookmarkEnd w:id="100000"/>', ''); },
    p => { p['word/footnotes.xml'] = p['word/footnotes.xml'].replace('<w:footnote w:id="1">', '<w:footnote w:id="1"><w:p><w:bookmarkStart w:id="99" w:name="_YALKEN_NOTE_000000000000000000000000"/><w:bookmarkEnd w:id="99"/></w:p>'); }]) {
    const f = await fixture(mutate);
    assert(f.parsed.reasons.some(x => x.code === 'RTK_WORD_NOTES_MALFORMED_BLOCKED'));
  }
});

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const model = require('../../src/core/word-manuscript-notes-v1.cjs');
const { buildCanonicalNotesExport, notePackageParts, noteMarkersForBlock, validateDocumentNotesReturn } = require('../../src/export/docx/docxReviewPacketNotes.js');
const { buildStoredZip } = require('../../src/export/docx/docxMinBuilder.js');
const { planNoteReturnDelta } = require('../../src/core/word-note-return-delta-v1.cjs');
const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main', R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/';
const stable = v => Array.isArray(v) ? `[${v.map(stable).join(',')}]` : v && typeof v === 'object'
  ? `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}` : JSON.stringify(v);
const ports = { cryptoPort: { sha256Text: model.sha, sha256Json: v => 'sha256:' + model.sha(stable(v)), byteLength: v => Buffer.byteLength(v) } };
async function fixture({ remove = false, dangling = '', multipleLinks = false } = {}) {
  const bridge = await import('../../src/io/revisionBridge/index.mjs');
  const body = id => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Note ' + id,
    ...(multipleLinks ? { marks: [{ type: 'link', attrs: { href: 'https://example.invalid/' + id } }] } : {}) }] }] });
  const document = { schemaVersion: 1, projectId: 'p', notes: ['a', 'b'].map(id => ({ id, scope: 'manuscript', title: '', body: 'Note ' + id,
    manuscript: model.bindManuscriptPayload({ body: body(id), kind: 'footnote', sceneId: 'roman/a.txt', offsetUtf16: 0, sceneContent: 'Text' }) })) };
  const block = { sceneId: 'roman/a.txt', blockId: 'b', documentParagraphIndex: 0, text: 'Text' };
  const projection = buildCanonicalNotesExport(document, [], [block], 'p', { editableReturn: true });
  const parts = notePackageParts(projection), marker = noteMarkersForBlock(projection, block).get(0);
  const entries = [
    { name: '[Content_Types].xml', data: `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>${!remove || dangling === 'type' ? parts.contentTypes : ''}</Types>` },
    { name: '_rels/.rels', data: `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="d" Type="${R}officeDocument" Target="word/document.xml"/></Relationships>` },
    { name: 'word/_rels/document.xml.rels', data: `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${!remove || dangling === 'relationship' ? parts.relationships : ''}</Relationships>` },
    { name: 'word/document.xml', data: `<w:document xmlns:w="${W}"><w:body><w:p>${!remove || dangling === 'reference' ? marker : ''}<w:r><w:t>Text</w:t></w:r></w:p></w:body></w:document>` },
    ...(!remove ? parts.entries : []),
  ];
  const bytes = buildStoredZip(entries), parsed = bridge.buildDocxReviewTransportAnalysisFromZipBytes({ bytes }, ports);
  return { bridge, parsed, bytes, projection, document, block };
}
test('complete absence can propose deletion; missing parts with dangling relationships, types or references cannot', async () => {
  for (const dangling of ['', 'relationship', 'type', 'reference']) {
    const f = await fixture({ remove: true, dangling });
    if (!dangling) {
      assert.equal(f.parsed.ok, true); assert.equal(f.parsed.reviewIr.documentNotes, undefined);
      assert.deepEqual(f.bridge.parseDocumentNotesRichReturn(f.bytes, f.parsed.reviewIr.documentNotes), []);
    } else {
      assert(f.parsed.ok === false || f.parsed.reasons?.some(item => /NOTES.*BLOCKED|MISSING/u.test(item.code)), JSON.stringify(f.parsed));
      if (f.parsed.reviewIr?.documentNotes) assert.throws(() => f.bridge.parseDocumentNotesRichReturn(f.bytes, f.parsed.reviewIr.documentNotes), /NOTE_RETURN_GRAPH_INCOMPLETE/);
    }
  }
});
test('separate hyperlinks in multiple notes retain each exact destination and body', async () => {
  const f = await fixture({ multipleLinks: true }); assert.equal(f.parsed.ok, true, JSON.stringify(f.parsed.reasons));
  const returned = f.bridge.parseDocumentNotesRichReturn(f.bytes, f.parsed.reviewIr.documentNotes);
  assert.deepEqual(returned.map(note => note.body.content[0].content[0].marks.find(m => m.type === 'link').attrs.href), ['https://example.invalid/a', 'https://example.invalid/b']);
  const generic = f.bridge.buildDocxContentPreviewFromZipBytes(f.bytes); assert.equal(generic.ok, true, JSON.stringify(generic));
  assert.equal(generic.contentPreview.manuscriptNotes.length, 2);
});
test('empty canonical export baseline admits first new Word note without inventing a provider identity', () => {
  const document = { schemaVersion: 1, projectId: 'p', notes: [] }, block = { sceneId: 'roman/a.txt', blockId: 'b', documentParagraphIndex: 0, text: 'Text', formatIr: { runs: [{ text: 'Text' }] } };
  const baseline = buildCanonicalNotesExport(document, [], [block], 'p', { editableReturn: true });
  assert.equal(validateDocumentNotesReturn({ expected: baseline, returned: null, signedDigest: baseline.protectedDigest }).ok, true);
  const body = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'First' }] }] };
  const result = planNoteReturnDelta({ document, projectId: 'p', roundId: 'r', artifactSha256: 'a'.repeat(64), baseline,
    exportMap: { scenes: [{ sceneId: block.sceneId, blocks: [block] }] }, returnedParagraphs: [{ paragraphIndex: 0, paragraphText: 'Text', trackedRevision: false }],
    returnedNotes: [{ kind: 'footnote', paragraphIndex: 0, offsetUtf16: 4, body, transportIdentity: null }], now: '2026-09-28T00:00:00Z' });
  assert.equal(result.changes[0].operation, 'create'); assert.match(result.document.notes[0].id, /^note-[a-f0-9]{32}$/);
});

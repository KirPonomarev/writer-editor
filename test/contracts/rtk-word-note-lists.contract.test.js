'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const model = require('../../src/core/word-manuscript-notes-v1.cjs');
const { buildCanonicalNotesExport, notePackageParts } = require('../../src/export/docx/docxReviewPacketNotes.js');
const { buildDocxMinBuffer } = require('../../src/export/docx/docxMinBuilder.js');
const { planNoteReturnDelta } = require('../../src/core/word-note-return-delta-v1.cjs');
const p = text => ({ type: 'paragraph', content: [{ type: 'text', text, marks: [{ type: 'bold' }] }] });
const item = (...content) => ({ type: 'listItem', content });
const list = (type, content, start = 1) => ({ type, ...(type === 'orderedList' ? { attrs: { start } } : {}), content });
const doc = (...content) => ({ type: 'doc', content });
const body = () => doc(p('Before'), list('orderedList', [item(p('One'), list('bulletList', [item(p('Nested'))])), item(p('Two'))], 4), p('After'), list('orderedList', [item(p('Restart'))], 9));
function fixture(value = body()) {
  const block = { sceneId: 'roman/a.txt', blockId: 'b', documentParagraphIndex: 0, text: 'Text', formatIr: { runs: [{ text: 'Text' }] } };
  const document = { schemaVersion: 1, projectId: 'p', notes: ['footnote', 'endnote'].map(kind => ({ id: kind, scope: 'manuscript', title: '', body: model.validateNoteBody(value).text,
    manuscript: model.bindManuscriptPayload({ body: value, kind, sceneId: block.sceneId, offsetUtf16: 2, sceneContent: block.text }) })) };
  const projection = buildCanonicalNotesExport(document, [], [block], 'p', { editableReturn: true });
  return { document, block, projection };
}
test('bounded note lists preserve nested topology, starts and paragraph text', () => {
  const parsed = model.validateNoteBody(body());
  assert.equal(parsed.text, 'Before\nOne\nNested\nTwo\nAfter\nRestart');
  assert.deepEqual(parsed.paragraphs.map(row => row.list?.level ?? null), [null, 0, 1, 0, null, 0]);
  assert.deepEqual(parsed.body, body());
  for (const bad of [doc(list('orderedList', [item(p('x'))], -1)), doc(list('orderedList', [item(p('x')), item(p('y'))], 2147483647)),
    doc(list('bulletList', [])), doc(list('bulletList', [item(p('x'), p('ambiguous continuation'))])), doc({ type: 'table', content: [] }),
    doc(list('bulletList', [{ type: 'listItem', attrs: { authority: true }, content: [p('x')] }]))]) {
    assert.throws(() => model.validateNoteBody(bad), /NOTE_BODY_/);
  }
  const deep = depth => depth ? list('bulletList', [item(p('x'), deep(depth - 1))]) : list('bulletList', [item(p('x'))]);
  assert.doesNotThrow(() => model.validateNoteBody(doc(deep(8))));
  assert.throws(() => model.validateNoteBody(doc(deep(9))), /NOTE_BODY_LIST_STRUCTURE/);
  assert.doesNotThrow(() => model.validateNoteBody(doc(list('bulletList', Array.from({ length: 128 }, () => item(p('x')))))));
  assert.throws(() => model.validateNoteBody(doc(p('extra'), list('bulletList', Array.from({ length: 128 }, () => item(p('x')))))), /NOTE_BODY_BUDGET/);
});
test('note numbering IDs remain disjoint from manuscript and other note parts', () => {
  const { projection } = fixture();
  const parts = notePackageParts(projection, { firstNumId: 37 });
  assert.deepEqual(parts.numberings.map(n => n.numId), [37, 38, 39, 40, 41, 42]);
  assert.deepEqual(parts.numberings.map(n => n.start), [4, 1, 9, 4, 1, 9]);
  const foot = parts.entries.find(e => e.name === 'word/footnotes.xml').data;
  assert.match(foot, /w:ilvl w:val="1"\/><w:numId w:val="38"/);
  assert.equal((foot.match(/w:numId w:val="37"/g) || []).length, 2);
  assert.equal((foot.match(/w:footnoteRef\//g) || []).length, 1);
});
test('minimal export imports exact rich lists in both note kinds with inline marks', async () => {
  const bridge = await import('../../src/io/revisionBridge/index.mjs');
  const { document, block, projection } = fixture();
  const [docxPageSetupBindModule, semanticMappingModule, styleMapModule] = await Promise.all([
    import('../../src/docxPageSetupBind.mjs'), import('../../src/derived/semanticMapping.mjs'), import('../../src/derived/styleMap.mjs'),
  ]);
  const bytes = buildDocxMinBuffer({ doc: doc(p('Text')), plainText: 'Text', bookProfile: { formatId: 'A4' } },
    { docxPageSetupBindModule, semanticMappingModule, styleMapModule, documentNotes: projection, noteBlocks: [block] });
  const preview = bridge.buildDocxContentPreviewFromZipBytes(bytes);
  assert.equal(preview.ok, true, JSON.stringify(preview));
  assert.deepEqual(preview.contentPreview.manuscriptNotes.map(n => n.body), document.notes.map(n => n.manuscript.body));
});
test('unchanged text with changed numbering is an explicit identity-preserving return update', () => {
  const { document, block, projection } = fixture();
  const changed = body(); changed.content[1].attrs.start = 7;
  const returnedNotes = projection.sourceBindings.map(binding => ({ kind: binding.kind, paragraphIndex: 0, offsetUtf16: 2,
    body: binding.kind === 'footnote' ? changed : body(), transportIdentity: binding.transportIdentity }));
  const result = planNoteReturnDelta({ document, projectId: 'p', roundId: 'r', artifactSha256: 'a'.repeat(64), baseline: projection,
    exportMap: { scenes: [{ sceneId: block.sceneId, blocks: [block] }] }, returnedParagraphs: [{ paragraphIndex: 0, paragraphText: 'Text', trackedRevision: false }],
    returnedNotes, now: '2026-10-01T00:00:00Z' });
  assert.equal(result.changes.length, 1); assert.equal(result.changes[0].operation, 'update');
  assert.equal(result.document.notes[0].id, document.notes[0].id);
  assert.deepEqual(result.document.notes[0].manuscript.body, changed);
  assert.deepEqual(result.document.notes[1], document.notes[1]);
  const malformed = structuredClone(returnedNotes); malformed[0].body.content[1].attrs.start = -1;
  assert.throws(() => planNoteReturnDelta({ document, projectId: 'p', roundId: 'r', artifactSha256: 'a'.repeat(64), baseline: projection,
    exportMap: { scenes: [{ sceneId: block.sceneId, blocks: [block] }] }, returnedParagraphs: [{ paragraphIndex: 0, paragraphText: 'Text', trackedRevision: false }], returnedNotes: malformed }), /NOTE_BODY_LIST_START/);
});

test('actual Tiptap list schema decimal defaults remain admissible; other markers fail closed', async () => {
  const { getSchema } = await import('@tiptap/core');
  const { default: StarterKit } = await import('@tiptap/starter-kit');
  const schema = getSchema([StarterKit]);
  const authored = schema.nodeFromJSON(body()).toJSON();
  assert.equal(authored.content[1].attrs.type, null);
  assert.doesNotThrow(() => model.validateNoteBody(authored));
  for (const type of ['a', 'I', 'i', 'A', 'x', 1]) {
    const invalid = structuredClone(authored); invalid.content[1].attrs.type = type;
    assert.throws(() => model.validateNoteBody(invalid), /NOTE_BODY_LIST_FORMAT/);
  }
});

test('note source comparison admits only inert editor root defaults; authored and domain changes stay stale', async () => {
  const { commentSceneSnapshotsEqual } = await import('../../src/io/revisionBridge/reviewTransportNonTextReturnRuntime.mjs');
  const { getSchema } = await import('@tiptap/core');
  const { default: StarterKit } = await import('@tiptap/starter-kit');
  const { WordPendingRevisions } = await import('../../src/renderer/tiptap/wordPendingRevisions.mjs');
  const { UserBookmarks } = await import('../../src/renderer/tiptap/userBookmarks.mjs');
  const source = doc(p('Text'));
  const live = getSchema([StarterKit, WordPendingRevisions, UserBookmarks]).nodeFromJSON(source).toJSON();
  const same = (a, b) => commentSceneSnapshotsEqual(model.noteSceneSchemaDefaults(a), model.noteSceneSchemaDefaults(b));
  assert.equal(commentSceneSnapshotsEqual(source, live), false);
  assert.equal(same(source, live), true);
  for (const attrs of [{ wordUserBookmarks: { bookmarks: [] } }, { wordPendingRevisions: { revisions: [] } }, { unknown: null }]) {
    assert.equal(same(source, { ...live, attrs: { ...live.attrs, ...attrs } }), false);
  }
  assert.equal(same(source, doc(p('Changed'))), false);
  assert.equal(same(source, { ...source, attrs: null }), false);
});

test('literal Word numbering in footnotes imports without a Yalken export; unsupported formats remain no-write', async () => {
  const bridge = await import('../../src/io/revisionBridge/index.mjs');
  const { buildStoredZip } = require('../../src/export/docx/docxMinBuilder.js');
  const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const P = 'http://schemas.openxmlformats.org/package/2006/relationships';
  const bytes = (format = 'decimal') => buildStoredZip([
    { name: '[Content_Types].xml', data: `<Types xmlns="${P.replace('relationships', 'content-types')}"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/footnotes.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/></Types>` },
    { name: '_rels/.rels', data: `<Relationships xmlns="${P}"><Relationship Id="d" Type="${R}/officeDocument" Target="word/document.xml"/></Relationships>` },
    { name: 'word/_rels/document.xml.rels', data: `<Relationships xmlns="${P}"><Relationship Id="n" Type="${R}/footnotes" Target="footnotes.xml"/><Relationship Id="l" Type="${R}/numbering" Target="numbering.xml"/></Relationships>` },
    { name: 'word/document.xml', data: `<w:document xmlns:w="${W}"><w:body><w:p><w:r><w:t>Text</w:t><w:footnoteReference w:id="1"/></w:r></w:p></w:body></w:document>` },
    { name: 'word/numbering.xml', data: `<w:numbering xmlns:w="${W}"><w:abstractNum w:abstractNumId="5"><w:lvl w:ilvl="0"><w:start w:val="4"/><w:numFmt w:val="${format}"/><w:lvlText w:val="%1."/></w:lvl></w:abstractNum><w:num w:numId="8"><w:abstractNumId w:val="5"/></w:num></w:numbering>` },
    { name: 'word/footnotes.xml', data: `<w:footnotes xmlns:w="${W}"><w:footnote w:id="1">${['First', 'Second'].map((text, i) => `<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="8"/></w:numPr></w:pPr><w:r>${i ? '' : '<w:footnoteRef/>'}<w:t>${text}</w:t></w:r></w:p>`).join('')}</w:footnote></w:footnotes>` },
  ]);
  const good = bridge.buildDocxContentPreviewFromZipBytes(bytes());
  assert.equal(good.ok, true, JSON.stringify(good));
  const note = good.contentPreview.manuscriptNotes[0];
  assert.equal(note.offsetUtf16, 4);
  assert.equal(note.body.content[0].type, 'orderedList');
  assert.equal(note.body.content[0].attrs.start, 4);
  assert.equal(model.validateNoteBody(note.body).text, 'First\nSecond');
  for (const format of ['upperRoman', 'lowerLetter', 'none', 'decimalZero']) {
    assert.equal(bridge.buildDocxContentPreviewFromZipBytes(bytes(format)).ok, false, format);
  }
});

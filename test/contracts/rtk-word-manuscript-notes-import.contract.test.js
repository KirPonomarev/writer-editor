'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { buildStoredZip } = require('../../src/export/docx/docxMinBuilder.js');
const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const P = 'http://schemas.openxmlformats.org/package/2006/relationships';
function fixture({ kind = 'footnote', id = '7', reference = id, body, href = 'https://example.invalid/note', extra = '' } = {}) {
  return buildStoredZip([
    { name: '[Content_Types].xml', data: `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/${kind}s.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.${kind}s+xml"/></Types>` },
    { name: '_rels/.rels', data: `<Relationships xmlns="${P}"><Relationship Id="d" Type="${R}/officeDocument" Target="word/document.xml"/></Relationships>` },
    { name: 'word/_rels/document.xml.rels', data: `<Relationships xmlns="${P}"><Relationship Id="n" Type="${R}/${kind}s" Target="${kind}s.xml"/></Relationships>` },
    { name: `word/_rels/${kind}s.xml.rels`, data: `<Relationships xmlns="${P}"><Relationship Id="l" Type="${R}/hyperlink" Target="${href}" TargetMode="External"/></Relationships>` },
    { name: 'word/document.xml', data: `<w:document xmlns:w="${W}"><w:body><w:p><w:r><w:t xml:space="preserve">До </w:t></w:r><w:r><w:${kind}Reference w:id="${reference}"/></w:r><w:r><w:t>слова</w:t></w:r></w:p></w:body></w:document>` },
    { name: `word/${kind}s.xml`, data: `<w:${kind}s xmlns:w="${W}" xmlns:r="${R}"><w:${kind} w:id="${id}"><w:p><w:r><w:${kind}Ref/></w:r>${body || '<w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">Точная </w:t><w:tab/><w:t>😀</w:t><w:br/><w:t>строка</w:t></w:r><w:hyperlink r:id="l"><w:r><w:t>ссылка</w:t></w:r></w:hyperlink>'}</w:p><w:p/></w:${kind}>${extra}</w:${kind}s>` },
  ]);
}
for (const kind of ['footnote', 'endnote']) test(`ordinary ${kind} imports exact rich body and point with new local identity`, async t => {
  const bridge = await import('../../src/io/revisionBridge/index.mjs');
  const safe = require('../fixtures/docx-import-real-authority.cjs');
  const preview = bridge.buildDocxContentPreviewFromZipBytes(fixture({ kind }));
  assert.equal(preview.ok, true, JSON.stringify(preview));
  const plan = bridge.buildDocxImportPreviewPlanFromContentPreview(preview);
  assert.equal(plan.ok, true, JSON.stringify(plan));
  const candidates = plan.candidateCreatePlan.entries[0].notes;
  assert.equal(candidates.length, 1); assert.equal(candidates[0].kind, kind); assert.equal(candidates[0].offsetUtf16, 3);
  assert.deepEqual(candidates[0].body.content.map(p => p.type), ['paragraph', 'paragraph']);
  assert.equal(candidates[0].body.content[0].content.filter(n => n.type === 'hardBreak').length, 1);
  assert.equal(candidates[0].body.content[0].content[0].marks[0].type, 'bold');
  safe.rememberDocxImportPreviewPlanAdmission(plan);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'notes-generic-import-'));t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const romanRoot = path.join(root, 'roman');fs.mkdirSync(romanRoot);
  const options = { projectRoot: root, romanRoot, projectId: 'p' };
  const first = await safe.applyDocxImportSafeCreate({ docxImportPreviewPlan: plan }, options);
  assert.equal(first.ok, true, JSON.stringify(first));
  const notesPath = path.join(root, 'notes.craftsman.json'), before = JSON.parse(fs.readFileSync(notesPath));
  assert.equal(before.notes.length, 1);assert.match(before.notes[0].id, /^note-[a-f0-9]{32}$/);
  assert.deepEqual(before.notes[0].manuscript.body, candidates[0].body);
  assert.equal(before.notes[0].manuscript.reference.offsetUtf16, 3);
  const next = await safe.applyDocxImportSafeCreate({ docxImportPreviewPlan: plan }, { ...options, importRequestNonce: 'second' });
  assert.equal(next.ok, true, JSON.stringify(next));
  const after = JSON.parse(fs.readFileSync(notesPath));assert.equal(after.notes.length, 2);assert.deepEqual(after.notes[0], before.notes[0]);
  assert.notEqual(after.notes[1].id, after.notes[0].id);
  const replay = await safe.applyDocxImportSafeCreate({ docxImportPreviewPlan: plan }, { ...options, importRequestNonce: 'second' });
  assert.equal(replay.ok, true, JSON.stringify(replay));assert.equal(replay.value.idempotent, true);
});
test('dangling references, unsafe links, nested notes and hidden bodies do not become full generic imports', async () => {
  const bridge = await import('../../src/io/revisionBridge/index.mjs');
  for (const options of [{ reference: '8' }, { href: 'file:///secret' },
    { body: '<w:r><w:footnoteReference w:id="7"/></w:r>' },
    { body: '<w:r><w:rPr><w:vanish/></w:rPr><w:t>secret</w:t></w:r>' }]) {
    const preview = bridge.buildDocxContentPreviewFromZipBytes(fixture(options));
    assert.equal(preview.ok, false, JSON.stringify(preview));
  }
});

test('scene DOCX export carries both native note kinds and rich bodies; private and deleted notes stay excluded', async () => {
  const bridge = await import('../../src/io/revisionBridge/index.mjs');
  const envelope = require('../../src/core/document-content-envelope-v1.cjs');
  const model = require('../../src/core/word-manuscript-notes-v1.cjs');
  const { buildCanonicalNotesExport } = require('../../src/export/docx/docxReviewPacketNotes.js');
  const { buildDocxMinBuffer } = require('../../src/export/docx/docxMinBuilder.js');
  const [docxPageSetupBindModule, semanticMappingModule, styleMapModule] = await Promise.all([
    import('../../src/docxPageSetupBind.mjs'), import('../../src/derived/semanticMapping.mjs'), import('../../src/derived/styleMap.mjs'),
  ]);
  const first = bridge.buildDocxImportPreviewPlanFromContentPreview(bridge.buildDocxContentPreviewFromZipBytes(fixture()));
  const entry = first.candidateCreatePlan.entries[0];
  const doc = envelope.parseObservablePayload(entry.content);
  const body = entry.notes[0].body;
  const note = (id, kind, point) => ({ id, scope: 'manuscript', title: '', body: model.validateNoteBody(body).text,
    manuscript: model.bindManuscriptPayload({ kind, body, sceneId: 'roman/a.txt', offsetUtf16: point, sceneContent: entry.content }) });
  const document = { schemaVersion: 1, projectId: 'p', notes: [note('foot', 'footnote', 3), note('end', 'endnote', 8),
    { id: 'private', scope: 'manuscript', title: 'SECRET', body: 'PRIVATE NEVER EXPORTED' },
    { ...note('deleted', 'footnote', 0), deleted: true }] };
  const noteBlocks = [{ sceneId: 'roman/a.txt', blockId: 'b', documentParagraphIndex: 0, text: doc.text }];
  const documentNotes = buildCanonicalNotesExport(document, [], noteBlocks, 'p');
  assert.equal(documentNotes.sourceBindings.length, 2);
  const bytes = buildDocxMinBuffer({ doc: doc.doc, plainText: doc.text, bookProfile: { formatId: 'A4' } },
    { docxPageSetupBindModule, semanticMappingModule, styleMapModule, documentNotes, noteBlocks });
  assert.equal(bytes.includes(Buffer.from('PRIVATE NEVER EXPORTED')), false);
  const preview = bridge.buildDocxContentPreviewFromZipBytes(bytes);
  assert.equal(preview.ok, true, JSON.stringify(preview));
  const plan = bridge.buildDocxImportPreviewPlanFromContentPreview(preview);
  assert.equal(plan.ok, true, JSON.stringify(plan));
  assert.deepEqual(plan.candidateCreatePlan.entries[0].notes, [
    { kind: 'footnote', paragraphIndex: 0, offsetUtf16: 3, body },
    { kind: 'endnote', paragraphIndex: 0, offsetUtf16: 8, body },
  ]);
});

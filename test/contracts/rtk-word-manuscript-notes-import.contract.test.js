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
function fixture({ kind = 'footnote', id = '7', reference = id, body, href = 'https://example.invalid/note', extra = '', customXml = '', styles = '' } = {}) {
  return buildStoredZip([
    ...(styles ? [{ name: 'word/styles.xml', data: styles }] : []),
    ...(customXml ? [{ name: 'customXml/item1.xml', data: '<b:Sources xmlns:b="http://schemas.openxmlformats.org/officeDocument/2006/bibliography"/>' }] : []),
    { name: '[Content_Types].xml', data: `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/${kind}s.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.${kind}s+xml"/>${styles ? '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' : ''}</Types>` },
    { name: '_rels/.rels', data: `<Relationships xmlns="${P}"><Relationship Id="d" Type="${R}/officeDocument" Target="word/document.xml"/></Relationships>` },
    { name: 'word/_rels/document.xml.rels', data: `<Relationships xmlns="${P}"><Relationship Id="n" Type="${R}/${kind}s" Target="${kind}s.xml"/>${styles ? `<Relationship Id="styles" Type="${R}/styles" Target="styles.xml"/>` : ''}${customXml ? `<Relationship Id="cx" Type="${R}/customXml" Target="${customXml}"/>` : ''}</Relationships>` },
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


test('native Word customXml casing is inert while missing or traversal targets remain blocked', async () => {
  const bridge = await import('../../src/io/revisionBridge/index.mjs');
  const good = bridge.buildDocxContentPreviewFromZipBytes(fixture({ customXml: '../customXml/item1.xml' }));
  assert.equal(good.ok, true, JSON.stringify(good));
  assert.equal(good.contentPreview.manuscriptNotes.length, 1);
  for (const customXml of ['../customXml/missing.xml', '../../customXml/item1.xml', 'file:///private/item1.xml']) {
    assert.equal(bridge.buildDocxContentPreviewFromZipBytes(fixture({ customXml })).ok, false, customXml);
  }
});

test('native file picker and main preview projection retain notes through actual safe-create planning', async () => {
  const bridge = await import('../../src/io/revisionBridge/index.mjs');
  const { createDocxImportLocalFilePreview } = require('../../src/utils/docxImportLocalFilePreview.js');
  const bytes = fixture(), direct = bridge.buildDocxContentPreviewFromZipBytes(bytes);
  const selected = await createDocxImportLocalFilePreview({ requestId: 'native-notes' }, {
    pickLocalFile: async () => ({ path: '/synthetic/notes.docx', size: bytes.length }), readLocalFileBytes: async () => bytes,
  });
  assert.equal(selected.ok, true, JSON.stringify(selected));
  const source = fs.readFileSync(path.join(__dirname, '../../src/main.js'), 'utf8');
  const section = source.slice(source.indexOf('function copyDocxImportPreviewAllowedFields('), source.indexOf('function validateDocxImportPreviewPayload('));
  const canonicalize = new Function('isPlainObjectValue', 'cloneJsonSafe', section + '; return canonicalizeDocxImportPreviewSourceReport;')(
    value => !!value && typeof value === 'object' && !Array.isArray(value), value => value === undefined ? undefined : JSON.parse(JSON.stringify(value)));
  const normalized = canonicalize(selected.docxContentPreviewReport);
  assert.deepEqual(normalized.contentPreview.manuscriptNotes, direct.contentPreview.manuscriptNotes);
  const plan = bridge.buildDocxImportPreviewPlanFromContentPreview(normalized);
  assert.equal(plan.ok, true, JSON.stringify(plan));
  assert.deepEqual(plan.candidateCreatePlan.entries[0].notes, direct.contentPreview.manuscriptNotes);
  assert.deepEqual(selected.docxImportPreviewPlan.candidateCreatePlan.entries[0].notes, direct.contentPreview.manuscriptNotes);
});

for (const kind of ['footnote', 'endnote']) test(`${kind} symbol is refused before candidate and safe-create writes`, async t => {
  const bridge = await import('../../src/io/revisionBridge/index.mjs');
  const body = '<w:r><w:t>A</w:t><w:sym w:font="Wingdings" w:char="F0FC"/><w:t>B</w:t></w:r><w:hyperlink r:id="l"><w:r><w:t>link</w:t></w:r></w:hyperlink>';
  const control = bridge.buildDocxContentPreviewFromZipBytes(fixture({ kind, body: body.replace('<w:sym w:font="Wingdings" w:char="F0FC"/>', '<w:t>✓</w:t>') }));
  assert.equal(control.ok, true, JSON.stringify(control));
  const preview = bridge.buildDocxContentPreviewFromZipBytes(fixture({ kind, body }));
  assert.equal(preview.ok, false, JSON.stringify(preview));
  const plan = bridge.buildDocxImportPreviewPlanFromContentPreview(preview);
  assert.equal(plan.ok, false); assert.equal(plan.candidateCreatePlan, null);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'note-symbol-refusal-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const result = await require('../fixtures/docx-import-real-authority.cjs').applyDocxImportSafeCreate({ docxImportPreviewPlan: plan }, {
    projectRoot: root, romanRoot: path.join(root, 'roman'), projectId: 'note-symbol',
  });
  assert.equal(result.ok, false); assert.deepEqual(fs.readdirSync(root), []);
});

test('named character-style inheritance in notes retains effective body values and public disclosure', async () => {
  const bridge = await import('../../src/io/revisionBridge/index.mjs');
  const styles = `<w:styles xmlns:w="${W}"><w:style w:type="character" w:styleId="Base"><w:name w:val="Base"/><w:rPr><w:b/><w:color w:val="123456"/></w:rPr></w:style><w:style w:type="character" w:styleId="Child"><w:name w:val="Child"/><w:basedOn w:val="Base"/></w:style></w:styles>`;
  const body = '<w:r><w:rPr><w:rStyle w:val="Child"/></w:rPr><w:t>Styled note</w:t></w:r><w:hyperlink r:id="l"><w:r><w:t>link</w:t></w:r></w:hyperlink>';
  const preview = bridge.buildDocxContentPreviewFromZipBytes(fixture({ styles, body }));
  assert.equal(preview.ok, true, JSON.stringify(preview));
  const plan = bridge.buildDocxImportPreviewPlanFromContentPreview(preview);
  assert.equal(plan.ok, true, JSON.stringify(plan));
  assert.equal(plan.lossReport.items.filter(item => item.code === 'DOCX_IMPORT_PREVIEW_NAMED_STYLES_NORMALIZED').length, 1);
  assert.deepEqual(plan.candidateCreatePlan.entries[0].notes[0].body.content[0].content[0], {
    type: 'text', text: 'Styled note', marks: [{ type: 'bold' }, { type: 'textStyle', attrs: { color: '#123456' } }],
  });
});


// New-project source points: literal native fixture, independent Current/Original positions.
async function freshPendingNoteInput() {
  const bridge = await import('../../src/io/revisionBridge/index.mjs');
  const bytes = fs.readFileSync(path.join(__dirname, '../fixtures/docx-pending-deleted-comment-import.docx'));
  const preview = bridge.buildDocxContentPreviewFromZipBytes(bytes);
  assert.equal(preview.ok, true, JSON.stringify(preview));
  const plan = bridge.buildDocxNovelImportPreviewPlanFromContentPreview(preview);
  assert.equal(plan.ok, true, JSON.stringify(plan));
  return { bytes, entry: plan.candidateCreatePlan.entries[0] };
}
test('native pending note source binds fresh local identity and exact Current/Original references before creation', async () => {
  const { entry, bytes } = await freshPendingNoteInput(), before = JSON.stringify(entry);
  const model = require('../../src/core/word-manuscript-notes-v1.cjs'), envelope = require('../../src/core/document-content-envelope-v1.cjs');
  const pending = require('../../src/core/word-pending-text-revisions-v1.cjs');
  assert.deepEqual(entry.notes[0].sourcePoint, { paragraphIndex: 4, offsetUtf16: 6, originalParagraphIndex: 4, originalOffsetUtf16: 6 });
  const identity = { projectId: 'fresh-note-project', importOperationId: 'fresh-note-operation' }, sceneId = 'roman/tiny.txt';
  const content = model.prepareImportedNoteScene({ candidates: entry.notes, sceneContent: entry.content, ...identity });
  const result = model.materializeImportedNotes({ candidates: entry.notes, sceneContent: content, sceneId, beforeText: null, ...identity });
  assert.equal(result.imported[0].manuscript.reference.offsetUtf16, 95);
  assert.equal(result.imported[0].body, 'Содержание сноски сохраняется.');
  const doc = envelope.parseObservablePayload(content).doc;
  assert.equal(pending.noteProjection(doc)[0].noteId, result.imported[0].id);
  for (const [action, expectedOffset] of [['acceptAll', 95], ['rejectAll', 96]]) {
    const afterContent = envelope.composeObservablePayload({ doc: pending.decide(doc, { action }).doc });
    const change = model.planManuscriptNoteAnchorSave({ beforeText: result.afterText, sceneId, beforeContent: content, afterContent, ...identity, includeUnchanged: true });
    model.validateNoteCohort(change, { projectId: identity.projectId, sceneId, beforeContent: content, afterContent });
    const reopened = JSON.parse(change.afterText).notes[0];
    assert.equal(reopened.manuscript.reference.offsetUtf16, expectedOffset);assert.equal(reopened.body, result.imported[0].body);
  }
  assert.equal(JSON.stringify(entry), before);
  assert.deepEqual(fs.readFileSync(path.join(__dirname, '../fixtures/docx-pending-deleted-comment-import.docx')), bytes);
});
test('pending note import refuses malformed or mismatched native source positions and foreign local IDs', async () => {
  const { entry } = await freshPendingNoteInput(), model = require('../../src/core/word-manuscript-notes-v1.cjs');
  const identity = { projectId: 'fresh-note-project', importOperationId: 'fresh-note-operation' };
  const invalid = structuredClone(entry.notes);invalid[0].sourcePoint.originalOffsetUtf16++;
  assert.throws(() => model.prepareImportedNoteScene({ candidates: invalid, sceneContent: entry.content, ...identity }), /NOTE_IMPORT_SOURCE_POINT_BINDING/);
  assert.throws(() => model.prepareImportedNoteScene({ candidates: [null], sceneContent: entry.content, ...identity }), /NOTE_IMPORT_POINT/);
  const pending = require('../../src/core/word-pending-text-revisions-v1.cjs'), envelope = require('../../src/core/document-content-envelope-v1.cjs');
  const forged = pending.bindNoteSourcePoints(envelope.parseObservablePayload(entry.content).doc, [{ noteId: 'foreign-note', paragraphIndex: 4, offsetUtf16: 6 }]);
  assert.throws(() => model.materializeImportedNotes({ candidates: entry.notes, sceneContent: envelope.composeObservablePayload({ doc: forged }),
    sceneId: 'roman/tiny.txt', beforeText: null, ...identity }), /NOTE_PENDING_IMPORT_IDENTITY/);
  assert.throws(() => model.materializeImportedNotes({ candidates: entry.notes, sceneContent: entry.content,
    sceneId: 'roman/tiny.txt', beforeText: null, ...identity }), /NOTE_PENDING_IMPORT_REQUIRES_AUTHENTICATED_RETURN/);
});

test('real Word manuscript normalizes presentation explicitly without losing native editorial work', async () => {
  const bridge = await import('../../src/io/revisionBridge/index.mjs');
  const bytes = fs.readFileSync(path.join(__dirname, '../fixtures/docx-word-native-manuscript-profile.docx'));
  const digest = require('node:crypto').createHash('sha256').update(bytes).digest('hex');
  assert.equal(digest, 'fae1413613e75d1f476201c4aa6b61bde7f7ea59f1c3d7eb194116fccc867027');
  const strict = bridge.buildDocxContentPreviewFromZipBytes(bytes);
  assert.equal(strict.ok, false);assert.equal(strict.reason, 'PENDING_REVISIONS_CONTENT_UNSUPPORTED');
  const { createDocxImportLocalFilePreview } = require('../../src/utils/docxImportLocalFilePreview.js');
  const selected = await createDocxImportLocalFilePreview({ requestId: 'real-word-new-project' }, {
    pickLocalFile: async () => ({ path: '/synthetic/native-word.docx', size: bytes.length }),
    readLocalFileBytes: async () => bytes, novelImport: true, oneWayManuscript: true,
  });
  assert.equal(selected.importPreviewOk, true, JSON.stringify(selected));
  assert.equal(selected.docxContentPreviewReport.sourceArtifactSha256, digest);
  const plan = selected.docxImportPreviewPlan, entry = plan.candidateCreatePlan.entries[0];
  const envelope = require('../../src/core/document-content-envelope-v1.cjs'), pending = require('../../src/core/word-pending-text-revisions-v1.cjs');
  const doc = envelope.parseObservablePayload(entry.content).doc;
  const current = ['Одинаковая фраза: повтор 🧭.', 'До ВСТАВКА😀 после.', 'До  после.', 'Одинаковая фраза: повтор 🧭.', 'Перед сноской.', 'Кавычки «точно», Café, Ελληνικά, 中文 и семья 👨‍👩‍👧‍👦.'];
  assert.equal(pending.projection(doc).current, current.join('\n'));
  assert.equal(pending.projection(doc).original, [current[0], 'До  после.', 'До УДАЛЕНИЕ🧭 после.', ...current.slice(3)].join('\n'));
  assert.equal(pending.readLedger(doc).revisions.length, 2);
  assert.equal(entry.comments.length, 3);
  assert.deepEqual(entry.comments.map(c => c.messages.map(m => m.body)), [['Нативное обсуждение вставки','Нативный ответ к вставке'],['Нативное обсуждение удаления'],['Нативно: именно второй повтор']]);
  assert.equal(entry.comments[2].paragraphIndex, 3);assert.equal(entry.comments[2].selectedText, 'повтор 🧭');
  assert.equal(entry.notes.length, 1);assert.equal(entry.notes[0].body.content[0].content.map(n => n.text || '').join(''), ' Содержание нативной сноски сохраняется.');
  assert.equal(entry.notes[0].offsetUtf16, 6);assert.equal(entry.notes[0].paragraphIndex, 4);
  assert.ok(plan.lossReport.items.some(x => x.code === 'DOCX_IMPORT_PREVIEW_MANUSCRIPT_PRESENTATION_NORMALIZED'));
  assert.equal(JSON.stringify(doc).includes('fontFamily'), false);assert.equal(JSON.stringify(doc).includes('fontSize'), false);
  assert.deepEqual(fs.readFileSync(path.join(__dirname, '../fixtures/docx-word-native-manuscript-profile.docx')), bytes);
});


test('one-way manuscript presentation does not rescue malformed font values, hidden text or broken notes', async () => {
  const bridge=await import('../../src/io/revisionBridge/index.mjs');
  const styles=properties=>`<w:styles xmlns:w="${W}"><w:docDefaults><w:rPrDefault><w:rPr>${properties}</w:rPr></w:rPrDefault></w:docDefaults></w:styles>`;
  for(const bad of [{styles:styles('<w:rFonts w:asciiTheme="unknown"/>')},{styles:styles('<w:sz w:val="NaN"/>')},
    {styles:styles('<w:vanish/>')},
    {styles:styles('<w:rFonts xmlns:evil="urn:foreign" evil:ascii="A"/>')},
    {styles:styles('<w:rFonts w:ascii="A"><w:vanish/></w:rFonts>')},{reference:'8'},{href:'file:///private/secret'},
    {body:'<w:r><w:rPr><w:vanish/></w:rPr><w:t>Hidden note</w:t></w:r>'}]) {
    const preview=bridge.buildDocxContentPreviewFromZipBytes({bytes:fixture(bad),manuscriptProfile:'YALKEN_MANUSCRIPT_V1'});
    assert.equal(preview.ok,false,JSON.stringify(bad));
    assert.equal(bridge.buildDocxNovelImportPreviewPlanFromContentPreview(preview).candidateCreatePlan,null);
  }
  // Unknown profile names never select normalization.
  const bytes=fs.readFileSync(path.join(__dirname,'../fixtures/docx-word-native-manuscript-profile.docx'));
  assert.equal(bridge.buildDocxContentPreviewFromZipBytes({bytes,manuscriptProfile:'untrusted-profile'}).ok,false);
});

test('native Word default page context partitions without losing editorial data; real section boundaries and empty replies refuse', async () => {
  const bridge=await import('../../src/io/revisionBridge/index.mjs');
  const original=fs.readFileSync(path.join(__dirname,'../fixtures/docx-word-native-manuscript-profile.docx'));
  const packageParts=bridge.extractDocxReviewTransportPackagePartsFromZipBytes({bytes:original});assert.equal(packageParts.ok,true);
  const parts=packageParts.parts;assert.equal(Object.keys(parts).length,18);
  const pack=patch=>buildStoredZip(Object.entries({...parts,...patch}).map(([name,data])=>({name,data})));
  const document=parts['word/document.xml'],section=document.match(/<w:sectPr\b[\s\S]*?<\/w:sectPr>/u)[0];
  const suffix=Array.from({length:205},(_,i)=>`<w:p><w:r><w:t>Пограничный абзац ${i} 😀.</w:t></w:r></w:p>`).join('');
  const result=bridge.buildDocxNovelImportPreviewPlanFromContentPreview(bridge.buildDocxContentPreviewFromZipBytes({bytes:pack({'word/document.xml':document.replace(section,suffix+section)}),manuscriptProfile:'YALKEN_MANUSCRIPT_V1'}));
  assert.equal(result.ok,true,JSON.stringify(result));assert.equal(result.candidateCreatePlan.entryCount,2);
  const env=require('../../src/core/document-content-envelope-v1.cjs'),pending=require('../../src/core/word-pending-text-revisions-v1.cjs');
  const docs=result.candidateCreatePlan.entries.map(e=>{const parsed=env.parseObservablePayload(e.content);return parsed.doc||env.buildParagraphDocumentFromText(parsed.text);});
  assert.equal(docs.flatMap(d=>pending.paragraphs(pending.normalizeNode(d))).length,211);
  assert.equal(result.candidateCreatePlan.entries.reduce((n,e)=>n+(e.comments?.length||0),0),3);
  assert.equal(result.candidateCreatePlan.entries.reduce((n,e)=>n+(e.notes?.length||0),0),1);
  assert.ok(docs.every(d=>!d.attrs?.wordSections));
  for(const [patch,reason]of [
    [{'word/document.xml':document.replace(section,`<w:p><w:pPr>${section}</w:pPr><w:r><w:t>Boundary</w:t></w:r></w:p>${section}`)},'WORD_SECTIONS_UNSUPPORTED'],
    [{'word/comments.xml':parts['word/comments.xml'].replace('Нативный ответ к вставке','')},'DOCX_GENERIC_COMMENT_METADATA_UNSUPPORTED'],
  ]){
    const preview=bridge.buildDocxContentPreviewFromZipBytes({bytes:pack(patch),manuscriptProfile:'YALKEN_MANUSCRIPT_V1'});
    assert.equal(preview.ok,false);assert.equal(preview.reason,reason);
    assert.equal(bridge.buildDocxNovelImportPreviewPlanFromContentPreview(preview).candidateCreatePlan,null);
  }
});

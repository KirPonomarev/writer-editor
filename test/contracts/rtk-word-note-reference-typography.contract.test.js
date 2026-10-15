'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildStoredZip, buildDocxMinBuffer } = require('../../src/export/docx/docxMinBuilder.js');
const model = require('../../src/core/word-manuscript-notes-v1.cjs');
const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const P = 'http://schemas.openxmlformats.org/package/2006/relationships';
const typography = { schemaVersion: 1,
  fontSlots: { ascii: 'Georgia', hAnsi: 'Georgia', eastAsia: 'Yu Mincho', cs: 'Arial' },
  wordLanguage: { val: 'ru-RU', eastAsia: 'ja-JP', bidi: 'ar-SA' } };
const properties = value => `${value.fontSlots ? `<w:rFonts${Object.entries(value.fontSlots).map(([k,v]) => ` w:${k}="${v}"`).join('')}/>` : ''}${value.wordLanguage ? `<w:lang${Object.entries(value.wordLanguage).map(([k,v]) => ` w:${k}="${v}"`).join('')}/>` : ''}`;
function fixture(kind, { direct = properties(typography), styles = '', style = '' } = {}) {
  return buildStoredZip([
    { name: '[Content_Types].xml', data: `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/${kind}s.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.${kind}s+xml"/>${styles ? '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' : ''}</Types>` },
    { name: '_rels/.rels', data: `<Relationships xmlns="${P}"><Relationship Id="d" Type="${R}/officeDocument" Target="word/document.xml"/></Relationships>` },
    { name: 'word/_rels/document.xml.rels', data: `<Relationships xmlns="${P}"><Relationship Id="n" Type="${R}/${kind}s" Target="${kind}s.xml"/>${styles ? `<Relationship Id="s" Type="${R}/styles" Target="styles.xml"/>` : ''}</Relationships>` },
    ...(styles ? [{ name: 'word/styles.xml', data: styles }] : []),
    { name: 'word/document.xml', data: `<w:document xmlns:w="${W}"><w:body><w:p><w:r><w:t>До </w:t></w:r><w:r><w:rPr>${style}${direct}</w:rPr><w:${kind}Reference w:id="7"/></w:r><w:r><w:t>слова</w:t></w:r></w:p></w:body></w:document>` },
    { name: `word/${kind}s.xml`, data: `<w:${kind}s xmlns:w="${W}"><w:${kind} w:id="7"><w:p><w:r><w:${kind}Ref/></w:r><w:r><w:t>Короткая сноска</w:t></w:r></w:p></w:${kind}></w:${kind}s>` },
  ]);
}
async function imported(kind, options) {
  const bridge = await import('../../src/io/revisionBridge/index.mjs');
  const preview = bridge.buildDocxContentPreviewFromZipBytes(fixture(kind, options));
  assert.equal(preview.ok, true, JSON.stringify(preview));
  const plan = bridge.buildDocxImportPreviewPlanFromContentPreview(preview);
  assert.equal(plan.ok, true, JSON.stringify(plan));
  return { bridge, plan, entry: plan.candidateCreatePlan.entries[0] };
}
for (const kind of ['footnote', 'endnote']) test(`${kind} reference retains all seven actual font and language values through canonical import and DOCX`, async () => {
  const { bridge, entry } = await imported(kind);
  assert.deepEqual(entry.notes[0].referenceTypography, typography);
  const materialized = model.materializeImportedNotes({ candidates: entry.notes, sceneContent: entry.content,
    projectId: 'tiny', sceneId: 'roman/a.txt', importOperationId: 'tiny', beforeText: null });
  const document = JSON.parse(materialized.afterText);
  assert.equal(document.notes[0].manuscript.schemaVersion, 2);
  assert.deepEqual(document.notes[0].manuscript.referenceTypography, typography);
  const envelope = require('../../src/core/document-content-envelope-v1.cjs');
  const scene = envelope.parseObservablePayload(entry.content);
  const noteBlocks = [{ sceneId: 'roman/a.txt', blockId: 'b', documentParagraphIndex: 0, text: scene.text }];
  const documentNotes = require('../../src/export/docx/docxReviewPacketNotes.js').buildCanonicalNotesExport(document, [], noteBlocks, 'tiny');
  const [docxPageSetupBindModule, semanticMappingModule, styleMapModule] = await Promise.all([
    import('../../src/docxPageSetupBind.mjs'), import('../../src/derived/semanticMapping.mjs'), import('../../src/derived/styleMap.mjs')]);
  const output = buildDocxMinBuffer({ doc: scene.doc, plainText: scene.text, bookProfile: { formatId: 'A4' } },
    { docxPageSetupBindModule, semanticMappingModule, styleMapModule, documentNotes, noteBlocks });
  const again = bridge.buildDocxContentPreviewFromZipBytes(output);
  assert.equal(again.ok, true, JSON.stringify(again.ok ? again : bridge.buildDocxReviewTransportAnalysisFromZipBytes({ bytes: output }, { cryptoPort: {
    sha256Text: model.sha, sha256Json: value => 'sha256:' + model.sha(JSON.stringify(value)), byteLength: value => Buffer.byteLength(value) } }).reasons));
  assert.deepEqual(again.contentPreview.manuscriptNotes[0].referenceTypography, typography);
  assert.equal(again.contentPreview.manuscriptNotes[0].offsetUtf16, 3);
  assert.equal(model.validateNoteBody(again.contentPreview.manuscriptNotes[0].body).text, 'Короткая сноска');
});

test('reference cascade resolves document defaults, basedOn and independent direct slot overrides', async () => {
  const defaults = { fontSlots: Object.fromEntries(['ascii','hAnsi','eastAsia','cs'].map(k => [k, 'Times New Roman'])),
    wordLanguage: { val: 'ru-FI', eastAsia: 'ja-JP', bidi: 'ar-SA' } };
  const styles = `<w:styles xmlns:w="${W}"><w:docDefaults><w:rPrDefault><w:rPr>${properties(defaults)}</w:rPr></w:rPrDefault></w:docDefaults><w:style w:type="character" w:styleId="Base"><w:name w:val="Base"/><w:rPr><w:rFonts w:ascii="Georgia"/></w:rPr></w:style><w:style w:type="character" w:styleId="Child"><w:name w:val="Child"/><w:basedOn w:val="Base"/><w:rPr><w:rFonts w:hAnsi="Georgia" w:eastAsia="Yu Mincho"/></w:rPr></w:style></w:styles>`;
  const { entry } = await imported('footnote', { styles, style: '<w:rStyle w:val="Child"/>',
    direct: '<w:rFonts w:cs="Arial"/><w:lang w:val="ru-RU"/>' });
  assert.deepEqual(entry.notes[0].referenceTypography, typography);
  const inherited = await imported('endnote', { styles, direct: '' });
  assert.deepEqual(inherited.entry.notes[0].referenceTypography, { schemaVersion: 1, ...defaults });
  const absent = await imported('footnote', { style: '<w:rStyle w:val="MissingStyle"/>' });
  assert.deepEqual(absent.entry.notes[0].referenceTypography, typography);
});

test('legacy manuscript1 remains exact; manuscript2 strictly validates bounded non-executable reference values', () => {
  const body = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Note' }] }] };
  const legacy = model.bindManuscriptPayload({ kind: 'footnote', body, sceneId: 'roman/a.txt', offsetUtf16: 1, sceneContent: 'Text' });
  assert.equal(legacy.schemaVersion, 1); assert.equal(Object.hasOwn(legacy, 'referenceTypography'), false);
  assert.deepEqual(model.validateManuscriptPayload(legacy), legacy);
  const current = model.bindManuscriptPayload({ kind: 'footnote', body, sceneId: 'roman/a.txt', offsetUtf16: 1, sceneContent: 'Text', referenceTypography: typography });
  assert.equal(current.schemaVersion, 2); assert.deepEqual(model.validateManuscriptPayload(current), current);
  const grammar = require('../../src/core/word-note-reference-typography-v1.cjs');
  for (const mutate of [v => v.schemaVersion = 2, v => v.authority = 'write', v => v.fontSlots.path = '/secret',
    v => v.fontSlots.ascii = 'x'.repeat(129), v => v.fontSlots.ascii = 'Georgia;url(secret)',
    v => v.wordLanguage.val = 'ru_XX', v => v.wordLanguage.val = 'x'.repeat(64),
    v => v.fontSlots = {}, v => v.wordLanguage = {}, v => v.wordLanguage = null]) {
    const bad = structuredClone(typography); mutate(bad); assert.throws(() => grammar.validate(bad), /NOTE_REFERENCE_TYPOGRAPHY_INVALID/);
  }
  for (const bad of [{ schemaVersion: 1 }, { ...legacy, referenceTypography: typography },
    { ...current, referenceTypography: undefined }, { ...current, schemaVersion: 3 }]) {
    assert.throws(() => model.validateManuscriptPayload(bad), /NOTE_/);
  }
  let calls = 0;
  for (const field of ['fontSlots', 'wordLanguage']) {
    const bad = structuredClone(typography); Object.defineProperty(bad, field, { enumerable: true, get() { calls++; return {}; } });
    assert.throws(() => grammar.validate(bad), /NOTE_REFERENCE_TYPOGRAPHY_INVALID/);
  }
  const nested = structuredClone(typography); Object.defineProperty(nested.fontSlots, 'ascii', { enumerable: true, get() { calls++; return 'Georgia'; } });
  assert.throws(() => grammar.validate(nested), /NOTE_REFERENCE_TYPOGRAPHY_INVALID/); assert.equal(calls, 0);
  const accessor = structuredClone(current); Object.defineProperty(accessor, 'referenceTypography', { enumerable: true, get() { calls++; return typography; } });
  assert.throws(() => model.validateManuscriptPayload(accessor), /NOTE_REFERENCE_TYPOGRAPHY_INVALID/); assert.equal(calls, 0);
});

test('malformed reference properties and invalid defined style chains refuse before an import candidate exists', async () => {
  const bridge = await import('../../src/io/revisionBridge/index.mjs');
  for (const direct of ['<w:rFonts w:ascii="Georgia"/><w:rFonts w:ascii="Arial"/>',
    '<w:lang w:val="ru-RU"/><w:lang w:val="en-US"/>', '<w:rFonts w:ascii="Georgia"><w:b/></w:rFonts>',
    '<w:lang w:val="ru_XX"/>', '<w:rFonts w:ascii="Georgia" w:asciiTheme="majorHAnsi"/>',
    '<w:rStyle w:val="Missing"/><w:rStyle w:val="Missing"/>']) {
    const preview = bridge.buildDocxContentPreviewFromZipBytes(fixture('footnote', { direct }));
    assert.equal(preview.ok, false, direct); assert.equal(bridge.buildDocxImportPreviewPlanFromContentPreview(preview).candidateCreatePlan, null);
  }
  const styles = `<w:styles xmlns:w="${W}"><w:style w:type="character" w:styleId="Bad"><w:name w:val="Bad"/><w:basedOn w:val="Missing"/></w:style></w:styles>`;
  assert.equal(bridge.buildDocxContentPreviewFromZipBytes(fixture('endnote', { styles, style: '<w:rStyle w:val="Bad"/>' })).ok, false);
});

test('real admitted SafeCreate persists and reopens reference values; changed preview and forged anchor cohort have no authority', async t => {
  const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
  const safe = require('../fixtures/docx-import-real-authority.cjs');
  const { plan, entry } = await imported('footnote');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'reference-typography-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'roman'));
  safe.rememberDocxImportPreviewPlanAdmission(plan);
  const result = await safe.applyDocxImportSafeCreate({ docxImportPreviewPlan: plan }, { projectRoot: root, romanRoot: path.join(root, 'roman'), projectId: 'tiny' });
  assert.equal(result.ok, true, JSON.stringify(result));
  const notesText = fs.readFileSync(path.join(root, 'notes.craftsman.json'), 'utf8');
  const stored = JSON.parse(notesText), storage = await import('../../src/core/notesStorage.mjs');
  const reopened = storage.normalizeNotesDocument(stored, { projectId: 'tiny' });
  assert.equal(reopened.ok, true); assert.deepEqual(reopened.value.notes[0].manuscript.referenceTypography, typography);
  const bad = structuredClone(plan); bad.candidateCreatePlan.entries[0].notes[0].referenceTypography.fontSlots.ascii = 'Arial';
  const refused = await safe.applyDocxImportSafeCreate({ docxImportPreviewPlan: bad }, { projectRoot: root, romanRoot: path.join(root, 'roman'), projectId: 'tiny' });
  assert.equal(refused.ok, false); assert.equal(fs.readFileSync(path.join(root, 'notes.craftsman.json'), 'utf8'), notesText);
  const sceneId = stored.notes[0].manuscript.reference.sceneId;
  const afterContent = '!До слова';
  const cohort = model.planManuscriptNoteAnchorSave({ beforeText: notesText, projectId: 'tiny', sceneId, beforeContent: entry.content, afterContent });
  const args = { projectId: 'tiny', sceneId, beforeContent: entry.content, afterContent };
  assert.deepEqual(JSON.parse(cohort.afterText).notes[0].manuscript.referenceTypography, typography);
  model.validateNoteCohort(cohort, args);
  const forged = JSON.parse(cohort.afterText); forged.notes[0].manuscript.referenceTypography.fontSlots.ascii = 'Arial';
  assert.throws(() => model.validateNoteCohort({ ...cohort, afterText: JSON.stringify(forged) }, args), /NOTE_COHORT_REBASE/);
});

async function returnFixture({ legacy = false } = {}) {
  const envelope = require('../../src/core/document-content-envelope-v1.cjs');
  const doc = text => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });
  const sceneId = 'roman/a.txt', projectId = 'tiny', document = { schemaVersion: 1, projectId, notes: [{ id: 'note-a', scope: 'manuscript', title: '', body: 'Note',
    manuscript: model.bindManuscriptPayload({ kind: 'footnote', body: doc('Note'), sceneId, offsetUtf16: 3, sceneContent: 'До слова', ...(legacy ? {} : { referenceTypography: typography }) }) }] };
  const scenes = ['До слова', 'Control'].map((text, index) => ({ sceneId: index ? 'roman/b.txt' : sceneId, scenePath: '/project/' + (index ? 'roman/b.txt' : sceneId),
    order: index, doc: doc(text), text, observableContent: envelope.composeObservablePayload({ doc: doc(text) }) }));
  const source = require('../../src/export/docx/fullManuscriptDocxReviewPacketSource.js').buildFullManuscriptDocxReviewPacketSource({ projectId, projectRoot: '/project', notesDocument: document, scenes });
  const bytes = require('../../src/export/docx/docxReviewPacketBuilder.js').buildDocxReviewPacketBuffer(source);
  const bridge = await import('../../src/io/revisionBridge/index.mjs');
  const stable = v => Array.isArray(v) ? `[${v.map(stable).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}` : JSON.stringify(v);
  const analysis = bridge.buildDocxReviewTransportAnalysisFromZipBytes({ bytes }, { cryptoPort: { sha256Text: model.sha, sha256Json: v => 'sha256:' + model.sha(stable(v)), byteLength: v => Buffer.byteLength(v) } });
  assert.equal(analysis.ok, true, JSON.stringify(analysis.reasons));
  const returnedNotes = bridge.parseDocumentNotesRichReturn(bytes, analysis.reviewIr.documentNotes, { includeBreakProjection: true });
  return { document, source, bytes, bridge, scenes, analysis, input: { document, projectId, roundId: 'round-tiny', artifactSha256: model.sha(bytes), baseline: source.documentNotes,
    exportMap: source.localAuthorityCapsule.exportMap, returnedNotes, returnedParagraphs: analysis.reviewIr.formattingParagraphs, now: '2026-10-15T18:00:00.000Z' } };
}

test('authenticated clean return protects each reference property and canonical baseline; legacy no-op stays schema1', async () => {
  const delta = require('../../src/core/word-note-return-delta-v1.cjs'), f = await returnFixture();
  assert.equal(delta.planNoteReturnDelta(f.input).unchanged, true);
  for (const mutate of [n => delete n.referenceTypography, n => n.referenceTypography.fontSlots.ascii = 'Arial',
    n => n.referenceTypography.wordLanguage.bidi = 'he-IL', n => n.referenceTypography.fontSlots = {}]) {
    const input = structuredClone(f.input); mutate(input.returnedNotes[0]);
    assert.throws(() => delta.planNoteReturnDelta(input), /NOTE_(RETURN_REFERENCE|REFERENCE_TYPOGRAPHY)/);
  }
  const stale = structuredClone(f.input); stale.baseline.sourceBindings[0].referenceTypography.fontSlots.cs = 'Georgia';
  assert.throws(() => delta.planNoteReturnDelta(stale), /NOTE_RETURN_REFERENCE_BASELINE_CONFLICT/);
  const old = await returnFixture({ legacy: true }); assert.equal(delta.planNoteReturnDelta(old.input).unchanged, true);
  assert.equal(old.document.notes[0].manuscript.schemaVersion, 1);
});

test('pending book guards retain actual reference typography and refuse reference drift even for changed-body authority', async () => {
  const f = await returnFixture(), delta = require('../../src/core/word-note-return-delta-v1.cjs');
  const input = { document: f.document, projectId: 'tiny', baseline: f.source.documentNotes, exportMap: f.input.exportMap,
    scenes: f.scenes.map(s => ({ sceneId: s.sceneId, document: s.doc, returnedDocument: s.doc })),
    returnedNotes: f.input.returnedNotes, returnedReferences: f.analysis.reviewIr.documentNotes.references,
    unionReferences: f.analysis.reviewIr.documentNotes.references.map(({ referenceTypography: ignored, ...ref }) => ref) };
  assert.equal(delta.bindUnchangedBookPendingNotes(input).length, 2);
  assert.equal(delta.bindChangedBookPendingNotes(input).length, 2);
  const bad = structuredClone(input); bad.returnedNotes[0].referenceTypography.wordLanguage.val = 'en-US';
  for (const bind of [delta.bindUnchangedBookPendingNotes, delta.bindChangedBookPendingNotes])
    assert.throws(() => bind(bad), /NOTE_RETURN_REFERENCE_TYPOGRAPHY_CHANGED/);
  const stale = structuredClone(input); delete stale.baseline.sourceBindings[0].referenceTypography;
  assert.throws(() => delta.bindUnchangedBookPendingNotes(stale), /NOTE_RETURN_REFERENCE_BASELINE_CONFLICT/);
});

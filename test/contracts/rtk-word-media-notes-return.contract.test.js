'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { pathToFileURL } = require('node:url'), { createRequire } = require('node:module');
const model = require('../../src/core/word-manuscript-notes-v1.cjs');
const media = require('../../src/io/documentMedia.js'), jpeg = require('../fixtures/document-jpeg-fixtures.cjs');
const envelope = require('../../src/core/document-content-envelope-v1.cjs');
const makeSource = require('../../src/export/docx/fullManuscriptDocxReviewPacketSource.js').buildFullManuscriptDocxReviewPacketSource;
const makeDocx = require('../../src/export/docx/docxReviewPacketBuilder.js').buildDocxReviewPacketBuffer;
const makeZip = require('../../src/export/docx/docxMinBuilder.js').buildStoredZip;
const p = (...content) => ({ type: 'paragraph', content }), t = text => ({ type: 'text', text });
const doc = (...content) => ({ type: 'doc', content });
const projectRoot = '/synthetic', projectId = 'p', sceneId = 'roman/a.txt', scenePath = projectRoot + '/' + sceneId;
const ports = { cryptoPort: { sha256Text: v => 'sha256:' + model.sha(v), sha256Json: v => 'sha256:' + model.sha(JSON.stringify(v)), byteLength: v => Buffer.byteLength(v) } };
async function fixture(kind, noteImage, mutation = 'resize') {
  const io = await import('../../src/io/revisionBridge/index.mjs');
  const before = doc(p(t('Alpha'), { type: 'image', attrs: media.createImageAttrs(jpeg.rgb) }, t(' Beta.')));
  const text = envelope.deriveVisibleTextFromDocument(before), raw = envelope.composeObservablePayload({ doc: before });
  const body = doc(p(t('Note'), ...(noteImage ? [{ type: 'image', attrs: media.createImageAttrs(jpeg.gray) }] : [])));
  const document = { schemaVersion: 1, projectId, notes: [
    { id: 'private', scope: 'project', body: 'Never export or modify', deleted: false },
    { id: 'n', schemaVersion: 1, scope: 'manuscript', body: 'Note', title: '', deleted: false,
      manuscript: model.bindManuscriptPayload({ kind, body, sceneId, offsetUtf16: 3, sceneContent: text }) },
  ] };
  const source = makeSource({ projectId, projectRoot, notesDocument: document,
    scenes: [{ sceneId, scenePath, order: 0, text, doc: before, observableContent: raw }] });
  const original = makeDocx(source), ex = io.extractDocxReviewTransportPackagePartsFromZipBytes({ bytes: original });
  const parts = { ...ex.parts, ...ex.binaryParts };
  parts['word/document.xml'] = parts['word/document.xml'].replaceAll('cx="180975"', 'cx="1800000"').replaceAll('cy="161925"', 'cy="1200000"');
  const notePart = `word/${kind}s.xml`;
  if (mutation === 'body') parts[notePart] = parts[notePart].replace('Note', 'Changed');
  if (mutation === 'note-image') parts[notePart] = parts[notePart].replace(/cx="\d+"/g, 'cx="900000"');
  if (mutation === 'deleted') parts['word/document.xml'] = parts['word/document.xml'].replace(new RegExp(`<w:${kind}Reference[^>]*\\/>`, 'g'), '');
  if (mutation === 'reanchor') {
    const pattern = new RegExp(`<w:${kind}Reference[^>]*\\/>`);
    const reference = parts['word/document.xml'].match(pattern)[0];
    parts['word/document.xml'] = parts['word/document.xml'].replace(reference, '').replace('</w:p>', `<w:r>${reference}</w:r></w:p>`);
  }
  const bytes = makeZip(Object.entries(parts).map(([name, data]) => ({ name, data })));
  const parsed = io.buildDocxReviewTransportAnalysisFromZipBytes({ bytes }, ports);
  const authority = { ...source.localAuthorityCapsule, projectRoot, documentNotes: source.documentNotes,
    roundId: source.roundId || 'round', exportMap: io.bindUserBookmarkExportTransportPartsV1(source.localAuthorityCapsule.exportMap, original),
    baselineObservableContentBySceneId: { [sceneId]: raw }, scenePathBySceneId: { [sceneId]: scenePath } };
  const saved = { ok: true, current: { sourceText: JSON.stringify(document), document } };
  const main = fs.readFileSync(path.join(__dirname, '../../src/main.js'), 'utf8');
  const start = main.indexOf('async function prepareCleanMediaReturnCapsule('), end = main.indexOf('\nfunction runDocxReviewReturnIntakeParserV2Inline', start);
  const context = vm.createContext({ Buffer, path, pathToFileURL, Date, __dirname: path.resolve(__dirname, '../../src'),
    require: createRequire(path.resolve(__dirname, '../../src/main.js')), computeHash: model.sha,
    currentFilePath: scenePath, compareCommentExportReadback: () => ({ ok: true }),
    loadDocumentContentEnvelopeModule: async () => envelope, loadRevisionBridgeModule: async () => io,
    getProjectNotesContext: async () => ({ ok: true, projectRoot }), readProjectNotesDocument: async () => saved });
  vm.runInContext(main.slice(start, end), context, { importModuleDynamically: vm.constants.USE_MAIN_CONTEXT_DEFAULT_LOADER });
  const run = () => context.prepareCleanMediaReturnCapsule(authority, parsed,
    { projectId, projectRoot, baselineHash: model.sha(raw), sceneText: raw }, undefined, bytes);
  return { run, parsed, saved, authority, document, raw };
}
for (const kind of ['footnote', 'endnote']) for (const noteImage of [false, true]) {
  test(`Main media intake retains unchanged ${kind}, note image ${noteImage}`, async () => {
    const f = await fixture(kind, noteImage), before = JSON.stringify(f.document);
    assert.equal(f.parsed.ok, true);
    const result = await f.run(); assert.equal(result.ok, true, JSON.stringify(result));
    const candidate = result.fields.mediaReturnCandidate;
    assert.equal(result.changed, true); assert.equal(candidate.plan.after[0].attrs.displayWidthEmu, 1800000);
    assert.equal(candidate.noteSourceGuard.sourceText, before);
    assert.equal(JSON.stringify(f.document), before); assert.equal(envelope.deriveVisibleTextFromDocument(candidate.plan.doc), 'Alpha Beta.');
  });
}
for (const mutation of ['body', 'note-image', 'deleted', 'reanchor', 'stale-local', 'wrong-project', 'malformed']) {
  test(`Main media intake rejects ${mutation} notes without acquiring a media candidate`, async () => {
    const f = await fixture('footnote', true, mutation), original = f.saved.current.sourceText;
    if (mutation === 'stale-local') f.saved.current.document.notes[1].manuscript.body = doc(p(t('Local edit')));
    if (mutation === 'wrong-project') f.authority.documentNotes.projectId = 'foreign';
    if (mutation === 'malformed') f.parsed.reasons.push({ code: 'RTK_WORD_NOTES_MALFORMED_BLOCKED' });
    const result = await f.run(); assert.equal(result.ok, false, JSON.stringify(result));
    assert.equal(result.code, 'RTK_MEDIA_ANNOTATION_COMPOSITE_UNSUPPORTED'); assert.equal(result.fields, undefined);
    assert.equal(f.saved.current.sourceText, original);
  });
}

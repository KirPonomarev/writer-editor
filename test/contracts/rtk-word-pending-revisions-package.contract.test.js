'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { buildStoredZip, buildDocxMinBuffer } = require('../../src/export/docx/docxMinBuilder.js');
const { buildFullManuscriptDocxReviewPacketSource } = require('../../src/export/docx/fullManuscriptDocxReviewPacketSource.js');
const { buildDocxReviewPacketBuffer } = require('../../src/export/docx/docxReviewPacketBuilder.js');
const model = require('../../src/core/word-pending-text-revisions-v1.cjs');
const envelope = require('../../src/core/document-content-envelope-v1.cjs');
const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const body = '<w:p><w:r><w:t xml:space="preserve">До </w:t></w:r><w:del w:id="7" w:author="Автор" w:date="2026-09-28T00:00:00Z"><w:r><w:rPr><w:b/></w:rPr><w:delText>старое</w:delText></w:r></w:del><w:ins w:id="8" w:author="Автор" w:date="2026-09-28T00:00:00Z"><w:r><w:rPr><w:i/></w:rPr><w:t>новое</w:t></w:r></w:ins><w:r><w:t xml:space="preserve"> после.</w:t></w:r></w:p>';
function pack(value = body, prefix = 'w') {
  return buildStoredZip([
    { name: '[Content_Types].xml', data: '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>' },
    { name: '_rels/.rels', data: '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="r1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>' },
    { name: 'word/document.xml', data: `<${prefix}:document xmlns:${prefix}="${W}"><${prefix}:body>${value}</${prefix}:body></${prefix}:document>` },
  ]);
}
async function parse(bytes) {
  const b = await import('../../src/io/revisionBridge/index.mjs');
  const preview = b.buildDocxContentPreviewFromZipBytes(bytes); assert.equal(preview.ok, true, JSON.stringify(preview));
  const plan = b.buildDocxImportPreviewPlanFromContentPreview(preview); assert.equal(plan.ok, true, JSON.stringify(plan));
  return { b, plan, doc: envelope.parseObservablePayload(plan.candidateCreatePlan.entries[0].content).doc };
}
test('namespace aliases and literal rich revision bodies import as pending; safe-create is durable and idempotent', async t => {
  const { plan, doc } = await parse(pack(body.replaceAll('w:', 'q:'), 'q'));
  assert.equal(model.projection(doc).original, 'До старое после.'); assert.equal(model.projection(doc).current, 'До новое после.');
  assert.equal(model.readLedger(doc).source.content[0].content[1].marks[0].type, 'bold');
  const safe = require('../fixtures/docx-import-real-authority.cjs'); safe.rememberDocxImportPreviewPlanAdmission(plan);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pending-revisions-')); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const romanRoot = path.join(root, 'roman'); fs.mkdirSync(romanRoot);
  const options = { projectRoot: root, romanRoot, projectId: 'p' };
  const first = await safe.applyDocxImportSafeCreate({ docxImportPreviewPlan: plan }, options);
  assert.equal(first.ok, true, JSON.stringify(first));
  const files = fs.readdirSync(romanRoot, { recursive: true }).filter(f => f.endsWith('.txt'));
  assert.equal(files.length, 1);
  assert.deepEqual(model.projection(envelope.parseObservablePayload(fs.readFileSync(path.join(romanRoot, files[0]), 'utf8')).doc), model.projection(doc));
  const again = await safe.applyDocxImportSafeCreate({ docxImportPreviewPlan: plan }, options);
  assert.equal(again.ok, true); assert.equal(fs.readdirSync(romanRoot, { recursive: true }).filter(f => f.endsWith('.txt')).length, 1);
});
test('full and minimum DOCX retain pending insert/delete and literal author/date through five parse cycles', async () => {
  const initial = await parse(pack());
  const [docxPageSetupBindModule, semanticMappingModule, styleMapModule] = await Promise.all([
    import('../../src/docxPageSetupBind.mjs'), import('../../src/derived/semanticMapping.mjs'), import('../../src/derived/styleMap.mjs'),
  ]);
  for (const profile of ['full', 'minimum']) {
    let doc = initial.doc;
    for (let i = 0; i < 5; i++) {
      const bytes = profile === 'minimum' ? buildDocxMinBuffer({ doc, bookProfile: { formatId: 'A4' } }, { docxPageSetupBindModule, semanticMappingModule, styleMapModule })
        : buildDocxReviewPacketBuffer(buildFullManuscriptDocxReviewPacketSource({ projectId: 'p', projectRoot: '/synthetic',
          scenes: [{ sceneId: 'roman/a.txt', scenePath: '/synthetic/roman/a.txt', text: 'До новое после.', doc, order: 0 }] }));
      ({ doc } = await parse(bytes));
      const p = model.projection(doc);
      assert.equal(p.original, 'До старое после.'); assert.equal(p.current, 'До новое после.');
      assert.deepEqual(p.revisions.map(r => [r.operation, r.state, r.author, r.date]), [['delete', 'pending', 'Автор', '2026-09-28T00:00:00Z'], ['insert', 'pending', 'Автор', '2026-09-28T00:00:00Z']]);
    }
  }
});
test('malformed/nested/structural/composite revisions never flatten into accepted text', async () => {
  const b = await import('../../src/io/revisionBridge/index.mjs');
  for (const xml of [body.replace('w:id="8"', 'w:id="7"'), body.replace('<w:del w:id="7"', '<w:del w:id="7"').replace('<w:delText>старое</w:delText>', '<w:t>старое</w:t>'),
    body.replace('<w:delText>старое</w:delText>', '<w:ins w:id="9"><w:r><w:t>nested</w:t></w:r></w:ins>'),
    body.replace('<w:p>', '<w:p><w:pPr><w:rPr><w:del w:id="22"/></w:rPr></w:pPr>'),
    body.replace('<w:t>новое</w:t>', '<w:t>новое</w:t><w:footnoteReference w:id="1"/>'),
    body.replace('<w:t>новое</w:t>', '<w:t>новое</w:t><w:br w:type="page"/>')]) {
    assert.equal(b.buildDocxContentPreviewFromZipBytes(pack(xml)).ok, false, xml);
  }
});

test('full-manuscript publication gate independently projects Current from native pending XML', async () => {
  const { b, doc } = await parse(pack());
  const source = buildFullManuscriptDocxReviewPacketSource({ projectId: 'p', projectRoot: '/synthetic',
    scenes: [{ sceneId: 'roman/a.txt', scenePath: '/synthetic/roman/a.txt', text: 'До новое после.', doc, order: 0 }] });
  const bytes = buildDocxReviewPacketBuffer(source);
  const crypto = require('node:crypto');
  const cryptoPort = { sha256Text: value => 'sha256:' + crypto.createHash('sha256').update(value).digest('hex'),
    sha256Json: value => 'sha256:' + crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex'), byteLength: value => Buffer.byteLength(value) };
  const projection = b.extractDocxReviewTransportWordDocumentProjection({ bytes }, { cryptoPort });
  assert.equal(projection.ok, true, JSON.stringify(projection));
  const current = b.visibleSceneTextsFromWordDocumentXml(projection.documentXml, source.localAuthorityCapsule.exportMap, { cryptoPort });
  assert.equal(current.ok, true, JSON.stringify(current));
  assert.deepEqual(current.sceneTexts, ['До новое после.']);
});

test('native local-file preview and main source sanitizer retain the complete pending ledger before safe-create', async () => {
  const { createDocxImportLocalFilePreview } = require('../../src/utils/docxImportLocalFilePreview.js');
  const b = await import('../../src/io/revisionBridge/index.mjs');
  const value = await createDocxImportLocalFilePreview({ requestId: 'pending-native-chain' }, {
    pickLocalFile: async () => ({ path: '/synthetic/pending.docx' }), readLocalFileBytes: async () => pack(),
  });
  assert.equal(value.importPreviewOk, true, JSON.stringify(value));
  assert.equal(model.projection(envelope.parseObservablePayload(value.docxImportPreviewPlan.candidateCreatePlan.entries[0].content).doc).revisions.length, 2);
  const main = fs.readFileSync(path.join(__dirname, '../../src/main.js'), 'utf8');
  const start = main.indexOf('function copyDocxImportPreviewAllowedFields(');
  const end = main.indexOf('\nfunction ', main.indexOf('function canonicalizeDocxImportPreviewSourceReport(') + 10);
  const vm = require('node:vm'), context = vm.createContext({
    isPlainObjectValue: v => v && typeof v === 'object' && !Array.isArray(v), cloneJsonSafe: v => structuredClone(v),
  });
  vm.runInContext(main.slice(start, end), context);
  const normalized = context.canonicalizeDocxImportPreviewSourceReport(value.docxContentPreviewReport);
  const plan = b.buildDocxImportPreviewPlanFromContentPreview(normalized);
  assert.equal(plan.ok, true, JSON.stringify(plan));
  assert.equal(model.projection(envelope.parseObservablePayload(plan.candidateCreatePlan.entries[0].content).doc).revisions.length, 2);
});

test('returned round history survives five authenticated-source export parse cycles and decision changes', async () => {
  let { doc } = await parse(pack());
  const first = model.projection(doc);
  for (let n = 1; n <= 5; n++) {
    const source = buildFullManuscriptDocxReviewPacketSource({ projectId: 'p', projectRoot: '/synthetic',
      scenes: [{ sceneId: 'roman/a.txt', scenePath: '/synthetic/roman/a.txt', text: model.projection(doc).current, doc, order: 0 }] });
    const returned = await parse(buildDocxReviewPacketBuffer(source));
    doc = model.replaceFromReturn(doc, returned.doc, { roundId: 'round-' + n, artifactSha256: String(n).padStart(64, '0') }).doc;
    doc = envelope.parseObservablePayload(envelope.composeObservablePayload({ doc })).doc;
    assert.equal(model.readLedger(doc).roundUndo.length, n);
    assert.equal(model.projection(doc).original, first.original); assert.equal(model.projection(doc).current, first.current);
    const rejected = model.decide(doc, { action: 'rejectAll' }).doc;
    assert.equal(model.projection(rejected).current, first.original);
    doc = model.decide(rejected, { action: 'undo' }).doc;
  }
  for (let n = 0; n < 5; n++) doc = model.decide(doc, { action: 'undo' }).doc;
  assert.equal(model.readLedger(doc).roundUndo.length, 0);
  for (let n = 0; n < 5; n++) doc = model.decide(doc, { action: 'redo' }).doc;
  assert.equal(model.readLedger(doc).roundUndo.length, 5);
});

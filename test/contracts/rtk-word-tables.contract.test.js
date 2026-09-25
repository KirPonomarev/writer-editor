'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildDocxMinBuffer, buildStoredZip } = require('../../src/export/docx/docxMinBuilder.js');
const { buildFormatIrParagraphs } = require('../../src/export/docx/fullManuscriptDocxReviewPacketSource.js');
const { buildDocxReviewPacketBuffer } = require('../../src/export/docx/docxReviewPacketBuilder.js');
const modules = Promise.all([
  import('../../src/io/revisionBridge/index.mjs'), import('../../src/renderer/documentContentEnvelope.mjs'),
  import('../../src/docxPageSetupBind.mjs'), import('../../src/derived/semanticMapping.mjs'), import('../../src/derived/styleMap.mjs'),
]);
const p = text => ({ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] });
const cell = (text, colspan = 1, rowspan = 1) => ({ type: 'tableCell', attrs: { colspan, rowspan, colwidth: null }, content: [p(text)] });
const row = (...content) => ({ type: 'tableRow', content });
const table = (...content) => ({ type: 'table', content });
function fixture() {
  const multiple = cell('R2C1'); multiple.content.push(p('second paragraph 日本語 é'));
  return { type: 'doc', content: [p('before'), table(
    row(cell('R1C1'), cell('repeat'), cell('')),
    row(multiple, cell('repeat'), cell('R2C3')),
    row(cell('R3C1'), cell('R3C2'), cell('R3C3')),
  ), p('between'), table(
    row(cell('merged horizontal', 2), cell('vertical', 1, 2)),
    row(cell('R2C1'), cell('R2C2')),
    row(cell('R3C1'), cell('R3C2'), cell('R3C3')),
  ), p('after')] };
}
async function exported(doc) {
  const [,, docxPageSetupBindModule, semanticMappingModule, styleMapModule] = await modules;
  return buildDocxMinBuffer({ doc, bookProfile: { formatId: 'A4' } }, { docxPageSetupBindModule, semanticMappingModule, styleMapModule });
}
async function imported(bytes) {
  const [bridge, envelope] = await modules;
  const report = bridge.buildDocxContentPreviewFromZipBytes(bytes);
  assert.equal(report.ok, true, JSON.stringify(report));
  const plan = bridge.buildDocxImportPreviewPlanFromContentPreview(report);
  assert.equal(plan.ok, true, JSON.stringify(plan));
  return { report, plan, doc: envelope.parseObservablePayload(plan.candidateCreatePlan.entries[0].content).doc };
}
test('Word tables: ordinary export/import retains cells, empty and repeated text, multiple paragraphs, both merge axes and order for five cycles', async () => {
  const expected = fixture(); let actual = expected;
  for (let cycle = 0; cycle < 5; cycle++) {
    const bytes = await exported(actual);
    assert.match(bytes.toString(), /<w:tbl>/u);
    assert.match(bytes.toString(), /<w:gridSpan w:val="2"/u);
    assert.match(bytes.toString(), /<w:vMerge w:val="restart"/u);
    const result = await imported(bytes);
    assert.deepEqual(result.doc, expected);
    assert.equal(result.plan.lossReport.items.some(x => x.code === 'DOCX_IMPORT_PREVIEW_TABLE_NOT_IMPORTED'), false);
    actual = result.doc;
  }
});
test('Word tables: manuscript review export and ordinary import share table topology without source restoration', async () => {
  const expected = fixture(); const [, envelope] = await modules;
  const blocks = buildFormatIrParagraphs({ doc: expected, text: envelope.deriveVisibleTextFromDocument(expected), sceneId: 'fixture.txt' });
  const bytes = buildDocxReviewPacketBuffer({ blocks, customProperties: [{ name: 'YRTK_C01_AUTH', value: 'synthetic-without-authority' }, { name: 'YRTK2_TOKEN', value: 'synthetic-without-authority' }] });
  assert.deepEqual((await imported(bytes)).doc, expected);
});
test('Word tables: invalid canonical grids fail before DOCX serialization instead of flattening', async () => {
  for (const invalid of [table(row(cell('wide', 2)), row(cell('narrow'))), table(row(cell('overshoot', 1, 2))), table(row(cell('bad', 0))), table(row(cell('huge', 1000000)))]) {
    await assert.rejects(exported({ type: 'doc', content: [invalid] }), /TABLE/u);
  }
});
test('Word tables: main/local projections and safe-create preserve exact durable table bytes and reject forged plans', async t => {
  const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), vm = require('node:vm');
  const { applyDocxImportSafeCreate, rememberDocxImportPreviewPlanAdmission } = require('../../src/utils/docxImportSafeCreate.js');
  const { createDocxImportLocalFilePreview } = require('../../src/utils/docxImportLocalFilePreview.js');
  const bytes = await exported(fixture()), { report, plan } = await imported(bytes);
  const main = fs.readFileSync(path.join(__dirname, '../../src/main.js'), 'utf8');
  const start = main.indexOf('function copyDocxImportPreviewAllowedFields(');
  const end = main.indexOf('function validateDocxImportPreviewPayload(', start);
  const projected = vm.runInNewContext(main.slice(start, end) + '\ncanonicalizeDocxImportPreviewSourceReport(report);', {
    report, isPlainObjectValue: v => Boolean(v && typeof v === 'object' && !Array.isArray(v)), cloneJsonSafe: v => JSON.parse(JSON.stringify(v)),
  });
  const [bridge, envelope] = await modules;
  const mainPlan = bridge.buildDocxImportPreviewPlanFromContentPreview(JSON.parse(JSON.stringify(projected)));
  const local = await createDocxImportLocalFilePreview({}, { pickLocalFile: async () => ({ path: '/tmp/synthetic-table.docx' }), readLocalFileBytes: async () => bytes });
  assert.equal(mainPlan.ok, true, JSON.stringify(mainPlan)); assert.equal(local.ok, true, JSON.stringify(local));
  assert.equal(mainPlan.candidateCreatePlan.entries[0].content, plan.candidateCreatePlan.entries[0].content);
  assert.equal(local.docxImportPreviewPlan.candidateCreatePlan.entries[0].content, plan.candidateCreatePlan.entries[0].content);
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'word-table-'));
  t.after(() => fs.rmSync(projectRoot, { recursive: true, force: true }));
  const options = { projectRoot, romanRoot: path.join(projectRoot, 'roman'), projectId: 'word-table-test' };
  rememberDocxImportPreviewPlanAdmission(plan);
  const result = await applyDocxImportSafeCreate({ docxImportPreviewPlan: plan }, options);
  assert.equal(result.ok, true, JSON.stringify(result));
  const folder = path.join(options.romanRoot, 'Imported');
  const saved = fs.readFileSync(path.join(folder, fs.readdirSync(folder)[0]), 'utf8');
  assert.deepEqual(envelope.parseObservablePayload(saved).doc, fixture());
  assert.equal(envelope.analyzeDocumentPlainTextRoundTrip(envelope.parseObservablePayload(saved).doc).safe, false);
  const forged = structuredClone(plan); forged.candidateCreatePlan.entries[0].content += 'tamper';
  assert.equal((await applyDocxImportSafeCreate({ docxImportPreviewPlan: forged }, options)).ok, false);
  assert.equal(fs.readdirSync(folder).length, 1);
});
test('Word tables: malformed, reordered and noncontiguous metadata cannot create a rich table candidate', async () => {
  const { report } = await imported(await exported(fixture())); const [bridge] = await modules;
  for (const fields of [{ row: -1 }, { column: 1 }, { rowspan: 10000 }, { colspan: 0 }, { rowCount: '3' }, { header: 1 }, { paragraphIndex: 1 }, { paragraphCount: 2 }, { tableId: '../authority' }, { additional: true }]) {
    const bad = structuredClone(report); Object.assign(bad.contentPreview.paragraphs.find(p => p.table).table, fields);
    assert.equal(bridge.buildDocxImportPreviewPlanFromContentPreview(bad).ok, false, JSON.stringify(fields));
  }
});
test('Word tables: invalid raw XML topology is blocked independently of paragraph text', async () => {
  const NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const raw = body => buildStoredZip([
    { name: '[Content_Types].xml', data: '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>' },
    { name: '_rels/.rels', data: '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="r1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>' },
    { name: 'word/document.xml', data: `<w:document xmlns:w="${NS}"><w:body>${body}</w:body></w:document>` },
  ]);
  const base = '<w:tbl><w:tblGrid><w:gridCol/></w:tblGrid><w:tr><w:tc><w:tcPr/><w:p/></w:tc></w:tr></w:tbl>';
  const [bridge] = await modules;
  assert.equal(bridge.buildDocxContentPreviewFromZipBytes(raw(base)).ok, true);
  for (const xml of [
    base.replace('<w:tcPr/>', '<w:tcPr><w:vMerge/></w:tcPr>'),
    base.replace('<w:tcPr/>', '<w:tcPr><w:gridSpan w:val="2"/></w:tcPr>'),
    base.replace('<w:tcPr/>', '<w:tcPr><w:gridSpan w:val="0"/></w:tcPr>'),
    base.replace('<w:tcPr/>', '<w:tcPr><w:gridSpan w:val="1"/><w:gridSpan w:val="1"/></w:tcPr>'),
    base.replace('<w:p/>', ''), base.replace('<w:p/>', base),
    base.replace('<w:gridCol/>', ''), base.replace('<w:p/>', '<w:p><w:gridSpan w:val="1"/></w:p>'),
  ]) assert.equal(bridge.buildDocxContentPreviewFromZipBytes(raw(xml)).ok, false, xml);
});

test('Word tables: full-manuscript publication reparses exact table ownership and retains review structural guard', async () => {
  const fs = require('node:fs'), crypto = require('node:crypto'), vm = require('node:vm');
  const producer = require('../../src/export/docx/fullManuscriptDocxReviewPacketSource.js');
  const [bridge, envelope] = await modules;
  const main = fs.readFileSync(require('node:path').join(__dirname, '../../src/main.js'), 'utf8');
  const context = vm.createContext({ crypto, Buffer,
    isPlainObjectValue: x => !!x && typeof x === 'object' && !Array.isArray(x),
    docxReviewPreviewSessionDetailString: x => typeof x === 'string' ? x : '',
    sha256DocxReviewPreviewSessionBytes: b => crypto.createHash('sha256').update(b).digest('hex'),
    cloneJsonSafe: x => JSON.parse(JSON.stringify(x)), docxReviewReturnIntakeBlocked: code => ({ ok: false, code }),
    validateFullManuscriptDocumentSectionsReturn: producer.validateFullManuscriptDocumentSectionsReturn,
  });
  const names = ['stableRtkReviewTransportJson', 'createRtkReviewTransportCryptoPort', 'normalizeRtkSignedSha256',
    'buildFullManuscriptProvisionalSelfParse', 'docxReviewReturnIntakeProductBudgets', 'decodeDocxCustomPropertyText',
    'extractDocxCustomPropertyValue', 'extractDocxReviewReturnYrtk2PropertiesFromCustomXml',
    'extractDocxReviewReturnYrtk2PropertiesFromParserResult', 'verifyDocxReviewReturnYrtk2Binding', 'buildFullManuscriptPublicationGate'];
  vm.runInContext(main.match(/const DOCX_REVIEW_RETURN_INTAKE_FULL_MANUSCRIPT_PRODUCT_BUDGETS = Object.freeze\([^]*?\n}\);/)[0]
    + '\n' + names.map(name => main.match(new RegExp('function ' + name + '\\([^]*?\\n}(?=\\n|$)'))[0]).join('\n'), context);
  const doc = fixture(), raw = envelope.composeObservablePayload({ doc }), parsed = envelope.parseObservablePayload(raw);
  const scenes = [{ sceneId: 'roman/chapter-01/table.txt', scenePath: '/synthetic/roman/chapter-01/table.txt',
    text: parsed.text, doc: parsed.doc, observableContent: raw, order: 0 },
    { sceneId: 'roman/chapter-02/after.txt', scenePath: '/synthetic/roman/chapter-02/after.txt', text: 'chapter two', order: 1 }];
  const cryptoPort = context.createRtkReviewTransportCryptoPort();
  const source = producer.buildFullManuscriptDocxReviewPacketSource({ projectId: 'table-project', projectRoot: '/synthetic',
    manifestPath: '/synthetic/manifest.json', scenes, expectedOrderedSceneIds: scenes.map(s => s.sceneId) },
    { revisionBridge: bridge, cryptoPort, createdAtUtc: '2026-09-25T00:00:00Z',
      roundIdHex: 'a'.repeat(32), keyIdHex: 'b'.repeat(32), hmacSecret: 'synthetic-local-test' });
  const bytes = buildDocxReviewPacketBuffer(source);
  const gate = await context.buildFullManuscriptPublicationGate(source, bytes, bridge);
  assert.equal(gate.ok, true, JSON.stringify(gate));
  const analysis = bridge.buildDocxReviewTransportAnalysisFromZipBytes({ bytes }, { cryptoPort });
  assert.equal(analysis.ok, true, JSON.stringify(analysis));
  assert.equal(analysis.reviewIr.formattingParagraphs.length, source.blocks.length);
  assert.ok(analysis.reviewIr.structureChanges.some(c => c.structureKind === 'tbl' && c.writerAuthorityImpact === 'blocking'));
  const changed = structuredClone(analysis.reviewIr.formattingParagraphs);
  for (const paragraph of changed) delete paragraph.table;
  assert.equal(bridge.validateDocxReviewTableTopology(changed, source.localAuthorityCapsule.exportMap).ok, false);
  const extracted = bridge.extractDocxReviewTransportPackagePartsFromZipBytes({ bytes }, { cryptoPort });
  const xml = extracted.parts['word/document.xml'];
  const bad = xml.replace('<w:vMerge w:val="continue"/></w:tcPr><w:p/>',
    '<w:vMerge w:val="continue"/></w:tcPr><w:p><w:bookmarkStart w:name="hidden-authority" w:id="987"/></w:p>');
  assert.notEqual(bad, xml);
  const corrupted = buildStoredZip(Object.entries(extracted.parts).map(([name, data]) => ({ name, data: name === 'word/document.xml' ? bad : data })));
  assert.equal(bridge.buildDocxReviewTransportAnalysisFromZipBytes({ bytes: corrupted }, { cryptoPort }).ok, false);
});

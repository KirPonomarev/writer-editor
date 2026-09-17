const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { buildDocxMinBuffer, buildStoredZip } = require('../../src/export/docx/docxMinBuilder.js');
const { createDocxImportLocalFilePreview } = require('../../src/utils/docxImportLocalFilePreview.js');
const modules = Promise.all([
  import('../../src/io/revisionBridge/index.mjs'), import('../../src/renderer/documentContentEnvelope.mjs'),
  import('../../src/docxPageSetupBind.mjs'), import('../../src/derived/semanticMapping.mjs'), import('../../src/derived/styleMap.mjs'),
]);
const NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const REL = 'http://schemas.openxmlformats.org/package/2006/relationships';
const OFFICE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
function packageBytes(body, styles = '') {
  return buildStoredZip([
    { name: '[Content_Types].xml', data: `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>${styles ? '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' : ''}</Types>` },
    { name: '_rels/.rels', data: `<Relationships xmlns="${REL}"><Relationship Id="r1" Type="${OFFICE}/officeDocument" Target="word/document.xml"/></Relationships>` },
    { name: 'word/document.xml', data: `<w:document xmlns:w="${NS}"><w:body>${body}</w:body></w:document>` },
    ...(styles ? [
      { name: 'word/styles.xml', data: `<w:styles xmlns:w="${NS}">${styles}</w:styles>` },
      { name: 'word/_rels/document.xml.rels', data: `<Relationships xmlns="${REL}"><Relationship Id="s" Type="${OFFICE}/styles" Target="styles.xml"/></Relationships>` },
    ] : []),
  ]);
}
const p = (text, marks) => ({ type: 'paragraph', content: text ? [{ type: 'text', text, ...(marks ? { marks } : {}) }] : [] });
const code = text => ({ type: 'codeBlock', attrs: { language: '' }, content: text ? [{ type: 'text', text }] : [] });
const quote = node => ({ type: 'blockquote', content: [node] });
async function exported(doc) {
  const [, , docxPageSetupBindModule, semanticMappingModule, styleMapModule] = await modules;
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
test('C1 blocks: code, multiline Unicode, empty blocks and nested quote depth survive two exports', async () => {
  const original = { type: 'doc', content: [p('body'), quote(p('цитата', [{ type: 'bold' }])), code('const x = 1;\n\t日本語 é\n'), code(''), quote(quote(p('nested'))), quote(p(''))] };
  const first = await imported(await exported(original));
  assert.deepEqual(first.doc, original);
  assert.deepEqual((await imported(await exported(first.doc))).doc, original);
  assert.equal(first.plan.lossReport.mode, 'block-styles-headings-lists-and-inline-marks');
});
test('C1 blocks: quotation identity survives both main and local-file preview projections', async () => {
  const original = { type: 'doc', content: [quote(p('quotation')), code('code')] };
  const bytes = await exported(original), { report, plan } = await imported(bytes);
  const main = fs.readFileSync(path.join(__dirname, '../../src/main.js'), 'utf8');
  const start = main.indexOf('function copyDocxImportPreviewAllowedFields(');
  const end = main.indexOf('function validateDocxImportPreviewPayload(', start);
  const projected = require('node:vm').runInNewContext(main.slice(start, end) + '\ncanonicalizeDocxImportPreviewSourceReport(report);', {
    report, isPlainObjectValue: v => Boolean(v && typeof v === 'object' && !Array.isArray(v)), cloneJsonSafe: v => JSON.parse(JSON.stringify(v)),
  });
  const [bridge] = await modules;
  const mainPlan = bridge.buildDocxImportPreviewPlanFromContentPreview(JSON.parse(JSON.stringify(projected)));
  const local = await createDocxImportLocalFilePreview({}, { pickLocalFile: async () => ({ path: '/tmp/owned-synthetic-blocks.docx' }), readLocalFileBytes: async () => bytes });
  assert.equal(mainPlan.ok, true, JSON.stringify(mainPlan));
  assert.equal(local.ok, true, JSON.stringify(local));
  assert.equal(mainPlan.candidateCreatePlan.entries[0].content, plan.candidateCreatePlan.entries[0].content);
  assert.equal(local.docxImportPreviewPlan.candidateCreatePlan.entries[0].content, plan.candidateCreatePlan.entries[0].content);
  assert.deepEqual((await imported(bytes)).doc, original);
});
test('C1 blocks: indentation and a display name alone never imply a quotation', async () => {
  const result = await imported(packageBytes('<w:p><w:pPr><w:pStyle w:val="Custom"/><w:ind w:left="720"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>ordinary</w:t></w:r></w:p>', '<w:style w:type="paragraph" w:styleId="Custom"><w:name w:val="Yalken Blockquote 1"/></w:style>'));
  assert.deepEqual(result.doc, { type: 'doc', content: [p('ordinary', [{ type: 'bold' }])] });
});
for (const definition of ['', '<w:style w:type="character" w:styleId="YalkenBlockquote1"/>']) {
  test('C1 blocks: referenced transport style requires its paragraph definition ' + (definition ? 'wrong-type' : 'missing'), async () => {
    const [bridge] = await modules;
    const result = bridge.buildDocxContentPreviewFromZipBytes(packageBytes('<w:p><w:pPr><w:pStyle w:val="YalkenBlockquote1"/></w:pPr><w:r><w:t>q</w:t></w:r></w:p>', definition));
    assert.equal(result.ok, false, JSON.stringify(result));
  });
}
test('C1 blocks: malformed or conflicting preview metadata cannot create a rich candidate', async () => {
  const { report } = await imported(await exported({ type: 'doc', content: [quote(p('q'))] }));
  const [bridge] = await modules;
  for (const fields of [{ blockquoteDepth: 0 }, { blockquoteDepth: 9 }, { blockquoteDepth: 1.5 }, { blockquoteDepth: '1' }, { blockKind: 'table' }, { blockKind: 'codeBlock', headingLevel: 2 }, { blockKind: 'codeBlock', textAlign: 'right' }, { list: { numId: '1', level: 0, kind: 'bulletList', ordinal: 1 } }]) {
    const bad = structuredClone(report); Object.assign(bad.contentPreview.paragraphs[0], fields);
    assert.equal(bridge.buildDocxImportPreviewPlanFromContentPreview(bad).ok, false, JSON.stringify(fields));
  }
});
test('C1 blocks: code marks cannot be silently discarded by editor persistence', async () => {
  const { report } = await imported(await exported({ type: 'doc', content: [code('code')] }));
  const [bridge] = await modules;
  for (const run of [{ text: 'code', marks: ['bold'] }, { text: 'code', marks: [], fontFamily: 'Arial' }, { text: 'code', marks: [], highlight: '#ffff00' }]) {
    const bad = structuredClone(report); bad.contentPreview.paragraphs[0].inlineRuns = [run];
    assert.equal(bridge.buildDocxImportPreviewPlanFromContentPreview(bad).ok, false, JSON.stringify(run));
  }
});
test('C1 blocks: manuscript exporter and minimal reexport retain the same declared rich blocks', async () => {
  const { buildFormatIrParagraphs } = require('../../src/export/docx/fullManuscriptDocxReviewPacketSource.js');
  const { buildDocxReviewPacketBuffer } = require('../../src/export/docx/docxReviewPacketBuilder.js');
  const original = { type: 'doc', content: [quote(p('quoted', [{ type: 'italic' }])), quote(code('a\nb')), quote({ type: 'heading', attrs: { level: 4 }, content: [{ type: 'text', text: 'heading' }] }), code('')] };
  const bytes = buildDocxReviewPacketBuffer({ blocks: buildFormatIrParagraphs({ doc: original, text: 'quoted\na\nb\nheading', sceneId: 'fixture.txt' }), customProperties: [{ name: 'YRTK_C01_AUTH', value: 'fixture-without-authority' }, { name: 'YRTK2_TOKEN', value: 'fixture-without-authority' }] });
  const result = await imported(bytes);
  assert.deepEqual(result.doc, original);
  assert.deepEqual((await imported(await exported(result.doc))).doc, original);
});
test('C1 blocks: literal page-break token inside code remains text and unsupported code attributes fail export', async () => {
  const [, , , mapping] = await modules;
  const original = { type: 'doc', content: [code(mapping.PAGE_BREAK_TOKEN_V1)] };
  assert.deepEqual((await imported(await exported(original))).doc, original);
  for (const node of [{ ...code('js'), attrs: { language: 'javascript' } }, { ...code('styled'), content: [{ type: 'text', text: 'styled', marks: [{ type: 'bold' }] }] }, { ...quote(p('list')), content: [{ type: 'bulletList', content: [] }] }]) {
    await assert.rejects(exported({ type: 'doc', content: [node] }), /DOCX_(?:CODE_BLOCK_FORMAT|BLOCKQUOTE_SHAPE)_UNSUPPORTED/u);
  }
});
test('C1 blocks: style inheritance is bounded and follows namespace identity', async () => {
  const definition = '<w:style w:type="paragraph" w:styleId="YalkenBlockquote2"/><w:style w:type="paragraph" w:styleId="Localized"><w:basedOn w:val="YalkenBlockquote2"/></w:style>';
  const body = '<w:p><w:pPr><w:pStyle w:val="Localized"/></w:pPr><w:r><w:t>q</w:t></w:r></w:p>';
  assert.deepEqual((await imported(packageBytes(body, definition))).doc, { type: 'doc', content: [quote(quote(p('q')))] });
  const [bridge] = await modules;
  for (const styles of [definition.replace('w:val="YalkenBlockquote2"', 'w:val="Localized"'), definition.replace('YalkenBlockquote2', 'YalkenBlockquote9'), definition.replace('w:type="paragraph" w:styleId="YalkenBlockquote2"', 'w:type="character" w:styleId="YalkenBlockquote2"')]) {
    assert.equal(bridge.buildDocxContentPreviewFromZipBytes(packageBytes(body, styles)).ok, false);
  }
  assert.equal(bridge.buildDocxContentPreviewFromZipBytes(packageBytes(body.replace('<w:pStyle w:val="Localized"/>', '<w:pStyle w:val="Localized"/><w:pStyle w:val="Other"/>'), definition)).ok, false);
});

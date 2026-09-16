const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buildDocxMinBuffer, buildStoredZip } = require('../../src/export/docx/docxMinBuilder.js');
const { createDocxImportLocalFilePreview } = require('../../src/utils/docxImportLocalFilePreview.js');
const { applyDocxImportSafeCreate, rememberDocxImportPreviewPlanAdmission } = require('../../src/utils/docxImportSafeCreate.js');
const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const CT = 'http://schemas.openxmlformats.org/package/2006/content-types';
const REL = 'http://schemas.openxmlformats.org/package/2006/relationships';
const OFFICE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const modules = Promise.all([
  import('../../src/io/revisionBridge/index.mjs'), import('../../src/renderer/documentContentEnvelope.mjs'),
  import('../../src/docxPageSetupBind.mjs'), import('../../src/derived/semanticMapping.mjs'), import('../../src/derived/styleMap.mjs'),
]);
function packageBytes(body, styles = '', prefix = 'w') {
  const parts = [
    { name: '[Content_Types].xml', data: `<Types xmlns="${CT}"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>${styles ? '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' : ''}</Types>` },
    { name: '_rels/.rels', data: `<Relationships xmlns="${REL}"><Relationship Id="r1" Type="${OFFICE}/officeDocument" Target="word/document.xml"/></Relationships>` },
    { name: 'word/document.xml', data: `<${prefix}:document xmlns:${prefix}="${W}"><${prefix}:body>${body}</${prefix}:body></${prefix}:document>` },
  ];
  if (styles) parts.push({ name: 'word/styles.xml', data: styles }, { name: 'word/_rels/document.xml.rels', data: `<Relationships xmlns="${REL}"><Relationship Id="styles" Type="${OFFICE}/styles" Target="styles.xml"/></Relationships>` });
  return buildStoredZip(parts);
}
const styleXml = content => `<w:styles xmlns:w="${W}">${content}</w:styles>`;
const r = (text, pr = '') => `<w:r>${pr ? `<w:rPr>${pr}</w:rPr>` : ''}<w:t xml:space="preserve">${text}</w:t></w:r>`;
async function planFrom(bytes) {
  const [bridge] = await modules;
  const report = bridge.buildDocxContentPreviewFromZipBytes(bytes);
  assert.equal(report.ok, true, JSON.stringify(report));
  const plan = bridge.buildDocxImportPreviewPlanFromContentPreview(report);
  assert.equal(plan.ok, true, JSON.stringify(plan));
  return { plan, report };
}
async function profile(plan) {
  const [, envelope] = await modules;
  const parsed = envelope.parseObservablePayload(plan.candidateCreatePlan.entries[0].content);
  const nodes = parsed.doc?.content || [{ type: 'paragraph', content: [{ type: 'text', text: parsed.text }] }];
  return nodes.map(p => (p.content || []).flatMap(n => [...(n.type === 'hardBreak' ? '\n' : n.text || '')]
    .map(ch => [ch, (n.marks || []).map(m => m.type).sort()])));
}
test('C1 inline: four marks, combinations, plain neighbors, blank paragraphs and breaks survive actual export/import codecs', async () => {
  const [, , docxPageSetupBindModule, semanticMappingModule, styleMapModule] = await modules;
  const input = { type: 'doc', content: [
    { type: 'paragraph', content: [{ type: 'text', text: 'B', marks: [{ type: 'bold' }] }, { type: 'text', text: ' plain ' }, { type: 'text', text: 'И', marks: [{ type: 'italic' }, { type: 'underline' }, { type: 'strike' }] }] },
    { type: 'paragraph', content: [] },
    { type: 'paragraph', content: [{ type: 'text', text: 'x' }, { type: 'hardBreak' }, { type: 'text', text: 'y' }] },
  ] };
  const bytes = buildDocxMinBuffer({ doc: input, bookProfile: { formatId: 'A4' } }, { docxPageSetupBindModule, semanticMappingModule, styleMapModule });
  const { plan } = await planFrom(bytes);
  assert.deepEqual(await profile(plan), [[['B', ['bold']], ...[...' plain '].map(ch => [ch, []]), ['И', ['italic', 'strike', 'underline']]], [], [['x', []], ['\n', []], ['y', []]]]);
  assert.equal(plan.lossReport.mode, 'inline-marks');
  assert.match(plan.lossReport.items.find(i => i.code === 'DOCX_IMPORT_PREVIEW_INLINE_MARKS_ONLY').message, /fonts/);
});
test('C1 inline: explicit off and split runs do not leak across boundaries or paragraphs', async () => {
  const { plan } = await planFrom(packageBytes(`<w:p>${r('a', '<w:b/>')}${r('b', '<w:b w:val="true"/>')}${r('c', '<w:b w:val="0"/>')}${r('d')}</w:p><w:p>${r('e')}</w:p>`));
  assert.deepEqual(await profile(plan), [[['a', ['bold']], ['b', ['bold']], ['c', []], ['d', []]], [['e', []]]]);
});
test('C1 inline: defaults, basedOn, paragraph and character style toggles precede direct formatting', async () => {
  const styles = styleXml('<w:docDefaults><w:rPrDefault><w:rPr><w:i/></w:rPr></w:rPrDefault></w:docDefaults><w:style w:type="paragraph" w:styleId="Base"><w:rPr><w:b/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Derived"><w:basedOn w:val="Base"/><w:rPr><w:b/><w:strike/></w:rPr></w:style><w:style w:type="character" w:styleId="Char"><w:rPr><w:i/><w:u w:val="single"/></w:rPr></w:style>');
  const { plan } = await planFrom(packageBytes(`<w:p><w:pPr><w:pStyle w:val="Derived"/></w:pPr>${r('a')}${r('b', '<w:rStyle w:val="Char"/><w:b/><w:strike w:val="off"/>')}</w:p>`, styles));
  assert.deepEqual(await profile(plan), [[['a', ['italic', 'strike']], ['b', ['bold', 'underline']]]]);
});
test('C1 inline: default paragraph style applies; paragraph-mark properties do not format text', async () => {
  const styles = styleXml('<w:style w:type="paragraph" w:default="1" w:styleId="Body"><w:rPr><w:i/></w:rPr></w:style>');
  const { plan } = await planFrom(packageBytes(`<w:p><w:pPr><w:rPr><w:b/></w:rPr></w:pPr>${r('a')}</w:p>`, styles));
  assert.deepEqual(await profile(plan), [[['a', ['italic']]]]);
});
test('C1 inline: namespace aliases are resolved and foreign property namespaces are rejected', async () => {
  const { plan } = await planFrom(packageBytes('<x:p><x:r><x:rPr><x:b/></x:rPr><x:t>a</x:t></x:r></x:p>', '', 'x'));
  assert.deepEqual(await profile(plan), [[['a', ['bold']]]]);
  const [bridge] = await modules;
  const spoof = bridge.buildDocxContentPreviewFromZipBytes(packageBytes(`<w:p>${r('a', '<w:b xmlns:w="urn:foreign"/>')}</w:p>`));
  assert.equal(spoof.ok, false);
});
test('C1 inline: malformed properties and unsupported underline never silently certify preservation', async () => {
  const [bridge] = await modules;
  for (const pr of ['<w:b w:val="perhaps"/>', '<w:u w:val="double"/>']) {
    const report = bridge.buildDocxContentPreviewFromZipBytes(packageBytes(`<w:p>${r('a', pr)}</w:p>`));
    assert.equal(report.ok, false);
    assert.match(report.reason, /DOCX_INLINE_/);
  }
});
test('C1 inline: used style cycles, overlong chains and oversized style parts fail closed', async () => {
  const [bridge] = await modules;
  for (const styles of [
    styleXml('<w:style w:type="paragraph" w:styleId="s0"><w:basedOn w:val="s0"/></w:style>'),
    styleXml(Array.from({ length: 65 }, (_, i) => `<w:style w:type="paragraph" w:styleId="s${i}">${i < 64 ? `<w:basedOn w:val="s${i + 1}"/>` : ''}</w:style>`).join('')),
    styleXml(' '.repeat(1024 * 1024)),
    `<w:styles xmlns:w="${W}"><w:style>`,
  ]) {
    const report = bridge.buildDocxContentPreviewFromZipBytes(packageBytes(`<w:p><w:pPr><w:pStyle w:val="s0"/></w:pPr>${r('a')}</w:p>`, styles));
    assert.equal(report.ok, false, JSON.stringify(report));
  }
});
test('C1 inline: text binding, unknown marks, duplicate marks and extra run fields block a forged preview', async () => {
  const [bridge] = await modules;
  const { report } = await planFrom(packageBytes(`<w:p>${r('a', '<w:b/>')}</w:p>`));
  for (const run of [{ text: 'X', marks: ['bold'] }, { text: 'a', marks: ['script'] }, { text: 'a', marks: ['bold', 'bold'] }, { text: 'a', marks: ['bold'], path: '/tmp/unsafe' }]) {
    const forged = structuredClone(report); forged.contentPreview.paragraphs[0].inlineRuns = [run];
    assert.equal(bridge.buildDocxImportPreviewPlanFromContentPreview(forged).ok, false);
  }
});
test('C1 inline: local picker projection retains marks; admitted rich scene persists and repeat creates no second file', async t => {
  const bytes = packageBytes(`<w:p>${r('B', '<w:b/>')}${r('plain')}${r('I', '<w:i/>')}</w:p>`);
  const response = await createDocxImportLocalFilePreview({}, {
    pickLocalFile: async () => ({ path: '/tmp/synthetic-inline.docx' }),
    readLocalFileBytes: async () => bytes,
  });
  assert.equal(response.ok, true, JSON.stringify(response));
  const plan = response.docxImportPreviewPlan;
  assert.equal(plan.lossReport.mode, 'inline-marks');
  assert.match(rememberDocxImportPreviewPlanAdmission(plan), /^[a-f0-9]{64}$/);
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'docx-inline-test-'));
  t.after(() => fs.rmSync(projectRoot, { recursive: true, force: true }));
  const options = { projectRoot, romanRoot: path.join(projectRoot, 'roman'), projectId: 'inline-test' };
  const result = await applyDocxImportSafeCreate({ docxImportPreviewPlan: plan }, options);
  assert.equal(result.ok, true, JSON.stringify(result));
  const imported = path.join(options.romanRoot, 'Imported');
  assert.equal(fs.readdirSync(imported).length, 1);
  const content = fs.readFileSync(path.join(imported, fs.readdirSync(imported)[0]), 'utf8');
  assert.equal(content, plan.candidateCreatePlan.entries[0].content);
  assert.deepEqual(await profile(plan), [[['B', ['bold']], ...[...'plain'].map(ch => [ch, []]), ['I', ['italic']]]]);
  const repeat = await applyDocxImportSafeCreate({ docxImportPreviewPlan: plan }, options);
  assert.equal(repeat.ok, true, JSON.stringify(repeat));
  assert.equal(fs.readdirSync(imported).length, 1);
});

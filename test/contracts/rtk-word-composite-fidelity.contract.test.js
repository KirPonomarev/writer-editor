'use strict';
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { applyDocxImportSafeCreate, rememberDocxImportPreviewPlanAdmission } = require('../fixtures/docx-import-real-authority.cjs');
const assert = require('node:assert/strict');
const { buildDocxMinBuffer, buildStoredZip } = require('../../src/export/docx/docxMinBuilder.js');
const { createImageAttrs } = require('../../src/io/documentMedia.js');
const modules = Promise.all([import('../../src/io/revisionBridge/index.mjs'), import('../../src/renderer/documentContentEnvelope.mjs'), import('../../src/docxPageSetupBind.mjs'), import('../../src/derived/semanticMapping.mjs'), import('../../src/derived/styleMap.mjs')]);
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAABAAAAAICAYAAADwdn+XAAAAFklEQVR4nGP4z8DwHx8mAo4aMPQNAADNZv8BGUNAhgAAAABJRU5ErkJggg==', 'base64');
const image=(alt,w,h)=>({type:'image',attrs:{...createImageAttrs(png,{alt,displayName:'same.png'}),displayWidthEmu:w,displayHeightEmu:h}});
const p=(...content)=>({type:'paragraph',content:content.map(v=>typeof v==='string'?{type:'text',text:v}:v)}),cell=(content,colspan=1,rowspan=1)=>({type:'tableCell',attrs:{colspan,rowspan,colwidth:null},content}),row=(...content)=>({type:'tableRow',content});
const table={type:'table',attrs:{wordTable:{version:1,grid:[720,1440,4320],layout:'fixed',widthDxa:null,shading:null,borders:Object.fromEntries(['top','bottom','left','right','insideH','insideV'].map(k=>[k,{style:'double',size:24,color:'auto'}]))}},content:[row(cell([p({type:'text',text:'Bold é 日本語 ',marks:[{type:'bold'}]},image('cell picture',304800,152400),' after'),p()],2),cell([p('vertical')],1,2)),row(cell([p('left')]),cell([p('right')]))]};table.content[0].content[0].attrs.wordCell={version:1,shading:'FF0000',borders:{}};
const cases=[{id:'TABLE_MERGES_PROPERTIES_IMAGE_RICH_TEXT',doc:{type:'doc',content:[p('Before'),table,p('After')]}},{id:'REPEATED_PNG_SIZES_ALT',doc:{type:'doc',content:[p(image('first',228600,114300)),p(image('second',304800,152400)),p('tail')]}},{id:'LIST_HEADING_IMAGE_HARD_BREAK',doc:{type:'doc',content:[{type:'heading',attrs:{level:2},content:[{type:'text',text:'Heading 日本語'}]},{type:'orderedList',attrs:{start:3},content:[{type:'listItem',content:[p('First ',image('list',304800,152400),{type:'hardBreak'},'Second')]}]},p('End')]}},{id:'LARGE_TEXT_NO_TRUNCATION',doc:{type:'doc',content:Array.from({length:1500},(_,i)=>p(`paragraph ${i}: Привет 日本語 é 🧭 ${'x'.repeat(120)}`))}}];

for (const c of cases) test('W6 composite: ' + c.id, async () => {
  const [bridge, envelope, docxPageSetupBindModule, semanticMappingModule, styleMapModule] = await modules;
  let current = c.doc;
  const cycles = c.id.startsWith('LARGE') ? 1 : 5;
  for (let cycle = 0; cycle < cycles; cycle++) {
    const bytes = buildDocxMinBuffer({ doc: current, bookProfile: { formatId: 'A4' } }, { docxPageSetupBindModule, semanticMappingModule, styleMapModule });
    const report = bridge.buildDocxContentPreviewFromZipBytes(bytes);
    assert.equal(report.ok, true, JSON.stringify(report));
    const plan = bridge.buildDocxImportPreviewPlanFromContentPreview(report);
    assert.equal(plan.ok, true, JSON.stringify(plan));
    const candidate = plan.candidateCreatePlan.entries[0].content;
    if (c.id.startsWith('LARGE')) assert.equal(candidate, envelope.deriveVisibleTextFromDocument(c.doc));
    else {
      current = envelope.parseObservablePayload(candidate).doc;
      assert.deepEqual(current, envelope.canonicalizeDocumentJson(c.doc), 'full structure, properties, bytes and placement cycle ' + cycle);
    }
    assert.equal(plan.lossReport.items.some(i => i.code === 'DOCX_IMPORT_PREVIEW_LINE_BREAK_TEXT_ONLY'), false);
    const message = plan.lossReport.items.filter(i => i.category === 'formatting').map(i => i.message).join(' ');
    if (c.id.startsWith('TABLE')) assert.match(message, /absolute column widths, literal shading and supported borders/);
    if (!c.id.startsWith('LARGE')) assert.match(message, /bounded display dimensions/);
  }
});

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const CT = 'http://schemas.openxmlformats.org/package/2006/content-types';
const REL = 'http://schemas.openxmlformats.org/package/2006/relationships';
const OFFICE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
function packageBytes(body, styles = '', prefix = 'w') {
  const parts = [
    { name: '[Content_Types].xml', data: `<Types xmlns="${CT}"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>${styles ? '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' : ''}</Types>` },
    { name: '_rels/.rels', data: `<Relationships xmlns="${REL}"><Relationship Id="r1" Type="${OFFICE}/officeDocument" Target="word/document.xml"/></Relationships>` },
    { name: 'word/document.xml', data: `<${prefix}:document xmlns:${prefix}="${W}"><${prefix}:body>${body}</${prefix}:body></${prefix}:document>` },
  ];
  if (styles) parts.push({ name: 'word/styles.xml', data: styles }, { name: 'word/_rels/document.xml.rels', data: `<Relationships xmlns="${REL}"><Relationship Id="styles" Type="${OFFICE}/styles" Target="styles.xml"/></Relationships>` });
  return buildStoredZip(parts);
}
async function planFrom(bytes) {
  const [bridge] = await modules;
  const report = bridge.buildDocxContentPreviewFromZipBytes(bytes);
  assert.equal(report.ok, true, JSON.stringify(report));
  const plan = bridge.buildDocxImportPreviewPlanFromContentPreview(report);
  assert.equal(plan.ok, true, JSON.stringify(plan));
  return { plan, report };
}

test('W6: unformatted hard breaks retain paragraph identity for five cycles and safe-create persistence', async t => {
  const [, envelope, docxPageSetupBindModule, semanticMappingModule, styleMapModule] = await modules;
  const br = { type: 'hardBreak' };
  const doc = { type: 'doc', content: [
    { type: 'paragraph', content: [br, { type: 'text', text: ' before\t日本語 é 🧭 ' }, br, br, { type: 'text', text: 'after' }, br] },
    { type: 'paragraph', content: [] },
    { type: 'paragraph', content: [{ type: 'text', text: 'separate paragraph' }] },
  ] };
  let current = doc, plan;
  for (let cycle = 0; cycle < 5; cycle++) {
    const bytes = buildDocxMinBuffer({ doc: current, bookProfile: { formatId: 'A4' } }, { docxPageSetupBindModule, semanticMappingModule, styleMapModule });
    ({ plan } = await planFrom(bytes));
    current = envelope.parseObservablePayload(plan.candidateCreatePlan.entries[0].content).doc;
    assert.deepEqual(current, doc, `cycle ${cycle}: line breaks must not depend on unrelated bold/font marks`);
    assert.equal(plan.lossReport.items.some(i => i.code === 'DOCX_IMPORT_PREVIEW_LINE_BREAK_TEXT_ONLY'), false);
    assert.equal(plan.lossReport.itemCount, plan.lossReport.items.length);
  }
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'docx-breaks-w6-'));
  t.after(() => fs.rmSync(projectRoot, { recursive: true, force: true }));
  const options = { projectRoot, romanRoot: path.join(projectRoot, 'roman'), projectId: 'w6-breaks' };
  rememberDocxImportPreviewPlanAdmission(plan);
  const result = await applyDocxImportSafeCreate({ docxImportPreviewPlan: plan }, options);
  assert.equal(result.ok, true, JSON.stringify(result));
  const directory = path.join(options.romanRoot, 'Imported');
  const files = fs.readdirSync(directory).filter(n => n.endsWith('.txt'));
  assert.equal(files.length, 1);
  assert.deepEqual(envelope.parseObservablePayload(fs.readFileSync(path.join(directory, files[0]), 'utf8')).doc, doc);
});

test('W6: line, page and column boundaries retain distinct document meaning', async () => {
  const { plan } = await planFrom(packageBytes('<w:p><w:r><w:t>a</w:t><w:br/><w:t>b</w:t><w:br w:type="page"/><w:t>c</w:t><w:br w:type="column"/><w:t>d</w:t></w:r></w:p>'));
  const [, envelope] = await modules;
  const doc = envelope.parseObservablePayload(plan.candidateCreatePlan.entries[0].content).doc;
  assert.equal(doc.content.length, 1);
  assert.deepEqual(doc.content[0].content.filter(n => n.type === 'hardBreak').map(n => n.attrs?.wordBreakType || 'line'), ['line', 'page', 'column']);
  assert.equal(envelope.deriveVisibleTextFromDocument(doc), 'a\nb\nc\nd');
  for (const code of ['PAGE_BREAK_TEXT_ONLY', 'COLUMN_BREAK_TEXT_ONLY', 'LINE_BREAK_TEXT_ONLY'])
    assert.equal(plan.lossReport.items.some(i => i.code === 'DOCX_IMPORT_PREVIEW_' + code), false);
});

test('W6 composite: table properties and owned PNG survive failed receipt write, recovery and replay', async t => {
  const [, envelope, docxPageSetupBindModule, semanticMappingModule, styleMapModule] = await modules;
  const doc = cases[0].doc;
  const { plan } = await planFrom(buildDocxMinBuffer({ doc, bookProfile: { formatId: 'A4' } }, { docxPageSetupBindModule, semanticMappingModule, styleMapModule }));
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'w6-table-media-recovery-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const options = { projectRoot: root, romanRoot: path.join(root, 'roman'), projectId: 'w6-composite-recovery' };
  rememberDocxImportPreviewPlanAdmission(plan);
  const fsp = require('node:fs/promises'), originalOpen = fsp.open;
  fsp.open = async function (file, ...args) {
    if (String(file).startsWith(root) && String(file).includes(path.sep + 'receipts' + path.sep)) throw Object.assign(Error('W6_OWNED_RECEIPT_ENOSPC'), { code: 'ENOSPC' });
    return originalOpen.call(this, file, ...args);
  };
  let failed;
  try { failed = await applyDocxImportSafeCreate({ docxImportPreviewPlan: plan }, options); }
  finally { fsp.open = originalOpen; }
  assert.equal(failed.ok, false, 'No ACK when durable receipt cannot be written');
  const imported = await applyDocxImportSafeCreate({ docxImportPreviewPlan: plan }, options);
  assert.equal(imported.ok, true, JSON.stringify(imported));
  const directory = path.join(options.romanRoot, 'Imported');
  const files = fs.readdirSync(directory).filter(f => f.endsWith('.txt'));
  assert.equal(files.length, 1);
  const saved = fs.readFileSync(path.join(directory, files[0]), 'utf8');
  assert.deepEqual(envelope.parseObservablePayload(saved).doc, envelope.canonicalizeDocumentJson(doc));
  const attrs = doc.content[1].content[0].content[0].content[0].content.find(n => n.type === 'image').attrs;
  assert.deepEqual(fs.readFileSync(path.join(root, attrs.assetPath)), png);
  const replay = await applyDocxImportSafeCreate({ docxImportPreviewPlan: plan }, options);
  assert.equal(replay.ok, true, JSON.stringify(replay));
  assert.equal(replay.value.idempotent, true);
  assert.equal(fs.readdirSync(directory).filter(f => f.endsWith('.txt')).length, 1);
  assert.equal(fs.readFileSync(path.join(directory, files[0]), 'utf8'), saved);
});

test('W6 composite: malformed table plus PNG and tampered admitted content never receive writer authority', async t => {
  const [, , docxPageSetupBindModule, semanticMappingModule, styleMapModule] = await modules;
  const options = { docxPageSetupBindModule, semanticMappingModule, styleMapModule };
  for (const kind of ['merge', 'binary', 'escape', 'dimensions']) {
    const doc = structuredClone(cases[0].doc);
    const table = doc.content[1], image = table.content[0].content[0].content[0].content.find(n => n.type === 'image');
    if (kind === 'merge') table.content[0].content[0].attrs.colspan = 100000;
    if (kind === 'binary') image.attrs.dataBase64 = Buffer.from('not PNG').toString('base64');
    if (kind === 'escape') image.attrs.assetPath = '../outside.png';
    if (kind === 'dimensions') image.attrs.displayWidthEmu = Number.MAX_SAFE_INTEGER;
    assert.throws(() => buildDocxMinBuffer({ doc, bookProfile: { formatId: 'A4' } }, options), /TABLE|MEDIA/, kind);
  }
  const { plan } = await planFrom(buildDocxMinBuffer({ doc: cases[0].doc, bookProfile: { formatId: 'A4' } }, options));
  rememberDocxImportPreviewPlanAdmission(plan);
  const forged = structuredClone(plan); forged.candidateCreatePlan.entries[0].content += 'foreign-authority';
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'w6-no-write-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const result = await applyDocxImportSafeCreate({ docxImportPreviewPlan: forged }, { projectRoot: root, romanRoot: path.join(root, 'roman'), projectId: 'w6-hostile' });
  assert.equal(result.ok, false);
  assert.deepEqual(fs.readdirSync(root), []);
});

async function actualFilePreview(bytes, root) {
  const [bridge] = await modules;
  const file = path.join(root, 'source.docx'); fs.writeFileSync(file, bytes);
  return require('../../src/utils/docxImportLocalFilePreview.js').createDocxImportLocalFilePreview(
    { requestId: 'w6-import-fidelity' }, {
      pickLocalFile: async () => ({ path: file }),
      readLocalFileBytes: selection => fs.promises.readFile(selection.path),
      loadRevisionBridgeModule: async () => bridge,
    });
}
const symbolRun = '<w:r><w:rPr><w:b/></w:rPr><w:t>A</w:t><w:sym w:font="Wingdings" w:char="F0FC"/><w:t>B</w:t></w:r>';
for (const [kind, body, prefix] of [
  ['paragraph', `<w:p>${symbolRun}</w:p>`],
  ['table cell', `<w:tbl><w:tblPr/><w:tblGrid><w:gridCol w:w="1440"/></w:tblGrid><w:tr><w:tc><w:p>${symbolRun}</w:p></w:tc></w:tr></w:tbl>`],
  ['content control', `<w:sdt><w:sdtContent><w:p>${symbolRun}</w:p></w:sdtContent></w:sdt>`],
  ['namespace alias', `<w:p>${symbolRun}</w:p>`.replaceAll('w:', 'q:'), 'q'],
  ['malformed symbol', '<w:p><w:r><w:t>A</w:t><w:sym w:char="ZZ"/><w:t>B</w:t></w:r></w:p>'],
  ['foreign namespace', '<w:p><w:r><w:t>A</w:t><x:sym xmlns:x="urn:not-word" x:char="F0FC"/><w:t>B</w:t></w:r></w:p>'],
]) test(`W6 symbol ${kind}: actual local preview refuses without candidate or filesystem mutation`, async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'w6-symbol-refusal-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'manifest.json'), '{"protected":true}');
  const bytes = packageBytes(body, '', prefix);
  const preview = await actualFilePreview(bytes, root);
  assert.equal(preview.status, 'blocked', JSON.stringify(preview));
  assert.equal(preview.importPreviewOk, false);
  assert.equal(preview.docxImportPreviewPlan, null);
  if (kind !== 'foreign namespace') assert.match(JSON.stringify(preview.docxContentPreviewReport), /DOCX_SYMBOL_UNMAPPED/);
  const before = Object.fromEntries(fs.readdirSync(root).map(name => [name, fs.readFileSync(path.join(root, name)).toString('base64')]));
  const result = await applyDocxImportSafeCreate({ docxImportPreviewPlan: preview.docxImportPreviewPlan }, {
    projectRoot: root, romanRoot: path.join(root, 'roman'), projectId: 'w6-symbol',
  });
  assert.equal(result.ok, false);
  assert.deepEqual(Object.fromEntries(fs.readdirSync(root).map(name => [name, fs.readFileSync(path.join(root, name)).toString('base64')])), before);
});

test('W6 named style inheritance: actual adapter discloses normalization and persists effective heading and run formatting', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'w6-style-normalization-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const styles = `<w:styles xmlns:w="${W}"><w:style w:type="paragraph" w:styleId="Base"><w:name w:val="Owner base"/><w:pPr><w:outlineLvl w:val="2"/></w:pPr><w:rPr><w:b/><w:color w:val="123456"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Child"><w:name w:val="Owner chapter"/><w:basedOn w:val="Base"/></w:style></w:styles>`;
  const preview = await actualFilePreview(packageBytes('<w:p><w:pPr><w:pStyle w:val="Child"/></w:pPr><w:r><w:t>Styled chapter</w:t></w:r></w:p>', styles), root);
  assert.equal(preview.importPreviewOk, true, JSON.stringify(preview));
  const plan = preview.docxImportPreviewPlan;
  const disclosures = plan.lossReport.items.filter(item => item.code === 'DOCX_IMPORT_PREVIEW_NAMED_STYLES_NORMALIZED');
  assert.equal(disclosures.length, 1); assert.equal(disclosures[0].sourcePart, 'word/styles.xml');
  assert.match(disclosures[0].message, /identities, names and inheritance are not retained/);
  assert.equal(plan.lossReport.itemCount, plan.lossReport.items.length);
  const [, envelope] = await modules;
  const doc = envelope.parseObservablePayload(plan.candidateCreatePlan.entries[0].content).doc;
  assert.equal(doc.content[0].type, 'heading'); assert.equal(doc.content[0].attrs.level, 3);
  assert.deepEqual(doc.content[0].content[0], { type: 'text', text: 'Styled chapter', marks: [{ type: 'bold' }, { type: 'textStyle', attrs: { color: '#123456' } }] });
  rememberDocxImportPreviewPlanAdmission(plan);
  const options = { projectRoot: root, romanRoot: path.join(root, 'roman'), projectId: 'w6-style' };
  const result = await applyDocxImportSafeCreate({ docxImportPreviewPlan: plan }, options);
  assert.equal(result.ok, true, JSON.stringify(result));
  const folder = path.join(options.romanRoot, 'Imported');
  const scenes = fs.readdirSync(folder).filter(name => name.endsWith('.txt')); assert.equal(scenes.length, 1);
  assert.deepEqual(envelope.parseObservablePayload(fs.readFileSync(path.join(folder, scenes[0]), 'utf8')).doc, doc);
  const plain = await planFrom(packageBytes('<w:p><w:r><w:t>plain</w:t></w:r></w:p>'));
  assert.equal(plain.plan.lossReport.items.some(item => item.code === 'DOCX_IMPORT_PREVIEW_NAMED_STYLES_NORMALIZED'), false);
});

test('W6 named style disclosure does not enter pending revision semantic admission', async () => {
  const styles = `<w:styles xmlns:w="${W}"><w:style w:type="paragraph" w:styleId="Custom"><w:name w:val="Custom"/><w:rPr><w:b/></w:rPr></w:style></w:styles>`;
  const { plan } = await planFrom(packageBytes('<w:p><w:pPr><w:pStyle w:val="Custom"/></w:pPr><w:r><w:t>A</w:t></w:r><w:ins w:id="1" w:author="Owner" w:date="2026-10-03T00:00:00Z"><w:r><w:t>B</w:t></w:r></w:ins></w:p>', styles));
  const [, envelope] = await modules;
  const doc = envelope.parseObservablePayload(plan.candidateCreatePlan.entries[0].content).doc;
  const model = require('../../src/core/word-pending-text-revisions-v1.cjs');
  assert.equal(model.projection(doc).original, 'A'); assert.equal(model.projection(doc).current, 'AB');
  assert.equal(model.readLedger(doc).source.content[0].content[0].marks[0].type, 'bold');
  assert.equal(plan.lossReport.items.filter(item => item.code === 'DOCX_IMPORT_PREVIEW_NAMED_STYLES_NORMALIZED').length, 1);
});

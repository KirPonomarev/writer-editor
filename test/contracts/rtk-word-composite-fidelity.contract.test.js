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

test('W6: page and column boundaries retain explicit loss while ordinary hard breaks do not', async () => {
  const { plan } = await planFrom(packageBytes('<w:p><w:r><w:t>a</w:t><w:br/><w:t>b</w:t><w:br w:type="page"/><w:t>c</w:t><w:br w:type="column"/><w:t>d</w:t></w:r></w:p>'));
  const [, envelope] = await modules;
  assert.equal(envelope.parseObservablePayload(plan.candidateCreatePlan.entries[0].content).doc.content.length, 1);
  for (const code of ['PAGE_BREAK_TEXT_ONLY', 'COLUMN_BREAK_TEXT_ONLY']) assert(plan.lossReport.items.some(i => i.code === 'DOCX_IMPORT_PREVIEW_' + code));
  assert.equal(plan.lossReport.items.some(i => i.code === 'DOCX_IMPORT_PREVIEW_LINE_BREAK_TEXT_ONLY'), false);
  assert.match(plan.lossReport.items.find(i => i.code === 'DOCX_IMPORT_PREVIEW_PAGE_BREAK_TEXT_ONLY').message, /line break/);
});

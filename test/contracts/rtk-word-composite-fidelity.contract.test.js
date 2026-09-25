'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildDocxMinBuffer } = require('../../src/export/docx/docxMinBuilder.js');
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

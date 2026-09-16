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
const run = (text, properties = '') => `<w:r><w:rPr>${properties}</w:rPr><w:t xml:space="preserve">${text}</w:t></w:r>`;
const stylesXml = body => `<w:styles xmlns:w="${W}">${body}</w:styles>`;
function pack(body, styles = '') {
  return buildStoredZip([
    { name: '[Content_Types].xml', data: `<Types xmlns="${CT}"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>${styles ? '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' : ''}</Types>` },
    { name: '_rels/.rels', data: `<Relationships xmlns="${REL}"><Relationship Id="r1" Type="${OFFICE}/officeDocument" Target="word/document.xml"/></Relationships>` },
    { name: 'word/document.xml', data: `<w:document xmlns:w="${W}"><w:body>${body}</w:body></w:document>` },
    ...(styles ? [{ name: 'word/styles.xml', data: styles }, { name: 'word/_rels/document.xml.rels', data: `<Relationships xmlns="${REL}"><Relationship Id="s" Type="${OFFICE}/styles" Target="styles.xml"/></Relationships>` }] : []),
  ]);
}
async function preview(bytes) {
  const [bridge, envelope] = await modules;
  const report = bridge.buildDocxContentPreviewFromZipBytes(bytes);
  assert.equal(report.ok, true, JSON.stringify(report));
  const plan = bridge.buildDocxImportPreviewPlanFromContentPreview(report);
  assert.equal(plan.ok, true, JSON.stringify(plan));
  const parsed = envelope.parseObservablePayload(plan.candidateCreatePlan.entries[0].content);
  return { report, plan, doc: parsed.doc };
}
function profile(doc) {
  const result = [];
  const visit = node => {
    if (node.type === 'text') for (const ch of node.text) result.push({ ch, color: node.marks?.find(m => m.type === 'textStyle')?.attrs?.color ?? null, highlight: node.marks?.find(m => m.type === 'highlight')?.attrs?.color ?? null });
    else for (const child of node.content || []) visit(child);
  };
  if (doc) visit(doc);
  return result;
}
async function exportDoc(doc) {
  const [, , docxPageSetupBindModule, semanticMappingModule, styleMapModule] = await modules;
  return buildDocxMinBuffer({ doc, bookProfile: { formatId: 'A4' } }, { docxPageSetupBindModule, semanticMappingModule, styleMapModule });
}
const text = (value, color, highlight) => ({ type: 'text', text: value, marks: [
  ...(color ? [{ type: 'textStyle', attrs: { color } }] : []), ...(highlight ? [{ type: 'highlight', attrs: { color: highlight } }] : []),
] });

test('C1 colors: foreground, native and arbitrary highlight preserve plain neighbors and existing marks', async () => {
  const doc = { type: 'doc', content: [{ type: 'paragraph', content: [text('R', '#c12345'), text('plain'), text('H', null, '#12ab56'), { ...text('B', '#1255aa', '#ffff00'), marks: [...text('', '#1255aa', '#ffff00').marks, { type: 'bold' }] }] }] };
  const { doc: returned, plan } = await preview(await exportDoc(doc));
  assert.deepEqual(profile(returned), profile(doc));
  assert.ok(returned.content[0].content.at(-1).marks.some(m => m.type === 'bold'));
  assert.match(plan.lossReport.items.find(i => i.category === 'formatting').message, /RGB/);
});

test('C1 colors: all sixteen native Word palette values use Office RGB instead of CSS names', async () => {
  const expected = [['black','000000'],['blue','0000ff'],['cyan','00ffff'],['darkBlue','000080'],['darkCyan','008080'],['darkGray','808080'],['darkGreen','008000'],['darkMagenta','800080'],['darkRed','800000'],['darkYellow','808000'],['green','00ff00'],['lightGray','c0c0c0'],['magenta','ff00ff'],['red','ff0000'],['white','ffffff'],['yellow','ffff00']];
  const { doc } = await preview(pack('<w:p>' + expected.map((v,i) => run(String.fromCharCode(65+i), `<w:highlight w:val="${v[0]}"/>`)).join('') + '</w:p>'));
  assert.deepEqual(profile(doc).map(p => p.highlight), expected.map(v => '#'+v[1]));
  const writer = require('../../src/export/docx/docxInlineColors.js');
  const reader = await import('../../src/io/revisionBridge/reviewTransportPackageParserV2.mjs');
  assert.deepEqual(writer.WORD_HIGHLIGHT_COLOR_BY_NAME, reader.WORD_HIGHLIGHT_COLOR_BY_NAME);
});

test('C1 colors: review exporter and return scanner retain the same palette and arbitrary RGB', async () => {
  const { buildDocxReviewPacketBuffer } = require('../../src/export/docx/docxReviewPacketBuilder.js');
  const { extractReviewTransportFormattingRunsV2 } = await import('../../src/io/revisionBridge/reviewTransportPackageParserV2.mjs');
  const colors = ['#000000', '#0000ff', '#00ffff', '#000080', '#008080', '#808080',
    '#008000', '#800080', '#800000', '#808000', '#00ff00', '#c0c0c0',
    '#ff00ff', '#ff0000', '#ffffff', '#ffff00', '#123456'];
  const runs = colors.map((color, index) => ({
    from: index, to: index + 1, text: String.fromCharCode(65 + index),
    inline: { color, highlight: colors[(index + 5) % colors.length] },
  }));
  const bytes = buildDocxReviewPacketBuffer({ blocks: [{
    blockId: 'color-control', text: runs.map(run => run.text).join(''),
    formatIr: { schemaVersion: 'yalken.rtk.format-ir.v1', paragraph: {}, runs },
  }], customProperties: [
    { name: 'YRTK_C01_AUTH', value: 'YRTK1.synthetic-colors' },
    { name: 'YRTK2_TOKEN', value: 'YRTK2.synthetic-colors' },
  ] });
  let documentXml;
  for (let offset = 0; offset + 30 <= bytes.length && bytes.readUInt32LE(offset) === 0x04034b50;) {
    const nameLength = bytes.readUInt16LE(offset + 26);
    const start = offset + 30 + nameLength + bytes.readUInt16LE(offset + 28);
    const end = start + bytes.readUInt32LE(offset + 18);
    if (bytes.subarray(offset + 30, offset + 30 + nameLength).toString() === 'word/document.xml') {
      assert.equal(bytes.readUInt16LE(offset + 8), 0);
      documentXml = bytes.subarray(start, end).toString();
    }
    offset = end;
  }
  assert.ok(documentXml);
  const hash = value => require('node:crypto').createHash('sha256').update(String(value)).digest('hex');
  const result = extractReviewTransportFormattingRunsV2(documentXml, { cryptoPort: {
    sha256Text: hash, sha256Json: value => 'sha256:' + hash(JSON.stringify(value)),
    byteLength: value => Buffer.byteLength(String(value)),
  } });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.deepEqual(result.paragraphs[0].formattedRuns.map(run => ({
    color: run.inline.color?.value, highlight: run.inline.highlight?.value,
    invalid: run.invalidSupportedValue,
  })), runs.map(run => ({ ...run.inline, invalid: false })));
});

test('C1 colors: defaults, basedOn, paragraph and character color cascade uses assignment and explicit auto', async () => {
  const styles = stylesXml('<w:docDefaults><w:rPrDefault><w:rPr><w:color w:val="112233"/></w:rPr></w:rPrDefault></w:docDefaults><w:style w:type="paragraph" w:styleId="Base"><w:rPr><w:color w:val="223344"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Body"><w:basedOn w:val="Base"/><w:rPr><w:color w:val="334455"/></w:rPr></w:style><w:style w:type="character" w:styleId="Char"><w:rPr><w:color w:val="445566"/></w:rPr></w:style>');
  const { doc } = await preview(pack('<w:p>'+run('a')+'</w:p><w:p><w:pPr><w:pStyle w:val="Body"/></w:pPr>'+run('b')+run('c','<w:rStyle w:val="Char"/>')+run('d','<w:rStyle w:val="Char"/><w:color w:val="556677"/>')+run('e','<w:color w:val="auto"/>')+'</w:p>', styles));
  assert.deepEqual(profile(doc).map(p => p.color), ['#112233','#334455','#445566','#556677',null]);
});

test('C1 colors: highlight outranks shading; clearing highlight reveals shading and nil clears shading', async () => {
  const styles = stylesXml('<w:style w:type="paragraph" w:styleId="Body"><w:rPr><w:highlight w:val="yellow"/><w:shd w:val="clear" w:fill="123456"/></w:rPr></w:style>');
  const { doc } = await preview(pack('<w:p><w:pPr><w:pStyle w:val="Body"/></w:pPr>'+run('a','<w:shd w:val="clear" w:fill="ABCDEF"/>')+run('b','<w:highlight w:val="none"/>')+run('c','<w:highlight w:val="none"/><w:shd w:val="nil"/>')+'</w:p>', styles));
  assert.deepEqual(profile(doc).map(p => p.highlight), ['#ffff00','#123456',null]);
});

test('C1 colors: effective themes and patterned shading are explicit losses; direct override removes that loss', async () => {
  const styles = stylesXml('<w:style w:type="paragraph" w:styleId="Body"><w:rPr><w:color w:val="000000" w:themeColor="accent1"/></w:rPr></w:style>');
  const unresolved = await preview(pack('<w:p><w:pPr><w:pStyle w:val="Body"/></w:pPr>'+run('x')+'</w:p><w:p>'+run('y','<w:shd w:val="pct20" w:fill="112233"/>')+'</w:p>', styles));
  assert.equal(unresolved.plan.lossReport.items.filter(i => i.code === 'DOCX_IMPORT_PREVIEW_COLOR_NOT_IMPORTED').length, 2);
  const direct = await preview(pack('<w:p><w:pPr><w:pStyle w:val="Body"/></w:pPr>'+run('x','<w:color w:val="ABCDEF"/>')+'</w:p>', styles));
  assert.equal(direct.plan.lossReport.items.some(i => i.code === 'DOCX_IMPORT_PREVIEW_COLOR_NOT_IMPORTED'), false);
  assert.equal(profile(direct.doc)[0].color, '#abcdef');
});

test('C1 colors: malformed, unbound and foreign-namespace properties never create trusted colors', async () => {
  const [bridge] = await modules;
  for (const pr of ['<w:color w:val="red"/>','<w:color/>','<w:color w:val="FFF"/>','<w:highlight w:val="constructor"/>','<w:shd w:val="clear" w:fill="url(x)"/>','<w:color w:val="000000" w:themeTint="ZZ"/>','<w:color xmlns:w="urn:foreign" w:val="112233"/>']) {
    assert.equal(bridge.buildDocxContentPreviewFromZipBytes(pack('<w:p>'+run('x',pr)+'</w:p>')).ok,false,pr);
  }
  const aliased = await preview(pack('<w:p><w:r><w:rPr><x:color xmlns:x="'+W+'" x:val="AaBbCc"/></w:rPr><w:t>x</w:t></w:r></w:p>'));
  assert.equal(profile(aliased.doc)[0].color,'#aabbcc');
});

test('C1 colors: forged preview fields and text mismatch are rejected before canonical construction', async () => {
  const [bridge] = await modules;
  const { report } = await preview(pack('<w:p>'+run('x','<w:color w:val="123456"/>')+'</w:p>'));
  for (const patch of [{color:null},{color:'red'},{color:'#ABCDEF'},{color:{value:'#123456'}},{highlight:'url(file:///tmp/x)'},{path:'/tmp/x'},{text:'forged'}]) {
    const forged=structuredClone(report);Object.assign(forged.contentPreview.paragraphs[0].inlineRuns[0],patch);
    assert.equal(bridge.buildDocxImportPreviewPlanFromContentPreview(forged).ok,false,JSON.stringify(patch));
  }
});

test('C1 colors: supported source CSS RGB forms normalize; invalid or conflicting source colors fail closed', async () => {
  const good = { type:'doc',content:[{type:'paragraph',content:[text('a','#abc'),text('b','rgb(1, 2, 255)')]}]};
  assert.deepEqual(profile((await preview(await exportDoc(good))).doc).map(p=>p.color),['#aabbcc','#0102ff']);
  for (const value of ['rgba(1,2,3,0.5)','rgb(256,0,0)','url(https://example.invalid)','red']) {
    await assert.rejects(exportDoc({type:'doc',content:[{type:'paragraph',content:[text('x',value)]}]}),/DOCX_COLOR_RGB_INVALID/);
  }
  await assert.rejects(exportDoc({type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'x',marks:[...text('','#112233').marks,...text('','#223344').marks]}]}]}),/DOCX_COLOR_MARK_CONFLICT/);
});

test('C1 colors: existing lists, heading levels and empty paragraphs retain colored content structure', async () => {
  const doc={type:'doc',content:[{type:'heading',attrs:{level:2},content:[text('Title','#123456')]},{type:'paragraph',content:[]},{type:'orderedList',attrs:{start:7},content:[{type:'listItem',content:[{type:'paragraph',content:[text('Item',null,'#008000')]}]}]}]};
  const returned=(await preview(await exportDoc(doc))).doc;
  assert.deepEqual(profile(returned),profile(doc));assert.equal(returned.content[0].attrs.level,2);assert.deepEqual(returned.content[1].content,[]);assert.equal(returned.content[2].attrs.start,7);
});

test('C1 colors: actual preview admission, persistence and repeat preserve marks without creating a second scene', async t => {
  const bytes=await exportDoc({type:'doc',content:[{type:'paragraph',content:[text('Color','#123456','#00ff00')]}]});
  const response=await createDocxImportLocalFilePreview({}, {pickLocalFile:async()=>({path:'/tmp/synthetic-colors.docx'}),readLocalFileBytes:async()=>bytes});
  assert.equal(response.ok,true,JSON.stringify(response));const plan=response.docxImportPreviewPlan;
  assert.match(rememberDocxImportPreviewPlanAdmission(plan),/^[a-f0-9]{64}$/);
  const projectRoot=fs.mkdtempSync(path.join(os.tmpdir(),'docx-color-contract-'));t.after(()=>fs.rmSync(projectRoot,{recursive:true,force:true}));
  const options={projectRoot,romanRoot:path.join(projectRoot,'roman'),projectId:'colors'};
  const first=await applyDocxImportSafeCreate({docxImportPreviewPlan:plan},options);assert.equal(first.ok,true,JSON.stringify(first));
  const repeat=await applyDocxImportSafeCreate({docxImportPreviewPlan:plan},options);assert.equal(repeat.ok,true);
  const dir=path.join(options.romanRoot,'Imported');assert.equal(fs.readdirSync(dir).length,1);
  assert.equal(fs.readFileSync(path.join(dir,fs.readdirSync(dir)[0]),'utf8'),plan.candidateCreatePlan.entries[0].content);
});

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
    if (node.type === 'text') for (const ch of node.text) {
      const a = node.marks?.find(m => m.type === 'textStyle')?.attrs || {};
      result.push({ ch, fontFamily: a.fontFamily ?? null, fontSize: a.fontSize ?? null });
    } else for (const child of node.content || []) visit(child);
  };
  if (doc) visit(doc);
  return result;
}
async function exportDoc(doc) {
  const [, , docxPageSetupBindModule, semanticMappingModule, styleMapModule] = await modules;
  return buildDocxMinBuffer({ doc, bookProfile: { formatId: 'A4' } }, { docxPageSetupBindModule, semanticMappingModule, styleMapModule });
}
const text = (value, fontFamily, fontSize) => ({ type: 'text', text: value,
  ...(fontFamily || fontSize ? { marks: [{type:'textStyle',attrs:{...(fontFamily ? {fontFamily}:{}),...(fontSize ? {fontSize}:{})}}] } : {}),
});
const fonts = family => `<w:rFonts w:ascii="${family}" w:hAnsi="${family}" w:eastAsia="${family}" w:cs="${family}"/>`;
const size = half => `<w:sz w:val="${half}"/><w:szCs w:val="${half}"/>`;
const document = content => ({type:'doc',content:[{type:'paragraph',content}]});
const hasFontLoss = plan => plan.lossReport.items.some(i=>i.code==='DOCX_IMPORT_PREVIEW_TYPOGRAPHY_NOT_IMPORTED');

test('C1 typography: export and import preserve named fonts, sizes, colors, marks and plain neighbors', async () => {
  const styled = text('Шрифт Font', 'Georgia', '18pt');
  styled.marks[0].attrs.color = '#123456';
  styled.marks.push({type:'bold'}, {type:'highlight',attrs:{color:'#ffff00'}});
  const doc = document([styled, text(' plain'), text('fixed', 'Courier New', '13.5pt')]);
  const {doc: returned, plan} = await preview(await exportDoc(doc));
  assert.deepEqual(profile(returned), profile(doc));
  assert.equal(returned.content[0].content[0].marks.filter(m=>m.type==='textStyle').length,1);
  assert.equal(returned.content[0].content[0].marks.find(m=>m.type==='textStyle').attrs.color,'#123456');
  assert.ok(returned.content[0].content[0].marks.some(m=>m.type==='bold'));
  assert.equal(hasFontLoss(plan),false);
  assert.match(plan.lossReport.items.find(i=>i.category==='formatting').message,/Uniform literal fonts/);
});

test('C1 typography: actual editor extension schema retains document fonts alongside existing colors', async () => {
  const {getSchema} = require('@tiptap/core');
  const {DocumentTextStyle} = await import('../../src/renderer/tiptap/documentTextStyle.mjs');
  const schema = getSchema([require('@tiptap/starter-kit').default, DocumentTextStyle, require('@tiptap/extension-color').default]);
  const doc = document([text('Font','Times New Roman','12pt'),text(' plain')]);
  doc.content[0].content[0].marks[0].attrs.color='#123456';
  const returned = schema.nodeFromJSON(doc).toJSON();
  assert.deepEqual(profile(returned),profile(doc));
  assert.equal(returned.content[0].content[0].marks[0].attrs.color,'#123456');
});

test('C1 typography: per-slot defaults, basedOn, paragraph, character and direct cascade uses assignment', async () => {
  const styles=stylesXml('<w:docDefaults><w:rPrDefault><w:rPr>'+fonts('Georgia')+size(24)+'</w:rPr></w:rPrDefault></w:docDefaults>'
    +'<w:style w:type="paragraph" w:styleId="Base"><w:rPr>'+fonts('Courier New')+'</w:rPr></w:style>'
    +'<w:style w:type="paragraph" w:styleId="Body"><w:basedOn w:val="Base"/><w:rPr>'+size(30)+'</w:rPr></w:style>'
    +'<w:style w:type="character" w:styleId="Char"><w:rPr>'+fonts('Times New Roman')+'</w:rPr></w:style>');
  const {doc,plan}=await preview(pack('<w:p>'+run('a')+'</w:p><w:p><w:pPr><w:pStyle w:val="Body"/></w:pPr>'
    +run('b')+run('c','<w:rStyle w:val="Char"/>')+run('d',fonts('Georgia')+size(36))
    +run('e','<w:rFonts w:ascii="Courier New"/><w:sz w:val="30"/>')+'</w:p>',styles));
  assert.deepEqual(profile(doc).map(p=>[p.fontFamily,p.fontSize]),[['Georgia','12pt'],['Courier New','15pt'],['Times New Roman','15pt'],['Georgia','18pt'],['Courier New','15pt']]);
  assert.equal(hasFontLoss(plan),false);
});

test('C1 typography: themes, partial slots and differing script sizes are declared losses, never guessed', async () => {
  for(const properties of ['<w:rFonts w:ascii="Georgia"/>',fonts('Georgia').replace('w:cs="Georgia"','w:cs="Arial"'),
    fonts('Georgia').replace('/>',' w:cstheme="minorBidi"/>'),'<w:sz w:val="24"/>',size(24).replace('szCs w:val="24"','szCs w:val="36"')]) {
    const {plan}=await preview(pack('<w:p>'+run('x',properties)+'</w:p>'));
    assert.equal(hasFontLoss(plan),true,properties);
  }
  const styles=stylesXml('<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:asciiTheme="minorHAnsi" w:hAnsiTheme="minorHAnsi" w:eastAsiaTheme="minorEastAsia" w:cstheme="minorBidi"/></w:rPr></w:rPrDefault></w:docDefaults>');
  const {doc,plan}=await preview(pack('<w:p>'+run('x',fonts('Georgia'))+'</w:p>',styles));
  assert.equal(profile(doc)[0].fontFamily,'Georgia');assert.equal(hasFontLoss(plan),false);
});

test('C1 typography: source px and quoted names normalize exactly; no silent fractional rounding', async () => {
  const {normalizeFontFamily}=await import('../../src/io/inlineTypography.mjs');
  for(const value of ['Georgia',' Georgia ', '" Georgia "', "' Times New Roman '"]) {
    const normalized=normalizeFontFamily(value);
    assert.equal(normalizeFontFamily(normalized),normalized);
    assert.equal(normalized, value.includes('Times') ? 'Times New Roman' : 'Georgia');
  }
  const {doc}=await preview(await exportDoc(document([text('a','"Times New Roman"','16px'),text('b','Georgia','18px'),text('c',null,'1pt'),text('d',null,'1638pt')])));
  assert.deepEqual(profile(doc).map(p=>[p.fontFamily,p.fontSize]),[['Times New Roman','12pt'],['Georgia','13.5pt'],[null,'1pt'],[null,'1638pt']]);
  for(const value of ['15px','12.25pt','0pt','1638.5pt','NaNpt','1e2pt',12,false,{},'12pt; color:red']) {
    const invalid=document([text('x','Georgia','12pt')]);invalid.content[0].content[0].marks[0].attrs.fontSize=value;
    await assert.rejects(exportDoc(invalid),/DOCX_FONT_SIZE/);
  }
});

test('C1 typography: malformed and injected font names are blocked before CSS or XML interpretation', async () => {
  for(const value of ['Georgia; color:red','url(https://example.invalid)','Arial, serif','serif','inherit','a\\b','a\nb','x'.repeat(129),false,{},1]) {
    const invalid=document([text('x','Georgia','12pt')]);invalid.content[0].content[0].marks[0].attrs.fontFamily=value;
    await assert.rejects(exportDoc(invalid),/DOCX_FONT_FAMILY_INVALID/);
  }
  const duplicate=text('x','Georgia');duplicate.marks.push({type:'textStyle',attrs:{fontFamily:'Arial'}});
  await assert.rejects(exportDoc(document([duplicate])),/DOCX_FONT_MARK_CONFLICT/);
});

test('C1 typography: null font attributes remain plain while invalid raw values and spoofed namespaces are blocked', async () => {
  const [bridge]=await modules;
  for(const pr of ['<w:sz w:val="1"/>','<w:sz w:val="3277"/>','<w:sz w:val="24.5"/>','<w:sz/>','<w:rFonts w:ascii="url(x)"/>',
    '<w:rFonts xmlns:w="urn:foreign" w:ascii="Georgia"/>','<w:sz xmlns:w="urn:foreign" w:val="24"/>']) {
    assert.equal(bridge.buildDocxContentPreviewFromZipBytes(pack('<w:p>'+run('x',pr)+'</w:p>')).ok,false,pr);
  }
  const aliases=(fonts('Georgia')+size(24)).replaceAll('w:','x:').replaceAll('/>',' xmlns:x="'+W+'"/>');
  assert.equal(profile((await preview(pack('<w:p>'+run('x',aliases)+'</w:p>'))).doc)[0].fontFamily,'Georgia');
  const plain=text('plain');plain.marks=[{type:'textStyle',attrs:{fontFamily:null,fontSize:null}}];
  assert.deepEqual(await exportDoc(document([plain])),await exportDoc(document([text('plain')])));
});

test('C1 typography: forged projection fields and text binding are rejected before canonical construction', async () => {
  const [bridge]=await modules;
  const {report}=await preview(await exportDoc(document([text('x','Georgia','12pt')])));
  for(const patch of [{fontFamily:null},{fontFamily:'"Georgia"'},{fontFamily:'Georgia; color:red'},{fontSize:12},{fontSize:'16px'},{fontSize:'12.25pt'},{text:'forged'},{fontPath:'/tmp/x'}]) {
    const forged=structuredClone(report);Object.assign(forged.contentPreview.paragraphs[0].inlineRuns[0],patch);
    assert.equal(bridge.buildDocxImportPreviewPlanFromContentPreview(forged).ok,false,JSON.stringify(patch));
  }
});

test('C1 typography: review writer uses the same exact font representation and rejects inexact size', async () => {
  const {buildDocxReviewPacketBuffer}=require('../../src/export/docx/docxReviewPacketBuilder.js');
  const data={blocks:[{blockId:'font',text:'Font',formatIr:{schemaVersion:'yalken.rtk.format-ir.v1',paragraph:{},runs:[{from:0,to:4,text:'Font',inline:{fontFamily:'Georgia',fontSize:'18px'}}]}}],
    customProperties:[{name:'YRTK_C01_AUTH',value:'YRTK1.synthetic-font'},{name:'YRTK2_TOKEN',value:'YRTK2.synthetic-font'}]};
  const {doc}=await preview(buildDocxReviewPacketBuffer(data));
  assert.deepEqual(profile(doc),profile(document([text('Font','Georgia','13.5pt')])));
  data.blocks[0].formatIr.runs[0].inline.fontSize='15px';
  assert.throws(()=>buildDocxReviewPacketBuffer(data),/DOCX_FONT_SIZE_NOT_HALF_POINT_EXACT/);
});

test('C1 typography: list structure and heading font overrides survive without flattening', async () => {
  const doc={type:'doc',content:[{type:'heading',attrs:{level:2},content:[text('Heading','Georgia','18pt')]},{type:'orderedList',attrs:{start:7},content:[{type:'listItem',content:[{type:'paragraph',content:[text('Item','Courier New','12pt')]}]}]}]};
  const returned=(await preview(await exportDoc(doc))).doc;
  assert.deepEqual(profile(returned),profile(doc));assert.equal(returned.content[0].attrs.level,2);assert.equal(returned.content[1].attrs.start,7);
});

test('C1 typography: admitted create persists fonts and repeat does not create another scene', async t => {
  const input=document([text('Font','Georgia','18pt'),text(' plain')]);
  const bytes=await exportDoc(input);
  const response=await createDocxImportLocalFilePreview({}, {pickLocalFile:async()=>({path:'/tmp/synthetic-font.docx'}),readLocalFileBytes:async()=>bytes});
  assert.equal(response.ok,true,JSON.stringify(response));const plan=response.docxImportPreviewPlan;
  assert.match(rememberDocxImportPreviewPlanAdmission(plan),/^[a-f0-9]{64}$/);
  const projectRoot=fs.mkdtempSync(path.join(os.tmpdir(),'docx-font-contract-'));t.after(()=>fs.rmSync(projectRoot,{recursive:true,force:true}));
  const options={projectRoot,romanRoot:path.join(projectRoot,'roman'),projectId:'fonts'};
  const first=await applyDocxImportSafeCreate({docxImportPreviewPlan:plan},options);assert.equal(first.ok,true,JSON.stringify(first));
  const second=await applyDocxImportSafeCreate({docxImportPreviewPlan:plan},options);assert.equal(second.ok,true);
  const [,envelope]=await modules;
  const receipt=first.docxImportApplyReceipt;
  const files=fs.readdirSync(options.romanRoot,{recursive:true}).filter(f=>String(f).endsWith('.txt'));
  assert.equal(files.length,1,JSON.stringify({receipt,files}));
  const saved=envelope.parseObservablePayload(fs.readFileSync(path.join(options.romanRoot,files[0]),'utf8')).doc;
  assert.deepEqual(profile(saved),profile(input));
});

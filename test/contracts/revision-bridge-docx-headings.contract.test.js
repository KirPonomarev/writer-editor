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
function heading(level,text='title') { return {type:'heading',attrs:{level},content:text?[{type:'text',text}]:[]}; }
async function roundtrip(doc) {
  const [,envelope,docxPageSetupBindModule,semanticMappingModule,styleMapModule]=await modules;
  const bytes=buildDocxMinBuffer({doc,bookProfile:{formatId:'A4'}},{docxPageSetupBindModule,semanticMappingModule,styleMapModule});
  const result=await planFrom(bytes);return {...result,bytes,doc:envelope.parseObservablePayload(result.plan.candidateCreatePlan.entries[0].content).doc};
}
async function levels(body,styles='') {
  const {plan}=await planFrom(packageBytes(body,styles));const [,envelope]=await modules;
  return envelope.parseObservablePayload(plan.candidateCreatePlan.entries[0].content).doc?.content.map(p=>p.type==='heading'?p.attrs.level:0) || null;
}
test('C1 headings: all six levels, empty heading, body and inline marks survive export/import',async()=>{
  const input={type:'doc',content:[...Array.from({length:6},(_,i)=>heading(i+1,'Уровень '+(i+1)+' Ω')),
    heading(2,''),{type:'paragraph',content:[]},{type:'paragraph',content:[{type:'text',text:'body',marks:[{type:'bold'}]}]}]};
  const {doc,plan}=await roundtrip(input);assert.deepEqual(doc,input);
  assert.equal(plan.lossReport.mode,'headings-and-inline-marks');assert.match(plan.lossReport.items.find(i=>i.code==='DOCX_IMPORT_PREVIEW_HEADINGS_AND_INLINE_MARKS').message,/fonts/);
});
test('C1 headings: custom and localized style ids inherit outline independently of names',async()=>{
 const styles=styleXml('<w:style w:type="paragraph" w:styleId="Base"><w:pPr><w:outlineLvl w:val="2"/></w:pPr></w:style><w:style w:type="paragraph" w:styleId="Глава"><w:basedOn w:val="Base"/></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/></w:style>');
 assert.deepEqual(await levels('<w:p><w:pPr><w:pStyle w:val="Глава"/></w:pPr>'+r('a')+'</w:p><w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr>'+r('b')+'</w:p>',styles),[3,0]);
});
test('C1 headings: direct level overrides inheritance and level 9 clears it, including empty paragraphs',async()=>{
 const styles=styleXml('<w:style w:type="paragraph" w:default="1" w:styleId="Base"><w:pPr><w:outlineLvl w:val="1"/></w:pPr></w:style>');
 assert.deepEqual(await levels('<w:p/><w:p><w:pPr><w:outlineLvl w:val="5"/></w:pPr>'+r('six')+'</w:p><w:p><w:pPr><w:outlineLvl w:val="9"/></w:pPr>'+r('body')+'</w:p>',styles),[2,6,0]);
});
test('C1 headings: document paragraph defaults and derived body reset follow the cascade',async()=>{
 const styles=styleXml('<w:docDefaults><w:pPrDefault><w:pPr><w:outlineLvl w:val="0"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:styleId="Body"><w:pPr><w:outlineLvl w:val="9"/></w:pPr></w:style>');
 assert.deepEqual(await levels('<w:p>'+r('default')+'</w:p><w:p><w:pPr><w:pStyle w:val="Body"/></w:pPr>'+r('body')+'</w:p>',styles),[1,0]);
});
test('C1 headings: character styles and previous paragraph properties cannot create headings',async()=>{
 const styles=styleXml('<w:style w:type="character" w:styleId="NotParagraph"><w:pPr><w:outlineLvl w:val="0"/></w:pPr></w:style>');
 assert.equal(await levels('<w:p><w:pPr><w:pStyle w:val="NotParagraph"/><w:pPrChange><w:pPr><w:outlineLvl w:val="1"/></w:pPr></w:pPrChange></w:pPr>'+r('body')+'</w:p>',styles),null);
});
test('C1 headings: namespace aliases preserve semantics and spoofed outline namespace blocks',async()=>{
 const [bridge,envelope]=await modules;const {plan}=await planFrom(packageBytes('<x:p><x:pPr><x:outlineLvl x:val="+01"/></x:pPr><x:r><x:t>h</x:t></x:r></x:p>','','x'));
 assert.equal(envelope.parseObservablePayload(plan.candidateCreatePlan.entries[0].content).doc.content[0].attrs.level,2);
 assert.equal(bridge.buildDocxContentPreviewFromZipBytes(packageBytes('<w:p><w:pPr><w:outlineLvl xmlns:w="urn:foreign" w:val="0"/></w:pPr>'+r('h')+'</w:p>')).ok,false);
});
test('C1 headings: malformed and unrepresentable outline values fail without a successful plan',async()=>{
 const [bridge]=await modules;
 for(const value of ['', '1.5','-1','10','NaN','6','7','8']) {
   const report=bridge.buildDocxContentPreviewFromZipBytes(packageBytes('<w:p><w:pPr><w:outlineLvl w:val="'+value+'"/></w:pPr>'+r('h')+'</w:p>'));
   assert.equal(report.ok,false,value);assert.match(JSON.stringify(report),/DOCX_(?:OUTLINE_LEVEL_INVALID|HEADING_LEVEL_UNSUPPORTED)/);
 }
});
test('C1 headings: used style cycles are rejected even for empty headings',async()=>{
 const [bridge]=await modules;const styles=styleXml('<w:style w:type="paragraph" w:styleId="loop"><w:basedOn w:val="loop"/><w:pPr><w:outlineLvl w:val="0"/></w:pPr></w:style>');
 assert.equal(bridge.buildDocxContentPreviewFromZipBytes(packageBytes('<w:p><w:pPr><w:pStyle w:val="loop"/></w:pPr></w:p>',styles)).ok,false);
});
test('C1 headings: forged heading levels are rejected before canonical serialization',async()=>{
 const [bridge]=await modules;const {report}=await roundtrip({type:'doc',content:[heading(1)]});
 for(const level of [0,7,'1',null,{},1.5]) {
  const bad=structuredClone(report);bad.contentPreview.paragraphs[0].headingLevel=level;
  assert.equal(bridge.buildDocxImportPreviewPlanFromContentPreview(bad).ok,false,JSON.stringify(level));
 }
});
test('C1 headings: invalid source levels cannot silently export body text',async()=>{
 for(const level of [0,7,NaN]) await assert.rejects(roundtrip({type:'doc',content:[heading(level)]}),/DOCX_HEADING_LEVEL_INVALID/);
});
test('C1 headings: local picker preserves heading content through admitted atomic creation',async t=>{
 const [,envelope]=await modules;const {bytes}=await roundtrip({type:'doc',content:[heading(4)]});
 const result=await createDocxImportLocalFilePreview({}, {pickLocalFile:async()=>({path:'/tmp/synthetic-headings.docx'}),readLocalFileBytes:async()=>bytes});
 assert.equal(result.ok,true,JSON.stringify(result));const plan=result.docxImportPreviewPlan;
 assert.equal(envelope.parseObservablePayload(plan.candidateCreatePlan.entries[0].content).doc.content[0].attrs.level,4);
 assert.match(rememberDocxImportPreviewPlanAdmission(plan),/^[a-f0-9]{64}$/);
 const projectRoot=fs.mkdtempSync(path.join(os.tmpdir(),'docx-headings-test-'));t.after(()=>fs.rmSync(projectRoot,{recursive:true,force:true}));
 const options={projectRoot,romanRoot:path.join(projectRoot,'roman'),projectId:'headings-test'};
 const applied=await applyDocxImportSafeCreate({docxImportPreviewPlan:plan},options);assert.equal(applied.ok,true,JSON.stringify(applied));
 const dir=path.join(options.romanRoot,'Imported');assert.equal(fs.readdirSync(dir).length,1);
 assert.equal(fs.readFileSync(path.join(dir,fs.readdirSync(dir)[0]),'utf8'),plan.candidateCreatePlan.entries[0].content);
 const repeat=await applyDocxImportSafeCreate({docxImportPreviewPlan:plan},options);assert.equal(repeat.ok,true,JSON.stringify(repeat));assert.equal(fs.readdirSync(dir).length,1);
});
test('C1 headings: main-owned plan and local picker preserve identical candidate bytes',async()=>{
 const {report,bytes}=await roundtrip({type:'doc',content:[heading(3),heading(6,'')]});
 const main=fs.readFileSync(path.join(__dirname,'../../src/main.js'),'utf8');const start=main.indexOf('function copyDocxImportPreviewAllowedFields(');const end=main.indexOf('function validateDocxImportPreviewPayload(',start);assert.ok(start>0&&end>start);
 const projected=require('node:vm').runInNewContext(main.slice(start,end)+'\ncanonicalizeDocxImportPreviewSourceReport(report);',{report,isPlainObjectValue:v=>Boolean(v&&typeof v==='object'&&!Array.isArray(v)),cloneJsonSafe:v=>JSON.parse(JSON.stringify(v))});
 const [bridge]=await modules;const plan=bridge.buildDocxImportPreviewPlanFromContentPreview(JSON.parse(JSON.stringify(projected)));assert.equal(plan.ok,true,JSON.stringify(plan));
 const local=await createDocxImportLocalFilePreview({}, {pickLocalFile:async()=>({path:'/tmp/synthetic-headings.docx'}),readLocalFileBytes:async()=>bytes});assert.equal(local.ok,true,JSON.stringify(local));
 assert.equal(plan.lossReport.mode,'headings-and-inline-marks');assert.equal(plan.candidateCreatePlan.entries[0].content,local.docxImportPreviewPlan.candidateCreatePlan.entries[0].content);
 assert.equal(plan.candidateCreatePlan.entries[0].candidateContentSha256,local.docxImportPreviewPlan.candidateCreatePlan.entries[0].candidateContentSha256);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buildDocxMinBuffer, buildStoredZip } = require('../../src/export/docx/docxMinBuilder.js');
const { createDocxImportLocalFilePreview } = require('../../src/utils/docxImportLocalFilePreview.js');
const { applyDocxImportSafeCreate, rememberDocxImportPreviewPlanAdmission } = require('../fixtures/docx-import-real-authority.cjs');
const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const CT = 'http://schemas.openxmlformats.org/package/2006/content-types';
const REL = 'http://schemas.openxmlformats.org/package/2006/relationships';
const OFFICE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const modules = Promise.all([import('../../src/io/revisionBridge/index.mjs'), import('../../src/renderer/documentContentEnvelope.mjs'), import('../../src/docxPageSetupBind.mjs'), import('../../src/derived/semanticMapping.mjs'), import('../../src/derived/styleMap.mjs')]);
const p = (text, marks = []) => ({ type: 'paragraph', content: text ? [{ type: 'text', text, ...(marks.length ? { marks: marks.map(type => ({ type })) } : {}) }] : [] });
const li = (...content) => ({ type: 'listItem', content });
const ul = (...content) => ({ type: 'bulletList', content });
const ol = (start, ...content) => ({ type: 'orderedList', attrs: { start }, content });
const doc = (...content) => ({ type: 'doc', content });
const paragraph = (text, id = 1, level = 0, extra = '') => `<w:p><w:pPr>${extra}${id === null ? '' : `<w:numPr><w:ilvl w:val="${level}"/><w:numId w:val="${id}"/></w:numPr>`}</w:pPr><w:r><w:t>${text}</w:t></w:r></w:p>`;
const levelXml = (level, format = 'decimal', start = 1, extra = '') => `<w:lvl w:ilvl="${level}"><w:start w:val="${start}"/><w:numFmt w:val="${format}"/><w:lvlText w:val="${format === 'bullet' ? '•' : '%'+(level+1)+'.'}"/>${extra}</w:lvl>`;
const definition = (levels = levelXml(0), override = '', extra = '') => `<w:abstractNum w:abstractNumId="0">${extra}${levels}</w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/>${override}</w:num>`;
function packageBytes(body, numbering = definition(), styles = '') {
 const parts = [
  { name: '[Content_Types].xml', data: `<Types xmlns="${CT}"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>${numbering ? '<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>' : ''}${styles ? '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' : ''}</Types>` },
  { name: '_rels/.rels', data: `<Relationships xmlns="${REL}"><Relationship Id="r1" Type="${OFFICE}/officeDocument" Target="word/document.xml"/></Relationships>` },
  { name: 'word/document.xml', data: `<w:document xmlns:w="${W}"><w:body>${body}</w:body></w:document>` },
 ];
 const rels=[];
 if(numbering){parts.push({name:'word/numbering.xml',data:`<w:numbering xmlns:w="${W}">${numbering}</w:numbering>`});rels.push(`<Relationship Id="numbering" Type="${OFFICE}/numbering" Target="numbering.xml"/>`);}
 if(styles){parts.push({name:'word/styles.xml',data:`<w:styles xmlns:w="${W}">${styles}</w:styles>`});rels.push(`<Relationship Id="styles" Type="${OFFICE}/styles" Target="styles.xml"/>`);}
 if(rels.length)parts.push({name:'word/_rels/document.xml.rels',data:`<Relationships xmlns="${REL}">${rels.join('')}</Relationships>`});
 return buildStoredZip(parts);
}
async function read(bytes) {
 const [bridge,envelope]=await modules;const report=bridge.buildDocxContentPreviewFromZipBytes(bytes);
 assert.equal(report.ok,true,JSON.stringify(report));const plan=bridge.buildDocxImportPreviewPlanFromContentPreview(report);
 assert.equal(plan.ok,true,JSON.stringify(plan));return {bytes,report,plan,doc:envelope.parseObservablePayload(plan.candidateCreatePlan.entries[0].content).doc};
}
async function roundtrip(input) {
 const [,,docxPageSetupBindModule,semanticMappingModule,styleMapModule]=await modules;
 return read(buildDocxMinBuffer({doc:input,bookProfile:{formatId:'A4'}},{docxPageSetupBindModule,semanticMappingModule,styleMapModule}));
}
async function blocked(body, numbering, styles='') {
 const [bridge]=await modules;const report=bridge.buildDocxContentPreviewFromZipBytes(packageBytes(body,numbering,styles));
 assert.equal(report.ok,false,JSON.stringify(report));assert.equal(bridge.buildDocxImportPreviewPlanFromContentPreview(report).ok,false);
}

test('C1 lists: mixed nested lists, blank items, restarts and marked Unicode survive exactly',async()=>{
 const input=doc(p('before'),ul(li(p('Ω 😀',['bold'])),li(p('parent'),ol(7,li(p('seven',['italic'])),li(p('eight')))),li(p(''))),ol(3,li(p('three')),li(p('four'))),ol(1,li(p('new one'))),p('between'),ol(0,li(p('zero'))),{type:'heading',attrs:{level:4},content:[{type:'text',text:'heading'}]});
 const result=await roundtrip(input);assert.deepEqual(result.doc,input);assert.equal(result.plan.lossReport.mode,'lists-headings-and-inline-marks');
 assert.equal(result.plan.lossReport.items.some(i=>i.code==='DOCX_IMPORT_PREVIEW_LIST_NUMBERING_NOT_IMPORTED'),false);
 assert.match(result.plan.lossReport.items.find(i=>i.code==='DOCX_IMPORT_PREVIEW_LISTS_HEADINGS_AND_INLINE_MARKS').message,/appearance/);
});
test('C1 lists: separate adjacent lists with equal starts are not merged',async()=>{
 const input=doc(ol(1,li(p('a'))),ol(1,li(p('b'))),ul(li(p('c'))),ul(li(p('d'))));assert.deepEqual((await roundtrip(input)).doc,input);
});
test('C1 lists: shared Word numbering continues across body paragraphs',async()=>{
 const actual=await read(packageBytes(paragraph('a')+paragraph('b')+paragraph('body',null)+paragraph('c'),definition(levelXml(0,'decimal',5))));
 assert.deepEqual(actual.doc,doc(ol(5,li(p('a')),li(p('b'))),p('body'),ol(7,li(p('c')))));
});
test('C1 lists: Word multilevel counters restart after parent items',async()=>{
 const body=paragraph('a')+paragraph('a1',1,1)+paragraph('a2',1,1)+paragraph('b')+paragraph('b1',1,1);
 const actual=await read(packageBytes(body,definition(levelXml(0)+levelXml(1))));
 assert.deepEqual(actual.doc,doc(ol(1,li(p('a'),ol(1,li(p('a1')),li(p('a2')))),li(p('b'),ol(1,li(p('b1')))))));
});
test('C1 lists: explicit never-restart counters are preserved as nested start values',async()=>{
 const body=paragraph('a')+paragraph('a1',1,1)+paragraph('b')+paragraph('b2',1,1);
 const actual=await read(packageBytes(body,definition(levelXml(0)+levelXml(1,'decimal',1,'<w:lvlRestart w:val="0"/>'))));
 assert.deepEqual(actual.doc,doc(ol(1,li(p('a'),ol(1,li(p('a1')))),li(p('b'),ol(2,li(p('b2')))))));
});
test('C1 lists: startOverride wins over both abstract and replacement level starts',async()=>{
 const replacement=levelXml(0,'decimal',3);
 const actual=await read(packageBytes(paragraph('a')+paragraph('b'),definition(levelXml(0,'decimal',1),`<w:lvlOverride w:ilvl="0"><w:startOverride w:val="8"/>${replacement}</w:lvlOverride>`)));
 assert.deepEqual(actual.doc,doc(ol(8,li(p('a')),li(p('b')))));
});
test('C1 lists: explicit level override can change list kind',async()=>{
 const actual=await read(packageBytes(paragraph('a'),definition(levelXml(0),`<w:lvlOverride w:ilvl="0">${levelXml(0,'bullet')}</w:lvlOverride>`)));
 assert.deepEqual(actual.doc,doc(ul(li(p('a')))));
});
test('C1 lists: paragraph style numbering uses definition pStyle, with direct numId zero cancellation',async()=>{
 const styles='<w:style w:type="paragraph" w:styleId="Base"><w:pPr><w:numPr><w:ilvl w:val="8"/><w:numId w:val="1"/></w:numPr></w:pPr></w:style><w:style w:type="paragraph" w:styleId="Derived"><w:basedOn w:val="Base"/></w:style>';
 const body=paragraph('a',null,0,'<w:pStyle w:val="Derived"/>')+paragraph('body',0,0,'<w:pStyle w:val="Derived"/>');
 const actual=await read(packageBytes(body,definition(levelXml(0,'decimal',4,'<w:pStyle w:val="Base"/>')),styles));
 assert.deepEqual(actual.doc,doc(ol(4,li(p('a'))),p('body')));
});
test('C1 lists: historical paragraph numbering does not grant present list semantics',async()=>{
 const body=paragraph('body',null,0,'<w:pPrChange><w:pPr><w:numPr><w:numId w:val="1"/></w:numPr></w:pPr></w:pPrChange>');
 const actual=await read(packageBytes(body));assert.equal(actual.doc,null);assert.equal(actual.plan.candidateCreatePlan.entries[0].content,'body');
});
test('C1 lists: unsupported, absent and style-linked numbering retains explicit loss',async()=>{
 for(const numbering of ['',definition(levelXml(0,'upperRoman')),definition(levelXml(0),'','<w:numStyleLink w:val="Other"/>')]) {
  const actual=await read(packageBytes(paragraph('a'),numbering));assert.equal(actual.doc,null);assert.equal(actual.plan.candidateCreatePlan.entries[0].content,'a');assert.ok(actual.plan.lossReport.items.some(i=>i.code==='DOCX_IMPORT_PREVIEW_LIST_NUMBERING_NOT_IMPORTED'));
 }
});
test('C1 lists: numbered headings preserve heading and declare unsupported list structure',async()=>{
 const actual=await read(packageBytes(paragraph('h',1,0,'<w:outlineLvl w:val="0"/>')));
 assert.equal(actual.doc.content[0].type,'heading');assert.ok(actual.plan.lossReport.items.some(i=>i.code==='DOCX_IMPORT_PREVIEW_LIST_NUMBERING_NOT_IMPORTED'));
});
test('C1 lists: nine nested levels survive; the tenth fails before serialization',async()=>{
 const nested=n=>n===1?ul(li(p('leaf'))):ul(li(p('parent '+n),nested(n-1)));
 const input=doc(nested(9));assert.deepEqual((await roundtrip(input)).doc,input);
 await assert.rejects(roundtrip(doc(nested(10))),/DOCX_LIST_LIMIT/);
});
test('C1 lists: unsupported source item shapes and invalid starts do not silently flatten',async()=>{
 for(const input of [doc(ul(li(p('a'),p('continued')))),doc(ul(p('not item'))),doc(ul()),doc(ol(-1,li(p('a')))),doc(ol('2',li(p('a')))),doc(ol(2147483647,li(p('a')),li(p('b'))))]) await assert.rejects(roundtrip(input),/DOCX_LIST_/);
});
test('C1 lists: invalid integers and duplicate numbering identities block',async()=>{
 for(const value of ['-1','1.5','2147483648','', 'NaN'])await blocked(paragraph('a',value),definition());
 for(const n of [definition()+definition(),definition(levelXml(0)+levelXml(0)),definition(levelXml(0),'<w:lvlOverride w:ilvl="0"><w:startOverride w:val="-1"/></w:lvlOverride>'),definition(levelXml(0),`<w:lvlOverride w:ilvl="0">${levelXml(1)}</w:lvlOverride>`)])await blocked(paragraph('a'),n);
});
test('C1 lists: foreign numbering namespaces cannot be interpreted as Word definitions',async()=>{
 await blocked(paragraph('a'),definition().replace('<w:lvl w:ilvl="0">','<w:lvl xmlns:w="urn:foreign" w:ilvl="0">'));
 await blocked(paragraph('a'),definition().replace('w:numId="1"','xmlns:x="urn:foreign" x:numId="1"'));
});
test('C1 lists: orphan nesting and forged metadata cannot produce a rich plan',async()=>{
 const [bridge]=await modules;const {report}=await roundtrip(doc(ol(1,li(p('a')))));
 for(const patch of [{level:1},{level:9},{level:'0'},{ordinal:-1},{ordinal:1.5},{numId:1},{numId:'0'},{kind:'taskList'},{authority:true}]) {
  const bad=structuredClone(report);Object.assign(bad.contentPreview.paragraphs[0].list,patch);assert.equal(bridge.buildDocxImportPreviewPlanFromContentPreview(bad).ok,false,JSON.stringify(patch));
 }
});
test('C1 lists: local picker, admitted atomic create and retry preserve canonical list bytes',async t=>{
 const input=doc(ol(7,li(p('a'),ul(li(p('b',['underline']))))));const {bytes}=await roundtrip(input);
 const local=await createDocxImportLocalFilePreview({}, {pickLocalFile:async()=>({path:'/tmp/synthetic-lists.docx'}),readLocalFileBytes:async()=>bytes});assert.equal(local.ok,true,JSON.stringify(local));
 const plan=local.docxImportPreviewPlan;const [,envelope]=await modules;assert.deepEqual(envelope.parseObservablePayload(plan.candidateCreatePlan.entries[0].content).doc,input);
 assert.match(rememberDocxImportPreviewPlanAdmission(plan),/^[a-f0-9]{64}$/);
 const projectRoot=fs.mkdtempSync(path.join(os.tmpdir(),'docx-lists-test-'));t.after(()=>fs.rmSync(projectRoot,{recursive:true,force:true}));const options={projectRoot,romanRoot:path.join(projectRoot,'roman'),projectId:'lists-test'};
 const applied=await applyDocxImportSafeCreate({docxImportPreviewPlan:plan},options);assert.equal(applied.ok,true,JSON.stringify(applied));
 const dir=path.join(options.romanRoot,'Imported');assert.equal(fs.readdirSync(dir).filter(name => name.endsWith('.txt')).length,1);assert.equal(fs.readFileSync(path.join(dir,fs.readdirSync(dir).filter(name => name.endsWith('.txt'))[0]),'utf8'),plan.candidateCreatePlan.entries[0].content);
 assert.equal((await applyDocxImportSafeCreate({docxImportPreviewPlan:plan},options)).ok,true);assert.equal(fs.readdirSync(dir).filter(name => name.endsWith('.txt')).length,1);
});
test('C1 lists: main and local projections generate identical admitted candidate bytes',async()=>{
 const {report,bytes}=await roundtrip(doc(ol(7,li(p('a')))));const main=fs.readFileSync(path.join(__dirname,'../../src/main.js'),'utf8');const start=main.indexOf('function copyDocxImportPreviewAllowedFields(');const end=main.indexOf('function validateDocxImportPreviewPayload(',start);assert.ok(start>0&&end>start);
 const projected=require('node:vm').runInNewContext(main.slice(start,end)+'\ncanonicalizeDocxImportPreviewSourceReport(report);',{report,isPlainObjectValue:v=>Boolean(v&&typeof v==='object'&&!Array.isArray(v)),cloneJsonSafe:v=>JSON.parse(JSON.stringify(v))});
 const [bridge]=await modules;const plan=bridge.buildDocxImportPreviewPlanFromContentPreview(JSON.parse(JSON.stringify(projected)));assert.equal(plan.ok,true,JSON.stringify(plan));
 const local=await createDocxImportLocalFilePreview({}, {pickLocalFile:async()=>({path:'/tmp/synthetic-lists.docx'}),readLocalFileBytes:async()=>bytes});assert.equal(local.ok,true,JSON.stringify(local));assert.equal(plan.lossReport.mode,'lists-headings-and-inline-marks');assert.equal(plan.candidateCreatePlan.entries[0].content,local.docxImportPreviewPlan.candidateCreatePlan.entries[0].content);
});
test('C1 lists: a numbered heading still consumes its ordinal before a supported item',async()=>{
 const actual=await read(packageBytes(paragraph('h',1,0,'<w:outlineLvl w:val="0"/>')+paragraph('next')));
 assert.equal(actual.doc.content[0].type,'heading');assert.deepEqual(actual.doc.content[1],ol(2,li(p('next'))));
});
test('C1 lists: nested old properties cannot overwrite the current numbering reference',async()=>{
 const body='<w:p><w:pPr><w:numPr><w:numId w:val="1"/><w:other><w:numPr><w:numId w:val="2"/></w:numPr></w:other><w:ilvl w:val="0"/></w:numPr></w:pPr><w:r><w:t>a</w:t></w:r></w:p>';
 assert.deepEqual((await read(packageBytes(body))).doc,doc(ol(1,li(p('a')))));
});
test('C1 lists: an alphabetic source numbering type is not exported as decimal',async()=>{
 const list=ol(1,li(p('a')));list.attrs.type='A';await assert.rejects(roundtrip(doc(list)),/DOCX_LIST_FORMAT_UNSUPPORTED/);
});

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
async function exportDoc(doc) {
  const [, , docxPageSetupBindModule, semanticMappingModule, styleMapModule] = await modules;
  return buildDocxMinBuffer({ doc, bookProfile: { formatId: 'A4' } }, { docxPageSetupBindModule, semanticMappingModule, styleMapModule });
}
const paragraph = (text, textAlign) => ({type:'paragraph', ...(textAlign === undefined ? {} : {attrs:{textAlign}}), content:text ? [{type:'text',text}] : []});
const document = content => ({type:'doc',content});
const flatten = node => ['paragraph','heading'].includes(node.type) ? [node] : (node.content || []).flatMap(flatten);
const profile = doc => flatten(doc).map(p=>({type:p.type,level:p.attrs?.level,textAlign:p.attrs?.textAlign??null,content:p.content||[]})).map(p=>JSON.parse(JSON.stringify(p,(key,value)=>key==='marks'?[...value].sort((a,b)=>a.type.localeCompare(b.type)):value)));
const jc = value => `<w:jc w:val="${value}"/>`;
const p = (text, properties='') => `<w:p><w:pPr>${properties}</w:pPr>${run(text)}</w:p>`;
const hasAlignmentLoss = plan => JSON.stringify(plan.lossReport).includes('DOCX_PARAGRAPH_ALIGNMENT_UNSUPPORTED');
const source = () => {
  const doc=document(['left','center','right','justify'].map((a,i)=>paragraph('Aligned '+i,a)));
  doc.content.push(paragraph('plain'),paragraph('', 'center'));
  doc.content[1].type='heading';doc.content[1].attrs.level=3;
  doc.content[2].content[0].marks=[{type:'bold'},{type:'textStyle',attrs:{fontFamily:'Georgia',fontSize:'12pt',color:'#123456'}}];
  doc.content.push({type:'orderedList',attrs:{start:4},content:[{type:'listItem',content:[paragraph('list','right')]}]});
  return doc;
};

test('C1 alignment: all four alignments survive codec, including rich headings, list items, empty paragraphs and plain neighbors', async () => {
  const input=source();const bytes=await exportDoc(input);const {doc,plan}=await preview(bytes);
  assert.deepEqual(profile(doc),profile(input));assert.equal(hasAlignmentLoss(plan),false);
  assert.ok(bytes.includes(Buffer.from('<w:jc w:val="both"/>')));assert.equal(bytes.includes(Buffer.from('w:val="justify"')),false);
  assert.match(plan.lossReport.items.find(i=>i.category==='formatting').message,/justified paragraph alignment are preserved/);
});

test('C1 alignment: implicit alignment and explicit left remain distinct in source and returned data', async()=>{
  const input=document([paragraph('implicit'),paragraph('explicit','left')]);const bytes=await exportDoc(input);
  assert.equal((bytes.toString().match(/<w:jc /g)||[]).length,1);const {doc}=await preview(bytes);
  assert.deepEqual(profile(doc).map(p=>p.textAlign),[null,'left']);
});

test('C1 alignment: default paragraph style, basedOn, document default and direct values follow precedence',async()=>{
  const styles=stylesXml('<w:docDefaults><w:pPrDefault><w:pPr>'+jc('right')+'</w:pPr></w:pPrDefault></w:docDefaults>'
    +'<w:style w:type="paragraph" w:styleId="Base"><w:pPr>'+jc('center')+'</w:pPr></w:style>'
    +'<w:style w:type="paragraph" w:styleId="Body" w:default="1"><w:basedOn w:val="Base"/></w:style>'
    +'<w:style w:type="paragraph" w:styleId="Empty"/>'
    +'<w:style w:type="paragraph" w:styleId="Unsupported"><w:pPr>'+jc('start')+'</w:pPr></w:style>');
  const {doc,plan}=await preview(pack(p('a')+p('b',jc('both'))+p('c','<w:pStyle w:val="Empty"/>')+p('d','<w:pStyle w:val="Unsupported"/>'+jc('left')),styles));
  assert.deepEqual(profile(doc).map(p=>p.textAlign),['center','justify','right','left']);assert.equal(hasAlignmentLoss(plan),false);
});

test('C1 alignment: only effective unsupported direction or distribution produces an explicit loss',async()=>{
  for(const value of ['start','end','distribute','numTab','lowKashida','mediumKashida','highKashida','thaiDistribute']){
    const {report,plan}=await preview(pack(p('unsupported',jc(value))));
    assert.equal(hasAlignmentLoss(plan),true,value);assert.equal(Object.hasOwn(report.contentPreview.paragraphs[0],'textAlign'),false);
  }
  const styles=stylesXml('<w:docDefaults><w:pPrDefault><w:pPr>'+jc('both')+'</w:pPr></w:pPrDefault></w:docDefaults>'
    +'<w:style w:type="paragraph" w:styleId="Body" w:default="1"><w:pPr>'+jc('start')+'</w:pPr></w:style>');
  const {plan}=await preview(pack(p('x'),styles));assert.equal(hasAlignmentLoss(plan),true);
});

test('C1 alignment: aliases preserve meaning and foreign alignment properties never gain authority',async()=>{
  const {doc}=await preview(pack(p('alias',`<a:jc xmlns:a="${W}" a:val="center"/>`)));
  assert.equal(doc.content[0].attrs.textAlign,'center');
  const [bridge]=await modules;
  const report=bridge.buildDocxContentPreviewFromZipBytes(pack(p('foreign','<a:jc xmlns:a="urn:foreign" a:val="center"/>')));
  assert.equal(report.ok,true);assert.equal(Object.hasOwn(report.contentPreview.paragraphs[0],'textAlign'),false);
  assert.equal(bridge.buildDocxContentPreviewFromZipBytes(pack(p('spoof','<w:jc xmlns:a="urn:foreign" a:val="center"/>'))).ok,false);
});

test('C1 alignment: malformed values, duplicate direct or inherited properties and style cycles fail closed',async()=>{
  const [bridge]=await modules;
  for(const value of ['justify','CENTER','center; color:red','', 'x'.repeat(129)]) {
    assert.equal(bridge.buildDocxContentPreviewFromZipBytes(pack(p('x',jc(value)))).ok,false,value);
  }
  for(const properties of [jc('left')+jc('left'),jc('left')+jc('right')]){
    assert.equal(bridge.buildDocxContentPreviewFromZipBytes(pack(p('x',properties))).ok,false);
    const styles=stylesXml('<w:docDefaults><w:pPrDefault><w:pPr>'+properties+'</w:pPr></w:pPrDefault></w:docDefaults>');
    assert.equal(bridge.buildDocxContentPreviewFromZipBytes(pack(p('x'),styles)).ok,false);
  }
  const styles=stylesXml('<w:style w:type="paragraph" w:styleId="Cycle" w:default="1"><w:basedOn w:val="Cycle"/><w:pPr>'+jc('left')+'</w:pPr></w:style>');
  assert.equal(bridge.buildDocxContentPreviewFromZipBytes(pack(p('x'),styles)).ok,false);
});

test('C1 alignment: invalid source and forged projection values never reach canonical construction',async()=>{
  const [bridge]=await modules;
  for(const value of ['both','center;position:fixed','',0,false,{},null]){
    if(value!==null)await assert.rejects(exportDoc(document([paragraph('x',value)])),/ALIGNMENT_INVALID/);
    const report=bridge.buildDocxContentPreviewFromZipBytes(pack(p('x',jc('left'))));
    report.contentPreview.paragraphs[0].textAlign=value;
    assert.equal(bridge.buildDocxImportPreviewPlanFromContentPreview(report).ok,false,JSON.stringify(value));
  }
});

test('C1 alignment: both value modules share implementation and reject prototype keys',async()=>{
  const a=await import('../../src/io/paragraphAlignment.mjs');const b=require('../../src/io/paragraphAlignment.cjs');
  assert.equal(a.normalizeParagraphAlignment,b.normalizeParagraphAlignment);
  assert.equal(a.toWordParagraphAlignment('justify'),'both');assert.equal(a.fromWordParagraphAlignment('both'),'justify');
  for(const v of ['constructor','__proto__','toString'])assert.throws(()=>a.fromWordParagraphAlignment(v),/INVALID/);
});

async function editorState(input, from=1,to=from) {
  const {getSchema}=require('@tiptap/core');const {EditorState,TextSelection}=require('@tiptap/pm/state');
  const {DocumentTextStyle}=await import('../../src/renderer/tiptap/documentTextStyle.mjs');
  const alignment=await import('../../src/renderer/tiptap/documentParagraphAlignment.mjs');
  const schema=getSchema([require('@tiptap/starter-kit').default,DocumentTextStyle,require('@tiptap/extension-color').default,alignment.DocumentParagraphAlignment]);
  const doc=schema.nodeFromJSON(input);
  return {alignment,state:EditorState.create({doc,selection:TextSelection.create(doc,from,to),plugins:[require('@tiptap/pm/history').history()]})};
}
const withoutAlignment = doc => JSON.parse(JSON.stringify(doc,(key,value)=>key==='textAlign'?undefined:value));

test('C1 alignment: actual editor schema retains all paragraph attributes and rich marks',async()=>{
  const input=source();const {state}=await editorState(input);
  assert.deepEqual(profile(state.doc.toJSON()),profile(input));
});

test('C1 alignment: structured selected paragraph changes preserve all other content and undo/redo',async()=>{
  const setup=await editorState(source());let state=setup.state;
  const command=setup.alignment.DocumentParagraphAlignment.config.addCommands().setParagraphAlignment;
  const before=state.doc.toJSON();const tr=state.tr;
  assert.equal(command('center')({tr,dispatch:()=>{}}),true);state=state.apply(tr);
  const after=state.doc.toJSON();assert.equal(after.content[0].attrs.textAlign,'center');
  assert.deepEqual(after.content.slice(1),before.content.slice(1));assert.deepEqual(withoutAlignment(after),withoutAlignment(before));
  const {undo,redo}=require('@tiptap/pm/history');assert.equal(undo(state,tr=>{state=state.apply(tr);}),true);assert.deepEqual(state.doc.toJSON(),before);
  assert.equal(redo(state,tr=>{state=state.apply(tr);}),true);assert.deepEqual(state.doc.toJSON(),after);
});

test('C1 alignment: selection controls report mixed, inherited-left and unsupported text blocks accurately',async()=>{
  const input=document([paragraph('a'),paragraph('b','right'),{type:'codeBlock',content:[{type:'text',text:'code'}]}]);
  const left=await editorState(input);assert.equal(left.alignment.readParagraphAlignment({state:left.state}),'left');
  const mixed=await editorState(input,1,5);assert.equal(mixed.alignment.readParagraphAlignment({state:mixed.state}),'');
  const command=mixed.alignment.DocumentParagraphAlignment.config.addCommands().setParagraphAlignment;const tr=mixed.state.tr;
  assert.equal(command('center')({tr,dispatch:()=>{}}),true);const changed=mixed.state.apply(tr);
  assert.equal(mixed.alignment.readParagraphAlignment({state:changed}),'center');assert.deepEqual(changed.doc.toJSON().content[2],mixed.state.doc.toJSON().content[2]);
  const code=await editorState(input,7);assert.equal(code.alignment.readParagraphAlignment({state:code.state}),'');
  assert.equal(command('right')({tr:code.state.tr,dispatch:()=>{}}),false);
});

test('C1 alignment: invalid commands, capability queries and already-selected alignment do not mutate',async()=>{
  const {state,alignment}=await editorState(source());const command=alignment.DocumentParagraphAlignment.config.addCommands().setParagraphAlignment;
  for(const value of ['wrong','',null,{},false]){const tr=state.tr;assert.equal(command(value)({tr,dispatch:()=>{}}),false);assert.equal(tr.docChanged,false);}
  const query=state.tr;assert.equal(command('center')({tr:query}),true);assert.equal(query.docChanged,false);
  const noop=state.tr;assert.equal(command('left')({tr:noop,dispatch:()=>{}}),false);assert.equal(noop.docChanged,false);
});

test('C1 alignment: review writer and scanner preserve justified Word both and reject invalid or duplicate alignment',async()=>{
  const {buildDocxReviewPacketBuffer}=require('../../src/export/docx/docxReviewPacketBuilder.js');
  const data={customProperties:[{name:'YRTK_C01_AUTH',value:'YRTK1.synthetic-alignment'},{name:'YRTK2_TOKEN',value:'YRTK2.synthetic-alignment'}],blocks:[{text:'review',formatIr:{schemaVersion:'yalken.rtk.format-ir.v1',paragraph:{textAlign:'justify'},runs:[{text:'review',from:0,to:6,inline:{}}]}}]};
  const bytes=buildDocxReviewPacketBuffer(data);const {doc}=await preview(bytes);assert.equal(doc.content[0].attrs.textAlign,'justify');
  assert.ok(bytes.includes(Buffer.from('<w:jc w:val="both"/>')));
  data.blocks[0].formatIr.paragraph.textAlign='center; color:red';assert.throws(()=>buildDocxReviewPacketBuffer(data),/ALIGNMENT_INVALID/);
  const crypto=require('node:crypto');const sha=s=>crypto.createHash('sha256').update(String(s)).digest('hex');
  const cryptoPort={sha256Text:sha,sha256Json:v=>'sha256:'+sha(JSON.stringify(v)),byteLength:s=>Buffer.byteLength(String(s))};
  const {extractReviewTransportFormattingRunsV2}=await import('../../src/io/revisionBridge/reviewTransportPackageParserV2.mjs');
  for(const props of [jc('both'),jc('justify'),jc('left')+jc('right'),jc('start')]){
    const result=extractReviewTransportFormattingRunsV2(`<w:document xmlns:w="${W}"><w:body>${p('review',props)}</w:body></w:document>`,{cryptoPort});
    assert.equal(result.ok,true,JSON.stringify(result));const row=result.paragraphs[0];
    assert.equal(row.paragraphFormattingInvalid,props!==jc('both'),JSON.stringify(row));
    if(props===jc('both'))assert.equal(row.paragraphState.textAlign,'justify');
  }
});

test('C1 alignment: admitted create persists alignment and retry creates no extra scene',async t=>{
  const input=source();const bytes=await exportDoc(input);
  const response=await createDocxImportLocalFilePreview({}, {pickLocalFile:async()=>({path:'/tmp/synthetic-alignment.docx'}),readLocalFileBytes:async()=>bytes});
  assert.equal(response.ok,true,JSON.stringify(response));const plan=response.docxImportPreviewPlan;
  assert.match(rememberDocxImportPreviewPlanAdmission(plan),/^[a-f0-9]{64}$/);
  const projectRoot=fs.mkdtempSync(path.join(os.tmpdir(),'docx-alignment-contract-'));t.after(()=>fs.rmSync(projectRoot,{recursive:true,force:true}));
  const options={projectRoot,romanRoot:path.join(projectRoot,'roman'),projectId:'alignment'};
  const first=await applyDocxImportSafeCreate({docxImportPreviewPlan:plan},options);assert.equal(first.ok,true,JSON.stringify(first));
  const second=await applyDocxImportSafeCreate({docxImportPreviewPlan:plan},options);assert.equal(second.ok,true);
  const [,envelope]=await modules;const files=fs.readdirSync(options.romanRoot,{recursive:true}).filter(f=>String(f).endsWith('.txt'));assert.equal(files.length,1);
  const saved=envelope.parseObservablePayload(fs.readFileSync(path.join(options.romanRoot,files[0]),'utf8')).doc;assert.deepEqual(profile(saved),profile(input));
  const forged=structuredClone(plan);forged.candidateCreatePlan.entries[0].content=forged.candidateCreatePlan.entries[0].content.replace('center','right');
  assert.equal((await applyDocxImportSafeCreate({docxImportPreviewPlan:forged},options)).ok,false);
});

test('C1 alignment: actual main-process report projection preserves alignment and retains its authority filter', async()=>{
  const vm=require('node:vm');const main=fs.readFileSync(path.join(__dirname,'../../src/main.js'),'utf8');
  const start=main.indexOf('function copyDocxImportPreviewAllowedFields(');const end=main.indexOf('function validateDocxImportPreviewPayload(',start);
  assert.ok(start>=0 && end>start);
  const sandbox={cloneJsonSafe:v=>v===undefined?undefined:JSON.parse(JSON.stringify(v)),isPlainObjectValue:v=>Boolean(v&&typeof v==='object'&&!Array.isArray(v))};
  vm.runInNewContext(main.slice(start,end)+'\nthis.project=canonicalizeDocxImportPreviewSourceReport;',sandbox);
  const [bridge,envelope]=await modules;const input=source();const report=bridge.buildDocxContentPreviewFromZipBytes(await exportDoc(input));
  report.contentPreview.paragraphs[0].untrustedPath='/tmp/not-authority';
  const projected=sandbox.project(report);assert.equal(Object.hasOwn(projected.contentPreview.paragraphs[0],'untrustedPath'),false);
  const plan=bridge.buildDocxImportPreviewPlanFromContentPreview(projected);assert.equal(plan.ok,true,JSON.stringify(plan));
  assert.deepEqual(profile(envelope.parseObservablePayload(plan.candidateCreatePlan.entries[0].content).doc),profile(input));
  report.contentPreview.paragraphs[0].textAlign='right;position:fixed';
  assert.equal(bridge.buildDocxImportPreviewPlanFromContentPreview(sandbox.project(report)).ok,false);
});

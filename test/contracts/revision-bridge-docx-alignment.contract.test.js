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
  assert.match(plan.lossReport.items.find(i=>i.category==='formatting').message,/supported effective formatting and semantic paragraph roles are imported/);
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
  const [,envelope]=await modules;assert.deepEqual(profile(envelope.canonicalizeDocumentJson(state.doc.toJSON())),profile(envelope.canonicalizeDocumentJson(input)));
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

test('C1 alignment: native selection events refresh formatting instead of being treated as formatting data',()=>{
  const vm=require('node:vm');const source=fs.readFileSync(path.join(__dirname,'../../src/renderer/editor.js'),'utf8');
  const bindings=source.split('\n').filter(l=>l.includes("document.addEventListener('selectionchange',") && l.includes('syncToolbarFormattingState'));
  assert.equal(bindings.length,1);const calls=[];const callbacks=[];
  vm.runInNewContext(bindings[0],{document:{addEventListener:(_name,callback)=>callbacks.push(callback)},syncToolbarFormattingState:(...args)=>calls.push(args)});
  callbacks[0]({type:'selectionchange',target:{}});
  assert.equal(calls.length,1);assert.deepEqual(calls[0],[],'The event must not masquerade as a document formatting projection');
});

test('typed paragraph spacing survives actual editor split Undo and both DOCX serializers',async()=>{
 const spacing={before:0,after:160,line:278,lineRule:'auto'},language={val:'ru-FI',eastAsia:'ru-RU',bidi:'ar-SA'};
 const input=document([{type:'paragraph',attrs:{wordParagraphSpacing:spacing,wordParagraphMarkLanguage:language},content:[{type:'text',text:'Spacing',marks:[{type:'textStyle',attrs:{wordLanguage:language}}]}]}]);
 let {state}=await editorState(input);const before=state.doc.toJSON();
 state=state.apply(state.tr.split(3));assert.deepEqual(state.doc.firstChild.attrs.wordParagraphSpacing,spacing);
 assert.equal(require('@tiptap/pm/history').undo(state,tr=>{state=state.apply(tr);}),true);assert.deepEqual(state.doc.toJSON(),before);
 const [,envelope]=await modules;const persisted=envelope.parseObservablePayload(envelope.composeObservablePayload({doc:state.doc.toJSON()}));
 assert.equal(persisted.issue,null);assert.deepEqual(persisted.doc.content[0].attrs.wordParagraphSpacing,spacing);
 const ordinary=await exportDoc(persisted.doc);
 const source=require('../../src/export/docx/fullManuscriptDocxReviewPacketSource.js');
 const formats=source.buildFormatIrParagraphs({sceneId:'s',doc:persisted.doc,text:'Spacing'});
 const review=require('../../src/export/docx/docxReviewPacketBuilder.js').buildDocxReviewPacketBuffer({customProperties:[{name:'YRTK_C01_AUTH',value:'YRTK1.spacing-codec'},{name:'YRTK2_TOKEN',value:'YRTK2.spacing-codec'}],blocks:formats.map(p=>({text:p.text,formatIr:p.formatIr}))});
 for(const bytes of [ordinary,review]){
  assert.ok(bytes.includes(Buffer.from('<w:spacing w:before="0" w:after="160" w:line="278" w:lineRule="auto"/>')));
  assert.ok(bytes.includes(Buffer.from('<w:lang w:val="ru-FI" w:eastAsia="ru-RU" w:bidi="ar-SA"/>')));
 }
 const extension=(await import('../../src/renderer/tiptap/documentParagraphAlignment.mjs')).DocumentParagraphAlignment;
 const attr=extension.config.addGlobalAttributes.call(extension)[0].attributes.wordParagraphSpacing;
 assert.equal(attr.default,null);assert.deepEqual(attr.parseHTML({getAttribute:()=>JSON.stringify(spacing)}),spacing);
 assert.match(attr.renderHTML({wordParagraphSpacing:spacing}).style,/margin-top: 0pt/);
 assert.match(attr.renderHTML({wordParagraphSpacing:spacing}).style,/line-height: 1\.158333/);
 assert.equal(attr.parseHTML({getAttribute:()=>'{"after":-1}'}),null);
});

test('header and note paragraph spacing and paragraph-mark language serialize without flattening',()=>{
 const spacing={before:0,after:160,line:278,lineRule:'auto'},language={val:'ru-FI',eastAsia:'ru-RU',bidi:'ar-SA'};
 const richBody=document([{type:'paragraph',attrs:{wordParagraphSpacing:spacing,wordParagraphMarkLanguage:language},content:[{type:'text',text:'Body',marks:[{type:'textStyle',attrs:{wordLanguage:language}}]}]}]);
 const registry={schemaVersion:1,evenAndOddHeaders:false,stories:[{id:'head',role:'header',body:richBody}],sections:[{titlePage:false,header:{default:'head'},footer:{}}]};
 const header=require('../../src/export/docx/docxReviewPacketStories.js').storyPackageParts(registry).entries[0].data;
 const notes=require('../../src/export/docx/docxReviewPacketNotes.js');
 const note=notes.notePackageParts({schemaVersion:notes.DOCUMENT_NOTES_SCHEMA,sourceBindings:[{kind:'footnote',nativeId:1,richBody,paragraphs:['Body']}]}).entries[0].data;
 for(const xml of [header,note]){assert.match(xml,/<w:spacing w:before="0" w:after="160" w:line="278" w:lineRule="auto"\/>/);assert.match(xml,/<w:rPr><w:lang w:val="ru-FI" w:eastAsia="ru-RU" w:bidi="ar-SA"\/><\/w:rPr>/);}
});

test('pending paragraph formatting serializes old spacing and language only from its before snapshot',()=>{
 const {buildPendingParagraphPropertiesXml}=require('../../src/export/docx/docxPendingRevisions.js');
 const revision={state:'pending',operation:'format',author:'A',format:{kind:'paragraph',before:{type:'paragraph',attrs:{textAlign:'left'}}}};
 const current='<w:pPr><w:jc w:val="right"/><w:spacing w:after="160"/><w:rPr><w:lang w:val="ru-FI"/></w:rPr></w:pPr>';
 for(const oldAttrs of [{textAlign:'left'},{textAlign:'left',wordParagraphSpacing:{before:0,after:80,line:240,lineRule:'exact'},wordParagraphMarkLanguage:{val:'en-US',eastAsia:'ja-JP',bidi:'he-IL'}}]){
  revision.format.before.attrs=oldAttrs;
  const xml=buildPendingParagraphPropertiesXml(current,revision,{next:1});
  const [now,previous]=xml.split(/<w:pPrChange[^>]*>/u);
  assert.equal(now,current.slice(0,-8));
  assert.match(previous,/<w:jc w:val="left"\/>/);
  assert.doesNotMatch(previous,/after="160"|ru-FI/);
  if(oldAttrs.wordParagraphSpacing){assert.match(previous,/<w:spacing w:before="0" w:after="80" w:line="240" w:lineRule="exact"\/>/);assert.match(previous,/<w:lang w:val="en-US" w:eastAsia="ja-JP" w:bidi="he-IL"\/>/);}
  else assert.doesNotMatch(previous,/<w:spacing|<w:lang/);
 }
});

test('both exporters keep independent pending current and old paragraph and run languages',async()=>{
 const recording=require('../../src/core/word-pending-recording-v1.cjs');
 const source=require('../../src/export/docx/fullManuscriptDocxReviewPacketSource.js');
 const builder=require('../../src/export/docx/docxReviewPacketBuilder.js');
 const oldLanguage={val:'en-US',eastAsia:'ja-JP',bidi:'he-IL'},newLanguage={val:'ru-FI',eastAsia:'ru-RU',bidi:'ar-SA'};
 for(const absent of [false,true]){
  const base=document([paragraph('Paragraph'),paragraph('Run')]);
  if(!absent)base.content[0].attrs={textAlign:'left',wordParagraphSpacing:{before:0,after:80},wordParagraphMarkLanguage:oldLanguage};
  for(const item of base.content)item.content[0].marks=[{type:'textStyle',attrs:{fontSize:'12pt',...(!absent?{wordLanguage:oldLanguage}:{})}}];
  const current=structuredClone(base);
  current.content[0].attrs={textAlign:'right',wordParagraphSpacing:{after:160,line:278,lineRule:'auto'},wordParagraphMarkLanguage:newLanguage};
  current.content[1].content[0].marks[0].attrs.wordLanguage=newLanguage;
  const doc=recording.derive(base,current,{author:'Owner',date:'2026-10-03T10:00:00.000Z'}).doc;
  const full=builder.buildDocxReviewPacketBuffer(source.buildFullManuscriptDocxReviewPacketSource({projectId:'pending-language',projectRoot:'/synthetic',scenes:[{sceneId:'roman/a.txt',scenePath:'/synthetic/roman/a.txt',doc,text:'Paragraph\nRun',order:0}]}));
  for(const bytes of [await exportDoc(doc),full]){
   const returned=(await preview(bytes)).doc;
   const pending=require('../../src/core/word-pending-text-revisions-v1.cjs');
   for(const mode of ['original','current'])assert.deepEqual(pending.normalizeNode(pending.materialize(pending.readLedger(returned),mode)),pending.normalizeNode(pending.materialize(pending.readLedger(doc),mode)),`pending ${mode} survives reimport`);
   const xml=bytes.toString('utf8');
   const oldParagraph=xml.match(/<w:pPrChange[^>]*><w:pPr>([\s\S]*?)<\/w:pPr><\/w:pPrChange>/u)?.[1];
   const oldRun=xml.match(/<w:rPrChange[^>]*><w:rPr>([\s\S]*?)<\/w:rPr><\/w:rPrChange>/u)?.[1];
   assert.equal(typeof oldParagraph,'string');assert.equal(typeof oldRun,'string');
   assert.match(xml,/<w:spacing w:after="160" w:line="278" w:lineRule="auto"\/>/);
   assert.match(xml,/<w:lang w:val="ru-FI" w:eastAsia="ru-RU" w:bidi="ar-SA"\/>/);
   assert.doesNotMatch(oldParagraph,/ru-FI|after="160"/);assert.doesNotMatch(oldRun,/ru-FI/);
   if(absent){assert.doesNotMatch(oldParagraph,/<w:spacing|<w:lang/);assert.doesNotMatch(oldRun,/<w:lang/);}
   else {assert.match(oldParagraph,/<w:spacing w:before="0" w:after="80"\/>/);for(const old of [oldParagraph,oldRun])assert.match(old,/<w:lang w:val="en-US" w:eastAsia="ja-JP" w:bidi="he-IL"\/>/);}
  }
 }
});

test('both export entrypoints reject raw spacing accessors before cloning or reading authored values',async()=>{
 const source=require('../../src/export/docx/fullManuscriptDocxReviewPacketSource.js');
 for(const target of ['spacing','value']){
  let reads=0;const attrs={};
  if(target==='spacing')Object.defineProperty(attrs,'wordParagraphSpacing',{enumerable:true,get(){reads++;return{after:160};}});
  else {attrs.wordParagraphSpacing={};Object.defineProperty(attrs.wordParagraphSpacing,'after',{enumerable:true,get(){reads++;return 160;}});}
  const doc=document([{type:'paragraph',attrs,content:[{type:'text',text:'Protected'}]}]);
  assert.throws(()=>source.buildFormatIrParagraphs({sceneId:'s',doc,text:'Protected'}),/WORD_PARAGRAPH_SPACING_INVALID/);
  assert.equal(reads,0);
  await assert.rejects(exportDoc(doc),/WORD_PARAGRAPH_SPACING_INVALID/);assert.equal(reads,0);
 }
});

function tabRuntimeParts(overrides={}) {
  const vm=require('node:vm');
  const code=fs.readFileSync(path.join(__dirname,'../../src/renderer/tiptap/documentParagraphAlignment.mjs'),'utf8');
  const start=code.indexOf('const tabDecorationKey'),end=code.indexOf('\nexport const DocumentParagraphAlignment');
  let script=code.slice(start,end).replace('export function wordTabAdvance','function wordTabAdvance');
  if(overrides.paragraphMeasurement){const a=script.indexOf('function paragraphMeasurement('),b=script.indexOf('function wordTabDecorations(',a);script=script.slice(0,a)+script.slice(b);}
  const context={console,paragraphLayout:require('../../src/core/word-paragraph-layout-v1.cjs'),...require('@tiptap/pm/state'),...require('@tiptap/pm/view'),...overrides};
  vm.createContext(context);vm.runInContext(script+'\nglobalThis.api={wordTabAdvance,wordTabDecorations,wordTabPlugin,paragraphMeasurement};',context);
  return context.api;
}

test('paragraph tab rendering resolves later origins after previous widths, retains marked text and uses explicit bar origin',async()=>{
  const input={type:'doc',attrs:{wordDefaultTabStop:567},content:[{type:'paragraph',attrs:{wordParagraphIndent:{left:300,hanging:120},wordParagraphTabs:[{pos:1200,val:'left'},{pos:2400,val:'right',leader:'dot'},{pos:900,val:'bar'}]},content:[{type:'text',text:'A\t'},{type:'text',marks:[{type:'bold'}],text:'B\tC'}]}]};
  const setup=await editorState(input);let firstWidth=8,disposed=0,measurements=0;
  const api=tabRuntimeParts({paragraphMeasurement(){measurements++;return {paragraph:{getBoundingClientRect:()=>({left:0,height:40})},dispose(){disposed++;},width:()=>10,range(from){const index=from===2?0:1;const parent={getBoundingClientRect:()=>({left:index===0?10:20+firstWidth})};Object.defineProperty(parent,'style',{value:{}});Object.defineProperty(parent.style,'cssText',{set(value){if(index===0)firstWidth=Number(/width:([\d.]+)(?:px)?/.exec(value)[1]);}});return {startContainer:{nodeType:3,nodeValue:'\t',parentElement:parent},getBoundingClientRect:()=>({left:index===0?10:20+firstWidth})};}};}});
  const view={state:setup.state,nodeDOM:()=>({clientWidth:400,getBoundingClientRect:()=>({width:400})}),dom:{ownerDocument:{defaultView:{getComputedStyle:()=>({getPropertyValue:()=>''})},createElement:()=>({style:{},setAttribute(){}})}}};
  const original=JSON.stringify(view.state.doc.toJSON()),selection=view.state.selection.toJSON(),cache=new WeakMap();
  const result=api.wordTabDecorations(view,cache),all=result.decorations.find();
  const tabs=all.filter(d=>d.type.attrs?.class==='word-tab-layout');
  assert.equal(tabs.length,2);assert.match(tabs[0].type.attrs.style,/width:50px/);
  // Second origin is 10 + new first-tab50 + B10 + indent20 = 90;
  // right stop160 minus origin90 minus following C10 = 60, not stale102.
  assert.match(tabs[1].type.attrs.style,/width:60px/);
  assert.match(tabs[1].type.attrs.style,/height:2px;vertical-align:baseline;/,'dot leader has a paint area even when font-size is zero');
  assert.match(tabs[1].type.attrs.style,/background-image:radial-gradient/);
  assert.ok(all.some(d=>d.type.attrs?.style==='position:relative;'));
  const bar=all.find(d=>d.type.toDOM);assert.match(bar.type.toDOM().style.cssText,/left:40px;top:0/);
  assert.equal(JSON.stringify(view.state.doc.toJSON()),original);assert.deepEqual(view.state.selection.toJSON(),selection);
  api.wordTabDecorations(view,cache);assert.equal(measurements,1);assert.equal(disposed,1);
});

test('paragraph tab projection handles center decimal cleared default and hanging stops without changing text',()=>{
  const {wordTabAdvance}=tabRuntimeParts();
  assert.equal(wordTabAdvance({position:20,stops:[{pos:1200,val:'center'}],segmentWidth:40}).width,40);
  const crowded=wordTabAdvance({position:117.383,stops:[{pos:2268,val:'right',leader:'dot'},{pos:3402,val:'center',leader:'hyphen'}],segmentWidth:47.109});
  assert.equal(crowded.width,0);assert.equal(crowded.leader,'dot','overcrowded right stop does not become next center stop');
  assert.equal(wordTabAdvance({position:20,stops:[{pos:1200,val:'decimal'}],segmentWidth:60,decimalWidth:25}).width,35);
  assert.equal(wordTabAdvance({position:1,stops:[{pos:720,val:'clear'}]}).width,95);
  assert.equal(wordTabAdvance({position:5,hangingPosition:300,defaultInterval:567}).width,15);
});

test('paragraph tab plugin publishes derived state once and guards composition, deferred fonts and disposal',async()=>{
  const setup=await editorState({type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'literal\ttext'}]}]});
  const vm=require('node:vm');let code=fs.readFileSync(path.join(__dirname,'../../src/renderer/tiptap/documentParagraphAlignment.mjs'),'utf8');
  const pluginSource=code.slice(code.indexOf('function wordTabPlugin()'),code.indexOf('\nexport const DocumentParagraphAlignment'));
  const key=new (require('@tiptap/pm/state').PluginKey)('tab-test');let frames=[],dispatches=0,warningCount=0,measurements=0,fail=false,fontReady;
  const {DecorationSet}=require('@tiptap/pm/view');
  const c={Plugin:require('@tiptap/pm/state').Plugin,DecorationSet,tabDecorationKey:key,console:{warn(message){assert.equal(message,'WORD_TAB_LAYOUT_MEASUREMENT_FAILED');warningCount++;}},wordTabDecorations(){measurements++;if(fail)throw Error('private manuscript must not escape');return {decorations:DecorationSet.empty,signature:'stable'};}};
  vm.createContext(c);vm.runInContext(pluginSource+'\nglobalThis.plugin=wordTabPlugin();',c);
  let state=setup.state.reconfigure({plugins:[...setup.state.plugins,c.plugin]});const handlers=new Map(),fontHandlers=new Map();
  const view={state,composing:false,dom:{addEventListener:(k,f)=>handlers.set(k,f),removeEventListener:k=>handlers.delete(k),ownerDocument:{defaultView:{requestAnimationFrame:f=>(frames.push(f),frames.length),cancelAnimationFrame(){frames=[];}},fonts:{ready:new Promise(resolve=>{fontReady=resolve;}),addEventListener:(k,f)=>fontHandlers.set(k,f),removeEventListener:k=>fontHandlers.delete(k)}}},dispatch(tr){dispatches++;assert.equal(tr.docChanged,false);assert.equal(tr.getMeta('addToHistory'),false);const previous=this.state;this.state=this.state.apply(tr);controller.update(this,previous);}};
  const original=JSON.stringify(state.doc.toJSON()),selection=state.selection.toJSON();const controller=c.plugin.spec.view(view);const flush=()=>{const pending=frames;frames=[];for(const f of pending)f();};
  view.composing=true;flush();assert.equal(dispatches,0);view.composing=false;handlers.get('compositionend')();flush();assert.equal(dispatches,1);assert.equal(frames.length,0);
  fontHandlers.get('loadingdone')();flush();assert.equal(dispatches,1);
  fail=true;fontHandlers.get('loadingdone')();flush();fontHandlers.get('loadingdone')();flush();assert.equal(warningCount,1);
  controller.destroy();fontReady();await Promise.resolve();flush();assert.equal(dispatches,1);assert.equal(handlers.size,0);assert.equal(fontHandlers.size,0);
  assert.equal(JSON.stringify(view.state.doc.toJSON()),original);assert.deepEqual(view.state.selection.toJSON(),selection);assert.equal(require('@tiptap/pm/history').undo(view.state,()=>assert.fail('derived layout entered Undo history')),false);
});

test('paragraph measurement unwraps rich following text and never clones image requests or authoring attributes',()=>{
  let rectReads=0;const styles=()=>({setProperty(key,value){this[key]=value;}});
  class Element {
    constructor(tag='span'){this.nodeType=1;this.tagName=tag.toUpperCase();this.childNodes=[];this.style=styles();this.classList={contains:()=>false};this.attributes={};this.clientWidth=80;}
    appendChild(child){this.childNodes.push(child);child.parentElement=this;return child;}
    setAttribute(k,v){this.attributes[k]=v;}
    remove(){if(this.parentElement)this.parentElement.childNodes=this.parentElement.childNodes.filter(x=>x!==this);}
    cloneNode(){const clone=new Element(this.tagName);Object.assign(clone.style,this.style);return clone;}
    querySelectorAll(){return this.childNodes.flatMap(c=>c.nodeType===1?[c,...c.querySelectorAll()]:[]);}
    getBoundingClientRect(){rectReads++;if(this.style.width==='max-content'){assert.equal(this.style.whiteSpace,'pre');assert.equal(this.style.textIndent,'0');assert.equal(this.style['font-weight'],'700','probe retains common ancestor formatting');assert.equal(this.querySelectorAll().every(x=>x.style.whiteSpace==='pre'),true);return {width:120,height:20,left:0};}return {width:80,height:40,left:0};}
  }
  const body=new Element('body'),paragraph=new Element('p'),mark=new Element('strong'),image=new Element('img');
  const text={nodeType:3,nodeValue:'mixed wrapped text',parentElement:mark};mark.appendChild(text);paragraph.appendChild(mark);paragraph.appendChild(image);image.setAttribute('src','https://must-not-be-copied.invalid/image');
  const document={body,defaultView:{getComputedStyle(node){return {fontSize:'16px',getPropertyValue(key){if(key==='white-space')return 'pre-wrap';if(key==='font-weight')return node.tagName==='STRONG'?'700':'400';return '';}}; }},createElement:tag=>new Element(tag),createTextNode:value=>({nodeType:3,nodeValue:value}),createRange(){return {commonAncestorContainer:mark,setStart(node,offset){this.startContainer=node;this.startOffset=offset;},setEnd(node,offset){this.endContainer=node;this.endOffset=offset;},cloneContents(){const strong=new Element('strong');strong.style.fontWeight='700';strong.style.whiteSpace='pre-wrap';strong.appendChild({nodeType:3,nodeValue:'mixed wrapped text'});return strong;}};}};
  const view={dom:{ownerDocument:document},domAtPos(pos){return {node:text,offset:pos};}};
  const api=tabRuntimeParts(),measurement=api.paragraphMeasurement(view,paragraph);
  assert.equal(body.childNodes.length,1);assert.equal(measurement.host.inert,true);assert.equal(measurement.host.attributes['aria-hidden'],'true');
  const cloned=measurement.host.querySelectorAll();assert.equal(cloned.some(n=>n.tagName==='IMG'||n.attributes.src||n.attributes.contenteditable),false);
  assert.equal(measurement.width(0,text.nodeValue.length),120,'intrinsic rich width, not wrapped line width80');
  assert.equal(measurement.host.childNodes.length,1,'temporary probe removed');measurement.dispose();assert.equal(body.childNodes.length,0);assert.ok(rectReads>0);
});

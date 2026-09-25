'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildDocxMinBuffer, buildStoredZip } = require('../../src/export/docx/docxMinBuilder.js');
const { buildFormatIrParagraphs } = require('../../src/export/docx/fullManuscriptDocxReviewPacketSource.js');
const { buildDocxReviewPacketBuffer } = require('../../src/export/docx/docxReviewPacketBuilder.js');
const tables = require('../../src/io/documentTables.js');
const props = require('../../src/io/documentTableProperties.js');
const modules = Promise.all([import('../../src/io/revisionBridge/index.mjs'), import('../../src/renderer/documentContentEnvelope.mjs'), import('../../src/docxPageSetupBind.mjs'), import('../../src/derived/semanticMapping.mjs'), import('../../src/derived/styleMap.mjs')]);
const p = text => ({ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] });
const cell = (text, colspan = 1, rowspan = 1) => ({ type: 'tableCell', attrs: { colspan, rowspan, colwidth: null }, content: [p(text)] });
const row = (...content) => ({ type: 'tableRow', content });
const table = (...content) => ({ type: 'table', content });
function fixture() {
  const t = table(row(cell('A'), cell('B')));
  t.attrs = { wordTable: { version: 1, grid: [720, 4320], layout: 'fixed', widthDxa: null, shading: null,
    borders: Object.fromEntries(props.EDGES.map(k => [k, { style: 'double', size: 24, color: 'auto' }])) } };
  t.content[0].content[0].attrs.wordCell = { version: 1, shading: 'FF0000', borders: {} };
  t.content[0].content[0].content.push(p('second paragraph 日本語 é'));
  return { type: 'doc', content: [p('before'), t, p('after'), table(row(cell('untouched')))] };
}
async function exported(doc) {
  const [,,docxPageSetupBindModule,semanticMappingModule,styleMapModule] = await modules;
  return buildDocxMinBuffer({ doc, bookProfile: { formatId: 'A4' } }, { docxPageSetupBindModule, semanticMappingModule, styleMapModule });
}
async function imported(bytes) {
  const [bridge, envelope] = await modules;
  const report = bridge.buildDocxContentPreviewFromZipBytes(bytes);
  assert.equal(report.ok, true, JSON.stringify(report));
  const plan = bridge.buildDocxImportPreviewPlanFromContentPreview(report);
  assert.equal(plan.ok, true, JSON.stringify(plan));
  return { doc: envelope.parseObservablePayload(plan.candidateCreatePlan.entries[0].content).doc, plan, report };
}
async function mutate(bytes, change) {
  const [bridge] = await modules;
  const parts = bridge.extractDocxReviewTransportPackagePartsFromZipBytes({ bytes }).parts;
  assert.ok(parts);
  return buildStoredZip(Object.entries(parts).map(([name, data]) => ({ name, data: name === 'word/document.xml' ? change(data) : data })));
}
test('W5: 720/4320 dxa, red cell and double 24 borders survive five ordinary and review cycles with neighboring legacy table unchanged', async () => {
  const expected = fixture(); let current = expected;
  const [, envelope] = await modules;
  for (let i = 0; i < 5; i++) {
    const bytes = await exported(current);
    assert.match(bytes.toString(), /<w:gridCol w:w="720"\/><w:gridCol w:w="4320"\/>/u);
    assert.match(bytes.toString(), /<w:tblLayout w:type="fixed"\/>/u);
    assert.match(bytes.toString(), /w:val="double" w:sz="24"/u);
    assert.match(bytes.toString(), /w:fill="FF0000"/u);
    const result = await imported(bytes);
    assert.deepEqual(result.doc, expected);
    assert.equal(result.plan.lossReport.items.some(x => x.feature?.startsWith('table.')), false);
    const blocks = buildFormatIrParagraphs({ doc: result.doc, text: envelope.deriveVisibleTextFromDocument(result.doc), sceneId: 'table.txt' });
    current = (await imported(buildDocxReviewPacketBuffer({ blocks, customProperties: [{name:'YRTK_C01_AUTH',value:'synthetic-no-authority'},{name:'YRTK2_TOKEN',value:'synthetic-no-authority'}] }))).doc;
    assert.deepEqual(current, expected);
  }
});
test('W5: absent widths stay absent; explicit none and cell border override survive empty/header and both merge axes', async () => {
  const t = table(row(cell('horizontal', 2), cell('vertical', 1, 2)), row(cell(''), cell('other')));
  t.attrs = { wordTable: { version: 1, grid: [null, 4320, 720], layout: null, widthDxa: null, shading: 'ABCDEF', borders: { top: { style: 'none' }, insideH: { style: 'single', size: 8, color: '012345' } } } };
  t.content[0].content[2 - 1].attrs.wordCell = { version: 1, shading: 'none', borders: { bottom: { style: 'double', size: 24, color: 'FF0000' } } };
  const doc = { type: 'doc', content: [t] };
  for (let i = 0; i < 5; i++) assert.deepEqual((await imported(await exported(doc))).doc, doc);
  const header = fixture(); header.content[1].content[0].content.forEach(c => { c.type = 'tableHeader'; });
  assert.deepEqual((await imported(await exported(header))).doc, header);
});
test('W5: invalid canonical values and inconsistent property ownership cannot serialize or produce an import candidate', async () => {
  const mutations = [t => { t.attrs.wordTable.grid = [-1,4320]; }, t => { t.attrs.wordTable.grid = [720]; }, t => { t.attrs.wordTable.grid = [31681,1]; },
    t => { t.attrs.wordTable.grid = ['720',4320]; }, t => { t.attrs.wordTable.layout = 'url(evil)'; }, t => { t.attrs.wordTable.shading = 'red;display:none'; },
    t => { t.attrs.wordTable.borders.top.size = 97; }, t => { t.attrs.wordTable.borders.top.color = '#FF0000'; }, t => { t.attrs.wordTable.borders.diagonal = { style:'none' }; },
    t => { t.content[0].content[0].attrs.wordCell.path = '/untrusted'; }];
  for (const change of mutations) { const doc = fixture(); change(doc.content[1]); await assert.rejects(exported(doc), /TABLE_PROPERTIES_INVALID/u); }
  const { report } = await imported(await exported(fixture())); const [bridge] = await modules;
  const bad = JSON.parse(JSON.stringify(report)), records = bad.contentPreview.paragraphs.filter(p => p.table);
  records[1].table.wordTable.grid[0] = 721;
  assert.equal(bridge.buildDocxImportPreviewPlanFromContentPreview(bad).ok, false);
});
test('W5: supported properties come from raw bytes; unsupported theme/relative/conflicting width retains typed loss', async () => {
  const bytes = await exported({type:'doc',content:[table(row(cell('A'),cell('B')))]});
  const input = await mutate(bytes, x => x.replace('<w:gridCol w:w="1440"/><w:gridCol w:w="1440"/>','<w:gridCol w:w="720"/><w:gridCol w:w="4320"/>').replace('<w:tblPr>','<w:tblPr><w:tblLayout w:type="fixed"/>').replace('<w:tcPr>','<w:tcPr><w:shd w:val="clear" w:fill="FF0000"/>').replaceAll('w:val="single" w:sz="4"','w:val="double" w:sz="24"'));
  const result = await imported(input); assert.deepEqual(result.doc.content[0].attrs.wordTable.grid,[720,4320]); assert.equal(result.doc.content[0].content[0].content[0].attrs.wordCell.shading,'FF0000');
  for (const [change, feature] of [[x=>x.replace('w:fill="FF0000"','w:fill="FF0000" w:themeFill="accent1"'),'shading'], [x=>x.replace('<w:tcPr>','<w:tcPr><w:tcW w:type="pct" w:w="50"/>'),'widths'], [x=>x.replace('<w:tcPr>','<w:tcPr><w:tcW w:type="dxa" w:w="999"/>'),'widths'], [x=>x.replace('w:val="double"','w:val="dotted"'),'borders']]) {
    const {plan}=await imported(await mutate(input,change)); assert.ok(plan.lossReport.items.some(x=>x.feature===`table.${feature}`));
  }
});
test('W5: raw invalid grid, duplicate properties, rogue namespace and merge continuation conflict fail closed', async () => {
  const [bridge] = await modules, bytes = await exported(fixture());
  for (const change of [x=>x.replace('w:w="720"','w:w="-1"'),x=>x.replace('w:w="720"','w:w="999999"'),x=>x.replace('<w:tblLayout w:type="fixed"/>','<w:tblLayout w:type="fixed"/><w:tblLayout w:type="fixed"/>')]) {
    assert.equal(bridge.buildDocxContentPreviewFromZipBytes(await mutate(bytes,change)).ok,false, String(change));
  }
});
test('W5: foreign namespace lookalike cannot supply canonical shading', async () => {
  const bytes = await mutate(await exported(fixture()), x => x.replace('<w:shd ', '<w:shd xmlns:w="urn:rogue" '));
  const {doc}=await imported(bytes);
  assert.equal(doc.content[1].content[0].content[0].attrs.wordCell, undefined);
});
test('W5: table property change cannot pass an authenticated unchanged-table guard', () => {
  const t=fixture().content[1], actual=tables.tableParagraphs(t,'table-1').map(x=>({table:x.table})), expected=actual.map(x=>({formatIr:{table:structuredClone(x.table)}}));
  assert.equal(tables.compareTableParagraphTopology(actual,expected).ok,true);
  expected[0].formatIr.table.wordTable.grid[0]=721;
  assert.equal(tables.compareTableParagraphTopology(actual,expected).ok,false);
});
test('W5: actual editor schema and transactions retain properties through edit undo redo and supported merge/split; display uses literal data', async () => {
  const [{getSchema},{default:StarterKit},{DocumentTables,tablePresentation},{EditorState,TextSelection},{history,undo,redo},{CellSelection,mergeCells,splitCell}] = await Promise.all([
    import('@tiptap/core'),import('@tiptap/starter-kit'),import('../../src/renderer/tiptap/documentTables.mjs'),import('@tiptap/pm/state'),import('@tiptap/pm/history'),import('@tiptap/pm/tables')]);
  const schema=getSchema([StarterKit,DocumentTables]), json=fixture(), doc=schema.nodeFromJSON(json);doc.check();
  const editorExpected = structuredClone(json); editorExpected.content[3].attrs = {};
  assert.deepEqual(JSON.parse(JSON.stringify(doc.toJSON())),editorExpected);
  const view=tablePresentation(json.content[1]);assert.match(view.style,/width:336px/u);assert.match(view.cells[0].style,/background-color:#FF0000/u);assert.match(view.cells[0].style,/border-top:3pt double currentColor/u);
  let pos;doc.descendants((n,p)=>{if(n.type.name==='text'&&n.text==='A')pos=p;});
  let state=EditorState.create({schema,doc,selection:TextSelection.create(doc,pos+1),plugins:[history()]}),dispatch=tr=>{state=state.apply(tr);};
  dispatch(state.tr.insertText(' edited'));assert.equal(undo(state,dispatch),true);assert.deepEqual(state.doc.toJSON(),doc.toJSON());assert.equal(redo(state,dispatch),true);
  const persisted=JSON.parse(JSON.stringify(state.doc.toJSON()));assert.deepEqual(schema.nodeFromJSON((await imported(await exported(persisted))).doc).toJSON(),state.doc.toJSON());
  // Equal property cells form the supported merge/split case; no property toolbar is introduced.
  const mergeDoc=fixture();mergeDoc.content[1].content[0].content[1].attrs.wordCell=structuredClone(mergeDoc.content[1].content[0].content[0].attrs.wordCell);
  const md=schema.nodeFromJSON(mergeDoc),positions=[];md.descendants((n,p)=>{if(n.type.name==='tableCell')positions.push(p);});
  state=EditorState.create({schema,doc:md,selection:CellSelection.create(md,positions[0],positions[1])});
  assert.equal(mergeCells(state,dispatch),true);assert.equal(splitCell(state,dispatch),true);
  for(const c of state.doc.child(1).firstChild.content.content)assert.equal(c.attrs.wordCell.shading,'FF0000');
  const splitJson = JSON.parse(JSON.stringify(state.doc.toJSON()));
  assert.deepEqual(schema.nodeFromJSON((await imported(await exported(splitJson))).doc).toJSON(),state.doc.toJSON());
});
test('W5: independent Python raw oracle checks widths fill and border and rejects each actual OOXML mutant', async () => {
  const {spawnSync}=require('node:child_process'), path=require('node:path');
  const doc=fixture(), bytes=await exported(doc);
  const code=`import sys,json,base64,io,zipfile,importlib.util,copy
from xml.etree import ElementTree as E
spec=importlib.util.spec_from_file_location('table_reader',sys.argv[1]);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
x=json.load(sys.stdin);root=E.fromstring(zipfile.ZipFile(io.BytesIO(base64.b64decode(x['bytes']))).read('word/document.xml'))
expected=m.canonical_graphs([x['doc']]);assert m.parse_body(root)[1]==expected
for kind in ['width','shading','border','layout','cell-override']:
 r=copy.deepcopy(root);t=r.find('.//'+m.W+'tbl')
 if kind=='width':t.find('./'+m.W+'tblGrid/'+m.W+'gridCol').set(m.W+'w','721')
 elif kind=='shading':t.find('.//'+m.W+'shd').set(m.W+'fill','00FF00')
 elif kind=='border':t.find('./'+m.W+'tblPr/'+m.W+'tblBorders/'+m.W+'top').set(m.W+'sz','8')
 elif kind=='layout':t.find('./'+m.W+'tblPr').remove(t.find('./'+m.W+'tblPr/'+m.W+'tblLayout'))
 else:
  b=E.SubElement(t.find('.//'+m.W+'tcPr'),m.W+'tcBorders');E.SubElement(b,m.W+'top',{m.W+'val':'none'})
 assert m.parse_body(r)[1]!=expected,kind
print('RAW_TABLE_PROPERTIES_AND_FIVE_MUTANTS_PASS')`;
  const result=spawnSync('python3',['-I','-B','-c',code,path.join(__dirname,'../../scripts/ops/rtk-interop-word-tables-readback.py')],{input:JSON.stringify({doc,bytes:bytes.toString('base64')}),encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/FIVE_MUTANTS_PASS/u);
});

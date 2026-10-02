'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const tables = require('../../src/io/documentTables.js');
const envelope = require('../../src/core/document-content-envelope-v1.cjs');
const { buildDocxMinBuffer, buildStoredZip } = require('../../src/export/docx/docxMinBuilder.js');
const { buildFormatIrParagraphs } = require('../../src/export/docx/fullManuscriptDocxReviewPacketSource.js');
const modules = Promise.all([import('../../src/io/revisionBridge/index.mjs'), import('../../src/docxPageSetupBind.mjs'),
  import('../../src/derived/semanticMapping.mjs'), import('../../src/derived/styleMap.mjs')]);
const p = text => ({ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] });
const item = (text, ...nested) => ({ type: 'listItem', content: [p(text), ...nested] });
const list = (start, ...content) => ({ type: start === null ? 'bulletList' : 'orderedList', ...(start === null ? {} : { attrs: { start } }), content });
const cell = (...content) => ({ type: 'tableCell', attrs: { colspan: 1, rowspan: 1, colwidth: null }, content });
const table = (...cells) => ({ type: 'table', content: [{ type: 'tableRow', content: cells }] });
const doc = (...content) => ({ type: 'doc', content });
async function exported(document) {
  const [, docxPageSetupBindModule, semanticMappingModule, styleMapModule] = await modules;
  return buildDocxMinBuffer({ doc: document, bookProfile: { formatId: 'A4' } }, { docxPageSetupBindModule, semanticMappingModule, styleMapModule });
}
async function imported(bytes) {
  const [bridge] = await modules;
  const report = bridge.buildDocxContentPreviewFromZipBytes(bytes);
  assert.equal(report.ok, true, JSON.stringify(report));
  const plan = bridge.buildDocxImportPreviewPlanFromContentPreview(report);
  assert.equal(plan.ok, true, JSON.stringify(plan));
  return { report, plan, document: envelope.parseObservablePayload(plan.candidateCreatePlan.entries[0].content).doc };
}
test('Cell lists retain starts, nested ownership, rich inline text and empty cell paragraphs for five cycles', async () => {
  const rich = item('same 😀 é');
  rich.content[0].content[0].marks = [{ type: 'bold' }, { type: 'italic' }];
  const expected = doc(list(2, item('outside')), table(
    cell(p(''), list(7, rich, item('same', list(null, item('same'), item('')))), p(''), list(3, item('restart'))),
    cell(list(null, item('same', list(11, item('nested'), item('nested')))), p('')),
  ), list(4, item('after')));
  let current = expected;
  for (let cycle = 0; cycle < 5; cycle++) {
    current = (await imported(await exported(current))).document;
    assert.deepEqual(current, expected);
    const raw = envelope.composeObservablePayload({ doc: current });
    assert.deepEqual(envelope.parseObservablePayload(raw).doc, expected);
    assert.equal(envelope.analyzeDocumentPlainTextRoundTrip(current).safe, false);
  }
});
test('Cell list source map counts paragraph leaves and never aliases repeated text or list IDs across cells', () => {
  const t = table(cell(list(7, item('same', list(null, item('same'))), item('same')), p('')), cell(list(7, item('same')), p('')));
  const entries = tables.tableParagraphs(t, 't');
  assert.deepEqual(entries.map(e => [e.table.column, e.table.paragraphIndex, e.table.paragraphCount]), [[0,0,4],[0,1,4],[0,2,4],[0,3,4],[1,0,2],[1,1,2]]);
  const document = doc(t), before = structuredClone(document);
  const blocks = buildFormatIrParagraphs({ doc: document, text: envelope.deriveVisibleTextFromDocument(document), sceneId: 'scene' });
  assert.deepEqual(blocks.map(b => b.formatIr.paragraph.list?.level ?? null), [0,1,0,null,0,null]);
  assert.equal(blocks[0].formatIr.paragraph.list.numId, blocks[2].formatIr.paragraph.list.numId);
  assert.notEqual(blocks[0].formatIr.paragraph.list.numId, blocks[4].formatIr.paragraph.list.numId);
  assert.equal(blocks[2].formatIr.paragraph.list.itemOrdinal, 1);
  assert.deepEqual(document, before);
});
test('Word numbering shared across cells becomes separate local lists with preserved displayed ordinals', async () => {
  const [bridge] = await modules;
  const bytes = await exported(doc(table(cell(list(1, item('first'))), cell(list(1, item('second'))))));
  const parts = bridge.extractDocxReviewTransportPackagePartsFromZipBytes({ bytes }).parts;
  const xml = parts['word/document.xml'].replace('<w:numId w:val="2"/>', '<w:numId w:val="1"/>');
  assert.notEqual(xml, parts['word/document.xml']);
  const changed = buildStoredZip(Object.entries(parts).map(([name,data]) => ({ name, data: name === 'word/document.xml' ? xml : data })));
  const result = await imported(changed);
  const cells = result.document.content[0].content[0].content;
  assert.equal(cells.length, 2);
  assert.equal(cells[0].content[0].attrs.start, 1);
  assert.equal(cells[1].content[0].attrs.start, 2);
  assert.equal(cells[1].content[0].content.length, 1);
});
test('An orphan list level in a new cell cannot inherit a parent from the previous cell', async () => {
  const { report } = await imported(await exported(doc(table(cell(list(1,item('a'))),cell(list(1,item('b')))))));
  const [bridge] = await modules;
  const second = report.contentPreview.paragraphs.find(p => p.table?.column === 1);
  second.list.level = 1;
  assert.equal(bridge.buildDocxImportPreviewPlanFromContentPreview(report).ok, false);
});
test('Core and both exporters reject malformed cell list shapes before publication', async () => {
  for (const bad of [list(1),list(-1,item('a')),list(1.5,item('a')),list(2147483647,item('a'),item('b')),
    { ...list(1,item('a')), attrs: { start: 1, type: 'unknown' } },
    list(1,{ type: 'listItem', content: [p('a'),p('ambiguous continuation')] }),
    list(1,{ type: 'listItem', content: [list(null,item('orphan'))] }), table(cell(p('nested table')))]) {
    const document = doc(table(cell(bad)));
    assert.throws(() => envelope.composeObservablePayload({ doc: document }), /TABLE|WORD_LIST_FORMAT_INVALID/);
    await assert.rejects(exported(document), /TABLE/);
    assert.throws(() => buildFormatIrParagraphs({ doc: document, text: '', sceneId:'bad' }), /TABLE/);
  }
});
test('Cell list depth, count and paragraph budgets reject limit plus one without recursion overflow', () => {
  const nested = depth => {
    let current = list(null,item('leaf'));
    for (let n=0;n<depth;n++) current = list(null,item('parent',current));
    return current;
  };
  for (const depth of [7,8]) assert.doesNotThrow(() => tables.inspectTable(table(cell(nested(depth)))));
  assert.throws(() => tables.inspectTable(table(cell(nested(9)))), /TABLE_LIST_LIMIT/);
  for (const count of [2047,2048]) assert.doesNotThrow(() => tables.inspectTable(table(cell(...Array.from({length:count},()=>list(null,item('')))))));
  assert.throws(() => tables.inspectTable(table(cell(...Array.from({length:2049},()=>list(null,item('')))))) , /TABLE_LIST_LIMIT/);
  for (const count of [49999,50000]) assert.doesNotThrow(() => tables.inspectTable(table(cell(list(null,...Array.from({length:count},()=>item('')))))));
  assert.throws(() => tables.inspectTable(table(cell(list(null,...Array.from({length:50001},()=>item('')))))) , /TABLE_PARAGRAPH_LIMIT/);
});

'use strict';
const { installMainDocxRoundAuthority } = require('../helpers/main-docx-round-authority');
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const stable = v => Array.isArray(v) ? '[' + v.map(stable).join(',') + ']' : v && typeof v === 'object' ? '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}' : JSON.stringify(v);
const sha = v => 'sha256:' + crypto.createHash('sha256').update(v).digest('hex');
const cryptoPort = { sha256Text: v => sha(v).slice(7), sha256Json: v => sha(stable(v)), byteLength: v => Buffer.byteLength(v) };
const tables = require('../../src/io/documentTables.js');
const envelope = require('../../src/core/document-content-envelope-v1.cjs');
const pending = require('../../src/core/word-pending-text-revisions-v1.cjs');
const notes = require('../../src/core/word-manuscript-notes-v1.cjs');
const { buildStoredZip, buildDocxMinBuffer } = require('../../src/export/docx/docxMinBuilder.js');
const { buildFullManuscriptDocxReviewPacketSource, buildFormatIrParagraphs } = require('../../src/export/docx/fullManuscriptDocxReviewPacketSource.js');
const { buildDocxReviewPacketBuffer } = require('../../src/export/docx/docxReviewPacketBuilder.js');
const { buildCanonicalNotesExport } = require('../../src/export/docx/docxReviewPacketNotes.js');
const modules = Promise.all([import('../../src/io/revisionBridge/index.mjs'), import('../../src/docxPageSetupBind.mjs'),
  import('../../src/derived/semanticMapping.mjs'), import('../../src/derived/styleMap.mjs')]);
const p = text => ({ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] });
const c = (...content) => ({ type: 'tableCell', attrs: { colspan: 1, rowspan: 1, colwidth: null }, content });
const r = (...content) => ({ type: 'tableRow', content });
const t = (...content) => ({ type: 'table', content });
const d = (...content) => ({ type: 'doc', content });
const list = text => ({ type: 'orderedList', attrs: { start: 7 }, content: [{ type: 'listItem', content: [p(text)] }] });
const tree = depth => depth === 1 ? t(r(c(p('deep 😀 é')))) : t(r(c(p('same'), tree(depth - 1), p(''))));
function fixture() {
  const inner = t(r(c(p('same')), c(list('deep sentinel'), p(''))), r(c(p('')), c(p('same'))));
  inner.attrs = { wordTable: { version: 1, grid: [1200, 1500], layout: 'fixed', widthDxa: 2700, shading: 'ABCDEF', borders: {} } };
  return d(p('before'), t(r(c(p('same'), inner, p(''), t(r(c(p('sibling')))), p('after nested')), c(p('same')))), p('after'));
}
async function exported(doc, extras = {}) {
  const [, docxPageSetupBindModule, semanticMappingModule, styleMapModule] = await modules;
  return buildDocxMinBuffer({ doc, bookProfile: { formatId: 'A4' } }, { docxPageSetupBindModule, semanticMappingModule, styleMapModule, ...extras });
}
async function imported(bytes) {
  const [bridge] = await modules;
  const report = bridge.buildDocxContentPreviewFromZipBytes(bytes);
  assert.equal(report.ok, true, JSON.stringify(report));
  const plan = bridge.buildDocxImportPreviewPlanFromContentPreview(report);
  assert.equal(plan.ok, true, JSON.stringify(plan));
  return { report, plan, doc: envelope.parseObservablePayload(plan.candidateCreatePlan.entries[0].content).doc };
}
const zip = parts => buildStoredZip(Object.entries(parts).map(([name, data]) => ({ name, data })));
async function partsOf(bytes) { return (await modules)[0].extractDocxReviewTransportPackagePartsFromZipBytes({ bytes }).parts; }

test('Nested tables retain recursive cells, explicit geometry, independent lists and empty/repeated leaves for five edited cycles', async () => {
  let expected = fixture(), actual = expected;
  for (let cycle = 0; cycle < 5; cycle++) {
    const paragraph = actual.content[1].content[0].content[0].content[1].content[0].content[0].content[0];
    paragraph.content = [{ type: 'text', text: `edited ${cycle} 😀` }]; expected = structuredClone(actual);
    const bytes = await exported(actual), parts = await partsOf(bytes);
    assert.equal((parts['word/document.xml'].match(/<w:tbl>/gu) || []).length, 3);
    assert.equal((parts['word/document.xml'].match(/<w:tblCellMar>/gu) || []).length, 3);
    assert.equal((parts['word/document.xml'].match(/<w:left w:w="0" w:type="dxa"\/>/gu) || []).length, 3);
    actual = (await imported(bytes)).doc;
    assert.deepEqual(actual, expected);
    assert.deepEqual(envelope.parseObservablePayload(envelope.composeObservablePayload({ doc: actual })).doc, expected);
    assert.equal(envelope.analyzeDocumentPlainTextRoundTrip(actual).safe, false);
  }
});

test('Nested depth four is exact; depth five, aggregate count/slots/leaves/lists and cycles fail before publication', () => {
  assert.doesNotThrow(() => tables.inspectTable(tree(4)));
  assert.throws(() => tables.inspectTable(tree(5)), /DEPTH_LIMIT/);
  const wide = count => t(r(c(...Array.from({ length: count }, () => t(r(c(p(''))))), p(''))));
  assert.doesNotThrow(() => tables.inspectTable(wide(255)));
  assert.throws(() => tables.inspectTable(wide(256)), /COUNT_LIMIT/);
  const large = t(...Array.from({ length: 256 }, () => r(...Array.from({ length: 128 }, () => c(p(''))))));
  // Individually legal children cannot each reset the root's aggregate grid budget.
  assert.throws(() => tables.inspectTable(t(r(c(large, structuredClone(large), p(''))))), /PARAGRAPH_LIMIT|GRID_LIMIT/);
  const mergedLarge = () => t(...Array.from({ length: 256 }, () => r({ ...c(p('')), attrs: { colspan: 128, rowspan: 1, colwidth: null } })));
  assert.throws(() => tables.inspectTable(t(r(c(mergedLarge(), mergedLarge(), p(''))))), /GRID_LIMIT/);
  assert.throws(() => tables.inspectTable(t(r(c(t(r(c(...Array.from({ length: 25000 }, () => p(''))))), t(r(c(...Array.from({ length: 25000 }, () => p(''))))), p(''))))), /PARAGRAPH_LIMIT/);
  assert.throws(() => tables.inspectTable(t(r(c(t(r(c(...Array.from({ length: 1024 }, () => list(''))))), t(r(c(...Array.from({ length: 1025 }, () => list(''))))), p(''))))), /LIST_LIMIT/);
  const cyclic = t(r(c(p('')))); cyclic.content[0].content[0].content.unshift(cyclic);
  assert.throws(() => tables.inspectTable(cyclic), /DEPTH_LIMIT/);
});

test('Nested projection rejects reused child identity, reordered ownership, missing trailing paragraph and cyclic metadata', () => {
  const records = tables.tableParagraphs(fixture().content[1], 'root');
  assert.ok(records.some(x => x.table.nested));
  assert.equal(tables.groupTableParagraphs(records)[0].cells[0].groups.filter(x => x.table).length, 2);
  const expected = records.map(x => ({ formatIr: { table: x.table } }));
  const resized = structuredClone(records);
  resized.filter(x => x.table.nested?.wordTable).forEach(x => { x.table.nested.wordTable.grid[0] -= 1; });
  assert.equal(tables.compareTableParagraphTopology(resized, expected).ok, false, 'nested explicit grid remains strict');
  assert.equal(tables.compareTableParagraphTopology(records, expected).ok, true);
  for (const mutate of [
    rows => { rows.find(x => x.table.nested).table.nested.column = 1; },
    rows => { rows.find(x => x.table.nested).table.nested.tableId = 'root'; },
    rows => { rows.find(x => x.table.nested).table.nested.paragraphCount++; },
    rows => { rows.find(x => x.table.nested).table.nested.writerAuthority = true; },
    rows => { rows.find(x => x.table.nested).table.nested.nested = rows[0].table; },
  ]) {
    const bad = structuredClone(records); mutate(bad);
    assert.equal(tables.compareTableParagraphTopology(bad, expected).ok, false);
  }
  assert.throws(() => tables.inspectTable(t(r(c(tree(1))))), /TRAILING_PARAGRAPH/);
});

test('Literal external nested table imports with exact parent order and rejects malformed owners/merge continuations', async () => {
  const [bridge] = await modules;
  const shell = await partsOf(await exported(d(p('placeholder'))));
  const inner = '<w:tbl><w:tblGrid><w:gridCol w:w="1440"/></w:tblGrid><w:tr><w:tc><w:p><w:r><w:t>inner</w:t></w:r></w:p></w:tc></w:tr></w:tbl>';
  const outer = `<w:tbl><w:tblGrid><w:gridCol w:w="1440"/></w:tblGrid><w:tr><w:tc><w:p><w:r><w:t>before</w:t></w:r></w:p>${inner}<w:p/></w:tc></w:tr></w:tbl>`;
  const make = body => zip({ ...shell, 'word/document.xml': `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>` });
  const expected = d(t(r(c(p('before'), t(r(c(p('inner')))), p('')))));
  const geometry = { version: 1, grid: [1440], layout: null, widthDxa: null, shading: null, borders: {} };
  expected.content[0].attrs = { wordTable: geometry };
  expected.content[0].content[0].content[0].content[1].attrs = { wordTable: geometry };
  assert.deepEqual((await imported(make(outer))).doc, expected);
  for (const xml of [outer.replace(`${inner}<w:p/>`, inner), outer.replace(inner, `<w:p>${inner}</w:p>`),
    outer.replace('<w:tc>', '<w:tc><w:tcPr><w:vMerge/></w:tcPr>'), outer.replace(inner, treeXml(5))]) {
    assert.equal(bridge.buildDocxContentPreviewFromZipBytes(make(xml)).ok, false);
  }
  function treeXml(level) { return level === 1 ? inner : inner.replace('<w:p><w:r><w:t>inner</w:t></w:r></w:p>', `${treeXml(level - 1)}<w:p/>`); }
});

test('Native authoring schema edits an inner cell and Tab grows only the inner table with durable nested bytes', async () => {
  const [{ getSchema }, { default: StarterKit }, { DocumentTables, nextTableCell }, { EditorState, TextSelection }] = await Promise.all([
    import('@tiptap/core'), import('@tiptap/starter-kit'), import('../../src/renderer/tiptap/documentTables.mjs'), import('@tiptap/pm/state'),
  ]);
  const schema = getSchema([StarterKit, DocumentTables]);
  const doc = schema.nodeFromJSON(d(t(r(c(p('parent'), t(r(c(p('inner')))), p('tail')))))); doc.check();
  let position;
  doc.descendants((node, pos) => { if (node.type.name === 'paragraph' && node.textContent === 'inner') position = pos + 1; });
  let state = EditorState.create({ doc, selection: TextSelection.create(doc, position) });
  state = state.apply(state.tr.insertText('edited '));
  assert.equal(nextTableCell(state, tr => { state = state.apply(tr); }), true);
  const value = state.doc.toJSON();
  assert.equal(value.content[0].content.length, 1);
  assert.equal(value.content[0].content[0].content[0].content[1].content.length, 2);
  assert.match(envelope.deriveVisibleTextFromDocument(value), /edited inner/);
  assert.deepEqual(envelope.parseObservablePayload(envelope.composeObservablePayload({ doc: value })).doc, JSON.parse(JSON.stringify(value)));
  const noteSchema = getSchema([StarterKit.configure({ heading: false, codeBlock: false }), DocumentTables.configure({ cellContent: '(paragraph | bulletList | orderedList | table)+' })]);
  noteSchema.nodeFromJSON(value).check();
  assert.equal(noteSchema.nodes.heading, undefined);
});

test('Footnote/endnote nested tables retain separate ownership and lists through export/import', async () => {
  const [bridge] = await modules;
  const body = fixture(), main = fixture(), sceneId = 'roman/a.txt', sceneContent = envelope.composeObservablePayload({ doc: main }), text = notes.sceneText(sceneContent);
  const blocks = buildFormatIrParagraphs({ doc: main, text: envelope.deriveVisibleTextFromDocument(main), sceneId }).map((block, i) => ({ ...block, sceneId, blockId: `b-${i}`, documentParagraphIndex: i }));
  const offset = text.indexOf('deep sentinel') + 2;
  const value = { schemaVersion: 1, projectId: 'p', notes: ['footnote', 'endnote'].map(kind => ({ id: kind, scope: 'manuscript', title: '', body: notes.validateNoteBody(body).text,
    manuscript: notes.bindManuscriptPayload({ body, kind, sceneId, offsetUtf16: offset, sceneContent }) })) };
  const projection = buildCanonicalNotesExport(value, [], blocks, 'p', { editableReturn: true });
  const bytes = await exported(main, { documentNotes: projection, noteBlocks: blocks });
  const result = bridge.buildDocxContentPreviewFromZipBytes(bytes);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.deepEqual(result.contentPreview.manuscriptNotes.map(n => n.body), [body, body]);
  const importedScene = (await imported(bytes)).plan.candidateCreatePlan.entries[0].content;
  const materialized = notes.materializeImportedNotes({ candidates: result.contentPreview.manuscriptNotes, sceneContent: importedScene,
    projectId: 'p', sceneId, importOperationId: 'nested-test', beforeText: null });
  assert.ok(materialized.imported.every(n => n.manuscript.reference.offsetUtf16 === offset));
  assert.ok(materialized.imported.every(n => n.manuscript.reference.sourceTextSha256 === notes.sha(text)));
  const beforeContent = importedScene;
  const changedDoc = structuredClone(main); changedDoc.content.unshift(p('Prefix'));
  const afterContent = envelope.composeObservablePayload({ doc: changedDoc });
  const reanchored = notes.planManuscriptNoteAnchorSave({ beforeText: materialized.afterText, projectId: 'p', sceneId, beforeContent, afterContent });
  assert.ok(JSON.parse(reanchored.afterText).notes.every(n => n.manuscript.reference.offsetUtf16 === offset + 7));
});

test('Nested tracked text preserves source/current, decisions and reopen; tracked row ambiguity remains rejected', async () => {
  const bytes = await exported(d(t(r(c(p('outer'), t(r(c(p('inner')))), p(''))))));
  const parts = await partsOf(bytes);
  const xml = parts['word/document.xml'];
  const changed = xml.replace(/<w:r>(<w:rPr>[^]*?<\/w:rPr>)?<w:t(?: [^>]*)?>inner<\/w:t><\/w:r>/u,
    '<w:del w:id="51" w:author="Reviewer"><w:r><w:delText>inner</w:delText></w:r></w:del><w:ins w:id="52" w:author="Reviewer"><w:r><w:t>changed</w:t></w:r></w:ins>');
  assert.notEqual(changed, xml);
  const parsed = (await imported(zip({ ...parts, 'word/document.xml': changed }))).doc;
  assert.match(pending.projection(parsed).original, /inner/);
  assert.match(pending.projection(parsed).current, /changed/);
  for (const action of ['acceptAll', 'rejectAll']) {
    const decided = pending.decide(parsed, { action }).doc;
    const reopened = envelope.parseObservablePayload(envelope.composeObservablePayload({ doc: decided })).doc;
    assert.match(envelope.deriveVisibleTextFromDocument(reopened), action === 'acceptAll' ? /changed/ : /inner/);
    assert.equal(pending.readLedger(pending.decide(reopened, { action: 'undo' }).doc).revisions.filter(r => r.state === 'pending').length, 2);
  }
  const ledger = pending.readLedger(parsed), bad = structuredClone(ledger);
  bad.revisions = [{ ...bad.revisions[0], paragraphIndex: 0, from: 0, to: 0, structure: { kind: 'tableRow', tableIndex: 0, rowIndex: 0 } }];
  assert.throws(() => pending.validateLedger(bad), /NESTED_TABLE_ROW_UNSUPPORTED/);
});

test('Authenticated nested review binds every XML parent occurrence and rejects flattened or crossing ranges', async () => {
  const [bridge] = await modules, doc = fixture();
  const source = buildFullManuscriptDocxReviewPacketSource({ projectId: 'nested', projectRoot: '/synthetic', scenes: [
    { sceneId: 'roman/a.txt', scenePath: '/synthetic/roman/a.txt', doc, text: envelope.deriveVisibleTextFromDocument(doc), order: 0 },
  ] });
  const bytes = buildDocxReviewPacketBuffer(source);
  const result = bridge.buildDocxReviewTransportAnalysisFromZipBytes({ bytes }, { cryptoPort });
  assert.equal(result.ok, true, JSON.stringify(result));
  const map = source.localAuthorityCapsule.exportMap;
  const bound = bridge.bindDocxReviewTableTopology(result.reviewIr, map);
  assert.equal(bound.ok, true, JSON.stringify(bound));
  assert.equal(bound.proof.automaticApplyAuthority, false);
  assert.equal(bound.reviewIr.structureChanges.filter(x => x.structureKind === 'tbl').length, 0);
  for (const mutate of [
    ir => { ir.formattingParagraphs.forEach(p => { if (p.table) delete p.table.nested; }); },
    ir => { ir.structureChanges.splice(ir.structureChanges.findIndex(x => x.structureKind === 'tbl'), 1); },
    ir => {
      const rows = ir.structureChanges.filter(x => x.structureKind === 'tbl').sort((a, b) => a.sourceXmlProvenance.openStart - b.sourceXmlProvenance.openStart);
      const child = rows[1].sourceXmlProvenance, opaque = ir.opaqueUnsupported.find(x => x.sourceXmlProvenance?.openStart === child.openStart);
      child.closeEnd = rows[0].sourceXmlProvenance.closeEnd + 1; opaque.sourceXmlProvenance.closeEnd = child.closeEnd;
    },
  ]) { const bad = structuredClone(result.reviewIr); mutate(bad); assert.equal(bridge.bindDocxReviewTableTopology(bad, map).ok, false); }
});

test('Four table levels and merged nested cells survive export/import without synthetic leaves', async () => {
  assert.deepEqual((await imported(await exported(d(tree(4))))).doc, d(tree(4)));
  const spanning = c(p('vertical'), tree(1), p('')); spanning.attrs.rowspan = 2;
  const horizontal = c(p('horizontal')); horizontal.attrs.colspan = 2;
  const doc = d(t(r(c(p('outer'), t(r(spanning, c(p('a')), c(p('b'))), r(horizontal)), p('')))));
  assert.deepEqual((await imported(await exported(doc))).doc, doc);
});

test('Ordinary table/list note references use the same empty-leaf coordinates and reject stale or forged imports', async () => {
  const main = d(p(''), list('listed 😀'), t(r(c(p('')), c(p('cell')))), p(''));
  const sceneContent = envelope.composeObservablePayload({ doc: main }), text = notes.sceneText(sceneContent);
  const sceneId = 'roman/a.txt', blocks = buildFormatIrParagraphs({ doc: main, text: envelope.deriveVisibleTextFromDocument(main), sceneId })
    .map((block, i) => ({ ...block, sceneId, blockId: `b-${i}`, documentParagraphIndex: i }));
  const candidates = [{ kind: 'footnote', paragraphIndex: 1, offsetUtf16: 7, body: d(p('note')) },
    { kind: 'endnote', paragraphIndex: 3, offsetUtf16: 2, body: d(p('another')) }];
  const state = notes.materializeImportedNotes({ candidates, sceneContent, projectId: 'p', sceneId, importOperationId: 'flat-list', beforeText: null });
  const exportedNotes = buildCanonicalNotesExport(JSON.parse(state.afterText), [], blocks, 'p', { editableReturn: true });
  assert.deepEqual(exportedNotes.notes.map(n => [n.paragraphIndex, n.offsetUtf16]), [[1,7],[3,2]]);
  assert.equal(notes.sceneText((await imported(await exported(main, { documentNotes: exportedNotes, noteBlocks: blocks }))).plan.candidateCreatePlan.entries[0].content), text);
  const stale = JSON.parse(state.afterText); stale.notes[0].manuscript.reference.sourceTextSha256 = '0'.repeat(64);
  assert.throws(() => buildCanonicalNotesExport(stale, [], blocks, 'p'), /ANCHOR_STALE/);
  for (const mutation of [{ paragraphIndex: 50 }, { offsetUtf16: 999 }, { offsetUtf16: 8 }, { authority: 'write' }]) {
    const bad = structuredClone(candidates); Object.assign(bad[0], mutation);
    assert.throws(() => notes.materializeImportedNotes({ candidates: bad, sceneContent, projectId: 'p', sceneId, importOperationId: 'bad', beforeText: null }), /NOTE_IMPORT_POINT/);
  }
});

test('Nested note styles bind to their own XML table occurrence without changing sibling or outer geometry', async () => {
  const [bridge] = await modules;
  const block = { sceneId: 'roman/a.txt', blockId: 'b', documentParagraphIndex: 0, text: 'Text', formatIr: { runs: [{ text: 'Text' }] } };
  const body = d(tree(3));
  const value = { schemaVersion: 1, projectId: 'p', notes: [{ id: 'footnote', scope: 'manuscript', title: '', body: notes.validateNoteBody(body).text,
    manuscript: notes.bindManuscriptPayload({ body, kind: 'footnote', sceneId: block.sceneId, offsetUtf16: 2, sceneContent: block.text }) }] };
  const projection = buildCanonicalNotesExport(value, [], [block], 'p', { editableReturn: true });
  const parts = await partsOf(await exported(d(p('Text')), { documentNotes: projection, noteBlocks: [block] }));
  let index = 0;
  parts['word/footnotes.xml'] = parts['word/footnotes.xml'].replace(/<w:tblPr>/gu, () => `<w:tblPr><w:tblStyle w:val="nested-${index++}"/>`);
  parts['word/styles.xml'] = (parts['word/styles.xml'] || '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"></w:styles>').replace('</w:styles>', ['112233','445566','778899'].map((fill, i) =>
    `<w:style w:type="table" w:styleId="nested-${i}"><w:tblPr><w:shd w:val="clear" w:fill="${fill}"/></w:tblPr></w:style>`).join('') + '</w:styles>');
  const report = bridge.buildDocxContentPreviewFromZipBytes(zip(parts));
  assert.equal(report.ok, true, JSON.stringify(report));
  const root = report.contentPreview.manuscriptNotes[0].body.content[0];
  assert.equal(root.attrs.wordTable.shading, '112233');
  const child = root.content[0].content[0].content[1];
  assert.equal(child.attrs.wordTable.shading, '445566');
  assert.equal(child.content[0].content[0].content[1].attrs.wordTable.shading, '778899');
});

test('Generic nested-cell comments use durable leaf ownership across import, reexport and safe text reanchor', async context => {
  const [bridge] = await modules;
  const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
  const safe = require('../fixtures/docx-import-real-authority.cjs');
  const commentCore = require('../../src/core/word-comment-anchor-save-v1.cjs');
  const generic = await import('../../src/io/revisionBridge/genericWordComments.mjs');
  const doc = fixture(), parts = await partsOf(await exported(doc));
  const innerRun = /<w:r>(<w:rPr>[^]*?<\/w:rPr>)?<w:t(?: [^>]*)?>deep sentinel<\/w:t><\/w:r>/u;
  const original = parts['word/document.xml'];
  parts['word/document.xml'] = original.replace(innerRun, run => `<w:commentRangeStart w:id="0"/>${run}<w:commentRangeEnd w:id="0"/><w:r><w:commentReference w:id="0"/></w:r>`);
  assert.notEqual(parts['word/document.xml'], original);
  parts['word/comments.xml'] = '<w:comments xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:comment w:id="0" w:author="Reviewer"><w:p><w:r><w:t>Nested comment</w:t></w:r></w:p></w:comment></w:comments>';
  const relation = '<Relationship Id="nested-comment" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments" Target="comments.xml"/>';
  parts['word/_rels/document.xml.rels'] = (parts['word/_rels/document.xml.rels'] || '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>').replace('</Relationships>', `${relation}</Relationships>`);
  parts['[Content_Types].xml'] = parts['[Content_Types].xml'].replace('</Types>', '<Override PartName="/word/comments.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml"/></Types>');
  const bytes = zip(parts), { report, plan } = await imported(bytes);
  const comments = plan.candidateCreatePlan.entries[0].comments;
  assert.equal(comments.length, 1);
  const index = comments[0].paragraphIndex;
  assert.ok(report.contentPreview.paragraphs[index].table.nested);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nested-comments-'));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const romanRoot = path.join(root, 'roman'); fs.mkdirSync(romanRoot);
  safe.rememberDocxImportPreviewPlanAdmission(plan);
  const result = await safe.applyDocxImportSafeCreate({ docxImportPreviewPlan: plan }, { projectRoot: root, romanRoot, projectId: 'nested-comments' });
  assert.equal(result.ok, true, JSON.stringify(result));
  const beforeText = fs.readFileSync(path.join(root, '.yalken/word-review/non-text-return-state.v1.json'), 'utf8');
  const state = JSON.parse(beforeText), thread = state.threads[0];
  const sceneContent = fs.readFileSync(path.join(root, thread.sceneId), 'utf8');
  const leaves = commentCore.paragraphs(sceneContent);
  assert.equal(leaves[index].text, 'deep sentinel');
  assert.equal(thread.anchor.sceneParagraphIndex, index);
  const source = buildFullManuscriptDocxReviewPacketSource({ projectId: 'nested-comments', projectRoot: root,
    scenes: [{ sceneId: thread.sceneId, scenePath: path.join(root, thread.sceneId), doc, text: envelope.deriveVisibleTextFromDocument(doc), observableContent: sceneContent, order: 0 }], nonTextReturnState: state });
  const analysis = bridge.buildDocxReviewTransportAnalysisFromZipBytes({ bytes: buildDocxReviewPacketBuffer(source) }, { cryptoPort });
  assert.equal(analysis.ok, true, JSON.stringify(analysis));
  assert.equal(analysis.reviewIr.commentThreads[0].quotedAnchorText, 'deep sentinel');
  const changed = structuredClone(doc);
  changed.content[1].content[0].content[0].content[1].content[0].content[1].content[0].content[0].content[0].content[0].text = 'prefix deep sentinel';
  const delta = commentCore.planCommentAnchorSave({ beforeText, projectId: 'nested-comments', sceneId: thread.sceneId,
    beforeContent: sceneContent, afterContent: envelope.composeObservablePayload({ doc: changed }) });
  assert.equal(JSON.parse(delta.afterText).threads[0].anchor.startUtf16, 7);
  const wrongTopology = structuredClone(doc); wrongTopology.content[1].content[0].content[0].content[1].content.reverse();
  assert.throws(() => commentCore.planCommentAnchorSave({ beforeText, projectId: 'nested-comments', sceneId: thread.sceneId,
    beforeContent: sceneContent, afterContent: envelope.composeObservablePayload({ doc: wrongTopology }) }), /STRUCTURE_UNSUPPORTED|ANCHOR_STALE|RANGE_CONFLICT/);
  const parsedAnalysis = bridge.buildDocxReviewTransportAnalysisFromZipBytes({ bytes }, { cryptoPort });
  for (const mutation of [
    rows => { rows[index].table.nested.column = 99; },
    rows => { rows[index].text = 'stale'; },
    rows => { rows[index].media = [{ offset: 0 }]; },
  ]) {
    const rows = structuredClone(report.contentPreview.paragraphs); mutation(rows);
    assert.throws(() => generic.genericCommentCandidates(parsedAnalysis, rows, { metadataValidated: true }), /TOPOLOGY|ANCHOR/);
  }
});

test('Native neutral note ligatures reset is bounded by namespace, value, attributes and empty run-property shape', async () => {
  const [bridge] = await modules;
  const block = { sceneId: 'roman/a.txt', blockId: 'b', documentParagraphIndex: 0, text: 'Text', formatIr: { runs: [{ text: 'Text' }] } };
  const body = d(tree(2));
  const value = { schemaVersion: 1, projectId: 'p', notes: [{ id: 'footnote', scope: 'manuscript', title: '', body: notes.validateNoteBody(body).text,
    manuscript: notes.bindManuscriptPayload({ body, kind: 'footnote', sceneId: block.sceneId, offsetUtf16: 2, sceneContent: block.text }) }] };
  const projection = buildCanonicalNotesExport(value, [], [block], 'p', { editableReturn: true });
  const parts = await partsOf(await exported(d(p('Text')), { documentNotes: projection, noteBlocks: [block] }));
  const original = parts['word/footnotes.xml'].replace('<w:footnotes ', '<w:footnotes xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" xmlns:foreign="urn:foreign" ');
  const neutral = '<w14:ligatures w14:val="none"/>';
  const make = marker => zip({ ...parts, 'word/footnotes.xml': original.replace(/<w:rPr>/gu, `<w:rPr>${marker}`) });
  const result = bridge.buildDocxContentPreviewFromZipBytes(make(neutral));
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.deepEqual(result.contentPreview.manuscriptNotes[0].body, body);
  for (const marker of [neutral.replace('none', 'standardContextual'), neutral.replace('w14:ligatures', 'foreign:ligatures'),
    neutral.replace('w14:val', 'foreign:val'), neutral.replace('/>', ' w14:extra="authority"/>'),
    '<w14:ligatures w14:val="none">injected</w14:ligatures>', '<w14:ligatures w14:val="none"><w:b/></w14:ligatures>']) {
    assert.equal(bridge.buildDocxContentPreviewFromZipBytes(make(marker)).ok, false, marker);
  }
});

test('Scene intake admits standalone and multiple nested revisions exclusively to pending route after exact source/map checks', async () => {
  const fs = require('node:fs'), vm = require('node:vm'), main = fs.readFileSync(require.resolve('../../src/main.js'), 'utf8');
  const sceneId = 'roman/nested.txt', doc = fixture(), raw = envelope.composeObservablePayload({ doc });
  const source = buildFullManuscriptDocxReviewPacketSource({ projectId: 'p', projectRoot: '/synthetic', scenes: [
    { sceneId, scenePath: '/synthetic/' + sceneId, doc, text: envelope.deriveVisibleTextFromDocument(doc), order: 0 },
  ] });
  const local = { ...source.localAuthorityCapsule, scope: 'scene', scenePath: '/synthetic/' + sceneId,
    expectedAuthority: { scope: 'scene', sceneId, rawSha256: sha(raw) } };
  local.exportMap.scope = 'scene'; local.exportMap.scenes[0].rawSha256 = sha(raw);
  local.baselineObservableContentBySceneId = { [sceneId]: raw };
  const sandbox = vm.createContext({ isPlainObjectValue: v => v && typeof v === 'object' && !Array.isArray(v),
    docxReviewPreviewSessionDetailString: v => typeof v === 'string' ? v : '', computeHash: v => sha(v).slice(7),
    cloneJsonSafe: structuredClone, buildFormatIrParagraphs, pendingTextRevisions: pending,
    loadDocumentContentEnvelopeModule: async () => envelope, docxReviewReturnIntakeBlocked: (reason, details) => ({ ok: false, reason, details }) });
  vm.runInContext(main.slice(main.indexOf('function docxReviewReturnIntakeSceneParagraphTexts('),
    main.indexOf('function buildDocxReviewPreviewSessionWriterContext(')), sandbox);
  const context = { sceneText: raw, scenePath: local.scenePath, targetScope: { id: sceneId } };
  const parserResult = { reviewIr: { textRevisions: [{ operation: 'insert', paragraphIndex: 3, text: 'added' }] } };
  const run = (authority = local, ctx = context) => sandbox.buildDocxReviewReturnIntakeSceneExportMapAuthority({ localAuthority: authority, context: ctx, parserResult });
  let result = await run(); assert.equal(result.ok, true, JSON.stringify(result)); assert.equal(result.pendingReturnOnly, true);
  assert.equal(result.writerContext, undefined); assert.equal(result.localBaseline, undefined);
  const staleBaseline = structuredClone(local); staleBaseline.baselineObservableContentBySceneId[sceneId] += 'stale';
  assert.equal((await run(staleBaseline)).reason, 'PENDING_RETURN_BASELINE_CONFLICT');
  const legacy = structuredClone(local); delete legacy.baselineObservableContentBySceneId;
  assert.notEqual((await run(legacy)).pendingReturnOnly, true);
  parserResult.reviewIr.textRevisions.push({ operation: 'delete', paragraphIndex: 5, text: 'same' });
  assert.equal((await run()).pendingReturnOnly, true);
  assert.equal((await run(local, { ...context, sceneText: raw + 'stale' })).reason, 'RTK_RETURN_INTAKE_STALE_CURRENT_SCENE');
  assert.equal((await run(local, { ...context, targetScope: { id: 'wrong' } })).reason, 'RTK_RETURN_INTAKE_WRONG_SCENE_ID');
  for (const mutate of [a => a.exportMap.scenes[0].blocks.pop(), a => { a.exportMap.scenes[0].blocks[2].canonicalTextSha256 = sha('forged'); },
    a => { a.exportMap.scenes[0].blocks[2].documentParagraphIndex = 1; }]) {
    const bad = structuredClone(local); mutate(bad); assert.equal((await run(bad)).ok, false);
  }
  // Actual activation guard runs after pending preparation and forbids legacy
  // accepted-text fallback when no validated ledger can be prepared.
  const guard = main.slice(main.indexOf('  if (returnIntake.localAuthorityCapsule?.pendingReturnOnly === true)'),
    main.indexOf('  const authenticatedFullManuscriptReturn ='));
  vm.runInContext('function guard(returnIntake) {' + guard + 'return "legacy";}', sandbox);
  sandbox.makeDocxReviewPreviewSessionTypedError = (code, reason) => ({ code, reason });
  assert.equal(sandbox.guard({ localAuthorityCapsule: { pendingReturnOnly: true } }).reason, 'PENDING_RETURN_DOCUMENT_REQUIRED');
});

test('Note return hashes exact validated leaf projection including empty edges and literal envelope syntax', () => {
  const { planNoteReturnDelta } = require('../../src/core/word-note-return-delta-v1.cjs');
  for (const literal of ['reference 😀', '[doc-v2 length=2]\n{}']) {
    const doc = d(p(''), t(r(c(p(''), t(r(c(p(literal)))), p('')))), p(''));
    const raw = envelope.composeObservablePayload({ doc }), sceneId = 'roman/a.txt', sceneText = notes.sceneText(raw);
    const manuscript = notes.bindManuscriptPayload({ kind: 'footnote', body: d(p('note')), sceneId,
      offsetUtf16: sceneText.indexOf(literal) + literal.length, sceneContent: raw });
    const document = { schemaVersion: 1, projectId: 'p', notes: [{ id: 'note-one', scope: 'manuscript',
      title: '', body: 'note', manuscript }] };
    const blocks = buildFormatIrParagraphs({ sceneId, doc, text: envelope.deriveVisibleTextFromDocument(doc) }).map((paragraph, i) => ({
      sceneId, blockId: 'block-' + i, documentParagraphIndex: i, text: paragraph.text, formatIr: paragraph.formatIr }));
    const baseline = buildCanonicalNotesExport(document, [], blocks, 'p', { editableReturn: true });
    const binding = baseline.sourceBindings[0];
    const input = { document, projectId: 'p', roundId: 'round-exact', artifactSha256: 'a'.repeat(64), baseline,
      exportMap: { scenes: [{ sceneId, blocks }] }, returnedParagraphs: blocks.map(b => ({ paragraphIndex: b.documentParagraphIndex, paragraphText: b.text, trackedRevision: false })),
      returnedNotes: [{ kind: 'footnote', transportIdentity: binding.transportIdentity, paragraphIndex: binding.documentParagraphIndex,
        offsetUtf16: binding.offsetUtf16, body: manuscript.body }], now: '2026-10-01T10:00:00Z' };
    const plan = planNoteReturnDelta(input); assert.equal(plan.unchanged, true); assert.deepEqual(plan.changes, []);
    assert.equal(document.notes[0].manuscript.reference.sourceTextSha256, notes.sha(sceneText));
    if (literal.includes('😀')) {
      input.returnedNotes[0].offsetUtf16--; assert.throws(() => planNoteReturnDelta(input), /POINT_INVALID/);
    }
  }
});

test('Actual renderer comment intent uses recursive cell/list leaf ordinal and rejects cross-leaf or split grapheme selection', async () => {
  const fs = require('node:fs'), vm = require('node:vm');
  const src = fs.readFileSync(require.resolve('../../src/renderer/editor.js'), 'utf8');
  const doc = fixture(), records = require('../../src/core/word-comment-anchor-save-v1.cjs').paragraphs(envelope.composeObservablePayload({ doc }));
  let selection;
  const sandbox = vm.createContext({ getSelectionOffsets: () => selection, composeDocumentContent: () => envelope.composeObservablePayload({ doc }),
    parseObservablePayload: envelope.parseObservablePayload, deriveVisibleTextFromDocument: envelope.deriveVisibleTextFromDocument, tableParagraphs: tables.tableParagraphs });
  vm.runInContext(src.slice(src.indexOf('function wordCommentSelectionIntent('), src.indexOf('async function handleWordCommentAction(')), sandbox);
  const index = records.findIndex(x => x.text === 'deep sentinel'), start = records.slice(0, index).reduce((n, x) => n + x.text.length + 1, 0);
  selection = { start, end: start + 4 }; assert.deepEqual(JSON.parse(JSON.stringify(sandbox.wordCommentSelectionIntent())),
    { paragraphIndex: index, startUtf16: 0, selectedText: 'deep' });
  selection.end = start + records[index].text.length + 2; assert.throws(() => sandbox.wordCommentSelectionIntent(), /одного абзаца/);
  const [{ getSchema }, { default: StarterKit }, { DocumentTables }, { EditorState, TextSelection }, coordinates] = await Promise.all([
    import('@tiptap/core'), import('@tiptap/starter-kit'), import('../../src/renderer/tiptap/documentTables.mjs'),
    import('@tiptap/pm/state'), import('../../src/renderer/tiptap/textCoordinates.mjs'),
  ]);
  const schema = getSchema([StarterKit, DocumentTables]), pmDoc = schema.nodeFromJSON(doc);
  const leaves = []; pmDoc.descendants((node, pos) => { if (node.isTextblock) leaves.push({ node, pos }); });
  for (const [ordinal, leaf] of leaves.entries()) {
    if (!leaf.node.textContent) continue;
    const state = EditorState.create({ doc: pmDoc, selection: TextSelection.create(pmDoc, leaf.pos + 1, leaf.pos + 1 + leaf.node.textContent.length) });
    selection = { start: coordinates.textOffsetForPosition(state.doc, state.selection.from), end: coordinates.textOffsetForPosition(state.doc, state.selection.to) };
    const intent = sandbox.wordCommentSelectionIntent();
    assert.equal(intent.paragraphIndex, ordinal, 'real PM selection must retain repeated/empty cell ordinal');
    assert.equal(intent.selectedText, leaf.node.textContent);
  }
  doc.content[0] = p('😀'); selection = { start: 0, end: 1 }; assert.throws(() => sandbox.wordCommentSelectionIntent(), /целые символы/);
});

test('Scene note-only evidence binds unchanged nested topology before actual Stage01 session validation', async () => {
  const [bridge] = await modules, doc = fixture(), sceneId = 'roman/nested.txt';
  const raw = envelope.composeObservablePayload({ doc }), text = notes.sceneText(raw);
  const manuscript = notes.bindManuscriptPayload({ kind: 'footnote', body: d(tree(2)), sceneId,
    offsetUtf16: text.indexOf('deep sentinel') + 2, sceneContent: raw });
  const source = buildFullManuscriptDocxReviewPacketSource({ projectId: 'p', projectRoot: '/synthetic',
    notesDocument: { schemaVersion: 1, projectId: 'p', notes: [{ id: 'note-a', scope: 'manuscript', title: '',
      body: notes.validateNoteBody(manuscript.body).text, manuscript }] },
    scenes: [{ sceneId, scenePath: '/synthetic/' + sceneId, doc, text: envelope.deriveVisibleTextFromDocument(doc), order: 0 }] });
  const parts = await partsOf(buildDocxReviewPacketBuffer(source));
  parts['word/footnotes.xml'] = parts['word/footnotes.xml'].replace('deep 😀 é', 'note edited 😀 é');
  const bytes = zip(parts);
  const worker = await require('../../src/main/rtkDocxReturnIntakeWorker.cjs').run({ bytes,
    returnedArtifactSha256: sha(bytes), requestId: 'nested-note-only-scene' });
  assert.equal(worker.ok, true, JSON.stringify(worker));
  assert.equal(bridge.verifyReturnEvidencePacketV1(worker.packet, { expectedArtifactSha256: sha(bytes) }).ok, true);
  const before = JSON.stringify(worker.packet), map = source.localAuthorityCapsule.exportMap;
  const options = { targetScope: { type: 'scene', id: sceneId }, formattingExportMap: map,
    authenticatedNoteExport: source.documentNotes, cryptoPort };
  const candidate = bridge.buildDocxReviewPreviewSessionCandidateFromEvidence(worker.packet, options);
  assert.ok(candidate.reviewPacket); assert.equal(candidate.reviewPacket.structuralChanges.length, 0);
  assert.equal(JSON.stringify(worker.packet), before, 'raw evidence is immutable');
  const stage = bridge.buildStage01FixedCorePreview({ projectId: 'p', sessionId: 'scene-note-return',
    baselineHash: sha(raw).slice(7), currentBaselineHash: sha(raw).slice(7),
    reviewPacket: candidate.reviewPacket, sourceViewState: candidate.sourceViewState });
  assert.equal(stage.ok, true, JSON.stringify(stage));
  for (const mutate of [
    m => { m.scenes[0].blocks.find(b => b.formatIr?.table?.nested).formatIr.table.nested.wordTable.grid[0]++; },
    m => { delete m.scenes[0].blocks.find(b => b.formatIr?.table?.nested).formatIr.table.nested; },
  ]) {
    const forged = structuredClone(map); mutate(forged);
    assert.equal(bridge.buildDocxReviewPreviewSessionCandidateFromEvidence(worker.packet, { ...options, formattingExportMap: forged }).ok, false);
  }
  const badPacket = structuredClone(worker.packet);
  badPacket.returnedProjection.structureChanges.splice(badPacket.returnedProjection.structureChanges.findIndex(x => x.structureKind === 'tbl'), 1);
  assert.equal(bridge.buildDocxReviewPreviewSessionCandidateFromEvidence(badPacket, options).ok, false);
  // Omitting authenticated map must never make the unchanged-table proof.
  const unbound = bridge.buildDocxReviewPreviewSessionCandidateFromEvidence(worker.packet, { ...options, formattingExportMap: null });
  assert.ok(unbound.reviewPacket.structuralChanges.length > 0);
});

test('Visible comment refresh after scene/save uses fresh query and discards switched, dirty, hidden and superseded responses', async () => {
  const fs = require('node:fs'), vm = require('node:vm'), src = fs.readFileSync(require.resolve('../../src/renderer/editor.js'), 'utf8');
  const requests = [], published = [];
  const sandbox = vm.createContext({ currentProjectId: 'p', currentDocumentId: 'scene-a', localEditGeneration: 1,
    currentMode: 'review', currentRightTab: 'comments', localDirty: false, lastAckedGeneration: 0,
    REVIEW_SURFACE_QUERY_ID: 'query.review', HTMLElement: class {}, reviewSurfaceHost: null,
    invokeWorkspaceQueryBridge: () => new Promise((resolve, reject) => { resolve.reject = reject; requests.push(resolve); }),
    loadStage10ProductStateFromQuery: async () => {}, setReviewSurfaceState: value => { published.push(value); return value; },
    updateSaveStateText: () => {}, refreshManuscriptNoteReferences: () => {}, updateInspectorSnapshot: () => {},
    window: { electronAPI: { onSetDirty: callback => { sandbox.dirtyCallback = callback; } } } });
  vm.runInContext(src.slice(src.indexOf('let reviewSurfaceQueryGeneration ='), src.indexOf('function setReviewSurfaceExactTextApplyTransientState(')), sandbox);
  const ackStart = src.indexOf('  window.electronAPI.onSetDirty(');
  vm.runInContext(src.slice(ackStart, src.indexOf('\n  });', ackStart) + 6), sandbox);
  const reply = resolve => resolve({ ok: true, reviewSurface: { commentAuthoring: { available: true } } });
  let promise = sandbox.refreshVisibleCommentProjection(); reply(requests.shift()); await promise; assert.equal(published.length, 1);
  for (const change of [() => { sandbox.currentDocumentId = 'scene-b'; }, () => { sandbox.currentProjectId = 'q'; },
    () => { sandbox.localEditGeneration++; }, () => { sandbox.localDirty = true; }, () => { sandbox.currentRightTab = 'notes'; }]) {
    Object.assign(sandbox, { currentProjectId: 'p', currentDocumentId: 'scene-a', localEditGeneration: 1, localDirty: false, currentRightTab: 'comments' });
    promise = sandbox.refreshVisibleCommentProjection(); change(); reply(requests.shift()); await promise; assert.equal(published.length, 1);
  }
  Object.assign(sandbox, { currentProjectId: 'p', currentDocumentId: 'scene-a', localEditGeneration: 1, localDirty: false, currentRightTab: 'comments' });
  const old = sandbox.refreshVisibleCommentProjection(), oldReply = requests.shift();
  const fresh = sandbox.refreshVisibleCommentProjection(); reply(requests.shift()); await fresh; reply(oldReply); await old;
  assert.equal(published.length, 2);
  sandbox.localDirty = true; sandbox.dirtyCallback({ state: false, ack: { kind: 'SAVED', savedGeneration: 1 } });
  assert.equal(sandbox.localDirty, false); assert.equal(requests.length, 1);
  reply(requests.shift()); await new Promise(resolve => setImmediate(resolve)); assert.equal(published.length, 3);
  promise = sandbox.refreshVisibleCommentProjection(); requests.shift().reject(Error('IPC failed')); await promise;
  assert.equal(published.at(-1).commentAuthoring.reason, 'COMMENT_PROJECTION_QUERY_FAILED');
  const count = published.length; promise = sandbox.refreshVisibleCommentProjection();
  sandbox.currentDocumentId = 'scene-b'; requests.shift().reject(Error('stale IPC failed')); await promise; assert.equal(published.length, count);
  sandbox.currentRightTab = 'notes'; assert.equal(sandbox.refreshVisibleCommentProjection(), undefined); assert.equal(requests.length, 0);
  assert.match(src, /updateSaveStateText\('loaded'\);\s*void refreshManuscriptNoteReferences\(\);\s*void refreshVisibleCommentProjection\(\);/u);
  assert.match(src, /await window\.electronAPI\.invokeSaveLifecycleSignalBridge[^]*signalId === 'signal.autoSave.request'\) void refreshVisibleCommentProjection\(\)/u);
});

function installSingleScenePublicationGate(harness) {
  const fs = require('node:fs'), vm = require('node:vm'), { createRequire } = require('node:module');
  const mainPath = require.resolve('../../src/main.js'), main = fs.readFileSync(mainPath, 'utf8');
  harness.context.require = createRequire(mainPath);
  for (const name of ['scenePendingExportSemantics', 'buildSceneNoteReviewPublicationGate', 'docxReviewReturnIntakeProductBudgets']) {
    const declaration = main.match(new RegExp('(?:async )?function ' + name + '\\([^]*?\\n}(?=\\n|$)'));
    assert.ok(declaration, name); vm.runInContext(declaration[0], harness.context);
  }
  vm.runInContext(main.match(/const DOCX_REVIEW_RETURN_INTAKE_FULL_MANUSCRIPT_PRODUCT_BUDGETS = Object.freeze\([^]*?\n}\);/)[0], harness.context);
  return (source, bytes, bridge) => harness.context.buildSceneNoteReviewPublicationGate(source, bytes, bridge);
}

test('Single-scene source reexports nested pending insertion/deletion and decided states without changing block identity or signed raw', async () => {
  const fs = require('node:fs'), path = require('node:path'), { createRequire } = require('node:module');
  const harnessFile = path.join(__dirname, 'rtk-word-c2-rich-scene-reexport.contract.test.js');
  const sourceText = fs.readFileSync(harnessFile, 'utf8').split('\nfunction doc(paragraphs)')[0] + '\nmodule.exports={harness};';
  const module = { exports: {} };
  new Function('require', 'module', '__dirname', sourceText)(createRequire(harnessFile), module, __dirname);
  const geometric = d(t(r(c(p('outer'), t(r(c(p('inner')))), p('')))));
  const bindGeometry = node => { if (node.type === 'table') node.attrs = { wordTable: { version: 1, grid: [1440], layout: 'fixed', widthDxa: 1440, shading: null, borders: {} } };
    for (const child of node.content || []) bindGeometry(child); };
  bindGeometry(geometric);
  const before = await partsOf(await exported(geometric));
  const changed = before['word/document.xml'].replace(/<w:r>(<w:rPr>[^]*?<\/w:rPr>)?<w:t(?: [^>]*)?>inner<\/w:t><\/w:r>/u,
    '<w:del w:id="51" w:author="Reviewer"><w:r><w:delText>inner</w:delText></w:r></w:del><w:ins w:id="52" w:author="Reviewer"><w:r><w:t>changed</w:t></w:r></w:ins>');
  assert.notEqual(changed, before['word/document.xml']);
  const pendingDoc = (await imported(zip({ ...before, 'word/document.xml': changed }))).doc;
  for (const action of [null, 'acceptAll', 'rejectAll']) {
    const doc = action ? pending.decide(pendingDoc, { action }).doc : pendingDoc;
    const raw = envelope.composeObservablePayload({ doc }), h = await module.exports.harness(raw), source = await h.run();
    const bytes = buildDocxReviewPacketBuffer(source), xml = (await partsOf(bytes))['word/document.xml'];
    assert.equal((xml.match(/<w:ins\b/gu) || []).length, action ? 0 : 1);
    assert.equal((xml.match(/<w:del\b/gu) || []).length, action ? 0 : 1);
    assert.equal((xml.match(/<w:tbl>/gu) || []).length, 2);
    assert.equal(source.exportCapsule.rawSha256, sha(raw));
    const clean = pending.normalizeNode(doc), cleanRaw = envelope.composeObservablePayload({ doc: clean });
    const cleanSource = await (await module.exports.harness(cleanRaw)).run();
    assert.deepEqual(source.blocks.map(b => [b.blockId, b.paragraphId, b.canonicalTextSha256, b.canonicalMarksSha256]),
      cleanSource.blocks.map(b => [b.blockId, b.paragraphId, b.canonicalTextSha256, b.canonicalMarksSha256]));
    assert.ok(source.blocks.every(b => Array.isArray(b.pendingRevisionSegments)));
    const round = (await imported(bytes)).doc;
    assert.equal(envelope.deriveVisibleTextFromDocument(round), envelope.deriveVisibleTextFromDocument(doc));
    if (!action) {
      assert.deepEqual(pending.projection(round).original, pending.projection(doc).original);
      assert.deepEqual(pending.projection(round).current, pending.projection(doc).current);
    }
    const [bridge] = await modules;
    const parsed = bridge.buildDocxReviewTransportAnalysisFromZipBytes({ bytes, hmacSecret: source.forbiddenSecret,
      expectedAuthority: source.localAuthorityCapsule.expectedAuthority }, { cryptoPort: h.context.createRtkReviewTransportCryptoPort() });
    assert.equal(parsed.authorityCarrier.status, 'verified-baseline-bound');
    const gate = installSingleScenePublicationGate(h);
    if (!action) assert.deepEqual(JSON.parse(JSON.stringify(h.context.scenePendingExportSemantics(pending.readLedger(doc), source.localAuthorityCapsule.exportMap.exportTypography))), JSON.parse(JSON.stringify(h.context.scenePendingExportSemantics(pending.readLedger(round), source.localAuthorityCapsule.exportMap.exportTypography))));
    const publicationGate = await gate(source, bytes, bridge);
    assert.equal(publicationGate.code, 'REVIEW_DOCX_EXPORT_NOTES_VERIFIED');
    assert.equal(publicationGate.pendingSemanticsVerified, action ? undefined : true);
    let written, activated = false, revalidated = false;
    const result = await require('../../src/export/docx/docxReviewPacketExportHandler.js').runDocxReviewPacketExport({}, {
      normalizeExportPayload: value => value, makeTypedReviewDocxExportError: (code, reason, details) => ({ ok: false, code, reason, details }),
      resolveDocxReviewPacketExportPath: async () => '/synthetic/result.docx', validateDocxExportTarget: async () => ({ ok: true }),
      readDocxReviewPacketExportSource: async () => source,
      buildDocxReviewPacketBuffer: async () => ({ documentBuffer: bytes, exportCapsule: source.exportCapsule, publicationGate }),
      queueDiskOperation: operation => operation(), writeBufferAtomic: async (_, buffer) => { written = buffer; },
      revalidateDocxReviewPacketExportSource: async () => { revalidated = true; }, updateStatus: () => {},
      readWrittenBuffer: async () => written, activateReviewDocxExportAuthority: async () => { activated = true; return { ok: true }; },
    });
    assert.equal(result.ok, true, JSON.stringify(result)); assert.equal(activated, true); assert.equal(revalidated, true);
    if (!action) {
      const parts = await partsOf(bytes); let mutationIndex = 0;
      for (const mutate of [xml => xml.replace('changed', 'changed BAD'), xml => xml.replace('Reviewer', 'Other author'),
        xml => xml.replace('<w:ins ', '<w:del ').replace('</w:ins>', '</w:del>'),
        xml => xml.replace(/(<w:r>)(<w:t[^>]*>changed<\/w:t>)/u, '$1<w:rPr><w:b/></w:rPr>$2'),
        xml => xml.replace(/w:gridCol w:w="(\d+)"/u, (_, width) => `w:gridCol w:w="${Number(width) + 20}"`)]) {
        const altered = mutate(parts['word/document.xml']); assert.notEqual(altered, parts['word/document.xml']);
        await assert.rejects(gate(source, zip({ ...parts, 'word/document.xml': altered }), bridge), undefined, 'mutation ' + mutationIndex++);
      }
      const withNote = { schemaVersion: 1, projectId: 'project-test', notes: [{ id: 'n', title: '', scope: 'manuscript', body: 'body',
        manuscript: notes.bindManuscriptPayload({ kind: 'footnote', body: d(p('body')), sceneId: 'roman/scene.txt', offsetUtf16: 1,
          sceneContent: envelope.deriveVisibleTextFromDocument(doc) }) }] };
      withNote.notes[0].manuscript.reference.sourceTextSha256 = notes.sha(source.blocks.map(block => block.text).join('\n'));
      const noteHarness = await module.exports.harness(raw, { notesDocument: withNote });
      await assert.rejects(async () => {
        const noteSource = await noteHarness.run();
        return installSingleScenePublicationGate(noteHarness)(noteSource, buildDocxReviewPacketBuffer(noteSource), bridge);
      }, /NOTE_RETURN_MANUSCRIPT_CHANGED|REVIEW_DOCX_EXPORT_NOTE_AUTHORITY_MISMATCH|PENDING/);
    }
  }
  const sameAuthor = { operation: 'insert', author: 'Reviewer', date: '', dateUtc: '', groupId: null, paragraphIndex: 0, state: 'pending' };
  const distinct = pending.bindLedger({ schemaVersion: 1, source: d(p('AB')), undo: [], redo: [], revisions: [
    { ...sameAuthor, id: 'revision-1', nativeId: '1', from: 0, to: 1 },
    { ...sameAuthor, id: 'revision-2', nativeId: '2', from: 1, to: 2 },
  ] });
  const distinctHarness = await module.exports.harness(envelope.composeObservablePayload({ doc: distinct }));
  const distinctSource = await distinctHarness.run(), distinctBytes = buildDocxReviewPacketBuffer(distinctSource), [bridge] = await modules;
  const distinctGate = installSingleScenePublicationGate(distinctHarness);
  assert.equal((await distinctGate(distinctSource, distinctBytes, bridge)).pendingSemanticsVerified, true);
  const distinctParts = await partsOf(distinctBytes);
  const mergedXml = distinctParts['word/document.xml'].replace(/<\/w:ins><w:ins[^>]*>/u, '');
  assert.notEqual(mergedXml, distinctParts['word/document.xml']);
  const mergedBytes = zip({ ...distinctParts, 'word/document.xml': mergedXml });
  const mergedDoc = (await imported(mergedBytes)).doc;
  assert.equal(pending.projection(mergedDoc).current, pending.projection(distinct).current);
  assert.equal(pending.projection(mergedDoc).original, pending.projection(distinct).original);
  assert.equal(pending.readLedger(mergedDoc).revisions.length, 1);
  await assert.rejects(distinctGate(distinctSource, mergedBytes, bridge), /PENDING_SEMANTICS_MISMATCH/);
});

test('Single-scene pending structural projection retains boundary and row metadata with exact Current and Original', async () => {
  const fs = require('node:fs'), vm = require('node:vm');
  const main = fs.readFileSync(require.resolve('../../src/main.js'), 'utf8');
  const context = vm.createContext({ pendingTextRevisions: pending, buildFormatIrParagraphs,
    computeHash: value => sha(value).slice(7), deriveWordBookmarkNameV1Cjs: require('../../src/export/docx/docxReviewPacketBuilder.js').deriveWordBookmarkNameV1 });
  vm.runInContext(main.slice(main.indexOf('function buildReviewDocxPacketBlocks('), main.indexOf('// CANON-01: the single-scene hash tree')), context);
  const baseRevision = { id: 'revision-1', nativeId: '1', author: 'Reviewer', date: '', dateUtc: '', groupId: null, operation: 'delete', state: 'pending' };
  const cases = [
    { source: d(t(r(c(p('outer'), t(r(c(p('a'), p('b')))), p(''))))), revision: { ...baseRevision, paragraphIndex: 1, from: 1, to: 1, boundary: 'paragraph' }, field: 'pendingBoundaryRevision' },
    { source: d(t(r(c(p('deleted row'))), r(c(p('retained row'))))), revision: { ...baseRevision, paragraphIndex: 0, from: 0, to: 0, structure: { kind: 'tableRow', tableIndex: 0, rowIndex: 0 } }, field: 'pendingRowRevision' },
  ];
  for (const item of cases) {
    const sourceDoc = pending.normalizeNode(item.source); pending.paragraphs(sourceDoc).forEach(paragraph => { paragraph.content ||= []; });
    const pendingDoc = pending.bindLedger({ schemaVersion: 1, source: sourceDoc, revisions: [item.revision], undo: [], redo: [] });
    for (const action of [null, 'acceptAll', 'rejectAll']) {
      const doc = action ? pending.decide(pendingDoc, { action }).doc : pendingDoc;
      const sceneId = 'roman/structural.txt', text = envelope.deriveVisibleTextFromDocument(doc);
      const blocks = context.buildReviewDocxPacketBlocks(text, sceneId, cryptoPort, { doc });
      const full = buildFullManuscriptDocxReviewPacketSource({ projectId: 'p', projectRoot: '/synthetic', scenes: [{ sceneId, scenePath: '/synthetic/' + sceneId, doc, text, order: 0 }] });
      const fields = block => ({ text: block.text, formatIr: block.formatIr, segments: block.pendingRevisionSegments,
        row: block.pendingRowRevision, boundary: block.pendingBoundaryRevision, paragraph: block.pendingParagraphRevision });
      assert.deepEqual(JSON.parse(JSON.stringify(blocks.map(fields))), JSON.parse(JSON.stringify(full.blocks.map(fields))));
      assert.equal(blocks.filter(b => b[item.field]).length, action ? 0 : 1);
      const round = (await imported(buildDocxReviewPacketBuffer({ ...full, blocks }))).doc;
      assert.equal(envelope.deriveVisibleTextFromDocument(round), text);
      if (!action) assert.equal(pending.projection(round).original, pending.projection(doc).original);
    }
  }
});

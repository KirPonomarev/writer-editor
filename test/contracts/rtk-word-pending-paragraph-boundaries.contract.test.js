'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const model = require('../../src/core/word-pending-text-revisions-v1.cjs');
const recording = require('../../src/core/word-pending-recording-v1.cjs');
const envelope = require('../../src/core/document-content-envelope-v1.cjs');
const { buildStoredZip, buildDocxMinBuffer } = require('../../src/export/docx/docxMinBuilder.js');
const { buildFullManuscriptDocxReviewPacketSource } = require('../../src/export/docx/fullManuscriptDocxReviewPacketSource.js');
const { buildDocxReviewPacketBuffer } = require('../../src/export/docx/docxReviewPacketBuilder.js');
const modules = Promise.all([import('../../src/io/revisionBridge/index.mjs'), import('../../src/docxPageSetupBind.mjs'),
  import('../../src/derived/semanticMapping.mjs'), import('../../src/derived/styleMap.mjs')]);
const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const provenance = 'w:author="Mac reviewer" w:date="2026-09-29T03:52:00Z"';
const run = text => text ? `<w:r><w:rPr><w:rFonts w:ascii="Aptos" w:hAnsi="Aptos" w:eastAsia="Aptos" w:cs="Aptos"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr><w:t xml:space="preserve">${text}</w:t></w:r>` : '';
const mark = (kind, id) => `<w:rPr><w:${kind} w:id="${id}" ${provenance}/></w:rPr>`;
const p = (text, kind = '', id = 0, align = 'left') => `<w:p><w:pPr><w:jc w:val="${align}"/>${kind ? mark(kind, id) : ''}</w:pPr>${run(text)}</w:p>`;
const body = p('Split 😀 ', 'ins', 1) + p('here.') + p('Merge.', 'del', 2, 'center') + p('Next.', '', 0, 'right');
function pack(body) {
  return buildStoredZip([
    { name: '[Content_Types].xml', data: '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>' },
    { name: '_rels/.rels', data: '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="r1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>' },
    { name: 'word/document.xml', data: `<w:document xmlns:w="${W}"><w:body>${body}</w:body></w:document>` },
  ]);
}
async function parse(bytes) {
  const [bridge] = await modules, preview = bridge.buildDocxContentPreviewFromZipBytes(bytes);
  assert.equal(preview.ok, true, JSON.stringify(preview));
  const plan = bridge.buildDocxImportPreviewPlanFromContentPreview(preview); assert.equal(plan.ok, true, JSON.stringify(plan));
  return envelope.parseObservablePayload(plan.candidateCreatePlan.entries[0].content).doc;
}
async function cycle(doc, profile) {
  const [, docxPageSetupBindModule, semanticMappingModule, styleMapModule] = await modules;
  const bytes = profile === 'minimum' ? buildDocxMinBuffer({ doc, bookProfile: { formatId: 'A4' } },
    { docxPageSetupBindModule, semanticMappingModule, styleMapModule }) : buildDocxReviewPacketBuffer(
      buildFullManuscriptDocxReviewPacketSource({ projectId: 'boundaries', projectRoot: '/synthetic', scenes: [
        { sceneId: 'roman/a.txt', scenePath: '/synthetic/roman/a.txt', doc, text: envelope.deriveVisibleTextFromDocument(doc), order: 0 },
      ] }));
  return parse(bytes);
}
const clean = model.normalizeNode;
test('Word paragraph-mark revisions preserve Original/Current, following paragraph properties and independent run marks', async () => {
  const doc = await parse(pack(body)), ledger = model.readLedger(doc), view = model.projection(doc);
  assert.equal(view.original, 'Split 😀 here.\nMerge.\nNext.');
  assert.equal(view.current, 'Split 😀 \nhere.\nMerge.Next.');
  assert.deepEqual(ledger.revisions.map(r => [r.operation, r.boundary, r.from, r.to]), [['insert', 'paragraph', 9, 9], ['delete', 'paragraph', 6, 6]]);
  assert.equal(doc.content[2].attrs.textAlign, 'right');
  assert.equal(model.materialize(ledger, 'original').content[1].attrs.textAlign, 'center');
});
test('Paragraph boundary decisions are independent, durable and undoable in either order', async () => {
  const initial = await parse(pack(body));
  for (const first of ['revision-1', 'revision-2']) for (const action of ['accept', 'reject']) {
    const decided = model.decide(initial, { action, revisionId: first }).doc;
    const reopened = envelope.parseObservablePayload(envelope.composeObservablePayload({ doc: decided })).doc;
    assert.deepEqual(reopened, decided);
    const undone = model.decide(reopened, { action: 'undo' }).doc;
    assert.deepEqual(clean(undone), clean(initial));
    assert.deepEqual(model.decide(undone, { action: 'redo' }).doc, decided);
    for (const profile of ['minimum', 'full']) {
      const returned = await cycle(decided, profile);
      assert.deepEqual(clean(returned), clean(decided));
      assert.equal(model.readLedger(returned).revisions.length, 1);
    }
  }
  for (const action of ['acceptAll', 'rejectAll']) {
    const result = model.decide(initial, { action }).doc;
    for (const profile of ['minimum', 'full']) assert.deepEqual(clean(await cycle(result, profile)), clean(result));
  }
});
test('Five minimum/full serialization and returned-history cycles retain pending paragraph boundaries and identities', async () => {
  const initial = await parse(pack(body));
  for (const profile of ['minimum', 'full']) {
    let value = initial;
    for (let round = 1; round <= 5; round++) {
      const imported = await cycle(value, profile);
      value = model.replaceFromReturn(value, imported, { roundId: profile + round, artifactSha256: String(round).repeat(64) }).doc;
      for (const mode of ['original', 'current']) assert.deepEqual(clean(model.materialize(model.readLedger(value), mode)), clean(model.materialize(model.readLedger(initial), mode)));
      assert.deepEqual(model.readLedger(value).revisions.map(r => r.id), ['revision-1', 'revision-2']);
    }
    for (let i = 0; i < 5; i++) value = model.decide(value, { action: 'undo' }).doc;
    assert.deepEqual(model.readLedger(value).revisions, model.readLedger(initial).revisions);
  }
});
test('Chained empty paragraph boundaries retain visible empty paragraphs and do not lose neighboring text', async () => {
  for (const xml of [p('', 'ins', 1) + p('', 'ins', 2) + p('text'), p('text', 'del', 1) + p('', 'del', 2) + p('')]) {
    const doc = await parse(pack(xml));
    for (const profile of ['minimum', 'full']) assert.deepEqual(clean(await cycle(doc, profile)), clean(doc));
  }
});
test('Orphan, duplicate, cross-container, foreign and non-endpoint boundaries fail before import write authority', async () => {
  const [bridge] = await modules;
  const bad = [p('last', 'del', 1), body.replace(mark('ins', 1), mark('ins', 1) + mark('del', 3)),
    body.replace('<w:ins w:id="1"', '<q:ins xmlns:q="urn:foreign" w:id="1"'),
    `<w:tbl><w:tr><w:tc>${p('a', 'del', 1)}</w:tc><w:tc>${p('b')}</w:tc></w:tr></w:tbl>`,
    body.replace(mark('ins', 1), '<w:ins w:id="1" ' + provenance + '/>'),
  ];
  for (const xml of bad) assert.equal(bridge.buildDocxContentPreviewFromZipBytes(pack(xml)).ok, false, xml);
  const ledger = model.readLedger(await parse(pack(body)));
  for (const change of [l => { l.revisions[0].from--; }, l => { l.revisions[0].groupId = 'group-1'; },
    l => { l.revisions[0].boundary = 'cell'; }, l => { l.revisions[0].moveName = 'fake'; }]) {
    const next = structuredClone(ledger); change(next); assert.throws(() => model.bindLedger(next));
  }
});

const authored = (...values) => ({ type: 'doc', content: values.map(text => ({ type: 'paragraph', attrs: { textAlign: 'left' }, content: text ? [{ type: 'text', text,
  marks: [{ type: 'textStyle', attrs: { fontFamily: 'Aptos', fontSize: '12pt' } }] }] : [] })) });
const meta = { author: 'Mac owner', date: '2026-09-29T04:00:00.000Z' };
test('Recording Enter, Delete, blank paragraphs, Unicode and typing preserves exact Original and one stable autosave frame', async () => {
  const cases = [[authored('abc def'), authored('abc', ' def')], [authored('abc def'), authored('abc', 'NEW def')], [authored('abc def', 'ghi'), authored('abc', ' defghi')],
    [authored('abc', 'def'), authored('abcdef')], [authored('abc', 'def'), authored('abcNEWdef')],
    [authored('abc😀defghi'), authored('abc😀', 'def', 'ghi')], [authored('abc'), authored('', '', 'abc')],
    [authored('abc', '', ''), authored('abc')], [authored('a', 'b'), authored('new', 'lines', 'text')]];
  for (const [before, working] of cases) {
    const result = recording.derive(before, working, meta).doc, ledger = model.readLedger(result);
    assert.deepEqual(clean(result), clean(working)); assert.deepEqual(clean(model.materialize(ledger, 'original')), clean(before));
    assert.equal(ledger.roundUndo.length, 1);
    assert.ok(ledger.revisions.some(model.isParagraphBoundary));
    assert.deepEqual(recording.derive(before, working, meta).doc, result);
    assert.deepEqual(clean(model.decide(result, { action: 'undo' }).doc), clean(before));
    for (const profile of ['minimum', 'full']) assert.deepEqual(clean(await cycle(result, profile)), clean(working));
  }
});
test('New recording after a pending merge maps visible edits into the existing source without losing its boundary identity', () => {
  const merged = recording.derive(authored('abc', 'def'), authored('abcdef'), meta).doc;
  const before = model.readLedger(merged).revisions[0];
  const changed = recording.derive(merged, authored('abcNEWdef'), meta).doc;
  assert.equal(model.projection(changed).original, 'abc\ndef');
  assert.equal(model.projection(changed).current, 'abcNEWdef');
  const boundary = model.readLedger(changed).revisions.find(model.isParagraphBoundary);
  assert.equal(boundary.id, before.id); assert.equal(boundary.author, before.author);
  assert.equal(model.readLedger(changed).roundUndo.length, 2);
  assert.deepEqual(clean(model.decide(changed, { action: 'undo' }).doc), clean(merged));
});
test('Boundary insertion outside an existing pending run preserves its identity; insertion inside is rejected', () => {
  const pending = recording.derive(authored('abc', 'tail'), authored('abcXYZ', 'tail'), meta).doc;
  const changed = recording.derive(pending, authored('abc', 'XYZ', 'tail'), meta).doc;
  assert.equal(model.readLedger(changed).revisions.find(r => !r.boundary).id, 'revision-1');
  assert.equal(model.projection(changed).original, 'abc\ntail');
  assert.throws(() => recording.derive(pending, authored('abcX', 'YZ', 'tail'), meta), /EXISTING_REVISION_OVERLAP/);
});
test('Paragraph boundaries inside the same table cell survive import/export without merging cells', async () => {
  const xml = `<w:tbl><w:tblPr><w:tblW w:w="4000" w:type="dxa"/></w:tblPr><w:tblGrid><w:gridCol w:w="4000"/></w:tblGrid><w:tr><w:tc><w:tcPr><w:tcW w:w="4000" w:type="dxa"/></w:tcPr>${p('left', 'del', 1)}${p('right')}</w:tc></w:tr></w:tbl>`;
  const initial = await parse(pack(xml));
  assert.equal(model.projection(initial).current, 'leftright');
  assert.equal(initial.content[0].content[0].content[0].content.length, 1);
  for (const profile of ['minimum', 'full']) assert.deepEqual(clean(await cycle(initial, profile)), clean(initial));
});

test('Recording merge retains editor properties as a separate paragraph-format decision with independently reversible boundary', async () => {
  const before = authored('first', 'second'), working = authored('firstsecond');
  before.content[0].attrs.textAlign = 'center'; before.content[1].attrs.textAlign = 'right'; working.content[0].attrs.textAlign = 'center';
  const result = recording.derive(before, working, meta).doc, ledger = model.readLedger(result);
  assert.deepEqual(ledger.revisions.map(r => r.operation), ['delete', 'format']);
  assert.deepEqual(clean(model.materialize(ledger, 'original')), clean(before));
  assert.deepEqual(clean(result), clean(working));
  for (const profile of ['minimum', 'full']) assert.deepEqual(clean(await cycle(result, profile)), clean(working));
  const format = ledger.revisions.find(r => r.operation === 'format');
  assert.equal(model.decide(result, { action: 'reject', revisionId: format.id }).doc.content[0].attrs.textAlign, 'right');
});

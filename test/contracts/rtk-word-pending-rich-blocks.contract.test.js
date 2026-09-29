'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const model = require('../../src/core/word-pending-text-revisions-v1.cjs');
const recording = require('../../src/core/word-pending-recording-v1.cjs');
const envelope = require('../../src/core/document-content-envelope-v1.cjs');
const { buildDocxMinBuffer, buildStoredZip } = require('../../src/export/docx/docxMinBuilder.js');
const { buildDocxReviewPacketBuffer } = require('../../src/export/docx/docxReviewPacketBuilder.js');
const { buildFullManuscriptDocxReviewPacketSource } = require('../../src/export/docx/fullManuscriptDocxReviewPacketSource.js');
const modules = Promise.all([import('../../src/io/revisionBridge/index.mjs'), import('../../src/docxPageSetupBind.mjs'),
  import('../../src/derived/semanticMapping.mjs'), import('../../src/derived/styleMap.mjs')]);
const p = text => ({ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] });
const cell = (...content) => ({ type: 'tableCell', attrs: { colspan: 1, rowspan: 1, colwidth: null }, content });
const item = (text, ...children) => ({ type: 'listItem', content: [p(text), ...children] });
const ordered = (start, ...content) => ({ type: 'orderedList', attrs: { start }, content });
const bullet = (...content) => ({ type: 'bulletList', content });
const text = node => (node.content || []).map(n => n.type === 'hardBreak' ? '\n' : n.text).join('');
function fixture() {
  const merged = cell(ordered(7, item('same', bullet(item('oldNEW'), item('same'))), item('same')), p(''));
  merged.attrs.rowspan = 2;
  const wide = cell(ordered(3, item('restart'), item('same')), p('')); wide.attrs.colspan = 2;
  const source = { type: 'doc', content: [p('before'), { type: 'table', content: [
    { type: 'tableRow', content: [merged, wide] },
    { type: 'tableRow', content: [cell(p(''), bullet(item('tail oldNEW'))), cell(p('protected'))] },
  ] }, ordered(11, item('outside')), p('after')] };
  const leaves = model.paragraphs(source), revisions = [];
  for (const [quote, from] of [['oldNEW', 0], ['tail oldNEW', 5]]) {
    const paragraphIndex = leaves.findIndex(n => text(n) === quote), groupId = 'group-' + (revisions.length / 2 + 1);
    for (const [operation, start] of [['delete', from], ['insert', from + 3]]) {
      const id = revisions.length + 1;
      revisions.push({ id: 'revision-' + id, nativeId: '' + id, operation, author: 'Word reviewer',
        date: '2026-09-29T00:00:00Z', dateUtc: '', groupId, paragraphIndex, from: start, to: start + 3, state: 'pending' });
    }
  }
  return model.bindLedger({ schemaVersion: 1, source, revisions, undo: [], redo: [] });
}
function shape(doc) {
  const copy = model.normalizeNode(doc); model.paragraphs(copy).forEach(n => { n.content = []; }); return copy;
}
async function parse(bytes) {
  const [bridge] = await modules;
  const preview = bridge.buildDocxContentPreviewFromZipBytes(bytes);
  assert.equal(preview.ok, true, JSON.stringify(preview));
  const plan = bridge.buildDocxImportPreviewPlanFromContentPreview(preview);
  assert.equal(plan.ok, true, JSON.stringify(plan));
  const parsed = envelope.parseObservablePayload(plan.candidateCreatePlan.entries[0].content);
  assert.equal(parsed.issue, null);
  return parsed.doc;
}
async function exportDoc(doc, profile) {
  const [, docxPageSetupBindModule, semanticMappingModule, styleMapModule] = await modules;
  if (profile === 'minimum') return buildDocxMinBuffer({ doc, bookProfile: { formatId: 'A4' } },
    { docxPageSetupBindModule, semanticMappingModule, styleMapModule });
  return buildDocxReviewPacketBuffer(buildFullManuscriptDocxReviewPacketSource({ projectId: 'pending-rich', projectRoot: '/synthetic',
    scenes: [{ sceneId: 'roman/rich.txt', scenePath: '/synthetic/roman/rich.txt', doc,
      text: envelope.deriveVisibleTextFromDocument(doc), observableContent: envelope.composeObservablePayload({ doc }), order: 0 }] }));
}
test('Pending list/cell text keeps Original, Current, decisions and durable history without flattening topology', () => {
  const doc = fixture(), expectedShape = shape(doc), initial = model.projection(doc);
  assert.match(initial.original, /tail old/u); assert.match(initial.current, /tail NEW/u);
  assert.equal(initial.revisions[2].paragraphIndex, 10);
  for (const action of ['acceptAll', 'rejectAll']) {
    let changed = model.decide(doc, { action }).doc;
    changed = envelope.parseObservablePayload(envelope.composeObservablePayload({ doc: changed })).doc;
    assert.deepEqual(shape(changed), expectedShape);
    assert.equal(model.projection(changed).current, action === 'acceptAll' ? initial.current : initial.original);
    const undone = model.decide(changed, { action: 'undo' }).doc;
    assert.deepEqual(model.projection(undone).revisions, initial.revisions);
    assert.deepEqual(model.decide(undone, { action: 'redo' }).doc, changed);
  }
  const single = model.decide(doc, { action: 'reject', revisionId: 'revision-3' }).doc;
  assert.deepEqual(model.projection(single).revisions.map(r => r.state), ['pending', 'pending', 'rejected', 'rejected']);
});
test('Five ordinary and authenticated Word cycles retain pending edits after vertical-merge continuations and repeated cell text', async () => {
  const original = fixture(), expected = model.projection(original);
  for (const profile of ['minimum', 'full']) {
    let doc = original;
    for (let round = 1; round <= 5; round++) {
      doc = await parse(await exportDoc(doc, profile));
      const result = model.projection(doc);
      assert.equal(result.original, expected.original, profile + round);
      assert.equal(result.current, expected.current, profile + round);
      assert.deepEqual(shape(doc), shape(original));
      assert.deepEqual(result.revisions.map(r => [r.paragraphIndex, r.operation, r.text, r.author, r.state]),
        expected.revisions.map(r => [r.paragraphIndex, r.operation, r.text, r.author, r.state]));
    }
  }
});
test('Recording inside a table list retains cell identity and rejects topology or formatting changes', () => {
  const source = fixture(), prepared = recording.prepare(source), working = structuredClone(prepared.working);
  const leaf = model.paragraphs(working).find(n => text(n) === 'protected'); leaf.content[0].text = 'protected edit';
  const metadata = { author: 'Owner', date: '2026-09-29T01:00:00.000Z' };
  const result = recording.derive(prepared.baseline, working, metadata);
  assert.equal(result.changed, true); assert.deepEqual(shape(result.doc), shape(source));
  assert.equal(model.projection(result.doc).revisions.at(-1).paragraphIndex, 11);
  assert.equal(model.projection(model.decide(result.doc, { action: 'undo' }).doc).current, model.projection(source).current);
  for (const change of [
    d => { d.content[1].content[0].content[0].content[0].attrs.start++; },
    d => { d.content[1].content[1].content.reverse(); },
    d => { model.paragraphs(d)[0].content[0].marks = [{ type: 'bold' }]; },
  ]) {
    const bad = structuredClone(working); change(bad);
    assert.throws(() => recording.derive(prepared.baseline, bad, metadata), /RECORDING_(?:STRUCTURE|FORMAT)_UNSUPPORTED/u);
  }
});
test('Tracked table mutations and text revisions targeting a continuation cell cannot inherit text authority', async () => {
  const [bridge] = await modules;
  const bytes = await exportDoc(fixture(), 'full');
  const cryptoPort = { sha256Text: value => crypto.createHash('sha256').update(value).digest('hex'),
    sha256Json: value => 'sha256:' + crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex'), byteLength: value => Buffer.byteLength(value) };
  const parts = bridge.extractDocxReviewTransportPackagePartsFromZipBytes({ bytes }, { cryptoPort }).parts;
  const xml = parts['word/document.xml'];
  for (const replace of [
    x => x.replace('</w:tblPr>', '<w:tblPrChange w:id="990"/></w:tblPr>'),
    x => x.replace('<w:vMerge w:val="continue"/></w:tcPr><w:p/>', '<w:vMerge w:val="continue"/></w:tcPr><w:p><w:ins w:id="991"><w:r><w:t>wrong cell</w:t></w:r></w:ins></w:p>'),
    x => x.replace('<w:tr>', '<w:tr><w:trPr><w:ins w:id="992"/></w:trPr>'),
  ]) {
    const changed = replace(xml); assert.notEqual(changed, xml);
    const bad = buildStoredZip(Object.entries(parts).map(([name, data]) => ({ name, data: name === 'word/document.xml' ? changed : data })));
    assert.equal(bridge.buildDocxContentPreviewFromZipBytes(bad).ok, false);
  }
});

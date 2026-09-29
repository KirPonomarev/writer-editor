'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const model = require('../../src/core/word-pending-text-revisions-v1.cjs');
const recording = require('../../src/core/word-pending-recording-v1.cjs');
const envelope = require('../../src/core/document-content-envelope-v1.cjs');
const { buildDocxMinBuffer } = require('../../src/export/docx/docxMinBuilder.js');
const { buildFullManuscriptDocxReviewPacketSource } = require('../../src/export/docx/fullManuscriptDocxReviewPacketSource.js');
const { buildDocxReviewPacketBuffer } = require('../../src/export/docx/docxReviewPacketBuilder.js');
const modules = Promise.all([import('../../src/io/revisionBridge/index.mjs'), import('../../src/docxPageSetupBind.mjs'),
  import('../../src/derived/semanticMapping.mjs'), import('../../src/derived/styleMap.mjs')]);
const meta = { author: 'Mac author', date: '2026-09-29T03:30:01.456Z' };
const marks = [{ type: 'textStyle', attrs: { fontFamily: 'Aptos', fontSize: '12pt' } }];
const p = text => ({ type: 'paragraph', content: text ? [{ type: 'text', text, marks }] : [] });
const doc = (...text) => ({ type: 'doc', content: text.map(p) });
const base = () => doc('Start. Migrating 😀 words. End.', 'Destination. ');
const working = () => doc('Start. End.', 'Destination. Migrating 😀 words. ');
const clean = model.normalizeNode;
const view = (d, mode) => clean(model.materialize(model.readLedger(d), mode));
async function cycle(doc, profile) {
  const [bridge, docxPageSetupBindModule, semanticMappingModule, styleMapModule] = await modules;
  const bytes = profile === 'minimum' ? buildDocxMinBuffer({ doc, bookProfile: { formatId: 'A4' } },
    { docxPageSetupBindModule, semanticMappingModule, styleMapModule }) : buildDocxReviewPacketBuffer(
      buildFullManuscriptDocxReviewPacketSource({ projectId: 'moves', projectRoot: '/synthetic', scenes: [
        { sceneId: 'roman/a.txt', scenePath: '/synthetic/roman/a.txt', doc, text: envelope.deriveVisibleTextFromDocument(doc), order: 0 },
      ] }));
  const preview = bridge.buildDocxContentPreviewFromZipBytes(bytes); assert.equal(preview.ok, true, JSON.stringify(preview));
  const plan = bridge.buildDocxImportPreviewPlanFromContentPreview(preview); assert.equal(plan.ok, true, JSON.stringify(plan));
  return envelope.parseObservablePayload(plan.candidateCreatePlan.entries[0].content).doc;
}
test('Cut autosave then paste from the stable baseline creates one native move pair and one recording history frame', () => {
  const original = base(), cut = doc('Start. End.', 'Destination. ');
  const interim = recording.derive(original, cut, meta).doc;
  assert.deepEqual(model.projection(interim).revisions.map(r => r.operation), ['delete']);
  const result = recording.derive(original, working(), meta).doc, rows = model.readLedger(result).revisions;
  assert.deepEqual(rows.map(r => [r.operation, r.author, r.date]), [['delete', meta.author, meta.date], ['insert', meta.author, meta.date]]);
  assert.equal(rows[0].groupId, rows[1].groupId); assert.equal(rows[0].moveName, rows[1].moveName); assert.ok(rows[0].moveName);
  assert.deepEqual(view(result, 'original'), clean(original)); assert.deepEqual(view(result, 'current'), clean(working()));
  assert.equal(model.readLedger(result).roundUndo.length, 1);
  assert.deepEqual(recording.derive(original, working(), meta).doc, result);
  assert.deepEqual(clean(model.decide(result, { action: 'undo' }).doc), clean(original));
  assert.deepEqual(recording.derive(original, original, meta), { changed: false, doc: original });
});
test('Either recorded endpoint accepts or rejects both sides without disturbing the independent working text', () => {
  const initial = recording.derive(base(), working(), meta).doc;
  for (const action of ['accept', 'reject']) for (const revisionId of ['revision-1', 'revision-2']) {
    let decided = model.decide(initial, { action, revisionId }).doc;
    decided = envelope.parseObservablePayload(envelope.composeObservablePayload({ doc: decided })).doc;
    assert.deepEqual(model.readLedger(decided).revisions.map(r => r.state), [action + 'ed', action + 'ed']);
    assert.deepEqual(clean(decided), clean(action === 'accept' ? working() : base()));
    const undo = model.decide(decided, { action: 'undo' }).doc;
    assert.deepEqual(model.readLedger(undo).revisions, model.readLedger(initial).revisions);
    assert.deepEqual(model.decide(undo, { action: 'redo' }).doc, decided);
  }
});
test('Five ordinary/full serialization and returned-history cycles retain authored move pairing, IDs, rich projections and history', async () => {
  const initial = recording.derive(base(), working(), meta).doc;
  for (const profile of ['minimum', 'full']) {
    let value = initial;
    for (let round = 1; round <= 5; round++) {
      const imported = await cycle(value, profile);
      value = model.replaceFromReturn(value, imported, { roundId: profile + round, artifactSha256: String(round).repeat(64) }).doc;
      value = envelope.parseObservablePayload(envelope.composeObservablePayload({ doc: value })).doc;
      for (const mode of ['original', 'current']) assert.deepEqual(view(value, mode), view(initial, mode));
      assert.deepEqual(model.readLedger(value).revisions.map(r => [r.id, r.groupId, !!r.moveName]), [['revision-1', 'group-1', true], ['revision-2', 'group-1', true]]);
    }
    for (let i = 0; i < 5; i++) value = model.decide(value, { action: 'undo' }).doc;
    assert.deepEqual(model.readLedger(value).revisions, model.readLedger(initial).revisions);
    for (let i = 0; i < 5; i++) value = model.decide(value, { action: 'redo' }).doc;
    assert.equal(model.readLedger(value).roundUndo.length, 6);
  }
});
test('Copy-only, duplicate candidates, whitespace, same-paragraph reorder and rich mismatch stay ordinary pending edits', () => {
  const cases = [
    [base(), doc('Start. Migrating 😀 words. End.', 'Destination. Migrating 😀 words. ')],
    [doc('one', 'one', 'x', 'y'), doc('', '', 'xone', 'yone')],
    [doc('a  b', 'ab'), doc('a b', 'a b')],
    [doc('alpha beta'), doc('beta alpha')],
  ];
  const styled = working(); styled.content[1].content[0].marks = [...marks, { type: 'bold' }]; cases.push([base(), styled]);
  for (const [original, changed] of cases) {
    const result = recording.derive(original, changed, meta).doc;
    assert.ok(model.readLedger(result).revisions.every(r => !r.moveName));
    assert.deepEqual(view(result, 'original'), clean(original)); assert.deepEqual(view(result, 'current'), clean(changed));
  }
});
test('Previously saved deletion is never retroactively relabelled as a move in a later recording session', () => {
  const cut = recording.derive(base(), doc('Start. End.', 'Destination. '), meta).doc;
  const before = structuredClone(model.readLedger(cut).revisions);
  const result = recording.derive(cut, working(), meta).doc, rows = model.readLedger(result).revisions;
  assert.deepEqual(rows[0], before[0]); assert.ok(rows.every(r => !r.moveName));
});
test('Two distinct exact relocations get independent decision groups', () => {
  const original = doc('A', 'B', 'x', 'y'), changed = doc('', '', 'xA', 'yB');
  const result = recording.derive(original, changed, meta).doc, rows = model.readLedger(result).revisions;
  assert.equal(new Set(rows.map(r => r.groupId)).size, 2);
  const firstRejected = model.decide(result, { action: 'reject', revisionId: rows[0].id }).doc;
  assert.equal(model.projection(firstRejected).current, 'A\n\nx\nyB');
});
test('Relocation between a numbered table-cell list and an outside paragraph preserves table/list identity', async () => {
  const original = { type: 'doc', content: [{ type: 'table', content: [{ type: 'tableRow', content: [
    { type: 'tableCell', attrs: { colspan: 1, rowspan: 1, colwidth: null }, content: [
      { type: 'orderedList', attrs: { start: 7 }, content: [{ type: 'listItem', content: [p('Migrating 😀 words. ')] }] }, p('')] },
  ] }] }, p('Destination. ')] }, changed = structuredClone(original), leaves = model.paragraphs(changed);
  leaves[0].content = []; leaves[2].content[0].text += 'Migrating 😀 words. ';
  const result = recording.derive(original, changed, meta).doc;
  assert.ok(model.readLedger(result).revisions.every(r => r.moveName));
  for (const profile of ['minimum', 'full']) {
    const imported = await cycle(result, profile);
    for (const mode of ['original', 'current']) assert.deepEqual(view(imported, mode), view(result, mode));
  }
});

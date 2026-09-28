'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const model = require('../../src/core/word-pending-text-revisions-v1.cjs');
const envelope = require('../../src/core/document-content-envelope-v1.cjs');
function ledger() {
  const change = (id, operation, from, to, groupId = null) => ({ id: 'revision-' + id, nativeId: '' + id, operation,
    author: 'Редактор <A>', date: '2026-09-28T10:00:00+03:00', dateUtc: '2026-09-28T07:00:00Z', groupId,
    paragraphIndex: 0, from, to, state: 'pending' });
  return { schemaVersion: 1, source: { type: 'doc', content: [{ type: 'paragraph', content: [
    { type: 'text', text: 'A староеновое B 🧭 C', marks: [{ type: 'bold' }] },
  ] }] }, revisions: [change(1, 'delete', 2, 8, 'group-1'), change(2, 'insert', 8, 13, 'group-1'), change(3, 'delete', 16, 18)], undo: [], redo: [] };
}
test('Original/Current preserve rich text, Unicode and durable pending state through envelope', () => {
  const doc = model.bindLedger(ledger());
  const p = model.projection(doc);
  assert.equal(p.original, 'A старое B 🧭 C'); assert.equal(p.current, 'A новое B  C');
  const persisted = envelope.composeObservablePayload({ doc });
  assert.deepEqual(envelope.parseObservablePayload(persisted).doc, envelope.canonicalizeDocumentJson(doc));
  assert.equal(model.readLedger(envelope.parseObservablePayload(persisted).doc).revisions.length, 3);
  assert.equal(p.revisions[0].author, 'Редактор <A>');
});
test('single replacement decision is atomic; undo redo and a new decision retain expected text', () => {
  const doc = model.bindLedger(ledger());
  const rejected = model.decide(doc, { action: 'reject', revisionId: 'revision-2' }).doc;
  assert.equal(model.projection(rejected).current, 'A старое B  C');
  assert.deepEqual(model.readLedger(rejected).revisions.map(r => r.state), ['rejected', 'rejected', 'pending']);
  assert.equal(model.decide(rejected, { action: 'reject', revisionId: 'revision-1' }).changed, false);
  assert.throws(() => model.decide(rejected, { action: 'accept', revisionId: 'revision-1' }), /ALREADY_DECIDED/);
  const undone = model.decide(rejected, { action: 'undo' }).doc;
  assert.equal(model.projection(undone).current, 'A новое B  C');
  const redone = model.decide(envelope.parseObservablePayload(envelope.composeObservablePayload({ doc: undone })).doc, { action: 'redo' }).doc;
  assert.equal(model.projection(redone).current, 'A старое B  C');
  const all = model.decide(undone, { action: 'rejectAll' }).doc;
  assert.equal(model.projection(all).current, model.projection(all).original);
  assert.equal(model.projection(all).canRedo, false);
});
test('acceptAll leaves Current and exports no pending wrappers; undo restores every pending state', () => {
  const doc = model.bindLedger(ledger()), accepted = model.decide(doc, { action: 'acceptAll' }).doc;
  assert.equal(model.projection(accepted).current, model.projection(doc).current);
  assert.ok(model.segments(model.readLedger(accepted), 0, 'export').every(s => !s.revision));
  assert.deepEqual(model.readLedger(model.decide(accepted, { action: 'undo' }).doc).revisions, ledger().revisions);
  assert.equal(model.decide(accepted, { action: 'acceptAll' }).changed, false);
});
test('tampered projection, split surrogate, overlaps, duplicate IDs and half replacement decisions reject', () => {
  const badDoc = model.bindLedger(ledger()); badDoc.content[0].content[0].text = 'forged';
  assert.throws(() => model.readLedger(badDoc), /PROJECTION_MISMATCH/);
  for (const mutate of [l => l.revisions[2].from++, l => l.revisions[2].from = 1,
    l => l.revisions[1].id = l.revisions[0].id, l => l.revisions[1].state = 'accepted',
    l => l.revisions[0].paragraphIndex = -1, l => l.source.content[0].content[0].marks = [{ type: 'link', attrs: { href: 'javascript:bad' } }],
    l => l.undo = [ ['pending'] ], l => l.revisions[0].authority = true,
    l => l.undo = Array(129).fill(['pending', 'pending', 'pending'])]) {
    const value = ledger(); mutate(value); assert.throws(() => model.bindLedger(value), /PENDING_REVISIONS/);
  }
});
test('editor run coalescing and null default attributes preserve checked semantics', () => {
  const doc = model.bindLedger(ledger());
  doc.content[0].attrs = { textAlign: null };
  doc.content[0].content = model.normalizeNode(doc.content[0]).content;
  assert.ok(model.readLedger(doc));
  doc.content[0].content[0].marks = [];
  assert.throws(() => model.readLedger(doc), /PROJECTION_MISMATCH/);
});

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const model = require('../../src/core/word-pending-text-revisions-v1.cjs');
const envelope = require('../../src/core/document-content-envelope-v1.cjs');
const textDoc = text => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });
const receipt = n => ({ roundId: `round-${n}`, artifactSha256: String(n).padStart(64, '0') });
function pending(text = 'oldnew tail', extra = false) {
  const r = (id, operation, from, to, groupId) => ({ id: `revision-${id}`, nativeId: String(id), operation,
    author: 'Author', date: '2026-09-28T00:00:00Z', dateUtc: '2026-09-28T00:00:00Z',
    groupId, paragraphIndex: 0, from, to, state: 'pending' });
  return model.bindLedger({ schemaVersion: 1, source: textDoc(text),
    revisions: [r(1, 'delete', 0, 3, 'group-1'), r(2, 'insert', 3, 6, 'group-1'),
      ...(extra ? [r(3, 'insert', 11, text.length, null)] : [])], undo: [], redo: [] });
}
const reopen = doc => envelope.parseObservablePayload(envelope.composeObservablePayload({ doc })).doc;
const semantic = doc => ({ source: model.readLedger(doc).source, revisions: model.readLedger(doc).revisions });

test('pending return: whole round and subsequent decisions undo and redo after durable reopen', () => {
  const before = pending(), returned = pending('oldnew tail added', true);
  // Native IDs can be renumbered by Word; local identity must not follow them.
  returned.attrs.wordPendingRevisions.revisions.forEach((r, i) => { r.nativeId = String(80 + i); });
  let doc = model.replaceFromReturn(before, returned, receipt(1)).doc;
  assert.deepEqual(model.readLedger(doc).revisions.map(r => r.id), ['revision-1', 'revision-2', 'revision-3']);
  assert.equal(model.projection(doc).current, 'new tail added');
  const applied = semantic(doc);
  doc = reopen(model.decide(doc, { action: 'reject', revisionId: 'revision-3' }).doc);
  assert.equal(model.projection(doc).current, 'new tail');
  doc = reopen(model.decide(doc, { action: 'undo' }).doc);
  assert.deepEqual(semantic(doc), applied);
  doc = reopen(model.decide(doc, { action: 'undo' }).doc);
  assert.deepEqual(semantic(doc), semantic(before));
  doc = reopen(model.decide(doc, { action: 'redo' }).doc);
  assert.deepEqual(semantic(doc), applied);
  doc = reopen(model.decide(doc, { action: 'redo' }).doc);
  assert.equal(model.projection(doc).current, 'new tail');
});

test('pending return: prior decisions survive round undo, while abandoned redo branches cannot resurrect', () => {
  let before = model.decide(pending(), { action: 'acceptAll' }).doc;
  const accepted = semantic(before);
  let doc = model.replaceFromReturn(before, textDoc('new tail changed'), receipt(2)).doc;
  assert.equal(model.projection(doc).revisions.length, 0);
  doc = reopen(model.decide(doc, { action: 'undo' }).doc);
  assert.deepEqual(semantic(doc), accepted);
  doc = reopen(model.decide(doc, { action: 'undo' }).doc);
  assert.deepEqual(semantic(doc), semantic(pending()));
  doc = model.decide(doc, { action: 'rejectAll' }).doc;
  assert.equal(model.projection(doc).current, 'old tail');
  assert.equal(model.projection(doc).canRedo, false);
  assert.equal(model.decide(doc, { action: 'redo' }).changed, false);
});

test('pending return: clean scene can acquire and undo pending state; replay never reapplies an undone round', () => {
  const clean = textDoc('old tail');
  const applied = model.replaceFromReturn(clean, pending(), receipt(3)).doc;
  const undone = reopen(model.decide(applied, { action: 'undo' }).doc);
  assert.equal(model.projection(undone).current, 'old tail');
  assert.equal(model.projection(undone).revisions.length, 0);
  const replay = model.replaceFromReturn(undone, pending(), receipt(3));
  assert.equal(replay.replay, true); assert.equal(replay.changed, false);
  assert.equal(replay.doc, undone);
  assert.equal(model.projection(model.decide(undone, { action: 'redo' }).doc).current, 'new tail');
});

test('pending return: repeated rounds preserve prior authors and native metadata in undo snapshots', () => {
  let doc = pending(); const expected = [semantic(doc)];
  for (let n = 1; n <= 5; n++) {
    const incoming = pending(`oldnew tail ${n}`, true);
    incoming.attrs.wordPendingRevisions.revisions[2].author = `Author ${n}`;
    doc = reopen(model.replaceFromReturn(doc, incoming, receipt(n)).doc); expected.push(semantic(doc));
  }
  for (let n = 4; n >= 0; n--) {
    doc = reopen(model.decide(doc, { action: 'undo' }).doc); assert.deepEqual(semantic(doc), expected[n]);
  }
  for (let n = 1; n <= 5; n++) {
    doc = reopen(model.decide(doc, { action: 'redo' }).doc); assert.deepEqual(semantic(doc), expected[n]);
  }
});

test('pending return: recursive frames, mismatched projection, forged receipts and exceeded budgets are rejected', () => {
  const doc = model.replaceFromReturn(pending(), pending('oldnew tail added', true), receipt(4)).doc;
  for (const mutate of [
    l => { l.roundUndo[0].roundUndo = []; },
    l => { l.roundUndo = Array(129).fill(l.roundUndo[0]); },
    l => { l.returnReceipts[0].authority = true; },
    l => { l.returnReceipts.push(l.returnReceipts[0]); },
    l => { l.roundUndo[0].revisions[0].to = 999; },
  ]) { const bad = structuredClone(doc); mutate(bad.attrs.wordPendingRevisions); assert.throws(() => model.readLedger(bad), /PENDING_/u); }
  const mismatch = structuredClone(doc); mismatch.content[0].content[0].text += '!';
  assert.throws(() => model.readLedger(mismatch), /PROJECTION_MISMATCH/u);
  assert.throws(() => model.replaceFromReturn(doc, pending(), { ...receipt(4), authority: true }), /RECEIPT_INVALID/u);
  const huge = textDoc('x'.repeat(16 * 1024 * 1024));
  assert.throws(() => model.replaceFromReturn(doc, huge, receipt(5)), /BUDGET/u);
});

test('new revisions never reuse IDs retained by an earlier round after a clean Word return', () => {
  const first = model.replaceFromReturn(pending(), textDoc('new tail'), receipt(6)).doc;
  const next = model.replaceFromReturn(first, pending(), receipt(7)).doc;
  assert.deepEqual(model.readLedger(next).revisions.map(r => r.id), ['revision-3', 'revision-4']);
  assert.deepEqual(model.readLedger(next).revisions.map(r => r.groupId), ['group-2', 'group-2']);
});

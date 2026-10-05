'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { deriveChanges } = require('../../src/core/word-pending-recording-intents-v1.cjs');
const { textDigest } = require('../../src/core/word-comment-edit-intents-v1.cjs');
const recording = require('../../src/core/word-pending-recording-v1.cjs');
const review = require('../../src/core/word-pending-text-revisions-v1.cjs');
const doc = text => ({ type: 'doc', content: [{ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] }] });
const meta = { author: 'Editor', date: '2026-10-05T07:00:00.000Z' };
const edit = (id, from, removed, inserted, direction = 'forward', historyId = id) => ({ id, historyId, direction,
  fromParagraphIndex: 0, toParagraphIndex: 0, fromUtf16: from, toUtf16: from + removed.length,
  removedParagraphs: [removed], insertedParagraphs: [inserted] });
const plan = (text, ...edits) => ({ schemaVersion: 2, baselineTextSha256: textDigest([text]), edits });
const change = (from, to, newFrom, newTo) => ({ from, to, newFrom, newTo });

test('middle repeated occurrence, not greedy suffix, owns deletion and rejection', () => {
  const input = plan('aaa', edit('middle', 1, 'a', ''));
  assert.deepEqual(deriveChanges(['aaa'], ['aa'], input).changes, [[change(1, 2, 1, 1)]]);
  const recorded = recording.derive(doc('aaa'), doc('aa'), meta, input).doc;
  assert.deepEqual(review.readLedger(recorded).revisions.map(r => [r.operation, r.from, r.to]), [['delete', 1, 2]]);
  assert.equal(review.projection(review.decide(recorded, { action: 'rejectAll' }).doc).current, 'aaa');
});
test('disjoint edits leave intervening rich quoted text outside every revision', () => {
  const input = plan('A quote Z', edit('left', 0, 'A', 'B'), edit('right', 8, 'Z', 'Y'));
  assert.deepEqual(deriveChanges(['A quote Z'], ['B quote Y'], input).changes,
    [[change(0, 1, 0, 1), change(8, 9, 8, 9)]]);
  const base = doc('A quote Z'), working = doc('B quote Y');
  for (const d of [base, working]) d.content[0].content = [{ type: 'text', text: d.content[0].content[0].text[0] },
    { type: 'text', text: ' quote ', marks: [{ type: 'italic' }] }, { type: 'text', text: d === base ? 'Z' : 'Y' }];
  const ledger = review.readLedger(recording.derive(base, working, meta, input).doc);
  assert.equal(ledger.revisions.length, 4);
  assert.ok(ledger.revisions.every(r => r.to <= 2 || r.from >= 9));
  assert.deepEqual(review.normalizeNode(review.materialize(ledger, 'original')), review.normalizeNode(base));
  assert.deepEqual(review.normalizeNode(review.materialize(ledger)), review.normalizeNode(working));
});
test('edited inserted text remains insertion; equal replacement is not an Undo', () => {
  assert.deepEqual(deriveChanges(['ab'], ['aYZb'], plan('ab', edit('add', 1, '', 'XX'), edit('change', 1, 'XX', 'YZ'))).changes,
    [[change(1, 1, 1, 3)]]);
  const input = plan('aaa', edit('remove', 1, 'a', ''), edit('new', 1, '', 'a'));
  assert.deepEqual(deriveChanges(['aaa'], ['aaa'], input).changes, [[change(1, 2, 1, 2)]]);
  assert.equal(review.readLedger(recording.derive(doc('aaa'), doc('aaa'), meta, input).doc).revisions.length, 2);
});
test('known inverse restores exact original intervals and redo reuses them', () => {
  const a = edit('remove', 1, 'a', ''), undo = edit('undo', 1, '', 'a', 'undo', 'remove');
  assert.deepEqual(deriveChanges(['aaa'], ['aaa'], plan('aaa', a, undo)).changes, [[]]);
  assert.deepEqual(deriveChanges(['aaa'], ['aa'], plan('aaa', a, undo, edit('redo', 1, 'a', '', 'redo', 'remove'))).changes,
    [[change(1, 2, 1, 1)]]);
  assert.throws(() => deriveChanges(['aaa'], ['aaa'], plan('aaa', a, edit('wrong', 0, '', 'a', 'undo', 'remove'))), /HISTORY_MISMATCH/);
  assert.throws(() => deriveChanges(['aaa'], ['aa'], plan('aaa', edit('unknown', 1, 'a', '', 'undo', 'missing'))), /HISTORY_STALE/);
});
test('coalesced PM inverse and redo preserve original occurrence', () => {
  const edits = [edit('a', 1, '', 'x', 'forward', 'typing'), edit('b', 2, '', 'y', 'forward', 'typing')];
  const inverse = edit('undo', 1, 'xy', '', 'undo', 'typing');
  assert.deepEqual(deriveChanges(['ab'], ['ab'], plan('ab', ...edits, inverse)).changes, [[]]);
  assert.deepEqual(deriveChanges(['ab'], ['axyb'], plan('ab', ...edits, inverse, edit('redo', 1, '', 'xy', 'redo', 'typing'))).changes,
    [[change(1, 1, 1, 3)]]);
});
test('stale text, forged target, structural edit and grapheme split are refused without input mutation', () => {
  const input = plan('a😀b', edit('split', 2, '\ude00', 'x')), snapshot = JSON.stringify(input);
  assert.throws(() => deriveChanges(['a😀b'], ['a\ud83dxb'], input), /COMMENT_EDIT/);
  assert.equal(JSON.stringify(input), snapshot);
  assert.throws(() => deriveChanges(['abc'], ['abd'], plan('abc', edit('stale', 2, 'x', 'd'))), /SPLICE_STALE/);
  assert.throws(() => deriveChanges(['abc'], ['other'], plan('abc', edit('real', 2, 'c', 'd'))), /REPLAY_MISMATCH/);
  assert.throws(() => deriveChanges(['ab'], ['a', 'b'], plan('ab', { ...edit('enter', 1, '', ''), insertedParagraphs: ['', ''] })), /STRUCTURE_UNSUPPORTED/);
});
test('imported document tab stop survives recording and round Undo, unknown attrs stay refused', () => {
  const base = doc('aaa'); base.attrs = { wordDefaultTabStop: 720 };
  const working = doc('aa'); working.attrs = structuredClone(base.attrs);
  const result = recording.derive(base, working, meta, plan('aaa', edit('middle', 1, 'a', ''))).doc;
  assert.equal(review.readLedger(result).source.attrs.wordDefaultTabStop, 720);
  assert.equal(review.normalizeNode(review.decide(result, { action: 'undo' }).doc).attrs.wordDefaultTabStop, 720);
  assert.throws(() => recording.prepare({ ...base, attrs: { arbitrary: true } }), /PENDING_REVISIONS/);
});

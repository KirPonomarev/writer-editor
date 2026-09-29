'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const recording = require('../../src/core/word-pending-recording-v1.cjs');
const review = require('../../src/core/word-pending-text-revisions-v1.cjs');
const doc = (...paragraphs) => ({ type: 'doc', content: paragraphs.map(text => ({ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] })) });
const meta = { author: 'Кирилл', date: '2026-09-28T07:00:00.000Z' };
for (const [name, original, current, operations] of [
  ['insert', 'hello', 'hello world', ['insert']], ['delete', 'hello world', 'hello', ['delete']],
  ['replace', 'hello world', 'hello Word', ['delete', 'insert']], ['empty', '', 'Первый', ['insert']],
  ['erase', 'Первый', '', ['delete']], ['unicode', 'a😀b', 'a🦊b', ['delete', 'insert']],
]) test(`record ${name}; native review decisions and restart-safe session undo`, () => {
  const base = doc(original), result = recording.derive(base, doc(current), meta);
  const ledger = review.readLedger(JSON.parse(JSON.stringify(result.doc)));
  assert.equal(result.changed, true); assert.deepEqual(ledger.revisions.map(r => r.operation), operations);
  assert.ok(ledger.revisions.every(r => r.author === meta.author && r.dateUtc === meta.date));
  assert.equal(review.projection(result.doc).original, original); assert.equal(review.projection(result.doc).current, current);
  assert.equal(review.projection(review.decide(result.doc, { action: 'rejectAll' }).doc).current, original);
  assert.equal(review.projection(review.decide(result.doc, { action: 'acceptAll' }).doc).current, current);
  const undo = review.decide(result.doc, { action: 'undo' }).doc;
  assert.equal(review.projection(undo).current, original);
  assert.equal(review.projection(review.decide(undo, { action: 'redo' }).doc).current, current);
});
test('replacement is one decision group; independent paragraph deltas remain independent', () => {
  const result = recording.derive(doc('old', 'other'), doc('new', 'other!'), meta);
  const p = review.projection(result.doc);
  assert.equal(p.revisions.length, 3); assert.equal(p.revisions[0].groupId, p.revisions[1].groupId);
  const decided = review.decide(result.doc, { action: 'reject', revisionId: p.revisions[0].id });
  assert.equal(review.projection(decided.doc).current, 'old\nother!');
});
test('repeated autosave derives one frame and stable IDs; typing Undo restores exact original', () => {
  const base = doc('A'), first = recording.derive(base, doc('AB'), meta), second = recording.derive(base, doc('ABC'), meta);
  assert.equal(review.readLedger(first.doc).roundUndo.length, 1);
  assert.equal(review.readLedger(second.doc).roundUndo.length, 1);
  assert.equal(review.readLedger(first.doc).revisions[0].id, review.readLedger(second.doc).revisions[0].id);
  assert.deepEqual(recording.derive(base, doc('A'), meta), { changed: false, doc: base });
  assert.deepEqual(recording.derive(base, doc('ABC'), meta), second);
});
test('existing Word revisions retain IDs provenance and decision history outside the new span', () => {
  const old = recording.derive(doc('A B'), doc('A BC'), { ...meta, author: 'Word' }).doc;
  const next = recording.derive(old, doc('!A BC'), meta).doc;
  const ledger = review.readLedger(next), oldRevision = review.readLedger(old).revisions[0];
  assert.equal(ledger.revisions.length, 2);
  assert.deepEqual(ledger.revisions.find(r => r.id === oldRevision.id), { ...oldRevision, from: oldRevision.from + 1, to: oldRevision.to + 1 });
  assert.equal(ledger.roundUndo.length, 2);
  assert.deepEqual(review.readLedger(review.decide(next, { action: 'undo' }).doc).revisions, review.readLedger(old).revisions);
  assert.throws(() => recording.derive(old, doc('A BD'), meta), /EXISTING_REVISION_OVERLAP/);
});
test('format-only edits become reversible decisions; structure failures preserve working state', () => {
  const base = doc('abc'), formatted = doc('abc'); formatted.content[0].content[0].marks = [{ type: 'bold' }];
  const frozen = JSON.stringify({ base, formatted });
  const recorded = recording.derive(base, formatted, meta).doc;
  assert.equal(review.projection(recorded).revisions[0].operation, 'format');
  assert.deepEqual(review.normalizeNode(review.decide(recorded, { action: 'rejectAll' }).doc), review.normalizeNode(base));
  assert.deepEqual(review.normalizeNode(review.decide(recorded, { action: 'acceptAll' }).doc), review.normalizeNode(formatted));
  const unsupported = structuredClone(formatted); unsupported.content[0].content[0].marks = [{ type: 'link', attrs: { href: 'https://example.com' } }];
  assert.throws(() => recording.derive(base, unsupported, meta), /MARK_UNSUPPORTED/);
  assert.equal(JSON.stringify({ base, formatted }), frozen);
  assert.throws(() => recording.derive(base, doc('a', 'bc'), meta), /STRUCTURE_UNSUPPORTED/);
  assert.throws(() => recording.derive(base, { type: 'doc', content: [{ type: 'table', content: [] }] }, meta), /PENDING_REVISIONS/);
});
test('source rich runs, inserted rich text and independent formatting have separate reversible decisions', () => {
  const base = doc('abc'); base.content[0].content[0].marks = [{ type: 'bold' }];
  const working = structuredClone(base); working.content[0].content.push({ type: 'text', text: '!', marks: [{ type: 'italic' }] });
  const result = recording.derive(base, working, meta);
  assert.deepEqual(review.materialize(review.readLedger(result.doc)), working);
  working.content[0].content[0].marks = [{ type: 'underline' }];
  const mixed = recording.derive(base, working, meta).doc;
  assert.deepEqual(review.normalizeNode(mixed), review.normalizeNode(working));
  assert.deepEqual(review.readLedger(mixed).revisions.map(r => r.operation), ['format', 'insert']);
  const format = review.readLedger(mixed).revisions.find(r => r.operation === 'format');
  const rejected = review.decide(mixed, { action: 'reject', revisionId: format.id }).doc;
  assert.equal(review.projection(rejected).current, 'abc!');
  assert.deepEqual(rejected.content[0].content[0].marks, [{ type: 'bold' }]);
  assert.deepEqual(review.normalizeNode(review.decide(mixed, { action: 'rejectAll' }).doc), review.normalizeNode(base));
});
test('renderer cannot inject a ledger, author controls or unbounded history', () => {
  const base = doc('A'), result = recording.derive(base, doc('AB'), meta);
  assert.throws(() => recording.derive(base, result.doc, meta), /RENDERER_LEDGER_FORBIDDEN/);
  assert.throws(() => recording.derive(base, doc('AB'), { ...meta, author: '\u0000' }), /METADATA_INVALID/);
  assert.throws(() => recording.derive(base, doc('AB'), { ...meta, date: 'tomorrow' }), /METADATA_INVALID/);
  const ledger = review.readLedger(result.doc); ledger.roundUndo = Array.from({ length: 128 }, () => structuredClone(ledger.roundUndo[0]));
  assert.throws(() => recording.derive(review.bindLedger(ledger), doc('!AB'), meta), /HISTORY_BUDGET/);
});

test('native Tiptap typing and plain paste emit empty inherited color without changing rich truth', () => {
  const base = doc('Native text'); base.content[0].content[0].marks = [{ type: 'textStyle', attrs: { fontFamily: 'Aptos', fontSize: '12pt' } }];
  const working = structuredClone(base); working.attrs = { wordPendingRevisions: null }; working.content[0].attrs = { textAlign: null };
  working.content[0].content.unshift({ type: 'text', text: 'Recorded ', marks: [{ type: 'textStyle', attrs: { color: '', fontFamily: 'Aptos', fontSize: '12pt' } }] });
  const result = recording.derive(base, working, meta);
  assert.equal(review.projection(result.doc).current, 'Recorded Native text');
  assert.equal(review.projection(result.doc).original, 'Native text');
  assert.ok(!JSON.stringify(review.readLedger(result.doc).source).includes('"color":""'));
});

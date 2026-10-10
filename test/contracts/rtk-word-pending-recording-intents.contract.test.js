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

const bound = (source, points, revisions = [], schemaVersion = 3) => review.bindLedger({ schemaVersion, source: doc(source),
  revisions, undo: [], redo: [], roundUndo: [], roundRedo: [], returnReceipts: [],
  noteSourcePoints: points.map((offsetUtf16, i) => ({ noteId: 'note-'+i, paragraphIndex: 0, offsetUtf16 })) });
const deletion = { id:'revision-1', nativeId:'word-delete', author:'Word', date:'', dateUtc:'', operation:'delete',
  paragraphIndex:0, from:1, to:3, state:'pending', groupId:null };
for (const schemaVersion of [3,5]) for (const [at, current, source, expectedPoints, currentPoints] of [
  [0,'!AB','!AxxB',[2,4],[2,2]], [1,'A!B','A!xxB',[2,4],[2,2]], [2,'AB!','AxxB!',[1,3],[1,1]],
]) test(`schema${schemaVersion} insertion at${at} retains distinct hidden note endpoints through decisions and round history`, () => {
  const base=bound('AxxB',[1,3],[deletion],schemaVersion), frozen=JSON.stringify(base);
  const next=recording.derive(base,doc(current),meta,plan('AB',edit('insert',at,'','!'))).doc, ledger=review.readLedger(next);
  assert.equal(ledger.schemaVersion,schemaVersion);assert.equal(ledger.source.content[0].content.map(n=>n.text).join(''),source);
  assert.deepEqual(ledger.noteSourcePoints.map(p=>p.offsetUtf16),expectedPoints);
  assert.deepEqual(review.noteProjection(next).map(p=>p.offsetUtf16),currentPoints);
  assert.deepEqual(review.noteProjection(next,'original').map(p=>p.offsetUtf16),[1,3]);
  assert.equal(review.projection(next).original,'AxxB');assert.equal(review.projection(next).current,current);
  assert.deepEqual(ledger.revisions.find(r=>r.id==='revision-1'),{...deletion,from:at<2?2:1,to:at<2?4:3});
  assert.deepEqual(review.roundFrame(review.readLedger(review.decide(next,{action:'undo'}).doc)),review.roundFrame(review.readLedger(base)));
  const undo=review.decide(next,{action:'undo'}).doc;assert.deepEqual(review.decide(undo,{action:'redo'}).doc,next);
  const rejected=review.decide(next,{action:'rejectAll'}).doc;
  assert.deepEqual(review.noteProjection(rejected).map(p=>p.offsetUtf16),[1,3]);
  assert.equal(JSON.stringify(base),frozen);
});
test('exact repeated occurrence, replacement endpoint and emoji shifts use UTF16 source space once',()=>{
  const base=bound('aaa😀z',[1,2,5]), input=plan('aaa😀z',edit('middle',1,'a','XX'),edit('emoji-before',4,'','!'));
  const next=recording.derive(base,doc('aXXa!😀z'),meta,input).doc;
  assert.equal(review.readLedger(next).source.content[0].content.map(n=>n.text).join(''),'aaXXa!😀z');
  assert.deepEqual(review.readLedger(next).noteSourcePoints.map(p=>p.offsetUtf16),[1,4,8]);
  assert.deepEqual(review.noteProjection(next).map(p=>p.offsetUtf16),[1,3,7]);
  assert.deepEqual(review.noteProjection(next,'original').map(p=>p.offsetUtf16),[1,2,5]);
  const undone=recording.derive(base,doc('aaa😀z'),meta,plan('aaa😀z',edit('middle',1,'a','XX'),edit('undo',1,'XX','a','undo','middle')));
  assert.deepEqual(undone,{changed:false,doc:base});
});
test('notes retain strict provenance, consumed-reference, formatting and structural no-loss refusals',()=>{
  const base=bound('abcd',[2]), working=doc('ad'), frozen=JSON.stringify({base,working});
  assert.throws(()=>recording.derive(base,working,meta),/RECORDING_NOTE_INTENTS_REQUIRED/);
  assert.throws(()=>recording.derive(base,working,meta,plan('abcd',edit('consume',1,'bc',''))),/RECORDING_NOTE_REFERENCE_CONSUMED/);
  assert.throws(()=>recording.derive(base,doc('ab!cd'),meta,plan('abcd',edit('forged',0,'','!'))),/REPLAY_MISMATCH/);
  const styled=doc('abcd');styled.content[0].content[0].marks=[{type:'bold'}];
  assert.throws(()=>recording.derive(base,styled,meta,plan('abcd')),/RECORDING_NOTE_FORMAT_UNSUPPORTED/);
  const paragraphs={type:'doc',content:[doc('ab').content[0],doc('cd').content[0]]};
  assert.throws(()=>recording.derive(base,paragraphs,meta,plan('abcd')),/RECORDING_NOTE_STRUCTURE_UNSUPPORTED|REPLAY_MISMATCH/);
  const forged=structuredClone(review.readLedger(base));forged.noteSourcePoints[0].offsetUtf16=99;
  assert.throws(()=>recording.prepare(review.bindLedger(forged)),/PENDING_NOTE_POINT_BOUNDARY/);
  assert.equal(JSON.stringify({base,working}),frozen);
});

const structural = (id, historyId, direction, fromParagraphIndex, fromUtf16,
  toParagraphIndex, toUtf16, removedParagraphs, insertedParagraphs) => ({
  id, historyId, direction, fromParagraphIndex, fromUtf16, toParagraphIndex, toUtf16,
  removedParagraphs, insertedParagraphs });
const multiPlan = (texts, ...edits) => ({ schemaVersion: 2, baselineTextSha256: textDigest(texts), edits });

test('empty documents and legacy single-paragraph history retain their existing interpretation', () => {
  assert.deepEqual(deriveChanges([], [], multiPlan([])).changes, []);
  const input = { schemaVersion: 1, baselineTextSha256: textDigest(['aaa']), edits: [
    { id: 'remove', historyId: 'remove', direction: 'forward', paragraphIndex: 0, fromUtf16: 1, toUtf16: 2, removedText: 'a', insertText: '' },
    { id: 'undo', historyId: 'remove', direction: 'undo', paragraphIndex: 0, fromUtf16: 1, toUtf16: 1, removedText: '', insertText: 'a' },
  ] };
  assert.deepEqual(deriveChanges(['aaa'], ['aaa'], input).changes, [[]]);
});

test('checked authoring Undo of paragraph split restores pending ledger, hidden notes and full history', () => {
  const base = bound('AxxB', [1, 3], [deletion], 5), frozen = JSON.stringify(base);
  const input = multiPlan(['AB'],
    structural('split', 'enter', 'forward', 0, 1, 0, 1, [''], ['', '']),
    structural('join-back', 'enter', 'undo', 0, 1, 1, 0, ['', ''], ['']));
  assert.deepEqual(deriveChanges(['AB'], ['AB'], input).changes, [[]]);
  assert.deepEqual(recording.derive(base, doc('AB'), meta, input), { changed: false, doc: base });
  assert.equal(JSON.stringify(base), frozen);
});
test('coalesced Undo of a join and typing restores source boundaries before later recording', () => {
  const original = ['Café', 'Привет мир.'];
  const edits = [
    structural('join', 'typing', 'forward', 0, 4, 1, 0, ['', ''], ['']),
    structural('type', 'typing', 'forward', 0, 2, 0, 10, ['féПривет'], ['fix']),
    structural('undo-both', 'typing', 'undo', 0, 2, 0, 5, ['fix'], ['fé', 'Привет']),
  ];
  assert.deepEqual(deriveChanges(original, original, multiPlan(original, ...edits)).changes, [[], []]);
  const later = structural('later', 'later', 'forward', 1, 10, 1, 10, [''], ['!']);
  assert.deepEqual(deriveChanges(original, ['Café', 'Привет мир!.'], multiPlan(original, ...edits, later)).changes,
    [[], [change(10, 10, 10, 11)]]);
});
test('Undo at another identical empty paragraph boundary is refused without input mutation', () => {
  const original = ['', '', ''];
  const join = structural('join', 'join', 'forward', 0, 0, 1, 0, ['', ''], ['']);
  const correct = structural('undo', 'join', 'undo', 0, 0, 0, 0, [''], ['', '']);
  assert.deepEqual(deriveChanges(original, original, multiPlan(original, join, correct)).changes, [[], [], []]);
  const forged = multiPlan(original, join, { ...correct, fromParagraphIndex: 1, toParagraphIndex: 1 });
  const frozen = JSON.stringify({ original, forged });
  assert.throws(() => deriveChanges(original, original, forged), /RECORDING_INTENT_HISTORY_MISMATCH/);
  assert.equal(JSON.stringify({ original, forged }), frozen);
});
test('surviving structure, manual recreation and structural Redo keep their no-loss refusal', () => {
  const original = ['Left', 'Right'];
  const join = structural('join', 'join', 'forward', 0, 4, 1, 0, ['', ''], ['']);
  const inverse = structural('undo', 'join', 'undo', 0, 4, 0, 4, [''], ['', '']);
  for (const edits of [[join], [join, { ...inverse, direction: 'forward', historyId: 'manual' }],
    [join, inverse, { ...join, id: 'redo', direction: 'redo' }]]) {
    const final = edits.length === 2 ? original : ['LeftRight'];
    assert.throws(() => deriveChanges(original, final, multiPlan(original, ...edits)), /RECORDING_INTENT_STRUCTURE_UNSUPPORTED/);
  }
  assert.deepEqual(deriveChanges(original, original, multiPlan(original, join, inverse,
    { ...join, id: 'redo', direction: 'redo' }, { ...inverse, id: 'undo-again' })).changes, [[], []]);
});

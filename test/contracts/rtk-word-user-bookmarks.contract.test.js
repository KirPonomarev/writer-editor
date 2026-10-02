'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const model = require('../../src/core/word-user-bookmarks-v1.cjs');
const envelope = require('../../src/core/document-content-envelope-v1.cjs');
const copy = structuredClone;
const ep = (offsetUtf16, paragraphIndex = 0, edge = 'text') => ({ paragraphIndex, offsetUtf16, edge });
const doc = (...lines) => ({ type: 'doc', content: lines.map(text => ({ type: 'paragraph',
  attrs: { textAlign: 'left' }, content: text ? [{ type: 'text', text, marks: [{ type: 'bold' }] }] : [] })) });
const create = (document, name = 'Target', start = ep(2), end = ep(5), requestId = 'create-1') => model.planMutation({
  doc: document, action: 'create', requestId, projectId: 'project', sceneId: 'scene.txt', name, start, end,
});
function changeText(document, text, paragraphIndex = 0) {
  const out = copy(document); out.content[paragraphIndex].content[0].text = text; return out;
}
const code = expected => error => error.code === expected;
function typed(fn, expected) { assert.throws(fn, expected ? code(expected) : /^Error: USER_BOOKMARK_/); }

test('absent and null defaults retain old envelopes without domain state', () => {
  const empty = doc('old'); assert.equal(model.readRegistry(empty), null);
  empty.attrs = { [model.KEY]: null }; assert.equal(model.readRegistry(empty), null);
  assert.deepEqual(envelope.canonicalizeDocumentJson(empty), empty);
  assert.deepEqual(model.planSave({ beforeDoc: doc('old'), workingDoc: empty }).registry, null);
});

test('governed create retains every rich neighbor and makes deterministic scene-bound ID', () => {
  const before = doc('A target Z', 'Other');
  before.content[0].content[0].marks.push({ type: 'textStyle', attrs: { color: '#ff0000' } });
  const untouched = copy(before);
  const created = create(before);
  assert.deepEqual(created.doc.content, before.content);
  assert.deepEqual(before, untouched);
  assert.equal(created.registry.schemaVersion, model.SCHEMA);
  assert.equal(created.registry.revision, 1); assert.equal(created.changed, true);
  assert.match(created.bookmarkId, /^ubm-[a-f0-9]{32}$/);
  assert.equal(create(before).bookmarkId, created.bookmarkId);
  assert.notEqual(create(before, 'Target', ep(2), ep(5), 'create-2').bookmarkId, created.bookmarkId);
  typed(() => create(created.doc), 'USER_BOOKMARK_REQUEST_REPLAY');
  assert.equal(model.readRegistry(before), null);
});

test('same-range and equal-text bookmarks remain separate semantic identities', () => {
  const a = create(doc('same', 'same'), 'TwinA', ep(0), ep(4), 'a');
  const b = create(a.doc, 'TwinB', ep(0), ep(4), 'b');
  const c = create(b.doc, 'Second', ep(0, 1), ep(4, 1), 'c');
  assert.equal(new Set(c.registry.bookmarks.map(x => x.id)).size, 3);
  assert.deepEqual(c.registry.bookmarks[0].start, c.registry.bookmarks[1].start);
  assert.notDeepEqual(c.registry.bookmarks[0].start, c.registry.bookmarks[2].start);
});

test('rename retains identity; deletion preserves broken label and reserves linked tombstone name', () => {
  let plan = create(doc('A target Z'), 'Target'); const id = plan.bookmarkId;
  plan.doc.content[0].content.push({ type: 'text', text: ' label', marks: [{ type: 'link', attrs: model.linkAttrs(plan.registry.bookmarks[0]) }] });
  const renamed = model.planMutation({ doc: plan.doc, action: 'rename', bookmarkId: id, name: 'Renamed' });
  const mark = renamed.doc.content[0].content[1].marks[0];
  assert.equal(renamed.bookmarkId, id); assert.equal(mark.attrs.href, '#Renamed');
  assert.equal(renamed.changed, true); assert.equal(renamed.registry.revision, 2);
  assert.equal(mark.attrs.wordBookmarkId, id); assert.equal(renamed.doc.content[0].content[1].text, ' label');
  const deleted = model.planMutation({ doc: renamed.doc, action: 'delete', bookmarkId: id });
  assert.deepEqual(deleted.registry.bookmarks[0], { id, name: 'Renamed', state: 'deleted' });
  assert.equal(deleted.changed, true); assert.equal(deleted.registry.revision, 3);
  assert.equal(model.inspectInternalLink(deleted.doc.content[0].content[1].marks[0], deleted.registry).state, 'deleted');
  typed(() => create(deleted.doc, 'Renamed', ep(2), ep(5), 'reused'), 'USER_BOOKMARK_LINKED_TOMBSTONE_NAME_RESERVED');
  typed(() => create(deleted.doc, 'renamed', ep(2), ep(5), 'reused'), 'USER_BOOKMARK_LINKED_TOMBSTONE_NAME_RESERVED');
  const unlinked = copy(deleted.doc); unlinked.content[0].content[1].marks = [];
  const reused = create(unlinked, 'Renamed', ep(2), ep(5), 'reused');
  assert.notEqual(reused.bookmarkId, id);
  assert.equal(reused.doc.content[0].content[1].text, ' label');
  typed(() => model.planMutation({ doc: reused.doc, action: 'rename', bookmarkId: id, name: 'Oops' }), 'USER_BOOKMARK_TARGET_UNAVAILABLE');
});

test('rename cannot take a linked deleted name, and forged registry cannot bypass export validation', () => {
  const initial = create(doc('A target Z'), 'Old');
  initial.doc.content[0].content[0].marks.push({ type: 'link', attrs: model.linkAttrs(initial.registry.bookmarks[0]) });
  const deleted = model.planMutation({ doc: initial.doc, action: 'delete', bookmarkId: initial.bookmarkId });
  const fresh = create(deleted.doc, 'Fresh', ep(1), ep(4), 'fresh');
  typed(() => model.planMutation({ doc: fresh.doc, action: 'rename', bookmarkId: fresh.bookmarkId, name: 'oLD' }), 'USER_BOOKMARK_LINKED_TOMBSTONE_NAME_RESERVED');
  const forged = copy(fresh.doc); forged.attrs[model.KEY].bookmarks.find(record => record.state === 'active').name = 'OLD';
  typed(() => model.readRegistry(forged), 'USER_BOOKMARK_LINKED_TOMBSTONE_NAME_RESERVED');
});

test('rename same name is a no-op and duplicate active names block before publication', () => {
  const a = create(doc('A target Z'), 'A');
  assert.equal(model.planMutation({ doc: a.doc, action: 'rename', bookmarkId: a.bookmarkId, name: 'A' }).changed, false);
  const b = create(a.doc, 'B', ep(1), ep(4), 'b');
  typed(() => model.planMutation({ doc: b.doc, action: 'rename', bookmarkId: b.bookmarkId, name: 'A' }), 'USER_BOOKMARK_DUPLICATE_NAME');
  typed(() => create(a.doc, 'A', ep(1), ep(4), 'b'), 'USER_BOOKMARK_DUPLICATE_NAME');
});

test('portable Word names and transport namespace are validated, never normalized', () => {
  for (const name of ['', '9name', '_GoBack', 'YRTK_a', 'yrtk_fake', 'has space', 'x'.repeat(41), 'Name\n']) typed(() => create(doc('A target Z'), name), 'USER_BOOKMARK_NAME_INVALID');
  assert.equal(create(doc('A target Z'), 'Case_09').registry.bookmarks[0].name, 'Case_09');
  assert.equal(create(doc('A target Z'), 'Цель_Кириллица_Ω').registry.bookmarks[0].name, 'Цель_Кириллица_Ω');
  const upper = create(doc('A target Z'), 'UserTwinB');
  typed(() => create(upper.doc, 'usertwinb', ep(1), ep(4), 'b'), 'USER_BOOKMARK_DUPLICATE_NAME');
});

test('malformed raw registry fails before JSON normalization can erase it', () => {
  const original = create(doc('A target Z')).doc;
  for (const mutate of [
    r => r.hidden = 'bad', r => r.schemaVersion = 1, r => r.revision = -1,
    r => r.bookmarks.push(copy(r.bookmarks[0])), r => r.bookmarks[0].id = 'WordNumericId_3',
    r => r.bookmarks[0].start.offsetUtf16 = '2', r => delete r.bookmarks[0].end,
    r => r.bookmarks[0].end = ep(1), r => r.bookmarks[0].state = 'unknown',
    r => r.bookmarks[0].start.extra = true, r => r.bookmarks[0].state = 'deleted',
    r => Object.setPrototypeOf(r, { revision: 3 }),
    r => Object.defineProperty(r, 'revision', { enumerable: true, get() { throw new Error('GETTER_EXECUTED'); } }),
    r => r.bookmarks.extra = 'covert', r => r.bookmarks = new Array(1),
    r => r[Symbol('hidden')] = 'covert',
  ]) {
    const value = copy(original); mutate(value.attrs[model.KEY]);
    typed(() => model.readRegistry(value)); typed(() => envelope.canonicalizeDocumentJson(value));
  }
});

test('paragraph and grapheme bounds distinguish text end from paragraph mark', () => {
  const before = doc('A😀e\u0301Z', 'Next');
  for (const offset of [2, 4, 8]) typed(() => create(before, 'Bad', ep(offset), ep(offset)));
  typed(() => create(before, 'Bad', ep(3, 3), ep(3, 3)), 'USER_BOOKMARK_ENDPOINT_BOUNDS');
  typed(() => create(before, 'Bad', ep(3, 0, 'afterParagraph'), ep(3, 0, 'afterParagraph')), 'USER_BOOKMARK_ENDPOINT_BOUNDARY');
  const range = create(before, 'Cross', ep(1), ep(4, 1));
  assert.equal(model.endpointOffset(range.doc, range.registry.bookmarks[0].end), 11);
  const mark = create(before, 'ParagraphMark', ep(6), ep(6, 0, 'afterParagraph'));
  assert.equal(model.endpointOffset(mark.doc, mark.registry.bookmarks[0].end), 7);
  assert.deepEqual(model.endpointForOffset(before, 7), ep(0, 1));
  assert.deepEqual(model.endpointForOffset(before, 12), ep(4, 1, 'afterParagraph'));
});

test('leaf occurrence traversal matches text/hardBreak/media in nested lists and tables', () => {
  const before = { type: 'doc', content: [
    { type: 'bulletList', content: [{ type: 'listItem', content: [doc('list').content[0]] }] },
    { type: 'table', content: [{ type: 'tableRow', content: [{ type: 'tableCell', content: [doc('cell').content[0]] }] }] },
    { type: 'codeBlock', content: [{ type: 'text', text: 'code' }, { type: 'hardBreak' }, { type: 'image', attrs: { assetId: 'image' } }, { type: 'text', text: 'tail' }] },
  ] };
  assert.deepEqual(model.paragraphs(before).map(model.textOf), ['list', 'cell', 'code\ntail']);
  const value = create(before, 'Cell', ep(1, 1), ep(3, 1)); assert.deepEqual(value.doc.content, before.content);
  const work = copy(value.doc); work.content[1].content[0].content[0].content[0].content[0].text = '!cell';
  assert.equal(model.planSave({ beforeDoc: value.doc, workingDoc: work }).registry.bookmarks[0].start.offsetUtf16, 2);
});

test('generic save cannot create, rename, delete or drop trusted registry', () => {
  const before = create(doc('A target Z')).doc;
  for (const mutate of [
    x => delete x.attrs[model.KEY], x => x.attrs[model.KEY] = null,
    x => x.attrs[model.KEY].bookmarks[0].name = 'Forged',
    x => x.attrs[model.KEY].bookmarks[0].start = ep(0),
    x => x.attrs[model.KEY].bookmarks = [], x => x.attrs[model.KEY].revision++,
  ]) { const work = copy(before); mutate(work); typed(() => model.planSave({ beforeDoc: before, workingDoc: work }), 'USER_BOOKMARK_SAVE_AUTHORITY'); }
  typed(() => model.planSave({ beforeDoc: doc('A target Z'), workingDoc: before }), 'USER_BOOKMARK_SAVE_AUTHORITY');
});

test('strictly before and inside range edits map rich document with inherited trusted registry', () => {
  const before = create(doc('A target Z'), 'Target', ep(2), ep(8)).doc;
  const shifted = model.planSave({ beforeDoc: before, workingDoc: changeText(before, '!A target Z') });
  assert.deepEqual(shifted.registry.bookmarks[0].start, ep(3)); assert.deepEqual(shifted.registry.bookmarks[0].end, ep(9));
  assert.equal(shifted.registry.revision, 2); assert.equal(shifted.changed, true);
  assert.deepEqual(shifted.doc.content[0].content[0].marks, before.content[0].content[0].marks);
  const inside = model.planSave({ beforeDoc: before, workingDoc: changeText(before, 'A tarNEWget Z') });
  assert.deepEqual(inside.registry.bookmarks[0].start, ep(2)); assert.deepEqual(inside.registry.bookmarks[0].end, ep(11));
  const shortened = model.planSave({ beforeDoc: before, workingDoc: changeText(before, 'A taget Z') });
  assert.deepEqual(shortened.registry.bookmarks[0].end, ep(7));
  assert.deepEqual(model.planSave({ beforeDoc: shifted.doc, workingDoc: copy(shifted.doc) }).doc, shifted.doc);
});

test('collapsed point has observed left affinity at insertion and follows strict preceding edit', () => {
  const before = create(doc('abcDEF'), 'Point', ep(3), ep(3)).doc;
  const samePlace = model.planSave({ beforeDoc: before, workingDoc: changeText(before, 'abc!DEF') });
  assert.deepEqual(samePlace.registry.bookmarks[0].start, ep(3)); assert.equal(samePlace.changed, false);
  const shifted = model.planSave({ beforeDoc: before, workingDoc: changeText(before, '!abcDEF') });
  assert.deepEqual(shifted.registry.bookmarks[0].start, ep(4)); assert.deepEqual(shifted.registry.bookmarks[0].end, ep(4));
  typed(() => model.planSave({ beforeDoc: before, workingDoc: changeText(before, 'abEF') }), 'USER_BOOKMARK_EDIT_BOUNDARY_CONFLICT');
});

test('native range endpoints have left insertion affinity; replacement boundaries still conflict', () => {
  const before = create(doc('abcDEFghi'), 'Range', ep(3), ep(6)).doc;
  const left = model.planSave({ beforeDoc: before, workingDoc: changeText(before, 'abc!DEFghi') });
  assert.deepEqual(left.registry.bookmarks[0].start, ep(3)); assert.deepEqual(left.registry.bookmarks[0].end, ep(7));
  const right = model.planSave({ beforeDoc: before, workingDoc: changeText(before, 'abcDEF!ghi') });
  assert.deepEqual(right.registry, model.readRegistry(before));
  for (const text of ['abEFghi', 'abcDEhi']) typed(() => model.planSave({ beforeDoc: before, workingDoc: changeText(before, text) }), 'USER_BOOKMARK_EDIT_BOUNDARY_CONFLICT');
  assert.deepEqual(model.planSave({ beforeDoc: before, workingDoc: changeText(before, 'abcDEFghi!') }).registry, model.readRegistry(before));
});

test('all equivalent repeated-text edit placements must produce same endpoint result', () => {
  const point = create(doc('aaaa'), 'Point', ep(2), ep(2)).doc;
  typed(() => model.planSave({ beforeDoc: point, workingDoc: changeText(point, 'aaaaa') }), 'USER_BOOKMARK_EDIT_AMBIGUOUS');
  const outside = create(doc('XaaaaZ'), 'Outside', ep(0), ep(0)).doc;
  assert.deepEqual(model.planSave({ beforeDoc: outside, workingDoc: changeText(outside, 'XaaaaaZ') }).registry, model.readRegistry(outside));
  const boundary = create(doc('XaaaaZ'), 'Boundary', ep(1), ep(5)).doc;
  typed(() => model.planSave({ beforeDoc: boundary, workingDoc: changeText(boundary, 'XaaaaaZ') }), 'USER_BOOKMARK_EDIT_AMBIGUOUS');
});

test('cross-block and paragraph-mark endpoints follow edits without losing edge identity', () => {
  const before = create(doc('abcDEF', 'ghijkl'), 'Cross', ep(2), ep(4, 1)).doc;
  let work = changeText(before, '!abcDEF'); work = changeText(work, 'gh!ijkl', 1);
  const after = model.planSave({ beforeDoc: before, workingDoc: work });
  assert.deepEqual(after.registry.bookmarks[0].start, ep(3)); assert.deepEqual(after.registry.bookmarks[0].end, ep(5, 1));
  const paragraph = create(doc('abc'), 'Paragraph', ep(1), ep(3, 0, 'afterParagraph')).doc;
  assert.deepEqual(model.planSave({ beforeDoc: paragraph, workingDoc: changeText(paragraph, 'abc!') }).registry.bookmarks[0].end, ep(4, 0, 'afterParagraph'));
});

test('grapheme-aware replacement widens edit around shared surrogate prefix', () => {
  const before = create(doc('😀abc'), 'After', ep(3), ep(4)).doc;
  const after = model.planSave({ beforeDoc: before, workingDoc: changeText(before, '😁abc') });
  assert.deepEqual(after.registry, model.readRegistry(before));
});

test('unsupported block moves and kind changes produce typed zero-write plans', () => {
  const before = create(doc('abcDEF', 'other'), 'Target', ep(2), ep(5)).doc;
  for (const mutate of [
    x => x.content[0].type = 'heading',
    x => x.content[0] = { type: 'blockquote', content: [x.content[0]] },
    x => x.content.reverse(),
  ]) {
    const work = copy(before); mutate(work);
    typed(() => model.planSave({ beforeDoc: before, workingDoc: work }));
    assert.deepEqual(before, create(doc('abcDEF', 'other'), 'Target', ep(2), ep(5)).doc);
  }
});

test('root text duplication is insertion, never a copied bookmark identity', () => {
  const before = create(doc('abcDEF', 'other'), 'Target', ep(2), ep(5)).doc;
  const work = copy(before); work.content.push(copy(work.content[0]));
  const result = model.planSave({ beforeDoc: before, workingDoc: work });
  assert.deepEqual(result.registry, model.readRegistry(before));
  assert.equal(result.registry.bookmarks.length, 1);
  assert.deepEqual(result.doc.content, work.content);
});

test('root paragraph split, join and multiline insertion preserve exact bookmark endpoints', () => {
  const before = create(doc('Left target right'), 'Target', ep(5), ep(11)).doc;
  const split = copy(before); split.content = doc('Left', ' target right').content;
  const saved = model.planSave({ beforeDoc: before, workingDoc: split });
  assert.deepEqual(saved.registry.bookmarks[0].start, ep(1, 1));
  assert.deepEqual(saved.registry.bookmarks[0].end, ep(7, 1));
  const join = copy(saved.doc); join.content = copy(before.content);
  assert.deepEqual(model.planSave({ beforeDoc: saved.doc, workingDoc: join }).registry.bookmarks[0], model.readRegistry(before).bookmarks[0]);
  const paste = copy(before); paste.content = doc('NEW', 'Left target right').content;
  const pasted = model.planSave({ beforeDoc: before, workingDoc: paste });
  assert.deepEqual(pasted.registry.bookmarks[0].start, ep(5, 1));
  assert.deepEqual(pasted.registry.bookmarks[0].end, ep(11, 1));
  assert.equal(pasted.registry.bookmarks[0].id, model.readRegistry(before).bookmarks[0].id);
});

test('paragraph terminator endpoints preserve owner and refuse deleted or ambiguous ownership', () => {
  const before = create(doc('abcdef'), 'Mark', ep(2), ep(6, 0, 'afterParagraph')).doc;
  const split = copy(before); split.content = doc('abc', 'def').content;
  const result = model.planSave({ beforeDoc: before, workingDoc: split });
  assert.deepEqual(result.registry.bookmarks[0].end, ep(3, 1, 'afterParagraph'));
  const joined = copy(result.doc); joined.content = copy(before.content);
  assert.deepEqual(model.planSave({ beforeDoc: result.doc, workingDoc: joined }).registry.bookmarks[0], model.readRegistry(before).bookmarks[0]);
  const ambiguous = copy(before); ambiguous.content = doc('abcdef', '').content;
  typed(() => model.planSave({ beforeDoc: before, workingDoc: ambiguous }), 'USER_BOOKMARK_EDIT_AMBIGUOUS');
  const deleted = create(doc('abc', 'def'), 'DeletedMark', ep(3, 0, 'afterParagraph'), ep(3, 0, 'afterParagraph')).doc;
  const work = copy(deleted); work.content = doc('abcdef').content;
  typed(() => model.planSave({ beforeDoc: deleted, workingDoc: work }), 'USER_BOOKMARK_EDIT_BOUNDARY_CONFLICT');
  const nextStart = create(doc('abc', 'def'), 'NextStart', ep(0, 1), ep(2, 1)).doc;
  work.attrs = copy(nextStart.attrs);
  const nextJoined = model.planSave({ beforeDoc: nextStart, workingDoc: work });
  assert.deepEqual(nextJoined.registry.bookmarks[0].start, ep(3));
  assert.deepEqual(nextJoined.registry.bookmarks[0].end, ep(5));
});

test('root structural edit shifts unchanged table/list leaves by occurrence and rejects protected mutations', () => {
  const table = { type: 'table', content: [{ type: 'tableRow', content: [0, 1].map(() => ({ type: 'tableCell', content: doc('same').content })) }] };
  table.content[0].content[0].content[0].content[0].marks = [{ type: 'italic' }];
  const list = { type: 'orderedList', attrs: { start: 3 }, content: [{ type: 'listItem', content: doc('same').content }] };
  let before = create({ type: 'doc', content: [doc('before root').content[0], table, list, doc('after').content[0]] }, 'SecondCell', ep(1, 2), ep(3, 2)).doc;
  before = create(before, 'List', ep(0, 3), ep(4, 3), 'list').doc;
  const work = copy(before); work.content.splice(0, 1, ...doc('before', ' root').content);
  const result = model.planSave({ beforeDoc: before, workingDoc: work });
  assert.deepEqual(result.registry.bookmarks.map(b => b.start.paragraphIndex), [3, 4]);
  assert.deepEqual(result.doc.content.slice(2), before.content.slice(1));
  for (const mutate of [
    x => x.content.push(copy(table)), x => x.content[2].content[0].content.reverse(),
    x => x.content[2].content[0].content[0].attrs = { colspan: 2 },
    x => x.content[3].attrs.start++, x => x.content[2].content[0].content[0].content[0].content[0].text = 'moved',
    x => x.content[x.content.length - 1].content[0].text = 'changed too',
  ]) {
    const bad = copy(work); mutate(bad);
    typed(() => model.planSave({ beforeDoc: before, workingDoc: bad }), 'USER_BOOKMARK_SAVE_STRUCTURE_CONFLICT');
  }
});

test('root structural proof retains rich marks, grapheme bounds and rejects replacement or hardBreak substitution', () => {
  const before = create(doc('A😀e\u0301 target'), 'Target', ep(6), ep(12)).doc;
  const work = copy(before); work.content = doc('A😀e\u0301', ' target').content;
  const result = model.planSave({ beforeDoc: before, workingDoc: work });
  assert.deepEqual(result.registry.bookmarks[0].start, ep(1, 1));
  for (const mutate of [
    x => x.content[1].content[0].marks = [{ type: 'italic' }],
    x => x.content[0].content[0].text = 'other',
    x => x.content[1].attrs.textAlign = 'right',
    x => x.content[0].content[0].text = 'A\ud83d',
  ]) { const bad = copy(work); mutate(bad); typed(() => model.planSave({ beforeDoc: before, workingDoc: bad })); }
  const hard = create(doc('ab\ncd'), 'End', ep(4), ep(5)).doc;
  hard.content[0].content = [{ type: 'text', text: 'ab', marks: [{ type: 'bold' }] }, { type: 'hardBreak' }, { type: 'text', text: 'cd', marks: [{ type: 'bold' }] }];
  const fake = copy(hard); fake.content = doc('ab', 'cd').content;
  typed(() => model.planSave({ beforeDoc: hard, workingDoc: fake }), 'USER_BOOKMARK_SAVE_STRUCTURE_CONFLICT');
});

test('root mapping permits unrelated paragraph attrs and rejects consumed endpoints in inverse paste', () => {
  const before = create(doc('prefix target', 'Different style'), 'Target', ep(7), ep(13)).doc;
  before.content[1].attrs.textAlign = 'right';
  const working = copy(before); working.content.splice(0, 1, ...doc('pre', 'fix target').content);
  const saved = model.planSave({ beforeDoc: before, workingDoc: working });
  assert.deepEqual(saved.registry.bookmarks[0].start, ep(4, 1));
  assert.equal(saved.doc.content[2].attrs.textAlign, 'right');
  const consumed = create(doc('abXX', 'YYcd'), 'Inside', ep(3), ep(3)).doc;
  const deletion = copy(consumed); deletion.content = doc('abcd').content;
  typed(() => model.planSave({ beforeDoc: consumed, workingDoc: deletion }), 'USER_BOOKMARK_EDIT_BOUNDARY_CONFLICT');
  const repeated = create(doc('a', 'a'), 'Second', ep(0, 1), ep(1, 1)).doc;
  const removed = copy(repeated); removed.content = doc('a').content;
  typed(() => model.planSave({ beforeDoc: repeated, workingDoc: removed }));
});

test('literal split-position oracle covers text points, empty paragraphs and surrogate boundaries', () => {
  const text = 'A😀BC', positions = [0, 1, 3, 4, 5];
  let before = doc(text);
  for (const position of positions) before = create(before, 'Point' + position, ep(position), ep(position), 'point-' + position).doc;
  for (const cut of positions) {
    const work = copy(before); work.content = doc(text.slice(0, cut), text.slice(cut)).content;
    const saved = model.planSave({ beforeDoc: before, workingDoc: work });
    assert.deepEqual(saved.registry.bookmarks.map(b => b.start), positions.map(position =>
      position <= cut ? ep(position) : ep(position - cut, 1)));
    const joined = copy(saved.doc); joined.content = copy(before.content);
    assert.deepEqual(model.planSave({ beforeDoc: saved.doc, workingDoc: joined }).registry.bookmarks, model.readRegistry(before).bookmarks);
  }
  const empty = create(doc('', ''), 'EmptySecond', ep(0, 1), ep(0, 1)).doc;
  const collapsed = copy(empty); collapsed.content = doc('').content;
  typed(() => model.planSave({ beforeDoc: empty, workingDoc: collapsed }), 'USER_BOOKMARK_EDIT_AMBIGUOUS');
});

test('internal links require exact declared ID and name; external links remain ordinary', () => {
  const value = create(doc('A target Z')); const record = value.registry.bookmarks[0];
  assert.equal(model.inspectInternalLink({ type: 'link', attrs: { href: 'https://example.invalid/' } }, null), null);
  assert.equal(model.inspectInternalLink({ type: 'link', attrs: { href: '#Target', wordBookmarkName: 'Target' } }, null, { allowUnbound: true }), null);
  for (const attrs of [
    { href: '#Target' }, { ...model.linkAttrs(record), wordBookmarkName: 'Other' },
    { ...model.linkAttrs(record), wordBookmarkId: 'ubm-' + 'f'.repeat(32) },
    { ...model.linkAttrs(record), href: 'https://example.invalid/' },
    { ...model.linkAttrs(record), 'r:id': 'rId1' },
  ]) typed(() => model.inspectInternalLink({ type: 'link', attrs }, value.registry));
  assert.equal(model.inspectInternalLink({ type: 'link', attrs: model.linkAttrs(record) }, value.registry).id, record.id);
  const actualSchemaLink = { type: 'link', attrs: {
    ...model.linkAttrs(record), target: '_blank', rel: 'noopener noreferrer nofollow', class: null, title: null,
  } };
  assert.equal(model.inspectInternalLink(actualSchemaLink, value.registry).id, record.id);
  value.doc.content[0].content[0].marks.push(actualSchemaLink);
  const renamed = model.planMutation({ doc: value.doc, action: 'rename', bookmarkId: record.id, name: 'Renamed' });
  assert.equal(renamed.doc.content[0].content[0].marks[1].attrs.title, null);
  assert.equal(renamed.doc.content[0].content[0].marks[1].attrs.href, '#Renamed');
  assert.equal(model.planSave({ beforeDoc: renamed.doc, workingDoc: copy(renamed.doc) }).changed, false);
  for (const title of ['unsupported tooltip', '', undefined, false]) {
    const bad = copy(actualSchemaLink); bad.attrs.title = title;
    typed(() => model.inspectInternalLink(bad, value.registry), 'USER_BOOKMARK_LINK_TITLE_UNSUPPORTED');
  }
});

test('generic Word inventory binds names once, preserves label, and creates explicit broken identities', () => {
  const before = doc('target label broken');
  before.content[0].content = [
    { type: 'text', text: 'target ' },
    { type: 'text', text: 'label', marks: [{ type: 'link', attrs: { href: '#Native', wordBookmarkName: 'Native' } }] },
    { type: 'text', text: ' broken', marks: [{ type: 'link', attrs: { href: '#Deleted' } }] },
  ];
  const inventory = { schemaVersion: 'yalken.word-user-bookmark-inventory.v1', bookmarks: [
    { name: 'Native', start: ep(0), end: ep(6), sourceXmlProvenance: { wordId: '3' } },
  ], links: [{ name: 'Native', paragraphIndex: 0, from: 7, to: 12, sourceXmlProvenance: { part: 'document.xml' } }] };
  const out = model.importInventory(before, inventory, 'fresh-scene-seed'); const registry = model.readRegistry(out);
  assert.equal(registry.bookmarks.length, 2); assert.equal(registry.bookmarks[1].state, 'deleted');
  assert.equal(out.content[0].content[1].text, 'label');
  assert.equal(model.inspectInternalLink(out.content[0].content[2].marks[0], registry).state, 'deleted');
  assert.equal(registry.bookmarks[0].sourceXmlProvenance, undefined);
  assert.notEqual(model.readRegistry(model.importInventory(before, inventory, 'other-scene')).bookmarks[0].id, registry.bookmarks[0].id);
  typed(() => model.importInventory(out, inventory, 'seed'), 'USER_BOOKMARK_IMPORT_REGISTRY_PRESENT');
  const forged = copy(before); forged.content[0].content[1].marks[0].attrs.wordBookmarkId = registry.bookmarks[0].id;
  typed(() => model.importInventory(forged, inventory, 'seed'), 'USER_BOOKMARK_IMPORT_PREBOUND_LINK');
});

test('inventory provenance is inert bounded data and hostile shapes are rejected', () => {
  const inventory = { bookmarks: [{ name: 'Native', start: ep(0), end: ep(1), sourceXmlProvenance: { path: '../not-authority', wordId: '7' } }] };
  assert.equal(model.readRegistry(model.importInventory(doc('abc'), inventory, 's')).bookmarks[0].name, 'Native');
  inventory.bookmarks[0].sourceXmlProvenance = { command() {} };
  typed(() => model.importInventory(doc('abc'), inventory, 's'), 'USER_BOOKMARK_PROVENANCE_INVALID');
});

test('pending composite, stale bounds, overflow and registry budget cannot normalize into success', () => {
  const before = create(doc('A target Z')).doc;
  const pending = copy(before); pending.attrs.wordPendingRevisions = { arbitrary: true };
  typed(() => model.readRegistry(pending), 'USER_BOOKMARK_PENDING_COMPOSITE_UNSUPPORTED');
  typed(() => model.planSave({ beforeDoc: before, workingDoc: pending }), 'USER_BOOKMARK_PENDING_COMPOSITE_UNSUPPORTED');
  const stale = copy(before); stale.attrs[model.KEY].bookmarks[0].end = ep(999);
  typed(() => model.readRegistry(stale), 'USER_BOOKMARK_ENDPOINT_BOUNDARY');
  assert.doesNotThrow(() => envelope.canonicalizeDocumentJson(stale)); // Structural only; save checks trusted bounds.
  const overflow = copy(before); overflow.attrs[model.KEY].revision = Number.MAX_SAFE_INTEGER;
  typed(() => model.planMutation({ doc: overflow, action: 'rename', bookmarkId: model.readRegistry(overflow).bookmarks[0].id, name: 'Other' }), 'USER_BOOKMARK_REVISION_OVERFLOW');
  const budget = copy(before); budget.attrs[model.KEY].bookmarks = Array.from({ length: 1025 }, () => copy(budget.attrs[model.KEY].bookmarks[0]));
  typed(() => model.readRegistry(budget), 'USER_BOOKMARK_ARRAY_INVALID');
});

test('raw root/record accessors are rejected without executing payload code', () => {
  const source = create(doc('A target Z')).doc; let executed = 0;
  for (const attach of [
    x => Object.defineProperty(x, 'attrs', { get() { executed++; return source.attrs; } }),
    x => Object.defineProperty(x.attrs, model.KEY, { get() { executed++; return source.attrs[model.KEY]; } }),
    x => Object.defineProperty(x.attrs[model.KEY].bookmarks[0], 'state', { get() { executed++; return 'active'; } }),
  ]) {
    const input = copy(source); attach(input);
    typed(() => model.readRegistry(input), 'USER_BOOKMARK_SHAPE_INVALID');
    typed(() => envelope.canonicalizeDocumentJson(input), 'USER_BOOKMARK_SHAPE_INVALID');
  }
  assert.equal(executed, 0);
});

test('envelope absent/null path does not load new module in historical isolated sandbox', () => {
  const fs = require('node:fs'), vm = require('node:vm'); let loads = 0;
  const sandbox = { module: { exports: {} }, require(name) {
    if (name === './word-user-bookmarks-v1.cjs') { loads++; throw new Error('NEW_MODULE_NOT_COPIED'); }
    if (name === './word-pending-text-revisions-v1.cjs') return { readLedger() { return null; } };
    throw new Error('Unexpected module ' + name);
  } };
  vm.runInNewContext(fs.readFileSync(require.resolve('../../src/core/document-content-envelope-v1.cjs'), 'utf8'), sandbox);
  assert.doesNotThrow(() => sandbox.module.exports.canonicalizeDocumentJson(doc('old')));
  const empty = doc('old'); empty.attrs = { [model.KEY]: null };
  assert.doesNotThrow(() => sandbox.module.exports.canonicalizeDocumentJson(empty)); assert.equal(loads, 0);
  assert.throws(() => sandbox.module.exports.canonicalizeDocumentJson(create(doc('A target Z')).doc), /NEW_MODULE_NOT_COPIED/);
  assert.equal(loads, 1);
});

test('generic import case-fold binds native spelling once and never aliases active names', () => {
  const source = doc('Target label'); source.content[0].content[0].marks.push({ type: 'link', attrs: { href: '#цель_ω', wordBookmarkName: 'цель_ω' } });
  const inventory = { bookmarks: [{ name: 'Цель_Ω', start: ep(0), end: ep(6) }] };
  const imported = model.importInventory(source, inventory, 's');
  assert.equal(model.readRegistry(imported).bookmarks.length, 1);
  assert.equal(imported.content[0].content[0].marks[1].attrs.href, '#Цель_Ω');
  inventory.bookmarks.push({ name: 'цель_ω', start: ep(7), end: ep(12) });
  typed(() => model.importInventory(source, inventory, 's'), 'USER_BOOKMARK_DUPLICATE_NAME');
  typed(() => model.importInventory(doc('abc'), { bookmarks: [] }, ''), 'USER_BOOKMARK_SEED_INVALID');
});

test('authenticated return admission preserves ID for rename and deletion, requires exact revision', () => {
  const before = create(doc('A target Z'), 'Target');
  const renamed = model.planMutation({ doc: before.doc, action: 'rename', bookmarkId: before.bookmarkId, name: 'NativeRename' });
  assert.equal(model.planReturn({ beforeDoc: before.doc, candidateDoc: renamed.doc }).changed, true);
  const deleted = model.planMutation({ doc: renamed.doc, action: 'delete', bookmarkId: before.bookmarkId });
  assert.equal(model.planReturn({ beforeDoc: renamed.doc, candidateDoc: deleted.doc }).registry.bookmarks[0].state, 'deleted');
  assert.equal(model.planReturn({ beforeDoc: before.doc, candidateDoc: copy(before.doc) }).changed, false);
  const badRevision = copy(renamed.doc); badRevision.attrs[model.KEY].revision++;
  typed(() => model.planReturn({ beforeDoc: before.doc, candidateDoc: badRevision }), 'USER_BOOKMARK_RETURN_REVISION');
  const badId = copy(before.doc); badId.attrs[model.KEY].bookmarks[0].id = 'ubm-' + 'f'.repeat(32);
  typed(() => model.planReturn({ beforeDoc: before.doc, candidateDoc: badId }), 'USER_BOOKMARK_RETURN_ID_REMOVED');
  const relocated = copy(before.doc); relocated.attrs[model.KEY].bookmarks[0].start = ep(1);
  typed(() => model.planReturn({ beforeDoc: before.doc, candidateDoc: relocated }), 'USER_BOOKMARK_RETURN_ENDPOINT_RELOCATED');
  typed(() => model.planReturn({ beforeDoc: deleted.doc, candidateDoc: renamed.doc }), 'USER_BOOKMARK_RETURN_TOMBSTONE_CHANGED');
  const renamedTombstone = copy(deleted.doc); renamedTombstone.attrs[model.KEY].bookmarks[0].name = 'Other';
  typed(() => model.planReturn({ beforeDoc: deleted.doc, candidateDoc: renamedTombstone }), 'USER_BOOKMARK_RETURN_TOMBSTONE_CHANGED');
});

test('authenticated new bookmark candidate uses separate admission; generic save never grants creation', () => {
  const before = create(doc('A target Z'), 'Original');
  const added = create(before.doc, 'NativeNew', ep(1), ep(4), 'new-native');
  assert.equal(model.planReturn({ beforeDoc: before.doc, candidateDoc: added.doc }).registry.bookmarks.length, 2);
  typed(() => model.planSave({ beforeDoc: before.doc, workingDoc: added.doc }), 'USER_BOOKMARK_SAVE_AUTHORITY');
  const deletedName = model.planMutation({ doc: before.doc, action: 'delete', bookmarkId: before.bookmarkId });
  deletedName.doc.attrs[model.KEY].bookmarks[0].name = 'HiddenRename';
  typed(() => model.planReturn({ beforeDoc: before.doc, candidateDoc: deletedName.doc }), 'USER_BOOKMARK_RETURN_DELETED_NAME');
});

test('return permits one owned label change with exact nonlink formatting and neighboring text', () => {
  const before = create(doc('target', 'Before label after'), 'Target', ep(0), ep(6));
  const target = before.registry.bookmarks[0];
  before.doc.content[1].content = [
    { type: 'text', text: 'Before ', marks: [{ type: 'italic' }] },
    { type: 'text', text: 'label', marks: [{ type: 'bold' }, { type: 'link', attrs: model.linkAttrs(target) }] },
    { type: 'text', text: ' after', marks: [{ type: 'italic' }] },
  ];
  const candidate = copy(before.doc); candidate.attrs[model.KEY].revision++;
  candidate.content[1].content[1].text = 'new label';
  assert.equal(model.planReturn({ beforeDoc: before.doc, candidateDoc: candidate }).changed, true);
  const removedLink = copy(candidate); removedLink.content[1].content[1].marks.pop();
  assert.equal(model.planReturn({ beforeDoc: before.doc, candidateDoc: removedLink }).changed, true);
  const changedStyle = copy(candidate); changedStyle.content[1].content[1].marks[0].type = 'italic';
  typed(() => model.planReturn({ beforeDoc: before.doc, candidateDoc: changedStyle }), 'USER_BOOKMARK_RETURN_LABEL_STYLE');
  const changedNeighbor = copy(candidate); changedNeighbor.content[1].content[0].text = 'Forged ';
  typed(() => model.planReturn({ beforeDoc: before.doc, candidateDoc: changedNeighbor }), 'USER_BOOKMARK_RETURN_UNOWNED_TEXT');
  const changedRoot = copy(candidate); changedRoot.attrs.hiddenProductTruth = 'forged';
  typed(() => model.planReturn({ beforeDoc: before.doc, candidateDoc: changedRoot }), 'USER_BOOKMARK_RETURN_NONLINK_CHANGE');
  const changedParagraph = copy(candidate); changedParagraph.content[0].attrs.textAlign = 'right';
  typed(() => model.planReturn({ beforeDoc: before.doc, candidateDoc: changedParagraph }), 'USER_BOOKMARK_RETURN_NONLINK_CHANGE');
  const styleOrder = copy(before.doc);
  styleOrder.content[1].content[1].marks.unshift({ type: 'textStyle', attrs: { fontSize: '14pt', color: '#123456' } });
  const styleCandidate = copy(styleOrder); styleCandidate.attrs[model.KEY].revision++;
  styleCandidate.content[1].content[1].text = 'new label'; styleCandidate.content[1].content[1].marks.reverse();
  assert.equal(model.planReturn({ beforeDoc: styleOrder, candidateDoc: styleCandidate }).changed, true);
  const hiddenByNewLink = copy(before.doc); hiddenByNewLink.attrs[model.KEY].revision++;
  hiddenByNewLink.content[0].content[0].text = 'forged';
  hiddenByNewLink.content[0].content[0].marks.push({ type: 'link', attrs: model.linkAttrs(target) });
  typed(() => model.planReturn({ beforeDoc: before.doc, candidateDoc: hiddenByNewLink }), 'USER_BOOKMARK_RETURN_UNOWNED_TEXT');
});

test('return supports link retarget/remove/add while preserving nonlink rich content', () => {
  const before = create(doc('A target Z'), 'Target');
  before.doc.content[0].content[0].marks.push({ type: 'link', attrs: model.linkAttrs(before.registry.bookmarks[0]) });
  const external = copy(before.doc); external.attrs[model.KEY].revision++;
  external.content[0].content[0].marks[1].attrs = { href: 'https://example.invalid/new' };
  assert.equal(model.planReturn({ beforeDoc: before.doc, candidateDoc: external }).changed, true);
  const removed = copy(external); removed.content[0].content[0].marks.pop();
  assert.equal(model.planReturn({ beforeDoc: before.doc, candidateDoc: removed }).changed, true);
  const unlinked = copy(before.doc); unlinked.content[0].content[0].marks.pop();
  assert.equal(model.planReturn({ beforeDoc: unlinked, candidateDoc: external }).changed, true);
});

test('governed scene history restores exact older registry without inventing mutation authority', () => {
  const original = create(doc('A target Z'), 'Target');
  original.doc.content[0].content[0].marks.push({ type: 'link', attrs: model.linkAttrs(original.registry.bookmarks[0]) });
  const deleted = model.planMutation({ doc: original.doc, action: 'delete', bookmarkId: original.bookmarkId });
  const plan = model.planHistoryRestore({ beforeDoc: deleted.doc, snapshotDoc: original.doc });
  assert.deepEqual(plan.doc, original.doc); assert.equal(plan.registry.revision, 1);
  assert.equal(plan.registry.bookmarks[0].state, 'active'); assert.equal(plan.changed, true);
  assert.equal(plan.canWriteManuscript, undefined); assert.equal(plan.authenticated, undefined);
  assert.equal(plan.mode, undefined);
  plan.doc.content[0].content[0].text = 'changed clone';
  assert.equal(original.doc.content[0].content[0].text, 'A target Z');
  assert.equal(model.planHistoryRestore({ beforeDoc: original.doc, snapshotDoc: copy(original.doc) }).changed, false);
  assert.deepEqual(model.planHistoryRestore({ beforeDoc: original.doc, snapshotDoc: doc('legacy') }).doc, doc('legacy'));
});

test('history rejects corrupted raw registry or links before any restored document is returned', () => {
  const valid = create(doc('A target Z')).doc;
  for (const mutate of [
    x => x.attrs[model.KEY].bookmarks[0].end = ep(999),
    x => x.attrs[model.KEY].bookmarks.push(copy(x.attrs[model.KEY].bookmarks[0])),
    x => x.attrs[model.KEY].revision = -1,
    x => x.content[0].content[0].marks.push({ type: 'link', attrs: { href: '#Target', wordBookmarkId: 'ubm-' + 'f'.repeat(32), wordBookmarkName: 'Target' } }),
    x => Object.defineProperty(x.attrs[model.KEY], 'revision', { enumerable: true, get() { throw new Error('GETTER_EXECUTED'); } }),
  ]) {
    const forged = copy(valid); mutate(forged);
    typed(() => model.planHistoryRestore({ beforeDoc: valid, snapshotDoc: forged }));
    typed(() => model.planHistoryRestore({ beforeDoc: forged, snapshotDoc: valid }));
  }
  const withoutRegistry = doc('plain'); withoutRegistry.content[0].content[0].marks.push({ type: 'link', attrs: model.linkAttrs(model.readRegistry(valid).bookmarks[0]) });
  typed(() => model.planHistoryRestore({ beforeDoc: valid, snapshotDoc: withoutRegistry }), 'USER_BOOKMARK_LINK_TARGET_INVALID');
});

test('ordinary scene history with absent/null bookmark defaults retains established rich artifact path', () => {
  const before = doc('before'), snapshot = doc('after');
  snapshot.attrs = { [model.KEY]: null };
  snapshot.content[0].content[0].marks.push({ type: 'link', attrs: { href: 'https://example.invalid/' } });
  const plan = model.planHistoryRestore({ beforeDoc: before, snapshotDoc: snapshot });
  assert.equal(plan.registry, null); assert.deepEqual(plan.doc, snapshot);
});

const declarationV3 = '{"format":"yalken.scene-document","version":3,"requiredFeatures":["word-user-bookmarks.v1"]}';
const framed = serialized => `[doc-v2 length=${serialized.length}]\n${serialized}`;

test('bookmark scenes declare readable format3; semantic JSON APIs stay ordinary JSON', () => {
  const scene = create(doc('A target Z')).doc;
  const canonical = envelope.serializeDocumentJson(scene);
  assert.deepEqual(JSON.parse(canonical), envelope.canonicalizeDocumentJson(scene));
  const payload = envelope.composeObservablePayload({ doc: scene });
  assert.equal(payload, framed(declarationV3 + '\n' + canonical));
  const parsed = envelope.parseObservablePayload(payload);
  assert.equal(parsed.issue, null); assert.equal(parsed.version, 2); assert.equal(parsed.payloadVersion, 3);
  assert.deepEqual(parsed.doc, envelope.canonicalizeDocumentJson(scene));
  assert.equal(parsed.text, 'A target Z');
  assert.throws(() => JSON.parse(declarationV3 + '\n' + canonical), SyntaxError);
});

test('absent/null registry preserves exact legacy payload bytes and additive parser discriminator', () => {
  for (const scene of [doc('legacy'), { ...doc('legacy'), attrs: { [model.KEY]: null } }]) {
    const legacy = framed(envelope.serializeDocumentJson(scene));
    assert.equal(envelope.composeObservablePayload({ doc: scene }), legacy);
    const parsed = envelope.parseObservablePayload(legacy);
    assert.equal(parsed.payloadVersion, 2); assert.equal(parsed.version, 2); assert.equal(parsed.issue, null);
  }
  assert.equal(envelope.parseObservablePayload('legacy text').payloadVersion, 1);
});

test('non-null registry requires its format declaration before legacy normalization', () => {
  const scene = create(doc('A target Z')).doc;
  for (const serialized of [JSON.stringify(scene), envelope.serializeDocumentJson(scene)]) {
    const parsed = envelope.parseObservablePayload(framed(serialized));
    assert.equal(parsed.doc, null); assert.equal(parsed.text, '');
    assert.equal(parsed.issue.code, 'E_DOC_PAYLOAD_INVALID');
    assert.equal(parsed.issue.reason, 'DOC_BLOCK_REQUIRED_DECLARATION_MISSING');
  }
  const empty = { ...doc('legacy'), attrs: { [model.KEY]: { schemaVersion: model.SCHEMA, revision: 0, bookmarks: [] } } };
  assert.equal(envelope.parseObservablePayload(framed(JSON.stringify(empty))).issue.reason, 'DOC_BLOCK_REQUIRED_DECLARATION_MISSING');
  assert.equal(envelope.parseObservablePayload(envelope.composeObservablePayload({ doc: scene })).payloadVersion, 3);
});

test('future/malformed feature declarations and extra records produce typed refusal without rich fallback', () => {
  const rawDoc = envelope.serializeDocumentJson(create(doc('A target Z')).doc);
  for (const [header, reason] of [
    [declarationV3.replace('"version":3', '"version":4'), 'DOC_BLOCK_FORMAT_UNSUPPORTED'],
    [declarationV3.replace('yalken.scene-document', 'foreign.scene-document'), 'DOC_BLOCK_FORMAT_UNSUPPORTED'],
    [declarationV3.replace('word-user-bookmarks.v1', 'word-user-bookmarks.v2'), 'DOC_BLOCK_REQUIRED_FEATURES_UNSUPPORTED'],
    [declarationV3.replace('["word-user-bookmarks.v1"]', '[]'), 'DOC_BLOCK_REQUIRED_FEATURES_UNSUPPORTED'],
    [declarationV3.replace('["word-user-bookmarks.v1"]', '["word-user-bookmarks.v1","unknown"]'), 'DOC_BLOCK_REQUIRED_FEATURES_UNSUPPORTED'],
    [declarationV3.replace('"requiredFeatures"', '"hiddenRequiredFeatures"'), 'DOC_BLOCK_FORMAT_DECLARATION_INVALID'],
    [declarationV3.replace('"version":3', '"version":3,"version":3'), 'DOC_BLOCK_FORMAT_DECLARATION_INVALID'],
    [declarationV3.replace('{', '{"hidden":true,'), 'DOC_BLOCK_FORMAT_DECLARATION_INVALID'],
  ]) {
    const parsed = envelope.parseObservablePayload(framed(header + '\n' + rawDoc));
    assert.equal(parsed.doc, null); assert.equal(parsed.issue.code, 'E_DOC_PAYLOAD_INVALID');
    assert.equal(parsed.issue.reason, reason); assert.equal(parsed.text, '');
  }
  for (const trailing of ['{}', rawDoc, 'unexpected']) {
    const parsed = envelope.parseObservablePayload(framed(declarationV3 + '\n' + rawDoc + '\n' + trailing));
    assert.equal(parsed.doc, null); assert.equal(parsed.issue.code, 'E_DOC_PAYLOAD_INVALID');
  }
  for (const version of [3, 4]) {
    const header = { format: 'yalken.scene-document', version, requiredFeatures: ['word-user-bookmarks.v1'] };
    for (const serialized of [JSON.stringify(header), JSON.stringify(header, null, 2)]) {
      const parsed = envelope.parseObservablePayload(framed(serialized));
      assert.equal(parsed.doc, null); assert.equal(parsed.issue.code, 'E_DOC_PAYLOAD_INVALID');
      assert.equal(parsed.issue.reason, version === 4 ? 'DOC_BLOCK_FORMAT_UNSUPPORTED' : 'DOC_BLOCK_FORMAT_DECLARATION_INVALID');
      assert.equal(parsed.text, '');
    }
  }
  for (const serialized of ['null', '[]', '{"hidden":"not-a-document"}']) {
    const parsed = envelope.parseObservablePayload(framed(serialized));
    assert.equal(parsed.doc, null); assert.equal(parsed.issue.reason, 'DOC_BLOCK_DOCUMENT_INVALID');
  }
});

test('declared document shape and raw registry are validated before canonical normalization', () => {
  for (const raw of [null, [], { type: 'doc', content: [] }, { ...doc('legacy'), attrs: { [model.KEY]: null } }]) {
    const parsed = envelope.parseObservablePayload(framed(declarationV3 + '\n' + JSON.stringify(raw)));
    assert.equal(parsed.doc, null); assert.equal(parsed.issue.reason, 'DOC_BLOCK_REQUIRED_FEATURE_MISSING');
  }
  for (const mutate of [
    scene => scene.attrs[model.KEY].bookmarks[0].end = null,
    scene => scene.attrs[model.KEY].hidden = true,
    scene => scene.attrs[model.KEY].bookmarks[0].state = 'deleted',
  ]) {
    const scene = create(doc('A target Z')).doc; mutate(scene);
    for (const serialized of [JSON.stringify(scene), declarationV3 + '\n' + JSON.stringify(scene)]) {
      const parsed = envelope.parseObservablePayload(framed(serialized));
      assert.equal(parsed.doc, null); assert.equal(parsed.issue.code, 'E_DOC_PAYLOAD_INVALID');
      assert.match(parsed.issue.details.message, /^USER_BOOKMARK_/);
    }
  }
});

test('private rename lineage repairs ordinary text Undo spelling for the same ID only', () => {
  const first = create(doc('target', 'label'), 'OldName', ep(0), ep(6));
  const second = model.planMutation({ doc: first.doc, action: 'rename', bookmarkId: first.bookmarkId, name: 'MiddleName' });
  const current = model.planMutation({ doc: second.doc, action: 'rename', bookmarkId: first.bookmarkId, name: 'CurrentName' });
  const working = copy(current.doc);
  working.content[1].content = [
    { type: 'text', text: 'label', marks: [{ type: 'bold' }, { type: 'link', attrs: {
      ...model.linkAttrs(first.registry.bookmarks[0]), target: '_blank', rel: 'noopener noreferrer', class: null, title: null,
    } }] },
    { type: 'text', text: ' old alias', marks: [{ type: 'link', attrs: model.linkAttrs(second.registry.bookmarks[0]) }] },
    { type: 'text', text: ' external', marks: [{ type: 'link', attrs: { href: 'https://example.invalid/path', target: '_blank', rel: 'noopener', title: 'external title' } }] },
  ];
  typed(() => model.planSave({ beforeDoc: current.doc, workingDoc: working }), 'USER_BOOKMARK_LINK_TARGET_INVALID');
  const lineage = [{ bookmarkId: first.bookmarkId, oldName: 'OldName' }, { bookmarkId: first.bookmarkId, oldName: 'MiddleName' }];
  const plan = model.planSave({ beforeDoc: current.doc, workingDoc: working, renameLineage: lineage });
  assert.deepEqual(plan.restoredLinkBookmarkIds, [first.bookmarkId]);
  assert.equal(plan.changed, false); assert.deepEqual(plan.registry, current.registry);
  for (const index of [0, 1]) {
    const attrs = plan.doc.content[1].content[index].marks.find(mark => mark.type === 'link').attrs;
    assert.equal(attrs.href, '#CurrentName'); assert.equal(attrs.wordBookmarkName, 'CurrentName');
    assert.equal(attrs.wordBookmarkId, first.bookmarkId);
  }
  assert.equal(plan.doc.content[1].content[0].marks[1].attrs.title, null);
  assert.equal(plan.doc.content[1].content[0].marks[1].attrs.rel, 'noopener noreferrer');
  assert.deepEqual(plan.doc.content[1].content[2], working.content[1].content[2]);
  assert.equal(working.content[1].content[0].marks[1].attrs.href, '#OldName');
  assert.deepEqual(model.planSave({ beforeDoc: plan.doc, workingDoc: copy(plan.doc), renameLineage: lineage }).restoredLinkBookmarkIds, []);
});

test('a reused old spelling never replaces lineage target identity', () => {
  const old = create(doc('target', 'label'), 'OldName', ep(0), ep(6));
  const renamed = model.planMutation({ doc: old.doc, action: 'rename', bookmarkId: old.bookmarkId, name: 'Current' });
  const reused = create(renamed.doc, 'OldName', ep(0, 1), ep(5, 1), 'reused');
  const working = copy(reused.doc);
  working.content[1].content[0].marks.push({ type: 'link', attrs: model.linkAttrs(old.registry.bookmarks[0]) });
  const plan = model.planSave({ beforeDoc: reused.doc, workingDoc: working,
    renameLineage: [{ bookmarkId: old.bookmarkId, oldName: 'OldName' }] });
  const attrs = plan.doc.content[1].content[0].marks[1].attrs;
  assert.equal(attrs.href, '#Current'); assert.equal(attrs.wordBookmarkId, old.bookmarkId);
  assert.notEqual(attrs.wordBookmarkId, reused.bookmarkId);
  assert.equal(model.inspectInternalLink({ type: 'link', attrs }, plan.registry).name, 'Current');
});

test('lineage does not repair wrong pairs, foreign IDs, unsupported attrs or forged registry', () => {
  const original = create(doc('target', 'label'), 'Old', ep(0), ep(6));
  const before = model.planMutation({ doc: original.doc, action: 'rename', bookmarkId: original.bookmarkId, name: 'Current' }).doc;
  const source = copy(before); source.content[1].content[0].marks.push({ type: 'link', attrs: { ...model.linkAttrs(original.registry.bookmarks[0]), title: null } });
  const alias = [{ bookmarkId: original.bookmarkId, oldName: 'Old' }];
  for (const mutate of [
    x => x.content[1].content[0].marks[1].attrs.href = '#WrongPair',
    x => x.content[1].content[0].marks[1].attrs.wordBookmarkId = 'ubm-' + 'f'.repeat(32),
    x => x.content[1].content[0].marks[1].attrs.title = 'unsupported',
    x => x.content[1].content[0].marks[1].attrs.hidden = true,
    x => x.attrs[model.KEY].bookmarks[0].name = 'Forged',
  ]) { const forged = copy(source); mutate(forged); typed(() => model.planSave({ beforeDoc: before, workingDoc: forged, renameLineage: alias })); }
  for (const renameLineage of [null, [{ bookmarkId: 'ubm-' + 'f'.repeat(32), oldName: 'Old' }],
    [{ ...alias[0], hidden: true }], [alias[0], alias[0]], [{ bookmarkId: original.bookmarkId, oldName: '_GoBack' }]]) {
    typed(() => model.planSave({ beforeDoc: before, workingDoc: source, renameLineage }));
  }
  typed(() => model.planSave({ beforeDoc: before, workingDoc: source, renameLineage: [{ bookmarkId: original.bookmarkId, oldName: 'old' }] }), 'USER_BOOKMARK_LINK_TARGET_INVALID');
});

test('lineage repair matches PM fragmented Undo bytes by merging only complete equal rich text nodes', () => {
  const original = create(doc('target', 'abc'), 'Old', ep(0), ep(6));
  const current = model.planMutation({ doc: original.doc, action: 'rename', bookmarkId: original.bookmarkId, name: 'Renamed' });
  const marks = record => [{ type: 'bold' }, { type: 'textStyle', attrs: { color: '#123456' } },
    { type: 'link', attrs: { ...model.linkAttrs(record), target: '_blank', rel: 'noopener noreferrer', class: null, title: null } }];
  const working = copy(current.doc);
  const currentMarks = marks(current.registry.bookmarks[0]), oldMarks = marks(original.registry.bookmarks[0]);
  working.content[1].content = [
    { type: 'text', text: 'a', marks: copy(currentMarks) },
    { type: 'text', text: 'b', marks: copy(oldMarks) },
    { type: 'text', text: 'c', marks: copy(currentMarks) },
    { type: 'text', text: 'different style', marks: [{ type: 'italic' }] },
    { type: 'text', text: 'different attrs', attrs: { retained: true }, marks: [{ type: 'italic' }] },
    { type: 'hardBreak' },
    { type: 'text', text: 'external', marks: [{ type: 'link', attrs: { href: 'https://example.invalid/', title: 'external title' } }] },
  ];
  const plan = model.planSave({ beforeDoc: current.doc, workingDoc: working,
    renameLineage: [{ bookmarkId: original.bookmarkId, oldName: 'Old' }] });
  assert.deepEqual(plan.doc.content[1].content, [
    { type: 'text', text: 'abc', marks: currentMarks }, ...working.content[1].content.slice(3),
  ]);
  assert.deepEqual(plan.doc.content[0], working.content[0]);
  assert.deepEqual(plan.restoredLinkBookmarkIds, [original.bookmarkId]);
  const unchanged = copy(current.doc); unchanged.content[1].content = [
    { type: 'text', text: 'a', marks: copy(currentMarks) }, { type: 'text', text: 'bc', marks: copy(currentMarks) },
  ];
  const noRepair = model.planSave({ beforeDoc: current.doc, workingDoc: unchanged });
  assert.deepEqual(noRepair.doc.content[1].content, unchanged.content[1].content);
});

// Literal native XML replay through the real local-file sanitizer and planner.
// This portable contract does not replace SOURCE/PACKAGED native qualification.
test('body-level bookmark starts own the adjacent paragraph with half-open XML boundaries', async () => {
  const { extractUserBookmarkInventoryV1 } = await import('../../src/io/revisionBridge/reviewTransportPackageParserV2.mjs');
  const hash = s => require('node:crypto').createHash('sha256').update(s).digest('hex');
  const cryptoPort = { sha256Text: hash, sha256Json: v => 'sha256:' + hash(JSON.stringify(v)), byteLength: Buffer.byteLength };
  const wrap = body => `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:x="urn:foreign"><w:body>${body}</w:body></w:document>`;
  const start = '<w:bookmarkStart w:id="4" w:name="FinalRangeCopy"/>';
  const paragraph = '<w:p><w:r><w:t>Alpha LABEL updated</w:t></w:r><w:bookmarkEnd w:id="4"/></w:p>';
  const tail = '<w:p><w:r><w:t>Tail</w:t></w:r></w:p>';
  for (const gap of ['', '\n', ' ']) {
    const inventory = extractUserBookmarkInventoryV1(wrap(start + gap + paragraph + tail), { cryptoPort });
    assert.deepEqual(inventory.bookmarks.map(({ name, start, end }) => ({ name, start, end })),
      [{ name: 'FinalRangeCopy', start: ep(0), end: ep(19) }]);
  }
  const stacked = '<w:bookmarkStart w:id="2" w:name="Original"/><w:bookmarkStart w:id="3" w:name="YRTK_test"/>' + start
    + paragraph.replace('<w:bookmarkEnd w:id="4"/>', '<w:bookmarkEnd w:id="2"/><w:bookmarkEnd w:id="3"/><w:bookmarkEnd w:id="4"/>');
  const inventory = extractUserBookmarkInventoryV1(wrap(stacked + tail), { cryptoPort });
  assert.deepEqual(inventory.bookmarks.map(({ start, end }) => ({ start, end })), [
    { start: ep(0), end: ep(19) }, { start: ep(0), end: ep(19) },
  ]);
  for (const barrier of ['<w:altChunk/>', '<x:foreign/>', '<w:sectPr/>']) {
    for (const gap of ['', '\n']) assert.throws(() => extractUserBookmarkInventoryV1(
      wrap(start + gap + barrier + gap + paragraph + tail), { cryptoPort }), /DOCX_USER_BOOKMARK_ENDPOINT_OWNER/);
  }
  assert.throws(() => extractUserBookmarkInventoryV1(wrap(start + '<x:bookmarkStart/>' + paragraph), { cryptoPort }),
    /DOCX_USER_BOOKMARK_ENDPOINT_NAMESPACE/);
});
async function bookmarkLocalFilePipeline(bytes, bridge) {
  const local = require('../../src/utils/docxImportLocalFilePreview.js');
  return local.createDocxImportLocalFilePreview({requestId:'bookmark-local-file'}, {
    pickLocalFile:async()=>({name:'native-bookmarks.docx',size:bytes.length}),
    readLocalFileBytes:async()=>bytes, loadRevisionBridgeModule:async()=>bridge,
  });
}
function nativeBookmarkPackage() {
  const fixture = require('../fixtures/word-user-bookmarks-native-v1.json');
  const snapshot = fixture.snapshots.find(item => item.name.startsWith('17-'));
  assert.ok(snapshot); return {parts:{...fixture.sharedParts,...snapshot.parts},expected:snapshot.expected};
}
test('actual local-file sanitizer and plan preserve native17 literal endpoints and typed link identities', async () => {
  const bridge = await import('../../src/io/revisionBridge/index.mjs');
  const {buildStoredZip} = require('../../src/export/docx/docxMinBuilder.js');
  const {parts,expected} = nativeBookmarkPackage();
  const result = await bookmarkLocalFilePipeline(buildStoredZip(Object.entries(parts).map(([name,data])=>({name,data}))),bridge);
  assert.equal(result.ok,true,JSON.stringify(result)); assert.equal(result.docxImportPreviewPlan.ok,true,JSON.stringify(result));
  const imported = envelope.parseObservablePayload(result.docxImportPreviewPlan.candidateCreatePlan.entries[0].content);
  assert.equal(imported.payloadVersion,3); assert.equal(imported.issue,null);
  const registry = model.readRegistry(imported.doc);
  assert.deepEqual(model.paragraphs(imported.doc).map(model.textOf),expected.paragraphTexts);
  assert.deepEqual(registry.bookmarks.filter(item=>item.state==='active').map(({name,start,end})=>({name,start,end})),expected.bookmarks);
  let links=0;for(const p of model.paragraphs(imported.doc))for(const node of p.content||[])for(const mark of node.marks||[]) {
    if(mark.type==='link'&&mark.attrs.href.startsWith('#')){assert.ok(model.inspectInternalLink(mark,registry));links++;}
  }assert.equal(links,expected.links.length);
});
test('local-file plan preserves links after removal of every target as distinct tombstones', async () => {
  const bridge = await import('../../src/io/revisionBridge/index.mjs');
  const {buildStoredZip} = require('../../src/export/docx/docxMinBuilder.js');
  const {parts,expected} = nativeBookmarkPackage();
  parts['word/document.xml']=parts['word/document.xml'].replace(/<w:bookmarkStart\b[^>]*\/>/gu,'').replace(/<w:bookmarkEnd\b[^>]*\/>/gu,'');
  const result = await bookmarkLocalFilePipeline(buildStoredZip(Object.entries(parts).map(([name,data])=>({name,data}))),bridge);
  assert.equal(result.ok,true,JSON.stringify(result)); assert.equal(result.docxImportPreviewPlan.ok,true,JSON.stringify(result));
  const imported=envelope.parseObservablePayload(result.docxImportPreviewPlan.candidateCreatePlan.entries[0].content),registry=model.readRegistry(imported.doc);
  assert.equal(imported.payloadVersion,3);assert.deepEqual(model.paragraphs(imported.doc).map(model.textOf),expected.paragraphTexts);
  assert.deepEqual(registry.bookmarks.map(item=>[item.name,item.state]),[['UserTwinB','deleted'],['UserTwinSecond','deleted']]);
  const ids=new Set();for(const p of model.paragraphs(imported.doc))for(const node of p.content||[])for(const mark of node.marks||[])if(mark.type==='link') {
    const target=model.inspectInternalLink(mark,registry);assert.equal(target.state,'deleted');ids.add(target.id);
  }assert.equal(ids.size,2);
});
test('local-file inventory validation rejects raw accessors and hostile geometry before cloning or plan execution', async () => {
  const bridge=await import('../../src/io/revisionBridge/index.mjs');
  const {buildStoredZip}=require('../../src/export/docx/docxMinBuilder.js');
  const {parts}=nativeBookmarkPackage();const bytes=buildStoredZip(Object.entries(parts).map(([name,data])=>({name,data})));
  const original=bridge.buildDocxContentPreviewFromZipBytes(bytes);let reads=0;
  for(const mutate of [
    preview=>Object.defineProperty(preview,'userBookmarkInventory',{enumerable:true,get(){reads++;throw Error('GETTER_RAN');}}),
    preview=>Object.defineProperty(preview.userBookmarkInventory.bookmarks[0],'name',{enumerable:true,get(){reads++;throw Error('GETTER_RAN');}}),
    preview=>{preview.userBookmarkInventory.bookmarks[0].start.offsetUtf16=999999;preview.userBookmarkInventory.bookmarks[0].end.offsetUtf16=999999;},
    preview=>{preview.userBookmarkInventory.bookmarks.push(copy(preview.userBookmarkInventory.bookmarks[0]));},
    preview=>{preview.userBookmarkInventory.links[0].to=999999;},
    preview=>{preview.userBookmarkInventory.bookmarks[0].sourceXmlProvenance={covert:()=>{}};},
  ]) {
    const report=copy(original);mutate(report.contentPreview);let planned=0;
    const result=await bookmarkLocalFilePipeline(bytes,{buildDocxContentPreviewFromZipBytes:()=>report,
      buildDocxImportPreviewPlanFromContentPreview:()=>{planned++;throw Error('PLAN_MUST_NOT_RUN');}});
    assert.equal(result.ok,false);assert.equal(result.error.reason,'DOCX_IMPORT_LOCAL_FILE_PREVIEW_CONTENT_REPORT_INVALID');assert.equal(planned,0);
  }assert.equal(reads,0);
});

function asNativeLocalField(name, result) {
  return `<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText>HYPERLINK \\l &quot;${name}&quot;</w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r>${result}<w:r><w:fldChar w:fldCharType="end"/></w:r>`;
}
test('native local HYPERLINK field grammar preserves Unicode spelling without extending external grammar', () => {
  const {parseDocxHyperlinkInstruction:parse}=require('../../src/io/docxHyperlinks.cjs');
  assert.equal(parse(' HYPERLINK \\l "Цель_Кириллица_Ω" '),'#Цель_Кириллица_Ω');
  for(const instruction of ['HYPERLINK \\l "YRTK_bad"','HYPERLINK \\l "Target" \\o "tooltip"','HYPERLINK \\l "Target" \\l "Other"','HYPERLINK \\l "Target" junk','HYPERLINK \\l "a b"','HYPERLINK \\l "Target" \\h \\h'])assert.throws(()=>parse(instruction));
});
test('native complex local fields preserve result styling, literal spans and fresh bound identities through real G', async () => {
  const bridge=await import('../../src/io/revisionBridge/index.mjs');
  const {buildStoredZip,buildDocxMinBuffer}=require('../../src/export/docx/docxMinBuilder.js');
  const {parts,expected}=nativeBookmarkPackage();
  parts['word/document.xml']=parts['word/document.xml'].replace(/<w:hyperlink\b[^>]*w:anchor="([^"]+)"[^>]*>([\s\S]*?)<\/w:hyperlink>/gu,(_,name,result)=>asNativeLocalField(name,result));
  assert.ok(parts['word/document.xml'].includes('HYPERLINK'));
  const result=await bookmarkLocalFilePipeline(buildStoredZip(Object.entries(parts).map(([name,data])=>({name,data}))),bridge);
  assert.equal(result.ok,true,JSON.stringify(result));assert.equal(result.docxImportPreviewPlan.ok,true,JSON.stringify(result));
  const parsed=envelope.parseObservablePayload(result.docxImportPreviewPlan.candidateCreatePlan.entries[0].content),registry=model.readRegistry(parsed.doc);
  assert.equal(parsed.issue,null);assert.equal(parsed.payloadVersion,3);assert.deepEqual(model.paragraphs(parsed.doc).map(model.textOf),expected.paragraphTexts);
  assert.deepEqual(registry.bookmarks.filter(b=>b.state==='active').map(({name,start,end})=>({name,start,end})),expected.bookmarks);
  let count=0;for(const p of model.paragraphs(parsed.doc))for(const n of p.content||[])for(const m of n.marks||[])if(m.type==='link'){assert.ok(model.inspectInternalLink(m,registry));count++;}assert.equal(count,2);
  const [docxPageSetupBindModule,semanticMappingModule,styleMapModule]=await Promise.all([import('../../src/docxPageSetupBind.mjs'),import('../../src/derived/semanticMapping.mjs'),import('../../src/derived/styleMap.mjs')]);
  const exported=buildDocxMinBuffer({doc:parsed.doc,bookProfile:{formatId:'A4'}},{docxPageSetupBindModule,semanticMappingModule,styleMapModule});
  const xml=bridge.extractDocxReviewTransportPackagePartsFromZipBytes({bytes:exported}).parts['word/document.xml'];
  assert.ok(xml.includes('<w:hyperlink'));assert.ok(xml.includes('w:anchor='));
});

test('split local field instructions preserve styled labels and broken targets; hostile controls never grant a plan', async () => {
  const bridge=await import('../../src/io/revisionBridge/index.mjs'),{buildStoredZip}=require('../../src/export/docx/docxMinBuilder.js');
  const {parts}=nativeBookmarkPackage();
  const base=parts['word/document.xml'];
  const local=asNativeLocalField('MissingTarget','<w:r><w:rPr><w:b/></w:rPr><w:t>Link </w:t></w:r><w:r><w:rPr><w:i/></w:rPr><w:t>One</w:t></w:r>');
  const first=/<w:hyperlink\b[^>]*w:anchor="UserTwinB"[^>]*>[\s\S]*?<\/w:hyperlink>/u;assert.ok(first.test(base));
  const run=async xml=>bookmarkLocalFilePipeline(buildStoredZip(Object.entries({...parts,'word/document.xml':xml}).map(([name,data])=>({name,data}))),bridge);
  const split=local.replace('HYPERLINK \\l','HYPER</w:instrText></w:r><w:r><w:instrText>LINK \\l');
  const accepted=await run(base.replace(first,split));assert.equal(accepted.docxImportPreviewPlan?.ok,true,JSON.stringify(accepted));
  const parsed=envelope.parseObservablePayload(accepted.docxImportPreviewPlan.candidateCreatePlan.entries[0].content),registry=model.readRegistry(parsed.doc);
  const label=model.paragraphs(parsed.doc)[3].content;assert.equal(model.textOf(model.paragraphs(parsed.doc)[3]),'Link One');
  assert.ok(label[0].marks.some(m=>m.type==='bold'));assert.ok(label[1].marks.some(m=>m.type==='italic'));
  const target=registry.bookmarks.find(b=>b.name==='MissingTarget');assert.equal(target.state,'deleted');
  for(const [caseIndex,xml] of [
    local.replace('\\l &quot;MissingTarget&quot;','\\l &quot;MissingTarget&quot; \\l &quot;Other&quot;'),
    local.replace('\\l &quot;MissingTarget&quot;','\\l &quot;MissingTarget&quot; \\o &quot;tooltip&quot;'),
    local.replace('<w:r><w:fldChar w:fldCharType="separate"/></w:r>',''),
    local.replace('<w:r><w:fldChar w:fldCharType="end"/></w:r>',''),
    local.replace('<w:r><w:fldChar w:fldCharType="separate"/></w:r>',asNativeLocalField('Other','<w:r><w:t>x</w:t></w:r>')),
    local.replace('<w:r><w:fldChar w:fldCharType="separate"/></w:r>','<w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:instrText> HYPERLINK \\l &quot;Other&quot; </w:instrText></w:r>'),
    '<w:r><w:instrText>HYPERLINK \\l &quot;MissingTarget&quot;</w:instrText></w:r><w:r><w:t>Link One</w:t></w:r>',
    '<w:fldSimple w:instr="HYPERLINK \\l &quot;MissingTarget&quot;"><w:r><w:t>Link One</w:t></w:r></w:fldSimple>',
  ].entries()) {const rejected=await run(base.replace(first,xml));assert.notEqual(rejected.docxImportPreviewPlan?.ok,true,`hostile local field ${caseIndex}`); }
});

test('clean local-field return requires exact one-to-one instruction provenance and authenticated scene locators', async () => {
  const io=await import('../../src/io/revisionBridge/index.mjs'),analyzer=await import('../../src/io/revisionBridge/reviewTransportUserBookmarksV1.mjs');
  const {buildStoredZip}=require('../../src/export/docx/docxMinBuilder.js'),{buildDocxReviewPacketBuffer,REVIEW_DOCX_TYPOGRAPHY_DEFAULTS}=require('../../src/export/docx/docxReviewPacketBuilder.js');
  const {buildFullManuscriptDocxReviewPacketSource}=require('../../src/export/docx/fullManuscriptDocxReviewPacketSource.js');
  const fixture=require('../fixtures/word-user-bookmarks-native-v1.json'),sample=fixture.snapshots.find(s=>s.name.startsWith('04-'));
  const bytesOf=parts=>buildStoredZip(Object.entries(parts).map(([name,data])=>({name,data})));
  const g=io.buildDocxImportPreviewPlanFromContentPreview(io.buildDocxContentPreviewFromZipBytes(bytesOf({...fixture.sharedParts,...sample.parts})));
  assert.equal(g.ok,true);const baselineDoc=envelope.parseObservablePayload(g.candidateCreatePlan.entries[0].content).doc;
  const source=buildFullManuscriptDocxReviewPacketSource({projectId:'local-field-synthetic',projectRoot:'/synthetic',manifestPath:'/synthetic/manifest.json',scenes:[{sceneId:'a.txt',scenePath:'/synthetic/a.txt',order:0,title:'A',doc:baselineDoc,text:envelope.deriveVisibleTextFromDocument(baselineDoc),observableContent:envelope.composeObservablePayload({doc:baselineDoc})}]},{createdAtUtc:'2026-09-30T09:00:00.000Z',roundIdHex:'a'.repeat(32),keyIdHex:'b'.repeat(32),hmacSecret:'synthetic-test-key-only'});
  const original=buildDocxReviewPacketBuffer(source),exportMap=io.bindUserBookmarkExportTransportPartsV1(source.localAuthorityCapsule.exportMap,original);
  const parts=io.extractDocxReviewTransportPackagePartsFromZipBytes({bytes:original}).parts;
  const xml=parts['word/document.xml'].replace(/<w:hyperlink\b[^>]*w:anchor="([^"]+)"[^>]*>([\s\S]*?)<\/w:hyperlink>/gu,(_,name,result)=>asNativeLocalField(name,result));assert.notEqual(xml,parts['word/document.xml']);
  const hash=s=>require('node:crypto').createHash('sha256').update(s).digest('hex'),cryptoPort={sha256Text:hash,sha256Json:v=>'sha256:'+hash(JSON.stringify(v)),byteLength:Buffer.byteLength};
  const analysis=io.buildDocxReviewTransportAnalysisFromZipBytes({bytes:bytesOf({...parts,'word/document.xml':xml})},{cryptoPort});assert.equal(analysis.ok,true);
  const check=reviewIr=>analyzer.analyzeUserBookmarksReturn({baselineDoc,sceneId:'a.txt',exportMap,reviewIr,exportTypography:REVIEW_DOCX_TYPOGRAPHY_DEFAULTS});
  const unchanged=check(analysis.reviewIr);assert.equal(unchanged.ok,true,JSON.stringify(unchanged));assert.equal(unchanged.changed,false);
  for(const mutate of [
    ir=>ir.formattingParagraphs.find(p=>p.inertHyperlinkInstructions?.length).inertHyperlinkInstructions[0].openStart++,
    ir=>ir.formattingParagraphs.find(p=>p.inertHyperlinkInstructions?.length).inertHyperlinkInstructions.push(copy(ir.formattingParagraphs.find(p=>p.inertHyperlinkInstructions?.length).inertHyperlinkInstructions[0])),
    ir=>ir.userBookmarkInventory.links.find(l=>l.sourceXmlProvenance.instructions).sourceXmlProvenance.instructions=[],
    ir=>{ir.opaqueUnsupported=ir.opaqueUnsupported.filter(x=>x.elementName!=='instrText');},
    ir=>ir.opaqueUnsupported.find(x=>x.elementName==='instrText').sourceXmlProvenance.namespaceUri='urn:spoof',
  ]){const forged=copy(analysis.reviewIr);mutate(forged);assert.equal(check(forged).ok,false);}
  const orphan=xml.replace(/<w:bookmarkStart w:id="\d+" w:name="YRTK_[^"]+"\/>/u,'');assert.notEqual(orphan,xml);
  const rejected=io.buildDocxReviewTransportAnalysisFromZipBytes({bytes:bytesOf({...parts,'word/document.xml':orphan})},{cryptoPort});assert.equal(rejected.ok,false);assert.equal(rejected.code,'RTK_WORD_USER_BOOKMARK_INVALID');
});

test('authenticated native label, retarget and case-only rename retain exact trusted internal link attrs', async () => {
  const io=await import('../../src/io/revisionBridge/index.mjs'),analyzer=await import('../../src/io/revisionBridge/reviewTransportUserBookmarksV1.mjs');
  const {buildStoredZip}=require('../../src/export/docx/docxMinBuilder.js'),{buildDocxReviewPacketBuffer,REVIEW_DOCX_TYPOGRAPHY_DEFAULTS}=require('../../src/export/docx/docxReviewPacketBuilder.js');
  const {buildFullManuscriptDocxReviewPacketSource}=require('../../src/export/docx/fullManuscriptDocxReviewPacketSource.js');
  const fixture=require('../fixtures/word-user-bookmarks-native-v1.json'),sample=fixture.snapshots.find(s=>s.name.startsWith('04-'));
  const bytesOf=parts=>buildStoredZip(Object.entries(parts).map(([name,data])=>({name,data})));
  const imported=io.buildDocxImportPreviewPlanFromContentPreview(io.buildDocxContentPreviewFromZipBytes(bytesOf({...fixture.sharedParts,...sample.parts})));
  assert.equal(imported.ok,true);const baselineDoc=envelope.parseObservablePayload(imported.candidateCreatePlan.entries[0].content).doc;
  const attrs=[{target:'_self',rel:'author rel',class:'first-link',title:null},{target:null,rel:'',class:null,title:null}];
  let count=0;for(const p of model.paragraphs(baselineDoc))for(const n of p.content||[])for(const m of n.marks||[])if(m.type==='link')Object.assign(m.attrs,attrs[count++]);assert.equal(count,2);
  const source=buildFullManuscriptDocxReviewPacketSource({projectId:'attrs-synthetic',projectRoot:'/synthetic',manifestPath:'/synthetic/manifest.json',scenes:[{sceneId:'a.txt',scenePath:'/synthetic/a.txt',order:0,title:'A',doc:baselineDoc,text:envelope.deriveVisibleTextFromDocument(baselineDoc),observableContent:envelope.composeObservablePayload({doc:baselineDoc})}]},{createdAtUtc:'2026-09-30T09:00:00.000Z',roundIdHex:'a'.repeat(32),keyIdHex:'b'.repeat(32),hmacSecret:'synthetic-test-key-only'});
  const original=buildDocxReviewPacketBuffer(source),exportMap=io.bindUserBookmarkExportTransportPartsV1(source.localAuthorityCapsule.exportMap,original),parts=io.extractDocxReviewTransportPackagePartsFromZipBytes({bytes:original}).parts;
  const hash=s=>require('node:crypto').createHash('sha256').update(s).digest('hex'),cryptoPort={sha256Text:hash,sha256Json:v=>'sha256:'+hash(JSON.stringify(v)),byteLength:Buffer.byteLength};
  for(const action of ['unchanged','label','retarget','case-rename']) {
    let xml=parts['word/document.xml'];
    if(action==='label')xml=xml.replace('Link One','Edited One');
    if(action==='retarget')xml=xml.replace('w:anchor="UserTwinA"','w:anchor="UserTwinB"');
    if(action==='case-rename')xml=xml.replace('w:name="UserTwinA"','w:name="usertwina"').replace('w:anchor="UserTwinA"','w:anchor="usertwina"');
    if(action!=='unchanged')assert.notEqual(xml,parts['word/document.xml']);
    xml=xml.replace(/<w:hyperlink\b[^>]*w:anchor="([^"]+)"[^>]*>([\s\S]*?)<\/w:hyperlink>/gu,(_,name,result)=>asNativeLocalField(name,result));
    const analysis=io.buildDocxReviewTransportAnalysisFromZipBytes({bytes:bytesOf({...parts,'word/document.xml':xml})},{cryptoPort});assert.equal(analysis.ok,true);
    const result=analyzer.analyzeUserBookmarksReturn({baselineDoc,sceneId:'a.txt',exportMap,reviewIr:analysis.reviewIr,exportTypography:REVIEW_DOCX_TYPOGRAPHY_DEFAULTS});assert.equal(result.ok,true,JSON.stringify(result));
    let index=0;for(const p of model.paragraphs(result.doc))for(const n of p.content||[])for(const m of n.marks||[])if(m.type==='link') {
      assert.deepEqual(Object.fromEntries(['target','rel','class','title'].map(k=>[k,m.attrs[k]])),attrs[index++],action);
      assert.ok(model.inspectInternalLink(m,result.registry));
    }assert.equal(index,2);assert.equal(result.changed,action!=='unchanged');
    assert.equal(model.planReturn({beforeDoc:baselineDoc,candidateDoc:result.doc}).changed,action!=='unchanged');
  }
});

test('Core typed defaults match the actual pinned editor schema without changing explicit attrs or identity', async () => {
  const {getSchema}=await import('@tiptap/core'),{default:StarterKit}=await import('@tiptap/starter-kit');
  const {UserBookmarks,UserBookmarkLink}=await import('../../src/renderer/tiptap/userBookmarks.mjs');
  const {WordPendingRevisions}=await import('../../src/renderer/tiptap/wordPendingRevisions.mjs'),{DocumentParagraphAlignment}=await import('../../src/renderer/tiptap/documentParagraphAlignment.mjs');
  const schema=getSchema([StarterKit.configure({link:false,undoRedo:false}),DocumentParagraphAlignment,WordPendingRevisions,UserBookmarks,UserBookmarkLink]);
  const first=create(doc('target','label'),'Target',ep(0),ep(6));
  first.doc.attrs.wordPendingRevisions=null;first.doc.content[1].content[0].marks.push({type:'link',attrs:model.linkAttrs(first.registry.bookmarks[0])});
  const input=JSON.parse(JSON.stringify(schema.nodeFromJSON(first.doc).toJSON()));
  const internal=input.content[1].content[0].marks.find(m=>m.type==='link');for(const k of ['target','rel','class','title'])delete internal.attrs[k];
  const rawInput=copy(input),materialized=model.materializeInternalLinkSchemaDefaults(input),reopened=JSON.parse(JSON.stringify(schema.nodeFromJSON(input).toJSON()));
  assert.deepEqual(materialized,reopened);assert.deepEqual(input,rawInput);assert.deepEqual(materialized.attrs.wordUserBookmarks,first.registry);
  for(const attrs of [{target:null,rel:null,class:null,title:null},{target:'_self',rel:'author rel',class:'author-class',title:null}]) {
    const custom=copy(first.doc);Object.assign(custom.content[1].content[0].marks[1].attrs,attrs);
    custom.content[1].content.push({type:'text',text:' outside',marks:[{type:'link',attrs:{href:'https://example.invalid/',target:'_parent',rel:'external rel',class:'external-class',title:'external title',custom:'retained'}}]});
    const result=model.materializeInternalLinkSchemaDefaults(custom);
    assert.deepEqual(result,custom);assert.deepEqual(result.content[1].content[1],custom.content[1].content[1]);
    assert.notDeepEqual(result.content[1].content[0].marks[1].attrs,materialized.content[1].content[0].marks.find(m=>m.type==='link').attrs);
  }
  assert.deepEqual(model.materializeInternalLinkSchemaDefaults(materialized),materialized);
});
test('typed schema defaults validate raw bounds, identities and attrs before copying', () => {
  const first=create(doc('target','label'),'Target',ep(0),ep(6));
  first.doc.content[1].content[0].marks.push({type:'link',attrs:model.linkAttrs(first.registry.bookmarks[0])});let getterReads=0;
  for(const mutate of [
    d=>d.attrs.wordUserBookmarks.bookmarks[0].end.offsetUtf16=999,
    d=>d.content[1].content[0].marks[1].attrs.wordBookmarkId='ubm-'+'f'.repeat(32),
    d=>d.content[1].content[0].marks[1].attrs.wordBookmarkName='Other',
    d=>d.content[1].content[0].marks[1].attrs.unknown='covert',
    d=>d.content[1].content[0].marks[1].attrs.title='unsupported title',
    d=>d.content[1].content[0].marks[1].attrs.target=undefined,
    d=>Object.defineProperty(d.content[1].content[0].marks[1].attrs,'rel',{enumerable:true,get(){getterReads++;throw Error('GETTER_RAN');}}),
  ]) {const forged=copy(first.doc);mutate(forged);typed(()=>model.materializeInternalLinkSchemaDefaults(forged));}
  assert.equal(getterReads,0);assert.deepEqual(model.materializeInternalLinkSchemaDefaults(doc('legacy')),doc('legacy'));
});


function labelBoundaryFixture() {
  let value=create(doc('Before label after'),'Label',ep(7),ep(12),'label-owner');
  for(const [name,start,end] of [['Outer',0,18],['Start',7,7],['End',12,12],['After',13,18]])
    value=create(value.doc,name,ep(start),ep(end),name);
  const target=value.registry.bookmarks.find(b=>b.name==='Label');
  value.doc.content[0].content=[
    {type:'text',text:'Before ',marks:[{type:'italic'}]},
    {type:'text',text:'label',marks:[{type:'bold'},{type:'link',attrs:model.linkAttrs(target)}]},
    {type:'text',text:' after',marks:[{type:'italic'}]},
  ];
  return value.doc;
}
function replacedLabelCandidate(before,text) {
  const candidate=copy(before),delta=text.length-5;
  candidate.content[0].content[1].text=text;candidate.attrs[model.KEY].revision++;
  for(const b of candidate.attrs[model.KEY].bookmarks)for(const edge of ['start','end'])
    if(b[edge].offsetUtf16>=12)b[edge].offsetUtf16+=delta;
  return candidate;
}
test('authenticated label replacement maps enclosing ranges and boundary points without changing IDs',()=>{
  const before=labelBoundaryFixture();
  for(const text of ['x','new 😺 label','other']) {
    const candidate=replacedLabelCandidate(before,text);
    const result=model.planReturn({beforeDoc:before,candidateDoc:candidate});
    assert.equal(result.changed,true);assert.deepEqual(result.doc,candidate);
    assert.deepEqual(result.registry.bookmarks.map(b=>b.id),model.readRegistry(before).bookmarks.map(b=>b.id));
  }
  for(const mutate of [
    d=>d.attrs[model.KEY].bookmarks[0].start.offsetUtf16++,
    d=>d.attrs[model.KEY].bookmarks.find(b=>b.name==='End').end.offsetUtf16++,
    d=>d.content[0].content[0].text='Forged ',
    d=>d.content[0].content[1].marks[0].type='italic',
  ]){const bad=replacedLabelCandidate(before,'new label');mutate(bad);typed(()=>model.planReturn({beforeDoc:before,candidateDoc:bad}));}
  const interior=create(before,'Interior',ep(9),ep(9),'interior').doc;
  typed(()=>model.planReturn({beforeDoc:interior,candidateDoc:replacedLabelCandidate(interior,'other')}),'USER_BOOKMARK_RETURN_ENDPOINT_AMBIGUOUS');
});
test('real DOCX analysis admits only proven label boundary shifts and Core rechecks the resulting candidate',async()=>{
  const io=await import('../../src/io/revisionBridge/index.mjs'),analyzer=await import('../../src/io/revisionBridge/reviewTransportUserBookmarksV1.mjs');
  const {buildStoredZip}=require('../../src/export/docx/docxMinBuilder.js');
  const {buildDocxReviewPacketBuffer,REVIEW_DOCX_TYPOGRAPHY_DEFAULTS}=require('../../src/export/docx/docxReviewPacketBuilder.js');
  const {buildFullManuscriptDocxReviewPacketSource}=require('../../src/export/docx/fullManuscriptDocxReviewPacketSource.js');
  const baselineDoc=labelBoundaryFixture();
  const source=buildFullManuscriptDocxReviewPacketSource({projectId:'label-boundaries',projectRoot:'/synthetic',manifestPath:'/synthetic/manifest.json',scenes:[{sceneId:'a.txt',scenePath:'/synthetic/a.txt',order:0,title:'A',doc:baselineDoc,text:envelope.deriveVisibleTextFromDocument(baselineDoc),observableContent:envelope.composeObservablePayload({doc:baselineDoc})}]},{createdAtUtc:'2026-10-01T09:00:00.000Z',roundIdHex:'a'.repeat(32),keyIdHex:'b'.repeat(32),hmacSecret:'synthetic-test-key-only'});
  const original=buildDocxReviewPacketBuffer(source),exportMap=io.bindUserBookmarkExportTransportPartsV1(source.localAuthorityCapsule.exportMap,original),parts=io.extractDocxReviewTransportPackagePartsFromZipBytes({bytes:original}).parts;
  const hash=s=>require('node:crypto').createHash('sha256').update(s).digest('hex'),cryptoPort={sha256Text:hash,sha256Json:v=>'sha256:'+hash(JSON.stringify(v)),byteLength:Buffer.byteLength};
  const analyze=xml=>{
    const bytes=buildStoredZip(Object.entries({...parts,'word/document.xml':xml}).map(([name,data])=>({name,data})));
    const parsed=io.buildDocxReviewTransportAnalysisFromZipBytes({bytes},{cryptoPort});assert.equal(parsed.ok,true,JSON.stringify(parsed));
    return analyzer.analyzeUserBookmarksReturn({baselineDoc,sceneId:'a.txt',exportMap,reviewIr:parsed.reviewIr,exportTypography:REVIEW_DOCX_TYPOGRAPHY_DEFAULTS});
  };
  for(const text of ['x','new 😺 label','other']) {
    const xml=parts['word/document.xml'].replace('>label<','>'+text+'<');assert.notEqual(xml,parts['word/document.xml']);
    const result=analyze(xml);assert.equal(result.ok,true,JSON.stringify(result));
    const expected=replacedLabelCandidate(baselineDoc,text);
    assert.deepEqual(result.registry,model.readRegistry(expected));
    assert.equal(model.planReturn({beforeDoc:baselineDoc,candidateDoc:result.doc}).changed,true);
    for(const fragment of ['>Before <','>after<']){const forged=xml.replace(fragment,fragment.toUpperCase());assert.notEqual(forged,xml);assert.equal(analyze(forged).ok,false);}
  }
});

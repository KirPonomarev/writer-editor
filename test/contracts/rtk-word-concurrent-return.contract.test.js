'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { mergeText, planConcurrentReturn } = require('../../src/core/word-concurrent-return-v1.cjs');
const paragraph = text => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const document = (...text) => ({ type: 'doc', content: text.map(paragraph) });

for (const [baseline, local, returned, expected] of [
  ['Alpha beta gamma', 'ALPHA beta gamma', 'Alpha beta GAMMA', 'ALPHA beta GAMMA'],
  ['a 🌋 b 🦊 c', 'a 🌋 LOCAL b 🦊 c', 'a 🌋 b 🦊 c WORD', 'a 🌋 LOCAL b 🦊 c WORD'],
  ['one two three', 'one TWO three', 'one TWO three', 'one TWO three'],
  ['abcdefghi', 'AbcdefghI', 'abcdEfghi', 'AbcdEfghI'],
  ['Alpha beta', 'Alpha beta', 'Alpha BETA', 'Alpha BETA'],
  ['Alpha beta', 'LOCAL Alpha beta', 'Alpha beta', 'LOCAL Alpha beta'],
  ['first middle last', 'middle last', 'first middle LAST', 'middle LAST'],
]) test('concurrent text retains both edits: ' + local + ' | ' + returned, () => {
  assert.deepEqual(mergeText(baseline, local, returned), { ok: true, text: expected });
});

for (const [baseline, local, returned] of [
  ['Alpha', 'Alpha LOCAL', 'Alpha WORD'],
  ['ABC', 'AxC', 'AyC'],
  ['ABC', 'AC', 'AxC'],
  ['ABCD', 'AD', 'ABxCD'],
]) test('concurrent text overlap refuses: ' + local + ' | ' + returned, () => {
  const result = mergeText(baseline, local, returned);
  assert.equal(result.ok, false);
  assert.equal(result.detail, 'overlapping-text-edits');
});

test('separate rich blocks preserve local properties and do not mutate inputs', () => {
  const baselineDoc = document('Alpha', 'Beta'), currentDoc = structuredClone(baselineDoc), returnedDoc = structuredClone(baselineDoc);
  currentDoc.content[1].content[0].text = 'Beta LOCAL';
  currentDoc.content[1].attrs = { textAlign: 'right' };
  returnedDoc.content[0].content[0].text = 'Alpha WORD';
  const before = JSON.stringify([baselineDoc, currentDoc, returnedDoc]);
  const result = planConcurrentReturn({ baselineDoc, currentDoc, returnedDoc });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.doc.content[0].content[0].text, 'Alpha WORD');
  assert.deepEqual(result.doc.content[1], currentDoc.content[1]);
  assert.equal(JSON.stringify([baselineDoc, currentDoc, returnedDoc]), before);
});

test('independent edits inside the same paragraph merge with the original marks', () => {
  const baselineDoc = document('Alpha beta gamma'), currentDoc = document('ALPHA beta gamma'), returnedDoc = document('Alpha beta GAMMA');
  for (const doc of [baselineDoc, currentDoc, returnedDoc]) doc.content[0].content[0].marks = [{ type: 'bold' }];
  const result = planConcurrentReturn({ baselineDoc, currentDoc, returnedDoc });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.deepEqual(result.doc.content[0].content, [{ type: 'text', text: 'ALPHA beta GAMMA', marks: [{ type: 'bold' }] }]);
});

test('overlap, changed topology and unsupported inline composite are explicit conflicts', () => {
  const baselineDoc = document('Alpha'), returnedDoc = document('Alpha WORD');
  for (const currentDoc of [document('Alpha LOCAL'), document('Alpha', 'new block'),
    { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'LOCAL', marks: [{ type: 'italic' }] }] }] }]) {
    assert.equal(planConcurrentReturn({ baselineDoc, currentDoc, returnedDoc }).ok, false);
  }
});

test('untrusted accessors are refused without invoking them', () => {
  let invoked = false;
  const bad = { get type() { invoked = true; return 'doc'; } };
  assert.equal(planConcurrentReturn({ baselineDoc: bad, currentDoc: document('a'), returnedDoc: document('b') }).ok, false);
  assert.equal(invoked, false);
});

test('adversarial diff work is bounded and cannot produce a guessed merge', () => {
  assert.equal(mergeText('a'.repeat(2000), 'b'.repeat(2000), 'c'.repeat(2000)).detail, 'diff-budget');
});

test('combining marks and ZWJ emoji cannot be merged as independent pieces of one grapheme', () => {
  assert.equal(mergeText('aXz', 'aX\u0301z', 'aX\u0300z').ok, false);
  assert.deepEqual(mergeText('a 👩‍💻 z', 'A 👩‍💻 z', 'a 👩‍💻 Z'), {ok:true,text:'A 👩‍💻 Z'});
});
test('toJSON callbacks never execute while inspecting merge inputs', () => {
  let invoked=false;
  const bad={type:'doc',toJSON(){invoked=true;return document('bad');}};
  assert.equal(planConcurrentReturn({baselineDoc:bad,currentDoc:document('a'),returnedDoc:document('b')}).ok,false);
  assert.equal(invoked,false);
});

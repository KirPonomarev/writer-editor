'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const spacing = require('../../src/core/word-paragraph-spacing-v1.cjs');
const envelope = require('../../src/core/document-content-envelope-v1.cjs');
const { validateNoteBodyProjection } = require('../../src/core/word-rich-body-projection-v1.cjs');
const paragraph = value => ({ type: 'paragraph', attrs: { wordParagraphSpacing: value }, content: [{ type: 'text', text: 'Preserved' }] });
const doc = value => ({ type: 'doc', content: [paragraph(value)] });
const invalid = callback => assert.throws(callback, /WORD_PARAGRAPH_SPACING_INVALID/);

test('literal units preserve zero, absence, every rule, and immutable normalized copies', () => {
  for (const value of [{ before: 0 }, { after: 1000000 }, { line: 0 }, ...['auto','exact','atLeast'].map(lineRule => ({ before: 0, after: 160, line: 278, lineRule }))]) {
    const normalized = spacing.normalizeWordParagraphSpacing(value);
    assert.deepEqual(normalized, value); assert.notEqual(normalized, value);
    assert.equal(spacing.inspectDocumentParagraphSpacing(doc(value)), true);
  }
  assert.equal(spacing.inspectDocumentParagraphSpacing(doc(null)), false);
  assert.notDeepEqual(spacing.normalizeWordParagraphSpacing({ before: 0 }), spacing.normalizeWordParagraphSpacing({ after: 0 }));
});

test('tuple rejects unsupported values and hidden authority without invoking accessors', () => {
  for (const value of [null, [], {}, { before: -1 }, { after: 1000001 }, { line: 1.5 }, { line: NaN }, { line: Infinity }, { line: '240' }, { lineRule: 'multiple' }, { before: 0, beforeLines: 0 }, Object.create({ before: 1 }), { [Symbol('line')]: 1 }]) invalid(() => spacing.normalizeWordParagraphSpacing(value));
  let calls = 0;
  for (const descriptor of [{ enumerable: true, get() { calls++; return 1; } }, { enumerable: false, value: 1 }]) {
    const value = {}; Object.defineProperty(value, 'before', descriptor);
    invalid(() => spacing.normalizeWordParagraphSpacing(value));
  }
  assert.equal(calls, 0);
});

test('tree validation rejects wrong scope, sparse/accessor children and cycles before interpretation', () => {
  for (const type of ['doc','text','image','bulletList']) invalid(() => spacing.inspectDocumentParagraphSpacing({ type, attrs: { wordParagraphSpacing: { after: 0 } } }));
  invalid(() => spacing.inspectDocumentParagraphSpacing({ type: 'text', marks: [{ type: 'paragraph', attrs: { wordParagraphSpacing: { after: 0 } } }] }));
  invalid(() => spacing.inspectDocumentParagraphSpacing({ type: 'doc', content: new Array(1) }));
  let calls = 0; const children = []; Object.defineProperty(children, '0', { enumerable: true, get() { calls++; return paragraph({ after: 1 }); } });
  invalid(() => spacing.inspectDocumentParagraphSpacing({ type: 'doc', content: children })); assert.equal(calls, 0);
  const cyclic = doc({ after: 0 }); cyclic.content.push(cyclic); invalid(() => spacing.inspectDocumentParagraphSpacing(cyclic));
  let deep = paragraph({ after: 0 }); for (let i=0;i<130;i++) deep = { type: 'blockquote', content: [deep] };
  invalid(() => spacing.inspectDocumentParagraphSpacing(deep));
});

test('cross-realm ordinary command records retain typed values but custom prototypes refuse', () => {
  const foreign = require('node:vm').runInNewContext('({ type: "doc", content: [{ type: "paragraph", attrs: { wordParagraphSpacing: { before: 0, line: 240 } } }] })');
  assert.equal(spacing.inspectDocumentParagraphSpacing(foreign), true);
  assert.deepEqual(spacing.normalizeWordParagraphSpacing(foreign.content[0].attrs.wordParagraphSpacing), { before: 0, line: 240 });
  for (const value of [new (class Spacing { constructor() { this.before = 0; } })(), Object.assign(Object.create({}), { before: 0 })]) invalid(() => spacing.normalizeWordParagraphSpacing(value));
});

test('scene persistence declares semantic feature, preserves exact tuple and refuses undeclared data', () => {
  const original = doc({ before: 0, after: 160, line: 278, lineRule: 'auto' });
  const encoded = envelope.composeObservablePayload({ doc: original });
  assert.match(encoded, /word-paragraph-spacing.v1/);
  assert.deepEqual(envelope.parseObservablePayload(encoded).doc, original);
  const raw = JSON.stringify(original); const legacy = envelope.parseObservablePayload(`[doc-v2 length=${raw.length}]\n${raw}`);
  assert.equal(legacy.doc, null);
  const cleared = envelope.composeObservablePayload({ doc: doc(null) });
  assert.doesNotMatch(cleared, /word-paragraph-spacing.v1|wordParagraphSpacing/);
  assert.equal(envelope.parseObservablePayload(cleared).text, 'Preserved');
});

test('envelope rejects raw spacing accessors before clone or unrelated domain readers', () => {
  let calls = 0;
  const hostile = doc({ after: 1 });
  Object.defineProperty(hostile.content[0].attrs, 'wordParagraphSpacing', { enumerable: true, get() { calls++; return { after: 2 }; } });
  invalid(() => envelope.canonicalizeDocumentJson(hostile)); assert.equal(calls, 0);
  const tuple = doc({ after: 1 }); Object.defineProperty(tuple.content[0].attrs.wordParagraphSpacing, 'after', { enumerable: true, get() { calls++; return 2; } });
  invalid(() => envelope.canonicalizeDocumentJson(tuple)); assert.equal(calls, 0);
});

test('rich stories and notes preserve spacing plus run and paragraph-mark language', () => {
  const original = doc({ before: 0, after: 160, line: 278, lineRule: 'auto' });
  original.content[0].attrs.wordParagraphMarkLanguage = { val: 'ru-FI', eastAsia: 'ru-RU', bidi: 'ar-SA' };
  original.content[0].content[0].marks = [{ type: 'textStyle', attrs: { wordLanguage: { val: 'en-US' } } }];
  const rich = { type: 'doc', content: [{ type: 'bulletList', content: [{ type: 'listItem', content: original.content }] }] };
  assert.deepEqual(validateNoteBodyProjection(rich).body, rich);
  const table = { type: 'doc', content: [{ type: 'table', content: [{ type: 'tableRow', content: [{ type: 'tableCell', content: original.content }] }] }] };
  assert.deepEqual(validateNoteBodyProjection(table).body, table);
  const corrupt = structuredClone(rich); corrupt.content[0].content[0].content[0].attrs.wordParagraphSpacing.line = -1;
  invalid(() => validateNoteBodyProjection(corrupt));
  const language = structuredClone(original); language.content[0].attrs.wordParagraphMarkLanguage.val = 'not a language';
  assert.throws(() => validateNoteBodyProjection(language), /WORD_LANGUAGE_INVALID/);
  const nullable = doc(null); nullable.content[0].attrs.wordParagraphMarkLanguage = null;
  assert.deepEqual(validateNoteBodyProjection(nullable).body.content[0].attrs, {});
});

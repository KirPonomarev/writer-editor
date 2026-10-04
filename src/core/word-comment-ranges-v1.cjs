'use strict';
const { sha256UpdateCompatible: sha } = require('./browser-safe-hash.cjs');
const MULTI = 'multi-paragraph-range';
const fail = code => { throw Object.assign(Error(code), { code }); };
const plain = value => value && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));
function data(value) {
  if (!plain(value) || Reflect.ownKeys(value).some(key => typeof key !== 'string'
    || !Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), 'value'))) fail('COMMENT_ANCHOR_INVALID');
  return value;
}
const boundaries = text => new Set([text.length, ...Array.from(new Intl.Segmenter(undefined,
  { granularity: 'grapheme' }).segment(text), item => item.index)]);
const textOf = row => typeof row === 'string' ? row : data(row).text;
function textsOf(paragraphs) {
  if (!Array.isArray(paragraphs) || paragraphs.length > 10000) fail('COMMENT_ANCHOR_INVALID');
  const texts = paragraphs.map(textOf);
  if (texts.some(text => typeof text !== 'string' || !text.isWellFormed())) fail('COMMENT_ANCHOR_INVALID');
  return texts;
}
function cellOwner(table, depth = 0) {
  data(table);
  if (depth > 8 || typeof table.tableId !== 'string' || !table.tableId
    || !Number.isSafeInteger(table.row) || table.row < 0 || !Number.isSafeInteger(table.column) || table.column < 0) fail('COMMENT_ANCHOR_OWNER');
  return [table.tableId, table.row, table.column, table.nested ? cellOwner(table.nested, depth + 1) : null];
}
function validateCommentAnchorOwners({ anchor, paragraphs }) {
  data(anchor); textsOf(paragraphs);
  const start = anchor.sceneParagraphIndex ?? anchor.paragraphIndex;
  const end = anchor.kind === MULTI ? (anchor.endSceneParagraphIndex ?? anchor.endParagraphIndex) : start;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || end >= paragraphs.length) fail('COMMENT_ANCHOR_OWNER');
  const owners = paragraphs.slice(start, end + 1).map(row => typeof row === 'string' || !row.table ? null : cellOwner(row.table));
  if (owners.some(owner => JSON.stringify(owner) !== JSON.stringify(owners[0]))) fail('COMMENT_ANCHOR_OWNER');
  return true;
}
function deriveCommentAnchor({ sceneId, paragraphs, input }) {
  data(input);
  const multi = input.kind === MULTI, point = input.kind === 'point';
  const allowed = ['paragraphIndex', 'startUtf16', 'selectedText', 'kind', 'affinity', ...(multi ? ['endParagraphIndex', 'endUtf16'] : [])];
  if (Object.keys(input).some(key => !allowed.includes(key)) || typeof sceneId !== 'string' || !sceneId
    || (point ? input.affinity !== 'right' || input.selectedText !== '' : input.affinity !== undefined || (!multi && input.kind !== undefined))) fail('COMMENT_ANCHOR_INVALID');
  const texts = textsOf(paragraphs), start = input.paragraphIndex, end = multi ? input.endParagraphIndex : start;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || (multi && end <= start)
    || end >= texts.length || !Number.isSafeInteger(input.startUtf16) || input.startUtf16 < 0) fail('COMMENT_ANCHOR_STALE');
  const from = input.startUtf16, to = multi ? input.endUtf16 : from + (typeof input.selectedText === 'string' ? input.selectedText.length : -1);
  if (!Number.isSafeInteger(to) || to < 0 || from > texts[start].length || to > texts[end].length
    || (!multi && (to < from || (!point && to === from)))) fail('COMMENT_ANCHOR_STALE');
  if (!boundaries(texts[start]).has(from) || !boundaries(texts[end]).has(to)) fail('COMMENT_ANCHOR_GRAPHEME');
  const selectedText = multi ? [texts[start].slice(from), ...texts.slice(start + 1, end), texts[end].slice(0, to)].join('\n') : texts[start].slice(from, to);
  if (new TextEncoder().encode(selectedText).length > 16384 || (input.selectedText !== undefined && input.selectedText !== selectedText)) fail('COMMENT_ANCHOR_STALE');
  const anchor = { ...(multi ? { kind: MULTI } : point ? { kind: 'point', affinity: 'right' } : {}), sceneId,
    sceneParagraphIndex: start, paragraphIndex: start, startUtf16: from, selectedText,
    selectedTextSha256: sha(selectedText), blockTextSha256: sha(texts[start]),
    ...(multi ? { endSceneParagraphIndex: end, endParagraphIndex: end, endUtf16: to,
      endBlockTextSha256: sha(texts[end]), coveredParagraphsSha256: sha(JSON.stringify(texts.slice(start, end + 1))) } : {}) };
  validateCommentAnchorOwners({ anchor, paragraphs });
  return anchor;
}
function validateCommentAnchor({ sceneId, paragraphs, anchor }) {
  data(anchor);
  const multi = anchor.kind === MULTI;
  const expected = deriveCommentAnchor({ sceneId, paragraphs, input: {
    paragraphIndex: anchor.sceneParagraphIndex, startUtf16: anchor.startUtf16, selectedText: anchor.selectedText,
    ...(multi ? { kind: MULTI, endParagraphIndex: anchor.endSceneParagraphIndex, endUtf16: anchor.endUtf16 }
      : anchor.kind === 'point' ? { kind: 'point', affinity: anchor.affinity } : {}) } });
  if (anchor.kind !== expected.kind || Object.keys(expected).some(key => (multi || key !== 'paragraphIndex') && anchor[key] !== expected[key])) fail('COMMENT_ANCHOR_STALE');
  if (multi && Object.keys(anchor).some(key => !Object.hasOwn(expected, key) && !['authoritySource', 'sourceChangeId'].includes(key))) fail('COMMENT_ANCHOR_INVALID');
  return expected;
}
// Legacy single-leaf law retains its public signature and error codes.
function mapAnchorSplice(anchor, edit, afterText) {
  if (anchor.kind === MULTI) fail('COMMENT_EDIT_RANGE_INVALID');
  const start = anchor.startUtf16, end = start + anchor.selectedText.length;
  const from = edit.fromUtf16, to = edit.toUtf16, added = edit.insertText.length, delta = added - (to - from);
  const endpoint = (position, right) => position < from ? position : position > to ? position + delta : from + (right ? added : 0);
  if (anchor.kind === 'point' && from < start && to > start) return { anchor: { ...anchor, blockTextSha256: sha(afterText) }, deleted: true };
  if (anchor.kind === 'point' && !boundaries(afterText).has(endpoint(start, true))) fail('COMMENT_EDIT_GRAPHEME');
  if (anchor.kind === 'point') return { anchor: { ...anchor, startUtf16: endpoint(start, true), blockTextSha256: sha(afterText) }, deleted: false };
  if (from <= start && to >= end && to > from) return { anchor: { ...anchor, blockTextSha256: sha(afterText) }, deleted: true };
  const nextStart = endpoint(start, true), nextEnd = endpoint(end, false);
  if (nextEnd <= nextStart) fail('COMMENT_EDIT_RANGE_INVALID');
  if (!boundaries(afterText).has(nextStart) || !boundaries(afterText).has(nextEnd)) fail('COMMENT_EDIT_GRAPHEME');
  const selectedText = afterText.slice(nextStart, nextEnd);
  return { anchor: { ...anchor, startUtf16: nextStart, selectedText, selectedTextSha256: sha(selectedText), blockTextSha256: sha(afterText) }, deleted: false };
}
function rebaseCommentAnchorSplice({ anchor, beforeParagraphs, afterParagraphs, edit }) {
  validateCommentAnchor({ sceneId: anchor.sceneId, paragraphs: beforeParagraphs, anchor });
  const before = textsOf(beforeParagraphs), after = textsOf(afterParagraphs), index = edit.paragraphIndex;
  if (before.length !== after.length || !Number.isSafeInteger(index) || typeof before[index] !== 'string'
    || !Number.isSafeInteger(edit.fromUtf16) || !Number.isSafeInteger(edit.toUtf16) || edit.fromUtf16 < 0 || edit.toUtf16 < edit.fromUtf16
    || typeof edit.insertText !== 'string' || before[index].slice(edit.fromUtf16, edit.toUtf16) !== edit.removedText
    || after[index] !== before[index].slice(0, edit.fromUtf16) + edit.insertText + before[index].slice(edit.toUtf16)
    || before.some((text, i) => i !== index && text !== after[i])) fail('COMMENT_EDIT_REPLAY_MISMATCH');
  if (!boundaries(before[index]).has(edit.fromUtf16) || !boundaries(before[index]).has(edit.toUtf16)) fail('COMMENT_EDIT_GRAPHEME');
  if (anchor.kind !== MULTI) return index === anchor.sceneParagraphIndex ? mapAnchorSplice(anchor, edit, after[index]) : { anchor: { ...anchor }, deleted: false };
  const from = edit.fromUtf16, to = edit.toUtf16, added = edit.insertText.length;
  const endpoint = (position, right) => position < from ? position : position > to ? position + added - (to - from) : from + (right ? added : 0);
  const next = deriveCommentAnchor({ sceneId: anchor.sceneId, paragraphs: afterParagraphs, input: { kind: MULTI,
    paragraphIndex: anchor.sceneParagraphIndex, startUtf16: index === anchor.sceneParagraphIndex ? endpoint(anchor.startUtf16, true) : anchor.startUtf16,
    endParagraphIndex: anchor.endSceneParagraphIndex, endUtf16: index === anchor.endSceneParagraphIndex ? endpoint(anchor.endUtf16, false) : anchor.endUtf16 } });
  return { anchor: { ...anchor, ...next }, deleted: false };
}
module.exports = { MULTI, deriveCommentAnchor, validateCommentAnchor, validateCommentAnchorOwners, rebaseCommentAnchorSplice, mapAnchorSplice };

'use strict';

// Finite inline document meaning only. No XML, I/O or mutation authority.
const fail = () => { throw new Error('WORD_TYPED_BREAK_INVALID'); };
const plain = value => value && typeof value === 'object' && !Array.isArray(value);
function own(value, name) {
  const descriptor = Object.getOwnPropertyDescriptor(value, name);
  if (descriptor && !Object.hasOwn(descriptor, 'value')) fail();
  return descriptor?.value;
}
function kind(node) {
  if (!plain(node) || own(node, 'type') !== 'hardBreak') fail();
  const attrs = own(node, 'attrs');
  if (attrs == null) return 'line';
  if (!plain(attrs) || Object.keys(attrs).some(key => key !== 'wordBreakType')) fail();
  const type = own(attrs, 'wordBreakType');
  if (type == null) return 'line';
  if (!['page', 'column'].includes(type)) fail();
  return type;
}
function validateOffsets(text, breaks = []) {
  if (typeof text !== 'string' || !Array.isArray(breaks) || breaks.length > 100000) fail();
  let previous = -1;
  for (const item of breaks) {
    if (!plain(item) || Object.keys(item).length !== 2 || !Object.hasOwn(item, 'offset') || !Object.hasOwn(item, 'type')) fail();
    const offset = own(item, 'offset'), type = own(item, 'type');
    if (!Number.isSafeInteger(offset) || offset <= previous || offset < 0 || text[offset] !== '\n' || !['page', 'column'].includes(type)) fail();
    previous = offset;
  }
  return breaks;
}
function textBreaks(text, breaks = []) {
  validateOffsets(text, breaks);
  const types = new Map(breaks.map(item => [item.offset, item.type]));
  return Array.from(text.matchAll(/\n/gu), match => ({ offset: match.index, type: types.get(match.index) || 'line' }));
}
function paragraphBreaks(paragraph) {
  let offset = 0; const result = [];
  for (const node of paragraph.content || []) {
    if (node.type === 'hardBreak') { result.push({ offset, type: kind(node) }); offset++; }
    else if (node.type === 'text') offset += node.text.length;
    else if (node.type !== 'image' && node.type !== 'manuscriptNoteReference') fail();
  }
  return result;
}
module.exports = { kind, validateOffsets, textBreaks, paragraphBreaks };

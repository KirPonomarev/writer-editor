'use strict';

// Semantic enum only: no XML, persistence, paths or command authority.
const FORMATS = Object.freeze({ '1': 'decimal', I: 'upperRoman', i: 'lowerRoman', A: 'upperLetter', a: 'lowerLetter' });
function normalizeType(value) {
  if (value == null) return '1';
  if (typeof value !== 'string' || !Object.hasOwn(FORMATS, value)) throw new Error('WORD_LIST_FORMAT_INVALID');
  return value;
}
function wordFormat(value) { return FORMATS[normalizeType(value)]; }
function fromWordFormat(value) { return Object.keys(FORMATS).find(key => FORMATS[key] === value) ?? null; }
function inspectDocument(doc) {
  let extended = false, count = 0;
  const pending = [{ node: doc }], ancestors = new Set();
  const data = (node, key) => {
    const descriptor = Object.getOwnPropertyDescriptor(node, key);
    if (descriptor && !Object.hasOwn(descriptor, 'value')) throw new Error('WORD_LIST_FORMAT_INVALID');
    return descriptor?.value;
  };
  while (pending.length) {
    const { node, exit } = pending.pop();
    if (!node || typeof node !== 'object') continue;
    if (exit) { ancestors.delete(node); continue; }
    // Same node bound as the existing language inspector; active ancestry
    // distinguishes a cycle from a shared, otherwise valid JSON subtree.
    if (++count > 200000 || ancestors.has(node)) throw new Error('WORD_LIST_FORMAT_BUDGET');
    ancestors.add(node); pending.push({ node, exit: true });
    if (data(node, 'type') === 'orderedList') {
      const attrs = data(node, 'attrs');
      if (attrs != null && (typeof attrs !== 'object' || Array.isArray(attrs))) throw new Error('WORD_LIST_FORMAT_INVALID');
      const type = normalizeType(attrs == null ? null : data(attrs, 'type'));
      extended = extended || type !== '1';
    }
    const content = data(node, 'content');
    if (Array.isArray(content)) for (const child of content) pending.push({ node: child });
  }
  return extended;
}
module.exports = { normalizeType, wordFormat, fromWordFormat, inspectDocument };

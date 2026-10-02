'use strict';

// Scene-local semantic counters. No I/O or mutation authority; callers apply
// resolved starts to their own private document/authoring transaction only.
const format = require('./word-list-format-v1.cjs');
const fail = () => { throw new Error('WORD_LIST_NUMBERING_INVALID'); };
const own = (value, key) => {
  const d = Object.getOwnPropertyDescriptor(value, key);
  if (d && !Object.hasOwn(d, 'value')) fail();
  return d?.value;
};
function attributes(attrs) {
  if (attrs == null) return null;
  if (typeof attrs !== 'object' || Array.isArray(attrs)) fail();
  const id = own(attrs, 'wordListId'), start = own(attrs, 'wordListStart');
  if (id == null && start == null) return null;
  if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(id)
    || !Number.isSafeInteger(start) || start < 0 || start > 2147483647) fail();
  return { id, start };
}
function resolve(doc) {
  const groups = new Map(), starts = new Map(), active = new Set();
  const pending = [{ node: doc, depth: 0 }]; let count = 0;
  while (pending.length) {
    const { node, exit, depth } = pending.pop();
    if (!node || typeof node !== 'object') continue;
    if (exit) { active.delete(node); continue; }
    if (++count > 200000 || active.has(node)) fail();
    active.add(node); pending.push({ node, exit: true });
    const attrs = own(node, 'attrs'), identity = attributes(attrs);
    const content = own(node, 'content'), type = own(node, 'type');
    if (identity) {
      if (type !== 'orderedList' || !Array.isArray(content) || !content.length) fail();
      const listType = format.normalizeType(own(attrs, 'type'));
      let group = groups.get(identity.id);
      if (!group) {
        if (groups.size >= 2048) fail();
        group = { base: identity.start, next: identity.start, type: listType, depth };
        groups.set(identity.id, group);
      }
      if (group.base !== identity.start || group.type !== listType || group.depth !== depth
        || group.next + content.length - 1 > 2147483647) fail();
      starts.set(node, group.next); group.next += content.length;
    }
    if (Array.isArray(content)) for (let i = content.length - 1; i >= 0; i--) {
      pending.push({ node: own(content, String(i)), depth: depth + (['orderedList', 'bulletList'].includes(type) ? 1 : 0) });
    }
  }
  return starts;
}
function normalize(doc) {
  for (const [node, start] of resolve(doc)) node.attrs.start = start;
  return doc;
}
module.exports = { attributes, resolve, normalize };

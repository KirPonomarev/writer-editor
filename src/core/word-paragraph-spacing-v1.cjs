'use strict';

// Literal paragraph spacing, independent of XML, layout defaults and writers.
const FEATURE = 'word-paragraph-spacing.v1';
const KEYS = ['before', 'after', 'line', 'lineRule'];
const fail = () => { throw Object.assign(new Error('WORD_PARAGRAPH_SPACING_INVALID'), { code: 'WORD_PARAGRAPH_SPACING_INVALID' }); };
function plain(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype === null || prototype === Object.prototype) return true;
  // Main's isolated command harnesses can supply ordinary records from another
  // realm. Accept that realm's native Object prototype, never custom instances.
  const constructor = Object.getOwnPropertyDescriptor(prototype, 'constructor');
  return Object.getPrototypeOf(prototype) === null && typeof constructor?.value === 'function'
    && Function.prototype.toString.call(constructor.value) === Function.prototype.toString.call(Object);
}
function own(value, key) {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (!descriptor) return undefined;
  if (!descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) fail();
  return descriptor.value;
}
function normalizeWordParagraphSpacing(value) {
  if (!plain(value)) fail();
  const keys = Reflect.ownKeys(value);
  if (!keys.length || keys.length > KEYS.length || keys.some(key => !KEYS.includes(key))) fail();
  const out = {};
  for (const key of KEYS) if (Object.hasOwn(value, key)) {
    const item = own(value, key);
    if (key === 'lineRule' ? !['auto', 'exact', 'atLeast'].includes(item)
      : !Number.isSafeInteger(item) || item < 0 || item > 1000000) fail();
    out[key] = item;
  }
  return out;
}
function inspectDocumentParagraphSpacing(doc) {
  let present = false, count = 0;
  const pending = [{ node: doc, depth: 0, mark: false }], ancestors = new Set();
  while (pending.length) {
    const { node, depth, mark, exit } = pending.pop();
    if (exit) { ancestors.delete(node); continue; }
    if (!plain(node) || depth > 128 || ++count > 200000 || ancestors.has(node)) fail();
    ancestors.add(node); pending.push({ node, exit: true });
    const attrs = own(node, 'attrs'), type = own(node, 'type');
    if (attrs != null) {
      if (!plain(attrs)) fail();
      const spacing = own(attrs, 'wordParagraphSpacing');
      if (spacing != null) {
        if (mark || !['paragraph', 'heading'].includes(type)) fail();
        normalizeWordParagraphSpacing(spacing); present = true;
      }
    }
    for (const key of ['content', 'marks']) {
      const children = own(node, key);
      if (children === undefined) continue;
      if (!Array.isArray(children) || children.length > 200000) fail();
      for (let i = children.length - 1; i >= 0; i--) {
        if (!Object.hasOwn(children, String(i))) fail();
        pending.push({ node: own(children, String(i)), depth: depth + 1, mark: key === 'marks' });
      }
    }
  }
  return present;
}
module.exports = { FEATURE, normalizeWordParagraphSpacing, inspectDocumentParagraphSpacing };

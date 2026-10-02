'use strict';

// Canonical proofing-language values. Paragraph-mark and run scope are distinct;
// these values do not change text direction or infer a language from characters.
const FEATURE = 'word-language.v1';
const KEYS = Object.freeze(['val', 'eastAsia', 'bidi']);
const fail = () => { throw Object.assign(new Error('WORD_LANGUAGE_INVALID'), { code: 'WORD_LANGUAGE_INVALID' }); };

function normalizeWordLanguage(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail();
  const keys = Reflect.ownKeys(value);
  if (!keys.length || keys.length > KEYS.length || keys.some(key => !KEYS.includes(key))) fail();
  const result = {};
  for (const key of KEYS) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor) continue;
    if (!descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) fail();
    const tag = descriptor.value;
    if (typeof tag !== 'string' || tag.length > 63
      || !/^(?:[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*|x-none)$/u.test(tag)) fail();
    result[key] = tag;
  }
  return result;
}

function inspectDocumentLanguage(doc) {
  let present = false, count = 0;
  const pending = [{ node: doc, mark: false }], seen = new Set();
  while (pending.length) {
    const { node, mark, parentType } = pending.pop();
    if (!node || typeof node !== 'object') continue;
    if (++count > 200000 || seen.has(node)) fail();
    seen.add(node);
    const data = key => {
      const d = Object.getOwnPropertyDescriptor(node, key);
      if (d && !Object.hasOwn(d, 'value')) fail();
      return d?.value;
    };
    const attrs = data('attrs'), type = data('type');
    if (attrs && typeof attrs === 'object') for (const key of ['wordLanguage', 'wordParagraphMarkLanguage']) {
      const d = Object.getOwnPropertyDescriptor(attrs, key);
      if (!d) continue;
      if (!Object.hasOwn(d, 'value')) fail();
      if (d.value == null) continue; // Pinned editor schema's absent-value default.
      if (key === 'wordLanguage' ? !mark || type !== 'textStyle' || parentType !== 'text'
        : mark || !['paragraph', 'heading'].includes(type)) fail();
      normalizeWordLanguage(d.value);
      present = true;
    }
    const content = data('content'), marks = data('marks');
    if (Array.isArray(content)) for (const child of content) pending.push({ node: child, mark: false });
    if (Array.isArray(marks)) for (const child of marks) pending.push({ node: child, mark: true, parentType: type });
  }
  return present;
}

function applyParagraphLanguage(paragraph, change) {
  if (!change || Object.keys(change).sort().join(',') !== 'paragraphMark,runs,schemaVersion'
    || change.schemaVersion !== 1 || !Array.isArray(change.runs) || change.runs.length > 65536
    || !['paragraph', 'heading'].includes(paragraph?.type)) fail();
  const mark = change.paragraphMark === null ? null : normalizeWordLanguage(change.paragraphMark);
  const content = paragraph.content || [];
  if (content.some(node => node.type !== 'text' || typeof node.text !== 'string')) fail();
  const text = content.map(node => node.text).join('');
  let end = 0;
  const runs = change.runs.map(run => {
    if (!run || Object.keys(run).sort().join(',') !== 'from,language,to' || run.from !== end
      || !Number.isSafeInteger(run.to) || run.to <= end || run.to > text.length
      || (run.to < text.length && /[\ud800-\udbff]/u.test(text[run.to-1]) && /[\udc00-\udfff]/u.test(text[run.to]))) fail();
    end = run.to;
    return { ...run, language: run.language === null ? null : normalizeWordLanguage(run.language) };
  });
  if (end !== text.length) fail();
  const out = JSON.parse(JSON.stringify(paragraph));
  if (mark) out.attrs = { ...out.attrs, wordParagraphMarkLanguage: mark };
  else if (out.attrs) delete out.attrs.wordParagraphMarkLanguage;
  const next = []; let offset = 0, ri = 0;
  for (const node of out.content || []) {
    const limit = offset + node.text.length; let local = offset;
    while (local < limit) {
      while (runs[ri].to <= local) ri++;
      const run = runs[ri], to = Math.min(limit, run.to), part = { ...node, text: node.text.slice(local-offset, to-offset) };
      const marks = (node.marks || []).map(m => ({ ...m, ...(m.attrs ? { attrs: { ...m.attrs } } : {}) }));
      const styles = marks.filter(m => m.type === 'textStyle');
      if (styles.length > 1) fail();
      if (styles[0]?.attrs) delete styles[0].attrs.wordLanguage;
      if (run.language) {
        if (!styles.length) { const m = { type: 'textStyle', attrs: {} }; marks.push(m); styles.push(m); }
        styles[0].attrs = { ...styles[0].attrs, wordLanguage: run.language };
      }
      const retained = marks.filter(m => m.type !== 'textStyle' || Object.values(m.attrs || {}).some(v => v != null));
      if (retained.length) part.marks = retained; else delete part.marks;
      const previous = next.at(-1);
      if (previous && JSON.stringify({ ...previous, text: '' }) === JSON.stringify({ ...part, text: '' })) previous.text += part.text;
      else next.push(part);
      local = to;
    }
    offset = limit;
  }
  out.content = next;
  return out;
}

module.exports = { FEATURE, KEYS, normalizeWordLanguage, inspectDocumentLanguage, applyParagraphLanguage };

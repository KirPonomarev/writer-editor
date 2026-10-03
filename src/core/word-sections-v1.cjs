'use strict';
const KEY = 'wordSections';
const TYPES = ['nextPage', 'continuous', 'evenPage', 'oddPage', 'nextColumn'];
const bookmarks = () => require('./word-user-bookmarks-v1.cjs');
const fail = () => { throw Error('WORD_SECTIONS_INVALID'); };
const copy = value => JSON.parse(JSON.stringify(value));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function object(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail();
  for (const key of Reflect.ownKeys(value)) {
    const field = Object.getOwnPropertyDescriptor(value, key);
    if (typeof key !== 'string' || !keys.includes(key) || !field.enumerable || !Object.hasOwn(field, 'value')) fail();
  }
}
function integer(value, min = 0, max = 31680) {
  if (!Number.isSafeInteger(value) || value < min || value > max) fail();
  return value;
}
function properties(value) {
  object(value, ['type', 'pageSize', 'margins', 'columns']);
  if (!TYPES.includes(value.type)) fail();
  const out = { type: value.type };
  if (Object.hasOwn(value, 'pageSize')) {
    object(value.pageSize, ['widthTwips', 'heightTwips', 'orientation']);
    if (!['portrait', 'landscape'].includes(value.pageSize.orientation)) fail();
    out.pageSize = { widthTwips: integer(value.pageSize.widthTwips, 1), heightTwips: integer(value.pageSize.heightTwips, 1), orientation: value.pageSize.orientation };
  }
  if (Object.hasOwn(value, 'margins')) {
    const keys = ['topTwips', 'rightTwips', 'bottomTwips', 'leftTwips', 'headerTwips', 'footerTwips', 'gutterTwips'];
    object(value.margins, keys); out.margins = Object.fromEntries(keys.map(key => [key, integer(value.margins[key])]));
  }
  if (Object.hasOwn(value, 'columns')) {
    object(value.columns, ['count', 'spaceTwips']);
    out.columns = { count: integer(value.columns.count, 1, 16), spaceTwips: integer(value.columns.spaceTwips) };
  }
  return out;
}
function read(doc, { checkBounds = true } = {}) {
  const attr = Object.getOwnPropertyDescriptor(doc || {}, 'attrs');
  if (attr && !Object.hasOwn(attr, 'value')) fail();
  const field = attr?.value && Object.getOwnPropertyDescriptor(attr.value, KEY);
  if (field && !Object.hasOwn(field, 'value')) fail();
  const value = field?.value;
  if (value == null) return null;
  object(value, ['schemaVersion', 'boundaries', 'final']);
  if (value.schemaVersion !== 1 || !Array.isArray(value.boundaries) || value.boundaries.length > 1024) fail();
  for (let i = 0; i < value.boundaries.length; i++) {
    const field = Object.getOwnPropertyDescriptor(value.boundaries, String(i));
    if (!field || !Object.hasOwn(field, 'value')) fail();
  }
  if (Reflect.ownKeys(value.boundaries).length !== value.boundaries.length + 1 || Object.getPrototypeOf(value.boundaries) !== Array.prototype) fail();
  const leaves = checkBounds ? bookmarks().paragraphs(doc) : null;
  const rootLeaves = new Set((doc.content || []).filter(node => ['paragraph', 'heading', 'codeBlock'].includes(node.type)));
  let previous = -1;
  const boundaries = value.boundaries.map(record => {
    object(record, ['endParagraphIndex', 'properties']);
    const index = integer(record.endParagraphIndex, 0, 9999);
    if (index <= previous || leaves && (index >= leaves.length - 1 || !rootLeaves.has(leaves[index]))) fail();
    previous = index;
    return { endParagraphIndex: index, properties: properties(record.properties) };
  });
  return { schemaVersion: 1, boundaries, final: properties(value.final) };
}
function bind(doc, registry) {
  const result = copy(doc); result.attrs = { ...result.attrs, [KEY]: copy(registry) }; read(result); return result;
}
function project(beforeDoc, workingDoc) {
  const before = read(beforeDoc); if (!before) return null;
  const old = bookmarks().paragraphs(beforeDoc), next = bookmarks().paragraphs(workingDoc);
  let boundaries = before.boundaries;
  const oldTexts = old.map(bookmarks().textOf), nextTexts = next.map(bookmarks().textOf);
  const unchangedText = oldTexts.join('') === nextTexts.join('');
  if (old.length !== next.length || unchangedText && !same(oldTexts, nextTexts)) {
    const map = bookmarks().mapSectionParagraphEndpoints(beforeDoc, workingDoc);
    boundaries = boundaries.map(record => ({ ...record, endParagraphIndex: map({
      paragraphIndex: record.endParagraphIndex, offsetUtf16: bookmarks().textOf(old[record.endParagraphIndex]).length,
      edge: 'afterParagraph',
    }).paragraphIndex }));
  }
  const result = { ...before, boundaries }; read(bind(workingDoc, result)); return result;
}
function validateSave(beforeDoc, workingDoc) {
  const before = read(beforeDoc), incoming = read(workingDoc);
  if (!before && !incoming) return;
  if (!same(project(beforeDoc, workingDoc), incoming)) throw Error('WORD_SECTIONS_SAVE_AUTHORITY');
}
function withDefaults(value, defaults) { return { ...copy(defaults), ...properties(value) }; }
function xml(value) {
  const p = properties(value);
  return '<w:sectPr>' + `<w:type w:val="${p.type}"/>`
    + (p.pageSize ? `<w:pgSz w:w="${p.pageSize.widthTwips}" w:h="${p.pageSize.heightTwips}" w:orient="${p.pageSize.orientation}"/>` : '')
    + (p.margins ? `<w:pgMar w:top="${p.margins.topTwips}" w:right="${p.margins.rightTwips}" w:bottom="${p.margins.bottomTwips}" w:left="${p.margins.leftTwips}" w:header="${p.margins.headerTwips}" w:footer="${p.margins.footerTwips}" w:gutter="${p.margins.gutterTwips}"/>` : '')
    + (p.columns ? `<w:cols w:num="${p.columns.count}" w:space="${p.columns.spaceTwips}"/>` : '') + '</w:sectPr>';
}
module.exports = { KEY, TYPES, read, bind, project, validateSave, properties, withDefaults, xml };

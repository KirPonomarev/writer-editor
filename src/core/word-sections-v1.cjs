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
// Disabled grids retain latent Word values without enabling layout behavior.
// ECMA uses signed xsd:integer; this profile admits exact JS safe integers.
function validateDocGrid(value) {
  object(value, ['type', 'linePitch', 'charSpace']);
  if (value.type !== 'default') fail();
  const out = { type: 'default' };
  for (const key of ['linePitch', 'charSpace']) if (Object.hasOwn(value, key)) {
    if (!Number.isSafeInteger(value[key])) fail();
    out[key] = value[key];
  }
  return out;
}
function docGridXml(value) {
  const grid = validateDocGrid(value);
  return '<w:docGrid w:type="default"' + ['linePitch', 'charSpace']
    .filter(key => Object.hasOwn(grid, key)).map(key => ` w:${key}="${grid[key]}"`).join('') + '/>';
}
function properties(value) {
  object(value, ['type', 'pageSize', 'margins', 'columns', 'docGrid']);
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
  if (Object.hasOwn(value, 'docGrid')) out.docGrid = validateDocGrid(value.docGrid);
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
  const carrierLeaves = new Set();
  const collectCarriers = node => {
    if (['paragraph', 'heading', 'codeBlock'].includes(node.type)) carrierLeaves.add(node);
    else if (['doc', 'orderedList', 'bulletList', 'listItem', 'blockquote'].includes(node.type)) {
      for (const child of node.content || []) collectCarriers(child);
    }
  };
  if (checkBounds) collectCarriers(doc);
  let previous = -1;
  const boundaries = value.boundaries.map(record => {
    object(record, ['endParagraphIndex', 'properties']);
    const index = integer(record.endParagraphIndex, 0, 9999);
    if (index <= previous || leaves && (index >= leaves.length - 1 || !carrierLeaves.has(leaves[index]))) fail();
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
// Plans are semantic data only. The caller must bind them to its authenticated
// return capsule and revalidate the scene revision at the existing writer.
function records(value, max = 1024) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > max
    || Reflect.ownKeys(value).length !== value.length + 1) fail();
  for (let i = 0; i < value.length; i++) {
    const d = Object.getOwnPropertyDescriptor(value, String(i));
    if (!d || !Object.hasOwn(d, 'value')) fail();
  }
  return value;
}
function validateInactiveGridPlan(value) {
  object(value, ['expectedRegistry', 'additions']);
  if (!Object.hasOwn(value, 'expectedRegistry') || !Object.hasOwn(value, 'additions')) fail();
  const expectedRegistry = value.expectedRegistry === null ? null
    : read({ attrs: { wordSections: value.expectedRegistry } }, { checkBounds: false });
  if (value.expectedRegistry !== null && !expectedRegistry) fail();
  let previous = -1;
  const additions = records(value.additions).map(item => {
    object(item, ['endParagraphIndex', 'docGrid']);
    const endParagraphIndex = integer(item.endParagraphIndex, 0, 9999);
    if (endParagraphIndex <= previous) fail();
    previous = endParagraphIndex;
    return { endParagraphIndex, docGrid: validateDocGrid(item.docGrid) };
  });
  if (!additions.length) fail();
  return { expectedRegistry, additions };
}
function applyInactiveGridAdditions(doc, value) {
  const plan = validateInactiveGridPlan(value), before = read(doc);
  if (!same(before, plan.expectedRegistry)) fail();
  const count = bookmarks().paragraphs(doc).length;
  if (!count) fail();
  const registry = before || { schemaVersion: 1, boundaries: [], final: { type: 'nextPage' } };
  for (const item of plan.additions) {
    const target = item.endParagraphIndex === count - 1 ? registry.final
      : registry.boundaries.find(record => record.endParagraphIndex === item.endParagraphIndex)?.properties;
    if (!target || Object.hasOwn(target, 'docGrid')) fail();
    target.docGrid = item.docGrid;
  }
  return bind(doc, registry);
}
function planInactiveGridAdditions(beforeDoc, { sceneId, exportMap, protectedSections, additions } = {}) {
  const sections = Array.isArray(protectedSections) ? protectedSections : protectedSections?.protectedSections;
  records(sections); records(additions);
  const scenes = exportMap?.scenes;
  if (!Array.isArray(scenes) || scenes.filter(scene => scene.sceneId === sceneId).length !== 1) fail();
  const scene = scenes.find(scene => scene.sceneId === sceneId);
  const leaves = bookmarks().paragraphs(beforeDoc);
  if (!Array.isArray(scene.blocks) || scene.blocks.length !== leaves.length || !leaves.length) fail();
  const ownership = new Map();
  for (const candidate of scenes) for (const block of candidate.blocks || []) {
    const index = integer(block.documentParagraphIndex, 0, 9999);
    if (ownership.has(index)) fail();
    ownership.set(index, candidate.sceneId);
  }
  let previousEnd = -1;
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    if (section.ordinal !== i || section.startParagraphIndex !== previousEnd + 1) fail();
    previousEnd = integer(section.endParagraphIndex, section.startParagraphIndex, 9999);
  }
  if (previousEnd !== ownership.size - 1) fail();
  const used = new Set(), local = [];
  for (const addition of additions) {
    object(addition, ['ordinal', 'docGrid']);
    const ordinal = integer(addition.ordinal, 0, sections.length - 1);
    if (used.has(ordinal)) fail();
    used.add(ordinal);
    const section = sections[ordinal], docGrid = validateDocGrid(addition.docGrid);
    if (Object.hasOwn(section.properties, 'docGrid') || section.carriers?.docGrid) fail();
    if (ownership.get(section.endParagraphIndex) !== sceneId) continue;
    const endParagraphIndex = scene.blocks.findIndex(block => block.documentParagraphIndex === section.endParagraphIndex);
    if (endParagraphIndex < 0) fail();
    local.push({ endParagraphIndex, docGrid });
  }
  if (!local.length) return null;
  const plan = validateInactiveGridPlan({ expectedRegistry: read(beforeDoc), additions: local.sort((a,b) => a.endParagraphIndex-b.endParagraphIndex) });
  applyInactiveGridAdditions(beforeDoc, plan);
  return plan;
}
function validateSaveWithGridAddition(beforeDoc, workingDoc, value) {
  const plan = validateInactiveGridPlan(value);
  // First bind to the original registry, then project legitimate text edits.
  const added = applyInactiveGridAdditions(beforeDoc, plan);
  if (!same(project(added, workingDoc), read(workingDoc))) throw Error('WORD_SECTIONS_SAVE_AUTHORITY');
}
function withDefaults(value, defaults) { return { ...copy(defaults), ...properties(value) }; }
function xml(value) {
  const p = properties(value);
  return '<w:sectPr>' + `<w:type w:val="${p.type}"/>`
    + (p.pageSize ? `<w:pgSz w:w="${p.pageSize.widthTwips}" w:h="${p.pageSize.heightTwips}" w:orient="${p.pageSize.orientation}"/>` : '')
    + (p.margins ? `<w:pgMar w:top="${p.margins.topTwips}" w:right="${p.margins.rightTwips}" w:bottom="${p.margins.bottomTwips}" w:left="${p.margins.leftTwips}" w:header="${p.margins.headerTwips}" w:footer="${p.margins.footerTwips}" w:gutter="${p.margins.gutterTwips}"/>` : '')
    + (p.columns ? `<w:cols w:num="${p.columns.count}" w:space="${p.columns.spaceTwips}"/>` : '') + (p.docGrid ? docGridXml(p.docGrid) : '') + '</w:sectPr>';
}
module.exports = { validateInactiveGridPlan, planInactiveGridAdditions, applyInactiveGridAdditions, validateSaveWithGridAddition, validateDocGrid, docGridXml, KEY, TYPES, read, bind, project, validateSave, properties, withDefaults, xml };

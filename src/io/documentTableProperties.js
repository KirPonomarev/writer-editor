'use strict';

// Canonical document data only. No DOM, I/O, parsing or mutation authority.
const EDGES = Object.freeze(['top', 'left', 'bottom', 'right', 'insideH', 'insideV']);
const MAX_DXA = 31680;
const fail = () => { throw new Error('DOCX_TABLE_PROPERTIES_INVALID'); };
const object = x => x && typeof x === 'object' && !Array.isArray(x);
const int = (x, a, b) => Number.isSafeInteger(x) && x >= a && x <= b;
const color = x => x === 'auto' || typeof x === 'string' && /^[0-9A-F]{6}$/u.test(x);
function keys(value, required) {
  if (!object(value) || Object.keys(value).length !== required.length || required.some(k => !Object.hasOwn(value, k))) fail();
}
function validateBorders(value) {
  if (!object(value) || Object.keys(value).some(k => !EDGES.includes(k))) fail();
  for (const border of Object.values(value)) {
    if (['none', 'nil'].includes(border?.style)) keys(border, ['style']);
    else {
      keys(border, ['style', 'size', 'color']);
      if (!['single', 'double'].includes(border.style) || !int(border.size, 2, 96) || !color(border.color)) fail();
    }
  }
}
function validateShading(value) {
  if (value !== null && value !== 'none' && !(typeof value === 'string' && /^[0-9A-F]{6}$/u.test(value))) fail();
}
function validateTableProperties(value, columns) {
  if (value == null) return;
  keys(value, ['version', 'grid', 'layout', 'widthDxa', 'shading', 'borders']);
  if (value.version !== 1 || !Array.isArray(value.grid) || value.grid.length !== columns
    || value.grid.some(x => x !== null && !int(x, 1, MAX_DXA))
    || value.grid.reduce((sum, x) => sum + (x || 0), 0) > MAX_DXA * 128
    || ![null, 'fixed'].includes(value.layout) || value.widthDxa !== null && !int(value.widthDxa, 1, MAX_DXA)) fail();
  validateShading(value.shading); validateBorders(value.borders);
}
function validateCellProperties(value) {
  if (value == null) return;
  keys(value, ['version', 'shading', 'borders']);
  if (value.version !== 1) fail();
  validateShading(value.shading); validateBorders(value.borders);
}
function defaultBorders() { return Object.fromEntries(EDGES.map(k => [k, { style: 'single', size: 4, color: 'auto' }])); }
function legacyTableProperties(columns) {
  return { version: 1, grid: Array(columns).fill(1440), layout: null, widthDxa: null, shading: null, borders: defaultBorders() };
}
function propertiesEqual(a, b) {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const ak = Object.keys(a), bk = Object.keys(b);
  return ak.length === bk.length && ak.every(k => Object.hasOwn(b, k) && propertiesEqual(a[k], b[k]));
}
function borderXml(borders, container) {
  const edges = EDGES.filter(k => Object.hasOwn(borders, k)).map(k => {
    const b = borders[k];
    return `<w:${k} w:val="${b.style}"${['none', 'nil'].includes(b.style) ? '' : ` w:sz="${b.size}" w:color="${b.color}"`}/>`;
  }).join('');
  return edges ? `<w:${container}>${edges}</w:${container}>` : '';
}
function shadingXml(value) { return value === null ? '' : `<w:shd w:val="clear" w:color="auto" w:fill="${value === 'none' ? 'auto' : value}"/>`; }
module.exports = { EDGES, MAX_DXA, validateTableProperties, validateCellProperties, legacyTableProperties, propertiesEqual, borderXml, shadingXml };

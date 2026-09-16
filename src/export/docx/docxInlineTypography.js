'use strict';

const { normalizeFontFamily, normalizeFontSize } = require('../../io/inlineTypography.cjs');
const { escapeXml } = require('./docxTextXml.js');

function buildDocxTypographyPropertiesXml(inline = {}) {
  const properties = [];
  if (inline.fontFamily != null && inline.fontFamily !== '') {
    const family = escapeXml(normalizeFontFamily(inline.fontFamily));
    properties.push(`<w:rFonts w:ascii="${family}" w:hAnsi="${family}" w:eastAsia="${family}" w:cs="${family}"/>`);
  }
  if (inline.fontSize != null && inline.fontSize !== '') {
    const halfPoints = Number.parseFloat(normalizeFontSize(inline.fontSize)) * 2;
    properties.push(`<w:sz w:val="${halfPoints}"/><w:szCs w:val="${halfPoints}"/>`);
  }
  return properties.join('');
}

function readRunTypography(run) {
  const typography = {};
  for (const mark of Array.isArray(run.marks) ? run.marks : []) {
    if (mark?.type !== 'textStyle') continue;
    for (const [key, normalize] of [['fontFamily', normalizeFontFamily], ['fontSize', normalizeFontSize]]) {
      const value = mark.attrs?.[key];
      if (value == null || value === '') continue;
      const normalized = normalize(value);
      if (Object.hasOwn(typography, key) && typography[key] !== normalized) throw new Error('DOCX_FONT_MARK_CONFLICT');
      typography[key] = normalized;
    }
  }
  return typography;
}

module.exports = { buildDocxTypographyPropertiesXml, readRunTypography };

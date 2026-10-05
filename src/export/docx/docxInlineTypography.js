'use strict';

const { normalizeFontFamily, normalizeFontSize, normalizeParagraphMarkTypography } = require('../../io/inlineTypography.cjs');
const { escapeXml } = require('./docxTextXml.js');
const { normalizeWordLanguage } = require('../../core/word-language-v1.cjs');

function buildDocxWordLanguageXml(value) {
  if (value == null) return '';
  const language = normalizeWordLanguage(value);
  return `<w:lang${Object.entries(language).map(([key, tag]) => ` w:${key}="${escapeXml(tag)}"`).join('')}/>`;
}

function buildDocxTypographyPropertiesXml(inline = {}) {
  const properties = [];
  if (inline.wordLanguage != null) properties.push(buildDocxWordLanguageXml(inline.wordLanguage));
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
    for (const [key, normalize] of [['fontFamily', normalizeFontFamily], ['fontSize', normalizeFontSize], ['wordLanguage', normalizeWordLanguage]]) {
      const value = mark.attrs?.[key];
      if (value == null || value === '') continue;
      const normalized = normalize(value);
      if (Object.hasOwn(typography, key) && JSON.stringify(typography[key]) !== JSON.stringify(normalized)) throw new Error('DOCX_FONT_MARK_CONFLICT');
      typography[key] = normalized;
    }
  }
  return typography;
}

function buildDocxParagraphMarkTypographyXml(value) {
  if(value==null)return '';
  const v=normalizeParagraphMarkTypography(value);let xml='';
  for(const [key,tag]of [['bold','b'],['italic','i'],['underline','u'],['strike','strike']])if(Object.hasOwn(v,key))xml+=`<w:${tag} w:val="${key==='underline'?(v[key]?'single':'none'):(v[key]?'1':'0')}"/>`;
  if(Object.hasOwn(v,'color'))xml+=`<w:color w:val="${v.color===null?'auto':v.color.slice(1)}"/>`;
  if(Object.hasOwn(v,'highlight'))xml+=v.highlight===null?'<w:highlight w:val="none"/>':`<w:shd w:val="clear" w:fill="${v.highlight.slice(1)}"/>`;
  return xml+buildDocxTypographyPropertiesXml(v);
}
module.exports = { buildDocxParagraphMarkTypographyXml, buildDocxTypographyPropertiesXml, readRunTypography, buildDocxWordLanguageXml };

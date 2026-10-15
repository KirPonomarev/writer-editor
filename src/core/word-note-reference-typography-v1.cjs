'use strict';
const { normalizeFontFamily } = require('../io/inlineTypography.cjs');
const { normalizeWordLanguage } = require('./word-language-v1.cjs');
const FONT_SLOTS = Object.freeze(['ascii', 'hAnsi', 'eastAsia', 'cs']);
const fail = () => { throw Object.assign(Error('NOTE_REFERENCE_TYPOGRAPHY_INVALID'), { code: 'NOTE_REFERENCE_TYPOGRAPHY_INVALID' }); };
function data(value, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail();
  const result = {}, names = Reflect.ownKeys(value);
  if (!names.length || names.some(key => !allowed.includes(key))) fail();
  for (const key of names) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) fail();
    result[key] = descriptor.value;
  }
  return result;
}
// Literal, independently inherited slots. No font inference, style IDs, raw XML
// or provider identity enters canonical state. Missing legacy values stay absent.
function validate(value) {
  try {
    const input = data(value, ['schemaVersion', 'fontSlots', 'wordLanguage']);
    if (input.schemaVersion !== 1 || Object.keys(input).length < 2) fail();
    const result = { schemaVersion: 1 };
    if (Object.hasOwn(input, 'fontSlots')) {
      const slots = data(input.fontSlots, FONT_SLOTS);
      result.fontSlots = {};
      for (const key of FONT_SLOTS) if (Object.hasOwn(slots, key)) {
        if (normalizeFontFamily(slots[key]) !== slots[key]) fail();
        result.fontSlots[key] = slots[key];
      }
    }
    if (Object.hasOwn(input, 'wordLanguage')) result.wordLanguage = normalizeWordLanguage(input.wordLanguage);
    return result;
  } catch { fail(); }
}
module.exports = { FONT_SLOTS, validate };

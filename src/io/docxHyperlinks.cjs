'use strict';

// Interpretation only. This module never follows a URL or reads a target.
function normalizeDocxHttpHref(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 2048
    || /[\u0000-\u0020\u007f\\]/u.test(value) || !/^https?:\/\//iu.test(value)) {
    throw new Error('DOCX_LINK_TARGET_UNSUPPORTED');
  }
  let url;
  try { url = new URL(value); } catch { throw new Error('DOCX_LINK_TARGET_UNSUPPORTED'); }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) {
    throw new Error('DOCX_LINK_TARGET_UNSUPPORTED');
  }
  // Keep the declared target, including Unicode and percent-encoding, intact.
  return value;
}

function parseDocxHyperlinkInstruction(instruction) {
  if (typeof instruction !== 'string' || instruction.length > 4096) {
    throw new Error('DOCX_LINK_FIELD_UNSUPPORTED');
  }
  // No nested fields, arbitrary switches, evaluation, DDE, frame or tooltip
  // semantics. The optional navigation switch adds no document content.
  const match = /^\s*HYPERLINK\s+(?:"([^"\r\n]+)"|([^\s"]+))(?:\s+\\h)?\s*$/iu.exec(instruction);
  if (!match) throw new Error('DOCX_LINK_FIELD_UNSUPPORTED');
  return normalizeDocxHttpHref(match[1] || match[2]);
}

function docxHttpHrefWithFragment(target, fragment = '') {
  const href = normalizeDocxHttpHref(target);
  if (!fragment) return href;
  if (typeof fragment !== 'string' || /[\u0000-\u0020\u007f#\\]/u.test(fragment)) {
    throw new Error('DOCX_LINK_TARGET_UNSUPPORTED');
  }
  const hash = href.indexOf('#');
  if (hash !== -1 && href.slice(hash + 1) !== fragment) throw new Error('DOCX_LINK_TARGET_UNSUPPORTED');
  return normalizeDocxHttpHref(hash === -1 ? `${href}#${fragment}` : href);
}

module.exports = { normalizeDocxHttpHref, parseDocxHyperlinkInstruction, docxHttpHrefWithFragment };

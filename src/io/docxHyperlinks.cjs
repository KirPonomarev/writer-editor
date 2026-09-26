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
  // Only a bounded external address, an optional document fragment and the
  // navigation switch are interpreted. No field evaluation or arbitrary args.
  const match = /^\s*HYPERLINK\s+(?:"([^"\r\n]+)"|([^\s"]+))([\s\S]*)$/iu.exec(instruction);
  if (!match) throw new Error('DOCX_LINK_FIELD_UNSUPPORTED');
  let tail = match[3].trim(), fragment = '', sawNavigation = false, sawFragment = false;
  while (tail) {
    const flag = /^\\(h|l)(?=\s|$)/iu.exec(tail);
    if (!flag) throw new Error('DOCX_LINK_FIELD_UNSUPPORTED');
    tail = tail.slice(flag[0].length).trimStart();
    if (flag[1].toLowerCase() === 'h') {
      if (sawNavigation) throw new Error('DOCX_LINK_FIELD_UNSUPPORTED');
      sawNavigation = true;
    } else {
      const value = /^(?:"([^"\r\n]+)"|([^\s"\\]+))(?=\s|$)/u.exec(tail);
      if (sawFragment || !value) throw new Error('DOCX_LINK_FIELD_UNSUPPORTED');
      sawFragment = true; fragment = value[1] || value[2];
      tail = tail.slice(value[0].length).trimStart();
    }
  }
  return docxHttpHrefWithFragment(match[1] || match[2], fragment);
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

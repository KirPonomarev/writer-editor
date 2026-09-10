'use strict';

const DOCX_TEXT_XML_ERRORS = Object.freeze({
  UNSUPPORTED_CONTROL: 'E_DOCX_TEXT_XML_UNSUPPORTED_CONTROL',
  UNPAIRED_SURROGATE: 'E_DOCX_TEXT_XML_UNPAIRED_SURROGATE',
});

function createDocxTextXmlError(code, details = {}) {
  const error = new Error(code);
  error.code = code;
  error.details = Object.freeze({ ...details });
  return error;
}

function escapeXml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function isXml10CharCodePoint(codePoint) {
  return codePoint === 0x9
    || codePoint === 0xa
    || codePoint === 0xd
    || (codePoint >= 0x20 && codePoint <= 0xd7ff)
    || (codePoint >= 0xe000 && codePoint <= 0xfffd)
    || (codePoint >= 0x10000 && codePoint <= 0x10ffff);
}

function normalizeDocxTextForSerialization(value) {
  return (typeof value === 'string' ? value : '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
}

function segmentDocxTextForSerialization(value, options = {}) {
  const text = normalizeDocxTextForSerialization(value);
  const allowFormFeedPageBreak = options.allowFormFeedPageBreak === true;
  const segments = [];
  let pendingText = '';

  function flushText() {
    if (!pendingText) return;
    segments.push({ kind: 'text', text: pendingText });
    pendingText = '';
  }

  for (let offset = 0; offset < text.length;) {
    const codePoint = text.codePointAt(offset);
    const width = codePoint > 0xffff ? 2 : 1;
    const char = text.slice(offset, offset + width);

    if (codePoint >= 0xd800 && codePoint <= 0xdfff) {
      throw createDocxTextXmlError(DOCX_TEXT_XML_ERRORS.UNPAIRED_SURROGATE, {
        offset,
        codePoint,
      });
    }

    if (char === '\t') {
      flushText();
      segments.push({ kind: 'tab' });
    } else if (char === '\n') {
      flushText();
      segments.push({ kind: 'lineBreak' });
    } else if (char === '\f') {
      if (!allowFormFeedPageBreak) {
        throw createDocxTextXmlError(DOCX_TEXT_XML_ERRORS.UNSUPPORTED_CONTROL, {
          offset,
          codePoint,
          control: 'FORM_FEED_REQUIRES_PAGE_BREAK_SEMANTIC',
        });
      }
      flushText();
      segments.push({ kind: 'pageBreak' });
    } else if (!isXml10CharCodePoint(codePoint)) {
      throw createDocxTextXmlError(DOCX_TEXT_XML_ERRORS.UNSUPPORTED_CONTROL, {
        offset,
        codePoint,
      });
    } else {
      pendingText += char;
    }

    offset += width;
  }

  flushText();
  return segments;
}

function buildDocxRunContentXml(value, options = {}) {
  return segmentDocxTextForSerialization(value, options).map((segment) => {
    if (segment.kind === 'tab') return '<w:tab/>';
    if (segment.kind === 'lineBreak') return '<w:br/>';
    if (segment.kind === 'pageBreak') return '<w:br w:type="page"/>';
    return `<w:t xml:space="preserve">${escapeXml(segment.text)}</w:t>`;
  }).join('');
}

module.exports = {
  DOCX_TEXT_XML_ERRORS,
  buildDocxRunContentXml,
  escapeXml,
  isXml10CharCodePoint,
  normalizeDocxTextForSerialization,
  segmentDocxTextForSerialization,
};

'use strict';
// Pure planning only: a cursor is an untrusted intent, never storage authority.
const media = require('../io/documentMedia.js');
const bookmarks = require('./word-user-bookmarks-v1.cjs');
const returns = require('./word-media-return-v1.cjs');
const fail = code => { throw Object.assign(Error(code), { code }); };

function insertionPoint(doc, position) {
  if (!Number.isSafeInteger(position) || position < 1) fail('LOCAL_IMAGE_CURSOR_INVALID');
  media.documentMedia(doc);
  const paragraphs = bookmarks.paragraphs(doc);
  let found = null;
  const size = node => node.type === 'text' ? node.text.length
    : ['image', 'hardBreak'].includes(node.type) ? 1
      : 2 + (node.content || []).reduce((sum, child) => sum + size(child), 0);
  const walk = (node, start) => {
    const paragraphIndex = paragraphs.indexOf(node);
    if (paragraphIndex >= 0) {
      const end = start + size(node) - 1;
      if (position < start + 1 || position > end) return;
      if (!['paragraph', 'heading'].includes(node.type)) fail('LOCAL_IMAGE_BLOCK_UNSUPPORTED');
      let cursor = start + 1, offset = 0, precedingImages = 0;
      for (const child of node.content || []) {
        if (cursor === position) break;
        const length = size(child), consumed = Math.min(length, position - cursor);
        if (child.type === 'image') precedingImages++;
        else if (child.type === 'text' || child.type === 'hardBreak') {
          offset += consumed;
          precedingImages = 0;
        } else fail('LOCAL_IMAGE_INLINE_UNSUPPORTED');
        cursor += consumed;
        if (cursor === position) break;
      }
      found = { paragraphIndex, offset, precedingImages };
      return;
    }
    let cursor = node.type === 'doc' ? 0 : start + 1;
    for (const child of node.content || []) { walk(child, cursor); cursor += size(child); }
  };
  walk(doc, -1);
  if (!found) fail('LOCAL_IMAGE_CURSOR_INVALID');
  return found;
}

function planLocalImage({ beforeDoc, position, attrs }) {
  const point = insertionPoint(beforeDoc, position);
  const rows = returns.mediaPlacements(beforeDoc);
  let index = rows.findIndex(row => row.paragraphIndex > point.paragraphIndex
    || row.paragraphIndex === point.paragraphIndex && row.offset >= point.offset);
  if (index < 0) index = rows.length;
  index += point.precedingImages;
  rows.splice(index, 0, { paragraphIndex: point.paragraphIndex, offset: point.offset,
    attrs: media.validateImageAttrs(attrs).attrs });
  const plan = returns.planMediaReturn({ beforeDoc, placements: rows });
  return { ...plan, position };
}
module.exports = { insertionPoint, planLocalImage };

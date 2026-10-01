'use strict';

// A media-only plan has no paths, I/O, authentication or publication authority.
// The caller must first bind every paragraph to its private export baseline.
const media = require('../io/documentMedia.js');
const bookmarks = require('./word-user-bookmarks-v1.cjs');
const { canonicalSerialize } = require('./browser-safe-hash.cjs');
const clone = value => JSON.parse(JSON.stringify(value));
const same = (a, b) => canonicalSerialize(a) === canonicalSerialize(b);
const fail = code => { throw Object.assign(new Error(code), { code }); };

function mediaPlacements(doc) {
  media.documentMedia(doc);
  const rows = [];
  bookmarks.paragraphs(doc).forEach((paragraph, paragraphIndex) => {
    let offset = 0;
    for (const node of paragraph.content || []) {
      if (node.type === 'image') rows.push({ paragraphIndex, offset, attrs: clone(node.attrs) });
      else if (node.type === 'text') offset += node.text.length;
      else if (node.type === 'hardBreak') offset++;
      else fail('WORD_MEDIA_INLINE_COMPOSITE_UNSUPPORTED');
    }
  });
  return rows;
}

function planMediaReturn({ beforeDoc, placements }) {
  const before = mediaPlacements(beforeDoc), paragraphs = bookmarks.paragraphs(beforeDoc);
  if (!Array.isArray(placements) || placements.length > 4096) fail('WORD_MEDIA_PLACEMENT_BUDGET');
  let previousParagraph = -1, previousOffset = -1;
  const checked = placements.map(row => {
    if (!row || Object.keys(row).sort().join(',') !== 'attrs,offset,paragraphIndex'
      || !Number.isSafeInteger(row.paragraphIndex) || row.paragraphIndex < 0 || row.paragraphIndex >= paragraphs.length
      || !Number.isSafeInteger(row.offset) || row.offset < 0) fail('WORD_MEDIA_PLACEMENT_INVALID');
    const text = bookmarks.textOf(paragraphs[row.paragraphIndex]);
    if (row.offset > text.length || (row.offset > 0 && row.offset < text.length
      && /[\ud800-\udbff]/u.test(text[row.offset - 1]) && /[\udc00-\udfff]/u.test(text[row.offset]))) {
      fail('WORD_MEDIA_UTF16_BOUNDARY');
    }
    if (row.paragraphIndex < previousParagraph
      || (row.paragraphIndex === previousParagraph && row.offset < previousOffset)) fail('WORD_MEDIA_PLACEMENT_ORDER');
    previousParagraph = row.paragraphIndex; previousOffset = row.offset;
    return { paragraphIndex: row.paragraphIndex, offset: row.offset, attrs: media.validateImageAttrs(row.attrs).attrs };
  });
  if (same(before, checked)) return { changed: false, doc: clone(beforeDoc), before, after: checked };
  const doc = clone(beforeDoc);
  bookmarks.paragraphs(doc).forEach((paragraph, paragraphIndex) => {
    const pending = checked.filter(row => row.paragraphIndex === paragraphIndex);
    if (same(before.filter(row => row.paragraphIndex === paragraphIndex), pending)) return;
    const content = [];
    let offset = 0, index = 0;
    const emit = at => {
      while (index < pending.length && pending[index].offset === at) {
        content.push({ type: 'image', attrs: clone(pending[index++].attrs) });
      }
    };
    for (const node of paragraph.content || []) {
      if (node.type === 'image') continue;
      const value = node.type === 'hardBreak' ? '\n' : node.text;
      let consumed = 0;
      emit(offset);
      while (index < pending.length && pending[index].offset < offset + value.length) {
        const cut = pending[index].offset - offset;
        if (cut > consumed) content.push({ ...clone(node), text: value.slice(consumed, cut) });
        consumed = cut; emit(offset + consumed);
      }
      if (consumed < value.length) content.push(node.type === 'hardBreak' ? clone(node) : { ...clone(node), text: value.slice(consumed) });
      offset += value.length;
    }
    emit(offset);
    if (index !== pending.length) fail('WORD_MEDIA_PLACEMENT_UNCONSUMED');
    paragraph.content = content;
  });
  media.documentMedia(doc); // Aggregate budgets apply to all repeated placements.
  // Image atoms do not change text coordinates. Existing Core independently
  // validates that no bookmark/link identity or endpoint needs an unsafe move.
  const saved = bookmarks.planSave({ beforeDoc, workingDoc: doc });
  if (!same(mediaPlacements(saved.doc), checked)) fail('WORD_MEDIA_PLAN_MISMATCH');
  return { changed: true, doc: saved.doc, before, after: checked };
}

// Exact semantic comparison across the pinned editor's inert schema defaults.
// It neither rebases a revision nor changes the raw-byte CAS used by Main.
function mediaSourceEqual(left, right) {
  mediaPlacements(left); mediaPlacements(right);
  const normalize = node => {
    const out = clone(node);
    const defaults = node.type === 'doc' ? { wordUserBookmarks: null, wordPendingRevisions: null }
      : ['paragraph', 'heading'].includes(node.type) ? { textAlign: null }
      : node.type === 'textStyle' ? { color: null, fontFamily: null, fontSize: null }
      : node.type === 'link' ? { target: '_blank', rel: 'noopener noreferrer nofollow', class: null, title: null,
        wordBookmarkId: null, wordBookmarkName: null } : null;
    if (defaults) out.attrs = { ...defaults, ...out.attrs };
    if (out.marks) out.marks = out.marks.map(normalize);
    if (out.content) {
      out.content = out.content.map(normalize).reduce((rows, current) => {
        const previous = rows.at(-1);
        if (previous?.type === 'text' && current.type === 'text' && same(previous.marks || [], current.marks || [])) previous.text += current.text;
        else rows.push(current);
        return rows;
      }, []);
      if (!out.content.length && out.type !== 'doc') delete out.content;
    }
    return out;
  };
  return same(normalize(left), normalize(right));
}

module.exports = { mediaPlacements, planMediaReturn, mediaSourceEqual };

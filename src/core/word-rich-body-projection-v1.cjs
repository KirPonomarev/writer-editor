'use strict';
// Shared structural grammar. Native callers supply strict image admission;
// browser projections never import platform media validation or grant writes.
const { normalizeDocxHttpHref } = require('../io/docxHyperlinks.cjs');
const { normalizeFontFamily, normalizeFontSize } = require('../io/inlineTypography.cjs');
const { tableParagraphs } = require('../io/documentTables.js');
const LIMITS = Object.freeze({ notes: 256, paragraphs: 128, text: 200000, bytes: 1024 * 1024 });
const plain = value => value && typeof value === 'object' && !Array.isArray(value);
const clone = value => JSON.parse(JSON.stringify(value));
const fail = code => { throw Object.assign(new Error(code), { code }); };
const need = (ok, code) => { if (!ok) fail(code); };
const keys = (value, allowed) => plain(value) && Object.keys(value).every(key => allowed.includes(key));
function validateImageProjection(attrs) {
  const required = ['assetId','assetPath','sha256','mimeType','width','height','alt','displayName','dataBase64'];
  need(keys(attrs, [...required,'displayWidthEmu','displayHeightEmu','displayEffectExtent','wordUseLocalDpi'])
    && required.every(key => Object.hasOwn(attrs,key)), 'NOTE_BODY_IMAGE_PROJECTION');
  need(typeof attrs.sha256 === 'string' && /^[a-f0-9]{64}$/.test(attrs.sha256)
    && attrs.assetId === `sha256-${attrs.sha256}` && ['image/png','image/jpeg'].includes(attrs.mimeType)
    && attrs.assetPath === `assets/media/${attrs.sha256}.${attrs.mimeType === 'image/png' ? 'png' : 'jpg'}`
    && ['width','height'].every(key => Number.isSafeInteger(attrs[key]) && attrs[key] > 0 && attrs[key] <= 8192)
    && attrs.width * attrs.height <= 16777216
    && typeof attrs.dataBase64 === 'string' && attrs.dataBase64.length > 0 && attrs.dataBase64.length <= 5592408
    && attrs.dataBase64.length % 4 === 0 && !/[^A-Za-z0-9+/=]/u.test(attrs.dataBase64)
    && ['alt','displayName'].every(key => typeof attrs[key] === 'string' && attrs[key].length <= 1024), 'NOTE_BODY_IMAGE_PROJECTION');
  if (attrs.displayWidthEmu !== undefined || attrs.displayHeightEmu !== undefined) need(['displayWidthEmu','displayHeightEmu'].every(key => Number.isSafeInteger(attrs[key]) && attrs[key] > 0 && attrs[key] <= 78028800), 'NOTE_BODY_IMAGE_PROJECTION');
  if (attrs.displayEffectExtent !== undefined) need(keys(attrs.displayEffectExtent,['l','r','t','b'])
    && ['l','r','t','b'].every(key => Number.isSafeInteger(attrs.displayEffectExtent[key]) && attrs.displayEffectExtent[key] >= 0 && attrs.displayEffectExtent[key] <= 78028800), 'NOTE_BODY_IMAGE_PROJECTION');
  if (attrs.wordUseLocalDpi !== undefined) need(typeof attrs.wordUseLocalDpi === 'boolean', 'NOTE_BODY_IMAGE_PROJECTION');
}
function validateRichBody(body, { validateImage = validateImageProjection, validateMedia = null } = {}) {
  // Validate optional typed data before any numbering normalization clones it.
  require('./word-paragraph-spacing-v1.cjs').inspectDocumentParagraphSpacing(body);
  require('./word-language-v1.cjs').inspectDocumentLanguage(body);
  const numbering = require('./word-list-numbering-v1.cjs');
  if (numbering.resolve(body).size) body = numbering.normalize(clone(body));
  const linkedIds = new Map();
  need(keys(body, ['type', 'content']) && body.type === 'doc' && Array.isArray(body.content)
    && body.content.length > 0 && body.content.length <= LIMITS.paragraphs, 'NOTE_BODY_STRUCTURE');
  let size = 0;
  const paragraphs = [];
  let nextListId = 1, nextTableId = 1;
  const visit = (blocks, stack = [], tableCursor = null) => {
    for (const block of blocks) {
      if (block?.type === 'paragraph') {
        need(paragraphs.length < LIMITS.paragraphs, 'NOTE_BODY_BUDGET');
        paragraphs.push({ paragraph: block, list: stack.at(-1) || null,
          ...(tableCursor ? { table: tableCursor() } : {}) });
        continue;
      }
      if (block?.type === 'table') {
        need(!stack.length && keys(block, ['type', 'attrs', 'content'])
          && Array.isArray(block.content) && block.content.length > 0
          && (block.attrs === undefined || keys(block.attrs, ['wordTable'])), 'NOTE_BODY_TABLE');
        for (const row of block.content) {
          need(keys(row, ['type', 'attrs', 'content']) && row.type === 'tableRow' && Array.isArray(row.content)
            && (row.attrs === undefined || keys(row.attrs, [])), 'NOTE_BODY_TABLE_ROW');
          for (const cell of row.content) need(keys(cell, ['type', 'attrs', 'content'])
            && (cell.attrs === undefined || keys(cell.attrs, ['colspan', 'rowspan', 'colwidth', 'wordCell'])), 'NOTE_BODY_TABLE_CELL');
        }
        if (tableCursor) {
          for (const row of block.content) for (const cell of row.content) visit(cell.content, [], tableCursor);
        } else {
          let leaves;
          try { leaves = tableParagraphs(block, `note-table-${nextTableId++}`); }
          catch (error) { fail(`NOTE_BODY_TABLE:${error.message}`); }
          need(paragraphs.length + leaves.length <= LIMITS.paragraphs, 'NOTE_BODY_BUDGET');
          let index = 0;
          for (const row of block.content) for (const cell of row.content) visit(cell.content, [], () => leaves[index++].table);
          need(index === leaves.length, 'NOTE_BODY_TABLE_BINDING');
        }
        continue;
      }
      need(keys(block, ['type', 'attrs', 'content']) && ['bulletList', 'orderedList'].includes(block.type), 'NOTE_BODY_BLOCK');
      need(stack.length <= 8 && Array.isArray(block.content) && block.content.length > 0
        && block.content.length <= LIMITS.paragraphs, 'NOTE_BODY_LIST_STRUCTURE');
      need(block.attrs === undefined || keys(block.attrs, block.type === 'orderedList' ? ['start', 'type', 'wordListId', 'wordListStart'] : []), 'NOTE_BODY_LIST_ATTRIBUTES');
      need(block.attrs?.type == null || ['1', 'I', 'i', 'A', 'a'].includes(block.attrs.type), 'NOTE_BODY_LIST_FORMAT');
      const start = block.type === 'orderedList' ? (block.attrs?.start ?? 1) : 1;
      need(Number.isSafeInteger(start) && start >= 0 && start + block.content.length - 1 <= 2147483647, 'NOTE_BODY_LIST_START');
      const identity = numbering.attributes(block.attrs);
      let numId;
      if (!identity) numId = nextListId++;
      else {
        if (!linkedIds.has(identity.id)) linkedIds.set(identity.id, nextListId++);
        numId = linkedIds.get(identity.id);
      }
      const list = { numId, level: stack.length, kind: block.type, start: identity?.start ?? start, ...(block.attrs?.type ? { type: block.attrs.type } : {}) };
      for (const item of block.content) {
        need(keys(item, ['type', 'content']) && item.type === 'listItem' && Array.isArray(item.content)
          && item.content.length > 0 && item.content.length <= LIMITS.paragraphs
          && item.content[0]?.type === 'paragraph'
          && item.content.slice(1).every(child => ['bulletList', 'orderedList'].includes(child?.type)), 'NOTE_BODY_LIST_ITEM');
        visit(item.content, [...stack, list], tableCursor);
      }
    }
  };
  visit(body.content);
  const text = paragraphs.map(({ paragraph: block }) => {
    need(keys(block, ['type', 'attrs', 'content']) && block.type === 'paragraph', 'NOTE_BODY_BLOCK');
    if (block.attrs !== undefined) need(keys(block.attrs, ['textAlign', 'wordParagraphSpacing', 'wordParagraphMarkLanguage'])
      && [null, undefined, 'left', 'center', 'right', 'justify'].includes(block.attrs.textAlign), 'NOTE_BODY_PARAGRAPH_ATTRIBUTES');
    need(block.content === undefined || Array.isArray(block.content), 'NOTE_BODY_CONTENT');
    return (block.content || []).map(node => {
      if (node?.type === 'hardBreak') {
        need(keys(node, ['type']), 'NOTE_BODY_BREAK');
        size++;
        return '\n';
      }
      if (node?.type === 'image') {
        need(keys(node, ['type', 'attrs']), 'NOTE_BODY_IMAGE');
        validateImage(node.attrs);
        return '';
      }
      need(keys(node, ['type', 'text', 'marks']) && node.type === 'text'
        && typeof node.text === 'string' && node.text.length > 0, 'NOTE_BODY_INLINE');
      need(!/[\u0000-\u0008\u000B-\u001F\uFFFE\uFFFF]/u.test(node.text)
        && ![...node.text].some(ch => /[\uD800-\uDFFF]/u.test(ch)), 'NOTE_BODY_TEXT');
      size += node.text.length;
      need(node.marks === undefined || Array.isArray(node.marks), 'NOTE_BODY_MARKS');
      const seen = new Set();
      for (const mark of node.marks || []) {
        need(keys(mark, ['type', 'attrs']) && !seen.has(mark.type), 'NOTE_BODY_MARK');
        seen.add(mark.type);
        if (['bold', 'italic', 'underline', 'strike'].includes(mark.type)) {
          need(mark.attrs === undefined || keys(mark.attrs, []), 'NOTE_BODY_MARK_ATTRIBUTES');
        } else if (mark.type === 'textStyle') {
          need(keys(mark.attrs, ['color', 'fontFamily', 'fontSize', 'wordLanguage']), 'NOTE_BODY_TEXT_STYLE');
          if (mark.attrs.color != null) need(/^#[a-f0-9]{6}$/iu.test(mark.attrs.color), 'NOTE_BODY_COLOR');
          if (mark.attrs.fontFamily != null) normalizeFontFamily(mark.attrs.fontFamily);
          if (mark.attrs.fontSize != null) normalizeFontSize(mark.attrs.fontSize);
        } else if (mark.type === 'highlight') {
          need(keys(mark.attrs, ['color']) && /^#[a-f0-9]{6}$/iu.test(mark.attrs.color), 'NOTE_BODY_HIGHLIGHT');
        } else if (mark.type === 'link') {
          need(keys(mark.attrs, ['href', 'target', 'rel', 'class', 'title']), 'NOTE_BODY_LINK');
          normalizeDocxHttpHref(mark.attrs.href);
          need([undefined, null, '_blank'].includes(mark.attrs.target)
            && [undefined, null, 'noopener noreferrer nofollow'].includes(mark.attrs.rel)
            && mark.attrs.class == null && mark.attrs.title == null, 'NOTE_BODY_LINK_ATTRIBUTES');
        } else fail('NOTE_BODY_MARK_UNSUPPORTED');
      }
      return node.text;
    }).join('');
  }).join('\n');
  need(size <= LIMITS.text && new TextEncoder().encode(JSON.stringify(body)).length <= LIMITS.bytes, 'NOTE_BODY_BUDGET');
  if (validateMedia) validateMedia(body);
  const checked = clone(body), pending = [checked];
  while (pending.length) {
    const node = pending.pop();
    for (const key of ['wordParagraphSpacing', 'wordParagraphMarkLanguage', 'wordLanguage']) {
      if (node.attrs?.[key] === null) delete node.attrs[key];
    }
    for (const key of ['content', 'marks']) for (const child of node[key] || []) pending.push(child);
  }
  return { body: checked, text, paragraphs };
}


const validateNoteBodyProjection = body => validateRichBody(body);
module.exports = { LIMITS, validateRichBody, validateNoteBodyProjection };

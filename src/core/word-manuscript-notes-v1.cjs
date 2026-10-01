'use strict';

const { sha256UpdateCompatible } = require('./browser-safe-hash.cjs');
const { parseObservablePayload, deriveVisibleTextFromDocument } = require('./document-content-envelope-v1.cjs');
const { normalizeDocxHttpHref } = require('../io/docxHyperlinks.cjs');
const { normalizeFontFamily, normalizeFontSize } = require('../io/inlineTypography.cjs');
const { documentMedia, validateImageAttrs } = require('../io/documentMedia.js');
const { tableParagraphs } = require('../io/documentTables.js');

const MODE = 'MANUSCRIPT_POINT_REBASE_V1';
const LIMITS = Object.freeze({ notes: 256, paragraphs: 128, text: 200000, bytes: 1024 * 1024 });
const plain = value => value && typeof value === 'object' && !Array.isArray(value);
const clone = value => JSON.parse(JSON.stringify(value));
const sha = value => sha256UpdateCompatible(value);
const fail = code => { throw Object.assign(new Error(code), { code }); };
const need = (ok, code) => { if (!ok) fail(code); };
const keys = (value, allowed) => plain(value) && Object.keys(value).every(key => allowed.includes(key));
const boundary = (text, offset) => Number.isSafeInteger(offset) && offset >= 0 && offset <= text.length
  && !(offset > 0 && offset < text.length && /[\uD800-\uDBFF]/u.test(text[offset - 1]) && /[\uDC00-\uDFFF]/u.test(text[offset]));

function validateNoteBody(body) {
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
      need(block.attrs === undefined || keys(block.attrs, block.type === 'orderedList' ? ['start', 'type'] : []), 'NOTE_BODY_LIST_ATTRIBUTES');
      need(block.attrs?.type == null || block.attrs.type === '1', 'NOTE_BODY_LIST_FORMAT');
      const start = block.type === 'orderedList' ? (block.attrs?.start ?? 1) : 1;
      need(Number.isSafeInteger(start) && start >= 0 && start + block.content.length - 1 <= 2147483647, 'NOTE_BODY_LIST_START');
      const list = { numId: nextListId++, level: stack.length, kind: block.type, start };
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
    if (block.attrs !== undefined) need(keys(block.attrs, ['textAlign'])
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
        validateImageAttrs(node.attrs);
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
          need(keys(mark.attrs, ['color', 'fontFamily', 'fontSize']), 'NOTE_BODY_TEXT_STYLE');
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
  need(size <= LIMITS.text && Buffer.byteLength(JSON.stringify(body)) <= LIMITS.bytes, 'NOTE_BODY_BUDGET');
  documentMedia(body);
  return { body: clone(body), text, paragraphs };
}

// Read-only comparison projection for the pinned main editor schema. Never
// erase non-null domain state or use this projection as a persistence writer.
function noteSceneSchemaDefaults(value) {
  if (!plain(value) || value.type !== 'doc' || (value.attrs !== undefined && !plain(value.attrs))) return value;
  return { ...value, attrs: { wordPendingRevisions: null, wordUserBookmarks: null, ...(value.attrs || {}) } };
}

// The same leaf occurrence order used by DOCX export. Empty and repeated
// paragraphs retain their position; table/container boundaries add no text.
function sceneParagraphs(doc) {
  const paragraphs = []; let lists = 0;
  const append = block => {
    need(['paragraph', 'heading', 'codeBlock'].includes(block?.type), 'NOTE_SCENE_STRUCTURE_UNSUPPORTED');
    need((block.content || []).every(node => ['text', 'hardBreak', 'image'].includes(node.type)), 'NOTE_SCENE_INLINE_UNSUPPORTED');
    need(paragraphs.length < 50000, 'NOTE_SCENE_BUDGET');
    paragraphs.push(deriveVisibleTextFromDocument({ type: 'doc', content: [block] }));
  };
  const visit = (block, depth = 0) => {
    if (['paragraph', 'heading', 'codeBlock'].includes(block?.type)) { append(block); return; }
    if (block?.type === 'table') {
      for (const leaf of tableParagraphs(block, 'note-scene')) append(leaf.node);
      return;
    }
    need(['bulletList', 'orderedList'].includes(block?.type) && depth <= 8 && ++lists <= 2048
      && Array.isArray(block.content) && block.content.length > 0, 'NOTE_SCENE_STRUCTURE_UNSUPPORTED');
    need(!block.attrs || keys(block.attrs, block.type === 'orderedList' ? ['start', 'type'] : []), 'NOTE_SCENE_STRUCTURE_UNSUPPORTED');
    const start = block.attrs?.start ?? 1;
    need(Number.isSafeInteger(start) && start >= 0 && start + block.content.length - 1 <= 2147483647
      && (block.attrs?.type == null || block.attrs.type === '1'), 'NOTE_SCENE_STRUCTURE_UNSUPPORTED');
    for (const item of block.content) {
      need(item?.type === 'listItem' && Array.isArray(item.content) && item.content[0]?.type === 'paragraph'
        && item.content.slice(1).every(child => ['bulletList', 'orderedList'].includes(child?.type)), 'NOTE_SCENE_STRUCTURE_UNSUPPORTED');
      append(item.content[0]); for (const child of item.content.slice(1)) visit(child, depth + 1);
    }
  };
  doc.content.forEach(block => visit(block));
  documentMedia(doc);
  return paragraphs;
}
function sceneText(content) {
  need(typeof content === 'string' && Buffer.byteLength(content) <= 8 * LIMITS.bytes, 'NOTE_SCENE_BUDGET');
  const parsed = parseObservablePayload(content);
  need(!parsed.issue, 'NOTE_SCENE_INVALID');
  if (!parsed.doc) return parsed.text;
  need(parsed.doc.type === 'doc' && Array.isArray(parsed.doc.content), 'NOTE_SCENE_INVALID');
  return sceneParagraphs(parsed.doc).join('\n');
}

function validateManuscriptPayload(value) {
  need(keys(value, ['schemaVersion', 'kind', 'reference', 'body']) && value.schemaVersion === 1
    && ['footnote', 'endnote'].includes(value.kind), 'NOTE_MANUSCRIPT_SCHEMA');
  const ref = value.reference;
  need(keys(ref, ['sceneId', 'offsetUtf16', 'sourceTextSha256', 'affinity'])
    && typeof ref.sceneId === 'string' && ref.sceneId.length > 0 && ref.sceneId.length <= 1024
    && !ref.sceneId.startsWith('/') && !ref.sceneId.split('/').some(x => x === '..' || x === '.' || !x)
    && !/[\\\u0000-\u001F]/u.test(ref.sceneId)
    && Number.isSafeInteger(ref.offsetUtf16) && ref.offsetUtf16 >= 0
    && /^[a-f0-9]{64}$/u.test(ref.sourceTextSha256) && ref.affinity === 'after', 'NOTE_REFERENCE_INVALID');
  validateNoteBody(value.body);
  return clone(value);
}

function bindManuscriptPayload({ kind, body, sceneId, offsetUtf16, sceneContent }) {
  const text = sceneText(sceneContent);
  need(boundary(text, offsetUtf16), 'NOTE_REFERENCE_BOUNDARY');
  return validateManuscriptPayload({ schemaVersion: 1, kind, body,
    reference: { sceneId, offsetUtf16, sourceTextSha256: sha(text), affinity: 'after' } });
}

function validateManuscriptDocument(document, projectId) {
  need(plain(document) && document.schemaVersion === 1 && document.projectId === projectId
    && Array.isArray(document.notes), 'NOTE_DOCUMENT_INVALID');
  const ids = new Set(); let count = 0, bytes = 0;
  for (const note of document.notes) {
    if (note?.manuscript === undefined) continue;
    need(typeof note.id === 'string' && /^[A-Za-z0-9._:-]{1,128}$/u.test(note.id)
      && !ids.has(note.id), 'NOTE_ID_INVALID');
    ids.add(note.id);
    validateManuscriptPayload(note.manuscript);
    need(note.scope === 'manuscript' && note.body === validateNoteBody(note.manuscript.body).text,
      'NOTE_MANUSCRIPT_PROJECTION_MISMATCH');
    if (!note.deleted) { count++; bytes += Buffer.byteLength(JSON.stringify(note.manuscript.body)); }
  }
  need(count <= LIMITS.notes && bytes <= LIMITS.bytes, 'NOTE_DOCUMENT_BUDGET');
  return document;
}

function mapPoint(oldText, nextText, point) {
  need(boundary(oldText, point), 'NOTE_REFERENCE_BOUNDARY');
  if (oldText === nextText) return point;
  const n = oldText.length, m = nextText.length;
  let prefix = 0, suffix = 0;
  while (prefix < Math.min(n, m) && oldText[prefix] === nextText[prefix]) prefix++;
  while (suffix < Math.min(n, m) && oldText[n - suffix - 1] === nextText[m - suffix - 1]) suffix++;
  // Every equally minimal contiguous edit must map the point identically.
  // Repeated text cannot silently move a reference to a different occurrence.
  const earliest = Math.min(prefix, Math.min(n, m) - suffix);
  const latest = Math.max(n - suffix, prefix + Math.max(0, n - m));
  // At the right edge of every possible edit, an after-affinity point has
  // the same destination as the surviving suffix, including an empty suffix.
  const result = point < earliest ? point : point >= latest ? point + m - n
    : earliest === latest && point === earliest && m >= n ? point + m - n : null;
  need(result !== null && boundary(nextText, result), 'NOTE_REFERENCE_EDIT_CONFLICT');
  return result;
}

function planManuscriptNoteAnchorSave({ beforeText, projectId, sceneId, beforeContent, afterContent }) {
  if (beforeText === null) return null;
  need(typeof beforeText === 'string' && Buffer.byteLength(beforeText) <= 4 * LIMITS.bytes, 'NOTE_DOCUMENT_BUDGET');
  const document = validateManuscriptDocument(JSON.parse(beforeText), projectId);
  const active = document.notes.filter(n => n.manuscript?.reference.sceneId === sceneId && !n.deleted);
  if (!active.length) return null;
  const before = sceneText(beforeContent), after = sceneText(afterContent);
  for (const note of active) {
    const ref = note.manuscript.reference;
    need(ref.sourceTextSha256 === sha(before) && boundary(before, ref.offsetUtf16), 'NOTE_REFERENCE_STALE');
    ref.offsetUtf16 = mapPoint(before, after, ref.offsetUtf16);
    ref.sourceTextSha256 = sha(after);
  }
  if (before === after) return null;
  return { mode: MODE, beforeText, afterText: `${JSON.stringify(document, null, 2)}\n` };
}

function validateNoteCohort(value, { projectId, sceneId, beforeContent, afterContent }) {
  if (value == null) return null;
  need(keys(value, ['mode', 'beforeText', 'afterText'])
    && [MODE, 'MANUSCRIPT_IMPORT_V1', 'MANUSCRIPT_BODY_UPDATE_V1'].includes(value.mode)
    && (value.beforeText === null || typeof value.beforeText === 'string')
    && typeof value.afterText === 'string'
    && [value.beforeText || '', value.afterText].every(s => Buffer.byteLength(s) <= 4 * LIMITS.bytes), 'NOTE_COHORT_SHAPE');
  if (value.mode === MODE) {
    const expected = planManuscriptNoteAnchorSave({ beforeText: value.beforeText, projectId, sceneId, beforeContent, afterContent });
    need(expected && expected.afterText === value.afterText, 'NOTE_COHORT_REBASE');
    return expected;
  }
  if (value.mode === 'MANUSCRIPT_BODY_UPDATE_V1') {
    need(typeof beforeContent === 'string' && beforeContent === afterContent && value.beforeText !== null, 'NOTE_COHORT_UNCHANGED_SCENE');
    const before = validateManuscriptDocument(JSON.parse(value.beforeText), projectId);
    const after = validateManuscriptDocument(JSON.parse(value.afterText), projectId);
    const byId = new Map(before.notes.map(note => [note.id, note]));
    need(byId.size === before.notes.length && new Set(after.notes.map(note => note.id)).size === after.notes.length, 'NOTE_COHORT_DUPLICATE_ID');
    need(after.notes.length >= before.notes.length, 'NOTE_COHORT_OLDER_STATE');
    for (const old of before.notes) {
      const next = after.notes.find(note => note.id === old.id);
      need(next && (old.manuscript || JSON.stringify(next) === JSON.stringify(old)), 'NOTE_COHORT_PRIVATE_STATE');
    }
    const text = sceneText(afterContent);
    for (const note of after.notes) {
      const old = byId.get(note.id);
      if (JSON.stringify(old) === JSON.stringify(note)) continue;
      need(note.manuscript && (!old || old.manuscript), 'NOTE_COHORT_MANUSCRIPT_ONLY');
      const ref = note.manuscript.reference;
      if (ref.sceneId !== sceneId) need(old && JSON.stringify(old.manuscript.reference) === JSON.stringify(ref), 'NOTE_COHORT_OTHER_SCENE_REFERENCE');
      else need(ref.sourceTextSha256 === sha(text) && boundary(text, ref.offsetUtf16), 'NOTE_COHORT_SOURCE');
    }
    // Only existing return receipts and clock metadata may change at the root.
    const root = doc => Object.fromEntries(Object.entries(doc).filter(([key]) => !['notes', 'wordNoteReturnReceipts', 'updatedAtUtc'].includes(key)));
    need(JSON.stringify(root(before)) === JSON.stringify(root(after)), 'NOTE_COHORT_ROOT_STATE');
    return clone(value);
  }
  need(beforeContent === null, 'NOTE_COHORT_CREATE_ONLY');
  const before = value.beforeText === null ? { schemaVersion: 1, projectId, notes: [] } : JSON.parse(value.beforeText);
  const after = JSON.parse(value.afterText);
  validateManuscriptDocument(before, projectId); validateManuscriptDocument(after, projectId);
  need(after.notes.length > before.notes.length
    && JSON.stringify(after.notes.slice(0, before.notes.length)) === JSON.stringify(before.notes)
    && JSON.stringify({ ...after, notes: before.notes }) === JSON.stringify(before), 'NOTE_COHORT_OLDER_STATE');
  const text = sceneText(afterContent), ids = new Set(before.notes.map(n => n.id));
  for (const note of after.notes.slice(before.notes.length)) {
    need(note.manuscript && !note.deleted && !ids.has(note.id), 'NOTE_COHORT_NEW_NOTE');
    ids.add(note.id);
    const ref = note.manuscript.reference;
    need(ref.sceneId === sceneId && ref.sourceTextSha256 === sha(text)
      && boundary(text, ref.offsetUtf16), 'NOTE_COHORT_SOURCE');
  }
  return clone(value);
}

function materializeImportedNotes({ candidates, sceneContent, projectId, sceneId, importOperationId, beforeText, createdAt = '1970-01-01T00:00:00.000Z' }) {
  need(Array.isArray(candidates) && candidates.length > 0 && candidates.length <= LIMITS.notes, 'NOTE_IMPORT_COUNT');
  const text = sceneText(sceneContent), parsed = parseObservablePayload(sceneContent);
  const paragraphs = parsed.doc ? sceneParagraphs(parsed.doc) : parsed.text.split('\n');
  const before = beforeText === null ? { schemaVersion: 1, projectId, notes: [] } : JSON.parse(beforeText);
  validateManuscriptDocument(before, projectId);
  const after = clone(before), ids = new Set(before.notes.map(n => n.id));
  const imported = candidates.map((candidate, index) => {
    need(keys(candidate, ['kind', 'paragraphIndex', 'offsetUtf16', 'body'])
      && Number.isSafeInteger(candidate.paragraphIndex) && candidate.paragraphIndex >= 0
      && typeof paragraphs[candidate.paragraphIndex] === 'string'
      && boundary(paragraphs[candidate.paragraphIndex], candidate.offsetUtf16), 'NOTE_IMPORT_POINT');
    const id = `note-${sha(`${projectId}\u0000${importOperationId}\u0000${index}`).slice(0, 32)}`;
    need(!ids.has(id), 'NOTE_IMPORT_ID_COLLISION'); ids.add(id);
    const offsetUtf16 = paragraphs.slice(0, candidate.paragraphIndex).reduce((sum, p) => sum + p.length + 1, 0) + candidate.offsetUtf16;
    const manuscript = bindManuscriptPayload({ ...candidate, sceneId, offsetUtf16, sceneContent });
    need(manuscript.reference.sourceTextSha256 === sha(text), 'NOTE_IMPORT_SOURCE');
    // Provider IDs and clock fields never supply canonical identity or authority.
    return { schemaVersion: 1, id, scope: 'manuscript', title: '',
      body: validateNoteBody(candidate.body).text, manuscript, deleted: false,
      createdAtUtc: createdAt, updatedAtUtc: createdAt, attachment: { scope: 'manuscript' } };
  });
  after.notes.push(...imported);
  const result = { mode: 'MANUSCRIPT_IMPORT_V1', beforeText, afterText: `${JSON.stringify(after, null, 2)}\n` };
  validateNoteCohort(result, { projectId, sceneId, beforeContent: null, afterContent: sceneContent });
  return { ...result, imported };
}

module.exports = { MODE, LIMITS, sha, boundary, validateNoteBody, sceneText, noteSceneSchemaDefaults,
  validateManuscriptPayload, bindManuscriptPayload, validateManuscriptDocument,
  mapPoint, planManuscriptNoteAnchorSave, validateNoteCohort, materializeImportedNotes };

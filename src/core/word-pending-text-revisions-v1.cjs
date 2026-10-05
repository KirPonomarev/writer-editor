'use strict';

// Canonical scene-owned review state. The displayed document is a checked
// projection, never a second source of truth for a pending change.
const KEY = 'wordPendingRevisions';
const { inspectTable } = require('../io/documentTables.js');
const spacing = require('./word-paragraph-spacing-v1.cjs');
const language = require('./word-language-v1.cjs');
const MAX_BYTES = 4 * 1024 * 1024;
const stable = value => Array.isArray(value) ? '[' + value.map(stable).join(',') + ']' : object(value) ? '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + stable(value[k])).join(',') + '}' : JSON.stringify(value);
const clone = value => JSON.parse(JSON.stringify(value));
const fail = code => { throw Object.assign(new Error(code), { code }); };
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const exact = (value, keys) => object(value) && Object.keys(value).every(key => keys.includes(key));
const status = value => ['pending', 'accepted', 'rejected'].includes(value);
const textOf = node => node.type === 'hardBreak' ? '\n' : node.text;
const paragraphProperties = node => ({ type: node.type, ...(node.attrs && Object.keys(node.attrs).length ? { attrs: clone(node.attrs) } : {}) });
const isParagraphBoundary = revision => revision.boundary === 'paragraph';
const isTableRow = revision => revision.structure?.kind === 'tableRow';
const isStructural = revision => isParagraphBoundary(revision) || isTableRow(revision);
const isParagraphFormat = revision => revision.operation === 'format' && revision.format?.kind === 'paragraph';
function assert(condition, code = 'PENDING_REVISIONS_INVALID') { if (!condition) fail(code); }
function safeBoundary(text, offset) {
  return Number.isSafeInteger(offset) && offset >= 0 && offset <= text.length
    && !(offset > 0 && offset < text.length && /[\ud800-\udbff]/u.test(text[offset - 1]) && /[\udc00-\udfff]/u.test(text[offset]));
}
function normalizeNode(node) {
  const out = { type: node.type };
  if (node.text !== undefined) out.text = node.text;
  const attrs = Object.fromEntries(Object.entries(node.attrs || {}).filter(([key, value]) => key !== KEY && value !== null && value !== undefined
    && !(node.type === 'textStyle' && key === 'color' && value === '')));
  if (Object.keys(attrs).length) out.attrs = attrs;
  if (node.marks?.length) out.marks = node.marks.map(normalizeNode).sort((a, b) => a.type.localeCompare(b.type));
  if (node.content?.length) {
    out.content = [];
    for (const child of node.content) {
      const next = normalizeNode(child), previous = out.content.at(-1);
      if (previous?.type === 'text' && next.type === 'text' && JSON.stringify(previous.marks || []) === JSON.stringify(next.marks || [])) previous.text += next.text;
      else out.content.push(next);
    }
  }
  return out;
}
// One paragraph occurrence order for text revisions, independent of repeated
// text, list nesting and table coordinates. Returns references into this doc.
function paragraphs(doc) {
  require('./word-list-numbering-v1.cjs').resolve(doc);
  assert(exact(doc, ['type', 'content','attrs']) && (!doc.attrs||exact(doc.attrs,['wordDefaultTabStop','wordSections'])) && doc.type === 'doc' && Array.isArray(doc.content) && doc.content.length > 0 && doc.content.length <= 10000);
  if(doc.attrs?.wordSections!=null)require('./word-sections-v1.cjs').read(doc);
  if(doc.attrs?.wordDefaultTabStop!=null)require('./word-paragraph-layout-v1.cjs').normalizeWordDefaultTabStop(doc.attrs.wordDefaultTabStop);
  const result = []; let lists = 0;
  const visit = (node, depth = 0, inCell = false) => {
    assert(exact(node, ['type', 'attrs', 'content']));
    if (['paragraph', 'heading', 'codeBlock'].includes(node.type)) {
      assert(result.length < 10000, 'PENDING_REVISIONS_BUDGET'); result.push(node); return;
    }
    if (node.type === 'blockquote') {
      assert(depth < 8 && (!node.attrs || exact(node.attrs, [])) && Array.isArray(node.content) && node.content.length > 0);
      for (const child of node.content) visit(child, depth + 1, inCell);
      return;
    }
    if (node.type === 'table') {
      let layout;
      try { layout = inspectTable(node); } catch (error) { fail(`PENDING_REVISIONS_${error.message}`); }
      for (const row of node.content) assert(exact(row, ['type', 'attrs', 'content']));
      for (const cell of layout.cells) {
        assert(exact(cell.node, ['type', 'attrs', 'content']));
        for (const child of cell.node.content) visit(child, 0, true);
      }
      return;
    }
    assert(['bulletList', 'orderedList'].includes(node.type), 'PENDING_REVISIONS_BLOCK_UNSUPPORTED');
    assert(depth <= 8 && ++lists <= 2048, 'PENDING_REVISIONS_BUDGET');
    assert(Array.isArray(node.content) && node.content.length > 0);
    assert(!node.attrs || exact(node.attrs, node.type === 'orderedList' ? ['start', 'type', 'wordListId', 'wordListStart', 'wordNumbering'] : []));
    const start = node.attrs?.start ?? 1;
    assert(Number.isSafeInteger(start) && start >= 0 && start + node.content.length - 1 <= 2147483647
      && (node.attrs?.type == null || ['1', 'I', 'i', 'A', 'a'].includes(node.attrs.type)));
    for (const item of node.content) {
      assert(exact(item, ['type', 'attrs', 'content']) && item.type === 'listItem'
        && (!item.attrs || exact(item.attrs, [])) && Array.isArray(item.content)
        && ['paragraph', 'heading'].includes(item.content[0]?.type)
        && item.content.slice(1).every(n => ['paragraph', 'heading', 'bulletList', 'orderedList'].includes(n?.type)));
      visit(item.content[0], depth, inCell);
      for (const child of item.content.slice(1)) visit(child, depth + 1, inCell);
    }
  };
  for (const node of doc.content) visit(node);
  return result;
}
function tableRows(doc) {
  const indexes = new Map(paragraphs(doc).map((p, i) => [p, i]));
  const rows = []; let tableIndex = 0;
  for (const table of doc.content.filter(n => n.type === 'table')) {
    table.content.forEach((node, rowIndex) => {
      const leaves = [];
      const visit = n => { if (indexes.has(n)) leaves.push(n); else for (const child of n.content || []) visit(child); };
      visit(node);
      rows.push({ node, table, tableIndex, rowIndex, paragraphIndex: indexes.get(leaves[0]), paragraphCount: leaves.length });
    });
    tableIndex++;
  }
  return rows;
}
function projectTableRows(doc, ledger, mode) {
  const rows = tableRows(doc);
  for (const table of doc.content.filter(n => n.type === 'table')) {
    table.content = table.content.filter(node => {
      const owner = rows.find(row => row.node === node);
      const revision = ledger.revisions.find(r => isTableRow(r) && r.structure.tableIndex === owner.tableIndex && r.structure.rowIndex === owner.rowIndex);
      return !revision || mode === 'export' && revision.state === 'pending' || includeRevision(revision, mode === 'export' ? 'current' : mode);
    });
  }
  doc.content = doc.content.filter(node => node.type !== 'table' || node.content.length);
  if (!doc.content.length) doc.content.push({ type: 'paragraph', content: [] });
  paragraphs(doc); return doc;
}
function paragraphSibling(doc, wanted) {
  let found = null;
  const visit = node => {
    const children = node.content || [], index = children.indexOf(wanted);
    if (index >= 0) { const next = children[index + 1]; found = ['paragraph', 'heading'].includes(next?.type) ? next : null; return; }
    for (const child of children) if (!['paragraph', 'heading'].includes(child.type)) visit(child);
  };
  visit(doc); return found;
}
// Source occurrence indexes remain attached to the following paragraph while
// previous content is merged into it; properties belong to its surviving mark.
function collapseParagraphBoundaries(doc, remove, onMerge = () => {}) {
  const indexes = new Map(paragraphs(doc).map((p, i) => [p, i]));
  const visit = node => {
    const children = node.content || [];
    for (let i = 0; i < children.length; i++) {
      const p = children[i];
      if (!indexes.has(p)) { visit(p); continue; }
      if (!remove(indexes.get(p))) continue;
      const next = children[i + 1];
      assert(indexes.has(next), 'PENDING_PARAGRAPH_BOUNDARY_OWNER');
      onMerge(p, next);
      next.content = [...(p.content || []), ...(next.content || [])]; children.splice(i--, 1);
    }
  };
  visit(doc); return doc;
}
function exportDocument(ledger) {
  validateLedger(ledger);
  const doc = clone(ledger.source), records = new Map(), rows = tableRows(doc);
  paragraphs(doc).forEach((p, i) => {
    const segments = paragraphSegments(ledger, p, i, 'export');
    const format = ledger.revisions.find(r => r.paragraphIndex === i && isParagraphFormat(r));
    const boundary = ledger.revisions.find(r => r.paragraphIndex === i && isParagraphBoundary(r));
    if (format) {
      const properties = format.format[format.state === 'rejected' ? 'before' : 'after'];
      p.type = properties.type; delete p.attrs; if (properties.attrs) p.attrs = clone(properties.attrs);
    }
    p.content = segments.map(s => s.node);
    const row = rows.find(row => i >= row.paragraphIndex && i < row.paragraphIndex + row.paragraphCount);
    const rowRevision = row && ledger.revisions.find(r => isTableRow(r) && r.structure.tableIndex === row.tableIndex && r.structure.rowIndex === row.rowIndex);
    records.set(p, { segments, rowRevision: rowRevision?.state === 'pending' ? clone(rowRevision) : null, paragraphRevision: format?.state === 'pending' ? clone(format) : null,
      boundaryRevision: boundary?.state === 'pending' ? clone(boundary) : null });
  });
  collapseParagraphBoundaries(doc, index => {
    const r = ledger.revisions.find(r => r.paragraphIndex === index && isParagraphBoundary(r));
    return r && r.state !== 'pending' && !includeRevision(r, 'current');
  }, (a, b) => { records.get(b).segments = [...records.get(a).segments, ...records.get(b).segments]; });
  projectTableRows(doc, ledger, 'export');
  return { doc, paragraphs: paragraphs(doc).map(p => records.get(p) || { segments: [], paragraphRevision: null, boundaryRevision: null, rowRevision: null }) };
}
function validateSource(doc) {
  spacing.inspectDocumentParagraphSpacing(doc);
  require('./word-paragraph-layout-v1.cjs').inspectDocumentParagraphLayout(doc);
  language.inspectDocumentLanguage(doc);
  require('../io/inlineTypography.cjs').inspectParagraphMarkTypography(doc);
  for (const p of paragraphs(doc)) {
    assert(exact(p, ['type', 'attrs', 'content']) && ['paragraph', 'heading', 'codeBlock'].includes(p.type));
    assert(!p.attrs || (exact(p.attrs, ['textAlign', 'level', 'wordParagraphSpacing', 'wordParagraphMarkLanguage','wordParagraphMarkTypography','wordParagraphIndent','wordParagraphTabs', ...(p.type === 'codeBlock' ? ['language'] : [])])
      && (!p.attrs.textAlign || ['left', 'center', 'right', 'justify'].includes(p.attrs.textAlign))
      && (p.type !== 'heading' ? p.attrs.level === undefined : Number.isInteger(p.attrs.level) && p.attrs.level >= 1 && p.attrs.level <= 9)
      && (p.attrs.language == null || p.type === 'codeBlock' && typeof p.attrs.language === 'string' && p.attrs.language.length <= 128 && !/[\x00-\x1f<>]/u.test(p.attrs.language))));
    assert(p.content === undefined || Array.isArray(p.content));
    for (const n of p.content || []) {
      assert(exact(n, ['type', 'text', 'marks', ...(n.type === 'hardBreak' ? ['attrs'] : [])]) && ['text', 'hardBreak'].includes(n.type));
      if (n.type === 'hardBreak' && n.attrs != null) require('./word-typed-breaks-v1.cjs').kind(n);
      assert(n.type === 'text' ? typeof n.text === 'string' && n.text.length > 0 : n.text === undefined);
      assert(n.marks === undefined || Array.isArray(n.marks) && n.marks.length <= 8);
      const seen = new Set();
      for (const mark of n.marks || []) {
        assert(exact(mark, ['type', 'attrs']) && !seen.has(mark.type)); seen.add(mark.type);
        if (['bold', 'italic', 'underline', 'strike'].includes(mark.type)) assert(!mark.attrs || !Object.keys(mark.attrs).length);
        else if (mark.type === 'textStyle') {
          assert(exact(mark.attrs, ['fontFamily', 'fontSize', 'color', 'wordLanguage']));
          for (const [key, value] of Object.entries(mark.attrs)) {
            if (key === 'wordLanguage') { language.normalizeWordLanguage(value); continue; }
            assert(typeof value === 'string' && value.length <= 128 && !/[\x00-\x1f<>]/u.test(value));
            if (key === 'color') assert(/^#[a-f0-9]{6}$/u.test(value));
            if (key === 'fontSize') assert(/^\d+(?:\.5)?pt$/u.test(value) && parseFloat(value) > 0 && parseFloat(value) <= 1638);
          }
        } else if (mark.type === 'link') {
          assert(exact(mark.attrs, ['href', 'target', 'rel', 'class']) && typeof mark.attrs.href === 'string');
          try { require('../io/docxHyperlinks.cjs').normalizeDocxHttpHref(mark.attrs.href); } catch { fail('PENDING_REVISIONS_MARK_UNSUPPORTED'); }
          assert((mark.attrs.target == null || mark.attrs.target === '_blank') && (mark.attrs.rel == null || mark.attrs.rel === 'noopener noreferrer nofollow' || mark.attrs.rel === 'noopener noreferrer') && mark.attrs.class == null);
        } else if (mark.type === 'highlight') assert(exact(mark.attrs, ['color']) && /^#[a-f0-9]{6}$/u.test(mark.attrs.color));
        else fail('PENDING_REVISIONS_MARK_UNSUPPORTED');
      }
    }
  }
}
// Check data descriptors before the byte-budget JSON serialization, including
// dormant before/after and history frames. Never invoke payload getters/toJSON.
function inspectLedgerData(input) {
  const pending = [{ value: input, depth: 0 }], ancestors = new Set(); let count = 0;
  while (pending.length) {
    const { value, depth, exit } = pending.pop();
    if (exit) { ancestors.delete(value); continue; }
    assert(++count <= 1000000, 'PENDING_REVISIONS_DATA_INVALID');
    if (value === null || ['string', 'number', 'boolean', 'undefined'].includes(typeof value)) continue;
    assert(typeof value === 'object' && depth <= 256 && !ancestors.has(value), 'PENDING_REVISIONS_DATA_INVALID');
    const prototype = Object.getPrototypeOf(value);
    const constructor = prototype && Object.getOwnPropertyDescriptor(prototype, 'constructor');
    const array = Array.isArray(value);
    assert(!array || value.length <= 1000000, 'PENDING_REVISIONS_DATA_INVALID');
    const nativeArrayPrototype = array && (prototype === Array.prototype
      || (Array.isArray(prototype) && typeof constructor?.value === 'function'
        && constructor.value.prototype === prototype
        && Function.prototype.toString.call(constructor.value) === Function.prototype.toString.call(Array)
        && Object.getPrototypeOf(Object.getPrototypeOf(prototype)) === null));
    assert(array ? nativeArrayPrototype : prototype === null || prototype === Object.prototype
      || (Object.getPrototypeOf(prototype) === null && typeof constructor?.value === 'function'
        && constructor.value.prototype === prototype
        && Function.prototype.toString.call(constructor.value) === Function.prototype.toString.call(Object)), 'PENDING_REVISIONS_DATA_INVALID');
    for (let parent = prototype; parent; parent = Object.getPrototypeOf(parent)) {
      assert(!Object.getOwnPropertyDescriptor(parent, 'toJSON'), 'PENDING_REVISIONS_DATA_INVALID');
    }
    ancestors.add(value); pending.push({ value, exit: true });
    const keys = Reflect.ownKeys(value);
    assert(keys.length + pending.length + count <= 1000000, 'PENDING_REVISIONS_DATA_INVALID');
    for (const key of keys) {
      if (Array.isArray(value) && key === 'length') continue;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      assert(typeof key === 'string' && descriptor.enumerable && Object.hasOwn(descriptor, 'value'), 'PENDING_REVISIONS_DATA_INVALID');
      pending.push({ value: descriptor.value, depth: depth + 1 });
    }
  }
  return count;
}
function validateState(input, frame = false) {
  if (!frame) inspectLedgerData(input);
  assert(object(input) && new TextEncoder().encode(JSON.stringify(input)).length <= MAX_BYTES, 'PENDING_REVISIONS_BUDGET');
  const baseKeys = ['schemaVersion', 'source', 'revisions', 'undo', 'redo', ...(input.schemaVersion === 3 ? ['noteSourcePoints'] : [])];
  assert([1, 2, 3].includes(input.schemaVersion));
  assert(exact(input, input.schemaVersion >= 2 && !frame ? [...baseKeys, 'roundUndo', 'roundRedo', 'returnReceipts'] : baseKeys));
  validateSource(input.source);
  const sourceParagraphs = paragraphs(input.source);
  assert(Array.isArray(input.revisions) && input.revisions.length >= (input.schemaVersion === 1 ? 1 : 0) && input.revisions.length <= 1024);
  // Row ledgers still address root tables only. Never reinterpret a nested
  // XML table ordinal as another root table's row.
  if (input.revisions.some(isTableRow)) {
    const nested = node => (node.content || []).some(child => child.type === 'table' || nested(child));
    assert(!input.source.content.some(node => node.type === 'table' && nested(node)), 'PENDING_NESTED_TABLE_ROW_UNSUPPORTED');
  }
  const ids = new Set(), groups = new Map(), occupied = new Map(), paragraphFormats = new Set(), boundaries = new Set();
  let previousParagraph = -1, previousFrom = 0;
  for (const r of input.revisions) {
    assert(exact(r, ['id', 'nativeId', 'operation', 'author', 'date', 'dateUtc', 'groupId', 'paragraphIndex', 'from', 'to', 'state', 'moveName', 'format', 'boundary', 'structure']));
    assert(/^revision-[1-9]\d{0,3}$/u.test(r.id) && !ids.has(r.id)); ids.add(r.id);
    assert(typeof r.nativeId === 'string' && r.nativeId.length <= 80 && typeof r.author === 'string' && r.author.length <= 1024);
    assert(typeof r.date === 'string' && r.date.length <= 80 && typeof r.dateUtc === 'string' && r.dateUtc.length <= 80);
    assert(![r.nativeId, r.author, r.date, r.dateUtc].some(value => /[\x00-\x08\x0b\x0c\x0e-\x1f]/u.test(value)));
    assert(['insert', 'delete', 'format'].includes(r.operation) && status(r.state));
    assert(Number.isInteger(r.paragraphIndex) && r.paragraphIndex >= 0 && r.paragraphIndex >= previousParagraph && r.paragraphIndex < sourceParagraphs.length);
    const p = sourceParagraphs[r.paragraphIndex], text = (p.content || []).map(textOf).join('');
    assert(safeBoundary(text, r.from) && safeBoundary(text, r.to)
      && (isTableRow(r) ? r.from === 0 && r.to === 0 : isParagraphBoundary(r) ? r.from === text.length && r.to === text.length
        : isParagraphFormat(r) ? r.from === 0 && r.to === text.length : r.to > r.from)
      && (r.paragraphIndex !== previousParagraph || r.from >= previousFrom));
    previousParagraph = r.paragraphIndex; previousFrom = r.from;
    if (isTableRow(r)) {
      assert(exact(r.structure, ['kind', 'tableIndex', 'rowIndex']) && ['insert', 'delete'].includes(r.operation)
        && r.groupId === null && r.moveName === undefined && r.format === undefined && r.boundary === undefined,
        'PENDING_TABLE_ROW_INVALID');
      const rows = tableRows(input.source), owner = rows.find(row => row.tableIndex === r.structure.tableIndex && row.rowIndex === r.structure.rowIndex);
      assert(owner && owner.paragraphIndex === r.paragraphIndex && owner.paragraphCount > 0, 'PENDING_TABLE_ROW_OWNER');
      assert(owner.table.content.every(row => row.content.every(cell => (cell.attrs?.rowspan || 1) === 1)), 'PENDING_TABLE_ROW_VERTICAL_MERGE_UNSUPPORTED');
      assert(!input.revisions.some(other => other !== r && other.paragraphIndex >= owner.paragraphIndex
        && other.paragraphIndex < owner.paragraphIndex + owner.paragraphCount), 'PENDING_TABLE_ROW_OVERLAP');
    } else assert(r.structure === undefined, 'PENDING_TABLE_ROW_INVALID');
    if (isParagraphBoundary(r)) {
      assert(['insert', 'delete'].includes(r.operation) && r.groupId === null && r.moveName === undefined && r.format === undefined
        && !boundaries.has(r.paragraphIndex), 'PENDING_PARAGRAPH_BOUNDARY_INVALID');
      const sibling = paragraphSibling(input.source, p);
      assert(sibling && sibling === sourceParagraphs[r.paragraphIndex + 1], 'PENDING_PARAGRAPH_BOUNDARY_OWNER');
      boundaries.add(r.paragraphIndex);
    } else {
      assert(r.boundary === undefined, 'PENDING_PARAGRAPH_BOUNDARY_INVALID');
    }
    if (isParagraphFormat(r)) {
      assert(!paragraphFormats.has(r.paragraphIndex), 'PENDING_FORMAT_OVERLAP'); paragraphFormats.add(r.paragraphIndex);
    } else if (!isStructural(r)) {
      const spans = occupied.get(r.paragraphIndex) || [];
      assert(!spans.some(s => r.from < s.to && r.to > s.from), 'PENDING_FORMAT_OVERLAP');
      spans.push(r); occupied.set(r.paragraphIndex, spans);
    }
    assert(r.groupId === null || /^group-[1-9]\d{0,3}$/u.test(r.groupId));
    if (r.operation === 'format') {
      assert(r.groupId === null && r.moveName === undefined && exact(r.format, ['kind', 'before', 'after'])
        && ['run', 'paragraph'].includes(r.format.kind), 'PENDING_FORMAT_INVALID');
      const p = sourceParagraphs[r.paragraphIndex];
      if (r.format.kind === 'run') {
        for (const marks of [r.format.before, r.format.after]) {
          assert(Array.isArray(marks), 'PENDING_FORMAT_INVALID');
          validateSource({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x', marks }] }] });
        }
        let offset = 0;
        for (const n of p.content || []) {
          const end = offset + textOf(n).length;
          if (n.type === 'text' && r.from < end && r.to > offset)
            assert(stable(n.marks || []) === stable(r.format.after), 'PENDING_FORMAT_SOURCE_MISMATCH');
          offset = end;
        }
      } else {
        for (const properties of [r.format.before, r.format.after]) {
          assert(exact(properties, ['type', 'attrs']), 'PENDING_FORMAT_INVALID');
          validateSource({ type: 'doc', content: [{ ...properties, content: [] }] });
        }
        assert(stable(paragraphProperties(p)) === stable(r.format.after), 'PENDING_FORMAT_SOURCE_MISMATCH');
      }
      assert(stable(r.format.before) !== stable(r.format.after), 'PENDING_FORMAT_NO_CHANGE');
    } else assert(r.format === undefined, 'PENDING_FORMAT_INVALID');
    if (r.moveName !== undefined) assert(typeof r.moveName === 'string' && r.moveName.length > 0 && r.moveName.length <= 255
      && !/[\s\x00-\x1f\x7f]/u.test(r.moveName) && r.groupId !== null, 'PENDING_MOVE_NAME_INVALID');
    if (r.groupId) { const group = groups.get(r.groupId) || []; group.push(r); groups.set(r.groupId, group); }
  }
  const moveNames = new Set();
  for (const group of groups.values()) {
    assert(group.length === 2 && group[0].operation !== group[1].operation
      && group[0].author === group[1].author && group[0].state === group[1].state, 'PENDING_REVISIONS_GROUP_INVALID');
    if (group.some(r => r.moveName !== undefined)) {
      assert(group[0].moveName && group[0].moveName === group[1].moveName
        && !moveNames.has(group[0].moveName), 'PENDING_MOVE_PAIR_INVALID');
      moveNames.add(group[0].moveName);
    } else assert(group[0].paragraphIndex === group[1].paragraphIndex && group[0].to === group[1].from, 'PENDING_REVISIONS_GROUP_INVALID');
  }
  for (const history of [input.undo, input.redo]) {
    assert(Array.isArray(history) && history.length <= 128, 'PENDING_REVISIONS_HISTORY_BUDGET');
    for (const row of history) {
      assert(Array.isArray(row) && row.length === input.revisions.length && row.every(status));
      for (const group of groups.values()) assert(row[input.revisions.indexOf(group[0])] === row[input.revisions.indexOf(group[1])]);
    }
  }
  if (input.schemaVersion === 3) {
    assert(Array.isArray(input.noteSourcePoints) && input.noteSourcePoints.length > 0 && input.noteSourcePoints.length <= 256, 'PENDING_NOTE_POINTS_INVALID');
    assert(input.revisions.every(r => ['insert', 'delete'].includes(r.operation) && !isStructural(r) && !r.moveName), 'PENDING_NOTE_REVISION_UNSUPPORTED');
    const noteIds = new Set();
    for (const point of input.noteSourcePoints) {
      assert(exact(point, ['noteId', 'paragraphIndex', 'offsetUtf16']) && typeof point.noteId === 'string'
        && /^[A-Za-z0-9._:-]{1,128}$/u.test(point.noteId) && !noteIds.has(point.noteId), 'PENDING_NOTE_POINTS_INVALID');
      noteIds.add(point.noteId);
      projectSourcePoint(input, point);
    }
  }
  if (input.schemaVersion >= 2 && !frame) {
    let historyWork=0;
    const initialFingerprint=[...(input.roundUndo||[]),...(input.roundRedo||[])].some(f=>f?.schemaVersion===4)?sourceFingerprint(input.source):null;
    for (const rounds of [input.roundUndo, input.roundRedo]) {
      assert(Array.isArray(rounds) && rounds.length <= 128, 'PENDING_REVISIONS_HISTORY_BUDGET');
      let base=input.source;const context={fingerprint:initialFingerprint};
      for (let i=rounds.length-1;i>=0;i--) {
        const previous=decodeRoundFrame(rounds[i],base,context);
        historyWork+=inspectLedgerData(previous);assert(historyWork<=1000000,'PENDING_REVISIONS_DATA_INVALID');
        validateState(previous,true);base=previous.source;
      }
    }
    assert(Array.isArray(input.returnReceipts) && input.returnReceipts.length <= 128, 'PENDING_REVISIONS_HISTORY_BUDGET');
    const receipts = new Set();
    for (const receipt of input.returnReceipts) {
      assert(exact(receipt, ['roundId', 'artifactSha256']) && typeof receipt.roundId === 'string'
        && receipt.roundId.length > 0 && receipt.roundId.length <= 200 && !/[\x00-\x1f]/u.test(receipt.roundId)
        && /^[a-f0-9]{64}$/u.test(receipt.artifactSha256), 'PENDING_RETURN_RECEIPT_INVALID');
      const key = receipt.roundId + ':' + receipt.artifactSha256;
      assert(!receipts.has(key), 'PENDING_RETURN_RECEIPT_INVALID'); receipts.add(key);
    }
  }
  return input;
}
// A point belongs to the union source occurrence, never to ambiguous Current
// text. Endpoints remain distinct even when a hidden deletion collapses them.
function projectSourcePoint(ledger, point, mode = 'current') {
  assert(['current', 'original', 'export'].includes(mode), 'PENDING_NOTE_POINT_MODE');
  const leaves = paragraphs(ledger.source), p = leaves[point?.paragraphIndex];
  assert(Number.isSafeInteger(point?.paragraphIndex) && point.paragraphIndex >= 0 && p
    && safeBoundary((p.content || []).map(textOf).join(''), point.offsetUtf16), 'PENDING_NOTE_POINT_BOUNDARY');
  assert(ledger.revisions.every(r => ['insert', 'delete'].includes(r.operation) && !isStructural(r) && !r.moveName), 'PENDING_NOTE_REVISION_UNSUPPORTED');
  let offsetUtf16 = point.offsetUtf16;
  for (const r of ledger.revisions) {
    if (r.paragraphIndex !== point.paragraphIndex) continue;
    assert(!(r.from < point.offsetUtf16 && point.offsetUtf16 < r.to), 'PENDING_NOTE_REFERENCE_CONSUMED');
    const included = mode === 'export' && r.state === 'pending' || includeRevision(r, mode === 'export' ? 'current' : mode);
    if (!included && r.to <= point.offsetUtf16) offsetUtf16 -= r.to - r.from;
  }
  let globalOffsetUtf16 = offsetUtf16;
  for (let i = 0; i < point.paragraphIndex; i++)
    globalOffsetUtf16 += paragraphSegments(ledger, leaves[i], i, mode).reduce((n, segment) => n + textOf(segment.node).length, 0) + 1;
  return { paragraphIndex: point.paragraphIndex, offsetUtf16, globalOffsetUtf16 };
}
function exportNoteBasis(ledger) {
  validateLedger(ledger);
  assert(!ledger.revisions.some(r => !['insert', 'delete'].includes(r.operation) || isStructural(r) || r.moveName), 'PENDING_NOTE_REVISION_UNSUPPORTED');
  const exported = exportDocument(ledger), revisions = [];
  exported.paragraphs.forEach((paragraph, paragraphIndex) => {
    let offset = 0;
    for (const segment of paragraph.segments) {
      const end = offset + textOf(segment.node).length;
      if (segment.revision) {
        const last = revisions.at(-1);
        if (last?.id === segment.revision.id) last.to = end;
        else revisions.push({ ...clone(segment.revision), paragraphIndex, from: offset, to: end });
      }
      offset = end;
    }
  });
  return validateLedger({ schemaVersion: 2, source: exported.doc, revisions, undo: [], redo: [], roundUndo: [], roundRedo: [], returnReceipts: [] });
}
function bindNoteSourcePoints(doc, points) {
  const ledger = asRoundLedger(doc);
  return bindLedger({ ...ledger, schemaVersion: 3, noteSourcePoints: clone(points) });
}
function noteProjection(doc, mode = 'current') {
  const ledger = readLedger(doc);
  if (ledger?.schemaVersion !== 3) return null;
  return ledger.noteSourcePoints.map(point => ({ noteId: point.noteId, ...projectSourcePoint(ledger, point, mode) }));
}
function validateLedger(input) { return validateState(input); }
function roundFrame(ledger) {
  return clone(Object.fromEntries(['schemaVersion', 'source', 'revisions', 'undo', 'redo', ...(ledger.schemaVersion === 3 ? ['noteSourcePoints'] : [])].map(key => [key, ledger[key]])));
}
// A round stores the prior rich paragraphs relative to the immediately newer
// source. Identity remains the reconstructed canonical frame, never its codec.
const digestSourcePart=value=>require('./browser-safe-hash.cjs').sha256UpdateCompatible(stable(value));
// Version 1 hashes a closed tree fingerprint: exact ancestor topology and every
// complete rich paragraph. Only this synchronous stack walk reuses its hashes.
function sourceFingerprint(source) {
  return finishFingerprint({topology:sourceTopology(source),paragraphDigests:paragraphs(source).map(paragraphSourceDigest)});
}
function paragraphSourceDigest(paragraph){return digestSourcePart({domain:'yalken.pending-round-paragraph.v1',paragraph});}
function finishFingerprint(parts) {return {...parts,hash:digestSourcePart({domain:'yalken.pending-round-source.v1',...parts})};}

function sourceTopology(source) {
  const leaves=new Set(paragraphs(source));
  const visit=node=>leaves.has(node)?{paragraph:true}:Object.fromEntries(Object.entries(node).map(([key,value])=>[key,key==='content'?value.map(visit):value]));
  return stable(visit(source));
}
function decodeRoundFrame(frame,base,context) {
  if(frame?.schemaVersion!==4){if(context)context.fingerprint=null;return frame;}
  assert(exact(frame,['schemaVersion','restoredSchemaVersion','sourceDelta','revisions','undo','redo','noteSourcePoints'])
    && [1,2,3].includes(frame.restoredSchemaVersion),'PENDING_ROUND_DELTA_INVALID');
  const delta=frame.sourceDelta;
  assert(exact(delta,['schemaVersion','baseSourceSha256','targetSourceSha256','replacements']) && delta.schemaVersion===1
    && /^[a-f0-9]{64}$/u.test(delta.baseSourceSha256) && /^[a-f0-9]{64}$/u.test(delta.targetSourceSha256)
    && Array.isArray(delta.replacements) && delta.replacements.length<=10000,'PENDING_ROUND_DELTA_INVALID');
  const fingerprint=context?.fingerprint||sourceFingerprint(base),paragraphDigests=fingerprint.paragraphDigests.slice();
  assert(fingerprint.hash===delta.baseSourceSha256,'PENDING_ROUND_DELTA_BASE_MISMATCH');
  const source=clone(base),rows=paragraphs(source);let previous=-1;
  for(const replacement of delta.replacements) {
    assert(exact(replacement,['paragraphIndex','previousParagraph']) && Number.isSafeInteger(replacement.paragraphIndex)
      && replacement.paragraphIndex>previous && replacement.paragraphIndex<rows.length,'PENDING_ROUND_DELTA_INDEX_INVALID');
    previous=replacement.paragraphIndex;
    paragraphDigests[previous]=paragraphSourceDigest(replacement.previousParagraph);
    assert(['paragraph','heading','codeBlock'].includes(replacement.previousParagraph?.type),'PENDING_ROUND_DELTA_TOPOLOGY_INVALID');
    validateSource({type:'doc',content:[replacement.previousParagraph]});
    const row=rows[previous];for(const key of Object.keys(row))delete row[key];Object.assign(row,clone(replacement.previousParagraph));
  }
  const nextFingerprint=finishFingerprint({topology:fingerprint.topology,paragraphDigests});
  assert(nextFingerprint.hash===delta.targetSourceSha256,'PENDING_ROUND_DELTA_TARGET_MISMATCH');
  if(context)context.fingerprint=nextFingerprint;
  const {sourceDelta,restoredSchemaVersion,...metadata}=frame;
  return {...metadata,schemaVersion:restoredSchemaVersion,source};
}
function encodeRoundFrame(frame,base,baseFingerprint,targetFingerprint) {
  // Small existing histories retain their representation. Large same-topology
  // sources use the reversible delta; structural changes keep full frames.
  if(new TextEncoder().encode(JSON.stringify(frame.source)).length<65536)return clone(frame);
  baseFingerprint ||= sourceFingerprint(base);targetFingerprint ||= sourceFingerprint(frame.source);
  if(baseFingerprint.topology!==targetFingerprint.topology)return clone(frame);
  const current=paragraphs(base),prior=paragraphs(frame.source),replacements=[];
  for(let i=0;i<current.length;i++)if(stable(current[i])!==stable(prior[i]))replacements.push({paragraphIndex:i,previousParagraph:clone(prior[i])});
  const {source,schemaVersion,...metadata}=frame;
  const compact={schemaVersion:4,restoredSchemaVersion:schemaVersion,...clone(metadata),sourceDelta:{schemaVersion:1,
    baseSourceSha256:baseFingerprint.hash,targetSourceSha256:targetFingerprint.hash,replacements}};
  return JSON.stringify(compact).length<JSON.stringify(frame).length?compact:clone(frame);
}
function compactRoundHistory(ledger) {
  for(const key of ['roundUndo','roundRedo']) {
    if(!ledger[key])continue;
    let base=ledger.source;const rounds=ledger[key].slice(),context={fingerprint:null};
    for(let i=rounds.length-1;i>=0;i--) {
      const baseFingerprint=context.fingerprint;const full=decodeRoundFrame(rounds[i],base,context);validateState(full,true);
      rounds[i]=encodeRoundFrame(full,base,baseFingerprint,context.fingerprint);base=full.source;
    }
    ledger[key]=rounds;
  }
  return ledger;
}
function lastRoundFrame(ledger,key='roundUndo') {
  const frame=ledger?.[key]?.at(-1);return frame?decodeRoundFrame(frame,ledger.source):null;
}
function revisionMeaning(sourceParagraphs, revision, paragraphIndex = revision.paragraphIndex) {
  // A paragraph property's identity covers the paragraph, not its changing text.
  const text = isTableRow(revision) ? 'TABLE_ROW' : isParagraphBoundary(revision) ? '\n' : isParagraphFormat(revision) ? null : (sourceParagraphs[revision.paragraphIndex].content || []).map(textOf).join('').slice(revision.from, revision.to);
  // Word preserves dateUtc to seconds, while rewriting legacy date at minute
  // precision. Keep raw provenance, but use the authoritative UTC timestamp at
  // Word's supported precision when matching an already-owned revision.
  const date = revision.dateUtc || revision.date;
  const time = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/u.test(date) && Number.isFinite(Date.parse(date))
    ? Math.floor(Date.parse(date) / 1000) : [revision.date, revision.dateUtc];
  return stable([paragraphIndex, revision.operation, revision.author, time, text, Boolean(revision.moveName), revision.format || null]);
}
function preserveReturnedIdentities(before, proposed, paragraphBindings) {
  if (paragraphBindings !== undefined) {
    const rows = tableRows(proposed.source), known = Array.isArray(paragraphBindings) ? paragraphBindings.filter(v => v !== null) : [];
    assert(Array.isArray(paragraphBindings) && paragraphBindings.length === paragraphs(proposed.source).length
      && known.length > 0 && known.every((v, i) => Number.isSafeInteger(v) && v >= 0
        && (i === 0 ? v === 0 : v === known[i - 1] || v === known[i - 1] + 1))
      && known.at(-1) === paragraphs(before.source).length - 1, 'PENDING_RETURN_PARAGRAPH_BINDING_INVALID');
    paragraphBindings.forEach((v, i) => {
      if (v !== null) return;
      const row = rows.find(row => i >= row.paragraphIndex && i < row.paragraphIndex + row.paragraphCount);
      assert(row && proposed.revisions.some(r => isTableRow(r) && r.operation === 'insert' && r.paragraphIndex === row.paragraphIndex)
        && paragraphBindings.slice(row.paragraphIndex, row.paragraphIndex + row.paragraphCount).every(v => v === null),
        'PENDING_RETURN_TABLE_ROW_BINDING_INVALID');
    });
  }
  const incomingMeaning = (source, revision) => paragraphBindings?.[revision.paragraphIndex] === null
    ? `new-row:${revision.id}` : revisionMeaning(source, revision, paragraphBindings?.[revision.paragraphIndex]);
  const occurrences = new Map(), oldById = new Map(before.revisions.map(r => [r.id, r]));
  const oldParagraphs = paragraphs(before.source), newParagraphs = paragraphs(proposed.source);
  let nextRevision = 1, nextGroup = 1;
  // A clean returned source may have no current revisions. Older and undone
  // rounds still own their IDs; a new revision cannot impersonate that history.
  for (const frame of [before, ...(before.roundUndo || []), ...(before.roundRedo || [])]) {
    for (const revision of frame.revisions) {
      nextRevision = Math.max(nextRevision, Number(revision.id.slice(9)) + 1);
      nextGroup = Math.max(nextGroup, Number(revision.groupId?.slice(6) || 0) + 1);
    }
  }
  for (const revision of before.revisions.filter(r => r.state === 'pending')) {
    const key = revisionMeaning(oldParagraphs, revision), rows = occurrences.get(key) || [];
    rows.push(revision); occurrences.set(key, rows);
  }
  const incomingCounts = new Map();
  for (const revision of proposed.revisions) {
    const key = incomingMeaning(newParagraphs, revision);
    incomingCounts.set(key, (incomingCounts.get(key) || 0) + 1);
  }
  for (const [key, rows] of occurrences) {
    const count = incomingCounts.get(key) || 0;
    assert(count === 0 || count === rows.length, 'PENDING_RETURN_IDENTITY_AMBIGUOUS');
  }
  const groups = new Map();
  for (const revision of proposed.revisions) {
    assert(revision.state === 'pending', 'PENDING_RETURN_STATE_INVALID');
    const previous = occurrences.get(incomingMeaning(newParagraphs, revision))?.shift();
    assert(previous || nextRevision <= 9999, 'PENDING_REVISIONS_ID_BUDGET');
    revision.id = previous?.id || `revision-${nextRevision++}`;
    if (revision.groupId) { const rows = groups.get(revision.groupId) || []; rows.push(revision); groups.set(revision.groupId, rows); }
  }
  const usedGroups = new Set();
  for (const rows of groups.values()) {
    const oldGroup = oldById.get(rows[0].id)?.groupId;
    const retained = oldGroup && rows.every(r => oldById.get(r.id)?.groupId === oldGroup) && !usedGroups.has(oldGroup);
    assert(retained || nextGroup <= 9999, 'PENDING_REVISIONS_ID_BUDGET');
    const groupId = retained ? oldGroup : `group-${nextGroup++}`;
    usedGroups.add(groupId); rows.forEach(r => { r.groupId = groupId; });
  }
}
function asRoundLedger(doc) {
  const existing = readLedger(doc);
  if (existing) return { ...clone(existing), schemaVersion: existing.schemaVersion === 3 ? 3 : 2,
    roundUndo: clone(existing.roundUndo || []), roundRedo: clone(existing.roundRedo || []), returnReceipts: clone(existing.returnReceipts || []) };
  const source = normalizeNode(doc);
  assert(source?.type === 'doc' && !source.attrs, 'PENDING_RETURN_SOURCE_UNSUPPORTED');
  paragraphs(source).forEach(p => { p.content ||= []; });
  return validateLedger({ schemaVersion: 2, source, revisions: [], undo: [], redo: [], roundUndo: [], roundRedo: [], returnReceipts: [] });
}
function replaceFromReturn(doc, returnedDoc, receipt, paragraphBindings) {
  assert(exact(receipt, ['roundId', 'artifactSha256']) && typeof receipt.roundId === 'string'
    && receipt.roundId.length > 0 && receipt.roundId.length <= 200 && !/[\x00-\x1f]/u.test(receipt.roundId)
    && /^[a-f0-9]{64}$/u.test(receipt.artifactSha256), 'PENDING_RETURN_RECEIPT_INVALID');
  const before = asRoundLedger(doc);
  const proposed = asRoundLedger(returnedDoc);
  // The caller authenticates the round. This receipt only prevents replay and
  // deliberately remains remembered across undo; it can never grant a write.
  const after = { ...proposed, undo: [], redo: [], roundUndo: before.roundUndo,
    roundRedo: [], returnReceipts: [...before.returnReceipts, clone(receipt)] };
  if (before.returnReceipts.some(r => r.roundId === receipt?.roundId && r.artifactSha256 === receipt?.artifactSha256)) {
    return { changed: false, replay: true, doc };
  }
  preserveReturnedIdentities(before, proposed, paragraphBindings);
  const previous = roundFrame(before); previous.redo = [];
  after.roundUndo.push(previous);
  return { changed: true, replay: false, doc: bindLedger(compactRoundHistory(after)) };
}
function includeRevision(revision, mode) {
  if (revision.operation === 'format') return true;
  if (mode === 'original') return revision.operation === 'delete';
  if (revision.state === 'rejected') return revision.operation === 'delete';
  return revision.operation === 'insert';
}
function segments(ledger, paragraphIndex, mode = 'current') {
  const p = paragraphs(ledger.source)[paragraphIndex];
  return paragraphSegments(ledger, p, paragraphIndex, mode);
}
function exportSegments(ledger) {
  validateLedger(ledger);
  return paragraphs(ledger.source).map((p, index) => paragraphSegments(ledger, p, index, 'export'));
}
function paragraphSegments(ledger, p, paragraphIndex, mode) {
  const changes = ledger.revisions.filter(r => r.paragraphIndex === paragraphIndex && !isParagraphFormat(r) && !isStructural(r));
  const result = []; let offset = 0;
  for (const node of p.content || []) {
    const text = textOf(node), end = offset + text.length;
    const cuts = [...new Set([offset, end, ...changes.flatMap(r => [r.from, r.to]).filter(n => n > offset && n < end)])].sort((a, b) => a - b);
    for (let i = 1; i < cuts.length; i++) {
      const from = cuts[i - 1], to = cuts[i];
      const revision = changes.find(r => r.from <= from && r.to >= to);
      if (revision && mode !== 'export' && !includeRevision(revision, mode)) continue;
      if (revision && mode === 'export' && revision.state !== 'pending' && !includeRevision(revision, 'current')) continue;
      const outputNode = node.type === 'hardBreak' ? clone(node) : { ...clone(node), text: text.slice(from - offset, to - offset) };
      if (revision?.operation === 'format' && outputNode.type === 'text') {
        const marks = revision.format[mode === 'original' || revision.state === 'rejected' ? 'before' : 'after'];
        if (marks.length) outputNode.marks = clone(marks); else delete outputNode.marks;
      }
      result.push({ node: outputNode,
        revision: mode === 'export' && revision?.state === 'pending' ? clone(revision) : null });
    }
    offset = end;
  }
  return result;
}
function materialize(input, mode = 'current') {
  return materializeValidated(validateLedger(input),mode);
}
// Private, synchronous reuse only. Public callers always revalidate mutable data.
function materializeValidated(ledger,mode='current') {
  assert(['current', 'original'].includes(mode));
  const doc = clone(ledger.source);
  const sourceParagraphs = paragraphs(ledger.source);
  paragraphs(doc).forEach((p, i) => {
    p.content = paragraphSegments(ledger, sourceParagraphs[i], i, mode).map(s => s.node);
    const revision = ledger.revisions.find(r => r.paragraphIndex === i && isParagraphFormat(r));
    if (revision) {
      const properties = revision.format[mode === 'original' || revision.state === 'rejected' ? 'before' : 'after'];
      p.type = properties.type; delete p.attrs;
      if (properties.attrs) p.attrs = clone(properties.attrs);
    }
  });
  collapseParagraphBoundaries(doc, index => {
    const revision = ledger.revisions.find(r => r.paragraphIndex === index && isParagraphBoundary(r));
    return revision && !includeRevision(revision, mode);
  });
  return projectTableRows(doc, ledger, mode);
}
function bindLedger(input) {
  const ledger = clone(validateLedger(input));
  const materialized=materializeValidated(ledger);
  return { ...materialized, attrs: { ...materialized.attrs,[KEY]: ledger } };
}
function readLedger(doc) {
  const ledger = doc?.attrs?.[KEY];
  if (ledger === undefined || ledger === null) return null;
  validateLedger(ledger);
  assert(stable(normalizeNode(doc)) === stable(normalizeNode(materializeValidated(ledger))), 'PENDING_REVISIONS_PROJECTION_MISMATCH');
  return ledger;
}
function setDefaultTabStop(doc,value) {
  const checked=require('./word-paragraph-layout-v1.cjs').normalizeWordDefaultTabStop(value);
  const ledger=readLedger(doc);if(!ledger)return {...clone(doc),attrs:{...clone(doc.attrs||{}),wordDefaultTabStop:checked}};
  const next=clone(ledger),original=ledger.source;
  const rewrite=source=>{const copied=clone(source);copied.attrs={...copied.attrs,wordDefaultTabStop:checked};return copied;};
  for(const key of ['roundUndo','roundRedo']) {
    if(!next[key])continue;
    let base=original,newBase=rewrite(original);
    for(let i=next[key].length-1;i>=0;i--) {
      const full=decodeRoundFrame(next[key][i],base),updated={...full,source:rewrite(full.source)};
      next[key][i]=encodeRoundFrame(updated,newBase);base=full.source;newBase=updated.source;
    }
  }
  next.source=rewrite(original);
  return bindLedger(next);
}
function decide(doc, input) {
  const ledger = clone(readLedger(doc)); assert(ledger, 'PENDING_REVISIONS_REQUIRED');
  assert(exact(input, ['action', 'revisionId']) && ['accept', 'reject', 'acceptAll', 'rejectAll', 'undo', 'redo'].includes(input.action));
  const before = ledger.revisions.map(r => r.state);
  if (input.action === 'undo' || input.action === 'redo') {
    assert(input.revisionId === undefined);
    const source = input.action === 'undo' ? ledger.undo : ledger.redo, target = input.action === 'undo' ? ledger.redo : ledger.undo;
    if (!source.length) {
      const rounds = input.action === 'undo' ? ledger.roundUndo : ledger.roundRedo;
      const other = input.action === 'undo' ? ledger.roundRedo : ledger.roundUndo;
      if (!rounds?.length) return { changed: false, doc };
      assert(other.length < 128, 'PENDING_REVISIONS_HISTORY_BUDGET');
      const next = decodeRoundFrame(rounds.pop(),ledger.source); other.push(encodeRoundFrame(roundFrame(ledger),next.source));
      if (next.schemaVersion !== 3) delete ledger.noteSourcePoints;
      return { changed: true, doc: bindLedger({ ...ledger, ...next, schemaVersion: next.schemaVersion === 3 ? 3 : 2,
        roundUndo: ledger.roundUndo, roundRedo: ledger.roundRedo, returnReceipts: ledger.returnReceipts }) };
    }
    assert(target.length < 128, 'PENDING_REVISIONS_HISTORY_BUDGET'); target.push(before);
    const next = source.pop(); ledger.revisions.forEach((r, i) => { r.state = next[i]; });
  } else {
    let selected;
    if (input.action.endsWith('All')) { assert(input.revisionId === undefined); selected = ledger.revisions.filter(r => r.state === 'pending'); }
    else {
      const revision = ledger.revisions.find(r => r.id === input.revisionId); assert(revision, 'PENDING_REVISION_UNKNOWN');
      selected = ledger.revisions.filter(r => r.id === revision.id || revision.groupId && r.groupId === revision.groupId);
      const expected = input.action === 'accept' ? 'accepted' : 'rejected';
      if (selected.every(r => r.state === expected)) return { changed: false, doc };
      assert(selected.every(r => r.state === 'pending'), 'PENDING_REVISION_ALREADY_DECIDED');
    }
    if (!selected.length) return { changed: false, doc };
    assert(ledger.undo.length < 128, 'PENDING_REVISIONS_HISTORY_BUDGET'); ledger.undo.push(before); ledger.redo = [];
    if (ledger.schemaVersion >= 2) ledger.roundRedo = [];
    selected.forEach(r => { r.state = input.action.startsWith('accept') ? 'accepted' : 'rejected'; });
  }
  return { changed: true, doc: bindLedger(ledger) };
}
function projection(doc) {
  const ledger = readLedger(doc); if (!ledger) return null;
  const sourceParagraphs = paragraphs(ledger.source);
  const text = value => paragraphs(value).map(p => (p.content || []).map(textOf).join('')).join('\n');
  return { original: text(materializeValidated(ledger, 'original')), current: text(materializeValidated(ledger)),
    canUndo: ledger.undo.length > 0 || Boolean(ledger.roundUndo?.length), canRedo: ledger.redo.length > 0 || Boolean(ledger.roundRedo?.length),
    revisions: ledger.revisions.map(r => ({ ...clone(r), text: isTableRow(r) ? tableRows(ledger.source).filter(row => row.tableIndex === r.structure.tableIndex && row.rowIndex === r.structure.rowIndex).flatMap(row => sourceParagraphs.slice(row.paragraphIndex, row.paragraphIndex + row.paragraphCount)).map(p => (p.content || []).map(textOf).join('')).join('\t') : isParagraphBoundary(r) ? '\n' : (sourceParagraphs[r.paragraphIndex].content || []).map(textOf).join('').slice(r.from, r.to) })) };
}

// Comment transport uses an independently checked export basis. Native wrapper
// IDs may change or split in Word; canonical revision identity never does.
const commentHash = value => require('./browser-safe-hash.cjs').sha256UpdateCompatible(typeof value === 'string' ? value : stable(value));
function commentTypography(value) {
  assert(value === undefined || exact(value,['schemaVersion','fontSize']) && value.schemaVersion === 'yalken.review-docx.typography-defaults.v1' && value.fontSize === '12pt', 'PENDING_COMMENT_TYPOGRAPHY_INVALID');
  return value?.fontSize || null;
}
// Export defaults are properties of a proven source occurrence, never a
// tolerance applied to returned data. Authored indentation always wins.
function commentExportIndents(doc, exportParagraphs) {
  if(exportParagraphs===undefined)return null;
  const leaves=paragraphs(doc), roles=[];
  const visit=(node,quoteDepth=0,stack=[])=>{
    if(['paragraph','heading','codeBlock'].includes(node.type)) {roles.push({node,quoteDepth,list:stack.at(-1)});return;}
    if(node.type==='blockquote') {for(const child of node.content)visit(child,quoteDepth+1,stack);return;}
    if(['orderedList','bulletList'].includes(node.type)) {
      const list={kind:node.type==='orderedList'?'ordered':'bullet',level:node.attrs?.wordNumbering?.level??stack.length,numbering:Boolean(node.attrs?.wordNumbering)};
      for(const item of node.content) {
        let direct=0;
        for(const child of item.content) {
          const leaf=['paragraph','heading'].includes(child.type);
          visit(child,quoteDepth,[...stack,{...list,continuation:leaf&&direct++>0}]);
        }
      }
      return;
    }
    for(const child of node.content||[])visit(child,quoteDepth,node.type==='table'?[]:stack);
  };
  visit(doc);
  assert(Array.isArray(exportParagraphs) && exportParagraphs.length===leaves.length && roles.length===leaves.length,'PENDING_COMMENT_EXPORT_LAYOUT_INVALID');
  return roles.map(({node,quoteDepth,list},index)=>{
    const emitted=exportParagraphs[index];
    assert(object(emitted) && emitted.nodeType===node.type && (emitted.blockquoteDepth??0)===quoteDepth
      && (list ? emitted.list?.kind===list.kind && emitted.list.level===list.level && (emitted.list.continuation===true)===list.continuation
        && Boolean(emitted.list.wordNumbering)===list.numbering : emitted.list===undefined),'PENDING_COMMENT_EXPORT_LAYOUT_INVALID');
    const authored=node.attrs?.wordParagraphIndent;
    const normalized=value=>require('./word-paragraph-layout-v1.cjs').normalizeWordParagraphIndent(value);
    if(authored!=null) {
      assert(emitted.wordParagraphIndent!=null && stable(normalized(authored))===stable(normalized(emitted.wordParagraphIndent)),'PENDING_COMMENT_EXPORT_LAYOUT_INVALID');
      return null;
    }
    let expected=null;
    if(list?.continuation) expected={left:list.numbering?(list.level+1)*720:720+list.level*360};
    else if(quoteDepth) expected={left:quoteDepth*720};
    if(emitted.wordParagraphIndent!=null) assert(expected && stable(normalized(emitted.wordParagraphIndent))===stable(expected),'PENDING_COMMENT_EXPORT_LAYOUT_INVALID');
    return expected;
  });
}
function commentLeftDefaults(doc, exportParagraphs) {
  if(exportParagraphs===undefined)return null;
  return paragraphs(doc).map((p,index)=>p.attrs?.textAlign==='left' && exportParagraphs[index]?.textAlign==='left');
}
function commentRich(doc, fontSize, indents=null, leftDefaults=null) {
  const copy=clone(doc);
  const visit=n=>{
    if(n.attrs?.wordParagraphMarkTypography!=null){const value=require('../io/inlineTypography.cjs').comparableParagraphMarkTypography(n.attrs.wordParagraphMarkTypography);if(value)n.attrs.wordParagraphMarkTypography=value;else delete n.attrs.wordParagraphMarkTypography;}
    if(fontSize && ['text','hardBreak'].includes(n.type)) {
      const marks=n.marks || (n.marks=[]); let style=marks.find(m=>m.type==='textStyle');
      if(!style) marks.push(style={type:'textStyle',attrs:{}});
      style.attrs={...style.attrs,fontSize:style.attrs?.fontSize || fontSize};
    }
    for(const child of n.content||[]) visit(child);
  };
  visit(copy);
  if(indents) paragraphs(copy).forEach((p,index)=>{if(indents[index])p.attrs={...p.attrs,wordParagraphIndent:clone(indents[index])};});
  if(leftDefaults) paragraphs(copy).forEach((p,index)=>{if(leftDefaults[index] && p.attrs?.textAlign==='left')delete p.attrs.textAlign;});
  return normalizeNode(copy);
}
// Version 2 makes the emitted run defaults and native timestamp precision
// explicit. Local source stays unchanged; returned runs are compared strictly.
function commentTransportSegments(segments, paragraph = {}) {
  return segments.map(segment => {
    const result=clone(segment),node=result.node;
    if(paragraph.type!=='codeBlock' && ['text','hardBreak'].includes(node.type)) {
      const marks=node.marks||(node.marks=[]);let style=marks.find(m=>m.type==='textStyle');
      if(!style)marks.push(style={type:'textStyle',attrs:{}});
      style.attrs={fontFamily:'Times New Roman',fontSize:'12pt',...style.attrs,
        wordLanguage:{val:'en-US',eastAsia:'en-US',bidi:'en-US',...paragraph.attrs?.wordParagraphMarkLanguage,...style.attrs?.wordLanguage}};
    }
    if(result.revision) {
      const r=result.revision;
      if(r.operation==='format' && r.format?.kind==='run') {
        for(const side of ['before','after'])r.format[side]=commentTransportSegments([
          {node:{type:'text',text:'x',marks:r.format[side]},revision:null}
        ],paragraph)[0].node.marks;
      }
      if(r.dateUtc && Number.isFinite(Date.parse(r.dateUtc))) {
        r.dateUtc=new Date(r.dateUtc).toISOString().replace(/\.\d{3}Z$/u,'Z');
        if(r.date && Number.isFinite(Date.parse(r.date)))r.date=new Date(r.date).toISOString().replace(/:\d{2}\.\d{3}Z$/u,':00Z');
      }
    }
    return result;
  });
}
function commentBasis(document,exportTypography,schemaVersion=1) {
  const ledger=readLedger(document);
  assert(ledger && ledger.revisions.every(r=>!isStructural(r) && !r.moveName && ['insert','delete','format'].includes(r.operation)
    && (r.operation !== 'format' || ['run','paragraph'].includes(r.format.kind))), 'PENDING_COMMENT_REVISION_UNSUPPORTED');
  const size=commentTypography(exportTypography), exported=exportDocument(ledger), spans=[], rows=[];
  const exportedParagraphs=paragraphs(exported.doc);
  exported.paragraphs.forEach((p,paragraphIndex)=>{
    const format=ledger.revisions.find(r=>r.paragraphIndex===paragraphIndex&&isParagraphFormat(r)&&r.state==='pending');
    if(format)spans.push({revisionId:format.id,paragraphIndex,fromUtf16:0,toUtf16:(exportedParagraphs[paragraphIndex].content||[]).map(textOf).join('').length,operation:'format',paragraphFormat:true,
      provenanceSha256:commentHash({author:format.author,date:format.date,dateUtc:format.dateUtc}),formatSha256:commentHash({before:commentRich({type:'doc',content:[{...format.format.before,content:[]}]},size),after:commentRich({type:'doc',content:[{...format.format.after,content:[]}]},size)})});
    let offset=0; const parts=[];
    for(const segment of schemaVersion===2?commentTransportSegments(p.segments,exportedParagraphs[paragraphIndex]):p.segments) {
      const length=textOf(segment.node).length, from=offset; offset+=length;
      parts.push({fromUtf16:from,toUtf16:offset,node:clone(segment.node),revision:segment.revision});
      if(segment.revision) {
        const r=segment.revision, last=spans.at(-1);
        if(last?.revisionId===r.id && last.paragraphIndex===paragraphIndex && last.toUtf16===from) last.toUtf16=offset;
        else spans.push({revisionId:r.id,paragraphIndex,fromUtf16:from,toUtf16:offset,operation:r.operation,
          provenanceSha256:commentHash({author:r.author,date:r.date,dateUtc:r.dateUtc})});
      }
    }
    rows.push(parts);
  });
  const project=mode=>{
    const doc=clone(exported.doc);
    paragraphs(doc).forEach((p,index)=>{
      const format=ledger.revisions.find(r=>r.paragraphIndex===index&&isParagraphFormat(r)&&r.state==='pending');
      if(mode==='original'&&format){p.type=format.format.before.type;if(format.format.before.attrs)p.attrs=clone(format.format.before.attrs);else delete p.attrs;}
      p.content=rows[index].filter(s=>!s.revision || (mode==='current'?s.revision.operation!=='delete':mode==='original'?s.revision.operation!=='insert':true)).map(s=>{
      const node=clone(s.node);
      if(mode==='original' && s.revision?.operation==='format') {
        if(s.revision.format.before.length)node.marks=clone(s.revision.format.before);else delete node.marks;
      }
      return node;
    });});
    return doc;
  };
  const union=project('union'),current=project('current'),original=project('original');
  for(const span of spans) {
    if(span.paragraphFormat)continue;
    const nodes=rows[span.paragraphIndex].filter(s=>s.fromUtf16>=span.fromUtf16 && s.toUtf16<=span.toUtf16).map(s=>s.node);
    span.formatSha256=commentHash(commentRich({type:'doc',content:[{type:'paragraph',content:nodes}]},size));
  }
  return {ledger,rows,spans,union,current,original,size};
}
function basisEndpoint(basis,paragraphIndex,offsetUtf16,mode='current',inverse=false) {
  const row=basis.rows[paragraphIndex];
  assert(row && Number.isSafeInteger(offsetUtf16) && offsetUtf16>=0,'PENDING_COMMENT_ENDPOINT_INVALID');
  if(!inverse) {
    const unionText=row.map(s=>textOf(s.node)).join('');
    assert(safeBoundary(unionText,offsetUtf16) && offsetUtf16<=unionText.length,'PENDING_COMMENT_ENDPOINT_INVALID');
    let removed=0;
    for(const s of row) if(mode!=='union' && s.revision && (mode==='current'?s.revision.operation==='delete':s.revision.operation==='insert')) removed+=Math.max(0,Math.min(offsetUtf16,s.toUtf16)-s.fromUtf16);
    return {paragraphIndex,offsetUtf16:offsetUtf16-removed};
  }
  const currentText=row.filter(s=>!s.revision || (mode==='current'?s.revision.operation!=='delete':s.revision.operation!=='insert')).map(s=>textOf(s.node)).join('');
  assert(offsetUtf16===currentText.length || new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(currentText).containing(offsetUtf16)?.index===offsetUtf16,'PENDING_COMMENT_ENDPOINT_INVALID');
  const candidates=[]; let projected=0;
  for(const s of row) {
    const hidden=s.revision && (mode==='current'?s.revision.operation==='delete':s.revision.operation==='insert');
    if(hidden) {if(offsetUtf16===projected)candidates.push(s.fromUtf16,s.toUtf16);continue;}
    const length=s.toUtf16-s.fromUtf16;
    if(offsetUtf16>=projected && offsetUtf16<=projected+length)candidates.push(s.fromUtf16+offsetUtf16-projected);
    projected+=length;
  }
  if(!row.length && offsetUtf16===0)candidates.push(0);
  const unique=[...new Set(candidates)];
  assert(unique.length===1,'PENDING_COMMENT_ENDPOINT_AMBIGUOUS');
  return basisEndpoint(basis,paragraphIndex,unique[0],'union');
}
// Locator coordinates belong to the canonical union source, before revision
// decisions remove wrappers or text from the exported representation.
function commentLocatorRows(basis) {
  if(basis.locatorRows)return basis.locatorRows;
  if(!basis.ledger)return basis.rows;
  const allPending={...basis.ledger,revisions:basis.ledger.revisions.map(r=>({...r,state:'pending'}))};
  return basis.locatorRows=exportSegments(allPending).map(row=>{let offset=0;return row.map(s=>{const fromUtf16=offset;offset+=textOf(s.node).length;return {...s,fromUtf16,toUtf16:offset};});});
}
function commentLocatorGeometry(basis,start,end) {
  return commentHash(commentLocatorRows(basis).slice(start.paragraphIndex,end.paragraphIndex+1).map(row=>{
    const spans=[];
    for(const s of row)if(s.revision) {
      const last=spans.at(-1),operation=s.revision.operation;
      if(last&&last[1]===s.fromUtf16&&last[2]===operation)last[1]=s.toUtf16;else spans.push([s.fromUtf16,s.toUtf16,operation]);
    }
    return {text:row.map(s=>textOf(s.node)).join(''),spans};
  }));
}
function locatorPoint(basis,point,mode) {
  if(!basis.ledger)return mode==='export'?point:basisEndpoint(basis,point.paragraphIndex,point.offsetUtf16);
  const text=commentLocatorRows(basis)[point.paragraphIndex]?.map(s=>textOf(s.node)).join('');
  assert(typeof text==='string'&&safeBoundary(text,point.offsetUtf16),'PENDING_COMMENT_ENDPOINT_INVALID');
  let removed=0;
  for(const r of basis.ledger.revisions)if(r.paragraphIndex===point.paragraphIndex) {
    const visible=mode==='export'&&r.state==='pending'||(r.operation==='insert'?r.state!=='rejected':r.state==='rejected');
    if(!visible)removed+=Math.max(0,Math.min(point.offsetUtf16,r.to)-r.from);
  }
  return {...point,offsetUtf16:point.offsetUtf16-removed};
}
function checkedCommentLocator(basis,anchor,locator) {
  require('./word-comment-ranges-v1.cjs').validatePendingUnionLocator(locator);
  const start={paragraphIndex:anchor.sceneParagraphIndex,offsetUtf16:anchor.startUtf16};
  const end={paragraphIndex:anchor.endSceneParagraphIndex??start.paragraphIndex,offsetUtf16:anchor.endUtf16??anchor.startUtf16+anchor.selectedText.length};
  assert(locator.geometrySha256===commentLocatorGeometry(basis,locator.unionStart,locator.unionEnd),'PENDING_COMMENT_LOCATOR_STALE');
  for(const [current,union] of [[start,locator.unionStart],[end,locator.unionEnd]])
    assert(stable(locatorPoint(basis,union,'current'))===stable(current),'PENDING_COMMENT_LOCATOR_ENDPOINT');
  return {...locator,unionStart:locatorPoint(basis,locator.unionStart,'export'),unionEnd:locatorPoint(basis,locator.unionEnd,'export')};
}
function createCommentUnionLocator({document,projection,anchor,unionStart,unionEnd}) {
  const basis=projection?{rows:projection.segments}:commentBasis(document);
  const locator={schemaVersion:1,geometrySha256:commentLocatorGeometry(basis,unionStart,unionEnd),unionStart:clone(unionStart),unionEnd:clone(unionEnd)};
  checkedCommentLocator(basis,anchor,locator);
  try {
    for(const [current,union] of [[{paragraphIndex:anchor.sceneParagraphIndex,offsetUtf16:anchor.startUtf16},unionStart],
      [{paragraphIndex:anchor.endSceneParagraphIndex??anchor.sceneParagraphIndex,offsetUtf16:anchor.endUtf16??anchor.startUtf16+anchor.selectedText.length},unionEnd]])
      assert(stable(basisEndpoint(basis,current.paragraphIndex,current.offsetUtf16,'current',true))===stable(union),'PENDING_COMMENT_LOCATOR_ENDPOINT');
    return undefined;
  } catch(error) {if(error.code!=='PENDING_COMMENT_ENDPOINT_AMBIGUOUS')throw error;}
  return locator;
}
function validateCommentUnionLocator({document,projection,anchor,locator}) {return checkedCommentLocator(projection?{rows:projection.segments}:commentBasis(document),anchor,locator);}
function commentAnchorBindings(basis,anchors) {
  assert(Array.isArray(anchors) && anchors.length<=require('./word-comment-body-v1.cjs').COMMENT_CAPACITY.threads,'PENDING_COMMENT_ANCHORS_INVALID');
  const seen=new Set(), ownerByNode=new Map(); let tableId=0;
  const visit=(node,owner=null)=>{
    if(node.type==='table') {
      const id=String(++tableId);
      for(const cell of inspectTable(node).cells) {
        const local={tableId:id,row:cell.row,column:cell.column};
        const combined=owner?{...clone(owner)}:local;
        if(owner) {let tail=combined;while(tail.nested)tail=tail.nested;tail.nested=local;}
        for(const child of cell.node.content)visit(child,combined);
      }
    } else if(['paragraph','heading','codeBlock'].includes(node.type)) ownerByNode.set(node,owner);
    else for(const child of node.content||[])visit(child,owner);
  };
  visit(basis.current);
  const texts=paragraphs(basis.current).map(p=>({text:(p.content||[]).map(textOf).join(''),...(ownerByNode.get(p)?{table:ownerByNode.get(p)}:{})}));
  return anchors.map(entry=>{
    assert(exact(entry,['threadId','anchor']) && typeof entry.threadId==='string' && !seen.has(entry.threadId),'PENDING_COMMENT_ANCHORS_INVALID');seen.add(entry.threadId);
    const a=entry.anchor, start=a?.sceneParagraphIndex, end=a?.endSceneParagraphIndex ?? start;
    require('./word-comment-ranges-v1.cjs').validateCommentAnchor({sceneId:a?.sceneId,paragraphs:texts,anchor:a});
    const currentStart={paragraphIndex:start,offsetUtf16:a.startUtf16},currentEnd={paragraphIndex:end,offsetUtf16:a.endUtf16 ?? a.startUtf16+a.selectedText.length};
    const locator=a.pendingUnionLocator&&checkedCommentLocator(basis,a,a.pendingUnionLocator);
    const unionStart=locator?.unionStart??basisEndpoint(basis,start,currentStart.offsetUtf16,'current',true),unionEnd=locator?.unionEnd??basisEndpoint(basis,end,currentEnd.offsetUtf16,'current',true);
    return {threadId:entry.threadId,currentStart,currentEnd,unionStart,unionEnd,
      originalStart:basisEndpoint(basis,start,unionStart.offsetUtf16,'original'),originalEnd:basisEndpoint(basis,end,unionEnd.offsetUtf16,'original')};
  }).sort((a,b)=>a.threadId<b.threadId?-1:a.threadId>b.threadId?1:0);
}
function buildCommentExportBinding({document,anchors=[],exportTypography,exportParagraphs,schemaVersion=1}={}) {
  inspectLedgerData({document,anchors,exportTypography,exportParagraphs});
  assert([1,2].includes(schemaVersion),'PENDING_COMMENT_BINDING_VERSION');
  const basis=commentBasis(document,exportTypography,schemaVersion);
  const indents=commentExportIndents(basis.union,exportParagraphs), leftDefaults=commentLeftDefaults(basis.union,exportParagraphs);
  const projection={union:basis.union,current:basis.current,original:basis.original,segments:basis.rows};
  const binding={schemaVersion,ledgerSha256:commentHash(basis.ledger),
    basisSha256:commentHash({union:commentRich(basis.union,basis.size,indents,leftDefaults),current:commentRich(basis.current,basis.size,indents,leftDefaults),original:commentRich(basis.original,basis.size,indents,leftDefaults)}),
    paragraphCount:basis.rows.length,revisionSpans:basis.spans,anchors:commentAnchorBindings(basis,anchors)};
  return {binding,projection};
}
function mapCommentExportEndpoint({document,binding,anchors=[],exportTypography,exportParagraphs,paragraphIndex,offsetUtf16,affinity}={}) {
  inspectLedgerData(binding);
  assert(['left','right'].includes(affinity),'PENDING_COMMENT_ENDPOINT_INVALID');
  const actual=buildCommentExportBinding({document,anchors,exportTypography,exportParagraphs,schemaVersion:binding?.schemaVersion});
  assert(stable(binding)===stable(actual.binding),'PENDING_COMMENT_BINDING_CHANGED');
  return basisEndpoint({rows:actual.projection.segments},paragraphIndex,offsetUtf16,'current',true);
}
function verifyCommentReturnBinding({document,binding,returnedDocument,anchors=[],exportTypography,exportParagraphs}={}) {
  inspectLedgerData({binding,returnedDocument});
  const before=buildCommentExportBinding({document,anchors,exportTypography,exportParagraphs,schemaVersion:binding?.schemaVersion});
  assert(stable(binding)===stable(before.binding),'PENDING_COMMENT_BINDING_CHANGED');
  const returned=commentBasis(returnedDocument,exportTypography);
  assert(returned.ledger.revisions.every(r=>r.state==='pending'),'PENDING_COMMENT_REVISION_CHANGED');
  const leftDefaults=commentLeftDefaults(before.projection.union,exportParagraphs);
  assert(commentHash({union:commentRich(returned.union,returned.size,null,leftDefaults),current:commentRich(returned.current,returned.size,null,leftDefaults),original:commentRich(returned.original,returned.size,null,leftDefaults)})===binding.basisSha256,'PENDING_COMMENT_PROJECTION_CHANGED');
  const partitions=[];let cursor=0;
  for(const span of binding.revisionSpans) {
    if(span.paragraphFormat){const actual=returned.spans[cursor++];assert(actual?.paragraphFormat&&actual.paragraphIndex===span.paragraphIndex&&actual.fromUtf16===span.fromUtf16&&actual.toUtf16===span.toUtf16&&actual.provenanceSha256===span.provenanceSha256&&actual.formatSha256===span.formatSha256,'PENDING_COMMENT_PARTITION_CHANGED');partitions.push({revisionId:span.revisionId,fragments:[actual.revisionId]});continue;}
    let offset=span.fromUtf16;const fragments=[];
    while(offset<span.toUtf16) {
      const fragment=returned.spans[cursor++];
      assert(fragment && fragment.paragraphIndex===span.paragraphIndex && fragment.fromUtf16===offset && fragment.toUtf16>offset && fragment.toUtf16<=span.toUtf16
        && fragment.operation===span.operation && fragment.provenanceSha256===span.provenanceSha256,'PENDING_COMMENT_PARTITION_CHANGED');
      fragments.push(fragment.revisionId);offset=fragment.toUtf16;
    }
    partitions.push({revisionId:span.revisionId,fragments});
  }
  assert(cursor===returned.spans.length,'PENDING_COMMENT_PARTITION_CHANGED');
  return {partitions,projection:before.projection,anchors:binding.anchors};
}
// A checked, transport-normalized basis for the separate changed-pending proof.
// This does not relax the unchanged-return verifier above.
function mixedCommentBases({document,binding,returnedDocument,anchors=[],exportTypography,exportParagraphs}) {
  const before=buildCommentExportBinding({document,binding,anchors,exportTypography,exportParagraphs,schemaVersion:binding?.schemaVersion});
  assert(stable(before.binding)===stable(binding),'PENDING_COMMENT_BINDING_CHANGED');
  const incoming=commentBasis(returnedDocument,exportTypography);
  const left=commentLeftDefaults(before.projection.union,exportParagraphs);
  const indents=commentExportIndents(before.projection.union,exportParagraphs);
  const old=commentRich(before.projection.union,commentTypography(exportTypography),indents,left);
  // Match a fresh property change against its checked previous rich snapshot.
  // The published Current and Original projections remain separate and exact.
  const comparison=clone(incoming.union), oldLedger=readLedger(document);
  const sameRevision=(a,b)=>a.operation===b.operation && a.author===b.author && a.date===b.date && a.dateUtc===b.dateUtc
    && stable(a.format)===stable(b.format);
  paragraphs(comparison).forEach((p,index)=>{
    const currentFormat=incoming.ledger.revisions.find(r=>r.paragraphIndex===index&&isParagraphFormat(r));
    const oldFormat=oldLedger.revisions.find(r=>r.paragraphIndex===index&&isParagraphFormat(r));
    if(oldFormat)assert(currentFormat&&sameRevision(oldFormat,currentFormat),'MIXED_RETURN_OLD_PARAGRAPH_FORMAT_CHANGED');
    else if(currentFormat){
      const strip=properties=>{const value=clone(properties);if(value.attrs){delete value.attrs.wordParagraphMarkTypography;delete value.attrs.wordParagraphMarkLanguage;if(!Object.keys(value.attrs).length)delete value.attrs;}return value;};
      assert(stable(strip(currentFormat.format.before))===stable(strip(currentFormat.format.after)),'MIXED_RETURN_PARAGRAPH_FORMAT_UNSUPPORTED');
      p.type=currentFormat.format.before.type;if(currentFormat.format.before.attrs)p.attrs=clone(currentFormat.format.before.attrs);else delete p.attrs;
    }
    p.content=incoming.rows[index].map(segment=>{
    const node=clone(segment.node),revision=segment.revision;
    if(revision?.operation==='format' && !before.projection.segments[index].some(old=>old.revision && sameRevision(old.revision,revision))) {
      node.marks=commentTransportSegments([{node:{type:'text',text:'x',marks:revision.format.before},revision:null}],p)[0].node.marks;
    }
    return node;
  });});
  const next=commentRich(comparison,incoming.size,null,left);
  const shape=doc=>{const copy=clone(doc);paragraphs(copy).forEach(p=>{p.content=[];});return normalizeNode(copy);};
  assert(stable(shape(old))===stable(shape(next)),'MIXED_RETURN_STRUCTURE_OR_FORMAT_CHANGED');
  return {before:before.projection,returned:{union:incoming.union,current:incoming.current,original:incoming.original,segments:incoming.rows,paragraphFormats:incoming.ledger.revisions.filter(isParagraphFormat)},
    oldComparison:old,newComparison:next};
}
function mapCheckedCommentProjectionEndpoint({projection,paragraphIndex,offsetUtf16}) {
  return basisEndpoint({rows:projection.segments},paragraphIndex,offsetUtf16,'current');
}
module.exports = { roundFrame, lastRoundFrame, compactRoundHistory, createCommentUnionLocator, validateCommentUnionLocator, mixedCommentBases, mapCheckedCommentProjectionEndpoint, commentTransportSegments, buildCommentExportBinding, mapCommentExportEndpoint, verifyCommentReturnBinding, setDefaultTabStop, exportNoteBasis, projectSourcePoint, bindNoteSourcePoints, noteProjection, isTableRow, isStructural, tableRows, KEY, validateLedger, bindLedger, readLedger, materialize, segments, decide, projection, normalizeNode, replaceFromReturn, paragraphs, exportSegments, paragraphProperties, isParagraphFormat, isParagraphBoundary, paragraphSibling, exportDocument };

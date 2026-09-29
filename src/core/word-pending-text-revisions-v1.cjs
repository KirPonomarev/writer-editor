'use strict';

// Canonical scene-owned review state. The displayed document is a checked
// projection, never a second source of truth for a pending change.
const KEY = 'wordPendingRevisions';
const { inspectTable } = require('../io/documentTables.js');
const MAX_BYTES = 4 * 1024 * 1024;
const stable = value => Array.isArray(value) ? '[' + value.map(stable).join(',') + ']' : object(value) ? '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + stable(value[k])).join(',') + '}' : JSON.stringify(value);
const clone = value => JSON.parse(JSON.stringify(value));
const fail = code => { throw Object.assign(new Error(code), { code }); };
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const exact = (value, keys) => object(value) && Object.keys(value).every(key => keys.includes(key));
const status = value => ['pending', 'accepted', 'rejected'].includes(value);
const textOf = node => node.type === 'hardBreak' ? '\n' : node.text;
const paragraphProperties = node => ({ type: node.type, ...(node.attrs && Object.keys(node.attrs).length ? { attrs: clone(node.attrs) } : {}) });
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
  assert(exact(doc, ['type', 'content']) && doc.type === 'doc' && Array.isArray(doc.content) && doc.content.length > 0 && doc.content.length <= 10000);
  const result = []; let lists = 0;
  const visit = (node, depth = 0, inCell = false) => {
    assert(exact(node, ['type', 'attrs', 'content']));
    if (['paragraph', 'heading'].includes(node.type)) {
      assert(result.length < 10000, 'PENDING_REVISIONS_BUDGET'); result.push(node); return;
    }
    if (node.type === 'table' && !inCell) {
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
    assert(!node.attrs || exact(node.attrs, node.type === 'orderedList' ? ['start', 'type'] : []));
    const start = node.attrs?.start ?? 1;
    assert(Number.isSafeInteger(start) && start >= 0 && start + node.content.length - 1 <= 2147483647
      && (node.attrs?.type == null || node.attrs.type === '1'));
    for (const item of node.content) {
      assert(exact(item, ['type', 'attrs', 'content']) && item.type === 'listItem'
        && (!item.attrs || exact(item.attrs, [])) && Array.isArray(item.content)
        && item.content[0]?.type === 'paragraph'
        && item.content.slice(1).every(n => ['bulletList', 'orderedList'].includes(n?.type)));
      visit(item.content[0], depth, inCell);
      for (const child of item.content.slice(1)) visit(child, depth + 1, inCell);
    }
  };
  for (const node of doc.content) visit(node);
  return result;
}
function validateSource(doc) {
  for (const p of paragraphs(doc)) {
    assert(exact(p, ['type', 'attrs', 'content']) && ['paragraph', 'heading'].includes(p.type));
    assert(!p.attrs || (exact(p.attrs, ['textAlign', 'level'])
      && (!p.attrs.textAlign || ['left', 'center', 'right', 'justify'].includes(p.attrs.textAlign))
      && (p.type === 'paragraph' ? p.attrs.level === undefined : Number.isInteger(p.attrs.level) && p.attrs.level >= 1 && p.attrs.level <= 6)));
    assert(Array.isArray(p.content));
    for (const n of p.content) {
      assert(exact(n, ['type', 'text', 'marks']) && ['text', 'hardBreak'].includes(n.type));
      assert(n.type === 'text' ? typeof n.text === 'string' && n.text.length > 0 : n.text === undefined && !n.marks?.length);
      assert(n.marks === undefined || Array.isArray(n.marks) && n.marks.length <= 8);
      const seen = new Set();
      for (const mark of n.marks || []) {
        assert(exact(mark, ['type', 'attrs']) && !seen.has(mark.type)); seen.add(mark.type);
        if (['bold', 'italic', 'underline', 'strike'].includes(mark.type)) assert(!mark.attrs || !Object.keys(mark.attrs).length);
        else if (mark.type === 'textStyle') {
          assert(exact(mark.attrs, ['fontFamily', 'fontSize', 'color']));
          for (const [key, value] of Object.entries(mark.attrs)) {
            assert(typeof value === 'string' && value.length <= 128 && !/[\x00-\x1f<>]/u.test(value));
            if (key === 'color') assert(/^#[a-f0-9]{6}$/u.test(value));
            if (key === 'fontSize') assert(/^\d+(?:\.5)?pt$/u.test(value) && parseFloat(value) > 0 && parseFloat(value) <= 1638);
          }
        } else if (mark.type === 'highlight') assert(exact(mark.attrs, ['color']) && /^#[a-f0-9]{6}$/u.test(mark.attrs.color));
        else fail('PENDING_REVISIONS_MARK_UNSUPPORTED');
      }
    }
  }
}
function validateState(input, frame = false) {
  assert(object(input) && new TextEncoder().encode(JSON.stringify(input)).length <= MAX_BYTES, 'PENDING_REVISIONS_BUDGET');
  const baseKeys = ['schemaVersion', 'source', 'revisions', 'undo', 'redo'];
  assert([1, 2].includes(input.schemaVersion));
  assert(exact(input, input.schemaVersion === 2 && !frame ? [...baseKeys, 'roundUndo', 'roundRedo', 'returnReceipts'] : baseKeys));
  validateSource(input.source);
  const sourceParagraphs = paragraphs(input.source);
  assert(Array.isArray(input.revisions) && input.revisions.length >= (input.schemaVersion === 1 ? 1 : 0) && input.revisions.length <= 1024);
  const ids = new Set(), groups = new Map(), occupied = new Map(), paragraphFormats = new Set();
  let previousParagraph = -1, previousFrom = 0;
  for (const r of input.revisions) {
    assert(exact(r, ['id', 'nativeId', 'operation', 'author', 'date', 'dateUtc', 'groupId', 'paragraphIndex', 'from', 'to', 'state', 'moveName', 'format']));
    assert(/^revision-[1-9]\d{0,3}$/u.test(r.id) && !ids.has(r.id)); ids.add(r.id);
    assert(typeof r.nativeId === 'string' && r.nativeId.length <= 80 && typeof r.author === 'string' && r.author.length <= 1024);
    assert(typeof r.date === 'string' && r.date.length <= 80 && typeof r.dateUtc === 'string' && r.dateUtc.length <= 80);
    assert(![r.nativeId, r.author, r.date, r.dateUtc].some(value => /[\x00-\x08\x0b\x0c\x0e-\x1f]/u.test(value)));
    assert(['insert', 'delete', 'format'].includes(r.operation) && status(r.state));
    assert(Number.isInteger(r.paragraphIndex) && r.paragraphIndex >= 0 && r.paragraphIndex >= previousParagraph && r.paragraphIndex < sourceParagraphs.length);
    const p = sourceParagraphs[r.paragraphIndex], text = p.content.map(textOf).join('');
    assert(safeBoundary(text, r.from) && safeBoundary(text, r.to)
      && (isParagraphFormat(r) ? r.from === 0 && r.to === text.length : r.to > r.from)
      && (r.paragraphIndex !== previousParagraph || r.from >= previousFrom));
    previousParagraph = r.paragraphIndex; previousFrom = r.from;
    if (isParagraphFormat(r)) {
      assert(!paragraphFormats.has(r.paragraphIndex), 'PENDING_FORMAT_OVERLAP'); paragraphFormats.add(r.paragraphIndex);
    } else {
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
        for (const n of p.content) {
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
  if (input.schemaVersion === 2 && !frame) {
    for (const rounds of [input.roundUndo, input.roundRedo]) {
      assert(Array.isArray(rounds) && rounds.length <= 128, 'PENDING_REVISIONS_HISTORY_BUDGET');
      for (const previous of rounds) validateState(previous, true);
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
function validateLedger(input) { return validateState(input); }
function roundFrame(ledger) {
  return clone(Object.fromEntries(['schemaVersion', 'source', 'revisions', 'undo', 'redo'].map(key => [key, ledger[key]])));
}
function revisionMeaning(sourceParagraphs, revision) {
  const text = sourceParagraphs[revision.paragraphIndex].content.map(textOf).join('').slice(revision.from, revision.to);
  return JSON.stringify([revision.paragraphIndex, revision.operation, revision.author, revision.date, revision.dateUtc, text, Boolean(revision.moveName), revision.format || null]);
}
function preserveReturnedIdentities(before, proposed) {
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
    const key = revisionMeaning(newParagraphs, revision);
    incomingCounts.set(key, (incomingCounts.get(key) || 0) + 1);
  }
  for (const [key, rows] of occurrences) {
    const count = incomingCounts.get(key) || 0;
    assert(count === 0 || count === rows.length, 'PENDING_RETURN_IDENTITY_AMBIGUOUS');
  }
  const groups = new Map();
  for (const revision of proposed.revisions) {
    assert(revision.state === 'pending', 'PENDING_RETURN_STATE_INVALID');
    const previous = occurrences.get(revisionMeaning(newParagraphs, revision))?.shift();
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
  if (existing) return { ...clone(existing), schemaVersion: 2,
    roundUndo: clone(existing.roundUndo || []), roundRedo: clone(existing.roundRedo || []), returnReceipts: clone(existing.returnReceipts || []) };
  const source = normalizeNode(doc);
  assert(source?.type === 'doc' && !source.attrs, 'PENDING_RETURN_SOURCE_UNSUPPORTED');
  paragraphs(source).forEach(p => { p.content ||= []; });
  return validateLedger({ schemaVersion: 2, source, revisions: [], undo: [], redo: [], roundUndo: [], roundRedo: [], returnReceipts: [] });
}
function replaceFromReturn(doc, returnedDoc, receipt) {
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
  preserveReturnedIdentities(before, proposed);
  const previous = roundFrame(before); previous.redo = [];
  after.roundUndo.push(previous);
  return { changed: true, replay: false, doc: bindLedger(after) };
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
  const changes = ledger.revisions.filter(r => r.paragraphIndex === paragraphIndex && !isParagraphFormat(r));
  const result = []; let offset = 0;
  for (const node of p.content) {
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
  const ledger = validateLedger(input);
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
  return doc;
}
function bindLedger(input) {
  const ledger = clone(validateLedger(input));
  return { ...materialize(ledger), attrs: { [KEY]: ledger } };
}
function readLedger(doc) {
  const ledger = doc?.attrs?.[KEY];
  if (ledger === undefined || ledger === null) return null;
  validateLedger(ledger);
  assert(stable(normalizeNode(doc)) === stable(normalizeNode(materialize(ledger))), 'PENDING_REVISIONS_PROJECTION_MISMATCH');
  return ledger;
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
      const next = rounds.pop(); other.push(roundFrame(ledger));
      return { changed: true, doc: bindLedger({ ...ledger, ...next, schemaVersion: 2,
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
    if (ledger.schemaVersion === 2) ledger.roundRedo = [];
    selected.forEach(r => { r.state = input.action.startsWith('accept') ? 'accepted' : 'rejected'; });
  }
  return { changed: true, doc: bindLedger(ledger) };
}
function projection(doc) {
  const ledger = readLedger(doc); if (!ledger) return null;
  const sourceParagraphs = paragraphs(ledger.source);
  const text = value => paragraphs(value).map(p => (p.content || []).map(textOf).join('')).join('\n');
  return { original: text(materialize(ledger, 'original')), current: text(materialize(ledger)),
    canUndo: ledger.undo.length > 0 || Boolean(ledger.roundUndo?.length), canRedo: ledger.redo.length > 0 || Boolean(ledger.roundRedo?.length),
    revisions: ledger.revisions.map(r => ({ ...clone(r), text: sourceParagraphs[r.paragraphIndex].content.map(textOf).join('').slice(r.from, r.to) })) };
}
module.exports = { KEY, validateLedger, bindLedger, readLedger, materialize, segments, decide, projection, normalizeNode, replaceFromReturn, paragraphs, exportSegments, paragraphProperties, isParagraphFormat };

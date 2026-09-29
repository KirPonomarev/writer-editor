'use strict';

const review = require('./word-pending-text-revisions-v1.cjs');
const clone = value => JSON.parse(JSON.stringify(value));
const fail = code => { throw Object.assign(Error(code), { code }); };
const text = paragraph => (paragraph.content || []).map(n => n.type === 'hardBreak' ? '\n' : n.text).join('');
const stable = value => Array.isArray(value) ? '[' + value.map(stable).join(',') + ']'
  : value && typeof value === 'object' ? '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + stable(value[k])).join(',') + '}' : JSON.stringify(value);
const equal = (a, b) => stable(review.normalizeNode(a)) === stable(review.normalizeNode(b));
const frame = ledger => clone(Object.fromEntries(['schemaVersion', 'source', 'revisions', 'undo', 'redo'].map(k => [k, ledger[k]])));

function baseline(doc) {
  const ledger = review.readLedger(doc);
  if (ledger) return { ...clone(ledger), schemaVersion: 2, roundUndo: clone(ledger.roundUndo || []),
    roundRedo: clone(ledger.roundRedo || []), returnReceipts: clone(ledger.returnReceipts || []) };
  const source = review.normalizeNode(doc);
  if (source.attrs) fail('RECORDING_DOCUMENT_ATTRIBUTES_UNSUPPORTED');
  review.paragraphs(source).forEach(p => { p.content ||= []; });
  return review.validateLedger({ schemaVersion: 2, source, revisions: [], undo: [], redo: [],
    roundUndo: [], roundRedo: [], returnReceipts: [] });
}
function slice(nodes, from, to) {
  const out = []; let offset = 0;
  for (const node of nodes) {
    const value = node.type === 'hardBreak' ? '\n' : node.text, end = offset + value.length;
    const left = Math.max(from, offset), right = Math.min(to, end);
    if (right > left) out.push(node.type === 'hardBreak' ? clone(node) : { ...clone(node), text: value.slice(left - offset, right - offset) });
    offset = end;
  }
  return out;
}
function visibleOffsetToSource(ledger, index, wanted, paragraph) {
  const length = text(paragraph).length;
  const changes = ledger.revisions.filter(r => r.paragraphIndex === index && r.operation !== 'format');
  const cuts = [...new Set([0, length, ...changes.flatMap(r => [r.from, r.to])])].sort((a, b) => a - b);
  let visible = 0;
  for (let i = 1; i < cuts.length; i++) {
    const from = cuts[i - 1], to = cuts[i];
    if (wanted === visible) return from;
    const r = changes.find(r => r.from <= from && r.to >= to);
    const included = !r || (r.state === 'rejected' ? r.operation === 'delete' : r.operation === 'insert');
    if (included) {
      if (wanted <= visible + to - from) return from + wanted - visible;
      visible += to - from;
    }
  }
  if (wanted === visible) return length;
  fail('RECORDING_OFFSET_INVALID');
}
function prepare(doc) {
  const ledger = baseline(doc);
  return { working: review.materialize(ledger), baseline: review.bindLedger(ledger) };
}

// Pure derivation from a stable session baseline, not from the last autosave.
// The caller supplies main-owned author/time and owns all save authority.
function derive(doc, workingDoc, metadata) {
  if (!metadata || Object.keys(metadata).some(k => !['author', 'date'].includes(k))
    || typeof metadata.author !== 'string' || !metadata.author.trim() || metadata.author.length > 1024
    || /[\x00-\x1f]/u.test(metadata.author) || typeof metadata.date !== 'string'
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(metadata.date)
    || !Number.isFinite(Date.parse(metadata.date))) fail('RECORDING_METADATA_INVALID');
  if (workingDoc?.attrs?.[review.KEY]) fail('RECORDING_RENDERER_LEDGER_FORBIDDEN');
  const before = baseline(doc), working = baseline(workingDoc).source;
  const current = review.materialize(before);
  const shape = document => { const result = clone(document); review.paragraphs(result).forEach(p => { p.content = []; p.type = 'paragraph'; delete p.attrs; }); return result; };
  if (!equal(shape(current), shape(working))) fail('RECORDING_STRUCTURE_UNSUPPORTED');
  const after = clone(before); let nextId = 1, nextGroup = 1, changed = false;
  const currentParagraphs = review.paragraphs(current), workingParagraphs = review.paragraphs(working);
  const sourceParagraphs = review.paragraphs(before.source), afterParagraphs = review.paragraphs(after.source);
  for (const row of [before, ...before.roundUndo, ...before.roundRedo]) for (const r of row.revisions) {
    nextId = Math.max(nextId, Number(r.id.slice(9)) + 1);
    nextGroup = Math.max(nextGroup, Number(r.groupId?.slice(6) || 0) + 1);
  }
  const add = (operation, paragraphIndex, from, to, groupId = null, format = undefined) => {
    if (nextId > 9999) fail('PENDING_REVISIONS_ID_BUDGET');
    const id = nextId++;
    after.revisions.push({ id: `revision-${id}`, nativeId: `yalken-${id}`, operation, author: metadata.author,
      date: metadata.date, dateUtc: metadata.date, groupId, paragraphIndex, from, to, state: 'pending',
      ...(format ? { format } : {}) });
    changed = true;
  };
  const marksOf = node => node?.type === 'text' ? node.marks || [] : [];
  const markIntervals = (oldNodes, newNodes) => {
    const rows = nodes => { let offset = 0; return nodes.map(node => {
      const from = offset; offset += node.type === 'hardBreak' ? 1 : node.text.length;
      return { from, to: offset, node };
    }); };
    const oldRows = rows(oldNodes), newRows = rows(newNodes);
    const cuts = [...new Set([...oldRows, ...newRows].flatMap(r => [r.from, r.to]))].sort((a, b) => a - b);
    const intervals = [];
    for (let i = 1; i < cuts.length; i++) {
      const from = cuts[i - 1], to = cuts[i];
      const old = oldRows.find(r => r.from <= from && r.to >= to)?.node;
      const next = newRows.find(r => r.from <= from && r.to >= to)?.node;
      if (!old || !next || old.type !== next.type) fail('RECORDING_FORMAT_TEXT_MISMATCH');
      const beforeMarks = marksOf(old), afterMarks = marksOf(next);
      if (stable(beforeMarks) === stable(afterMarks)) continue;
      const previous = intervals.at(-1);
      if (previous && previous.to === from && stable(previous.before) === stable(beforeMarks)
        && stable(previous.after) === stable(afterMarks)) previous.to = to;
      else intervals.push({ from, to, before: clone(beforeMarks), after: clone(afterMarks) });
    }
    return intervals;
  };
  for (let index = 0; index < workingParagraphs.length; index++) {
    const old = currentParagraphs[index], next = workingParagraphs[index];
    if (equal(old, next)) continue;
    const a = text(old), b = text(next), p = afterParagraphs[index];
    const oldRevisions = after.revisions.filter(r => r.paragraphIndex === index);
    let insertionAt = Infinity, addedLength = 0;
    let unchanged = [[0, a.length, 0, b.length]];
    if (a !== b) {
      // Walk Unicode scalars so a revision boundary cannot split a surrogate pair.
      const aa = [...a], bb = [...b]; let left = 0, right = 0;
      while (left < aa.length && left < bb.length && aa[left] === bb[left]) left++;
      while (right < aa.length - left && right < bb.length - left && aa[aa.length - 1 - right] === bb[bb.length - 1 - right]) right++;
      const start = aa.slice(0, left).join('').length;
      const oldEnd = a.length - aa.slice(aa.length - right).join('').length;
      const newEnd = b.length - bb.slice(bb.length - right).join('').length;
      unchanged = [[0, start, 0, start], [oldEnd, a.length, newEnd, b.length]];
      const from = visibleOffsetToSource(before, index, start, sourceParagraphs[index]);
      const to = visibleOffsetToSource(before, index, oldEnd, sourceParagraphs[index]);
      if (oldRevisions.filter(r => !review.isParagraphFormat(r)).some(r => from === to ? r.from < from && r.to > from : r.from < to && r.to > from))
        fail('RECORDING_EXISTING_REVISION_OVERLAP');
      const inserted = slice(next.content, start, newEnd); addedLength = newEnd - start; insertionAt = to;
      p.content = [...slice(p.content, 0, to), ...inserted, ...slice(p.content, to, text(p).length)];
      for (const r of oldRevisions) {
        if (review.isParagraphFormat(r)) r.to += addedLength;
        else if (r.from >= to) { r.from += addedLength; r.to += addedLength; }
      }
      let groupId = null;
      if (to > from && addedLength) {
        if (nextGroup > 9999) fail('PENDING_REVISIONS_ID_BUDGET');
        groupId = `group-${nextGroup++}`;
      }
      if (to > from) add('delete', index, from, to, groupId);
      if (addedLength) add('insert', index, to, to + addedLength, groupId);
    }
    for (const [oldStart, oldEnd, newStart, newEnd] of unchanged) {
      for (const interval of markIntervals(slice(old.content, oldStart, oldEnd), slice(next.content, newStart, newEnd))) {
        let from = visibleOffsetToSource(before, index, oldStart + interval.from, sourceParagraphs[index]);
        let to = visibleOffsetToSource(before, index, oldStart + interval.to, sourceParagraphs[index]);
        if (from >= insertionAt) { from += addedLength; to += addedLength; }
        if (after.revisions.some(r => r.paragraphIndex === index && !review.isParagraphFormat(r) && r.from < to && r.to > from))
          fail('RECORDING_EXISTING_REVISION_OVERLAP');
        const styled = slice(p.content, from, to).map(n => {
          if (n.type === 'hardBreak') return n;
          const result = { ...n }; delete result.marks;
          if (interval.after.length) result.marks = clone(interval.after);
          return result;
        });
        p.content = [...slice(p.content, 0, from), ...styled, ...slice(p.content, to, text(p).length)];
        add('format', index, from, to, null, { kind: 'run', before: interval.before, after: interval.after });
      }
    }
    const oldProperties = review.paragraphProperties(old), newProperties = review.paragraphProperties(next);
    if (stable(oldProperties) !== stable(newProperties)) {
      if (oldRevisions.some(review.isParagraphFormat)) fail('RECORDING_EXISTING_REVISION_OVERLAP');
      p.type = next.type; delete p.attrs;
      if (next.attrs) p.attrs = clone(next.attrs);
      add('format', index, 0, text(p).length, null, { kind: 'paragraph', before: oldProperties, after: newProperties });
    }
  }
  if (!changed) return { changed: false, doc: clone(doc) };
  after.revisions.sort((a, b) => a.paragraphIndex - b.paragraphIndex || a.from - b.from);
  const previous = frame(before); previous.redo = [];
  after.roundUndo.push(previous); after.roundRedo = []; after.undo = []; after.redo = [];
  const result = review.bindLedger(after);
  if (!equal(review.materialize(after), working)) fail('RECORDING_PROJECTION_MISMATCH');
  return { changed: true, doc: result };
}
module.exports = { prepare, derive };

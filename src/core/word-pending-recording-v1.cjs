'use strict';

const review = require('./word-pending-text-revisions-v1.cjs');
const clone = value => JSON.parse(JSON.stringify(value));
const fail = code => { throw Object.assign(Error(code), { code }); };
const text = paragraph => (paragraph.content || []).map(n => n.type === 'hardBreak' ? '\n' : n.text).join('');
const equal = (a, b) => JSON.stringify(review.normalizeNode(a)) === JSON.stringify(review.normalizeNode(b));
const frame = ledger => clone(Object.fromEntries(['schemaVersion', 'source', 'revisions', 'undo', 'redo'].map(k => [k, ledger[k]])));

function baseline(doc) {
  const ledger = review.readLedger(doc);
  if (ledger) return { ...clone(ledger), schemaVersion: 2, roundUndo: clone(ledger.roundUndo || []),
    roundRedo: clone(ledger.roundRedo || []), returnReceipts: clone(ledger.returnReceipts || []) };
  const source = review.normalizeNode(doc);
  if (source.attrs) fail('RECORDING_DOCUMENT_ATTRIBUTES_UNSUPPORTED');
  source.content?.forEach(p => { p.content ||= []; });
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
function visibleOffsetToSource(ledger, index, wanted) {
  const length = text(ledger.source.content[index]).length;
  const changes = ledger.revisions.filter(r => r.paragraphIndex === index);
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
  if (current.content.length !== working.content.length) fail('RECORDING_STRUCTURE_UNSUPPORTED');
  const after = clone(before); let nextId = 1, nextGroup = 1, changed = false;
  for (const row of [before, ...before.roundUndo, ...before.roundRedo]) for (const r of row.revisions) {
    nextId = Math.max(nextId, Number(r.id.slice(9)) + 1);
    nextGroup = Math.max(nextGroup, Number(r.groupId?.slice(6) || 0) + 1);
  }
  for (let index = 0; index < working.content.length; index++) {
    const old = current.content[index], next = working.content[index];
    if (!equal({ ...old, content: [] }, { ...next, content: [] })) fail('RECORDING_STRUCTURE_UNSUPPORTED');
    if (equal(old, next)) continue;
    const a = text(old), b = text(next);
    if (a === b) fail('RECORDING_FORMAT_UNSUPPORTED');
    // Walk Unicode scalars so a revision boundary cannot split a surrogate pair.
    const aa = [...a], bb = [...b]; let left = 0, right = 0;
    while (left < aa.length && left < bb.length && aa[left] === bb[left]) left++;
    while (right < aa.length - left && right < bb.length - left && aa[aa.length - 1 - right] === bb[bb.length - 1 - right]) right++;
    const start = aa.slice(0, left).join('').length;
    const oldEnd = a.length - aa.slice(aa.length - right).join('').length;
    const newEnd = b.length - bb.slice(bb.length - right).join('').length;
    for (const [oldRange, newRange] of [[[0, start], [0, start]], [[oldEnd, a.length], [newEnd, b.length]]]) {
      if (!equal({ type: 'paragraph', content: slice(old.content, ...oldRange) },
        { type: 'paragraph', content: slice(next.content, ...newRange) })) fail('RECORDING_FORMAT_UNSUPPORTED');
    }
    const from = visibleOffsetToSource(before, index, start), to = visibleOffsetToSource(before, index, oldEnd);
    const oldRevisions = after.revisions.filter(r => r.paragraphIndex === index);
    if (oldRevisions.some(r => from === to ? r.from < from && r.to > from : r.from < to && r.to > from)) fail('RECORDING_EXISTING_REVISION_OVERLAP');
    const inserted = slice(next.content, start, newEnd), addedLength = newEnd - start;
    const p = after.source.content[index], originalLength = text(p).length;
    p.content = [...slice(p.content, 0, to), ...inserted, ...slice(p.content, to, originalLength)];
    for (const r of oldRevisions) if (r.from >= to) { r.from += addedLength; r.to += addedLength; }
    let groupId = null;
    if (to > from && addedLength) {
      if (nextGroup > 9999) fail('PENDING_REVISIONS_ID_BUDGET');
      groupId = `group-${nextGroup++}`;
    }
    const add = (operation, begin, end) => {
      if (nextId > 9999) fail('PENDING_REVISIONS_ID_BUDGET');
      const id = nextId++;
      after.revisions.push({ id: `revision-${id}`, nativeId: `yalken-${id}`, operation, author: metadata.author,
        date: metadata.date, dateUtc: metadata.date, groupId, paragraphIndex: index, from: begin, to: end, state: 'pending' });
    };
    if (to > from) add('delete', from, to);
    if (addedLength) add('insert', to, to + addedLength);
    changed = true;
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

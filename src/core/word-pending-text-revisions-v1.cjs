'use strict';

// Canonical scene-owned review state. The displayed document is a checked
// projection, never a second source of truth for a pending change.
const KEY = 'wordPendingRevisions';
const MAX_BYTES = 4 * 1024 * 1024;
const stable = value => Array.isArray(value) ? '[' + value.map(stable).join(',') + ']' : object(value) ? '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + stable(value[k])).join(',') + '}' : JSON.stringify(value);
const clone = value => JSON.parse(JSON.stringify(value));
const fail = code => { throw Object.assign(new Error(code), { code }); };
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const exact = (value, keys) => object(value) && Object.keys(value).every(key => keys.includes(key));
const status = value => ['pending', 'accepted', 'rejected'].includes(value);
const textOf = node => node.type === 'hardBreak' ? '\n' : node.text;
function assert(condition, code = 'PENDING_REVISIONS_INVALID') { if (!condition) fail(code); }
function safeBoundary(text, offset) {
  return Number.isSafeInteger(offset) && offset >= 0 && offset <= text.length
    && !(offset > 0 && offset < text.length && /[\ud800-\udbff]/u.test(text[offset - 1]) && /[\udc00-\udfff]/u.test(text[offset]));
}
function normalizeNode(node) {
  const out = { type: node.type };
  if (node.text !== undefined) out.text = node.text;
  const attrs = Object.fromEntries(Object.entries(node.attrs || {}).filter(([key, value]) => key !== KEY && value !== null && value !== undefined));
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
function validateSource(doc) {
  assert(exact(doc, ['type', 'content']) && doc.type === 'doc' && Array.isArray(doc.content) && doc.content.length > 0 && doc.content.length <= 10000);
  for (const p of doc.content) {
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
  assert(Array.isArray(input.revisions) && input.revisions.length >= (input.schemaVersion === 1 ? 1 : 0) && input.revisions.length <= 1024);
  const ids = new Set(), groups = new Map(); let previousParagraph = -1, previousEnd = 0;
  for (const r of input.revisions) {
    assert(exact(r, ['id', 'nativeId', 'operation', 'author', 'date', 'dateUtc', 'groupId', 'paragraphIndex', 'from', 'to', 'state']));
    assert(/^revision-[1-9]\d{0,3}$/u.test(r.id) && !ids.has(r.id)); ids.add(r.id);
    assert(typeof r.nativeId === 'string' && r.nativeId.length <= 80 && typeof r.author === 'string' && r.author.length <= 1024);
    assert(typeof r.date === 'string' && r.date.length <= 80 && typeof r.dateUtc === 'string' && r.dateUtc.length <= 80);
    assert(![r.nativeId, r.author, r.date, r.dateUtc].some(value => /[\x00-\x08\x0b\x0c\x0e-\x1f]/u.test(value)));
    assert(['insert', 'delete'].includes(r.operation) && status(r.state));
    assert(Number.isInteger(r.paragraphIndex) && r.paragraphIndex >= 0 && r.paragraphIndex >= previousParagraph && r.paragraphIndex < input.source.content.length);
    const p = input.source.content[r.paragraphIndex], text = p.content.map(textOf).join('');
    assert(safeBoundary(text, r.from) && safeBoundary(text, r.to) && r.to > r.from && (r.paragraphIndex !== previousParagraph || r.from >= previousEnd));
    previousParagraph = r.paragraphIndex; previousEnd = r.to;
    assert(r.groupId === null || /^group-[1-9]\d{0,3}$/u.test(r.groupId));
    if (r.groupId) { const group = groups.get(r.groupId) || []; group.push(r); groups.set(r.groupId, group); }
  }
  for (const group of groups.values()) assert(group.length === 2 && group[0].operation !== group[1].operation
    && group[0].paragraphIndex === group[1].paragraphIndex && group[0].to === group[1].from
    && group[0].author === group[1].author && group[0].state === group[1].state, 'PENDING_REVISIONS_GROUP_INVALID');
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
function revisionMeaning(ledger, revision) {
  const text = ledger.source.content[revision.paragraphIndex].content.map(textOf).join('').slice(revision.from, revision.to);
  return JSON.stringify([revision.paragraphIndex, revision.operation, revision.author, revision.date, revision.dateUtc, text]);
}
function preserveReturnedIdentities(before, proposed) {
  const occurrences = new Map(), oldById = new Map(before.revisions.map(r => [r.id, r]));
  let nextRevision = Math.max(0, ...before.revisions.map(r => Number(r.id.slice(9)))) + 1;
  let nextGroup = Math.max(0, ...before.revisions.map(r => Number(r.groupId?.slice(6) || 0))) + 1;
  for (const revision of before.revisions.filter(r => r.state === 'pending')) {
    const key = revisionMeaning(before, revision), rows = occurrences.get(key) || [];
    rows.push(revision); occurrences.set(key, rows);
  }
  const incomingCounts = new Map();
  for (const revision of proposed.revisions) {
    const key = revisionMeaning(proposed, revision);
    incomingCounts.set(key, (incomingCounts.get(key) || 0) + 1);
  }
  for (const [key, rows] of occurrences) {
    const count = incomingCounts.get(key) || 0;
    assert(count === 0 || count === rows.length, 'PENDING_RETURN_IDENTITY_AMBIGUOUS');
  }
  const groups = new Map();
  for (const revision of proposed.revisions) {
    assert(revision.state === 'pending', 'PENDING_RETURN_STATE_INVALID');
    const previous = occurrences.get(revisionMeaning(proposed, revision))?.shift();
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
  source.content?.forEach(p => { p.content ||= []; });
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
  if (mode === 'original') return revision.operation === 'delete';
  if (revision.state === 'rejected') return revision.operation === 'delete';
  return revision.operation === 'insert';
}
function segments(ledger, paragraphIndex, mode = 'current') {
  const p = ledger.source.content[paragraphIndex];
  const changes = ledger.revisions.filter(r => r.paragraphIndex === paragraphIndex);
  const result = []; let offset = 0;
  for (const node of p.content) {
    const text = textOf(node), end = offset + text.length;
    const cuts = [...new Set([offset, end, ...changes.flatMap(r => [r.from, r.to]).filter(n => n > offset && n < end)])].sort((a, b) => a - b);
    for (let i = 1; i < cuts.length; i++) {
      const from = cuts[i - 1], to = cuts[i];
      const revision = changes.find(r => r.from <= from && r.to >= to);
      if (revision && mode !== 'export' && !includeRevision(revision, mode)) continue;
      if (revision && mode === 'export' && revision.state !== 'pending' && !includeRevision(revision, 'current')) continue;
      result.push({ node: node.type === 'hardBreak' ? clone(node) : { ...clone(node), text: text.slice(from - offset, to - offset) },
        revision: mode === 'export' && revision?.state === 'pending' ? clone(revision) : null });
    }
    offset = end;
  }
  return result;
}
function materialize(input, mode = 'current') {
  const ledger = validateLedger(input);
  assert(['current', 'original'].includes(mode));
  return { type: 'doc', content: ledger.source.content.map((p, i) => ({ ...clone(p), content: segments(ledger, i, mode).map(s => s.node) })) };
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
  const text = value => value.content.map(p => (p.content || []).map(textOf).join('')).join('\n');
  return { original: text(materialize(ledger, 'original')), current: text(materialize(ledger)),
    canUndo: ledger.undo.length > 0 || Boolean(ledger.roundUndo?.length), canRedo: ledger.redo.length > 0 || Boolean(ledger.roundRedo?.length),
    revisions: ledger.revisions.map(r => ({ ...clone(r), text: ledger.source.content[r.paragraphIndex].content.map(textOf).join('').slice(r.from, r.to) })) };
}
module.exports = { KEY, validateLedger, bindLedger, readLedger, materialize, segments, decide, projection, normalizeNode, replaceFromReturn };

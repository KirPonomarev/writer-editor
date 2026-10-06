'use strict';

const review = require('./word-pending-text-revisions-v1.cjs');
const clone = value => JSON.parse(JSON.stringify(value));
const fail = code => { throw Object.assign(Error(code), { code }); };
const text = paragraph => (paragraph.content || []).map(n => n.type === 'hardBreak' ? '\n' : n.text).join('');
const stable = value => Array.isArray(value) ? '[' + value.map(stable).join(',') + ']'
  : value && typeof value === 'object' ? '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + stable(value[k])).join(',') + '}' : JSON.stringify(value);
const equal = (a, b) => stable(review.normalizeNode(a)) === stable(review.normalizeNode(b));
const frame = ledger => review.roundFrame(ledger);

function baseline(doc) {
  const ledger = review.readLedger(doc);
  if (ledger?.schemaVersion === 3 || ledger && Object.hasOwn(ledger,'noteSourcePoints')) fail('RECORDING_NOTE_BINDINGS_UNSUPPORTED');
  if (ledger) return { ...clone(ledger), schemaVersion: ledger.schemaVersion===5?5:2, roundUndo: clone(ledger.roundUndo || []),
    roundRedo: clone(ledger.roundRedo || []), returnReceipts: clone(ledger.returnReceipts || []) };
  const source = review.normalizeNode(doc);
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

// Structural authoring keeps paragraph marks as explicit tokens in the same
// union source as text. This is a bounded flat-paragraph path; container edits
// still go through their own structural contract.
function deriveParagraphBoundaries(doc, before, working, metadata) {
  const current = review.materialize(before);
  if (equal(current, working)) return { changed: false, doc: clone(doc) };
  if (![before.source, working].every(d => d.content.every(p => ['paragraph', 'heading'].includes(p.type))))
    fail('RECORDING_STRUCTURE_UNSUPPORTED');
  let nextId = 1;
  for (const row of [before, ...before.roundUndo, ...before.roundRedo]) for (const r of row.revisions)
    nextId = Math.max(nextId, Number(r.id.slice(9)) + 1);
  const tokens = (document, ledger) => document.content.flatMap((p, index) => {
    const changes = ledger?.revisions.filter(r => r.paragraphIndex === index) || [];
    const result = []; let offset = 0;
    for (const node of p.content || []) for (const ch of node.type === 'hardBreak' ? ['\n'] : [...node.text]) {
      const revision = changes.find(r => !review.isParagraphFormat(r) && !review.isParagraphBoundary(r) && r.from <= offset && r.to > offset);
      const scalar = node.type === 'hardBreak' ? clone(node) : { ...clone(node), text: ch };
      const visible = clone(scalar);
      if (revision?.operation === 'format' && visible.type === 'text') {
        delete visible.marks;
        const marks = revision.format[revision.state === 'rejected' ? 'before' : 'after'];
        if (marks.length) visible.marks = clone(marks);
      }
      result.push({ kind: 'char', node: scalar, visible, oldP: index, oldOffset: offset, revision });
      offset += ch.length;
    }
    const format = changes.find(review.isParagraphFormat), properties = review.paragraphProperties(p);
    result.push({ kind: 'boundary', properties, visible: format ? format.format[format.state === 'rejected' ? 'before' : 'after'] : properties,
      oldP: index, oldOffset: offset, terminal: index === document.content.length - 1, formatRevision: format,
      revision: changes.find(review.isParagraphBoundary) });
    return result;
  });
  const original = tokens(before.source, before), desired = tokens(working);
  const included = t => !t.revision || t.revision.operation === 'format'
    || t.revision.operation === (t.revision.state === 'rejected' ? 'delete' : 'insert');
  const visible = original.filter(included);
  const same = (a, b) => a.kind === b.kind && Boolean(a.terminal) === Boolean(b.terminal)
    && (a.kind === 'boundary' || stable(review.normalizeNode(a.visible)) === stable(review.normalizeNode(b.visible)));
  const retain = (old, next) => {
    if (old.kind !== 'boundary' || stable(old.visible) === stable(next.visible)) return;
    if (old.formatRevision) fail('RECORDING_EXISTING_REVISION_OVERLAP');
    old.propertyAfter = clone(next.properties);
  };
  // Matching rich characters allow multiple Enter/Delete gestures to retain
  // the intervening text instead of manufacturing text replacement revisions.
  const oldChars = visible.filter(t => t.kind === 'char'), newChars = desired.filter(t => t.kind === 'char');
  let union;
  const append = (list, values, operation) => {
    for (const token of values) {
      if (token.terminal) fail('RECORDING_STRUCTURE_FORMAT_UNSUPPORTED');
      if (operation === 'delete' && token.revision) fail('RECORDING_EXISTING_REVISION_OVERLAP');
      list.push(operation === 'insert' ? { ...clone(token), revision: undefined, fresh: operation } : Object.assign(token, { fresh: operation }));
    }
  };
  if (oldChars.length === newChars.length && oldChars.every((t, i) => same(t, newChars[i]))) {
    const newAt = new Map(); let offset = 0;
    for (const t of desired) {
      if (t.kind === 'char') { offset++; continue; }
      const list = newAt.get(offset) || []; list.push(t); newAt.set(offset, list);
    }
    union = []; offset = 0; let i = 0;
    while (i < original.length) {
      const group = [];
      while (i < original.length && (!included(original[i]) || original[i].kind === 'boundary')) group.push(original[i++]);
      const previous = group.filter(t => included(t) && t.kind === 'boundary'), wanted = newAt.get(offset) || [];
      let matched = 0;
      while (matched < previous.length && matched < wanted.length && same(previous[matched], wanted[matched])) matched++;
      let suffix = 0;
      while (suffix < previous.length - matched && suffix < wanted.length - matched
        && same(previous[previous.length - 1 - suffix], wanted[wanted.length - 1 - suffix])) suffix++;
      for (let j = 0; j < matched; j++) retain(previous[j], wanted[j]);
      for (let j = 1; j <= suffix; j++) retain(previous[previous.length - j], wanted[wanted.length - j]);
      const added = wanted.slice(matched, wanted.length - suffix); let inserted = false;
      for (const token of group) {
        const at = previous.indexOf(token);
        if (suffix && at === previous.length - suffix) { append(union, added, 'insert'); inserted = true; }
        if (!included(token) || at < matched || at >= previous.length - suffix) union.push(token);
        else append(union, [token], 'delete');
      }
      if (!inserted) append(union, added, 'insert');
      if (i < original.length) { union.push(original[i++]); offset++; }
    }
  } else {
    let left = 0, right = 0;
    while (left < visible.length && left < desired.length && same(visible[left], desired[left])) left++;
    while (right < visible.length - left && right < desired.length - left
      && same(visible[visible.length - 1 - right], desired[desired.length - 1 - right])) right++;
    for (let j = 0; j < left; j++) retain(visible[j], desired[j]);
    for (let j = 1; j <= right; j++) retain(visible[visible.length - j], desired[desired.length - j]);
    const removed = visible.slice(left, visible.length - right), added = desired.slice(left, desired.length - right);
    if (!removed.length && visible[left - 1]?.revision && visible[left - 1].revision === visible[left]?.revision)
      fail('RECORDING_EXISTING_REVISION_OVERLAP');
    const end = removed.length ? original.indexOf(removed.at(-1)) + 1 : left < visible.length ? original.indexOf(visible[left]) : original.length;
    append([], removed, 'delete');
    const inserted = []; append(inserted, added, 'insert');
    union = [...original.slice(0, end), ...inserted, ...original.slice(end)];
  }
  if (before.source.attrs?.wordSections) fail('RECORDING_SECTION_STRUCTURE_UNSUPPORTED');
  const after = clone(before), source = { ...clone(before.source), content: [] }, locations = new Map(), boundaryLocations = new Map();
  const fresh = []; let nodes = [], offset = 0, paragraphIndex = 0, active = null;
  const finish = () => { if (active) { fresh.push(active); active = null; } };
  for (const token of union) {
    if (token.kind === 'boundary') {
      finish();
      if (token.fresh) fresh.push({ operation: token.fresh, paragraphIndex, from: offset, to: offset, boundary: 'paragraph' });
      else boundaryLocations.set(token.oldP, { paragraphIndex, offset });
      if (token.propertyAfter) fresh.push({ operation: 'format', paragraphIndex, from: 0, to: offset,
        format: { kind: 'paragraph', before: clone(token.visible), after: clone(token.propertyAfter) } });
      source.content.push({ ...clone(token.propertyAfter || token.properties), content: nodes }); nodes = []; offset = 0; paragraphIndex++; continue;
    }
    const length = token.node.type === 'hardBreak' ? 1 : token.node.text.length;
    if (token.fresh) {
      if (!active || active.operation !== token.fresh) { finish(); active = { operation: token.fresh, paragraphIndex, from: offset, to: offset }; }
      active.to += length;
    } else {
      finish();
      if (token.revision) {
        const positions = locations.get(token.revision.id) || [];
        positions.push({ paragraphIndex, from: offset, to: offset + length }); locations.set(token.revision.id, positions);
      }
    }
    nodes.push(clone(token.node)); offset += length;
  }
  if (nodes.length) fail('RECORDING_STRUCTURE_UNSUPPORTED');
  after.source = source;
  for (const r of after.revisions) {
    if (review.isParagraphBoundary(r) || review.isParagraphFormat(r)) {
      const location = boundaryLocations.get(r.paragraphIndex);
      if (!location) fail('RECORDING_EXISTING_REVISION_OVERLAP');
      r.paragraphIndex = location.paragraphIndex; r.from = review.isParagraphFormat(r) ? 0 : location.offset; r.to = location.offset;
    } else {
      const positions = locations.get(r.id) || [];
      if (!positions.length || positions.some(p => !p || p.paragraphIndex !== positions[0].paragraphIndex)) fail('RECORDING_EXISTING_REVISION_OVERLAP');
      r.paragraphIndex = positions[0].paragraphIndex; r.from = positions[0].from; r.to = positions.at(-1).to;
    }
  }
  for (const r of fresh) {
    if (nextId > 9999) fail('PENDING_REVISIONS_ID_BUDGET');
    const id = nextId++;
    after.revisions.push({ ...r, id: `revision-${id}`, nativeId: `yalken-${id}`, author: metadata.author, date: metadata.date,
      dateUtc: metadata.date, groupId: null, state: 'pending' });
  }
  after.revisions.sort((a, b) => a.paragraphIndex - b.paragraphIndex || a.from - b.from);
  const previous = frame(before); previous.redo = [];
  after.roundUndo.push(previous); after.roundRedo = []; after.undo = []; after.redo = [];
  const result = review.bindLedger(review.compactRoundHistory(after));
  if (!equal(result, working)) fail('RECORDING_CURRENT_PROJECTION_MISMATCH');
  if (!equal(review.materialize(after, 'original'), review.materialize(before, 'original'))) fail('RECORDING_ORIGINAL_PROJECTION_MISMATCH');
  return { changed: true, doc: result };
}

// Row ownership is carried by exact table position and source node identity.
// Content is used only to derive a local recording delta, never return authority.
function deriveTableRows(doc, before, working, metadata) {
  const current = review.materialize(before);
  if (equal(current, working)) return { changed: false, doc: clone(doc) };
  if (before.revisions.some(review.isParagraphBoundary) || current.content.length !== working.content.length
    || before.source.content.length !== current.content.length) fail('RECORDING_STRUCTURE_UNSUPPORTED');
  const after = clone(before), previousLeaves = review.paragraphs(after.source), fresh = [];
  const oldRows = review.tableRows(after.source);
  let nextId = 1;
  for (const state of [before, ...before.roundUndo, ...before.roundRedo]) for (const r of state.revisions)
    nextId = Math.max(nextId, Number(r.id.slice(9)) + 1);
  const included = r => !r || r.operation === (r.state === 'rejected' ? 'delete' : 'insert');
  let tableIndex = 0;
  for (let block = 0; block < current.content.length; block++) {
    const existing = current.content[block], desired = working.content[block], source = after.source.content[block];
    if (existing.type !== 'table' || desired.type !== 'table') {
      if (!equal(existing, desired)) fail('RECORDING_STRUCTURE_UNSUPPORTED');
      continue;
    }
    const owners = oldRows.filter(row => row.tableIndex === tableIndex); tableIndex++;
    if (stable(existing.attrs || {}) !== stable(desired.attrs || {})
      || owners.some(row => row.node.content.some(cell => (cell.attrs?.rowspan || 1) !== 1))) fail('RECORDING_STRUCTURE_UNSUPPORTED');
    const revisionFor = owner => after.revisions.find(r => review.isTableRow(r) && r.paragraphIndex === owner.paragraphIndex);
    const visible = owners.filter(owner => included(revisionFor(owner)));
    if (visible.length !== existing.content.length) fail('RECORDING_TABLE_ROW_BINDING');
    const a = existing.content.map(row => stable(review.normalizeNode(row))), b = desired.content.map(row => stable(review.normalizeNode(row)));
    const matrix = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1));
    for (let x = a.length - 1; x >= 0; x--) for (let y = b.length - 1; y >= 0; y--)
      matrix[x][y] = a[x] === b[y] ? 1 + matrix[x + 1][y + 1] : Math.max(matrix[x + 1][y], matrix[x][y + 1]);
    const matches = []; let x = 0, y = 0;
    while (x < a.length && y < b.length) {
      if (a[x] === b[y]) { matches.push([x++, y++]); }
      else if (matrix[x + 1][y] >= matrix[x][y + 1]) x++; else y++;
    }
    matches.push([a.length, b.length]);
    const rows = []; let sourceAt = 0, desiredAt = 0;
    const keep = new Set(matches.filter(([i]) => i < visible.length).map(([i]) => visible[i]));
    for (const [i, j] of matches) {
      const stop = i < visible.length ? owners.indexOf(visible[i]) : owners.length;
      while (sourceAt < stop) {
        const owner = owners[sourceAt++]; rows.push(owner.node);
        if (!included(revisionFor(owner))) continue;
        if (keep.has(owner)) fail('RECORDING_TABLE_ROW_BINDING');
        if (after.revisions.some(r => r.paragraphIndex >= owner.paragraphIndex && r.paragraphIndex < owner.paragraphIndex + owner.paragraphCount))
          fail('RECORDING_EXISTING_REVISION_OVERLAP');
        fresh.push({ node: owner.node, operation: 'delete' });
      }
      while (desiredAt < j) {
        const node = clone(desired.content[desiredAt++]); rows.push(node); fresh.push({ node, operation: 'insert' });
      }
      if (i < visible.length) { rows.push(owners[sourceAt++].node); desiredAt++; }
    }
    source.content = rows;
  }
  const leaves = review.paragraphs(after.source), rows = review.tableRows(after.source);
  for (const r of after.revisions) {
    const node = previousLeaves[r.paragraphIndex]; r.paragraphIndex = leaves.indexOf(node);
    if (r.paragraphIndex < 0) fail('RECORDING_TABLE_ROW_BINDING');
    if (review.isTableRow(r)) {
      const owner = rows.find(row => row.paragraphIndex === r.paragraphIndex);
      r.structure = { kind: 'tableRow', tableIndex: owner.tableIndex, rowIndex: owner.rowIndex };
    }
  }
  for (const change of fresh) {
    if (nextId > 9999) fail('PENDING_REVISIONS_ID_BUDGET');
    const owner = rows.find(row => row.node === change.node), id = nextId++;
    after.revisions.push({ id: `revision-${id}`, nativeId: `yalken-${id}`, operation: change.operation,
      author: metadata.author, date: metadata.date, dateUtc: metadata.date, groupId: null, state: 'pending',
      paragraphIndex: owner.paragraphIndex, from: 0, to: 0,
      structure: { kind: 'tableRow', tableIndex: owner.tableIndex, rowIndex: owner.rowIndex } });
  }
  after.revisions.sort((a, b) => a.paragraphIndex - b.paragraphIndex || a.from - b.from);
  const previous = frame(before); previous.redo = [];
  after.roundUndo.push(previous); after.roundRedo = []; after.undo = []; after.redo = [];
  const result = review.bindLedger(review.compactRoundHistory(after));
  if (!equal(result, working)) fail('RECORDING_CURRENT_PROJECTION_MISMATCH');
  if (!equal(review.materialize(after, 'original'), review.materialize(before, 'original'))) fail('RECORDING_ORIGINAL_PROJECTION_MISMATCH');
  return { changed: true, doc: result };
}

// Pure derivation from a stable session baseline, not from the last autosave.
// The caller supplies main-owned author/time and owns all save authority.
function derive(doc, workingDoc, metadata, editIntents) {
  if (!metadata || Object.keys(metadata).some(k => !['author', 'date'].includes(k))
    || typeof metadata.author !== 'string' || !metadata.author.trim() || metadata.author.length > 1024
    || /[\x00-\x1f]/u.test(metadata.author) || typeof metadata.date !== 'string'
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(metadata.date)
    || !Number.isFinite(Date.parse(metadata.date))) fail('RECORDING_METADATA_INVALID');
  if (workingDoc?.attrs?.[review.KEY]) fail('RECORDING_RENDERER_LEDGER_FORBIDDEN');
  const before = baseline(doc), working = baseline(workingDoc).source;
  const current = review.materialize(before);
  const exact = editIntents === undefined ? null : require('./word-pending-recording-intents-v1.cjs')
    .deriveChanges(review.paragraphs(current).map(text), review.paragraphs(working).map(text), editIntents);
  const shape = document => { const result = clone(document); review.paragraphs(result).forEach(p => { p.content = []; p.type = 'paragraph'; delete p.attrs; }); return result; };
  const oldLeaves = review.paragraphs(current), newLeaves = review.paragraphs(working);
  const changedBoundariesOnly = [current, working].every(d => d.content.every(p => ['paragraph', 'heading'].includes(p.type)))
    && oldLeaves.map(text).join('') === newLeaves.map(text).join('')
    && stable(oldLeaves.map(text)) !== stable(newLeaves.map(text));
  const sameShape = equal(shape(current), shape(working));
  if (!sameShape && current.content.some(n => n.type === 'table')) return deriveTableRows(doc, before, working, metadata);
  const sourceIndexes = review.paragraphs(before.source).map((_, i) => i);
  if (before.revisions.some(review.isTableRow)) {
    const hidden = review.tableRows(before.source).filter(row => {
      const r = before.revisions.find(r => review.isTableRow(r) && r.paragraphIndex === row.paragraphIndex);
      return r && r.operation !== (r.state === 'rejected' ? 'delete' : 'insert');
    });
    for (let i = sourceIndexes.length - 1; i >= 0; i--)
      if (hidden.some(row => i >= row.paragraphIndex && i < row.paragraphIndex + row.paragraphCount)) sourceIndexes.splice(i, 1);
  }
  if (changedBoundariesOnly || !sameShape || oldLeaves.length !== sourceIndexes.length) {
    if (exact) fail('RECORDING_INTENT_STRUCTURE_UNSUPPORTED');
    return deriveParagraphBoundaries(doc, before, working, metadata);
  }
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
  for (let visibleIndex = 0; visibleIndex < workingParagraphs.length; visibleIndex++) {
    const index = sourceIndexes[visibleIndex];
    const old = currentParagraphs[visibleIndex], next = workingParagraphs[visibleIndex];
    if (equal(old, next) && !exact?.changes[visibleIndex]?.length) continue;
    const row = review.tableRows(before.source).find(row => index >= row.paragraphIndex && index < row.paragraphIndex + row.paragraphCount);
    if (row && before.revisions.some(r => review.isTableRow(r) && r.paragraphIndex === row.paragraphIndex)) fail('RECORDING_EXISTING_REVISION_OVERLAP');
    const a = text(old), b = text(next), p = afterParagraphs[index];
    const oldRevisions = before.revisions.filter(r => r.paragraphIndex === index);
    const shifts = [];
    let changes = exact?.changes[visibleIndex] || [];
    if (!exact && a !== b) {
      const aa = [...a], bb = [...b]; let left = 0, right = 0;
      while (left < aa.length && left < bb.length && aa[left] === bb[left]) left++;
      while (right < aa.length - left && right < bb.length - left && aa[aa.length - 1 - right] === bb[bb.length - 1 - right]) right++;
      const start = aa.slice(0, left).join('').length;
      changes = [{ from: start, to: a.length - aa.slice(aa.length - right).join('').length,
        newFrom: start, newTo: b.length - bb.slice(bb.length - right).join('').length }];
    }
    const unchanged = []; let oldAt = 0, newAt = 0;
    for (const change of changes) {
      unchanged.push([oldAt, change.from, newAt, change.newFrom]);
      oldAt = change.to; newAt = change.newTo;
    }
    unchanged.push([oldAt, a.length, newAt, b.length]);
    // Right-to-left insertion preserves the baseline offsets of every earlier
    // change. Retained rich runs between disjoint edits stay outside revisions.
    for (const change of changes.slice().reverse()) {
      const from = visibleOffsetToSource(before, index, change.from, sourceParagraphs[index]);
      const to = visibleOffsetToSource(before, index, change.to, sourceParagraphs[index]);
      if (oldRevisions.filter(r => !review.isParagraphFormat(r)).some(r => from === to ? r.from < from && r.to > from : r.from < to && r.to > from))
        fail('RECORDING_EXISTING_REVISION_OVERLAP');
      const inserted = slice(next.content, change.newFrom, change.newTo), addedLength = change.newTo - change.newFrom;
      p.content = [...slice(p.content, 0, to), ...inserted, ...slice(p.content, to, text(p).length)];
      for (const r of after.revisions.filter(r => r.paragraphIndex === index)) {
        if (review.isParagraphFormat(r)) r.to += addedLength;
        else if (r.from >= to) { r.from += addedLength; r.to += addedLength; }
      }
      shifts.push({ at: to, length: addedLength });
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
        const shift = shifts.filter(s => s.at <= from).reduce((sum, s) => sum + s.length, 0);
        from += shift; to += shift;
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
  // Exact relocation is a property of this admitted authoring delta, not an
  // authority inferred from a quote. Only new, ungrouped changes participate;
  // repeated candidates and differing rich marks retain ordinary text review.
  const previousIds = new Set(before.revisions.map(r => r.id)), relocations = new Map();
  for (const revision of after.revisions) {
    if (exact || previousIds.has(revision.id) || revision.groupId || !['insert', 'delete'].includes(revision.operation)) continue;
    const nodes = slice(afterParagraphs[revision.paragraphIndex].content, revision.from, revision.to);
    if (!nodes.some(n => n.type === 'text' && /\S/u.test(n.text))) continue;
    const key = stable(review.normalizeNode({ type: 'paragraph', content: nodes }));
    const candidates = relocations.get(key) || { insert: [], delete: [] };
    candidates[revision.operation].push(revision); relocations.set(key, candidates);
  }
  const usedNames = new Set(before.revisions.map(r => r.moveName).filter(Boolean));
  for (const candidates of relocations.values()) {
    if (candidates.insert.length !== 1 || candidates.delete.length !== 1) continue;
    const [destination] = candidates.insert, [origin] = candidates.delete;
    if (origin.paragraphIndex === destination.paragraphIndex) continue;
    while (usedNames.has(`YalkenRecordedMove${nextGroup}`)) nextGroup++;
    if (nextGroup > 9999) fail('PENDING_REVISIONS_ID_BUDGET');
    const groupId = `group-${nextGroup}`, moveName = `YalkenRecordedMove${nextGroup++}`;
    usedNames.add(moveName);
    for (const revision of [origin, destination]) { revision.groupId = groupId; revision.moveName = moveName; }
  }
  after.revisions.sort((a, b) => a.paragraphIndex - b.paragraphIndex || a.from - b.from);
  const previous = frame(before); previous.redo = [];
  after.roundUndo.push(previous); after.roundRedo = []; after.undo = []; after.redo = [];
  const result = review.bindLedger(review.compactRoundHistory(after));
  if (!equal(review.materialize(after), working)) fail('RECORDING_PROJECTION_MISMATCH');
  return { changed: true, doc: result };
}
module.exports = { prepare, derive };

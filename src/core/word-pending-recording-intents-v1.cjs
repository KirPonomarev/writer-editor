'use strict';

const { replayEditIntents, textDigest } = require('./word-comment-edit-intents-v1.cjs');
const clone = value => JSON.parse(JSON.stringify(value));
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const fail = code => { throw Object.assign(Error(code), { code }); };
const length = piece => piece.text === undefined ? piece.to - piece.from : piece.text.length;
const initial = texts => texts.map(t => t.length ? [{ from: 0, to: t.length }] : []);

function compact(pieces) {
  const result = [];
  for (const piece of pieces) {
    if (!length(piece)) continue;
    const last = result.at(-1);
    if (last && last.text !== undefined && piece.text !== undefined) last.text += piece.text;
    else if (last && last.text === undefined && piece.text === undefined && last.to === piece.from) last.to = piece.to;
    else result.push({ ...piece });
  }
  return result;
}
function slice(pieces, from, to) {
  const result = []; let at = 0;
  for (const p of pieces) {
    const end = at + length(p), left = Math.max(from, at), right = Math.min(to, end);
    if (right > left) result.push(p.text === undefined
      ? { from: p.from + left - at, to: p.from + right - at }
      : { text: p.text.slice(left - at, right - at) });
    at = end;
  }
  return result;
}
function apply(pieces, edit) {
  const row = pieces[edit.fromParagraphIndex];
  pieces[edit.fromParagraphIndex] = compact([...slice(row, 0, edit.fromUtf16),
    { text: edit.insertedParagraphs[0] }, ...slice(row, edit.toUtf16, Infinity)]);
}
function reverse(edit) {
  return { ...edit, fromUtf16: edit.fromUtf16, toUtf16: edit.fromUtf16 + edit.insertedParagraphs[0].length,
    removedParagraphs: edit.insertedParagraphs, insertedParagraphs: edit.removedParagraphs };
}
function normalizeEdit(edit, version) {
  if (version === 2) {
    if (edit.fromParagraphIndex !== edit.toParagraphIndex || edit.insertedParagraphs.length !== 1)
      fail('RECORDING_INTENT_STRUCTURE_UNSUPPORTED');
    return edit;
  }
  return { id: edit.id, historyId: edit.historyId, direction: edit.direction,
    fromParagraphIndex: edit.paragraphIndex, toParagraphIndex: edit.paragraphIndex,
    fromUtf16: edit.fromUtf16, toUtf16: edit.toUtf16,
    removedParagraphs: [edit.removedText], insertedParagraphs: [edit.insertText] };
}

// Retained source intervals establish occurrence identity. Inserted text never
// becomes original merely because its letters match. Only a checked inverse
// of a known authoring history group can restore removed source intervals.
function deriveChanges(beforeTexts, afterTexts, input) {
  const { plan, steps } = replayEditIntents(beforeTexts, afterTexts, input);
  const pieces = initial(beforeTexts), history = new Map();
  const groups = [];
  for (let i = 0; i < plan.edits.length; i++) {
    const edit = normalizeEdit(plan.edits[i], plan.schemaVersion), last = groups.at(-1);
    if (last?.historyId === edit.historyId && last.direction === edit.direction) last.edits.push(edit);
    else groups.push({ historyId: edit.historyId, direction: edit.direction, edits: [edit], step: i });
  }
  for (const group of groups) {
    const saved = history.get(group.historyId);
    if (group.direction === 'forward') {
      if (saved && (saved.undone || !equal(pieces, saved.after))) fail('RECORDING_INTENT_HISTORY_STALE');
      const before = saved?.before || clone(pieces);
      group.edits.forEach(e => apply(pieces, e));
      history.set(group.historyId, { before, after: clone(pieces), edits: [...(saved?.edits || []), ...group.edits], undone: false });
      continue;
    }
    if (!saved || saved.undone !== (group.direction === 'redo')
      || !equal(pieces, group.direction === 'undo' ? saved.after : saved.before)) fail('RECORDING_INTENT_HISTORY_STALE');
    const step = steps[group.step];
    // Compare the affected occurrences, allowing PM to coalesce adjacent steps.
    // Comparing final strings alone would accept Undo at another identical word.
    const texts = plan.schemaVersion === 2 ? step.beforeParagraphs
      : pieces.map((row, index) => row.map(p => p.text === undefined ? beforeTexts[index].slice(p.from, p.to) : p.text).join(''));
    const actual = initial(texts), expected = initial(texts);
    group.edits.forEach(e => apply(actual, e));
    (group.direction === 'undo' ? saved.edits.slice().reverse().map(reverse) : saved.edits).forEach(e => apply(expected, e));
    if (!equal(actual, expected)) fail('RECORDING_INTENT_HISTORY_MISMATCH');
    pieces.splice(0, pieces.length, ...clone(group.direction === 'undo' ? saved.before : saved.after));
    saved.undone = group.direction === 'undo';
  }
  const changes = pieces.map((row, index) => {
    let original = 0, position = 0, pending = null;
    const result = [];
    const finish = to => {
      if (pending || to !== original) result.push({ from: original, to,
        newFrom: pending?.from ?? position, newTo: position });
      original = to; pending = null;
    };
    for (const p of row) {
      if (p.text !== undefined) { pending ||= { from: position }; position += p.text.length; continue; }
      if (p.from < original) fail('RECORDING_INTENT_ORDER_INVALID');
      finish(p.from); original = p.to; position += p.to - p.from;
    }
    finish(beforeTexts[index].length);
    return result;
  });
  const projected = pieces.map((row, index) => row.map(p => p.text === undefined ? beforeTexts[index].slice(p.from, p.to) : p.text).join(''));
  if (!equal(projected, afterTexts)) fail('RECORDING_INTENT_PROJECTION_MISMATCH');
  return { changes, plan, baselineTextSha256: textDigest(beforeTexts) };
}

module.exports = { deriveChanges };

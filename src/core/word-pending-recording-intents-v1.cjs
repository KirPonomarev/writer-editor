'use strict';

const { replayEditIntents, textDigest } = require('./word-comment-edit-intents-v1.cjs');
const clone = value => JSON.parse(JSON.stringify(value));
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const fail = code => { throw Object.assign(Error(code), { code }); };
const boundary = piece => Object.hasOwn(piece, 'boundary');
const length = piece => boundary(piece) ? 1 : piece.text === undefined ? piece.to - piece.from : piece.text.length;
const initial = texts => texts.flatMap((text, paragraphIndex) => [
  ...(text.length ? [{ paragraphIndex, from: 0, to: text.length }] : []),
  ...(paragraphIndex < texts.length - 1 ? [{ boundary: paragraphIndex }] : []),
]);
const structural = edit => edit.fromParagraphIndex !== edit.toParagraphIndex || edit.insertedParagraphs.length !== 1;
function rows(pieces) {
  const result = [[]];
  for (const piece of pieces) {
    if (boundary(piece)) result.push([]);
    else result.at(-1).push(piece);
  }
  return result;
}
const materialize = (pieces, texts) => rows(pieces).map(row => row.map(p => p.text === undefined
  ? texts[p.paragraphIndex].slice(p.from, p.to) : p.text).join(''));

function compact(pieces) {
  const result = [];
  for (const piece of pieces) {
    if (!length(piece)) continue;
    const last = result.at(-1);
    if (last && !boundary(last) && !boundary(piece) && last.text !== undefined && piece.text !== undefined) last.text += piece.text;
    else if (last && !boundary(last) && !boundary(piece) && last.text === undefined && piece.text === undefined
      && last.paragraphIndex === piece.paragraphIndex && last.to === piece.from) last.to = piece.to;
    else result.push({ ...piece });
  }
  return result;
}
function slice(pieces, from, to) {
  const result = []; let at = 0;
  for (const p of pieces) {
    const end = at + length(p), left = Math.max(from, at), right = Math.min(to, end);
    if (right > left) result.push(boundary(p) ? { ...p } : p.text === undefined
      ? { paragraphIndex: p.paragraphIndex, from: p.from + left - at, to: p.from + right - at }
      : { text: p.text.slice(left - at, right - at) });
    at = end;
  }
  return result;
}
function apply(pieces, edit) {
  const starts = [0]; let at = 0;
  for (const piece of pieces) {
    at += length(piece);
    if (boundary(piece)) starts.push(at);
  }
  const from = starts[edit.fromParagraphIndex] + edit.fromUtf16;
  const to = starts[edit.toParagraphIndex] + edit.toUtf16;
  const inserted = edit.insertedParagraphs.flatMap((text, index) => [
    ...(text.length ? [{ text }] : []),
    ...(index < edit.insertedParagraphs.length - 1 ? [{ boundary: null }] : []),
  ]);
  pieces.splice(0, pieces.length, ...compact([...slice(pieces, 0, from),
    ...inserted, ...slice(pieces, to, Infinity)]));
}
function reverse(edit) {
  return { ...edit, toParagraphIndex: edit.fromParagraphIndex + edit.insertedParagraphs.length - 1,
    toUtf16: edit.insertedParagraphs.length === 1 ? edit.fromUtf16 + edit.insertedParagraphs[0].length : edit.insertedParagraphs.at(-1).length,
    removedParagraphs: edit.insertedParagraphs, insertedParagraphs: edit.removedParagraphs };
}
function normalizeEdit(edit, version) {
  if (version === 2) return edit;
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
  if (!beforeTexts.length) return { changes: [], plan, baselineTextSha256: textDigest(beforeTexts) };
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
    const texts = plan.schemaVersion === 2 ? step.beforeParagraphs : materialize(pieces, beforeTexts);
    const actual = initial(texts), expected = initial(texts);
    group.edits.forEach(e => apply(actual, e));
    (group.direction === 'undo' ? saved.edits.slice().reverse().map(reverse) : saved.edits).forEach(e => apply(expected, e));
    if (!equal(actual, expected)) fail('RECORDING_INTENT_HISTORY_MISMATCH');
    pieces.splice(0, pieces.length, ...clone(group.direction === 'undo' ? saved.before : saved.after));
    saved.undone = group.direction === 'undo';
  }
  // Replay structure only to prove its checked Undo. Surviving structural
  // changes keep the existing refusal; equal letters cannot recreate a boundary.
  if ([...history.values()].some(saved => !saved.undone && saved.edits.some(structural)))
    fail('RECORDING_INTENT_STRUCTURE_UNSUPPORTED');
  const boundaries = pieces.filter(boundary);
  if (boundaries.length !== beforeTexts.length - 1 || boundaries.some((p, i) => p.boundary !== i))
    fail('RECORDING_INTENT_STRUCTURE_UNSUPPORTED');
  const changes = rows(pieces).map((row, index) => {
    let original = 0, position = 0, pending = null;
    const result = [];
    const finish = to => {
      if (pending || to !== original) result.push({ from: original, to,
        newFrom: pending?.from ?? position, newTo: position });
      original = to; pending = null;
    };
    for (const p of row) {
      if (p.text !== undefined) { pending ||= { from: position }; position += p.text.length; continue; }
      if (p.paragraphIndex !== index) fail('RECORDING_INTENT_ORDER_INVALID');
      if (p.from < original) fail('RECORDING_INTENT_ORDER_INVALID');
      finish(p.from); original = p.to; position += p.to - p.from;
    }
    finish(beforeTexts[index].length);
    return result;
  });
  const projected = materialize(pieces, beforeTexts);
  if (!equal(projected, afterTexts)) fail('RECORDING_INTENT_PROJECTION_MISMATCH');
  return { changes, plan, baselineTextSha256: textDigest(beforeTexts) };
}

module.exports = { deriveChanges };

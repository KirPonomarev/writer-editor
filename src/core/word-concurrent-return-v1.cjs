'use strict';

// Semantic planning only. Authentication, current-version CAS and publication
// remain in Main and the existing project transaction adapter.
const bookmarks = require('./word-user-bookmarks-v1.cjs');
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const copy = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const conflict = (detail, location = '') => ({ ok: false, code: 'RTK_WORD_CONCURRENT_CONFLICT', detail, location });
const MAX_CELLS = 2000000;
const segmenter = new Intl.Segmenter('und', { granularity: 'grapheme' });
const characters = value => Array.from(segmenter.segment(value), segment => segment.segment);

function edits(before, after) {
  const a = characters(before), b = characters(after);
  let start = 0, endA = a.length, endB = b.length;
  while (start < endA && start < endB && a[start] === b[start]) start++;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) { endA--; endB--; }
  const n = endA - start, m = endB - start;
  if (!n && !m) return { ok: true, edits: [] };
  if (!n || !m) return { ok: true, edits: [{ from: start, to: endA, text: b.slice(start, endB).join('') }] };
  if ((n + 1) * (m + 1) > MAX_CELLS) return conflict('diff-budget');
  const width = m + 1, scores = new Uint32Array((n + 1) * width);
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) {
    scores[i * width + j] = a[start + i] === b[start + j]
      ? scores[(i + 1) * width + j + 1] + 1
      : Math.max(scores[(i + 1) * width + j], scores[i * width + j + 1]);
  }
  const trace = preferDelete => {
    let i = 0, j = 0, pending = null;
    const result = [];
    const flush = () => { if (pending) result.push(pending); pending = null; };
    while (i < n || j < m) {
      if (i < n && j < m && a[start + i] === b[start + j]) { flush(); i++; j++; continue; }
      if (!pending) pending = { from: start + i, to: start + i, text: '' };
      const del = i < n ? scores[(i + 1) * width + j] : -1;
      const ins = j < m ? scores[i * width + j + 1] : -1;
      if (i < n && (del > ins || (del === ins && preferDelete))) { i++; pending.to = start + i; }
      else { pending.text += b[start + j]; j++; }
    }
    flush();
    return result;
  };
  // Insertion/deletion order inside one replacement is immaterial. Distinct
  // equally short alignments of conserved text are not safe ownership evidence.
  const result = trace(true);
  if (!equal(result, trace(false))) return conflict('ambiguous-text-alignment');
  return { ok: true, edits: result };
}

function intersects(a, b) {
  if (a.from === a.to) return b.from <= a.from && a.from <= b.to;
  if (b.from === b.to) return a.from <= b.from && b.from <= a.to;
  return a.from < b.to && b.from < a.to;
}

function mergeText(baseline, local, returned) {
  if (![baseline, local, returned].every(value => typeof value === 'string')) return conflict('text-invalid');
  if ([baseline, local, returned].some(value => value.length > 1000000)) return conflict('text-budget');
  if (local === returned || returned === baseline) return { ok: true, text: local };
  if (local === baseline) return { ok: true, text: returned };
  const left = edits(baseline, local), right = edits(baseline, returned);
  if (!left.ok) return left;
  if (!right.ok) return right;
  const merged = [...left.edits];
  for (const change of right.edits) {
    if (left.edits.some(other => equal(other, change))) continue;
    if (left.edits.some(other => intersects(other, change))) return conflict('overlapping-text-edits');
    merged.push(change);
  }
  const chars = characters(baseline);
  let text = '', cursor = 0;
  for (const change of merged.sort((a, b) => a.from - b.from)) {
    text += chars.slice(cursor, change.from).join('') + change.text;
    cursor = change.to;
  }
  return { ok: true, text: text + chars.slice(cursor).join('') };
}

function attributedText(node) {
  const content = node.content || [];
  if (content.some(run => run.type !== 'text' || typeof run.text !== 'string'
    || Object.keys(run).some(key => !['type', 'text', 'marks'].includes(key)))) return null;
  const text = content.map(run => run.text).join('');
  if (text.length > 1000000) return null;
  const tokens = [];
  let runIndex = 0, runEnd = content[0]?.text.length || 0;
  for (const { segment, index } of segmenter.segment(text)) {
    while (runIndex < content.length && runEnd <= index) runEnd += content[++runIndex]?.text.length || 0;
    const shape = { type: 'text', ...(Object.hasOwn(content[runIndex], 'marks') ? { marks: content[runIndex].marks } : {}) };
    // A grapheme divided across differently formatted leaves is indivisible.
    // Do not guess which run owns a combining mark or part of an emoji.
    while (index + segment.length > runEnd) {
      runEnd += content[++runIndex]?.text.length || 0;
      const nextShape = { type: 'text', ...(Object.hasOwn(content[runIndex], 'marks') ? { marks: content[runIndex].marks } : {}) };
      if (!equal(shape, nextShape)) return null;
    }
    tokens.push({ text: segment, shape });
  }
  return { text, tokens };
}

function alignAttributed(base, side) {
  const diff = edits(base.text, side.text);
  if (!diff.ok) return diff;
  const kept = [], changes = [];
  let baseCursor = 0, sideCursor = 0;
  for (const change of diff.edits) {
    while (baseCursor < change.from) kept[baseCursor++] = side.tokens[sideCursor++];
    const length = characters(change.text).length;
    changes.push({ ...change, tokens: side.tokens.slice(sideCursor, sideCursor + length) });
    sideCursor += length;
    baseCursor = change.to;
  }
  while (baseCursor < base.tokens.length) kept[baseCursor++] = side.tokens[sideCursor++];
  return { ok: true, kept, changes };
}

function mergeAttributedText(baseNode, localNode, returnedNode) {
  const runs = [baseNode, localNode, returnedNode].map(attributedText);
  if (runs.some(run => !run)) return conflict('concurrent-inline-format-or-atom');
  const [base, local, returned] = runs;
  const left = alignAttributed(base, local), right = alignAttributed(base, returned);
  if (!left.ok) return left;
  if (!right.ok) return right;
  const changes = [...left.changes];
  for (const change of right.changes) {
    const identical = left.changes.find(other => other.from === change.from && other.to === change.to && other.text === change.text);
    if (identical) {
      if (!equal(identical.tokens, change.tokens)) return conflict('overlapping-inline-format');
      continue;
    }
    if (left.changes.some(other => intersects(other, change))) return conflict('overlapping-text-edits');
    changes.push(change);
  }
  for (const [side, other] of [[left, right], [right, left]]) for (const change of side.changes) {
    for (let i = change.from; i < change.to; i++) {
      if (other.kept[i] && !equal(other.kept[i].shape, base.tokens[i].shape)) return conflict('text-overlaps-inline-format');
    }
  }
  const content = [];
  let lastShape;
  const append = token => {
    const previous = content.at(-1);
    if (previous && equal(lastShape, token.shape)) previous.text += token.text;
    else { content.push({ ...copy(token.shape), text: token.text }); lastShape = token.shape; }
  };
  const appendKept = index => {
    const original = base.tokens[index], a = left.kept[index], b = right.kept[index];
    if (!a || !b) return conflict('text-alignment-invalid');
    if (equal(a.shape, b.shape) || equal(original.shape, b.shape)) append(a);
    else if (equal(original.shape, a.shape)) append(b);
    else return conflict('overlapping-inline-format');
    return { ok: true };
  };
  let cursor = 0;
  for (const change of changes.sort((a, b) => a.from - b.from)) {
    while (cursor < change.from) { const result = appendKept(cursor++); if (!result.ok) return result; }
    for (const token of change.tokens) append(token);
    cursor = change.to;
  }
  while (cursor < base.tokens.length) { const result = appendKept(cursor++); if (!result.ok) return result; }
  return { ok: true, content };
}

function mergeValue(base, local, returned, location) {
  if (equal(local, returned) || equal(base, returned)) return { ok: true, value: copy(local) };
  if (equal(base, local)) return { ok: true, value: copy(returned) };
  if (base?.type && ['paragraph', 'heading'].includes(base.type)
    && [base, local, returned].some(node => Object.hasOwn(node, 'content'))) {
    const text = mergeAttributedText(base, local, returned);
    if (!text.ok) return { ...text, location };
    const withoutContent = node => Object.fromEntries(Object.entries(node).filter(([key]) => key !== 'content'));
    const props = mergeValue(withoutContent(base), withoutContent(local), withoutContent(returned), location + '.properties');
    if (!props.ok) return props;
    const value = props.value;
    value.content = text.content;
    return { ok: true, value };
  }
  if (Array.isArray(base) && Array.isArray(local) && Array.isArray(returned)) {
    if (base.length !== local.length || base.length !== returned.length) return conflict('concurrent-structure', location);
    const value = [];
    for (let i = 0; i < base.length; i++) {
      const next = mergeValue(base[i], local[i], returned[i], location + '[' + i + ']');
      if (!next.ok) return next;
      value.push(next.value);
    }
    return { ok: true, value };
  }
  if ([base, local, returned].every(value => value && typeof value === 'object' && !Array.isArray(value))) {
    const value = {};
    for (const key of new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(returned)])) {
      const next = mergeValue(base[key], local[key], returned[key], location + '.' + key);
      if (!next.ok) return next;
      if (next.value !== undefined) value[key] = next.value;
    }
    return { ok: true, value };
  }
  return conflict('overlapping-property-edits', location);
}

function topology(node) {
  if (['paragraph', 'heading'].includes(node.type)) return node.type;
  return [node.type, (node.content || []).filter(child => child.type !== 'text').map(topology)];
}

function planConcurrentReturn({ baselineDoc, currentDoc, returnedDoc } = {}) {
  try {
    let budget = 50000, textBudget = 8 * 1024 * 1024;
    const validate = (value, depth = 0) => {
      if (--budget < 0 || depth > 128) throw Error('document-budget');
      if (typeof value === 'string') { textBudget -= value.length; if (textBudget < 0) throw Error('document-budget'); return; }
      if (value === null || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) return;
      if (typeof value !== 'object') throw Error('document-invalid');
      if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype) throw Error('document-invalid');
      for (const key of Reflect.ownKeys(value)) {
        if (typeof key !== 'string' || ['__proto__', 'constructor', 'prototype'].includes(key)) throw Error('document-invalid');
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!Object.hasOwn(descriptor, 'value')) throw Error('document-accessor');
        validate(descriptor.value, depth + 1);
      }
    };
    for (const doc of [baselineDoc, currentDoc, returnedDoc]) { validate(doc); if (doc?.type !== 'doc') throw Error('document-invalid'); }
    if (!equal(topology(baselineDoc), topology(currentDoc)) || !equal(topology(baselineDoc), topology(returnedDoc))) {
      return conflict('scene-topology-changed');
    }
    const docs = [baselineDoc, currentDoc, returnedDoc].map(copy);
    // Bookmark positions are derived by the existing Core anchor planner from
    // current -> merged; returned endpoint authenticity was independently
    // checked against baseline -> returned before calling this planner.
    for (const doc of docs) if (doc.attrs) { delete doc.attrs.wordUserBookmarks; if (!Object.keys(doc.attrs).length) delete doc.attrs; }
    const result = mergeValue(...docs, 'doc');
    if (!result.ok) return result;
    if (currentDoc.attrs?.wordUserBookmarks) result.value.attrs = { ...result.value.attrs, wordUserBookmarks: copy(currentDoc.attrs.wordUserBookmarks) };
    const plan = bookmarks.planSave({ beforeDoc: currentDoc, workingDoc: result.value });
    return { ok: true, doc: plan.doc, changed: !equal(currentDoc, plan.doc) };
  } catch (error) { return conflict(error.code || error.message || 'document-invalid'); }
}

module.exports = { mergeText, planConcurrentReturn };

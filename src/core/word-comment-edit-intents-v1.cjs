'use strict';
const { sha256UpdateCompatible: sha } = require('./browser-safe-hash.cjs');
const fail = code => { throw Object.assign(new Error(code), {code}); };
const ID = /^[A-Za-z0-9_.:-]{1,96}$/u;
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
function data(value, depth = 0, seen = new Set()) {
  if (depth > 8) fail('COMMENT_EDIT_INTENT_INVALID');
  if (value === null || ['string','number','boolean'].includes(typeof value)) return;
  if (!value || typeof value !== 'object' || seen.has(value) || (!Array.isArray(value) && ![null,Object.prototype].includes(Object.getPrototypeOf(value)))) fail('COMMENT_EDIT_INTENT_INVALID');
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) {
    const d = Object.getOwnPropertyDescriptor(value,key);
    if (typeof key !== 'string' || !Object.hasOwn(d,'value')) fail('COMMENT_EDIT_INTENT_INVALID');
    data(d.value,depth+1,seen);
  }
  seen.delete(value);
}
const keys = (value, names) => value && !Array.isArray(value) && Object.keys(value).sort().join(',') === names.slice().sort().join(',');
function validateEditIntents(input) {
  let value = input;
  if (typeof value === 'string') {
    if (Buffer.byteLength(value,'utf8') > 65536) fail('COMMENT_EDIT_INTENT_BUDGET');
    try { value = JSON.parse(value); } catch { fail('COMMENT_EDIT_INTENT_INVALID'); }
  }
  data(value);
  if (!keys(value,['schemaVersion','baselineTextSha256','edits']) || value.schemaVersion !== 1 || !digest(value.baselineTextSha256)
    || !Array.isArray(value.edits) || value.edits.length > 256) fail('COMMENT_EDIT_INTENT_INVALID');
  const ids = new Set();
  for (const e of value.edits) {
    if (!keys(e,['id','historyId','direction','paragraphIndex','fromUtf16','toUtf16','removedText','insertText'])
      || !ID.test(e.id) || !ID.test(e.historyId) || ids.has(e.id) || !['forward','undo','redo'].includes(e.direction)
      || !Number.isSafeInteger(e.paragraphIndex) || e.paragraphIndex < 0 || e.paragraphIndex >= 10000
      || !Number.isSafeInteger(e.fromUtf16) || e.fromUtf16 < 0 || !Number.isSafeInteger(e.toUtf16) || e.toUtf16 < e.fromUtf16
      || typeof e.removedText !== 'string' || typeof e.insertText !== 'string'
      || e.removedText.length !== e.toUtf16-e.fromUtf16 || e.removedText === e.insertText
      || /[\r\n]/u.test(e.removedText + e.insertText)) fail('COMMENT_EDIT_INTENT_INVALID');
    ids.add(e.id);
  }
  const json = JSON.stringify(value);
  if (Buffer.byteLength(json,'utf8') > 65536) fail('COMMENT_EDIT_INTENT_BUDGET');
  return JSON.parse(json);
}
const textDigest = texts => sha(JSON.stringify(texts));
const boundaries = text => new Set([text.length,...Array.from(new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(text),x=>x.index)]);
function replayEditIntents(beforeTexts, afterTexts, input) {
  const plan = validateEditIntents(input);
  if (!Array.isArray(beforeTexts) || !Array.isArray(afterTexts) || beforeTexts.length !== afterTexts.length
    || beforeTexts.some(x=>typeof x!=='string') || afterTexts.some(x=>typeof x!=='string')
    || textDigest(beforeTexts) !== plan.baselineTextSha256) fail('COMMENT_EDIT_BASELINE_STALE');
  const current = beforeTexts.slice(), steps = [];
  for (const edit of plan.edits) {
    const before = current[edit.paragraphIndex];
    if (typeof before !== 'string' || edit.toUtf16 > before.length || before.slice(edit.fromUtf16,edit.toUtf16) !== edit.removedText
      || !boundaries(before).has(edit.fromUtf16) || !boundaries(before).has(edit.toUtf16)) fail('COMMENT_EDIT_SPLICE_STALE');
    const after = before.slice(0,edit.fromUtf16)+edit.insertText+before.slice(edit.toUtf16);
    if (!boundaries(after).has(edit.fromUtf16) || !boundaries(after).has(edit.fromUtf16+edit.insertText.length)) fail('COMMENT_EDIT_GRAPHEME');
    current[edit.paragraphIndex] = after;
    steps.push({edit,before,after});
  }
  if (current.some((text,i)=>text!==afterTexts[i])) fail('COMMENT_EDIT_REPLAY_MISMATCH');
  return {plan,steps};
}
// Word-calibrated affinities: points/right, range start/right and end/left.
function mapAnchorSplice(anchor, edit, afterText) {
  const start = anchor.startUtf16, end = start+anchor.selectedText.length;
  const from = edit.fromUtf16, to = edit.toUtf16, added = edit.insertText.length, delta = added-(to-from);
  const endpoint = (position,right) => position < from ? position : position > to ? position+delta : from+(right?added:0);
  if (anchor.kind === 'point' && !boundaries(afterText).has(endpoint(start,true))) fail('COMMENT_EDIT_GRAPHEME');
  if (anchor.kind === 'point') return {anchor:{...anchor,startUtf16:endpoint(start,true),blockTextSha256:sha(afterText)},deleted:false};
  if (from <= start && to >= end && to > from) return {anchor:{...anchor,blockTextSha256:sha(afterText)},deleted:true};
  let nextStart = endpoint(start,true), nextEnd = endpoint(end,false);
  if (nextEnd <= nextStart) fail('COMMENT_EDIT_RANGE_INVALID');
  if (!boundaries(afterText).has(nextStart) || !boundaries(afterText).has(nextEnd)) fail('COMMENT_EDIT_GRAPHEME');
  const selectedText = afterText.slice(nextStart,nextEnd);
  return {anchor:{...anchor,startUtf16:nextStart,selectedText,selectedTextSha256:sha(selectedText),blockTextSha256:sha(afterText)},deleted:false};
}
module.exports = {validateEditIntents,replayEditIntents,mapAnchorSplice,textDigest};

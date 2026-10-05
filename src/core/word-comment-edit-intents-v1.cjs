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
  if (!keys(value,['schemaVersion','baselineTextSha256','edits']) || ![1,2].includes(value.schemaVersion) || !digest(value.baselineTextSha256)
    || !Array.isArray(value.edits) || value.edits.length > 256) fail('COMMENT_EDIT_INTENT_INVALID');
  const ids = new Set();
  for (const e of value.edits) {
    if (value.schemaVersion === 2) {
      if (!keys(e,['id','historyId','direction','fromParagraphIndex','fromUtf16','toParagraphIndex','toUtf16','removedParagraphs','insertedParagraphs'])
        || typeof e.id !== 'string' || typeof e.historyId !== 'string' || !ID.test(e.id) || !ID.test(e.historyId) || ids.has(e.id)
        || !['forward','undo','redo'].includes(e.direction)
        || !Number.isSafeInteger(e.fromParagraphIndex) || e.fromParagraphIndex<0 || !Number.isSafeInteger(e.toParagraphIndex)
        || e.toParagraphIndex<e.fromParagraphIndex || e.toParagraphIndex>=10000
        || !Number.isSafeInteger(e.fromUtf16) || e.fromUtf16<0 || !Number.isSafeInteger(e.toUtf16) || e.toUtf16<0
        || (e.fromParagraphIndex===e.toParagraphIndex && e.toUtf16<e.fromUtf16)
        || [e.removedParagraphs,e.insertedParagraphs].some(a=>!Array.isArray(a)||!a.length||a.length>10000||a.some(t=>typeof t!=='string'||!t.isWellFormed()||/\r/u.test(t)))
        || e.removedParagraphs.length!==e.toParagraphIndex-e.fromParagraphIndex+1
        || JSON.stringify(e.removedParagraphs)===JSON.stringify(e.insertedParagraphs)) fail('COMMENT_EDIT_INTENT_INVALID');
    } else {
    if (!keys(e,['id','historyId','direction','paragraphIndex','fromUtf16','toUtf16','removedText','insertText'])
      || typeof e.id !== 'string' || typeof e.historyId !== 'string' || !ID.test(e.id) || !ID.test(e.historyId) || ids.has(e.id) || !['forward','undo','redo'].includes(e.direction)
      || !Number.isSafeInteger(e.paragraphIndex) || e.paragraphIndex < 0 || e.paragraphIndex >= 10000
      || !Number.isSafeInteger(e.fromUtf16) || e.fromUtf16 < 0 || !Number.isSafeInteger(e.toUtf16) || e.toUtf16 < e.fromUtf16
      || typeof e.removedText !== 'string' || typeof e.insertText !== 'string'
      || e.removedText.length !== e.toUtf16-e.fromUtf16 || e.removedText === e.insertText
      || !e.removedText.isWellFormed() || !e.insertText.isWellFormed() || /\r/u.test(e.removedText + e.insertText)) fail('COMMENT_EDIT_INTENT_INVALID');
    }
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
  if (!Array.isArray(beforeTexts) || !Array.isArray(afterTexts) || beforeTexts.length>10000 || afterTexts.length>10000
    || beforeTexts.some(x=>typeof x!=='string') || afterTexts.some(x=>typeof x!=='string')
    || textDigest(beforeTexts) !== plan.baselineTextSha256) fail('COMMENT_EDIT_BASELINE_STALE');
  const current = beforeTexts.slice(), steps = [];
  for (const edit of plan.edits) {
    if(plan.schemaVersion===2) {
      const f=edit.fromParagraphIndex,t=edit.toParagraphIndex,first=current[f],last=current[t];
      if(typeof first!=='string'||typeof last!=='string'||edit.fromUtf16>first.length||edit.toUtf16>last.length
        || !boundaries(first).has(edit.fromUtf16)||!boundaries(last).has(edit.toUtf16)) fail('COMMENT_EDIT_SPLICE_STALE');
      const removed=f===t?[first.slice(edit.fromUtf16,edit.toUtf16)]:[first.slice(edit.fromUtf16),...current.slice(f+1,t),last.slice(0,edit.toUtf16)];
      if(JSON.stringify(removed)!==JSON.stringify(edit.removedParagraphs)) fail('COMMENT_EDIT_SPLICE_STALE');
      const replacement=edit.insertedParagraphs.slice();
      replacement[0]=first.slice(0,edit.fromUtf16)+replacement[0];
      replacement[replacement.length-1]+=last.slice(edit.toUtf16);
      const insertedEnd=edit.insertedParagraphs.length===1?edit.fromUtf16+edit.insertedParagraphs[0].length:edit.insertedParagraphs.at(-1).length;
      if(!boundaries(replacement[0]).has(edit.fromUtf16)||!boundaries(replacement.at(-1)).has(insertedEnd)) fail('COMMENT_EDIT_GRAPHEME');
      const beforeParagraphs=current.slice();
      current.splice(f,t-f+1,...replacement);
      if(current.length>10000) fail('COMMENT_EDIT_INTENT_BUDGET');
      steps.push({edit,beforeParagraphs,afterParagraphs:current.slice()});
    } else {
      const before = current[edit.paragraphIndex];
      if (typeof before !== 'string' || edit.toUtf16 > before.length || before.slice(edit.fromUtf16,edit.toUtf16) !== edit.removedText
        || !boundaries(before).has(edit.fromUtf16) || !boundaries(before).has(edit.toUtf16)) fail('COMMENT_EDIT_SPLICE_STALE');
      const after = before.slice(0,edit.fromUtf16)+edit.insertText+before.slice(edit.toUtf16);
      if (!boundaries(after).has(edit.fromUtf16) || !boundaries(after).has(edit.fromUtf16+edit.insertText.length)) fail('COMMENT_EDIT_GRAPHEME');
      current[edit.paragraphIndex] = after;
      steps.push({edit,before,after});
    }
  }
  if (current.length!==afterTexts.length || current.some((text,i)=>text!==afterTexts[i])) fail('COMMENT_EDIT_REPLAY_MISMATCH');
  return {plan,steps};
}
const { mapAnchorSplice } = require('./word-comment-ranges-v1.cjs');
module.exports = {validateEditIntents,replayEditIntents,mapAnchorSplice,textDigest};

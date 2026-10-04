'use strict';

const { sha256UpdateCompatible } = require('./browser-safe-hash.cjs');
const { parseObservablePayload, deriveVisibleTextFromDocument } = require('./document-content-envelope-v1.cjs');
const { tableParagraphs } = require('../io/documentTables.js');
const { replayEditIntents, mapAnchorSplice } = require('./word-comment-edit-intents-v1.cjs');
const { upgradeCommentState } = require('./word-comment-body-v1.cjs');
const { readState } = require('./word-comment-authoring-v1.cjs');
const MODE = 'SAFE_ANCHOR_REBASE_V1';
const sha = text => sha256UpdateCompatible(text);
const fail = code => { throw Object.assign(new Error(code), { code }); };
const edges = text => new Set([text.length, ...Array.from(new Intl.Segmenter(undefined,
  { granularity: 'grapheme' }).segment(text), x => x.index)]);

function paragraphs(content) {
  if (typeof content !== 'string' || Buffer.byteLength(content) > 8 * 1024 * 1024) fail('COMMENT_SAVE_SCENE_BUDGET');
  let parsed;
  try { parsed = parseObservablePayload(content); } catch { fail('COMMENT_SAVE_SCENE_INVALID'); }
  if (parsed.issue) fail('COMMENT_SAVE_SCENE_INVALID');
  if (!parsed.doc) return parsed.text.split('\n').map(text => ({ type: 'paragraph', text }));
  if (parsed.doc.type !== 'doc' || !Array.isArray(parsed.doc.content)
    || parsed.doc.content.length > 10000) fail('COMMENT_SAVE_STRUCTURE_UNSUPPORTED');
  const result = []; let lists = 0, nextTable = 0;
  const append = (block, table) => {
    if (!block || !['paragraph', 'heading', 'codeBlock'].includes(block.type) || result.length >= 10000) fail('COMMENT_SAVE_STRUCTURE_UNSUPPORTED');
    result.push({ type: block.type, text: deriveVisibleTextFromDocument({ type: 'doc', content: [block] }), ...(table ? { table } : {}) });
  };
  const visit = (block, depth = 0) => {
    if (['paragraph', 'heading', 'codeBlock'].includes(block?.type)) { append(block); return; }
    if (block?.type === 'table') {
      for (const leaf of tableParagraphs(block, `comment-table-${nextTable++}`)) append(leaf.node, leaf.table);
      return;
    }
    if (!['bulletList', 'orderedList'].includes(block?.type) || depth > 8 || ++lists > 2048
      || !Array.isArray(block.content) || !block.content.length) fail('COMMENT_SAVE_STRUCTURE_UNSUPPORTED');
    for (const item of block.content) {
      if (item?.type !== 'listItem' || !Array.isArray(item.content) || !['paragraph', 'heading'].includes(item.content[0]?.type)
        || item.content.slice(1).some(child => !['paragraph', 'heading', 'bulletList', 'orderedList'].includes(child?.type))) fail('COMMENT_SAVE_STRUCTURE_UNSUPPORTED');
      append(item.content[0]); for (const child of item.content.slice(1)) visit(child, depth + 1);
    }
  };
  parsed.doc.content.forEach(block => visit(block));
  return result;
}

// Keep only ranges outside every minimum contiguous edit envelope. In repeated
// text the common prefix and suffix overlap; greedily choosing one moves identity.
function rangeMapper(oldText, newText) {
  const oldEdges = edges(oldText), newEdges = edges(newText);
  const n = oldText.length, m = newText.length;
  let prefix = 0, suffix = 0;
  while (prefix < Math.min(n, m) && oldText[prefix] === newText[prefix]) prefix++;
  while (prefix > 0 && (!oldEdges.has(prefix) || !newEdges.has(prefix))) prefix--;
  while (suffix < Math.min(n, m) && oldText[n - suffix - 1] === newText[m - suffix - 1]) suffix++;
  while (suffix > 0 && (!oldEdges.has(n - suffix) || !newEdges.has(m - suffix))) suffix--;
  const earliest = Math.min(prefix, Math.min(n, m) - suffix);
  const latest = Math.max(n - suffix, prefix + Math.max(0, n - m));
  return (start, end) => {
    if (!oldEdges.has(start) || !oldEdges.has(end)) fail('COMMENT_SAVE_GRAPHEME_SPLIT');
    if (oldText === newText) return start;
    const next = end <= earliest ? start : start >= latest ? start + m - n : null;
    if (next === null) fail('COMMENT_SAVE_RANGE_CONFLICT');
    if (!newEdges.has(next) || !newEdges.has(next + end - start)
      || newText.slice(next, next + end - start) !== oldText.slice(start, end)) fail('COMMENT_SAVE_RANGE_CONFLICT');
    return next;
  };
}

// Paragraph separators participate in the edit interval, so Enter inside a
// quote cannot silently turn one range into a range spanning multiple blocks.
function sceneMap(blocks) {
  let offset = 0;
  const starts = blocks.map(block => { const start = offset; offset += block.text.length + 1; return start; });
  return { starts, text: blocks.map(block => block.text).join('\n') };
}
function blockAt(starts, offset) {
  let lo = 0, hi = starts.length;
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (starts[mid] <= offset) lo = mid + 1; else hi = mid; }
  return lo - 1;
}

function planCommentAnchorSave({ beforeText, projectId, sceneId, beforeContent, afterContent, includeUnchanged = false, editIntents, sessionId }) {
  if (beforeText === null) return null;
  const before = readState(beforeText, projectId);
  const unchanged = () => includeUnchanged === true ? { mode: MODE, beforeText, afterText: beforeText } : null;
  if (editIntents !== undefined) return planIntentSave({before,beforeText,sceneId,beforeContent,afterContent,editIntents,sessionId,includeUnchanged});
  if (!before.threads.some(t => t.sceneId === sceneId && t.status !== 'deleted')) return unchanged();
  const old = paragraphs(beforeContent), next = paragraphs(afterContent);
  // A local text edit may move an anchor within its leaf. A changed cell
  // topology cannot silently reassign a repeated paragraph to another owner.
  const topology = blocks => JSON.stringify(blocks.filter(block => block.table).map(block => block.table));
  if (topology(old) !== topology(next)) fail('COMMENT_SAVE_STRUCTURE_UNSUPPORTED');
  const structureChanged = old.length !== next.length;
  if (!structureChanged && old.some((b, i) => b.type !== next[i].type)) fail('COMMENT_SAVE_STRUCTURE_UNSUPPORTED');
  const oldMap = structureChanged ? sceneMap(old) : null, newMap = structureChanged ? sceneMap(next) : null;
  const map = structureChanged ? rangeMapper(oldMap.text, newMap.text) : null;
  const blockMappers = new Map();
  const after = JSON.parse(JSON.stringify(before)); let changed = false;
  for (const thread of after.threads) {
    if (thread.sceneId !== sceneId || thread.status === 'deleted') continue;
    const a = thread.anchor || {}, index = a.sceneParagraphIndex, text = old[index]?.text;
    if (a.sceneId !== sceneId || !Number.isSafeInteger(index) || index < 0 || typeof text !== 'string'
      || !Number.isSafeInteger(a.startUtf16) || a.startUtf16 < 0 || typeof a.selectedText !== 'string'
      || (a.kind !== 'point' && !a.selectedText) || (a.kind === 'point' && (a.affinity !== 'right' || a.selectedText !== '')) || text.slice(a.startUtf16, a.startUtf16 + a.selectedText.length) !== a.selectedText
      || a.blockTextSha256 !== sha(text) || a.selectedTextSha256 !== sha(a.selectedText)) fail('COMMENT_SAVE_ANCHOR_STALE');
    if (a.kind === 'point' && (structureChanged || text !== next[index].text)) fail('COMMENT_SAVE_POINT_INTENT_REQUIRED');
    let newIndex = index, start;
    if (structureChanged) {
      const globalStart = map(oldMap.starts[index] + a.startUtf16,
        oldMap.starts[index] + a.startUtf16 + a.selectedText.length);
      newIndex = blockAt(newMap.starts, globalStart);
      start = globalStart - newMap.starts[newIndex];
      if (!next[newIndex] || next[newIndex].type !== old[index].type
        || start < 0 || start + a.selectedText.length > next[newIndex].text.length
        || next[newIndex].text.slice(start, start + a.selectedText.length) !== a.selectedText) fail('COMMENT_SAVE_RANGE_CONFLICT');
    } else {
      if (!blockMappers.has(index)) blockMappers.set(index, rangeMapper(text, next[index].text));
      start = blockMappers.get(index)(a.startUtf16, a.startUtf16 + a.selectedText.length);
    }
    if (index !== newIndex || text !== next[newIndex].text || a.startUtf16 !== start) {
      thread.anchor = { ...a, sceneParagraphIndex: newIndex,
        ...(newIndex !== index ? { paragraphIndex: newIndex } : {}),
        startUtf16: start, blockTextSha256: sha(next[newIndex].text) }; changed = true;
    }
  }
  if (!changed) return unchanged();
  if (before.revision === Number.MAX_SAFE_INTEGER) fail('COMMENT_SAVE_REVISION_OVERFLOW');
  after.revision++;
  const afterText = JSON.stringify(after, null, 2) + '\n';
  if (Buffer.byteLength(afterText) > 65536) fail('COMMENT_SAVE_STATE_BUDGET');
  return { mode: MODE, beforeText, afterText };
}

function planIntentSave({before,beforeText,sceneId,beforeContent,afterContent,editIntents,sessionId,includeUnchanged}) {
  if (typeof sessionId !== 'string' || !/^[A-Za-z0-9_.:-]{1,160}$/u.test(sessionId)) fail('COMMENT_EDIT_SESSION_INVALID');
  const old = paragraphs(beforeContent), next = paragraphs(afterContent);
  const shape = rows => JSON.stringify(rows.map(({text,...owner})=>owner));
  if (shape(old) !== shape(next)) fail('COMMENT_SAVE_STRUCTURE_UNSUPPORTED');
  const {plan,steps} = replayEditIntents(old.map(x=>x.text),next.map(x=>x.text),editIntents);
  const after = JSON.parse(JSON.stringify(before));
  for (const thread of after.threads.filter(t=>t.sceneId===sceneId && t.status!=='deleted')) {
    const a=thread.anchor, text=old[a?.sceneParagraphIndex]?.text;
    if (!a || a.sceneId!==sceneId || typeof text!=='string' || a.blockTextSha256!==sha(text)
      || a.selectedTextSha256!==sha(a.selectedText) || !edges(text).has(a.startUtf16)
      || !edges(text).has(a.startUtf16+a.selectedText.length)
      || text.slice(a.startUtf16,a.startUtf16+a.selectedText.length)!==a.selectedText
      || (a.kind==='point' ? a.affinity!=='right' || a.selectedText!=='' : !a.selectedText)) fail('COMMENT_SAVE_ANCHOR_STALE');
  }
  const groups=[];
  for (const step of steps) {
    const last=groups[groups.length-1];
    if (last && last[0].edit.historyId===step.edit.historyId && last[0].edit.direction===step.edit.direction) last.push(step);
    else groups.push([step]);
  }
  for (const group of groups) {
    const {historyId,direction}=group[0].edit;
    for (const thread of after.threads.filter(t=>t.sceneId===sceneId)) {
      const selected=group.filter(s=>s.edit.paragraphIndex===thread.anchor?.sceneParagraphIndex);
      if (!selected.length) continue;
      const history=thread.anchorEditHistory || [], last=history[history.length-1];
      const current=()=>JSON.stringify({anchor:thread.anchor,status:thread.status});
      const entry=history.slice().reverse().find(h=>h.sessionId===sessionId && h.historyId===historyId);
      if (direction!=='forward' && entry) {
        const undo=direction==='undo', source=undo?entry.after:entry.before, target=undo?entry.before:entry.after;
        if (entry.undone!==!undo || current()!==JSON.stringify(source)
          || sha(selected[0].before)!==(undo?entry.afterTextSha256:entry.beforeTextSha256)
          || sha(selected[selected.length-1].after)!==(undo?entry.beforeTextSha256:entry.afterTextSha256)) fail('COMMENT_EDIT_HISTORY_STALE');
        thread.anchor=JSON.parse(JSON.stringify(target.anchor)); thread.status=target.status; entry.undone=undo;
        continue;
      }
      if (thread.status==='deleted') continue;
      const prior=JSON.parse(current());
      for (const step of selected) {
        if (thread.status==='deleted') { thread.anchor.blockTextSha256=sha(step.after); continue; }
        const mapped=mapAnchorSplice(thread.anchor,step.edit,step.after);
        thread.anchor=mapped.anchor; if(mapped.deleted) thread.status='deleted';
      }
      if (current()===JSON.stringify(prior)) continue;
      const result=JSON.parse(current());
      // Outside-anchor movement is reversibly replayable. Retain history only
      // when an edit destroys anchor information or changes the selected text.
      const destructive = prior.status!==result.status || prior.anchor.selectedText!==result.anchor.selectedText
        || (prior.anchor.kind==='point' && selected.some(step=>step.edit.toUtf16>step.edit.fromUtf16
          && step.edit.fromUtf16<=prior.anchor.startUtf16 && step.edit.toUtf16>=prior.anchor.startUtf16));
      if (!destructive) continue;
      if (direction==='forward' && last && !last.undone && last.historyId===historyId && last.sessionId===sessionId
        && JSON.stringify(last.after)===JSON.stringify(prior) && last.afterTextSha256===sha(selected[0].before)) {
        last.after=result; last.afterTextSha256=sha(selected[selected.length-1].after);
      } else {
        thread.anchorEditHistory=history.filter(h=>!h.undone);
        // Bounded recent destructive undo window; obsolete entries never grant
        // authority to revive a tombstone after their window has expired.
        thread.anchorEditHistory=thread.anchorEditHistory.filter(h=>h.sessionId===sessionId).slice(-31);
        thread.anchorEditHistory.push({historyId,sessionId,before:prior,after:result,
          beforeTextSha256:sha(selected[0].before),afterTextSha256:sha(selected[selected.length-1].after),undone:false});
      }
    }
  }
  const changed=JSON.stringify(after)!==JSON.stringify(before);
  if (changed) { if (before.revision===Number.MAX_SAFE_INTEGER) fail('COMMENT_SAVE_REVISION_OVERFLOW'); after.revision++; upgradeCommentState(after); }
  const afterText=changed?JSON.stringify(after,null,2)+'\n':beforeText;
  if(Buffer.byteLength(afterText)>65536) fail('COMMENT_SAVE_STATE_BUDGET');
  return changed || includeUnchanged ? {mode:MODE,beforeText,afterText,editIntents:plan,sessionId} : null;
}

module.exports = { MODE, paragraphs, planCommentAnchorSave };

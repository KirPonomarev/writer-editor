'use strict';

const { sha256UpdateCompatible } = require('./browser-safe-hash.cjs');
const { parseObservablePayload, deriveVisibleTextFromDocument } = require('./document-content-envelope-v1.cjs');
const { textOf } = require('./word-user-bookmarks-v1.cjs');
const { tableParagraphs } = require('../io/documentTables.js');
const { replayEditIntents, mapAnchorSplice } = require('./word-comment-edit-intents-v1.cjs');
const { serializeCommentState, upgradeCommentState } = require('./word-comment-body-v1.cjs');
const { readState } = require('./word-comment-authoring-v1.cjs');
const { mapCommentEndpoint, rebaseStructuralCommentAnchor, MULTI, deriveCommentAnchor, validateCommentAnchor, rebaseCommentAnchorSplice } = require('./word-comment-ranges-v1.cjs');
const MODE = 'SAFE_ANCHOR_REBASE_V1';
const RETURN_MODE = 'WORD_COMMENT_TEXT_RETURN_V1';
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
  const result = []; let lists = 0, quotes = 0, nextTable = 0;
  const append = (block, table) => {
    if (!block || !['paragraph', 'heading', 'codeBlock'].includes(block.type) || result.length >= 10000) fail('COMMENT_SAVE_STRUCTURE_UNSUPPORTED');
    result.push({ type: block.type, text: textOf(block), ...(table ? { table } : {}) });
  };
  const visit = (block, depth = 0, quoteDepth = 0) => {
    if (['paragraph', 'heading', 'codeBlock'].includes(block?.type)) { append(block); return; }
    if (block?.type === 'blockquote') {
      if (quoteDepth >= 8 || ++quotes > 2048 || !Array.isArray(block.content) || !block.content.length
        || (block.attrs != null && (typeof block.attrs !== 'object' || Array.isArray(block.attrs) || Object.keys(block.attrs).length))
        || Object.keys(block).some(key => !['type', 'attrs', 'content'].includes(key))) fail('COMMENT_SAVE_STRUCTURE_UNSUPPORTED');
      for (const child of block.content) visit(child, depth, quoteDepth + 1);
      return;
    }
    if (block?.type === 'table') {
      for (const leaf of tableParagraphs(block, `comment-table-${nextTable++}`)) append(leaf.node, leaf.table);
      return;
    }
    if (!['bulletList', 'orderedList'].includes(block?.type) || depth > 8 || ++lists > 2048
      || !Array.isArray(block.content) || !block.content.length) fail('COMMENT_SAVE_STRUCTURE_UNSUPPORTED');
    for (const item of block.content) {
      if (item?.type !== 'listItem' || !Array.isArray(item.content) || !['paragraph', 'heading'].includes(item.content[0]?.type)
        || item.content.slice(1).some(child => !['paragraph', 'heading', 'bulletList', 'orderedList'].includes(child?.type))) fail('COMMENT_SAVE_STRUCTURE_UNSUPPORTED');
      append(item.content[0]); for (const child of item.content.slice(1)) visit(child, depth + 1, quoteDepth);
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
    if (a.kind === MULTI) {
      validateCommentAnchor({sceneId,paragraphs:old,anchor:a});
      if (structureChanged) fail('COMMENT_SAVE_STRUCTURE_UNSUPPORTED');
      if (old.slice(index,a.endSceneParagraphIndex+1).some((row,j)=>row.text!==next[index+j].text)) fail('COMMENT_SAVE_RANGE_INTENT_REQUIRED');
      validateCommentAnchor({sceneId,paragraphs:next,anchor:a}); continue;
    }
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
  const afterText = serializeCommentState(after, 'COMMENT_SAVE_STATE_BUDGET');
  if (Buffer.byteLength(afterText) > 65536) fail('COMMENT_SAVE_STATE_BUDGET');
  return { mode: MODE, beforeText, afterText };
}

// Multi-paragraph history stores only coordinates and full-span digests. The
// scene replay, not a quote search, supplies the text for exact Undo/Redo.
function applyMultiGroup(thread,group,beforeRows,afterRows,sessionId) {
  const a=thread.anchor, {historyId,direction}=group[0].edit;
  if(!group.some(s=>s.edit.paragraphIndex>=a.sceneParagraphIndex && s.edit.paragraphIndex<=a.endSceneParagraphIndex)) return;
  if(thread.status==='deleted') return; // Authoritative manual/remote tombstones cannot be revived.
  validateCommentAnchor({sceneId:thread.sceneId,paragraphs:beforeRows,anchor:a});
  const snapshot=()=>({kind:MULTI,sceneParagraphIndex:thread.anchor.sceneParagraphIndex,
    startUtf16:thread.anchor.startUtf16,endSceneParagraphIndex:thread.anchor.endSceneParagraphIndex,endUtf16:thread.anchor.endUtf16,
    length:thread.anchor.selectedText.length,status:thread.status,blockTextSha256:thread.anchor.blockTextSha256,
    endBlockTextSha256:thread.anchor.endBlockTextSha256,coveredParagraphsSha256:thread.anchor.coveredParagraphsSha256});
  const prior=snapshot(), history=thread.anchorEditHistory||[], last=history.at(-1);
  const entry=history.slice().reverse().find(h=>h.sessionId===sessionId && h.historyId===historyId);
  const digest=rows=>sha(JSON.stringify(rows.slice(a.sceneParagraphIndex,a.endSceneParagraphIndex+1).map(r=>r.text)));
  if(direction!=='forward' && entry) {
    const undo=direction==='undo',source=undo?entry.after:entry.before,target=undo?entry.before:entry.after;
    if(entry.undone!==!undo || !historyEqual(prior,source)
      || digest(beforeRows)!==(undo?entry.afterTextSha256:entry.beforeTextSha256)
      || digest(afterRows)!==(undo?entry.beforeTextSha256:entry.afterTextSha256)) fail('COMMENT_EDIT_HISTORY_STALE');
    const restored=deriveCommentAnchor({sceneId:thread.sceneId,paragraphs:afterRows,input:{kind:MULTI,
      paragraphIndex:target.sceneParagraphIndex,startUtf16:target.startUtf16,endParagraphIndex:target.endSceneParagraphIndex,endUtf16:target.endUtf16}});
    if(restored.selectedText.length!==target.length || restored.coveredParagraphsSha256!==target.coveredParagraphsSha256) fail('COMMENT_EDIT_HISTORY_STALE');
    thread.anchor={...a,...restored};thread.status=target.status;entry.undone=undo;return;
  }
  if(direction!=='forward' && !entry && history.some(h=>h.sessionId===sessionId) && group.some(({edit:e})=>{
    if(e.paragraphIndex<a.sceneParagraphIndex || e.paragraphIndex>a.endSceneParagraphIndex) return false;
    const start=e.paragraphIndex===a.sceneParagraphIndex?a.startUtf16:0;
    const end=e.paragraphIndex===a.endSceneParagraphIndex?a.endUtf16:beforeRows[e.paragraphIndex].text.length;
    return e.fromUtf16===e.toUtf16 ? e.fromUtf16>start && e.fromUtf16<end : e.fromUtf16<end && e.toUtf16>start;
  })) fail('COMMENT_EDIT_HISTORY_EXPIRED');
  const continuing=direction==='forward' && entry && entry===last && !entry.undone;
  if(continuing && (!historyEqual(prior,entry.after) || digest(beforeRows)!==entry.afterTextSha256)) fail('COMMENT_EDIT_HISTORY_STALE');
  let rows=beforeRows;
  for(const step of group) {
    const next=rows.map(row=>({...row}));next[step.edit.paragraphIndex].text=step.after;
    thread.anchor=rebaseCommentAnchorSplice({anchor:thread.anchor,beforeParagraphs:rows,afterParagraphs:next,edit:step.edit}).anchor;rows=next;
  }
  const result=snapshot();
  if(continuing) {entry.after=result;entry.afterTextSha256=digest(afterRows);return;}
  if(a.selectedText===thread.anchor.selectedText) return;
  thread.anchorEditHistory=history.filter(h=>!h.undone && h.sessionId===sessionId).slice(-31);
  thread.anchorEditHistory.push({historyId,sessionId,before:prior,after:result,
    beforeTextSha256:digest(beforeRows),afterTextSha256:digest(afterRows),undone:false});
}

// Structural snapshots remain local: no historical whole-scene hash is invented.
function structuralSnapshot(thread,liveLocator) {
  const a=thread.anchor;
  return {sceneParagraphIndex:a.sceneParagraphIndex,startUtf16:a.startUtf16,length:a.selectedText.length,
    status:thread.status,blockTextSha256:a.blockTextSha256,
    ...(a.kind==='point'?{kind:'point',affinity:'right'}:a.kind===MULTI?{kind:MULTI,endSceneParagraphIndex:a.endSceneParagraphIndex,
      endUtf16:a.endUtf16,endBlockTextSha256:a.endBlockTextSha256,coveredParagraphsSha256:a.coveredParagraphsSha256}:{}),
    ...(thread.status==='deleted'?{deletedText:a.selectedText,liveLocator}: {})};
}
const historyEqual=(a,b)=>{const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;return JSON.stringify(stable(a))===JSON.stringify(stable(b));};
const snapshotDigest=s=>s.status==='deleted'?s.liveLocator.blockTextSha256:s.kind===MULTI?s.coveredParagraphsSha256:s.blockTextSha256;
function currentStructuralHistorySnapshot(thread) {
  const history=thread.anchorEditHistory||[];
  const last=history.filter(h=>!h.undone).at(-1);
  const snapshot=last?last.after:history[0]?.before;
  return snapshot?.status===thread.status?snapshot:null;
}
function validateStructuralSnapshot(snapshot,rows) {
  if(snapshot.status==='deleted') {
    const l=snapshot.liveLocator,text=rows[l?.sceneParagraphIndex]?.text;
    if(typeof text!=='string'||sha(text)!==l.blockTextSha256||!edges(text).has(l.startUtf16)) fail('COMMENT_EDIT_HISTORY_STALE');
    return;
  }
  const input={paragraphIndex:snapshot.sceneParagraphIndex,startUtf16:snapshot.startUtf16};
  if(snapshot.kind===MULTI) Object.assign(input,{kind:MULTI,endParagraphIndex:snapshot.endSceneParagraphIndex,endUtf16:snapshot.endUtf16});
  else if(snapshot.kind==='point') Object.assign(input,{kind:'point',affinity:'right',selectedText:''});
  else input.selectedText=rows[snapshot.sceneParagraphIndex]?.text.slice(snapshot.startUtf16,snapshot.startUtf16+snapshot.length);
  const anchor=deriveCommentAnchor({sceneId:'history-validation',paragraphs:rows,input});
  if(anchor.selectedText.length!==snapshot.length||anchor.blockTextSha256!==snapshot.blockTextSha256
    ||(snapshot.kind===MULTI&&(anchor.endBlockTextSha256!==snapshot.endBlockTextSha256||anchor.coveredParagraphsSha256!==snapshot.coveredParagraphsSha256))) fail('COMMENT_EDIT_HISTORY_STALE');
  return anchor;
}
function structuralOwners(content,rows) {
  const parsed=parseObservablePayload(content);
  if(!parsed.doc) return rows.map(row=>({...row,root:true}));
  const result=[];
  const walk=(node,root=false)=>{
    if(['paragraph','heading','codeBlock'].includes(node?.type)) {result.push(root&&node.type==='paragraph');return;}
    for(const child of node?.content||[]) walk(child,false);
  };
  for(const child of parsed.doc.content) walk(child,true);
  if(result.length!==rows.length) fail('COMMENT_SAVE_STRUCTURE_UNSUPPORTED');
  return rows.map((row,i)=>({...row,root:result[i]}));
}
function planStructuralIntentSave({before,beforeText,sceneId,beforeContent,afterContent,editIntents,sessionId,includeUnchanged}) {
  if(typeof sessionId!=='string'||!/^[A-Za-z0-9_.:-]{1,160}$/u.test(sessionId)) fail('COMMENT_EDIT_SESSION_INVALID');
  let rows=structuralOwners(beforeContent,paragraphs(beforeContent));
  const finalRows=structuralOwners(afterContent,paragraphs(afterContent));
  for(const thread of before.threads.filter(t=>t.sceneId===sceneId)) {
    const a=thread.anchor;
    if(!a||a.sceneId!==sceneId||typeof a.selectedText!=='string'||!a.selectedText.isWellFormed()
      ||a.selectedTextSha256!==sha(a.selectedText)) fail('COMMENT_SAVE_ANCHOR_STALE');
    if(thread.status!=='deleted') validateCommentAnchor({sceneId,paragraphs:rows,anchor:a});
  }
  const {plan,steps}=replayEditIntents(rows.map(r=>r.text),finalRows.map(r=>r.text),editIntents);
  const after=JSON.parse(JSON.stringify(before)), groups=[];
  for(const step of steps) {
    const e=step.edit,structural=e.fromParagraphIndex!==e.toParagraphIndex||e.insertedParagraphs.length!==1;
    if(structural && rows.slice(e.fromParagraphIndex,e.toParagraphIndex+1).some(r=>!r.root||r.type!=='paragraph')) fail('COMMENT_SAVE_STRUCTURE_UNSUPPORTED');
    const next=rows.slice();
    next.splice(e.fromParagraphIndex,e.toParagraphIndex-e.fromParagraphIndex+1,
      ...step.afterParagraphs.slice(e.fromParagraphIndex,e.fromParagraphIndex+e.insertedParagraphs.length).map(text=>({...rows[e.fromParagraphIndex],text})));
    step.beforeRows=rows;step.afterRows=next;rows=next;
    const last=groups.at(-1);
    if(last && last[0].edit.historyId===e.historyId && last[0].edit.direction===e.direction) last.push(step);else groups.push([step]);
  }
  const shape=rs=>JSON.stringify(rs.map(({text,...r})=>r));
  if(shape(rows)!==shape(finalRows)) fail('COMMENT_SAVE_STRUCTURE_UNSUPPORTED');
  for(const group of groups) {
    const beforeRows=group[0].beforeRows,afterRows=group.at(-1).afterRows,{historyId,direction}=group[0].edit;
    for(const thread of after.threads.filter(t=>t.sceneId===sceneId)) {
      const history=thread.anchorEditHistory||[],last=history.at(-1),entry=history.slice().reverse().find(h=>h.sessionId===sessionId&&h.historyId===historyId);
      // Only an already recorded authoring tombstone has a live coordinate.
      let locator=thread.status==='deleted'?currentStructuralHistorySnapshot(thread)?.liveLocator:undefined;
      if(thread.status==='deleted'&&!locator) {
        if(direction!=='forward'&&entry) fail('COMMENT_EDIT_HISTORY_STALE');
        continue;
      }
      const prior=structuralSnapshot(thread,locator),priorQuote=thread.anchor.selectedText;
      validateStructuralSnapshot(prior,beforeRows);
      if(direction!=='forward'&&entry) {
        const undo=direction==='undo',source=undo?entry.after:entry.before,target=undo?entry.before:entry.after;
        if(entry.undone!==!undo||!historyEqual(prior,source)) fail('COMMENT_EDIT_HISTORY_STALE');
        validateStructuralSnapshot(source,beforeRows);const restored=validateStructuralSnapshot(target,afterRows);
        if(target.status==='deleted') {
          const a=thread.anchor;thread.anchor={...a,sceneParagraphIndex:target.sceneParagraphIndex,paragraphIndex:target.sceneParagraphIndex,startUtf16:target.startUtf16,
            selectedText:target.deletedText,selectedTextSha256:sha(target.deletedText),blockTextSha256:target.blockTextSha256};
          for(const key of ['kind','affinity','endSceneParagraphIndex','endParagraphIndex','endUtf16','endBlockTextSha256','coveredParagraphsSha256']) delete thread.anchor[key];
          if(target.kind==='point') Object.assign(thread.anchor,{kind:'point',affinity:'right'});
          if(target.kind===MULTI) Object.assign(thread.anchor,{kind:MULTI,endSceneParagraphIndex:target.endSceneParagraphIndex,endParagraphIndex:target.endSceneParagraphIndex,endUtf16:target.endUtf16,endBlockTextSha256:target.endBlockTextSha256,coveredParagraphsSha256:target.coveredParagraphsSha256});
        } else {
          const provenance=Object.fromEntries(Object.entries(thread.anchor).filter(([k])=>['authoritySource','sourceChangeId'].includes(k)));
          thread.anchor={...provenance,...restored,sceneId};
        }
        thread.status=target.status;entry.undone=undo;continue;
      }
      const continuing=direction==='forward'&&entry===last&&entry&&!entry.undone;
      if(continuing&&!historyEqual(prior,entry.after)) fail('COMMENT_EDIT_HISTORY_STALE');
      for(const step of group) {
        if(thread.status==='deleted') {
          const mapped=mapCommentEndpoint({paragraphIndex:locator.sceneParagraphIndex,offsetUtf16:locator.startUtf16},step.edit,true);
          const text=step.afterRows[mapped.paragraphIndex]?.text;
          if(typeof text!=='string'||!edges(text).has(mapped.offsetUtf16)) fail('COMMENT_EDIT_GRAPHEME');
          locator={sceneParagraphIndex:mapped.paragraphIndex,startUtf16:mapped.offsetUtf16,blockTextSha256:sha(text)};
        } else {
          const mapped=rebaseStructuralCommentAnchor({anchor:thread.anchor,beforeParagraphs:step.beforeRows,afterParagraphs:step.afterRows,edit:step.edit});
          thread.anchor=mapped.anchor;if(mapped.deleted) {thread.status='deleted';locator=mapped.liveLocator;}
        }
      }
      const result=structuralSnapshot(thread,locator);
      if(JSON.stringify(prior)===JSON.stringify(result)) continue;
      if(direction!=='forward'&&!entry && history.some(h=>h.sessionId===sessionId)
        &&(prior.status==='deleted'||prior.status!==result.status||priorQuote!==thread.anchor.selectedText||prior.length!==result.length)) fail('COMMENT_EDIT_HISTORY_EXPIRED');
      if(continuing) {
        entry.schemaVersion=2;entry.after=result;entry.afterTextSha256=snapshotDigest(result);
      } else {
        // Coordinates/kind changes also need history: an inverse separator edit
        // must restore the pre-edit interval, not guess its boundary affinity.
        thread.anchorEditHistory=history.filter(h=>!h.undone&&h.sessionId===sessionId).slice(-31);
        // A comment may have been created after the original edit. Its first
        // observed action can be Undo; store forward-oriented endpoints so a
        // later Redo replays that exact observation instead of reporting stale.
        const inverse=direction==='undo';
        const historyBefore=inverse?result:prior,historyAfter=inverse?prior:result;
        thread.anchorEditHistory.push({schemaVersion:2,historyId,sessionId,before:historyBefore,after:historyAfter,
          beforeTextSha256:snapshotDigest(historyBefore),afterTextSha256:snapshotDigest(historyAfter),undone:inverse});
      }
    }
  }
  const changed=JSON.stringify(after)!==JSON.stringify(before);
  if(changed) {if(before.revision===Number.MAX_SAFE_INTEGER) fail('COMMENT_SAVE_REVISION_OVERFLOW');after.revision++;upgradeCommentState(after);}
  let afterText=changed?JSON.stringify(after,null,2)+'\n':beforeText;
  if(Buffer.byteLength(afterText)>65536) afterText=JSON.stringify(after)+'\n';
  while(Buffer.byteLength(afterText)>65536) {
    const candidate=after.threads.filter(t=>t.anchorEditHistory?.length>1).sort((a,b)=>b.anchorEditHistory.length-a.anchorEditHistory.length)[0];
    if(!candidate) fail('COMMENT_SAVE_STATE_BUDGET');candidate.anchorEditHistory.shift();afterText=JSON.stringify(after)+'\n';
  }
  readState(afterText,before.projectId);
  return changed||includeUnchanged?{mode:MODE,beforeText,afterText,editIntents:plan,sessionId}:null;
}

function planIntentSave({before,beforeText,sceneId,beforeContent,afterContent,editIntents,sessionId,includeUnchanged}) {
  const checked=require('./word-comment-edit-intents-v1.cjs').validateEditIntents(editIntents);
  if(checked.schemaVersion===2) {
    for(const thread of before.threads.filter(t=>t.sceneId===sceneId)) {
      const a=thread.anchor;
      if(!a||a.sceneId!==sceneId||typeof a.selectedText!=='string'||!a.selectedText.isWellFormed()
        ||a.selectedTextSha256!==sha(a.selectedText)) fail('COMMENT_SAVE_ANCHOR_STALE');
    }
    const legacyDeleted=before.threads.some(t=>t.sceneId===sceneId&&t.status==='deleted'&&t.anchorEditHistory?.length&&!t.anchorEditHistory.some(h=>h.schemaVersion===2));
    if(legacyDeleted) {
      // Old tombstones have truthful single-block history but no collapsed
      // locator. Reuse that exact law, never fabricate historical coordinates.
      if(checked.edits.some(e=>e.fromParagraphIndex!==e.toParagraphIndex||e.insertedParagraphs.length!==1)
        ||before.threads.some(t=>t.sceneId===sceneId&&t.anchorEditHistory?.some(h=>h.schemaVersion===2))) fail('COMMENT_EDIT_HISTORY_STALE');
      const legacy={schemaVersion:1,baselineTextSha256:checked.baselineTextSha256,edits:checked.edits.map(e=>({id:e.id,historyId:e.historyId,direction:e.direction,
        paragraphIndex:e.fromParagraphIndex,fromUtf16:e.fromUtf16,toUtf16:e.toUtf16,removedText:e.removedParagraphs[0],insertText:e.insertedParagraphs[0]}))};
      const result=planIntentSave({before,beforeText,sceneId,beforeContent,afterContent,editIntents:legacy,sessionId,includeUnchanged});
      return result?{...result,editIntents:checked}:result;
    }
    return planStructuralIntentSave({before,beforeText,sceneId,beforeContent,afterContent,editIntents:checked,sessionId,includeUnchanged});
  }
  if (typeof sessionId !== 'string' || !/^[A-Za-z0-9_.:-]{1,160}$/u.test(sessionId)) fail('COMMENT_EDIT_SESSION_INVALID');
  const old = paragraphs(beforeContent), next = paragraphs(afterContent);
  const shape = rows => JSON.stringify(rows.map(({text,...owner})=>owner));
  if (shape(old) !== shape(next)) fail('COMMENT_SAVE_STRUCTURE_UNSUPPORTED');
  const {plan,steps} = replayEditIntents(old.map(x=>x.text),next.map(x=>x.text),editIntents);
  const after = JSON.parse(JSON.stringify(before));
  for (const thread of after.threads.filter(t=>t.sceneId===sceneId && t.status!=='deleted')) {
    const a=thread.anchor, text=old[a?.sceneParagraphIndex]?.text;
    if(a?.kind===MULTI) { validateCommentAnchor({sceneId,paragraphs:old,anchor:a}); continue; }
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
  let currentParagraphs=old;
  for (const group of groups) {
    const groupBefore=currentParagraphs;
    const groupAfter=currentParagraphs.map(row=>({...row}));
    for(const step of group) groupAfter[step.edit.paragraphIndex].text=step.after;
    currentParagraphs=groupAfter;
    const {historyId,direction}=group[0].edit;
    for (const thread of after.threads.filter(t=>t.sceneId===sceneId)) {
      if(thread.anchor?.kind===MULTI) { applyMultiGroup(thread,group,groupBefore,groupAfter,sessionId); continue; }
      const selected=group.filter(s=>s.edit.paragraphIndex===thread.anchor?.sceneParagraphIndex);
      if (!selected.length) continue;
      const history=thread.anchorEditHistory || [], last=history[history.length-1];
      const snapshot=()=>({sceneParagraphIndex:thread.anchor.sceneParagraphIndex,startUtf16:thread.anchor.startUtf16,
        length:thread.anchor.selectedText.length,status:thread.status,blockTextSha256:thread.anchor.blockTextSha256,
        ...(thread.status==='deleted'?{deletedText:thread.anchor.selectedText}:{}),
        ...(thread.anchor.kind==='point'?{kind:'point',affinity:'right'}:{})});
      const current=()=>JSON.stringify(snapshot());
      const entry=history.slice().reverse().find(h=>h.sessionId===sessionId && h.historyId===historyId);
      if (direction!=='forward' && entry) {
        const undo=direction==='undo', source=undo?entry.after:entry.before, target=undo?entry.before:entry.after;
        if (entry.undone!==!undo || current()!==JSON.stringify(source)
          || sha(selected[0].before)!==(undo?entry.afterTextSha256:entry.beforeTextSha256)
          || sha(selected[selected.length-1].after)!==(undo?entry.beforeTextSha256:entry.afterTextSha256)) fail('COMMENT_EDIT_HISTORY_STALE');
        const text=selected[selected.length-1].after;
        if(target.status!=='deleted' && (target.startUtf16+target.length>text.length || !edges(text).has(target.startUtf16) || !edges(text).has(target.startUtf16+target.length))) fail('COMMENT_EDIT_HISTORY_STALE');
        const selectedText=target.status==='deleted'?target.deletedText:text.slice(target.startUtf16,target.startUtf16+target.length);
        thread.anchor={...thread.anchor,startUtf16:target.startUtf16,selectedText,selectedTextSha256:sha(selectedText),blockTextSha256:sha(text)};
        thread.status=target.status; entry.undone=undo;
        continue;
      }
      if(direction!=='forward' && !entry && history.some(h=>h.sessionId===sessionId)
        && (thread.status==='deleted' || selected.some(step=>step.edit.fromUtf16<=thread.anchor.startUtf16+thread.anchor.selectedText.length
          && step.edit.toUtf16>=thread.anchor.startUtf16))) fail('COMMENT_EDIT_HISTORY_EXPIRED');
      if (thread.status==='deleted') {
        // Further typing in the same actual history group extends its saved
        // endpoint without reviving the discussion or replacing its quote.
        if(direction==='forward' && entry===last && entry && !entry.undone) {
          if(current()!==JSON.stringify(entry.after) || sha(selected[0].before)!==entry.afterTextSha256) fail('COMMENT_EDIT_HISTORY_STALE');
          thread.anchor.blockTextSha256=sha(selected[selected.length-1].after);
          entry.after=snapshot();entry.afterTextSha256=thread.anchor.blockTextSha256;
        }
        continue;
      }
      const continuesSavedGroup=direction==='forward' && entry===last && entry && !entry.undone;
      if(continuesSavedGroup && (current()!==JSON.stringify(entry.after)
        || sha(selected[0].before)!==entry.afterTextSha256)) fail('COMMENT_EDIT_HISTORY_STALE');
      const prior=JSON.parse(current()),priorQuote=thread.anchor.selectedText;
      for (const step of selected) {
        if (thread.status==='deleted') { thread.anchor.blockTextSha256=sha(step.after); continue; }
        const mapped=mapAnchorSplice(thread.anchor,step.edit,step.after);
        thread.anchor=mapped.anchor; if(mapped.deleted) thread.status='deleted';
      }
      if (current()===JSON.stringify(prior)) continue;
      const result=JSON.parse(current());
      if(continuesSavedGroup) {
        entry.after=result;entry.afterTextSha256=sha(selected[selected.length-1].after);
        continue;
      }
      // Outside-anchor movement is reversibly replayable. Retain history only
      // when an edit destroys anchor information or changes the selected text.
      const destructive = prior.status!==result.status || priorQuote!==thread.anchor.selectedText
        || (prior.kind==='point' && selected.some(step=>step.edit.toUtf16>step.edit.fromUtf16
          && step.edit.fromUtf16<=prior.startUtf16 && step.edit.toUtf16>=prior.startUtf16));
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
  let afterText=changed?JSON.stringify(after,null,2)+'\n':beforeText;
  if(Buffer.byteLength(afterText)>65536) afterText=JSON.stringify(after)+'\n';
  while(Buffer.byteLength(afterText)>65536) {
    const candidate=after.threads.filter(t=>t.anchorEditHistory?.length>1).sort((a,b)=>b.anchorEditHistory.length-a.anchorEditHistory.length)[0];
    if(!candidate) fail('COMMENT_SAVE_STATE_BUDGET');
    candidate.anchorEditHistory.shift();afterText=JSON.stringify(after)+'\n';
  }
  return changed || includeUnchanged ? {mode:MODE,beforeText,afterText,editIntents:plan,sessionId} : null;
}

function planCommentTextReturn({beforeText,projectId,sceneId,beforeContent,afterContent,returnProofJson}) {
  if(typeof returnProofJson!=='string' || Buffer.byteLength(returnProofJson)>2*1024*1024) fail('COMMENT_TEXT_RETURN_PROOF_INVALID');
  let proof;try {proof=JSON.parse(returnProofJson);} catch {fail('COMMENT_TEXT_RETURN_PROOF_INVALID');}
  if(!proof || Array.isArray(proof) || Object.keys(proof).sort().join(',')!==
    'artifactSha256,baseline,commentReturnInventory,exportMap,projectId,returnedParagraphs,returnedThreads,roundId,textChanges'
    || proof.projectId!==projectId || !Array.isArray(proof.textChanges) || !proof.textChanges.length
    || proof.textChanges.some(change=>change.sceneId!==sceneId)) fail('COMMENT_TEXT_RETURN_PROOF_INVALID');
  const source=proof.exportMap?.scenes?.find(scene=>scene.sceneId===sceneId);
  if(!source || source.rawSha256!=='sha256:'+sha(beforeContent)) fail('COMMENT_TEXT_RETURN_SOURCE_STALE');
  const old=paragraphs(beforeContent),next=paragraphs(afterContent);
  if(old.length!==next.length || old.length!==source.blocks.length) fail('COMMENT_TEXT_RETURN_STRUCTURE');
  const own=rows=>JSON.stringify(rows.map(({text,...owner})=>owner));
  if(own(old)!==own(next)) fail('COMMENT_TEXT_RETURN_STRUCTURE');
  for(let i=0;i<old.length;i++) {
    const block=source.blocks[i],returned=proof.returnedParagraphs.find(p=>p.paragraphIndex===block.documentParagraphIndex);
    if(block.formatIr?.runs?.map(run=>run.text).join('')!==old[i].text || returned?.paragraphText!==next[i].text) fail('COMMENT_TEXT_RETURN_SOURCE_STALE');
  }
  const result=require('./word-comment-return-delta-v1.cjs').planCommentReturnDelta({...proof,beforeText});
  const before=readState(beforeText,projectId),after=readState(result.afterText,projectId);
  if(JSON.stringify(before.threads.filter(t=>t.sceneId!==sceneId))!==JSON.stringify(after.threads.filter(t=>t.sceneId!==sceneId))) fail('COMMENT_TEXT_RETURN_FOREIGN_SCENE');
  const plan={mode:RETURN_MODE,beforeText,afterText:result.afterText,returnProofJson};
  if(Buffer.byteLength(JSON.stringify(plan))>2*1024*1024) fail('COMMENT_TEXT_RETURN_PROOF_BUDGET');
  return plan;
}

module.exports = { currentStructuralHistorySnapshot, validateStructuralSnapshot, MODE, RETURN_MODE, paragraphs, planCommentAnchorSave, planCommentTextReturn };

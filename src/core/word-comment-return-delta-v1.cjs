'use strict';

const { sha256UpdateCompatible } = require('./browser-safe-hash.cjs');
const { serializeCommentState, validateCommentMessageContent, commentBodyEqual, commentBodyWithTypography, upgradeCommentState } = require('./word-comment-body-v1.cjs');
const { readState, exactAnchor } = require('./word-comment-authoring-v1.cjs');
const plain = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const clone = v => JSON.parse(JSON.stringify(v));
const stable = v => Array.isArray(v) ? `[${v.map(stable).join(',')}]`
  : plain(v) ? `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}` : JSON.stringify(v);
const hash = v => sha256UpdateCompatible(v);
const fail = code => { throw Object.assign(new Error(code), { code }); };
const demand = (ok, code) => { if (!ok) fail(code); };
const durable = v => {
  demand(typeof v === 'string' && /^[0-9a-f]{8}$/iu.test(v), 'COMMENT_RETURN_DURABLE_ID_REQUIRED');
  return v.toUpperCase();
};
function returnContent(message) {
  try { return validateCommentMessageContent(message); }
  catch (error) { if (error.code === 'COMMENT_BODY_INVALID') fail('COMMENT_RETURN_BODY_INVALID'); throw error; }
}
function provenance(v) {
  const result = {};
  for (const [k, max] of [['author', 1024], ['initials', 128], ['date', 128], ['dateUtc', 128]]) {
    const value = v[k];
    demand(value === undefined || (typeof value === 'string' && value.isWellFormed() && Buffer.byteLength(value) <= max
      && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)), 'COMMENT_RETURN_PROVENANCE_INVALID');
    if (value) result[k] = value;
  }
  return result;
}

function retainedProvenance(message, old) {
  const returned = provenance(message);
  if (!old) return returned;
  const original = provenance(old.provenance || {});
  demand((returned.author || '') === (original.author || '')
    && (returned.initials || '') === (original.initials || ''), 'COMMENT_RETURN_AUTHOR_CHANGED');
  for (const key of ['date', 'dateUtc']) {
    const a = original[key], b = returned[key];
    if (a === b || key === 'dateUtc' && !b) continue;
    if (key === 'dateUtc' && !a && old.transportDateUtc) {
      const expected = Date.parse(old.transportDateUtc), actual = Date.parse(b);
      demand(Number.isFinite(expected) && Number.isFinite(actual)
        && (actual === expected || actual === Math.floor(expected / 60000) * 60000), 'COMMENT_RETURN_PROVENANCE_CHANGED');
      continue;
    }
    // Word for Mac rewrites the original timestamp at minute precision. Keep
    // the authenticated original rather than silently destroying its precision.
    const before = Date.parse(a), after = Date.parse(b);
    demand(Number.isFinite(before) && Number.isFinite(after)
      && after === Math.floor(before / 60000) * 60000, 'COMMENT_RETURN_PROVENANCE_CHANGED');
  }
  return original;
}

// Pure data law. Authentication and filesystem authority belong to the caller;
// Word identities can only join this already authenticated export baseline.
function planCommentReturnDelta({ beforeText, projectId, roundId, artifactSha256,
  baseline, exportMap, returnedThreads, returnedParagraphs, commentReturnInventory, textChanges = [], pendingScenes = [] }) {
  demand(typeof roundId === 'string' && roundId.length > 0 && roundId.length <= 256
    && typeof artifactSha256 === 'string' && /^(?:sha256:)?[0-9a-f]{64}$/u.test(artifactSha256), 'COMMENT_RETURN_IDENTITY_INVALID');
  demand(plain(baseline) && baseline.projectId === projectId && baseline.schemaVersion === 'yalken.rtk.canonical-comment-export.v1'
    && Array.isArray(baseline.threads) && baseline.threads.length <= 128,
  'COMMENT_RETURN_BASELINE_REQUIRED');
  demand(Array.isArray(returnedThreads) && returnedThreads.length <= 128
    && Array.isArray(returnedParagraphs) && Array.isArray(exportMap?.scenes), 'COMMENT_RETURN_GRAPH_INCOMPLETE');
  const before = readState(beforeText, projectId);
  const blocks = exportMap.scenes.flatMap(scene => (scene.blocks || []).map((block, sceneParagraphIndex) => ({
    ...block, sceneId: scene.sceneId, sceneParagraphIndex,
    text: block.formatIr?.runs?.map(run => run.text).join(''),
  })));
  demand(blocks.length === returnedParagraphs.length && blocks.length <= 10000, 'COMMENT_RETURN_MANUSCRIPT_CHANGED');
  const byParagraph = new Map();
  for (const block of blocks) {
    demand(Number.isSafeInteger(block.documentParagraphIndex) && !byParagraph.has(block.documentParagraphIndex)
      && typeof block.text === 'string', 'COMMENT_RETURN_EXPORT_MAP_INVALID');
    byParagraph.set(block.documentParagraphIndex, block);
  }
  // Correlation never authorizes revision changes: reconstruct every signed
  // pending scene from its canonical ledger and independently parsed return.
  demand(Array.isArray(pendingScenes) && pendingScenes.length <= exportMap.scenes.length, 'COMMENT_RETURN_PENDING_PROOF_INVALID');
  const pendingModel=require('./word-pending-text-revisions-v1.cjs');
  const pendingByScene=new Map();
  const pendingBound=exportMap.scenes.filter(s=>s.pendingCommentBinding!==undefined);
  demand(pendingBound.length===pendingScenes.length,'COMMENT_RETURN_PENDING_PROOF_INVALID');
  for(const item of pendingScenes) {
    demand(plain(item) && Reflect.ownKeys(item).every(k=>typeof k==='string' && Object.hasOwn(Object.getOwnPropertyDescriptor(item,k),'value')) && Object.keys(item).sort().join(',')==='document,returnedDocument,sceneId'
      && typeof item.sceneId==='string' && !pendingByScene.has(item.sceneId),'COMMENT_RETURN_PENDING_PROOF_INVALID');
    const scene=pendingBound.find(s=>s.sceneId===item.sceneId);
    demand(scene,'COMMENT_RETURN_PENDING_PROOF_INVALID');
    const anchors=before.threads.filter(t=>t.sceneId===item.sceneId && t.status!=='deleted').map(t=>({threadId:t.threadId,anchor:t.anchor}));
    demand(anchors.every(entry=>entry.anchor?.sceneId===item.sceneId),'COMMENT_RETURN_PENDING_PROOF_INVALID');
    const checked=pendingModel.verifyCommentReturnBinding({document:item.document,binding:scene.pendingCommentBinding,
      returnedDocument:item.returnedDocument,anchors,exportTypography:exportMap.exportTypography,exportParagraphs:scene.blocks.map(b=>b.formatIr?.paragraph)});
    const texts=pendingModel.paragraphs(checked.projection.current).map(p=>p.content.map(n=>n.type==='hardBreak'?'\n':n.text).join(''));
    demand(texts.length===scene.blocks.length && scene.blocks.every((b,i)=>b.formatIr?.runs?.map(r=>r.text).join('')===texts[i]),'COMMENT_RETURN_PENDING_PROOF_INVALID');
    pendingByScene.set(item.sceneId,checked);
  }
  demand(!pendingScenes.length || textChanges.length===0,'COMMENT_RETURN_PENDING_TEXT_CHANGED');
  // Private clean-text admission is explicit and complete; returned marker data
  // cannot itself grant permission to change manuscript text.
  demand(Array.isArray(textChanges) && textChanges.length <= blocks.length, 'COMMENT_RETURN_TEXT_PROOF_INVALID');
  const textProof = new Map();
  for (const change of textChanges) {
    demand(plain(change) && Object.keys(change).sort().join(',') === 'newText,oldText,paragraphIndex,sceneId'
      && typeof change.sceneId === 'string' && Number.isSafeInteger(change.paragraphIndex)
      && typeof change.oldText === 'string' && typeof change.newText === 'string'
      && change.oldText !== change.newText, 'COMMENT_RETURN_TEXT_PROOF_INVALID');
    const block = blocks.find(b => b.sceneId === change.sceneId && b.sceneParagraphIndex === change.paragraphIndex);
    demand(block && block.text === change.oldText && !textProof.has(block.documentParagraphIndex), 'COMMENT_RETURN_TEXT_PROOF_INVALID');
    textProof.set(block.documentParagraphIndex, change);
  }
  const returnedText = new Map();
  const seenParagraphs = new Set();
  for (const p of returnedParagraphs) {
    const block = byParagraph.get(p?.paragraphIndex);
    demand(block && !seenParagraphs.has(p.paragraphIndex)
      && p.paragraphText === (textProof.get(p.paragraphIndex)?.newText ?? block.text)
      && (p.trackedRevision === false || pendingByScene.has(block.sceneId)), 'COMMENT_RETURN_MANUSCRIPT_CHANGED');
    returnedText.set(p.paragraphIndex, p.paragraphText);
    seenParagraphs.add(p.paragraphIndex);
  }
  const known = new Set(), tombstones = new Set((baseline.tombstones || []).flatMap(t => t.messageDurableIds || []).map(durable));
  for (const t of baseline.threads) for (const m of t.messages) {
    const id = durable(m.durableId); demand(!known.has(id) && !tombstones.has(id), 'COMMENT_RETURN_BASELINE_COLLISION'); known.add(id);
  }
  const seen = new Set(), byRoot = new Map();
  for (const t of returnedThreads) {
    demand(plain(t) && ['ANCHORED', 'RESOLVED'].includes(t.status) && Array.isArray(t.replies)
      && t.replies.length <= 128 && !t.modernMetadata?.duplicate, 'COMMENT_RETURN_GRAPH_UNSAFE');
    for (const m of [t, ...t.replies]) {
      const id = durable(m.durableId); demand(!seen.has(id) && !tombstones.has(id), 'COMMENT_RETURN_IDENTITY_COLLISION'); seen.add(id);
    }
    byRoot.set(durable(t.durableId), t);
  }
  const projection = [];
  const expectedRoots = new Set(baseline.threads.map(t => durable(t.messages[0].durableId)));
  const additions = [...byRoot].filter(([id]) => !expectedRoots.has(id));
  for (const [id, actual] of additions) {
    demand(!known.has(id), 'COMMENT_RETURN_IDENTITY_COLLISION');
    demand(byParagraph.has(actual.paragraphIndex), 'COMMENT_RETURN_SCENE_MISMATCH');
  }
  const missingRoots = baseline.threads.filter(t => !byRoot.has(durable(t.messages[0].durableId)));
  const missingReplies = baseline.threads.flatMap(t => byRoot.has(durable(t.messages[0].durableId))
    ? t.messages.slice(1).filter(m => !seen.has(durable(m.durableId))) : []);
  if (missingRoots.length || missingReplies.length || additions.length) {
    const inventory = commentReturnInventory;
    demand(inventory?.schemaVersion === 'yalken.rtk.comment-return-inventory.v1'
      && (inventory.status === 'COMPLETE' || !missingRoots.length && !missingReplies.length && additions.length > 0 && inventory.status === 'COMPLETE_BODY_GRAPH')
      && inventory.deletionAuthority === false && ['ABSENT', 'PRESENT'].includes(inventory.packageState)
      && Array.isArray(inventory.rootDurableIds) && Array.isArray(inventory.messageDurableIds)
      && stable([...byRoot.keys()].sort()) === stable(inventory.rootDurableIds)
      && stable([...seen].sort()) === stable(inventory.messageDurableIds), 'COMMENT_RETURN_PACKAGE_INCOMPLETE');
  }
  const candidates = baseline.threads.map(expected => ({ expected, actual: byRoot.get(durable(expected.messages[0].durableId)), created: false }));
  for (const [id, actual] of additions) candidates.push({ created: true, actual, expected: {
    threadId: `word-thread-${hash(projectId + '\n' + roundId + '\n' + id)}`,
    sceneId: byParagraph.get(actual.paragraphIndex).sceneId, messages: [],
  } });
  for (const { expected, actual, created } of candidates) {
    if (!actual) {
      demand(expected.messages.every(m => !seen.has(durable(m.durableId))), 'COMMENT_RETURN_DELETED_THREAD_FRAGMENT');
      projection.push({ threadId: expected.threadId, sceneId: expected.sceneId, status: 'deleted' });
      continue;
    }
    const block = byParagraph.get(actual.paragraphIndex);
    demand(block?.sceneId === expected.sceneId, 'COMMENT_RETURN_SCENE_MISMATCH');
    const a = actual.finalTextAnchorRange;
    const multi=a?.kind==='multi-paragraph-range';
    const pendingProof=pendingByScene.get(expected.sceneId);
    if(pendingProof) {
      const bound=pendingProof.anchors.find(v=>v.threadId===expected.threadId), union=actual.anchorRange;
      demand(bound && plain(union),'COMMENT_RETURN_PENDING_ANCHOR_INVALID');
      const sceneRows=blocks.filter(b=>b.sceneId===expected.sceneId);
      const localIndex=global=>sceneRows.findIndex(b=>b.documentParagraphIndex===global);
      const endpoint=(range,last)=>({paragraphIndex:localIndex(last?(range.endParagraphIndex??actual.paragraphIndex):actual.paragraphIndex),offsetUtf16:last?range.endUtf16:range.startUtf16});
      demand(stable(endpoint(a,false))===stable(bound.currentStart) && stable(endpoint(a,true))===stable(bound.currentEnd)
        && stable(endpoint(union,false))===stable(bound.unionStart) && stable(endpoint(union,true))===stable(bound.unionEnd),'COMMENT_RETURN_PENDING_ANCHOR_INVALID');
      const unionTexts=pendingModel.paragraphs(pendingProof.projection.union).map(p=>p.content.map(n=>n.type==='hardBreak'?'\n':n.text).join(''));
      const {unionStart:start,unionEnd:end}=bound;
      const quote=start.paragraphIndex===end.paragraphIndex?unionTexts[start.paragraphIndex].slice(start.offsetUtf16,end.offsetUtf16)
        :[unionTexts[start.paragraphIndex].slice(start.offsetUtf16),...unionTexts.slice(start.paragraphIndex+1,end.paragraphIndex),unionTexts[end.paragraphIndex].slice(0,end.offsetUtf16)].join('\n');
      demand(union.selectedText===quote && actual.quotedAnchorText===quote && union.blockTextSha256===hash(unionTexts[start.paragraphIndex]),'COMMENT_RETURN_PENDING_ANCHOR_INVALID');
    }
    demand(plain(a) && a.blockTextSha256 === hash(returnedText.get(block.documentParagraphIndex)) && (pendingProof || a.selectedText === actual.quotedAnchorText)
      && (multi || a.endUtf16 === a.startUtf16 + a.selectedText.length), 'COMMENT_RETURN_ANCHOR_INVALID');
    const sceneBlocks=blocks.filter(b=>b.sceneId===expected.sceneId);
    const paragraphs=sceneBlocks.map(b=>({text:returnedText.get(b.documentParagraphIndex),...(b.formatIr?.table?{table:b.formatIr.table}:{})}));
    let end;
    if(multi) {
      end=byParagraph.get(a.endParagraphIndex);
      demand(end?.sceneId===expected.sceneId && end.sceneParagraphIndex>block.sceneParagraphIndex, 'COMMENT_RETURN_SCENE_MISMATCH');
      for(let index=block.documentParagraphIndex;index<=end.documentParagraphIndex;index++) {
        const covered=byParagraph.get(index);
        demand(covered?.sceneId===expected.sceneId && covered.sceneParagraphIndex===block.sceneParagraphIndex+index-block.documentParagraphIndex, 'COMMENT_RETURN_SCENE_MISMATCH');
      }
    }
    const anchor = exactAnchor({ paragraphIndex: block.sceneParagraphIndex,
      startUtf16: a.startUtf16, selectedText: a.selectedText,
      ...(multi?{kind:'multi-paragraph-range',endParagraphIndex:end.sceneParagraphIndex,endUtf16:a.endUtf16}:
        a.startUtf16 === a.endUtf16 ? {kind: 'point', affinity: 'right'} : {}) }, expected.sceneId, paragraphs);
    if(multi) demand(anchor.endBlockTextSha256===a.endBlockTextSha256 && anchor.coveredParagraphsSha256===a.coveredParagraphsSha256, 'COMMENT_RETURN_ANCHOR_INVALID');
    anchor.authoritySource = 'AUTHENTICATED_WORD_COMMENT_RETURN';
    const messages = [{ durableId: actual.durableId, body: actual.body, richBody: actual.richBody,
      author: actual.authorPersonIdentity?.author, initials: actual.authorPersonIdentity?.initials,
      date: actual.date, dateUtc: actual.dateUtc }, ...actual.replies];
    const expectedById = new Map(expected.messages.map((m, index) => [durable(m.durableId), { m, index }]));
    let previousIndex = -1, newReplySeen = false;
    const mapped = messages.map((m, index) => {
      if (index > 0) demand(m.parentRawId === actual.commentId, 'COMMENT_RETURN_PARENT_CHANGED');
      const id = durable(m.durableId), entry = expectedById.get(id), old = entry?.m;
      if (old) {
        demand(!newReplySeen && entry.index > previousIndex && (index === 0) === (entry.index === 0),
          'COMMENT_RETURN_MESSAGE_MISSING_OR_REORDERED');
        previousIndex = entry.index;
      } else {
        demand(!known.has(id), 'COMMENT_RETURN_IDENTITY_COLLISION');
        newReplySeen = true;
      }
      return { commentId: old?.canonicalCommentId || `word-${index === 0 ? 'root' : 'reply'}-${hash(projectId + '\n' + roundId + '\n' + id)}`,
        kind: index === 0 ? 'root' : 'reply', ...returnContent(m), provenance: retainedProvenance(m, old) };
    });
    const deletedMessageIds = expected.messages.slice(1).filter(m => !seen.has(durable(m.durableId))).map(m => m.canonicalCommentId);
    projection.push({ threadId: expected.threadId, sceneId: expected.sceneId, ...(created ? { created: true } : {}),
      ...(deletedMessageIds.length ? { deletedMessageIds } : {}),
      status: actual.status === 'RESOLVED' ? 'resolved' : 'open', anchor, messages: mapped });
  }
  const inputDigest = hash(stable({ projectId, roundId, artifactSha256, baselineDigest: baseline.stateDigest, ...(textChanges.length ? {textChanges} : {}), ...(pendingScenes.length ? {pendingBindings:pendingBound.map(s=>[s.sceneId,s.pendingCommentBinding])} : {}), projection }));
  const operationId = `word-comment-return-${hash(roundId + '\n' + artifactSha256)}`;
  const prior = before.events.find(e => e?.type === 'WORD_COMMENT_RETURN_APPLIED' && e.operationId === operationId);
  if (prior) {
    demand(prior.inputDigest === inputDigest && prior.resultingRevision === before.revision
      && prior.threadDigest === hash(stable(before.threads)), 'COMMENT_RETURN_REPLAY_CONFLICT');
    return { replay: true, afterText: beforeText, operationId, changes: prior.changes };
  }
  demand(hash(stable(before)) === baseline.stateDigest && before.revision === baseline.stateRevision,
    'COMMENT_RETURN_BASELINE_CONFLICT');
  const after = clone(before), changes = [];
  for (const candidate of projection) {
    const thread = after.threads.find(t => t.threadId === candidate.threadId);
    if (candidate.created) {
      demand(!thread && candidate.messages.every(message => !after.threads.some(t =>
        t.messages.some(m => m.commentId === message.commentId))), 'COMMENT_RETURN_IDENTITY_COLLISION');
      demand(after.threads.length < 128, 'COMMENT_RETURN_STATE_BUDGET');
      const { created, ...newThread } = candidate;
      newThread.rootCommentId = newThread.messages[0].commentId;
      after.threads.push(newThread);
      changes.push({ threadId: newThread.threadId, created: true,
        messageIds: newThread.messages.map(m => m.commentId), anchorChanged: true,
        statusBefore: null, statusAfter: newThread.status });
      continue;
    }
    demand(thread && thread.sceneId === candidate.sceneId && thread.status !== 'deleted', 'COMMENT_RETURN_TARGET_INVALID');
    if (candidate.status === 'deleted') {
      changes.push({ threadId: thread.threadId, messageIds: [], anchorChanged: false,
        statusBefore: thread.status, statusAfter: 'deleted',
        deletionDecision: 'CONSISTENT_ABSENCE_REQUIRES_EXPLICIT_CONFIRMATION' });
      thread.status = 'deleted'; // Retain every original message, provenance and anchor.
      // Remote deletion is not an undoable local text edit.
      delete thread.anchorEditHistory;
      continue;
    }
    candidate.messages = candidate.messages.map(m => {
      const old = thread.messages.find(old => old.commentId === m.commentId);
      const merged = { ...old, ...m };
      delete merged.richBody;
      if (m.richBody) merged.richBody = m.richBody;
      const exported = baseline.threads.find(t => t.threadId === candidate.threadId)?.messages.find(e => e.canonicalCommentId === m.commentId);
      const transport = exported?.transportRichBody || (old && exportMap.exportTypography
        ? commentBodyWithTypography(old, exportMap.exportTypography) : null);
      const expected = transport ? {...old, richBody:transport} : old;
      if (old && commentBodyEqual(expected, m)) {
        merged.body = old.body;
        if (old.richBody) merged.richBody = old.richBody;
        else delete merged.richBody;
      }
      return merged;
    });
    const removed = thread.messages.filter(m => candidate.deletedMessageIds?.includes(m.commentId));
    demand(removed.length === (candidate.deletedMessageIds?.length || 0) && removed.every(m => m.kind === 'reply'),
      'COMMENT_RETURN_TARGET_INVALID');
    demand(candidate.messages.length + (thread.deletedMessages?.length || 0) + removed.length <= 129, 'COMMENT_RETURN_STATE_BUDGET');
    const changedMessages = candidate.messages.filter((m, i) => stable(m) !== stable(thread.messages[i]));
    const anchorChanged = ['sceneParagraphIndex', 'startUtf16', 'selectedText', 'blockTextSha256', 'kind', 'affinity', 'endSceneParagraphIndex', 'endParagraphIndex', 'endUtf16', 'endBlockTextSha256', 'coveredParagraphsSha256'].some(k => candidate.anchor[k] !== thread.anchor?.[k]);
    if (changedMessages.length || removed.length || anchorChanged || thread.status !== candidate.status) {
      changes.push({ threadId: thread.threadId, messageIds: changedMessages.map(m => m.commentId),
        ...(removed.length ? { deletedMessageIds: removed.map(m => m.commentId),
          deletionDecision: 'CONSISTENT_ABSENCE_REQUIRES_EXPLICIT_CONFIRMATION' } : {}),
        anchorChanged, statusBefore: thread.status, statusAfter: candidate.status });
      if (removed.length) thread.deletedMessages = [...(thread.deletedMessages || []), ...removed];
      // A remote anchor/status decision supersedes local text-history restore
      // coordinates. Keeping them could revive a remotely deleted/resolved
      // thread or make a moved anchor's persisted graph unreadable.
      if (anchorChanged || thread.status !== candidate.status) delete thread.anchorEditHistory;
      thread.messages = candidate.messages; thread.status = candidate.status;
      if (anchorChanged) thread.anchor = candidate.anchor;
    }
  }
  if(pendingScenes.length) {
    demand(after.threads.length===before.threads.length,'COMMENT_RETURN_PENDING_REPLY_ONLY');
    let added=0;
    for(let i=0;i<before.threads.length;i++) {
      const old=before.threads[i],next=after.threads[i];
      demand(stable({...old,messages:[]})===stable({...next,messages:[]}) && next.messages.length>=old.messages.length
        && old.messages.every((m,j)=>stable(m)===stable(next.messages[j])),'COMMENT_RETURN_PENDING_REPLY_ONLY');
      const extra=next.messages.slice(old.messages.length);
      demand(extra.every(m=>m.kind==='reply'),'COMMENT_RETURN_PENDING_REPLY_ONLY');added+=extra.length;
    }
    demand(added<=1 && (changes.length===0 || added===1),'COMMENT_RETURN_PENDING_REPLY_ONLY');
  }
  if (!changes.length) return { replay: false, unchanged: true, afterText: beforeText, operationId, changes };
  demand(before.revision < Number.MAX_SAFE_INTEGER && before.events.length < 512, 'COMMENT_RETURN_STATE_BUDGET');
  upgradeCommentState(after);
  after.revision++;
  after.events.push({ type: 'WORD_COMMENT_RETURN_APPLIED', operationId, inputDigest,
    roundId, artifactSha256, resultingRevision: after.revision, threadDigest: hash(stable(after.threads)), changes });
  const afterText = serializeCommentState(after, 'COMMENT_RETURN_STATE_BUDGET');
  demand(Buffer.byteLength(afterText) <= 65536, 'COMMENT_RETURN_STATE_BUDGET');
  readState(afterText, projectId);
  return { replay: false, afterText, operationId, changes, revision: after.revision };
}

module.exports = { planCommentReturnDelta };

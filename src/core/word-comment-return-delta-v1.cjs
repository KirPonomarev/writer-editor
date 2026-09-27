'use strict';

const { createHash } = require('node:crypto');
const { readState, exactAnchor } = require('./word-comment-authoring-v1.cjs');
const plain = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const clone = v => JSON.parse(JSON.stringify(v));
const stable = v => Array.isArray(v) ? `[${v.map(stable).join(',')}]`
  : plain(v) ? `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}` : JSON.stringify(v);
const hash = v => createHash('sha256').update(v).digest('hex');
const fail = code => { throw Object.assign(new Error(code), { code }); };
const demand = (ok, code) => { if (!ok) fail(code); };
const durable = v => {
  demand(typeof v === 'string' && /^[0-9a-f]{8}$/iu.test(v), 'COMMENT_RETURN_DURABLE_ID_REQUIRED');
  return v.toUpperCase();
};
function body(v) {
  demand(typeof v === 'string' && v.isWellFormed() && v.trim() && Buffer.byteLength(v) <= 16384
    && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\r]/u.test(v), 'COMMENT_RETURN_BODY_INVALID');
  return v;
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
  baseline, exportMap, returnedThreads, returnedParagraphs }) {
  demand(typeof roundId === 'string' && roundId.length > 0 && roundId.length <= 256
    && typeof artifactSha256 === 'string' && /^(?:sha256:)?[0-9a-f]{64}$/u.test(artifactSha256), 'COMMENT_RETURN_IDENTITY_INVALID');
  demand(plain(baseline) && baseline.projectId === projectId && baseline.schemaVersion === 'yalken.rtk.canonical-comment-export.v1'
    && Array.isArray(baseline.threads) && baseline.threads.length > 0 && baseline.threads.length <= 128,
  'COMMENT_RETURN_BASELINE_REQUIRED');
  demand(Array.isArray(returnedThreads) && returnedThreads.length === baseline.threads.length
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
  const seenParagraphs = new Set();
  for (const p of returnedParagraphs) {
    const block = byParagraph.get(p?.paragraphIndex);
    demand(block && !seenParagraphs.has(p.paragraphIndex) && p.paragraphText === block.text
      && p.trackedRevision === false, 'COMMENT_RETURN_MANUSCRIPT_CHANGED');
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
  for (const expected of baseline.threads) {
    const actual = byRoot.get(durable(expected.messages[0].durableId));
    demand(actual, 'COMMENT_RETURN_ROOT_MISSING');
    const block = byParagraph.get(actual.paragraphIndex);
    demand(block?.sceneId === expected.sceneId, 'COMMENT_RETURN_SCENE_MISMATCH');
    const a = actual.finalTextAnchorRange;
    demand(plain(a) && a.blockTextSha256 === hash(block.text) && a.selectedText === actual.quotedAnchorText
      && a.endUtf16 === a.startUtf16 + a.selectedText.length, 'COMMENT_RETURN_ANCHOR_INVALID');
    const paragraphs = blocks.filter(b => b.sceneId === expected.sceneId).map(b => b.text);
    const anchor = exactAnchor({ paragraphIndex: block.sceneParagraphIndex,
      startUtf16: a.startUtf16, selectedText: a.selectedText }, expected.sceneId, paragraphs);
    anchor.authoritySource = 'AUTHENTICATED_WORD_COMMENT_RETURN';
    const messages = [{ durableId: actual.durableId, body: actual.body,
      author: actual.authorPersonIdentity?.author, initials: actual.authorPersonIdentity?.initials,
      date: actual.date, dateUtc: actual.dateUtc }, ...actual.replies];
    demand(messages.length >= expected.messages.length, 'COMMENT_RETURN_MESSAGE_MISSING');
    const mapped = messages.map((m, index) => {
      if (index > 0) demand(m.parentRawId === actual.commentId, 'COMMENT_RETURN_PARENT_CHANGED');
      const id = durable(m.durableId), old = expected.messages[index];
      if (old) demand(id === durable(old.durableId), 'COMMENT_RETURN_MESSAGE_MISSING_OR_REORDERED');
      else demand(!known.has(id), 'COMMENT_RETURN_IDENTITY_COLLISION');
      return { commentId: old?.canonicalCommentId || `word-reply-${hash(projectId + '\n' + roundId + '\n' + id)}`,
        kind: index === 0 ? 'root' : 'reply', body: body(m.body), provenance: retainedProvenance(m, old) };
    });
    projection.push({ threadId: expected.threadId, sceneId: expected.sceneId,
      status: actual.status === 'RESOLVED' ? 'resolved' : 'open', anchor, messages: mapped });
  }
  const inputDigest = hash(stable({ projectId, roundId, artifactSha256, baselineDigest: baseline.stateDigest, projection }));
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
    demand(thread && thread.sceneId === candidate.sceneId && thread.status !== 'deleted', 'COMMENT_RETURN_TARGET_INVALID');
    candidate.messages = candidate.messages.map(m => ({ ...thread.messages.find(old => old.commentId === m.commentId), ...m }));
    const changedMessages = candidate.messages.filter((m, i) => stable(m) !== stable(thread.messages[i]));
    const anchorChanged = ['sceneParagraphIndex', 'startUtf16', 'selectedText', 'blockTextSha256'].some(k => candidate.anchor[k] !== thread.anchor?.[k]);
    if (changedMessages.length || anchorChanged || thread.status !== candidate.status) {
      changes.push({ threadId: thread.threadId, messageIds: changedMessages.map(m => m.commentId),
        anchorChanged, statusBefore: thread.status, statusAfter: candidate.status });
      thread.messages = candidate.messages; thread.status = candidate.status;
      if (anchorChanged) thread.anchor = candidate.anchor;
    }
  }
  if (!changes.length) return { replay: false, unchanged: true, afterText: beforeText, operationId, changes };
  demand(before.revision < Number.MAX_SAFE_INTEGER && before.events.length < 512, 'COMMENT_RETURN_STATE_BUDGET');
  after.revision++;
  after.events.push({ type: 'WORD_COMMENT_RETURN_APPLIED', operationId, inputDigest,
    roundId, artifactSha256, resultingRevision: after.revision, threadDigest: hash(stable(after.threads)), changes });
  const afterText = JSON.stringify(after, null, 2) + '\n';
  demand(Buffer.byteLength(afterText) <= 65536, 'COMMENT_RETURN_STATE_BUDGET');
  return { replay: false, afterText, operationId, changes, revision: after.revision };
}

module.exports = { planCommentReturnDelta };

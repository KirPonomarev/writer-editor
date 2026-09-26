import { sha256Hex } from '../../core/browser-safe-hash.mjs';

// Ordinary import has no return authority. Native IDs are retained only as
// provenance; every canonical identity is scoped to the new import operation.
const schema = 'yalken.rtk.word.non-text-return-state.v1';
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const bytes = value => new TextEncoder().encode(value).length;
const demand = (condition, suffix) => {
  if (!condition) throw new Error(`DOCX_GENERIC_COMMENT_${suffix}`);
};
const clone = value => JSON.parse(JSON.stringify(value));
const edges = text => new Set([text.length, ...Array.from(new Intl.Segmenter('und',
  { granularity: 'grapheme' }).segment(text), segment => segment.index)]);
function literal(value, limit, required = false) {
  demand(typeof value === 'string' && bytes(value) <= limit
    && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)
    && value.isWellFormed() && !value.includes('\r') && (!required || value.trim()), 'LITERAL');
  return value;
}
function message(source, reply = false) {
  demand(plain(source) && (reply || plain(source.authorPersonIdentity)), 'MESSAGE');
  const identity = reply ? source : source.authorPersonIdentity;
  const provenance = {};
  for (const [key, value, limit] of [
    ['author', identity.author ?? '', 1024],
    ['initials', identity.initials ?? '', 128],
    ['date', source.date ?? '', 128], ['dateUtc', source.dateUtc ?? '', 128],
  ]) {
    literal(value, limit);
    if (value) provenance[key] = value;
  }
  return { sourceCommentId: literal(reply ? source.rawId : source.commentId, 128, true),
    body: literal(source.body, 16384, true), provenance };
}

export function genericCommentCandidates(analysis, paragraphs) {
  demand(analysis?.ok === true && analysis.reviewIr?.sourceMode === 'CLEAN', 'ANALYSIS');
  const ir = analysis.reviewIr;
  demand(Array.isArray(ir.commentThreads) && ir.commentThreads.length <= 128
    && Array.isArray(paragraphs), 'BUDGET');
  demand(!(ir.textRevisions?.length || ir.moveRevisions?.length || ir.propertyRevisions?.length), 'TRACKED_UNSUPPORTED');
  // Missing/orphan/truncated comments may not disappear behind an empty lane.
  const reasons = analysis.reasons || [];
  demand(!reasons.some(item => /COMMENT|BUDGET|HOSTILE|MALFORMED/u.test(item.code || '')
    && !['RTK_COMMENT_ANCHORED', 'RTK_COMMENT_RESOLVED'].includes(item.code)), 'INCOMPLETE');
  const nativeIds = new Set();
  const candidates = ir.commentThreads.map(thread => {
    demand(['ANCHORED', 'RESOLVED'].includes(thread.status)
      && ['active', 'resolved', 'reopened'].includes(thread.doneResolvedReopenedState)
      && !thread.parentThreadId && thread.placement?.anchored === true, 'PLACEMENT');
    const range = thread.finalTextAnchorRange || thread.anchorRange;
    const index = thread.paragraphIndex, paragraph = paragraphs[index];
    demand(Number.isSafeInteger(index) && index >= 0 && plain(range)
      && plain(paragraph) && typeof paragraph.text === 'string', 'ANCHOR');
    // Flattening a table, list, or section can change canonical block ordinals.
    // Admit those structures only once their explicit topology mapping exists.
    demand(!paragraph.table && !paragraph.list && !paragraph.media?.length, 'TOPOLOGY');
    const text = paragraph.text, boundaries = edges(text);
    demand(Number.isSafeInteger(range.startUtf16) && Number.isSafeInteger(range.endUtf16)
      && range.startUtf16 < range.endUtf16 && boundaries.has(range.startUtf16)
      && boundaries.has(range.endUtf16) && sha256Hex(text) === range.blockTextSha256
      && text.slice(range.startUtf16, range.endUtf16) === range.selectedText
      && range.selectedText === thread.quotedAnchorText, 'ANCHOR');
    demand(Array.isArray(thread.replies) && thread.replies.length <= 128, 'REPLIES');
    demand(thread.replies.every(reply => reply.parentRawId === thread.commentId), 'NESTED_REPLY_UNSUPPORTED');
    const messages = [message(thread), ...thread.replies.map(reply => message(reply, true))];
    for (const item of messages) {
      demand(!nativeIds.has(item.sourceCommentId), 'DUPLICATE');
      nativeIds.add(item.sourceCommentId);
    }
    return { paragraphIndex: index, startUtf16: range.startUtf16,
      selectedText: range.selectedText, blockTextSha256: range.blockTextSha256,
      status: thread.status === 'RESOLVED' ? 'resolved' : 'open', messages };
  });
  demand(bytes(JSON.stringify(candidates)) <= 65536, 'BUDGET');
  return candidates;
}

export function materializeGenericComments({ candidates, paragraphs, projectId, sceneId, importOperationId, beforeText }) {
  demand(Array.isArray(candidates) && candidates.length > 0 && candidates.length <= 128, 'BUDGET');
  for (const value of [projectId, sceneId, importOperationId]) literal(value, 1024, true);
  demand(beforeText === null || (typeof beforeText === 'string' && bytes(beforeText) <= 65536), 'STATE_BUDGET');
  const before = beforeText === null ? { schemaVersion: schema, projectId, revision: 0, threads: [], events: [] }
    : JSON.parse(beforeText);
  demand(plain(before) && before.schemaVersion === schema && before.projectId === projectId
    && Number.isSafeInteger(before.revision) && before.revision >= 0 && before.revision < Number.MAX_SAFE_INTEGER
    && Array.isArray(before.threads) && Array.isArray(before.events), 'STATE');
  const existing = new Set();
  for (const thread of before.threads) {
    demand(plain(thread) && typeof thread.threadId === 'string' && Array.isArray(thread.messages), 'STATE');
    for (const id of [thread.threadId, ...thread.messages.map(item => item.commentId)]) {
      demand(typeof id === 'string' && !existing.has(id), 'STATE'); existing.add(id);
    }
  }
  const operation = sha256Hex(`${projectId}\n${sceneId}\n${importOperationId}`);
  const reserve = id => { demand(!existing.has(id), 'IDENTITY_CONFLICT'); existing.add(id); return id; };
  const threads = candidates.map((candidate, ordinal) => {
    demand(plain(candidate) && ['open', 'resolved'].includes(candidate.status)
      && Array.isArray(candidate.messages) && candidate.messages.length > 0 && candidate.messages.length <= 129, 'CANDIDATE');
    const text = paragraphs[candidate.paragraphIndex]?.text;
    demand(typeof text === 'string' && sha256Hex(text) === candidate.blockTextSha256
      && typeof candidate.selectedText === 'string' && candidate.selectedText.length > 0
      && edges(text).has(candidate.startUtf16) && edges(text).has(candidate.startUtf16 + candidate.selectedText.length)
      && text.slice(candidate.startUtf16, candidate.startUtf16 + candidate.selectedText.length) === candidate.selectedText, 'ANCHOR');
    const threadId = reserve(`generic-comment-${operation}-${ordinal}`);
    const messages = candidate.messages.map((item, index) => {
      demand(plain(item) && plain(item.provenance), 'MESSAGE');
      const body = literal(item.body, 16384, true);
      for (const [key, value] of Object.entries(item.provenance)) {
        demand(['author', 'initials', 'date', 'dateUtc'].includes(key), 'PROVENANCE');
        literal(value, key === 'author' ? 1024 : 128);
      }
      literal(item.sourceCommentId, 128, true);
      return { commentId: reserve(`${threadId}:message-${index}`), kind: index === 0 ? 'root' : 'reply',
        body, provenance: clone(item.provenance) };
    });
    return { threadId, sceneId, rootCommentId: messages[0].commentId, status: candidate.status,
      anchor: { sceneId, sceneParagraphIndex: candidate.paragraphIndex,
        paragraphIndex: candidate.paragraphIndex, blockTextSha256: candidate.blockTextSha256,
        startUtf16: candidate.startUtf16, selectedText: candidate.selectedText,
        selectedTextSha256: sha256Hex(candidate.selectedText), authoritySource: 'GENERIC_IMPORT_LOCAL_IDENTITY',
        sourceChangeId: importOperationId }, messages };
  });
  const after = { ...clone(before), revision: before.revision + 1, threads: [...clone(before.threads), ...threads] };
  const afterText = `${JSON.stringify(after, null, 2)}\n`;
  demand(bytes(afterText) <= 65536, 'STATE_BUDGET');
  return { beforeText, afterText, threadIds: threads.map(thread => thread.threadId) };
}

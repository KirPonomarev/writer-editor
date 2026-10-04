'use strict';

const { sha256UpdateCompatible } = require('./browser-safe-hash.cjs');
const { validateCommentMessageContent, STATE_V2, STATE_V3, upgradeCommentState } = require('./word-comment-body-v1.cjs');
const SCHEMA = 'yalken.rtk.word.non-text-return-state.v1';
const COMMAND_ID = 'cmd.project.review.editComment';
const sha = value => sha256UpdateCompatible(value);
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const clone = value => JSON.parse(JSON.stringify(value));
const fail = code => { throw Object.assign(new Error(code), { code }); };
const id = value => typeof value === 'string' && /^[\w:.-]{1,160}$/u.test(value);
const bytes = value => Buffer.byteLength(value, 'utf8');

function readState(text, projectId) {
  if (text === null) return { schemaVersion: SCHEMA, projectId, revision: 0, threads: [], events: [] };
  if (typeof text !== 'string' || bytes(text) > 65536) fail('COMMENT_STATE_BUDGET');
  let state;
  try { state = JSON.parse(text); } catch { fail('COMMENT_STATE_INVALID'); }
  if (!plain(state) || ![SCHEMA, STATE_V2, STATE_V3].includes(state.schemaVersion) || state.projectId !== projectId
    || !Number.isSafeInteger(state.revision) || state.revision < 0
    || !Array.isArray(state.threads) || state.threads.length > 128
    || !Array.isArray(state.events) || state.events.length > 512) fail('COMMENT_STATE_INVALID');
  const ids = new Set();
  for (const thread of state.threads) {
    if (!plain(thread) || typeof thread.threadId !== 'string' || ids.has(thread.threadId)
      || !Array.isArray(thread.messages) || thread.messages.length < 1 || thread.messages.length > 129
      || !['open', 'resolved', 'deleted'].includes(thread.status)) fail('COMMENT_STATE_INVALID');
    if ((thread.anchor?.kind === 'point' || thread.anchorEditHistory !== undefined) && state.schemaVersion !== STATE_V3) fail('COMMENT_ANCHOR_STATE_VERSION_REQUIRED');
    if (thread.anchorEditHistory !== undefined) {
      if (!Array.isArray(thread.anchorEditHistory) || thread.anchorEditHistory.length > 32) fail('COMMENT_HISTORY_INVALID');
      const histories = new Set();
      for (const h of thread.anchorEditHistory) {
        if (!plain(h) || Object.keys(h).sort().join(',') !== 'after,afterTextSha256,before,beforeTextSha256,historyId,sessionId,undone'
          || !id(h.historyId) || !id(h.sessionId) || typeof h.undone !== 'boolean' || histories.has(h.sessionId+'|'+h.historyId)) fail('COMMENT_HISTORY_INVALID');
        histories.add(h.sessionId+'|'+h.historyId);
        for (const [key,digestKey] of [['before','beforeTextSha256'],['after','afterTextSha256']]) {
          const p=h[key], point=p?.kind==='point';
          if (!plain(p) || Object.keys(p).sort().join(',') !== [...(point?['kind','affinity']:[]),...(p.status==='deleted'?['deletedText']:[]),'blockTextSha256','length','sceneParagraphIndex','startUtf16','status'].sort().join(',')
            || !Number.isSafeInteger(p.sceneParagraphIndex) || p.sceneParagraphIndex<0 || p.sceneParagraphIndex!==thread.anchor?.sceneParagraphIndex
            || !Number.isSafeInteger(p.startUtf16) || p.startUtf16<0 || !Number.isSafeInteger(p.length) || p.length<0
            || (point ? p.length!==0 || p.affinity!=='right' : p.length===0)
            || (p.status==='deleted' && (typeof p.deletedText!=='string' || !p.deletedText.isWellFormed() || p.deletedText.length!==p.length || bytes(p.deletedText)>16384))
            || !['open','resolved','deleted'].includes(p.status) || !/^[a-f0-9]{64}$/u.test(p.blockTextSha256)
            || p.blockTextSha256!==h[digestKey]) fail('COMMENT_HISTORY_INVALID');
        }
      }
    }
    ids.add(thread.threadId);
    if (thread.deletedMessages !== undefined && (!Array.isArray(thread.deletedMessages)
      || thread.messages.length + thread.deletedMessages.length > 129)) fail('COMMENT_STATE_INVALID');
    const messageIds = new Set();
    for (const message of [...thread.messages, ...(thread.deletedMessages || [])]) {
      if (!plain(message) || typeof message.commentId !== 'string' || messageIds.has(message.commentId)
        || typeof message.body !== 'string' || bytes(message.body) > 16384) fail('COMMENT_STATE_INVALID');
      if (message.richBody !== undefined && ![STATE_V2, STATE_V3].includes(state.schemaVersion)) fail('COMMENT_RICH_STATE_VERSION_REQUIRED');
      validateCommentMessageContent(message);
      messageIds.add(message.commentId);
    }
    if ((thread.deletedMessages || []).some(m => m.kind !== 'reply' || m.commentId === thread.rootCommentId)) fail('COMMENT_STATE_INVALID');
  }
  return state;
}

function exactAnchor(anchor, sceneId, paragraphs) {
  if (!plain(anchor) || Object.keys(anchor).some(k => !['paragraphIndex', 'startUtf16', 'selectedText', 'kind', 'affinity'].includes(k))) fail('COMMENT_ANCHOR_INVALID');
  const point = anchor.kind === 'point';
  if (point ? anchor.affinity !== 'right' || anchor.selectedText !== '' : anchor.kind !== undefined || anchor.affinity !== undefined) fail('COMMENT_ANCHOR_INVALID');
  const { paragraphIndex, startUtf16, selectedText } = anchor;
  const text = paragraphs[paragraphIndex];
  if (!Number.isSafeInteger(paragraphIndex) || paragraphIndex < 0 || typeof text !== 'string'
    || !Number.isSafeInteger(startUtf16) || startUtf16 < 0 || typeof selectedText !== 'string'
    || (!point && !selectedText) || bytes(selectedText) > 16384 || startUtf16 > text.length
    || text.slice(startUtf16, startUtf16 + selectedText.length) !== selectedText) fail('COMMENT_ANCHOR_STALE');
  const edges = new Set([text.length, ...Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text), s => s.index)]);
  if (!edges.has(startUtf16) || !edges.has(startUtf16 + selectedText.length)) fail('COMMENT_ANCHOR_GRAPHEME');
  return { ...(point ? { kind: 'point', affinity: 'right' } : {}), sceneId, sceneParagraphIndex: paragraphIndex, paragraphIndex, startUtf16, selectedText,
    selectedTextSha256: sha(selectedText), blockTextSha256: sha(text), authoritySource: 'CANONICAL_LOCAL_AUTHORING' };
}

function planCommentAuthoring({ beforeText, projectId, sceneId, sceneSha256, paragraphs, input, now }) {
  if (!plain(input) || Object.keys(input).some(k => !['requestId', 'action', 'projectId', 'sceneId', 'subjectId',
    'expectedStateSha256', 'expectedSceneSha256', 'threadId', 'commentId', 'body', 'richBody', 'richBodyJson', 'anchor'].includes(k))) fail('COMMENT_INPUT_INVALID');
  if (!id(input.requestId) || input.projectId !== projectId || input.sceneId !== sceneId
    || input.expectedSceneSha256 !== sceneSha256 || !/^[a-f0-9]{64}$/u.test(sceneSha256)
    || typeof now !== 'string' || !Number.isFinite(Date.parse(now))) fail('COMMENT_IDENTITY_STALE');
  const actions = ['create', 'edit', 'reply', 'resolve', 'reopen', 'delete', 'reanchor'];
  if (!actions.includes(input.action)) fail('COMMENT_ACTION_INVALID');
  let content, contentInput = input;
  if (Object.hasOwn(input, 'richBodyJson')) {
    if (typeof input.richBodyJson !== 'string' || bytes(input.richBodyJson) > 65536
      || Object.hasOwn(input, 'body') || Object.hasOwn(input, 'richBody')
      || !['create','reply','edit'].includes(input.action)) fail('COMMENT_RICH_WIRE_INVALID');
    let richBody;
    try { richBody = JSON.parse(input.richBodyJson); } catch { fail('COMMENT_RICH_WIRE_JSON_INVALID'); }
    contentInput = {richBody};
  }
  if (['create', 'reply', 'edit'].includes(input.action)) content = validateCommentMessageContent(contentInput, { deriveBody: true });
  else if (input.body !== undefined || input.richBody !== undefined) fail('COMMENT_INPUT_INVALID');
  const before = readState(beforeText, projectId);
  const digest = sha(JSON.stringify(Object.fromEntries(Object.keys(input).sort().map(k => [k, input[k]]))));
  const oldEvent = before.events.find(e => e?.type === 'WORD_COMMENT_AUTHORED' && e.operationId === input.requestId);
  if (oldEvent) {
    if (oldEvent.inputDigest !== digest || oldEvent.resultingRevision !== before.revision) fail('COMMENT_REPLAY_CONFLICT');
    return { replay: true, afterText: beforeText, state: before, threadId: oldEvent.threadId };
  }
  if (input.expectedStateSha256 !== (beforeText === null ? '' : sha(beforeText))) fail('COMMENT_STATE_CONFLICT');
  const after = clone(before);
  let thread = after.threads.find(t => t.threadId === input.threadId);
  if (input.action !== 'create' && (!thread || thread.sceneId !== sceneId || thread.status === 'deleted')) fail('COMMENT_TARGET_INVALID');
  if (thread && input.action !== 'reanchor') {
    const anchor = thread.anchor || {};
    const proved = exactAnchor({ paragraphIndex: anchor.sceneParagraphIndex, startUtf16: anchor.startUtf16, selectedText: anchor.selectedText, ...(anchor.kind === 'point' ? {kind:'point',affinity:anchor.affinity} : {}) }, sceneId, paragraphs);
    if (anchor.sceneId !== sceneId || anchor.blockTextSha256 !== proved.blockTextSha256 || anchor.selectedTextSha256 !== proved.selectedTextSha256) fail('COMMENT_ANCHOR_STALE');
  }
  if (!['create', 'reanchor'].includes(input.action) && input.anchor !== undefined) fail('COMMENT_INPUT_INVALID');
  if (!['edit', 'delete'].includes(input.action) && input.commentId !== undefined) fail('COMMENT_INPUT_INVALID');
  if (input.action === 'create') {
    if (input.threadId !== undefined || after.threads.length >= 128) fail('COMMENT_INPUT_INVALID');
    const threadId = `local-comment-${sha(projectId + '\n' + input.requestId)}`;
    if (after.threads.some(t => t.threadId === threadId)) fail('COMMENT_IDENTITY_COLLISION');
    const commentId = `${threadId}:root`;
    thread = { threadId, sceneId, rootCommentId: commentId, status: 'open',
      anchor: exactAnchor(input.anchor, sceneId, paragraphs),
      messages: [{ commentId, kind: 'root', ...content, provenance: { author: 'Автор Yalken', date: now } }] };
    after.threads.push(thread);
  } else if (input.action === 'reply') {
    if (thread.status !== 'open' || thread.messages.length + (thread.deletedMessages?.length || 0) >= 129) fail('COMMENT_REPLY_UNAVAILABLE');
    thread.messages.push({ commentId: `local-reply-${sha(projectId + '\n' + input.requestId)}`, kind: 'reply',
      ...content, provenance: { author: 'Автор Yalken', date: now } });
  } else if (input.action === 'edit') {
    const message = thread.messages.find(m => m.commentId === input.commentId);
    if (!message) fail('COMMENT_MESSAGE_UNKNOWN');
    delete message.richBody;
    Object.assign(message, content); // Original Word provenance is retained, not re-authenticated.
  } else if (input.action === 'reanchor') {
    delete thread.anchorEditHistory;
    thread.anchor = exactAnchor(input.anchor, sceneId, paragraphs);
  } else if (input.action === 'delete' && input.commentId !== undefined) {
    const index = thread.messages.findIndex(m => m.commentId === input.commentId);
    if (index < 1 || thread.messages[index].kind !== 'reply') fail('COMMENT_REPLY_TARGET_INVALID');
    thread.deletedMessages = [...(thread.deletedMessages || []), thread.messages[index]];
    thread.messages.splice(index, 1);
  } else {
    const desired = { resolve: 'resolved', reopen: 'open', delete: 'deleted' }[input.action];
    if (thread.status === desired) fail('COMMENT_STATUS_UNCHANGED');
    delete thread.anchorEditHistory;
    thread.status = desired;
  }
  upgradeCommentState(after);
  after.revision++;
  if (!Number.isSafeInteger(after.revision) || after.events.length >= 512) fail('COMMENT_STATE_BUDGET');
  after.events.push({ type: 'WORD_COMMENT_AUTHORED', operationId: input.requestId, action: input.action,
    threadId: thread.threadId, inputDigest: digest, resultingRevision: after.revision, at: now });
  const afterText = JSON.stringify(after, null, 2) + '\n';
  if (bytes(afterText) > 65536) fail('COMMENT_STATE_BUDGET');
  return { replay: false, afterText, state: after, threadId: thread.threadId };
}

module.exports = { COMMAND_ID, readState, exactAnchor, planCommentAuthoring };

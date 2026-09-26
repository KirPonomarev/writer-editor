'use strict';

const crypto = require('node:crypto');
const SCHEMA = 'yalken.rtk.word.non-text-return-state.v1';
const COMMAND_ID = 'cmd.project.review.editComment';
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
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
  if (!plain(state) || state.schemaVersion !== SCHEMA || state.projectId !== projectId
    || !Number.isSafeInteger(state.revision) || state.revision < 0
    || !Array.isArray(state.threads) || state.threads.length > 128
    || !Array.isArray(state.events) || state.events.length > 512) fail('COMMENT_STATE_INVALID');
  const ids = new Set();
  for (const thread of state.threads) {
    if (!plain(thread) || typeof thread.threadId !== 'string' || ids.has(thread.threadId)
      || !Array.isArray(thread.messages) || thread.messages.length < 1 || thread.messages.length > 129
      || !['open', 'resolved', 'deleted'].includes(thread.status)) fail('COMMENT_STATE_INVALID');
    ids.add(thread.threadId);
    const messageIds = new Set();
    for (const message of thread.messages) {
      if (!plain(message) || typeof message.commentId !== 'string' || messageIds.has(message.commentId)
        || typeof message.body !== 'string' || bytes(message.body) > 16384) fail('COMMENT_STATE_INVALID');
      messageIds.add(message.commentId);
    }
  }
  return state;
}

function exactAnchor(anchor, sceneId, paragraphs) {
  if (!plain(anchor) || Object.keys(anchor).some(k => !['paragraphIndex', 'startUtf16', 'selectedText'].includes(k))) fail('COMMENT_ANCHOR_INVALID');
  const { paragraphIndex, startUtf16, selectedText } = anchor;
  const text = paragraphs[paragraphIndex];
  if (!Number.isSafeInteger(paragraphIndex) || paragraphIndex < 0 || typeof text !== 'string'
    || !Number.isSafeInteger(startUtf16) || startUtf16 < 0 || typeof selectedText !== 'string'
    || !selectedText || bytes(selectedText) > 16384
    || text.slice(startUtf16, startUtf16 + selectedText.length) !== selectedText) fail('COMMENT_ANCHOR_STALE');
  const edges = new Set([text.length, ...Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text), s => s.index)]);
  if (!edges.has(startUtf16) || !edges.has(startUtf16 + selectedText.length)) fail('COMMENT_ANCHOR_GRAPHEME');
  return { sceneId, sceneParagraphIndex: paragraphIndex, paragraphIndex, startUtf16, selectedText,
    selectedTextSha256: sha(selectedText), blockTextSha256: sha(text), authoritySource: 'CANONICAL_LOCAL_AUTHORING' };
}

function planCommentAuthoring({ beforeText, projectId, sceneId, sceneSha256, paragraphs, input, now }) {
  if (!plain(input) || Object.keys(input).some(k => !['requestId', 'action', 'projectId', 'sceneId', 'subjectId',
    'expectedStateSha256', 'expectedSceneSha256', 'threadId', 'commentId', 'body', 'anchor'].includes(k))) fail('COMMENT_INPUT_INVALID');
  if (!id(input.requestId) || input.projectId !== projectId || input.sceneId !== sceneId
    || input.expectedSceneSha256 !== sceneSha256 || !/^[a-f0-9]{64}$/u.test(sceneSha256)
    || typeof now !== 'string' || !Number.isFinite(Date.parse(now))) fail('COMMENT_IDENTITY_STALE');
  const actions = ['create', 'edit', 'reply', 'resolve', 'reopen', 'delete', 'reanchor'];
  if (!actions.includes(input.action)) fail('COMMENT_ACTION_INVALID');
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
    const proved = exactAnchor({ paragraphIndex: anchor.sceneParagraphIndex, startUtf16: anchor.startUtf16, selectedText: anchor.selectedText }, sceneId, paragraphs);
    if (anchor.sceneId !== sceneId || anchor.blockTextSha256 !== proved.blockTextSha256 || anchor.selectedTextSha256 !== proved.selectedTextSha256) fail('COMMENT_ANCHOR_STALE');
  }
  if (['create', 'reply', 'edit'].includes(input.action)) {
    if (typeof input.body !== 'string' || !input.body.trim() || bytes(input.body) > 16384
      || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\r]/u.test(input.body)) fail('COMMENT_BODY_INVALID');
  } else if (input.body !== undefined) fail('COMMENT_INPUT_INVALID');
  if (!['create', 'reanchor'].includes(input.action) && input.anchor !== undefined) fail('COMMENT_INPUT_INVALID');
  if (input.action !== 'edit' && input.commentId !== undefined) fail('COMMENT_INPUT_INVALID');
  if (input.action === 'create') {
    if (input.threadId !== undefined || after.threads.length >= 128) fail('COMMENT_INPUT_INVALID');
    const threadId = `local-comment-${sha(projectId + '\n' + input.requestId)}`;
    if (after.threads.some(t => t.threadId === threadId)) fail('COMMENT_IDENTITY_COLLISION');
    const commentId = `${threadId}:root`;
    thread = { threadId, sceneId, rootCommentId: commentId, status: 'open',
      anchor: exactAnchor(input.anchor, sceneId, paragraphs),
      messages: [{ commentId, kind: 'root', body: input.body, provenance: { author: 'Автор Yalken', date: now } }] };
    after.threads.push(thread);
  } else if (input.action === 'reply') {
    if (thread.status !== 'open' || thread.messages.length >= 129) fail('COMMENT_REPLY_UNAVAILABLE');
    thread.messages.push({ commentId: `local-reply-${sha(projectId + '\n' + input.requestId)}`, kind: 'reply',
      body: input.body, provenance: { author: 'Автор Yalken', date: now } });
  } else if (input.action === 'edit') {
    const message = thread.messages.find(m => m.commentId === input.commentId);
    if (!message) fail('COMMENT_MESSAGE_UNKNOWN');
    message.body = input.body; // Original Word provenance is retained, not re-authenticated.
  } else if (input.action === 'reanchor') {
    thread.anchor = exactAnchor(input.anchor, sceneId, paragraphs);
  } else {
    const desired = { resolve: 'resolved', reopen: 'open', delete: 'deleted' }[input.action];
    if (thread.status === desired) fail('COMMENT_STATUS_UNCHANGED');
    thread.status = desired;
  }
  after.revision++;
  if (!Number.isSafeInteger(after.revision) || after.events.length >= 512) fail('COMMENT_STATE_BUDGET');
  after.events.push({ type: 'WORD_COMMENT_AUTHORED', operationId: input.requestId, action: input.action,
    threadId: thread.threadId, inputDigest: digest, resultingRevision: after.revision, at: now });
  const afterText = JSON.stringify(after, null, 2) + '\n';
  if (bytes(afterText) > 65536) fail('COMMENT_STATE_BUDGET');
  return { replay: false, afterText, state: after, threadId: thread.threadId };
}

module.exports = { COMMAND_ID, readState, exactAnchor, planCommentAuthoring };

'use strict';

const { createHash } = require('node:crypto');
const { parseObservablePayload, deriveVisibleTextFromDocument } = require('./document-content-envelope-v1.cjs');
const { readState } = require('./word-comment-authoring-v1.cjs');
const MODE = 'SAFE_ANCHOR_REBASE_V1';
const sha = text => createHash('sha256').update(text).digest('hex');
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
  return parsed.doc.content.map(block => {
    if (!block || !['paragraph', 'heading', 'codeBlock'].includes(block.type)) fail('COMMENT_SAVE_STRUCTURE_UNSUPPORTED');
    return { type: block.type, text: deriveVisibleTextFromDocument({ type: 'doc', content: [block] }) };
  });
}

// Keep only ranges outside every minimum contiguous edit envelope. In repeated
// text the common prefix and suffix overlap; greedily choosing one moves identity.
function safeStart(oldText, newText, start, end) {
  const oldEdges = edges(oldText), newEdges = edges(newText);
  if (!oldEdges.has(start) || !oldEdges.has(end)) fail('COMMENT_SAVE_GRAPHEME_SPLIT');
  if (oldText === newText) return start;
  const n = oldText.length, m = newText.length;
  let prefix = 0, suffix = 0;
  while (prefix < Math.min(n, m) && oldText[prefix] === newText[prefix]) prefix++;
  while (prefix > 0 && (!oldEdges.has(prefix) || !newEdges.has(prefix))) prefix--;
  while (suffix < Math.min(n, m) && oldText[n - suffix - 1] === newText[m - suffix - 1]) suffix++;
  while (suffix > 0 && (!oldEdges.has(n - suffix) || !newEdges.has(m - suffix))) suffix--;
  const earliest = Math.min(prefix, Math.min(n, m) - suffix);
  const latest = Math.max(n - suffix, prefix + Math.max(0, n - m));
  const next = end <= earliest ? start : start >= latest ? start + m - n : null;
  if (next === null) fail('COMMENT_SAVE_RANGE_CONFLICT');
  if (!newEdges.has(next) || !newEdges.has(next + end - start)
    || newText.slice(next, next + end - start) !== oldText.slice(start, end)) fail('COMMENT_SAVE_RANGE_CONFLICT');
  return next;
}

function planCommentAnchorSave({ beforeText, projectId, sceneId, beforeContent, afterContent }) {
  if (beforeText === null) return null;
  const before = readState(beforeText, projectId);
  if (!before.threads.some(t => t.sceneId === sceneId && t.status !== 'deleted')) return null;
  const old = paragraphs(beforeContent), next = paragraphs(afterContent);
  if (old.length !== next.length || old.some((b, i) => b.type !== next[i].type)) fail('COMMENT_SAVE_STRUCTURE_UNSUPPORTED');
  const after = JSON.parse(JSON.stringify(before)); let changed = false;
  for (const thread of after.threads) {
    if (thread.sceneId !== sceneId || thread.status === 'deleted') continue;
    const a = thread.anchor || {}, index = a.sceneParagraphIndex, text = old[index]?.text;
    if (a.sceneId !== sceneId || !Number.isSafeInteger(index) || index < 0 || typeof text !== 'string'
      || !Number.isSafeInteger(a.startUtf16) || a.startUtf16 < 0 || typeof a.selectedText !== 'string'
      || !a.selectedText || text.slice(a.startUtf16, a.startUtf16 + a.selectedText.length) !== a.selectedText
      || a.blockTextSha256 !== sha(text) || a.selectedTextSha256 !== sha(a.selectedText)) fail('COMMENT_SAVE_ANCHOR_STALE');
    const start = safeStart(text, next[index].text, a.startUtf16, a.startUtf16 + a.selectedText.length);
    if (text !== next[index].text) {
      thread.anchor = { ...a, startUtf16: start, blockTextSha256: sha(next[index].text) }; changed = true;
    }
  }
  if (!changed) return null;
  if (before.revision === Number.MAX_SAFE_INTEGER) fail('COMMENT_SAVE_REVISION_OVERFLOW');
  after.revision++;
  const afterText = JSON.stringify(after, null, 2) + '\n';
  if (Buffer.byteLength(afterText) > 65536) fail('COMMENT_SAVE_STATE_BUDGET');
  return { mode: MODE, beforeText, afterText };
}

module.exports = { MODE, planCommentAnchorSave };

'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const review = require('../../src/core/word-pending-text-revisions-v1.cjs');
const envelope = require('../../src/core/document-content-envelope-v1.cjs');
const authoring = require('../../src/core/word-comment-authoring-v1.cjs');
const { planPendingCommentDecision } = require('../../src/core/word-pending-comment-decisions-v1.cjs');
const { sha256UpdateCompatible: sha } = require('../../src/core/browser-safe-hash.cjs');
const projectId = 'pending-comments', sceneId = 'roman/a.txt';
const encode = doc => envelope.composeObservablePayload({ doc });
const p = text => ({ type: 'paragraph', content: [{ type: 'text', text }] });
function document(text = 'oldnew tail', revisions) {
  return review.bindLedger({ schemaVersion: 1, source: { type: 'doc', content: [p(text)] },
    revisions: (revisions || [['delete', 0, 3], ['insert', 3, 6]]).map(([operation, from, to], i) => ({
      id: 'revision-' + (i + 1), nativeId: '' + i, operation, from, to, paragraphIndex: 0,
      author: 'Word reviewer', date: '', dateUtc: '', state: 'pending', groupId: revisions ? null : 'group-1' })), undo: [], redo: [] });
}
function add(doc, beforeText = null, anchor = { paragraphIndex: 0, startUtf16: 0, selectedText: 'new' }, requestId = 'root-1') {
  const current = review.paragraphs(review.normalizeNode(doc)).map(row => (row.content || []).map(n => n.text || '\n').join(''));
  return authoring.planCommentAuthoring({ beforeText, projectId, sceneId, paragraphs: current,
    sceneSha256: sha(encode(doc)), now: '2026-10-05T00:00:00Z', input: { action: 'create', requestId,
      projectId, sceneId, subjectId: 'test', expectedStateSha256: beforeText === null ? '' : sha(beforeText),
      expectedSceneSha256: sha(encode(doc)), body: 'Keep body and provenance', anchor } }).afterText;
}
function decide(doc, state, decision) {
  const after = review.decide(doc, decision).doc;
  const plan = planPendingCommentDecision({ beforeText: state, projectId, sceneId,
    beforeContent: encode(doc), afterContent: encode(after), decision });
  return { doc: JSON.parse(JSON.stringify(after)), state: plan.afterText, plan };
}
test('selected rejection, saved restart Undo/Redo and all decisions preserve exact comment identity', () => {
  const doc = document(), state = add(doc), original = JSON.parse(state).threads[0];
  const rejected = decide(doc, state, { action: 'reject', revisionId: 'revision-1' });
  assert.equal(review.projection(rejected.doc).current, 'old tail');
  assert.equal(JSON.parse(rejected.state).threads[0].status, 'deleted');
  assert.deepEqual(JSON.parse(rejected.state).threads[0].messages, original.messages);
  const undone = decide(rejected.doc, rejected.state, { action: 'undo' });
  assert.deepEqual(JSON.parse(undone.state).threads[0].anchor, original.anchor);
  assert.equal(JSON.parse(undone.state).threads[0].status, 'open');
  const redone = decide(undone.doc, undone.state, { action: 'redo' });
  assert.equal(JSON.parse(redone.state).threads[0].status, 'deleted');
  const accepted = decide(doc, state, { action: 'acceptAll' });
  assert.equal(accepted.state, state, 'accepting current view never rewrites comments');
  assert.equal(decide(accepted.doc, accepted.state, { action: 'undo' }).state, state);
  assert.equal(JSON.parse(decide(doc, state, { action: 'rejectAll' }).state).threads[0].status, 'deleted');
});
test('repeated text uses exact insertion occurrence and restores both consumed and shifted anchors', () => {
  const doc = document('aaa', [['insert', 1, 2]]);
  let state = add(doc, null, { paragraphIndex: 0, startUtf16: 1, selectedText: 'a' });
  state = add(doc, state, { paragraphIndex: 0, startUtf16: 2, selectedText: 'a' }, 'root-2');
  const result = decide(doc, state, { action: 'rejectAll' }), rows = JSON.parse(result.state).threads;
  assert.equal(rows[0].status, 'deleted'); assert.equal(rows[1].status, 'open');
  assert.equal(rows[1].anchor.startUtf16, 1);
  const undo = JSON.parse(decide(result.doc, result.state, { action: 'undo' }).state);
  assert.deepEqual(undo.threads.map(t => t.anchor), JSON.parse(state).threads.map(t => t.anchor));
});
test('a new root after rejection survives the first inverse history and subsequent Redo', () => {
  const doc = document(), rejected = decide(doc, add(doc), { action: 'rejectAll' });
  rejected.state = add(rejected.doc, rejected.state, { paragraphIndex: 0, startUtf16: 0, selectedText: 'old' }, 'later-root');
  const original = JSON.parse(rejected.state).threads[1];
  const undone = decide(rejected.doc, rejected.state, { action: 'undo' });
  assert.equal(JSON.parse(undone.state).threads[1].status, 'deleted');
  const redone = decide(undone.doc, undone.state, { action: 'redo' });
  assert.equal(JSON.parse(redone.state).threads[1].status, 'open');
  assert.deepEqual(JSON.parse(redone.state).threads[1].anchor, original.anchor);
  assert.deepEqual(JSON.parse(redone.state).threads[1].messages, original.messages);
});
test('manual tombstones never revive and sibling threads remain unchanged', () => {
  const doc = document(), state = JSON.parse(add(doc)); state.threads[0].status = 'deleted';
  const sibling = structuredClone(state.threads[0]); sibling.sceneId = 'roman/other.txt';
  sibling.threadId = 'sibling'; sibling.anchor.sceneId = sibling.sceneId; state.threads.push(sibling);
  const result = decide(doc, JSON.stringify(state), { action: 'rejectAll' });
  const undone = decide(result.doc, result.state, { action: 'undo' });
  assert.deepEqual(JSON.parse(undone.state).threads, state.threads);
});
test('forged scene delta, stale anchor and unknown decision refuse instead of publishing a comment graph', () => {
  const doc = document(), state = add(doc), after = review.decide(doc, { action: 'rejectAll' }).doc;
  const args = { beforeText: state, projectId, sceneId, beforeContent: encode(doc), afterContent: encode(after), decision: { action: 'rejectAll' } };
  assert.throws(() => planPendingCommentDecision({ ...args, afterContent: encode(doc) }), /TARGET_MISMATCH/);
  assert.throws(() => planPendingCommentDecision({ ...args, decision: { action: 'discard' } }));
  const stale = JSON.parse(state); stale.threads[0].anchor.blockTextSha256 = sha('wrong');
  assert.throws(() => planPendingCommentDecision({ ...args, beforeText: JSON.stringify(stale) }), /ANCHOR/);
  assert.throws(() => planPendingCommentDecision({ ...args, projectId: 'foreign' }), /STATE_INVALID/);
});

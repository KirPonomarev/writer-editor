'use strict';

const review = require('./word-pending-text-revisions-v1.cjs');
const envelope = require('./document-content-envelope-v1.cjs');
const comments = require('./word-comment-anchor-save-v1.cjs');
const { textDigest } = require('./word-comment-edit-intents-v1.cjs');
const { sha256UpdateCompatible: sha } = require('./browser-safe-hash.cjs');
const fail = code => { throw Object.assign(Error(code), { code }); };
const stable = value => JSON.stringify(value, (_key, v) => v && typeof v === 'object' && !Array.isArray(v)
  ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]])) : v);
const visible = r => r.operation === 'format' || (r.operation === 'insert' ? r.state !== 'rejected' : r.state === 'rejected');

// The command's union intervals, not matching words, own each edit occurrence.
// Existing atomic persistence independently replays the resulting splice plan.
function planPendingCommentDecision({ beforeText, projectId, sceneId, beforeContent, afterContent, decision }) {
  const before = envelope.parseObservablePayload(beforeContent);
  const after = envelope.parseObservablePayload(afterContent);
  if (before.issue || after.issue || !before.doc || !after.doc) fail('PENDING_COMMENT_DECISION_DOCUMENT_INVALID');
  const expected = review.decide(before.doc, decision);
  if (envelope.composeObservablePayload({ ...before, doc: expected.doc }) !== afterContent)
    fail('PENDING_COMMENT_DECISION_TARGET_MISMATCH');
  const oldLedger = review.readLedger(before.doc), newLedger = review.readLedger(after.doc);
  const definitions = ledger => ledger.revisions.map(({ state, ...revision }) => revision);
  if (stable(oldLedger.source) !== stable(newLedger.source) || stable(definitions(oldLedger)) !== stable(definitions(newLedger)))
    return require('./word-pending-recording-comments-v1.cjs').planRecordingRoundDecision(
      { beforeText, projectId, sceneId, beforeContent, afterContent, decision }, oldLedger, newLedger);
  if (stable(oldLedger.source) !== stable(newLedger.source)
    || stable(definitions(oldLedger)) !== stable(definitions(newLedger))
    || oldLedger.revisions.some(r => !['insert', 'delete', 'format'].includes(r.operation) || review.isStructural(r) || r.moveName
      || r.operation === 'format' && r.format.kind !== 'run'))
    fail('PENDING_COMMENT_DECISION_UNSUPPORTED');
  const sessionId = 'pending-comments:' + sha(stable({ projectId, sceneId, source: oldLedger.source, revisions: definitions(oldLedger) }));
  const oldStates = oldLedger.revisions.map(r => r.state), newStates = newLedger.revisions.map(r => r.state);
  const direction = ['undo', 'redo'].includes(decision.action) ? decision.action : 'forward';
  const historyId = 'decision:' + sha(stable(direction === 'undo' ? [newStates, oldStates] : [oldStates, newStates]));
  const source = review.paragraphs(oldLedger.source);
  const oldRows = comments.paragraphs(beforeContent), newRows = comments.paragraphs(afterContent);
  if (source.length !== oldRows.length || source.length !== newRows.length) fail('PENDING_COMMENT_DECISION_UNSUPPORTED');
  const edits = [];
  source.forEach((paragraph, paragraphIndex) => {
    const text = (paragraph.content || []).map(n => n.type === 'hardBreak' ? '\n' : n.text).join('');
    const revisions = oldLedger.revisions.filter(r => r.paragraphIndex === paragraphIndex).sort((a, b) => a.from - b.from);
    let cursor = 0, position = 0;
    for (const r of revisions) {
      const next = newLedger.revisions.find(row => row.id === r.id);
      position += r.from - cursor;
      const wasVisible = visible(r), isVisible = visible(next), value = text.slice(r.from, r.to);
      if (wasVisible !== isVisible) edits.push({ id: 'splice-' + edits.length, historyId, direction,
        fromParagraphIndex: paragraphIndex, fromUtf16: position,
        toParagraphIndex: paragraphIndex, toUtf16: position + (wasVisible ? value.length : 0),
        removedParagraphs: [wasVisible ? value : ''], insertedParagraphs: [isVisible ? value : ''] });
      position += isVisible ? value.length : 0;
      cursor = r.to;
    }
  });
  return comments.planCommentAnchorSave({ beforeText, projectId, sceneId, beforeContent, afterContent,
    includeUnchanged: true, sessionId,
    editIntents: { schemaVersion: 2, baselineTextSha256: textDigest(oldRows.map(row => row.text)), edits } });
}

module.exports = { planPendingCommentDecision };

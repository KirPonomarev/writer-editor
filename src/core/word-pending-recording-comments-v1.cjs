'use strict';

const review = require('./word-pending-text-revisions-v1.cjs');
const recording = require('./word-pending-recording-v1.cjs');
const envelope = require('./document-content-envelope-v1.cjs');
const anchors = require('./word-comment-anchor-save-v1.cjs');
const { readState } = require('./word-comment-authoring-v1.cjs');
const { upgradeCommentState } = require('./word-comment-body-v1.cjs');
const { validateEditIntents, replayEditIntents, textDigest } = require('./word-comment-edit-intents-v1.cjs');
const { sha256UpdateCompatible: sha } = require('./browser-safe-hash.cjs');
const clone = v => JSON.parse(JSON.stringify(v));
const stable = v => JSON.stringify(v, (_k, x) => x && typeof x === 'object' && !Array.isArray(x)
  ? Object.fromEntries(Object.keys(x).sort().map(k => [k, x[k]])) : x);
const equal = (a, b) => stable(a) === stable(b);
const fail = code => { throw Object.assign(Error(code), { code }); };
const frame = ledger => Object.fromEntries(['schemaVersion', 'source', 'revisions', 'undo', 'redo'].map(k => [k, ledger[k]]));
const texts = content => anchors.paragraphs(content).map(p => p.text);
const definitions = ledger => ledger.revisions.map(({ state, ...r }) => r);
const rowText = p => (p.content || []).map(n => n.type === 'hardBreak' ? '\n' : n.text).join('');
function roundIdentity(ledger) {
  const baseline = ledger?.roundUndo?.at(-1);
  if (!baseline) return null;
  return { sessionId: 'recording-round:' + sha(stable(baseline)),
    historyId: 'round:' + sha(stable({ baseline, source: ledger.source, revisions: definitions(ledger) })) };
}
function snapshot(thread) {
  const existing = anchors.currentStructuralHistorySnapshot(thread);
  if (thread.status === 'deleted' && !existing?.liveLocator) return null;
  return anchors.structuralSnapshot(thread, existing?.liveLocator);
}
const snapshotDigest = s => s.status === 'deleted' ? s.liveLocator.blockTextSha256
  : s.kind === 'multi-paragraph-range' ? s.coveredParagraphsSha256 : s.blockTextSha256;

// The recorded source itself carries the exact new intervals. Verify removal
// of inserted nodes reconstructs the original rich source before using them.
function roundEdits(recorded, baseline, beforeTexts, afterTexts, direction = 'forward') {
  const oldIds = new Set(baseline.revisions.map(r => r.id));
  if (recorded.revisions.some(r => !['insert', 'delete'].includes(r.operation) || review.isStructural(r) || r.moveName))
    fail('RECORDING_COMMENT_ROUND_UNSUPPORTED');
  const fresh = recorded.revisions.filter(r => !oldIds.has(r.id));
  if (!fresh.length || fresh.some(r => r.state !== 'pending')) fail('RECORDING_COMMENT_ROUND_UNSUPPORTED');
  const identity = roundIdentity(recorded), edits = [], source = clone(recorded.source);
  const sourceRows = review.paragraphs(source), expectedRows = review.paragraphs(baseline.source);
  if (sourceRows.length !== expectedRows.length) fail('RECORDING_COMMENT_ROUND_UNSUPPORTED');
  const shifted = clone(recorded.revisions.filter(r => oldIds.has(r.id)));
  sourceRows.forEach((paragraph, paragraphIndex) => {
    const value = rowText(paragraph), revisions = recorded.revisions.filter(r => r.paragraphIndex === paragraphIndex).sort((a, b) => a.from - b.from);
    let cursor = 0, position = 0;
    for (const r of revisions) {
      position += r.from - cursor;
      const isFresh = !oldIds.has(r.id), shown = r.operation === 'insert' ? r.state !== 'rejected' : r.state === 'rejected';
      if (isFresh) edits.push({ id: 'round-splice-' + edits.length, ...identity, direction: 'forward',
        fromParagraphIndex: paragraphIndex, toParagraphIndex: paragraphIndex, fromUtf16: position,
        toUtf16: position + (r.operation === 'delete' ? r.to - r.from : 0),
        removedParagraphs: [r.operation === 'delete' ? value.slice(r.from, r.to) : ''],
        insertedParagraphs: [r.operation === 'insert' ? value.slice(r.from, r.to) : ''] });
      if (shown) position += r.to - r.from;
      cursor = r.to;
    }
    const insertions = fresh.filter(r => r.paragraphIndex === paragraphIndex && r.operation === 'insert');
    let offset = 0; const nodes = [];
    for (const node of paragraph.content || []) {
      const size = node.type === 'hardBreak' ? 1 : node.text.length, end = offset + size;
      const cuts = [...new Set([offset, end, ...insertions.flatMap(r => [r.from, r.to]).filter(n => n > offset && n < end)])].sort((a,b) => a-b);
      for (let i = 1; i < cuts.length; i++) if (!insertions.some(r => r.from <= cuts[i-1] && r.to >= cuts[i]))
        nodes.push(node.type === 'hardBreak' ? clone(node) : { ...clone(node), text: node.text.slice(cuts[i-1]-offset, cuts[i]-offset) });
      offset = end;
    }
    paragraph.content = nodes;
    for (const r of shifted.filter(r => r.paragraphIndex === paragraphIndex)) {
      if (insertions.some(i => i.from < r.to && i.to > r.from)) fail('RECORDING_COMMENT_ROUND_UNSUPPORTED');
      const shift = insertions.filter(i => i.to <= r.from).reduce((n,i) => n+i.to-i.from,0); r.from -= shift; r.to -= shift;
    }
  });
  if (!equal(review.normalizeNode(source), review.normalizeNode(baseline.source)) || !equal(shifted, baseline.revisions))
    fail('RECORDING_COMMENT_ROUND_SOURCE_MISMATCH');
  // sessionId belongs to the plan; it is never accepted as an edit field.
  edits.forEach(e => { delete e.sessionId; });
  const directed = direction === 'undo' ? edits.slice().reverse().map((e, i) => ({ ...e, id: 'round-undo-' + i,
    direction: 'undo', toUtf16: e.fromUtf16 + e.insertedParagraphs[0].length,
    removedParagraphs: e.insertedParagraphs, insertedParagraphs: e.removedParagraphs }))
    : edits.map(e => ({ ...e, direction }));
  const plan = { schemaVersion: 2, baselineTextSha256: textDigest(beforeTexts), edits: directed };
  replayEditIntents(beforeTexts, afterTexts, plan);
  return { ...identity, plan };
}

function planRecordingCommentSave(input) {
  const { beforeText, projectId, sceneId, beforeContent, afterContent, recordingProofJson } = input;
  if (typeof recordingProofJson !== 'string' || Buffer.byteLength(recordingProofJson) > 8 * 1024 * 1024)
    fail('RECORDING_COMMENT_PROOF_BUDGET');
  let proof; try { proof = JSON.parse(recordingProofJson); } catch { fail('RECORDING_COMMENT_PROOF_INVALID'); }
  if (Object.keys(proof).sort().join(',') !== 'baselineContent,metadata,nextIntents,previousIntents,schemaVersion,sessionId'
    || proof.schemaVersion !== 1 || typeof proof.baselineContent !== 'string'
    || typeof proof.sessionId !== 'string' || !/^[A-Za-z0-9_.:-]{1,160}$/u.test(proof.sessionId)) fail('RECORDING_COMMENT_PROOF_INVALID');
  const baseline = envelope.parseObservablePayload(proof.baselineContent), before = envelope.parseObservablePayload(beforeContent), after = envelope.parseObservablePayload(afterContent);
  if ([baseline, before, after].some(p => p.issue || !p.doc)) fail('RECORDING_COMMENT_DOCUMENT_INVALID');
  const previous = validateEditIntents(proof.previousIntents), next = validateEditIntents(proof.nextIntents);
  if (previous.schemaVersion !== 2 || next.schemaVersion !== 2 || previous.baselineTextSha256 !== next.baselineTextSha256
    || !equal(next.edits.slice(0, previous.edits.length), previous.edits)) fail('RECORDING_COMMENT_PREFIX_STALE');
  for (const [parsed, plan] of [[before, previous], [after, next]]) {
    const derived = recording.derive(baseline.doc, review.normalizeNode(parsed.doc), proof.metadata, plan);
    if (!equal(envelope.canonicalizeDocumentJson(derived.doc), envelope.canonicalizeDocumentJson(parsed.doc)))
      fail('RECORDING_COMMENT_LEDGER_MISMATCH');
  }
  const delta = { schemaVersion: 2, baselineTextSha256: textDigest(texts(beforeContent)), edits: next.edits.slice(previous.edits.length) };
  const normal = anchors.planCommentAnchorSave({ beforeText, projectId, sceneId, beforeContent, afterContent,
    editIntents: delta, sessionId: proof.sessionId, includeUnchanged: true });
  if (!normal) return null;
  const originalState = readState(beforeText, projectId), state = readState(normal.afterText, projectId);
  const baseFrame = frame(review.readLedger(recording.prepare(baseline.doc).baseline));
  const beforeLedger = review.readLedger(before.doc), afterLedger = review.readLedger(after.doc);
  const belongs = ledger => ledger?.roundUndo?.length && equal(ledger.roundUndo.at(-1), { ...baseFrame, redo: [] });
  const priorId = belongs(beforeLedger) ? roundIdentity(beforeLedger) : null;
  const nextId = belongs(afterLedger) ? roundIdentity(afterLedger) : null;
  if (nextId) roundEdits(afterLedger, afterLedger.roundUndo.at(-1), texts(proof.baselineContent), texts(afterContent));
  let inverseState;
  for (const thread of state.threads.filter(t => t.sceneId === sceneId)) {
    const priorThread = originalState.threads.find(t => t.threadId === thread.threadId);
    const priorEntry = priorId && priorThread.anchorEditHistory?.find(h => h.sessionId === priorId.sessionId && h.historyId === priorId.historyId);
    let initial = priorEntry?.before;
    if (!initial && nextId && snapshot(priorThread)) {
      if (!priorId) initial = snapshot(priorThread);
      else {
        if (!inverseState) {
          const inverse = roundEdits(beforeLedger, beforeLedger.roundUndo.at(-1), texts(beforeContent), texts(proof.baselineContent), 'undo');
          inverseState = readState(anchors.planCommentAnchorSave({ beforeText, projectId, sceneId, beforeContent,
            afterContent: proof.baselineContent, sessionId: inverse.sessionId, editIntents: inverse.plan, includeUnchanged: true }).afterText, projectId);
        }
        initial = snapshot(inverseState.threads.find(t => t.threadId === thread.threadId));
      }
    }
    if (priorId) thread.anchorEditHistory = (thread.anchorEditHistory || []).filter(h => !(h.sessionId === priorId.sessionId && h.historyId === priorId.historyId));
    const final = snapshot(thread);
    if (nextId && initial && final) {
      const entry = { schemaVersion: 2, ...nextId, before: initial, after: final,
        beforeTextSha256: snapshotDigest(initial), afterTextSha256: snapshotDigest(final), undone: false };
      const history = thread.anchorEditHistory || [];
      const firstCurrent = history.findIndex(h => h.sessionId === proof.sessionId);
      history.splice(firstCurrent < 0 ? history.length : firstCurrent, 0, entry);
      thread.anchorEditHistory = history.slice(-32);
    }
    if (thread.anchorEditHistory?.length === 0) delete thread.anchorEditHistory;
  }
  if (!equal(originalState, state)) { state.revision = originalState.revision + 1; upgradeCommentState(state); }
  let afterText = equal(originalState, state) ? beforeText : JSON.stringify(state, null, 2) + '\n';
  if (Buffer.byteLength(afterText) > 65536) afterText = JSON.stringify(state) + '\n';
  if (Buffer.byteLength(afterText) > 65536) fail('COMMENT_SAVE_STATE_BUDGET');
  readState(afterText, projectId);
  return { mode: anchors.MODE, beforeText, afterText, recordingProofJson };
}

function planRecordingRoundDecision(input, oldLedger, newLedger) {
  const direction = input.decision.action;
  if (!['undo', 'redo'].includes(direction)) fail('PENDING_COMMENT_DECISION_UNSUPPORTED');
  const recorded = direction === 'undo' ? oldLedger : newLedger, baseline = direction === 'undo' ? newLedger : oldLedger;
  if (!equal(recorded.roundUndo.at(-1), frame(baseline))) fail('RECORDING_COMMENT_ROUND_SOURCE_MISMATCH');
  const bound = roundEdits(recorded, frame(baseline), texts(input.beforeContent), texts(input.afterContent), direction);
  return anchors.planCommentAnchorSave({ ...input, includeUnchanged: true, sessionId: bound.sessionId, editIntents: bound.plan });
}

module.exports = { planRecordingCommentSave, planRecordingRoundDecision, roundIdentity };

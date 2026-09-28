'use strict';

const model = require('./word-manuscript-notes-v1.cjs');
const { notesStateDigest } = require('../export/docx/docxReviewPacketNotes.js');
const clone = value => JSON.parse(JSON.stringify(value));
const stable = value => Array.isArray(value) ? `[${value.map(stable).join(',')}]`
  : value && typeof value === 'object' ? `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}` : JSON.stringify(value);
const need = (ok, code) => { if (!ok) throw Object.assign(Error(code), { code }); };

// Pure plan: caller supplies authenticated local authority, fresh canonical
// state and a fully validated package. Provider identities never select paths.
function planNoteReturnDelta({ document, projectId, roundId, artifactSha256, baseline,
  exportMap, returnedNotes, returnedParagraphs, now }) {
  need(typeof roundId === 'string' && roundId.length > 0 && roundId.length <= 256
    && /^(?:sha256:)?[a-f0-9]{64}$/u.test(artifactSha256), 'NOTE_RETURN_IDENTITY_INVALID');
  need(baseline?.projectId === projectId && baseline.policy === 'MANUSCRIPT_NOTES_EXPLICIT_RETURN_V1'
    && Array.isArray(baseline.sourceBindings) && baseline.sourceBindings.length <= 256,
  'NOTE_RETURN_BASELINE_REQUIRED');
  model.validateManuscriptDocument(document, projectId);
  need(Array.isArray(returnedNotes) && returnedNotes.length <= 256 && Array.isArray(returnedParagraphs)
    && Array.isArray(exportMap?.scenes), 'NOTE_RETURN_GRAPH_INCOMPLETE');
  const blocks = exportMap.scenes.flatMap(scene => (scene.blocks || []).map(block => ({
    ...block, sceneId: scene.sceneId, text: block.formatIr?.runs?.map(run => run.text).join(''),
  })));
  need(blocks.length === returnedParagraphs.length && blocks.length <= 10000, 'NOTE_RETURN_MANUSCRIPT_CHANGED');
  const byParagraph = new Map();
  for (const block of blocks) {
    need(typeof block.text === 'string' && Number.isSafeInteger(block.documentParagraphIndex)
      && !byParagraph.has(block.documentParagraphIndex), 'NOTE_RETURN_EXPORT_MAP_INVALID');
    byParagraph.set(block.documentParagraphIndex, block);
  }
  const seenParagraphs = new Set();
  for (const p of returnedParagraphs) {
    need(byParagraph.get(p?.paragraphIndex)?.text === p.paragraphText && p.trackedRevision === false
      && !seenParagraphs.has(p.paragraphIndex), 'NOTE_RETURN_MANUSCRIPT_CHANGED');
    seenParagraphs.add(p.paragraphIndex);
  }
  const known = new Map(), localIds = new Set();
  for (const binding of baseline.sourceBindings) {
    need(!localIds.has(binding.noteId), 'NOTE_RETURN_BASELINE_COLLISION'); localIds.add(binding.noteId);
    if (!binding.richBody) continue;
    need(/^_YALKEN_NOTE_[a-f0-9]{24}$/u.test(binding.transportIdentity) && !known.has(binding.transportIdentity), 'NOTE_RETURN_BASELINE_COLLISION');
    known.set(binding.transportIdentity, binding);
  }
  // Explicitly selected private notes keep their signed read-only contract.
  const privateBindings = baseline.sourceBindings.filter(binding => !binding.richBody);
  const privateCandidates = new Set();
  for (const binding of privateBindings) {
    const matches = returnedNotes.map((note, i) => ({ note, i })).filter(({ note, i }) => !privateCandidates.has(i)
      && !note.transportIdentity && note.kind === binding.kind && note.paragraphIndex === binding.documentParagraphIndex
      && note.offsetUtf16 === binding.offsetUtf16 && stable(note.paragraphs) === stable(binding.paragraphs));
    need(matches.length === 1, 'NOTE_RETURN_PRIVATE_SELECTION_CHANGED'); privateCandidates.add(matches[0].i);
  }
  const seen = new Set(), candidates = [];
  for (const [index, note] of returnedNotes.entries()) {
    if (privateCandidates.has(index)) continue;
    const binding = note.transportIdentity ? known.get(note.transportIdentity) : null;
    need(!note.transportIdentity || binding && !seen.has(note.transportIdentity), 'NOTE_RETURN_IDENTITY_COLLISION');
    if (binding) seen.add(note.transportIdentity);
    const block = byParagraph.get(note.paragraphIndex);
    need(block && model.boundary(block.text, note.offsetUtf16), 'NOTE_RETURN_POINT_INVALID');
    const sceneBlocks = blocks.filter(b => b.sceneId === block.sceneId);
    const blockIndex = sceneBlocks.indexOf(block), sceneContent = sceneBlocks.map(b => b.text).join('\n');
    const offsetUtf16 = sceneBlocks.slice(0, blockIndex).reduce((n, b) => n + b.text.length + 1, 0) + note.offsetUtf16;
    const manuscript = model.bindManuscriptPayload({ kind: note.kind, body: note.body, sceneId: block.sceneId, offsetUtf16, sceneContent });
    candidates.push({ noteId: binding?.noteId || `note-${model.sha(projectId + '\n' + roundId + '\n' + artifactSha256 + '\n' + index).slice(0, 32)}`,
      created: !binding, manuscript, body: model.validateNoteBody(note.body).text });
  }
  const operationId = `word-note-return-${model.sha(roundId + '\n' + artifactSha256)}`;
  const inputDigest = model.sha(stable({ projectId, roundId, artifactSha256, baseline: baseline.stateDigest, candidates, seen: [...seen].sort() }));
  const receipts = document.wordNoteReturnReceipts || [];
  need(Array.isArray(receipts) && receipts.length <= 128, 'NOTE_RETURN_RECEIPT_BUDGET');
  const prior = receipts.find(receipt => receipt.operationId === operationId);
  const graphDigest = value => notesStateDigest({ ...value, wordNoteReturnReceipts: [] });
  if (prior) {
    need(prior.inputDigest === inputDigest && prior.resultDigest === graphDigest(document), 'NOTE_RETURN_REPLAY_CONFLICT');
    return { replay: true, document, operationId, changes: prior.changes };
  }
  need(notesStateDigest(document) === baseline.stateDigest, 'NOTE_RETURN_BASELINE_CONFLICT');
  const after = clone(document), changes = [];
  need(typeof now === 'string' && Number.isFinite(Date.parse(now)), 'NOTE_RETURN_CLOCK_INVALID');
  for (const candidate of candidates) {
    const old = after.notes.find(note => note.id === candidate.noteId);
    if (candidate.created) {
      need(!old, 'NOTE_RETURN_LOCAL_ID_COLLISION');
      after.notes.push({ schemaVersion: 1, id: candidate.noteId, scope: 'manuscript', title: '', body: candidate.body,
        manuscript: candidate.manuscript, deleted: false, createdAtUtc: now, updatedAtUtc: now, attachment: { scope: 'manuscript' } });
      changes.push({ noteId: candidate.noteId, operation: 'create', before: null, after: candidate.manuscript });
    } else {
      need(old?.manuscript && !old.deleted, 'NOTE_RETURN_TARGET_INVALID');
      if (stable(old.manuscript) !== stable(candidate.manuscript)) {
        changes.push({ noteId: old.id, operation: 'update', before: clone(old.manuscript), after: candidate.manuscript });
        old.manuscript = candidate.manuscript; old.body = candidate.body; old.updatedAtUtc = now;
      }
    }
  }
  for (const [identity, binding] of known) {
    if (seen.has(identity)) continue;
    const old = after.notes.find(note => note.id === binding.noteId);
    need(old?.manuscript && !old.deleted, 'NOTE_RETURN_TARGET_INVALID');
    changes.push({ noteId: old.id, operation: 'delete', before: clone(old.manuscript), after: null });
    old.deleted = true; old.updatedAtUtc = now;
  }
  if (!changes.length) return { unchanged: true, replay: false, document, operationId, changes };
  model.validateManuscriptDocument(after, projectId);
  need(receipts.length < 128, 'NOTE_RETURN_RECEIPT_BUDGET');
  after.wordNoteReturnReceipts = [...receipts, { operationId, inputDigest, resultDigest: graphDigest(after),
    roundId, artifactSha256, changes }];
  need(Buffer.byteLength(JSON.stringify(after)) <= 4 * model.LIMITS.bytes, 'NOTE_RETURN_STATE_BUDGET');
  return { replay: false, document: after, operationId, changes };
}
module.exports = { planNoteReturnDelta };

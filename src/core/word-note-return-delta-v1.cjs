'use strict';

const model = require('./word-manuscript-notes-v1.cjs');
const { notesStateDigest } = require('../export/docx/docxReviewPacketNotes.js');
const { compareTableParagraphTopology } = require('../io/documentTables.js');
const clone = value => JSON.parse(JSON.stringify(value));
const stable = value => Array.isArray(value) ? `[${value.map(stable).join(',')}]`
  : value && typeof value === 'object' ? `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}` : JSON.stringify(value);
const need = (ok, code) => { if (!ok) throw Object.assign(Error(code), { code }); };

// Word materializes document defaults and may split equivalent text runs.
// Compare effective meanings, retaining the original authored representation
// only when every supported property and exact character remains equivalent.
function effectiveBody(paragraphs, defaults) {
  return paragraphs.map(({ paragraph, list }) => {
    const runs = [];
    for (const node of paragraph.content || []) {
      if (node.type === 'hardBreak') { runs.push({ type: 'hardBreak' }); continue; }
      if (node.type === 'image') { runs.push({ type: 'image', attrs: node.attrs }); continue; }
      const marks = [], style = { ...(defaults?.fontSize ? { fontSize: defaults.fontSize } : {}) };
      for (const mark of node.marks || []) {
        if (mark.type === 'textStyle') Object.assign(style, Object.fromEntries(Object.entries(mark.attrs || {}).filter(([, v]) => v != null)));
        else if (mark.type === 'link') marks.push({ type: 'link', href: mark.attrs.href });
        else marks.push(mark.type === 'highlight' ? { type: mark.type, color: mark.attrs.color.toLowerCase() } : { type: mark.type });
      }
      if (style.color) style.color = style.color.toLowerCase();
      if (Object.keys(style).length) marks.push({ type: 'textStyle', attrs: style });
      marks.sort((a, b) => a.type.localeCompare(b.type));
      const previous = runs.at(-1);
      if (previous?.type === 'text' && stable(previous.marks) === stable(marks)) previous.text += node.text;
      else runs.push({ type: 'text', text: node.text, marks });
    }
    return { align: paragraph.attrs?.textAlign || 'left', runs, list };
  });
}

function equivalentBody(expectedBody, returnedBody, defaults) {
  const expected = model.validateNoteBody(expectedBody).paragraphs;
  const actual = model.validateNoteBody(returnedBody).paragraphs;
  // Text equality cannot authorize discarding table-only edits. Reuse the
  // existing strict topology/property oracle, including its authenticated
  // legacy auto-fit policy, before retaining the original representation.
  return compareTableParagraphTopology(actual, expected.map(({ table }) => ({ formatIr: { table } }))).ok
    && stable(effectiveBody(expected, defaults)) === stable(effectiveBody(actual, defaults));
}

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
      && note.offsetUtf16 === binding.offsetUtf16 && stable(note.paragraphs) === stable(binding.paragraphs)
      && !require('../io/documentMedia.js').documentMedia(note.body).assets.length);
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
    const body = binding && equivalentBody(binding.richBody, note.body, exportMap.exportTypography)
      ? binding.richBody : note.body;
    // sceneContent is already the validated canonical leaf projection. Parsing
    // it again as a legacy scene file would trim empty edge paragraphs or treat
    // literal envelope-looking text as metadata and change anchor coordinates.
    need(Buffer.byteLength(sceneContent, 'utf8') <= 8 * model.LIMITS.bytes
      && model.boundary(sceneContent, offsetUtf16), 'NOTE_RETURN_POINT_INVALID');
    const manuscript = model.validateManuscriptPayload({ schemaVersion: 1, kind: note.kind, body,
      reference: { sceneId: block.sceneId, offsetUtf16, sourceTextSha256: model.sha(sceneContent), affinity: 'after' } });
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
    old.deleted = true; old.deletedAtUtc = now; old.updatedAtUtc = now;
  }
  if (!changes.length) return { unchanged: true, replay: false, document, operationId, changes };
  model.validateManuscriptDocument(after, projectId);
  need(receipts.length < 128, 'NOTE_RETURN_RECEIPT_BUDGET');
  after.wordNoteReturnReceipts = [...receipts, { operationId, inputDigest, resultDigest: graphDigest(after),
    roundId, artifactSha256, changes }];
  need(Buffer.byteLength(JSON.stringify(after)) <= 4 * model.LIMITS.bytes, 'NOTE_RETURN_STATE_BUDGET');
  return { replay: false, document: after, operationId, changes };
}
// An authenticated caller supplies local canonical identities. Word contributes
// only validated source occurrences and bodies, never note IDs or write paths.
function bindUnchangedPendingNotes({ document, projectId, sceneId, baseline, exportMap,
  beforeDoc, returnedDoc, returnedNotes, unionReferences }) {
  const pending = require('./word-pending-text-revisions-v1.cjs');
  model.validateManuscriptDocument(document, projectId);
  need(baseline?.projectId === projectId && baseline.policy === 'MANUSCRIPT_NOTES_EXPLICIT_RETURN_V1'
    && baseline.stateDigest === notesStateDigest(document), 'PENDING_NOTE_BASELINE_CONFLICT');
  const active = document.notes.filter(n => !n.deleted && n.manuscript?.reference.sceneId === sceneId);
  need(active.length > 0 && active.length <= 256 && baseline.sourceBindings?.length === active.length
    && returnedNotes?.length === active.length && unionReferences?.length === active.length, 'PENDING_NOTE_GRAPH_MISMATCH');
  const text = doc => pending.paragraphs(pending.normalizeNode(doc)).map(p => (p.content || []).map(n => n.type === 'hardBreak' ? '\n' : n.text).join('')).join('\n');
  const old = pending.readLedger(beforeDoc), incoming = pending.readLedger(returnedDoc);
  const original = value => value ? pending.materialize(pending.exportNoteBasis(value), 'original') : null;
  need(text(original(old) || beforeDoc) === text(original(incoming) || returnedDoc), 'PENDING_NOTE_ORIGINAL_TEXT_MISMATCH');
  const originalLeaves = pending.paragraphs(pending.normalizeNode(original(old) || beforeDoc));
  const currentText = text(beforeDoc), beforePoints = [], returnedPoints = [], used = new Set();
  for (const note of active) {
    const binding = baseline.sourceBindings.find(b => b.noteId === note.id);
    need(binding?.richBody && binding.sceneId === sceneId && binding.kind === note.manuscript.kind
      && equivalentBody(binding.richBody, note.manuscript.body, exportMap.exportTypography), 'PENDING_NOTE_BASELINE_MISMATCH');
    const matches = returnedNotes.map((n, i) => ({ n, i })).filter(({ n }) => n.transportIdentity === binding.transportIdentity);
    need(binding.transportIdentity && matches.length === 1 && !used.has(matches[0].i), 'PENDING_NOTE_IDENTITY_MISMATCH');
    const { n, i } = matches[0]; used.add(i);
    need(n.kind === binding.kind && equivalentBody(note.manuscript.body, n.body, exportMap.exportTypography), 'PENDING_NOTE_BODY_CHANGED');
    const ref = note.manuscript.reference;
    need(ref.sourceTextSha256 === model.sha(currentText), 'PENDING_NOTE_REFERENCE_STALE');
    let beforePoint = old?.noteSourcePoints?.find(p => p.noteId === note.id);
    if (old) need(beforePoint, 'PENDING_NOTE_BINDINGS_REQUIRED');
    if (!beforePoint) {
      let offset = ref.offsetUtf16, paragraphIndex = 0;
      const leaves = pending.paragraphs(pending.normalizeNode(beforeDoc));
      for (; paragraphIndex < leaves.length; paragraphIndex++) {
        const length = (leaves[paragraphIndex].content || []).map(n => n.type === 'hardBreak' ? '\n' : n.text).join('').length;
        if (offset <= length) break;
        offset -= length + 1;
      }
      beforePoint = { noteId: note.id, paragraphIndex, offsetUtf16: offset };
    }
    const oldProjection = old ? pending.projectSourcePoint(pending.exportNoteBasis(old), pending.projectSourcePoint(old, beforePoint, 'export'), 'original') : beforePoint;
    need(n.paragraphIndex === oldProjection.paragraphIndex && n.offsetUtf16 === oldProjection.offsetUtf16
      && originalLeaves[n.paragraphIndex], 'PENDING_NOTE_REFERENCE_MOVED');
    const union = unionReferences[i];
    need(union && union.kind === n.kind && union.paragraphIndex === n.paragraphIndex, 'PENDING_NOTE_UNION_BINDING');
    const returnedPoint = { noteId: note.id, paragraphIndex: union.paragraphIndex, offsetUtf16: union.offsetUtf16 };
    const projected = incoming ? pending.projectSourcePoint(incoming, returnedPoint, 'original') : returnedPoint;
    need(projected.paragraphIndex === n.paragraphIndex && projected.offsetUtf16 === n.offsetUtf16, 'PENDING_NOTE_UNION_BINDING');
    beforePoints.push(beforePoint); returnedPoints.push(returnedPoint);
  }
  return { beforeDoc: pending.bindNoteSourcePoints(beforeDoc, beforePoints),
    returnedDoc: pending.bindNoteSourcePoints(returnedDoc, returnedPoints) };
}
module.exports = { planNoteReturnDelta, bindUnchangedPendingNotes, equivalentBody };

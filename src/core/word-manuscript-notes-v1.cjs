'use strict';

const { sha256UpdateCompatible } = require('./browser-safe-hash.cjs');
const { parseObservablePayload, deriveVisibleTextFromDocument } = require('./document-content-envelope-v1.cjs');
// Binary admission is native-only. Loading the read-only body grammar in the
// sandbox renderer must not initialize Buffer, crypto or zlib.
const documentMedia = (...args) => require('../io/documentMedia.js').documentMedia(...args);
const validateImageAttrs = (...args) => require('../io/documentMedia.js').validateImageAttrs(...args);
const { tableParagraphs } = require('../io/documentTables.js');

const MODE = 'MANUSCRIPT_POINT_REBASE_V1';
const richBody = require('./word-rich-body-projection-v1.cjs');
const { LIMITS } = richBody;
const plain = value => value && typeof value === 'object' && !Array.isArray(value);
const clone = value => JSON.parse(JSON.stringify(value));
const sha = value => sha256UpdateCompatible(value);
const fail = code => { throw Object.assign(new Error(code), { code }); };
const need = (ok, code) => { if (!ok) fail(code); };
const keys = (value, allowed) => plain(value) && Object.keys(value).every(key => allowed.includes(key));
const boundary = (text, offset) => Number.isSafeInteger(offset) && offset >= 0 && offset <= text.length
  && !(offset > 0 && offset < text.length && /[\uD800-\uDBFF]/u.test(text[offset - 1]) && /[\uDC00-\uDFFF]/u.test(text[offset]));

function validateNoteBody(body) {
  return richBody.validateRichBody(body, { validateImage: validateImageAttrs, validateMedia: documentMedia });
}
const validateNoteBodyProjection = richBody.validateNoteBodyProjection;

// Read-only comparison projection for the pinned main editor schema. Never
// erase non-null domain state or use this projection as a persistence writer.
function noteSceneSchemaDefaults(value) {
  if (!plain(value) || value.type !== 'doc' || (value.attrs !== undefined && !plain(value.attrs))) return value;
  return { ...value, attrs: { wordPendingRevisions: null, wordUserBookmarks: null, ...(value.attrs || {}) } };
}

// The same leaf occurrence order used by DOCX export. Empty and repeated
// paragraphs retain their position; table/container boundaries add no text.
function sceneParagraphs(doc) {
  require('./word-list-numbering-v1.cjs').resolve(doc);
  const paragraphs = []; let lists = 0;
  const append = block => {
    need(['paragraph', 'heading', 'codeBlock'].includes(block?.type), 'NOTE_SCENE_STRUCTURE_UNSUPPORTED');
    need((block.content || []).every(node => ['text', 'hardBreak', 'image'].includes(node.type)), 'NOTE_SCENE_INLINE_UNSUPPORTED');
    need(paragraphs.length < 50000, 'NOTE_SCENE_BUDGET');
    paragraphs.push(deriveVisibleTextFromDocument({ type: 'doc', content: [block] }));
  };
  const visit = (block, depth = 0) => {
    if (['paragraph', 'heading', 'codeBlock'].includes(block?.type)) { append(block); return; }
    if (block?.type === 'table') {
      for (const leaf of tableParagraphs(block, 'note-scene')) append(leaf.node);
      return;
    }
    need(['bulletList', 'orderedList'].includes(block?.type) && depth <= 8 && ++lists <= 2048
      && Array.isArray(block.content) && block.content.length > 0, 'NOTE_SCENE_STRUCTURE_UNSUPPORTED');
    need(!block.attrs || keys(block.attrs, block.type === 'orderedList' ? ['start', 'type', 'wordListId', 'wordListStart', 'wordNumbering'] : []), 'NOTE_SCENE_STRUCTURE_UNSUPPORTED');
    const start = block.attrs?.start ?? 1;
    need(Number.isSafeInteger(start) && start >= 0 && start + block.content.length - 1 <= 2147483647
      && (block.attrs?.type == null || ['1', 'I', 'i', 'A', 'a'].includes(block.attrs.type)), 'NOTE_SCENE_STRUCTURE_UNSUPPORTED');
    for (const item of block.content) {
      need(item?.type === 'listItem' && Array.isArray(item.content) && ['paragraph', 'heading'].includes(item.content[0]?.type)
        && item.content.slice(1).every(child => ['bulletList', 'orderedList'].includes(child?.type)), 'NOTE_SCENE_STRUCTURE_UNSUPPORTED');
      append(item.content[0]); for (const child of item.content.slice(1)) visit(child, depth + 1);
    }
  };
  doc.content.forEach(block => visit(block));
  documentMedia(doc);
  return paragraphs;
}
function sceneText(content) {
  return observeNoteScene(content).text;
}
function observeNoteScene(content) {
  need(typeof content === 'string' && Buffer.byteLength(content) <= 32 * LIMITS.bytes, 'NOTE_SCENE_BUDGET');
  const parsed = parseObservablePayload(content);
  need(!parsed.issue, 'NOTE_SCENE_INVALID');
  if (!parsed.doc) return { doc: parsed.doc, text: parsed.text };
  need(parsed.doc.type === 'doc' && Array.isArray(parsed.doc.content), 'NOTE_SCENE_INVALID');
  return { doc: parsed.doc, text: sceneParagraphs(parsed.doc).join('\n') };
}

function validateManuscriptPayload(value) {
  need(keys(value, ['schemaVersion', 'kind', 'reference', 'body']) && value.schemaVersion === 1
    && ['footnote', 'endnote'].includes(value.kind), 'NOTE_MANUSCRIPT_SCHEMA');
  const ref = value.reference;
  need(keys(ref, ['sceneId', 'offsetUtf16', 'sourceTextSha256', 'affinity'])
    && typeof ref.sceneId === 'string' && ref.sceneId.length > 0 && ref.sceneId.length <= 1024
    && !ref.sceneId.startsWith('/') && !ref.sceneId.split('/').some(x => x === '..' || x === '.' || !x)
    && !/[\\\u0000-\u001F]/u.test(ref.sceneId)
    && Number.isSafeInteger(ref.offsetUtf16) && ref.offsetUtf16 >= 0
    && /^[a-f0-9]{64}$/u.test(ref.sourceTextSha256) && ref.affinity === 'after', 'NOTE_REFERENCE_INVALID');
  validateNoteBody(value.body);
  return clone(value);
}

function bindManuscriptPayload({ kind, body, sceneId, offsetUtf16, sceneContent }) {
  const text = sceneText(sceneContent);
  need(boundary(text, offsetUtf16), 'NOTE_REFERENCE_BOUNDARY');
  return validateManuscriptPayload({ schemaVersion: 1, kind, body,
    reference: { sceneId, offsetUtf16, sourceTextSha256: sha(text), affinity: 'after' } });
}

function validateManuscriptDocument(document, projectId) {
  need(plain(document) && document.schemaVersion === 1 && document.projectId === projectId
    && Array.isArray(document.notes), 'NOTE_DOCUMENT_INVALID');
  const ids = new Set(); let count = 0, bytes = 0;
  for (const note of document.notes) {
    if (note?.manuscript === undefined) continue;
    need(typeof note.id === 'string' && /^[A-Za-z0-9._:-]{1,128}$/u.test(note.id)
      && !ids.has(note.id), 'NOTE_ID_INVALID');
    ids.add(note.id);
    validateManuscriptPayload(note.manuscript);
    need(note.scope === 'manuscript' && note.body === validateNoteBody(note.manuscript.body).text,
      'NOTE_MANUSCRIPT_PROJECTION_MISMATCH');
    if (!note.deleted) { count++; bytes += Buffer.byteLength(JSON.stringify(note.manuscript.body)); }
  }
  need(count <= LIMITS.notes && bytes <= LIMITS.bytes, 'NOTE_DOCUMENT_BUDGET');
  return document;
}

function mapPoint(oldText, nextText, point) {
  need(boundary(oldText, point), 'NOTE_REFERENCE_BOUNDARY');
  if (oldText === nextText) return point;
  const n = oldText.length, m = nextText.length;
  let prefix = 0, suffix = 0;
  while (prefix < Math.min(n, m) && oldText[prefix] === nextText[prefix]) prefix++;
  while (suffix < Math.min(n, m) && oldText[n - suffix - 1] === nextText[m - suffix - 1]) suffix++;
  // Every equally minimal contiguous edit must map the point identically.
  // Repeated text cannot silently move a reference to a different occurrence.
  const earliest = Math.min(prefix, Math.min(n, m) - suffix);
  const latest = Math.max(n - suffix, prefix + Math.max(0, n - m));
  // At the right edge of every possible edit, an after-affinity point has
  // the same destination as the surviving suffix, including an empty suffix.
  const result = point < earliest ? point : point >= latest ? point + m - n
    : earliest === latest && point === earliest && m >= n ? point + m - n : null;
  need(result !== null && boundary(nextText, result), 'NOTE_REFERENCE_EDIT_CONFLICT');
  return result;
}

// Replay evidence is supplied only by Main's authenticated private admission.
// The complete canonical result, including history, is regenerated here; a
// provider receipt or a matching Current projection never proves a transition.
function validatePendingNoteTransition({ beforeText, projectId, sceneId, beforeContent, afterContent, pendingNoteReturnProofJson }) {
  const pending = require('./word-pending-text-revisions-v1.cjs');
  const envelope = require('./document-content-envelope-v1.cjs');
  const beforeDoc = parseObservablePayload(beforeContent).doc, afterDoc = parseObservablePayload(afterContent).doc;
  const equal = (a, b) => JSON.stringify(envelope.canonicalizeDocumentJson(a)) === JSON.stringify(envelope.canonicalizeDocumentJson(b));
  if (pendingNoteReturnProofJson !== undefined) {
    need(typeof pendingNoteReturnProofJson === 'string' && Buffer.byteLength(pendingNoteReturnProofJson) <= 32 * LIMITS.bytes, 'NOTE_RETURN_PROOF_BUDGET');
    const proof = JSON.parse(pendingNoteReturnProofJson);
    const required = ['schemaVersion', 'projectId', 'sceneId', 'baseline', 'exportMap', 'returnedDoc', 'returnedNotes', 'unionReferences', 'receipt'];
    need(keys(proof, [...required, 'paragraphBindings']) && required.every(key => Object.hasOwn(proof, key))
      && proof.schemaVersion === 1 && proof.projectId === projectId && proof.sceneId === sceneId && typeof beforeText === 'string', 'NOTE_RETURN_PROOF_SHAPE');
    const bound = require('./word-note-return-delta-v1.cjs').bindUnchangedPendingNotes({ document: JSON.parse(beforeText), projectId, sceneId,
      baseline: proof.baseline, exportMap: proof.exportMap, beforeDoc, returnedDoc: proof.returnedDoc,
      returnedNotes: proof.returnedNotes, unionReferences: proof.unionReferences });
    const replacement = pending.replaceFromReturn(bound.beforeDoc, bound.returnedDoc, proof.receipt, proof.paragraphBindings);
    need(equal(replacement.doc, afterDoc), 'NOTE_RETURN_PROOF_RESULT');
    return;
  }
  const beforeLedger = pending.readLedger(beforeDoc), afterLedger = pending.readLedger(afterDoc);
  if (!beforeLedger && !afterLedger) return; // Existing untracked anchor law.
  if (equal(beforeDoc, afterDoc)) return;
  need(beforeLedger && afterLedger, 'NOTE_PENDING_TRANSITION_PROOF_REQUIRED');
  const changed = beforeLedger.revisions.find((revision, index) => afterLedger.revisions[index]?.state !== revision.state);
  const decisions = ['undo', 'redo', 'acceptAll', 'rejectAll'].map(action => ({ action }));
  if (changed) decisions.push({ action: 'accept', revisionId: changed.id }, { action: 'reject', revisionId: changed.id });
  for (const input of decisions) {
    let result;
    try { result = pending.decide(beforeDoc, input); } catch { continue; }
    if (equal(result.doc, afterDoc)) return;
  }
  need(false, 'NOTE_PENDING_TRANSITION_PROOF_REQUIRED');
}

function planManuscriptNoteAnchorSave({ beforeText, projectId, sceneId, beforeContent, afterContent, recordingProofJson, pendingNoteReturnProofJson, includeUnchanged = false }) {
  if (recordingProofJson !== undefined) require('./word-pending-recording-comments-v1.cjs')
    .validateRecordingSaveProof({ beforeContent, afterContent, recordingProofJson });
  if (beforeText === null) return null;
  need(typeof beforeText === 'string' && Buffer.byteLength(beforeText) <= 4 * LIMITS.bytes, 'NOTE_DOCUMENT_BUDGET');
  const document = validateManuscriptDocument(JSON.parse(beforeText), projectId);
  const active = document.notes.filter(n => n.manuscript?.reference.sceneId === sceneId && !n.deleted);
  if (!active.length) return null;
  const beforeObservation = observeNoteScene(beforeContent), afterObservation = observeNoteScene(afterContent);
  const before = beforeObservation.text, after = afterObservation.text;
  const pending = require('./word-pending-text-revisions-v1.cjs');
  let { beforeLedger, afterLedger, beforePoints, afterPoints } = pending.readNoteProjectionPair(beforeObservation.doc, afterObservation.doc);
  if (beforePoints || afterPoints) {
    // First admission includes the exact previous baseline frame. It is checked
    // against the saved canonical reference below, not trusted as an offset hint.
    if (!beforePoints && afterLedger?.roundUndo?.length) {
      const frame = pending.lastRoundFrame(afterLedger);
      const frameDoc = pending.bindLedger({ ...frame, roundUndo: [], roundRedo: [], returnReceipts: [] });
      need(sceneText(require('./document-content-envelope-v1.cjs').composeObservablePayload({ doc: frameDoc })) === before, 'NOTE_PENDING_BASELINE_MISMATCH');
      beforePoints = pending.noteProjection(frameDoc);
    }
    need(beforePoints?.length === active.length && afterPoints?.length === active.length
      && active.every(n => beforePoints.some(p => p.noteId === n.id) && afterPoints.some(p => p.noteId === n.id)), 'NOTE_PENDING_IDENTITY_MISMATCH');
  } else need(!beforeLedger && !afterLedger, 'NOTE_PENDING_BINDINGS_REQUIRED');
  let referenceChanged = false;
  for (const note of active) {
    const ref = note.manuscript.reference;
    need(ref.sourceTextSha256 === sha(before) && boundary(before, ref.offsetUtf16), 'NOTE_REFERENCE_STALE');
    if (beforePoints) need(beforePoints.find(p => p.noteId === note.id).globalOffsetUtf16 === ref.offsetUtf16, 'NOTE_PENDING_REFERENCE_STALE');
    const nextOffset = afterPoints ? afterPoints.find(p => p.noteId === note.id).globalOffsetUtf16 : mapPoint(before, after, ref.offsetUtf16);
    referenceChanged ||= nextOffset !== ref.offsetUtf16;
    ref.offsetUtf16 = nextOffset;
    ref.sourceTextSha256 = sha(after);
  }
  if (pendingNoteReturnProofJson !== undefined) validatePendingNoteTransition({ beforeText, projectId, sceneId, beforeContent, afterContent, pendingNoteReturnProofJson });
  if (before === after && !referenceChanged && recordingProofJson === undefined && pendingNoteReturnProofJson === undefined && !includeUnchanged) return null;
  return { mode: MODE, beforeText, afterText: before === after && !referenceChanged ? beforeText : `${JSON.stringify(document, null, 2)}\n`,
    ...(recordingProofJson !== undefined ? { recordingProofJson } : {}),
    ...(pendingNoteReturnProofJson !== undefined ? { pendingNoteReturnProofJson } : {}) };
}

function validateNoteCohort(value, { projectId, sceneId, beforeContent, afterContent }) {
  if (value == null) return null;
  need(keys(value, ['mode', 'beforeText', 'afterText', ...(value.mode === MODE ? ['recordingProofJson', 'pendingNoteReturnProofJson'] : [])])
    && [MODE, 'MANUSCRIPT_IMPORT_V1', 'MANUSCRIPT_BODY_UPDATE_V1'].includes(value.mode)
    && (value.beforeText === null || typeof value.beforeText === 'string')
    && typeof value.afterText === 'string'
    && [value.beforeText || '', value.afterText].every(s => Buffer.byteLength(s) <= 4 * LIMITS.bytes), 'NOTE_COHORT_SHAPE');
  if (value.mode === MODE) {
    need(!(Object.hasOwn(value, 'recordingProofJson') && Object.hasOwn(value, 'pendingNoteReturnProofJson')), 'NOTE_COHORT_PROOF_AMBIGUOUS');
    need(['recordingProofJson', 'pendingNoteReturnProofJson'].every(key => !Object.hasOwn(value, key) || typeof value[key] === 'string'), 'NOTE_COHORT_PROOF_SHAPE');
    if (!Object.hasOwn(value, 'recordingProofJson')) validatePendingNoteTransition({ beforeText: value.beforeText, projectId, sceneId, beforeContent, afterContent,
      ...(Object.hasOwn(value, 'pendingNoteReturnProofJson') ? { pendingNoteReturnProofJson: value.pendingNoteReturnProofJson } : {}) });
    const expected = planManuscriptNoteAnchorSave({ beforeText: value.beforeText, projectId, sceneId, beforeContent, afterContent, includeUnchanged: true,
      ...(Object.hasOwn(value, 'recordingProofJson') ? { recordingProofJson: value.recordingProofJson } : {}),
      ...(Object.hasOwn(value, 'pendingNoteReturnProofJson') ? { pendingNoteReturnProofJson: value.pendingNoteReturnProofJson } : {}) });
    need(expected && expected.afterText === value.afterText, 'NOTE_COHORT_REBASE');
    return expected;
  }
  if (value.mode === 'MANUSCRIPT_BODY_UPDATE_V1') {
    need(typeof beforeContent === 'string' && beforeContent === afterContent && value.beforeText !== null, 'NOTE_COHORT_UNCHANGED_SCENE');
    const before = validateManuscriptDocument(JSON.parse(value.beforeText), projectId);
    const after = validateManuscriptDocument(JSON.parse(value.afterText), projectId);
    const byId = new Map(before.notes.map(note => [note.id, note]));
    need(byId.size === before.notes.length && new Set(after.notes.map(note => note.id)).size === after.notes.length, 'NOTE_COHORT_DUPLICATE_ID');
    need(after.notes.length >= before.notes.length, 'NOTE_COHORT_OLDER_STATE');
    for (const old of before.notes) {
      const next = after.notes.find(note => note.id === old.id);
      need(next && (old.manuscript || JSON.stringify(next) === JSON.stringify(old)), 'NOTE_COHORT_PRIVATE_STATE');
    }
    const text = sceneText(afterContent);
    for (const note of after.notes) {
      const old = byId.get(note.id);
      if (JSON.stringify(old) === JSON.stringify(note)) continue;
      need(note.manuscript && (!old || old.manuscript), 'NOTE_COHORT_MANUSCRIPT_ONLY');
      const ref = note.manuscript.reference;
      if (ref.sceneId !== sceneId) need(old && JSON.stringify(old.manuscript.reference) === JSON.stringify(ref), 'NOTE_COHORT_OTHER_SCENE_REFERENCE');
      else need(ref.sourceTextSha256 === sha(text) && boundary(text, ref.offsetUtf16), 'NOTE_COHORT_SOURCE');
    }
    // Only existing return receipts and clock metadata may change at the root.
    const root = doc => Object.fromEntries(Object.entries(doc).filter(([key]) => !['notes', 'wordNoteReturnReceipts', 'updatedAtUtc'].includes(key)));
    need(JSON.stringify(root(before)) === JSON.stringify(root(after)), 'NOTE_COHORT_ROOT_STATE');
    return clone(value);
  }
  need(beforeContent === null, 'NOTE_COHORT_CREATE_ONLY');
  const before = value.beforeText === null ? { schemaVersion: 1, projectId, notes: [] } : JSON.parse(value.beforeText);
  const after = JSON.parse(value.afterText);
  validateManuscriptDocument(before, projectId); validateManuscriptDocument(after, projectId);
  need(after.notes.length > before.notes.length
    && JSON.stringify(after.notes.slice(0, before.notes.length)) === JSON.stringify(before.notes)
    && JSON.stringify({ ...after, notes: before.notes }) === JSON.stringify(before), 'NOTE_COHORT_OLDER_STATE');
  const text = sceneText(afterContent), ids = new Set(before.notes.map(n => n.id));
  for (const note of after.notes.slice(before.notes.length)) {
    need(note.manuscript && !note.deleted && !ids.has(note.id), 'NOTE_COHORT_NEW_NOTE');
    ids.add(note.id);
    const ref = note.manuscript.reference;
    need(ref.sceneId === sceneId && ref.sourceTextSha256 === sha(text)
      && boundary(text, ref.offsetUtf16), 'NOTE_COHORT_SOURCE');
  }
  return clone(value);
}

function materializeImportedNotes({ candidates, sceneContent, projectId, sceneId, importOperationId, beforeText, createdAt = '1970-01-01T00:00:00.000Z' }) {
  need(Array.isArray(candidates) && candidates.length > 0 && candidates.length <= LIMITS.notes, 'NOTE_IMPORT_COUNT');
  const text = sceneText(sceneContent), parsed = parseObservablePayload(sceneContent);
  need(!require('./word-pending-text-revisions-v1.cjs').readLedger(parsed.doc), 'NOTE_PENDING_IMPORT_REQUIRES_AUTHENTICATED_RETURN');
  const paragraphs = parsed.doc ? sceneParagraphs(parsed.doc) : parsed.text.split('\n');
  const before = beforeText === null ? { schemaVersion: 1, projectId, notes: [] } : JSON.parse(beforeText);
  validateManuscriptDocument(before, projectId);
  const after = clone(before), ids = new Set(before.notes.map(n => n.id));
  const imported = candidates.map((candidate, index) => {
    need(keys(candidate, ['kind', 'paragraphIndex', 'offsetUtf16', 'body'])
      && Number.isSafeInteger(candidate.paragraphIndex) && candidate.paragraphIndex >= 0
      && typeof paragraphs[candidate.paragraphIndex] === 'string'
      && boundary(paragraphs[candidate.paragraphIndex], candidate.offsetUtf16), 'NOTE_IMPORT_POINT');
    const id = `note-${sha(`${projectId}\u0000${importOperationId}\u0000${index}`).slice(0, 32)}`;
    need(!ids.has(id), 'NOTE_IMPORT_ID_COLLISION'); ids.add(id);
    const offsetUtf16 = paragraphs.slice(0, candidate.paragraphIndex).reduce((sum, p) => sum + p.length + 1, 0) + candidate.offsetUtf16;
    const manuscript = bindManuscriptPayload({ ...candidate, sceneId, offsetUtf16, sceneContent });
    need(manuscript.reference.sourceTextSha256 === sha(text), 'NOTE_IMPORT_SOURCE');
    // Provider IDs and clock fields never supply canonical identity or authority.
    return { schemaVersion: 1, id, scope: 'manuscript', title: '',
      body: validateNoteBody(candidate.body).text, manuscript, deleted: false,
      createdAtUtc: createdAt, updatedAtUtc: createdAt, attachment: { scope: 'manuscript' } };
  });
  after.notes.push(...imported);
  const result = { mode: 'MANUSCRIPT_IMPORT_V1', beforeText, afterText: `${JSON.stringify(after, null, 2)}\n` };
  validateNoteCohort(result, { projectId, sceneId, beforeContent: null, afterContent: sceneContent });
  return { ...result, imported };
}

module.exports = { MODE, LIMITS, sha, boundary, validateNoteBody, validateNoteBodyProjection, sceneText, noteSceneSchemaDefaults,
  validateManuscriptPayload, bindManuscriptPayload, validateManuscriptDocument,
  mapPoint, planManuscriptNoteAnchorSave, validateNoteCohort, materializeImportedNotes };

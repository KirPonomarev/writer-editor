'use strict';

const crypto = require('node:crypto');
const { buildDocxRunContentXml, segmentDocxTextForSerialization } = require('./docxTextXml.js');

const DOCUMENT_NOTES_SCHEMA = 'yalken.rtk.word.document-notes.v1';
const MAX_NOTES = 256;
const MAX_TEXT_BYTES = 1024 * 1024;
const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/';
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const stable = value => Array.isArray(value) ? `[${value.map(stable).join(',')}]`
  : plain(value) ? `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}` : JSON.stringify(value);
const sha = value => crypto.createHash('sha256').update(value, 'utf8').digest('hex');
const demand = (ok, code) => { if (!ok) throw new Error(code); };
const clone = value => JSON.parse(JSON.stringify(value));
const boundary = (text, offset) => Number.isSafeInteger(offset) && offset >= 0 && offset <= text.length
  && !(offset > 0 && offset < text.length && /[\uD800-\uDBFF]/u.test(text[offset - 1]) && /[\uDC00-\uDFFF]/u.test(text[offset]));

function normalizeDocumentNoteSelections(value) {
  if (value === undefined) return [];
  demand(Array.isArray(value) && value.length <= MAX_NOTES, 'DOCX_NOTES_SELECTION_INVALID');
  const seen = new Set();
  return value.map(item => {
    demand(plain(item) && Object.keys(item).sort().join(',') === 'kind,noteId'
      && typeof item.noteId === 'string' && /^[A-Za-z0-9._:-]{1,128}$/u.test(item.noteId)
      && ['footnote', 'endnote'].includes(item.kind) && !seen.has(item.noteId), 'DOCX_NOTES_SELECTION_INVALID');
    seen.add(item.noteId);
    return { noteId: item.noteId, kind: item.kind };
  });
}

function notesStateDigest(document) { return sha(stable(document)); }

function resolveNoteAnchor(note, blocks) {
  demand(['inbox', 'project', 'manuscript', 'scene', 'selection'].includes(note.scope), 'DOCX_NOTE_SCOPE_INVALID');
  let candidates = blocks;
  if (['scene', 'selection'].includes(note.scope)) {
    demand(plain(note.attachment) && typeof note.attachment.sceneId === 'string' && note.attachment.sceneId,
      'DOCX_NOTE_SCENE_REQUIRED');
    candidates = blocks.filter(block => block.sceneId === note.attachment.sceneId);
  }
  demand(candidates.length > 0, 'DOCX_NOTE_SCENE_MISSING');
  if (note.scope !== 'selection') return { block: candidates[0], offsetUtf16: 0 };
  const anchor = note.attachment.anchor;
  demand(plain(anchor) && anchor.kind === 'text-range' && Number.isSafeInteger(anchor.start)
    && Number.isSafeInteger(anchor.end) && anchor.start >= 0 && anchor.end > anchor.start
    && typeof anchor.quoteHash === 'string' && /^[a-f0-9]{64}$/u.test(anchor.quoteHash), 'DOCX_NOTE_ANCHOR_INVALID');
  let start = 0;
  for (const block of candidates) {
    const end = start + block.text.length;
    if (anchor.start >= start && anchor.end <= end) {
      const a = anchor.start - start, b = anchor.end - start;
      demand(boundary(block.text, a) && boundary(block.text, b)
        && sha(block.text.slice(a, b)) === anchor.quoteHash, 'DOCX_NOTE_ANCHOR_STALE');
      return { block, offsetUtf16: b };
    }
    start = end + 1;
  }
  throw new Error('DOCX_NOTE_ANCHOR_UNSUPPORTED_OR_STALE');
}

function buildCanonicalNotesExport(document, selectionsRaw, blocks, projectId) {
  const selections = normalizeDocumentNoteSelections(selectionsRaw);
  if (!selections.length) return null;
  demand(plain(document) && document.schemaVersion === 1 && document.projectId === projectId
    && Array.isArray(document.notes), 'DOCX_NOTES_STATE_INVALID');
  const byId = new Map();
  for (const note of document.notes) {
    demand(plain(note) && typeof note.id === 'string' && !byId.has(note.id), 'DOCX_NOTES_STATE_INVALID');
    byId.set(note.id, note);
  }
  let textBytes = 0;
  const sourceBindings = selections.map(({ noteId, kind }, selectionOrdinal) => {
    const note = byId.get(noteId);
    demand(note && note.deleted !== true && note.tombstone !== true, 'DOCX_NOTE_SELECTED_SOURCE_MISSING');
    demand(typeof note.title === 'string' && note.title.length <= 512
      && typeof note.body === 'string' && note.body.length <= 200000, 'DOCX_NOTE_TEXT_INVALID');
    for (const value of [note.title, note.body]) {
      segmentDocxTextForSerialization(value);
      demand(!value.includes('\r') && !value.includes('\f'), 'DOCX_NOTE_TEXT_NON_CANONICAL');
      textBytes += Buffer.byteLength(value, 'utf8');
    }
    demand(textBytes <= MAX_TEXT_BYTES, 'DOCX_NOTES_TEXT_BUDGET');
    const { block, offsetUtf16 } = resolveNoteAnchor(note, blocks);
    return { noteId, kind, selectionOrdinal, scope: note.scope, attachment: clone(note.attachment || {}),
      sceneId: block.sceneId, blockId: block.blockId, documentParagraphIndex: block.documentParagraphIndex,
      offsetUtf16, blockTextSha256: sha(block.text), paragraphs: [note.title, note.body] };
  }).sort((a, b) => a.documentParagraphIndex - b.documentParagraphIndex || a.offsetUtf16 - b.offsetUtf16
    || a.selectionOrdinal - b.selectionOrdinal);
  const ordinalByKind = { footnote: 0, endnote: 0 };
  const notes = sourceBindings.map(binding => ({ kind: binding.kind, paragraphIndex: binding.documentParagraphIndex,
    offsetUtf16: binding.offsetUtf16, paragraphs: [...binding.paragraphs] }));
  sourceBindings.forEach(binding => { binding.nativeId = String(++ordinalByKind[binding.kind]); });
  return { schemaVersion: DOCUMENT_NOTES_SCHEMA, projectId, selections, stateDigest: notesStateDigest(document),
    sourceBindings, notes, protectedDigest: `sha256:${sha(stable({ schemaVersion: DOCUMENT_NOTES_SCHEMA, notes }))}`,
    policy: 'EXPLICIT_SELECTION_NATIVE_NOTES_SIGNED_READ_ONLY_RETURN_V1' };
}

function noteMarkersForBlock(projection, block) {
  const markers = new Map();
  for (const binding of projection?.sourceBindings || []) {
    if (binding.blockId !== block.blockId) continue;
    demand(binding.sceneId === block.sceneId && binding.blockTextSha256 === sha(block.text)
      && boundary(block.text, binding.offsetUtf16), 'DOCX_NOTE_ANCHOR_STALE');
    const style = binding.kind === 'footnote' ? 'FootnoteReference' : 'EndnoteReference';
    const xml = `<w:r><w:rPr><w:rStyle w:val="${style}"/></w:rPr><w:${binding.kind}Reference w:id="${binding.nativeId}"/></w:r>`;
    markers.set(binding.offsetUtf16, (markers.get(binding.offsetUtf16) || '') + xml);
  }
  return markers;
}

function notePackageParts(projection) {
  if (!projection) return { entries: [], contentTypes: '', relationships: '' };
  demand(projection.schemaVersion === DOCUMENT_NOTES_SCHEMA, 'DOCX_NOTES_EXPORT_SCHEMA_INVALID');
  const entries = [], types = [], relationships = [];
  for (const kind of ['footnote', 'endnote']) {
    const bindings = projection.sourceBindings.filter(binding => binding.kind === kind);
    if (!bindings.length) continue;
    const style = kind === 'footnote' ? 'Footnote' : 'Endnote';
    const separator = `<w:${kind} w:type="separator" w:id="-1"><w:p><w:r><w:separator/></w:r></w:p></w:${kind}>`
      + `<w:${kind} w:type="continuationSeparator" w:id="0"><w:p><w:r><w:continuationSeparator/></w:r></w:p></w:${kind}>`;
    const body = bindings.map(binding => `<w:${kind} w:id="${binding.nativeId}">${binding.paragraphs.map((value, index) =>
      `<w:p><w:pPr><w:pStyle w:val="${style}Text"/></w:pPr>${index === 0 ? `<w:r><w:rPr><w:rStyle w:val="${style}Reference"/></w:rPr><w:${kind}Ref/></w:r>` : ''}<w:r>${buildDocxRunContentXml(value)}</w:r></w:p>`).join('')}</w:${kind}>`).join('');
    const name = `${kind}s.xml`;
    entries.push({ name: `word/${name}`, data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:${kind}s xmlns:w="${W_NS}">${separator}${body}</w:${kind}s>` });
    types.push(`<Override PartName="/word/${name}" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.${kind}s+xml"/>`);
    relationships.push(`<Relationship Id="rIdYalken${style}s" Type="${REL_NS}${kind}s" Target="${name}"/>`);
  }
  return { entries, contentTypes: types.join(''), relationships: relationships.join('') };
}

function validateDocumentNotesReturn({ expected, returned, signedDigest } = {}) {
  if (!expected) return { ok: !returned?.notes?.length && !signedDigest, applicable: false,
    status: 'DOCUMENT_NOTES_NOT_APPLICABLE', mismatches: returned?.notes?.length || signedDigest ? ['unexpectedNotes'] : [] };
  const mismatches = [];
  if (returned?.schemaVersion !== DOCUMENT_NOTES_SCHEMA) mismatches.push('schemaVersion');
  if (stable(returned?.notes || []) !== stable(expected.notes)) mismatches.push('notes');
  if (returned?.protectedDigest !== expected.protectedDigest) mismatches.push('protectedDigest');
  if (signedDigest !== expected.protectedDigest) mismatches.push('signedDigest');
  return { ok: mismatches.length === 0, applicable: true,
    status: mismatches.length ? 'DOCUMENT_NOTES_MISMATCH' : 'VERIFIED_PROTECTED_DOCUMENT_NOTES', mismatches,
    ...(mismatches.length ? {} : { proof: { schemaVersion: DOCUMENT_NOTES_SCHEMA,
      authority: 'ADVISORY_ONLY_NO_CANONICAL_NOTE_WRITE', protectedDigest: expected.protectedDigest,
      notes: clone(expected.notes), sourceBindings: clone(expected.sourceBindings), policy: expected.policy,
      lossLedger: clone(returned.lossLedger || {}) } }) };
}

module.exports = { DOCUMENT_NOTES_SCHEMA, normalizeDocumentNoteSelections, notesStateDigest,
  buildCanonicalNotesExport, noteMarkersForBlock, notePackageParts, validateDocumentNotesReturn };

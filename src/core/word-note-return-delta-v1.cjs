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
      if (node.type === 'hardBreak' && node.marks===undefined && node.attrs===undefined) { runs.push({ type: 'hardBreak' }); continue; }
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
      if(node.type==='hardBreak')runs.push({type:'hardBreak',...(node.attrs?{attrs:node.attrs}:{}),marks});
      else if (previous?.type === 'text' && stable(previous.marks) === stable(marks)) previous.text += node.text;
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
  require('./word-review-typography-v1.cjs').validate(exportMap?.exportTypography,{allowUndefined:true});
  need(typeof roundId === 'string' && roundId.length > 0 && roundId.length <= 256
    && /^(?:sha256:)?[a-f0-9]{64}$/u.test(artifactSha256), 'NOTE_RETURN_IDENTITY_INVALID');
  need(baseline?.projectId === projectId && baseline.policy === 'MANUSCRIPT_NOTES_EXPLICIT_RETURN_V1'
    && Array.isArray(baseline.sourceBindings) && baseline.sourceBindings.length <= 256,
  'NOTE_RETURN_BASELINE_REQUIRED');
  model.validateManuscriptDocument(document, projectId);
  need(Array.isArray(returnedNotes) && returnedNotes.length <= 256 && Array.isArray(returnedParagraphs)
    && Array.isArray(exportMap?.scenes), 'NOTE_RETURN_GRAPH_INCOMPLETE');
  const emission = singleSceneNoteEmission(baseline, exportMap) || cleanBookNoteEmission(document, baseline, exportMap);
  if (emission && exportMap.scenes.length === 1 && notesStateDigest(document) === baseline.stateDigest) validateSingleSceneNoteRoster(document, baseline, exportMap);
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
    if (emission) need(stable(note.breakProjection) === stable(cleanNoteBreakProjection(note.body, emission, binding?.richBody)), 'NOTE_RETURN_BREAK_CHANGED');
    const body = binding && (emission
      ? equivalentCompleteCleanBody(binding.richBody, note.body, exportMap.exportTypography, emission)
      : equivalentBody(binding.richBody, note.body, exportMap.exportTypography)) ? binding.richBody : note.body;
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
function bindPendingNotePoints({ document, projectId, sceneId, baseline, exportMap,
  beforeDoc, returnedDoc, returnedNotes, unionReferences, closedBookEmission }, bodyLaw) {
  require('./word-review-typography-v1.cjs').validate(exportMap?.exportTypography,{allowUndefined:true});
  const pending = require('./word-pending-text-revisions-v1.cjs');
  model.validateManuscriptDocument(document, projectId);
  need(baseline?.projectId === projectId && baseline.policy === 'MANUSCRIPT_NOTES_EXPLICIT_RETURN_V1'
    && baseline.stateDigest === notesStateDigest(document), 'PENDING_NOTE_BASELINE_CONFLICT');
  if (closedBookEmission !== undefined) {
    need(exportMap?.scenes?.length > 1 && stable(baseline.breakEmission) === stable(closedBookEmission), 'PENDING_NOTE_BREAK_BASELINE_REQUIRED');
    requireBookNoteEmission(closedBookEmission);
  }
  if (closedBookEmission === undefined) {
    closedBookEmission = singleSceneNoteEmission(baseline, exportMap, sceneId);
    if (closedBookEmission) validateSingleSceneNoteRoster(document, baseline, exportMap);
  }
  const active = document.notes.filter(n => !n.deleted && n.manuscript?.reference.sceneId === sceneId);
  need(active.length > 0 && active.length <= 256 && baseline.sourceBindings?.length === active.length
    && returnedNotes?.length === active.length && unionReferences?.length === active.length, 'PENDING_NOTE_GRAPH_MISMATCH');
  const text = doc => pending.paragraphs(pending.normalizeNode(doc)).map(p => (p.content || []).map(n => n.type === 'hardBreak' ? '\n' : n.text).join('')).join('\n');
  const old = pending.readLedger(beforeDoc), incoming = pending.readLedger(returnedDoc);
  const original = value => value ? pending.materialize(pending.exportNoteBasis(value), 'original') : null;
  need(text(original(old) || beforeDoc) === text(original(incoming) || returnedDoc), 'PENDING_NOTE_ORIGINAL_TEXT_MISMATCH');
  const originalLeaves = pending.paragraphs(pending.normalizeNode(original(old) || beforeDoc));
  const currentText = text(beforeDoc), beforePoints = [], returnedPoints = [], used = new Set();
  if (closedBookEmission?.schemaVersion === 2 && exportMap.scenes.length === 1) {
    const nativeIds = new Set();
    for (const ref of unionReferences) {
      const id = ref?.kind + ':' + ref?.nativeId;
      need(/^[1-9][0-9]*$/u.test(ref?.nativeId) && !nativeIds.has(id), 'PENDING_NOTE_NATIVE_ROSTER_MISMATCH');
      nativeIds.add(id);
    }
  }
  for (const note of active) {
    const binding = baseline.sourceBindings.find(b => b.noteId === note.id);
    need(binding?.richBody && binding.sceneId === sceneId && binding.kind === note.manuscript.kind
      && equivalentBody(binding.richBody, note.manuscript.body, exportMap.exportTypography), 'PENDING_NOTE_BASELINE_MISMATCH');
    const matches = returnedNotes.map((n, i) => ({ n, i })).filter(({ n }) => n.transportIdentity === binding.transportIdentity);
    need(binding.transportIdentity && matches.length === 1 && !used.has(matches[0].i), 'PENDING_NOTE_IDENTITY_MISMATCH');
    const { n, i } = matches[0]; used.add(i);
    if (closedBookEmission !== undefined) {
      need(stable(binding.richBody) === stable(model.validateNoteBody(note.manuscript.body).body), 'PENDING_NOTE_BASELINE_MISMATCH');
      if (!bodyLaw && exportMap.scenes.length > 1) need(stable(n.breakProjection) === stable(localBookNoteBreakProjection(note.manuscript.body, closedBookEmission)), 'PENDING_NOTE_BREAK_CHANGED');
    }
    need(n.kind === binding.kind && (bodyLaw ? bodyLaw(note,n,baseline,exportMap) : closedBookEmission !== undefined
      ? equivalentCompleteBody(note.manuscript.body, n.body, exportMap.exportTypography, closedBookEmission)
      : equivalentBody(note.manuscript.body, n.body, exportMap.exportTypography)), 'PENDING_NOTE_BODY_CHANGED');
    if (!bodyLaw && closedBookEmission !== undefined && exportMap.scenes.length === 1) need(stable(n.breakProjection) === stable(localBookNoteBreakProjection(note.manuscript.body, closedBookEmission)), 'PENDING_NOTE_BREAK_CHANGED');
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
    if (closedBookEmission?.schemaVersion === 2 && exportMap.scenes.length === 1) {
      const exported = old ? pending.projectSourcePoint(old, beforePoint, 'current') : beforePoint;
      need(binding.documentParagraphIndex === exported.paragraphIndex && binding.offsetUtf16 === exported.offsetUtf16, 'PENDING_NOTE_BASELINE_MISMATCH');
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
function bindUnchangedPendingNotes(input) {return bindPendingNotePoints(input);}
// Complete typed body law for the composed book lane. Legacy emission owns
// 12pt; v2 owns the exact finite note-style profile below. Source-authored
// properties, paragraph meaning and every effective break must still match.
// Fresh single-scene rounds select v2 only from their closed local baseline.
const BOOK_NOTE_EMISSION_V2 = { schemaVersion: 2, fontSize: '12pt', fontFamily: 'Times New Roman',
  wordLanguage: { val: 'en-US', eastAsia: 'en-US', bidi: 'en-US' },
  paragraphSpacing: { before: 0, after: 0, line: 240, lineRule: 'auto' } };
const BOOK_NOTE_EMISSION_V3 = { ...BOOK_NOTE_EMISSION_V2, schemaVersion: 3, bodyParagraphDefaults: {
  wordParagraphSpacing: { before: 0, after: 0, line: 240, lineRule: 'auto' },
  wordParagraphMarkLanguage: { val: 'en-US', eastAsia: 'en-US', bidi: 'en-US' } } };
function requireBookNoteEmission(emission) {
  need(stable(emission) === stable({ schemaVersion: 1, fontSize: '12pt' })
    || stable(emission) === stable(BOOK_NOTE_EMISSION_V2)
    || stable(emission) === stable(BOOK_NOTE_EMISSION_V3), 'PENDING_NOTE_BREAK_BASELINE_REQUIRED');
  return [2, 3].includes(emission.schemaVersion);
}
// A profile is source evidence, not a caller capability. Unknown/partial
// single-scene profiles cannot select the legacy comparison by falling back.
// Fresh clean books use only the closed LOCAL V2 law. Legacy V1/absence
// remain literal; pending V3 retains its separate complete occurrence proof.
function cleanBookNoteEmission(document, baseline, exportMap) {
  if(exportMap.scenes.length<=1||!Object.hasOwn(baseline,'breakEmission'))return undefined;
  requireBookNoteEmission(baseline.breakEmission);
  if(baseline.breakEmission.schemaVersion!==2)return undefined;
  const scenes=exportMap.scenes,sceneIds=new Set(),blocks=new Map(),nativeIds=new Set(),ids=new Set();
  need(scenes.length<=512,'NOTE_RETURN_EXPORT_MAP_INVALID');
  let ordinal=0;
  for(const scene of scenes) {
    need(scene&&typeof scene==='object'&&!Array.isArray(scene)
      &&typeof scene.sceneId==='string'&&scene.sceneId&&!sceneIds.has(scene.sceneId)
      &&/^(?:sha256:)?[a-f0-9]{64}$/u.test(scene.rawSha256)&&Array.isArray(scene.blocks)&&scene.blocks.length,'NOTE_RETURN_EXPORT_MAP_INVALID');
    sceneIds.add(scene.sceneId);
    for(const block of scene.blocks) {
      need(block&&typeof block==='object'&&!Array.isArray(block)&&Array.isArray(block.formatIr?.runs)
        &&block.formatIr.runs.every(run=>run&&typeof run.text==='string'),'NOTE_RETURN_EXPORT_MAP_INVALID');
      const text=block.formatIr.runs.map(run=>run.text).join('');
      need(typeof block.blockId==='string'&&block.blockId&&!blocks.has(block.blockId)&&typeof text==='string'
        &&block.documentParagraphIndex===ordinal++&&block.canonicalTextSha256===`sha256:${model.sha(text)}`,'NOTE_RETURN_EXPORT_MAP_INVALID');
      blocks.set(block.blockId,{...block,sceneId:scene.sceneId,text});
    }
  }
  const fresh=notesStateDigest(document)===baseline.stateDigest;
  const active=document.notes.filter(note=>!note.deleted&&sceneIds.has(note.manuscript?.reference.sceneId));
  need(baseline.sourceBindings.every(binding=>binding&&typeof binding==='object'&&!Array.isArray(binding)
    &&typeof binding.noteId==='string'&&binding.noteId),'PENDING_NOTE_BASELINE_MISMATCH');
  const rich=baseline.sourceBindings.filter(binding=>binding.richBody);
  if(fresh)need(active.length===rich.length&&active.every(note=>rich.some(binding=>binding.noteId===note.id)),'PENDING_NOTE_BASELINE_MISMATCH');
  for(const binding of baseline.sourceBindings) {
    const block=blocks.get(binding.blockId),native=binding.kind+':'+binding.nativeId;
    need(block&&binding.sceneId===block.sceneId&&binding.documentParagraphIndex===block.documentParagraphIndex
      &&binding.blockTextSha256===model.sha(block.text)&&model.boundary(block.text,binding.offsetUtf16)
      &&!ids.has(binding.noteId)&&['footnote','endnote'].includes(binding.kind)&&/^[1-9][0-9]*$/u.test(binding.nativeId)&&!nativeIds.has(native),
    'PENDING_NOTE_BASELINE_MISMATCH');ids.add(binding.noteId);nativeIds.add(native);
    if(!binding.richBody)continue;
    need(binding.transportIdentity===`_YALKEN_NOTE_${model.sha(baseline.projectId+'\n'+binding.noteId).slice(0,24)}`
      &&stable(binding.paragraphs)===stable(model.validateNoteBody(binding.richBody).paragraphs.map(({paragraph})=>(paragraph.content||[]).map(n=>n.type==='hardBreak'?'\n':n.type==='image'?'':n.text).join(''))),
    'PENDING_NOTE_BASELINE_MISMATCH');
    if(fresh) {
      const note=active.find(note=>note.id===binding.noteId),owned=[...blocks.values()].filter(row=>row.sceneId===binding.sceneId);
      const index=owned.findIndex(row=>row.blockId===binding.blockId),text=owned.map(row=>row.text).join('\n');
      need(note&&note.manuscript.kind===binding.kind&&stable(binding.richBody)===stable(model.validateNoteBody(note.manuscript.body).body)
        &&note.manuscript.reference.sourceTextSha256===model.sha(text)
        &&note.manuscript.reference.offsetUtf16===owned.slice(0,index).reduce((size,row)=>size+row.text.length+1,0)+binding.offsetUtf16,
      'PENDING_NOTE_BASELINE_MISMATCH');
    }
  }
  need(stable(baseline.notes)===stable(baseline.sourceBindings.map(b=>({kind:b.kind,paragraphIndex:b.documentParagraphIndex,offsetUtf16:b.offsetUtf16,paragraphs:b.paragraphs})))
    &&baseline.protectedDigest===`sha256:${model.sha(stable({schemaVersion:baseline.schemaVersion,notes:baseline.notes}))}`,'PENDING_NOTE_BASELINE_MISMATCH');
  return baseline.breakEmission;
}
function singleSceneNoteEmission(baseline, exportMap, sceneId) {
  if (!Object.hasOwn(baseline, 'breakEmission')) return undefined;
  if (exportMap?.scenes?.length !== 1) return undefined;
  need(exportMap?.scenes?.length === 1 && typeof exportMap.scenes[0].sceneId === 'string'
    && (!sceneId || exportMap.scenes[0].sceneId === sceneId)
    && stable(baseline.breakEmission) === stable(BOOK_NOTE_EMISSION_V2)
    && Array.isArray(baseline.sourceBindings) && baseline.sourceBindings.every(b => b.sceneId === exportMap.scenes[0].sceneId),
  'PENDING_NOTE_BREAK_BASELINE_REQUIRED');
  const ids = new Set(), nativeIds = new Set();
  for (const binding of baseline.sourceBindings) {
    const block = exportMap.scenes[0].blocks?.find(b => b.blockId === binding.blockId);
    const nativeId = binding.kind + ':' + binding.nativeId;
    need(block && block.documentParagraphIndex === binding.documentParagraphIndex
      && model.sha((block.formatIr?.runs || []).map(r => r.text).join('')) === binding.blockTextSha256
      && !ids.has(binding.noteId) && /^[1-9][0-9]*$/u.test(binding.nativeId) && !nativeIds.has(nativeId)
      && (!binding.richBody || stable(binding.paragraphs) === stable(model.validateNoteBody(binding.richBody).paragraphs.map(({paragraph}) =>
        (paragraph.content || []).map(n => n.type === 'hardBreak' ? '\n' : n.text).join(''))) && binding.transportIdentity === `_YALKEN_NOTE_${model.sha(baseline.projectId + '\n' + binding.noteId).slice(0,24)}`),
    'PENDING_NOTE_BASELINE_MISMATCH');
    ids.add(binding.noteId); nativeIds.add(nativeId);
  }
  need(stable(baseline.notes) === stable(baseline.sourceBindings.map(b => ({kind:b.kind,paragraphIndex:b.documentParagraphIndex,
    offsetUtf16:b.offsetUtf16,paragraphs:b.paragraphs})))
    && baseline.protectedDigest === `sha256:${model.sha(stable({schemaVersion:baseline.schemaVersion,notes:baseline.notes}))}`,
  'PENDING_NOTE_BASELINE_MISMATCH');
  return baseline.breakEmission;
}
function validateSingleSceneNoteRoster(document, baseline, exportMap) {
  const active = document.notes.filter(n => !n.deleted && n.manuscript?.reference.sceneId === exportMap.scenes[0].sceneId);
  const bindings = baseline.sourceBindings.filter(b => b.richBody);
  need(active.length === bindings.length && active.every(note => bindings.some(b => b.noteId === note.id
    && b.kind === note.manuscript.kind && stable(b.richBody) === stable(model.validateNoteBody(note.manuscript.body).body))),
  'PENDING_NOTE_BASELINE_MISMATCH');
}
function completeBodyMeaning(body, defaults, emission, source = false) {
  const pinned = [2, 3].includes(emission?.schemaVersion);
  if (emission) requireBookNoteEmission(emission);
  const rows = model.validateNoteBody(body).paragraphs;
  return rows.map(({ paragraph, list, table }) => {
    const content = [];
    for (const node of paragraph.content || []) {
      const value = clone(node);
      if (value.type === 'text' || value.type==='hardBreak') {
        const marks = (value.marks || []).map(clone);
        let style = marks.find(mark => mark.type === 'textStyle');
        if (source && value.type === 'hardBreak' && emission?.schemaVersion === 1) {
          if (!style) { style = { type: 'textStyle', attrs: {} }; marks.push(style); }
          style.attrs = { fontSize: emission.fontSize, ...style.attrs };
        }
        if (defaults?.fontSize) {
          if (!style) { style = { type: 'textStyle', attrs: {} }; marks.push(style); }
          style.attrs = { fontSize: defaults.fontSize, ...style.attrs };
        }
        if (pinned && source) {
          if (!style) { style = { type: 'textStyle', attrs: {} }; marks.push(style); }
          style.attrs = { fontFamily: emission.fontFamily, fontSize: emission.fontSize, ...style.attrs,
            wordLanguage: { ...emission.wordLanguage, ...style.attrs.wordLanguage } };
        }
        marks.sort((a, b) => a.type.localeCompare(b.type));
        value.marks = marks;
        const previous = content.at(-1);
        if (value.type==='text' && previous?.type === 'text' && stable(previous.marks) === stable(marks)) { previous.text += value.text; continue; }
      }
      content.push(value);
    }
    const attrs = { textAlign: 'left', ...paragraph.attrs };
    if (pinned) {
      // The reader already resolves inherited values. Only absent effective
      // before/after spacing denotes zero; inherited nonzero stays observable.
      attrs.wordParagraphSpacing = { ...(source ? emission.paragraphSpacing : { before: 0, after: 0 }), ...attrs.wordParagraphSpacing };
      if (source) attrs.wordParagraphMarkLanguage = { ...emission.wordLanguage, ...attrs.wordParagraphMarkLanguage };
    }
    return { paragraph: { type: paragraph.type, attrs, content }, list, ...(table ? { table } : {}) };
  });
}
function equivalentCompleteCleanBody(expected, actual, defaults, emission) {
  const sourceRows = model.validateNoteBody(expected).paragraphs, actualRows = model.validateNoteBody(actual).paragraphs;
  if (!compareTableParagraphTopology(actualRows, sourceRows.map(({ table }) => ({ formatIr: { table } }))).ok) return false;
  const source = completeBodyMeaning(expected, defaults, emission, true), returned = completeBodyMeaning(actual, defaults, emission);
  // Only the existing strict table oracle can authorize its legacy auto-fit
  // representation. Every effective paragraph, run, list and media still compares.
  returned.forEach((row, i) => { if (row.table) row.table = source[i].table; });
  return stable(source) === stable(returned);
}
function equivalentCompleteBody(expected, actual, defaults, emission) {
  return stable(completeBodyMeaning(expected, defaults, emission, true)) === stable(completeBodyMeaning(actual, defaults, emission));
}

// Independently reconstruct the closed LOCAL note emission, never the returned
// parser's defaults. A type-only hardBreak inherits only the local declared
// legacy 12pt or v2 note style. Paragraph-mark language does not propagate
// into note runs in this emitter.
function localBookNoteBreakProjection(body, emission) {
  const pinned = requireBookNoteEmission(emission);
  const rows=model.validateNoteBody(body).paragraphs,breaks=[];
  rows.forEach(({paragraph},paragraphIndex)=>{
    let offset=0;
    for(const node of paragraph.content||[]) {
      if(node.type==='image')continue;
      const text=node.type==='hardBreak'?'\n':node.text;
      const marks=node.type==='text'||node.type==='hardBreak'?(node.marks||[]):[],style=marks.find(mark=>mark.type==='textStyle')?.attrs||{};
      const enabled=marks.filter(mark=>['bold','italic','underline','strike'].includes(mark.type)).map(mark=>mark.type).sort();
      const size=style.fontSize||emission.fontSize,format={marks:enabled,boldCs:enabled.includes('bold'),italicCs:enabled.includes('italic'),forceCs:false,rtl:false,
        fontSize:size,fontSizeCs:size,...(style.fontFamily||pinned?{fontSlots:Object.fromEntries(['ascii','hAnsi','eastAsia','cs'].map(slot=>[slot,style.fontFamily||emission.fontFamily]))}:{}),
        ...(style.color?{color:style.color.toLowerCase()}:{}),...(pinned?{wordLanguage:{...emission.wordLanguage,...style.wordLanguage}}:style.wordLanguage?{wordLanguage:clone(style.wordLanguage)}:{}),
        ...(marks.some(mark=>mark.type==='highlight')?{highlight:marks.find(mark=>mark.type==='highlight').attrs.color.toLowerCase()}:{}),
        ...(marks.some(mark=>mark.type==='link')?{href:marks.find(mark=>mark.type==='link').attrs.href}: {})};
      for(let at=text.indexOf('\n');at!==-1;at=text.indexOf('\n',at+1))breaks.push({paragraphIndex,offsetUtf16:offset+at,kind:node.attrs?.wordBreakType||'line',format:clone(format)});
      offset+=text.length;
    }
  });
  return {schemaVersion:1,paragraphCount:rows.length,textSha256:model.sha(rows.map(({paragraph})=>(paragraph.content||[]).map(node=>node.type==='hardBreak'?'\n':node.type==='image'?'':node.text).join('')).join('\n')),breaks};
}

// Clean note edits may shift, add or remove break occurrences. Their effective
// run recipe comes from canonical authored breaks or the closed local emitter,
// never the same returned marks that the observed projection describes.
function cleanNoteBreakProjection(body, emission, canonicalBody) {
  const incoming = localBookNoteBreakProjection(body, emission);
  const authored = canonicalBody ? localBookNoteBreakProjection(canonicalBody, emission).breaks : [];
  const fresh = localBookNoteBreakProjection({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'hardBreak' }] }] }, emission).breaks[0];
  return { ...incoming, breaks: incoming.breaks.map((point, index) => ({ ...point,
    kind: authored[index]?.kind || fresh.kind, format: clone(authored[index]?.format || fresh.format) })) };
}

// Full signed-map occurrence bijection precedes any scene-local binding. The
// two arrays retain parser occurrence order, including colocated references.
function bindBookPendingNotes({ document, projectId, baseline, exportMap, scenes, returnedNotes, returnedReferences, unionReferences }, bodyLaw) {
  require('./word-review-typography-v1.cjs').validate(exportMap?.exportTypography,{allowUndefined:true});
  const pending = require('./word-pending-text-revisions-v1.cjs');
  model.validateManuscriptDocument(document, projectId);
  need(Array.isArray(scenes) && scenes.length === exportMap?.scenes?.length
    && scenes.length > 0 && scenes.length <= 512, 'PENDING_NOTE_BOOK_MAP_INVALID');
  const ids = new Set(scenes.map(scene => scene.sceneId));
  need(ids.size === scenes.length && scenes.every((scene, i) => scene.sceneId === exportMap.scenes[i].sceneId), 'PENDING_NOTE_BOOK_MAP_INVALID');
  const active = document.notes.filter(note => !note.deleted && ids.has(note.manuscript?.reference.sceneId));
  need(baseline?.projectId === projectId && baseline.policy === 'MANUSCRIPT_NOTES_EXPLICIT_RETURN_V1'
    && baseline.stateDigest === notesStateDigest(document), 'PENDING_NOTE_BASELINE_CONFLICT');
  if(scenes.length===1) {
    need(singleSceneNoteEmission(baseline,exportMap,scenes[0].sceneId),'PENDING_NOTE_BREAK_BASELINE_REQUIRED');
    validateSingleSceneNoteRoster(document,baseline,exportMap);
  }
  need(active.length > 0 && active.length <= 256 && baseline.sourceBindings?.length === active.length
    && returnedNotes?.length === active.length && returnedReferences?.length === active.length
    && unionReferences?.length === active.length, 'PENDING_NOTE_GRAPH_MISMATCH');
  const blocks = exportMap.scenes.flatMap(scene => scene.blocks.map((block, local) => ({ sceneId: scene.sceneId, local, global: block.documentParagraphIndex })));
  need(blocks.every((block, i) => block.global === i), 'PENDING_NOTE_BOOK_MAP_INVALID');
  const identities = new Set(), used = new Set(), nativeIds = new Set(), returnedIds = new Set();
  returnedNotes.forEach((note,index)=>{
    const original=returnedReferences[index],union=unionReferences[index],id=original?.kind+':'+original?.nativeId;
    need(original && union && /^(?:[1-9][0-9]*)$/u.test(original.nativeId)
      && original.kind===note.kind && original.paragraphIndex===note.paragraphIndex && original.offsetUtf16===note.offsetUtf16
      && union.nativeId===original.nativeId && union.kind===original.kind && !returnedIds.has(id), 'PENDING_NOTE_NATIVE_ROSTER_MISMATCH');
    returnedIds.add(id);
  });
  for (const binding of baseline.sourceBindings) {
    const note = active.find(note => note.id === binding.noteId);
    need(note && binding.sceneId === note.manuscript.reference.sceneId && binding.kind === note.manuscript.kind
      && binding.richBody && stable(binding.richBody) === stable(model.validateNoteBody(note.manuscript.body).body)
      && /^_YALKEN_NOTE_[a-f0-9]{24}$/u.test(binding.transportIdentity) && !identities.has(binding.transportIdentity), 'PENDING_NOTE_BASELINE_MISMATCH');
    identities.add(binding.transportIdentity);
    const owner = scenes.findIndex(scene => scene.sceneId === binding.sceneId), rows = pending.paragraphs(pending.normalizeNode(scenes[owner].document));
    const texts = rows.map(row => (row.content || []).map(node => node.type === 'hardBreak' ? '\n' : node.text).join(''));
    let offset = note.manuscript.reference.offsetUtf16, local = 0;
    for (; local < texts.length && offset > texts[local].length; local++) offset -= texts[local].length + 1;
    const block = exportMap.scenes[owner].blocks[local];
    need(block && note.manuscript.reference.sourceTextSha256 === model.sha(texts.join('\n'))
      && binding.documentParagraphIndex === block.documentParagraphIndex && binding.blockId === block.blockId
      && binding.offsetUtf16 === offset && binding.blockTextSha256 === model.sha(texts[local])
      && /^(?:[1-9][0-9]*)$/u.test(binding.nativeId) && !nativeIds.has(binding.kind + ':' + binding.nativeId), 'PENDING_NOTE_BASELINE_MISMATCH');
    nativeIds.add(binding.kind + ':' + binding.nativeId);
    const matches = returnedNotes.map((note, index) => ({ note, index })).filter(item => item.note.transportIdentity === binding.transportIdentity);
    need(matches.length === 1 && !used.has(matches[0].index), 'PENDING_NOTE_IDENTITY_MISMATCH');
    const { note: returned, index } = matches[0]; used.add(index);
    if(!bodyLaw)need(stable(returned.breakProjection)===stable(localBookNoteBreakProjection(note.manuscript.body,baseline.breakEmission)), 'PENDING_NOTE_BREAK_CHANGED');
    need(returned.kind === binding.kind && (bodyLaw?bodyLaw(note,returned,baseline,exportMap):equivalentCompleteBody(binding.richBody, returned.body, exportMap.exportTypography, baseline.breakEmission)), 'PENDING_NOTE_BODY_CHANGED');
    need(blocks[returned.paragraphIndex]?.sceneId === binding.sceneId
      && unionReferences[index]?.kind === returned.kind
      && unionReferences[index]?.paragraphIndex === returned.paragraphIndex, 'PENDING_NOTE_UNION_BINDING');
  }
  need(used.size === returnedNotes.length, 'PENDING_NOTE_GRAPH_MISMATCH');
  requireBookNoteEmission(baseline.breakEmission);
  const bodyEmission = baseline.breakEmission.schemaVersion === 3
    ? { bodyParagraphEmission: clone(BOOK_NOTE_EMISSION_V3.bodyParagraphDefaults) } : {};
  const bound=scenes.map((scene, i) => {
    const owned = baseline.sourceBindings.filter(binding => binding.sceneId === scene.sceneId);
    if (!owned.length) return { sceneId: scene.sceneId, beforeDoc: scene.document, returnedDoc: scene.returnedDocument, ...bodyEmission };
    const indices = returnedNotes.map((note, index) => ({ note, index })).filter(item => blocks[item.note.paragraphIndex]?.sceneId === scene.sceneId);
    const local = note => ({ ...note, paragraphIndex: blocks[note.paragraphIndex].local });
    const bound = bindPendingNotePoints({ document, projectId, sceneId: scene.sceneId,
      baseline: { ...baseline, sourceBindings: owned }, exportMap, beforeDoc: scene.document, returnedDoc: scene.returnedDocument,
      ...(scenes.length>1&&[1, 2, 3].includes(baseline.breakEmission?.schemaVersion) ? { closedBookEmission: baseline.breakEmission } : {}),
      returnedNotes: indices.map(item => local(item.note)), unionReferences: indices.map(item => local(unionReferences[item.index])) },bodyLaw);
    return { sceneId: scene.sceneId, ...bound, ...bodyEmission };
  });
  const ordered=baseline.sourceBindings.map((binding,index)=>{
    const scene=bound.find(scene=>scene.sceneId===binding.sceneId),point=pending.noteProjection(scene.beforeDoc,'export').find(point=>point.noteId===binding.noteId);
    const mapped=exportMap.scenes.find(scene=>scene.sceneId===binding.sceneId).blocks[point.paragraphIndex];
    return {identity:binding.transportIdentity,paragraphIndex:mapped.documentParagraphIndex,offsetUtf16:point.offsetUtf16,index};
  }).sort((a,b)=>a.paragraphIndex-b.paragraphIndex||a.offsetUtf16-b.offsetUtf16||a.index-b.index);
  need(returnedNotes.every((note,index)=>note.transportIdentity===ordered[index].identity),'PENDING_NOTE_NATIVE_ROSTER_MISMATCH');
  return bound;
}
function bindUnchangedBookPendingNotes(input) {return bindBookPendingNotes(input);}
function changedBodyLaw(_note,returned,baseline) {
  model.validateNoteBody(returned.body);
  need(stable(returned.breakProjection)===stable(localBookNoteBreakProjection(returned.body,baseline.breakEmission)),'PENDING_NOTE_BREAK_CHANGED');
  return true;
}
// New typed atomic book proof uses the same complete identity/occurrence law.
// This is an explicit body transition, never an "unchanged" body comparison
// or a caller-selected bypass of the clean manuscript/Original check.
function bindChangedBookPendingNotes(input) {return bindBookPendingNotes(input,changedBodyLaw);}
function planChangedBookNoteBodies({document,projectId,baseline,exportMap,returnedNotes,scenes,roundId,artifactSha256,now}) {
  model.validateManuscriptDocument(document,projectId);
  need(notesStateDigest(document)===baseline.stateDigest&&typeof now==='string'&&Number.isFinite(Date.parse(now)),'NOTE_RETURN_BASELINE_CONFLICT');
  const after=clone(document),changes=[];
  for(const binding of baseline.sourceBindings) {
    const note=after.notes.find(n=>n.id===binding.noteId),returned=returnedNotes.find(n=>n.transportIdentity===binding.transportIdentity);
    need(note?.manuscript&&!note.deleted&&returned,'NOTE_RETURN_TARGET_INVALID');
    const scene=scenes.find(s=>s.sceneId===binding.sceneId),doc=require('./document-content-envelope-v1.cjs').parseObservablePayload(scene.content).doc;
    const pending=require('./word-pending-text-revisions-v1.cjs'),point=pending.noteProjection(doc)?.find(p=>p.noteId===note.id);
    const body=equivalentCompleteBody(binding.richBody,returned.body,exportMap.exportTypography,baseline.breakEmission)?binding.richBody:model.validateNoteBody(returned.body).body;
    const reference=point?{...note.manuscript.reference,offsetUtf16:point.globalOffsetUtf16,sourceTextSha256:model.sha(model.sceneText(scene.content))}:note.manuscript.reference;
    const manuscript=model.validateManuscriptPayload({...note.manuscript,body,reference});
    if(stable(note.manuscript)!==stable(manuscript)) {
      changes.push({noteId:note.id,operation:'update',before:clone(note.manuscript),after:manuscript});
      note.manuscript=manuscript;note.body=model.validateNoteBody(body).text;note.updatedAtUtc=now;
    }
  }
  if(!changes.length)return {document,changes,afterText:JSON.stringify(document)};
  need(typeof roundId==='string'&&roundId.length>0&&/^(?:sha256:)?[a-f0-9]{64}$/u.test(artifactSha256),'NOTE_RETURN_IDENTITY_INVALID');
  const operationId='word-note-return-'+model.sha(roundId+'\n'+artifactSha256),receipts=document.wordNoteReturnReceipts||[];
  need(Array.isArray(receipts)&&receipts.length<128&&!receipts.some(r=>r.operationId===operationId),'NOTE_RETURN_REPLAY_CONFLICT');
  after.wordNoteReturnReceipts=[...receipts,{operationId,inputDigest:model.sha(stable({projectId,roundId,artifactSha256,baseline:baseline.stateDigest,returnedNotes})),
    resultDigest:notesStateDigest({...after,wordNoteReturnReceipts:[]}),roundId,artifactSha256,changes}];
  model.validateManuscriptDocument(after,projectId);need(Buffer.byteLength(JSON.stringify(after))<=4*model.LIMITS.bytes,'NOTE_RETURN_STATE_BUDGET');
  return {document:after,changes,afterText:JSON.stringify(after)};
}
module.exports = { planNoteReturnDelta, bindUnchangedPendingNotes, equivalentBody, equivalentCompleteBody, bindUnchangedBookPendingNotes,
  bindChangedBookPendingNotes,planChangedBookNoteBodies };

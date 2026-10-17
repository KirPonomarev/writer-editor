import { sha256Hex, canonicalSerialize } from './browser-safe-hash.mjs';
import { upsertProjectTreeIdentityNode } from './projectTreeIdentity.mjs';
import envelope from './document-content-envelope-v1.cjs';
import pending from './word-pending-text-revisions-v1.cjs';
import notes from './word-manuscript-notes-v1.cjs';
import anchors from './word-comment-anchor-save-v1.cjs';
import stories from './word-stories-v1.cjs';
import { materializeGenericComments } from '../io/revisionBridge/genericWordComments.mjs';
import validation from '../utils/docxImportSafeCreate.js';

export const DOCX_NEW_PROJECT_LIMITS = Object.freeze({ scenes: 512, bytes: 32 * 1024 * 1024 });
const need = (ok, code) => { if (!ok) throw Object.assign(Error(code), { code }); };
const bytes = text => new TextEncoder().encode(text).length;
const json = value => JSON.stringify(value, null, 2) + '\n';
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
function textProfile(node) {
  need(node && ['doc', 'paragraph', 'heading', 'text', 'hardBreak'].includes(node.type), 'DOCX_NEW_PROJECT_CONTENT_UNSUPPORTED');
  for (const child of node.content || []) textProfile(child);
}
function profile(doc) {
  textProfile(doc);
  const ledger = pending.readLedger(doc);
  if (ledger) {
    textProfile(ledger.source);
    need(ledger.revisions.every(r => ['insert', 'delete'].includes(r.operation) && !pending.isStructural(r)
      && !r.moveName && r.state === 'pending')
      && [ledger.undo, ledger.redo, ledger.roundUndo || [], ledger.roundRedo || [], ledger.returnReceipts || []].every(rows => rows.length === 0),
    'DOCX_NEW_PROJECT_REVISIONS_UNSUPPORTED');
  }
  need(!stories.read(doc), 'DOCX_NEW_PROJECT_STORIES_UNSUPPORTED');
  return ledger;
}

// Pure fresh initialization. Filenames and identities are local, never provider authority.
export function* prepareDocxNewProjectSteps({ plan, projectId, projectName, operationId, createdAtUtc }) {
  need(typeof projectId === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u.test(projectId), 'DOCX_NEW_PROJECT_ID');
  need(typeof projectName === 'string' && projectName.trim() === projectName && projectName.length > 0
    && projectName.isWellFormed() && bytes(projectName) <= 512 && !/[\u0000-\u001f\u007f]/u.test(projectName), 'DOCX_NEW_PROJECT_NAME');
  need(typeof operationId === 'string' && /^[a-zA-Z0-9:._-]{1,192}$/u.test(operationId), 'DOCX_NEW_PROJECT_OPERATION');
  need(typeof createdAtUtc === 'string' && Number.isFinite(Date.parse(createdAtUtc))
    && new Date(createdAtUtc).toISOString() === createdAtUtc, 'DOCX_NEW_PROJECT_CLOCK');
  const checked = validation.validateDocxImportPreviewPlan(plan);
  need(checked.ok, checked.error?.code || 'DOCX_NEW_PROJECT_PLAN');
  const entries = plan.candidateCreatePlan.entries;
  need(entries.length > 0 && entries.length <= DOCX_NEW_PROJECT_LIMITS.scenes, 'DOCX_NEW_PROJECT_SCENES');
  const files = [], scenes = [];
  let size = 0, treeIdentity = { schemaVersion: 1, nodes: {} }, noteState = null, commentState = null;
  let currentUtf16CodeUnits = 0, originalUtf16CodeUnits = 0, characters = 0, revisionCount = 0, noteCount = 0, commentCount = 0;
  const add = (relativePath, role, content) => {
    const byteLength = bytes(content);
    size += byteLength; need(size <= DOCX_NEW_PROJECT_LIMITS.bytes, 'DOCX_NEW_PROJECT_BYTES');
    files.push({ relativePath, role, content, byteLength, sha256: sha256Hex(content) });
  };
  for (const [index, entry] of entries.entries()) {
    const parsed = envelope.parseObservablePayload(entry.content);
    need(!parsed.issue, 'DOCX_NEW_PROJECT_SCENE');
    const sourceDoc = parsed.doc || envelope.buildParagraphDocumentFromText(parsed.text);
    const ledger = profile(sourceDoc), importOperationId = `${operationId}:${index}`;
    for (const candidate of entry.notes || []) textProfile(candidate.body);
    const content = entry.notes?.length ? notes.prepareImportedNoteScene({ candidates: entry.notes,
      sceneContent: entry.content, projectId, importOperationId }) : entry.content;
    const beforeProjection = pending.projection(sourceDoc);
    let doc = sourceDoc;
    // Without imported notes the content is the exact validated input string.
    // Reparse and verify invariants only when note binding transformed it.
    if (content !== entry.content) {
      const afterParsed = envelope.parseObservablePayload(content);
      need(!afterParsed.issue, 'DOCX_NEW_PROJECT_SCENE');
      doc = afterParsed.doc || envelope.buildParagraphDocumentFromText(afterParsed.text);
      need(canonicalSerialize(beforeProjection) === canonicalSerialize(pending.projection(doc)), 'DOCX_NEW_PROJECT_TEXT_CHANGED');
      if (ledger) {
        const bound = pending.readLedger(doc);
        need(bound && canonicalSerialize(bound.source) === canonicalSerialize(ledger.source)
          && canonicalSerialize(bound.revisions) === canonicalSerialize(ledger.revisions), 'DOCX_NEW_PROJECT_SOURCE_CHANGED');
      }
    }
    const relativePath = `roman/Imported/${String(index + 1).padStart(4, '0')} Imported DOCX.txt`;
    const identity = upsertProjectTreeIdentityNode({ projectId, registry: treeIdentity, bindingKey: `file:${relativePath}`, kind: 'scene' });
    need(identity.ok, 'DOCX_NEW_PROJECT_TREE_IDENTITY'); treeIdentity = identity.value;
    add(relativePath, 'scene', content); scenes.push({ sceneId: relativePath, nodeId: identity.nodeId });
    const current = notes.sceneText(content), original = beforeProjection?.original;
    for (const character of current) characters++;
    characters += index > 0 ? 1 : 0; currentUtf16CodeUnits += current.length + (index > 0 ? 1 : 0);
    originalUtf16CodeUnits += (typeof original === 'string' ? original.length : current.length) + (index > 0 ? 1 : 0);
    revisionCount += ledger?.revisions.length || 0;
    if (entry.notes?.length) {
      noteState = notes.materializeImportedNotes({ candidates: entry.notes, sceneContent: content,
        projectId, sceneId: relativePath, importOperationId, beforeText: noteState, createdAt: createdAtUtc }).afterText;
      noteCount += entry.notes.length;
    }
    if (entry.comments?.length) {
      commentState = materializeGenericComments({ candidates: entry.comments, paragraphs: anchors.paragraphs(content),
        pendingDocument: doc, projectId, sceneId: relativePath, importOperationId, beforeText: commentState }).afterText;
      commentCount += entry.comments.length;
    }
    yield; // Pure checkpoint; the owning adapter chooses whether to yield the event loop.
  }
  if (noteState !== null) add('notes.craftsman.json', 'notes', noteState);
  if (commentState !== null) add('.yalken/word-review/non-text-return-state.v1.json', 'comments', commentState);
  const manifestText = json({ schemaVersion: 1, projectId, projectName, createdAtUtc, treeIdentity, lastCommandId: 1 });
  need(size + bytes(manifestText) <= DOCX_NEW_PROJECT_LIMITS.bytes, 'DOCX_NEW_PROJECT_BYTES');
  const directories = [...new Set(files.flatMap(file => {
    const parts = file.relativePath.split('/'); parts.pop(); return parts.map((_, i) => parts.slice(0, i + 1).join('/'));
  }))].sort((a, b) => a.split('/').length - b.split('/').length || a.localeCompare(b));
  return freeze({ schemaVersion: 'DOCX_NEW_PROJECT_PREPARATION_V1', projectId, projectName, operationId,
    sourceSha256: validation.hashDocxImportPreviewPlanForAdmission(plan), directoryName: `Word-${projectId}`,
    files, directories, scenes, manifestText, manifestSha256: sha256Hex(manifestText),
    summary: { target: 'new-project', sceneCount: scenes.length, characters, currentUtf16CodeUnits,
      originalUtf16CodeUnits, revisionCount, noteCount, commentCount } });
}

// Existing pure/synchronous consumers share the same preparation and validation.
export function prepareDocxNewProject(input) {
  const steps = prepareDocxNewProjectSteps(input);
  let step = steps.next();
  while (!step.done) step = steps.next();
  return step.value;
}

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { atomicWriteFile } from '../markdown/atomicWriteFile.mjs';
import { normalizeCommentProvenance, compareCommentExportReadback } from '../../export/docx/docxReviewPacketComments.js';

export const RTK_ROOT_COMMENT_RETURN_COMMAND_ID = 'cmd.rtk.review.applyRootCommentReturn';
export const RTK_COMMENT_LIFECYCLE_RETURN_COMMAND_ID = 'cmd.rtk.review.applyCommentLifecycleReturn';
export const RTK_NON_TEXT_RETURN_STATE_SCHEMA = 'yalken.rtk.word.non-text-return-state.v1';
export const RTK_NON_TEXT_RETURN_EVENT_SCHEMA = 'yalken.rtk.word.non-text-return-event.v1';

const STATE_RELATIVE_PATH = path.join('.yalken', 'word-review', 'non-text-return-state.v1.json');
const RECOVERY_RELATIVE_PATH = path.join('.yalken', 'recovery', 'non-text-return-state.v1.json');
const ROOT_COMMENT_BODY_LIMIT = 16_384;

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeNonNegativeInteger(value) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) return -1;
  return number;
}

function paragraphIndexFromBlockId(blockId) {
  const match = normalizeString(blockId).match(/^block-(\d+)/u);
  if (!match) return -1;
  const oneBased = normalizeNonNegativeInteger(match[1]);
  return oneBased > 0 ? oneBased - 1 : -1;
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (isPlainObject(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return crypto.createHash('sha256').update(Buffer.from(value, 'utf8')).digest('hex');
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function blocked(code, field, details = {}) {
  return {
    ok: false,
    status: 'blocked',
    code,
    reason: code,
    reasons: [{ code, field, details: isPlainObject(details) ? clone(details) : {} }],
    writerCalled: false,
  };
}

function assertProjectPath(projectRoot, targetPath) {
  const root = path.resolve(projectRoot);
  const target = path.resolve(targetPath);
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
    throw new Error('RTK_NON_TEXT_PORT_PATH_ESCAPE');
  }
  return target;
}

function emptyState(projectId) {
  return {
    schemaVersion: RTK_NON_TEXT_RETURN_STATE_SCHEMA,
    projectId,
    revision: 0,
    threads: [],
    events: [],
  };
}

function validateState(value, projectId) {
  if (!isPlainObject(value) || value.schemaVersion !== RTK_NON_TEXT_RETURN_STATE_SCHEMA) {
    throw new Error('RTK_NON_TEXT_STATE_SCHEMA_INVALID');
  }
  if (normalizeString(value.projectId) !== projectId) throw new Error('RTK_NON_TEXT_STATE_PROJECT_MISMATCH');
  if (!Number.isSafeInteger(value.revision) || value.revision < 0) throw new Error('RTK_NON_TEXT_STATE_REVISION_INVALID');
  if (!Array.isArray(value.threads) || !Array.isArray(value.events)) throw new Error('RTK_NON_TEXT_STATE_COLLECTION_INVALID');
  return clone(value);
}

export function createRtkNonTextReturnFilePort(options = {}) {
  const atomicWriter = typeof options.atomicWriteFile === 'function' ? options.atomicWriteFile : atomicWriteFile;
  return {
    async readCanonical({ projectRoot, projectId }) {
      const statePath = assertProjectPath(projectRoot, path.join(projectRoot, STATE_RELATIVE_PATH));
      try {
        return validateState(JSON.parse(await fs.promises.readFile(statePath, 'utf8')), projectId);
      } catch (error) {
        if (error?.code === 'ENOENT') return emptyState(projectId);
        throw error;
      }
    },
    async writeRecovery({ projectRoot, state }) {
      const recoveryPath = assertProjectPath(projectRoot, path.join(projectRoot, RECOVERY_RELATIVE_PATH));
      await atomicWriter(recoveryPath, `${JSON.stringify(state, null, 2)}\n`, { safetyMode: 'strict' });
      return { recoveryPath, sha256: sha256(stableJson(state)) };
    },
    async writeCanonical({ projectRoot, state }) {
      const statePath = assertProjectPath(projectRoot, path.join(projectRoot, STATE_RELATIVE_PATH));
      await atomicWriter(statePath, `${JSON.stringify(state, null, 2)}\n`, { safetyMode: 'strict' });
      return { statePath, sha256: sha256(stableJson(state)) };
    },
  };
}

function normalizeRootCommentInput(input) {
  const projectId = normalizeString(input.projectId);
  const projectRoot = normalizeString(input.projectRoot);
  const operationId = normalizeString(input.operationId);
  const sceneId = normalizeString(input.sceneId);
  const threadId = normalizeString(input.threadId);
  const commentId = normalizeString(input.commentId) || `${threadId}:root`;
  const body = typeof input.body === 'string' ? input.body : '';
  const selectedText = typeof input.selectedText === 'string' ? input.selectedText : '';
  const sceneText = typeof input.sceneText === 'string' ? input.sceneText : '';
  const anchor = isPlainObject(input.anchor)
    ? {
      sceneId: normalizeString(input.anchor.sceneId),
      blockId: normalizeString(input.anchor.blockId),
      paragraphIndex: normalizeNonNegativeInteger(input.anchor.paragraphIndex),
      authoritySource: normalizeString(input.anchor.authoritySource),
      sourceChangeId: normalizeString(input.anchor.sourceChangeId),
    }
    : { sceneId: '', blockId: '', paragraphIndex: -1, authoritySource: '', sourceChangeId: '' };
  const provenance = normalizeCommentProvenance(input.provenance);
  if (isPlainObject(input.anchor?.canonicalRange)) {
    const range = input.anchor.canonicalRange;
    if (!Number.isSafeInteger(range.sceneParagraphIndex) || range.sceneParagraphIndex < 0
      || !/^[a-f0-9]{64}$/u.test(range.blockTextSha256)
      || !Number.isSafeInteger(range.startUtf16) || range.startUtf16 < 0) {
      throw new Error('RTK_COMMENT_CANONICAL_RANGE_INVALID');
    }
    anchor.canonicalRange = { sceneParagraphIndex: range.sceneParagraphIndex,
      blockTextSha256: range.blockTextSha256, startUtf16: range.startUtf16 };
  }
  return { projectId, projectRoot, operationId, sceneId, threadId, commentId, body, selectedText, sceneText, anchor, provenance };
}

function countOccurrences(text, needle) {
  if (!needle) return 0;
  let count = 0;
  let cursor = 0;
  while (cursor <= text.length) {
    const index = text.indexOf(needle, cursor);
    if (index < 0) break;
    count += 1;
    cursor = index + 1;
  }
  return count;
}

function sceneTextAfterSourceTextChange(sceneText, change) {
  const match = isPlainObject(change?.match) ? change.match : {};
  const expectedText = typeof match.quote === 'string' ? match.quote : '';
  const replacementText = typeof change?.replacementText === 'string' ? change.replacementText : '';
  if (!expectedText || !replacementText) return sceneText;
  if (isPlainObject(match.blockRange)) {
    const range = match.blockRange;
    if (
      Number.isSafeInteger(range.sceneStart)
      && Number.isSafeInteger(range.blockLocalStart)
      && Number.isSafeInteger(range.blockLocalEnd)
    ) {
      const from = range.sceneStart + range.blockLocalStart;
      const to = range.sceneStart + range.blockLocalEnd;
      if (from >= 0 && to >= from && sceneText.slice(from, to) === expectedText) {
        return `${sceneText.slice(0, from)}${replacementText}${sceneText.slice(to)}`;
      }
    }
  }
  const first = sceneText.indexOf(expectedText);
  if (first < 0 || first !== sceneText.lastIndexOf(expectedText)) return sceneText;
  return `${sceneText.slice(0, first)}${replacementText}${sceneText.slice(first + expectedText.length)}`;
}

function textChangeSceneId(change) {
  return normalizeString(change?.targetScope?.id || change?.sceneId);
}

function textChangeBlockId(change) {
  const match = isPlainObject(change?.match) ? change.match : {};
  return normalizeString(change?.blockId || match.blockId);
}

function textChangeParagraphIndex(change) {
  const match = isPlainObject(change?.match) ? change.match : {};
  const index = normalizeNonNegativeInteger(
    change?.paragraphIndex
      ?? change?.documentParagraphIndex
      ?? match.paragraphIndex
      ?? match.documentParagraphIndex
      ?? match.blockRange?.paragraphIndex
      ?? match.blockRange?.documentParagraphIndex,
  );
  return index >= 0 ? index : paragraphIndexFromBlockId(textChangeBlockId(change));
}

function placementRelatedReplacementGroup(placement) {
  const relation = isPlainObject(placement?.relatedReplacementGroup) ? placement.relatedReplacementGroup : {};
  return {
    groupId: normalizeString(placement?.relatedReplacementGroupId || relation.groupId),
    relationMode: normalizeString(placement?.relatedReplacementGroupMode || relation.relationMode),
  };
}

function commentNativeIdentityConsistency(placement) {
  const placementNativeCommentId = normalizeString(placement?.nativeCommentId || placement?.sourceCommentId || placement?.commentId);
  const selectorNativeCommentId = normalizeString(placement?.selector?.id);
  const threadNativeCommentId = normalizeString(placement?.threadSourceCommentId);
  const nativeCommentIds = [placementNativeCommentId, selectorNativeCommentId, threadNativeCommentId].filter(Boolean);
  const nativeCommentId = placementNativeCommentId || threadNativeCommentId || selectorNativeCommentId;
  const nativeCommentConsistent = Boolean(placementNativeCommentId)
    && Boolean(threadNativeCommentId)
    && nativeCommentIds.every((id) => id === nativeCommentId);
  return {
    nativeCommentId,
    ok: nativeCommentConsistent,
    nativeCommentConsistent,
    hasPlacementNativeCommentId: Boolean(placementNativeCommentId),
    hasThreadNativeCommentId: Boolean(threadNativeCommentId),
  };
}

function resolveAuthenticatedCommentSourceTextChange(input = {}) {
  const textChanges = Array.isArray(input.textChanges) ? input.textChanges.filter(isPlainObject) : [];
  const sceneId = normalizeString(input.sceneId);
  const sceneText = typeof input.sceneText === 'string' ? input.sceneText : '';
  const placement = isPlainObject(input.placement) ? input.placement : {};
  const placementAuthority = isPlainObject(input.placementAuthority) ? input.placementAuthority : {};
  const rawSelectedText = typeof placement.quote === 'string' ? placement.quote : '';
  const quoteAlreadyExact = Boolean(rawSelectedText)
    && countOccurrences(sceneText, rawSelectedText) === 1;
  const authorityBlockId = normalizeString(placementAuthority.blockId || placement.blockId);
  const authorityParagraphIndex = normalizeNonNegativeInteger(
    placementAuthority.paragraphIndex
      ?? placementAuthority.documentParagraphIndex
      ?? placement.paragraphIndex
      ?? placement.documentParagraphIndex,
  );
  const nativeIdentity = commentNativeIdentityConsistency(placement);
  if (nativeIdentity.ok !== true) {
    return {
      ok: false,
      code: 'RTK_COMMENT_PRODUCT_RETURN_NATIVE_COMMENT_IDENTITY_INVALID',
      details: {
        sceneId,
        authorityParagraphIndex,
        nativeCommentConsistent: nativeIdentity.nativeCommentConsistent,
        hasPlacementNativeCommentId: nativeIdentity.hasPlacementNativeCommentId,
        hasThreadNativeCommentId: nativeIdentity.hasThreadNativeCommentId,
      },
    };
  }
  if (quoteAlreadyExact) return { ok: true, sourceTextChange: null, sceneTextChanges: 0 };
  const sceneTextChanges = textChanges.filter((change) => textChangeSceneId(change) === sceneId);
  if (sceneTextChanges.length === 0) return { ok: true, sourceTextChange: null, sceneTextChanges: 0 };
  const relation = placementRelatedReplacementGroup(placement);
  const candidateDiagnostics = sceneTextChanges.map((change) => ({
    changeId: normalizeString(change.changeId || change.authorityCandidateId),
    blockId: textChangeBlockId(change),
    paragraphIndex: textChangeParagraphIndex(change),
    nativeReplacementGroupId: normalizeString(change?.nativeReplacementGroupId || change?.replacementGroupId),
    sourceRevisionIdCount: Array.isArray(change?.sourceRevisionIds)
      ? change.sourceRevisionIds.map(normalizeString).filter(Boolean).length
      : 0,
    groupMatchesParserRelation: Boolean(relation.groupId)
      && normalizeString(change?.nativeReplacementGroupId || change?.replacementGroupId) === relation.groupId,
    sceneTextChanges: sceneTextAfterSourceTextChange(sceneText, change) !== sceneText,
    replacementTextAlreadyPresent: countOccurrences(sceneText, typeof change?.replacementText === 'string' ? change.replacementText : '') === 1,
  })).slice(0, 4);
  const candidates = sceneTextChanges.filter((change) => {
    const blockId = textChangeBlockId(change);
    const paragraphIndex = textChangeParagraphIndex(change);
    const match = isPlainObject(change?.match) ? change.match : {};
    const expectedText = typeof match.quote === 'string' ? match.quote : '';
    const replacementText = typeof change?.replacementText === 'string' ? change.replacementText : '';
    if (authorityParagraphIndex < 0) return false;
    if (!blockId || (authorityBlockId && blockId !== authorityBlockId) || paragraphIndex !== authorityParagraphIndex) return false;
    if (!expectedText || !replacementText) return false;
    if (!['CROSS_REPLACEMENT', 'WITHIN_INSERT'].includes(relation.relationMode) || !relation.groupId) return false;
    if (normalizeString(change?.nativeReplacementGroupId || change?.replacementGroupId) !== relation.groupId) return false;
    const postApplySceneText = sceneTextAfterSourceTextChange(sceneText, change);
    if (relation.relationMode === 'WITHIN_INSERT') {
      return countOccurrences(postApplySceneText, rawSelectedText) === 1
        || countOccurrences(sceneText, rawSelectedText) === 1;
    }
    return postApplySceneText !== sceneText
      || countOccurrences(sceneText, replacementText) === 1;
  });
  const sourceTextChange = textChanges.find((change) => candidates.includes(change)) || null;
  if (candidates.length !== 1 || !sourceTextChange) {
    return {
      ok: false,
      code: candidates.length > 1
        ? 'RTK_COMMENT_PRODUCT_RETURN_SOURCE_TEXT_CHANGE_AMBIGUOUS'
        : 'RTK_COMMENT_PRODUCT_RETURN_SOURCE_TEXT_CHANGE_UNRESOLVED',
      details: {
        sceneId,
        sceneTextChangeCount: sceneTextChanges.length,
        candidateCount: candidates.length,
        hasAuthorityBlockId: Boolean(authorityBlockId),
        authorityParagraphIndex,
        relationMode: relation.relationMode,
        relatedReplacementGroupId: relation.groupId,
        nativeCommentConsistent: nativeIdentity.nativeCommentConsistent,
        candidateDiagnostics,
      },
    };
  }
  return {
    ok: true,
    sourceTextChange,
    sceneTextChanges: sceneTextChanges.length,
    canonicalSelectedText: relation.relationMode === 'WITHIN_INSERT'
      ? rawSelectedText
      : sourceTextChange.replacementText,
    nativeOwnership: {
      groupId: relation.groupId,
      relationMode: relation.relationMode,
      nativeCommentId: nativeIdentity.nativeCommentId,
    },
  };
}

export async function applyRootCommentReturnRuntime(input = {}, options = {}) {
  if (input.commandId !== RTK_ROOT_COMMENT_RETURN_COMMAND_ID) return blocked('RTK_ROOT_COMMENT_COMMAND_INVALID', 'commandId');
  if (input.callerRole !== 'main' || input.commandAuthority?.issuer !== 'main'
    || input.commandAuthority?.commandId !== RTK_ROOT_COMMENT_RETURN_COMMAND_ID
    || input.commandAuthority?.intent !== 'rtk.nonTextReturn') {
    return blocked('RTK_ROOT_COMMENT_COMMAND_AUTHORITY_INVALID', 'commandAuthority');
  }
  let normalized;
  try { normalized = normalizeRootCommentInput(input); }
  catch (error) { return blocked(error.message, 'provenanceOrAnchor'); }
  for (const field of ['projectId', 'projectRoot', 'operationId', 'sceneId', 'threadId', 'commentId']) {
    if (!normalized[field]) return blocked('RTK_ROOT_COMMENT_REQUIRED_FIELD_MISSING', field);
  }
  if (!normalized.body.trim() || Buffer.byteLength(normalized.body, 'utf8') > ROOT_COMMENT_BODY_LIMIT) {
    return blocked('RTK_ROOT_COMMENT_BODY_INVALID', 'body');
  }
  const hasBlockParagraphAuthority = normalized.anchor.blockId && normalized.anchor.paragraphIndex >= 0;
  if (!normalized.selectedText) {
    return blocked('RTK_ROOT_COMMENT_ANCHOR_NOT_UNIQUE', 'selectedText');
  }
  if (!hasBlockParagraphAuthority && countOccurrences(normalized.sceneText, normalized.selectedText) !== 1) {
    return blocked('RTK_ROOT_COMMENT_ANCHOR_NOT_UNIQUE', 'selectedText');
  }
  if (normalized.anchor.sceneId !== normalized.sceneId) {
    return blocked('RTK_ROOT_COMMENT_WRONG_SCENE', 'anchor.sceneId');
  }
  const operationDigest = sha256(stableJson({
    family: 'root_comment',
    operationId: normalized.operationId,
    sceneId: normalized.sceneId,
    threadId: normalized.threadId,
    commentId: normalized.commentId,
    body: normalized.body,
    selectedText: normalized.selectedText,
    ...(Object.keys(normalized.provenance).length ? { provenance: normalized.provenance } : {}),
    anchor: {
      sceneId: normalized.anchor.sceneId,
      blockId: normalized.anchor.blockId,
      paragraphIndex: normalized.anchor.paragraphIndex,
      authoritySource: normalized.anchor.authoritySource,
      sourceChangeId: normalized.anchor.sourceChangeId,
      ...(normalized.anchor.canonicalRange ? { canonicalRange: normalized.anchor.canonicalRange } : {}),
    },
  }));
  const port = options.port || createRtkNonTextReturnFilePort(options);
  let before;
  try {
    before = await port.readCanonical(normalized);
  } catch (error) {
    return blocked('RTK_ROOT_COMMENT_CANONICAL_READ_FAILED', 'port.readCanonical', { message: normalizeString(error?.message) });
  }
  const priorEvent = before.events.find((event) => event.operationId === normalized.operationId);
  if (priorEvent) {
    if (priorEvent.operationDigest !== operationDigest) return blocked('RTK_ROOT_COMMENT_REPLAY_PAYLOAD_MISMATCH', 'operationId');
    const reopened = await port.readCanonical(normalized);
    return {
      ok: true,
      status: 'replay',
      code: 'RTK_ROOT_COMMENT_ALREADY_APPLIED',
      commandId: RTK_ROOT_COMMENT_RETURN_COMMAND_ID,
      operationId: normalized.operationId,
      revision: reopened.revision,
      canonicalDigest: sha256(stableJson(reopened)),
      writerCalled: false,
      replay: true,
      vetoMetrics: { wrongSceneRouting: 0, silentApply: 0, replayFailure: 0, silentLoss: 0 },
    };
  }
  if (before.threads.some((thread) => thread.threadId === normalized.threadId || thread.rootCommentId === normalized.commentId)) {
    return blocked('RTK_ROOT_COMMENT_IDENTITY_COLLISION', 'threadId');
  }
  const event = {
    schemaVersion: RTK_NON_TEXT_RETURN_EVENT_SCHEMA,
    sequence: before.events.length + 1,
    operationId: normalized.operationId,
    operationDigest,
    kind: 'root_comment_added',
    sceneId: normalized.sceneId,
    threadId: normalized.threadId,
  };
  const after = {
    ...before,
    revision: before.revision + 1,
    threads: [...before.threads, {
      threadId: normalized.threadId,
      sceneId: normalized.sceneId,
      status: 'open',
      anchor: {
        sceneId: normalized.sceneId,
        blockId: normalized.anchor.blockId,
        paragraphIndex: normalized.anchor.paragraphIndex,
        selectedText: normalized.selectedText,
        selectedTextSha256: sha256(normalized.selectedText),
        authoritySource: normalized.anchor.authoritySource || (
          hasBlockParagraphAuthority ? 'scene-block-paragraph-authority' : 'unique-selected-text'
        ),
        sourceChangeId: normalized.anchor.sourceChangeId,
        ...(normalized.anchor.canonicalRange || {}),
      },
      rootCommentId: normalized.commentId,
      messages: [{ commentId: normalized.commentId, kind: 'root', body: normalized.body,
        ...(Object.keys(normalized.provenance).length ? { provenance: normalized.provenance } : {}) }],
    }],
    events: [...before.events, event],
  };
  let recovery;
  try {
    recovery = await port.writeRecovery({ ...normalized, state: before });
    await port.writeCanonical({ ...normalized, state: after });
  } catch (error) {
    return blocked('RTK_ROOT_COMMENT_ATOMIC_WRITE_FAILED', 'port.writeCanonical', { message: normalizeString(error?.message) });
  }
  let reopened;
  try {
    reopened = await port.readCanonical(normalized);
  } catch (error) {
    return blocked('RTK_ROOT_COMMENT_REOPEN_FAILED', 'port.readCanonical', { message: normalizeString(error?.message) });
  }
  if (stableJson(reopened) !== stableJson(after)) return blocked('RTK_ROOT_COMMENT_REVERSE_VERIFY_FAILED', 'readback');
  return {
    ok: true,
    status: 'applied',
    code: 'RTK_ROOT_COMMENT_APPLIED',
    commandId: RTK_ROOT_COMMENT_RETURN_COMMAND_ID,
    operationId: normalized.operationId,
    revision: reopened.revision,
    canonicalDigest: sha256(stableJson(reopened)),
    recovery,
    writerCalled: true,
    replay: false,
    vetoMetrics: { wrongSceneRouting: 0, silentApply: 0, replayFailure: 0, silentLoss: 0 },
  };
}

export function createRtkRootCommentReturnCommandHandler(options = {}) {
  return (payload = {}) => applyRootCommentReturnRuntime({
    ...payload,
    commandId: RTK_ROOT_COMMENT_RETURN_COMMAND_ID,
    callerRole: 'main',
    commandAuthority: {
      ...(isPlainObject(payload.commandAuthority) ? payload.commandAuthority : {}),
      issuer: 'main',
      intent: 'rtk.nonTextReturn',
      commandId: RTK_ROOT_COMMENT_RETURN_COMMAND_ID,
    },
  }, options);
}

function normalizeCommentLifecycleInput(input) {
  const provenance = normalizeCommentProvenance(input.provenance);
  return {
    projectId: normalizeString(input.projectId),
    projectRoot: normalizeString(input.projectRoot),
    operationId: normalizeString(input.operationId),
    sceneId: normalizeString(input.sceneId),
    threadId: normalizeString(input.threadId || input.parentThreadId),
    action: normalizeString(input.action),
    replyId: normalizeString(input.replyId),
    replyBody: typeof input.replyBody === 'string' ? input.replyBody : '',
    ...(Object.keys(provenance).length ? { provenance } : {}),
  };
}

function applyCommentLifecycleTransition(thread, input) {
  const next = clone(thread);
  if (next.sceneId !== input.sceneId) return blocked('RTK_COMMENT_LIFECYCLE_WRONG_SCENE', 'sceneId');
  if (input.action === 'reply') {
    if (next.status === 'deleted') return blocked('RTK_COMMENT_REPLY_TO_DELETED_THREAD', 'threadId');
    if (!input.replyId || !input.replyBody.trim() || Buffer.byteLength(input.replyBody, 'utf8') > ROOT_COMMENT_BODY_LIMIT) {
      return blocked('RTK_COMMENT_REPLY_INVALID', 'replyBody');
    }
    if (next.messages.some((message) => message.commentId === input.replyId)) {
      return blocked('RTK_COMMENT_REPLY_IDENTITY_COLLISION', 'replyId');
    }
    next.messages.push({ commentId: input.replyId, kind: 'reply', body: input.replyBody,
      ...(input.provenance ? { provenance: input.provenance } : {}) });
    return { ok: true, thread: next, eventKind: 'comment_reply_added', transitions: [next.status] };
  }
  if (input.action === 'resolve') {
    if (next.status !== 'open') return blocked('RTK_COMMENT_RESOLVE_INVALID_TRANSITION', 'action');
    next.status = 'resolved';
    return { ok: true, thread: next, eventKind: 'comment_resolved', transitions: ['open', 'resolved'] };
  }
  if (input.action === 'reopen') {
    if (next.status !== 'resolved') return blocked('RTK_COMMENT_REOPEN_INVALID_TRANSITION', 'action');
    next.status = 'open';
    return { ok: true, thread: next, eventKind: 'comment_reopened', transitions: ['resolved', 'open'] };
  }
  if (input.action === 'resolve-reopen') {
    if (next.status !== 'open') return blocked('RTK_COMMENT_RESOLVE_REOPEN_INVALID_TRANSITION', 'action');
    next.status = 'open';
    return { ok: true, thread: next, eventKind: 'comment_resolved_reopened', transitions: ['open', 'resolved', 'open'] };
  }
  if (input.action === 'delete') {
    if (next.status === 'deleted') return blocked('RTK_COMMENT_DELETE_INVALID_TRANSITION', 'action');
    const prior = next.status;
    next.status = 'deleted';
    next.deleted = true;
    return { ok: true, thread: next, eventKind: 'comment_deleted', transitions: [prior, 'deleted'] };
  }
  return blocked('RTK_COMMENT_LIFECYCLE_ACTION_UNSUPPORTED', 'action', { action: input.action });
}

export async function applyCommentLifecycleReturnRuntime(input = {}, options = {}) {
  if (input.commandId !== RTK_COMMENT_LIFECYCLE_RETURN_COMMAND_ID) {
    return blocked('RTK_COMMENT_LIFECYCLE_COMMAND_INVALID', 'commandId');
  }
  if (input.callerRole !== 'main' || input.commandAuthority?.issuer !== 'main'
    || input.commandAuthority?.commandId !== RTK_COMMENT_LIFECYCLE_RETURN_COMMAND_ID
    || input.commandAuthority?.intent !== 'rtk.nonTextReturn') {
    return blocked('RTK_COMMENT_LIFECYCLE_COMMAND_AUTHORITY_INVALID', 'commandAuthority');
  }
  let normalized;
  try { normalized = normalizeCommentLifecycleInput(input); }
  catch (error) { return blocked(error.message, 'provenance'); }
  for (const field of ['projectId', 'projectRoot', 'operationId', 'sceneId', 'threadId', 'action']) {
    if (!normalized[field]) return blocked('RTK_COMMENT_LIFECYCLE_REQUIRED_FIELD_MISSING', field);
  }
  const operationDigest = sha256(stableJson({ family: 'comment_lifecycle', ...normalized, projectRoot: undefined }));
  const port = options.port || createRtkNonTextReturnFilePort(options);
  let before;
  try {
    before = await port.readCanonical(normalized);
  } catch (error) {
    return blocked('RTK_COMMENT_LIFECYCLE_CANONICAL_READ_FAILED', 'port.readCanonical', { message: normalizeString(error?.message) });
  }
  const priorEvent = before.events.find((event) => event.operationId === normalized.operationId);
  if (priorEvent) {
    if (priorEvent.operationDigest !== operationDigest) {
      return blocked('RTK_COMMENT_LIFECYCLE_REPLAY_PAYLOAD_MISMATCH', 'operationId');
    }
    const reopened = await port.readCanonical(normalized);
    const replayThread = reopened.threads.find((thread) => thread.threadId === normalized.threadId);
    return {
      ok: true,
      status: 'replay',
      code: 'RTK_COMMENT_LIFECYCLE_ALREADY_APPLIED',
      commandId: RTK_COMMENT_LIFECYCLE_RETURN_COMMAND_ID,
      operationId: normalized.operationId,
      threadStatus: replayThread?.status || '',
      revision: reopened.revision,
      canonicalDigest: sha256(stableJson(reopened)),
      writerCalled: false,
      replay: true,
      vetoMetrics: { wrongSceneRouting: 0, silentApply: 0, replayFailure: 0, silentLoss: 0 },
    };
  }
  const threadIndex = before.threads.findIndex((thread) => thread.threadId === normalized.threadId);
  if (threadIndex < 0) return blocked('RTK_COMMENT_LIFECYCLE_THREAD_NOT_FOUND', 'threadId');
  const transition = applyCommentLifecycleTransition(before.threads[threadIndex], normalized);
  if (!transition.ok) return transition;
  const after = clone(before);
  after.revision += 1;
  after.threads[threadIndex] = transition.thread;
  after.events.push({
    schemaVersion: RTK_NON_TEXT_RETURN_EVENT_SCHEMA,
    sequence: before.events.length + 1,
    operationId: normalized.operationId,
    operationDigest,
    kind: transition.eventKind,
    sceneId: normalized.sceneId,
    threadId: normalized.threadId,
    transitions: transition.transitions,
  });
  let recovery;
  try {
    recovery = await port.writeRecovery({ ...normalized, state: before });
    await port.writeCanonical({ ...normalized, state: after });
  } catch (error) {
    return blocked('RTK_COMMENT_LIFECYCLE_ATOMIC_WRITE_FAILED', 'port.writeCanonical', { message: normalizeString(error?.message) });
  }
  let reopened;
  try {
    reopened = await port.readCanonical(normalized);
  } catch (error) {
    return blocked('RTK_COMMENT_LIFECYCLE_REOPEN_FAILED', 'port.readCanonical', { message: normalizeString(error?.message) });
  }
  if (stableJson(reopened) !== stableJson(after)) return blocked('RTK_COMMENT_LIFECYCLE_REVERSE_VERIFY_FAILED', 'readback');
  return {
    ok: true,
    status: 'applied',
    code: 'RTK_COMMENT_LIFECYCLE_APPLIED',
    commandId: RTK_COMMENT_LIFECYCLE_RETURN_COMMAND_ID,
    operationId: normalized.operationId,
    threadStatus: reopened.threads[threadIndex].status,
    revision: reopened.revision,
    canonicalDigest: sha256(stableJson(reopened)),
    recovery,
    writerCalled: true,
    replay: false,
    vetoMetrics: { wrongSceneRouting: 0, silentApply: 0, replayFailure: 0, silentLoss: 0 },
  };
}

export function createRtkCommentLifecycleReturnCommandHandler(options = {}) {
  return (payload = {}) => applyCommentLifecycleReturnRuntime({
    ...payload,
    commandId: RTK_COMMENT_LIFECYCLE_RETURN_COMMAND_ID,
    callerRole: 'main',
    commandAuthority: {
      ...(isPlainObject(payload.commandAuthority) ? payload.commandAuthority : {}),
      issuer: 'main',
      intent: 'rtk.nonTextReturn',
      commandId: RTK_COMMENT_LIFECYCLE_RETURN_COMMAND_ID,
    },
  }, options);
}

function authenticatedCanonicalCommentRange(authority, sceneId, blockId, paragraphIndex, thread, change, selectedText) {
  const scene = authority.exportMap?.scenes?.find((item) => item.sceneId === sceneId);
  const blocks = scene?.blocks || [];
  const sceneParagraphIndex = blocks.findIndex((block) => block.blockId === blockId);
  if (sceneParagraphIndex < 0 || !blocks[sceneParagraphIndex].formatIr) return null;
  const block = blocks[sceneParagraphIndex];
  if (block.documentParagraphIndex !== paragraphIndex) throw new Error('RTK_COMMENT_CANONICAL_BLOCK_MISMATCH');
  let blockText = block.formatIr.runs.map((run) => run.text).join('');
  if (change) {
    blockText = sceneTextAfterSourceTextChange(blockText, { ...change, match: { ...change.match,
      ...(change.match?.blockRange ? { blockRange: { ...change.match.blockRange, sceneStart: 0 } } : {}) } });
  }
  const range = thread.finalTextAnchorRange;
  if (!range || range.blockTextSha256 !== sha256(blockText) || range.selectedText !== selectedText
    || !Number.isSafeInteger(range.startUtf16) || !Number.isSafeInteger(range.endUtf16)
    || range.endUtf16 !== range.startUtf16 + selectedText.length
    || blockText.slice(range.startUtf16, range.endUtf16) !== selectedText) {
    throw new Error('RTK_COMMENT_CANONICAL_RANGE_MISMATCH');
  }
  return { sceneParagraphIndex, blockTextSha256: sha256(blockText), startUtf16: range.startUtf16 };
}

export function buildAuthenticatedCommentReturnCommands(input = {}) {
  if (input.authenticated !== true) return blocked('RTK_COMMENT_PRODUCT_RETURN_NOT_AUTHENTICATED', 'authenticated');
  const reviewIr = isPlainObject(input.reviewIr) ? input.reviewIr : {};
  const authority = isPlainObject(input.localAuthorityCapsule) ? input.localAuthorityCapsule : {};
  const projectId = normalizeString(input.projectId || authority.projectId);
  const projectRoot = normalizeString(authority.projectRoot || input.projectRoot);
  const returnArtifactId = normalizeString(input.returnArtifactId);
  const scenePathBySceneId = isPlainObject(authority.scenePathBySceneId) ? authority.scenePathBySceneId : {};
  const sceneTextBySceneId = isPlainObject(authority.baselineFinalTextBySceneId) ? authority.baselineFinalTextBySceneId : {};
  if (!projectId || !projectRoot) return blocked('RTK_COMMENT_PRODUCT_RETURN_PROJECT_AUTHORITY_REQUIRED', 'localAuthorityCapsule');
  if (!returnArtifactId) return blocked('RTK_COMMENT_PRODUCT_RETURN_ARTIFACT_ID_REQUIRED', 'returnArtifactId');
  const placements = new Map((Array.isArray(reviewIr.commentPlacements) ? reviewIr.commentPlacements : [])
    .filter(isPlainObject)
    .map((placement) => [normalizeString(placement.threadId), placement]));
  const textChanges = Array.isArray(reviewIr.textChanges) ? reviewIr.textChanges.filter(isPlainObject) : [];
  const commands = [];
  const typedBlocked = [];
  const baseline = authority.commentExport;
  const baselineReadback = compareCommentExportReadback(baseline, reviewIr.commentThreads);
  if (!baselineReadback.ok) {
    return { ...blocked('RTK_COMMENT_REEXPORT_RETURN_CHANGED_OR_MISSING', 'commentExport'),
      commands: [], typedBlocked: [...baselineReadback.missing, ...baselineReadback.changed], baselineReadback };
  }
  const knownDurableIds = new Set((baseline?.threads || []).map(thread => thread.messages[0].durableId));
  for (const [threadIndex, thread] of (Array.isArray(reviewIr.commentThreads) ? reviewIr.commentThreads : []).entries()) {
    if (!isPlainObject(thread)) continue;
    if (knownDurableIds.has(thread.durableId)) continue;
    const threadId = normalizeString(thread.threadId || thread.commentId || `comment-thread-${threadIndex + 1}`);
    if (['UNSUPPORTED_BLOCKED', 'ORPHAN', 'LOST'].includes(thread.status)) {
      typedBlocked.push({ threadId, code: 'RTK_COMMENT_PRODUCT_RETURN_UNSAFE_GRAPH_OR_ANCHOR' });
      continue;
    }
    const placement = placements.get(threadId) || {};
    if (isPlainObject(placement.sceneAuthorityMismatch)) {
      typedBlocked.push({
        threadId,
        code: 'RTK_COMMENT_PRODUCT_RETURN_SCENE_AUTHORITY_MISMATCH',
        parserSceneId: normalizeString(placement.sceneAuthorityMismatch.parserSceneId),
        authenticatedExportMapSceneId: normalizeString(placement.sceneAuthorityMismatch.authenticatedExportMapSceneId),
      });
      continue;
    }
    const sceneId = normalizeString(placement.targetScope?.id || thread.targetScope?.id || thread.sceneId);
    const rawSelectedText = typeof placement.quote === 'string'
      ? placement.quote
      : (typeof thread.quotedAnchorText === 'string' ? thread.quotedAnchorText : '');
    const scenePath = normalizeString(scenePathBySceneId[sceneId]);
    const sceneText = typeof sceneTextBySceneId[sceneId] === 'string' ? sceneTextBySceneId[sceneId] : '';
    const messages = Array.isArray(thread.messages) ? thread.messages.filter(isPlainObject) : [];
    const rootMessage = messages[0] || {};
    const rootBody = typeof rootMessage.body === 'string' ? rootMessage.body : (typeof thread.body === 'string' ? thread.body : '');
    if (!threadId || !sceneId || !scenePath || !sceneText || !rawSelectedText || !rootBody.trim()) {
      typedBlocked.push({
        threadId,
        code: 'RTK_COMMENT_PRODUCT_RETURN_THREAD_AUTHORITY_INCOMPLETE',
        sceneId,
        hasScenePath: Boolean(scenePath),
        hasSceneText: Boolean(sceneText),
        hasSelectedText: Boolean(rawSelectedText),
        hasRootBody: Boolean(rootBody.trim()),
      });
      continue;
    }
    const placementAuthority = isPlainObject(placement.sceneAuthority) ? placement.sceneAuthority : {};
    const placementForSourceAssociation = {
      ...placement,
      threadSourceCommentId: normalizeString(thread.sourceCommentId || thread.commentId),
    };
    const sourceAssociation = resolveAuthenticatedCommentSourceTextChange({
      textChanges,
      sceneId,
      sceneText,
      placement: placementForSourceAssociation,
      placementAuthority,
    });
    if (!sourceAssociation.ok) {
      typedBlocked.push({
        threadId,
        code: sourceAssociation.code,
        rawParserQuote: rawSelectedText,
        details: sourceAssociation.details,
      });
      continue;
    }
    const sourceTextChange = sourceAssociation.sourceTextChange;
    const selectedText = sourceTextChange
      ? sourceAssociation.canonicalSelectedText
      : rawSelectedText;
    const rootIdentityDigest = sha256(stableJson({
      returnArtifactId, threadId, sceneId, selectedText, rawSelectedText, rootBody,
    }));
    const rootOperationId = `physical-root:${rootIdentityDigest}`;
    const canonicalThreadId = `physical-thread:${rootIdentityDigest}`;
    const sourceRootCommentId = normalizeString(rootMessage.messageId || thread.commentId) || `${threadId}:root`;
    const canonicalRootCommentId = `physical-comment:${sha256(stableJson({
      returnArtifactId, threadId, sourceCommentId: sourceRootCommentId, kind: 'root',
    }))}`;
    const blockId = normalizeString(placementAuthority.blockId || placement.blockId || sourceTextChange?.match?.blockId);
    const paragraphIndex = normalizeNonNegativeInteger(
      placementAuthority.paragraphIndex
        ?? placement.paragraphIndex
        ?? sourceTextChange?.paragraphIndex
        ?? sourceTextChange?.documentParagraphIndex,
    );
    const resolvedParagraphIndex = paragraphIndex >= 0 ? paragraphIndex : paragraphIndexFromBlockId(blockId);
    const authoritySource = sourceTextChange
      ? 'rtk-non-overlap-product-replacement-authority'
      : normalizeString(placement.sceneAuthoritySource);
    const commandSceneText = sourceTextChange
      ? sceneTextAfterSourceTextChange(sceneText, sourceTextChange)
      : sceneText;
    let canonicalRange, rootProvenance, replyProvenance;
    const replies = [
      ...messages.slice(1),
      ...(Array.isArray(thread.replies) ? thread.replies.filter(isPlainObject) : []),
    ];
    try {
      canonicalRange = authenticatedCanonicalCommentRange(authority, sceneId, blockId, resolvedParagraphIndex,
        thread, sourceTextChange, selectedText);
      rootProvenance = normalizeCommentProvenance({
        author: rootMessage.author || thread.authorPersonIdentity?.author || '',
        initials: rootMessage.initials || thread.authorPersonIdentity?.initials || '',
        date: rootMessage.date || thread.date || '',
        dateUtc: rootMessage.dateUtc || thread.dateUtc || thread.modernMetadata?.dateUtc || '',
      });
      replyProvenance = replies.map((reply) => normalizeCommentProvenance({ author: reply.author || '',
        initials: reply.initials || '', date: reply.date || '', dateUtc: reply.dateUtc || '' }));
    } catch (error) {
      typedBlocked.push({ threadId, code: error.message });
      continue;
    }
    commands.push({
      family: 'root_comment',
      payload: {
        projectId, projectRoot, operationId: rootOperationId, sceneId, scenePath, sceneText: commandSceneText, selectedText,
        threadId: canonicalThreadId,
        commentId: canonicalRootCommentId,
        body: rootBody,
        provenance: rootProvenance,
        anchor: {
          sceneId,
          blockId,
          paragraphIndex: resolvedParagraphIndex,
          authoritySource,
          sourceChangeId: normalizeString(sourceTextChange?.changeId || sourceTextChange?.authorityCandidateId),
          nativeReplacementGroupId: normalizeString(sourceAssociation.nativeOwnership?.groupId),
          ...(canonicalRange ? { canonicalRange } : {}),
        },
        returnArtifactId,
        sourceThreadId: threadId,
        sourceCommentId: sourceRootCommentId,
        rawParserQuote: rawSelectedText,
        nativeOwnership: sourceAssociation.nativeOwnership || null,
        selectedTextSource: sourceTextChange
          ? (sourceAssociation.nativeOwnership?.relationMode === 'WITHIN_INSERT'
            ? 'parser-quote-within-insert'
            : 'authenticated-replacement')
          : 'parser-quote',
      },
    });
    replies.forEach((reply, replyIndex) => {
      const replyBody = typeof reply.body === 'string' ? reply.body : '';
      const sourceReplyId = normalizeString(reply.messageId || reply.commentId || reply.itemId)
        || `${threadId}:reply:${replyIndex + 1}`;
      const canonicalReplyId = `physical-comment:${sha256(stableJson({
        returnArtifactId, threadId, sourceCommentId: sourceReplyId, kind: 'reply',
      }))}`;
      commands.push({
        family: 'reply',
        payload: {
          projectId, projectRoot, sceneId, threadId: canonicalThreadId, action: 'reply',
          replyId: canonicalReplyId, replyBody,
          provenance: replyProvenance[replyIndex],
          returnArtifactId,
          sourceThreadId: threadId,
          sourceReplyId,
          operationId: `physical-reply:${sha256(stableJson({
            returnArtifactId, threadId, replyId: sourceReplyId, replyBody,
          }))}`,
        },
      });
    });
    const rawStatus = normalizeString(thread.status).toLowerCase();
    const lifecycleState = normalizeString(thread.doneResolvedReopenedState).toLowerCase();
    const action = rawStatus === 'deleted' || lifecycleState === 'deleted'
      ? 'delete'
      : rawStatus === 'resolved' || rawStatus === 'done' || lifecycleState === 'resolved'
        ? 'resolve'
        : lifecycleState === 'reopened'
          ? 'resolve-reopen'
          : '';
    if (action) {
      commands.push({
        family: 'comment_state',
        payload: {
          projectId, projectRoot, sceneId, threadId: canonicalThreadId, action,
          returnArtifactId,
          sourceThreadId: threadId,
          operationId: `physical-state:${sha256(stableJson({
            returnArtifactId, threadId, action,
          }))}`,
        },
      });
    }
  }
  return {
    ok: typedBlocked.length === 0 && (commands.length > 0 || baselineReadback.unchangedThreadIds.length > 0),
    status: typedBlocked.length === 0 && (commands.length > 0 || baselineReadback.unchangedThreadIds.length > 0) ? 'ready' : 'blocked',
    code: typedBlocked.length === 0 && (commands.length > 0 || baselineReadback.unchangedThreadIds.length > 0)
      ? 'RTK_COMMENT_PRODUCT_RETURN_COMMANDS_READY'
      : 'RTK_COMMENT_PRODUCT_RETURN_COMMANDS_BLOCKED',
    commands,
    typedBlocked,
    baselineReadback,
    commandBusRequired: true,
    directPortDispatchForbidden: true,
  };
}

export function bindAuthenticatedCommentPlacementSceneAuthority(input = {}) {
  const threads = Array.isArray(input.commentThreads) ? input.commentThreads.filter(isPlainObject) : [];
  const parserPlacements = Array.isArray(input.parserPlacements) ? input.parserPlacements.filter(isPlainObject) : [];
  const authenticatedPlacements = Array.isArray(input.authenticatedPlacements)
    ? input.authenticatedPlacements.filter(isPlainObject)
    : [];
  const capsule = isPlainObject(input.localAuthorityCapsule) ? input.localAuthorityCapsule : {};
  const scenePathBySceneId = isPlainObject(capsule.scenePathBySceneId) ? capsule.scenePathBySceneId : {};
  const sceneTextBySceneId = isPlainObject(capsule.baselineFinalTextBySceneId) ? capsule.baselineFinalTextBySceneId : {};
  const sceneOrdinalAuthority = isPlainObject(capsule.sceneOrdinalAuthority) ? capsule.sceneOrdinalAuthority : {};
  const touchedParagraphs = Array.isArray(sceneOrdinalAuthority.touchedParagraphs)
    ? sceneOrdinalAuthority.touchedParagraphs.filter(isPlainObject)
    : [];
  const bound = (sceneId) => Boolean(normalizeString(sceneId))
    && Boolean(normalizeString(scenePathBySceneId[sceneId]))
    && typeof sceneTextBySceneId[sceneId] === 'string';
  const mappedCommentAuthority = (threadId, nativeCommentId) => {
    const touched = touchedParagraphs.find((item) => (
      normalizeString(item.kind) === 'commentThread'
      && [threadId, nativeCommentId].map(normalizeString).filter(Boolean).includes(normalizeString(item.id))
    ));
    if (!touched) return null;
    return {
      blockId: normalizeString(touched.blockId),
      paragraphIndex: normalizeNonNegativeInteger(touched.documentParagraphIndex),
      documentParagraphIndex: normalizeNonNegativeInteger(touched.documentParagraphIndex),
    };
  };
  const mergeMappedSceneAuthority = (authority, mapped) => {
    const base = isPlainObject(authority) ? clone(authority) : {};
    if (!mapped) return base;
    return {
      ...base,
      blockId: mapped.blockId || normalizeString(base.blockId),
      paragraphIndex: mapped.paragraphIndex >= 0 ? mapped.paragraphIndex : base.paragraphIndex,
      documentParagraphIndex: mapped.documentParagraphIndex >= 0 ? mapped.documentParagraphIndex : base.documentParagraphIndex,
    };
  };
  const parserByThread = new Map(parserPlacements.map((placement) => [normalizeString(placement.threadId), placement]));
  const placements = [];
  const failures = [];
  const parserIdentityOwners = new Map();
  const authenticatedByNativeIdentity = new Map();
  for (const placement of authenticatedPlacements) {
    const nativeCommentId = normalizeString(placement.sourceCommentId || placement.commentId);
    if (!nativeCommentId) {
      failures.push({ threadId: normalizeString(placement.threadId), code: 'RTK_COMMENT_PRODUCT_RETURN_NATIVE_COMMENT_ID_MISSING', side: 'authenticated-candidate' });
      continue;
    }
    if (authenticatedByNativeIdentity.has(nativeCommentId)) {
      failures.push({ nativeCommentId, code: 'RTK_COMMENT_PRODUCT_RETURN_NATIVE_COMMENT_ID_DUPLICATE', side: 'authenticated-candidate' });
      continue;
    }
    authenticatedByNativeIdentity.set(nativeCommentId, placement);
  }
  let identityJoinCount = 0;
  for (const thread of threads) {
    const threadId = normalizeString(thread.threadId);
    const parser = parserByThread.get(threadId) || { threadId, targetScope: { type: 'scene', id: '' } };
    const threadNativeCommentId = normalizeString(thread.sourceCommentId || thread.commentId);
    const placementNativeCommentId = normalizeString(parser.sourceCommentId || parser.commentId);
    if (!threadNativeCommentId) {
      placements.push(clone(parser));
      failures.push({ threadId, code: 'RTK_COMMENT_PRODUCT_RETURN_NATIVE_COMMENT_ID_MISSING', side: 'parser-thread' });
      continue;
    }
    if (placementNativeCommentId && placementNativeCommentId !== threadNativeCommentId) {
      placements.push(clone(parser));
      failures.push({ threadId, code: 'RTK_COMMENT_PRODUCT_RETURN_NATIVE_COMMENT_ID_CONFLICT', threadNativeCommentId, placementNativeCommentId });
      continue;
    }
    const priorOwner = parserIdentityOwners.get(threadNativeCommentId);
    if (priorOwner && priorOwner !== threadId) {
      placements.push(clone(parser));
      failures.push({ threadId, nativeCommentId: threadNativeCommentId, priorThreadId: priorOwner, code: 'RTK_COMMENT_PRODUCT_RETURN_NATIVE_COMMENT_ID_MANY_TO_ONE' });
      continue;
    }
    parserIdentityOwners.set(threadNativeCommentId, threadId);
    const authenticated = authenticatedByNativeIdentity.get(threadNativeCommentId) || null;
    if (!authenticated) {
      placements.push(clone(parser));
      failures.push({ threadId, nativeCommentId: threadNativeCommentId, code: 'RTK_COMMENT_PRODUCT_RETURN_NATIVE_COMMENT_ID_UNJOINED' });
      continue;
    }
    identityJoinCount += 1;
    const parserSceneId = normalizeString(parser.targetScope?.id);
    const authenticatedSceneId = normalizeString(authenticated?.targetScope?.id);
    if (parserSceneId && authenticatedSceneId && parserSceneId !== authenticatedSceneId) {
      const mismatch = { parserSceneId, authenticatedExportMapSceneId: authenticatedSceneId };
      placements.push({ ...clone(parser), sceneAuthorityMismatch: mismatch });
      failures.push({ threadId, code: 'RTK_COMMENT_PRODUCT_RETURN_SCENE_AUTHORITY_MISMATCH', ...mismatch });
      continue;
    }
    const mappedAuthority = mappedCommentAuthority(threadId, threadNativeCommentId);
    if (bound(parserSceneId)) {
      placements.push({
        ...clone(parser),
        paragraphIndex: mappedAuthority?.paragraphIndex >= 0
          ? mappedAuthority.paragraphIndex
          : (Number.isSafeInteger(authenticated?.paragraphIndex) ? authenticated.paragraphIndex : parser.paragraphIndex),
        documentParagraphIndex: mappedAuthority?.documentParagraphIndex >= 0
          ? mappedAuthority.documentParagraphIndex
          : (Number.isSafeInteger(authenticated?.documentParagraphIndex) ? authenticated.documentParagraphIndex : parser.documentParagraphIndex),
        relatedReplacementGroupId: normalizeString(parser.relatedReplacementGroupId || authenticated?.relatedReplacementGroupId),
        relatedReplacementGroupMode: normalizeString(parser.relatedReplacementGroupMode || authenticated?.relatedReplacementGroupMode),
        sceneAuthority: mergeMappedSceneAuthority(authenticated?.sceneAuthority || parser.sceneAuthority || null, mappedAuthority),
        sceneAuthoritySource: authenticated?.sceneAuthority
          ? 'authenticated-candidate-export-map-placement'
          : normalizeString(parser.sceneAuthoritySource),
      });
      continue;
    }
    if (bound(authenticatedSceneId)) {
      placements.push({
        ...clone(parser),
        threadId,
        sourceCommentId: threadNativeCommentId,
        targetScope: clone(authenticated.targetScope),
        relatedReplacementGroupId: normalizeString(parser.relatedReplacementGroupId || authenticated?.relatedReplacementGroupId),
        relatedReplacementGroupMode: normalizeString(parser.relatedReplacementGroupMode || authenticated?.relatedReplacementGroupMode),
        paragraphIndex: mappedAuthority?.paragraphIndex >= 0
          ? mappedAuthority.paragraphIndex
          : authenticated.paragraphIndex,
        documentParagraphIndex: mappedAuthority?.documentParagraphIndex >= 0
          ? mappedAuthority.documentParagraphIndex
          : authenticated.documentParagraphIndex,
        sceneAuthority: mergeMappedSceneAuthority(authenticated.sceneAuthority || null, mappedAuthority),
        sceneAuthoritySource: 'authenticated-candidate-export-map-placement',
      });
      continue;
    }
    placements.push(clone(parser));
    failures.push({
      threadId,
      code: 'RTK_COMMENT_PRODUCT_RETURN_SCENE_AUTHORITY_UNRESOLVED',
      parserSceneId,
      authenticatedExportMapSceneId: authenticatedSceneId,
    });
  }
  return {
    ok: failures.length === 0 && placements.length === threads.length,
    code: failures.length === 0
      ? 'RTK_COMMENT_PRODUCT_RETURN_SCENE_AUTHORITY_BOUND'
      : 'RTK_COMMENT_PRODUCT_RETURN_SCENE_AUTHORITY_BLOCKED',
    placements,
    failures,
    identityJoinCount,
    unjoinedPlacementCount: threads.length - identityJoinCount,
    nativeCommentIdentityJoin: true,
    arbitraryThreadIdSuffixParsingUsed: false,
    quoteHeuristicUsed: false,
  };
}

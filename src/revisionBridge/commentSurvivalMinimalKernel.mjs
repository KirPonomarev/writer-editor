import { canonicalHash } from './reviewIrKernel.mjs';

const RESULT_KIND = 'STAGE_04_COMMENT_SURVIVAL_MINIMAL_KERNEL_RESULT_001';
const DECISION_KIND = 'STAGE_04_COMMENT_SURVIVAL_MINIMAL_KERNEL_DECISION_001';
const CONTOUR_ID = 'STAGE_04_COMMENT_SURVIVAL_MINIMAL_KERNEL_001';
const LEDGER_KIND = 'CommentEscrowLedger';
const SUCCESS_DECISION = 'COMMENT_SURVIVAL_COMPILED';
const BLOCKED_DECISION = 'COMMENT_SURVIVAL_BLOCKED';

const ALLOWED_CHANGED_BASENAMES = new Set([
  'commentSurvivalMinimalKernel.mjs',
  'commentSurvivalMinimalKernel.contract.test.js',
  'STAGE_04_COMMENT_SURVIVAL_MINIMAL_KERNEL_001.md',
]);

const DEFAULT_SOURCE_VIEW_STATE_SEED = Object.freeze({
  revisionToken: 'LOCAL_SYNTHETIC_REVISION',
  viewMode: 'LOCAL_SYNTHETIC_VIEW',
  normalizationPolicy: 'TEXT_V1',
  newlinePolicy: 'LF',
  unicodePolicy: 'NFC',
  artifactCompletenessClass: 'TEXT_ONLY',
});

export const COMMENT_SURVIVAL_MINIMAL_KERNEL_REASON_CODES = Object.freeze({
  LOST_PLACEMENT_ORPHANED: 'LOST_PLACEMENT_ORPHANED',
  UNSUPPORTED_PLACEMENT_ORPHANED: 'UNSUPPORTED_PLACEMENT_ORPHANED',
  AMBIGUOUS_PLACEMENT_ORPHANED: 'AMBIGUOUS_PLACEMENT_ORPHANED',
  DELETED_PLACEMENT_ORPHANED: 'DELETED_PLACEMENT_ORPHANED',
  WORD_ANCHOR_REQUIRED_ORPHANED: 'WORD_ANCHOR_REQUIRED_ORPHANED',
  POSITION_DELETED_ORPHANED: 'POSITION_DELETED_ORPHANED',
  GOOGLE_REVISION_MISMATCH_ORPHANED: 'GOOGLE_REVISION_MISMATCH_ORPHANED',
  THREAD_METADATA_MISSING_ORPHANED: 'THREAD_METADATA_MISSING_ORPHANED',
  PARENT_PLACEMENT_FAILED_ORPHANED: 'PARENT_PLACEMENT_FAILED_ORPHANED',
  DUPLICATE_COMMENT_ID_LEDGER_ANOMALY: 'DUPLICATE_COMMENT_ID_LEDGER_ANOMALY',
  NON_INLINE_GOOGLE_SUGGESTION_MANUAL_ONLY: 'NON_INLINE_GOOGLE_SUGGESTION_MANUAL_ONLY',
  BROKEN_MOVE_PAIRING_MANUAL_ONLY: 'BROKEN_MOVE_PAIRING_MANUAL_ONLY',
  STRUCTURAL_MOVE_MANUAL_ONLY: 'STRUCTURAL_MOVE_MANUAL_ONLY',
  FORBIDDEN_RUNTIME_APPLY_OR_USER_MUTATION: 'FORBIDDEN_RUNTIME_APPLY_OR_USER_MUTATION',
  FORBIDDEN_APPLYTXN_RECOVERY_RELEASE_CLAIM: 'FORBIDDEN_APPLYTXN_RECOVERY_RELEASE_CLAIM',
  FORBIDDEN_PRODUCT_RECEIPT_CHAIN_CONTINUATION: 'FORBIDDEN_PRODUCT_RECEIPT_CHAIN_CONTINUATION',
  FORBIDDEN_UI_DOCX_GOOGLE_WORD_NETWORK_DEPENDENCY_REQUEST: 'FORBIDDEN_UI_DOCX_GOOGLE_WORD_NETWORK_DEPENDENCY_REQUEST',
  FORBIDDEN_BASENAME_CHANGE: 'FORBIDDEN_BASENAME_CHANGE',
});

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function hasText(value) {
  return typeof value === 'string' && value.length > 0;
}

function cleanText(value) {
  return String(value ?? '').replace(/\r\n?/gu, '\n');
}

function upper(value, fallback) {
  return hasText(value) ? String(value).toUpperCase() : fallback;
}

function uniqueSorted(values) {
  return Array.from(new Set(values.filter(Boolean))).sort();
}

function withCanonicalHash(core) {
  return {
    ...core,
    canonicalHash: canonicalHash(core),
  };
}

function normalizeSourceViewState(input = {}) {
  const base = isObject(input) ? input : {};
  const output = {
    revisionToken: hasText(base.revisionToken) ? base.revisionToken : DEFAULT_SOURCE_VIEW_STATE_SEED.revisionToken,
    viewMode: hasText(base.viewMode) ? base.viewMode : DEFAULT_SOURCE_VIEW_STATE_SEED.viewMode,
    normalizationPolicy: hasText(base.normalizationPolicy) ? base.normalizationPolicy : DEFAULT_SOURCE_VIEW_STATE_SEED.normalizationPolicy,
    newlinePolicy: hasText(base.newlinePolicy) ? base.newlinePolicy : DEFAULT_SOURCE_VIEW_STATE_SEED.newlinePolicy,
    unicodePolicy: hasText(base.unicodePolicy) ? base.unicodePolicy : DEFAULT_SOURCE_VIEW_STATE_SEED.unicodePolicy,
    artifactCompletenessClass: hasText(base.artifactCompletenessClass)
      ? base.artifactCompletenessClass
      : DEFAULT_SOURCE_VIEW_STATE_SEED.artifactCompletenessClass,
  };
  output.packetHash = hasText(base.packetHash) ? base.packetHash : canonicalHash(output);
  return output;
}

function normalizeThreadMetadataStatus(thread) {
  if (hasText(thread.threadMetadataStatus)) {
    return upper(thread.threadMetadataStatus, 'OK');
  }
  if (!hasText(thread.threadId) || !hasText(thread.commentId)) {
    return 'MISSING';
  }
  return 'OK';
}

function pushForbiddenClaimReasons(input, reasons) {
  if (!isObject(input)) {
    return;
  }
  if (input.runtimeApplyRequested === true || input.runtimeApplyClaimed === true || input.userProjectMutated === true) {
    reasons.push(COMMENT_SURVIVAL_MINIMAL_KERNEL_REASON_CODES.FORBIDDEN_RUNTIME_APPLY_OR_USER_MUTATION);
  }
  if (
    input.applyTxnImplemented === true
    || input.applyTxnClaimed === true
    || input.recoveryReady === true
    || input.recoveryClaimed === true
    || input.releaseGreen === true
    || input.releaseClaimed === true
  ) {
    reasons.push(COMMENT_SURVIVAL_MINIMAL_KERNEL_REASON_CODES.FORBIDDEN_APPLYTXN_RECOVERY_RELEASE_CLAIM);
  }
  if (input.productReceiptContinuationRequested === true || input.productReceiptChainContinuationClaimed === true) {
    reasons.push(COMMENT_SURVIVAL_MINIMAL_KERNEL_REASON_CODES.FORBIDDEN_PRODUCT_RECEIPT_CHAIN_CONTINUATION);
  }
  if (
    input.uiChangeRequested === true
    || input.docxIntegrationRequested === true
    || input.googleIntegrationRequested === true
    || input.wordIntegrationRequested === true
    || input.networkUsed === true
    || input.dependencyChanged === true
  ) {
    reasons.push(COMMENT_SURVIVAL_MINIMAL_KERNEL_REASON_CODES.FORBIDDEN_UI_DOCX_GOOGLE_WORD_NETWORK_DEPENDENCY_REQUEST);
  }
}

function pushForbiddenBasenameReasons(input, reasons) {
  if (!Array.isArray(input?.changedBasenames)) {
    return;
  }
  if (input.changedBasenames.some((basename) => !ALLOWED_CHANGED_BASENAMES.has(basename))) {
    reasons.push(COMMENT_SURVIVAL_MINIMAL_KERNEL_REASON_CODES.FORBIDDEN_BASENAME_CHANGE);
  }
}

export function createCommentThread(input = {}) {
  const status = upper(input.status, 'OPEN');
  return withCanonicalHash({
    modelKind: 'CommentThread',
    threadId: hasText(input.threadId) ? input.threadId : '',
    replyParent: hasText(input.replyParent ?? input.parentCommentId) ? (input.replyParent ?? input.parentCommentId) : '',
    resolvedDone: input.resolvedDone === true || status === 'RESOLVED' || status === 'DONE',
    authorHandle: hasText(input.authorHandle) ? input.authorHandle : '',
    createdAtUTC: hasText(input.createdAtUTC) ? input.createdAtUTC : '',
    threadMetadataStatus: normalizeThreadMetadataStatus(input),
    commentId: hasText(input.commentId) ? input.commentId : '',
    content: cleanText(input.content ?? input.text ?? ''),
  });
}

export function createCommentPlacement(input = {}) {
  return withCanonicalHash({
    modelKind: 'CommentPlacement',
    commentId: hasText(input.commentId) ? input.commentId : '',
    placementStatus: upper(input.placementStatus ?? input.status, 'SUPPORTED'),
    selectorKind: hasText(input.selectorKind ?? input.anchorKind) ? upper(input.selectorKind ?? input.anchorKind, 'TEXT_QUOTE') : 'TEXT_QUOTE',
    selectorEvidence: isObject(input.selectorEvidence) ? input.selectorEvidence : {},
    ambiguityReason: hasText(input.ambiguityReason) ? input.ambiguityReason : '',
    sourceState: normalizeSourceViewState(input.sourceState),
  });
}

export function createOrphanComment(input = {}) {
  const status = upper(input.status, 'OPEN');
  return withCanonicalHash({
    modelKind: 'OrphanComment',
    commentId: hasText(input.commentId) ? input.commentId : '',
    threadId: hasText(input.threadId) ? input.threadId : '',
    commentText: cleanText(input.commentText ?? input.content ?? input.text ?? ''),
    content: cleanText(input.content ?? input.commentText ?? input.text ?? ''),
    orphanReason: hasText(input.orphanReason) ? input.orphanReason : COMMENT_SURVIVAL_MINIMAL_KERNEL_REASON_CODES.LOST_PLACEMENT_ORPHANED,
    originalPlacementAttempt: isObject(input.originalPlacementAttempt) ? input.originalPlacementAttempt : createCommentPlacement({ commentId: input.commentId }),
    threadMetadata: isObject(input.threadMetadata) ? input.threadMetadata : {},
    sourceViewState: normalizeSourceViewState(input.sourceViewState),
    authorHandle: hasText(input.authorHandle) ? input.authorHandle : '',
    createdAtUTC: hasText(input.createdAtUTC) ? input.createdAtUTC : '',
    resolvedDone: input.resolvedDone === true || status === 'RESOLVED' || status === 'DONE',
  });
}

export function createCommentEscrowLedger(input = {}) {
  const commentRecordHashes = asArray(input.commentRecordHashes).slice().sort();
  const core = {
    ledgerKind: LEDGER_KIND,
    contourId: CONTOUR_ID,
    sourceViewStateHash: hasText(input.sourceViewStateHash) ? input.sourceViewStateHash : canonicalHash(normalizeSourceViewState({})),
    commentCount: Number.isInteger(input.commentCount) ? input.commentCount : 0,
    placedCount: Number.isInteger(input.placedCount) ? input.placedCount : 0,
    orphanCount: Number.isInteger(input.orphanCount) ? input.orphanCount : 0,
    anomalyCount: Number.isInteger(input.anomalyCount) ? input.anomalyCount : 0,
    commentRecordHashes,
  };
  return withCanonicalHash(core);
}

function manualOnlyReasons(rawThread, placement) {
  const suggestion = isObject(rawThread?.suggestion) ? rawThread.suggestion : {};
  const provider = upper(suggestion.provider ?? rawThread?.provider ?? '', '');
  const kind = upper(suggestion.kind, 'INLINE');
  const pairing = upper(suggestion.pairing, '');
  const structural = suggestion.structural === true || kind === 'MOVE' || kind === 'STRUCTURAL';
  const reasons = [];

  if (provider === 'GOOGLE' && kind !== 'INLINE') {
    reasons.push(COMMENT_SURVIVAL_MINIMAL_KERNEL_REASON_CODES.NON_INLINE_GOOGLE_SUGGESTION_MANUAL_ONLY);
  }
  if (kind === 'MOVE' && pairing === 'BROKEN') {
    reasons.push(COMMENT_SURVIVAL_MINIMAL_KERNEL_REASON_CODES.BROKEN_MOVE_PAIRING_MANUAL_ONLY);
  }
  if (structural) {
    reasons.push(COMMENT_SURVIVAL_MINIMAL_KERNEL_REASON_CODES.STRUCTURAL_MOVE_MANUAL_ONLY);
  }
  if (placement.selectorKind === 'STRUCTURAL') {
    reasons.push(COMMENT_SURVIVAL_MINIMAL_KERNEL_REASON_CODES.STRUCTURAL_MOVE_MANUAL_ONLY);
  }
  return uniqueSorted(reasons);
}

function orphanReasons(thread, placement, rawPlacement) {
  const reasons = [];
  const placementStatus = placement.placementStatus;

  if (placementStatus === 'LOST') {
    reasons.push(COMMENT_SURVIVAL_MINIMAL_KERNEL_REASON_CODES.LOST_PLACEMENT_ORPHANED);
  }
  if (placementStatus === 'UNSUPPORTED') {
    reasons.push(COMMENT_SURVIVAL_MINIMAL_KERNEL_REASON_CODES.UNSUPPORTED_PLACEMENT_ORPHANED);
  }
  if (placementStatus === 'AMBIGUOUS') {
    reasons.push(COMMENT_SURVIVAL_MINIMAL_KERNEL_REASON_CODES.AMBIGUOUS_PLACEMENT_ORPHANED);
  }
  if (placementStatus === 'DELETED') {
    reasons.push(COMMENT_SURVIVAL_MINIMAL_KERNEL_REASON_CODES.DELETED_PLACEMENT_ORPHANED);
  }
  if (placementStatus === 'POSITION_DELETED') {
    reasons.push(COMMENT_SURVIVAL_MINIMAL_KERNEL_REASON_CODES.POSITION_DELETED_ORPHANED);
  }
  const anchorId = isObject(rawPlacement) && hasText(rawPlacement.anchorId) ? rawPlacement.anchorId : '';
  if (placement.selectorKind === 'WORD' && !hasText(anchorId)) {
    reasons.push(COMMENT_SURVIVAL_MINIMAL_KERNEL_REASON_CODES.WORD_ANCHOR_REQUIRED_ORPHANED);
  }
  const expectedRevisionToken = isObject(rawPlacement) ? rawPlacement.expectedRevisionToken : '';
  const revisionToken = isObject(rawPlacement) ? rawPlacement.revisionToken : '';
  const provider = upper(rawPlacement?.provider, '');
  if (
    provider === 'GOOGLE'
    && hasText(expectedRevisionToken)
    && hasText(revisionToken)
    && expectedRevisionToken !== revisionToken
  ) {
    reasons.push(COMMENT_SURVIVAL_MINIMAL_KERNEL_REASON_CODES.GOOGLE_REVISION_MISMATCH_ORPHANED);
  }
  if (thread.threadMetadataStatus === 'MISSING') {
    reasons.push(COMMENT_SURVIVAL_MINIMAL_KERNEL_REASON_CODES.THREAD_METADATA_MISSING_ORPHANED);
  }
  return uniqueSorted(reasons);
}

function recordHashRecord(input = {}) {
  return canonicalHash({
    commentId: hasText(input.commentId) ? input.commentId : '',
    threadId: hasText(input.threadId) ? input.threadId : '',
    state: hasText(input.state) ? input.state : '',
    content: cleanText(input.content ?? ''),
    resolvedDone: input.resolvedDone === true,
    orphanReason: hasText(input.orphanReason) ? input.orphanReason : '',
  });
}

function threadMetadataView(thread) {
  return {
    threadId: thread.threadId,
    replyParent: thread.replyParent,
    resolvedDone: thread.resolvedDone,
    authorHandle: thread.authorHandle,
    createdAtUTC: thread.createdAtUTC,
    threadMetadataStatus: thread.threadMetadataStatus,
    commentId: thread.commentId,
  };
}

function buildDecision(blockedReasons) {
  return withCanonicalHash({
    decisionKind: DECISION_KIND,
    contourId: CONTOUR_ID,
    outputDecision: blockedReasons.length > 0 ? BLOCKED_DECISION : SUCCESS_DECISION,
    blocked: blockedReasons.length > 0,
    blockedReasons,
  });
}

function placementSourceState(rawPlacement, fallbackSourceViewState) {
  if (isObject(rawPlacement) && isObject(rawPlacement.sourceState)) {
    return rawPlacement.sourceState;
  }
  return fallbackSourceViewState;
}

function registerDuplicateCommentIdAnomaly(thread, seenCommentIds, anomalies) {
  if (!thread.commentId) {
    return;
  }
  if (seenCommentIds.has(thread.commentId)) {
    anomalies.push(withCanonicalHash({
      anomalyCode: COMMENT_SURVIVAL_MINIMAL_KERNEL_REASON_CODES.DUPLICATE_COMMENT_ID_LEDGER_ANOMALY,
      commentId: thread.commentId,
      duplicateOfCommentId: seenCommentIds.get(thread.commentId),
      threadId: thread.threadId,
    }));
    return;
  }
  seenCommentIds.set(thread.commentId, thread.commentId);
}

function registerThreadMetadataMissingAnomaly(thread, anomalies) {
  if (thread.threadMetadataStatus !== 'MISSING') {
    return;
  }
  anomalies.push(withCanonicalHash({
    anomalyCode: COMMENT_SURVIVAL_MINIMAL_KERNEL_REASON_CODES.THREAD_METADATA_MISSING_ORPHANED,
    commentId: thread.commentId,
    threadId: thread.threadId,
  }));
}

function replyThreadMetadataStatus(rawReply) {
  if (hasText(rawReply?.threadMetadataStatus)) {
    return upper(rawReply.threadMetadataStatus, 'OK');
  }
  if (!hasText(rawReply?.threadId) || !hasText(rawReply?.commentId)) {
    return 'MISSING';
  }
  return 'OK';
}

export function compileCommentSurvivalMinimalKernel(input = {}) {
  const sourceViewState = normalizeSourceViewState(input.sourceViewState);
  const sourceViewStateHash = canonicalHash(sourceViewState);
  const blockedReasons = [];
  const manualOnlyReasonCodes = [];
  const commentThreads = [];
  const commentPlacements = [];
  const orphanComments = [];
  const anomalies = [];
  const commentRecordHashes = [];
  const seenCommentIds = new Map();

  pushForbiddenClaimReasons(input, blockedReasons);
  pushForbiddenBasenameReasons(input, blockedReasons);

  for (const rawThread of asArray(input.commentThreads)) {
    const rawPlacement = isObject(rawThread?.placement) ? rawThread.placement : {};
    const thread = createCommentThread(rawThread);
    const placement = createCommentPlacement({
      ...rawPlacement,
      commentId: thread.commentId,
      sourceState: placementSourceState(rawPlacement, sourceViewState),
    });
    const threadOrphanReasons = orphanReasons(thread, placement, rawPlacement);
    const threadManualOnlyReasons = manualOnlyReasons(rawThread, placement);
    manualOnlyReasonCodes.push(...threadManualOnlyReasons);

    registerDuplicateCommentIdAnomaly(thread, seenCommentIds, anomalies);
    registerThreadMetadataMissingAnomaly(thread, anomalies);

    const primaryOrphanReason = threadOrphanReasons[0] || '';
    if (primaryOrphanReason === COMMENT_SURVIVAL_MINIMAL_KERNEL_REASON_CODES.GOOGLE_REVISION_MISMATCH_ORPHANED) {
      blockedReasons.push(COMMENT_SURVIVAL_MINIMAL_KERNEL_REASON_CODES.GOOGLE_REVISION_MISMATCH_ORPHANED);
    }
    if (threadOrphanReasons.length > 0) {
      orphanComments.push(createOrphanComment({
        commentId: thread.commentId,
        threadId: thread.threadId,
        content: thread.content,
        orphanReason: primaryOrphanReason,
        originalPlacementAttempt: placement,
        threadMetadata: threadMetadataView(thread),
        sourceViewState,
        authorHandle: thread.authorHandle,
        createdAtUTC: thread.createdAtUTC,
        resolvedDone: thread.resolvedDone,
      }));
      commentRecordHashes.push(recordHashRecord({
        commentId: thread.commentId,
        threadId: thread.threadId,
        state: 'ORPHANED',
        content: thread.content,
        resolvedDone: thread.resolvedDone,
        orphanReason: primaryOrphanReason,
      }));
    } else {
      commentThreads.push(thread);
      commentPlacements.push(placement);
      commentRecordHashes.push(recordHashRecord({
        commentId: thread.commentId,
        threadId: thread.threadId,
        state: 'PLACED',
        content: thread.content,
        resolvedDone: thread.resolvedDone,
      }));
    }

    for (const rawReply of asArray(rawThread?.replies)) {
      const replyThreadId = hasText(rawReply?.threadId) ? rawReply.threadId : thread.threadId;
      const reply = createCommentThread({
        ...rawReply,
        threadId: replyThreadId,
        threadMetadataStatus: replyThreadMetadataStatus(rawReply),
        replyParent: rawReply?.replyParent ?? rawReply?.parentCommentId ?? thread.commentId,
      });
      registerDuplicateCommentIdAnomaly(reply, seenCommentIds, anomalies);
      registerThreadMetadataMissingAnomaly(reply, anomalies);
      if (threadOrphanReasons.length > 0) {
        orphanComments.push(createOrphanComment({
          commentId: reply.commentId,
          threadId: reply.threadId,
          content: reply.content,
          orphanReason: COMMENT_SURVIVAL_MINIMAL_KERNEL_REASON_CODES.PARENT_PLACEMENT_FAILED_ORPHANED,
          originalPlacementAttempt: placement,
          threadMetadata: threadMetadataView(reply),
          sourceViewState,
          authorHandle: reply.authorHandle,
          createdAtUTC: reply.createdAtUTC,
          resolvedDone: reply.resolvedDone,
        }));
        commentRecordHashes.push(recordHashRecord({
          commentId: reply.commentId,
          threadId: reply.threadId,
          state: 'ORPHANED',
          content: reply.content,
          resolvedDone: reply.resolvedDone,
          orphanReason: COMMENT_SURVIVAL_MINIMAL_KERNEL_REASON_CODES.PARENT_PLACEMENT_FAILED_ORPHANED,
        }));
      } else {
        commentThreads.push(reply);
        commentPlacements.push(createCommentPlacement({
          ...rawPlacement,
          commentId: reply.commentId,
          sourceState: placementSourceState(rawPlacement, sourceViewState),
        }));
        commentRecordHashes.push(recordHashRecord({
          commentId: reply.commentId,
          threadId: reply.threadId,
          state: 'PLACED',
          content: reply.content,
          resolvedDone: reply.resolvedDone,
        }));
      }
    }
  }

  const uniqueBlockedReasons = uniqueSorted(blockedReasons);
  const uniqueManualOnlyReasonCodes = uniqueSorted(manualOnlyReasonCodes);
  const decision = buildDecision(uniqueBlockedReasons);
  const ledger = createCommentEscrowLedger({
    sourceViewStateHash,
    commentCount: commentRecordHashes.length,
    placedCount: commentRecordHashes.length - orphanComments.length,
    orphanCount: orphanComments.length,
    anomalyCount: anomalies.length,
    commentRecordHashes,
  });

  return withCanonicalHash({
    resultKind: RESULT_KIND,
    contourId: CONTOUR_ID,
    outputDecision: decision.outputDecision,
    sourceViewState,
    blockedReasons: uniqueBlockedReasons,
    manualOnlyReasonCodes: uniqueManualOnlyReasonCodes,
    autoApplyCount: 0,
    runtimeApplyPerformed: false,
    userProjectMutated: false,
    productReceiptContinuationPerformed: false,
    decisions: [decision],
    commentThreads,
    commentPlacements,
    orphanComments,
    anomalies,
    ledger,
  });
}

export const runCommentSurvivalMinimalKernel = compileCommentSurvivalMinimalKernel;

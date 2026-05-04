import { canonicalHash } from './reviewIrKernel.mjs';

const RESULT_KIND = 'STAGE_05A_REVIEW_ANCHOR_HANDLE_PACKET_LOCAL_IDENTITY_RESULT_001';
const DECISION_KIND = 'STAGE_05A_REVIEW_ANCHOR_HANDLE_PACKET_LOCAL_IDENTITY_DECISION_001';
const CONTOUR_ID = 'STAGE05A_REVIEW_ANCHOR_HANDLE_PACKET_LOCAL_IDENTITY_001';
const HANDLE_KIND = 'ReviewAnchorHandlePacketLocalIdentity';

const ALLOWED_CHANGED_BASENAMES = new Set([
  'reviewAnchorHandleMinimalIdentity.mjs',
  'reviewAnchorHandleMinimalIdentity.contract.test.js',
  'STAGE05A_REVIEW_ANCHOR_HANDLE_PACKET_LOCAL_IDENTITY_001.md',
]);

const STRUCTURAL_KINDS = new Set(['MOVE', 'SPLIT', 'MERGE', 'STRUCTURAL']);
const ORPHAN_PLACEMENT_STATUSES = new Set(['LOST', 'DELETED', 'POSITION_DELETED', 'UNSUPPORTED']);

const DEFAULT_SOURCE_VIEW_STATE_SEED = Object.freeze({
  revisionToken: 'LOCAL_SYNTHETIC_REVISION',
  viewMode: 'LOCAL_SYNTHETIC_VIEW',
  normalizationPolicy: 'TEXT_V1',
  newlinePolicy: 'LF',
  unicodePolicy: 'NFC',
  artifactCompletenessClass: 'TEXT_ONLY',
});

export const REVIEW_ANCHOR_HANDLE_MINIMAL_IDENTITY_REASON_CODES = Object.freeze({
  FORBIDDEN_PROJECT_WRITE_CLAIM: 'FORBIDDEN_PROJECT_WRITE_CLAIM',
  FORBIDDEN_APPLYOP_CLAIM: 'FORBIDDEN_APPLYOP_CLAIM',
  FORBIDDEN_APPLYTXN_CLAIM: 'FORBIDDEN_APPLYTXN_CLAIM',
  FORBIDDEN_PROMOTION_TO_STABLE_BLOCK_ID_OR_PROJECT_TRUTH: 'FORBIDDEN_PROMOTION_TO_STABLE_BLOCK_ID_OR_PROJECT_TRUTH',
  FORBIDDEN_BASENAME_CHANGE: 'FORBIDDEN_BASENAME_CHANGE',
  MISSING_CHANGED_BASENAMES_EVIDENCE: 'MISSING_CHANGED_BASENAMES_EVIDENCE',
  MISSING_PROJECT_BINDING_EVIDENCE_BLOCKS_AUTOMATION: 'MISSING_PROJECT_BINDING_EVIDENCE_BLOCKS_AUTOMATION',
  STALE_BASELINE_MANUAL_ONLY_ZERO_ELIGIBILITY: 'STALE_BASELINE_MANUAL_ONLY_ZERO_ELIGIBILITY',
  DUPLICATE_HANDLE_REVIEW_BOM_ANOMALY: 'DUPLICATE_HANDLE_REVIEW_BOM_ANOMALY',
  DUPLICATE_SELECTOR_HASH_REVIEW_BOM_ANOMALY: 'DUPLICATE_SELECTOR_HASH_REVIEW_BOM_ANOMALY',
  MULTI_MATCH_MANUAL_ONLY: 'MULTI_MATCH_MANUAL_ONLY',
  POSITION_DELETED_ORPHAN_MANUAL_ONLY: 'POSITION_DELETED_ORPHAN_MANUAL_ONLY',
  ORPHAN_PACKET_LOCAL_HANDLE_NO_PLACEMENT_CLAIM: 'ORPHAN_PACKET_LOCAL_HANDLE_NO_PLACEMENT_CLAIM',
  THREAD_METADATA_MISSING_ANOMALY_NOT_DROP: 'THREAD_METADATA_MISSING_ANOMALY_NOT_DROP',
  STRUCTURAL_MOVE_SPLIT_MERGE_MANUAL_ONLY: 'STRUCTURAL_MOVE_SPLIT_MERGE_MANUAL_ONLY',
});

export const REVIEW_ANCHOR_HANDLE_AUTOMATION_POLICY = Object.freeze({
  AUTO_ELIGIBLE: 'AUTO_ELIGIBLE',
  MANUAL_ONLY: 'MANUAL_ONLY',
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

function upper(value, fallback = '') {
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

function threadMetadataStatus(thread) {
  if (!hasText(thread.threadId) || !hasText(thread.commentId)) {
    return 'MISSING';
  }
  if (hasText(thread.threadMetadataStatus)) {
    return upper(thread.threadMetadataStatus, 'OK');
  }
  return 'OK';
}

export function createReviewAnchorCommentThread(input = {}) {
  return withCanonicalHash({
    modelKind: 'ReviewAnchorCommentThread',
    threadId: hasText(input.threadId) ? input.threadId : '',
    commentId: hasText(input.commentId) ? input.commentId : '',
    content: cleanText(input.content ?? input.text ?? ''),
    authorHandle: hasText(input.authorHandle) ? input.authorHandle : '',
    createdAtUTC: hasText(input.createdAtUTC) ? input.createdAtUTC : '',
    threadMetadataStatus: threadMetadataStatus(input),
  });
}

function normalizeCandidateCount(value) {
  if (!Number.isInteger(value) || value < 0) {
    return 1;
  }
  return value;
}

function matchStatusForCandidateCount(candidateCount) {
  if (candidateCount === 0) {
    return 'NO_MATCH';
  }
  if (candidateCount === 1) {
    return 'EXACT';
  }
  return 'AMBIGUOUS';
}

export function createReviewAnchorCommentPlacement(input = {}, sourceViewState = {}) {
  const candidateCount = normalizeCandidateCount(input.candidateCount);
  const placementStatus = upper(input.placementStatus, 'SUPPORTED');
  const matchStatus = upper(input.matchStatus, matchStatusForCandidateCount(candidateCount));
  const placementId = hasText(input.placementId ?? input.anchorId) ? (input.placementId ?? input.anchorId) : '';
  const localPlacementClaimed = placementStatus === 'SUPPORTED' && candidateCount === 1 && hasText(placementId);

  return withCanonicalHash({
    modelKind: 'ReviewAnchorCommentPlacement',
    placementStatus,
    candidateCount,
    matchStatus,
    placementId,
    localPlacementClaimed,
    selectorKind: upper(input.selectorKind, 'TEXT_QUOTE'),
    selectorEvidence: isObject(input.selectorEvidence) ? input.selectorEvidence : {},
    sourceState: normalizeSourceViewState(input.sourceState || sourceViewState),
  });
}

function baselineIsStale(baseline = {}) {
  if (!isObject(baseline)) {
    return false;
  }
  if (baseline.stale === true || upper(baseline.status, '') === 'STALE') {
    return true;
  }
  if (
    hasText(baseline.expectedHash)
    && hasText(baseline.currentHash)
    && baseline.expectedHash !== baseline.currentHash
  ) {
    return true;
  }
  if (
    hasText(baseline.expectedRevisionToken)
    && hasText(baseline.currentRevisionToken)
    && baseline.expectedRevisionToken !== baseline.currentRevisionToken
  ) {
    return true;
  }
  return false;
}

function evidenceHashesForPacket(packet, thread, placement) {
  const source = isObject(packet.source) ? packet.source : {};
  const selector = isObject(packet.selector)
    ? packet.selector
    : {
        selectorKind: placement.selectorKind,
        selectorEvidence: placement.selectorEvidence,
      };
  const baseline = isObject(packet.baseline) ? packet.baseline : {};
  const projectBinding = isObject(packet.projectBinding) ? packet.projectBinding : {};

  const packetEvidencePayload = {
    packetId: hasText(packet.packetId) ? packet.packetId : '',
    packetToken: hasText(packet.packetToken) ? packet.packetToken : '',
    packetOrdinal: Number.isInteger(packet.packetOrdinal) ? packet.packetOrdinal : 0,
  };
  const sourceEvidencePayload = {
    sourceId: hasText(source.sourceId) ? source.sourceId : '',
    sourcePart: hasText(source.sourcePart) ? source.sourcePart : 'synthetic',
    sourceRevisionToken: hasText(source.sourceRevisionToken) ? source.sourceRevisionToken : '',
  };
  const selectorEvidencePayload = {
    selectorKind: upper(selector.selectorKind, placement.selectorKind || 'TEXT_QUOTE'),
    selectorEvidence: isObject(selector.selectorEvidence) ? selector.selectorEvidence : {},
  };
  const baselineEvidencePayload = {
    baselineId: hasText(baseline.baselineId) ? baseline.baselineId : '',
    expectedHash: hasText(baseline.expectedHash) ? baseline.expectedHash : '',
    currentHash: hasText(baseline.currentHash) ? baseline.currentHash : '',
    expectedRevisionToken: hasText(baseline.expectedRevisionToken) ? baseline.expectedRevisionToken : '',
    currentRevisionToken: hasText(baseline.currentRevisionToken) ? baseline.currentRevisionToken : '',
    stale: baselineIsStale(baseline),
  };

  return {
    packetEvidenceHash: hasText(packet.packetEvidenceHash)
      ? packet.packetEvidenceHash
      : canonicalHash(packetEvidencePayload),
    sourceEvidenceHash: hasText(source.sourceEvidenceHash)
      ? source.sourceEvidenceHash
      : canonicalHash(sourceEvidencePayload),
    selectorEvidenceHash: hasText(selector.selectorEvidenceHash)
      ? selector.selectorEvidenceHash
      : canonicalHash(selectorEvidencePayload),
    baselineEvidenceHash: hasText(baseline.baselineEvidenceHash)
      ? baseline.baselineEvidenceHash
      : canonicalHash(baselineEvidencePayload),
    projectBindingEvidenceHash: hasText(projectBinding.projectBindingEvidenceHash ?? projectBinding.evidenceHash)
      ? (projectBinding.projectBindingEvidenceHash ?? projectBinding.evidenceHash)
      : '',
    threadRef: {
      threadId: thread.threadId,
      commentId: thread.commentId,
    },
  };
}

function buildDecision(blockedReasons) {
  return withCanonicalHash({
    decisionKind: DECISION_KIND,
    contourId: CONTOUR_ID,
    outputDecision: blockedReasons.length > 0 ? 'REVIEW_ANCHOR_HANDLE_BLOCKED' : 'REVIEW_ANCHOR_HANDLE_COMPILED',
    blocked: blockedReasons.length > 0,
    blockedReasons,
  });
}

function pushForbiddenClaims(input, reasons) {
  if (!isObject(input)) {
    return;
  }
  if (input.projectWriteAttempted === true || input.projectWriteClaimed === true || input.projectTruthMutated === true) {
    reasons.push(REVIEW_ANCHOR_HANDLE_MINIMAL_IDENTITY_REASON_CODES.FORBIDDEN_PROJECT_WRITE_CLAIM);
  }
  if (input.applyOpRequested === true || input.applyOpClaimed === true || input.applyOpPerformed === true) {
    reasons.push(REVIEW_ANCHOR_HANDLE_MINIMAL_IDENTITY_REASON_CODES.FORBIDDEN_APPLYOP_CLAIM);
  }
  if (input.applyTxnRequested === true || input.applyTxnClaimed === true || input.applyTxnPerformed === true) {
    reasons.push(REVIEW_ANCHOR_HANDLE_MINIMAL_IDENTITY_REASON_CODES.FORBIDDEN_APPLYTXN_CLAIM);
  }
  if (
    input.promoteStableBlockIdentityRequested === true
    || input.promoteStableBlockIdentityClaimed === true
    || input.promoteProjectTruthRequested === true
    || input.promoteProjectTruthClaimed === true
  ) {
    reasons.push(
      REVIEW_ANCHOR_HANDLE_MINIMAL_IDENTITY_REASON_CODES.FORBIDDEN_PROMOTION_TO_STABLE_BLOCK_ID_OR_PROJECT_TRUTH,
    );
  }
}

function pushForbiddenBasenameReasons(input, reasons) {
  if (!Array.isArray(input?.changedBasenames)) {
    reasons.push(REVIEW_ANCHOR_HANDLE_MINIMAL_IDENTITY_REASON_CODES.MISSING_CHANGED_BASENAMES_EVIDENCE);
    return;
  }
  if (input.changedBasenames.some((basename) => !ALLOWED_CHANGED_BASENAMES.has(basename))) {
    reasons.push(REVIEW_ANCHOR_HANDLE_MINIMAL_IDENTITY_REASON_CODES.FORBIDDEN_BASENAME_CHANGE);
  }
}

function anomalyCodeCounts(anomalies) {
  const counts = {};
  for (const anomaly of anomalies) {
    const code = anomaly.anomalyCode;
    counts[code] = (counts[code] || 0) + 1;
  }
  return counts;
}

function buildReviewBom({ handles, anomalies }) {
  return withCanonicalHash({
    bomKind: 'ReviewAnchorHandleReviewBOM',
    contourId: CONTOUR_ID,
    packetCount: handles.length,
    autoEligibleCount: handles.filter((item) => item.applyEligible === 1).length,
    manualOnlyCount: handles.filter((item) => item.applyEligible === 0).length,
    orphanCount: handles.filter((item) => item.orphaned === true).length,
    anomalyCount: anomalies.length,
    anomalyCodeCounts: anomalyCodeCounts(anomalies),
    handleHashes: handles.map((item) => item.handleHash).sort(),
  });
}

export function compileReviewAnchorHandleMinimalIdentity(input = {}) {
  const sourceViewState = normalizeSourceViewState(input.sourceViewState);
  const blockedReasons = [];
  const manualOnlyReasonCodes = [];
  const anomalies = [];
  const handles = [];
  const commentThreads = [];
  const commentPlacements = [];
  const seenHandleHashes = new Map();
  const seenSelectorHashes = new Map();

  pushForbiddenClaims(input, blockedReasons);
  pushForbiddenBasenameReasons(input, blockedReasons);

  for (const rawPacket of asArray(input.packets)) {
    const thread = createReviewAnchorCommentThread(rawPacket.thread);
    const placement = createReviewAnchorCommentPlacement(rawPacket.placement, sourceViewState);

    commentThreads.push(thread);
    commentPlacements.push(placement);

    const evidenceHashes = evidenceHashesForPacket(rawPacket, thread, placement);
    const staleBaseline = baselineIsStale(rawPacket.baseline);
    const structuralKind = upper(rawPacket.structuralChangeKind, '');
    const orphaned = ORPHAN_PLACEMENT_STATUSES.has(placement.placementStatus) || placement.candidateCount === 0;
    const manualReasons = [];

    if (!hasText(evidenceHashes.projectBindingEvidenceHash)) {
      manualReasons.push(
        REVIEW_ANCHOR_HANDLE_MINIMAL_IDENTITY_REASON_CODES.MISSING_PROJECT_BINDING_EVIDENCE_BLOCKS_AUTOMATION,
      );
      blockedReasons.push(
        REVIEW_ANCHOR_HANDLE_MINIMAL_IDENTITY_REASON_CODES.MISSING_PROJECT_BINDING_EVIDENCE_BLOCKS_AUTOMATION,
      );
    }
    if (staleBaseline) {
      manualReasons.push(
        REVIEW_ANCHOR_HANDLE_MINIMAL_IDENTITY_REASON_CODES.STALE_BASELINE_MANUAL_ONLY_ZERO_ELIGIBILITY,
      );
    }
    if (placement.candidateCount > 1 || placement.matchStatus === 'AMBIGUOUS') {
      manualReasons.push(REVIEW_ANCHOR_HANDLE_MINIMAL_IDENTITY_REASON_CODES.MULTI_MATCH_MANUAL_ONLY);
    }
    if (placement.placementStatus === 'POSITION_DELETED') {
      manualReasons.push(REVIEW_ANCHOR_HANDLE_MINIMAL_IDENTITY_REASON_CODES.POSITION_DELETED_ORPHAN_MANUAL_ONLY);
    }
    if (STRUCTURAL_KINDS.has(structuralKind)) {
      manualReasons.push(REVIEW_ANCHOR_HANDLE_MINIMAL_IDENTITY_REASON_CODES.STRUCTURAL_MOVE_SPLIT_MERGE_MANUAL_ONLY);
    }
    if (orphaned) {
      manualReasons.push(REVIEW_ANCHOR_HANDLE_MINIMAL_IDENTITY_REASON_CODES.ORPHAN_PACKET_LOCAL_HANDLE_NO_PLACEMENT_CLAIM);
    }

    if (thread.threadMetadataStatus === 'MISSING') {
      anomalies.push(withCanonicalHash({
        anomalyCode: REVIEW_ANCHOR_HANDLE_MINIMAL_IDENTITY_REASON_CODES.THREAD_METADATA_MISSING_ANOMALY_NOT_DROP,
        packetId: hasText(rawPacket.packetId) ? rawPacket.packetId : '',
        threadId: thread.threadId,
        commentId: thread.commentId,
      }));
    }

    const coreHandle = {
      handleKind: HANDLE_KIND,
      contourId: CONTOUR_ID,
      packetId: hasText(rawPacket.packetId) ? rawPacket.packetId : '',
      packetEvidenceHash: evidenceHashes.packetEvidenceHash,
      sourceEvidenceHash: evidenceHashes.sourceEvidenceHash,
      selectorEvidenceHash: evidenceHashes.selectorEvidenceHash,
      baselineEvidenceHash: evidenceHashes.baselineEvidenceHash,
      projectBindingEvidenceHash: evidenceHashes.projectBindingEvidenceHash,
      threadRef: evidenceHashes.threadRef,
      placementRef: {
        placementStatus: placement.placementStatus,
        placementId: placement.placementId,
        localPlacementClaimed: orphaned ? false : placement.localPlacementClaimed,
      },
    };

    const handleHash = canonicalHash(coreHandle);
    const uniqueManualReasons = uniqueSorted(manualReasons);
    const manualOnly = uniqueManualReasons.length > 0;

    const compiledHandle = withCanonicalHash({
      ...coreHandle,
      handleHash,
      orphaned,
      manualOnly,
      manualReasonCodes: uniqueManualReasons,
      automationPolicy: manualOnly
        ? REVIEW_ANCHOR_HANDLE_AUTOMATION_POLICY.MANUAL_ONLY
        : REVIEW_ANCHOR_HANDLE_AUTOMATION_POLICY.AUTO_ELIGIBLE,
      applyEligible: manualOnly ? 0 : 1,
    });

    if (seenHandleHashes.has(handleHash)) {
      anomalies.push(withCanonicalHash({
        anomalyCode: REVIEW_ANCHOR_HANDLE_MINIMAL_IDENTITY_REASON_CODES.DUPLICATE_HANDLE_REVIEW_BOM_ANOMALY,
        handleHash,
        packetId: compiledHandle.packetId,
        duplicateOfPacketId: seenHandleHashes.get(handleHash),
      }));
    } else {
      seenHandleHashes.set(handleHash, compiledHandle.packetId);
    }

    if (seenSelectorHashes.has(compiledHandle.selectorEvidenceHash)) {
      anomalies.push(withCanonicalHash({
        anomalyCode: REVIEW_ANCHOR_HANDLE_MINIMAL_IDENTITY_REASON_CODES.DUPLICATE_SELECTOR_HASH_REVIEW_BOM_ANOMALY,
        selectorEvidenceHash: compiledHandle.selectorEvidenceHash,
        packetId: compiledHandle.packetId,
        duplicateOfPacketId: seenSelectorHashes.get(compiledHandle.selectorEvidenceHash),
      }));
    } else {
      seenSelectorHashes.set(compiledHandle.selectorEvidenceHash, compiledHandle.packetId);
    }

    manualOnlyReasonCodes.push(...uniqueManualReasons);
    handles.push(compiledHandle);
  }

  const uniqueBlockedReasons = uniqueSorted(blockedReasons);
  const uniqueManualOnlyReasonCodes = uniqueSorted(manualOnlyReasonCodes);
  const decision = buildDecision(uniqueBlockedReasons);
  const reviewBom = buildReviewBom({ handles, anomalies });

  return withCanonicalHash({
    resultKind: RESULT_KIND,
    contourId: CONTOUR_ID,
    outputDecision: decision.outputDecision,
    sourceViewState,
    blockedReasons: uniqueBlockedReasons,
    manualOnlyReasonCodes: uniqueManualOnlyReasonCodes,
    applyEligibilityCount: handles.reduce((sum, item) => sum + item.applyEligible, 0),
    applyOpPerformed: false,
    applyTxnPerformed: false,
    projectWritePerformed: false,
    promotedToProjectTruth: false,
    promotedToStableBlockIdentity: false,
    decisions: [decision],
    handles,
    commentThreads,
    commentPlacements,
    anomalies,
    reviewBom,
  });
}

export const runReviewAnchorHandleMinimalIdentity = compileReviewAnchorHandleMinimalIdentity;

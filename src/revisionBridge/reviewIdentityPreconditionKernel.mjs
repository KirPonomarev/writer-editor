import { canonicalHash } from './reviewIrKernel.mjs';

const RESULT_KIND = 'STAGE_05C_REVIEW_IDENTITY_PRECONDITION_KERNEL_RESULT_001';
const DECISION_KIND = 'STAGE_05C_REVIEW_IDENTITY_PRECONDITION_KERNEL_DECISION_001';
const CONTOUR_ID = 'STAGE05C_REVIEW_IDENTITY_PRECONDITION_KERNEL_001';
const PRECONDITION_KIND = 'ReviewIdentityPreconditionRef';

const ALLOWED_CHANGED_BASENAMES = new Set([
  'reviewIdentityPreconditionKernel.mjs',
  'reviewIdentityPreconditionKernel.contract.test.js',
  'STAGE05C_REVIEW_IDENTITY_PRECONDITION_KERNEL_001.md',
]);

const STRUCTURAL_KINDS = new Set(['MOVE', 'SPLIT', 'MERGE', 'STRUCTURAL']);

export const REVIEW_IDENTITY_PRECONDITION_REASON_CODES = Object.freeze({
  FORBIDDEN_BASENAME_CHANGE: 'FORBIDDEN_BASENAME_CHANGE',
  MISSING_CHANGED_BASENAMES_EVIDENCE: 'MISSING_CHANGED_BASENAMES_EVIDENCE',
  MISSING_PROJECT_ID_EVIDENCE_MANUAL_ONLY_ZERO_PRECONDITION_ELIGIBILITY:
    'MISSING_PROJECT_ID_EVIDENCE_MANUAL_ONLY_ZERO_PRECONDITION_ELIGIBILITY',
  MISSING_REVIEW_SCENE_REF_MANUAL_ONLY_ZERO_PRECONDITION_ELIGIBILITY:
    'MISSING_REVIEW_SCENE_REF_MANUAL_ONLY_ZERO_PRECONDITION_ELIGIBILITY',
  MISSING_TARGET_BLOCK_REF_MANUAL_ONLY_ZERO_PRECONDITION_ELIGIBILITY:
    'MISSING_TARGET_BLOCK_REF_MANUAL_ONLY_ZERO_PRECONDITION_ELIGIBILITY',
  MISSING_BLOCK_VERSION_HASH_MANUAL_ONLY_ZERO_PRECONDITION_ELIGIBILITY:
    'MISSING_BLOCK_VERSION_HASH_MANUAL_ONLY_ZERO_PRECONDITION_ELIGIBILITY',
  MISSING_SOURCE_ANCHOR_HANDLE_HASH_MANUAL_ONLY_ZERO_PRECONDITION_ELIGIBILITY:
    'MISSING_SOURCE_ANCHOR_HANDLE_HASH_MANUAL_ONLY_ZERO_PRECONDITION_ELIGIBILITY',
  STALE_BLOCK_VERSION_HASH_MANUAL_ONLY_ZERO_PRECONDITION_ELIGIBILITY:
    'STALE_BLOCK_VERSION_HASH_MANUAL_ONLY_ZERO_PRECONDITION_ELIGIBILITY',
  DUPLICATE_TARGET_BLOCK_REF_REVIEW_BOM_ANOMALY: 'DUPLICATE_TARGET_BLOCK_REF_REVIEW_BOM_ANOMALY',
  STRUCTURAL_MOVE_SPLIT_MERGE_MANUAL_ONLY: 'STRUCTURAL_MOVE_SPLIT_MERGE_MANUAL_ONLY',
  FORBIDDEN_STAGE05A_HANDLE_PROMOTION_TO_PROJECT_TRUTH:
    'FORBIDDEN_STAGE05A_HANDLE_PROMOTION_TO_PROJECT_TRUTH',
});

export const REVIEW_IDENTITY_PRECONDITION_AUTOMATION_POLICY = Object.freeze({
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

function upper(value, fallback = '') {
  return hasText(value) ? String(value).toUpperCase() : fallback;
}

function uniqueSorted(values) {
  return Array.from(new Set(values.filter(Boolean))).sort();
}

function isPromotionRequested(value) {
  return value === true || value === 'true';
}

function withCanonicalHash(core) {
  return {
    ...core,
    canonicalHash: canonicalHash(core),
  };
}

function pushForbiddenBasenameReasons(input, reasons) {
  if (!Array.isArray(input?.changedBasenames)) {
    reasons.push(REVIEW_IDENTITY_PRECONDITION_REASON_CODES.MISSING_CHANGED_BASENAMES_EVIDENCE);
    return;
  }
  if (input.changedBasenames.some((basename) => !ALLOWED_CHANGED_BASENAMES.has(basename))) {
    reasons.push(REVIEW_IDENTITY_PRECONDITION_REASON_CODES.FORBIDDEN_BASENAME_CHANGE);
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

function createDecision(blockedReasons) {
  return withCanonicalHash({
    decisionKind: DECISION_KIND,
    contourId: CONTOUR_ID,
    outputDecision:
      blockedReasons.length > 0
        ? 'REVIEW_IDENTITY_PRECONDITION_BLOCKED'
        : 'REVIEW_IDENTITY_PRECONDITION_COMPILED',
    blocked: blockedReasons.length > 0,
    blockedReasons,
  });
}

function buildReviewBom({ preconditions, anomalies }) {
  return withCanonicalHash({
    bomKind: 'ReviewIdentityPreconditionReviewBOM',
    contourId: CONTOUR_ID,
    preconditionCount: preconditions.length,
    preconditionEligibilityCount: preconditions.reduce((sum, item) => sum + item.preconditionEligibility, 0),
    manualOnlyCount: preconditions.filter((item) => item.preconditionEligibility === 0).length,
    anomalyCount: anomalies.length,
    anomalyCodeCounts: anomalyCodeCounts(anomalies),
    preconditionEvidenceHashes: preconditions.map((item) => item.preconditionEvidenceHash).sort(),
  });
}

function blockVersionIsStale(packet) {
  const currentBlockVersionHash = hasText(packet.currentBlockVersionHash)
    ? packet.currentBlockVersionHash
    : (hasText(packet.observedBlockVersionHash) ? packet.observedBlockVersionHash : '');
  return hasText(packet.blockVersionHash)
    && hasText(currentBlockVersionHash)
    && packet.blockVersionHash !== currentBlockVersionHash;
}

export function compileReviewIdentityPreconditionKernel(input = {}) {
  const blockedReasons = [];
  const manualOnlyReasonCodes = [];
  const preconditions = [];
  const anomalies = [];
  const seenTargetBlockRefs = new Map();
  const topLevelPromoteAnchorHandleToProjectTruthRequested = isPromotionRequested(
    input.promoteAnchorHandleToProjectTruthRequested,
  );
  const topLevelPromoteAnchorHandleToProjectTruthClaimed = isPromotionRequested(
    input.promoteAnchorHandleToProjectTruthClaimed,
  );

  pushForbiddenBasenameReasons(input, blockedReasons);
  if (topLevelPromoteAnchorHandleToProjectTruthRequested || topLevelPromoteAnchorHandleToProjectTruthClaimed) {
    blockedReasons.push(
      REVIEW_IDENTITY_PRECONDITION_REASON_CODES.FORBIDDEN_STAGE05A_HANDLE_PROMOTION_TO_PROJECT_TRUTH,
    );
  }

  for (const rawPacket of asArray(input.packets)) {
    const packet = isObject(rawPacket) ? rawPacket : {};
    const packetId = hasText(packet.packetId) ? packet.packetId : '';
    const reviewSceneRef = hasText(packet.reviewSceneRef) ? packet.reviewSceneRef : '';
    const targetBlockRef = hasText(packet.targetBlockRef) ? packet.targetBlockRef : '';
    const blockVersionHash = hasText(packet.blockVersionHash) ? packet.blockVersionHash : '';
    const projectIdEvidence = hasText(packet.projectIdEvidence)
      ? packet.projectIdEvidence
      : (hasText(input.projectIdEvidence) ? input.projectIdEvidence : '');
    const sourceAnchorHandleHash = hasText(packet.sourceAnchorHandleHash) ? packet.sourceAnchorHandleHash : '';
    const structuralKind = upper(packet.structuralChangeKind || packet.changeKind || packet.opKind, '');
    const promoteAnchorHandleToProjectTruthRequested = isPromotionRequested(
      packet.promoteAnchorHandleToProjectTruthRequested,
    );
    const promoteAnchorHandleToProjectTruthClaimed = isPromotionRequested(
      packet.promoteAnchorHandleToProjectTruthClaimed,
    );

    const manualReasons = [];
    if (!hasText(projectIdEvidence)) {
      manualReasons.push(
        REVIEW_IDENTITY_PRECONDITION_REASON_CODES.MISSING_PROJECT_ID_EVIDENCE_MANUAL_ONLY_ZERO_PRECONDITION_ELIGIBILITY,
      );
    }
    if (!hasText(reviewSceneRef)) {
      manualReasons.push(
        REVIEW_IDENTITY_PRECONDITION_REASON_CODES.MISSING_REVIEW_SCENE_REF_MANUAL_ONLY_ZERO_PRECONDITION_ELIGIBILITY,
      );
    }
    if (!hasText(targetBlockRef)) {
      manualReasons.push(
        REVIEW_IDENTITY_PRECONDITION_REASON_CODES.MISSING_TARGET_BLOCK_REF_MANUAL_ONLY_ZERO_PRECONDITION_ELIGIBILITY,
      );
    }
    if (!hasText(blockVersionHash)) {
      manualReasons.push(
        REVIEW_IDENTITY_PRECONDITION_REASON_CODES.MISSING_BLOCK_VERSION_HASH_MANUAL_ONLY_ZERO_PRECONDITION_ELIGIBILITY,
      );
    }
    if (!hasText(sourceAnchorHandleHash)) {
      manualReasons.push(
        REVIEW_IDENTITY_PRECONDITION_REASON_CODES.MISSING_SOURCE_ANCHOR_HANDLE_HASH_MANUAL_ONLY_ZERO_PRECONDITION_ELIGIBILITY,
      );
    }
    if (blockVersionIsStale(packet)) {
      manualReasons.push(
        REVIEW_IDENTITY_PRECONDITION_REASON_CODES.STALE_BLOCK_VERSION_HASH_MANUAL_ONLY_ZERO_PRECONDITION_ELIGIBILITY,
      );
    }
    if (STRUCTURAL_KINDS.has(structuralKind)) {
      manualReasons.push(REVIEW_IDENTITY_PRECONDITION_REASON_CODES.STRUCTURAL_MOVE_SPLIT_MERGE_MANUAL_ONLY);
    }
    if (promoteAnchorHandleToProjectTruthRequested || promoteAnchorHandleToProjectTruthClaimed) {
      blockedReasons.push(
        REVIEW_IDENTITY_PRECONDITION_REASON_CODES.FORBIDDEN_STAGE05A_HANDLE_PROMOTION_TO_PROJECT_TRUTH,
      );
    }

    const uniqueManualReasons = uniqueSorted(manualReasons);
    const preconditionEligibility = uniqueManualReasons.length > 0 ? 0 : 1;
    const automationPolicy = preconditionEligibility === 1
      ? REVIEW_IDENTITY_PRECONDITION_AUTOMATION_POLICY.AUTO_ELIGIBLE
      : REVIEW_IDENTITY_PRECONDITION_AUTOMATION_POLICY.MANUAL_ONLY;

    const preconditionEvidenceHash = hasText(packet.preconditionEvidenceHash)
      ? packet.preconditionEvidenceHash
      : canonicalHash({
          packetId,
          reviewSceneRef,
          targetBlockRef,
          blockVersionHash,
          projectIdEvidence,
          sourceAnchorHandleHash,
        });

    const compiledPrecondition = withCanonicalHash({
      preconditionKind: PRECONDITION_KIND,
      contourId: CONTOUR_ID,
      packetId,
      reviewSceneRef,
      targetBlockRef,
      blockVersionHash,
      sourceAnchorHandleHash,
      projectIdEvidence,
      preconditionEvidenceHash,
      automationPolicy,
      preconditionEligibility,
      manualReasonCodes: uniqueManualReasons,
      persistedSceneIdClaimed: false,
      persistedBlockIdClaimed: false,
    });

    if (hasText(targetBlockRef)) {
      if (seenTargetBlockRefs.has(targetBlockRef)) {
        anomalies.push(withCanonicalHash({
          anomalyCode: REVIEW_IDENTITY_PRECONDITION_REASON_CODES.DUPLICATE_TARGET_BLOCK_REF_REVIEW_BOM_ANOMALY,
          targetBlockRef,
          packetId,
          duplicateOfPacketId: seenTargetBlockRefs.get(targetBlockRef),
        }));
      } else {
        seenTargetBlockRefs.set(targetBlockRef, packetId);
      }
    }

    manualOnlyReasonCodes.push(...uniqueManualReasons);
    preconditions.push(compiledPrecondition);
  }

  const uniqueBlockedReasons = uniqueSorted(blockedReasons);
  const uniqueManualOnlyReasonCodes = uniqueSorted(manualOnlyReasonCodes);
  const decision = createDecision(uniqueBlockedReasons);
  const reviewBom = buildReviewBom({ preconditions, anomalies });

  return withCanonicalHash({
    resultKind: RESULT_KIND,
    contourId: CONTOUR_ID,
    outputDecision: decision.outputDecision,
    blockedReasons: uniqueBlockedReasons,
    manualOnlyReasonCodes: uniqueManualOnlyReasonCodes,
    preconditionEligibilityCount: preconditions.reduce((sum, item) => sum + item.preconditionEligibility, 0),
    projectWritePerformed: false,
    applyOpCreated: false,
    applyOpPerformed: false,
    applyTxnCreated: false,
    applyTxnPerformed: false,
    savedSceneFormatModified: false,
    persistedSceneIdClaimed: false,
    persistedBlockIdClaimed: false,
    decisions: [decision],
    preconditions,
    anomalies,
    reviewBom,
  });
}

export const runReviewIdentityPreconditionKernel = compileReviewIdentityPreconditionKernel;

import { canonicalHash } from './reviewIrKernel.mjs';

const RESULT_KIND = 'STAGE_05D_LOCAL_IDENTITY_EVIDENCE_ADMISSION_KERNEL_RESULT_001';
const DECISION_KIND = 'STAGE_05D_LOCAL_IDENTITY_EVIDENCE_ADMISSION_KERNEL_DECISION_001';
const CONTOUR_ID = 'STAGE05D_LOCAL_IDENTITY_EVIDENCE_ADMISSION_KERNEL_001';

const ALLOWED_CHANGED_BASENAMES = new Set([
  'localIdentityEvidenceAdmissionKernel.mjs',
  'localIdentityEvidenceAdmissionKernel.contract.test.js',
  'STAGE05D_LOCAL_IDENTITY_EVIDENCE_ADMISSION_KERNEL_001.md',
]);

const STRUCTURAL_KINDS = new Set(['MOVE', 'SPLIT', 'MERGE', 'STRUCTURAL']);

export const LOCAL_IDENTITY_EVIDENCE_ADMISSION_REASON_CODES = Object.freeze({
  FORBIDDEN_BASENAME_CHANGE: 'FORBIDDEN_BASENAME_CHANGE',
  MISSING_CHANGED_BASENAMES_EVIDENCE: 'MISSING_CHANGED_BASENAMES_EVIDENCE',
  MISSING_MANIFEST_PROJECT_ID_EVIDENCE: 'MISSING_MANIFEST_PROJECT_ID_EVIDENCE',
  MISSING_LOCAL_SCENE_ID_EVIDENCE: 'MISSING_LOCAL_SCENE_ID_EVIDENCE',
  REVIEW_SCENE_REF_NOT_PROJECT_SCENE_TRUTH: 'REVIEW_SCENE_REF_NOT_PROJECT_SCENE_TRUTH',
  MISSING_BLOCK_VERSION_HASH_EVIDENCE: 'MISSING_BLOCK_VERSION_HASH_EVIDENCE',
  BLOCK_INSTANCE_ID_UNPROVEN: 'BLOCK_INSTANCE_ID_UNPROVEN',
  BLOCK_LINEAGE_ID_UNPROVEN: 'BLOCK_LINEAGE_ID_UNPROVEN',
  TARGET_BLOCK_REF_NOT_PROJECT_TRUTH: 'TARGET_BLOCK_REF_NOT_PROJECT_TRUTH',
  SOURCE_ANCHOR_HANDLE_PACKET_LOCAL_ONLY: 'SOURCE_ANCHOR_HANDLE_PACKET_LOCAL_ONLY',
  FORBIDDEN_IDENTITY_PROMOTION_CLAIM: 'FORBIDDEN_IDENTITY_PROMOTION_CLAIM',
  STRUCTURAL_IDENTITY_CHANGE_MANUAL_ONLY: 'STRUCTURAL_IDENTITY_CHANGE_MANUAL_ONLY',
  STALE_IDENTITY_EVIDENCE_ZERO_READINESS: 'STALE_IDENTITY_EVIDENCE_ZERO_READINESS',
  IMPLICIT_STABLE_BLOCK_ID_FOUND_REQUIRES_OWNER_DECISION:
    'IMPLICIT_STABLE_BLOCK_ID_FOUND_REQUIRES_OWNER_DECISION',
});

export const LOCAL_IDENTITY_EVIDENCE_READINESS_CLASSES = Object.freeze({
  FUTURE_APPLYTXN_READINESS_ZERO: 'FUTURE_APPLYTXN_READINESS_ZERO',
  EXACT_TEXT_PREVIEW_CLASSIFICATION_ONLY: 'EXACT_TEXT_PREVIEW_CLASSIFICATION_ONLY',
  PRIVATE_GUARD_CLASSIFICATION_ONLY: 'PRIVATE_GUARD_CLASSIFICATION_ONLY',
  OWNER_DECISION_REQUIRED: 'OWNER_DECISION_REQUIRED',
});

export const LOCAL_IDENTITY_EVIDENCE_CLASSES = Object.freeze({
  PROJECT_MANIFEST_BOUND: 'PROJECT_MANIFEST_BOUND',
  LOCAL_SCENE_ID_EVIDENCE_PRESENT: 'LOCAL_SCENE_ID_EVIDENCE_PRESENT',
  REVIEW_SCENE_REF_ONLY: 'REVIEW_SCENE_REF_ONLY',
  BLOCK_VERSION_BOUND: 'BLOCK_VERSION_BOUND',
  BLOCK_INSTANCE_PROOF_PRESENT: 'BLOCK_INSTANCE_PROOF_PRESENT',
  BLOCK_INSTANCE_UNPROVEN: 'BLOCK_INSTANCE_UNPROVEN',
  BLOCK_LINEAGE_PROOF_PRESENT: 'BLOCK_LINEAGE_PROOF_PRESENT',
  BLOCK_LINEAGE_UNPROVEN: 'BLOCK_LINEAGE_UNPROVEN',
  PACKET_LOCAL_ONLY: 'PACKET_LOCAL_ONLY',
  UNSUPPORTED_IDENTITY_CLAIM: 'UNSUPPORTED_IDENTITY_CLAIM',
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

function isClaimed(value) {
  return value === true || value === 'true';
}

function withCanonicalHash(core) {
  return {
    ...core,
    canonicalHash: canonicalHash(core),
  };
}

function pushChangedBasenameReasons(input, reasons) {
  if (!Array.isArray(input?.changedBasenames)) {
    reasons.push(LOCAL_IDENTITY_EVIDENCE_ADMISSION_REASON_CODES.MISSING_CHANGED_BASENAMES_EVIDENCE);
    return;
  }
  if (input.changedBasenames.some((basename) => !ALLOWED_CHANGED_BASENAMES.has(basename))) {
    reasons.push(LOCAL_IDENTITY_EVIDENCE_ADMISSION_REASON_CODES.FORBIDDEN_BASENAME_CHANGE);
  }
}

function isStale(packet) {
  if (isClaimed(packet.staleIdentityEvidence)) {
    return true;
  }
  const expectedBlockVersionHash = hasText(packet.expectedBlockVersionHash)
    ? packet.expectedBlockVersionHash
    : packet.blockVersionHashEvidence;
  const currentBlockVersionHash = hasText(packet.currentBlockVersionHash)
    ? packet.currentBlockVersionHash
    : packet.observedBlockVersionHash;
  return hasText(expectedBlockVersionHash)
    && hasText(currentBlockVersionHash)
    && expectedBlockVersionHash !== currentBlockVersionHash;
}

function hasPromotionClaim(input, packet) {
  return [
    input.promoteIdentityEvidenceToProjectTruth,
    input.promoteAnchorHandleToProjectTruthRequested,
    input.promoteAnchorHandleToProjectTruthClaimed,
    input.persistedSceneIdClaimed,
    input.persistedBlockIdClaimed,
    input.createStableBlockIdentityClaimed,
    packet.promoteIdentityEvidenceToProjectTruth,
    packet.promoteAnchorHandleToProjectTruthRequested,
    packet.promoteAnchorHandleToProjectTruthClaimed,
    packet.persistedSceneIdClaimed,
    packet.persistedBlockIdClaimed,
    packet.createStableBlockIdentityClaimed,
  ].some(isClaimed);
}

function hasImplicitStableBlockIdClaim(input, packet) {
  return [
    input.implicitStableBlockIdClaimed,
    input.stableBlockIdClaimed,
    packet.implicitStableBlockIdClaimed,
    packet.stableBlockIdClaimed,
  ].some(isClaimed);
}

function anomalyCodeCounts(anomalies) {
  const counts = {};
  for (const anomaly of anomalies) {
    counts[anomaly.anomalyCode] = (counts[anomaly.anomalyCode] || 0) + 1;
  }
  return counts;
}

function createDecision(blockedReasons) {
  return withCanonicalHash({
    decisionKind: DECISION_KIND,
    contourId: CONTOUR_ID,
    outputDecision:
      blockedReasons.length > 0
        ? 'LOCAL_IDENTITY_EVIDENCE_ADMISSION_BLOCKED'
        : 'LOCAL_IDENTITY_EVIDENCE_ADMISSION_COMPILED',
    blocked: blockedReasons.length > 0,
    blockedReasons,
  });
}

function createOwnerDecisionPacket({ packets, gaps }) {
  const ownerDecisionGaps = gaps.filter((gap) => gap.ownerDecisionRequired);
  return withCanonicalHash({
    packetKind: 'LocalIdentityEvidenceOwnerDecisionPacket',
    contourId: CONTOUR_ID,
    ownerDecisionRequired: ownerDecisionGaps.length > 0,
    requestedDecisions: uniqueSorted(ownerDecisionGaps.map((gap) => gap.reasonCode)),
    packetIds: packets.map((packet) => packet.packetId).sort(),
  });
}

function buildReviewBom({ admissions, anomalies, gaps }) {
  return withCanonicalHash({
    bomKind: 'LocalIdentityEvidenceAdmissionReviewBOM',
    contourId: CONTOUR_ID,
    admissionCount: admissions.length,
    futureApplyTxnReadinessZeroCount: admissions.filter(
      (item) => item.futureApplyTxnReadiness === LOCAL_IDENTITY_EVIDENCE_READINESS_CLASSES.FUTURE_APPLYTXN_READINESS_ZERO,
    ).length,
    ownerDecisionRequiredCount: admissions.filter((item) => item.ownerDecisionRequired).length,
    anomalyCount: anomalies.length,
    gapCount: gaps.length,
    ownerDecisionGapCount: gaps.filter((gap) => gap.ownerDecisionRequired).length,
    anomalyCodeCounts: anomalyCodeCounts(anomalies),
    gapReasonCounts: anomalyCodeCounts(gaps.map((gap) => ({ anomalyCode: gap.reasonCode }))),
    identityEvidenceHashes: admissions.map((item) => item.identityEvidenceHash).sort(),
  });
}

function classifyPacket(input, rawPacket) {
  const packet = isObject(rawPacket) ? rawPacket : {};
  const packetId = hasText(packet.packetId) ? packet.packetId : '';
  const projectIdEvidence = hasText(packet.projectIdEvidence)
    ? packet.projectIdEvidence
    : (hasText(input.projectIdEvidence) ? input.projectIdEvidence : '');
  const manifestProjectIdEvidence = hasText(packet.manifestProjectIdEvidence)
    ? packet.manifestProjectIdEvidence
    : (hasText(input.manifestProjectIdEvidence) ? input.manifestProjectIdEvidence : '');
  const localSceneIdEvidence = hasText(packet.localSceneIdEvidence) ? packet.localSceneIdEvidence : '';
  const localSceneEvidenceHash = hasText(packet.localSceneEvidenceHash) ? packet.localSceneEvidenceHash : '';
  const reviewSceneRefEvidence = hasText(packet.reviewSceneRefEvidence) ? packet.reviewSceneRefEvidence : '';
  const targetBlockRefEvidence = hasText(packet.targetBlockRefEvidence) ? packet.targetBlockRefEvidence : '';
  const optionalBlockInstanceIdProof = hasText(packet.optionalBlockInstanceIdProof)
    ? packet.optionalBlockInstanceIdProof
    : '';
  const optionalBlockLineageIdProof = hasText(packet.optionalBlockLineageIdProof)
    ? packet.optionalBlockLineageIdProof
    : '';
  const blockVersionHashEvidence = hasText(packet.blockVersionHashEvidence)
    ? packet.blockVersionHashEvidence
    : (hasText(packet.blockVersionHash) ? packet.blockVersionHash : '');
  const sourceAnchorHandleHash = hasText(packet.sourceAnchorHandleHash) ? packet.sourceAnchorHandleHash : '';
  const reviewIdentityPreconditionEvidenceHash = hasText(packet.reviewIdentityPreconditionEvidenceHash)
    ? packet.reviewIdentityPreconditionEvidenceHash
    : '';
  const structuralKind = upper(packet.structuralChangeKind || packet.changeKind || packet.opKind, '');

  const reasonCodes = [];
  const identityEvidenceClasses = [];

  if (!hasText(projectIdEvidence) || !hasText(manifestProjectIdEvidence)) {
    reasonCodes.push(LOCAL_IDENTITY_EVIDENCE_ADMISSION_REASON_CODES.MISSING_MANIFEST_PROJECT_ID_EVIDENCE);
  } else {
    identityEvidenceClasses.push(LOCAL_IDENTITY_EVIDENCE_CLASSES.PROJECT_MANIFEST_BOUND);
  }

  if (!hasText(localSceneIdEvidence) || !hasText(localSceneEvidenceHash)) {
    reasonCodes.push(LOCAL_IDENTITY_EVIDENCE_ADMISSION_REASON_CODES.MISSING_LOCAL_SCENE_ID_EVIDENCE);
  } else {
    identityEvidenceClasses.push(LOCAL_IDENTITY_EVIDENCE_CLASSES.LOCAL_SCENE_ID_EVIDENCE_PRESENT);
  }

  if (hasText(reviewSceneRefEvidence)) {
    identityEvidenceClasses.push(LOCAL_IDENTITY_EVIDENCE_CLASSES.REVIEW_SCENE_REF_ONLY);
    if (!hasText(localSceneIdEvidence)) {
      reasonCodes.push(LOCAL_IDENTITY_EVIDENCE_ADMISSION_REASON_CODES.REVIEW_SCENE_REF_NOT_PROJECT_SCENE_TRUTH);
    }
  }

  if (!hasText(blockVersionHashEvidence)) {
    reasonCodes.push(LOCAL_IDENTITY_EVIDENCE_ADMISSION_REASON_CODES.MISSING_BLOCK_VERSION_HASH_EVIDENCE);
  } else {
    identityEvidenceClasses.push(LOCAL_IDENTITY_EVIDENCE_CLASSES.BLOCK_VERSION_BOUND);
  }

  if (!hasText(optionalBlockInstanceIdProof)) {
    reasonCodes.push(LOCAL_IDENTITY_EVIDENCE_ADMISSION_REASON_CODES.BLOCK_INSTANCE_ID_UNPROVEN);
    identityEvidenceClasses.push(LOCAL_IDENTITY_EVIDENCE_CLASSES.BLOCK_INSTANCE_UNPROVEN);
  } else {
    identityEvidenceClasses.push(LOCAL_IDENTITY_EVIDENCE_CLASSES.BLOCK_INSTANCE_PROOF_PRESENT);
  }

  if (!hasText(optionalBlockLineageIdProof)) {
    reasonCodes.push(LOCAL_IDENTITY_EVIDENCE_ADMISSION_REASON_CODES.BLOCK_LINEAGE_ID_UNPROVEN);
    identityEvidenceClasses.push(LOCAL_IDENTITY_EVIDENCE_CLASSES.BLOCK_LINEAGE_UNPROVEN);
  } else {
    identityEvidenceClasses.push(LOCAL_IDENTITY_EVIDENCE_CLASSES.BLOCK_LINEAGE_PROOF_PRESENT);
  }

  if (hasText(targetBlockRefEvidence) && !hasText(optionalBlockInstanceIdProof)) {
    reasonCodes.push(LOCAL_IDENTITY_EVIDENCE_ADMISSION_REASON_CODES.TARGET_BLOCK_REF_NOT_PROJECT_TRUTH);
  }

  if (hasText(sourceAnchorHandleHash)) {
    reasonCodes.push(LOCAL_IDENTITY_EVIDENCE_ADMISSION_REASON_CODES.SOURCE_ANCHOR_HANDLE_PACKET_LOCAL_ONLY);
    identityEvidenceClasses.push(LOCAL_IDENTITY_EVIDENCE_CLASSES.PACKET_LOCAL_ONLY);
  }

  if (hasPromotionClaim(input, packet)) {
    reasonCodes.push(LOCAL_IDENTITY_EVIDENCE_ADMISSION_REASON_CODES.FORBIDDEN_IDENTITY_PROMOTION_CLAIM);
    identityEvidenceClasses.push(LOCAL_IDENTITY_EVIDENCE_CLASSES.UNSUPPORTED_IDENTITY_CLAIM);
  }

  if (STRUCTURAL_KINDS.has(structuralKind)) {
    reasonCodes.push(LOCAL_IDENTITY_EVIDENCE_ADMISSION_REASON_CODES.STRUCTURAL_IDENTITY_CHANGE_MANUAL_ONLY);
  }

  if (isStale(packet)) {
    reasonCodes.push(LOCAL_IDENTITY_EVIDENCE_ADMISSION_REASON_CODES.STALE_IDENTITY_EVIDENCE_ZERO_READINESS);
  }

  if (hasImplicitStableBlockIdClaim(input, packet)) {
    reasonCodes.push(LOCAL_IDENTITY_EVIDENCE_ADMISSION_REASON_CODES.IMPLICIT_STABLE_BLOCK_ID_FOUND_REQUIRES_OWNER_DECISION);
    identityEvidenceClasses.push(LOCAL_IDENTITY_EVIDENCE_CLASSES.UNSUPPORTED_IDENTITY_CLAIM);
  }

  const uniqueReasonCodes = uniqueSorted(reasonCodes);
  const ownerDecisionReasonCodes = uniqueReasonCodes.filter((code) => [
    LOCAL_IDENTITY_EVIDENCE_ADMISSION_REASON_CODES.BLOCK_INSTANCE_ID_UNPROVEN,
    LOCAL_IDENTITY_EVIDENCE_ADMISSION_REASON_CODES.BLOCK_LINEAGE_ID_UNPROVEN,
    LOCAL_IDENTITY_EVIDENCE_ADMISSION_REASON_CODES.IMPLICIT_STABLE_BLOCK_ID_FOUND_REQUIRES_OWNER_DECISION,
  ].includes(code));
  const ownerDecisionRequired = ownerDecisionReasonCodes.length > 0;
  const futureApplyTxnReadiness = ownerDecisionRequired || uniqueReasonCodes.length > 0
    ? LOCAL_IDENTITY_EVIDENCE_READINESS_CLASSES.FUTURE_APPLYTXN_READINESS_ZERO
    : LOCAL_IDENTITY_EVIDENCE_READINESS_CLASSES.PRIVATE_GUARD_CLASSIFICATION_ONLY;
  const identityEvidenceCompletenessClass = uniqueReasonCodes.length === 0
    ? 'COMPLETE_FOR_PRIVATE_GUARD_CLASSIFICATION_ONLY'
    : 'INCOMPLETE_OR_REVIEW_ONLY';
  const identityEvidenceHash = canonicalHash({
    packetId,
    projectIdEvidence,
    manifestProjectIdEvidence,
    localSceneIdEvidence,
    localSceneEvidenceHash,
    reviewSceneRefEvidence,
    targetBlockRefEvidence,
    optionalBlockInstanceIdProof,
    optionalBlockLineageIdProof,
    blockVersionHashEvidence,
    sourceAnchorHandleHash,
    reviewIdentityPreconditionEvidenceHash,
  });

  return withCanonicalHash({
    admissionKind: 'LocalIdentityEvidenceAdmission',
    contourId: CONTOUR_ID,
    packetId,
    projectIdEvidence,
    manifestProjectIdEvidence,
    localSceneIdEvidence,
    localSceneEvidenceHash,
    reviewSceneRefEvidence,
    targetBlockRefEvidence,
    optionalBlockInstanceIdProof,
    optionalBlockLineageIdProof,
    blockVersionHashEvidence,
    sourceAnchorHandleHash,
    reviewIdentityPreconditionEvidenceHash,
    identityEvidenceHash,
    identityEvidenceClasses: uniqueSorted(identityEvidenceClasses),
    identityEvidenceCompletenessClass,
    futureApplyTxnReadiness,
    ownerDecisionRequired,
    ownerDecisionReasonCodes,
    reasonCodes: uniqueReasonCodes,
    projectStorageIdentityClaimed: false,
    persistedSceneIdClaimed: false,
    persistedBlockIdClaimed: false,
  });
}

export function compileLocalIdentityEvidenceAdmissionKernel(input = {}) {
  const blockedReasons = [];
  const anomalies = [];
  const admissions = [];
  const gaps = [];

  pushChangedBasenameReasons(input, blockedReasons);

  for (const rawPacket of asArray(input.packets)) {
    const admission = classifyPacket(input, rawPacket);
    admissions.push(admission);

    if (admission.reasonCodes.includes(
      LOCAL_IDENTITY_EVIDENCE_ADMISSION_REASON_CODES.FORBIDDEN_IDENTITY_PROMOTION_CLAIM,
    )) {
      blockedReasons.push(LOCAL_IDENTITY_EVIDENCE_ADMISSION_REASON_CODES.FORBIDDEN_IDENTITY_PROMOTION_CLAIM);
    }
    if (admission.reasonCodes.includes(
      LOCAL_IDENTITY_EVIDENCE_ADMISSION_REASON_CODES.IMPLICIT_STABLE_BLOCK_ID_FOUND_REQUIRES_OWNER_DECISION,
    )) {
      blockedReasons.push(
        LOCAL_IDENTITY_EVIDENCE_ADMISSION_REASON_CODES.IMPLICIT_STABLE_BLOCK_ID_FOUND_REQUIRES_OWNER_DECISION,
      );
    }

    for (const reasonCode of admission.reasonCodes) {
      gaps.push(withCanonicalHash({
        gapKind: 'LocalIdentityEvidenceGap',
        packetId: admission.packetId,
        reasonCode,
        ownerDecisionRequired: admission.ownerDecisionReasonCodes.includes(reasonCode),
      }));
    }
  }

  const uniqueBlockedReasons = uniqueSorted(blockedReasons);
  const decision = createDecision(uniqueBlockedReasons);
  const ownerDecisionPacket = createOwnerDecisionPacket({ packets: admissions, gaps });
  const reviewBom = buildReviewBom({ admissions, anomalies, gaps });

  return withCanonicalHash({
    resultKind: RESULT_KIND,
    contourId: CONTOUR_ID,
    outputDecision: decision.outputDecision,
    blockedReasons: uniqueBlockedReasons,
    futureApplyTxnReadiness:
      admissions.length > 0
      && admissions.every(
        (item) => item.futureApplyTxnReadiness
          === LOCAL_IDENTITY_EVIDENCE_READINESS_CLASSES.PRIVATE_GUARD_CLASSIFICATION_ONLY,
      )
        ? LOCAL_IDENTITY_EVIDENCE_READINESS_CLASSES.PRIVATE_GUARD_CLASSIFICATION_ONLY
        : LOCAL_IDENTITY_EVIDENCE_READINESS_CLASSES.FUTURE_APPLYTXN_READINESS_ZERO,
    projectWritePerformed: false,
    runtimeApplyPerformed: false,
    applyOpCreated: false,
    applyOpPerformed: false,
    applyTxnCreated: false,
    applyTxnPerformed: false,
    atomicWritePerformed: false,
    recoveryWritePerformed: false,
    storageMigrationPerformed: false,
    savedSceneFormatModified: false,
    projectStorageIdentityClaimed: false,
    persistedSceneIdClaimed: false,
    persistedBlockIdClaimed: false,
    blockIdentityCreated: false,
    decisions: [decision],
    admissions,
    anomalies,
    gaps,
    ownerDecisionPacket,
    reviewBom,
  });
}

export const runLocalIdentityEvidenceAdmissionKernel = compileLocalIdentityEvidenceAdmissionKernel;

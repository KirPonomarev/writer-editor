import { canonicalHash } from './reviewIrKernel.mjs';

const RESULT_KIND = 'STAGE_05E_BLOCK_IDENTITY_POLICY_GAP_CLASSIFIER_RESULT_001';
const DECISION_KIND = 'STAGE_05E_BLOCK_IDENTITY_POLICY_GAP_CLASSIFIER_DECISION_001';
const CONTOUR_ID = 'STAGE05E_BLOCK_IDENTITY_POLICY_GAP_CLASSIFIER_001';

const ALLOWED_CHANGED_BASENAMES = new Set([
  'blockIdentityPolicyGapClassifier.mjs',
  'blockIdentityPolicyGapClassifier.contract.test.js',
  'STAGE05E_BLOCK_IDENTITY_POLICY_GAP_CLASSIFIER_001.md',
]);

const STRUCTURAL_KINDS = new Set(['MOVE', 'SPLIT', 'MERGE', 'STRUCTURAL']);

export const BLOCK_IDENTITY_POLICY_GAP_REASON_CODES = Object.freeze({
  FORBIDDEN_BASENAME_CHANGE: 'FORBIDDEN_BASENAME_CHANGE',
  MISSING_CHANGED_BASENAMES_EVIDENCE: 'MISSING_CHANGED_BASENAMES_EVIDENCE',
  NO_STABLE_BLOCK_IDENTITY_AVAILABLE: 'NO_STABLE_BLOCK_IDENTITY_AVAILABLE',
  REVIEW_ANCHOR_HANDLE_NOT_PROJECT_TRUTH: 'REVIEW_ANCHOR_HANDLE_NOT_PROJECT_TRUTH',
  TARGET_BLOCK_REF_NOT_PROJECT_TRUTH: 'TARGET_BLOCK_REF_NOT_PROJECT_TRUTH',
  BLOCK_VERSION_HASH_GUARD_ONLY: 'BLOCK_VERSION_HASH_GUARD_ONLY',
  BLOCK_INSTANCE_PROOF_ADVISORY_ONLY: 'BLOCK_INSTANCE_PROOF_ADVISORY_ONLY',
  BLOCK_LINEAGE_PROOF_ADVISORY_ONLY: 'BLOCK_LINEAGE_PROOF_ADVISORY_ONLY',
  STRUCTURAL_POLICY_MANUAL_ONLY: 'STRUCTURAL_POLICY_MANUAL_ONLY',
  EXACT_TEXT_FUTURE_CONSUMER_ONLY: 'EXACT_TEXT_FUTURE_CONSUMER_ONLY',
  FORBIDDEN_BLOCK_IDENTITY_CREATION_CLAIM: 'FORBIDDEN_BLOCK_IDENTITY_CREATION_CLAIM',
  FORBIDDEN_APPLYTXN_PERMISSION_CLAIM: 'FORBIDDEN_APPLYTXN_PERMISSION_CLAIM',
  OWNER_DECISION_REQUIRED_FOR_PROJECT_TRUTH_POLICY: 'OWNER_DECISION_REQUIRED_FOR_PROJECT_TRUTH_POLICY',
});

export const BLOCK_IDENTITY_POLICY_CANDIDATE_MODES = Object.freeze({
  NO_STABLE_BLOCK_IDENTITY_AVAILABLE: 'NO_STABLE_BLOCK_IDENTITY_AVAILABLE',
  REVIEW_ANCHOR_HANDLE_PACKET_LOCAL_CANDIDATE_NOT_PROJECT_TRUTH:
    'REVIEW_ANCHOR_HANDLE_PACKET_LOCAL_CANDIDATE_NOT_PROJECT_TRUTH',
  LOCAL_SCENE_AND_BLOCK_VERSION_GUARD_ONLY: 'LOCAL_SCENE_AND_BLOCK_VERSION_GUARD_ONLY',
  EXTERNAL_BLOCK_INSTANCE_PROOF_ADVISORY_ONLY: 'EXTERNAL_BLOCK_INSTANCE_PROOF_ADVISORY_ONLY',
  BLOCK_LINEAGE_PROOF_ADVISORY_ONLY: 'BLOCK_LINEAGE_PROOF_ADVISORY_ONLY',
  UNSUPPORTED_PROJECT_TRUTH_CLAIM: 'UNSUPPORTED_PROJECT_TRUTH_CLAIM',
});

export const BLOCK_IDENTITY_POLICY_STAGE06_STATUSES = Object.freeze({
  FUTURE_STAGE06_APPLYTXN_BLOCKED: 'FUTURE_STAGE06_APPLYTXN_BLOCKED',
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

function isClaimed(value) {
  return value === true || value === 'true';
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

function pushChangedBasenameReasons(input, reasons) {
  if (!Array.isArray(input?.changedBasenames)) {
    reasons.push(BLOCK_IDENTITY_POLICY_GAP_REASON_CODES.MISSING_CHANGED_BASENAMES_EVIDENCE);
    return;
  }
  if (input.changedBasenames.some((basename) => !ALLOWED_CHANGED_BASENAMES.has(basename))) {
    reasons.push(BLOCK_IDENTITY_POLICY_GAP_REASON_CODES.FORBIDDEN_BASENAME_CHANGE);
  }
}

function hasBlockIdentityCreationClaim(input, candidate) {
  return [
    input.createBlockIdentityClaimed,
    input.createStableBlockIdentityClaimed,
    input.persistBlockIdentityClaimed,
    input.acceptCandidateAsProjectTruthClaimed,
    candidate.createBlockIdentityClaimed,
    candidate.createStableBlockIdentityClaimed,
    candidate.persistBlockIdentityClaimed,
    candidate.acceptCandidateAsProjectTruthClaimed,
  ].some(isClaimed);
}

function hasApplyTxnPermissionClaim(input, candidate) {
  return [
    input.applyTxnPermissionClaimed,
    input.stage06AdmissionClaimed,
    input.futureStage06ApplyTxnAllowedClaimed,
    candidate.applyTxnPermissionClaimed,
    candidate.stage06AdmissionClaimed,
    candidate.futureStage06ApplyTxnAllowedClaimed,
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
        ? 'BLOCK_IDENTITY_POLICY_GAP_CLASSIFIER_BLOCKED'
        : 'BLOCK_IDENTITY_POLICY_GAP_CLASSIFIER_COMPILED',
    blocked: blockedReasons.length > 0,
    blockedReasons,
  });
}

function createOwnerDecisionRequiredPacket({ classifications }) {
  const reasonCodes = uniqueSorted(
    classifications.flatMap((item) => item.ownerDecisionRequiredReasonCodes),
  );
  return withCanonicalHash({
    packetKind: 'BlockIdentityPolicyOwnerDecisionRequiredPacket',
    contourId: CONTOUR_ID,
    packetIsRequestOnly: true,
    ownerDecisionOutcomeClaimed: false,
    ownerDecisionRequired: reasonCodes.length > 0,
    requestedDecisions: reasonCodes,
    candidateIds: classifications.map((item) => item.candidateId).sort(),
  });
}

function createStage06BlockersPreview({ classifications, blockedReasons }) {
  const blockerCodes = uniqueSorted([
    ...blockedReasons,
    ...classifications.flatMap((item) => item.ownerDecisionRequiredReasonCodes),
    ...classifications.flatMap((item) => (
      item.reasonCodes.includes(BLOCK_IDENTITY_POLICY_GAP_REASON_CODES.NO_STABLE_BLOCK_IDENTITY_AVAILABLE)
        ? [BLOCK_IDENTITY_POLICY_GAP_REASON_CODES.NO_STABLE_BLOCK_IDENTITY_AVAILABLE]
        : []
    )),
  ]);
  return withCanonicalHash({
    packetKind: 'Stage06BlockersPreview',
    contourId: CONTOUR_ID,
    previewOnly: true,
    stage06AdmissionGranted: false,
    applyTxnPermissionGranted: false,
    futureStage06Status: BLOCK_IDENTITY_POLICY_STAGE06_STATUSES.FUTURE_STAGE06_APPLYTXN_BLOCKED,
    blockerCodes,
  });
}

function buildReviewBom({ classifications, gaps, anomalies }) {
  return withCanonicalHash({
    bomKind: 'BlockIdentityPolicyGapReviewBOM',
    contourId: CONTOUR_ID,
    classificationCount: classifications.length,
    gapCount: gaps.length,
    advisoryCandidateCount: classifications.filter((item) => item.classification === 'ADVISORY_ONLY').length,
    blockedCandidateCount: classifications.filter((item) => item.classification === 'BLOCKED').length,
    acceptedProjectTruthCount: 0,
    anomalyCount: anomalies.length,
    anomalyCodeCounts: anomalyCodeCounts(anomalies),
    gapReasonCounts: anomalyCodeCounts(gaps.map((gap) => ({ anomalyCode: gap.reasonCode }))),
    policyGapHashes: classifications.map((item) => item.policyGapHash).sort(),
  });
}

function classifyCandidate(input, rawCandidate = {}) {
  const candidate = isObject(rawCandidate) ? rawCandidate : {};
  const candidateId = hasText(candidate.candidateId) ? candidate.candidateId : '';
  const candidateProofMode = hasText(candidate.candidateProofMode)
    ? candidate.candidateProofMode
    : BLOCK_IDENTITY_POLICY_CANDIDATE_MODES.NO_STABLE_BLOCK_IDENTITY_AVAILABLE;
  const reviewAnchorHandleHash = hasText(candidate.reviewAnchorHandleHash)
    ? candidate.reviewAnchorHandleHash
    : (hasText(candidate.sourceAnchorHandleHash) ? candidate.sourceAnchorHandleHash : '');
  const targetBlockRef = hasText(candidate.targetBlockRef) ? candidate.targetBlockRef : '';
  const blockVersionHash = hasText(candidate.blockVersionHash)
    ? candidate.blockVersionHash
    : (hasText(candidate.blockVersionHashEvidence) ? candidate.blockVersionHashEvidence : '');
  const externalBlockInstanceProof = hasText(candidate.externalBlockInstanceProof)
    ? candidate.externalBlockInstanceProof
    : (hasText(candidate.optionalBlockInstanceIdProof) ? candidate.optionalBlockInstanceIdProof : '');
  const blockLineageProof = hasText(candidate.blockLineageProof)
    ? candidate.blockLineageProof
    : (hasText(candidate.optionalBlockLineageIdProof) ? candidate.optionalBlockLineageIdProof : '');
  const structuralKind = upper(candidate.structuralChangeKind || candidate.changeKind || candidate.opKind, '');
  const exactTextConsumerClaimed = isClaimed(candidate.exactTextConsumerClaimed)
    || upper(candidate.consumerKind, '') === 'EXACT_TEXT';

  const reasonCodes = [];
  const candidateModes = [];
  const ownerDecisionRequiredReasonCodes = [];

  reasonCodes.push(BLOCK_IDENTITY_POLICY_GAP_REASON_CODES.NO_STABLE_BLOCK_IDENTITY_AVAILABLE);
  candidateModes.push(BLOCK_IDENTITY_POLICY_CANDIDATE_MODES.NO_STABLE_BLOCK_IDENTITY_AVAILABLE);

  if (hasText(reviewAnchorHandleHash)) {
    reasonCodes.push(BLOCK_IDENTITY_POLICY_GAP_REASON_CODES.REVIEW_ANCHOR_HANDLE_NOT_PROJECT_TRUTH);
    candidateModes.push(
      BLOCK_IDENTITY_POLICY_CANDIDATE_MODES.REVIEW_ANCHOR_HANDLE_PACKET_LOCAL_CANDIDATE_NOT_PROJECT_TRUTH,
    );
  }

  if (hasText(targetBlockRef)) {
    reasonCodes.push(BLOCK_IDENTITY_POLICY_GAP_REASON_CODES.TARGET_BLOCK_REF_NOT_PROJECT_TRUTH);
  }

  if (hasText(blockVersionHash)) {
    reasonCodes.push(BLOCK_IDENTITY_POLICY_GAP_REASON_CODES.BLOCK_VERSION_HASH_GUARD_ONLY);
    candidateModes.push(BLOCK_IDENTITY_POLICY_CANDIDATE_MODES.LOCAL_SCENE_AND_BLOCK_VERSION_GUARD_ONLY);
  }

  if (hasText(externalBlockInstanceProof)) {
    reasonCodes.push(BLOCK_IDENTITY_POLICY_GAP_REASON_CODES.BLOCK_INSTANCE_PROOF_ADVISORY_ONLY);
    candidateModes.push(BLOCK_IDENTITY_POLICY_CANDIDATE_MODES.EXTERNAL_BLOCK_INSTANCE_PROOF_ADVISORY_ONLY);
    ownerDecisionRequiredReasonCodes.push(
      BLOCK_IDENTITY_POLICY_GAP_REASON_CODES.OWNER_DECISION_REQUIRED_FOR_PROJECT_TRUTH_POLICY,
    );
  }

  if (hasText(blockLineageProof)) {
    reasonCodes.push(BLOCK_IDENTITY_POLICY_GAP_REASON_CODES.BLOCK_LINEAGE_PROOF_ADVISORY_ONLY);
    candidateModes.push(BLOCK_IDENTITY_POLICY_CANDIDATE_MODES.BLOCK_LINEAGE_PROOF_ADVISORY_ONLY);
    ownerDecisionRequiredReasonCodes.push(
      BLOCK_IDENTITY_POLICY_GAP_REASON_CODES.OWNER_DECISION_REQUIRED_FOR_PROJECT_TRUTH_POLICY,
    );
  }

  if (STRUCTURAL_KINDS.has(structuralKind)) {
    reasonCodes.push(BLOCK_IDENTITY_POLICY_GAP_REASON_CODES.STRUCTURAL_POLICY_MANUAL_ONLY);
  }

  if (exactTextConsumerClaimed) {
    reasonCodes.push(BLOCK_IDENTITY_POLICY_GAP_REASON_CODES.EXACT_TEXT_FUTURE_CONSUMER_ONLY);
  }

  if (hasBlockIdentityCreationClaim(input, candidate)) {
    reasonCodes.push(BLOCK_IDENTITY_POLICY_GAP_REASON_CODES.FORBIDDEN_BLOCK_IDENTITY_CREATION_CLAIM);
    candidateModes.push(BLOCK_IDENTITY_POLICY_CANDIDATE_MODES.UNSUPPORTED_PROJECT_TRUTH_CLAIM);
  }

  if (hasApplyTxnPermissionClaim(input, candidate)) {
    reasonCodes.push(BLOCK_IDENTITY_POLICY_GAP_REASON_CODES.FORBIDDEN_APPLYTXN_PERMISSION_CLAIM);
    candidateModes.push(BLOCK_IDENTITY_POLICY_CANDIDATE_MODES.UNSUPPORTED_PROJECT_TRUTH_CLAIM);
  }

  const uniqueReasonCodes = uniqueSorted(reasonCodes);
  const uniqueOwnerDecisionReasons = uniqueSorted(ownerDecisionRequiredReasonCodes);
  const blocked = uniqueReasonCodes.some((code) => [
    BLOCK_IDENTITY_POLICY_GAP_REASON_CODES.FORBIDDEN_BLOCK_IDENTITY_CREATION_CLAIM,
    BLOCK_IDENTITY_POLICY_GAP_REASON_CODES.FORBIDDEN_APPLYTXN_PERMISSION_CLAIM,
  ].includes(code));
  const policyGapHash = canonicalHash({
    candidateId,
    candidateProofMode,
    reviewAnchorHandleHash,
    targetBlockRef,
    blockVersionHash,
    externalBlockInstanceProof,
    blockLineageProof,
    structuralKind,
    exactTextConsumerClaimed,
    reasonCodes: uniqueReasonCodes,
  });

  return withCanonicalHash({
    classificationKind: 'BlockIdentityPolicyGapClassification',
    contourId: CONTOUR_ID,
    candidateId,
    candidateProofMode,
    candidateModes: uniqueSorted(candidateModes),
    classification: blocked ? 'BLOCKED' : 'ADVISORY_ONLY',
    acceptedAsProjectTruth: false,
    acceptedPolicyMode: false,
    projectTruthPolicyAccepted: false,
    ownerDecisionRequired: uniqueOwnerDecisionReasons.length > 0,
    ownerDecisionRequiredReasonCodes: uniqueOwnerDecisionReasons,
    futureStage06Status: BLOCK_IDENTITY_POLICY_STAGE06_STATUSES.FUTURE_STAGE06_APPLYTXN_BLOCKED,
    stage06AdmissionGranted: false,
    applyTxnPermissionGranted: false,
    exactTextCurrentApplyPath: false,
    reviewAnchorHandleProjectTruthClaimed: false,
    targetBlockRefProjectTruthClaimed: false,
    blockVersionHashIdentityClaimed: false,
    projectBlockIdentityCreated: false,
    policyGapHash,
    reasonCodes: uniqueReasonCodes,
  });
}

export function compileBlockIdentityPolicyGapClassifier(input = {}) {
  const blockedReasons = [];
  const classifications = [];
  const gaps = [];
  const anomalies = [];

  pushChangedBasenameReasons(input, blockedReasons);

  for (const rawCandidate of asArray(input.candidates)) {
    const classification = classifyCandidate(input, rawCandidate);
    classifications.push(classification);

    if (classification.reasonCodes.includes(
      BLOCK_IDENTITY_POLICY_GAP_REASON_CODES.FORBIDDEN_BLOCK_IDENTITY_CREATION_CLAIM,
    )) {
      blockedReasons.push(BLOCK_IDENTITY_POLICY_GAP_REASON_CODES.FORBIDDEN_BLOCK_IDENTITY_CREATION_CLAIM);
    }
    if (classification.reasonCodes.includes(
      BLOCK_IDENTITY_POLICY_GAP_REASON_CODES.FORBIDDEN_APPLYTXN_PERMISSION_CLAIM,
    )) {
      blockedReasons.push(BLOCK_IDENTITY_POLICY_GAP_REASON_CODES.FORBIDDEN_APPLYTXN_PERMISSION_CLAIM);
    }

    for (const reasonCode of classification.reasonCodes) {
      gaps.push(withCanonicalHash({
        gapKind: 'BlockIdentityPolicyGap',
        candidateId: classification.candidateId,
        reasonCode,
        ownerDecisionRequired: classification.ownerDecisionRequiredReasonCodes.includes(reasonCode),
      }));
    }
  }

  const uniqueBlockedReasons = uniqueSorted(blockedReasons);
  const decision = createDecision(uniqueBlockedReasons);
  const ownerDecisionRequiredPacket = createOwnerDecisionRequiredPacket({ classifications });
  const stage06BlockersPreview = createStage06BlockersPreview({ classifications, blockedReasons: uniqueBlockedReasons });
  const reviewBom = buildReviewBom({ classifications, gaps, anomalies });

  return withCanonicalHash({
    resultKind: RESULT_KIND,
    contourId: CONTOUR_ID,
    outputDecision: decision.outputDecision,
    blockedReasons: uniqueBlockedReasons,
    futureStage06Status: BLOCK_IDENTITY_POLICY_STAGE06_STATUSES.FUTURE_STAGE06_APPLYTXN_BLOCKED,
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
    policyAcceptedAsProjectTruth: false,
    stage06AdmissionGranted: false,
    applyTxnPermissionGranted: false,
    ownerDecisionOutcomeClaimed: false,
    decisions: [decision],
    classifications,
    gaps,
    anomalies,
    ownerDecisionRequiredPacket,
    stage06BlockersPreview,
    reviewBom,
  });
}

export const runBlockIdentityPolicyGapClassifier = compileBlockIdentityPolicyGapClassifier;

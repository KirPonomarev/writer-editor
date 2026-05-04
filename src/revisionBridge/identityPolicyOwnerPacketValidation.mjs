import { canonicalHash } from './reviewIrKernel.mjs';

const RESULT_KIND = 'STAGE_05L_OWNER_POLICY_PACKET_VALIDATION_RESULT_001';
const DECISION_KIND = 'STAGE_05L_OWNER_POLICY_PACKET_VALIDATION_DECISION_001';
const CONTOUR_ID = 'STAGE05L_OWNER_POLICY_PACKET_VALIDATION_ONLY_001';
const EXPECTED_PACKET_KIND = 'STAGE05L_OWNER_POLICY_PACKET_001';
const EXPECTED_PACKET_TARGET = CONTOUR_ID;

const ALLOWED_CHANGED_BASENAMES = new Set([
  'identityPolicyOwnerPacketValidation.mjs',
  'identityPolicyOwnerPacketValidation.contract.test.js',
  'STAGE05L_OWNER_POLICY_PACKET_VALIDATION_ONLY_001.md',
]);

const ALLOWED_ASSERTION_CLASSES = new Set([
  'STABLE_BLOCK_INSTANCE_ID_POLICY_PREFERENCE',
  'STABLE_BLOCK_LINEAGE_ID_POLICY_PREFERENCE',
  'REVIEW_ANCHOR_HANDLE_LIMIT_PREFERENCE',
  'STRUCTURAL_MANUAL_ONLY_CONFIRMATION',
  'UNKNOWN_POLICY_GAP_FOR_FUTURE_REVIEW',
]);

const TRACE_ONLY_ASSERTION_CLASSES = new Set([
  'STABLE_SCENE_ID_POLICY_PREFERENCE',
]);

const OWNER_PACKET_ALLOWED_KEYS = new Set([
  'packetKind',
  'packetTarget',
  'ownerDecisionId',
  'stage05kResultHash',
  'stage05kDecisionHash',
  'ownerAssertions',
  'ownerUnderstandsEvidenceOnly',
  'ownerUnderstandsNoProjectTruth',
  'ownerUnderstandsNoStage05ExitReady',
  'ownerUnderstandsNoStage06',
  'ownerUnderstandsNoApplyTxn',
  'ownerUnderstandsNoStorageMigration',
  'ownerPolicyAcceptedClaimed',
  'policyAcceptanceClaimed',
  'projectTruthAcceptedClaimed',
  'projectTruthPolicyAcceptedClaimed',
  'stage05ExitReadyClaimed',
  'identityPolicyReadyClaimed',
  'stage06PermissionClaimed',
  'stage06AdmissionClaimed',
  'stage06PreAdmittedClaimed',
  'stage06PreAdmissionClaimed',
  'applyTxnClaimed',
  'applyTxnAllowedClaimed',
  'applyTxnCreatedClaimed',
  'storageMigrationClaimed',
  'storageMutationClaimed',
  'projectWriteClaimed',
  'projectWritePerformedClaimed',
  'stableIdCreationClaimed',
  'stableBlockInstanceIdCreatedClaimed',
  'persistStableBlockInstanceIdClaimed',
  'blockLineageCreatedClaimed',
  'blockLineagePersistedClaimed',
  'createBlockLineageClaimed',
  'reviewAnchorPromotedClaimed',
  'reviewAnchorHandlePromotedClaimed',
  'structuralAutoApplyClaimed',
  'moveSplitMergeAutoApplyClaimed',
  'uiClaimed',
  'docxClaimed',
  'networkClaimed',
  'dependencyChangeClaimed',
]);

const OWNER_ASSERTION_ALLOWED_KEYS = new Set([
  'assertionId',
  'assertionClass',
  'kind',
  'type',
  'ownerPolicyAcceptedClaimed',
  'policyAcceptanceClaimed',
  'projectTruthAcceptedClaimed',
  'projectTruthPolicyAcceptedClaimed',
  'stage05ExitReadyClaimed',
  'identityPolicyReadyClaimed',
  'stage06PermissionClaimed',
  'stage06AdmissionClaimed',
  'stage06PreAdmittedClaimed',
  'stage06PreAdmissionClaimed',
  'applyTxnClaimed',
  'applyTxnAllowedClaimed',
  'applyTxnCreatedClaimed',
  'storageMigrationClaimed',
  'storageMutationClaimed',
  'projectWriteClaimed',
  'projectWritePerformedClaimed',
  'stableIdCreationClaimed',
  'stableBlockInstanceIdCreatedClaimed',
  'persistStableBlockInstanceIdClaimed',
  'blockLineageCreatedClaimed',
  'blockLineagePersistedClaimed',
  'createBlockLineageClaimed',
  'reviewAnchorPromotedClaimed',
  'reviewAnchorHandlePromotedClaimed',
  'structuralAutoApplyClaimed',
  'moveSplitMergeAutoApplyClaimed',
  'uiClaimed',
  'docxClaimed',
  'networkClaimed',
  'dependencyChangeClaimed',
]);

const BLOCKING_REASON_CODES = new Set([
  'MISSING_CHANGED_BASENAMES_EVIDENCE',
  'FORBIDDEN_BASENAME_CHANGE',
  'MISSING_STAGE05K_RESULT_HASH',
  'MISSING_STAGE05K_DECISION_HASH',
  'STALE_STAGE05K_RESULT_HASH',
  'STALE_STAGE05K_DECISION_HASH',
  'MISSING_OWNER_POLICY_PACKET',
  'WRONG_OWNER_POLICY_PACKET_TARGET',
  'MISSING_OWNER_DECISION_ID',
  'MISSING_OWNER_ASSERTIONS',
  'AMBIGUOUS_OWNER_ASSERTION',
  'UNKNOWN_OWNER_ASSERTION_CLASS',
  'FORBIDDEN_OWNER_POLICY_ACCEPTANCE_CLAIM',
  'FORBIDDEN_PROJECT_TRUTH_ACCEPTANCE_CLAIM',
  'FORBIDDEN_STAGE05_EXIT_READY_CLAIM',
  'FORBIDDEN_STAGE06_PERMISSION_CLAIM',
  'FORBIDDEN_STAGE06_PRE_ADMISSION_CLAIM',
  'FORBIDDEN_APPLYTXN_CLAIM',
  'FORBIDDEN_STORAGE_MIGRATION_CLAIM',
  'FORBIDDEN_PROJECT_WRITE_CLAIM',
  'FORBIDDEN_STABLE_ID_CREATION_CLAIM',
  'FORBIDDEN_LINEAGE_CREATION_CLAIM',
  'FORBIDDEN_REVIEW_ANCHOR_PROMOTION_CLAIM',
  'FORBIDDEN_STRUCTURAL_AUTO_APPLY_CLAIM',
  'FORBIDDEN_UI_DOCX_NETWORK_DEPENDENCY_CLAIM',
  'OWNER_POLICY_PACKET_UNKNOWN_FIELD_FORBIDDEN',
  'CALLABLE_FIELD_FORBIDDEN',
  'USER_PROJECT_PATH_FORBIDDEN',
  'OWNER_UNDERSTANDING_FLAG_MISSING',
]);

export const IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES = Object.freeze({
  FORBIDDEN_BASENAME_CHANGE: 'FORBIDDEN_BASENAME_CHANGE',
  MISSING_CHANGED_BASENAMES_EVIDENCE: 'MISSING_CHANGED_BASENAMES_EVIDENCE',
  MISSING_STAGE05K_RESULT_HASH: 'MISSING_STAGE05K_RESULT_HASH',
  MISSING_STAGE05K_DECISION_HASH: 'MISSING_STAGE05K_DECISION_HASH',
  STALE_STAGE05K_RESULT_HASH: 'STALE_STAGE05K_RESULT_HASH',
  STALE_STAGE05K_DECISION_HASH: 'STALE_STAGE05K_DECISION_HASH',
  MISSING_OWNER_POLICY_PACKET: 'MISSING_OWNER_POLICY_PACKET',
  WRONG_OWNER_POLICY_PACKET_TARGET: 'WRONG_OWNER_POLICY_PACKET_TARGET',
  MISSING_OWNER_DECISION_ID: 'MISSING_OWNER_DECISION_ID',
  MISSING_OWNER_ASSERTIONS: 'MISSING_OWNER_ASSERTIONS',
  AMBIGUOUS_OWNER_ASSERTION: 'AMBIGUOUS_OWNER_ASSERTION',
  UNKNOWN_OWNER_ASSERTION_CLASS: 'UNKNOWN_OWNER_ASSERTION_CLASS',
  SCENE_IDENTITY_TRACE_ONLY_NOT_ACCEPTED: 'SCENE_IDENTITY_TRACE_ONLY_NOT_ACCEPTED',
  OWNER_ASSERTION_RECORDED_AS_EVIDENCE_ONLY: 'OWNER_ASSERTION_RECORDED_AS_EVIDENCE_ONLY',
  FORBIDDEN_OWNER_POLICY_ACCEPTANCE_CLAIM: 'FORBIDDEN_OWNER_POLICY_ACCEPTANCE_CLAIM',
  FORBIDDEN_PROJECT_TRUTH_ACCEPTANCE_CLAIM: 'FORBIDDEN_PROJECT_TRUTH_ACCEPTANCE_CLAIM',
  FORBIDDEN_STAGE05_EXIT_READY_CLAIM: 'FORBIDDEN_STAGE05_EXIT_READY_CLAIM',
  FORBIDDEN_STAGE06_PERMISSION_CLAIM: 'FORBIDDEN_STAGE06_PERMISSION_CLAIM',
  FORBIDDEN_STAGE06_PRE_ADMISSION_CLAIM: 'FORBIDDEN_STAGE06_PRE_ADMISSION_CLAIM',
  FORBIDDEN_APPLYTXN_CLAIM: 'FORBIDDEN_APPLYTXN_CLAIM',
  FORBIDDEN_STORAGE_MIGRATION_CLAIM: 'FORBIDDEN_STORAGE_MIGRATION_CLAIM',
  FORBIDDEN_PROJECT_WRITE_CLAIM: 'FORBIDDEN_PROJECT_WRITE_CLAIM',
  FORBIDDEN_STABLE_ID_CREATION_CLAIM: 'FORBIDDEN_STABLE_ID_CREATION_CLAIM',
  FORBIDDEN_LINEAGE_CREATION_CLAIM: 'FORBIDDEN_LINEAGE_CREATION_CLAIM',
  FORBIDDEN_REVIEW_ANCHOR_PROMOTION_CLAIM: 'FORBIDDEN_REVIEW_ANCHOR_PROMOTION_CLAIM',
  FORBIDDEN_STRUCTURAL_AUTO_APPLY_CLAIM: 'FORBIDDEN_STRUCTURAL_AUTO_APPLY_CLAIM',
  FORBIDDEN_UI_DOCX_NETWORK_DEPENDENCY_CLAIM: 'FORBIDDEN_UI_DOCX_NETWORK_DEPENDENCY_CLAIM',
  OWNER_POLICY_PACKET_UNKNOWN_FIELD_FORBIDDEN: 'OWNER_POLICY_PACKET_UNKNOWN_FIELD_FORBIDDEN',
  CALLABLE_FIELD_FORBIDDEN: 'CALLABLE_FIELD_FORBIDDEN',
  USER_PROJECT_PATH_FORBIDDEN: 'USER_PROJECT_PATH_FORBIDDEN',
  OWNER_UNDERSTANDING_FLAG_MISSING: 'OWNER_UNDERSTANDING_FLAG_MISSING',
});

export const IDENTITY_POLICY_OWNER_PACKET_VALIDATION_DECISIONS = Object.freeze({
  OWNER_POLICY_PACKET_VALIDATED_AS_EVIDENCE_ONLY: 'OWNER_POLICY_PACKET_VALIDATED_AS_EVIDENCE_ONLY',
  OWNER_POLICY_PACKET_BLOCKED: 'OWNER_POLICY_PACKET_BLOCKED',
  STOP_OWNER_POLICY_REQUIRED: 'STOP_OWNER_POLICY_REQUIRED',
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
  if (value === undefined || value === null || value === false) {
    return false;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized !== '' && normalized !== 'false';
  }
  return true;
}

function containsCallable(value) {
  if (typeof value === 'function') {
    return true;
  }
  if (Array.isArray(value)) {
    return value.some(containsCallable);
  }
  if (isObject(value)) {
    return Object.values(value).some(containsCallable);
  }
  return false;
}

function containsUserProjectPath(value) {
  if (typeof value === 'string') {
    return value.includes('/') || value.includes('\\');
  }
  if (Array.isArray(value)) {
    return value.some(containsUserProjectPath);
  }
  if (isObject(value)) {
    return Object.values(value).some(containsUserProjectPath);
  }
  return false;
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
    reasons.push(IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES.MISSING_CHANGED_BASENAMES_EVIDENCE);
    return;
  }
  if (input.changedBasenames.some((basename) => !ALLOWED_CHANGED_BASENAMES.has(basename))) {
    reasons.push(IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES.FORBIDDEN_BASENAME_CHANGE);
  }
}

function resolveHashRef(input = {}, packet = {}, hashKey, packetHashKey) {
  const evidenceHash = hasText(input[hashKey])
    ? input[hashKey]
    : (hasText(packet[packetHashKey]) ? packet[packetHashKey] : '');
  const expectedEvidenceHash = hasText(input[`${hashKey}Expected`])
    ? input[`${hashKey}Expected`]
    : '';
  const stale = input[`${hashKey}Stale`] === true
    || (
      hasText(expectedEvidenceHash)
      && hasText(evidenceHash)
      && expectedEvidenceHash !== evidenceHash
    );

  return {
    evidenceHash,
    expectedEvidenceHash,
    evidencePresent: hasText(evidenceHash),
    stale,
  };
}

function pushForbiddenClaimReasons(source = {}, reasons) {
  if (isClaimed(source.ownerPolicyAcceptedClaimed) || isClaimed(source.policyAcceptanceClaimed)) {
    reasons.push(IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES.FORBIDDEN_OWNER_POLICY_ACCEPTANCE_CLAIM);
  }
  if (isClaimed(source.projectTruthAcceptedClaimed) || isClaimed(source.projectTruthPolicyAcceptedClaimed)) {
    reasons.push(IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES.FORBIDDEN_PROJECT_TRUTH_ACCEPTANCE_CLAIM);
  }
  if (isClaimed(source.stage05ExitReadyClaimed) || isClaimed(source.identityPolicyReadyClaimed)) {
    reasons.push(IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES.FORBIDDEN_STAGE05_EXIT_READY_CLAIM);
  }
  if (isClaimed(source.stage06PermissionClaimed) || isClaimed(source.stage06AdmissionClaimed)) {
    reasons.push(IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES.FORBIDDEN_STAGE06_PERMISSION_CLAIM);
  }
  if (isClaimed(source.stage06PreAdmittedClaimed) || isClaimed(source.stage06PreAdmissionClaimed)) {
    reasons.push(IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES.FORBIDDEN_STAGE06_PRE_ADMISSION_CLAIM);
  }
  if (
    isClaimed(source.applyTxnClaimed)
    || isClaimed(source.applyTxnAllowedClaimed)
    || isClaimed(source.applyTxnCreatedClaimed)
  ) {
    reasons.push(IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES.FORBIDDEN_APPLYTXN_CLAIM);
  }
  if (isClaimed(source.storageMigrationClaimed) || isClaimed(source.storageMutationClaimed)) {
    reasons.push(IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES.FORBIDDEN_STORAGE_MIGRATION_CLAIM);
  }
  if (isClaimed(source.projectWriteClaimed) || isClaimed(source.projectWritePerformedClaimed)) {
    reasons.push(IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES.FORBIDDEN_PROJECT_WRITE_CLAIM);
  }
  if (
    isClaimed(source.stableIdCreationClaimed)
    || isClaimed(source.stableBlockInstanceIdCreatedClaimed)
    || isClaimed(source.persistStableBlockInstanceIdClaimed)
  ) {
    reasons.push(IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES.FORBIDDEN_STABLE_ID_CREATION_CLAIM);
  }
  if (
    isClaimed(source.blockLineageCreatedClaimed)
    || isClaimed(source.blockLineagePersistedClaimed)
    || isClaimed(source.createBlockLineageClaimed)
  ) {
    reasons.push(IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES.FORBIDDEN_LINEAGE_CREATION_CLAIM);
  }
  if (isClaimed(source.reviewAnchorPromotedClaimed) || isClaimed(source.reviewAnchorHandlePromotedClaimed)) {
    reasons.push(IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES.FORBIDDEN_REVIEW_ANCHOR_PROMOTION_CLAIM);
  }
  if (isClaimed(source.structuralAutoApplyClaimed) || isClaimed(source.moveSplitMergeAutoApplyClaimed)) {
    reasons.push(IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES.FORBIDDEN_STRUCTURAL_AUTO_APPLY_CLAIM);
  }
  if (
    isClaimed(source.uiClaimed)
    || isClaimed(source.docxClaimed)
    || isClaimed(source.networkClaimed)
    || isClaimed(source.dependencyChangeClaimed)
  ) {
    reasons.push(IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES.FORBIDDEN_UI_DOCX_NETWORK_DEPENDENCY_CLAIM);
  }
}

function pushShapeReasons(source, allowedKeys, reasons) {
  if (!isObject(source)) {
    return;
  }
  if (Object.keys(source).some((key) => !allowedKeys.has(key))) {
    reasons.push(IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES.OWNER_POLICY_PACKET_UNKNOWN_FIELD_FORBIDDEN);
  }
  if (containsCallable(source)) {
    reasons.push(IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES.CALLABLE_FIELD_FORBIDDEN);
  }
  if (containsUserProjectPath(source)) {
    reasons.push(IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES.USER_PROJECT_PATH_FORBIDDEN);
  }
}

function hasRequiredUnderstandingFlags(packet) {
  return packet.ownerUnderstandsEvidenceOnly === true
    && packet.ownerUnderstandsNoProjectTruth === true
    && packet.ownerUnderstandsNoStage05ExitReady === true
    && packet.ownerUnderstandsNoStage06 === true
    && packet.ownerUnderstandsNoApplyTxn === true
    && packet.ownerUnderstandsNoStorageMigration === true;
}

function classifyOwnerAssertion(rawAssertion = {}) {
  const assertion = isObject(rawAssertion) ? rawAssertion : {};
  const assertionId = hasText(assertion.assertionId) ? assertion.assertionId : '';
  const assertionClass = upper(assertion.assertionClass || assertion.kind || assertion.type, '');
  const reasonCodes = [];

  if (!hasText(assertionClass)) {
    reasonCodes.push(IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES.AMBIGUOUS_OWNER_ASSERTION);
  } else if (TRACE_ONLY_ASSERTION_CLASSES.has(assertionClass)) {
    reasonCodes.push(IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES.SCENE_IDENTITY_TRACE_ONLY_NOT_ACCEPTED);
  } else if (ALLOWED_ASSERTION_CLASSES.has(assertionClass)) {
    reasonCodes.push(IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES.OWNER_ASSERTION_RECORDED_AS_EVIDENCE_ONLY);
  } else {
    reasonCodes.push(IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES.UNKNOWN_OWNER_ASSERTION_CLASS);
  }

  pushShapeReasons(assertion, OWNER_ASSERTION_ALLOWED_KEYS, reasonCodes);
  pushForbiddenClaimReasons(assertion, reasonCodes);

  const uniqueReasonCodes = uniqueSorted(reasonCodes);
  const blocked = uniqueReasonCodes.some((code) => BLOCKING_REASON_CODES.has(code));
  const traceOnly = uniqueReasonCodes.includes(
    IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES.SCENE_IDENTITY_TRACE_ONLY_NOT_ACCEPTED,
  );

  return withCanonicalHash({
    assertionKind: 'OwnerPolicyAssertionClassification',
    contourId: CONTOUR_ID,
    assertionId,
    assertionClass,
    classification: blocked ? 'BLOCKED' : (traceOnly ? 'TRACE_ONLY' : 'EVIDENCE_ONLY'),
    evidenceOnly: !blocked,
    traceOnly,
    policyAcceptedAsProjectTruth: false,
    stage05ExitReady: false,
    stage06PreAdmitted: false,
    applyTxnAllowed: false,
    reasonCodes: uniqueReasonCodes,
  });
}

function createDecision(blockedReasons, packetPresent) {
  let outputDecision = IDENTITY_POLICY_OWNER_PACKET_VALIDATION_DECISIONS.OWNER_POLICY_PACKET_VALIDATED_AS_EVIDENCE_ONLY;
  if (blockedReasons.length > 0) {
    outputDecision = IDENTITY_POLICY_OWNER_PACKET_VALIDATION_DECISIONS.OWNER_POLICY_PACKET_BLOCKED;
  } else if (!packetPresent) {
    outputDecision = IDENTITY_POLICY_OWNER_PACKET_VALIDATION_DECISIONS.STOP_OWNER_POLICY_REQUIRED;
  }

  return withCanonicalHash({
    decisionKind: DECISION_KIND,
    contourId: CONTOUR_ID,
    outputDecision,
    blocked: blockedReasons.length > 0,
    blockedReasons,
  });
}

function buildReviewBom({ blockedReasons, assertionClassifications }) {
  const forbiddenClaimCodes = blockedReasons.filter((code) => code.startsWith('FORBIDDEN_'));
  return withCanonicalHash({
    bomKind: 'OwnerPolicyPacketValidationReviewBOM',
    contourId: CONTOUR_ID,
    ownerPacketAnomalyCount: blockedReasons.length,
    forbiddenClaimCount: forbiddenClaimCodes.length,
    traceOnlyAssertionCount: assertionClassifications.filter((entry) => entry.traceOnly).length,
    acceptedProjectTruthCount: 0,
    stage05ExitReadyCount: 0,
    stage06AdmissionCount: 0,
    applyTxnPermissionCount: 0,
    storageMutationCount: 0,
    blockedReasonCodes: blockedReasons,
    assertionReasonCodes: uniqueSorted(assertionClassifications.flatMap((entry) => entry.reasonCodes)),
    assertionHashes: assertionClassifications.map((entry) => entry.canonicalHash).sort(),
  });
}

function buildNextReviewPreview({ blockedReasons, assertionClassifications }) {
  return withCanonicalHash({
    packetKind: 'Stage05MIdentityExitReviewInputPreview',
    contourId: CONTOUR_ID,
    previewOnly: true,
    nextContourRecommendationOnly: true,
    ownerMayOpenStage05MReviewOnly: blockedReasons.length === 0,
    stage05ExitReady: false,
    stage06PreAdmitted: false,
    stage06AdmissionGranted: false,
    applyTxnAllowed: false,
    policyAcceptedAsProjectTruth: false,
    evidenceOnlyAssertionCount: assertionClassifications.filter((entry) => entry.classification === 'EVIDENCE_ONLY').length,
    traceOnlyAssertionCount: assertionClassifications.filter((entry) => entry.traceOnly).length,
    blockedReasonCodes: blockedReasons,
  });
}

export function compileIdentityPolicyOwnerPacketValidation(input = {}) {
  const blockedReasons = [];
  pushChangedBasenameReasons(input, blockedReasons);
  pushForbiddenClaimReasons(input, blockedReasons);

  const packet = isObject(input.ownerPolicyPacket) ? input.ownerPolicyPacket : {};
  const packetPresent = isObject(input.ownerPolicyPacket);

  if (!packetPresent) {
    blockedReasons.push(IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES.MISSING_OWNER_POLICY_PACKET);
  } else {
    pushShapeReasons(packet, OWNER_PACKET_ALLOWED_KEYS, blockedReasons);
    if (packet.packetKind !== EXPECTED_PACKET_KIND) {
      blockedReasons.push(IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES.WRONG_OWNER_POLICY_PACKET_TARGET);
    }
    if (packet.packetTarget !== EXPECTED_PACKET_TARGET) {
      blockedReasons.push(IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES.WRONG_OWNER_POLICY_PACKET_TARGET);
    }
    if (!hasText(packet.ownerDecisionId)) {
      blockedReasons.push(IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES.MISSING_OWNER_DECISION_ID);
    }
    if (!Array.isArray(packet.ownerAssertions) || packet.ownerAssertions.length === 0) {
      blockedReasons.push(IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES.MISSING_OWNER_ASSERTIONS);
    }
    if (!hasRequiredUnderstandingFlags(packet)) {
      blockedReasons.push(IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES.OWNER_UNDERSTANDING_FLAG_MISSING);
    }
    pushForbiddenClaimReasons(packet, blockedReasons);
  }

  const stage05kResultRef = resolveHashRef(input, packet, 'stage05kResultHash', 'stage05kResultHash');
  const stage05kDecisionRef = resolveHashRef(input, packet, 'stage05kDecisionHash', 'stage05kDecisionHash');

  if (!stage05kResultRef.evidencePresent) {
    blockedReasons.push(IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES.MISSING_STAGE05K_RESULT_HASH);
  }
  if (!stage05kDecisionRef.evidencePresent) {
    blockedReasons.push(IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES.MISSING_STAGE05K_DECISION_HASH);
  }
  if (stage05kResultRef.stale) {
    blockedReasons.push(IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES.STALE_STAGE05K_RESULT_HASH);
  }
  if (stage05kDecisionRef.stale) {
    blockedReasons.push(IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES.STALE_STAGE05K_DECISION_HASH);
  }

  const assertionClassifications = asArray(packet.ownerAssertions).map(classifyOwnerAssertion);
  for (const classification of assertionClassifications) {
    for (const code of classification.reasonCodes) {
      if (BLOCKING_REASON_CODES.has(code)) {
        blockedReasons.push(code);
      }
    }
  }

  const uniqueBlockedReasons = uniqueSorted(blockedReasons);
  const decision = createDecision(uniqueBlockedReasons, packetPresent);
  const reviewBom = buildReviewBom({ blockedReasons: uniqueBlockedReasons, assertionClassifications });
  const nextReviewPreview = buildNextReviewPreview({ blockedReasons: uniqueBlockedReasons, assertionClassifications });

  return withCanonicalHash({
    resultKind: RESULT_KIND,
    contourId: CONTOUR_ID,
    expectedPacketKind: EXPECTED_PACKET_KIND,
    expectedPacketTarget: EXPECTED_PACKET_TARGET,
    outputDecision: decision.outputDecision,
    allowedDecisions: Object.values(IDENTITY_POLICY_OWNER_PACKET_VALIDATION_DECISIONS),
    blocked: uniqueBlockedReasons.length > 0,
    blockedReasons: uniqueBlockedReasons,
    ownerPacketValidatedAsEvidenceOnly:
      decision.outputDecision === IDENTITY_POLICY_OWNER_PACKET_VALIDATION_DECISIONS.OWNER_POLICY_PACKET_VALIDATED_AS_EVIDENCE_ONLY,
    stage05kResultRef,
    stage05kDecisionRef,
    ownerDecisionId: hasText(packet.ownerDecisionId) ? packet.ownerDecisionId : '',
    ownerAssertionCount: assertionClassifications.length,
    ownerPolicyAccepted: false,
    policyAcceptedAsProjectTruth: false,
    projectTruthPolicyAccepted: false,
    stage05ExitReady: false,
    stage06PreAdmitted: false,
    stage06AdmissionGranted: false,
    applyTxnAllowed: false,
    applyTxnCreated: false,
    applyTxnPerformed: false,
    projectWritePerformed: false,
    runtimeApplyPerformed: false,
    applyOpCreated: false,
    applyOpPerformed: false,
    storageMutationPerformed: false,
    storageMigrationPerformed: false,
    stableIdCreated: false,
    stableBlockInstanceIdCreated: false,
    blockLineageCreated: false,
    blockLineagePersisted: false,
    reviewAnchorHandlePromoted: false,
    sceneIdentityAccepted: false,
    uiTouched: false,
    docxTouched: false,
    networkTouched: false,
    dependencyChanged: false,
    assertionClassifications,
    decisions: [decision],
    reviewBom,
    nextReviewPreview,
  });
}

export const runIdentityPolicyOwnerPacketValidation = compileIdentityPolicyOwnerPacketValidation;

import { canonicalHash } from './reviewIrKernel.mjs';

const RESULT_KIND = 'STAGE_05M_IDENTITY_EVIDENCE_CHAIN_REVIEW_BOM_RESULT_001';
const DECISION_KIND = 'STAGE_05M_IDENTITY_EVIDENCE_CHAIN_REVIEW_BOM_DECISION_001';
const CONTOUR_ID = 'STAGE05M_IDENTITY_EVIDENCE_CHAIN_REVIEW_BOM_ONLY_001';

const ALLOWED_CHANGED_BASENAMES = new Set([
  'identityEvidenceChainReviewBom.mjs',
  'identityEvidenceChainReviewBom.contract.test.js',
  'STAGE05M_IDENTITY_EVIDENCE_CHAIN_REVIEW_BOM_ONLY_001.md',
]);

const FORBIDDEN_PERMISSION_LANGUAGE = [
  'READY',
  'APPROVED',
  'ACCEPTED',
  'ALLOWED',
  'ADMITTED',
  'PERMISSION',
  'PERMITTED',
  'GREEN',
];

const REF_SPECS = Object.freeze([
  {
    key: 'stage05aTraceRef',
    hashKey: 'stage05aTraceRefHash',
    expectedKey: 'stage05aTraceRefHashExpected',
    refId: 'STAGE05A_TRACE_REF',
    refClass: 'TRACE_ONLY_STAGE05A',
    missingReason: 'MISSING_STAGE05A_TRACE_REF',
    advisoryReason: 'TRACE_ONLY_REF_NOT_POLICY_PASS',
  },
  {
    key: 'stage05cPreconditionRef',
    hashKey: 'stage05cPreconditionRefHash',
    expectedKey: 'stage05cPreconditionRefHashExpected',
    refId: 'STAGE05C_PRECONDITION_REF',
    refClass: 'PRECONDITION_ONLY_STAGE05C',
    missingReason: 'MISSING_STAGE05C_PRECONDITION_REF',
    advisoryReason: 'PRECONDITION_ONLY_REF_NOT_POLICY_PASS',
  },
  {
    key: 'stage05dTraceRef',
    hashKey: 'stage05dTraceRefHash',
    expectedKey: 'stage05dTraceRefHashExpected',
    refId: 'STAGE05D_TRACE_REF',
    refClass: 'TRACE_ONLY_STAGE05D',
    missingReason: 'MISSING_STAGE05D_TRACE_REF',
    advisoryReason: 'TRACE_ONLY_REF_NOT_POLICY_PASS',
  },
  {
    key: 'stage05eGuardRef',
    hashKey: 'stage05eGuardRefHash',
    expectedKey: 'stage05eGuardRefHashExpected',
    refId: 'STAGE05E_GUARD_REF',
    refClass: 'GUARD_ONLY_STAGE05E',
    missingReason: 'MISSING_STAGE05E_GUARD_REF',
    advisoryReason: 'GUARD_ONLY_REF_NOT_PERMISSION',
  },
  {
    key: 'stage05fGuardRef',
    hashKey: 'stage05fGuardRefHash',
    expectedKey: 'stage05fGuardRefHashExpected',
    refId: 'STAGE05F_GUARD_REF',
    refClass: 'GUARD_ONLY_STAGE05F',
    missingReason: 'MISSING_STAGE05F_GUARD_REF',
    advisoryReason: 'GUARD_ONLY_REF_NOT_PERMISSION',
  },
  {
    key: 'stage05iGuardRef',
    hashKey: 'stage05iGuardRefHash',
    expectedKey: 'stage05iGuardRefHashExpected',
    refId: 'STAGE05I_GUARD_REF',
    refClass: 'GUARD_ONLY_STAGE05I',
    missingReason: 'MISSING_STAGE05I_GUARD_REF',
    advisoryReason: 'GUARD_ONLY_REF_NOT_PERMISSION',
  },
  {
    key: 'stage05jGuardRef',
    hashKey: 'stage05jGuardRefHash',
    expectedKey: 'stage05jGuardRefHashExpected',
    refId: 'STAGE05J_GUARD_REF',
    refClass: 'GUARD_ONLY_STAGE05J',
    missingReason: 'MISSING_STAGE05J_GUARD_REF',
    advisoryReason: 'GUARD_ONLY_REF_NOT_PERMISSION',
  },
  {
    key: 'stage05kRollupRef',
    hashKey: 'stage05kRollupRefHash',
    expectedKey: 'stage05kRollupRefHashExpected',
    refId: 'STAGE05K_ROLLUP_REF',
    refClass: 'ROLLUP_ONLY_STAGE05K',
    missingReason: 'MISSING_STAGE05K_ROLLUP_REF',
    advisoryReason: 'ROLLUP_ONLY_REF_NOT_EXIT_READY',
  },
  {
    key: 'stage05lOwnerPacketValidationRef',
    hashKey: 'stage05lOwnerPacketValidationRefHash',
    expectedKey: 'stage05lOwnerPacketValidationRefHashExpected',
    refId: 'STAGE05L_OWNER_PACKET_VALIDATION_REF',
    refClass: 'EVIDENCE_ONLY_STAGE05L',
    missingReason: 'MISSING_STAGE05L_OWNER_PACKET_VALIDATION_REF',
    advisoryReason: 'OWNER_PACKET_VALIDATION_REF_EVIDENCE_ONLY',
  },
  {
    key: 'stage05lDecisionRef',
    hashKey: 'stage05lDecisionRefHash',
    expectedKey: 'stage05lDecisionRefHashExpected',
    refId: 'STAGE05L_DECISION_REF',
    refClass: 'DECISION_HASH_ONLY_STAGE05L',
    missingReason: 'MISSING_STAGE05L_DECISION_REF',
    advisoryReason: 'OWNER_PACKET_VALIDATION_REF_EVIDENCE_ONLY',
  },
]);

const BLOCKING_REASON_CODES = new Set([
  'MISSING_CHANGED_BASENAMES_EVIDENCE',
  'FORBIDDEN_BASENAME_CHANGE',
  'MISSING_STAGE05A_TRACE_REF',
  'MISSING_STAGE05C_PRECONDITION_REF',
  'MISSING_STAGE05D_TRACE_REF',
  'MISSING_STAGE05E_GUARD_REF',
  'MISSING_STAGE05F_GUARD_REF',
  'MISSING_STAGE05I_GUARD_REF',
  'MISSING_STAGE05J_GUARD_REF',
  'MISSING_STAGE05K_ROLLUP_REF',
  'MISSING_STAGE05L_OWNER_PACKET_VALIDATION_REF',
  'MISSING_STAGE05L_DECISION_REF',
  'STALE_STAGE05_REQUIRED_REF',
  'FORBIDDEN_PERMISSION_LANGUAGE_FOUND',
  'FORBIDDEN_POLICY_ACCEPTANCE_CLAIM',
  'FORBIDDEN_OWNER_POLICY_DECISION_CLAIM',
  'FORBIDDEN_PROJECT_TRUTH_ACCEPTANCE_CLAIM',
  'FORBIDDEN_STAGE05_EXIT_READY_CLAIM',
  'FORBIDDEN_STAGE06_PRE_ADMISSION_CLAIM',
  'FORBIDDEN_STAGE06_PERMISSION_CLAIM',
  'FORBIDDEN_APPLYTXN_CLAIM',
  'FORBIDDEN_STORAGE_MIGRATION_CLAIM',
  'FORBIDDEN_PROJECT_WRITE_CLAIM',
  'FORBIDDEN_STABLE_ID_CREATION_CLAIM',
  'FORBIDDEN_LINEAGE_CREATION_CLAIM',
  'FORBIDDEN_REVIEW_ANCHOR_PROMOTION_CLAIM',
  'FORBIDDEN_STRUCTURAL_AUTO_APPLY_CLAIM',
  'FORBIDDEN_UI_DOCX_NETWORK_DEPENDENCY_CLAIM',
]);

export const IDENTITY_EVIDENCE_CHAIN_REVIEW_BOM_REASON_CODES = Object.freeze({
  FORBIDDEN_BASENAME_CHANGE: 'FORBIDDEN_BASENAME_CHANGE',
  MISSING_CHANGED_BASENAMES_EVIDENCE: 'MISSING_CHANGED_BASENAMES_EVIDENCE',
  MISSING_STAGE05A_TRACE_REF: 'MISSING_STAGE05A_TRACE_REF',
  MISSING_STAGE05C_PRECONDITION_REF: 'MISSING_STAGE05C_PRECONDITION_REF',
  MISSING_STAGE05D_TRACE_REF: 'MISSING_STAGE05D_TRACE_REF',
  MISSING_STAGE05E_GUARD_REF: 'MISSING_STAGE05E_GUARD_REF',
  MISSING_STAGE05F_GUARD_REF: 'MISSING_STAGE05F_GUARD_REF',
  MISSING_STAGE05I_GUARD_REF: 'MISSING_STAGE05I_GUARD_REF',
  MISSING_STAGE05J_GUARD_REF: 'MISSING_STAGE05J_GUARD_REF',
  MISSING_STAGE05K_ROLLUP_REF: 'MISSING_STAGE05K_ROLLUP_REF',
  MISSING_STAGE05L_OWNER_PACKET_VALIDATION_REF: 'MISSING_STAGE05L_OWNER_PACKET_VALIDATION_REF',
  MISSING_STAGE05L_DECISION_REF: 'MISSING_STAGE05L_DECISION_REF',
  STALE_STAGE05_REQUIRED_REF: 'STALE_STAGE05_REQUIRED_REF',
  TRACE_ONLY_REF_NOT_POLICY_PASS: 'TRACE_ONLY_REF_NOT_POLICY_PASS',
  PRECONDITION_ONLY_REF_NOT_POLICY_PASS: 'PRECONDITION_ONLY_REF_NOT_POLICY_PASS',
  GUARD_ONLY_REF_NOT_PERMISSION: 'GUARD_ONLY_REF_NOT_PERMISSION',
  ROLLUP_ONLY_REF_NOT_EXIT_READY: 'ROLLUP_ONLY_REF_NOT_EXIT_READY',
  OWNER_PACKET_VALIDATION_REF_EVIDENCE_ONLY: 'OWNER_PACKET_VALIDATION_REF_EVIDENCE_ONLY',
  FORBIDDEN_PERMISSION_LANGUAGE_FOUND: 'FORBIDDEN_PERMISSION_LANGUAGE_FOUND',
  FORBIDDEN_POLICY_ACCEPTANCE_CLAIM: 'FORBIDDEN_POLICY_ACCEPTANCE_CLAIM',
  FORBIDDEN_OWNER_POLICY_DECISION_CLAIM: 'FORBIDDEN_OWNER_POLICY_DECISION_CLAIM',
  FORBIDDEN_PROJECT_TRUTH_ACCEPTANCE_CLAIM: 'FORBIDDEN_PROJECT_TRUTH_ACCEPTANCE_CLAIM',
  FORBIDDEN_STAGE05_EXIT_READY_CLAIM: 'FORBIDDEN_STAGE05_EXIT_READY_CLAIM',
  FORBIDDEN_STAGE06_PRE_ADMISSION_CLAIM: 'FORBIDDEN_STAGE06_PRE_ADMISSION_CLAIM',
  FORBIDDEN_STAGE06_PERMISSION_CLAIM: 'FORBIDDEN_STAGE06_PERMISSION_CLAIM',
  FORBIDDEN_APPLYTXN_CLAIM: 'FORBIDDEN_APPLYTXN_CLAIM',
  FORBIDDEN_STORAGE_MIGRATION_CLAIM: 'FORBIDDEN_STORAGE_MIGRATION_CLAIM',
  FORBIDDEN_PROJECT_WRITE_CLAIM: 'FORBIDDEN_PROJECT_WRITE_CLAIM',
  FORBIDDEN_STABLE_ID_CREATION_CLAIM: 'FORBIDDEN_STABLE_ID_CREATION_CLAIM',
  FORBIDDEN_LINEAGE_CREATION_CLAIM: 'FORBIDDEN_LINEAGE_CREATION_CLAIM',
  FORBIDDEN_REVIEW_ANCHOR_PROMOTION_CLAIM: 'FORBIDDEN_REVIEW_ANCHOR_PROMOTION_CLAIM',
  FORBIDDEN_STRUCTURAL_AUTO_APPLY_CLAIM: 'FORBIDDEN_STRUCTURAL_AUTO_APPLY_CLAIM',
  FORBIDDEN_UI_DOCX_NETWORK_DEPENDENCY_CLAIM: 'FORBIDDEN_UI_DOCX_NETWORK_DEPENDENCY_CLAIM',
});

export const IDENTITY_EVIDENCE_CHAIN_REVIEW_BOM_DECISIONS = Object.freeze({
  EVIDENCE_CHAIN_REVIEW_COMPILED: 'EVIDENCE_CHAIN_REVIEW_COMPILED',
  EVIDENCE_CHAIN_REVIEW_BLOCKED: 'EVIDENCE_CHAIN_REVIEW_BLOCKED',
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
    reasons.push(IDENTITY_EVIDENCE_CHAIN_REVIEW_BOM_REASON_CODES.MISSING_CHANGED_BASENAMES_EVIDENCE);
    return;
  }
  if (input.changedBasenames.some((basename) => !ALLOWED_CHANGED_BASENAMES.has(basename))) {
    reasons.push(IDENTITY_EVIDENCE_CHAIN_REVIEW_BOM_REASON_CODES.FORBIDDEN_BASENAME_CHANGE);
  }
}

function resolveRef(input = {}, spec) {
  const ref = isObject(input[spec.key]) ? input[spec.key] : {};
  const evidenceHash = hasText(ref.evidenceHash)
    ? ref.evidenceHash
    : (hasText(input[spec.hashKey]) ? input[spec.hashKey] : '');
  const expectedEvidenceHash = hasText(ref.expectedEvidenceHash)
    ? ref.expectedEvidenceHash
    : (hasText(input[spec.expectedKey]) ? input[spec.expectedKey] : '');
  const stale = ref.stale === true
    || input[`${spec.hashKey}Stale`] === true
    || (
      hasText(expectedEvidenceHash)
      && hasText(evidenceHash)
      && expectedEvidenceHash !== evidenceHash
    );
  const evidencePresent = hasText(evidenceHash);
  const reasonCodes = [];
  if (!evidencePresent) {
    reasonCodes.push(IDENTITY_EVIDENCE_CHAIN_REVIEW_BOM_REASON_CODES[spec.missingReason]);
  } else {
    reasonCodes.push(IDENTITY_EVIDENCE_CHAIN_REVIEW_BOM_REASON_CODES[spec.advisoryReason]);
  }
  if (stale) {
    reasonCodes.push(IDENTITY_EVIDENCE_CHAIN_REVIEW_BOM_REASON_CODES.STALE_STAGE05_REQUIRED_REF);
  }

  return withCanonicalHash({
    refKind: 'Stage05EvidenceChainRefReview',
    contourId: CONTOUR_ID,
    refId: spec.refId,
    refClass: spec.refClass,
    evidenceHash,
    expectedEvidenceHash,
    evidencePresent,
    stale,
    traceOnly: spec.refClass.startsWith('TRACE_ONLY'),
    preconditionOnly: spec.refClass.startsWith('PRECONDITION_ONLY'),
    guardOnly: spec.refClass.startsWith('GUARD_ONLY'),
    rollupOnly: spec.refClass.startsWith('ROLLUP_ONLY'),
    evidenceOnly: spec.refClass.startsWith('EVIDENCE_ONLY') || spec.refClass.startsWith('DECISION_HASH_ONLY'),
    policyPass: false,
    permissionGranted: false,
    stage05ExitReady: false,
    reasonCodes: uniqueSorted(reasonCodes),
  });
}

function pushForbiddenClaimReasons(input = {}, reasons) {
  if (isClaimed(input.policyAcceptanceClaimed) || isClaimed(input.policyAcceptedClaimed)) {
    reasons.push(IDENTITY_EVIDENCE_CHAIN_REVIEW_BOM_REASON_CODES.FORBIDDEN_POLICY_ACCEPTANCE_CLAIM);
  }
  if (isClaimed(input.ownerPolicyDecisionClaimed) || isClaimed(input.ownerPolicyDecidedClaimed)) {
    reasons.push(IDENTITY_EVIDENCE_CHAIN_REVIEW_BOM_REASON_CODES.FORBIDDEN_OWNER_POLICY_DECISION_CLAIM);
  }
  if (isClaimed(input.projectTruthAcceptedClaimed) || isClaimed(input.projectTruthPolicyAcceptedClaimed)) {
    reasons.push(IDENTITY_EVIDENCE_CHAIN_REVIEW_BOM_REASON_CODES.FORBIDDEN_PROJECT_TRUTH_ACCEPTANCE_CLAIM);
  }
  if (isClaimed(input.stage05ExitReadyClaimed) || isClaimed(input.identityPolicyReadyClaimed)) {
    reasons.push(IDENTITY_EVIDENCE_CHAIN_REVIEW_BOM_REASON_CODES.FORBIDDEN_STAGE05_EXIT_READY_CLAIM);
  }
  if (isClaimed(input.stage06PreAdmittedClaimed) || isClaimed(input.stage06PreAdmissionClaimed)) {
    reasons.push(IDENTITY_EVIDENCE_CHAIN_REVIEW_BOM_REASON_CODES.FORBIDDEN_STAGE06_PRE_ADMISSION_CLAIM);
  }
  if (isClaimed(input.stage06PermissionClaimed) || isClaimed(input.stage06AdmissionClaimed)) {
    reasons.push(IDENTITY_EVIDENCE_CHAIN_REVIEW_BOM_REASON_CODES.FORBIDDEN_STAGE06_PERMISSION_CLAIM);
  }
  if (
    isClaimed(input.applyTxnClaimed)
    || isClaimed(input.applyTxnAllowedClaimed)
    || isClaimed(input.applyTxnCreatedClaimed)
  ) {
    reasons.push(IDENTITY_EVIDENCE_CHAIN_REVIEW_BOM_REASON_CODES.FORBIDDEN_APPLYTXN_CLAIM);
  }
  if (isClaimed(input.storageMigrationClaimed) || isClaimed(input.storageMutationClaimed)) {
    reasons.push(IDENTITY_EVIDENCE_CHAIN_REVIEW_BOM_REASON_CODES.FORBIDDEN_STORAGE_MIGRATION_CLAIM);
  }
  if (isClaimed(input.projectWriteClaimed) || isClaimed(input.projectWritePerformedClaimed)) {
    reasons.push(IDENTITY_EVIDENCE_CHAIN_REVIEW_BOM_REASON_CODES.FORBIDDEN_PROJECT_WRITE_CLAIM);
  }
  if (
    isClaimed(input.stableIdCreationClaimed)
    || isClaimed(input.stableBlockInstanceIdCreatedClaimed)
    || isClaimed(input.persistStableBlockInstanceIdClaimed)
  ) {
    reasons.push(IDENTITY_EVIDENCE_CHAIN_REVIEW_BOM_REASON_CODES.FORBIDDEN_STABLE_ID_CREATION_CLAIM);
  }
  if (
    isClaimed(input.blockLineageCreatedClaimed)
    || isClaimed(input.blockLineagePersistedClaimed)
    || isClaimed(input.createBlockLineageClaimed)
  ) {
    reasons.push(IDENTITY_EVIDENCE_CHAIN_REVIEW_BOM_REASON_CODES.FORBIDDEN_LINEAGE_CREATION_CLAIM);
  }
  if (isClaimed(input.reviewAnchorPromotedClaimed) || isClaimed(input.reviewAnchorHandlePromotedClaimed)) {
    reasons.push(IDENTITY_EVIDENCE_CHAIN_REVIEW_BOM_REASON_CODES.FORBIDDEN_REVIEW_ANCHOR_PROMOTION_CLAIM);
  }
  if (isClaimed(input.structuralAutoApplyClaimed) || isClaimed(input.moveSplitMergeAutoApplyClaimed)) {
    reasons.push(IDENTITY_EVIDENCE_CHAIN_REVIEW_BOM_REASON_CODES.FORBIDDEN_STRUCTURAL_AUTO_APPLY_CLAIM);
  }
  if (
    isClaimed(input.uiClaimed)
    || isClaimed(input.docxClaimed)
    || isClaimed(input.networkClaimed)
    || isClaimed(input.dependencyChangeClaimed)
  ) {
    reasons.push(IDENTITY_EVIDENCE_CHAIN_REVIEW_BOM_REASON_CODES.FORBIDDEN_UI_DOCX_NETWORK_DEPENDENCY_CLAIM);
  }
}

function permissionLanguageFindings(input = {}) {
  const rawValues = [
    ...asArray(input.permissionLanguageClaims),
    ...asArray(input.claimLanguage),
    input.reviewLanguage,
  ].filter(hasText);
  const findings = [];
  for (const value of rawValues) {
    const normalized = value.toUpperCase();
    const matchedTerms = FORBIDDEN_PERMISSION_LANGUAGE.filter((term) => normalized.includes(term));
    if (matchedTerms.length > 0) {
      findings.push(withCanonicalHash({
        findingKind: 'ForbiddenPermissionLanguageFinding',
        contourId: CONTOUR_ID,
        language: value,
        matchedTerms: uniqueSorted(matchedTerms),
        reasonCode: IDENTITY_EVIDENCE_CHAIN_REVIEW_BOM_REASON_CODES.FORBIDDEN_PERMISSION_LANGUAGE_FOUND,
      }));
    }
  }
  return findings;
}

function createDecision(blockedReasons) {
  return withCanonicalHash({
    decisionKind: DECISION_KIND,
    contourId: CONTOUR_ID,
    outputDecision: blockedReasons.length > 0
      ? IDENTITY_EVIDENCE_CHAIN_REVIEW_BOM_DECISIONS.EVIDENCE_CHAIN_REVIEW_BLOCKED
      : IDENTITY_EVIDENCE_CHAIN_REVIEW_BOM_DECISIONS.EVIDENCE_CHAIN_REVIEW_COMPILED,
    blocked: blockedReasons.length > 0,
    blockedReasons,
  });
}

function buildReviewBom({ refReviews, blockedReasons, permissionFindings }) {
  return withCanonicalHash({
    bomKind: 'IdentityEvidenceChainReviewBOM',
    contourId: CONTOUR_ID,
    stage05EvidenceRefCount: refReviews.length,
    presentRefCount: refReviews.filter((ref) => ref.evidencePresent).length,
    missingRefCount: refReviews.filter((ref) => !ref.evidencePresent).length,
    staleRefCount: refReviews.filter((ref) => ref.stale).length,
    traceOnlyRefCount: refReviews.filter((ref) => ref.traceOnly).length,
    preconditionOnlyRefCount: refReviews.filter((ref) => ref.preconditionOnly).length,
    guardOnlyRefCount: refReviews.filter((ref) => ref.guardOnly).length,
    rollupOnlyRefCount: refReviews.filter((ref) => ref.rollupOnly).length,
    evidenceOnlyRefCount: refReviews.filter((ref) => ref.evidenceOnly).length,
    forbiddenClaimCount: blockedReasons.filter((code) => code.startsWith('FORBIDDEN_')).length,
    permissionLanguageFindingCount: permissionFindings.length,
    unresolvedOwnerDecisionGapCount: 1,
    acceptedProjectTruthCount: 0,
    stage05ExitReadyCount: 0,
    stage06AdmissionCount: 0,
    applyTxnPermissionCount: 0,
    storageMutationCount: 0,
    refReasonCodes: uniqueSorted(refReviews.flatMap((ref) => ref.reasonCodes)),
    blockedReasonCodes: blockedReasons,
    refHashes: refReviews.map((ref) => ref.canonicalHash).sort(),
    permissionLanguageFindingHashes: permissionFindings.map((finding) => finding.canonicalHash).sort(),
  });
}

function buildNextStepPreview({ blockedReasons }) {
  return withCanonicalHash({
    packetKind: 'IdentityEvidenceChainReviewNextStepPreview',
    contourId: CONTOUR_ID,
    previewOnly: true,
    nextStepRecommendationOnly: true,
    ownerDecidesNextIdentityPolicyContour: true,
    policyAcceptanceNotEvaluated: true,
    stage05ExitReady: false,
    stage06PreAdmitted: false,
    stage06AdmissionGranted: false,
    applyTxnAllowed: false,
    blockedReasonCodes: blockedReasons,
  });
}

export function compileIdentityEvidenceChainReviewBom(input = {}) {
  const blockedReasons = [];
  pushChangedBasenameReasons(input, blockedReasons);
  pushForbiddenClaimReasons(input, blockedReasons);

  const refReviews = REF_SPECS.map((spec) => resolveRef(input, spec));
  for (const ref of refReviews) {
    for (const code of ref.reasonCodes) {
      if (BLOCKING_REASON_CODES.has(code)) {
        blockedReasons.push(code);
      }
    }
  }

  const permissionFindings = permissionLanguageFindings(input);
  if (permissionFindings.length > 0) {
    blockedReasons.push(IDENTITY_EVIDENCE_CHAIN_REVIEW_BOM_REASON_CODES.FORBIDDEN_PERMISSION_LANGUAGE_FOUND);
  }

  const uniqueBlockedReasons = uniqueSorted(blockedReasons);
  const decision = createDecision(uniqueBlockedReasons);
  const reviewBom = buildReviewBom({ refReviews, blockedReasons: uniqueBlockedReasons, permissionFindings });
  const nextStepPreview = buildNextStepPreview({ blockedReasons: uniqueBlockedReasons });

  return withCanonicalHash({
    resultKind: RESULT_KIND,
    contourId: CONTOUR_ID,
    outputDecision: decision.outputDecision,
    allowedDecisions: Object.values(IDENTITY_EVIDENCE_CHAIN_REVIEW_BOM_DECISIONS),
    evidenceChainReviewCompiled:
      decision.outputDecision === IDENTITY_EVIDENCE_CHAIN_REVIEW_BOM_DECISIONS.EVIDENCE_CHAIN_REVIEW_COMPILED,
    blocked: uniqueBlockedReasons.length > 0,
    blockedReasons: uniqueBlockedReasons,
    policyAcceptanceNotEvaluated: true,
    ownerPolicyDecisionMade: false,
    policyAcceptedAsProjectTruth: false,
    projectTruthAccepted: false,
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
    sceneIdentityAccepted: false,
    reviewAnchorHandlePromoted: false,
    unresolvedOwnerDecisionGapCount: reviewBom.unresolvedOwnerDecisionGapCount,
    permissionLanguageFindingCount: reviewBom.permissionLanguageFindingCount,
    refReviews,
    permissionFindings,
    decisions: [decision],
    reviewBom,
    nextStepPreview,
  });
}

export const runIdentityEvidenceChainReviewBom = compileIdentityEvidenceChainReviewBom;

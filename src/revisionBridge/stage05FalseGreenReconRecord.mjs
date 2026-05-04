import { canonicalHash } from './reviewIrKernel.mjs';

const RESULT_KIND = 'STAGE_05P_STAGE05_FALSE_GREEN_RECON_RECORD_RESULT_001';
const DECISION_KIND = 'STAGE_05P_STAGE05_FALSE_GREEN_RECON_RECORD_DECISION_001';
const CONTOUR_ID = 'STAGE05P_STAGE05_FALSE_GREEN_RECON_RECORD_ONLY_001';

const ALLOWED_CHANGED_BASENAMES = new Set([
  'stage05FalseGreenReconRecord.mjs',
  'stage05FalseGreenReconRecord.contract.test.js',
  'STAGE05P_STAGE05_FALSE_GREEN_RECON_RECORD_ONLY_001.md',
]);

const OWNER_POLICY_OPTIONS = Object.freeze({
  INTERMEDIATE_REVIEW_ANCHOR_HANDLE_ONLY: 'INTERMEDIATE_REVIEW_ANCHOR_HANDLE_ONLY',
  STABLE_IDENTITY_POLICY_DEFERRED: 'STABLE_IDENTITY_POLICY_DEFERRED',
  NARROW_STABLE_IDENTITY_POLICY_SELECTED_WITHOUT_EXECUTION:
    'NARROW_STABLE_IDENTITY_POLICY_SELECTED_WITHOUT_EXECUTION',
});

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

const HASH_REF_SPECS = Object.freeze([
  {
    refKey: 'stage05kBlockerRollupRef',
    hashKey: 'stage05kBlockerRollupHash',
    expectedKey: 'stage05kBlockerRollupHashExpected',
    refId: 'STAGE05K_BLOCKER_ROLLUP_REF',
    refClass: 'ROLLUP_ONLY_STAGE05K',
    missingReason: 'MISSING_STAGE05K_BLOCKER_ROLLUP_HASH',
    staleReason: 'STALE_STAGE05K_BLOCKER_ROLLUP_HASH',
    advisoryReason: 'STAGE05K_ROLLUP_RECON_INPUT_ONLY',
  },
  {
    refKey: 'stage05lOwnerPacketValidationRef',
    hashKey: 'stage05lOwnerPacketValidationHash',
    expectedKey: 'stage05lOwnerPacketValidationHashExpected',
    refId: 'STAGE05L_OWNER_PACKET_VALIDATION_REF',
    refClass: 'EVIDENCE_ONLY_STAGE05L',
    missingReason: 'MISSING_STAGE05L_OWNER_PACKET_VALIDATION_HASH',
    staleReason: 'STALE_STAGE05L_OWNER_PACKET_VALIDATION_HASH',
    advisoryReason: 'STAGE05L_VALIDATION_RECON_INPUT_ONLY',
  },
  {
    refKey: 'stage05mEvidenceChainReviewBomRef',
    hashKey: 'stage05mEvidenceChainReviewBomHash',
    expectedKey: 'stage05mEvidenceChainReviewBomHashExpected',
    refId: 'STAGE05M_EVIDENCE_CHAIN_REVIEW_BOM_REF',
    refClass: 'BOM_ONLY_STAGE05M',
    missingReason: 'MISSING_STAGE05M_EVIDENCE_CHAIN_REVIEW_BOM_HASH',
    staleReason: 'STALE_STAGE05M_EVIDENCE_CHAIN_REVIEW_BOM_HASH',
    advisoryReason: 'STAGE05M_BOM_RECON_INPUT_ONLY',
  },
  {
    refKey: 'stage05nOwnerPolicyDecisionRecordRef',
    hashKey: 'stage05nOwnerPolicyDecisionRecordHash',
    expectedKey: 'stage05nOwnerPolicyDecisionRecordHashExpected',
    refId: 'STAGE05N_OWNER_POLICY_DECISION_RECORD_REF',
    refClass: 'DECISION_RECORD_ONLY_STAGE05N',
    missingReason: 'MISSING_STAGE05N_OWNER_POLICY_DECISION_RECORD_HASH',
    staleReason: 'STALE_STAGE05N_OWNER_POLICY_DECISION_RECORD_HASH',
    advisoryReason: 'STAGE05N_DECISION_RECORD_RECON_INPUT_ONLY',
  },
  {
    refKey: 'stage05oExitReviewFactsRecordRef',
    hashKey: 'stage05oExitReviewFactsRecordHash',
    expectedKey: 'stage05oExitReviewFactsRecordHashExpected',
    refId: 'STAGE05O_EXIT_REVIEW_FACTS_RECORD_REF',
    refClass: 'FACTS_RECORD_ONLY_STAGE05O',
    missingReason: 'MISSING_STAGE05O_EXIT_REVIEW_FACTS_RECORD_HASH',
    staleReason: 'STALE_STAGE05O_EXIT_REVIEW_FACTS_RECORD_HASH',
    advisoryReason: 'STAGE05O_FACTS_RECORD_RECON_INPUT_ONLY',
  },
]);

const BLOCKING_REASON_CODES = new Set([
  'MISSING_CHANGED_BASENAMES_EVIDENCE',
  'FORBIDDEN_BASENAME_CHANGE',
  'MISSING_STAGE05K_BLOCKER_ROLLUP_HASH',
  'STALE_STAGE05K_BLOCKER_ROLLUP_HASH',
  'MISSING_STAGE05L_OWNER_PACKET_VALIDATION_HASH',
  'STALE_STAGE05L_OWNER_PACKET_VALIDATION_HASH',
  'MISSING_STAGE05M_EVIDENCE_CHAIN_REVIEW_BOM_HASH',
  'STALE_STAGE05M_EVIDENCE_CHAIN_REVIEW_BOM_HASH',
  'MISSING_STAGE05N_OWNER_POLICY_DECISION_RECORD_HASH',
  'STALE_STAGE05N_OWNER_POLICY_DECISION_RECORD_HASH',
  'MISSING_STAGE05O_EXIT_REVIEW_FACTS_RECORD_HASH',
  'STALE_STAGE05O_EXIT_REVIEW_FACTS_RECORD_HASH',
  'MISSING_STAGE05N_OWNER_POLICY_OPTION_OBSERVATION',
  'MISSING_STAGE05O_OWNER_POLICY_OPTION_OBSERVATION',
  'UNKNOWN_STAGE05N_OWNER_POLICY_OPTION_OBSERVATION',
  'UNKNOWN_STAGE05O_OWNER_POLICY_OPTION_OBSERVATION',
  'OWNER_POLICY_OPTION_OBSERVATION_MISMATCH',
  'UNKNOWN_FIELD_FORBIDDEN',
  'CALLABLE_FIELD_FORBIDDEN',
  'USER_PROJECT_PATH_FORBIDDEN',
  'FORBIDDEN_PERMISSION_LANGUAGE_FOUND',
  'FORBIDDEN_POLICY_ACCEPTANCE_CLAIM',
  'FORBIDDEN_PROJECT_TRUTH_ACCEPTANCE_CLAIM',
  'FORBIDDEN_STAGE05_EXIT_READY_CLAIM',
  'FORBIDDEN_STAGE06_PRE_ADMISSION_CLAIM',
  'FORBIDDEN_STAGE06_PERMISSION_CLAIM',
  'FORBIDDEN_APPLYTXN_CLAIM',
  'FORBIDDEN_RUNTIME_APPLY_CLAIM',
  'FORBIDDEN_STORAGE_CLAIM',
  'FORBIDDEN_PROJECT_WRITE_CLAIM',
  'FORBIDDEN_STABLE_ID_CREATION_CLAIM',
  'FORBIDDEN_LINEAGE_CREATION_CLAIM',
  'FORBIDDEN_REVIEW_ANCHOR_PROMOTION_CLAIM',
  'FORBIDDEN_STRUCTURAL_AUTO_APPLY_CLAIM',
  'FORBIDDEN_UI_DOCX_NETWORK_DEPENDENCY_CLAIM',
]);

const ALLOWED_INPUT_KEYS = new Set([
  'changedBasenames',
  'stage05kBlockerRollupRef',
  'stage05kBlockerRollupHash',
  'stage05kBlockerRollupHashExpected',
  'stage05kBlockerRollupHashStale',
  'stage05lOwnerPacketValidationRef',
  'stage05lOwnerPacketValidationHash',
  'stage05lOwnerPacketValidationHashExpected',
  'stage05lOwnerPacketValidationHashStale',
  'stage05mEvidenceChainReviewBomRef',
  'stage05mEvidenceChainReviewBomHash',
  'stage05mEvidenceChainReviewBomHashExpected',
  'stage05mEvidenceChainReviewBomHashStale',
  'stage05nOwnerPolicyDecisionRecordRef',
  'stage05nOwnerPolicyDecisionRecordHash',
  'stage05nOwnerPolicyDecisionRecordHashExpected',
  'stage05nOwnerPolicyDecisionRecordHashStale',
  'stage05oExitReviewFactsRecordRef',
  'stage05oExitReviewFactsRecordHash',
  'stage05oExitReviewFactsRecordHashExpected',
  'stage05oExitReviewFactsRecordHashStale',
  'stage05nOwnerPolicyOptionObserved',
  'stage05oOwnerPolicyOptionObserved',
  'permissionLanguageClaims',
  'claimLanguage',
  'reviewLanguage',
  'policyAcceptanceClaimed',
  'policyAcceptedClaimed',
  'ownerPolicyAcceptedClaimed',
  'projectTruthAcceptedClaimed',
  'projectTruthPolicyAcceptedClaimed',
  'ownerPolicyDecisionAcceptedAsProjectTruthClaimed',
  'stage05ExitReadyClaimed',
  'identityPolicyReadyClaimed',
  'readyStatusClaimed',
  'stage06PermissionClaimed',
  'stage06AdmissionClaimed',
  'stage06PreAdmittedClaimed',
  'stage06PreAdmissionClaimed',
  'applyTxnClaimed',
  'applyTxnPermissionClaimed',
  'applyTxnAllowedClaimed',
  'applyTxnCreatedClaimed',
  'runtimeApplyClaimed',
  'runtimeApplyPerformedClaimed',
  'applyOpCreatedClaimed',
  'applyOpPerformedClaimed',
  'storageMigrationClaimed',
  'storageMutationClaimed',
  'storageWriteClaimed',
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

export const STAGE05_FALSE_GREEN_RECON_RECORD_REASON_CODES = Object.freeze({
  FORBIDDEN_BASENAME_CHANGE: 'FORBIDDEN_BASENAME_CHANGE',
  MISSING_CHANGED_BASENAMES_EVIDENCE: 'MISSING_CHANGED_BASENAMES_EVIDENCE',
  MISSING_STAGE05K_BLOCKER_ROLLUP_HASH: 'MISSING_STAGE05K_BLOCKER_ROLLUP_HASH',
  STALE_STAGE05K_BLOCKER_ROLLUP_HASH: 'STALE_STAGE05K_BLOCKER_ROLLUP_HASH',
  MISSING_STAGE05L_OWNER_PACKET_VALIDATION_HASH: 'MISSING_STAGE05L_OWNER_PACKET_VALIDATION_HASH',
  STALE_STAGE05L_OWNER_PACKET_VALIDATION_HASH: 'STALE_STAGE05L_OWNER_PACKET_VALIDATION_HASH',
  MISSING_STAGE05M_EVIDENCE_CHAIN_REVIEW_BOM_HASH: 'MISSING_STAGE05M_EVIDENCE_CHAIN_REVIEW_BOM_HASH',
  STALE_STAGE05M_EVIDENCE_CHAIN_REVIEW_BOM_HASH: 'STALE_STAGE05M_EVIDENCE_CHAIN_REVIEW_BOM_HASH',
  MISSING_STAGE05N_OWNER_POLICY_DECISION_RECORD_HASH: 'MISSING_STAGE05N_OWNER_POLICY_DECISION_RECORD_HASH',
  STALE_STAGE05N_OWNER_POLICY_DECISION_RECORD_HASH: 'STALE_STAGE05N_OWNER_POLICY_DECISION_RECORD_HASH',
  MISSING_STAGE05O_EXIT_REVIEW_FACTS_RECORD_HASH: 'MISSING_STAGE05O_EXIT_REVIEW_FACTS_RECORD_HASH',
  STALE_STAGE05O_EXIT_REVIEW_FACTS_RECORD_HASH: 'STALE_STAGE05O_EXIT_REVIEW_FACTS_RECORD_HASH',
  STAGE05K_ROLLUP_RECON_INPUT_ONLY: 'STAGE05K_ROLLUP_RECON_INPUT_ONLY',
  STAGE05L_VALIDATION_RECON_INPUT_ONLY: 'STAGE05L_VALIDATION_RECON_INPUT_ONLY',
  STAGE05M_BOM_RECON_INPUT_ONLY: 'STAGE05M_BOM_RECON_INPUT_ONLY',
  STAGE05N_DECISION_RECORD_RECON_INPUT_ONLY: 'STAGE05N_DECISION_RECORD_RECON_INPUT_ONLY',
  STAGE05O_FACTS_RECORD_RECON_INPUT_ONLY: 'STAGE05O_FACTS_RECORD_RECON_INPUT_ONLY',
  MISSING_STAGE05N_OWNER_POLICY_OPTION_OBSERVATION: 'MISSING_STAGE05N_OWNER_POLICY_OPTION_OBSERVATION',
  MISSING_STAGE05O_OWNER_POLICY_OPTION_OBSERVATION: 'MISSING_STAGE05O_OWNER_POLICY_OPTION_OBSERVATION',
  UNKNOWN_STAGE05N_OWNER_POLICY_OPTION_OBSERVATION: 'UNKNOWN_STAGE05N_OWNER_POLICY_OPTION_OBSERVATION',
  UNKNOWN_STAGE05O_OWNER_POLICY_OPTION_OBSERVATION: 'UNKNOWN_STAGE05O_OWNER_POLICY_OPTION_OBSERVATION',
  OWNER_POLICY_OPTION_OBSERVATION_MISMATCH: 'OWNER_POLICY_OPTION_OBSERVATION_MISMATCH',
  OWNER_POLICY_OPTION_MATCH_OBSERVED_ONLY_NOT_ACCEPTED:
    'OWNER_POLICY_OPTION_MATCH_OBSERVED_ONLY_NOT_ACCEPTED',
  UNKNOWN_FIELD_FORBIDDEN: 'UNKNOWN_FIELD_FORBIDDEN',
  CALLABLE_FIELD_FORBIDDEN: 'CALLABLE_FIELD_FORBIDDEN',
  USER_PROJECT_PATH_FORBIDDEN: 'USER_PROJECT_PATH_FORBIDDEN',
  FORBIDDEN_PERMISSION_LANGUAGE_FOUND: 'FORBIDDEN_PERMISSION_LANGUAGE_FOUND',
  FORBIDDEN_POLICY_ACCEPTANCE_CLAIM: 'FORBIDDEN_POLICY_ACCEPTANCE_CLAIM',
  FORBIDDEN_PROJECT_TRUTH_ACCEPTANCE_CLAIM: 'FORBIDDEN_PROJECT_TRUTH_ACCEPTANCE_CLAIM',
  FORBIDDEN_STAGE05_EXIT_READY_CLAIM: 'FORBIDDEN_STAGE05_EXIT_READY_CLAIM',
  FORBIDDEN_STAGE06_PRE_ADMISSION_CLAIM: 'FORBIDDEN_STAGE06_PRE_ADMISSION_CLAIM',
  FORBIDDEN_STAGE06_PERMISSION_CLAIM: 'FORBIDDEN_STAGE06_PERMISSION_CLAIM',
  FORBIDDEN_APPLYTXN_CLAIM: 'FORBIDDEN_APPLYTXN_CLAIM',
  FORBIDDEN_RUNTIME_APPLY_CLAIM: 'FORBIDDEN_RUNTIME_APPLY_CLAIM',
  FORBIDDEN_STORAGE_CLAIM: 'FORBIDDEN_STORAGE_CLAIM',
  FORBIDDEN_PROJECT_WRITE_CLAIM: 'FORBIDDEN_PROJECT_WRITE_CLAIM',
  FORBIDDEN_STABLE_ID_CREATION_CLAIM: 'FORBIDDEN_STABLE_ID_CREATION_CLAIM',
  FORBIDDEN_LINEAGE_CREATION_CLAIM: 'FORBIDDEN_LINEAGE_CREATION_CLAIM',
  FORBIDDEN_REVIEW_ANCHOR_PROMOTION_CLAIM: 'FORBIDDEN_REVIEW_ANCHOR_PROMOTION_CLAIM',
  FORBIDDEN_STRUCTURAL_AUTO_APPLY_CLAIM: 'FORBIDDEN_STRUCTURAL_AUTO_APPLY_CLAIM',
  FORBIDDEN_UI_DOCX_NETWORK_DEPENDENCY_CLAIM: 'FORBIDDEN_UI_DOCX_NETWORK_DEPENDENCY_CLAIM',
});

export const STAGE05_FALSE_GREEN_RECON_RECORD_DECISIONS = Object.freeze({
  STAGE05_FALSE_GREEN_RECON_FACTS_RECORDED: 'STAGE05_FALSE_GREEN_RECON_FACTS_RECORDED',
  STAGE05_FALSE_GREEN_RECON_FACTS_BLOCKED: 'STAGE05_FALSE_GREEN_RECON_FACTS_BLOCKED',
  STOP_OWNER_REVIEW_REQUIRED: 'STOP_OWNER_REVIEW_REQUIRED',
});

export const STAGE05_FALSE_GREEN_RECON_OWNER_POLICY_OPTIONS = OWNER_POLICY_OPTIONS;

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asTextList(value) {
  if (Array.isArray(value)) {
    return value;
  }
  return value === undefined || value === null ? [] : [value];
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
    reasons.push(STAGE05_FALSE_GREEN_RECON_RECORD_REASON_CODES.MISSING_CHANGED_BASENAMES_EVIDENCE);
    return;
  }
  const changedBasenames = new Set(input.changedBasenames);
  if (
    input.changedBasenames.length !== ALLOWED_CHANGED_BASENAMES.size
    || changedBasenames.size !== ALLOWED_CHANGED_BASENAMES.size
    || Array.from(ALLOWED_CHANGED_BASENAMES).some((basename) => !changedBasenames.has(basename))
  ) {
    reasons.push(STAGE05_FALSE_GREEN_RECON_RECORD_REASON_CODES.MISSING_CHANGED_BASENAMES_EVIDENCE);
  }
  if (input.changedBasenames.some((basename) => !ALLOWED_CHANGED_BASENAMES.has(basename))) {
    reasons.push(STAGE05_FALSE_GREEN_RECON_RECORD_REASON_CODES.FORBIDDEN_BASENAME_CHANGE);
  }
}

function pushInputShapeReasons(input, reasons) {
  if (Object.keys(input).some((key) => !ALLOWED_INPUT_KEYS.has(key))) {
    reasons.push(STAGE05_FALSE_GREEN_RECON_RECORD_REASON_CODES.UNKNOWN_FIELD_FORBIDDEN);
  }
  if (containsCallable(input)) {
    reasons.push(STAGE05_FALSE_GREEN_RECON_RECORD_REASON_CODES.CALLABLE_FIELD_FORBIDDEN);
  }
  if (containsUserProjectPath(input)) {
    reasons.push(STAGE05_FALSE_GREEN_RECON_RECORD_REASON_CODES.USER_PROJECT_PATH_FORBIDDEN);
  }
}

function resolveHashRef(input = {}, spec) {
  const ref = isObject(input[spec.refKey]) ? input[spec.refKey] : {};
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
    reasonCodes.push(STAGE05_FALSE_GREEN_RECON_RECORD_REASON_CODES[spec.missingReason]);
  } else {
    reasonCodes.push(STAGE05_FALSE_GREEN_RECON_RECORD_REASON_CODES[spec.advisoryReason]);
  }
  if (stale) {
    reasonCodes.push(STAGE05_FALSE_GREEN_RECON_RECORD_REASON_CODES[spec.staleReason]);
  }

  return withCanonicalHash({
    refKind: 'Stage05FalseGreenReconRequiredHashRef',
    contourId: CONTOUR_ID,
    refId: spec.refId,
    refClass: spec.refClass,
    evidenceHash,
    expectedEvidenceHash,
    evidencePresent,
    stale,
    factsOnly: true,
    reconOnly: true,
    stage05ExitReady: false,
    stage06PreAdmitted: false,
    permissionGranted: false,
    reasonCodes: uniqueSorted(reasonCodes),
  });
}

function resolveOwnerPolicyOptionConsistency(input = {}) {
  const stage05nOption = hasText(input.stage05nOwnerPolicyOptionObserved)
    ? input.stage05nOwnerPolicyOptionObserved
    : '';
  const stage05oOption = hasText(input.stage05oOwnerPolicyOptionObserved)
    ? input.stage05oOwnerPolicyOptionObserved
    : '';
  const stage05nOptionKnown = Object.values(OWNER_POLICY_OPTIONS).includes(stage05nOption);
  const stage05oOptionKnown = Object.values(OWNER_POLICY_OPTIONS).includes(stage05oOption);
  const observationsMatch = stage05nOptionKnown && stage05oOptionKnown && stage05nOption === stage05oOption;
  const reasonCodes = [];

  if (!hasText(stage05nOption)) {
    reasonCodes.push(
      STAGE05_FALSE_GREEN_RECON_RECORD_REASON_CODES.MISSING_STAGE05N_OWNER_POLICY_OPTION_OBSERVATION,
    );
  } else if (!stage05nOptionKnown) {
    reasonCodes.push(
      STAGE05_FALSE_GREEN_RECON_RECORD_REASON_CODES.UNKNOWN_STAGE05N_OWNER_POLICY_OPTION_OBSERVATION,
    );
  }
  if (!hasText(stage05oOption)) {
    reasonCodes.push(
      STAGE05_FALSE_GREEN_RECON_RECORD_REASON_CODES.MISSING_STAGE05O_OWNER_POLICY_OPTION_OBSERVATION,
    );
  } else if (!stage05oOptionKnown) {
    reasonCodes.push(
      STAGE05_FALSE_GREEN_RECON_RECORD_REASON_CODES.UNKNOWN_STAGE05O_OWNER_POLICY_OPTION_OBSERVATION,
    );
  }
  if (stage05nOptionKnown && stage05oOptionKnown) {
    reasonCodes.push(
      observationsMatch
        ? STAGE05_FALSE_GREEN_RECON_RECORD_REASON_CODES.OWNER_POLICY_OPTION_MATCH_OBSERVED_ONLY_NOT_ACCEPTED
        : STAGE05_FALSE_GREEN_RECON_RECORD_REASON_CODES.OWNER_POLICY_OPTION_OBSERVATION_MISMATCH,
    );
  }

  return withCanonicalHash({
    observationKind: 'Stage05FalseGreenReconOwnerPolicyOptionConsistencyObservation',
    contourId: CONTOUR_ID,
    stage05nOwnerPolicyOptionObserved: stage05nOption,
    stage05oOwnerPolicyOptionObserved: stage05oOption,
    stage05nOptionKnown,
    stage05oOptionKnown,
    observationsMatch,
    observedOnly: true,
    matchAcceptedAsProjectTruth: false,
    acceptedAsProjectTruth: false,
    policyAccepted: false,
    stage05ExitReady: false,
    stage06PreAdmitted: false,
    applyTxnAllowed: false,
    stableBlockInstanceIdCreated: false,
    blockLineageCreated: false,
    reviewAnchorHandlePromoted: false,
    reasonCodes: uniqueSorted(reasonCodes),
  });
}

function pushForbiddenClaimReasons(input = {}, reasons) {
  if (
    isClaimed(input.policyAcceptanceClaimed)
    || isClaimed(input.policyAcceptedClaimed)
    || isClaimed(input.ownerPolicyAcceptedClaimed)
  ) {
    reasons.push(STAGE05_FALSE_GREEN_RECON_RECORD_REASON_CODES.FORBIDDEN_POLICY_ACCEPTANCE_CLAIM);
  }
  if (
    isClaimed(input.projectTruthAcceptedClaimed)
    || isClaimed(input.projectTruthPolicyAcceptedClaimed)
    || isClaimed(input.ownerPolicyDecisionAcceptedAsProjectTruthClaimed)
  ) {
    reasons.push(STAGE05_FALSE_GREEN_RECON_RECORD_REASON_CODES.FORBIDDEN_PROJECT_TRUTH_ACCEPTANCE_CLAIM);
  }
  if (
    isClaimed(input.stage05ExitReadyClaimed)
    || isClaimed(input.identityPolicyReadyClaimed)
    || isClaimed(input.readyStatusClaimed)
  ) {
    reasons.push(STAGE05_FALSE_GREEN_RECON_RECORD_REASON_CODES.FORBIDDEN_STAGE05_EXIT_READY_CLAIM);
  }
  if (isClaimed(input.stage06PreAdmittedClaimed) || isClaimed(input.stage06PreAdmissionClaimed)) {
    reasons.push(STAGE05_FALSE_GREEN_RECON_RECORD_REASON_CODES.FORBIDDEN_STAGE06_PRE_ADMISSION_CLAIM);
  }
  if (isClaimed(input.stage06PermissionClaimed) || isClaimed(input.stage06AdmissionClaimed)) {
    reasons.push(STAGE05_FALSE_GREEN_RECON_RECORD_REASON_CODES.FORBIDDEN_STAGE06_PERMISSION_CLAIM);
  }
  if (
    isClaimed(input.applyTxnClaimed)
    || isClaimed(input.applyTxnPermissionClaimed)
    || isClaimed(input.applyTxnAllowedClaimed)
    || isClaimed(input.applyTxnCreatedClaimed)
  ) {
    reasons.push(STAGE05_FALSE_GREEN_RECON_RECORD_REASON_CODES.FORBIDDEN_APPLYTXN_CLAIM);
  }
  if (
    isClaimed(input.runtimeApplyClaimed)
    || isClaimed(input.runtimeApplyPerformedClaimed)
    || isClaimed(input.applyOpCreatedClaimed)
    || isClaimed(input.applyOpPerformedClaimed)
  ) {
    reasons.push(STAGE05_FALSE_GREEN_RECON_RECORD_REASON_CODES.FORBIDDEN_RUNTIME_APPLY_CLAIM);
  }
  if (
    isClaimed(input.storageMigrationClaimed)
    || isClaimed(input.storageMutationClaimed)
    || isClaimed(input.storageWriteClaimed)
  ) {
    reasons.push(STAGE05_FALSE_GREEN_RECON_RECORD_REASON_CODES.FORBIDDEN_STORAGE_CLAIM);
  }
  if (isClaimed(input.projectWriteClaimed) || isClaimed(input.projectWritePerformedClaimed)) {
    reasons.push(STAGE05_FALSE_GREEN_RECON_RECORD_REASON_CODES.FORBIDDEN_PROJECT_WRITE_CLAIM);
  }
  if (
    isClaimed(input.stableIdCreationClaimed)
    || isClaimed(input.stableBlockInstanceIdCreatedClaimed)
    || isClaimed(input.persistStableBlockInstanceIdClaimed)
  ) {
    reasons.push(STAGE05_FALSE_GREEN_RECON_RECORD_REASON_CODES.FORBIDDEN_STABLE_ID_CREATION_CLAIM);
  }
  if (
    isClaimed(input.blockLineageCreatedClaimed)
    || isClaimed(input.blockLineagePersistedClaimed)
    || isClaimed(input.createBlockLineageClaimed)
  ) {
    reasons.push(STAGE05_FALSE_GREEN_RECON_RECORD_REASON_CODES.FORBIDDEN_LINEAGE_CREATION_CLAIM);
  }
  if (isClaimed(input.reviewAnchorPromotedClaimed) || isClaimed(input.reviewAnchorHandlePromotedClaimed)) {
    reasons.push(STAGE05_FALSE_GREEN_RECON_RECORD_REASON_CODES.FORBIDDEN_REVIEW_ANCHOR_PROMOTION_CLAIM);
  }
  if (isClaimed(input.structuralAutoApplyClaimed) || isClaimed(input.moveSplitMergeAutoApplyClaimed)) {
    reasons.push(STAGE05_FALSE_GREEN_RECON_RECORD_REASON_CODES.FORBIDDEN_STRUCTURAL_AUTO_APPLY_CLAIM);
  }
  if (
    isClaimed(input.uiClaimed)
    || isClaimed(input.docxClaimed)
    || isClaimed(input.networkClaimed)
    || isClaimed(input.dependencyChangeClaimed)
  ) {
    reasons.push(STAGE05_FALSE_GREEN_RECON_RECORD_REASON_CODES.FORBIDDEN_UI_DOCX_NETWORK_DEPENDENCY_CLAIM);
  }
}

function permissionLanguageFindings(input = {}) {
  const rawValues = [
    ...asArray(input.permissionLanguageClaims),
    ...asTextList(input.claimLanguage),
    ...asTextList(input.reviewLanguage),
  ].filter(hasText);
  const findings = [];
  for (const value of rawValues) {
    const normalized = value.toUpperCase();
    const matchedTerms = FORBIDDEN_PERMISSION_LANGUAGE.filter((term) => normalized.includes(term));
    if (matchedTerms.length > 0) {
      findings.push(withCanonicalHash({
        findingKind: 'ForbiddenStage05FalseGreenReconPermissionLanguageFinding',
        contourId: CONTOUR_ID,
        language: value,
        matchedTerms: uniqueSorted(matchedTerms),
        reasonCode: STAGE05_FALSE_GREEN_RECON_RECORD_REASON_CODES.FORBIDDEN_PERMISSION_LANGUAGE_FOUND,
      }));
    }
  }
  return findings;
}

function createDecision(blockedReasons) {
  const stopReasons = new Set([
    STAGE05_FALSE_GREEN_RECON_RECORD_REASON_CODES.MISSING_STAGE05N_OWNER_POLICY_DECISION_RECORD_HASH,
    STAGE05_FALSE_GREEN_RECON_RECORD_REASON_CODES.MISSING_STAGE05O_EXIT_REVIEW_FACTS_RECORD_HASH,
    STAGE05_FALSE_GREEN_RECON_RECORD_REASON_CODES.MISSING_STAGE05N_OWNER_POLICY_OPTION_OBSERVATION,
    STAGE05_FALSE_GREEN_RECON_RECORD_REASON_CODES.MISSING_STAGE05O_OWNER_POLICY_OPTION_OBSERVATION,
  ]);
  const outputDecision = blockedReasons.some((reason) => stopReasons.has(reason))
    ? STAGE05_FALSE_GREEN_RECON_RECORD_DECISIONS.STOP_OWNER_REVIEW_REQUIRED
    : (
      blockedReasons.length > 0
        ? STAGE05_FALSE_GREEN_RECON_RECORD_DECISIONS.STAGE05_FALSE_GREEN_RECON_FACTS_BLOCKED
        : STAGE05_FALSE_GREEN_RECON_RECORD_DECISIONS.STAGE05_FALSE_GREEN_RECON_FACTS_RECORDED
    );

  return withCanonicalHash({
    decisionKind: DECISION_KIND,
    contourId: CONTOUR_ID,
    outputDecision,
    blocked: blockedReasons.length > 0,
    blockedReasons,
  });
}

function buildReviewBom({ hashRefs, ownerPolicyOptionConsistency, blockedReasons, permissionFindings }) {
  return withCanonicalHash({
    bomKind: 'Stage05FalseGreenReconBOM',
    contourId: CONTOUR_ID,
    factsOnly: true,
    reconOnly: true,
    requiredHashRefCount: hashRefs.length,
    presentHashRefCount: hashRefs.filter((ref) => ref.evidencePresent).length,
    missingHashRefCount: hashRefs.filter((ref) => !ref.evidencePresent).length,
    staleHashRefCount: hashRefs.filter((ref) => ref.stale).length,
    ownerPolicyOptionObservedOnlyCount: 2,
    ownerPolicyOptionMatchObservedOnlyCount: ownerPolicyOptionConsistency.observationsMatch ? 1 : 0,
    permissionLanguageFindingCount: permissionFindings.length,
    forbiddenClaimCount: blockedReasons.filter((code) => code.startsWith('FORBIDDEN_')).length,
    falseGreenFlagCount: 0,
    stage05ExitReadyCount: 0,
    stage06PreAdmissionCount: 0,
    stage06AdmissionCount: 0,
    stage06PermissionCount: 0,
    applyTxnPermissionCount: 0,
    runtimeApplyCount: 0,
    applyOpCreationCount: 0,
    projectWriteCount: 0,
    storageMutationCount: 0,
    storageMigrationCount: 0,
    stableIdCreationCount: 0,
    lineageCreationCount: 0,
    reviewAnchorPromotionCount: 0,
    structuralAutoApplyCount: 0,
    uiDocxNetworkDependencyCount: 0,
    permissionSignalCount: 0,
    blockedReasonCodes: blockedReasons,
    hashRefReasonCodes: uniqueSorted(hashRefs.flatMap((ref) => ref.reasonCodes)),
    ownerPolicyOptionReasonCodes: ownerPolicyOptionConsistency.reasonCodes,
    hashRefHashes: hashRefs.map((ref) => ref.canonicalHash).sort(),
    ownerPolicyOptionConsistencyHash: ownerPolicyOptionConsistency.canonicalHash,
    permissionLanguageFindingHashes: permissionFindings.map((finding) => finding.canonicalHash).sort(),
  });
}

function buildNextStepPreview({ blockedReasons, reviewBom }) {
  return withCanonicalHash({
    packetKind: 'Stage05FalseGreenReconNextStepPreview',
    contourId: CONTOUR_ID,
    previewOnly: true,
    nextStepRecommendationOnly: true,
    automaticNextContourOpened: false,
    recommendedSeparateNextReview: 'OWNER_REVIEW_REQUIRED_IF_RECON_BLOCKED_ONLY',
    reviewBomHash: reviewBom.canonicalHash,
    blockedReasonCodes: blockedReasons,
    stage05ExitReady: false,
    stage06PreAdmitted: false,
    stage06AdmissionGranted: false,
    stage06PermissionGranted: false,
    applyTxnAllowed: false,
  });
}

export function compileStage05FalseGreenReconRecord(input = {}) {
  const blockedReasons = [];
  pushChangedBasenameReasons(input, blockedReasons);
  pushInputShapeReasons(input, blockedReasons);
  pushForbiddenClaimReasons(input, blockedReasons);

  const hashRefs = HASH_REF_SPECS.map((spec) => resolveHashRef(input, spec));
  for (const ref of hashRefs) {
    for (const code of ref.reasonCodes) {
      if (BLOCKING_REASON_CODES.has(code)) {
        blockedReasons.push(code);
      }
    }
  }

  const ownerPolicyOptionConsistency = resolveOwnerPolicyOptionConsistency(input);
  for (const code of ownerPolicyOptionConsistency.reasonCodes) {
    if (BLOCKING_REASON_CODES.has(code)) {
      blockedReasons.push(code);
    }
  }

  const permissionFindings = permissionLanguageFindings(input);
  if (permissionFindings.length > 0) {
    blockedReasons.push(STAGE05_FALSE_GREEN_RECON_RECORD_REASON_CODES.FORBIDDEN_PERMISSION_LANGUAGE_FOUND);
  }

  const uniqueBlockedReasons = uniqueSorted(blockedReasons);
  const decision = createDecision(uniqueBlockedReasons);
  const reviewBom = buildReviewBom({
    hashRefs,
    ownerPolicyOptionConsistency,
    blockedReasons: uniqueBlockedReasons,
    permissionFindings,
  });
  const nextStepPreview = buildNextStepPreview({ blockedReasons: uniqueBlockedReasons, reviewBom });

  return withCanonicalHash({
    resultKind: RESULT_KIND,
    contourId: CONTOUR_ID,
    outputDecision: decision.outputDecision,
    stage05FalseGreenReconFactsRecorded:
      decision.outputDecision === STAGE05_FALSE_GREEN_RECON_RECORD_DECISIONS.STAGE05_FALSE_GREEN_RECON_FACTS_RECORDED,
    stage05FalseGreenReconRecordOnly: true,
    factsOnly: true,
    reconOnly: true,
    blocked: uniqueBlockedReasons.length > 0,
    blockedReasons: uniqueBlockedReasons,
    ownerPolicyOptionObservedOnly: true,
    ownerPolicyOptionMatchObservedOnly: ownerPolicyOptionConsistency.observationsMatch,
    ownerPolicyOptionMatchAcceptedAsProjectTruth: false,
    falseGreenDetected: false,
    falseGreenConfirmed: false,
    falseGreenFlagCreated: false,
    stage05ExitReady: false,
    stage06PreAdmitted: false,
    stage06PreAdmissionGranted: false,
    stage06AdmissionGranted: false,
    stage06PermissionGranted: false,
    applyTxnAllowed: false,
    applyTxnCreated: false,
    applyTxnPerformed: false,
    runtimeApplyPerformed: false,
    applyOpCreated: false,
    applyOpPerformed: false,
    projectWritePerformed: false,
    storageMutationPerformed: false,
    storageMigrationPerformed: false,
    stableIdCreated: false,
    stableBlockInstanceIdCreated: false,
    blockLineageCreated: false,
    blockLineagePersisted: false,
    reviewAnchorHandlePromoted: false,
    structuralAutoApplyAllowed: false,
    structuralAutoApplyPerformed: false,
    projectTruthAccepted: false,
    policyAcceptedAsProjectTruth: false,
    automaticNextContourOpened: false,
    uiTouched: false,
    docxTouched: false,
    networkTouched: false,
    dependencyTouched: false,
    permissionLanguageFindingCount: reviewBom.permissionLanguageFindingCount,
    hashRefs,
    ownerPolicyOptionConsistency,
    permissionFindings,
    decisions: [decision],
    reviewBom,
    nextStepPreview,
  });
}

export const runStage05FalseGreenReconRecord = compileStage05FalseGreenReconRecord;
export const compileStage05FalseGreenReconRecordOnly = compileStage05FalseGreenReconRecord;
export const runStage05FalseGreenReconRecordOnly = compileStage05FalseGreenReconRecord;

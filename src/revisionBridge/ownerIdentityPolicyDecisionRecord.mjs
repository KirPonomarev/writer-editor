import { canonicalHash } from './reviewIrKernel.mjs';

const RESULT_KIND = 'STAGE_05N_OWNER_IDENTITY_POLICY_DECISION_RECORD_RESULT_001';
const DECISION_KIND = 'STAGE_05N_OWNER_IDENTITY_POLICY_DECISION_RECORD_DECISION_001';
const CONTOUR_ID = 'STAGE05N_OWNER_IDENTITY_POLICY_DECISION_RECORD_ONLY_001';
const EXPECTED_PACKET_KIND = 'STAGE05N_OWNER_IDENTITY_POLICY_DECISION_PACKET_001';
const EXPECTED_PACKET_TARGET = CONTOUR_ID;

const ALLOWED_CHANGED_BASENAMES = new Set([
  'ownerIdentityPolicyDecisionRecord.mjs',
  'ownerIdentityPolicyDecisionRecord.contract.test.js',
  'STAGE05N_OWNER_IDENTITY_POLICY_DECISION_RECORD_ONLY_001.md',
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
    packetHashKey: 'stage05kBlockerRollupHash',
    refId: 'STAGE05K_BLOCKER_ROLLUP_REF',
    refClass: 'ROLLUP_ONLY_STAGE05K',
    missingReason: 'MISSING_STAGE05K_BLOCKER_ROLLUP_HASH',
    staleReason: 'STALE_STAGE05K_BLOCKER_ROLLUP_HASH',
    advisoryReason: 'STAGE05K_ROLLUP_NOT_EXIT_READY',
  },
  {
    refKey: 'stage05lOwnerPacketValidationRef',
    hashKey: 'stage05lOwnerPacketValidationHash',
    expectedKey: 'stage05lOwnerPacketValidationHashExpected',
    packetHashKey: 'stage05lOwnerPacketValidationHash',
    refId: 'STAGE05L_OWNER_PACKET_VALIDATION_REF',
    refClass: 'EVIDENCE_ONLY_STAGE05L',
    missingReason: 'MISSING_STAGE05L_OWNER_PACKET_VALIDATION_HASH',
    staleReason: 'STALE_STAGE05L_OWNER_PACKET_VALIDATION_HASH',
    advisoryReason: 'STAGE05L_VALIDATION_NOT_POLICY_ACCEPTANCE',
  },
  {
    refKey: 'stage05mEvidenceChainReviewBomRef',
    hashKey: 'stage05mEvidenceChainReviewBomHash',
    expectedKey: 'stage05mEvidenceChainReviewBomHashExpected',
    packetHashKey: 'stage05mEvidenceChainReviewBomHash',
    refId: 'STAGE05M_EVIDENCE_CHAIN_REVIEW_BOM_REF',
    refClass: 'BOM_ONLY_STAGE05M',
    missingReason: 'MISSING_STAGE05M_EVIDENCE_CHAIN_REVIEW_BOM_HASH',
    staleReason: 'STALE_STAGE05M_EVIDENCE_CHAIN_REVIEW_BOM_HASH',
    advisoryReason: 'STAGE05M_BOM_NOT_PERMISSION',
  },
]);

const OWNER_PACKET_ALLOWED_KEYS = new Set([
  'packetKind',
  'packetTarget',
  'ownerDecisionId',
  'selectedPolicyOption',
  'stage05kBlockerRollupHash',
  'stage05lOwnerPacketValidationHash',
  'stage05mEvidenceChainReviewBomHash',
  'ownerUnderstandsDecisionRecordOnly',
  'ownerUnderstandsNoProjectTruth',
  'ownerUnderstandsNoStage05ExitReady',
  'ownerUnderstandsNoStage06',
  'ownerUnderstandsNoApplyTxn',
  'ownerUnderstandsNoStorageMigration',
  'ownerUnderstandsNoStableIdCreation',
  'ownerUnderstandsNoLineageCreation',
  'ownerUnderstandsNoReviewAnchorPromotion',
  'ownerUnderstandsNoRuntimeWrite',
  'permissionLanguageClaims',
  'claimLanguage',
  'decisionLanguage',
  'ownerPolicyLanguage',
  'readyStatusClaimed',
  'ownerPolicyAcceptedClaimed',
  'policyAcceptanceClaimed',
  'policyAcceptedClaimed',
  'projectTruthAcceptedClaimed',
  'projectTruthPolicyAcceptedClaimed',
  'ownerPolicyDecisionAcceptedAsProjectTruthClaimed',
  'stage05ExitReadyClaimed',
  'identityPolicyReadyClaimed',
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

const UNDERSTANDING_FLAGS = [
  'ownerUnderstandsDecisionRecordOnly',
  'ownerUnderstandsNoProjectTruth',
  'ownerUnderstandsNoStage05ExitReady',
  'ownerUnderstandsNoStage06',
  'ownerUnderstandsNoApplyTxn',
  'ownerUnderstandsNoStorageMigration',
  'ownerUnderstandsNoStableIdCreation',
  'ownerUnderstandsNoLineageCreation',
  'ownerUnderstandsNoReviewAnchorPromotion',
  'ownerUnderstandsNoRuntimeWrite',
];

const BLOCKING_REASON_CODES = new Set([
  'MISSING_CHANGED_BASENAMES_EVIDENCE',
  'FORBIDDEN_BASENAME_CHANGE',
  'MISSING_STAGE05K_BLOCKER_ROLLUP_HASH',
  'STALE_STAGE05K_BLOCKER_ROLLUP_HASH',
  'MISSING_STAGE05L_OWNER_PACKET_VALIDATION_HASH',
  'STALE_STAGE05L_OWNER_PACKET_VALIDATION_HASH',
  'MISSING_STAGE05M_EVIDENCE_CHAIN_REVIEW_BOM_HASH',
  'STALE_STAGE05M_EVIDENCE_CHAIN_REVIEW_BOM_HASH',
  'MISSING_OWNER_POLICY_DECISION_PACKET',
  'WRONG_OWNER_POLICY_DECISION_PACKET_KIND',
  'WRONG_OWNER_POLICY_DECISION_PACKET_TARGET',
  'MISSING_OWNER_DECISION_ID',
  'MISSING_OWNER_POLICY_OPTION',
  'UNKNOWN_OWNER_POLICY_OPTION',
  'OWNER_UNDERSTANDING_FLAG_MISSING',
  'OWNER_POLICY_DECISION_PACKET_UNKNOWN_FIELD_FORBIDDEN',
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
  'FORBIDDEN_STORAGE_MIGRATION_CLAIM',
  'FORBIDDEN_PROJECT_WRITE_CLAIM',
  'FORBIDDEN_STABLE_ID_CREATION_CLAIM',
  'FORBIDDEN_LINEAGE_CREATION_CLAIM',
  'FORBIDDEN_REVIEW_ANCHOR_PROMOTION_CLAIM',
  'FORBIDDEN_STRUCTURAL_AUTO_APPLY_CLAIM',
  'FORBIDDEN_UI_DOCX_NETWORK_DEPENDENCY_CLAIM',
]);

export const OWNER_IDENTITY_POLICY_DECISION_RECORD_REASON_CODES = Object.freeze({
  FORBIDDEN_BASENAME_CHANGE: 'FORBIDDEN_BASENAME_CHANGE',
  MISSING_CHANGED_BASENAMES_EVIDENCE: 'MISSING_CHANGED_BASENAMES_EVIDENCE',
  MISSING_STAGE05K_BLOCKER_ROLLUP_HASH: 'MISSING_STAGE05K_BLOCKER_ROLLUP_HASH',
  STALE_STAGE05K_BLOCKER_ROLLUP_HASH: 'STALE_STAGE05K_BLOCKER_ROLLUP_HASH',
  MISSING_STAGE05L_OWNER_PACKET_VALIDATION_HASH: 'MISSING_STAGE05L_OWNER_PACKET_VALIDATION_HASH',
  STALE_STAGE05L_OWNER_PACKET_VALIDATION_HASH: 'STALE_STAGE05L_OWNER_PACKET_VALIDATION_HASH',
  MISSING_STAGE05M_EVIDENCE_CHAIN_REVIEW_BOM_HASH: 'MISSING_STAGE05M_EVIDENCE_CHAIN_REVIEW_BOM_HASH',
  STALE_STAGE05M_EVIDENCE_CHAIN_REVIEW_BOM_HASH: 'STALE_STAGE05M_EVIDENCE_CHAIN_REVIEW_BOM_HASH',
  STAGE05K_ROLLUP_NOT_EXIT_READY: 'STAGE05K_ROLLUP_NOT_EXIT_READY',
  STAGE05L_VALIDATION_NOT_POLICY_ACCEPTANCE: 'STAGE05L_VALIDATION_NOT_POLICY_ACCEPTANCE',
  STAGE05M_BOM_NOT_PERMISSION: 'STAGE05M_BOM_NOT_PERMISSION',
  MISSING_OWNER_POLICY_DECISION_PACKET: 'MISSING_OWNER_POLICY_DECISION_PACKET',
  WRONG_OWNER_POLICY_DECISION_PACKET_KIND: 'WRONG_OWNER_POLICY_DECISION_PACKET_KIND',
  WRONG_OWNER_POLICY_DECISION_PACKET_TARGET: 'WRONG_OWNER_POLICY_DECISION_PACKET_TARGET',
  MISSING_OWNER_DECISION_ID: 'MISSING_OWNER_DECISION_ID',
  MISSING_OWNER_POLICY_OPTION: 'MISSING_OWNER_POLICY_OPTION',
  UNKNOWN_OWNER_POLICY_OPTION: 'UNKNOWN_OWNER_POLICY_OPTION',
  OWNER_POLICY_OPTION_RECORDED_AS_EVIDENCE_ONLY: 'OWNER_POLICY_OPTION_RECORDED_AS_EVIDENCE_ONLY',
  REVIEW_ANCHOR_HANDLE_REMAINS_PACKET_LOCAL: 'REVIEW_ANCHOR_HANDLE_REMAINS_PACKET_LOCAL',
  STABLE_IDENTITY_POLICY_DEFERRED_NOT_CREATED: 'STABLE_IDENTITY_POLICY_DEFERRED_NOT_CREATED',
  NARROW_STABLE_IDENTITY_POLICY_NOT_EXECUTED: 'NARROW_STABLE_IDENTITY_POLICY_NOT_EXECUTED',
  OWNER_UNDERSTANDING_FLAG_MISSING: 'OWNER_UNDERSTANDING_FLAG_MISSING',
  OWNER_POLICY_DECISION_PACKET_UNKNOWN_FIELD_FORBIDDEN: 'OWNER_POLICY_DECISION_PACKET_UNKNOWN_FIELD_FORBIDDEN',
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
  FORBIDDEN_STORAGE_MIGRATION_CLAIM: 'FORBIDDEN_STORAGE_MIGRATION_CLAIM',
  FORBIDDEN_PROJECT_WRITE_CLAIM: 'FORBIDDEN_PROJECT_WRITE_CLAIM',
  FORBIDDEN_STABLE_ID_CREATION_CLAIM: 'FORBIDDEN_STABLE_ID_CREATION_CLAIM',
  FORBIDDEN_LINEAGE_CREATION_CLAIM: 'FORBIDDEN_LINEAGE_CREATION_CLAIM',
  FORBIDDEN_REVIEW_ANCHOR_PROMOTION_CLAIM: 'FORBIDDEN_REVIEW_ANCHOR_PROMOTION_CLAIM',
  FORBIDDEN_STRUCTURAL_AUTO_APPLY_CLAIM: 'FORBIDDEN_STRUCTURAL_AUTO_APPLY_CLAIM',
  FORBIDDEN_UI_DOCX_NETWORK_DEPENDENCY_CLAIM: 'FORBIDDEN_UI_DOCX_NETWORK_DEPENDENCY_CLAIM',
});

export const OWNER_IDENTITY_POLICY_DECISION_RECORD_DECISIONS = Object.freeze({
  OWNER_IDENTITY_POLICY_DECISION_RECORDED: 'OWNER_IDENTITY_POLICY_DECISION_RECORDED',
  OWNER_IDENTITY_POLICY_DECISION_BLOCKED: 'OWNER_IDENTITY_POLICY_DECISION_BLOCKED',
  STOP_OWNER_POLICY_REQUIRED: 'STOP_OWNER_POLICY_REQUIRED',
});

export const OWNER_IDENTITY_POLICY_DECISION_OPTIONS = OWNER_POLICY_OPTIONS;

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function hasText(value) {
  return typeof value === 'string' && value.length > 0;
}

function upper(value) {
  return hasText(value) ? value.toUpperCase() : '';
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
    reasons.push(OWNER_IDENTITY_POLICY_DECISION_RECORD_REASON_CODES.MISSING_CHANGED_BASENAMES_EVIDENCE);
    return;
  }
  if (input.changedBasenames.some((basename) => !ALLOWED_CHANGED_BASENAMES.has(basename))) {
    reasons.push(OWNER_IDENTITY_POLICY_DECISION_RECORD_REASON_CODES.FORBIDDEN_BASENAME_CHANGE);
  }
}

function resolveHashRef(input = {}, packet = {}, spec) {
  const ref = isObject(input[spec.refKey]) ? input[spec.refKey] : {};
  const evidenceHash = hasText(ref.evidenceHash)
    ? ref.evidenceHash
    : (hasText(input[spec.hashKey]) ? input[spec.hashKey] : (hasText(packet[spec.packetHashKey]) ? packet[spec.packetHashKey] : ''));
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
    reasonCodes.push(OWNER_IDENTITY_POLICY_DECISION_RECORD_REASON_CODES[spec.missingReason]);
  } else {
    reasonCodes.push(OWNER_IDENTITY_POLICY_DECISION_RECORD_REASON_CODES[spec.advisoryReason]);
  }
  if (stale) {
    reasonCodes.push(OWNER_IDENTITY_POLICY_DECISION_RECORD_REASON_CODES[spec.staleReason]);
  }

  return withCanonicalHash({
    refKind: 'OwnerIdentityPolicyDecisionRequiredRef',
    contourId: CONTOUR_ID,
    refId: spec.refId,
    refClass: spec.refClass,
    evidenceHash,
    expectedEvidenceHash,
    evidencePresent,
    stale,
    exitReady: false,
    permissionGranted: false,
    policyAccepted: false,
    reasonCodes: uniqueSorted(reasonCodes),
  });
}

function pushForbiddenClaimReasons(source = {}, reasons) {
  if (
    isClaimed(source.ownerPolicyAcceptedClaimed)
    || isClaimed(source.policyAcceptanceClaimed)
    || isClaimed(source.policyAcceptedClaimed)
  ) {
    reasons.push(OWNER_IDENTITY_POLICY_DECISION_RECORD_REASON_CODES.FORBIDDEN_POLICY_ACCEPTANCE_CLAIM);
  }
  if (
    isClaimed(source.projectTruthAcceptedClaimed)
    || isClaimed(source.projectTruthPolicyAcceptedClaimed)
    || isClaimed(source.ownerPolicyDecisionAcceptedAsProjectTruthClaimed)
  ) {
    reasons.push(OWNER_IDENTITY_POLICY_DECISION_RECORD_REASON_CODES.FORBIDDEN_PROJECT_TRUTH_ACCEPTANCE_CLAIM);
  }
  if (
    isClaimed(source.stage05ExitReadyClaimed)
    || isClaimed(source.identityPolicyReadyClaimed)
    || isClaimed(source.readyStatusClaimed)
  ) {
    reasons.push(OWNER_IDENTITY_POLICY_DECISION_RECORD_REASON_CODES.FORBIDDEN_STAGE05_EXIT_READY_CLAIM);
  }
  if (isClaimed(source.stage06PreAdmittedClaimed) || isClaimed(source.stage06PreAdmissionClaimed)) {
    reasons.push(OWNER_IDENTITY_POLICY_DECISION_RECORD_REASON_CODES.FORBIDDEN_STAGE06_PRE_ADMISSION_CLAIM);
  }
  if (isClaimed(source.stage06PermissionClaimed) || isClaimed(source.stage06AdmissionClaimed)) {
    reasons.push(OWNER_IDENTITY_POLICY_DECISION_RECORD_REASON_CODES.FORBIDDEN_STAGE06_PERMISSION_CLAIM);
  }
  if (
    isClaimed(source.applyTxnClaimed)
    || isClaimed(source.applyTxnPermissionClaimed)
    || isClaimed(source.applyTxnAllowedClaimed)
    || isClaimed(source.applyTxnCreatedClaimed)
  ) {
    reasons.push(OWNER_IDENTITY_POLICY_DECISION_RECORD_REASON_CODES.FORBIDDEN_APPLYTXN_CLAIM);
  }
  if (
    isClaimed(source.runtimeApplyClaimed)
    || isClaimed(source.runtimeApplyPerformedClaimed)
    || isClaimed(source.applyOpCreatedClaimed)
    || isClaimed(source.applyOpPerformedClaimed)
  ) {
    reasons.push(OWNER_IDENTITY_POLICY_DECISION_RECORD_REASON_CODES.FORBIDDEN_RUNTIME_APPLY_CLAIM);
  }
  if (isClaimed(source.storageMigrationClaimed) || isClaimed(source.storageMutationClaimed)) {
    reasons.push(OWNER_IDENTITY_POLICY_DECISION_RECORD_REASON_CODES.FORBIDDEN_STORAGE_MIGRATION_CLAIM);
  }
  if (isClaimed(source.projectWriteClaimed) || isClaimed(source.projectWritePerformedClaimed)) {
    reasons.push(OWNER_IDENTITY_POLICY_DECISION_RECORD_REASON_CODES.FORBIDDEN_PROJECT_WRITE_CLAIM);
  }
  if (
    isClaimed(source.stableIdCreationClaimed)
    || isClaimed(source.stableBlockInstanceIdCreatedClaimed)
    || isClaimed(source.persistStableBlockInstanceIdClaimed)
  ) {
    reasons.push(OWNER_IDENTITY_POLICY_DECISION_RECORD_REASON_CODES.FORBIDDEN_STABLE_ID_CREATION_CLAIM);
  }
  if (
    isClaimed(source.blockLineageCreatedClaimed)
    || isClaimed(source.blockLineagePersistedClaimed)
    || isClaimed(source.createBlockLineageClaimed)
  ) {
    reasons.push(OWNER_IDENTITY_POLICY_DECISION_RECORD_REASON_CODES.FORBIDDEN_LINEAGE_CREATION_CLAIM);
  }
  if (isClaimed(source.reviewAnchorPromotedClaimed) || isClaimed(source.reviewAnchorHandlePromotedClaimed)) {
    reasons.push(OWNER_IDENTITY_POLICY_DECISION_RECORD_REASON_CODES.FORBIDDEN_REVIEW_ANCHOR_PROMOTION_CLAIM);
  }
  if (isClaimed(source.structuralAutoApplyClaimed) || isClaimed(source.moveSplitMergeAutoApplyClaimed)) {
    reasons.push(OWNER_IDENTITY_POLICY_DECISION_RECORD_REASON_CODES.FORBIDDEN_STRUCTURAL_AUTO_APPLY_CLAIM);
  }
  if (
    isClaimed(source.uiClaimed)
    || isClaimed(source.docxClaimed)
    || isClaimed(source.networkClaimed)
    || isClaimed(source.dependencyChangeClaimed)
  ) {
    reasons.push(OWNER_IDENTITY_POLICY_DECISION_RECORD_REASON_CODES.FORBIDDEN_UI_DOCX_NETWORK_DEPENDENCY_CLAIM);
  }
}

function permissionLanguageFindings(input = {}, packet = {}) {
  const rawValues = [
    ...asArray(input.permissionLanguageClaims),
    ...asArray(input.claimLanguage),
    input.decisionLanguage,
    input.ownerPolicyLanguage,
    ...asArray(packet.permissionLanguageClaims),
    ...asArray(packet.claimLanguage),
    packet.decisionLanguage,
    packet.ownerPolicyLanguage,
  ].filter(hasText);
  const findings = [];
  for (const value of rawValues) {
    const normalized = value.toUpperCase();
    const matchedTerms = FORBIDDEN_PERMISSION_LANGUAGE.filter((term) => normalized.includes(term));
    if (matchedTerms.length > 0) {
      findings.push(withCanonicalHash({
        findingKind: 'ForbiddenOwnerDecisionPermissionLanguageFinding',
        contourId: CONTOUR_ID,
        language: value,
        matchedTerms: uniqueSorted(matchedTerms),
        reasonCode: OWNER_IDENTITY_POLICY_DECISION_RECORD_REASON_CODES.FORBIDDEN_PERMISSION_LANGUAGE_FOUND,
      }));
    }
  }
  return findings;
}

function pushOwnerPacketShapeReasons(packet, reasons) {
  if (!isObject(packet)) {
    reasons.push(OWNER_IDENTITY_POLICY_DECISION_RECORD_REASON_CODES.MISSING_OWNER_POLICY_DECISION_PACKET);
    return;
  }
  if (packet.packetKind !== EXPECTED_PACKET_KIND) {
    reasons.push(OWNER_IDENTITY_POLICY_DECISION_RECORD_REASON_CODES.WRONG_OWNER_POLICY_DECISION_PACKET_KIND);
  }
  if (packet.packetTarget !== EXPECTED_PACKET_TARGET) {
    reasons.push(OWNER_IDENTITY_POLICY_DECISION_RECORD_REASON_CODES.WRONG_OWNER_POLICY_DECISION_PACKET_TARGET);
  }
  if (!hasText(packet.ownerDecisionId)) {
    reasons.push(OWNER_IDENTITY_POLICY_DECISION_RECORD_REASON_CODES.MISSING_OWNER_DECISION_ID);
  }
  if (!hasText(packet.selectedPolicyOption)) {
    reasons.push(OWNER_IDENTITY_POLICY_DECISION_RECORD_REASON_CODES.MISSING_OWNER_POLICY_OPTION);
  } else if (!Object.values(OWNER_POLICY_OPTIONS).includes(packet.selectedPolicyOption)) {
    reasons.push(OWNER_IDENTITY_POLICY_DECISION_RECORD_REASON_CODES.UNKNOWN_OWNER_POLICY_OPTION);
  }
  if (Object.keys(packet).some((key) => !OWNER_PACKET_ALLOWED_KEYS.has(key))) {
    reasons.push(OWNER_IDENTITY_POLICY_DECISION_RECORD_REASON_CODES.OWNER_POLICY_DECISION_PACKET_UNKNOWN_FIELD_FORBIDDEN);
  }
  if (UNDERSTANDING_FLAGS.some((key) => packet[key] !== true)) {
    reasons.push(OWNER_IDENTITY_POLICY_DECISION_RECORD_REASON_CODES.OWNER_UNDERSTANDING_FLAG_MISSING);
  }
  if (containsCallable(packet)) {
    reasons.push(OWNER_IDENTITY_POLICY_DECISION_RECORD_REASON_CODES.CALLABLE_FIELD_FORBIDDEN);
  }
  if (containsUserProjectPath(packet)) {
    reasons.push(OWNER_IDENTITY_POLICY_DECISION_RECORD_REASON_CODES.USER_PROJECT_PATH_FORBIDDEN);
  }
}

function buildPolicyOptionRecord(packet = {}, blockedReasons) {
  const selectedPolicyOption = hasText(packet.selectedPolicyOption) ? packet.selectedPolicyOption : '';
  const optionReasonCodes = [
    OWNER_IDENTITY_POLICY_DECISION_RECORD_REASON_CODES.OWNER_POLICY_OPTION_RECORDED_AS_EVIDENCE_ONLY,
  ];
  if (selectedPolicyOption === OWNER_POLICY_OPTIONS.INTERMEDIATE_REVIEW_ANCHOR_HANDLE_ONLY) {
    optionReasonCodes.push(OWNER_IDENTITY_POLICY_DECISION_RECORD_REASON_CODES.REVIEW_ANCHOR_HANDLE_REMAINS_PACKET_LOCAL);
  }
  if (selectedPolicyOption === OWNER_POLICY_OPTIONS.STABLE_IDENTITY_POLICY_DEFERRED) {
    optionReasonCodes.push(OWNER_IDENTITY_POLICY_DECISION_RECORD_REASON_CODES.STABLE_IDENTITY_POLICY_DEFERRED_NOT_CREATED);
  }
  if (selectedPolicyOption === OWNER_POLICY_OPTIONS.NARROW_STABLE_IDENTITY_POLICY_SELECTED_WITHOUT_EXECUTION) {
    optionReasonCodes.push(OWNER_IDENTITY_POLICY_DECISION_RECORD_REASON_CODES.NARROW_STABLE_IDENTITY_POLICY_NOT_EXECUTED);
  }

  return withCanonicalHash({
    recordKind: 'OwnerIdentityPolicyOptionRecord',
    contourId: CONTOUR_ID,
    ownerDecisionId: hasText(packet.ownerDecisionId) ? packet.ownerDecisionId : '',
    selectedPolicyOption,
    optionKnown: Object.values(OWNER_POLICY_OPTIONS).includes(selectedPolicyOption),
    evidenceOnly: true,
    policyPreferenceRecordOnly: true,
    projectTruthAccepted: false,
    stage05ExitReady: false,
    stage06PreAdmitted: false,
    applyTxnAllowed: false,
    storageMigrationPerformed: false,
    stableBlockInstanceIdCreated: false,
    blockLineageCreated: false,
    reviewAnchorHandlePromoted: false,
    blocked: blockedReasons.length > 0,
    reasonCodes: uniqueSorted(optionReasonCodes),
  });
}

function createDecision(blockedReasons) {
  const stopReasons = new Set([
    OWNER_IDENTITY_POLICY_DECISION_RECORD_REASON_CODES.MISSING_OWNER_POLICY_DECISION_PACKET,
    OWNER_IDENTITY_POLICY_DECISION_RECORD_REASON_CODES.MISSING_OWNER_DECISION_ID,
    OWNER_IDENTITY_POLICY_DECISION_RECORD_REASON_CODES.MISSING_OWNER_POLICY_OPTION,
  ]);
  const outputDecision = blockedReasons.some((reason) => stopReasons.has(reason))
    ? OWNER_IDENTITY_POLICY_DECISION_RECORD_DECISIONS.STOP_OWNER_POLICY_REQUIRED
    : (
      blockedReasons.length > 0
        ? OWNER_IDENTITY_POLICY_DECISION_RECORD_DECISIONS.OWNER_IDENTITY_POLICY_DECISION_BLOCKED
        : OWNER_IDENTITY_POLICY_DECISION_RECORD_DECISIONS.OWNER_IDENTITY_POLICY_DECISION_RECORDED
    );

  return withCanonicalHash({
    decisionKind: DECISION_KIND,
    contourId: CONTOUR_ID,
    outputDecision,
    blocked: blockedReasons.length > 0,
    blockedReasons,
  });
}

function buildReviewBom({ hashRefs, blockedReasons, permissionFindings, policyOptionRecord }) {
  return withCanonicalHash({
    bomKind: 'OwnerIdentityPolicyDecisionRecordReviewBOM',
    contourId: CONTOUR_ID,
    requiredHashRefCount: hashRefs.length,
    presentHashRefCount: hashRefs.filter((ref) => ref.evidencePresent).length,
    missingHashRefCount: hashRefs.filter((ref) => !ref.evidencePresent).length,
    staleHashRefCount: hashRefs.filter((ref) => ref.stale).length,
    forbiddenClaimCount: blockedReasons.filter((code) => code.startsWith('FORBIDDEN_')).length,
    permissionLanguageFindingCount: permissionFindings.length,
    ownerPolicyOptionKnown: policyOptionRecord.optionKnown,
    policyPreferenceRecordOnlyCount: policyOptionRecord.policyPreferenceRecordOnly ? 1 : 0,
    projectTruthAcceptanceCount: 0,
    stage05ExitReadyCount: 0,
    stage06AdmissionCount: 0,
    applyTxnPermissionCount: 0,
    storageMigrationCount: 0,
    stableIdCreationCount: 0,
    lineageCreationCount: 0,
    reviewAnchorPromotionCount: 0,
    blockedReasonCodes: blockedReasons,
    hashRefReasonCodes: uniqueSorted(hashRefs.flatMap((ref) => ref.reasonCodes)),
    hashRefHashes: hashRefs.map((ref) => ref.canonicalHash).sort(),
    permissionLanguageFindingHashes: permissionFindings.map((finding) => finding.canonicalHash).sort(),
    policyOptionRecordHash: policyOptionRecord.canonicalHash,
  });
}

function buildNextStepPreview({ blockedReasons, policyOptionRecord }) {
  return withCanonicalHash({
    packetKind: 'OwnerIdentityPolicyDecisionNextReviewInputPreview',
    contourId: CONTOUR_ID,
    previewOnly: true,
    nextStepRecommendationOnly: true,
    automaticNextContourOpened: false,
    recommendedSeparateNextContour: 'STAGE05O_STAGE05_EXIT_REVIEW_RECORD_ONLY',
    ownerPolicyOptionRecordHash: policyOptionRecord.canonicalHash,
    blockedReasonCodes: blockedReasons,
    policyPreferenceRecordOnly: true,
    stage05ExitReady: false,
    stage06PreAdmitted: false,
    stage06AdmissionGranted: false,
    applyTxnAllowed: false,
  });
}

export function compileOwnerIdentityPolicyDecisionRecord(input = {}) {
  const rawPacket = input.ownerPolicyDecisionPacket;
  const packet = isObject(rawPacket) ? rawPacket : {};
  const blockedReasons = [];
  pushChangedBasenameReasons(input, blockedReasons);
  pushOwnerPacketShapeReasons(rawPacket, blockedReasons);
  pushForbiddenClaimReasons(input, blockedReasons);
  pushForbiddenClaimReasons(packet, blockedReasons);

  const hashRefs = HASH_REF_SPECS.map((spec) => resolveHashRef(input, packet, spec));
  for (const ref of hashRefs) {
    for (const code of ref.reasonCodes) {
      if (BLOCKING_REASON_CODES.has(code)) {
        blockedReasons.push(code);
      }
    }
  }

  const permissionFindings = permissionLanguageFindings(input, packet);
  if (permissionFindings.length > 0) {
    blockedReasons.push(OWNER_IDENTITY_POLICY_DECISION_RECORD_REASON_CODES.FORBIDDEN_PERMISSION_LANGUAGE_FOUND);
  }

  const uniqueBlockedReasons = uniqueSorted(blockedReasons);
  const policyOptionRecord = buildPolicyOptionRecord(packet, uniqueBlockedReasons);
  const decision = createDecision(uniqueBlockedReasons);
  const reviewBom = buildReviewBom({
    hashRefs,
    blockedReasons: uniqueBlockedReasons,
    permissionFindings,
    policyOptionRecord,
  });
  const nextStepPreview = buildNextStepPreview({
    blockedReasons: uniqueBlockedReasons,
    policyOptionRecord,
  });

  return withCanonicalHash({
    resultKind: RESULT_KIND,
    contourId: CONTOUR_ID,
    outputDecision: decision.outputDecision,
    ownerIdentityPolicyDecisionRecorded:
      decision.outputDecision === OWNER_IDENTITY_POLICY_DECISION_RECORD_DECISIONS.OWNER_IDENTITY_POLICY_DECISION_RECORDED,
    ownerPolicyDecisionRecordedAsEvidenceOnly:
      decision.outputDecision === OWNER_IDENTITY_POLICY_DECISION_RECORD_DECISIONS.OWNER_IDENTITY_POLICY_DECISION_RECORDED,
    ownerPolicyDecisionRecordOnly: true,
    policyPreferenceRecordOnly: true,
    blocked: uniqueBlockedReasons.length > 0,
    blockedReasons: uniqueBlockedReasons,
    policyAcceptedAsProjectTruth: false,
    ownerPolicyAccepted: false,
    ownerPolicyDecisionAcceptedAsProjectTruth: false,
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
    structuralAutoApplyAllowed: false,
    permissionLanguageFindingCount: reviewBom.permissionLanguageFindingCount,
    hashRefs,
    policyOptionRecord,
    permissionFindings,
    decisions: [decision],
    reviewBom,
    nextStepPreview,
  });
}

export const runOwnerIdentityPolicyDecisionRecord = compileOwnerIdentityPolicyDecisionRecord;

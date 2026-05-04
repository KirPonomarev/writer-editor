import { canonicalHash } from './reviewIrKernel.mjs';

const RESULT_KIND = 'STAGE_05Q_POST_RECON_FOLLOWUP_GAP_CLASSIFIER_RECORD_RESULT_001';
const DECISION_KIND = 'STAGE_05Q_POST_RECON_FOLLOWUP_GAP_CLASSIFIER_RECORD_DECISION_001';
const CONTOUR_ID = 'STAGE05Q_POST_RECON_FOLLOWUP_GAP_CLASSIFIER_RECORD_ONLY_001';

const ALLOWED_CHANGED_BASENAMES = new Set([
  'postReconFollowupGapClassifierRecord.mjs',
  'postReconFollowupGapClassifierRecord.contract.test.js',
  'STAGE05Q_POST_RECON_FOLLOWUP_GAP_CLASSIFIER_RECORD_ONLY_001.md',
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

const SIGNAL_SPECS = Object.freeze([
  {
    key: 'nonblockedFollowupGapObserved',
    classification: 'POST_RECON_NONBLOCKED_FOLLOWUP_GAP_OBSERVED',
  },
  {
    key: 'ownerReviewRequiredObserved',
    classification: 'POST_RECON_OWNER_REVIEW_REQUIRED_OBSERVED',
  },
  {
    key: 'blockedDebtObserved',
    classification: 'POST_RECON_BLOCKED_DEBT_OBSERVED',
  },
]);

const CLAIM_REASON_GROUPS = Object.freeze([
  {
    reasonCode: 'FORBIDDEN_NEXT_CONTOUR_SELECTION_CLAIM',
    keys: ['nextContourSelectedClaimed', 'nextContourSelectionClaimed', 'nextContourClaimed'],
  },
  {
    reasonCode: 'FORBIDDEN_NEXT_CONTOUR_OPENING_CLAIM',
    keys: ['automaticNextContourOpenedClaimed', 'nextContourOpenedClaimed', 'stage06OpenedClaimed'],
  },
  {
    reasonCode: 'FORBIDDEN_POLICY_ACCEPTANCE_CLAIM',
    keys: ['policyAcceptanceClaimed', 'policyAcceptedClaimed', 'ownerPolicyAcceptedClaimed'],
  },
  {
    reasonCode: 'FORBIDDEN_PROJECT_TRUTH_ACCEPTANCE_CLAIM',
    keys: [
      'projectTruthAcceptedClaimed',
      'projectTruthPolicyAcceptedClaimed',
      'ownerPolicyDecisionAcceptedAsProjectTruthClaimed',
    ],
  },
  {
    reasonCode: 'FORBIDDEN_STAGE05_READY_CLAIM',
    keys: ['stage05ReadyClaimed', 'stage05ExitReadyClaimed', 'identityPolicyReadyClaimed', 'readyStatusClaimed'],
  },
  {
    reasonCode: 'FORBIDDEN_STAGE06_PRE_ADMISSION_CLAIM',
    keys: ['stage06PreAdmittedClaimed', 'stage06PreAdmissionClaimed'],
  },
  {
    reasonCode: 'FORBIDDEN_STAGE06_PERMISSION_CLAIM',
    keys: ['stage06PermissionClaimed', 'stage06AdmissionClaimed'],
  },
  {
    reasonCode: 'FORBIDDEN_APPLYTXN_CLAIM',
    keys: [
      'applyTxnClaimed',
      'applyTxnPermissionClaimed',
      'applyTxnAllowedClaimed',
      'applyTxnCreatedClaimed',
    ],
  },
  {
    reasonCode: 'FORBIDDEN_RUNTIME_APPLY_CLAIM',
    keys: ['runtimeApplyClaimed', 'runtimeApplyPerformedClaimed', 'applyOpCreatedClaimed', 'applyOpPerformedClaimed'],
  },
  {
    reasonCode: 'FORBIDDEN_STORAGE_CLAIM',
    keys: ['storageMigrationClaimed', 'storageMutationClaimed', 'storageWriteClaimed'],
  },
  {
    reasonCode: 'FORBIDDEN_PROJECT_WRITE_CLAIM',
    keys: ['projectWriteClaimed', 'projectWritePerformedClaimed'],
  },
  {
    reasonCode: 'FORBIDDEN_STABLE_ID_CLAIM',
    keys: ['stableIdCreationClaimed', 'stableBlockInstanceIdCreatedClaimed', 'persistStableBlockInstanceIdClaimed'],
  },
  {
    reasonCode: 'FORBIDDEN_LINEAGE_CLAIM',
    keys: ['blockLineageCreatedClaimed', 'blockLineagePersistedClaimed', 'createBlockLineageClaimed'],
  },
  {
    reasonCode: 'FORBIDDEN_REVIEW_ANCHOR_PROMOTION_CLAIM',
    keys: ['reviewAnchorPromotedClaimed', 'reviewAnchorHandlePromotedClaimed'],
  },
  {
    reasonCode: 'FORBIDDEN_STRUCTURAL_AUTO_APPLY_CLAIM',
    keys: ['structuralAutoApplyClaimed', 'moveSplitMergeAutoApplyClaimed'],
  },
  {
    reasonCode: 'FORBIDDEN_UI_DOCX_NETWORK_DEPENDENCY_CLAIM',
    keys: ['uiClaimed', 'docxClaimed', 'networkClaimed', 'dependencyChangeClaimed'],
  },
]);

const ALLOWED_REF_KEYS = new Set(['evidenceHash', 'expectedEvidenceHash', 'stale']);

const ALLOWED_INPUT_KEYS = new Set([
  'changedBasenames',
  'stage05pFalseGreenReconRecordRef',
  'stage05pFalseGreenReconRecordHash',
  'stage05pFalseGreenReconRecordHashExpected',
  'stage05pFalseGreenReconRecordHashStale',
  'nonblockedFollowupGapObserved',
  'ownerReviewRequiredObserved',
  'blockedDebtObserved',
  'permissionLanguageClaims',
  'claimLanguage',
  'reviewLanguage',
  ...CLAIM_REASON_GROUPS.flatMap((group) => group.keys),
]);

export const POST_RECON_FOLLOWUP_GAP_CLASSIFICATIONS = Object.freeze({
  POST_RECON_NONBLOCKED_FOLLOWUP_GAP_OBSERVED: 'POST_RECON_NONBLOCKED_FOLLOWUP_GAP_OBSERVED',
  POST_RECON_OWNER_REVIEW_REQUIRED_OBSERVED: 'POST_RECON_OWNER_REVIEW_REQUIRED_OBSERVED',
  POST_RECON_BLOCKED_DEBT_OBSERVED: 'POST_RECON_BLOCKED_DEBT_OBSERVED',
  POST_RECON_NO_FOLLOWUP_GAP_OBSERVED: 'POST_RECON_NO_FOLLOWUP_GAP_OBSERVED',
});

export const POST_RECON_FOLLOWUP_GAP_CLASSIFIER_RECORD_DECISIONS = Object.freeze({
  POST_RECON_FOLLOWUP_GAP_FACTS_RECORDED: 'POST_RECON_FOLLOWUP_GAP_FACTS_RECORDED',
  POST_RECON_FOLLOWUP_GAP_FACTS_BLOCKED: 'POST_RECON_FOLLOWUP_GAP_FACTS_BLOCKED',
  STOP_OWNER_REVIEW_REQUIRED: 'STOP_OWNER_REVIEW_REQUIRED',
});

export const POST_RECON_FOLLOWUP_GAP_CLASSIFIER_RECORD_REASON_CODES = Object.freeze({
  MISSING_CHANGED_BASENAMES_EVIDENCE: 'MISSING_CHANGED_BASENAMES_EVIDENCE',
  FORBIDDEN_BASENAME_CHANGE: 'FORBIDDEN_BASENAME_CHANGE',
  MISSING_STAGE05P_FALSE_GREEN_RECON_RECORD_HASH: 'MISSING_STAGE05P_FALSE_GREEN_RECON_RECORD_HASH',
  STALE_STAGE05P_FALSE_GREEN_RECON_RECORD_HASH: 'STALE_STAGE05P_FALSE_GREEN_RECON_RECORD_HASH',
  STAGE05P_FALSE_GREEN_RECON_RECORD_FACTS_ONLY_INPUT: 'STAGE05P_FALSE_GREEN_RECON_RECORD_FACTS_ONLY_INPUT',
  CONFLICTING_OBSERVED_SIGNALS: 'CONFLICTING_OBSERVED_SIGNALS',
  UNKNOWN_FIELD_FORBIDDEN: 'UNKNOWN_FIELD_FORBIDDEN',
  CALLABLE_FIELD_FORBIDDEN: 'CALLABLE_FIELD_FORBIDDEN',
  USER_PROJECT_PATH_FORBIDDEN: 'USER_PROJECT_PATH_FORBIDDEN',
  FORBIDDEN_PERMISSION_LANGUAGE_FOUND: 'FORBIDDEN_PERMISSION_LANGUAGE_FOUND',
  FORBIDDEN_NEXT_CONTOUR_SELECTION_CLAIM: 'FORBIDDEN_NEXT_CONTOUR_SELECTION_CLAIM',
  FORBIDDEN_NEXT_CONTOUR_OPENING_CLAIM: 'FORBIDDEN_NEXT_CONTOUR_OPENING_CLAIM',
  FORBIDDEN_POLICY_ACCEPTANCE_CLAIM: 'FORBIDDEN_POLICY_ACCEPTANCE_CLAIM',
  FORBIDDEN_PROJECT_TRUTH_ACCEPTANCE_CLAIM: 'FORBIDDEN_PROJECT_TRUTH_ACCEPTANCE_CLAIM',
  FORBIDDEN_STAGE05_READY_CLAIM: 'FORBIDDEN_STAGE05_READY_CLAIM',
  FORBIDDEN_STAGE06_PRE_ADMISSION_CLAIM: 'FORBIDDEN_STAGE06_PRE_ADMISSION_CLAIM',
  FORBIDDEN_STAGE06_PERMISSION_CLAIM: 'FORBIDDEN_STAGE06_PERMISSION_CLAIM',
  FORBIDDEN_APPLYTXN_CLAIM: 'FORBIDDEN_APPLYTXN_CLAIM',
  FORBIDDEN_RUNTIME_APPLY_CLAIM: 'FORBIDDEN_RUNTIME_APPLY_CLAIM',
  FORBIDDEN_STORAGE_CLAIM: 'FORBIDDEN_STORAGE_CLAIM',
  FORBIDDEN_PROJECT_WRITE_CLAIM: 'FORBIDDEN_PROJECT_WRITE_CLAIM',
  FORBIDDEN_STABLE_ID_CLAIM: 'FORBIDDEN_STABLE_ID_CLAIM',
  FORBIDDEN_LINEAGE_CLAIM: 'FORBIDDEN_LINEAGE_CLAIM',
  FORBIDDEN_REVIEW_ANCHOR_PROMOTION_CLAIM: 'FORBIDDEN_REVIEW_ANCHOR_PROMOTION_CLAIM',
  FORBIDDEN_STRUCTURAL_AUTO_APPLY_CLAIM: 'FORBIDDEN_STRUCTURAL_AUTO_APPLY_CLAIM',
  FORBIDDEN_UI_DOCX_NETWORK_DEPENDENCY_CLAIM: 'FORBIDDEN_UI_DOCX_NETWORK_DEPENDENCY_CLAIM',
});

const BLOCKING_REASON_CODES = new Set([
  POST_RECON_FOLLOWUP_GAP_CLASSIFIER_RECORD_REASON_CODES.MISSING_CHANGED_BASENAMES_EVIDENCE,
  POST_RECON_FOLLOWUP_GAP_CLASSIFIER_RECORD_REASON_CODES.FORBIDDEN_BASENAME_CHANGE,
  POST_RECON_FOLLOWUP_GAP_CLASSIFIER_RECORD_REASON_CODES.MISSING_STAGE05P_FALSE_GREEN_RECON_RECORD_HASH,
  POST_RECON_FOLLOWUP_GAP_CLASSIFIER_RECORD_REASON_CODES.STALE_STAGE05P_FALSE_GREEN_RECON_RECORD_HASH,
  POST_RECON_FOLLOWUP_GAP_CLASSIFIER_RECORD_REASON_CODES.CONFLICTING_OBSERVED_SIGNALS,
  POST_RECON_FOLLOWUP_GAP_CLASSIFIER_RECORD_REASON_CODES.UNKNOWN_FIELD_FORBIDDEN,
  POST_RECON_FOLLOWUP_GAP_CLASSIFIER_RECORD_REASON_CODES.CALLABLE_FIELD_FORBIDDEN,
  POST_RECON_FOLLOWUP_GAP_CLASSIFIER_RECORD_REASON_CODES.USER_PROJECT_PATH_FORBIDDEN,
  POST_RECON_FOLLOWUP_GAP_CLASSIFIER_RECORD_REASON_CODES.FORBIDDEN_PERMISSION_LANGUAGE_FOUND,
  POST_RECON_FOLLOWUP_GAP_CLASSIFIER_RECORD_REASON_CODES.FORBIDDEN_NEXT_CONTOUR_SELECTION_CLAIM,
  POST_RECON_FOLLOWUP_GAP_CLASSIFIER_RECORD_REASON_CODES.FORBIDDEN_NEXT_CONTOUR_OPENING_CLAIM,
  POST_RECON_FOLLOWUP_GAP_CLASSIFIER_RECORD_REASON_CODES.FORBIDDEN_POLICY_ACCEPTANCE_CLAIM,
  POST_RECON_FOLLOWUP_GAP_CLASSIFIER_RECORD_REASON_CODES.FORBIDDEN_PROJECT_TRUTH_ACCEPTANCE_CLAIM,
  POST_RECON_FOLLOWUP_GAP_CLASSIFIER_RECORD_REASON_CODES.FORBIDDEN_STAGE05_READY_CLAIM,
  POST_RECON_FOLLOWUP_GAP_CLASSIFIER_RECORD_REASON_CODES.FORBIDDEN_STAGE06_PRE_ADMISSION_CLAIM,
  POST_RECON_FOLLOWUP_GAP_CLASSIFIER_RECORD_REASON_CODES.FORBIDDEN_STAGE06_PERMISSION_CLAIM,
  POST_RECON_FOLLOWUP_GAP_CLASSIFIER_RECORD_REASON_CODES.FORBIDDEN_APPLYTXN_CLAIM,
  POST_RECON_FOLLOWUP_GAP_CLASSIFIER_RECORD_REASON_CODES.FORBIDDEN_RUNTIME_APPLY_CLAIM,
  POST_RECON_FOLLOWUP_GAP_CLASSIFIER_RECORD_REASON_CODES.FORBIDDEN_STORAGE_CLAIM,
  POST_RECON_FOLLOWUP_GAP_CLASSIFIER_RECORD_REASON_CODES.FORBIDDEN_PROJECT_WRITE_CLAIM,
  POST_RECON_FOLLOWUP_GAP_CLASSIFIER_RECORD_REASON_CODES.FORBIDDEN_STABLE_ID_CLAIM,
  POST_RECON_FOLLOWUP_GAP_CLASSIFIER_RECORD_REASON_CODES.FORBIDDEN_LINEAGE_CLAIM,
  POST_RECON_FOLLOWUP_GAP_CLASSIFIER_RECORD_REASON_CODES.FORBIDDEN_REVIEW_ANCHOR_PROMOTION_CLAIM,
  POST_RECON_FOLLOWUP_GAP_CLASSIFIER_RECORD_REASON_CODES.FORBIDDEN_STRUCTURAL_AUTO_APPLY_CLAIM,
  POST_RECON_FOLLOWUP_GAP_CLASSIFIER_RECORD_REASON_CODES.FORBIDDEN_UI_DOCX_NETWORK_DEPENDENCY_CLAIM,
]);

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asTextList(value) {
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
    reasons.push(POST_RECON_FOLLOWUP_GAP_CLASSIFIER_RECORD_REASON_CODES.MISSING_CHANGED_BASENAMES_EVIDENCE);
    return;
  }

  const changedBasenames = new Set(input.changedBasenames);
  if (
    input.changedBasenames.length !== ALLOWED_CHANGED_BASENAMES.size
    || changedBasenames.size !== ALLOWED_CHANGED_BASENAMES.size
    || Array.from(ALLOWED_CHANGED_BASENAMES).some((basename) => !changedBasenames.has(basename))
  ) {
    reasons.push(POST_RECON_FOLLOWUP_GAP_CLASSIFIER_RECORD_REASON_CODES.MISSING_CHANGED_BASENAMES_EVIDENCE);
  }
  if (input.changedBasenames.some((basename) => !ALLOWED_CHANGED_BASENAMES.has(basename))) {
    reasons.push(POST_RECON_FOLLOWUP_GAP_CLASSIFIER_RECORD_REASON_CODES.FORBIDDEN_BASENAME_CHANGE);
  }
}

function pushInputShapeReasons(input, reasons) {
  if (Object.keys(input).some((key) => !ALLOWED_INPUT_KEYS.has(key))) {
    reasons.push(POST_RECON_FOLLOWUP_GAP_CLASSIFIER_RECORD_REASON_CODES.UNKNOWN_FIELD_FORBIDDEN);
  }

  const directRef = input?.stage05pFalseGreenReconRecordRef;
  if (isObject(directRef) && Object.keys(directRef).some((key) => !ALLOWED_REF_KEYS.has(key))) {
    reasons.push(POST_RECON_FOLLOWUP_GAP_CLASSIFIER_RECORD_REASON_CODES.UNKNOWN_FIELD_FORBIDDEN);
  }

  if (containsCallable(input)) {
    reasons.push(POST_RECON_FOLLOWUP_GAP_CLASSIFIER_RECORD_REASON_CODES.CALLABLE_FIELD_FORBIDDEN);
  }
  if (containsUserProjectPath(input)) {
    reasons.push(POST_RECON_FOLLOWUP_GAP_CLASSIFIER_RECORD_REASON_CODES.USER_PROJECT_PATH_FORBIDDEN);
  }
}

function resolveStage05pHashRef(input = {}) {
  const ref = isObject(input.stage05pFalseGreenReconRecordRef) ? input.stage05pFalseGreenReconRecordRef : {};
  const evidenceHash = hasText(ref.evidenceHash)
    ? ref.evidenceHash
    : (hasText(input.stage05pFalseGreenReconRecordHash) ? input.stage05pFalseGreenReconRecordHash : '');
  const expectedEvidenceHash = hasText(ref.expectedEvidenceHash)
    ? ref.expectedEvidenceHash
    : (
      hasText(input.stage05pFalseGreenReconRecordHashExpected)
        ? input.stage05pFalseGreenReconRecordHashExpected
        : ''
    );
  const topLevelStaleApplies = !isObject(input.stage05pFalseGreenReconRecordRef)
    && input.stage05pFalseGreenReconRecordHashStale === true;
  const stale = ref.stale === true
    || topLevelStaleApplies
    || (hasText(expectedEvidenceHash) && hasText(evidenceHash) && expectedEvidenceHash !== evidenceHash);
  const evidencePresent = hasText(evidenceHash);
  const reasonCodes = [];

  if (!evidencePresent) {
    reasonCodes.push(
      POST_RECON_FOLLOWUP_GAP_CLASSIFIER_RECORD_REASON_CODES.MISSING_STAGE05P_FALSE_GREEN_RECON_RECORD_HASH,
    );
  } else {
    reasonCodes.push(
      POST_RECON_FOLLOWUP_GAP_CLASSIFIER_RECORD_REASON_CODES.STAGE05P_FALSE_GREEN_RECON_RECORD_FACTS_ONLY_INPUT,
    );
  }
  if (stale) {
    reasonCodes.push(
      POST_RECON_FOLLOWUP_GAP_CLASSIFIER_RECORD_REASON_CODES.STALE_STAGE05P_FALSE_GREEN_RECON_RECORD_HASH,
    );
  }

  return withCanonicalHash({
    refKind: 'Stage05QRequiredStage05PHashRef',
    contourId: CONTOUR_ID,
    refId: 'STAGE05P_FALSE_GREEN_RECON_RECORD_REF',
    refClass: 'FACTS_RECORD_ONLY_STAGE05P',
    evidenceHash,
    expectedEvidenceHash,
    evidencePresent,
    stale,
    factsOnly: true,
    advisoryFactsInputOnly: true,
    exitReadyInput: false,
    stage05Ready: false,
    stage06PermissionGranted: false,
    reasonCodes: uniqueSorted(reasonCodes),
  });
}

function observedSignals(input = {}) {
  const trueSignals = SIGNAL_SPECS
    .filter((spec) => input[spec.key] === true)
    .map((spec) => ({ key: spec.key, classification: spec.classification }));
  const classification = trueSignals.length === 0
    ? POST_RECON_FOLLOWUP_GAP_CLASSIFICATIONS.POST_RECON_NO_FOLLOWUP_GAP_OBSERVED
    : (trueSignals.length === 1 ? trueSignals[0].classification : null);

  return withCanonicalHash({
    observationKind: 'Stage05QPostReconFollowupGapObservedSignals',
    contourId: CONTOUR_ID,
    nonblockedFollowupGapObserved: input.nonblockedFollowupGapObserved === true,
    ownerReviewRequiredObserved: input.ownerReviewRequiredObserved === true,
    blockedDebtObserved: input.blockedDebtObserved === true,
    trueSignalCount: trueSignals.length,
    conflictingObservedSignals: trueSignals.length > 1,
    classification,
    classificationAllowed: Object.values(POST_RECON_FOLLOWUP_GAP_CLASSIFICATIONS).includes(classification),
    trueSignalKeys: trueSignals.map((signal) => signal.key).sort(),
    factsOnly: true,
    recordOnly: true,
    nextContourSelected: false,
    automaticNextContourOpened: false,
    stage05Closed: false,
    stage06Opened: false,
  });
}

function pushSignalReasons(signalRecord, reasons) {
  if (signalRecord.conflictingObservedSignals) {
    reasons.push(POST_RECON_FOLLOWUP_GAP_CLASSIFIER_RECORD_REASON_CODES.CONFLICTING_OBSERVED_SIGNALS);
  }
}

function pushForbiddenClaimReasons(input = {}, reasons) {
  for (const group of CLAIM_REASON_GROUPS) {
    if (group.keys.some((key) => isClaimed(input[key]))) {
      reasons.push(POST_RECON_FOLLOWUP_GAP_CLASSIFIER_RECORD_REASON_CODES[group.reasonCode]);
    }
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
        findingKind: 'ForbiddenStage05QPermissionLanguageFinding',
        contourId: CONTOUR_ID,
        language: value,
        matchedTerms: uniqueSorted(matchedTerms),
        reasonCode: POST_RECON_FOLLOWUP_GAP_CLASSIFIER_RECORD_REASON_CODES.FORBIDDEN_PERMISSION_LANGUAGE_FOUND,
      }));
    }
  }

  return findings;
}

function createDecision(blockedReasons, signalRecord) {
  let outputDecision;
  if (
    blockedReasons.includes(
      POST_RECON_FOLLOWUP_GAP_CLASSIFIER_RECORD_REASON_CODES.MISSING_STAGE05P_FALSE_GREEN_RECON_RECORD_HASH,
    )
  ) {
    outputDecision = POST_RECON_FOLLOWUP_GAP_CLASSIFIER_RECORD_DECISIONS.STOP_OWNER_REVIEW_REQUIRED;
  } else if (
    blockedReasons.length > 0
    || signalRecord.classification
      === POST_RECON_FOLLOWUP_GAP_CLASSIFICATIONS.POST_RECON_BLOCKED_DEBT_OBSERVED
  ) {
    outputDecision = POST_RECON_FOLLOWUP_GAP_CLASSIFIER_RECORD_DECISIONS.POST_RECON_FOLLOWUP_GAP_FACTS_BLOCKED;
  } else {
    outputDecision = POST_RECON_FOLLOWUP_GAP_CLASSIFIER_RECORD_DECISIONS.POST_RECON_FOLLOWUP_GAP_FACTS_RECORDED;
  }

  return withCanonicalHash({
    decisionKind: DECISION_KIND,
    contourId: CONTOUR_ID,
    outputDecision,
    blocked: outputDecision
      !== POST_RECON_FOLLOWUP_GAP_CLASSIFIER_RECORD_DECISIONS.POST_RECON_FOLLOWUP_GAP_FACTS_RECORDED,
    ownerReviewRequired:
      outputDecision === POST_RECON_FOLLOWUP_GAP_CLASSIFIER_RECORD_DECISIONS.STOP_OWNER_REVIEW_REQUIRED,
    blockedReasons,
    classification: signalRecord.classification,
  });
}

function buildReviewBom({ stage05pHashRef, signalRecord, blockedReasons, permissionFindings }) {
  return withCanonicalHash({
    bomKind: 'Stage05QPostReconFollowupGapClassifierBOM',
    contourId: CONTOUR_ID,
    factsOnly: true,
    recordOnly: true,
    summaryPacket: false,
    requiredHashRefCount: 1,
    presentHashRefCount: stage05pHashRef.evidencePresent ? 1 : 0,
    missingHashRefCount: stage05pHashRef.evidencePresent ? 0 : 1,
    staleHashRefCount: stage05pHashRef.stale ? 1 : 0,
    observedSignalCount: signalRecord.trueSignalCount,
    conflictingObservedSignalCount: signalRecord.conflictingObservedSignals ? 1 : 0,
    classificationCount: signalRecord.classificationAllowed ? 1 : 0,
    permissionLanguageFindingCount: permissionFindings.length,
    forbiddenClaimCount: blockedReasons.filter((code) => code.startsWith('FORBIDDEN_')).length,
    nextContourSelectionCount: 0,
    automaticNextContourOpenCount: 0,
    projectTruthCount: 0,
    stage05ReadyCount: 0,
    stage05CloseCount: 0,
    stage06OpenCount: 0,
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
    uiDocxNetworkDependencyCount: 0,
    blockedReasonCodes: blockedReasons,
    stage05pHashRefReasonCodes: stage05pHashRef.reasonCodes,
    stage05pHashRefHash: stage05pHashRef.canonicalHash,
    signalRecordHash: signalRecord.canonicalHash,
    permissionLanguageFindingHashes: permissionFindings.map((finding) => finding.canonicalHash).sort(),
  });
}

export function compilePostReconFollowupGapClassifierRecord(input = {}) {
  const blockedReasons = [];
  pushChangedBasenameReasons(input, blockedReasons);
  pushInputShapeReasons(input, blockedReasons);
  pushForbiddenClaimReasons(input, blockedReasons);

  const stage05pHashRef = resolveStage05pHashRef(input);
  for (const code of stage05pHashRef.reasonCodes) {
    if (BLOCKING_REASON_CODES.has(code)) {
      blockedReasons.push(code);
    }
  }

  const signalRecord = observedSignals(input);
  pushSignalReasons(signalRecord, blockedReasons);

  const permissionFindings = permissionLanguageFindings(input);
  if (permissionFindings.length > 0) {
    blockedReasons.push(POST_RECON_FOLLOWUP_GAP_CLASSIFIER_RECORD_REASON_CODES.FORBIDDEN_PERMISSION_LANGUAGE_FOUND);
  }

  const uniqueBlockedReasons = uniqueSorted(blockedReasons);
  const decision = createDecision(uniqueBlockedReasons, signalRecord);
  const reviewBom = buildReviewBom({
    stage05pHashRef,
    signalRecord,
    blockedReasons: uniqueBlockedReasons,
    permissionFindings,
  });

  return withCanonicalHash({
    resultKind: RESULT_KIND,
    contourId: CONTOUR_ID,
    outputDecision: decision.outputDecision,
    postReconFollowupGapFactsRecorded:
      decision.outputDecision
      === POST_RECON_FOLLOWUP_GAP_CLASSIFIER_RECORD_DECISIONS.POST_RECON_FOLLOWUP_GAP_FACTS_RECORDED,
    postReconFollowupGapClassifierRecordOnly: true,
    factsOnly: true,
    recordOnly: true,
    summaryPacket: false,
    summaryPacketCreated: false,
    blocked: decision.blocked,
    ownerReviewRequired: decision.ownerReviewRequired,
    blockedReasons: uniqueBlockedReasons,
    classification: signalRecord.classification,
    allowedClassifications: Object.values(POST_RECON_FOLLOWUP_GAP_CLASSIFICATIONS).sort(),
    stage05pFalseGreenReconRecordHash: stage05pHashRef.evidenceHash,
    stage05pHashAdvisoryFactsOnly: true,
    stage05pHashExitReadyInput: false,
    nextContourSelected: false,
    automaticNextContourOpened: false,
    projectTruth: false,
    projectTruthAccepted: false,
    projectTruthCreated: false,
    policyAcceptedAsProjectTruth: false,
    stage05Ready: false,
    stage05ExitReady: false,
    stage05Closed: false,
    stage06Opened: false,
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
    uiTouched: false,
    docxTouched: false,
    networkTouched: false,
    dependencyTouched: false,
    permissionLanguageFindingCount: reviewBom.permissionLanguageFindingCount,
    stage05pHashRef,
    signalRecord,
    permissionFindings,
    decisions: [decision],
    reviewBom,
  });
}

export const runPostReconFollowupGapClassifierRecord = compilePostReconFollowupGapClassifierRecord;
export const compilePostReconFollowupGapClassifierRecordOnly = compilePostReconFollowupGapClassifierRecord;
export const runPostReconFollowupGapClassifierRecordOnly = compilePostReconFollowupGapClassifierRecord;

import { canonicalHash } from './reviewIrKernel.mjs';

const RESULT_KIND = 'STAGE_05R_POST_RECON_NEXT_STEP_SELECTION_RECORD_RESULT_001';
const DECISION_KIND = 'STAGE_05R_POST_RECON_NEXT_STEP_SELECTION_RECORD_DECISION_001';
const CONTOUR_ID = 'STAGE05R_POST_RECON_NEXT_STEP_SELECTION_RECORD_ONLY_001';
const OWNER_PACKET_KIND = 'STAGE05R_POST_RECON_NEXT_STEP_SELECTION_OWNER_PACKET_001';
const OWNER_PACKET_TARGET = CONTOUR_ID;

const ALLOWED_CHANGED_BASENAMES = new Set([
  'postReconNextStepSelectionRecord.mjs',
  'postReconNextStepSelectionRecord.contract.test.js',
  'STAGE05R_POST_RECON_NEXT_STEP_SELECTION_RECORD_ONLY_001.md',
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

const ALLOWED_REF_KEYS = new Set(['evidenceHash', 'expectedEvidenceHash', 'stale']);
const ALLOWED_SOURCE_OUTPUT_KEYS = new Set([
  'classification',
  'outputDecision',
  'blocked',
  'ownerReviewRequired',
  'sourceBlocked',
  'sourceStopped',
  'conflictingObservedSignals',
]);

const CLAIM_REASON_GROUPS = Object.freeze([
  {
    reasonCode: 'FORBIDDEN_NEXT_CONTOUR_SELECTION_CLAIM',
    keys: ['nextContourSelectedClaimed', 'nextContourSelectionClaimed', 'nextContourClaimed'],
  },
  {
    reasonCode: 'FORBIDDEN_NEXT_CONTOUR_OPENING_CLAIM',
    keys: ['automaticNextContourOpenedClaimed', 'nextContourOpenedClaimed'],
  },
  {
    reasonCode: 'FORBIDDEN_STAGE05_CLOSE_CLAIM',
    keys: ['stage05ClosedClaimed', 'stage05CloseClaimed'],
  },
  {
    reasonCode: 'FORBIDDEN_STAGE06_OPEN_CLAIM',
    keys: ['stage06OpenedClaimed'],
  },
  {
    reasonCode: 'FORBIDDEN_STAGE06_PRE_ADMISSION_CLAIM',
    keys: ['stage06PreAdmittedClaimed', 'stage06PreAdmissionClaimed'],
  },
  {
    reasonCode: 'FORBIDDEN_STAGE06_ADMISSION_CLAIM',
    keys: ['stage06AdmissionClaimed', 'stage06AdmittedClaimed'],
  },
  {
    reasonCode: 'FORBIDDEN_STAGE06_PERMISSION_CLAIM',
    keys: ['stage06PermissionClaimed'],
  },
  {
    reasonCode: 'FORBIDDEN_APPLYTXN_CLAIM',
    keys: ['applyTxnClaimed', 'applyTxnPermissionClaimed', 'applyTxnAllowedClaimed', 'applyTxnCreatedClaimed'],
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
    reasonCode: 'FORBIDDEN_UI_DOCX_NETWORK_DEPENDENCY_CLAIM',
    keys: ['uiClaimed', 'docxClaimed', 'networkClaimed', 'dependencyChangeClaimed'],
  },
]);

const OWNER_PACKET_ALLOWED_KEYS = new Set([
  'packetKind',
  'targetContourId',
  'sourceStage05QHash',
  'selectedNextContourId',
  'ownerUnderstandsNoStage05Close',
  'ownerUnderstandsNoStage06Open',
  'ownerUnderstandsRecordOnly',
  'permissionLanguageClaims',
  'claimLanguage',
  'reviewLanguage',
  ...CLAIM_REASON_GROUPS.flatMap((group) => group.keys),
]);

const UNDERSTANDING_FLAGS = [
  'ownerUnderstandsNoStage05Close',
  'ownerUnderstandsNoStage06Open',
  'ownerUnderstandsRecordOnly',
];

const ALLOWED_INPUT_KEYS = new Set([
  'changedBasenames',
  'stage05qPostReconFollowupGapClassifierRecordRef',
  'stage05qPostReconFollowupGapClassifierRecordHash',
  'stage05qPostReconFollowupGapClassifierRecordHashExpected',
  'stage05qPostReconFollowupGapClassifierRecordHashStale',
  'stage05qPostReconFollowupGapClassifierRecordOutput',
  'stage05qPostReconFollowupGapClassification',
  'stage05qPostReconFollowupGapClassifierRecordDecision',
  'sourceBlocked',
  'sourceStopped',
  'ownerNextContourPacket',
  'permissionLanguageClaims',
  'claimLanguage',
  'reviewLanguage',
  ...CLAIM_REASON_GROUPS.flatMap((group) => group.keys),
]);

export const POST_RECON_NEXT_STEP_SELECTION_CLASSIFICATIONS = Object.freeze({
  POST_RECON_NONBLOCKED_FOLLOWUP_GAP_OBSERVED: 'POST_RECON_NONBLOCKED_FOLLOWUP_GAP_OBSERVED',
  POST_RECON_OWNER_REVIEW_REQUIRED_OBSERVED: 'POST_RECON_OWNER_REVIEW_REQUIRED_OBSERVED',
  POST_RECON_BLOCKED_DEBT_OBSERVED: 'POST_RECON_BLOCKED_DEBT_OBSERVED',
  POST_RECON_NO_FOLLOWUP_GAP_OBSERVED: 'POST_RECON_NO_FOLLOWUP_GAP_OBSERVED',
});

export const POST_RECON_NEXT_STEP_SELECTION_RECORD_DECISIONS = Object.freeze({
  POST_RECON_NEXT_STEP_SELECTION_RECORDED: 'POST_RECON_NEXT_STEP_SELECTION_RECORDED',
  POST_RECON_NEXT_STEP_SELECTION_BLOCKED: 'POST_RECON_NEXT_STEP_SELECTION_BLOCKED',
  STOP_OWNER_REVIEW_REQUIRED: 'STOP_OWNER_REVIEW_REQUIRED',
});

export const POST_RECON_NEXT_STEP_SELECTION_RECORD_REASON_CODES = Object.freeze({
  MISSING_CHANGED_BASENAMES_EVIDENCE: 'MISSING_CHANGED_BASENAMES_EVIDENCE',
  FORBIDDEN_BASENAME_CHANGE: 'FORBIDDEN_BASENAME_CHANGE',
  MISSING_STAGE05Q_POST_RECON_FOLLOWUP_GAP_CLASSIFIER_RECORD_HASH:
    'MISSING_STAGE05Q_POST_RECON_FOLLOWUP_GAP_CLASSIFIER_RECORD_HASH',
  STALE_STAGE05Q_POST_RECON_FOLLOWUP_GAP_CLASSIFIER_RECORD_HASH:
    'STALE_STAGE05Q_POST_RECON_FOLLOWUP_GAP_CLASSIFIER_RECORD_HASH',
  STAGE05Q_POST_RECON_FOLLOWUP_GAP_CLASSIFIER_RECORD_FACTS_ONLY_INPUT:
    'STAGE05Q_POST_RECON_FOLLOWUP_GAP_CLASSIFIER_RECORD_FACTS_ONLY_INPUT',
  SOURCE_STAGE05Q_DECISION_BLOCKED: 'SOURCE_STAGE05Q_DECISION_BLOCKED',
  SOURCE_STAGE05Q_DECISION_STOPPED: 'SOURCE_STAGE05Q_DECISION_STOPPED',
  MISSING_STAGE05Q_CLASSIFICATION: 'MISSING_STAGE05Q_CLASSIFICATION',
  UNKNOWN_STAGE05Q_CLASSIFICATION: 'UNKNOWN_STAGE05Q_CLASSIFICATION',
  CONFLICTING_STAGE05Q_CLASSIFICATION: 'CONFLICTING_STAGE05Q_CLASSIFICATION',
  MISSING_OWNER_NEXT_CONTOUR_PACKET: 'MISSING_OWNER_NEXT_CONTOUR_PACKET',
  WRONG_OWNER_NEXT_CONTOUR_PACKET_KIND: 'WRONG_OWNER_NEXT_CONTOUR_PACKET_KIND',
  WRONG_OWNER_NEXT_CONTOUR_PACKET_TARGET: 'WRONG_OWNER_NEXT_CONTOUR_PACKET_TARGET',
  OWNER_PACKET_SOURCE_HASH_MISMATCH: 'OWNER_PACKET_SOURCE_HASH_MISMATCH',
  MISSING_SELECTED_NEXT_CONTOUR_ID: 'MISSING_SELECTED_NEXT_CONTOUR_ID',
  INVALID_SELECTED_NEXT_CONTOUR_ID: 'INVALID_SELECTED_NEXT_CONTOUR_ID',
  FORBIDDEN_STAGE06_NEXT_CONTOUR_CANDIDATE: 'FORBIDDEN_STAGE06_NEXT_CONTOUR_CANDIDATE',
  OWNER_UNDERSTANDING_FLAG_MISSING: 'OWNER_UNDERSTANDING_FLAG_MISSING',
  OWNER_NEXT_CONTOUR_PACKET_UNKNOWN_FIELD_FORBIDDEN: 'OWNER_NEXT_CONTOUR_PACKET_UNKNOWN_FIELD_FORBIDDEN',
  UNKNOWN_FIELD_FORBIDDEN: 'UNKNOWN_FIELD_FORBIDDEN',
  CALLABLE_FIELD_FORBIDDEN: 'CALLABLE_FIELD_FORBIDDEN',
  USER_PROJECT_PATH_FORBIDDEN: 'USER_PROJECT_PATH_FORBIDDEN',
  FORBIDDEN_PERMISSION_LANGUAGE_FOUND: 'FORBIDDEN_PERMISSION_LANGUAGE_FOUND',
  FORBIDDEN_NEXT_CONTOUR_SELECTION_CLAIM: 'FORBIDDEN_NEXT_CONTOUR_SELECTION_CLAIM',
  FORBIDDEN_NEXT_CONTOUR_OPENING_CLAIM: 'FORBIDDEN_NEXT_CONTOUR_OPENING_CLAIM',
  FORBIDDEN_STAGE05_CLOSE_CLAIM: 'FORBIDDEN_STAGE05_CLOSE_CLAIM',
  FORBIDDEN_STAGE06_OPEN_CLAIM: 'FORBIDDEN_STAGE06_OPEN_CLAIM',
  FORBIDDEN_STAGE06_PRE_ADMISSION_CLAIM: 'FORBIDDEN_STAGE06_PRE_ADMISSION_CLAIM',
  FORBIDDEN_STAGE06_ADMISSION_CLAIM: 'FORBIDDEN_STAGE06_ADMISSION_CLAIM',
  FORBIDDEN_STAGE06_PERMISSION_CLAIM: 'FORBIDDEN_STAGE06_PERMISSION_CLAIM',
  FORBIDDEN_APPLYTXN_CLAIM: 'FORBIDDEN_APPLYTXN_CLAIM',
  FORBIDDEN_RUNTIME_APPLY_CLAIM: 'FORBIDDEN_RUNTIME_APPLY_CLAIM',
  FORBIDDEN_STORAGE_CLAIM: 'FORBIDDEN_STORAGE_CLAIM',
  FORBIDDEN_PROJECT_WRITE_CLAIM: 'FORBIDDEN_PROJECT_WRITE_CLAIM',
  FORBIDDEN_STABLE_ID_CLAIM: 'FORBIDDEN_STABLE_ID_CLAIM',
  FORBIDDEN_LINEAGE_CLAIM: 'FORBIDDEN_LINEAGE_CLAIM',
  FORBIDDEN_UI_DOCX_NETWORK_DEPENDENCY_CLAIM: 'FORBIDDEN_UI_DOCX_NETWORK_DEPENDENCY_CLAIM',
});

const STOP_REASON_CODES = new Set([
  POST_RECON_NEXT_STEP_SELECTION_RECORD_REASON_CODES.MISSING_STAGE05Q_POST_RECON_FOLLOWUP_GAP_CLASSIFIER_RECORD_HASH,
  POST_RECON_NEXT_STEP_SELECTION_RECORD_REASON_CODES.SOURCE_STAGE05Q_DECISION_STOPPED,
  POST_RECON_NEXT_STEP_SELECTION_RECORD_REASON_CODES.MISSING_OWNER_NEXT_CONTOUR_PACKET,
  POST_RECON_NEXT_STEP_SELECTION_RECORD_REASON_CODES.WRONG_OWNER_NEXT_CONTOUR_PACKET_KIND,
  POST_RECON_NEXT_STEP_SELECTION_RECORD_REASON_CODES.WRONG_OWNER_NEXT_CONTOUR_PACKET_TARGET,
  POST_RECON_NEXT_STEP_SELECTION_RECORD_REASON_CODES.OWNER_PACKET_SOURCE_HASH_MISMATCH,
  POST_RECON_NEXT_STEP_SELECTION_RECORD_REASON_CODES.MISSING_SELECTED_NEXT_CONTOUR_ID,
  POST_RECON_NEXT_STEP_SELECTION_RECORD_REASON_CODES.INVALID_SELECTED_NEXT_CONTOUR_ID,
  POST_RECON_NEXT_STEP_SELECTION_RECORD_REASON_CODES.FORBIDDEN_STAGE06_NEXT_CONTOUR_CANDIDATE,
  POST_RECON_NEXT_STEP_SELECTION_RECORD_REASON_CODES.OWNER_UNDERSTANDING_FLAG_MISSING,
]);

const NONBLOCKED_CLASSIFICATION
  = POST_RECON_NEXT_STEP_SELECTION_CLASSIFICATIONS.POST_RECON_NONBLOCKED_FOLLOWUP_GAP_OBSERVED;
const NO_FOLLOWUP_CLASSIFICATION
  = POST_RECON_NEXT_STEP_SELECTION_CLASSIFICATIONS.POST_RECON_NO_FOLLOWUP_GAP_OBSERVED;
const OWNER_REVIEW_CLASSIFICATION
  = POST_RECON_NEXT_STEP_SELECTION_CLASSIFICATIONS.POST_RECON_OWNER_REVIEW_REQUIRED_OBSERVED;
const BLOCKED_DEBT_CLASSIFICATION
  = POST_RECON_NEXT_STEP_SELECTION_CLASSIFICATIONS.POST_RECON_BLOCKED_DEBT_OBSERVED;

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

function toBasenameLikeToken(value) {
  if (!hasText(value)) {
    return '';
  }
  const normalized = value.trim();
  const validToken = /^[A-Za-z0-9._-]+$/u.test(normalized);
  if (!validToken || normalized.includes('/') || normalized.includes('\\')) {
    return '';
  }
  return normalized;
}

function pushChangedBasenameReasons(input, reasons) {
  if (!Array.isArray(input?.changedBasenames)) {
    reasons.push(POST_RECON_NEXT_STEP_SELECTION_RECORD_REASON_CODES.MISSING_CHANGED_BASENAMES_EVIDENCE);
    return;
  }

  const changedBasenames = new Set(input.changedBasenames);
  if (
    input.changedBasenames.length !== ALLOWED_CHANGED_BASENAMES.size
    || changedBasenames.size !== ALLOWED_CHANGED_BASENAMES.size
    || Array.from(ALLOWED_CHANGED_BASENAMES).some((basename) => !changedBasenames.has(basename))
  ) {
    reasons.push(POST_RECON_NEXT_STEP_SELECTION_RECORD_REASON_CODES.MISSING_CHANGED_BASENAMES_EVIDENCE);
  }
  if (input.changedBasenames.some((basename) => !ALLOWED_CHANGED_BASENAMES.has(basename))) {
    reasons.push(POST_RECON_NEXT_STEP_SELECTION_RECORD_REASON_CODES.FORBIDDEN_BASENAME_CHANGE);
  }
}

function pushInputShapeReasons(input = {}, reasons) {
  if (Object.keys(input).some((key) => !ALLOWED_INPUT_KEYS.has(key))) {
    reasons.push(POST_RECON_NEXT_STEP_SELECTION_RECORD_REASON_CODES.UNKNOWN_FIELD_FORBIDDEN);
  }

  const directRef = input.stage05qPostReconFollowupGapClassifierRecordRef;
  if (isObject(directRef) && Object.keys(directRef).some((key) => !ALLOWED_REF_KEYS.has(key))) {
    reasons.push(POST_RECON_NEXT_STEP_SELECTION_RECORD_REASON_CODES.UNKNOWN_FIELD_FORBIDDEN);
  }

  const sourceOutput = input.stage05qPostReconFollowupGapClassifierRecordOutput;
  if (isObject(sourceOutput) && Object.keys(sourceOutput).some((key) => !ALLOWED_SOURCE_OUTPUT_KEYS.has(key))) {
    reasons.push(POST_RECON_NEXT_STEP_SELECTION_RECORD_REASON_CODES.UNKNOWN_FIELD_FORBIDDEN);
  }

  const ownerPacket = input.ownerNextContourPacket;
  if (isObject(ownerPacket) && Object.keys(ownerPacket).some((key) => !OWNER_PACKET_ALLOWED_KEYS.has(key))) {
    reasons.push(POST_RECON_NEXT_STEP_SELECTION_RECORD_REASON_CODES.OWNER_NEXT_CONTOUR_PACKET_UNKNOWN_FIELD_FORBIDDEN);
  }

  if (containsCallable(input)) {
    reasons.push(POST_RECON_NEXT_STEP_SELECTION_RECORD_REASON_CODES.CALLABLE_FIELD_FORBIDDEN);
  }
  if (containsUserProjectPath(input)) {
    reasons.push(POST_RECON_NEXT_STEP_SELECTION_RECORD_REASON_CODES.USER_PROJECT_PATH_FORBIDDEN);
  }
}

function resolveStage05qHashRef(input = {}) {
  const ref = isObject(input.stage05qPostReconFollowupGapClassifierRecordRef)
    ? input.stage05qPostReconFollowupGapClassifierRecordRef
    : {};
  const evidenceHash = hasText(ref.evidenceHash)
    ? ref.evidenceHash
    : (hasText(input.stage05qPostReconFollowupGapClassifierRecordHash)
      ? input.stage05qPostReconFollowupGapClassifierRecordHash
      : '');
  const expectedEvidenceHash = hasText(ref.expectedEvidenceHash)
    ? ref.expectedEvidenceHash
    : (hasText(input.stage05qPostReconFollowupGapClassifierRecordHashExpected)
      ? input.stage05qPostReconFollowupGapClassifierRecordHashExpected
      : '');
  const topLevelStaleApplies = !isObject(input.stage05qPostReconFollowupGapClassifierRecordRef)
    && input.stage05qPostReconFollowupGapClassifierRecordHashStale === true;
  const stale = ref.stale === true
    || topLevelStaleApplies
    || (hasText(expectedEvidenceHash) && hasText(evidenceHash) && expectedEvidenceHash !== evidenceHash);
  const evidencePresent = hasText(evidenceHash);
  const reasonCodes = [];

  if (!evidencePresent) {
    reasonCodes.push(
      POST_RECON_NEXT_STEP_SELECTION_RECORD_REASON_CODES.MISSING_STAGE05Q_POST_RECON_FOLLOWUP_GAP_CLASSIFIER_RECORD_HASH,
    );
  } else {
    reasonCodes.push(
      POST_RECON_NEXT_STEP_SELECTION_RECORD_REASON_CODES.STAGE05Q_POST_RECON_FOLLOWUP_GAP_CLASSIFIER_RECORD_FACTS_ONLY_INPUT,
    );
  }
  if (stale) {
    reasonCodes.push(
      POST_RECON_NEXT_STEP_SELECTION_RECORD_REASON_CODES.STALE_STAGE05Q_POST_RECON_FOLLOWUP_GAP_CLASSIFIER_RECORD_HASH,
    );
  }

  return withCanonicalHash({
    refKind: 'Stage05RRequiredStage05QHashRef',
    contourId: CONTOUR_ID,
    refId: 'STAGE05Q_POST_RECON_FOLLOWUP_GAP_CLASSIFIER_RECORD_REF',
    refClass: 'FACTS_RECORD_ONLY_STAGE05Q',
    evidenceHash,
    expectedEvidenceHash,
    evidencePresent,
    stale,
    factsOnly: true,
    advisoryFactsInputOnly: true,
    stage05Closed: false,
    stage06Opened: false,
    reasonCodes: uniqueSorted(reasonCodes),
  });
}

function resolveSourceFacts(input = {}) {
  const sourceOutput = isObject(input.stage05qPostReconFollowupGapClassifierRecordOutput)
    ? input.stage05qPostReconFollowupGapClassifierRecordOutput
    : {};
  const sourceDecision = hasText(sourceOutput.outputDecision)
    ? sourceOutput.outputDecision
    : (
      hasText(input.stage05qPostReconFollowupGapClassifierRecordDecision)
        ? input.stage05qPostReconFollowupGapClassifierRecordDecision
        : ''
    );

  const candidateClassifications = uniqueSorted([
    hasText(sourceOutput.classification) ? sourceOutput.classification : '',
    hasText(input.stage05qPostReconFollowupGapClassification) ? input.stage05qPostReconFollowupGapClassification : '',
  ]);

  let classification = null;
  let conflictingClassification = false;
  if (candidateClassifications.length === 1) {
    classification = candidateClassifications[0];
  } else if (candidateClassifications.length > 1) {
    conflictingClassification = true;
  }

  const allowedClassifications = Object.values(POST_RECON_NEXT_STEP_SELECTION_CLASSIFICATIONS);
  const classificationKnown = allowedClassifications.includes(classification);
  const sourceStopped = input.sourceStopped === true
    || sourceOutput.sourceStopped === true
    || sourceOutput.ownerReviewRequired === true
    || sourceDecision === 'STOP_OWNER_REVIEW_REQUIRED';
  const sourceBlocked = input.sourceBlocked === true
    || sourceOutput.sourceBlocked === true
    || sourceOutput.blocked === true
    || sourceDecision === 'POST_RECON_FOLLOWUP_GAP_FACTS_BLOCKED';

  return withCanonicalHash({
    observationKind: 'Stage05RPostReconSourceFactsRecord',
    contourId: CONTOUR_ID,
    sourceDecision,
    sourceBlocked,
    sourceStopped,
    conflictingClassification: conflictingClassification || sourceOutput.conflictingObservedSignals === true,
    classification,
    classificationKnown,
    classificationCandidates: candidateClassifications,
    factsOnly: true,
    recordOnly: true,
    nextContourOpened: false,
    automaticNextContourOpened: false,
    stage05Closed: false,
    stage06Opened: false,
  });
}

function pushSourceFactReasons(sourceFacts, reasons) {
  if (sourceFacts.sourceStopped) {
    reasons.push(POST_RECON_NEXT_STEP_SELECTION_RECORD_REASON_CODES.SOURCE_STAGE05Q_DECISION_STOPPED);
  }
  if (sourceFacts.sourceBlocked) {
    reasons.push(POST_RECON_NEXT_STEP_SELECTION_RECORD_REASON_CODES.SOURCE_STAGE05Q_DECISION_BLOCKED);
  }
  if (sourceFacts.conflictingClassification) {
    reasons.push(POST_RECON_NEXT_STEP_SELECTION_RECORD_REASON_CODES.CONFLICTING_STAGE05Q_CLASSIFICATION);
  } else if (!hasText(sourceFacts.classification)) {
    reasons.push(POST_RECON_NEXT_STEP_SELECTION_RECORD_REASON_CODES.MISSING_STAGE05Q_CLASSIFICATION);
  } else if (!sourceFacts.classificationKnown) {
    reasons.push(POST_RECON_NEXT_STEP_SELECTION_RECORD_REASON_CODES.UNKNOWN_STAGE05Q_CLASSIFICATION);
  }
}

function pushForbiddenClaimReasons(values = {}, reasons) {
  for (const group of CLAIM_REASON_GROUPS) {
    if (group.keys.some((key) => isClaimed(values[key]))) {
      reasons.push(POST_RECON_NEXT_STEP_SELECTION_RECORD_REASON_CODES[group.reasonCode]);
    }
  }
}

function permissionLanguageFindings(input = {}, ownerPacket = null) {
  const rawValues = [
    ...asArray(input.permissionLanguageClaims),
    ...asTextList(input.claimLanguage),
    ...asTextList(input.reviewLanguage),
    ...asArray(ownerPacket?.permissionLanguageClaims),
    ...asTextList(ownerPacket?.claimLanguage),
    ...asTextList(ownerPacket?.reviewLanguage),
  ].filter(hasText);
  const findings = [];

  for (const value of rawValues) {
    const normalized = value.toUpperCase();
    const matchedTerms = FORBIDDEN_PERMISSION_LANGUAGE.filter((term) => normalized.includes(term));
    if (matchedTerms.length > 0) {
      findings.push(withCanonicalHash({
        findingKind: 'ForbiddenStage05RPermissionLanguageFinding',
        contourId: CONTOUR_ID,
        language: value,
        matchedTerms: uniqueSorted(matchedTerms),
        reasonCode: POST_RECON_NEXT_STEP_SELECTION_RECORD_REASON_CODES.FORBIDDEN_PERMISSION_LANGUAGE_FOUND,
      }));
    }
  }

  return findings;
}

function validateOwnerPacket(ownerPacketRaw, sourceHashRef, reasons) {
  const ownerPacket = isObject(ownerPacketRaw) ? ownerPacketRaw : null;
  if (!ownerPacket) {
    reasons.push(POST_RECON_NEXT_STEP_SELECTION_RECORD_REASON_CODES.MISSING_OWNER_NEXT_CONTOUR_PACKET);
    return withCanonicalHash({
      packetKind: 'Stage05RPostReconOwnerNextContourPacketRecord',
      contourId: CONTOUR_ID,
      packetPresent: false,
      packetValid: false,
      candidateRecorded: false,
      selectedNextContourId: '',
      sourceStage05QHash: '',
      nextContourOpened: false,
      automaticNextContourOpened: false,
      stage05Closed: false,
      stage06Opened: false,
      reasonCodes: uniqueSorted(reasons),
    });
  }

  if (ownerPacket.packetKind !== OWNER_PACKET_KIND) {
    reasons.push(POST_RECON_NEXT_STEP_SELECTION_RECORD_REASON_CODES.WRONG_OWNER_NEXT_CONTOUR_PACKET_KIND);
  }
  if (ownerPacket.targetContourId !== OWNER_PACKET_TARGET) {
    reasons.push(POST_RECON_NEXT_STEP_SELECTION_RECORD_REASON_CODES.WRONG_OWNER_NEXT_CONTOUR_PACKET_TARGET);
  }

  const sourceStage05QHash = hasText(ownerPacket.sourceStage05QHash) ? ownerPacket.sourceStage05QHash : '';
  if (!hasText(sourceHashRef.evidenceHash) || !hasText(sourceStage05QHash) || sourceStage05QHash !== sourceHashRef.evidenceHash) {
    reasons.push(POST_RECON_NEXT_STEP_SELECTION_RECORD_REASON_CODES.OWNER_PACKET_SOURCE_HASH_MISMATCH);
  }

  const selectedNextContourId = toBasenameLikeToken(ownerPacket.selectedNextContourId);
  if (!hasText(ownerPacket.selectedNextContourId)) {
    reasons.push(POST_RECON_NEXT_STEP_SELECTION_RECORD_REASON_CODES.MISSING_SELECTED_NEXT_CONTOUR_ID);
  } else if (!hasText(selectedNextContourId)) {
    reasons.push(POST_RECON_NEXT_STEP_SELECTION_RECORD_REASON_CODES.INVALID_SELECTED_NEXT_CONTOUR_ID);
  } else if (selectedNextContourId.toUpperCase().startsWith('STAGE06')) {
    reasons.push(POST_RECON_NEXT_STEP_SELECTION_RECORD_REASON_CODES.FORBIDDEN_STAGE06_NEXT_CONTOUR_CANDIDATE);
  }

  for (const flag of UNDERSTANDING_FLAGS) {
    if (ownerPacket[flag] !== true) {
      reasons.push(POST_RECON_NEXT_STEP_SELECTION_RECORD_REASON_CODES.OWNER_UNDERSTANDING_FLAG_MISSING);
    }
  }

  pushForbiddenClaimReasons(ownerPacket, reasons);

  const reasonCodes = uniqueSorted(reasons);
  const candidateAllowed = hasText(selectedNextContourId)
    && reasonCodes.length === 0;
  return withCanonicalHash({
    packetKind: 'Stage05RPostReconOwnerNextContourPacketRecord',
    contourId: CONTOUR_ID,
    packetPresent: true,
    packetValid: reasonCodes.every((reasonCode) => !STOP_REASON_CODES.has(reasonCode)),
    selectedNextContourId: candidateAllowed ? selectedNextContourId : '',
    sourceStage05QHash,
    ownerUnderstandsNoStage05Close: ownerPacket.ownerUnderstandsNoStage05Close === true,
    ownerUnderstandsNoStage06Open: ownerPacket.ownerUnderstandsNoStage06Open === true,
    ownerUnderstandsRecordOnly: ownerPacket.ownerUnderstandsRecordOnly === true,
    candidateRecorded: candidateAllowed,
    nextContourOpened: false,
    automaticNextContourOpened: false,
    stage05Closed: false,
    stage06Opened: false,
    reasonCodes,
  });
}

function createDecision(blockedReasons, sourceFacts, classification) {
  const stopForSourceObservation = classification === OWNER_REVIEW_CLASSIFICATION;
  const stopForMissingHash = blockedReasons.includes(
    POST_RECON_NEXT_STEP_SELECTION_RECORD_REASON_CODES.MISSING_STAGE05Q_POST_RECON_FOLLOWUP_GAP_CLASSIFIER_RECORD_HASH,
  );
  const stopForOwnerPacket = blockedReasons.some((reasonCode) => STOP_REASON_CODES.has(reasonCode));

  let outputDecision;
  if (stopForMissingHash || stopForSourceObservation || stopForOwnerPacket) {
    outputDecision = POST_RECON_NEXT_STEP_SELECTION_RECORD_DECISIONS.STOP_OWNER_REVIEW_REQUIRED;
  } else if (
    blockedReasons.length > 0
    || classification === BLOCKED_DEBT_CLASSIFICATION
    || sourceFacts.sourceBlocked
  ) {
    outputDecision = POST_RECON_NEXT_STEP_SELECTION_RECORD_DECISIONS.POST_RECON_NEXT_STEP_SELECTION_BLOCKED;
  } else {
    outputDecision = POST_RECON_NEXT_STEP_SELECTION_RECORD_DECISIONS.POST_RECON_NEXT_STEP_SELECTION_RECORDED;
  }

  return withCanonicalHash({
    decisionKind: DECISION_KIND,
    contourId: CONTOUR_ID,
    outputDecision,
    blocked:
      outputDecision === POST_RECON_NEXT_STEP_SELECTION_RECORD_DECISIONS.POST_RECON_NEXT_STEP_SELECTION_BLOCKED,
    ownerReviewRequired:
      outputDecision === POST_RECON_NEXT_STEP_SELECTION_RECORD_DECISIONS.STOP_OWNER_REVIEW_REQUIRED,
    blockedReasons,
    classification,
    sourceDecision: sourceFacts.sourceDecision,
  });
}

function buildReviewBom({
  stage05qHashRef,
  sourceFacts,
  ownerPacketRecord,
  blockedReasons,
  permissionFindings,
  nextContourCandidateRecorded,
}) {
  return withCanonicalHash({
    bomKind: 'Stage05RPostReconNextStepSelectionRecordBOM',
    contourId: CONTOUR_ID,
    factsOnly: true,
    recordOnly: true,
    summaryPacket: false,
    requiredHashRefCount: 1,
    presentHashRefCount: stage05qHashRef.evidencePresent ? 1 : 0,
    missingHashRefCount: stage05qHashRef.evidencePresent ? 0 : 1,
    staleHashRefCount: stage05qHashRef.stale ? 1 : 0,
    sourceBlockedCount: sourceFacts.sourceBlocked ? 1 : 0,
    sourceStoppedCount: sourceFacts.sourceStopped ? 1 : 0,
    conflictingClassificationCount: sourceFacts.conflictingClassification ? 1 : 0,
    permissionLanguageFindingCount: permissionFindings.length,
    nextContourCandidateCount: ownerPacketRecord.candidateRecorded ? 1 : 0,
    nextContourSelectionCandidateRecordedCount: nextContourCandidateRecorded ? 1 : 0,
    nextContourOpenedCount: 0,
    automaticNextContourOpenedCount: 0,
    stage05CloseCount: 0,
    stage06OpenCount: 0,
    stage06PreAdmissionCount: 0,
    stage06AdmissionCount: 0,
    stage06PermissionCount: 0,
    applyTxnCount: 0,
    runtimeApplyCount: 0,
    storageMutationCount: 0,
    storageMigrationCount: 0,
    projectWriteCount: 0,
    stableIdCount: 0,
    lineageCount: 0,
    uiDocxNetworkDependencyCount: 0,
    blockedReasonCodes: blockedReasons,
    stage05qHashRefReasonCodes: stage05qHashRef.reasonCodes,
    stage05qHashRefHash: stage05qHashRef.canonicalHash,
    sourceFactsHash: sourceFacts.canonicalHash,
    ownerPacketRecordHash: ownerPacketRecord.canonicalHash,
    permissionLanguageFindingHashes: permissionFindings.map((finding) => finding.canonicalHash).sort(),
  });
}

export function compilePostReconNextStepSelectionRecord(input = {}) {
  const blockedReasons = [];
  pushChangedBasenameReasons(input, blockedReasons);
  pushInputShapeReasons(input, blockedReasons);
  pushForbiddenClaimReasons(input, blockedReasons);

  const stage05qHashRef = resolveStage05qHashRef(input);
  for (const code of stage05qHashRef.reasonCodes) {
    if (
      code
      === POST_RECON_NEXT_STEP_SELECTION_RECORD_REASON_CODES.MISSING_STAGE05Q_POST_RECON_FOLLOWUP_GAP_CLASSIFIER_RECORD_HASH
      || code === POST_RECON_NEXT_STEP_SELECTION_RECORD_REASON_CODES.STALE_STAGE05Q_POST_RECON_FOLLOWUP_GAP_CLASSIFIER_RECORD_HASH
    ) {
      blockedReasons.push(code);
    }
  }

  const sourceFacts = resolveSourceFacts(input);
  pushSourceFactReasons(sourceFacts, blockedReasons);

  const classification = sourceFacts.classification;
  const requiresOwnerPacket = classification === NONBLOCKED_CLASSIFICATION;
  const ownerPacketReasons = [];
  const ownerPacketRecord = requiresOwnerPacket
    ? validateOwnerPacket(input.ownerNextContourPacket, stage05qHashRef, ownerPacketReasons)
    : withCanonicalHash({
      packetKind: 'Stage05RPostReconOwnerNextContourPacketRecord',
      contourId: CONTOUR_ID,
      packetPresent: isObject(input.ownerNextContourPacket),
      packetValid: false,
      candidateRecorded: false,
      selectedNextContourId: '',
      sourceStage05QHash: '',
      nextContourOpened: false,
      automaticNextContourOpened: false,
      stage05Closed: false,
      stage06Opened: false,
      reasonCodes: [],
    });
  blockedReasons.push(...ownerPacketReasons);

  const permissionFindings = permissionLanguageFindings(
    input,
    isObject(input.ownerNextContourPacket) ? input.ownerNextContourPacket : null,
  );
  if (permissionFindings.length > 0) {
    blockedReasons.push(POST_RECON_NEXT_STEP_SELECTION_RECORD_REASON_CODES.FORBIDDEN_PERMISSION_LANGUAGE_FOUND);
  }

  const uniqueBlockedReasons = uniqueSorted(blockedReasons);
  const decision = createDecision(uniqueBlockedReasons, sourceFacts, classification);

  const nextContourCandidateId = (
    decision.outputDecision === POST_RECON_NEXT_STEP_SELECTION_RECORD_DECISIONS.POST_RECON_NEXT_STEP_SELECTION_RECORDED
      && classification === NONBLOCKED_CLASSIFICATION
  )
    ? ownerPacketRecord.selectedNextContourId
    : '';
  const nextContourCandidateRecorded = hasText(nextContourCandidateId);
  const reviewBom = buildReviewBom({
    stage05qHashRef,
    sourceFacts,
    ownerPacketRecord,
    blockedReasons: uniqueBlockedReasons,
    permissionFindings,
    nextContourCandidateRecorded,
  });

  return withCanonicalHash({
    resultKind: RESULT_KIND,
    contourId: CONTOUR_ID,
    outputDecision: decision.outputDecision,
    postReconNextStepSelectionRecorded:
      decision.outputDecision
      === POST_RECON_NEXT_STEP_SELECTION_RECORD_DECISIONS.POST_RECON_NEXT_STEP_SELECTION_RECORDED,
    postReconNextStepSelectionRecordOnly: true,
    factsOnly: true,
    recordOnly: true,
    summaryPacket: false,
    summaryPacketCreated: false,
    blocked: decision.blocked,
    ownerReviewRequired: decision.ownerReviewRequired,
    blockedReasons: uniqueBlockedReasons,
    classification,
    allowedClassifications: Object.values(POST_RECON_NEXT_STEP_SELECTION_CLASSIFICATIONS).sort(),
    stage05qPostReconFollowupGapClassifierRecordHash: stage05qHashRef.evidenceHash,
    stage05qHashAdvisoryFactsOnly: true,
    stage05qHashExitReadyInput: false,
    nextContourCandidateRecorded,
    nextContourSelectionRecordOnly: true,
    nextContourSelectionOutcome: nextContourCandidateRecorded
      ? 'NEXT_CONTOUR_CANDIDATE_RECORDED'
      : 'NO_NEW_CONTOUR_RECORDED',
    selectedNextContourId: nextContourCandidateId,
    nextContourCandidateIds: nextContourCandidateRecorded ? [nextContourCandidateId] : [],
    nextContourOpened: false,
    automaticNextContourOpened: false,
    projectTruth: false,
    projectTruthAccepted: false,
    projectTruthCreated: false,
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
    uiTouched: false,
    docxTouched: false,
    networkTouched: false,
    dependencyTouched: false,
    permissionLanguageFindingCount: reviewBom.permissionLanguageFindingCount,
    stage05qHashRef,
    sourceFacts,
    ownerPacketRecord,
    permissionFindings,
    decisions: [decision],
    reviewBom,
  });
}

export const runPostReconNextStepSelectionRecord = compilePostReconNextStepSelectionRecord;
export const compilePostReconNextStepSelectionRecordOnly = compilePostReconNextStepSelectionRecord;
export const runPostReconNextStepSelectionRecordOnly = compilePostReconNextStepSelectionRecord;

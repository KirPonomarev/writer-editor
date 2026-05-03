import { canonicalHash } from './reviewIrKernel.mjs';

const RESULT_KIND = 'STAGE_05J_BLOCK_LINEAGE_POLICY_KERNEL_RESULT_001';
const DECISION_KIND = 'STAGE_05J_BLOCK_LINEAGE_POLICY_KERNEL_DECISION_001';
const CONTOUR_ID = 'STAGE05J_BLOCK_LINEAGE_POLICY_KERNEL_001';

const ALLOWED_CHANGED_BASENAMES = new Set([
  'blockLineagePolicyKernel.mjs',
  'blockLineagePolicyKernel.contract.test.js',
  'STAGE05J_BLOCK_LINEAGE_POLICY_KERNEL_001.md',
]);

const STRUCTURAL_KINDS = new Set(['MOVE', 'SPLIT', 'MERGE', 'STRUCTURAL']);

const BLOCKING_REASON_CODES = new Set([
  'MISSING_CHANGED_BASENAMES_EVIDENCE',
  'FORBIDDEN_BASENAME_CHANGE',
  'MISSING_STAGE05E_EVIDENCE_REF',
  'MISSING_STAGE05F_EXIT_GUARD_REF',
  'MISSING_STAGE05I_POLICY_REF',
  'STALE_STAGE05_EVIDENCE_REF',
  'FORBIDDEN_BLOCK_LINEAGE_CREATION_CLAIM',
  'FORBIDDEN_BLOCK_LINEAGE_PERSISTENCE_CLAIM',
  'FORBIDDEN_BLOCK_LINEAGE_PROJECT_TRUTH_CLAIM',
  'FORBIDDEN_POLICY_ACCEPTANCE_CLAIM',
  'FORBIDDEN_STAGE06_PERMISSION_CLAIM',
  'FORBIDDEN_APPLYTXN_CLAIM',
]);

export const BLOCK_LINEAGE_POLICY_REASON_CODES = Object.freeze({
  FORBIDDEN_BASENAME_CHANGE: 'FORBIDDEN_BASENAME_CHANGE',
  MISSING_CHANGED_BASENAMES_EVIDENCE: 'MISSING_CHANGED_BASENAMES_EVIDENCE',
  MISSING_STAGE05D_SOURCE_REF: 'MISSING_STAGE05D_SOURCE_REF',
  MISSING_STAGE05E_EVIDENCE_REF: 'MISSING_STAGE05E_EVIDENCE_REF',
  MISSING_STAGE05F_EXIT_GUARD_REF: 'MISSING_STAGE05F_EXIT_GUARD_REF',
  MISSING_STAGE05I_POLICY_REF: 'MISSING_STAGE05I_POLICY_REF',
  STALE_STAGE05_EVIDENCE_REF: 'STALE_STAGE05_EVIDENCE_REF',
  OWNER_DECISION_EVIDENCE_REF_ONLY_NOT_POLICY_ACCEPTANCE:
    'OWNER_DECISION_EVIDENCE_REF_ONLY_NOT_POLICY_ACCEPTANCE',
  STAGE05I_POLICY_REF_GUARD_ONLY_NOT_STABLE_ID_ACCEPTANCE:
    'STAGE05I_POLICY_REF_GUARD_ONLY_NOT_STABLE_ID_ACCEPTANCE',
  STAGE05D_SOURCE_REF_TRACE_ONLY_NOT_POLICY_PASS:
    'STAGE05D_SOURCE_REF_TRACE_ONLY_NOT_POLICY_PASS',
  BLOCK_LINEAGE_PROOF_EVIDENCE_REFERENCE_ONLY:
    'BLOCK_LINEAGE_PROOF_EVIDENCE_REFERENCE_ONLY',
  BLOCK_INSTANCE_POLICY_GUARD_ONLY: 'BLOCK_INSTANCE_POLICY_GUARD_ONLY',
  BLOCK_VERSION_HASH_GUARD_ONLY: 'BLOCK_VERSION_HASH_GUARD_ONLY',
  TARGET_BLOCK_REF_NOT_PROJECT_TRUTH: 'TARGET_BLOCK_REF_NOT_PROJECT_TRUTH',
  FORBIDDEN_BLOCK_LINEAGE_CREATION_CLAIM: 'FORBIDDEN_BLOCK_LINEAGE_CREATION_CLAIM',
  FORBIDDEN_BLOCK_LINEAGE_PERSISTENCE_CLAIM: 'FORBIDDEN_BLOCK_LINEAGE_PERSISTENCE_CLAIM',
  FORBIDDEN_BLOCK_LINEAGE_PROJECT_TRUTH_CLAIM: 'FORBIDDEN_BLOCK_LINEAGE_PROJECT_TRUTH_CLAIM',
  FORBIDDEN_POLICY_ACCEPTANCE_CLAIM: 'FORBIDDEN_POLICY_ACCEPTANCE_CLAIM',
  FORBIDDEN_STAGE06_PERMISSION_CLAIM: 'FORBIDDEN_STAGE06_PERMISSION_CLAIM',
  FORBIDDEN_APPLYTXN_CLAIM: 'FORBIDDEN_APPLYTXN_CLAIM',
  STRUCTURAL_POLICY_MANUAL_ONLY: 'STRUCTURAL_POLICY_MANUAL_ONLY',
  EXACT_TEXT_FUTURE_CONSUMER_ONLY: 'EXACT_TEXT_FUTURE_CONSUMER_ONLY',
});

export const BLOCK_LINEAGE_POLICY_DECISIONS = Object.freeze({
  BLOCK_LINEAGE_POLICY_COMPILED: 'BLOCK_LINEAGE_POLICY_COMPILED',
  BLOCK_LINEAGE_POLICY_BLOCKED: 'BLOCK_LINEAGE_POLICY_BLOCKED',
});

export const BLOCK_LINEAGE_POLICY_MODES = Object.freeze({
  EVIDENCE_REFERENCE_ONLY: 'EVIDENCE_REFERENCE_ONLY',
  ZERO_ACCEPTANCE_GUARD: 'ZERO_ACCEPTANCE_GUARD',
  BLOCKED: 'BLOCKED',
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
    reasons.push(BLOCK_LINEAGE_POLICY_REASON_CODES.MISSING_CHANGED_BASENAMES_EVIDENCE);
    return;
  }
  if (input.changedBasenames.some((basename) => !ALLOWED_CHANGED_BASENAMES.has(basename))) {
    reasons.push(BLOCK_LINEAGE_POLICY_REASON_CODES.FORBIDDEN_BASENAME_CHANGE);
  }
}

function resolveEvidenceRef(input = {}, refKey, hashKey, outputKey) {
  const ref = isObject(input[refKey]) ? input[refKey] : {};
  const output = isObject(input[outputKey]) ? input[outputKey] : {};
  const evidenceHash = hasText(ref.evidenceHash)
    ? ref.evidenceHash
    : (hasText(input[hashKey]) ? input[hashKey] : (hasText(output.canonicalHash) ? output.canonicalHash : ''));
  const expectedEvidenceHash = hasText(ref.expectedEvidenceHash)
    ? ref.expectedEvidenceHash
    : (hasText(input[`${hashKey}Expected`]) ? input[`${hashKey}Expected`] : '');
  const stale = ref.stale === true
    || input[`${hashKey}Stale`] === true
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

function resolveOwnerDecisionEvidenceHash(input = {}, candidate = {}) {
  const evidence = isObject(input.ownerDecisionEvidence) ? input.ownerDecisionEvidence : {};
  const candidateEvidence = isObject(candidate.ownerDecisionEvidence) ? candidate.ownerDecisionEvidence : {};
  const values = [
    input.ownerDecisionEvidenceHash,
    input.ownerDecisionHash,
    evidence.decisionHash,
    evidence.evidenceHash,
    evidence.canonicalHash,
    candidate.ownerDecisionEvidenceHash,
    candidate.ownerDecisionHash,
    candidateEvidence.decisionHash,
    candidateEvidence.evidenceHash,
    candidateEvidence.canonicalHash,
  ];

  for (const value of values) {
    if (hasText(value)) {
      return value;
    }
  }
  return '';
}

function hasBlockLineageCreationClaim(input, candidate) {
  return [
    input.blockLineageCreatedClaimed,
    input.createBlockLineageClaimed,
    input.createBlockLineageIdClaimed,
    candidate.blockLineageCreatedClaimed,
    candidate.createBlockLineageClaimed,
    candidate.createBlockLineageIdClaimed,
  ].some(isClaimed);
}

function hasBlockLineagePersistenceClaim(input, candidate) {
  return [
    input.blockLineagePersistedClaimed,
    input.persistBlockLineageClaimed,
    input.persistBlockLineageIdClaimed,
    candidate.blockLineagePersistedClaimed,
    candidate.persistBlockLineageClaimed,
    candidate.persistBlockLineageIdClaimed,
  ].some(isClaimed);
}

function hasBlockLineageProjectTruthClaim(input, candidate) {
  return [
    input.blockLineageProjectTruthClaimed,
    input.acceptBlockLineageAsProjectTruthClaimed,
    input.acceptLineageAsProjectTruthClaimed,
    candidate.blockLineageProjectTruthClaimed,
    candidate.acceptBlockLineageAsProjectTruthClaimed,
    candidate.acceptLineageAsProjectTruthClaimed,
  ].some(isClaimed);
}

function hasPolicyAcceptanceClaim(input, candidate) {
  return [
    input.policyAcceptanceClaimed,
    input.projectTruthPolicyAcceptedClaimed,
    input.ownerApprovedBlockLineagePolicyClaimed,
    candidate.policyAcceptanceClaimed,
    candidate.projectTruthPolicyAcceptedClaimed,
    candidate.ownerApprovedBlockLineagePolicyClaimed,
  ].some(isClaimed);
}

function hasStage06PermissionClaim(input, candidate) {
  return [
    input.stage06PermissionClaimed,
    input.stage06AdmissionClaimed,
    input.stage06AdmissionGrantedClaimed,
    candidate.stage06PermissionClaimed,
    candidate.stage06AdmissionClaimed,
    candidate.stage06AdmissionGrantedClaimed,
  ].some(isClaimed);
}

function hasApplyTxnClaim(input, candidate) {
  return [
    input.applyTxnClaimed,
    input.applyTxnPermissionClaimed,
    input.applyTxnCreatedClaimed,
    input.applyTxnPerformedClaimed,
    candidate.applyTxnClaimed,
    candidate.applyTxnPermissionClaimed,
    candidate.applyTxnCreatedClaimed,
    candidate.applyTxnPerformedClaimed,
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
    outputDecision: blockedReasons.length > 0
      ? BLOCK_LINEAGE_POLICY_DECISIONS.BLOCK_LINEAGE_POLICY_BLOCKED
      : BLOCK_LINEAGE_POLICY_DECISIONS.BLOCK_LINEAGE_POLICY_COMPILED,
    blocked: blockedReasons.length > 0,
    blockedReasons,
  });
}

function classifyCandidate(input, rawCandidate = {}, context = {}) {
  const candidate = isObject(rawCandidate) ? rawCandidate : {};
  const candidateId = hasText(candidate.candidateId) ? candidate.candidateId : '';
  const blockLineageProof = hasText(candidate.blockLineageProof)
    ? candidate.blockLineageProof
    : (hasText(candidate.optionalBlockLineageIdProof) ? candidate.optionalBlockLineageIdProof : '');
  const blockInstancePolicyRef = hasText(candidate.blockInstancePolicyRef)
    ? candidate.blockInstancePolicyRef
    : (hasText(candidate.externalBlockInstanceProof) ? candidate.externalBlockInstanceProof : '');
  const blockVersionHash = hasText(candidate.blockVersionHash)
    ? candidate.blockVersionHash
    : (hasText(candidate.blockVersionHashEvidence) ? candidate.blockVersionHashEvidence : '');
  const targetBlockRef = hasText(candidate.targetBlockRef)
    ? candidate.targetBlockRef
    : (hasText(candidate.targetBlockRefEvidence) ? candidate.targetBlockRefEvidence : '');
  const structuralKind = upper(candidate.structuralChangeKind || candidate.changeKind || candidate.opKind, 'NONE');
  const exactTextConsumerClaimed = isClaimed(candidate.exactTextConsumerClaimed)
    || upper(candidate.consumerKind, '') === 'EXACT_TEXT';
  const ownerDecisionEvidenceHash = resolveOwnerDecisionEvidenceHash(input, candidate);
  const reasonCodes = [];

  if (hasText(ownerDecisionEvidenceHash)) {
    reasonCodes.push(BLOCK_LINEAGE_POLICY_REASON_CODES.OWNER_DECISION_EVIDENCE_REF_ONLY_NOT_POLICY_ACCEPTANCE);
  }
  if (context.stage05iPolicyRef.evidencePresent) {
    reasonCodes.push(BLOCK_LINEAGE_POLICY_REASON_CODES.STAGE05I_POLICY_REF_GUARD_ONLY_NOT_STABLE_ID_ACCEPTANCE);
  }
  if (context.stage05dSourceRef.evidencePresent) {
    reasonCodes.push(BLOCK_LINEAGE_POLICY_REASON_CODES.STAGE05D_SOURCE_REF_TRACE_ONLY_NOT_POLICY_PASS);
  }
  if (!context.stage05dSourceRef.evidencePresent) {
    reasonCodes.push(BLOCK_LINEAGE_POLICY_REASON_CODES.MISSING_STAGE05D_SOURCE_REF);
  }
  if (hasText(blockLineageProof)) {
    reasonCodes.push(BLOCK_LINEAGE_POLICY_REASON_CODES.BLOCK_LINEAGE_PROOF_EVIDENCE_REFERENCE_ONLY);
  }
  if (hasText(blockInstancePolicyRef)) {
    reasonCodes.push(BLOCK_LINEAGE_POLICY_REASON_CODES.BLOCK_INSTANCE_POLICY_GUARD_ONLY);
  }
  if (hasText(blockVersionHash)) {
    reasonCodes.push(BLOCK_LINEAGE_POLICY_REASON_CODES.BLOCK_VERSION_HASH_GUARD_ONLY);
  }
  if (hasText(targetBlockRef)) {
    reasonCodes.push(BLOCK_LINEAGE_POLICY_REASON_CODES.TARGET_BLOCK_REF_NOT_PROJECT_TRUTH);
  }
  if (STRUCTURAL_KINDS.has(structuralKind)) {
    reasonCodes.push(BLOCK_LINEAGE_POLICY_REASON_CODES.STRUCTURAL_POLICY_MANUAL_ONLY);
  }
  if (exactTextConsumerClaimed) {
    reasonCodes.push(BLOCK_LINEAGE_POLICY_REASON_CODES.EXACT_TEXT_FUTURE_CONSUMER_ONLY);
  }
  if (hasBlockLineageCreationClaim(input, candidate)) {
    reasonCodes.push(BLOCK_LINEAGE_POLICY_REASON_CODES.FORBIDDEN_BLOCK_LINEAGE_CREATION_CLAIM);
  }
  if (hasBlockLineagePersistenceClaim(input, candidate)) {
    reasonCodes.push(BLOCK_LINEAGE_POLICY_REASON_CODES.FORBIDDEN_BLOCK_LINEAGE_PERSISTENCE_CLAIM);
  }
  if (hasBlockLineageProjectTruthClaim(input, candidate)) {
    reasonCodes.push(BLOCK_LINEAGE_POLICY_REASON_CODES.FORBIDDEN_BLOCK_LINEAGE_PROJECT_TRUTH_CLAIM);
  }
  if (hasPolicyAcceptanceClaim(input, candidate)) {
    reasonCodes.push(BLOCK_LINEAGE_POLICY_REASON_CODES.FORBIDDEN_POLICY_ACCEPTANCE_CLAIM);
  }
  if (hasStage06PermissionClaim(input, candidate)) {
    reasonCodes.push(BLOCK_LINEAGE_POLICY_REASON_CODES.FORBIDDEN_STAGE06_PERMISSION_CLAIM);
  }
  if (hasApplyTxnClaim(input, candidate)) {
    reasonCodes.push(BLOCK_LINEAGE_POLICY_REASON_CODES.FORBIDDEN_APPLYTXN_CLAIM);
  }

  const uniqueReasonCodes = uniqueSorted(reasonCodes);
  const blocked = uniqueReasonCodes.some((code) => BLOCKING_REASON_CODES.has(code));
  const policyEvidenceHash = canonicalHash({
    candidateId,
    blockLineageProof,
    blockInstancePolicyRef,
    blockVersionHash,
    targetBlockRef,
    structuralKind,
    exactTextConsumerClaimed,
    ownerDecisionEvidenceHash,
    stage05eEvidenceHash: context.stage05eEvidenceRef.evidenceHash,
    stage05fExitGuardHash: context.stage05fExitGuardRef.evidenceHash,
    stage05iPolicyHash: context.stage05iPolicyRef.evidenceHash,
    stage05dSourceHash: context.stage05dSourceRef.evidenceHash,
    reasonCodes: uniqueReasonCodes,
  });

  return withCanonicalHash({
    classificationKind: 'BlockLineagePolicyClassification',
    contourId: CONTOUR_ID,
    candidateId,
    classification: blocked
      ? BLOCK_LINEAGE_POLICY_MODES.BLOCKED
      : BLOCK_LINEAGE_POLICY_MODES.EVIDENCE_REFERENCE_ONLY,
    policyEvidenceHash,
    ownerDecisionEvidenceHash,
    ownerDecisionEvidenceIsPolicyAcceptance: false,
    blockLineageProof,
    blockInstancePolicyRef,
    blockVersionHash,
    targetBlockRef,
    blockLineageCreated: false,
    blockLineagePersisted: false,
    blockLineageProjectTruthClaimed: false,
    stableBlockInstancePolicyAccepted: false,
    policyAcceptedAsProjectTruth: false,
    stage06AdmissionGranted: false,
    applyTxnPermissionGranted: false,
    exactTextCurrentApplyPath: false,
    structuralPolicyManualOnly: STRUCTURAL_KINDS.has(structuralKind),
    reasonCodes: uniqueReasonCodes,
  });
}

function createZeroAcceptanceClassification(context = {}) {
  return withCanonicalHash({
    classificationKind: 'BlockLineagePolicyClassification',
    contourId: CONTOUR_ID,
    candidateId: '',
    classification: BLOCK_LINEAGE_POLICY_MODES.ZERO_ACCEPTANCE_GUARD,
    policyEvidenceHash: canonicalHash({
      emptyCandidates: true,
      stage05eEvidenceHash: context.stage05eEvidenceRef.evidenceHash,
      stage05fExitGuardHash: context.stage05fExitGuardRef.evidenceHash,
      stage05iPolicyHash: context.stage05iPolicyRef.evidenceHash,
      stage05dSourceHash: context.stage05dSourceRef.evidenceHash,
    }),
    ownerDecisionEvidenceHash: '',
    ownerDecisionEvidenceIsPolicyAcceptance: false,
    blockLineageProof: '',
    blockInstancePolicyRef: '',
    blockVersionHash: '',
    targetBlockRef: '',
    blockLineageCreated: false,
    blockLineagePersisted: false,
    blockLineageProjectTruthClaimed: false,
    stableBlockInstancePolicyAccepted: false,
    policyAcceptedAsProjectTruth: false,
    stage06AdmissionGranted: false,
    applyTxnPermissionGranted: false,
    exactTextCurrentApplyPath: false,
    structuralPolicyManualOnly: false,
    reasonCodes: [],
  });
}

function buildReviewBom({ classifications, blockedReasons, anomalies }) {
  return withCanonicalHash({
    bomKind: 'BlockLineagePolicyReviewBOM',
    contourId: CONTOUR_ID,
    classificationCount: classifications.length,
    evidenceReferenceCount: classifications.filter(
      (item) => item.classification === BLOCK_LINEAGE_POLICY_MODES.EVIDENCE_REFERENCE_ONLY,
    ).length,
    zeroAcceptanceGuardCount: classifications.filter(
      (item) => item.classification === BLOCK_LINEAGE_POLICY_MODES.ZERO_ACCEPTANCE_GUARD,
    ).length,
    blockedClassificationCount: classifications.filter(
      (item) => item.classification === BLOCK_LINEAGE_POLICY_MODES.BLOCKED,
    ).length,
    blockerCount: blockedReasons.length,
    blockerCodes: blockedReasons,
    acceptedProjectTruthCount: 0,
    blockLineageCreatedCount: 0,
    blockLineagePersistedCount: 0,
    anomalyCount: anomalies.length,
    anomalyCodeCounts: anomalyCodeCounts(anomalies),
    policyEvidenceHashes: classifications.map((item) => item.policyEvidenceHash).sort(),
  });
}

function createStage06BlockersPreview({ blockedReasons }) {
  return withCanonicalHash({
    packetKind: 'Stage06BlockersPreview',
    contourId: CONTOUR_ID,
    previewOnly: true,
    stage06AdmissionGranted: false,
    applyTxnPermissionGranted: false,
    blockerCodes: blockedReasons,
  });
}

function pushTopLevelForbiddenClaimReasons(input, reasons) {
  if (hasBlockLineageCreationClaim(input, {})) {
    reasons.push(BLOCK_LINEAGE_POLICY_REASON_CODES.FORBIDDEN_BLOCK_LINEAGE_CREATION_CLAIM);
  }
  if (hasBlockLineagePersistenceClaim(input, {})) {
    reasons.push(BLOCK_LINEAGE_POLICY_REASON_CODES.FORBIDDEN_BLOCK_LINEAGE_PERSISTENCE_CLAIM);
  }
  if (hasBlockLineageProjectTruthClaim(input, {})) {
    reasons.push(BLOCK_LINEAGE_POLICY_REASON_CODES.FORBIDDEN_BLOCK_LINEAGE_PROJECT_TRUTH_CLAIM);
  }
  if (hasPolicyAcceptanceClaim(input, {})) {
    reasons.push(BLOCK_LINEAGE_POLICY_REASON_CODES.FORBIDDEN_POLICY_ACCEPTANCE_CLAIM);
  }
  if (hasStage06PermissionClaim(input, {})) {
    reasons.push(BLOCK_LINEAGE_POLICY_REASON_CODES.FORBIDDEN_STAGE06_PERMISSION_CLAIM);
  }
  if (hasApplyTxnClaim(input, {})) {
    reasons.push(BLOCK_LINEAGE_POLICY_REASON_CODES.FORBIDDEN_APPLYTXN_CLAIM);
  }
}

export function compileBlockLineagePolicyKernel(input = {}) {
  const blockedReasons = [];
  const anomalies = [];
  const classifications = [];

  pushChangedBasenameReasons(input, blockedReasons);
  pushTopLevelForbiddenClaimReasons(input, blockedReasons);

  const stage05dSourceRef = resolveEvidenceRef(
    input,
    'stage05dSourceRef',
    'stage05dSourceRefHash',
    'stage05dSourceOutput',
  );
  const stage05eEvidenceRef = resolveEvidenceRef(
    input,
    'stage05eEvidenceRef',
    'stage05eEvidenceRefHash',
    'stage05eClassifierOutput',
  );
  const stage05fExitGuardRef = resolveEvidenceRef(
    input,
    'stage05fExitGuardRef',
    'stage05fExitGuardRefHash',
    'stage05fExitGuardOutput',
  );
  const stage05iPolicyRef = resolveEvidenceRef(
    input,
    'stage05iPolicyRef',
    'stage05iPolicyRefHash',
    'stage05iPolicyOutput',
  );

  if (!stage05eEvidenceRef.evidencePresent) {
    blockedReasons.push(BLOCK_LINEAGE_POLICY_REASON_CODES.MISSING_STAGE05E_EVIDENCE_REF);
  }
  if (!stage05fExitGuardRef.evidencePresent) {
    blockedReasons.push(BLOCK_LINEAGE_POLICY_REASON_CODES.MISSING_STAGE05F_EXIT_GUARD_REF);
  }
  if (!stage05iPolicyRef.evidencePresent) {
    blockedReasons.push(BLOCK_LINEAGE_POLICY_REASON_CODES.MISSING_STAGE05I_POLICY_REF);
  }
  if (stage05dSourceRef.stale || stage05eEvidenceRef.stale || stage05fExitGuardRef.stale || stage05iPolicyRef.stale) {
    blockedReasons.push(BLOCK_LINEAGE_POLICY_REASON_CODES.STALE_STAGE05_EVIDENCE_REF);
  }

  const context = {
    stage05dSourceRef,
    stage05eEvidenceRef,
    stage05fExitGuardRef,
    stage05iPolicyRef,
  };

  const candidates = asArray(input.candidates);
  if (candidates.length === 0) {
    classifications.push(createZeroAcceptanceClassification(context));
  }

  for (const rawCandidate of candidates) {
    const classification = classifyCandidate(input, rawCandidate, context);
    classifications.push(classification);
    for (const reasonCode of classification.reasonCodes) {
      if (BLOCKING_REASON_CODES.has(reasonCode)) {
        blockedReasons.push(reasonCode);
      }
    }
  }

  const uniqueBlockedReasons = uniqueSorted(blockedReasons);
  const decision = createDecision(uniqueBlockedReasons);
  const reviewBom = buildReviewBom({ classifications, blockedReasons: uniqueBlockedReasons, anomalies });
  const stage06BlockersPreview = createStage06BlockersPreview({ blockedReasons: uniqueBlockedReasons });

  return withCanonicalHash({
    resultKind: RESULT_KIND,
    contourId: CONTOUR_ID,
    outputDecision: decision.outputDecision,
    blockedReasons: uniqueBlockedReasons,
    stage05dSourceRef,
    stage05eEvidenceRef,
    stage05fExitGuardRef,
    stage05iPolicyRef,
    projectWritePerformed: false,
    runtimeApplyPerformed: false,
    applyOpCreated: false,
    applyOpPerformed: false,
    applyTxnCreated: false,
    applyTxnPerformed: false,
    storageMutationPerformed: false,
    storageMigrationPerformed: false,
    atomicWritePerformed: false,
    recoveryWritePerformed: false,
    blockLineageCreated: false,
    blockLineagePersisted: false,
    stableBlockInstancePolicyAccepted: false,
    policyAcceptedAsProjectTruth: false,
    projectTruthPolicyAccepted: false,
    stage06AdmissionGranted: false,
    applyTxnPermissionGranted: false,
    ownerDecisionOutcomeClaimed: false,
    ownerDecisionEvidenceIsPolicyAcceptance: false,
    exactTextCurrentApplyPath: false,
    structuralPolicyManualOnly: classifications.some((item) => item.structuralPolicyManualOnly),
    decisions: [decision],
    classifications,
    anomalies,
    reviewBom,
    stage06BlockersPreview,
  });
}

export const runBlockLineagePolicyKernel = compileBlockLineagePolicyKernel;

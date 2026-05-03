import { canonicalHash } from './reviewIrKernel.mjs';

const RESULT_KIND = 'STAGE_05I_STABLE_BLOCK_INSTANCE_ID_POLICY_KERNEL_RESULT_001';
const DECISION_KIND = 'STAGE_05I_STABLE_BLOCK_INSTANCE_ID_POLICY_KERNEL_DECISION_001';
const CONTOUR_ID = 'STAGE05I_STABLE_BLOCK_INSTANCE_ID_POLICY_KERNEL_001';

const ALLOWED_CHANGED_BASENAMES = new Set([
  'stableBlockInstanceIdPolicyKernel.mjs',
  'stableBlockInstanceIdPolicyKernel.contract.test.js',
  'STAGE05I_STABLE_BLOCK_INSTANCE_ID_POLICY_KERNEL_001.md',
]);

const STRUCTURAL_KINDS = new Set(['MOVE', 'SPLIT', 'MERGE', 'STRUCTURAL']);

const BLOCKING_REASON_CODES = new Set([
  'MISSING_CHANGED_BASENAMES_EVIDENCE',
  'FORBIDDEN_BASENAME_CHANGE',
  'MISSING_STAGE05E_EVIDENCE_REF',
  'MISSING_STAGE05F_EXIT_GUARD_REF',
  'STALE_STAGE05_EVIDENCE_REF',
  'FORBIDDEN_STABLE_BLOCK_INSTANCE_ID_CREATION_CLAIM',
  'FORBIDDEN_POLICY_ACCEPTANCE_CLAIM',
  'FORBIDDEN_STAGE06_PERMISSION_CLAIM',
  'FORBIDDEN_APPLYTXN_CLAIM',
]);

export const STABLE_BLOCK_INSTANCE_ID_POLICY_REASON_CODES = Object.freeze({
  FORBIDDEN_BASENAME_CHANGE: 'FORBIDDEN_BASENAME_CHANGE',
  MISSING_CHANGED_BASENAMES_EVIDENCE: 'MISSING_CHANGED_BASENAMES_EVIDENCE',
  MISSING_STAGE05E_EVIDENCE_REF: 'MISSING_STAGE05E_EVIDENCE_REF',
  MISSING_STAGE05F_EXIT_GUARD_REF: 'MISSING_STAGE05F_EXIT_GUARD_REF',
  STALE_STAGE05_EVIDENCE_REF: 'STALE_STAGE05_EVIDENCE_REF',
  OWNER_DECISION_EVIDENCE_REF_ONLY_NOT_POLICY_ACCEPTANCE:
    'OWNER_DECISION_EVIDENCE_REF_ONLY_NOT_POLICY_ACCEPTANCE',
  BLOCK_INSTANCE_PROOF_ADVISORY_ONLY: 'BLOCK_INSTANCE_PROOF_ADVISORY_ONLY',
  BLOCK_LINEAGE_PROOF_ADVISORY_ONLY: 'BLOCK_LINEAGE_PROOF_ADVISORY_ONLY',
  BLOCK_VERSION_HASH_GUARD_ONLY: 'BLOCK_VERSION_HASH_GUARD_ONLY',
  TARGET_BLOCK_REF_NOT_PROJECT_TRUTH: 'TARGET_BLOCK_REF_NOT_PROJECT_TRUTH',
  FORBIDDEN_STABLE_BLOCK_INSTANCE_ID_CREATION_CLAIM:
    'FORBIDDEN_STABLE_BLOCK_INSTANCE_ID_CREATION_CLAIM',
  FORBIDDEN_POLICY_ACCEPTANCE_CLAIM: 'FORBIDDEN_POLICY_ACCEPTANCE_CLAIM',
  FORBIDDEN_STAGE06_PERMISSION_CLAIM: 'FORBIDDEN_STAGE06_PERMISSION_CLAIM',
  FORBIDDEN_APPLYTXN_CLAIM: 'FORBIDDEN_APPLYTXN_CLAIM',
  STRUCTURAL_POLICY_MANUAL_ONLY: 'STRUCTURAL_POLICY_MANUAL_ONLY',
  EXACT_TEXT_FUTURE_CONSUMER_ONLY: 'EXACT_TEXT_FUTURE_CONSUMER_ONLY',
});

export const STABLE_BLOCK_INSTANCE_ID_POLICY_DECISIONS = Object.freeze({
  STABLE_BLOCK_INSTANCE_ID_POLICY_COMPILED: 'STABLE_BLOCK_INSTANCE_ID_POLICY_COMPILED',
  STABLE_BLOCK_INSTANCE_ID_POLICY_BLOCKED: 'STABLE_BLOCK_INSTANCE_ID_POLICY_BLOCKED',
});

export const STABLE_BLOCK_INSTANCE_ID_POLICY_MODES = Object.freeze({
  EVIDENCE_REFERENCE_ONLY: 'EVIDENCE_REFERENCE_ONLY',
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
    reasons.push(STABLE_BLOCK_INSTANCE_ID_POLICY_REASON_CODES.MISSING_CHANGED_BASENAMES_EVIDENCE);
    return;
  }
  if (input.changedBasenames.some((basename) => !ALLOWED_CHANGED_BASENAMES.has(basename))) {
    reasons.push(STABLE_BLOCK_INSTANCE_ID_POLICY_REASON_CODES.FORBIDDEN_BASENAME_CHANGE);
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

function hasStableBlockInstanceCreationClaim(input, candidate) {
  return [
    input.stableBlockInstanceIdCreatedClaimed,
    input.stableBlockInstanceIdPersistedClaimed,
    input.createStableBlockInstanceIdClaimed,
    input.persistStableBlockInstanceIdClaimed,
    candidate.stableBlockInstanceIdCreatedClaimed,
    candidate.stableBlockInstanceIdPersistedClaimed,
    candidate.createStableBlockInstanceIdClaimed,
    candidate.persistStableBlockInstanceIdClaimed,
  ].some(isClaimed);
}

function hasPolicyAcceptanceClaim(input, candidate) {
  return [
    input.policyAcceptanceClaimed,
    input.projectTruthPolicyAcceptedClaimed,
    input.ownerApprovedBlockInstancePolicyClaimed,
    candidate.policyAcceptanceClaimed,
    candidate.projectTruthPolicyAcceptedClaimed,
    candidate.ownerApprovedBlockInstancePolicyClaimed,
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
      ? STABLE_BLOCK_INSTANCE_ID_POLICY_DECISIONS.STABLE_BLOCK_INSTANCE_ID_POLICY_BLOCKED
      : STABLE_BLOCK_INSTANCE_ID_POLICY_DECISIONS.STABLE_BLOCK_INSTANCE_ID_POLICY_COMPILED,
    blocked: blockedReasons.length > 0,
    blockedReasons,
  });
}

function classifyCandidate(input, rawCandidate = {}, context = {}) {
  const candidate = isObject(rawCandidate) ? rawCandidate : {};
  const candidateId = hasText(candidate.candidateId) ? candidate.candidateId : '';
  const externalBlockInstanceProof = hasText(candidate.externalBlockInstanceProof)
    ? candidate.externalBlockInstanceProof
    : (hasText(candidate.optionalBlockInstanceIdProof) ? candidate.optionalBlockInstanceIdProof : '');
  const blockLineageProof = hasText(candidate.blockLineageProof)
    ? candidate.blockLineageProof
    : (hasText(candidate.optionalBlockLineageIdProof) ? candidate.optionalBlockLineageIdProof : '');
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
    reasonCodes.push(
      STABLE_BLOCK_INSTANCE_ID_POLICY_REASON_CODES.OWNER_DECISION_EVIDENCE_REF_ONLY_NOT_POLICY_ACCEPTANCE,
    );
  }

  if (hasText(externalBlockInstanceProof)) {
    reasonCodes.push(STABLE_BLOCK_INSTANCE_ID_POLICY_REASON_CODES.BLOCK_INSTANCE_PROOF_ADVISORY_ONLY);
  }

  if (hasText(blockLineageProof)) {
    reasonCodes.push(STABLE_BLOCK_INSTANCE_ID_POLICY_REASON_CODES.BLOCK_LINEAGE_PROOF_ADVISORY_ONLY);
  }

  if (hasText(blockVersionHash)) {
    reasonCodes.push(STABLE_BLOCK_INSTANCE_ID_POLICY_REASON_CODES.BLOCK_VERSION_HASH_GUARD_ONLY);
  }

  if (hasText(targetBlockRef)) {
    reasonCodes.push(STABLE_BLOCK_INSTANCE_ID_POLICY_REASON_CODES.TARGET_BLOCK_REF_NOT_PROJECT_TRUTH);
  }

  if (STRUCTURAL_KINDS.has(structuralKind)) {
    reasonCodes.push(STABLE_BLOCK_INSTANCE_ID_POLICY_REASON_CODES.STRUCTURAL_POLICY_MANUAL_ONLY);
  }

  if (exactTextConsumerClaimed) {
    reasonCodes.push(STABLE_BLOCK_INSTANCE_ID_POLICY_REASON_CODES.EXACT_TEXT_FUTURE_CONSUMER_ONLY);
  }

  if (hasStableBlockInstanceCreationClaim(input, candidate)) {
    reasonCodes.push(STABLE_BLOCK_INSTANCE_ID_POLICY_REASON_CODES.FORBIDDEN_STABLE_BLOCK_INSTANCE_ID_CREATION_CLAIM);
  }

  if (hasPolicyAcceptanceClaim(input, candidate)) {
    reasonCodes.push(STABLE_BLOCK_INSTANCE_ID_POLICY_REASON_CODES.FORBIDDEN_POLICY_ACCEPTANCE_CLAIM);
  }

  if (hasStage06PermissionClaim(input, candidate)) {
    reasonCodes.push(STABLE_BLOCK_INSTANCE_ID_POLICY_REASON_CODES.FORBIDDEN_STAGE06_PERMISSION_CLAIM);
  }

  if (hasApplyTxnClaim(input, candidate)) {
    reasonCodes.push(STABLE_BLOCK_INSTANCE_ID_POLICY_REASON_CODES.FORBIDDEN_APPLYTXN_CLAIM);
  }

  const uniqueReasonCodes = uniqueSorted(reasonCodes);
  const blocked = uniqueReasonCodes.some((code) => BLOCKING_REASON_CODES.has(code));
  const policyEvidenceHash = canonicalHash({
    candidateId,
    externalBlockInstanceProof,
    blockLineageProof,
    blockVersionHash,
    targetBlockRef,
    structuralKind,
    exactTextConsumerClaimed,
    ownerDecisionEvidenceHash,
    stage05eEvidenceHash: context.stage05eEvidenceRef.evidenceHash,
    stage05fExitGuardHash: context.stage05fExitGuardRef.evidenceHash,
    reasonCodes: uniqueReasonCodes,
  });

  return withCanonicalHash({
    classificationKind: 'StableBlockInstanceIdPolicyClassification',
    contourId: CONTOUR_ID,
    candidateId,
    classification: blocked
      ? STABLE_BLOCK_INSTANCE_ID_POLICY_MODES.BLOCKED
      : STABLE_BLOCK_INSTANCE_ID_POLICY_MODES.EVIDENCE_REFERENCE_ONLY,
    policyEvidenceHash,
    ownerDecisionEvidenceHash,
    ownerDecisionEvidenceIsPolicyAcceptance: false,
    externalBlockInstanceProof,
    blockLineageProof,
    blockVersionHash,
    targetBlockRef,
    stableBlockInstanceIdCreated: false,
    stableBlockInstanceIdPersisted: false,
    stableBlockInstanceIdProjectTruthClaimed: false,
    policyAcceptedAsProjectTruth: false,
    stage06AdmissionGranted: false,
    applyTxnPermissionGranted: false,
    exactTextCurrentApplyPath: false,
    structuralPolicyManualOnly: STRUCTURAL_KINDS.has(structuralKind),
    reasonCodes: uniqueReasonCodes,
  });
}

function buildReviewBom({ classifications, blockedReasons, anomalies }) {
  return withCanonicalHash({
    bomKind: 'StableBlockInstanceIdPolicyReviewBOM',
    contourId: CONTOUR_ID,
    classificationCount: classifications.length,
    advisoryEvidenceCount: classifications.filter(
      (item) => item.classification === STABLE_BLOCK_INSTANCE_ID_POLICY_MODES.EVIDENCE_REFERENCE_ONLY,
    ).length,
    blockedClassificationCount: classifications.filter(
      (item) => item.classification === STABLE_BLOCK_INSTANCE_ID_POLICY_MODES.BLOCKED,
    ).length,
    blockerCount: blockedReasons.length,
    blockerCodes: blockedReasons,
    acceptedProjectTruthCount: 0,
    stableBlockInstanceIdCreatedCount: 0,
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
  if (hasStableBlockInstanceCreationClaim(input, {})) {
    reasons.push(STABLE_BLOCK_INSTANCE_ID_POLICY_REASON_CODES.FORBIDDEN_STABLE_BLOCK_INSTANCE_ID_CREATION_CLAIM);
  }
  if (hasPolicyAcceptanceClaim(input, {})) {
    reasons.push(STABLE_BLOCK_INSTANCE_ID_POLICY_REASON_CODES.FORBIDDEN_POLICY_ACCEPTANCE_CLAIM);
  }
  if (hasStage06PermissionClaim(input, {})) {
    reasons.push(STABLE_BLOCK_INSTANCE_ID_POLICY_REASON_CODES.FORBIDDEN_STAGE06_PERMISSION_CLAIM);
  }
  if (hasApplyTxnClaim(input, {})) {
    reasons.push(STABLE_BLOCK_INSTANCE_ID_POLICY_REASON_CODES.FORBIDDEN_APPLYTXN_CLAIM);
  }
}

export function compileStableBlockInstanceIdPolicyKernel(input = {}) {
  const blockedReasons = [];
  const anomalies = [];
  const classifications = [];

  pushChangedBasenameReasons(input, blockedReasons);
  pushTopLevelForbiddenClaimReasons(input, blockedReasons);

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

  if (!stage05eEvidenceRef.evidencePresent) {
    blockedReasons.push(STABLE_BLOCK_INSTANCE_ID_POLICY_REASON_CODES.MISSING_STAGE05E_EVIDENCE_REF);
  }
  if (!stage05fExitGuardRef.evidencePresent) {
    blockedReasons.push(STABLE_BLOCK_INSTANCE_ID_POLICY_REASON_CODES.MISSING_STAGE05F_EXIT_GUARD_REF);
  }
  if (stage05eEvidenceRef.stale || stage05fExitGuardRef.stale) {
    blockedReasons.push(STABLE_BLOCK_INSTANCE_ID_POLICY_REASON_CODES.STALE_STAGE05_EVIDENCE_REF);
  }

  for (const rawCandidate of asArray(input.candidates)) {
    const classification = classifyCandidate(input, rawCandidate, {
      stage05eEvidenceRef,
      stage05fExitGuardRef,
    });
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
    stage05eEvidenceRef,
    stage05fExitGuardRef,
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
    stableBlockInstanceIdCreated: false,
    stableBlockInstanceIdPersisted: false,
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

export const runStableBlockInstanceIdPolicyKernel = compileStableBlockInstanceIdPolicyKernel;

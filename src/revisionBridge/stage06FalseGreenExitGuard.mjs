import { canonicalHash } from './reviewIrKernel.mjs';

const RESULT_KIND = 'STAGE_05F_STAGE06_FALSE_GREEN_EXIT_GUARD_RESULT_001';
const DECISION_KIND = 'STAGE_05F_STAGE06_FALSE_GREEN_EXIT_GUARD_DECISION_001';
const CONTOUR_ID = 'STAGE05F_STAGE06_FALSE_GREEN_EXIT_GUARD_001';

const ALLOWED_CHANGED_BASENAMES = new Set([
  'stage06FalseGreenExitGuard.mjs',
  'stage06FalseGreenExitGuard.contract.test.js',
  'STAGE05F_STAGE06_FALSE_GREEN_EXIT_GUARD_001.md',
]);

const STRUCTURAL_KINDS = new Set(['MOVE', 'SPLIT', 'MERGE', 'STRUCTURAL']);

const BLOCKING_REASON_CODES = new Set([
  'MISSING_CHANGED_BASENAMES_EVIDENCE',
  'FORBIDDEN_BASENAME_CHANGE',
  'MISSING_STAGE05E_EVIDENCE_REF',
  'STALE_STAGE05_EVIDENCE_REF',
  'OWNER_DECISION_EVIDENCE_NOT_PRESENT',
  'BLOCK_INSTANCE_POLICY_NOT_ACCEPTED',
  'BLOCK_LINEAGE_POLICY_NOT_ACCEPTED',
  'FORBIDDEN_STAGE06_PERMISSION_CLAIM',
  'FORBIDDEN_APPLYTXN_CLAIM',
  'FORBIDDEN_POLICY_ACCEPTANCE_CLAIM',
  'FORBIDDEN_STAGE06_API_MODEL_CREATION_CLAIM',
]);

export const STAGE06_FALSE_GREEN_EXIT_GUARD_REASON_CODES = Object.freeze({
  FORBIDDEN_BASENAME_CHANGE: 'FORBIDDEN_BASENAME_CHANGE',
  MISSING_CHANGED_BASENAMES_EVIDENCE: 'MISSING_CHANGED_BASENAMES_EVIDENCE',
  OWNER_DECISION_EVIDENCE_NOT_PRESENT: 'OWNER_DECISION_EVIDENCE_NOT_PRESENT',
  BLOCK_INSTANCE_POLICY_NOT_ACCEPTED: 'BLOCK_INSTANCE_POLICY_NOT_ACCEPTED',
  BLOCK_LINEAGE_POLICY_NOT_ACCEPTED: 'BLOCK_LINEAGE_POLICY_NOT_ACCEPTED',
  MISSING_STAGE05E_EVIDENCE_REF: 'MISSING_STAGE05E_EVIDENCE_REF',
  STALE_STAGE05_EVIDENCE_REF: 'STALE_STAGE05_EVIDENCE_REF',
  STAGE05E_EVIDENCE_REF_ONLY_NOT_PERMISSION: 'STAGE05E_EVIDENCE_REF_ONLY_NOT_PERMISSION',
  STAGE05E_ADVISORY_ONLY_PROOFS_NOT_PERMISSION: 'STAGE05E_ADVISORY_ONLY_PROOFS_NOT_PERMISSION',
  OWNER_DECISION_EVIDENCE_REF_ONLY_NOT_POLICY_ACCEPTANCE:
    'OWNER_DECISION_EVIDENCE_REF_ONLY_NOT_POLICY_ACCEPTANCE',
  BLOCK_INSTANCE_PROOF_ADVISORY_ONLY: 'BLOCK_INSTANCE_PROOF_ADVISORY_ONLY',
  BLOCK_LINEAGE_PROOF_ADVISORY_ONLY: 'BLOCK_LINEAGE_PROOF_ADVISORY_ONLY',
  STRUCTURAL_POLICY_MANUAL_ONLY: 'STRUCTURAL_POLICY_MANUAL_ONLY',
  FORBIDDEN_STAGE06_PERMISSION_CLAIM: 'FORBIDDEN_STAGE06_PERMISSION_CLAIM',
  FORBIDDEN_APPLYTXN_CLAIM: 'FORBIDDEN_APPLYTXN_CLAIM',
  FORBIDDEN_POLICY_ACCEPTANCE_CLAIM: 'FORBIDDEN_POLICY_ACCEPTANCE_CLAIM',
  FORBIDDEN_STAGE06_API_MODEL_CREATION_CLAIM: 'FORBIDDEN_STAGE06_API_MODEL_CREATION_CLAIM',
});

export const STAGE06_FALSE_GREEN_EXIT_GUARD_DECISIONS = Object.freeze({
  STAGE06_FALSE_GREEN_EXIT_GUARD_COMPILED: 'STAGE06_FALSE_GREEN_EXIT_GUARD_COMPILED',
  STAGE06_FALSE_GREEN_EXIT_GUARD_BLOCKED: 'STAGE06_FALSE_GREEN_EXIT_GUARD_BLOCKED',
});

export const OWNER_DECISION_EVIDENCE_STATUS = Object.freeze({
  NOT_PRESENT: 'NOT_PRESENT',
  PRESENT_WITH_HASH: 'PRESENT_WITH_HASH',
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
    reasons.push(STAGE06_FALSE_GREEN_EXIT_GUARD_REASON_CODES.MISSING_CHANGED_BASENAMES_EVIDENCE);
    return;
  }
  if (input.changedBasenames.some((basename) => !ALLOWED_CHANGED_BASENAMES.has(basename))) {
    reasons.push(STAGE06_FALSE_GREEN_EXIT_GUARD_REASON_CODES.FORBIDDEN_BASENAME_CHANGE);
  }
}

function resolveStage05eEvidenceRef(input = {}) {
  const ref = isObject(input.stage05eEvidenceRef) ? input.stage05eEvidenceRef : {};
  const source = isObject(input.stage05eClassifierOutput) ? input.stage05eClassifierOutput : {};

  const evidenceHash = hasText(ref.evidenceHash)
    ? ref.evidenceHash
    : (hasText(input.stage05eEvidenceRefHash)
      ? input.stage05eEvidenceRefHash
      : (hasText(source.canonicalHash) ? source.canonicalHash : ''));
  const expectedEvidenceHash = hasText(ref.expectedEvidenceHash)
    ? ref.expectedEvidenceHash
    : (hasText(input.stage05eExpectedEvidenceHash) ? input.stage05eExpectedEvidenceHash : '');
  const stale = ref.stale === true
    || input.stage05eEvidenceRefStale === true
    || (
      hasText(expectedEvidenceHash)
      && hasText(evidenceHash)
      && expectedEvidenceHash !== evidenceHash
    );

  return {
    evidenceHash,
    expectedEvidenceHash,
    stale,
    evidencePresent: hasText(evidenceHash),
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

function hasStage06PermissionClaim(input, candidate, stage05eClassifierOutput = {}) {
  return [
    input.stage06PermissionClaimed,
    input.stage06AdmissionClaimed,
    input.stage06AdmissionGrantedClaimed,
    input.futureStage06PermissionClaimed,
    candidate.stage06PermissionClaimed,
    candidate.stage06AdmissionClaimed,
    candidate.stage06AdmissionGrantedClaimed,
    candidate.futureStage06PermissionClaimed,
    stage05eClassifierOutput.stage06PermissionGranted,
    stage05eClassifierOutput.stage06AdmissionGranted,
    stage05eClassifierOutput.futureStage06PermissionGranted,
    stage05eClassifierOutput.stage06BlockersPreview?.stage06AdmissionGranted,
  ].some(isClaimed);
}

function hasApplyTxnClaim(input, candidate, stage05eClassifierOutput = {}) {
  return [
    input.applyTxnClaimed,
    input.applyTxnPermissionClaimed,
    input.applyTxnCreatedClaimed,
    input.applyTxnPerformedClaimed,
    input.futureStage06ApplyTxnAllowedClaimed,
    candidate.applyTxnClaimed,
    candidate.applyTxnPermissionClaimed,
    candidate.applyTxnCreatedClaimed,
    candidate.applyTxnPerformedClaimed,
    candidate.futureStage06ApplyTxnAllowedClaimed,
    stage05eClassifierOutput.applyTxnPermissionGranted,
    stage05eClassifierOutput.applyTxnCreated,
    stage05eClassifierOutput.applyTxnPerformed,
    stage05eClassifierOutput.stage06BlockersPreview?.applyTxnPermissionGranted,
  ].some(isClaimed);
}

function hasPolicyAcceptanceClaim(input, candidate) {
  return [
    input.policyAcceptanceClaimed,
    input.projectTruthPolicyAcceptedClaimed,
    input.ownerApprovedBlockIdentityPolicyClaimed,
    candidate.policyAcceptanceClaimed,
    candidate.projectTruthPolicyAcceptedClaimed,
    candidate.ownerApprovedBlockIdentityPolicyClaimed,
  ].some(isClaimed);
}

function hasStage06ApiModelCreationClaim(input, candidate) {
  return [
    input.stage06ApiCreatedClaimed,
    input.stage06ModelCreatedClaimed,
    input.stage06SemanticsCreatedClaimed,
    candidate.stage06ApiCreatedClaimed,
    candidate.stage06ModelCreatedClaimed,
    candidate.stage06SemanticsCreatedClaimed,
  ].some(isClaimed);
}

function classifyCandidate(input, rawCandidate = {}, context = {}) {
  const candidate = isObject(rawCandidate) ? rawCandidate : {};
  const stage05eClassifierOutput = isObject(input.stage05eClassifierOutput) ? input.stage05eClassifierOutput : {};
  const candidateId = hasText(candidate.candidateId) ? candidate.candidateId : '';
  const structuralKind = upper(candidate.structuralChangeKind || candidate.changeKind || candidate.opKind, 'NONE');
  const blockInstanceProof = hasText(candidate.externalBlockInstanceProof)
    ? candidate.externalBlockInstanceProof
    : (hasText(candidate.optionalBlockInstanceIdProof) ? candidate.optionalBlockInstanceIdProof : '');
  const blockLineageProof = hasText(candidate.blockLineageProof)
    ? candidate.blockLineageProof
    : (hasText(candidate.optionalBlockLineageIdProof) ? candidate.optionalBlockLineageIdProof : '');
  const ownerDecisionEvidenceHash = resolveOwnerDecisionEvidenceHash(input, candidate);
  const ownerDecisionEvidenceStatus = hasText(ownerDecisionEvidenceHash)
    ? OWNER_DECISION_EVIDENCE_STATUS.PRESENT_WITH_HASH
    : OWNER_DECISION_EVIDENCE_STATUS.NOT_PRESENT;

  const reasonCodes = [];

  if (hasText(context.stage05eEvidenceRefHash)) {
    reasonCodes.push(STAGE06_FALSE_GREEN_EXIT_GUARD_REASON_CODES.STAGE05E_EVIDENCE_REF_ONLY_NOT_PERMISSION);
  }

  if (hasText(ownerDecisionEvidenceHash)) {
    reasonCodes.push(
      STAGE06_FALSE_GREEN_EXIT_GUARD_REASON_CODES.OWNER_DECISION_EVIDENCE_REF_ONLY_NOT_POLICY_ACCEPTANCE,
    );
  }

  if (hasText(blockInstanceProof)) {
    reasonCodes.push(STAGE06_FALSE_GREEN_EXIT_GUARD_REASON_CODES.BLOCK_INSTANCE_PROOF_ADVISORY_ONLY);
    reasonCodes.push(STAGE06_FALSE_GREEN_EXIT_GUARD_REASON_CODES.BLOCK_INSTANCE_POLICY_NOT_ACCEPTED);
    reasonCodes.push(STAGE06_FALSE_GREEN_EXIT_GUARD_REASON_CODES.STAGE05E_ADVISORY_ONLY_PROOFS_NOT_PERMISSION);
  }

  if (hasText(blockLineageProof)) {
    reasonCodes.push(STAGE06_FALSE_GREEN_EXIT_GUARD_REASON_CODES.BLOCK_LINEAGE_PROOF_ADVISORY_ONLY);
    reasonCodes.push(STAGE06_FALSE_GREEN_EXIT_GUARD_REASON_CODES.BLOCK_LINEAGE_POLICY_NOT_ACCEPTED);
    reasonCodes.push(STAGE06_FALSE_GREEN_EXIT_GUARD_REASON_CODES.STAGE05E_ADVISORY_ONLY_PROOFS_NOT_PERMISSION);
  }

  if (STRUCTURAL_KINDS.has(structuralKind)) {
    reasonCodes.push(STAGE06_FALSE_GREEN_EXIT_GUARD_REASON_CODES.STRUCTURAL_POLICY_MANUAL_ONLY);
  }

  if (hasStage06PermissionClaim(input, candidate, stage05eClassifierOutput)) {
    reasonCodes.push(STAGE06_FALSE_GREEN_EXIT_GUARD_REASON_CODES.FORBIDDEN_STAGE06_PERMISSION_CLAIM);
  }

  if (hasApplyTxnClaim(input, candidate, stage05eClassifierOutput)) {
    reasonCodes.push(STAGE06_FALSE_GREEN_EXIT_GUARD_REASON_CODES.FORBIDDEN_APPLYTXN_CLAIM);
  }

  if (hasPolicyAcceptanceClaim(input, candidate)) {
    reasonCodes.push(STAGE06_FALSE_GREEN_EXIT_GUARD_REASON_CODES.FORBIDDEN_POLICY_ACCEPTANCE_CLAIM);
  }

  if (hasStage06ApiModelCreationClaim(input, candidate)) {
    reasonCodes.push(STAGE06_FALSE_GREEN_EXIT_GUARD_REASON_CODES.FORBIDDEN_STAGE06_API_MODEL_CREATION_CLAIM);
  }

  const uniqueReasonCodes = uniqueSorted(reasonCodes);
  const blocked = uniqueReasonCodes.some((code) => BLOCKING_REASON_CODES.has(code));

  const falseGreenEvidenceHash = canonicalHash({
    candidateId,
    structuralKind,
    blockInstanceProof,
    blockLineageProof,
    ownerDecisionEvidenceStatus,
    ownerDecisionEvidenceHash,
    stage05eEvidenceRefHash: context.stage05eEvidenceRefHash,
    reasonCodes: uniqueReasonCodes,
  });

  return withCanonicalHash({
    classificationKind: 'Stage06FalseGreenExitClassification',
    contourId: CONTOUR_ID,
    candidateId,
    classification: blocked ? 'BLOCKED' : 'ADVISORY_ONLY',
    ownerDecisionEvidenceStatus,
    ownerDecisionEvidenceHash: hasText(ownerDecisionEvidenceHash) ? ownerDecisionEvidenceHash : '',
    ownerDecisionEvidenceIsPolicyAcceptance: false,
    stage05eEvidenceRefHash: hasText(context.stage05eEvidenceRefHash) ? context.stage05eEvidenceRefHash : '',
    stage05eEvidenceRefIsPermission: false,
    policyAcceptedAsProjectTruth: false,
    stage06PermissionGranted: false,
    applyTxnPermissionGranted: false,
    blockInstanceProofProjectTruthClaimed: false,
    blockLineageProofProjectTruthClaimed: false,
    reasonCodes: uniqueReasonCodes,
    falseGreenEvidenceHash,
  });
}

function createDecision(blockedReasons) {
  return withCanonicalHash({
    decisionKind: DECISION_KIND,
    contourId: CONTOUR_ID,
    outputDecision:
      blockedReasons.length > 0
        ? STAGE06_FALSE_GREEN_EXIT_GUARD_DECISIONS.STAGE06_FALSE_GREEN_EXIT_GUARD_BLOCKED
        : STAGE06_FALSE_GREEN_EXIT_GUARD_DECISIONS.STAGE06_FALSE_GREEN_EXIT_GUARD_COMPILED,
    blocked: blockedReasons.length > 0,
    blockedReasons,
  });
}

function anomalyCodeCounts(values) {
  const counts = {};
  for (const value of values) {
    counts[value] = (counts[value] || 0) + 1;
  }
  return counts;
}

function buildReviewBom({ blockedReasons, classifications }) {
  const blockerCodes = uniqueSorted([
    ...blockedReasons,
    ...classifications
      .flatMap((entry) => entry.reasonCodes)
      .filter((code) => BLOCKING_REASON_CODES.has(code)),
  ]);
  return withCanonicalHash({
    bomKind: 'Stage06FalseGreenExitGuardReviewBOM',
    contourId: CONTOUR_ID,
    classificationCount: classifications.length,
    blockedClassificationCount: classifications.filter((entry) => entry.classification === 'BLOCKED').length,
    advisoryClassificationCount: classifications.filter((entry) => entry.classification === 'ADVISORY_ONLY').length,
    falseGreenBlockerCount: blockerCodes.length,
    falseGreenBlockerCodes: blockerCodes,
    blockerCodeCounts: anomalyCodeCounts(blockerCodes),
  });
}

export function compileStage06FalseGreenExitGuard(input = {}) {
  const blockedReasons = [];
  const classifications = [];

  pushChangedBasenameReasons(input, blockedReasons);

  const stage05eRef = resolveStage05eEvidenceRef(input);
  if (!stage05eRef.evidencePresent) {
    blockedReasons.push(STAGE06_FALSE_GREEN_EXIT_GUARD_REASON_CODES.MISSING_STAGE05E_EVIDENCE_REF);
  }
  if (stage05eRef.stale) {
    blockedReasons.push(STAGE06_FALSE_GREEN_EXIT_GUARD_REASON_CODES.STALE_STAGE05_EVIDENCE_REF);
  }

  const ownerDecisionEvidenceHash = resolveOwnerDecisionEvidenceHash(input, {});
  if (!hasText(ownerDecisionEvidenceHash)) {
    blockedReasons.push(STAGE06_FALSE_GREEN_EXIT_GUARD_REASON_CODES.OWNER_DECISION_EVIDENCE_NOT_PRESENT);
  }

  const candidates = asArray(input.candidates);
  for (const rawCandidate of candidates) {
    const classification = classifyCandidate(input, rawCandidate, {
      stage05eEvidenceRefHash: stage05eRef.evidenceHash,
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
  const reviewBom = buildReviewBom({ blockedReasons: uniqueBlockedReasons, classifications });

  return withCanonicalHash({
    resultKind: RESULT_KIND,
    contourId: CONTOUR_ID,
    outputDecision: decision.outputDecision,
    blockedReasons: uniqueBlockedReasons,
    stage06PermissionGranted: false,
    applyTxnPermissionGranted: false,
    policyAcceptedAsProjectTruth: false,
    ownerDecisionOutcomeClaimed: false,
    ownerDecisionEvidenceStatus:
      hasText(ownerDecisionEvidenceHash)
        ? OWNER_DECISION_EVIDENCE_STATUS.PRESENT_WITH_HASH
        : OWNER_DECISION_EVIDENCE_STATUS.NOT_PRESENT,
    ownerDecisionEvidenceHash,
    ownerDecisionEvidenceIsPolicyAcceptance: false,
    stage05eEvidenceRefHash: stage05eRef.evidenceHash,
    stage05eEvidenceRefIsPermission: false,
    structuralPolicy: 'MANUAL_ONLY',
    structuralPolicyManualOnly: true,
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
    stage06ApiCreated: false,
    stage06ModelCreated: false,
    stage06SemanticsCreated: false,
    decisions: [decision],
    classifications,
    reviewBom,
  });
}

export const runStage06FalseGreenExitGuard = compileStage06FalseGreenExitGuard;

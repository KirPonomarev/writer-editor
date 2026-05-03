import { canonicalHash } from './reviewIrKernel.mjs';

const RESULT_KIND = 'STAGE_05K_IDENTITY_POLICY_BLOCKER_ROLLUP_RESULT_001';
const DECISION_KIND = 'STAGE_05K_IDENTITY_POLICY_BLOCKER_ROLLUP_DECISION_001';
const CONTOUR_ID = 'STAGE05K_IDENTITY_POLICY_BLOCKER_ROLLUP_001';

const ALLOWED_CHANGED_BASENAMES = new Set([
  'identityPolicyBlockerRollup.mjs',
  'identityPolicyBlockerRollup.contract.test.js',
  'STAGE05K_IDENTITY_POLICY_BLOCKER_ROLLUP_001.md',
]);

const BLOCKING_REASON_CODES = new Set([
  'MISSING_CHANGED_BASENAMES_EVIDENCE',
  'FORBIDDEN_BASENAME_CHANGE',
  'MISSING_STAGE05E_EVIDENCE_REF',
  'MISSING_STAGE05F_EXIT_GUARD_REF',
  'MISSING_STAGE05I_POLICY_REF',
  'MISSING_STAGE05J_POLICY_REF',
  'STALE_STAGE05_EVIDENCE_REF',
  'FORBIDDEN_READY_STATUS_CLAIM',
  'FORBIDDEN_STAGE05_EXIT_READY_CLAIM',
  'FORBIDDEN_STAGE06_PRE_ADMISSION_CLAIM',
  'FORBIDDEN_STAGE06_PERMISSION_CLAIM',
  'FORBIDDEN_APPLYTXN_CLAIM',
  'FORBIDDEN_STORAGE_MUTATION_CLAIM',
  'FORBIDDEN_POLICY_ACCEPTANCE_CLAIM',
  'FORBIDDEN_STABLE_ID_CREATION_CLAIM',
  'FORBIDDEN_LINEAGE_CREATION_CLAIM',
]);

export const IDENTITY_POLICY_BLOCKER_ROLLUP_REASON_CODES = Object.freeze({
  FORBIDDEN_BASENAME_CHANGE: 'FORBIDDEN_BASENAME_CHANGE',
  MISSING_CHANGED_BASENAMES_EVIDENCE: 'MISSING_CHANGED_BASENAMES_EVIDENCE',
  MISSING_STAGE05D_SOURCE_REF: 'MISSING_STAGE05D_SOURCE_REF',
  STALE_STAGE05D_SOURCE_REF_TRACE_ONLY_NOT_POLICY_PASS: 'STALE_STAGE05D_SOURCE_REF_TRACE_ONLY_NOT_POLICY_PASS',
  MISSING_STAGE05E_EVIDENCE_REF: 'MISSING_STAGE05E_EVIDENCE_REF',
  MISSING_STAGE05F_EXIT_GUARD_REF: 'MISSING_STAGE05F_EXIT_GUARD_REF',
  MISSING_STAGE05I_POLICY_REF: 'MISSING_STAGE05I_POLICY_REF',
  MISSING_STAGE05J_POLICY_REF: 'MISSING_STAGE05J_POLICY_REF',
  STALE_STAGE05_EVIDENCE_REF: 'STALE_STAGE05_EVIDENCE_REF',
  STAGE05D_SOURCE_REF_TRACE_ONLY_NOT_POLICY_PASS: 'STAGE05D_SOURCE_REF_TRACE_ONLY_NOT_POLICY_PASS',
  STAGE05E_REF_GUARD_ONLY_NOT_PERMISSION: 'STAGE05E_REF_GUARD_ONLY_NOT_PERMISSION',
  STAGE05F_REF_EXIT_GUARD_ONLY_NOT_PERMISSION: 'STAGE05F_REF_EXIT_GUARD_ONLY_NOT_PERMISSION',
  STAGE05I_REF_GUARD_ONLY_NOT_POLICY_ACCEPTANCE: 'STAGE05I_REF_GUARD_ONLY_NOT_POLICY_ACCEPTANCE',
  STAGE05J_REF_GUARD_ONLY_NOT_POLICY_ACCEPTANCE: 'STAGE05J_REF_GUARD_ONLY_NOT_POLICY_ACCEPTANCE',
  OWNER_POLICY_DECISION_REQUIRED: 'OWNER_POLICY_DECISION_REQUIRED',
  FORBIDDEN_READY_STATUS_CLAIM: 'FORBIDDEN_READY_STATUS_CLAIM',
  FORBIDDEN_STAGE05_EXIT_READY_CLAIM: 'FORBIDDEN_STAGE05_EXIT_READY_CLAIM',
  FORBIDDEN_STAGE06_PRE_ADMISSION_CLAIM: 'FORBIDDEN_STAGE06_PRE_ADMISSION_CLAIM',
  FORBIDDEN_STAGE06_PERMISSION_CLAIM: 'FORBIDDEN_STAGE06_PERMISSION_CLAIM',
  FORBIDDEN_APPLYTXN_CLAIM: 'FORBIDDEN_APPLYTXN_CLAIM',
  FORBIDDEN_STORAGE_MUTATION_CLAIM: 'FORBIDDEN_STORAGE_MUTATION_CLAIM',
  FORBIDDEN_POLICY_ACCEPTANCE_CLAIM: 'FORBIDDEN_POLICY_ACCEPTANCE_CLAIM',
  FORBIDDEN_STABLE_ID_CREATION_CLAIM: 'FORBIDDEN_STABLE_ID_CREATION_CLAIM',
  FORBIDDEN_LINEAGE_CREATION_CLAIM: 'FORBIDDEN_LINEAGE_CREATION_CLAIM',
});

export const IDENTITY_POLICY_BLOCKER_ROLLUP_STATUSES = Object.freeze({
  IDENTITY_POLICY_BLOCKED: 'IDENTITY_POLICY_BLOCKED',
  STOP_OWNER_POLICY_REQUIRED: 'STOP_OWNER_POLICY_REQUIRED',
});

export const IDENTITY_POLICY_BLOCKER_ROLLUP_DECISIONS = Object.freeze({
  IDENTITY_POLICY_BLOCKER_ROLLUP_COMPILED: 'IDENTITY_POLICY_BLOCKER_ROLLUP_COMPILED',
  IDENTITY_POLICY_BLOCKER_ROLLUP_BLOCKED: 'IDENTITY_POLICY_BLOCKER_ROLLUP_BLOCKED',
});

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasText(value) {
  return typeof value === 'string' && value.length > 0;
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
    reasons.push(IDENTITY_POLICY_BLOCKER_ROLLUP_REASON_CODES.MISSING_CHANGED_BASENAMES_EVIDENCE);
    return;
  }
  if (input.changedBasenames.some((basename) => !ALLOWED_CHANGED_BASENAMES.has(basename))) {
    reasons.push(IDENTITY_POLICY_BLOCKER_ROLLUP_REASON_CODES.FORBIDDEN_BASENAME_CHANGE);
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

function hasForbiddenReadyClaim(input = {}) {
  return [
    input.readyStatusClaimed,
    input.identityPolicyReadyClaimed,
    input.stage05ExitReadyClaimed,
    input.stage06PreAdmittedClaimed,
    input.stage06PreAdmissionClaimed,
    input.applyTxnAllowedClaimed,
  ].some(isClaimed);
}

function pushForbiddenClaimReasons(input, reasons) {
  if (isClaimed(input.readyStatusClaimed) || isClaimed(input.identityPolicyReadyClaimed)) {
    reasons.push(IDENTITY_POLICY_BLOCKER_ROLLUP_REASON_CODES.FORBIDDEN_READY_STATUS_CLAIM);
  }
  if (isClaimed(input.stage05ExitReadyClaimed)) {
    reasons.push(IDENTITY_POLICY_BLOCKER_ROLLUP_REASON_CODES.FORBIDDEN_STAGE05_EXIT_READY_CLAIM);
  }
  if (isClaimed(input.stage06PreAdmittedClaimed) || isClaimed(input.stage06PreAdmissionClaimed)) {
    reasons.push(IDENTITY_POLICY_BLOCKER_ROLLUP_REASON_CODES.FORBIDDEN_STAGE06_PRE_ADMISSION_CLAIM);
  }
  if (isClaimed(input.stage06PermissionClaimed) || isClaimed(input.stage06AdmissionClaimed)) {
    reasons.push(IDENTITY_POLICY_BLOCKER_ROLLUP_REASON_CODES.FORBIDDEN_STAGE06_PERMISSION_CLAIM);
  }
  if (
    isClaimed(input.applyTxnClaimed)
    || isClaimed(input.applyTxnPermissionClaimed)
    || isClaimed(input.applyTxnAllowedClaimed)
  ) {
    reasons.push(IDENTITY_POLICY_BLOCKER_ROLLUP_REASON_CODES.FORBIDDEN_APPLYTXN_CLAIM);
  }
  if (
    isClaimed(input.storageMutationClaimed)
    || isClaimed(input.storageMigrationClaimed)
    || isClaimed(input.projectWriteClaimed)
  ) {
    reasons.push(IDENTITY_POLICY_BLOCKER_ROLLUP_REASON_CODES.FORBIDDEN_STORAGE_MUTATION_CLAIM);
  }
  if (
    isClaimed(input.policyAcceptanceClaimed)
    || isClaimed(input.projectTruthPolicyAcceptedClaimed)
    || isClaimed(input.ownerPolicyAcceptedClaimed)
  ) {
    reasons.push(IDENTITY_POLICY_BLOCKER_ROLLUP_REASON_CODES.FORBIDDEN_POLICY_ACCEPTANCE_CLAIM);
  }
  if (
    isClaimed(input.stableIdCreationClaimed)
    || isClaimed(input.stableBlockInstanceIdCreatedClaimed)
    || isClaimed(input.persistStableBlockInstanceIdClaimed)
  ) {
    reasons.push(IDENTITY_POLICY_BLOCKER_ROLLUP_REASON_CODES.FORBIDDEN_STABLE_ID_CREATION_CLAIM);
  }
  if (
    isClaimed(input.blockLineageCreatedClaimed)
    || isClaimed(input.blockLineagePersistedClaimed)
    || isClaimed(input.createBlockLineageClaimed)
  ) {
    reasons.push(IDENTITY_POLICY_BLOCKER_ROLLUP_REASON_CODES.FORBIDDEN_LINEAGE_CREATION_CLAIM);
  }
}

function createDecision(blockedReasons) {
  return withCanonicalHash({
    decisionKind: DECISION_KIND,
    contourId: CONTOUR_ID,
    outputDecision: blockedReasons.length > 0
      ? IDENTITY_POLICY_BLOCKER_ROLLUP_DECISIONS.IDENTITY_POLICY_BLOCKER_ROLLUP_BLOCKED
      : IDENTITY_POLICY_BLOCKER_ROLLUP_DECISIONS.IDENTITY_POLICY_BLOCKER_ROLLUP_COMPILED,
    blocked: blockedReasons.length > 0,
    blockedReasons,
  });
}

function buildRollupItems(refs) {
  const items = [];
  if (refs.stage05dSourceRef.stale) {
    items.push({
      itemId: 'STAGE05D_SOURCE_REF',
      reasonCode: IDENTITY_POLICY_BLOCKER_ROLLUP_REASON_CODES.STALE_STAGE05D_SOURCE_REF_TRACE_ONLY_NOT_POLICY_PASS,
      blocking: false,
    });
  } else if (refs.stage05dSourceRef.evidencePresent) {
    items.push({
      itemId: 'STAGE05D_SOURCE_REF',
      reasonCode: IDENTITY_POLICY_BLOCKER_ROLLUP_REASON_CODES.STAGE05D_SOURCE_REF_TRACE_ONLY_NOT_POLICY_PASS,
      blocking: false,
    });
  } else {
    items.push({
      itemId: 'STAGE05D_SOURCE_REF',
      reasonCode: IDENTITY_POLICY_BLOCKER_ROLLUP_REASON_CODES.MISSING_STAGE05D_SOURCE_REF,
      blocking: false,
    });
  }
  if (refs.stage05eEvidenceRef.evidencePresent) {
    items.push({
      itemId: 'STAGE05E_EVIDENCE_REF',
      reasonCode: IDENTITY_POLICY_BLOCKER_ROLLUP_REASON_CODES.STAGE05E_REF_GUARD_ONLY_NOT_PERMISSION,
      blocking: false,
    });
  }
  if (refs.stage05fExitGuardRef.evidencePresent) {
    items.push({
      itemId: 'STAGE05F_EXIT_GUARD_REF',
      reasonCode: IDENTITY_POLICY_BLOCKER_ROLLUP_REASON_CODES.STAGE05F_REF_EXIT_GUARD_ONLY_NOT_PERMISSION,
      blocking: false,
    });
  }
  if (refs.stage05iPolicyRef.evidencePresent) {
    items.push({
      itemId: 'STAGE05I_POLICY_REF',
      reasonCode: IDENTITY_POLICY_BLOCKER_ROLLUP_REASON_CODES.STAGE05I_REF_GUARD_ONLY_NOT_POLICY_ACCEPTANCE,
      blocking: false,
    });
  }
  if (refs.stage05jPolicyRef.evidencePresent) {
    items.push({
      itemId: 'STAGE05J_POLICY_REF',
      reasonCode: IDENTITY_POLICY_BLOCKER_ROLLUP_REASON_CODES.STAGE05J_REF_GUARD_ONLY_NOT_POLICY_ACCEPTANCE,
      blocking: false,
    });
  }
  items.push({
    itemId: 'OWNER_POLICY_DECISION',
    reasonCode: IDENTITY_POLICY_BLOCKER_ROLLUP_REASON_CODES.OWNER_POLICY_DECISION_REQUIRED,
    blocking: false,
  });
  return items.map((item) => withCanonicalHash({ itemKind: 'IdentityPolicyBlockerRollupItem', contourId: CONTOUR_ID, ...item }));
}

function buildReviewBom({ rollupItems, blockedReasons }) {
  return withCanonicalHash({
    bomKind: 'IdentityPolicyBlockerRollupReviewBOM',
    contourId: CONTOUR_ID,
    rollupItemCount: rollupItems.length,
    blockedReasonCount: blockedReasons.length,
    blockerCodes: blockedReasons,
    ownerPolicyDecisionRequired: true,
    acceptedProjectTruthCount: 0,
    readyStatusCount: 0,
    stage06AdmissionCount: 0,
    applyTxnPermissionCount: 0,
    rollupItemReasonCodes: uniqueSorted(rollupItems.map((item) => item.reasonCode)),
    rollupItemHashes: rollupItems.map((item) => item.canonicalHash).sort(),
  });
}

function createStage06BlockersPreview({ blockedReasons, rollupItems }) {
  return withCanonicalHash({
    packetKind: 'Stage06BlockersPreview',
    contourId: CONTOUR_ID,
    previewOnly: true,
    preAdmission: false,
    stage06AdmissionGranted: false,
    applyTxnPermissionGranted: false,
    readyStatusAllowed: false,
    blockerCodes: uniqueSorted([
      ...blockedReasons,
      IDENTITY_POLICY_BLOCKER_ROLLUP_REASON_CODES.OWNER_POLICY_DECISION_REQUIRED,
      ...rollupItems.map((item) => item.reasonCode),
    ]),
  });
}

export function compileIdentityPolicyBlockerRollup(input = {}) {
  const blockedReasons = [];
  pushChangedBasenameReasons(input, blockedReasons);
  pushForbiddenClaimReasons(input, blockedReasons);

  const refs = {
    stage05dSourceRef: resolveEvidenceRef(input, 'stage05dSourceRef', 'stage05dSourceRefHash', 'stage05dSourceOutput'),
    stage05eEvidenceRef: resolveEvidenceRef(input, 'stage05eEvidenceRef', 'stage05eEvidenceRefHash', 'stage05eClassifierOutput'),
    stage05fExitGuardRef: resolveEvidenceRef(input, 'stage05fExitGuardRef', 'stage05fExitGuardRefHash', 'stage05fExitGuardOutput'),
    stage05iPolicyRef: resolveEvidenceRef(input, 'stage05iPolicyRef', 'stage05iPolicyRefHash', 'stage05iPolicyOutput'),
    stage05jPolicyRef: resolveEvidenceRef(input, 'stage05jPolicyRef', 'stage05jPolicyRefHash', 'stage05jPolicyOutput'),
  };

  if (!refs.stage05eEvidenceRef.evidencePresent) {
    blockedReasons.push(IDENTITY_POLICY_BLOCKER_ROLLUP_REASON_CODES.MISSING_STAGE05E_EVIDENCE_REF);
  }
  if (!refs.stage05fExitGuardRef.evidencePresent) {
    blockedReasons.push(IDENTITY_POLICY_BLOCKER_ROLLUP_REASON_CODES.MISSING_STAGE05F_EXIT_GUARD_REF);
  }
  if (!refs.stage05iPolicyRef.evidencePresent) {
    blockedReasons.push(IDENTITY_POLICY_BLOCKER_ROLLUP_REASON_CODES.MISSING_STAGE05I_POLICY_REF);
  }
  if (!refs.stage05jPolicyRef.evidencePresent) {
    blockedReasons.push(IDENTITY_POLICY_BLOCKER_ROLLUP_REASON_CODES.MISSING_STAGE05J_POLICY_REF);
  }
  if (
    refs.stage05eEvidenceRef.stale
    || refs.stage05fExitGuardRef.stale
    || refs.stage05iPolicyRef.stale
    || refs.stage05jPolicyRef.stale
  ) {
    blockedReasons.push(IDENTITY_POLICY_BLOCKER_ROLLUP_REASON_CODES.STALE_STAGE05_EVIDENCE_REF);
  }

  const uniqueBlockedReasons = uniqueSorted(blockedReasons);
  const rollupItems = buildRollupItems(refs);
  const decision = createDecision(uniqueBlockedReasons);
  const reviewBom = buildReviewBom({ rollupItems, blockedReasons: uniqueBlockedReasons });
  const stage06BlockersPreview = createStage06BlockersPreview({ blockedReasons: uniqueBlockedReasons, rollupItems });
  const identityPolicyState = uniqueBlockedReasons.length > 0
    ? IDENTITY_POLICY_BLOCKER_ROLLUP_STATUSES.IDENTITY_POLICY_BLOCKED
    : IDENTITY_POLICY_BLOCKER_ROLLUP_STATUSES.STOP_OWNER_POLICY_REQUIRED;

  return withCanonicalHash({
    resultKind: RESULT_KIND,
    contourId: CONTOUR_ID,
    outputDecision: decision.outputDecision,
    identityPolicyState,
    allowedOutputStatuses: Object.values(IDENTITY_POLICY_BLOCKER_ROLLUP_STATUSES),
    readyStatusAllowed: false,
    readyStatusClaimed: hasForbiddenReadyClaim(input),
    blockedReasons: uniqueBlockedReasons,
    ...refs,
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
    stableIdCreated: false,
    stableBlockInstanceIdCreated: false,
    blockLineageCreated: false,
    blockLineagePersisted: false,
    policyAcceptedAsProjectTruth: false,
    projectTruthPolicyAccepted: false,
    stage05ExitReady: false,
    stage06PreAdmitted: false,
    stage06AdmissionGranted: false,
    applyTxnPermissionGranted: false,
    ownerPolicyDecisionRequired: true,
    ownerDecisionOutcomeClaimed: false,
    decisions: [decision],
    rollupItems,
    reviewBom,
    stage06BlockersPreview,
  });
}

export const runIdentityPolicyBlockerRollup = compileIdentityPolicyBlockerRollup;

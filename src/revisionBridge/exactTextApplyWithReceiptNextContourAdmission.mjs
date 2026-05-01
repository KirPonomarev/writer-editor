import { canonicalHash } from './reviewIrKernel.mjs';

const RESULT_KIND = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_CONTOUR_ADMISSION_RESULT_001Z';
const DECISION_KIND = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_CONTOUR_ADMISSION_DECISION_001Z';
const SOURCE_001Y_RESULT_KIND = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_ADMISSION_RESULT_001Y';
const SOURCE_001Y_DECISION_KIND = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_ADMISSION_DECISION_001Y';
const SOURCE_001X_RESULT_KIND = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_CLOSEOUT_RESULT_001X';
const SOURCE_001X_DECISION_KIND = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_CLOSEOUT_DECISION_001X';
const SOURCE_001W_RESULT_KIND = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_RESULT_001W';
const SOURCE_001W_DECISION_KIND = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_DECISION_001W';
const SOURCE_001W_RECEIPT_KIND = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_V1_001W';
const SOURCE_001V_RESULT_KIND = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_RESULT_001V';
const SOURCE_001V_DECISION_KIND = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_DECISION_001V';
const SOURCE_001U_RESULT_KIND = 'PRIVATE_PRODUCT_APPLY_RECEIPT_IMPLEMENTATION_RESULT_001U';
const SOURCE_001U_DECISION_KIND = 'PRIVATE_PRODUCT_APPLY_RECEIPT_IMPLEMENTATION_DECISION_001U';
const SOURCE_001U_RECEIPT_KIND = 'PRIVATE_PRODUCT_APPLY_RECEIPT_V1_001U';
const OWNER_PACKET_KIND = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_CONTOUR_ADMISSION_OWNER_PACKET_001Z';
const TARGET_CONTOUR = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_BRIEF_002A';
const BINDING_HEAD_SHA = '02b4682271dc2272802a76144510b11e24154020';

export const EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_CONTOUR_ADMISSION_REASON_CODES = Object.freeze({
  SOURCE_001Y_RESULT_REQUIRED: 'SOURCE_001Y_RESULT_REQUIRED',
  SOURCE_001Y_RESULT_MISMATCH: 'SOURCE_001Y_RESULT_MISMATCH',
  SOURCE_001Y_DECISION_MISMATCH: 'SOURCE_001Y_DECISION_MISMATCH',
  SOURCE_001Y_BLOCKED: 'SOURCE_001Y_BLOCKED',
  SOURCE_001Y_DECISION_MALFORMED: 'SOURCE_001Y_DECISION_MALFORMED',
  SOURCE_001Y_BOUNDARY_MISSING: 'SOURCE_001Y_BOUNDARY_MISSING',
  SOURCE_001Y_RUNTIME_FLAG_FORBIDDEN: 'SOURCE_001Y_RUNTIME_FLAG_FORBIDDEN',
  SOURCE_CHAIN_MISSING: 'SOURCE_CHAIN_MISSING',
  SOURCE_001X_RESULT_REQUIRED: 'SOURCE_001X_RESULT_REQUIRED',
  SOURCE_001X_RESULT_MISMATCH: 'SOURCE_001X_RESULT_MISMATCH',
  SOURCE_001X_DECISION_MISMATCH: 'SOURCE_001X_DECISION_MISMATCH',
  SOURCE_001X_BLOCKED: 'SOURCE_001X_BLOCKED',
  SOURCE_001X_DECISION_MALFORMED: 'SOURCE_001X_DECISION_MALFORMED',
  SOURCE_001X_BOUNDARY_MISSING: 'SOURCE_001X_BOUNDARY_MISSING',
  SOURCE_001X_RUNTIME_FLAG_FORBIDDEN: 'SOURCE_001X_RUNTIME_FLAG_FORBIDDEN',
  SOURCE_001W_RESULT_REQUIRED: 'SOURCE_001W_RESULT_REQUIRED',
  SOURCE_001W_RESULT_MISMATCH: 'SOURCE_001W_RESULT_MISMATCH',
  SOURCE_001W_DECISION_MISMATCH: 'SOURCE_001W_DECISION_MISMATCH',
  SOURCE_001W_RECEIPT_MISMATCH: 'SOURCE_001W_RECEIPT_MISMATCH',
  SOURCE_001W_BLOCKED: 'SOURCE_001W_BLOCKED',
  SOURCE_001W_DECISION_MALFORMED: 'SOURCE_001W_DECISION_MALFORMED',
  SOURCE_001W_RECEIPT_MALFORMED: 'SOURCE_001W_RECEIPT_MALFORMED',
  SOURCE_001W_RUNTIME_FLAG_FORBIDDEN: 'SOURCE_001W_RUNTIME_FLAG_FORBIDDEN',
  SOURCE_001V_RESULT_REQUIRED: 'SOURCE_001V_RESULT_REQUIRED',
  SOURCE_001V_RESULT_MISMATCH: 'SOURCE_001V_RESULT_MISMATCH',
  SOURCE_001V_DECISION_MISMATCH: 'SOURCE_001V_DECISION_MISMATCH',
  SOURCE_001V_BLOCKED: 'SOURCE_001V_BLOCKED',
  SOURCE_001V_DECISION_MALFORMED: 'SOURCE_001V_DECISION_MALFORMED',
  SOURCE_001V_RUNTIME_FLAG_FORBIDDEN: 'SOURCE_001V_RUNTIME_FLAG_FORBIDDEN',
  SOURCE_001U_RESULT_REQUIRED: 'SOURCE_001U_RESULT_REQUIRED',
  SOURCE_001U_RESULT_MISMATCH: 'SOURCE_001U_RESULT_MISMATCH',
  SOURCE_001U_DECISION_MISMATCH: 'SOURCE_001U_DECISION_MISMATCH',
  SOURCE_001U_RECEIPT_MISMATCH: 'SOURCE_001U_RECEIPT_MISMATCH',
  SOURCE_001U_BLOCKED: 'SOURCE_001U_BLOCKED',
  SOURCE_001U_DECISION_MALFORMED: 'SOURCE_001U_DECISION_MALFORMED',
  SOURCE_001U_RECEIPT_MALFORMED: 'SOURCE_001U_RECEIPT_MALFORMED',
  SOURCE_001U_RUNTIME_FLAG_FORBIDDEN: 'SOURCE_001U_RUNTIME_FLAG_FORBIDDEN',
  OWNER_PACKET_REQUIRED: 'OWNER_PACKET_REQUIRED',
  OWNER_PACKET_INVALID: 'OWNER_PACKET_INVALID',
  OWNER_PACKET_BINDING_MISMATCH: 'OWNER_PACKET_BINDING_MISMATCH',
  OWNER_PACKET_TARGET_MISMATCH: 'OWNER_PACKET_TARGET_MISMATCH',
  OWNER_NEXT_CONTOUR_POLICY_MISSING: 'OWNER_NEXT_CONTOUR_POLICY_MISSING',
  PRODUCT_RUNTIME_FORBIDDEN: 'PRODUCT_RUNTIME_FORBIDDEN',
  PUBLIC_ADAPTER_IMPLEMENTATION_FORBIDDEN: 'PUBLIC_ADAPTER_IMPLEMENTATION_FORBIDDEN',
  RUNTIME_WIRING_FORBIDDEN: 'RUNTIME_WIRING_FORBIDDEN',
  APPLY_EXECUTION_FORBIDDEN: 'APPLY_EXECUTION_FORBIDDEN',
  PUBLIC_COMMAND_SURFACE_FORBIDDEN: 'PUBLIC_COMMAND_SURFACE_FORBIDDEN',
  UI_DOCX_NETWORK_DEPENDENCY_FORBIDDEN: 'UI_DOCX_NETWORK_DEPENDENCY_FORBIDDEN',
  APPLYTXN_RECOVERY_RELEASE_FORBIDDEN: 'APPLYTXN_RECOVERY_RELEASE_FORBIDDEN',
  USER_PROJECT_MUTATION_FORBIDDEN: 'USER_PROJECT_MUTATION_FORBIDDEN',
});

const FALSE_FLAGS = Object.freeze({
  productApplyRuntimeAdmitted: false,
  publicRuntimeAdmitted: false,
  publicAdapterImplementationAdmitted: false,
  runtimeWiringAdmitted: false,
  applyExecutionImplemented: false,
  publicSurfaceClaimed: false,
  ipcSurfaceClaimed: false,
  preloadExportClaimed: false,
  menuSurfaceClaimed: false,
  commandSurfaceClaimed: false,
  uiChanged: false,
  docxImportClaimed: false,
  applyTxnImplemented: false,
  recoveryClaimed: false,
  startupRecoveryClaimed: false,
  releaseClaimed: false,
  multiSceneApplyClaimed: false,
  structuralApplyClaimed: false,
  commentApplyClaimed: false,
  networkUsed: false,
  dependencyChanged: false,
  userProjectMutated: false,
  realUserProjectPathTouched: false,
});

const SOURCE_FALSE_FLAGS = Object.freeze({
  productApplyRuntimeAdmitted: false,
  publicRuntimeAdmitted: false,
  publicSurfaceClaimed: false,
  ipcSurfaceClaimed: false,
  preloadExportClaimed: false,
  menuSurfaceClaimed: false,
  commandSurfaceClaimed: false,
  uiChanged: false,
  docxImportClaimed: false,
  applyTxnImplemented: false,
  recoveryClaimed: false,
  startupRecoveryClaimed: false,
  releaseClaimed: false,
  multiSceneApplyClaimed: false,
  structuralApplyClaimed: false,
  commentApplyClaimed: false,
  networkUsed: false,
  dependencyChanged: false,
  userProjectMutated: false,
  realUserProjectPathTouched: false,
});

const REQUIRED_001Y_TRUE_FLAGS = [
  'admissionOnly',
  'ownerPacketAuthorizesOnlyNextContourOpening',
  'privateInternalOnly',
  'exactTextOnly',
  'singleSceneOnly',
  'source001XAccepted',
];

const REQUIRED_001X_TRUE_FLAGS = [
  'closeoutOnly',
  'noAdmissionIn001X',
  'noExecutionIn001X',
  'privatePortExecutionOnly',
  'privateInternalOnly',
  'exactTextOnly',
  'singleSceneOnly',
  'receiptIsNotRecovery',
  'receiptReadbackIsNotStartupRecovery',
  'atomicSingleFileWriteIsNotApplyTxn',
  'multiFileConsistencyNotClaimed',
  'backupSubsystemNotReproven',
  'source001WAccepted',
  'source001WReceiptVerified',
];

const OWNER_REQUIRED_TRUE_FIELDS = [
  'ownerApprovedOpenNextContour',
  'ownerUnderstandsAdmissionOnly',
  'ownerUnderstandsContractBriefOnly',
  'ownerUnderstandsNoPublicAdapterImplementation',
  'ownerUnderstandsNoRuntimeWiring',
  'ownerUnderstandsNoApplyExecution',
  'ownerUnderstandsNoReleaseClaim',
  'ownerPacketAuthorizesOnlyNextContourOpening',
];

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasText(value) {
  return typeof value === 'string' && value.length > 0;
}

function withoutHash(value, hashKey = 'canonicalHash') {
  if (!isObject(value)) {
    return value;
  }
  const { [hashKey]: _hash, ...rest } = value;
  return rest;
}

function withCanonicalHash(core) {
  return {
    ...core,
    canonicalHash: canonicalHash(core),
  };
}

function receiptHash(receipt) {
  return canonicalHash(withoutHash(receipt, 'receiptCanonicalHash'));
}

function uniqueReasons(reasons) {
  return Array.from(new Set(reasons.filter(Boolean))).sort();
}

function resultCore(input) {
  return {
    resultKind: RESULT_KIND,
    contourId: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_CONTOUR_ADMISSION_001Z',
    admissionOnly: true,
    contractBriefOnly: true,
    ownerPacketAuthorizesOnlyNextContourOpening: true,
    privateInternalOnly: true,
    exactTextOnly: true,
    singleSceneOnly: true,
    ...FALSE_FLAGS,
    ...input,
  };
}

function blockedResult(blockedReasons, observations = {}) {
  return withCanonicalHash(resultCore({
    outputDecision: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_CONTOUR_ADMISSION_001Z_BLOCKED',
    nextContourRecommendation: null,
    ownerMayOpen002A: false,
    source001YAccepted: false,
    blockedReasons: uniqueReasons(blockedReasons),
    decisions: [],
    ...observations,
  }));
}

function acceptedResult(input) {
  const source001Y = input.source001YResult;
  const decisionCore = {
    decisionKind: DECISION_KIND,
    outputDecision: 'OWNER_MAY_OPEN_PRIVATE_CONTRACT_BRIEF_002A_NO_PUBLIC_RUNTIME_ADMITTED',
    nextContourRecommendation: TARGET_CONTOUR,
    ownerMayOpen002A: true,
    admissionOnly: true,
    contractBriefOnly: true,
    ownerPacketAuthorizesOnlyNextContourOpening: true,
    publicRuntimeAdmitted: false,
    productApplyRuntimeAdmitted: false,
    publicAdapterImplementationAdmitted: false,
    runtimeWiringAdmitted: false,
    applyExecutionImplemented: false,
    applyTxnImplemented: false,
    recoveryClaimed: false,
    userProjectMutated: false,
  };
  const decision = withCanonicalHash(decisionCore);
  return withCanonicalHash(resultCore({
    outputDecision: decision.outputDecision,
    nextContourRecommendation: decision.nextContourRecommendation,
    ownerMayOpen002A: true,
    source001YAccepted: true,
    source001YResultHash: input.source001YResultHash,
    source001YDecisionHash: input.source001YDecisionHash,
    source001XResultHash: source001Y.source001XResultHash,
    source001XDecisionHash: source001Y.source001XDecisionHash,
    source001WResultHash: source001Y.source001WResultHash,
    source001WDecisionHash: source001Y.source001WDecisionHash,
    source001WReceiptHash: source001Y.source001WReceiptHash,
    source001VResultHash: source001Y.source001VResultHash,
    source001VDecisionHash: source001Y.source001VDecisionHash,
    source001UResultHash: source001Y.source001UResultHash,
    source001UDecisionHash: source001Y.source001UDecisionHash,
    source001UReceiptHash: source001Y.source001UReceiptHash,
    blockedReasons: [],
    decisions: [decision],
  }));
}

function validateForbiddenClaims(value, reasons) {
  if (value.productApplyRuntimeAdmitted === true || value.publicRuntimeAdmitted === true) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_CONTOUR_ADMISSION_REASON_CODES.PRODUCT_RUNTIME_FORBIDDEN);
  }
  if (value.publicAdapterImplementationAdmitted === true) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_CONTOUR_ADMISSION_REASON_CODES.PUBLIC_ADAPTER_IMPLEMENTATION_FORBIDDEN);
  }
  if (value.runtimeWiringAdmitted === true) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_CONTOUR_ADMISSION_REASON_CODES.RUNTIME_WIRING_FORBIDDEN);
  }
  if (value.applyExecutionRequested === true || value.applyExecutionImplemented === true || value.privateExactTextApplyWithReceiptExecuted === true) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_CONTOUR_ADMISSION_REASON_CODES.APPLY_EXECUTION_FORBIDDEN);
  }
  if (
    value.publicSurfaceClaimed === true
    || value.ipcSurfaceClaimed === true
    || value.preloadExportClaimed === true
    || value.menuSurfaceClaimed === true
    || value.commandSurfaceClaimed === true
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_CONTOUR_ADMISSION_REASON_CODES.PUBLIC_COMMAND_SURFACE_FORBIDDEN);
  }
  if (value.uiChanged === true || value.docxImportClaimed === true || value.networkUsed === true || value.dependencyChanged === true) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_CONTOUR_ADMISSION_REASON_CODES.UI_DOCX_NETWORK_DEPENDENCY_FORBIDDEN);
  }
  if (
    value.applyTxnImplemented === true
    || value.recoveryClaimed === true
    || value.startupRecoveryClaimed === true
    || value.releaseClaimed === true
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_CONTOUR_ADMISSION_REASON_CODES.APPLYTXN_RECOVERY_RELEASE_FORBIDDEN);
  }
  if (value.userProjectMutated === true || value.realUserProjectPathTouched === true) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_CONTOUR_ADMISSION_REASON_CODES.USER_PROJECT_MUTATION_FORBIDDEN);
  }
}

function validate001YDecision(source001Y, input, reasons) {
  const decisions = Array.isArray(source001Y.decisions) ? source001Y.decisions : [];
  const decision = decisions[0] || null;
  if (decisions.length !== 1 || !isObject(decision)) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_CONTOUR_ADMISSION_REASON_CODES.SOURCE_001Y_DECISION_MALFORMED);
    return;
  }
  if (
    decision.decisionKind !== SOURCE_001Y_DECISION_KIND
    || decision.outputDecision !== source001Y.outputDecision
    || decision.nextContourRecommendation !== source001Y.nextContourRecommendation
    || decision.ownerMayOpen001Z !== true
    || decision.admissionOnly !== true
    || decision.publicRuntimeAdmitted !== false
    || decision.productApplyRuntimeAdmitted !== false
    || decision.publicAdapterImplementationAdmitted !== false
    || decision.runtimeWiringAdmitted !== false
    || decision.applyExecutionImplemented !== false
    || decision.applyTxnImplemented !== false
    || decision.recoveryClaimed !== false
    || decision.userProjectMutated !== false
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_CONTOUR_ADMISSION_REASON_CODES.SOURCE_001Y_DECISION_MALFORMED);
  }
  if (
    !hasText(decision.canonicalHash)
    || decision.canonicalHash !== canonicalHash(withoutHash(decision))
    || decision.canonicalHash !== input.source001YDecisionHash
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_CONTOUR_ADMISSION_REASON_CODES.SOURCE_001Y_DECISION_MISMATCH);
  }
}

function validateSource001Y(input, reasons) {
  const source001Y = input.source001YResult;
  if (!isObject(source001Y)) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_CONTOUR_ADMISSION_REASON_CODES.SOURCE_001Y_RESULT_REQUIRED);
    return;
  }
  if (
    source001Y.resultKind !== SOURCE_001Y_RESULT_KIND
    || source001Y.outputDecision !== 'OWNER_MAY_OPEN_NEXT_PRIVATE_ADAPTER_ADMISSION_CONTOUR_001Z_NO_PUBLIC_RUNTIME_ADMITTED'
    || source001Y.nextContourRecommendation !== 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_ADAPTER_ADMISSION_001Z'
    || source001Y.ownerMayOpen001Z !== true
    || source001Y.blockedReasons?.length
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_CONTOUR_ADMISSION_REASON_CODES.SOURCE_001Y_BLOCKED);
  }
  if (REQUIRED_001Y_TRUE_FLAGS.some((field) => source001Y[field] !== true)) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_CONTOUR_ADMISSION_REASON_CODES.SOURCE_001Y_BOUNDARY_MISSING);
  }
  if (Object.entries(FALSE_FLAGS).some(([field, expected]) => source001Y[field] !== expected)) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_CONTOUR_ADMISSION_REASON_CODES.SOURCE_001Y_RUNTIME_FLAG_FORBIDDEN);
  }
  if (
    !hasText(source001Y.canonicalHash)
    || source001Y.canonicalHash !== canonicalHash(withoutHash(source001Y))
    || source001Y.canonicalHash !== input.source001YResultHash
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_CONTOUR_ADMISSION_REASON_CODES.SOURCE_001Y_RESULT_MISMATCH);
  }
  validate001YDecision(source001Y, input, reasons);
  if (
    !hasText(source001Y.source001XResultHash)
    || !hasText(source001Y.source001XDecisionHash)
    || !hasText(source001Y.source001WResultHash)
    || !hasText(source001Y.source001WDecisionHash)
    || !hasText(source001Y.source001WReceiptHash)
    || !hasText(source001Y.source001VResultHash)
    || !hasText(source001Y.source001VDecisionHash)
    || !hasText(source001Y.source001UResultHash)
    || !hasText(source001Y.source001UDecisionHash)
    || !hasText(source001Y.source001UReceiptHash)
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_CONTOUR_ADMISSION_REASON_CODES.SOURCE_CHAIN_MISSING);
  }
}

function validate001XDecision(source001X, source001Y, reasons) {
  const decisions = Array.isArray(source001X.decisions) ? source001X.decisions : [];
  const decision = decisions[0] || null;
  if (decisions.length !== 1 || !isObject(decision)) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_CONTOUR_ADMISSION_REASON_CODES.SOURCE_001X_DECISION_MALFORMED);
    return;
  }
  if (
    decision.decisionKind !== SOURCE_001X_DECISION_KIND
    || decision.outputDecision !== source001X.outputDecision
    || decision.nextContourRecommendation !== source001X.nextContourRecommendation
    || decision.ownerMayOpen001Y !== false
    || decision.closeoutOnly !== true
    || decision.noAdmissionIn001X !== true
    || decision.noExecutionIn001X !== true
    || decision.productApplyRuntimeAdmitted !== false
    || decision.publicRuntimeAdmitted !== false
    || decision.applyTxnImplemented !== false
    || decision.recoveryClaimed !== false
    || decision.userProjectMutated !== false
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_CONTOUR_ADMISSION_REASON_CODES.SOURCE_001X_DECISION_MALFORMED);
  }
  if (
    !hasText(decision.canonicalHash)
    || decision.canonicalHash !== canonicalHash(withoutHash(decision))
    || decision.canonicalHash !== source001Y?.source001XDecisionHash
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_CONTOUR_ADMISSION_REASON_CODES.SOURCE_001X_DECISION_MISMATCH);
  }
}

function validateSource001X(input, reasons) {
  const source001Y = input.source001YResult;
  const source001X = input.source001XResult;
  if (!isObject(source001X)) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_CONTOUR_ADMISSION_REASON_CODES.SOURCE_001X_RESULT_REQUIRED);
    return;
  }
  if (
    source001X.resultKind !== SOURCE_001X_RESULT_KIND
    || source001X.outputDecision !== 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_001W_CLOSEOUT_ACCEPTED'
    || source001X.nextContourRecommendation !== 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_001Y'
    || source001X.ownerMayOpen001Y !== false
    || source001X.blockedReasons?.length
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_CONTOUR_ADMISSION_REASON_CODES.SOURCE_001X_BLOCKED);
  }
  if (REQUIRED_001X_TRUE_FLAGS.some((field) => source001X[field] !== true)) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_CONTOUR_ADMISSION_REASON_CODES.SOURCE_001X_BOUNDARY_MISSING);
  }
  if (Object.entries(SOURCE_FALSE_FLAGS).some(([field, expected]) => source001X[field] !== expected)) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_CONTOUR_ADMISSION_REASON_CODES.SOURCE_001X_RUNTIME_FLAG_FORBIDDEN);
  }
  if (
    !hasText(source001X.canonicalHash)
    || source001X.canonicalHash !== canonicalHash(withoutHash(source001X))
    || source001X.canonicalHash !== source001Y?.source001XResultHash
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_CONTOUR_ADMISSION_REASON_CODES.SOURCE_001X_RESULT_MISMATCH);
  }
  validate001XDecision(source001X, source001Y, reasons);
}

function validateSource001U(input, reasons) {
  const source001Y = input.source001YResult;
  const source001U = input.source001UResult;
  if (!isObject(source001U)) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_CONTOUR_ADMISSION_REASON_CODES.SOURCE_001U_RESULT_REQUIRED);
    return;
  }
  const decisions = Array.isArray(source001U.decisions) ? source001U.decisions : [];
  const decision = decisions[0] || null;
  const receipt = source001U.receipt;
  if (
    source001U.resultKind !== SOURCE_001U_RESULT_KIND
    || source001U.outputDecision !== 'PRIVATE_PRODUCT_APPLYRECEIPT_IMPLEMENTED_FOR_EXACT_TEXT_SCOPE_NO_PUBLIC_RUNTIME'
    || source001U.nextContourAfterPass !== 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_001V'
    || source001U.privateProductApplyReceiptImplemented !== true
    || source001U.privateInternalOnly !== true
    || source001U.exactTextOnly !== true
    || source001U.singleSceneOnly !== true
    || source001U.receiptReadbackVerified !== true
    || source001U.receiptHashBound !== true
    || source001U.receiptWriteIsNotApplyTxn !== true
    || source001U.receiptReadbackIsNotRecovery !== true
    || source001U.blockedReasons?.length
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_CONTOUR_ADMISSION_REASON_CODES.SOURCE_001U_BLOCKED);
  }
  if (decisions.length !== 1 || !isObject(decision)) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_CONTOUR_ADMISSION_REASON_CODES.SOURCE_001U_DECISION_MALFORMED);
  } else {
    if (
      decision.decisionKind !== SOURCE_001U_DECISION_KIND
      || decision.outputDecision !== source001U.outputDecision
      || decision.nextContourAfterPass !== source001U.nextContourAfterPass
      || decision.productApplyRuntimeAdmitted !== false
      || decision.publicRuntimeAdmitted !== false
      || decision.applyTxnImplemented !== false
      || decision.recoveryClaimed !== false
      || decision.userProjectMutated !== false
    ) {
      reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_CONTOUR_ADMISSION_REASON_CODES.SOURCE_001U_DECISION_MALFORMED);
    }
    if (
      !hasText(decision.canonicalHash)
      || decision.canonicalHash !== canonicalHash(withoutHash(decision))
      || decision.canonicalHash !== source001Y?.source001UDecisionHash
    ) {
      reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_CONTOUR_ADMISSION_REASON_CODES.SOURCE_001U_DECISION_MISMATCH);
    }
  }
  if (!isObject(receipt)) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_CONTOUR_ADMISSION_REASON_CODES.SOURCE_001U_RECEIPT_MALFORMED);
  } else {
    if (
      receipt.receiptKind !== SOURCE_001U_RECEIPT_KIND
      || receipt.contourId !== 'PRIVATE_PRODUCT_APPLY_RECEIPT_IMPLEMENTATION_001U'
      || receipt.receiptWriteIsNotApplyTxn !== true
      || receipt.receiptReadbackIsNotRecovery !== true
      || receipt.backupAndAtomicHashesBoundNotReproven !== true
    ) {
      reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_CONTOUR_ADMISSION_REASON_CODES.SOURCE_001U_RECEIPT_MALFORMED);
    }
    if (
      !hasText(receipt.receiptCanonicalHash)
      || receipt.receiptCanonicalHash !== receiptHash(receipt)
      || receipt.receiptCanonicalHash !== source001Y?.source001UReceiptHash
    ) {
      reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_CONTOUR_ADMISSION_REASON_CODES.SOURCE_001U_RECEIPT_MISMATCH);
    }
  }
  if (
    !hasText(source001U.canonicalHash)
    || source001U.canonicalHash !== canonicalHash(withoutHash(source001U))
    || source001U.canonicalHash !== source001Y?.source001UResultHash
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_CONTOUR_ADMISSION_REASON_CODES.SOURCE_001U_RESULT_MISMATCH);
  }
  if (Object.entries(SOURCE_FALSE_FLAGS).some(([field, expected]) => source001U[field] !== expected)) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_CONTOUR_ADMISSION_REASON_CODES.SOURCE_001U_RUNTIME_FLAG_FORBIDDEN);
  }
}

function validateSource001V(input, reasons) {
  const source001Y = input.source001YResult;
  const source001U = input.source001UResult;
  const source001V = input.source001VResult;
  if (!isObject(source001V)) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_CONTOUR_ADMISSION_REASON_CODES.SOURCE_001V_RESULT_REQUIRED);
    return;
  }
  const decisions = Array.isArray(source001V.decisions) ? source001V.decisions : [];
  const decision = decisions[0] || null;
  if (
    source001V.resultKind !== SOURCE_001V_RESULT_KIND
    || source001V.outputDecision !== 'OWNER_MAY_OPEN_PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_001W_NO_PUBLIC_RUNTIME'
    || source001V.nextContourAfterPass !== 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_001W'
    || source001V.ownerMayOpen001W !== true
    || source001V.exactTextApplyWithReceiptAdmissionOnly !== true
    || source001V.privateInternalOnly !== true
    || source001V.privateExecutionNextContourOnly !== true
    || source001V.ownerPacketNotSufficientWithout001UMachineProof !== true
    || source001V.admissionDoesNotAuthorizePublicRuntime !== true
    || source001V.admissionDoesNotImplementApplyExecution !== true
    || source001V.admissionDoesNotMutateUserProject !== true
    || source001V.zeroApplyExecutionEffects !== true
    || source001V.blockedReasons?.length
    || source001V.source001UResultHash !== source001Y?.source001UResultHash
    || source001V.source001UDecisionHash !== source001Y?.source001UDecisionHash
    || source001V.source001UReceiptHash !== source001Y?.source001UReceiptHash
    || source001V.source001UResultHash !== source001U?.canonicalHash
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_CONTOUR_ADMISSION_REASON_CODES.SOURCE_001V_BLOCKED);
  }
  if (decisions.length !== 1 || !isObject(decision)) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_CONTOUR_ADMISSION_REASON_CODES.SOURCE_001V_DECISION_MALFORMED);
  } else {
    if (
      decision.decisionKind !== SOURCE_001V_DECISION_KIND
      || decision.outputDecision !== source001V.outputDecision
      || decision.nextContourAfterPass !== source001V.nextContourAfterPass
      || decision.publicRuntimeAdmitted !== false
      || decision.applyExecutionImplemented !== false
      || decision.applyTxnImplemented !== false
      || decision.recoveryClaimed !== false
      || decision.userProjectMutated !== false
    ) {
      reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_CONTOUR_ADMISSION_REASON_CODES.SOURCE_001V_DECISION_MALFORMED);
    }
    if (
      !hasText(decision.canonicalHash)
      || decision.canonicalHash !== canonicalHash(withoutHash(decision))
      || decision.canonicalHash !== source001Y?.source001VDecisionHash
    ) {
      reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_CONTOUR_ADMISSION_REASON_CODES.SOURCE_001V_DECISION_MISMATCH);
    }
  }
  if (
    !hasText(source001V.canonicalHash)
    || source001V.canonicalHash !== canonicalHash(withoutHash(source001V))
    || source001V.canonicalHash !== source001Y?.source001VResultHash
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_CONTOUR_ADMISSION_REASON_CODES.SOURCE_001V_RESULT_MISMATCH);
  }
  if (Object.entries(SOURCE_FALSE_FLAGS).some(([field, expected]) => source001V[field] !== expected)) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_CONTOUR_ADMISSION_REASON_CODES.SOURCE_001V_RUNTIME_FLAG_FORBIDDEN);
  }
}

function validateSource001W(input, reasons) {
  const source001Y = input.source001YResult;
  const source001W = input.source001WResult;
  if (!isObject(source001W)) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_CONTOUR_ADMISSION_REASON_CODES.SOURCE_001W_RESULT_REQUIRED);
    return;
  }
  const decisions = Array.isArray(source001W.decisions) ? source001W.decisions : [];
  const decision = decisions[0] || null;
  const receipt = source001W.receipt;
  if (
    source001W.resultKind !== SOURCE_001W_RESULT_KIND
    || source001W.outputDecision !== 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTED_NO_PUBLIC_RUNTIME'
    || source001W.nextContourAfterPass !== 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_CLOSEOUT_001X'
    || source001W.privateExactTextApplyWithReceiptExecuted !== true
    || source001W.receiptWritten !== true
    || source001W.receiptReadbackVerified !== true
    || source001W.blockedReasons?.length
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_CONTOUR_ADMISSION_REASON_CODES.SOURCE_001W_BLOCKED);
  }
  if (decisions.length !== 1 || !isObject(decision)) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_CONTOUR_ADMISSION_REASON_CODES.SOURCE_001W_DECISION_MALFORMED);
  } else {
    if (
      decision.decisionKind !== SOURCE_001W_DECISION_KIND
      || decision.outputDecision !== source001W.outputDecision
      || decision.nextContourAfterPass !== source001W.nextContourAfterPass
      || decision.productApplyRuntimeAdmitted !== false
      || decision.publicRuntimeAdmitted !== false
      || decision.applyTxnImplemented !== false
      || decision.recoveryClaimed !== false
      || decision.userProjectMutated !== false
    ) {
      reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_CONTOUR_ADMISSION_REASON_CODES.SOURCE_001W_DECISION_MALFORMED);
    }
    if (
      !hasText(decision.canonicalHash)
      || decision.canonicalHash !== canonicalHash(withoutHash(decision))
      || decision.canonicalHash !== source001Y?.source001WDecisionHash
    ) {
      reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_CONTOUR_ADMISSION_REASON_CODES.SOURCE_001W_DECISION_MISMATCH);
    }
  }
  if (!isObject(receipt)) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_CONTOUR_ADMISSION_REASON_CODES.SOURCE_001W_RECEIPT_MALFORMED);
  } else {
    if (
      receipt.receiptKind !== SOURCE_001W_RECEIPT_KIND
      || receipt.contourId !== 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_001W'
      || receipt.source001VResultHash !== source001Y?.source001VResultHash
      || receipt.source001VDecisionHash !== source001Y?.source001VDecisionHash
      || receipt.source001UResultHash !== source001Y?.source001UResultHash
      || receipt.source001UDecisionHash !== source001Y?.source001UDecisionHash
      || receipt.source001UReceiptHash !== source001Y?.source001UReceiptHash
      || receipt.receiptIsNotRecovery !== true
      || receipt.receiptReadbackIsNotStartupRecovery !== true
      || receipt.atomicSingleFileWriteIsNotApplyTxn !== true
    ) {
      reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_CONTOUR_ADMISSION_REASON_CODES.SOURCE_001W_RECEIPT_MALFORMED);
    }
    if (
      !hasText(receipt.receiptCanonicalHash)
      || receipt.receiptCanonicalHash !== receiptHash(receipt)
      || receipt.receiptCanonicalHash !== source001Y?.source001WReceiptHash
    ) {
      reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_CONTOUR_ADMISSION_REASON_CODES.SOURCE_001W_RECEIPT_MISMATCH);
    }
  }
  if (
    !hasText(source001W.canonicalHash)
    || source001W.canonicalHash !== canonicalHash(withoutHash(source001W))
    || source001W.canonicalHash !== source001Y?.source001WResultHash
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_CONTOUR_ADMISSION_REASON_CODES.SOURCE_001W_RESULT_MISMATCH);
  }
  if (Object.entries(SOURCE_FALSE_FLAGS).some(([field, expected]) => source001W[field] !== expected)) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_CONTOUR_ADMISSION_REASON_CODES.SOURCE_001W_RUNTIME_FLAG_FORBIDDEN);
  }
}

function validateOwnerPacket(input, reasons) {
  const packet = input.ownerAdmissionPacket001Z;
  if (!isObject(packet)) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_CONTOUR_ADMISSION_REASON_CODES.OWNER_PACKET_REQUIRED);
    return;
  }
  if (packet.packetKind !== OWNER_PACKET_KIND) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_CONTOUR_ADMISSION_REASON_CODES.OWNER_PACKET_INVALID);
  }
  if (packet.targetContour !== TARGET_CONTOUR) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_CONTOUR_ADMISSION_REASON_CODES.OWNER_PACKET_TARGET_MISMATCH);
  }
  if (packet.bindingHeadSha !== BINDING_HEAD_SHA) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_CONTOUR_ADMISSION_REASON_CODES.OWNER_PACKET_BINDING_MISMATCH);
  }
  if (OWNER_REQUIRED_TRUE_FIELDS.some((field) => packet[field] !== true)) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_CONTOUR_ADMISSION_REASON_CODES.OWNER_NEXT_CONTOUR_POLICY_MISSING);
  }
  validateForbiddenClaims(packet, reasons);
}

export function runExactTextApplyWithReceiptNextContourAdmission(input = {}) {
  const reasons = [];
  validateForbiddenClaims(input, reasons);
  validateSource001Y(input, reasons);
  validateSource001X(input, reasons);
  validateSource001U(input, reasons);
  validateSource001V(input, reasons);
  validateSource001W(input, reasons);
  validateOwnerPacket(input, reasons);
  if (reasons.length > 0) {
    return blockedResult(reasons, {
      source001YResultHash: input.source001YResultHash || input.source001YResult?.canonicalHash || null,
      source001YDecisionHash: input.source001YDecisionHash || null,
    });
  }
  return acceptedResult(input);
}

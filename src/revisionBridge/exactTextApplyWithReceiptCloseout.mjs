import { canonicalHash } from './reviewIrKernel.mjs';

const RESULT_KIND = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_CLOSEOUT_RESULT_001X';
const DECISION_KIND = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_CLOSEOUT_DECISION_001X';
const SOURCE_RESULT_KIND = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_RESULT_001W';
const SOURCE_DECISION_KIND = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_DECISION_001W';
const SOURCE_RECEIPT_KIND = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_V1_001W';

export const EXACT_TEXT_APPLY_WITH_RECEIPT_CLOSEOUT_REASON_CODES = Object.freeze({
  SOURCE_001W_RESULT_REQUIRED: 'SOURCE_001W_RESULT_REQUIRED',
  SOURCE_001W_RESULT_MISMATCH: 'SOURCE_001W_RESULT_MISMATCH',
  SOURCE_001W_DECISION_MISMATCH: 'SOURCE_001W_DECISION_MISMATCH',
  SOURCE_001W_RECEIPT_MISMATCH: 'SOURCE_001W_RECEIPT_MISMATCH',
  SOURCE_001W_BLOCKED: 'SOURCE_001W_BLOCKED',
  SOURCE_001W_RECEIPT_REQUIRED: 'SOURCE_001W_RECEIPT_REQUIRED',
  SOURCE_001W_DECISION_MALFORMED: 'SOURCE_001W_DECISION_MALFORMED',
  SOURCE_001W_RECEIPT_MALFORMED: 'SOURCE_001W_RECEIPT_MALFORMED',
  SOURCE_HASH_CHAIN_MISSING: 'SOURCE_HASH_CHAIN_MISSING',
  SOURCE_001W_RUNTIME_FLAG_FORBIDDEN: 'SOURCE_001W_RUNTIME_FLAG_FORBIDDEN',
  SOURCE_001W_BOUNDARY_MISSING: 'SOURCE_001W_BOUNDARY_MISSING',
  NEXT_ADMISSION_FORBIDDEN: 'NEXT_ADMISSION_FORBIDDEN',
  APPLY_EXECUTION_FORBIDDEN: 'APPLY_EXECUTION_FORBIDDEN',
  PRODUCT_RUNTIME_FORBIDDEN: 'PRODUCT_RUNTIME_FORBIDDEN',
  PUBLIC_COMMAND_SURFACE_FORBIDDEN: 'PUBLIC_COMMAND_SURFACE_FORBIDDEN',
  UI_DOCX_NETWORK_DEPENDENCY_FORBIDDEN: 'UI_DOCX_NETWORK_DEPENDENCY_FORBIDDEN',
  APPLYTXN_RECOVERY_RELEASE_FORBIDDEN: 'APPLYTXN_RECOVERY_RELEASE_FORBIDDEN',
  USER_PROJECT_MUTATION_FORBIDDEN: 'USER_PROJECT_MUTATION_FORBIDDEN',
});

const FALSE_FLAGS = Object.freeze({
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

const REQUIRED_TRUE_BOUNDARIES = [
  'privatePortExecutionOnly',
  'privateInternalOnly',
  'exactTextOnly',
  'singleSceneOnly',
  'receiptIsNotRecovery',
  'receiptReadbackIsNotStartupRecovery',
  'atomicSingleFileWriteIsNotApplyTxn',
  'multiFileConsistencyNotClaimed',
  'backupSubsystemNotReproven',
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

function receiptHash(receipt) {
  return canonicalHash(withoutHash(receipt, 'receiptCanonicalHash'));
}

function withCanonicalHash(core) {
  return {
    ...core,
    canonicalHash: canonicalHash(core),
  };
}

function uniqueReasons(reasons) {
  return Array.from(new Set(reasons.filter(Boolean))).sort();
}

function resultCore(input) {
  return {
    resultKind: RESULT_KIND,
    contourId: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_CLOSEOUT_001X',
    closeoutOnly: true,
    noAdmissionIn001X: true,
    noExecutionIn001X: true,
    privatePortExecutionOnly: true,
    privateInternalOnly: true,
    exactTextOnly: true,
    singleSceneOnly: true,
    receiptIsNotRecovery: true,
    receiptReadbackIsNotStartupRecovery: true,
    atomicSingleFileWriteIsNotApplyTxn: true,
    multiFileConsistencyNotClaimed: true,
    backupSubsystemNotReproven: true,
    ownerMayOpen001Y: false,
    ...FALSE_FLAGS,
    ...input,
  };
}

function blockedResult(blockedReasons, observations = {}) {
  return withCanonicalHash(resultCore({
    outputDecision: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_001W_CLOSEOUT_BLOCKED',
    source001WAccepted: false,
    nextContourRecommendation: null,
    blockedReasons: uniqueReasons(blockedReasons),
    decisions: [],
    ...observations,
  }));
}

function acceptedResult(input) {
  const source = input.source001WResult;
  const decisionCore = {
    decisionKind: DECISION_KIND,
    outputDecision: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_001W_CLOSEOUT_ACCEPTED',
    nextContourRecommendation: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_001Y',
    ownerMayOpen001Y: false,
    closeoutOnly: true,
    noAdmissionIn001X: true,
    noExecutionIn001X: true,
    privatePortExecutionOnly: true,
    productApplyRuntimeAdmitted: false,
    publicRuntimeAdmitted: false,
    applyTxnImplemented: false,
    recoveryClaimed: false,
    userProjectMutated: false,
  };
  const decision = withCanonicalHash(decisionCore);
  const receipt = source.receipt;
  return withCanonicalHash(resultCore({
    outputDecision: decision.outputDecision,
    source001WAccepted: true,
    nextContourRecommendation: decision.nextContourRecommendation,
    source001WResultHash: input.source001WResultHash,
    source001WDecisionHash: input.source001WDecisionHash,
    source001WReceiptHash: input.source001WReceiptHash,
    source001VResultHash: source.source001VResultHash,
    source001VDecisionHash: source.source001VDecisionHash,
    source001UResultHash: receipt.source001UResultHash,
    source001UDecisionHash: receipt.source001UDecisionHash,
    source001UReceiptHash: receipt.source001UReceiptHash,
    source001WReceiptKind: receipt.receiptKind,
    source001WReceiptCanonicalHash: receipt.receiptCanonicalHash,
    source001WOutputDecision: source.outputDecision,
    source001WNextContourAfterPass: source.nextContourAfterPass,
    source001WReceiptVerified: source.receiptReadbackVerified === true,
    blockedReasons: [],
    decisions: [decision],
  }));
}

function validateSourceResultShape(source, reasons) {
  if (
    source.resultKind !== SOURCE_RESULT_KIND
    || source.outputDecision !== 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTED_NO_PUBLIC_RUNTIME'
    || source.nextContourAfterPass !== 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_CLOSEOUT_001X'
    || source.privateExactTextApplyWithReceiptExecuted !== true
    || source.receiptWritten !== true
    || source.receiptReadbackVerified !== true
    || source.backupAttempted !== true
    || source.sceneWriteAttempted !== true
    || source.receiptWriteAttempted !== true
    || source.blockedReasons?.length
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_CLOSEOUT_REASON_CODES.SOURCE_001W_BLOCKED);
  }
}

function validateSourceDecision(source, input, reasons) {
  const decisions = Array.isArray(source.decisions) ? source.decisions : [];
  const decision = decisions[0] || null;
  if (decisions.length !== 1) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_CLOSEOUT_REASON_CODES.SOURCE_001W_DECISION_MALFORMED);
    return;
  }
  if (!isObject(decision)) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_CLOSEOUT_REASON_CODES.SOURCE_001W_DECISION_MALFORMED);
    return;
  }
  if (
    decision.decisionKind !== SOURCE_DECISION_KIND
    || decision.outputDecision !== source.outputDecision
    || decision.nextContourAfterPass !== source.nextContourAfterPass
    || decision.privatePortExecutionOnly !== true
    || decision.privateExactTextApplyWithReceiptExecuted !== true
    || decision.exactTextOnly !== true
    || decision.singleSceneOnly !== true
    || decision.productApplyRuntimeAdmitted !== false
    || decision.publicRuntimeAdmitted !== false
    || decision.applyTxnImplemented !== false
    || decision.recoveryClaimed !== false
    || decision.userProjectMutated !== false
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_CLOSEOUT_REASON_CODES.SOURCE_001W_DECISION_MALFORMED);
  }
  if (
    !hasText(decision.canonicalHash)
    || decision.canonicalHash !== canonicalHash(withoutHash(decision))
    || decision.canonicalHash !== input.source001WDecisionHash
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_CLOSEOUT_REASON_CODES.SOURCE_001W_DECISION_MISMATCH);
  }
}

function validateSourceReceipt(source, input, reasons) {
  const receipt = source.receipt;
  if (!isObject(receipt)) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_CLOSEOUT_REASON_CODES.SOURCE_001W_RECEIPT_REQUIRED);
    return;
  }
  if (
    receipt.receiptKind !== SOURCE_RECEIPT_KIND
    || receipt.contourId !== 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_001W'
    || receipt.source001VResultHash !== source.source001VResultHash
    || receipt.source001VDecisionHash !== source.source001VDecisionHash
    || receipt.receiptIsNotRecovery !== true
    || receipt.receiptReadbackIsNotStartupRecovery !== true
    || receipt.atomicSingleFileWriteIsNotApplyTxn !== true
    || receipt.multiFileConsistencyNotClaimed !== true
    || receipt.backupSubsystemNotReproven !== true
    || receipt.productApplyRuntimeAdmittedFalse !== true
    || receipt.publicRuntimeAdmittedFalse !== true
    || receipt.applyTxnImplementedFalse !== true
    || receipt.recoveryClaimedFalse !== true
    || receipt.userProjectMutatedFalse !== true
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_CLOSEOUT_REASON_CODES.SOURCE_001W_RECEIPT_MALFORMED);
  }
  if (
    !hasText(receipt.source001VResultHash)
    || !hasText(receipt.source001VDecisionHash)
    || !hasText(receipt.source001UResultHash)
    || !hasText(receipt.source001UDecisionHash)
    || !hasText(receipt.source001UReceiptHash)
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_CLOSEOUT_REASON_CODES.SOURCE_HASH_CHAIN_MISSING);
  }
  if (
    !hasText(receipt.receiptCanonicalHash)
    || receipt.receiptCanonicalHash !== receiptHash(receipt)
    || receipt.receiptCanonicalHash !== input.source001WReceiptHash
    || receipt.receiptCanonicalHash !== source.receiptCanonicalHash
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_CLOSEOUT_REASON_CODES.SOURCE_001W_RECEIPT_MISMATCH);
  }
}

function validateSourceBoundaries(source, reasons) {
  if (REQUIRED_TRUE_BOUNDARIES.some((field) => source[field] !== true)) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_CLOSEOUT_REASON_CODES.SOURCE_001W_BOUNDARY_MISSING);
  }
  if (Object.entries(FALSE_FLAGS).some(([field, expected]) => source[field] !== expected)) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_CLOSEOUT_REASON_CODES.SOURCE_001W_RUNTIME_FLAG_FORBIDDEN);
  }
}

function validateSourceHashes(source, input, reasons) {
  if (
    !hasText(source.source001VResultHash)
    || !hasText(source.source001VDecisionHash)
    || !hasText(input.source001WResultHash)
    || !hasText(input.source001WDecisionHash)
    || !hasText(input.source001WReceiptHash)
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_CLOSEOUT_REASON_CODES.SOURCE_HASH_CHAIN_MISSING);
  }
  if (
    !hasText(source.canonicalHash)
    || source.canonicalHash !== canonicalHash(withoutHash(source))
    || source.canonicalHash !== input.source001WResultHash
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_CLOSEOUT_REASON_CODES.SOURCE_001W_RESULT_MISMATCH);
  }
}

function validateCloseoutScope(input, reasons) {
  const ownerPacket = isObject(input.ownerPacket) ? input.ownerPacket : {};
  if (
    input.ownerMayOpen001Y === true
    || input.nextAdmissionRequested === true
    || input.openNextContourRequested === true
    || ownerPacket.ownerMayOpen001Y === true
    || ownerPacket.nextAdmissionRequested === true
    || ownerPacket.openNextContourRequested === true
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_CLOSEOUT_REASON_CODES.NEXT_ADMISSION_FORBIDDEN);
  }
  if (
    input.applyExecutionRequested === true
    || input.newExecutionRequested === true
    || input.privateExactTextApplyWithReceiptExecuted === true
    || ownerPacket.applyExecutionRequested === true
    || ownerPacket.newExecutionRequested === true
    || ownerPacket.privateExactTextApplyWithReceiptExecuted === true
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_CLOSEOUT_REASON_CODES.APPLY_EXECUTION_FORBIDDEN);
  }
  if (
    input.productApplyRuntimeAdmitted === true
    || input.publicRuntimeAdmitted === true
    || ownerPacket.productApplyRuntimeAdmitted === true
    || ownerPacket.publicRuntimeAdmitted === true
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_CLOSEOUT_REASON_CODES.PRODUCT_RUNTIME_FORBIDDEN);
  }
  if (
    input.publicSurfaceClaimed === true
    || input.ipcSurfaceClaimed === true
    || input.preloadExportClaimed === true
    || input.menuSurfaceClaimed === true
    || input.commandSurfaceClaimed === true
    || ownerPacket.publicSurfaceClaimed === true
    || ownerPacket.ipcSurfaceClaimed === true
    || ownerPacket.preloadExportClaimed === true
    || ownerPacket.menuSurfaceClaimed === true
    || ownerPacket.commandSurfaceClaimed === true
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_CLOSEOUT_REASON_CODES.PUBLIC_COMMAND_SURFACE_FORBIDDEN);
  }
  if (
    input.uiChanged === true
    || input.docxImportClaimed === true
    || input.networkUsed === true
    || input.dependencyChanged === true
    || ownerPacket.uiChanged === true
    || ownerPacket.docxImportClaimed === true
    || ownerPacket.networkUsed === true
    || ownerPacket.dependencyChanged === true
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_CLOSEOUT_REASON_CODES.UI_DOCX_NETWORK_DEPENDENCY_FORBIDDEN);
  }
  if (
    input.applyTxnImplemented === true
    || input.recoveryClaimed === true
    || input.startupRecoveryClaimed === true
    || input.releaseClaimed === true
    || ownerPacket.applyTxnImplemented === true
    || ownerPacket.recoveryClaimed === true
    || ownerPacket.startupRecoveryClaimed === true
    || ownerPacket.releaseClaimed === true
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_CLOSEOUT_REASON_CODES.APPLYTXN_RECOVERY_RELEASE_FORBIDDEN);
  }
  if (
    input.userProjectMutated === true
    || input.realUserProjectPathTouched === true
    || ownerPacket.userProjectMutated === true
    || ownerPacket.realUserProjectPathTouched === true
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_CLOSEOUT_REASON_CODES.USER_PROJECT_MUTATION_FORBIDDEN);
  }
}

export function runExactTextApplyWithReceiptCloseout(input = {}) {
  const reasons = [];
  const source = input.source001WResult;
  validateCloseoutScope(input, reasons);
  if (!isObject(source)) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_CLOSEOUT_REASON_CODES.SOURCE_001W_RESULT_REQUIRED);
    return blockedResult(reasons);
  }
  validateSourceResultShape(source, reasons);
  validateSourceDecision(source, input, reasons);
  validateSourceReceipt(source, input, reasons);
  validateSourceBoundaries(source, reasons);
  validateSourceHashes(source, input, reasons);
  if (reasons.length > 0) {
    return blockedResult(reasons, {
      source001WResultHash: input.source001WResultHash || source.canonicalHash || null,
      source001WDecisionHash: input.source001WDecisionHash || null,
      source001WReceiptHash: input.source001WReceiptHash || source.receiptCanonicalHash || null,
    });
  }
  return acceptedResult(input);
}

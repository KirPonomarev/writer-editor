import { canonicalHash } from './reviewIrKernel.mjs';

const RESULT_KIND = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_RESULT_001V';
const DECISION_KIND = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_DECISION_001V';
const SOURCE_001U_RESULT_KIND = 'PRIVATE_PRODUCT_APPLY_RECEIPT_IMPLEMENTATION_RESULT_001U';
const SOURCE_001U_RECEIPT_KIND = 'PRIVATE_PRODUCT_APPLY_RECEIPT_V1_001U';

export const EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_REASON_CODES = Object.freeze({
  SOURCE_001U_RESULT_REQUIRED: 'SOURCE_001U_RESULT_REQUIRED',
  SOURCE_001U_RESULT_MISMATCH: 'SOURCE_001U_RESULT_MISMATCH',
  SOURCE_001U_DECISION_MISMATCH: 'SOURCE_001U_DECISION_MISMATCH',
  SOURCE_001U_RECEIPT_MISMATCH: 'SOURCE_001U_RECEIPT_MISMATCH',
  SOURCE_001U_BLOCKED: 'SOURCE_001U_BLOCKED',
  SOURCE_001U_RUNTIME_FLAG_FORBIDDEN: 'SOURCE_001U_RUNTIME_FLAG_FORBIDDEN',
  SOURCE_001U_RECEIPT_BOUNDARY_MISSING: 'SOURCE_001U_RECEIPT_BOUNDARY_MISSING',
  OWNER_PACKET_REQUIRED: 'OWNER_PACKET_REQUIRED',
  OWNER_PACKET_INVALID: 'OWNER_PACKET_INVALID',
  OWNER_PACKET_SOURCE_BINDING_MISMATCH: 'OWNER_PACKET_SOURCE_BINDING_MISMATCH',
  OWNER_PUBLIC_RUNTIME_FORBIDDEN: 'OWNER_PUBLIC_RUNTIME_FORBIDDEN',
  OWNER_APPLYTXN_RECOVERY_FORBIDDEN: 'OWNER_APPLYTXN_RECOVERY_FORBIDDEN',
  OWNER_UI_DOCX_FORBIDDEN: 'OWNER_UI_DOCX_FORBIDDEN',
  OWNER_UNSUPPORTED_SCOPE_FORBIDDEN: 'OWNER_UNSUPPORTED_SCOPE_FORBIDDEN',
  APPLY_EXECUTION_REQUEST_FORBIDDEN: 'APPLY_EXECUTION_REQUEST_FORBIDDEN',
  PUBLIC_COMMAND_SURFACE_FORBIDDEN: 'PUBLIC_COMMAND_SURFACE_FORBIDDEN',
  UI_DOCX_NETWORK_DEPENDENCY_FORBIDDEN: 'UI_DOCX_NETWORK_DEPENDENCY_FORBIDDEN',
});

const FALSE_FLAGS = Object.freeze({
  applyExecutionImplemented: false,
  userProjectMutated: false,
  publicRuntimeAdmitted: false,
  productApplyRuntimeAdmitted: false,
  publicSurfaceClaimed: false,
  ipcSurfaceClaimed: false,
  menuSurfaceClaimed: false,
  commandSurfaceClaimed: false,
  preloadExportClaimed: false,
  uiChanged: false,
  docxImportClaimed: false,
  applyTxnImplemented: false,
  recoveryClaimed: false,
  releaseClaimed: false,
  multiSceneApplyClaimed: false,
  structuralApplyClaimed: false,
  commentApplyClaimed: false,
  networkUsed: false,
  dependencyChanged: false,
});

const OWNER_REQUIRED_TRUE_FIELDS = Object.freeze([
  'ownerApprovedOpeningPrivateExactTextApplyWithReceiptExecution001W',
  'ownerApprovedExactTextOnly',
  'ownerApprovedSingleSceneOnly',
  'ownerApprovedPrivateOnly',
  'ownerUnderstands001VIsAdmissionOnly',
  'ownerUnderstandsNoPublicSurface',
  'ownerUnderstandsNoUserProjectMutationIn001V',
  'ownerUnderstands001WStillPrivateExecutionOnly',
  'ownerUnderstandsNoApplyTxnRecoveryUiDocx',
  'ownerPacketNotSufficientWithout001UMachineProof',
]);

const OWNER_FORBIDDEN_TRUE_FIELDS = Object.freeze([
  'ownerApprovedPublicRuntime',
  'ownerApprovedPublicSurface',
  'ownerApprovedIpcSurface',
  'ownerApprovedPreloadSurface',
  'ownerApprovedMenuSurface',
  'ownerApprovedCommandSurface',
  'ownerApprovedApplyTxn',
  'ownerApprovedRecovery',
  'ownerApprovedUiChange',
  'ownerApprovedDocxRuntime',
  'ownerApprovedMultiSceneApply',
  'ownerApprovedStructuralApply',
  'ownerApprovedCommentApply',
  'ownerApprovedReleaseClaim',
]);

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

function uniqueReasons(reasons) {
  return Array.from(new Set(reasons.filter(Boolean))).sort();
}

function withCanonicalHash(core) {
  return {
    ...core,
    canonicalHash: canonicalHash(core),
  };
}

function resultCore(input) {
  return {
    resultKind: RESULT_KIND,
    contourId: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_001V',
    exactTextApplyWithReceiptAdmissionOnly: true,
    privateInternalOnly: true,
    privateExecutionNextContourOnly: true,
    exactTextOnly: true,
    singleSceneOnly: true,
    ownerPacketNotSufficientWithout001UMachineProof: true,
    admissionDoesNotAuthorizePublicRuntime: true,
    admissionDoesNotImplementApplyExecution: true,
    admissionDoesNotMutateUserProject: true,
    receiptImplementationProofRequired: true,
    source001UReceiptWriteIsNotApplyTxn: true,
    source001UReceiptReadbackIsNotRecovery: true,
    zeroApplyExecutionEffects: true,
    applyExecutionEffects: [],
    ...FALSE_FLAGS,
    ...input,
  };
}

function blockedResult(blockedReasons, observations = {}) {
  return withCanonicalHash(resultCore({
    outputDecision: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_REMAINS_BLOCKED',
    nextContourAfterPass: null,
    ownerMayOpen001W: false,
    blockedReasons: uniqueReasons(blockedReasons),
    decisions: [],
    ...observations,
  }));
}

function acceptedResult(input) {
  const decisionCore = {
    decisionKind: DECISION_KIND,
    outputDecision: 'OWNER_MAY_OPEN_PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_001W_NO_PUBLIC_RUNTIME',
    nextContourAfterPass: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_001W',
    exactTextApplyWithReceiptAdmissionOnly: true,
    privateExecutionNextContourOnly: true,
    admissionDoesNotImplementApplyExecution: true,
    admissionDoesNotMutateUserProject: true,
    admissionDoesNotAuthorizePublicRuntime: true,
    zeroApplyExecutionEffects: true,
    applyExecutionImplemented: false,
    userProjectMutated: false,
    publicRuntimeAdmitted: false,
    applyTxnImplemented: false,
    recoveryClaimed: false,
  };
  const decision = withCanonicalHash(decisionCore);
  return withCanonicalHash(resultCore({
    outputDecision: decision.outputDecision,
    nextContourAfterPass: decision.nextContourAfterPass,
    ownerMayOpen001W: true,
    source001UResultHash: input.source001UResultHash,
    source001UDecisionHash: input.source001UDecisionHash,
    source001UReceiptHash: input.source001UReceiptHash,
    blockedReasons: [],
    decisions: [decision],
  }));
}

function validate001U(input, reasons) {
  const source = input.source001UResult;
  if (!isObject(source)) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_REASON_CODES.SOURCE_001U_RESULT_REQUIRED);
    return;
  }

  const decision = Array.isArray(source.decisions) ? source.decisions[0] : null;
  const receipt = source.receipt;
  if (
    source.resultKind !== SOURCE_001U_RESULT_KIND
    || source.outputDecision !== 'PRIVATE_PRODUCT_APPLYRECEIPT_IMPLEMENTED_FOR_EXACT_TEXT_SCOPE_NO_PUBLIC_RUNTIME'
    || source.nextContourAfterPass !== 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_001V'
    || source.privateProductApplyReceiptImplemented !== true
    || source.privateInternalOnly !== true
    || source.exactTextOnly !== true
    || source.singleSceneOnly !== true
    || source.receiptReadbackVerified !== true
    || source.receiptHashBound !== true
    || source.blockedReasons?.length
    || !isObject(decision)
    || !isObject(receipt)
    || receipt.receiptKind !== SOURCE_001U_RECEIPT_KIND
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_REASON_CODES.SOURCE_001U_BLOCKED);
  }
  if (
    !hasText(source.canonicalHash)
    || source.canonicalHash !== canonicalHash(withoutHash(source))
    || source.canonicalHash !== input.source001UResultHash
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_REASON_CODES.SOURCE_001U_RESULT_MISMATCH);
  }
  if (
    !hasText(decision?.canonicalHash)
    || decision.canonicalHash !== canonicalHash(withoutHash(decision))
    || decision.canonicalHash !== input.source001UDecisionHash
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_REASON_CODES.SOURCE_001U_DECISION_MISMATCH);
  }
  if (
    !hasText(receipt?.receiptCanonicalHash)
    || receiptHash(receipt) !== receipt.receiptCanonicalHash
    || receipt.receiptCanonicalHash !== input.source001UReceiptHash
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_REASON_CODES.SOURCE_001U_RECEIPT_MISMATCH);
  }
  if (
    source.productApplyRuntimeAdmitted !== false
    || source.publicSurfaceClaimed !== false
    || source.ipcSurfaceClaimed !== false
    || source.menuSurfaceClaimed !== false
    || source.commandSurfaceClaimed !== false
    || source.preloadExportClaimed !== false
    || source.uiChanged !== false
    || source.docxImportClaimed !== false
    || source.applyTxnImplemented !== false
    || source.recoveryClaimed !== false
    || source.releaseClaimed !== false
    || source.multiSceneApplyClaimed !== false
    || source.structuralApplyClaimed !== false
    || source.commentApplyClaimed !== false
    || source.networkUsed !== false
    || source.dependencyChanged !== false
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_REASON_CODES.SOURCE_001U_RUNTIME_FLAG_FORBIDDEN);
  }
  if (
    source.receiptWriteIsNotApplyTxn !== true
    || source.receiptReadbackIsNotRecovery !== true
    || source.backupAndAtomicHashesBoundNotReproven !== true
    || source.ownerAdmissionDoesNotAuthorizeRuntimeApply !== true
    || source.privateFunctionOnlyNoPublicSurface !== true
    || !isObject(receipt)
    || receipt.receiptWriteIsNotApplyTxn !== true
    || receipt.receiptReadbackIsNotRecovery !== true
    || receipt.backupAndAtomicHashesBoundNotReproven !== true
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_REASON_CODES.SOURCE_001U_RECEIPT_BOUNDARY_MISSING);
  }
}

function validateOwnerPacket(ownerPacket, input, reasons) {
  if (!isObject(ownerPacket)) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_REASON_CODES.OWNER_PACKET_REQUIRED);
    return;
  }
  if (ownerPacket.packetKind !== 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_OWNER_PACKET_001V') {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_REASON_CODES.OWNER_PACKET_INVALID);
  }
  if (OWNER_REQUIRED_TRUE_FIELDS.some((field) => ownerPacket[field] !== true)) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_REASON_CODES.OWNER_PACKET_INVALID);
  }
  if (
    ownerPacket.source001UResultHash !== input.source001UResultHash
    || ownerPacket.source001UDecisionHash !== input.source001UDecisionHash
    || ownerPacket.source001UReceiptHash !== input.source001UReceiptHash
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_REASON_CODES.OWNER_PACKET_SOURCE_BINDING_MISMATCH);
  }
  if (
    ownerPacket.ownerApprovedPublicRuntime === true
    || ownerPacket.ownerApprovedPublicSurface === true
    || ownerPacket.ownerApprovedIpcSurface === true
    || ownerPacket.ownerApprovedPreloadSurface === true
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_REASON_CODES.OWNER_PUBLIC_RUNTIME_FORBIDDEN);
  }
  if (ownerPacket.ownerApprovedApplyTxn === true || ownerPacket.ownerApprovedRecovery === true) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_REASON_CODES.OWNER_APPLYTXN_RECOVERY_FORBIDDEN);
  }
  if (ownerPacket.ownerApprovedUiChange === true || ownerPacket.ownerApprovedDocxRuntime === true) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_REASON_CODES.OWNER_UI_DOCX_FORBIDDEN);
  }
  if (
    ownerPacket.ownerApprovedMultiSceneApply === true
    || ownerPacket.ownerApprovedStructuralApply === true
    || ownerPacket.ownerApprovedCommentApply === true
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_REASON_CODES.OWNER_UNSUPPORTED_SCOPE_FORBIDDEN);
  }
  if (OWNER_FORBIDDEN_TRUE_FIELDS.some((field) => ownerPacket[field] === true)) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_REASON_CODES.OWNER_PACKET_INVALID);
  }
}

function validateNoExecutionClaims(input, reasons) {
  if (input.applyExecutionRequested === true || input.applyExecutionImplemented === true || input.userProjectMutated === true) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_REASON_CODES.APPLY_EXECUTION_REQUEST_FORBIDDEN);
  }
  if (
    input.publicSurfaceClaimed === true
    || input.ipcSurfaceClaimed === true
    || input.preloadExportClaimed === true
    || input.menuSurfaceClaimed === true
    || input.commandSurfaceClaimed === true
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_REASON_CODES.PUBLIC_COMMAND_SURFACE_FORBIDDEN);
  }
  if (
    input.uiChanged === true
    || input.docxImportClaimed === true
    || input.networkUsed === true
    || input.dependencyChanged === true
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_REASON_CODES.UI_DOCX_NETWORK_DEPENDENCY_FORBIDDEN);
  }
}

export function runExactTextApplyWithReceiptAdmission(input = {}) {
  const reasons = [];
  validate001U(input, reasons);
  validateOwnerPacket(input.ownerPacket, input, reasons);
  validateNoExecutionClaims(input, reasons);
  if (reasons.length > 0) {
    return blockedResult(reasons);
  }
  return acceptedResult(input);
}

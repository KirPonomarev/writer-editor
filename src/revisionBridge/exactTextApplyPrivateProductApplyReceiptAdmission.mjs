import { canonicalHash } from './reviewIrKernel.mjs';

const RESULT_KIND = 'PRIVATE_PRODUCT_APPLY_RECEIPT_ADMISSION_RESULT_001T';
const DECISION_KIND = 'PRIVATE_PRODUCT_APPLY_RECEIPT_ADMISSION_DECISION_001T';
const SOURCE_001S_RESULT_KIND = 'EXACT_TEXT_FIXTURE_DURABLE_RECEIPT_RESULT_001S';
const SUCCESS_RECEIPT_KIND = 'EXACT_TEXT_FIXTURE_DURABLE_SUCCESS_RECEIPT_001S';
const FAILURE_RECEIPT_KIND = 'EXACT_TEXT_FIXTURE_DURABLE_FAILURE_RECEIPT_001S';

export const PRIVATE_PRODUCT_APPLY_RECEIPT_ADMISSION_REASON_CODES = Object.freeze({
  SOURCE_001S_SUCCESS_RESULT_REQUIRED: 'SOURCE_001S_SUCCESS_RESULT_REQUIRED',
  SOURCE_001S_FAILURE_RESULT_REQUIRED: 'SOURCE_001S_FAILURE_RESULT_REQUIRED',
  SOURCE_001S_SUCCESS_RESULT_MISMATCH: 'SOURCE_001S_SUCCESS_RESULT_MISMATCH',
  SOURCE_001S_FAILURE_RESULT_MISMATCH: 'SOURCE_001S_FAILURE_RESULT_MISMATCH',
  SOURCE_001S_SUCCESS_DECISION_MISMATCH: 'SOURCE_001S_SUCCESS_DECISION_MISMATCH',
  SOURCE_001S_FAILURE_DECISION_MISMATCH: 'SOURCE_001S_FAILURE_DECISION_MISMATCH',
  SOURCE_001S_SUCCESS_RECEIPT_MISMATCH: 'SOURCE_001S_SUCCESS_RECEIPT_MISMATCH',
  SOURCE_001S_FAILURE_RECEIPT_MISMATCH: 'SOURCE_001S_FAILURE_RECEIPT_MISMATCH',
  OWNER_PACKET_REQUIRED: 'OWNER_PACKET_REQUIRED',
  OWNER_PACKET_INVALID: 'OWNER_PACKET_INVALID',
  OWNER_PACKET_SOURCE_BINDING_MISMATCH: 'OWNER_PACKET_SOURCE_BINDING_MISMATCH',
  OWNER_PUBLIC_SURFACE_FORBIDDEN: 'OWNER_PUBLIC_SURFACE_FORBIDDEN',
  OWNER_USER_PROJECT_WRITE_FORBIDDEN: 'OWNER_USER_PROJECT_WRITE_FORBIDDEN',
  OWNER_BROAD_APPLY_FORBIDDEN: 'OWNER_BROAD_APPLY_FORBIDDEN',
  PRODUCT_RUNTIME_ADMISSION_FORBIDDEN: 'PRODUCT_RUNTIME_ADMISSION_FORBIDDEN',
  PRODUCT_RECEIPT_PROOF_OVERCLAIM_FORBIDDEN: 'PRODUCT_RECEIPT_PROOF_OVERCLAIM_FORBIDDEN',
  SOURCE_PRODUCT_CLAIM_FORBIDDEN: 'SOURCE_PRODUCT_CLAIM_FORBIDDEN',
});

const RESULT_FALSE_FLAGS = Object.freeze({
  productApplyReceiptImplemented: false,
  productApplyRuntimeAdmitted: false,
  userProjectWriteAllowedIn001T: false,
  userProjectMutated: false,
  publicSurfaceAllowed: false,
  publicSurfaceClaimed: false,
  ipcSurfaceClaimed: false,
  uiChanged: false,
  docxImportClaimed: false,
  applyTxnImplemented: false,
  recoveryClaimed: false,
  releaseClaimed: false,
});

const SOURCE_FALSE_FLAGS = Object.freeze([
  'productWritePerformed',
  'productWriteClaimed',
  'productApplyAdmitted',
  'productApplyReceiptImplemented',
  'productDurableApplyReceiptClaimed',
  'applyReceiptImplemented',
  'durableReceiptClaimed',
  'applyTxnImplemented',
  'applyTxnClaimed',
  'recoveryClaimed',
  'crashRecoveryClaimed',
  'publicSurfaceClaimed',
  'docxImportClaimed',
  'uiChanged',
  'networkUsed',
  'dependencyChanged',
  'userProjectMutated',
]);

const OWNER_REQUIRED_TRUE_FIELDS = Object.freeze([
  'ownerApprovedOpeningPrivateProductApplyReceiptImplementation',
  'ownerApprovedExactTextOnly',
  'ownerApprovedSingleSceneOnly',
  'ownerApprovedPrivateOnly',
  'ownerUnderstandsNoPublicSurface',
  'ownerUnderstandsNoUserProjectWriteIn001T',
  'ownerUnderstandsNextContourRequiredForImplementation',
  'ownerPacketNotSufficientWithout001SMachineProof',
  'fixtureReceiptEvidenceIsNotProductReceiptProof',
]);

const OWNER_FORBIDDEN_TRUE_FIELDS = Object.freeze([
  'ownerApprovedPublicSurface',
  'ownerApprovedIpcSurface',
  'ownerApprovedUserProjectWriteIn001T',
  'ownerApprovedProductRuntimeAdmissionIn001T',
  'ownerApprovedBroadApply',
  'ownerApprovedMultiSceneApply',
  'ownerApprovedStructuralApply',
  'ownerApprovedDocxRuntime',
  'ownerApprovedUiChange',
  'ownerApprovedRecoveryClaim',
  'ownerApprovedApplyTxnClaim',
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

function resultCore(input) {
  return {
    resultKind: RESULT_KIND,
    contourId: 'PRIVATE_PRODUCT_APPLY_RECEIPT_ADMISSION_001T',
    privateProductApplyReceiptAdmissionOnly: true,
    privateInternalOnly: true,
    ownerPacketNotSufficientWithout001SMachineProof: true,
    fixtureReceiptEvidenceIsNotProductReceiptProof: true,
    admissionIsNotRuntimeAdmission: true,
    ...RESULT_FALSE_FLAGS,
    ...input,
  };
}

function withCanonicalHash(core) {
  return {
    ...core,
    canonicalHash: canonicalHash(core),
  };
}

function blockedResult(blockedReasons, observations = {}) {
  return withCanonicalHash(resultCore({
    outputDecision: 'PRIVATE_PRODUCT_APPLY_RECEIPT_ADMISSION_REMAINS_BLOCKED',
    nextContourAfterPass: null,
    ownerMayOpen001U: false,
    blockedReasons: uniqueReasons(blockedReasons),
    decisions: [],
    ...observations,
  }));
}

function acceptedResult(input) {
  const decisionCore = {
    decisionKind: DECISION_KIND,
    outputDecision: 'OWNER_MAY_OPEN_PRIVATE_PRODUCT_APPLYRECEIPT_IMPLEMENTATION_001U_NO_RUNTIME_ADMISSION',
    nextContourAfterPass: 'PRIVATE_PRODUCT_APPLY_RECEIPT_IMPLEMENTATION_001U',
    privateProductApplyReceiptAdmissionOnly: true,
    privateInternalOnly: true,
    admissionIsNotRuntimeAdmission: true,
    ownerPacketNotSufficientWithout001SMachineProof: true,
    fixtureReceiptEvidenceIsNotProductReceiptProof: true,
    productApplyReceiptImplemented: false,
    productApplyRuntimeAdmitted: false,
    publicSurfaceAllowed: false,
    userProjectWriteAllowedIn001T: false,
  };
  const decision = withCanonicalHash(decisionCore);
  return withCanonicalHash(resultCore({
    outputDecision: decision.outputDecision,
    nextContourAfterPass: decision.nextContourAfterPass,
    ownerMayOpen001U: true,
    source001SSuccessResultHash: input.source001SSuccessResultHash,
    source001SFailureResultHash: input.source001SFailureResultHash,
    source001SSuccessDecisionHash: input.source001SSuccessDecisionHash,
    source001SFailureDecisionHash: input.source001SFailureDecisionHash,
    source001SSuccessReceiptHash: input.source001SSuccessReceiptHash,
    source001SFailureReceiptHash: input.source001SFailureReceiptHash,
    blockedReasons: [],
    decisions: [decision],
  }));
}

function validateSourceFalseFlags(source, reasons) {
  if (SOURCE_FALSE_FLAGS.some((flag) => source?.[flag] !== false)) {
    reasons.push(PRIVATE_PRODUCT_APPLY_RECEIPT_ADMISSION_REASON_CODES.SOURCE_PRODUCT_CLAIM_FORBIDDEN);
  }
  if (
    source?.fixtureDurableReceiptIsNotProductApplyReceipt !== true
    || source?.failureReceiptIsNotRecovery !== true
    || source?.atomicReceiptFileWriteIsNotApplyTxn !== true
    || source?.receiptObservationDoesNotAdmitProductApply !== true
  ) {
    reasons.push(PRIVATE_PRODUCT_APPLY_RECEIPT_ADMISSION_REASON_CODES.PRODUCT_RECEIPT_PROOF_OVERCLAIM_FORBIDDEN);
  }
}

function validate001SSource(source, expected, reasons) {
  if (!isObject(source)) {
    reasons.push(expected.requiredCode);
    return;
  }

  const decision = Array.isArray(source.decisions) ? source.decisions[0] : null;
  const receipt = source.receipt;

  if (
    source.resultKind !== SOURCE_001S_RESULT_KIND
    || source.outputDecision !== expected.outputDecision
    || source.nextContourAfterPass !== 'PRIVATE_PRODUCT_APPLY_RECEIPT_ADMISSION_001T'
    || source.blockedReasons?.length
    || !isObject(decision)
    || !isObject(receipt)
    || receipt.receiptKind !== expected.receiptKind
    || source.fixtureDurableReceiptObserved !== expected.successObserved
    || source.fixtureFailureReceiptObserved !== expected.failureObserved
    || source.receiptFileWritten !== true
    || source.receiptReadbackVerified !== true
  ) {
    reasons.push(expected.resultMismatchCode);
  }

  validateSourceFalseFlags(source, reasons);

  if (
    !hasText(source.canonicalHash)
    || source.canonicalHash !== canonicalHash(withoutHash(source))
    || source.canonicalHash !== expected.resultHash
  ) {
    reasons.push(expected.resultMismatchCode);
  }

  if (
    !hasText(decision?.canonicalHash)
    || decision.canonicalHash !== canonicalHash(withoutHash(decision))
    || decision.canonicalHash !== expected.decisionHash
  ) {
    reasons.push(expected.decisionMismatchCode);
  }

  if (
    !hasText(receipt?.receiptCanonicalHash)
    || receiptHash(receipt) !== receipt.receiptCanonicalHash
    || receipt.receiptCanonicalHash !== expected.receiptHash
  ) {
    reasons.push(expected.receiptMismatchCode);
  }
}

function validateOwnerPacket(ownerPacket, input, reasons) {
  if (!isObject(ownerPacket)) {
    reasons.push(PRIVATE_PRODUCT_APPLY_RECEIPT_ADMISSION_REASON_CODES.OWNER_PACKET_REQUIRED);
    return;
  }
  if (ownerPacket.packetKind !== 'PRIVATE_PRODUCT_APPLY_RECEIPT_ADMISSION_OWNER_PACKET_001T') {
    reasons.push(PRIVATE_PRODUCT_APPLY_RECEIPT_ADMISSION_REASON_CODES.OWNER_PACKET_INVALID);
  }
  if (OWNER_REQUIRED_TRUE_FIELDS.some((field) => ownerPacket[field] !== true)) {
    reasons.push(PRIVATE_PRODUCT_APPLY_RECEIPT_ADMISSION_REASON_CODES.OWNER_PACKET_INVALID);
  }
  if (
    ownerPacket.source001SSuccessResultHash !== input.source001SSuccessResultHash
    || ownerPacket.source001SFailureResultHash !== input.source001SFailureResultHash
  ) {
    reasons.push(PRIVATE_PRODUCT_APPLY_RECEIPT_ADMISSION_REASON_CODES.OWNER_PACKET_SOURCE_BINDING_MISMATCH);
  }
  if (ownerPacket.ownerApprovedPublicSurface === true || ownerPacket.ownerApprovedIpcSurface === true) {
    reasons.push(PRIVATE_PRODUCT_APPLY_RECEIPT_ADMISSION_REASON_CODES.OWNER_PUBLIC_SURFACE_FORBIDDEN);
  }
  if (ownerPacket.ownerApprovedUserProjectWriteIn001T === true) {
    reasons.push(PRIVATE_PRODUCT_APPLY_RECEIPT_ADMISSION_REASON_CODES.OWNER_USER_PROJECT_WRITE_FORBIDDEN);
  }
  if (
    ownerPacket.ownerApprovedBroadApply === true
    || ownerPacket.ownerApprovedMultiSceneApply === true
    || ownerPacket.ownerApprovedStructuralApply === true
  ) {
    reasons.push(PRIVATE_PRODUCT_APPLY_RECEIPT_ADMISSION_REASON_CODES.OWNER_BROAD_APPLY_FORBIDDEN);
  }
  if (
    ownerPacket.ownerApprovedProductRuntimeAdmissionIn001T === true
    || ownerPacket.ownerApprovedDocxRuntime === true
    || ownerPacket.ownerApprovedUiChange === true
    || ownerPacket.ownerApprovedReleaseClaim === true
  ) {
    reasons.push(PRIVATE_PRODUCT_APPLY_RECEIPT_ADMISSION_REASON_CODES.PRODUCT_RUNTIME_ADMISSION_FORBIDDEN);
  }
  if (ownerPacket.ownerApprovedApplyTxnClaim === true || ownerPacket.ownerApprovedRecoveryClaim === true) {
    reasons.push(PRIVATE_PRODUCT_APPLY_RECEIPT_ADMISSION_REASON_CODES.PRODUCT_RECEIPT_PROOF_OVERCLAIM_FORBIDDEN);
  }
  if (OWNER_FORBIDDEN_TRUE_FIELDS.some((field) => ownerPacket[field] === true)) {
    reasons.push(PRIVATE_PRODUCT_APPLY_RECEIPT_ADMISSION_REASON_CODES.OWNER_PACKET_INVALID);
  }
}

export function runExactTextApplyPrivateProductApplyReceiptAdmission(input = {}) {
  const reasons = [];

  validate001SSource(input.source001SSuccessResult, {
    requiredCode: PRIVATE_PRODUCT_APPLY_RECEIPT_ADMISSION_REASON_CODES.SOURCE_001S_SUCCESS_RESULT_REQUIRED,
    resultMismatchCode: PRIVATE_PRODUCT_APPLY_RECEIPT_ADMISSION_REASON_CODES.SOURCE_001S_SUCCESS_RESULT_MISMATCH,
    decisionMismatchCode: PRIVATE_PRODUCT_APPLY_RECEIPT_ADMISSION_REASON_CODES.SOURCE_001S_SUCCESS_DECISION_MISMATCH,
    receiptMismatchCode: PRIVATE_PRODUCT_APPLY_RECEIPT_ADMISSION_REASON_CODES.SOURCE_001S_SUCCESS_RECEIPT_MISMATCH,
    outputDecision: 'FIXTURE_DURABLE_SUCCESS_RECEIPT_OBSERVED',
    receiptKind: SUCCESS_RECEIPT_KIND,
    successObserved: true,
    failureObserved: false,
    resultHash: input.source001SSuccessResultHash,
    decisionHash: input.source001SSuccessDecisionHash,
    receiptHash: input.source001SSuccessReceiptHash,
  }, reasons);

  validate001SSource(input.source001SFailureResult, {
    requiredCode: PRIVATE_PRODUCT_APPLY_RECEIPT_ADMISSION_REASON_CODES.SOURCE_001S_FAILURE_RESULT_REQUIRED,
    resultMismatchCode: PRIVATE_PRODUCT_APPLY_RECEIPT_ADMISSION_REASON_CODES.SOURCE_001S_FAILURE_RESULT_MISMATCH,
    decisionMismatchCode: PRIVATE_PRODUCT_APPLY_RECEIPT_ADMISSION_REASON_CODES.SOURCE_001S_FAILURE_DECISION_MISMATCH,
    receiptMismatchCode: PRIVATE_PRODUCT_APPLY_RECEIPT_ADMISSION_REASON_CODES.SOURCE_001S_FAILURE_RECEIPT_MISMATCH,
    outputDecision: 'FIXTURE_DURABLE_FAILURE_RECEIPT_OBSERVED',
    receiptKind: FAILURE_RECEIPT_KIND,
    successObserved: false,
    failureObserved: true,
    resultHash: input.source001SFailureResultHash,
    decisionHash: input.source001SFailureDecisionHash,
    receiptHash: input.source001SFailureReceiptHash,
  }, reasons);

  validateOwnerPacket(input.ownerPacket, input, reasons);

  if (reasons.length > 0) {
    return blockedResult(reasons);
  }

  return acceptedResult(input);
}

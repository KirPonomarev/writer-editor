import { canonicalHash } from './reviewIrKernel.mjs';
import { runExactTextApplyWithReceiptNextContourAdmission } from './exactTextApplyWithReceiptNextContourAdmission.mjs';

const RESULT_KIND = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_BRIEF_RESULT_002A';
const DECISION_KIND = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_BRIEF_DECISION_002A';
const BRIEF_KIND = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_CONTRACT_BRIEF_V1_002A';
const SOURCE_001Z_RESULT_KIND = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_CONTOUR_ADMISSION_RESULT_001Z';
const SOURCE_001Z_DECISION_KIND = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_CONTOUR_ADMISSION_DECISION_001Z';
const OWNER_PACKET_KIND = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_BRIEF_OWNER_PACKET_002A';
const TARGET_CONTOUR = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_SHAPE_002B';
const BINDING_HEAD_SHA = 'a85c234ae8d2991a8b387cb76a502032789c89cc';

export const EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_BRIEF_REASON_CODES = Object.freeze({
  SOURCE_001Z_RESULT_REQUIRED: 'SOURCE_001Z_RESULT_REQUIRED',
  SOURCE_001Z_RESULT_MISMATCH: 'SOURCE_001Z_RESULT_MISMATCH',
  SOURCE_001Z_DECISION_MISMATCH: 'SOURCE_001Z_DECISION_MISMATCH',
  SOURCE_001Z_BLOCKED: 'SOURCE_001Z_BLOCKED',
  SOURCE_001Z_DECISION_MALFORMED: 'SOURCE_001Z_DECISION_MALFORMED',
  SOURCE_001Z_BOUNDARY_MISSING: 'SOURCE_001Z_BOUNDARY_MISSING',
  SOURCE_001Z_RUNTIME_FLAG_FORBIDDEN: 'SOURCE_001Z_RUNTIME_FLAG_FORBIDDEN',
  INHERITED_CHAIN_REVALIDATION_FAILED: 'INHERITED_CHAIN_REVALIDATION_FAILED',
  OWNER_PACKET_REQUIRED: 'OWNER_PACKET_REQUIRED',
  OWNER_PACKET_INVALID: 'OWNER_PACKET_INVALID',
  OWNER_PACKET_BINDING_MISMATCH: 'OWNER_PACKET_BINDING_MISMATCH',
  OWNER_PACKET_TARGET_MISMATCH: 'OWNER_PACKET_TARGET_MISMATCH',
  OWNER_CONTRACT_POLICY_MISSING: 'OWNER_CONTRACT_POLICY_MISSING',
  CONTRACT_FIELD_MISSING: 'CONTRACT_FIELD_MISSING',
  CONTRACT_UNKNOWN_FIELD_FORBIDDEN: 'CONTRACT_UNKNOWN_FIELD_FORBIDDEN',
  FAILURE_CONTRACT_FIELD_MISSING: 'FAILURE_CONTRACT_FIELD_MISSING',
  FAILURE_CONTRACT_UNKNOWN_FIELD_FORBIDDEN: 'FAILURE_CONTRACT_UNKNOWN_FIELD_FORBIDDEN',
  PORT_IMPLEMENTATION_FORBIDDEN: 'PORT_IMPLEMENTATION_FORBIDDEN',
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

const TRUE_BRIEF_FIELDS = [
  'contractBriefOnly',
  'privateInternalOnly',
  'exactTextOnly',
  'singleSceneOnly',
  'noPortImplementation',
  'noStoragePort',
  'noWritePort',
  'requiredProjectIdTest',
  'requiredSceneIdTest',
  'requiredBaselineHashTest',
  'requiredClosedSessionBlocker',
  'requiredExactTextGuard',
  'requiredBlockVersionHashTest',
  'requiredSourceResultHash',
  'requiredSourceDecisionHash',
  'requiredReceiptCanonicalHash',
  'requiredReceiptSourceHashes',
  'receiptIsNotRecovery',
  'receiptReadbackIsNotStartupRecovery',
  'atomicSingleFileWriteIsNotApplyTxn',
  'zeroWriteEffectsInBrief',
  'noReceiptOnBlockedPlan',
  'blockedReasonCodesRequired',
];

const FALSE_BRIEF_FIELDS = [
  'productApplyRuntimeAdmitted',
  'publicRuntimeAdmitted',
  'publicAdapterImplementationAdmitted',
  'runtimeWiringAdmitted',
  'applyExecutionImplemented',
  'applyTxnImplemented',
  'recoveryClaimed',
  'releaseClaimed',
  'userProjectMutated',
];

const CONTRACT_BRIEF_ALLOWED_FIELDS = Object.freeze(new Set([
  'briefKind',
  'contourId',
  ...TRUE_BRIEF_FIELDS,
  ...FALSE_BRIEF_FIELDS,
]));

const FAILURE_CONTRACT_FIELDS = [
  'blockedReasonCodes',
  'zeroWriteEffects',
  'noReceiptOnBlockedPlan',
  'noBackupOnBlockedPlan',
  'noUserProjectMutation',
  'deterministicBlockedDecisionHash',
];

const FAILURE_CONTRACT_ALLOWED_FIELDS = Object.freeze(new Set(FAILURE_CONTRACT_FIELDS));

const OWNER_REQUIRED_TRUE_FIELDS = [
  'ownerApprovedContractBrief',
  'ownerUnderstandsContractBriefOnly',
  'ownerUnderstandsNoPortImplementation',
  'ownerUnderstandsNoStoragePort',
  'ownerUnderstandsNoWritePort',
  'ownerUnderstandsNoPublicAdapterImplementation',
  'ownerUnderstandsNoRuntimeWiring',
  'ownerUnderstandsNoApplyExecution',
  'ownerUnderstandsNoApplyTxn',
  'ownerUnderstandsNoRecovery',
  'ownerUnderstandsNoReleaseClaim',
  'ownerPacketAuthorizesOnlyContractBrief',
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

function uniqueReasons(reasons) {
  return Array.from(new Set(reasons.filter(Boolean))).sort();
}

function resultCore(input) {
  return {
    resultKind: RESULT_KIND,
    contourId: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_BRIEF_002A',
    contractBriefOnly: true,
    privateInternalOnly: true,
    exactTextOnly: true,
    singleSceneOnly: true,
    noPortImplementation: true,
    noStoragePort: true,
    noWritePort: true,
    writeEffectsCount: 0,
    ...FALSE_FLAGS,
    ...input,
  };
}

function buildContractBrief(overrides = {}) {
  const brief = {
    briefKind: BRIEF_KIND,
    contourId: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_BRIEF_002A',
    contractBriefOnly: true,
    privateInternalOnly: true,
    exactTextOnly: true,
    singleSceneOnly: true,
    noPortImplementation: true,
    noStoragePort: true,
    noWritePort: true,
    requiredProjectIdTest: true,
    requiredSceneIdTest: true,
    requiredBaselineHashTest: true,
    requiredClosedSessionBlocker: true,
    requiredExactTextGuard: true,
    requiredBlockVersionHashTest: true,
    requiredSourceResultHash: true,
    requiredSourceDecisionHash: true,
    requiredReceiptCanonicalHash: true,
    requiredReceiptSourceHashes: true,
    receiptIsNotRecovery: true,
    receiptReadbackIsNotStartupRecovery: true,
    atomicSingleFileWriteIsNotApplyTxn: true,
    zeroWriteEffectsInBrief: true,
    noReceiptOnBlockedPlan: true,
    blockedReasonCodesRequired: true,
    productApplyRuntimeAdmitted: false,
    publicRuntimeAdmitted: false,
    publicAdapterImplementationAdmitted: false,
    runtimeWiringAdmitted: false,
    applyExecutionImplemented: false,
    applyTxnImplemented: false,
    recoveryClaimed: false,
    releaseClaimed: false,
    userProjectMutated: false,
    ...overrides,
  };
  return withCanonicalHash(brief);
}

function buildFailureContract(overrides = {}) {
  const contract = {
    blockedReasonCodes: [
      'STALE_BASELINE',
      'WRONG_PROJECT',
      'CLOSED_SESSION',
      'EXACT_TEXT_GUARD_FAILED',
      'BLOCK_VERSION_HASH_MISMATCH',
    ],
    zeroWriteEffects: true,
    noReceiptOnBlockedPlan: true,
    noBackupOnBlockedPlan: true,
    noUserProjectMutation: true,
    deterministicBlockedDecisionHash: true,
    ...overrides,
  };
  return withCanonicalHash(contract);
}

function blockedResult(blockedReasons, observations = {}) {
  return withCanonicalHash(resultCore({
    outputDecision: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_BRIEF_002A_BLOCKED',
    nextContourRecommendation: null,
    ownerMayOpen002B: false,
    source001ZAccepted: false,
    contractBrief: null,
    failureContract: null,
    exitPacket: {
      contractFieldsCount: 0,
      inheritedChainVerified: false,
      forbiddenClaimsBlocked: true,
      writeEffectsCount: 0,
      nextContour: null,
    },
    blockedReasons: uniqueReasons(blockedReasons),
    decisions: [],
    ...observations,
  }));
}

function acceptedResult(input) {
  const contractBrief = buildContractBrief(input.contractBriefOverrides);
  const failureContract = buildFailureContract(input.failureContractOverrides);
  const decisionCore = {
    decisionKind: DECISION_KIND,
    outputDecision: 'OWNER_MAY_OPEN_PRIVATE_CONTRACT_SHAPE_002B_NO_PUBLIC_RUNTIME_ADMITTED',
    nextContourRecommendation: TARGET_CONTOUR,
    ownerMayOpen002B: true,
    contractBriefOnly: true,
    noPortImplementation: true,
    noStoragePort: true,
    noWritePort: true,
    writeEffectsCount: 0,
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
    ownerMayOpen002B: true,
    source001ZAccepted: true,
    source001ZResultHash: input.source001ZResultHash,
    source001ZDecisionHash: input.source001ZDecisionHash,
    contractBrief,
    contractBriefHash: contractBrief.canonicalHash,
    failureContract,
    failureContractHash: failureContract.canonicalHash,
    exitPacket: {
      contractFieldsCount: TRUE_BRIEF_FIELDS.length + FALSE_BRIEF_FIELDS.length + 2,
      inheritedChainVerified: true,
      forbiddenClaimsBlocked: true,
      writeEffectsCount: 0,
      nextContour: TARGET_CONTOUR,
    },
    blockedReasons: [],
    decisions: [decision],
  }));
}

function validateForbiddenClaims(value, reasons) {
  if (!isObject(value)) {
    return;
  }
  if (value.noPortImplementation === false || value.noStoragePort === false || value.noWritePort === false) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_BRIEF_REASON_CODES.PORT_IMPLEMENTATION_FORBIDDEN);
  }
  if (value.portImplemented === true || value.storagePortImplemented === true || value.writePortImplemented === true) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_BRIEF_REASON_CODES.PORT_IMPLEMENTATION_FORBIDDEN);
  }
  if (value.productApplyRuntimeAdmitted === true || value.publicRuntimeAdmitted === true) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_BRIEF_REASON_CODES.PRODUCT_RUNTIME_FORBIDDEN);
  }
  if (value.publicAdapterImplementationAdmitted === true) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_BRIEF_REASON_CODES.PUBLIC_ADAPTER_IMPLEMENTATION_FORBIDDEN);
  }
  if (value.runtimeWiringAdmitted === true) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_BRIEF_REASON_CODES.RUNTIME_WIRING_FORBIDDEN);
  }
  if (value.applyExecutionRequested === true || value.applyExecutionImplemented === true || value.privateExactTextApplyWithReceiptExecuted === true) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_BRIEF_REASON_CODES.APPLY_EXECUTION_FORBIDDEN);
  }
  if (
    value.publicSurfaceClaimed === true
    || value.ipcSurfaceClaimed === true
    || value.preloadExportClaimed === true
    || value.menuSurfaceClaimed === true
    || value.commandSurfaceClaimed === true
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_BRIEF_REASON_CODES.PUBLIC_COMMAND_SURFACE_FORBIDDEN);
  }
  if (value.uiChanged === true || value.docxImportClaimed === true || value.networkUsed === true || value.dependencyChanged === true) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_BRIEF_REASON_CODES.UI_DOCX_NETWORK_DEPENDENCY_FORBIDDEN);
  }
  if (
    value.applyTxnImplemented === true
    || value.recoveryClaimed === true
    || value.startupRecoveryClaimed === true
    || value.releaseClaimed === true
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_BRIEF_REASON_CODES.APPLYTXN_RECOVERY_RELEASE_FORBIDDEN);
  }
  if (value.userProjectMutated === true || value.realUserProjectPathTouched === true) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_BRIEF_REASON_CODES.USER_PROJECT_MUTATION_FORBIDDEN);
  }
}

function validateContractBriefFields(input, reasons) {
  if (input.contractBriefOverrides !== undefined && !isObject(input.contractBriefOverrides)) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_BRIEF_REASON_CODES.CONTRACT_UNKNOWN_FIELD_FORBIDDEN);
  }
  if (isObject(input.contractBriefOverrides)) {
    for (const field of Object.keys(input.contractBriefOverrides)) {
      if (!CONTRACT_BRIEF_ALLOWED_FIELDS.has(field)) {
        reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_BRIEF_REASON_CODES.CONTRACT_UNKNOWN_FIELD_FORBIDDEN);
      }
    }
  }
  const brief = buildContractBrief(input.contractBriefOverrides);
  validateForbiddenClaims(brief, reasons);
  if (brief.briefKind !== BRIEF_KIND) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_BRIEF_REASON_CODES.CONTRACT_FIELD_MISSING);
  }
  for (const field of TRUE_BRIEF_FIELDS) {
    if (brief[field] !== true) {
      reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_BRIEF_REASON_CODES.CONTRACT_FIELD_MISSING);
    }
  }
  for (const field of FALSE_BRIEF_FIELDS) {
    if (brief[field] !== false) {
      validateForbiddenClaims(brief, reasons);
      reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_BRIEF_REASON_CODES.CONTRACT_FIELD_MISSING);
    }
  }
}

function validateFailureContractFields(input, reasons) {
  if (input.failureContractOverrides !== undefined && !isObject(input.failureContractOverrides)) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_BRIEF_REASON_CODES.FAILURE_CONTRACT_UNKNOWN_FIELD_FORBIDDEN);
  }
  if (isObject(input.failureContractOverrides)) {
    for (const field of Object.keys(input.failureContractOverrides)) {
      if (!FAILURE_CONTRACT_ALLOWED_FIELDS.has(field)) {
        reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_BRIEF_REASON_CODES.FAILURE_CONTRACT_UNKNOWN_FIELD_FORBIDDEN);
      }
    }
  }
  const failureContract = buildFailureContract(input.failureContractOverrides);
  for (const field of FAILURE_CONTRACT_FIELDS) {
    if (!(field in failureContract)) {
      reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_BRIEF_REASON_CODES.FAILURE_CONTRACT_FIELD_MISSING);
    }
  }
  if (!Array.isArray(failureContract.blockedReasonCodes) || failureContract.blockedReasonCodes.length === 0) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_BRIEF_REASON_CODES.FAILURE_CONTRACT_FIELD_MISSING);
  }
  if (
    failureContract.zeroWriteEffects !== true
    || failureContract.noReceiptOnBlockedPlan !== true
    || failureContract.noBackupOnBlockedPlan !== true
    || failureContract.noUserProjectMutation !== true
    || failureContract.deterministicBlockedDecisionHash !== true
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_BRIEF_REASON_CODES.FAILURE_CONTRACT_FIELD_MISSING);
  }
}

function validate001ZDecision(source001Z, input, reasons) {
  const decisions = Array.isArray(source001Z.decisions) ? source001Z.decisions : [];
  const decision = decisions[0] || null;
  if (decisions.length !== 1 || !isObject(decision)) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_BRIEF_REASON_CODES.SOURCE_001Z_DECISION_MALFORMED);
    return;
  }
  if (
    decision.decisionKind !== SOURCE_001Z_DECISION_KIND
    || decision.outputDecision !== source001Z.outputDecision
    || decision.nextContourRecommendation !== source001Z.nextContourRecommendation
    || decision.ownerMayOpen002A !== true
    || decision.contractBriefOnly !== true
    || decision.publicRuntimeAdmitted !== false
    || decision.productApplyRuntimeAdmitted !== false
    || decision.publicAdapterImplementationAdmitted !== false
    || decision.runtimeWiringAdmitted !== false
    || decision.applyExecutionImplemented !== false
    || decision.applyTxnImplemented !== false
    || decision.recoveryClaimed !== false
    || decision.userProjectMutated !== false
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_BRIEF_REASON_CODES.SOURCE_001Z_DECISION_MALFORMED);
  }
  if (
    !hasText(decision.canonicalHash)
    || decision.canonicalHash !== canonicalHash(withoutHash(decision))
    || decision.canonicalHash !== input.source001ZDecisionHash
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_BRIEF_REASON_CODES.SOURCE_001Z_DECISION_MISMATCH);
  }
}

function validateSource001Z(input, reasons) {
  const source001Z = input.source001ZResult;
  if (!isObject(source001Z)) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_BRIEF_REASON_CODES.SOURCE_001Z_RESULT_REQUIRED);
    return;
  }
  if (
    source001Z.resultKind !== SOURCE_001Z_RESULT_KIND
    || source001Z.outputDecision !== 'OWNER_MAY_OPEN_PRIVATE_CONTRACT_BRIEF_002A_NO_PUBLIC_RUNTIME_ADMITTED'
    || source001Z.nextContourRecommendation !== 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_BRIEF_002A'
    || source001Z.ownerMayOpen002A !== true
    || source001Z.contractBriefOnly !== true
    || source001Z.blockedReasons?.length
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_BRIEF_REASON_CODES.SOURCE_001Z_BLOCKED);
  }
  if (Object.entries(FALSE_FLAGS).some(([field, expected]) => source001Z[field] !== expected)) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_BRIEF_REASON_CODES.SOURCE_001Z_RUNTIME_FLAG_FORBIDDEN);
  }
  if (
    !hasText(source001Z.canonicalHash)
    || source001Z.canonicalHash !== canonicalHash(withoutHash(source001Z))
    || source001Z.canonicalHash !== input.source001ZResultHash
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_BRIEF_REASON_CODES.SOURCE_001Z_RESULT_MISMATCH);
  }
  validate001ZDecision(source001Z, input, reasons);
}

function validateInheritedChain(input, reasons) {
  const rerun = runExactTextApplyWithReceiptNextContourAdmission({
    source001YResult: input.source001YResult,
    source001YResultHash: input.source001ZResult?.source001YResultHash,
    source001YDecisionHash: input.source001ZResult?.source001YDecisionHash,
    source001XResult: input.source001XResult,
    source001WResult: input.source001WResult,
    source001VResult: input.source001VResult,
    source001UResult: input.source001UResult,
    ownerAdmissionPacket001Z: input.ownerAdmissionPacket001Z,
  });
  if (
    rerun.outputDecision !== 'OWNER_MAY_OPEN_PRIVATE_CONTRACT_BRIEF_002A_NO_PUBLIC_RUNTIME_ADMITTED'
    || rerun.canonicalHash !== input.source001ZResultHash
    || rerun.decisions?.[0]?.canonicalHash !== input.source001ZDecisionHash
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_BRIEF_REASON_CODES.INHERITED_CHAIN_REVALIDATION_FAILED);
  }
}

function validateOwnerPacket(input, reasons) {
  const packet = input.ownerBriefPacket002A;
  if (!isObject(packet)) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_BRIEF_REASON_CODES.OWNER_PACKET_REQUIRED);
    return;
  }
  if (packet.packetKind !== OWNER_PACKET_KIND) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_BRIEF_REASON_CODES.OWNER_PACKET_INVALID);
  }
  if (packet.targetContour !== TARGET_CONTOUR) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_BRIEF_REASON_CODES.OWNER_PACKET_TARGET_MISMATCH);
  }
  if (packet.bindingHeadSha !== BINDING_HEAD_SHA) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_BRIEF_REASON_CODES.OWNER_PACKET_BINDING_MISMATCH);
  }
  if (OWNER_REQUIRED_TRUE_FIELDS.some((field) => packet[field] !== true)) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_BRIEF_REASON_CODES.OWNER_CONTRACT_POLICY_MISSING);
  }
  validateForbiddenClaims(packet, reasons);
}

export function runExactTextApplyWithReceiptPrivateContractBrief(input = {}) {
  const reasons = [];
  validateForbiddenClaims(input, reasons);
  validateSource001Z(input, reasons);
  validateInheritedChain(input, reasons);
  validateOwnerPacket(input, reasons);
  validateContractBriefFields(input, reasons);
  validateFailureContractFields(input, reasons);
  if (reasons.length > 0) {
    return blockedResult(reasons, {
      source001ZResultHash: input.source001ZResultHash || input.source001ZResult?.canonicalHash || null,
      source001ZDecisionHash: input.source001ZDecisionHash || null,
    });
  }
  return acceptedResult(input);
}

import { canonicalHash } from './reviewIrKernel.mjs';
import { runExactTextApplyWithReceiptPrivateContractShape } from './exactTextApplyWithReceiptPrivateContractShape.mjs';

const RESULT_KIND = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_ADMISSION_RESULT_002C';
const DECISION_KIND = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_ADMISSION_DECISION_002C';
const SOURCE_002B_RESULT_KIND = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_SHAPE_RESULT_002B';
const SOURCE_002B_DECISION_KIND = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_SHAPE_DECISION_002B';
const SOURCE_002B_SHAPE_KIND = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_CONTRACT_SHAPE_V1_002B';
const OWNER_PACKET_KIND = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_ADMISSION_OWNER_PACKET_002C';
const TARGET_CONTOUR = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_ADMISSION_002C';
const NEXT_CONTOUR = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_IMPLEMENTATION_002D';
const BINDING_HEAD_SHA = 'be80bd7bdf02030db6b56f2eeaf40dd470b4ab19';

export const EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_ADMISSION_REASON_CODES = Object.freeze({
  SOURCE_002B_RESULT_REQUIRED: 'SOURCE_002B_RESULT_REQUIRED',
  SOURCE_002B_RESULT_MISMATCH: 'SOURCE_002B_RESULT_MISMATCH',
  SOURCE_002B_DECISION_MISMATCH: 'SOURCE_002B_DECISION_MISMATCH',
  SOURCE_002B_CONTRACT_SHAPE_MISMATCH: 'SOURCE_002B_CONTRACT_SHAPE_MISMATCH',
  SOURCE_002B_BLOCKED: 'SOURCE_002B_BLOCKED',
  SOURCE_002B_DECISION_MALFORMED: 'SOURCE_002B_DECISION_MALFORMED',
  SOURCE_002B_CONTRACT_SHAPE_MALFORMED: 'SOURCE_002B_CONTRACT_SHAPE_MALFORMED',
  INHERITED_CHAIN_REVALIDATION_FAILED: 'INHERITED_CHAIN_REVALIDATION_FAILED',
  OWNER_PACKET_REQUIRED: 'OWNER_PACKET_REQUIRED',
  OWNER_PACKET_INVALID: 'OWNER_PACKET_INVALID',
  OWNER_PACKET_BINDING_MISMATCH: 'OWNER_PACKET_BINDING_MISMATCH',
  OWNER_PACKET_TARGET_MISMATCH: 'OWNER_PACKET_TARGET_MISMATCH',
  OWNER_PACKET_UNKNOWN_FIELD_FORBIDDEN: 'OWNER_PACKET_UNKNOWN_FIELD_FORBIDDEN',
  OWNER_PORT_ADMISSION_POLICY_MISSING: 'OWNER_PORT_ADMISSION_POLICY_MISSING',
  CALLABLE_FIELD_FORBIDDEN: 'CALLABLE_FIELD_FORBIDDEN',
  USER_PROJECT_PATH_FORBIDDEN: 'USER_PROJECT_PATH_FORBIDDEN',
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
  portImplementationAdmitted: false,
  storagePortAdmitted: false,
  writePortAdmitted: false,
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
  publicAdapterImplementationAdmitted: false,
  runtimeWiringAdmitted: false,
  applyExecutionImplemented: false,
  userProjectMutated: false,
});

const OWNER_REQUIRED_TRUE_FIELDS = [
  'ownerApprovedPrivatePortAdmission',
  'ownerUnderstandsAdmissionOnly',
  'ownerUnderstandsOwnerPacketNecessaryButInsufficient',
  'ownerUnderstandsNoPortImplementation',
  'ownerUnderstandsNoStorageWrite',
  'ownerUnderstandsNoPublicRuntime',
  'ownerUnderstandsNoCommandSurface',
  'ownerUnderstandsNoUi',
  'ownerUnderstandsNoDocxParser',
  'ownerUnderstandsNoNetwork',
  'ownerUnderstandsNoDependencyChange',
  'ownerUnderstandsNoUserProjectPath',
  'ownerUnderstandsNoReleaseClaim',
  'ownerUnderstands002DWillNeedSeparateDelivery',
  'ownerPacketAuthorizesOnlyOpening002D',
];

const OWNER_ALLOWED_FIELDS = Object.freeze(new Set([
  'packetKind',
  'targetContour',
  'bindingHeadSha',
  ...OWNER_REQUIRED_TRUE_FIELDS,
]));

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
    contourId: TARGET_CONTOUR,
    privatePortAdmissionOnly: true,
    privateInternalOnly: true,
    exactTextOnly: true,
    singleSceneOnly: true,
    noPortImplementation: true,
    noStoragePort: true,
    noWritePort: true,
    zeroWriteEffects: true,
    writeEffectsCount: 0,
    ...FALSE_FLAGS,
    ...input,
  };
}

function blockedResult(blockedReasons, observations = {}) {
  return withCanonicalHash(resultCore({
    outputDecision: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_ADMISSION_002C_BLOCKED',
    nextContourRecommendation: null,
    ownerMayOpen002D: false,
    source002BAccepted: false,
    ownerPortAdmissionAccepted: false,
    exitPacket: {
      inheritedChainVerified: false,
      source002BRehashed: false,
      source002BDecisionRehashed: false,
      source002BContractShapeRehashed: false,
      privatePortAdmissionOnly: true,
      forbiddenClaimsBlocked: true,
      noUserProjectMutation: true,
      writeEffectsCount: 0,
      nextContour: null,
    },
    blockedReasons: uniqueReasons(blockedReasons),
    decisions: [],
    ...observations,
  }));
}

function acceptedResult(input) {
  const source002B = input.source002BResult;
  const decisionCore = {
    decisionKind: DECISION_KIND,
    outputDecision: 'OWNER_MAY_OPEN_PRIVATE_PORT_IMPLEMENTATION_002D_NO_PUBLIC_RUNTIME_ADMITTED',
    nextContourRecommendation: NEXT_CONTOUR,
    ownerMayOpen002D: true,
    privatePortAdmissionOnly: true,
    noPortImplementation: true,
    noStoragePort: true,
    noWritePort: true,
    zeroWriteEffects: true,
    writeEffectsCount: 0,
    portImplementationAdmitted: false,
    storagePortAdmitted: false,
    writePortAdmitted: false,
    publicRuntimeAdmitted: false,
    productApplyRuntimeAdmitted: false,
    publicAdapterImplementationAdmitted: false,
    runtimeWiringAdmitted: false,
    applyExecutionImplemented: false,
    userProjectMutated: false,
  };
  const decision = withCanonicalHash(decisionCore);
  return withCanonicalHash(resultCore({
    outputDecision: decision.outputDecision,
    nextContourRecommendation: decision.nextContourRecommendation,
    ownerMayOpen002D: true,
    source002BAccepted: true,
    ownerPortAdmissionAccepted: true,
    source002BResultHash: input.source002BResultHash,
    source002BDecisionHash: input.source002BDecisionHash,
    source002BContractShapeHash: input.source002BContractShapeHash,
    contractShapeHash: source002B.contractShapeHash,
    exitPacket: {
      inheritedChainVerified: true,
      source002BRehashed: true,
      source002BDecisionRehashed: true,
      source002BContractShapeRehashed: true,
      privatePortAdmissionOnly: true,
      forbiddenClaimsBlocked: true,
      noUserProjectMutation: true,
      writeEffectsCount: 0,
      nextContour: NEXT_CONTOUR,
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
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_ADMISSION_REASON_CODES.PORT_IMPLEMENTATION_FORBIDDEN);
  }
  if (value.portImplemented === true || value.storagePortImplemented === true || value.writePortImplemented === true) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_ADMISSION_REASON_CODES.PORT_IMPLEMENTATION_FORBIDDEN);
  }
  if (
    value.portImplementationAdmitted === true
    || value.storagePortAdmitted === true
    || value.writePortAdmitted === true
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_ADMISSION_REASON_CODES.PORT_IMPLEMENTATION_FORBIDDEN);
  }
  if (value.productApplyRuntimeAdmitted === true || value.publicRuntimeAdmitted === true) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_ADMISSION_REASON_CODES.PRODUCT_RUNTIME_FORBIDDEN);
  }
  if (value.publicAdapterImplementationAdmitted === true) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_ADMISSION_REASON_CODES.PUBLIC_ADAPTER_IMPLEMENTATION_FORBIDDEN);
  }
  if (value.runtimeWiringAdmitted === true) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_ADMISSION_REASON_CODES.RUNTIME_WIRING_FORBIDDEN);
  }
  if (
    value.applyExecutionRequested === true
    || value.applyExecutionImplemented === true
    || value.privateExactTextApplyWithReceiptExecuted === true
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_ADMISSION_REASON_CODES.APPLY_EXECUTION_FORBIDDEN);
  }
  if (
    value.publicSurfaceClaimed === true
    || value.ipcSurfaceClaimed === true
    || value.preloadExportClaimed === true
    || value.menuSurfaceClaimed === true
    || value.commandSurfaceClaimed === true
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_ADMISSION_REASON_CODES.PUBLIC_COMMAND_SURFACE_FORBIDDEN);
  }
  if (value.uiChanged === true || value.docxImportClaimed === true || value.networkUsed === true || value.dependencyChanged === true) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_ADMISSION_REASON_CODES.UI_DOCX_NETWORK_DEPENDENCY_FORBIDDEN);
  }
  if (
    value.applyTxnImplemented === true
    || value.recoveryClaimed === true
    || value.startupRecoveryClaimed === true
    || value.releaseClaimed === true
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_ADMISSION_REASON_CODES.APPLYTXN_RECOVERY_RELEASE_FORBIDDEN);
  }
  if (value.userProjectMutated === true || value.realUserProjectPathTouched === true) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_ADMISSION_REASON_CODES.USER_PROJECT_MUTATION_FORBIDDEN);
  }
}

function validateNoCallableOrPath(value, reasons) {
  if (typeof value === 'function') {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_ADMISSION_REASON_CODES.CALLABLE_FIELD_FORBIDDEN);
    return;
  }
  if (!isObject(value)) {
    return;
  }
  for (const [field, nested] of Object.entries(value)) {
    if (/(?:^|_)?(?:userProjectPath|realUserProjectPath|projectPath|scenePath|filePath|absolutePath|filesystemPath)$/u.test(field)) {
      reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_ADMISSION_REASON_CODES.USER_PROJECT_PATH_FORBIDDEN);
    }
    if (typeof nested === 'function') {
      reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_ADMISSION_REASON_CODES.CALLABLE_FIELD_FORBIDDEN);
    } else if (isObject(nested)) {
      validateNoCallableOrPath(nested, reasons);
    }
  }
}

function validateSource002BDecision(source002B, input, reasons) {
  const decisions = Array.isArray(source002B.decisions) ? source002B.decisions : [];
  const decision = decisions[0] || null;
  if (decisions.length !== 1 || !isObject(decision)) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_ADMISSION_REASON_CODES.SOURCE_002B_DECISION_MALFORMED);
    return;
  }
  validateForbiddenClaims(decision, reasons);
  if (
    decision.decisionKind !== SOURCE_002B_DECISION_KIND
    || decision.outputDecision !== source002B.outputDecision
    || decision.outputDecision !== 'OWNER_MAY_OPEN_PRIVATE_PORT_ADMISSION_002C_NO_PUBLIC_RUNTIME_ADMITTED'
    || decision.nextContourRecommendation !== TARGET_CONTOUR
    || decision.ownerShapeAccepted !== true
    || decision.source002AAccepted !== true
    || decision.noPortImplementation !== true
    || decision.noStoragePort !== true
    || decision.noWritePort !== true
    || decision.writeEffectsCount !== 0
    || decision.publicRuntimeAdmitted !== false
    || decision.productApplyRuntimeAdmitted !== false
    || decision.publicAdapterImplementationAdmitted !== false
    || decision.runtimeWiringAdmitted !== false
    || decision.applyExecutionImplemented !== false
    || decision.userProjectMutated !== false
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_ADMISSION_REASON_CODES.SOURCE_002B_DECISION_MALFORMED);
  }
  if (
    !hasText(decision.canonicalHash)
    || decision.canonicalHash !== canonicalHash(withoutHash(decision))
    || decision.canonicalHash !== input.source002BDecisionHash
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_ADMISSION_REASON_CODES.SOURCE_002B_DECISION_MISMATCH);
  }
}

function validateSource002BContractShape(source002B, input, reasons) {
  const shape = source002B.contractShape;
  if (
    !isObject(shape)
    || shape.shapeKind !== SOURCE_002B_SHAPE_KIND
    || shape.canonicalHash !== canonicalHash(withoutHash(shape))
    || shape.futurePortCapabilitySchema?.portImplementationAdmitted !== false
    || shape.futurePortCapabilitySchema?.storagePortAdmitted !== false
    || shape.futurePortCapabilitySchema?.writePortAdmitted !== false
    || shape.futurePortCapabilitySchema?.writeEffectsCount !== 0
    || shape.writeEffectsCount !== 0
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_ADMISSION_REASON_CODES.SOURCE_002B_CONTRACT_SHAPE_MALFORMED);
    return;
  }
  if (
    shape.canonicalHash !== source002B.contractShapeHash
    || shape.canonicalHash !== input.source002BContractShapeHash
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_ADMISSION_REASON_CODES.SOURCE_002B_CONTRACT_SHAPE_MISMATCH);
  }
}

function validateSource002B(input, reasons) {
  const source002B = input.source002BResult;
  if (!isObject(source002B)) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_ADMISSION_REASON_CODES.SOURCE_002B_RESULT_REQUIRED);
    return;
  }
  validateForbiddenClaims(source002B, reasons);
  if (
    source002B.resultKind !== SOURCE_002B_RESULT_KIND
    || source002B.outputDecision !== 'OWNER_MAY_OPEN_PRIVATE_PORT_ADMISSION_002C_NO_PUBLIC_RUNTIME_ADMITTED'
    || source002B.nextContourRecommendation !== TARGET_CONTOUR
    || source002B.ownerMayOpen002C !== true
    || source002B.ownerShapeAccepted !== true
    || source002B.source002AAccepted !== true
    || source002B.schemaContractOnly !== true
    || source002B.noPortImplementation !== true
    || source002B.noStoragePort !== true
    || source002B.noWritePort !== true
    || source002B.writeEffectsCount !== 0
    || source002B.exitPacket?.writeEffectsCount !== 0
    || source002B.exitPacket?.inheritedChainVerified !== true
    || source002B.exitPacket?.source002ARehashed !== true
    || source002B.exitPacket?.contractShapeEmitted !== true
    || source002B.blockedReasons?.length
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_ADMISSION_REASON_CODES.SOURCE_002B_BLOCKED);
  }
  if (Object.entries(SOURCE_FALSE_FLAGS).some(([field, expected]) => source002B[field] !== expected)) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_ADMISSION_REASON_CODES.PRODUCT_RUNTIME_FORBIDDEN);
  }
  if (
    !hasText(source002B.canonicalHash)
    || source002B.canonicalHash !== canonicalHash(withoutHash(source002B))
    || source002B.canonicalHash !== input.source002BResultHash
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_ADMISSION_REASON_CODES.SOURCE_002B_RESULT_MISMATCH);
  }
  validateSource002BDecision(source002B, input, reasons);
  validateSource002BContractShape(source002B, input, reasons);
}

function validateInheritedChain(input, reasons) {
  const rerun = runExactTextApplyWithReceiptPrivateContractShape({
    source002AResult: input.source002AResult,
    source002AResultHash: input.source002BResult?.source002AResultHash,
    source002ADecisionHash: input.source002BResult?.source002ADecisionHash,
    source001ZResult: input.source001ZResult,
    source001YResult: input.source001YResult,
    source001XResult: input.source001XResult,
    source001WResult: input.source001WResult,
    source001VResult: input.source001VResult,
    source001UResult: input.source001UResult,
    ownerAdmissionPacket001Z: input.ownerAdmissionPacket001Z,
    ownerBriefPacket002A: input.ownerBriefPacket002A,
    ownerShapePacket002B: input.ownerShapePacket002B,
  });
  if (
    rerun.outputDecision !== 'OWNER_MAY_OPEN_PRIVATE_PORT_ADMISSION_002C_NO_PUBLIC_RUNTIME_ADMITTED'
    || rerun.canonicalHash !== input.source002BResultHash
    || rerun.decisions?.[0]?.canonicalHash !== input.source002BDecisionHash
    || rerun.contractShape?.canonicalHash !== input.source002BContractShapeHash
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_ADMISSION_REASON_CODES.INHERITED_CHAIN_REVALIDATION_FAILED);
  }
}

function validateOwnerPacket(input, reasons) {
  const packet = input.ownerPortAdmissionPacket002C;
  if (!isObject(packet)) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_ADMISSION_REASON_CODES.OWNER_PACKET_REQUIRED);
    return;
  }
  if (packet.packetKind !== OWNER_PACKET_KIND) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_ADMISSION_REASON_CODES.OWNER_PACKET_INVALID);
  }
  if (packet.targetContour !== NEXT_CONTOUR) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_ADMISSION_REASON_CODES.OWNER_PACKET_TARGET_MISMATCH);
  }
  if (packet.bindingHeadSha !== BINDING_HEAD_SHA) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_ADMISSION_REASON_CODES.OWNER_PACKET_BINDING_MISMATCH);
  }
  for (const field of Object.keys(packet)) {
    if (!OWNER_ALLOWED_FIELDS.has(field)) {
      reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_ADMISSION_REASON_CODES.OWNER_PACKET_UNKNOWN_FIELD_FORBIDDEN);
    }
  }
  if (OWNER_REQUIRED_TRUE_FIELDS.some((field) => packet[field] !== true)) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_ADMISSION_REASON_CODES.OWNER_PORT_ADMISSION_POLICY_MISSING);
  }
  validateForbiddenClaims(packet, reasons);
  validateNoCallableOrPath(packet, reasons);
}

export function runExactTextApplyWithReceiptPrivatePortAdmission(input = {}) {
  const reasons = [];
  validateForbiddenClaims(input, reasons);
  validateNoCallableOrPath(input, reasons);
  validateSource002B(input, reasons);
  validateInheritedChain(input, reasons);
  validateOwnerPacket(input, reasons);
  if (reasons.length > 0) {
    return blockedResult(reasons, {
      source002BResultHash: input.source002BResultHash || input.source002BResult?.canonicalHash || null,
      source002BDecisionHash: input.source002BDecisionHash || null,
      source002BContractShapeHash: input.source002BContractShapeHash || input.source002BResult?.contractShapeHash || null,
    });
  }
  return acceptedResult(input);
}

import { canonicalHash } from './reviewIrKernel.mjs';
import { runExactTextApplyWithReceiptPrivatePortCloseoutNextContourPermission } from './exactTextApplyWithReceiptPrivatePortCloseoutNextContourPermission.mjs';

const RESULT_KIND = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_PATH_IMPLEMENTATION_OPENING_ADMISSION_RESULT_002F';
const DECISION_KIND = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_PATH_IMPLEMENTATION_OPENING_ADMISSION_DECISION_002F';
const SOURCE_002E_RESULT_KIND = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_CLOSEOUT_AND_NEXT_CONTOUR_PERMISSION_RESULT_002E';
const SOURCE_002E_DECISION_KIND = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_CLOSEOUT_AND_NEXT_CONTOUR_PERMISSION_DECISION_002E';
const OWNER_PACKET_KIND = 'PRODUCT_PATH_IMPLEMENTATION_OPENING_OWNER_PACKET_002F';
const TARGET_CONTOUR = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_PATH_IMPLEMENTATION_OPENING_ADMISSION_002F';
const SOURCE_002E_CONTOUR = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_CLOSEOUT_AND_NEXT_CONTOUR_PERMISSION_002E';
const NEXT_CONTOUR = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_PATH_IMPLEMENTATION_002G';
const SOURCE_002E_NEXT_CONTOUR = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_PATH_ADMISSION_002F';

export const EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_PATH_OPENING_ADMISSION_REASON_CODES = Object.freeze({
  SOURCE_002E_RESULT_REQUIRED: 'SOURCE_002E_RESULT_REQUIRED',
  SOURCE_002E_RESULT_HASH_MISMATCH: 'SOURCE_002E_RESULT_HASH_MISMATCH',
  SOURCE_002E_DECISION_HASH_MISMATCH: 'SOURCE_002E_DECISION_HASH_MISMATCH',
  SOURCE_002E_CHAIN_HASH_MISMATCH: 'SOURCE_002E_CHAIN_HASH_MISMATCH',
  SOURCE_002E_BLOCKED: 'SOURCE_002E_BLOCKED',
  SOURCE_002E_REVALIDATION_INPUT_REQUIRED: 'SOURCE_002E_REVALIDATION_INPUT_REQUIRED',
  SOURCE_002E_REVALIDATION_FAILED: 'SOURCE_002E_REVALIDATION_FAILED',
  SYNTHETIC_002E_WITHOUT_CHAIN: 'SYNTHETIC_002E_WITHOUT_CHAIN',
  PRODUCT_PATH_ADMISSION_CLAIM_FORBIDDEN: 'PRODUCT_PATH_ADMISSION_CLAIM_FORBIDDEN',
  PRODUCT_PATH_EXECUTION_FORBIDDEN: 'PRODUCT_PATH_EXECUTION_FORBIDDEN',
  PRODUCT_WRITE_FORBIDDEN: 'PRODUCT_WRITE_FORBIDDEN',
  PRODUCT_STORAGE_ADMISSION_FORBIDDEN: 'PRODUCT_STORAGE_ADMISSION_FORBIDDEN',
  PRODUCT_APPLYRECEIPT_CLAIM_FORBIDDEN: 'PRODUCT_APPLYRECEIPT_CLAIM_FORBIDDEN',
  PUBLIC_RUNTIME_FORBIDDEN: 'PUBLIC_RUNTIME_FORBIDDEN',
  PUBLIC_COMMAND_SURFACE_FORBIDDEN: 'PUBLIC_COMMAND_SURFACE_FORBIDDEN',
  UI_DOCX_NETWORK_DEPENDENCY_FORBIDDEN: 'UI_DOCX_NETWORK_DEPENDENCY_FORBIDDEN',
  APPLYTXN_RECOVERY_RELEASE_FORBIDDEN: 'APPLYTXN_RECOVERY_RELEASE_FORBIDDEN',
  OWNER_PACKET_REQUIRED: 'OWNER_PACKET_REQUIRED',
  OWNER_PACKET_INVALID: 'OWNER_PACKET_INVALID',
  OWNER_PACKET_TARGET_MISMATCH: 'OWNER_PACKET_TARGET_MISMATCH',
  OWNER_NEXT_CONTOUR_TARGET_MISMATCH: 'OWNER_NEXT_CONTOUR_TARGET_MISMATCH',
  OWNER_PACKET_UNKNOWN_FIELD_FORBIDDEN: 'OWNER_PACKET_UNKNOWN_FIELD_FORBIDDEN',
  OWNER_POLICY_MISSING: 'OWNER_POLICY_MISSING',
  USER_PROJECT_PATH_FORBIDDEN: 'USER_PROJECT_PATH_FORBIDDEN',
  CALLABLE_FIELD_FORBIDDEN: 'CALLABLE_FIELD_FORBIDDEN',
});

const FALSE_FLAGS = Object.freeze({
  ownerMayOpen002G: false,
  productPathImplementationMayOpen: false,
  productPathAdmitted: false,
  productPathExecuted: false,
  productPathExecutionAdmitted: false,
  productApplyRuntimeAdmitted: false,
  productWriteAdmitted: false,
  productWritePerformed: false,
  productWriteClaimed: false,
  productStorageAdmitted: false,
  productStorageAdmission: false,
  productStorageSafetyClaimed: false,
  productApplyReceiptClaimed: false,
  productApplyReceiptImplemented: false,
  durableReceiptClaimed: false,
  userProjectMutated: false,
  realUserProjectPathTouched: false,
  publicRuntimeAdmitted: false,
  publicAdapterImplementationAdmitted: false,
  runtimeWiringAdmitted: false,
  publicSurfaceClaimed: false,
  ipcSurfaceClaimed: false,
  preloadExportClaimed: false,
  menuSurfaceClaimed: false,
  commandSurfaceClaimed: false,
  uiChanged: false,
  docxImportClaimed: false,
  networkUsed: false,
  dependencyChanged: false,
  applyTxnImplemented: false,
  applyTxnClaimed: false,
  recoveryClaimed: false,
  startupRecoveryClaimed: false,
  crashRecoveryClaimed: false,
  releaseClaimed: false,
  multiSceneApplyClaimed: false,
  structuralApplyClaimed: false,
  commentApplyClaimed: false,
});

const OWNER_REQUIRED_TRUE_FIELDS = [
  'ownerApproves002FCloseout',
  'ownerApprovesOpening002G',
  'ownerUnderstands002FIsPermissionOnly',
  'ownerUnderstandsProductWriteNotAllowedIn002F',
  'ownerUnderstandsProductPathExecutionNotAllowedIn002F',
  'ownerUnderstandsStorageAdmissionNotAllowedIn002F',
  'ownerUnderstandsApplyTxnNotAllowedIn002F',
  'ownerUnderstandsRecoveryAndReleaseNotClaimed',
];

const OWNER_ALLOWED_FIELDS = Object.freeze(new Set([
  'packetKind',
  'targetContour',
  'nextContourTarget',
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
    admissionGateOnly: true,
    permissionOnly: true,
    productPathImplementationOpeningOnly: true,
    noProductPathAdmission: true,
    noProductPathExecution: true,
    noProductWrite: true,
    noStorageAdmission: true,
    noPublicRuntime: true,
    noReleaseClaim: true,
    productWriteCount: 0,
    publicSurfaceCount: 0,
    writeEffectsCount: 0,
    ...FALSE_FLAGS,
    ...input,
  };
}

function blockedResult(blockedReasons, observations = {}) {
  return withCanonicalHash(resultCore({
    outputDecision: 'PRODUCT_PATH_IMPLEMENTATION_REMAINS_BLOCKED',
    nextContourRecommendation: null,
    source002EAccepted: false,
    source002ERehashed: false,
    source002ERevalidated: false,
    source002ERevalidationMatched: false,
    ownerPacketAccepted: false,
    ownerMayOpen002G: false,
    productPathImplementationMayOpen: false,
    blockedReasons: uniqueReasons(blockedReasons),
    decisions: [],
    exitPacket: {
      source002ERehashed: false,
      source002EDecisionRehashed: false,
      source002EChainHashReconfirmed: false,
      source002ERevalidated: false,
      source002ERevalidationMatched: false,
      ownerPacketAccepted: false,
      ownerMayOpen002G: false,
      productPathImplementationMayOpen: false,
      productPathAdmitted: false,
      productPathExecuted: false,
      productWriteCount: 0,
      publicSurfaceCount: 0,
      writeEffectsCount: 0,
      nextContour: null,
    },
    ...observations,
  }));
}

function acceptedResult(input) {
  const decisionCore = {
    decisionKind: DECISION_KIND,
    outputDecision: 'OWNER_MAY_OPEN_PRODUCT_PATH_IMPLEMENTATION_002G_ONLY',
    nextContourRecommendation: NEXT_CONTOUR,
    ownerMayOpen002G: true,
    productPathImplementationMayOpen: true,
    productPathAdmitted: false,
    productPathExecuted: false,
    productPathExecutionAdmitted: false,
    productWriteAdmitted: false,
    productWritePerformed: false,
    productStorageAdmitted: false,
    productStorageAdmission: false,
    productApplyReceiptImplemented: false,
    applyTxnImplemented: false,
    recoveryClaimed: false,
    releaseClaimed: false,
    publicRuntimeAdmitted: false,
    userProjectMutated: false,
    productWriteCount: 0,
    publicSurfaceCount: 0,
    writeEffectsCount: 0,
  };
  const decision = withCanonicalHash(decisionCore);
  return withCanonicalHash(resultCore({
    outputDecision: decision.outputDecision,
    nextContourRecommendation: NEXT_CONTOUR,
    source002EAccepted: true,
    source002ERehashed: true,
    source002EDecisionRehashed: true,
    source002EChainHashReconfirmed: true,
    source002ERevalidated: true,
    source002ERevalidationMatched: true,
    ownerPacketAccepted: true,
    ownerMayOpen002G: true,
    productPathImplementationMayOpen: true,
    source002EResultHash: input.source002EResultHash,
    source002EDecisionHash: input.source002EDecisionHash,
    source002DReceiptHashFrom002E: input.source002DReceiptHashFrom002E,
    productPathAdmitted: false,
    productPathExecuted: false,
    productPathExecutionAdmitted: false,
    productWriteAdmitted: false,
    productWritePerformed: false,
    productWriteClaimed: false,
    productStorageAdmitted: false,
    productStorageAdmission: false,
    productStorageSafetyClaimed: false,
    productApplyReceiptClaimed: false,
    productApplyReceiptImplemented: false,
    durableReceiptClaimed: false,
    publicRuntimeAdmitted: false,
    publicSurfaceClaimed: false,
    userProjectMutated: false,
    applyTxnImplemented: false,
    recoveryClaimed: false,
    releaseClaimed: false,
    productWriteCount: 0,
    publicSurfaceCount: 0,
    writeEffectsCount: 0,
    blockedReasons: [],
    decisions: [decision],
    exitPacket: {
      source002ERehashed: true,
      source002EDecisionRehashed: true,
      source002EChainHashReconfirmed: true,
      source002ERevalidated: true,
      source002ERevalidationMatched: true,
      ownerPacketAccepted: true,
      ownerMayOpen002G: true,
      productPathImplementationMayOpen: true,
      productPathAdmitted: false,
      productPathExecuted: false,
      productWriteCount: 0,
      publicSurfaceCount: 0,
      writeEffectsCount: 0,
      nextContour: NEXT_CONTOUR,
    },
  }));
}

function pushForbiddenClaimReasons(value, reasons) {
  if (!isObject(value)) {
    return;
  }
  if (value.productPathAdmitted === true) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_PATH_OPENING_ADMISSION_REASON_CODES.PRODUCT_PATH_ADMISSION_CLAIM_FORBIDDEN);
  }
  if (value.productPathExecuted === true || value.productPathExecutionAdmitted === true) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_PATH_OPENING_ADMISSION_REASON_CODES.PRODUCT_PATH_EXECUTION_FORBIDDEN);
  }
  if (
    value.productWritePerformed === true
    || value.productWriteClaimed === true
    || value.productWriteAdmitted === true
    || value.userProjectMutated === true
    || value.realUserProjectPathTouched === true
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_PATH_OPENING_ADMISSION_REASON_CODES.PRODUCT_WRITE_FORBIDDEN);
  }
  if (value.productStorageAdmitted === true || value.productStorageAdmission === true || value.productStorageSafetyClaimed === true) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_PATH_OPENING_ADMISSION_REASON_CODES.PRODUCT_STORAGE_ADMISSION_FORBIDDEN);
  }
  if (
    value.productApplyReceiptClaimed === true
    || value.productApplyReceiptImplemented === true
    || value.durableReceiptClaimed === true
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_PATH_OPENING_ADMISSION_REASON_CODES.PRODUCT_APPLYRECEIPT_CLAIM_FORBIDDEN);
  }
  if (
    value.publicRuntimeAdmitted === true
    || value.productApplyRuntimeAdmitted === true
    || value.publicAdapterImplementationAdmitted === true
    || value.runtimeWiringAdmitted === true
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_PATH_OPENING_ADMISSION_REASON_CODES.PUBLIC_RUNTIME_FORBIDDEN);
  }
  if (
    value.publicSurfaceClaimed === true
    || value.ipcSurfaceClaimed === true
    || value.preloadExportClaimed === true
    || value.menuSurfaceClaimed === true
    || value.commandSurfaceClaimed === true
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_PATH_OPENING_ADMISSION_REASON_CODES.PUBLIC_COMMAND_SURFACE_FORBIDDEN);
  }
  if (value.uiChanged === true || value.docxImportClaimed === true || value.networkUsed === true || value.dependencyChanged === true) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_PATH_OPENING_ADMISSION_REASON_CODES.UI_DOCX_NETWORK_DEPENDENCY_FORBIDDEN);
  }
  if (
    value.applyTxnImplemented === true
    || value.applyTxnClaimed === true
    || value.recoveryClaimed === true
    || value.startupRecoveryClaimed === true
    || value.crashRecoveryClaimed === true
    || value.releaseClaimed === true
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_PATH_OPENING_ADMISSION_REASON_CODES.APPLYTXN_RECOVERY_RELEASE_FORBIDDEN);
  }
}

function validateNoCallableOrUserPath(value, reasons) {
  if (typeof value === 'function') {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_PATH_OPENING_ADMISSION_REASON_CODES.CALLABLE_FIELD_FORBIDDEN);
    return;
  }
  if (!isObject(value)) {
    return;
  }
  for (const [field, nested] of Object.entries(value)) {
    if (field === 'source002ERevalidationInput') {
      continue;
    }
    if (/(?:^|_)?(?:userProjectPath|realUserProjectPath|productRoot|projectPath|scenePath|filePath|absolutePath|filesystemPath)$/u.test(field)) {
      reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_PATH_OPENING_ADMISSION_REASON_CODES.USER_PROJECT_PATH_FORBIDDEN);
    }
    if (typeof nested === 'function') {
      reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_PATH_OPENING_ADMISSION_REASON_CODES.CALLABLE_FIELD_FORBIDDEN);
    } else if (isObject(nested)) {
      validateNoCallableOrUserPath(nested, reasons);
    }
  }
}

function validateSource002E(input, reasons) {
  const source = input.source002EResult;
  if (!isObject(source)) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_PATH_OPENING_ADMISSION_REASON_CODES.SOURCE_002E_RESULT_REQUIRED);
    return;
  }
  pushForbiddenClaimReasons(source, reasons);
  const decision = Array.isArray(source.decisions) ? source.decisions[0] : null;
  pushForbiddenClaimReasons(decision, reasons);

  if (
    source.resultKind !== SOURCE_002E_RESULT_KIND
    || source.contourId !== SOURCE_002E_CONTOUR
    || source.outputDecision !== 'OWNER_MAY_OPEN_002F_ONLY_NO_PRODUCT_PATH_ADMITTED'
    || source.nextContourRecommendation !== SOURCE_002E_NEXT_CONTOUR
    || source.closeoutOnly !== true
    || source.nextContourPermissionOnly !== true
    || source.source002DAccepted !== true
    || source.source002DRevalidated !== true
    || source.ownerPermissionPacketAccepted !== true
    || source.source002DFixtureReceiptVerified !== true
    || source.ownerMayOpenNextContour !== true
    || source.fixtureReceiptIsNotProductApplyReceipt !== true
    || source.productPathAdmitted !== false
    || source.productPathExecuted !== false
    || source.productPathExecutionAdmitted !== false
    || source.productWritePerformed !== false
    || source.productStorageAdmission !== false
    || source.productApplyReceiptImplemented !== false
    || source.publicRuntimeAdmitted !== false
    || source.userProjectMutated !== false
    || source.applyTxnImplemented !== false
    || source.recoveryClaimed !== false
    || source.releaseClaimed !== false
    || source.productWriteCount !== 0
    || source.publicSurfaceCount !== 0
    || source.writeEffectsCount !== 0
    || source.blockedReasons?.length
    || !isObject(decision)
    || decision.decisionKind !== SOURCE_002E_DECISION_KIND
    || decision.outputDecision !== source.outputDecision
    || decision.nextContourRecommendation !== SOURCE_002E_NEXT_CONTOUR
    || decision.ownerMayOpenNextContour !== true
    || decision.productPathAdmitted !== false
    || decision.productPathExecuted !== false
    || decision.productWritePerformed !== false
    || decision.productStorageAdmission !== false
    || decision.productApplyReceiptClaimed !== false
    || decision.publicRuntimeAdmitted !== false
    || decision.userProjectMutated !== false
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_PATH_OPENING_ADMISSION_REASON_CODES.SOURCE_002E_BLOCKED);
  }

  if (
    source.source002DRevalidated !== true
    || source.source002DFixtureReceiptVerified !== true
    || !hasText(source.source002DResultHash)
    || !hasText(source.source002DDecisionHash)
    || !hasText(source.source002DReceiptHash)
    || source.source002DReceiptHash !== input.source002DReceiptHashFrom002E
    || source.exitPacket?.source002DRevalidated !== true
    || source.exitPacket?.source002DReceiptRehashed !== true
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_PATH_OPENING_ADMISSION_REASON_CODES.SYNTHETIC_002E_WITHOUT_CHAIN);
  }

  if (
    !hasText(source.canonicalHash)
    || source.canonicalHash !== canonicalHash(withoutHash(source))
    || source.canonicalHash !== input.source002EResultHash
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_PATH_OPENING_ADMISSION_REASON_CODES.SOURCE_002E_RESULT_HASH_MISMATCH);
  }
  if (
    !hasText(decision?.canonicalHash)
    || decision.canonicalHash !== canonicalHash(withoutHash(decision))
    || decision.canonicalHash !== input.source002EDecisionHash
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_PATH_OPENING_ADMISSION_REASON_CODES.SOURCE_002E_DECISION_HASH_MISMATCH);
  }
  if (
    source.source002DReceiptHash !== input.source002DReceiptHashFrom002E
    || source.exitPacket?.source002DReceiptRehashed !== true
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_PATH_OPENING_ADMISSION_REASON_CODES.SOURCE_002E_CHAIN_HASH_MISMATCH);
  }
}

function validateSource002ERevalidation(input, reasons) {
  if (!isObject(input.source002ERevalidationInput)) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_PATH_OPENING_ADMISSION_REASON_CODES.SOURCE_002E_REVALIDATION_INPUT_REQUIRED);
    return;
  }
  const rerun = runExactTextApplyWithReceiptPrivatePortCloseoutNextContourPermission(input.source002ERevalidationInput);
  if (
    rerun.outputDecision !== 'OWNER_MAY_OPEN_002F_ONLY_NO_PRODUCT_PATH_ADMITTED'
    || rerun.canonicalHash !== input.source002EResultHash
    || rerun.decisions?.[0]?.canonicalHash !== input.source002EDecisionHash
    || rerun.source002DReceiptHash !== input.source002DReceiptHashFrom002E
    || rerun.exitPacket?.source002DReceiptRehashed !== true
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_PATH_OPENING_ADMISSION_REASON_CODES.SOURCE_002E_REVALIDATION_FAILED);
  }
}

function validateOwnerPacket(input, reasons) {
  const packet = input.ownerProductPathImplementationOpeningPacket002F;
  if (!isObject(packet)) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_PATH_OPENING_ADMISSION_REASON_CODES.OWNER_PACKET_REQUIRED);
    return;
  }
  if (packet.packetKind !== OWNER_PACKET_KIND) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_PATH_OPENING_ADMISSION_REASON_CODES.OWNER_PACKET_INVALID);
  }
  if (packet.targetContour !== TARGET_CONTOUR) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_PATH_OPENING_ADMISSION_REASON_CODES.OWNER_PACKET_TARGET_MISMATCH);
  }
  if (packet.nextContourTarget !== NEXT_CONTOUR) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_PATH_OPENING_ADMISSION_REASON_CODES.OWNER_NEXT_CONTOUR_TARGET_MISMATCH);
  }
  for (const field of Object.keys(packet)) {
    if (!OWNER_ALLOWED_FIELDS.has(field)) {
      reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_PATH_OPENING_ADMISSION_REASON_CODES.OWNER_PACKET_UNKNOWN_FIELD_FORBIDDEN);
    }
  }
  if (OWNER_REQUIRED_TRUE_FIELDS.some((field) => packet[field] !== true)) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_PATH_OPENING_ADMISSION_REASON_CODES.OWNER_POLICY_MISSING);
  }
  pushForbiddenClaimReasons(packet, reasons);
  validateNoCallableOrUserPath(packet, reasons);
}

export function runExactTextApplyWithReceiptProductPathImplementationOpeningAdmission(input = {}) {
  const reasons = [];
  pushForbiddenClaimReasons(input, reasons);
  validateNoCallableOrUserPath(input, reasons);
  validateSource002E(input, reasons);
  validateSource002ERevalidation(input, reasons);
  validateOwnerPacket(input, reasons);
  if (reasons.length > 0) {
    return blockedResult(reasons, {
      source002EResultHash: input.source002EResultHash || input.source002EResult?.canonicalHash || null,
      source002EDecisionHash: input.source002EDecisionHash || input.source002EResult?.decisions?.[0]?.canonicalHash || null,
      source002DReceiptHashFrom002E: input.source002DReceiptHashFrom002E || input.source002EResult?.source002DReceiptHash || null,
    });
  }
  return acceptedResult(input);
}

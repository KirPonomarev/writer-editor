import { canonicalHash } from './reviewIrKernel.mjs';
import { runExactTextApplyWithReceiptPrivatePortImplementation } from './exactTextApplyWithReceiptPrivatePortImplementation.mjs';

const RESULT_KIND = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_CLOSEOUT_AND_NEXT_CONTOUR_PERMISSION_RESULT_002E';
const DECISION_KIND = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_CLOSEOUT_AND_NEXT_CONTOUR_PERMISSION_DECISION_002E';
const SOURCE_002D_RESULT_KIND = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_IMPLEMENTATION_RESULT_002D';
const SOURCE_002D_DECISION_KIND = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_IMPLEMENTATION_DECISION_002D';
const SOURCE_002D_RECEIPT_KIND = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_FIXTURE_RECEIPT_V1_002D';
const OWNER_PACKET_KIND = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_CLOSEOUT_AND_NEXT_CONTOUR_PERMISSION_OWNER_PACKET_002E';
const TARGET_CONTOUR = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_CLOSEOUT_AND_NEXT_CONTOUR_PERMISSION_002E';
const NEXT_CONTOUR = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_PATH_ADMISSION_002F';
const SOURCE_002D_CONTOUR = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_IMPLEMENTATION_002D';
const SOURCE_002D_HISTORICAL_NEXT_CONTOUR = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_CLOSEOUT_AND_PRODUCT_ADMISSION_002E';
const BINDING_HEAD_SHA = 'fbe8245c874a19bc7a10360fae23d9e140c7e480';

export const EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_CLOSEOUT_NEXT_CONTOUR_PERMISSION_REASON_CODES = Object.freeze({
  SOURCE_002D_RESULT_REQUIRED: 'SOURCE_002D_RESULT_REQUIRED',
  SOURCE_002D_RESULT_HASH_MISMATCH: 'SOURCE_002D_RESULT_HASH_MISMATCH',
  SOURCE_002D_DECISION_HASH_MISMATCH: 'SOURCE_002D_DECISION_HASH_MISMATCH',
  SOURCE_002D_RECEIPT_HASH_MISMATCH: 'SOURCE_002D_RECEIPT_HASH_MISMATCH',
  SOURCE_002D_BLOCKED: 'SOURCE_002D_BLOCKED',
  SOURCE_002D_REVALIDATION_INPUT_REQUIRED: 'SOURCE_002D_REVALIDATION_INPUT_REQUIRED',
  SOURCE_002D_REVALIDATION_FAILED: 'SOURCE_002D_REVALIDATION_FAILED',
  FIXTURE_RECEIPT_REBRAND_FORBIDDEN: 'FIXTURE_RECEIPT_REBRAND_FORBIDDEN',
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
  OWNER_PACKET_BINDING_MISMATCH: 'OWNER_PACKET_BINDING_MISMATCH',
  OWNER_PACKET_TARGET_MISMATCH: 'OWNER_PACKET_TARGET_MISMATCH',
  OWNER_PACKET_UNKNOWN_FIELD_FORBIDDEN: 'OWNER_PACKET_UNKNOWN_FIELD_FORBIDDEN',
  OWNER_POLICY_MISSING: 'OWNER_POLICY_MISSING',
  OWNER_NEXT_CONTOUR_TARGET_MISMATCH: 'OWNER_NEXT_CONTOUR_TARGET_MISMATCH',
  USER_PROJECT_PATH_FORBIDDEN: 'USER_PROJECT_PATH_FORBIDDEN',
  CALLABLE_FIELD_FORBIDDEN: 'CALLABLE_FIELD_FORBIDDEN',
});

const FALSE_FLAGS = Object.freeze({
  ownerMayOpenNextContour: false,
  productPathAdmitted: false,
  productPathExecuted: false,
  productPathExecutionAdmitted: false,
  productApplyRuntimeAdmitted: false,
  publicRuntimeAdmitted: false,
  publicAdapterImplementationAdmitted: false,
  runtimeWiringAdmitted: false,
  productStorageAdmission: false,
  productStorageSafetyClaimed: false,
  productApplyReceiptClaimed: false,
  productApplyReceiptImplemented: false,
  durableReceiptClaimed: false,
  productWritePerformed: false,
  productWriteClaimed: false,
  userProjectMutated: false,
  realUserProjectPathTouched: false,
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
  recoveryClaimed: false,
  startupRecoveryClaimed: false,
  releaseClaimed: false,
  multiSceneApplyClaimed: false,
  structuralApplyClaimed: false,
  commentApplyClaimed: false,
});

const OWNER_REQUIRED_TRUE_FIELDS = [
  'ownerApproved002ECloseout',
  'ownerUnderstandsCloseoutOnly',
  'ownerUnderstandsPermissionOnly',
  'ownerUnderstandsOwnerPacketNecessaryButInsufficient',
  'ownerUnderstandsFixtureReceiptIsNotProductReceipt',
  'ownerUnderstandsProductPathNotAdmitted',
  'ownerUnderstandsProductPathExecutionForbidden',
  'ownerUnderstandsProductWriteForbidden',
  'ownerUnderstandsProductStorageAdmissionForbidden',
  'ownerUnderstandsPublicRuntimeForbidden',
  'ownerUnderstandsUserProjectPathForbidden',
  'ownerUnderstandsNoCommandSurface',
  'ownerUnderstandsNoUi',
  'ownerUnderstandsNoDocx',
  'ownerUnderstandsNoNetwork',
  'ownerUnderstandsNoDependencyChange',
  'ownerUnderstandsNoApplyTxn',
  'ownerUnderstandsNoRecoveryClaim',
  'ownerUnderstandsNoReleaseClaim',
  'ownerPacketAuthorizesOnlyOpening002F',
];

const OWNER_ALLOWED_FIELDS = Object.freeze(new Set([
  'packetKind',
  'targetContour',
  'bindingHeadSha',
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

function receiptHash(receipt) {
  return canonicalHash(withoutHash(receipt, 'receiptCanonicalHash'));
}

function uniqueReasons(reasons) {
  return Array.from(new Set(reasons.filter(Boolean))).sort();
}

function resultCore(input) {
  return {
    resultKind: RESULT_KIND,
    contourId: TARGET_CONTOUR,
    closeoutOnly: true,
    nextContourPermissionOnly: true,
    privateInternalOnly: true,
    fixtureProofOnly: true,
    fixtureReceiptIsNotProductApplyReceipt: true,
    noProductPathAdmission: true,
    noProductPathExecution: true,
    noProductWrite: true,
    noPublicRuntime: true,
    writeEffectsCount: 0,
    productWriteCount: 0,
    publicSurfaceCount: 0,
    ...FALSE_FLAGS,
    ...input,
  };
}

function blockedResult(blockedReasons, observations = {}) {
  return withCanonicalHash(resultCore({
    outputDecision: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_CLOSEOUT_AND_NEXT_CONTOUR_PERMISSION_002E_BLOCKED',
    nextContourRecommendation: null,
    ownerMayOpenNextContour: false,
    source002DAccepted: false,
    source002DRevalidated: false,
    ownerPermissionPacketAccepted: false,
    source002DFixtureReceiptVerified: false,
    blockedReasons: uniqueReasons(blockedReasons),
    decisions: [],
    exitPacket: {
      source002DRehashed: false,
      source002DDecisionRehashed: false,
      source002DReceiptRehashed: false,
      source002DRevalidated: false,
      ownerPermissionPacketAccepted: false,
      ownerMayOpenNextContour: false,
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
  const source = input.source002DResult;
  const decisionCore = {
    decisionKind: DECISION_KIND,
    outputDecision: 'OWNER_MAY_OPEN_002F_ONLY_NO_PRODUCT_PATH_ADMITTED',
    nextContourRecommendation: NEXT_CONTOUR,
    ownerMayOpenNextContour: true,
    nextContourOnly: NEXT_CONTOUR,
    closeoutOnly: true,
    nextContourPermissionOnly: true,
    fixtureReceiptIsNotProductApplyReceipt: true,
    productPathAdmitted: false,
    productPathExecuted: false,
    productPathExecutionAdmitted: false,
    productWriteAdmitted: false,
    productWritePerformed: false,
    productStorageAdmission: false,
    productStorageSafetyClaimed: false,
    productApplyReceiptClaimed: false,
    publicRuntimeAdmitted: false,
    userProjectMutated: false,
    applyTxnImplemented: false,
    recoveryClaimed: false,
    releaseClaimed: false,
    productWriteCount: 0,
    publicSurfaceCount: 0,
    writeEffectsCount: 0,
  };
  const decision = withCanonicalHash(decisionCore);
  return withCanonicalHash(resultCore({
    outputDecision: decision.outputDecision,
    nextContourRecommendation: NEXT_CONTOUR,
    ownerMayOpenNextContour: true,
    source002DAccepted: true,
    source002DRevalidated: true,
    ownerPermissionPacketAccepted: true,
    source002DFixtureReceiptVerified: true,
    source002DResultHash: input.source002DResultHash,
    source002DDecisionHash: input.source002DDecisionHash,
    source002DReceiptHash: input.source002DReceiptHash,
    source002DReceiptKind: source.receipt.receiptKind,
    source002DContourId: SOURCE_002D_CONTOUR,
    nextContourOnly: NEXT_CONTOUR,
    fixtureReceiptIsNotProductApplyReceipt: true,
    productPathAdmitted: false,
    productPathExecuted: false,
    productPathExecutionAdmitted: false,
    productWriteAdmitted: false,
    productWritePerformed: false,
    productStorageAdmission: false,
    productStorageSafetyClaimed: false,
    productApplyReceiptClaimed: false,
    productApplyReceiptImplemented: false,
    durableReceiptClaimed: false,
    publicRuntimeAdmitted: false,
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
      source002DRehashed: true,
      source002DDecisionRehashed: true,
      source002DReceiptRehashed: true,
      source002DRevalidated: true,
      ownerPermissionPacketAccepted: true,
      ownerMayOpenNextContour: true,
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
  if (value.productPathAdmitted === true || value.productPathExecuted === true || value.productPathExecutionAdmitted === true) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_CLOSEOUT_NEXT_CONTOUR_PERMISSION_REASON_CODES.PRODUCT_PATH_EXECUTION_FORBIDDEN);
  }
  if (
    value.productWritePerformed === true
    || value.productWriteClaimed === true
    || value.productWriteAdmitted === true
    || value.userProjectMutated === true
    || value.realUserProjectPathTouched === true
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_CLOSEOUT_NEXT_CONTOUR_PERMISSION_REASON_CODES.PRODUCT_WRITE_FORBIDDEN);
  }
  if (value.productStorageAdmission === true || value.productStorageSafetyClaimed === true) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_CLOSEOUT_NEXT_CONTOUR_PERMISSION_REASON_CODES.PRODUCT_STORAGE_ADMISSION_FORBIDDEN);
  }
  if (
    value.productApplyReceiptClaimed === true
    || value.productApplyReceiptImplemented === true
    || value.durableReceiptClaimed === true
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_CLOSEOUT_NEXT_CONTOUR_PERMISSION_REASON_CODES.PRODUCT_APPLYRECEIPT_CLAIM_FORBIDDEN);
  }
  if (
    value.publicRuntimeAdmitted === true
    || value.productApplyRuntimeAdmitted === true
    || value.publicAdapterImplementationAdmitted === true
    || value.runtimeWiringAdmitted === true
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_CLOSEOUT_NEXT_CONTOUR_PERMISSION_REASON_CODES.PUBLIC_RUNTIME_FORBIDDEN);
  }
  if (
    value.publicSurfaceClaimed === true
    || value.ipcSurfaceClaimed === true
    || value.preloadExportClaimed === true
    || value.menuSurfaceClaimed === true
    || value.commandSurfaceClaimed === true
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_CLOSEOUT_NEXT_CONTOUR_PERMISSION_REASON_CODES.PUBLIC_COMMAND_SURFACE_FORBIDDEN);
  }
  if (value.uiChanged === true || value.docxImportClaimed === true || value.networkUsed === true || value.dependencyChanged === true) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_CLOSEOUT_NEXT_CONTOUR_PERMISSION_REASON_CODES.UI_DOCX_NETWORK_DEPENDENCY_FORBIDDEN);
  }
  if (
    value.applyTxnImplemented === true
    || value.recoveryClaimed === true
    || value.startupRecoveryClaimed === true
    || value.releaseClaimed === true
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_CLOSEOUT_NEXT_CONTOUR_PERMISSION_REASON_CODES.APPLYTXN_RECOVERY_RELEASE_FORBIDDEN);
  }
  if (
    value.fixtureReceiptOnlyNotProductApplyReceipt === false
    || value.fixtureReceiptIsNotProductApplyReceipt === false
    || value.receiptKind === 'PRODUCT_APPLYRECEIPT'
    || value.receiptKind === 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_APPLYRECEIPT_V1'
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_CLOSEOUT_NEXT_CONTOUR_PERMISSION_REASON_CODES.FIXTURE_RECEIPT_REBRAND_FORBIDDEN);
  }
}

function validateNoCallableOrUserPath(value, reasons) {
  if (typeof value === 'function') {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_CLOSEOUT_NEXT_CONTOUR_PERMISSION_REASON_CODES.CALLABLE_FIELD_FORBIDDEN);
    return;
  }
  if (!isObject(value)) {
    return;
  }
  for (const [field, nested] of Object.entries(value)) {
    if (/(?:^|_)?(?:userProjectPath|realUserProjectPath|productRoot|projectPath|scenePath|filePath|absolutePath|filesystemPath)$/u.test(field)) {
      reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_CLOSEOUT_NEXT_CONTOUR_PERMISSION_REASON_CODES.USER_PROJECT_PATH_FORBIDDEN);
    }
    if (typeof nested === 'function') {
      reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_CLOSEOUT_NEXT_CONTOUR_PERMISSION_REASON_CODES.CALLABLE_FIELD_FORBIDDEN);
    } else if (isObject(nested)) {
      validateNoCallableOrUserPath(nested, reasons);
    }
  }
}

function validateSource002D(input, reasons) {
  const source = input.source002DResult;
  if (!isObject(source)) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_CLOSEOUT_NEXT_CONTOUR_PERMISSION_REASON_CODES.SOURCE_002D_RESULT_REQUIRED);
    return;
  }
  pushForbiddenClaimReasons(source, reasons);
  const decision = Array.isArray(source.decisions) ? source.decisions[0] : null;
  const receipt = source.receipt;
  pushForbiddenClaimReasons(receipt, reasons);
  if (
    source.resultKind !== SOURCE_002D_RESULT_KIND
    || source.outputDecision !== 'PRIVATE_FIXTURE_PORT_IMPLEMENTATION_EXECUTED_NO_PRODUCT_RUNTIME_ADMITTED'
    || source.nextContourRecommendation !== SOURCE_002D_HISTORICAL_NEXT_CONTOUR
    || source.contourId !== SOURCE_002D_CONTOUR
    || source.source002CAccepted !== true
    || source.inheritedChainVerified !== true
    || source.injectedFixturePortAccepted !== true
    || source.exactTextGuardPassed !== true
    || source.fixtureAtomicWriteExecuted !== true
    || source.fixtureReceiptWritten !== true
    || source.fixtureReadbackMatched !== true
    || source.fixtureCleanupObserved !== true
    || source.fixtureWriteCount !== 1
    || source.fixtureReceiptCount !== 1
    || source.productWriteCount !== 0
    || source.publicSurfaceCount !== 0
    || source.productWritePerformed !== false
    || source.productStorageAdmission !== false
    || source.productApplyReceiptClaimed !== false
    || source.publicRuntimeAdmitted !== false
    || source.userProjectMutated !== false
    || source.recoveryClaimed !== false
    || source.applyTxnImplemented !== false
    || source.releaseClaimed !== false
    || source.fixtureReceiptOnlyNotProductApplyReceipt !== true
    || source.fixtureBackupObservationOnlyNotRecovery !== true
    || source.fixtureAtomicWriteObservationOnlyNotStorageSafety !== true
    || source.blockedReasons?.length
    || !isObject(decision)
    || decision.decisionKind !== SOURCE_002D_DECISION_KIND
    || decision.outputDecision !== source.outputDecision
    || decision.nextContourRecommendation !== SOURCE_002D_HISTORICAL_NEXT_CONTOUR
    || decision.productWriteCount !== 0
    || decision.publicSurfaceCount !== 0
    || decision.productWritePerformed !== false
    || decision.productStorageAdmission !== false
    || decision.productApplyReceiptClaimed !== false
    || decision.publicRuntimeAdmitted !== false
    || decision.userProjectMutated !== false
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_CLOSEOUT_NEXT_CONTOUR_PERMISSION_REASON_CODES.SOURCE_002D_BLOCKED);
  }
  if (
    !hasText(source.canonicalHash)
    || source.canonicalHash !== canonicalHash(withoutHash(source))
    || source.canonicalHash !== input.source002DResultHash
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_CLOSEOUT_NEXT_CONTOUR_PERMISSION_REASON_CODES.SOURCE_002D_RESULT_HASH_MISMATCH);
  }
  if (
    !hasText(decision?.canonicalHash)
    || decision.canonicalHash !== canonicalHash(withoutHash(decision))
    || decision.canonicalHash !== input.source002DDecisionHash
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_CLOSEOUT_NEXT_CONTOUR_PERMISSION_REASON_CODES.SOURCE_002D_DECISION_HASH_MISMATCH);
  }
  if (
    !isObject(receipt)
    || receipt.receiptKind !== SOURCE_002D_RECEIPT_KIND
    || receipt.fixtureReceiptOnlyNotProductApplyReceipt !== true
    || receipt.productWritePerformed !== false
    || receipt.productStorageAdmission !== false
    || receipt.productApplyReceiptClaimed !== false
    || receipt.recoveryClaimed !== false
    || receipt.applyTxnImplemented !== false
    || !hasText(receipt.receiptCanonicalHash)
    || receipt.receiptCanonicalHash !== receiptHash(receipt)
    || receipt.receiptCanonicalHash !== input.source002DReceiptHash
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_CLOSEOUT_NEXT_CONTOUR_PERMISSION_REASON_CODES.SOURCE_002D_RECEIPT_HASH_MISMATCH);
  }
}

function validateSource002DRevalidation(input, reasons) {
  if (!isObject(input.source002DRevalidationInput)) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_CLOSEOUT_NEXT_CONTOUR_PERMISSION_REASON_CODES.SOURCE_002D_REVALIDATION_INPUT_REQUIRED);
    return;
  }
  const rerun = runExactTextApplyWithReceiptPrivatePortImplementation(input.source002DRevalidationInput);
  if (
    rerun.outputDecision !== 'PRIVATE_FIXTURE_PORT_IMPLEMENTATION_EXECUTED_NO_PRODUCT_RUNTIME_ADMITTED'
    || rerun.canonicalHash !== input.source002DResultHash
    || rerun.decisions?.[0]?.canonicalHash !== input.source002DDecisionHash
    || rerun.receipt?.receiptCanonicalHash !== input.source002DReceiptHash
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_CLOSEOUT_NEXT_CONTOUR_PERMISSION_REASON_CODES.SOURCE_002D_REVALIDATION_FAILED);
  }
}

function validateOwnerPacket(input, reasons) {
  const packet = input.ownerCloseoutPermissionPacket002E;
  if (!isObject(packet)) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_CLOSEOUT_NEXT_CONTOUR_PERMISSION_REASON_CODES.OWNER_PACKET_REQUIRED);
    return;
  }
  if (packet.packetKind !== OWNER_PACKET_KIND) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_CLOSEOUT_NEXT_CONTOUR_PERMISSION_REASON_CODES.OWNER_PACKET_INVALID);
  }
  if (packet.targetContour !== TARGET_CONTOUR) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_CLOSEOUT_NEXT_CONTOUR_PERMISSION_REASON_CODES.OWNER_PACKET_TARGET_MISMATCH);
  }
  if (packet.bindingHeadSha !== BINDING_HEAD_SHA) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_CLOSEOUT_NEXT_CONTOUR_PERMISSION_REASON_CODES.OWNER_PACKET_BINDING_MISMATCH);
  }
  if (packet.nextContourTarget !== NEXT_CONTOUR) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_CLOSEOUT_NEXT_CONTOUR_PERMISSION_REASON_CODES.OWNER_NEXT_CONTOUR_TARGET_MISMATCH);
  }
  for (const field of Object.keys(packet)) {
    if (!OWNER_ALLOWED_FIELDS.has(field)) {
      reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_CLOSEOUT_NEXT_CONTOUR_PERMISSION_REASON_CODES.OWNER_PACKET_UNKNOWN_FIELD_FORBIDDEN);
    }
  }
  if (OWNER_REQUIRED_TRUE_FIELDS.some((field) => packet[field] !== true)) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_CLOSEOUT_NEXT_CONTOUR_PERMISSION_REASON_CODES.OWNER_POLICY_MISSING);
  }
  pushForbiddenClaimReasons(packet, reasons);
  validateNoCallableOrUserPath(packet, reasons);
}

export function runExactTextApplyWithReceiptPrivatePortCloseoutNextContourPermission(input = {}) {
  const reasons = [];
  pushForbiddenClaimReasons(input, reasons);
  validateSource002D(input, reasons);
  validateSource002DRevalidation(input, reasons);
  validateOwnerPacket(input, reasons);
  if (reasons.length > 0) {
    return blockedResult(reasons, {
      source002DResultHash: input.source002DResultHash || input.source002DResult?.canonicalHash || null,
      source002DDecisionHash: input.source002DDecisionHash || input.source002DResult?.decisions?.[0]?.canonicalHash || null,
      source002DReceiptHash: input.source002DReceiptHash || input.source002DResult?.receipt?.receiptCanonicalHash || null,
    });
  }
  return acceptedResult(input);
}

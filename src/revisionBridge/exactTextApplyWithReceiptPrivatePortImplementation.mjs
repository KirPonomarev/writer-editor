import { canonicalHash } from './reviewIrKernel.mjs';
import { runExactTextApplyWithReceiptPrivatePortAdmission } from './exactTextApplyWithReceiptPrivatePortAdmission.mjs';

const RESULT_KIND = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_IMPLEMENTATION_RESULT_002D';
const DECISION_KIND = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_IMPLEMENTATION_DECISION_002D';
const RECEIPT_KIND = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_FIXTURE_RECEIPT_V1_002D';
const SOURCE_002C_RESULT_KIND = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_ADMISSION_RESULT_002C';
const SOURCE_002C_DECISION_KIND = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_ADMISSION_DECISION_002C';
const SOURCE_002B_SHAPE_KIND = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_CONTRACT_SHAPE_V1_002B';
const OWNER_PACKET_KIND = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_IMPLEMENTATION_OWNER_PACKET_002D';
const TARGET_CONTOUR = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_IMPLEMENTATION_002D';
const NEXT_CONTOUR = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_CLOSEOUT_AND_PRODUCT_ADMISSION_002E';
const BINDING_HEAD_SHA = '0ab82829a3c29aad721ce60172e2250bde6598e9';

export const EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_IMPLEMENTATION_REASON_CODES = Object.freeze({
  SOURCE_002C_RESULT_REQUIRED: 'SOURCE_002C_RESULT_REQUIRED',
  SOURCE_002C_RESULT_HASH_MISMATCH: 'SOURCE_002C_RESULT_HASH_MISMATCH',
  SOURCE_002C_DECISION_HASH_MISMATCH: 'SOURCE_002C_DECISION_HASH_MISMATCH',
  SOURCE_002C_BLOCKED: 'SOURCE_002C_BLOCKED',
  SOURCE_002B_CONTRACT_SHAPE_MISMATCH: 'SOURCE_002B_CONTRACT_SHAPE_MISMATCH',
  INHERITED_CHAIN_REVALIDATION_FAILED: 'INHERITED_CHAIN_REVALIDATION_FAILED',
  OWNER_PACKET_REQUIRED: 'OWNER_PACKET_REQUIRED',
  OWNER_PACKET_INVALID: 'OWNER_PACKET_INVALID',
  OWNER_PACKET_BINDING_MISMATCH: 'OWNER_PACKET_BINDING_MISMATCH',
  OWNER_PACKET_TARGET_MISMATCH: 'OWNER_PACKET_TARGET_MISMATCH',
  OWNER_PACKET_UNKNOWN_FIELD_FORBIDDEN: 'OWNER_PACKET_UNKNOWN_FIELD_FORBIDDEN',
  OWNER_POLICY_MISSING: 'OWNER_POLICY_MISSING',
  INJECTED_FIXTURE_PORT_REQUIRED: 'INJECTED_FIXTURE_PORT_REQUIRED',
  UNSAFE_FIXTURE_ROOT: 'UNSAFE_FIXTURE_ROOT',
  USER_PROJECT_PATH_FORBIDDEN: 'USER_PROJECT_PATH_FORBIDDEN',
  CALLABLE_FIELD_FORBIDDEN: 'CALLABLE_FIELD_FORBIDDEN',
  PATH_TRAVERSAL_FORBIDDEN: 'PATH_TRAVERSAL_FORBIDDEN',
  SYMLINK_ESCAPE_FORBIDDEN: 'SYMLINK_ESCAPE_FORBIDDEN',
  DIRECTORY_TARGET_FORBIDDEN: 'DIRECTORY_TARGET_FORBIDDEN',
  WRONG_PROJECT: 'WRONG_PROJECT',
  WRONG_SCENE: 'WRONG_SCENE',
  STALE_BASELINE: 'STALE_BASELINE',
  CLOSED_SESSION: 'CLOSED_SESSION',
  EXACT_TEXT_GUARD_FAILED: 'EXACT_TEXT_GUARD_FAILED',
  BLOCK_VERSION_HASH_MISMATCH: 'BLOCK_VERSION_HASH_MISMATCH',
  UNSUPPORTED_SCOPE_FORBIDDEN: 'UNSUPPORTED_SCOPE_FORBIDDEN',
  SCENE_READ_FAILED: 'SCENE_READ_FAILED',
  BACKUP_WRITE_FAILED: 'BACKUP_WRITE_FAILED',
  ATOMIC_WRITE_FAILED: 'ATOMIC_WRITE_FAILED',
  FIXTURE_RECEIPT_WRITE_FAILED: 'FIXTURE_RECEIPT_WRITE_FAILED',
  READBACK_MISMATCH: 'READBACK_MISMATCH',
  FIXTURE_CLEANUP_NOT_OBSERVED: 'FIXTURE_CLEANUP_NOT_OBSERVED',
  PRODUCT_WRITE_FORBIDDEN: 'PRODUCT_WRITE_FORBIDDEN',
  PRODUCT_STORAGE_ADMISSION_FORBIDDEN: 'PRODUCT_STORAGE_ADMISSION_FORBIDDEN',
  PRODUCT_APPLYRECEIPT_CLAIM_FORBIDDEN: 'PRODUCT_APPLYRECEIPT_CLAIM_FORBIDDEN',
  PUBLIC_RUNTIME_FORBIDDEN: 'PUBLIC_RUNTIME_FORBIDDEN',
  PUBLIC_COMMAND_SURFACE_FORBIDDEN: 'PUBLIC_COMMAND_SURFACE_FORBIDDEN',
  UI_DOCX_NETWORK_DEPENDENCY_FORBIDDEN: 'UI_DOCX_NETWORK_DEPENDENCY_FORBIDDEN',
  APPLYTXN_RECOVERY_RELEASE_FORBIDDEN: 'APPLYTXN_RECOVERY_RELEASE_FORBIDDEN',
});

const FALSE_FLAGS = Object.freeze({
  productApplyRuntimeAdmitted: false,
  publicRuntimeAdmitted: false,
  publicAdapterImplementationAdmitted: false,
  runtimeWiringAdmitted: false,
  productStorageAdmission: false,
  productApplyReceiptClaimed: false,
  productWritePerformed: false,
  productWriteClaimed: false,
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
  userProjectMutated: false,
  realUserProjectPathTouched: false,
});

const OWNER_REQUIRED_TRUE_FIELDS = [
  'ownerApprovedPrivatePortImplementation',
  'ownerUnderstandsPrivateFixtureOnly',
  'ownerUnderstandsInjectedPortOnly',
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
  'ownerUnderstands002EWillNeedSeparateAdmission',
  'ownerPacketAuthorizesOnlyPrivateFixturePortImplementation',
];

const OWNER_ALLOWED_FIELDS = Object.freeze(new Set([
  'packetKind',
  'targetContour',
  'bindingHeadSha',
  ...OWNER_REQUIRED_TRUE_FIELDS,
]));

const PORT_REQUIRED_TRUE_FIELDS = [
  'isolatedFixtureRoot',
  'canRejectTraversal',
  'canRejectSymlinkEscape',
  'canRejectDirectoryTarget',
  'canReadScene',
  'canWriteBackup',
  'canAtomicWriteScene',
  'canWriteFixtureReceipt',
  'canReadBackFixtureReceipt',
  'canObserveCleanup',
  'canReportFailureWithoutPartialSuccess',
];

const PORT_REQUIRED_FUNCTIONS = [
  'readScene',
  'writeBackup',
  'atomicWriteScene',
  'writeFixtureReceipt',
  'readBackScene',
  'readBackFixtureReceipt',
  'observeCleanup',
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

function sceneTextHash(text) {
  return canonicalHash({
    hashKind: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_FIXTURE_SCENE_TEXT_HASH_V1_002D',
    text,
  });
}

function resultCore(input) {
  return {
    resultKind: RESULT_KIND,
    contourId: TARGET_CONTOUR,
    privateInjectedFixturePortImplementationOnly: true,
    privateInternalOnly: true,
    exactTextOnly: true,
    singleSceneOnly: true,
    fixtureReceiptOnlyNotProductApplyReceipt: true,
    fixtureBackupObservationOnlyNotRecovery: true,
    fixtureAtomicWriteObservationOnlyNotStorageSafety: true,
    successMayOnlyOpen002EOwnerGatedAdmission: true,
    ...FALSE_FLAGS,
    ...input,
  };
}

function blockedResult(blockedReasons, observations = {}) {
  return withCanonicalHash(resultCore({
    outputDecision: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_IMPLEMENTATION_002D_BLOCKED',
    nextContourRecommendation: null,
    source002CAccepted: false,
    inheritedChainVerified: false,
    injectedFixturePortAccepted: false,
    exactTextGuardPassed: false,
    fixtureAtomicWriteExecuted: false,
    fixtureReceiptWritten: false,
    fixtureReadbackMatched: false,
    fixtureCleanupObserved: false,
    fixtureWriteCount: 0,
    fixtureReceiptCount: 0,
    productWriteCount: 0,
    publicSurfaceCount: 0,
    blockedReasons: uniqueReasons(blockedReasons),
    decisions: [],
    receipt: null,
    exitPacket: {
      inheritedChainVerified: false,
      source002CRehashed: false,
      source002BContractShapeRehashed: false,
      injectedFixturePortAccepted: false,
      exactTextGuardPassed: false,
      fixtureWriteCount: 0,
      fixtureReceiptCount: 0,
      productWriteCount: 0,
      publicSurfaceCount: 0,
      fixtureCleanupObserved: false,
      nextContour: null,
    },
    ...observations,
  }));
}

function acceptedResult(input, receipt, observations) {
  const decisionCore = {
    decisionKind: DECISION_KIND,
    outputDecision: 'PRIVATE_FIXTURE_PORT_IMPLEMENTATION_EXECUTED_NO_PRODUCT_RUNTIME_ADMITTED',
    nextContourRecommendation: NEXT_CONTOUR,
    privateInjectedFixturePortImplementationOnly: true,
    exactTextOnly: true,
    singleSceneOnly: true,
    fixtureReceiptOnlyNotProductApplyReceipt: true,
    productWritePerformed: false,
    productStorageAdmission: false,
    productApplyReceiptClaimed: false,
    recoveryClaimed: false,
    publicRuntimeAdmitted: false,
    userProjectMutated: false,
    fixtureWriteCount: 1,
    fixtureReceiptCount: 1,
    productWriteCount: 0,
    publicSurfaceCount: 0,
  };
  const decision = withCanonicalHash(decisionCore);
  return withCanonicalHash(resultCore({
    outputDecision: decision.outputDecision,
    nextContourRecommendation: NEXT_CONTOUR,
    source002CAccepted: true,
    inheritedChainVerified: true,
    injectedFixturePortAccepted: true,
    exactTextGuardPassed: true,
    fixtureAtomicWriteExecuted: true,
    fixtureReceiptWritten: true,
    fixtureReadbackMatched: true,
    fixtureCleanupObserved: true,
    fixtureWriteCount: 1,
    fixtureReceiptCount: 1,
    productWriteCount: 0,
    publicSurfaceCount: 0,
    source002CResultHash: input.source002CResultHash,
    source002CDecisionHash: input.source002CDecisionHash,
    source002BContractShapeHash: input.source002BContractShapeHash,
    beforeSceneHash: receipt.beforeSceneHash,
    afterSceneHash: receipt.afterSceneHash,
    blockVersionHash: receipt.blockVersionHash,
    backupObservationHash: receipt.backupObservationHash,
    atomicWriteObservationHash: receipt.atomicWriteObservationHash,
    receiptCanonicalHash: receipt.receiptCanonicalHash,
    blockedReasons: [],
    decisions: [decision],
    receipt,
    exitPacket: {
      inheritedChainVerified: true,
      source002CRehashed: true,
      source002BContractShapeRehashed: true,
      injectedFixturePortAccepted: true,
      exactTextGuardPassed: true,
      fixtureWriteCount: 1,
      fixtureReceiptCount: 1,
      productWriteCount: 0,
      publicSurfaceCount: 0,
      fixtureCleanupObserved: true,
      nextContour: NEXT_CONTOUR,
    },
    ...observations,
  }));
}

function pushForbiddenClaimReasons(value, reasons) {
  if (!isObject(value)) {
    return;
  }
  if (
    value.productWritePerformed === true
    || value.productWriteClaimed === true
    || value.userProjectMutated === true
    || value.realUserProjectPathTouched === true
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_IMPLEMENTATION_REASON_CODES.PRODUCT_WRITE_FORBIDDEN);
  }
  if (value.productStorageAdmission === true || value.productStorageSafetyClaimed === true) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_IMPLEMENTATION_REASON_CODES.PRODUCT_STORAGE_ADMISSION_FORBIDDEN);
  }
  if (
    value.productApplyReceiptClaimed === true
    || value.productApplyReceiptImplemented === true
    || value.durableReceiptClaimed === true
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_IMPLEMENTATION_REASON_CODES.PRODUCT_APPLYRECEIPT_CLAIM_FORBIDDEN);
  }
  if (
    value.publicRuntimeAdmitted === true
    || value.productApplyRuntimeAdmitted === true
    || value.publicAdapterImplementationAdmitted === true
    || value.runtimeWiringAdmitted === true
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_IMPLEMENTATION_REASON_CODES.PUBLIC_RUNTIME_FORBIDDEN);
  }
  if (
    value.publicSurfaceClaimed === true
    || value.ipcSurfaceClaimed === true
    || value.preloadExportClaimed === true
    || value.menuSurfaceClaimed === true
    || value.commandSurfaceClaimed === true
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_IMPLEMENTATION_REASON_CODES.PUBLIC_COMMAND_SURFACE_FORBIDDEN);
  }
  if (value.uiChanged === true || value.docxImportClaimed === true || value.networkUsed === true || value.dependencyChanged === true) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_IMPLEMENTATION_REASON_CODES.UI_DOCX_NETWORK_DEPENDENCY_FORBIDDEN);
  }
  if (
    value.applyTxnImplemented === true
    || value.recoveryClaimed === true
    || value.startupRecoveryClaimed === true
    || value.releaseClaimed === true
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_IMPLEMENTATION_REASON_CODES.APPLYTXN_RECOVERY_RELEASE_FORBIDDEN);
  }
}

function validateNoCallableOrUserPath(value, reasons) {
  if (typeof value === 'function') {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_IMPLEMENTATION_REASON_CODES.CALLABLE_FIELD_FORBIDDEN);
    return;
  }
  if (!isObject(value)) {
    return;
  }
  for (const [field, nested] of Object.entries(value)) {
    if (/(?:^|_)?(?:userProjectPath|realUserProjectPath|productRoot|projectPath|scenePath|filePath|absolutePath|filesystemPath)$/u.test(field)) {
      reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_IMPLEMENTATION_REASON_CODES.USER_PROJECT_PATH_FORBIDDEN);
    }
    if (typeof nested === 'function') {
      reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_IMPLEMENTATION_REASON_CODES.CALLABLE_FIELD_FORBIDDEN);
    } else if (isObject(nested)) {
      validateNoCallableOrUserPath(nested, reasons);
    }
  }
}

function validateSource002C(input, reasons) {
  const source = input.source002CResult;
  if (!isObject(source)) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_IMPLEMENTATION_REASON_CODES.SOURCE_002C_RESULT_REQUIRED);
    return;
  }
  pushForbiddenClaimReasons(source, reasons);
  const decision = Array.isArray(source.decisions) ? source.decisions[0] : null;
  if (
    source.resultKind !== SOURCE_002C_RESULT_KIND
    || source.outputDecision !== 'OWNER_MAY_OPEN_PRIVATE_PORT_IMPLEMENTATION_002D_NO_PUBLIC_RUNTIME_ADMITTED'
    || source.nextContourRecommendation !== TARGET_CONTOUR
    || source.ownerMayOpen002D !== true
    || source.source002BAccepted !== true
    || source.ownerPortAdmissionAccepted !== true
    || source.privatePortAdmissionOnly !== true
    || source.writeEffectsCount !== 0
    || source.blockedReasons?.length
    || !isObject(decision)
    || decision.decisionKind !== SOURCE_002C_DECISION_KIND
    || decision.nextContourRecommendation !== TARGET_CONTOUR
    || decision.ownerMayOpen002D !== true
    || decision.noPortImplementation !== true
    || decision.portImplementationAdmitted !== false
    || decision.storagePortAdmitted !== false
    || decision.writePortAdmitted !== false
    || decision.userProjectMutated !== false
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_IMPLEMENTATION_REASON_CODES.SOURCE_002C_BLOCKED);
  }
  if (
    !hasText(source.canonicalHash)
    || source.canonicalHash !== canonicalHash(withoutHash(source))
    || source.canonicalHash !== input.source002CResultHash
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_IMPLEMENTATION_REASON_CODES.SOURCE_002C_RESULT_HASH_MISMATCH);
  }
  if (
    !hasText(decision?.canonicalHash)
    || decision.canonicalHash !== canonicalHash(withoutHash(decision))
    || decision.canonicalHash !== input.source002CDecisionHash
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_IMPLEMENTATION_REASON_CODES.SOURCE_002C_DECISION_HASH_MISMATCH);
  }
  if (
    !hasText(source.contractShapeHash)
    || source.contractShapeHash !== input.source002BContractShapeHash
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_IMPLEMENTATION_REASON_CODES.SOURCE_002B_CONTRACT_SHAPE_MISMATCH);
  }
}

function validateSource002BContractShape(input, reasons) {
  const shape = input.source002BResult?.contractShape;
  if (
    !isObject(shape)
    || shape.shapeKind !== SOURCE_002B_SHAPE_KIND
    || shape.canonicalHash !== canonicalHash(withoutHash(shape))
    || shape.canonicalHash !== input.source002BContractShapeHash
    || shape.futurePortCapabilitySchema?.portImplementationAdmitted !== false
    || shape.futurePortCapabilitySchema?.storagePortAdmitted !== false
    || shape.futurePortCapabilitySchema?.writePortAdmitted !== false
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_IMPLEMENTATION_REASON_CODES.SOURCE_002B_CONTRACT_SHAPE_MISMATCH);
  }
}

function validateInheritedChain(input, reasons) {
  const rerun = runExactTextApplyWithReceiptPrivatePortAdmission({
    source002BResult: input.source002BResult,
    source002BResultHash: input.source002CResult?.source002BResultHash,
    source002BDecisionHash: input.source002CResult?.source002BDecisionHash,
    source002BContractShapeHash: input.source002BContractShapeHash,
    source002AResult: input.source002AResult,
    source001ZResult: input.source001ZResult,
    source001YResult: input.source001YResult,
    source001XResult: input.source001XResult,
    source001WResult: input.source001WResult,
    source001VResult: input.source001VResult,
    source001UResult: input.source001UResult,
    ownerAdmissionPacket001Z: input.ownerAdmissionPacket001Z,
    ownerBriefPacket002A: input.ownerBriefPacket002A,
    ownerShapePacket002B: input.ownerShapePacket002B,
    ownerPortAdmissionPacket002C: input.ownerPortAdmissionPacket002C,
  });
  if (
    rerun.outputDecision !== 'OWNER_MAY_OPEN_PRIVATE_PORT_IMPLEMENTATION_002D_NO_PUBLIC_RUNTIME_ADMITTED'
    || rerun.canonicalHash !== input.source002CResultHash
    || rerun.decisions?.[0]?.canonicalHash !== input.source002CDecisionHash
    || rerun.contractShapeHash !== input.source002BContractShapeHash
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_IMPLEMENTATION_REASON_CODES.INHERITED_CHAIN_REVALIDATION_FAILED);
  }
}

function validateOwnerPacket(input, reasons) {
  const packet = input.ownerImplementationPacket002D;
  if (!isObject(packet)) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_IMPLEMENTATION_REASON_CODES.OWNER_PACKET_REQUIRED);
    return;
  }
  if (packet.packetKind !== OWNER_PACKET_KIND) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_IMPLEMENTATION_REASON_CODES.OWNER_PACKET_INVALID);
  }
  if (packet.targetContour !== TARGET_CONTOUR) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_IMPLEMENTATION_REASON_CODES.OWNER_PACKET_TARGET_MISMATCH);
  }
  if (packet.bindingHeadSha !== BINDING_HEAD_SHA) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_IMPLEMENTATION_REASON_CODES.OWNER_PACKET_BINDING_MISMATCH);
  }
  for (const field of Object.keys(packet)) {
    if (!OWNER_ALLOWED_FIELDS.has(field)) {
      reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_IMPLEMENTATION_REASON_CODES.OWNER_PACKET_UNKNOWN_FIELD_FORBIDDEN);
    }
  }
  if (OWNER_REQUIRED_TRUE_FIELDS.some((field) => packet[field] !== true)) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_IMPLEMENTATION_REASON_CODES.OWNER_POLICY_MISSING);
  }
  pushForbiddenClaimReasons(packet, reasons);
  validateNoCallableOrUserPath(packet, reasons);
}

function validateRequestShape(request, reasons) {
  if (!isObject(request)) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_IMPLEMENTATION_REASON_CODES.EXACT_TEXT_GUARD_FAILED);
    return;
  }
  validateNoCallableOrUserPath(request, reasons);
  pushForbiddenClaimReasons(request, reasons);
  for (const field of [
    'projectId',
    'sceneId',
    'baselineHash',
    'beforeSceneHash',
    'expectedBlockVersionHash',
    'exactBeforeText',
    'exactAfterText',
    'replacementText',
    'receiptNonce',
    'requestedAt',
  ]) {
    if (!hasText(request[field])) {
      reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_IMPLEMENTATION_REASON_CODES.EXACT_TEXT_GUARD_FAILED);
    }
  }
  if (request.noStructuralScope !== true || request.singleSceneOnly !== true) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_IMPLEMENTATION_REASON_CODES.UNSUPPORTED_SCOPE_FORBIDDEN);
  }
  if (request.noCommentScope !== true) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_IMPLEMENTATION_REASON_CODES.UNSUPPORTED_SCOPE_FORBIDDEN);
  }
}

function validateFixturePort(port, reasons) {
  if (!isObject(port)) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_IMPLEMENTATION_REASON_CODES.INJECTED_FIXTURE_PORT_REQUIRED);
    return;
  }
  if (PORT_REQUIRED_TRUE_FIELDS.some((field) => port[field] !== true)) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_IMPLEMENTATION_REASON_CODES.INJECTED_FIXTURE_PORT_REQUIRED);
  }
  if (PORT_REQUIRED_FUNCTIONS.some((field) => typeof port[field] !== 'function')) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_IMPLEMENTATION_REASON_CODES.INJECTED_FIXTURE_PORT_REQUIRED);
  }
  if (port.fixtureRootUnsafe === true || port.isolatedFixtureRoot !== true) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_IMPLEMENTATION_REASON_CODES.UNSAFE_FIXTURE_ROOT);
  }
  if (port.traversalAllowed === true) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_IMPLEMENTATION_REASON_CODES.PATH_TRAVERSAL_FORBIDDEN);
  }
  if (port.symlinkEscapeAllowed === true) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_IMPLEMENTATION_REASON_CODES.SYMLINK_ESCAPE_FORBIDDEN);
  }
  if (port.directoryTargetAllowed === true) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_IMPLEMENTATION_REASON_CODES.DIRECTORY_TARGET_FORBIDDEN);
  }
  if (port.productRoot || port.userProjectRoot || port.repoRoot) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_IMPLEMENTATION_REASON_CODES.USER_PROJECT_PATH_FORBIDDEN);
  }
  pushForbiddenClaimReasons(port, reasons);
}

function validateReadScene(readResult, request, reasons) {
  if (!isObject(readResult) || readResult.success !== true || typeof readResult.text !== 'string') {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_IMPLEMENTATION_REASON_CODES.SCENE_READ_FAILED);
    return false;
  }
  if (readResult.projectId !== request.projectId) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_IMPLEMENTATION_REASON_CODES.WRONG_PROJECT);
  }
  if (readResult.sceneId !== request.sceneId) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_IMPLEMENTATION_REASON_CODES.WRONG_SCENE);
  }
  if (readResult.closedSession === true) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_IMPLEMENTATION_REASON_CODES.CLOSED_SESSION);
  }
  if (readResult.baselineHash !== request.baselineHash) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_IMPLEMENTATION_REASON_CODES.STALE_BASELINE);
  }
  if (readResult.blockVersionHash !== request.expectedBlockVersionHash) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_IMPLEMENTATION_REASON_CODES.BLOCK_VERSION_HASH_MISMATCH);
  }
  if (readResult.text !== request.exactBeforeText || sceneTextHash(readResult.text) !== request.beforeSceneHash) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_IMPLEMENTATION_REASON_CODES.EXACT_TEXT_GUARD_FAILED);
  }
  return true;
}

function buildReceipt(input, backupObservationHash, atomicWriteObservationHash) {
  const request = input.exactTextApplyRequest;
  const receiptCore = {
    receiptKind: RECEIPT_KIND,
    receiptVersion: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_FIXTURE_RECEIPT_SCHEMA_V1_002D',
    contourId: TARGET_CONTOUR,
    projectId: request.projectId,
    sceneId: request.sceneId,
    source002CResultHash: input.source002CResultHash,
    source002CDecisionHash: input.source002CDecisionHash,
    source002BContractShapeHash: input.source002BContractShapeHash,
    beforeSceneHash: request.beforeSceneHash,
    afterSceneHash: sceneTextHash(request.exactAfterText),
    blockVersionHash: request.expectedBlockVersionHash,
    backupObservationHash,
    atomicWriteObservationHash,
    receiptNonce: request.receiptNonce,
    requestedAt: request.requestedAt,
    fixtureReceiptOnlyNotProductApplyReceipt: true,
    fixtureBackupObservationOnlyNotRecovery: true,
    fixtureAtomicWriteObservationOnlyNotStorageSafety: true,
    productWritePerformed: false,
    productStorageAdmission: false,
    productApplyReceiptClaimed: false,
    recoveryClaimed: false,
    applyTxnImplemented: false,
  };
  return {
    ...receiptCore,
    receiptCanonicalHash: canonicalHash(receiptCore),
  };
}

function executePrivateFixturePort(input) {
  const request = input.exactTextApplyRequest;
  const port = input.injectedPrivateFixturePort;
  const readReasons = [];
  const readResult = port.readScene({
    projectId: request.projectId,
    sceneId: request.sceneId,
  });
  validateReadScene(readResult, request, readReasons);
  if (readReasons.length > 0) {
    return blockedResult(readReasons, { source002CResultHash: input.source002CResultHash });
  }

  const backupResult = port.writeBackup({
    projectId: request.projectId,
    sceneId: request.sceneId,
    beforeText: request.exactBeforeText,
    beforeSceneHash: request.beforeSceneHash,
  });
  if (!isObject(backupResult) || backupResult.success !== true) {
    return blockedResult([EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_IMPLEMENTATION_REASON_CODES.BACKUP_WRITE_FAILED]);
  }
  const backupObservationHash = canonicalHash({
    observationKind: 'PRIVATE_FIXTURE_BACKUP_OBSERVATION_002D',
    projectId: request.projectId,
    sceneId: request.sceneId,
    beforeSceneHash: request.beforeSceneHash,
    backupResult,
  });

  const atomicWriteResult = port.atomicWriteScene({
    projectId: request.projectId,
    sceneId: request.sceneId,
    nextText: request.exactAfterText,
    expectedBeforeSceneHash: request.beforeSceneHash,
  });
  if (!isObject(atomicWriteResult) || atomicWriteResult.success !== true) {
    return blockedResult([EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_IMPLEMENTATION_REASON_CODES.ATOMIC_WRITE_FAILED]);
  }
  const atomicWriteObservationHash = canonicalHash({
    observationKind: 'PRIVATE_FIXTURE_ATOMIC_WRITE_OBSERVATION_002D',
    projectId: request.projectId,
    sceneId: request.sceneId,
    afterSceneHash: sceneTextHash(request.exactAfterText),
    atomicWriteResult,
  });

  const readbackScene = port.readBackScene({
    projectId: request.projectId,
    sceneId: request.sceneId,
  });
  if (!isObject(readbackScene) || readbackScene.success !== true || readbackScene.text !== request.exactAfterText) {
    return blockedResult([EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_IMPLEMENTATION_REASON_CODES.READBACK_MISMATCH]);
  }

  const receipt = buildReceipt(input, backupObservationHash, atomicWriteObservationHash);
  const receiptWrite = port.writeFixtureReceipt({ receipt });
  if (!isObject(receiptWrite) || receiptWrite.success !== true) {
    return blockedResult([EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_IMPLEMENTATION_REASON_CODES.FIXTURE_RECEIPT_WRITE_FAILED]);
  }
  const receiptReadback = port.readBackFixtureReceipt({
    receiptCanonicalHash: receipt.receiptCanonicalHash,
  });
  const readbackReceipt = receiptReadback?.receipt;
  if (
    !isObject(receiptReadback)
    || receiptReadback.success !== true
    || !isObject(readbackReceipt)
    || readbackReceipt.receiptCanonicalHash !== receipt.receiptCanonicalHash
    || receiptHash(readbackReceipt) !== receipt.receiptCanonicalHash
  ) {
    return blockedResult([EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_IMPLEMENTATION_REASON_CODES.READBACK_MISMATCH]);
  }
  const cleanupObservation = port.observeCleanup({
    projectId: request.projectId,
    sceneId: request.sceneId,
  });
  if (!isObject(cleanupObservation) || cleanupObservation.success !== true || cleanupObservation.cleanupObserved !== true) {
    return blockedResult([EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_IMPLEMENTATION_REASON_CODES.FIXTURE_CLEANUP_NOT_OBSERVED]);
  }
  return acceptedResult(input, receipt, {
    fixtureCleanupObservationHash: canonicalHash({
      observationKind: 'PRIVATE_FIXTURE_CLEANUP_OBSERVATION_002D',
      cleanupObservation,
    }),
  });
}

export function runExactTextApplyWithReceiptPrivatePortImplementation(input = {}) {
  const reasons = [];
  pushForbiddenClaimReasons(input, reasons);
  validateSource002C(input, reasons);
  validateSource002BContractShape(input, reasons);
  validateInheritedChain(input, reasons);
  validateOwnerPacket(input, reasons);
  validateRequestShape(input.exactTextApplyRequest, reasons);
  validateFixturePort(input.injectedPrivateFixturePort, reasons);
  if (reasons.length > 0) {
    return blockedResult(reasons, {
      source002CResultHash: input.source002CResultHash || input.source002CResult?.canonicalHash || null,
      source002CDecisionHash: input.source002CDecisionHash || null,
      source002BContractShapeHash: input.source002BContractShapeHash || input.source002CResult?.contractShapeHash || null,
    });
  }
  return executePrivateFixturePort(input);
}

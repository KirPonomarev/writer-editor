import { canonicalHash, canonicalJson } from './reviewIrKernel.mjs';

const RESULT_KIND = 'PRIVATE_PRODUCT_APPLY_RECEIPT_IMPLEMENTATION_RESULT_001U';
const DECISION_KIND = 'PRIVATE_PRODUCT_APPLY_RECEIPT_IMPLEMENTATION_DECISION_001U';
const RECEIPT_KIND = 'PRIVATE_PRODUCT_APPLY_RECEIPT_V1_001U';
const RECEIPT_VERSION = 'PRIVATE_PRODUCT_APPLY_RECEIPT_SCHEMA_V1';
const SOURCE_001T_RESULT_KIND = 'PRIVATE_PRODUCT_APPLY_RECEIPT_ADMISSION_RESULT_001T';

export const PRIVATE_PRODUCT_APPLY_RECEIPT_REASON_CODES = Object.freeze({
  SOURCE_001T_RESULT_REQUIRED: 'SOURCE_001T_RESULT_REQUIRED',
  SOURCE_001T_RESULT_MISMATCH: 'SOURCE_001T_RESULT_MISMATCH',
  SOURCE_001T_DECISION_MISMATCH: 'SOURCE_001T_DECISION_MISMATCH',
  SOURCE_001T_BLOCKED: 'SOURCE_001T_BLOCKED',
  SOURCE_001T_RUNTIME_ADMISSION_FORBIDDEN: 'SOURCE_001T_RUNTIME_ADMISSION_FORBIDDEN',
  PRIVATE_WRITE_OBSERVATION_REQUIRED: 'PRIVATE_WRITE_OBSERVATION_REQUIRED',
  PROJECT_ID_REQUIRED: 'PROJECT_ID_REQUIRED',
  SCENE_ID_REQUIRED: 'SCENE_ID_REQUIRED',
  BEFORE_SCENE_HASH_REQUIRED: 'BEFORE_SCENE_HASH_REQUIRED',
  AFTER_SCENE_HASH_REQUIRED: 'AFTER_SCENE_HASH_REQUIRED',
  BLOCK_VERSION_HASH_REQUIRED: 'BLOCK_VERSION_HASH_REQUIRED',
  BACKUP_OBSERVATION_HASH_REQUIRED: 'BACKUP_OBSERVATION_HASH_REQUIRED',
  ATOMIC_WRITE_OBSERVATION_HASH_REQUIRED: 'ATOMIC_WRITE_OBSERVATION_HASH_REQUIRED',
  EXACT_TEXT_SCOPE_REQUIRED: 'EXACT_TEXT_SCOPE_REQUIRED',
  UNSUPPORTED_SCOPE_FORBIDDEN: 'UNSUPPORTED_SCOPE_FORBIDDEN',
  PUBLIC_SURFACE_FORBIDDEN: 'PUBLIC_SURFACE_FORBIDDEN',
  COMMAND_SURFACE_FORBIDDEN: 'COMMAND_SURFACE_FORBIDDEN',
  UI_DOCX_NETWORK_DEPENDENCY_FORBIDDEN: 'UI_DOCX_NETWORK_DEPENDENCY_FORBIDDEN',
  APPLYTXN_RECOVERY_RELEASE_FORBIDDEN: 'APPLYTXN_RECOVERY_RELEASE_FORBIDDEN',
  RECEIPT_FILE_TARGET_REQUIRED: 'RECEIPT_FILE_TARGET_REQUIRED',
  RECEIPT_WRITTEN_AT_REQUIRED: 'RECEIPT_WRITTEN_AT_REQUIRED',
  STORAGE_PORTS_REQUIRED: 'STORAGE_PORTS_REQUIRED',
  RECEIPT_WRITE_FAILED: 'RECEIPT_WRITE_FAILED',
  RECEIPT_READBACK_FAILED: 'RECEIPT_READBACK_FAILED',
  RECEIPT_READBACK_HASH_MISMATCH: 'RECEIPT_READBACK_HASH_MISMATCH',
});

const RESULT_FALSE_FLAGS = Object.freeze({
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
    contourId: 'PRIVATE_PRODUCT_APPLY_RECEIPT_IMPLEMENTATION_001U',
    privateInternalOnly: true,
    admissionIsNotPublicRuntime: true,
    ownerAdmissionDoesNotAuthorizeRuntimeApply: true,
    receiptWriteIsNotApplyTxn: true,
    receiptReadbackIsNotRecovery: true,
    backupAndAtomicHashesBoundNotReproven: true,
    privateFunctionOnlyNoPublicSurface: true,
    ...RESULT_FALSE_FLAGS,
    ...input,
  };
}

function blockedResult(blockedReasons, observations = {}) {
  return withCanonicalHash(resultCore({
    outputDecision: 'PRIVATE_PRODUCT_APPLYRECEIPT_IMPLEMENTATION_BLOCKED',
    nextContourAfterPass: null,
    privateProductApplyReceiptImplemented: false,
    receiptReadbackVerified: false,
    receiptHashBound: false,
    receiptFileWritten: false,
    blockedReasons: uniqueReasons(blockedReasons),
    decisions: [],
    receipt: null,
    ...observations,
  }));
}

function acceptedResult(receipt, input) {
  const decisionCore = {
    decisionKind: DECISION_KIND,
    outputDecision: 'PRIVATE_PRODUCT_APPLYRECEIPT_IMPLEMENTED_FOR_EXACT_TEXT_SCOPE_NO_PUBLIC_RUNTIME',
    nextContourAfterPass: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_001V',
    privateProductApplyReceiptImplemented: true,
    privateInternalOnly: true,
    admissionIsNotPublicRuntime: true,
    ownerAdmissionDoesNotAuthorizeRuntimeApply: true,
    receiptWriteIsNotApplyTxn: true,
    receiptReadbackIsNotRecovery: true,
    backupAndAtomicHashesBoundNotReproven: true,
    privateFunctionOnlyNoPublicSurface: true,
    productApplyRuntimeAdmitted: false,
    publicSurfaceClaimed: false,
    applyTxnImplemented: false,
    recoveryClaimed: false,
  };
  const decision = withCanonicalHash(decisionCore);
  return withCanonicalHash(resultCore({
    outputDecision: decision.outputDecision,
    nextContourAfterPass: decision.nextContourAfterPass,
    privateProductApplyReceiptImplemented: true,
    exactTextOnly: true,
    singleSceneOnly: true,
    receiptReadbackVerified: true,
    receiptHashBound: true,
    receiptFileWritten: true,
    source001TResultHash: input.source001TResultHash,
    source001TDecisionHash: input.source001TDecisionHash,
    receiptCanonicalHash: receipt.receiptCanonicalHash,
    blockedReasons: [],
    decisions: [decision],
    receipt,
  }));
}

function validate001T(input, reasons) {
  const source = input.source001TResult;
  if (!isObject(source)) {
    reasons.push(PRIVATE_PRODUCT_APPLY_RECEIPT_REASON_CODES.SOURCE_001T_RESULT_REQUIRED);
    return;
  }
  const decision = Array.isArray(source.decisions) ? source.decisions[0] : null;
  if (
    source.resultKind !== SOURCE_001T_RESULT_KIND
    || source.outputDecision !== 'OWNER_MAY_OPEN_PRIVATE_PRODUCT_APPLYRECEIPT_IMPLEMENTATION_001U_NO_RUNTIME_ADMISSION'
    || source.nextContourAfterPass !== 'PRIVATE_PRODUCT_APPLY_RECEIPT_IMPLEMENTATION_001U'
    || source.ownerMayOpen001U !== true
    || source.blockedReasons?.length
    || !isObject(decision)
  ) {
    reasons.push(PRIVATE_PRODUCT_APPLY_RECEIPT_REASON_CODES.SOURCE_001T_BLOCKED);
  }
  if (
    !hasText(source.canonicalHash)
    || source.canonicalHash !== canonicalHash(withoutHash(source))
    || source.canonicalHash !== input.source001TResultHash
  ) {
    reasons.push(PRIVATE_PRODUCT_APPLY_RECEIPT_REASON_CODES.SOURCE_001T_RESULT_MISMATCH);
  }
  if (
    !hasText(decision?.canonicalHash)
    || decision.canonicalHash !== canonicalHash(withoutHash(decision))
    || decision.canonicalHash !== input.source001TDecisionHash
  ) {
    reasons.push(PRIVATE_PRODUCT_APPLY_RECEIPT_REASON_CODES.SOURCE_001T_DECISION_MISMATCH);
  }
  if (
    source.productApplyRuntimeAdmitted !== false
    || source.publicSurfaceAllowed !== false
    || source.userProjectWriteAllowedIn001T !== false
    || source.publicSurfaceClaimed !== false
    || source.ipcSurfaceClaimed !== false
    || source.uiChanged !== false
    || source.docxImportClaimed !== false
    || source.applyTxnImplemented !== false
    || source.recoveryClaimed !== false
    || source.releaseClaimed !== false
    || source.admissionIsNotRuntimeAdmission !== true
    || source.fixtureReceiptEvidenceIsNotProductReceiptProof !== true
  ) {
    reasons.push(PRIVATE_PRODUCT_APPLY_RECEIPT_REASON_CODES.SOURCE_001T_RUNTIME_ADMISSION_FORBIDDEN);
  }
}

function validatePrivateWriteObservation(input, reasons) {
  const observation = input.privateWriteObservation;
  if (!isObject(observation)) {
    reasons.push(PRIVATE_PRODUCT_APPLY_RECEIPT_REASON_CODES.PRIVATE_WRITE_OBSERVATION_REQUIRED);
    return;
  }
  if (!hasText(observation.projectId)) {
    reasons.push(PRIVATE_PRODUCT_APPLY_RECEIPT_REASON_CODES.PROJECT_ID_REQUIRED);
  }
  if (!hasText(observation.sceneId)) {
    reasons.push(PRIVATE_PRODUCT_APPLY_RECEIPT_REASON_CODES.SCENE_ID_REQUIRED);
  }
  if (!hasText(observation.beforeSceneHash)) {
    reasons.push(PRIVATE_PRODUCT_APPLY_RECEIPT_REASON_CODES.BEFORE_SCENE_HASH_REQUIRED);
  }
  if (!hasText(observation.afterSceneHash)) {
    reasons.push(PRIVATE_PRODUCT_APPLY_RECEIPT_REASON_CODES.AFTER_SCENE_HASH_REQUIRED);
  }
  if (!hasText(observation.blockVersionHash)) {
    reasons.push(PRIVATE_PRODUCT_APPLY_RECEIPT_REASON_CODES.BLOCK_VERSION_HASH_REQUIRED);
  }
  if (!hasText(observation.backupObservationHash)) {
    reasons.push(PRIVATE_PRODUCT_APPLY_RECEIPT_REASON_CODES.BACKUP_OBSERVATION_HASH_REQUIRED);
  }
  if (!hasText(observation.atomicWriteObservationHash)) {
    reasons.push(PRIVATE_PRODUCT_APPLY_RECEIPT_REASON_CODES.ATOMIC_WRITE_OBSERVATION_HASH_REQUIRED);
  }
  if (
    observation.operationKind !== 'EXACT_TEXT_REPLACE'
    || observation.exactTextOnly !== true
    || observation.singleSceneOnly !== true
  ) {
    reasons.push(PRIVATE_PRODUCT_APPLY_RECEIPT_REASON_CODES.EXACT_TEXT_SCOPE_REQUIRED);
  }
  if (
    observation.multiSceneApplyClaimed === true
    || observation.structuralApplyClaimed === true
    || observation.commentApplyClaimed === true
    || observation.multiSceneScope === true
    || observation.structuralOperation === true
    || observation.commentOperation === true
  ) {
    reasons.push(PRIVATE_PRODUCT_APPLY_RECEIPT_REASON_CODES.UNSUPPORTED_SCOPE_FORBIDDEN);
  }
}

function validateForbiddenClaims(input, reasons) {
  if (input.publicSurfaceRequested === true || input.publicSurfaceClaimed === true) {
    reasons.push(PRIVATE_PRODUCT_APPLY_RECEIPT_REASON_CODES.PUBLIC_SURFACE_FORBIDDEN);
  }
  if (
    input.ipcSurfaceClaimed === true
    || input.preloadExportClaimed === true
    || input.menuSurfaceClaimed === true
    || input.commandSurfaceClaimed === true
  ) {
    reasons.push(PRIVATE_PRODUCT_APPLY_RECEIPT_REASON_CODES.COMMAND_SURFACE_FORBIDDEN);
  }
  if (
    input.uiChanged === true
    || input.docxImportClaimed === true
    || input.networkUsed === true
    || input.dependencyChanged === true
  ) {
    reasons.push(PRIVATE_PRODUCT_APPLY_RECEIPT_REASON_CODES.UI_DOCX_NETWORK_DEPENDENCY_FORBIDDEN);
  }
  if (
    input.productApplyRuntimeAdmitted === true
    || input.applyTxnImplemented === true
    || input.recoveryClaimed === true
    || input.releaseClaimed === true
  ) {
    reasons.push(PRIVATE_PRODUCT_APPLY_RECEIPT_REASON_CODES.APPLYTXN_RECOVERY_RELEASE_FORBIDDEN);
  }
}

function validateReceiptTarget(input, reasons) {
  if (!hasText(input.receiptFileTarget)) {
    reasons.push(PRIVATE_PRODUCT_APPLY_RECEIPT_REASON_CODES.RECEIPT_FILE_TARGET_REQUIRED);
  }
  if (!hasText(input.receiptWrittenAt)) {
    reasons.push(PRIVATE_PRODUCT_APPLY_RECEIPT_REASON_CODES.RECEIPT_WRITTEN_AT_REQUIRED);
  }
  if (
    !isObject(input.storagePorts)
    || typeof input.storagePorts.writeFileAtomic !== 'function'
    || typeof input.storagePorts.readFile !== 'function'
  ) {
    reasons.push(PRIVATE_PRODUCT_APPLY_RECEIPT_REASON_CODES.STORAGE_PORTS_REQUIRED);
  }
}

function buildReceipt(input) {
  const observation = input.privateWriteObservation;
  const receiptCore = {
    receiptKind: RECEIPT_KIND,
    receiptVersion: RECEIPT_VERSION,
    contourId: 'PRIVATE_PRODUCT_APPLY_RECEIPT_IMPLEMENTATION_001U',
    projectId: observation.projectId,
    sceneId: observation.sceneId,
    operationKind: observation.operationKind,
    exactTextOnly: true,
    singleSceneOnly: true,
    source001TResultHash: input.source001TResultHash,
    source001TDecisionHash: input.source001TDecisionHash,
    beforeSceneHash: observation.beforeSceneHash,
    afterSceneHash: observation.afterSceneHash,
    blockVersionHash: observation.blockVersionHash,
    backupObservationHash: observation.backupObservationHash,
    atomicWriteObservationHash: observation.atomicWriteObservationHash,
    backupAndAtomicHashesBoundNotReproven: true,
    receiptWriteIsNotApplyTxn: true,
    receiptReadbackIsNotRecovery: true,
    ownerAdmissionDoesNotAuthorizeRuntimeApply: true,
    privateFunctionOnlyNoPublicSurface: true,
    productApplyRuntimeAdmittedFalse: true,
    publicSurfaceClaimedFalse: true,
    applyTxnImplementedFalse: true,
    recoveryClaimedFalse: true,
    receiptWrittenAt: input.receiptWrittenAt,
  };
  return {
    ...receiptCore,
    receiptCanonicalHash: canonicalHash(receiptCore),
  };
}

export async function runExactTextApplyPrivateProductApplyReceipt(input = {}) {
  const reasons = [];
  validate001T(input, reasons);
  validatePrivateWriteObservation(input, reasons);
  validateForbiddenClaims(input, reasons);
  validateReceiptTarget(input, reasons);
  if (reasons.length > 0) {
    return blockedResult(reasons);
  }

  const receipt = buildReceipt(input);
  const writeResult = await input.storagePorts.writeFileAtomic(input.receiptFileTarget, `${canonicalJson(receipt)}\n`);
  if (!writeResult || writeResult.success !== true) {
    return blockedResult([PRIVATE_PRODUCT_APPLY_RECEIPT_REASON_CODES.RECEIPT_WRITE_FAILED], {
      receiptWriteError: String(writeResult?.error || 'receipt write failed'),
    });
  }

  const readbackText = await input.storagePorts.readFile(input.receiptFileTarget);
  if (typeof readbackText !== 'string') {
    return blockedResult([PRIVATE_PRODUCT_APPLY_RECEIPT_REASON_CODES.RECEIPT_READBACK_FAILED]);
  }
  let readbackReceipt = null;
  try {
    readbackReceipt = JSON.parse(readbackText);
  } catch {
    return blockedResult([PRIVATE_PRODUCT_APPLY_RECEIPT_REASON_CODES.RECEIPT_READBACK_HASH_MISMATCH]);
  }
  if (
    readbackReceipt.receiptCanonicalHash !== receipt.receiptCanonicalHash
    || receiptHash(readbackReceipt) !== receipt.receiptCanonicalHash
  ) {
    return blockedResult([PRIVATE_PRODUCT_APPLY_RECEIPT_REASON_CODES.RECEIPT_READBACK_HASH_MISMATCH]);
  }

  return acceptedResult(receipt, input);
}

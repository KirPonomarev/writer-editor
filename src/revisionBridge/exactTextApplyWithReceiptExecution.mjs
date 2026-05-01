import { canonicalHash, canonicalJson } from './reviewIrKernel.mjs';

const RESULT_KIND = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_RESULT_001W';
const DECISION_KIND = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_DECISION_001W';
const RECEIPT_KIND = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_V1_001W';
const RECEIPT_VERSION = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_SCHEMA_V1';
const SOURCE_001V_RESULT_KIND = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_RESULT_001V';

export const EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_REASON_CODES = Object.freeze({
  SOURCE_001V_RESULT_REQUIRED: 'SOURCE_001V_RESULT_REQUIRED',
  SOURCE_001V_RESULT_MISMATCH: 'SOURCE_001V_RESULT_MISMATCH',
  SOURCE_001V_DECISION_MISMATCH: 'SOURCE_001V_DECISION_MISMATCH',
  SOURCE_001V_BLOCKED: 'SOURCE_001V_BLOCKED',
  SOURCE_001V_RUNTIME_FLAG_FORBIDDEN: 'SOURCE_001V_RUNTIME_FLAG_FORBIDDEN',
  PRIVATE_ROOT_POLICY_REQUIRED: 'PRIVATE_ROOT_POLICY_REQUIRED',
  USER_PROJECT_PATH_FORBIDDEN: 'USER_PROJECT_PATH_FORBIDDEN',
  SCENE_TARGET_POLICY_REQUIRED: 'SCENE_TARGET_POLICY_REQUIRED',
  RECEIPT_TARGET_POLICY_REQUIRED: 'RECEIPT_TARGET_POLICY_REQUIRED',
  PATH_TRAVERSAL_FORBIDDEN: 'PATH_TRAVERSAL_FORBIDDEN',
  PATH_BOUNDARY_VIOLATION: 'PATH_BOUNDARY_VIOLATION',
  SYMLINK_POLICY_UNSAFE: 'SYMLINK_POLICY_UNSAFE',
  UNSAFE_BASENAME: 'UNSAFE_BASENAME',
  TARGET_COLLISION_FORBIDDEN: 'TARGET_COLLISION_FORBIDDEN',
  PROJECT_ID_MISMATCH: 'PROJECT_ID_MISMATCH',
  SCENE_ID_MISMATCH: 'SCENE_ID_MISMATCH',
  CLOSED_SESSION: 'CLOSED_SESSION',
  STALE_BASELINE: 'STALE_BASELINE',
  BLOCK_VERSION_MISMATCH: 'BLOCK_VERSION_MISMATCH',
  EXACT_TEXT_MISMATCH: 'EXACT_TEXT_MISMATCH',
  UNSUPPORTED_OP_KIND: 'UNSUPPORTED_OP_KIND',
  MULTI_SCOPE_WRITE_BLOCKED: 'MULTI_SCOPE_WRITE_BLOCKED',
  STRUCTURAL_WRITE_BLOCKED: 'STRUCTURAL_WRITE_BLOCKED',
  COMMENT_WRITE_BLOCKED: 'COMMENT_WRITE_BLOCKED',
  STORAGE_PORTS_REQUIRED: 'STORAGE_PORTS_REQUIRED',
  PRIVATE_EXECUTION_POLICY_REQUIRED: 'PRIVATE_EXECUTION_POLICY_REQUIRED',
  RECEIPT_WRITTEN_AT_REQUIRED: 'RECEIPT_WRITTEN_AT_REQUIRED',
  RESOLVED_PATH_POLICY_REQUIRED: 'RESOLVED_PATH_POLICY_REQUIRED',
  TARGET_DIRECTORY_FORBIDDEN: 'TARGET_DIRECTORY_FORBIDDEN',
  SCENE_READ_FAILED: 'SCENE_READ_FAILED',
  BACKUP_FAILED: 'BACKUP_FAILED',
  ATOMIC_WRITE_FAILED: 'ATOMIC_WRITE_FAILED',
  AFTER_WRITE_HASH_MISMATCH: 'AFTER_WRITE_HASH_MISMATCH',
  RECEIPT_WRITE_FAILED: 'RECEIPT_WRITE_FAILED',
  RECEIPT_READBACK_FAILED: 'RECEIPT_READBACK_FAILED',
  RECEIPT_READBACK_HASH_MISMATCH: 'RECEIPT_READBACK_HASH_MISMATCH',
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

function sceneTextHash(text) {
  return canonicalHash({
    hashKind: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_SCENE_TEXT_HASH_V1_001W',
    text,
  });
}

function resultCore(input) {
  return {
    resultKind: RESULT_KIND,
    contourId: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_001W',
    privatePortExecutionOnly: true,
    privateInternalOnly: true,
    exactTextOnly: true,
    singleSceneOnly: true,
    receiptIsNotRecovery: true,
    receiptReadbackIsNotStartupRecovery: true,
    atomicSingleFileWriteIsNotApplyTxn: true,
    multiFileConsistencyNotClaimed: true,
    backupSubsystemNotReproven: true,
    ...FALSE_FLAGS,
    ...input,
  };
}

function blockedResult(blockedReasons, observations = {}) {
  return withCanonicalHash(resultCore({
    outputDecision: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_BLOCKED',
    nextContourAfterPass: null,
    privateExactTextApplyWithReceiptExecuted: false,
    receiptWritten: false,
    receiptReadbackVerified: false,
    backupAttempted: false,
    sceneWriteAttempted: false,
    receiptWriteAttempted: false,
    blockedReasons: uniqueReasons(blockedReasons),
    decisions: [],
    receipt: null,
    ...observations,
  }));
}

function acceptedResult(receipt, input, observations) {
  const decisionCore = {
    decisionKind: DECISION_KIND,
    outputDecision: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTED_NO_PUBLIC_RUNTIME',
    nextContourAfterPass: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_CLOSEOUT_001X',
    privatePortExecutionOnly: true,
    privateExactTextApplyWithReceiptExecuted: true,
    exactTextOnly: true,
    singleSceneOnly: true,
    productApplyRuntimeAdmitted: false,
    publicRuntimeAdmitted: false,
    applyTxnImplemented: false,
    recoveryClaimed: false,
    userProjectMutated: false,
  };
  const decision = withCanonicalHash(decisionCore);
  return withCanonicalHash(resultCore({
    outputDecision: decision.outputDecision,
    nextContourAfterPass: decision.nextContourAfterPass,
    privateExactTextApplyWithReceiptExecuted: true,
    receiptWritten: true,
    receiptReadbackVerified: true,
    backupAttempted: true,
    sceneWriteAttempted: true,
    receiptWriteAttempted: true,
    source001VResultHash: input.source001VResultHash,
    source001VDecisionHash: input.source001VDecisionHash,
    beforeSceneHash: observations.beforeSceneHash,
    afterSceneHash: observations.afterSceneHash,
    backupObservationHash: observations.backupObservationHash,
    atomicWriteObservationHash: observations.atomicWriteObservationHash,
    receiptCanonicalHash: receipt.receiptCanonicalHash,
    blockedReasons: [],
    decisions: [decision],
    receipt,
  }));
}

function validate001V(input, reasons) {
  const source = input.source001VResult;
  if (!isObject(source)) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_REASON_CODES.SOURCE_001V_RESULT_REQUIRED);
    return;
  }
  const decision = Array.isArray(source.decisions) ? source.decisions[0] : null;
  if (
    source.resultKind !== SOURCE_001V_RESULT_KIND
    || source.outputDecision !== 'OWNER_MAY_OPEN_PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_001W_NO_PUBLIC_RUNTIME'
    || source.nextContourAfterPass !== 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_001W'
    || source.ownerMayOpen001W !== true
    || source.exactTextApplyWithReceiptAdmissionOnly !== true
    || source.admissionDoesNotImplementApplyExecution !== true
    || source.admissionDoesNotMutateUserProject !== true
    || source.admissionDoesNotAuthorizePublicRuntime !== true
    || source.zeroApplyExecutionEffects !== true
    || !hasText(source.source001UResultHash)
    || !hasText(source.source001UDecisionHash)
    || !hasText(source.source001UReceiptHash)
    || source.blockedReasons?.length
    || !isObject(decision)
    || decision.decisionKind !== 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_DECISION_001V'
    || decision.outputDecision !== source.outputDecision
    || decision.nextContourAfterPass !== source.nextContourAfterPass
    || decision.admissionDoesNotImplementApplyExecution !== true
    || decision.admissionDoesNotMutateUserProject !== true
    || decision.admissionDoesNotAuthorizePublicRuntime !== true
    || decision.zeroApplyExecutionEffects !== true
    || decision.applyExecutionImplemented !== false
    || decision.userProjectMutated !== false
    || decision.publicRuntimeAdmitted !== false
    || decision.applyTxnImplemented !== false
    || decision.recoveryClaimed !== false
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_REASON_CODES.SOURCE_001V_BLOCKED);
  }
  if (
    !hasText(source.canonicalHash)
    || source.canonicalHash !== canonicalHash(withoutHash(source))
    || source.canonicalHash !== input.source001VResultHash
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_REASON_CODES.SOURCE_001V_RESULT_MISMATCH);
  }
  if (
    !hasText(decision?.canonicalHash)
    || decision.canonicalHash !== canonicalHash(withoutHash(decision))
    || decision.canonicalHash !== input.source001VDecisionHash
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_REASON_CODES.SOURCE_001V_DECISION_MISMATCH);
  }
  if (
    source.applyExecutionImplemented !== false
    || source.userProjectMutated !== false
    || source.publicRuntimeAdmitted !== false
    || source.productApplyRuntimeAdmitted !== false
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
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_REASON_CODES.SOURCE_001V_RUNTIME_FLAG_FORBIDDEN);
  }
}

function normalizePathText(value) {
  return String(value ?? '').replace(/\\/gu, '/').replace(/\/+/gu, '/').replace(/\/$/u, '');
}

function pathSegments(value) {
  return normalizePathText(value).split('/').filter(Boolean);
}

function hasTraversal(value) {
  return pathSegments(value).includes('..');
}

function basenameOf(value) {
  const parts = pathSegments(value);
  return parts[parts.length - 1] || '';
}

function isSafeBasename(value) {
  return hasText(value)
    && value === basenameOf(value)
    && value !== '.'
    && value !== '..'
    && !value.includes('/')
    && !value.includes('\\')
    && !value.includes('\0');
}

function isInside(root, target) {
  const normalizedRoot = normalizePathText(root);
  const normalizedTarget = normalizePathText(target);
  return hasText(normalizedRoot)
    && hasText(normalizedTarget)
    && (normalizedTarget === normalizedRoot || normalizedTarget.startsWith(`${normalizedRoot}/`));
}

function validatePathPolicy(input, reasons) {
  if (
    !hasText(input.privateExecutionRoot)
    || input.privateExecutionRootInsideTempRoot !== true
    || input.privateExecutionRootIsUserProjectRoot !== false
    || input.privateExecutionAllowed !== true
    || input.userProjectPathAllowed !== false
    || input.productRootAccess !== false
    || input.repoRootAccess !== false
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_REASON_CODES.PRIVATE_ROOT_POLICY_REQUIRED);
  }
  if (
    input.userProjectRootAccess === true
    || input.userProjectMutated === true
    || input.realUserProjectPathTouched === true
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_REASON_CODES.USER_PROJECT_PATH_FORBIDDEN);
  }
  if (!hasText(input.sceneFileTarget) || input.sceneFileTargetInsidePrivateExecutionRoot !== true) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_REASON_CODES.SCENE_TARGET_POLICY_REQUIRED);
  }
  if (!hasText(input.receiptFileTarget) || input.receiptFileTargetInsidePrivateExecutionRoot !== true) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_REASON_CODES.RECEIPT_TARGET_POLICY_REQUIRED);
  }
  if (hasTraversal(input.privateExecutionRoot) || hasTraversal(input.sceneFileTarget) || hasTraversal(input.receiptFileTarget)) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_REASON_CODES.PATH_TRAVERSAL_FORBIDDEN);
  }
  if (
    !isInside(input.privateExecutionRoot, input.sceneFileTarget)
    || !isInside(input.privateExecutionRoot, input.receiptFileTarget)
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_REASON_CODES.PATH_BOUNDARY_VIOLATION);
  }
  if (input.sceneTargetSymlinkEscape === true || input.receiptTargetSymlinkEscape === true) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_REASON_CODES.SYMLINK_POLICY_UNSAFE);
  }
  if (!isSafeBasename(input.sceneFileBasename) || basenameOf(input.sceneFileTarget) !== input.sceneFileBasename) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_REASON_CODES.UNSAFE_BASENAME);
  }
  if (!isSafeBasename(input.receiptFileBasename) || basenameOf(input.receiptFileTarget) !== input.receiptFileBasename) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_REASON_CODES.UNSAFE_BASENAME);
  }
  if (normalizePathText(input.sceneFileTarget) === normalizePathText(input.receiptFileTarget)) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_REASON_CODES.TARGET_COLLISION_FORBIDDEN);
  }
}

function validateResolvedPathInfo(input, pathInfo, reasons) {
  if (!isObject(pathInfo) || pathInfo.success !== true) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_REASON_CODES.RESOLVED_PATH_POLICY_REQUIRED);
    return;
  }
  if (
    !isInside(pathInfo.privateExecutionRootRealPath, pathInfo.sceneFileRealPath)
    || !isInside(pathInfo.privateExecutionRootRealPath, pathInfo.receiptFileRealPath)
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_REASON_CODES.PATH_BOUNDARY_VIOLATION);
  }
  if (pathInfo.privateExecutionRootInsideTempRoot !== true || pathInfo.privateExecutionRootIsUserProjectRoot !== false) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_REASON_CODES.PRIVATE_ROOT_POLICY_REQUIRED);
  }
  if (pathInfo.sceneTargetSymlinkEscape === true || pathInfo.receiptTargetSymlinkEscape === true) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_REASON_CODES.SYMLINK_POLICY_UNSAFE);
  }
  if (pathInfo.sceneTargetIsDirectory === true || pathInfo.receiptTargetIsDirectory === true) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_REASON_CODES.TARGET_DIRECTORY_FORBIDDEN);
  }
  if (
    normalizePathText(pathInfo.sceneFileRealPath) !== normalizePathText(input.sceneFileTarget)
    || normalizePathText(pathInfo.receiptFileRealPath) !== normalizePathText(input.receiptFileTarget)
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_REASON_CODES.PATH_BOUNDARY_VIOLATION);
  }
}

function validatePorts(input, reasons) {
  if (
    !isObject(input.storagePorts)
    || typeof input.storagePorts.resolvePathInfo !== 'function'
    || typeof input.storagePorts.createBackup !== 'function'
    || typeof input.storagePorts.writeFileAtomic !== 'function'
    || typeof input.storagePorts.readFile !== 'function'
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_REASON_CODES.STORAGE_PORTS_REQUIRED);
  }
  if (!hasText(input.receiptWrittenAt)) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_REASON_CODES.RECEIPT_WRITTEN_AT_REQUIRED);
  }
}

function validateForbiddenClaims(input, reasons) {
  if (input.productApplyRuntimeAdmitted === true || input.publicRuntimeAdmitted === true) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_REASON_CODES.PRODUCT_RUNTIME_FORBIDDEN);
  }
  if (
    input.publicSurfaceClaimed === true
    || input.ipcSurfaceClaimed === true
    || input.preloadExportClaimed === true
    || input.menuSurfaceClaimed === true
    || input.commandSurfaceClaimed === true
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_REASON_CODES.PUBLIC_COMMAND_SURFACE_FORBIDDEN);
  }
  if (
    input.uiChanged === true
    || input.docxImportClaimed === true
    || input.networkUsed === true
    || input.dependencyChanged === true
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_REASON_CODES.UI_DOCX_NETWORK_DEPENDENCY_FORBIDDEN);
  }
  if (
    input.applyTxnImplemented === true
    || input.recoveryClaimed === true
    || input.startupRecoveryClaimed === true
    || input.releaseClaimed === true
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_REASON_CODES.APPLYTXN_RECOVERY_RELEASE_FORBIDDEN);
  }
  if (input.userProjectMutated === true || input.realUserProjectPathTouched === true) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_REASON_CODES.USER_PROJECT_MUTATION_FORBIDDEN);
  }
}

function validatePreconditions(input, beforeText, reasons) {
  if (!hasText(input.projectId) || !hasText(input.expectedProjectId) || input.projectId !== input.expectedProjectId) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_REASON_CODES.PROJECT_ID_MISMATCH);
  }
  if (!hasText(input.sceneId) || !hasText(input.expectedSceneId) || input.sceneId !== input.expectedSceneId) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_REASON_CODES.SCENE_ID_MISMATCH);
  }
  if (input.sessionOpen !== true) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_REASON_CODES.CLOSED_SESSION);
  }
  const beforeSceneHash = sceneTextHash(beforeText);
  if (
    !hasText(input.expectedBaselineHash)
    || !hasText(input.currentBaselineHash)
    || input.expectedBaselineHash !== input.currentBaselineHash
    || beforeSceneHash !== input.expectedBaselineHash
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_REASON_CODES.STALE_BASELINE);
  }
  if (!hasText(input.blockVersionHash) || !hasText(input.expectedBlockVersionHash) || input.blockVersionHash !== input.expectedBlockVersionHash) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_REASON_CODES.BLOCK_VERSION_MISMATCH);
  }
  if (beforeText !== input.exactBeforeText) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_REASON_CODES.EXACT_TEXT_MISMATCH);
  }
  if (input.operationKind !== 'EXACT_TEXT_REPLACE') {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_REASON_CODES.UNSUPPORTED_OP_KIND);
  }
  if (input.singleSceneOnly !== true || input.multiSceneApplyClaimed === true || input.multiSceneScope === true) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_REASON_CODES.MULTI_SCOPE_WRITE_BLOCKED);
  }
  if (input.exactTextOnly !== true || input.structuralApplyClaimed === true || input.structuralOperation === true) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_REASON_CODES.STRUCTURAL_WRITE_BLOCKED);
  }
  if (input.commentApplyClaimed === true || input.commentOperation === true) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_REASON_CODES.COMMENT_WRITE_BLOCKED);
  }
}

function buildReceipt(input, observations) {
  const receiptCore = {
    receiptKind: RECEIPT_KIND,
    receiptVersion: RECEIPT_VERSION,
    contourId: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_001W',
    projectId: input.projectId,
    sceneId: input.sceneId,
    sceneFileBasename: input.sceneFileBasename,
    operationKind: input.operationKind,
    exactTextOnly: true,
    singleSceneOnly: true,
    source001VResultHash: input.source001VResultHash,
    source001VDecisionHash: input.source001VDecisionHash,
    source001UResultHash: input.source001VResult.source001UResultHash,
    source001UDecisionHash: input.source001VResult.source001UDecisionHash,
    source001UReceiptHash: input.source001VResult.source001UReceiptHash,
    beforeSceneHash: observations.beforeSceneHash,
    afterSceneHash: observations.afterSceneHash,
    blockVersionHash: input.blockVersionHash,
    backupObservationHash: observations.backupObservationHash,
    atomicWriteObservationHash: observations.atomicWriteObservationHash,
    receiptIsNotRecovery: true,
    receiptReadbackIsNotStartupRecovery: true,
    atomicSingleFileWriteIsNotApplyTxn: true,
    multiFileConsistencyNotClaimed: true,
    backupSubsystemNotReproven: true,
    productApplyRuntimeAdmittedFalse: true,
    publicRuntimeAdmittedFalse: true,
    applyTxnImplementedFalse: true,
    recoveryClaimedFalse: true,
    userProjectMutatedFalse: true,
    receiptWrittenAt: input.receiptWrittenAt,
  };
  return {
    ...receiptCore,
    receiptCanonicalHash: canonicalHash(receiptCore),
  };
}

export async function runExactTextApplyWithReceiptExecution(input = {}) {
  const reasons = [];
  validate001V(input, reasons);
  validatePathPolicy(input, reasons);
  validatePorts(input, reasons);
  validateForbiddenClaims(input, reasons);
  if (reasons.length > 0) {
    return blockedResult(reasons);
  }

  const pathInfo = await input.storagePorts.resolvePathInfo({
    privateExecutionRoot: input.privateExecutionRoot,
    sceneFileTarget: input.sceneFileTarget,
    receiptFileTarget: input.receiptFileTarget,
  });
  validateResolvedPathInfo(input, pathInfo, reasons);
  if (reasons.length > 0) {
    return blockedResult(reasons);
  }

  const beforeText = await input.storagePorts.readFile(input.sceneFileTarget);
  if (typeof beforeText !== 'string') {
    return blockedResult([EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_REASON_CODES.SCENE_READ_FAILED]);
  }

  validatePreconditions(input, beforeText, reasons);
  if (reasons.length > 0) {
    return blockedResult(reasons, {
      beforeSceneHash: sceneTextHash(beforeText),
    });
  }

  const backupResult = await input.storagePorts.createBackup(input.sceneFileTarget, beforeText, {
    basePath: input.privateExecutionRoot,
  });
  if (!backupResult || backupResult.success !== true) {
    return blockedResult([EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_REASON_CODES.BACKUP_FAILED], {
      backupAttempted: true,
      beforeSceneHash: sceneTextHash(beforeText),
      backupError: String(backupResult?.error || 'backup failed'),
    });
  }
  const backupObservationHash = canonicalHash({
    backupResult,
    sceneFileBasename: input.sceneFileBasename,
  });

  const writeResult = await input.storagePorts.writeFileAtomic(input.sceneFileTarget, input.exactAfterText);
  if (!writeResult || writeResult.success !== true) {
    return blockedResult([EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_REASON_CODES.ATOMIC_WRITE_FAILED], {
      backupAttempted: true,
      sceneWriteAttempted: true,
      beforeSceneHash: sceneTextHash(beforeText),
      backupObservationHash,
      atomicWriteError: String(writeResult?.error || 'atomic write failed'),
    });
  }

  const afterText = await input.storagePorts.readFile(input.sceneFileTarget);
  const afterSceneHash = sceneTextHash(afterText);
  if (afterText !== input.exactAfterText) {
    return blockedResult([EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_REASON_CODES.AFTER_WRITE_HASH_MISMATCH], {
      backupAttempted: true,
      sceneWriteAttempted: true,
      beforeSceneHash: sceneTextHash(beforeText),
      afterSceneHash,
      backupObservationHash,
    });
  }
  const atomicWriteObservationHash = canonicalHash({
    writeResult,
    sceneFileBasename: input.sceneFileBasename,
    afterSceneHash,
  });

  const receipt = buildReceipt(input, {
    beforeSceneHash: sceneTextHash(beforeText),
    afterSceneHash,
    backupObservationHash,
    atomicWriteObservationHash,
  });
  const receiptWriteResult = await input.storagePorts.writeFileAtomic(input.receiptFileTarget, `${canonicalJson(receipt)}\n`);
  if (!receiptWriteResult || receiptWriteResult.success !== true) {
    return blockedResult([EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_REASON_CODES.RECEIPT_WRITE_FAILED], {
      backupAttempted: true,
      sceneWriteAttempted: true,
      receiptWriteAttempted: true,
      beforeSceneHash: sceneTextHash(beforeText),
      afterSceneHash,
      backupObservationHash,
      atomicWriteObservationHash,
      receiptWriteError: String(receiptWriteResult?.error || 'receipt write failed'),
    });
  }

  const readbackText = await input.storagePorts.readFile(input.receiptFileTarget);
  if (typeof readbackText !== 'string') {
    return blockedResult([EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_REASON_CODES.RECEIPT_READBACK_FAILED], {
      backupAttempted: true,
      sceneWriteAttempted: true,
      receiptWriteAttempted: true,
      beforeSceneHash: sceneTextHash(beforeText),
      afterSceneHash,
      backupObservationHash,
      atomicWriteObservationHash,
    });
  }
  let readbackReceipt = null;
  try {
    readbackReceipt = JSON.parse(readbackText);
  } catch {
    return blockedResult([EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_REASON_CODES.RECEIPT_READBACK_HASH_MISMATCH], {
      backupAttempted: true,
      sceneWriteAttempted: true,
      receiptWriteAttempted: true,
      beforeSceneHash: sceneTextHash(beforeText),
      afterSceneHash,
      backupObservationHash,
      atomicWriteObservationHash,
    });
  }
  if (
    readbackReceipt.receiptCanonicalHash !== receipt.receiptCanonicalHash
    || receiptHash(readbackReceipt) !== receipt.receiptCanonicalHash
  ) {
    return blockedResult([EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_REASON_CODES.RECEIPT_READBACK_HASH_MISMATCH], {
      backupAttempted: true,
      sceneWriteAttempted: true,
      receiptWriteAttempted: true,
      beforeSceneHash: sceneTextHash(beforeText),
      afterSceneHash,
      backupObservationHash,
      atomicWriteObservationHash,
    });
  }

  return acceptedResult(receipt, input, {
    beforeSceneHash: sceneTextHash(beforeText),
    afterSceneHash,
    backupObservationHash,
    atomicWriteObservationHash,
  });
}

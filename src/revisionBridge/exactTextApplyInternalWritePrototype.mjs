import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { canonicalHash } from './reviewIrKernel.mjs';

const RESULT_KIND = 'EXACT_TEXT_INTERNAL_WRITE_PATH_PROTOTYPE_RESULT_001R';
const DECISION_KIND = 'EXACT_TEXT_INTERNAL_WRITE_PATH_PROTOTYPE_DECISION_001R';
const RECEIPT_DRAFT_KIND = 'EXACT_TEXT_INTERNAL_WRITE_RECEIPT_DRAFT_001R';

export const INTERNAL_WRITE_PROTOTYPE_REASON_CODES = Object.freeze({
  OWNER_ADMISSION_MISSING: 'OWNER_ADMISSION_MISSING',
  OWNER_ADMISSION_NOT_001Q: 'OWNER_ADMISSION_NOT_001Q',
  PRODUCT_WRITE_STILL_FORBIDDEN: 'PRODUCT_WRITE_STILL_FORBIDDEN',
  FIXTURE_ROOT_POLICY_REQUIRED: 'FIXTURE_ROOT_POLICY_REQUIRED',
  USER_PROJECT_PATH_FORBIDDEN: 'USER_PROJECT_PATH_FORBIDDEN',
  PATH_BOUNDARY_VIOLATION: 'PATH_BOUNDARY_VIOLATION',
  SCENE_FILE_BASENAME_REQUIRED: 'SCENE_FILE_BASENAME_REQUIRED',
  SCENE_FILE_SYMLINK_FORBIDDEN: 'SCENE_FILE_SYMLINK_FORBIDDEN',
  SCENE_FILE_DIRECTORY_FORBIDDEN: 'SCENE_FILE_DIRECTORY_FORBIDDEN',
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
  LOW_RISK_EXACT_TEXT_POLICY_REQUIRED: 'LOW_RISK_EXACT_TEXT_POLICY_REQUIRED',
  SOURCE_BINDING_REQUIRED: 'SOURCE_BINDING_REQUIRED',
  SOURCE_BINDING_MISMATCH: 'SOURCE_BINDING_MISMATCH',
  STORAGE_PORTS_REQUIRED: 'STORAGE_PORTS_REQUIRED',
  SCENE_READ_FAILED: 'SCENE_READ_FAILED',
  BACKUP_FAILED: 'BACKUP_FAILED',
  ATOMIC_WRITE_FAILED: 'ATOMIC_WRITE_FAILED',
  AFTER_WRITE_HASH_MISMATCH: 'AFTER_WRITE_HASH_MISMATCH',
});

const TRUE_RUNTIME_FLAGS = Object.freeze({});

const FALSE_RUNTIME_FLAGS = Object.freeze({
  productWritePerformed: false,
  productWriteClaimed: false,
  productApplyAdmitted: false,
  productStorageSafetyClaimed: false,
  durableReceiptClaimed: false,
  applyReceiptImplemented: false,
  productApplyReceiptClaimed: false,
  recoveryClaimed: false,
  crashRecoveryClaimed: false,
  applyTxnClaimed: false,
  publicSurfaceClaimed: false,
  docxImportClaimed: false,
  uiChanged: false,
  networkUsed: false,
  dependencyChanged: false,
  storagePrimitiveChanged: false,
  productionStorageImportAdded: false,
  userProjectMutated: false,
});

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasText(value) {
  return typeof value === 'string' && value.length > 0;
}

function isSafeBasename(value) {
  return hasText(value)
    && path.basename(value) === value
    && value !== '.'
    && value !== '..'
    && !value.includes('/')
    && !value.includes('\\');
}

function uniqueReasons(reasons) {
  return Array.from(new Set(reasons.filter(Boolean))).sort();
}

function isInside(parentPath, childPath) {
  return childPath === parentPath || childPath.startsWith(`${parentPath}${path.sep}`);
}

function sceneTextHash(text) {
  return canonicalHash({
    hashKind: 'EXACT_TEXT_INTERNAL_WRITE_SCENE_TEXT_HASH_V1',
    text,
  });
}

function withoutTopLevelCanonicalHash(value) {
  if (!isObject(value)) {
    return value;
  }
  const { canonicalHash: _canonicalHash, ...rest } = value;
  return rest;
}

function resultFromCore(core) {
  return {
    ...core,
    canonicalHash: canonicalHash(core),
  };
}

function blockedResult(blockedReasons, observations = {}) {
  const core = {
    resultKind: RESULT_KIND,
    contourId: 'EXACT_TEXT_APPLY_INTERNAL_WRITE_PATH_PROTOTYPE_001R',
    internalFixtureWritePrototype: true,
    internalFixtureWritePrototypeObserved: false,
    fixtureWritePerformed: false,
    fixtureBackupCreated: false,
    fixtureAtomicWriteExecuted: false,
    receiptDraftEmitted: false,
    outputDecision: 'INTERNAL_WRITE_PATH_REMAINS_BLOCKED',
    nextContourAfterPass: 'EXACT_TEXT_APPLY_DURABLE_RECEIPT_AND_FAILURE_RECEIPT_001S',
    blockedReasons: uniqueReasons(blockedReasons),
    decisions: [],
    receiptDraft: null,
    ...FALSE_RUNTIME_FLAGS,
    ...TRUE_RUNTIME_FLAGS,
    ...observations,
  };
  return resultFromCore(core);
}

function acceptedResult(receiptDraft, observations = {}) {
  const decisionCore = {
    decisionKind: DECISION_KIND,
    outputDecision: 'INTERNAL_FIXTURE_WRITE_PATH_PROTOTYPE_OBSERVED',
    nextContourAfterPass: 'EXACT_TEXT_APPLY_DURABLE_RECEIPT_AND_FAILURE_RECEIPT_001S',
    acceptedBinding: 'EXACT_TEXT_APPLY_PRODUCT_APPLY_ADMISSION_GATE_001Q',
    internalFixtureWritePrototypeObserved: true,
    fixtureWritePerformed: true,
    fixtureBackupCreated: true,
    fixtureAtomicWriteExecuted: true,
    receiptDraftEmitted: true,
    productWritePerformed: false,
    productWriteClaimed: false,
    durableReceiptClaimed: false,
    applyReceiptImplemented: false,
    applyTxnClaimed: false,
    publicSurfaceClaimed: false,
  };
  const decision = {
    ...decisionCore,
    canonicalHash: canonicalHash(decisionCore),
  };
  const core = {
    resultKind: RESULT_KIND,
    contourId: 'EXACT_TEXT_APPLY_INTERNAL_WRITE_PATH_PROTOTYPE_001R',
    internalFixtureWritePrototype: true,
    internalFixtureWritePrototypeObserved: true,
    fixtureWritePerformed: true,
    fixtureBackupCreated: true,
    fixtureAtomicWriteExecuted: true,
    receiptDraftEmitted: true,
    outputDecision: 'INTERNAL_FIXTURE_WRITE_PATH_PROTOTYPE_OBSERVED',
    nextContourAfterPass: 'EXACT_TEXT_APPLY_DURABLE_RECEIPT_AND_FAILURE_RECEIPT_001S',
    blockedReasons: [],
    decisions: [decision],
    receiptDraft,
    ...FALSE_RUNTIME_FLAGS,
    ...observations,
  };
  return resultFromCore(core);
}

function validate001Q(admissionResult, reasons) {
  if (!isObject(admissionResult)) {
    reasons.push(INTERNAL_WRITE_PROTOTYPE_REASON_CODES.OWNER_ADMISSION_MISSING);
    return;
  }
  if (
    admissionResult.resultKind !== 'EXACT_TEXT_PRODUCT_APPLY_ADMISSION_GATE_RESULT'
    || admissionResult.outputDecision !== 'OWNER_MAY_OPEN_EXACT_TEXT_PRODUCT_WRITE_IMPLEMENTATION_001R'
    || admissionResult.productApplyAdmissionPlanningGateCompleted !== true
    || admissionResult.productApplyAdmissionToOpen001RAllowed !== true
    || admissionResult.nextContourAfterPass !== 'EXACT_TEXT_APPLY_PRODUCT_WRITE_IMPLEMENTATION_001R'
  ) {
    reasons.push(INTERNAL_WRITE_PROTOTYPE_REASON_CODES.OWNER_ADMISSION_NOT_001Q);
  }
  if (
    admissionResult.productWriteImplementationAllowedIn001Q !== false
    || admissionResult.productWritePerformed !== false
    || admissionResult.productWriteClaimed !== false
    || admissionResult.publicSurfaceClaimed !== false
    || admissionResult.applyReceiptImplemented !== false
    || admissionResult.applyTxnClaimed !== false
    || admissionResult.blockedReasons?.length
  ) {
    reasons.push(INTERNAL_WRITE_PROTOTYPE_REASON_CODES.PRODUCT_WRITE_STILL_FORBIDDEN);
  }
  const decisions = Array.isArray(admissionResult.productApplyAdmissionGateDecisions)
    ? admissionResult.productApplyAdmissionGateDecisions
    : [];
  const decision = decisions[0];
  if (
    decisions.length !== 1
    || !hasText(decision?.canonicalHash)
    || decision.canonicalHash !== canonicalHash(withoutTopLevelCanonicalHash(decision))
    || !hasText(admissionResult.canonicalHash)
    || admissionResult.canonicalHash !== canonicalHash(withoutTopLevelCanonicalHash(admissionResult))
  ) {
    reasons.push(INTERNAL_WRITE_PROTOTYPE_REASON_CODES.SOURCE_BINDING_MISMATCH);
  }
}

async function resolveFixtureScene(input, reasons) {
  const fixtureProjectRoot = input.fixtureProjectRoot;
  const sceneFileBasename = input.sceneFileBasename;
  if (
    !hasText(fixtureProjectRoot)
    || input.osTempFixtureRootOnly !== true
    || input.fixtureProjectRootInsideTempRoot !== true
    || input.fixtureProjectRootIsProductRoot !== false
    || input.userProjectPathAllowedIn001R !== false
    || input.internalFixtureWritePrototypeAllowedIn001R !== true
  ) {
    reasons.push(INTERNAL_WRITE_PROTOTYPE_REASON_CODES.FIXTURE_ROOT_POLICY_REQUIRED);
  }
  if (
    input.userProjectRootAccess === true
    || input.productRootAccess === true
    || input.repoRootAccess === true
    || input.userProjectRoot
  ) {
    reasons.push(INTERNAL_WRITE_PROTOTYPE_REASON_CODES.USER_PROJECT_PATH_FORBIDDEN);
  }
  if (!isSafeBasename(sceneFileBasename)) {
    reasons.push(INTERNAL_WRITE_PROTOTYPE_REASON_CODES.SCENE_FILE_BASENAME_REQUIRED);
    return { fixtureProjectRoot, scenePath: '' };
  }

  const rootReal = await fs.realpath(fixtureProjectRoot).catch(() => '');
  const tempRootReal = await fs.realpath(os.tmpdir()).catch(() => '');
  const scenePath = path.resolve(fixtureProjectRoot, sceneFileBasename);
  const sceneReal = await fs.realpath(scenePath).catch(() => '');
  if (!rootReal || !tempRootReal || !isInside(tempRootReal, rootReal)) {
    reasons.push(INTERNAL_WRITE_PROTOTYPE_REASON_CODES.FIXTURE_ROOT_POLICY_REQUIRED);
  }
  if (!rootReal || !sceneReal || !isInside(rootReal, sceneReal)) {
    reasons.push(INTERNAL_WRITE_PROTOTYPE_REASON_CODES.PATH_BOUNDARY_VIOLATION);
  }

  const sceneStat = await fs.lstat(scenePath).catch(() => null);
  if (sceneStat?.isSymbolicLink()) {
    reasons.push(INTERNAL_WRITE_PROTOTYPE_REASON_CODES.SCENE_FILE_SYMLINK_FORBIDDEN);
  }
  if (sceneStat?.isDirectory()) {
    reasons.push(INTERNAL_WRITE_PROTOTYPE_REASON_CODES.SCENE_FILE_DIRECTORY_FORBIDDEN);
  }
  return { fixtureProjectRoot, scenePath, sceneReal };
}

function validateApplyInput(input, beforeText, reasons) {
  if (!hasText(input.projectId) || !hasText(input.expectedProjectId) || input.projectId !== input.expectedProjectId) {
    reasons.push(INTERNAL_WRITE_PROTOTYPE_REASON_CODES.PROJECT_ID_MISMATCH);
  }
  if (!hasText(input.sceneId) || !hasText(input.expectedSceneId) || input.sceneId !== input.expectedSceneId) {
    reasons.push(INTERNAL_WRITE_PROTOTYPE_REASON_CODES.SCENE_ID_MISMATCH);
  }
  if (input.sessionOpen !== true) {
    reasons.push(INTERNAL_WRITE_PROTOTYPE_REASON_CODES.CLOSED_SESSION);
  }
  if (!hasText(input.expectedBaselineHash) || sceneTextHash(beforeText) !== input.expectedBaselineHash) {
    reasons.push(INTERNAL_WRITE_PROTOTYPE_REASON_CODES.STALE_BASELINE);
  }
  if (
    !hasText(input.currentBlockVersionHash)
    || !hasText(input.expectedBlockVersionHash)
    || input.currentBlockVersionHash !== input.expectedBlockVersionHash
  ) {
    reasons.push(INTERNAL_WRITE_PROTOTYPE_REASON_CODES.BLOCK_VERSION_MISMATCH);
  }
  if (beforeText !== input.exactBeforeText) {
    reasons.push(INTERNAL_WRITE_PROTOTYPE_REASON_CODES.EXACT_TEXT_MISMATCH);
  }
  if (!['TEXT_REPLACE', 'EXACT_TEXT_REPLACE'].includes(input.operationKind)) {
    reasons.push(INTERNAL_WRITE_PROTOTYPE_REASON_CODES.UNSUPPORTED_OP_KIND);
  }
  if (input.singleSceneScope !== true || input.multiSceneApplyClaimed === true) {
    reasons.push(INTERNAL_WRITE_PROTOTYPE_REASON_CODES.MULTI_SCOPE_WRITE_BLOCKED);
  }
  if (input.structuralApplyClaimed === true || input.structuralOperation === true) {
    reasons.push(INTERNAL_WRITE_PROTOTYPE_REASON_CODES.STRUCTURAL_WRITE_BLOCKED);
  }
  if (input.commentApplyClaimed === true || input.commentOperation === true) {
    reasons.push(INTERNAL_WRITE_PROTOTYPE_REASON_CODES.COMMENT_WRITE_BLOCKED);
  }
  if (input.lowRiskExactTextOnly !== true) {
    reasons.push(INTERNAL_WRITE_PROTOTYPE_REASON_CODES.LOW_RISK_EXACT_TEXT_POLICY_REQUIRED);
  }
  if (
    !hasText(input.source001QDecisionHash)
    || !hasText(input.sourceApplyOpHash)
    || !hasText(input.sourceEffectPreviewHash)
    || !hasText(input.productApplyAdmissionGateResult001Q?.canonicalHash)
    || !hasText(input.expectedAfterSceneHash)
  ) {
    reasons.push(INTERNAL_WRITE_PROTOTYPE_REASON_CODES.SOURCE_BINDING_REQUIRED);
  }
  if (
    hasText(input.source001QDecisionHash)
    && input.source001QDecisionHash !== input.productApplyAdmissionGateResult001Q?.productApplyAdmissionGateDecisions?.[0]?.canonicalHash
  ) {
    reasons.push(INTERNAL_WRITE_PROTOTYPE_REASON_CODES.SOURCE_BINDING_MISMATCH);
  }
}

function validatePorts(storagePorts, reasons) {
  if (
    !isObject(storagePorts)
    || typeof storagePorts.createBackup !== 'function'
    || typeof storagePorts.writeFileAtomic !== 'function'
  ) {
    reasons.push(INTERNAL_WRITE_PROTOTYPE_REASON_CODES.STORAGE_PORTS_REQUIRED);
  }
}

export async function runExactTextApplyInternalWritePrototype(input = {}) {
  const reasons = [];
  validate001Q(input.productApplyAdmissionGateResult001Q, reasons);
  validatePorts(input.storagePorts, reasons);

  const { fixtureProjectRoot, scenePath } = await resolveFixtureScene(input, reasons);
  if (reasons.length > 0) {
    return blockedResult(reasons);
  }

  const beforeText = await fs.readFile(scenePath, 'utf8').catch(() => null);
  if (typeof beforeText !== 'string') {
    return blockedResult([INTERNAL_WRITE_PROTOTYPE_REASON_CODES.SCENE_READ_FAILED]);
  }
  validateApplyInput(input, beforeText, reasons);
  if (reasons.length > 0) {
    return blockedResult(reasons, {
      beforeSceneHash: sceneTextHash(beforeText),
    });
  }

  const backupResult = await input.storagePorts.createBackup(scenePath, beforeText, {
    basePath: fixtureProjectRoot,
  });
  if (!backupResult || backupResult.success !== true) {
    return blockedResult([INTERNAL_WRITE_PROTOTYPE_REASON_CODES.BACKUP_FAILED], {
      beforeSceneHash: sceneTextHash(beforeText),
      backupError: String(backupResult?.error || 'backup failed'),
    });
  }

  const writeResult = await input.storagePorts.writeFileAtomic(scenePath, input.exactAfterText);
  if (!writeResult || writeResult.success !== true) {
    return blockedResult([INTERNAL_WRITE_PROTOTYPE_REASON_CODES.ATOMIC_WRITE_FAILED], {
      beforeSceneHash: sceneTextHash(beforeText),
      backupObservationHash: canonicalHash({ backupResult, scenePath: path.basename(scenePath) }),
      atomicWriteError: String(writeResult?.error || 'atomic write failed'),
    });
  }

  const afterText = await fs.readFile(scenePath, 'utf8');
  const afterSceneHash = sceneTextHash(afterText);
  if (afterText !== input.exactAfterText || afterSceneHash !== input.expectedAfterSceneHash) {
    return blockedResult([INTERNAL_WRITE_PROTOTYPE_REASON_CODES.AFTER_WRITE_HASH_MISMATCH], {
      beforeSceneHash: sceneTextHash(beforeText),
      afterSceneHash,
    });
  }

  const receiptDraftCore = {
    receiptDraftKind: RECEIPT_DRAFT_KIND,
    receiptDraftOnly: true,
    durableReceiptClaimed: false,
    applyReceiptImplemented: false,
    projectId: input.projectId,
    sceneId: input.sceneId,
    sceneFileBasename: input.sceneFileBasename,
    source001QResultHash: input.productApplyAdmissionGateResult001Q.canonicalHash,
    source001QDecisionHash: input.source001QDecisionHash,
    sourceApplyOpHash: input.sourceApplyOpHash,
    sourceEffectPreviewHash: input.sourceEffectPreviewHash,
    beforeSceneHash: sceneTextHash(beforeText),
    afterSceneHash,
    backupObservationHash: canonicalHash({ backupResult, sceneFileBasename: path.basename(scenePath) }),
    atomicWriteObservationHash: canonicalHash({ writeResult, sceneFileBasename: path.basename(scenePath) }),
    exactTextGuardPassed: true,
    baselineHashGuardPassed: true,
    blockVersionHashGuardPassed: true,
    projectIdGuardPassed: true,
    sceneIdGuardPassed: true,
  };
  const receiptDraft = {
    ...receiptDraftCore,
    canonicalHash: canonicalHash(receiptDraftCore),
  };

  return acceptedResult(receiptDraft, {
    beforeSceneHash: sceneTextHash(beforeText),
    afterSceneHash,
  });
}

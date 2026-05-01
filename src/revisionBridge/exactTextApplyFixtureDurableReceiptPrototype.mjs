import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { canonicalHash, canonicalJson } from './reviewIrKernel.mjs';

const RESULT_KIND = 'EXACT_TEXT_FIXTURE_DURABLE_RECEIPT_RESULT_001S';
const SUCCESS_RECEIPT_KIND = 'EXACT_TEXT_FIXTURE_DURABLE_SUCCESS_RECEIPT_001S';
const FAILURE_RECEIPT_KIND = 'EXACT_TEXT_FIXTURE_DURABLE_FAILURE_RECEIPT_001S';
const DECISION_KIND = 'EXACT_TEXT_FIXTURE_DURABLE_RECEIPT_DECISION_001S';

export const FIXTURE_DURABLE_RECEIPT_REASON_CODES = Object.freeze({
  SOURCE_001R_RESULT_REQUIRED: 'SOURCE_001R_RESULT_REQUIRED',
  SOURCE_001R_RESULT_MISMATCH: 'SOURCE_001R_RESULT_MISMATCH',
  SOURCE_001R_DECISION_MISMATCH: 'SOURCE_001R_DECISION_MISMATCH',
  SOURCE_001R_RECEIPT_DRAFT_MISMATCH: 'SOURCE_001R_RECEIPT_DRAFT_MISMATCH',
  SOURCE_BINDING_REQUIRED: 'SOURCE_BINDING_REQUIRED',
  RECEIPT_MODE_REQUIRED: 'RECEIPT_MODE_REQUIRED',
  FAILURE_REASON_REQUIRED: 'FAILURE_REASON_REQUIRED',
  FIXTURE_ROOT_POLICY_REQUIRED: 'FIXTURE_ROOT_POLICY_REQUIRED',
  USER_PROJECT_PATH_FORBIDDEN: 'USER_PROJECT_PATH_FORBIDDEN',
  RECEIPT_FILE_BASENAME_REQUIRED: 'RECEIPT_FILE_BASENAME_REQUIRED',
  RECEIPT_PATH_BOUNDARY_VIOLATION: 'RECEIPT_PATH_BOUNDARY_VIOLATION',
  RECEIPT_SYMLINK_FORBIDDEN: 'RECEIPT_SYMLINK_FORBIDDEN',
  STORAGE_PORTS_REQUIRED: 'STORAGE_PORTS_REQUIRED',
  RECEIPT_WRITE_FAILED: 'RECEIPT_WRITE_FAILED',
  RECEIPT_READBACK_FAILED: 'RECEIPT_READBACK_FAILED',
  RECEIPT_READBACK_HASH_MISMATCH: 'RECEIPT_READBACK_HASH_MISMATCH',
  PRODUCT_CLAIM_FORBIDDEN: 'PRODUCT_CLAIM_FORBIDDEN',
});

const FALSE_CLAIM_FLAGS = Object.freeze({
  productWritePerformed: false,
  productWriteClaimed: false,
  productApplyAdmitted: false,
  productApplyReceiptImplemented: false,
  productDurableApplyReceiptClaimed: false,
  applyReceiptImplemented: false,
  durableReceiptClaimed: false,
  applyTxnImplemented: false,
  applyTxnClaimed: false,
  recoveryClaimed: false,
  crashRecoveryClaimed: false,
  publicSurfaceClaimed: false,
  docxImportClaimed: false,
  uiChanged: false,
  networkUsed: false,
  dependencyChanged: false,
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

function isInside(parentPath, childPath) {
  return childPath === parentPath || childPath.startsWith(`${parentPath}${path.sep}`);
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
    contourId: 'EXACT_TEXT_APPLY_FIXTURE_DURABLE_RECEIPT_AND_FAILURE_RECEIPT_001S',
    fixtureDurableReceiptEvidenceOnly: true,
    fixtureDurableReceiptIsNotProductApplyReceipt: true,
    failureReceiptIsNotRecovery: true,
    atomicReceiptFileWriteIsNotApplyTxn: true,
    receiptObservationDoesNotAdmitProductApply: true,
    ...FALSE_CLAIM_FLAGS,
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
    outputDecision: 'FIXTURE_DURABLE_RECEIPT_CONTOUR_REMAINS_BLOCKED',
    fixtureDurableReceiptObserved: false,
    fixtureFailureReceiptObserved: false,
    receiptFileWritten: false,
    receiptReadbackVerified: false,
    blockedReasons: uniqueReasons(blockedReasons),
    decisions: [],
    receipt: null,
    ...observations,
  }));
}

function acceptedResult(mode, receipt, receiptFileBasename) {
  const success = mode === 'SUCCESS';
  const decisionCore = {
    decisionKind: DECISION_KIND,
    outputDecision: success
      ? 'FIXTURE_DURABLE_SUCCESS_RECEIPT_OBSERVED'
      : 'FIXTURE_DURABLE_FAILURE_RECEIPT_OBSERVED',
    nextContourAfterPass: 'PRIVATE_PRODUCT_APPLY_RECEIPT_ADMISSION_001T',
    receiptFileBasename,
    receiptCanonicalHash: receipt.receiptCanonicalHash,
    fixtureDurableReceiptEvidenceOnly: true,
    fixtureDurableReceiptIsNotProductApplyReceipt: true,
    failureReceiptIsNotRecovery: true,
    atomicReceiptFileWriteIsNotApplyTxn: true,
    productApplyReceiptImplemented: false,
    productDurableApplyReceiptClaimed: false,
  };
  const decision = withCanonicalHash(decisionCore);
  return withCanonicalHash(resultCore({
    outputDecision: decision.outputDecision,
    nextContourAfterPass: 'PRIVATE_PRODUCT_APPLY_RECEIPT_ADMISSION_001T',
    fixtureDurableReceiptObserved: success,
    fixtureFailureReceiptObserved: !success,
    receiptFileWritten: true,
    receiptReadbackVerified: true,
    blockedReasons: [],
    decisions: [decision],
    receipt,
  }));
}

function validateNoProductClaims(input, reasons) {
  const forbidden = [
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
  ];
  if (forbidden.some((key) => input[key] === true)) {
    reasons.push(FIXTURE_DURABLE_RECEIPT_REASON_CODES.PRODUCT_CLAIM_FORBIDDEN);
  }
}

function validate001R(source001RResult, input, reasons) {
  if (!isObject(source001RResult)) {
    reasons.push(FIXTURE_DURABLE_RECEIPT_REASON_CODES.SOURCE_001R_RESULT_REQUIRED);
    return;
  }

  const decisions = Array.isArray(source001RResult.decisions) ? source001RResult.decisions : [];
  const decision = decisions[0];
  const receiptDraft = source001RResult.receiptDraft;
  if (
    source001RResult.resultKind !== 'EXACT_TEXT_INTERNAL_WRITE_PATH_PROTOTYPE_RESULT_001R'
    || source001RResult.outputDecision !== 'INTERNAL_FIXTURE_WRITE_PATH_PROTOTYPE_OBSERVED'
    || source001RResult.internalFixtureWritePrototypeObserved !== true
    || source001RResult.fixtureWritePerformed !== true
    || source001RResult.productWritePerformed !== false
    || source001RResult.productWriteClaimed !== false
    || source001RResult.applyReceiptImplemented !== false
    || source001RResult.durableReceiptClaimed !== false
    || source001RResult.applyTxnClaimed !== false
    || source001RResult.recoveryClaimed !== false
    || source001RResult.crashRecoveryClaimed !== false
    || source001RResult.publicSurfaceClaimed !== false
    || source001RResult.docxImportClaimed !== false
    || source001RResult.uiChanged !== false
    || source001RResult.networkUsed !== false
    || source001RResult.dependencyChanged !== false
    || source001RResult.userProjectMutated !== false
    || source001RResult.blockedReasons?.length
    || decisions.length !== 1
    || !isObject(receiptDraft)
  ) {
    reasons.push(FIXTURE_DURABLE_RECEIPT_REASON_CODES.SOURCE_001R_RESULT_MISMATCH);
  }

  if (
    !hasText(source001RResult.canonicalHash)
    || source001RResult.canonicalHash !== canonicalHash(withoutHash(source001RResult))
    || source001RResult.canonicalHash !== input.source001RResultHash
  ) {
    reasons.push(FIXTURE_DURABLE_RECEIPT_REASON_CODES.SOURCE_001R_RESULT_MISMATCH);
  }
  if (
    !hasText(decision?.canonicalHash)
    || decision.canonicalHash !== canonicalHash(withoutHash(decision))
    || decision.canonicalHash !== input.source001RDecisionHash
  ) {
    reasons.push(FIXTURE_DURABLE_RECEIPT_REASON_CODES.SOURCE_001R_DECISION_MISMATCH);
  }
  if (
    !hasText(receiptDraft?.canonicalHash)
    || receiptDraft.canonicalHash !== canonicalHash(withoutHash(receiptDraft))
    || receiptDraft.canonicalHash !== input.source001RReceiptDraftHash
  ) {
    reasons.push(FIXTURE_DURABLE_RECEIPT_REASON_CODES.SOURCE_001R_RECEIPT_DRAFT_MISMATCH);
  }
  if (
    !hasText(input.source001RResultHash)
    || !hasText(input.source001RDecisionHash)
    || !hasText(input.source001RReceiptDraftHash)
  ) {
    reasons.push(FIXTURE_DURABLE_RECEIPT_REASON_CODES.SOURCE_BINDING_REQUIRED);
  }
}

async function resolveReceiptPath(input, reasons) {
  if (
    !hasText(input.fixtureProjectRoot)
    || input.osTempFixtureRootOnly !== true
    || input.fixtureProjectRootInsideTempRoot !== true
    || input.fixtureProjectRootIsProductRoot !== false
    || input.userProjectPathAllowedIn001S !== false
    || input.fixtureDurableReceiptAllowedIn001S !== true
  ) {
    reasons.push(FIXTURE_DURABLE_RECEIPT_REASON_CODES.FIXTURE_ROOT_POLICY_REQUIRED);
  }
  if (
    input.userProjectRootAccess === true
    || input.productRootAccess === true
    || input.repoRootAccess === true
    || input.userProjectRoot
  ) {
    reasons.push(FIXTURE_DURABLE_RECEIPT_REASON_CODES.USER_PROJECT_PATH_FORBIDDEN);
  }
  if (!isSafeBasename(input.receiptFileBasename)) {
    reasons.push(FIXTURE_DURABLE_RECEIPT_REASON_CODES.RECEIPT_FILE_BASENAME_REQUIRED);
    return '';
  }

  const rootReal = await fs.realpath(input.fixtureProjectRoot).catch(() => '');
  const tempRootReal = await fs.realpath(os.tmpdir()).catch(() => '');
  const receiptPath = path.resolve(input.fixtureProjectRoot, input.receiptFileBasename);
  if (!rootReal || !tempRootReal || !isInside(tempRootReal, rootReal)) {
    reasons.push(FIXTURE_DURABLE_RECEIPT_REASON_CODES.FIXTURE_ROOT_POLICY_REQUIRED);
  }
  const receiptParent = path.dirname(receiptPath);
  const receiptParentReal = await fs.realpath(receiptParent).catch(() => '');
  if (!rootReal || !receiptParentReal || !isInside(rootReal, receiptParentReal)) {
    reasons.push(FIXTURE_DURABLE_RECEIPT_REASON_CODES.RECEIPT_PATH_BOUNDARY_VIOLATION);
  }
  const existingReceiptStat = await fs.lstat(receiptPath).catch(() => null);
  if (existingReceiptStat?.isSymbolicLink()) {
    reasons.push(FIXTURE_DURABLE_RECEIPT_REASON_CODES.RECEIPT_SYMLINK_FORBIDDEN);
  }
  return receiptPath;
}

function validateMode(input, reasons) {
  if (!['SUCCESS', 'FAILURE'].includes(input.receiptMode)) {
    reasons.push(FIXTURE_DURABLE_RECEIPT_REASON_CODES.RECEIPT_MODE_REQUIRED);
  }
  if (
    input.receiptMode === 'FAILURE'
    && (!hasText(input.failureReasonCode) || !Array.isArray(input.blockedReasons) || input.blockedReasons.length === 0)
  ) {
    reasons.push(FIXTURE_DURABLE_RECEIPT_REASON_CODES.FAILURE_REASON_REQUIRED);
  }
}

function validatePorts(storagePorts, reasons) {
  if (!isObject(storagePorts) || typeof storagePorts.writeFileAtomic !== 'function') {
    reasons.push(FIXTURE_DURABLE_RECEIPT_REASON_CODES.STORAGE_PORTS_REQUIRED);
  }
}

function buildReceipt(input) {
  const draft = input.source001RResult.receiptDraft;
  const base = {
    contourId: 'EXACT_TEXT_APPLY_FIXTURE_DURABLE_RECEIPT_AND_FAILURE_RECEIPT_001S',
    receiptScope: 'FIXTURE_RECEIPT_EVIDENCE_ONLY',
    receiptFileBasename: input.receiptFileBasename,
    receiptWrittenAt: input.receiptWrittenAt,
    fixtureDurableReceiptIsNotProductApplyReceipt: true,
    failureReceiptIsNotRecovery: true,
    atomicReceiptFileWriteIsNotApplyTxn: true,
    productWriteClaimedFalse: true,
    productApplyReceiptImplementedFalse: true,
    productDurableApplyReceiptClaimedFalse: true,
    recoveryClaimedFalse: true,
  };
  const receiptCore = input.receiptMode === 'SUCCESS'
    ? {
      ...base,
      receiptKind: SUCCESS_RECEIPT_KIND,
      projectId: draft.projectId,
      sceneId: draft.sceneId,
      sceneFileBasename: draft.sceneFileBasename,
      source001RResultHash: input.source001RResultHash,
      source001RDecisionHash: input.source001RDecisionHash,
      source001RReceiptDraftHash: input.source001RReceiptDraftHash,
      source001QResultHash: draft.source001QResultHash,
      sourceApplyOpHash: draft.sourceApplyOpHash,
      sourceEffectPreviewHash: draft.sourceEffectPreviewHash,
      beforeSceneHash: draft.beforeSceneHash,
      afterSceneHash: draft.afterSceneHash,
      backupObservationHash: draft.backupObservationHash,
      atomicWriteObservationHash: draft.atomicWriteObservationHash,
    }
    : {
      ...base,
      receiptKind: FAILURE_RECEIPT_KIND,
      projectId: draft.projectId,
      sceneId: draft.sceneId,
      source001RInputHash: input.source001RResultHash,
      failureReasonCode: input.failureReasonCode,
      blockedReasons: Array.from(new Set(input.blockedReasons)).sort(),
      writeAttempted: input.writeAttempted === true,
      productMutationClaimedFalse: true,
    };
  return {
    ...receiptCore,
    receiptCanonicalHash: canonicalHash(receiptCore),
  };
}

export async function runExactTextApplyFixtureDurableReceiptPrototype(input = {}) {
  const reasons = [];
  validateNoProductClaims(input, reasons);
  validate001R(input.source001RResult, input, reasons);
  validateMode(input, reasons);
  validatePorts(input.storagePorts, reasons);
  const receiptPath = await resolveReceiptPath(input, reasons);
  if (reasons.length > 0) {
    return blockedResult(reasons);
  }

  const receipt = buildReceipt(input);
  const receiptText = `${canonicalJson(receipt)}\n`;
  const writeResult = await input.storagePorts.writeFileAtomic(receiptPath, receiptText);
  if (!writeResult || writeResult.success !== true) {
    return blockedResult([FIXTURE_DURABLE_RECEIPT_REASON_CODES.RECEIPT_WRITE_FAILED], {
      receiptWriteError: String(writeResult?.error || 'receipt write failed'),
    });
  }

  const readbackText = await fs.readFile(receiptPath, 'utf8').catch(() => null);
  if (typeof readbackText !== 'string') {
    return blockedResult([FIXTURE_DURABLE_RECEIPT_REASON_CODES.RECEIPT_READBACK_FAILED]);
  }
  let readbackReceipt = null;
  try {
    readbackReceipt = JSON.parse(readbackText);
  } catch {
    return blockedResult([FIXTURE_DURABLE_RECEIPT_REASON_CODES.RECEIPT_READBACK_HASH_MISMATCH]);
  }
  if (
    readbackReceipt.receiptCanonicalHash !== receipt.receiptCanonicalHash
    || receiptHash(readbackReceipt) !== receipt.receiptCanonicalHash
  ) {
    return blockedResult([FIXTURE_DURABLE_RECEIPT_REASON_CODES.RECEIPT_READBACK_HASH_MISMATCH]);
  }

  return acceptedResult(input.receiptMode, receipt, input.receiptFileBasename);
}

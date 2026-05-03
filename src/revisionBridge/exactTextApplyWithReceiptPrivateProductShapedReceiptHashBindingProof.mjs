import { canonicalHash } from './reviewIrKernel.mjs';
import { runExactTextApplyWithReceiptPrivateControlledStorageFixturePortProof } from './exactTextApplyWithReceiptPrivateControlledStorageFixturePortProof.mjs';

const RESULT_KIND = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PRODUCT_SHAPED_RECEIPT_HASH_BINDING_PROOF_RESULT_002M';
const DECISION_KIND = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PRODUCT_SHAPED_RECEIPT_HASH_BINDING_PROOF_DECISION_002M';
const RECEIPT_KIND = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PRODUCT_SHAPED_RECEIPT_HASH_BINDING_PROOF_RECEIPT_V1_002M';
const TARGET_CONTOUR = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PRODUCT_SHAPED_RECEIPT_HASH_BINDING_PROOF_ONLY_002M';

const SOURCE_002J_RESULT_KIND = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTROLLED_STORAGE_FIXTURE_PORT_PROOF_RESULT_002J';
const SOURCE_002J_DECISION_KIND = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTROLLED_STORAGE_FIXTURE_PORT_PROOF_DECISION_002J';
const SOURCE_002J_RECEIPT_KIND = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTROLLED_STORAGE_FIXTURE_RECEIPT_V1_002J';
const SOURCE_002J_SUCCESS_DECISION = 'PRIVATE_CONTROLLED_STORAGE_FIXTURE_PORT_PROOF_EXECUTED';
const SUCCESS_DECISION = 'PRIVATE_PRODUCT_SHAPED_RECEIPT_HASH_BINDING_PROVED_NO_RUNTIME_ADMISSION';
const BLOCKED_DECISION = 'PRIVATE_PRODUCT_SHAPED_RECEIPT_HASH_BINDING_BLOCKED';
const EXPECTED_OPERATION_KIND = 'EXACT_TEXT_REPLACE';

const ALLOWED_CHANGED_BASENAMES = new Set([
  'exactTextApplyWithReceiptPrivateProductShapedReceiptHashBindingProof.mjs',
  'exactTextApplyWithReceiptPrivateProductShapedReceiptHashBindingProof.contract.test.js',
  'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PRODUCT_SHAPED_RECEIPT_HASH_BINDING_PROOF_ONLY_002M.md',
]);

export const EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PRODUCT_SHAPED_RECEIPT_HASH_BINDING_PROOF_REASON_CODES = Object.freeze({
  SOURCE_002J_RESULT_REQUIRED: 'SOURCE_002J_RESULT_REQUIRED',
  SOURCE_002J_RESULT_HASH_MISMATCH: 'SOURCE_002J_RESULT_HASH_MISMATCH',
  SOURCE_002J_DECISION_HASH_MISMATCH: 'SOURCE_002J_DECISION_HASH_MISMATCH',
  SOURCE_002J_RECEIPT_HASH_MISMATCH: 'SOURCE_002J_RECEIPT_HASH_MISMATCH',
  SOURCE_002J_BLOCKED: 'SOURCE_002J_BLOCKED',
  SOURCE_002J_REVALIDATION_INPUT_REQUIRED: 'SOURCE_002J_REVALIDATION_INPUT_REQUIRED',
  SOURCE_002J_REVALIDATION_FAILED: 'SOURCE_002J_REVALIDATION_FAILED',
  MISSING_BACKUP_OBSERVATION_HASH: 'MISSING_BACKUP_OBSERVATION_HASH',
  MISSING_ATOMIC_WRITE_OBSERVATION_HASH: 'MISSING_ATOMIC_WRITE_OBSERVATION_HASH',
  TAMPERED_RECEIPT_HASH: 'TAMPERED_RECEIPT_HASH',
  STALE_BASELINE: 'STALE_BASELINE',
  BLOCK_VERSION_HASH_MISMATCH: 'BLOCK_VERSION_HASH_MISMATCH',
  OPERATION_KIND_MISMATCH: 'OPERATION_KIND_MISMATCH',
  PRODUCT_WRITE_REQUEST_FORBIDDEN: 'PRODUCT_WRITE_REQUEST_FORBIDDEN',
  PUBLIC_RUNTIME_REQUEST_FORBIDDEN: 'PUBLIC_RUNTIME_REQUEST_FORBIDDEN',
  IPC_PRELOAD_MENU_COMMAND_REQUEST_FORBIDDEN: 'IPC_PRELOAD_MENU_COMMAND_REQUEST_FORBIDDEN',
  APPLYTXN_RECOVERY_RELEASE_CLAIM_FORBIDDEN: 'APPLYTXN_RECOVERY_RELEASE_CLAIM_FORBIDDEN',
  UNSUPPORTED_SCOPE_FORBIDDEN: 'UNSUPPORTED_SCOPE_FORBIDDEN',
  UI_DOCX_NETWORK_DEPENDENCY_REQUEST_FORBIDDEN: 'UI_DOCX_NETWORK_DEPENDENCY_REQUEST_FORBIDDEN',
  FORBIDDEN_BASENAME_CHANGE: 'FORBIDDEN_BASENAME_CHANGE',
  SOURCE_001U_ACTIVE_RUNTIME_PRECEDENT_FORBIDDEN: 'SOURCE_001U_ACTIVE_RUNTIME_PRECEDENT_FORBIDDEN',
  GOVERNANCE_ARTIFACT_FEATURE_PROOF_FORBIDDEN: 'GOVERNANCE_ARTIFACT_FEATURE_PROOF_FORBIDDEN',
});

const FALSE_FLAGS = Object.freeze({
  publicRuntimeAdmitted: false,
  productWritePerformed: false,
  userProjectMutated: false,
  applyTxnImplemented: false,
  recoveryReady: false,
  releaseGreen: false,
  productApplyRuntimeAdmitted: false,
  publicAdapterImplementationAdmitted: false,
  runtimeWiringAdmitted: false,
  productStorageAdmission: false,
  productApplyReceiptImplemented: false,
  productApplyReceiptClaimed: false,
  publicSurfaceClaimed: false,
  ipcSurfaceClaimed: false,
  preloadExportClaimed: false,
  menuSurfaceClaimed: false,
  commandSurfaceClaimed: false,
  structuralApplyClaimed: false,
  commentApplyClaimed: false,
  multiSceneApplyClaimed: false,
  uiChanged: false,
  docxImportClaimed: false,
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

function withCanonicalHash(core) {
  return {
    ...core,
    canonicalHash: canonicalHash(core),
  };
}

function uniqueReasons(reasons) {
  return Array.from(new Set(reasons.filter(Boolean))).sort();
}

function receiptHash(receipt) {
  return canonicalHash(withoutHash(receipt, 'receiptCanonicalHash'));
}

function resultCore(input) {
  return {
    resultKind: RESULT_KIND,
    contourId: TARGET_CONTOUR,
    privateProductShapedReceiptHashBindingProofOnly: true,
    exactTextScope: true,
    singleSceneOnly: true,
    productWriteCount: 0,
    publicSurfaceCount: 0,
    ...FALSE_FLAGS,
    ...input,
  };
}

function blockedResult(blockedReasons, observations = {}) {
  return withCanonicalHash(resultCore({
    outputDecision: BLOCKED_DECISION,
    source002JAccepted: false,
    source002JRevalidated: false,
    receiptHashBindingCompiled: false,
    blockedReasons: uniqueReasons(blockedReasons),
    decisions: [],
    receipt: null,
    ...observations,
  }));
}

function acceptedResult(input, receipt) {
  const decisionCore = {
    decisionKind: DECISION_KIND,
    outputDecision: SUCCESS_DECISION,
    privateProductShapedReceiptHashBindingProofOnly: true,
    exactTextScope: true,
    singleSceneOnly: true,
    publicRuntimeAdmitted: false,
    productWritePerformed: false,
    userProjectMutated: false,
    applyTxnImplemented: false,
    recoveryReady: false,
    releaseGreen: false,
    productWriteCount: 0,
    publicSurfaceCount: 0,
  };
  const decision = withCanonicalHash(decisionCore);
  return withCanonicalHash(resultCore({
    outputDecision: decision.outputDecision,
    source002JAccepted: true,
    source002JRevalidated: true,
    receiptHashBindingCompiled: true,
    source002JResultHash: input.source002JResultHash,
    source002JDecisionHash: input.source002JDecisionHash,
    source002JReceiptHash: input.source002JReceiptHash,
    privateEvidenceReceiptHash: receipt.privateEvidenceReceiptHash,
    backupObservationHash: receipt.backupObservationHash,
    atomicWriteObservationHash: receipt.atomicWriteObservationHash,
    blockedReasons: [],
    decisions: [decision],
    receipt,
  }));
}

function pushForbiddenClaimReasons(value, reasons) {
  if (!isObject(value)) {
    return;
  }
  if (
    value.productWriteRequested === true
    || value.productWritePerformed === true
    || value.userProjectMutated === true
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PRODUCT_SHAPED_RECEIPT_HASH_BINDING_PROOF_REASON_CODES.PRODUCT_WRITE_REQUEST_FORBIDDEN);
  }
  if (
    value.publicRuntimeRequested === true
    || value.publicRuntimeAdmitted === true
    || value.productApplyRuntimeAdmitted === true
    || value.publicAdapterImplementationAdmitted === true
    || value.runtimeWiringAdmitted === true
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PRODUCT_SHAPED_RECEIPT_HASH_BINDING_PROOF_REASON_CODES.PUBLIC_RUNTIME_REQUEST_FORBIDDEN);
  }
  if (
    value.ipcSurfaceClaimed === true
    || value.preloadExportClaimed === true
    || value.menuSurfaceClaimed === true
    || value.commandSurfaceClaimed === true
    || value.publicSurfaceClaimed === true
    || value.commandRequest === true
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PRODUCT_SHAPED_RECEIPT_HASH_BINDING_PROOF_REASON_CODES.IPC_PRELOAD_MENU_COMMAND_REQUEST_FORBIDDEN);
  }
  if (
    value.applyTxnImplemented === true
    || value.applyTxnClaimed === true
    || value.recoveryClaimed === true
    || value.recoveryReady === true
    || value.releaseClaimed === true
    || value.releaseGreen === true
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PRODUCT_SHAPED_RECEIPT_HASH_BINDING_PROOF_REASON_CODES.APPLYTXN_RECOVERY_RELEASE_CLAIM_FORBIDDEN);
  }
  if (
    value.uiChanged === true
    || value.docxImportClaimed === true
    || value.networkUsed === true
    || value.dependencyChanged === true
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PRODUCT_SHAPED_RECEIPT_HASH_BINDING_PROOF_REASON_CODES.UI_DOCX_NETWORK_DEPENDENCY_REQUEST_FORBIDDEN);
  }
  if (value.source001UActiveRuntimePrecedent === true) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PRODUCT_SHAPED_RECEIPT_HASH_BINDING_PROOF_REASON_CODES.SOURCE_001U_ACTIVE_RUNTIME_PRECEDENT_FORBIDDEN);
  }
  if (value.governanceArtifactAsFeatureProof === true) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PRODUCT_SHAPED_RECEIPT_HASH_BINDING_PROOF_REASON_CODES.GOVERNANCE_ARTIFACT_FEATURE_PROOF_FORBIDDEN);
  }
}

function validateScope(input, reasons) {
  if (
    input.exactTextScope !== true
    || input.singleSceneOnly !== true
    || input.noStructuralScope !== true
    || input.noCommentScope !== true
    || input.multiSceneScope === true
    || input.structuralScopeRequested === true
    || input.commentScopeRequested === true
    || input.multiSceneScopeRequested === true
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PRODUCT_SHAPED_RECEIPT_HASH_BINDING_PROOF_REASON_CODES.UNSUPPORTED_SCOPE_FORBIDDEN);
  }
}

function validateOperationKind(input, reasons) {
  if (input.operationKind !== EXPECTED_OPERATION_KIND) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PRODUCT_SHAPED_RECEIPT_HASH_BINDING_PROOF_REASON_CODES.OPERATION_KIND_MISMATCH);
  }
}

function validateChangedBasenames(input, reasons) {
  if (!Array.isArray(input.changedBasenames)) {
    return;
  }
  if (input.changedBasenames.some((basename) => !ALLOWED_CHANGED_BASENAMES.has(basename))) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PRODUCT_SHAPED_RECEIPT_HASH_BINDING_PROOF_REASON_CODES.FORBIDDEN_BASENAME_CHANGE);
  }
}

function validateSource002J(input, reasons) {
  const source = input.source002JResult;
  if (!isObject(source)) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PRODUCT_SHAPED_RECEIPT_HASH_BINDING_PROOF_REASON_CODES.SOURCE_002J_RESULT_REQUIRED);
    return null;
  }

  const decision = Array.isArray(source.decisions) ? source.decisions[0] : null;
  const receipt = source.receipt;
  pushForbiddenClaimReasons(source, reasons);
  pushForbiddenClaimReasons(decision, reasons);
  pushForbiddenClaimReasons(receipt, reasons);

  if (
    source.resultKind !== SOURCE_002J_RESULT_KIND
    || source.outputDecision !== SOURCE_002J_SUCCESS_DECISION
    || source.source002GAccepted !== true
    || source.source002GRevalidated !== true
    || source.source002IReportBindingAccepted !== true
    || source.ownerPacketAccepted !== true
    || source.injectedPortAccepted !== true
    || source.exactTextGuardPassed !== true
    || source.backupWritten !== true
    || source.atomicWriteExecuted !== true
    || source.readbackMatched !== true
    || source.privateReceiptWritten !== true
    || source.fixtureWriteCount !== 1
    || source.fixtureReceiptCount !== 1
    || source.productWriteCount !== 0
    || source.publicSurfaceCount !== 0
    || source.blockedReasons?.length
    || !isObject(decision)
    || decision.decisionKind !== SOURCE_002J_DECISION_KIND
    || !isObject(receipt)
    || receipt.receiptKind !== SOURCE_002J_RECEIPT_KIND
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PRODUCT_SHAPED_RECEIPT_HASH_BINDING_PROOF_REASON_CODES.SOURCE_002J_BLOCKED);
  }

  if (
    !hasText(source.canonicalHash)
    || source.canonicalHash !== canonicalHash(withoutHash(source))
    || source.canonicalHash !== input.source002JResultHash
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PRODUCT_SHAPED_RECEIPT_HASH_BINDING_PROOF_REASON_CODES.SOURCE_002J_RESULT_HASH_MISMATCH);
  }

  if (
    !hasText(decision?.canonicalHash)
    || decision.canonicalHash !== canonicalHash(withoutHash(decision))
    || decision.canonicalHash !== input.source002JDecisionHash
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PRODUCT_SHAPED_RECEIPT_HASH_BINDING_PROOF_REASON_CODES.SOURCE_002J_DECISION_HASH_MISMATCH);
  }

  const recomputedReceiptHash = isObject(receipt) ? receiptHash(receipt) : '';
  if (
    !hasText(receipt?.receiptCanonicalHash)
    || receipt.receiptCanonicalHash !== recomputedReceiptHash
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PRODUCT_SHAPED_RECEIPT_HASH_BINDING_PROOF_REASON_CODES.TAMPERED_RECEIPT_HASH);
  }
  if (
    !hasText(receipt?.receiptCanonicalHash)
    || receipt.receiptCanonicalHash !== input.source002JReceiptHash
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PRODUCT_SHAPED_RECEIPT_HASH_BINDING_PROOF_REASON_CODES.SOURCE_002J_RECEIPT_HASH_MISMATCH);
  }

  if (!hasText(receipt?.backupObservationHash)) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PRODUCT_SHAPED_RECEIPT_HASH_BINDING_PROOF_REASON_CODES.MISSING_BACKUP_OBSERVATION_HASH);
  }
  if (!hasText(receipt?.atomicWriteObservationHash)) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PRODUCT_SHAPED_RECEIPT_HASH_BINDING_PROOF_REASON_CODES.MISSING_ATOMIC_WRITE_OBSERVATION_HASH);
  }

  return { source, receipt: isObject(receipt) ? receipt : null };
}

function validateSource002JRevalidation(input, reasons) {
  if (!isObject(input.source002JRevalidationInput)) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PRODUCT_SHAPED_RECEIPT_HASH_BINDING_PROOF_REASON_CODES.SOURCE_002J_REVALIDATION_INPUT_REQUIRED);
    return;
  }
  const rerun = runExactTextApplyWithReceiptPrivateControlledStorageFixturePortProof(input.source002JRevalidationInput);
  if (
    rerun.outputDecision !== SOURCE_002J_SUCCESS_DECISION
    || rerun.canonicalHash !== input.source002JResultHash
    || rerun.decisions?.[0]?.canonicalHash !== input.source002JDecisionHash
    || rerun.receipt?.receiptCanonicalHash !== input.source002JReceiptHash
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PRODUCT_SHAPED_RECEIPT_HASH_BINDING_PROOF_REASON_CODES.SOURCE_002J_REVALIDATION_FAILED);
  }
}

function validateBaselineAndBlockVersion(input, sourceReceipt, reasons) {
  if (input.baselineStatus === 'STALE' || input.staleBaseline === true) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PRODUCT_SHAPED_RECEIPT_HASH_BINDING_PROOF_REASON_CODES.STALE_BASELINE);
  }
  if (
    hasText(input.expectedBlockVersionHash)
    && input.expectedBlockVersionHash !== sourceReceipt.blockVersionHash
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PRODUCT_SHAPED_RECEIPT_HASH_BINDING_PROOF_REASON_CODES.BLOCK_VERSION_HASH_MISMATCH);
  }
}

function buildPrivateEvidenceReceiptHash(input, sourceReceipt) {
  return canonicalHash({
    evidenceKind: 'PRIVATE_PRODUCT_SHAPED_RECEIPT_HASH_BINDING_EVIDENCE_V1_002M',
    contourId: TARGET_CONTOUR,
    operationKind: EXPECTED_OPERATION_KIND,
    source002JResultHash: input.source002JResultHash,
    source002JDecisionHash: input.source002JDecisionHash,
    source002JReceiptHash: input.source002JReceiptHash,
    backupObservationHash: sourceReceipt.backupObservationHash,
    atomicWriteObservationHash: sourceReceipt.atomicWriteObservationHash,
    beforeSceneHash: sourceReceipt.beforeSceneHash,
    afterSceneHash: sourceReceipt.afterSceneHash,
    blockVersionHash: sourceReceipt.blockVersionHash,
  });
}

function buildReceipt(input, sourceReceipt) {
  const receiptCore = {
    receiptKind: RECEIPT_KIND,
    receiptSchemaVersion: 'PRIVATE_PRODUCT_SHAPED_RECEIPT_HASH_BINDING_PROOF_RECEIPT_SCHEMA_V1_002M',
    contourId: TARGET_CONTOUR,
    projectId: input.projectId,
    sceneId: input.sceneId,
    operationKind: EXPECTED_OPERATION_KIND,
    beforeSceneHash: sourceReceipt.beforeSceneHash,
    afterSceneHash: sourceReceipt.afterSceneHash,
    blockVersionHash: sourceReceipt.blockVersionHash,
    backupObservationHash: sourceReceipt.backupObservationHash,
    atomicWriteObservationHash: sourceReceipt.atomicWriteObservationHash,
    privateEvidenceReceiptHash: buildPrivateEvidenceReceiptHash(input, sourceReceipt),
    source002JResultHash: input.source002JResultHash,
    source002JDecisionHash: input.source002JDecisionHash,
    source002JReceiptHash: input.source002JReceiptHash,
    exactTextScope: true,
    singleSceneOnly: true,
    publicRuntimeAdmitted: false,
    productWritePerformed: false,
    userProjectMutated: false,
    applyTxnImplemented: false,
    recoveryReady: false,
    releaseGreen: false,
  };
  return {
    ...receiptCore,
    receiptCanonicalHash: canonicalHash(receiptCore),
  };
}

export function runExactTextApplyWithReceiptPrivateProductShapedReceiptHashBindingProof(input = {}) {
  const reasons = [];
  pushForbiddenClaimReasons(input, reasons);
  validateScope(input, reasons);
  validateOperationKind(input, reasons);
  validateChangedBasenames(input, reasons);
  const source = validateSource002J(input, reasons);
  validateSource002JRevalidation(input, reasons);
  if (source && isObject(source.receipt)) {
    validateBaselineAndBlockVersion(input, source.receipt, reasons);
    if (input.projectId !== source.receipt.projectId || input.sceneId !== source.receipt.sceneId) {
      reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PRODUCT_SHAPED_RECEIPT_HASH_BINDING_PROOF_REASON_CODES.STALE_BASELINE);
    }
  }

  if (reasons.length > 0) {
    return blockedResult(reasons, {
      source002JResultHash: input.source002JResultHash || input.source002JResult?.canonicalHash || null,
      source002JDecisionHash: input.source002JDecisionHash || input.source002JResult?.decisions?.[0]?.canonicalHash || null,
      source002JReceiptHash: input.source002JReceiptHash || input.source002JResult?.receipt?.receiptCanonicalHash || null,
    });
  }

  const receipt = buildReceipt(input, source.receipt);
  return acceptedResult(input, receipt);
}

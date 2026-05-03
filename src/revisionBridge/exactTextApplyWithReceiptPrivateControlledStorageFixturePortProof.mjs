import { canonicalHash } from './reviewIrKernel.mjs';
import { runExactTextApplyWithReceiptProductShapedFixtureImplementation } from './exactTextApplyWithReceiptProductShapedFixtureImplementation.mjs';

const RESULT_KIND = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTROLLED_STORAGE_FIXTURE_PORT_PROOF_RESULT_002J';
const DECISION_KIND = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTROLLED_STORAGE_FIXTURE_PORT_PROOF_DECISION_002J';
const RECEIPT_KIND = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTROLLED_STORAGE_FIXTURE_RECEIPT_V1_002J';
const TARGET_CONTOUR = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTROLLED_STORAGE_FIXTURE_PORT_PROOF_ONLY_002J';

const SOURCE_002G_RESULT_KIND = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_SHAPED_FIXTURE_IMPLEMENTATION_RESULT_002G';
const SOURCE_002G_DECISION_KIND = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_SHAPED_FIXTURE_IMPLEMENTATION_DECISION_002G';
const SOURCE_002I_REPORT_BINDING_KIND = 'SOURCE_002I_REPORT_BINDING_V1_002J';
const SOURCE_002I_REPORT_SOURCE_CONTOUR = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_STORAGE_PORT_ADMISSION_BRIEF_ONLY_002I';
const SOURCE_002I_SELECTED_BASE_SHA = 'd29254664a05fdc2943ad37f7ea22b55474e7f17';
const SOURCE_002I_REPORT_DECISION = 'OWNER_HAS_SUFFICIENT_REPORT_TO_DECIDE_WHETHER_TO_OPEN_002J';

const OWNER_PACKET_KIND = 'PRIVATE_CONTROLLED_STORAGE_FIXTURE_PORT_PROOF_OWNER_PACKET_002J';

const OWNER_REQUIRED_TRUE_FIELDS = [
  'ownerApprovesPrivateControlledStorageFixturePortProof002J',
  'ownerUnderstandsPrivateReceiptOnly',
  'ownerUnderstandsNoUserProjectMutation',
  'ownerUnderstandsNoProductStorageAdmission',
  'ownerUnderstandsNoProductApplyReceipt',
  'ownerUnderstandsNoPublicRuntimeOrSurface',
  'ownerUnderstandsNoUiDocxNetworkDependency',
  'ownerUnderstandsNoApplyTxnRecoveryRelease',
];

const OWNER_ALLOWED_FIELDS = Object.freeze(new Set([
  'packetKind',
  'targetContour',
  'source002GBindingHash',
  'source002IReportBindingHash',
  ...OWNER_REQUIRED_TRUE_FIELDS,
]));

const PORT_REQUIRED_TRUE_FIELDS = [
  'privateControlledStorageFixtureOnly',
  'boundedFixtureRoot',
  'fixtureRootControlledByTest',
  'insideTempFixtureRoot',
  'storePrivateOnly',
  'canReadScene',
  'canWriteBackup',
  'canAtomicWriteScene',
  'canReadBackScene',
  'canWritePrivateReceipt',
  'canReadBackPrivateReceipt',
  'canReportFailureWithoutPartialSuccess',
];

const PORT_ALLOWED_FUNCTION_FIELDS = new Set([
  'readScene',
  'writeBackup',
  'atomicWriteScene',
  'readBackScene',
  'writePrivateReceipt',
  'readBackPrivateReceipt',
]);

export const EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTROLLED_STORAGE_FIXTURE_PORT_PROOF_REASON_CODES = Object.freeze({
  SOURCE_002G_RESULT_REQUIRED: 'SOURCE_002G_RESULT_REQUIRED',
  SOURCE_002G_RESULT_HASH_MISMATCH: 'SOURCE_002G_RESULT_HASH_MISMATCH',
  SOURCE_002G_DECISION_HASH_MISMATCH: 'SOURCE_002G_DECISION_HASH_MISMATCH',
  SOURCE_002G_REVALIDATION_INPUT_REQUIRED: 'SOURCE_002G_REVALIDATION_INPUT_REQUIRED',
  SOURCE_002G_REVALIDATION_FAILED: 'SOURCE_002G_REVALIDATION_FAILED',
  SOURCE_002G_BLOCKED: 'SOURCE_002G_BLOCKED',
  SOURCE_002I_REPORT_BINDING_REQUIRED: 'SOURCE_002I_REPORT_BINDING_REQUIRED',
  SOURCE_002I_REPORT_BINDING_HASH_MISMATCH: 'SOURCE_002I_REPORT_BINDING_HASH_MISMATCH',
  SOURCE_002I_REPORT_BINDING_INVALID: 'SOURCE_002I_REPORT_BINDING_INVALID',
  OWNER_PACKET_REQUIRED: 'OWNER_PACKET_REQUIRED',
  OWNER_PACKET_INVALID: 'OWNER_PACKET_INVALID',
  OWNER_PACKET_TARGET_MISMATCH: 'OWNER_PACKET_TARGET_MISMATCH',
  OWNER_PACKET_UNKNOWN_FIELD_FORBIDDEN: 'OWNER_PACKET_UNKNOWN_FIELD_FORBIDDEN',
  OWNER_POLICY_MISSING: 'OWNER_POLICY_MISSING',
  INJECTED_CONTROLLED_STORAGE_PORT_REQUIRED: 'INJECTED_CONTROLLED_STORAGE_PORT_REQUIRED',
  USER_PROJECT_PATH_FORBIDDEN: 'USER_PROJECT_PATH_FORBIDDEN',
  ABSOLUTE_PATH_FORBIDDEN: 'ABSOLUTE_PATH_FORBIDDEN',
  UNVALIDATED_CALLBACK_FORBIDDEN: 'UNVALIDATED_CALLBACK_FORBIDDEN',
  WRONG_PROJECT: 'WRONG_PROJECT',
  WRONG_SCENE: 'WRONG_SCENE',
  STALE_BASELINE: 'STALE_BASELINE',
  CLOSED_SESSION: 'CLOSED_SESSION',
  BLOCK_VERSION_HASH_MISMATCH: 'BLOCK_VERSION_HASH_MISMATCH',
  EXACT_TEXT_GUARD_FAILED: 'EXACT_TEXT_GUARD_FAILED',
  EXACT_TEXT_NOT_FOUND: 'EXACT_TEXT_NOT_FOUND',
  EXACT_TEXT_NOT_UNIQUE: 'EXACT_TEXT_NOT_UNIQUE',
  UNSUPPORTED_SCOPE_FORBIDDEN: 'UNSUPPORTED_SCOPE_FORBIDDEN',
  SCENE_READ_FAILED: 'SCENE_READ_FAILED',
  BACKUP_WRITE_FAILED: 'BACKUP_WRITE_FAILED',
  ATOMIC_WRITE_FAILED: 'ATOMIC_WRITE_FAILED',
  READBACK_MISMATCH: 'READBACK_MISMATCH',
  PRIVATE_RECEIPT_WRITE_FAILED: 'PRIVATE_RECEIPT_WRITE_FAILED',
  PRODUCT_WRITE_FORBIDDEN: 'PRODUCT_WRITE_FORBIDDEN',
  PRODUCT_STORAGE_ADMISSION_FORBIDDEN: 'PRODUCT_STORAGE_ADMISSION_FORBIDDEN',
  PRODUCT_APPLYRECEIPT_CLAIM_FORBIDDEN: 'PRODUCT_APPLYRECEIPT_CLAIM_FORBIDDEN',
  PUBLIC_RUNTIME_FORBIDDEN: 'PUBLIC_RUNTIME_FORBIDDEN',
  PUBLIC_COMMAND_SURFACE_FORBIDDEN: 'PUBLIC_COMMAND_SURFACE_FORBIDDEN',
  UI_DOCX_NETWORK_DEPENDENCY_FORBIDDEN: 'UI_DOCX_NETWORK_DEPENDENCY_FORBIDDEN',
  APPLYTXN_RECOVERY_RELEASE_FORBIDDEN: 'APPLYTXN_RECOVERY_RELEASE_FORBIDDEN',
});

const FALSE_FLAGS = Object.freeze({
  userProjectMutated: false,
  realUserProjectMutated: false,
  productWritePerformed: false,
  productWriteClaimed: false,
  productStorageAdmitted: false,
  productStorageAdmission: false,
  productStorageSafetyClaimed: false,
  productApplyReceiptImplemented: false,
  productApplyReceiptClaimed: false,
  durableReceiptClaimed: false,
  applyTxnImplemented: false,
  applyTxnClaimed: false,
  recoveryClaimed: false,
  recoveryReady: false,
  startupRecoveryClaimed: false,
  crashRecoveryClaimed: false,
  crashRecovery: false,
  releaseClaimed: false,
  releaseGreen: false,
  publicRuntimeAdmitted: false,
  productApplyRuntimeAdmitted: false,
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
  structuralApplyClaimed: false,
  commentApplyClaimed: false,
  multiSceneApplyClaimed: false,
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

function sceneTextHash(text) {
  return canonicalHash({
    hashKind: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTROLLED_STORAGE_FIXTURE_SCENE_TEXT_HASH_V1_002J',
    text,
  });
}

function countOccurrences(text, part) {
  if (!hasText(part)) {
    return 0;
  }
  let cursor = 0;
  let count = 0;
  while (true) {
    const found = text.indexOf(part, cursor);
    if (found < 0) {
      return count;
    }
    count += 1;
    cursor = found + part.length;
  }
}

function isAbsolutePathText(value) {
  return typeof value === 'string' && (/^\/|^[A-Za-z]:[\\/]|^\\\\/u).test(value);
}

function resultCore(input) {
  return {
    resultKind: RESULT_KIND,
    contourId: TARGET_CONTOUR,
    privateControlledStorageFixturePortProofOnly: true,
    privateReceiptOnly: true,
    noUserProjectMutation: true,
    noProductStorageAdmission: true,
    noPublicRuntime: true,
    exactTextOnly: true,
    singleSceneOnly: true,
    ...FALSE_FLAGS,
    ...input,
  };
}

function blockedResult(blockedReasons, observations = {}) {
  return withCanonicalHash(resultCore({
    outputDecision: 'PRIVATE_CONTROLLED_STORAGE_FIXTURE_PORT_PROOF_BLOCKED',
    source002GAccepted: false,
    source002GRevalidated: false,
    source002IReportBindingAccepted: false,
    ownerPacketAccepted: false,
    injectedPortAccepted: false,
    exactTextGuardPassed: false,
    backupWritten: false,
    atomicWriteExecuted: false,
    readbackMatched: false,
    privateReceiptWritten: false,
    fixtureWriteCount: 0,
    fixtureReceiptCount: 0,
    productWriteCount: 0,
    publicSurfaceCount: 0,
    blockedReasons: uniqueReasons(blockedReasons),
    decisions: [],
    receipt: null,
    ...observations,
  }));
}

function acceptedResult(input, receipt) {
  const decisionCore = {
    decisionKind: DECISION_KIND,
    outputDecision: 'PRIVATE_CONTROLLED_STORAGE_FIXTURE_PORT_PROOF_EXECUTED',
    privateControlledStorageFixturePortProofOnly: true,
    fixtureWriteCount: 1,
    fixtureReceiptCount: 1,
    productWriteCount: 0,
    publicSurfaceCount: 0,
    userProjectMutated: false,
    productWritePerformed: false,
    productStorageAdmission: false,
    productApplyReceiptImplemented: false,
    productApplyReceiptClaimed: false,
    publicRuntimeAdmitted: false,
    applyTxnImplemented: false,
    recoveryClaimed: false,
    recoveryReady: false,
    crashRecovery: false,
    releaseClaimed: false,
    releaseGreen: false,
  };
  const decision = withCanonicalHash(decisionCore);
  return withCanonicalHash(resultCore({
    outputDecision: decision.outputDecision,
    source002GAccepted: true,
    source002GRevalidated: true,
    source002IReportBindingAccepted: true,
    ownerPacketAccepted: true,
    injectedPortAccepted: true,
    exactTextGuardPassed: true,
    backupWritten: true,
    atomicWriteExecuted: true,
    readbackMatched: true,
    privateReceiptWritten: true,
    fixtureWriteCount: 1,
    fixtureReceiptCount: 1,
    productWriteCount: 0,
    publicSurfaceCount: 0,
    source002GResultHash: input.source002GResultHash,
    source002GDecisionHash: input.source002GDecisionHash,
    source002IReportBindingHash: input.source002IReportBindingHash,
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
    value.productWritePerformed === true
    || value.productWriteClaimed === true
    || value.userProjectMutated === true
    || value.realUserProjectMutated === true
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTROLLED_STORAGE_FIXTURE_PORT_PROOF_REASON_CODES.PRODUCT_WRITE_FORBIDDEN);
  }
  if (
    value.productStorageAdmitted === true
    || value.productStorageAdmission === true
    || value.productStorageSafetyClaimed === true
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTROLLED_STORAGE_FIXTURE_PORT_PROOF_REASON_CODES.PRODUCT_STORAGE_ADMISSION_FORBIDDEN);
  }
  if (
    value.productApplyReceiptClaimed === true
    || value.productApplyReceiptImplemented === true
    || value.durableReceiptClaimed === true
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTROLLED_STORAGE_FIXTURE_PORT_PROOF_REASON_CODES.PRODUCT_APPLYRECEIPT_CLAIM_FORBIDDEN);
  }
  if (
    value.publicRuntimeAdmitted === true
    || value.productApplyRuntimeAdmitted === true
    || value.publicAdapterImplementationAdmitted === true
    || value.runtimeWiringAdmitted === true
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTROLLED_STORAGE_FIXTURE_PORT_PROOF_REASON_CODES.PUBLIC_RUNTIME_FORBIDDEN);
  }
  if (
    value.publicSurfaceClaimed === true
    || value.ipcSurfaceClaimed === true
    || value.preloadExportClaimed === true
    || value.menuSurfaceClaimed === true
    || value.commandSurfaceClaimed === true
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTROLLED_STORAGE_FIXTURE_PORT_PROOF_REASON_CODES.PUBLIC_COMMAND_SURFACE_FORBIDDEN);
  }
  if (value.uiChanged === true || value.docxImportClaimed === true || value.networkUsed === true || value.dependencyChanged === true) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTROLLED_STORAGE_FIXTURE_PORT_PROOF_REASON_CODES.UI_DOCX_NETWORK_DEPENDENCY_FORBIDDEN);
  }
  if (
    value.applyTxnImplemented === true
    || value.applyTxnClaimed === true
    || value.recoveryClaimed === true
    || value.recoveryReady === true
    || value.startupRecoveryClaimed === true
    || value.crashRecoveryClaimed === true
    || value.crashRecovery === true
    || value.releaseClaimed === true
    || value.releaseGreen === true
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTROLLED_STORAGE_FIXTURE_PORT_PROOF_REASON_CODES.APPLYTXN_RECOVERY_RELEASE_FORBIDDEN);
  }
}

function validateNoPathOrCallback(value, reasons, options = {}) {
  const allowedCallbackKeys = options.allowedCallbackKeys || new Set();
  const skipKeys = options.skipKeys || new Set();
  if (!isObject(value)) {
    if (isAbsolutePathText(value)) {
      reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTROLLED_STORAGE_FIXTURE_PORT_PROOF_REASON_CODES.ABSOLUTE_PATH_FORBIDDEN);
    }
    return;
  }
  for (const [field, nested] of Object.entries(value)) {
    if (skipKeys.has(field)) {
      continue;
    }
    if (/(?:^|_)?(?:userProjectPath|realUserProjectPath|userProjectRoot|productRoot|projectPath|scenePath|filePath|absolutePath|filesystemPath|repoRoot)$/u.test(field)) {
      reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTROLLED_STORAGE_FIXTURE_PORT_PROOF_REASON_CODES.USER_PROJECT_PATH_FORBIDDEN);
    }
    if (isAbsolutePathText(nested)) {
      reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTROLLED_STORAGE_FIXTURE_PORT_PROOF_REASON_CODES.ABSOLUTE_PATH_FORBIDDEN);
    }
    if (typeof nested === 'function' && !allowedCallbackKeys.has(field)) {
      reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTROLLED_STORAGE_FIXTURE_PORT_PROOF_REASON_CODES.UNVALIDATED_CALLBACK_FORBIDDEN);
    } else if (isObject(nested)) {
      validateNoPathOrCallback(nested, reasons, options);
    }
  }
}

function validateSource002G(input, reasons) {
  const source = input.source002GResult;
  if (!isObject(source)) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTROLLED_STORAGE_FIXTURE_PORT_PROOF_REASON_CODES.SOURCE_002G_RESULT_REQUIRED);
    return;
  }
  const decision = Array.isArray(source.decisions) ? source.decisions[0] : null;
  pushForbiddenClaimReasons(source, reasons);
  pushForbiddenClaimReasons(decision, reasons);
  if (
    source.resultKind !== SOURCE_002G_RESULT_KIND
    || source.outputDecision !== 'PRIVATE_PRODUCT_SHAPED_FIXTURE_IMPLEMENTATION_EXECUTED_NO_PUBLIC_RUNTIME'
    || source.source002FAccepted !== true
    || source.source002FRevalidated !== true
    || source.source002FRevalidationMatched !== true
    || source.ownerPacketAccepted !== true
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
    || source.productPathPubliclyAdmitted !== false
    || source.blockedReasons?.length
    || !isObject(decision)
    || decision.decisionKind !== SOURCE_002G_DECISION_KIND
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTROLLED_STORAGE_FIXTURE_PORT_PROOF_REASON_CODES.SOURCE_002G_BLOCKED);
  }
  if (
    !hasText(source.canonicalHash)
    || source.canonicalHash !== canonicalHash(withoutHash(source))
    || source.canonicalHash !== input.source002GResultHash
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTROLLED_STORAGE_FIXTURE_PORT_PROOF_REASON_CODES.SOURCE_002G_RESULT_HASH_MISMATCH);
  }
  if (
    !hasText(decision?.canonicalHash)
    || decision.canonicalHash !== canonicalHash(withoutHash(decision))
    || decision.canonicalHash !== input.source002GDecisionHash
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTROLLED_STORAGE_FIXTURE_PORT_PROOF_REASON_CODES.SOURCE_002G_DECISION_HASH_MISMATCH);
  }
}

function validateSource002GRevalidation(input, reasons) {
  if (!isObject(input.source002GRevalidationInput)) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTROLLED_STORAGE_FIXTURE_PORT_PROOF_REASON_CODES.SOURCE_002G_REVALIDATION_INPUT_REQUIRED);
    return;
  }
  const rerun = runExactTextApplyWithReceiptProductShapedFixtureImplementation(input.source002GRevalidationInput);
  if (
    rerun.outputDecision !== 'PRIVATE_PRODUCT_SHAPED_FIXTURE_IMPLEMENTATION_EXECUTED_NO_PUBLIC_RUNTIME'
    || rerun.canonicalHash !== input.source002GResultHash
    || rerun.decisions?.[0]?.canonicalHash !== input.source002GDecisionHash
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTROLLED_STORAGE_FIXTURE_PORT_PROOF_REASON_CODES.SOURCE_002G_REVALIDATION_FAILED);
  }
}

function validateSource002IReportBinding(input, reasons) {
  const binding = input.source002IReportBinding;
  if (!isObject(binding) || !hasText(input.source002IReportBindingHash)) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTROLLED_STORAGE_FIXTURE_PORT_PROOF_REASON_CODES.SOURCE_002I_REPORT_BINDING_REQUIRED);
    return;
  }
  if (canonicalHash(binding) !== input.source002IReportBindingHash) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTROLLED_STORAGE_FIXTURE_PORT_PROOF_REASON_CODES.SOURCE_002I_REPORT_BINDING_HASH_MISMATCH);
  }
  if (
    binding.bindingKind !== SOURCE_002I_REPORT_BINDING_KIND
    || binding.sourceContour !== SOURCE_002I_REPORT_SOURCE_CONTOUR
    || binding.sourceMode !== 'CHAT_REPORT_ONLY'
    || binding.ownerAcceptedChatReport !== true
    || binding.selectedBaseSha !== SOURCE_002I_SELECTED_BASE_SHA
    || binding.reportDecision !== SOURCE_002I_REPORT_DECISION
    || binding.storageAdmissionGranted !== false
    || binding.productWriteReady !== false
    || binding.productApplyReceiptReady !== false
    || binding.recoveryReady !== false
    || binding.releaseGreen !== false
    || binding.nextContourOpened !== false
    || binding.source002GMergeCommitSha !== SOURCE_002I_SELECTED_BASE_SHA
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTROLLED_STORAGE_FIXTURE_PORT_PROOF_REASON_CODES.SOURCE_002I_REPORT_BINDING_INVALID);
  }
}

function validateOwnerPacket(input, reasons) {
  const packet = input.ownerPrivateControlledStorageFixturePortProofPacket002J;
  if (!isObject(packet)) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTROLLED_STORAGE_FIXTURE_PORT_PROOF_REASON_CODES.OWNER_PACKET_REQUIRED);
    return;
  }
  if (packet.packetKind !== OWNER_PACKET_KIND) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTROLLED_STORAGE_FIXTURE_PORT_PROOF_REASON_CODES.OWNER_PACKET_INVALID);
  }
  if (packet.targetContour !== TARGET_CONTOUR) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTROLLED_STORAGE_FIXTURE_PORT_PROOF_REASON_CODES.OWNER_PACKET_TARGET_MISMATCH);
  }
  if (!hasText(packet.source002GBindingHash) || packet.source002GBindingHash !== input.source002GResultHash) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTROLLED_STORAGE_FIXTURE_PORT_PROOF_REASON_CODES.SOURCE_002G_RESULT_HASH_MISMATCH);
  }
  if (!hasText(packet.source002IReportBindingHash) || packet.source002IReportBindingHash !== input.source002IReportBindingHash) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTROLLED_STORAGE_FIXTURE_PORT_PROOF_REASON_CODES.SOURCE_002I_REPORT_BINDING_HASH_MISMATCH);
  }
  for (const field of Object.keys(packet)) {
    if (!OWNER_ALLOWED_FIELDS.has(field)) {
      reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTROLLED_STORAGE_FIXTURE_PORT_PROOF_REASON_CODES.OWNER_PACKET_UNKNOWN_FIELD_FORBIDDEN);
    }
  }
  if (OWNER_REQUIRED_TRUE_FIELDS.some((field) => packet[field] !== true)) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTROLLED_STORAGE_FIXTURE_PORT_PROOF_REASON_CODES.OWNER_POLICY_MISSING);
  }
  pushForbiddenClaimReasons(packet, reasons);
  validateNoPathOrCallback(packet, reasons);
}

function validateRequestShape(request, reasons) {
  if (!isObject(request)) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTROLLED_STORAGE_FIXTURE_PORT_PROOF_REASON_CODES.EXACT_TEXT_GUARD_FAILED);
    return;
  }
  validateNoPathOrCallback(request, reasons);
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
      reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTROLLED_STORAGE_FIXTURE_PORT_PROOF_REASON_CODES.EXACT_TEXT_GUARD_FAILED);
    }
  }
  if (request.noStructuralScope !== true || request.noCommentScope !== true || request.singleSceneOnly !== true) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTROLLED_STORAGE_FIXTURE_PORT_PROOF_REASON_CODES.UNSUPPORTED_SCOPE_FORBIDDEN);
  }
}

function validatePort(port, reasons) {
  if (!isObject(port)) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTROLLED_STORAGE_FIXTURE_PORT_PROOF_REASON_CODES.INJECTED_CONTROLLED_STORAGE_PORT_REQUIRED);
    return;
  }
  if (PORT_REQUIRED_TRUE_FIELDS.some((field) => port[field] !== true)) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTROLLED_STORAGE_FIXTURE_PORT_PROOF_REASON_CODES.INJECTED_CONTROLLED_STORAGE_PORT_REQUIRED);
  }
  if (!isObject(port.fixtureRootPolicy)) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTROLLED_STORAGE_FIXTURE_PORT_PROOF_REASON_CODES.INJECTED_CONTROLLED_STORAGE_PORT_REQUIRED);
  } else {
    if (
      port.fixtureRootPolicy.controlledByTest !== true
      || port.fixtureRootPolicy.insideTempRoot !== true
      || port.fixtureRootPolicy.boundedFixtureRoot !== true
      || port.fixtureRootPolicy.userProjectPathAllowed !== false
      || port.fixtureRootPolicy.absolutePathAllowed !== false
      || port.fixtureRootPolicy.privateReceiptOnly !== true
    ) {
      reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTROLLED_STORAGE_FIXTURE_PORT_PROOF_REASON_CODES.INJECTED_CONTROLLED_STORAGE_PORT_REQUIRED);
    }
  }
  for (const field of PORT_ALLOWED_FUNCTION_FIELDS) {
    if (typeof port[field] !== 'function') {
      reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTROLLED_STORAGE_FIXTURE_PORT_PROOF_REASON_CODES.INJECTED_CONTROLLED_STORAGE_PORT_REQUIRED);
    }
  }
  validateNoPathOrCallback(port, reasons, { allowedCallbackKeys: PORT_ALLOWED_FUNCTION_FIELDS });
  pushForbiddenClaimReasons(port, reasons);
}

function validateReadScene(readResult, request, reasons) {
  if (!isObject(readResult) || readResult.success !== true || typeof readResult.text !== 'string') {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTROLLED_STORAGE_FIXTURE_PORT_PROOF_REASON_CODES.SCENE_READ_FAILED);
    return '';
  }
  if (readResult.projectId !== request.projectId) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTROLLED_STORAGE_FIXTURE_PORT_PROOF_REASON_CODES.WRONG_PROJECT);
  }
  if (readResult.sceneId !== request.sceneId) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTROLLED_STORAGE_FIXTURE_PORT_PROOF_REASON_CODES.WRONG_SCENE);
  }
  if (readResult.closedSession === true) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTROLLED_STORAGE_FIXTURE_PORT_PROOF_REASON_CODES.CLOSED_SESSION);
  }
  if (readResult.baselineHash !== request.baselineHash) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTROLLED_STORAGE_FIXTURE_PORT_PROOF_REASON_CODES.STALE_BASELINE);
  }
  if (readResult.blockVersionHash !== request.expectedBlockVersionHash) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTROLLED_STORAGE_FIXTURE_PORT_PROOF_REASON_CODES.BLOCK_VERSION_HASH_MISMATCH);
  }
  if (sceneTextHash(readResult.text) !== request.beforeSceneHash) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTROLLED_STORAGE_FIXTURE_PORT_PROOF_REASON_CODES.EXACT_TEXT_GUARD_FAILED);
  }
  const matchCount = countOccurrences(readResult.text, request.exactBeforeText);
  if (matchCount === 0) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTROLLED_STORAGE_FIXTURE_PORT_PROOF_REASON_CODES.EXACT_TEXT_NOT_FOUND);
  }
  if (matchCount > 1) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTROLLED_STORAGE_FIXTURE_PORT_PROOF_REASON_CODES.EXACT_TEXT_NOT_UNIQUE);
  }
  const expectedAfterText = readResult.text.replace(request.exactBeforeText, request.replacementText);
  if (matchCount === 1 && expectedAfterText !== request.exactAfterText) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTROLLED_STORAGE_FIXTURE_PORT_PROOF_REASON_CODES.EXACT_TEXT_GUARD_FAILED);
  }
  return readResult.text;
}

function buildReceipt(input, beforeText, backupObservationHash, atomicWriteObservationHash) {
  const request = input.exactTextApplyRequest;
  const receiptCore = {
    receiptKind: RECEIPT_KIND,
    receiptVersion: 'PRIVATE_CONTROLLED_STORAGE_FIXTURE_RECEIPT_SCHEMA_V1_002J',
    contourId: TARGET_CONTOUR,
    projectId: request.projectId,
    sceneId: request.sceneId,
    source002GResultHash: input.source002GResultHash,
    source002GDecisionHash: input.source002GDecisionHash,
    source002IReportBindingHash: input.source002IReportBindingHash,
    beforeSceneHash: request.beforeSceneHash,
    afterSceneHash: sceneTextHash(request.exactAfterText),
    beforeTextHash: sceneTextHash(beforeText),
    blockVersionHash: request.expectedBlockVersionHash,
    backupObservationHash,
    atomicWriteObservationHash,
    receiptNonce: request.receiptNonce,
    requestedAt: request.requestedAt,
    privateReceiptOnly: true,
    noUserProjectMutation: true,
    productWritePerformed: false,
    productStorageAdmission: false,
    productApplyReceiptImplemented: false,
    productApplyReceiptClaimed: false,
    publicRuntimeAdmitted: false,
    applyTxnImplemented: false,
    recoveryClaimed: false,
    recoveryReady: false,
    crashRecovery: false,
    releaseClaimed: false,
    releaseGreen: false,
  };
  return {
    ...receiptCore,
    receiptCanonicalHash: canonicalHash(receiptCore),
  };
}

function executeProof(input) {
  const request = input.exactTextApplyRequest;
  const port = input.injectedPrivateControlledStorageFixturePort;

  const readReasons = [];
  const readResult = port.readScene({
    projectId: request.projectId,
    sceneId: request.sceneId,
  });
  const beforeText = validateReadScene(readResult, request, readReasons);
  if (readReasons.length > 0) {
    return blockedResult(readReasons);
  }

  const backupResult = port.writeBackup({
    projectId: request.projectId,
    sceneId: request.sceneId,
    beforeText,
    beforeSceneHash: request.beforeSceneHash,
  });
  if (!isObject(backupResult) || backupResult.success !== true) {
    return blockedResult([EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTROLLED_STORAGE_FIXTURE_PORT_PROOF_REASON_CODES.BACKUP_WRITE_FAILED]);
  }
  const backupObservationHash = canonicalHash({
    observationKind: 'PRIVATE_CONTROLLED_STORAGE_FIXTURE_BACKUP_OBSERVATION_002J',
    backupResult,
    beforeSceneHash: request.beforeSceneHash,
  });

  const atomicWriteResult = port.atomicWriteScene({
    projectId: request.projectId,
    sceneId: request.sceneId,
    nextText: request.exactAfterText,
    expectedBeforeSceneHash: request.beforeSceneHash,
  });
  if (!isObject(atomicWriteResult) || atomicWriteResult.success !== true) {
    return blockedResult([EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTROLLED_STORAGE_FIXTURE_PORT_PROOF_REASON_CODES.ATOMIC_WRITE_FAILED]);
  }
  const atomicWriteObservationHash = canonicalHash({
    observationKind: 'PRIVATE_CONTROLLED_STORAGE_FIXTURE_ATOMIC_WRITE_OBSERVATION_002J',
    atomicWriteResult,
    afterSceneHash: sceneTextHash(request.exactAfterText),
  });

  const readBackScene = port.readBackScene({
    projectId: request.projectId,
    sceneId: request.sceneId,
  });
  if (!isObject(readBackScene) || readBackScene.success !== true || readBackScene.text !== request.exactAfterText) {
    return blockedResult([EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTROLLED_STORAGE_FIXTURE_PORT_PROOF_REASON_CODES.READBACK_MISMATCH]);
  }

  const receipt = buildReceipt(input, beforeText, backupObservationHash, atomicWriteObservationHash);
  const writeReceipt = port.writePrivateReceipt({ receipt });
  if (!isObject(writeReceipt) || writeReceipt.success !== true) {
    return blockedResult([EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTROLLED_STORAGE_FIXTURE_PORT_PROOF_REASON_CODES.PRIVATE_RECEIPT_WRITE_FAILED]);
  }
  const readBackReceipt = port.readBackPrivateReceipt({
    receiptCanonicalHash: receipt.receiptCanonicalHash,
  });
  const receiptValue = readBackReceipt?.receipt;
  if (
    !isObject(readBackReceipt)
    || readBackReceipt.success !== true
    || !isObject(receiptValue)
    || receiptValue.receiptCanonicalHash !== receipt.receiptCanonicalHash
    || canonicalHash(withoutHash(receiptValue, 'receiptCanonicalHash')) !== receipt.receiptCanonicalHash
  ) {
    return blockedResult([EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTROLLED_STORAGE_FIXTURE_PORT_PROOF_REASON_CODES.READBACK_MISMATCH]);
  }
  return acceptedResult(input, receipt);
}

export function runExactTextApplyWithReceiptPrivateControlledStorageFixturePortProof(input = {}) {
  const reasons = [];
  pushForbiddenClaimReasons(input, reasons);
  validateNoPathOrCallback(input, reasons, {
    skipKeys: new Set(['source002GRevalidationInput', 'source002IReportBinding', 'injectedPrivateControlledStorageFixturePort']),
  });
  validateSource002G(input, reasons);
  validateSource002GRevalidation(input, reasons);
  validateSource002IReportBinding(input, reasons);
  validateOwnerPacket(input, reasons);
  validateRequestShape(input.exactTextApplyRequest, reasons);
  validatePort(input.injectedPrivateControlledStorageFixturePort, reasons);
  if (reasons.length > 0) {
    return blockedResult(reasons, {
      source002GResultHash: input.source002GResultHash || input.source002GResult?.canonicalHash || null,
      source002IReportBindingHash: input.source002IReportBindingHash || null,
    });
  }
  return executeProof(input);
}

import { canonicalHash } from './reviewIrKernel.mjs';
import { runExactTextApplyWithReceiptProductPathImplementationOpeningAdmission } from './exactTextApplyWithReceiptProductPathImplementationOpeningAdmission.mjs';

const RESULT_KIND = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_SHAPED_FIXTURE_IMPLEMENTATION_RESULT_002G';
const DECISION_KIND = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_SHAPED_FIXTURE_IMPLEMENTATION_DECISION_002G';
const RECEIPT_KIND = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_SHAPED_FIXTURE_RECEIPT_V1_002G';
const SOURCE_002F_RESULT_KIND = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_PATH_IMPLEMENTATION_OPENING_ADMISSION_RESULT_002F';
const SOURCE_002F_DECISION_KIND = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_PATH_IMPLEMENTATION_OPENING_ADMISSION_DECISION_002F';
const SOURCE_002F_CONTOUR = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_PATH_IMPLEMENTATION_OPENING_ADMISSION_002F';
const SOURCE_002F_NEXT_CONTOUR = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_PATH_IMPLEMENTATION_002G';
const TARGET_CONTOUR = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_SHAPED_FIXTURE_IMPLEMENTATION_002G';
const OWNER_PACKET_KIND = 'PRODUCT_SHAPED_FIXTURE_IMPLEMENTATION_OWNER_PACKET_002G';
const SOURCE_002F_MODULE_TEXT_HASH = 'be27c62ee475933a89141ae92aa9a91efdfa5989422f5afb69df9ec6750263e8';
const SOURCE_002F_CONTRACT_TEXT_HASH = '4abee4b28a97f7e45c06a60aa86b785afac39ec20d8b8bc66be6c30d8d30a2ad';

export const EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_SHAPED_FIXTURE_IMPLEMENTATION_REASON_CODES = Object.freeze({
  SOURCE_002F_RESULT_REQUIRED: 'SOURCE_002F_RESULT_REQUIRED',
  SOURCE_002F_RESULT_HASH_MISMATCH: 'SOURCE_002F_RESULT_HASH_MISMATCH',
  SOURCE_002F_DECISION_HASH_MISMATCH: 'SOURCE_002F_DECISION_HASH_MISMATCH',
  SOURCE_002F_CHAIN_HASH_MISMATCH: 'SOURCE_002F_CHAIN_HASH_MISMATCH',
  SOURCE_002F_BLOCKED: 'SOURCE_002F_BLOCKED',
  SOURCE_002F_REVALIDATION_INPUT_REQUIRED: 'SOURCE_002F_REVALIDATION_INPUT_REQUIRED',
  SOURCE_002F_REVALIDATION_FAILED: 'SOURCE_002F_REVALIDATION_FAILED',
  SOURCE_002F_BINDING_REQUIRED: 'SOURCE_002F_BINDING_REQUIRED',
  SOURCE_002F_BINDING_HASH_MISMATCH: 'SOURCE_002F_BINDING_HASH_MISMATCH',
  SYNTHETIC_002F_WITHOUT_CHAIN: 'SYNTHETIC_002F_WITHOUT_CHAIN',
  FORGED_SELF_CONSISTENT_002F_FORBIDDEN: 'FORGED_SELF_CONSISTENT_002F_FORBIDDEN',
  OWNER_PACKET_REQUIRED: 'OWNER_PACKET_REQUIRED',
  OWNER_PACKET_INVALID: 'OWNER_PACKET_INVALID',
  OWNER_PACKET_TARGET_MISMATCH: 'OWNER_PACKET_TARGET_MISMATCH',
  OWNER_PACKET_UNKNOWN_FIELD_FORBIDDEN: 'OWNER_PACKET_UNKNOWN_FIELD_FORBIDDEN',
  OWNER_POLICY_MISSING: 'OWNER_POLICY_MISSING',
  INJECTED_PRIVATE_PRODUCT_SHAPED_FIXTURE_PORT_REQUIRED: 'INJECTED_PRIVATE_PRODUCT_SHAPED_FIXTURE_PORT_REQUIRED',
  USER_PROJECT_PATH_FORBIDDEN: 'USER_PROJECT_PATH_FORBIDDEN',
  CALLABLE_FIELD_FORBIDDEN: 'CALLABLE_FIELD_FORBIDDEN',
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
  FIXTURE_BACKUP_WRITE_FAILED: 'FIXTURE_BACKUP_WRITE_FAILED',
  FIXTURE_ATOMIC_WRITE_FAILED: 'FIXTURE_ATOMIC_WRITE_FAILED',
  PRIVATE_FIXTURE_RECEIPT_WRITE_FAILED: 'PRIVATE_FIXTURE_RECEIPT_WRITE_FAILED',
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
  realUserProjectMutated: false,
  userProjectMutated: false,
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
  startupRecoveryClaimed: false,
  crashRecoveryClaimed: false,
  releaseClaimed: false,
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
  productPathPubliclyAdmitted: false,
});

const OWNER_REQUIRED_TRUE_FIELDS = [
  'ownerApprovesProductShapedFixtureImplementation002G',
  'ownerUnderstandsProductShapedFixtureIsProofOnly',
  'ownerUnderstandsNoRealProductWrite',
  'ownerUnderstandsNoProductStorageAdmission',
  'ownerUnderstandsNoProductApplyReceiptClaim',
  'ownerUnderstandsNoApplyTxnRecoveryRelease',
  'ownerUnderstandsNoPublicRuntimeOrSurface',
  'ownerUnderstandsNoUiDocxNetworkDependency',
];

const OWNER_ALLOWED_FIELDS = Object.freeze(new Set([
  'packetKind',
  'targetContour',
  'source002FBindingHash',
  ...OWNER_REQUIRED_TRUE_FIELDS,
]));

const PORT_REQUIRED_TRUE_FIELDS = [
  'privateProductShapedFixtureOnly',
  'canReadScene',
  'canWriteFixtureBackup',
  'canAtomicWriteFixtureScene',
  'canWritePrivateFixtureReceipt',
  'canReadBackFixtureScene',
  'canReadBackPrivateFixtureReceipt',
  'canObserveFixtureCleanup',
  'canReportFailureWithoutPartialSuccess',
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
    hashKind: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_SHAPED_FIXTURE_SCENE_TEXT_HASH_V1_002G',
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

function resultCore(input) {
  return {
    resultKind: RESULT_KIND,
    contourId: TARGET_CONTOUR,
    privateProductShapedFixtureImplementationOnly: true,
    proofOnlyNoPublicRuntime: true,
    exactTextOnly: true,
    singleSceneOnly: true,
    noStructuralScope: true,
    noCommentScope: true,
    ...FALSE_FLAGS,
    ...input,
  };
}

function blockedResult(blockedReasons, observations = {}) {
  return withCanonicalHash(resultCore({
    outputDecision: 'PRIVATE_PRODUCT_SHAPED_FIXTURE_IMPLEMENTATION_BLOCKED',
    nextContourRecommendation: null,
    source002FAccepted: false,
    source002FRevalidated: false,
    source002FRevalidationMatched: false,
    ownerPacketAccepted: false,
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
    productPathPubliclyAdmitted: false,
    blockedReasons: uniqueReasons(blockedReasons),
    decisions: [],
    receipt: null,
    exitPacket: {
      source002FRevalidated: false,
      source002FRevalidationMatched: false,
      ownerPacketAccepted: false,
      injectedFixturePortAccepted: false,
      exactTextGuardPassed: false,
      fixtureWriteCount: 0,
      fixtureReceiptCount: 0,
      productWriteCount: 0,
      publicSurfaceCount: 0,
      productPathPubliclyAdmitted: false,
      fixtureCleanupObserved: false,
      nextContour: null,
    },
    ...observations,
  }));
}

function acceptedResult(input, receipt, observations) {
  const decisionCore = {
    decisionKind: DECISION_KIND,
    outputDecision: 'PRIVATE_PRODUCT_SHAPED_FIXTURE_IMPLEMENTATION_EXECUTED_NO_PUBLIC_RUNTIME',
    privateProductShapedFixtureImplementationOnly: true,
    productPathPubliclyAdmitted: false,
    realUserProjectMutated: false,
    userProjectMutated: false,
    productWritePerformed: false,
    productStorageAdmitted: false,
    productStorageAdmission: false,
    productApplyReceiptImplemented: false,
    productApplyReceiptClaimed: false,
    applyTxnImplemented: false,
    recoveryClaimed: false,
    releaseClaimed: false,
    publicRuntimeAdmitted: false,
    productWriteCount: 0,
    publicSurfaceCount: 0,
    fixtureWriteCount: 1,
    fixtureReceiptCount: 1,
  };
  const decision = withCanonicalHash(decisionCore);
  return withCanonicalHash(resultCore({
    outputDecision: decision.outputDecision,
    nextContourRecommendation: null,
    source002FAccepted: true,
    source002FRevalidated: true,
    source002FRevalidationMatched: true,
    ownerPacketAccepted: true,
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
    source002FResultHash: input.source002FResultHash,
    source002FDecisionHash: input.source002FDecisionHash,
    source002EReceiptHashFrom002F: input.source002EReceiptHashFrom002F,
    receiptCanonicalHash: receipt.receiptCanonicalHash,
    blockedReasons: [],
    decisions: [decision],
    receipt,
    exitPacket: {
      source002FRevalidated: true,
      source002FRevalidationMatched: true,
      ownerPacketAccepted: true,
      injectedFixturePortAccepted: true,
      exactTextGuardPassed: true,
      fixtureWriteCount: 1,
      fixtureReceiptCount: 1,
      productWriteCount: 0,
      publicSurfaceCount: 0,
      productPathPubliclyAdmitted: false,
      fixtureCleanupObserved: true,
      nextContour: null,
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
    || value.realUserProjectMutated === true
    || value.realUserProjectPathTouched === true
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_SHAPED_FIXTURE_IMPLEMENTATION_REASON_CODES.PRODUCT_WRITE_FORBIDDEN);
  }
  if (
    value.productStorageAdmitted === true
    || value.productStorageAdmission === true
    || value.productStorageSafetyClaimed === true
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_SHAPED_FIXTURE_IMPLEMENTATION_REASON_CODES.PRODUCT_STORAGE_ADMISSION_FORBIDDEN);
  }
  if (
    value.productApplyReceiptClaimed === true
    || value.productApplyReceiptImplemented === true
    || value.durableReceiptClaimed === true
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_SHAPED_FIXTURE_IMPLEMENTATION_REASON_CODES.PRODUCT_APPLYRECEIPT_CLAIM_FORBIDDEN);
  }
  if (
    value.publicRuntimeAdmitted === true
    || value.productApplyRuntimeAdmitted === true
    || value.publicAdapterImplementationAdmitted === true
    || value.runtimeWiringAdmitted === true
    || value.productPathPubliclyAdmitted === true
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_SHAPED_FIXTURE_IMPLEMENTATION_REASON_CODES.PUBLIC_RUNTIME_FORBIDDEN);
  }
  if (
    value.publicSurfaceClaimed === true
    || value.ipcSurfaceClaimed === true
    || value.preloadExportClaimed === true
    || value.menuSurfaceClaimed === true
    || value.commandSurfaceClaimed === true
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_SHAPED_FIXTURE_IMPLEMENTATION_REASON_CODES.PUBLIC_COMMAND_SURFACE_FORBIDDEN);
  }
  if (value.uiChanged === true || value.docxImportClaimed === true || value.networkUsed === true || value.dependencyChanged === true) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_SHAPED_FIXTURE_IMPLEMENTATION_REASON_CODES.UI_DOCX_NETWORK_DEPENDENCY_FORBIDDEN);
  }
  if (
    value.applyTxnImplemented === true
    || value.applyTxnClaimed === true
    || value.recoveryClaimed === true
    || value.startupRecoveryClaimed === true
    || value.crashRecoveryClaimed === true
    || value.releaseClaimed === true
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_SHAPED_FIXTURE_IMPLEMENTATION_REASON_CODES.APPLYTXN_RECOVERY_RELEASE_FORBIDDEN);
  }
}

function validateNoCallableOrUserPath(value, reasons, skipKeys = new Set()) {
  if (typeof value === 'function') {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_SHAPED_FIXTURE_IMPLEMENTATION_REASON_CODES.CALLABLE_FIELD_FORBIDDEN);
    return;
  }
  if (!isObject(value)) {
    return;
  }
  for (const [field, nested] of Object.entries(value)) {
    if (skipKeys.has(field)) {
      continue;
    }
    if (/(?:^|_)?(?:userProjectPath|realUserProjectPath|userProjectRoot|productRoot|projectPath|scenePath|filePath|absolutePath|filesystemPath|repoRoot)$/u.test(field)) {
      reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_SHAPED_FIXTURE_IMPLEMENTATION_REASON_CODES.USER_PROJECT_PATH_FORBIDDEN);
    }
    if (typeof nested === 'function') {
      reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_SHAPED_FIXTURE_IMPLEMENTATION_REASON_CODES.CALLABLE_FIELD_FORBIDDEN);
    } else if (isObject(nested)) {
      validateNoCallableOrUserPath(nested, reasons, skipKeys);
    }
  }
}

function validateSource002F(input, reasons) {
  const source = input.source002FResult;
  if (!isObject(source)) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_SHAPED_FIXTURE_IMPLEMENTATION_REASON_CODES.SOURCE_002F_RESULT_REQUIRED);
    return;
  }
  pushForbiddenClaimReasons(source, reasons);
  const decision = Array.isArray(source.decisions) ? source.decisions[0] : null;
  pushForbiddenClaimReasons(decision, reasons);

  if (
    source.resultKind !== SOURCE_002F_RESULT_KIND
    || source.contourId !== SOURCE_002F_CONTOUR
    || source.outputDecision !== 'OWNER_MAY_OPEN_PRODUCT_PATH_IMPLEMENTATION_002G_ONLY'
    || source.nextContourRecommendation !== SOURCE_002F_NEXT_CONTOUR
    || source.source002EAccepted !== true
    || source.source002ERehashed !== true
    || source.source002EDecisionRehashed !== true
    || source.source002EChainHashReconfirmed !== true
    || source.source002ERevalidated !== true
    || source.source002ERevalidationMatched !== true
    || source.ownerPacketAccepted !== true
    || source.ownerMayOpen002G !== true
    || source.productPathImplementationMayOpen !== true
    || source.productPathAdmitted !== false
    || source.productPathExecuted !== false
    || source.productPathExecutionAdmitted !== false
    || source.productWritePerformed !== false
    || source.productStorageAdmitted !== false
    || source.productStorageAdmission !== false
    || source.productApplyReceiptImplemented !== false
    || source.applyTxnImplemented !== false
    || source.recoveryClaimed !== false
    || source.releaseClaimed !== false
    || source.publicRuntimeAdmitted !== false
    || source.userProjectMutated !== false
    || source.productWriteCount !== 0
    || source.publicSurfaceCount !== 0
    || source.writeEffectsCount !== 0
    || source.blockedReasons?.length
    || !isObject(decision)
    || decision.decisionKind !== SOURCE_002F_DECISION_KIND
    || decision.outputDecision !== source.outputDecision
    || decision.productPathImplementationMayOpen !== true
    || decision.productPathAdmitted !== false
    || decision.productWritePerformed !== false
    || decision.productStorageAdmitted !== false
    || decision.productStorageAdmission !== false
    || decision.productApplyReceiptImplemented !== false
    || decision.applyTxnImplemented !== false
    || decision.recoveryClaimed !== false
    || decision.releaseClaimed !== false
    || decision.publicRuntimeAdmitted !== false
    || decision.userProjectMutated !== false
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_SHAPED_FIXTURE_IMPLEMENTATION_REASON_CODES.SOURCE_002F_BLOCKED);
  }

  if (
    !hasText(source.source002DReceiptHashFrom002E)
    || source.source002DReceiptHashFrom002E !== input.source002EReceiptHashFrom002F
    || source.exitPacket?.source002EChainHashReconfirmed !== true
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_SHAPED_FIXTURE_IMPLEMENTATION_REASON_CODES.SOURCE_002F_CHAIN_HASH_MISMATCH);
  }

  if (
    source.source002EAccepted !== true
    || source.source002ERevalidated !== true
    || source.source002ERevalidationMatched !== true
    || source.exitPacket?.source002ERevalidated !== true
    || source.exitPacket?.source002ERevalidationMatched !== true
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_SHAPED_FIXTURE_IMPLEMENTATION_REASON_CODES.SYNTHETIC_002F_WITHOUT_CHAIN);
  }

  if (
    !hasText(source.canonicalHash)
    || source.canonicalHash !== canonicalHash(withoutHash(source))
    || source.canonicalHash !== input.source002FResultHash
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_SHAPED_FIXTURE_IMPLEMENTATION_REASON_CODES.SOURCE_002F_RESULT_HASH_MISMATCH);
  }

  if (
    !hasText(decision?.canonicalHash)
    || decision.canonicalHash !== canonicalHash(withoutHash(decision))
    || decision.canonicalHash !== input.source002FDecisionHash
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_SHAPED_FIXTURE_IMPLEMENTATION_REASON_CODES.SOURCE_002F_DECISION_HASH_MISMATCH);
  }
}

function validateSource002FRevalidation(input, reasons) {
  if (!isObject(input.source002FRevalidationInput)) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_SHAPED_FIXTURE_IMPLEMENTATION_REASON_CODES.SOURCE_002F_REVALIDATION_INPUT_REQUIRED);
    return;
  }
  const rerun = runExactTextApplyWithReceiptProductPathImplementationOpeningAdmission(input.source002FRevalidationInput);
  const rerunMatches = (
    rerun.outputDecision === 'OWNER_MAY_OPEN_PRODUCT_PATH_IMPLEMENTATION_002G_ONLY'
    && rerun.canonicalHash === input.source002FResultHash
    && rerun.decisions?.[0]?.canonicalHash === input.source002FDecisionHash
    && rerun.source002DReceiptHashFrom002E === input.source002EReceiptHashFrom002F
    && rerun.exitPacket?.source002EChainHashReconfirmed === true
  );
  if (!rerunMatches) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_SHAPED_FIXTURE_IMPLEMENTATION_REASON_CODES.SOURCE_002F_REVALIDATION_FAILED);
    const source = input.source002FResult;
    const decision = source?.decisions?.[0];
    if (
      hasText(source?.canonicalHash)
      && source.canonicalHash === canonicalHash(withoutHash(source))
      && hasText(decision?.canonicalHash)
      && decision.canonicalHash === canonicalHash(withoutHash(decision))
    ) {
      reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_SHAPED_FIXTURE_IMPLEMENTATION_REASON_CODES.FORGED_SELF_CONSISTENT_002F_FORBIDDEN);
    }
  }
}

function validateSource002FBinding(input, reasons) {
  const binding = input.source002FBinding;
  if (!isObject(binding)) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_SHAPED_FIXTURE_IMPLEMENTATION_REASON_CODES.SOURCE_002F_BINDING_REQUIRED);
    return;
  }
  if (
    binding.bindingKind !== 'SOURCE_002F_IMMUTABLE_MODULE_BINDING_V1_002G'
    || binding.sourceContour !== SOURCE_002F_CONTOUR
    || binding.moduleBasename !== 'exactTextApplyWithReceiptProductPathImplementationOpeningAdmission.mjs'
    || binding.contractTestBasename !== 'exactTextApplyWithReceiptProductPathImplementationOpeningAdmission.contract.test.js'
    || binding.sourceLocked !== true
    || !hasText(binding.bindingHeadSha)
    || binding.moduleTextHash !== SOURCE_002F_MODULE_TEXT_HASH
    || binding.contractTextHash !== SOURCE_002F_CONTRACT_TEXT_HASH
    || canonicalHash(binding) !== input.source002FBindingHash
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_SHAPED_FIXTURE_IMPLEMENTATION_REASON_CODES.SOURCE_002F_BINDING_HASH_MISMATCH);
  }
}

function validateOwnerPacket(input, reasons) {
  const packet = input.ownerProductShapedFixtureImplementationPacket002G;
  if (!isObject(packet)) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_SHAPED_FIXTURE_IMPLEMENTATION_REASON_CODES.OWNER_PACKET_REQUIRED);
    return;
  }
  if (packet.packetKind !== OWNER_PACKET_KIND) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_SHAPED_FIXTURE_IMPLEMENTATION_REASON_CODES.OWNER_PACKET_INVALID);
  }
  if (packet.targetContour !== TARGET_CONTOUR) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_SHAPED_FIXTURE_IMPLEMENTATION_REASON_CODES.OWNER_PACKET_TARGET_MISMATCH);
  }
  if (!hasText(packet.source002FBindingHash) || packet.source002FBindingHash !== input.source002FBindingHash) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_SHAPED_FIXTURE_IMPLEMENTATION_REASON_CODES.SOURCE_002F_BINDING_HASH_MISMATCH);
  }
  for (const field of Object.keys(packet)) {
    if (!OWNER_ALLOWED_FIELDS.has(field)) {
      reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_SHAPED_FIXTURE_IMPLEMENTATION_REASON_CODES.OWNER_PACKET_UNKNOWN_FIELD_FORBIDDEN);
    }
  }
  if (OWNER_REQUIRED_TRUE_FIELDS.some((field) => packet[field] !== true)) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_SHAPED_FIXTURE_IMPLEMENTATION_REASON_CODES.OWNER_POLICY_MISSING);
  }
  pushForbiddenClaimReasons(packet, reasons);
  validateNoCallableOrUserPath(packet, reasons);
}

function validateRequestShape(request, reasons) {
  if (!isObject(request)) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_SHAPED_FIXTURE_IMPLEMENTATION_REASON_CODES.EXACT_TEXT_GUARD_FAILED);
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
      reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_SHAPED_FIXTURE_IMPLEMENTATION_REASON_CODES.EXACT_TEXT_GUARD_FAILED);
    }
  }
  if (request.noStructuralScope !== true || request.noCommentScope !== true || request.singleSceneOnly !== true) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_SHAPED_FIXTURE_IMPLEMENTATION_REASON_CODES.UNSUPPORTED_SCOPE_FORBIDDEN);
  }
}

function validateFixturePort(port, reasons) {
  if (!isObject(port)) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_SHAPED_FIXTURE_IMPLEMENTATION_REASON_CODES.INJECTED_PRIVATE_PRODUCT_SHAPED_FIXTURE_PORT_REQUIRED);
    return;
  }
  if (PORT_REQUIRED_TRUE_FIELDS.some((field) => port[field] !== true)) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_SHAPED_FIXTURE_IMPLEMENTATION_REASON_CODES.INJECTED_PRIVATE_PRODUCT_SHAPED_FIXTURE_PORT_REQUIRED);
  }
  validateNoCallableOrUserPath(port, reasons);
  if (!isObject(port.scene) || !isObject(port.fixtureReceiptStore)) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_SHAPED_FIXTURE_IMPLEMENTATION_REASON_CODES.INJECTED_PRIVATE_PRODUCT_SHAPED_FIXTURE_PORT_REQUIRED);
  }
  if (port.productRoot || port.userProjectRoot || port.repoRoot || port.userProjectPath || port.scenePath || port.filePath) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_SHAPED_FIXTURE_IMPLEMENTATION_REASON_CODES.USER_PROJECT_PATH_FORBIDDEN);
  }
  pushForbiddenClaimReasons(port, reasons);
}

function validateReadScene(readResult, request, reasons) {
  if (!isObject(readResult) || readResult.success !== true || typeof readResult.text !== 'string') {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_SHAPED_FIXTURE_IMPLEMENTATION_REASON_CODES.SCENE_READ_FAILED);
    return '';
  }
  if (readResult.projectId !== request.projectId) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_SHAPED_FIXTURE_IMPLEMENTATION_REASON_CODES.WRONG_PROJECT);
  }
  if (readResult.sceneId !== request.sceneId) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_SHAPED_FIXTURE_IMPLEMENTATION_REASON_CODES.WRONG_SCENE);
  }
  if (readResult.closedSession === true) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_SHAPED_FIXTURE_IMPLEMENTATION_REASON_CODES.CLOSED_SESSION);
  }
  if (readResult.baselineHash !== request.baselineHash) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_SHAPED_FIXTURE_IMPLEMENTATION_REASON_CODES.STALE_BASELINE);
  }
  if (readResult.blockVersionHash !== request.expectedBlockVersionHash) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_SHAPED_FIXTURE_IMPLEMENTATION_REASON_CODES.BLOCK_VERSION_HASH_MISMATCH);
  }
  if (sceneTextHash(readResult.text) !== request.beforeSceneHash) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_SHAPED_FIXTURE_IMPLEMENTATION_REASON_CODES.EXACT_TEXT_GUARD_FAILED);
  }
  const matchCount = countOccurrences(readResult.text, request.exactBeforeText);
  if (matchCount === 0) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_SHAPED_FIXTURE_IMPLEMENTATION_REASON_CODES.EXACT_TEXT_NOT_FOUND);
  }
  if (matchCount > 1) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_SHAPED_FIXTURE_IMPLEMENTATION_REASON_CODES.EXACT_TEXT_NOT_UNIQUE);
  }
  const expectedAfterText = readResult.text.replace(request.exactBeforeText, request.replacementText);
  if (matchCount === 1 && expectedAfterText !== request.exactAfterText) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_SHAPED_FIXTURE_IMPLEMENTATION_REASON_CODES.EXACT_TEXT_GUARD_FAILED);
  }
  return readResult.text;
}

function buildReceipt(input, beforeText, backupObservationHash, atomicWriteObservationHash) {
  const request = input.exactTextApplyRequest;
  const receiptCore = {
    receiptKind: RECEIPT_KIND,
    receiptVersion: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_SHAPED_FIXTURE_RECEIPT_SCHEMA_V1_002G',
    contourId: TARGET_CONTOUR,
    projectId: request.projectId,
    sceneId: request.sceneId,
    source002FResultHash: input.source002FResultHash,
    source002FDecisionHash: input.source002FDecisionHash,
    source002EReceiptHashFrom002F: input.source002EReceiptHashFrom002F,
    beforeSceneHash: request.beforeSceneHash,
    afterSceneHash: sceneTextHash(request.exactAfterText),
    blockVersionHash: request.expectedBlockVersionHash,
    beforeTextHash: sceneTextHash(beforeText),
    exactBeforeTextHash: sceneTextHash(request.exactBeforeText),
    replacementTextHash: sceneTextHash(request.replacementText),
    backupObservationHash,
    atomicWriteObservationHash,
    receiptNonce: request.receiptNonce,
    requestedAt: request.requestedAt,
    privateProductShapedFixtureOnly: true,
    productPathPubliclyAdmitted: false,
    productWritePerformed: false,
    productStorageAdmitted: false,
    productStorageAdmission: false,
    productApplyReceiptImplemented: false,
    productApplyReceiptClaimed: false,
    applyTxnImplemented: false,
    recoveryClaimed: false,
    releaseClaimed: false,
    publicRuntimeAdmitted: false,
    userProjectMutated: false,
    realUserProjectMutated: false,
  };
  return {
    ...receiptCore,
    receiptCanonicalHash: canonicalHash(receiptCore),
  };
}

function executePrivateProductShapedFixture(input) {
  const request = input.exactTextApplyRequest;
  const port = input.injectedPrivateProductShapedFixturePort;
  const readReasons = [];
  const readResult = {
    success: port.scene.readSuccess !== false,
    projectId: port.scene.projectId,
    sceneId: port.scene.sceneId,
    baselineHash: port.scene.baselineHash,
    blockVersionHash: port.scene.blockVersionHash,
    closedSession: port.scene.closedSession === true,
    text: port.scene.text,
  };
  const beforeText = validateReadScene(readResult, request, readReasons);
  if (readReasons.length > 0) {
    return blockedResult(readReasons, {
      source002FResultHash: input.source002FResultHash,
      source002FDecisionHash: input.source002FDecisionHash,
      source002EReceiptHashFrom002F: input.source002EReceiptHashFrom002F,
    });
  }

  const backupResult = {
    success: port.fixtureBackupAccepted !== false,
    beforeTextHash: sceneTextHash(beforeText),
    beforeSceneHash: request.beforeSceneHash,
  };
  if (!isObject(backupResult) || backupResult.success !== true) {
    return blockedResult([EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_SHAPED_FIXTURE_IMPLEMENTATION_REASON_CODES.FIXTURE_BACKUP_WRITE_FAILED]);
  }
  const backupObservationHash = canonicalHash({
    observationKind: 'PRIVATE_PRODUCT_SHAPED_FIXTURE_BACKUP_OBSERVATION_002G',
    projectId: request.projectId,
    sceneId: request.sceneId,
    beforeSceneHash: request.beforeSceneHash,
    backupResult,
  });

  const atomicWriteResult = {
    success: port.fixtureAtomicWriteAccepted !== false,
    nextTextHash: sceneTextHash(request.exactAfterText),
    expectedBeforeSceneHash: request.beforeSceneHash,
  };
  if (!isObject(atomicWriteResult) || atomicWriteResult.success !== true) {
    return blockedResult([EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_SHAPED_FIXTURE_IMPLEMENTATION_REASON_CODES.FIXTURE_ATOMIC_WRITE_FAILED]);
  }
  const atomicWriteObservationHash = canonicalHash({
    observationKind: 'PRIVATE_PRODUCT_SHAPED_FIXTURE_ATOMIC_WRITE_OBSERVATION_002G',
    projectId: request.projectId,
    sceneId: request.sceneId,
    afterSceneHash: sceneTextHash(request.exactAfterText),
    atomicWriteResult,
  });

  const readbackScene = {
    success: port.fixtureReadbackAccepted !== false,
    text: port.fixtureReadbackText || request.exactAfterText,
  };
  if (!isObject(readbackScene) || readbackScene.success !== true || readbackScene.text !== request.exactAfterText) {
    return blockedResult([EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_SHAPED_FIXTURE_IMPLEMENTATION_REASON_CODES.READBACK_MISMATCH]);
  }

  const receipt = buildReceipt(input, beforeText, backupObservationHash, atomicWriteObservationHash);
  const receiptWrite = {
    success: port.privateFixtureReceiptAccepted !== false,
    receiptCanonicalHash: receipt.receiptCanonicalHash,
  };
  if (!isObject(receiptWrite) || receiptWrite.success !== true) {
    return blockedResult([EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_SHAPED_FIXTURE_IMPLEMENTATION_REASON_CODES.PRIVATE_FIXTURE_RECEIPT_WRITE_FAILED]);
  }
  const receiptReadback = {
    success: port.privateFixtureReceiptReadbackAccepted !== false,
    receipt: port.privateFixtureReceiptReadbackReceipt || receipt,
  };
  const readbackReceipt = receiptReadback?.receipt;
  if (
    !isObject(receiptReadback)
    || receiptReadback.success !== true
    || !isObject(readbackReceipt)
    || readbackReceipt.receiptCanonicalHash !== receipt.receiptCanonicalHash
    || receiptHash(readbackReceipt) !== receipt.receiptCanonicalHash
  ) {
    return blockedResult([EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_SHAPED_FIXTURE_IMPLEMENTATION_REASON_CODES.READBACK_MISMATCH]);
  }

  const cleanupObservation = {
    success: port.fixtureCleanupObserved !== false,
    cleanupObserved: port.fixtureCleanupObserved !== false,
  };
  if (!isObject(cleanupObservation) || cleanupObservation.success !== true || cleanupObservation.cleanupObserved !== true) {
    return blockedResult([EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_SHAPED_FIXTURE_IMPLEMENTATION_REASON_CODES.FIXTURE_CLEANUP_NOT_OBSERVED]);
  }

  return acceptedResult(input, receipt, {
    nextFixtureScene: {
      projectId: request.projectId,
      sceneId: request.sceneId,
      text: request.exactAfterText,
      sceneHash: sceneTextHash(request.exactAfterText),
    },
    privateFixtureReceiptWrite: {
      receiptCanonicalHash: receipt.receiptCanonicalHash,
    },
    fixtureCleanupObservationHash: canonicalHash({
      observationKind: 'PRIVATE_PRODUCT_SHAPED_FIXTURE_CLEANUP_OBSERVATION_002G',
      cleanupObservation,
    }),
  });
}

export function runExactTextApplyWithReceiptProductShapedFixtureImplementation(input = {}) {
  const reasons = [];
  pushForbiddenClaimReasons(input, reasons);
  validateNoCallableOrUserPath(input, reasons, new Set(['source002FRevalidationInput', 'injectedPrivateProductShapedFixturePort']));
  validateSource002F(input, reasons);
  validateSource002FRevalidation(input, reasons);
  validateSource002FBinding(input, reasons);
  validateOwnerPacket(input, reasons);
  validateRequestShape(input.exactTextApplyRequest, reasons);
  validateFixturePort(input.injectedPrivateProductShapedFixturePort, reasons);
  if (reasons.length > 0) {
    return blockedResult(reasons, {
      source002FResultHash: input.source002FResultHash || input.source002FResult?.canonicalHash || null,
      source002FDecisionHash: input.source002FDecisionHash || input.source002FResult?.decisions?.[0]?.canonicalHash || null,
      source002EReceiptHashFrom002F: input.source002EReceiptHashFrom002F || input.source002FResult?.source002DReceiptHashFrom002E || null,
    });
  }
  return executePrivateProductShapedFixture(input);
}

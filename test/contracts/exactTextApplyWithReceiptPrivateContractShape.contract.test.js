const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const MODULE_BASENAME = 'exactTextApplyWithReceiptPrivateContractShape.mjs';
const SOURCE_002A_MODULE_BASENAME = 'exactTextApplyWithReceiptPrivateContractBrief.mjs';
const SOURCE_001Z_MODULE_BASENAME = 'exactTextApplyWithReceiptNextContourAdmission.mjs';
const SOURCE_001Y_MODULE_BASENAME = 'exactTextApplyWithReceiptNextAdmission.mjs';
const TASK_BASENAME = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_SHAPE_002B.md';
const SOURCE_002A_TASK_BASENAME = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_BRIEF_002A.md';
const KERNEL_BASENAME = 'reviewIrKernel.mjs';
const BINDING_HEAD_SHA = 'eee8e4df010ba4f6c84fd9f471228f0c1720fc08';

async function loadModule() {
  return import(pathToFileURL(path.join(process.cwd(), 'src', 'revisionBridge', MODULE_BASENAME)).href);
}

async function load002AModule() {
  return import(pathToFileURL(path.join(process.cwd(), 'src', 'revisionBridge', SOURCE_002A_MODULE_BASENAME)).href);
}

async function load001ZModule() {
  return import(pathToFileURL(path.join(process.cwd(), 'src', 'revisionBridge', SOURCE_001Z_MODULE_BASENAME)).href);
}

async function load001YModule() {
  return import(pathToFileURL(path.join(process.cwd(), 'src', 'revisionBridge', SOURCE_001Y_MODULE_BASENAME)).href);
}

async function loadKernel() {
  return import(pathToFileURL(path.join(process.cwd(), 'src', 'revisionBridge', KERNEL_BASENAME)).href);
}

function sourceText(...segments) {
  return fs.readFileSync(path.join(process.cwd(), ...segments), 'utf8');
}

function gitLines(args) {
  return execFileSync('git', args, { cwd: process.cwd(), encoding: 'utf8' })
    .split(/\r?\n/u)
    .filter(Boolean);
}

function changedBasenamesForCurrentContour() {
  const dirty = [
    ...gitLines(['diff', '--name-only', 'HEAD']),
    ...gitLines(['diff', '--cached', '--name-only']),
    ...gitLines(['ls-files', '--others', '--exclude-standard']),
  ];
  if (dirty.length > 0) {
    return Array.from(new Set(dirty.map((filePath) => path.basename(filePath)))).sort();
  }
  return Array.from(new Set(gitLines(['diff', '--name-only', 'HEAD~1', 'HEAD'])
    .map((filePath) => path.basename(filePath)))).sort();
}

function withoutHash(value, hashKey = 'canonicalHash') {
  const { [hashKey]: _hash, ...rest } = value;
  return rest;
}

function withCanonicalHash(canonicalHash, value) {
  return {
    ...value,
    canonicalHash: canonicalHash(value),
  };
}

function withReceiptHash(canonicalHash, value) {
  return {
    ...value,
    receiptCanonicalHash: canonicalHash(value),
  };
}

const SOURCE_FALSE_FLAGS = Object.freeze({
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

function accepted001UResult(canonicalHash, resultOverrides = {}, receiptOverrides = {}, decisionOverrides = {}) {
  const decision = withCanonicalHash(canonicalHash, {
    decisionKind: 'PRIVATE_PRODUCT_APPLY_RECEIPT_IMPLEMENTATION_DECISION_001U',
    outputDecision: 'PRIVATE_PRODUCT_APPLYRECEIPT_IMPLEMENTED_FOR_EXACT_TEXT_SCOPE_NO_PUBLIC_RUNTIME',
    nextContourAfterPass: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_001V',
    productApplyRuntimeAdmitted: false,
    publicRuntimeAdmitted: false,
    applyTxnImplemented: false,
    recoveryClaimed: false,
    userProjectMutated: false,
    ...decisionOverrides,
  });
  const receipt = withReceiptHash(canonicalHash, {
    receiptKind: 'PRIVATE_PRODUCT_APPLY_RECEIPT_V1_001U',
    receiptVersion: 'PRIVATE_PRODUCT_APPLY_RECEIPT_SCHEMA_V1',
    contourId: 'PRIVATE_PRODUCT_APPLY_RECEIPT_IMPLEMENTATION_001U',
    projectId: 'project-alpha',
    sceneId: 'scene-alpha',
    source001TResultHash: canonicalHash({ source: '001t-result' }),
    source001TDecisionHash: canonicalHash({ source: '001t-decision' }),
    beforeSceneHash: canonicalHash({ scene: 'before-001u' }),
    afterSceneHash: canonicalHash({ scene: 'after-001u' }),
    blockVersionHash: canonicalHash({ block: 'version-001u' }),
    backupObservationHash: canonicalHash({ backup: '001u' }),
    atomicWriteObservationHash: canonicalHash({ write: '001u' }),
    receiptWriteIsNotApplyTxn: true,
    receiptReadbackIsNotRecovery: true,
    backupAndAtomicHashesBoundNotReproven: true,
    ...receiptOverrides,
  });
  return withCanonicalHash(canonicalHash, {
    resultKind: 'PRIVATE_PRODUCT_APPLY_RECEIPT_IMPLEMENTATION_RESULT_001U',
    contourId: 'PRIVATE_PRODUCT_APPLY_RECEIPT_IMPLEMENTATION_001U',
    privateProductApplyReceiptImplemented: true,
    privateInternalOnly: true,
    exactTextOnly: true,
    singleSceneOnly: true,
    receiptReadbackVerified: true,
    receiptHashBound: true,
    receiptWriteIsNotApplyTxn: true,
    receiptReadbackIsNotRecovery: true,
    backupAndAtomicHashesBoundNotReproven: true,
    ownerAdmissionDoesNotAuthorizeRuntimeApply: true,
    privateFunctionOnlyNoPublicSurface: true,
    outputDecision: decision.outputDecision,
    nextContourAfterPass: decision.nextContourAfterPass,
    blockedReasons: [],
    decisions: [decision],
    receipt,
    ...SOURCE_FALSE_FLAGS,
    ...resultOverrides,
  });
}

function accepted001VResult(canonicalHash, source001UResult, resultOverrides = {}, decisionOverrides = {}) {
  const decision = withCanonicalHash(canonicalHash, {
    decisionKind: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_DECISION_001V',
    outputDecision: 'OWNER_MAY_OPEN_PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_001W_NO_PUBLIC_RUNTIME',
    nextContourAfterPass: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_001W',
    exactTextApplyWithReceiptAdmissionOnly: true,
    privateExecutionNextContourOnly: true,
    admissionDoesNotImplementApplyExecution: true,
    admissionDoesNotMutateUserProject: true,
    admissionDoesNotAuthorizePublicRuntime: true,
    zeroApplyExecutionEffects: true,
    applyExecutionImplemented: false,
    userProjectMutated: false,
    publicRuntimeAdmitted: false,
    applyTxnImplemented: false,
    recoveryClaimed: false,
    ...decisionOverrides,
  });
  return withCanonicalHash(canonicalHash, {
    resultKind: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_RESULT_001V',
    contourId: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_001V',
    exactTextApplyWithReceiptAdmissionOnly: true,
    privateInternalOnly: true,
    privateExecutionNextContourOnly: true,
    exactTextOnly: true,
    singleSceneOnly: true,
    ownerPacketNotSufficientWithout001UMachineProof: true,
    admissionDoesNotAuthorizePublicRuntime: true,
    admissionDoesNotImplementApplyExecution: true,
    admissionDoesNotMutateUserProject: true,
    receiptImplementationProofRequired: true,
    source001UReceiptWriteIsNotApplyTxn: true,
    source001UReceiptReadbackIsNotRecovery: true,
    zeroApplyExecutionEffects: true,
    applyExecutionEffects: [],
    outputDecision: decision.outputDecision,
    nextContourAfterPass: decision.nextContourAfterPass,
    ownerMayOpen001W: true,
    source001UResultHash: source001UResult.canonicalHash,
    source001UDecisionHash: source001UResult.decisions[0].canonicalHash,
    source001UReceiptHash: source001UResult.receipt.receiptCanonicalHash,
    blockedReasons: [],
    decisions: [decision],
    ...SOURCE_FALSE_FLAGS,
    ...resultOverrides,
  });
}

function accepted001WResult(canonicalHash, source001VResult, source001UResult, resultOverrides = {}, receiptOverrides = {}, decisionOverrides = {}) {
  const decision = withCanonicalHash(canonicalHash, {
    decisionKind: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_DECISION_001W',
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
    ...decisionOverrides,
  });
  const receipt = withReceiptHash(canonicalHash, {
    receiptKind: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_V1_001W',
    receiptVersion: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_SCHEMA_V1',
    contourId: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_001W',
    projectId: 'project-alpha',
    sceneId: 'scene-alpha',
    sceneFileBasename: 'scene-alpha.json',
    operationKind: 'EXACT_TEXT_REPLACE',
    exactTextOnly: true,
    singleSceneOnly: true,
    source001VResultHash: source001VResult.canonicalHash,
    source001VDecisionHash: source001VResult.decisions[0].canonicalHash,
    source001UResultHash: source001UResult.canonicalHash,
    source001UDecisionHash: source001UResult.decisions[0].canonicalHash,
    source001UReceiptHash: source001UResult.receipt.receiptCanonicalHash,
    beforeSceneHash: canonicalHash({ scene: 'before' }),
    afterSceneHash: canonicalHash({ scene: 'after' }),
    blockVersionHash: canonicalHash({ block: 'version' }),
    backupObservationHash: canonicalHash({ backup: 'observed' }),
    atomicWriteObservationHash: canonicalHash({ write: 'observed' }),
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
    receiptWrittenAt: '2026-04-30T00:00:00.000Z',
    ...receiptOverrides,
  });
  return withCanonicalHash(canonicalHash, {
    resultKind: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_RESULT_001W',
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
    ...SOURCE_FALSE_FLAGS,
    outputDecision: decision.outputDecision,
    nextContourAfterPass: decision.nextContourAfterPass,
    privateExactTextApplyWithReceiptExecuted: true,
    receiptWritten: true,
    receiptReadbackVerified: true,
    backupAttempted: true,
    sceneWriteAttempted: true,
    receiptWriteAttempted: true,
    source001VResultHash: receipt.source001VResultHash,
    source001VDecisionHash: receipt.source001VDecisionHash,
    beforeSceneHash: receipt.beforeSceneHash,
    afterSceneHash: receipt.afterSceneHash,
    backupObservationHash: receipt.backupObservationHash,
    atomicWriteObservationHash: receipt.atomicWriteObservationHash,
    receiptCanonicalHash: receipt.receiptCanonicalHash,
    blockedReasons: [],
    decisions: [decision],
    receipt,
    ...resultOverrides,
  });
}

function accepted001XResult(canonicalHash, source001WResult, resultOverrides = {}, decisionOverrides = {}) {
  const decision = withCanonicalHash(canonicalHash, {
    decisionKind: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_CLOSEOUT_DECISION_001X',
    outputDecision: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_001W_CLOSEOUT_ACCEPTED',
    nextContourRecommendation: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_001Y',
    ownerMayOpen001Y: false,
    closeoutOnly: true,
    noAdmissionIn001X: true,
    noExecutionIn001X: true,
    privatePortExecutionOnly: true,
    productApplyRuntimeAdmitted: false,
    publicRuntimeAdmitted: false,
    applyTxnImplemented: false,
    recoveryClaimed: false,
    userProjectMutated: false,
    ...decisionOverrides,
  });
  return withCanonicalHash(canonicalHash, {
    resultKind: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_CLOSEOUT_RESULT_001X',
    contourId: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_CLOSEOUT_001X',
    closeoutOnly: true,
    noAdmissionIn001X: true,
    noExecutionIn001X: true,
    privatePortExecutionOnly: true,
    privateInternalOnly: true,
    exactTextOnly: true,
    singleSceneOnly: true,
    receiptIsNotRecovery: true,
    receiptReadbackIsNotStartupRecovery: true,
    atomicSingleFileWriteIsNotApplyTxn: true,
    multiFileConsistencyNotClaimed: true,
    backupSubsystemNotReproven: true,
    ownerMayOpen001Y: false,
    ...SOURCE_FALSE_FLAGS,
    outputDecision: decision.outputDecision,
    source001WAccepted: true,
    nextContourRecommendation: decision.nextContourRecommendation,
    source001WResultHash: source001WResult.canonicalHash,
    source001WDecisionHash: source001WResult.decisions[0].canonicalHash,
    source001WReceiptHash: source001WResult.receipt.receiptCanonicalHash,
    source001VResultHash: source001WResult.receipt.source001VResultHash,
    source001VDecisionHash: source001WResult.receipt.source001VDecisionHash,
    source001UResultHash: source001WResult.receipt.source001UResultHash,
    source001UDecisionHash: source001WResult.receipt.source001UDecisionHash,
    source001UReceiptHash: source001WResult.receipt.source001UReceiptHash,
    source001WReceiptKind: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_V1_001W',
    source001WReceiptCanonicalHash: source001WResult.receipt.receiptCanonicalHash,
    source001WOutputDecision: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTED_NO_PUBLIC_RUNTIME',
    source001WNextContourAfterPass: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_CLOSEOUT_001X',
    source001WReceiptVerified: true,
    blockedReasons: [],
    decisions: [decision],
    ...resultOverrides,
  });
}

function ownerPacket001Y(overrides = {}) {
  return {
    packetKind: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_ADMISSION_OWNER_PACKET_001Y',
    targetContour: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_ADAPTER_ADMISSION_001Z',
    bindingBaseSha: '199420a96ef6cf00a23f00bfc8d692ceb87d7bc0',
    ownerApprovedOpenNextContour: true,
    ownerUnderstandsAdmissionOnly: true,
    ownerUnderstandsNoRuntime: true,
    ownerUnderstandsNoPublicAdapterImplementation: true,
    ownerUnderstandsNoReleaseClaim: true,
    ownerPacketAuthorizesOnlyNextContourOpening: true,
    ...overrides,
  };
}

function ownerPacket001Z(overrides = {}) {
  return {
    packetKind: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_CONTOUR_ADMISSION_OWNER_PACKET_001Z',
    targetContour: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_BRIEF_002A',
    bindingHeadSha: '02b4682271dc2272802a76144510b11e24154020',
    ownerApprovedOpenNextContour: true,
    ownerUnderstandsAdmissionOnly: true,
    ownerUnderstandsContractBriefOnly: true,
    ownerUnderstandsNoPublicAdapterImplementation: true,
    ownerUnderstandsNoRuntimeWiring: true,
    ownerUnderstandsNoApplyExecution: true,
    ownerUnderstandsNoReleaseClaim: true,
    ownerPacketAuthorizesOnlyNextContourOpening: true,
    ...overrides,
  };
}

function ownerPacket002A(overrides = {}) {
  return {
    packetKind: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_BRIEF_OWNER_PACKET_002A',
    targetContour: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_SHAPE_002B',
    bindingHeadSha: 'a85c234ae8d2991a8b387cb76a502032789c89cc',
    ownerApprovedContractBrief: true,
    ownerUnderstandsContractBriefOnly: true,
    ownerUnderstandsNoPortImplementation: true,
    ownerUnderstandsNoStoragePort: true,
    ownerUnderstandsNoWritePort: true,
    ownerUnderstandsNoPublicAdapterImplementation: true,
    ownerUnderstandsNoRuntimeWiring: true,
    ownerUnderstandsNoApplyExecution: true,
    ownerUnderstandsNoApplyTxn: true,
    ownerUnderstandsNoRecovery: true,
    ownerUnderstandsNoReleaseClaim: true,
    ownerPacketAuthorizesOnlyContractBrief: true,
    ...overrides,
  };
}

function ownerPacket002B(overrides = {}) {
  return {
    packetKind: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_SHAPE_OWNER_PACKET_002B',
    targetContour: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_ADMISSION_002C',
    bindingHeadSha: BINDING_HEAD_SHA,
    ownerApprovedContractShape: true,
    ownerUnderstandsSchemaContractOnly: true,
    ownerUnderstandsOwnerPacketNecessaryButInsufficient: true,
    ownerUnderstandsNoPortImplementation: true,
    ownerUnderstandsNoStoragePort: true,
    ownerUnderstandsNoWritePort: true,
    ownerUnderstandsNoPublicAdapterImplementation: true,
    ownerUnderstandsNoRuntimeWiring: true,
    ownerUnderstandsNoApplyExecution: true,
    ownerUnderstandsNoApplyTxn: true,
    ownerUnderstandsNoRecovery: true,
    ownerUnderstandsNoUserProjectPath: true,
    ownerUnderstandsNoReleaseClaim: true,
    ownerPacketAuthorizesOnlyContractShape: true,
    ...overrides,
  };
}

async function acceptedInput(patch = {}) {
  const { canonicalHash } = await loadKernel();
  const { runExactTextApplyWithReceiptNextAdmission } = await load001YModule();
  const { runExactTextApplyWithReceiptNextContourAdmission } = await load001ZModule();
  const { runExactTextApplyWithReceiptPrivateContractBrief } = await load002AModule();
  const source001UResult = accepted001UResult(canonicalHash);
  const source001VResult = accepted001VResult(canonicalHash, source001UResult);
  const source001WResult = accepted001WResult(canonicalHash, source001VResult, source001UResult);
  const source001XResult = accepted001XResult(canonicalHash, source001WResult);
  const source001YResult = runExactTextApplyWithReceiptNextAdmission({
    source001XResult,
    source001XResultHash: source001XResult.canonicalHash,
    source001XDecisionHash: source001XResult.decisions[0].canonicalHash,
    source001WResult,
    source001VResult,
    source001UResult,
    ownerAdmissionPacket001Y: ownerPacket001Y(),
  });
  const source001ZResult = runExactTextApplyWithReceiptNextContourAdmission({
    source001YResult,
    source001YResultHash: source001YResult.canonicalHash,
    source001YDecisionHash: source001YResult.decisions[0].canonicalHash,
    source001XResult,
    source001WResult,
    source001VResult,
    source001UResult,
    ownerAdmissionPacket001Z: ownerPacket001Z(),
  });
  const source002AResult = runExactTextApplyWithReceiptPrivateContractBrief({
    source001ZResult,
    source001ZResultHash: source001ZResult.canonicalHash,
    source001ZDecisionHash: source001ZResult.decisions[0].canonicalHash,
    source001YResult,
    source001XResult,
    source001WResult,
    source001VResult,
    source001UResult,
    ownerAdmissionPacket001Z: ownerPacket001Z(),
    ownerBriefPacket002A: ownerPacket002A(),
  });
  return {
    source002AResult,
    source002AResultHash: source002AResult.canonicalHash,
    source002ADecisionHash: source002AResult.decisions[0].canonicalHash,
    source001ZResult,
    source001YResult,
    source001XResult,
    source001WResult,
    source001VResult,
    source001UResult,
    ownerAdmissionPacket001Z: ownerPacket001Z(),
    ownerBriefPacket002A: ownerPacket002A(),
    ownerShapePacket002B: ownerPacket002B(),
    ...patch,
  };
}

test('002B emits deterministic contract shape only after accepted 002A and inherited chain revalidation', async () => {
  const { runExactTextApplyWithReceiptPrivateContractShape } = await loadModule();
  const { canonicalHash } = await loadKernel();
  const input = await acceptedInput();
  const result = runExactTextApplyWithReceiptPrivateContractShape(input);

  assert.equal(result.resultKind, 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_SHAPE_RESULT_002B');
  assert.equal(result.outputDecision, 'OWNER_MAY_OPEN_PRIVATE_PORT_ADMISSION_002C_NO_PUBLIC_RUNTIME_ADMITTED');
  assert.equal(result.nextContourRecommendation, 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_ADMISSION_002C');
  assert.equal(result.ownerMayOpen002C, true);
  assert.equal(result.ownerShapeAccepted, true);
  assert.equal(result.source002AAccepted, true);
  assert.equal(result.writeEffectsCount, 0);
  assert.equal(result.exitPacket.writeEffectsCount, 0);
  assert.equal(result.exitPacket.inheritedChainVerified, true);
  assert.equal(result.exitPacket.source002ARehashed, true);
  assert.equal(result.contractShape.shapeKind, 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_CONTRACT_SHAPE_V1_002B');
  assert.equal(result.contractShape.ownerPacketNecessaryButInsufficient, true);
  assert.equal(result.contractShape.writeEffectsCount, 0);
  assert.equal(result.contractShape.requestSchema.projectIdRequired, true);
  assert.equal(result.contractShape.requestSchema.sourceResultHashRequired, true);
  assert.equal(result.contractShape.requestSchema.exactBeforeTextRequired, true);
  assert.equal(result.contractShape.requestSchema.exactAfterTextRequired, true);
  assert.equal(result.contractShape.requestSchema.receiptNonceRequired, true);
  assert.equal(result.contractShape.requestSchema.userProjectPathAccepted, false);
  assert.equal(result.contractShape.preconditionSchema.projectIdTestRequired, true);
  assert.equal(result.contractShape.preconditionSchema.exactTextGuardRequired, true);
  assert.equal(result.contractShape.preconditionSchema.noStructuralScopeTestRequired, true);
  assert.equal(result.contractShape.preconditionSchema.inheritedChainRevalidationRequired, true);
  assert.equal(result.contractShape.futurePortCapabilitySchema.capabilityDescriptorOnly, true);
  assert.equal(result.contractShape.futurePortCapabilitySchema.canResolvePrivateRootRequired, true);
  assert.equal(result.contractShape.futurePortCapabilitySchema.canAtomicWriteSceneRequired, true);
  assert.equal(result.contractShape.futurePortCapabilitySchema.canReportFailureWithoutPartialSuccessRequired, true);
  assert.equal(result.contractShape.futurePortCapabilitySchema.portImplementationAdmitted, false);
  assert.equal(result.contractShape.futurePortCapabilitySchema.applyExactTextWithReceipt, 'FUTURE_CAPABILITY_DESCRIPTOR_ONLY');
  assert.equal(result.contractShape.successReceiptSchema.receiptKindRequired, true);
  assert.equal(result.contractShape.successReceiptSchema.source002BResultHashRequired, true);
  assert.equal(result.contractShape.successReceiptSchema.atomicWriteObservationHashRequired, true);
  assert.equal(result.contractShape.successReceiptSchema.receiptCanonicalHashRequired, true);
  assert.equal(result.contractShape.failureResultSchema.noReceiptOnBlockedPlan, true);
  assert.equal(result.contractShape.blockedReasonCodeSchema.sourceResultHashMismatchCodeRequired, true);
  assert.equal(result.contractShape.blockedReasonCodeSchema.pathTraversalCodeRequired, true);
  assert.equal(result.contractShape.blockedReasonCodeSchema.targetCollisionCodeRequired, true);
  assert.equal(result.contractShape.blockedReasonCodeSchema.deterministicOrderingRequired, true);
  assert.equal(result.publicRuntimeAdmitted, false);
  assert.equal(result.publicAdapterImplementationAdmitted, false);
  assert.equal(result.runtimeWiringAdmitted, false);
  assert.equal(result.applyExecutionImplemented, false);
  assert.equal(result.applyTxnImplemented, false);
  assert.equal(result.recoveryClaimed, false);
  assert.equal(result.userProjectMutated, false);
  assert.deepEqual(result.blockedReasons, []);
  assert.equal(result.decisions[0].decisionKind, 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_SHAPE_DECISION_002B');
  assert.equal(result.decisions[0].writeEffectsCount, 0);
  assert.equal(result.contractShape.canonicalHash, canonicalHash(withoutHash(result.contractShape)));
  assert.equal(result.canonicalHash, canonicalHash(withoutHash(result)));
});

test('002B blocks source hash mismatches and tampered 002A contract artifacts', async () => {
  const { runExactTextApplyWithReceiptPrivateContractShape, EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_SHAPE_REASON_CODES } = await loadModule();
  const { canonicalHash } = await loadKernel();
  const base = await acceptedInput();
  const tamperedBrief = withCanonicalHash(canonicalHash, {
    ...withoutHash(base.source002AResult.contractBrief),
    requiredExactTextGuard: false,
  });
  const tamperedBriefResult = withCanonicalHash(canonicalHash, {
    ...withoutHash(base.source002AResult),
    contractBrief: tamperedBrief,
    contractBriefHash: tamperedBrief.canonicalHash,
  });
  const tamperedFailure = withCanonicalHash(canonicalHash, {
    ...withoutHash(base.source002AResult.failureContract),
    noReceiptOnBlockedPlan: false,
  });
  const tamperedFailureResult = withCanonicalHash(canonicalHash, {
    ...withoutHash(base.source002AResult),
    failureContract: tamperedFailure,
    failureContractHash: tamperedFailure.canonicalHash,
  });
  const cases = [
    { patch: { source002AResult: null }, code: 'SOURCE_002A_RESULT_REQUIRED' },
    { patch: { source002AResultHash: canonicalHash({ wrong: '002a-result' }) }, code: 'SOURCE_002A_RESULT_MISMATCH' },
    { patch: { source002ADecisionHash: canonicalHash({ wrong: '002a-decision' }) }, code: 'SOURCE_002A_DECISION_MISMATCH' },
    { patch: { source002AResult: tamperedBriefResult, source002AResultHash: tamperedBriefResult.canonicalHash }, code: 'INHERITED_CHAIN_REVALIDATION_FAILED' },
    { patch: { source002AResult: tamperedFailureResult, source002AResultHash: tamperedFailureResult.canonicalHash }, code: 'INHERITED_CHAIN_REVALIDATION_FAILED' },
  ];

  for (const item of cases) {
    const result = runExactTextApplyWithReceiptPrivateContractShape({ ...base, ...item.patch });
    assert.equal(result.outputDecision, 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_SHAPE_002B_BLOCKED');
    assert.equal(result.ownerShapeAccepted, false);
    assert.equal(result.blockedReasons.includes(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_SHAPE_REASON_CODES[item.code]), true, item.code);
  }
});

test('002B blocks synthetic 002A and missing inherited chain despite owner packet', async () => {
  const { runExactTextApplyWithReceiptPrivateContractShape, EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_SHAPE_REASON_CODES } = await loadModule();
  const { canonicalHash } = await loadKernel();
  const base = await acceptedInput();
  const synthetic002A = withCanonicalHash(canonicalHash, {
    ...withoutHash(base.source002AResult),
    source001ZResultHash: canonicalHash({ synthetic: '001z-result' }),
  });
  const blocked002A = withCanonicalHash(canonicalHash, {
    ...withoutHash(base.source002AResult),
    outputDecision: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_BRIEF_002A_BLOCKED',
    ownerMayOpen002B: false,
    blockedReasons: ['BLOCKED'],
    decisions: [],
  });
  const cases = [
    { patch: { source002AResult: synthetic002A, source002AResultHash: synthetic002A.canonicalHash }, code: 'INHERITED_CHAIN_REVALIDATION_FAILED' },
    { patch: { source001ZResult: null }, code: 'INHERITED_CHAIN_REVALIDATION_FAILED' },
    { patch: { source001YResult: null }, code: 'INHERITED_CHAIN_REVALIDATION_FAILED' },
    { patch: { source002AResult: blocked002A, source002AResultHash: blocked002A.canonicalHash, source002ADecisionHash: '' }, code: 'SOURCE_002A_BLOCKED' },
  ];

  for (const item of cases) {
    const result = runExactTextApplyWithReceiptPrivateContractShape({ ...base, ...item.patch });
    assert.equal(result.ownerShapeAccepted, false);
    assert.equal(result.blockedReasons.includes(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_SHAPE_REASON_CODES[item.code]), true, item.code);
  }
});

test('002B owner packet is necessary but cannot authorize forbidden overrides', async () => {
  const { runExactTextApplyWithReceiptPrivateContractShape, EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_SHAPE_REASON_CODES } = await loadModule();
  const { canonicalHash } = await loadKernel();
  const base = await acceptedInput();
  const cases = [
    { patch: { ownerShapePacket002B: null }, code: 'OWNER_PACKET_REQUIRED' },
    { patch: { ownerShapePacket002B: ownerPacket002B({ packetKind: 'WRONG_PACKET' }) }, code: 'OWNER_PACKET_INVALID' },
    { patch: { ownerShapePacket002B: ownerPacket002B({ targetContour: 'WRONG_TARGET' }) }, code: 'OWNER_PACKET_TARGET_MISMATCH' },
    { patch: { ownerShapePacket002B: ownerPacket002B({ bindingHeadSha: 'wrong-sha' }) }, code: 'OWNER_PACKET_BINDING_MISMATCH' },
    { patch: { ownerShapePacket002B: ownerPacket002B({ ownerApprovedContractShape: false }) }, code: 'OWNER_SHAPE_POLICY_MISSING' },
    { patch: { ownerShapePacket002B: ownerPacket002B({ lowerDeliveryRecordClosureClaimed: true }) }, code: 'OWNER_PACKET_UNKNOWN_FIELD_FORBIDDEN' },
    { patch: { ownerShapePacket002B: ownerPacket002B({ noPortImplementation: false }) }, code: 'PORT_IMPLEMENTATION_FORBIDDEN' },
    { patch: { ownerShapePacket002B: ownerPacket002B({ publicRuntimeAdmitted: true }) }, code: 'PRODUCT_RUNTIME_FORBIDDEN' },
    { patch: { ownerShapePacket002B: ownerPacket002B({ publicAdapterImplementationAdmitted: true }) }, code: 'PUBLIC_ADAPTER_IMPLEMENTATION_FORBIDDEN' },
    { patch: { ownerShapePacket002B: ownerPacket002B({ runtimeWiringAdmitted: true }) }, code: 'RUNTIME_WIRING_FORBIDDEN' },
    { patch: { ownerShapePacket002B: ownerPacket002B({ applyExecutionImplemented: true }) }, code: 'APPLY_EXECUTION_FORBIDDEN' },
    { patch: { ownerShapePacket002B: ownerPacket002B({ applyTxnImplemented: true }) }, code: 'APPLYTXN_RECOVERY_RELEASE_FORBIDDEN' },
    { patch: { ownerShapePacket002B: ownerPacket002B({ userProjectMutated: true }) }, code: 'USER_PROJECT_MUTATION_FORBIDDEN' },
    { patch: { source002AResultHash: canonicalHash({ wrong: 'owner-is-insufficient' }) }, code: 'SOURCE_002A_RESULT_MISMATCH' },
  ];

  for (const item of cases) {
    const result = runExactTextApplyWithReceiptPrivateContractShape({ ...base, ...item.patch });
    assert.equal(result.ownerShapeAccepted, false);
    assert.equal(result.blockedReasons.includes(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_SHAPE_REASON_CODES[item.code]), true, item.code);
  }
});

test('002B blocks missing schema fields unknown overrides non-object overrides callables and user project paths', async () => {
  const { runExactTextApplyWithReceiptPrivateContractShape, EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_SHAPE_REASON_CODES } = await loadModule();
  const base = await acceptedInput();
  const cases = [
    { patch: { contractShapeOverrides: { noWritePort: false } }, code: 'PORT_IMPLEMENTATION_FORBIDDEN' },
    { patch: { requestSchemaOverrides: { projectIdRequired: false } }, code: 'SHAPE_SCHEMA_FIELD_MISSING' },
    { patch: { preconditionSchemaOverrides: { inheritedChainRevalidationRequired: false } }, code: 'SHAPE_SCHEMA_FIELD_MISSING' },
    { patch: { futurePortCapabilitySchemaOverrides: { capabilityDescriptorOnly: false } }, code: 'SHAPE_SCHEMA_FIELD_MISSING' },
    { patch: { successReceiptSchemaOverrides: { receiptCanonicalHashRequired: false } }, code: 'SHAPE_SCHEMA_FIELD_MISSING' },
    { patch: { failureResultSchemaOverrides: { noReceiptOnBlockedPlan: false } }, code: 'SHAPE_SCHEMA_FIELD_MISSING' },
    { patch: { blockedReasonCodeSchemaOverrides: { deterministicOrderingRequired: false } }, code: 'SHAPE_SCHEMA_FIELD_MISSING' },
    { patch: { contractShapeOverrides: { lowerDeliveryRecordClosureClaimed: true } }, code: 'SHAPE_UNKNOWN_FIELD_FORBIDDEN' },
    { patch: { requestSchemaOverrides: { lowerDeliveryRecordClosureClaimed: true } }, code: 'NESTED_SCHEMA_UNKNOWN_FIELD_FORBIDDEN' },
    { patch: { futurePortCapabilitySchemaOverrides: { writeEvidenceClaimed: true } }, code: 'NESTED_SCHEMA_UNKNOWN_FIELD_FORBIDDEN' },
    { patch: { contractShapeOverrides: 'shape-override' }, code: 'SHAPE_OVERRIDE_NON_OBJECT_FORBIDDEN' },
    { patch: { requestSchemaOverrides: ['projectIdRequired'] }, code: 'SHAPE_OVERRIDE_NON_OBJECT_FORBIDDEN' },
    { patch: { futurePortCapabilitySchemaOverrides: { applyExactTextWithReceipt: () => null } }, code: 'CALLABLE_FIELD_FORBIDDEN' },
    { patch: { requestSchemaOverrides: { userProjectPath: '/tmp/user-project' } }, code: 'USER_PROJECT_PATH_FORBIDDEN' },
    { patch: { ownerShapePacket002B: ownerPacket002B({ projectPath: '/tmp/user-project' }) }, code: 'USER_PROJECT_PATH_FORBIDDEN' },
  ];

  for (const item of cases) {
    const result = runExactTextApplyWithReceiptPrivateContractShape({ ...base, ...item.patch });
    assert.equal(result.ownerShapeAccepted, false);
    assert.equal(result.blockedReasons.includes(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_SHAPE_REASON_CODES[item.code]), true, item.code);
  }
});

test('002B task record preserves private shape boundary and no-write policy', () => {
  const taskText = sourceText('docs', 'tasks', TASK_BASENAME);
  assert.match(taskText, /TASK_ID: PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_SHAPE_002B/u);
  assert.match(taskText, /CONTOUR_TYPE: PRIVATE_CONTRACT_SHAPE_ONLY/u);
  assert.match(taskText, /PREVIOUS_CONTOUR: PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_BRIEF_002A/u);
  assert.match(taskText, /NEXT_CONTOUR_IF_PASS: PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_ADMISSION_002C/u);
  assert.match(taskText, /OWNER_PACKET_TARGET: PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_ADMISSION_002C/u);
  assert.match(taskText, /SUCCESS_DECISION: OWNER_MAY_OPEN_PRIVATE_PORT_ADMISSION_002C_NO_PUBLIC_RUNTIME_ADMITTED/u);
  assert.match(taskText, /MODULE_CONTRACT: PURE_SCHEMA_CONTRACT_ONLY/u);
  assert.match(taskText, /NO_PORT_IMPLEMENTATION: true/u);
  assert.match(taskText, /NO_STORAGE_PORT: true/u);
  assert.match(taskText, /NO_WRITE_PORT: true/u);
  assert.match(taskText, /PUBLIC_RUNTIME_ADMITTED: false/u);
  assert.match(taskText, /PUBLIC_ADAPTER_IMPLEMENTATION_ADMITTED: false/u);
  assert.match(taskText, /RUNTIME_WIRING_ADMITTED: false/u);
  assert.match(taskText, /APPLY_EXECUTION_IMPLEMENTED: false/u);
  assert.match(taskText, /APPLYTXN_IMPLEMENTED: false/u);
  assert.match(taskText, /RECOVERY_CLAIMED: false/u);
  assert.match(taskText, /USER_PROJECT_PATH_ACCEPTED: false/u);
  assert.match(taskText, /DELIVERY_POLICY: COMMIT_REQUIRED_PUSH_REQUIRED/u);
  assert.match(taskText, /STATUS: DONE/u);
  assert.match(taskText, /COMMIT_SHA: 9e2ca9f15f6774991f8d1ac2914edd6d8401dad3/u);
  assert.match(taskText, /PUSH_RESULT: pushed/u);
  assert.doesNotMatch(taskText, /release green|public apply|DOCX runtime|ApplyTxn implemented|recovery proven/iu);

  const sourceTaskText = sourceText('docs', 'tasks', SOURCE_002A_TASK_BASENAME);
  assert.match(sourceTaskText, /STATUS: DONE/u);
  assert.match(sourceTaskText, /COMMIT_SHA: 48caf85c31726e11b77790585ca0bac351665aea/u);
  assert.match(sourceTaskText, /PUSH_RESULT: pushed/u);
});

test('002B changed scope stays exact-path allowlisted and module stays pure', () => {
  const changedPaths = [
    ...gitLines(['diff', '--name-only', 'HEAD']),
    ...gitLines(['diff', '--cached', '--name-only']),
    ...gitLines(['ls-files', '--others', '--exclude-standard']),
  ].sort();
  const changedBasenames = changedBasenamesForCurrentContour();
  const allowedPaths = new Set([
    'docs/tasks/PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_SHAPE_002B.md',
    'scripts/ops/revision-bridge-pre-stage-00-admission-guard-state.mjs',
    'src/revisionBridge/exactTextApplyWithReceiptPrivateContractShape.mjs',
    'test/contracts/exactTextApplyFixtureDurableReceiptPrototype.contract.test.js',
    'test/contracts/exactTextApplyInternalWritePrototype.contract.test.js',
    'test/contracts/exactTextApplyPrivateProductApplyReceipt.contract.test.js',
    'test/contracts/exactTextApplyPrivateProductApplyReceiptAdmission.contract.test.js',
    'test/contracts/exactTextApplyProductApplyAdmissionGate.contract.test.js',
    'test/contracts/exactTextApplyProductApplyReadinessReview.contract.test.js',
    'test/contracts/exactTextApplyProductStoragePrimitiveEvidence.contract.test.js',
    'test/contracts/exactTextApplyTestFixtureReceiptFile.contract.test.js',
    'test/contracts/exactTextApplyTestOnlyProductShapedStorageDryRun.contract.test.js',
    'test/contracts/exactTextApplyTestOnlyStoragePrimitiveExecutionHarness.contract.test.js',
    'test/contracts/exactTextApplyWithReceiptAdmission.contract.test.js',
    'test/contracts/exactTextApplyWithReceiptCloseout.contract.test.js',
    'test/contracts/exactTextApplyWithReceiptExecution.contract.test.js',
    'test/contracts/exactTextApplyWithReceiptNextAdmission.contract.test.js',
    'test/contracts/exactTextApplyWithReceiptNextContourAdmission.contract.test.js',
    'test/contracts/exactTextApplyWithReceiptPrivateContractBrief.contract.test.js',
    'test/contracts/exactTextApplyWithReceiptPrivateContractShape.contract.test.js',
  ]);
  const allowlist = new Set([
    MODULE_BASENAME,
    'exactTextApplyFixtureDurableReceiptPrototype.contract.test.js',
    'exactTextApplyInternalWritePrototype.contract.test.js',
    'exactTextApplyPrivateProductApplyReceipt.contract.test.js',
    'exactTextApplyPrivateProductApplyReceiptAdmission.contract.test.js',
    'exactTextApplyProductApplyAdmissionGate.contract.test.js',
    'exactTextApplyProductApplyReadinessReview.contract.test.js',
    'exactTextApplyProductStoragePrimitiveEvidence.contract.test.js',
    'exactTextApplyTestFixtureReceiptFile.contract.test.js',
    'exactTextApplyTestOnlyProductShapedStorageDryRun.contract.test.js',
    'exactTextApplyTestOnlyStoragePrimitiveExecutionHarness.contract.test.js',
    'exactTextApplyWithReceiptAdmission.contract.test.js',
    'exactTextApplyWithReceiptCloseout.contract.test.js',
    'exactTextApplyWithReceiptExecution.contract.test.js',
    'exactTextApplyWithReceiptNextAdmission.contract.test.js',
    'exactTextApplyWithReceiptNextContourAdmission.contract.test.js',
    'exactTextApplyWithReceiptPrivateContractBrief.contract.test.js',
    'exactTextApplyWithReceiptPrivateContractShape.contract.test.js',
    TASK_BASENAME,
    'revision-bridge-pre-stage-00-admission-guard-state.mjs',
  ]);
  const denylist = new Set([
    'main.js',
    'preload.js',
    'editor.js',
    'index.html',
    'styles.css',
    'package.json',
    'package-lock.json',
    'fileManager.js',
    'backupManager.js',
    'command-catalog.v1.mjs',
    'projectCommands.mjs',
    'hostilePackageGate.mjs',
  ]);
  assert.notDeepEqual(changedBasenames, [], '002B must have detectable changed scope');
  for (const changedPath of changedPaths) {
    assert.equal(allowedPaths.has(changedPath), true, `unexpected 002B changed path: ${changedPath}`);
  }
  for (const basename of changedBasenames) {
    assert.equal(allowlist.has(basename), true, `unexpected 002B changed basename: ${basename}`);
    assert.equal(denylist.has(basename), false, `denylisted 002B changed basename: ${basename}`);
  }

  const moduleText = sourceText('src', 'revisionBridge', MODULE_BASENAME);
  const importLines = moduleText.split(/\r?\n/u).filter((line) => line.startsWith('import '));
  assert.deepEqual(importLines, [
    "import { canonicalHash } from './reviewIrKernel.mjs';",
    "import { runExactTextApplyWithReceiptPrivateContractBrief } from './exactTextApplyWithReceiptPrivateContractBrief.mjs';",
  ]);
  const forbiddenPatterns = [
    /from\s+['"]node:fs/u,
    /from\s+['"]node:path/u,
    /from\s+['"]node:os/u,
    /from\s+['"][^'"]*backupManager[^'"]*['"]/u,
    /from\s+['"][^'"]*fileManager[^'"]*['"]/u,
    /from\s+['"]electron['"]/u,
    /import\s*\(\s*['"]electron['"]\s*\)/u,
    /import\s*\(\s*['"]node:fs['"]\s*\)/u,
    /require\s*\(\s*['"]electron['"]\s*\)/u,
    /from\s+['"][^'"]*(?:main|preload|editor|command-catalog|projectCommands|runtimeBridge)[^'"]*['"]/u,
  ];
  for (const pattern of forbiddenPatterns) {
    assert.equal(pattern.test(moduleText), false, `forbidden 002B import pattern: ${pattern.source}`);
  }
});

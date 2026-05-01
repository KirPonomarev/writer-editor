const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const MODULE_BASENAME = 'exactTextApplyWithReceiptNextAdmission.mjs';
const TASK_BASENAME = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_ADMISSION_001Y.md';
const KERNEL_BASENAME = 'reviewIrKernel.mjs';
const BINDING_BASE_SHA = '199420a96ef6cf00a23f00bfc8d692ceb87d7bc0';

async function loadModule() {
  return import(pathToFileURL(path.join(process.cwd(), 'src', 'revisionBridge', MODULE_BASENAME)).href);
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
  if (!source001UResult) {
    source001UResult = accepted001UResult(canonicalHash);
  }
  if (!source001VResult) {
    source001VResult = accepted001VResult(canonicalHash, source001UResult);
  }
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
  if (!source001WResult) {
    source001WResult = accepted001WResult(canonicalHash);
  }
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

function ownerPacket(overrides = {}) {
  return {
    packetKind: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_ADMISSION_OWNER_PACKET_001Y',
    targetContour: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_ADAPTER_ADMISSION_001Z',
    bindingBaseSha: BINDING_BASE_SHA,
    ownerApprovedOpenNextContour: true,
    ownerUnderstandsAdmissionOnly: true,
    ownerUnderstandsNoRuntime: true,
    ownerUnderstandsNoPublicAdapterImplementation: true,
    ownerUnderstandsNoReleaseClaim: true,
    ownerPacketAuthorizesOnlyNextContourOpening: true,
    ...overrides,
  };
}

async function acceptedInput(patch = {}) {
  const { canonicalHash } = await loadKernel();
  const source001UResult = accepted001UResult(canonicalHash);
  const source001VResult = accepted001VResult(canonicalHash, source001UResult);
  const source001WResult = accepted001WResult(canonicalHash, source001VResult, source001UResult);
  const source001XResult = accepted001XResult(canonicalHash, source001WResult);
  return {
    source001XResult,
    source001UResult,
    source001VResult,
    source001WResult,
    source001XResultHash: source001XResult.canonicalHash,
    source001XDecisionHash: source001XResult.decisions[0].canonicalHash,
    ownerAdmissionPacket001Y: ownerPacket(),
    ...patch,
  };
}

test('001Y admits only opening the next private adapter admission contour after 001X proof and owner packet', async () => {
  const { runExactTextApplyWithReceiptNextAdmission } = await loadModule();
  const { canonicalHash } = await loadKernel();
  const input = await acceptedInput();
  const result = runExactTextApplyWithReceiptNextAdmission(input);

  assert.equal(result.resultKind, 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_ADMISSION_RESULT_001Y');
  assert.equal(result.outputDecision, 'OWNER_MAY_OPEN_NEXT_PRIVATE_ADAPTER_ADMISSION_CONTOUR_001Z_NO_PUBLIC_RUNTIME_ADMITTED');
  assert.equal(result.nextContourRecommendation, 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_ADAPTER_ADMISSION_001Z');
  assert.equal(result.ownerMayOpen001Z, true);
  assert.equal(result.admissionOnly, true);
  assert.equal(result.ownerPacketAuthorizesOnlyNextContourOpening, true);
  assert.equal(result.source001XAccepted, true);
  assert.equal(result.publicRuntimeAdmitted, false);
  assert.equal(result.productApplyRuntimeAdmitted, false);
  assert.equal(result.publicAdapterImplementationAdmitted, false);
  assert.equal(result.runtimeWiringAdmitted, false);
  assert.equal(result.applyExecutionImplemented, false);
  assert.equal(result.applyTxnImplemented, false);
  assert.equal(result.recoveryClaimed, false);
  assert.equal(result.userProjectMutated, false);
  assert.equal(result.source001XResultHash, input.source001XResultHash);
  assert.equal(result.source001XDecisionHash, input.source001XDecisionHash);
  assert.equal(result.source001WResultHash, input.source001XResult.source001WResultHash);
  assert.equal(result.source001UReceiptHash, input.source001XResult.source001UReceiptHash);
  assert.deepEqual(result.blockedReasons, []);
  assert.equal(result.decisions[0].decisionKind, 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_ADMISSION_DECISION_001Y');
  assert.equal(result.decisions[0].ownerMayOpen001Z, true);
  assert.equal(result.decisions[0].publicAdapterImplementationAdmitted, false);
  assert.equal(result.decisions[0].runtimeWiringAdmitted, false);
  assert.equal(result.canonicalHash, canonicalHash(withoutHash(result)));
});

test('001Y blocks missing blocked mismatched or self-opening 001X source', async () => {
  const { runExactTextApplyWithReceiptNextAdmission, EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_ADMISSION_REASON_CODES } = await loadModule();
  const { canonicalHash } = await loadKernel();
  const base = await acceptedInput();
  const cases = [
    { patch: { source001XResult: null }, code: 'SOURCE_001X_RESULT_REQUIRED' },
    { patch: { source001XResultHash: canonicalHash({ wrong: 'result' }) }, code: 'SOURCE_001X_RESULT_MISMATCH' },
    { patch: { source001XDecisionHash: canonicalHash({ wrong: 'decision' }) }, code: 'SOURCE_001X_DECISION_MISMATCH' },
    { patch: { source001XResult: accepted001XResult(canonicalHash, undefined, { outputDecision: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_001W_CLOSEOUT_BLOCKED', blockedReasons: ['BLOCKED'] }) }, code: 'SOURCE_001X_BLOCKED' },
    { patch: { source001XResult: accepted001XResult(canonicalHash, undefined, { ownerMayOpen001Y: true }) }, code: 'SOURCE_001X_BLOCKED' },
    { patch: { source001XResult: accepted001XResult(canonicalHash, undefined, { noAdmissionIn001X: false }) }, code: 'SOURCE_001X_BOUNDARY_MISSING' },
    { patch: { source001XResult: accepted001XResult(canonicalHash, undefined, { publicRuntimeAdmitted: true }) }, code: 'SOURCE_001X_RUNTIME_FLAG_FORBIDDEN' },
  ];

  for (const item of cases) {
    const result = runExactTextApplyWithReceiptNextAdmission({ ...base, ...item.patch });
    assert.equal(result.outputDecision, 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_ADMISSION_001Y_BLOCKED');
    assert.equal(result.ownerMayOpen001Z, false);
    assert.equal(result.blockedReasons.includes(EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_ADMISSION_REASON_CODES[item.code]), true, item.code);
  }
});

test('001Y blocks malformed source decision and missing inherited hash chain', async () => {
  const { runExactTextApplyWithReceiptNextAdmission, EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_ADMISSION_REASON_CODES } = await loadModule();
  const { canonicalHash } = await loadKernel();
  const base = await acceptedInput();
  const sourceWithTwoDecisions = accepted001XResult(canonicalHash);
  sourceWithTwoDecisions.decisions = [sourceWithTwoDecisions.decisions[0], sourceWithTwoDecisions.decisions[0]];
  sourceWithTwoDecisions.canonicalHash = canonicalHash(withoutHash(sourceWithTwoDecisions));
  const cases = [
    { source: accepted001XResult(canonicalHash, undefined, {}, { decisionKind: 'WRONG_DECISION' }), code: 'SOURCE_001X_DECISION_MALFORMED' },
    { source: sourceWithTwoDecisions, code: 'SOURCE_001X_DECISION_MALFORMED' },
    { source: accepted001XResult(canonicalHash, undefined, { source001WResultHash: '' }), code: 'SOURCE_CHAIN_MISSING' },
    { source: accepted001XResult(canonicalHash, undefined, { source001WDecisionHash: '' }), code: 'SOURCE_CHAIN_MISSING' },
    { source: accepted001XResult(canonicalHash, undefined, { source001WReceiptHash: '' }), code: 'SOURCE_CHAIN_MISSING' },
    { source: accepted001XResult(canonicalHash, undefined, { source001VResultHash: '' }), code: 'SOURCE_CHAIN_MISSING' },
    { source: accepted001XResult(canonicalHash, undefined, { source001UReceiptHash: '' }), code: 'SOURCE_CHAIN_MISSING' },
  ];

  for (const item of cases) {
    const result = runExactTextApplyWithReceiptNextAdmission({
      ...base,
      source001XResult: item.source,
      source001XResultHash: item.source.canonicalHash,
      source001XDecisionHash: item.source.decisions[0].canonicalHash,
    });
    assert.equal(result.blockedReasons.includes(EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_ADMISSION_REASON_CODES[item.code]), true, item.code);
  }
});

test('001Y requires rehashed 001V and 001U source artifacts, not only 001X and 001W hash strings', async () => {
  const { runExactTextApplyWithReceiptNextAdmission, EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_ADMISSION_REASON_CODES } = await loadModule();
  const { canonicalHash } = await loadKernel();
  const base = await acceptedInput();
  const synthetic001W = accepted001WResult(canonicalHash);
  const synthetic001X = accepted001XResult(canonicalHash, synthetic001W);
  const mismatched001V = accepted001VResult(canonicalHash, base.source001UResult, {
    source001UResultHash: canonicalHash({ mismatched: '001u-result' }),
  });
  const mismatched001U = accepted001UResult(canonicalHash, {}, {
    receiptKind: 'PRIVATE_PRODUCT_APPLY_RECEIPT_V1_001U',
    atomicWriteObservationHash: canonicalHash({ mismatched: '001u-receipt' }),
  });
  const cases = [
    { patch: { source001VResult: null }, code: 'SOURCE_001V_RESULT_REQUIRED' },
    { patch: { source001UResult: null }, code: 'SOURCE_001U_RESULT_REQUIRED' },
    { patch: { source001VResult: mismatched001V }, code: 'SOURCE_001V_RESULT_MISMATCH' },
    { patch: { source001UResult: mismatched001U }, code: 'SOURCE_001U_RESULT_MISMATCH' },
    {
      patch: {
        source001XResult: synthetic001X,
        source001XResultHash: synthetic001X.canonicalHash,
        source001XDecisionHash: synthetic001X.decisions[0].canonicalHash,
        source001WResult: synthetic001W,
        source001VResult: null,
        source001UResult: null,
      },
      code: 'SOURCE_001V_RESULT_REQUIRED',
    },
  ];

  for (const item of cases) {
    const result = runExactTextApplyWithReceiptNextAdmission({ ...base, ...item.patch });
    assert.equal(result.ownerMayOpen001Z, false);
    assert.equal(result.blockedReasons.includes(EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_ADMISSION_REASON_CODES[item.code]), true, item.code);
  }
});

test('001Y requires strict owner packet and cannot be overridden by owner claims', async () => {
  const { runExactTextApplyWithReceiptNextAdmission, EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_ADMISSION_REASON_CODES } = await loadModule();
  const base = await acceptedInput();
  const cases = [
    { packet: null, code: 'OWNER_PACKET_REQUIRED' },
    { packet: ownerPacket({ packetKind: 'WRONG_PACKET' }), code: 'OWNER_PACKET_INVALID' },
    { packet: ownerPacket({ targetContour: 'WRONG_TARGET' }), code: 'OWNER_PACKET_TARGET_MISMATCH' },
    { packet: ownerPacket({ bindingBaseSha: 'wrong-sha' }), code: 'OWNER_PACKET_BINDING_MISMATCH' },
    { packet: ownerPacket({ ownerApprovedOpenNextContour: false }), code: 'OWNER_NEXT_CONTOUR_POLICY_MISSING' },
    { packet: ownerPacket({ ownerUnderstandsAdmissionOnly: false }), code: 'OWNER_NEXT_CONTOUR_POLICY_MISSING' },
    { packet: ownerPacket({ ownerPacketAuthorizesOnlyNextContourOpening: false }), code: 'OWNER_NEXT_CONTOUR_POLICY_MISSING' },
    { packet: ownerPacket({ publicRuntimeAdmitted: true }), code: 'PRODUCT_RUNTIME_FORBIDDEN' },
    { packet: ownerPacket({ productApplyRuntimeAdmitted: true }), code: 'PRODUCT_RUNTIME_FORBIDDEN' },
    { packet: ownerPacket({ publicAdapterImplementationAdmitted: true }), code: 'PUBLIC_ADAPTER_IMPLEMENTATION_FORBIDDEN' },
    { packet: ownerPacket({ runtimeWiringAdmitted: true }), code: 'RUNTIME_WIRING_FORBIDDEN' },
    { packet: ownerPacket({ applyExecutionRequested: true }), code: 'APPLY_EXECUTION_FORBIDDEN' },
    { packet: ownerPacket({ applyExecutionImplemented: true }), code: 'APPLY_EXECUTION_FORBIDDEN' },
    { packet: ownerPacket({ commandSurfaceClaimed: true }), code: 'PUBLIC_COMMAND_SURFACE_FORBIDDEN' },
    { packet: ownerPacket({ uiChanged: true }), code: 'UI_DOCX_NETWORK_DEPENDENCY_FORBIDDEN' },
    { packet: ownerPacket({ docxImportClaimed: true }), code: 'UI_DOCX_NETWORK_DEPENDENCY_FORBIDDEN' },
    { packet: ownerPacket({ networkUsed: true }), code: 'UI_DOCX_NETWORK_DEPENDENCY_FORBIDDEN' },
    { packet: ownerPacket({ dependencyChanged: true }), code: 'UI_DOCX_NETWORK_DEPENDENCY_FORBIDDEN' },
    { packet: ownerPacket({ applyTxnImplemented: true }), code: 'APPLYTXN_RECOVERY_RELEASE_FORBIDDEN' },
    { packet: ownerPacket({ recoveryClaimed: true }), code: 'APPLYTXN_RECOVERY_RELEASE_FORBIDDEN' },
    { packet: ownerPacket({ startupRecoveryClaimed: true }), code: 'APPLYTXN_RECOVERY_RELEASE_FORBIDDEN' },
    { packet: ownerPacket({ releaseClaimed: true }), code: 'APPLYTXN_RECOVERY_RELEASE_FORBIDDEN' },
    { packet: ownerPacket({ userProjectMutated: true }), code: 'USER_PROJECT_MUTATION_FORBIDDEN' },
    { packet: ownerPacket({ realUserProjectPathTouched: true }), code: 'USER_PROJECT_MUTATION_FORBIDDEN' },
  ];

  for (const item of cases) {
    const result = runExactTextApplyWithReceiptNextAdmission({
      ...base,
      ownerAdmissionPacket001Y: item.packet,
    });
    assert.equal(result.ownerMayOpen001Z, false);
    assert.equal(result.blockedReasons.includes(EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_ADMISSION_REASON_CODES[item.code]), true, item.code);
  }
});

test('001Y blocks direct runtime adapter execution UI DOCX ApplyTxn recovery release and mutation claims', async () => {
  const { runExactTextApplyWithReceiptNextAdmission, EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_ADMISSION_REASON_CODES } = await loadModule();
  const base = await acceptedInput();
  const cases = [
    { patch: { publicRuntimeAdmitted: true }, code: 'PRODUCT_RUNTIME_FORBIDDEN' },
    { patch: { productApplyRuntimeAdmitted: true }, code: 'PRODUCT_RUNTIME_FORBIDDEN' },
    { patch: { publicAdapterImplementationAdmitted: true }, code: 'PUBLIC_ADAPTER_IMPLEMENTATION_FORBIDDEN' },
    { patch: { runtimeWiringAdmitted: true }, code: 'RUNTIME_WIRING_FORBIDDEN' },
    { patch: { applyExecutionRequested: true }, code: 'APPLY_EXECUTION_FORBIDDEN' },
    { patch: { applyExecutionImplemented: true }, code: 'APPLY_EXECUTION_FORBIDDEN' },
    { patch: { privateExactTextApplyWithReceiptExecuted: true }, code: 'APPLY_EXECUTION_FORBIDDEN' },
    { patch: { publicSurfaceClaimed: true }, code: 'PUBLIC_COMMAND_SURFACE_FORBIDDEN' },
    { patch: { ipcSurfaceClaimed: true }, code: 'PUBLIC_COMMAND_SURFACE_FORBIDDEN' },
    { patch: { preloadExportClaimed: true }, code: 'PUBLIC_COMMAND_SURFACE_FORBIDDEN' },
    { patch: { menuSurfaceClaimed: true }, code: 'PUBLIC_COMMAND_SURFACE_FORBIDDEN' },
    { patch: { commandSurfaceClaimed: true }, code: 'PUBLIC_COMMAND_SURFACE_FORBIDDEN' },
    { patch: { uiChanged: true }, code: 'UI_DOCX_NETWORK_DEPENDENCY_FORBIDDEN' },
    { patch: { docxImportClaimed: true }, code: 'UI_DOCX_NETWORK_DEPENDENCY_FORBIDDEN' },
    { patch: { networkUsed: true }, code: 'UI_DOCX_NETWORK_DEPENDENCY_FORBIDDEN' },
    { patch: { dependencyChanged: true }, code: 'UI_DOCX_NETWORK_DEPENDENCY_FORBIDDEN' },
    { patch: { applyTxnImplemented: true }, code: 'APPLYTXN_RECOVERY_RELEASE_FORBIDDEN' },
    { patch: { recoveryClaimed: true }, code: 'APPLYTXN_RECOVERY_RELEASE_FORBIDDEN' },
    { patch: { startupRecoveryClaimed: true }, code: 'APPLYTXN_RECOVERY_RELEASE_FORBIDDEN' },
    { patch: { releaseClaimed: true }, code: 'APPLYTXN_RECOVERY_RELEASE_FORBIDDEN' },
    { patch: { userProjectMutated: true }, code: 'USER_PROJECT_MUTATION_FORBIDDEN' },
    { patch: { realUserProjectPathTouched: true }, code: 'USER_PROJECT_MUTATION_FORBIDDEN' },
  ];

  for (const item of cases) {
    const result = runExactTextApplyWithReceiptNextAdmission({ ...base, ...item.patch });
    assert.equal(result.ownerMayOpen001Z, false);
    assert.equal(result.blockedReasons.includes(EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_ADMISSION_REASON_CODES[item.code]), true, item.code);
  }
});

test('001Y cannot green next contour opening when source proof is invalid', async () => {
  const { runExactTextApplyWithReceiptNextAdmission } = await loadModule();
  const { canonicalHash } = await loadKernel();
  const badSource = accepted001XResult(canonicalHash, undefined, { source001WReceiptHash: '' });
  const result = runExactTextApplyWithReceiptNextAdmission({
    source001XResult: badSource,
    source001XResultHash: badSource.canonicalHash,
    source001XDecisionHash: badSource.decisions[0].canonicalHash,
    ownerAdmissionPacket001Y: ownerPacket(),
  });

  assert.equal(result.outputDecision, 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_ADMISSION_001Y_BLOCKED');
  assert.equal(result.ownerMayOpen001Z, false);
  assert.equal(result.nextContourRecommendation, null);
});

test('001Y task record preserves admission only boundary', () => {
  const taskText = sourceText('docs', 'tasks', TASK_BASENAME);
  assert.match(taskText, /TASK_ID: PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_ADMISSION_001Y/u);
  assert.match(taskText, /CONTOUR_TYPE: ADMISSION_ONLY/u);
  assert.match(taskText, /PREVIOUS_CONTOUR: PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_CLOSEOUT_001X/u);
  assert.match(taskText, /NEXT_CONTOUR_RECOMMENDATION_ONLY: PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_ADAPTER_ADMISSION_001Z/u);
  assert.match(taskText, /PUBLIC_RUNTIME_ADMITTED: false/u);
  assert.match(taskText, /PUBLIC_ADAPTER_IMPLEMENTATION_ADMITTED: false/u);
  assert.match(taskText, /RUNTIME_WIRING_ADMITTED: false/u);
  assert.match(taskText, /APPLYTXN_IMPLEMENTED: false/u);
  assert.match(taskText, /RECOVERY_CLAIMED: false/u);
  assert.match(taskText, /STATUS: DONE/u);
  assert.match(taskText, /COMMIT_SHA: a5ae54945ce689029f71a21c7fd40120cc0eb187/u);
  assert.match(taskText, /PUSH_RESULT: pushed/u);
  assert.doesNotMatch(taskText, /release green|public apply|DOCX runtime|ApplyTxn implemented|recovery proven/iu);
});

test('001Y changed scope stays allowlisted and next admission module stays pure', () => {
  const changedPaths = [
    ...gitLines(['diff', '--name-only', 'HEAD']),
    ...gitLines(['diff', '--cached', '--name-only']),
    ...gitLines(['ls-files', '--others', '--exclude-standard']),
  ].sort();
  const changedBasenames = changedBasenamesForCurrentContour();
  const allowedPaths = new Set([
    'docs/tasks/PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_CLOSEOUT_001X.md',
    'docs/tasks/PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_ADMISSION_001Y.md',
    'docs/tasks/PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_CONTOUR_ADMISSION_001Z.md',
    'docs/tasks/PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_BRIEF_002A.md',
    'scripts/ops/revision-bridge-pre-stage-00-admission-guard-state.mjs',
    'src/revisionBridge/exactTextApplyWithReceiptNextAdmission.mjs',
    'src/revisionBridge/exactTextApplyWithReceiptNextContourAdmission.mjs',
    'src/revisionBridge/exactTextApplyWithReceiptPrivateContractBrief.mjs',
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
  ]);
  const allowlist = new Set([
    MODULE_BASENAME,
    'exactTextApplyWithReceiptNextContourAdmission.mjs',
    'exactTextApplyWithReceiptPrivateContractBrief.mjs',
    'exactTextApplyWithReceiptNextAdmission.contract.test.js',
    'exactTextApplyWithReceiptNextContourAdmission.contract.test.js',
    'exactTextApplyWithReceiptPrivateContractBrief.contract.test.js',
    TASK_BASENAME,
    'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_CONTOUR_ADMISSION_001Z.md',
    'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_BRIEF_002A.md',
    'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_CLOSEOUT_001X.md',
    'revision-bridge-pre-stage-00-admission-guard-state.mjs',
    'exactTextApplyWithReceiptCloseout.contract.test.js',
    'exactTextApplyWithReceiptExecution.contract.test.js',
    'exactTextApplyWithReceiptAdmission.contract.test.js',
    'exactTextApplyPrivateProductApplyReceipt.contract.test.js',
    'exactTextApplyPrivateProductApplyReceiptAdmission.contract.test.js',
    'exactTextApplyFixtureDurableReceiptPrototype.contract.test.js',
    'exactTextApplyInternalWritePrototype.contract.test.js',
    'exactTextApplyProductApplyAdmissionGate.contract.test.js',
    'exactTextApplyProductApplyReadinessReview.contract.test.js',
    'exactTextApplyProductStoragePrimitiveEvidence.contract.test.js',
    'exactTextApplyTestFixtureReceiptFile.contract.test.js',
    'exactTextApplyTestOnlyProductShapedStorageDryRun.contract.test.js',
    'exactTextApplyTestOnlyStoragePrimitiveExecutionHarness.contract.test.js',
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
  assert.notDeepEqual(changedBasenames, [], '001Y must have detectable changed scope');
  for (const changedPath of changedPaths) {
    assert.equal(allowedPaths.has(changedPath), true, `unexpected 001Y changed path: ${changedPath}`);
  }
  for (const basename of changedBasenames) {
    assert.equal(allowlist.has(basename), true, `unexpected 001Y changed basename: ${basename}`);
    assert.equal(denylist.has(basename), false, `denylisted 001Y changed basename: ${basename}`);
  }

  const moduleText = sourceText('src', 'revisionBridge', MODULE_BASENAME);
  const forbiddenPatterns = [
    /from\s+['"]node:fs/u,
    /from\s+['"]node:path/u,
    /from\s+['"]node:os/u,
    /from\s+['"][^'"]*backupManager[^'"]*['"]/u,
    /from\s+['"][^'"]*fileManager[^'"]*['"]/u,
    /from\s+['"]electron['"]/u,
    /require\s*\(\s*['"]electron['"]\s*\)/u,
    /from\s+['"][^'"]*(?:main|preload|editor|command-catalog|projectCommands)[^'"]*['"]/u,
  ];
  for (const pattern of forbiddenPatterns) {
    assert.equal(pattern.test(moduleText), false, `forbidden 001Y import pattern: ${pattern.source}`);
  }
});

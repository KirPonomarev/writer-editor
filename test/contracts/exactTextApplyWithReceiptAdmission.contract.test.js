const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const MODULE_BASENAME = 'exactTextApplyWithReceiptAdmission.mjs';
const SOURCE_001U_MODULE_BASENAME = 'exactTextApplyPrivateProductApplyReceipt.mjs';
const SOURCE_001T_MODULE_BASENAME = 'exactTextApplyPrivateProductApplyReceiptAdmission.mjs';
const SOURCE_001S_MODULE_BASENAME = 'exactTextApplyFixtureDurableReceiptPrototype.mjs';
const SOURCE_001R_MODULE_BASENAME = 'exactTextApplyInternalWritePrototype.mjs';
const KERNEL_BASENAME = 'reviewIrKernel.mjs';
const TASK_BASENAME = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_001V.md';

async function loadModule() {
  return import(pathToFileURL(path.join(process.cwd(), 'src', 'revisionBridge', MODULE_BASENAME)).href);
}

async function load001UModule() {
  return import(pathToFileURL(path.join(process.cwd(), 'src', 'revisionBridge', SOURCE_001U_MODULE_BASENAME)).href);
}

async function load001TModule() {
  return import(pathToFileURL(path.join(process.cwd(), 'src', 'revisionBridge', SOURCE_001T_MODULE_BASENAME)).href);
}

async function load001SModule() {
  return import(pathToFileURL(path.join(process.cwd(), 'src', 'revisionBridge', SOURCE_001S_MODULE_BASENAME)).href);
}

async function load001RModule() {
  return import(pathToFileURL(path.join(process.cwd(), 'src', 'revisionBridge', SOURCE_001R_MODULE_BASENAME)).href);
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

function sceneTextHash(canonicalHash, text) {
  return canonicalHash({ hashKind: 'EXACT_TEXT_INTERNAL_WRITE_SCENE_TEXT_HASH_V1', text });
}

function accepted001QResult(canonicalHash) {
  const decisionCore = {
    productApplyAdmissionGateDecisionKind: 'EXACT_TEXT_PRODUCT_APPLY_ADMISSION_GATE_DECISION',
    outputDecision: 'OWNER_MAY_OPEN_EXACT_TEXT_PRODUCT_WRITE_IMPLEMENTATION_001R',
    nextContourAfterPass: 'EXACT_TEXT_APPLY_PRODUCT_WRITE_IMPLEMENTATION_001R',
    productWriteImplementationAllowedIn001Q: false,
    productWritePerformed: false,
    productWriteClaimed: false,
    publicSurfaceClaimed: false,
    applyReceiptImplemented: false,
    applyTxnClaimed: false,
  };
  const decision = withCanonicalHash(canonicalHash, decisionCore);
  const resultCore = {
    resultKind: 'EXACT_TEXT_PRODUCT_APPLY_ADMISSION_GATE_RESULT',
    productApplyAdmissionPlanningGateCompleted: true,
    productApplyAdmissionToOpen001RAllowed: true,
    outputDecision: 'OWNER_MAY_OPEN_EXACT_TEXT_PRODUCT_WRITE_IMPLEMENTATION_001R',
    nextContourAfterPass: 'EXACT_TEXT_APPLY_PRODUCT_WRITE_IMPLEMENTATION_001R',
    productWriteImplementationAllowedIn001Q: false,
    productWritePerformed: false,
    productWriteClaimed: false,
    publicSurfaceClaimed: false,
    durableReceiptClaimed: false,
    applyReceiptImplemented: false,
    applyTxnClaimed: false,
    blockedReasons: [],
    productApplyAdmissionGateDecisions: [decision],
  };
  return withCanonicalHash(canonicalHash, resultCore);
}

function base001RInput(canonicalHash, fixtureProjectRoot, storagePorts) {
  const exactBeforeText = 'before exact text';
  const exactAfterText = 'after exact text';
  const blockVersionHash = canonicalHash({ block: 'scene-001-block-version-v1' });
  const admission = accepted001QResult(canonicalHash);
  return {
    productApplyAdmissionGateResult001Q: admission,
    source001QDecisionHash: admission.productApplyAdmissionGateDecisions[0].canonicalHash,
    sourceApplyOpHash: canonicalHash({ source: '001r-apply-op' }),
    sourceEffectPreviewHash: canonicalHash({ source: '001r-effect-preview' }),
    fixtureProjectRoot,
    osTempFixtureRootOnly: true,
    fixtureProjectRootInsideTempRoot: true,
    fixtureProjectRootIsProductRoot: false,
    userProjectPathAllowedIn001R: false,
    internalFixtureWritePrototypeAllowedIn001R: true,
    userProjectRootAccess: false,
    productRootAccess: false,
    repoRootAccess: false,
    projectId: 'fixture-project-001',
    expectedProjectId: 'fixture-project-001',
    sceneId: 'scene-001',
    expectedSceneId: 'scene-001',
    sceneFileBasename: 'scene-001.txt',
    exactBeforeText,
    exactAfterText,
    expectedBaselineHash: sceneTextHash(canonicalHash, exactBeforeText),
    expectedAfterSceneHash: sceneTextHash(canonicalHash, exactAfterText),
    currentBlockVersionHash: blockVersionHash,
    expectedBlockVersionHash: blockVersionHash,
    sessionOpen: true,
    operationKind: 'EXACT_TEXT_REPLACE',
    singleSceneScope: true,
    lowRiskExactTextOnly: true,
    commentApplyClaimed: false,
    commentOperation: false,
    structuralApplyClaimed: false,
    structuralOperation: false,
    multiSceneApplyClaimed: false,
    storagePorts,
  };
}

function base001SInput(source001RResult, fixtureProjectRoot, storagePorts, overrides = {}) {
  return {
    source001RResult,
    source001RResultHash: source001RResult.canonicalHash,
    source001RDecisionHash: source001RResult.decisions[0].canonicalHash,
    source001RReceiptDraftHash: source001RResult.receiptDraft.canonicalHash,
    fixtureProjectRoot,
    osTempFixtureRootOnly: true,
    fixtureProjectRootInsideTempRoot: true,
    fixtureProjectRootIsProductRoot: false,
    userProjectPathAllowedIn001S: false,
    fixtureDurableReceiptAllowedIn001S: true,
    userProjectRootAccess: false,
    productRootAccess: false,
    repoRootAccess: false,
    receiptMode: 'SUCCESS',
    receiptFileBasename: 'receipt-001s.json',
    receiptWrittenAt: '2026-05-01T00:00:00.000Z',
    storagePorts,
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
    ...overrides,
  };
}

async function withFixture(callback) {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'exact-text-001v-'));
  try {
    await fsp.writeFile(path.join(root, 'scene-001.txt'), 'before exact text', 'utf8');
    return await callback(root);
  } finally {
    await fsp.rm(root, { recursive: true, force: true });
  }
}

async function withElectronDocumentsStub(documentsPath, callback) {
  const originalLoad = Module._load;
  const fileManagerPath = path.join(process.cwd(), 'src', 'utils', 'fileManager.js');
  const backupManagerPath = path.join(process.cwd(), 'src', 'utils', 'backupManager.js');
  delete require.cache[require.resolve(fileManagerPath)];
  delete require.cache[require.resolve(backupManagerPath)];
  Module._load = function load(request, parent, isMain) {
    if (request === 'electron') {
      return { app: { getPath: () => documentsPath } };
    }
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    const fileManager = require(fileManagerPath);
    const backupManager = require(backupManagerPath);
    return await callback({ fileManager, backupManager });
  } finally {
    Module._load = originalLoad;
    delete require.cache[require.resolve(fileManagerPath)];
    delete require.cache[require.resolve(backupManagerPath)];
  }
}

async function accepted001RResult(root, fileManager, backupManager) {
  const { canonicalHash } = await loadKernel();
  const { runExactTextApplyInternalWritePrototype } = await load001RModule();
  return runExactTextApplyInternalWritePrototype(base001RInput(canonicalHash, root, {
    createBackup: (...args) => backupManager.createBackup(...args),
    writeFileAtomic: (...args) => fileManager.writeFileAtomic(...args),
  }));
}

function privateWriteObservation(source001RResult) {
  return {
    projectId: source001RResult.receiptDraft.projectId,
    sceneId: source001RResult.receiptDraft.sceneId,
    operationKind: 'EXACT_TEXT_REPLACE',
    exactTextOnly: true,
    singleSceneOnly: true,
    beforeSceneHash: source001RResult.receiptDraft.beforeSceneHash,
    afterSceneHash: source001RResult.receiptDraft.afterSceneHash,
    blockVersionHash: 'fixture-block-version-hash-001v',
    backupObservationHash: source001RResult.receiptDraft.backupObservationHash,
    atomicWriteObservationHash: source001RResult.receiptDraft.atomicWriteObservationHash,
  };
}

async function build001UEvidence() {
  const { runExactTextApplyFixtureDurableReceiptPrototype } = await load001SModule();
  const { runExactTextApplyPrivateProductApplyReceiptAdmission } = await load001TModule();
  const { runExactTextApplyPrivateProductApplyReceipt } = await load001UModule();
  return withFixture(async (root) => withElectronDocumentsStub(root, async ({ fileManager, backupManager }) => {
    const source001RResult = await accepted001RResult(root, fileManager, backupManager);
    const success = await runExactTextApplyFixtureDurableReceiptPrototype(base001SInput(
      source001RResult,
      root,
      { writeFileAtomic: (...args) => fileManager.writeFileAtomic(...args) },
    ));
    const failure = await runExactTextApplyFixtureDurableReceiptPrototype(base001SInput(
      source001RResult,
      root,
      { writeFileAtomic: (...args) => fileManager.writeFileAtomic(...args) },
      {
        receiptMode: 'FAILURE',
        receiptFileBasename: 'failure-receipt-001s.json',
        failureReasonCode: 'SIMULATED_FIXTURE_FAILURE',
        blockedReasons: ['SIMULATED_FIXTURE_FAILURE'],
        writeAttempted: false,
      },
    ));
    const accepted001T = runExactTextApplyPrivateProductApplyReceiptAdmission({
      source001SSuccessResult: success,
      source001SFailureResult: failure,
      source001SSuccessResultHash: success.canonicalHash,
      source001SFailureResultHash: failure.canonicalHash,
      source001SSuccessDecisionHash: success.decisions[0].canonicalHash,
      source001SFailureDecisionHash: failure.decisions[0].canonicalHash,
      source001SSuccessReceiptHash: success.receipt.receiptCanonicalHash,
      source001SFailureReceiptHash: failure.receipt.receiptCanonicalHash,
      ownerPacket: {
        packetKind: 'PRIVATE_PRODUCT_APPLY_RECEIPT_ADMISSION_OWNER_PACKET_001T',
        ownerApprovedOpeningPrivateProductApplyReceiptImplementation: true,
        ownerApprovedExactTextOnly: true,
        ownerApprovedSingleSceneOnly: true,
        ownerApprovedPrivateOnly: true,
        ownerUnderstandsNoPublicSurface: true,
        ownerUnderstandsNoUserProjectWriteIn001T: true,
        ownerUnderstandsNextContourRequiredForImplementation: true,
        ownerPacketNotSufficientWithout001SMachineProof: true,
        fixtureReceiptEvidenceIsNotProductReceiptProof: true,
        source001SSuccessResultHash: success.canonicalHash,
        source001SFailureResultHash: failure.canonicalHash,
      },
    });
    const accepted001U = await runExactTextApplyPrivateProductApplyReceipt({
      source001TResult: accepted001T,
      source001TResultHash: accepted001T.canonicalHash,
      source001TDecisionHash: accepted001T.decisions[0].canonicalHash,
      privateWriteObservation: privateWriteObservation(source001RResult),
      receiptFileTarget: path.join(root, 'private-product-apply-receipt-001u.json'),
      receiptWrittenAt: '2026-05-01T00:00:00.000Z',
      storagePorts: {
        writeFileAtomic: async (target, text) => {
          await fsp.mkdir(path.dirname(target), { recursive: true });
          await fsp.writeFile(target, text, 'utf8');
          return { success: true };
        },
        readFile: (target) => fsp.readFile(target, 'utf8'),
      },
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
    return { accepted001U };
  }));
}

function ownerPacket(source001UResult, overrides = {}) {
  return {
    packetKind: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_OWNER_PACKET_001V',
    ownerApprovedOpeningPrivateExactTextApplyWithReceiptExecution001W: true,
    ownerApprovedExactTextOnly: true,
    ownerApprovedSingleSceneOnly: true,
    ownerApprovedPrivateOnly: true,
    ownerUnderstands001VIsAdmissionOnly: true,
    ownerUnderstandsNoPublicSurface: true,
    ownerUnderstandsNoUserProjectMutationIn001V: true,
    ownerUnderstands001WStillPrivateExecutionOnly: true,
    ownerUnderstandsNoApplyTxnRecoveryUiDocx: true,
    ownerPacketNotSufficientWithout001UMachineProof: true,
    source001UResultHash: source001UResult.canonicalHash,
    source001UDecisionHash: source001UResult.decisions[0].canonicalHash,
    source001UReceiptHash: source001UResult.receipt.receiptCanonicalHash,
    ...overrides,
  };
}

function admissionInput(source001UResult, overrides = {}) {
  return {
    source001UResult,
    source001UResultHash: source001UResult.canonicalHash,
    source001UDecisionHash: source001UResult.decisions[0].canonicalHash,
    source001UReceiptHash: source001UResult.receipt.receiptCanonicalHash,
    ownerPacket: ownerPacket(source001UResult),
    applyExecutionImplemented: false,
    userProjectMutated: false,
    publicRuntimeAdmitted: false,
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
    ...overrides,
  };
}

function rehashResult(canonicalHash, result, patch) {
  return withCanonicalHash(canonicalHash, {
    ...withoutHash(result),
    ...patch,
  });
}

test('001V admits opening 001W from valid 001U proof without execution effects', async () => {
  const { runExactTextApplyWithReceiptAdmission } = await loadModule();
  const { accepted001U } = await build001UEvidence();
  const result = runExactTextApplyWithReceiptAdmission(admissionInput(accepted001U));
  assert.equal(result.outputDecision, 'OWNER_MAY_OPEN_PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_001W_NO_PUBLIC_RUNTIME');
  assert.equal(result.nextContourAfterPass, 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_001W');
  assert.equal(result.ownerMayOpen001W, true);
  assert.equal(result.exactTextApplyWithReceiptAdmissionOnly, true);
  assert.equal(result.privateExecutionNextContourOnly, true);
  assert.equal(result.admissionDoesNotImplementApplyExecution, true);
  assert.equal(result.admissionDoesNotMutateUserProject, true);
  assert.equal(result.admissionDoesNotAuthorizePublicRuntime, true);
  assert.equal(result.zeroApplyExecutionEffects, true);
  assert.deepEqual(result.applyExecutionEffects, []);
  assert.equal(result.applyExecutionImplemented, false);
  assert.equal(result.userProjectMutated, false);
  assert.equal(result.publicRuntimeAdmitted, false);
  assert.equal(result.applyTxnImplemented, false);
  assert.equal(result.recoveryClaimed, false);
  assert.deepEqual(result.blockedReasons, []);
});

test('001V blocks missing mismatched blocked and receipt-tampered 001U proof', async () => {
  const { canonicalHash } = await loadKernel();
  const { runExactTextApplyWithReceiptAdmission, EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_REASON_CODES } = await loadModule();
  const { accepted001U } = await build001UEvidence();

  assert.equal(runExactTextApplyWithReceiptAdmission(admissionInput(accepted001U, {
    source001UResult: null,
  })).blockedReasons.includes(EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_REASON_CODES.SOURCE_001U_RESULT_REQUIRED), true);
  assert.equal(runExactTextApplyWithReceiptAdmission(admissionInput(accepted001U, {
    source001UResultHash: 'wrong-result-hash',
  })).blockedReasons.includes(EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_REASON_CODES.SOURCE_001U_RESULT_MISMATCH), true);
  assert.equal(runExactTextApplyWithReceiptAdmission(admissionInput(accepted001U, {
    source001UDecisionHash: 'wrong-decision-hash',
  })).blockedReasons.includes(EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_REASON_CODES.SOURCE_001U_DECISION_MISMATCH), true);
  assert.equal(runExactTextApplyWithReceiptAdmission(admissionInput(accepted001U, {
    source001UReceiptHash: 'wrong-receipt-hash',
  })).blockedReasons.includes(EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_REASON_CODES.SOURCE_001U_RECEIPT_MISMATCH), true);

  const blocked001U = rehashResult(canonicalHash, accepted001U, {
    outputDecision: 'PRIVATE_PRODUCT_APPLYRECEIPT_IMPLEMENTATION_BLOCKED',
    blockedReasons: ['SIMULATED_BLOCK'],
    decisions: [],
    receipt: null,
  });
  assert.equal(runExactTextApplyWithReceiptAdmission(admissionInput(accepted001U, {
    source001UResult: blocked001U,
    source001UResultHash: blocked001U.canonicalHash,
    source001UDecisionHash: '',
    source001UReceiptHash: '',
    ownerPacket: ownerPacket(accepted001U),
  })).blockedReasons.includes(EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_REASON_CODES.SOURCE_001U_BLOCKED), true);

  const tamperedReceipt = {
    ...accepted001U.receipt,
    receiptCanonicalHash: accepted001U.receipt.receiptCanonicalHash,
    afterSceneHash: 'tampered-after-hash',
  };
  const tampered001U = rehashResult(canonicalHash, accepted001U, { receipt: tamperedReceipt });
  assert.equal(runExactTextApplyWithReceiptAdmission(admissionInput(accepted001U, {
    source001UResult: tampered001U,
    source001UResultHash: tampered001U.canonicalHash,
    ownerPacket: ownerPacket(tampered001U),
  })).blockedReasons.includes(EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_REASON_CODES.SOURCE_001U_RECEIPT_MISMATCH), true);
});

test('001V blocks 001U runtime flags and missing receipt boundary flags', async () => {
  const { canonicalHash } = await loadKernel();
  const { runExactTextApplyWithReceiptAdmission, EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_REASON_CODES } = await loadModule();
  const { accepted001U } = await build001UEvidence();
  for (const contamination of [
    { productApplyRuntimeAdmitted: true },
    { publicSurfaceClaimed: true },
    { ipcSurfaceClaimed: true },
    { menuSurfaceClaimed: true },
    { commandSurfaceClaimed: true },
    { preloadExportClaimed: true },
    { applyTxnImplemented: true },
    { recoveryClaimed: true },
    { multiSceneApplyClaimed: true },
    { structuralApplyClaimed: true },
    { commentApplyClaimed: true },
    { networkUsed: true },
    { dependencyChanged: true },
  ]) {
    const contaminated = rehashResult(canonicalHash, accepted001U, contamination);
    const result = runExactTextApplyWithReceiptAdmission(admissionInput(accepted001U, {
      source001UResult: contaminated,
      source001UResultHash: contaminated.canonicalHash,
      ownerPacket: ownerPacket(contaminated),
    }));
    assert.equal(result.blockedReasons.includes(EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_REASON_CODES.SOURCE_001U_RUNTIME_FLAG_FORBIDDEN), true);
  }

  const missingBoundary = rehashResult(canonicalHash, accepted001U, {
    receiptWriteIsNotApplyTxn: false,
  });
  assert.equal(runExactTextApplyWithReceiptAdmission(admissionInput(accepted001U, {
    source001UResult: missingBoundary,
    source001UResultHash: missingBoundary.canonicalHash,
    ownerPacket: ownerPacket(missingBoundary),
  })).blockedReasons.includes(EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_REASON_CODES.SOURCE_001U_RECEIPT_BOUNDARY_MISSING), true);

  const missingReadbackBoundary = rehashResult(canonicalHash, accepted001U, {
    receiptReadbackIsNotRecovery: false,
  });
  assert.equal(runExactTextApplyWithReceiptAdmission(admissionInput(accepted001U, {
    source001UResult: missingReadbackBoundary,
    source001UResultHash: missingReadbackBoundary.canonicalHash,
    ownerPacket: ownerPacket(missingReadbackBoundary),
  })).blockedReasons.includes(EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_REASON_CODES.SOURCE_001U_RECEIPT_BOUNDARY_MISSING), true);

  const missingPrivateBoundary = rehashResult(canonicalHash, accepted001U, {
    privateFunctionOnlyNoPublicSurface: false,
  });
  assert.equal(runExactTextApplyWithReceiptAdmission(admissionInput(accepted001U, {
    source001UResult: missingPrivateBoundary,
    source001UResultHash: missingPrivateBoundary.canonicalHash,
    ownerPacket: ownerPacket(missingPrivateBoundary),
  })).blockedReasons.includes(EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_REASON_CODES.SOURCE_001U_RECEIPT_BOUNDARY_MISSING), true);

  const missingReceiptBoundary = rehashResult(canonicalHash, accepted001U, {
    receipt: {
      ...accepted001U.receipt,
      receiptWriteIsNotApplyTxn: false,
      receiptCanonicalHash: canonicalHash(withoutHash({ ...accepted001U.receipt, receiptWriteIsNotApplyTxn: false }, 'receiptCanonicalHash')),
    },
  });
  assert.equal(runExactTextApplyWithReceiptAdmission(admissionInput(accepted001U, {
    source001UResult: missingReceiptBoundary,
    source001UResultHash: missingReceiptBoundary.canonicalHash,
    source001UReceiptHash: missingReceiptBoundary.receipt.receiptCanonicalHash,
    ownerPacket: ownerPacket(missingReceiptBoundary),
  })).blockedReasons.includes(EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_REASON_CODES.SOURCE_001U_RECEIPT_BOUNDARY_MISSING), true);
});

test('001V owner packet is required and cannot override bad 001U hash or authorize forbidden layers', async () => {
  const { runExactTextApplyWithReceiptAdmission, EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_REASON_CODES } = await loadModule();
  const { accepted001U } = await build001UEvidence();
  assert.equal(runExactTextApplyWithReceiptAdmission(admissionInput(accepted001U, {
    ownerPacket: null,
  })).blockedReasons.includes(EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_REASON_CODES.OWNER_PACKET_REQUIRED), true);
  assert.equal(runExactTextApplyWithReceiptAdmission(admissionInput(accepted001U, {
    ownerPacket: ownerPacket(accepted001U, { ownerApprovedOpeningPrivateExactTextApplyWithReceiptExecution001W: false }),
  })).blockedReasons.includes(EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_REASON_CODES.OWNER_PACKET_INVALID), true);
  assert.equal(runExactTextApplyWithReceiptAdmission(admissionInput(accepted001U, {
    source001UResultHash: 'wrong-hash',
    ownerPacket: ownerPacket(accepted001U, { source001UResultHash: 'wrong-hash' }),
  })).blockedReasons.includes(EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_REASON_CODES.SOURCE_001U_RESULT_MISMATCH), true);
  assert.equal(runExactTextApplyWithReceiptAdmission(admissionInput(accepted001U, {
    ownerPacket: ownerPacket(accepted001U, { source001UReceiptHash: 'wrong-owner-receipt-hash' }),
  })).blockedReasons.includes(EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_REASON_CODES.OWNER_PACKET_SOURCE_BINDING_MISMATCH), true);
  for (const item of [
    { patch: { ownerApprovedPublicRuntime: true }, code: EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_REASON_CODES.OWNER_PUBLIC_RUNTIME_FORBIDDEN },
    { patch: { ownerApprovedApplyTxn: true }, code: EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_REASON_CODES.OWNER_APPLYTXN_RECOVERY_FORBIDDEN },
    { patch: { ownerApprovedRecovery: true }, code: EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_REASON_CODES.OWNER_APPLYTXN_RECOVERY_FORBIDDEN },
    { patch: { ownerApprovedUiChange: true }, code: EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_REASON_CODES.OWNER_UI_DOCX_FORBIDDEN },
    { patch: { ownerApprovedDocxRuntime: true }, code: EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_REASON_CODES.OWNER_UI_DOCX_FORBIDDEN },
    { patch: { ownerApprovedMultiSceneApply: true }, code: EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_REASON_CODES.OWNER_UNSUPPORTED_SCOPE_FORBIDDEN },
    { patch: { ownerApprovedStructuralApply: true }, code: EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_REASON_CODES.OWNER_UNSUPPORTED_SCOPE_FORBIDDEN },
    { patch: { ownerApprovedCommentApply: true }, code: EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_REASON_CODES.OWNER_UNSUPPORTED_SCOPE_FORBIDDEN },
  ]) {
    const result = runExactTextApplyWithReceiptAdmission(admissionInput(accepted001U, {
      ownerPacket: ownerPacket(accepted001U, item.patch),
    }));
    assert.equal(result.blockedReasons.includes(item.code), true);
  }
});

test('001V blocks direct apply execution public command UI DOCX network dependency requests', async () => {
  const { runExactTextApplyWithReceiptAdmission, EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_REASON_CODES } = await loadModule();
  const { accepted001U } = await build001UEvidence();
  for (const item of [
    { patch: { applyExecutionRequested: true }, code: EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_REASON_CODES.APPLY_EXECUTION_REQUEST_FORBIDDEN },
    { patch: { applyExecutionImplemented: true }, code: EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_REASON_CODES.APPLY_EXECUTION_REQUEST_FORBIDDEN },
    { patch: { userProjectMutated: true }, code: EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_REASON_CODES.APPLY_EXECUTION_REQUEST_FORBIDDEN },
    { patch: { publicSurfaceClaimed: true }, code: EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_REASON_CODES.PUBLIC_COMMAND_SURFACE_FORBIDDEN },
    { patch: { ipcSurfaceClaimed: true }, code: EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_REASON_CODES.PUBLIC_COMMAND_SURFACE_FORBIDDEN },
    { patch: { preloadExportClaimed: true }, code: EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_REASON_CODES.PUBLIC_COMMAND_SURFACE_FORBIDDEN },
    { patch: { menuSurfaceClaimed: true }, code: EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_REASON_CODES.PUBLIC_COMMAND_SURFACE_FORBIDDEN },
    { patch: { commandSurfaceClaimed: true }, code: EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_REASON_CODES.PUBLIC_COMMAND_SURFACE_FORBIDDEN },
    { patch: { uiChanged: true }, code: EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_REASON_CODES.UI_DOCX_NETWORK_DEPENDENCY_FORBIDDEN },
    { patch: { docxImportClaimed: true }, code: EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_REASON_CODES.UI_DOCX_NETWORK_DEPENDENCY_FORBIDDEN },
    { patch: { networkUsed: true }, code: EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_REASON_CODES.UI_DOCX_NETWORK_DEPENDENCY_FORBIDDEN },
    { patch: { dependencyChanged: true }, code: EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_REASON_CODES.UI_DOCX_NETWORK_DEPENDENCY_FORBIDDEN },
  ]) {
    const result = runExactTextApplyWithReceiptAdmission(admissionInput(accepted001U, item.patch));
    assert.equal(result.blockedReasons.includes(item.code), true);
  }
});

test('001V task record preserves admission only boundary', () => {
  const taskText = sourceText('docs', 'tasks', TASK_BASENAME);
  assert.match(taskText, /TASK_ID: PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_001V/u);
  assert.match(taskText, /CONTOUR_TYPE: ADMISSION_ONLY/u);
  assert.match(taskText, /CONTOUR_NOT_IMPLEMENTATION: TRUE/u);
  assert.match(taskText, /APPLY_EXECUTION_IMPLEMENTED: false/u);
  assert.match(taskText, /USER_PROJECT_MUTATED: false/u);
  assert.match(taskText, /PRIVATE_EXECUTION_NEXT_CONTOUR_ONLY: true/u);
  assert.match(taskText, /PUBLIC_RUNTIME_ADMITTED: false/u);
  assert.match(taskText, /OWNER_PACKET_NOT_SUFFICIENT_WITHOUT_001U_MACHINE_PROOF: true/u);
  assert.match(taskText, /ZERO_APPLY_EXECUTION_EFFECTS: true/u);
  assert.match(taskText, /NEXT_CONTOUR_IF_PASS: PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_001W/u);
  assert.match(taskText, /COMMIT_SHA: pending/u);
  assert.match(taskText, /PUSH_RESULT: pending/u);
  assert.match(taskText, /PR_RESULT: pending/u);
  assert.match(taskText, /MERGE_RESULT: pending/u);
  assert.doesNotMatch(taskText, /release green|public apply|DOCX runtime|ApplyTxn implemented|recovery proven/iu);
});

test('001V changed scope stays allowlisted and admission module stays pure', () => {
  const changedBasenames = changedBasenamesForCurrentContour();
  const allowlist = new Set([
    MODULE_BASENAME,
    'exactTextApplyWithReceiptAdmission.contract.test.js',
    TASK_BASENAME,
    'revision-bridge-pre-stage-00-admission-guard-state.mjs',
    'exactTextApplyPrivateProductApplyReceipt.contract.test.js',
    'exactTextApplyPrivateProductApplyReceiptAdmission.contract.test.js',
    'exactTextApplyWithReceiptExecution.mjs',
    'exactTextApplyWithReceiptCloseout.mjs',
    'exactTextApplyWithReceiptExecution.contract.test.js',
    'exactTextApplyWithReceiptCloseout.contract.test.js',
    'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_001W.md',
    'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_CLOSEOUT_001X.md',
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
  ]);
  assert.notDeepEqual(changedBasenames, [], '001V must have detectable changed scope');
  for (const basename of changedBasenames) {
    assert.equal(allowlist.has(basename), true, `unexpected 001V changed basename: ${basename}`);
    assert.equal(denylist.has(basename), false, `denylisted 001V changed basename: ${basename}`);
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
    assert.equal(pattern.test(moduleText), false, `forbidden 001V import pattern: ${pattern.source}`);
  }
});

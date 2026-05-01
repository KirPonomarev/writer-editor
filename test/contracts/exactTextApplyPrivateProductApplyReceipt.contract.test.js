const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const MODULE_BASENAME = 'exactTextApplyPrivateProductApplyReceipt.mjs';
const SOURCE_001T_MODULE_BASENAME = 'exactTextApplyPrivateProductApplyReceiptAdmission.mjs';
const SOURCE_001S_MODULE_BASENAME = 'exactTextApplyFixtureDurableReceiptPrototype.mjs';
const SOURCE_001R_MODULE_BASENAME = 'exactTextApplyInternalWritePrototype.mjs';
const KERNEL_BASENAME = 'reviewIrKernel.mjs';
const TASK_BASENAME = 'PRIVATE_PRODUCT_APPLY_RECEIPT_IMPLEMENTATION_001U.md';

async function loadModule() {
  return import(pathToFileURL(path.join(process.cwd(), 'src', 'revisionBridge', MODULE_BASENAME)).href);
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
  return canonicalHash({
    hashKind: 'EXACT_TEXT_INTERNAL_WRITE_SCENE_TEXT_HASH_V1',
    text,
  });
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
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'exact-text-001u-'));
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
      return {
        app: {
          getPath(name) {
            assert.equal(name, 'documents');
            return documentsPath;
          },
        },
      };
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

async function build001TEvidence() {
  const { runExactTextApplyFixtureDurableReceiptPrototype } = await load001SModule();
  const { runExactTextApplyPrivateProductApplyReceiptAdmission } = await load001TModule();
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
    const ownerPacket = {
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
    };
    const accepted001T = runExactTextApplyPrivateProductApplyReceiptAdmission({
      source001SSuccessResult: success,
      source001SFailureResult: failure,
      source001SSuccessResultHash: success.canonicalHash,
      source001SFailureResultHash: failure.canonicalHash,
      source001SSuccessDecisionHash: success.decisions[0].canonicalHash,
      source001SFailureDecisionHash: failure.decisions[0].canonicalHash,
      source001SSuccessReceiptHash: success.receipt.receiptCanonicalHash,
      source001SFailureReceiptHash: failure.receipt.receiptCanonicalHash,
      ownerPacket,
    });
    return { root, source001RResult, accepted001T };
  }));
}

function privateWriteObservation(source001RResult, overrides = {}) {
  return {
    projectId: source001RResult.receiptDraft.projectId,
    sceneId: source001RResult.receiptDraft.sceneId,
    operationKind: 'EXACT_TEXT_REPLACE',
    exactTextOnly: true,
    singleSceneOnly: true,
    beforeSceneHash: source001RResult.receiptDraft.beforeSceneHash,
    afterSceneHash: source001RResult.receiptDraft.afterSceneHash,
    blockVersionHash: 'fixture-block-version-hash-001u',
    backupObservationHash: source001RResult.receiptDraft.backupObservationHash,
    atomicWriteObservationHash: source001RResult.receiptDraft.atomicWriteObservationHash,
    ...overrides,
  };
}

function base001UInput(root, source001RResult, accepted001T, overrides = {}) {
  return {
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
    ...overrides,
  };
}

function rehashResult(canonicalHash, result, patch) {
  return withCanonicalHash(canonicalHash, {
    ...withoutHash(result),
    ...patch,
  });
}

test('001U writes verifies and returns a private product ApplyReceipt without runtime admission', async () => {
  const { runExactTextApplyPrivateProductApplyReceipt } = await loadModule();
  const evidence = await build001TEvidence();
  const result = await runExactTextApplyPrivateProductApplyReceipt(base001UInput(
    evidence.root,
    evidence.source001RResult,
    evidence.accepted001T,
  ));

  assert.equal(result.outputDecision, 'PRIVATE_PRODUCT_APPLYRECEIPT_IMPLEMENTED_FOR_EXACT_TEXT_SCOPE_NO_PUBLIC_RUNTIME');
  assert.equal(result.nextContourAfterPass, 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_001V');
  assert.equal(result.privateProductApplyReceiptImplemented, true);
  assert.equal(result.privateInternalOnly, true);
  assert.equal(result.exactTextOnly, true);
  assert.equal(result.singleSceneOnly, true);
  assert.equal(result.receiptReadbackVerified, true);
  assert.equal(result.receiptHashBound, true);
  assert.equal(result.admissionIsNotPublicRuntime, true);
  assert.equal(result.ownerAdmissionDoesNotAuthorizeRuntimeApply, true);
  assert.equal(result.receiptWriteIsNotApplyTxn, true);
  assert.equal(result.receiptReadbackIsNotRecovery, true);
  assert.equal(result.backupAndAtomicHashesBoundNotReproven, true);
  assert.equal(result.privateFunctionOnlyNoPublicSurface, true);
  assert.equal(result.productApplyRuntimeAdmitted, false);
  assert.equal(result.publicSurfaceClaimed, false);
  assert.equal(result.ipcSurfaceClaimed, false);
  assert.equal(result.uiChanged, false);
  assert.equal(result.docxImportClaimed, false);
  assert.equal(result.applyTxnImplemented, false);
  assert.equal(result.recoveryClaimed, false);
  assert.deepEqual(result.blockedReasons, []);

  const receipt = JSON.parse(await fsp.readFile(path.join(evidence.root, 'private-product-apply-receipt-001u.json'), 'utf8'));
  assert.equal(receipt.receiptKind, 'PRIVATE_PRODUCT_APPLY_RECEIPT_V1_001U');
  assert.equal(receipt.receiptVersion, 'PRIVATE_PRODUCT_APPLY_RECEIPT_SCHEMA_V1');
  assert.equal(receipt.receiptCanonicalHash, result.receipt.receiptCanonicalHash);
  assert.equal(receipt.source001TResultHash, evidence.accepted001T.canonicalHash);
  assert.equal(receipt.backupAndAtomicHashesBoundNotReproven, true);
  assert.equal(receipt.receiptWriteIsNotApplyTxn, true);
  assert.equal(receipt.receiptReadbackIsNotRecovery, true);
});

test('001U blocks missing blocked and mismatched 001T admission binding', async () => {
  const { canonicalHash } = await loadKernel();
  const { runExactTextApplyPrivateProductApplyReceipt, PRIVATE_PRODUCT_APPLY_RECEIPT_REASON_CODES } = await loadModule();
  const evidence = await build001TEvidence();
  const missing = await runExactTextApplyPrivateProductApplyReceipt(base001UInput(
    evidence.root,
    evidence.source001RResult,
    evidence.accepted001T,
    { source001TResult: null },
  ));
  assert.equal(missing.blockedReasons.includes(PRIVATE_PRODUCT_APPLY_RECEIPT_REASON_CODES.SOURCE_001T_RESULT_REQUIRED), true);

  const resultHashMismatch = await runExactTextApplyPrivateProductApplyReceipt(base001UInput(
    evidence.root,
    evidence.source001RResult,
    evidence.accepted001T,
    { source001TResultHash: 'wrong-001t-result-hash' },
  ));
  assert.equal(resultHashMismatch.blockedReasons.includes(PRIVATE_PRODUCT_APPLY_RECEIPT_REASON_CODES.SOURCE_001T_RESULT_MISMATCH), true);

  const decisionHashMismatch = await runExactTextApplyPrivateProductApplyReceipt(base001UInput(
    evidence.root,
    evidence.source001RResult,
    evidence.accepted001T,
    { source001TDecisionHash: 'wrong-001t-decision-hash' },
  ));
  assert.equal(decisionHashMismatch.blockedReasons.includes(PRIVATE_PRODUCT_APPLY_RECEIPT_REASON_CODES.SOURCE_001T_DECISION_MISMATCH), true);

  const blocked001T = rehashResult(canonicalHash, evidence.accepted001T, {
    outputDecision: 'PRIVATE_PRODUCT_APPLY_RECEIPT_ADMISSION_REMAINS_BLOCKED',
    ownerMayOpen001U: false,
    blockedReasons: ['SIMULATED_BLOCK'],
    decisions: [],
  });
  const blocked = await runExactTextApplyPrivateProductApplyReceipt(base001UInput(
    evidence.root,
    evidence.source001RResult,
    evidence.accepted001T,
    {
      source001TResult: blocked001T,
      source001TResultHash: blocked001T.canonicalHash,
      source001TDecisionHash: '',
    },
  ));
  assert.equal(blocked.blockedReasons.includes(PRIVATE_PRODUCT_APPLY_RECEIPT_REASON_CODES.SOURCE_001T_BLOCKED), true);
});

test('001U blocks accepted 001T if runtime public or write admission flags are contaminated', async () => {
  const { canonicalHash } = await loadKernel();
  const { runExactTextApplyPrivateProductApplyReceipt, PRIVATE_PRODUCT_APPLY_RECEIPT_REASON_CODES } = await loadModule();
  const evidence = await build001TEvidence();
  const contaminations = [
    { productApplyRuntimeAdmitted: true },
    { publicSurfaceAllowed: true },
    { userProjectWriteAllowedIn001T: true },
    { publicSurfaceClaimed: true },
    { uiChanged: true },
    { docxImportClaimed: true },
    { applyTxnImplemented: true },
    { recoveryClaimed: true },
  ];
  for (const contamination of contaminations) {
    const contaminated = rehashResult(canonicalHash, evidence.accepted001T, contamination);
    const result = await runExactTextApplyPrivateProductApplyReceipt(base001UInput(
      evidence.root,
      evidence.source001RResult,
      evidence.accepted001T,
      {
        source001TResult: contaminated,
        source001TResultHash: contaminated.canonicalHash,
      },
    ));
    assert.equal(result.blockedReasons.includes(
      PRIVATE_PRODUCT_APPLY_RECEIPT_REASON_CODES.SOURCE_001T_RUNTIME_ADMISSION_FORBIDDEN,
    ), true);
  }
});

test('001U requires receipt schema source fields and binds backup and atomic hashes without reproving them', async () => {
  const { runExactTextApplyPrivateProductApplyReceipt, PRIVATE_PRODUCT_APPLY_RECEIPT_REASON_CODES } = await loadModule();
  const evidence = await build001TEvidence();
  const requiredCases = [
    { patch: { projectId: '' }, code: PRIVATE_PRODUCT_APPLY_RECEIPT_REASON_CODES.PROJECT_ID_REQUIRED },
    { patch: { sceneId: '' }, code: PRIVATE_PRODUCT_APPLY_RECEIPT_REASON_CODES.SCENE_ID_REQUIRED },
    { patch: { beforeSceneHash: '' }, code: PRIVATE_PRODUCT_APPLY_RECEIPT_REASON_CODES.BEFORE_SCENE_HASH_REQUIRED },
    { patch: { afterSceneHash: '' }, code: PRIVATE_PRODUCT_APPLY_RECEIPT_REASON_CODES.AFTER_SCENE_HASH_REQUIRED },
    { patch: { blockVersionHash: '' }, code: PRIVATE_PRODUCT_APPLY_RECEIPT_REASON_CODES.BLOCK_VERSION_HASH_REQUIRED },
    { patch: { backupObservationHash: '' }, code: PRIVATE_PRODUCT_APPLY_RECEIPT_REASON_CODES.BACKUP_OBSERVATION_HASH_REQUIRED },
    { patch: { atomicWriteObservationHash: '' }, code: PRIVATE_PRODUCT_APPLY_RECEIPT_REASON_CODES.ATOMIC_WRITE_OBSERVATION_HASH_REQUIRED },
  ];
  for (const item of requiredCases) {
    const result = await runExactTextApplyPrivateProductApplyReceipt(base001UInput(
      evidence.root,
      evidence.source001RResult,
      evidence.accepted001T,
      { privateWriteObservation: privateWriteObservation(evidence.source001RResult, item.patch) },
    ));
    assert.equal(result.blockedReasons.includes(item.code), true);
  }

  const accepted = await runExactTextApplyPrivateProductApplyReceipt(base001UInput(
    evidence.root,
    evidence.source001RResult,
    evidence.accepted001T,
    { receiptFileTarget: path.join(evidence.root, 'hash-binding-receipt.json') },
  ));
  assert.equal(accepted.receipt.backupObservationHash, evidence.source001RResult.receiptDraft.backupObservationHash);
  assert.equal(accepted.receipt.atomicWriteObservationHash, evidence.source001RResult.receiptDraft.atomicWriteObservationHash);
  assert.equal(accepted.receipt.backupAndAtomicHashesBoundNotReproven, true);
});

test('001U blocks multi scene structural comment public command UI DOCX network dependency requests', async () => {
  const { runExactTextApplyPrivateProductApplyReceipt, PRIVATE_PRODUCT_APPLY_RECEIPT_REASON_CODES } = await loadModule();
  const evidence = await build001TEvidence();
  const cases = [
    {
      inputPatch: { privateWriteObservation: privateWriteObservation(evidence.source001RResult, { multiSceneScope: true }) },
      code: PRIVATE_PRODUCT_APPLY_RECEIPT_REASON_CODES.UNSUPPORTED_SCOPE_FORBIDDEN,
    },
    {
      inputPatch: { privateWriteObservation: privateWriteObservation(evidence.source001RResult, { structuralOperation: true }) },
      code: PRIVATE_PRODUCT_APPLY_RECEIPT_REASON_CODES.UNSUPPORTED_SCOPE_FORBIDDEN,
    },
    {
      inputPatch: { privateWriteObservation: privateWriteObservation(evidence.source001RResult, { commentOperation: true }) },
      code: PRIVATE_PRODUCT_APPLY_RECEIPT_REASON_CODES.UNSUPPORTED_SCOPE_FORBIDDEN,
    },
    { inputPatch: { publicSurfaceRequested: true }, code: PRIVATE_PRODUCT_APPLY_RECEIPT_REASON_CODES.PUBLIC_SURFACE_FORBIDDEN },
    { inputPatch: { ipcSurfaceClaimed: true }, code: PRIVATE_PRODUCT_APPLY_RECEIPT_REASON_CODES.COMMAND_SURFACE_FORBIDDEN },
    { inputPatch: { preloadExportClaimed: true }, code: PRIVATE_PRODUCT_APPLY_RECEIPT_REASON_CODES.COMMAND_SURFACE_FORBIDDEN },
    { inputPatch: { menuSurfaceClaimed: true }, code: PRIVATE_PRODUCT_APPLY_RECEIPT_REASON_CODES.COMMAND_SURFACE_FORBIDDEN },
    { inputPatch: { commandSurfaceClaimed: true }, code: PRIVATE_PRODUCT_APPLY_RECEIPT_REASON_CODES.COMMAND_SURFACE_FORBIDDEN },
    { inputPatch: { uiChanged: true }, code: PRIVATE_PRODUCT_APPLY_RECEIPT_REASON_CODES.UI_DOCX_NETWORK_DEPENDENCY_FORBIDDEN },
    { inputPatch: { docxImportClaimed: true }, code: PRIVATE_PRODUCT_APPLY_RECEIPT_REASON_CODES.UI_DOCX_NETWORK_DEPENDENCY_FORBIDDEN },
    { inputPatch: { networkUsed: true }, code: PRIVATE_PRODUCT_APPLY_RECEIPT_REASON_CODES.UI_DOCX_NETWORK_DEPENDENCY_FORBIDDEN },
    { inputPatch: { dependencyChanged: true }, code: PRIVATE_PRODUCT_APPLY_RECEIPT_REASON_CODES.UI_DOCX_NETWORK_DEPENDENCY_FORBIDDEN },
    { inputPatch: { productApplyRuntimeAdmitted: true }, code: PRIVATE_PRODUCT_APPLY_RECEIPT_REASON_CODES.APPLYTXN_RECOVERY_RELEASE_FORBIDDEN },
    { inputPatch: { applyTxnImplemented: true }, code: PRIVATE_PRODUCT_APPLY_RECEIPT_REASON_CODES.APPLYTXN_RECOVERY_RELEASE_FORBIDDEN },
    { inputPatch: { recoveryClaimed: true }, code: PRIVATE_PRODUCT_APPLY_RECEIPT_REASON_CODES.APPLYTXN_RECOVERY_RELEASE_FORBIDDEN },
  ];
  for (const item of cases) {
    const result = await runExactTextApplyPrivateProductApplyReceipt(base001UInput(
      evidence.root,
      evidence.source001RResult,
      evidence.accepted001T,
      item.inputPatch,
    ));
    assert.equal(result.blockedReasons.includes(item.code), true);
  }
});

test('001U write failure readback failure and hash tamper block without recovery or ApplyTxn claim', async () => {
  const { runExactTextApplyPrivateProductApplyReceipt, PRIVATE_PRODUCT_APPLY_RECEIPT_REASON_CODES } = await loadModule();
  const evidence = await build001TEvidence();
  const missingPorts = await runExactTextApplyPrivateProductApplyReceipt(base001UInput(
    evidence.root,
    evidence.source001RResult,
    evidence.accepted001T,
    { storagePorts: {} },
  ));
  assert.equal(missingPorts.blockedReasons.includes(PRIVATE_PRODUCT_APPLY_RECEIPT_REASON_CODES.STORAGE_PORTS_REQUIRED), true);
  assert.equal(missingPorts.recoveryClaimed, false);
  assert.equal(missingPorts.applyTxnImplemented, false);

  const writeFailure = await runExactTextApplyPrivateProductApplyReceipt(base001UInput(
    evidence.root,
    evidence.source001RResult,
    evidence.accepted001T,
    { storagePorts: { writeFileAtomic: async () => ({ success: false, error: 'simulated write failure' }), readFile: async () => '' } },
  ));
  assert.equal(writeFailure.blockedReasons.includes(PRIVATE_PRODUCT_APPLY_RECEIPT_REASON_CODES.RECEIPT_WRITE_FAILED), true);
  assert.equal(writeFailure.recoveryClaimed, false);
  assert.equal(writeFailure.applyTxnImplemented, false);

  const readbackFailure = await runExactTextApplyPrivateProductApplyReceipt(base001UInput(
    evidence.root,
    evidence.source001RResult,
    evidence.accepted001T,
    { storagePorts: { writeFileAtomic: async () => ({ success: true }), readFile: async () => null } },
  ));
  assert.equal(readbackFailure.blockedReasons.includes(PRIVATE_PRODUCT_APPLY_RECEIPT_REASON_CODES.RECEIPT_READBACK_FAILED), true);
  assert.equal(readbackFailure.receiptReadbackIsNotRecovery, true);

  const tamper = await runExactTextApplyPrivateProductApplyReceipt(base001UInput(
    evidence.root,
    evidence.source001RResult,
    evidence.accepted001T,
    {
      receiptFileTarget: path.join(evidence.root, 'tampered-receipt.json'),
      storagePorts: {
        writeFileAtomic: async (target) => {
          await fsp.mkdir(path.dirname(target), { recursive: true });
          await fsp.writeFile(target, '{"tampered":true}\n', 'utf8');
          return { success: true };
        },
        readFile: (target) => fsp.readFile(target, 'utf8'),
      },
    },
  ));
  assert.equal(tamper.blockedReasons.includes(PRIVATE_PRODUCT_APPLY_RECEIPT_REASON_CODES.RECEIPT_READBACK_HASH_MISMATCH), true);
  assert.equal(tamper.recoveryClaimed, false);
});

test('001U task record preserves private receipt boundary', () => {
  const taskText = sourceText('docs', 'tasks', TASK_BASENAME);
  assert.match(taskText, /TASK_ID: PRIVATE_PRODUCT_APPLY_RECEIPT_IMPLEMENTATION_001U/u);
  assert.match(taskText, /CONTOUR_TYPE: PRIVATE_IMPLEMENTATION/u);
  assert.match(taskText, /PRIVATE_PRODUCT_APPLYRECEIPT_IMPLEMENTED: true/u);
  assert.match(taskText, /PRODUCT_APPLY_RUNTIME_ADMITTED: false/u);
  assert.match(taskText, /RECEIPT_WRITE_IS_NOT_APPLYTXN: true/u);
  assert.match(taskText, /RECEIPT_READBACK_IS_NOT_RECOVERY: true/u);
  assert.match(taskText, /OWNER_ADMISSION_DOES_NOT_AUTHORIZE_RUNTIME_APPLY: true/u);
  assert.match(taskText, /PRIVATE_FUNCTION_ONLY_NO_PUBLIC_SURFACE: true/u);
  assert.match(taskText, /BACKUP_AND_ATOMIC_HASHES_BOUND_NOT_REPROVEN: true/u);
  assert.match(taskText, /NEXT_CONTOUR_IF_PASS: PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_001V/u);
  assert.match(taskText, /COMMIT_SHA: pending/u);
  assert.match(taskText, /PUSH_RESULT: pending/u);
  assert.match(taskText, /PR_RESULT: pending/u);
  assert.match(taskText, /MERGE_RESULT: pending/u);
  assert.doesNotMatch(taskText, /release green|public apply|DOCX runtime|ApplyTxn implemented|recovery proven/iu);
});

test('001U changed scope stays allowlisted and private receipt module avoids public runtime imports', () => {
  const changedBasenames = changedBasenamesForCurrentContour();
  const allowlist = new Set([
    MODULE_BASENAME,
    'exactTextApplyPrivateProductApplyReceipt.contract.test.js',
    TASK_BASENAME,
    'exactTextApplyWithReceiptAdmission.mjs',
    'exactTextApplyWithReceiptAdmission.contract.test.js',
    'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_001V.md',
    'exactTextApplyWithReceiptExecution.mjs',
    'exactTextApplyWithReceiptCloseout.mjs',
    'exactTextApplyWithReceiptNextAdmission.mjs',
    'exactTextApplyWithReceiptExecution.contract.test.js',
    'exactTextApplyWithReceiptCloseout.contract.test.js',
    'exactTextApplyWithReceiptNextAdmission.contract.test.js',
    'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_001W.md',
    'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_CLOSEOUT_001X.md',
    'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_ADMISSION_001Y.md',
    'revision-bridge-pre-stage-00-admission-guard-state.mjs',
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
  ]);
  assert.notDeepEqual(changedBasenames, [], '001U must have detectable changed scope');
  for (const basename of changedBasenames) {
    assert.equal(allowlist.has(basename), true, `unexpected 001U changed basename: ${basename}`);
    assert.equal(denylist.has(basename), false, `denylisted 001U changed basename: ${basename}`);
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
    assert.equal(pattern.test(moduleText), false, `forbidden 001U import pattern: ${pattern.source}`);
  }
});

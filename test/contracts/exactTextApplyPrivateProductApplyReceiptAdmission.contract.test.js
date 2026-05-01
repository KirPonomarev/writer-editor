const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const MODULE_BASENAME = 'exactTextApplyPrivateProductApplyReceiptAdmission.mjs';
const SOURCE_001S_MODULE_BASENAME = 'exactTextApplyFixtureDurableReceiptPrototype.mjs';
const SOURCE_001R_MODULE_BASENAME = 'exactTextApplyInternalWritePrototype.mjs';
const KERNEL_BASENAME = 'reviewIrKernel.mjs';
const TASK_BASENAME = 'PRIVATE_PRODUCT_APPLY_RECEIPT_ADMISSION_001T.md';

async function loadModule() {
  return import(pathToFileURL(path.join(process.cwd(), 'src', 'revisionBridge', MODULE_BASENAME)).href);
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
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'exact-text-001t-'));
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

async function build001SEvidence() {
  const { runExactTextApplyFixtureDurableReceiptPrototype } = await load001SModule();
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
    return { success, failure };
  }));
}

function ownerPacket(success, failure, overrides = {}) {
  return {
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
    ...overrides,
  };
}

function admissionInput(success, failure, overrides = {}) {
  return {
    source001SSuccessResult: success,
    source001SFailureResult: failure,
    source001SSuccessResultHash: success.canonicalHash,
    source001SFailureResultHash: failure.canonicalHash,
    source001SSuccessDecisionHash: success.decisions[0].canonicalHash,
    source001SFailureDecisionHash: failure.decisions[0].canonicalHash,
    source001SSuccessReceiptHash: success.receipt.receiptCanonicalHash,
    source001SFailureReceiptHash: failure.receipt.receiptCanonicalHash,
    ownerPacket: ownerPacket(success, failure),
    ...overrides,
  };
}

function rehashResult(canonicalHash, result, patch) {
  return withCanonicalHash(canonicalHash, {
    ...withoutHash(result),
    ...patch,
  });
}

test('001T admits opening 001U only after success and failure 001S machine proof plus strict owner packet', async () => {
  const { runExactTextApplyPrivateProductApplyReceiptAdmission } = await loadModule();
  const { success, failure } = await build001SEvidence();
  const result = runExactTextApplyPrivateProductApplyReceiptAdmission(admissionInput(success, failure));

  assert.equal(result.outputDecision, 'OWNER_MAY_OPEN_PRIVATE_PRODUCT_APPLYRECEIPT_IMPLEMENTATION_001U_NO_RUNTIME_ADMISSION');
  assert.equal(result.nextContourAfterPass, 'PRIVATE_PRODUCT_APPLY_RECEIPT_IMPLEMENTATION_001U');
  assert.equal(result.ownerMayOpen001U, true);
  assert.equal(result.privateProductApplyReceiptAdmissionOnly, true);
  assert.equal(result.privateInternalOnly, true);
  assert.equal(result.ownerPacketNotSufficientWithout001SMachineProof, true);
  assert.equal(result.fixtureReceiptEvidenceIsNotProductReceiptProof, true);
  assert.equal(result.admissionIsNotRuntimeAdmission, true);
  assert.equal(result.productApplyReceiptImplemented, false);
  assert.equal(result.productApplyRuntimeAdmitted, false);
  assert.equal(result.userProjectWriteAllowedIn001T, false);
  assert.equal(result.userProjectMutated, false);
  assert.equal(result.publicSurfaceAllowed, false);
  assert.equal(result.publicSurfaceClaimed, false);
  assert.equal(result.ipcSurfaceClaimed, false);
  assert.equal(result.uiChanged, false);
  assert.equal(result.docxImportClaimed, false);
  assert.equal(result.applyTxnImplemented, false);
  assert.equal(result.recoveryClaimed, false);
  assert.equal(result.releaseClaimed, false);
  assert.deepEqual(result.blockedReasons, []);
});

test('001T missing success or failure 001S proof blocks', async () => {
  const { runExactTextApplyPrivateProductApplyReceiptAdmission, PRIVATE_PRODUCT_APPLY_RECEIPT_ADMISSION_REASON_CODES } = await loadModule();
  const { success, failure } = await build001SEvidence();

  const missingSuccess = runExactTextApplyPrivateProductApplyReceiptAdmission(admissionInput(success, failure, {
    source001SSuccessResult: null,
  }));
  assert.equal(missingSuccess.blockedReasons.includes(
    PRIVATE_PRODUCT_APPLY_RECEIPT_ADMISSION_REASON_CODES.SOURCE_001S_SUCCESS_RESULT_REQUIRED,
  ), true);

  const missingFailure = runExactTextApplyPrivateProductApplyReceiptAdmission(admissionInput(success, failure, {
    source001SFailureResult: null,
  }));
  assert.equal(missingFailure.blockedReasons.includes(
    PRIVATE_PRODUCT_APPLY_RECEIPT_ADMISSION_REASON_CODES.SOURCE_001S_FAILURE_RESULT_REQUIRED,
  ), true);
});

test('001T result decision and receipt hash mismatches block separately', async () => {
  const { runExactTextApplyPrivateProductApplyReceiptAdmission, PRIVATE_PRODUCT_APPLY_RECEIPT_ADMISSION_REASON_CODES } = await loadModule();
  const { success, failure } = await build001SEvidence();
  const cases = [
    {
      patch: { source001SSuccessResultHash: 'wrong-success-result-hash' },
      code: PRIVATE_PRODUCT_APPLY_RECEIPT_ADMISSION_REASON_CODES.SOURCE_001S_SUCCESS_RESULT_MISMATCH,
    },
    {
      patch: { source001SFailureResultHash: 'wrong-failure-result-hash' },
      code: PRIVATE_PRODUCT_APPLY_RECEIPT_ADMISSION_REASON_CODES.SOURCE_001S_FAILURE_RESULT_MISMATCH,
    },
    {
      patch: { source001SSuccessDecisionHash: 'wrong-success-decision-hash' },
      code: PRIVATE_PRODUCT_APPLY_RECEIPT_ADMISSION_REASON_CODES.SOURCE_001S_SUCCESS_DECISION_MISMATCH,
    },
    {
      patch: { source001SFailureDecisionHash: 'wrong-failure-decision-hash' },
      code: PRIVATE_PRODUCT_APPLY_RECEIPT_ADMISSION_REASON_CODES.SOURCE_001S_FAILURE_DECISION_MISMATCH,
    },
    {
      patch: { source001SSuccessReceiptHash: 'wrong-success-receipt-hash' },
      code: PRIVATE_PRODUCT_APPLY_RECEIPT_ADMISSION_REASON_CODES.SOURCE_001S_SUCCESS_RECEIPT_MISMATCH,
    },
    {
      patch: { source001SFailureReceiptHash: 'wrong-failure-receipt-hash' },
      code: PRIVATE_PRODUCT_APPLY_RECEIPT_ADMISSION_REASON_CODES.SOURCE_001S_FAILURE_RECEIPT_MISMATCH,
    },
  ];

  for (const item of cases) {
    const result = runExactTextApplyPrivateProductApplyReceiptAdmission(admissionInput(success, failure, item.patch));
    assert.equal(result.outputDecision, 'PRIVATE_PRODUCT_APPLY_RECEIPT_ADMISSION_REMAINS_BLOCKED');
    assert.equal(result.blockedReasons.includes(item.code), true);
    assert.equal(result.ownerMayOpen001U, false);
  }
});

test('001T owner packet is necessary but never sufficient without valid 001S machine proof', async () => {
  const { canonicalHash } = await loadKernel();
  const { runExactTextApplyPrivateProductApplyReceiptAdmission, PRIVATE_PRODUCT_APPLY_RECEIPT_ADMISSION_REASON_CODES } = await loadModule();
  const { success, failure } = await build001SEvidence();

  const noOwner = runExactTextApplyPrivateProductApplyReceiptAdmission(admissionInput(success, failure, {
    ownerPacket: null,
  }));
  assert.equal(noOwner.blockedReasons.includes(
    PRIVATE_PRODUCT_APPLY_RECEIPT_ADMISSION_REASON_CODES.OWNER_PACKET_REQUIRED,
  ), true);

  const contaminatedSuccess = rehashResult(canonicalHash, success, {
    productApplyReceiptImplemented: true,
  });
  const ownerStillApproves = runExactTextApplyPrivateProductApplyReceiptAdmission(admissionInput(success, failure, {
    source001SSuccessResult: contaminatedSuccess,
    source001SSuccessResultHash: contaminatedSuccess.canonicalHash,
    ownerPacket: ownerPacket(contaminatedSuccess, failure),
  }));
  assert.equal(ownerStillApproves.blockedReasons.includes(
    PRIVATE_PRODUCT_APPLY_RECEIPT_ADMISSION_REASON_CODES.SOURCE_PRODUCT_CLAIM_FORBIDDEN,
  ), true);
  assert.equal(ownerStillApproves.ownerMayOpen001U, false);
});

test('001T owner packet rejects public surface user project write broad apply and runtime overclaim', async () => {
  const { runExactTextApplyPrivateProductApplyReceiptAdmission, PRIVATE_PRODUCT_APPLY_RECEIPT_ADMISSION_REASON_CODES } = await loadModule();
  const { success, failure } = await build001SEvidence();
  const cases = [
    {
      ownerPatch: { ownerApprovedPublicSurface: true },
      code: PRIVATE_PRODUCT_APPLY_RECEIPT_ADMISSION_REASON_CODES.OWNER_PUBLIC_SURFACE_FORBIDDEN,
    },
    {
      ownerPatch: { ownerApprovedUserProjectWriteIn001T: true },
      code: PRIVATE_PRODUCT_APPLY_RECEIPT_ADMISSION_REASON_CODES.OWNER_USER_PROJECT_WRITE_FORBIDDEN,
    },
    {
      ownerPatch: { ownerApprovedBroadApply: true },
      code: PRIVATE_PRODUCT_APPLY_RECEIPT_ADMISSION_REASON_CODES.OWNER_BROAD_APPLY_FORBIDDEN,
    },
    {
      ownerPatch: { ownerApprovedProductRuntimeAdmissionIn001T: true },
      code: PRIVATE_PRODUCT_APPLY_RECEIPT_ADMISSION_REASON_CODES.PRODUCT_RUNTIME_ADMISSION_FORBIDDEN,
    },
    {
      ownerPatch: { ownerApprovedApplyTxnClaim: true },
      code: PRIVATE_PRODUCT_APPLY_RECEIPT_ADMISSION_REASON_CODES.PRODUCT_RECEIPT_PROOF_OVERCLAIM_FORBIDDEN,
    },
  ];

  for (const item of cases) {
    const result = runExactTextApplyPrivateProductApplyReceiptAdmission(admissionInput(success, failure, {
      ownerPacket: ownerPacket(success, failure, item.ownerPatch),
    }));
    assert.equal(result.outputDecision, 'PRIVATE_PRODUCT_APPLY_RECEIPT_ADMISSION_REMAINS_BLOCKED');
    assert.equal(result.blockedReasons.includes(item.code), true);
  }
});

test('001T contaminated 001S false flags block product runtime admission', async () => {
  const { canonicalHash } = await loadKernel();
  const { runExactTextApplyPrivateProductApplyReceiptAdmission, PRIVATE_PRODUCT_APPLY_RECEIPT_ADMISSION_REASON_CODES } = await loadModule();
  const { success, failure } = await build001SEvidence();
  const contaminations = [
    { productWritePerformed: true },
    { productApplyReceiptImplemented: true },
    { publicSurfaceClaimed: true },
    { recoveryClaimed: true },
    { applyTxnImplemented: true },
    { uiChanged: true },
    { docxImportClaimed: true },
    { networkUsed: true },
    { dependencyChanged: true },
  ];

  for (const contamination of contaminations) {
    const contaminated = rehashResult(canonicalHash, success, contamination);
    const result = runExactTextApplyPrivateProductApplyReceiptAdmission(admissionInput(success, failure, {
      source001SSuccessResult: contaminated,
      source001SSuccessResultHash: contaminated.canonicalHash,
      ownerPacket: ownerPacket(contaminated, failure),
    }));
    assert.equal(result.outputDecision, 'PRIVATE_PRODUCT_APPLY_RECEIPT_ADMISSION_REMAINS_BLOCKED');
    assert.equal(result.blockedReasons.includes(
      PRIVATE_PRODUCT_APPLY_RECEIPT_ADMISSION_REASON_CODES.SOURCE_PRODUCT_CLAIM_FORBIDDEN,
    ), true);
  }
});

test('001T task record preserves admission only boundary', () => {
  const taskText = sourceText('docs', 'tasks', TASK_BASENAME);
  assert.match(taskText, /TASK_ID: PRIVATE_PRODUCT_APPLY_RECEIPT_ADMISSION_001T/u);
  assert.match(taskText, /CONTOUR_TYPE: ADMISSION_ONLY/u);
  assert.match(taskText, /CONTOUR_NOT_IMPLEMENTATION: TRUE/u);
  assert.match(taskText, /PRODUCT_APPLYRECEIPT_IMPLEMENTED: false/u);
  assert.match(taskText, /PRODUCT_APPLY_RUNTIME_ADMITTED: false/u);
  assert.match(taskText, /USER_PROJECT_WRITE_ALLOWED_IN_001T: false/u);
  assert.match(taskText, /PUBLIC_SURFACE_ALLOWED: false/u);
  assert.match(taskText, /OWNER_PACKET_NOT_SUFFICIENT_WITHOUT_001S_MACHINE_PROOF: true/u);
  assert.match(taskText, /FIXTURE_RECEIPT_EVIDENCE_IS_NOT_PRODUCT_RECEIPT_PROOF: true/u);
  assert.match(taskText, /NEXT_CONTOUR_IF_PASS: PRIVATE_PRODUCT_APPLY_RECEIPT_IMPLEMENTATION_001U/u);
  assert.match(taskText, /COMMIT_SHA: pending/u);
  assert.match(taskText, /PUSH_RESULT: pending/u);
  assert.match(taskText, /PR_RESULT: pending/u);
  assert.match(taskText, /MERGE_RESULT: pending/u);
  assert.doesNotMatch(taskText, /release green|public apply|DOCX runtime|ApplyTxn implemented|recovery proven/iu);
});

test('001T changed scope stays allowlisted and admission module stays pure', () => {
  const changedBasenames = changedBasenamesForCurrentContour();
  const allowlist = new Set([
    MODULE_BASENAME,
    'exactTextApplyPrivateProductApplyReceipt.mjs',
    'exactTextApplyPrivateProductApplyReceiptAdmission.contract.test.js',
    'exactTextApplyPrivateProductApplyReceipt.contract.test.js',
    TASK_BASENAME,
    'PRIVATE_PRODUCT_APPLY_RECEIPT_IMPLEMENTATION_001U.md',
    'revision-bridge-pre-stage-00-admission-guard-state.mjs',
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
    'atomicWriteFile.mjs',
    'hostilePackageGate.mjs',
    'TOKEN_CATALOG.json',
    'CRITICAL_CLAIM_MATRIX.json',
    'REQUIRED_TOKEN_SET.json',
    'FAILSIGNAL_REGISTRY.json',
  ]);
  assert.notDeepEqual(changedBasenames, [], '001T must have detectable changed scope');
  for (const basename of changedBasenames) {
    assert.equal(allowlist.has(basename), true, `unexpected 001T changed basename: ${basename}`);
    assert.equal(denylist.has(basename), false, `denylisted 001T changed basename: ${basename}`);
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
    assert.equal(pattern.test(moduleText), false, `forbidden 001T import pattern: ${pattern.source}`);
  }
});

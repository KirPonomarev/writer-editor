const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const MODULE_BASENAME = 'exactTextApplyFixtureDurableReceiptPrototype.mjs';
const SOURCE_001R_MODULE_BASENAME = 'exactTextApplyInternalWritePrototype.mjs';
const KERNEL_BASENAME = 'reviewIrKernel.mjs';
const TASK_BASENAME = 'EXACT_TEXT_APPLY_FIXTURE_DURABLE_RECEIPT_AND_FAILURE_RECEIPT_001S.md';

async function loadModule() {
  return import(pathToFileURL(path.join(process.cwd(), 'src', 'revisionBridge', MODULE_BASENAME)).href);
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
  const decision = { ...decisionCore, canonicalHash: canonicalHash(decisionCore) };
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
  return { ...resultCore, canonicalHash: canonicalHash(resultCore) };
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
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'exact-text-001s-'));
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

test('001S writes and verifies fixture durable success receipt through existing atomic write primitive', async () => {
  const { runExactTextApplyFixtureDurableReceiptPrototype } = await loadModule();
  await withFixture(async (root) => withElectronDocumentsStub(root, async ({ fileManager, backupManager }) => {
    const source001RResult = await accepted001RResult(root, fileManager, backupManager);
    const result = await runExactTextApplyFixtureDurableReceiptPrototype(base001SInput(
      source001RResult,
      root,
      { writeFileAtomic: (...args) => fileManager.writeFileAtomic(...args) },
    ));

    assert.equal(result.outputDecision, 'FIXTURE_DURABLE_SUCCESS_RECEIPT_OBSERVED');
    assert.equal(result.fixtureDurableReceiptObserved, true);
    assert.equal(result.receiptFileWritten, true);
    assert.equal(result.receiptReadbackVerified, true);
    assert.equal(result.fixtureDurableReceiptIsNotProductApplyReceipt, true);
    assert.equal(result.failureReceiptIsNotRecovery, true);
    assert.equal(result.atomicReceiptFileWriteIsNotApplyTxn, true);
    assert.equal(result.productApplyReceiptImplemented, false);
    assert.equal(result.productDurableApplyReceiptClaimed, false);
    assert.equal(result.applyTxnImplemented, false);
    assert.equal(result.recoveryClaimed, false);

    const receiptPath = path.join(root, 'receipt-001s.json');
    const receipt = JSON.parse(await fsp.readFile(receiptPath, 'utf8'));
    assert.equal(receipt.receiptKind, 'EXACT_TEXT_FIXTURE_DURABLE_SUCCESS_RECEIPT_001S');
    assert.equal(receipt.receiptCanonicalHash, result.receipt.receiptCanonicalHash);
    assert.equal(receipt.source001RReceiptDraftHash, source001RResult.receiptDraft.canonicalHash);
  }));
});

test('001S writes and verifies fixture failure receipt without recovery claim', async () => {
  const { runExactTextApplyFixtureDurableReceiptPrototype } = await loadModule();
  await withFixture(async (root) => withElectronDocumentsStub(root, async ({ fileManager, backupManager }) => {
    const source001RResult = await accepted001RResult(root, fileManager, backupManager);
    const result = await runExactTextApplyFixtureDurableReceiptPrototype(base001SInput(
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

    assert.equal(result.outputDecision, 'FIXTURE_DURABLE_FAILURE_RECEIPT_OBSERVED');
    assert.equal(result.fixtureFailureReceiptObserved, true);
    assert.equal(result.failureReceiptIsNotRecovery, true);
    assert.equal(result.recoveryClaimed, false);
    const receipt = JSON.parse(await fsp.readFile(path.join(root, 'failure-receipt-001s.json'), 'utf8'));
    assert.equal(receipt.receiptKind, 'EXACT_TEXT_FIXTURE_DURABLE_FAILURE_RECEIPT_001S');
    assert.equal(receipt.failureReasonCode, 'SIMULATED_FIXTURE_FAILURE');
    assert.deepEqual(receipt.blockedReasons, ['SIMULATED_FIXTURE_FAILURE']);
    assert.equal(receipt.recoveryClaimedFalse, true);
  }));
});

test('001S source binding mismatches block before receipt write', async () => {
  const { runExactTextApplyFixtureDurableReceiptPrototype, FIXTURE_DURABLE_RECEIPT_REASON_CODES } = await loadModule();
  await withFixture(async (root) => withElectronDocumentsStub(root, async ({ fileManager, backupManager }) => {
    const source001RResult = await accepted001RResult(root, fileManager, backupManager);
    const calls = [];
    const result = await runExactTextApplyFixtureDurableReceiptPrototype(base001SInput(
      source001RResult,
      root,
      {
        async writeFileAtomic() {
          calls.push('writeFileAtomic');
          return { success: true };
        },
      },
      { source001RDecisionHash: 'wrong-decision-hash' },
    ));
    assert.equal(result.outputDecision, 'FIXTURE_DURABLE_RECEIPT_CONTOUR_REMAINS_BLOCKED');
    assert.equal(result.blockedReasons.includes(FIXTURE_DURABLE_RECEIPT_REASON_CODES.SOURCE_001R_DECISION_MISMATCH), true);
    assert.deepEqual(calls, []);
  }));
});

test('001S missing result result hash mismatch and receipt draft hash mismatch block before receipt write', async () => {
  const { runExactTextApplyFixtureDurableReceiptPrototype, FIXTURE_DURABLE_RECEIPT_REASON_CODES } = await loadModule();
  await withFixture(async (root) => withElectronDocumentsStub(root, async ({ fileManager, backupManager }) => {
    const source001RResult = await accepted001RResult(root, fileManager, backupManager);
    const missing = await runExactTextApplyFixtureDurableReceiptPrototype({
      source001RResult: null,
      source001RResultHash: '',
      source001RDecisionHash: '',
      source001RReceiptDraftHash: '',
      fixtureProjectRoot: root,
      osTempFixtureRootOnly: true,
      fixtureProjectRootInsideTempRoot: true,
      fixtureProjectRootIsProductRoot: false,
      userProjectPathAllowedIn001S: false,
      fixtureDurableReceiptAllowedIn001S: true,
      receiptMode: 'SUCCESS',
      receiptFileBasename: 'missing-source.json',
      receiptWrittenAt: '2026-05-01T00:00:00.000Z',
      storagePorts: { writeFileAtomic: () => { throw new Error('must not write'); } },
    });
    assert.equal(missing.blockedReasons.includes(
      FIXTURE_DURABLE_RECEIPT_REASON_CODES.SOURCE_001R_RESULT_REQUIRED,
    ), true);

    const resultHashMismatch = await runExactTextApplyFixtureDurableReceiptPrototype(base001SInput(
      source001RResult,
      root,
      { writeFileAtomic: () => { throw new Error('must not write'); } },
      { source001RResultHash: 'wrong-result-hash' },
    ));
    assert.equal(resultHashMismatch.blockedReasons.includes(
      FIXTURE_DURABLE_RECEIPT_REASON_CODES.SOURCE_001R_RESULT_MISMATCH,
    ), true);

    const draftHashMismatch = await runExactTextApplyFixtureDurableReceiptPrototype(base001SInput(
      source001RResult,
      root,
      { writeFileAtomic: () => { throw new Error('must not write'); } },
      { source001RReceiptDraftHash: 'wrong-draft-hash' },
    ));
    assert.equal(draftHashMismatch.blockedReasons.includes(
      FIXTURE_DURABLE_RECEIPT_REASON_CODES.SOURCE_001R_RECEIPT_DRAFT_MISMATCH,
    ), true);
  }));
});

test('001S contaminated 001R product recovery or surface flags block before receipt write', async () => {
  const { canonicalHash } = await loadKernel();
  const { runExactTextApplyFixtureDurableReceiptPrototype, FIXTURE_DURABLE_RECEIPT_REASON_CODES } = await loadModule();
  await withFixture(async (root) => withElectronDocumentsStub(root, async ({ fileManager, backupManager }) => {
    const source001RResult = await accepted001RResult(root, fileManager, backupManager);
    const cases = [
      { recoveryClaimed: true },
      { crashRecoveryClaimed: true },
      { publicSurfaceClaimed: true },
      { docxImportClaimed: true },
      { uiChanged: true },
      { userProjectMutated: true },
    ];
    for (const contamination of cases) {
      const { canonicalHash: _oldHash, ...sourceCore } = source001RResult;
      const contaminatedCore = {
        ...sourceCore,
        ...contamination,
      };
      const contaminated = {
        ...contaminatedCore,
        canonicalHash: canonicalHash(contaminatedCore),
      };
      const result = await runExactTextApplyFixtureDurableReceiptPrototype(base001SInput(
        contaminated,
        root,
        { writeFileAtomic: () => { throw new Error('must not write'); } },
        {
          source001RResultHash: contaminated.canonicalHash,
          source001RDecisionHash: contaminated.decisions[0].canonicalHash,
          source001RReceiptDraftHash: contaminated.receiptDraft.canonicalHash,
        },
      ));
      assert.equal(result.blockedReasons.includes(
        FIXTURE_DURABLE_RECEIPT_REASON_CODES.SOURCE_001R_RESULT_MISMATCH,
      ), true);
      assert.equal(result.receiptFileWritten, false);
    }
  }));
});

test('001S user project repo root product root and non temp fixture guards block before receipt write', async () => {
  const { runExactTextApplyFixtureDurableReceiptPrototype, FIXTURE_DURABLE_RECEIPT_REASON_CODES } = await loadModule();
  await withFixture(async (root) => withElectronDocumentsStub(root, async ({ fileManager, backupManager }) => {
    const source001RResult = await accepted001RResult(root, fileManager, backupManager);
    const unsafeAccessCases = [
      { userProjectRootAccess: true },
      { productRootAccess: true },
      { repoRootAccess: true },
    ];
    for (const unsafeAccess of unsafeAccessCases) {
      const result = await runExactTextApplyFixtureDurableReceiptPrototype(base001SInput(
        source001RResult,
        root,
        { writeFileAtomic: () => { throw new Error('must not write'); } },
        unsafeAccess,
      ));
      assert.equal(result.blockedReasons.includes(
        FIXTURE_DURABLE_RECEIPT_REASON_CODES.USER_PROJECT_PATH_FORBIDDEN,
      ), true);
      assert.equal(result.receiptFileWritten, false);
    }

    const repoRootAsFixture = await runExactTextApplyFixtureDurableReceiptPrototype(base001SInput(
      source001RResult,
      process.cwd(),
      { writeFileAtomic: () => { throw new Error('must not write'); } },
      {
        fixtureProjectRootInsideTempRoot: true,
        receiptFileBasename: 'repo-root-receipt.json',
      },
    ));
    assert.equal(repoRootAsFixture.blockedReasons.includes(
      FIXTURE_DURABLE_RECEIPT_REASON_CODES.FIXTURE_ROOT_POLICY_REQUIRED,
    ), true);
  }));
});

test('001S unsafe receipt basename and symlink target block before receipt write', async () => {
  const { runExactTextApplyFixtureDurableReceiptPrototype, FIXTURE_DURABLE_RECEIPT_REASON_CODES } = await loadModule();
  await withFixture(async (root) => withElectronDocumentsStub(root, async ({ fileManager, backupManager }) => {
    const source001RResult = await accepted001RResult(root, fileManager, backupManager);
    const unsafe = await runExactTextApplyFixtureDurableReceiptPrototype(base001SInput(
      source001RResult,
      root,
      { writeFileAtomic: () => { throw new Error('must not write'); } },
      { receiptFileBasename: '../receipt.json' },
    ));
    assert.equal(unsafe.blockedReasons.includes(FIXTURE_DURABLE_RECEIPT_REASON_CODES.RECEIPT_FILE_BASENAME_REQUIRED), true);

    const outside = path.join(os.tmpdir(), `exact-text-001s-outside-${Date.now()}.json`);
    await fsp.writeFile(outside, '{}', 'utf8');
    await fsp.symlink(outside, path.join(root, 'linked-receipt.json'));
    const symlink = await runExactTextApplyFixtureDurableReceiptPrototype(base001SInput(
      source001RResult,
      root,
      { writeFileAtomic: () => { throw new Error('must not write'); } },
      { receiptFileBasename: 'linked-receipt.json' },
    ));
    assert.equal(symlink.blockedReasons.includes(FIXTURE_DURABLE_RECEIPT_REASON_CODES.RECEIPT_SYMLINK_FORBIDDEN), true);
    await fsp.rm(outside, { force: true });
  }));
});

test('001S write failure and readback mismatch block without product claims', async () => {
  const { runExactTextApplyFixtureDurableReceiptPrototype, FIXTURE_DURABLE_RECEIPT_REASON_CODES } = await loadModule();
  await withFixture(async (root) => withElectronDocumentsStub(root, async ({ fileManager, backupManager }) => {
    const source001RResult = await accepted001RResult(root, fileManager, backupManager);
    const writeFailure = await runExactTextApplyFixtureDurableReceiptPrototype(base001SInput(
      source001RResult,
      root,
      { writeFileAtomic: async () => ({ success: false, error: 'simulated write failure' }) },
    ));
    assert.equal(writeFailure.blockedReasons.includes(FIXTURE_DURABLE_RECEIPT_REASON_CODES.RECEIPT_WRITE_FAILED), true);
    assert.equal(writeFailure.productApplyReceiptImplemented, false);

    const readbackMismatch = await runExactTextApplyFixtureDurableReceiptPrototype(base001SInput(
      source001RResult,
      root,
      {
        async writeFileAtomic(targetPath) {
          await fsp.writeFile(targetPath, '{"wrong":true}\n', 'utf8');
          return { success: true };
        },
      },
      { receiptFileBasename: 'mismatch-receipt.json' },
    ));
    assert.equal(readbackMismatch.blockedReasons.includes(
      FIXTURE_DURABLE_RECEIPT_REASON_CODES.RECEIPT_READBACK_HASH_MISMATCH,
    ), true);
    assert.equal(readbackMismatch.productDurableApplyReceiptClaimed, false);
  }));
});

test('001S product ApplyReceipt ApplyTxn recovery and public claims block before receipt write', async () => {
  const { runExactTextApplyFixtureDurableReceiptPrototype, FIXTURE_DURABLE_RECEIPT_REASON_CODES } = await loadModule();
  await withFixture(async (root) => withElectronDocumentsStub(root, async ({ fileManager, backupManager }) => {
    const source001RResult = await accepted001RResult(root, fileManager, backupManager);
    const cases = [
      { productApplyReceiptImplemented: true },
      { productDurableApplyReceiptClaimed: true },
      { applyTxnImplemented: true },
      { recoveryClaimed: true },
      { crashRecoveryClaimed: true },
      { publicSurfaceClaimed: true },
      { uiChanged: true },
      { docxImportClaimed: true },
    ];
    for (const overclaim of cases) {
      const result = await runExactTextApplyFixtureDurableReceiptPrototype(base001SInput(
        source001RResult,
        root,
        { writeFileAtomic: () => { throw new Error('must not write'); } },
        overclaim,
      ));
      assert.equal(result.blockedReasons.includes(FIXTURE_DURABLE_RECEIPT_REASON_CODES.PRODUCT_CLAIM_FORBIDDEN), true);
      assert.equal(result.receiptFileWritten, false);
    }
  }));
});

test('001S task record preserves fixture receipt boundary', () => {
  const taskText = sourceText('docs', 'tasks', TASK_BASENAME);
  assert.match(taskText, /STATUS: IMPLEMENTED_LOCALLY_PENDING_DELIVERY_VERIFICATION/u);
  assert.match(taskText, /FIXTURE_DURABLE_RECEIPT_ALLOWED_IN_001S: true/u);
  assert.match(taskText, /USER_PROJECT_PATH_ALLOWED_IN_001S: false/u);
  assert.match(taskText, /FIXTURE_DURABLE_RECEIPT_IS_NOT_PRODUCT_APPLYRECEIPT: true/u);
  assert.match(taskText, /FAILURE_RECEIPT_IS_NOT_RECOVERY: true/u);
  assert.match(taskText, /ATOMIC_RECEIPT_FILE_WRITE_IS_NOT_PROJECT_LEVEL_APPLYTXN: true/u);
  assert.match(taskText, /PRODUCT_APPLYRECEIPT_IMPLEMENTED: false/u);
  assert.match(taskText, /APPLYTXN_IMPLEMENTED: false/u);
  assert.match(taskText, /RECOVERY_CLAIMED: false/u);
  assert.match(taskText, /UI_SCREENSHOT_CHECK: NOT_APPLICABLE_NO_UI_CHANGE/u);
  assert.match(taskText, /NEXT_CONTOUR_AFTER_PASS: PRIVATE_PRODUCT_APPLY_RECEIPT_ADMISSION_001T/u);
  assert.match(taskText, /COMMIT_SHA: pending/u);
  assert.match(taskText, /PUSH_RESULT: pending/u);
  assert.match(taskText, /PR_RESULT: pending/u);
  assert.match(taskText, /MERGE_RESULT: pending/u);
  assert.doesNotMatch(taskText, /product apply ready|public apply|DOCX runtime|release green|ApplyTxn implemented|recovery proven/iu);
});

test('001S changed scope stays allowlisted and storage imports stay out of pure kernel', () => {
  const changedBasenames = changedBasenamesForCurrentContour();
  const allowlist = new Set([
    MODULE_BASENAME,
    'exactTextApplyPrivateProductApplyReceiptAdmission.mjs',
    'exactTextApplyPrivateProductApplyReceipt.mjs',
    'exactTextApplyWithReceiptAdmission.mjs',
    'exactTextApplyWithReceiptExecution.mjs',
    'exactTextApplyWithReceiptCloseout.mjs',
    'exactTextApplyWithReceiptNextAdmission.mjs',
    'exactTextApplyWithReceiptNextContourAdmission.mjs',
    'exactTextApplyWithReceiptPrivateContractBrief.mjs',
    'exactTextApplyWithReceiptPrivateContractShape.mjs',
    'exactTextApplyWithReceiptPrivatePortAdmission.mjs',
    'exactTextApplyWithReceiptPrivatePortImplementation.mjs',
    'exactTextApplyWithReceiptPrivatePortCloseoutNextContourPermission.mjs',
    'exactTextApplyFixtureDurableReceiptPrototype.contract.test.js',
    'exactTextApplyPrivateProductApplyReceiptAdmission.contract.test.js',
    'exactTextApplyPrivateProductApplyReceipt.contract.test.js',
    'exactTextApplyWithReceiptAdmission.contract.test.js',
    'exactTextApplyWithReceiptExecution.contract.test.js',
    'exactTextApplyWithReceiptCloseout.contract.test.js',
    'exactTextApplyWithReceiptNextAdmission.contract.test.js',
    'exactTextApplyWithReceiptNextContourAdmission.contract.test.js',
    'exactTextApplyWithReceiptPrivateContractBrief.contract.test.js',
    'exactTextApplyWithReceiptPrivateContractShape.contract.test.js',
    'exactTextApplyWithReceiptPrivatePortAdmission.contract.test.js',
    'exactTextApplyWithReceiptPrivatePortImplementation.contract.test.js',
    'exactTextApplyWithReceiptPrivatePortCloseoutNextContourPermission.contract.test.js',
    'EXACT_TEXT_APPLY_FIXTURE_DURABLE_RECEIPT_AND_FAILURE_RECEIPT_001S.md',
    'PRIVATE_PRODUCT_APPLY_RECEIPT_ADMISSION_001T.md',
    'PRIVATE_PRODUCT_APPLY_RECEIPT_IMPLEMENTATION_001U.md',
    'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_001V.md',
    'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_001W.md',
    'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_CLOSEOUT_001X.md',
    'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_ADMISSION_001Y.md',
    'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_CONTOUR_ADMISSION_001Z.md',
    'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_BRIEF_002A.md',
    'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_SHAPE_002B.md',
    'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_ADMISSION_002C.md',
    'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_IMPLEMENTATION_002D.md',
    'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_CLOSEOUT_AND_NEXT_CONTOUR_PERMISSION_002E.md',
    SOURCE_001R_MODULE_BASENAME,
    'exactTextApplyInternalWritePrototype.contract.test.js',
    'exactTextApplyProductApplyAdmissionGate.contract.test.js',
    'exactTextApplyProductApplyReadinessReview.contract.test.js',
    'exactTextApplyProductStoragePrimitiveEvidence.contract.test.js',
    'exactTextApplyTestFixtureReceiptFile.contract.test.js',
    'exactTextApplyTestOnlyProductShapedStorageDryRun.contract.test.js',
    'exactTextApplyTestOnlyStoragePrimitiveExecutionHarness.contract.test.js',
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
    'command-catalog.v1.mjs',
    'projectCommands.mjs',
    'fileManager.js',
    'backupManager.js',
    'atomicWriteFile.mjs',
    'hostilePackageGate.mjs',
    'TOKEN_CATALOG.json',
    'CRITICAL_CLAIM_MATRIX.json',
    'REQUIRED_TOKEN_SET.json',
    'FAILSIGNAL_REGISTRY.json',
  ]);
  assert.notDeepEqual(changedBasenames, [], '001S must have detectable changed scope');
  for (const basename of changedBasenames) {
    assert.equal(allowlist.has(basename), true, `unexpected 001S changed basename: ${basename}`);
    assert.equal(denylist.has(basename), false, `denylisted 001S changed basename: ${basename}`);
  }

  const kernelText = sourceText('src', 'revisionBridge', KERNEL_BASENAME);
  const moduleText = sourceText('src', 'revisionBridge', MODULE_BASENAME);
  const forbiddenPureKernelPatterns = [
    /from\s+['"][^'"]*backupManager[^'"]*['"]/u,
    /from\s+['"][^'"]*fileManager[^'"]*['"]/u,
    /require\s*\(\s*['"][^'"]*backupManager[^'"]*['"]\s*\)/u,
    /require\s*\(\s*['"][^'"]*fileManager[^'"]*['"]\s*\)/u,
    /from\s+['"]electron['"]/u,
    /require\s*\(\s*['"]electron['"]\s*\)/u,
  ];
  for (const pattern of forbiddenPureKernelPatterns) {
    assert.equal(pattern.test(kernelText), false, `forbidden pure kernel import pattern: ${pattern.source}`);
  }
  assert.equal(/from\s+['"]electron['"]/u.test(moduleText), false);
  assert.equal(/require\s*\(\s*['"]electron['"]\s*\)/u.test(moduleText), false);
  assert.equal(/from\s+['"][^'"]*(?:main|preload|editor|command-catalog|projectCommands)[^'"]*['"]/u.test(moduleText), false);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const { pathToFileURL } = require('node:url');

const MODULE_BASENAME = 'reviewIrKernel.mjs';
const TASK_BASENAME = 'EXACT_TEXT_APPLY_TEST_ONLY_STORAGE_PRIMITIVE_EXECUTION_HARNESS_001N.md';

async function loadKernel() {
  return import(pathToFileURL(path.join(process.cwd(), 'src', 'revisionBridge', MODULE_BASENAME)).href);
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

function sourceText(...segments) {
  return fs.readFileSync(path.join(process.cwd(), ...segments), 'utf8');
}

function uniqueStrings(items) {
  return Array.from(new Set(items.filter(Boolean))).sort();
}

function acceptedFixtureReceiptFileObservationResult() {
  return {
    contractOnly: true,
    testFixtureReceiptFileObservationPlanOnly: true,
    testFixtureReceiptFileObservationAdmitted: true,
    testFixtureReceiptFileObservationOnly: true,
    receiptObservationOnly: true,
    hashObservationOnly: true,
    productReceiptNotProven: true,
    durableReceiptNotProven: true,
    productApplyReceiptNotImplemented: true,
    productDurableReceiptNotProven: true,
    testReceiptFileNotRecovery: true,
    fixtureReceiptFileObservationNotProductPersistence: true,
    applyReceiptImplemented: false,
    filesystemWritePerformed: false,
    fsMutationPerformed: false,
    productWritePerformed: false,
    productWriteClaimed: false,
    productAtomicityClaimed: false,
    fixtureBackupCreated: false,
    fixtureAtomicWriteExecuted: false,
    fixtureRecoverySnapshotCreated: false,
    fixtureReceiptPersisted: false,
    durableReceiptClaimed: false,
    productApplyReceiptClaimed: false,
    productStorageSafetyClaimed: false,
    publicSurfaceClaimed: false,
    docxImportClaimed: false,
    uiChanged: false,
    applyTxnClaimed: false,
    crashRecoveryClaimed: false,
    releaseClaimed: false,
    storageImportsAdded: false,
    storagePrimitiveChanged: false,
    canonicalHash: 'accepted-001l-result-hash',
    blockedReasons: [],
    fixtureReceiptFileObservationDecisions: [{
      fixtureReceiptFileObservationDecisionKind: 'EXACT_TEXT_TEST_FIXTURE_RECEIPT_FILE_OBSERVATION_DECISION',
      testFixtureReceiptFileObservationAdmitted: true,
      testFixtureReceiptFileObservationOnly: true,
      receiptObservationOnly: true,
      productReceiptNotProven: true,
      durableReceiptNotProven: true,
      productApplyReceiptNotImplemented: true,
      productDurableReceiptNotProven: true,
      testReceiptFileNotRecovery: true,
      fixtureReceiptFileObservationNotProductPersistence: true,
      applyReceiptImplemented: false,
      filesystemWritePerformed: false,
      productWritePerformed: false,
      fixtureBackupCreated: false,
      fixtureAtomicWriteExecuted: false,
      fixtureRecoverySnapshotCreated: false,
      fixtureReceiptPersisted: false,
      durableReceiptClaimed: false,
      productApplyReceiptClaimed: false,
      sourceFixtureTempRenameResultHash: 'rename-result-hash',
      sourceFixtureTextWriteResultHash: 'text-write-result-hash',
      canonicalHash: 'accepted-001l-decision-hash',
    }],
  };
}

function primitiveEvidence(canonicalHash, input) {
  const evidence = {
    evidenceKind: input.evidenceKind,
    basename: input.basename,
    sourceHash: canonicalHash({ basename: input.basename, text: input.text }),
    observedPatterns: uniqueStrings(input.observedPatterns),
    existingTestBasenames: uniqueStrings(input.existingTestBasenames),
  };
  return {
    ...evidence,
    evidenceHash: canonicalHash(evidence),
  };
}

function testEvidence(canonicalHash, input) {
  const evidence = {
    testBasename: input.testBasename,
    sourceHash: canonicalHash({ testBasename: input.testBasename, text: input.text }),
    observedAssertions: uniqueStrings(input.observedAssertions),
  };
  return {
    ...evidence,
    evidenceHash: canonicalHash(evidence),
  };
}

async function acceptedEvidencePacket() {
  const { canonicalHash } = await loadKernel();
  const backupText = sourceText('src', 'utils', 'backupManager.js');
  const atomicText = sourceText('src', 'io', 'markdown', 'atomicWriteFile.mjs');
  const recoveryText = sourceText('src', 'io', 'markdown', 'snapshotFile.mjs');
  const recoveryAtomicTestText = sourceText('test', 'contracts', 'recovery-atomic-write.contract.test.js');
  const recoveryReplayTestText = sourceText('test', 'contracts', 'recovery-replay.contract.test.js');
  const recoverySnapshotTestText = sourceText('test', 'contracts', 'recovery-snapshot-fallback.contract.test.js');
  const existingTestBasenames = [
    'recovery-atomic-write.contract.test.js',
    'recovery-replay.contract.test.js',
    'recovery-snapshot-fallback.contract.test.js',
  ];
  return {
    packetKind: 'EXACT_TEXT_PRODUCT_STORAGE_PRIMITIVE_EVIDENCE_PACKET_001M',
    acceptedBinding: 'EXACT_TEXT_APPLY_TEST_FIXTURE_RECEIPT_FILE_OBSERVATION_001L',
    productWriteRequested: false,
    productWriteClaimed: false,
    productStorageIntegrationClaimed: false,
    productStorageAdapterIntegrated: false,
    productStorageSafetyClaimed: false,
    productAtomicityClaimed: false,
    atomicWriteExecuted: false,
    recoveryClaimed: false,
    recoverySnapshotCreated: false,
    crashRecoveryClaimed: false,
    durableReceiptClaimed: false,
    applyReceiptImplemented: false,
    productApplyReceiptClaimed: false,
    staticPrimitiveEvidence: [
      primitiveEvidence(canonicalHash, {
        evidenceKind: 'BACKUP_PRIMITIVE_CANDIDATE',
        basename: 'backupManager.js',
        text: backupText,
        observedPatterns: ['createBackup', 'atomic_write_helper'],
        existingTestBasenames,
      }),
      primitiveEvidence(canonicalHash, {
        evidenceKind: 'ATOMIC_WRITE_PRIMITIVE_CANDIDATE',
        basename: 'atomicWriteFile.mjs',
        text: atomicText,
        observedPatterns: ['atomicWriteFile', 'atomic_rename_helper'],
        existingTestBasenames: ['recovery-atomic-write.contract.test.js'],
      }),
      primitiveEvidence(canonicalHash, {
        evidenceKind: 'RECOVERY_PRIMITIVE_CANDIDATE',
        basename: 'snapshotFile.mjs',
        text: recoveryText,
        observedPatterns: ['createRecoverySnapshot', 'listRecoverySnapshots'],
        existingTestBasenames: ['recovery-replay.contract.test.js', 'recovery-snapshot-fallback.contract.test.js'],
      }),
    ],
    denylistPrimitiveEvidence: [
      { basename: 'fileManager.js', editedInCurrentContour: false },
      { basename: 'backupManager.js', editedInCurrentContour: false },
      { basename: 'atomicWriteFile.mjs', editedInCurrentContour: false },
      { basename: 'hostilePackageGate.mjs', editedInCurrentContour: false },
    ],
    existingTestEvidence: [
      testEvidence(canonicalHash, {
        testBasename: 'recovery-atomic-write.contract.test.js',
        text: recoveryAtomicTestText,
        observedAssertions: ['partial write never mutates committed target', 'atomicWriteFile'],
      }),
      testEvidence(canonicalHash, {
        testBasename: 'recovery-replay.contract.test.js',
        text: recoveryReplayTestText,
        observedAssertions: ['repeated replay over same artifacts', 'replayMarkdownRecovery'],
      }),
      testEvidence(canonicalHash, {
        testBasename: 'recovery-snapshot-fallback.contract.test.js',
        text: recoverySnapshotTestText,
        observedAssertions: ['corruption falls back to latest snapshot', 'createRecoverySnapshot'],
      }),
    ],
  };
}

async function accepted001MResult() {
  const { compileExactTextProductStoragePrimitiveEvidenceGate } = await loadKernel();
  return compileExactTextProductStoragePrimitiveEvidenceGate({
    fixtureReceiptFileObservationResult: acceptedFixtureReceiptFileObservationResult(),
    evidencePacket: await acceptedEvidencePacket(),
  });
}

async function withElectronDocumentsStub(documentsPath, callback) {
  const originalLoad = Module._load;
  const fileManagerPath = path.join(process.cwd(), 'src', 'utils', 'fileManager.js');
  const backupManagerPath = path.join(process.cwd(), 'src', 'utils', 'backupManager.js');
  delete require.cache[require.resolve(fileManagerPath)];
  delete require.cache[require.resolve(backupManagerPath)];
  Module._load = function loadWithElectronStub(request, parent, isMain) {
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

function assertInsideRoot(root, candidate) {
  const relative = path.relative(root, candidate);
  assert.equal(relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative)), true, candidate);
}

async function listFiles(root) {
  const out = [];
  async function walk(current) {
    const entries = await fsp.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const next = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(next);
      } else {
        out.push(next);
      }
    }
  }
  await walk(root);
  return out.sort();
}

async function acceptedExecutionPacket(overrides = {}) {
  const { canonicalHash } = await loadKernel();
  const beforeText = 'old text';
  const afterText = 'new text';
  const fixtureRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'craftsman-001n-'));
  const documentsPath = path.join(fixtureRoot, 'documents');
  const backupBasePath = path.join(fixtureRoot, 'backup-base');
  const targetPath = path.join(fixtureRoot, 'scene-1.txt');
  let backupContentMatches = false;
  let atomicWriteContentMatches = false;
  let allWrittenPathsInsideFixtureRoot = false;
  let cleanupSucceeded = false;
  try {
    await fsp.mkdir(documentsPath, { recursive: true });
    await fsp.writeFile(targetPath, beforeText, 'utf8');
    await withElectronDocumentsStub(documentsPath, async ({ fileManager, backupManager }) => {
      const backupResult = await backupManager.createBackup(targetPath, beforeText, { basePath: backupBasePath });
      assert.equal(backupResult.success, true);
      const writeResult = await fileManager.writeFileAtomic(targetPath, afterText);
      assert.equal(writeResult.success, true);
    });
    const files = await listFiles(fixtureRoot);
    for (const file of files) {
      assertInsideRoot(fixtureRoot, file);
    }
    const backupFiles = files.filter((file) => path.basename(file) !== 'meta.json' && file.includes(`${path.sep}backups${path.sep}`));
    assert.equal(backupFiles.length, 1);
    backupContentMatches = fs.readFileSync(backupFiles[0], 'utf8') === beforeText;
    atomicWriteContentMatches = fs.readFileSync(targetPath, 'utf8') === afterText;
    allWrittenPathsInsideFixtureRoot = true;
  } finally {
    await fsp.rm(fixtureRoot, { recursive: true, force: true });
    cleanupSucceeded = !fs.existsSync(fixtureRoot);
  }

  const evidenceCore = {
    observationKind: 'EXACT_TEXT_TEST_ONLY_STORAGE_PRIMITIVE_EXECUTION_OBSERVATION_001N',
    fixtureRootHash: canonicalHash({ kind: 'fixture-root', rootKind: 'OS_TEMP_FIXTURE' }),
    backupFileHash: canonicalHash({ kind: 'backup-file', text: beforeText }),
    atomicTargetHash: canonicalHash({ kind: 'atomic-target', text: afterText }),
    backupContentMatched: backupContentMatches,
    atomicWriteContentMatched: atomicWriteContentMatches,
    allWrittenPathsInsideFixtureRoot,
  };

  return {
    packetKind: 'EXACT_TEXT_TEST_ONLY_STORAGE_PRIMITIVE_EXECUTION_PACKET_001N',
    testOnly: true,
    evidenceLayerOnly: true,
    productAdmission: false,
    testOnlyStoragePrimitiveExecutionObserved: true,
    backupManagerExecutedInFixture: true,
    fileManagerAtomicWriteExecutedInFixture: true,
    backupBasePathExplicit: true,
    backupBasePathOmitted: false,
    backupBasePathInsideFixtureRoot: true,
    atomicWriteTargetInsideFixtureRoot: true,
    allWrittenPathsInsideFixtureRoot,
    hashObservationsMatch: backupContentMatches && atomicWriteContentMatches,
    backupContentMatches,
    atomicWriteContentMatches,
    fixtureRootCleanupObserved: true,
    fixtureRootCleanupSucceeded: cleanupSucceeded,
    testOnlyElectronStubProvided: true,
    electronStubDocumentsPathKind: 'OS_TEMP_FIXTURE',
    electronStubRealDocumentsPath: false,
    documentsPathOutsideFixture: false,
    productRootAccess: false,
    productPathAccess: false,
    repoRootAccess: false,
    absolutePathEscape: false,
    pathTraversal: false,
    productWritePerformed: false,
    productWriteClaimed: false,
    productStorageSafetyClaimed: false,
    durableReceiptClaimed: false,
    applyReceiptImplemented: false,
    productApplyReceiptClaimed: false,
    recoveryClaimed: false,
    crashRecoveryClaimed: false,
    applyTxnClaimed: false,
    publicSurfaceClaimed: false,
    docxImportClaimed: false,
    uiChanged: false,
    networkUsed: false,
    dependencyChanged: false,
    storagePrimitiveChanged: false,
    storageImportsAdded: false,
    productionStorageImportAdded: false,
    fixtureRootHash: evidenceCore.fixtureRootHash,
    backupObservationHash: evidenceCore.backupFileHash,
    atomicWriteObservationHash: evidenceCore.atomicTargetHash,
    cleanupObservationHash: canonicalHash({ kind: 'cleanup', cleanupSucceeded }),
    backupManagerSourceHash: canonicalHash({ basename: 'backupManager.js', text: sourceText('src', 'utils', 'backupManager.js') }),
    fileManagerSourceHash: canonicalHash({ basename: 'fileManager.js', text: sourceText('src', 'utils', 'fileManager.js') }),
    ...overrides,
  };
}

test('001N accepts one test-only storage primitive execution decision and no product dry run admission', async () => {
  const { compileExactTextTestOnlyStoragePrimitiveExecutionHarness } = await loadKernel();
  const productStoragePrimitiveEvidenceGateResult = await accepted001MResult();
  const executionPacket = await acceptedExecutionPacket();
  const first = compileExactTextTestOnlyStoragePrimitiveExecutionHarness({
    productStoragePrimitiveEvidenceGateResult,
    executionPacket,
  });
  const second = compileExactTextTestOnlyStoragePrimitiveExecutionHarness({
    productStoragePrimitiveEvidenceGateResult,
    executionPacket,
  });

  assert.deepEqual(first, second);
  assert.equal(first.resultKind, 'EXACT_TEXT_TEST_ONLY_STORAGE_PRIMITIVE_EXECUTION_HARNESS_RESULT');
  assert.equal(first.contractOnly, true);
  assert.equal(first.testOnly, true);
  assert.equal(first.evidenceLayerOnly, true);
  assert.equal(first.productAdmission, false);
  assert.equal(first.testOnlyStoragePrimitiveExecutionAdmitted, true);
  assert.equal(first.outputDecision, 'TEST_ONLY_STORAGE_PRIMITIVE_EXECUTION_EVIDENCE_ADMITTED');
  assert.equal(first.nextDecisionAfterPass, 'OWNER_MAY_PLAN_SEPARATE_PRODUCT_SHAPED_DRY_RUN_CONTOUR');
  assert.equal(first.productStorageDryRunAdmitted, false);
  assert.equal(first.productDryRunAdmittedByItself, false);
  assert.equal(first.productStorageDryRunAdmittedByThisContour, false);
  assert.equal(first.productWritePerformed, false);
  assert.equal(first.productStorageSafetyClaimed, false);
  assert.equal(first.applyReceiptImplemented, false);
  assert.equal(first.applyTxnClaimed, false);
  assert.equal(first.publicSurfaceClaimed, false);
  assert.deepEqual(first.blockedReasons, []);
  assert.equal(first.testOnlyStoragePrimitiveExecutionDecisions.length, 1);

  const decision = first.testOnlyStoragePrimitiveExecutionDecisions[0];
  assert.equal(decision.outputDecision, 'TEST_ONLY_STORAGE_PRIMITIVE_EXECUTION_EVIDENCE_ADMITTED');
  assert.equal(decision.productStorageDryRunAdmitted, false);
  assert.equal(decision.productDryRunAdmittedByItself, false);
  assert.equal(decision.productStorageDryRunAdmittedByThisContour, false);
  assert.equal(decision.sourcePrimitiveEvidenceGateResultHash, productStoragePrimitiveEvidenceGateResult.canonicalHash);
  assert.equal(decision.fixtureRootHash, executionPacket.fixtureRootHash);
  assert.equal(decision.backupObservationHash, executionPacket.backupObservationHash);
  assert.equal(decision.atomicWriteObservationHash, executionPacket.atomicWriteObservationHash);
});

test('001N blocks missing or contaminated 001M binding', async () => {
  const { compileExactTextTestOnlyStoragePrimitiveExecutionHarness, REASON_CODES } = await loadKernel();
  const executionPacket = await acceptedExecutionPacket();
  const missing = compileExactTextTestOnlyStoragePrimitiveExecutionHarness({ executionPacket });
  assert.equal(missing.testOnlyStoragePrimitiveExecutionAdmitted, false);
  assert.deepEqual(missing.testOnlyStoragePrimitiveExecutionDecisions, []);
  assert.equal(missing.blockedReasons.includes(REASON_CODES.PRODUCT_STORAGE_PRIMITIVE_EVIDENCE_MISSING), true);

  const contaminated = compileExactTextTestOnlyStoragePrimitiveExecutionHarness({
    productStoragePrimitiveEvidenceGateResult: {
      ...(await accepted001MResult()),
      productWritePerformed: true,
    },
    executionPacket,
  });
  assert.equal(contaminated.testOnlyStoragePrimitiveExecutionAdmitted, false);
  assert.deepEqual(contaminated.testOnlyStoragePrimitiveExecutionDecisions, []);
  assert.equal(contaminated.blockedReasons.includes(REASON_CODES.PRODUCT_STORAGE_PRIMITIVE_EVIDENCE_MISSING), true);
});

test('001N blocks unsafe execution evidence variants', async () => {
  const { compileExactTextTestOnlyStoragePrimitiveExecutionHarness, REASON_CODES } = await loadKernel();
  const productStoragePrimitiveEvidenceGateResult = await accepted001MResult();
  const cases = [
    [REASON_CODES.ELECTRON_STUB_REQUIRED, { testOnlyElectronStubProvided: false }],
    [REASON_CODES.REAL_DOCUMENTS_PATH_FORBIDDEN, { electronStubRealDocumentsPath: true }],
    [REASON_CODES.REAL_DOCUMENTS_PATH_FORBIDDEN, { documentsPathOutsideFixture: true }],
    [REASON_CODES.BACKUP_BASE_PATH_REQUIRED, { backupBasePathExplicit: false }],
    [REASON_CODES.BACKUP_BASE_PATH_REQUIRED, { backupBasePathOmitted: true }],
    [REASON_CODES.PRODUCT_ROOT_FORBIDDEN, { productRootAccess: true }],
    [REASON_CODES.PRODUCT_PATH_FORBIDDEN, { repoRootAccess: true }],
    [REASON_CODES.ABSOLUTE_PATH_ESCAPE_FORBIDDEN, { absolutePathEscape: true }],
    [REASON_CODES.PATH_TRAVERSAL_FORBIDDEN, { pathTraversal: true }],
    [REASON_CODES.HASH_OBSERVATION_MISMATCH, { backupContentMatches: false }],
    [REASON_CODES.HASH_OBSERVATION_MISMATCH, { atomicWriteContentMatches: false }],
    [REASON_CODES.FIXTURE_CLEANUP_REQUIRED, { fixtureRootCleanupSucceeded: false }],
    [REASON_CODES.PUBLIC_SURFACE_FORBIDDEN_IN_CONTOUR, { publicSurfaceClaimed: true }],
    [REASON_CODES.RECEIPT_CONTRACT_MISMATCH, { applyReceiptImplemented: true }],
    [REASON_CODES.RECEIPT_CONTRACT_MISMATCH, { productApplyReceiptClaimed: true }],
    [REASON_CODES.STRUCTURAL_AUTO_APPLY_FORBIDDEN, { applyTxnClaimed: true }],
    [REASON_CODES.PRODUCTION_STORAGE_IMPORT_FORBIDDEN, { storagePrimitiveChanged: true }],
    [REASON_CODES.PRODUCTION_STORAGE_IMPORT_FORBIDDEN, { storageImportsAdded: true }],
    [REASON_CODES.PRODUCTION_STORAGE_IMPORT_FORBIDDEN, { productionStorageImportAdded: true }],
    [REASON_CODES.DEPENDENCY_FORBIDDEN, { dependencyChanged: true }],
  ];

  for (const [reasonCode, override] of cases) {
    const result = compileExactTextTestOnlyStoragePrimitiveExecutionHarness({
      productStoragePrimitiveEvidenceGateResult,
      executionPacket: await acceptedExecutionPacket(override),
    });
    assert.equal(result.testOnlyStoragePrimitiveExecutionAdmitted, false, reasonCode);
    assert.deepEqual(result.testOnlyStoragePrimitiveExecutionDecisions, [], reasonCode);
    assert.equal(result.blockedReasons.includes(reasonCode), true, reasonCode);
  }
});

test('001N task record is honest about test-only scope and delivery pending', () => {
  const taskText = sourceText('docs', 'tasks', TASK_BASENAME);
  assert.match(taskText, /STATUS: IMPLEMENTED_LOCALLY_PENDING_DELIVERY_VERIFICATION/u);
  assert.match(taskText, /TEST_ONLY: true/u);
  assert.match(taskText, /PRODUCT_ADMISSION: false/u);
  assert.match(taskText, /PRODUCT_STORAGE_DRY_RUN_ADMITTED_BY_THIS_CONTOUR: false/u);
  assert.match(taskText, /THIS_DOES_NOT_ADMIT_PRODUCT_STORAGE_DRY_RUN_BY_ITSELF: true/u);
  assert.match(taskText, /RECOVERY_TESTS_ARE_REGRESSION_ONLY_NOT_RECOVERY_CLAIM: true/u);
  assert.match(taskText, /COMMIT_SHA: pending/u);
  assert.match(taskText, /PUSH_RESULT: pending/u);
  assert.match(taskText, /PR_RESULT: pending/u);
  assert.match(taskText, /MERGE_RESULT: pending/u);
  assert.doesNotMatch(taskText, /product storage safety proven|ApplyReceipt implemented|ApplyTxn implemented|crash recovery proven|public API exposed|DOCX runtime enabled/iu);
});

test('001N changed scope stays allowlisted and production kernel does not import storage primitives', () => {
  const changedBasenames = changedBasenamesForCurrentContour();
  const allowlist = new Set([
    'reviewIrKernel.mjs',
    'exactTextApplyTestOnlyStoragePrimitiveExecutionHarness.contract.test.js',
    'exactTextApplyTestOnlyProductShapedStorageDryRun.contract.test.js',
    'exactTextApplyProductApplyReadinessReview.contract.test.js',
    'exactTextApplyProductApplyAdmissionGate.contract.test.js',
    'exactTextApplyProductStoragePrimitiveEvidence.contract.test.js',
    'exactTextApplyTestFixtureReceiptFile.contract.test.js',
    'revision-bridge-pre-stage-00-admission-guard-state.mjs',
    'EXACT_TEXT_APPLY_TEST_ONLY_PRODUCT_SHAPED_STORAGE_DRY_RUN_001O.md',
    'EXACT_TEXT_APPLY_PRODUCT_APPLY_READINESS_REVIEW_001P.md',
    'EXACT_TEXT_APPLY_PRODUCT_APPLY_ADMISSION_GATE_001Q.md',
    TASK_BASENAME,
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
  ]);
  assert.notDeepEqual(changedBasenames, [], '001N must have detectable changed scope');
  for (const basename of changedBasenames) {
    assert.equal(allowlist.has(basename), true, `unexpected 001N changed basename: ${basename}`);
    assert.equal(denylist.has(basename), false, `denylisted 001N changed basename: ${basename}`);
  }

  const moduleText = sourceText('src', 'revisionBridge', MODULE_BASENAME);
  const forbiddenProductionImportPatterns = [
    /from\s+['"][^'"]*backupManager[^'"]*['"]/u,
    /from\s+['"][^'"]*fileManager[^'"]*['"]/u,
    /require\s*\(\s*['"][^'"]*backupManager[^'"]*['"]\s*\)/u,
    /require\s*\(\s*['"][^'"]*fileManager[^'"]*['"]\s*\)/u,
    /from\s+['"]electron['"]/u,
    /require\s*\(\s*['"]electron['"]\s*\)/u,
  ];
  for (const pattern of forbiddenProductionImportPatterns) {
    assert.equal(pattern.test(moduleText), false, `forbidden production import pattern: ${pattern.source}`);
  }
});

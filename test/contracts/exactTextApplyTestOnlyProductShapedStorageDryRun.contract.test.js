const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const MODULE_BASENAME = 'reviewIrKernel.mjs';
const TASK_BASENAME = 'EXACT_TEXT_APPLY_TEST_ONLY_PRODUCT_SHAPED_STORAGE_DRY_RUN_001O.md';

async function loadKernel() {
  return import(pathToFileURL(path.join(process.cwd(), 'src', 'revisionBridge', MODULE_BASENAME)).href);
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

function accepted001NResult(canonicalHash) {
  const decisionCore = {
    testOnlyStoragePrimitiveExecutionDecisionKind: 'EXACT_TEXT_TEST_ONLY_STORAGE_PRIMITIVE_EXECUTION_HARNESS_DECISION',
    outputDecision: 'TEST_ONLY_STORAGE_PRIMITIVE_EXECUTION_EVIDENCE_ADMITTED',
    nextDecisionAfterPass: 'OWNER_MAY_PLAN_SEPARATE_PRODUCT_SHAPED_DRY_RUN_CONTOUR',
    acceptedBinding: 'EXACT_TEXT_APPLY_PRODUCT_STORAGE_PRIMITIVE_EVIDENCE_GATE_001M',
    testOnly: true,
    evidenceLayerOnly: true,
    productAdmission: false,
    productStorageDryRunAdmitted: false,
    productDryRunAdmittedByItself: false,
    productStorageDryRunAdmittedByThisContour: false,
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
    storageImportsAdded: false,
    storagePrimitiveChanged: false,
    sourcePrimitiveEvidenceGateResultHash: canonicalHash({ source: '001m-result' }),
    sourcePrimitiveEvidenceGateDecisionHash: canonicalHash({ source: '001m-decision' }),
    fixtureRootHash: canonicalHash({ source: '001n-fixture-root' }),
    backupObservationHash: canonicalHash({ source: '001n-backup-observation' }),
    atomicWriteObservationHash: canonicalHash({ source: '001n-atomic-write-observation' }),
    cleanupObservationHash: canonicalHash({ source: '001n-cleanup-observation' }),
    backupManagerSourceHash: canonicalHash({ basename: 'backupManager.js', source: '001n' }),
    fileManagerSourceHash: canonicalHash({ basename: 'fileManager.js', source: '001n' }),
  };
  const decision = {
    ...decisionCore,
    canonicalHash: canonicalHash(decisionCore),
  };
  const resultCore = {
    resultKind: 'EXACT_TEXT_TEST_ONLY_STORAGE_PRIMITIVE_EXECUTION_HARNESS_RESULT',
    contractOnly: true,
    testOnly: true,
    evidenceLayerOnly: true,
    productAdmission: false,
    testOnlyStoragePrimitiveExecutionAdmitted: true,
    outputDecision: 'TEST_ONLY_STORAGE_PRIMITIVE_EXECUTION_EVIDENCE_ADMITTED',
    nextDecisionAfterPass: 'OWNER_MAY_PLAN_SEPARATE_PRODUCT_SHAPED_DRY_RUN_CONTOUR',
    productStorageDryRunAdmitted: false,
    productDryRunAdmittedByItself: false,
    productStorageDryRunAdmittedByThisContour: false,
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
    storageImportsAdded: false,
    storagePrimitiveChanged: false,
    recoveryTestsRegressionOnly: true,
    hostilePackageTestsRegressionOnly: true,
    admissionGuardScopeOnly: true,
    blockedReasons: [],
    testOnlyStoragePrimitiveExecutionDecisions: [decision],
  };
  return {
    ...resultCore,
    canonicalHash: canonicalHash(resultCore),
  };
}

function acceptedDryRunPacket(canonicalHash, overrides = {}) {
  const fixtureCore = {
    fixtureProjectRoot: 'OS_TEMP_FIXTURE_PROJECT_ROOT',
    fixtureSceneFile: 'scene-001.txt',
    fixtureManifestStub: 'INERT_FIXTURE_MANIFEST_STUB',
    beforeText: 'old text',
    afterText: 'new text',
  };
  return {
    packetKind: 'EXACT_TEXT_TEST_ONLY_PRODUCT_SHAPED_STORAGE_DRY_RUN_PACKET_001O',
    testOnly: true,
    productShapedFixtureOnly: true,
    productShapedStorageDryRunObserved: true,
    osTempFixtureRootOnly: true,
    fixtureProjectRootInsideTempRoot: true,
    fixtureProjectRootIsProductRoot: false,
    fixtureSceneFileOnly: true,
    fixtureManifestStubProvided: true,
    fixtureManifestStubInert: true,
    fixtureManifestStubPersisted: false,
    fixtureManifestStubReusedAsProjectTruth: false,
    projectIdTestPassed: true,
    sceneIdTestPassed: true,
    baselineHashTestPassed: true,
    blockVersionHashTestPassed: true,
    exactTextGuardPassed: true,
    sessionOpenTestPassed: true,
    fixtureBackupObserved: true,
    fixtureAtomicWriteObserved: true,
    testOnlyDryRunReceiptObservationEmitted: true,
    dryRunReceiptPathInsideFixtureRoot: true,
    dryRunReceiptPathOutsideFixture: false,
    allDryRunPathsInsideFixtureRoot: true,
    afterWriteHashMatches: true,
    cleanupObserved: true,
    cleanupSucceeded: true,
    productRootAccess: false,
    productPathAccess: false,
    repoRootAccess: false,
    absolutePathEscape: false,
    pathTraversal: false,
    productApplyAdmissionClaimed: false,
    productApplyAdmitted: false,
    productAdmission: false,
    productWritePerformed: false,
    productWriteClaimed: false,
    manuscriptMutationPerformed: false,
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
    commentApplyClaimed: false,
    structuralApplyClaimed: false,
    multiSceneApplyClaimed: false,
    fixtureProjectRootHash: canonicalHash({ ...fixtureCore, part: 'fixture-project-root' }),
    fixtureSceneFileHash: canonicalHash({ ...fixtureCore, part: 'fixture-scene-file' }),
    fixtureManifestStubHash: canonicalHash({ ...fixtureCore, part: 'fixture-manifest-stub' }),
    fixtureBackupObservationHash: canonicalHash({ ...fixtureCore, part: 'fixture-backup-observation' }),
    fixtureAtomicWriteObservationHash: canonicalHash({ ...fixtureCore, part: 'fixture-atomic-write-observation' }),
    testOnlyDryRunReceiptObservationHash: canonicalHash({ ...fixtureCore, part: 'test-only-dry-run-receipt-observation' }),
    cleanupObservationHash: canonicalHash({ ...fixtureCore, part: 'cleanup-observation' }),
    ...overrides,
  };
}

test('001O admits one test-only product-shaped dry run decision without product apply admission', async () => {
  const { compileExactTextTestOnlyProductShapedStorageDryRun, canonicalHash } = await loadKernel();
  const testOnlyStoragePrimitiveExecutionHarnessResult = accepted001NResult(canonicalHash);
  const dryRunPacket = acceptedDryRunPacket(canonicalHash);
  const first = compileExactTextTestOnlyProductShapedStorageDryRun({
    testOnlyStoragePrimitiveExecutionHarnessResult,
    dryRunPacket,
  });
  const second = compileExactTextTestOnlyProductShapedStorageDryRun({
    testOnlyStoragePrimitiveExecutionHarnessResult,
    dryRunPacket,
  });

  assert.deepEqual(first, second);
  assert.equal(first.resultKind, 'EXACT_TEXT_TEST_ONLY_PRODUCT_SHAPED_STORAGE_DRY_RUN_RESULT');
  assert.equal(first.contractOnly, true);
  assert.equal(first.testOnly, true);
  assert.equal(first.productShapedFixtureOnly, true);
  assert.equal(first.productAdmission, false);
  assert.equal(first.testOnlyProductShapedDryRunEvidenceAdmitted, true);
  assert.equal(first.outputDecision, 'TEST_ONLY_PRODUCT_SHAPED_DRY_RUN_EVIDENCE_ADMITTED');
  assert.equal(first.nextDecisionAfterPass, 'OWNER_MAY_PLAN_PRODUCT_APPLY_READINESS_REVIEW_001P');
  assert.equal(first.productApplyAdmissionClaimed, false);
  assert.equal(first.productApplyAdmitted, false);
  assert.equal(first.productStorageDryRunAdmitted, false);
  assert.equal(first.productStorageSafetyClaimed, false);
  assert.equal(first.productWritePerformed, false);
  assert.equal(first.manuscriptMutationPerformed, false);
  assert.equal(first.durableReceiptClaimed, false);
  assert.equal(first.applyReceiptImplemented, false);
  assert.equal(first.productApplyReceiptClaimed, false);
  assert.equal(first.recoveryClaimed, false);
  assert.equal(first.applyTxnClaimed, false);
  assert.equal(first.publicSurfaceClaimed, false);
  assert.equal(first.docxImportClaimed, false);
  assert.equal(first.uiChanged, false);
  assert.equal(first.networkUsed, false);
  assert.equal(first.dependencyChanged, false);
  assert.equal(first.fixtureManifestStubInert, true);
  assert.equal(first.fixtureManifestStubPersisted, false);
  assert.equal(first.fixtureManifestStubReusedAsProjectTruth, false);
  assert.deepEqual(first.blockedReasons, []);
  assert.equal(first.testOnlyProductShapedDryRunDecisions.length, 1);

  const decision = first.testOnlyProductShapedDryRunDecisions[0];
  assert.equal(decision.outputDecision, 'TEST_ONLY_PRODUCT_SHAPED_DRY_RUN_EVIDENCE_ADMITTED');
  assert.equal(decision.acceptedBinding, 'EXACT_TEXT_APPLY_TEST_ONLY_STORAGE_PRIMITIVE_EXECUTION_HARNESS_001N');
  assert.equal(decision.productApplyAdmissionClaimed, false);
  assert.equal(decision.productApplyAdmitted, false);
  assert.equal(decision.productStorageDryRunAdmitted, false);
  assert.equal(decision.productStorageSafetyClaimed, false);
  assert.equal(decision.sourceTestOnlyStoragePrimitiveExecutionResultHash, testOnlyStoragePrimitiveExecutionHarnessResult.canonicalHash);
  assert.equal(decision.fixtureManifestStubHash, dryRunPacket.fixtureManifestStubHash);
  assert.equal(decision.testOnlyDryRunReceiptObservationHash, dryRunPacket.testOnlyDryRunReceiptObservationHash);
});

test('001O blocks missing or contaminated 001N binding', async () => {
  const { compileExactTextTestOnlyProductShapedStorageDryRun, canonicalHash, REASON_CODES } = await loadKernel();
  const dryRunPacket = acceptedDryRunPacket(canonicalHash);
  const missing = compileExactTextTestOnlyProductShapedStorageDryRun({ dryRunPacket });
  assert.equal(missing.testOnlyProductShapedDryRunEvidenceAdmitted, false);
  assert.deepEqual(missing.testOnlyProductShapedDryRunDecisions, []);
  assert.equal(missing.blockedReasons.includes(REASON_CODES.TEST_ONLY_STORAGE_PRIMITIVE_EXECUTION_EVIDENCE_MISSING), true);

  const contaminated = compileExactTextTestOnlyProductShapedStorageDryRun({
    testOnlyStoragePrimitiveExecutionHarnessResult: {
      ...accepted001NResult(canonicalHash),
      productStorageDryRunAdmitted: true,
    },
    dryRunPacket,
  });
  assert.equal(contaminated.testOnlyProductShapedDryRunEvidenceAdmitted, false);
  assert.deepEqual(contaminated.testOnlyProductShapedDryRunDecisions, []);
  assert.equal(contaminated.blockedReasons.includes(REASON_CODES.TEST_ONLY_STORAGE_PRIMITIVE_EXECUTION_EVIDENCE_MISSING), true);

  const weakDecisionBinding = accepted001NResult(canonicalHash);
  delete weakDecisionBinding.testOnlyStoragePrimitiveExecutionDecisions[0].backupManagerSourceHash;
  const weak = compileExactTextTestOnlyProductShapedStorageDryRun({
    testOnlyStoragePrimitiveExecutionHarnessResult: weakDecisionBinding,
    dryRunPacket,
  });
  assert.equal(weak.testOnlyProductShapedDryRunEvidenceAdmitted, false);
  assert.deepEqual(weak.testOnlyProductShapedDryRunDecisions, []);
  assert.equal(weak.blockedReasons.includes(REASON_CODES.TEST_ONLY_STORAGE_PRIMITIVE_EXECUTION_EVIDENCE_MISSING), true);
});

test('001O blocks unsafe product-shaped dry run requirement variants', async () => {
  const { compileExactTextTestOnlyProductShapedStorageDryRun, canonicalHash, REASON_CODES } = await loadKernel();
  const testOnlyStoragePrimitiveExecutionHarnessResult = accepted001NResult(canonicalHash);
  const cases = [
    [REASON_CODES.TEST_ONLY_PRODUCT_SHAPED_DRY_RUN_EVIDENCE_MISSING, { productShapedStorageDryRunObserved: false }],
    [REASON_CODES.TEST_ONLY_PRODUCT_SHAPED_DRY_RUN_EVIDENCE_MISSING, { osTempFixtureRootOnly: false }],
    [REASON_CODES.TEST_ONLY_PRODUCT_SHAPED_DRY_RUN_EVIDENCE_MISSING, { fixtureManifestStubInert: undefined }],
    [REASON_CODES.FIXTURE_MANIFEST_TRUTH_ESCALATION_FORBIDDEN, { fixtureManifestStubPersisted: true }],
    [REASON_CODES.FIXTURE_MANIFEST_TRUTH_ESCALATION_FORBIDDEN, { fixtureManifestStubReusedAsProjectTruth: true }],
    [REASON_CODES.WRONG_PROJECT, { projectIdTestPassed: false }],
    [REASON_CODES.SCENE_MISMATCH, { sceneIdTestPassed: false }],
    [REASON_CODES.STALE_BASELINE, { baselineHashTestPassed: false }],
    [REASON_CODES.BLOCK_VERSION_MISMATCH, { blockVersionHashTestPassed: false }],
    [REASON_CODES.EXACT_TEXT_MISMATCH, { exactTextGuardPassed: false }],
    [REASON_CODES.CLOSED_SESSION, { sessionOpenTestPassed: false }],
    [REASON_CODES.PRODUCT_ROOT_FORBIDDEN, { productRootAccess: true }],
    [REASON_CODES.PRODUCT_ROOT_FORBIDDEN, { fixtureProjectRootIsProductRoot: true }],
    [REASON_CODES.PRODUCT_PATH_FORBIDDEN, { repoRootAccess: true }],
    [REASON_CODES.ABSOLUTE_PATH_ESCAPE_FORBIDDEN, { absolutePathEscape: true }],
    [REASON_CODES.PATH_TRAVERSAL_FORBIDDEN, { pathTraversal: true }],
    [REASON_CODES.DRY_RUN_RECEIPT_PATH_OUTSIDE_FIXTURE, { dryRunReceiptPathOutsideFixture: true }],
    [REASON_CODES.DRY_RUN_RECEIPT_PATH_OUTSIDE_FIXTURE, { dryRunReceiptPathInsideFixtureRoot: false }],
    [REASON_CODES.HASH_OBSERVATION_MISMATCH, { afterWriteHashMatches: false }],
    [REASON_CODES.FIXTURE_CLEANUP_REQUIRED, { cleanupSucceeded: false }],
  ];

  for (const [reasonCode, override] of cases) {
    const result = compileExactTextTestOnlyProductShapedStorageDryRun({
      testOnlyStoragePrimitiveExecutionHarnessResult,
      dryRunPacket: acceptedDryRunPacket(canonicalHash, override),
    });
    assert.equal(result.testOnlyProductShapedDryRunEvidenceAdmitted, false, reasonCode);
    assert.deepEqual(result.testOnlyProductShapedDryRunDecisions, [], reasonCode);
    assert.equal(result.blockedReasons.includes(reasonCode), true, reasonCode);
  }
});

test('001O blocks forbidden product apply release and integration claims', async () => {
  const { compileExactTextTestOnlyProductShapedStorageDryRun, canonicalHash, REASON_CODES } = await loadKernel();
  const testOnlyStoragePrimitiveExecutionHarnessResult = accepted001NResult(canonicalHash);
  const cases = [
    [REASON_CODES.PRODUCT_APPLY_ADMISSION_FORBIDDEN, { productApplyAdmissionClaimed: true }],
    [REASON_CODES.PRODUCT_APPLY_ADMISSION_FORBIDDEN, { productApplyAdmitted: true }],
    [REASON_CODES.PRODUCT_WRITE_FORBIDDEN_IN_CONTOUR, { productWritePerformed: true }],
    [REASON_CODES.PRODUCT_WRITE_FORBIDDEN_IN_CONTOUR, { manuscriptMutationPerformed: true }],
    [REASON_CODES.STORAGE_INTEGRATION_FORBIDDEN_IN_CONTOUR, { productStorageSafetyClaimed: true }],
    [REASON_CODES.RECEIPT_CONTRACT_MISMATCH, { durableReceiptClaimed: true }],
    [REASON_CODES.RECEIPT_CONTRACT_MISMATCH, { applyReceiptImplemented: true }],
    [REASON_CODES.RECEIPT_CONTRACT_MISMATCH, { productApplyReceiptClaimed: true }],
    [REASON_CODES.RECOVERY_CLAIM_FORBIDDEN_IN_CONTOUR, { recoveryClaimed: true }],
    [REASON_CODES.STRUCTURAL_AUTO_APPLY_FORBIDDEN, { applyTxnClaimed: true }],
    [REASON_CODES.PUBLIC_SURFACE_FORBIDDEN_IN_CONTOUR, { publicSurfaceClaimed: true }],
    [REASON_CODES.SEMANTIC_PARSE_FORBIDDEN, { docxImportClaimed: true }],
    [REASON_CODES.PUBLIC_SURFACE_FORBIDDEN_IN_CONTOUR, { uiChanged: true }],
    [REASON_CODES.NETWORK_FORBIDDEN, { networkUsed: true }],
    [REASON_CODES.DEPENDENCY_FORBIDDEN, { dependencyChanged: true }],
    [REASON_CODES.PRODUCTION_STORAGE_IMPORT_FORBIDDEN, { storagePrimitiveChanged: true }],
    [REASON_CODES.PRODUCTION_STORAGE_IMPORT_FORBIDDEN, { storageImportsAdded: true }],
    [REASON_CODES.COMMENT_APPLY_OUT_OF_SCOPE, { commentApplyClaimed: true }],
    [REASON_CODES.STRUCTURAL_STORAGE_WRITE_BLOCKED, { structuralApplyClaimed: true }],
    [REASON_CODES.MULTI_SCOPE_STORAGE_WRITE_BLOCKED, { multiSceneApplyClaimed: true }],
  ];

  for (const [reasonCode, override] of cases) {
    const result = compileExactTextTestOnlyProductShapedStorageDryRun({
      testOnlyStoragePrimitiveExecutionHarnessResult,
      dryRunPacket: acceptedDryRunPacket(canonicalHash, override),
    });
    assert.equal(result.testOnlyProductShapedDryRunEvidenceAdmitted, false, reasonCode);
    assert.deepEqual(result.testOnlyProductShapedDryRunDecisions, [], reasonCode);
    assert.equal(result.blockedReasons.includes(reasonCode), true, reasonCode);
  }
});

test('001O task record preserves test-only boundary and forbids product claims', () => {
  const taskText = sourceText('docs', 'tasks', TASK_BASENAME);
  assert.match(taskText, /STATUS: IMPLEMENTED_LOCALLY_PENDING_DELIVERY_VERIFICATION/u);
  assert.match(taskText, /TEST_ONLY: true/u);
  assert.match(taskText, /PRODUCT_ADMISSION: false/u);
  assert.match(taskText, /PRODUCT_APPLY_ADMISSION_CLAIMED: false/u);
  assert.match(taskText, /PRODUCT_STORAGE_DRY_RUN_ADMITTED_BY_THIS_CONTOUR: false/u);
  assert.match(taskText, /FIXTURE_MANIFEST_STUB_IS_NOT_PROJECT_TRUTH: true/u);
  assert.match(taskText, /TEST_ONLY_DRY_RUN_RECEIPT_IS_NOT_APPLYRECEIPT: true/u);
  assert.match(taskText, /NEXT_DECISION_AFTER_PASS: OWNER_MAY_PLAN_PRODUCT_APPLY_READINESS_REVIEW_001P/u);
  assert.match(taskText, /COMMIT_SHA: pending/u);
  assert.match(taskText, /PUSH_RESULT: pending/u);
  assert.match(taskText, /PR_RESULT: pending/u);
  assert.match(taskText, /MERGE_RESULT: pending/u);
  assert.doesNotMatch(taskText, /product apply admitted|product storage safety proven|ApplyReceipt implemented|ApplyTxn implemented|crash recovery proven|public API exposed|DOCX runtime enabled/iu);
});

test('001O changed scope stays allowlisted and production kernel does not import storage primitives', () => {
  const changedBasenames = changedBasenamesForCurrentContour();
  const allowlist = new Set([
    'reviewIrKernel.mjs',
    'exactTextApplyInternalWritePrototype.mjs',
    'exactTextApplyFixtureDurableReceiptPrototype.mjs',
    'exactTextApplyPrivateProductApplyReceiptAdmission.mjs',
    'exactTextApplyPrivateProductApplyReceipt.mjs',
    'exactTextApplyWithReceiptAdmission.mjs',
    'exactTextApplyWithReceiptExecution.mjs',
    'exactTextApplyWithReceiptCloseout.mjs',
    'exactTextApplyWithReceiptNextAdmission.mjs',
    'exactTextApplyWithReceiptNextContourAdmission.mjs',
    'exactTextApplyTestOnlyProductShapedStorageDryRun.contract.test.js',
    'exactTextApplyInternalWritePrototype.contract.test.js',
    'exactTextApplyFixtureDurableReceiptPrototype.contract.test.js',
    'exactTextApplyPrivateProductApplyReceiptAdmission.contract.test.js',
    'exactTextApplyPrivateProductApplyReceipt.contract.test.js',
    'exactTextApplyWithReceiptAdmission.contract.test.js',
    'exactTextApplyWithReceiptExecution.contract.test.js',
    'exactTextApplyWithReceiptCloseout.contract.test.js',
    'exactTextApplyWithReceiptNextAdmission.contract.test.js',
    'exactTextApplyWithReceiptNextContourAdmission.contract.test.js',
    'exactTextApplyProductApplyReadinessReview.contract.test.js',
    'exactTextApplyProductApplyAdmissionGate.contract.test.js',
    'exactTextApplyProductStoragePrimitiveEvidence.contract.test.js',
    'exactTextApplyTestFixtureReceiptFile.contract.test.js',
    'exactTextApplyTestOnlyStoragePrimitiveExecutionHarness.contract.test.js',
    'revision-bridge-pre-stage-00-admission-guard-state.mjs',
    'EXACT_TEXT_APPLY_PRODUCT_APPLY_READINESS_REVIEW_001P.md',
    'EXACT_TEXT_APPLY_PRODUCT_APPLY_ADMISSION_GATE_001Q.md',
    'EXACT_TEXT_APPLY_INTERNAL_WRITE_PATH_PROTOTYPE_001R.md',
    'EXACT_TEXT_APPLY_FIXTURE_DURABLE_RECEIPT_AND_FAILURE_RECEIPT_001S.md',
    'PRIVATE_PRODUCT_APPLY_RECEIPT_ADMISSION_001T.md',
    'PRIVATE_PRODUCT_APPLY_RECEIPT_IMPLEMENTATION_001U.md',
    'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_001V.md',
    'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_001W.md',
    'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_CLOSEOUT_001X.md',
    'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_ADMISSION_001Y.md',
    'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_CONTOUR_ADMISSION_001Z.md',
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
  assert.notDeepEqual(changedBasenames, [], '001O must have detectable changed scope');
  for (const basename of changedBasenames) {
    assert.equal(allowlist.has(basename), true, `unexpected 001O changed basename: ${basename}`);
    assert.equal(denylist.has(basename), false, `denylisted 001O changed basename: ${basename}`);
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

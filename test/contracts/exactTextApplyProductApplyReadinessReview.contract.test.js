const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const MODULE_BASENAME = 'reviewIrKernel.mjs';
const TASK_BASENAME = 'EXACT_TEXT_APPLY_PRODUCT_APPLY_READINESS_REVIEW_001P.md';

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
  const decision = { ...decisionCore, canonicalHash: canonicalHash(decisionCore) };
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
  return { ...resultCore, canonicalHash: canonicalHash(resultCore) };
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

async function accepted001OResult(overrides = {}) {
  const {
    canonicalHash,
    compileExactTextTestOnlyProductShapedStorageDryRun,
  } = await loadKernel();
  return compileExactTextTestOnlyProductShapedStorageDryRun({
    testOnlyStoragePrimitiveExecutionHarnessResult: accepted001NResult(canonicalHash),
    dryRunPacket: acceptedDryRunPacket(canonicalHash),
    ...overrides,
  });
}

function acceptedRequirements(overrides = {}) {
  return {
    requirementsKind: 'EXACT_TEXT_PRODUCT_APPLY_READINESS_REQUIREMENTS_MATRIX_001P',
    staticRequirementsOnly: true,
    receiptRequirementsDraftOnly: true,
    productApplyAdmissionAllowed: false,
    productWriteExecutionAllowed: false,
    preconditionRequirements: [
      'PROJECT_ID_TEST',
      'SCENE_ID_TEST',
      'BASELINE_HASH_TEST',
      'BLOCK_VERSION_HASH_TEST',
      'EXACT_TEXT_GUARD',
      'SESSION_OPEN_TEST',
      'LOW_RISK_EXACT_TEXT_ONLY',
      'COMMENT_APPLY_BLOCKED',
      'STRUCTURAL_APPLY_BLOCKED',
      'MULTI_SCENE_APPLY_BLOCKED',
    ],
    staticProductStorageSurfaceRequirements: [
      'BACKUP_BEFORE_WRITE_REQUIRED',
      'ATOMIC_WRITE_REQUIRED',
      'PRODUCT_SAVE_PATH_OWNER_APPROVAL_REQUIRED',
      'NO_STORAGE_PRIMITIVE_EDIT_REQUIRED',
      'NO_PUBLIC_SURFACE_REQUIRED',
      'NO_RUNTIME_PATH_INPUTS_IN_001P',
    ],
    receiptShapeRequirements: [
      'RECEIPT_KIND',
      'PROJECT_ID',
      'SCENE_ID',
      'APPLY_OP_ID',
      'SOURCE_APPLY_OP_HASH',
      'BEFORE_SCENE_HASH',
      'AFTER_SCENE_HASH',
      'BACKUP_OBSERVATION_HASH',
      'ATOMIC_WRITE_OBSERVATION_HASH',
      'PRECONDITION_RESULTS',
      'BLOCKED_REASONS',
      'RUNTIME_SURFACE_FALSE_FLAGS',
    ],
    ...overrides,
  };
}

function acceptedOwnerDecisionPacket(overrides = {}) {
  return {
    packetKind: 'EXACT_TEXT_PRODUCT_APPLY_READINESS_OWNER_DECISION_PACKET_001P',
    localContourOnly: true,
    mayPlan001Q: true,
    requiredOwnerApproval: true,
    requiredTargetBranch: 'OWNER_APPROVED_TARGET_REQUIRED',
    requiredBaseSha: 'OWNER_APPROVED_BASE_SHA_REQUIRED',
    productWriteStillBlocked: true,
    productApplyAdmissionStillBlockedUntil001Q: true,
    releaseGate: false,
    ownerApproved001QWithoutTarget: false,
    ...overrides,
  };
}

async function acceptedReadinessBaseInput(overrides = {}) {
  const { canonicalHash } = await loadKernel();
  return {
    testOnlyStoragePrimitiveExecutionHarnessResult: accepted001NResult(canonicalHash),
    testOnlyProductShapedDryRunResult: await accepted001OResult(),
    requirements: acceptedRequirements(),
    ownerDecisionPacket: acceptedOwnerDecisionPacket(),
    productStorageSurfaceRequirementsAreStaticOnly: true,
    receiptRequirementsAreDraftOnly: true,
    ...overrides,
  };
}

test('001P accepts one pure readiness review decision without product apply admission', async () => {
  const { compileExactTextProductApplyReadinessReview } = await loadKernel();
  const baseInput = await acceptedReadinessBaseInput();
  const first = compileExactTextProductApplyReadinessReview(baseInput);
  const second = compileExactTextProductApplyReadinessReview(baseInput);

  assert.deepEqual(first, second);
  assert.equal(first.resultKind, 'EXACT_TEXT_PRODUCT_APPLY_READINESS_REVIEW_RESULT');
  assert.equal(first.contractOnly, true);
  assert.equal(first.readinessReviewOnly, true);
  assert.equal(first.productApplyReadinessReviewCompleted, true);
  assert.equal(first.outputDecision, 'OWNER_MAY_PLAN_PRODUCT_APPLY_ADMISSION_001Q');
  assert.equal(first.productApplyAdmissionAllowed, false);
  assert.equal(first.productWriteExecutionAllowed, false);
  assert.equal(first.productApplyAdmissionClaimed, false);
  assert.equal(first.productApplyAdmitted, false);
  assert.equal(first.productWritePerformed, false);
  assert.equal(first.manuscriptMutationPerformed, false);
  assert.equal(first.receiptRequirementsAreDraftOnly, true);
  assert.equal(first.receiptRequirementsMarkedImplemented, false);
  assert.equal(first.applyReceiptImplemented, false);
  assert.equal(first.applyTxnClaimed, false);
  assert.equal(first.productStorageSurfaceRequirementsAreStaticOnly, true);
  assert.equal(first.runtimeStorageScanRequested, false);
  assert.equal(first.storagePrimitiveImportOrCall, false);
  assert.equal(first.productSavePathCall, false);
  assert.equal(first.ownerDecisionPacketIsLocalContourOnly, true);
  assert.equal(first.ownerDecisionPacketIsReleaseGate, false);
  assert.deepEqual(first.blockedReasons, []);
  assert.equal(first.productApplyReadinessReviewDecisions.length, 1);

  const decision = first.productApplyReadinessReviewDecisions[0];
  assert.equal(decision.outputDecision, 'OWNER_MAY_PLAN_PRODUCT_APPLY_ADMISSION_001Q');
  assert.equal(decision.acceptedBinding, 'EXACT_TEXT_APPLY_TEST_ONLY_PRODUCT_SHAPED_STORAGE_DRY_RUN_001O');
  assert.equal(decision.productApplyAdmissionAllowed, false);
  assert.equal(decision.productWriteExecutionAllowed, false);
  assert.equal(decision.receiptRequirementsAreDraftOnly, true);
  assert.equal(decision.productStorageSurfaceRequirementsAreStaticOnly, true);
  assert.equal(decision.sourceTestOnlyProductShapedDryRunResultHash, baseInput.testOnlyProductShapedDryRunResult.canonicalHash);
});

test('001P blocks missing weak or contaminated 001O binding', async () => {
  const { compileExactTextProductApplyReadinessReview, canonicalHash, REASON_CODES } = await loadKernel();
  const requirements = acceptedRequirements();
  const ownerDecisionPacket = acceptedOwnerDecisionPacket();
  const baseInput = {
    testOnlyStoragePrimitiveExecutionHarnessResult: accepted001NResult(canonicalHash),
    productStorageSurfaceRequirementsAreStaticOnly: true,
    receiptRequirementsAreDraftOnly: true,
    requirements,
    ownerDecisionPacket,
  };
  const missing = compileExactTextProductApplyReadinessReview(baseInput);
  assert.equal(missing.productApplyReadinessReviewCompleted, false);
  assert.deepEqual(missing.productApplyReadinessReviewDecisions, []);
  assert.equal(missing.blockedReasons.includes(REASON_CODES.PRODUCT_APPLY_READINESS_REVIEW_MISSING), true);

  const contaminated = compileExactTextProductApplyReadinessReview({
    ...baseInput,
    testOnlyProductShapedDryRunResult: {
      ...(await accepted001OResult()),
      productApplyAdmitted: true,
    },
  });
  assert.equal(contaminated.productApplyReadinessReviewCompleted, false);
  assert.deepEqual(contaminated.productApplyReadinessReviewDecisions, []);
  assert.equal(contaminated.blockedReasons.includes(REASON_CODES.PRODUCT_APPLY_READINESS_REVIEW_MISSING), true);

  const weak = await accepted001OResult();
  delete weak.testOnlyProductShapedDryRunDecisions[0].fixtureManifestStubHash;
  const weakResult = compileExactTextProductApplyReadinessReview({
    ...baseInput,
    testOnlyProductShapedDryRunResult: weak,
  });
  assert.equal(weakResult.productApplyReadinessReviewCompleted, false);
  assert.deepEqual(weakResult.productApplyReadinessReviewDecisions, []);
  assert.equal(weakResult.blockedReasons.includes(REASON_CODES.PRODUCT_APPLY_READINESS_REVIEW_MISSING), true);

  const mismatchedSource = compileExactTextProductApplyReadinessReview({
    ...baseInput,
    testOnlyStoragePrimitiveExecutionHarnessResult: {
      ...accepted001NResult(canonicalHash),
      canonicalHash: 'wrong-001n-result-hash',
    },
    testOnlyProductShapedDryRunResult: await accepted001OResult(),
  });
  assert.equal(mismatchedSource.productApplyReadinessReviewCompleted, false);
  assert.deepEqual(mismatchedSource.productApplyReadinessReviewDecisions, []);
  assert.equal(mismatchedSource.blockedReasons.includes(REASON_CODES.PRODUCT_APPLY_READINESS_REVIEW_MISSING), true);
});

test('001P blocks missing requirements and precondition blockers', async () => {
  const { compileExactTextProductApplyReadinessReview, REASON_CODES } = await loadKernel();
  const baseInput = await acceptedReadinessBaseInput();
  const cases = [
    [REASON_CODES.REQUIREMENTS_MATRIX_MISSING, { requirementsKind: 'WRONG_KIND' }],
    [REASON_CODES.REQUIREMENTS_MATRIX_MISSING, { preconditionRequirements: [] }],
    [REASON_CODES.RECEIPT_CAPABILITY_MISSING, { receiptShapeRequirements: [] }],
    [REASON_CODES.WRONG_PROJECT, { preconditionRequirements: acceptedRequirements().preconditionRequirements.filter((item) => item !== 'PROJECT_ID_TEST') }],
    [REASON_CODES.SCENE_MISMATCH, { preconditionRequirements: acceptedRequirements().preconditionRequirements.filter((item) => item !== 'SCENE_ID_TEST') }],
    [REASON_CODES.STALE_BASELINE, { preconditionRequirements: acceptedRequirements().preconditionRequirements.filter((item) => item !== 'BASELINE_HASH_TEST') }],
    [REASON_CODES.BLOCK_VERSION_MISMATCH, { preconditionRequirements: acceptedRequirements().preconditionRequirements.filter((item) => item !== 'BLOCK_VERSION_HASH_TEST') }],
    [REASON_CODES.EXACT_TEXT_MISMATCH, { preconditionRequirements: acceptedRequirements().preconditionRequirements.filter((item) => item !== 'EXACT_TEXT_GUARD') }],
    [REASON_CODES.CLOSED_SESSION, { preconditionRequirements: acceptedRequirements().preconditionRequirements.filter((item) => item !== 'SESSION_OPEN_TEST') }],
    [REASON_CODES.MISSING_PRECONDITION, { preconditionRequirements: acceptedRequirements().preconditionRequirements.filter((item) => item !== 'COMMENT_APPLY_BLOCKED') }],
  ];

  for (const [reasonCode, requirementsOverride] of cases) {
    const result = compileExactTextProductApplyReadinessReview({
      ...baseInput,
      requirements: acceptedRequirements(requirementsOverride),
    });
    assert.equal(result.productApplyReadinessReviewCompleted, false, reasonCode);
    assert.deepEqual(result.productApplyReadinessReviewDecisions, [], reasonCode);
    assert.equal(result.blockedReasons.includes(reasonCode), true, reasonCode);
  }
});

test('001P blocks forbidden claim escalation runtime storage and governance rewrites', async () => {
  const { compileExactTextProductApplyReadinessReview, REASON_CODES } = await loadKernel();
  const baseInput = await acceptedReadinessBaseInput();
  const cases = [
    [REASON_CODES.PRODUCT_APPLY_ADMISSION_FORBIDDEN, { productApplyAdmissionAllowed: true }],
    [REASON_CODES.PRODUCT_APPLY_ADMISSION_FORBIDDEN, { productWriteExecutionAllowed: true }],
    [REASON_CODES.PRODUCT_WRITE_FORBIDDEN_IN_CONTOUR, { productWritePerformed: true }],
    [REASON_CODES.PRODUCT_WRITE_FORBIDDEN_IN_CONTOUR, { productWriteClaimed: true }],
    [REASON_CODES.PRODUCT_WRITE_FORBIDDEN_IN_CONTOUR, { manuscriptMutationPerformed: true }],
    [REASON_CODES.RECEIPT_REQUIREMENTS_ESCALATED_TO_IMPLEMENTATION, { receiptRequirementsAreDraftOnly: false }],
    [REASON_CODES.RECEIPT_REQUIREMENTS_ESCALATED_TO_IMPLEMENTATION, { receiptRequirementsMarkedImplemented: true }],
    [REASON_CODES.RECEIPT_REQUIREMENTS_ESCALATED_TO_IMPLEMENTATION, { applyReceiptImplemented: true }],
    [REASON_CODES.RUNTIME_STORAGE_SCAN_FORBIDDEN_IN_CONTOUR, { productStorageSurfaceRequirementsAreStaticOnly: false }],
    [REASON_CODES.RUNTIME_STORAGE_SCAN_FORBIDDEN_IN_CONTOUR, { runtimeStorageScanRequested: true }],
    [REASON_CODES.PRODUCTION_STORAGE_IMPORT_FORBIDDEN, { storagePrimitiveImportOrCall: true }],
    [REASON_CODES.PRODUCTION_STORAGE_IMPORT_FORBIDDEN, { productSavePathCall: true }],
    [REASON_CODES.RECOVERY_CLAIM_FORBIDDEN_IN_CONTOUR, { recoveryClaimed: true }],
    [REASON_CODES.STRUCTURAL_AUTO_APPLY_FORBIDDEN, { applyTxnClaimed: true }],
    [REASON_CODES.PUBLIC_SURFACE_FORBIDDEN_IN_CONTOUR, { publicSurfaceChanged: true }],
    [REASON_CODES.SEMANTIC_PARSE_FORBIDDEN, { docxImportClaimed: true }],
    [REASON_CODES.NETWORK_FORBIDDEN, { networkUsed: true }],
    [REASON_CODES.DEPENDENCY_FORBIDDEN, { dependencyChanged: true }],
    [REASON_CODES.COMMENT_APPLY_OUT_OF_SCOPE, { commentApplyClaimed: true }],
    [REASON_CODES.STRUCTURAL_STORAGE_WRITE_BLOCKED, { structuralApplyClaimed: true }],
    [REASON_CODES.MULTI_SCOPE_STORAGE_WRITE_BLOCKED, { multiSceneApplyClaimed: true }],
    [REASON_CODES.GOVERNANCE_REWRITE_FORBIDDEN_IN_CONTOUR, { preStage00GovernanceRewrite: true }],
    [REASON_CODES.GOVERNANCE_REWRITE_FORBIDDEN_IN_CONTOUR, { tokenCatalogRewrite: true }],
    [REASON_CODES.GOVERNANCE_REWRITE_FORBIDDEN_IN_CONTOUR, { claimGateRewrite: true }],
  ];

  for (const [reasonCode, override] of cases) {
    const result = compileExactTextProductApplyReadinessReview({
      ...baseInput,
      ...override,
    });
    assert.equal(result.productApplyReadinessReviewCompleted, false, reasonCode);
    assert.deepEqual(result.productApplyReadinessReviewDecisions, [], reasonCode);
    assert.equal(result.blockedReasons.includes(reasonCode), true, reasonCode);
  }
});

test('001P blocks invalid owner decision packet and release gate escalation', async () => {
  const { compileExactTextProductApplyReadinessReview, REASON_CODES } = await loadKernel();
  const baseInput = await acceptedReadinessBaseInput();
  const cases = [
    [REASON_CODES.OWNER_DECISION_PACKET_INVALID, { mayPlan001Q: false }],
    [REASON_CODES.OWNER_DECISION_PACKET_INVALID, { requiredOwnerApproval: false }],
    [REASON_CODES.OWNER_DECISION_PACKET_INVALID, { ownerApproved001QWithoutTarget: true }],
    [REASON_CODES.GOVERNANCE_REWRITE_FORBIDDEN_IN_CONTOUR, { releaseGate: true }],
  ];

  for (const [reasonCode, ownerDecisionPacketOverride] of cases) {
    const result = compileExactTextProductApplyReadinessReview({
      ...baseInput,
      ownerDecisionPacket: acceptedOwnerDecisionPacket(ownerDecisionPacketOverride),
    });
    assert.equal(result.productApplyReadinessReviewCompleted, false, reasonCode);
    assert.deepEqual(result.productApplyReadinessReviewDecisions, [], reasonCode);
    assert.equal(result.blockedReasons.includes(reasonCode), true, reasonCode);
  }
});

test('001P task record preserves readiness-only boundary', () => {
  const taskText = sourceText('docs', 'tasks', TASK_BASENAME);
  assert.match(taskText, /STATUS: IMPLEMENTED_LOCALLY_PENDING_DELIVERY_VERIFICATION/u);
  assert.match(taskText, /PRODUCT_APPLY_ADMISSION_ALLOWED: false/u);
  assert.match(taskText, /PRODUCT_WRITE_EXECUTION_ALLOWED: false/u);
  assert.match(taskText, /RECEIPT_REQUIREMENTS_ARE_DRAFT_ONLY: true/u);
  assert.match(taskText, /PRODUCT_STORAGE_SURFACE_REQUIREMENTS_ARE_STATIC_ONLY: true/u);
  assert.match(taskText, /OWNER_DECISION_PACKET_IS_LOCAL_CONTOUR_ONLY: true/u);
  assert.match(taskText, /UI_SCREENSHOT_CHECK: NOT_APPLICABLE_NO_UI_CHANGE/u);
  assert.match(taskText, /EXPECTED_DECISION: OWNER_MAY_PLAN_PRODUCT_APPLY_ADMISSION_001Q/u);
  assert.match(taskText, /COMMIT_SHA: pending/u);
  assert.match(taskText, /PUSH_RESULT: pending/u);
  assert.match(taskText, /PR_RESULT: pending/u);
  assert.match(taskText, /MERGE_RESULT: pending/u);
  assert.doesNotMatch(taskText, /product apply admitted|product storage safety proven|ApplyReceipt implemented|ApplyTxn implemented|crash recovery proven|public API exposed|DOCX runtime enabled/iu);
});

test('001P changed scope stays allowlisted and production kernel does not import storage primitives', () => {
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
    'exactTextApplyWithReceiptPrivateContractBrief.mjs',
    'exactTextApplyWithReceiptPrivateContractShape.mjs',
    'exactTextApplyWithReceiptPrivatePortAdmission.mjs',
    'exactTextApplyWithReceiptPrivatePortImplementation.mjs',
    'exactTextApplyProductApplyReadinessReview.contract.test.js',
    'exactTextApplyInternalWritePrototype.contract.test.js',
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
    'exactTextApplyProductApplyAdmissionGate.contract.test.js',
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
    'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_BRIEF_002A.md',
    'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_SHAPE_002B.md',
    'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_ADMISSION_002C.md',
    'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_IMPLEMENTATION_002D.md',
    'exactTextApplyTestOnlyProductShapedStorageDryRun.contract.test.js',
    'exactTextApplyTestOnlyStoragePrimitiveExecutionHarness.contract.test.js',
    'exactTextApplyProductStoragePrimitiveEvidence.contract.test.js',
    'exactTextApplyTestFixtureReceiptFile.contract.test.js',
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
  assert.notDeepEqual(changedBasenames, [], '001P must have detectable changed scope');
  for (const basename of changedBasenames) {
    assert.equal(allowlist.has(basename), true, `unexpected 001P changed basename: ${basename}`);
    assert.equal(denylist.has(basename), false, `denylisted 001P changed basename: ${basename}`);
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

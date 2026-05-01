const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const MODULE_BASENAME = 'reviewIrKernel.mjs';
const TASK_BASENAME = 'EXACT_TEXT_APPLY_PRODUCT_APPLY_ADMISSION_GATE_001Q.md';

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

function acceptedReadinessOwnerPacket(overrides = {}) {
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

async function acceptedReadinessResult(overrides = {}) {
  const {
    canonicalHash,
    compileExactTextProductApplyReadinessReview,
  } = await loadKernel();
  return compileExactTextProductApplyReadinessReview({
    testOnlyStoragePrimitiveExecutionHarnessResult: accepted001NResult(canonicalHash),
    testOnlyProductShapedDryRunResult: await accepted001OResult(),
    requirements: acceptedRequirements(),
    ownerDecisionPacket: acceptedReadinessOwnerPacket(),
    productStorageSurfaceRequirementsAreStaticOnly: true,
    receiptRequirementsAreDraftOnly: true,
    ...overrides,
  });
}

function acceptedOwnerAdmissionPacket(overrides = {}) {
  return {
    packetKind: 'EXACT_TEXT_PRODUCT_APPLY_ADMISSION_OWNER_PACKET_001Q',
    ownerApprovedOpening001R: true,
    ownerApprovedDirectProductWrite: false,
    productWriteStillBlockedUntil001R: true,
    publicSurfaceStillBlocked: true,
    releaseClaimStillBlocked: true,
    exactTextSingleSceneOnly: true,
    commentStructuralMultiSceneRemainBlocked: true,
    ...overrides,
  };
}

function acceptedDeliveryTargetPacket(overrides = {}) {
  return {
    packetKind: 'EXACT_TEXT_PRODUCT_APPLY_DELIVERY_TARGET_PACKET_001Q',
    targetBranch: 'OWNER_APPROVED_TARGET_REQUIRED',
    baseSha: 'OWNER_APPROVED_BASE_SHA_REQUIRED',
    prTargetPolicyExplicit: true,
    mergeTargetPolicyExplicit: true,
    isolatedBranchPolicyExplicit: true,
    mainlineSeparateDevelopmentAcknowledged: true,
    ...overrides,
  };
}

async function acceptedAdmissionBaseInput(overrides = {}) {
  const { canonicalHash } = await loadKernel();
  return {
    productApplyReadinessReviewResult: await acceptedReadinessResult(),
    testOnlyProductShapedDryRunResult: await accepted001OResult(),
    testOnlyStoragePrimitiveExecutionHarnessResult: accepted001NResult(canonicalHash),
    ownerAdmissionPacket: acceptedOwnerAdmissionPacket(),
    deliveryTargetPacket: acceptedDeliveryTargetPacket(),
    ...overrides,
  };
}

test('001Q admits opening 001R without product write or runtime apply', async () => {
  const { compileExactTextProductApplyAdmissionGate } = await loadKernel();
  const baseInput = await acceptedAdmissionBaseInput();
  const first = compileExactTextProductApplyAdmissionGate(baseInput);
  const second = compileExactTextProductApplyAdmissionGate(baseInput);

  assert.deepEqual(first, second);
  assert.equal(first.resultKind, 'EXACT_TEXT_PRODUCT_APPLY_ADMISSION_GATE_RESULT');
  assert.equal(first.contractOnly, true);
  assert.equal(first.admissionGateOnly, true);
  assert.equal(first.productApplyAdmissionPlanningGateCompleted, true);
  assert.equal(first.outputDecision, 'OWNER_MAY_OPEN_EXACT_TEXT_PRODUCT_WRITE_IMPLEMENTATION_001R');
  assert.equal(first.productApplyAdmissionToOpen001RAllowed, true);
  assert.equal(first.productWriteImplementationAllowedIn001Q, false);
  assert.equal(first.productWriteImplementationAllowedAfter001QOnlyIn001R, true);
  assert.equal(first.productApplyRuntimeExecutionAllowed, false);
  assert.equal(first.productWriteExecutionAllowed, false);
  assert.equal(first.productApplyAdmitted, false);
  assert.equal(first.productApplyAdmissionClaimed, false);
  assert.equal(first.productWritePerformed, false);
  assert.equal(first.productWriteClaimed, false);
  assert.equal(first.manuscriptMutationPerformed, false);
  assert.equal(first.applyReceiptImplemented, false);
  assert.equal(first.applyTxnClaimed, false);
  assert.equal(first.publicSurfaceClaimed, false);
  assert.equal(first.docxImportClaimed, false);
  assert.deepEqual(first.blockedReasons, []);
  assert.equal(first.productApplyAdmissionGateDecisions.length, 1);

  const decision = first.productApplyAdmissionGateDecisions[0];
  assert.equal(decision.productApplyAdmissionGateDecisionKind, 'EXACT_TEXT_PRODUCT_APPLY_ADMISSION_GATE_DECISION');
  assert.equal(decision.outputDecision, 'OWNER_MAY_OPEN_EXACT_TEXT_PRODUCT_WRITE_IMPLEMENTATION_001R');
  assert.equal(decision.acceptedBinding, 'EXACT_TEXT_APPLY_PRODUCT_APPLY_READINESS_REVIEW_001P');
  assert.equal(decision.nextContourAfterPass, 'EXACT_TEXT_APPLY_PRODUCT_WRITE_IMPLEMENTATION_001R');
  assert.equal(decision.productWriteImplementationAllowedIn001Q, false);
  assert.equal(decision.productApplyRuntimeExecutionAllowed, false);
  assert.equal(decision.sourceProductApplyReadinessReviewResultHash, baseInput.productApplyReadinessReviewResult.canonicalHash);
  assert.ok(decision.ownerAdmissionPacketHash);
  assert.ok(decision.deliveryTargetPacketHash);
});

test('001Q blocks missing weak or contaminated 001P binding', async () => {
  const { compileExactTextProductApplyAdmissionGate, canonicalHash, REASON_CODES } = await loadKernel();
  const baseInput = await acceptedAdmissionBaseInput();
  const missing = compileExactTextProductApplyAdmissionGate({
    ...baseInput,
    productApplyReadinessReviewResult: undefined,
  });
  assert.equal(missing.productApplyAdmissionPlanningGateCompleted, false);
  assert.deepEqual(missing.productApplyAdmissionGateDecisions, []);
  assert.equal(missing.blockedReasons.includes(REASON_CODES.PRODUCT_APPLY_READINESS_REVIEW_MISSING), true);

  const contaminated = compileExactTextProductApplyAdmissionGate({
    ...baseInput,
    productApplyReadinessReviewResult: {
      ...baseInput.productApplyReadinessReviewResult,
      productWritePerformed: true,
    },
  });
  assert.equal(contaminated.productApplyAdmissionPlanningGateCompleted, false);
  assert.deepEqual(contaminated.productApplyAdmissionGateDecisions, []);
  assert.equal(contaminated.blockedReasons.includes(REASON_CODES.PRODUCT_APPLY_READINESS_REVIEW_MISSING), true);

  const contaminatedAdmitted = compileExactTextProductApplyAdmissionGate({
    ...baseInput,
    productApplyReadinessReviewResult: {
      ...baseInput.productApplyReadinessReviewResult,
      productApplyAdmitted: true,
    },
  });
  assert.equal(contaminatedAdmitted.productApplyAdmissionPlanningGateCompleted, false);
  assert.deepEqual(contaminatedAdmitted.productApplyAdmissionGateDecisions, []);
  assert.equal(contaminatedAdmitted.blockedReasons.includes(REASON_CODES.PRODUCT_APPLY_READINESS_REVIEW_MISSING), true);

  const contaminatedClaimed = compileExactTextProductApplyAdmissionGate({
    ...baseInput,
    productApplyReadinessReviewResult: {
      ...baseInput.productApplyReadinessReviewResult,
      productWriteClaimed: true,
    },
  });
  assert.equal(contaminatedClaimed.productApplyAdmissionPlanningGateCompleted, false);
  assert.deepEqual(contaminatedClaimed.productApplyAdmissionGateDecisions, []);
  assert.equal(contaminatedClaimed.blockedReasons.includes(REASON_CODES.PRODUCT_APPLY_READINESS_REVIEW_MISSING), true);

  const malformedBlockedReasons = compileExactTextProductApplyAdmissionGate({
    ...baseInput,
    productApplyReadinessReviewResult: {
      ...baseInput.productApplyReadinessReviewResult,
      blockedReasons: true,
    },
  });
  assert.equal(malformedBlockedReasons.productApplyAdmissionPlanningGateCompleted, false);
  assert.deepEqual(malformedBlockedReasons.productApplyAdmissionGateDecisions, []);
  assert.equal(malformedBlockedReasons.blockedReasons.includes(REASON_CODES.PRODUCT_APPLY_READINESS_REVIEW_MISSING), true);

  const weak = await acceptedReadinessResult();
  delete weak.productApplyReadinessReviewDecisions[0].sourceTestOnlyProductShapedDryRunResultHash;
  const weakResult = compileExactTextProductApplyAdmissionGate({
    ...baseInput,
    productApplyReadinessReviewResult: weak,
  });
  assert.equal(weakResult.productApplyAdmissionPlanningGateCompleted, false);
  assert.deepEqual(weakResult.productApplyAdmissionGateDecisions, []);
  assert.equal(weakResult.blockedReasons.includes(REASON_CODES.PRODUCT_APPLY_READINESS_REVIEW_MISSING), true);

  const mismatched001N = compileExactTextProductApplyAdmissionGate({
    ...baseInput,
    testOnlyStoragePrimitiveExecutionHarnessResult: {
      ...accepted001NResult(canonicalHash),
      canonicalHash: 'wrong-001n-result-hash',
    },
  });
  assert.equal(mismatched001N.productApplyAdmissionPlanningGateCompleted, false);
  assert.deepEqual(mismatched001N.productApplyAdmissionGateDecisions, []);
  assert.equal(mismatched001N.blockedReasons.includes(REASON_CODES.PRODUCT_APPLY_READINESS_REVIEW_MISSING), true);

  const wrong001OLink = await acceptedReadinessResult();
  wrong001OLink.productApplyReadinessReviewDecisions[0].sourceTestOnlyProductShapedDryRunResultHash = 'wrong-001o-result-hash';
  const mismatched001O = compileExactTextProductApplyAdmissionGate({
    ...baseInput,
    productApplyReadinessReviewResult: wrong001OLink,
  });
  assert.equal(mismatched001O.productApplyAdmissionPlanningGateCompleted, false);
  assert.deepEqual(mismatched001O.productApplyAdmissionGateDecisions, []);
  assert.equal(mismatched001O.blockedReasons.includes(REASON_CODES.PRODUCT_APPLY_READINESS_REVIEW_MISSING), true);
});

test('001Q blocks invalid owner admission and delivery target packets', async () => {
  const { compileExactTextProductApplyAdmissionGate, REASON_CODES } = await loadKernel();
  const baseInput = await acceptedAdmissionBaseInput();
  const cases = [
    [REASON_CODES.OWNER_DECISION_PACKET_INVALID, { ownerAdmissionPacket: undefined }],
    [REASON_CODES.OWNER_DECISION_PACKET_INVALID, { ownerAdmissionPacket: acceptedOwnerAdmissionPacket({ ownerApprovedOpening001R: false }) }],
    [REASON_CODES.PRODUCT_WRITE_FORBIDDEN_IN_CONTOUR, { ownerAdmissionPacket: acceptedOwnerAdmissionPacket({ ownerApprovedDirectProductWrite: true }) }],
    [REASON_CODES.PUBLIC_SURFACE_FORBIDDEN_IN_CONTOUR, { ownerAdmissionPacket: acceptedOwnerAdmissionPacket({ publicSurfaceStillBlocked: false }) }],
    [REASON_CODES.GOVERNANCE_REWRITE_FORBIDDEN_IN_CONTOUR, { ownerAdmissionPacket: acceptedOwnerAdmissionPacket({ releaseClaimStillBlocked: false }) }],
    [REASON_CODES.DELIVERY_TARGET_PACKET_INVALID, { deliveryTargetPacket: undefined }],
    [REASON_CODES.DELIVERY_TARGET_PACKET_INVALID, { deliveryTargetPacket: acceptedDeliveryTargetPacket({ targetBranch: '' }) }],
    [REASON_CODES.DELIVERY_TARGET_PACKET_INVALID, { deliveryTargetPacket: acceptedDeliveryTargetPacket({ baseSha: '' }) }],
    [REASON_CODES.DELIVERY_TARGET_PACKET_INVALID, { deliveryTargetPacket: acceptedDeliveryTargetPacket({ isolatedBranchPolicyExplicit: false }) }],
  ];

  for (const [reasonCode, override] of cases) {
    const result = compileExactTextProductApplyAdmissionGate({
      ...baseInput,
      ...override,
    });
    assert.equal(result.productApplyAdmissionPlanningGateCompleted, false, reasonCode);
    assert.deepEqual(result.productApplyAdmissionGateDecisions, [], reasonCode);
    assert.equal(result.blockedReasons.includes(reasonCode), true, reasonCode);
  }
});

test('001Q blocks forbidden runtime write public surface transport and governance claims', async () => {
  const { compileExactTextProductApplyAdmissionGate, REASON_CODES } = await loadKernel();
  const baseInput = await acceptedAdmissionBaseInput();
  const cases = [
    [REASON_CODES.PRODUCT_APPLY_ADMISSION_FORBIDDEN, { productApplyRuntimeExecutionAllowed: true }],
    [REASON_CODES.PRODUCT_APPLY_ADMISSION_FORBIDDEN, { productApplyAdmitted: true }],
    [REASON_CODES.PRODUCT_WRITE_FORBIDDEN_IN_CONTOUR, { productWriteExecutionAllowed: true }],
    [REASON_CODES.PRODUCT_WRITE_FORBIDDEN_IN_CONTOUR, { productWritePerformed: true }],
    [REASON_CODES.PRODUCT_WRITE_FORBIDDEN_IN_CONTOUR, { productWriteClaimed: true }],
    [REASON_CODES.PRODUCT_WRITE_FORBIDDEN_IN_CONTOUR, { productSavePathCall: true }],
    [REASON_CODES.PRODUCTION_STORAGE_IMPORT_FORBIDDEN, { storagePrimitiveImportOrCall: true }],
    [REASON_CODES.RECEIPT_REQUIREMENTS_ESCALATED_TO_IMPLEMENTATION, { applyReceiptImplemented: true }],
    [REASON_CODES.RECEIPT_REQUIREMENTS_ESCALATED_TO_IMPLEMENTATION, { durableReceiptClaimed: true }],
    [REASON_CODES.RECEIPT_REQUIREMENTS_ESCALATED_TO_IMPLEMENTATION, { productApplyReceiptClaimed: true }],
    [REASON_CODES.STRUCTURAL_AUTO_APPLY_FORBIDDEN, { applyTxnClaimed: true }],
    [REASON_CODES.STRUCTURAL_AUTO_APPLY_FORBIDDEN, { applyTxnImplemented: true }],
    [REASON_CODES.RECOVERY_CLAIM_FORBIDDEN_IN_CONTOUR, { recoveryClaimed: true }],
    [REASON_CODES.RECOVERY_CLAIM_FORBIDDEN_IN_CONTOUR, { crashRecoveryClaimed: true }],
    [REASON_CODES.PUBLIC_SURFACE_FORBIDDEN_IN_CONTOUR, { uiChanged: true }],
    [REASON_CODES.PUBLIC_SURFACE_FORBIDDEN_IN_CONTOUR, { publicSurfaceChanged: true }],
    [REASON_CODES.SEMANTIC_PARSE_FORBIDDEN, { docxImportClaimed: true }],
    [REASON_CODES.NETWORK_FORBIDDEN, { networkUsed: true }],
    [REASON_CODES.DEPENDENCY_FORBIDDEN, { dependencyChanged: true }],
    [REASON_CODES.COMMENT_APPLY_OUT_OF_SCOPE, { commentApplyClaimed: true }],
    [REASON_CODES.STRUCTURAL_STORAGE_WRITE_BLOCKED, { structuralApplyClaimed: true }],
    [REASON_CODES.MULTI_SCOPE_STORAGE_WRITE_BLOCKED, { multiSceneApplyClaimed: true }],
    [REASON_CODES.GOVERNANCE_REWRITE_FORBIDDEN_IN_CONTOUR, { tokenCatalogRewrite: true }],
    [REASON_CODES.GOVERNANCE_REWRITE_FORBIDDEN_IN_CONTOUR, { claimGateRewrite: true }],
  ];

  for (const [reasonCode, override] of cases) {
    const result = compileExactTextProductApplyAdmissionGate({
      ...baseInput,
      ...override,
    });
    assert.equal(result.productApplyAdmissionPlanningGateCompleted, false, reasonCode);
    assert.deepEqual(result.productApplyAdmissionGateDecisions, [], reasonCode);
    assert.equal(result.blockedReasons.includes(reasonCode), true, reasonCode);
  }
});

test('001Q task record preserves admission gate only boundary', () => {
  const taskText = sourceText('docs', 'tasks', TASK_BASENAME);
  assert.match(taskText, /TASK_ID: EXACT_TEXT_APPLY_PRODUCT_APPLY_ADMISSION_GATE_001Q/u);
  assert.match(taskText, /PRODUCT_WRITE_IMPLEMENTATION_ALLOWED_IN_001Q: false/u);
  assert.match(taskText, /PRODUCT_APPLY_RUNTIME_EXECUTION_ALLOWED_IF_PASS: false/u);
  assert.match(taskText, /MANUSCRIPT_MUTATION_ALLOWED_IF_PASS: false/u);
  assert.match(taskText, /PUBLIC_SURFACE_ALLOWED_IF_PASS: false/u);
  assert.match(taskText, /UI_ALLOWED_IF_PASS: false/u);
  assert.match(taskText, /DOCX_IMPORT_ALLOWED_IF_PASS: false/u);
  assert.match(taskText, /EXPECTED_DECISION_COUNT: 1/u);
  assert.match(taskText, /PASS_DECISION: OWNER_MAY_OPEN_EXACT_TEXT_PRODUCT_WRITE_IMPLEMENTATION_001R/u);
  assert.match(taskText, /UI_SCREENSHOT_CHECK: NOT_APPLICABLE_NO_UI_CHANGE/u);
  assert.match(taskText, /COMMIT_SHA: pending/u);
  assert.match(taskText, /PUSH_RESULT: pending/u);
  assert.match(taskText, /PR_RESULT: pending/u);
  assert.match(taskText, /MERGE_RESULT: pending/u);
  assert.doesNotMatch(taskText, /product write ready|manuscript mutated|ApplyReceipt implemented|ApplyTxn implemented|DOCX import ready|release green/iu);
});

test('001Q changed scope stays allowlisted and production kernel does not import storage primitives', () => {
  const changedBasenames = changedBasenamesForCurrentContour();
  const allowlist = new Set([
    'reviewIrKernel.mjs',
    'exactTextApplyProductApplyAdmissionGate.contract.test.js',
    'EXACT_TEXT_APPLY_PRODUCT_APPLY_ADMISSION_GATE_001Q.md',
    'exactTextApplyProductApplyReadinessReview.contract.test.js',
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
  assert.notDeepEqual(changedBasenames, [], '001Q must have detectable changed scope');
  for (const basename of changedBasenames) {
    assert.equal(allowlist.has(basename), true, `unexpected 001Q changed basename: ${basename}`);
    assert.equal(denylist.has(basename), false, `denylisted 001Q changed basename: ${basename}`);
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

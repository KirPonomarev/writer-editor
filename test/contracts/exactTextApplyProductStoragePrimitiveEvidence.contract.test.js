const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const MODULE_BASENAME = 'reviewIrKernel.mjs';
const TASK_BASENAME = 'EXACT_TEXT_APPLY_PRODUCT_STORAGE_PRIMITIVE_EVIDENCE_GATE_001M.md';

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

function uniqueStrings(items) {
  return Array.from(new Set(items.filter(Boolean))).sort();
}

function exactTextDecision() {
  return {
    projectId: 'project-1',
    artifactHash: 'artifact-a',
    contextHash: 'baseline-a',
    sourceViewState: {
      revisionToken: 'rev-1',
      viewMode: 'inline',
      normalizationPolicy: 'TEXT_V1',
      newlinePolicy: 'LF',
      unicodePolicy: 'NFC',
      artifactCompletenessClass: 'TEXT_ONLY',
    },
    items: [{
      id: 'decision-1',
      kind: 'TEXT_REPLACE',
      targetScope: { sceneId: 'scene-1', blockId: 'block-1' },
      blockVersionHash: 'block-v1',
      selectors: [{
        selectorKind: 'TEXT_QUOTE',
        selectorEvidence: { exact: 'old text', prefix: 'before', suffix: 'after' },
      }],
      evidence: [{ exactText: 'old text', prefix: 'before', suffix: 'after' }],
      expectedText: 'old text',
      replacementText: 'new text',
    }],
  };
}

function acceptedEnvironment() {
  return {
    projectId: 'project-1',
    currentBaselineHash: 'baseline-a',
    sessionOpen: true,
    sceneId: 'scene-1',
    currentBlockVersions: { 'block-1': 'block-v1' },
    currentTextByBlock: { 'block-1': 'old text' },
  };
}

function acceptedFixtureRootPolicy() {
  return {
    fixtureRootId: 'fixture-root-001M',
    productRootId: 'product-root',
    rootKind: 'FIXTURE',
    isolatedRoot: true,
    isolatedMarker: 'EXACT_TEXT_FIXTURE_ROOT_ISOLATED',
    relativePath: 'scene-1.txt',
    relativePathSegments: ['scene-1.txt'],
    symlinkPolicy: 'BLOCK',
    caseCollisionPolicy: 'DETECT_AND_BLOCK',
    reservedNamePolicy: 'DETECT_AND_BLOCK',
    longPathPolicy: 'DECLARE_AND_BLOCK_UNSUPPORTED',
    hashPolicy: {
      normalizationPolicy: 'TEXT_V1',
      newlinePolicy: 'LF',
      unicodePolicy: 'NFC',
    },
  };
}

function acceptedFixtureRootCreationPolicy() {
  return {
    ownerFixtureRootCreationApproved: true,
    fixtureRootCreationRequested: true,
    creationMode: 'TEST_TEMP_ROOT_ONLY',
    realIoScope: 'DIRECTORY_ONLY',
    baseLocationKind: 'OS_TEMP',
    cleanupRequired: true,
    repoRootAccess: false,
    productRootAccess: false,
    productPathAccess: false,
    rootInsideProject: false,
  };
}

function acceptedFixtureTextWritePolicy() {
  return {
    ownerFixtureTextWriteApproved: true,
    fixtureTextWriteRequested: true,
    writeMode: 'TEST_TEMP_FILE_ONLY',
    realIoScope: 'FILE_ONLY',
    baseLocationKind: 'OS_TEMP',
    hashObservationOnly: true,
    cleanupRequired: true,
    repoRootAccess: false,
    productRootAccess: false,
    productPathAccess: false,
    rootInsideProject: false,
    relativePath: 'scene-1.txt',
    relativePathSegments: ['scene-1.txt'],
    beforeText: 'old text',
    afterText: 'new text',
    hashPolicy: {
      normalizationPolicy: 'TEXT_V1',
      newlinePolicy: 'LF',
      unicodePolicy: 'NFC',
    },
  };
}

function acceptedFixtureTempRenamePolicy() {
  return {
    ownerFixtureTempRenameApproved: true,
    fixtureTempRenameRequested: true,
    renameMode: 'TEST_TEMP_RENAME_ONLY',
    realIoScope: 'TEMP_FILE_RENAME_ONLY',
    baseLocationKind: 'OS_TEMP',
    sameRootRename: true,
    hashObservationOnly: true,
    cleanupRequired: true,
    repoRootAccess: false,
    productRootAccess: false,
    productPathAccess: false,
    rootInsideProject: false,
    tempRelativePath: 'scene-1.tmp',
    tempRelativePathSegments: ['scene-1.tmp'],
    targetRelativePath: 'scene-1.txt',
    targetRelativePathSegments: ['scene-1.txt'],
    beforeText: 'old text',
    afterText: 'new text',
    hashPolicy: {
      normalizationPolicy: 'TEXT_V1',
      newlinePolicy: 'LF',
      unicodePolicy: 'NFC',
    },
  };
}

function acceptedFixtureReceiptFilePolicy() {
  return {
    ownerFixtureReceiptFileObservationApproved: true,
    fixtureReceiptFileObservationRequested: true,
    observationMode: 'TEST_TEMP_RECEIPT_FILE_ONLY',
    realIoScope: 'RECEIPT_FILE_WRITE_READBACK_ONLY',
    baseLocationKind: 'OS_TEMP',
    receiptObservationOnly: true,
    durableReceiptClaimed: false,
    applyReceiptImplemented: false,
    cleanupRequired: true,
    repoRootAccess: false,
    productRootAccess: false,
    productPathAccess: false,
    rootInsideProject: false,
    receiptRelativePath: 'receipt-001m.json',
    receiptRelativePathSegments: ['receipt-001m.json'],
    receiptText: '{"kind":"TEST_FIXTURE_RECEIPT_FILE_OBSERVATION","source":"001L","durable":false}',
    hashPolicy: {
      normalizationPolicy: 'TEXT_V1',
      newlinePolicy: 'LF',
      unicodePolicy: 'NFC',
    },
  };
}

async function acceptedFixtureReceiptFileObservationResult() {
  const {
    buildReviewPatchSet,
    compileExactTextApplyOps,
    compileExactTextApplyEffectPreviews,
    compileExactTextWritePlanReceiptContract,
    compileExactTextStorageAdapterCallPlan,
    compileExactTextInMemoryStoragePortFixture,
    compileExactTextStorageAdmissionGate,
    compileExactTextFixtureRootPathPolicy,
    compileExactTextRealFixtureRootCreationPlan,
    compileExactTextTestFixtureTextWritePlan,
    compileExactTextTestFixtureTempRenameObservationPlan,
    compileExactTextTestFixtureReceiptFileObservationPlan,
  } = await loadKernel();
  const applyResult = compileExactTextApplyOps(
    buildReviewPatchSet(exactTextDecision()),
    acceptedEnvironment(),
  );
  const effectPreviewPlan = compileExactTextApplyEffectPreviews(applyResult);
  const writePlanReceiptResult = compileExactTextWritePlanReceiptContract({ applyResult, effectPreviewPlan });
  const storageAdapterCallPlanResult = compileExactTextStorageAdapterCallPlan({
    writePlanReceiptResult,
    storagePortCapabilities: {
      canBackupBeforeWrite: true,
      canAtomicWriteSceneText: true,
      canCreateReadableRecoverySnapshot: true,
      canReportBeforeHash: true,
      canReportAfterHash: true,
      deterministicObservationIds: true,
      productPathAccess: false,
    },
  });
  const storagePortFixtureResult = compileExactTextInMemoryStoragePortFixture({
    storageAdapterCallPlanResult,
    fixtureCapabilities: {
      canObserveBackup: true,
      canObserveAtomicWrite: true,
      canObserveRecoverySnapshot: true,
      canProduceFixtureReceiptContract: true,
      deterministicObservationIds: true,
      realIoAvailable: false,
      productPathAccess: false,
    },
  });
  const storageAdmissionGateResult = compileExactTextStorageAdmissionGate({
    storagePortFixtureResult,
    storageAdmissionPolicy: {
      ownerAdmissionApproved: true,
      realStorageAdmissionRequested: true,
      exactTextOnly: true,
      singleSceneOnly: true,
      sourceScope: {
        sceneCount: 1,
        operationKind: 'EXACT_TEXT_REPLACE',
        structural: false,
        multiScene: false,
      },
    },
    storageAdmissionCapabilities: {
      canBackupBeforeWrite: true,
      canAtomicWriteSceneText: true,
      canCreateReadableRecoverySnapshot: true,
      canPersistReceipt: true,
      productPathAccess: false,
      publicSurfaceAvailable: false,
    },
  });
  const fixtureRootPathPolicyResult = compileExactTextFixtureRootPathPolicy({
    storageAdmissionGateResult,
    fixtureRootPolicy: acceptedFixtureRootPolicy(),
  });
  const fixtureRootCreationPlanResult = compileExactTextRealFixtureRootCreationPlan({
    fixtureRootPathPolicyResult,
    fixtureRootCreationPolicy: acceptedFixtureRootCreationPolicy(),
  });
  const fixtureTextWritePlanResult = compileExactTextTestFixtureTextWritePlan({
    fixtureRootCreationPlanResult,
    fixtureTextWritePolicy: acceptedFixtureTextWritePolicy(),
  });
  const fixtureTempRenamePlanResult = compileExactTextTestFixtureTempRenameObservationPlan({
    fixtureTextWritePlanResult,
    fixtureTempRenamePolicy: acceptedFixtureTempRenamePolicy(),
  });
  return compileExactTextTestFixtureReceiptFileObservationPlan({
    fixtureTempRenamePlanResult,
    fixtureReceiptFilePolicy: acceptedFixtureReceiptFilePolicy(),
  });
}

function sourceText(...segments) {
  return fs.readFileSync(path.join(process.cwd(), ...segments), 'utf8');
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

function assertTextContains(text, basename, patterns) {
  for (const pattern of patterns) {
    assert.equal(text.includes(pattern), true, `${basename} missing evidence pattern ${pattern}`);
  }
}

async function acceptedEvidencePacket(overrides = {}) {
  const { canonicalHash } = await loadKernel();
  const backupText = sourceText('src', 'utils', 'backupManager.js');
  const atomicText = sourceText('src', 'io', 'markdown', 'atomicWriteFile.mjs');
  const recoveryText = sourceText('src', 'io', 'markdown', 'snapshotFile.mjs');
  const recoveryAtomicTestText = sourceText('test', 'contracts', 'recovery-atomic-write.contract.test.js');
  const recoveryReplayTestText = sourceText('test', 'contracts', 'recovery-replay.contract.test.js');
  const recoverySnapshotTestText = sourceText('test', 'contracts', 'recovery-snapshot-fallback.contract.test.js');

  assertTextContains(backupText, 'backupManager.js', ['createBackup', 'writeFileAtomic']);
  assertTextContains(atomicText, 'atomicWriteFile.mjs', ['atomicWriteFile', 'rename']);
  assertTextContains(recoveryText, 'snapshotFile.mjs', ['createRecoverySnapshot', 'listRecoverySnapshots']);
  assertTextContains(recoveryAtomicTestText, 'recovery-atomic-write.contract.test.js', ['partial write never mutates committed target', 'atomicWriteFile']);
  assertTextContains(recoveryReplayTestText, 'recovery-replay.contract.test.js', ['repeated replay over same artifacts', 'replayMarkdownRecovery']);
  assertTextContains(recoverySnapshotTestText, 'recovery-snapshot-fallback.contract.test.js', ['corruption falls back to latest snapshot', 'createRecoverySnapshot']);

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
    ...overrides,
  };
}

test('accepted 001L binding and complete primitive evidence admits one binary planning decision only', async () => {
  const { compileExactTextProductStoragePrimitiveEvidenceGate } = await loadKernel();
  const fixtureReceiptFileObservationResult = await acceptedFixtureReceiptFileObservationResult();
  const first = compileExactTextProductStoragePrimitiveEvidenceGate({
    fixtureReceiptFileObservationResult,
    evidencePacket: await acceptedEvidencePacket(),
  });
  const second = compileExactTextProductStoragePrimitiveEvidenceGate({
    fixtureReceiptFileObservationResult,
    evidencePacket: await acceptedEvidencePacket(),
  });

  assert.deepEqual(first, second);
  assert.equal(first.contractOnly, true);
  assert.equal(first.evidenceGateOnly, true);
  assert.equal(first.binaryPlanningDecisionOnly, true);
  assert.equal(first.productStoragePrimitiveEvidenceAdmitted, true);
  assert.equal(first.accepted001LBinding, true);
  assert.equal(first.outputDecision, 'FUTURE_DRY_RUN_CONTOUR_MAY_BE_PLANNED');
  assert.equal(first.productStorageRuntimeSafetyNotProven, true);
  assert.equal(first.existingPrimitiveReuseNotIntegration, true);
  assert.equal(first.productWriteStillRequiresSeparateOwnerApprovedTz, true);
  assert.equal(first.receiptPersistenceStillRequiresFutureContour, true);
  assert.equal(first.futureDryRunRequiresOwnerApproval, true);
  assert.equal(first.backupPrimitiveEvidenceRequired, true);
  assert.equal(first.atomicWritePrimitiveEvidenceRequired, true);
  assert.equal(first.recoveryPrimitiveEvidenceRequired, true);
  assert.equal(first.existingPrimitiveTestsEvidenceRequired, true);
  assert.equal(first.productWritePerformed, false);
  assert.equal(first.productWriteRequested, false);
  assert.equal(first.productWriteClaimed, false);
  assert.equal(first.productStorageIntegrated, false);
  assert.equal(first.productStorageIntegrationClaimed, false);
  assert.equal(first.productStorageSafetyClaimed, false);
  assert.equal(first.productAtomicityClaimed, false);
  assert.equal(first.atomicWriteExecuted, false);
  assert.equal(first.recoveryClaimed, false);
  assert.equal(first.recoverySnapshotCreated, false);
  assert.equal(first.durableReceiptClaimed, false);
  assert.equal(first.applyReceiptImplemented, false);
  assert.equal(first.productApplyReceiptClaimed, false);
  assert.equal(first.crashRecoveryClaimed, false);
  assert.equal(first.applyTxnClaimed, false);
  assert.equal(first.publicSurfaceClaimed, false);
  assert.equal(first.docxImportClaimed, false);
  assert.equal(first.uiChanged, false);
  assert.equal(first.storageImportsAdded, false);
  assert.equal(first.storagePrimitiveChanged, false);
  assert.deepEqual(first.blockedReasons, []);
  assert.equal(first.productStoragePrimitiveEvidenceDecisions.length, 1);

  const decision = first.productStoragePrimitiveEvidenceDecisions[0];
  assert.equal(decision.productStoragePrimitiveEvidenceDecisionKind, 'EXACT_TEXT_PRODUCT_STORAGE_PRIMITIVE_EVIDENCE_GATE_DECISION');
  assert.equal(decision.decisionMode, 'BINARY_PLANNING_DECISION_ONLY');
  assert.equal(decision.productStoragePrimitiveEvidenceAdmitted, true);
  assert.equal(decision.acceptedBinding, 'EXACT_TEXT_APPLY_TEST_FIXTURE_RECEIPT_FILE_OBSERVATION_001L');
  assert.equal(decision.outputDecision, 'FUTURE_DRY_RUN_CONTOUR_MAY_BE_PLANNED');
  assert.equal(decision.productStorageRuntimeSafetyNotProven, true);
  assert.equal(decision.existingPrimitiveReuseNotIntegration, true);
  assert.equal(decision.productWriteStillRequiresSeparateOwnerApprovedTz, true);
  assert.equal(decision.receiptPersistenceStillRequiresFutureContour, true);
  assert.equal(decision.futureDryRunRequiresOwnerApproval, true);
  assert.equal(decision.sourceFixtureReceiptFileObservationResultHash, fixtureReceiptFileObservationResult.canonicalHash);
  assert.equal(decision.sourceFixtureReceiptFileObservationDecisionHash, fixtureReceiptFileObservationResult.fixtureReceiptFileObservationDecisions[0].canonicalHash);
  assert.equal(decision.staticPrimitiveEvidence.length, 3);
  assert.equal(decision.existingTestEvidence.length, 3);
  assert.equal(decision.productWriteRequested, false);
  assert.equal(decision.productStorageIntegrated, false);
  assert.equal(decision.productStorageIntegrationClaimed, false);
  assert.equal(decision.productAtomicityClaimed, false);
  assert.equal(decision.recoveryClaimed, false);
  assert.equal(decision.durableReceiptClaimed, false);
  assert.equal(decision.applyReceiptImplemented, false);
});

test('static primitive evidence without existing tests blocks binary planning decision', async () => {
  const { compileExactTextProductStoragePrimitiveEvidenceGate, REASON_CODES } = await loadKernel();
  const packet = await acceptedEvidencePacket({ existingTestEvidence: [] });
  const result = compileExactTextProductStoragePrimitiveEvidenceGate({
    fixtureReceiptFileObservationResult: await acceptedFixtureReceiptFileObservationResult(),
    evidencePacket: packet,
  });

  assert.equal(result.productStoragePrimitiveEvidenceAdmitted, false);
  assert.deepEqual(result.productStoragePrimitiveEvidenceDecisions, []);
  assert.equal(result.blockedReasons.includes(REASON_CODES.PRODUCT_STORAGE_PRIMITIVE_TEST_EVIDENCE_MISSING), true);
});

test('edited denylist primitive blocks evidence gate without touching primitive files', async () => {
  const { compileExactTextProductStoragePrimitiveEvidenceGate, REASON_CODES } = await loadKernel();
  const packet = await acceptedEvidencePacket({
    denylistPrimitiveEvidence: [
      { basename: 'fileManager.js', editedInCurrentContour: false },
      { basename: 'backupManager.js', editedInCurrentContour: true },
      { basename: 'atomicWriteFile.mjs', editedInCurrentContour: false },
      { basename: 'hostilePackageGate.mjs', editedInCurrentContour: false },
    ],
  });
  const result = compileExactTextProductStoragePrimitiveEvidenceGate({
    fixtureReceiptFileObservationResult: await acceptedFixtureReceiptFileObservationResult(),
    evidencePacket: packet,
  });

  assert.equal(result.productStoragePrimitiveEvidenceAdmitted, false);
  assert.deepEqual(result.productStoragePrimitiveEvidenceDecisions, []);
  assert.equal(result.blockedReasons.includes(REASON_CODES.DENYLIST_PRIMITIVE_EDITED), true);
});

test('product write storage integration atomicity recovery and receipt claims block evidence gate', async () => {
  const { compileExactTextProductStoragePrimitiveEvidenceGate, REASON_CODES } = await loadKernel();
  const cases = [
    [REASON_CODES.PRODUCT_WRITE_FORBIDDEN_IN_CONTOUR, { productWriteRequested: true }],
    [REASON_CODES.STORAGE_INTEGRATION_FORBIDDEN_IN_CONTOUR, { productStorageIntegrationClaimed: true }],
    [REASON_CODES.ATOMICITY_CLAIM_FORBIDDEN_IN_CONTOUR, { productAtomicityClaimed: true }],
    [REASON_CODES.RECOVERY_CLAIM_FORBIDDEN_IN_CONTOUR, { recoveryClaimed: true }],
    [REASON_CODES.RECEIPT_CONTRACT_MISMATCH, { durableReceiptClaimed: true }],
    [REASON_CODES.RECEIPT_CONTRACT_MISMATCH, { applyReceiptImplemented: true }],
    [REASON_CODES.STRUCTURAL_AUTO_APPLY_FORBIDDEN, { applyTxnClaimed: true }],
    [REASON_CODES.PUBLIC_SURFACE_FORBIDDEN_IN_CONTOUR, { publicSurfaceClaimed: true }],
    [REASON_CODES.PUBLIC_SURFACE_FORBIDDEN_IN_CONTOUR, { ipcSurfaceClaimed: true }],
    [REASON_CODES.PUBLIC_SURFACE_FORBIDDEN_IN_CONTOUR, { commandSurfaceClaimed: true }],
    [REASON_CODES.PUBLIC_SURFACE_FORBIDDEN_IN_CONTOUR, { uiChanged: true }],
    [REASON_CODES.SEMANTIC_PARSE_FORBIDDEN, { docxImportClaimed: true }],
    [REASON_CODES.NETWORK_FORBIDDEN, { networkUsed: true }],
    [REASON_CODES.DEPENDENCY_FORBIDDEN, { dependencyChanged: true }],
    [REASON_CODES.FS_MUTATION_FORBIDDEN_IN_CONTOUR, { storageImportsAdded: true }],
  ];

  for (const [reasonCode, override] of cases) {
    const result = compileExactTextProductStoragePrimitiveEvidenceGate({
      fixtureReceiptFileObservationResult: await acceptedFixtureReceiptFileObservationResult(),
      evidencePacket: await acceptedEvidencePacket(override),
    });
    assert.equal(result.productStoragePrimitiveEvidenceAdmitted, false, reasonCode);
    assert.deepEqual(result.productStoragePrimitiveEvidenceDecisions, [], reasonCode);
    assert.equal(result.blockedReasons.includes(reasonCode), true, reasonCode);
  }
});

test('001M task record stays delivery honest and pins claims false', () => {
  const taskText = fs.readFileSync(path.join(process.cwd(), 'docs', 'tasks', TASK_BASENAME), 'utf8');
  const requiredFalseFlags = [
    'PRODUCT_WRITE_PERFORMED',
    'PRODUCT_WRITE_REQUESTED',
    'PRODUCT_WRITE_CLAIMED',
    'PRODUCT_STORAGE_INTEGRATED',
    'PRODUCT_STORAGE_INTEGRATION_CLAIMED',
    'PRODUCT_STORAGE_SAFETY_CLAIMED',
    'PRODUCT_ATOMICITY_CLAIMED',
    'ATOMIC_WRITE_EXECUTED',
    'RECOVERY_CLAIMED',
    'RECOVERY_SNAPSHOT_CREATED',
    'DURABLE_RECEIPT_CLAIMED',
    'APPLY_RECEIPT_IMPLEMENTED',
    'PRODUCT_APPLY_RECEIPT_CLAIMED',
    'CRASH_RECOVERY_CLAIMED',
    'APPLYTXN_CLAIMED',
    'PUBLIC_SURFACE_CLAIMED',
    'DOCX_IMPORT_CLAIMED',
    'UI_CHANGED',
    'STORAGE_IMPORTS_ADDED',
    'STORAGE_PRIMITIVE_CHANGED',
  ];
  assert.match(taskText, /STATUS: IMPLEMENTED_LOCALLY_PENDING_DELIVERY_VERIFICATION/u);
  assert.match(taskText, /DELIVERY_POLICY: COMMIT_REQUIRED true, PUSH_REQUIRED true, PR_REQUIRED true, MERGE_REQUIRED true/u);
  assert.match(taskText, /COMMIT_SHA: pending/u);
  assert.match(taskText, /PUSH_RESULT: pending/u);
  assert.match(taskText, /PR_RESULT: pending/u);
  assert.match(taskText, /MERGE_RESULT: pending/u);
  assert.match(taskText, /ACCEPTED_001L_BINDING_REQUIRED: true/u);
  assert.match(taskText, /BINARY_PLANNING_DECISION_ONLY: true/u);
  assert.match(taskText, /STATIC_PRIMITIVE_EVIDENCE_REQUIRED: true/u);
  assert.match(taskText, /EXISTING_TEST_EVIDENCE_REQUIRED: true/u);
  assert.match(taskText, /PRODUCT_STORAGE_RUNTIME_SAFETY_NOT_PROVEN: true/u);
  assert.match(taskText, /EXISTING_PRIMITIVE_REUSE_NOT_INTEGRATION: true/u);
  assert.match(taskText, /PRODUCT_WRITE_STILL_REQUIRES_SEPARATE_OWNER_APPROVED_TZ: true/u);
  for (const flag of requiredFalseFlags) {
    assert.match(taskText, new RegExp(`${flag}: false`, 'u'), flag);
    assert.doesNotMatch(taskText, new RegExp(`${flag}: true`, 'u'), flag);
  }
  assert.doesNotMatch(taskText, /product saved|public API exposed|DOCX runtime enabled|receipt persisted|durable receipt|ApplyReceipt implemented|backup executed|atomic write proven|product atomicity proven|crash recovery proven|storage integrated/iu);
});

test('001M change scope stays inside ownership and denylist primitives are read only evidence', () => {
  const changedBasenames = changedBasenamesForCurrentContour();
  if (!changedBasenames.includes(TASK_BASENAME)) {
    const laterContourBasenames = new Set([
      'EXACT_TEXT_APPLY_TEST_ONLY_STORAGE_PRIMITIVE_EXECUTION_HARNESS_001N.md',
      'EXACT_TEXT_APPLY_TEST_ONLY_PRODUCT_SHAPED_STORAGE_DRY_RUN_001O.md',
      'EXACT_TEXT_APPLY_PRODUCT_APPLY_READINESS_REVIEW_001P.md',
      'EXACT_TEXT_APPLY_PRODUCT_APPLY_ADMISSION_GATE_001Q.md',
      'EXACT_TEXT_APPLY_INTERNAL_WRITE_PATH_PROTOTYPE_001R.md',
      'exactTextApplyInternalWritePrototype.mjs',
      'exactTextApplyTestOnlyStoragePrimitiveExecutionHarness.contract.test.js',
      'exactTextApplyTestOnlyProductShapedStorageDryRun.contract.test.js',
      'exactTextApplyProductApplyReadinessReview.contract.test.js',
      'exactTextApplyProductApplyAdmissionGate.contract.test.js',
      'exactTextApplyInternalWritePrototype.contract.test.js',
    ]);
    assert.equal(
      changedBasenames.some((basename) => laterContourBasenames.has(basename)),
      true,
      '001M scope guard may defer only to a known later contour scope',
    );
    return;
  }
  const allowlist = new Set([
    'reviewIrKernel.mjs',
    'exactTextApplyProductStoragePrimitiveEvidence.contract.test.js',
    TASK_BASENAME,
    'exactTextApplyTestFixtureReceiptFile.contract.test.js',
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
  assert.notDeepEqual(changedBasenames, [], '001M must have a detectable changed scope');
  for (const basename of changedBasenames) {
    assert.equal(allowlist.has(basename), true, `unexpected 001M changed basename: ${basename}`);
    assert.equal(denylist.has(basename), false, `denylisted 001M changed basename: ${basename}`);
  }
});

test('product storage primitive evidence gate keeps production kernel pure', () => {
  const moduleText = sourceText('src', 'revisionBridge', MODULE_BASENAME);
  const forbiddenModulePatterns = [
    /from\s+['"]node:fs(?:\/promises)?['"]/u,
    /\brequire\s*\(/u,
    /\bimport\s*\(/u,
    /from\s+['"]node:child_process['"]/u,
    /from\s+['"]node:http['"]/u,
    /from\s+['"]node:https['"]/u,
    /from\s+['"]node:net['"]/u,
    /from\s+['"]node:dns['"]/u,
    /from\s+['"]node:os['"]/u,
    /from\s+['"]electron['"]/u,
    /from\s+['"][^'"]*(?:storage|main|preload|editor|command-catalog|projectCommands|fileManager|backupManager|atomicWrite|snapshotFile)[^'"]*['"]/u,
    /\bFileSystemPort\b/u,
    /\bcreatePortsAdapterBase\b/u,
    /\bdesktopPortsAdapter\b/u,
    /from\s+['"][^'"]*(?:ports|adapter|persistence)[^'"]*['"]/u,
    /\bfetch\s*\(/u,
    /\bXMLHttpRequest\b/u,
    /\bwriteFile(?:Atomic)?\b/u,
    /\bappendFile\b/u,
    /\bmkdir\b/u,
    /\bmkdtemp\b/u,
    /\brename\b/u,
    /\bunlink\b/u,
    /\brm\b/u,
    /\bcreateWriteStream\b/u,
    /\bDate\.now\s*\(/u,
    /\bMath\.random\s*\(/u,
    /\bApplyReceipt\b/u,
    /\bApplyTxn\b/u,
    /\bipc(?:Main|Renderer)\b/u,
  ];
  for (const pattern of forbiddenModulePatterns) {
    assert.equal(pattern.test(moduleText), false, `forbidden evidence gate module pattern: ${pattern.source}`);
  }
});

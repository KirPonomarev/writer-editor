const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const MODULE_BASENAME = 'reviewIrKernel.mjs';
const TASK_BASENAME = 'EXACT_TEXT_APPLY_TEST_FIXTURE_RECEIPT_FILE_OBSERVATION_001L.md';

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
    fixtureRootId: 'fixture-root-001L',
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

function acceptedFixtureReceiptFilePolicy(overrides = {}) {
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
    receiptRelativePath: 'receipt-001l.json',
    receiptRelativePathSegments: ['receipt-001l.json'],
    receiptText: '{"kind":"TEST_FIXTURE_RECEIPT_FILE_OBSERVATION","source":"001K","durable":false}',
    hashPolicy: {
      normalizationPolicy: 'TEXT_V1',
      newlinePolicy: 'LF',
      unicodePolicy: 'NFC',
    },
    ...overrides,
  };
}

async function acceptedFixtureTempRenamePlanResult() {
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
  return compileExactTextTestFixtureTempRenameObservationPlan({
    fixtureTextWritePlanResult,
    fixtureTempRenamePolicy: acceptedFixtureTempRenamePolicy(),
  });
}

test('accepted plan admits receipt file observation without durable receipt or ApplyReceipt claim', async () => {
  const { compileExactTextTestFixtureReceiptFileObservationPlan, canonicalHash } = await loadKernel();
  const fixtureTempRenamePlanResult = await acceptedFixtureTempRenamePlanResult();
  const first = compileExactTextTestFixtureReceiptFileObservationPlan({
    fixtureTempRenamePlanResult,
    fixtureReceiptFilePolicy: acceptedFixtureReceiptFilePolicy(),
  });
  const second = compileExactTextTestFixtureReceiptFileObservationPlan({
    fixtureTempRenamePlanResult,
    fixtureReceiptFilePolicy: acceptedFixtureReceiptFilePolicy(),
  });

  assert.deepEqual(first, second);
  assert.equal(first.contractOnly, true);
  assert.equal(first.testFixtureReceiptFileObservationPlanOnly, true);
  assert.equal(first.testFixtureReceiptFileObservationAdmitted, true);
  assert.equal(first.testFixtureReceiptFileObservationOnly, true);
  assert.equal(first.receiptObservationOnly, true);
  assert.equal(first.hashObservationOnly, true);
  assert.equal(first.productReceiptNotProven, true);
  assert.equal(first.durableReceiptNotProven, true);
  assert.equal(first.productApplyReceiptNotImplemented, true);
  assert.equal(first.productDurableReceiptNotProven, true);
  assert.equal(first.testReceiptFileNotRecovery, true);
  assert.equal(first.fixtureReceiptFileObservationNotProductPersistence, true);
  assert.equal(first.applyReceiptImplemented, false);
  assert.equal(first.filesystemWritePerformed, false);
  assert.equal(first.fsMutationPerformed, false);
  assert.equal(first.productWritePerformed, false);
  assert.equal(first.productWriteClaimed, false);
  assert.equal(first.productAtomicityClaimed, false);
  assert.equal(first.fixtureBackupCreated, false);
  assert.equal(first.fixtureAtomicWriteExecuted, false);
  assert.equal(first.fixtureRecoverySnapshotCreated, false);
  assert.equal(first.fixtureReceiptPersisted, false);
  assert.equal(first.durableReceiptClaimed, false);
  assert.equal(first.productApplyReceiptClaimed, false);
  assert.equal(first.productStorageSafetyClaimed, false);
  assert.equal(first.publicSurfaceClaimed, false);
  assert.equal(first.docxImportClaimed, false);
  assert.equal(first.uiChanged, false);
  assert.equal(first.applyTxnClaimed, false);
  assert.equal(first.crashRecoveryClaimed, false);
  assert.equal(first.releaseClaimed, false);
  assert.equal(first.storageImportsAdded, false);
  assert.equal(first.storagePrimitiveChanged, false);
  assert.deepEqual(first.blockedReasons, []);
  assert.equal(first.fixtureReceiptFileObservationDecisions.length, 1);

  const decision = first.fixtureReceiptFileObservationDecisions[0];
  assert.equal(decision.fixtureReceiptFileObservationDecisionKind, 'EXACT_TEXT_TEST_FIXTURE_RECEIPT_FILE_OBSERVATION_DECISION');
  assert.equal(decision.decisionMode, 'TEST_TEMP_RECEIPT_FILE_WRITE_READBACK_OBSERVATION_ONLY');
  assert.equal(decision.receiptRelativePath, 'receipt-001l.json');
  assert.equal(decision.productReceiptNotProven, true);
  assert.equal(decision.durableReceiptNotProven, true);
  assert.equal(decision.productApplyReceiptNotImplemented, true);
  assert.equal(decision.productDurableReceiptNotProven, true);
  assert.equal(decision.testReceiptFileNotRecovery, true);
  assert.equal(decision.fixtureReceiptFileObservationNotProductPersistence, true);
  assert.equal(decision.productApplyReceiptClaimed, false);
  assert.equal(decision.sourceFixtureTempRenameResultHash, fixtureTempRenamePlanResult.canonicalHash);
  assert.equal(decision.sourceFixtureTempRenameDecisionHash, fixtureTempRenamePlanResult.fixtureTempRenameDecisions[0].canonicalHash);
  assert.equal(decision.receiptHashObservation.textHash, canonicalHash({
    text: acceptedFixtureReceiptFilePolicy().receiptText,
    normalizationPolicy: 'TEXT_V1',
    newlinePolicy: 'LF',
    unicodePolicy: 'NFC',
  }));
});

test('receipt file observation writes and reads back one OS temp receipt file in contract test only', async () => {
  const { compileExactTextTestFixtureReceiptFileObservationPlan, canonicalHash } = await loadKernel();
  const result = compileExactTextTestFixtureReceiptFileObservationPlan({
    fixtureTempRenamePlanResult: await acceptedFixtureTempRenamePlanResult(),
    fixtureReceiptFilePolicy: acceptedFixtureReceiptFilePolicy(),
  });
  const decision = result.fixtureReceiptFileObservationDecisions[0];
  let tempRoot = '';
  try {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'exact-text-001l-'));
    const repoRoot = fs.realpathSync(process.cwd());
    const realTempRoot = fs.realpathSync(tempRoot);
    const receiptPath = path.join(realTempRoot, decision.receiptRelativePath);
    assert.equal(realTempRoot === repoRoot || realTempRoot.startsWith(`${repoRoot}${path.sep}`), false);
    assert.equal(path.dirname(receiptPath), realTempRoot);
    fs.writeFileSync(receiptPath, decision.receiptText, 'utf8');
    const readbackText = fs.readFileSync(receiptPath, 'utf8');
    assert.equal(readbackText, decision.receiptText);
    assert.equal(canonicalHash({
      text: readbackText,
      normalizationPolicy: 'TEXT_V1',
      newlinePolicy: 'LF',
      unicodePolicy: 'NFC',
    }), decision.receiptHashObservation.textHash);
  } finally {
    if (tempRoot) {
      fs.rmSync(tempRoot, { recursive: true, force: true });
      assert.equal(fs.existsSync(tempRoot), false);
    }
  }
});

test('missing contaminated or unsafe 001K result blocks receipt file observation', async () => {
  const { compileExactTextTestFixtureReceiptFileObservationPlan, REASON_CODES } = await loadKernel();
  const fixtureTempRenamePlanResult = await acceptedFixtureTempRenamePlanResult();
  const contaminated = [
    {},
    { ...fixtureTempRenamePlanResult, testFixtureTempRenameAdmitted: false },
    { ...fixtureTempRenamePlanResult, productWriteClaimed: true },
    { ...fixtureTempRenamePlanResult, productAtomicityClaimed: true },
    { ...fixtureTempRenamePlanResult, fixtureAtomicWriteExecuted: true },
    { ...fixtureTempRenamePlanResult, fixtureRecoverySnapshotCreated: true },
    { ...fixtureTempRenamePlanResult, fixtureReceiptPersisted: true },
    { ...fixtureTempRenamePlanResult, durableReceiptClaimed: true },
    { ...fixtureTempRenamePlanResult, productStorageSafetyClaimed: true },
    { ...fixtureTempRenamePlanResult, storagePrimitiveChanged: true },
    {
      ...fixtureTempRenamePlanResult,
      fixtureTempRenameDecisions: [{
        ...fixtureTempRenamePlanResult.fixtureTempRenameDecisions[0],
        productWritePerformed: true,
      }],
    },
    {
      ...fixtureTempRenamePlanResult,
      fixtureTempRenameDecisions: [{
        ...fixtureTempRenamePlanResult.fixtureTempRenameDecisions[0],
        productAtomicityClaimed: true,
      }],
    },
  ];

  for (const fixtureTempRenamePlanResultInput of contaminated) {
    const result = compileExactTextTestFixtureReceiptFileObservationPlan({
      fixtureTempRenamePlanResult: fixtureTempRenamePlanResultInput,
      fixtureReceiptFilePolicy: acceptedFixtureReceiptFilePolicy(),
    });
    assert.equal(result.testFixtureReceiptFileObservationAdmitted, false);
    assert.deepEqual(result.fixtureReceiptFileObservationDecisions, []);
    assert.equal(result.blockedReasons.includes(REASON_CODES.FIXTURE_TEMP_RENAME_PLAN_REQUIRED), true);
  }
});

test('product path public storage primitive and receipt claims block receipt file observation', async () => {
  const { compileExactTextTestFixtureReceiptFileObservationPlan, REASON_CODES } = await loadKernel();
  const fixtureTempRenamePlanResult = await acceptedFixtureTempRenamePlanResult();
  const cases = [
    [REASON_CODES.FIXTURE_RECEIPT_FILE_OWNER_MISSING, { fixtureReceiptFilePolicy: acceptedFixtureReceiptFilePolicy({ ownerFixtureReceiptFileObservationApproved: false }) }],
    [REASON_CODES.FIXTURE_RECEIPT_FILE_POLICY_REQUIRED, { fixtureReceiptFilePolicy: acceptedFixtureReceiptFilePolicy({ receiptObservationOnly: false }) }],
    [REASON_CODES.FIXTURE_RECEIPT_FILE_POLICY_REQUIRED, { fixtureReceiptFilePolicy: acceptedFixtureReceiptFilePolicy({ durableReceiptClaimed: true }) }],
    [REASON_CODES.FIXTURE_RECEIPT_FILE_POLICY_REQUIRED, { fixtureReceiptFilePolicy: acceptedFixtureReceiptFilePolicy({ applyReceiptImplemented: true }) }],
    [REASON_CODES.FIXTURE_RECEIPT_FILE_SCOPE_UNSAFE, { fixtureReceiptFilePolicy: acceptedFixtureReceiptFilePolicy({ repoRootAccess: true }) }],
    [REASON_CODES.PRODUCT_WRITE_FORBIDDEN_IN_CONTOUR, { productWrite: true }],
    [REASON_CODES.PRODUCT_WRITE_FORBIDDEN_IN_CONTOUR, { productPathRequested: true }],
    [REASON_CODES.PUBLIC_SURFACE_FORBIDDEN_IN_CONTOUR, { publicSurfaceRequested: true }],
    [REASON_CODES.FS_MUTATION_FORBIDDEN_IN_CONTOUR, { storagePrimitiveRequested: true }],
    [REASON_CODES.RECEIPT_CONTRACT_MISMATCH, { applyReceiptRequested: true }],
    [REASON_CODES.RECEIPT_CONTRACT_MISMATCH, { productApplyReceiptClaimed: true }],
    [REASON_CODES.RECEIPT_CONTRACT_MISMATCH, { durableReceiptClaimed: true }],
    [REASON_CODES.RECEIPT_CONTRACT_MISMATCH, { recoveryClaimed: true }],
    [REASON_CODES.ABSOLUTE_PATH_ESCAPE_FORBIDDEN, { fixtureReceiptFilePolicy: acceptedFixtureReceiptFilePolicy({ receiptRelativePath: '/tmp/receipt.json' }) }],
    [REASON_CODES.PATH_TRAVERSAL_FORBIDDEN, { fixtureReceiptFilePolicy: acceptedFixtureReceiptFilePolicy({ receiptRelativePath: '../receipt.json', receiptRelativePathSegments: ['..', 'receipt.json'] }) }],
    [REASON_CODES.FIXTURE_RECEIPT_FILE_POLICY_REQUIRED, { fixtureReceiptFilePolicy: acceptedFixtureReceiptFilePolicy({ receiptRelativePath: 'nested/receipt.json', receiptRelativePathSegments: ['receipt.json'] }) }],
  ];

  for (const [reasonCode, input] of cases) {
    const result = compileExactTextTestFixtureReceiptFileObservationPlan({
      fixtureTempRenamePlanResult,
      fixtureReceiptFilePolicy: input.fixtureReceiptFilePolicy || acceptedFixtureReceiptFilePolicy(),
      productWrite: input.productWrite,
      productPathRequested: input.productPathRequested,
      publicSurfaceRequested: input.publicSurfaceRequested,
      storagePrimitiveRequested: input.storagePrimitiveRequested,
      applyReceiptRequested: input.applyReceiptRequested,
      productApplyReceiptClaimed: input.productApplyReceiptClaimed,
      durableReceiptClaimed: input.durableReceiptClaimed,
      recoveryClaimed: input.recoveryClaimed,
    });
    assert.equal(result.testFixtureReceiptFileObservationAdmitted, false, reasonCode);
    assert.deepEqual(result.fixtureReceiptFileObservationDecisions, [], reasonCode);
    assert.equal(result.blockedReasons.includes(reasonCode), true, reasonCode);
  }
});

test('receipt hash and readback mismatch block observed success', async () => {
  const { compileExactTextTestFixtureReceiptFileObservationPlan, REASON_CODES } = await loadKernel();
  const fixtureTempRenamePlanResult = await acceptedFixtureTempRenamePlanResult();
  const cases = [
    [REASON_CODES.HASH_OBSERVATION_MISMATCH, {
      fixtureReceiptFilePolicy: acceptedFixtureReceiptFilePolicy({ expectedReceiptHash: 'not-the-receipt-hash' }),
    }],
    [REASON_CODES.RECEIPT_CONTRACT_MISMATCH, { receiptReadbackMismatch: true }],
    [REASON_CODES.RECEIPT_CONTRACT_MISMATCH, { receiptFileObservationMismatch: true }],
  ];

  for (const [reasonCode, input] of cases) {
    const result = compileExactTextTestFixtureReceiptFileObservationPlan({
      fixtureTempRenamePlanResult,
      fixtureReceiptFilePolicy: input.fixtureReceiptFilePolicy || acceptedFixtureReceiptFilePolicy(),
      receiptReadbackMismatch: input.receiptReadbackMismatch,
      receiptFileObservationMismatch: input.receiptFileObservationMismatch,
    });
    assert.equal(result.testFixtureReceiptFileObservationAdmitted, false, reasonCode);
    assert.deepEqual(result.fixtureReceiptFileObservationDecisions, [], reasonCode);
    assert.equal(result.blockedReasons.includes(reasonCode), true, reasonCode);
  }
});

test('001L task record pins receipt file observation as non durable and non product', () => {
  const taskText = fs.readFileSync(path.join(process.cwd(), 'docs', 'tasks', TASK_BASENAME), 'utf8');
  const requiredFalseFlags = [
    'PRODUCT_WRITE_PERFORMED',
    'PRODUCT_WRITE_CLAIMED',
    'PRODUCT_ATOMICITY_CLAIMED',
    'FIXTURE_BACKUP_CREATED',
    'FIXTURE_ATOMIC_WRITE_EXECUTED',
    'FIXTURE_RECOVERY_SNAPSHOT_CREATED',
    'FIXTURE_RECEIPT_PERSISTED',
    'DURABLE_RECEIPT_CLAIMED',
    'APPLY_RECEIPT_IMPLEMENTED',
    'PRODUCT_APPLY_RECEIPT_CLAIMED',
    'PRODUCT_STORAGE_SAFETY_CLAIMED',
    'PUBLIC_SURFACE_CLAIMED',
    'DOCX_IMPORT_CLAIMED',
    'UI_CHANGED',
    'APPLYTXN_CLAIMED',
    'CRASH_RECOVERY_CLAIMED',
    'RELEASE_CLAIMED',
    'STORAGE_PRIMITIVE_CHANGED',
  ];
  assert.match(taskText, /STATUS: IMPLEMENTED_LOCALLY_PENDING_DELIVERY_VERIFICATION/u);
  assert.match(taskText, /TEST_FIXTURE_RECEIPT_FILE_OBSERVED: true/u);
  assert.match(taskText, /RECEIPT_FILE_OBSERVATION_ONLY: true/u);
  assert.match(taskText, /RECEIPT_FILE_OBSERVATION_NOT_DURABLE_RECEIPT: true/u);
  assert.match(taskText, /PRODUCT_RECEIPT_NOT_PROVEN: true/u);
  assert.match(taskText, /PRODUCT_DURABLE_RECEIPT_NOT_PROVEN: true/u);
  assert.match(taskText, /TEST_RECEIPT_FILE_NOT_RECOVERY: true/u);
  assert.match(taskText, /FIXTURE_RECEIPT_FILE_OBSERVATION_NOT_PRODUCT_PERSISTENCE: true/u);
  assert.match(taskText, /NO_APPLY_RECEIPT_IMPLEMENTATION: true/u);
  assert.match(taskText, /NO_PRODUCT_STORAGE_ADAPTER_CLAIM: true/u);
  assert.match(taskText, /NO_STORAGE_PRIMITIVE_IMPLEMENTATION: true/u);
  for (const flag of requiredFalseFlags) {
    assert.match(taskText, new RegExp(`${flag}: false`, 'u'), flag);
    assert.doesNotMatch(taskText, new RegExp(`${flag}: true`, 'u'), flag);
  }
  assert.doesNotMatch(taskText, /product saved|public API exposed|DOCX runtime enabled|receipt persisted|durable receipt|ApplyReceipt implemented|backup executed|atomic write proven|product atomicity proven|crash recovery proven/iu);
});

test('001L change scope stays inside allowlist and outside product runtime surfaces', () => {
  const changedBasenames = changedBasenamesForCurrentContour();
  if (!changedBasenames.includes(TASK_BASENAME)) {
    const laterContourBasenames = new Set([
      'EXACT_TEXT_APPLY_PRODUCT_STORAGE_PRIMITIVE_EVIDENCE_GATE_001M.md',
      'EXACT_TEXT_APPLY_TEST_ONLY_STORAGE_PRIMITIVE_EXECUTION_HARNESS_001N.md',
      'EXACT_TEXT_APPLY_TEST_ONLY_PRODUCT_SHAPED_STORAGE_DRY_RUN_001O.md',
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
      'exactTextApplyInternalWritePrototype.mjs',
      'exactTextApplyInternalWritePrototype.contract.test.js',
      'exactTextApplyFixtureDurableReceiptPrototype.mjs',
      'exactTextApplyFixtureDurableReceiptPrototype.contract.test.js',
      'exactTextApplyPrivateProductApplyReceiptAdmission.mjs',
      'exactTextApplyPrivateProductApplyReceiptAdmission.contract.test.js',
      'exactTextApplyPrivateProductApplyReceipt.mjs',
      'exactTextApplyPrivateProductApplyReceipt.contract.test.js',
      'exactTextApplyWithReceiptAdmission.mjs',
      'exactTextApplyWithReceiptAdmission.contract.test.js',
      'exactTextApplyWithReceiptExecution.mjs',
    'exactTextApplyWithReceiptCloseout.mjs',
    'exactTextApplyWithReceiptNextAdmission.mjs',
    'exactTextApplyWithReceiptNextContourAdmission.mjs',
    'exactTextApplyWithReceiptPrivateContractBrief.mjs',
    'exactTextApplyWithReceiptPrivateContractShape.mjs',
    'exactTextApplyWithReceiptPrivatePortAdmission.mjs',
    'exactTextApplyWithReceiptPrivatePortImplementation.mjs',
    'exactTextApplyWithReceiptPrivatePortCloseoutNextContourPermission.mjs',
    'exactTextApplyWithReceiptProductPathImplementationOpeningAdmission.mjs',
      'exactTextApplyWithReceiptExecution.contract.test.js',
    'exactTextApplyWithReceiptCloseout.contract.test.js',
    'exactTextApplyWithReceiptNextAdmission.contract.test.js',
    'exactTextApplyWithReceiptNextContourAdmission.contract.test.js',
    'exactTextApplyWithReceiptPrivateContractBrief.contract.test.js',
    'exactTextApplyWithReceiptPrivateContractShape.contract.test.js',
    'exactTextApplyWithReceiptPrivatePortAdmission.contract.test.js',
    'exactTextApplyWithReceiptPrivatePortImplementation.contract.test.js',
    'exactTextApplyWithReceiptPrivatePortCloseoutNextContourPermission.contract.test.js',
    'exactTextApplyWithReceiptProductPathImplementationOpeningAdmission.contract.test.js',
      'exactTextApplyProductStoragePrimitiveEvidence.contract.test.js',
      'exactTextApplyTestOnlyStoragePrimitiveExecutionHarness.contract.test.js',
      'exactTextApplyTestOnlyProductShapedStorageDryRun.contract.test.js',
      'exactTextApplyProductApplyReadinessReview.contract.test.js',
      'exactTextApplyProductApplyAdmissionGate.contract.test.js',
    ]);
    assert.equal(
      changedBasenames.some((basename) => laterContourBasenames.has(basename)),
      true,
      '001L scope guard may defer only to a known later contour scope',
    );
    return;
  }
  const allowlist = new Set([
    'reviewIrKernel.mjs',
    'exactTextApplyTestFixtureReceiptFile.contract.test.js',
    'exactTextApplyTestFixtureTempRename.contract.test.js',
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
  assert.notDeepEqual(changedBasenames, [], '001L must have a detectable changed scope');
  for (const basename of changedBasenames) {
    assert.equal(allowlist.has(basename), true, `unexpected 001L changed basename: ${basename}`);
    assert.equal(denylist.has(basename), false, `denylisted 001L changed basename: ${basename}`);
  }
});

test('receipt file observation keeps production kernel pure and limits test mutation helpers', () => {
  const moduleText = fs.readFileSync(path.join(process.cwd(), 'src', 'revisionBridge', MODULE_BASENAME), 'utf8');
  const testText = fs.readFileSync(__filename, 'utf8');
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
    /from\s+['"][^'"]*(?:storage|main|preload|editor|command-catalog|projectCommands|fileManager|backupManager|atomicWrite)[^'"]*['"]/u,
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
  const forbiddenTestPatterns = [
    /\bwriteFile(?:Atomic)?\s*\(/u,
    /\bappendFile\s*\(/u,
    /\bmkdir\s*\(/u,
    /\brename\s*\(/u,
    /\bunlink\s*\(/u,
    /\bcreateWriteStream\s*\(/u,
  ];
  for (const pattern of forbiddenModulePatterns) {
    assert.equal(pattern.test(moduleText), false, `forbidden receipt file observation module pattern: ${pattern.source}`);
  }
  for (const pattern of forbiddenTestPatterns) {
    assert.equal(pattern.test(testText), false, `forbidden receipt file observation helper: ${pattern.source}`);
  }
  assert.equal(/\bmkdtempSync\s*\(/u.test(testText), true);
  assert.equal(/\bwriteFileSync\s*\(/u.test(testText), true);
  assert.equal(/\breadFileSync\s*\(/u.test(testText), true);
  assert.equal(/\brmSync\s*\(/u.test(testText), true);
});

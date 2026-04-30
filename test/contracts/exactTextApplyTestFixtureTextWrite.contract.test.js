const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const MODULE_BASENAME = 'reviewIrKernel.mjs';
const TASK_BASENAME = 'EXACT_TEXT_APPLY_TEST_FIXTURE_TEXT_WRITE_001J.md';

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

function exactTextDecision(overrides = {}) {
  const item = {
    id: 'decision-1',
    kind: 'TEXT_REPLACE',
    targetScope: { sceneId: 'scene-1', blockId: 'block-1' },
    blockVersionHash: 'block-v1',
    selectors: [
      {
        selectorKind: 'TEXT_QUOTE',
        selectorEvidence: { exact: 'old text', prefix: 'before', suffix: 'after' },
      },
    ],
    evidence: [{ exactText: 'old text', prefix: 'before', suffix: 'after' }],
    expectedText: 'old text',
    replacementText: 'new text',
    ...(overrides.item || {}),
  };
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
    items: [item],
    ...overrides.surface,
  };
}

function acceptedEnvironment(overrides = {}) {
  return {
    projectId: 'project-1',
    currentBaselineHash: 'baseline-a',
    sessionOpen: true,
    sceneId: 'scene-1',
    currentBlockVersions: { 'block-1': 'block-v1' },
    currentTextByBlock: { 'block-1': 'old text' },
    ...overrides,
  };
}

function acceptedStoragePortCapabilities(overrides = {}) {
  return {
    canBackupBeforeWrite: true,
    canAtomicWriteSceneText: true,
    canCreateReadableRecoverySnapshot: true,
    canReportBeforeHash: true,
    canReportAfterHash: true,
    deterministicObservationIds: true,
    productPathAccess: false,
    ...overrides,
  };
}

function acceptedFixtureCapabilities(overrides = {}) {
  return {
    canObserveBackup: true,
    canObserveAtomicWrite: true,
    canObserveRecoverySnapshot: true,
    canProduceFixtureReceiptContract: true,
    deterministicObservationIds: true,
    realIoAvailable: false,
    productPathAccess: false,
    ...overrides,
  };
}

function acceptedAdmissionPolicy(overrides = {}) {
  return {
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
    ...overrides,
  };
}

function acceptedAdmissionCapabilities(overrides = {}) {
  return {
    canBackupBeforeWrite: true,
    canAtomicWriteSceneText: true,
    canCreateReadableRecoverySnapshot: true,
    canPersistReceipt: true,
    productPathAccess: false,
    publicSurfaceAvailable: false,
    ...overrides,
  };
}

function acceptedFixtureRootPolicy(overrides = {}) {
  return {
    fixtureRootId: 'fixture-root-001J',
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
    ...overrides,
  };
}

function acceptedFixtureRootCreationPolicy(overrides = {}) {
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
    ...overrides,
  };
}

function acceptedFixtureTextWritePolicy(overrides = {}) {
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
    ...overrides,
  };
}

async function acceptedFixtureRootCreationPlanResult(overrides = {}) {
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
  } = await loadKernel();
  const applyResult = compileExactTextApplyOps(
    buildReviewPatchSet(exactTextDecision(overrides.decision || {})),
    acceptedEnvironment(overrides.environment || {}),
  );
  const effectPreviewPlan = compileExactTextApplyEffectPreviews(applyResult);
  const writePlanReceiptResult = compileExactTextWritePlanReceiptContract({ applyResult, effectPreviewPlan });
  const storageAdapterCallPlanResult = compileExactTextStorageAdapterCallPlan({
    writePlanReceiptResult,
    storagePortCapabilities: acceptedStoragePortCapabilities(overrides.storagePortCapabilities || {}),
  });
  const storagePortFixtureResult = compileExactTextInMemoryStoragePortFixture({
    storageAdapterCallPlanResult,
    fixtureCapabilities: acceptedFixtureCapabilities(overrides.fixtureCapabilities || {}),
  });
  const storageAdmissionGateResult = compileExactTextStorageAdmissionGate({
    storagePortFixtureResult,
    storageAdmissionPolicy: acceptedAdmissionPolicy(overrides.storageAdmissionPolicy || {}),
    storageAdmissionCapabilities: acceptedAdmissionCapabilities(overrides.storageAdmissionCapabilities || {}),
  });
  const fixtureRootPathPolicyResult = compileExactTextFixtureRootPathPolicy({
    storageAdmissionGateResult,
    fixtureRootPolicy: acceptedFixtureRootPolicy(overrides.fixtureRootPolicy || {}),
  });
  return compileExactTextRealFixtureRootCreationPlan({
    fixtureRootPathPolicyResult,
    fixtureRootCreationPolicy: acceptedFixtureRootCreationPolicy(overrides.fixtureRootCreationPolicy || {}),
  });
}

test('accepted plan admits test fixture text write and observes before and after hashes only', async () => {
  const { compileExactTextTestFixtureTextWritePlan, canonicalHash } = await loadKernel();
  const fixtureRootCreationPlanResult = await acceptedFixtureRootCreationPlanResult();
  const first = compileExactTextTestFixtureTextWritePlan({
    fixtureRootCreationPlanResult,
    fixtureTextWritePolicy: acceptedFixtureTextWritePolicy(),
  });
  const second = compileExactTextTestFixtureTextWritePlan({
    fixtureRootCreationPlanResult,
    fixtureTextWritePolicy: acceptedFixtureTextWritePolicy(),
  });

  assert.deepEqual(first, second);
  assert.equal(first.contractOnly, true);
  assert.equal(first.testFixtureTextWritePlanOnly, true);
  assert.equal(first.testFixtureTextWriteAdmitted, true);
  assert.equal(first.testFixtureFileWriteOnly, true);
  assert.equal(first.hashObservationOnly, true);
  assert.equal(first.filesystemWritePerformed, false);
  assert.equal(first.fsMutationPerformed, false);
  assert.equal(first.productWritePerformed, false);
  assert.equal(first.productWriteClaimed, false);
  assert.equal(first.fixtureBackupCreated, false);
  assert.equal(first.fixtureAtomicWriteExecuted, false);
  assert.equal(first.fixtureRecoverySnapshotCreated, false);
  assert.equal(first.fixtureReceiptPersisted, false);
  assert.equal(first.durableReceiptClaimed, false);
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
  assert.equal(first.fixtureTextWriteDecisions.length, 1);

  const decision = first.fixtureTextWriteDecisions[0];
  assert.equal(decision.fixtureTextWriteDecisionKind, 'EXACT_TEXT_TEST_FIXTURE_TEXT_WRITE_DECISION');
  assert.equal(decision.decisionMode, 'TEST_TEMP_FILE_HASH_OBSERVATION_ONLY');
  assert.equal(decision.hashObservationOnly, true);
  assert.equal(decision.relativePath, 'scene-1.txt');
  assert.deepEqual(decision.relativePathSegments, ['scene-1.txt']);
  assert.equal(decision.sourceFixtureRootCreationResultHash, fixtureRootCreationPlanResult.canonicalHash);
  assert.equal(decision.sourceFixtureRootCreationDecisionHash, fixtureRootCreationPlanResult.fixtureRootCreationDecisions[0].canonicalHash);
  assert.equal(decision.beforeHashObservation.textHash, canonicalHash({
    text: 'old text',
    normalizationPolicy: 'TEXT_V1',
    newlinePolicy: 'LF',
    unicodePolicy: 'NFC',
  }));
  assert.equal(decision.afterHashObservation.textHash, canonicalHash({
    text: 'new text',
    normalizationPolicy: 'TEXT_V1',
    newlinePolicy: 'LF',
    unicodePolicy: 'NFC',
  }));
  assert.equal(first.canonicalHash, canonicalHash({
    resultKind: first.resultKind,
    contractOnly: first.contractOnly,
    testFixtureTextWritePlanOnly: first.testFixtureTextWritePlanOnly,
    testFixtureTextWriteAdmitted: first.testFixtureTextWriteAdmitted,
    testFixtureFileWriteOnly: first.testFixtureFileWriteOnly,
    hashObservationOnly: first.hashObservationOnly,
    filesystemWritePerformed: first.filesystemWritePerformed,
    fsMutationPerformed: first.fsMutationPerformed,
    productWritePerformed: first.productWritePerformed,
    productWriteClaimed: first.productWriteClaimed,
    fixtureBackupCreated: first.fixtureBackupCreated,
    fixtureAtomicWriteExecuted: first.fixtureAtomicWriteExecuted,
    fixtureRecoverySnapshotCreated: first.fixtureRecoverySnapshotCreated,
    fixtureReceiptPersisted: first.fixtureReceiptPersisted,
    durableReceiptClaimed: first.durableReceiptClaimed,
    productStorageSafetyClaimed: first.productStorageSafetyClaimed,
    publicSurfaceClaimed: first.publicSurfaceClaimed,
    docxImportClaimed: first.docxImportClaimed,
    uiChanged: first.uiChanged,
    applyTxnClaimed: first.applyTxnClaimed,
    crashRecoveryClaimed: first.crashRecoveryClaimed,
    releaseClaimed: first.releaseClaimed,
    storageImportsAdded: first.storageImportsAdded,
    storagePrimitiveChanged: first.storagePrimitiveChanged,
    fixtureTextWriteDecisions: first.fixtureTextWriteDecisions,
    blockedReasons: first.blockedReasons,
  }));
});

test('accepted test fixture text write performs one OS temp file write and cleanup in contract test only', async () => {
  const { compileExactTextTestFixtureTextWritePlan, canonicalHash } = await loadKernel();
  const result = compileExactTextTestFixtureTextWritePlan({
    fixtureRootCreationPlanResult: await acceptedFixtureRootCreationPlanResult(),
    fixtureTextWritePolicy: acceptedFixtureTextWritePolicy(),
  });
  const decision = result.fixtureTextWriteDecisions[0];
  let tempRoot = '';
  try {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'exact-text-001j-'));
    const repoRoot = fs.realpathSync(process.cwd());
    const realTempRoot = fs.realpathSync(tempRoot);
    const targetPath = path.join(realTempRoot, decision.relativePath);
    assert.equal(realTempRoot === repoRoot || realTempRoot.startsWith(`${repoRoot}${path.sep}`), false);
    assert.equal(path.dirname(targetPath), realTempRoot);
    fs.writeFileSync(targetPath, acceptedFixtureTextWritePolicy().beforeText, 'utf8');
    assert.equal(fs.readFileSync(targetPath, 'utf8'), 'old text');
    assert.equal(canonicalHash({
      text: fs.readFileSync(targetPath, 'utf8'),
      normalizationPolicy: 'TEXT_V1',
      newlinePolicy: 'LF',
      unicodePolicy: 'NFC',
    }), decision.beforeHashObservation.textHash);
    fs.writeFileSync(targetPath, acceptedFixtureTextWritePolicy().afterText, 'utf8');
    assert.equal(fs.readFileSync(targetPath, 'utf8'), 'new text');
    assert.equal(canonicalHash({
      text: fs.readFileSync(targetPath, 'utf8'),
      normalizationPolicy: 'TEXT_V1',
      newlinePolicy: 'LF',
      unicodePolicy: 'NFC',
    }), decision.afterHashObservation.textHash);
  } finally {
    if (tempRoot) {
      fs.rmSync(tempRoot, { recursive: true, force: true });
      assert.equal(fs.existsSync(tempRoot), false);
    }
  }
});

test('missing contaminated or unsafe upstream blocks test fixture text write', async () => {
  const { compileExactTextTestFixtureTextWritePlan, REASON_CODES } = await loadKernel();
  const fixtureRootCreationPlanResult = await acceptedFixtureRootCreationPlanResult();
  const cases = [
    [REASON_CODES.FIXTURE_ROOT_CREATION_PLAN_REQUIRED, {}],
    [REASON_CODES.FIXTURE_ROOT_CREATION_PLAN_REQUIRED, { ...fixtureRootCreationPlanResult, realFixtureRootCreationAdmitted: false }],
    [REASON_CODES.FIXTURE_ROOT_CREATION_PLAN_REQUIRED, { ...fixtureRootCreationPlanResult, productWriteClaimed: true }],
    [REASON_CODES.FIXTURE_ROOT_CREATION_PLAN_REQUIRED, { ...fixtureRootCreationPlanResult, fixtureAtomicWriteExecuted: true }],
    [REASON_CODES.FIXTURE_ROOT_CREATION_PLAN_REQUIRED, { ...fixtureRootCreationPlanResult, fixtureRecoverySnapshotCreated: true }],
    [REASON_CODES.FIXTURE_ROOT_CREATION_PLAN_REQUIRED, { ...fixtureRootCreationPlanResult, fixtureReceiptPersisted: true }],
  ];

  for (const [reasonCode, upstream] of cases) {
    const result = compileExactTextTestFixtureTextWritePlan({
      fixtureRootCreationPlanResult: upstream,
      fixtureTextWritePolicy: acceptedFixtureTextWritePolicy(),
    });
    assert.equal(result.testFixtureTextWriteAdmitted, false, reasonCode);
    assert.equal(result.testFixtureFileWriteOnly, false, reasonCode);
    assert.deepEqual(result.fixtureTextWriteDecisions, [], reasonCode);
    assert.equal(result.productWritePerformed, false, reasonCode);
    assert.equal(result.blockedReasons.includes(reasonCode), true, reasonCode);
  }
});

test('product repo public path and storage primitive requests block test fixture text write', async () => {
  const { compileExactTextTestFixtureTextWritePlan, REASON_CODES } = await loadKernel();
  const fixtureRootCreationPlanResult = await acceptedFixtureRootCreationPlanResult();
  const cases = [
    [REASON_CODES.FIXTURE_TEXT_WRITE_OWNER_MISSING, {
      fixtureTextWritePolicy: acceptedFixtureTextWritePolicy({ ownerFixtureTextWriteApproved: false }),
    }],
    [REASON_CODES.FIXTURE_TEXT_WRITE_POLICY_REQUIRED, {
      fixtureTextWritePolicy: acceptedFixtureTextWritePolicy({ hashObservationOnly: false }),
    }],
    [REASON_CODES.FIXTURE_TEXT_WRITE_SCOPE_UNSAFE, {
      fixtureTextWritePolicy: acceptedFixtureTextWritePolicy({ repoRootAccess: true }),
    }],
    [REASON_CODES.FIXTURE_TEXT_WRITE_SCOPE_UNSAFE, {
      fixtureTextWritePolicy: acceptedFixtureTextWritePolicy({ productRootAccess: true }),
    }],
    [REASON_CODES.PRODUCT_WRITE_FORBIDDEN_IN_CONTOUR, { productWrite: true }],
    [REASON_CODES.PRODUCT_WRITE_FORBIDDEN_IN_CONTOUR, { productPathRequested: true }],
    [REASON_CODES.PUBLIC_SURFACE_FORBIDDEN_IN_CONTOUR, { publicSurfaceRequested: true }],
    [REASON_CODES.FS_MUTATION_FORBIDDEN_IN_CONTOUR, { storagePrimitiveRequested: true }],
    [REASON_CODES.ABSOLUTE_PATH_ESCAPE_FORBIDDEN, {
      fixtureTextWritePolicy: acceptedFixtureTextWritePolicy({ relativePath: '/tmp/scene-1.txt' }),
    }],
    [REASON_CODES.PATH_TRAVERSAL_FORBIDDEN, {
      fixtureTextWritePolicy: acceptedFixtureTextWritePolicy({ relativePath: '../scene-1.txt', relativePathSegments: ['..', 'scene-1.txt'] }),
    }],
    [REASON_CODES.FIXTURE_TEXT_WRITE_POLICY_REQUIRED, {
      fixtureTextWritePolicy: acceptedFixtureTextWritePolicy({ relativePath: 'nested/scene-1.txt', relativePathSegments: ['scene-1.txt'] }),
    }],
  ];

  for (const [reasonCode, input] of cases) {
    const result = compileExactTextTestFixtureTextWritePlan({
      fixtureRootCreationPlanResult,
      fixtureTextWritePolicy: input.fixtureTextWritePolicy || acceptedFixtureTextWritePolicy(),
      productWrite: input.productWrite,
      productPathRequested: input.productPathRequested,
      publicSurfaceRequested: input.publicSurfaceRequested,
      storagePrimitiveRequested: input.storagePrimitiveRequested,
    });
    assert.equal(result.testFixtureTextWriteAdmitted, false, reasonCode);
    assert.deepEqual(result.fixtureTextWriteDecisions, [], reasonCode);
    assert.equal(result.productWritePerformed, false, reasonCode);
    assert.equal(result.blockedReasons.includes(reasonCode), true, reasonCode);
  }
});

test('hash mismatch blocks fixture text write plan before any observed success', async () => {
  const { compileExactTextTestFixtureTextWritePlan, REASON_CODES } = await loadKernel();
  const fixtureRootCreationPlanResult = await acceptedFixtureRootCreationPlanResult();
  const cases = [
    acceptedFixtureTextWritePolicy({ expectedBeforeHash: 'not-the-before-hash' }),
    acceptedFixtureTextWritePolicy({ expectedAfterHash: 'not-the-after-hash' }),
  ];

  for (const fixtureTextWritePolicy of cases) {
    const result = compileExactTextTestFixtureTextWritePlan({
      fixtureRootCreationPlanResult,
      fixtureTextWritePolicy,
    });
    assert.equal(result.testFixtureTextWriteAdmitted, false);
    assert.deepEqual(result.fixtureTextWriteDecisions, []);
    assert.equal(result.blockedReasons.includes(REASON_CODES.HASH_OBSERVATION_MISMATCH), true);
  }
});

test('001J task record pins test only fixture write and no product storage claim', () => {
  const taskText = fs.readFileSync(
    path.join(process.cwd(), 'docs', 'tasks', TASK_BASENAME),
    'utf8',
  );
  const requiredFalseFlags = [
    'PRODUCT_WRITE_PERFORMED',
    'PRODUCT_WRITE_CLAIMED',
    'FIXTURE_BACKUP_CREATED',
    'FIXTURE_ATOMIC_WRITE_EXECUTED',
    'FIXTURE_RECOVERY_SNAPSHOT_CREATED',
    'FIXTURE_RECEIPT_PERSISTED',
    'DURABLE_RECEIPT_CLAIMED',
    'PRODUCT_STORAGE_SAFETY_CLAIMED',
    'PUBLIC_SURFACE_CLAIMED',
    'DOCX_IMPORT_CLAIMED',
    'UI_CHANGED',
    'APPLYTXN_CLAIMED',
    'CRASH_RECOVERY_CLAIMED',
    'RELEASE_CLAIMED',
    'STORAGE_PRIMITIVE_CHANGED',
  ];

  assert.match(taskText, /STATUS: IMPLEMENTED_VERIFIED_TEST_FIXTURE_TEXT_WRITE_ONLY/u);
  assert.match(taskText, /TEST_FIXTURE_TEXT_WRITTEN: true/u);
  assert.match(taskText, /TEST_MUTATING_IO_SCOPE: OS_TEMP_FILE_ONLY/u);
  assert.match(taskText, /HASH_OBSERVATION_NOT_RECEIPT: true/u);
  assert.match(taskText, /TEST_CLEANUP_NOT_RECOVERY: true/u);
  assert.match(taskText, /NO_PRODUCT_ATOMICITY_CLAIM: true/u);
  assert.match(taskText, /NO_PRODUCT_STORAGE_ADAPTER_CLAIM: true/u);
  assert.match(taskText, /NO_STORAGE_PRIMITIVE_IMPLEMENTATION: true/u);
  for (const flag of requiredFalseFlags) {
    assert.match(taskText, new RegExp(`${flag}: false`, 'u'), flag);
    assert.doesNotMatch(taskText, new RegExp(`${flag}: true`, 'u'), flag);
  }
  assert.doesNotMatch(taskText, /product saved|public API exposed|DOCX runtime enabled|receipt persisted|backup executed|atomic write executed|crash recovery proven|crash recovery ready/iu);
});

test('001J change scope stays inside allowlist and outside product runtime surfaces', () => {
  const changedBasenames = changedBasenamesForCurrentContour();
  const allowlist = new Set([
    'reviewIrKernel.mjs',
    'exactTextApplyRealFixtureRootCreation.contract.test.js',
    'exactTextApplyTestFixtureTextWrite.contract.test.js',
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

  assert.notDeepEqual(changedBasenames, [], '001J must have a detectable changed scope');
  for (const basename of changedBasenames) {
    assert.equal(allowlist.has(basename), true, `unexpected 001J changed basename: ${basename}`);
    assert.equal(denylist.has(basename), false, `denylisted 001J changed basename: ${basename}`);
  }
});

test('test fixture text write keeps production kernel pure and limits test mutation helpers', () => {
  const moduleText = fs.readFileSync(
    path.join(process.cwd(), 'src', 'revisionBridge', MODULE_BASENAME),
    'utf8',
  );
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
    assert.equal(pattern.test(moduleText), false, `forbidden test fixture text write module pattern: ${pattern.source}`);
  }
  for (const pattern of forbiddenTestPatterns) {
    assert.equal(pattern.test(testText), false, `forbidden test fixture text write helper: ${pattern.source}`);
  }
  assert.equal(/\bmkdtempSync\s*\(/u.test(testText), true);
  assert.equal(/\bwriteFileSync\s*\(/u.test(testText), true);
  assert.equal(/\brmSync\s*\(/u.test(testText), true);
});
